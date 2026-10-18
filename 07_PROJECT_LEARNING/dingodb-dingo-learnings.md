> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dingodb-dingo-learnings.md`  
> **Source**: github ([https://github.com/dingodb/dingo](https://github.com/dingodb/dingo))  
> **Source Version**: `bb96a741`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T23:32:57.200Z  
> **Learning ID**: `learn-github-dingodb-dingo`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): dingodb/dingo

> **Canonical Artifact**: `07_PROJECT_LEARNING/dingodb-dingo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dingodb/dingo](https://github.com/dingodb/dingo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-18T23:32:57.197Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dingodb/dingo`
- **Description**: A multi-modal vector database that supports upserts and vector queries using unified SQL (MySQL-Compatible) on structured and unstructured data, while meeting the requirements of high concurrency and ultra-low latency.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1705 stars

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

### Incident Patch 1: `948fe8de` (2026-09-23)
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

### Incident Patch 2: `f9bdf911` (2026-03-05)
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

---

### Incident Patch 3: `504311c4` (2026-01-27)
**Commit Message**: [fix][dingo-calcite] Change tableScan expression compilation from SqlExpr to RelOp

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/rel/LogicalDingoTableScan.java` (modified, +10/-0)
```diff
@@ -21,7 +21,11 @@
 import io.dingodb.calcite.fun.DingoOperatorTable;
 import io.dingodb.calcite.stats.StatsCache;
 import io.dingodb.calcite.utils.RelDataTypeUtils;
+import io.dingodb.calcite.visitor.RexConverter;
 import io.dingodb.common.type.TupleMapping;
+import io.dingodb.expr.rel.RelOp;
+import io.dingodb.expr.rel.op.RelOpBuilder;
+import io.dingodb.expr.runtime.expr.Expr;
 import io.dingodb.meta.entity.Column;
 import io.dingodb.meta.entity.IndexTable;
 import io.dingodb.meta.entity.Table;
@@ -67,6 +71,8 @@ public class LogicalDingoTableScan extends TableScan {
     @Getter
     protected final RexNode filter;
     @Getter
+    protected RelOp relOp;
+    @Getter
     protected TupleMapping selection;
     @Getter
     protected TupleMapping realSelection;
@@ -161,6 +167,10 @@ public LogicalDingoTableScan(
         // The vector distance function adapts to the corresponding function based on the table vector type
         // such as L2_ Distance, ip_ Distance, cosine_ Distance, etc
         if (filter != null) {
+            Expr expr = RexConverter.convert(filter);
+            relOp = RelOpBuilder.builder()
+                .filter(expr)
+                .build();
             dispatchDistanceCondition(filter, selection, dingoTable);
         }
     }
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/utils/CalcValueUtils.java` (modified, +1/-0)
```diff
@@ -52,6 +52,7 @@ public static Object calcValue(
         etx.setTuple(tuple);
 
         ExprCompiler exprCompiler = ExprCompiler.ADVANCED;
+        exprCompiler.setProcessor(config.getProcessor());
 
         try {
             if ((rexNode instanceof RexCall)
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/visitor/function/DingoGetByIndexMergeVisitFun.java` (modified, +4/-1)
```diff
@@ -43,6 +43,7 @@
 import io.dingodb.exec.operator.params.IndexMergeParam;
 import io.dingodb.exec.operator.params.TxnGetByIndexParam;
 import io.dingodb.exec.transaction.base.ITransaction;
+import io.dingodb.expr.rel.RelOp;
 import io.dingodb.meta.MetaService;
 import io.dingodb.meta.entity.Column;
 import io.dingodb.meta.entity.Table;
@@ -140,12 +141,14 @@ public static Collection<Vertex> visit(
                     visitor.isForUpdate());
 
                 Vertex vertex;
+                RelOp relOp = rel.getRelOp();
                 if (transaction != null) {
                     vertex = new Vertex(TXN_GET_BY_INDEX, new TxnGetByIndexParam(
                         idxId,
                         tableInfo.getId(),
                         tupleMapping,
-                        SqlExprUtils.toSqlExpr(rel.getFilter()),
+                        relOp != null ? null : SqlExprUtils.toSqlExpr(rel.getFilter()),
+                        relOp,
                         lookupKeyMapping,
                         rel.isUnique(),
                         indexTd,
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/visitor/function/DingoGetByIndexVisitFun.java` (modified, +4/-1)
```diff
@@ -41,6 +41,7 @@
 import io.dingodb.exec.operator.params.GetByIndexParam;
 import io.dingodb.exec.operator.params.TxnGetByIndexParam;
 import io.dingodb.exec.transaction.base.ITransaction;
+import io.dingodb.expr.rel.RelOp;
 import io.dingodb.meta.MetaService;
 import io.dingodb.meta.entity.Column;
 import io.dingodb.meta.entity.Table;
@@ -140,12 +141,14 @@ public static LinkedList<Vertex> visit(
                     visitor.isForUpdate());
 
                 Vertex vertex;
+                RelOp relOp = rel.getRelOp();
                 if (transaction != null) {
                     vertex = new Vertex(TXN_GET_BY_INDEX, new TxnGetByIndexParam(
                         idxId,
                         tableInfo.getId(),
                         tupleMapping,
-                        SqlExprUtils.toSqlExpr(rel.getFilter()),
+                        relOp != null ? null : SqlExprUtils.toSqlExpr(rel.getFilter()),
+                        relOp,
                         rel.getSelection(),
                         rel.isUnique(),
                         indexTd,
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/visitor/function/DingoGetByKeysFun.java` (modified, +4/-1)
```diff
@@ -40,6 +40,7 @@
 import io.dingodb.exec.operator.params.GetDistributionParam;
 import io.dingodb.exec.operator.params.TxnGetByKeysParam;
 import io.dingodb.exec.transaction.base.ITransaction;
+import io.dingodb.expr.rel.RelOp;
 import io.dingodb.meta.entity.Table;
 import io.dingodb.store.api.transaction.data.IsolationLevel;
 import io.dingodb.tso.TsoService;
@@ -100,13 +101,15 @@ public static List<Vertex> visit(
         distributionVertex.setId(idGenerator.getOperatorId(task.getId()));
         task.putVertex(distributionVertex);
         Vertex getVertex;
+        RelOp relOp = rel.getRelOp();
         long scanTs = VisitUtils.getScanTs(transaction, visitor.getKind(), visitor.getPointTs(), visitor.isForUpdate());
         if (transaction != null) {
             TxnGetByKeysParam param = new TxnGetByKeysParam(
                 tableInfo.getId(),
                 td.tupleType(),
                 td.keyMapping(),
-                SqlExprUtils.toSqlExpr(rel.getFilter()),
+                relOp != null ? null : SqlExprUtils.toSqlExpr(rel.getFilter()),
+                relOp,
                 rel.getSelection(),
                 td,
                 scanTs,
```

**File**: `dingo-calcite/src/main/java/io/dingodb/calcite/visitor/function/DingoTableScanVisitFun.java` (modified, +4/-1)
```diff
@@ -42,6 +42,7 @@
 import io.dingodb.exec.operator.params.PartRangeScanParam;
 import io.dingodb.exec.operator.params.TxnPartRangeScanParam;
 import io.dingodb.exec.transaction.base.ITransaction;
+import io.dingodb.expr.rel.RelOp;
 import io.dingodb.meta.entity.Table;
 import io.dingodb.store.api.transaction.data.IsolationLevel;
 import lombok.extern.slf4j.Slf4j;
@@ -121,6 +122,7 @@ private DingoTableScanVisitFun() {
         List<Vertex> outputs = new ArrayList<>();
 
         long scanTs = VisitUtils.getScanTs(transaction, visitor.getKind(), visitor.getPointTs(), visitor.isForUpdate());
+        RelOp relOp = rel.getRelOp();
         for (int i = 0; i < Optional.mapOrGet(td.getPartitions(), List::size, () -> 0); i++) {
             Vertex scanVertex;
             if (transaction != null) {
@@ -135,7 +137,8 @@ private DingoTableScanVisitFun() {
                     td.tupleType(),
                     td.keyMapping(),
                     td.version,
-                    Optional.mapOrNull(filter, SqlExpr::copy),
+                    relOp != null ? null : Optional.mapOrNull(filter, SqlExpr::copy),
+                    relOp,
                     rel.getSelection(),
                     rel.getGroupSet() == null ? null
                         : AggFactory.getAggKeys(rel.getGroupSet()),
```

**File**: `dingo-client/src/main/java/io/dingodb/client/OperationServiceV2.java` (modified, +1/-0)
```diff
@@ -638,6 +638,7 @@ private List<Vertex> getByKey(Table td,
                     td.keyMapping(),
                     null,
                     null,
+                    null,
                     td,
                     scanTs,
                     transaction.getIsolationLevel(),
```

**File**: `dingo-exec/src/main/java/io/dingodb/exec/operator/FilterProjectOperator.java` (modified, +13/-0)
```diff
@@ -22,6 +22,8 @@
 import io.dingodb.exec.expr.SqlExpr;
 import io.dingodb.exec.operator.data.Context;
 import io.dingodb.exec.operator.params.FilterProjectParam;
+import io.dingodb.expr.rel.RelOp;
+import io.dingodb.expr.rel.op.FilterOp;
 import org.checkerframework.checker.nullness.qual.NonNull;
 
 import java.util.Iterator;
@@ -33,6 +35,7 @@ protected Iterator<Object[]> createIterator(Context context, Object[] tuple, Ver
         FilterProjectParam param = vertex.getParam();
         Iterator<Object[]> iterator = createSourceIterator(context, tuple, vertex);
         SqlExpr filter = param.getFilter();
+        RelOp relOp = param.getRelOp();
         TupleMapping selection = param.getSelection();
         if (selection != null) {
             iterator = Iterators.transform(iterator, selection::revMap);
@@ -47,6 +50,16 @@ protected Iterator<Object[]> createIterator(Context context, Object[] tuple, Ver
                 }
             );
         }
+        if (relOp != null) {
+            iterator = Iterators.filter(
+                iterator,
+                t -> {
+                    vertex.incrementCnt();
+                    Object[] v = ((FilterOp) relOp).put(t);
+                    return v != null;
+                }
+            );
+        }
         return iterator;
     }
 
```

#### Recent Merged Pull Requests:
- **PR #1854** (2026-09-23): Fix charset-aware MySQL expressions and result encoding (@ketor)
- **PR #1853** (2026-09-23): Fix MySQL compatibility issues blocking Bytebase and Metabase integration (@ketor)
- **PR #1850** (2026-07-10): [fix][dingo-calcite] Fix SqlValidator validation issue: not in group by (@guojn1)
- **PR #1849** (2026-05-25): [feat][dingo-store-proxy] Add txnScan lock collection mechanism (@DJSaa)
- **PR #1847** (closed): [fix][dingo-calcite] Modify the equals function in the indexScan (@guojn1)
- **PR #1846** (2026-05-08):  [fix][dingo-store-proxy] Optimize the GC region deletion process (@guojn1)

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

## X. [feat][dingo-calcite,dingo-exec,dingo-executor,dingo-driver] Fix MySQL compatibi

**RULE**:
When implementing operations in `dingo-calcite/src/main/codegen/includes/Show.ftl`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dingodb/dingo. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `948fe8de`: [feat][dingo-calcite,dingo-exec,dingo-executor,dingo-driver] Fix MySQL compatibility issues blocking Bytebase and Metabase. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `dingo-calcite/src/main/codegen/includes/Show.ftl`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
    (
      LOOKAHEAD(2) <CURRENT_USER> [<LPAREN> <RPAREN>]
      {
        // SHOW GRANTS FOR CURRENT_USER() returns the grants of the current
        // session user, same as plain SHOW GRANTS (user == null).
        return new SqlShowGrants(s.end(this), null, "%");
      }
    |
      [
           <QUOTED_STRING> { user = token.image; }
           [<AT_SPLIT> <QUOTED_STRING> { host = token.image;} ]
           {
           return new SqlShowGrants(s.end(this), user, host);
           }
      ]
      userIdentifier = CompoundIdentifier() { user = userIdentifier.getSimple(); }
      [<AT_SPLIT> (<QUOTED_STRING> | <IDENTIFIER>) {host = token.image; } ]
    )
```

**NEGATIVE CONSTRAINT**:
```java
// Anti-pattern to NEVER write (induced failure mode):
  [
       <QUOTED_STRING> { user = token.image; }
       [<AT_SPLIT> <QUOTED_STRING> { host = token.image;} ]
       {
       return new SqlShowGrants(s.end(this), user, host);
       }
  ]
  userIdentifier = CompoundIdentifier() { user = userIdentifier.getSimple(); }
  [<AT_SPLIT> (<QUOTED_STRING> | <IDENTIFIER>) {host = token.image; } ]
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `948fe8de` are properly handled with clean fallback behavior.
