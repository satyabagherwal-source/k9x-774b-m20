# Forensic Learning Record (Deep Inspection): activeloopai/deeplake

> **Canonical Artifact**: `07_PROJECT_LEARNING/activeloopai-deeplake-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/activeloopai/deeplake](https://github.com/activeloopai/deeplake))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:27:20.414Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `activeloopai/deeplake`
- **Description**: Deeplake is AI Data Runtime for Agents. It provides serverless postgres with a multimodal datalake, enabling scalable retrieval and training.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9249 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cpp/3rd_party/sql-parser/benchmark/benchmark_utils.cpp`
```
#include "benchmark_utils.h"

#include <fstream>
#include <iostream>

#include "SQLParser.h"

size_t getNumTokens(const std::string& query) {
  std::vector<int16_t> tokens;
  hsql::SQLParser::tokenize(query, &tokens);
  return tokens.size();
}

void BM_TokenizeBenchmark(benchmark::State& st, const std::string& query) {
  st.counters["num_tokens"] = getNumTokens(query);
  st.counters["num_chars"] = query.size();

  while (st.KeepRunning()) {
    std::vector<int16_t> tokens(512);
    hsql::SQLParser::tokenize(query, &tokens);
  }
}

void BM_ParseBenchmark(benchmark::State& st, const std::string& query) {
  st.counters["num_tokens"] = getNumTokens(query);
  st.counters["num_chars"] = query.size();

  while (st.KeepRunning()) {
    hsql::SQLParserResult result;
    hsql::SQLParser::parse(query, &result);
    if (!result.isValid()) {
      std::cout << query << std::endl;
      std::cout << result.errorMsg() << std::endl;
      st.SkipWithError("Parsing failed!");
    }
  }
}

std::string readFileContents(const std::string& file_path) {
  std::ifstream t(file_path.c_str());
  std::string text((std::istreambuf_iterator<char>(t)),
                   std::istreambuf_iterator<char>());
  return text;
}

```

### Core Architecture Module: `cpp/3rd_party/sql-parser/benchmark/benchmark_utils.h`
```
#ifndef __BENCHMARK_UTILS_H__
#define __BENCHMARK_UTILS_H__

#include "benchmark/benchmark.h"

size_t getNumTokens(const std::string& query);

void BM_TokenizeBenchmark(benchmark::State& st, const std::string& query);

void BM_ParseBenchmark(benchmark::State& st, const std::string& query);

std::string readFileContents(const std::string& file_path);




#define TIME_DIFF(end, start)\
  std::chrono::duration_cast<std::chrono::duration<double>>(end - start);

#define NOW()\
  std::chrono::high_resolution_clock::now();

#define PARSE_QUERY_BENCHMARK(name, query)\
  static void name(benchmark::State& st) {\
    BM_ParseBenchmark(st, query);\
  }\
  BENCHMARK(name);

#define TOKENIZE_QUERY_BENCHMARK(name, query)\
  static void name(benchmark::State& st) {\
    BM_TokenizeBenchmark(st, query);\
  }\
  BENCHMARK(name);


#define BENCHMARK_QUERY(test_name, query)\
  TOKENIZE_QUERY_BENCHMARK(test_name##Tokenize, query)\
  PARSE_QUERY_BENCHMARK(test_name##Parse, query)


#endif
```

### Core Architecture Module: `cpp/3rd_party/sql-parser/src/sql/AlterStatement.h`
```
#ifndef SQLPARSER_ALTER_STATEMENT_H
#define SQLPARSER_ALTER_STATEMENT_H

#include "SQLStatement.h"

// Note: Implementations of constructors and destructors can be found in statements.cpp.
namespace hsql {

enum ActionType {
  DropColumn,
};

struct AlterAction {
  AlterAction(ActionType type);
  ActionType type;
  virtual ~AlterAction();
};

struct DropColumnAction : AlterAction {
  DropColumnAction(char* column_name);
  char* columnName;
  bool ifExists;

  ~DropColumnAction() override;
};

// Represents SQL Alter Table statements.
// Example "ALTER TABLE students DROP COLUMN name;"
struct AlterStatement : SQLStatement {
  AlterStatement(char* name, AlterAction* action);
  ~AlterStatement() override;

  char* schema;
  bool ifTableExists;
  char* name;
  AlterAction* action;
};
}  // namespace hsql

#endif

```

### Core Architecture Module: `cpp/3rd_party/sql-parser/src/sql/DropStatement.h`
```
#ifndef SQLPARSER_DROP_STATEMENT_H
#define SQLPARSER_DROP_STATEMENT_H

#include "SQLStatement.h"

// Note: Implementations of constructors and destructors can be found in statements.cpp.
namespace hsql {

enum DropType { kDropTable, kDropSchema, kDropIndex, kDropView, kDropPreparedStatement };

// Represents SQL Delete statements.
// Example "DROP TABLE students;"
struct DropStatement : SQLStatement {
  DropStatement(DropType type);
  ~DropStatement() override;

  DropType type;
  bool ifExists;
  char* schema;
  char* name;
  char* indexName;
};

}  // namespace hsql
#endif
```

### Core Architecture Module: `cpp/3rd_party/sql-parser/src/sql/ExportStatement.h`
```
#ifndef SQLPARSER_EXPORT_STATEMENT_H
#define SQLPARSER_EXPORT_STATEMENT_H

#include "ImportStatement.h"
#include "SQLStatement.h"

namespace hsql {
// Represents SQL Export statements.
struct ExportStatement : SQLStatement {
  ExportStatement(ImportType type);
  ~ExportStatement() override;

  // ImportType is used for compatibility reasons
  ImportType type;
  char* filePath;
  char* schema;
  char* tableName;
};

}  // namespace hsql

#endif

```

### Core Architecture Module: `cpp/3rd_party/sql-parser/src/sql/ImportStatement.h`
```
#ifndef SQLPARSER_IMPORT_STATEMENT_H
#define SQLPARSER_IMPORT_STATEMENT_H

#include "SQLStatement.h"

namespace hsql {
enum ImportType {
  kImportCSV,
  kImportTbl,  // Hyrise file format
  kImportBinary,
  kImportAuto
};

// Represents SQL Import statements.
struct ImportStatement : SQLStatement {
  ImportStatement(ImportType type);
  ~ImportStatement() override;

  ImportType type;
  char* filePath;
  char* schema;
  char* tableName;
};

}  // namespace hsql

#endif

```

### Core Architecture Module: `cpp/3rd_party/sql-parser/src/sql/InsertStatement.h`
```
#ifndef SQLPARSER_INSERT_STATEMENT_H
#define SQLPARSER_INSERT_STATEMENT_H

#include "SQLStatement.h"
#include "SelectStatement.h"

namespace hsql {
enum InsertType { kInsertValues, kInsertSelect };

// Represents SQL Insert statements.
// Example: "INSERT INTO students VALUES ('Max', 1112233, 'Musterhausen', 2.3)"
struct InsertStatement : SQLStatement {
  InsertStatement(InsertType type);
  ~InsertStatement() override;

  InsertType type;
  char* schema;
  char* tableName;
  std::vector<char*>* columns;
  std::vector<Expr*>* values;
  SelectStatement* select;
};

}  // namespace hsql

#endif

```

### Core Architecture Module: `cpp/3rd_party/sql-parser/src/sql/PrepareStatement.cpp`
```

#include "PrepareStatement.h"

namespace hsql {
// PrepareStatement
PrepareStatement::PrepareStatement() : SQLStatement(kStmtPrepare), name(nullptr), query(nullptr) {}

PrepareStatement::~PrepareStatement() {
  free(name);
  free(query);
}
}  // namespace hsql

```

### Core Architecture Module: `cpp/3rd_party/sql-parser/src/sql/PrepareStatement.h`
```
#ifndef SQLPARSER_PREPARE_STATEMENT_H
#define SQLPARSER_PREPARE_STATEMENT_H

#include "SQLStatement.h"

namespace hsql {

// Represents SQL Prepare statements.
// Example: PREPARE test FROM 'SELECT * FROM test WHERE a = ?;'
struct PrepareStatement : SQLStatement {
  PrepareStatement();
  ~PrepareStatement() override;

  char* name;

  // The query that is supposed to be prepared.
  char* query;
};

}  // namespace hsql

#endif

```

### Core Architecture Module: `cpp/3rd_party/sql-parser/src/sql/SQLStatement.cpp`
```

#include "SQLStatement.h"

namespace hsql {

// SQLStatement
SQLStatement::SQLStatement(StatementType type) : hints(nullptr), type_(type){};

SQLStatement::~SQLStatement() {
  if (hints != nullptr) {
    for (Expr* hint : *hints) {
      delete hint;
    }
  }
  delete hints;
}

StatementType SQLStatement::type() const { return type_; }

bool SQLStatement::isType(StatementType type) const { return (type_ == type); }

bool SQLStatement::is(StatementType type) const { return isType(type); }

}  // namespace hsql
```

### Core Architecture Module: `cpp/3rd_party/sql-parser/src/sql/SQLStatement.h`
```
#ifndef SQLPARSER_SQLSTATEMENT_H
#define SQLPARSER_SQLSTATEMENT_H

#include <vector>

#include "Expr.h"

namespace hsql {
enum StatementType {
  kStmtError,  // unused
  kStmtSelect,
  kStmtImport,
  kStmtInsert,
  kStmtUpdate,
  kStmtDelete,
  kStmtCreate,
  kStmtDrop,
  kStmtPrepare,
  kStmtExecute,
  kStmtExport,
  kStmtRename,
  kStmtAlter,
  kStmtShow,
  kStmtTransaction
};

// Base struct for every SQL statement
struct SQLStatement {
  SQLStatement(StatementType type);

  virtual ~SQLStatement();

  StatementType type() const;

  bool isType(StatementType type) const;

  // Shorthand for isType(type).
  bool is(StatementType type) const;

  // Length of the string in the SQL query string
  size_t stringLength;

  std::vector<Expr*>* hints;

 private:
  StatementType type_;
};

}  // namespace hsql

#endif  // SQLPARSER_SQLSTATEMENT_H

```

### Core Architecture Module: `cpp/3rd_party/sql-parser/src/sql/SelectStatement.h`
```
#ifndef SQLPARSER_SELECT_STATEMENT_H
#define SQLPARSER_SELECT_STATEMENT_H

#include "Expr.h"
#include "SQLStatement.h"
#include "Table.h"

#include <base/base.hpp>

namespace hsql {
enum OrderType { kOrderAsc, kOrderDesc };

enum SetType { kSetUnion, kSetIntersect, kSetExcept };

enum RowLockMode { ForUpdate, ForNoKeyUpdate, ForShare, ForKeyShare };
enum RowLockWaitPolicy { NoWait, SkipLocked, None };

enum AcrossType { Time, Space };

// Description of the order by clause within a select statement.
struct OrderDescription {
  OrderDescription(OrderType type, Expr* expr);
  ~OrderDescription();

  OrderType type;
  Expr* expr;
};

// Description of the limit clause within a select statement.
struct LimitDescription {
  LimitDescription(Expr* limit, Expr* offset);
  ~LimitDescription();

  Expr* limit;
  Expr* offset;
};

// Description of the limit clause within a select statement.
struct SampleLimitDescription {
  SampleLimitDescription(Expr* limit, bool percent);
  ~SampleLimitDescription();

  Expr* limit;
  bool percent;
};

struct SampleDescription {
  SampleDescription(Expr* expr, SampleLimitDescription* limit, bool repeats);
  ~SampleDescription();

  Expr* expr;
  SampleLimitDescription* limit;
  bool repeats;
};

// Description of the group-by clause within a select statement.
struct GroupByDescription {
  GroupByDescription();
  ~GroupByDescription();

  std::vector<Expr*>* columns;
  Expr* having;
  AcrossType across;
};

struct UnGroupByDescription {
  UnGroupByDescription();
  ~UnGroupByDescription();

  Expr* expr = nullptr;
  bool split = false;
};

struct WithDescription {
  ~WithDescription();

  char* alias;
  SelectStatement* select;
};

struct SetOperation {
  SetOperation();
  ~SetOperation();

  SetType setType;
  bool isAll;

  SelectStatement* nestedSelectStatement;
  std::vector<OrderDescription*>* resultOrder;
  LimitDescription* resultLimit;
};

struct LockingClause {
  RowLockMode rowLockMode;
  RowLockWaitPolicy rowLockWaitPolicy;
  std::vector<char*>* tables;
};

struct Expansion {
  Expansion(int back, int forw, Expr* n, Expr* o)
    : name(n ? n->name : "")
    , backward(back)
    , forward(forw)
    , allow_overlap(o->ival)
  {
      base::log_warning(base::log_channel::tql, "EXPAND BY is deprecated and will be removed in a future release.");
      delete n;
      delete o;
  }

  std::string name;
  int backward;
  int forward;
  bool allow_overlap = true;
};

struct WhereClause {
  WhereClause(Expr* a)
    : expr(a)
  {}

  ~WhereClause()
  {
      delete expr;
  }

  Expr* expr;
};

/**
 * @brief Description of DISTINCT clause
 * Represents both simple DISTINCT and DISTINCT ON (columns)
 */
struct DistinctDescription {
    std::vector<Expr*>* distinct_columns = nullptr;

    DistinctDescription() = default;

    ~DistinctDescription() {
        delete distinct_columns;
    }
};

// Representation of a full SQL select statement.
struct SelectStatement : SQLStatement {
  SelectStatement();
  ~SelectStatement() override;

  TableRef* fromTable;
  DistinctDescription* distinct;
  std::vector<Expr*>* selectList;
  WhereClause* whereClause;
  Expansion* expansion;
  GroupByDescription* groupBy;
  UnGroupByDescription* unGroupBy;
  SampleDescription* sampleBy;

  // Note that a SetOperation is always connected to a
  // different SelectStatement. This statement can itself
  // have SetOperation connections to other SelectStatements.
  // To evaluate the operations in the correct order:
  //    Iterate over the setOperations vector:
  //      1. Fully evaluate the nestedSelectStatement within the SetOperation
  //      2. Connect the original statement with the
  //         evaluated nestedSelectStatement
  //      3. Apply the resultOrder and the resultLimit
  //      4. The result now functions as the the original statement
  //         for the next iteration
  //
  // Example:
  //
  //   (SELECT * FROM students INTERSECT SELECT * FROM students_2) UNION SELECT * FROM students_3 ORDER BY grade ASC;
  //
  //   1. We evaluate `Select * FROM students`
  //   2. Then we iterate over the setOperations vector
  //   3. We evalute the nestedSelectStatement of the first entry, which is: `SELECT * FROM students_2`
  //   4. We connect the result of 1. with the results of 3. using the setType, which is INTERSECT
  //   5. We continue the iteration of the setOperations vector
  //   6. We evaluate the new nestedSelectStatement which is: `SELECT * FROM students_3`
  //   7. We apply a Union-Operation to connect the results of 4. and 6.
  //   8. Finally, we apply the resultOrder of the last SetOperation (ORDER BY grade ASC)
  std::vector<SetOperation*>* setOperations;

  std::vector<OrderDescription*>* order;
  std::vector<WithDescription*>* withDescriptions;
  LimitDescription* limit;
  std::vector<LockingClause*>* lockings;

  inline bool selectDistinct() const {
    return distinct != nullptr;
  }
};

}  // namespace hsql

#endif

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3159** (2026-08-08): **[BUG] 1 % (0 % 2) evaluates to NaN, but should raise an exception when actingas a filter.**
  *Symptoms*: ### Severity  P2 - Not urgent, nice to have  ### Current Behavior  The filter "1 % (0 % 2)" evaluates to NaN, which may lead to incorrect data being returned, for example when evaluating "not (NaN > 0)".  ### Steps to Reproduce  run the following code  ```python import deeplake import numpy as np  ds = deeplake.create("mem://mod_zero_test")  ds.add_column("x", dtype="int64") ds.add_column("y", dtype="int64")  ds.append({     "x": np.array([1, 2, 5, 10, -3, 100], dtype=np.int64),     "y": np.array([1, 2, 3, 5, -7, 100], dtype=np.int64), })   res = ds.query(""" SELECT * where not (1 % (0 % 2) >0) """)   print(res) print("len =", len(res)) ```  ### Expected/Desired Behavior  The query with this filter should raise an exception, or be evaluated such that there are not any data returned.  ### Python Version  3.10  ### OS  Ubunto 22.04  ### IDE  _No response_  ### Packages  _No response_  ### Additional Context  _No response_  ### Possible Solution  _No response_  ### Are you willing to submit a PR?  - [ ] I'm willing to submit a PR (Thank you!)
  **Post-Mortem & Fix Analysis**:
  > Hey @zhuang-keju, thanks for reporting this. We reproduced the issue. It will be fixed in the next version.
  > Thanks for confirming the repro.  I looked at landing an outsider fix: the public tree exposes `nd::percent` / binary-op types and the generic `create_binary_kernel` templates, but the actual arithmetic op wiring (and any zero-divisor handling) does not appear to be in the open sources — Python goes through compiled `_deeplake.tql`. Happy to revisit if that evaluator code is opened or if there is a preferred public hook for a guard. 

- **Issue #3149** (2026-08-13): **[BUG] deeplake 4.5.10 raises Dtype is unknown error for int * JSON, but not for JSON * JSON**
  *Symptoms*: ### Severity  P2 - Not urgent, nice to have  ### Current Behavior  Deeplake raises Dtype is unknown error for filter = """(-21877) >= (-1093 * f6['e3'])""".    ### Steps to Reproduce  ```python import deeplake as deeplake_lib from deeplake import types as dl_types import numpy as np   # create dataset path = "mem://test_collection" try: deeplake_lib.delete(path) except: pass ds = deeplake_lib.create(path)  # create schema ds.add_column("f0", dl_types.Int64()) ds.add_column("f1", dl_types.Array("float32", 1)) ds.add_column("f2", dl_types.Float32()) ds.add_column("f3", dl_types.Float32()) ds.add_column("f4", dl_types.Dict()) ds.add_column("f5", dl_types.Embedding(48, dtype='float32')) ds.add_column("f6", dl_types.Dict()) ds.add_column("f7", dl_types.Text()) ds.add_column("f8", dl_types.Embedding(46, dtype='float32'))  # define data data_list = [...]  # insert data pkey_name = 'f0' pk_to_idx = {} if pkey_name is not None and len(ds) > 0:     col = ds[pkey_name]     for i, v in enumerate(col):         pk_to_idx[v.item()] = i for data in data_list:     pk = data.get(pkey_name) if pkey_name is not None else None     idx = pk_to_idx.get(pk) if pk is not None else None     if idx is None:         row = {k: [v] for k, v in data.items()}         ds.append(row)         if pk is not None:             pk_to_idx[pk] = len(ds) - 1     else:         for field, v in data.items():             if field in ['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8']:                 ds[field][idx] = v
  **Post-Mortem & Fix Analysis**:
  > Further test shows that in some cases, int * json_ref may raise dtype unknown, but 0 * json_ref can be executed successfully
  > Hey @zhuang-keju this will be fixed in the next release. Thanks.

- **Issue #3148** (2026-03-19): **[BUG] deeplake v4.5.8 returns empty set for the same query executed after deleting some data**
  *Symptoms*: ### Severity  P0 - Critical breaking issue or missing functionality  ### Current Behavior  Deeplake returns an empty set for the second query during the process described in `Expected Behavior`.  ### Steps to Reproduce  run the following code:  ```python import deeplake as deeplake_lib from deeplake import types as dl_types import numpy as np  # create dataset path = "mem://test_collection" try: deeplake_lib.delete(path) except: pass ds = deeplake_lib.create(path) ds.add_column("f0", dl_types.Int64()) ds.add_column("f1", dl_types.Float32()) ds.add_column("f2", dl_types.Dict()) ds.add_column("f3", dl_types.Int64()) ds.add_column("f4", dl_types.Int64()) ds.add_column("f5", dl_types.Array("bool", 1)) ds.add_column("f6", dl_types.Int64()) ds.add_column("f7", dl_types.Embedding(18, dtype='float32')) ds.add_column("f8", dl_types.Embedding(27, dtype='float32'))  # define data data_list = [     {'f0': 184525, 'f1': 0.05727, 'f2': {'e4': 408011, 'e1': False, 'e2': 0.54802, 'e7': [True, False, True, True, True, False, False, True, True, True, True, False, True, True, True, False, True, False, True, False, True, False, True, True], 'e0': False, 'e3': -361971, 'e6': 0.53503, 'e5': 0}, 'f3': 276415, 'f4': -148744, 'f5': [False], 'f6': 447046, 'f7': [0.86464, 0.25095, 0.89024, 0.92408, 0.14763, 0.95403, 0.1856, 0.31301, 0.69142, 0.61442, 0.04938, 0.35445, 0.39817, 0.44258, 0.83449, 0.69825, 0.71656, 0.19852], 'f8': [0.20354, 0.52984, 0.34126, 0.41081, 0.32072, 0.36992, 0.60845, 0.9979, 0.2

- **Issue #3147** (2026-03-19): **[BUG] deeplake v4.5.6 raises 'deeplake._deeplake.InvalidType: Dtype is unknown.' for filter ((-104454 * f3[12]) != 0), but no error for ((f3[12] * -104454) != 0)**
  *Symptoms*: ### Severity  P2 - Not urgent, nice to have  ### Current Behavior  Deeplake raises a Dtype is unknown exception  ### Steps to Reproduce  run the following code to reproduce the error.  ```python import deeplake as deeplake_lib from deeplake import types as dl_types import numpy as np  # create dataset path = "mem://test_collection" try:     deeplake_lib.delete(path) except:     pass ds = deeplake_lib.create(path)  # define schema ds.add_column("f0", dl_types.Text()) ds.add_column("f1", dl_types.Dict()) ds.add_column("f2", dl_types.Text()) ds.add_column("f3", dl_types.Array("int64", 1)) ds.add_column("f4", dl_types.Float32()) ds.add_column("f5", dl_types.Bool()) ds.add_column("f6", dl_types.Embedding(34, dtype='float32')) ds.add_column("f7", dl_types.Embedding(86, dtype='float32'))  # define data data_list = [     {'f0': '', 'f1': {'e1': -376707, 'e4': 0, 'e5': False, 'e6': False, 'e3': [0.16164, 0, -0.58172, 0.84732, -0.80616, -0.55324, -0.85403, 0.63764, 0, -0.59601, 0, -0.55499, -0.06859], 'e2': -0.54477}, 'f2': '+O2*M=', 'f3': [0, 0, 144740, 0, 0, 376007, 0, 433928, -82129, 3154, 238297, -168037], 'f4': 0, 'f5': True, 'f6': [0.42573, 0.79153, 0.6364, 0.19344, 0.55068, 0.39151, 0.09344, 0.82567, 0.06643, 0.45215, 0.94213, 0.54453, 0.20783, 0.44767, 0.55159, 0.39835, 0.38987, 0.12159, 0.02728, 0.32253, 0.70929, 0.55861, 0.98812, 0.93794, 0.45273, 0.52077, 0.12324, 0.43113, 0.21398, 0.54107, 0.88514, 0.89577, 0.8699, 0.64384], 'f7': [0.02376, 0.45177, 0.3607, 0.07637, 0.9763,
  **Post-Mortem & Fix Analysis**:
  > This behavior happens for other arithmetic operators that involve multiplication/division, like division, modulus

- **Issue #3146** (2026-03-19): **[BUG] deeplake v4.5.6 returns inconsistent query results after delete() when dataset contains Zero Vectors (NaN poisoning breaks ORDER BY)**
  *Symptoms*: ### Severity  P0 - Critical breaking issue or missing functionality  ### Current Behavior  The metamorphic relation described in `Expected Behavior` is violated. After deleting the 50 entries, the second query returns a significantly different set of documents. Specifically, the second query returns unexpected "extra" IDs that were never in the top 100 of the initial query, and expected IDs that were NOT deleted are inexplicably missing from the new top 50 results.   ### Steps to Reproduce  run the following code to reproduce the unexpected behavior. [deeplake_bug_trigger.py.txt](https://github.com/user-attachments/files/26042033/deeplake_bug_trigger.py.txt) Below is a sample of the program  ```python  import deeplake as deeplake_lib import numpy as np from deeplake import types as dl_types  data_list = [...] # contains zero vectors.  def test_zero_vector_consistency():      # Create dataset in memory     collection_name = "zero_vec_test"     path = f"mem://{collection_name}"     try:         deeplake_lib.delete(path)     except Exception:         pass     ds = deeplake_lib.create(path)     ds.add_column("id", dl_types.Text())     ds.add_column("embedding", dl_types.Embedding(128, dtype="float32"))     ds.add_column("f1", dl_types.Int64())           # define data     num_samples = 500     num_zero_vectors = 50         zero_vector_positions = {0, 131, 4, 397, 270, 272, 145, 274, 147, 280, 25, 30, 287, 417, 418, 38, 296, 426, 300, 174, 304, 177, 306, 54, 60, 317, 446, 447, 321,
  **Post-Mortem & Fix Analysis**:
  > Hey @zhuang-keju  thanks for the detailed report. We fixed the issue in `deeplake==4.5.8`. Waiting for your confirmation that it's fixed. Feel free to drop more issues if you find any. Thanks!
  > Fixed, thank you! The latest implementation does not include zero vectors and is strictly sorted. Closing this issue.

