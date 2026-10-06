# Forensic Learning Record (Deep Inspection): dingodb/dingo

> **Canonical Artifact**: `07_PROJECT_LEARNING/dingodb-dingo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dingodb/dingo](https://github.com/dingodb/dingo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:57:38.427Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dingodb/dingo`
- **Description**: A multi-modal vector database that supports upserts and vector queries using unified SQL (MySQL-Compatible) on structured and unstructured data, while meeting the requirements of high concurrency and ultra-low latency.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1703 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1064** (2024-03-28): **[Bug]: Exec protostuff read error, thread: [Thread[<192.168.1.154:8765/86/client>-329,5,GLOBAL]], message: Protocol message tag had invalid wire type..**
  *Symptoms*: ### What happened?  我的启动方式是: dingo-store使用docker方式启动，如下： ![2024-03-27 22-52-01屏幕截图](https://github.com/dingodb/dingo/assets/58242269/aa232113-10ed-40c8-af3e-9b2a6954c64c) dingo计算层使用IDEA打开的源码方式启动,如下: ![2024-03-27 22-53-42屏幕截图](https://github.com/dingodb/dingo/assets/58242269/05e0fd71-b0f7-411c-b87a-c7bbba1c9055) 出现的问题，当我插入数据时，会报以下的错误， ![2024-03-27 22-55-09屏幕截图](https://github.com/dingodb/dingo/assets/58242269/6fa68e0f-8065-4e62-91d4-d2939280383c) ====================================== 我做过测试：计算层+存储层都有docker启动时，插入数据和查询数据没有问题 计算层通过源码启动，存储层使用docker启动，插入数据和查询数据就会出现以上问题，创建表没有出问题  ### Version  0.8.0  ### Contact Details  wusf@uniplore.io  || 微信昵称：保持理智（在交流群里）  ### Relevant log output  ```Shell 22:58:26.730 [<192.168.1.154:33622/108/server>-59] ERROR io.dingodb.driver.DingoMeta - Prepare and execute error, sql: <[INSERT INTO test(id,name) values(1, 'qwe')]>. java.lang.NullPointerException: null 	at io.dingodb.exec.transaction.impl.TransactionCache.<init>(TransactionCache.java:40) 	at io.dingodb.exec.transaction.base.BaseTransaction.<init>(BaseTransaction.java:109) 	at io.dingodb.exec.transaction.impl.OptimisticTransaction.<init>(OptimisticTransaction.java:45) 	at io.dingodb.exec.transaction.impl.TransactionManager.createTransaction(TransactionManager.java:58) 	at io.dingodb.driver.DingoConnection.createTransaction(DingoConnection.java:194) 	at io.dingodb.driver.DingoDriverParser.parseQuery(DingoDriverParser.java:345) 	at io.dingodb.driver.DingoMeta.prepareAndExecute(Din

- **Issue #535** (2023-01-17): **[Bug]: Sql execution failed if threre are >= 20 elements in `IN` list**
  *Symptoms*: ### What happened?  Error message:  ERROR io.dingodb.driver.DingoMeta - Prepare and execute error, sql: <[update test3 set age=35 where name in('a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t')]>  ### Version  0.5.0-SNAPSHOT  ### Contact Details  _No response_  ### Relevant log output  _No response_

- **Issue #506** (2023-01-04): **[Bug]: Fail to encode exceptions**
  *Symptoms*: ### What happened?  Encoding of exceptions failed and the driver client cannot get response.  This occurs when there are `null` fields in the exception thrown.  ### Version  0.5.0-SNAPSHOT  ### Contact Details  _No response_  ### Relevant log output  _No response_

- **Issue #438** (2022-11-14): **[Bug]: Insertion failed with null and non-null double type.**
  *Symptoms*: ### What happened?  Create a table with  ```sql create table test (     id int,     name varchar(20),     age int,     amount double,     birthday date,     primary key(id) ) ```  insert data with  ```sql insert into test values (1, 'Steven', 19, 23.5, '2010-01-09'), (2, 'Lisi', 18, null, '1987-11-11'), (3, 'Kitty', 22, 1000.0, '1990-09-15') ```  The insertion failed with exception "org.apache.avro.AvroRuntimeException: Unknown datum type java.math.BigDecimal".   ### Version  0.5.0-SNAPSHOT  ### Contact Details  _No response_  ### Relevant log output  _No response_

- **Issue #412** (2022-10-09): **[Bug]: Using timestamp type in sql parameters results in error.**
  *Symptoms*: ### What happened?  A bug happened!  ### Version  0.4.0-SNAPSHOT  ### Contact Details  _No response_  ### Relevant log output  _No response_

- **Issue #409** (2022-10-08): **[Bug]: Empty strings in date arrays results in errors.**
  *Symptoms*: ### What happened?  Empty strings are casted to date time type as null, but null values are not allowed in collection types. Should explicitly throws an exception for it.  ### Version  0.4.0-SNAPSHOT  ### Contact Details  _No response_  ### Relevant log output  _No response_

- **Issue #406** (2022-09-30): **[Bug]: Errors occurred using map as default value.**
  *Symptoms*: ### What happened?  Consider the following table:  ```sql create table table_test (     id int,     name char(8),     data map default map['a', 1, 'b', 2],     primary key(id) ) ```  then insert data by  ```sql insert into {table}(id, name) values(1, 'ABC') ```  Error occured to evaluated the default value.  ### Version  0.4.0-SNAPSHOT  ### Contact Details  _No response_  ### Relevant log output  _No response_

- **Issue #390** (2022-09-26): **[Bug]: Failed to insert arrays with mixed type of values.**
  *Symptoms*: ### What happened?  Insert some data into a table with the following sql:  ```sql insert into {table} values(1, array[1, 2.1, 3.2]) ```  if the type of the array column is "DOUBLE ARRAY", the insertion is expected to succeed.   ### Version  0.4.0-SNAPSHOT  ### Contact Details  _No response_  ### Relevant log output  _No response_

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

### Incident Patch 1: `bb96a741` (2026-09-23)
**Commit Message**: Fix mixed-charset CASE result typing

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/DingoSqlToRelConverter.java` (modified, +42/-0)
```diff
@@ -76,10 +76,12 @@
 import org.apache.calcite.sql.SqlSelect;
 import org.apache.calcite.sql.SqlSelectKeyword;
 import org.apache.calcite.sql.SqlUtil;
+import org.apache.calcite.sql.fun.SqlCase;
 import org.apache.calcite.sql.fun.SqlStdOperatorTable;
 import org.apache.calcite.sql.parser.SqlParserUtil;
 import org.apache.calcite.sql.type.BasicSqlType;
 import org.apache.calcite.sql.type.SqlTypeName;
+import org.apache.calcite.sql.type.SqlTypeUtil;
 import org.apache.calcite.sql.validate.SqlValidator;
 import org.apache.calcite.sql.validate.SqlValidatorScope;
 import org.apache.calcite.sql.validate.SqlValidatorUtil;
