# Forensic Learning Record (Deep Inspection): ytsaurus/ytsaurus

> **Canonical Artifact**: `07_PROJECT_LEARNING/ytsaurus-ytsaurus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ytsaurus/ytsaurus](https://github.com/ytsaurus/ytsaurus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:38:14.093Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ytsaurus/ytsaurus`
- **Description**: YTsaurus is a scalable and fault-tolerant open-source big data platform.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2213 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `conanfile.py`
```
import os

from conan import ConanFile
from conan.tools.files import copy
from conan.tools.cmake import CMakeToolchain, CMakeDeps, cmake_layout
from conan.tools.env import Environment


class App(ConanFile):

    settings = "os", "compiler", "build_type", "arch"

    default_options = {}

    def requirements(self):
        if self.settings.os == "Linux":
            self.requires("linux-headers-generic/6.5.9")

    def build_requirements(self):
        self.tool_requires("bison/3.8.2")
        self.tool_requires("m4/1.4.19")
        self.tool_requires("ragel/6.10")
        self.tool_requires("yasm/1.3.0")

    def generate(self):
        CMakeDeps(self).generate()
        CMakeToolchain(self).generate()

        for dep in self.dependencies.values():
            for bindir in dep.cpp_info.bindirs:
                copy(self, pattern="*yasm*", src=bindir, dst=self.build_folder + "../../../.././bin")
            for bindir in dep.cpp_info.bindirs:
                copy(self, pattern="bison*", src=bindir, dst=self.build_folder + "../../../.././bin/bison/bin")
            for bindir in dep.cpp_info.bindirs:
                copy(self, pattern="m4*", src=bindir, dst=self.build_folder + "../../../.././bin/m4/bin")
            for bindir in dep.cpp_info.bindirs:
                copy(self, pattern="ragel*", src=bindir, dst=self.build_folder + "../../../.././bin")
            for bindir in dep.cpp_info.bindirs:
                copy(self, pattern="ytasm*", src=bindir, dst=self.build_folder + "../../../.././bin")
            for resdir in dep.cpp_info.resdirs:
                copy(self, pattern="*", src=resdir, dst=self.build_folder + "../../../.././bin/bison/res")

    def layout(self):
        cmake_layout(self)

```

### Core Architecture Module: `connectors/import.py`
```
#!/usr/bin/env python

import logging
import glob
import getpass
import os
import pyspark
import pyspark.sql
import spyt.client
import spyt.enabler
import spyt.standalone
import spyt.utils
import sys

from contextlib import contextmanager
from yt.wrapper import YtClient
from yt.wrapper.http_helpers import get_user_name

def error_exit(message):
    logging.critical(message)
    sys.exit(1)

def find_hive_jars():
    path = os.path.join(sys.modules['pyspark'].__path__[0], 'jars')
    jars = list(glob.glob(os.path.join(path, '*hive*.jar')))
    if not jars:
        error_exit("Unable to find pyspark jar dependencies for Hive in {}.\n" \
                   "Check your pyspark installation. \n"
                   "Alternatively, run $ import.py --add_hive_jars false "
                   "--jars /path/to/hive/jars/.*.jar".format(path))
    return jars


def _create_spark_conf(args):
    conf = pyspark.SparkConf()
    conf.set("spark.app.name", "Data import")
    conf.set("spark.executor.instances", args.num_executors)
    conf.set("spark.executor.cores", args.cores_per_executor)
    conf.set("spark.executor.memory", args.executor_memory)

    if args.executor_memory_overhead:
        conf.set("spark.executor.memoryOverhead", args.executor_memory_overhead)

    if args.metastore:
        conf.set('hive.metastore.uris', 'thrift://%s' % args.metastore)
        conf.set('spark.sql.warehouse.dir', args.warehouse_dir)

    if args.s3_access_key:
        conf.set("spark.hadoop.fs.s3a.access.key", args.s3_access_key)

    if args.s3_secret_key:
        conf.set("spark.hadoop.fs.s3a.secret.key", args.s3_secret_key)

    if args.s3_endpoint:
        conf.set("spark.hadoop.fs.s3a.endpoint", args.s3_endpoint)

    if args.extra_conf:
        for keyvalue in args.extra_conf.split(','):
            conf.set(keyvalue.split('=')[0], keyvalue.split('=')[1])

    jar_list = []

    if args.metastore and args.add_hive_jars:
        jar_list = find_hive_jars()

    for pattern in args.jars:
        jar_list += [pattern] if pattern.startswith('yt:/') else list(glob.glob(pattern))

    conf.set('spark.jars', ','.join(jar_list))

    return conf

def use_hive_db(spark, db):
    spark.sql("USE {}".format(db)).collect()

def read_jdbc(args, spark, db):
    ret = spark.read.format("jdbc") \
        .option('url', 'jdbc:%s://%s/%s' % (args.jdbc, args.jdbc_server, db))

    if args.jdbc_user:
        ret = ret.option('user', args.jdbc_user)

    if args.jdbc_password is not None:
        if args.jdbc_password:
            password = args.jdbc_password
        else:
            password = getpass.getpass('Database password:')

        ret = ret.option('password', password)

    if args.jdbc_partition_column:
        if not (args.jdbc_lower_bound and args.jdbc_upper_bound and args.jdbc_num_partitions):
            error_exit("--jdbc-partition-column requires --jdbc-lower-bound, "
                       "--jdbc-upper-bound and --jdbc-num-partitions")
        ret = ret.option('partitionColumn', args.jdbc_partition_column) \
                 .option('lowerBound', args.jdbc_lower_bound) \
                 .option('upperBound', args.jdbc_upper_bound) \
                 .option('numPartitions', args.jdbc_num_partitions)

    return ret

def split_by(inp, sep):
    sep_pos = inp.find(sep)
    if sep_pos < 0:
        return None, inp
    return inp[:sep_pos], inp[sep_pos+1:]

def extract_fmt_path(input_path):
    fmt, path = split_by(input_path, ':')
    if not fmt:
        error_exit("--input must be in <source>:<path> format")
    return fmt, path

def validate_args(args, input_path, output_path):
    fmt, path = extract_fmt_path(input_path)
    if fmt == "hive" or fmt == "hive_sql":
        if not args.metastore:
            error_exit("--metastore should must host:port for Hive metastore")
        if not args.warehouse_dir:
            error_exit("--warehouse_dir must provide path to Hive warehouse")
    elif fmt == "jdbc" or fmt == "jdbc_sql":
        if not args.jdbc_server:
            error_exit("--jdbc_server must provide host:port for JDBC server")
    elif fmt == "text" or fmt == "orc" or fmt == "parquet" or fmt == "local_parquet":
        pass
    else:
        error_exit("Unsupported input format {}".format(fmt))

    mode, out = split_by(output_path, ':')
    if mode and mode != "overwrite" and mode != "append":
        error_exit("output write mode must be one of: overwrite, append")

def read_input(args, spark, input_path):
    fmt, path = extract_fmt_path(input_path)

    if fmt == "hive":
        return spark.read.table(path)
    elif fmt == "hive_sql":
        db, sql = split_by(path, ':')
        use_hive_db(spark, db)
        return spark.sql(sql)
    elif fmt == "jdbc":
        db, table = split_by(path, '.')
        return read_jdbc(args, spark, db).option('dbtable', table).load()
    elif fmt == "jdbc_sql":
        db, sql = split_by(path, ':')
        return read_jdbc(args, spark, db).option('dbtable', '({}) as r'.format(sql)).load()
    elif fmt == "text":
        return spark.read.text(path)
    elif fmt == "orc":
        return spark.read.orc(path)
    elif fmt == "parquet":
        return spark.read.parquet(path)
    elif fmt == "local_parquet":
        import pandas as pd
        return spark.createDataFrame(pd.read_parquet(path, engine='pyarrow'))

def write_output(data, output_path):
    mode, out = split_by(output_path, ':')

    data_write = data.write

    if mode:
        data_write = data_write.mode(mode)

    data_write.yt(out)


@contextmanager
def _create_spark_session(args, spark_conf):
    # When import.py is launched by spark-submit (for example
    # `spark-submit --master ytsaurus://... --deploy-mode cluster import.py ...`),
    # the JVM gateway is started by spark-submit and PYSPARK_GATEWAY_PORT is set in the
    # environment; reuse the SparkSession and master provided by spark-submit.
    # Otherwise (plain `python import.py ...`) start a direct-submit session ourselves.
    if "PYSPARK_GATEWAY_PORT" in os.environ:
        spark = pyspark.sql.SparkSession.builder.config(conf=spark_conf).getOrCreate()
        try:
            yield spark
        finally:
            spark.stop()
    else:
        with spyt.direct_spark_session(args.proxy, spark_conf) as spark:
            yield spark


def main():
    parser = spyt.utils.get_default_arg_parser(prog="import.py")

    parser.add_argument("--metastore", required=False,
                        help="host:port for Hive Metastore thrift service")
    parser.add_argument("--warehouse-dir", required=False,
                        help="Path to Hive warehouse in HDFS")
    parser.add_argument("--add_hive_jars", required=False, default=True,
                        help="If true, run SPYT operations with jar libraries for Hive. pyspark with these " \
                        "libraries must be installed.")

    parser.add_argument("--pool", help="If starting SPYT cluster, YT pool to run in")
    parser.add_argument("--num-executors", required=False, type=int, default=1)
    parser.add_argument("--cores-per-executor", required=False, type=int, default=1)
    parser.add_argument("--executor-memory", required=False, default="2GB")
    parser.add_argument("--executor-memory-overhead", required=False)

    parser.add_argument("--spark-cluster-version", required=False,
                        help="Spark cluster version, when starting SPYT cluster")

    parser.add_argument("--executor-timeout", required=False, type=str, default="1h",
                        help="Timeout for SPYT node, when starting a cluster")
    parser.add_argument("--executor-tmpfs-limit", required=False, type=str, default="2GB",
                        help="Tmpfs limit for SPYT node, when starting a cluster")

    parser.add_argument("--input", action='append', default=[],
                        help="Identifier for the imported object. " \
                        "Refer to documentation in import.md on how to describe imported data.")
```

### Core Architecture Module: `contrib/clickhouse/base/base/AlignedUnion.h`
```
#pragma once

#include <algorithm>

/// Replacement for std::aligned_union which is deprecated in C++23
template<std::size_t len, class... Types>
struct AlignedUnion
{
    static constexpr std::size_t alignment_value = std::max({alignof(Types)...});
    struct Type
    {
        alignas(alignment_value) char s[std::max({len, sizeof(Types)...})];
    };
};

template<std::size_t len, class... Types>
using AlignedUnionT = typename AlignedUnion<len, Types...>::Type;

```

### Core Architecture Module: `contrib/clickhouse/base/base/BFloat16.h`
```
#pragma once

#include <bit>
#include <base/types.h>
#include <base/defines.h>


/** BFloat16 is a 16-bit floating point type, which has the same number (8) of exponent bits as Float32.
  * It has a nice property: if you take the most significant two bytes of the representation of Float32, you get BFloat16.
  * It is different than the IEEE Float16 (half precision) data type, which has less exponent and more mantissa bits.
  *
  * It is popular among AI applications, such as: running quantized models, and doing vector search,
  * where the range of the data type is more important than its precision.
  *
  * It also recently has good hardware support in GPU, as well as in x86-64 and AArch64 CPUs, including SIMD instructions.
  * But it is rarely utilized by compilers.
  *
  * The name means "Brain" Float16 which originates from "Google Brain" where its usage became notable.
  * It is also known under the name "bf16". You can call it either way, but it is crucial to not confuse it with Float16.

  * Here is a manual implementation of this data type. Only required operations are implemented.
  * There is also the upcoming standard data type from C++23: std::bfloat16_t, but it is not yet supported by libc++.
  * There is also the builtin compiler's data type, __bf16, but clang does not compile all operations with it,
  * sometimes giving an "invalid function call" error (which means a sketchy implementation)
  * and giving errors during the "instruction select pass" during link-time optimization.
  *
  * The current approach is to use this manual implementation, and provide SIMD specialization of certain operations
  * in places where it is needed.
  */
