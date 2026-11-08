> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/matrixorigin-matrixone-learnings.md`  
> **Source**: github ([https://github.com/matrixorigin/matrixone](https://github.com/matrixorigin/matrixone))  
> **Source Version**: `89ca3dbb`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-08T09:56:43.187Z  
> **Learning ID**: `learn-github-matrixorigin-matrixone`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): matrixorigin/matrixone

---

## 1. Executive Forensic Architecture & System Mechanics

MatrixOne is a distributed, cloud-native Hyper-converged Transactional/Analytical Processing (HSTAP) database written primarily in Go, supporting transactional OLTP, vectorized OLAP, full-text search, vector embeddings for AI workloads, and Git-style data version control (Time Travel, Branching, Fast Snapshots).

```
                            +-------------------------------------------------------+
                            |                  Client Connection                    |
                            |   (MySQL Protocol / Python SDK / SQLAlchemy Pool)     |
                            +-------------------------------------------------------+
                                                       |
                                                       v
                            +-------------------------------------------------------+
                            |                       CN Proxy                        |
                            |           (Ingress router, port guards)               |
                            +-------------------------------------------------------+
                                                       |
                                                       v
                            +-------------------------------------------------------+
                            |                   Compute Node (CN)                   |
                            |  +-------------------------------------------------+  |
                            |  | Front-end & SQL Parser (MySQL dialect / Lexer)  |  |
                            |  +-------------------------------------------------+  |
                            |                          |                            |
                            |  +-------------------------------------------------+  |
                            |  | SQL Planner (QueryBuilder, TypeCheck, Coercion) |  |
                            |  +-------------------------------------------------+  |
                            |                          |                            |
                            |  +-------------------------------------------------+  |
                            |  | Vectorized Execution Engine (colexec, batches)  |  |
                            |  | - ValueScan, External Readers (CSV/JSONLINE)   |  |
                            |  | - SIMD Operators & Null Mask Bitmaps            |  |
                            |  +-------------------------------------------------+  |
                            +-------------------------------------------------------+
                                                       |
                     +---------------------------------+---------------------------------+
                     v                                                                   v
+------------------------------------------+                       +------------------------------------------+
|         Transaction Node (TN/DN)         |                       |            Log Service (Log)             |
|   Metadata, Lockservice, Checkpointing   |                       |   Dragonboat Raft consensus for WAL      |
+------------------------------------------+                       +------------------------------------------+
                     \                                                                   /
                      \---------------------------------+-------------------------------/
                                                        |
                                                        v
                                   +------------------------------------------+
                                   |          FileService / ObjectIO          |
                                   |  Tiered Storage: MemCache -> Warm Disk   |
                                   |      Cache -> Remote Object (S3/OSS)     |
                                   +------------------------------------------+