- **Issue #3145** (2026-03-17): **[BUG] deeplake v4.5.6 produces a segmentation fault with WHERE (NOT ((f9['e1'] IS NOT NULL)))**
  *Symptoms*: ### Severity  P0 - Critical breaking issue or missing functionality  ### Current Behavior  Deeplake produces a segmentation fault when queried with the clause WHERE (NOT ((f9['e1'] IS NOT NULL))).  ### Steps to Reproduce  The following testcase produces this error: [deeplake_bug_trigger.py.txt](https://github.com/user-attachments/files/25963263/deeplake_bug_trigger.py.txt). The sample logic of the code is shown below.  ```python import deeplake as deeplake_lib from deeplake import types as dl_types import numpy as np import faulthandler  faulthandler.enable()  # create collection, reset old collections if any path = "mem://test_collection" try:     deeplake_lib.delete(path) except:     pass ds = deeplake_lib.create(path)   # define schema ds.add_column("f0", dl_types.Bool()) ds.add_column("f1", dl_types.Int64()) ds.add_column("f2", dl_types.Embedding(35, dtype='float32')) ds.add_column("f3", dl_types.Text()) ds.add_column("f4", dl_types.Float32()) ds.add_column("f5", dl_types.Dict()) ds.add_column("f6", dl_types.Array("float32", 1)) ds.add_column("f7", dl_types.Text()) ds.add_column("f8", dl_types.Dict()) ds.add_column("f9", dl_types.Dict()) ds.add_column("f10", dl_types.Embedding(95, dtype='float32'))  # the data to be inserted data_list = [ ... ]  # insert data pkey_name = 'f7' pk_to_idx = {} if pkey_name is not None and len(ds) > 0:     col = ds[pkey_name].numpy().flatten()     for i, v in enumerate(col):         pk_to_idx[v] = i for data in data_list:     pk = data.get(pk
  **Post-Mortem & Fix Analysis**:
  > Hey @zhuang-keju  thanks for the detailed report. We fixed the issue in `deeplake==4.5.8`. Waiting for your confirmation that it's fixed. Feel free to drop more issues if you find any. Thanks!
  > Fixed, thank you!