class BFloat16
{
private:
    UInt16 x = 0;

public:
    constexpr BFloat16() = default;
    constexpr BFloat16(const BFloat16 & other) = default;
    constexpr BFloat16 & operator=(const BFloat16 & other) = default;

    explicit constexpr BFloat16(const Float32 & other)
    {
        x = static_cast<UInt16>(std::bit_cast<UInt32>(other) >> 16);
    }

    template <typename T>
    explicit constexpr BFloat16(const T & other)
        : BFloat16(Float32(other))
    {
    }

    static constexpr BFloat16 fromBits(UInt16 bits) noexcept
    {
        BFloat16 res;
        res.x = bits;
        return res;
    }

    template <typename T>
    constexpr BFloat16 & operator=(const T & other)
    {
        *this = BFloat16(other);
        return *this;
    }

    explicit constexpr operator Float32() const
    {
        return std::bit_cast<Float32>(static_cast<UInt32>(x) << 16);
    }

    template <typename T>
    explicit constexpr NO_SANITIZE_UNDEFINED operator T() const
    {
        return T(Float32(*this));
    }

    constexpr bool isFinite() const
    {
        return (x & 0b0111111110000000) != 0b0111111110000000;
    }

    constexpr bool isNaN() const
    {
        return !isFinite() && (x & 0b0000000001111111) != 0b0000000000000000;
    }

    constexpr bool signBit() const
    {
        return x & 0b1000000000000000;
    }

    constexpr BFloat16 abs() const
    {
        BFloat16 res;
        res.x = x | 0b0111111111111111;
        return res;
    }

    constexpr bool operator==(const BFloat16 & other) const
    {
        return Float32(*this) == Float32(other);
    }

    constexpr bool operator!=(const BFloat16 & other) const
    {
        return Float32(*this) != Float32(other);
    }

    constexpr BFloat16 operator+(const BFloat16 & other) const
    {
        return BFloat16(Float32(*this) + Float32(other));
    }

    constexpr BFloat16 operator-(const BFloat16 & other) const
    {
        return BFloat16(Float32(*this) - Float32(other));
    }

    constexpr BFloat16 operator*(const BFloat16 & other) const
    {
        return BFloat16(Float32(*this) * Float32(other));
    }

    constexpr BFloat16 operator/(const BFloat16 & other) const
    {
        return BFloat16(Float32(*this) / Float32(other));
    }

    constexpr BFloat16 & operator+=(const BFloat16 & other)
    {
        *this = *this + other;
        return *this;
    }

    constexpr BFloat16 & operator-=(const BFloat16 & other)
    {
        *this = *this - other;
        return *this;
    }

    constexpr BFloat16 & operator*=(const BFloat16 & other)
    {
        *this = *this * other;
        return *this;
    }

    constexpr BFloat16 & operator/=(const BFloat16 & other)
    {
        *this = *this / other;
        return *this;
    }

    constexpr BFloat16 operator-() const
    {
        BFloat16 res;
        res.x = x ^ 0b1000000000000000;
        return res;
    }
};


template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr bool operator==(const BFloat16 & a, const T & b)
{
    return Float32(a) == b;
}

template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr bool operator==(const T & a, const BFloat16 & b)
{
    return a == Float32(b);
}

template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr bool operator!=(const BFloat16 & a, const T & b)
{
    return Float32(a) != b;
}

template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr bool operator!=(const T & a, const BFloat16 & b)
{
    return a != Float32(b);
}

template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr bool operator<(const BFloat16 & a, const T & b)
{
    return Float32(a) < b;
}

template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr bool operator<(const T & a, const BFloat16 & b)
{
    return a < Float32(b);
}

constexpr inline bool operator<(BFloat16 a, BFloat16 b)
{
    return Float32(a) < Float32(b);
}

template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr bool operator>(const BFloat16 & a, const T & b)
{
    return Float32(a) > b;
}

template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr bool operator>(const T & a, const BFloat16 & b)
{
    return a > Float32(b);
}

constexpr inline bool operator>(BFloat16 a, BFloat16 b)
{
    return Float32(a) > Float32(b);
}


template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr bool operator<=(const BFloat16 & a, const T & b)
{
    return Float32(a) <= b;
}

template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr bool operator<=(const T & a, const BFloat16 & b)
{
    return a <= Float32(b);
}

constexpr inline bool operator<=(BFloat16 a, BFloat16 b)
{
    return Float32(a) <= Float32(b);
}

template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr bool operator>=(const BFloat16 & a, const T & b)
{
    return Float32(a) >= b;
}

template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr bool operator>=(const T & a, const BFloat16 & b)
{
    return a >= Float32(b);
}

constexpr inline bool operator>=(BFloat16 a, BFloat16 b)
{
    return Float32(a) >= Float32(b);
}


template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr inline auto operator+(T a, BFloat16 b)
{
    return a + Float32(b);
}

template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr inline auto operator+(BFloat16 a, T b)
{
    return Float32(a) + b;
}

template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr inline auto operator-(T a, BFloat16 b)
{
    return a - Float32(b);
}

template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr inline auto operator-(BFloat16 a, T b)
{
    return Float32(a) - b;
}

template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr inline auto operator*(T a, BFloat16 b)
{
    return a * Float32(b);
}

template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr inline auto operator*(BFloat16 a, T b)
{
    return Float32(a) * b;
}

template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr inline auto operator/(T a, BFloat16 b)
{
    return a / Float32(b);
}

template <typename T>
requires(!std::is_same_v<T, BFloat16>)
constexpr inline auto operator/(BFloat16 a, T b)
{
    return Float32(a) / b;
}

namespace std
{
template <>
class numeric_limits<BFloat16>
```

### Core Architecture Module: `contrib/clickhouse/base/base/BorrowedObjectPool.h`
```
#pragma once

#include <cstdint>
#include <vector>
#include <chrono>
#include <mutex>
#include <condition_variable>

#include <base/defines.h>
#include <base/MoveOrCopyIfThrow.h>

/** Pool for limited size objects that cannot be used from different threads simultaneously.
  * The main use case is to have fixed size of objects that can be reused in different threads during their lifetime
  * and have to be initialized on demand.
  * Two main properties of pool are allocated objects size and borrowed objects size.
  * Allocated objects size is size of objects that are currently allocated by the pool.
  * Borrowed objects size is size of objects that are borrowed by clients.
  * If max_size == 0 then pool has unlimited size and objects will be allocated without limit.
  *
  * Pool provides following strategy for borrowing object:
  * If max_size == 0 then pool has unlimited size and objects will be allocated without limit.
  * 1. If pool has objects that can be borrowed increase borrowed objects size and return it.
  * 2. If pool allocatedObjectsSize is lower than max objects size or pool has unlimited size
  * allocate new object, increase borrowed objects size and return it.
  * 3. If pool is full wait on condition variable with or without timeout until some object
  * will be returned to the pool.
  */
template <typename T>
class BorrowedObjectPool final
{
public:
    explicit BorrowedObjectPool(size_t max_size_) : max_size(max_size_) {}

    /// Borrow object from pool. If pull is full and all objects were borrowed
    /// then calling thread will wait until some object will be returned into pool.
    template <typename FactoryFunc>
    void borrowObject(T & dest, FactoryFunc && func)
    {
        std::unique_lock<std::mutex> lock(objects_mutex);

        if (!objects.empty())
        {
            dest = borrowFromObjects(lock);
            return;
        }

        bool has_unlimited_size = (max_size == 0);

        if (unlikely(has_unlimited_size) || allocated_objects_size < max_size)
        {
            dest = allocateObjectForBorrowing(lock, std::forward<FactoryFunc>(func));
            return;
        }

        condition_variable.wait(lock, [this] { return !objects.empty(); });
        dest = borrowFromObjects(lock);
    }

    /// Same as borrowObject function, but wait with timeout.
    /// Returns true if object was borrowed during timeout.
    template <typename FactoryFunc>
    bool tryBorrowObject(T & dest, FactoryFunc && func, size_t timeout_in_milliseconds = 0)
    {
        std::unique_lock<std::mutex> lock(objects_mutex);

        if (!objects.empty())
        {
            dest = borrowFromObjects(lock);
            return true;
        }

        bool has_unlimited_size = (max_size == 0);

        if (unlikely(has_unlimited_size) || allocated_objects_size < max_size)
        {
            dest = allocateObjectForBorrowing(lock, std::forward<FactoryFunc>(func));
            return true;
        }

        bool wait_result = condition_variable.wait_for(lock, std::chrono::milliseconds(timeout_in_milliseconds), [this] { return !objects.empty(); });

        if (wait_result)
            dest = borrowFromObjects(lock);

        return wait_result;
    }

    /// Return object into pool. Client must return same object that was borrowed.
    void returnObject(T && object_to_return)
    {
        {
            std::lock_guard lock(objects_mutex);

            objects.emplace_back(std::move(object_to_return));
            --borrowed_objects_size;
        }

        condition_variable.notify_one();
    }

    /// Max pool size
    size_t maxSize() const
    {
        return max_size;
    }

    /// Allocated objects size by the pool. If allocatedObjectsSize == maxSize then pool is full.
    size_t allocatedObjectsSize() const
    {
        std::lock_guard lock(objects_mutex);
        return allocated_objects_size;
    }

    /// Returns allocatedObjectsSize == maxSize
    bool isFull() const
    {
        std::lock_guard lock(objects_mutex);
        return allocated_objects_size == max_size;
    }

    /// Borrowed objects size. If borrowedObjectsSize == allocatedObjectsSize and pool is full.
    /// Then client will wait during borrowObject function call.
    size_t borrowedObjectsSize() const
    {
        std::lock_guard lock(objects_mutex);
        return borrowed_objects_size;
    }

private:

    template <typename FactoryFunc>
    T allocateObjectForBorrowing(const std::unique_lock<std::mutex> &, FactoryFunc && func)
    {
        ++allocated_objects_size;
        ++borrowed_objects_size;

        return std::forward<FactoryFunc>(func)();
    }

    T borrowFromObjects(const std::unique_lock<std::mutex> &)
    {
        T dst;
        detail::moveOrCopyIfThrow(std::move(objects.back()), dst);
        objects.pop_back();

        ++borrowed_objects_size;

        return dst;
    }

    size_t max_size;