```

### Subsystem Boundaries & Invariant Contracts
1. **Frontend & Planning Subsystem (`pkg/sql/parsers`, `pkg/sql/plan`)**:
   Translates AST into physical operator DAGs (`planpb.Query`). Enforces strict type lattices and coercion rules (`fixedTypeCastRule1`). If coercion falsely flags that two disparate domain types (e.g., `T_enum` and `T_uint16`) require no cast because they share an underlying representation, downstream physical vector execution violates memory boundaries and panics.
2. **Vectorized Execution Subsystem (`pkg/sql/colexec`, `pkg/container/vector`, `pkg/container/batch`, `pkg/container/nulls`)**:
   Processes column-oriented columnar arrays (`vector.Vector`) grouped into `batch.Batch`. Bitmaps track nullability (`nulls.Nulls`). Vector operations such as slice shrinking or filtering must maintain absolute alignment between the physical fixed-width payload arrays and their accompanying null bitmasks across non-zero slice offsets.
3. **External ETL Engine (`pkg/sql/colexec/external`)**:
   Streams, parallel-tokenizes, and maps CSV and JSONLINE structures into typed vectors. Distinguishes direct loading, external queries, Kafka streaming, and string parsing. Enforces precision guards: numeric literals must round via exact decimal half-away arithmetic, rejecting floating-point truncation that mutates integer values above $2^{53}$.
4. **Storage & Object Caching Engine (`pkg/fileservice`, `pkg/vm/engine/tae/blockio`)**:
   Provides tiered caching (In-Memory LRU/FIFO $\to$ Local NVMe DiskCache $\to$ Cloud Object Storage). Multiple concurrent workers accessing identical object extents must coordinate cache-fill tasks to eliminate duplicate I/O and CPU decompression stamps, while safely falling back to independent reads if caller contexts are canceled.
5. **System Orchestration & Dynamic Cluster Lifecycle (`cmd/mo-service/lifecycle.go`)**:
   Governs multi-tenant CN, TN, and Log service shutdown sequences. The supervisor implements strict phased drain windows: CN Proxy $\to$ CN $\to$ Python Engine $\to$ TN $\to$ Log Service. If any phase encounters a non-nil error, subsequent teardowns fail-stop immediately to prevent split-brain commit states or corrupt handoffs.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Vectorized Bitmask Offset Alignment Invariant
**RULE**:
When mutating, filtering, or shrinking columnar vectors in-place with a non-zero row offset (`offset > 0`), the companion nullability and grouping bitmasks MUST be remapped using an offset-aware algorithm (`RemapMaskOrderedWithOffset`). Systems MUST NOT apply offset-free mask operations directly to offset-shifted payload memory.

**WHY**:
Columnar vectors decouple physical payload memory (e.g., continuous `int32` buffers) from null bitmaps (`nulls.Nulls`). If payload slicing shifts elements starting at index `offset`, but the bitmap filtering function scans from bit index `0`, the bitmap becomes misaligned relative to the payload. A row that is non-null can inherit the null bit of a preceding row, and vice versa. This defect causes silent data corruption in secondary index scans, causing subsequent updates or deletes to miss target rows.

**WHEN TO APPLY**:
Any columnar data processor, analytical execution engine (Go, C++, Rust), or database kernel performing in-place batch filtering, projection shrinking, or vector compaction where slices are represented as `(pointer + offset * size, length)`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// RemapMaskOrderedWithOffset aligns the bitmap when shrinking a vector
// where payload data begins at an offset relative to original allocation.
func RemapMaskOrderedWithOffset(
	destBitmap *bitmap.Bitmap,
	srcBitmap *bitmap.Bitmap,
	sel []int32,
	offset int,
) {
	destBitmap.Reset()
	if srcBitmap.IsEmpty() {
		return
	}
	for i, idx := range sel {
		// INVARIANT: Source bit address MUST incorporate the offset
		srcBitIdx := uint64(int(idx) + offset)
		if srcBitmap.Contains(srcBitIdx) {
			destBitmap.Add(uint64(i))
		}
	}
}

// In-place vector filter maintaining payload/mask synchronization
func ShrinkFixedByMaskWithOffset[T any](
	vec *vector.Vector,
	sel []int32,
	offset int,
) {
	slice := vector.MustFixedColWithTypeCheck[T](vec)
	// 1. Shift payload memory
	for i, idx := range sel {
		slice[i] = slice[int(idx)+offset]
	}
	vec.SetLength(len(sel))
	
	// 2. Shift and remap null bitmap using identical offset
	nulls.FilterByMaskInPlaceWithOffset(vec.GetNulls(), sel, offset)
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Slicing payload with offset, but filtering bitmap without offset
func BuggyShrinkFixedByMask[T any](vec *vector.Vector, sel []int32, offset int) {
	slice := vector.MustFixedColWithTypeCheck[T](vec)
	for i, idx := range sel {
		slice[i] = slice[int(idx)+offset] // Payload correctly offsets
	}
	vec.SetLength(len(sel))

	// DISASTER: FilterByMaskInPlace assumes sel points directly into bitmap from 0.
	// Null bits are read from sel[i] instead of (sel[i] + offset), desynchronizing data.
	vec.GetNulls().FilterByMaskInPlace(sel)
}
```

**VERIFICATION METHOD**:
Automated property-based testing generating batches of 10,000 rows with pseudo-random null densities. Apply random selections with non-zero offsets, execute updates on secondary-index columns, and assert:
```go
require.Equal(t, originalVal[sel[i]+offset], resultVal[i])
require.Equal(t, originalNulls.Contains(uint64(sel[i]+offset)), resultNulls.Contains(uint64(i)))
```

---

