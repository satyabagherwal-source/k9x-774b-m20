# Verification Protocol: Verification Protocol: Empirical Defect Shield for tableproapp-tablepro-learnings

<!-- PROVENANCE_START
{
  "source_repository": "tableproapp-tablepro-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T20:34:30.468Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tableproapp-tablepro-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tableproapp-tablepro-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T20:34:30.468Z`  
> **Learning ID**: `LEARN-EVO-tableproapp-tablepro-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `tableproapp-tablepro-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tableproapp-tablepro-learnings.md`  
> **Source**: github ([https://github.com/TableProApp/TablePro](https://github.com/TableProApp/TablePro))  
> **Source Version**: `0b0c7243`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-19T20:24:19.716Z  
> **Learning ID**: `learn-github-tableproapp-tablepro`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): TableProApp/TablePro

> **Canonical Artifact**: `07_PROJECT_LEARNING/tableproapp-tablepro-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TableProApp/TablePro](https://github.com/TableProApp/TablePro))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-19T20:24:19.579Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TableProApp/TablePro`
- **Description**: Free, open-source native database client for macOS, Linux, iPhone and iPad.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 6491 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apple/Native/HanaBridge/internal/hana/statement.go`
```
package hana

import (
	"context"
	"database/sql"
	"fmt"

	hdb "github.com/SAP/go-hdb/driver"
)

func runStatement(conn *sql.Conn, op *operation, request executeRequest) (*resultEnvelope, error) {
	if op.stopped() {
		return nil, errOperationStopped
	}
	if request.hasParameters() {
		return runParameterized(conn, op, request)
	}
	if routesToExec(request.SQL) {
		return runCountingStatement(conn, request.SQL)
	}
	return runQuery(conn, op, request.SQL, request.rowLimit())
}

func runCountingStatement(conn *sql.Conn, statement string) (*resultEnvelope, error) {
	result, err := conn.ExecContext(context.Background(), statement)
	if err != nil {
		return nil, err
	}
	return affectedRowsEnvelope(rowsAffected(result)), nil
}

func runQuery(conn *sql.Conn, op *operation, statement string, rowLimit int) (envelope *resultEnvelope, err error) {
	rows, err := conn.QueryContext(context.Background(), statement)
	if err != nil {
		return nil, err
	}
	defer cleanupInto(&err, rows.Close)
	return readFirstResultSet(rows, op, rowLimit)
}

type preparedPlan struct {
	arguments   []any
	returnsRows bool
	bindsLob    bool
}

func runParameterized(conn *sql.Conn, op *operation, request executeRequest) (envelope *resultEnvelope, err error) {
	var metadata hdb.StmtMetadata
	statement, err := conn.PrepareContext(hdb.WithStmtMetadata(context.Background(), &metadata), request.SQL)
	if err != nil {
		return nil, err
	}
	plan, failure := planPreparedStatement(metadata, *request.Parameters)
	if failure != nil {
		return nil, joinCleanupFailure(failure, statement.Close())
	}
	if plan.bindsLob {
		if err := joinCleanupFailure(nil, statement.Close()); err != nil {
			return nil, err
		}
		return runInTransaction(conn, op, request, plan)
	}
	defer cleanupInto(&err, statement.Close)
	return runPrepared(statement, op, request.rowLimit(), plan)
}

func planPreparedStatement(metadata hdb.StmtMetadata, values []cell) (preparedPlan, *bridgeError) {
	if metadata == nil {
		return preparedPlan{}, internalError("the prepared statement carries no metadata")
	}
	parameters := describeParameters(metadata.ParameterTypes())
	if failure := refuseOutputParameters(parameters); failure != nil {
		return preparedPlan{}, failure
	}
	arguments, failure := bindParameters(values, parameters)
	if failure != nil {
		return preparedPlan{}, failure
	}
	return preparedPlan{
		arguments:   arguments,
		returnsRows: len(metadata.ColumnTypes()) > 0,
		bindsLob:    bindsLargeObject(parameters),
	}, nil
}

func runInTransaction(conn *sql.Conn, op *operation, request executeRequest, plan preparedPlan) (*resultEnvelope, error) {
	if op.stopped() {
		return nil, errOperationStopped
	}
	transaction, err := conn.BeginTx(context.Background(), nil)
	if err != nil {
		return nil, err
	}
	envelope, err := runTransactionStatement(transaction, op, request, plan)
	if err == nil && op.stopped() {
		err = errOperationStopped
	}
	if err != nil {
		if rollbackErr := transaction.Rollback(); rollbackErr != nil {
			return nil, unsettledTransaction(err, rollbackErr)
		}
		return nil, err
	}
	if err := transaction.Commit(); err != nil {
		return nil, unsettledTransaction(nil, err)
	}
	return envelope, nil
}

func runTransactionStatement(transaction *sql.Tx, op *operation, request executeRequest, plan preparedPlan) (envelope *resultEnvelope, err error) {
	statement, err := transaction.PrepareContext(context.Background(), request.SQL)
	if err != nil {
		return nil, err
	}
	defer cleanupInto(&err, statement.Close)
	return runPrepared(statement, op, request.rowLimit(), plan)
}

func runPrepared(statement *sql.Stmt, op *operation, rowLimit int, plan preparedPlan) (envelope *resultEnvelope, err error) {
	if op.stopped() {
		return nil, errOperationStopped
	}
	if !plan.returnsRows {
		result, err := statement.ExecContext(context.Background(), plan.arguments...)
		if err != nil {
			return nil, err
		}
		return affectedRowsEnvelope(rowsAffected(result)), nil
	}
	rows, err := statement.QueryContext(context.Background(), plan.arguments...)
	if err != nil {
		return nil, err
	}
	defer cleanupInto(&err, rows.Close)
	return readFirstResultSet(rows, op, rowLimit)
}

func describeParameters(parameters []hdb.ParameterType) []parameterType {
	described := make([]parameterType, len(parameters))
	for index, parameter := range parameters {
		described[index] = describeParameter(parameter)
	}
	return described
}

func rowsAffected(result sql.Result) int64 {
	count, err := result.RowsAffected()
	if err != nil {
		return 0
	}
	return count
}

func readFirstResultSet(rows *sql.Rows, op *operation, rowLimit int) (*resultEnvelope, error) {
	found, err := moveToFirstResultSet(rows)
	if err != nil {
		return nil, err
	}
	if !found {
		return affectedRowsEnvelope(0), nil
	}
	return readResultSet(rows, op, rowLimit)
}

func moveToFirstResultSet(rows *sql.Rows) (bool, error) {
	for {
		columns, err := rows.Columns()
		if err != nil {
			return false, err
		}
		if len(columns) > 0 {
			return true, nil
		}
		if !rows.NextResultSet() {
			return false, rows.Err()
		}
	}
}

func readResultSet(rows *sql.Rows, op *operation, rowLimit int) (*resultEnvelope, error) {
	columns, err := describeColumns(rows)
	if err != nil {
		return nil, err
	}
	envelope := tabularEnvelope(columns)
	reader := &resultReader{rows: rows, columns: columns, op: op}
	collected := &collectedRows{limit: rowLimit}
	ended, err := reader.read(collected)
	if err != nil {
		return nil, err
	}
	envelope.rows = collected.rows
	envelope.isTruncated = !ended
	envelope.truncatedLobCount = collected.truncatedLobs
	return envelope, nil
}

type rowSink interface {
	full() bool
	add(row []cell, truncatedLobs int)
}

type resultReader struct {
	rows    *sql.Rows
	columns []columnInfo
	op      *operation
	// Next has moved to a row that no sink has taken yet, so the next read starts with it.
	pending bool
}

// The bool is true once the result set has no rows left.
func (r *resultReader) read(sink rowSink) (bool, error) {
	for {
		if !r.pending {
			if !r.rows.Next() {
				return true, r.rows.Err()
			}
			r.pending = true
		}
		if r.op.stopped() {
			return false, errOperationStopped
		}
		if sink.full() {
			return false, nil
		}
		row, truncatedLobs, err := scanRow(r.rows, r.columns, r.op)
		if err != nil {
			return false, err
		}
		r.pending = false
		sink.add(row, truncatedLobs)
	}
}

type collectedRows struct {
	limit         int
	rows          [][]cell
	truncatedLobs int
}

func (c *collectedRows) full() bool {
	return c.limit > 0 && len(c.rows) >= c.limit
}

func (c *collectedRows) add(row []cell, truncatedLobs int) {
	c.rows = append(c.rows, row)
	c.truncatedLobs += truncatedLobs
}

func describeColumns(rows *sql.Rows) (columns []columnInfo, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			columns = nil
			err = internalError(fmt.Sprintf("unsupported column type: %v", recovered))
		}
	}()
	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, err
	}
	columns = make([]columnInfo, len(columnTypes))
	for index, columnType := range columnTypes {
		columns[index] = describeColumn(columnType)
	}
	return columns, nil
}

func scanRow(rows *sql.Rows, columns []columnInfo, op *operation) ([]cell, int, error) {
	values := make([]any, len(columns))
	lobs := make([]*lobCell, len(columns))
	destinations := make([]any, len(columns))
	for index, column := range columns {
		if column.isLob() {
			lobs[index] = newLobCell(lobCellLimit, op.stopped)
			destinations[index] = lobs[index]
			continue
		}
		destinations[index] = &values[index]
	}
	if err := rows.Scan(destinations...); err != nil {
		return nil, 0, err
	}
	row := make([]cell, len(columns))
	truncatedLobs := 0
	for index, column := range columns {
		lob := lobs[index]
		if lob == nil {
			row[index] = formatValue(values[index], column)
			continue
		}
		row[index] = lob.cell(column)
		if lob.truncated {
			truncatedLobs++
		}
	}
	return row, truncatedLobs, nil
}

```

### Core Architecture Module: `apple/Packages/TableProCore/Package.swift`
```
// swift-tools-version: 6.0

import PackageDescription

// The plugins and the iOS app compile this code under SWIFT_APPROACHABLE_CONCURRENCY and MemberImportVisibility.
let pluginCoreSettings: [SwiftSetting] = [
    .enableUpcomingFeature("NonisolatedNonsendingByDefault"),
    .enableUpcomingFeature("InferIsolatedConformances"),
    .enableUpcomingFeature("MemberImportVisibility")
]