@@ -141,6 +143,46 @@ public DingoSqlToRelConverter(
 
     @Override
     protected @Nullable RexNode convertExtendedExpression(@NonNull SqlNode node, Blackboard bb) {
+        if (node.getKind() == SqlKind.CASE) {
+            SqlCase caseCall = (SqlCase) node;
+            RelDataType resultType = bb.getValidator().getValidatedNodeType(caseCall);
+            if (resultType.getCharset() != null) {
+                boolean mixed = false;
+                for (SqlNode branch : caseCall.getThenOperands()) {
+                    if (!SqlUtil.isNullLiteral(branch, false)) {
+                        RelDataType branchType = bb.getValidator().getValidatedNodeType(branch);
+                        mixed |= SqlTypeUtil.isCharacter(branchType)
+                            && !resultType.getCharset().equals(branchType.getCharset());
+                    }
+                }
+                SqlNode otherwise = caseCall.getElseOperand();
+                if (otherwise != null && !SqlUtil.isNullLiteral(otherwise, false)) {
+                    RelDataType branchType = bb.getValidator().getValidatedNodeType(otherwise);
+                    mixed |= SqlTypeUtil.isCharacter(branchType)
+                        && !resultType.getCharset().equals(branchType.getCharset());
+                }
+                if (mixed) {
+                    // Calcite's convertCase repeats the SQL type-name-only fast path and
+                    // casts every Rex branch to the first branch's charset.
+                    RexBuilder rb = bb.getRexBuilder();
+                    List<RexNode> operands = new ArrayList<>(caseCall.getWhenOperands().size() * 2 + 1);
+                    for (int i = 0; i < caseCall.getWhenOperands().size(); i++) {
+                        SqlNode when = caseCall.getWhenOperands().get(i);
+                        operands.add(SqlUtil.isNullLiteral(when, false)
+                            ? rb.makeNullLiteral(rb.getTypeFactory().createSqlType(SqlTypeName.BOOLEAN))
+                            : bb.convertExpression(when));
+                        SqlNode branch = caseCall.getThenOperands().get(i);
+                        operands.add(SqlUtil.isNullLiteral(branch, false)
+                            ? rb.makeNullLiteral(resultType)
+                            : rb.ensureType(resultType, bb.convertExpression(branch), false));
+                    }
+                    operands.add(otherwise == null || SqlUtil.isNullLiteral(otherwise, false)
+                        ? rb.makeNullLiteral(resultType)
+                        : rb.ensureType(resultType, bb.convertExpression(otherwise), false));
+                    return rb.makeCall(resultType, SqlStdOperatorTable.CASE, operands);
+                }
+            }
+        }
         // MySQL dialect
         if (node.getKind() == SqlKind.OTHER_FUNCTION) {
             SqlOperator operator = ((SqlCall) node).getOperator();
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/DingoSqlValidator.java` (modified, +83/-0)
```diff
@@ -74,7 +74,9 @@
 import org.checkerframework.checker.nullness.qual.Nullable;
 
 import java.math.BigDecimal;
+import java.nio.charset.Charset;
 import java.util.AbstractList;
+import java.util.ArrayList;
 import java.util.Calendar;
 import java.util.EnumSet;
 import java.util.List;
@@ -139,6 +141,87 @@ public static TypeCoercion createTypeCoercion(RelDataTypeFactory typeFactory,
     @Override
     public void validateCall(SqlCall call, SqlValidatorScope scope) {
         super.validateCall(call, scope);
+        if (call.getKind() != SqlKind.CASE) {
+            return;
+        }
+        // Calcite's CASE fast path compares only SQL type names, so a mixed-charset
+        // VARCHAR result inherits the first branch's charset without merging them.
+        org.apache.calcite.sql.fun.SqlCase caseCall = (org.apache.calcite.sql.fun.SqlCase) call;
+        List<RelDataType> branches = new ArrayList<>();
+        boolean nullable = false;
+        for (SqlNode branch : caseCall.getThenOperands()) {
+            if (SqlUtil.isNullLiteral(branch, false)) {
+                nullable = true;
+            } else {
+                RelDataType branchType = deriveType(scope, branch);
+                branches.add(branchType);
+                nullable |= branchType.isNullable();
+            }
+        }
+        SqlNode otherwise = caseCall.getElseOperand();
+        nullable |= otherwise == null || SqlUtil.isNullLiteral(otherwise, false);
+        if (otherwise != null && !SqlUtil.isNullLiteral(otherwise, false)) {
+            RelDataType branchType = deriveType(scope, otherwise);
+            branches.add(branchType);
+            nullable |= branchType.isNullable();
+        }
+        if (branches.size() < 2) {
+            return;
+        }
+        Charset charset = branches.get(0).getCharset();
+        if (charset == null) {
+            return;
+        }
+        boolean mixed = false;
+        for (RelDataType branch : branches) {
+            if (!SqlTypeUtil.isCharacter(branch) || branch.getCharset() == null) {
+                return;
+            }
+            mixed |= !charset.equals(branch.getCharset());
+        }
+        if (mixed) {
+            RelDataType merged = typeFactory.leastRestrictive(branches);
+            if (merged != null) {
+                setValidatedNodeType(call, typeFactory.createTypeWithNullability(merged, nullable));
+            }
+        }
+    }
+
+    @Override
+    protected void validateSelect(SqlSelect select, RelDataType targetRowType, boolean skipMeasure) {
+        super.validateSelect(select, targetRowType, skipMeasure);
+        SqlValidatorNamespace namespace = getNamespace(select);
+        RelDataType rowType = namespace.getRowType();
+        SqlNodeList selectList = select.getSelectList();
+        if (selectList.size() != rowType.getFieldCount()) {
+            return;
+        }
+        RelDataTypeFactory.Builder corrected = null;
+        for (int i = 0; i < selectList.size(); i++) {
+            SqlNode expression = selectList.get(i);
+            if (expression.getKind() == SqlKind.AS) {
+                expression = ((SqlCall) expression).operand(0);
+            }
+            RelDataTypeField field = rowType.getFieldList().get(i);
+            RelDataType validated = expression.getKind() == SqlKind.CASE
+                ? getValidatedNodeTypeIfKnown(expression) : null;
+            if (validated != null && !validated.equals(field.getType())) {
+                if (corrected == null) {
+                    corrected = typeFactory.builder();
+                    for (int j = 0; j < i; j++) {
+                        corrected.add(rowType.getFieldList().get(j));
+                    }
+                }
+                corrected.add(field.getName(), validated);
+            } else if (corrected != null) {
+                corrected.add(field);
+            }
+        }
+        if (corrected != null) {
+            RelDataType result = corrected.build();
+            namespace.setType(result);
+            setValidatedNodeType(select, result);
+        }
     }
 
     @Override
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/type/DingoSqlTypeFactory.java` (modified, +14/-7)
```diff
@@ -385,6 +385,9 @@ else if (resultType.getSqlTypeName().getName().equalsIgnoreCase("CHAR")
                     } else if (charset1.equals(charset2)) {
                         charset = charset1;
                         collation = collation1;
+                    } else if (charset1.name().startsWith("UTF-") != charset2.name().startsWith("UTF-")) {
+                        charset = charset1.name().startsWith("UTF-") ? charset1 : charset2;
+                        collation = charset == charset1 ? collation1 : collation2;
                     } else if (charset1.contains(charset2)) {
                         charset = charset1;
                         collation = collation1;
@@ -393,20 +396,24 @@ else if (resultType.getSqlTypeName().getName().equalsIgnoreCase("CHAR")
                         collation = collation2;
                     }
                 }
-                if (collation0 != null && charset1 != null && charset2 != null
-                    && !charset1.equals(charset2)) {
+                if (collation0 != null && collation1 != null && collation2 != null
+                    && charset1 != null && charset2 != null && !charset1.equals(charset2)
+                    && collation1.getCoercibility() != collation2.getCoercibility()) {
                     if (collation0.equals(collation1)) {
                         charset = charset1;
+                        collation = collation1;
                     } else if (collation0.equals(collation2)) {
                         charset = charset2;
+                        collation = collation2;
                     }
                 }
                 if (charset != null) {
-                    resultType =
-                        createTypeWithCharsetAndCollation(
-                            resultType,
-                            charset,
-                            collation0 != null ? collation0 : requireNonNull(collation, "collation"));
+                    SqlCollation selectedCollation = charset1 != null && charset2 != null
+                        && !charset1.equals(charset2) ? collation : collation0;
+                    resultType = createTypeWithCharsetAndCollation(
+                        resultType, charset,
+                        requireNonNull(selectedCollation != null ? selectedCollation : collation, "collation")
+                    );
                 }
             } else if (SqlTypeUtil.isExactNumeric(type)) {
                 if (SqlTypeUtil.isExactNumeric(resultType)) {
```

**File**: `dingo-test/src/test/java/io/dingodb/test/QuerySimpleExpressionTest.java` (modified, +22/-0)
```diff
@@ -146,6 +146,28 @@ public void concatKeepsRepresentableNonUnicodeCharset() throws SQLException {
             .isEqualTo("4180");
     }
 
+    @Test
+    public void casePromotesMixedCharsetsIndependentOfBranchOrder() throws SQLException {
+        String latin1 = "convert(char(128 using latin1) using latin1)";
+        String unicode = "convert(char(240,159,153,130 using utf8mb4) using utf8mb4)";
+        String unicodeValue = "case when 1=0 then " + latin1 + " else " + unicode + " end";
+        String latin1Value = "case when 1=0 then " + unicode + " else " + latin1 + " end";
+        assertThat(context.querySingleValue("select hex(" + unicodeValue + ")")).isEqualTo("F09F9982");
+        assertThat(context.querySingleValue("select length(" + unicodeValue + ")")).isEqualTo(4);
+        assertThat(context.querySingleValue("select hex(" + latin1Value + ")")).isEqualTo("E282AC");
+        assertThat(context.querySingleValue("select length(" + latin1Value + ")")).isEqualTo(3);
+        String nullableValue = "case when 1=0 then " + latin1 + " when 1=1 then " + unicode
+            + " else null end";
+        assertThat(context.querySingleValue("select hex(" + nullableValue + ")")).isEqualTo("F09F9982");
+        String nullValue = "case when 1=0 then " + latin1 + " when 1=0 then " + unicode
+            + " else null end";
+        assertThat(context.querySingleValue("select " + nullValue)).isNull();
+        try (Statement statement = context.getConnection().createStatement();
+             ResultSet result = statement.executeQuery("select " + nullableValue)) {
+            assertThat(result.getMetaData().isNullable(1)).isEqualTo(ResultSetMetaData.columnNullable);
+        }
+    }
+
     @Test
     public void convertCharsetRejectsUnrepresentableText() {
         assertThatThrownBy(() -> {
```

---

### Incident Patch 2: `07c3423d` (2026-09-23)
**Commit Message**: Fix charset-aware MySQL expressions and result encoding

**File**: `dingo-calcite/src/main/codegen/templates/Parser.jj` (modified, +1/-1)
```diff
@@ -6861,7 +6861,7 @@ SqlNode BuiltinFunctionCall() :
         ]
         <RPAREN> {
             SqlIdentifier charFunName = new SqlIdentifier(
-                charUsingCharset ? (charUsingBinary ? "char_binary" : "char_charset") : "char", s.end(this));
+                charUsingCharset ? (charUsingBinary ? "char_binary" : "char_charset") : "char_default", s.end(this));
             SqlNode sqlNode = createCall(charFunName, s.end(this), SqlFunctionCategory.STRING, null, args);
             sqlNode.putAlias("aliasName", alias);
             return sqlNode;
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/DingoSqlValidator.java` (modified, +2/-0)
```diff
@@ -117,6 +117,8 @@ public static TypeCoercion createTypeCoercion(RelDataTypeFactory typeFactory,
     ) {
         super(
             SqlOperatorTables.chain(
+                // Override only CONCAT: Calcite's version drops its operand charset.
+                SqlOperatorTables.of(DingoOperatorTable.instance().concatFunction()),
                 SqlStdOperatorTable.instance(),
                 SqlLibraryOperatorTableFactory.INSTANCE
                     .getOperatorTable(SqlLibrary.MYSQL),
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/fun/DingoConcatFunction.java` (modified, +20/-7)
```diff
@@ -19,15 +19,13 @@
 import lombok.EqualsAndHashCode;
 import org.apache.calcite.rel.type.RelDataType;
 import org.apache.calcite.sql.SqlCall;
-import org.apache.calcite.sql.SqlFunction;
+import org.apache.calcite.sql.SqlCollation;
 import org.apache.calcite.sql.SqlFunctionCategory;
-import org.apache.calcite.sql.SqlKind;
 import org.apache.calcite.sql.SqlOperator;
 import org.apache.calcite.sql.SqlOperatorBinding;
 import org.apache.calcite.sql.type.SqlOperandTypeChecker;
 import org.apache.calcite.sql.type.SqlOperandTypeInference;
 import org.apache.calcite.sql.type.SqlReturnTypeInference;
-import org.apache.calcite.sql.type.SqlTypeName;
 import org.apache.calcite.sql.validate.SqlValidator;
 import org.apache.calcite.sql.validate.SqlValidatorScope;
 import org.checkerframework.checker.nullness.qual.NonNull;
@@ -44,7 +42,7 @@ public DingoConcatFunction(
     ) {
         super(
             name,
-            returnTypeInference,
+            returnTypeInference == null ? null : binding -> inferCharsetReturnType(binding, returnTypeInference),
             operandTypeInference,
             operandTypeChecker,
             category
@@ -63,9 +61,24 @@ public void validateCall(
         super.validateCall(call, validator, scope, operandScope);
     }
 
-
-    public RelDataType inferReturnType(SqlOperatorBinding opBinding) {
-        return opBinding.getTypeFactory().createSqlType(SqlTypeName.VARCHAR);
+    private static RelDataType inferCharsetReturnType(
+        SqlOperatorBinding binding, SqlReturnTypeInference returnTypeInference
+    ) {
+        RelDataType result = returnTypeInference.inferReturnType(binding);
+        RelDataType chosen = null;
+        for (RelDataType operand : binding.collectOperandTypes()) {
+            if (operand.getCharset() == null || operand.getCollation() == null) {
+                continue;
+            }
+            if (chosen == null || SqlCollation.getCoercibilityDyadicOperator(
+                chosen.getCollation(), operand.getCollation()
+            ) == operand.getCollation()) {
+                chosen = operand;
+            }
+        }
+        return chosen == null ? result : binding.getTypeFactory().createTypeWithCharsetAndCollation(
+            result, chosen.getCharset(), chosen.getCollation()
+        );
     }
 
 }
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/fun/DingoOperatorTable.java` (modified, +56/-6)
```diff
@@ -80,6 +80,7 @@
 import io.dingodb.expr.runtime.op.time.UnixTimestamp1FunFactory;
 import lombok.extern.slf4j.Slf4j;
 import org.apache.calcite.rel.type.RelDataType;
+import org.apache.calcite.sql.SqlCollation;
 import org.apache.calcite.sql.SqlFunction;
 import org.apache.calcite.sql.SqlFunctionCategory;
 import org.apache.calcite.sql.SqlIdentifier;
@@ -101,9 +102,12 @@
 import org.checkerframework.checker.nullness.qual.NonNull;
 import org.checkerframework.checker.nullness.qual.Nullable;
 
+import java.nio.charset.Charset;
+import java.nio.charset.StandardCharsets;
 import java.util.ArrayList;
 import java.util.Collection;
 import java.util.List;
+import java.util.Locale;
 
 import static org.apache.calcite.sql.type.OperandTypes.family;
 import static org.apache.calcite.sql.type.SqlAppointReturnTypeInference.FLOAT;
@@ -505,7 +509,7 @@ private void init() {
             LengthFun.NAME,
             ReturnTypes.INTEGER,
             InferTypes.VARCHAR_1024,
-            OperandTypes.STRING,
+            OperandTypes.or(OperandTypes.STRING, OperandTypes.BINARY),
             SqlFunctionCategory.NUMERIC
         );
         registerFunction(
@@ -552,7 +556,18 @@ private void init() {
         );
         registerFunction(
             CharCharsetFun.NAME,
-            ReturnTypes.explicit(SqlTypeName.VARCHAR),
+            binding -> {
+                String name = binding.getOperandLiteralValue(binding.getOperandCount() - 1, String.class);
+                if (name == null) {
+                    throw new IllegalArgumentException("CHAR USING requires a literal character set");
+                }
+                Charset charset = CharCharsetFun.charset(name);
+                return binding.getTypeFactory().createTypeWithCharsetAndCollation(
+                    binding.getTypeFactory().createSqlType(SqlTypeName.VARCHAR),
+                    charset,
+                    charsetCollation(charset)
+                );
+            },
             InferTypes.ANY_NULLABLE,
             OperandTypes.VARIADIC,
             SqlFunctionCategory.STRING
@@ -566,9 +581,29 @@ private void init() {
         );
         registerFunction(
             ConvertCharsetFun.NAME,
-            ReturnTypes.explicit(SqlTypeName.VARCHAR),
-            DingoInferTypes.VARCHAR,
-            family(SqlTypeFamily.STRING, SqlTypeFamily.STRING),
+            binding -> {
+                String name = binding.getOperandLiteralValue(1, String.class);
+                if (name == null) {
+                    throw new IllegalArgumentException("CONVERT USING requires a literal character set");
+                }
+                Charset charset = CharCharsetFun.charset(name);
+                RelDataType inputType = binding.getOperandType(0);
+                SqlCollation inputCollation = inputType.getCollation();
+                SqlCollation collation =
+                    charset.equals(inputType.getCharset()) && inputCollation != null
+                        && inputCollation.getCoercibility() != SqlCollation.Coercibility.COERCIBLE
+                        ? inputCollation
+                        : charsetCollation(charset);
+                RelDataType result = binding.getTypeFactory().createTypeWithCharsetAndCollation(
+                    binding.getTypeFactory().createSqlType(SqlTypeName.VARCHAR), charset, collation
+                );
+                return binding.getTypeFactory().createTypeWithNullability(result, inputType.isNullable());
+            },
+            null,
+            OperandTypes.or(
+                family(SqlTypeFamily.STRING, SqlTypeFamily.STRING),
+                family(SqlTypeFamily.BINARY, SqlTypeFamily.STRING)
+            ),
             SqlFunctionCategory.STRING
         );
         registerFunction(
@@ -590,7 +625,9 @@ private void init() {
         );
         registerFunction(
             ConvertTzFun.NAME,
-            ReturnTypes.TIMESTAMP,
+            binding -> binding.getTypeFactory().createTypeWithNullability(
+                binding.getTypeFactory().createSqlType(SqlTypeName.TIMESTAMP), true
+            ),
             null,
             OperandTypes.or(
                 family(SqlTypeFamily.TIMESTAMP, SqlTypeFamily.STRING, SqlTypeFamily.STRING),
@@ -615,6 +652,15 @@ private void init() {
         );
     }
 
+    private static SqlCollation charsetCollation(Charset charset) {
+        // Calcite's SqlCollation whitelists SQL charset names. Keep the actual
+        // MySQL codec on RelDataType; use a supported collation for latin1/ASCII.
+        Charset collationCharset = charset.equals(StandardCharsets.US_ASCII)
+            || charset.equals(Charset.forName("windows-1252"))
+            ? StandardCharsets.ISO_8859_1 : charset;
+        return new SqlCollation(SqlCollation.Coercibility.IMPLICIT, Locale.ROOT, collationCharset, "primary");
+    }
+
     public void registerFunction(
         @NonNull String name,
         @Nullable SqlReturnTypeInference returnTypeInference,
@@
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/meta/DingoColumnMetaData.java` (modified, +4/-1)
```diff
@@ -20,6 +20,7 @@
 
 public class DingoColumnMetaData extends ColumnMetaData {
     public final boolean hidden;
+    public final String charsetName;
 
     public DingoColumnMetaData(
         int ordinal,
@@ -32,11 +33,13 @@ public DingoColumnMetaData(
         int displaySize, String label, String columnName, String schemaName, int precision, int scale,
         String tableName, String catalogName, AvaticaType type, boolean readOnly, boolean writable,
         boolean definitelyWritable, String columnClassName,
-        boolean hidden
+        boolean hidden,
+        String charsetName
     ) {
         super(ordinal, autoIncrement, caseSensitive, searchable, currency, nullable, signed,
             displaySize, label, columnName, schemaName, precision, scale, tableName, catalogName, type, readOnly,
             writable, definitelyWritable, columnClassName);
         this.hidden = hidden;
+        this.charsetName = charsetName;
     }
 }
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/type/DingoSqlTypeFactory.java` (modified, +8/-0)
```diff
@@ -393,6 +393,14 @@ else if (resultType.getSqlTypeName().getName().equalsIgnoreCase("CHAR")
                         collation = collation2;
                     }
                 }
+                if (collation0 != null && charset1 != null && charset2 != null
+                    && !charset1.equals(charset2)) {
+                    if (collation0.equals(collation1)) {
+                        charset = charset1;
+                    } else if (collation0.equals(collation2)) {
+                        charset = charset2;
+                    }
+                }
                 if (charset != null) {
                     resultType =
                         createTypeWithCharsetAndCollation(
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/visitor/RexConverter.java` (modified, +12/-0)
```diff
@@ -21,6 +21,8 @@
 import io.dingodb.common.util.Optional;
 import io.dingodb.exec.expr.SqlExprCompileContext;
 import io.dingodb.exec.fun.DingoFunFactory;
+import io.dingodb.exec.fun.LengthFun;
+import io.dingodb.exec.fun.mysql.HexFun;
 import io.dingodb.expr.runtime.ExprConfig;
 import io.dingodb.expr.runtime.compiler.CastingFactory;
 import io.dingodb.expr.runtime.expr.Expr;
@@ -58,6 +60,8 @@
 import org.checkerframework.checker.nullness.qual.NonNull;
 import org.checkerframework.checker.nullness.qual.Nullable;
 
+import java.nio.charset.Charset;
+
 public final class RexConverter implements RexVisitor<@NonNull Expr> {
     private static final RexConverter INSTANCE = new RexConverter();
 
@@ -512,6 +516,14 @@ private RexConverter() {
                 }
                 break;
             case 1:
+                RexNode operand = call.getOperands().get(0);
+                Charset charset = operand.getType().getCharset();
+                if (charset != null && (funName.equalsIgnoreCase(LengthFun.NAME)
+                    || funName.equalsIgnoreCase(HexFun.NAME))) {
+                    BinaryOp charsetOp = funName.equalsIgnoreCase(LengthFun.NAME)
+                        ? LengthFun.CHARSET_INSTANCE : HexFun.CHARSET_INSTANCE;
+                    return Exprs.op(charsetOp, operand.accept(this), Exprs.val(charset.name()));
+                }
                 UnaryOp unaryOp = funFactory.getUnaryFun(funName);
                 if (unaryOp != null) {
                     return Exprs.op(
```

**File**: `dingo-common/src/main/java/io/dingodb/common/mysql/constant/ColumnStatus.java` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
 package io.dingodb.common.mysql.constant;
 
 public class ColumnStatus {
-    public static final int COLUMN_NULLABLE = 0X0001;
+    public static final int COLUMN_NOT_NULL = 0X0001;
 
     public static final int COLUMN_PRIMARY = 0X0002;
 
```

---

### Incident Patch 3: `1b384484` (2026-09-23)
**Commit Message**: Fix MySQL prepared boolean rows and expression edge cases

**File**: `dingo-calcite/src/main/codegen/templates/Parser.jj` (modified, +4/-2)
```diff
@@ -6768,6 +6768,7 @@ SqlNode BuiltinFunctionCall() :
     String alias = null;
     String intervalStr = null;
     boolean charUsingCharset = false;
+    boolean charUsingBinary = false;
     boolean convertBinary = false;
 }
 {
@@ -6845,7 +6846,7 @@ SqlNode BuiltinFunctionCall() :
             }
         )
     |
-        <CHAR> { s = span(); alias = this.token.image; charUsingCharset = false; args.clear(); }
+        <CHAR> { s = span(); alias = this.token.image; charUsingCharset = false; charUsingBinary = false; args.clear(); }
         <LPAREN>
         AddExpression(args, ExprContext.ACCEPT_NON_QUERY)
         (
@@ -6855,11 +6856,12 @@ SqlNode BuiltinFunctionCall() :
             <USING> name = SimpleIdentifier() {
                 args.add(SqlLiteral.createCharString(name.getSimple(), name.getParserPosition()));
                 charUsingCharset = true;
+                charUsingBinary = name.getSimple().equalsIgnoreCase("binary");
             }
         ]
         <RPAREN> {
             SqlIdentifier charFunName = new SqlIdentifier(
-                charUsingCharset ? "char_charset" : "char", s.end(this));
+                charUsingCharset ? (charUsingBinary ? "char_binary" : "char_charset") : "char", s.end(this));
             SqlNode sqlNode = createCall(charFunName, s.end(this), SqlFunctionCategory.STRING, null, args);
             sqlNode.putAlias("aliasName", alias);
             return sqlNode;
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/executor/SetOptionExecutor.java` (modified, +16/-10)
```diff
@@ -38,6 +38,7 @@
 import java.sql.SQLException;
 import java.util.Objects;
 import java.util.Map;
+import java.util.Locale;
 
 import static io.dingodb.common.mysql.scope.ScopeVariables.metricReporter;
 
@@ -106,20 +107,22 @@ private String evalSetExpression(@NonNull SqlCall call) {
         String opName = call.getOperator().getName();
         if (opName.equals("@@")) {
             SqlNode variableNode = call.getOperandList().get(0);
-            String variableName = variableNode.toString().replace("'", "");
-            if (variableName.startsWith("session.")) {
+            String variableName = variableNode.toString().replace("'", "").toLowerCase(Locale.ROOT);
+            boolean global = variableName.startsWith("global.");
+            if (global) {
+                variableName = variableName.substring(7);
+            } else if (variableName.startsWith("session.")) {
                 variableName = variableName.substring(8);
             }
             try {
-                String variableValue = connection.getClientInfo(variableName);
+                String variableValue = global ? null : connection.getClientInfo(variableName);
                 if (variableValue == null) {
                     Map<String, String> globalVariables = InfoSchemaService.root().getGlobalVariables();
                     variableValue = globalVariables.getOrDefault(variableName, "");
                 }
-                return variableValue == null ? "" : variableValue;
+                return variableValue;
             } catch (SQLException e) {
-                LogUtils.error(log, e.getMessage(), e);
-                return "";
+                throw new IllegalStateException("Cannot resolve SET variable reference: " + variableNode, e);
             }
         } else if (opName.equalsIgnoreCase("CONCAT")) {
             StringBuilder builder = new StringBuilder();
@@ -128,18 +131,21 @@ private String evalSetExpression(@NonNull SqlCall call) {
             }
             return builder.toString();
         }
-        return "";
+        throw new IllegalArgumentException("Unsupported SET expression: " + call);
     }
 
     private String evalSetOperand(@NonNull SqlNode node) {
         if (node instanceof SqlCall) {
             return evalSetExpression((SqlCall) node);
         }
         if (node instanceof SqlLiteral) {
-            String v = ((SqlLiteral) node).toValue();
-            return v == null ? "" : v;
+            String value = ((SqlLiteral) node).toValue();
+            if (value != null) {
+                return value;
+            }
+            throw new IllegalArgumentException("NULL is not supported in a SET CONCAT expression");
         }
-        return node.toString();
+        throw new IllegalArgumentException("Unsupported SET operand: " + node);
     }
 
     @Override
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/fun/DingoOperatorTable.java` (modified, +9/-1)
```diff
@@ -41,6 +41,7 @@
 import io.dingodb.exec.fun.mysql.ConvertTzFun;
 import io.dingodb.exec.fun.mysql.QuoteFun;
 import io.dingodb.exec.fun.mysql.CharCharsetFun;
+import io.dingodb.exec.fun.mysql.CharBinaryFun;
 import io.dingodb.exec.fun.mysql.CharFun;
 import io.dingodb.exec.fun.mysql.ConvertCharsetFun;
 import io.dingodb.exec.fun.mysql.ConvertBinaryFun;
@@ -544,7 +545,7 @@ private void init() {
         );
         registerFunction(
             CharFun.NAME,
-            ReturnTypes.explicit(SqlTypeName.VARCHAR),
+            ReturnTypes.explicit(SqlTypeName.VARBINARY),
             InferTypes.ANY_NULLABLE,
             OperandTypes.VARIADIC,
             SqlFunctionCategory.STRING
@@ -556,6 +557,13 @@ private void init() {
             OperandTypes.VARIADIC,
             SqlFunctionCategory.STRING
         );
+        registerFunction(
+            CharBinaryFun.NAME,
+            ReturnTypes.explicit(SqlTypeName.VARBINARY),
+            InferTypes.ANY_NULLABLE,
+            OperandTypes.VARIADIC,
+            SqlFunctionCategory.STRING
+        );
         registerFunction(
             ConvertCharsetFun.NAME,
             ReturnTypes.explicit(SqlTypeName.VARCHAR),
```

**File**: `dingo-driver/mysql-service/src/main/java/io/dingodb/driver/mysql/packet/MysqlPacketFactory.java` (modified, +12/-11)
```diff
@@ -224,6 +224,14 @@ public List<ColumnPacket> getColumnPackets(AtomicLong packetId,
         return columns;
     }
 
+    static boolean isComputedBoolean(ResultSetMetaData metaData, int column, String typeName) throws SQLException {
+        if (!"BOOLEAN".equals(typeName)) {
+            return false;
+        }
+        String table = metaData.getTableName(column);
+        return table == null || table.isEmpty();
+    }
+
     public void addColumnPacketFromMeta(AtomicLong packetId, ResultSetMetaData metaData,
                                          List<ColumnPacket> columns, String catalog, String columnNmCharset)
         throws SQLException {
@@ -243,17 +251,10 @@ public void addColumnPacketFromMeta(AtomicLong packetId, ResultSetMetaData metaD
             }
             String columnTypeName = metaData.getColumnTypeName(i);
             byte columnType = getColumnType(columnTypeName);
-            if ("BOOLEAN".equals(columnTypeName)) {
-                String columnTable = metaData.getTableName(i);
-                if (columnTable == null || columnTable.isEmpty()) {
-                    // Computed boolean expressions go out as BIGINT like
-                    // MySQL (e.g. `col = 'PRI'` metadata queries from
-                    // Metabase); TINYINT(1) would round-trip as Boolean in
-                    // client drivers (tinyInt1isBit) and break tooling that
-                    // expects 0/1 numbers. Table boolean columns keep
-                    // TINYINT(1), matching real MySQL column semantics.
-                    columnType = MysqlType.FIELD_TYPE_LONGLONG;
-                }
+            if (isComputedBoolean(metaData, i, columnTypeName)) {
+                // MySQL comparison expressions use integer 0/1, while declared
+                // BOOLEAN columns retain TINYINT(1) for client compatibility.
+                columnType = MysqlType.FIELD_TYPE_LONGLONG;
             }
             ColumnPacket columnPacket = getColumnPacket(catalog, schema,
                 table,
```

**File**: `dingo-driver/mysql-service/src/main/java/io/dingodb/driver/mysql/packet/PrepareResultSetRowPacket.java` (modified, +4/-5)
```diff
@@ -78,7 +78,7 @@ public int calcPacketSize() {
                         totalSize += 12 + 1;
                         break;
                     case "BOOLEAN":
-                        totalSize += 1;
+                        totalSize += MysqlPacketFactory.isComputedBoolean(metaData, i, typeName) ? 8 : 1;
                         break;
                     case "VARCHAR":
                     case "CHAR":
@@ -160,11 +160,10 @@ public void write(ByteBuf buffer) {
                             BufferUtil.writeTime(buffer, (Time) val);
                             break;
                         case "BOOLEAN":
-                            Boolean valBool = (Boolean) val;
-                            if (valBool) {
-                                buffer.writeByte(1);
+                            if (MysqlPacketFactory.isComputedBoolean(metaData, i + 1, typeName)) {
+                                BufferUtil.writeLong(buffer, (Boolean) val ? 1L : 0L);
                             } else {
-                                buffer.writeByte(0);
+                                buffer.writeByte((Boolean) val ? 1 : 0);
                             }
                             break;
                         case "VARCHAR":
```

**File**: `dingo-driver/mysql-service/src/test/java/io/dingodb/driver/mysql/packet/PrepareResultSetRowPacketTest.java` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+/*
+ * Copyright 2021 DataCanvas
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package io.dingodb.driver.mysql.packet;
+
+import io.dingodb.driver.mysql.MysqlType;
+import io.netty.buffer.ByteBuf;
+import io.netty.buffer.Unpooled;
+import org.junit.jupiter.api.Test;
+
+import javax.sql.rowset.RowSetMetaDataImpl;
+import java.sql.SQLException;
+import java.sql.Types;
+import java.util.ArrayList;
+import java.util.List;
+import java.util.concurrent.atomic.AtomicLong;
+
+import static org.assertj.core.api.Assertions.assertThat;
+
+class PrepareResultSetRowPacketTest {
+    @Test
+    void computedBooleanUsesAdvertisedBigintWidthWithoutShiftingNextColumn() throws SQLException {
+        RowSetMetaDataImpl metaData = new RowSetMetaDataImpl();
+        metaData.setColumnCount(3);
+        metaData.setColumnTypeName(1, "BOOLEAN");
+        metaData.setColumnType(1, Types.BOOLEAN);
+        metaData.setColumnName(1, "comparison");
+        metaData.setColumnLabel(1, "comparison");
+        metaData.setTableName(1, "");
+        metaData.setColumnTypeName(2, "BOOLEAN");
+        metaData.setColumnType(2, Types.BOOLEAN);
+        metaData.setColumnName(2, "declared_boolean");
+        metaData.setColumnLabel(2, "declared_boolean");
+        metaData.setTableName(2, "sample");
+        metaData.setColumnTypeName(3, "INTEGER");
+        metaData.setColumnType(3, Types.INTEGER);
+        metaData.setColumnName(3, "following");
+        metaData.setColumnLabel(3, "following");
+        metaData.setTableName(3, "");
+
+        List<ColumnPacket> columns = new ArrayList<>();
+        MysqlPacketFactory.getInstance().addColumnPacketFromMeta(
+            new AtomicLong(1), metaData, columns, "def", "UTF-8"
+        );
+        assertThat(columns.get(0).type).isEqualTo((byte) MysqlType.FIELD_TYPE_LONGLONG);
+        assertThat(columns.get(1).type).isEqualTo((byte) MysqlType.FIELD_TYPE_TINY);
+
+        PrepareResultSetRowPacket packet = new PrepareResultSetRowPacket();
+        packet.setMetaData(metaData);
+        packet.values.add(Boolean.TRUE);
+        packet.values.add(Boolean.FALSE);
+        packet.values.add(7);
+        ByteBuf bytes = Unpooled.buffer();
+        try {
+            packet.write(bytes);
+            assertThat(bytes.readUnsignedMediumLE()).isEqualTo(15);
+            assertThat(bytes.readUnsignedByte()).isZero(); // packet sequence ID
+            assertThat(bytes.readUnsignedByte()).isZero(); // binary row marker
+            assertThat(bytes.readUnsignedByte()).isZero(); // null bitmap
+            assertThat(bytes.readLongLE()).isEqualTo(1L);
+            assertThat(bytes.readUnsignedByte()).isZero(); // declared TINYINT(1)
+            assertThat(bytes.readIntLE()).isEqualTo(7);
+            assertThat(bytes.isReadable()).isFalse();
+        } finally {
+            bytes.release();
+        }
+    }
+}
```

**File**: `dingo-exec/src/main/java/io/dingodb/exec/fun/DingoFunFactory.java` (modified, +2/-0)
```diff
@@ -29,6 +29,7 @@
 import io.dingodb.exec.fun.mysql.ConvertTzFun;
 import io.dingodb.exec.fun.mysql.QuoteFun;
 import io.dingodb.exec.fun.mysql.CharCharsetFun;
+import io.dingodb.exec.fun.mysql.CharBinaryFun;
 import io.dingodb.exec.fun.mysql.CharFun;
 import io.dingodb.exec.fun.mysql.ConvertCharsetFun;
 import io.dingodb.exec.fun.mysql.ConvertBinaryFun;
@@ -99,6 +100,7 @@ private DingoFunFactory() {
         registerVariadicFun(ConcatWsFun.NAME, ConcatWsFun.INSTANCE);
         registerVariadicFun(CharFun.NAME, CharFun.INSTANCE);
         registerVariadicFun(CharCharsetFun.NAME, CharCharsetFun.INSTANCE);
+        registerVariadicFun(CharBinaryFun.NAME, CharBinaryFun.INSTANCE);
         registerBinaryFun(ConvertCharsetFun.NAME, ConvertCharsetFun.INSTANCE);
         registerBinaryFun(ConvertBinaryFun.NAME, ConvertBinaryFun.INSTANCE);
         registerUnaryFun(QuoteFun.NAME, QuoteFun.INSTANCE);
```

**File**: `dingo-exec/src/main/java/io/dingodb/exec/fun/mysql/CharBinaryFun.java` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+/*
+ * Copyright 2021 DataCanvas
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package io.dingodb.exec.fun.mysql;
+
+import io.dingodb.expr.common.type.Type;
+import io.dingodb.expr.common.type.Types;
+import io.dingodb.expr.runtime.ExprConfig;
+import io.dingodb.expr.runtime.op.OpKey;
+import io.dingodb.expr.runtime.op.OpKeys;
+import io.dingodb.expr.runtime.op.VariadicOp;
+import org.checkerframework.checker.nullness.qual.NonNull;
+
+/** CHAR(value, ... USING binary) returns the constructed bytes. */
+public class CharBinaryFun extends VariadicOp {
+    public static final String NAME = "char_binary";
+    private static final long serialVersionUID = -1856817315925578706L;
+    public static final CharBinaryFun INSTANCE = new CharBinaryFun();
+
+    @Override
+    public Object evalValue(Object @NonNull [] values, ExprConfig config) {
+        return CharFun.buildBytes(values, values.length - 1);
+    }
+
+    @Override
+    public OpKey keyOf(@NonNull Type @NonNull ... types) {
+        return OpKeys.ALL_STRING.keyOf(types);
+    }
+
+    @Override
+    public @NonNull String getName() {
+        return NAME;
+    }
+
+    @Override
+    public Type getType() {
+        return Types.BYTES;
+    }
+}
```

---

### Incident Patch 4: `31aafb76` (2026-09-23)
**Commit Message**: [ci] Build unpublished dingo-expr snapshots before Dingo

The 5.0.0-SNAPSHOT expression modules are absent from Maven Central snapshots. Check out the verified dingo-expr revision and publish its modules to the clean runner Maven local repository before the Dingo Gradle build.

**File**: `.github/workflows/build.yml` (modified, +12/-0)
```diff
@@ -32,6 +32,18 @@ jobs:
         rm -rf ~/.m2/repository/
         rm -rf ~/.gradle/
 
+    # dingo-expr 5.0.0-SNAPSHOT is not published to the configured Maven repositories.
+    - name: Check out dingo-expr for local snapshot dependencies
+      uses: actions/checkout@v4
+      with:
+        repository: dingodb/dingo-expr
+        ref: 4da4755e9e425dcf629ec2563c99fd82d1cdf326
+        path: dingo-expr
+
+    - name: Publish dingo-expr snapshots to Maven local
+      working-directory: dingo-expr
+      run: ./gradlew publishToMavenLocal --no-daemon
+
     - name: Clone Submodule
       run: git submodule update --init --recursive
 
```

---

### Incident Patch 5: `8641604f` (2026-09-23)
**Commit Message**: [fix][dingo-calcite,dingo-exec,dingo-driver] Complete MySQL connector metadata compatibility

Parse MariaDB Connector/J CAST signed/unsigned integer, CONVERT(expr, type), multi-assignment SET and numeric LEAST so actual Metabase field sync completes. Encode/decode CONVERT USING charset, return raw bytes and binary wire collation for USING BINARY, and hex-format binary values correctly. Reject unknown charsets rather than silently treating them as UTF-8.

**File**: `dingo-calcite/src/main/codegen/config.fmpp` (modified, +2/-0)
```diff
@@ -281,6 +281,7 @@ data: {
       "KILL"
       "QUERY"
       "UNSIGNED"
+      "SIGNED"
       "TEXT"
       "LONGTEXT"
       "OUTFILE"
@@ -351,6 +352,7 @@ data: {
       "REGIONS_COUNT"
       "GC_SAFEPOINT"
       "STORE_JOBS"
+      "SIGNED"
     ]
 
     # List of methods for parsing extensions to "CREATE [OR REPLACE]" calls.
```

**File**: `dingo-calcite/src/main/codegen/templates/Parser.jj` (modified, +30/-11)
```diff
@@ -4742,6 +4742,9 @@ SqlAlter SqlSetOption(Span s, String scope) :
                   }
                }
             }
+        |
+            LOOKAHEAD(<IDENTIFIER> <LPAREN>)
+            val = Expression(ExprContext.ACCEPT_NON_QUERY)
         |
             val = SimpleIdentifier()
         |
@@ -6231,6 +6234,11 @@ SqlTypeNameSpec TypeName() :
         typeNameSpec = ${method}
     |
 </#list>
+        LOOKAHEAD(<SIGNED> | <UNSIGNED>)
+        ( <SIGNED> | <UNSIGNED> ) [ <INTEGER> ] {
+            typeNameSpec = new SqlBasicTypeNameSpec(SqlTypeName.BIGINT, s.end(this));
+        }
+    |
         LOOKAHEAD(2)
         typeNameSpec = SqlTypeName(s)
     |
@@ -6760,6 +6768,7 @@ SqlNode BuiltinFunctionCall() :
     String alias = null;
     String intervalStr = null;
     boolean charUsingCharset = false;
+    boolean convertBinary = false;
 }
 {
     //~ FUNCTIONS WITH SPECIAL SYNTAX ---------------------------------------
@@ -6814,17 +6823,27 @@ SqlNode BuiltinFunctionCall() :
         <CONVERT> { s = span(); alias = this.token.image; }
         <LPAREN>
         AddExpression(args, ExprContext.ACCEPT_SUB_QUERY)
-        <USING> name = SimpleIdentifier() {
-            // Charset name is a literal, not a column reference; route to the
-            // dingo charset-conversion function for MySQL compatibility.
-            args.add(SqlLiteral.createCharString(name.getSimple(), name.getParserPosition()));
-        }
-        <RPAREN> {
-            SqlIdentifier convertFunName = new SqlIdentifier("convert_charset", s.end(this));
-            SqlNode sqlNode = createCall(convertFunName, s.end(this), SqlFunctionCategory.STRING, null, args);
-            sqlNode.putAlias("aliasName", alias);
-            return sqlNode;
-        }
+        (
+            <USING> name = SimpleIdentifier() {
+                // Charset name is a literal, not a column reference.
+                convertBinary = name.getSimple().equalsIgnoreCase("binary");
+                args.add(SqlLiteral.createCharString(name.getSimple(), name.getParserPosition()));
+            }
+            <RPAREN> {
+                SqlIdentifier convertFunName = new SqlIdentifier(
+                    convertBinary ? "convert_binary" : "convert_charset", s.end(this));
+                SqlNode sqlNode = createCall(convertFunName, s.end(this), SqlFunctionCategory.STRING, null, args);
+                sqlNode.putAlias("aliasName", alias);
+                return sqlNode;
+            }
+        |
+            <COMMA> dt = DataType() { args.add(dt); }
+            <RPAREN> {
+                SqlNode sqlNode = SqlStdOperatorTable.CAST.createCall(s.end(this), args);
+                sqlNode.putAlias("aliasName", alias);
+                return sqlNode;
+            }
+        )
     |
         <CHAR> { s = span(); alias = this.token.image; charUsingCharset = false; args.clear(); }
         <LPAREN>
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/fun/DingoOperatorTable.java` (modified, +19/-0)
```diff
@@ -43,6 +43,8 @@
 import io.dingodb.exec.fun.mysql.CharCharsetFun;
 import io.dingodb.exec.fun.mysql.CharFun;
 import io.dingodb.exec.fun.mysql.ConvertCharsetFun;
+import io.dingodb.exec.fun.mysql.ConvertBinaryFun;
+import io.dingodb.exec.fun.mysql.LeastFun;
 import io.dingodb.exec.fun.mysql.VersionFun;
 import io.dingodb.exec.fun.sequence.CurrValFun;
 import io.dingodb.exec.fun.sequence.LastValFun;
@@ -561,6 +563,16 @@ private void init() {
             family(SqlTypeFamily.STRING, SqlTypeFamily.STRING),
             SqlFunctionCategory.STRING
         );
+        registerFunction(
+            ConvertBinaryFun.NAME,
+            ReturnTypes.explicit(SqlTypeName.VARBINARY),
+            null,
+            OperandTypes.or(
+                family(SqlTypeFamily.STRING, SqlTypeFamily.STRING),
+                family(SqlTypeFamily.BINARY, SqlTypeFamily.STRING)
+            ),
+            SqlFunctionCategory.STRING
+        );
         registerFunction(
             ConnectionIdFun.NAME,
             ReturnTypes.BIGINT,
@@ -579,6 +591,13 @@ private void init() {
             ),
             SqlFunctionCategory.TIMEDATE
         );
+        registerFunction(
+            LeastFun.NAME,
+            ReturnTypes.LEAST_RESTRICTIVE,
+            null,
+            family(SqlTypeFamily.NUMERIC, SqlTypeFamily.NUMERIC),
+            SqlFunctionCategory.NUMERIC
+        );
         registerFunction(
             DaySubFun.NAME,
             ReturnTypes.DATE,
```

**File**: `dingo-driver/mysql-service/src/main/java/io/dingodb/driver/mysql/packet/MysqlPacketFactory.java` (modified, +3/-2)
```diff
@@ -35,6 +35,7 @@
 import static io.dingodb.common.mysql.constant.ServerStatus.SERVER_STATUS_AUTOCOMMIT;
 
 public class MysqlPacketFactory {
+    private static final short BINARY_CHARSET = 63;
     private static MysqlPacketFactory instance = null;
 
     public static MysqlPacketFactory getInstance() {
@@ -207,7 +208,7 @@ public List<ColumnPacket> getColumnPackets(AtomicLong packetId,
                     tableName,
                     columnName,
                     columnName,
-                    MysqlPacket.charsetNumber,
+                    "VARBINARY".equals(dataType) ? BINARY_CHARSET : MysqlPacket.charsetNumber,
                     resultSet.getInt("COLUMN_SIZE"),
                     getColumnType(dataType),
                     getColumnFlags(resultSet),
@@ -258,7 +259,7 @@ public void addColumnPacketFromMeta(AtomicLong packetId, ResultSetMetaData metaD
                 table,
                 table, columnLabel,
                 columnName,
-                MysqlPacket.charsetNumber,
+                "VARBINARY".equals(columnTypeName) ? BINARY_CHARSET : MysqlPacket.charsetNumber,
                 metaData.getColumnDisplaySize(i),
                 columnType,
                 getColumnFlags(metaData, i),
```

**File**: `dingo-exec/src/main/java/io/dingodb/exec/fun/DingoFunFactory.java` (modified, +4/-0)
```diff
@@ -31,6 +31,8 @@
 import io.dingodb.exec.fun.mysql.CharCharsetFun;
 import io.dingodb.exec.fun.mysql.CharFun;
 import io.dingodb.exec.fun.mysql.ConvertCharsetFun;
+import io.dingodb.exec.fun.mysql.ConvertBinaryFun;
+import io.dingodb.exec.fun.mysql.LeastFun;
 import io.dingodb.exec.fun.sequence.CurrValFun;
 import io.dingodb.exec.fun.sequence.LastValFun;
 import io.dingodb.exec.fun.sequence.NextValFun;
@@ -98,9 +100,11 @@ private DingoFunFactory() {
         registerVariadicFun(CharFun.NAME, CharFun.INSTANCE);
         registerVariadicFun(CharCharsetFun.NAME, CharCharsetFun.INSTANCE);
         registerBinaryFun(ConvertCharsetFun.NAME, ConvertCharsetFun.INSTANCE);
+        registerBinaryFun(ConvertBinaryFun.NAME, ConvertBinaryFun.INSTANCE);
         registerUnaryFun(QuoteFun.NAME, QuoteFun.INSTANCE);
         registerBinaryFun(ConnectionIdFun.NAME, ConnectionIdFun.INSTANCE);
         registerTertiaryFun(ConvertTzFun.NAME, ConvertTzFun.INSTANCE);
+        registerBinaryFun(LeastFun.NAME, LeastFun.INSTANCE);
     }
 
     public static synchronized DingoFunFactory getInstance() {
```

**File**: `dingo-exec/src/main/java/io/dingodb/exec/fun/mysql/CharCharsetFun.java` (modified, +5/-9)
```diff
@@ -49,24 +49,20 @@ public Object evalValue(Object @NonNull [] values, ExprConfig config) {
         return new String(bytes, charset(charsetName));
     }
 
-    /**
-     * Map MySQL charset names onto Java charsets. Unknown names fall back to
-     * UTF-8; {@code binary} uses ISO-8859-1 so every byte round-trips.
-     */
+    /** Map MySQL charset names to an available Java codec; reject unknown names. */
     static Charset charset(@NonNull String name) {
-        String normalized = name.trim().toLowerCase();
+        String normalized = name.trim().toLowerCase(java.util.Locale.ROOT);
         switch (normalized) {
             case "utf8":
-            case "utf-8":
             case "utf8mb4":
                 return StandardCharsets.UTF_8;
             case "binary":
             case "latin1":
                 return StandardCharsets.ISO_8859_1;
-            case "gbk":
-                return Charset.forName("GBK");
+            case "ascii":
+                return StandardCharsets.US_ASCII;
             default:
-                return StandardCharsets.UTF_8;
+                return Charset.forName(normalized);
         }
     }
 
```

**File**: `dingo-exec/src/main/java/io/dingodb/exec/fun/mysql/ConvertBinaryFun.java` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+/*
+ * Copyright 2021 DataCanvas
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package io.dingodb.exec.fun.mysql;
+
+import io.dingodb.expr.common.type.Type;
+import io.dingodb.expr.common.type.Types;
+import io.dingodb.expr.runtime.ExprConfig;
+import io.dingodb.expr.runtime.op.BinaryOp;
+import org.checkerframework.checker.nullness.qual.NonNull;
+
+import java.nio.charset.StandardCharsets;
+
+/** CONVERT(value USING BINARY) returns the UTF-8 bytes of textual values. */
+public class ConvertBinaryFun extends BinaryOp {
+    public static final String NAME = "convert_binary";
+    private static final long serialVersionUID = 7820648382210847369L;
+    public static final ConvertBinaryFun INSTANCE = new ConvertBinaryFun();
+
+    @Override
+    protected Object evalNonNullValue(@NonNull Object value, @NonNull Object charset, ExprConfig config) {
+        return value instanceof byte[] ? value : value.toString().getBytes(StandardCharsets.UTF_8);
+    }
+
+    @Override
+    public @NonNull String getName() {
+        return NAME;
+    }
+
+    @Override
+    public Type getType() {
+        return Types.BYTES;
+    }
+}
```

**File**: `dingo-exec/src/main/java/io/dingodb/exec/fun/mysql/ConvertCharsetFun.java` (modified, +10/-7)
```diff
@@ -22,10 +22,11 @@
 import io.dingodb.expr.runtime.op.BinaryOp;
 import org.checkerframework.checker.nullness.qual.NonNull;
 
+import java.nio.charset.Charset;
+
 /**
- * MySQL CONVERT(expr USING charset) function, produced by the {@code CONVERT}
- * grammar production with a USING qualifier. The value passes through with
- * its charset annotation; the binary charset re-encodes the text as bytes.
+ * MySQL CONVERT(expr USING charset) for character sets. The binary charset is
+ * handled separately so it retains its byte type instead of becoming text.
  */
 public class ConvertCharsetFun extends BinaryOp {
     public static final String NAME = "convert_charset";
@@ -39,10 +40,12 @@ public Object evalValue(Object value0, Object value1, ExprConfig config) {
         if (value0 == null) {
             return null;
         }
-        String charsetName = value1 == null ? "utf8mb4" : value1.toString();
-        // Charset annotation only: the text passes through unchanged, so the
-        // value never degrades to a Java byte[] dump through typed columns.
-        return value0;
+        Charset charset = CharCharsetFun.charset(value1.toString());
+        if (value0 instanceof byte[]) {
+            return new String((byte[]) value0, charset);
+        }
+        String text = value0.toString();
+        return new String(text.getBytes(charset), charset);
     }
 
     @Override
```

---

### Incident Patch 6: `2f8d1887` (2026-09-23)
**Commit Message**: [fix][dingo-driver] Fix MySQL wire protocol boolean encoding

- ResultSetRowPacket: boolean values now emit '1'/'0' text bytes instead
  of 'true'/'false', matching the MySQL text protocol. Real MySQL never
  writes the words true/false for boolean expressions.

- MysqlPacketFactory.addColumnPacketFromMeta: computed boolean expression
  columns (e.g. c.column_key = 'PRI') are declared as FIELD_TYPE_LONGLONG
  (BIGINT) on the wire, while table-declared BOOLEAN columns keep
  TINYINT(1). This matches what real MySQL sends: comparison results are
  always integer 0/1, and JDBC drivers (Connector/J tinyInt1isBit=true)
  convert TINYINT(1) table columns to Boolean but leave BIGINT expressions
  as Long.

Fixes the Metabase error:
  class java.lang.Boolean cannot be cast to class java.lang.Number
in the sync-fields step where (c.is_nullable = 'YES') is expected to be
a number by the (pos?) predicate.

**File**: `dingo-driver/mysql-service/src/main/java/io/dingodb/driver/mysql/packet/MysqlPacketFactory.java` (modified, +16/-1)
```diff
@@ -28,6 +28,7 @@
 import java.sql.SQLException;
 import java.sql.SQLWarning;
 import java.util.ArrayList;
+import io.dingodb.driver.mysql.MysqlType;
 import java.util.List;
 import java.util.concurrent.atomic.AtomicLong;
 
@@ -239,13 +240,27 @@ public void addColumnPacketFromMeta(AtomicLong packetId, ResultSetMetaData metaD
                 columnName = "user";
                 columnLabel = "user";
             }
+            String columnTypeName = metaData.getColumnTypeName(i);
+            byte columnType = getColumnType(columnTypeName);
+            if ("BOOLEAN".equals(columnTypeName)) {
+                String columnTable = metaData.getTableName(i);
+                if (columnTable == null || columnTable.isEmpty()) {
+                    // Computed boolean expressions go out as BIGINT like
+                    // MySQL (e.g. `col = 'PRI'` metadata queries from
+                    // Metabase); TINYINT(1) would round-trip as Boolean in
+                    // client drivers (tinyInt1isBit) and break tooling that
+                    // expects 0/1 numbers. Table boolean columns keep
+                    // TINYINT(1), matching real MySQL column semantics.
+                    columnType = MysqlType.FIELD_TYPE_LONGLONG;
+                }
+            }
             ColumnPacket columnPacket = getColumnPacket(catalog, schema,
                 table,
                 table, columnLabel,
                 columnName,
                 MysqlPacket.charsetNumber,
                 metaData.getColumnDisplaySize(i),
-                getColumnType(metaData.getColumnTypeName(i)),
+                columnType,
                 getColumnFlags(metaData, i),
                 MysqlPacket.decimals,
                 (byte) packetId.getAndIncrement(), columnNmCharset);
```

**File**: `dingo-driver/mysql-service/src/main/java/io/dingodb/driver/mysql/packet/ResultSetRowPacket.java` (modified, +5/-1)
```diff
@@ -150,7 +150,11 @@ public void addColumnValue(Object val) {
                 return;
             }
             try {
-                if (val instanceof BigDecimal) {
+                if (val instanceof Boolean) {
+                    // MySQL wire protocol never uses "true"/"false" text for
+                    // boolean expressions; it always sends 1/0 like TINYINT.
+                    values.add(((Boolean) val) ? "1".getBytes(characterSet) : "0".getBytes(characterSet));
+                } else if (val instanceof BigDecimal) {
                     values.add(((BigDecimal) val).toPlainString().getBytes(characterSet));
                 } else {
                     values.add(val.toString().getBytes(characterSet));
```

---

### Incident Patch 7: `948fe8de` (2026-09-23)
**Commit Message**: [feat][dingo-calcite,dingo-exec,dingo-executor,dingo-driver] Fix MySQL compatibility issues blocking Bytebase and Metabase

MySQL function additions (fixes Bytebase #1, #2 and Metabase #1, #2, #3, #4):

- QUOTE(): MySQL-compatible escaping of single quote, backslash, NUL,
  Ctrl-Z with byte-exact semantics; QUOTE(NULL) returns the text 'NULL'
  (not SQL NULL). Registered in DingoOperatorTable + DingoFunFactory.

- CONNECTION_ID(): returns the real MySQL protocol thread ID from the
  handshake packet, stable per connection and distinct across concurrent
  connections. Injected via deepSugar rewrite (same as DATABASE()).

- CONVERT_TZ(datetime, from_tz, to_tz): timezone-aware conversion
  supporting IANA zone names, numeric offsets, UTC, GMT+8 and SYSTEM;
  invalid timezone arguments yield SQL NULL per MySQL semantics.

- CHAR(N,... [USING charset]): multi-byte byte-value construction with
  UTF-8/GBK/binary charset decode, supporting the MySQL USING clause.
  CONVERT(expr USING charset): charset annotation pass-through.

- Session variables: @@max_allowed_packet no longer echoes the client
  handshake packet size; it falls back to the server global variable
  (67108864). Fixes the G

**File**: `dingo-calcite/src/main/codegen/includes/Show.ftl` (modified, +18/-9)
```diff
@@ -194,15 +194,24 @@ SqlShow SqlShowGrants(Span s): {
 } {
   <GRANTS>
   (<FOR>
-  [
-       <QUOTED_STRING> { user = token.image; }
-       [<AT_SPLIT> <QUOTED_STRING> { host = token.image;} ]
-       {
-       return new SqlShowGrants(s.end(this), user, host);
-       }
-  ]
-  userIdentifier = CompoundIdentifier() { user = userIdentifier.getSimple(); }
-  [<AT_SPLIT> (<QUOTED_STRING> | <IDENTIFIER>) {host = token.image; } ]
+    (
+      LOOKAHEAD(2) <CURRENT_USER> [<LPAREN> <RPAREN>]
+      {
+        // SHOW GRANTS FOR CURRENT_USER() returns the grants of the current
+        // session user, same as plain SHOW GRANTS (user == null).
+        return new SqlShowGrants(s.end(this), null, "%");
+      }
+    |
+      [
+           <QUOTED_STRING> { user = token.image; }
+           [<AT_SPLIT> <QUOTED_STRING> { host = token.image;} ]
+           {
+           return new SqlShowGrants(s.end(this), user, host);
+           }
+      ]
+      userIdentifier = CompoundIdentifier() { user = userIdentifier.getSimple(); }
+      [<AT_SPLIT> (<QUOTED_STRING> | <IDENTIFIER>) {host = token.image; } ]
+    )
   )?
   {
     return new SqlShowGrants(s.end(this), user, host);
```

**File**: `dingo-calcite/src/main/codegen/templates/Parser.jj` (modified, +28/-2)
```diff
@@ -6759,6 +6759,7 @@ SqlNode BuiltinFunctionCall() :
     final SqlNode node;
     String alias = null;
     String intervalStr = null;
+    boolean charUsingCharset = false;
 }
 {
     //~ FUNCTIONS WITH SPECIAL SYNTAX ---------------------------------------
@@ -6813,9 +6814,34 @@ SqlNode BuiltinFunctionCall() :
         <CONVERT> { s = span(); alias = this.token.image; }
         <LPAREN>
         AddExpression(args, ExprContext.ACCEPT_SUB_QUERY)
-        <USING> name = SimpleIdentifier() { args.add(name); }
+        <USING> name = SimpleIdentifier() {
+            // Charset name is a literal, not a column reference; route to the
+            // dingo charset-conversion function for MySQL compatibility.
+            args.add(SqlLiteral.createCharString(name.getSimple(), name.getParserPosition()));
+        }
+        <RPAREN> {
+            SqlIdentifier convertFunName = new SqlIdentifier("convert_charset", s.end(this));
+            SqlNode sqlNode = createCall(convertFunName, s.end(this), SqlFunctionCategory.STRING, null, args);
+            sqlNode.putAlias("aliasName", alias);
+            return sqlNode;
+        }
+    |
+        <CHAR> { s = span(); alias = this.token.image; charUsingCharset = false; args.clear(); }
+        <LPAREN>
+        AddExpression(args, ExprContext.ACCEPT_NON_QUERY)
+        (
+            <COMMA> AddExpression(args, ExprContext.ACCEPT_NON_QUERY)
+        )*
+        [
+            <USING> name = SimpleIdentifier() {
+                args.add(SqlLiteral.createCharString(name.getSimple(), name.getParserPosition()));
+                charUsingCharset = true;
+            }
+        ]
         <RPAREN> {
-            SqlNode sqlNode = SqlStdOperatorTable.CONVERT.createCall(s.end(this), args);
+            SqlIdentifier charFunName = new SqlIdentifier(
+                charUsingCharset ? "char_charset" : "char", s.end(this));
+            SqlNode sqlNode = createCall(charFunName, s.end(this), SqlFunctionCategory.STRING, null, args);
             sqlNode.putAlias("aliasName", alias);
             return sqlNode;
         }
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/executor/SetOptionExecutor.java` (modified, +50/-0)
```diff
@@ -26,15 +26,18 @@
 import org.apache.calcite.sql.SqlIdentifier;
 import org.apache.calcite.sql.SqlLiteral;
 import org.apache.calcite.sql.SqlNode;
+import org.apache.calcite.sql.SqlCall;
 import org.apache.calcite.sql.SqlNumericLiteral;
 import org.apache.calcite.sql.SqlSetOption;
+import org.checkerframework.checker.nullness.qual.NonNull;
 import org.apache.calcite.sql.parser.SqlParserUtil;
 import org.apache.commons.lang3.StringUtils;
 
 import java.sql.Connection;
 import java.sql.SQLClientInfoException;
 import java.sql.SQLException;
 import java.util.Objects;
+import java.util.Map;
 
 import static io.dingodb.common.mysql.scope.ScopeVariables.metricReporter;
 
@@ -88,10 +91,57 @@ public SetOptionExecutor(Connection connection, SqlSetOption setOption) {
             if (val != null) {
                 value = val.toString();
             }
+        } else if (sqlNode instanceof SqlCall) {
+            value = evalSetExpression((SqlCall) sqlNode);
         }
         value = SqlParserUtil.trim(value, "'");
     }
 
+    /**
+     * Evaluate expression values in SET statements, e.g. MySQL tools send
+     * {@code SET sql_mode = concat(@@sql_mode, ',STRICT_TRANS_TABLES')}.
+     * Supported shapes: @@var references and CONCAT of literals/@@vars.
+     */
+    private String evalSetExpression(@NonNull SqlCall call) {
+        String opName = call.getOperator().getName();
+        if (opName.equals("@@")) {
+            SqlNode variableNode = call.getOperandList().get(0);
+            String variableName = variableNode.toString().replace("'", "");
+            if (variableName.startsWith("session.")) {
+                variableName = variableName.substring(8);
+            }
+            try {
+                String variableValue = connection.getClientInfo(variableName);
+                if (variableValue == null) {
+                    Map<String, String> globalVariables = InfoSchemaService.root().getGlobalVariables();
+                    variableValue = globalVariables.getOrDefault(variableName, "");
+                }
+                return variableValue == null ? "" : variableValue;
+            } catch (SQLException e) {
+                LogUtils.error(log, e.getMessage(), e);
+                return "";
+            }
+        } else if (opName.equalsIgnoreCase("CONCAT")) {
+            StringBuilder builder = new StringBuilder();
+            for (SqlNode operand : call.getOperandList()) {
+                builder.append(evalSetOperand(operand));
+            }
+            return builder.toString();
+        }
+        return "";
+    }
+
+    private String evalSetOperand(@NonNull SqlNode node) {
+        if (node instanceof SqlCall) {
+            return evalSetExpression((SqlCall) node);
+        }
+        if (node instanceof SqlLiteral) {
+            String v = ((SqlLiteral) node).toValue();
+            return v == null ? "" : v;
+        }
+        return node.toString();
+    }
+
     @Override
     public void execute() {
         try {
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/fun/DingoOperatorTable.java` (modified, +52/-0)
```diff
@@ -37,6 +37,12 @@
 import io.dingodb.exec.fun.mysql.UnHexFun;
 import io.dingodb.exec.fun.mysql.UserDefVarFun;
 import io.dingodb.exec.fun.mysql.UserFun;
+import io.dingodb.exec.fun.mysql.ConnectionIdFun;
+import io.dingodb.exec.fun.mysql.ConvertTzFun;
+import io.dingodb.exec.fun.mysql.QuoteFun;
+import io.dingodb.exec.fun.mysql.CharCharsetFun;
+import io.dingodb.exec.fun.mysql.CharFun;
+import io.dingodb.exec.fun.mysql.ConvertCharsetFun;
 import io.dingodb.exec.fun.mysql.VersionFun;
 import io.dingodb.exec.fun.sequence.CurrValFun;
 import io.dingodb.exec.fun.sequence.LastValFun;
@@ -527,6 +533,52 @@ private void init() {
             OperandTypes.STRING,
             SqlFunctionCategory.USER_DEFINED_FUNCTION
         );
+        registerFunction(
+            QuoteFun.NAME,
+            ReturnTypes.VARCHAR_2000_NULLABLE,
+            InferTypes.VARCHAR_1024,
+            OperandTypes.ANY,
+            SqlFunctionCategory.STRING
+        );
+        registerFunction(
+            CharFun.NAME,
+            ReturnTypes.explicit(SqlTypeName.VARCHAR),
+            InferTypes.ANY_NULLABLE,
+            OperandTypes.VARIADIC,
+            SqlFunctionCategory.STRING
+        );
+        registerFunction(
+            CharCharsetFun.NAME,
+            ReturnTypes.explicit(SqlTypeName.VARCHAR),
+            InferTypes.ANY_NULLABLE,
+            OperandTypes.VARIADIC,
+            SqlFunctionCategory.STRING
+        );
+        registerFunction(
+            ConvertCharsetFun.NAME,
+            ReturnTypes.explicit(SqlTypeName.VARCHAR),
+            DingoInferTypes.VARCHAR,
+            family(SqlTypeFamily.STRING, SqlTypeFamily.STRING),
+            SqlFunctionCategory.STRING
+        );
+        registerFunction(
+            ConnectionIdFun.NAME,
+            ReturnTypes.BIGINT,
+            DingoInferTypes.VARCHAR,
+            family(SqlTypeFamily.STRING, SqlTypeFamily.STRING),
+            SqlFunctionCategory.NUMERIC
+        );
+        registerFunction(
+            ConvertTzFun.NAME,
+            ReturnTypes.TIMESTAMP,
+            null,
+            OperandTypes.or(
+                family(SqlTypeFamily.TIMESTAMP, SqlTypeFamily.STRING, SqlTypeFamily.STRING),
+                family(SqlTypeFamily.DATE, SqlTypeFamily.STRING, SqlTypeFamily.STRING),
+                family(SqlTypeFamily.STRING, SqlTypeFamily.STRING, SqlTypeFamily.STRING)
+            ),
+            SqlFunctionCategory.TIMEDATE
+        );
         registerFunction(
             DaySubFun.NAME,
             ReturnTypes.DATE,
```

**File**: `dingo-driver/host/src/main/java/io/dingodb/driver/DingoDriverParser.java` (modified, +61/-2)
```diff
@@ -1099,17 +1099,72 @@ private static List<ProcessInfo> getProcessInfoList(Map<String, Connection> conn
 
     private void syntacticSugar(SqlNode sqlNode) {
         if (sqlNode instanceof SqlSelect) {
-            SqlNodeList sqlNodes = ((SqlSelect) sqlNode).getSelectList();
-            deepSugar(sqlNodes);
+            SqlSelect sqlSelect = (SqlSelect) sqlNode;
+            deepSugar(sqlSelect.getSelectList());
+            sugarWhere(sqlSelect);
         } else if (sqlNode instanceof SqlOrderBy) {
             SqlOrderBy sqlOrderBy = (SqlOrderBy) sqlNode;
             if (sqlOrderBy.query instanceof SqlSelect) {
                 SqlSelect sqlSelect = (SqlSelect) sqlOrderBy.query;
                 deepSugar(sqlSelect.getSelectList());
+                sugarWhere(sqlSelect);
             }
         }
     }
 
+    /**
+     * Rewrite session functions (DATABASE()/SCHEMA()/USER()/CONNECTION_ID()/
+     * @@var) inside the WHERE clause into connection-qualified calls, the
+     * same way deepSugar does for the select list. Tool metadata queries use
+     * e.g. {@code WHERE TABLE_SCHEMA = DATABASE()}.
+     */
+    private void sugarWhere(SqlSelect sqlSelect) {
+        SqlNode where = sqlSelect.getWhere();
+        if (where != null) {
+            sqlSelect.setWhere(deepSugarNode(where));
+        }
+    }
+
+    private SqlNode deepSugarNode(SqlNode node) {
+        if (!(node instanceof SqlBasicCall)) {
+            return node;
+        }
+        SqlBasicCall call = (SqlBasicCall) node;
+        String opName = call.getOperator().getName();
+        List<SqlNode> nodes = new ArrayList<>();
+        boolean fullAlias = false;
+        if (opName.equalsIgnoreCase("database")
+            || opName.equalsIgnoreCase("schema")
+            || opName.equalsIgnoreCase("user")) {
+            nodes.add(SqlLiteral.createCharString(convertName("dingo"), call.getParserPosition()));
+            fullAlias = true;
+            call.setAliasName(opName + "()");
+        } else if (opName.equalsIgnoreCase("connection_id")) {
+            nodes.add(SqlLiteral.createCharString(connection.id, call.getParserPosition()));
+            call.setAliasName(opName + "()");
+        } else if (opName.equals("@") || opName.equals("@@")) {
+            nodes.add(call.getOperandList().get(0));
+        }
+        if (!nodes.isEmpty()) {
+            nodes.add(SqlLiteral.createCharString(connection.id, call.getParserPosition()));
+            SqlBasicCall finalCall = new SqlBasicCall(call.getOperator(), nodes, call.getParserPosition());
+            finalCall.setAliasName(call.getAliasName());
+            finalCall.putAlias("fullAlias", String.valueOf(fullAlias));
+            return finalCall;
+        }
+        List<SqlNode> newOperands = new ArrayList<>();
+        boolean changed = false;
+        for (SqlNode operand : call.getOperandList()) {
+            SqlNode newOperand = deepSugarNode(operand);
+            changed |= (newOperand != operand);
+            newOperands.add(newOperand);
+        }
+        if (changed) {
+            return new SqlBasicCall(call.getOperator(), newOperands, call.getParserPosition());
+        }
+        return call;
+    }
+
     public void deepSugar(List<SqlNode> sqlNodes) {
         if (sqlNodes == null) {
             return;
@@ -1128,6 +1183,10 @@ public void deepSugar(List<SqlNode> sqlNodes) {
                     nodes.add(SqlLiteral.createCharString(convertName("dingo"), call.getParserPosition()));
                     fullAlias = true;
                     call.setAliasName(opName + "()");
+                } else if (opName.equalsIgnoreCase("connection_id")) {
+                    sqlNodes.remove(i);
+                    nodes.add(SqlLiteral.createCharString(connection.id, call.getParserPosition()));
+                    call.setAliasName(opName + "()");
                 } else if (opName.equals("@") || opName.equals("@@")) {
                     sqlNodes.remove(i);
                     nodes.add(call.getOperandList().get(0));
```

**File**: `dingo-driver/mysql-service/src/main/java/io/dingodb/driver/mysql/MysqlConnection.java` (modified, +7/-10)
```diff
@@ -82,11 +82,6 @@ public void setConnection(DingoConnection dingoConnection) {
         connection = dingoConnection;
         this.id = dingoConnection.id;
         setCharsetIndex(authPacket);
-        try {
-            connection.setClientInfo("max_allowed_packet", String.valueOf(authPacket.maxPacketSize));
-        } catch (SQLClientInfoException e) {
-            LogUtils.error(log, e.getMessage(), e);
-        }
     }
 
     public void close() {
@@ -140,11 +135,13 @@ public boolean setCharsetIndex(AuthPacket authPacket) {
     }
 
     public long maxAllowedPacket() {
-        try {
-            return Long.parseLong(this.getConnection().getClientInfo("max_allowed_packet"));
-        } catch (SQLException e) {
-            return 67108864;
-        }
+        // The handshake max packet size field is a client-declared receive
+        // limit, not the server variable; 0 or a negative value means
+        // unspecified, and the server default applies. The SQL-visible
+        // @@max_allowed_packet is served from the global variable.
+        return authPacket != null && authPacket.maxPacketSize > 0
+            ? authPacket.maxPacketSize
+            : 67108864L;
     }
 
     public void writeAndFlushImmediately(ByteBuf byteBuf) {
```

**File**: `dingo-driver/mysql-service/src/main/java/io/dingodb/driver/mysql/netty/HandshakeHandler.java` (modified, +3/-2)
```diff
@@ -328,8 +328,9 @@ private static HandshakePacket createHandShakePacket() {
         HandshakePacket handshakePacket = new HandshakePacket();
         handshakePacket.protocolVersion = PROTOCOL_VERSION;
         handshakePacket.serverVersion = Versions.SERVER_VERSION;
-        handshakePacket.threadId = threadId.get();
-        threadId.incrementAndGet();
+        // getAndIncrement guarantees distinct connection ids for concurrent
+        // connection setups: CONNECTION_ID(), processlist and KILL rely on it.
+        handshakePacket.threadId = threadId.getAndIncrement();
         handshakePacket.seed = createRandomString(8).getBytes();
         handshakePacket.serverCapabilities = MysqlServer.getServerCapabilities();
         handshakePacket.serverCharsetIndex = 0x08;
```

**File**: `dingo-exec/src/main/java/io/dingodb/exec/fun/DingoFunFactory.java` (modified, +12/-0)
```diff
@@ -25,6 +25,12 @@
 import io.dingodb.exec.fun.mysql.UserDefVarFun;
 import io.dingodb.exec.fun.mysql.UserFun;
 import io.dingodb.exec.fun.mysql.VersionFun;
+import io.dingodb.exec.fun.mysql.ConnectionIdFun;
+import io.dingodb.exec.fun.mysql.ConvertTzFun;
+import io.dingodb.exec.fun.mysql.QuoteFun;
+import io.dingodb.exec.fun.mysql.CharCharsetFun;
+import io.dingodb.exec.fun.mysql.CharFun;
+import io.dingodb.exec.fun.mysql.ConvertCharsetFun;
 import io.dingodb.exec.fun.sequence.CurrValFun;
 import io.dingodb.exec.fun.sequence.LastValFun;
 import io.dingodb.exec.fun.sequence.NextValFun;
@@ -89,6 +95,12 @@ private DingoFunFactory() {
         registerBinaryFun(DaySubFun.NAME, DaySubFun.INSTANCE);
         registerUnaryFun(GetDateFun.NAME, GetDateFun.INSTANCE);
         registerVariadicFun(ConcatWsFun.NAME, ConcatWsFun.INSTANCE);
+        registerVariadicFun(CharFun.NAME, CharFun.INSTANCE);
+        registerVariadicFun(CharCharsetFun.NAME, CharCharsetFun.INSTANCE);
+        registerBinaryFun(ConvertCharsetFun.NAME, ConvertCharsetFun.INSTANCE);
+        registerUnaryFun(QuoteFun.NAME, QuoteFun.INSTANCE);
+        registerBinaryFun(ConnectionIdFun.NAME, ConnectionIdFun.INSTANCE);
+        registerTertiaryFun(ConvertTzFun.NAME, ConvertTzFun.INSTANCE);
     }
 
     public static synchronized DingoFunFactory getInstance() {
```

---

### Incident Patch 8: `7f82ac73` (2026-05-08)
**Commit Message**: [fix][dingo-store-proxy] Optimize the GC region deletion process

**File**: `dingo-store-proxy/src/main/java/io/dingodb/store/proxy/common/Gc.java` (modified, +27/-8)
```diff
@@ -22,6 +22,7 @@
 import io.dingodb.common.log.LogUtils;
 import io.dingodb.common.meta.Tenant;
 import io.dingodb.common.mysql.scope.ScopeVariables;
+import io.dingodb.common.parser.CharTypes;
 import io.dingodb.common.session.Session;
 import io.dingodb.common.session.SessionUtil;
 import io.dingodb.common.tenant.TenantConstant;
@@ -41,6 +42,7 @@
 import io.dingodb.sdk.service.entity.coordinator.GetGCSafePointRequest;
 import io.dingodb.sdk.service.entity.coordinator.GetGCSafePointResponse;
 import io.dingodb.sdk.service.entity.coordinator.GetRegionMapRequest;
+import io.dingodb.sdk.service.entity.coordinator.ScanRegionInfo;
 import io.dingodb.sdk.service.entity.coordinator.UpdateGCSafePointRequest;
 import io.dingodb.sdk.service.entity.meta.DeleteAutoIncrementRequest;
 import io.dingodb.sdk.service.entity.meta.DingoCommonId;
@@ -849,20 +851,37 @@ private static void gcDeleteRange(long startTs) {
                     LogUtils.info(log, "gc schema meta, schemaId:{}", eleId);
                     return;
                 }
+
                 try {
-                    coordinatorService.dropRegion(
-                        tso(),
-                        DropRegionRequest.builder().regionId(regionId).build()
-                    );
-                    LogUtils.info(log, "gcDeleteRange success, regionId:{}", regionId);
-                    long jobId = (long) objects[3];
-                    long ts = (long) objects[4];
                     String startKey = objects[1].toString();
                     String endKey = objects[2].toString();
+                    List<Object> regionList = InfoSchemaService.root()
+                        .scanRegions(CharTypes.hexToBytes(startKey), CharTypes.hexToBytes(endKey));
+                    if (regionList.size() > 1) {
+                        regionList
+                            .forEach(object -> {
+                                ScanRegionInfo scanRegionInfo = (ScanRegionInfo) object;
+                                coordinatorService.dropRegion(
+                                    tso(),
+                                    DropRegionRequest.builder().regionId(scanRegionInfo.getRegionId()).build()
+                                );
+                                LogUtils.info(log, "multi region drop success, regionId:{}",
+                                    scanRegionInfo.getRegionId());
+                            });
+                    } else {
+                        coordinatorService.dropRegion(
+                            tso(),
+                            DropRegionRequest.builder().regionId(regionId).build()
+                        );
+                        LogUtils.info(log, "single region drop success, regionId:{}", regionId);
+                    }
+                    long jobId = (long) objects[3];
+                    long ts = (long) objects[4];
                     String eleId = (String) objects[5];
                     dropTableMeta(eleId, jobId, session, eleType);
                     if (!gcDeleteDone(jobId, ts, regionId, startKey, endKey, eleId, eleType, true)) {
-                        LogUtils.error(log, "remove gcDeleteTask failed, jobId:{}, eleId:{}, eleType:{}", jobId, eleId, eleType);
+                        LogUtils.error(log, "remove gcDeleteTask failed, jobId:{}, eleId:{}, eleType:{}",
+                            jobId, eleId, eleType);
                     } else {
                         delDone.incrementAndGet();
                     }
```

---

### Incident Patch 9: `f7e1c4ad` (2026-04-30)
**Commit Message**: [fix][dingo-calcite] Correct the comment for the unique index

**File**: `dingo-calcite/src/main/codegen/includes/parserImpls.ftl` (modified, +2/-1)
```diff
@@ -315,7 +315,8 @@ void TableElement(List<SqlNode> list) :
         [ indexAlg = indexAlg()]
         [ indexLockOpt = indexLockOpt()]
         {
-            list.add(new DingoSqlKeyConstraint(s.end(columnList), name, columnList, replica, engine, partitionDefinition));
+            list.add(new DingoSqlKeyConstraint(s.end(columnList), name, columnList,
+                    replica, engine, partitionDefinition, prop));
         }
     |
         <PRIMARY>  { s.add(this); } <KEY>
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/DingoDdlExecutor.java` (modified, +4/-0)
```diff
@@ -2451,6 +2451,7 @@ private static IndexDefinition fromSqlUniqueDeclaration(
         }
         indexDefinition.setEngine(engine);
         indexDefinition.setPartDefinition(sqlKeyConstraint1.getPartDefinition());
+        indexDefinition.setComment(sqlKeyConstraint1.getComment());
         validatePartitionBy(
             indexDefinition.getKeyColumns().stream().map(ColumnDefinition::getName).collect(Collectors.toList()),
             indexDefinition, indexDefinition.getPartDefinition());
@@ -2467,6 +2468,9 @@ private static IndexDefinition fromSqlUniqueDeclaration(
             tableDefinition, sqlIndexDeclaration.columnList
         );
         indexDefinition.setEngine(sqlIndexDeclaration.getEngine());
+        if (sqlIndexDeclaration.getIndexOpt() != null && sqlIndexDeclaration.getIndexOpt().containsKey("comment")) {
+            indexDefinition.setComment(sqlIndexDeclaration.getIndexOpt().getProperty("comment"));
+        }
         return indexDefinition;
     }
 
```

**File**: `dingo-calcite/src/main/java/org/apache/calcite/sql/ddl/DingoSqlKeyConstraint.java` (modified, +12/-1)
```diff
@@ -25,6 +25,7 @@
 import org.apache.calcite.sql.parser.SqlParserPos;
 import org.checkerframework.checker.nullness.qual.Nullable;
 
+import java.util.Properties;
 import java.util.concurrent.atomic.AtomicInteger;
 
 public class DingoSqlKeyConstraint extends SqlKeyConstraint {
@@ -39,6 +40,10 @@ public class DingoSqlKeyConstraint extends SqlKeyConstraint {
     @Getter
     String engine;
 
+    @Setter
+    @Getter
+    String comment;
+
     @Getter
     PartitionDefinition partDefinition;
 
@@ -48,7 +53,8 @@ public DingoSqlKeyConstraint(
         SqlNodeList columnList,
         int replica,
         String engine,
-        PartitionDefinition partDefinition
+        PartitionDefinition partDefinition,
+        Properties prop
     ) {
         super(pos, name, columnList);
         this.replica = replica;
@@ -68,5 +74,10 @@ public DingoSqlKeyConstraint(
             }
         }
         this.partDefinition = partDefinition;
+        if (prop != null) {
+            if (prop.containsKey("comment")) {
+                this.comment = prop.getProperty("comment");
+            }
+        }
     }
 }
```

**File**: `dingo-executor/src/main/java/io/dingodb/server/executor/ddl/ModifyColumnFiller.java` (modified, +1/-0)
```diff
@@ -152,6 +152,7 @@ public boolean preWritePrimary(ReorgBackFillTask task) {
             preRes = true;
             break;
         }
+        this.scanCount.incrementAndGet();
         return preRes;
     }
 
```

---

### Incident Patch 10: `8f4c4dd1` (2026-04-29)
**Commit Message**: [fix][dingo-calcite] Fix the error message issue for alterTableColumn

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/DingoDdlExecutor.java` (modified, +3/-0)
```diff
@@ -1749,6 +1749,9 @@ public void execute(SqlAlterChangeColumn sqlAlterChangeColumn, CalcitePrepare.Co
             }
         }
         DingoSqlColumn dingoSqlColumn = sqlAlterChangeColumn.dingoSqlColumn;
+        if (dingoSqlColumn == null) {
+            throw DingoErrUtil.newStdErr(ErrNotSupportedYet);
+        }
         String name = dingoSqlColumn.name.getSimple();
         Column column = table.getColumns().stream()
             .filter(col -> col.getSchemaState() == SchemaState.SCHEMA_PUBLIC
```

**File**: `dingo-exec/src/main/java/io/dingodb/exec/operator/DistributeOperator.java` (modified, +4/-0)
```diff
@@ -19,6 +19,7 @@
 import io.dingodb.codec.CodecService;
 import io.dingodb.codec.KeyValueCodec;
 import io.dingodb.common.CommonId;
+import io.dingodb.common.log.LogUtils;
 import io.dingodb.common.partition.RangeDistribution;
 import io.dingodb.common.util.ByteArrayUtils;
 import io.dingodb.common.util.Optional;
@@ -88,6 +89,9 @@ public boolean push(Context context, @Nullable Object[] tuple, Vertex vertex) {
             KeyValueCodec indexCodec = CodecService.getDefault()
                 .createKeyValueCodec(indexTable.getCodecVersion(), indexTable.version,
                     indexTable.tupleType(), indexTable.keyMapping());
+            if (param.getDistributions().isEmpty() && "replicaTable".equalsIgnoreCase(indexTable.getName())) {
+                return true;
+            }
             partId = indexPs.calcPartId(indexTuple, wrap(indexCodec::encodeKey), param.getDistributions());
             NavigableMap<ByteArrayUtils.ComparableByteArray, RangeDistribution> distribution =
                 MetaService.root().getRangeDistribution(param.getTable().tableId);
```

---

### Incident Patch 11: `ffa89328` (2026-03-30)
**Commit Message**: [fix][dingo-executor] Fix blob type and decimal issues

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/executor/ShowColumnsExecutor.java` (modified, +2/-0)
```diff
@@ -112,6 +112,8 @@ private List<List<String>> getColumnFields() {
                 }
             } else if ("bit".equalsIgnoreCase(type) && column.getPrecision() > 0) {
                 type = type.toLowerCase() + "(" + column.getPrecision() + ")";
+            } else if ("varbinary".equalsIgnoreCase(type)) {
+                type = "blob";
             }
             columnValues.add(type.toLowerCase());
             columnValues.add(column.isNullable() ? "YES" : "NO");
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/executor/ShowCreateTableExecutor.java` (modified, +2/-0)
```diff
@@ -391,6 +391,8 @@ private static String getTypeName(String typeName, String elementTypeName) {
                     elementTypeName = "INT";
                 }
                 return elementTypeName + " " + typeName;
+            case "VARBINARY":
+                return "blob";
             default:
                 return typeName;
         }
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/rule/DingoTableModifyRule.java` (modified, +3/-0)
```diff
@@ -87,6 +87,9 @@ private static void checkUpdateInPart(@NonNull LogicalTableModify rel) {
                         if (obj instanceof Val) {
                             if (((Val)obj).getType() instanceof io.dingodb.expr.common.type.DecimalType) {
                                 if (((DecimalType) ((Val)obj).getType()).getScale() == 0) {
+                                    if (((Val) obj).getValue() == null) {
+                                        return Exprs.val(null, ((Val) obj).getType());
+                                    }
                                     BigDecimal bigDecimal = ((BigDecimal) (((Val) obj).getValue()))
                                         .setScale(0, RoundingMode.HALF_UP);
                                     return Exprs.val(bigDecimal, ((Val) obj).getType());
```

**File**: `dingo-exec/src/main/java/io/dingodb/exec/operator/InfoSchemaScanOperator.java` (modified, +13/-3)
```diff
@@ -182,8 +182,18 @@ private static Iterator<Object[]> getInformationColumns(String user, String host
                             if (column.getPrecision() > 0 && column.getScale() >= 0) {
                                 type = type + "(" + column.getPrecision() + "," + column.getScale() + ")";
                             }
+                        } else if ("varbinary".equalsIgnoreCase(type)) {
+                            type = "blob";
                         }
                         type = type.toLowerCase();
+                        long precision = column.precision;
+                        Long octetLength = null;
+                        String dataType = column.getSqlTypeName();
+                        if ("varbinary".equalsIgnoreCase(dataType)) {
+                            dataType = "blob";
+                            precision = 65535;
+                            octetLength = 65535L;
+                        }
                         String defaultValExpr;
                         if ("VARCHAR".equalsIgnoreCase(column.getSqlTypeName())
                             || "CHAR".equalsIgnoreCase(column.getSqlTypeName())) {
@@ -207,9 +217,9 @@ private static Iterator<Object[]> getInformationColumns(String user, String host
                             // is null
                             column.isNullable() ? "YES" : "NO",
                             // type name
-                            column.getSqlTypeName(),
-                            (long) column.precision,
-                            null,
+                            dataType,
+                            precision,
+                            octetLength,
                             null,
                             null,
                             null,
```

---

### Incident Patch 12: `2f347ee5` (2026-03-17)
**Commit Message**: [fix][dingo-common] Fixed the issue of concurrent data import

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/DingoParser.java` (modified, +1/-1)
```diff
@@ -289,7 +289,7 @@ public SqlNode parse(String sql) throws SqlParseException {
         if (StringUtils.isEmpty(context.getOption("sql_log"))) {
             SqlLogUtils.info("Input Query: {}", SqlUtil.checkSql(sqlNode, sql));
         }
-        LogUtils.trace(log, "==DINGO==>:[Parsed Query]: {}", sqlNode.toString());
+        //LogUtils.trace(log, "==DINGO==>:[Parsed Query]: {}", sqlNode.toString());
         return sqlNode;
     }
 
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/executor/LoadDataExecutor.java` (modified, +4/-4)
```diff
@@ -490,7 +490,7 @@ public CommonId getTxnId() {
 
     public void insertWithTxn(Object[] tuples) {
         ExecutionEnvironment env = ExecutionEnvironment.INSTANCE;
-        Map<String, KeyValue> caches = env.memCacheFor2PC.memoryCache
+        Map<String, KeyValue> caches = env.memCacheFor2PC
             .computeIfAbsent(statementId, e -> new TreeMap<>());
         KeyValue keyValue;
         try {
@@ -575,7 +575,7 @@ public void insertWithTxn(Object[] tuples) {
                 throw e;
             } finally {
                 txn.close();
-                env.memCacheFor2PC.memoryCache.remove(statementId);
+                env.memCacheFor2PC.remove(statementId);
             }
             long sub = System.currentTimeMillis() - start;
             long totalCount = count.get();
@@ -627,7 +627,7 @@ public void endWriteWithTxn() {
                     txnId, txnRetry, txnRetryCnt, timeOut
                 );
             }
-            Map<String, KeyValue> caches = env.memCacheFor2PC.memoryCache
+            Map<String, KeyValue> caches = env.memCacheFor2PC
                 .computeIfAbsent(statementId, e -> new TreeMap<>());
             List<TxnLocalData> tupleList = getCacheTupleList(caches, txnId);
             if (tupleList.isEmpty()) {
@@ -637,7 +637,7 @@ public void endWriteWithTxn() {
             count.addAndGet(result);
             caches.clear();
         } finally {
-            env.memCacheFor2PC.memoryCache.remove(statementId);
+            env.memCacheFor2PC.remove(statementId);
         }
         long end = System.currentTimeMillis();
         LogUtils.debug(log, "insert txn end batch, cost time:" + (end - start) + "ms");
```

**File**: `dingo-common/src/main/java/io/dingodb/common/environment/ExecutionEnvironment.java` (modified, +2/-2)
```diff
@@ -21,6 +21,7 @@
 import io.dingodb.common.privilege.PrivilegeGather;
 import io.dingodb.common.session.SessionUtil;
 
+import io.dingodb.common.store.KeyValue;
 import lombok.Getter;
 import lombok.Setter;
 
@@ -40,8 +41,7 @@ public class ExecutionEnvironment {
     public AtomicBoolean ddlOwner = new AtomicBoolean(false);
     public AtomicBoolean metaOwner = new AtomicBoolean(false);
     public volatile boolean initMetaDone = false;
-
-    public LocalMemCacheFor2PC memCacheFor2PC = new LocalMemCacheFor2PC();
+    public Map<Object, Map<String, KeyValue>> memCacheFor2PC = new ConcurrentHashMap<>();
 
     public MdlCheckTableInfo mdlCheckTableInfo = new MdlCheckTableInfo();
 
```

**File**: `dingo-common/src/main/java/io/dingodb/common/environment/LocalMemCacheFor2PC.java` (modified, +2/-2)
```diff
@@ -18,9 +18,9 @@
 
 import io.dingodb.common.store.KeyValue;
 
-import java.util.HashMap;
 import java.util.Map;
+import java.util.concurrent.ConcurrentHashMap;
 
 public class LocalMemCacheFor2PC {
-    public Map<Object, Map<String, KeyValue>> memoryCache = new HashMap<>();
+    public Map<Object, Map<String, KeyValue>> memoryCache = new ConcurrentHashMap<>();
 }
```

---

### Incident Patch 13: `fdba9b31` (2026-03-11)
**Commit Message**: [fix][dingo-calcite] Fix issue about static CAST.

**File**: `dingo-calcite/src/main/codegen/templates/Parser.jj` (modified, +3/-1)
```diff
@@ -99,6 +99,7 @@ import org.apache.calcite.sql.SqlWindow;
 import org.apache.calcite.sql.SqlWith;
 import org.apache.calcite.sql.SqlWithItem;
 import org.apache.calcite.sql.fun.SqlCase;
+import org.apache.calcite.sql.fun.SqlCastFunction;
 import org.apache.calcite.sql.fun.SqlInternalOperators;
 import org.apache.calcite.sql.fun.SqlLibraryOperators;
 import org.apache.calcite.sql.fun.SqlStdOperatorTable;
@@ -6771,7 +6772,8 @@ SqlNode BuiltinFunctionCall() :
             <INTERVAL> { aliasBuilder.append(" ").append(this.token.image); } e = IntervalQualifier() { args.add(e); aliasBuilder.append(e.toString()); }
         )
         <RPAREN> {
-            SqlNode sqlNode = SqlStdOperatorTable.CAST.createCall(s.end(this), args);
+            SqlCastFunction sqlCastFunction = new SqlCastFunction();
+            SqlNode sqlNode = sqlCastFunction.createCall(s.end(this), args);
             aliasBuilder.append(")");
             sqlNode.putAlias("aliasName", aliasBuilder.toString());
             sqlNode.putAlias("fullAlias", "true");
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/rule/UnionAllAddProjectRule.java` (modified, +2/-1)
```diff
@@ -37,6 +37,7 @@
 import org.apache.calcite.rex.RexInputRef;
 import org.apache.calcite.rex.RexNode;
 import org.apache.calcite.sql.SqlOperator;
+import org.apache.calcite.sql.fun.SqlCastFunction;
 import org.apache.calcite.sql.fun.SqlStdOperatorTable;
 import org.apache.calcite.sql.type.SqlTypeName;
 import org.immutables.value.Value;
@@ -91,7 +92,7 @@ public void onMatch(RelOptRuleCall call) {
                 RexInputRef inputRef = new RexInputRef(i, diffType);
                 List<RexNode> operands = new ArrayList<>();
                 operands.add(inputRef);
-                RexNode cast = new RexCall(targetRelDataType, SqlStdOperatorTable.CAST, operands);
+                RexNode cast = new RexCall(targetRelDataType, new SqlCastFunction(), operands);
                 rexNodeList.add(cast);
                 diffCnt ++;
             } else {
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/type/converter/RexLiteralConverter.java` (modified, +2/-2)
```diff
@@ -79,12 +79,12 @@ public Object convert(Object @NonNull [] value, @NonNull DingoType elementType)
 
     @Override
     public Integer convertIntegerFrom(@NonNull Object value) {
-        return (Integer) ExprCompiler.ADVANCED.visit(Exprs.op(Exprs.TO_INT_C, Exprs.val(value))).eval();
+        return (Integer) ExprCompiler.getAdvancedExprCompiler().visit(Exprs.op(Exprs.TO_INT_C, Exprs.val(value))).eval();
     }
 
     @Override
     public Long convertLongFrom(@NonNull Object value) {
-        return (Long) ExprCompiler.ADVANCED.visit(Exprs.op(Exprs.TO_LONG_C, Exprs.val(value))).eval();
+        return (Long) ExprCompiler.getAdvancedExprCompiler().visit(Exprs.op(Exprs.TO_LONG_C, Exprs.val(value))).eval();
     }
 
     @Override
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/utils/CalcValueUtils.java` (modified, +2/-2)
```diff
@@ -51,7 +51,7 @@ public static Object calcValue(
         SqlExprEvalContext etx = new SqlExprEvalContext();
         etx.setTuple(tuple);
 
-        ExprCompiler exprCompiler = ExprCompiler.ADVANCED;
+        ExprCompiler exprCompiler = ExprCompiler.getAdvancedExprCompiler();
         exprCompiler.setProcessor(config.getProcessor());
 
         try {
@@ -65,7 +65,7 @@ public static Object calcValue(
             throw new RuntimeException(e);
         }
 
-        return ExprCompiler.ADVANCED.visit(expr, new SqlExprCompileContext(tupleType, null))
+        return exprCompiler.visit(expr, new SqlExprCompileContext(tupleType, null))
                 .eval(etx, config);
     }
 
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/utils/TableUtils.java` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ public static List<Object[]> getTuplesForKeyMapping(
                 Object[] tuple = new Object[td.getColumns().size()];
                 for (Map.Entry<Integer, RexNode> entry : item.entrySet()) {
                     Expr expr = RexConverter.convert(entry.getValue());
-                    Object val = ExprCompiler.ADVANCED.visit(expr).eval();
+                    Object val = ExprCompiler.getAdvancedExprCompiler().visit(expr).eval();
                     Column column = td.getColumns().get(entry.getKey());
                     if (column.getType() instanceof FloatType && val instanceof Double) {
                         tuple[entry.getKey()] = Float.valueOf(val.toString());
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/visitor/function/DingoRepeatUnionVisitFun.java` (modified, +2/-1)
```diff
@@ -44,6 +44,7 @@
 import org.apache.calcite.rex.RexCall;
 import org.apache.calcite.rex.RexInputRef;
 import org.apache.calcite.rex.RexNode;
+import org.apache.calcite.sql.fun.SqlCastFunction;
 import org.apache.calcite.sql.fun.SqlStdOperatorTable;
 import org.checkerframework.checker.nullness.qual.NonNull;
 
@@ -155,7 +156,7 @@ public static List<RexNode> checkUnionType(RelNode seedRel, RelNode iterativeRel
                 RexInputRef inputRef = new RexInputRef(i, typeField1.getType());
                 List<RexNode> operands = new ArrayList<>();
                 operands.add(inputRef);
-                RexNode cast = new RexCall(targetType, SqlStdOperatorTable.CAST, operands);
+                RexNode cast = new RexCall(targetType, new SqlCastFunction(), operands);
                 rexNodeList.add(cast);
                 diffCnt ++;
             } else {
```

**File**: `dingo-calcite/src/test/java/io/dingodb/calcite/TestRex.java` (modified, +2/-2)
```diff
@@ -127,7 +127,7 @@ public void test(String rex, String exprStr, Object expected)
         RexNode rexNode = getRexNode(rex);
         Expr expr = RexConverter.convert(rexNode);
         assertThat(expr.toString()).isEqualTo(exprStr);
-        Assert.of(ExprCompiler.ADVANCED.visit(expr).eval()).isEqualTo(expected);
+        Assert.of(ExprCompiler.getAdvancedExprCompiler().visit(expr).eval()).isEqualTo(expected);
     }
 
     @ParameterizedTest
@@ -139,7 +139,7 @@ public void test(String rex, String exprStr, Object expected)
     public void testNow(String str) throws Exception {
         RexNode rexNode = getRexNode(str);
         Expr expr = RexConverter.convert(rexNode);
-        assertThat((Timestamp) ExprCompiler.ADVANCED.visit(expr).eval())
+        assertThat((Timestamp) ExprCompiler.getAdvancedExprCompiler().visit(expr).eval())
             .isCloseTo(DateTimeUtils.currentTimestampSecond(DingoTimeZoneContext.getTimeZone()), 3L * 1000L);
     }
 
```

**File**: `dingo-exec/src/main/java/io/dingodb/exec/expr/SqlExpr.java` (modified, +2/-2)
```diff
@@ -77,7 +77,7 @@ public byte[] getCoding(DingoType tupleType, DingoType parasType) {
     public void compileIn(DingoType tupleType, DingoType parasType) {
         try {
             CompileContext context = new SqlExprCompileContext(tupleType, parasType);
-            expr = ExprCompiler.ADVANCED.visit(parseExpr(), context);
+            expr = ExprCompiler.getAdvancedExprCompiler().visit(parseExpr(), context);
             etx = new SqlExprEvalContext();
         } catch (ExprParseException | ExprCompileException e) {
             throw new IllegalStateException(e);
@@ -87,7 +87,7 @@ public void compileIn(DingoType tupleType, DingoType parasType) {
     public void compileInWithContext(DingoType tupleType, DingoType parasType, DingoCompileContext dingoCompileContext ) {
         try {
             //CompileContext context = new SqlExprCompileContext(tupleType, parasType);
-            expr = ExprCompiler.ADVANCED.visit(parseExpr(), dingoCompileContext);
+            expr = ExprCompiler.getAdvancedExprCompiler().visit(parseExpr(), dingoCompileContext);
             etx = new SqlExprEvalContext();
         } catch (ExprParseException | ExprCompileException e) {
             throw new IllegalStateException(e);
```

---

### Incident Patch 14: `05f1e23e` (2026-03-06)
**Commit Message**: [fix][dingo-calcite] Make precision compatible with mysql in add and minus ops.

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/DingoTypeMapper.java` (modified, +12/-0)
```diff
@@ -283,6 +283,8 @@ public static RelDataType getBinaryArithmeticResultType(
                 if (operator.getKind() == SqlKind.MOD) {
                     //Max digits for tinyint adds scale.
                     precision = Math.max(3, precision);
+                } else if (operator.getKind() == SqlKind.PLUS || operator.getKind() == SqlKind.MINUS) {
+                    precision = Math.max(3, precision) + right.getScale();
                 }
                 ret = factory.createSqlType(SqlTypeName.DECIMAL, precision, right.getScale());
             } else if (SqlTypeUtil.isCharacter(right)) {
@@ -300,6 +302,8 @@ public static RelDataType getBinaryArithmeticResultType(
                 if (operator.getKind() == SqlKind.MOD) {
                     //Max digits for int adds scale.
                     precision = Math.max(10, precision);
+                } else if(operator.getKind() == SqlKind.PLUS || operator.getKind() == SqlKind.MINUS) {
+                    precision = Math.max(10, precision) + right.getScale();
                 }
                 ret = factory.createSqlType(SqlTypeName.DECIMAL, precision, right.getScale());
             } else if (SqlTypeUtil.isCharacter(right)) {
@@ -317,6 +321,8 @@ public static RelDataType getBinaryArithmeticResultType(
                 if (operator.getKind() == SqlKind.MOD) {
                     //Max digits for int adds scale.
                     precision = Math.max(19, precision);
+                } else if(operator.getKind() == SqlKind.PLUS || operator.getKind() == SqlKind.MINUS) {
+                    precision = Math.max(19, precision) + right.getScale();
                 }
                 ret = factory.createSqlType(SqlTypeName.DECIMAL, precision, right.getScale());
             } else if (SqlTypeUtil.isCharacter(right)) {
@@ -344,20 +350,26 @@ public static RelDataType getBinaryArithmeticResultType(
                 if (operator.getKind() == SqlKind.MOD) {
                     //Max digits for tinyint adds scale.
                     precision = Math.max(3, precision);
+                } else if(operator.getKind() == SqlKind.PLUS || operator.getKind() == SqlKind.MINUS) {
+                    precision = Math.max(3, precision) + left.getScale();
                 }
                 ret = factory.createSqlType(SqlTypeName.DECIMAL, precision, left.getScale());
             } else if (SqlTypeUtil.isInt(right)) {
                 int precision = left.getPrecision();
                 if (operator.getKind() == SqlKind.MOD) {
                     //Max digits for int adds scale.
                     precision = Math.max(10, precision);
+                } else if(operator.getKind() == SqlKind.PLUS || operator.getKind() == SqlKind.MINUS) {
+                    precision = Math.max(10, precision) + left.getScale();
                 }
                 ret = factory.createSqlType(SqlTypeName.DECIMAL, precision, left.getScale());
             } else if (SqlTypeUtil.isBigint(right)) {
                 int precision = left.getPrecision();
                 if (operator.getKind() == SqlKind.MOD) {
                     //Max digits for bigint adds scale.
                     precision = Math.max(19, precision);
+                } else if(operator.getKind() == SqlKind.PLUS || operator.getKind() == SqlKind.MINUS) {
+                    precision = Math.max(19, precision) + left.getScale();
                 }
                 ret = factory.createSqlType(SqlTypeName.DECIMAL, precision, left.getScale());
             } else if (SqlTypeUtil.isCharacter(left)) {
```

---

### Incident Patch 15: `f9bdf911` (2026-03-05)
**Commit Message**: [fix][dingo-calcite] Fix issue that table meta changed in the process of literal handling.

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/utils/RexLiteralUtils.java` (modified, +6/-2)
```diff
@@ -36,8 +36,12 @@ private RexLiteralUtils() {
         if (!rexLiteral.isNull()) {
             // `rexLiteral.getType()` is not always the required type.
             if (type instanceof DecimalType) {
-                ((DecimalType) type).setPrecision(rexLiteral.getType().getPrecision());
-                ((DecimalType) type).setScale(rexLiteral.getType().getScale());
+                DecimalType decimalType = new DecimalType(((DecimalType) type).isNullable());
+
+                ((DecimalType) decimalType).setPrecision(rexLiteral.getType().getPrecision());
+                ((DecimalType) decimalType).setScale(rexLiteral.getType().getScale());
+
+                return decimalType.convertFrom(rexLiteral.getValue(), RexLiteralConverter.INSTANCE);
             }
             return type.convertFrom(rexLiteral.getValue(), RexLiteralConverter.INSTANCE);
         }
```

**File**: `dingo-exec/src/main/java/io/dingodb/exec/impl/TaskImpl.java` (modified, +5/-0)
```diff
@@ -206,13 +206,18 @@ public void init() {
         });
 
         for (Vertex vertex : this.getVertexes().values()) {
+            Thread thread = Thread.currentThread();
+            String threadName = thread.getName();
             try {
+                thread.setName("vertex-" + jobId + "-" + this.id + "-" + vertex.getId() + "-" +vertex.getOp() + "-" + thread.getId());
                 vertex.init();
             } catch (Exception ex) {
                 LogUtils.error(log, "Init operator:" + vertex.getOp() + "in jobId:" + jobId.toString()
                     + " task:" + this.id.toString() + " failed catch exception:", ex);
                 statusErrMsg = ex.toString();
                 isStatusOK = false;
+            } finally {
+                thread.setName(threadName);
             }
         }
         taskInitStatus = new TaskStatus();
```

#### Recent Merged Pull Requests:
- **PR #1854** (2026-09-23): Fix charset-aware MySQL expressions and result encoding (@ketor)
- **PR #1853** (2026-09-23): Fix MySQL compatibility issues blocking Bytebase and Metabase integration (@ketor)
- **PR #1850** (2026-07-10): [fix][dingo-calcite] Fix SqlValidator validation issue: not in group by (@guojn1)
- **PR #1849** (2026-05-25): [feat][dingo-store-proxy] Add txnScan lock collection mechanism (@DJSaa)
- **PR #1847** (closed): [fix][dingo-calcite] Modify the equals function in the indexScan (@guojn1)
- **PR #1846** (2026-05-08):  [fix][dingo-store-proxy] Optimize the GC region deletion process (@guojn1)
- **PR #1845** (2026-04-30): [fix][dingo-calcite] Correct the comment for the unique index (@guojn1)
- **PR #1844** (2026-04-29): [fix][dingo-calcite] Fix the error message issue for alterTableColumn (@guojn1)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