### 2. Multi-Stage Lowering Intermediate Carrier Preservation
**RULE**:
When lowering SQL constructs (such as `VALUES` clauses containing subqueries, vector embeddings, or mixed-type expressions) into physical relational operators (such as `VALUE_SCAN` or `UNION ALL`), expression binders MUST explicitly preserve physical byte-domain carriers and assign concrete target column types to bare `NULL` literals. The planner MUST NOT bind secondary parsing casts over constants that are already materialized into target byte representations.

**WHY**:
In vectorized engines, complex literals (such as vector embeddings `[1.0, 2.0, 3.0]`) are materialized early by the parser/binder into continuous physical byte arrays (`Literal_VecVal` or string carriers). If a query with mixed scalar subqueries lowers into a `UNION ALL`, the generic planner often synthesizes cast functions (`appendCastBeforeExpr`) over child branches. If an assignment cast is bound over an already materialized byte carrier, the cast function attempts to re-parse the raw bytes as ASCII/JSON text, failing with `Error 20101: malformed vector input`. Additionally, untyped bare `NULL` literals (`T_any`) cause vector concatenation operators (`pSpool.GetCopiedBatch`) to panic because they cannot merge an untyped vector with a typed physical vector.

**WHEN TO APPLY**:
Query optimizers, plan binders, and intermediate representation (IR) lowering modules when transforming DML statements (`INSERT INTO ... VALUES`, `REPLACE INTO ... VALUES`, `UNION ALL`) involving composite literals, subqueries, or polymorphic `NULL` placeholders.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// TypedValue preserves pre-materialized carriers and resolves bare NULLs
func TypedValue(colIdx int, expr *plan.Expr, targetCol *plan.ColDef) (*plan.Expr, error) {
	// 1. Resolve bare NULLs from T_any into the destination column type
	if expr.Typ.Id == int32(types.T_any) && expr.GetLit() != nil && expr.GetLit().Isnull {
		typed := DeepCopyExpr(expr)
		typed.Typ = targetCol.Typ
		typed.Typ.NotNullable = false
		return typed, nil
	}

	targetID := types.T(targetCol.Typ.Id)

	// 2. Invariant: Vector destinations with already materialized byte buffers
	// MUST NOT undergo string-to-vector parsing casts.
	if (targetID == types.T_array_float32 || targetID == types.T_array_float64) && 
		types.T(expr.Typ.Id) != targetID {
		
		if lit := expr.GetLit(); lit != nil && !lit.Isnull {
			if sval, ok := lit.Value.(*plan.Literal_Sval); ok {
				// Re-emit constant directly in the array domain (VecVal)
				typed := DeepCopyExpr(expr)
				typed.Typ = targetCol.Typ
				typed.Typ.NotNullable = false
				typed.Expr = &plan.Expr_Lit{Lit: &plan.Literal{
					Isnull: false,
					Value:  &plan.Literal_VecVal{VecVal: string(sval.Sval)},
				}}
				return typed, nil
			}
		}
		// Non-literal sources fall through to standard checked casting
		return appendCastBeforeExpr(expr, targetCol.Typ)
	}

	return expr, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Blindly applying assignment casts to IR expressions during lowering
func BuggyLowerSubqueryValueScan(expr *plan.Expr, targetTyp plan.Type) (*plan.Expr, error) {
	// If expr is a vector literal already encoded into binary bytes,
	// appending a cast here treats binary byte buffer as a string of digits,
	// throwing "malformed vector input" at execution time.
	// Furthermore, bare NULL (T_any) passes through untouched, crashing pSpool.
	return appendCastBeforeExpr(expr, targetTyp)
}
```

**VERIFICATION METHOD**:
Execute integration plans combining vector literals, bare NULLs, and subqueries:
`INSERT INTO t VALUES (1, '[1.0, 2.0, 3.0]', (SELECT 42)), (2, NULL, NULL)`.
Assert that `plan.Node_UNION_ALL` outputs identical physical vector types across all children without string re-parsing errors.

---

### 3. Distinct Semantic Identity Coercion Invariant
**RULE**:
When type-checking binary expressions or set operations, if two types share an underlying physical bit-width representation (e.g., `T_enum` representing member ordinals as `uint16`, and `T_uint16`), the type-checking engine MUST retain the domain type identity and force an explicit coercion/cast. The coercion engine MUST NOT evaluate equality diagonals solely on physical storage width.

**WHY**:
In MySQL compatibility mode, `ENUM` values evaluate by their 1-based numeric ordinal index in numeric contexts. Normalizing `T_enum` to `T_uint16` before checking type-cast tables causes the binary pair `(T_enum, T_uint16)` to land on the diagonal `(T_uint16, T_uint16)`. If the diagonal rule assumes "identical types require no cast", no cast operator is inserted into the execution plan. At runtime, the comparison kernel receives a slice of `types.Enum` and a slice of `uint16`, resulting in a runtime memory violation, unsafe type-assertion panic (`casting SMALLINT UNSIGNED vector to []types.Enum`), or plan binding rejections on ordered comparisons.

**WHEN TO APPLY**:
Type checkers, SQL compilers, expression coercion resolvers, and AST binders dealing with domain wrappers, enums, bitmaps, or value types that compile to identical primitive storage types.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
func FixedTypeCastRule1(s1, s2 types.Type) (bool, types.Type, types.Type) {
	enumLeft := s1.Oid == types.T_enum
	enumRight := s2.Oid == types.T_enum

	// Normalize to underlying numeric domain for rule evaluation
	if enumLeft {
		s1 = types.T_uint16.ToType()
	}
	if enumRight {
		s2 = types.T_uint16.ToType()
	}

	// CRITICAL INVARIANT: If exactly one operand was originally ENUM and both
	// now resolve to uint16, force uint16 conversion so the ENUM operand is
	// explicitly cast to an integer vector before reaching the execution kernel.
	if enumLeft != enumRight && s1.Oid == types.T_uint16 && s2.Oid == types.T_uint16 {
		return true, s1, s2
	}

	// Identical types without semantic mismatch bypass casting
	if s1.Oid == s2.Oid && !enumLeft && !enumRight {
		return false, s1, s2
	}

	check := fixedBinaryCastRule1[s1.Oid][s2.Oid]
	if check.cast {
		return true, check.left.ToType(), check.right.ToType()
	}
	return false, s1, s2
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Blind normalization prior to diagonal checking
func BuggyTypeCheck(s1, s2 types.Type) (bool, types.Type, types.Type) {
	if s1.Oid == types.T_enum { s1 = types.T_uint16.ToType() }
	if s2.Oid == types.T_enum { s2 = types.T_uint16.ToType() }

	// BUG: s1.Oid == s2.Oid triggers, returning (false, uint16, uint16).
	// Caller assumes no cast is needed, but s1 is still physically a T_enum vector!
	if s1.Oid == s2.Oid {
		return false, s1, s2
	}
	return true, s1, s2
}
```

**VERIFICATION METHOD**:
Unit testing binary operators (`=`, `<=>`, `<`, `>`, `+`, `*`) against matrix permutations of `T_enum` and `T_uint16` in both left and right operand positions. Assert `result.needCast == true` and that the execution kernel evaluates equality without panic.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Round JSONLINE Integer Assignments Without Precision Loss (BUG-SQL-01)
- **Context**: External table ETL engine, `pkg/sql/colexec/external/external.go`
- **What Was Expected**:
  Loading numeric JSONLINE files (`SELECT ... FROM external` or `LOAD DATA`) into integer columns must round fractional values using standard decimal assignment half-away-from-zero rounding (`-2.5 -> -3`, `"1.7" -> 2`), while integers above $2^{53}$ (e.g., `9007199254740993.0`) must retain absolute precision.
- **What Actually Happened**:
  JSONLINE loading truncated fractional values towards zero instead of rounding, while intermediate casts via `float64` corrupted integer values exceeding 53 bits of mantissa.
- **Evidence in Repo**:
  Commit `3f1d17d3`, PR #32359, fixing Issue #31923. Test cases in `pkg/sql/colexec/external/jsonline_integer_rounding_test.go`.
- **Root Cause**:
  `getColData` checked `roundExternalInteger` exclusively for CSV format:
  `param.Extern.ExternType == int32(plan.ExternType_EXTERNAL_TB) && param.Extern.Format == tree.CSV`.
  JSONLINE records fell into default paths that either parsed through float conversions or truncated decimals directly.
- **Remediation Code Diff**:
```go
@@ -2186,7 +2188,15 @@ func getColData(bat *batch.Batch, line []csvparser.Field, rowIdx int, param *Ext
-	roundExternalInteger := param.Extern.ExternType == int32(plan.ExternType_EXTERNAL_TB) && param.Extern.Format == tree.CSV
+	roundTextInteger := (param.Extern.ExternType == int32(plan.ExternType_EXTERNAL_TB) && param.Extern.Format == tree.CSV) ||
+		(param.Extern.Format == tree.JSONLINE && (param.Extern.ExternType == int32(plan.ExternType_EXTERNAL_TB) ||
+			param.Extern.ExternType == int32(plan.ExternType_LOAD)))
 	switch id {
 	case types.T_int8:
-		d, err := parseCSVInt(field, 8, roundExternalInteger)
+		d, err := parseCSVInt(field, 8, roundTextInteger)
```
- **Lesson**: Numeric textual ingestion across disparate formats (CSV, JSONLINE) must route through shared exact decimal parsers rather than format-specific branching or IEEE-754 floating-point paths.

---

### Incident 2: Memory Panic on Mixed ENUM and SMALLINT UNSIGNED Comparison (BUG-SQL-02)
- **Context**: SQL Planner function binding, `pkg/sql/plan/function/type_check.go`
- **What Was Expected**:
  Comparing an `ENUM` column with a `SMALLINT UNSIGNED` column (`WHERE enum_col = u16_col`) must bind correctly by casting the ENUM's ordinal representation to `uint16` and evaluating comparison in the `uint16` domain.
- **What Actually Happened**:
  Execution panic occurred in the comparison kernel:
  `panic: casting SMALLINT UNSIGNED vector to []types.Enum`.
  Ordered comparisons (`<`, `<=`, `>`, `>=`) and arithmetic operations (`+`, `-`, `*`) failed at plan bind time with `bad value [ENUM SMALLINT UNSIGNED]`.
- **Evidence in Repo**:
  Commit `fbcca458`, PR #32358, fixing Issue #31901. Coverage in `pkg/sql/plan/enum_uint16_plan_test.go` and `pkg/tests/issues/issue_31901_test.go`.
- **Root Cause**:
  In `fixedTypeCastRule1`, both `s1` and `s2` were rewritten to `types.T_uint16` when their `Oid` was `types.T_enum`. When an ENUM was paired with a `SMALLINT UNSIGNED` (which naturally has `Oid == types.T_uint16`), both types became `T_uint16`. The function then checked the equal-type diagonal, concluded no cast was necessary, and returned `needCast = false`. Consequently, the planner never bound a cast node, passing raw `T_enum` vectors directly into `uint16` execution functions.
- **Remediation Code Diff**:
```go
@@ -29,10 +29,12 @@ func fixedTypeCastRule1(s1, s2 types.Type) (bool, types.Type, types.Type) {
-	if s1.Oid == types.T_enum {
+	enumLeft := s1.Oid == types.T_enum
+	enumRight := s2.Oid == types.T_enum
+	if enumLeft {
 		s1 = types.T_uint16.ToType()
 	}
-	if s2.Oid == types.T_enum {
+	if enumRight {
 		s2 = types.T_uint16.ToType()
 	}
@@ -54,6 +56,20 @@ func fixedTypeCastRule1(s1, s2 types.Type) (bool, types.Type, types.Type) {
+	if enumLeft != enumRight && s1.Oid == types.T_uint16 && s2.Oid == types.T_uint16 {
+		return true, s1, s2
+	}
```
- **Lesson**: Type normalization during function resolution must track pre-normalization identity flags to avoid false positives on identity-check diagonals.

---

### Incident 3: Vector Assignment Crash & DATE/TIME Set Truncation (BUG-SQL-03)
- **Context**: DML Planner and Set Operations, `pkg/sql/plan/bind_insert.go`, `pkg/sql/plan/query_builder.go`, `pkg/sql/plan/build_constraint_util.go`
- **What Was Expected**:
  1. `INSERT ... VALUES` containing both subqueries and bare `NULL`s into vector columns must not panic or fail vector parsing.
  2. Set operations (`UNION`, `INTERSECT`, `EXCEPT`) combining `DATE` and `TIME` columns must resolve to `DATETIME`, preserving the time-of-day component and maximum fractional second precision (FSP).
  3. `BIT` literals must not be treated as pre-parsed vector byte carriers.
- **What Actually Happened**:
  - `pSpool.GetCopiedBatch` panicked on bare `NULL` because it remained untyped `T_any`.
  - Materialized vector literals in subquery rows failed with `Error 20101: malformed vector input` when lowered into `UNION ALL`.
  - Combining `DATE` and `TIME` in `UNION` picked `DATE` under coalesce scoring, silently dropping time components.
  - Passing a `BIT` literal into vector fast-paths bypassed array validation, causing heap alignment panics during float decoding.
- **Evidence in Repo**:
  Commit `7a73a739`, PR #32350, fixing Issues #31882 and #31913. Test suites in `dml_vector_subquery_consumer_test.go`, `set_temporal_common_type_test.go`, `values_subquery_null_type_test.go`.
- **Root Cause**:
  `buildValueScanWithSubqueries` lacked target column definitions (`targetCols []*plan.ColDef`), leaving bare `NULL`s as `T_any` and treating pre-encoded vector byte constants as plain strings that needed re-casting. In `buildUnionWithResultLen`, set-operation type resolution lacked a temporal combination check for `(DATE, TIME)`. In `MakeInsertValueConstExpr`, `P_bit` literals fell into array-handling fast paths without dimensionality validation.
- **Remediation Code Diff**:
```go
@@ -2117,6 +2117,21 @@ func MakeInsertValueConstExpr(...) {
 	case types.T_blob, types.T_binary, types.T_varbinary, types.T_text, types.T_datalink, types.T_geometry,
 		types.T_array_float32, types.T_array_float64:
+		if colType.Oid.IsArray() && numVal.ValType == tree.P_bit {
+			return nil, nil // Force fallback to generic checked binder
+		}
@@ -784,6 +784,36 @@
+func setOperationDateTimeCommonType(source []types.Type) (types.Type, bool) {
+	hasDate, hasTime := false, false
+	var scale int32
+	for _, typ := range source {
+		switch typ.Oid {
+		case types.T_date: hasDate = true
+		case types.T_time: hasTime = true
+		case types.T_datetime, types.T_timestamp:
+		default: return types.Type{}, false
+		}
+		if typ.Scale > scale { scale = typ.Scale }
+	}
+	if !hasDate || !hasTime { return types.Type{}, false }
+	return types.New(types.T_datetime, scale, scale), true
+}
```
- **Lesson**: Lowering operations that transform single-node expressions into distributed execution sub-DAGs must propagate explicit target schema types to all leaf literals.

---

### Incident 4: Cache Stampede & Redundant Decompression in Tiered Storage (BUG-FS-04)
- **Context**: FileService Tiered Cache, `pkg/fileservice`, PR #32361 / Backport of #28918
- **What Was Expected**:
  Multiple concurrent Top-N scan queries reading the same immutable columnar extent should read and decompress from disk cache exactly once, sharing the in-memory decoded vector.
- **What Actually Happened**:
  Cache stampede occurred when multiple readers simultaneously missed `MemCache`. Each worker independently performed redundant reads and LZ4/Snappy decompressions on the identical warm `DiskCache` extent, causing CPU throttling and memory pressure.
- **Evidence in Repo**:
  Issue #32223, PR #32361.
- **Root Cause**:
  Absence of a shared in-flight single-flight or coordinated filling barrier for warm disk reads. Readers bypassed synchronization when dropping from memory cache to disk cache.
- **Remediation Code Diff**:
  Introduced a coordinated warm-disk fill barrier with generation lifetimes. Waiting follower threads recheck `MemCache` upon completion of the leader's decompression task. If the leader task fails or the follower context times out, followers fall back independently to standard reads without deadlock.
- **Lesson**: In multi-tiered cache systems, single-flight deduplication must be enforced at *every* tier boundary, not merely at the top-level memory cache.

---

### Incident 5: Null Mask Desynchronization During Vector Offset Shrinking (BUG-VEC-05)
- **Context**: Vector manipulation and bitmap math, `pkg/container/vector`, `pkg/container/nulls`, `pkg/common/bitmap`
- **What Was Expected**:
  Shrinking or filtering a fixed-width vector slice with an offset (`offset > 0`) must keep the payload values and the nullability bitmask aligned.
- **What Actually Happened**:
  `shrinkFixedByMask` copied the payload elements starting from index `idx + offset`, but filtered the null bitmask via `FilterByMaskInPlace` starting at bit index 0 without accounting for `offset`. Rows became misaligned with their null status, causing secondary unique index evaluations to read corrupt data and fail subsequent deletes.
- **Evidence in Repo**:
  Issue #32249, PR #32360, upstream PR #27446.
- **Root Cause**:
  `pkg/common/bitmap` lacked an offset-aware remapping primitive, forcing callers to either ignore the offset or perform unsafe in-place operations.
- **Remediation Code Diff**:
  Implemented `RemapMaskOrderedWithOffset` and updated `vector.ShrinkFixedByMask` to pass `offset` down to `FilterByMaskInPlaceWithOffset`.
- **Lesson**: An in-place array transformation on columnar structures with decoupled null bitmasks must always apply atomic or synchronized offset coordinate translations.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Precision Guard on Mantissa Overflow**:
  When parsing strings such as `"1000000000000000000000e-21"`, an intermediate integer parse will overflow `uint64` despite the final decimal scaling resolving to `1`. Ingestion parsers must parse the complete mantissa and exponent using arbitrary-precision decimal structures (`bison`/`decimal128`) before enforcing boundary width constraints on destination types (`T_int8`, `T_int16`, etc.).
- **Unsigned Negative Zero Permissibility**:
  In `parseCSVUint`, the input string `"-0.0"` or `"-0"` must be classified as valid unsigned zero (`0`), whereas any negative fraction (e.g., `"-0.1"`, `"-1.6"`) must return an unsigned out-of-range error. Code must test:
  ```go
  if dec.IsNegative() {
      if dec.IsZero() {
          return 0, nil // Permitted: -0 maps to unsigned 0
      }
      return 0, moerr.NewOutOfRange(...) // Rejected: negative value for unsigned
  }
  ```
- **Operator Precedence in Set Operations**:
  When determining common types across multi-branch queries, temporal evaluations must take precedence over pure string coercion:
  `DATE + TIME -> DATETIME` must be evaluated **before** `PureCharCommonType`, otherwise the parser implicitly coerces both `DATE` and `TIME` into `VARCHAR`, destroying binary temporal representation.

### 2. Infinite Loop & Recursion Guards
- **AST Subquery Flattening Recursion Depth**:
  In `builder.flattenSubqueries(dummyID, expr, rowCtx)`, expression traversal must enforce recursion depth counters (`depth > 128` triggers compilation error). Subqueries within `VALUES` lists must generate detached non-cacheable project nodes rather than inline nested expansion to avoid cycles.
- **Coordinated Admission Wait Queue Termination**:
  In `_Admission` and `_Executor` (`clients/python/matrixone/_analytics_workers.py`):
  When closing an admission gate, waiting futures must be canceled and evacuated inside a synchronized lock block to prevent deadlocks:
  ```python
  def set_open(self, value):
      rejected = []
      with self._lock:
          self._closed = not value
          if not value:
              while self._waiters:
                  future = self._waiters.popleft()
                  if future.set_running_or_notify_cancel():
                      rejected.append(future)
      # Execution outside the lock to prevent re-entrant deadlock
      for future in rejected:
          future.set_exception(RuntimeError('Analytics admission is closed'))
  ```

### 3. UI & UX / Client Micro-Mechanics
- **Non-Transactional SQL Command Classification**:
  Commands such as `DATA BRANCH MERGE`, `DATA BRANCH PICK`, and `ALTER TABLE` fail inside implicit transactions (`autocommit=False`). The client classifier (`is_non_transactional_statement` in `clients/python/matrixone/_utils.py`) avoids regular expressions to eliminate ReDoS vulnerabilities. It uses a bounded linear token scan that handles MySQL comments:
  ```python
  # Handles executable comments: /*!50001 ALTER TABLE ... */
  if sql.startswith("/*!", pos):
      pos += 3
      if sql[pos : pos + 5].isdigit():
          pos += 5
      continue
  ```
- **Connection Detachment Before Disposal**:
  When an unrestorable connection checkout occurs in SQLAlchemy pools, calling `conn.invalidate()` can trigger listeners that raise exceptions. The client must detach first:
  ```python
  def discard_unrestored_connection(conn):
      if conn.closed or conn.invalidated: return
      raw = getattr(conn.connection, "dbapi_connection