- **Issue #3097** (2026-01-28): **[BUG] Deeplake 4.x: S3 connectivity timeout when accessing hub://activeloop datasets**
  *Symptoms*: ### Severity  P1 - Urgent, but non-breaking  ### Current Behavior  # Deeplake 4.x: S3 connectivity timeout when accessing hub://activeloop datasets  ## Summary  Deeplake 4.x fails to connect to Activeloop-hosted datasets (e.g., `hub://activeloop/ffhq`) with S3 timeout errors, while the same network environment works perfectly with deeplake 3.x and direct HTTP/curl requests.  ## Environment  - **Deeplake version**: 4.4.4 (fails) vs 3.9.52 (works) - **Python version**: 3.13.9 - **OS**: Linux (Ubuntu-based HPC cluster) - **Installation method**: pip via uv  ## Actual Behavior  With deeplake 4.4.4:  ``` [S3] Failed to get bucket region for URL: snark-hub/protected/activeloop/ffhq/  with error: [S3] Network connection error:  snark-hub curlCode: 28, Timeout was reached  deeplake._deeplake.LogNotexistsError: Dataset does not exist at path 'hub://activeloop/ffhq/' ```  ## Network Diagnostics  I performed extensive network diagnostics to confirm the network is functioning properly:  ### DNS Resolution ✅ ``` snark-hub.s3.amazonaws.com → 52.217.173.177 (resolves correctly) s3.amazonaws.com → 52.216.221.208 (resolves correctly) ```  ### HTTP Connectivity ✅ ```bash curl -s -o /dev/null -w "%{http_code}" https://snark-hub.s3.amazonaws.com # Returns: 403 (expected for unauthenticated access) # Response time: 0.15s connect, 0.52s total ```  ### Port Connectivity ✅ ``` s3.amazonaws.com:443 - connected successfully s3.amazonaws.com:80 - connected successfully ```  ### Direct S3 Access ✅ All S
  **Post-Mortem & Fix Analysis**:
  > Hey @ScarWar, To open v3 datasets in v4, you can use deeplake.query(f'SELECT * FROM "{v3_dataset_path}") Better option is to convert v3 format to v4 using deeplake.convert, then open as regular v4 dataset.  More information here - https://docs.deeplake.ai/latest/guide/v3-conversion/#option-1-automatic-migration-recommended.  Please let me know if this works.
  > Confirmed the issue is fixed on v4 dataset - `hub://activeloop/ffhq-v4`  Closing the issue.

- **Issue #3076** (2025-09-08): **[BUG] Deeplake v4.3.1 canoot open hub dataset**
  *Symptoms*: ### Severity  P0 - Critical breaking issue or missing functionality  ### Current Behavior  Hi, I am new to deeplake. I want to open coco dataset through al hub. ```python ds = deeplake.open_read_only("hub://activeloop/coco-train",token=TOKEN) ``` but I got the error  ```bash --------------------------------------------------------------------------- LogNotexistsError                         Traceback (most recent call last) Cell In[14], [line 3](vscode-notebook-cell:?execution_count=14&line=3)       1 import deeplake       2 TOKEN = "***" ----> [3](vscode-notebook-cell:?execution_count=14&line=3) ds = deeplake.open_read_only("hub://activeloop/coco-train",token=TOKEN)  LogNotexistsError: Dataset does not exist at path 'hub://activeloop/coco-train/' ```  I try to use deeplake==3.0.0, the old version API can correctly access to the data. ```python  python Python 3.11.13 | packaged by conda-forge | (main, Jun  4 2025, 14:48:23) [GCC 13.3.0] on linux Type "help", "copyright", "credits" or "license" for more information. Ctrl click to launch VS Code Native REPL >>> import deeplake /opt/conda/lib/python3.11/site-packages/deeplake/util/check_latest_version.py:32: UserWarning: A newer version of deeplake (4.3.1) is available. It's recommended that you update to the latest version using `pip install -U deeplake`.   warnings.warn( >>> ds = deeplake.load("hub://activeloop/coco-train",token="***") hub://activeloop/coco-train loaded successfully. /opt/conda/lib/python3.11/site-packages/dee
  **Post-Mortem & Fix Analysis**:
  > hi @WendellZ524, you can not open V3 datasets from V4 API with open but you can get read_only view with this API   ``` import deeplake TOKEN = "***" ds = deeplake.query('SELECT * from "hub://activeloop/coco-train",' token=TOKEN) ```

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

### Incident Patch 1: `88f9819c` (2026-02-15)
**Commit Message**: Merge pull request #3141 from activeloopai/fix/remove-serverless-from-dockerfile

Fix/remove serverless from dockerfile

**File**: `cpp/deeplake_pg/pg_deeplake.cpp` (modified, +2/-0)
```diff
@@ -265,6 +265,8 @@ void save_index_metadata(Oid oid)
     if (SPI_execute(buf.data, false, 0) != SPI_OK_INSERT) {
         ereport(ERROR, (errcode(ERRCODE_INTERNAL_ERROR), errmsg("Failed to save metadata")));
     }
+
+    // Cross-instance propagation is driven by DDL WAL logging in ProcessUtility.
 }
 
 void load_index_metadata()
```

**File**: `cpp/deeplake_pg/table_storage.cpp` (modified, +54/-4)
```diff
@@ -46,6 +46,7 @@ extern "C" {
 #include <icm/json.hpp>
 #include <icm/string_map.hpp>
 #include <nd/none.hpp>
+#include <unordered_set>
 
 #include <algorithm>
 #include <vector>
@@ -287,34 +288,84 @@ void table_storage::load_table_metadata()
                     continue;
                 }
 
+                // Snapshot tables_ keys so we can roll back C++ state on failure
+                std::vector<Oid> tables_before;
+                tables_before.reserve(tables_.size());
+                for (const auto& [oid, _] : tables_) {
+                    tables_before.push_back(oid);
+                }
+
                 MemoryContext saved_context = CurrentMemoryContext;
                 ResourceOwner saved_owner = CurrentResourceOwner;
                 BeginInternalSubTransaction(nullptr);
                 PG_TRY();
                 {
                     set_catalog_only_create(true);
-                    pg::utils::spi_connector connector;
+                    SPI_connect();
                     bool pushed_snapshot = false;
                     if (!ActiveSnapshotSet()) {
                         PushActiveSnapshot(GetTransactionSnapshot());
                         pushed_snapshot = true;
                     }
+                    // Restore the original search_path so unqualified names resolve correctly
+                    std::string saved_search_path;
+                    if (!entry.search_path.empty()) {
+                        const char* current_sp = GetConfigOption("search_path", true, false);
+                        if (current_sp != nullptr) {
+                            saved_search_path = current_sp;
+                        }
+                        StringInfoData sp_sql;
+                        initStringInfo(&sp_sql);
+                        appendStringInfo(&sp_sql,
+                                         "SELECT pg_catalog.set_config('search_path', %s, true)",
+                                         quote_literal_cstr(entry.search_path.c_str()));
+                        SPI_execute(sp_sql.data, true, 0);
+                        pfree(sp_sql.data);
+                    }
                     SPI_execute(entry.ddl_sql.c_str(), false, 0);
+                    // Restore the session's original search_path
+                    if (!entry.search_path.empty()) {
+                        StringInfoData restore_sql;
+                        initStringInfo(&restore_sql);
+                        appendStringInfo(&restore_sql,
+                                         "SELECT pg_catalog.set_config('search_path', %s, true)",
+                                         quote_literal_cstr(saved_search_path.c_str()));
+                        SPI_execute(restore_sql.data, true, 0);
+                        pfree(restore_sql.data);
+                    }
                     if (pushed_snapshot) {
                         PopActiveSnapshot();
                     }
+                    SPI_finish();
                     set_catalog_only_create(false);
                     ReleaseCurrentSubTransaction();
                 }
                 PG_CATCH();
                 {
                     set_catalog_only_create(false);
                     MemoryContextSwitchTo(saved_context);
+                    ErrorData* edata = CopyErrorData();
                     CurrentResourceOwner = saved_owner;
                     RollbackAndReleaseCurrentSubTransaction();
                     FlushErrorState();
-                    elog(WARNING, "pg_deeplake: DDL WAL replay failed (seq=%ld, tag=%s): %.200s",
-                         entry.seq, entry.command_tag.c_str(), entry.ddl_sql.c_str());
+
+                    // Remove any tables_ entries added during the failed replay,
+                    // since the subtransaction rollback undid the catalog changes
+                    // but the C++ map entries persist.
+                    std::unordered_set<Oid> before_set(tables_before.begin(), tables_before.end());
+                    for (auto it = tables_.begin(); it != tables_.end(); ) {
+                        if (!before_set.contains(it->first)) {
+                            it = tables_.erase(it);
+                        } else {
+                            ++it;
+                        }
+                    }
+
+                    elog(WARNING, "pg_deeplake: DDL WAL replay failed (seq=%ld, tag=%s): %s (SQL: %.200s)",
+                         entry.seq, entry.command_tag.c_str(),
+                         edata->message ? edata->message : "unknown error",
+                         entry.ddl_sql.c_str());
+                    FreeErrorData(edata);
                 }
                 PG_END_TRY();
             }
@@ -853,7 +904,6 @@ void table_storage::drop_table(const std::string& table_name)
         auto& table_data = get_table_data(table_name);
         auto creds = session_credentials::get_credentials();
 
-
         try {
             table_data.commit(); // Ensure all changes are committed
```

**File**: `postgres/Dockerfile` (modified, +0/-15)
```diff
@@ -1,7 +1,6 @@
 FROM BASE_IMAGE
 ARG VERSION=VERSION
 ARG TARGETARCH
-ARG STATELESS=false
 
 LABEL name="pg-deeplake" \
   version="${VERSION}" \
@@ -29,18 +28,4 @@ COPY ./debs/ /tmp/debs/
 COPY --chmod=444 ./LICENSE /LICENSE
 COPY ./postgres/docker-entrypoint.d/ /docker-entrypoint-initdb.d/
 RUN apt-get install --no-install-recommends -y /tmp/debs/pg-deeplake-${VERSION}_${TARGETARCH}.deb && rm -rf /tmp/debs/
-COPY ./serverless/scripts/init-deeplake-stateless.sh /tmp/init-deeplake-stateless.sh
-COPY ./serverless/config/postgresql-overrides.conf /tmp/postgresql-overrides.conf
-COPY ./serverless/scripts/health-check.sh /tmp/health-check.sh
-RUN if [ "$STATELESS" = "true" ]; then \
-      mv /tmp/init-deeplake-stateless.sh /docker-entrypoint-initdb.d/3-stateless-init.sh && \
-      chmod 755 /docker-entrypoint-initdb.d/3-stateless-init.sh && \
-      mv /tmp/postgresql-overrides.conf /etc/postgresql-overrides.conf && \
-      chmod 644 /etc/postgresql-overrides.conf && \
-      mv /tmp/health-check.sh /usr/local/bin/health-check.sh && \
-      chmod 755 /usr/local/bin/health-check.sh && \
-      mkdir -p /deeplake-data; \
-    else \
-      rm -f /tmp/init-deeplake-stateless.sh /tmp/postgresql-overrides.conf /tmp/health-check.sh; \
-    fi
 USER 999
```

---

### Incident Patch 2: `c6cf643d` (2026-02-15)
**Commit Message**: Fix SPI stack leak, error logging, and search_path during DDL WAL replay

**File**: `cpp/deeplake_pg/pg_deeplake.cpp` (modified, +2/-0)
```diff
@@ -265,6 +265,8 @@ void save_index_metadata(Oid oid)
     if (SPI_execute(buf.data, false, 0) != SPI_OK_INSERT) {
         ereport(ERROR, (errcode(ERRCODE_INTERNAL_ERROR), errmsg("Failed to save metadata")));
     }
+
+    // Cross-instance propagation is driven by DDL WAL logging in ProcessUtility.
 }
 
 void load_index_metadata()
```

**File**: `cpp/deeplake_pg/table_storage.cpp` (modified, +54/-4)
```diff
@@ -46,6 +46,7 @@ extern "C" {
 #include <icm/json.hpp>
 #include <icm/string_map.hpp>
 #include <nd/none.hpp>
+#include <unordered_set>
 
 #include <algorithm>
 #include <vector>
@@ -287,34 +288,84 @@ void table_storage::load_table_metadata()
                     continue;
                 }
 
+                // Snapshot tables_ keys so we can roll back C++ state on failure
+                std::vector<Oid> tables_before;
+                tables_before.reserve(tables_.size());
+                for (const auto& [oid, _] : tables_) {
+                    tables_before.push_back(oid);
+                }
+
                 MemoryContext saved_context = CurrentMemoryContext;
                 ResourceOwner saved_owner = CurrentResourceOwner;
                 BeginInternalSubTransaction(nullptr);
                 PG_TRY();
                 {
                     set_catalog_only_create(true);
-                    pg::utils::spi_connector connector;
+                    SPI_connect();
                     bool pushed_snapshot = false;
                     if (!ActiveSnapshotSet()) {
                         PushActiveSnapshot(GetTransactionSnapshot());
                         pushed_snapshot = true;
                     }
+                    // Restore the original search_path so unqualified names resolve correctly
+                    std::string saved_search_path;
+                    if (!entry.search_path.empty()) {
+                        const char* current_sp = GetConfigOption("search_path", true, false);
+                        if (current_sp != nullptr) {
+                            saved_search_path = current_sp;
+                        }
+                        StringInfoData sp_sql;
+                        initStringInfo(&sp_sql);
+                        appendStringInfo(&sp_sql,
+                                         "SELECT pg_catalog.set_config('search_path', %s, true)",
+                                         quote_literal_cstr(entry.search_path.c_str()));
+                        SPI_execute(sp_sql.data, true, 0);
+                        pfree(sp_sql.data);
+                    }
                     SPI_execute(entry.ddl_sql.c_str(), false, 0);
+                    // Restore the session's original search_path
+                    if (!entry.search_path.empty()) {
+                        StringInfoData restore_sql;
+                        initStringInfo(&restore_sql);
+                        appendStringInfo(&restore_sql,
+                                         "SELECT pg_catalog.set_config('search_path', %s, true)",
+                                         quote_literal_cstr(saved_search_path.c_str()));
+                        SPI_execute(restore_sql.data, true, 0);
+                        pfree(restore_sql.data);
+                    }
                     if (pushed_snapshot) {
                         PopActiveSnapshot();
                     }
+                    SPI_finish();
                     set_catalog_only_create(false);
                     ReleaseCurrentSubTransaction();
                 }
                 PG_CATCH();
                 {
                     set_catalog_only_create(false);
                     MemoryContextSwitchTo(saved_context);
+                    ErrorData* edata = CopyErrorData();
                     CurrentResourceOwner = saved_owner;
                     RollbackAndReleaseCurrentSubTransaction();
                     FlushErrorState();
-                    elog(WARNING, "pg_deeplake: DDL WAL replay failed (seq=%ld, tag=%s): %.200s",
-                         entry.seq, entry.command_tag.c_str(), entry.ddl_sql.c_str());
+
+                    // Remove any tables_ entries added during the failed replay,
+                    // since the subtransaction rollback undid the catalog changes
+                    // but the C++ map entries persist.
+                    std::unordered_set<Oid> before_set(tables_before.begin(), tables_before.end());
+                    for (auto it = tables_.begin(); it != tables_.end(); ) {
+                        if (!before_set.contains(it->first)) {
+                            it = tables_.erase(it);
+                        } else {
+                            ++it;
+                        }
+                    }
+
+                    elog(WARNING, "pg_deeplake: DDL WAL replay failed (seq=%ld, tag=%s): %s (SQL: %.200s)",
+                         entry.seq, entry.command_tag.c_str(),
+                         edata->message ? edata->message : "unknown error",
+                         entry.ddl_sql.c_str());
+                    FreeErrorData(edata);
                 }
                 PG_END_TRY();
             }
@@ -853,7 +904,6 @@ void table_storage::drop_table(const std::string& table_name)
         auto& table_data = get_table_data(table_name);
         auto creds = session_credentials::get_credentials();
 
-
         try {
             table_data.commit(); // Ensure all changes are committed
```

---

### Incident Patch 3: `12b501e8` (2026-02-14)
**Commit Message**: Merge pull request #3140 from activeloopai/drop-pg16-support

Removed 16 pg support.

**File**: `.github/workflows/pg-extension-build.yaml` (modified, +3/-4)
```diff
@@ -8,12 +8,11 @@ on:
   workflow_dispatch:
     inputs:
       pg_version:
-        description: "PostgreSQL version to build (16, 17, 18, or all)"
+        description: "PostgreSQL version to build (17, 18, or all)"
         required: false
         default: "18"
         type: choice
         options:
-          - "16"
           - "17"
           - "18"
           - all
@@ -50,8 +49,8 @@ jobs:
         id: set-versions
         run: |-
           if [ "${PG_VERSION}" == "all" ]; then
-            echo "versions=[\"16\",\"17\",\"18\"]" >> "${GITHUB_OUTPUT}"
-            echo "versions-list=16,17,18" >> "${GITHUB_OUTPUT}"
+            echo "versions=[\"17\",\"18\"]" >> "${GITHUB_OUTPUT}"
+            echo "versions-list=17,18" >> "${GITHUB_OUTPUT}"
           else
             echo "versions=[\"${PG_VERSION}\"]" >> "${GITHUB_OUTPUT}"
             echo "versions-list=${PG_VERSION}" >> "${GITHUB_OUTPUT}"
```

**File**: `cpp/CMakeLists.pg.cmake` (modified, +0/-5)
```diff
@@ -1,15 +1,10 @@
-option(BUILD_PG_16 "Build PostgreSQL 16 extension" OFF)
 option(BUILD_PG_17 "Build PostgreSQL 17 extension" OFF)
 option(BUILD_PG_18 "Build PostgreSQL 18 extension" ON)
 option(USE_DEEPLAKE_SHARED "Use shared library for deeplake_api (default: auto-detect)" OFF)
 
 set(PG_MODULE deeplake_pg)
 set(PG_VERSIONS)
 
-if(BUILD_PG_16)
-    list(APPEND PG_VERSIONS 16)
-endif()
-
 if(BUILD_PG_17)
     list(APPEND PG_VERSIONS 17)
 endif()
```

**File**: `cpp/cmake/modules/FindPostgres.cmake` (modified, +0/-3)
```diff
@@ -3,14 +3,12 @@ include(ExternalProject)
 
 # Define PostgreSQL versions
 set(postgres_versions
-    "REL_16_0"
     "REL_17_0"
     "REL_18_0"
 )
 
 # Define corresponding SHA256 checksums for each version
 set(postgres_SHA256_CHECKSUMS
-    "37851d1fdae1f2cdd1d23bf9a4598b6c2f3f6792e18bc974d78ed780a28933bf"
     "16912fe4aef3c8f297b5da1b591741f132377c8b5e1b8e896e07fdd680d6bf34"
     "b155bd4a467b401ebe61b504643492aae2d0836981aa4a5a60f8668b94eadebc"
 )
@@ -47,6 +45,5 @@ foreach(postgres_version IN LISTS postgres_versions)
     )
 endforeach()
 
-set(postgres_INSTALL_DIR_REL_16_0 ${DEFAULT_PARENT_DIR}/.ext/postgres-REL_16_0/install)
 set(postgres_INSTALL_DIR_REL_17_0 ${DEFAULT_PARENT_DIR}/.ext/postgres-REL_17_0/install)
 set(postgres_INSTALL_DIR_REL_18_0 ${DEFAULT_PARENT_DIR}/.ext/postgres-REL_18_0/install)
```

**File**: `cpp/deeplake_pg/dl_catalog.cpp` (removed, +0/-906)
```diff
@@ -1,906 +0,0 @@
-#include "dl_catalog.hpp"
-
-#include <async/promise.hpp>
-#include <codecs/compression.hpp>
-#include <deeplake_api/catalog_table.hpp>
-#include <deeplake_api/dataset.hpp>
-#include <deeplake_core/type.hpp>
-#include <nd/adapt.hpp>
-#include <nd/array.hpp>
-#include <nd/dtype.hpp>
-#include <nd/type.hpp>
-#include <icm/vector.hpp>
-
-#include <algorithm>
-#include <chrono>
-#include <unordered_map>
-
-extern "C" {
-#include <postgres.h>
-#include <utils/elog.h>
-}
-
-namespace pg::dl_catalog {
-
-namespace {
-
-constexpr const char* k_catalog_dir = "__deeplake_catalog";
-constexpr const char* k_tables_name = "tables";
-constexpr const char* k_columns_name = "columns";
-constexpr const char* k_indexes_name = "indexes";
-constexpr const char* k_meta_name = "meta";
-constexpr const char* k_schemas_name = "schemas";
-constexpr const char* k_databases_name = "databases";
-
-// Shared (cluster-wide) path: {root}/__deeplake_catalog/{name}
-std::string join_path(const std::string& root, const std::string& name)
-{
-    if (!root.empty() && root.back() == '/') {
-        return root + k_catalog_dir + "/" + name;
-    }
-    return root + "/" + k_catalog_dir + "/" + name;
-}
-
-// Per-database path: {root}/{db_name}/__deeplake_catalog/{name}
-std::string join_db_path(const std::string& root, const std::string& db_name, const std::string& name)
-{
-    std::string base = root;
-    if (!base.empty() && base.back() == '/') {
-        base.pop_back();
-    }
-    return base + "/" + db_name + "/" + k_catalog_dir + "/" + name;
-}
-
-// Cache for catalog table handles to avoid repeated S3 opens
-struct catalog_table_cache
-{
-    std::string root_path;
-    std::shared_ptr<deeplake_api::catalog_table> meta_table;
-
-    static catalog_table_cache& instance()
-    {
-        static thread_local catalog_table_cache cache;
-        return cache;
-    }
-
-    std::shared_ptr<deeplake_api::catalog_table> get_meta_table(const std::string& path, icm::string_map<> creds)
-    {
-        if (path != root_path || !meta_table) {
-            // Cache miss or path changed - open and cache
-            root_path = path;
-            const auto meta_path = join_path(path, k_meta_name);
-            meta_table = deeplake_api::open_catalog_table(meta_path, std::move(creds)).get_future().get();
-        }
-        return meta_table;
-    }
-
-    void invalidate()
-    {
-        root_path.clear();
-        meta_table.reset();
-    }
-};
-
-int64_t now_ms()
-{
-    using namespace std::chrono;
-    return duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
-}
-
-// Open a shared (cluster-wide) catalog table
-std::shared_ptr<deeplake_api::catalog_table>
-open_catalog_table(const std::string& root_path, const std::string& name, icm::string_map<> creds)
-{
-    const auto path = join_path(root_path, name);
-    return deeplake_api::open_catalog_table(path, std::move(creds)).get_future().get();
-}
-
-// Open a per-database catalog table
-std::shared_ptr<deeplake_api::catalog_table>
-open_db_catalog_table(const std::string& root_path, const std::string& db_name, const std::string& name, icm::string_map<> creds)
-{
-    const auto path = join_db_path(root_path, db_name, name);
-    return deeplake_api::open_catalog_table(path, std::move(creds)).get_future().get();
-}
-
-template <typename T>
-std::vector<T> load_vector(const nd::array& arr)
-{
-    std::vector<T> out;
-    out.reserve(static_cast<size_t>(arr.volume()));
-    for (int64_t i = 0; i < arr.volume(); ++i) {
-        out.push_back(arr.value<T>(i));
-    }
-    return out;
-}
-
-std::vector<int64_t> load_int64_vector(const nd::array& arr)
-{
-    std::vector<int64_t> out;
-    out.reserve(static_cast<size_t>(arr.volume()));
-    bool is_numeric = false;
-    try {
-        is_numeric = nd::dtype_is_numeric(arr.dtype());
-    } catch (...) {
-        is_numeric = false;
-    }
-    if (is_numeric) {
-        try {
-            for (int64_t i = 0; i < arr.volume(); ++i) {
-                out.push_back(arr.value<int64_t>(i));
-            }
-            return out;
-        } catch (...) {
-            out.clear();
-        }
-    }
-    for (int64_t i = 0; i < arr.volume(); ++i) {
-        auto v = arr.value<std::string_view>(i);
-        try {
-            out.push_back(std::stoll(std::string(v)));
-        } catch (...) {
-            out.push_back(0);
-        }
-    }
-    return out;
-}
-
-// Build the tables schema (shared between ensure_db_catalog and schema definitions)
-deeplake_api::catalog_table_schema make_tables_schema()
-{
-    deeplake_api::catalog_table_schema schema;
-    schema.add("table_id", deeplake_core::type::text(codecs::compression::null))
-        .add("schema_name", deeplake_core::type::text(codecs::compression::null))
-        .add("table_name", deeplake_core::type::text(codecs::compression::null))
-        .add("dataset_path", deeplake_core::type::text(codecs::compression::null))
-        .add("state", deeplake_
```

**File**: `cpp/deeplake_pg/dl_catalog.hpp` (removed, +0/-103)
```diff
@@ -1,103 +0,0 @@
-#pragma once
-
-#include <icm/string_map.hpp>
-
-#include <cstdint>
-#include <memory>
-#include <string>
-#include <vector>
-
-namespace deeplake_api { class catalog_table; }
-
-namespace pg::dl_catalog {
-
-struct table_meta
-{
-    std::string table_id;
-    std::string schema_name;
-    std::string table_name;
-    std::string dataset_path;
-    std::string state;
-    std::string db_name;
-    int64_t updated_at = 0;
-};
-
-struct column_meta
-{
-    std::string table_id;
-    std::string column_name;
-    std::string pg_type;
-    std::string dl_type_json;
-    bool nullable = true;
-    int32_t position = 0;
-};
-
-struct index_meta
-{
-    std::string table_id;
-    std::string column_names;
-    std::string index_type;
-    int32_t order_type = 0;
-};
-
-struct schema_meta
-{
-    std::string schema_name;   // PK
-    std::string owner;
-    std::string state;         // "ready" or "dropping"
-    int64_t updated_at = 0;
-};
-
-struct database_meta
-{
-    std::string db_name;       // PK
-    std::string owner;
-    std::string encoding;
-    std::string lc_collate;
-    std::string lc_ctype;
-    std::string template_db;
-    std::string state;         // "ready" or "dropping"
-    int64_t updated_at = 0;
-};
-
-// Shared (cluster-wide) catalog: meta + databases
-int64_t ensure_catalog(const std::string& root_path, icm::string_map<> creds);
-
-// Per-database catalog: tables + columns + indexes + meta
-int64_t ensure_db_catalog(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
-
-// Per-database loaders (read from {root}/{db_name}/__deeplake_catalog/)
-std::vector<table_meta> load_tables(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
-std::vector<column_meta> load_columns(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
-std::vector<index_meta> load_indexes(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
-
-// Load tables and columns in parallel for better performance
-std::pair<std::vector<table_meta>, std::vector<column_meta>>
-load_tables_and_columns(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
-
-// Per-database schema catalog
-std::vector<schema_meta> load_schemas(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
-void upsert_schema(const std::string& root_path, const std::string& db_name, icm::string_map<> creds, const schema_meta& meta);
-
-// Per-database upserts (write to {root}/{db_name}/__deeplake_catalog/)
-void upsert_table(const std::string& root_path, const std::string& db_name, icm::string_map<> creds, const table_meta& meta);
-void upsert_columns(const std::string& root_path, const std::string& db_name, icm::string_map<> creds, const std::vector<column_meta>& columns);
-void upsert_indexes(const std::string& root_path, const std::string& db_name, icm::string_map<> creds, const std::vector<index_meta>& indexes);
-
-// Shared (cluster-wide) database catalog
-std::vector<database_meta> load_databases(const std::string& root_path, icm::string_map<> creds);
-void upsert_database(const std::string& root_path, icm::string_map<> creds, const database_meta& meta);
-
-// Global (shared) catalog version
-int64_t get_catalog_version(const std::string& root_path, icm::string_map<> creds);
-void bump_catalog_version(const std::string& root_path, icm::string_map<> creds);
-
-// Per-database catalog version
-int64_t get_db_catalog_version(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
-void bump_db_catalog_version(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
-
-// Open the per-database meta table handle (for parallel .version() calls in sync worker)
-std::shared_ptr<deeplake_api::catalog_table>
-open_db_meta_table(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
-
-} // namespace pg::dl_catalog
```

**File**: `cpp/deeplake_pg/dl_wal.cpp` (added, +416/-0)
```diff
@@ -0,0 +1,416 @@
+#include "dl_wal.hpp"
+
+#include <codecs/compression.hpp>
+#include <deeplake_api/catalog_table.hpp>
+#include <deeplake_api/dataset.hpp>
+#include <deeplake_core/type.hpp>
+#include <nd/adapt.hpp>
+#include <nd/array.hpp>
+#include <nd/dtype.hpp>
+#include <nd/type.hpp>
+
+#include <algorithm>
+#include <chrono>
+#include <unordered_map>
+#include <unistd.h>
+
+extern "C" {
+#include <postgres.h>
+#include <miscadmin.h>
+#include <utils/elog.h>
+#include <utils/guc.h>
+}
+
+namespace pg::dl_wal {
+
+namespace {
+
+constexpr const char* k_catalog_dir = "__deeplake_catalog";
+constexpr const char* k_databases_name = "databases";
+constexpr const char* k_ddl_log_name = "__wal_table";
+
+// Shared (cluster-wide) path: {root}/__deeplake_catalog/{name}
+std::string join_path(const std::string& root, const std::string& name)
+{
+    if (!root.empty() && root.back() == '/') {
+        return root + k_catalog_dir + "/" + name;
+    }
+    return root + "/" + k_catalog_dir + "/" + name;
+}
+
+// Per-database path: {root}/{db_name}/__deeplake_catalog/{name}
+std::string join_db_path(const std::string& root, const std::string& db_name, const std::string& name)
+{
+    std::string base = root;
+    if (!base.empty() && base.back() == '/') {
+        base.pop_back();
+    }
+    return base + "/" + db_name + "/" + k_catalog_dir + "/" + name;
+}
+
+int64_t now_ms()
+{
+    using namespace std::chrono;
+    return duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
+}
+
+// Open a shared (cluster-wide) catalog table
+std::shared_ptr<deeplake_api::catalog_table>
+open_catalog_table(const std::string& root_path, const std::string& name, icm::string_map<> creds)
+{
+    const auto path = join_path(root_path, name);
+    return deeplake_api::open_catalog_table(path, std::move(creds)).get_future().get();
+}
+
+// Create the WAL dataset with schema. Called once from ensure_db_catalog.
+void create_ddl_dataset(const std::string& root_path, const std::string& db_name, icm::string_map<> creds)
+{
+    const auto path = join_db_path(root_path, db_name, k_ddl_log_name);
+    bool exists = false;
+    try {
+        exists = deeplake_api::exists(path, icm::string_map<>(creds)).get_future().get();
+    } catch (...) {
+        exists = false;
+    }
+    if (exists) {
+        return;
+    }
+
+    auto ds = deeplake_api::create(path, std::move(creds)).get_future().get();
+    ds->add_column("seq", deeplake_core::type::generic(nd::type::scalar(nd::dtype::int64)));
+    ds->add_column("origin_instance_id", deeplake_core::type::text(codecs::compression::null));
+    ds->add_column("search_path", deeplake_core::type::text(codecs::compression::null));
+    ds->add_column("command_tag", deeplake_core::type::text(codecs::compression::null));
+    ds->add_column("object_identity", deeplake_core::type::text(codecs::compression::null));
+    ds->add_column("ddl_sql", deeplake_core::type::text(codecs::compression::null));
+    ds->add_column("timestamp", deeplake_core::type::generic(nd::type::scalar(nd::dtype::int64)));
+    ds->commit().get_future().get();
+}
+
+// Thread-local cached WAL dataset handle for append (hot path).
+struct ddl_dataset_cache
+{
+    std::string key; // root_path + "\t" + db_name
+    std::shared_ptr<deeplake_api::dataset> ds;
+
+    static ddl_dataset_cache& instance()
+    {
+        static thread_local ddl_dataset_cache cache;
+        return cache;
+    }
+
+    std::shared_ptr<deeplake_api::dataset> get(const std::string& root_path, const std::string& db_name, icm::string_map<> creds)
+    {
+        const auto k = root_path + "\t" + db_name;
+        if (k == key && ds) {
+            return ds;
+        }
+        const auto path = join_db_path(root_path, db_name, k_ddl_log_name);
+        ds = deeplake_api::open(path, std::move(creds)).get_future().get();
+        key = k;
+        return ds;
+    }
+
+    void invalidate()
+    {
+        key.clear();
+        ds.reset();
+    }
+};
+
+std::vector<int64_t> load_int64_vector(const nd::array& arr)
+{
+    std::vector<int64_t> out;
+    out.reserve(static_cast<size_t>(arr.volume()));
+    bool is_numeric = false;
+    try {
+        is_numeric = nd::dtype_is_numeric(arr.dtype());
+    } catch (...) {
+        is_numeric = false;
+    }
+    if (is_numeric) {
+        try {
+            for (int64_t i = 0; i < arr.volume(); ++i) {
+                out.push_back(arr.value<int64_t>(i));
+            }
+            return out;
+        } catch (...) {
+            out.clear();
+        }
+    }
+    for (int64_t i = 0; i < arr.volume(); ++i) {
+        auto v = arr.value<std::string_view>(i);
+        try {
+            out.push_back(std::stoll(std::string(v)));
+        } catch (...) {
+            out.push_back(0);
+        }
+    }
+    return out;
+}
+
+deeplake_api::catalog_table_schema make_databases_schema()
+{
+    deeplake_api::catalog_table_schema schema;
+    schema.add("db_name", deeplake_core::type::text(code
```

**File**: `cpp/deeplake_pg/dl_wal.hpp` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+#pragma once
+
+#include <icm/string_map.hpp>
+
+#include <cstdint>
+#include <memory>
+#include <string>
+#include <vector>
+
+namespace deeplake_api {
+class dataset;
+}
+
+namespace pg::dl_wal {
+
+struct database_meta
+{
+    std::string db_name;       // PK
+    std::string owner;
+    std::string encoding;
+    std::string lc_collate;
+    std::string lc_ctype;
+    std::string template_db;
+    std::string state;         // "ready" or "dropping"
+    int64_t updated_at = 0;
+};
+
+struct ddl_log_entry
+{
+    int64_t seq = 0;               // Primary key
+    std::string origin_instance_id;
+    std::string search_path;
+    std::string command_tag;
+    std::string object_identity;
+    std::string ddl_sql;
+    int64_t timestamp = 0;
+};
+
+// Shared (cluster-wide) catalog: databases catalog_table
+void ensure_catalog(const std::string& root_path, icm::string_map<> creds);
+
+// Per-database catalog: __wal_table dataset
+void ensure_db_catalog(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
+
+// Shared (cluster-wide) database catalog
+std::vector<database_meta> load_databases(const std::string& root_path, icm::string_map<> creds);
+void upsert_database(const std::string& root_path, icm::string_map<> creds, const database_meta& meta);
+
+// Global version check via databases catalog_table
+int64_t get_databases_version(const std::string& root_path, icm::string_map<> creds);
+
+std::shared_ptr<deeplake_api::dataset>
+open_ddl_log_table(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
+
+void append_ddl_log(const std::string& root_path, const std::string& db_name, icm::string_map<> creds,
+                    const ddl_log_entry& entry);
+
+std::vector<ddl_log_entry> load_ddl_log(const std::string& root_path, const std::string& db_name,
+                                        icm::string_map<> creds, int64_t after_seq = 0);
+
+int64_t next_ddl_seq();
+
+// Unique identifier for this PostgreSQL instance: "hostname:port:datadir"
+std::string local_instance_id();
+
+} // namespace pg::dl_wal
```

**File**: `cpp/deeplake_pg/extension_init.cpp` (modified, +118/-87)
```diff
@@ -11,6 +11,7 @@ extern "C" {
 #include <catalog/namespace.h>
 #include <commands/dbcommands.h>
 #include <commands/defrem.h>
+#include <commands/extension.h>
 #include <miscadmin.h>
 #include <commands/vacuum.h>
 #include <nodes/nodeFuncs.h>
@@ -27,7 +28,7 @@ extern "C" {
 
 #include "column_statistics.hpp"
 #include "deeplake_executor.hpp"
-#include "dl_catalog.hpp"
+#include "dl_wal.hpp"
 #include "pg_deeplake.hpp"
 #include "pg_version_compat.h"
 #include "sync_worker.hpp"
@@ -44,6 +45,7 @@ extern "C" {
 #include <climits>
 #include <cmath>
 #include <cstdint>
+#include <unistd.h>
 #include <map>
 #include <memory>
 #include <numeric>
@@ -72,6 +74,58 @@ bool stateless_enabled = false;      // Enable stateless catalog sync across ins
 
 namespace {
 
+bool is_ddl_log_suppressed()
+{
+    if (pg::table_storage::is_catalog_only_create()) {
+        return true;
+    }
+    if (creating_extension) {
+        return true;
+    }
+    const char* app_name = GetConfigOption("application_name", true, false);
+    return app_name && strcmp(app_name, "pg_deeplake_sync") == 0;
+}
+
+void append_to_ddl_log_if_needed(const char* command_tag, const char* object_identity, const char* query_string)
+{
+    if (!pg::stateless_enabled || is_ddl_log_suppressed()) {
+        return;
+    }
+    if (query_string == nullptr || query_string[0] == '\0') {
+        return;
+    }
+
+    auto root_path = pg::session_credentials::get_root_path();
+    if (root_path.empty()) {
+        root_path = pg::utils::get_deeplake_root_directory();
+    }
+    if (root_path.empty()) {
+        return;
+    }
+
+    try {
+        auto creds = pg::session_credentials::get_credentials();
+        const char* dbname = get_database_name(MyDatabaseId);
+        std::string db_name = dbname ? dbname : "postgres";
+        if (dbname) {
+            pfree(const_cast<char*>(dbname));
+        }
+
+        pg::dl_wal::ddl_log_entry entry;
+        entry.seq = pg::dl_wal::next_ddl_seq();
+        entry.origin_instance_id = pg::dl_wal::local_instance_id();
+        const char* current_search_path = GetConfigOption("search_path", true, false);
+        entry.search_path = current_search_path != nullptr ? current_search_path : "";
+        entry.command_tag = command_tag != nullptr ? command_tag : "";
+        entry.object_identity = object_identity != nullptr ? object_identity : "";
+        entry.ddl_sql = query_string;
+
+        pg::dl_wal::append_ddl_log(root_path, db_name, creds, entry);
+    } catch (const std::exception& e) {
+        elog(WARNING, "pg_deeplake: failed to append DDL to WAL log: %s", e.what());
+    }
+}
+
 bool is_count_star(TargetEntry* node)
 {
     if (node == nullptr || node->expr == nullptr || !IsA(node->expr, Aggref)) {
@@ -589,34 +643,6 @@ static void process_utility(PlannedStmt* pstmt,
                     }
                 }
 
-                // Mark schema as "dropping" in the S3 catalog
-                if (pg::stateless_enabled) {
-                    try {
-                        auto root_path = pg::session_credentials::get_root_path();
-                        if (root_path.empty()) {
-                            root_path = pg::utils::get_deeplake_root_directory();
-                        }
-                        if (!root_path.empty()) {
-                            auto creds = pg::session_credentials::get_credentials();
-                            const char* dbname = get_database_name(MyDatabaseId);
-                            std::string db_name = dbname ? dbname : "postgres";
-                            if (dbname) pfree(const_cast<char*>(dbname));
-
-                            pg::dl_catalog::ensure_catalog(root_path, creds);
-                            pg::dl_catalog::ensure_db_catalog(root_path, db_name, creds);
-
-                            pg::dl_catalog::schema_meta s_meta;
-                            s_meta.schema_name = schema_name;
-                            s_meta.state = "dropping";
-                            pg::dl_catalog::upsert_schema(root_path, db_name, creds, s_meta);
-
-                            pg::dl_catalog::bump_db_catalog_version(root_path, db_name, pg::session_credentials::get_credentials());
-                            pg::dl_catalog::bump_catalog_version(root_path, pg::session_credentials::get_credentials());
-                        }
-                    } catch (const std::exception& e) {
-                        elog(WARNING, "pg_deeplake: failed to mark schema '%s' as dropping in catalog: %s", schema_name, e.what());
-                    }
-                }
             }
         } else if (stmt->removeType == OBJECT_DATABASE) {
             const char* query = "SELECT nspname, relname "
@@ -722,12 +748,11 @@ static void process_utility(PlannedStmt* pstmt,
             }
             if (!root_path.empty()) {
                 auto creds = pg::session_credentials::get_credentials();
-                pg::dl_catalog::ensure_catalog(root_path, creds);
-     
```

---

### Incident Patch 4: `63ecadf7` (2026-02-14)
**Commit Message**: Merge pull request #3139 from activeloopai/stateless-extension

Stateless sync. Per db tables, indexes, schemas.

**File**: `cpp/deeplake_pg/dl_catalog.cpp` (modified, +357/-81)
```diff
@@ -29,8 +29,10 @@ constexpr const char* k_tables_name = "tables";
 constexpr const char* k_columns_name = "columns";
 constexpr const char* k_indexes_name = "indexes";
 constexpr const char* k_meta_name = "meta";
+constexpr const char* k_schemas_name = "schemas";
 constexpr const char* k_databases_name = "databases";
 
+// Shared (cluster-wide) path: {root}/__deeplake_catalog/{name}
 std::string join_path(const std::string& root, const std::string& name)
 {
     if (!root.empty() && root.back() == '/') {
@@ -39,6 +41,16 @@ std::string join_path(const std::string& root, const std::string& name)
     return root + "/" + k_catalog_dir + "/" + name;
 }
 
+// Per-database path: {root}/{db_name}/__deeplake_catalog/{name}
+std::string join_db_path(const std::string& root, const std::string& db_name, const std::string& name)
+{
+    std::string base = root;
+    if (!base.empty() && base.back() == '/') {
+        base.pop_back();
+    }
+    return base + "/" + db_name + "/" + k_catalog_dir + "/" + name;
+}
+
 // Cache for catalog table handles to avoid repeated S3 opens
 struct catalog_table_cache
 {
@@ -75,13 +87,22 @@ int64_t now_ms()
     return duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
 }
 
+// Open a shared (cluster-wide) catalog table
 std::shared_ptr<deeplake_api::catalog_table>
 open_catalog_table(const std::string& root_path, const std::string& name, icm::string_map<> creds)
 {
     const auto path = join_path(root_path, name);
     return deeplake_api::open_catalog_table(path, std::move(creds)).get_future().get();
 }
 
+// Open a per-database catalog table
+std::shared_ptr<deeplake_api::catalog_table>
+open_db_catalog_table(const std::string& root_path, const std::string& db_name, const std::string& name, icm::string_map<> creds)
+{
+    const auto path = join_db_path(root_path, db_name, name);
+    return deeplake_api::open_catalog_table(path, std::move(creds)).get_future().get();
+}
+
 template <typename T>
 std::vector<T> load_vector(const nd::array& arr)
 {
@@ -124,88 +145,174 @@ std::vector<int64_t> load_int64_vector(const nd::array& arr)
     return out;
 }
 
+// Build the tables schema (shared between ensure_db_catalog and schema definitions)
+deeplake_api::catalog_table_schema make_tables_schema()
+{
+    deeplake_api::catalog_table_schema schema;
+    schema.add("table_id", deeplake_core::type::text(codecs::compression::null))
+        .add("schema_name", deeplake_core::type::text(codecs::compression::null))
+        .add("table_name", deeplake_core::type::text(codecs::compression::null))
+        .add("dataset_path", deeplake_core::type::text(codecs::compression::null))
+        .add("state", deeplake_core::type::text(codecs::compression::null))
+        .add("db_name", deeplake_core::type::text(codecs::compression::null))
+        .add("updated_at", deeplake_core::type::generic(nd::type::scalar(nd::dtype::int64)))
+        .set_primary_key("table_id");
+    return schema;
+}
+
+deeplake_api::catalog_table_schema make_columns_schema()
+{
+    deeplake_api::catalog_table_schema schema;
+    schema.add("column_id", deeplake_core::type::text(codecs::compression::null))
+        .add("table_id", deeplake_core::type::text(codecs::compression::null))
+        .add("column_name", deeplake_core::type::text(codecs::compression::null))
+        .add("pg_type", deeplake_core::type::text(codecs::compression::null))
+        .add("dl_type_json", deeplake_core::type::text(codecs::compression::null))
+        .add("nullable", deeplake_core::type::generic(nd::type::scalar(nd::dtype::boolean)))
+        .add("position", deeplake_core::type::generic(nd::type::scalar(nd::dtype::int32)))
+        .set_primary_key("column_id");
+    return schema;
+}
+
+deeplake_api::catalog_table_schema make_indexes_schema()
+{
+    deeplake_api::catalog_table_schema schema;
+    schema.add("table_id", deeplake_core::type::text(codecs::compression::null))
+        .add("column_names", deeplake_core::type::text(codecs::compression::null))
+        .add("index_type", deeplake_core::type::text(codecs::compression::null))
+        .add("order_type", deeplake_core::type::generic(nd::type::scalar(nd::dtype::int32)))
+        .set_primary_key("table_id");
+    return schema;
+}
+
+deeplake_api::catalog_table_schema make_schemas_schema()
+{
+    deeplake_api::catalog_table_schema schema;
+    schema.add("schema_name", deeplake_core::type::text(codecs::compression::null))
+        .add("owner", deeplake_core::type::text(codecs::compression::null))
+        .add("state", deeplake_core::type::text(codecs::compression::null))
+        .add("updated_at", deeplake_core::type::generic(nd::type::scalar(nd::dtype::int64)))
+        .set_primary_key("schema_name");
+    return schema;
+}
+
+deeplake_api::catalog_table_schema make_meta_schema()
+{
+    deeplake_api::catalog_table_schema schema;
+    schema.add("catalog_version", deeplake_core::type::generic(nd::type::scalar(nd::dtype::int64)))
+        .add("updat
```

**File**: `cpp/deeplake_pg/dl_catalog.hpp` (modified, +39/-6)
```diff
@@ -3,9 +3,12 @@
 #include <icm/string_map.hpp>
 
 #include <cstdint>
+#include <memory>
 #include <string>
 #include <vector>
 
+namespace deeplake_api { class catalog_table; }
+
 namespace pg::dl_catalog {
 
 struct table_meta
@@ -15,6 +18,7 @@ struct table_meta
     std::string table_name;
     std::string dataset_path;
     std::string state;
+    std::string db_name;
     int64_t updated_at = 0;
 };
 
@@ -36,6 +40,14 @@ struct index_meta
     int32_t order_type = 0;
 };
 
+struct schema_meta
+{
+    std::string schema_name;   // PK
+    std::string owner;
+    std::string state;         // "ready" or "dropping"
+    int64_t updated_at = 0;
+};
+
 struct database_meta
 {
     std::string db_name;       // PK
@@ -48,23 +60,44 @@ struct database_meta
     int64_t updated_at = 0;
 };
 
+// Shared (cluster-wide) catalog: meta + databases
 int64_t ensure_catalog(const std::string& root_path, icm::string_map<> creds);
 
-std::vector<table_meta> load_tables(const std::string& root_path, icm::string_map<> creds);
-std::vector<column_meta> load_columns(const std::string& root_path, icm::string_map<> creds);
-std::vector<index_meta> load_indexes(const std::string& root_path, icm::string_map<> creds);
+// Per-database catalog: tables + columns + indexes + meta
+int64_t ensure_db_catalog(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
+
+// Per-database loaders (read from {root}/{db_name}/__deeplake_catalog/)
+std::vector<table_meta> load_tables(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
+std::vector<column_meta> load_columns(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
+std::vector<index_meta> load_indexes(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
 
 // Load tables and columns in parallel for better performance
 std::pair<std::vector<table_meta>, std::vector<column_meta>>
-load_tables_and_columns(const std::string& root_path, icm::string_map<> creds);
+load_tables_and_columns(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
+
+// Per-database schema catalog
+std::vector<schema_meta> load_schemas(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
+void upsert_schema(const std::string& root_path, const std::string& db_name, icm::string_map<> creds, const schema_meta& meta);
 
-void upsert_table(const std::string& root_path, icm::string_map<> creds, const table_meta& meta);
-void upsert_columns(const std::string& root_path, icm::string_map<> creds, const std::vector<column_meta>& columns);
+// Per-database upserts (write to {root}/{db_name}/__deeplake_catalog/)
+void upsert_table(const std::string& root_path, const std::string& db_name, icm::string_map<> creds, const table_meta& meta);
+void upsert_columns(const std::string& root_path, const std::string& db_name, icm::string_map<> creds, const std::vector<column_meta>& columns);
+void upsert_indexes(const std::string& root_path, const std::string& db_name, icm::string_map<> creds, const std::vector<index_meta>& indexes);
 
+// Shared (cluster-wide) database catalog
 std::vector<database_meta> load_databases(const std::string& root_path, icm::string_map<> creds);
 void upsert_database(const std::string& root_path, icm::string_map<> creds, const database_meta& meta);
 
+// Global (shared) catalog version
 int64_t get_catalog_version(const std::string& root_path, icm::string_map<> creds);
 void bump_catalog_version(const std::string& root_path, icm::string_map<> creds);
 
+// Per-database catalog version
+int64_t get_db_catalog_version(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
+void bump_db_catalog_version(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
+
+// Open the per-database meta table handle (for parallel .version() calls in sync worker)
+std::shared_ptr<deeplake_api::catalog_table>
+open_db_meta_table(const std::string& root_path, const std::string& db_name, icm::string_map<> creds);
+
 } // namespace pg::dl_catalog
```

**File**: `cpp/deeplake_pg/extension_init.cpp` (modified, +67/-0)
```diff
@@ -9,7 +9,9 @@ extern "C" {
 #include <postgres.h>
 
 #include <catalog/namespace.h>
+#include <commands/dbcommands.h>
 #include <commands/defrem.h>
+#include <miscadmin.h>
 #include <commands/vacuum.h>
 #include <nodes/nodeFuncs.h>
 #include <optimizer/planner.h>
@@ -586,6 +588,35 @@ static void process_utility(PlannedStmt* pstmt,
                         }
                     }
                 }
+
+                // Mark schema as "dropping" in the S3 catalog
+                if (pg::stateless_enabled) {
+                    try {
+                        auto root_path = pg::session_credentials::get_root_path();
+                        if (root_path.empty()) {
+                            root_path = pg::utils::get_deeplake_root_directory();
+                        }
+                        if (!root_path.empty()) {
+                            auto creds = pg::session_credentials::get_credentials();
+                            const char* dbname = get_database_name(MyDatabaseId);
+                            std::string db_name = dbname ? dbname : "postgres";
+                            if (dbname) pfree(const_cast<char*>(dbname));
+
+                            pg::dl_catalog::ensure_catalog(root_path, creds);
+                            pg::dl_catalog::ensure_db_catalog(root_path, db_name, creds);
+
+                            pg::dl_catalog::schema_meta s_meta;
+                            s_meta.schema_name = schema_name;
+                            s_meta.state = "dropping";
+                            pg::dl_catalog::upsert_schema(root_path, db_name, creds, s_meta);
+
+                            pg::dl_catalog::bump_db_catalog_version(root_path, db_name, pg::session_credentials::get_credentials());
+                            pg::dl_catalog::bump_catalog_version(root_path, pg::session_credentials::get_credentials());
+                        }
+                    } catch (const std::exception& e) {
+                        elog(WARNING, "pg_deeplake: failed to mark schema '%s' as dropping in catalog: %s", schema_name, e.what());
+                    }
+                }
             }
         } else if (stmt->removeType == OBJECT_DATABASE) {
             const char* query = "SELECT nspname, relname "
@@ -691,6 +722,7 @@ static void process_utility(PlannedStmt* pstmt,
             }
             if (!root_path.empty()) {
                 auto creds = pg::session_credentials::get_credentials();
+                pg::dl_catalog::ensure_catalog(root_path, creds);
                 pg::dl_catalog::database_meta db_meta;
                 db_meta.db_name = dbstmt->dbname;
                 db_meta.state = "dropping";
@@ -727,6 +759,7 @@ static void process_utility(PlannedStmt* pstmt,
                 }
                 if (!root_path.empty()) {
                     auto creds = pg::session_credentials::get_credentials();
+                    pg::dl_catalog::ensure_catalog(root_path, creds);
                     pg::dl_catalog::database_meta db_meta;
                     db_meta.db_name = dbstmt->dbname;
                     db_meta.state = "ready";
@@ -758,6 +791,40 @@ static void process_utility(PlannedStmt* pstmt,
         }
     }
 
+    // Post-hook: record CREATE SCHEMA in S3 catalog for multi-instance sync
+    if (IsA(pstmt->utilityStmt, CreateSchemaStmt) && pg::stateless_enabled) {
+        CreateSchemaStmt* schemastmt = (CreateSchemaStmt*)pstmt->utilityStmt;
+        try {
+            auto root_path = pg::session_credentials::get_root_path();
+            if (root_path.empty()) {
+                root_path = pg::utils::get_deeplake_root_directory();
+            }
+            if (!root_path.empty() && schemastmt->schemaname != nullptr) {
+                auto creds = pg::session_credentials::get_credentials();
+                const char* dbname = get_database_name(MyDatabaseId);
+                std::string db_name = dbname ? dbname : "postgres";
+                if (dbname) pfree(const_cast<char*>(dbname));
+
+                pg::dl_catalog::ensure_catalog(root_path, creds);
+                pg::dl_catalog::ensure_db_catalog(root_path, db_name, creds);
+
+                pg::dl_catalog::schema_meta s_meta;
+                s_meta.schema_name = schemastmt->schemaname;
+                s_meta.state = "ready";
+                if (schemastmt->authrole != nullptr) {
+                    s_meta.owner = schemastmt->authrole->rolename;
+                }
+                pg::dl_catalog::upsert_schema(root_path, db_name, creds, s_meta);
+
+                pg::dl_catalog::bump_db_catalog_version(root_path, db_name, pg::session_credentials::get_credentials());
+                pg::dl_catalog::bump_catalog_version(root_path, pg::session_credentials::get_credentials());
+                elog(DEBUG1, "pg_deeplake: recorded CREATE SCHEMA '%s' in catalog", schemastmt->schemaname);
+            }
+        } catch (const std::exception& e) {
+            elog(DEBUG1, "pg_deeplake: failed to rec
```

**File**: `cpp/deeplake_pg/logger.hpp` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ class logger_adapter : public base::logger_adapter
             elog(DEBUG1, "%s", message.c_str());
             break;
         case base::log_level::info:
-            elog(INFO, "%s", message.c_str());
+            elog(LOG, "%s", message.c_str());
             break;
         case base::log_level::warning:
             elog(WARNING, "%s", message.c_str());
```

**File**: `cpp/deeplake_pg/pg_deeplake.cpp` (modified, +39/-0)
```diff
@@ -1,6 +1,8 @@
 #include "pg_deeplake.hpp"
+#include "dl_catalog.hpp"
 #include "logger.hpp"
 #include "table_storage.hpp"
+#include "utils.hpp"
 
 #include <deeplake_api/deeplake_api.hpp>
 #include <deeplake_core/deeplake_index_type.hpp>
@@ -9,6 +11,8 @@
 extern "C" {
 #endif
 
+#include <commands/dbcommands.h>
+#include <miscadmin.h>
 #include <storage/ipc.h>
 
 #ifdef __cplusplus
@@ -260,6 +264,41 @@ void save_index_metadata(Oid oid)
     if (SPI_execute(buf.data, false, 0) != SPI_OK_INSERT) {
         ereport(ERROR, (errcode(ERRCODE_INTERNAL_ERROR), errmsg("Failed to save metadata")));
     }
+
+    // Persist index to shared catalog for stateless multi-instance sync.
+    // Skip when in catalog-only mode — the table was synced FROM the catalog,
+    // so writing back would be redundant and cause version bump loops.
+    if (pg::stateless_enabled && !pg::table_storage::is_catalog_only_create()) {
+        try {
+            auto root_dir = pg::session_credentials::get_root_path();
+            if (root_dir.empty()) {
+                root_dir = pg::utils::get_deeplake_root_directory();
+            }
+            if (!root_dir.empty()) {
+                auto creds = pg::session_credentials::get_credentials();
+                const char* dbname = get_database_name(MyDatabaseId);
+                std::string db_name = dbname ? dbname : "postgres";
+                if (dbname) pfree(const_cast<char*>(dbname));
+
+                const std::string& table_id = idx_info.table_name(); // already schema-qualified
+
+                pg::dl_catalog::index_meta idx_meta;
+                idx_meta.table_id = table_id;
+                idx_meta.column_names = idx_info.get_column_names_string();
+                idx_meta.index_type = std::string(deeplake_core::deeplake_index_type::to_string(idx_info.index_type()));
+                idx_meta.order_type = static_cast<int32_t>(idx_info.order_type());
+
+                std::vector<pg::dl_catalog::index_meta> indexes = {idx_meta};
+                pg::dl_catalog::upsert_indexes(root_dir, db_name, creds, indexes);
+                pg::dl_catalog::bump_db_catalog_version(root_dir, db_name, creds);
+                pg::dl_catalog::bump_catalog_version(root_dir, creds);
+            }
+        } catch (const std::exception& e) {
+            elog(DEBUG1, "pg_deeplake: failed to persist index to shared catalog: %s", e.what());
+        } catch (...) {
+            elog(DEBUG1, "pg_deeplake: failed to persist index to shared catalog: unknown error");
+        }
+    }
 }
 
 void load_index_metadata()
```

**File**: `cpp/deeplake_pg/sync_worker.cpp` (modified, +233/-97)
```diff
@@ -32,12 +32,17 @@ extern "C" {
 #include "table_storage.hpp"
 #include "utils.hpp"
 
+#include <async/promise.hpp>
+#include <deeplake_api/catalog_table.hpp>
+#include <icm/vector.hpp>
+
 #include <algorithm>
 #include <cstring>
+#include <unordered_map>
 #include <vector>
 
 // GUC variables
-int deeplake_sync_interval_ms = 2000;  // Default 2 seconds
+int deeplake_sync_interval_ms = 1000;  // Default 1 second
 
 // Forward declaration (defined in the anonymous namespace below)
 namespace { bool execute_via_libpq(const char* dbname, const char* sql); }
@@ -305,98 +310,247 @@ void deeplake_sync_databases_from_catalog(const std::string& root_path, icm::str
 }
 
 /**
- * Sync tables from the deeplake catalog to PostgreSQL.
- *
- * This function checks the catalog for tables that exist in the deeplake
- * catalog but not in PostgreSQL, and creates them.
+ * Sync schemas for a specific database from pre-loaded catalog data via libpq.
+ * Creates missing schemas in the target database.
+ */
+void deeplake_sync_schemas_for_db(const std::string& db_name,
+    const std::vector<pg::dl_catalog::schema_meta>& schemas)
+{
+    for (const auto& meta : schemas) {
+        if (meta.state == "dropping") {
+            continue;
+        }
+
+        // Skip system schemas
+        if (meta.schema_name == "public" || meta.schema_name == "pg_catalog" ||
+            meta.schema_name == "information_schema" ||
+            meta.schema_name.substr(0, 3) == "pg_") {
+            continue;
+        }
+
+        StringInfoData buf;
+        initStringInfo(&buf);
+        appendStringInfo(&buf, "CREATE SCHEMA IF NOT EXISTS %s",
+                         quote_identifier(meta.schema_name.c_str()));
+
+        if (execute_via_libpq(db_name.c_str(), buf.data)) {
+            elog(LOG, "pg_deeplake sync: created schema '%s' in database '%s'",
+                 meta.schema_name.c_str(), db_name.c_str());
+        }
+
+        pfree(buf.data);
+    }
+}
+
+/**
+ * Sync tables for a specific database from pre-loaded catalog data via libpq.
+ * Creates missing tables in the target database.
+ */
+/**
+ * Parse comma-separated column names string into a vector.
+ * The column_names string uses trailing comma format: "col1,col2,"
  */
-void deeplake_sync_tables_from_catalog(const std::string& root_path, icm::string_map<> creds)
+std::vector<std::string> parse_column_names(const std::string& column_names)
 {
-    // Load tables and columns in parallel for better performance
-    auto [catalog_tables, catalog_columns] = pg::dl_catalog::load_tables_and_columns(root_path, creds);
+    std::vector<std::string> result;
+    std::string current;
+    for (char c : column_names) {
+        if (c == ',') {
+            if (!current.empty()) {
+                result.push_back(current);
+                current.clear();
+            }
+        } else {
+            current += c;
+        }
+    }
+    if (!current.empty()) {
+        result.push_back(current);
+    }
+    return result;
+}
 
-    for (const auto& meta : catalog_tables) {
-        // Skip tables marked as dropping
+void deeplake_sync_tables_for_db(const std::string& db_name,
+    const std::vector<pg::dl_catalog::table_meta>& tables,
+    const std::vector<pg::dl_catalog::column_meta>& columns,
+    const std::vector<pg::dl_catalog::index_meta>& indexes)
+{
+    for (const auto& meta : tables) {
         if (meta.state == "dropping") {
             continue;
         }
 
         const std::string qualified_name = meta.schema_name + "." + meta.table_name;
 
-        // Check if table exists in PostgreSQL
-        auto* rel = makeRangeVar(pstrdup(meta.schema_name.c_str()), pstrdup(meta.table_name.c_str()), -1);
-        Oid relid = RangeVarGetRelid(rel, NoLock, true);
+        // Gather columns for this table, sorted by position
+        std::vector<pg::dl_catalog::column_meta> table_columns;
+        for (const auto& col : columns) {
+            if (col.table_id == meta.table_id) {
+                table_columns.push_back(col);
+            }
+        }
+        std::sort(table_columns.begin(), table_columns.end(),
+                  [](const auto& a, const auto& b) { return a.position < b.position; });
 
-        if (!OidIsValid(relid)) {
-            // Gather columns for this table, sorted by position
-            std::vector<pg::dl_catalog::column_meta> table_columns;
-            for (const auto& col : catalog_columns) {
-                if (col.table_id == meta.table_id) {
-                    table_columns.push_back(col);
-                }
+        if (table_columns.empty()) {
+            elog(DEBUG1, "pg_deeplake sync: no columns for %s in db %s, skipping",
+                 qualified_name.c_str(), db_name.c_str());
+            continue;
+        }
+
+        // Find indexes for this table
+        std::vector<pg::dl_catalog::index_meta> table_indexes;
+        for (const auto& idx : indexes) {
+            if (idx.table_id == meta.table_id) {
+                table_ind
```

**File**: `cpp/deeplake_pg/table_storage.cpp` (modified, +109/-17)
```diff
@@ -12,6 +12,7 @@ extern "C" {
 #include <access/xact.h>
 #include <catalog/namespace.h>
 #include <catalog/pg_type.h>
+#include <commands/dbcommands.h>
 #include <executor/spi.h>
 #include <miscadmin.h>
 #include <nodes/makefuncs.h>
@@ -130,6 +131,15 @@ void convert_pg_to_nd(const pg::table_data& table_data,
     }
 }
 
+std::string get_current_database_name()
+{
+    const char* dbname = get_database_name(MyDatabaseId);
+    if (!dbname) return "postgres";
+    std::string result(dbname);
+    pfree(const_cast<char*>(dbname));
+    return result;
+}
+
 } // unnamed namespace
 
 namespace pg {
@@ -163,6 +173,11 @@ icm::string_map<> session_credentials::get_credentials()
 
 std::string session_credentials::get_root_path()
 {
+    // Environment variable takes priority over per-session GUC
+    auto root = base::getenv<std::string>("DEEPLAKE_ROOT_PATH", "");
+    if (!root.empty()) {
+        return root;
+    }
     if (root_path_guc_string != nullptr && std::strlen(root_path_guc_string) > 0) {
         return std::string(root_path_guc_string);
     }
@@ -240,7 +255,9 @@ void table_storage::save_table_metadata(const pg::table_data& table_data)
             return;
         }
         auto creds = session_credentials::get_credentials();
+        const auto db_name = get_current_database_name();
         pg::dl_catalog::ensure_catalog(root_dir, creds);
+        pg::dl_catalog::ensure_db_catalog(root_dir, db_name, creds);
 
         auto [schema_name, simple_table_name] = split_table_name(table_name);
         const std::string table_id = schema_name + "." + simple_table_name;
@@ -251,7 +268,8 @@ void table_storage::save_table_metadata(const pg::table_data& table_data)
         meta.table_name = simple_table_name;
         meta.dataset_path = ds_path;
         meta.state = "ready";
-        pg::dl_catalog::upsert_table(root_dir, creds, meta);
+        meta.db_name = db_name;
+        pg::dl_catalog::upsert_table(root_dir, db_name, creds, meta);
 
         // Save column metadata to catalog
         TupleDesc tupdesc = table_data.get_tuple_descriptor();
@@ -269,10 +287,25 @@ void table_storage::save_table_metadata(const pg::table_data& table_data)
             col.position = i;
             columns.push_back(std::move(col));
         }
-        pg::dl_catalog::upsert_columns(root_dir, creds, columns);
+        pg::dl_catalog::upsert_columns(root_dir, db_name, creds, columns);
+
+        // Belt-and-suspenders: ensure the schema is recorded even if
+        // the CREATE SCHEMA hook was missed (e.g., schema created before
+        // the extension was loaded, or via a different code path).
+        if (schema_name != "public") {
+            try {
+                pg::dl_catalog::schema_meta s_meta;
+                s_meta.schema_name = schema_name;
+                s_meta.state = "ready";
+                pg::dl_catalog::upsert_schema(root_dir, db_name, creds, s_meta);
+            } catch (...) {
+                elog(DEBUG1, "pg_deeplake: failed to upsert schema '%s' in catalog (non-fatal)", schema_name.c_str());
+            }
+        }
 
+        pg::dl_catalog::bump_db_catalog_version(root_dir, db_name, session_credentials::get_credentials());
         pg::dl_catalog::bump_catalog_version(root_dir, session_credentials::get_credentials());
-        catalog_version_ = pg::dl_catalog::get_catalog_version(root_dir, session_credentials::get_credentials());
+        catalog_version_ = pg::dl_catalog::get_db_catalog_version(root_dir, db_name, session_credentials::get_credentials());
     }
 }
 
@@ -297,9 +330,11 @@ void table_storage::load_table_metadata()
 
     // Stateless catalog sync (only when enabled and root_dir is configured)
     if (pg::stateless_enabled && !root_dir.empty()) {
-        // Fast path: if already loaded, just check version without ensure_catalog
+        const auto db_name = get_current_database_name();
+
+        // Fast path: if already loaded, just check per-db version
         if (tables_loaded_) {
-            const auto current_version = pg::dl_catalog::get_catalog_version(root_dir, creds);
+            const auto current_version = pg::dl_catalog::get_db_catalog_version(root_dir, db_name, creds);
             if (current_version == catalog_version_) {
                 return;
             }
@@ -310,18 +345,23 @@ void table_storage::load_table_metadata()
             catalog_version_ = current_version;
         }
 
-        // Ensure catalog exists and get version in one call
-        const auto version = pg::dl_catalog::ensure_catalog(root_dir, creds);
+        // Ensure both shared and per-database catalogs exist
+        pg::dl_catalog::ensure_catalog(root_dir, creds);
+        const auto version = pg::dl_catalog::ensure_db_catalog(root_dir, db_name, creds);
         if (catalog_version_ == 0) {
             catalog_version_ = version;
         }
         tables_loaded_ = true;
 
-        // Load tables and columns in parallel
-        auto [catalog_tables, catalog_columns] = pg
```

**File**: `cpp/deeplake_pg/table_storage.hpp` (modified, +5/-0)
```diff
@@ -298,6 +298,11 @@ class table_storage
         return catalog_only_create_;
     }
 
+    static void set_catalog_only_create(bool value) noexcept
+    {
+        catalog_only_create_ = value;
+    }
+
 private:
     static inline thread_local bool in_ddl_context_ = false;
     static inline thread_local bool catalog_only_create_ = false;
```

---

### Incident Patch 5: `72bf8691` (2026-02-13)
**Commit Message**: Fixed tests.

**File**: `cpp/deeplake_pg/pg_deeplake.cpp` (modified, +4/-2)
```diff
@@ -265,8 +265,10 @@ void save_index_metadata(Oid oid)
         ereport(ERROR, (errcode(ERRCODE_INTERNAL_ERROR), errmsg("Failed to save metadata")));
     }
 
-    // Persist index to shared catalog for stateless multi-instance sync
-    if (pg::stateless_enabled) {
+    // Persist index to shared catalog for stateless multi-instance sync.
+    // Skip when in catalog-only mode — the table was synced FROM the catalog,
+    // so writing back would be redundant and cause version bump loops.
+    if (pg::stateless_enabled && !pg::table_storage::is_catalog_only_create()) {
         try {
             auto root_dir = pg::session_credentials::get_root_path();
             if (root_dir.empty()) {
```

**File**: `postgres/tests/py_tests/test_drop_table_column.py` (modified, +5/-5)
```diff
@@ -25,7 +25,7 @@ async def test_drop_table_column(db_conn: asyncpg.Connection):
     try:
         # Create table with multiple columns
         await db_conn.execute("""
-            CREATE TABLE vectors (
+            CREATE TABLE drop_col_vectors (
                 id SERIAL PRIMARY KEY,
                 v1 float4[],
                 v2 float4[]
@@ -34,7 +34,7 @@ async def test_drop_table_column(db_conn: asyncpg.Connection):
 
         # Create index on v2 (not v1)
         await db_conn.execute("""
-            CREATE INDEX index_for_v2 ON vectors USING deeplake_index (v2 DESC)
+            CREATE INDEX index_for_v2 ON drop_col_vectors USING deeplake_index (v2 DESC)
         """)
 
         # Verify index exists in pg_class
@@ -60,7 +60,7 @@ async def test_drop_table_column(db_conn: asyncpg.Connection):
             f"Dataset directory '{dataset_path}' should exist before DROP COLUMN"
 
         # DROP non-indexed column (v1) - index should remain
-        await db_conn.execute("ALTER TABLE vectors DROP COLUMN v1")
+        await db_conn.execute("ALTER TABLE drop_col_vectors DROP COLUMN v1")
 
         # Verify index still exists after dropping non-indexed column
         await assertions.assert_query_row_count(
@@ -83,7 +83,7 @@ async def test_drop_table_column(db_conn: asyncpg.Connection):
             f"Dataset directory '{dataset_path_after_v1}' should exist after dropping non-indexed column"
 
         # DROP indexed column (v2) - index should be removed
-        await db_conn.execute("ALTER TABLE vectors DROP COLUMN v2")
+        await db_conn.execute("ALTER TABLE drop_col_vectors DROP COLUMN v2")
 
         # Verify index removed from pg_class
         await assertions.assert_query_row_count(
@@ -108,4 +108,4 @@ async def test_drop_table_column(db_conn: asyncpg.Connection):
     finally:
         # Cleanup (in case test fails)
         await db_conn.execute("DROP INDEX IF EXISTS index_for_v2 CASCADE")
-        await db_conn.execute("DROP TABLE IF EXISTS vectors CASCADE")
+        await db_conn.execute("DROP TABLE IF EXISTS drop_col_vectors CASCADE")
```

---

### Incident Patch 6: `76ee8215` (2026-02-13)
**Commit Message**: Fix.

**File**: `cpp/deeplake_pg/sync_worker.cpp` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ extern "C" {
 #include <vector>
 
 // GUC variables
-int deeplake_sync_interval_ms = 500;  // Default 500ms
+int deeplake_sync_interval_ms = 1000;  // Default 1 second
 
 // Forward declaration (defined in the anonymous namespace below)
 namespace { bool execute_via_libpq(const char* dbname, const char* sql); }
```

---

### Incident Patch 7: `d9224c38` (2026-02-13)
**Commit Message**: Merge pull request #3138 from activeloopai/db-catalog-sync

Sync db catalogs.

**File**: `cpp/deeplake_pg/dl_catalog.cpp` (modified, +3/-0)
```diff
@@ -128,6 +128,9 @@ std::vector<int64_t> load_int64_vector(const nd::array& arr)
 
 int64_t ensure_catalog(const std::string& root_path, icm::string_map<> creds)
 {
+    if (root_path.empty()) {
+        return 0;
+    }
     const auto tables_path = join_path(root_path, k_tables_name);
     const auto columns_path = join_path(root_path, k_columns_name);
     const auto indexes_path = join_path(root_path, k_indexes_name);
```

**File**: `cpp/deeplake_pg/pg_deeplake.cpp` (modified, +7/-1)
```diff
@@ -356,7 +356,7 @@ void deeplake_xact_callback(XactEvent event, void *arg)
 void init_deeplake()
 {
     static bool initialized = false;
-    if (initialized) {
+    if (initialized || !IsUnderPostmaster) {
         return;
     }
     initialized = true;
@@ -368,6 +368,12 @@ void init_deeplake()
     constexpr int THREAD_POOL_MULTIPLIER = 8;  // Threads per CPU core for async operations
     deeplake_api::initialize(std::make_shared<pg::logger_adapter>(), THREAD_POOL_MULTIPLIER * base::system_report::cpu_cores());
 
+    const std::string redis_url = base::getenv<std::string>("REDIS_URL", "");
+    if (!redis_url.empty()) {
+        deeplake_api::initialize_redis_cache(redis_url, 86400,
+                                             deeplake_api::metadata_catalog_cache_pattern);
+    }
+
     pg::table_storage::instance(); /// initialize table storage
 
     RegisterXactCallback(deeplake_xact_callback, nullptr);
```

**File**: `cpp/deeplake_pg/table_storage.cpp` (modified, +20/-15)
```diff
@@ -236,6 +236,9 @@ void table_storage::save_table_metadata(const pg::table_data& table_data)
             }
             return root;
         }();
+        if (root_dir.empty()) {
+            return;
+        }
         auto creds = session_credentials::get_credentials();
         pg::dl_catalog::ensure_catalog(root_dir, creds);
 
@@ -292,8 +295,8 @@ void table_storage::load_table_metadata()
     }();
     auto creds = session_credentials::get_credentials();
 
-    // Stateless catalog sync (only when enabled)
-    if (pg::stateless_enabled) {
+    // Stateless catalog sync (only when enabled and root_dir is configured)
+    if (pg::stateless_enabled && !root_dir.empty()) {
         // Fast path: if already loaded, just check version without ensure_catalog
         if (tables_loaded_) {
             const auto current_version = pg::dl_catalog::get_catalog_version(root_dir, creds);
@@ -534,7 +537,7 @@ void table_storage::load_table_metadata()
         }
         try {
             // Seed the DL catalog with legacy metadata (only when stateless is enabled).
-            if (pg::stateless_enabled) {
+            if (pg::stateless_enabled && !root_dir.empty()) {
                 auto [schema_name, simple_table_name] = split_table_name(table_name);
                 pg::dl_catalog::table_meta meta;
                 meta.table_id = schema_name + "." + simple_table_name;
@@ -580,7 +583,7 @@ void table_storage::load_table_metadata()
                 base::log_channel::generic, "Failed to delete invalid table metadata for table_oid: {}", invalid_oid);
         }
     }
-    if (catalog_seeded && pg::stateless_enabled) {
+    if (catalog_seeded && pg::stateless_enabled && !root_dir.empty()) {
         pg::dl_catalog::bump_catalog_version(root_dir, session_credentials::get_credentials());
         catalog_version_ = pg::dl_catalog::get_catalog_version(root_dir, session_credentials::get_credentials());
     }
@@ -991,17 +994,19 @@ void table_storage::drop_table(const std::string& table_name)
                 }
                 return root;
             }();
-            pg::dl_catalog::ensure_catalog(root_dir, creds);
-            auto [schema_name, simple_table_name] = split_table_name(table_name);
-            pg::dl_catalog::table_meta meta;
-            meta.table_id = schema_name + "." + simple_table_name;
-            meta.schema_name = schema_name;
-            meta.table_name = simple_table_name;
-            meta.dataset_path = table_data.get_dataset_path().url();
-            meta.state = "dropping";
-            pg::dl_catalog::upsert_table(root_dir, creds, meta);
-            pg::dl_catalog::bump_catalog_version(root_dir, session_credentials::get_credentials());
-            catalog_version_ = pg::dl_catalog::get_catalog_version(root_dir, session_credentials::get_credentials());
+            if (!root_dir.empty()) {
+                pg::dl_catalog::ensure_catalog(root_dir, creds);
+                auto [schema_name, simple_table_name] = split_table_name(table_name);
+                pg::dl_catalog::table_meta meta;
+                meta.table_id = schema_name + "." + simple_table_name;
+                meta.schema_name = schema_name;
+                meta.table_name = simple_table_name;
+                meta.dataset_path = table_data.get_dataset_path().url();
+                meta.state = "dropping";
+                pg::dl_catalog::upsert_table(root_dir, creds, meta);
+                pg::dl_catalog::bump_catalog_version(root_dir, session_credentials::get_credentials());
+                catalog_version_ = pg::dl_catalog::get_catalog_version(root_dir, session_credentials::get_credentials());
+            }
         }
 
         try {
```

**File**: `cpp/deeplake_pg/utils.hpp` (modified, +10/-5)
```diff
@@ -270,17 +270,22 @@ static std::string get_pg_data_directory()
 {
     const char* data_dir = GetConfigOption("data_directory", true, false);
     if (data_dir == nullptr) {
-        ereport(ERROR, (errcode(ERRCODE_INTERNAL_ERROR), errmsg("Unable to retrieve data_directory")));
+        return "";
     }
     return std::string(data_dir);
 }
 
 static std::string get_deeplake_root_directory()
 {
-    static const std::string root_dir_variable_name = "DEEPLAKE_ROOT_PATH";
-    static const std::string pg_data_dir = get_pg_data_directory();
-    static const std::string deeplake_root_dir = base::getenv<std::string>(root_dir_variable_name, pg_data_dir);
-    return deeplake_root_dir;
+    // Avoid static locals: if get_pg_data_directory() previously failed via
+    // ereport(ERROR) (longjmp through C++ static init), the static guard
+    // variable is permanently poisoned and subsequent calls return "".
+    // Re-evaluate every time so a later call can succeed once GUCs are ready.
+    auto root = base::getenv<std::string>("DEEPLAKE_ROOT_PATH", "");
+    if (root.empty()) {
+        root = get_pg_data_directory();
+    }
+    return root;
 }
 
 inline std::pair<BlockNumber, OffsetNumber> row_number_to_tid(int64_t row_number)
```

**File**: `postgres/Dockerfile` (modified, +15/-0)
```diff
@@ -1,6 +1,7 @@
 FROM BASE_IMAGE
 ARG VERSION=VERSION
 ARG TARGETARCH
+ARG STATELESS=false
 
 LABEL name="pg-deeplake" \
   version="${VERSION}" \
@@ -28,4 +29,18 @@ COPY ./debs/ /tmp/debs/
 COPY --chmod=444 ./LICENSE /LICENSE
 COPY ./postgres/docker-entrypoint.d/ /docker-entrypoint-initdb.d/
 RUN apt-get install --no-install-recommends -y /tmp/debs/pg-deeplake-${VERSION}_${TARGETARCH}.deb && rm -rf /tmp/debs/
+COPY ./serverless/scripts/init-deeplake-stateless.sh /tmp/init-deeplake-stateless.sh
+COPY ./serverless/config/postgresql-overrides.conf /tmp/postgresql-overrides.conf
+COPY ./serverless/scripts/health-check.sh /tmp/health-check.sh
+RUN if [ "$STATELESS" = "true" ]; then \
+      mv /tmp/init-deeplake-stateless.sh /docker-entrypoint-initdb.d/3-stateless-init.sh && \
+      chmod 755 /docker-entrypoint-initdb.d/3-stateless-init.sh && \
+      mv /tmp/postgresql-overrides.conf /etc/postgresql-overrides.conf && \
+      chmod 644 /etc/postgresql-overrides.conf && \
+      mv /tmp/health-check.sh /usr/local/bin/health-check.sh && \
+      chmod 755 /usr/local/bin/health-check.sh && \
+      mkdir -p /deeplake-data; \
+    else \
+      rm -f /tmp/init-deeplake-stateless.sh /tmp/postgresql-overrides.conf /tmp/health-check.sh; \
+    fi
 USER 999
```

**File**: `scripts/tpch_deeplake_ingest.py` (added, +385/-0)
```diff
@@ -0,0 +1,385 @@
+#!/usr/bin/env python3
+"""
+TPC-H Ingestion Script for pg_deeplake
+
+Each table gets its own connection through a load balancer (HAProxy),
+which distributes tables across backend instances via round-robin.
+
+Usage:
+    # Via HAProxy (parallel, one connection per table):
+    python tpch_deeplake_ingest.py
+
+    # Direct to single instance:
+    python tpch_deeplake_ingest.py --port 5433 --sequential
+"""
+
+import argparse
+import io
+import sys
+import time
+import psycopg2
+from concurrent.futures import ThreadPoolExecutor, as_completed
+from pathlib import Path
+
+
+def log(msg):
+    print(msg, flush=True)
+
+# TPC-H table definitions
+TPCH_TABLES = {
+    'region': {
+        'columns': [
+            ('r_regionkey', 'INTEGER'),
+            ('r_name', 'VARCHAR(25)'),
+            ('r_comment', 'VARCHAR(152)')
+        ],
+    },
+    'nation': {
+        'columns': [
+            ('n_nationkey', 'INTEGER'),
+            ('n_name', 'VARCHAR(25)'),
+            ('n_regionkey', 'INTEGER'),
+            ('n_comment', 'VARCHAR(152)')
+        ],
+    },
+    'supplier': {
+        'columns': [
+            ('s_suppkey', 'INTEGER'),
+            ('s_name', 'VARCHAR(25)'),
+            ('s_address', 'VARCHAR(40)'),
+            ('s_nationkey', 'INTEGER'),
+            ('s_phone', 'VARCHAR(15)'),
+            ('s_acctbal', 'DECIMAL(15,2)'),
+            ('s_comment', 'VARCHAR(101)')
+        ],
+    },
+    'customer': {
+        'columns': [
+            ('c_custkey', 'INTEGER'),
+            ('c_name', 'VARCHAR(25)'),
+            ('c_address', 'VARCHAR(40)'),
+            ('c_nationkey', 'INTEGER'),
+            ('c_phone', 'VARCHAR(15)'),
+            ('c_acctbal', 'DECIMAL(15,2)'),
+            ('c_mktsegment', 'VARCHAR(10)'),
+            ('c_comment', 'VARCHAR(117)')
+        ],
+    },
+    'part': {
+        'columns': [
+            ('p_partkey', 'INTEGER'),
+            ('p_name', 'VARCHAR(55)'),
+            ('p_mfgr', 'VARCHAR(25)'),
+            ('p_brand', 'VARCHAR(10)'),
+            ('p_type', 'VARCHAR(25)'),
+            ('p_size', 'INTEGER'),
+            ('p_container', 'VARCHAR(10)'),
+            ('p_retailprice', 'DECIMAL(15,2)'),
+            ('p_comment', 'VARCHAR(23)')
+        ],
+    },
+    'partsupp': {
+        'columns': [
+            ('ps_partkey', 'INTEGER'),
+            ('ps_suppkey', 'INTEGER'),
+            ('ps_availqty', 'INTEGER'),
+            ('ps_supplycost', 'DECIMAL(15,2)'),
+            ('ps_comment', 'VARCHAR(199)')
+        ],
+    },
+    'orders': {
+        'columns': [
+            ('o_orderkey', 'INTEGER'),
+            ('o_custkey', 'INTEGER'),
+            ('o_orderstatus', 'VARCHAR(1)'),
+            ('o_totalprice', 'DECIMAL(15,2)'),
+            ('o_orderdate', 'DATE'),
+            ('o_orderpriority', 'VARCHAR(15)'),
+            ('o_clerk', 'VARCHAR(15)'),
+            ('o_shippriority', 'INTEGER'),
+            ('o_comment', 'VARCHAR(79)')
+        ],
+    },
+    'lineitem': {
+        'columns': [
+            ('l_orderkey', 'INTEGER'),
+            ('l_partkey', 'INTEGER'),
+            ('l_suppkey', 'INTEGER'),
+            ('l_linenumber', 'INTEGER'),
+            ('l_quantity', 'DECIMAL(15,2)'),
+            ('l_extendedprice', 'DECIMAL(15,2)'),
+            ('l_discount', 'DECIMAL(15,2)'),
+            ('l_tax', 'DECIMAL(15,2)'),
+            ('l_returnflag', 'VARCHAR(1)'),
+            ('l_linestatus', 'VARCHAR(1)'),
+            ('l_shipdate', 'DATE'),
+            ('l_commitdate', 'DATE'),
+            ('l_receiptdate', 'DATE'),
+            ('l_shipinstruct', 'VARCHAR(25)'),
+            ('l_shipmode', 'VARCHAR(10)'),
+            ('l_comment', 'VARCHAR(44)')
+        ],
+    },
+}
+
+TABLE_LOAD_ORDER = ['region', 'nation', 'supplier', 'customer', 'part', 'partsupp', 'orders', 'lineitem']
+
+
+def get_connection(host, port, database, user, password):
+    return psycopg2.connect(host=host, port=port, database=database, user=user, password=password)
+
+
+
+def disable_autovacuum(conn):
+    old_autocommit = conn.autocommit
+    conn.autocommit = True
+    try:
+        with conn.cursor() as cur:
+            cur.execute("ALTER SYSTEM SET autovacuum = off;")
+            cur.execute("SELECT pg_reload_conf();")
+    finally:
+        conn.autocommit = old_autocommit
+
+
+def enable_autovacuum(conn):
+    old_autocommit = conn.autocommit
+    conn.autocommit = True
+    try:
+        with conn.cursor() as cur:
+            cur.execute("ALTER SYSTEM SET autovacuum = on;")
+            cur.execute("SELECT pg_reload_conf();")
+    finally:
+        conn.autocommit = old_autocommit
+
+
+def drop_table(conn, table_name):
+    with conn.cursor() as cur:
+        cur.execute(f"DROP TABLE IF EXISTS {table_name} CASCADE;")
+    conn.commit()
+
+
+def create_table(conn, table_name, table_def):
+    columns = table_def['columns']
+    col_defs = ', '.join([f"{name} {dtype}" for name, dtype, *_ in columns])
+    sql = f"CREATE 
```

---

### Incident Patch 8: `fbaa9f03` (2026-02-12)
**Commit Message**: Merge pull request #3137 from activeloopai/db-stateless

Make db creation stateless.

**File**: `DEEPLAKE_API_VERSION` (modified, +1/-1)
```diff
@@ -1 +1 @@
-4.5.1
+4.5.2
```

**File**: `cpp/CMakeLists.pg.cmake` (modified, +2/-1)
```diff
@@ -70,6 +70,7 @@ foreach(PG_VERSION ${PG_VERSIONS})
     endif()
 
     set(PG_SERVER_INCLUDE_DIR "${postgres_INSTALL_DIR_REL_${PG_VERSION}_0}/include/server")
+    set(PG_INCLUDE_DIR "${postgres_INSTALL_DIR_REL_${PG_VERSION}_0}/include")
     set(PG_PKGLIBDIR "${postgres_INSTALL_DIR_REL_${PG_VERSION}_0}/lib")
     set(PG_SHAREDIR "${postgres_INSTALL_DIR_REL_${PG_VERSION}_0}/share")
 
@@ -79,7 +80,7 @@ foreach(PG_VERSION ${PG_VERSIONS})
     )
 
     target_include_directories(${PG_LIB}
-        SYSTEM PRIVATE ${PG_SERVER_INCLUDE_DIR}
+        SYSTEM PRIVATE ${PG_SERVER_INCLUDE_DIR} ${PG_INCLUDE_DIR}
         PRIVATE
         ${indicators_INCLUDE_DIRS}
     )
```

**File**: `cpp/deeplake_pg/dl_catalog.cpp` (modified, +96/-4)
```diff
@@ -29,6 +29,7 @@ constexpr const char* k_tables_name = "tables";
 constexpr const char* k_columns_name = "columns";
 constexpr const char* k_indexes_name = "indexes";
 constexpr const char* k_meta_name = "meta";
+constexpr const char* k_databases_name = "databases";
 
 std::string join_path(const std::string& root, const std::string& name)
 {
@@ -131,6 +132,7 @@ int64_t ensure_catalog(const std::string& root_path, icm::string_map<> creds)
     const auto columns_path = join_path(root_path, k_columns_name);
     const auto indexes_path = join_path(root_path, k_indexes_name);
     const auto meta_path = join_path(root_path, k_meta_name);
+    const auto databases_path = join_path(root_path, k_databases_name);
 
     try {
         // Build schemas for all catalog tables
@@ -165,9 +167,20 @@ int64_t ensure_catalog(const std::string& root_path, icm::string_map<> creds)
             .add("updated_at", deeplake_core::type::generic(nd::type::scalar(nd::dtype::int64)))
             .set_primary_key("catalog_version");
 
-        // Launch all 4 open_or_create operations in parallel
+        deeplake_api::catalog_table_schema databases_schema;
+        databases_schema.add("db_name", deeplake_core::type::text(codecs::compression::null))
+            .add("owner", deeplake_core::type::text(codecs::compression::null))
+            .add("encoding", deeplake_core::type::text(codecs::compression::null))
+            .add("lc_collate", deeplake_core::type::text(codecs::compression::null))
+            .add("lc_ctype", deeplake_core::type::text(codecs::compression::null))
+            .add("template_db", deeplake_core::type::text(codecs::compression::null))
+            .add("state", deeplake_core::type::text(codecs::compression::null))
+            .add("updated_at", deeplake_core::type::generic(nd::type::scalar(nd::dtype::int64)))
+            .set_primary_key("db_name");
+
+        // Launch all 5 open_or_create operations in parallel
         icm::vector<async::promise<std::shared_ptr<deeplake_api::catalog_table>>> promises;
-        promises.reserve(4);
+        promises.reserve(5);
         promises.push_back(
             deeplake_api::open_or_create_catalog_table(tables_path, std::move(tables_schema), icm::string_map<>(creds)));
         promises.push_back(
@@ -176,12 +189,14 @@ int64_t ensure_catalog(const std::string& root_path, icm::string_map<> creds)
             deeplake_api::open_or_create_catalog_table(indexes_path, std::move(indexes_schema), icm::string_map<>(creds)));
         promises.push_back(
             deeplake_api::open_or_create_catalog_table(meta_path, std::move(meta_schema), icm::string_map<>(creds)));
+        promises.push_back(
+            deeplake_api::open_or_create_catalog_table(databases_path, std::move(databases_schema), icm::string_map<>(creds)));
 
         // Wait for all to complete
         auto results = async::combine(std::move(promises)).get_future().get();
-        if (results.size() != 4) {
+        if (results.size() != 5) {
             elog(ERROR,
-                 "Failed to initialize catalog at %s: expected 4 catalog tables, got %zu",
+                 "Failed to initialize catalog at %s: expected 5 catalog tables, got %zu",
                  root_path.c_str(),
                  static_cast<size_t>(results.size()));
         }
@@ -499,6 +514,83 @@ void upsert_columns(const std::string& root_path, icm::string_map<> creds, const
     table->upsert_many(std::move(rows)).get_future().get();
 }
 
+std::vector<database_meta> load_databases(const std::string& root_path, icm::string_map<> creds)
+{
+    std::vector<database_meta> out;
+    try {
+        auto table = open_catalog_table(root_path, k_databases_name, std::move(creds));
+        if (!table) {
+            return out;
+        }
+        auto snapshot = table->read().get_future().get();
+        if (snapshot.row_count() == 0) {
+            return out;
+        }
+
+        std::unordered_map<std::string, database_meta> latest;
+        for (const auto& row : snapshot.rows()) {
+            auto db_name_it = row.find("db_name");
+            auto owner_it = row.find("owner");
+            auto encoding_it = row.find("encoding");
+            auto lc_collate_it = row.find("lc_collate");
+            auto lc_ctype_it = row.find("lc_ctype");
+            auto template_it = row.find("template_db");
+            auto state_it = row.find("state");
+            auto updated_it = row.find("updated_at");
+            if (db_name_it == row.end() || state_it == row.end()) {
+                continue;
+            }
+
+            database_meta meta;
+            meta.db_name = deeplake_api::array_to_string(db_name_it->second);
+            if (owner_it != row.end()) meta.owner = deeplake_api::array_to_string(owner_it->second);
+            if (encoding_it != row.end()) meta.encoding = deeplake_api::array_to_string(encoding_it->second);
+            if (lc_collate_it != row.end()) meta.lc_collate = deeplake_api::array_to_strin
```

**File**: `cpp/deeplake_pg/dl_catalog.hpp` (modified, +15/-0)
```diff
@@ -36,6 +36,18 @@ struct index_meta
     int32_t order_type = 0;
 };
 
+struct database_meta
+{
+    std::string db_name;       // PK
+    std::string owner;
+    std::string encoding;
+    std::string lc_collate;
+    std::string lc_ctype;
+    std::string template_db;
+    std::string state;         // "ready" or "dropping"
+    int64_t updated_at = 0;
+};
+
 int64_t ensure_catalog(const std::string& root_path, icm::string_map<> creds);
 
 std::vector<table_meta> load_tables(const std::string& root_path, icm::string_map<> creds);
@@ -49,6 +61,9 @@ load_tables_and_columns(const std::string& root_path, icm::string_map<> creds);
 void upsert_table(const std::string& root_path, icm::string_map<> creds, const table_meta& meta);
 void upsert_columns(const std::string& root_path, icm::string_map<> creds, const std::vector<column_meta>& columns);
 
+std::vector<database_meta> load_databases(const std::string& root_path, icm::string_map<> creds);
+void upsert_database(const std::string& root_path, icm::string_map<> creds, const database_meta& meta);
+
 int64_t get_catalog_version(const std::string& root_path, icm::string_map<> creds);
 void bump_catalog_version(const std::string& root_path, icm::string_map<> creds);
 
```

**File**: `cpp/deeplake_pg/extension_init.cpp` (modified, +77/-0)
```diff
@@ -25,6 +25,7 @@ extern "C" {
 
 #include "column_statistics.hpp"
 #include "deeplake_executor.hpp"
+#include "dl_catalog.hpp"
 #include "pg_deeplake.hpp"
 #include "pg_version_compat.h"
 #include "sync_worker.hpp"
@@ -473,6 +474,10 @@ static void deeplake_shmem_request()
     // Request shared memory for table DDL lock
     RequestAddinShmemSpace(pg::table_ddl_lock::get_shmem_size());
     RequestNamedLWLockTranche("deeplake_table_ddl", 1);
+
+    // Request shared memory for pending extension install queue
+    RequestAddinShmemSpace(pg::pending_install_queue::get_shmem_size());
+    RequestNamedLWLockTranche("deeplake_install_queue", 1);
 }
 
 static void deeplake_shmem_startup()
@@ -483,6 +488,7 @@ static void deeplake_shmem_startup()
 
     pg::table_version_tracker::initialize();
     pg::table_ddl_lock::initialize();
+    pg::pending_install_queue::initialize();
 }
 
 static void process_utility(PlannedStmt* pstmt,
@@ -675,12 +681,83 @@ static void process_utility(PlannedStmt* pstmt,
         }
     }
 
+    // Pre-hook: mark database as "dropping" in S3 catalog before PostgreSQL drops it
+    if (IsA(pstmt->utilityStmt, DropdbStmt) && pg::stateless_enabled) {
+        DropdbStmt* dbstmt = (DropdbStmt*)pstmt->utilityStmt;
+        try {
+            auto root_path = pg::session_credentials::get_root_path();
+            if (root_path.empty()) {
+                root_path = pg::utils::get_deeplake_root_directory();
+            }
+            if (!root_path.empty()) {
+                auto creds = pg::session_credentials::get_credentials();
+                pg::dl_catalog::database_meta db_meta;
+                db_meta.db_name = dbstmt->dbname;
+                db_meta.state = "dropping";
+                pg::dl_catalog::upsert_database(root_path, creds, db_meta);
+                pg::dl_catalog::bump_catalog_version(root_path, creds);
+                elog(LOG, "pg_deeplake: marked database '%s' as dropping in catalog", dbstmt->dbname);
+            }
+        } catch (const std::exception& e) {
+            elog(WARNING, "pg_deeplake: failed to mark database '%s' as dropping in catalog: %s", dbstmt->dbname, e.what());
+        }
+    }
+
     if (prev_process_utility_hook != nullptr) {
         prev_process_utility_hook(pstmt, queryString, readOnlyTree, context, params, queryEnv, dest, completionTag);
     } else {
         standard_ProcessUtility(pstmt, queryString, readOnlyTree, context, params, queryEnv, dest, completionTag);
     }
 
+    // Post-hook: record CREATE DATABASE in S3 catalog and install extension
+    if (IsA(pstmt->utilityStmt, CreatedbStmt)) {
+        CreatedbStmt* dbstmt = (CreatedbStmt*)pstmt->utilityStmt;
+
+        // Queue the database for async extension install by the sync worker.
+        // The inline PQconnectdb approach fails on PG15+ because CREATE DATABASE
+        // is WAL-logged/transactional and the pg_database row isn't committed yet.
+        pg::pending_install_queue::enqueue(dbstmt->dbname);
+
+        // Record in S3 catalog if stateless mode is enabled
+        if (pg::stateless_enabled) {
+            try {
+                auto root_path = pg::session_credentials::get_root_path();
+                if (root_path.empty()) {
+                    root_path = pg::utils::get_deeplake_root_directory();
+                }
+                if (!root_path.empty()) {
+                    auto creds = pg::session_credentials::get_credentials();
+                    pg::dl_catalog::database_meta db_meta;
+                    db_meta.db_name = dbstmt->dbname;
+                    db_meta.state = "ready";
+
+                    // Extract options from CREATE DATABASE statement
+                    ListCell* lc = nullptr;
+                    foreach (lc, dbstmt->options) {
+                        DefElem* def = (DefElem*)lfirst(lc);
+                        if (strcmp(def->defname, "owner") == 0) {
+                            db_meta.owner = defGetString(def);
+                        } else if (strcmp(def->defname, "encoding") == 0) {
+                            db_meta.encoding = defGetString(def);
+                        } else if (strcmp(def->defname, "lc_collate") == 0) {
+                            db_meta.lc_collate = defGetString(def);
+                        } else if (strcmp(def->defname, "lc_ctype") == 0) {
+                            db_meta.lc_ctype = defGetString(def);
+                        } else if (strcmp(def->defname, "template") == 0) {
+                            db_meta.template_db = defGetString(def);
+                        }
+                    }
+
+                    pg::dl_catalog::upsert_database(root_path, creds, db_meta);
+                    pg::dl_catalog::bump_catalog_version(root_path, creds);
+                    elog(DEBUG1, "pg_deeplake: recorded CREATE DATABASE '%s' in catalog", dbstmt->dbname);
+                }
+            } catch (const std::exception& e) {
+                elog(DEBUG1, "pg_deeplake: failed to r
```

**File**: `cpp/deeplake_pg/sync_worker.cpp` (modified, +294/-3)
```diff
@@ -9,6 +9,7 @@ extern "C" {
 #include <access/xact.h>
 #include <catalog/namespace.h>
 #include <executor/spi.h>
+#include <libpq-fe.h>
 #include <miscadmin.h>
 #include <nodes/makefuncs.h>
 #include <pgstat.h>
@@ -32,11 +33,96 @@ extern "C" {
 #include "utils.hpp"
 
 #include <algorithm>
+#include <cstring>
 #include <vector>
 
 // GUC variables
 int deeplake_sync_interval_ms = 2000;  // Default 2 seconds
 
+// Forward declaration (defined in the anonymous namespace below)
+namespace { bool execute_via_libpq(const char* dbname, const char* sql); }
+
+// ---- pending_install_queue implementation ----
+
+namespace pg {
+
+pending_install_queue::queue_data* pending_install_queue::data_ = nullptr;
+
+Size pending_install_queue::get_shmem_size()
+{
+    Size size = MAXALIGN(sizeof(queue_data));
+    size = add_size(size, mul_size(MAX_PENDING, sizeof(entry)));
+    return size;
+}
+
+void pending_install_queue::initialize()
+{
+    bool found = false;
+
+    LWLockAcquire(AddinShmemInitLock, LW_EXCLUSIVE);
+
+    data_ = static_cast<queue_data*>(ShmemInitStruct(
+        "deeplake_pending_installs",
+        get_shmem_size(),
+        &found
+    ));
+
+    if (!found) {
+        data_->lock = &(GetNamedLWLockTranche("deeplake_install_queue")->lock);
+        data_->count = 0;
+        memset(data_->entries, 0, MAX_PENDING * sizeof(entry));
+    }
+
+    LWLockRelease(AddinShmemInitLock);
+}
+
+bool pending_install_queue::enqueue(const char* dbname)
+{
+    if (data_ == nullptr || dbname == nullptr) {
+        return false;
+    }
+
+    LWLockAcquire(data_->lock, LW_EXCLUSIVE);
+
+    bool ok = false;
+    if (data_->count < MAX_PENDING) {
+        strlcpy(data_->entries[data_->count].db_name, dbname, NAMEDATALEN);
+        data_->count++;
+        ok = true;
+    }
+
+    LWLockRelease(data_->lock);
+    return ok;
+}
+
+void pending_install_queue::drain_and_install()
+{
+    if (data_ == nullptr) {
+        return;
+    }
+
+    // Copy entries under lock, then release before doing I/O
+    std::vector<std::string> pending;
+
+    LWLockAcquire(data_->lock, LW_EXCLUSIVE);
+    for (int32_t i = 0; i < data_->count; i++) {
+        pending.emplace_back(data_->entries[i].db_name);
+    }
+    data_->count = 0;
+    LWLockRelease(data_->lock);
+
+    // Install extension via libpq (outside any lock)
+    for (const auto& db : pending) {
+        if (execute_via_libpq(db.c_str(), "CREATE EXTENSION IF NOT EXISTS pg_deeplake")) {
+            elog(LOG, "pg_deeplake: installed extension in database '%s' (async)", db.c_str());
+        } else {
+            elog(WARNING, "pg_deeplake: failed to install extension in database '%s' (async)", db.c_str());
+        }
+    }
+}
+
+} // namespace pg
+
 namespace {
 
 // Worker state - use sig_atomic_t for signal safety
@@ -59,6 +145,165 @@ void deeplake_sync_worker_sighup(SIGNAL_ARGS)
     errno = save_errno;
 }
 
+/**
+ * Execute SQL via libpq in autocommit mode (needed for CREATE DATABASE which
+ * cannot run inside a transaction block).
+ *
+ * Returns true on success. Treats SQLSTATE 42P04 ("duplicate_database") as success.
+ */
+bool execute_via_libpq(const char* dbname, const char* sql)
+{
+    // Build connection string using Unix socket
+    const char* port = GetConfigOption("port", true, false);
+    const char* socket_dir = GetConfigOption("unix_socket_directories", true, false);
+
+    StringInfoData conninfo;
+    initStringInfo(&conninfo);
+    appendStringInfo(&conninfo, "dbname=%s", dbname);
+    if (port) {
+        appendStringInfo(&conninfo, " port=%s", port);
+    }
+    if (socket_dir) {
+        // unix_socket_directories may be comma-separated; use the first one
+        char* dir_copy = pstrdup(socket_dir);
+        char* comma = strchr(dir_copy, ',');
+        if (comma) *comma = '\0';
+        // Trim leading/trailing whitespace
+        char* dir = dir_copy;
+        while (*dir == ' ') dir++;
+        appendStringInfo(&conninfo, " host=%s", dir);
+        pfree(dir_copy);
+    }
+
+    PGconn* conn = PQconnectdb(conninfo.data);
+    pfree(conninfo.data);
+
+    if (PQstatus(conn) != CONNECTION_OK) {
+        elog(WARNING, "pg_deeplake sync: libpq connection failed: %s", PQerrorMessage(conn));
+        PQfinish(conn);
+        return false;
+    }
+
+    PGresult* res = PQexec(conn, sql);
+    ExecStatusType status = PQresultStatus(res);
+    bool ok = (status == PGRES_COMMAND_OK || status == PGRES_TUPLES_OK);
+
+    if (!ok) {
+        const char* sqlstate = PQresultErrorField(res, PG_DIAG_SQLSTATE);
+        // 42P04 = duplicate_database - treat as success (idempotent)
+        if (sqlstate && strcmp(sqlstate, "42P04") == 0) {
+            ok = true;
+        } else {
+            elog(WARNING, "pg_deeplake sync: libpq exec failed: %s", PQerrorMessage(conn));
+        }
+    }
+
+    PQclear(res);
+    PQfinish(conn);
+    return ok;
+}
+
+/**
+ * Sync databases from the deeplake catalog to PostgreSQL.
+ *
+ * Creates missing databases and insta
```

**File**: `cpp/deeplake_pg/sync_worker.hpp` (modified, +41/-0)
```diff
@@ -1,4 +1,45 @@
 #pragma once
 
+#ifdef __cplusplus
+extern "C" {
+#endif
+
+#include <postgres.h>
+#include <storage/lwlock.h>
+#include <storage/shmem.h>
+
+#ifdef __cplusplus
+}
+#endif
+
+#include <cstdint>
+
 // GUC variables for sync worker configuration
 extern int deeplake_sync_interval_ms;
+
+namespace pg {
+
+class pending_install_queue {
+public:
+    static Size get_shmem_size();
+    static void initialize();
+    static bool enqueue(const char* dbname);
+    static void drain_and_install();
+
+private:
+    static constexpr int32_t MAX_PENDING = 64;
+
+    struct entry {
+        char db_name[NAMEDATALEN];
+    };
+
+    struct queue_data {
+        LWLock* lock;
+        int32_t count;
+        entry entries[FLEXIBLE_ARRAY_MEMBER];
+    };
+
+    static queue_data* data_;
+};
+
+} // namespace pg
```

**File**: `postgres/tests/py_tests/test_create_database.py` (added, +479/-0)
```diff
@@ -0,0 +1,479 @@
+"""
+Test CREATE DATABASE with pg_deeplake extension.
+
+Verifies that pg_deeplake can be installed and used in newly created databases,
+and that DROP DATABASE works cleanly with the extension present.
+
+The CREATE DATABASE post-hook queues the database name into shared memory, and
+the background sync worker installs pg_deeplake on its next poll cycle (default
+2s). Tests that verify this async behaviour poll pg_extension without a manual
+fallback and assert the extension appears within a bounded timeout.
+
+Cross-instance tests verify that database entries written to the shared catalog
+by one instance are picked up by the sync worker on a second instance, which
+then creates the database locally and installs the extension.
+"""
+import asyncio
+import os
+import shutil
+import subprocess
+import tempfile
+import time
+import pytest
+import asyncpg
+from pathlib import Path
+
+
+SECOND_INSTANCE_PORT = 5434
+
+
+async def connect_postgres(port=5432):
+    """Connect to the default postgres database."""
+    user = os.environ.get("USER", "postgres")
+    return await asyncpg.connect(
+        database="postgres",
+        user=user,
+        host="localhost",
+        port=port,
+        statement_cache_size=0,
+    )
+
+
+async def connect_database(dbname, port=5432):
+    """Connect to a specific database."""
+    user = os.environ.get("USER", "postgres")
+    return await asyncpg.connect(
+        database=dbname,
+        user=user,
+        host="localhost",
+        port=port,
+        statement_cache_size=0,
+    )
+
+
+async def ensure_extension(conn, timeout=5.0):
+    """Wait for pg_deeplake extension (async install by sync worker), installing manually if timeout expires."""
+    import asyncio
+    deadline = asyncio.get_event_loop().time() + timeout
+    while asyncio.get_event_loop().time() < deadline:
+        ext = await conn.fetchval(
+            "SELECT extname FROM pg_extension WHERE extname = 'pg_deeplake'"
+        )
+        if ext == "pg_deeplake":
+            return
+        await asyncio.sleep(0.3)
+    # Fallback: install manually if the sync worker hasn't picked it up yet
+    await conn.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
+
+
+@pytest.mark.asyncio
+async def test_create_database_auto_installs_extension(pg_server):
+    """
+    Verify that pg_deeplake extension can be installed in a new database.
+
+    CREATE DATABASE followed by CREATE EXTENSION IF NOT EXISTS.
+    The hook may auto-install the extension; if not, we install it manually.
+    """
+    conn = await connect_postgres()
+    target_conn = None
+    try:
+        await conn.execute("DROP DATABASE IF EXISTS test_auto_ext_db")
+        await conn.execute("CREATE DATABASE test_auto_ext_db")
+
+        target_conn = await connect_database("test_auto_ext_db")
+        await ensure_extension(target_conn)
+
+        ext = await target_conn.fetchval(
+            "SELECT extname FROM pg_extension WHERE extname = 'pg_deeplake'"
+        )
+        assert ext == "pg_deeplake", (
+            f"Expected pg_deeplake extension to be installed, got: {ext}"
+        )
+    finally:
+        if target_conn is not None:
+            await target_conn.close()
+        await conn.execute("DROP DATABASE IF EXISTS test_auto_ext_db")
+        await conn.close()
+
+
+@pytest.mark.asyncio
+async def test_create_database_deeplake_works(pg_server):
+    """
+    Verify that deeplake storage works in a newly created database.
+
+    Steps:
+    - CREATE DATABASE test_dl_works_db
+    - Connect and ensure extension is installed
+    - CREATE TABLE with USING deeplake
+    - INSERT rows, verify row count
+    - Cleanup
+    """
+    conn = await connect_postgres()
+    target_conn = None
+    try:
+        await conn.execute("DROP DATABASE IF EXISTS test_dl_works_db")
+        await conn.execute("CREATE DATABASE test_dl_works_db")
+
+        target_conn = await connect_database("test_dl_works_db")
+        await ensure_extension(target_conn)
+
+        await target_conn.execute("""
+            CREATE TABLE test_vectors (
+                id SERIAL PRIMARY KEY,
+                v1 float4[]
+            ) USING deeplake
+        """)
+
+        await target_conn.execute("""
+            INSERT INTO test_vectors (v1) VALUES
+                (ARRAY[1.0, 2.0, 3.0]),
+                (ARRAY[4.0, 5.0, 6.0]),
+                (ARRAY[7.0, 8.0, 9.0])
+        """)
+
+        count = await target_conn.fetchval("SELECT count(*) FROM test_vectors")
+        assert count == 3, f"Expected 3 rows, got {count}"
+
+        await target_conn.execute("DROP TABLE test_vectors")
+    finally:
+        if target_conn is not None:
+            await target_conn.close()
+        await conn.execute("DROP DATABASE IF EXISTS test_dl_works_db")
+        await conn.close()
+
+
+@pytest.mark.asyncio
+async def test_drop_database_with_extension(pg_server):
+    """
+    Verify that DROP DATABASE succeeds on a database with pg_deeplake 
```

---

### Incident Patch 9: `d5f1741d` (2026-02-10)
**Commit Message**: Merge branch 'main' of github.com:activeloopai/deeplake

**File**: `cpp/deeplake_pg/extension_init.cpp` (modified, +2/-2)
```diff
@@ -238,8 +238,8 @@ void initialize_guc_parameters()
                              "allowing multiple PostgreSQL instances to share the same tables. "
                              "This adds latency for remote storage (S3, GCS) due to catalog sync operations.",
                              &pg::stateless_enabled,
-                             false,
-                             PGC_USERSET,
+                             true,
+                             PGC_POSTMASTER,
                              0,
                              nullptr,
                              nullptr,
```

**File**: `postgres/tests/py_tests/test_startup_latency.py` (modified, +0/-21)
```diff
@@ -100,7 +100,6 @@ async def measure_connection_latency(
     database: str = "postgres",
     with_extension: bool = True,
     root_path: Optional[str] = None,
-    stateless_enabled: bool = False,
     run_first_query: bool = True,
     create_table: bool = False,
     table_name: str = "latency_test",
@@ -113,7 +112,6 @@ async def measure_connection_latency(
         database: Database to connect to
         with_extension: Whether to load pg_deeplake extension
         root_path: If set, configure deeplake.root_path
-        stateless_enabled: Whether to enable stateless mode
         run_first_query: Whether to measure first query time
         create_table: Whether to measure table creation time
         table_name: Name for test table
@@ -144,10 +142,6 @@ async def measure_connection_latency(
             await conn.execute("CREATE EXTENSION pg_deeplake")
             metrics.extension_load_time_ms = (time.perf_counter() - ext_start) * 1000
 
-            # Set stateless mode if requested
-            if stateless_enabled:
-                await conn.execute("SET deeplake.stateless_enabled = true")
-
         # 3. Measure root_path set time (triggers catalog loading in stateless mode)
         if root_path:
             root_start = time.perf_counter()
@@ -188,7 +182,6 @@ async def measure_catalog_discovery_latency(
     port: int,
     root_path: str,
     num_tables: int,
-    stateless_enabled: bool = True,
 ) -> LatencyMetrics:
     """
     Measure time to discover existing tables from catalog.
@@ -214,8 +207,6 @@ async def measure_catalog_discovery_latency(
         ext_start = time.perf_counter()
         await conn.execute("DROP EXTENSION IF EXISTS pg_deeplake CASCADE")
         await conn.execute("CREATE EXTENSION pg_deeplake")
-        if stateless_enabled:
-            await conn.execute("SET deeplake.stateless_enabled = true")
         metrics.extension_load_time_ms = (time.perf_counter() - ext_start) * 1000
 
         # Set root_path - this triggers catalog discovery
@@ -349,7 +340,6 @@ async def test_stateless_catalog_loading_latency(pg_server, temp_root_path):
     try:
         await setup_conn.execute("DROP EXTENSION IF EXISTS pg_deeplake CASCADE")
         await setup_conn.execute("CREATE EXTENSION pg_deeplake")
-        await setup_conn.execute("SET deeplake.stateless_enabled = true")
         await setup_conn.execute(f"SET deeplake.root_path = '{temp_root_path}'")
 
         # Create multiple tables to populate the catalog
@@ -383,7 +373,6 @@ async def test_stateless_catalog_loading_latency(pg_server, temp_root_path):
             port=5432,
             root_path=temp_root_path,
             num_tables=num_tables,
-            stateless_enabled=True,
         )
         report.add(metrics)
         print(f"Run {i+1}:")
@@ -425,7 +414,6 @@ async def test_stateless_vs_nonstateless_comparison(pg_server, temp_root_path):
         metrics = await measure_connection_latency(
             with_extension=True,
             root_path=temp_root_path,
-            stateless_enabled=False,
             run_first_query=True,
             create_table=True,
             table_name=f"nonstateless_test_{i}",
@@ -441,7 +429,6 @@ async def test_stateless_vs_nonstateless_comparison(pg_server, temp_root_path):
         metrics = await measure_connection_latency(
             with_extension=True,
             root_path=temp_root_path,
-            stateless_enabled=True,
             run_first_query=True,
             create_table=True,
             table_name=f"stateless_test_{i}",
@@ -492,7 +479,6 @@ async def test_multi_table_catalog_scaling(pg_server, temp_root_path):
         try:
             await setup_conn.execute("DROP EXTENSION IF EXISTS pg_deeplake CASCADE")
             await setup_conn.execute("CREATE EXTENSION pg_deeplake")
-            await setup_conn.execute("SET deeplake.stateless_enabled = true")
             await setup_conn.execute(f"SET deeplake.root_path = '{temp_root_path}'")
 
             # Create tables
@@ -512,7 +498,6 @@ async def test_multi_table_catalog_scaling(pg_server, temp_root_path):
                 port=5432,
                 root_path=temp_root_path,
                 num_tables=num_tables,
-                stateless_enabled=True,
             )
             report.add(metrics)
 
@@ -593,7 +578,6 @@ async def test_cold_start_simulation(pg_server, temp_root_path):
     try:
         await setup_conn.execute("DROP EXTENSION IF EXISTS pg_deeplake CASCADE")
         await setup_conn.execute("CREATE EXTENSION pg_deeplake")
-        await setup_conn.execute("SET deeplake.stateless_enabled = true")
         await setup_conn.execute(f"SET deeplake.root_path = '{temp_root_path}'")
 
         await setup_conn.execute("""
@@ -633,10 +617,6 @@ async def test_cold_start_simulation(pg_server, temp_root_path):
         try:
             # Extension is already loaded via shared_preload_libraries
             # Just configure the session (simulating a new backend)
-           
```

**File**: `postgres/tests/py_tests/test_stateless_catalog_resilience.py` (modified, +0/-2)
```diff
@@ -28,8 +28,6 @@ async def test_stateless_bootstrap_permission_error_keeps_backend_alive(db_conn:
     - SET deeplake.root_path fails with a PostgreSQL error
     - Same connection remains usable afterwards
     """
-    await db_conn.execute("SET deeplake.stateless_enabled = true")
-
     readonly_root = Path(temp_dir_for_postgres) / "readonly_root"
     readonly_root.mkdir(parents=True, exist_ok=True)
     os.chmod(readonly_root, 0o555)
```

**File**: `postgres/tests/py_tests/test_stateless_multi_instance.py` (modified, +4/-5)
```diff
@@ -213,7 +213,6 @@ async def primary_conn(pg_server):
         # Setup: Clean extension state
         await conn.execute("DROP EXTENSION IF EXISTS pg_deeplake CASCADE")
         await conn.execute("CREATE EXTENSION pg_deeplake")
-        await conn.execute("SET deeplake.stateless_enabled = true")
         yield conn
     finally:
         await conn.close()
@@ -323,7 +322,7 @@ async def test_stateless_data_sync_between_instances(
     try:
         # Setup extension (create if not exists for session-scoped instance reuse)
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
 
         # Setting root_path should automatically discover and register tables from catalog
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
@@ -412,7 +411,7 @@ async def test_stateless_concurrent_writes(
     conn_b = await second_instance.connect()
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
 
         # Setting root_path should auto-discover tables from deeplake catalog
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
@@ -515,7 +514,7 @@ async def test_stateless_multiple_tables_discovery(
     conn_b = await second_instance.connect()
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
 
         # Setting root_path should auto-discover ALL tables from deeplake catalog
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
@@ -683,7 +682,7 @@ async def test_stateless_varchar1_catalog_sync(
     conn_b = await second_instance.connect()
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
 
         # Verify table was auto-discovered
```

**File**: `postgres/tests/py_tests/test_stateless_reserved_schema.py` (modified, +4/-5)
```diff
@@ -75,7 +75,6 @@ async def primary_conn(pg_server):
     try:
         await conn.execute("DROP EXTENSION IF EXISTS pg_deeplake CASCADE")
         await conn.execute("CREATE EXTENSION pg_deeplake")
-        await conn.execute("SET deeplake.stateless_enabled = true")
         yield conn
     finally:
         await conn.close()
@@ -144,7 +143,7 @@ async def test_catalog_sync_default_schema(
 
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
 
         # This is the critical part - setting root_path triggers catalog sync
         # which should properly quote "default" schema name in generated DDL
@@ -236,7 +235,7 @@ async def test_catalog_sync_multiple_reserved_schemas(
 
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
 
         # Verify all tables discovered
@@ -322,7 +321,7 @@ async def test_catalog_sync_default_schema_with_indexes(
 
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
 
         # Verify table discovered
@@ -378,7 +377,7 @@ async def test_catalog_sync_default_schema_write_from_secondary(
 
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
 
         # Insert from Instance B
```

---

### Incident Patch 10: `0e26444d` (2026-02-10)
**Commit Message**: Merge pull request #3136 from activeloopai/bugfix

Make stateless default.

**File**: `cpp/deeplake_pg/extension_init.cpp` (modified, +2/-2)
```diff
@@ -238,8 +238,8 @@ void initialize_guc_parameters()
                              "allowing multiple PostgreSQL instances to share the same tables. "
                              "This adds latency for remote storage (S3, GCS) due to catalog sync operations.",
                              &pg::stateless_enabled,
-                             false,
-                             PGC_USERSET,
+                             true,
+                             PGC_POSTMASTER,
                              0,
                              nullptr,
                              nullptr,
```

**File**: `postgres/tests/py_tests/test_startup_latency.py` (modified, +0/-21)
```diff
@@ -100,7 +100,6 @@ async def measure_connection_latency(
     database: str = "postgres",
     with_extension: bool = True,
     root_path: Optional[str] = None,
-    stateless_enabled: bool = False,
     run_first_query: bool = True,
     create_table: bool = False,
     table_name: str = "latency_test",
@@ -113,7 +112,6 @@ async def measure_connection_latency(
         database: Database to connect to
         with_extension: Whether to load pg_deeplake extension
         root_path: If set, configure deeplake.root_path
-        stateless_enabled: Whether to enable stateless mode
         run_first_query: Whether to measure first query time
         create_table: Whether to measure table creation time
         table_name: Name for test table
@@ -144,10 +142,6 @@ async def measure_connection_latency(
             await conn.execute("CREATE EXTENSION pg_deeplake")
             metrics.extension_load_time_ms = (time.perf_counter() - ext_start) * 1000
 
-            # Set stateless mode if requested
-            if stateless_enabled:
-                await conn.execute("SET deeplake.stateless_enabled = true")
-
         # 3. Measure root_path set time (triggers catalog loading in stateless mode)
         if root_path:
             root_start = time.perf_counter()
@@ -188,7 +182,6 @@ async def measure_catalog_discovery_latency(
     port: int,
     root_path: str,
     num_tables: int,
-    stateless_enabled: bool = True,
 ) -> LatencyMetrics:
     """
     Measure time to discover existing tables from catalog.
@@ -214,8 +207,6 @@ async def measure_catalog_discovery_latency(
         ext_start = time.perf_counter()
         await conn.execute("DROP EXTENSION IF EXISTS pg_deeplake CASCADE")
         await conn.execute("CREATE EXTENSION pg_deeplake")
-        if stateless_enabled:
-            await conn.execute("SET deeplake.stateless_enabled = true")
         metrics.extension_load_time_ms = (time.perf_counter() - ext_start) * 1000
 
         # Set root_path - this triggers catalog discovery
@@ -349,7 +340,6 @@ async def test_stateless_catalog_loading_latency(pg_server, temp_root_path):
     try:
         await setup_conn.execute("DROP EXTENSION IF EXISTS pg_deeplake CASCADE")
         await setup_conn.execute("CREATE EXTENSION pg_deeplake")
-        await setup_conn.execute("SET deeplake.stateless_enabled = true")
         await setup_conn.execute(f"SET deeplake.root_path = '{temp_root_path}'")
 
         # Create multiple tables to populate the catalog
@@ -383,7 +373,6 @@ async def test_stateless_catalog_loading_latency(pg_server, temp_root_path):
             port=5432,
             root_path=temp_root_path,
             num_tables=num_tables,
-            stateless_enabled=True,
         )
         report.add(metrics)
         print(f"Run {i+1}:")
@@ -425,7 +414,6 @@ async def test_stateless_vs_nonstateless_comparison(pg_server, temp_root_path):
         metrics = await measure_connection_latency(
             with_extension=True,
             root_path=temp_root_path,
-            stateless_enabled=False,
             run_first_query=True,
             create_table=True,
             table_name=f"nonstateless_test_{i}",
@@ -441,7 +429,6 @@ async def test_stateless_vs_nonstateless_comparison(pg_server, temp_root_path):
         metrics = await measure_connection_latency(
             with_extension=True,
             root_path=temp_root_path,
-            stateless_enabled=True,
             run_first_query=True,
             create_table=True,
             table_name=f"stateless_test_{i}",
@@ -492,7 +479,6 @@ async def test_multi_table_catalog_scaling(pg_server, temp_root_path):
         try:
             await setup_conn.execute("DROP EXTENSION IF EXISTS pg_deeplake CASCADE")
             await setup_conn.execute("CREATE EXTENSION pg_deeplake")
-            await setup_conn.execute("SET deeplake.stateless_enabled = true")
             await setup_conn.execute(f"SET deeplake.root_path = '{temp_root_path}'")
 
             # Create tables
@@ -512,7 +498,6 @@ async def test_multi_table_catalog_scaling(pg_server, temp_root_path):
                 port=5432,
                 root_path=temp_root_path,
                 num_tables=num_tables,
-                stateless_enabled=True,
             )
             report.add(metrics)
 
@@ -593,7 +578,6 @@ async def test_cold_start_simulation(pg_server, temp_root_path):
     try:
         await setup_conn.execute("DROP EXTENSION IF EXISTS pg_deeplake CASCADE")
         await setup_conn.execute("CREATE EXTENSION pg_deeplake")
-        await setup_conn.execute("SET deeplake.stateless_enabled = true")
         await setup_conn.execute(f"SET deeplake.root_path = '{temp_root_path}'")
 
         await setup_conn.execute("""
@@ -633,10 +617,6 @@ async def test_cold_start_simulation(pg_server, temp_root_path):
         try:
             # Extension is already loaded via shared_preload_libraries
             # Just configure the session (simulating a new backend)
-           
```

**File**: `postgres/tests/py_tests/test_stateless_catalog_resilience.py` (modified, +0/-2)
```diff
@@ -28,8 +28,6 @@ async def test_stateless_bootstrap_permission_error_keeps_backend_alive(db_conn:
     - SET deeplake.root_path fails with a PostgreSQL error
     - Same connection remains usable afterwards
     """
-    await db_conn.execute("SET deeplake.stateless_enabled = true")
-
     readonly_root = Path(temp_dir_for_postgres) / "readonly_root"
     readonly_root.mkdir(parents=True, exist_ok=True)
     os.chmod(readonly_root, 0o555)
```

**File**: `postgres/tests/py_tests/test_stateless_multi_instance.py` (modified, +4/-5)
```diff
@@ -213,7 +213,6 @@ async def primary_conn(pg_server):
         # Setup: Clean extension state
         await conn.execute("DROP EXTENSION IF EXISTS pg_deeplake CASCADE")
         await conn.execute("CREATE EXTENSION pg_deeplake")
-        await conn.execute("SET deeplake.stateless_enabled = true")
         yield conn
     finally:
         await conn.close()
@@ -323,7 +322,7 @@ async def test_stateless_data_sync_between_instances(
     try:
         # Setup extension (create if not exists for session-scoped instance reuse)
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
 
         # Setting root_path should automatically discover and register tables from catalog
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
@@ -412,7 +411,7 @@ async def test_stateless_concurrent_writes(
     conn_b = await second_instance.connect()
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
 
         # Setting root_path should auto-discover tables from deeplake catalog
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
@@ -515,7 +514,7 @@ async def test_stateless_multiple_tables_discovery(
     conn_b = await second_instance.connect()
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
 
         # Setting root_path should auto-discover ALL tables from deeplake catalog
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
@@ -683,7 +682,7 @@ async def test_stateless_varchar1_catalog_sync(
     conn_b = await second_instance.connect()
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
 
         # Verify table was auto-discovered
```

**File**: `postgres/tests/py_tests/test_stateless_reserved_schema.py` (modified, +4/-5)
```diff
@@ -75,7 +75,6 @@ async def primary_conn(pg_server):
     try:
         await conn.execute("DROP EXTENSION IF EXISTS pg_deeplake CASCADE")
         await conn.execute("CREATE EXTENSION pg_deeplake")
-        await conn.execute("SET deeplake.stateless_enabled = true")
         yield conn
     finally:
         await conn.close()
@@ -144,7 +143,7 @@ async def test_catalog_sync_default_schema(
 
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
 
         # This is the critical part - setting root_path triggers catalog sync
         # which should properly quote "default" schema name in generated DDL
@@ -236,7 +235,7 @@ async def test_catalog_sync_multiple_reserved_schemas(
 
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
 
         # Verify all tables discovered
@@ -322,7 +321,7 @@ async def test_catalog_sync_default_schema_with_indexes(
 
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
 
         # Verify table discovered
@@ -378,7 +377,7 @@ async def test_catalog_sync_default_schema_write_from_secondary(
 
     try:
         await conn_b.execute("CREATE EXTENSION IF NOT EXISTS pg_deeplake")
-        await conn_b.execute("SET deeplake.stateless_enabled = true")
+
         await conn_b.execute(f"SET deeplake.root_path = '{shared_root_path}'")
 
         # Insert from Instance B
```

---

### Incident Patch 11: `43fa9d82` (2026-02-10)
**Commit Message**: Merge pull request #3135 from activeloopai/fix-race

Fixed parallel ingestion.

**File**: `cpp/deeplake_pg/sync_worker.cpp` (modified, +36/-29)
```diff
@@ -83,9 +83,6 @@ void deeplake_sync_tables_from_catalog(const std::string& root_path, icm::string
         Oid relid = RangeVarGetRelid(rel, NoLock, true);
 
         if (!OidIsValid(relid)) {
-            // Table doesn't exist locally - create it
-            elog(LOG, "pg_deeplake sync: creating table %s from catalog", qualified_name.c_str());
-
             // Gather columns for this table, sorted by position
             std::vector<pg::dl_catalog::column_meta> table_columns;
             for (const auto& col : catalog_columns) {
@@ -102,26 +99,12 @@ void deeplake_sync_tables_from_catalog(const std::string& root_path, icm::string
             }
 
             const char* qschema = quote_identifier(meta.schema_name.c_str());
+            const char* qtable = quote_identifier(meta.table_name.c_str());
 
+            // Build CREATE TABLE IF NOT EXISTS statement
             StringInfoData buf;
             initStringInfo(&buf);
-
-            // Create schema if needed
-            appendStringInfo(&buf, "CREATE SCHEMA IF NOT EXISTS %s", qschema);
-
-            pg::utils::spi_connector connector;
-            if (SPI_execute(buf.data, false, 0) != SPI_OK_UTILITY) {
-                elog(WARNING, "pg_deeplake sync: failed to create schema %s", meta.schema_name.c_str());
-                pfree(buf.data);
-                continue;
-            }
-
-            // Build CREATE TABLE statement directly from catalog metadata
-            // This avoids calling the SQL function create_deeplake_table which may not exist
-            // in the postgres database (extension might not be installed there)
-            resetStringInfo(&buf);
-            const char* qtable = quote_identifier(meta.table_name.c_str());
-            appendStringInfo(&buf, "CREATE TABLE %s.%s (", qschema, qtable);
+            appendStringInfo(&buf, "CREATE TABLE IF NOT EXISTS %s.%s (", qschema, qtable);
 
             bool first = true;
             for (const auto& col : table_columns) {
@@ -131,18 +114,42 @@ void deeplake_sync_tables_from_catalog(const std::string& root_path, icm::string
                 first = false;
                 appendStringInfo(&buf, "%s %s", quote_identifier(col.column_name.c_str()), col.pg_type.c_str());
             }
-
-            // Table path is now derived from deeplake.root_path GUC set at database level
-            // Path: {root_path}/{schema}/{table_name}
             appendStringInfo(&buf, ") USING deeplake");
 
-            if (SPI_execute(buf.data, false, 0) != SPI_OK_UTILITY) {
-                // Don't log as warning - the dataset might not be available yet
-                // The sync worker will retry on the next cycle
-                elog(DEBUG1, "pg_deeplake sync: table %s not ready yet, will retry", qualified_name.c_str());
-            } else {
-                elog(LOG, "pg_deeplake sync: successfully created table %s", qualified_name.c_str());
+            // Wrap in subtransaction so that if another backend concurrently
+            // creates the same table (race on composite type), the error is
+            // caught and we continue instead of aborting the sync cycle.
+            MemoryContext saved_context = CurrentMemoryContext;
+            ResourceOwner saved_owner = CurrentResourceOwner;
+
+            BeginInternalSubTransaction(NULL);
+            PG_TRY();
+            {
+                pg::utils::spi_connector connector;
+
+                // Create schema if needed
+                StringInfoData schema_buf;
+                initStringInfo(&schema_buf);
+                appendStringInfo(&schema_buf, "CREATE SCHEMA IF NOT EXISTS %s", qschema);
+                SPI_execute(schema_buf.data, false, 0);
+                pfree(schema_buf.data);
+
+                if (SPI_execute(buf.data, false, 0) == SPI_OK_UTILITY) {
+                    elog(LOG, "pg_deeplake sync: successfully created table %s", qualified_name.c_str());
+                }
+
+                ReleaseCurrentSubTransaction();
+            }
+            PG_CATCH();
+            {
+                // Another backend created this table concurrently — not an error.
+                MemoryContextSwitchTo(saved_context);
+                CurrentResourceOwner = saved_owner;
+                RollbackAndReleaseCurrentSubTransaction();
+                FlushErrorState();
+                elog(DEBUG1, "pg_deeplake sync: concurrent creation of %s, skipping", qualified_name.c_str());
             }
+            PG_END_TRY();
 
             pfree(buf.data);
         }
```

**File**: `cpp/deeplake_pg/table_storage.cpp` (modified, +45/-27)
```diff
@@ -9,6 +9,7 @@ extern "C" {
 #include <access/heapam.h>
 #include <access/htup_details.h>
 #include <access/parallel.h>
+#include <access/xact.h>
 #include <catalog/namespace.h>
 #include <catalog/pg_type.h>
 #include <executor/spi.h>
@@ -344,28 +345,15 @@ void table_storage::load_table_metadata()
                         continue;
                     }
 
-                    // Not in DDL context (e.g., SET root_path) - safe to auto-create.
-                    // Use catalog_only_guard to skip S3 dataset operations in create_table() —
-                    // the dataset already exists on S3, we just need the pg_class entry.
-                    catalog_only_guard co_guard;
-                    pg::utils::memory_context_switcher context_switcher;
-                    pg::utils::spi_connector connector;
-                    bool pushed_snapshot = false;
-                    if (!ActiveSnapshotSet()) {
-                        PushActiveSnapshot(GetTransactionSnapshot());
-                        pushed_snapshot = true;
-                    }
+                    // Build CREATE TABLE IF NOT EXISTS from catalog metadata.
+                    // Wrap in a subtransaction so that if another backend concurrently
+                    // creates the same table (race on composite type), the error is
+                    // caught and we continue instead of aborting the session.
                     const char* qschema = quote_identifier(meta.schema_name.c_str());
+                    const char* qtable = quote_identifier(meta.table_name.c_str());
 
                     StringInfoData buf;
                     initStringInfo(&buf);
-                    appendStringInfo(&buf, "CREATE SCHEMA IF NOT EXISTS %s", qschema);
-                    SPI_execute(buf.data, false, 0);
-
-                    // Build CREATE TABLE statement directly from catalog metadata
-                    // This avoids calling the SQL function create_deeplake_table which may not exist
-                    resetStringInfo(&buf);
-                    const char* qtable = quote_identifier(meta.table_name.c_str());
                     appendStringInfo(&buf, "CREATE TABLE IF NOT EXISTS %s.%s (", qschema, qtable);
 
                     bool first = true;
@@ -376,19 +364,49 @@ void table_storage::load_table_metadata()
                         first = false;
                         appendStringInfo(&buf, "%s %s", quote_identifier(col.column_name.c_str()), col.pg_type.c_str());
                     }
-
-                    // Table path is now derived from deeplake.root_path GUC set at database level
-                    // Path: {root_path}/{schema}/{table_name}
                     appendStringInfo(&buf, ") USING deeplake");
 
-                    if (SPI_execute(buf.data, false, 0) != SPI_OK_UTILITY) {
-                        elog(WARNING, "Failed to auto-create deeplake table %s from catalog", qualified_name.c_str());
-                    }
-                    pfree(buf.data);
+                    MemoryContext saved_context = CurrentMemoryContext;
+                    ResourceOwner saved_owner = CurrentResourceOwner;
+
+                    BeginInternalSubTransaction(NULL);
+                    PG_TRY();
+                    {
+                        catalog_only_guard co_guard;
+                        pg::utils::spi_connector connector;
+                        bool pushed_snapshot = false;
+                        if (!ActiveSnapshotSet()) {
+                            PushActiveSnapshot(GetTransactionSnapshot());
+                            pushed_snapshot = true;
+                        }
 
-                    if (pushed_snapshot) {
-                        PopActiveSnapshot();
+                        // Create schema if needed
+                        StringInfoData schema_buf;
+                        initStringInfo(&schema_buf);
+                        appendStringInfo(&schema_buf, "CREATE SCHEMA IF NOT EXISTS %s", qschema);
+                        SPI_execute(schema_buf.data, false, 0);
+                        pfree(schema_buf.data);
+
+                        SPI_execute(buf.data, false, 0);
+
+                        if (pushed_snapshot) {
+                            PopActiveSnapshot();
+                        }
+
+                        ReleaseCurrentSubTransaction();
                     }
+                    PG_CATCH();
+                    {
+                        // Another backend created this table concurrently — not an error.
+                        MemoryContextSwitchTo(saved_context);
+                        CurrentResourceOwner = saved_owner;
+                        RollbackAndReleaseCurrentSubTransaction();
+                        FlushErrorState();
+                        elog(DEBUG1, "Concurrent table creation for %s, skipping", qualified_name.c_str());
+                    }
+                    PG_END_TRY();
+
+                    pfree(buf.data);
 
                     relid = RangeVarGetRelid
```

---

### Incident Patch 12: `f8d3e8a7` (2026-02-10)
**Commit Message**: Fixed parallel ingestion.

**File**: `cpp/deeplake_pg/sync_worker.cpp` (modified, +36/-29)
```diff
@@ -83,9 +83,6 @@ void deeplake_sync_tables_from_catalog(const std::string& root_path, icm::string
         Oid relid = RangeVarGetRelid(rel, NoLock, true);
 
         if (!OidIsValid(relid)) {
-            // Table doesn't exist locally - create it
-            elog(LOG, "pg_deeplake sync: creating table %s from catalog", qualified_name.c_str());
-
             // Gather columns for this table, sorted by position
             std::vector<pg::dl_catalog::column_meta> table_columns;
             for (const auto& col : catalog_columns) {
@@ -102,26 +99,12 @@ void deeplake_sync_tables_from_catalog(const std::string& root_path, icm::string
             }
 
             const char* qschema = quote_identifier(meta.schema_name.c_str());
+            const char* qtable = quote_identifier(meta.table_name.c_str());
 
+            // Build CREATE TABLE IF NOT EXISTS statement
             StringInfoData buf;
             initStringInfo(&buf);
-
-            // Create schema if needed
-            appendStringInfo(&buf, "CREATE SCHEMA IF NOT EXISTS %s", qschema);
-
-            pg::utils::spi_connector connector;
-            if (SPI_execute(buf.data, false, 0) != SPI_OK_UTILITY) {
-                elog(WARNING, "pg_deeplake sync: failed to create schema %s", meta.schema_name.c_str());
-                pfree(buf.data);
-                continue;
-            }
-
-            // Build CREATE TABLE statement directly from catalog metadata
-            // This avoids calling the SQL function create_deeplake_table which may not exist
-            // in the postgres database (extension might not be installed there)
-            resetStringInfo(&buf);
-            const char* qtable = quote_identifier(meta.table_name.c_str());
-            appendStringInfo(&buf, "CREATE TABLE %s.%s (", qschema, qtable);
+            appendStringInfo(&buf, "CREATE TABLE IF NOT EXISTS %s.%s (", qschema, qtable);
 
             bool first = true;
             for (const auto& col : table_columns) {
@@ -131,18 +114,42 @@ void deeplake_sync_tables_from_catalog(const std::string& root_path, icm::string
                 first = false;
                 appendStringInfo(&buf, "%s %s", quote_identifier(col.column_name.c_str()), col.pg_type.c_str());
             }
-
-            // Table path is now derived from deeplake.root_path GUC set at database level
-            // Path: {root_path}/{schema}/{table_name}
             appendStringInfo(&buf, ") USING deeplake");
 
-            if (SPI_execute(buf.data, false, 0) != SPI_OK_UTILITY) {
-                // Don't log as warning - the dataset might not be available yet
-                // The sync worker will retry on the next cycle
-                elog(DEBUG1, "pg_deeplake sync: table %s not ready yet, will retry", qualified_name.c_str());
-            } else {
-                elog(LOG, "pg_deeplake sync: successfully created table %s", qualified_name.c_str());
+            // Wrap in subtransaction so that if another backend concurrently
+            // creates the same table (race on composite type), the error is
+            // caught and we continue instead of aborting the sync cycle.
+            MemoryContext saved_context = CurrentMemoryContext;
+            ResourceOwner saved_owner = CurrentResourceOwner;
+
+            BeginInternalSubTransaction(NULL);
+            PG_TRY();
+            {
+                pg::utils::spi_connector connector;
+
+                // Create schema if needed
+                StringInfoData schema_buf;
+                initStringInfo(&schema_buf);
+                appendStringInfo(&schema_buf, "CREATE SCHEMA IF NOT EXISTS %s", qschema);
+                SPI_execute(schema_buf.data, false, 0);
+                pfree(schema_buf.data);
+
+                if (SPI_execute(buf.data, false, 0) == SPI_OK_UTILITY) {
+                    elog(LOG, "pg_deeplake sync: successfully created table %s", qualified_name.c_str());
+                }
+
+                ReleaseCurrentSubTransaction();
+            }
+            PG_CATCH();
+            {
+                // Another backend created this table concurrently — not an error.
+                MemoryContextSwitchTo(saved_context);
+                CurrentResourceOwner = saved_owner;
+                RollbackAndReleaseCurrentSubTransaction();
+                FlushErrorState();
+                elog(DEBUG1, "pg_deeplake sync: concurrent creation of %s, skipping", qualified_name.c_str());
             }
+            PG_END_TRY();
 
             pfree(buf.data);
         }
```

**File**: `cpp/deeplake_pg/table_storage.cpp` (modified, +45/-27)
```diff
@@ -9,6 +9,7 @@ extern "C" {
 #include <access/heapam.h>
 #include <access/htup_details.h>
 #include <access/parallel.h>
+#include <access/xact.h>
 #include <catalog/namespace.h>
 #include <catalog/pg_type.h>
 #include <executor/spi.h>
@@ -344,28 +345,15 @@ void table_storage::load_table_metadata()
                         continue;
                     }
 
-                    // Not in DDL context (e.g., SET root_path) - safe to auto-create.
-                    // Use catalog_only_guard to skip S3 dataset operations in create_table() —
-                    // the dataset already exists on S3, we just need the pg_class entry.
-                    catalog_only_guard co_guard;
-                    pg::utils::memory_context_switcher context_switcher;
-                    pg::utils::spi_connector connector;
-                    bool pushed_snapshot = false;
-                    if (!ActiveSnapshotSet()) {
-                        PushActiveSnapshot(GetTransactionSnapshot());
-                        pushed_snapshot = true;
-                    }
+                    // Build CREATE TABLE IF NOT EXISTS from catalog metadata.
+                    // Wrap in a subtransaction so that if another backend concurrently
+                    // creates the same table (race on composite type), the error is
+                    // caught and we continue instead of aborting the session.
                     const char* qschema = quote_identifier(meta.schema_name.c_str());
+                    const char* qtable = quote_identifier(meta.table_name.c_str());
 
                     StringInfoData buf;
                     initStringInfo(&buf);
-                    appendStringInfo(&buf, "CREATE SCHEMA IF NOT EXISTS %s", qschema);
-                    SPI_execute(buf.data, false, 0);
-
-                    // Build CREATE TABLE statement directly from catalog metadata
-                    // This avoids calling the SQL function create_deeplake_table which may not exist
-                    resetStringInfo(&buf);
-                    const char* qtable = quote_identifier(meta.table_name.c_str());
                     appendStringInfo(&buf, "CREATE TABLE IF NOT EXISTS %s.%s (", qschema, qtable);
 
                     bool first = true;
@@ -376,19 +364,49 @@ void table_storage::load_table_metadata()
                         first = false;
                         appendStringInfo(&buf, "%s %s", quote_identifier(col.column_name.c_str()), col.pg_type.c_str());
                     }
-
-                    // Table path is now derived from deeplake.root_path GUC set at database level
-                    // Path: {root_path}/{schema}/{table_name}
                     appendStringInfo(&buf, ") USING deeplake");
 
-                    if (SPI_execute(buf.data, false, 0) != SPI_OK_UTILITY) {
-                        elog(WARNING, "Failed to auto-create deeplake table %s from catalog", qualified_name.c_str());
-                    }
-                    pfree(buf.data);
+                    MemoryContext saved_context = CurrentMemoryContext;
+                    ResourceOwner saved_owner = CurrentResourceOwner;
+
+                    BeginInternalSubTransaction(NULL);
+                    PG_TRY();
+                    {
+                        catalog_only_guard co_guard;
+                        pg::utils::spi_connector connector;
+                        bool pushed_snapshot = false;
+                        if (!ActiveSnapshotSet()) {
+                            PushActiveSnapshot(GetTransactionSnapshot());
+                            pushed_snapshot = true;
+                        }
 
-                    if (pushed_snapshot) {
-                        PopActiveSnapshot();
+                        // Create schema if needed
+                        StringInfoData schema_buf;
+                        initStringInfo(&schema_buf);
+                        appendStringInfo(&schema_buf, "CREATE SCHEMA IF NOT EXISTS %s", qschema);
+                        SPI_execute(schema_buf.data, false, 0);
+                        pfree(schema_buf.data);
+
+                        SPI_execute(buf.data, false, 0);
+
+                        if (pushed_snapshot) {
+                            PopActiveSnapshot();
+                        }
+
+                        ReleaseCurrentSubTransaction();
                     }
+                    PG_CATCH();
+                    {
+                        // Another backend created this table concurrently — not an error.
+                        MemoryContextSwitchTo(saved_context);
+                        CurrentResourceOwner = saved_owner;
+                        RollbackAndReleaseCurrentSubTransaction();
+                        FlushErrorState();
+                        elog(DEBUG1, "Concurrent table creation for %s, skipping", qualified_name.c_str());
+                    }
+                    PG_END_TRY();
+
+                    pfree(buf.data);
 
                     relid = RangeVarGetRelid
```

---

### Incident Patch 13: `3bc282a6` (2026-02-09)
**Commit Message**: Merge pull request #3134 from activeloopai/drop-column-fixes

Fixed out of bounds fix after drop column.

**File**: `cpp/deeplake_pg/column_statistics.cpp` (modified, +4/-14)
```diff
@@ -218,20 +218,10 @@ bool inject_column_statistics(Relation rel, int16_t attnum)
         return false;
     }
 
-    // Get DeepLake column view - attnum is 1-based, column index is 0-based
-    int32_t col_idx = attnum - 1;
-
-    // Skip dropped columns by finding the actual column index
-    int32_t logical_idx = 0;
-    for (int32_t i = 0; i < tupdesc->natts && logical_idx <= col_idx; ++i) {
-        Form_pg_attribute a = TupleDescAttr(tupdesc, i);
-        if (!a->attisdropped) {
-            if (logical_idx == col_idx) {
-                col_idx = i;
-                break;
-            }
-            logical_idx++;
-        }
+    // Map PG attnum to logical column index (handles dropped columns correctly)
+    const auto col_idx = table_data.logical_index_for_attnum(attnum);
+    if (col_idx < 0) {
+        return false;
     }
 
     heimdall::column_view_ptr column_view;
```

**File**: `cpp/deeplake_pg/deeplake_executor.cpp` (modified, +4/-1)
```diff
@@ -77,7 +77,10 @@ void analyze_plan(PlannedStmt* plan)
             if (attnum <= 0) { // Only positive attribute numbers are real columns
                 continue;
             }
-            auto col_idx = static_cast<int32_t>(attnum - 1);
+            auto col_idx = table_data->logical_index_for_attnum(attnum);
+            if (col_idx < 0) {
+                continue; // Dropped column or out of range
+            }
             if (!table_data->is_column_requested(col_idx)) {
                 table_data->set_column_requested(col_idx, true);
                 if (!table_data->column_has_streamer(col_idx) && table_data->can_stream_column(col_idx)) {
```

**File**: `cpp/deeplake_pg/table_am.cpp` (modified, +9/-6)
```diff
@@ -367,10 +367,13 @@ double deeplake_index_build_range_scan(Relation heap_rel,
     AttrNumber* indexkeys = index_info->ii_IndexAttrNumbers;
     const auto table_id = RelationGetRelid(heap_rel);
     auto& td = pg::table_storage::instance().get_table_data(table_id);
+    // Map index key attnums to logical column indices
+    std::vector<int32_t> key_logical_indices(nkeys, -1);
     for (int32_t i = 0; i < nkeys; ++i) {
-        int32_t attnum = indexkeys[i] - 1;
-        if (attnum >= 0 && !td.column_has_streamer(attnum) && td.can_stream_column(attnum)) {
-            td.create_streamer(attnum, -1);
+        auto logical = td.logical_index_for_attnum(indexkeys[i]);
+        key_logical_indices[i] = logical;
+        if (logical >= 0 && !td.column_has_streamer(logical) && td.can_stream_column(logical)) {
+            td.create_streamer(logical, -1);
         }
     }
     std::vector<Datum> values(nkeys, 0);
@@ -382,12 +385,12 @@ double deeplake_index_build_range_scan(Relation heap_rel,
         auto [block_number, offset_number] = pg::utils::row_number_to_tid(row);
         ItemPointerSet(&tid, block_number, offset_number);
         for (int32_t i = 0; i < nkeys; ++i) {
-            int32_t attnum = indexkeys[i] - 1;
-            if (attnum < 0) [[unlikely]] {
+            auto logical = key_logical_indices[i];
+            if (logical < 0) [[unlikely]] {
                 nulls[i] = true;
                 values[i] = 0;
             } else [[likely]] {
-                auto [value, null] = tscan.get_datum(attnum, row);
+                auto [value, null] = tscan.get_datum(logical, row);
                 values[i] = value;
                 nulls[i] = null;
             }
```

**File**: `cpp/deeplake_pg/table_data.hpp` (modified, +2/-0)
```diff
@@ -67,6 +67,7 @@ struct table_data
     inline std::string get_atttypename(AttrNumber attr_num) const noexcept;
     inline bool is_column_dropped(AttrNumber attr_num) const noexcept;
     inline int32_t get_tupdesc_index(AttrNumber attr_num) const noexcept;
+    inline int32_t logical_index_for_attnum(int32_t attnum) const noexcept;
     inline bool is_column_nullable(AttrNumber attr_num) const noexcept;
     inline bool is_column_indexed(AttrNumber attr_num) const noexcept;
     inline int32_t num_columns() const noexcept;
@@ -176,6 +177,7 @@ struct table_data
     icm::vector<bool> requested_columns_;
     icm::vector<Oid> base_typeids_;              // Cached base type OIDs for performance
     icm::vector<int32_t> active_column_indices_; // Maps logical index to TupleDesc index (excludes dropped)
+    icm::vector<int32_t> tupdesc_to_logical_;    // Maps TupleDesc index to logical index (-1 if dropped)
     icm::string_map<> creds_;
     TupleDesc tuple_descriptor_;
     http::uri dataset_path_ = http::uri(std::string());
```

**File**: `cpp/deeplake_pg/table_data_impl.hpp` (modified, +18/-2)
```diff
@@ -64,6 +64,12 @@ inline table_data::table_data(
         }
     }
 
+    // Build reverse mapping: TupleDesc index → logical index (-1 for dropped)
+    tupdesc_to_logical_.resize(tuple_descriptor_->natts, -1);
+    for (int32_t logical = 0; logical < static_cast<int32_t>(active_column_indices_.size()); ++logical) {
+        tupdesc_to_logical_[active_column_indices_[logical]] = logical;
+    }
+
     const auto num_active = active_column_indices_.size();
     requested_columns_.resize(num_active, false);
     base_typeids_.resize(num_active);
@@ -272,6 +278,15 @@ inline int32_t table_data::get_tupdesc_index(AttrNumber attr_num) const noexcept
     return active_column_indices_[attr_num];
 }
 
+inline int32_t table_data::logical_index_for_attnum(int32_t attnum) const noexcept
+{
+    const auto tupdesc_idx = attnum - 1;
+    if (tupdesc_idx < 0 || tupdesc_idx >= static_cast<int32_t>(tupdesc_to_logical_.size())) {
+        return -1;
+    }
+    return tupdesc_to_logical_[tupdesc_idx];
+}
+
 inline bool table_data::is_column_indexed(AttrNumber attr_num) const noexcept
 {
     return pg::pg_index::get_oid(table_name_, get_atttypename(attr_num)) != InvalidOid;
@@ -318,13 +333,14 @@ inline void table_data::add_insert_slots(int32_t nslots, TupleTableSlot** slots)
     for (int32_t i = 0; i < num_columns(); ++i) {
         auto& column_values = insert_rows_[get_atttypename(i)];
         const auto dt = get_column_view(i)->dtype();
+        const auto slot_pos = get_tupdesc_index(i);
         for (int32_t k = 0; k < nslots; ++k) {
             auto slot = slots[k];
             nd::array val;
-            if (slot->tts_isnull[i]) {
+            if (slot->tts_isnull[slot_pos]) {
                 val = (nd::dtype_is_numeric(dt) ? nd::adapt(0) : nd::none(dt, 0));
             } else {
-                val = pg::utils::datum_to_nd(slot->tts_values[i], get_base_atttypid(i), get_atttypmod(i));
+                val = pg::utils::datum_to_nd(slot->tts_values[slot_pos], get_base_atttypid(i), get_atttypmod(i));
             }
             column_values.push_back(std::move(val));
         }
```

**File**: `cpp/deeplake_pg/table_scan_impl.hpp` (modified, +10/-6)
```diff
@@ -158,19 +158,23 @@ inline std::pair<Datum, bool> table_scan::get_datum(int32_t column_number, int64
 inline void table_scan::convert_nd_to_pg(int64_t row_number, Datum* values, bool* nulls) const noexcept
 {
     for (auto col : null_columns_) {
-        nulls[col] = true;
+        const auto slot_pos = table_data_.get_tupdesc_index(col);
+        nulls[slot_pos] = true;
     }
     for (auto col : scored_columns_) {
-        nulls[col] = false;
+        const auto slot_pos = table_data_.get_tupdesc_index(col);
+        nulls[slot_pos] = false;
     }
     for (auto col : special_columns_) {
-        values[col] = pg::utils::make_special_datum(table_id_, row_number, col, table_data_.get_base_atttypid(col));
-        nulls[col] = false;
+        const auto slot_pos = table_data_.get_tupdesc_index(col);
+        values[slot_pos] = pg::utils::make_special_datum(table_id_, row_number, col, table_data_.get_base_atttypid(col));
+        nulls[slot_pos] = false;
     }
     for (auto col : process_columns_) {
+        const auto slot_pos = table_data_.get_tupdesc_index(col);
         auto [datum, is_null] = get_datum(col, row_number);
-        values[col] = datum;
-        nulls[col] = is_null;
+        values[slot_pos] = datum;
+        nulls[slot_pos] = is_null;
     }
 }
 
```

**File**: `cpp/deeplake_pg/table_storage.cpp` (modified, +6/-1)
```diff
@@ -951,10 +951,15 @@ void table_storage::create_table(const std::string& table_name, Oid table_id, Tu
 
 void table_storage::drop_table(const std::string& table_name)
 {
-    pg::table_ddl_lock_guard ddl_lock;
+    // Load metadata BEFORE acquiring the DDL lock.
+    // force_load_table_metadata() may trigger CREATE TABLE (via SPI) for tables
+    // in the S3 catalog that don't exist in pg_class yet.  CREATE TABLE goes
+    // through the table AM which also acquires the DDL lock — doing that while
+    // we already hold it would self-deadlock (LWLocks are not recursive).
     if (!table_exists(table_name)) {
         force_load_table_metadata();
     }
+    pg::table_ddl_lock_guard ddl_lock;
     if (table_exists(table_name)) {
         auto& table_data = get_table_data(table_name);
         auto creds = session_credentials::get_credentials();
```

---

### Incident Patch 14: `23ab3a81` (2026-02-09)
**Commit Message**: Fixed out of bounds fix after drop column.

**File**: `cpp/deeplake_pg/column_statistics.cpp` (modified, +4/-14)
```diff
@@ -218,20 +218,10 @@ bool inject_column_statistics(Relation rel, int16_t attnum)
         return false;
     }
 
-    // Get DeepLake column view - attnum is 1-based, column index is 0-based
-    int32_t col_idx = attnum - 1;
-
-    // Skip dropped columns by finding the actual column index
-    int32_t logical_idx = 0;
-    for (int32_t i = 0; i < tupdesc->natts && logical_idx <= col_idx; ++i) {
-        Form_pg_attribute a = TupleDescAttr(tupdesc, i);
-        if (!a->attisdropped) {
-            if (logical_idx == col_idx) {
-                col_idx = i;
-                break;
-            }
-            logical_idx++;
-        }
+    // Map PG attnum to logical column index (handles dropped columns correctly)
+    const auto col_idx = table_data.logical_index_for_attnum(attnum);
+    if (col_idx < 0) {
+        return false;
     }
 
     heimdall::column_view_ptr column_view;
```

**File**: `cpp/deeplake_pg/deeplake_executor.cpp` (modified, +4/-1)
```diff
@@ -77,7 +77,10 @@ void analyze_plan(PlannedStmt* plan)
             if (attnum <= 0) { // Only positive attribute numbers are real columns
                 continue;
             }
-            auto col_idx = static_cast<int32_t>(attnum - 1);
+            auto col_idx = table_data->logical_index_for_attnum(attnum);
+            if (col_idx < 0) {
+                continue; // Dropped column or out of range
+            }
             if (!table_data->is_column_requested(col_idx)) {
                 table_data->set_column_requested(col_idx, true);
                 if (!table_data->column_has_streamer(col_idx) && table_data->can_stream_column(col_idx)) {
```

**File**: `cpp/deeplake_pg/table_am.cpp` (modified, +9/-6)
```diff
@@ -367,10 +367,13 @@ double deeplake_index_build_range_scan(Relation heap_rel,
     AttrNumber* indexkeys = index_info->ii_IndexAttrNumbers;
     const auto table_id = RelationGetRelid(heap_rel);
     auto& td = pg::table_storage::instance().get_table_data(table_id);
+    // Map index key attnums to logical column indices
+    std::vector<int32_t> key_logical_indices(nkeys, -1);
     for (int32_t i = 0; i < nkeys; ++i) {
-        int32_t attnum = indexkeys[i] - 1;
-        if (attnum >= 0 && !td.column_has_streamer(attnum) && td.can_stream_column(attnum)) {
-            td.create_streamer(attnum, -1);
+        auto logical = td.logical_index_for_attnum(indexkeys[i]);
+        key_logical_indices[i] = logical;
+        if (logical >= 0 && !td.column_has_streamer(logical) && td.can_stream_column(logical)) {
+            td.create_streamer(logical, -1);
         }
     }
     std::vector<Datum> values(nkeys, 0);
@@ -382,12 +385,12 @@ double deeplake_index_build_range_scan(Relation heap_rel,
         auto [block_number, offset_number] = pg::utils::row_number_to_tid(row);
         ItemPointerSet(&tid, block_number, offset_number);
         for (int32_t i = 0; i < nkeys; ++i) {
-            int32_t attnum = indexkeys[i] - 1;
-            if (attnum < 0) [[unlikely]] {
+            auto logical = key_logical_indices[i];
+            if (logical < 0) [[unlikely]] {
                 nulls[i] = true;
                 values[i] = 0;
             } else [[likely]] {
-                auto [value, null] = tscan.get_datum(attnum, row);
+                auto [value, null] = tscan.get_datum(logical, row);
                 values[i] = value;
                 nulls[i] = null;
             }
```

**File**: `cpp/deeplake_pg/table_data.hpp` (modified, +2/-0)
```diff
@@ -67,6 +67,7 @@ struct table_data
     inline std::string get_atttypename(AttrNumber attr_num) const noexcept;
     inline bool is_column_dropped(AttrNumber attr_num) const noexcept;
     inline int32_t get_tupdesc_index(AttrNumber attr_num) const noexcept;
+    inline int32_t logical_index_for_attnum(int32_t attnum) const noexcept;
     inline bool is_column_nullable(AttrNumber attr_num) const noexcept;
     inline bool is_column_indexed(AttrNumber attr_num) const noexcept;
     inline int32_t num_columns() const noexcept;
@@ -176,6 +177,7 @@ struct table_data
     icm::vector<bool> requested_columns_;
     icm::vector<Oid> base_typeids_;              // Cached base type OIDs for performance
     icm::vector<int32_t> active_column_indices_; // Maps logical index to TupleDesc index (excludes dropped)
+    icm::vector<int32_t> tupdesc_to_logical_;    // Maps TupleDesc index to logical index (-1 if dropped)
     icm::string_map<> creds_;
     TupleDesc tuple_descriptor_;
     http::uri dataset_path_ = http::uri(std::string());
```

**File**: `cpp/deeplake_pg/table_data_impl.hpp` (modified, +18/-2)
```diff
@@ -64,6 +64,12 @@ inline table_data::table_data(
         }
     }
 
+    // Build reverse mapping: TupleDesc index → logical index (-1 for dropped)
+    tupdesc_to_logical_.resize(tuple_descriptor_->natts, -1);
+    for (int32_t logical = 0; logical < static_cast<int32_t>(active_column_indices_.size()); ++logical) {
+        tupdesc_to_logical_[active_column_indices_[logical]] = logical;
+    }
+
     const auto num_active = active_column_indices_.size();
     requested_columns_.resize(num_active, false);
     base_typeids_.resize(num_active);
@@ -272,6 +278,15 @@ inline int32_t table_data::get_tupdesc_index(AttrNumber attr_num) const noexcept
     return active_column_indices_[attr_num];
 }
 
+inline int32_t table_data::logical_index_for_attnum(int32_t attnum) const noexcept
+{
+    const auto tupdesc_idx = attnum - 1;
+    if (tupdesc_idx < 0 || tupdesc_idx >= static_cast<int32_t>(tupdesc_to_logical_.size())) {
+        return -1;
+    }
+    return tupdesc_to_logical_[tupdesc_idx];
+}
+
 inline bool table_data::is_column_indexed(AttrNumber attr_num) const noexcept
 {
     return pg::pg_index::get_oid(table_name_, get_atttypename(attr_num)) != InvalidOid;
@@ -318,13 +333,14 @@ inline void table_data::add_insert_slots(int32_t nslots, TupleTableSlot** slots)
     for (int32_t i = 0; i < num_columns(); ++i) {
         auto& column_values = insert_rows_[get_atttypename(i)];
         const auto dt = get_column_view(i)->dtype();
+        const auto slot_pos = get_tupdesc_index(i);
         for (int32_t k = 0; k < nslots; ++k) {
             auto slot = slots[k];
             nd::array val;
-            if (slot->tts_isnull[i]) {
+            if (slot->tts_isnull[slot_pos]) {
                 val = (nd::dtype_is_numeric(dt) ? nd::adapt(0) : nd::none(dt, 0));
             } else {
-                val = pg::utils::datum_to_nd(slot->tts_values[i], get_base_atttypid(i), get_atttypmod(i));
+                val = pg::utils::datum_to_nd(slot->tts_values[slot_pos], get_base_atttypid(i), get_atttypmod(i));
             }
             column_values.push_back(std::move(val));
         }
```

**File**: `cpp/deeplake_pg/table_scan_impl.hpp` (modified, +10/-6)
```diff
@@ -158,19 +158,23 @@ inline std::pair<Datum, bool> table_scan::get_datum(int32_t column_number, int64
 inline void table_scan::convert_nd_to_pg(int64_t row_number, Datum* values, bool* nulls) const noexcept
 {
     for (auto col : null_columns_) {
-        nulls[col] = true;
+        const auto slot_pos = table_data_.get_tupdesc_index(col);
+        nulls[slot_pos] = true;
     }
     for (auto col : scored_columns_) {
-        nulls[col] = false;
+        const auto slot_pos = table_data_.get_tupdesc_index(col);
+        nulls[slot_pos] = false;
     }
     for (auto col : special_columns_) {
-        values[col] = pg::utils::make_special_datum(table_id_, row_number, col, table_data_.get_base_atttypid(col));
-        nulls[col] = false;
+        const auto slot_pos = table_data_.get_tupdesc_index(col);
+        values[slot_pos] = pg::utils::make_special_datum(table_id_, row_number, col, table_data_.get_base_atttypid(col));
+        nulls[slot_pos] = false;
     }
     for (auto col : process_columns_) {
+        const auto slot_pos = table_data_.get_tupdesc_index(col);
         auto [datum, is_null] = get_datum(col, row_number);
-        values[col] = datum;
-        nulls[col] = is_null;
+        values[slot_pos] = datum;
+        nulls[slot_pos] = is_null;
     }
 }
 
```

**File**: `cpp/deeplake_pg/table_storage.cpp` (modified, +6/-1)
```diff
@@ -951,10 +951,15 @@ void table_storage::create_table(const std::string& table_name, Oid table_id, Tu
 
 void table_storage::drop_table(const std::string& table_name)
 {
-    pg::table_ddl_lock_guard ddl_lock;
+    // Load metadata BEFORE acquiring the DDL lock.
+    // force_load_table_metadata() may trigger CREATE TABLE (via SPI) for tables
+    // in the S3 catalog that don't exist in pg_class yet.  CREATE TABLE goes
+    // through the table AM which also acquires the DDL lock — doing that while
+    // we already hold it would self-deadlock (LWLocks are not recursive).
     if (!table_exists(table_name)) {
         force_load_table_metadata();
     }
+    pg::table_ddl_lock_guard ddl_lock;
     if (table_exists(table_name)) {
         auto& table_data = get_table_data(table_name);
         auto creds = session_credentials::get_credentials();
```

---

### Incident Patch 15: `04874884` (2026-02-09)
**Commit Message**: Fixed failure on parallel ingestion.

**File**: `cpp/deeplake_pg/table_storage.cpp` (modified, +1/-1)
```diff
@@ -366,7 +366,7 @@ void table_storage::load_table_metadata()
                     // This avoids calling the SQL function create_deeplake_table which may not exist
                     resetStringInfo(&buf);
                     const char* qtable = quote_identifier(meta.table_name.c_str());
-                    appendStringInfo(&buf, "CREATE TABLE %s.%s (", qschema, qtable);
+                    appendStringInfo(&buf, "CREATE TABLE IF NOT EXISTS %s.%s (", qschema, qtable);
 
                     bool first = true;
                     for (const auto& col : table_columns) {
```

#### Recent Merged Pull Requests:
- **PR #3158** (closed): Fix typo in deeplake (#3149) (@bglglzd)
- **PR #3156** (closed): Add TwelveLabs Marengo embedding integration for video vector search (@mohit-twelvelabs)
- **PR #3142** (closed): fix: replace 72 bare except clauses with except Exception (@haosenwang1018)
- **PR #3141** (2026-02-15): Fix/remove serverless from dockerfile (@khustup2)
- **PR #3140** (2026-02-14): Removed 16 pg support. (@khustup2)
- **PR #3139** (2026-02-14): Stateless sync. Per db tables, indexes, schemas. (@khustup2)
- **PR #3138** (2026-02-13): Sync db catalogs. (@khustup2)
- **PR #3137** (2026-02-12): Make db creation stateless. (@khustup2)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