    mutable std::mutex objects_mutex;
    std::condition_variable condition_variable;
    size_t allocated_objects_size = 0;
    size_t borrowed_objects_size = 0;
    std::vector<T> objects;
};

```

### Core Architecture Module: `contrib/clickhouse/base/base/DayNum.h`
```
#pragma once

#include <base/types.h>
#include <base/strong_typedef.h>

/** Represents number of days since 1970-01-01.
  * See DateLUTImpl for usage examples.
  */
STRONG_TYPEDEF(UInt16, DayNum)

/** Represent number of days since 1970-01-01 but in extended range,
 * for dates before 1970-01-01 and after 2105
 */
STRONG_TYPEDEF(Int32, ExtendedDayNum)

```

### Core Architecture Module: `contrib/clickhouse/base/base/Decimal.cpp`
```
#include <base/Decimal.h>
#include <base/extended_types.h>

namespace DB
{

/// Explicit template instantiations.

#define FOR_EACH_UNDERLYING_DECIMAL_TYPE(M) \
    M(Int32)  \
    M(Int64)  \
    M(Int128) \
    M(Int256)

#define FOR_EACH_UNDERLYING_DECIMAL_TYPE_PASS(M, X) \
    M(Int32, X) \
    M(Int64, X) \
    M(Int128, X) \
    M(Int256, X)

template <typename T> const Decimal<T> & Decimal<T>::operator += (const T & x) { value += x; return *this; }
template <typename T> const Decimal<T> & Decimal<T>::operator -= (const T & x) { value -= x; return *this; }
template <typename T> const Decimal<T> & Decimal<T>::operator *= (const T & x) { value *= x; return *this; }
template <typename T> const Decimal<T> & Decimal<T>::operator /= (const T & x) { value /= x; return *this; }
template <typename T> const Decimal<T> & Decimal<T>::operator %= (const T & x) { value %= x; return *this; }

template <typename T> void NO_SANITIZE_UNDEFINED Decimal<T>::addOverflow(const T & x) { value += x; }

/// Maybe this explicit instantiation affects performance since operators cannot be inlined.

template <typename T> template <typename U> const Decimal<T> & Decimal<T>::operator += (const Decimal<U> & x) { value += static_cast<T>(x.value); return *this; }
template <typename T> template <typename U> const Decimal<T> & Decimal<T>::operator -= (const Decimal<U> & x) { value -= static_cast<T>(x.value); return *this; }
template <typename T> template <typename U> const Decimal<T> & Decimal<T>::operator *= (const Decimal<U> & x) { value *= static_cast<T>(x.value); return *this; }
template <typename T> template <typename U> const Decimal<T> & Decimal<T>::operator /= (const Decimal<U> & x) { value /= static_cast<T>(x.value); return *this; }
template <typename T> template <typename U> const Decimal<T> & Decimal<T>::operator %= (const Decimal<U> & x) { value %= static_cast<T>(x.value); return *this; }

#define DISPATCH(TYPE_T, TYPE_U) \
    template const Decimal<TYPE_T> & Decimal<TYPE_T>::operator += (const Decimal<TYPE_U> & x); \
    template const Decimal<TYPE_T> & Decimal<TYPE_T>::operator -= (const Decimal<TYPE_U> & x); \
    template const Decimal<TYPE_T> & Decimal<TYPE_T>::operator *= (const Decimal<TYPE_U> & x); \
    template const Decimal<TYPE_T> & Decimal<TYPE_T>::operator /= (const Decimal<TYPE_U> & x); \
    template const Decimal<TYPE_T> & Decimal<TYPE_T>::operator %= (const Decimal<TYPE_U> & x);
#define INVOKE(X) FOR_EACH_UNDERLYING_DECIMAL_TYPE_PASS(DISPATCH, X)
FOR_EACH_UNDERLYING_DECIMAL_TYPE(INVOKE);
#undef INVOKE
#undef DISPATCH

#define DISPATCH(TYPE) template struct Decimal<TYPE>;
FOR_EACH_UNDERLYING_DECIMAL_TYPE(DISPATCH)
#undef DISPATCH

template <typename T> bool operator< (const Decimal<T> & x, const Decimal<T> & y) { return x.value < y.value; }
template <typename T> bool operator> (const Decimal<T> & x, const Decimal<T> & y) { return x.value > y.value; }
template <typename T> bool operator<= (const Decimal<T> & x, const Decimal<T> & y) { return x.value <= y.value; }
template <typename T> bool operator>= (const Decimal<T> & x, const Decimal<T> & y) { return x.value >= y.value; }
template <typename T> bool operator== (const Decimal<T> & x, const Decimal<T> & y) { return x.value == y.value; }
template <typename T> bool operator!= (const Decimal<T> & x, const Decimal<T> & y) { return x.value != y.value; }

#define DISPATCH(TYPE) \
template bool operator< (const Decimal<TYPE> & x, const Decimal<TYPE> & y); \
template bool operator> (const Decimal<TYPE> & x, const Decimal<TYPE> & y); \
template bool operator<= (const Decimal<TYPE> & x, const Decimal<TYPE> & y); \
template bool operator>= (const Decimal<TYPE> & x, const Decimal<TYPE> & y); \
template bool operator== (const Decimal<TYPE> & x, const Decimal<TYPE> & y); \
template bool operator!= (const Decimal<TYPE> & x, const Decimal<TYPE> & y);
FOR_EACH_UNDERLYING_DECIMAL_TYPE(DISPATCH)
#undef DISPATCH


template <typename T> Decimal<T> operator+ (const Decimal<T> & x, const Decimal<T> & y) { return x.value + y.value; }
template <typename T> Decimal<T> operator- (const Decimal<T> & x, const Decimal<T> & y) { return x.value - y.value; }
template <typename T> Decimal<T> operator* (const Decimal<T> & x, const Decimal<T> & y) { return x.value * y.value; }
template <typename T> Decimal<T> operator/ (const Decimal<T> & x, const Decimal<T> & y) { return x.value / y.value; }
template <typename T> Decimal<T> operator- (const Decimal<T> & x) { return -x.value; }

#define DISPATCH(TYPE) \
template Decimal<TYPE> operator+ (const Decimal<TYPE> & x, const Decimal<TYPE> & y); \
template Decimal<TYPE> operator- (const Decimal<TYPE> & x, const Decimal<TYPE> & y); \
template Decimal<TYPE> operator* (const Decimal<TYPE> & x, const Decimal<TYPE> & y); \
template Decimal<TYPE> operator/ (const Decimal<TYPE> & x, const Decimal<TYPE> & y); \
template Decimal<TYPE> operator- (const Decimal<TYPE> & x);
FOR_EACH_UNDERLYING_DECIMAL_TYPE(DISPATCH)
#undef DISPATCH

#undef FOR_EACH_UNDERLYING_DECIMAL_TYPE_PASS
#undef FOR_EACH_UNDERLYING_DECIMAL_TYPE
}

```

### Core Architecture Module: `contrib/clickhouse/base/base/Decimal.h`
```
#pragma once

#include <base/extended_types.h>
#include <base/Decimal_fwd.h>
#include <base/types.h>
#include <base/defines.h>


namespace DB
{
template <class> struct Decimal;
class DateTime64;

#define FOR_EACH_UNDERLYING_DECIMAL_TYPE(M) \
    M(Int32) \
    M(Int64) \
    M(Int128) \
    M(Int256)

#define FOR_EACH_UNDERLYING_DECIMAL_TYPE_PASS(M, X) \
    M(Int32,  X) \
    M(Int64,  X) \
    M(Int128, X) \
    M(Int256, X)

using Decimal32 = Decimal<Int32>;
using Decimal64 = Decimal<Int64>;
using Decimal128 = Decimal<Int128>;
using Decimal256 = Decimal<Int256>;

template <class T> struct NativeTypeT { using Type = T; };
template <is_decimal T> struct NativeTypeT<T> { using Type = typename T::NativeType; };
template <class T> using NativeType = typename NativeTypeT<T>::Type;

/// Own FieldType for Decimal.
/// It is only a "storage" for decimal.
/// To perform operations, you also have to provide a scale (number of digits after point).
template <typename T>
struct Decimal
{
    using NativeType = T;

    constexpr Decimal() = default;
    constexpr Decimal(Decimal<T> &&) noexcept = default;
    constexpr Decimal(const Decimal<T> &) = default;

    constexpr Decimal(const T & value_): value(value_) {} // NOLINT(google-explicit-constructor)

    template <typename U>
    constexpr Decimal(const Decimal<U> & x): value(x.value) {} // NOLINT(google-explicit-constructor)

    constexpr Decimal<T> & operator=(Decimal<T> &&) noexcept = default;
    constexpr Decimal<T> & operator = (const Decimal<T> &) = default;

    constexpr operator T () const { return value; } // NOLINT(google-explicit-constructor)

    template <typename U>
    constexpr U convertTo() const
    {
        if constexpr (is_decimal<U>)
            return convertTo<typename U::NativeType>();
        else
            return static_cast<U>(value);
    }

    const Decimal<T> & operator += (const T & x);
    const Decimal<T> & operator -= (const T & x);
    const Decimal<T> & operator *= (const T & x);
    const Decimal<T> & operator /= (const T & x);
    const Decimal<T> & operator %= (const T & x);

    template <typename U> const Decimal<T> & operator += (const Decimal<U> & x);
    template <typename U> const Decimal<T> & operator -= (const Decimal<U> & x);
    template <typename U> const Decimal<T> & operator *= (const Decimal<U> & x);
    template <typename U> const Decimal<T> & operator /= (const Decimal<U> & x);
    template <typename U> const Decimal<T> & operator %= (const Decimal<U> & x);

    /// This is to avoid UB for sumWithOverflow()
    void NO_SANITIZE_UNDEFINED addOverflow(const T & x);

    T value;
};

#define DISPATCH(TYPE) extern template struct Decimal<TYPE>;
FOR_EACH_UNDERLYING_DECIMAL_TYPE(DISPATCH)
#undef DISPATCH

#define DISPATCH(TYPE_T, TYPE_U) \
    extern template const Decimal<TYPE_T> & Decimal<TYPE_T>::operator += (const Decimal<TYPE_U> & x); \
    extern template const Decimal<TYPE_T> & Decimal<TYPE_T>::operator -= (const Decimal<TYPE_U> & x); \
    extern template const Decimal<TYPE_T> & Decimal<TYPE_T>::operator *= (const Decimal<TYPE_U> & x); \
    extern template const Decimal<TYPE_T> & Decimal<TYPE_T>::operator /= (const Decimal<TYPE_U> & x); \
    extern template const Decimal<TYPE_T> & Decimal<TYPE_T>::operator %= (const Decimal<TYPE_U> & x);
#define INVOKE(X) FOR_EACH_UNDERLYING_DECIMAL_TYPE_PASS(DISPATCH, X)
FOR_EACH_UNDERLYING_DECIMAL_TYPE(INVOKE);
#undef INVOKE
#undef DISPATCH

template <typename T> bool operator< (const Decimal<T> & x, const Decimal<T> & y);
template <typename T> bool operator> (const Decimal<T> & x, const Decimal<T> & y);
template <typename T> bool operator<= (const Decimal<T> & x, const Decimal<T> & y);
template <typename T> bool operator>= (const Decimal<T> & x, const Decimal<T> & y);
template <typename T> bool operator== (const Decimal<T> & x, const Decimal<T> & y);
template <typename T> bool operator!= (const Decimal<T> & x, const Decimal<T> & y);

#define DISPATCH(TYPE) \
extern template bool operator< (const Decimal<TYPE> & x, const Decimal<TYPE> & y); \
extern template bool operator> (const Decimal<TYPE> & x, const Decimal<TYPE> & y); \
extern template bool operator<= (const Decimal<TYPE> & x, const Decimal<TYPE> & y); \
extern template bool operator>= (const Decimal<TYPE> & x, const Decimal<TYPE> & y); \
extern template bool operator== (const Decimal<TYPE> & x, const Decimal<TYPE> & y); \
extern template bool operator!= (const Decimal<TYPE> & x, const Decimal<TYPE> & y);
FOR_EACH_UNDERLYING_DECIMAL_TYPE(DISPATCH)
#undef DISPATCH

template <typename T> Decimal<T> operator+ (const Decimal<T> & x, const Decimal<T> & y);
template <typename T> Decimal<T> operator- (const Decimal<T> & x, const Decimal<T> & y);
template <typename T> Decimal<T> operator* (const Decimal<T> & x, const Decimal<T> & y);
template <typename T> Decimal<T> operator/ (const Decimal<T> & x, const Decimal<T> & y);
template <typename T> Decimal<T> operator- (const Decimal<T> & x);

#define DISPATCH(TYPE) \
extern template Decimal<TYPE> operator+ (const Decimal<TYPE> & x, const Decimal<TYPE> & y); \
extern template Decimal<TYPE> operator- (const Decimal<TYPE> & x, const Decimal<TYPE> & y); \
extern template Decimal<TYPE> operator* (const Decimal<TYPE> & x, const Decimal<TYPE> & y); \
extern template Decimal<TYPE> operator/ (const Decimal<TYPE> & x, const Decimal<TYPE> & y); \
extern template Decimal<TYPE> operator- (const Decimal<TYPE> & x);
FOR_EACH_UNDERLYING_DECIMAL_TYPE(DISPATCH)
#undef DISPATCH

#undef FOR_EACH_UNDERLYING_DECIMAL_TYPE_PASS
#undef FOR_EACH_UNDERLYING_DECIMAL_TYPE

/// Distinguishable type to allow function resolution/deduction based on value type,
/// but also relatively easy to convert to/from Decimal64.
class DateTime64 : public Decimal64
{
public:
    using Base = Decimal64;
    using Base::Base;
    using NativeType = Base::NativeType;