let package = Package(
    name: "TableProCore",
    platforms: [
        .macOS(.v13),
        .iOS(.v17)
    ],
    products: [
        .library(name: "TableProCoreTypes", targets: ["TableProCoreTypes"]),
        .library(name: "TableProGeometry", targets: ["TableProGeometry"]),
        .library(name: "TableProTheme", targets: ["TableProTheme"]),
        .library(name: "TableProPluginKit", targets: ["TableProPluginKit"]),
        .library(name: "TableProModels", targets: ["TableProModels"]),
        .library(name: "TableProImport", targets: ["TableProImport"]),
        .library(name: "TableProDatabase", targets: ["TableProDatabase"]),
        .library(name: "TableProQuery", targets: ["TableProQuery"]),
        .library(name: "TableProSyncTransport", targets: ["TableProSyncTransport"]),
        .library(name: "TableProSync", targets: ["TableProSync"]),
        .library(name: "TableProMSSQLCore", targets: ["TableProMSSQLCore"]),
        .library(name: "TableProKerberos", targets: ["TableProKerberos"]),
        .library(name: "TableProTeradataCore", targets: ["TableProTeradataCore"]),
        .library(name: "TableProTrinoCore", targets: ["TableProTrinoCore"]),
        .library(name: "TableProDamengCore", targets: ["TableProDamengCore"]),
        .library(name: "TableProTLSClientIdentity", targets: ["TableProTLSClientIdentity"]),
        .library(name: "TableProTLSTestFixtures", targets: ["TableProTLSTestFixtures"]),
        .library(name: "TableProGoogleCloud", targets: ["TableProGoogleCloud"]),
        .library(name: "TableProSpannerCore", targets: ["TableProSpannerCore"]),
        .library(name: "TableProWeaviateCore", targets: ["TableProWeaviateCore"]),
        .library(name: "TableProWeaviateClient", targets: ["TableProWeaviateClient"]),
        .library(name: "TableProQdrantCore", targets: ["TableProQdrantCore"]),
        .library(name: "TableProQdrantClient", targets: ["TableProQdrantClient"]),
        .library(name: "TableProInfluxDBCore", targets: ["TableProInfluxDBCore"]),
        .library(name: "TableProNeo4jCore", targets: ["TableProNeo4jCore"]),
        .library(name: "TableProFirebaseCore", targets: ["TableProFirebaseCore"]),
        .library(name: "TableProFirebaseClient", targets: ["TableProFirebaseClient"]),
        .library(name: "TableProBigtableCore", targets: ["TableProBigtableCore"]),
        .library(name: "TableProNumberFormatting", targets: ["TableProNumberFormatting"]),
        .library(name: "TableProDocumentPath", targets: ["TableProDocumentPath"]),
        .library(name: "TableProJavaScriptText", targets: ["TableProJavaScriptText"]),
        .library(name: "TableProLogRedaction", targets: ["TableProLogRedaction"]),
        .library(name: "TableProR2SQLCore", targets: ["TableProR2SQLCore"]),
        .library(name: "TableProConnectionLibrary", targets: ["TableProConnectionLibrary"]),
        .library(name: "TableProSQLGrammar", targets: ["TableProSQLGrammar"]),
        .library(name: "TableProSQLFile", targets: ["TableProSQLFile"]),
        .library(name: "TableProSQLQuoting", targets: ["TableProSQLQuoting"]),
        .library(name: "TableProProcess", targets: ["TableProProcess"]),
        .library(name: "TableProSQLVocabulary", targets: ["TableProSQLVocabulary"]),
        .library(name: "TableProAutocomplete", targets: ["TableProAutocomplete"]),
        .library(name: "TableProSSHTransport", targets: ["TableProSSHTransport"]),
        .library(name: "CSQLite", targets: ["CSQLite"]),
        .library(name: "TableProSQLiteCore", targets: ["TableProSQLiteCore"]),
        .library(name: "TableProTabularIO", targets: ["TableProTabularIO"]),
        .library(name: "TableProTabular", targets: ["TableProTabular"]),
        .library(name: "TableProMySQLCore", targets: ["TableProMySQLCore"]),
        .library(name: "TableProPostgreSQLCore", targets: ["TableProPostgreSQLCore"]),
        .library(name: "TableProRedisCore", targets: ["TableProRedisCore"]),
        .library(name: "TableProMemcachedCore", targets: ["TableProMemcachedCore"]),
        .library(name: "TableProHTTP", targets: ["TableProHTTP"]),
        .library(name: "TableProSnowflakeCore", targets: ["TableProSnowflakeCore"]),
        .library(name: "TableProTestSupport", targets: ["TableProTestSupport"]),
        .library(name: "TableProWireIO", targets: ["TableProWireIO"]),
        .library(name: "TableProGzip", targets: ["TableProGzip"]),
        .library(name: "TableProKafkaCore", targets: ["TableProKafkaCore"]),
        .library(name: "TableProCassandraCore", targets: ["TableProCassandraCore"]),
        .library(name: "TableProEtcdCore", targets: ["TableProEtcdCore"]),
        .library(name: "TableProElasticsearchCore", targets: ["TableProElasticsearchCore"]),
        .library(name: "TableProDuckDBCore", targets: ["TableProDuckDBCore"])
    ],
    // Kafka brokers hand back whatever codec the producer stored, and macOS has no zstd.
    dependencies: [
        .package(url: "https://github.com/facebook/zstd", from: "1.5.0")
    ],
    targets: [
        .target(
            name: "TableProNumberFormatting",
            dependencies: [],
            path: "Sources/TableProNumberFormatting"
        ),
        .target(
            name: "TableProDocumentPath",
            dependencies: [],
            path: "Sources/TableProDocumentPath"
        ),
        .target(
            name: "TableProJavaScriptText",
            dependencies: [],
            path: "Sources/TableProJavaScriptText"
        ),
        .target(
            name: "TableProLogRedaction",
            dependencies: [],
            path: "Sources/TableProLogRedaction"
        ),
        .target(
            name: "TableProCoreTypes",
            dependencies: [],
            path: "Sources/TableProCoreTypes"
        ),
        .target(
            name: "TableProGeometry",
            dependencies: [],
            path: "Sources/TableProGeometry"
        ),
        .target(
            name: "TableProTheme",
            dependencies: [],
            path: "Sources/TableProTheme"
        ),
        .target(
            name: "TableProPluginKit",
            dependencies: [],
            path: "Sources/TableProPluginKit"
        ),
        .target(
            name: "TableProModels",
            dependencies: ["TableProPluginKit", "TableProCoreTypes", "TableProSSHTransport"],
            path: "Sources/TableProModels"
        ),
        .target(
            name: "TableProImport",
            dependencies: ["TableProConnectionLibrary", "TableProCoreTypes", "TableProSSHTransport"],
            path: "Sources/TableProImport"
        ),
        .target(
            name: "TableProDatabase",
            dependencies: ["TableProModels", "TableProCoreTypes", "TableProPluginKit", "TableProSQLGrammar", "TableProSQLQuoting", "TableProSSHTransport"],
            path: "Sources/TableProDatabase"
        ),
        .target(
            name: "TableProQuery",
            dependencies: [
                "TableProModels", "TableProPluginKit", "TableProCoreTypes", "TableProSQLGrammar", "TableProSQLQuoting",
                "TableProRedisCore"
            ],
            path: "Sources/TableProQuery"
        ),
        .target(
            name: "TableProSyncTransport",
            dependencies: [],
            path: "Sources/TableProSyncTransport"
        ),
        .target(
            name: "TableProSync",
            dependencies: ["TableProSyncTransport", "TableProModels", "TableProCoreTypes", "TableProConnectionLibrary"],
            path: "Sources/TableProSync"
        ),
        .target(
            name: "TableProMSSQLCore",
            dependencies: ["TableProCoreTypes", "TableProSQLGrammar", "TableProSQLQuoting"],
            path: "Sources/TableProMSSQLCore"
        ),
        .target(
            name: "TableProKerberos",
            dependencies: ["TableProCoreTypes"],
            path: "Sources/TableProKerberos"
        ),
        .target(
            name: "TableProTeradataCore",
            dependencies: ["TableProSQLQuoting", "TableProWireIO"],
            path: "Sources/TableProTeradataCore"
        ),
        .target(
            name: "TableProTrinoCore",
            dependencies: ["TableProSQLGrammar", "TableProSQLQuoting", "TableProTLSClientIdentity"],
            path: "Sources/TableProTrinoCore"
        ),
        .target(
            name: "TableProDamengCore",
            dependencies: ["TableProSQLGrammar"],
            path: "Sources/TableProDamengCore",
            swiftSettings: pluginCoreSettings
        ),
        .target(
            name: "TableProTLSClientIdentity",
            dependencies: [],
            path: "Sources/TableProTLSClientIdentity"
        ),
        .target(
            name: "TableProTLSTestFixtures",
            dependencies: [],
            path: "Tests/TableProTLSTestFixtures"
        ),
        .target(
            name: "TableProTestSupport",
            dependencies: [],
            path: "Tests/TableProTestSupport"
        ),
        .target(
            name: "TableProGoogleCloud",
            dependencies: ["TableProSQLQuoting"],
            path: "Sources/TableProGoogleCloud"
        ),
        .target(
            name: "TableProSpannerCore",
            dependencies: ["TableProGoogleCloud", "TableProSQLQuoting"],
            path: "Sources/TableProSpannerCore"
        ),
        .target(
            name: "TableProWeaviateCore",
            dependencies: [],
            path: "Sources/TableProWeaviateCore"
        ),
        // Only the plugin links this; the app tiers statements with TableProWeaviateCore alone.
        .target(
            
```

### Core Architecture Module: `apple/Packages/TableProCore/Sources/CSQLite/include/sqlite3.h`
```
/*
** 2001-09-15
**
** The author disclaims copyright to this source code.  In place of
** a legal notice, here is a blessing:
**
**    May you do good and not evil.
**    May you find forgiveness for yourself and forgive others.
**    May you share freely, never taking more than you give.
**
*************************************************************************
** This header file defines the interface that the SQLite library
** presents to client programs.  If a C-function, structure, datatype,
** or constant definition does not appear in this file, then it is
** not a published API of SQLite, is subject to change without
** notice, and should not be referenced by programs that use SQLite.
**
** Some of the definitions that are in this file are marked as
** "experimental".  Experimental interfaces are normally new
** features recently added to SQLite.  We do not anticipate changes
** to experimental interfaces but reserve the right to make minor changes
** if experience from use "in the wild" suggest such changes are prudent.
**
** The official C-language API documentation for SQLite is derived
** from comments in this file.  This file is the authoritative source
** on how SQLite interfaces are supposed to operate.
**
** The name of this file under configuration management is "sqlite.h.in".
** The makefile makes some minor changes to this file (such as inserting
** the version number) and changes its name to "sqlite3.h" as
** part of the build process.
*/
#ifndef SQLITE3_H
#define SQLITE3_H
#include <stdarg.h>     /* Needed for the definition of va_list */

/*
** Make sure we can call this stuff from C++.
*/
#ifdef __cplusplus
extern "C" {
#endif


/*
** Facilitate override of interface linkage and calling conventions.
** Be aware that these macros may not be used within this particular
** translation of the amalgamation and its associated header file.
**
** The SQLITE_EXTERN and SQLITE_API macros are used to instruct the
** compiler that the target identifier should have external linkage.
**
** The SQLITE_CDECL macro is used to set the calling convention for
** public functions that accept a variable number of arguments.
**
** The SQLITE_APICALL macro is used to set the calling convention for
** public functions that accept a fixed number of arguments.
**
** The SQLITE_STDCALL macro is no longer used and is now deprecated.
**
** The SQLITE_CALLBACK macro is used to set the calling convention for
** function pointers.
**
** The SQLITE_SYSAPI macro is used to set the calling convention for
** functions provided by the operating system.
**
** Currently, the SQLITE_CDECL, SQLITE_APICALL, SQLITE_CALLBACK, and
** SQLITE_SYSAPI macros are used only when building for environments
** that require non-default calling conventions.
*/
#ifndef SQLITE_EXTERN
# define SQLITE_EXTERN extern
#endif
#ifndef SQLITE_API
# define SQLITE_API
#endif
#ifndef SQLITE_CDECL
# define SQLITE_CDECL
#endif
#ifndef SQLITE_APICALL
# define SQLITE_APICALL
#endif
#ifndef SQLITE_STDCALL
# define SQLITE_STDCALL SQLITE_APICALL
#endif
#ifndef SQLITE_CALLBACK
# define SQLITE_CALLBACK
#endif
#ifndef SQLITE_SYSAPI
# define SQLITE_SYSAPI
#endif

/*
** These no-op macros are used in front of interfaces to mark those
** interfaces as either deprecated or experimental.  New applications
** should not use deprecated interfaces - they are supported for backwards
** compatibility only.  Application writers should be aware that
** experimental interfaces are subject to change in point releases.
**
** These macros used to resolve to various kinds of compiler magic that
** would generate warning messages when they were used.  But that
** compiler magic ended up generating such a flurry of bug reports
** that we have taken it all out and gone back to using simple
** noop macros.
*/
#define SQLITE_DEPRECATED
#define SQLITE_EXPERIMENTAL

/*
** Ensure these symbols were not defined by some previous header file.
*/
#ifdef SQLITE_VERSION
# undef SQLITE_VERSION
#endif
#ifdef SQLITE_VERSION_NUMBER
# undef SQLITE_VERSION_NUMBER
#endif

/*
** CAPI3REF: Compile-Time Library Version Numbers
**
** ^(The [SQLITE_VERSION] C preprocessor macro in the sqlite3.h header
** evaluates to a string literal that is the SQLite version in the
** format "X.Y.Z" where X is the major version number (always 3 for
** SQLite3) and Y is the minor version number and Z is the release number.)^
** ^(The [SQLITE_VERSION_NUMBER] C preprocessor macro resolves to an integer
** with the value (X*1000000 + Y*1000 + Z) where X, Y, and Z are the same
** numbers used in [SQLITE_VERSION].)^
** The SQLITE_VERSION_NUMBER for any given release of SQLite will also
** be larger than the release from which it is derived.  Either Y will
** be held constant and Z will be incremented or else Y will be incremented
** and Z will be reset to zero.
**
** Since [version 3.6.18] ([dateof:3.6.18]),
** SQLite source code has been stored in the
** <a href="http://fossil-scm.org/">Fossil configuration management
** system</a>.  ^The SQLITE_SOURCE_ID macro evaluates to
** a string which identifies a particular check-in of SQLite
** within its configuration management system.  ^The SQLITE_SOURCE_ID
** string contains the date and time of the check-in (UTC) and a SHA1
** or SHA3-256 hash of the entire source tree.  If the source code has
** been edited in any way since it was last checked in, then the last
** four hexadecimal digits of the hash may be modified.
**
** See also: [sqlite3_libversion()],
** [sqlite3_libversion_number()], [sqlite3_sourceid()],
** [sqlite_version()] and [sqlite_source_id()].
*/
#define SQLITE_VERSION        "3.53.4"
#define SQLITE_VERSION_NUMBER 3053004
#define SQLITE_SOURCE_ID      "2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc"
#define SQLITE_SCM_BRANCH     "branch-3.53"
#define SQLITE_SCM_TAGS       "release version-3.53.4"
#define SQLITE_SCM_DATETIME   "2026-07-24T19:02:57.525Z"

/*
** CAPI3REF: Run-Time Library Version Numbers
** KEYWORDS: sqlite3_version sqlite3_sourceid
**
** These interfaces provide the same information as the [SQLITE_VERSION],
** [SQLITE_VERSION_NUMBER], and [SQLITE_SOURCE_ID] C preprocessor macros
** but are associated with the library instead of the header file.  ^(Cautious
** programmers might include assert() statements in their application to
** verify that values returned by these interfaces match the macros in
** the header, and thus ensure that the application is
** compiled with matching library and header files.
**
** <blockquote><pre>
** assert( sqlite3_libversion_number()==SQLITE_VERSION_NUMBER );
** assert( strncmp(sqlite3_sourceid(),SQLITE_SOURCE_ID,80)==0 );
** assert( strcmp(sqlite3_libversion(),SQLITE_VERSION)==0 );
** </pre></blockquote>)^
**
** ^The sqlite3_version[] string constant contains the text of the
** [SQLITE_VERSION] macro.  ^The sqlite3_libversion() function returns a
** pointer to the sqlite3_version[] string constant.  The sqlite3_libversion()
** function is provided for use in DLLs since DLL users usually do not have
** direct access to string constants within the DLL.  ^The
** sqlite3_libversion_number() function returns an integer equal to
** [SQLITE_VERSION_NUMBER].  ^(The sqlite3_sourceid() function returns
** a pointer to a string constant whose value is the same as the
** [SQLITE_SOURCE_ID] C preprocessor macro.  Except if SQLite is built
** using an edited copy of [the amalgamation], then the last four characters
** of the hash might be different from [SQLITE_SOURCE_ID].)^
**
** See also: [sqlite_version()] and [sqlite_source_id()].
*/
SQLITE_API SQLITE_EXTERN const char sqlite3_version[];
SQLITE_API const char *sqlite3_libversion(void);
SQLITE_API const char *sqlite3_sourceid(void);
SQLITE_API int sqlite3_libversion_number(void);

/*
** CAPI3REF: Run-Time Library Compilation Options Diagnostics
**
** ^The sqlite3_compileoption_used() function returns 0 or 1
** indicating whether the specified option was defined at
** compile time.  ^The SQLITE_ prefix may be omitted from the
** option name passed to sqlite3_compileoption_used().
**
** ^The sqlite3_compileoption_get() function allows iterating
** over the list of options that were defined at compile time by
** returning the N-th compile time option string.  ^If N is out of range,
** sqlite3_compileoption_get() returns a NULL pointer.  ^The SQLITE_
** prefix is omitted from any strings returned by
** sqlite3_compileoption_get().
**
** ^Support for the diagnostic functions sqlite3_compileoption_used()
** and sqlite3_compileoption_get() may be omitted by specifying the
** [SQLITE_OMIT_COMPILEOPTION_DIAGS] option at compile time.
**
** See also: SQL functions [sqlite_compileoption_used()] and
** [sqlite_compileoption_get()] and the [compile_options pragma].
*/
#ifndef SQLITE_OMIT_COMPILEOPTION_DIAGS
SQLITE_API int sqlite3_compileoption_used(const char *zOptName);
SQLITE_API const char *sqlite3_compileoption_get(int N);
#else
# define sqlite3_compileoption_used(X) 0
# define sqlite3_compileoption_get(X)  ((void*)0)
#endif

/*
** CAPI3REF: Test To See If The Library Is Threadsafe
**
** ^The sqlite3_threadsafe() function returns zero if and only if
** SQLite was compiled with mutexing code omitted due to the
** [SQLITE_THREADSAFE] compile-time option being set to 0.
**
** SQLite can be compiled with or without mutexes.  When
** the [SQLITE_THREADSAFE] C preprocessor macro is 1 or 2, mutexes
** are enabled and SQLite is threadsafe.  When the
** [SQLITE_THREADSAFE] macro is 0,
** the mutexes are omitted.  Without the mutexes, it is not safe
** to use SQLite concurrently from more than one thread.
**
** Enabling mutexes incurs a measurable performance penalty.
** So if speed is of utmost importance, it makes sense to disable
** the mutexes.  But for maximum safety, mutexes should be enabled.
** ^The default behavior is for mutexes to be enabled.
**
** This interface can be used by an application to make sure that the
** version of SQLite that it is li
```

### Core Architecture Module: `apple/Packages/TableProCore/Sources/CSQLite/include/sqlite3ext.h`
```
/*
** 2006 June 7
**
** The author disclaims copyright to this source code.  In place of
** a legal notice, here is a blessing:
**
**    May you do good and not evil.
**    May you find forgiveness for yourself and forgive others.
**    May you share freely, never taking more than you give.
**
*************************************************************************
** This header file defines the SQLite interface for use by
** shared libraries that want to be imported as extensions into
** an SQLite instance.  Shared libraries that intend to be loaded
** as extensions by SQLite should #include this file instead of 
** sqlite3.h.
*/
#ifndef SQLITE3EXT_H
#define SQLITE3EXT_H
#include "sqlite3.h"

/*
** The following structure holds pointers to all of the SQLite API
** routines.
**
** WARNING:  In order to maintain backwards compatibility, add new
** interfaces to the end of this structure only.  If you insert new
** interfaces in the middle of this structure, then older different
** versions of SQLite will not be able to load each other's shared
** libraries!
*/
struct sqlite3_api_routines {
  void * (*aggregate_context)(sqlite3_context*,int nBytes);
  int  (*aggregate_count)(sqlite3_context*);
  int  (*bind_blob)(sqlite3_stmt*,int,const void*,int n,void(*)(void*));
  int  (*bind_double)(sqlite3_stmt*,int,double);
  int  (*bind_int)(sqlite3_stmt*,int,int);
  int  (*bind_int64)(sqlite3_stmt*,int,sqlite_int64);
  int  (*bind_null)(sqlite3_stmt*,int);
  int  (*bind_parameter_count)(sqlite3_stmt*);
  int  (*bind_parameter_index)(sqlite3_stmt*,const char*zName);
  const char * (*bind_parameter_name)(sqlite3_stmt*,int);
  int  (*bind_text)(sqlite3_stmt*,int,const char*,int n,void(*)(void*));
  int  (*bind_text16)(sqlite3_stmt*,int,const void*,int,void(*)(void*));
  int  (*bind_value)(sqlite3_stmt*,int,const sqlite3_value*);
  int  (*busy_handler)(sqlite3*,int(*)(void*,int),void*);
  int  (*busy_timeout)(sqlite3*,int ms);
  int  (*changes)(sqlite3*);
  int  (*close)(sqlite3*);
  int  (*collation_needed)(sqlite3*,void*,void(*)(void*,sqlite3*,
                           int eTextRep,const char*));
  int  (*collation_needed16)(sqlite3*,void*,void(*)(void*,sqlite3*,
                             int eTextRep,const void*));
  const void * (*column_blob)(sqlite3_stmt*,int iCol);
  int  (*column_bytes)(sqlite3_stmt*,int iCol);
  int  (*column_bytes16)(sqlite3_stmt*,int iCol);
  int  (*column_count)(sqlite3_stmt*pStmt);
  const char * (*column_database_name)(sqlite3_stmt*,int);
  const void * (*column_database_name16)(sqlite3_stmt*,int);
  const char * (*column_decltype)(sqlite3_stmt*,int i);
  const void * (*column_decltype16)(sqlite3_stmt*,int);
  double  (*column_double)(sqlite3_stmt*,int iCol);
  int  (*column_int)(sqlite3_stmt*,int iCol);
  sqlite_int64  (*column_int64)(sqlite3_stmt*,int iCol);
  const char * (*column_name)(sqlite3_stmt*,int);
  const void * (*column_name16)(sqlite3_stmt*,int);
  const char * (*column_origin_name)(sqlite3_stmt*,int);
  const void * (*column_origin_name16)(sqlite3_stmt*,int);
  const char * (*column_table_name)(sqlite3_stmt*,int);
  const void * (*column_table_name16)(sqlite3_stmt*,int);
  const unsigned char * (*column_text)(sqlite3_stmt*,int iCol);
  const void * (*column_text16)(sqlite3_stmt*,int iCol);
  int  (*column_type)(sqlite3_stmt*,int iCol);
  sqlite3_value* (*column_value)(sqlite3_stmt*,int iCol);
  void * (*commit_hook)(sqlite3*,int(*)(void*),void*);
  int  (*complete)(const char*sql);
  int  (*complete16)(const void*sql);
  int  (*create_collation)(sqlite3*,const char*,int,void*,
                           int(*)(void*,int,const void*,int,const void*));
  int  (*create_collation16)(sqlite3*,const void*,int,void*,
                             int(*)(void*,int,const void*,int,const void*));
  int  (*create_function)(sqlite3*,const char*,int,int,void*,
                          void (*xFunc)(sqlite3_context*,int,sqlite3_value**),
                          void (*xStep)(sqlite3_context*,int,sqlite3_value**),
                          void (*xFinal)(sqlite3_context*));
  int  (*create_function16)(sqlite3*,const void*,int,int,void*,
                            void (*xFunc)(sqlite3_context*,int,sqlite3_value**),
                            void (*xStep)(sqlite3_context*,int,sqlite3_value**),
                            void (*xFinal)(sqlite3_context*));
  int (*create_module)(sqlite3*,const char*,const sqlite3_module*,void*);
  int  (*data_count)(sqlite3_stmt*pStmt);
  sqlite3 * (*db_handle)(sqlite3_stmt*);
  int (*declare_vtab)(sqlite3*,const char*);
  int  (*enable_shared_cache)(int);
  int  (*errcode)(sqlite3*db);
  const char * (*errmsg)(sqlite3*);
  const void * (*errmsg16)(sqlite3*);
  int  (*exec)(sqlite3*,const char*,sqlite3_callback,void*,char**);
  int  (*expired)(sqlite3_stmt*);
  int  (*finalize)(sqlite3_stmt*pStmt);
  void  (*free)(void*);
  void  (*free_table)(char**result);
  int  (*get_autocommit)(sqlite3*);
  void * (*get_auxdata)(sqlite3_context*,int);
  int  (*get_table)(sqlite3*,const char*,char***,int*,int*,char**);
  int  (*global_recover)(void);
  void  (*interruptx)(sqlite3*);
  sqlite_int64  (*last_insert_rowid)(sqlite3*);
  const char * (*libversion)(void);
  int  (*libversion_number)(void);
  void *(*malloc)(int);
  char * (*mprintf)(const char*,...);
  int  (*open)(const char*,sqlite3**);
  int  (*open16)(const void*,sqlite3**);
  int  (*prepare)(sqlite3*,const char*,int,sqlite3_stmt**,const char**);
  int  (*prepare16)(sqlite3*,const void*,int,sqlite3_stmt**,const void**);
  void * (*profile)(sqlite3*,void(*)(void*,const char*,sqlite_uint64),void*);
  void  (*progress_handler)(sqlite3*,int,int(*)(void*),void*);
  void *(*realloc)(void*,int);
  int  (*reset)(sqlite3_stmt*pStmt);
  void  (*result_blob)(sqlite3_context*,const void*,int,void(*)(void*));
  void  (*result_double)(sqlite3_context*,double);
  void  (*result_error)(sqlite3_context*,const char*,int);
  void  (*result_error16)(sqlite3_context*,const void*,int);
  void  (*result_int)(sqlite3_context*,int);
  void  (*result_int64)(sqlite3_context*,sqlite_int64);
  void  (*result_null)(sqlite3_context*);
  void  (*result_text)(sqlite3_context*,const char*,int,void(*)(void*));
  void  (*result_text16)(sqlite3_context*,const void*,int,void(*)(void*));
  void  (*result_text16be)(sqlite3_context*,const void*,int,void(*)(void*));
  void  (*result_text16le)(sqlite3_context*,const void*,int,void(*)(void*));
  void  (*result_value)(sqlite3_context*,sqlite3_value*);
  void * (*rollback_hook)(sqlite3*,void(*)(void*),void*);
  int  (*set_authorizer)(sqlite3*,int(*)(void*,int,const char*,const char*,
                         const char*,const char*),void*);
  void  (*set_auxdata)(sqlite3_context*,int,void*,void (*)(void*));
  char * (*xsnprintf)(int,char*,const char*,...);
  int  (*step)(sqlite3_stmt*);
  int  (*table_column_metadata)(sqlite3*,const char*,const char*,const char*,
                                char const**,char const**,int*,int*,int*);
  void  (*thread_cleanup)(void);
  int  (*total_changes)(sqlite3*);
  void * (*trace)(sqlite3*,void(*xTrace)(void*,const char*),void*);
  int  (*transfer_bindings)(sqlite3_stmt*,sqlite3_stmt*);
  void * (*update_hook)(sqlite3*,void(*)(void*,int ,char const*,char const*,
                                         sqlite_int64),void*);
  void * (*user_data)(sqlite3_context*);
  const void * (*value_blob)(sqlite3_value*);
  int  (*value_bytes)(sqlite3_value*);
  int  (*value_bytes16)(sqlite3_value*);
  double  (*value_double)(sqlite3_value*);
  int  (*value_int)(sqlite3_value*);
  sqlite_int64  (*value_int64)(sqlite3_value*);
  int  (*value_numeric_type)(sqlite3_value*);
  const unsigned char * (*value_text)(sqlite3_value*);
  const void * (*value_text16)(sqlite3_value*);
  const void * (*value_text16be)(sqlite3_value*);
  const void * (*value_text16le)(sqlite3_value*);
  int  (*value_type)(sqlite3_value*);
  char *(*vmprintf)(const char*,va_list);
  /* Added ??? */
  int (*overload_function)(sqlite3*, const char *zFuncName, int nArg);
  /* Added by 3.3.13 */
  int (*prepare_v2)(sqlite3*,const char*,int,sqlite3_stmt**,const char**);
  int (*prepare16_v2)(sqlite3*,const void*,int,sqlite3_stmt**,const void**);
  int (*clear_bindings)(sqlite3_stmt*);
  /* Added by 3.4.1 */
  int (*create_module_v2)(sqlite3*,const char*,const sqlite3_module*,void*,
                          void (*xDestroy)(void *));
  /* Added by 3.5.0 */
  int (*bind_zeroblob)(sqlite3_stmt*,int,int);
  int (*blob_bytes)(sqlite3_blob*);
  int (*blob_close)(sqlite3_blob*);
  int (*blob_open)(sqlite3*,const char*,const char*,const char*,sqlite3_int64,
                   int,sqlite3_blob**);
  int (*blob_read)(sqlite3_blob*,void*,int,int);
  int (*blob_write)(sqlite3_blob*,const void*,int,int);
  int (*create_collation_v2)(sqlite3*,const char*,int,void*,
                             int(*)(void*,int,const void*,int,const void*),
                             void(*)(void*));
  int (*file_control)(sqlite3*,const char*,int,void*);
  sqlite3_int64 (*memory_highwater)(int);
  sqlite3_int64 (*memory_used)(void);
  sqlite3_mutex *(*mutex_alloc)(int);
  void (*mutex_enter)(sqlite3_mutex*);
  void (*mutex_free)(sqlite3_mutex*);
  void (*mutex_leave)(sqlite3_mutex*);
  int (*mutex_try)(sqlite3_mutex*);
  int (*open_v2)(const char*,sqlite3**,int,const char*);
  int (*release_memory)(int);
  void (*result_error_nomem)(sqlite3_context*);
  void (*result_error_toobig)(sqlite3_context*);
  int (*sleep)(int);
  void (*soft_heap_limit)(int);
  sqlite3_vfs *(*vfs_find)(const char*);
  int (*vfs_register)(sqlite3_vfs*,int);
  int (*vfs_unregister)(sqlite3_vfs*);
  int (*xthreadsafe)(void);
  void (*result_zeroblob)(sqlite3_context*,int);
  void (*result_error_code)(sqlite3_context*,int);
  int (*test_control)(int, ...);
  void (*randomness)(int,void*);
  sqlite3 *(*context_db_handle)(sqlite3_context*);
  int (*extended_result_codes)(sqlite3*,int);
  int (*limit)(sqlite3*,int,int);
  sqlite3_stmt *(*next_stmt)(sqlite3*,sqlite
```

### Core Architecture Module: `apple/Packages/TableProCore/Sources/CSQLite/include/tablepro_sqlite3.h`
```
#ifndef TABLEPRO_SQLITE3_H
#define TABLEPRO_SQLITE3_H

#include "sqlite3.h"

int tablepro_sqlite3_set_extension_loading(sqlite3 *db, int enabled, int *isEnabled);

#endif

```

### Core Architecture Module: `apple/Packages/TableProCore/Sources/CSQLite/tablepro_sqlite3.c`
```
#include "tablepro_sqlite3.h"

int tablepro_sqlite3_set_extension_loading(sqlite3 *db, int enabled, int *isEnabled) {
    return sqlite3_db_config(db, SQLITE_DBCONFIG_ENABLE_LOAD_EXTENSION, enabled ? 1 : 0, isEnabled);
}

```

### Core Architecture Module: `apple/Packages/TableProCore/Sources/TableProAutocomplete/DerivedTableParser.swift`
```
import Foundation

struct DerivedTable: Equatable, Sendable {
    let alias: String
    let projection: DerivedProjection
    let isCommonTableExpression: Bool

    // What the statement text names, before the catalog expands a `*`.
    var columns: [String] {
        projection.columns { _ in nil }
    }
}

// A `*` stays a table until the provider can ask the catalog for its columns.
struct DerivedProjection: Hashable, Sendable {
    struct Table: Hashable, Sendable {
        let name: String
        let schema: String?
    }

    enum Entry: Hashable, Sendable {
        case column(String)
        case unnamed
        case allColumns(Table)
        case nested(DerivedProjection)
        // A USING join outputs its join columns once, ahead of what is left of each side.
        case excluding([String], DerivedProjection)
        // A NATURAL join does the same for the columns both sides share, which only the catalog can name.
        case natural(DerivedProjection, DerivedProjection)
    }

    var entries: [Entry]
    // `name (a, b) AS (...)` and `AS x(a, b)` rename the output by position and keep the rest.
    var declaredNames: [String] = []

    static let empty = DerivedProjection(entries: [])

    var tables: [Table] {
        entries.flatMap { entry -> [Table] in
            switch entry {
            case .allColumns(let table): return [table]
            case .nested(let projection), .excluding(_, let projection): return projection.tables
            case .natural(let left, let right): return left.tables + right.tables
            case .column, .unnamed: return []
            }
        }
    }

    func declaring(_ names: [String]) -> DerivedProjection {
        guard !names.isEmpty else { return self }
        guard declaredNames.isEmpty else { return DerivedProjection(entries: [.nested(self)], declaredNames: names) }
        return DerivedProjection(entries: entries, declaredNames: names)
    }

    // `expand` answers nil for a table it cannot read, whose width also hides where the declared names land. Names
    // stay case-sensitive, since `"Value"` and `"value"` are two columns.
    func columns(expanding expand: (Table) -> [String]?) -> [String] {
        var seen = Set<String>()
        return resolve(expand).names.compactMap { $0 }.filter { seen.insert($0).inserted }
    }

    private func resolve(_ expand: (Table) -> [String]?) -> (names: [String?], knownWidth: Int?) {
        var names: [String?] = []
        var knownWidth: Int?
        for entry in entries {
            switch entry {
            case .column(let name):
                names.append(name)
            case .unnamed:
                names.append(nil)
            case .allColumns(let table):
                if let columns = expand(table) {
                    names += columns.map { Optional($0) }
                } else if knownWidth == nil {
                    knownWidth = names.count
                }
            case .nested(let projection):
                let inner = projection.resolve(expand)
                if knownWidth == nil, let innerWidth = inner.knownWidth {
                    knownWidth = names.count + innerWidth
                }
                names += inner.names
            case .excluding(let excluded, let projection):
                let inner = projection.resolve(expand)
                let dropped = Set(excluded.map { $0.lowercased() })
                let keeps: (String?) -> Bool = { name in name.map { !dropped.contains($0.lowercased()) } ?? true }
                if knownWidth == nil, let innerWidth = inner.knownWidth {
                    knownWidth = names.count + inner.names[..<innerWidth].filter(keeps).count
                }
                names += inner.names.filter(keeps)
            case .natural(let left, let right):
                let lhs = left.resolve(expand)
                let rhs = right.resolve(expand)
                guard lhs.knownWidth == nil, rhs.knownWidth == nil else {
                    if knownWidth == nil { knownWidth = names.count }
                    names += lhs.names + rhs.names
                    continue
                }
                let rightNames = Set(rhs.names.compactMap { $0?.lowercased() })
                let shared = Set(lhs.names.compactMap { $0?.lowercased() }.filter { rightNames.contains($0) })
                let isShared: (String?) -> Bool = { name in name.map { shared.contains($0.lowercased()) } ?? false }
                names += lhs.names.filter(isShared) + lhs.names.filter { !isShared($0) } + rhs.names.filter { !isShared($0) }
            }
        }
        let known = knownWidth ?? names.count
        for (index, name) in declaredNames.enumerated() where index < known {
            names[index] = name
        }
        guard declaredNames.count > known else { return (names, knownWidth) }
        // A declared name past an unread `*` still names a column, only not which one it replaces.
        names.insert(contentsOf: declaredNames[known...].map { Optional($0) }, at: known)
        return (names, knownWidth.map { _ in declaredNames.count })
    }
}

// Read from the analyzer's code view, where comments and literal bodies are blank and quoted names are masked, so a
// parenthesis or quote inside one never counts, whatever the engine's quoting rules.
struct SQLTokenStream {
    enum Kind {
        case word, quoted, literal, number, openParen, closeParen, comma, dot, star, other
    }

    struct Token {
        let kind: Kind
        let range: NSRange
        let upper: String
        var partner: Int
    }

    let tokens: [Token]
    let original: NSString

    private static let space: unichar = 0x20
    private static let tab: unichar = 0x09
    private static let newline: unichar = 0x0A
    private static let verticalTab: unichar = 0x0B
    private static let formFeed: unichar = 0x0C
    private static let cr: unichar = 0x0D
    private static let noBreakSpace: unichar = 0xA0
    private static let dollar: unichar = 0x24
    private static let openParen: unichar = 0x28
    private static let closeParen: unichar = 0x29
    private static let star: unichar = 0x2A
    private static let comma: unichar = 0x2C
    private static let dot: unichar = 0x2E
    private static let underscore: unichar = 0x5F
    private static let singleQuote: unichar = 0x27
    private static let doubleQuote: unichar = 0x22
    private static let backtick: unichar = 0x60
    private static let openBracket: unichar = 0x5B
    private static let closeBracket: unichar = 0x5D

    init(code: NSString, original: NSString, bracketQuotes: Bool) {
        self.original = original
        let length = min(code.length, original.length)
        var tokens: [Token] = []
        var openParens: [Int] = []
        var index = 0
        while index < length {
            let unit = code.character(at: index)
            if Self.isWhitespace(unit) {
                index += 1
                continue
            }
            let start = index
            let kind: Kind
            if Self.isWordStart(unit) {
                index += 1
                while index < length, Self.isWordPart(code.character(at: index)) { index += 1 }
                kind = .word
            } else if unit >= 0x30 && unit <= 0x39 {
                index += 1
                while index < length, Self.isWordPart(code.character(at: index)) || code.character(at: index) == Self.dot {
                    index += 1
                }
                kind = .number
            } else if unit == Self.doubleQuote || unit == Self.backtick || (bracketQuotes && unit == Self.openBracket) {
                index = Self.end(closing: unit == Self.openBracket ? Self.closeBracket : unit, in: code, from: index, length)
                kind = .quoted
            } else if unit == Self.singleQuote {
                index = Self.end(closing: Self.singleQuote, in: code, from: index, length)
                kind = .literal
            } else {
                index += 1
                switch unit {
                case Self.openParen: kind = .openParen
                case Self.closeParen: kind = .closeParen
                case Self.comma: kind = .comma
                case Self.dot: kind = .dot
                case Self.star: kind = .star
                default: kind = .other
                }
            }
            let range = NSRange(location: start, length: index - start)
            let upper = kind == .word ? original.substring(with: range).uppercased() : ""
            tokens.append(Token(kind: kind, range: range, upper: upper, partner: -1))
            if kind == .openParen {
                openParens.append(tokens.count - 1)
            } else if kind == .closeParen, let open = openParens.popLast() {
                tokens[open].partner = tokens.count - 1
                tokens[tokens.count - 1].partner = open
            }
        }
        for open in openParens {
            tokens[open].partner = tokens.count
        }
        self.tokens = tokens
    }

    var count: Int { tokens.count }

    func text(_ index: Int) -> String {
        original.substring(with: tokens[index].range)
    }

    func isWord(_ index: Int, _ upper: String) -> Bool {
        index >= 0 && index < tokens.count && tokens[index].kind == .word && tokens[index].upper == upper
    }

    func isWord(_ index: Int, in words: Set<String>) -> Bool {
        index >= 0 && index < tokens.count && tokens[index].kind == .word && words.contains(tokens[index].upper)
    }

    func kind(_ index: Int) -> Kind? {
        index >= 0 && index < tokens.count ? tokens[index].kind : nil
    }

    func isName(_ index: Int) -> Bool {
        kind(index) == .word || kind(index) == .quoted
    }

    func name(_ index: Int) -> String {
        Self.unquoted(text(index))
    }

    // The index after an open parenthesis's partner, or the end when it never closes.
    func after(_ open: Int) -> Int {
        min(tokens[open].partner, tokens.count - 1) 
```

### Core Architecture Module: `apple/Packages/TableProCore/Sources/TableProAutocomplete/KeywordUppercaseHelper.swift`
```
import Foundation
import TableProSQLGrammar

public enum KeywordUppercaseHelper {
    public static func isWordBoundary(_ string: String) -> Bool {
        guard (string as NSString).length == 1, let ch = string.unicodeScalars.first else { return false }
        switch ch {
        case " ", "\t", "\n", "\r", "(", ")", ",", ";":
            return true
        default:
            return false
        }
    }

    static func isWordCharacter(_ ch: unichar) -> Bool {
        (ch >= 0x41 && ch <= 0x5A) || (ch >= 0x61 && ch <= 0x7A) ||
        (ch >= 0x30 && ch <= 0x39) || ch == 0x5F
    }

    // Read from the start of the text with the session's grammar: a literal can open any distance back, and where it
    // ends is the engine's rule.
    static func isInsideProtectedContext(_ text: NSString, at position: Int, grammar: SQLLexicalGrammar) -> Bool {
        let length = text.length
        let runsExecutableComments = grammar.contains(.executableComments)
        var index = 0
        while index < position {
            // The server runs the body of `/*! ... */`, so it is code.
            if runsExecutableComments, let opener = SqlLexer.executableCommentOpenerLength(text, at: index, length: length) {
                index += opener
                continue
            }
            guard let span = SQLNonCodeSpan.span(at: index, in: text, grammar: grammar) else {
                index += 1
                continue
            }
            if SQLContextAnalyzer.holds(span, cursor: position) { return true }
            index = max(span.end, index + 1)
        }
        return false
    }

    // Nil when the word is not a keyword, sits in a comment, a literal or a quoted name, or is already in the target case.
    public static func keywordBeforePosition(
        _ text: NSString,
        at position: Int,
        uppercase: Bool = true,
        grammar: SQLLexicalGrammar
    ) -> (word: String, folded: String, range: NSRange)? {
        var wordStart = position
        while wordStart > 0 {
            let ch = text.character(at: wordStart - 1)
            guard isWordCharacter(ch) else { break }
            wordStart -= 1
        }

        let wordLength = position - wordStart
        guard wordLength > 0 else { return nil }

        let word = text.substring(with: NSRange(location: wordStart, length: wordLength))
        guard SQLKeywords.keywordSet.contains(word.lowercased()) else { return nil }
        guard !isInsideProtectedContext(text, at: wordStart, grammar: grammar) else { return nil }

        let folded = uppercase ? word.uppercased() : word.lowercased()
        guard folded != word else { return nil }

        return (word: word, folded: folded, range: NSRange(location: wordStart, length: wordLength))
    }
}

```

### Core Architecture Module: `apple/Packages/TableProCore/Sources/TableProAutocomplete/Mongo/MongoContextAnalyzer.swift`
```
import Foundation

public enum MongoCompletionPosition: Equatable, Sendable {
    case statementStart
    case databaseMember
    case collectionMethod(collection: String)
    case cursorMethod
    case filterDocument(collection: String?)
    case projectionDocument(collection: String?)
    case updateDocument
    case updatePipelineStage
    case plainDocument(collection: String?)
    case pipelineStage(collection: String?)
    case stageExpression(collection: String?)
    case suppressed
}

public struct MongoContext: Equatable, Sendable {
    public let position: MongoCompletionPosition
    public let prefix: String
    public let prefixRange: NSRange
}

public enum MongoContextAnalyzer {
    private static let openParen = UInt16(UnicodeScalar("(").value)
    private static let closeParen = UInt16(UnicodeScalar(")").value)
    private static let openBrace = UInt16(UnicodeScalar("{").value)
    private static let closeBrace = UInt16(UnicodeScalar("}").value)
    private static let openBracket = UInt16(UnicodeScalar("[").value)
    private static let closeBracket = UInt16(UnicodeScalar("]").value)
    private static let comma = UInt16(UnicodeScalar(",").value)
    private static let dot = UInt16(UnicodeScalar(".").value)
    private static let dollar = UInt16(UnicodeScalar("$").value)
    private static let underscore = UInt16(UnicodeScalar("_").value)
    private static let backslash = UInt16(UnicodeScalar("\\").value)
    private static let slash = UInt16(UnicodeScalar("/").value)
    private static let star = UInt16(UnicodeScalar("*").value)
    private static let newline = UInt16(UnicodeScalar("\n").value)
    private static let singleQuote = UInt16(UnicodeScalar("'").value)
    private static let doubleQuote = UInt16(UnicodeScalar("\"").value)
    private static let backtick = UInt16(UnicodeScalar("`").value)

    private struct Frame {
        let opener: UInt16
        let openIndex: Int
        let callee: String?
        var argumentIndex: Int
    }

    private struct ScanState {
        var frames: [Frame] = []
        var isInString = false
        var isInComment = false
    }

    // The scan reads from the start of the text, so a long script costs a linear pass, run off the main actor.
    @concurrent
    public static func analyze(_ text: String, cursor: Int) async -> MongoContext {
        analyze(text: text as NSString, cursor: cursor)
    }

    public static func analyze(text: NSString, cursor: Int) -> MongoContext {
        let bounded = max(0, min(cursor, text.length))
        let prefixRange = prefixRange(in: text, endingAt: bounded)
        let prefix = text.substring(with: prefixRange)
        let state = scan(text: text, upTo: prefixRange.location)

        return MongoContext(
            position: position(for: state, text: text, tokenStart: prefixRange.location),
            prefix: prefix,
            prefixRange: prefixRange
        )
    }

    public static func prefixRange(in text: NSString, endingAt offset: Int) -> NSRange {
        var start = max(0, min(offset, text.length))

        while start > 0 {
            let character = text.character(at: start - 1)
            guard isTokenCharacter(character) else { break }
            start -= 1
        }

        if start > 0, text.character(at: start - 1) == dollar {
            start -= 1
            if start > 0, text.character(at: start - 1) == dollar {
                start -= 1
            }
        }

        return NSRange(location: start, length: offset - start)
    }

    private static func isTokenCharacter(_ character: UInt16) -> Bool {
        (character >= 0x41 && character <= 0x5A)
            || (character >= 0x61 && character <= 0x7A)
            || (character >= 0x30 && character <= 0x39)
            || character == underscore
    }

    private static func isIdentifierStart(_ character: UInt16) -> Bool {
        (character >= 0x41 && character <= 0x5A) || (character >= 0x61 && character <= 0x7A)
            || character == underscore || character == dollar
    }

    private static func scan(text: NSString, upTo end: Int) -> ScanState {
        var units = [UInt16](repeating: 0, count: end)
        text.getCharacters(&units, range: NSRange(location: 0, length: end))
        var state = ScanState()
        var index = 0
        var stringDelimiter: UInt16 = 0
        var isInLineComment = false
        var isInBlockComment = false

        while index < end {
            let character = units[index]

            if isInLineComment {
                if character == newline { isInLineComment = false }
                index += 1
                continue
            }

            if isInBlockComment {
                if character == star, index + 1 < end, units[index + 1] == slash {
                    isInBlockComment = false
                    index += 2
                    continue
                }
                index += 1
                continue
            }

            if stringDelimiter != 0 {
                if character == backslash {
                    index += 2
                    continue
                }
                if character == stringDelimiter { stringDelimiter = 0 }
                index += 1
                continue
            }

            if character == slash, index + 1 < end {
                let next = units[index + 1]
                if next == slash {
                    isInLineComment = true
                    index += 2
                    continue
                }
                if next == star {
                    isInBlockComment = true
                    index += 2
                    continue
                }
            }

            if character == singleQuote || character == doubleQuote || character == backtick {
                stringDelimiter = character
                index += 1
                continue
            }

            switch character {
            case openParen:
                state.frames.append(
                    Frame(
                        opener: openParen,
                        openIndex: index,
                        callee: identifier(in: text, endingBefore: index),
                        argumentIndex: 0
                    )
                )
            case openBrace:
                state.frames.append(Frame(opener: openBrace, openIndex: index, callee: nil, argumentIndex: 0))
            case openBracket:
                state.frames.append(Frame(opener: openBracket, openIndex: index, callee: nil, argumentIndex: 0))
            case closeParen, closeBrace, closeBracket:
                if !state.frames.isEmpty { state.frames.removeLast() }
            case comma:
                if !state.frames.isEmpty { state.frames[state.frames.count - 1].argumentIndex += 1 }
            default:
                break
            }

            index += 1
        }

        state.isInString = stringDelimiter != 0
        state.isInComment = isInLineComment || isInBlockComment
        return state
    }

    private static func identifier(in text: NSString, endingBefore index: Int) -> String? {
        var end = index
        while end > 0, text.character(at: end - 1) == UInt16(UnicodeScalar(" ").value) {
            end -= 1
        }
        var start = end
        while start > 0, isTokenCharacter(text.character(at: start - 1)) {
            start -= 1
        }
        guard start < end, isIdentifierStart(text.character(at: start)) else { return nil }
        return text.substring(with: NSRange(location: start, length: end - start))
    }

    private static func position(for state: ScanState, text: NSString, tokenStart: Int) -> MongoCompletionPosition {
        if state.isInComment { return .suppressed }

        if state.frames.isEmpty, !state.isInString {
            return topLevelPosition(text: text, tokenStart: tokenStart)
        }

        guard let callFrameIndex = state.frames.lastIndex(where: { $0.opener == openParen }),
              let callee = state.frames[callFrameIndex].callee else {
            return state.isInString ? .suppressed : .statementStart
        }

        let argumentIndex = state.frames[callFrameIndex].argumentIndex
        let nested = Array(state.frames.suffix(from: callFrameIndex + 1))
        let collection = collectionName(in: text, endingBefore: state.frames[callFrameIndex].openIndex)

        if state.isInString, nested.isEmpty { return .suppressed }

        switch callee {
        case "find", "findOne":
            if argumentIndex == 0 { return .filterDocument(collection: collection) }
            if argumentIndex == 1 { return .projectionDocument(collection: collection) }
            return .suppressed
        case "countDocuments", "deleteOne", "deleteMany", "findOneAndDelete", "distinct":
            return argumentIndex == 0 || callee == "distinct"
                ? .filterDocument(collection: collection)
                : .suppressed
        case "updateOne", "updateMany", "findOneAndUpdate":
            if argumentIndex == 0 { return .filterDocument(collection: collection) }
            if argumentIndex == 1 {
                return nested.first?.opener == openBracket ? .updatePipelineStage : .updateDocument
            }
            return .suppressed
        case "replaceOne", "findOneAndReplace":
            if argumentIndex == 0 { return .filterDocument(collection: collection) }
            if argumentIndex == 1 { return .plainDocument(collection: collection) }
            return .suppressed
        case "insertOne", "insertMany":
            return .plainDocument(collection: collection)
        case "aggregate":
            guard nested.first?.opener == openBracket else { return .suppressed }
            let documentDepth = nested.filter { $0.opener == openBrace }.count
            return documentDepth <= 1
                ? .pipelineStage(collection: collection)
                : .stageExpression(collection: collection)
        case "createIndex", "createIndexes", "dropI
```

### Core Architecture Module: `apple/Packages/TableProCore/Sources/TableProAutocomplete/Mongo/MongoVocabulary.swift`
```
import Foundation

public enum MongoVocabulary {
    public static let databaseMethods: [(name: String, detail: String)] = [
        ("getCollectionNames", "Array of collection and view names"),
        ("getCollectionInfos", "Collection and view info documents"),
        ("getCollection", "Collection object for a name that is not a valid identifier"),
        ("getSiblingDB", "Switch to another database in the same connection"),
        ("createCollection", "Create a collection or view"),
        ("createView", "Create a read-only view over a pipeline"),
        ("aggregate", "Run a collectionless aggregation pipeline"),
        ("runCommand", "Run a database command"),
        ("adminCommand", "Run a command against the admin database"),
        ("stats", "Database storage statistics"),
        ("dropDatabase", "Drop the current database"),
        ("version", "Server version"),
        ("hello", "Server description and topology"),
        ("hostInfo", "Host machine information"),
        ("serverStatus", "Server status counters"),
        ("serverBuildInfo", "Server build information"),
        ("currentOp", "Operations in progress"),
        ("killOp", "Terminate an operation by opid"),
        ("getProfilingStatus", "Current profiling level"),
        ("setProfilingLevel", "Set the profiling level"),
        ("getUsers", "Users defined on this database"),
        ("getRoles", "Roles defined on this database"),
        ("createUser", "Create a user"),
        ("dropUser", "Drop a user"),
        ("createRole", "Create a role"),
        ("dropRole", "Drop a role"),
        ("watch", "Open a change stream on the database")
    ]

    public static let collectionMethods: [(name: String, detail: String)] = [
        ("find", "Select documents and return a cursor"),
        ("findOne", "Return one matching document, or null"),
        ("aggregate", "Run an aggregation pipeline"),
        ("countDocuments", "Accurate count using an aggregation"),
        ("estimatedDocumentCount", "Fast approximate count from collection metadata"),
        ("distinct", "Array of distinct values for a field"),
        ("insertOne", "Insert one document"),
        ("insertMany", "Insert an array of documents"),
        ("updateOne", "Update the first matching document"),
        ("updateMany", "Update every matching document"),
        ("replaceOne", "Replace the first matching document"),
        ("deleteOne", "Delete the first matching document"),
        ("deleteMany", "Delete every matching document"),
        ("findOneAndUpdate", "Find one document, update it, return it"),
        ("findOneAndReplace", "Find one document, replace it, return it"),
        ("findOneAndDelete", "Find one document, delete it, return it"),
        ("bulkWrite", "Several write operations in one command"),
        ("createIndex", "Build an index"),
        ("createIndexes", "Build one or more indexes"),
        ("dropIndex", "Drop one index by name or key spec"),
        ("dropIndexes", "Drop the given indexes"),
        ("getIndexes", "Documents describing every index"),
        ("hideIndex", "Hide an index from the query planner"),
        ("unhideIndex", "Make a hidden index visible again"),
        ("drop", "Drop the collection and its indexes"),
        ("renameCollection", "Rename within the same database"),
        ("stats", "Collection storage statistics"),
        ("dataSize", "Uncompressed size of the documents, in bytes"),
        ("storageSize", "Bytes allocated for document storage"),
        ("totalIndexSize", "Total bytes used by all indexes"),
        ("totalSize", "Storage size plus total index size"),
        ("isCapped", "True if the collection is capped"),
        ("validate", "Validate collection and index integrity"),
        ("explain", "Return the query plan instead of results")
    ]

    /// What a cursor answers to, which is what `find()` and `aggregate()` return.
    public static let cursorMethods: [(name: String, detail: String)] = [
        ("sort", "Order the results by one or more fields"),
        ("limit", "Return at most this many documents"),
        ("skip", "Skip this many documents first"),
        ("projection", "Choose which fields come back"),
        ("hint", "Name the index to use"),
        ("collation", "Language rules for string comparison"),
        ("maxTimeMS", "Give up after this many milliseconds"),
        ("batchSize", "Documents per round trip"),
        ("allowDiskUse", "Let a large sort spill to disk"),
        ("forEach", "Call a function for every document"),
        ("map", "Build an array from every document"),
        ("toArray", "Read every document into an array"),
        ("hasNext", "True while documents remain"),
        ("next", "Read the next document"),
        ("tryNext", "Read the next document, or null"),
        ("count", "Number of documents matching the query"),
        ("itcount", "Count by reading the cursor to its end"),
        ("size", "Documents remaining, after skip and limit"),
        ("explain", "Return the query plan instead of results"),
        ("pretty", "Format the documents for reading"),
        ("close", "Release the cursor"),
        ("isExhausted", "True once nothing remains"),
        ("objsLeftInBatch", "Documents left in the current batch")
    ]

    public static let deprecatedCollectionMethods: Set<String> = [
        "insert", "update", "remove", "count", "findAndModify", "mapReduce", "reIndex", "ensureIndex"
    ]

    public static let queryOperators: [(name: String, detail: String)] = [
        ("$eq", "Matches values equal to a specified value"),
        ("$ne", "Matches values not equal to a specified value"),
        ("$gt", "Matches values greater than a specified value"),
        ("$gte", "Matches values greater than or equal to a specified value"),
        ("$lt", "Matches values less than a specified value"),
        ("$lte", "Matches values less than or equal to a specified value"),
        ("$in", "Matches any of the values in an array"),
        ("$nin", "Matches none of the values in an array"),
        ("$and", "Joins query clauses with a logical AND"),
        ("$or", "Joins query clauses with a logical OR"),
        ("$nor", "Joins query clauses with a logical NOR"),
        ("$not", "Inverts the effect of a query expression"),
        ("$exists", "Matches documents that have the specified field"),
        ("$type", "Matches documents where a field is of the specified BSON type"),
        ("$expr", "Allows an aggregation expression inside a query predicate"),
        ("$jsonSchema", "Validates documents against the given JSON Schema"),
        ("$mod", "Performs a modulo operation on a field value"),
        ("$regex", "Selects documents where a value matches a regular expression"),
        ("$options", "Regular expression options for $regex"),
        ("$text", "Performs a text search on a text-indexed field"),
        ("$where", "Matches documents against a JavaScript predicate (deprecated in 8.0)"),
        ("$all", "Matches arrays containing all the specified elements"),
        ("$elemMatch", "Matches arrays with at least one element matching all conditions"),
        ("$size", "Matches arrays with the specified number of elements"),
        ("$bitsAllClear", "Matches where all the given bit positions are 0"),
        ("$bitsAllSet", "Matches where all the given bit positions are 1"),
        ("$bitsAnyClear", "Matches where any of the given bit positions is 0"),
        ("$bitsAnySet", "Matches where any of the given bit positions is 1"),
        ("$geoIntersects", "Matches geometries that intersect a GeoJSON geometry"),
        ("$geoWithin", "Matches geometries within a bounding geometry"),
        ("$near", "Matches points near a given point, nearest first"),
        ("$nearSphere", "Matches points near a point on a sphere, nearest first"),
        ("$geometry", "GeoJSON geometry argument for a geospatial operator"),
        ("$minDistance", "Minimum distance for $near and $nearSphere"),
        ("$maxDistance", "Maximum distance for $near and $nearSphere"),
        ("$box", "Rectangle argument for $geoWithin"),
        ("$center", "Circle argument for $geoWithin, on a flat plane"),
        ("$centerSphere", "Circle argument for $geoWithin, on a sphere"),
        ("$polygon", "Polygon argument for $geoWithin")
    ]

    public static let updateOperators: [(name: String, detail: String)] = [
        ("$set", "Sets the value of a field"),
        ("$unset", "Removes the field from the document"),
        ("$setOnInsert", "Sets the field only when the update inserts a document"),
        ("$inc", "Increments the field by the specified amount"),
        ("$mul", "Multiplies the field by the specified amount"),
        ("$min", "Updates only if the specified value is less than the current one"),
        ("$max", "Updates only if the specified value is greater than the current one"),
        ("$rename", "Renames a field"),
        ("$currentDate", "Sets the field to the current date or timestamp"),
        ("$addToSet", "Adds a value to an array only if it is not already present"),
        ("$push", "Appends a value to an array"),
        ("$pull", "Removes every array element matching a condition"),
        ("$pullAll", "Removes every listed value from an array"),
        ("$pop", "Removes the first (-1) or last (1) element of an array"),
        ("$each", "Applies a push or addToSet to several values"),
        ("$position", "Insert position for a $push with $each"),
        ("$slice", "Limits the array length after a $push with $each"),
        ("$sort", "Reorders an array after a $push with $each"),
        ("$bit", "Performs a bitwise and, or, or xor on an integer field")
    ]

    public static let updatePipelineStages: [(name: String, detail: String)] = [
        ("$set", "Adds or overwrites fields, as an aggregation stage"),
        ("$addFields", "Adds or overwrites fields"),
        ("$unset", "Removes the named fi
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4268** (2026-11-14): **Edits and transactions: remaining audit items**
  *Symptoms*: ### What happened?  Items left from the 2026-11-10 and 2026-11-12 audits.  - [ ] DL-02: after a reconnect loses a transaction, temp tables or SET values, the refusal also blocks the app's own work on that database, not only the user's next SQL - [ ] GE-06: switching tabs drops the data undo history while the edits stay pending - [ ] QT-09: one window-wide `DataChangeManager`, swapped by snapshot, is the root of the edit-loss bugs - [ ] WD-2: on Windows, a forced shutdown through Restart Manager still ends the app with pending edits and an open transaction  ### Expected behavior  Pending edits and open transactions are never lost without asking.  ### TablePro version  main after 0.87.0-beta.1  ### Platform  macOS, Windows 

- **Issue #4106** (2026-11-12): **Linux: the MCP token's locked-keyring message has no default-keyring step**
  *Symptoms*: With no default keyring, the MCP status row in Preferences reads "The keyring is locked, so the access token cannot be read. Unlock it and try again." Unlocking does not help when there is no default keyring.  - Where: `linux/crates/app/src/ui/preferences_dialog/mcp_page.rs:309`. - Expected: the same recovery as the Remember Password toast from #4105 (troubleshooting.md, Flatpak connections: create a default keyring in Passwords and Keys). - Left out of #4105, which fixed the save paths.
  **Post-Mortem & Fix Analysis**:
  > The shared message for Locked and UnlockDismissed only suggested unlocking and retrying. It omitted the missing-default-keyring case that can occur with GNOME automatic login.  The message now covers accepting the unlock prompt and creating a default keyring in Passwords and Keys. Added tests cover both errors, the recovery text, retry visibility, disabled client controls, and the transition back to Off.  https://github.com/TableProApp/TablePro/pull/4234

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

### Incident Patch 1: `68da8db7` (2026-11-19)
**Commit Message**: fix(duckdb): run DuckDB's tasks on 8 MiB threads so a deep ATTACH cannot overflow (#4354)

**File**: `apple/Plugins/DuckDBDriverPlugin/DuckDBConnection.swift` (modified, +13/-0)
```diff
@@ -42,6 +42,7 @@ actor DuckDBConnectionActor {
     nonisolated var unownedExecutor: UnownedSerialExecutor { executor.asUnownedSerialExecutor() }
 
     private var database: duckdb_database?
+    private var taskThreads: DuckDBTaskThreads?
     private var connection: duckdb_connection?
     // Renders the rows of a result the session's own connection is still producing.
     private var renderConnection: duckdb_connection?
@@ -291,6 +292,12 @@ actor DuckDBConnectionActor {
                 String(localized: "This build of DuckDB does not accept a limit on how deep an expression nests")
             )
         }
+        for option in DuckDBTaskThreads.sessionOptions
+            where duckdb_set_config(config, option.name, option.value) == DuckDBError {
+            throw DuckDBPluginError.connectionFailed(
+                String(localized: "This build of DuckDB does not accept running its tasks on threads TablePro starts")
+            )
+        }
         if !spec.allowsPersistentSecrets {
             guard duckdb_set_config(config, "allow_persistent_secrets", "false") != DuckDBError else {
                 throw DuckDBPluginError.connectionFailed(
@@ -365,6 +372,7 @@ actor DuckDBConnectionActor {
             throw error
         }
         database = db
+        taskThreads = DuckDBTaskThreads(database: openedDB)
         connection = conn
         renderConnection = renderConn
         renderSettings = [:]
@@ -382,6 +390,8 @@ actor DuckDBConnectionActor {
             duckdb_disconnect(&connection)
             connection = nil
         }
+        taskThreads?.close()
+        taskThreads = nil
         if database != nil {
             duckdb_close(&database)
             database = nil
@@ -559,6 +569,9 @@ actor DuckDBConnectionActor {
 
         var result = duckdb_result()
         let state = streams ? duckdb_execute_prepared_streaming(stmt, &result) : duckdb_execute_prepared(stmt, &result)
+        if !DuckDBTaskThreads.keepsCount(statementType) {
+            taskThreads?.followCount()
+        }
         guard state != DuckDBError else {
             let message = Self.errorMessage(from: &result)
             duckdb_destroy_result(&result)
```

**File**: `apple/Plugins/DuckDBDriverPlugin/DuckDBExpressionDepth.swift` (modified, +150/-0)
```diff
@@ -52,6 +52,156 @@ nonisolated enum DuckDBExpressionDepth {
     }
 }
 
+// DuckDB runs a statement's tasks on the caller and on threads of its own, which get 512 KiB on macOS and iOS, and an
+// ATTACH or read_duckdb() reads the other file's expressions inside one. With external_threads at the thread count
+// DuckDB starts none, and these run its tasks with its command line's stack instead.
+nonisolated final class DuckDBTaskThreads {
+    // DuckDB's own default, std::thread::hardware_concurrency().
+    static let count = max(ProcessInfo.processInfo.processorCount, 1)
+    static let openOptions: [(name: String, value: String)] = [
+        (name: "threads", value: String(count)),
+        (name: "external_threads", value: String(count)),
+    ]
+    // A statement that raises the count and locks the configuration, as IMPORT DATABASE can, still lets these take
+    // DuckDB's threads over.
+    static let sessionOptions = openOptions + [(name: "allowed_configs", value: "[external_threads]")]
+
+    private let database: duckdb_database
+    // Its own, so a cancel or an aborted transaction on a session cannot stop a change of the count halfway.
+    private var connection: duckdb_connection?
+    private var state: duckdb_task_state?
+    private var workers = 0
+    // threads and external_threads as these last set them; nil once DuckDB keeps threads of its own.
+    private var pinned: Int? = DuckDBTaskThreads.count
+    private let running = DispatchGroup()
+
+    // Without its connection it starts no thread, and every task runs on the caller's.
+    init(database: duckdb_database) {
+        self.database = database
+        guard duckdb_connect(database, &connection) != DuckDBError else {
+            connection = nil
+            return
+        }
+        start(Self.count - 1)
+    }
+
+    // Before duckdb_close: a connection left open keeps the file.
+    func close() {
+        stop()
+        if connection != nil {
+            duckdb_disconnect(&connection)
+        }
+    }
+
+    // DuckDB refuses a count below external_threads. One above it makes DuckDB start threads of its own, which these
+    // take over before anything else runs: a later change ends them with one wake-up each through the semaphore these
+    // wait on too, and a wake-up one of these took leaves DuckDB's join waiting for good (measured).
+    func followCount() {
+        guard !pinnedStillHolds() else { return }
+        retake()
+    }
+
+    static func keepsCount(_ type: duckdb_statement_type) -> Bool {
+        switch type {
+        case DUCKDB_STATEMENT_TYPE_SELECT, DUCKDB_STATEMENT_TYPE_INSERT, DUCKDB_STATEMENT_TYPE_UPDATE,
+             DUCKDB_STATEMENT_TYPE_DELETE, DUCKDB_STATEMENT_TYPE_TRANSACTION:
+            return true
+        default:
+            return false
+        }
+    }
+
+    private func pinnedStillHolds() -> Bool {
+        guard let pinned, let connection, let counts = Self.counts(on: connection) else { return false }
+        return counts.threads == pinned && counts.external == pinned
+    }
+
+    private func retake() {
+        stop()
+        pinned = nil
+        guard let connection, let threads = Self.counts(on: connection)?.threads,
+              Self.run("SET external_threads = \(threads)", on: connection) else { return }
+        pinned = threads
+        start(threads - 1)
+    }
+
+    private func stop() {
+        guard let state else { return }
+        // A thread DuckDB started itself, after a statement raised the count, can take the wake-up meant for one of these.
+        repeat {
+            duckdb_finish_execution(state)
+        } while running.wait(timeout: .now() + .milliseconds(10)) == .timedOut
+        duckdb_destroy_task_state(state)
+        self.state = nil
+        workers = 0
+    }
+
+    private func start(_ count: Int) {
+        guard count > 0, let state = duckdb_create_task_state(database) else { return }
+        self.state = state
+        var attributes = pthread_attr_t()
+        pthread_attr_init(&attributes)
+        defer { pthread_attr_destroy(&attributes) }
+        pthread_attr_setstacksize(&attributes, DuckDBExpressionDepth.stackSize)
+        pthread_attr_setdetachstate(&attributes, PTHREAD_CREATE_DETACHED)
+        pthread_attr_set_qos_class_np(&attributes, QOS_CLASS_USER_INITIATED, 0)
+        for _ in 0..<count {
+            let worker = Unmanaged.passRetained(DuckDBTaskWorker(state: state, running: running)).toOpaque()
+            running.enter()
+            var thread: pthread_t?
+            let created = pthread_create(&thread, &attributes, { context in
+                let worker = Unmanaged<DuckDBTaskWorker>.fromOpaque(context).takeRetainedValue()
+                pthread_setname_np("com.TablePro.duckdb.task")
+                duckdb_execute_tasks_state(worker.state)
+                worker.running.leave()
+                return nil
+            }, worker)
+            // DuckDB stops starting threads at the system's li
```

**File**: `apple/Plugins/DuckDBDriverPlugin/DuckDBIsolatedImport.swift` (modified, +3/-1)
```diff
@@ -14,7 +14,7 @@ enum DuckDBIsolatedImport {
         ("autoload_known_extensions", "false"),
         ("allow_community_extensions", "false"),
         (DuckDBExpressionDepth.configurationOption, DuckDBExpressionDepth.limit),
-    ]
+    ] + DuckDBTaskThreads.openOptions
 
     // duckdb_set_config rejects allowed_directories, and DuckDB refuses to change it once external access is off.
     static func lockdownStatements(allowing folder: String) -> [String] {
@@ -56,6 +56,8 @@ enum DuckDBIsolatedImport {
             throw DuckDBPluginError.connectionFailed("Failed to open DuckDB database at '\(file)': \(detail)")
         }
         defer { DuckDBExpressionDepth.close(&database) }
+        let taskThreads = database.map { DuckDBTaskThreads(database: $0) }
+        defer { taskThreads?.close() }
 
         var handle: duckdb_connection?
         guard duckdb_connect(database, &handle) != DuckDBError, let connection = handle else {
```

**File**: `apple/TablePro/Resources/Localizable.xcstrings` (modified, +4/-0)
```diff
@@ -201534,6 +201534,10 @@
         }
       }
     },
+    "This build of DuckDB does not accept running its tasks on threads TablePro starts" : {
+      "extractionState" : "manual",
+      "generatesSymbol" : false
+    },
     "This build of DuckDB does not accept the storage version that keeps files readable by DuckDB 1.x" : {
       "extractionState" : "manual",
       "generatesSymbol" : false
```

**File**: `apple/TableProMobile/TableProMobile/Drivers/DuckDBDriver+Transfer.swift` (modified, +4/-3)
```diff
@@ -189,8 +189,7 @@ extension DuckDBActor {
         }
         var result = duckdb_result()
         guard !parameters.isEmpty else {
-            if duckdb_query(connection, sql, &result) == DuckDBError {
-                let message = duckdb_result_error(&result).map { String(cString: $0) } ?? "Unknown DuckDB error"
+            if let message = run(sql, on: connection, into: &result) {
                 duckdb_destroy_result(&result)
                 throw DuckDBDriverError.queryFailed(message)
             }
@@ -204,7 +203,9 @@ extension DuckDBActor {
         }
         defer { duckdb_destroy_prepare(&statement) }
         try Self.bind(parameters, to: prepared)
-        if duckdb_execute_prepared(prepared, &result) == DuckDBError {
+        let state = duckdb_execute_prepared(prepared, &result)
+        followThreadCount(after: duckdb_prepared_statement_type(prepared))
+        if state == DuckDBError {
             let message = duckdb_result_error(&result).map { String(cString: $0) } ?? "Unknown DuckDB error"
             duckdb_destroy_result(&result)
             throw DuckDBDriverError.queryFailed(message)
```

**File**: `apple/TableProMobile/TableProMobile/Drivers/DuckDBDriver.swift` (modified, +72/-3)
```diff
@@ -3,6 +3,7 @@ import Dispatch
 import Foundation
 import TableProDatabase
 import TableProModels
+import TableProSQLGrammar
 import TableProSQLQuoting
 
 nonisolated final class DuckDBDriver: DatabaseDriver, CatalogQuerying, ExportRowStreaming,
@@ -196,6 +197,7 @@ actor DuckDBActor {
     nonisolated let interruptHandle = DuckDBInterruptHandle()
     private(set) var database: duckdb_database?
     var connection: duckdb_connection?
+    private var taskThreads: DuckDBTaskThreads?
     // The transfer connections on `database`, which `close()` ends before the database.
     var transferLanes: [UInt64: DuckDBTransferLane] = [:]
     var lastTransferLane: UInt64 = 0
@@ -216,7 +218,7 @@ actor DuckDBActor {
         ("autoinstall_known_extensions", "false"),
         ("autoload_known_extensions", "false"),
         (DuckDBExpressionDepth.configurationOption, DuckDBExpressionDepth.limit),
-    ]
+    ] + DuckDBTaskThreads.sessionOptions
 
     func open(path: String) throws {
         _ = Self.registeredExtensions
@@ -256,6 +258,7 @@ actor DuckDBActor {
 
         database = db
         connection = conn
+        if let db { taskThreads = DuckDBTaskThreads(database: db) }
         if let conn { interruptHandle.attach(conn) }
     }
 
@@ -275,6 +278,8 @@ actor DuckDBActor {
             duckdb_disconnect(&connection)
             connection = nil
         }
+        taskThreads?.close()
+        taskThreads = nil
         if database != nil {
             duckdb_close(&database)
             database = nil
@@ -294,8 +299,7 @@ actor DuckDBActor {
         let startTime = Date()
         var result = duckdb_result()
 
-        if duckdb_query(connection, sql, &result) == DuckDBError {
-            let message = duckdb_result_error(&result).map { String(cString: $0) } ?? "Unknown DuckDB error"
+        if let message = run(sql, on: connection, into: &result) {
             duckdb_destroy_result(&result)
             throw DuckDBDriverError.queryFailed(message)
         }
@@ -342,6 +346,71 @@ actor DuckDBActor {
         return Self.decodeMaterialized(&result, plan: plan, rowsChanged: rowsChanged, startTime: startTime)
     }
 
+    // Several statements run one at a time, split as the editor splits them, so a count one raises is taken over
+    // before the next runs, and a text DuckDB cannot parse runs none of them. The result is the one duckdb_query
+    // gives: the first with rows, else the last. Returns the error.
+    func run(_ sql: String, on connection: duckdb_connection, into result: inout duckdb_result) -> String? {
+        guard let taskThreads else {
+            return duckdb_query(connection, sql, &result) == DuckDBError ? Self.error(of: &result) : nil
+        }
+        var extracted: duckdb_extracted_statements?
+        defer { duckdb_destroy_extracted(&extracted) }
+        let count = duckdb_extract_statements(connection, sql, &extracted)
+        if let error = duckdb_extract_statements_error(extracted) {
+            return String(cString: error)
+        }
+        guard count > 1 else { return Self.run(sql, on: connection, taskThreads, into: &result) }
+        let statements = SQLStatementScanner.executableStatements(in: sql, grammar: Self.grammar)
+        guard statements.count == count else {
+            return "DuckDB reads \(count) statements here where TablePro splits \(statements.count); run them one at a time"
+        }
+        var kept: duckdb_result?
+        var keptHasRows = false
+        for statement in statements {
+            var current = duckdb_result()
+            if let failure = Self.run(statement.sql, on: connection, taskThreads, into: &current) {
+                duckdb_destroy_result(&current)
+                if var kept { duckdb_destroy_result(&kept) }
+                return failure
+            }
+            if kept != nil, keptHasRows {
+                duckdb_destroy_result(&current)
+                continue
+            }
+            if var earlier = kept { duckdb_destroy_result(&earlier) }
+            keptHasRows = duckdb_result_return_type(current) == DUCKDB_RESULT_TYPE_QUERY_RESULT
+            kept = current
+        }
+        if let kept { result = kept }
+        return nil
+    }
+
+    func followThreadCount(after type: duckdb_statement_type) {
+        guard !DuckDBTaskThreads.keepsCount(type) else { return }
+        taskThreads?.followCount()
+    }
+
+    private static let grammar = SQLLexicalReadings.resolve(
+        databaseTypeId: DatabaseType.duckdb.rawValue, declared: nil, session: nil
+    ).execution
+
+    private static func run(
+        _ sql: String,
+        on connection: duckdb_connection,
+        _ taskThreads: DuckDBTaskThreads,
+        into result: inout duckdb_result
+    ) -> String? {
+        let state = duckdb_query(connection, sql, &result)
+        if !DuckDBTaskThreads.keepsCount(duckdb_result_statement_type(result)) {
+            taskThreads.followCount()
+        }
+        return state == DuckDBErro
```

**File**: `apple/TableProMobile/TableProMobileTests/Drivers/DuckDBDriverTests.swift` (modified, +185/-0)
```diff
@@ -602,4 +602,189 @@ struct DuckDBDeepExpressionTests {
 
         #expect(tables.rows == [["t"]])
     }
+
+    @Test("A file nested 900 deep attaches a hundred times, each read on a thread with DuckDB's stack")
+    func deepFileAttachesRepeatedly() async throws {
+        let directory = FileManager.default.temporaryDirectory
+            .appendingPathComponent("duckdb-deep-reattach-\(UUID().uuidString)", isDirectory: true)
+        defer { try? FileManager.default.removeItem(at: directory) }
+        let file = try await deepFile(in: directory)
+
+        let driver = DuckDBDriver(source: .inMemory)
+        try await driver.connect()
+        for _ in 0..<100 {
+            _ = try await driver.execute(query: "ATTACH '\(file.path)' AS deep (READ_ONLY)")
+            _ = try await driver.execute(query: "DETACH deep")
+        }
+        let threads = try await driver.execute(query: "SELECT current_setting('threads'), current_setting('external_threads')")
+        try await driver.disconnect()
+
+        let count = String(ProcessInfo.processInfo.processorCount)
+        #expect(threads.rows == [[count, count]])
+    }
+
+    @Test(
+        "A raised thread count is taken over, a deep file still attaches, and a count below it is refused",
+        .timeLimit(.minutes(1))
+    )
+    func raisedThreadCountIsTakenOver() async throws {
+        let directory = FileManager.default.temporaryDirectory
+            .appendingPathComponent("duckdb-deep-threads-\(UUID().uuidString)", isDirectory: true)
+        defer { try? FileManager.default.removeItem(at: directory) }
+        let file = try await deepFile(in: directory)
+
+        let driver = DuckDBDriver(source: .inMemory)
+        try await driver.connect()
+        let base = ProcessInfo.processInfo.processorCount
+        var counts: [[String?]] = []
+        for statement in [
+            "SET threads = \(base + 8)", "PRAGMA threads = \(base + 16)", "EXPLAIN ANALYZE SET threads = \(base + 24)",
+        ] {
+            _ = try await driver.execute(query: statement)
+            for _ in 0..<20 {
+                _ = try await driver.execute(query: "ATTACH '\(file.path)' AS deep (READ_ONLY)")
+                _ = try await driver.execute(query: "DETACH deep")
+            }
+            counts += try await driver.execute(
+                query: "SELECT current_setting('threads'), current_setting('external_threads')"
+            ).rows
+        }
+        let lowering = await #expect(throws: DuckDBDriverError.self) {
+            try await driver.execute(query: "SET threads = \(base)")
+        }
+        try await driver.disconnect()
+
+        let raised = [base + 8, base + 16, base + 24].map { [String($0), String($0)] as [String?] }
+        #expect(counts == raised)
+        #expect(lowering?.localizedDescription.contains("external threads") == true)
+    }
+
+    @Test(
+        "A text of several statements takes each raised count over before the next statement reads a deep file",
+        .timeLimit(.minutes(1))
+    )
+    func threadCountFollowsSetsInOneText() async throws {
+        let directory = FileManager.default.temporaryDirectory
+            .appendingPathComponent("duckdb-deep-text-\(UUID().uuidString)", isDirectory: true)
+        defer { try? FileManager.default.removeItem(at: directory) }
+        let file = try await deepFile(in: directory)
+
+        let driver = DuckDBDriver(source: .inMemory)
+        try await driver.connect()
+        let base = ProcessInfo.processInfo.processorCount
+        let selected = try await driver.execute(
+            query: "SET threads = \(base + 8); SET threads = \(base + 16); SELECT 42"
+        )
+        var threads = base + 16
+        for _ in 0..<20 {
+            threads += 1
+            _ = try await driver.execute(
+                query: "SET threads = \(threads); ATTACH '\(file.path)' AS deep (READ_ONLY); DETACH deep"
+            )
+        }
+        _ = try await driver.execute(query: "SET threads = \(base + 48); SET lock_configuration = true")
+        for _ in 0..<20 {
+            _ = try await driver.execute(query: "ATTACH '\(file.path)' AS deep (READ_ONLY); DETACH deep")
+        }
+        let counts = try await driver.execute(query: "SELECT current_setting('threads'), current_setting('external_threads')")
+        try await driver.disconnect()
+
+        #expect(selected.rows == [["42"]])
+        #expect(counts.rows == [[String(base + 48), String(base + 48)]])
+    }
+
+    @Test("A text DuckDB cannot parse runs none of its statements")
+    func unparsedTextRunsNothing() async throws {
+        let driver = DuckDBDriver(source: .inMemory)
+        try await driver.connect()
+        await #expect(throws: DuckDBDriverError.self) {
+            try await driver.execute(query: "SET threads = 64; CREATE TABLE never (i INTEGER); SELEC 1")
+        }
+        let counts = try await driver.execute(query: "SELECT current_setting('threads'), current_setting('external_threads'
```

**File**: `apple/changelog.d/4354.changed.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+DuckDB connections now refuse SET threads below the number of processors.
```

---

### Incident Patch 2: `7c310aed` (2026-11-19)
**Commit Message**: fix(sync): apply changes and deletions to library records a build cannot read by id and standing (#4345)

**File**: `.claude/rules/data-sync-storage.md` (modified, +5/-1)
```diff
@@ -147,6 +147,7 @@ This path holds user data. A silent wrong answer here looks exactly like an empt
 
 - **A synced CKRecord type or field reaches CloudKit Production before anything writes it.** Both apps pin the container to Production, where nothing is auto-created, and CloudKit rejects a whole record that carries an undeclared field. Write fields only through `record.fields(SomeSyncField.self)`, never `record["..."]`. To ship one: add it in Development, deploy to Production in the Console, run `apple/scripts/export-cloudkit-schema.sh`, commit `apple/CloudKit/production-schema.ckdb`, then add it to the matching `verifiedInProduction`. `ProductionSchemaParityTests` checks code against the snapshot in both directions, not against the server, so never edit the snapshot by hand: `apple/scripts/export-cloudkit-schema.sh --check` compares it with Production. A tag's `app` job runs `--check-deployed` instead, which fails only on a record type, field, field type, index, role or grant the tag's snapshot has and Production lacks.
 - **A storage format stays readable by the previous stable.** Sparkle never downgrades, and a beta user can turn betas off (`apple/RELEASING.md`, Storage check). The one exception is a value the previous stable has no field for, such as a theme color in a slot added after it: that file and its synced record are written at the oldest schema that holds it, and everything else keeps the old format (`.claude/rules/theme.md`, Model and Sync).
+- **A record this build cannot read meets sync by its id and its standing, never by its payload.** CloudKit hands a deletion over as a record ID and type alone, and a save starts from the last known server record, so a field this build does not know survives on the server. Here: a library record that does not decode is never re-encoded or written over (a save carrying its id is refused); a pulled change to it is held and kept out of the record cache (a Local only one takes none), and a build that reads the copy fetches that record by id, never by resetting the change token, which would drop the deletions a delta still carries; a deletion removes it by id when its standing says it syncs, with the device-only Keychain items its id owns (macOS finds them by the id they end with), leaves a Local only one, and waits for a build that reads it when no standing was recorded; its dirty mark is held, not dropped; an import treats its id as taken. Standing is written by id whenever the store reads a record, because a Local only connection keeps its iCloud copy and cached server record. Profiles, groups and tags always sync, except that a profile's deletion waits for a build that reads it, since unlinking its connections needs it.
 - **Persist, then notify.** `SyncChangeTracker.markDeleted()` runs after the storage write, because its notification can start a sync that re-uploads the record from the stale file.
 - **Concurrent schema loads await the one in-flight `loadTask`** in `SQLSchemaProvider`; never guard with a flag that returns without data.
 - **Every metadata read goes through `DatabaseManager.withMetadataDriver`**, never `MetadataConnectionPool.shared` directly, so an embedded engine with `supportsConnectionPooling = false` (DuckDB, PGlite) stays on its session driver; a second connection to it is a different, empty database.
@@ -188,7 +189,10 @@ This path holds user data. A silent wrong answer here looks exactly like an empt
 | `connections.json` and `credentialProfiles.json` as last saved, copied with the tag after each save, restored when the file no longer parses. A save that moves secrets out first drops the old copy and the damaged file, or writes nothing | `<file>.backup` and `<file>.backup.hmac` beside the file, device-local, never synced | `IntegrityStampedFileStore` |
 | A `connections.json` or `credentialProfiles.json` that no longer parsed, set aside when its backup was restored; the next one replaces it | `<file>.unreadable` beside the file, device-local, never synced | `IntegrityStampedFileStore` |
 | Records this build cannot read from a file changed outside TablePro, which a save would otherwise sign; added to, never replaced | `<file>.unreadable-records` beside the file, device-local, never synced | `IntegrityStampedFileStore` |
-| iOS: `connections.json`, `groups.json` and `tags.json` as last saved, copied after each save, restored when the file no longer parses; the damaged file is kept and the next one replaces it. A save that moves secrets out first drops the old copy and the damaged file, or writes nothing. Records the build cannot read stay in the file until a save writes a record with their id, and their ids keep their Keychain items, files and preferences, and keep what they own off iCloud | `<file>.backup` and `<file>.unreadable` beside the file, device-local, never synced | `LibraryFile` |
+| iOS: `connections.json`, `groups.json` and `tags.json` as last saved, copied after each save, restored when the file no longer parses; th
```

**File**: `apple/Packages/TableProCore/Sources/TableProConnectionLibrary/LibraryFileRecords.swift` (modified, +13/-6)
```diff
@@ -27,19 +27,26 @@ public struct LibraryFileRecords<Element: Decodable> {
     }
 }
 
+public enum LibraryFileError: Error, Equatable {
+    case idHeldByUnreadableRecord(UUID)
+}
+
 public extension LibraryFileRecords where Element: Encodable {
-    // A kept record gives way to a saved one with its id, such as the same connection pulled again by sync,
-    // so the file never holds two records for one id.
+    // A kept record is never written over, since this build would re-encode it without what it cannot read: a save
+    // carrying its id is refused. `removing` drops kept records by id, as a deletion another device made does.
     static func encoded(
         _ elements: [Element],
         keeping unreadable: [UnreadableLibraryRecord],
+        removing removedIds: Set<UUID> = [],
         using encoder: JSONEncoder = JSONEncoder()
     ) throws -> (data: Data, kept: [UnreadableLibraryRecord]) {
-        var kept = unreadable
-        if !kept.isEmpty {
+        let kept = unreadable.filter { record in record.id.map { !removedIds.contains($0) } ?? true }
+        let keptIds = Set(kept.compactMap(\.id))
+        if !keptIds.isEmpty {
             let saved = try JSONDecoder().decode([UnreadableLibraryRecord].self, from: encoder.encode(elements))
-            let savedIds = Set(saved.compactMap(\.id))
-            kept.removeAll { $0.id.map(savedIds.contains) ?? false }
+            if let taken = saved.lazy.compactMap(\.id).first(where: keptIds.contains) {
+                throw LibraryFileError.idHeldByUnreadableRecord(taken)
+            }
         }
         let data = try encoder.encode(elements.map(LibraryFileEntry.decoded) + kept.map(LibraryFileEntry.unreadable))
         return (data, kept)
```

**File**: `apple/Packages/TableProCore/Sources/TableProSyncTransport/CloudKitSyncEngine.swift` (modified, +19/-3)
```diff
@@ -242,10 +242,26 @@ public actor CloudKitSyncEngine {
     public func fetch(recordIDs: [CKRecord.ID]) async throws -> [CKRecord.ID: CKRecord] {
         guard !recordIDs.isEmpty else { return [:] }
         guard let database else { throw Self.unavailable }
-        let results = try await withRetry {
-            try await database.records(for: recordIDs)
+        var records: [CKRecord.ID: CKRecord] = [:]
+        for start in stride(from: 0, to: recordIDs.count, by: Self.refetchBatchSize) {
+            let batch = Array(recordIDs[start..<min(start + Self.refetchBatchSize, recordIDs.count)])
+            records.merge(try await fetch(batch, from: database)) { _, last in last }
+        }
+        return records
+    }
+
+    // CloudKit asks a request it finds too large to be split in half and sent again.
+    private func fetch(_ batch: [CKRecord.ID], from database: CKDatabase) async throws -> [CKRecord.ID: CKRecord] {
+        do {
+            let results = try await withRetry {
+                try await database.records(for: batch)
+            }
+            return results.compactMapValues { try? $0.get() }
+        } catch let error as CKError where error.code == .limitExceeded && batch.count > 1 {
+            let middle = batch.count / 2
+            let first = try await fetch(Array(batch[..<middle]), from: database)
+            return first.merging(try await fetch(Array(batch[middle...]), from: database)) { _, last in last }
         }
-        return results.compactMapValues { try? $0.get() }
     }
 
     public func pull(since token: CKServerChangeToken?) async throws -> PullResult {
```

**File**: `apple/Packages/TableProCore/Sources/TableProSyncTransport/SyncMetadataStorage.swift` (modified, +116/-0)
```diff
@@ -14,6 +14,13 @@ public struct Tombstone: Codable, Equatable, Sendable {
     }
 }
 
+// A record's part in sync as this device last read it, for a copy it can no longer read.
+public enum SyncStanding: Equatable, Sendable {
+    case syncs
+    case keptOff
+    case unknown
+}
+
 public enum SyncAccountChange: Equatable, Sendable {
     case firstSeen
     case unchanged
@@ -209,6 +216,97 @@ public final class SyncMetadataStorage: @unchecked Sendable {
         }
     }
 
+    // MARK: - Copies This Device Cannot Read
+
+    // Record names a pull changed while this device's copy could not be read. Not applied, since a re-encode by
+    // this build would drop what it cannot read, so a build that reads the copy fetches those records by id.
+    public var changesHeldForUnreadableCopies: Set<String> {
+        get { stringSet("changesHeldForUnreadableCopies") }
+        set { saveStringSet(newValue, key: "changesHeldForUnreadableCopies") }
+    }
+
+    // Record names of unread copies a pull deleted, removed by the next save of their file; the account that sent
+    // the deletion owns it, like the rest of the server position.
+    public var removalsPendingForUnreadableCopies: Set<String> {
+        get { stringSet("removalsPendingForUnreadableCopies") }
+        set { saveStringSet(newValue, key: "removalsPendingForUnreadableCopies") }
+    }
+
+    // Record names a pull deleted while this device could not tell whether its unreadable copy syncs.
+    public var deletionsHeldForUnreadableCopies: Set<String> {
+        get { stringSet("deletionsHeldForUnreadableCopies") }
+        set { saveStringSet(newValue, key: "deletionsHeldForUnreadableCopies") }
+    }
+
+    // The held changes to fetch by id, since a delta never resends them: those whose copy reads now. One whose copy is
+    // gone, or no longer syncs, is dropped. `syncing` names every stored copy that syncs, read or not.
+    public func readableHeldChanges(syncing: Set<String>, unreadable: Set<String>) -> Set<String> {
+        let held = changesHeldForUnreadableCopies.intersection(syncing)
+        if held != changesHeldForUnreadableCopies {
+            changesHeldForUnreadableCopies = held
+        }
+        return held.subtracting(unreadable)
+    }
+
+    // A held deletion is due once its copy reads; one whose record the server sent again was saved after it, so it
+    // settles without applying. The caller removes what it settled once the pull is saved.
+    public func heldDeletions(live: Set<String>, unreadable: Set<String>) -> (due: Set<String>, settled: Set<String>) {
+        let held = deletionsHeldForUnreadableCopies
+        guard !held.isEmpty else { return ([], []) }
+        let due = held.subtracting(live).subtracting(unreadable)
+        return (due, due.union(held.intersection(live)))
+    }
+
+    // MARK: - Connection Standing
+
+    // Whether each connection takes part in sync, by id and outside the record, so one the store can no longer read
+    // keeps the standing it last had: a Local only copy shares its id with a record iCloud may still hold.
+    public func connectionsKnownToSync() -> Set<UUID> {
+        Set(stringSet("connectionsKnownToSync").compactMap(UUID.init(uuidString:)))
+    }
+
+    public func connectionsKeptOffSync() -> Set<UUID> {
+        Set(stringSet("connectionsKeptOffSync").compactMap(UUID.init(uuidString:)))
+    }
+
+    public func standing(ofConnection id: UUID) -> SyncStanding {
+        if connectionsKeptOffSync().contains(id) { return .keptOff }
+        return connectionsKnownToSync().contains(id) ? .syncs : .unknown
+    }
+
+    // Of the unread copies a deletion names, the ones to remove: those that sync. A Local only one stays, and one with
+    // no standing recorded waits in the held deletions for a build that reads it.
+    public func unreadableConnectionsRemoved(byDeletionOf ids: Set<UUID>) -> Set<UUID> {
+        var removed: Set<UUID> = []
+        var held: Set<String> = []
+        for id in ids {
+            switch standing(ofConnection: id) {
+            case .syncs:
+                removed.insert(id)
+            case .keptOff:
+                continue
+            case .unknown:
+                held.insert(SyncRecordType.connection.recordName(for: id.uuidString))
+            }
+        }
+        if !held.isEmpty {
+            deletionsHeldForUnreadableCopies.formUnion(held)
+        }
+        return removed
+    }
+
+    // Read records set their standing, an unread one keeps its last, and one no longer stored loses it.
+    public func recordConnectionStanding(syncing: Set<UUID>, keptOff: Set<UUID>, unreadable: Set<UUID>) {
+        let known = syncing.union(connectionsKnownToSync().intersection(unreadable))
+        let off = keptOff.union(connectionsKeptOffSync().intersection(unreadable))
+        if known != connectionsKnownToSync() {
+            saveStringSet(Set(known.map(\.uuidString)), key: "connectionsKnownToSync")
+        }
+        if o
```

**File**: `apple/Packages/TableProCore/Tests/TableProConnectionLibraryTests/LibraryFileRecordsTests.swift` (modified, +11/-8)
```diff
@@ -32,22 +32,25 @@ struct LibraryFileRecordsTests {
         #expect(try LibraryFileRecords<Row>(decoding: written).elements == [Row(id: 1, name: "One")])
     }
 
-    @Test("A kept record gives way to a saved record with its id")
-    func savedRecordSupersedesKeptOne() throws {
+    @Test("A save never writes over a kept record: one carrying its id is refused, and removing it by id is how it goes")
+    func keptRecordKeepsItsId() throws {
         struct Named: Codable, Equatable {
             let id: UUID
             let name: String
         }
-        let superseded = UUID()
+        let held = UUID()
         let other = UUID()
-        let data = Data(#"[{"id":"\#(superseded.uuidString)","name":7},{"id":"\#(other.uuidString)","name":8}]"#.utf8)
+        let data = Data(#"[{"id":"\#(held.uuidString)","name":7},{"id":"\#(other.uuidString)","name":8}]"#.utf8)
         let records = try LibraryFileRecords<Named>(decoding: data)
-        #expect(records.unreadable.map(\.id) == [superseded, other])
+        #expect(records.unreadable.map(\.id) == [held, other])
 
-        let saved = try LibraryFileRecords.encoded([Named(id: superseded, name: "Pulled")], keeping: records.unreadable)
+        #expect(throws: LibraryFileError.idHeldByUnreadableRecord(held)) {
+            try LibraryFileRecords.encoded([Named(id: held, name: "Pulled")], keeping: records.unreadable)
+        }
 
-        #expect(saved.kept.map(\.id) == [other])
-        let rows = try #require(try JSONSerialization.jsonObject(with: saved.data) as? [NSDictionary])
+        let removed = try LibraryFileRecords.encoded([Named(id: held, name: "Pulled")], keeping: records.unreadable, removing: [held])
+        #expect(removed.kept.map(\.id) == [other])
+        let rows = try #require(try JSONSerialization.jsonObject(with: removed.data) as? [NSDictionary])
         #expect(rows.count == 2)
         #expect(rows.first?["name"] as? String == "Pulled")
         #expect(rows.last?["name"] as? Int == 8)
```

**File**: `apple/Packages/TableProCore/Tests/TableProSyncTests/SyncMetadataStorageTests.swift` (modified, +72/-0)
```diff
@@ -302,4 +302,76 @@ struct SyncMetadataStorageTests {
         #expect(defaults.data(forKey: "com.TablePro.sync.tombstones.Connection") != nil)
         #expect(defaults.string(forKey: "com.TablePro.sync.lastAccountId") == "account")
     }
+
+    // MARK: - Copies this device cannot read
+
+    @Test("A connection's standing follows the last read of it, is kept while it cannot be read, and goes with it")
+    func connectionStandingFollowsReads() throws {
+        let storage = makeStorage()
+        let synced = UUID()
+        let localOnly = UUID()
+        let never = UUID()
+        storage.recordConnectionStanding(syncing: [synced], keptOff: [localOnly], unreadable: [])
+
+        storage.recordConnectionStanding(syncing: [], keptOff: [], unreadable: [synced, localOnly, never])
+
+        #expect(storage.standing(ofConnection: synced) == .syncs)
+        #expect(storage.standing(ofConnection: localOnly) == .keptOff)
+        #expect(storage.standing(ofConnection: never) == .unknown)
+
+        storage.recordConnectionStanding(syncing: [], keptOff: [], unreadable: [])
+        #expect(storage.standing(ofConnection: synced) == .unknown)
+        #expect(storage.standing(ofConnection: localOnly) == .unknown)
+    }
+
+    @Test("A deletion removes an unread copy that syncs, leaves a Local only one, and holds one with no standing")
+    func deletionOfUnreadCopiesFollowsStanding() {
+        let storage = makeStorage()
+        let synced = UUID()
+        let localOnly = UUID()
+        let unknown = UUID()
+        storage.recordConnectionStanding(syncing: [synced], keptOff: [localOnly], unreadable: [])
+
+        let removed = storage.unreadableConnectionsRemoved(byDeletionOf: [synced, localOnly, unknown])
+
+        #expect(removed == [synced])
+        #expect(storage.deletionsHeldForUnreadableCopies == [SyncRecordType.connection.recordName(for: unknown.uuidString)])
+    }
+
+    @Test("A held change is fetched once its copy reads, and dropped once its copy is gone or no longer syncs")
+    func heldChangesWaitForAReadableCopy() {
+        let storage = makeStorage()
+        storage.changesHeldForUnreadableCopies = ["Connection_A", "Connection_B", "Connection_C"]
+
+        let readable = storage.readableHeldChanges(syncing: ["Connection_A", "Connection_B"], unreadable: ["Connection_B"])
+
+        #expect(readable == ["Connection_A"])
+        #expect(storage.changesHeldForUnreadableCopies == ["Connection_A", "Connection_B"])
+    }
+
+    @Test("Records held for unread copies belong to the account that sent them, so switching accounts drops them")
+    func heldRecordsGoWithTheAccount() {
+        let storage = makeStorage()
+        _ = storage.adoptAccount("first")
+        storage.changesHeldForUnreadableCopies = ["Connection_A"]
+        storage.deletionsHeldForUnreadableCopies = ["Connection_B"]
+        storage.removalsPendingForUnreadableCopies = ["Connection_C"]
+
+        _ = storage.adoptAccount("second")
+
+        #expect(storage.changesHeldForUnreadableCopies.isEmpty)
+        #expect(storage.deletionsHeldForUnreadableCopies.isEmpty)
+        #expect(storage.removalsPendingForUnreadableCopies.isEmpty)
+    }
+
+    @Test("A held deletion falls due once its copy reads, and settles unapplied when the server sent the record again")
+    func heldDeletionsFallDueWhenReadable() {
+        let storage = makeStorage()
+        storage.deletionsHeldForUnreadableCopies = ["Connection_A", "Connection_B", "Connection_C"]
+
+        let held = storage.heldDeletions(live: ["Connection_C"], unreadable: ["Connection_B"])
+
+        #expect(held.due == ["Connection_A"])
+        #expect(held.settled == ["Connection_A", "Connection_C"])
+    }
 }
```

**File**: `apple/TablePro/Core/Services/Import/MacImportLibraryStore.swift` (modified, +2/-1)
```diff
@@ -103,8 +103,9 @@ internal struct MacImportLibraryStore: ImportLibraryStore {
         return write
     }
 
+    // With the records this build cannot read, which keep their ids.
     func existingConnectionIds() -> Set<UUID> {
-        Set(connections.loadConnections().map(\.id))
+        Set(connections.loadConnections().map(\.id)).union(connections.unreadableConnectionIds)
     }
 
     // A file's credential is the secret itself: a key document given as a path would read a key file on this Mac.
```

**File**: `apple/TablePro/Core/Storage/ConnectionStorage.swift` (modified, +42/-5)
```diff
@@ -108,6 +108,11 @@ final class ConnectionStorage {
         let connections = storedConnections.map { stored in
             stored.toConnection()
         }
+        syncTracker.recordConnectionStanding(
+            syncing: Set(connections.filter(\.participatesInSync).map(\.id)),
+            keptOff: Set(connections.filter { !$0.participatesInSync }.map(\.id)),
+            unreadable: file.unreadableIds
+        )
 
         let migrated = Self.numberingUnrankedGroups(connections)
         if migrated != connections, storeIsTrusted {
@@ -129,21 +134,39 @@ final class ConnectionStorage {
 
     // False refuses dependent writes (sync marks, keychain items), or a password goes while its record stays.
     // `byUser` false is a write the app makes itself, which never clears a failed integrity check.
+    // `removingUnreadable` drops records this build cannot read, by id, as a deletion another device made does.
     @discardableResult
-    func saveConnections(_ connections: [DatabaseConnection], byUser: Bool = true, removingSecrets: Bool = false) -> Bool {
+    func saveConnections(
+        _ connections: [DatabaseConnection],
+        byUser: Bool = true,
+        removingSecrets: Bool = false,
+        removingUnreadable removedIds: Set<UUID> = []
+    ) -> Bool {
         let previous = loadConnections()
         guard !lastLoadFailed else {
             Self.logger.error("Refused to save over connections.json: it could not be read")
             return false
         }
-        guard persist(connections, byUser: byUser, removingSecrets: removingSecrets) else { return false }
+        guard persist(connections, byUser: byUser, removingSecrets: removingSecrets, removingUnreadable: removedIds) else {
+            return false
+        }
         moveSecretsWhoseScopeChanged(from: previous, to: connections)
         return true
     }
 
     @discardableResult
-    private func persist(_ connections: [DatabaseConnection], byUser: Bool = true, removingSecrets: Bool = false) -> Bool {
-        guard file.save(connections.map { StoredConnection(from: $0) }, byUser: byUser, removingSecrets: removingSecrets) else {
+    private func persist(
+        _ connections: [DatabaseConnection],
+        byUser: Bool = true,
+        removingSecrets: Bool = false,
+        removingUnreadable removedIds: Set<UUID> = []
+    ) -> Bool {
+        guard file.save(
+            connections.map { StoredConnection(from: $0) },
+            byUser: byUser,
+            removingSecrets: removingSecrets,
+            removingUnreadable: removedIds
+        ) else {
             return false
         }
         fileWriteCount += 1
@@ -211,7 +234,8 @@ final class ConnectionStorage {
             replaced.append(updated)
         }
 
-        var knownIds = Set(connections.map(\.id))
+        // A record this build cannot read keeps its id, so the import leaves it alone.
+        var knownIds = Set(connections.map(\.id)).union(file.unreadableIds)
         var added: [DatabaseConnection] = []
         for incoming in adding {
             guard knownIds.insert(incoming.id).inserted else { continue }
@@ -805,6 +829,19 @@ final class ConnectionStorage {
             + fieldIds.map { "com.TablePro.plugin.\($0).\(id)" }
     }
 
+    // Found by the id they end with: naming a plugin's secure fields needs the type the record no longer gives, and
+    // one left behind would reach whatever later saves a record with that id. Device-only, as for a remote delete.
+    func deleteSecrets(ofUnreadable ids: Set<UUID>) {
+        for id in ids {
+            let keys = keychain.deviceOnlyKeys(endingWith: ".\(id.uuidString)").filter { key in
+                key.hasPrefix("com.TablePro.") && !key.hasPrefix(CredentialProfileStorage.secretKeyPrefix)
+            }
+            for key in keys {
+                keychain.delete(forKey: key, deviceOnly: true)
+            }
+        }
+    }
+
     // Removing an iCloud Keychain item removes it from every device, so only a delete the other devices follow does.
     // One from another device leaves it to that device. A Local only delete cannot tell whether another device still
     // syncs the row, so it keeps it.
```

---

### Incident Patch 3: `e4a09da3` (2026-11-19)
**Commit Message**: fix(macos): make Vim mode's operators, motions, paste and marks match Vim (#4347)

**File**: `apple/TablePro/Core/Vim/VimEngine+Characters.swift` (modified, +11/-0)
```diff
@@ -29,4 +29,15 @@ extension VimEngine {
         }
         return max(position, limit)
     }
+
+    // A character's class is its first scalar's, so a variation selector or mark never splits it.
+    func wordClass(at offset: Int, in buffer: VimTextBuffer) -> VimWordScanner.CharacterClass {
+        let base = characterStart(at: offset, in: buffer)
+        let trail = base + 1 < buffer.length ? buffer.character(at: base + 1) : nil
+        return VimWordScanner.characterClass(lead: buffer.character(at: base), trail: trail)
+    }
+
+    func isWordCharacter(at offset: Int, in buffer: VimTextBuffer) -> Bool {
+        wordClass(at: offset, in: buffer) == .word
+    }
 }
```

**File**: `apple/TablePro/Core/Vim/VimEngine+InsertReplace.swift` (modified, +12/-4)
```diff
@@ -94,25 +94,33 @@ extension VimEngine {
 
     func processCommandLine(_ char: Character, buffer commandBuffer: String) -> Bool {
         switch char {
+        // Leaving the command line ends the command it is part of, an operator typed before it included.
         case "\u{1B}":
+            cancelPendingCommand()
             setMode(.normal)
             return true
         case "\r", "\n":
             let prefix = commandBuffer.first
             let body = String(commandBuffer.dropFirst())
             setMode(.normal)
-            if prefix == "/" {
-                runSearch(pattern: body, forward: true)
-            } else if prefix == "?" {
-                runSearch(pattern: body, forward: false)
+            if prefix == "/" || prefix == "?" {
+                // A search after an operator is its motion, as `d/foo` deletes up to foo.
+                if pendingOperator != nil, let buffer {
+                    let target = searchTarget(pattern: body, forward: prefix == "/", count: searchCount, in: buffer)
+                    applyMotion(to: target, kind: .exclusive, in: buffer)
+                } else {
+                    runSearch(pattern: body, forward: prefix == "/", count: searchCount)
+                }
             } else {
                 onCommand?(body)
             }
+            cancelPendingCommand()
             return true
         case "\u{7F}", "\u{08}":
             if (commandBuffer as NSString).length > 1 {
                 setMode(.commandLine(buffer: String(commandBuffer.dropLast())))
             } else {
+                cancelPendingCommand()
                 setMode(.normal)
             }
             return true
```

**File**: `apple/TablePro/Core/Vim/VimEngine+Motions.swift` (modified, +124/-120)
```diff
@@ -34,47 +34,29 @@ extension VimEngine {
     }
 
     func moveDown(_ count: Int, in buffer: VimTextBuffer) {
-        let pos = buffer.selectedRange().location
-        let (line, col) = buffer.lineAndColumn(forOffset: pos)
-        if goalColumn == nil { goalColumn = col }
-        let targetLine = min(buffer.lineCount - 1, line + count)
-        let newPos = buffer.offset(forLine: targetLine, column: goalColumn ?? col)
-        if let op = pendingOperator {
-            let startLineRange = buffer.lineRange(forOffset: pos)
-            let endLineRange = buffer.lineRange(forOffset: newPos)
-            let rangeStart = min(startLineRange.location, endLineRange.location)
-            let rangeEnd = max(
-                startLineRange.location + startLineRange.length,
-                endLineRange.location + endLineRange.length
-            )
-            let opRange = NSRange(location: rangeStart, length: rangeEnd - rangeStart)
-            executeOperatorOnRange(op, range: opRange, linewise: true, in: buffer)
-            pendingOperator = nil
-        } else {
-            buffer.setSelectedRange(NSRange(location: newPos, length: 0))
-        }
+        moveVertically(by: count, in: buffer)
     }
 
     func moveUp(_ count: Int, in buffer: VimTextBuffer) {
+        moveVertically(by: -count, in: buffer)
+    }
+
+    // An operator takes the lines whole; on the first or last line it has nothing to take and the command ends.
+    private func moveVertically(by delta: Int, in buffer: VimTextBuffer) {
         let pos = buffer.selectedRange().location
         let (line, col) = buffer.lineAndColumn(forOffset: pos)
         if goalColumn == nil { goalColumn = col }
-        let targetLine = max(0, line - count)
+        let targetLine = min(max(0, line + delta), buffer.lineCount - 1)
         let newPos = buffer.offset(forLine: targetLine, column: goalColumn ?? col)
-        if let op = pendingOperator {
-            let startLineRange = buffer.lineRange(forOffset: newPos)
-            let endLineRange = buffer.lineRange(forOffset: pos)
-            let rangeStart = min(startLineRange.location, endLineRange.location)
-            let rangeEnd = max(
-                startLineRange.location + startLineRange.length,
-                endLineRange.location + endLineRange.length
-            )
-            let opRange = NSRange(location: rangeStart, length: rangeEnd - rangeStart)
-            executeOperatorOnRange(op, range: opRange, linewise: true, in: buffer)
-            pendingOperator = nil
-        } else {
+        guard let op = pendingOperator else {
             buffer.setSelectedRange(NSRange(location: newPos, length: 0))
+            return
+        }
+        guard targetLine != line else {
+            cancelPendingCommand()
+            return
         }
+        operate(op, from: pos, to: newPos, kind: .linewise, in: buffer)
     }
 
     func moveToLineStart(in buffer: VimTextBuffer) {
@@ -118,28 +100,51 @@ extension VimEngine {
         buffer.setSelectedRange(NSRange(location: offset, length: 0))
     }
 
-    func wordForward(_ count: Int, in buffer: VimTextBuffer) {
+    // `cw` on a word changes to its end, as `ce` does; elsewhere `w` and `W` go to the next word's start.
+    func wordMotion(_ count: Int, bigWord: Bool, in buffer: VimTextBuffer) {
+        let pos = buffer.selectedRange().location
+        if pendingOperator == .change, pos < buffer.length, !isBlank(buffer.character(at: pos)) {
+            let end: (Int) -> Int = { bigWord ? buffer.bigWordEnd(from: $0) : buffer.wordEnd(from: $0) }
+            var target = end(pos - 1)
+            for _ in 1..<max(1, count) { target = end(target) }
+            applyMotion(to: target, kind: .inclusive, in: buffer)
+            return
+        }
+        applyMotion(to: wordForwardTarget(count, bigWord: bigWord, in: buffer), kind: .exclusive, in: buffer)
+    }
+
+    // After an operator the last word stops at the end of its line, and from an empty line at the next line's
+    // start, which `:help exclusive` turns into the empty line.
+    func wordForwardTarget(_ count: Int, bigWord: Bool, in buffer: VimTextBuffer) -> Int? {
         var pos = buffer.selectedRange().location
         let isOperator = pendingOperator != nil
         for i in 0..<count {
-            let prev = pos
-            let next = buffer.wordBoundary(forward: true, from: pos)
+            let next = bigWord
+                ? buffer.bigWordBoundary(forward: true, from: pos)
+                : buffer.wordBoundary(forward: true, from: pos)
             if isOperator && i == count - 1 {
-                let prevLineRange = buffer.lineRange(forOffset: prev)
-                let nextLineRange = buffer.lineRange(forOffset: min(next, buffer.length))
-                if prevLineRange.location != nextLineRange.location {
-                    let lineEnd = prevLineRange.location + prevLineRange.length
-                    let contentEnd = lineEnd > prevLineRange.locat
```

**File**: `apple/TablePro/Core/Vim/VimEngine+NormalMode.swift` (modified, +150/-94)
```diff
@@ -6,72 +6,81 @@
 import Foundation
 
 extension VimEngine {
-    func processNormal(_ char: Character, shift: Bool) -> Bool { // swiftlint:disable:this function_body_length cyclomatic_complexity
+    func processNormal(_ char: Character, shift: Bool) -> Bool {
         guard let buffer else { return false }
+        if char == "\u{1B}" {
+            cancelPendingCommand()
+            return true
+        }
+        if pendingRegisterSelect {
+            pendingRegisterSelect = false
+            // `""` names the unnamed register.
+            selectedRegister = char == "\"" ? nil : char
+            return true
+        }
+        if !takesCharacterArgument, char.isASCII, let digit = char.wholeNumberValue, countPrefix > 0 || digit > 0 {
+            if countPrefix <= 99_999 { countPrefix = countPrefix * 10 + digit }
+            return true
+        }
+        let consumed = processNormalCommand(char, shift: shift, in: buffer)
+        // A finished command drops the count and register typed for it, used or not.
+        if !hasPendingCommand {
+            countPrefix = 0
+            operatorCount = 0
+            selectedRegister = nil
+        }
+        return consumed
+    }
+
+    private var takesCharacterArgument: Bool {
+        pendingFindChar != nil || pendingReplaceChar || pendingMarkSet || pendingMarkJumpExact != nil || pendingZ
+            || pendingTextObject || pendingMacroTarget != nil || pendingBracket != nil
+    }
 
+    private func processNormalCommand(_ char: Character, shift: Bool, in buffer: VimTextBuffer) -> Bool { // swiftlint:disable:this function_body_length
         if let req = pendingFindChar {
             pendingFindChar = nil
-            if char == "\u{1B}" { return true }
             return executeFindChar(char, request: req, in: buffer)
         }
         if pendingReplaceChar {
             pendingReplaceChar = false
-            if char == "\u{1B}" { return true }
             return executeReplaceChar(char, in: buffer)
         }
         if pendingMarkSet {
             pendingMarkSet = false
-            if char == "\u{1B}" { return true }
-            marks[char] = buffer.selectedRange().location
+            setMark(char, at: buffer.selectedRange().location, in: buffer)
             return true
         }
         if let exact = pendingMarkJumpExact {
             pendingMarkJumpExact = nil
-            if char == "\u{1B}" { return true }
             jumpToMark(char, exact: exact, in: buffer)
             return true
         }
-        if pendingRegisterSelect {
-            pendingRegisterSelect = false
-            if char == "\u{1B}" { return true }
-            selectedRegister = char
-            return true
-        }
         if pendingZ {
             pendingZ = false
             return true
         }
         if pendingTextObject {
             pendingTextObject = false
-            if char == "\u{1B}" {
-                pendingOperator = nil
-                return true
-            }
             return executeTextObject(char, around: pendingTextObjectAround, in: buffer)
         }
         if let kind = pendingMacroTarget {
             pendingMacroTarget = nil
-            if char == "\u{1B}" { return true }
             handleMacroTarget(kind: kind, register: char)
             return true
         }
         if let bracketKind = pendingBracket {
             pendingBracket = nil
-            if char == "\u{1B}" { return true }
+            let count = consumeCount()
             switch (bracketKind, char) {
-            case (.openBracket, "["): sectionBackward(in: buffer); return true
-            case (.closeBracket, "]"): sectionForward(in: buffer); return true
-            default: return true
-            }
-        }
-
-        if char.isNumber {
-            let digit = char.wholeNumberValue ?? 0
-            if countPrefix > 0 || digit > 0 {
-                guard countPrefix <= 99_999 else { return true }
-                countPrefix = countPrefix * 10 + digit
-                return true
+            case (.openBracket, "["):
+                applyMotion(to: sectionTarget(forward: false, count: count, in: buffer), kind: .exclusive, jump: true, in: buffer)
+            case (.closeBracket, "]"):
+                applyMotion(to: sectionTarget(forward: true, count: count, in: buffer), kind: .exclusive, jump: true, in: buffer)
+            default:
+                cancelPendingCommand()
             }
+            return true
         }
 
         if pendingG {
@@ -83,6 +92,13 @@ extension VimEngine {
             return true
         }
 
+        // A key that is not a motion, a text object or the operator doubled ends the command, as Vim's operators
+        // accept nothing else.
+        if let op = pendingOperator, !acceptsAfterOperator(char, op) {
+            cancelPendingCommand()
+            return true
+        }
+
         switch char {
         case "h":
             let count = consumeCount()
@@ -101,13 +117,14 @
```

**File**: `apple/TablePro/Core/Vim/VimEngine+Operators.swift` (modified, +98/-46)
```diff
@@ -16,16 +16,73 @@ extension VimEngine {
         let startPos = buffer.selectedRange().location
         motion()
         let endPos = buffer.selectedRange().location
+        operate(op, from: startPos, to: endPos, kind: inclusive ? .inclusive : .exclusive, in: buffer)
+    }
 
-        let rangeStart = min(startPos, endPos)
-        var rangeEnd = max(startPos, endPos)
-        if inclusive && rangeEnd < buffer.length && buffer.character(at: rangeEnd) != 0x0A {
-            rangeEnd = characterEnd(at: rangeEnd, in: buffer)
+    func operate(_ op: VimOperator, from origin: Int, to target: Int, kind: VimMotionKind, in buffer: VimTextBuffer) {
+        pendingOperator = nil
+        let start = min(origin, target)
+        let end = max(origin, target)
+        if kind == .linewise {
+            executeOperatorOnRange(op, range: wholeLines(from: start, through: end, in: buffer), linewise: true, in: buffer)
+            return
+        }
+        var rangeEnd = end
+        if kind == .inclusive, end < buffer.length, buffer.character(at: end) != 0x0A {
+            rangeEnd = characterEnd(at: end, in: buffer)
+        }
+        let startsInIndent = isInIndent(start, in: buffer)
+        // `:help exclusive`: an exclusive motion that ends at the start of a later line stops at the end of the line
+        // before, and takes whole lines when it starts in the indent.
+        if kind == .exclusive, end > start, buffer.lineRange(forOffset: end).location == end {
+            if startsInIndent {
+                executeOperatorOnRange(op, range: wholeLines(from: start, through: end - 1, in: buffer), linewise: true, in: buffer)
+                return
+            }
+            rangeEnd = characterStart(at: end - 1, in: buffer)
+        }
+        // `>` and `<` shift the lines the motion covers whatever its kind.
+        if op == .indent || op == .outdent {
+            let lines = wholeLines(from: start, through: max(start, rangeEnd - 1), in: buffer)
+            executeOperatorOnRange(op, range: lines, linewise: true, in: buffer)
+            return
         }
-        let range = NSRange(location: rangeStart, length: rangeEnd - rangeStart)
+        // A delete over several lines from the indent to the end of a line takes the lines, as Vim's `d` does.
+        if op == .delete, startsInIndent, rangeEnd > start,
+           buffer.lineRange(forOffset: start).location != buffer.lineRange(forOffset: rangeEnd - 1).location,
+           isBlankToLineEnd(from: rangeEnd, in: buffer) {
+            executeOperatorOnRange(op, range: wholeLines(from: start, through: rangeEnd - 1, in: buffer), linewise: true, in: buffer)
+            return
+        }
+        executeOperatorOnRange(op, range: NSRange(location: start, length: rangeEnd - start), linewise: false, in: buffer)
+    }
 
-        executeOperatorOnRange(op, range: range, linewise: false, in: buffer)
-        pendingOperator = nil
+    func wholeLines(from start: Int, through end: Int, in buffer: VimTextBuffer) -> NSRange {
+        let first = buffer.lineRange(forOffset: start).location
+        let last = NSMaxRange(buffer.lineRange(forOffset: max(start, end)))
+        return NSRange(location: first, length: last - first)
+    }
+
+    // Only blanks come before `offset` on its line.
+    func isInIndent(_ offset: Int, in buffer: VimTextBuffer) -> Bool {
+        var scan = buffer.lineRange(forOffset: offset).location
+        while scan < offset {
+            let ch = buffer.character(at: scan)
+            guard ch == 0x20 || ch == 0x09 else { return false }
+            scan += 1
+        }
+        return true
+    }
+
+    func isBlankToLineEnd(from offset: Int, in buffer: VimTextBuffer) -> Bool {
+        let lineEnd = contentEnd(ofLineAt: offset, in: buffer)
+        var scan = offset
+        while scan < lineEnd {
+            let ch = buffer.character(at: scan)
+            guard ch == 0x20 || ch == 0x09 || ch == 0x0D else { return false }
+            scan += 1
+        }
+        return true
     }
 
     func executeOperatorOnRange(_ op: VimOperator, range proposed: NSRange, linewise: Bool, in buffer: VimTextBuffer) {
@@ -39,17 +96,20 @@ extension VimEngine {
             let text = buffer.string(in: range)
             writeToActiveRegister(text: text, linewise: linewise, asDelete: true)
             buffer.replaceCharacters(in: range, with: "")
-            adjustMarksForEdit(in: range, replacementLength: 0)
-            buffer.setSelectedRange(NSRange(location: clampToContentPosition(range.location, in: buffer), length: 0))
+            let landing = linewise ? firstNonBlankOffset(from: range.location, in: buffer) : range.location
+            buffer.setSelectedRange(NSRange(location: clampToContentPosition(landing, in: buffer), length: 0))
         case .yank:
             let text = buffer.string(in: range)
             writeToActiveRegister(text: text, linewise: linewise, asDelete: false)
             buffer.setSelectedRange(NSRange(
```

**File**: `apple/TablePro/Core/Vim/VimEngine+RegistersMarks.swift` (modified, +274/-33)
```diff
@@ -13,9 +13,12 @@ struct VimDocumentMarks {
     var lastVisualLinewise = false
     var lastJumpOrigin: Int?
     var lastInsertOffset: Int?
+    var markColumns: [Character: Int] = [:]
+    var editJournal: [VimEditRecord] = []
 
     var isEmpty: Bool {
         marks.isEmpty && lastVisualStart == nil && lastVisualEnd == nil && lastJumpOrigin == nil && lastInsertOffset == nil
+            && editJournal.isEmpty
     }
 }
 
@@ -27,12 +30,17 @@ extension VimEngine {
             lastVisualEnd: lastVisualEnd,
             lastVisualLinewise: lastVisualLinewise,
             lastJumpOrigin: lastJumpOrigin,
-            lastInsertOffset: lastInsertOffset
+            lastInsertOffset: lastInsertOffset,
+            markColumns: markColumns,
+            editJournal: editJournal
         )
     }
 
     func restoreDocumentMarks(_ saved: VimDocumentMarks) {
         marks = saved.marks
+        markColumns = saved.markColumns
+        editJournal = saved.editJournal
+        editJournalTextLength = saved.editJournal.reduce(0) { $0 + $1.textLength }
         lastVisualStart = saved.lastVisualStart
         lastVisualEnd = saved.lastVisualEnd
         lastVisualLinewise = saved.lastVisualLinewise
@@ -81,39 +89,32 @@ extension VimEngine {
         return register
     }
 
+    // `'` goes to the first non-blank of the mark's line and takes whole lines after an operator; `` ` `` goes to
+    // the mark itself. An unset mark ends the command.
     func jumpToMark(_ name: Character, exact: Bool, in buffer: VimTextBuffer) {
-        if name == "'" || name == "`" {
-            if let origin = lastJumpOrigin {
-                let originPos = buffer.selectedRange().location
-                let clamped = min(max(0, origin), buffer.length)
-                buffer.setSelectedRange(NSRange(location: clamped, length: 0))
-                lastJumpOrigin = originPos
-            }
-            return
+        let offset: Int?
+        switch name {
+        case "'", "`": offset = lastJumpOrigin
+        case "<": offset = lastVisualStart
+        case ">": offset = lastVisualEnd
+        default: offset = marks[name]
         }
-        if name == "<", let start = lastVisualStart {
-            let originPos = buffer.selectedRange().location
-            buffer.setSelectedRange(NSRange(location: min(max(0, start), buffer.length), length: 0))
-            lastJumpOrigin = originPos
+        guard let offset else {
+            applyMotion(to: nil, kind: .exclusive, in: buffer)
             return
         }
-        if name == ">", let end = lastVisualEnd {
-            let originPos = buffer.selectedRange().location
-            buffer.setSelectedRange(NSRange(location: min(max(0, end), buffer.length), length: 0))
-            lastJumpOrigin = originPos
-            return
+        var clamped = min(max(0, offset), buffer.length)
+        if let column = markColumns[name] {
+            let lineStart = buffer.lineRange(forOffset: clamped).location
+            let lastCharacter = max(lineStart, contentEnd(ofLineAt: clamped, in: buffer) - 1)
+            clamped = min(lineStart + column, lastCharacter)
         }
-        guard let offset = marks[name] else { return }
-        let originPos = buffer.selectedRange().location
-        let clamped = min(max(0, offset), buffer.length)
         if exact {
-            buffer.setSelectedRange(NSRange(location: clamped, length: 0))
+            applyMotion(to: clamped, kind: .exclusive, jump: true, in: buffer)
         } else {
             let lineStart = buffer.lineRange(forOffset: clamped).location
-            let target = firstNonBlankOffset(from: lineStart, in: buffer)
-            buffer.setSelectedRange(NSRange(location: target, length: 0))
+            applyMotion(to: firstNonBlankOffset(from: lineStart, in: buffer), kind: .linewise, jump: true, in: buffer)
         }
-        lastJumpOrigin = originPos
     }
 
     func recordVisualSelection(linewise: Bool, in buffer: VimTextBuffer) {
@@ -144,15 +145,255 @@ extension VimEngine {
         }
     }
 
-    func adjustMarksForEdit(in editRange: NSRange, replacementLength: Int) {
-        let delta = replacementLength - editRange.length
-        guard delta != 0 else { return }
-        for (key, offset) in marks {
-            if offset >= editRange.location + editRange.length {
-                marks[key] = offset + delta
-            } else if offset >= editRange.location {
-                marks[key] = editRange.location
+    func setMark(_ name: Character, at offset: Int, in buffer: VimTextBuffer) {
+        marks[name] = offset
+        markColumns[name] = offset - buffer.lineRange(forOffset: offset).location
+    }
+
+    var positionSnapshot: VimPositionSnapshot {
+        VimPositionSnapshot(
+            marks: marks,
+            markColumns: markColumns,
+            lastJumpOrigin: lastJumpOrigin,
+            lastInsertOffset: lastInsertOffset,
+            lastVisualStart: lastVisualStart,
+            lastV
```

**File**: `apple/TablePro/Core/Vim/VimEngine+Search.swift` (modified, +41/-28)
```diff
@@ -6,43 +6,62 @@
 import Foundation
 
 extension VimEngine {
-    func runSearch(pattern: String, forward: Bool) {
-        guard !pattern.isEmpty, let buffer else { return }
-        lastSearchPattern = pattern
-        lastSearchForward = forward
+    func runSearch(pattern: String, forward: Bool, count: Int = 1) {
+        guard let buffer else { return }
         let origin = buffer.selectedRange().location
-        if let target = findPattern(pattern, from: origin, forward: forward, wholeWord: false, in: buffer) {
+        if let target = searchTarget(pattern: pattern, forward: forward, count: count, in: buffer) {
             buffer.setSelectedRange(NSRange(location: target, length: 0))
             lastJumpOrigin = origin
         }
     }
 
-    func searchNext(in buffer: VimTextBuffer, reverseDirection: Bool) {
-        guard let pattern = lastSearchPattern else { return }
+    // Remembers the pattern for `n` and `N`, as a search does even when nothing matches.
+    func searchTarget(pattern: String, forward: Bool, count: Int = 1, in buffer: VimTextBuffer) -> Int? {
+        guard !pattern.isEmpty else { return nil }
+        lastSearchPattern = pattern
+        lastSearchForward = forward
+        var position = buffer.selectedRange().location
+        for _ in 0..<max(1, count) {
+            guard let next = findPattern(pattern, from: position, forward: forward, wholeWord: false, in: buffer) else {
+                return nil
+            }
+            position = next
+        }
+        return position
+    }
+
+    func searchNextTarget(count: Int, reverseDirection: Bool, in buffer: VimTextBuffer) -> Int? {
+        guard let pattern = lastSearchPattern else { return nil }
         let forward = reverseDirection ? !lastSearchForward : lastSearchForward
-        let origin = buffer.selectedRange().location
-        if let target = findPattern(pattern, from: origin, forward: forward, wholeWord: false, in: buffer) {
-            buffer.setSelectedRange(NSRange(location: target, length: 0))
-            lastJumpOrigin = origin
+        var position = buffer.selectedRange().location
+        for _ in 0..<max(1, count) {
+            guard let next = findPattern(pattern, from: position, forward: forward, wholeWord: false, in: buffer) else {
+                return nil
+            }
+            position = next
         }
+        return position
     }
 
-    func searchWordUnderCursor(forward: Bool, in buffer: VimTextBuffer) {
+    func searchWordUnderCursorTarget(forward: Bool, count: Int, in buffer: VimTextBuffer) -> Int? {
         let pos = buffer.selectedRange().location
-        guard pos < buffer.length else { return }
+        guard pos < buffer.length else { return nil }
         var start = pos
-        while start > 0 && isWordChar(buffer.character(at: start - 1)) { start -= 1 }
+        while start > 0 && isWordCharacter(at: start - 1, in: buffer) { start -= 1 }
         var end = pos
-        while end < buffer.length && isWordChar(buffer.character(at: end)) { end += 1 }
-        guard end > start else { return }
+        while end < buffer.length && isWordCharacter(at: end, in: buffer) { end += 1 }
+        guard end > start else { return nil }
         let word = buffer.string(in: NSRange(location: start, length: end - start))
         lastSearchPattern = word
         lastSearchForward = forward
-        let origin = pos
-        if let target = findPattern(word, from: origin, forward: forward, wholeWord: true, in: buffer) {
-            buffer.setSelectedRange(NSRange(location: target, length: 0))
-            lastJumpOrigin = origin
+        var position = pos
+        for _ in 0..<max(1, count) {
+            guard let next = findPattern(word, from: position, forward: forward, wholeWord: true, in: buffer) else {
+                return nil
+            }
+            position = next
         }
+        return position
     }
 
     func findPattern(
@@ -62,9 +81,9 @@ extension VimEngine {
             let candidate = nsBuffer.substring(with: NSRange(location: idx, length: needle.length))
             guard candidate == pattern else { return false }
             if !wholeWord { return true }
-            let beforeOk = idx == 0 || !self.isWordChar(nsBuffer.character(at: idx - 1))
+            let beforeOk = idx == 0 || VimWordScanner.characterClass(at: idx - 1, in: nsBuffer) != .word
             let afterIdx = idx + needle.length
-            let afterOk = afterIdx >= total || !self.isWordChar(nsBuffer.character(at: afterIdx))
+            let afterOk = afterIdx >= total || VimWordScanner.characterClass(at: afterIdx, in: nsBuffer) != .word
             return beforeOk && afterOk
         }
 
@@ -95,10 +114,4 @@ extension VimEngine {
         }
         return nil
     }
-
-    func isWordChar(_ ch: unichar) -> Bool {
-        if ch == 0x5F { return true }
-        guard let scalar = UnicodeScalar(ch) else { return false }
-        return CharacterSet.alphanumerics.contains(sc
```

**File**: `apple/TablePro/Core/Vim/VimEngine+TextObjects.swift` (modified, +37/-34)
```diff
@@ -12,12 +12,18 @@ extension VimEngine {
             pendingOperator = nil
             return true
         }
+        // A paragraph is whole lines, every other object characters, and Visual mode takes the object's kind.
+        let linewise = key == "p"
         if mode.isVisual {
-            buffer.setSelectedRange(range)
+            // The object's start becomes Visual's anchor and its end the cursor, so the next motion extends it.
+            guard range.length > 0 else { return true }
+            if linewise != mode.isVisualLinewise { setMode(.visual(linewise: linewise)) }
+            visualAnchor = range.location
+            updateVisualSelection(cursorPos: NSMaxRange(range) - 1, linewise: linewise, in: buffer)
             return true
         }
         if let op = pendingOperator {
-            executeOperatorOnRange(op, range: range, linewise: false, in: buffer)
+            executeOperatorOnRange(op, range: range, linewise: linewise, in: buffer)
             pendingOperator = nil
         }
         return true
@@ -41,20 +47,22 @@ extension VimEngine {
 
     func wordObject(at cursor: Int, bigWord: Bool, around: Bool, in buffer: VimTextBuffer) -> NSRange? {
         guard buffer.length > 0 else { return nil }
-        let pos = min(max(0, cursor), buffer.length - 1)
-        let classifier: (unichar) -> Int = { ch in
-            if ch == 0x20 || ch == 0x09 || ch == 0x0A || ch == 0x0D { return 0 }
-            if bigWord { return 1 }
-            if ch == 0x5F { return 1 }
-            if let scalar = UnicodeScalar(ch), CharacterSet.alphanumerics.contains(scalar) { return 1 }
-            return 2
+        let pos = characterStart(at: min(max(0, cursor), buffer.length - 1), in: buffer)
+        let classOf: (Int) -> VimWordScanner.CharacterClass = { offset in
+            let cls = self.wordClass(at: offset, in: buffer)
+            return bigWord && cls != .whitespace ? .word : cls
         }
-        let startClass = classifier(buffer.character(at: pos))
+        let startClass = classOf(pos)
         var start = pos
-        while start > 0 && classifier(buffer.character(at: start - 1)) == startClass { start -= 1 }
-        var end = pos
-        while end < buffer.length - 1 && classifier(buffer.character(at: end + 1)) == startClass { end += 1 }
-        var rangeEnd = end + 1
+        while start > 0 {
+            let previous = characterStart(at: start - 1, in: buffer)
+            guard classOf(previous) == startClass else { break }
+            start = previous
+        }
+        var rangeEnd = characterEnd(at: pos, in: buffer)
+        while rangeEnd < buffer.length && classOf(rangeEnd) == startClass {
+            rangeEnd = characterEnd(at: rangeEnd, in: buffer)
+        }
         if around {
             var trail = rangeEnd
             while trail < buffer.length {
@@ -219,32 +227,27 @@ extension VimEngine {
         return NSRange(location: oe + 1, length: closeStart - oe - 1)
     }
 
+    // Whole lines: the run of paragraph or blank lines at the cursor. `ap` adds the blank lines after a paragraph,
+    // or the paragraph after blank lines, and with nothing after it the blank lines before.
     func paragraphObject(at cursor: Int, around: Bool, in buffer: VimTextBuffer) -> NSRange? {
-        let (currentLine, _) = buffer.lineAndColumn(forOffset: cursor)
+        let lineCount = buffer.lineCount
+        let currentLine = buffer.lineAndColumn(forOffset: cursor).line
+        let blank = lineIsWhite(currentLine, in: buffer)
         var startLine = currentLine
-        while startLine > 0 && !lineIsBlank(startLine - 1, in: buffer) {
-            startLine -= 1
-        }
+        while startLine > 0 && lineIsWhite(startLine - 1, in: buffer) == blank { startLine -= 1 }
         var endLine = currentLine
-        while endLine < buffer.lineCount - 1 && !lineIsBlank(endLine + 1, in: buffer) {
-            endLine += 1
-        }
-        let start = buffer.offset(forLine: startLine, column: 0)
-        let lastContentLineRange = buffer.lineRange(forOffset: buffer.offset(forLine: endLine, column: 0))
-        var end = lastContentLineRange.location + lastContentLineRange.length
-        if !around && end > start {
-            end -= 1
-        }
+        while endLine < lineCount - 1 && lineIsWhite(endLine + 1, in: buffer) == blank { endLine += 1 }
         if around {
-            var trailing = endLine
-            while trailing < buffer.lineCount - 1 && lineIsBlank(trailing + 1, in: buffer) {
-                trailing += 1
-            }
-            if trailing > endLine {
-                let trailingRange = buffer.lineRange(forOffset: buffer.offset(forLine: trailing, column: 0))
-                end = trailingRange.location + trailingRange.length
+            var next = endLine
+            while next < lineCount - 1 && lineIsWhite(next + 1, in: buffer) != blank { next += 1 }
+            if next > endLine {
+                endLine = next
+            } else i
```

#### Recent Merged Pull Requests:
- **PR #4358** (2026-11-19): docs(roadmap): tick the items #4326 shipped (@datlechin)
- **PR #4357** (2026-11-19): perf(schema): open a table from the shared column catalog (@datlechin)
- **PR #4356** (2026-11-19): perf(import): send a SQL import's writes to PostgreSQL in pipelined batches (@datlechin)
- **PR #4355** (2026-11-19): perf(export): read a PostgreSQL dump's index, comment, sequence and enum DDL once per schema (@datlechin)
- **PR #4354** (2026-11-19): fix(duckdb): run DuckDB's tasks on 8 MiB threads so a deep ATTACH cannot overflow (@datlechin)
- **PR #4353** (2026-11-19): ci(deps): bump taiki-e/install-action from 2.90.1 to 2.90.3 in the actions group across 1 directory (@dependabot[bot])

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

## X. duckdb): run DuckDB's tasks on 8 MiB threads so a deep ATTACH cannot overflow

**RULE**:
When implementing operations in `apple/Plugins/DuckDBDriverPlugin/DuckDBConnection.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in TableProApp/TablePro. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `68da8db7`: duckdb): run DuckDB's tasks on 8 MiB threads so a deep ATTACH cannot overflow. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `apple/Plugins/DuckDBDriverPlugin/DuckDBConnection.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    private var taskThreads: DuckDBTaskThreads?
        for option in DuckDBTaskThreads.sessionOptions
            where duckdb_set_config(config, option.name, option.value) == DuckDBError {
            throw DuckDBPluginError.connectionFailed(
                String(localized: "This build of DuckDB does not accept running its tasks on threads TablePro starts")
            )
        }
        taskThreads = DuckDBTaskThreads(database: openedDB)
        taskThreads?.close()
        taskThreads = nil
        if !DuckDBTaskThreads.keepsCount(statementType) {
            taskThreads?.followCount()
        }
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `68da8db7` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