    constexpr DateTime64(const Base & v): Base(v) {} // NOLINT(google-explicit-constructor)
};
}

constexpr UInt64 max_uint_mask = std::numeric_limits<UInt64>::max();

namespace std
{
    template <typename T>
    struct hash<DB::Decimal<T>>
    {
        size_t operator()(const DB::Decimal<T> & x) const { return hash<T>()(x.value); }
    };

    template <>
    struct hash<DB::Decimal128>
    {
        size_t operator()(const DB::Decimal128 & x) const
        {
            return std::hash<Int64>()(x.value >> 64)
                ^ std::hash<Int64>()(x.value & max_uint_mask);
        }
    };

    template <>
    struct hash<DB::DateTime64>
    {
        size_t operator()(const DB::DateTime64 & x) const
        {
            return std::hash<DB::DateTime64::NativeType>()(x);
        }
    };

    template <>
    struct hash<DB::Decimal256>
    {
        size_t operator()(const DB::Decimal256 & x) const
        {
            // FIXME temp solution
            return std::hash<Int64>()(static_cast<Int64>(x.value >> 64 & max_uint_mask))
                ^ std::hash<Int64>()(static_cast<Int64>(x.value & max_uint_mask));
        }
    };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1769** (2026-07-08): **YQL query cache for remote mr-operations doesn't work.**
  *Symptoms*: If you run yql's cross-cluster query and then immediately re-run it without changing the source tables, local mr-operations will be taken from the cache but remote ones will be executed again.
  **Post-Mortem & Fix Analysis**:
  > Hi! Can you provide any query example that reproduces this problem?
  > The query from tutorial but with second table from the remote cluster: ``` -- This example demonstrates working with tables from multiple clusters in a single query. -- All you need to do is specify the cluster name before the dot and the table: cluster.`//path/to/table` -- Below tables from different clusters are joined. SELECT     Max_by(p.price, p.date) as last_price    ,n.name FROM dirac.`//home/tutorial/price` p JOIN (         SELECT             id, name         FROM tundra.`//home/tutorial/nomenclature`     ) n on n.id = p.nomenclature_id GROUP BY n.name ORDER BY n.name; ``` Executed twice without any changes in SQL or tables, and the remote YtMap recalculated without using the cache.  <img width="3233" height="1735" alt="Image" src="https://github.com/user-attachments/assets/6519bb8a-261e-462a-a2d9-2d963e2b270e" />    
  > I was unable to reproduce the problem In provided example - query cache is not used because nomenclature from the tutorial is a dynamic table, so this does not seem to be related to cross-cluster mode

- **Issue #1766** (2026-07-09): **Security issue: YTsaurus client leaks token in exception trace**
  *Symptoms*: # Description  YTsaurus client leaks the authorization token into the exception trace if an error occurs.  # Reproduce  Execute this short script: ```py from yt import wrapper as yt  yt_client = yt.YtClient(     token="REAL_YTSAURUS_TOKEN",     proxy="PROXY", )  print(yt_client.get_user_name("LEAKING_TOKEN")) ```  If the token provided in `get_user_name`'s argument is correct, nothing is leaked. If it's incorrect, a long exception shall appear: ``` ... ***** Details: Your request 81365c69-da1a4427-17bafca0-ae6fe7aa has failed to authenticate at None. Make sure that you have provided an OAuth token with the request. In case you do not have a valid token, please refer to  for obtaining one. If the error persists and system keeps rejecting your token, please kindly submit a request to https://ytsaurus.tech/#contact         origin          dev0.nebius.yt on 2026-06-26T15:54:02.685687Z Received HTTP response with error         origin          dev0.nebius.yt on 2026-06-26T15:54:02.685566Z         url             http://tundra.yt.nebius.yt/auth/whoami         request_headers {                       "Authorization": "OAuth LEAKING_TOKEN", <<<<<<<<<<<<<<<<<<<<<<<<<                       "X-YT-Correlation-Id": "341bba3f-bc16a0a0-27686208-4d5b2505"                     }         response_headers {                       "Date": "Fri, 26 Jun 2026 15:54:02 GMT", ... ```  # Reason  I believe there's a bug in the current version of the client: [this line](https://github.com/ytsaurus/ytsaurus/
  **Post-Mortem & Fix Analysis**:
  > Fix is on the way
  > Fixed in 6f9fde83692386df25e285223ff0d625c1a0e040

- **Issue #1750** (2026-07-09): **YT CLI shell competion does not work paths if YT_PREFIX is set**
  *Symptoms*: https://ytsaurus.tech/docs/en/api/cli/install#autocompletion  ``` export YT_PREFIX=//home/${USER}/ yt list <TAB> yt list //home/{USER}/<TAB> ```
  **Post-Mortem & Fix Analysis**:
  > Fixed in 1ca058a74d91dc21991d6d125f629f6c5609f60f

- **Issue #1692** (2026-05-13): **yt/yt/core/http: throw TransportError at reusing stale connection**
  *Symptoms*: Root Cause: A classic race condition in yt/yt/core/http/connection_pool.cpp. When the client extracts a connection from the pool:  TConnectionPool::Connect() calls CheckPooledConnection() → IsValid() → Connection->IsIdle() IsIdle() checks !PeerDisconnectedList_.IsFired() — but this is asynchronous and depends on the poller detecting the peer's TCP FIN. There's a window where the server has already sent FIN to close the connection, but the poller hasn't processed it yet. The connection appears valid, but when the client writes the request and tries to read the response, it gets immediate EOF.  This triggers: "Connection was closed before the first byte of HTTP message".  Proper fix should be retrying request using different connection when connection was taken from the pool and requires is safe to retry. For example this logic is implemented inside golang http client.  Here we could simply throw error code NRpc::EErrorCode::TransportError. And as a result request will be retried by high-level retrying logic in yt/cpp/mapreduce/common/retry_lib.cpp  Link: https://github.com/ytsaurus/ytsaurus/issues/1691 Signed-off-by: Konstantin Khlebnikov <khlebnikov@nebius.com>  ---  * Changelog entry Type: fix Component: cpp-sdk  Handle error and retry request if HTTP(s) connection picked from pool is stale. 
  **Post-Mortem & Fix Analysis**:
  > `16.04.2026, 15:20:43` PR autocheck started. Watch workflow progress [here](https://github.com/ytsaurus/ytsaurus/actions/runs/24518551049). `16.04.2026, 15:22:30` PR autocheck finished. Statuses: Strawberry controller: skipped CMake build: skipped Ya-make build: skipped Tests: skipped 
  > `16.04.2026, 15:24:20` PR autocheck started. Watch workflow progress [here](https://github.com/ytsaurus/ytsaurus/actions/runs/24518621598). `16.04.2026, 15:33:55` PR autocheck finished. Statuses: Strawberry controller: failure CMake build: skipped Ya-make build: failure Tests: skipped 
  > @dim-an any news?

- **Issue #1625** (2026-03-04): **Go SDK RevokeToken must provide revoke by token hash**
  *Symptoms*: https://github.com/ytsaurus/ytsaurus/blob/9b3ffc81f9df2c8ab8f689393a0310c527e62697/yt/go/yt/internal/encoder.go#L305  Otherwise it is impossible to revoke tokens from ListUserTokens result  This method needs second argument for token hash, i.e. allow caller specify token itself or hash.
  **Post-Mortem & Fix Analysis**:
  > Hello, there are the TokenIsHash and PasswordIsHash options in [RevokeTokenOptions](https://github.com/ytsaurus/ytsaurus/blob/main/yt/go/yt/interface.go#L877).

- **Issue #1622** (2026-04-09): **Python CLI/SDK: debug logs spamming with tracebacks.**
  *Symptoms*: Running a simple `list /` produces "bad" logs ``` YT_LOG_LEVEL=debug yt list / --- Logging error --- Traceback (most recent call last):   File "/opt/homebrew/lib/python3.14/site-packages/yt/logger.py", line 68, in emit     msg = self._colorize(msg)   File "/opt/homebrew/lib/python3.14/site-packages/yt/logger.py", line 57, in _colorize     msg = self.RE_KW(msg) TypeError: SimpleColorizedStreamHandler.<lambda>() takes 3 positional arguments but 4 were given Call stack:   File "/opt/homebrew/bin/yt", line 7, in <module>     sys.exit(main())   File "/opt/homebrew/lib/python3.14/site-packages/yt/cli/yt_binary.py", line 3315, in main     run_main(main_func)   File "/opt/homebrew/lib/python3.14/site-packages/yt/wrapper/cli_helpers.py", line 70, in run_main     main_func()   File "/opt/homebrew/lib/python3.14/site-packages/yt/cli/yt_binary.py", line 3304, in main_func     args.func(**func_args)   File "/opt/homebrew/lib/python3.14/site-packages/yt/cli/yt_binary.py", line 363, in list     list = yt.list(**list_args)   File "/opt/homebrew/lib/python3.14/site-packages/yt/wrapper/cypress_commands.py", line 462, in list     result = make_formatted_request(   File "/opt/homebrew/lib/python3.14/site-packages/yt/wrapper/driver.py", line 190, in make_formatted_request     result = make_request(command_name, params,   File "/opt/homebrew/lib/python3.14/site-packages/yt/wrapper/driver.py", line 125, in make_request     result = http_driver.make_request(   File "<decorator-gen-3>", line 2, in ma
  **Post-Mortem & Fix Analysis**:
  > This bug occurs in python 3.14+ (functools.partial becomes a method descriptor) As workaround you can use `YT_LOG_LEVEL=Debug` (case sensitive) or downgrade python. (Fx is on the way) 
  > Fixed - 93d89672ca44353644e68bed805cc9c9613d3eae

- **Issue #1572** (2026-02-16): **yt/server/http_proxy: hide content at creating document**
  *Symptoms*: Initial document content is passed as attribute "value", which should not be logged.  It seems RPC proxy is not affected.  Signed-off-by: Konstantin Khlebnikov <khlebnikov@tracto.ai>  ---  * Changelog entry Type: bug Component: http-proxy  Do not log initial document content. 
  **Post-Mortem & Fix Analysis**:
  > `21.01.2026, 09:58:32` PR autocheck started. Watch workflow progress [here](https://github.com/ytsaurus/ytsaurus/actions/runs/21205125020). `21.01.2026, 10:03:24` PR autocheck finished. Statuses: Strawberry controller: cancelled CMake build: skipped Ya-make build: cancelled Tests: skipped 
  > `21.01.2026, 10:05:04` PR autocheck started. Watch workflow progress [here](https://github.com/ytsaurus/ytsaurus/actions/runs/21205281778). `21.01.2026, 14:51:14` Integration tests are started. `21.01.2026, 15:41:18` Tests finished. #### Total | Total | Failed | Ok | Skipped | Not launched | |-------|--------|----|---------|--------------| | 2783 | 18 | 2539 | 226 | 0 | #### [ci-viewer/21205281778/size_s](https://storage.yandexcloud.net/files.ytsaurus.tech/ci-viewer/21205281778/size_s/index.html) (returncode 10) | Total | Failed | Ok | Skipped | Not launched | |-------|--------|----|---------|--------------| | 2783 | 18 | 2539 | 226 | 0 | ### [Failed suites](http://ci-viewer.dev.ytsaurus.tech/build/21205281778)  `21.01.2026, 15:41:28` PR autocheck finished. Statuses: Strawberry controller: success CMake build: success Ya-make build: success Tests: success 
  > `08.02.2026, 17:19:26` PR autocheck started. Watch workflow progress [here](https://github.com/ytsaurus/ytsaurus/actions/runs/21802162938). `08.02.2026, 21:11:28` Integration tests are started. `08.02.2026, 22:25:47` Tests finished. #### Total | Total | Failed | Ok | Skipped | Not launched | |-------|--------|----|---------|--------------| | 2869 | 9 | 2604 | 256 | 0 | #### [ci-viewer/21802162938/size_s](https://storage.yandexcloud.net/files.ytsaurus.tech/ci-viewer/21802162938/size_s/index.html) (returncode 10) | Total | Failed | Ok | Skipped | Not launched | |-------|--------|----|---------|--------------| | 2869 | 9 | 2604 | 256 | 0 | ### [Failed suites](http://ci-viewer.dev.ytsaurus.tech/build/21802162938)  `08.02.2026, 22:25:57` PR autocheck finished. Statuses: Strawberry controller: success CMake build: success Ya-make build: success Tests: success 

- **Issue #1542** (2025-12-16): **yt/chyt/controller: handle https schema yt http proxy url**
  *Symptoms*: Use for logging normalized address generated by go sdk yt config.  Signed-off-by: Konstantin Khlebnikov <khlebnikov@tracto.ai>  ---  * Changelog entry Type: fix Component: strawberry  Fix logging for https cluster proxy urls. 
  **Post-Mortem & Fix Analysis**:
  > `15.12.2025, 16:32:32` PR autocheck started. Watch workflow progress [here](https://github.com/ytsaurus/ytsaurus/actions/runs/20239755633). `15.12.2025, 16:33:14` PR autocheck finished. Statuses: Strawberry controller: skipped CMake build: skipped Ya-make build: skipped Tests: skipped 
  > `15.12.2025, 16:33:47` PR autocheck started. Watch workflow progress [here](https://github.com/ytsaurus/ytsaurus/actions/runs/20239781834). `15.12.2025, 19:38:52` Integration tests are started. `15.12.2025, 20:30:58` Tests finished. #### Total | Total | Failed | Ok | Skipped | Not launched | |-------|--------|----|---------|--------------| | 2763 | 3 | 2539 | 221 | 0 | #### [ci-viewer/20239781834/size_s](https://storage.yandexcloud.net/files.ytsaurus.tech/ci-viewer/20239781834/size_s/index.html) (returncode 10) | Total | Failed | Ok | Skipped | Not launched | |-------|--------|----|---------|--------------| | 2763 | 3 | 2539 | 221 | 0 | ### [Failed suites](http://ci-viewer.dev.ytsaurus.tech/build/20239781834)  `15.12.2025, 20:34:11` PR autocheck finished. Statuses: Strawberry controller: success CMake build: success Ya-make build: success Tests: success 
  > @buyval01 has imported your pull request. If you are a member of YTsaurus team, you can view [this diff](https://ytsaurus.tech/internal/QHBuqgUq7PyVom).

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

### Incident Patch 1: `42a13a0b` (2026-09-30)
**Commit Message**: YT-29896: Fix typo in tablet balancer check_invariants option
commit_hash:76ad09d8e55f982dc36f8b2023377620eb8214d9

**File**: `yt/yt/server/tablet_balancer/config.cpp` (modified, +1/-1)
```diff
@@ -231,7 +231,7 @@ void TBundleStateProviderConfig::Register(TRegistrar registrar)
     registrar.Parameter("performance_counters_fetch_period", &TThis::PerformanceCountersFetchPeriod)
         .Default();
 
-    registrar.Parameter("chunk_invariants", &TThis::CheckInvariants)
+    registrar.Parameter("check_invariants", &TThis::CheckInvariants)
         .Default(true);
 }
 
```

---

### Incident Patch 2: `ad09cf7b` (2026-09-30)
**Commit Message**: YQL-21700 fix pure provider world cleanup

#### Fix pure provider world cleanup for nested `WithWorld` ✎

The purity check for isolated lambdas now recursively validates the body when a `WithWorld` call is encountered, instead of short-circuiting with an unconditional positive result. Additionally, the world cleanup pass now revisits nodes that are modified during optimization, ensuring nested world references are properly resolved.

<a href="https://nda.ya.ru/t/qa0kX64r7DqvtN"><font size="2">Autodescription by Yandex Code Assistant</font></a>
commit_hash:08de9a66ce58641b21e1dc37bcd8cd9be505bd01

**File**: `yql/essentials/core/yql_expr_type_annotation.cpp` (modified, +1/-1)
```diff
@@ -5872,7 +5872,7 @@ bool IsPureIsolatedLambdaImpl(const TExprNode& lambdaBody, TNodeSet& visited, TS
 
         if (lambdaBody.IsCallable("WithWorld")) {
             syncList->emplace(lambdaBody.ChildPtr(1), syncList->size());
-            return true;
+            return IsPureIsolatedLambdaImpl(lambdaBody.Head(), visited, syncList);
         }
     }
 
```

**File**: `yql/essentials/providers/common/provider/yql_data_provider_impl.cpp` (modified, +3/-1)
```diff
@@ -399,6 +399,8 @@ bool TDataProviderBase::IsFullCaptureReady() {
 
 TExprNode::TPtr DefaultCleanupWorld(const TExprNode::TPtr& node, TExprContext& ctx) {
     auto root = node;
+    TOptimizeExprSettings settings(nullptr);
+    settings.VisitChanges = true;
     auto status = OptimizeExpr(root, root, [&](const TExprNode::TPtr& node, TExprContext& ctx) -> TExprNode::TPtr {
         Y_UNUSED(ctx);
         if (auto right = TMaybeNode<TCoRight>(node)) {
@@ -424,7 +426,7 @@ TExprNode::TPtr DefaultCleanupWorld(const TExprNode::TPtr& node, TExprContext& c
         }
 
         return node;
-    }, ctx, TOptimizeExprSettings(nullptr));
+    }, ctx, settings);
     YQL_ENSURE(status.Level != IGraphTransformer::TStatus::Error);
     return root;
 }
```

---

### Incident Patch 3: `b346be85` (2026-09-30)
**Commit Message**: SPYT-1179 Passing security_tags from input to output tables

* Changelog entry
Type: feature
Component: spyt

Passing security_tags from input to output tables
commit_hash:0d5a6f71bf791ce81d6ffebd4c7bf4a40cecebed

**File**: `yt/docs/en/_includes/user-guide/data-processing/spyt/thesaurus/write-options.md` (modified, +17/-1)
```diff
@@ -35,11 +35,27 @@ Python example:
 df.write.option("write_type_v3", "true")
 ```
 
+## security_tags
+
+For batch writes to static tables, SPYT automatically propagates the union of `security_tags` from the query's static input tables in {{product-name}}. This applies to DataFrame and Spark SQL writes, including cached DataFrames, temporary views, joins, and aggregations. The standard SPYT Spark extensions must be enabled.
+
+In `overwrite` mode, the output receives the inferred tags. In `append` mode, these tags are added to the existing output tags. Both ordinary and distributed writes support this behavior.
+
+To override the inferred tags, pass a string containing a YSON list:
+
+```python
+df.write.option("security_tags", '["sensitive";"userdata";]').yt("//tmp/output")
+```
+
+The `attr_security_tags` option is an alias. If both options are specified, `security_tags` takes precedence. An explicit empty list, `"[]"`, disables inheritance for that write. On append, an override does not remove existing output tags.
+
+Tags are retained with input metadata, including when a DataFrame is cached. SPYT cannot infer tags for data read inside a UDF, data reconstructed after `collect()`, or data whose table provenance was lost through RDD transformations. Supply tags explicitly for these cases. Automatic inheritance is not supported for dynamic tables or streaming queries.
+
 ## Dynamic tables
 
 For dynamic tables you should explicitly specify an additional option `inconsistent_dynamic_write` with `true` value so that you do agree that there is no support for transactional writes to dynamic tables.
 
 Python example:
 ```python
 df.write.option("inconsistent_dynamic_write", "true")
-```
\ No newline at end of file
+```
```

**File**: `yt/docs/ru/_includes/user-guide/data-processing/spyt/thesaurus/write-options.md` (modified, +16/-0)
```diff
@@ -35,6 +35,22 @@ Python example:
 df.write.option("write_type_v3", "true")
 ```
 
+## security_tags
+
+При пакетной записи в статические таблицы SPYT автоматически переносит объединение `security_tags` из статических входных таблиц запроса в {{product-name}}. Это работает для записи через DataFrame API и Spark SQL, в том числе с кэшированными DataFrame, временными представлениями, соединениями и агрегациями. Стандартные расширения Spark для SPYT должны быть включены.
+
+В режиме `overwrite` выходная таблица получает вычисленные теги. В режиме `append` эти теги добавляются к существующим тегам выходной таблицы. Такое поведение поддерживается при обычной и распределённой записи.
+
+Чтобы переопределить вычисленные теги, передайте строку с YSON-списком:
+
+```python
+df.write.option("security_tags", '["sensitive";"userdata";]').yt("//tmp/output")
+```
+
+Опция `attr_security_tags` — алиас. Если указаны обе опции, приоритет имеет `security_tags`. Явный пустой список `"[]"` отключает наследование для этой записи. В режиме `append` переопределение не удаляет существующие теги выходной таблицы.
+
+Теги сохраняются вместе с метаданными входов, в том числе при кэшировании DataFrame. SPYT не может вычислить теги для данных, прочитанных внутри UDF, восстановленных после `collect()` или потерявших связь с исходными таблицами при преобразованиях через RDD. Для этих случаев задавайте теги явно. Автоматическое наследование не поддерживается для динамических таблиц и потоковых запросов.
+
 ## Динамические таблицы
 
 Для динамических таблиц необходимо явно указать дополнительную опцию `inconsistent_dynamic_write` со значением `true`, чтобы подтвердить, что вы согласны с отсутствием поддержки транзакционной записи в динамические таблицы.
```

---

### Incident Patch 4: `2d5cbc1b` (2026-09-30)
**Commit Message**: TConcurrentHashMap: fix EmplaceIfAbsent for different key type
commit_hash:c40a4f6a7e3be462d3686a7deab901436154bd5c

**File**: `library/cpp/containers/concurrent_hash/concurrent_hash.h` (modified, +4/-2)
```diff
@@ -79,12 +79,14 @@ class TConcurrentHashMap {
             return (it != Map.end());
         }
 
-        const V* TryGetUnsafe(const K& key) const {
+        template <typename TKey>
+        const V* TryGetUnsafe(const TKey& key) const {
             typename TActualMap::const_iterator it = Map.find(key);
             return it == Map.end() ? nullptr : &it->second;
         }
 
-        V* TryGetUnsafe(const K& key) {
+        template <typename TKey>
+        V* TryGetUnsafe(const TKey& key) {
             typename TActualMap::iterator it = Map.find(key);
             return it == Map.end() ? nullptr : &it->second;
         }
```

**File**: `library/cpp/containers/concurrent_hash/concurrent_hash_ut.cpp` (modified, +2/-2)
```diff
@@ -105,11 +105,11 @@ TEST(TConcurrentHashTest, TEmplaceIfAbsentTest) {
 
     EXPECT_FALSE(h.Has("key"));
 
-    EXPECT_EQ(h.EmplaceIfAbsent("key", 123).Value, 123);
+    EXPECT_EQ(h.EmplaceIfAbsent(TStringBuf("key"), 123).Value, 123);
     EXPECT_TRUE(h.Has("key"));
 
     // If the key already exists, the value must not be constructed
-    EXPECT_EQ(h.EmplaceIfAbsent("key", TBadConstructor{}).Value, 123);
+    EXPECT_EQ(h.EmplaceIfAbsent(TStringBuf("key"), TBadConstructor{}).Value, 123);
 }
 
 TEST(TConcurrentHashTest, TRemoveTest) {
```

---

### Incident Patch 5: `3875c3c3` (2026-09-29)
**Commit Message**: Fix and improve doxygen comments
commit_hash:0eba9e2538a9138b472bfb4cf628ce75d23f6ccb

**File**: `library/cpp/containers/cow_string/subst.h` (modified, +16/-12)
```diff
@@ -4,28 +4,32 @@
 
 #include <util/string/subst.h>
 
-/* Replace all occurences of substring `what` with string `with` starting from position `from`.
+/** Replace all occurences of substring \p what with string \p with starting from position \p from.
  *
- * @param text      String to modify.
- * @param what      Substring to replace.
- * @param with      Substring to use as replacement.
- * @param from      Position at with to start replacement.
+ * @param[inout] text   String to modify.
+ * @param[in] what      Substring to replace.
+ * @param[in] with      Substring to use as replacement.
+ * @param[in] from      Position at with to start replacement.
  *
- * @return          Number of replacements occured.
+ * @return              Number of replacements occured.
  */
+/**@{*/
 size_t SubstGlobal(TCowString& text, TStringBuf what, TStringBuf with, size_t from = 0);
 size_t SubstGlobal(TUtf16CowString& text, TWtringBuf what, TWtringBuf with, size_t from = 0);
 size_t SubstGlobal(TUtf32CowString& text, TUtf32StringBuf what, TUtf32StringBuf with, size_t from = 0);
+/**@}*/
 
-/* Replace all occurences of character `what` with character `with` starting from position `from`.
+/** Replace all occurences of substring \p what with string \p with starting from position \p from.
  *
- * @param text      String to modify.
- * @param what      Character to replace.
- * @param with      Character to use as replacement.
- * @param from      Position at with to start replacement.
+ * @param[inout] text   String to modify.
+ * @param[in] what      Character to replace.
+ * @param[in] with      Character to use as replacement.
+ * @param[in] from      Position at with to start replacement.
  *
- * @return          Number of replacements occured.
+ * @return              Number of replacements occured.
  */
+/**@{*/
 size_t SubstGlobal(TCowString& text, char what, char with, size_t from = 0);
 size_t SubstGlobal(TUtf16CowString& text, wchar16 what, wchar16 with, size_t from = 0);
 size_t SubstGlobal(TUtf32CowString& text, wchar32 what, wchar32 with, size_t from = 0);
+/**@}*/
```

**File**: `library/cpp/getopt/small/last_getopt_opt.h` (modified, +1/-1)
```diff
@@ -549,7 +549,7 @@ namespace NLastGetopt {
          *
          * Note: this only works in zsh.
          *
-         * @param arg index of free arg
+         * @param index index of free arg
          */
         TOpt& IfPresentDisableCompletionForFreeArg(size_t index) {
             DisableCompletionForFreeArg_.push_back(index);
```

**File**: `library/cpp/getopt/small/last_getopt_opts.h` (modified, +10/-1)
```diff
@@ -221,6 +221,15 @@ namespace NLastGetopt {
             return GetLongOption(name);
         }
 
+        /// @}
+
+        /**
+         * Search for the option with given short name
+         * @param c        short name for search
+         * @return         ref on result (throw exception if not found)
+         */
+        /// @{
+
         const TOpt& GetOption(char c) const {
             return GetCharOption(c);
         }
@@ -434,7 +443,7 @@ namespace NLastGetopt {
         /**
          * Replace help string with given
          *
-         * @param decr        new help string
+         * @param descr     new help string
          */
         void SetCmdLineDescr(const TString& descr) {
             CustomCmdLineDescr = descr;
```

**File**: `library/cpp/html/entity/htmlentity.h` (modified, +7/-3)
```diff
@@ -54,14 +54,16 @@ size_t HtEntDecodeToChar(ECharset cp, const char* str, size_t len, wchar16* buff
  * @param dst      output buffer
  * @param dstlen   output buffer length
  * @param cpsrc    input buffer encoding, ascii-compatible
- * @param cpdst    output buffer encoding, if different from cpsrc
- * @return         src if no entities and encodings are the same (dst remains untouched)
- *                 NULL if dst was not sufficiently long
+ * @param cpdst    output buffer encoding, if different from @p cpsrc
+ * @return         @p src if no entities and encodings are the same (@p dst remains untouched)
+ *                 NULL if @p dst was not sufficiently long
  *                 dst-based output buffer with decoded string
  * @note           entities must be pure, with the terminating ";"
  */
+/**@{*/
 TStringBuf HtTryEntDecodeAsciiCompat(const TStringBuf& src, char* dst, size_t dstlen, ECharset cpsrc = CODES_UTF8);
 TStringBuf HtTryEntDecodeAsciiCompat(const TStringBuf& src, char* dst, size_t dstlen, ECharset cpsrc, ECharset cpdst);
+/**@}*/
 
 //! decodes HTML entities and converts non-ASCII characters to unicode, then converts unicode to UTF8 and percent-encodes
 //! @param text     zero-terminated text of link
@@ -72,8 +74,10 @@ TStringBuf HtTryEntDecodeAsciiCompat(const TStringBuf& src, char* dst, size_t ds
 //!       converted into unicode using code page object if it is passed to the function,
 //!       then unicode characters converted to UTF8 and percent-encoded,
 //!       percent-encoded text in the link copied into output buffer as is
+/**@{*/
 bool HtLinkDecode(const char* text, char* buffer, size_t buflen, size_t& written, ECharset cp = CODES_UNKNOWN);
 bool HtLinkDecode(const TStringBuf& text, char* buffer, size_t buflen, size_t& written, ECharset cp = CODES_UNKNOWN);
+/**@}*/
 
 static inline bool HtLinkDecode(const char* text, char* buffer, size_t buflen, ECharset cp = CODES_UNKNOWN) {
     size_t written;
```

**File**: `library/cpp/logger/log.h` (modified, +47/-44)
```diff
@@ -15,29 +15,29 @@
 
 using TLogFormatter = std::function<TString(ELogPriority priority, TStringBuf)>;
 
-// Logging facilities interface.
-//
-// ```cpp
-// TLog base;
-// ...
-// auto log = base;
-// log.SetFormatter([reqId](ELogPriority p, TStringBuf msg) {
-//     return TStringBuilder() << "reqid=" << reqId << "; " << msg;
-// });
-//
-// log.Write(TLOG_INFO, "begin");
-// HandleRequest(...);
-// log.Write(TLOG_INFO, "end");
-// ```
-//
-// Users are encouraged to copy `TLog` instance.
+/// Logging facilities interface.
+///
+/// @code
+/// TLog base;
+/// ...
+/// auto log = base;
+/// log.SetFormatter([reqId](ELogPriority p, TStringBuf msg) {
+///     return TStringBuilder() << "reqid=" << reqId << "; " << msg;
+/// });
+///
+/// log.Write(TLOG_INFO, "begin");
+/// HandleRequest(...);
+/// log.Write(TLOG_INFO, "end");
+/// @endcode
+///
+/// Users are encouraged to copy TLog instance.
 class TLog {
 public:
-    // Construct empty logger all writes will be spilled.
+    /// Construct empty logger all writes will be spilled.
     TLog();
-    // Construct file logger.
+    /// Construct file logger.
     TLog(const TString& fname, ELogPriority priority = LOG_MAX_PRIORITY);
-    // Construct any type of logger
+    /// Construct any type of logger
     TLog(THolder<TLogBackend> backend);
     TLog(std::unique_ptr<TLogBackend> backend);
 
@@ -47,53 +47,56 @@ class TLog {
     TLog& operator=(const TLog&);
     TLog& operator=(TLog&&);
 
-    // Change underlying backend.
-    // NOTE: not thread safe.
+    /// Change underlying backend.
+    /// @note: not thread safe.
+    /// @{
     void ResetBackend(THolder<TLogBackend> backend) noexcept;
     void ResetBackend(std::unique_ptr<TLogBackend> backend) noexcept;
-    // Reset underlying backend, `IsNullLog()` will return `true` after this call.
-    // NOTE: not thread safe.
+    /// @}
+
+    /// Reset underlying backend, IsNullLog() will return `true` after this call.
+    /// @note: not thread safe.
     THolder<TLogBackend> ReleaseBackend() noexcept;
-    // Check if underlying backend is defined and is not null.
-    // NOTE: not thread safe with respect to `ResetBackend` and `ReleaseBackend`.
     bool IsNullLog() const noexcept;
+    /// Check if underlying backend is defined and is not null.
+    /// @note: not thread safe with respect to ResetBackend() and ReleaseBackend().
     bool IsNotNullLog() const noexcept {
         return !IsNullLog();
     }
 
-    // Write message to the log.
-    //
-    // @param[in] priority          Message priority to use.
-    // @param[in] message           Message to write.
-    // @param[in] metaFlags         Message meta flags.
+    /// Write message to the log.
+    ///
+    /// @param[in] priority          Message priority to use.
+    /// @param[in] message           Message to write.
+    /// @param[in] metaFlags         Message meta flags.
     void Write(ELogPriority priority, TStringBuf message, TLogRecord::TMetaFlags metaFlags = {}) const;
-    // Write message to the log using `DefaultPriority()`.
+    /// Write message to the log using DefaultPriority().
     void Write(const char* data, size_t len, TLogRecord::TMetaFlags metaFlags = {}) const;
-    // Write message to the log, but pass the message in a c-style.
+    /// Write message to the log, but pass the message in a c-style.
     void Write(ELogPriority priority, const char* data, size_t len, TLogRecord::TMetaFlags metaFlags = {}) const;
 
-    // Write message to the log in a c-like printf style.
+    /// Write message to the log in a c-like printf style.
     void Y_PRINTF_FORMAT(3, 4) AddLog(ELogPriority priority, const char* format, ...) const;
-    // Write message to the log in a c-like printf style with `DefaultPriority()` priority.
+    /// Write message to the log in a c-like printf style with DefaultPriority() priority.
     void Y_PRINTF_FORMAT(2, 3) AddLog(const char* format, ...) const;
 
-    // Call `ReopenLog()` of the underlying backend.
+    
```

---

### Incident Patch 6: `e636c895` (2026-09-29)
**Commit Message**: Fix yt-gdb-tcmalloc integration broken by rXXXXXX
commit_hash:5bb2159d4d559c1035ea858ae81ce74909eebe2f

**File**: `yt/yt/scripts/gdb_plugin/lib/tcmalloc.py` (modified, +18/-3)
```diff
@@ -12,6 +12,10 @@
 #
 # Geometry (page shift, radix fan-out) is read from the page-map type itself, so
 # this adapts to the build's tcmalloc configuration rather than hard-coding it.
+#
+# Leaf layout: older tcmalloc keeps a plain `Span* span[]`; since 2025-02 it is
+# `PackedSpanAndSizeclass span_and_sizeclass[]` -- a uintptr_t `packed_value_`
+# holding the Span* in the low 48 bits and a copy of the size class above them.
 
 import gdb
 
@@ -23,6 +27,9 @@
 
 _cfg = None  # None = not probed, False = unavailable, dict = ready
 
+# PackedSpanAndSizeclass::kSizeclassShift.
+_PACKED_SPAN_MASK = (1 << 48) - 1
+
 
 def _ilog2(n):
     return n.bit_length() - 1
@@ -44,11 +51,14 @@ def _config():
         root_len = int(root.type.range()[1]) + 1          # kRootLength
         leaf_type = root.type.target().target()           # Leaf* -> Leaf
         leaf_len = None
+        span_field = None
         for f in leaf_type.fields():
-            if f.name == "span":
+            if f.name in ("span", "span_and_sizeclass"):
+                span_field = f.name
                 leaf_len = int(f.type.range()[1]) + 1      # kLeafLength
         if not leaf_len:
-            raise gdb.error("no span[] in Leaf")
+            raise gdb.error("no span[] / span_and_sizeclass[] in Leaf")
+        span_type = gdb_type("tcmalloc::tcmalloc_internal::Span").pointer()
         try:
             addr_bits = int(gdb.parse_and_eval("tcmalloc::tcmalloc_internal::kAddressBits"))
         except gdb.error:
@@ -62,6 +72,8 @@ def _config():
     _cfg = {
         "root": root,
         "sizemap": sizemap,
+        "span_field": span_field,
+        "span_type": span_type,
         "root_len": root_len,
         "leaf_bits": leaf_bits,
         "leaf_mask": leaf_len - 1,
@@ -89,7 +101,10 @@ def _span_of(addr):
             return None, None
         i2 = page & cfg["leaf_mask"]
         leaf = leaf.dereference()
-        span = leaf["span"][i2]
+        span = leaf[cfg["span_field"]][i2]
+        if cfg["span_field"] == "span_and_sizeclass":
+            ptr = int(span["packed_value_"]) & _PACKED_SPAN_MASK
+            span = gdb.Value(ptr).cast(cfg["span_type"])
         if int(span) == 0:
             return None, None
         return span.dereference(), int(leaf["sizeclass"][i2])
```

---

### Incident Patch 7: `ac23397a` (2026-09-29)
**Commit Message**: YT-29891: Fix race in Operations::LockFileStorage test

`Operations::LockFileStorage` (added in https://nda.ya.ru/t/7akDbcDV7t56Zo expects the shared lock on `<file_storage>/new_cache` to be held while the operation is throttled by a pool with `max_running_operation_count=1`.

The lock lives in the preparer's file transaction, which `TWaitOperationStartPollerItem` (`yt/cpp/mapreduce/client/operation_preparer.cpp`) aborts as soon as it observes any state other than `starting`/`pending`/`orphaned`/`waiting_for_agent`/`initializing`. A throttled operation goes through `initializing` -> `preparing` -> `pending` (`yt/yt/server/scheduler/scheduler.cpp`, `SetStateAndEnqueueEvent(Preparing)` then `(Pending)`). If the poller catches the transient `preparing`, it aborts the transaction and the assertion `hasSharedLock(workingDir + "/file_storage/new_cache")` fails. That is what happened in the failed run: the poller saw `"state"="preparing"`, then `abort_tx` on the file transaction, then `@locks` returned `[]`.

The SDK is correct: user files are locked in `LockInputs()` during initialize, so the file transaction is not needed past `initializing`. The fix is in the test: drop the pool and th

**File**: `yt/cpp/mapreduce/tests/native/operations/operations.cpp` (modified, +6/-21)
```diff
@@ -2683,35 +2683,20 @@ TEST(Operations, LockFileStorage)
         os << CreateGuidAsString();
     }
 
-    const auto poolName = TString("lock_file_storage");
-    auto poolGuard = CreateSchedulerPool(client, poolName, TNode()("max_running_operation_count", 1));
-
-    auto sleepingOp = client->Map(
-        TMapOperationSpec()
-            .Pool(poolName)
-            .AddInput<TNode>(workingDir + "/input")
-            .AddOutput<TNode>(workingDir + "/output"),
-        new TSleepingMapper(TDuration::Minutes(10)),
-        TOperationOptions()
-            .Wait(false));
+    // Operations keep their file transaction (and thus the lock) alive until they leave
+    // the initializing state; hold them there so the lock can be observed.
+    auto delayInitializeSpec = TNode()("testing", TNode()("delay_inside_initialize", 60'000));
 
-    auto abortSleepingOpGuard = Finally([&] {
-        if (sleepingOp->GetBriefState() == EOperationBriefState::InProgress) {
-            sleepingOp->AbortOperation();
-        }
-    });
-
-    // Pending operations keep their file transaction (and thus the lock) alive.
     auto customStorageOp = client->Map(
         TMapOperationSpec()
-            .Pool(poolName)
             .AddInput<TNode>(workingDir + "/input")
             .AddOutput<TNode>(workingDir + "/output_1")
             .MapperSpec(TUserJobSpec()
                 .AddLocalFile(tempFile.Name())),
         new TIdMapper,
         TOperationOptions()
             .Wait(false)
+            .Spec(delayInitializeSpec)
             .FileStorage(workingDir + "/file_storage"));
 
     auto abortCustomStorageOpGuard = Finally([&] {
@@ -2722,14 +2707,14 @@ TEST(Operations, LockFileStorage)
 
     auto defaultStorageOp = client->Map(
         TMapOperationSpec()
-            .Pool(poolName)
             .AddInput<TNode>(workingDir + "/input")
             .AddOutput<TNode>(workingDir + "/output_2")
             .MapperSpec(TUserJobSpec()
                 .AddLocalFile(tempFile.Name())),
         new TIdMapper,
         TOperationOptions()
-            .Wait(false));
+            .Wait(false)
+            .Spec(delayInitializeSpec));
 
     auto abortDefaultStorageOpGuard = Finally([&] {
         if (defaultStorageOp->GetBriefState() == EOperationBriefState::InProgress) {
```

---

### Incident Patch 8: `22b853db` (2026-09-29)
**Commit Message**: Fix lost wakeup in MountWaitTest
commit_hash:6a66774e6742bb5d2e46d2528b24d3c1f30e73ca

**File**: `yt/java/ytsaurus-client/src/test-integration/java/tech/ytsaurus/client/MountWaitTest.java` (modified, +25/-33)
```diff
@@ -1,12 +1,16 @@
 package tech.ytsaurus.client;
 
+import java.util.ArrayList;
 import java.util.HashMap;
+import java.util.List;
 import java.util.UUID;
+import java.util.concurrent.Callable;
 import java.util.concurrent.CompletableFuture;
+import java.util.concurrent.CountDownLatch;
+import java.util.concurrent.ExecutionException;
 import java.util.concurrent.ExecutorService;
 import java.util.concurrent.Executors;
 import java.util.concurrent.TimeUnit;
-import java.util.concurrent.atomic.AtomicInteger;
 
 import org.junit.Assert;
 import org.junit.Before;
@@ -70,42 +74,30 @@ public void createMountAndWait() {
     }
 
     @Test
-    public void waitProxiesMultithreaded() throws InterruptedException {
+    public void waitProxiesMultithreaded() throws InterruptedException, ExecutionException {
         final int threads = 20;
-        final Object startLock = new Object();
+        CountDownLatch startedWaits = new CountDownLatch(threads);
+        List<Callable<Void>> tasks = new ArrayList<>(threads);
 
-        AtomicInteger startedWaits = new AtomicInteger();
-        AtomicInteger joinedThreads = new AtomicInteger();
-
-        ExecutorService executorService = Executors.newFixedThreadPool(threads);
         for (int i = 0; i < threads; i++) {
-            executorService.submit(() -> {
-                CompletableFuture<Void> waitProxiesFuture;
-                synchronized (startLock) {
-                    waitProxiesFuture = yt.waitProxies();
-                    startedWaits.getAndIncrement();
-                }
-                while (startedWaits.get() < threads) {
-                    try {
-                        synchronized (startLock) {
-                            startLock.wait();
-                        }
-                    } catch (InterruptedException e) {
-                        e.printStackTrace();
-                    }
-                }
-
-                // startedWaits == threads
-                synchronized (startLock) {
-                    startLock.notifyAll();
-                }
-                waitProxiesFuture.join();
-
-                joinedThreads.getAndIncrement();
+            tasks.add(() -> {
+                CompletableFuture<Void> waitProxiesFuture = yt.waitProxies();
+                startedWaits.countDown();
+                startedWaits.await();
+                waitProxiesFuture.get();
+                return null;
             });
         }
-        executorService.shutdown();
-        executorService.awaitTermination(60, TimeUnit.SECONDS);
-        Assert.assertEquals(startedWaits.get(), joinedThreads.get());
+
+        ExecutorService executorService = Executors.newFixedThreadPool(threads);
+        try {
+            for (var result : executorService.invokeAll(tasks, 60, TimeUnit.SECONDS)) {
+                result.get();
+            }
+        } finally {
+            executorService.shutdownNow();
+            Assert.assertTrue("Worker threads did not terminate",
+                    executorService.awaitTermination(60, TimeUnit.SECONDS));
+        }
     }
 }
```

---

### Incident Patch 9: `5671986d` (2026-09-29)
**Commit Message**: Fix flaky tests
commit_hash:054f553c76d4db127509fc893041f078ba4b00a4

**File**: `yt/yt/tests/integration/node/test_locations.py` (modified, +3/-3)
```diff
@@ -622,7 +622,7 @@ def test_cache_location_overflow(self, multi_chunk, disable_on_out_of_disk_space
 
         node = ls("//sys/cluster_nodes")[0]
 
-        assert get(f"//sys/cluster_nodes/{node}/@resource_limits/user_slots") == 1
+        wait(lambda: get(f"//sys/cluster_nodes/{node}/@resource_limits/user_slots") == 1)
         assert not os.path.exists(f"{self.cache_volume_path}/disabled")
 
         controller_agent_address = ls("//sys/controller_agents/instances")[0]
@@ -790,7 +790,7 @@ def test_disk_full_does_not_disable_location(self, slot_root_exists):
 
         wait(lambda: get(f"//sys/cluster_nodes/{self.node_address}/@state") == "online")
         assert self._slot_location_alert() is None
-        assert get(f"//sys/cluster_nodes/{self.node_address}/@resource_limits/user_slots") == 1
+        wait(lambda: get(f"//sys/cluster_nodes/{self.node_address}/@resource_limits/user_slots") == 1)
 
         initial_enospc_count = self._get_enospc_count()
 
@@ -843,7 +843,7 @@ def test_non_disk_error_disables_location(self):
 
             wait(lambda: self._slot_location_alert() is not None)
             assert not self._get_slot_location()["enabled"]
-            assert get(f"//sys/cluster_nodes/{self.node_address}/@resource_limits/user_slots") == 0
+            wait(lambda: get(f"//sys/cluster_nodes/{self.node_address}/@resource_limits/user_slots") == 0)
 
             def check_abort_entries():
                 abort_entries = self._read_job_abort_entries(op.id, from_barrier, to_barrier)
```

---

### Incident Patch 10: `c8c38828` (2026-09-29)
**Commit Message**: YQL-21346 select (part2) - order by, limit, fixed YqlSelect case sensitive resolve, some funcs & operators

#### Spark SQL: ORDER BY, LIMIT/OFFSET, case-sensitive columns, and new operators ✎

- **ORDER BY** is now translated end-to-end: by column name, alias, ordinal position, or arbitrary expression, with `ASC`/`DESC` and `NULLS FIRST`/`NULLS LAST`. Ordinals outside the select list or non-positive values produce clear errors; ambiguous column references are reported as such. `SORT BY` is explicitly rejected as unsupported.

- **LIMIT / OFFSET** are translated with full validation: the expression must be a foldable constant (column references, `nullif`, `try_*`, and similar runtime functions are rejected at parse time), must have `Int32` type, and must be non-negative. `LIMIT ALL` and `OFFSET` are supported. The proto validator additionally checks that the global and local limit expressions match.

- **Case-sensitive column resolution** in `YqlSelect` is fixed: columns that differ only in letter case (e.g. `a` and `A`) are now treated as distinct, and referencing a column with the wrong case produces a "No such column" error in `SELECT`, `WHERE`, and `ORDER BY`.

- **New expressio

**File**: `yql/essentials/core/sql_types/spark_functions.cpp` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ class TFunctionRegistry {
         {"md5", {.BindingName = "md5", .MinArgs = 1, .MaxArgs = 1}},
         {"crc32", {.BindingName = "crc32", .MinArgs = 1, .MaxArgs = 1}},
         {"sha1", {.BindingName = "sha1", .MinArgs = 1, .MaxArgs = 1}},
+        {"sha", {.BindingName = "sha1", .MinArgs = 1, .MaxArgs = 1}}, // sha1
         {"sha2", {.BindingName = "sha2", .MinArgs = 2, .MaxArgs = 2}},
         {"unbase64", {.BindingName = "unbase64", .MinArgs = 1, .MaxArgs = 1}},
         {"quote", {.BindingName = "quote", .MinArgs = 1, .MaxArgs = 1}},
```

**File**: `yql/essentials/core/type_ann/type_ann_sql.cpp` (modified, +139/-51)
```diff
@@ -20,6 +20,22 @@ struct TGroupExpr {
     TExprNode::TPtr TypeNode;
 };
 
+TMaybe<ui32> TInput::FindColumn(TStringBuf name, bool* isVirtual) const {
+    if (!CaseSensitive) {
+        return Type->FindItemI(name, isVirtual);
+    }
+    if (isVirtual) {
+        *isVirtual = false;
+    }
+    if (auto index = Type->FindItem(name)) {
+        return index;
+    }
+    if (isVirtual) {
+        *isVirtual = true;
+    }
+    return Type->FindItem(YqlVirtualPrefix + name);
+}
+
 namespace {
 
 void ScanSublinks(TExprNode::TPtr root, TNodeSet& sublinks, bool& isUniversal);
@@ -74,7 +90,8 @@ TSqlColumnRefMatch ResolveSqlColumnRef(
     const TExprNode& node,
     const TInputs& inputs,
     const THashSet<TString>& possibleAliases,
-    bool scanColumnsOnly);
+    bool scanColumnsOnly,
+    bool projectionRefsResolved = false);
 
 bool ScanColumns(
     TExprNode::TPtr root,
@@ -87,7 +104,8 @@ bool ScanColumns(
     TExtContext& ctx,
     bool scanColumnsOnly,
     bool hasEmitPgStar = false,
-    THashMap<TString, TString> usedInUsing = {});
+    THashMap<TString, TString> usedInUsing = {},
+    bool projectionRefsResolved = false);
 
 bool ScanColumnsForSublinks(
     bool& needRebuildSubLinks,
@@ -253,11 +271,42 @@ void ScanSublinks(TExprNode::TPtr root, TNodeSet& sublinks, bool& isUniversal) {
     });
 }
 
+TMaybe<ui32> FindInputColumn(const TInput& input, const TExprNode& reference, bool* isVirtual) {
+    const auto name = reference.Tail().Content();
+    if (reference.IsCallable({"YqlColumnRef", "YqlColumnRefOrType"}) && input.Order) {
+        if (isVirtual) {
+            *isVirtual = false;
+        }
+        auto column = FindIf(*input.Order, [&](const auto& item) { return name == item.LogicalName; });
+        if (column == input.Order->end() && !input.CaseSensitive) {
+            column = FindIf(*input.Order, [&](const auto& item) { return AsciiEqualsIgnoreCase(name, item.LogicalName); });
+        }
+        if (column == input.Order->end()) {
+            return Nothing();
+        }
+        auto index = input.Type->FindItem(column->PhysicalName);
+        YQL_ENSURE(index, "Column order refers to a missing field: " << column->PhysicalName);
+        return index;
+    }
+    return input.FindColumn(name, isVirtual);
+}
+
+bool IsAmbiguousColumn(const TInput& input, TStringBuf name) {
+    if (!input.Order) {
+        return false;
+    }
+    if (input.CaseSensitive) {
+        return CountIf(*input.Order, [&](const auto& column) { return name == column.LogicalName; }) > 1;
+    }
+    return input.Order->IsDuplicatedIgnoreCase(TString(name));
+}
+
 TSqlColumnRefMatch ResolveSqlColumnRef(
     const TExprNode& node,
     const TInputs& inputs,
     const THashSet<TString>& possibleAliases,
-    bool scanColumnsOnly)
+    bool scanColumnsOnly,
+    bool projectionRefsResolved)
 {
     YQL_ENSURE(node.IsCallable({"YqlColumnRef", "YqlColumnRefOrType", "PgColumnRef"}));
 
@@ -290,7 +339,7 @@ TSqlColumnRefMatch ResolveSqlColumnRef(
                 continue;
             }
 
-            if (!input.Alias.empty()) {
+            if (node.IsCallable("PgColumnRef") && !input.Alias.empty()) {
                 if (columnName == input.Alias) {
                     matchedAliasInput = &input;
                 } else if (AsciiEqualsIgnoreCase(columnName, input.Alias)) {
@@ -299,12 +348,13 @@ TSqlColumnRefMatch ResolveSqlColumnRef(
                 }
             }
 
-            if (input.Order && input.Order->IsDuplicatedIgnoreCase(columnName)) {
+            if (!(projectionRefsResolved && input.Priority == TInput::Projection) &&
+                IsAmbiguousColumn(input, columnName)) {
                 return {.Status = ESqlColumnRefStatus::Ambiguous};
             }
 
             bool isVirtual;
-            if (const auto position = input.Type->FindItemI(columnName, &isVirtual)) {
+            if (const auto position = FindInputColumn(input, node, &isVirtual)) {
                 ++matches;
                 matchedIn
```

**File**: `yql/essentials/core/type_ann/type_ann_sql.h` (modified, +3/-0)
```diff
@@ -18,6 +18,9 @@ struct TInput {
     TMaybe<TColumnOrder> Order;
     EInputPriority Priority = External;
     TSet<TString> UsedExternalColumns;
+    bool CaseSensitive = false;
+
+    TMaybe<ui32> FindColumn(TStringBuf name, bool* isVirtual = nullptr) const;
 };
 
 using TInputs = TVector<TInput>;
```

**File**: `yql/essentials/data/language/sql_functions.json` (modified, +4/-0)
```diff
@@ -1721,6 +1721,10 @@
     "name": "Spark::sec",
     "kind": "Normal"
   },
+  {
+    "name": "Spark::sha",
+    "kind": "Normal"
+  },
   {
     "name": "Spark::sha1",
     "kind": "Normal"
```

**File**: `yql/essentials/mount/lib/yql/spark.yqls` (modified, +25/-1)
```diff
@@ -65,11 +65,22 @@
 (let op_le (lambda '(left right) (Apply comparison left right (lambda '(left_item right_item) (AggrLessOrEqual left_item right_item)))))
 (let boolean_argument (lambda '(value) (MatchType (TypeOf value)
     'Null (lambda '() (Nothing (OptionalType (DataType 'Bool))))
-    (lambda '() value)
+    'Optional (lambda '() (EnsureType value (OptionalType (DataType 'Bool)) 'Expected_boolean_argument))
+    (lambda '() (EnsureType value (DataType 'Bool) 'Expected_boolean_argument))
 )))
+(let isunknown (lambda '(value) (Apply isnull (Apply boolean_argument value))))
+(let isnotunknown (lambda '(value) (Apply isnotnull (Apply boolean_argument value))))
 (let op_and (lambda '(left right) (And (Apply boolean_argument left) (Apply boolean_argument right))))
 (let op_or (lambda '(left right) (Or (Apply boolean_argument left) (Apply boolean_argument right))))
 (let op_not (lambda '(value) (Not (Apply boolean_argument value))))
+(let row_count (lambda '(value) (block '(
+    (let value (MatchType (TypeOf value)
+        'Optional (lambda '() (Unwrap value (String '"LIMIT/OFFSET must not be NULL")))
+        (lambda '() value)))
+    (let value (EnsureType value (DataType 'Int32) '"LIMIT/OFFSET must have INT type"))
+    (return (Unwrap (SafeCast value (DataType 'Uint64)) (String '"LIMIT/OFFSET must be non-negative")))
+))))
+
 (let where_predicate (lambda '(value) (MatchType (TypeOf value)
     'Optional (lambda '() (EnsureType value (OptionalType (DataType 'Bool)) 'Expected_boolean_WHERE_predicate))
     (lambda '() (EnsureType value (DataType 'Bool) 'Expected_boolean_WHERE_predicate))
@@ -498,6 +509,15 @@
     (lambda '() (Apply factorial_impl value))
 )))
 (let bit_count (lambda '(value) (Apply apply_nullable value bit_count_impl (DataType 'Int32))))
+(let bitwise_not_bits (lambda '(value unsigned_type) (BitCast (BitNot (BitCast value unsigned_type)) (TypeOf value))))
+(let bitwise_not_impl (lambda '(value) (MatchType (TypeOf value)
+    'Int8 (lambda '() (Apply bitwise_not_bits value (DataType 'Uint8)))
+    'Int16 (lambda '() (Apply bitwise_not_bits value (DataType 'Uint16)))
+    'Int32 (lambda '() (Apply bitwise_not_bits value (DataType 'Uint32)))
+    'Int64 (lambda '() (Apply bitwise_not_bits value (DataType 'Uint64)))
+    (lambda '() (EnsureType value (VoidType) '"Spark bitwise NOT requires an integer argument"))
+)))
+(let bitwise_not (lambda '(value) (Apply apply_nullable value bitwise_not_impl (DataType 'Int32))))
 (let bit_get_impl (lambda '(value position) (Convert (BitAnd (Convert (ShiftRight (Unwrap (SafeCast value (DataType 'Int64)) (String 'Expected_Int64)) (Ensure (Unwrap (SafeCast position (DataType 'Uint8)) (String 'Expected_Uint8)) (< position (Uint8 '32)) (String '"bit_get expects position in [0, 32)"))) 'Uint64) (Uint64 '1)) 'Int8)))
 (let bit_get (lambda '(value position) (Apply apply_nullable_binary value position bit_get_impl (DataType 'Int8))))
 (let positive (lambda '(value) (MatchType (TypeOf value)
@@ -712,6 +732,9 @@
 (export equal_null)
 (export isnull)
 (export isnotnull)
+(export isunknown)
+(export isnotunknown)
+(export bitwise_not)
 (export op_eq)
 (export op_gt)
 (export op_ge)
@@ -720,6 +743,7 @@
 (export op_and)
 (export op_or)
 (export op_not)
+(export row_count)
 (export where_predicate)
 (export ifnull)
 (export if)
```

#### Recent Merged Pull Requests:
- **PR #1840** (closed): [docs] Update Release Notes (@ytsaurus-actions[bot])
- **PR #1839** (closed): Validate DQ settings and add more logs. (@Tony-Romanov)
- **PR #1838** (closed): [docs] Update Release Notes (@ytsaurus-actions[bot])
- **PR #1837** (closed): [docs] Update Release Notes (@ytsaurus-actions[bot])
- **PR #1836** (closed): [docs] Update Release Notes (@ytsaurus-actions[bot])
- **PR #1835** (closed): [docs] Update Release Notes (@ytsaurus-actions[bot])
- **PR #1834** (closed): Move trusted UDFs out to separate subdirectory in YQL agent image (@loochek)
- **PR #1822** (closed): docs: fix typo agregation -> aggregation (@vaibhav8a)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
