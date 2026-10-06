# Forensic Learning Record (Deep Inspection): TableProApp/TablePro

> **Canonical Artifact**: `07_PROJECT_LEARNING/tableproapp-tablepro-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TableProApp/TablePro](https://github.com/TableProApp/TablePro))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:29:45.192Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TableProApp/TablePro`
- **Description**: Free and open source database client built natively for developers
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6212 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Native/HanaBridge/internal/hana/statement.go`
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
	for {
		columns, err := rows.Columns()
		if err != nil {
			return nil, err
		}
		if len(columns) > 0 {
			return readResultSet(rows, op, rowLimit)
		}
		if !rows.NextResultSet() {
			if err := rows.Err(); err != nil {
				return nil, err
			}
			return affectedRowsEnvelope(0), nil
		}
	}
}

func readResultSet(rows *sql.Rows, op *operation, rowLimit int) (*resultEnvelope, error) {
	columns, err := describeColumns(rows)
	if err != nil {
		return nil, err
	}
	envelope := tabularEnvelope(columns)
	for rows.Next() {
		if op.stopped() {
			return nil, errOperationStopped
		}
		if rowLimit > 0 && len(envelope.rows) >= rowLimit {
			envelope.isTruncated = true
			break
		}
		row, truncatedLobs, err := scanRow(rows, columns, op)
		if err != nil {
			return nil, err
		}
		envelope.rows = append(envelope.rows, row)
		envelope.truncatedLobCount += truncatedLobs
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return envelope, nil
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

### Core Architecture Module: `Packages/TableProCore/Package.swift`
```
// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "TableProCore",
    platforms: [
        .macOS(.v13),
        .iOS(.v17)
    ],
    products: [
        .library(name: "TableProCoreTypes", targets: ["TableProCoreTypes"]),
        .library(name: "TableProGeometry", targets: ["TableProGeometry"]),
        .library(name: "TableProPluginKit", targets: ["TableProPluginKit"]),
        .library(name: "TableProModels", targets: ["TableProModels"]),
        .library(name: "TableProImport", targets: ["TableProImport"]),
        .library(name: "TableProDatabase", targets: ["TableProDatabase"]),
        .library(name: "TableProQuery", targets: ["TableProQuery"]),
        .library(name: "TableProSyncTransport", targets: ["TableProSyncTransport"]),
        .library(name: "TableProSync", targets: ["TableProSync"]),
        .library(name: "TableProAnalytics", targets: ["TableProAnalytics"]),
        .library(name: "TableProMSSQLCore", targets: ["TableProMSSQLCore"]),
        .library(name: "TableProTeradataCore", targets: ["TableProTeradataCore"]),
        .library(name: "TableProTrinoCore", targets: ["TableProTrinoCore"]),
        .library(name: "TableProTLSClientIdentity", targets: ["TableProTLSClientIdentity"]),
        .library(name: "TableProTLSTestFixtures", targets: ["TableProTLSTestFixtures"]),
        .library(name: "TableProGoogleCloud", targets: ["TableProGoogleCloud"]),
        .library(name: "TableProSpannerCore", targets: ["TableProSpannerCore"]),
        .library(name: "TableProWeaviateCore", targets: ["TableProWeaviateCore"]),
        .library(name: "TableProNumberFormatting", targets: ["TableProNumberFormatting"]),
        .library(name: "TableProDocumentPath", targets: ["TableProDocumentPath"]),
        .library(name: "TableProJavaScriptText", targets: ["TableProJavaScriptText"]),
        .library(name: "TableProLogRedaction", targets: ["TableProLogRedaction"]),
        .library(name: "TableProR2SQLCore", targets: ["TableProR2SQLCore"]),
        .library(name: "TableProConnectionLibrary", targets: ["TableProConnectionLibrary"]),
        .library(name: "TableProSQLGrammar", targets: ["TableProSQLGrammar"]),
        .library(name: "TableProSSHTransport", targets: ["TableProSSHTransport"]),
        .library(name: "CSQLite", targets: ["CSQLite"]),
        .library(name: "TableProSQLiteCore", targets: ["TableProSQLiteCore"]),
        .library(name: "TableProTabularIO", targets: ["TableProTabularIO"]),
        .library(name: "TableProTabular", targets: ["TableProTabular"])
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
            name: "TableProPluginKit",
            dependencies: [],
            path: "Sources/TableProPluginKit"
        ),
        .target(
            name: "TableProModels",
            dependencies: ["TableProPluginKit", "TableProCoreTypes"],
            path: "Sources/TableProModels"
        ),
        .target(
            name: "TableProImport",
            dependencies: [],
            path: "Sources/TableProImport"
        ),
        .target(
            name: "TableProDatabase",
            dependencies: ["TableProModels", "TableProCoreTypes", "TableProPluginKit"],
            path: "Sources/TableProDatabase"
        ),
        .target(
            name: "TableProQuery",
            dependencies: ["TableProModels", "TableProPluginKit", "TableProCoreTypes", "TableProSQLGrammar"],
            path: "Sources/TableProQuery"
        ),
        .target(
            name: "TableProSyncTransport",
            dependencies: [],
            path: "Sources/TableProSyncTransport"
        ),
        .target(
            name: "TableProSync",
            dependencies: ["TableProSyncTransport", "TableProModels", "TableProCoreTypes"],
            path: "Sources/TableProSync"
        ),
        .target(
            name: "TableProAnalytics",
            dependencies: [],
            path: "Sources/TableProAnalytics"
        ),
        .target(
            name: "TableProMSSQLCore",
            dependencies: ["TableProCoreTypes"],
            path: "Sources/TableProMSSQLCore"
        ),
        .target(
            name: "TableProTeradataCore",
            dependencies: [],
            path: "Sources/TableProTeradataCore"
        ),
        .target(
            name: "TableProTrinoCore",
            dependencies: [],
            path: "Sources/TableProTrinoCore"
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
            name: "TableProGoogleCloud",
            dependencies: [],
            path: "Sources/TableProGoogleCloud"
        ),
        .target(
            name: "TableProSpannerCore",
            dependencies: ["TableProGoogleCloud"],
            path: "Sources/TableProSpannerCore"
        ),
        .target(
            name: "TableProWeaviateCore",
            dependencies: [],
            path: "Sources/TableProWeaviateCore"
        ),
        .target(
            name: "TableProR2SQLCore",
            dependencies: [],
            path: "Sources/TableProR2SQLCore"
        ),
        .target(
            name: "TableProConnectionLibrary",
            dependencies: [],
            path: "Sources/TableProConnectionLibrary"
        ),
        .target(
            name: "TableProSQLGrammar",
            dependencies: [],
            path: "Sources/TableProSQLGrammar"
        ),
        .target(
            name: "TableProSSHTransport",
            dependencies: [],
            path: "Sources/TableProSSHTransport"
        ),
        .target(
            name: "CSQLite",
            dependencies: [],
            path: "Sources/CSQLite"
        ),
        .target(
            name: "TableProTabularIO",
            dependencies: [],
            path: "Sources/TableProTabularIO"
        ),
        .target(
            name: "TableProTabular",
            dependencies: ["TableProTabularIO"],
            path: "Sources/TableProTabular"
        ),
        .target(
            name: "TableProSQLiteCore",
            dependencies: ["CSQLite"],
            path: "Sources/TableProSQLiteCore"
        ),
        .testTarget(
            name: "TableProTabularIOTests",
            dependencies: ["TableProTabularIO", "TableProPluginKit"],
            path: "Tests/TableProTabularIOTests"
        ),
        .testTarget(
            name: "TableProTabularTests",
            dependencies: ["TableProTabular", "TableProTabularIO"],
            path: "Tests/TableProTabularTests"
        ),
        .testTarget(
            name: "TableProConnectionLibraryTests",
            dependencies: ["TableProConnectionLibrary"],
            path: "Tests/TableProConnectionLibraryTests"
        ),
        .testTarget(
            name: "TableProCoreTypesTests",
            dependencies: ["TableProCoreTypes"],
            path: "Tests/TableProCoreTypesTests"
        ),
        .testTarget(
            name: "TableProSSHTransportTests",
            dependencies: ["TableProSSHTransport"],
            path: "Tests/TableProSSHTransportTests"
        ),
        .testTarget(
            name: "TableProGeometryTests",
            dependencies: ["TableProGeometry"],
            path: "Tests/TableProGeometryTests"
        ),
        .testTarget(
            name: "TableProNumberFormattingTests",
            dependencies: ["TableProNumberFormatting"],
            path: "Tests/TableProNumberFormattingTests"
        ),
        .testTarget(
            name: "TableProDocumentPathTests",
            dependencies: ["TableProDocumentPath"],
            path: "Tests/TableProDocumentPathTests"
        ),
        .testTarget(
            name: "TableProJavaScriptTextTests",
            dependencies: ["TableProJavaScriptText"],
            path: "Tests/TableProJavaScriptTextTests"
        ),
        .testTarget(
            name: "TableProLogRedactionTests",
            dependencies: ["TableProLogRedaction"],
            path: "Tests/TableProLogRedactionTests"
        ),
        .testTarget(
            name: "TableProModelsTests",
            dependencies: ["TableProModels", "TableProPluginKit"],
            path: "Tests/TableProModelsTests"
        ),
        .testTarget(
            name: "TableProImportTests",
            dependencies: ["TableProImport"],
            path: "Tests/TableProImportTests"
        ),
        .testTarget(
            name: "TableProDatabaseTests",
            dependencies: ["TableProDatabase", "TableProModels", "TableProPluginKit"],
            path: "Tests/TableProDatabaseTests"
        ),
        .testTarget(
            name: "TableProQueryTests",
            dependencies: ["TableProQuery", "TableProModels", "TableProPluginKit"],
            path: "Tests/TableProQueryTests"
        ),
        .testTarget(
            name: "TableProSQLGrammarTests",
            dependencies: ["TableProSQLGrammar"],
            path: "Tests/Tabl
```

### Core Architecture Module: `Packages/TableProCore/Sources/CSQLite/include/sqlite3.h`
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

### Core Architecture Module: `Packages/TableProCore/Sources/CSQLite/include/sqlite3ext.h`
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

### Core Architecture Module: `Packages/TableProCore/Sources/CSQLite/include/tablepro_sqlite3.h`
```
#ifndef TABLEPRO_SQLITE3_H
#define TABLEPRO_SQLITE3_H

#include "sqlite3.h"

int tablepro_sqlite3_set_extension_loading(sqlite3 *db, int enabled, int *isEnabled);

#endif

```

### Core Architecture Module: `Packages/TableProCore/Sources/CSQLite/tablepro_sqlite3.c`
```
#include "tablepro_sqlite3.h"

int tablepro_sqlite3_set_extension_loading(sqlite3 *db, int enabled, int *isEnabled) {
    return sqlite3_db_config(db, SQLITE_DBCONFIG_ENABLE_LOAD_EXTENSION, enabled ? 1 : 0, isEnabled);
}

```

### Core Architecture Module: `Packages/TableProCore/Sources/TableProAnalytics/AnalyticsEnvironmentProvider.swift`
```
//
//  AnalyticsEnvironmentProvider.swift
//  TableProAnalytics
//

import Foundation

/// Protocol that platform-specific apps conform to, providing all environment data for analytics heartbeats.
///
/// macOS and iOS each implement this with platform-specific data sources (IOKit vs UIDevice,
/// DatabaseManager vs AppState, etc.). The heartbeat service reads these properties at send time
/// to build a fresh payload.
@MainActor
public protocol AnalyticsEnvironmentProvider: AnyObject {
    /// SHA256-hashed machine/device identifier (64 hex chars)
    var machineId: String { get }

    /// App version string (e.g. "1.2.0") from CFBundleShortVersionString
    var appVersion: String? { get }

    /// OS version string (e.g. "macOS 15.1.0" or "iOS 18.2.0")
    var osVersion: String { get }

    /// CPU architecture (e.g. "arm64", "x86_64")
    var architecture: String { get }

    /// Platform identifier sent to backend ("macos" or "ios")
    var platform: String { get }

    /// User locale preference (e.g. "en", "vi", "system")
    var locale: String { get }

    /// Whether the user has opted in to analytics
    var isAnalyticsEnabled: Bool { get }

    /// Whether the user has a valid license
    var hasLicense: Bool { get }

    /// Database type identifiers for active connections (e.g. ["mysql", "postgresql"])
    var activeDatabaseTypes: [String] { get }

    /// Number of active database connections
    var activeConnectionCount: Int { get }

    /// HMAC-SHA256 shared secret for request signing (from Info.plist build setting)
    var hmacSecret: String? { get }

    /// Timestamp of the first connection attempt the user made on this device, or nil if never attempted.
    /// Set once and never overwritten, the heartbeat sends the original value forever.
    var connectionAttemptedAt: Date? { get }

    /// Timestamp of the first successful connection on this device, or nil if no connection ever succeeded.
    /// Set once and never overwritten.
    var connectionSucceededAt: Date? { get }

    /// Timestamp of the first query the user successfully executed on this device, or nil if no query has run.
    /// Set once and never overwritten.
    var firstQueryExecutedAt: Date? { get }

    /// How updates install on this device: "automatic", "notify" or "off". Nil where the platform
    /// has no updater of its own, which is every App Store build.
    var updateInstallMode: String? { get }

    /// Seconds between scheduled update checks, or nil when checks are off or unavailable.
    var updateCheckInterval: Int? { get }
}

public extension AnalyticsEnvironmentProvider {
    var connectionAttemptedAt: Date? { nil }
    var connectionSucceededAt: Date? { nil }
    var firstQueryExecutedAt: Date? { nil }
    var updateInstallMode: String? { nil }
    var updateCheckInterval: Int? { nil }
}

```

### Core Architecture Module: `Packages/TableProCore/Sources/TableProAnalytics/AnalyticsHeartbeatService.swift`
```
//
//  AnalyticsHeartbeatService.swift
//  TableProAnalytics
//

import CryptoKit
import Foundation
import os

/// Shared heartbeat service for macOS and iOS. Sends anonymous usage data to the analytics API.
///
/// Platform-specific data is injected via `AnalyticsEnvironmentProvider`. The service handles:
/// encoding, HMAC-SHA256 signing, HTTP transport, heartbeat scheduling, and cooldown persistence.
@MainActor
public final class AnalyticsHeartbeatService {
    private static let logger = Logger(subsystem: "com.TablePro", category: "AnalyticsHeartbeat")

    private let provider: AnalyticsEnvironmentProvider

    private let analyticsUrl: URL

    private let heartbeatInterval: TimeInterval
    private let initialDelay: TimeInterval

    /// Minimum elapsed time before sending another heartbeat.
    /// Prevents duplicate sends on iOS when the app cycles between foreground/background.
    private let cooldownInterval: TimeInterval

    private static let lastHeartbeatKey = "com.TablePro.analytics.lastHeartbeatDate"

    /// Injected so a sandboxed run keeps its cooldown stamp out of the real defaults domain.
    private let defaults: UserDefaults

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30
        config.waitsForConnectivity = true
        return URLSession(configuration: config)
    }()

    private let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    public init(
        provider: AnalyticsEnvironmentProvider,
        analyticsUrl: URL = URL(string: "https://api.tablepro.app/v1/analytics")!,
        heartbeatInterval: TimeInterval = 24 * 60 * 60,
        initialDelay: TimeInterval = 10,
        cooldownInterval: TimeInterval = 20 * 60 * 60,
        defaults: UserDefaults = .standard
    ) {
        self.provider = provider
        self.analyticsUrl = analyticsUrl
        self.heartbeatInterval = heartbeatInterval
        self.initialDelay = initialDelay
        self.cooldownInterval = cooldownInterval
        self.defaults = defaults
    }

    // MARK: - Public API

    /// Start the periodic heartbeat loop. Returns a cancellable Task.
    /// The caller owns the Task lifecycle (cancel on deinit or background).
    public func startPeriodicHeartbeat() -> Task<Void, Never> {
        Task { [weak self] in
            guard let delay = self?.initialDelay else { return }
            try? await Task.sleep(for: .seconds(delay))

            while !Task.isCancelled {
                guard let target = self else { return }
                await target.sendHeartbeat()
                try? await Task.sleep(for: .seconds(target.heartbeatInterval))
            }
        }
    }

    /// Send a single heartbeat. Respects opt-out and cooldown.
    public func sendHeartbeat() async {
        guard provider.isAnalyticsEnabled else {
            Self.logger.trace("Analytics disabled by user, skipping heartbeat")
            return
        }

        guard isCooldownElapsed() else {
            Self.logger.trace("Analytics cooldown not elapsed, skipping heartbeat")
            return
        }

        let payload = buildPayload()

        do {
            var request = URLRequest(url: analyticsUrl)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(payload)

            if let body = request.httpBody,
               let secret = provider.hmacSecret, !secret.isEmpty {
                let key = SymmetricKey(data: Data(secret.utf8))
                let signature = HMAC<SHA256>.authenticationCode(for: body, using: key)
                let signatureHex = signature.map { String(format: "%02x", $0) }.joined()
                request.setValue(signatureHex, forHTTPHeaderField: "X-Signature")
            }

            let (_, response) = try await session.data(for: request)

            if let httpResponse = response as? HTTPURLResponse {
                Self.logger.trace("Analytics heartbeat sent, status: \(httpResponse.statusCode)")
            }

            recordHeartbeatTimestamp()
        } catch {
            Self.logger.trace("Analytics heartbeat failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Private

    private func buildPayload() -> AnalyticsPayload {
        let types = provider.activeDatabaseTypes
        return AnalyticsPayload(
            machineId: provider.machineId,
            platform: provider.platform,
            appVersion: provider.appVersion,
            osVersion: provider.osVersion,
            architecture: provider.architecture,
            locale: provider.locale,
            databaseTypes: types.isEmpty ? nil : types,
            connectionCount: provider.activeConnectionCount,
            hasLicense: provider.hasLicense,
            connectionAttemptedAt: provider.connectionAttemptedAt,
            connectionSucceededAt: provider.connectionSucceededAt,
            firstQueryExecutedAt: provider.firstQueryExecutedAt,
            updateInstallMode: provider.updateInstallMode,
            updateCheckInterval: provider.updateCheckInterval
        )
    }

    /// Exposed for tests so they can verify the encoded body without touching `sendHeartbeat()`.
    public func makeEncodedBodyForTesting(payload: AnalyticsPayload) throws -> Data {
        try encoder.encode(payload)
    }

    private func isCooldownElapsed() -> Bool {
        guard let last = defaults.object(forKey: Self.lastHeartbeatKey) as? Date else {
            return true
        }
        return Date().timeIntervalSince(last) >= cooldownInterval
    }

    private func recordHeartbeatTimestamp() {
        defaults.set(Date(), forKey: Self.lastHeartbeatKey)
    }
}

```

### Core Architecture Module: `Packages/TableProCore/Sources/TableProAnalytics/AnalyticsPayload.swift`
```
//
//  AnalyticsPayload.swift
//  TableProAnalytics
//

import Foundation

/// Anonymous heartbeat payload sent to the analytics API every 24 hours.
/// Encoded with snake_case keys to match backend expectations.
public struct AnalyticsPayload: Encodable, Sendable {
    public let machineId: String
    public let platform: String
    public let appVersion: String?
    public let osVersion: String
    public let architecture: String
    public let locale: String
    public let databaseTypes: [String]?
    public let connectionCount: Int
    public let hasLicense: Bool
    public let connectionAttemptedAt: Date?
    public let connectionSucceededAt: Date?
    public let firstQueryExecutedAt: Date?
    public let updateInstallMode: String?
    public let updateCheckInterval: Int?

    public init(
        machineId: String,
        platform: String,
        appVersion: String?,
        osVersion: String,
        architecture: String,
        locale: String,
        databaseTypes: [String]?,
        connectionCount: Int,
        hasLicense: Bool,
        connectionAttemptedAt: Date? = nil,
        connectionSucceededAt: Date? = nil,
        firstQueryExecutedAt: Date? = nil,
        updateInstallMode: String? = nil,
        updateCheckInterval: Int? = nil
    ) {
        self.machineId = machineId
        self.platform = platform
        self.appVersion = appVersion
        self.osVersion = osVersion
        self.architecture = architecture
        self.locale = locale
        self.databaseTypes = databaseTypes
        self.connectionCount = connectionCount
        self.hasLicense = hasLicense
        self.connectionAttemptedAt = connectionAttemptedAt
        self.connectionSucceededAt = connectionSucceededAt
        self.firstQueryExecutedAt = firstQueryExecutedAt
        self.updateInstallMode = updateInstallMode
        self.updateCheckInterval = updateCheckInterval
    }
}

```

### Core Architecture Module: `Packages/TableProCore/Sources/TableProConnectionLibrary/LibraryDropResolver.swift`
```
import Foundation

public enum LibraryDragItem: Hashable, Sendable {
    case connection(UUID, section: LibrarySectionKind)
    case group(UUID)
}

public enum LibraryDropTarget: Hashable, Sendable {
    case section(LibrarySectionKind, childIndex: Int?)
    case group(UUID, childIndex: Int?)
}

public enum LibraryDropOperation: Hashable, Sendable {
    case moveConnections([UUID], toGroup: UUID?, before: UUID?)
    case moveGroups([UUID], toParent: UUID?, before: UUID?)
    case addFavorites([UUID], before: UUID?)
    case reorderFavorites([UUID], before: UUID?)
}

public struct LibraryDropResolution: Hashable, Sendable {
    public let operation: LibraryDropOperation
    public let target: LibraryDropTarget

    public init(operation: LibraryDropOperation, target: LibraryDropTarget) {
        self.operation = operation
        self.target = target
    }
}

public enum LibraryDropResolver {
    public static func resolve<Connection: LibraryConnectionRepresentable>(
        items: [LibraryDragItem],
        target: LibraryDropTarget,
        sortMode: LibrarySortMode,
        graph: LibraryGroupGraph,
        connections: [UUID: Connection],
        outline: LibraryOutline
    ) -> LibraryDropResolution? {
        let connectionIds = unique(items.compactMap { item -> UUID? in
            guard case .connection(let id, _) = item else { return nil }
            return id
        })
        let groupIds = unique(items.compactMap { item -> UUID? in
            guard case .group(let id) = item else { return nil }
            return id
        })
        guard connectionIds.isEmpty != groupIds.isEmpty else { return nil }
        let fromSavedSections = items.allSatisfy { item in
            guard case .connection(_, let section) = item else { return true }
            return section.acceptsSavedConnections
        }
        guard fromSavedSections, connectionIds.allSatisfy({ connections[$0] != nil }) else { return nil }

        switch target {
        case .section(.favorites, let childIndex):
            guard groupIds.isEmpty else { return nil }
            return favoritesDrop(
                items: items,
                ids: connectionIds,
                childIndex: childIndex,
                sortMode: sortMode,
                connections: connections,
                outline: outline
            )
        case .section(.connections, let childIndex):
            return parentDrop(
                parentId: nil,
                childIndex: childIndex,
                siblings: outline.section(.connections)?.nodes ?? [],
                connectionIds: connectionIds,
                groupIds: groupIds,
                sortMode: sortMode,
                graph: graph,
                connections: connections
            )
        case .group(let groupId, let childIndex):
            guard graph.contains(groupId) else { return nil }
            return parentDrop(
                parentId: groupId,
                childIndex: childIndex,
                siblings: groupNode(groupId, in: outline.section(.connections)?.nodes ?? [])?.children ?? [],
                connectionIds: connectionIds,
                groupIds: groupIds,
                sortMode: sortMode,
                graph: graph,
                connections: connections
            )
        case .section:
            return nil
        }
    }

    private static func favoritesDrop<Connection: LibraryConnectionRepresentable>(
        items: [LibraryDragItem],
        ids: [UUID],
        childIndex: Int?,
        sortMode: LibrarySortMode,
        connections: [UUID: Connection],
        outline: LibraryOutline
    ) -> LibraryDropResolution? {
        let placesAtIndex = sortMode == .manual && childIndex != nil
        let favorites = outline.connectionIds(in: .favorites)
        let before = placesAtIndex ? firstId(in: favorites, from: childIndex ?? 0, excluding: Set(ids)) : nil
        let allFromFavorites = items.allSatisfy { item in
            guard case .connection(_, let section) = item else { return false }
            return section == .favorites
        }

        if allFromFavorites {
            guard placesAtIndex else { return nil }
            return LibraryDropResolution(
                operation: .reorderFavorites(ids, before: before),
                target: .section(.favorites, childIndex: childIndex)
            )
        }

        let allAlreadyFavorite = ids.allSatisfy { connections[$0]?.isFavorite == true }
        guard placesAtIndex || !allAlreadyFavorite else { return nil }
        return LibraryDropResolution(
            operation: .addFavorites(ids, before: before),
            target: .section(.favorites, childIndex: placesAtIndex ? childIndex : nil)
        )
    }

    private static func parentDrop<Connection: LibraryConnectionRepresentable>(
        parentId: UUID?,
        childIndex: Int?,
        siblings: [LibraryNode],
        connectionIds: [UUID],
        groupIds: [UUID],
        sortMode: LibrarySortMode,
        graph: LibraryGroupGraph,
        connections: [UUID: Connection]
    ) -> LibraryDropResolution? {
        let placesAtIndex = sortMode == .manual && childIndex != nil
        let dropOnTarget: LibraryDropTarget = parentId.map { .group($0, childIndex: nil) }
            ?? .section(.connections, childIndex: nil)
        let indexedTarget: LibraryDropTarget = parentId.map { .group($0, childIndex: childIndex) }
            ?? .section(.connections, childIndex: childIndex)

        if !groupIds.isEmpty {
            guard groupIds.allSatisfy({ graph.canPlace($0, under: parentId) }) else { return nil }
            if placesAtIndex {
                let siblingGroups = siblings.compactMap(groupId(of:))
                let before = firstId(in: siblingGroups, from: groupPosition(childIndex ?? 0, in: siblings), excluding: Set(groupIds))
                return LibraryDropResolution(
                    operation: .moveGroups(groupIds, toParent: parentId, before: before),
                    target: indexedTarget
                )
            }
            guard !groupIds.allSatisfy({ graph.parentId(of: $0) == parentId }) else { return nil }
            return LibraryDropResolution(
                operation: .moveGroups(groupIds, toParent: parentId, before: nil),
                target: dropOnTarget
            )
        }

        if placesAtIndex {
            let siblingConnections = siblings.compactMap(connectionId(of:))
            let position = connectionPosition(childIndex ?? 0, in: siblings)
            let before = firstId(in: siblingConnections, from: position, excluding: Set(connectionIds))
            return LibraryDropResolution(
                operation: .moveConnections(connectionIds, toGroup: parentId, before: before),
                target: indexedTarget
            )
        }
        let alreadyThere = connectionIds.allSatisfy { id in
            let current = connections[id]?.groupId.flatMap { graph.contains($0) ? $0 : nil }
            return current == parentId
        }
        guard !alreadyThere else { return nil }
        return LibraryDropResolution(
            operation: .moveConnections(connectionIds, toGroup: parentId, before: nil),
            target: dropOnTarget
        )
    }

    private static func groupNode(_ id: UUID, in nodes: [LibraryNode]) -> LibraryNode? {
        for node in nodes {
            guard case .group(let nodeId, let children, _) = node else { continue }
            if nodeId == id { return node }
            if let found = groupNode(id, in: children) { return found }
        }
        return nil
    }

    private static func groupId(of node: LibraryNode) -> UUID? {
        guard case .group(let id, _, _) = node else { return nil }
        return id
    }

    private static func connectionId(of node: LibraryNode) -> UUID? {
        guard case .connection(let id) = node else { return nil }
        return id
    }

    private static func groupPosition(_ childIndex: Int, in siblings: [LibraryNode]) -> Int {
        siblings.prefix(max(0, childIndex)).filter { groupId(of: $0) != nil }.count
    }

    private static func connectionPosition(_ childIndex: Int, in siblings: [LibraryNode]) -> Int {
        siblings.prefix(max(0, childIndex)).filter { connectionId(of: $0) != nil }.count
    }

    private static func firstId(in ids: [UUID], from position: Int, excluding: Set<UUID>) -> UUID? {
        guard position < ids.count else { return nil }
        return ids[max(0, position)...].first { !excluding.contains($0) }
    }

    private static func unique(_ ids: [UUID]) -> [UUID] {
        var seen: Set<UUID> = []
        return ids.filter { seen.insert($0).inserted }
    }
}

```

### Core Architecture Module: `Packages/TableProCore/Sources/TableProConnectionLibrary/LibraryGroupGraph.swift`
```
import Foundation

public struct LibraryGroupGraph: Sendable {
    public static let maxNestingDepth = 3

    public struct Entry: Hashable, Sendable {
        public let id: UUID
        public let name: String
        public let parentId: UUID?
        public let sortOrder: Int
    }

    public struct FlatEntry: Hashable, Sendable {
        public let id: UUID
        public let depth: Int
    }

    public let entries: [UUID: Entry]
    private let childrenByParent: [UUID?: [UUID]]

    public init<Group: LibraryGroupRepresentable>(groups: [Group]) {
        var raw: [UUID: Entry] = [:]
        for group in groups where raw[group.id] == nil {
            raw[group.id] = Entry(id: group.id, name: group.name, parentId: group.parentId, sortOrder: group.sortOrder)
        }
        let cyclic = Self.cyclicIds(in: raw)
        var resolved: [UUID: Entry] = [:]
        for (id, entry) in raw {
            let parentIsReachable = entry.parentId.map { raw[$0] != nil && !cyclic.contains(id) } ?? false
            resolved[id] = Entry(
                id: id,
                name: entry.name,
                parentId: parentIsReachable ? entry.parentId : nil,
                sortOrder: entry.sortOrder
            )
        }
        var children: [UUID?: [UUID]] = [:]
        for entry in resolved.values {
            children[entry.parentId, default: []].append(entry.id)
        }
        entries = resolved
        childrenByParent = children
    }

    public func contains(_ id: UUID) -> Bool {
        entries[id] != nil
    }

    public func parentId(of id: UUID) -> UUID? {
        entries[id]?.parentId
    }

    public func childIds(of parentId: UUID?) -> [UUID] {
        childrenByParent[parentId] ?? []
    }

    public func sortedChildIds(of parentId: UUID?, mode: LibrarySortMode) -> [UUID] {
        childIds(of: parentId)
            .compactMap { entries[$0] }
            .sorted { LibrarySorting.groupPrecedes($0, $1, mode: mode) }
            .map(\.id)
    }

    public func depth(of id: UUID?) -> Int {
        guard let id else { return 0 }
        var depth = 0
        var current: UUID? = id
        var visited: Set<UUID> = []
        while let node = current, let entry = entries[node], visited.insert(node).inserted {
            depth += 1
            current = entry.parentId
        }
        return depth
    }

    public func maxDescendantDepth(of id: UUID) -> Int {
        maxDescendantDepth(of: id, visited: [])
    }

    private func maxDescendantDepth(of id: UUID, visited: Set<UUID>) -> Int {
        let nextVisited = visited.union([id])
        let children = childIds(of: id).filter { !nextVisited.contains($0) }
        guard !children.isEmpty else { return 0 }
        return 1 + (children.map { maxDescendantDepth(of: $0, visited: nextVisited) }.max() ?? 0)
    }

    public func descendantIds(of id: UUID) -> Set<UUID> {
        var result: Set<UUID> = []
        var stack = childIds(of: id)
        while let next = stack.popLast() {
            guard next != id, result.insert(next).inserted else { continue }
            stack.append(contentsOf: childIds(of: next))
        }
        return result
    }

    public func pathIds(to id: UUID) -> [UUID] {
        var path: [UUID] = []
        var current: UUID? = id
        var visited: Set<UUID> = []
        while let node = current, entries[node] != nil, visited.insert(node).inserted {
            path.insert(node, at: 0)
            current = entries[node]?.parentId
        }
        return path
    }

    public func pathNames(to id: UUID) -> [String] {
        pathIds(to: id).compactMap { entries[$0]?.name }
    }

    public enum PlacementProblem: Sendable {
        case cycle
        case depthExceeded
        case missingParent
    }

    public func placementProblem(_ groupId: UUID, under parentId: UUID?) -> PlacementProblem? {
        if let parentId {
            guard parentId != groupId, !descendantIds(of: groupId).contains(parentId) else { return .cycle }
            guard entries[parentId] != nil else { return .missingParent }
        }
        let subtree = entries[groupId] == nil ? 0 : maxDescendantDepth(of: groupId)
        guard depth(of: parentId) + 1 + subtree <= Self.maxNestingDepth else { return .depthExceeded }
        return nil
    }

    public func canPlace(_ groupId: UUID, under parentId: UUID?) -> Bool {
        placementProblem(groupId, under: parentId) == nil
    }

    public static func cyclicGroupIds<Group: LibraryGroupRepresentable>(in groups: [Group]) -> Set<UUID> {
        var raw: [UUID: Entry] = [:]
        for group in groups where raw[group.id] == nil {
            raw[group.id] = Entry(id: group.id, name: group.name, parentId: group.parentId, sortOrder: group.sortOrder)
        }
        return cyclicIds(in: raw)
    }

    public func canCreateSubgroup(under parentId: UUID) -> Bool {
        entries[parentId] != nil && depth(of: parentId) < Self.maxNestingDepth
    }

    public func flattened(mode: LibrarySortMode = .manual) -> [FlatEntry] {
        var result: [FlatEntry] = []
        var visited: Set<UUID> = []
        func visit(_ parentId: UUID?, depth: Int) {
            for id in sortedChildIds(of: parentId, mode: mode) where visited.insert(id).inserted {
                result.append(FlatEntry(id: id, depth: depth))
                visit(id, depth: depth + 1)
            }
        }
        visit(nil, depth: 0)
        return result
    }

    private static func cyclicIds(in entries: [UUID: Entry]) -> Set<UUID> {
        var cyclic: Set<UUID> = []
        var acyclic: Set<UUID> = []
        for start in entries.keys {
            var path: [UUID] = []
            var onPath: Set<UUID> = []
            var current: UUID? = start
            while let node = current, let entry = entries[node] {
                if acyclic.contains(node) || cyclic.contains(node) { break }
                if onPath.contains(node) {
                    if let index = path.firstIndex(of: node) {
                        cyclic.formUnion(path[index...])
                    }
                    break
                }
                path.append(node)
                onPath.insert(node)
                current = entry.parentId
            }
            acyclic.formUnion(path.filter { !cyclic.contains($0) })
        }
        return cyclic
    }
}

```

### Core Architecture Module: `Packages/TableProCore/Sources/TableProConnectionLibrary/LibraryModels.swift`
```
import Foundation

public protocol LibraryConnectionRepresentable {
    var id: UUID { get }
    var name: String { get }
    var host: String { get }
    var database: String { get }
    var username: String { get }
    var libraryTypeName: String { get }
    var groupId: UUID? { get }
    var tagIds: [UUID] { get }
    var sortOrder: Int { get }
    var isFavorite: Bool { get }
}

public protocol LibraryGroupRepresentable {
    var id: UUID { get }
    var name: String { get }
    var parentId: UUID? { get }
    var sortOrder: Int { get }
}

public protocol LibraryTagRepresentable {
    var id: UUID { get }
    var name: String { get }
}

public enum LibrarySortMode: String, Codable, CaseIterable, Sendable {
    case manual
    case name
    case databaseType
    case lastConnected
}

public enum LibraryTagMatch: String, Codable, CaseIterable, Sendable {
    case any
    case all
}

public struct LibraryQuery: Hashable, Sendable {
    public var text: String
    public var tagIds: Set<UUID>
    public var tagMatch: LibraryTagMatch

    public init(text: String = "", tagIds: Set<UUID> = [], tagMatch: LibraryTagMatch = .any) {
        self.text = text
        self.tagIds = tagIds
        self.tagMatch = tagMatch
    }

    public var trimmedText: String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public var isActive: Bool {
        !trimmedText.isEmpty || !tagIds.isEmpty
    }

    public var hasTextTerm: Bool {
        !trimmedText.isEmpty
    }
}

public enum LibrarySectionKind: String, Codable, CaseIterable, Sendable {
    case favorites
    case recent
    case connections
    case linkedFolders
    case teamLibrary

    public var acceptsSavedConnections: Bool {
        switch self {
        case .favorites, .recent, .connections:
            return true
        case .linkedFolders, .teamLibrary:
            return false
        }
    }
}

public enum LibraryRowID: Hashable, Sendable {
    case section(LibrarySectionKind)
    case group(UUID)
    case connection(UUID, section: LibrarySectionKind)
}

public indirect enum LibraryNode: Hashable, Sendable {
    case group(id: UUID, children: [LibraryNode], connectionCount: Int)
    case connection(id: UUID)

    public func rowID(in section: LibrarySectionKind) -> LibraryRowID {
        switch self {
        case .group(let id, _, _):
            return .group(id)
        case .connection(let id):
            return .connection(id, section: section)
        }
    }

    public var children: [LibraryNode] {
        switch self {
        case .group(_, let children, _):
            return children
        case .connection:
            return []
        }
    }

    public var connectionCount: Int {
        switch self {
        case .group(_, _, let count):
            return count
        case .connection:
            return 1
        }
    }
}

public struct LibrarySection: Hashable, Sendable {
    public let kind: LibrarySectionKind
    public let nodes: [LibraryNode]

    public init(kind: LibrarySectionKind, nodes: [LibraryNode]) {
        self.kind = kind
        self.nodes = nodes
    }
}

public struct LibraryOutline: Hashable, Sendable {
    public let sections: [LibrarySection]
    public let groupIdsExpandedByQuery: Set<UUID>
    public let isQueryActive: Bool

    public init(sections: [LibrarySection], groupIdsExpandedByQuery: Set<UUID>, isQueryActive: Bool) {
        self.sections = sections
        self.groupIdsExpandedByQuery = groupIdsExpandedByQuery
        self.isQueryActive = isQueryActive
    }

    public static let empty = LibraryOutline(sections: [], groupIdsExpandedByQuery: [], isQueryActive: false)

    public func section(_ kind: LibrarySectionKind) -> LibrarySection? {
        sections.first { $0.kind == kind }
    }

    public var isEmpty: Bool {
        sections.allSatisfy { $0.nodes.isEmpty }
    }

    public func connectionIds(in kind: LibrarySectionKind) -> [UUID] {
        guard let section = section(kind) else { return [] }
        return Self.connectionIds(in: section.nodes)
    }

    public var connectionIdsInDisplayOrder: [UUID] {
        var seen: Set<UUID> = []
        return sections
            .flatMap { Self.connectionIds(in: $0.nodes) }
            .filter { seen.insert($0).inserted }
    }

    private static func connectionIds(in nodes: [LibraryNode]) -> [UUID] {
        nodes.flatMap { node -> [UUID] in
            switch node {
            case .connection(let id):
                return [id]
            case .group(_, let children, _):
                return connectionIds(in: children)
            }
        }
    }
}

public struct LibraryExternalEntry: Hashable, Sendable {
    public let id: UUID
    public let name: String
    public let host: String
    public let database: String
    public let username: String
    public let typeName: String

    public init(id: UUID, name: String, host: String, database: String, username: String, typeName: String) {
        self.id = id
        self.name = name
        self.host = host
        self.database = database
        self.username = username
        self.typeName = typeName
    }
}

public struct LibraryExternalSection: Hashable, Sendable {
    public let kind: LibrarySectionKind
    public let entries: [LibraryExternalEntry]

    public init(kind: LibrarySectionKind, entries: [LibraryExternalEntry]) {
        self.kind = kind
        self.entries = entries
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3250** (2026-10-03): **UI: Improve icon consistency**
  *Symptoms*: ### What happened?  The icon styles across the data table UI currently feel inconsistent. Some icons use a filled/solid style, while others use an outline style. There are also differences in stroke weight, visual size, alignment, and button treatment.  This makes the overall visual language feel a bit inconsistent. It would be good to standardize the icon usage across the UI, including: - Use a consistent icon style, preferably avoiding a mix of filled and outline icons unless it represents a specific state - Use the same icon set where possible - Keep icon size and stroke weight consistent - Standardize icon button size, border radius, padding, and spacing - Use a consistent pattern for buttons with dropdown menus This should help make the interface feel more cohesive and polished.  <img width="1139" height="946" alt="Image" src="https://github.com/user-attachments/assets/6d141bd1-d1a4-477e-8601-21eb1c79aa62" />  <img width="871" height="64" alt="Image" src="https://github.com/user-attachments/assets/a1208172-4b81-4a79-b3c1-6326cf9c159c" />  ### Steps to reproduce  _No response_  ### Expected behavior  _No response_  ### Database type  None  ### TablePro version  0.77  ### macOS version & chip  _No response_  ### Screenshots / Logs  _No response_

- **Issue #3249** (2026-10-03): **UI: Incorrect selected state style**
  *Symptoms*: ### What happened?  <img width="333" height="211" alt="Image" src="https://github.com/user-attachments/assets/44a970e9-4fa3-4d61-9135-70ddc5761ea1" />  ### Steps to reproduce  1. Click the **Database** option. 2. Switch to another database; it works as expected. 3. Close it. 4. Click the **Database** option again; the selected state is displayed incorrectly.  ### Expected behavior  _No response_  ### Database type  None  ### TablePro version  0.77  ### macOS version & chip  _No response_  ### Screenshots / Logs  _No response_

- **Issue #3244** (2026-10-03): **UI: Padding and gap feel visually unbalanced**
  *Symptoms*: ### What happened?  <img width="93" height="235" alt="Image" src="https://github.com/user-attachments/assets/d2d8171d-a58b-42f9-93ed-de791f69a5bd" />  Adjust the padding and gap so that the spacing between the container, icon, and text feels more balanced and visually compact.  ### Steps to reproduce  _No response_  ### Expected behavior  _No response_  ### Database type  None  ### TablePro version  0.77  ### macOS version & chip  _No response_  ### Screenshots / Logs  _No response_

- **Issue #3241** (2026-10-03): **[Oracle] Browsing an SDO_GEOMETRY table crashes OracleDriver with SIGTRAP**
  *Symptoms*: ### What happened?  TablePro terminates when browsing an Oracle spatial table containing an MDSYS.SDO_GEOMETRY column. This was verified on a real Oracle 12.1.0.2 database using read-only operations.  I reproduced two new process crashes during this investigation: opening the spatial table in the data view, and executing the ordered/paginated SELECT * below through TablePro MCP. Both generated new macOS crash reports with EXC_BREAKPOINT / SIGTRAP in OracleDriver, on nio.nioTransportServices.connectionchannel, with identical image offsets and decoder frames.  On another UI attempt, the app stayed open but displayed: "The server sent an unexpected message; the connection was reset. Please rerun the query." (translated from the Chinese UI).  Connection, schema/table metadata, and non-spatial reads all work. The tested table is partitioned and contains NUMBER, NVARCHAR2, a nullable SHAPE (SDO_GEOMETRY), and BLOB columns.  Server: Oracle Database 12c Enterprise Edition Release 12.1.0.2.0, 64-bit.  ### Steps to reproduce  Schema/table names and the ordinary identifier column below are anonymized. ID represents the first numeric column of the tested table.  1. Connect to an Oracle 12.1.0.2 database. 2. Open an existing spatial table containing MDSYS.SDO_GEOMETRY in the sidebar. The tested data view had a page size of 1,000. 3. TablePro may terminate during result decoding.  The following query independently reproduced the process crash:  ```sql SELECT * FROM "APP_SCHEMA"."SPATIAL_PO

- **Issue #3239** (2026-10-02): **Scrolling to the very beginning/end doesn't scroll the editor**
  *Symptoms*: ### What happened?  The editor doesn't follow the cursor when pressing `Cmd+<up,down>`, the universal shortcut to scroll the cursor to the very beggining/end.  ### Steps to reproduce  In a big text file, press `Cmd+Up` (or `Cmd+Down`): the cursor will move to the desired position, but the editor will be kept the visual at the same position.  ### Expected behavior  _No response_  ### Database type  None  ### TablePro version  0.77  ### macOS version & chip  _No response_  ### Screenshots / Logs  _No response_

- **Issue #3219** (2026-10-02): **Update a value in a table, give this error "Cannot update Identity column 'ID'."**
  *Symptoms*: ### What happened?  When I change a value in the table and commit it, I get this error:  <img width="204" height="169" alt="Image" src="https://github.com/user-attachments/assets/3a3a15df-7a4f-45e7-860b-935ab4edeffa" />  Here the query: `UPDATE [Enterprise_App_Approved] SET [Comment] = N'Test', [ID] = N'1890', [Application name] = N'APP_TEST', [Application ID] = N'cb86d4f6-d6f9-4181-a6b9-f78ffb3ef3ee', [Object ID] = N'0fa4401f-2faa-4293-a5ad-45f19d9ffb5f', [Date Approved] = N'2026-09-21 00:00:00', [Approved for] = N'test', [Approved by] = N'Test User', [Approved by - email] = N' ', [Servicedesk no.] = N'S 38429-333', [Servicedesk link] = NULL, [Ansvarlig] = NULL, [MultitenantCheck] = NULL WHERE [Comment] = N'Test' AND [ID] = N'1761' AND [Application name] = N'APP_TEST' AND [Application ID] = N'cb86d4f6-d6f9-4181-a6b9-f78ffb3ef3ee' AND [Object ID] = N'0fa4401f-2faa-4293-a5ad-45f19d9ffb5f' AND [Date Approved] = N'2026-09-21 00:00:00' AND [Approved for] = N'test' AND [Approved by] = N'Test User' AND [Approved by - email] = N' ' AND [Servicedesk no.] = N'S 38429-333' AND [Servicedesk link] IS NULL AND [Ansvarlig] IS NULL AND [MultitenantCheck] IS NULL;`  And here the table structure:  <img width="1214" height="400" alt="Image" src="https://github.com/user-attachments/assets/0ceae087-e2ce-4f16-954c-019f20244cbb" />  ### Steps to reproduce  1. Open the table  2. change any value in the table 3. Commit it 4.   ### Expected behavior  _No response_  ### Database type  None  ### TableP

- **Issue #3166** (2026-09-28): **Failed to connect to DB on 443 port**
  *Symptoms*: ### What happened?  There is an error when i try to connect to Trino on 443 port ``` HTTP 400: <html> <head><title>400 The plain HTTP request was sent to HTTPS port</title></head> <body> <center><h1>400 Bad Request</h1></center> <center>The plain HTTP request was sent to HTTPS port</center> <hr><center>nginx</center> </body> </html> ``` DB: trino url: jdbc:trino://my.domain.com:443  DBeaver works well with driver: Trino JDBC Driver 483  ### Steps to reproduce  _No response_  ### Expected behavior  _No response_  ### Database type  N/A  ### TablePro version  0.75.0  ### macOS version & chip  macOS 26.6.2 / Apple Silicon  ### Screenshots / Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > That was really fast.. Thank you!

- **Issue #3132** (2026-09-26): **Can't create,edit or remove properties from MongoDB database. Why??????**
  *Symptoms*: ### What happened?  Where is the UI controls to add, edit and remove properties into MongoDB collection??????  <img width="1249" height="307" alt="Image" src="https://github.com/user-attachments/assets/05c678f6-2388-4caa-a289-d464d476dd8c" />  ### Steps to reproduce  1. Open MongoDB connection 2. Create a new database 3. Type the first collection name 4. it creates the database with single collection and single property: ObjectId 5. You can't do anything with it.  ### Expected behavior  The software should be able to handle and manage MongoDB collections and databases  ### Database type  MongoDB  ### TablePro version  0.75.0  ### macOS version & chip  macOS 27.0 / Apple Silicon  ### Screenshots / Logs  _No response_

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

### Incident Patch 1: `97d2ad28` (2026-10-06)
**Commit Message**: fix(connections): keep one connection per database, no reconnect (#3271) 

Signed-off-by: Dat Ngo Quoc <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -7,8 +7,16 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Changed
+
+- PostgreSQL, Redshift and CockroachDB keep one connection per database in the connections strip, and send TCP keepalives so idle ones stay open.
+
 ### Fixed
 
+- Switching between two databases of a PostgreSQL connection reconnecting each time and dropping the open transaction and temp tables.
+- A tab on a database the connection had switched away from running on a shared connection that closed after 10 minutes idle.
+- Import and Copy To committing a transaction left open on the target connection.
+- Health check reconnecting a PostgreSQL session that was sitting in a failed transaction.
 - Each switch between connections in the connections strip reloading that connection's schema.
 - Opening a connection fetching every column of its schema twice.
 - Unsaved grid edits not kept with their tab after jumping to a tab of a background connection.
```

**File**: `Plugins/PostgreSQLDriverPlugin/LibPQConnectionLoss.swift` (modified, +32/-0)
```diff
@@ -51,6 +51,38 @@ enum LibPQServerMessage {
     }
 }
 
+/// How a health check asks whether a session is still there without disturbing what the user has
+/// open in it.
+internal enum LibPQSessionCheck {
+    static let statement = "SELECT 1"
+
+    /// Never inside a transaction block. In an aborted one the server refuses every statement with
+    /// `25P02` while the session is fine, and in an open one a statement can take a repeatable-read
+    /// snapshot early and resets `idle_in_transaction_session_timeout`. Reading the socket, which
+    /// the caller does first, still sees a server that closed the session.
+    static func sendsStatement(in state: LibPQTransactionState) -> Bool {
+        switch state {
+        case .inTransaction, .inError:
+            return false
+        case .idle, .active, .unknown:
+            return true
+        }
+    }
+
+    /// The SQLSTATE of a server that refused the check statement, or nil when the failure is not
+    /// the server's answer. libpq's own failures carry no SQLSTATE and a lost session arrives as
+    /// `LibPQConnectionLostError`. A FATAL carries a SQLSTATE too, so the caller also requires
+    /// `PQstatus` to read `CONNECTION_OK` afterwards: `PQexec` reads past a FATAL to the closed
+    /// socket and turns it `CONNECTION_BAD`.
+    static func refusalState(of error: Error) -> String? {
+        guard let error = error as? LibPQPluginError,
+              let sqlState = error.sqlState,
+              !sqlState.isEmpty
+        else { return nil }
+        return sqlState
+    }
+}
+
 enum LibPQConnectionLoss: Sendable, Equatable {
     case beforeSending(transactionMayBeOpen: Bool)
     case afterSending
```

**File**: `Plugins/PostgreSQLDriverPlugin/LibPQConnectionString.swift` (modified, +13/-0)
```diff
@@ -74,6 +74,18 @@ internal enum LibPQConnectionString {
     static let sessionApplicationName = "TablePro"
     static let metadataApplicationName = "TablePro Metadata"
 
+    /// Left to the kernel, macOS sends the first keepalive after 7,200 s of idle, while an AWS
+    /// Network Load Balancer drops an idle flow after 350 s and an Azure Load Balancer silently after
+    /// 4 minutes. These keep a parked session's flow open and let the kernel declare a dead peer
+    /// about 90 s after the last traffic. `tcp_user_timeout` is left out: macOS has no
+    /// `TCP_USER_TIMEOUT`, so libpq accepts it and changes nothing.
+    static let keepaliveParameters: [(String, String)] = [
+        ("keepalives", "1"),
+        ("keepalives_idle", "60"),
+        ("keepalives_interval", "10"),
+        ("keepalives_count", "3")
+    ]
+
     static func build(
         host: String,
         port: Int,
@@ -100,6 +112,7 @@ internal enum LibPQConnectionString {
         if let connectTimeoutSeconds {
             parameters.append(("connect_timeout", String(max(connectTimeoutSeconds, 1))))
         }
+        parameters.append(contentsOf: keepaliveParameters)
 
         parameters.append(("sslmode", LibPQSSLMapping.sslmode(for: sslConfig.mode)))
         if sslConfig.verifiesCertificate, !sslConfig.caCertificatePath.isEmpty {
```

**File**: `Plugins/PostgreSQLDriverPlugin/LibPQDriverCore.swift` (modified, +1/-1)
```diff
@@ -164,7 +164,7 @@ final class LibPQDriverCore: @unchecked Sendable {
         guard let pqConn = libpqConnection else {
             throw LibPQPluginError.notConnected
         }
-        _ = try await pqConn.executeQuery("SELECT 1")
+        try await pqConn.ping()
     }
 
     // MARK: - Query Execution
```

**File**: `Plugins/PostgreSQLDriverPlugin/LibPQPluginConnection.swift` (modified, +24/-0)
```diff
@@ -658,6 +658,30 @@ final class LibPQPluginConnection: @unchecked Sendable {
         return Self.transactionState(PQtransactionStatus(conn))
     }
 
+    /// libpq has no round trip that sends no statement, so the socket is read first: that sees a
+    /// server that closed the session, and inside a transaction block it is the whole check
+    /// (`LibPQSessionCheck.sendsStatement`). A statement the server refuses still proves the
+    /// backend answered, so it does not fail the ping.
+    func ping() async throws {
+        try await pluginDispatchAsync(on: queue) { [self] in
+            guard !isShuttingDown, let conn = connectionHandle else { throw LibPQPluginError.notConnected }
+            if let ended = sessionEndedBeforeSending(conn) { throw ended }
+            guard LibPQSessionCheck.sendsStatement(in: transactionStateOnQueue()) else { return }
+            do {
+                if let deadline = activeConnectDeadline {
+                    _ = try executeConnectQuerySync(LibPQSessionCheck.statement, deadline: deadline)
+                } else {
+                    _ = try executeQuerySync(LibPQSessionCheck.statement)
+                }
+            } catch {
+                guard PQstatus(conn) == CONNECTION_OK,
+                      let sqlState = LibPQSessionCheck.refusalState(of: error)
+                else { throw error }
+                Self.logger.info("Ping refused with SQLSTATE \(sqlState, privacy: .public) on a live session")
+            }
+        }
+    }
+
     func boundedQuery(_ query: String, rowCap: Int) async throws -> LibPQPluginQueryResult {
         let queryToRun = String(query)
         let cap = max(rowCap, 1)
```

**File**: `TablePro/Core/Concurrency/SessionDriverGate.swift` (modified, +55/-29)
```diff
@@ -5,12 +5,16 @@
 
 import Foundation
 
-/// Serialises access to a connection's single shared driver.
+/// Serialises access to a connection's shared session drivers.
 ///
 /// The driver carries one mutable position (its current database and schema), so an
 /// operation has to move it before it runs. Without ordering, two windows interleave
 /// their moves and each runs against the other's database.
 ///
+/// A connection that keeps one driver per database (see `SessionLanes`) takes one turn per
+/// database: each of those drivers sits on its own database for good, so work on two databases
+/// never has to wait for the other, while two operations on one database still take turns.
+///
 /// The body runs inline in the caller's own task rather than in a detached one, so
 /// cancellation still reaches the work.
 ///
@@ -19,97 +23,119 @@ import Foundation
 /// release must not free or hand off a turn a later session has taken since.
 @MainActor
 final class SessionDriverGate {
+    /// One turn per connection, or per database of a connection that keeps a driver per database.
+    struct Key: Hashable {
+        let connectionId: UUID
+        let database: String?
+    }
+
     private struct Waiter {
         let ticket: UUID
         let continuation: CheckedContinuation<Void, Error>
     }
 
-    private var owners: [UUID: UUID] = [:]
-    private var waiters: [UUID: [Waiter]] = [:]
+    private var owners: [Key: UUID] = [:]
+    private var waiters: [Key: [Waiter]] = [:]
 
     func withExclusiveAccess<T>(
         _ connectionId: UUID,
         _ body: () async throws -> T
     ) async throws -> T {
-        let ticket = try await acquire(connectionId)
-        defer { release(connectionId, ticket: ticket) }
+        try await withExclusiveAccess(Key(connectionId: connectionId, database: nil), body)
+    }
+
+    func withExclusiveAccess<T>(
+        _ key: Key,
+        _ body: () async throws -> T
+    ) async throws -> T {
+        let ticket = try await acquire(key)
+        defer { release(key, ticket: ticket) }
         return try await body()
     }
 
+    /// Whether a turn is running on `key`, which for a connection's own driver is proof that it is
+    /// answering without asking it again.
+    func isHeld(_ key: Key) -> Bool {
+        owners[key] != nil
+    }
+
     #if DEBUG
     /// How many callers are queued behind the holder, so a test can wait for one to reach the
     /// gate instead of guessing how many scheduler turns that takes.
     internal func waiterCount(for connectionId: UUID) -> Int {
-        waiters[connectionId]?.count ?? 0
+        waiters.filter { $0.key.connectionId == connectionId }.values.reduce(0) { $0 + $1.count }
     }
     #endif
 
-    /// Releases a connection that is going away, failing everyone still queued for it.
+    /// Releases a connection that is going away, failing everyone still queued for any of its turns.
     func drain(connectionId: UUID) {
-        owners.removeValue(forKey: connectionId)
-        let pending = waiters.removeValue(forKey: connectionId) ?? []
-        for waiter in pending {
-            waiter.continuation.resume(throwing: CancellationError())
+        let keys = Set(owners.keys).union(waiters.keys).filter { $0.connectionId == connectionId }
+        for key in keys {
+            owners.removeValue(forKey: key)
+            let pending = waiters.removeValue(forKey: key) ?? []
+            for waiter in pending {
+                waiter.continuation.resume(throwing: CancellationError())
+            }
         }
     }
 
-    private func acquire(_ connectionId: UUID) async throws -> UUID {
+    private func acquire(_ key: Key) async throws -> UUID {
         let ticket = UUID()
-        guard owners[connectionId] != nil else {
-            owners[connectionId] = ticket
+        guard owners[key] != nil else {
+            owners[key] = ticket
             return ticket
         }
         try await withTaskCancellationHandler(
-            operation: { try await enqueue(ticket: ticket, connectionId: connectionId) },
+            operation: { try await enqueue(ticket: ticket, key: key) },
             onCancel: { [weak self] in
                 Task { @MainActor in
-                    self?.failWaiter(ticket: ticket, connectionId: connectionId)
+                    self?.failWaiter(ticket: ticket, key: key)
                 }
             }
         )
         /// A hand-off resumes this caller before it runs, so a drain can land in between, and the
         /// turn it was handed ended with that drain.
-        guard owners[connectionId] == ticket else {
+        guard owners[key] == ticket else {
             throw CancellationError()
         }
         return ticket
     }
 
-    private func enqueue(ticket: UUID, connectionId: UUID) async throws {
+    private func enqueue(ticket: UUID, key: Key) async throws {
         try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
```

**File**: `TablePro/Core/Database/DatabaseManager+Health.swift` (modified, +29/-5)
```diff
@@ -58,6 +58,7 @@ extension DatabaseManager {
                     Self.logger.debug("Ping skipped — no active driver for \(connectionId)")
                     return false
                 }
+                await self.notePinged(mainDriver, for: connectionId)
                 do {
                     try await mainDriver.ping()
                     await self.markSessionVerified(connectionId)
@@ -69,7 +70,10 @@ extension DatabaseManager {
             },
             reconnectHandler: { [weak self] in
                 guard let self else { return .abort }
-                return await self.performHealthMonitorReconnect(connectionId: connectionId)
+                return await self.performHealthMonitorReconnect(
+                    connectionId: connectionId,
+                    failedDriver: await self.pingedDriver(for: connectionId)
+                )
             },
             onStateChanged: { [weak self] id, state in
                 guard let self else { return }
@@ -112,19 +116,33 @@ extension DatabaseManager {
     /// is not a teardown, and clearing the cache here leaves the sidebar and autocomplete empty
     /// with nothing scheduled to refill them. Success publishes `databaseDidConnect` so the same
     /// listeners that reload after a first connect or a manual reconnect run here too.
-    internal func performHealthMonitorReconnect(connectionId: UUID) async -> ConnectionHealthMonitor.ReconnectOutcome {
+    internal func performHealthMonitorReconnect(
+        connectionId: UUID,
+        failedDriver: ObjectIdentifier? = nil
+    ) async -> ConnectionHealthMonitor.ReconnectOutcome {
         guard let session = activeSessions[connectionId] else { return .abort }
+        /// The check that failed was made on one driver, and a database switch may have parked it and
+        /// put another one in its place since. Reconnecting now would disconnect the connection the
+        /// user just moved onto, with its transaction; the parked one is checked again before use.
+        if let failedDriver, let current = session.driver, ObjectIdentifier(current) != failedDriver {
+            return .success
+        }
         /// The driver this attempt is replacing. Every give-up below is fenced on it, because a
         /// reconnect blocked inside a C call cannot be cancelled and completes late: without the
         /// fence, a losing attempt would report a connection unreachable that a later one restored.
         let attemptedDriver = session.driver
-        await SchemaService.shared.prepareForReload(connectionId: connectionId)
-        await DatabaseTreeMetadataService.shared.handleReconnect(connectionId: connectionId)
         /// A connection that stopped answering has most likely taken its pooled connections with it,
         /// and a rebuilt tunnel moves every one of them to a new port, so pooled work waits for the
-        /// replacement rather than dialing what is being torn down.
+        /// replacement rather than dialing what is being torn down. Begun before anything suspends,
+        /// so a database switch cannot promote another connection in the meantime.
         MetadataConnectionPool.shared.beginTransportReplacement(connectionId: connectionId)
         defer { MetadataConnectionPool.shared.endTransportReplacement(connectionId: connectionId) }
+        await SchemaService.shared.prepareForReload(connectionId: connectionId)
+        await DatabaseTreeMetadataService.shared.handleReconnect(connectionId: connectionId)
+        /// Asked again after the suspensions above: a switch that landed before the replacement
+        /// began installed another database's connection, which must not be disconnected for a
+        /// failure it never had.
+        guard activeSessions[connectionId]?.driver === attemptedDriver else { return .success }
 
         do {
             guard let result = try await trackOperation(sessionId: connectionId, operation: {
@@ -255,6 +273,9 @@ extension DatabaseManager {
         // Rebuild the tunnel if needed; otherwise reuse effective connection
         let connectionForDriver: DatabaseConnection
         if session.connection.activeTunnelKind != nil {
+            /// Rebuilding the tunnel moves it to a new local port, which strands every other
+            /// database's connection on the old one.
+            await sessionLanes.closeAllNotingLostTransactions(for: session.connection.id)
             connectionForDriver = try await buildEffectiveConnection(
                 for: session.connection,
                 deadline: deadline
@@ -377,6 +398,9 @@ extension DatabaseManager {
         let replacesPooledTransport = session.connection.activeTunnelKind != nil || session.liveness != .live
         if replacesPooledTransport {
             MetadataConnectionPool.shared.beginTransportReplacement(connectionId: sessionId)
+            /// The other databases' connections were dialed through the same transport, so they go
+            /// with it an
```

**File**: `TablePro/Core/Database/DatabaseManager+ScopedDriver.swift` (modified, +130/-13)
```diff
@@ -66,6 +66,15 @@ extension DatabaseManager {
         else {
             return .sessionDriver
         }
+        /// A database the user has browsed keeps its own session connection, so its tabs carry on in
+        /// the transaction, temp tables and settings they left there.
+        /// A database whose connection ended with a transaction still open takes the session path
+        /// once more, where that loss is reported before anything runs on a replacement.
+        if usesDatabaseLanes(session),
+           sessionLanes.parkedDriver(for: scope.connectionId, database: scope.database) != nil
+            || sessionLanes.hasTransactionLoss(database: scope.database, for: scope.connectionId) {
+            return .sessionDriver
+        }
         guard canPool(session) else {
             return .unavailable(
                 String(
@@ -289,7 +298,7 @@ extension DatabaseManager {
     /// serve the wrong database entirely. And one whose database lives inside the driver
     /// instance, rather than on a server it reconnects to, hands the pool a different database
     /// altogether: `supportsConnectionPooling` is how those opt out.
-    private func canPool(_ session: ConnectionSession) -> Bool {
+    internal func canPool(_ session: ConnectionSession) -> Bool {
         guard session.connection.type.supportsConnectionPooling else { return false }
         let actions = PluginMetadataRegistry.shared.snapshot(
             for: session.connection.type
@@ -300,6 +309,15 @@ extension DatabaseManager {
         }
     }
 
+    /// Whether browsing another database keeps one connection per database instead of reconnecting.
+    /// It takes an engine that has to reconnect to change database, and a server that accepts a
+    /// second connection to the same definition: the test pooling already answers.
+    internal func usesDatabaseLanes(_ session: ConnectionSession) -> Bool {
+        guard PluginMetadataRegistry.shared.snapshot(for: session.connection.type)?
+            .capabilities.requiresReconnectForDatabaseSwitch == true else { return false }
+        return canPool(session)
+    }
+
     /// Whether the connection is running work that must not be interrupted, whatever its age.
     internal func holdsProtectedWrite(_ connectionId: UUID) -> Bool {
         (runningDrivers[connectionId] ?? [:]).values.contains { $0.policy == .protectedWrite }
@@ -309,7 +327,7 @@ extension DatabaseManager {
         scope: DatabaseScope,
         _ body: @Sendable @escaping (DatabaseDriver) async throws -> T
     ) async throws -> T {
-        try await withSessionDriverTurn(connectionId: scope.connectionId) { driver in
+        try await withSessionDriverTurn(scope: scope) { driver in
             try await pin(driver, to: scope)
             return try await body(driver)
         }
@@ -322,7 +340,7 @@ extension DatabaseManager {
         scope: DatabaseScope,
         _ body: @Sendable @escaping (DatabaseDriver) async throws -> T
     ) async throws -> TableReadTurn<T> {
-        try await withSessionDriverTurn(connectionId: scope.connectionId) { driver in
+        try await withSessionDriverTurn(scope: scope) { driver in
             let route = executionRoute(for: scope)
             guard route == .sessionDriver else { return .moved(route) }
             try await pin(driver, to: scope)
@@ -331,32 +349,129 @@ extension DatabaseManager {
     }
 
     private func withSessionDriverTurn<R>(
-        connectionId: UUID,
+        scope: DatabaseScope,
         _ turn: (DatabaseDriver) async throws -> R
     ) async throws -> R {
-        /// Outside the gate on purpose. A verification that has to reconnect runs the whole
-        /// reconnect, which restores the schema and the database on the new driver, and doing that
-        /// while holding the gate would deadlock the very thing waiting to be pinned.
-        await verifyBeforeUse(connectionId)
+        let connectionId = scope.connectionId
+        let lane = activeSessions[connectionId].flatMap { laneDatabase(for: scope, in: $0) }
+        let startsOnBrowsed = lane == nil || lane == activeSessions[connectionId]?.resolvedBrowseDatabase
+        if startsOnBrowsed {
+            /// Outside the gate on purpose. A verification that has to reconnect runs the whole
+            /// reconnect, which restores the schema and the database on the new driver, and doing that
+            /// while holding the gate would deadlock the very thing waiting to be pinned.
+            await verifyBeforeUse(connectionId)
+        }
         /// A check that failed and could not recover left the driver installed and disconnected,
         /// so the presence of a driver below is not enough. Refusing here is the point of checking
         /// at all: without it the user's own work runs on a handle the app already knows is dead.
         guard isUsable(connectionId) else {
             throw DatabaseError.notConnected
         }
-        return try await sessionDriverGate
```

---

### Incident Patch 2: `38f3dd20` (2026-10-06)
**Commit Message**: fix(datagrid): keep the grid on screen while a table loads into a tab (#3270)

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -18,6 +18,12 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Assistant transcript, agent session highlight, inspector field edits and Redis key filter reset after a connection switch.
 - Structure tab stuck on a cancellation error after switching connection while it loaded.
 - File handle leaked on each switch to a SQLite or Beancount connection.
+- Blank results pane instead of the data grid while a table loads, or after its load error is dismissed.
+- Previous table's primary key or row count carried into the next table opened in its tab, so edits matched wrong rows.
+- Status bar stuck on Loading after cancelling a Safe Mode (Full) confirmation for a table.
+- Approving a Safe Mode (Full) confirmation running that table's query in a tab opened from a link meanwhile.
+- Restored table tab that never loads when another tab was opened before its window came forward.
+- Save writing a table's query into the SQL file whose tab the table was opened over.
 
 ## [0.77.2] - 2026-10-05
 
```

**File**: `TablePro/Models/Query/QueryResultPresentation.swift` (modified, +13/-2)
```diff
@@ -119,7 +119,12 @@ struct QueryResultPresentation: Equatable {
 
         if inputs.isExplainResult { return .queryPlan }
 
-        if inputs.isExecuting, inputs.loadedColumnCount == 0 { return .executing }
+        /// A table's grid is its own placeholder, so it stays mounted while the first page loads. A
+        /// retarget empties the buffer before the fetch claims the tab, and dropping the grid there
+        /// blanked the pane for the whole fetch and took the grid's first responder with it.
+        if inputs.isExecuting, inputs.loadedColumnCount == 0, !Self.keepsGridWhileLoading(inputs) {
+            return .executing
+        }
 
         if inputs.viewMode == .output, !inputs.isExecuting, !inputs.activeResultServerOutput.isEmpty {
             return .serverOutput(inputs.activeResultServerOutput)
@@ -177,7 +182,9 @@ struct QueryResultPresentation: Equatable {
 
         guard inputs.loadedColumnCount == 0 else { return resolveEmptyRows(inputs) }
         guard resolvedError(inputs) == nil else { return nil }
-        guard inputs.resultSetCount > 0 else { return .idle }
+        /// A failed table load leaves no result set, and dismissing its banner removes the error, so
+        /// this state is a table that has not loaded rather than a statement that ran.
+        guard inputs.resultSetCount > 0 else { return inputs.tabType == .table ? nil : .idle }
 
         return .statementSucceeded(
             rowsAffected: inputs.executionRowsAffected,
@@ -187,6 +194,10 @@ struct QueryResultPresentation: Equatable {
         )
     }
 
+    private static func keepsGridWhileLoading(_ inputs: QueryResultInputs) -> Bool {
+        inputs.tabType == .table && inputs.viewMode == .data
+    }
+
     /// Columns without rows. A filtered table that filtered everything away keeps the grid, because
     /// the filter chrome is what the reader needs in order to get their rows back.
     private static func resolveEmptyRows(_ inputs: QueryResultInputs) -> QueryResultContent? {
```

**File**: `TablePro/Models/Query/QueryTab+Protection.swift` (modified, +4/-3)
```diff
@@ -10,11 +10,12 @@ extension QueryTab {
         execution.lastExecutedAt != nil
     }
 
-    /// A query tab the user has invested work in, either by typing into it or by running it.
-    /// A tab holding query work must not be silently reused in place.
+    /// A query tab the user has invested work in, by typing into it, running it or opening a file
+    /// into it. A tab holding query work must not be silently reused in place. An empty file counts:
+    /// a table that took its tab over kept the file, and saving wrote the table's query into it.
     var holdsQueryWork: Bool {
         guard tabType == .query else { return false }
-        return hasQueryText || hasExecutedQuery
+        return hasQueryText || hasExecutedQuery || content.sourceFileURL != nil
     }
 
     /// Whether closing this tab loses something worth bringing back. Only the text of a query
```

**File**: `TablePro/Models/Query/QueryTabManager.swift` (modified, +13/-7)
```diff
@@ -603,8 +603,19 @@ final class QueryTabManager: ObservableObject {
         var tab = tabs[selectedIndex]
         tab.tabType = .table
         tab.title = Self.tabTitle(name: tableName, schema: schemaName, databaseType: databaseType)
-        tab.tableContext.tableName = tableName
-        tab.content.query = query
+        /// Built whole rather than field by field: a field left over describes the previous table,
+        /// and its primary keys were what a keyless table's edits matched rows on.
+        tab.tableContext = TabTableContext(
+            tableName: tableName,
+            databaseName: databaseName,
+            schemaName: schemaName,
+            isEditable: !isView,
+            isView: isView,
+            objectType: objectType
+        )
+        /// Fresh for the same reason. A query tab keeps the file it was opened from, and a table
+        /// carried that binding, so Save wrote the table's query into the file.
+        tab.content = TabQueryContent(query: query)
         tab.schemaVersion += 1
         tab.execution.executionTime = nil
         tab.execution.statusMessage = nil
@@ -619,9 +630,6 @@ final class QueryTabManager: ObservableObject {
         tab.cellSelection = .empty
         tab.pendingChanges = TabChangeSnapshot()
         tab.hasUserInteraction = false
-        tab.tableContext.isView = isView
-        tab.tableContext.objectType = objectType
-        tab.tableContext.isEditable = !isView
         tab.filterState = TabFilterState()
         tab.columnLayout = ColumnLayoutState()
         tab.pagination = PaginationState(pageSize: pageSize)
@@ -632,8 +640,6 @@ final class QueryTabManager: ObservableObject {
         tab.restoredPage = nil
         tab.restoredPageSize = nil
         tab.restoredRowAnchor = nil
-        tab.tableContext.databaseName = databaseName
-        tab.tableContext.schemaName = schemaName
         tab.isPreview = isPreview
         tabs[selectedIndex] = tab
         tabStructureVersion += 1
```

**File**: `TablePro/Models/Query/TabSessionRegistry.swift` (modified, +6/-0)
```diff
@@ -115,6 +115,12 @@ final class TabSessionRegistry {
         ensureSession(for: tabId).freshness.record(change)
     }
 
+    /// For a tab pointed at another table. Its marks describe the table it showed before, and a
+    /// definition mark makes the next table's first page wait for a schema fetch it does not need.
+    func forgetFreshness(for tabId: UUID) {
+        sessions[tabId]?.freshness = TableFreshness()
+    }
+
     func pendingChange(for tabId: UUID) -> TableFreshness.Change? {
         sessions[tabId]?.freshness.pendingChange
     }
```

**File**: `TablePro/Views/Main/Child/ExecutingResultPane.swift` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+//
+//  ExecutingResultPane.swift
+//  TablePro
+//
+
+import SwiftUI
+
+/// The results pane while a run has nothing loaded to draw yet.
+///
+/// The gate sits on a view that is always there. Hung on a group that stays empty until revealed,
+/// as `LoadingReveal` does, its task never starts and the spinner never appears; the empty group
+/// also takes no height, which pulled the status bar up into the middle of the pane.
+struct ExecutingResultPane: View {
+    @State private var showsProgress = false
+
+    var body: some View {
+        Group {
+            if showsProgress {
+                ProgressView()
+                    .accessibilityLabel(String(localized: "Loading…"))
+                    .accessibilityIdentifier("results-loading")
+            } else {
+                Color.clear
+            }
+        }
+        .frame(maxWidth: .infinity, maxHeight: .infinity)
+        .loadingRevealGate(isActive: true, isRevealed: $showsProgress)
+    }
+}
```

**File**: `TablePro/Views/Main/Child/MainEditorContentView.swift` (modified, +1/-1)
```diff
@@ -755,7 +755,7 @@ struct MainEditorContentView: View {
         case .idle:
             Spacer()
         case .executing:
-            Spacer()
+            ExecutingResultPane()
         case let .structure(tableName):
             structureContent(tab: tab, tableName: tableName)
         case .queryPlan:
```

**File**: `TablePro/Views/Main/Extensions/MainContentCoordinator+QueryTasks.swift` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@ extension MainContentCoordinator {
             guard tabExecution.settle(claim) else { return false }
             retireQueryTask(.claim(claim))
             pendingLoadTrigger = trigger
+            declineTableLoad(for: claim.tabId)
             return false
         }
     }
```

---

### Incident Patch 3: `a90d8be8` (2026-10-05)
**Commit Message**: fix(windows): reload nothing when switching back to a connection (#3269)

**File**: `.claude/rules/ui-lifecycle.md` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ paths:
 # Views and lifecycle
 
 - **Appearance is not lifetime.** Switching connection unparents a pane without destroying it, so `onDisappear` fires on every switch; release there only what `onAppear` rebuilds. Real teardown belongs in `dismantleNSViewController` or `ConnectionWorkspace.teardown()`.
+- **The same holds on the way back.** Re-adding a pane fires `onAppear` again and restarts every `.task` and `.task(id:)`, even with an unchanged id, while `@State` survives. A load, a fetch, a cache reset or a one-time setup started there must be idempotent in its owner: skip what is already loaded, and record a load as done only when it finished, so a load cancelled by a switch runs again on return. Work that must outlive the pane, like the initial schema load, is an unstructured task the coordinator owns.
 - **A popover that edits data owns its editing model**: a `@State` copy seeded in `init`, with edits reported through a callback. A popover's content does not re-render when the view presenting it does.
 - **A coupled edit is one whole-value write** through a model method (`HighlightRule.selectingOperator(_:)` is the shape), never two field writes through a `Binding`: the second resolves against the same stale value and the first is lost.
 - **Never put `.accessibilityIdentifier` on a SwiftUI container alone**; it replaces every descendant's identifier in that hosting tree. Pair it with `.accessibilityElement(children: .contain)` first.
```

**File**: `CHANGELOG.md` (modified, +12/-0)
```diff
@@ -7,6 +7,18 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Fixed
+
+- Each switch between connections in the connections strip reloading that connection's schema.
+- Opening a connection fetching every column of its schema twice.
+- Unsaved grid edits not kept with their tab after jumping to a tab of a background connection.
+- Users & Roles discarding staged changes and Undo after switching tab or connection.
+- Object source, ClickHouse parts, chart and map reloading after switching connection and back, and the map losing zoom.
+- History drawer dropping loaded pages and the selected entry after switching connection and back.
+- Assistant transcript, agent session highlight, inspector field edits and Redis key filter reset after a connection switch.
+- Structure tab stuck on a cancellation error after switching connection while it loaded.
+- File handle leaked on each switch to a SQLite or Beancount connection.
+
 ## [0.77.2] - 2026-10-05
 
 ### Added
```

**File**: `TablePro/Core/Services/Infrastructure/MainSplitViewController.swift` (modified, +9/-1)
```diff
@@ -647,14 +647,22 @@ internal final class MainSplitViewController: NSSplitViewController {
         /// so the first switch away from it found no cached coordinator to resign: it kept
         /// `isKeyWindow` and never scheduled the eviction.
         let incoming = workspaces.selected?.sessionState?.coordinator
+        var handedOffKey = false
         for workspace in workspaces.workspaces {
             guard let coordinator = workspace.sessionState?.coordinator,
                   coordinator !== incoming,
                   coordinator.isKeyWindow else { continue }
             coordinator.handleWindowDidResignKey()
+            handedOffKey = true
         }
+        /// Key status is handed over, never invented. A window that is not key can still change its
+        /// selection, and marking that connection key kept its row eviction from ever being
+        /// scheduled and let a deferred restore load in a window nobody was looking at. The real
+        /// `windowDidBecomeKey` reaches whichever connection is selected when the window comes forward.
         if lastActiveCoordinator !== incoming {
-            incoming?.handleWindowDidBecomeKey()
+            if handedOffKey || view.window?.isKeyWindow == true {
+                incoming?.handleWindowDidBecomeKey()
+            }
             lastActiveCoordinator = incoming
         }
 
```

**File**: `TablePro/Core/Services/Query/SchemaLoadPolicy.swift` (modified, +44/-0)
```diff
@@ -29,4 +29,48 @@ enum SchemaLoadPolicy {
         guard hasLiveDriver else { return .awaitConnection }
         return .surface(error.localizedDescription)
     }
+
+    /// What a connection's content appearing asks of its schema.
+    ///
+    /// Appearance is not a connect: switching connection in a window takes a pane out of the window
+    /// and puts it back, which runs every `onAppear` again. Only a catalog or an autocomplete
+    /// provider that is not there yet is work; one that is loaded stays as it is, and a failed one
+    /// waits for the sidebar's Retry rather than being retried by a click on another connection.
+    static func activationAction(
+        hasLiveDriver: Bool,
+        catalog: SchemaState,
+        autocompletePopulated: Bool,
+        loadInFlight: Bool
+    ) -> SchemaActivationAction {
+        guard !loadInFlight else { return .none }
+        guard hasLiveDriver else { return .awaitConnection }
+        switch catalog {
+        case .idle:
+            return .load
+        case .loading, .failed:
+            return .none
+        case .loaded:
+            return autocompletePopulated ? .none : .load
+        }
+    }
+}
+
+extension SchemaLoadPolicy {
+    /// Whether a schema load already running answers a connect, so the connect's own refresh can
+    /// wait for it instead of fetching everything a second time. Only a load reading through the
+    /// driver that just connected does: one started on the driver a reconnect replaced can finish
+    /// with that driver's catalog still loaded.
+    static func inFlightLoadCoversConnect(
+        loadDriver: (any DatabaseDriver)?,
+        connectedDriver: (any DatabaseDriver)?
+    ) -> Bool {
+        guard let loadDriver, let connectedDriver else { return false }
+        return loadDriver === connectedDriver
+    }
+}
+
+enum SchemaActivationAction: Equatable {
+    case none
+    case awaitConnection
+    case load
 }
```

**File**: `TablePro/Core/Services/Query/SchemaProviderRegistry.swift` (modified, +4/-0)
```diff
@@ -64,6 +64,10 @@ final class SchemaProviderRegistry: CatalogChangeTarget {
         providers[scope]
     }
 
+    func isPopulated(_ scope: DatabaseScope) -> Bool {
+        providers[scope] != nil && loadedScopes.contains(scope)
+    }
+
     func getOrCreate(for scope: DatabaseScope) -> SQLSchemaProvider {
         let connectionId = scope.connectionId
         if let removalTask = removalTasks[connectionId] {
```

**File**: `TablePro/Core/Services/Query/SchemaService.swift` (modified, +9/-3)
```diff
@@ -565,8 +565,14 @@ final class SchemaService: ObservableObject {
     /// A load cut short by cancellation settles the kinds it put on a spinner, unless a newer load
     /// already owns them. Left alone, a cancel with no reload behind it kept those sections waiting
     /// on a fetch nothing was running.
-    private func abandonSideLoads(_ connectionId: UUID, generation: Int) {
+    private func abandonLoad(_ connectionId: UUID, generation: Int) {
         guard loadGenerations[connectionId] == generation else { return }
+        /// Nothing replaces a `.loading` that a cancelled load leaves behind: the object list shows a
+        /// spinner with no Retry, and every caller that loads only what is not loaded or loading
+        /// waits on it forever.
+        if case .loading = states[connectionId] {
+            states[connectionId] = .idle
+        }
         updateSideObjects(connectionId) { side in
             side.routines = side.routines.settled(by: .cancelled, discardingValue: false)
             side.triggers = side.triggers.settled(by: .cancelled, discardingValue: false)
@@ -875,7 +881,7 @@ final class SchemaService: ObservableObject {
             bumpGeneration(connectionId)
             tablesLoaded = true
         } catch is CancellationError {
-            abandonSideLoads(connectionId, generation: generation)
+            abandonLoad(connectionId, generation: generation)
             return
         } catch {
             guard isCurrentLoadGeneration(generation, for: connectionId, phase: "tables-failed") else {
@@ -968,7 +974,7 @@ final class SchemaService: ObservableObject {
                 try await driver.fetchSchemas()
             }
         } catch is CancellationError {
-            abandonSideLoads(connectionId, generation: generation)
+            abandonLoad(connectionId, generation: generation)
             return
         } catch {
             guard isCurrentLoadGeneration(generation, for: connectionId, phase: "hierarchical-failed") else {
```

**File**: `TablePro/Extensions/View+OnValueChange.swift` (modified, +5/-1)
```diff
@@ -44,11 +44,15 @@ private struct PairedValueChangeModifier<Value: Equatable>: ViewModifier {
     let value: Value
     let action: (Value, Value) -> Void
 
+    /// Seeded on the first appearance only. A pane re-attached after a workspace switch runs
+    /// `onAppear` before the change it missed while detached, so a reseed would swallow that change.
     @State private var previous: Value?
 
     func body(content: Content) -> some View {
         content
-            .onAppear { previous = value }
+            .onAppear {
+                if previous == nil { previous = value }
+            }
             .onChange(of: value) { current in
                 let old = previous ?? current
                 previous = current
```

**File**: `TablePro/ViewModels/HistoryPanelViewModel.swift` (modified, +3/-1)
```diff
@@ -69,9 +69,11 @@ final class HistoryPanelViewModel: ObservableObject {
     /// and a panel nobody can see has no reason to hold a subscription or refetch behind them.
     var isObserving: Bool { updateSubscription != nil }
 
+    /// A workspace switch or a collapsed drawer re-runs this on return. Refetch for what was recorded
+    /// while away, but keep the pages and selection the user had; only the first activation starts over.
     func activate() async {
         startObserving()
-        await reload()
+        await reload(preservingLoadedWindow: hasLoadedOnce)
     }
 
     func deactivate() {
```

---

### Incident Patch 4: `f2747660` (2026-10-05)
**Commit Message**: fix(ios): show why the Shortcuts table picker is empty (#3266)

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Copy To into PostgreSQL, SQLite, DuckDB or Oracle failing on an index name another table in the target schema already uses.
 - Crash when VoiceOver reads Settings > License while a license appears in it.
 - Pickers, checkboxes and fields that VoiceOver announced by role alone, such as in Copy To, Users & Roles and Create Table.
+- Shortcuts Table and Database or Schema pickers showing an empty list instead of why the connection failed.
 
 ## [0.77.2] - 2026-10-05
 
```

**File**: `TableProMobile/TableProMobile/Intents/DatabaseEntity.swift` (modified, +12/-3)
```diff
@@ -1,5 +1,6 @@
 import AppIntents
 import Foundation
+import TableProModels
 
 struct DatabaseEntity: AppEntity {
     static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Database or Schema")
@@ -31,11 +32,19 @@ struct DatabaseEntityQuery: EntityQuery {
     }
 
     func suggestedEntities() async throws -> [DatabaseEntity] {
-        guard let connection = selectedConnection else { return [] }
-        let namespaces = try? await IntentDatabaseSession.with(connectionId: connection.id) {
+        try await Self.namespaces(of: selectedConnection?.id)
+    }
+
+    /// Throws instead of listing nothing, for the same reason as the table picker: an empty list
+    /// would read as a server with no databases.
+    static func namespaces(
+        of connectionId: UUID?,
+        savedConnection: @Sendable (UUID) -> DatabaseConnection? = IntentConnectionLoader.connection(id:)
+    ) async throws -> [DatabaseEntity] {
+        guard let connectionId else { return [] }
+        return try await IntentDatabaseSession.with(connectionId: connectionId, savedConnection: savedConnection) {
             try await $0.namespaces()
         }
-        return namespaces ?? []
     }
 
     private var selectedConnection: ConnectionEntity? {
```

**File**: `TableProMobile/TableProMobile/Intents/IntentDatabaseSession.swift` (modified, +2/-3)
```diff
@@ -27,8 +27,6 @@ struct IntentDatabaseSession {
             secureStore: secureStore,
             sshProvider: sshProvider
         )
-        if connection.sshEnabled {
-        }
         do {
             let session = try await manager.connect(connection, prompter: nil)
             return IntentDatabaseSession(connection: connection, session: session, manager: manager)
@@ -39,9 +37,10 @@ struct IntentDatabaseSession {
 
     static func with<T>(
         connectionId: UUID,
+        savedConnection: @Sendable (UUID) -> DatabaseConnection? = IntentConnectionLoader.connection(id:),
         _ body: (IntentDatabaseSession) async throws -> T
     ) async throws -> T {
-        guard let connection = IntentConnectionLoader.connection(id: connectionId) else {
+        guard let connection = savedConnection(connectionId) else {
             throw IntentDataError.connectionNotFound
         }
         return try await with(connection: connection, body)
```

**File**: `TableProMobile/TableProMobile/Intents/TableEntity.swift` (modified, +15/-3)
```diff
@@ -1,5 +1,6 @@
 import AppIntents
 import Foundation
+import TableProModels
 
 struct TableEntity: AppEntity {
     static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Table")
@@ -50,11 +51,22 @@ struct TableEntityQuery: EntityQuery {
     }
 
     func suggestedEntities() async throws -> [TableEntity] {
-        guard let scope = selectedScope else { return [] }
-        let tables = try? await IntentDatabaseSession.with(connectionId: scope.connectionId) {
+        try await Self.tables(in: selectedScope)
+    }
+
+    /// Throws instead of listing nothing: the Shortcuts editor shows the error in the picker, so a
+    /// connection that cannot open does not look like a database with no tables.
+    static func tables(
+        in scope: TableListingScope?,
+        savedConnection: @Sendable (UUID) -> DatabaseConnection? = IntentConnectionLoader.connection(id:)
+    ) async throws -> [TableEntity] {
+        guard let scope else { return [] }
+        return try await IntentDatabaseSession.with(
+            connectionId: scope.connectionId,
+            savedConnection: savedConnection
+        ) {
             try await $0.tables(namespace: scope.namespace)
         }
-        return tables ?? []
     }
 
     private var selectedScope: TableListingScope? {
```

**File**: `TableProMobile/TableProMobileTests/Intents/EntityQuerySuggestionsTests.swift` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+import Foundation
+@testable import TableProMobile
+import TableProModels
+import Testing
+
+@Suite("Shortcuts table and database pickers")
+@MainActor
+struct EntityQuerySuggestionsTests {
+    private let redis = DatabaseConnection(name: "Cache", type: .redis, host: "127.0.0.1", port: 6_379)
+    private let missingFile = DatabaseConnection(
+        name: "Gone",
+        type: .sqlite,
+        database: "/private/var/tablepro-tests/\(UUID().uuidString)/Gone.sqlite"
+    )
+
+    @Test("the table picker names a deleted connection instead of listing nothing")
+    func tablesOfDeletedConnectionThrow() async {
+        let scope = TableListingScope(connectionId: UUID(), namespace: nil)
+
+        await #expect(throws: IntentDataError.connectionNotFound) {
+            try await TableEntityQuery.tables(in: scope, savedConnection: { _ in nil })
+        }
+    }
+
+    @Test("the table picker says the connection type cannot take rows")
+    func tablesOfUnsupportedTypeThrow() async {
+        let connection = redis
+        let scope = TableListingScope(connectionId: connection.id, namespace: nil)
+
+        await #expect(throws: IntentDataError.unsupportedDatabaseType("Redis")) {
+            try await TableEntityQuery.tables(in: scope, savedConnection: { _ in connection })
+        }
+    }
+
+    @Test("the table picker reports a connection that fails to open")
+    func tablesOfFailedConnectionThrow() async {
+        let connection = missingFile
+        let scope = TableListingScope(connectionId: connection.id, namespace: nil)
+
+        let error = await #expect(throws: IntentDataError.self) {
+            try await TableEntityQuery.tables(in: scope, savedConnection: { _ in connection })
+        }
+        guard case .connectionFailed = error else {
+            Issue.record("expected connectionFailed, got \(String(describing: error))")
+            return
+        }
+    }
+
+    @Test("the table picker stays empty until a connection is picked")
+    func tablesWithoutConnectionListNothing() async throws {
+        let tables = try await TableEntityQuery.tables(in: nil, savedConnection: { _ in
+            Issue.record("looked up a connection before one was picked")
+            return nil
+        })
+
+        #expect(tables.isEmpty)
+    }
+
+    @Test("the database picker names a deleted connection instead of listing nothing")
+    func namespacesOfDeletedConnectionThrow() async {
+        await #expect(throws: IntentDataError.connectionNotFound) {
+            try await DatabaseEntityQuery.namespaces(of: UUID(), savedConnection: { _ in nil })
+        }
+    }
+
+    @Test("the database picker says the connection type cannot take rows")
+    func namespacesOfUnsupportedTypeThrow() async {
+        let connection = redis
+
+        await #expect(throws: IntentDataError.unsupportedDatabaseType("Redis")) {
+            try await DatabaseEntityQuery.namespaces(of: connection.id, savedConnection: { _ in connection })
+        }
+    }
+
+    @Test("the database picker stays empty until a connection is picked")
+    func namespacesWithoutConnectionListNothing() async throws {
+        let namespaces = try await DatabaseEntityQuery.namespaces(of: nil, savedConnection: { _ in
+            Issue.record("looked up a connection before one was picked")
+            return nil
+        })
+
+        #expect(namespaces.isEmpty)
+    }
+}
```

**File**: `docs/external-api/ios-shortcuts.mdx` (modified, +2/-1)
```diff
@@ -32,7 +32,8 @@ To browse everything the app offers, open Shortcuts, tap the action list, and go
   <Step title="Point it at a table">
     Pick a **Connection**, then a **Table** read live from it. **Database or Schema** is optional and
     lists schemas on PostgreSQL and the like, databases elsewhere; empty means the connection's own.
-    SQLite has neither, so it stays empty there.
+    SQLite has neither, so it stays empty there. When the connection cannot open, both pickers
+    show why, such as an SSH host key to check, instead of an empty list.
   </Step>
   <Step title="Supply the row">
     Feed **Row (JSON or CSV)** from a Shortcuts **Dictionary** action keyed by column name, which
```

---

### Incident Patch 5: `4427e40a` (2026-10-05)
**Commit Message**: fix(hig): name view controls for VoiceOver, stop License pane crash (#3265)

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -19,6 +19,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Change preview on Elasticsearch, Typesense and Weaviate rewriting a stored `{"$oid": …}` as `ObjectId(…)`.
 - Preview SQL and other wrapped text splitting a quoted name such as `"public"."reviews"` across two lines.
 - Copy To into PostgreSQL, SQLite, DuckDB or Oracle failing on an index name another table in the target schema already uses.
+- Crash when VoiceOver reads Settings > License while a license appears in it.
+- Pickers, checkboxes and fields that VoiceOver announced by role alone, such as in Copy To, Users & Roles and Create Table.
 
 ## [0.77.2] - 2026-10-05
 
```

**File**: `TablePro/Resources/Localizable.xcstrings` (modified, +171/-0)
```diff
@@ -184991,6 +184991,177 @@
           }
         }
       }
+    },
+    "Hour" : {
+      "localizations" : {
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "시"
+          }
+        },
+        "tr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Saat"
+          }
+        },
+        "vi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Giờ"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "时"
+          }
+        },
+        "zh-Hant" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "時"
+          }
+        }
+      }
+    },
+    "Minute" : {
+      "localizations" : {
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "분"
+          }
+        },
+        "tr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Dakika"
+          }
+        },
+        "vi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Phút"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "分"
+          }
+        },
+        "zh-Hant" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "分"
+          }
+        }
+      }
+    },
+    "Second" : {
+      "comment" : "The seconds field of a time",
+      "localizations" : {
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "초"
+          }
+        },
+        "tr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Saniye"
+          }
+        },
+        "vi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Giây"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "秒"
+          }
+        },
+        "zh-Hant" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "秒"
+          }
+        }
+      }
+    },
+    "Owned objects" : {
+      "localizations" : {
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "소유한 객체"
+          }
+        },
+        "tr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Sahip olunan nesneler"
+          }
+        },
+        "vi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Các đối tượng sở hữu"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "拥有的对象"
+          }
+        },
+        "zh-Hant" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "擁有的物件"
+          }
+        }
+      }
+    },
+    "If the connection is already there" : {
+      "localizations" : {
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "연결이 이미 있는 경우"
+          }
+        },
+        "tr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Bağlantı zaten varsa"
+          }
+        },
+        "vi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Nếu kết nối đã có"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "如果连接已存在"
+          }
+        },
+        "zh-Hant" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "如果連線已存在"
+          }
+        }
+      }
     }
   },
   "version" : "1.1"
```

**File**: `TablePro/Views/AIChat/AIChatPanelView.swift` (modified, +1/-1)
```diff
@@ -364,7 +364,7 @@ struct AIChatPanelView: View {
             }
         )
         return Menu {
-            Picker("", selection: binding) {
+            Picker(String(localized: "Mode"), selection: binding) {
                 ForEach(AIChatMode.allCases) { mode in
                     Label(mode.displayName, systemImage: mode.symbolName)
                         .tag(mode)
```

**File**: `TablePro/Views/Compare/StructureDefinitionDiffView.swift` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ internal struct StructureDefinitionDiffView: View {
                 Text(title)
                     .font(.subheadline.weight(.semibold))
                 Spacer()
-                Picker("", selection: $isUnified) {
+                Picker(String(localized: "Diff layout"), selection: $isUnified) {
                     Text("Split").tag(false)
                     Text("Unified").tag(true)
                 }
```

**File**: `TablePro/Views/Connection/ImportFromApp/ConnectionImportPreviewList.swift` (modified, +2/-2)
```diff
@@ -27,7 +27,7 @@ struct ConnectionImportPreviewList: View {
     private func importItemRow(_ item: ImportItem) -> some View {
         let isSelected = selectedIds.contains(item.id)
         HStack(spacing: 8) {
-            Toggle("", isOn: Binding(
+            Toggle(item.connection.name, isOn: Binding(
                 get: { isSelected },
                 set: { newValue in
                     if newValue {
@@ -72,7 +72,7 @@ struct ConnectionImportPreviewList: View {
             Spacer()
 
             if case .duplicate = item.status, isSelected {
-                Picker("", selection: Binding(
+                Picker(String(localized: "If the connection is already there"), selection: Binding(
                     get: { duplicateResolutions[item.id] ?? .importAsCopy },
                     set: { duplicateResolutions[item.id] = $0 }
                 )) {
```

**File**: `TablePro/Views/Editor/QueryParameterPanelView.swift` (modified, +2/-1)
```diff
@@ -114,9 +114,10 @@ struct QueryParameterRowView: View {
                 .textFieldStyle(.roundedBorder)
                 .controlSize(.small)
                 .disabled(parameter.isNull)
+                .accessibilityLabel(Text(verbatim: ":\(parameter.name)"))
                 .accessibilityIdentifier("query-parameter-value-\(parameter.name)")
 
-            Picker("", selection: $parameter.type) {
+            Picker(String(localized: "Type"), selection: $parameter.type) {
                 ForEach(QueryParameterType.allCases, id: \.self) { paramType in
                     Text(paramType.displayName).tag(paramType)
                 }
```

**File**: `TablePro/Views/Filter/FilterRowView.swift` (modified, +3/-5)
```diff
@@ -168,7 +168,7 @@ struct FilterRowView: View {
 
     private var columnPicker: some View {
         HStack(spacing: 4) {
-            Picker("", selection: $filter.columnName) {
+            Picker(String(localized: "Filter column"), selection: $filter.columnName) {
                 if offersRawFilter || filter.isRawSQL {
                     Text(rawFilterLabel).tag(TableFilter.rawSQLColumn)
                     Divider()
@@ -196,7 +196,6 @@ struct FilterRowView: View {
             /// edges. Capped, the name truncates and the row stays the width of its host.
             .frame(maxWidth: Self.columnPickerMaximumWidth)
             .labelsHidden()
-            .accessibilityLabel(String(localized: "Filter column"))
             .accessibilityValue(filter.isRawSQL ? rawFilterLabel : filter.columnName)
             .help(String(localized: "Select filter column"))
 
@@ -268,7 +267,7 @@ struct FilterRowView: View {
 
     private var operatorPicker: some View {
         Menu {
-            Picker("", selection: $filter.filterOperator) {
+            Picker(String(localized: "Filter operator"), selection: $filter.filterOperator) {
                 ForEach(FilterOperator.allCases) { op in
                     OperatorMenuLabel(op: op).tag(op)
                 }
@@ -462,7 +461,7 @@ struct FilterRowView: View {
     @ViewBuilder
     private func enumValuePicker(allowedValues: [String]) -> some View {
         let isDrift = !filter.value.isEmpty && !allowedValues.contains(filter.value)
-        Picker("", selection: $filter.value) {
+        Picker(String(localized: "Filter value"), selection: $filter.value) {
             ForEach(allowedValues, id: \.self) { value in
                 Text(value).tag(value)
             }
@@ -475,7 +474,6 @@ struct FilterRowView: View {
         .controlSize(.small)
         .frame(minWidth: 100)
         .labelsHidden()
-        .accessibilityLabel(String(localized: "Filter value"))
     }
 
     private struct OperatorMenuLabel: View {
```

**File**: `TablePro/Views/Highlight/HighlightRuleRow.swift` (modified, +2/-4)
```diff
@@ -92,7 +92,7 @@ struct HighlightRuleRow: View {
     }
 
     private var columnPicker: some View {
-        Picker("", selection: columnSelection) {
+        Picker(String(localized: "Rule column"), selection: columnSelection) {
             ForEach(columnOptions) { option in
                 Text(option.label).tag(option.id)
             }
@@ -106,7 +106,6 @@ struct HighlightRuleRow: View {
         .controlSize(.small)
         .frame(maxWidth: Self.columnPickerMaximumWidth)
         .labelsHidden()
-        .accessibilityLabel(String(localized: "Rule column"))
         .accessibilityValue(rule.columnName)
         .accessibilityIdentifier("highlight-rule-column")
         .help(rule.columnName)
@@ -189,7 +188,7 @@ struct HighlightRuleRow: View {
     }
 
     private var colorPicker: some View {
-        Picker("", selection: $rule.color) {
+        Picker(String(localized: "Highlight color"), selection: $rule.color) {
             ForEach(HighlightColor.allCases) { color in
                 Label {
                     Text(color.displayName)
@@ -203,7 +202,6 @@ struct HighlightRuleRow: View {
         .controlSize(.small)
         .fixedSize()
         .labelsHidden()
-        .accessibilityLabel(String(localized: "Highlight color"))
         .accessibilityValue(rule.color.displayName)
     }
 
```

---

### Incident Patch 6: `c921e620` (2026-10-04)
**Commit Message**: fix: keep Copy To index names clear of the target's own indexes (#3264)

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Sidebar Show All running a MongoDB command on Elasticsearch, Typesense and Weaviate, and a Redis command on etcd.
 - Change preview on Elasticsearch, Typesense and Weaviate rewriting a stored `{"$oid": …}` as `ObjectId(…)`.
 - Preview SQL and other wrapped text splitting a quoted name such as `"public"."reviews"` across two lines.
+- Copy To into PostgreSQL, SQLite, DuckDB or Oracle failing on an index name another table in the target schema already uses.
 
 ## [0.77.2] - 2026-10-05
 
```

**File**: `TablePro/Core/ObjectCopy/ObjectCopyCatalog.swift` (modified, +25/-0)
```diff
@@ -105,6 +105,31 @@ internal struct ObjectCopyCatalog {
         return found
     }
 
+    /// The index names the endpoint's schema holds, keyed by the table each belongs to.
+    ///
+    /// A driver that cannot list them answers nothing rather than failing the copy, which then names
+    /// its indexes as it did before it looked.
+    internal func indexNames(
+        in endpoint: DatabaseEndpoint,
+        connection: DatabaseConnection
+    ) async throws -> [String: [String]] {
+        try await manager.ensureConnected(connection)
+        let schema = endpoint.schema?.nilIfEmpty
+        return try await manager.withMetadataDriver(scope: endpoint.scope, workload: .bulk) { driver in
+            guard let plugin = CompareMetadataService.pluginDriver(from: driver) else { return [:] }
+            do {
+                return try await plugin.fetchAllIndexes(schema: schema).mapValues { $0.map(\.name) }
+            } catch let cancellation as CancellationError {
+                throw cancellation
+            } catch {
+                Self.logger.warning(
+                    "Target index names unreadable: \(error.publicLogShape, privacy: .public)"
+                )
+                return [:]
+            }
+        }
+    }
+
     /// The schemas a database-wide copy would have to cover, so the sheet can refuse rather than
     /// carry one schema's objects and call it the database.
     internal func schemas(
```

**File**: `TablePro/Core/ObjectCopy/ObjectCopyIndexNames.swift` (modified, +54/-4)
```diff
@@ -8,7 +8,8 @@
 //  so every table of a shop can have its own `user_id` index. PostgreSQL,
 //  SQLite, DuckDB and Oracle scope it to the schema, and the second
 //  `CREATE INDEX "user_id"` was refused with `relation "user_id" already
-//  exists`, stopping the copy part way through its tables.
+//  exists`, stopping the copy part way through its tables. An index the target
+//  schema already holds on a table outside the copy refuses it the same way.
 //
 
 import Foundation
@@ -22,24 +23,33 @@ internal enum ObjectCopyIndexNames {
     /// than only the colliding ones keeps the name from depending on which tables went in the same
     /// run, so a table copied tomorrow does not collide with one copied today. `taken` holds the
     /// names already in the target schema, folded to lower case, and gains each one given here.
+    ///
+    /// A copy within one engine keeps every name the target schema does not already hold, and keeps
+    /// its length: the source server accepted it, and Oracle's 30 bytes is the limit for a name the
+    /// copy makes up.
     internal static func placed(
         _ tables: [TableStructureSnapshot],
         avoiding taken: inout Set<String>,
         from source: DatabaseType,
         to target: DatabaseType
     ) -> [TableStructureSnapshot] {
-        guard source != target, sharesOneNamespace(target) else { return tables }
+        guard sharesOneNamespace(target) else { return tables }
         let prefixes = !sharesOneNamespace(source)
+        let shortens = source != target
         let style = NewTableNameStyle.forDatabaseType(target)
-        taken.formUnion(NewTableNaming.comparisonKeys(for: tables.map(\.name)))
+        if sharesNamesWithRelations(target) {
+            taken.formUnion(NewTableNaming.comparisonKeys(for: tables.map(\.name)))
+        }
 
         return tables.map { table in
             let indexes = table.indexes.map { index -> EditableIndexDefinition in
                 guard !index.isPrimary else { return index }
                 let wanted = prefixes && !names(index.name, table: table.name)
                     ? "\(table.name)_\(index.name)"
                     : index.name
-                let fitted = NewTableNaming.truncating(wanted, toByteLength: style.maximumByteLength)
+                let fitted = shortens
+                    ? NewTableNaming.truncating(wanted, toByteLength: style.maximumByteLength)
+                    : wanted
                 let name = NewTableNaming.disambiguating(
                     fitted.isEmpty ? wanted : fitted, style: style, avoiding: taken
                 )
@@ -79,6 +89,46 @@ internal enum ObjectCopyIndexNames {
         }
     }
 
+    /// The names the target's own tables, views and sequences hold, where an index may not take one.
+    ///
+    /// A routine or a trigger never shares the index namespace on any engine `sharesOneNamespace`
+    /// names, so counting one only renamed an index that would have been created as it was.
+    internal static func occupied(by objects: [ObjectCopySelection], in target: DatabaseType) -> Set<String> {
+        guard sharesNamesWithRelations(target) else { return [] }
+        return NewTableNaming.comparisonKeys(for: objects.filter { holdsIndexNames($0.kind) }.map(\.name))
+    }
+
+    /// The index names the target schema keeps through the run, from `indexes` keyed by table.
+    ///
+    /// Every drop runs before any create, so an index on a table the run drops first is gone by the
+    /// time the copy's own `CREATE INDEX` runs. Counting it renamed a replaced table's indexes, and
+    /// the next replace then found the new names free and put the old ones back.
+    internal static func kept(_ indexes: [String: [String]], droppingFirst dropped: Set<String>) -> Set<String> {
+        NewTableNaming.comparisonKeys(for: indexes.filter { !dropped.contains($0.key) }.values.joined())
+    }
+
+    /// Whether an index name in `type` also has to differ from every table and view in its schema.
+    ///
+    /// Measured by `scripts/probes/check-index-name-scope.sh`: PostgreSQL and SQLite refuse an index
+    /// named like a table, DuckDB accepts one. Oracle documents indexes in a namespace of their own.
+    internal static func sharesNamesWithRelations(_ type: DatabaseType) -> Bool {
+        switch SQLTypeFamily.of(type) {
+        case .postgres, .sqlite:
+            return sharesOneNamespace(type)
+        default:
+            return false
+        }
+    }
+
+    private static func holdsIndexNames(_ kind: CompareObjectKind) -> Bool {
+        switch kind {
+        case .table, .view, .materializedView, .sequence:
+            return true
+        case .procedure, .function, .trigger:
+            return false
+        }
+    }
+
     /// `idx_orders_created_at` already says which table it indexes; `user_id` does not.
     private static func names(_ index: String, table: String) -> Bool {
         let index = index.lowercased()
```

**File**: `TablePro/Core/ObjectCopy/ObjectCopyPlanner.swift` (modified, +109/-20)
```diff
@@ -52,9 +52,9 @@ internal struct ObjectCopyPlanner {
         /// A copy into a chosen target resolves every scope to the same endpoint, so a database
         /// with twelve schemas read the same catalog twelve times.
         var targetObjectsByEndpoint: [String: [String: ObjectCopySelection]] = [:]
-        /// Every source scope of a copy to a chosen target lands in the one schema that was chosen,
-        /// so the names its indexes take are allocated across scopes, not afresh for each.
-        var indexNamesByEndpoint: [String: Set<String>] = [:]
+        /// Every scope is read and drafted before any index is named, because a table a later scope
+        /// replaces frees its index names for an earlier one: every drop runs before any create.
+        var passes: [ScopePass] = []
 
         for scope in Self.scopes(of: request) {
             let names = Set(scope.objects.map(\.name))
@@ -71,8 +71,8 @@ internal struct ObjectCopyPlanner {
                 request, endpoint: targetEndpoint, connection: connections.target, names: names
             )
             var targetObjects: [String: ObjectCopySelection] = [:]
-            /// Only the definition steps read it, and only when structure takes part, so a
-            /// data-only copy never pays for a catalog it would discard unread.
+            /// Only the definition steps and the index names read it, and only when structure takes
+            /// part, so a data-only copy never pays for a catalog it would discard unread.
             if request.content.includesStructure {
                 if let cached = targetObjectsByEndpoint[targetEndpoint.id] {
                     targetObjects = cached
@@ -84,26 +84,60 @@ internal struct ObjectCopyPlanner {
                 }
             }
 
-            var indexNames = indexNamesByEndpoint[targetEndpoint.id]
-                ?? NewTableNaming.comparisonKeys(for: targetObjects.values.map(\.name))
-            tableSteps += try await buildTableSteps(
+            var tableSkips: [ObjectCopySkip] = []
+            let drafts = tableDrafts(
                 request,
                 scope: scope,
                 sourceEndpoint: sourceEndpoint,
                 targetEndpoint: targetEndpoint,
                 sourceReads: sourceReads,
                 targetReads: targetReads,
-                indexNames: &indexNames,
-                skipped: &skipped
+                skipped: &tableSkips
             )
-            indexNamesByEndpoint[targetEndpoint.id] = indexNames
-            definitionSteps += try await buildDefinitionSteps(
-                request,
+            passes.append(ScopePass(
                 scope: scope,
                 sourceEndpoint: sourceEndpoint,
                 targetEndpoint: targetEndpoint,
                 sourceReads: sourceReads,
                 targetObjects: targetObjects,
+                drafts: drafts,
+                skipped: tableSkips
+            ))
+        }
+
+        /// Every source scope of a copy to a chosen target lands in the one schema that was chosen,
+        /// so the names its indexes take are allocated across scopes, not afresh for each.
+        var indexNamesByEndpoint: [String: Set<String>] = [:]
+        for pass in passes {
+            skipped += pass.skipped
+            let endpoint = pass.targetEndpoint.id
+            var indexNames: Set<String>
+            if let allocated = indexNamesByEndpoint[endpoint] {
+                indexNames = allocated
+            } else {
+                indexNames = try await reservedIndexNames(
+                    request,
+                    endpoint: pass.targetEndpoint,
+                    connection: connections.target,
+                    targetObjects: pass.targetObjects,
+                    drafts: passes.filter { $0.targetEndpoint.id == endpoint }.flatMap(\.drafts)
+                )
+            }
+            tableSteps += try await buildTableSteps(
+                request,
+                drafts: pass.drafts,
+                sourceEndpoint: pass.sourceEndpoint,
+                targetEndpoint: pass.targetEndpoint,
+                indexNames: &indexNames
+            )
+            indexNamesByEndpoint[endpoint] = indexNames
+            definitionSteps += try await buildDefinitionSteps(
+                request,
+                scope: pass.scope,
+                sourceEndpoint: pass.sourceEndpoint,
+                targetEndpoint: pass.targetEndpoint,
+                sourceReads: pass.sourceReads,
+                targetObjects: pass.targetObjects,
                 connection: connections.source,
                 skipped: &skipped
             )
@@ -164,6 +198,17 @@ internal struct ObjectCopyPlanner {
         }
     }
 
+    /// What one scope read and decided, held until every scope has been drafted.
+    private struct ScopePass {
+        let scope: Scope
+        let sourceEndpoint: DatabaseEndpoint
+        let targetEndpoint: DatabaseEndpoint
+        let sourceReads: 
```

**File**: `TableProTests/Core/ObjectCopy/ObjectCopyIndexNamesTests.swift` (modified, +99/-3)
```diff
@@ -100,11 +100,44 @@ struct ObjectCopyIndexNamesTests {
         }
     }
 
-    @Test("A copy within one engine runs exactly as it did")
-    func sameEngineIsUntouched() {
-        let tables = [Self.table("orders", ["user_id"]), Self.table("reviews", ["user_id"])]
+    @Test("A copy within one engine keeps every name the target schema does not hold")
+    func sameEngineKeepsItsNames() {
+        let tables = [
+            Self.table("orders", ["orders_user_id_idx"]),
+            Self.table("reviews", ["reviews_user_id_idx"])
+        ]
         #expect(Self.placed(tables, from: .postgresql, to: .postgresql) == tables)
         #expect(Self.placed(tables, from: .sqlite, to: .sqlite) == tables)
+        #expect(Self.placed(tables, from: .mysql, to: .mysql) == tables)
+    }
+
+    @Test("A copy within one engine renames an index the target schema already holds on another table")
+    func sameEngineAvoidsAnExistingIndex() {
+        var taken = ObjectCopyIndexNames.kept(["orders_2023": ["orders_user_id_idx"]], droppingFirst: [])
+        let placed = ObjectCopyIndexNames.placed(
+            [Self.table("orders", ["orders_user_id_idx"])], avoiding: &taken, from: .postgresql, to: .postgresql
+        )
+        #expect(Self.names(placed) == [["orders_user_id_idx_2"]])
+    }
+
+    @Test("Two schemas of one PostgreSQL database copied into one schema keep their indexes apart")
+    func sameEngineScopesLandingInOneSchemaShareTheirNames() {
+        var taken = Set<String>()
+        let sales = ObjectCopyIndexNames.placed(
+            [Self.table("orders", ["user_id"])], avoiding: &taken, from: .postgresql, to: .postgresql
+        )
+        let crm = ObjectCopyIndexNames.placed(
+            [Self.table("contacts", ["user_id"])], avoiding: &taken, from: .postgresql, to: .postgresql
+        )
+        #expect(Self.names(sales) == [["user_id"]])
+        #expect(Self.names(crm) == [["user_id_2"]])
+    }
+
+    @Test("A copy within Oracle keeps a name past the 30 bytes a made-up name is cut to")
+    func sameEngineKeepsTheLengthTheSourceAccepted() {
+        let long = "IDX_CUSTOMER_SUBSCRIPTION_BILLING_HISTORY"
+        let tables = [Self.table("CUSTOMER_SUBSCRIPTIONS", [long])]
+        #expect(Self.names(Self.placed(tables, from: .oracle, to: .oracle)) == [[long]])
     }
 
     @Test("A source whose names are already schema-wide keeps them, unless one is named like a table")
@@ -126,6 +159,69 @@ struct ObjectCopyIndexNamesTests {
         #expect(Self.names(placed) == [["orders_user_id_2"]])
     }
 
+    @Test("An index on a target table outside the copy keeps its name, and the copy's takes a number")
+    func existingIndexOnAnotherTableIsAvoided() {
+        var taken = ObjectCopyIndexNames.kept(
+            ["orders_2023": ["Orders_User_Id", "orders_2023_pkey"], "reviews_old": ["reviews_product_id"]],
+            droppingFirst: []
+        )
+        let placed = ObjectCopyIndexNames.placed(
+            [Self.table("orders", ["user_id"]), Self.table("reviews", ["product_id"])],
+            avoiding: &taken,
+            from: .mysql,
+            to: .postgresql
+        )
+        #expect(Self.names(placed) == [["orders_user_id_2"], ["reviews_product_id_2"]])
+    }
+
+    @Test("An index on a table the copy replaces does not cost the new table its name")
+    func indexOnAReplacedTableIsFree() {
+        let existing = ["orders": ["orders_user_id"], "Orders_Archive": ["orders_archive_user_id"]]
+        #expect(ObjectCopyIndexNames.kept(existing, droppingFirst: ["orders"]) == ["orders_archive_user_id"])
+
+        var taken = ObjectCopyIndexNames.kept(existing, droppingFirst: ["orders"])
+        let placed = ObjectCopyIndexNames.placed(
+            [Self.table("orders", ["user_id"])], avoiding: &taken, from: .mysql, to: .postgresql
+        )
+        #expect(Self.names(placed) == [["orders_user_id"]])
+    }
+
+    @Test("A table is dropped by its exact name, so a same-named table in another case keeps its indexes")
+    func droppedTableMatchesExactly() {
+        let existing = ["Orders": ["orders_user_id"]]
+        #expect(ObjectCopyIndexNames.kept(existing, droppingFirst: ["orders"]) == ["orders_user_id"])
+    }
+
+    @Test("Tables, views and sequences block an index name on PostgreSQL and SQLite; routines and triggers never do")
+    func occupiedNamesFollowTheTargetNamespace() {
+        let objects = [
+            ObjectCopySelection(kind: .table, name: "Orders", schema: "public"),
+            ObjectCopySelection(kind: .view, name: "order_totals", schema: "public"),
+            ObjectCopySelection(kind: .materializedView, name: "daily_sales", schema: "public"),
+            ObjectCopySelection(kind: .sequence, name: "orders_id_seq", schema: "public"),
+            ObjectCopySelection(kind: .function, name: "audit", schema: "public", signature: ""),
+            ObjectCopySelection(kind: .procedure, name: "archive", schema: "public", signature: ""),
+            ObjectCopy
```

**File**: `docs/features/copy-objects.mdx` (modified, +5/-2)
```diff
@@ -70,8 +70,11 @@ MySQL, MariaDB, SQL Server and CockroachDB name an index within its table, so se
 have a `user_id` index. PostgreSQL, SQLite, DuckDB and Oracle name it within the schema, so a copy
 from the first group into the second puts the table's name in front, as in `orders_user_id`, unless
 the index name already has it as a word, as `idx_orders_created_at` does. A name past the target's
-limit, 63 bytes or 30 on Oracle, is cut. A name that matches another index in the copy, or a table
-or view the target already has, gets a number at the end.
+limit, 63 bytes or 30 on Oracle, is cut. A name that matches another index in the copy or in the
+target schema gets a number at the end, as `orders_user_id_2`. On PostgreSQL and SQLite, so does a name
+that matches a table or view there. An index on a table the copy replaces does not count, because the
+copy drops that table first. A copy between two databases of the same type keeps every index name the
+target schema does not already use.
 
 ## When the target already has the object
 
```

**File**: `scripts/probes/check-index-name-scope.sh` (modified, +15/-3)
```diff
@@ -5,8 +5,9 @@
 # ObjectCopyIndexNames renames the indexes a copy creates only where the target refuses a second
 # index of the same name on another table. MySQL, MariaDB and SQL Server scope a name to its table,
 # so a shop copied from MariaDB carries a `user_id` index on several tables. This asserts that
-# PostgreSQL, SQLite and DuckDB each refuse the second one, that PostgreSQL also refuses an index
-# named like a table, and that it truncates a name past 63 bytes rather than refusing it.
+# PostgreSQL, SQLite and DuckDB each refuse the second one, that PostgreSQL and SQLite also refuse an
+# index named like a table while DuckDB accepts it, and that PostgreSQL truncates a name past 63 bytes
+# rather than refusing it.
 #
 # Each engine is skipped when its shell is missing. PostgreSQL is reached through psql with the
 # usual PG* environment variables, and the probe works in a schema of its own that it drops.
@@ -37,6 +38,11 @@ if command -v "$SQLITE" > /dev/null; then
     else
         pass "a second index named user_id on another table is refused"
     fi
+    if "$SQLITE" "$WORK/scope.db" "CREATE INDEX a ON b(user_id);" 2> /dev/null; then
+        fail "an index named like a table is accepted"
+    else
+        pass "an index named like a table is refused"
+    fi
 else
     skip "$SQLITE not found"
 fi
@@ -50,6 +56,12 @@ if command -v "$DUCKDB" > /dev/null; then
     else
         fail "a second index named user_id on another table is accepted"
     fi
+    output="$("$DUCKDB" "$WORK/scope.duckdb" -c "CREATE INDEX a ON b(user_id);" 2>&1)"
+    if [ -z "$output" ]; then
+        pass "an index named like a table is accepted"
+    else
+        fail "an index named like a table is refused"
+    fi
 else
     skip "$DUCKDB not found"
 fi
@@ -87,7 +99,7 @@ fi
 
 printf '\n'
 if [ "$failures" -gt 0 ]; then
-    printf '%d check(s) failed. ObjectCopyIndexNames.sharesOneNamespace may need to change.\n' "$failures"
+    printf '%d check(s) failed. ObjectCopyIndexNames.sharesOneNamespace or sharesNamesWithRelations may need to change.\n' "$failures"
     exit 1
 fi
 printf 'All checks passed.\n'
```

---

### Incident Patch 7: `8745f9bb` (2026-10-04)
**Commit Message**: fix(editor): read query language by engine and wrap at word breaks (#3263)

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -13,6 +13,11 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Users & Roles search results showing a disclosure triangle that opened onto nothing.
 - Redis tab narrowed by its key pattern or type showing the whole database's key count as its "~" total.
 - Redis key pattern change keeping the previous pattern's exact count.
+- Format Query on Elasticsearch, Typesense and Weaviate joining the body onto the request line and changing the URL.
+- Format Query changing Redis keys, etcd paths and SurrealDB record ids, such as `user:1` into `user :1`.
+- Sidebar Show All running a MongoDB command on Elasticsearch, Typesense and Weaviate, and a Redis command on etcd.
+- Change preview on Elasticsearch, Typesense and Weaviate rewriting a stored `{"$oid": …}` as `ObjectId(…)`.
+- Preview SQL and other wrapped text splitting a quoted name such as `"public"."reviews"` across two lines.
 
 ## [0.77.2] - 2026-10-05
 
```

**File**: `Packages/TableProEditor/Sources/TableProTextEngine/Extensions/CTTypesetter+SuggestLineBreak.swift` (modified, +37/-18)
```diff
@@ -75,34 +75,53 @@ extension CTTypesetter {
         subrange: NSRange,
         constrainingWidth: CGFloat
     ) -> Int {
-        var breakIndex = subrange.location + CTTypesetterSuggestClusterBreak(self, subrange.location, constrainingWidth)
-        let isBreakAtEndOfString = breakIndex >= subrange.max
-
-        let isNextCharacterCarriageReturn = checkIfLineBreakOnCRLF(breakIndex, for: string)
-        if isNextCharacterCarriageReturn {
-            breakIndex += 1
+        let breakIndex = subrange.location + CTTypesetterSuggestClusterBreak(self, subrange.location, constrainingWidth)
+        if breakIndex >= subrange.max {
+            return breakIndex
+        }
+        if checkIfLineBreakOnCRLF(breakIndex, for: string) {
+            return breakIndex + 1
         }
 
-        let canLastCharacterBreak = (breakIndex - 1 > 0 && ensureCharacterCanBreakLine(at: breakIndex - 1, for: string))
+        let hangingEnd = endOfHangingSpaces(from: breakIndex, before: subrange.max, in: string)
+        if hangingEnd > breakIndex {
+            return hangingEnd
+        }
 
-        if isBreakAtEndOfString || canLastCharacterBreak {
-            // Breaking either at the end of the string, or on a whitespace.
-            return breakIndex
-        } else if breakIndex - 1 > 0 {
-            // Try to walk backwards until we hit a whitespace or punctuation
-            var index = breakIndex - 1
+        // Unicode line breaking (UAX #14), the rule a wrapped NSTextView follows, so a quoted identifier
+        // such as `"public"."reviews"` or `"reviews_rating_check"` stays whole. Searching only up to the
+        // cluster break keeps the cost to the fragment rather than the rest of a long line.
+        let searchRange = NSRange(location: subrange.location, length: breakIndex + 1 - subrange.location)
+        let opportunity = string.lineBreak(before: breakIndex + 1, within: searchRange)
+        if opportunity != NSNotFound, opportunity > subrange.location {
+            return opportunity
+        }
 
-            while breakIndex - index < 100 && index > subrange.location {
-                if ensureCharacterCanBreakLine(at: index, for: string) {
-                    return index + 1
-                }
-                index -= 1
+        // A run with no break opportunity wider than the line, such as compact JSON or a chained call,
+        // breaks after the nearest punctuation rather than mid-word.
+        var index = breakIndex - 1
+        while breakIndex - index < 100 && index > subrange.location {
+            if ensureCharacterCanBreakLine(at: index, for: string) {
+                return index + 1
             }
+            index -= 1
         }
 
         return breakIndex
     }
 
+    /// Spaces and tabs past the edge stay on the line they follow instead of opening the next one.
+    private func endOfHangingSpaces(from index: Int, before end: Int, in string: NSAttributedString) -> Int {
+        let text = string.string as NSString
+        var hangingEnd = index
+        while hangingEnd < end {
+            let character = text.character(at: hangingEnd)
+            guard character == 0x20 || character == 0x09 else { break }
+            hangingEnd += 1
+        }
+        return hangingEnd
+    }
+
     /// Ensures the character at the given index can break a line.
     /// - Parameter index: The index to check at.
     /// - Returns: True, if the character is a whitespace or punctuation character.
```

**File**: `Packages/TableProEditor/Tests/TableProTextEngineTests/TypesetterWordBreakTests.swift` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+//
+//  TypesetterWordBreakTests.swift
+//  TableProTextEngineTests
+//
+
+import AppKit
+import Foundation
+@testable import TableProTextEngine
+import Testing
+
+@MainActor
+@Suite("Typesetter word breaks")
+struct TypesetterWordBreakTests {
+    private static let attributes: [NSAttributedString.Key: Any] = [
+        .font: NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
+    ]
+
+    /// The text of each wrapped fragment when a line is `columns` characters wide.
+    private func fragments(_ text: String, columns: Int) -> [String] {
+        let characterWidth = ("x" as NSString).size(withAttributes: Self.attributes).width
+        let length = (text as NSString).length
+        let typesetter = Typesetter()
+        typesetter.typeset(
+            NSAttributedString(string: text, attributes: Self.attributes),
+            documentRange: NSRange(location: 0, length: length),
+            displayData: TextLine.DisplayData(
+                maxWidth: CGFloat(columns) * characterWidth + 0.5,
+                lineHeightMultiplier: 1.0,
+                estimatedLineHeight: 20.0,
+                breakStrategy: .word
+            ),
+            markedRanges: nil,
+            attachments: []
+        )
+        var texts: [String] = []
+        for fragment in typesetter.lineFragments {
+            texts.append((text as NSString).substring(with: fragment.range))
+        }
+        return texts
+    }
+
+    @Test("A quoted identifier is never split at a quote or an underscore")
+    func quotedIdentifiersStayWhole() {
+        let constraint = #"ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_rating_check" CHECK ((rating >= 1) AND (rating <= 5));"#
+        #expect(fragments(constraint, columns: 30) == [
+            #"ALTER TABLE "public"."reviews" "#,
+            "ADD CONSTRAINT ",
+            #""reviews_rating_check" CHECK "#,
+            "((rating >= 1) AND (rating <= ",
+            "5));"
+        ])
+
+        let index = #"CREATE INDEX "idx_reviews_product_id" ON "public"."reviews" ("product_id");"#
+        #expect(fragments(index, columns: 30) == [
+            "CREATE INDEX ",
+            #""idx_reviews_product_id" ON "#,
+            #""public"."reviews" "#,
+            #"("product_id");"#
+        ])
+    }
+
+    @Test("A space at the edge stays on the line it ends")
+    func spaceAtTheEdgeHangs() {
+        #expect(fragments("abcdefghij klmnopqrst", columns: 10) == ["abcdefghij ", "klmnopqrst"])
+    }
+
+    @Test("A run with nowhere to break still breaks after punctuation")
+    func unbreakableRunBreaksAfterPunctuation() {
+        let identifier = "select_very_long_identifier_without_any_spaces_at_all_that_exceeds_the_width_of_the_line_for_sure"
+        #expect(fragments(identifier, columns: 30) == [
+            "select_very_long_identifier_",
+            "without_any_spaces_at_all_",
+            "that_exceeds_the_width_of_the_",
+            "line_for_sure"
+        ])
+    }
+
+    @Test("Text that allows a break between any two characters fills the line")
+    func ideographsFillTheLine() {
+        let text = "日本語。テキストを折り返すテストです"
+        let wrapped = fragments(text, columns: 10)
+
+        #expect(wrapped.joined() == text)
+        #expect((wrapped.first?.count ?? 0) > "日本語。".count)
+    }
+}
```

**File**: `TablePro/Core/Diagnostics/ConsoleRequestDiagnosticsProducer.swift` (modified, +1/-3)
```diff
@@ -10,8 +10,6 @@ import Foundation
 /// `/*` that is a wildcard, not the start of a comment, and a query string may hold any bracket.
 /// Like the console parsers, only the document's first line is read as the request line.
 struct ConsoleRequestDiagnosticsProducer: QueryDiagnosticsProducing {
-    private static let requestMethods: Set<String> = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]
-
     func diagnostics(for text: String) -> [QueryDiagnostic] {
         let source = text as NSString
         guard source.length > 0, source.length <= QueryDiagnosticsLimits.maximumDocumentLength else { return [] }
@@ -44,7 +42,7 @@ struct ConsoleRequestDiagnosticsProducer: QueryDiagnosticsProducing {
         source.getLineStart(nil, end: nil, contentsEnd: &contentsEnd, for: firstVisible)
         let lineText = source.substring(with: NSRange(location: firstVisible.location, length: contentsEnd - firstVisible.location))
         let words = lineText.split(maxSplits: 2, omittingEmptySubsequences: true, whereSeparator: \.isWhitespace)
-        guard let method = words.first, Self.requestMethods.contains(method.uppercased()) else { return source }
+        guard let method = words.first, ConsoleRequestLine.methods.contains(method.uppercased()) else { return source }
 
         var requestEnd = lineText.endIndex
         if words.count == 3, let opener = words[2].first, opener == "{" || opener == "[" {
```

**File**: `TablePro/Core/Services/Formatting/ConsoleRequestFormatter.swift` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+//
+//  ConsoleRequestFormatter.swift
+//  TablePro
+//
+
+import Foundation
+
+/// Formats an Elasticsearch, Typesense or Weaviate document by re-indenting each JSON body and leaving
+/// every other line as typed.
+///
+/// These engines highlight as JavaScript, but a request line is a URL and nothing in it can be reflowed:
+/// `GET /_cat/indices/*` holds a `/*` that is a wildcard, and `?q=name:lamp` a colon that takes no space.
+/// A body that is not exactly one JSON value, such as a GraphQL query or a browse query the grid encoded,
+/// is left alone rather than guessed at.
+struct ConsoleRequestFormatter: QueryFormatting {
+    /// Endpoints that read one JSON document per line, where indenting even a single document turns it
+    /// into several lines the endpoint reads as separate, broken records.
+    private static let lineDelimitedEndpoints: Set<String> = ["_bulk", "_msearch", "_find_structure", "find_structure"]
+
+    func format(_ text: String, cursorOffset: Int?) throws -> QueryFormatResult {
+        let source = text as NSString
+        var output = ""
+        var bodyStart = 0
+        var bodyIsLineDelimited = false
+        var lineStart = 0
+
+        while lineStart < source.length {
+            var lineEnd = 0
+            var contentsEnd = 0
+            source.getLineStart(nil, end: &lineEnd, contentsEnd: &contentsEnd, for: NSRange(location: lineStart, length: 0))
+            let line = source.substring(with: NSRange(location: lineStart, length: contentsEnd - lineStart))
+            if ConsoleRequestLine.opensRequest(line) {
+                let body = source.substring(with: NSRange(location: bodyStart, length: lineStart - bodyStart))
+                output += bodyIsLineDelimited ? body : Self.formattedBody(body)
+                output += source.substring(with: NSRange(location: lineStart, length: lineEnd - lineStart))
+                bodyStart = lineEnd
+                bodyIsLineDelimited = Self.takesLineDelimitedBody(line)
+            }
+            lineStart = lineEnd
+        }
+        let body = source.substring(from: bodyStart)
+        output += bodyIsLineDelimited ? body : Self.formattedBody(body)
+
+        // Trimmed like the other formatters: formatting a selection puts its own boundary whitespace back.
+        return QueryFormatResult(text: Self.trimmingWhitespace(output), cursorOffset: nil)
+    }
+
+    static func takesLineDelimitedBody(_ requestLine: String) -> Bool {
+        let words = requestLine.split(maxSplits: 2, whereSeparator: \.isWhitespace)
+        guard words.count >= 2 else { return false }
+        let path = words[1].split(separator: "?", maxSplits: 1).first ?? ""
+        let components = path.split(separator: "/").map { $0.lowercased() }
+        if components.contains(where: lineDelimitedEndpoints.contains) {
+            return true
+        }
+        return Array(components.suffix(2)) == ["documents", "import"]
+    }
+
+    /// The body with its JSON value re-indented and the blank lines around it kept.
+    ///
+    /// A trailing semicolon is kept too: the editor splits these documents at semicolons, so it is the
+    /// separator between two requests rather than part of the body.
+    private static func formattedBody(_ body: String) -> String {
+        let leading = body.prefix(while: \.isWhitespace)
+        let rest = body.dropFirst(leading.count)
+        let trailingCount = rest.reversed().prefix(while: \.isWhitespace).count
+        var value = rest.dropLast(trailingCount)
+        guard !value.isEmpty else { return body }
+
+        let isTerminated = value.last == ";"
+        if isTerminated {
+            value = value.dropLast()
+        }
+        guard let indented = JsonReindenter.reindentIfValid(String(value)) else { return body }
+        return String(leading) + indented + (isTerminated ? ";" : "") + String(rest.suffix(trailingCount))
+    }
+
+    private static func trimmingWhitespace(_ text: String) -> String {
+        let leadingCount = text.prefix(while: \.isWhitespace).count
+        let rest = text.dropFirst(leadingCount)
+        return String(rest.dropLast(rest.reversed().prefix(while: \.isWhitespace).count))
+    }
+}
```

**File**: `TablePro/Core/Services/Formatting/QueryFormatter.swift` (modified, +19/-4)
```diff
@@ -30,14 +30,29 @@ struct SQLQueryFormatter: QueryFormatting {
 
 @MainActor
 enum QueryFormatterFactory {
-    static func make(for databaseType: DatabaseType?) -> QueryFormatting {
+    /// Nil for a language with no formatter of its own. The SQL formatter reads a Redis key `user:1` as
+    /// `user :1`, an etcd path as `/ config / name` and a SurrealQL record id `person:tobie` as two tokens,
+    /// so running it there changes what the command does.
+    static func make(for databaseType: DatabaseType?) -> QueryFormatting? {
         let dialect = databaseType ?? .mysql
 
-        switch PluginManager.shared.editorLanguage(for: dialect) {
-        case .javascript:
+        // Elasticsearch, Typesense and Weaviate highlight as JavaScript for their JSON bodies, and the
+        // shell formatter joins a body onto its request line. Only a MongoDB script is JavaScript.
+        if QueryStatementModel.forDatabaseType(dialect) == .javascript {
             return MongoShellFormatter()
-        default:
+        }
+
+        switch PluginManager.shared.editorLanguage(for: dialect) {
+        case .sql:
             return SQLQueryFormatter(dialect: dialect, keywordCase: AppSettingsManager.shared.editor.keywordCase)
+        case .javascript:
+            return ConsoleRequestFormatter()
+        case .bash, .custom:
+            return nil
         }
     }
+
+    static func supportsFormatting(_ databaseType: DatabaseType?) -> Bool {
+        make(for: databaseType) != nil
+    }
 }
```

**File**: `TablePro/Core/Services/Infrastructure/MainSplitViewController+MenuValidation.swift` (modified, +6/-2)
```diff
@@ -142,6 +142,8 @@ struct MenuValidationContext: Equatable {
     /// Whether the engine declares an EXPLAIN variant. Read through the same rule the editor bar
     /// uses, so the menu item cannot run a statement the bar's button refuses to.
     var supportsExplain = false
+    /// Whether the engine's query language has a formatter, the rule the editor bar's Format button uses.
+    var supportsFormatting = false
     var hasSessionContexts = false
     var canFilterDatabases = false
     var canFavoriteActiveDatabase = false
@@ -507,9 +509,10 @@ extension MainSplitViewController: NSMenuItemValidation {
         switch selector {
         case #selector(executeQuery(_:)),
              #selector(executeAllStatements(_:)),
-             #selector(executeQueryWithoutLimit(_:)),
-             #selector(formatQuery(_:)):
+             #selector(executeQueryWithoutLimit(_:)):
             return context.isConnected && context.hasQueryText
+        case #selector(formatQuery(_:)):
+            return context.isConnected && context.hasQueryText && context.supportsFormatting
         case #selector(explainQuery(_:)):
             return QueryCommandAvailability.canExplain(
                 isConnected: context.isConnected,
@@ -660,6 +663,7 @@ extension MainSplitViewController: NSMenuItemValidation {
             supportsUserManagement: actions.supportsUserManagement,
             supportsSchemaSwitching: actions.supportsSchemaSwitching,
             supportsExplain: actions.supportsExplain,
+            supportsFormatting: actions.supportsFormatting,
             hasSessionContexts: actions.hasSessionContexts,
             canFilterDatabases: actions.canFilterDatabases,
             canFavoriteActiveDatabase: actions.canFavoriteActiveDatabase,
```

**File**: `TablePro/Core/Services/Query/AllTablesListing.swift` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+//
+//  AllTablesListing.swift
+//  TablePro
+//
+
+import Foundation
+import TableProPluginKit
+
+/// What the sidebar's Show All Tables command opens for an engine.
+enum AllTablesListing: Equatable {
+    /// A shell command, run in this window's new tab like any command the user types.
+    case shellCommand(String)
+    /// The plugin's own listing, opened in a tab of its own window.
+    case statement(String)
+
+    /// The plugin's listing when it builds one. The MongoDB and Redis plugins build none, so their shell's own
+    /// command stands in, chosen by engine: Elasticsearch, Typesense and Weaviate also highlight as
+    /// JavaScript and etcd as a command line, and none of them runs these.
+    static func resolve(databaseType: DatabaseType, pluginListing: String?) -> AllTablesListing? {
+        if let pluginListing {
+            return .statement(pluginListing)
+        }
+        switch databaseType {
+        case .mongodb:
+            return .shellCommand(#"db.runCommand({"listCollections": 1, "nameOnly": false})"#)
+        case .redis:
+            return .shellCommand("SCAN 0 MATCH * COUNT 100")
+        default:
+            return nil
+        }
+    }
+}
```

---

### Incident Patch 8: `1e8184b3` (2026-10-04)
**Commit Message**: fix: refresh the Users & Roles scope tree, count Redis searches by scope (#3262)

**File**: `CHANGELOG.md` (modified, +7/-0)
```diff
@@ -7,6 +7,13 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Fixed
+
+- Users & Roles object tree keeping its old rows after a search or a switch to Granted, until something else changed.
+- Users & Roles search results showing a disclosure triangle that opened onto nothing.
+- Redis tab narrowed by its key pattern or type showing the whole database's key count as its "~" total.
+- Redis key pattern change keeping the previous pattern's exact count.
+
 ## [0.77.2] - 2026-10-05
 
 ### Added
```

**File**: `TablePro/Core/Coordinators/ExactRowCounter.swift` (modified, +18/-0)
```diff
@@ -24,6 +24,24 @@ internal enum ExactRowCounter {
         return exactRowCountIsFullScan ? .driverCount : .driverCountThenHostSQL(countSQL)
     }
 
+    /// The exact number of keys a browse search lists, counted only when the table it narrows is
+    /// smaller than `tableSizeLimit`.
+    ///
+    /// Nothing short of walking every key the search could match is exact, and that walk visits the
+    /// whole table, so the table's own size bounds it the way the estimate bounds an automatic
+    /// `COUNT(*)`. An unknown or larger table answers nil and the total stays unknown, with
+    /// `Count Exactly` offered for it.
+    internal static func countBrowseSearch(
+        on driver: DatabaseDriver,
+        table: String,
+        search: BrowseSearchState,
+        tableSizeLimit: Int
+    ) async throws -> Int? {
+        guard let tableSize = try await driver.fetchApproximateRowCount(table: table),
+              tableSize < tableSizeLimit else { return nil }
+        return try await driver.fetchExactRowCount(table: table, browseFilters: search.pluginQueryFilters)
+    }
+
     internal static func count(
         on driver: DatabaseDriver,
         table: String,
```

**File**: `TablePro/Core/Coordinators/FilterCoordinator.swift` (modified, +19/-4)
```diff
@@ -175,6 +175,12 @@ final class FilterCoordinator: ObservableObject {
         PluginManager.shared.browseFilterDescriptor(for: parent.connection.type) != nil
     }
 
+    /// The search a tab's browse runs instead of its table filters. The browse query, the automatic
+    /// row count and `Count Exactly` all read it here, so each describes the keys the grid lists.
+    func activeBrowseSearch(for filterState: TabFilterState) -> BrowseSearchState? {
+        filterState.activeBrowseSearch(isSupported: usesBrowseSearch)
+    }
+
     func applyBrowseSearch(_ search: BrowseSearchState) {
         guard let (tab, tabIndex) = parent.tabManager.selectedTabAndIndex,
               let tableName = tab.tableContext.tableName else { return }
@@ -189,7 +195,13 @@ final class FilterCoordinator: ObservableObject {
                 state.browseSearch = search
                 state.isVisible = true
             }
-            parent.tabManager.mutate(at: capturedTabIndex) { $0.pagination.reset() }
+            /// The total on screen counted the previous search's keys, or the whole database. An
+            /// exact one is never replaced by a later estimate, so left in place it would go on
+            /// describing this search.
+            parent.tabManager.mutate(at: capturedTabIndex) { tab in
+                tab.pagination.reset()
+                tab.pagination.retireDerivedRowCount()
+            }
             rebuildTableQuery(at: capturedTabIndex)
             saveBrowseSearch(for: capturedTableName)
             parent.runQuery(viewport: .firstRow)
@@ -209,7 +221,11 @@ final class FilterCoordinator: ObservableObject {
             mutateSelectedTabFilterState { state in
                 state.browseSearch = BrowseSearchState()
             }
-            parent.tabManager.mutate(at: capturedTabIndex) { $0.pagination.reset() }
+            /// A total counted for the search does not describe the whole database.
+            parent.tabManager.mutate(at: capturedTabIndex) { tab in
+                tab.pagination.reset()
+                tab.pagination.retireDerivedRowCount()
+            }
             rebuildTableQuery(at: capturedTabIndex)
             saveBrowseSearch(for: capturedTableName)
             parent.runQuery(viewport: .firstRow)
@@ -255,8 +271,7 @@ final class FilterCoordinator: ObservableObject {
 
         let newQuery: String
         var executed: [TableFilter] = []
-        if usesBrowseSearch, tab.filterState.hasActiveBrowseSearch {
-            let search = tab.filterState.browseSearch
+        if let search = activeBrowseSearch(for: tab.filterState) {
             newQuery = parent.queryBuilder.buildKeyPatternBrowseQuery(
                 tableName: tableName,
                 schemaName: tab.tableContext.schemaName,
```

**File**: `TablePro/Core/Coordinators/PaginationCoordinator.swift` (modified, +1/-3)
```diff
@@ -173,9 +173,7 @@ final class PaginationCoordinator: ObservableObject {
         let logicMode = tab.filterState.filterLogicMode
         /// A browse narrowed by the plugin's own search runs that search instead of the table
         /// filters, so the count has to read the same search or it counts the whole table.
-        let browseFilters = parent.filterCoordinator.usesBrowseSearch && tab.filterState.hasActiveBrowseSearch
-            ? tab.filterState.browseSearch.pluginQueryFilters
-            : nil
+        let browseFilters = parent.filterCoordinator.activeBrowseSearch(for: tab.filterState)?.pluginQueryFilters
         let isNonSQL = PluginManager.shared.editorLanguage(for: parent.connection.type) != .sql
         let queryColumns = parent.queryColumns(for: tab)
         let countSQL = isNonSQL ? nil : parent.queryBuilder.buildFilteredCountQuery(
```

**File**: `TablePro/Core/Coordinators/QueryExecutionCoordinator+Helpers.swift` (modified, +29/-4)
```diff
@@ -275,6 +275,7 @@ extension QueryExecutionCoordinator {
         /// and put the old total back. Kept, a total above the automatic-count threshold stops the
         /// count this read launches, so paging stays bounded by the table as it was.
         let answeredRowsChange = parent.tabSessionRegistry.recordRead(read, for: existingTabId)
+        let usesBrowseSearch = parent.filterCoordinator.usesBrowseSearch
 
         parent.tabManager.mutate(at: idx) { tab in
             tab.schemaVersion += 1
@@ -290,7 +291,7 @@ extension QueryExecutionCoordinator {
                 tab.pagination.retireDerivedRowCount()
             }
             if let metadata, let approxCount = metadata.approximateRowCount, approxCount > 0,
-               !tab.filterState.hasAppliedFilters {
+               !tab.filterState.narrowsRows(browseSearchIsSupported: usesBrowseSearch) {
                 tab.pagination.applyDerivedRowCount(approxCount, isApproximate: true)
             }
             if hasSchema {
@@ -629,14 +630,15 @@ extension QueryExecutionCoordinator {
             )
         }
 
+        let usesBrowseSearch = parent.filterCoordinator.usesBrowseSearch
         parent.tabManager.mutate(tabId: tabId) { tab in
             if !parsed.primaryKeyColumns.isEmpty {
                 tab.tableContext.primaryKeyColumns = parsed.primaryKeyColumns
                 tab.display.activeResultSet?.origin?.primaryKeyColumns = parsed.primaryKeyColumns
                 tab.display.activeResultSet?.origin?.keysResolved = true
             }
             if let approxCount = parsed.approximateRowCount, approxCount > 0,
-               !tab.filterState.hasAppliedFilters {
+               !tab.filterState.narrowsRows(browseSearchIsSupported: usesBrowseSearch) {
                 tab.pagination.applyDerivedRowCount(approxCount, isApproximate: true)
             }
             tab.metadataVersion += 1
@@ -701,7 +703,8 @@ extension QueryExecutionCoordinator {
                     filterState: tab.filterState,
                     approximateRowCount: tab.pagination.totalRowCount,
                     threshold: AppSettingsManager.shared.dataGrid.countRowsIfEstimateLessThan,
-                    countsAutomatically: countsAutomatically
+                    countsAutomatically: countsAutomatically,
+                    browseSearch: parent.filterCoordinator.activeBrowseSearch(for: tab.filterState)
                 )
                 guard case let .exactCount(filtered) = plan else { return (plan, nil, scope) }
                 let queryColumns = parent.queryColumns(for: tab)
@@ -768,6 +771,18 @@ extension QueryExecutionCoordinator {
                 try await driver.fetchFilteredRowCount(table: tableName, filters: filters, logicMode: logicMode)
             }) else { return .clear }
             return .count(count, isApproximate: false)
+        case let .browseSearch(search, tableSizeLimit):
+            do {
+                let count = try await DatabaseManager.shared.withMetadataDriver(scope: scope, workload: .bulk) { driver in
+                    try await ExactRowCounter.countBrowseSearch(
+                        on: driver, table: tableName, search: search, tableSizeLimit: tableSizeLimit
+                    )
+                }
+                return count.map { RowCountOutcome.count($0, isApproximate: false) }
+            } catch {
+                helpersLogger.warning("Browse search count failed for \(tableName): \(error.localizedDescription)")
+                return nil
+            }
         case .exactCount:
             guard let exactCount, let sql = exactCount.sql else { return nil }
             do {
@@ -790,13 +805,22 @@ extension QueryExecutionCoordinator {
 
     /// `countsAutomatically` is `PluginManager.countsRowsAutomatically(for:)`: an engine that cannot skip rows, or
     /// whose count is a billed scan, is only counted when the user asks.
+    ///
+    /// `browseSearch` is the search the browse runs in place of the table filters, such as a Redis key
+    /// pattern. The table's estimate measures the whole database, not the keys that search lists, so it is
+    /// never the answer. A search change retires the total, which is why nothing is cleared here: a page
+    /// turn after `Count Exactly` keeps that count.
     static func rowCountPlan(
         isNonSQL: Bool,
         filterState: TabFilterState,
         approximateRowCount: Int?,
         threshold: Int,
-        countsAutomatically: Bool = true
+        countsAutomatically: Bool = true,
+        browseSearch: BrowseSearchState? = nil
     ) -> RowCountPlan {
+        if let browseSearch {
+            return countsAutomatically ? .browseSearch(browseSearch, tableSizeLimit: threshold) : .skip
+        }
         guard countsAutomatically else {
             return filterState.hasAppliedFilters ? .clear : .skip
         }
@@ -890,6 +914,7 @@ enum RowCountPlan: Equatable {
     case skip
     case clear
     case approximate
+    case browseSea
```

**File**: `TablePro/Core/UsersRoles/PrivilegeTreeModel.swift` (modified, +25/-12)
```diff
@@ -12,17 +12,23 @@ final class PrivilegeTreeModel: ObservableObject {
 
     @Published private(set) var roots: [PrivilegeNode] = []
     @Published private(set) var mode: Mode = .hierarchy
-    @Published private(set) var structureVersion = 0
-
-    @Published private var databases: [String] = []
-
-    @Published private var hasServerScope = false
 
-    @Published private var restrictsBrowsing = false
+    /// Bumped only when `roots` is replaced, which the outline answers with `reloadData()`.
+    ///
+    /// A lazy expand is not a structure change: it fills in one node, and reloading the whole
+    /// outline for it would collapse every row and expand them again. That goes out through
+    /// `nodeDidChange` instead, so this model publishes only when the outline has to start over.
+    @Published private(set) var structureVersion = 0
 
-    @Published private var currentDatabase: String?
+    /// A node whose own state changed: it began loading its children, received them, or failed.
+    /// The outline reloads that item, which is how a row shows and then drops its spinner.
+    let nodeDidChange = PassthroughSubject<PrivilegeNode, Never>()
 
-    @Published private var loader: PrincipalListLoader?
+    private var databases: [String] = []
+    private var hasServerScope = false
+    private var restrictsBrowsing = false
+    private var currentDatabase: String?
+    private var loader: PrincipalListLoader?
 
     func configure(
         databases: [String],
@@ -51,9 +57,16 @@ final class PrivilegeTreeModel: ObservableObject {
         bumpVersion()
     }
 
+    /// Search results are a flat list of leaves. Only the hierarchy loads children, so a result
+    /// left expandable drew a disclosure triangle that opened onto nothing, and loading under it
+    /// would list a second copy of any parent or child the search also matched.
     func showSearchResults(_ scopes: [PluginPrivilegeScope]) {
         mode = .searchResults
-        roots = scopes.map(makeNode)
+        roots = scopes.map { scope in
+            let node = makeNode(scope)
+            node.setChildren([])
+            return node
+        }
         bumpVersion()
     }
 
@@ -65,15 +78,15 @@ final class PrivilegeTreeModel: ObservableObject {
               let loader else { return }
 
         node.beginLoading()
-        bumpVersion()
+        nodeDidChange.send(node)
 
         do {
             let children = try await loader.grantableChildren(of: node.scope)
             node.setChildren(children.map(makeNode))
-            bumpVersion()
+            nodeDidChange.send(node)
         } catch {
             node.failLoading(error.localizedDescription)
-            bumpVersion()
+            nodeDidChange.send(node)
             throw error
         }
     }
```

**File**: `TablePro/Models/UI/FilterState.swift` (modified, +12/-0)
```diff
@@ -110,4 +110,16 @@ extension TabFilterState {
     var hasActiveBrowseSearch: Bool {
         browseSearch.isActive
     }
+
+    /// The search the tab's browse runs, nil when it narrows nothing. Only an engine that declares
+    /// a browse search runs one, so the caller says whether this tab's engine does.
+    func activeBrowseSearch(isSupported: Bool) -> BrowseSearchState? {
+        isSupported && hasActiveBrowseSearch ? browseSearch : nil
+    }
+
+    /// Whether the tab lists fewer rows than its table holds, so the table's own size, which is
+    /// what an estimate measures, is not the total of what is on screen.
+    func narrowsRows(browseSearchIsSupported: Bool) -> Bool {
+        hasAppliedFilters || activeBrowseSearch(isSupported: browseSearchIsSupported) != nil
+    }
 }
```

**File**: `TablePro/ViewModels/UsersRolesViewModel.swift` (modified, +8/-0)
```diff
@@ -101,17 +101,25 @@ final class UsersRolesViewModel: ObservableObject {
     @Published var scopeSearchTask: Task<Void, Never>?
 
     private var changeManagerForwarding: AnyCancellable?
+    private var privilegeTreeForwarding: AnyCancellable?
 
     /// Every view on this tab observes the view model, not `changeManager`, and reads the staged
     /// grants, the change count and each principal's stage through it. A change the manager
     /// published reached none of them: a ticked privilege stayed unticked, and Review & Apply and
     /// "Modified" stayed stale until the view model happened to publish something of its own.
+    ///
+    /// The scope outline reads the tree's structure version through the view model the same way,
+    /// so a search result or a switch to Granted reached it only when something else published.
+    /// The tree publishes only when its roots are replaced, so a lazy expand does not reload the
+    /// whole outline through this.
     init(connectionId: UUID, databaseType: DatabaseType) {
         self.connectionId = connectionId
         self.databaseType = databaseType
         expansionStore = PrivilegeExpansionStore(connectionId: connectionId)
         changeManagerForwarding = changeManager.objectWillChange
             .sink { [weak self] in self?.objectWillChange.send() }
+        privilegeTreeForwarding = privilegeTree.objectWillChange
+            .sink { [weak self] in self?.objectWillChange.send() }
     }
 
     // MARK: - Derived
```

---

### Incident Patch 9: `f8e0e5bf` (2026-10-04)
**Commit Message**: fix(plugin-beancount): show BQL positions and read rledger 0.23+ output (#3260)

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -49,6 +49,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Status bar truncating the row count and Count Exactly instead of dropping to a narrower layout.
 - Query editor bar cut off, with the editor's text over it, when the editor pane is at its smallest.
 - Long column names drawn over their type in the ER diagram.
+- Beancount BQL results showing a position as raw JSON, tags and links as a JSON list, and booleans as 1 or 0.
+- Beancount BQL results, tables, directive metadata and transaction tags coming back empty with `rledger` 0.23 and later.
+- Beancount balances listing a commodity held in several lots once per lot on `rledger`.
 
 ## [0.77.1] - 2026-10-03
 
```

**File**: `Plugins/BeancountDriverPlugin/BeancountPluginDriver+Backend.swift` (modified, +61/-0)
```diff
@@ -168,6 +168,67 @@ extension BeancountPluginDriver {
         return version.isEmpty ? nil : version
     }
 
+    /// Runs an `#entries` query against the metadata column this rledger has.
+    internal static func entriesQuery(
+        ledgerPath: String,
+        bql: (BeancountEntriesMetadataColumn) -> String,
+        connectAttempt: BeancountConnectAttempt?
+    ) throws -> [[String: Any]] {
+        let column = try entriesMetadataColumn(ledgerPath: ledgerPath, connectAttempt: connectAttempt)
+        return try entriesRows(ledgerPath: ledgerPath, bql: bql(column), column: column, connectAttempt: connectAttempt)
+    }
+
+    // Read from the table's columns once per executable. Trying the real query instead cannot tell:
+    // rledger reports a missing column only while evaluating a row, so a ledger with no matching
+    // entries answers without error.
+    private static func entriesMetadataColumn(
+        ledgerPath: String,
+        connectAttempt: BeancountConnectAttempt?
+    ) throws -> BeancountEntriesMetadataColumn {
+        let executablePath = try rustledgerExecutablePath()
+        if let cached = entriesMetadataColumns.withLock({ $0[executablePath] }) {
+            return cached
+        }
+        let data = try runRledger(
+            arguments: rledgerQueryArguments(
+                ledgerPath: ledgerPath,
+                query: "SELECT * FROM #entries LIMIT 0",
+                connectAttempt: connectAttempt
+            ),
+            connectAttempt: connectAttempt
+        )
+        let column: BeancountEntriesMetadataColumn = try decodeRledgerColumns(data).contains("meta")
+            ? .meta
+            : .entryMeta
+        entriesMetadataColumns.withLock { $0[executablePath] = column }
+        return column
+    }
+
+    private static func entriesRows(
+        ledgerPath: String,
+        bql: String,
+        column: BeancountEntriesMetadataColumn,
+        connectAttempt: BeancountConnectAttempt?
+    ) throws -> [[String: Any]] {
+        let rows = try query(ledgerPath: ledgerPath, bql: bql, connectAttempt: connectAttempt)
+        guard column == .meta else { return rows }
+        return rows.map { row in
+            var row = row
+            row["_entry_meta"] = ownMetadata(row["_entry_meta"])
+            return row
+        }
+    }
+
+    // `meta` also holds the parser's `filename` and `lineno` and Beancount's `__`-prefixed keys,
+    // which the Python projection leaves out of directive metadata as well.
+    static func ownMetadata(_ value: Any?) -> Any {
+        guard let metadata = value as? [String: Any] else { return value ?? NSNull() }
+        let own = metadata.filter { key, _ in
+            key != "filename" && key != "lineno" && !key.hasPrefix("__")
+        }
+        return own.isEmpty ? NSNull() : own
+    }
+
     private static func rledgerSupportsNoCache(
         executablePath: String,
         connectAttempt: BeancountConnectAttempt?
```

**File**: `Plugins/BeancountDriverPlugin/BeancountPluginDriver+RledgerOutput.swift` (added, +140/-0)
```diff
@@ -0,0 +1,140 @@
+//
+//  BeancountPluginDriver+RledgerOutput.swift
+//  BeancountDriverPlugin
+//
+
+import Foundation
+import TableProNumberFormatting
+import TableProPluginKit
+
+extension BeancountPluginDriver {
+    private static var invalidRledgerOutput: BeancountDriverError {
+        .queryFailed(String(localized: "Invalid rustledger JSON output"))
+    }
+
+    // rledger 0.22 writes each row as an object keyed by column name. From 0.23 a row is an array
+    // positional against `columns`, because BQL can return two columns with the same name.
+    private static func parseRledgerJSON(_ data: Data) throws -> (columns: [String]?, rows: [Any]) {
+        guard let dictionary = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
+            throw invalidRledgerOutput
+        }
+        let columns = dictionary["columns"] as? [String]
+        guard let rows = dictionary["rows"] else { return (columns, []) }
+        guard let rows = rows as? [Any] else { throw invalidRledgerOutput }
+        return (columns, rows)
+    }
+
+    private static func positionalValues(_ row: Any, columns: [String]) throws -> [Any?] {
+        if let values = row as? [Any] {
+            return columns.indices.map { values.indices.contains($0) ? values[$0] : nil }
+        }
+        if let keyed = row as? [String: Any] {
+            return columns.map { keyed[$0] }
+        }
+        throw invalidRledgerOutput
+    }
+
+    static func decodeRledgerColumns(_ data: Data) throws -> [String] {
+        guard let columns = try parseRledgerJSON(data).columns else { throw invalidRledgerOutput }
+        return columns
+    }
+
+    static func decodeRledgerRows(_ data: Data) throws -> [[String: Any]] {
+        let parsed = try parseRledgerJSON(data)
+        return try parsed.rows.map { row in
+            if let keyed = row as? [String: Any] {
+                return keyed
+            }
+            guard let columns = parsed.columns else { throw invalidRledgerOutput }
+            let values = try positionalValues(row, columns: columns)
+            var keyed: [String: Any] = [:]
+            for (column, value) in zip(columns, values) where keyed[column] == nil {
+                keyed[column] = value ?? NSNull()
+            }
+            return keyed
+        }
+    }
+
+    static func decodeRustledgerQueryOutput(
+        _ data: Data,
+        executionTime: TimeInterval
+    ) throws -> PluginQueryResult {
+        let parsed = try parseRledgerJSON(data)
+        guard let columns = parsed.columns else { throw invalidRledgerOutput }
+
+        let rows = try parsed.rows.prefix(PluginRowLimits.emergencyMax).map { row in
+            try positionalValues(row, columns: columns).map { value -> PluginCellValue in
+                guard let value, !(value is NSNull) else { return .null }
+                return .text(rustledgerCellValue(value))
+            }
+        }
+
+        return PluginQueryResult(
+            columns: columns,
+            columnTypeNames: Array(repeating: "TEXT", count: columns.count),
+            rows: rows,
+            rowsAffected: 0,
+            executionTime: executionTime,
+            isTruncated: parsed.rows.count > rows.count
+        )
+    }
+
+    // The text `rledger query` prints for each value its JSON output carries: a posting's position is
+    // `{units, cost}`, an inventory `{positions}`, tags and links an array, an interval `{count, unit}`.
+    static func rustledgerCellValue(_ value: Any) -> String {
+        if let string = value as? String {
+            return string
+        }
+        if let number = value as? NSNumber {
+            if CFGetTypeID(number) == CFBooleanGetTypeID() {
+                return number.boolValue ? "TRUE" : "FALSE"
+            }
+            return NumberText.text(for: number)
+        }
+        if let values = value as? [Any] {
+            return values.map(rustledgerCellValue).joined(separator: ", ")
+        }
+        if let object = value as? [String: Any],
+           let text = amountText(object) ?? positionText(object) ?? inventoryText(object) ?? intervalText(object) {
+            return text
+        }
+        if let string = NumberText.json(from: value) {
+            return string
+        }
+        return String(describing: value)
+    }
+
+    private static func amountText(_ object: [String: Any]) -> String? {
+        guard let number = object["number"] as? String,
+              let currency = object["currency"] as? String else {
+            return nil
+        }
+        return "\(number) \(currency)"
+    }
+
+    private static func positionText(_ object: [String: Any]) -> String? {
+        guard let units = (object["units"] as? [String: Any]).flatMap(amountText) else { return nil }
+        guard let cost = object["cost"], !(cost is NSNull) else { return units }
+        guard let costText = (cost as? [String: Any]).flatMap(amountText) else { return nil }
+        return "\(units) {\(c
```

**File**: `Plugins/BeancountDriverPlugin/BeancountPluginDriver.swift` (modified, +41/-82)
```diff
@@ -85,6 +85,22 @@ enum BeancountBackend {
     case python(String)
 }
 
+// Where `#entries` keeps a directive's own metadata: `_entry_meta` through rledger 0.22, and from 0.23
+// only `meta`, which also carries the source location.
+enum BeancountEntriesMetadataColumn: Sendable {
+    case entryMeta
+    case meta
+
+    var selection: String {
+        switch self {
+        case .entryMeta:
+            return "_entry_meta"
+        case .meta:
+            return "meta AS _entry_meta"
+        }
+    }
+}
+
 final class BeancountPluginDriver: PluginDatabaseDriver, @unchecked Sendable {
     private let config: DriverConnectionConfig
     private let lock = NSLock()
@@ -98,10 +114,10 @@ final class BeancountPluginDriver: PluginDatabaseDriver, @unchecked Sendable {
 
     private static let transactionsCoreColumns =
         "id, date, flag, payee, narration, filename, lineno"
-    private static let transactionsDetailColumns = "tags, links, _entry_meta"
-    private static let transactionsQuery =
-        "SELECT \(transactionsCoreColumns), \(transactionsDetailColumns) "
+    private static func transactionsQuery(_ metadata: BeancountEntriesMetadataColumn) -> String {
+        "SELECT \(transactionsCoreColumns), tags, links, \(metadata.selection) "
             + "FROM #entries WHERE type = 'transaction' ORDER BY id"
+    }
     private static let transactionsCoreQuery =
         "SELECT \(transactionsCoreColumns) FROM #entries WHERE type = 'transaction' ORDER BY id"
 
@@ -114,7 +130,7 @@ final class BeancountPluginDriver: PluginDatabaseDriver, @unchecked Sendable {
     private static let accountsCoreQuery = "SELECT account, open, currencies FROM #accounts ORDER BY account"
     private static let pricesQuery = "SELECT date, currency, amount FROM #prices ORDER BY date, currency"
     private static let balancesQuery =
-        "SELECT account, sum(position) AS balance FROM #postings GROUP BY account ORDER BY account"
+        "SELECT account, sum(units(position)) AS balance FROM #postings GROUP BY account ORDER BY account"
     private static let balanceAssertionsQuery = "SELECT date, account, amount FROM #balances ORDER BY date, account"
     private static let commoditiesQuery = "SELECT date, name FROM #commodities ORDER BY date, name"
     private static let documentsQuery =
@@ -127,16 +143,19 @@ final class BeancountPluginDriver: PluginDatabaseDriver, @unchecked Sendable {
     // `_entry_meta` is the backend's own metadata for a directive, alongside the entry id and the
     // authoritative filename and line the parser recorded. Re-deriving any of that by reading the
     // ledger text would be a second, weaker parser that cannot see plugin-generated entries.
-    private static let directivesQuery =
-        "SELECT id, type, date, filename, lineno, _entry_meta FROM #entries "
+    private static func directivesQuery(_ metadata: BeancountEntriesMetadataColumn) -> String {
+        "SELECT id, type, date, filename, lineno, \(metadata.selection) FROM #entries "
             + "WHERE type != 'transaction' ORDER BY id"
+    }
     private static let closesQuery =
         "SELECT account, close FROM #accounts WHERE close IS NOT NULL ORDER BY close, account"
     static let logger = Logger(subsystem: "com.TablePro", category: "BeancountPluginDriver")
     static let rledgerNoCacheSupport = OSAllocatedUnfairLock(initialState: [String: Bool]())
     private static let postingsColumnLevels =
         OSAllocatedUnfairLock(initialState: [String: PostingsColumnLevel]())
     static let backendVersions = OSAllocatedUnfairLock(initialState: [String: String]())
+    static let entriesMetadataColumns =
+        OSAllocatedUnfairLock(initialState: [String: BeancountEntriesMetadataColumn]())
 
     private static let workQueue = DispatchQueue(
         label: "com.TablePro.BeancountDriver",
@@ -702,12 +721,9 @@ final class BeancountPluginDriver: PluginDatabaseDriver, @unchecked Sendable {
                 ),
                 queries: sourceDirectives.queries,
                 custom: sourceDirectives.custom,
-                directives: try directiveRows(
-                    ledgerPath: ledgerPath,
-                    bql: directivesQuery,
-                    table: "directives",
-                    connectAttempt: connectAttempt
-                ),
+                directives: try directiveRows(table: "directives", connectAttempt: connectAttempt) {
+                    try entriesQuery(ledgerPath: ledgerPath, bql: directivesQuery, connectAttempt: connectAttempt)
+                },
                 diagnostics: try validationDiagnostics(
                     ledgerPath: ledgerPath,
                     connectAttempt: connectAttempt
@@ -864,7 +880,7 @@ final class BeancountPluginDriver: PluginDatabaseDriver, @unchecked Sendable {
         }
     }
 
-    private static func query(
+    static func query(
         ledgerPath: String,
         bql: String,
         connectAttempt: BeancountConnectAttempt? 
```

**File**: `TableProTests/Plugins/BeancountPluginDriverTests.swift` (modified, +5/-5)
```diff
@@ -8,7 +8,7 @@ import Foundation
 import TableProPluginKit
 import Testing
 
-private enum RustledgerLocator {
+enum RustledgerLocator {
     static let path: String? = resolve()
 
     static func resolve() -> String? {
@@ -1011,12 +1011,12 @@ struct BeancountPluginDriverTests {
         #expect(postingFreeCount.rows.first?.first?.asText == "0")
     }
 
-    private static func withRustledger(_ body: () async throws -> Void) async throws {
+    static func withRustledger(_ body: () async throws -> Void) async throws {
         let rledger = try #require(RustledgerLocator.path)
         try await withRustledgerEnvironment(rledger, body)
     }
 
-    private static func withRustledgerEnvironment(_ path: String, _ body: () async throws -> Void) async throws {
+    static func withRustledgerEnvironment(_ path: String, _ body: () async throws -> Void) async throws {
         try await withEnvironment([
             "TABLEPRO_BEANCOUNT_BACKEND": "rledger",
             "TABLEPRO_RUSTLEDGER_BINARY": path
@@ -1113,7 +1113,7 @@ struct BeancountPluginDriverTests {
         }
     }
 
-    private static func config(
+    static func config(
         _ ledger: URL,
         additionalFields: [String: String] = [:]
     ) -> DriverConnectionConfig {
@@ -1174,7 +1174,7 @@ struct BeancountPluginDriverTests {
         return ledger
     }
 
-    private static func makeTempDirectory() throws -> URL {
+    static func makeTempDirectory() throws -> URL {
         let directory = FileManager.default.temporaryDirectory
             .appendingPathComponent("beancount-driver-\(UUID().uuidString)", isDirectory: true)
         try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
```

**File**: `TableProTests/Plugins/BeancountRledgerOutputTests.swift` (added, +188/-0)
```diff
@@ -0,0 +1,188 @@
+//
+//  BeancountRledgerOutputTests.swift
+//  TableProTests
+//
+
+import Foundation
+import TableProPluginKit
+import Testing
+
+extension BeancountPluginDriverTests {
+    @Test("reads rledger rows written as objects and as positional arrays")
+    func readsBothRledgerRowShapes() throws {
+        let position = #"{"cost": null, "units": {"currency": "USD", "number": "19.43"}}"#
+        let keyed = Data(#"{"columns": ["account", "position"], "rows": [{"account": "Expenses:Food", "position": \#(position)}]}"#.utf8)
+        let positional = Data(#"{"columns": ["account", "position"], "rows": [["Expenses:Food", \#(position)]]}"#.utf8)
+
+        for data in [keyed, positional] {
+            let result = try BeancountPluginDriver.decodeRustledgerQueryOutput(data, executionTime: 0)
+            #expect(result.columns == ["account", "position"])
+            #expect(result.rows.map { $0.map(\.asText) } == [["Expenses:Food", "19.43 USD"]])
+
+            let rows = try BeancountPluginDriver.decodeRledgerRows(data)
+            #expect(rows.map { $0["account"] as? String } == ["Expenses:Food"])
+        }
+    }
+
+    @Test("keeps two BQL columns that share a name apart")
+    func keepsBQLColumnsSharingANameApart() throws {
+        let data = Data(#"{"columns": ["a", "a"], "rows": [["2024-01-05", "Assets:Cash"]]}"#.utf8)
+        let result = try BeancountPluginDriver.decodeRustledgerQueryOutput(data, executionTime: 0)
+        #expect(result.rows.map { $0.map(\.asText) } == [["2024-01-05", "Assets:Cash"]])
+    }
+
+    @Test("fails on rledger rows of an unknown shape instead of reading them as no rows")
+    func rejectsUnknownRledgerRowShape() {
+        let data = Data(#"{"columns": ["account"], "rows": ["Assets:Cash"]}"#.utf8)
+        #expect(throws: BeancountDriverError.self) {
+            _ = try BeancountPluginDriver.decodeRustledgerQueryOutput(data, executionTime: 0)
+        }
+        #expect(throws: BeancountDriverError.self) {
+            _ = try BeancountPluginDriver.decodeRledgerRows(data)
+        }
+    }
+
+    @Test("renders rledger values the way rledger prints them")
+    func rendersRledgerValues() throws {
+        let cases: [(json: String, text: String)] = [
+            (#"{"cost": null, "units": {"currency": "USD", "number": "19.43"}}"#, "19.43 USD"),
+            (
+                #"{"cost": {"currency": "USD", "number": "150.00"}, "units": {"currency": "AAPL", "number": "2"}}"#,
+                "2 AAPL {150.00 USD}"
+            ),
+            (#"{"positions": [{"currency": "AAPL", "number": "3"}, {"currency": "USD", "number": "-451.00"}]}"#, "3 AAPL, -451.00 USD"),
+            (#"{"positions": []}"#, ""),
+            (#"["trip", "food"]"#, "trip, food"),
+            (#"{"count": 1, "unit": "month"}"#, "1 month"),
+            (#"{"count": 3, "unit": "day"}"#, "3 days"),
+            (#"{"count": -1, "unit": "week"}"#, "-1 week"),
+            (#"{"count": -9223372036854775808, "unit": "day"}"#, "-9223372036854775808 days"),
+            ("true", "TRUE"),
+            ("false", "FALSE"),
+            ("12", "12"),
+            (#"{"key": "value"}"#, #"{"key":"value"}"#)
+        ]
+        for testCase in cases {
+            let value = try JSONSerialization.jsonObject(with: Data(testCase.json.utf8), options: .fragmentsAllowed)
+            #expect(BeancountPluginDriver.rustledgerCellValue(value) == testCase.text, "\(testCase.json)")
+        }
+    }
+
+    @Test("keeps a directive's own metadata out of the meta column newer rledger releases return")
+    func keepsDirectiveOwnMetadataFromMetaColumn() throws {
+        let meta: [String: Any] = [
+            "filename": "/ledger/main.beancount",
+            "lineno": 3,
+            "__tolerances__": ["USD": "0.005"],
+            "name": "US Dollar"
+        ]
+        let own = try #require(BeancountPluginDriver.ownMetadata(meta) as? [String: Any])
+        #expect(own.keys.sorted() == ["name"])
+        #expect(own["name"] as? String == "US Dollar")
+        #expect(BeancountPluginDriver.ownMetadata(["filename": "/ledger/main.beancount", "lineno": 3]) is NSNull)
+        #expect(BeancountPluginDriver.ownMetadata(nil) is NSNull)
+    }
+
+    @Test(
+        "shows BQL positions as units and cost, and one balance per commodity held in lots",
+        .enabled(if: RustledgerLocator.path != nil, "rledger executable unavailable")
+    )
+    func showsPositionsAndLotBalancesThroughRustledger() async throws {
+        try await Self.withRustledger {
+            let directory = try Self.makeTempDirectory()
+            defer { try? FileManager.default.removeItem(at: directory) }
+
+            let ledger = directory.appendingPathComponent("main.beancount")
+            try """
+            2024-01-01 open Assets:Broker AAPL
+            2024-01-01 open Assets:Cash USD
+            2024-01-01 open Expenses:Food USD
+
+            2024-01-03 * "Cafe" "Lunch" #trip
+              Expenses:Food  19.43
```

**File**: `docs/databases/beancount.mdx` (modified, +3/-1)
```diff
@@ -11,7 +11,7 @@ Install `rledger` or Python Beancount before you connect. The plugin shells out
 
 ## Backend requirements
 
-The compatibility fixture exercises `rledger` 0.22.0 and Python Beancount 3.2.3. Other versions may work, but are not part of that tested contract. Install `rledger` if you are choosing: it wins when both are present, it is the only one that fills `diagnostics`, and BQL runs through it and nothing else.
+The compatibility fixture exercises `rledger` 0.22.0 and 0.24.0, and Python Beancount 3.2.3. Other versions may work, but are not part of that tested contract. Install `rledger` if you are choosing: it wins when both are present, it is the only one that fills `diagnostics`, and BQL runs through it and nothing else.
 
 <CodeGroup>
 ```bash rledger
@@ -145,6 +145,8 @@ BQL: SELECT account FROM accounts ORDER BY account
 
 Table browsing, row counts, and pagination work on a BQL result. SQL parameters do not.
 
+BQL values read as Beancount writes them: an amount as `19.43 USD`, a position held at cost as `2 AAPL {150.00 USD}`, tags as `trip, food`, and a boolean as `TRUE`. The JSON that `rledger` returns carries no lot date or label, so a position shows neither.
+
 ## Limitations
 
 - No writes. The connection runs at [Safe Mode Read-Only](/features/safe-mode#connections-that-are-always-read-only), and INSERT, UPDATE, DELETE, and every form of schema editing are rejected. Edit the ledger in a text editor; the next query picks the change up.
```

**File**: `project.yml` (modified, +1/-0)
```diff
@@ -438,6 +438,7 @@ targets:
       - Plugins/BeancountDriverPlugin/BeancountPluginDriver+Backend.swift
       - Plugins/BeancountDriverPlugin/BeancountPluginDriver+Projection.swift
       - Plugins/BeancountDriverPlugin/BeancountPluginDriver+PythonScript.swift
+      - Plugins/BeancountDriverPlugin/BeancountPluginDriver+RledgerOutput.swift
       - Plugins/BeancountDriverPlugin/BeancountPluginDriver.swift
       - Plugins/BigQueryDriverPlugin/BigQueryConnection.swift
       - Plugins/BigQueryDriverPlugin/BigQueryCredentialFactory.swift
```

---

### Incident Patch 10: `20c78d08` (2026-10-04)
**Commit Message**: fix: unique index names and one-line type changes in Copy To (#3258)

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -38,6 +38,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Brackets in Redis and etcd command arguments underlined as unmatched.
 - Colons in Elasticsearch URLs, Redis keys and SurrealDB record IDs read as query parameters, holding the run.
 - Counts reading "3 table to export" in the Export dialog, and "1 rows" in the result status bar and query plan.
+- Copy To from MySQL, MariaDB or SQL Server into PostgreSQL, SQLite, DuckDB or Oracle failing on a repeated index name.
+- Copy To review breaking a long ENUM type mid-word, and not naming the table each type change belongs to.
 - Safe Mode's Touch ID prompt reading "TablePro is trying to Authenticate to execute database operations."
 - VoiceOver reading no name for the AI provider pop-up, max output tokens, plugin category filter and CSV NULL text field.
 - Shortcuts Add Row and Add Rows listing no tables until a database or schema is picked, which SQLite never offers.
```

**File**: `TablePro/Core/CrossEngine/CrossEngineConversionNote.swift` (modified, +6/-1)
```diff
@@ -20,19 +20,24 @@ internal struct CrossEngineConversionNote: Identifiable, Hashable, Sendable {
     internal let summary: String
     internal let reason: String
     internal let fidelity: CanonicalTypeFidelity
+    /// True when `summary` is two type spellings rather than a sentence. A spelling has no space
+    /// to wrap at, so an `ENUM` listing its values broke mid-token across two lines.
+    internal let isTypeChange: Bool
 
     internal init(
         table: String,
         subject: String,
         summary: String,
         reason: String,
-        fidelity: CanonicalTypeFidelity
+        fidelity: CanonicalTypeFidelity,
+        isTypeChange: Bool = false
     ) {
         self.table = table
         self.subject = subject
         self.summary = summary
         self.reason = reason
         self.fidelity = fidelity
+        self.isTypeChange = isTypeChange
     }
 
     internal var id: String { "\(table)\u{1F}\(subject)\u{1F}\(summary)" }
```

**File**: `TablePro/Core/CrossEngine/CrossEngineStructureTranslator.swift` (modified, +2/-1)
```diff
@@ -221,7 +221,8 @@ internal enum CrossEngineStructureTranslator {
                 subject: column.name,
                 summary: "\(column.name): \(draft.source.sourceSpelling) → \(rendered.spelling)",
                 reason: reason,
-                fidelity: rendered.fidelity
+                fidelity: rendered.fidelity,
+                isTypeChange: true
             ))
         }
 
```

**File**: `TablePro/Core/ObjectCopy/ObjectCopyIndexNames.swift` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+//
+//  ObjectCopyIndexNames.swift
+//  TablePro
+//
+//  Index names that can stand side by side in the one schema a copy lands in.
+//
+//  MySQL, MariaDB, SQL Server and CockroachDB scope an index name to its table,
+//  so every table of a shop can have its own `user_id` index. PostgreSQL,
+//  SQLite, DuckDB and Oracle scope it to the schema, and the second
+//  `CREATE INDEX "user_id"` was refused with `relation "user_id" already
+//  exists`, stopping the copy part way through its tables.
+//
+
+import Foundation
+import TableProPluginKit
+
+internal enum ObjectCopyIndexNames {
+    /// `tables` with every index the target creates renamed where its name would collide.
+    ///
+    /// An index from an engine that scopes names to the table takes its table's name as a prefix,
+    /// PostgreSQL's own convention, unless it already names its table. Prefixing every one rather
+    /// than only the colliding ones keeps the name from depending on which tables went in the same
+    /// run, so a table copied tomorrow does not collide with one copied today. `taken` holds the
+    /// names already in the target schema, folded to lower case, and gains each one given here.
+    internal static func placed(
+        _ tables: [TableStructureSnapshot],
+        avoiding taken: inout Set<String>,
+        from source: DatabaseType,
+        to target: DatabaseType
+    ) -> [TableStructureSnapshot] {
+        guard source != target, sharesOneNamespace(target) else { return tables }
+        let prefixes = !sharesOneNamespace(source)
+        let style = NewTableNameStyle.forDatabaseType(target)
+        taken.formUnion(NewTableNaming.comparisonKeys(for: tables.map(\.name)))
+
+        return tables.map { table in
+            let indexes = table.indexes.map { index -> EditableIndexDefinition in
+                guard !index.isPrimary else { return index }
+                let wanted = prefixes && !names(index.name, table: table.name)
+                    ? "\(table.name)_\(index.name)"
+                    : index.name
+                let fitted = NewTableNaming.truncating(wanted, toByteLength: style.maximumByteLength)
+                let name = NewTableNaming.disambiguating(
+                    fitted.isEmpty ? wanted : fitted, style: style, avoiding: taken
+                )
+                taken.insert(name.lowercased())
+                var renamed = index
+                renamed.name = name
+                return renamed
+            }
+            guard indexes != table.indexes else { return table }
+            return TableStructureSnapshot(
+                name: table.name,
+                schema: table.schema,
+                columns: table.columns,
+                indexes: indexes,
+                foreignKeys: table.foreignKeys,
+                engine: table.engine,
+                charset: table.charset,
+                collation: table.collation
+            )
+        }
+    }
+
+    /// Whether `type` keeps one namespace of index names per schema, shared by all its tables.
+    ///
+    /// Measured by `scripts/probes/check-index-name-scope.sh` for PostgreSQL, SQLite and DuckDB.
+    /// Oracle documents indexes as schema objects in a namespace of their own. CockroachDB
+    /// documents an index name as unique to its table, despite sharing PostgreSQL's types. An engine
+    /// not named here keeps its source names, as every copy did before.
+    internal static func sharesOneNamespace(_ type: DatabaseType) -> Bool {
+        switch SQLTypeFamily.of(type) {
+        case .postgres:
+            return type != .cockroachdb
+        case .sqlite, .duckdb, .oracle:
+            return true
+        default:
+            return false
+        }
+    }
+
+    /// `idx_orders_created_at` already says which table it indexes; `user_id` does not.
+    private static func names(_ index: String, table: String) -> Bool {
+        let index = index.lowercased()
+        let table = table.lowercased()
+        return index.hasPrefix(table + "_")
+            || index.hasSuffix("_" + table)
+            || index.contains("_" + table + "_")
+    }
+}
```

**File**: `TablePro/Core/ObjectCopy/ObjectCopyPlanner.swift` (modified, +25/-1)
```diff
@@ -52,6 +52,9 @@ internal struct ObjectCopyPlanner {
         /// A copy into a chosen target resolves every scope to the same endpoint, so a database
         /// with twelve schemas read the same catalog twelve times.
         var targetObjectsByEndpoint: [String: [String: ObjectCopySelection]] = [:]
+        /// Every source scope of a copy to a chosen target lands in the one schema that was chosen,
+        /// so the names its indexes take are allocated across scopes, not afresh for each.
+        var indexNamesByEndpoint: [String: Set<String>] = [:]
 
         for scope in Self.scopes(of: request) {
             let names = Set(scope.objects.map(\.name))
@@ -81,15 +84,19 @@ internal struct ObjectCopyPlanner {
                 }
             }
 
+            var indexNames = indexNamesByEndpoint[targetEndpoint.id]
+                ?? NewTableNaming.comparisonKeys(for: targetObjects.values.map(\.name))
             tableSteps += try await buildTableSteps(
                 request,
                 scope: scope,
                 sourceEndpoint: sourceEndpoint,
                 targetEndpoint: targetEndpoint,
                 sourceReads: sourceReads,
                 targetReads: targetReads,
+                indexNames: &indexNames,
                 skipped: &skipped
             )
+            indexNamesByEndpoint[targetEndpoint.id] = indexNames
             definitionSteps += try await buildDefinitionSteps(
                 request,
                 scope: scope,
@@ -278,6 +285,7 @@ internal struct ObjectCopyPlanner {
         targetEndpoint: DatabaseEndpoint,
         sourceReads: [TableStructureRead],
         targetReads: [TableStructureRead],
+        indexNames: inout Set<String>,
         skipped: inout [ObjectCopySkip]
     ) async throws -> [ObjectCopyTableStep] {
         var reads: [ObjectCopySelection: TableStructureRead] = [:]
@@ -341,6 +349,7 @@ internal struct ObjectCopyPlanner {
         let sourceParts = try await readSourceParts(drafts, endpoint: sourceEndpoint)
         let ddl = try await buildTargetDDL(
             drafts,
+            indexNames: &indexNames,
             request: request,
             targetEndpoint: targetEndpoint,
             sourceNamespace: sourceNamespace,
@@ -545,18 +554,33 @@ internal struct ObjectCopyPlanner {
 
     private func buildTargetDDL(
         _ drafts: [ObjectCopyTableDraft],
+        indexNames: inout Set<String>,
         request: ObjectCopyRequest,
         targetEndpoint: DatabaseEndpoint,
         sourceNamespace: String?,
         targetNamespace: String?
     ) async throws -> [String: ObjectCopyTableDDL] {
+        let created = drafts.filter(\.writesStructure)
+        indexNames.formUnion(NewTableNaming.comparisonKeys(for: drafts.map(\.targetTable)))
+        let placed = ObjectCopyIndexNames.placed(
+            created.map(\.targetStructure),
+            avoiding: &indexNames,
+            from: request.source.databaseType,
+            to: request.target.databaseType
+        )
+        let structures = Dictionary(
+            zip(created.map(\.selection.id), placed), uniquingKeysWith: { first, _ in first }
+        )
         let inputs = drafts.map {
             ObjectCopyDDLInput(
                 id: $0.selection.id,
                 /// The translated structure, so the `CREATE TABLE` the target driver writes names
                 /// types that engine has. Identical to the source's within one type family.
                 snapshot: Self.retargeted(
-                    $0.targetStructure, from: sourceNamespace, to: targetNamespace, schema: $0.targetSchema
+                    structures[$0.selection.id] ?? $0.targetStructure,
+                    from: sourceNamespace,
+                    to: targetNamespace,
+                    schema: $0.targetSchema
                 ),
                 targetSchema: $0.targetSchema,
                 writesStructure: $0.writesStructure,
```

**File**: `TablePro/Core/Services/Export/NewTableNaming.swift` (modified, +2/-2)
```diff
@@ -156,7 +156,7 @@ enum NewTableNaming {
 
     /// Cuts on a `Character` boundary while counting UTF-8 bytes, because the engines state their
     /// limits in bytes and a multi-byte name would otherwise be cut mid-grapheme.
-    private static func truncating(_ name: String, toByteLength limit: Int) -> String {
+    static func truncating(_ name: String, toByteLength limit: Int) -> String {
         guard name.utf8.count > limit else { return name }
         var result = ""
         var usedBytes = 0
@@ -178,7 +178,7 @@ enum NewTableNaming {
 
     /// One more candidate than there are names guarantees a free one, so the walk is bounded by
     /// the catalog rather than by a constant that a large schema could exhaust.
-    private static func disambiguating(
+    static func disambiguating(
         _ name: String,
         style: NewTableNameStyle,
         avoiding existingKeys: Set<String>
```

**File**: `TablePro/Views/ObjectCopy/CopyObjectsReviewView.swift` (modified, +18/-2)
```diff
@@ -135,16 +135,18 @@ internal struct CopyObjectsReviewView: View {
         }
     }
 
+    /// The table goes beside the reason, as the "Partly copied" and "Left out" rows put it: a
+    /// copy of several tables listed `status: enum(…) → VARCHAR(9)` once per table that had one.
     private func conversion(_ note: CrossEngineConversionNote) -> some View {
         VStack(alignment: .leading, spacing: 2) {
             Label {
-                Text(note.summary)
+                summary(note)
             } icon: {
                 Image(systemName: note.isLossy ? "exclamationmark.triangle" : "arrow.right.circle")
             }
             .font(.callout)
             .foregroundStyle(note.isLossy ? AnyShapeStyle(.orange) : AnyShapeStyle(.secondary))
-            Text(note.reason)
+            Text(verbatim: "\(note.table): \(note.reason)")
                 .font(.caption)
                 .foregroundStyle(.secondary)
                 .fixedSize(horizontal: false, vertical: true)
@@ -153,6 +155,20 @@ internal struct CopyObjectsReviewView: View {
         .accessibilityElement(children: .combine)
     }
 
+    /// A type change stays on one line, cut in the middle so the column and the type it becomes
+    /// both stay in view, with the whole spelling in the tooltip.
+    @ViewBuilder
+    private func summary(_ note: CrossEngineConversionNote) -> some View {
+        if note.isTypeChange {
+            Text(note.summary)
+                .lineLimit(1)
+                .truncationMode(.middle)
+                .help(note.summary)
+        } else {
+            Text(note.summary)
+        }
+    }
+
     @ViewBuilder
     private func notes(_ plan: ObjectCopyPlan) -> some View {
         let noted = plan.partialNotes
```

**File**: `TableProTests/Core/CrossEngine/CrossEngineStructureTranslatorTests.swift` (modified, +15/-0)
```diff
@@ -265,6 +265,21 @@ final class CrossEngineStructureTranslatorTests: XCTestCase {
         XCTAssertTrue(result.notes.contains { $0.subject == "total" })
     }
 
+    /// The review keeps a type change to one line, cut in the middle, because a spelling such as an
+    /// `ENUM` value list has no space to wrap at. A note written as a sentence still wraps.
+    func testATypeChangeIsMarkedApartFromASentence() throws {
+        let source = snapshot(columns: [
+            column("status", "enum('pending','paid','shipped','delivered','cancelled','refunded')"),
+            column("total", "DECIMAL(10,2)", generation: "price * quantity")
+        ])
+        let result = CrossEngineStructureTranslator.translate(source, from: .mariadb, to: .postgresql)
+        let status = try XCTUnwrap(result.notes.first { $0.subject == "status" })
+        XCTAssertTrue(status.isTypeChange)
+        XCTAssertTrue(status.summary.hasSuffix("→ VARCHAR(9)"))
+        let total = try XCTUnwrap(result.notes.first { $0.subject == "total" })
+        XCTAssertFalse(total.isTypeChange)
+    }
+
     // MARK: - Keys and indexes
 
     /// MySQL refuses a `PRIMARY KEY` on a `LONGTEXT` outright, and the whole `CREATE TABLE` fails
```

---

### Incident Patch 11: `46793b25` (2026-10-04)
**Commit Message**: fix(ios): Shortcuts Add Row lists no tables for SQLite connections (#3259)

Signed-off-by: Dat Ngo Quoc <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -40,6 +40,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Counts reading "3 table to export" in the Export dialog, and "1 rows" in the result status bar and query plan.
 - Safe Mode's Touch ID prompt reading "TablePro is trying to Authenticate to execute database operations."
 - VoiceOver reading no name for the AI provider pop-up, max output tokens, plugin category filter and CSV NULL text field.
+- Shortcuts Add Row and Add Rows listing no tables until a database or schema is picked, which SQLite never offers.
 - Server Dashboard's metrics staying on a spinner, and slow queries never refreshing.
 - Users & Roles privilege checkboxes, Review & Apply and "Modified" not updating after a click.
 - Count Exactly on a Redis database leaving the estimate in place.
```

**File**: `TableProMobile/TableProMobile/Intents/TableEntity.swift` (modified, +34/-13)
```diff
@@ -13,32 +13,53 @@ struct TableEntity: AppEntity {
     }
 }
 
+nonisolated struct TableListingScope: Equatable, Sendable {
+    let connectionId: UUID
+    let namespace: String?
+
+    static func resolve(
+        scoped: (connection: ConnectionEntity, database: DatabaseEntity)?,
+        connection: ConnectionEntity?
+    ) -> TableListingScope? {
+        if let scoped {
+            return TableListingScope(connectionId: scoped.connection.id, namespace: scoped.database.id)
+        }
+        guard let connection else { return nil }
+        return TableListingScope(connectionId: connection.id, namespace: nil)
+    }
+}
+
+/// A dependency hands back every parameter it lists unwrapped, so one that lists the optional
+/// database stays nil until a database is picked. SQLite never offers one, hence the separate
+/// connection-only dependencies.
 struct TableEntityQuery: EntityQuery {
-    @IntentParameterDependency<AddRowToTableIntent>(\.$connection, \.$database)
+    @IntentParameterDependency<AddRowToTableIntent>(\.$connection)
     var addRow
 
-    @IntentParameterDependency<AddRowsToTableIntent>(\.$connection, \.$database)
+    @IntentParameterDependency<AddRowToTableIntent>(\.$connection, \.$database)
+    var addRowInDatabase
+
+    @IntentParameterDependency<AddRowsToTableIntent>(\.$connection)
     var addRows
 
+    @IntentParameterDependency<AddRowsToTableIntent>(\.$connection, \.$database)
+    var addRowsInDatabase
+
     func entities(for identifiers: [String]) async throws -> [TableEntity] {
         identifiers.map { TableEntity(id: $0, name: $0) }
     }
 
     func suggestedEntities() async throws -> [TableEntity] {
-        guard let context = selectedContext else { return [] }
-        let tables = try? await IntentDatabaseSession.with(connectionId: context.connection.id) {
-            try await $0.tables(namespace: context.database?.id)
+        guard let scope = selectedScope else { return [] }
+        let tables = try? await IntentDatabaseSession.with(connectionId: scope.connectionId) {
+            try await $0.tables(namespace: scope.namespace)
         }
         return tables ?? []
     }
 
-    private var selectedContext: (connection: ConnectionEntity, database: DatabaseEntity?)? {
-        if let addRow {
-            return (addRow.connection, addRow.database)
-        }
-        if let addRows {
-            return (addRows.connection, addRows.database)
-        }
-        return nil
+    private var selectedScope: TableListingScope? {
+        let scoped = addRowInDatabase.map { (connection: $0.connection, database: $0.database) }
+            ?? addRowsInDatabase.map { (connection: $0.connection, database: $0.database) }
+        return TableListingScope.resolve(scoped: scoped, connection: addRow?.connection ?? addRows?.connection)
     }
 }
```

**File**: `TableProMobile/TableProMobileTests/Intents/TableListingScopeTests.swift` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+import Foundation
+@testable import TableProMobile
+import Testing
+
+@Suite("TableListingScope")
+struct TableListingScopeTests {
+    private let sqlite = ConnectionEntity(id: UUID(), name: "Chinook", host: "", databaseType: "SQLite")
+    private let postgres = ConnectionEntity(id: UUID(), name: "Prod", host: "db.example.com", databaseType: "PostgreSQL")
+
+    @Test("a connection with no database picked lists its own tables")
+    func connectionAloneListsItsTables() {
+        let scope = TableListingScope.resolve(scoped: nil, connection: sqlite)
+
+        #expect(scope == TableListingScope(connectionId: sqlite.id, namespace: nil))
+    }
+
+    @Test("a picked schema narrows the list to that schema")
+    func pickedSchemaNarrowsTheList() {
+        let schema = DatabaseEntity(id: "public", name: "public", kind: .schema)
+
+        let scope = TableListingScope.resolve(scoped: (postgres, schema), connection: postgres)
+
+        #expect(scope == TableListingScope(connectionId: postgres.id, namespace: "public"))
+    }
+
+    @Test("nothing is listed before a connection is picked")
+    func noConnectionListsNothing() {
+        #expect(TableListingScope.resolve(scoped: nil, connection: nil) == nil)
+    }
+}
```

**File**: `docs/external-api/ios-shortcuts.mdx` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ To browse everything the app offers, open Shortcuts, tap the action list, and go
   <Step title="Point it at a table">
     Pick a **Connection**, then a **Table** read live from it. **Database or Schema** is optional and
     lists schemas on PostgreSQL and the like, databases elsewhere; empty means the connection's own.
+    SQLite has neither, so it stays empty there.
   </Step>
   <Step title="Supply the row">
     Feed **Row (JSON or CSV)** from a Shortcuts **Dictionary** action keyed by column name, which
```

---

### Incident Patch 12: `f1b319b0` (2026-10-04)
**Commit Message**: fix(hig): redraw stale dashboard and privilege views, unclip panes (#3257)

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -40,6 +40,12 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Counts reading "3 table to export" in the Export dialog, and "1 rows" in the result status bar and query plan.
 - Safe Mode's Touch ID prompt reading "TablePro is trying to Authenticate to execute database operations."
 - VoiceOver reading no name for the AI provider pop-up, max output tokens, plugin category filter and CSV NULL text field.
+- Server Dashboard's metrics staying on a spinner, and slow queries never refreshing.
+- Users & Roles privilege checkboxes, Review & Apply and "Modified" not updating after a click.
+- Count Exactly on a Redis database leaving the estimate in place.
+- Status bar truncating the row count and Count Exactly instead of dropping to a narrower layout.
+- Query editor bar cut off, with the editor's text over it, when the editor pane is at its smallest.
+- Long column names drawn over their type in the ER diagram.
 
 ## [0.77.1] - 2026-10-03
 
```

**File**: `Plugins/RedisDriverPlugin/RedisCommandChannel.swift` (modified, +26/-0)
```diff
@@ -186,6 +186,32 @@ extension RedisCommandChannel {
         let page = RedisScanReply.parse(reply)
         return RedisKeyspacePage(cursor: page.cursor, keys: page.keys, isIncomplete: false)
     }
+
+    /// The keys a scan with this glob and type scope visits, walked to the end and each counted
+    /// once: SCAN may return a key twice while the keyspace rehashes, so the pages are
+    /// deduplicated rather than tallied. A cluster that lost or replaced a node mid-walk cannot
+    /// say it visited every key, so that walk throws rather than report a total as exact.
+    func countKeys(pattern: String?, type: String?) async throws -> Int {
+        var seen = Set<String>()
+        var cursor = RedisClusterCursor.start
+
+        repeat {
+            try Task.checkCancellation()
+            let page = try await scanKeyspace(
+                cursor: cursor, pattern: pattern, type: type, count: 1_000, scope: .outsideBlock
+            )
+            guard !page.isIncomplete else {
+                throw RedisPluginError(
+                    code: 0,
+                    message: String(localized: "The cluster changed while its keys were being counted. Count again.")
+                )
+            }
+            cursor = page.cursor
+            seen.formUnion(page.keys)
+        } while cursor != RedisClusterCursor.start
+
+        return seen.count
+    }
 }
 
 enum RedisScanReply {
```

**File**: `Plugins/RedisDriverPlugin/RedisPluginDriver.swift` (modified, +27/-0)
```diff
@@ -300,6 +300,33 @@ final class RedisPluginDriver: PluginDatabaseDriver, @unchecked Sendable {
         return try await conn.keyCount(inDatabase: index)
     }
 
+    /// What `Count Exactly` runs on a database tab. Without it the kit's default answered nil, which
+    /// the app reads as "no count", so the button stayed and the estimate was never replaced.
+    ///
+    /// An unfiltered tab is counted by the same reading the estimate came from: `DBSIZE` and
+    /// `INFO keyspace` both report the exact number of keys a database holds. A filtered tab is
+    /// counted by scanning with its browse's own `MATCH` glob and `TYPE` scope to the end, without
+    /// the cap the browse stops at, because nothing short of the whole scan is exact.
+    func fetchExactRowCount(
+        table: String,
+        schema: String?,
+        filters: [(column: String, op: String, value: String)],
+        logicMode: String
+    ) async throws -> Int? {
+        guard let conn = redisConnection else {
+            throw RedisPluginError.notConnected
+        }
+        guard let index = RedisDatabaseIndex.parse(table) else { return nil }
+
+        let scope = RedisQueryBuilder().browseScope(filters: filters)
+        guard scope.pattern != nil || scope.typeScope != nil else {
+            return try await conn.keyCount(inDatabase: index)
+        }
+        return try await conn.withDatabase(index) {
+            try await conn.countKeys(pattern: scope.pattern, type: scope.typeScope)
+        }
+    }
+
     func fetchTableDDL(table: String, schema: String?) async throws -> String {
         guard let conn = redisConnection else {
             throw RedisPluginError.notConnected
```

**File**: `Plugins/RedisDriverPlugin/RedisQueryBuilder.swift` (modified, +13/-4)
```diff
@@ -38,18 +38,27 @@ struct RedisQueryBuilder {
         limit: Int = 200,
         offset: Int = 0
     ) -> String {
-        let pattern = extractBrowsePattern(from: filters, namespace: namespace)
-        let typeScope = extractTypeScope(from: filters)
+        let scope = browseScope(filters: filters, namespace: namespace)
 
-        guard pattern != nil || typeScope != nil else {
+        guard scope.pattern != nil || scope.typeScope != nil else {
             return buildBaseQuery(namespace: namespace, database: database, limit: limit, offset: offset)
         }
 
         return buildKeyBrowseQuery(
-            pattern: pattern, typeScope: typeScope, database: database, limit: limit, offset: offset
+            pattern: scope.pattern, typeScope: scope.typeScope, database: database, limit: limit, offset: offset
         )
     }
 
+    /// The SCAN `MATCH` glob and `TYPE` scope a filtered browse lists keys by, both nil when the
+    /// filters narrow nothing. The exact row count reads the same pair, so it counts the keys the
+    /// grid would list rather than a reading of the filters of its own.
+    func browseScope(
+        filters: [(column: String, op: String, value: String)],
+        namespace: String = ""
+    ) -> (pattern: String?, typeScope: String?) {
+        (extractBrowsePattern(from: filters, namespace: namespace), extractTypeScope(from: filters))
+    }
+
     /// Streamed, so the whole database is read and `LIMIT` is never consulted.
     func buildExportQuery(database: Int?) -> String {
         guard let database else { return "KEYBROWSE" }
```

**File**: `TablePro/Core/Coordinators/PaginationCoordinator.swift` (modified, +11/-1)
```diff
@@ -171,6 +171,11 @@ final class PaginationCoordinator: ObservableObject {
         let schemaName = tab.tableContext.schemaName
         let filters = tab.filterState.hasAppliedFilters ? tab.filterState.appliedFilters : []
         let logicMode = tab.filterState.filterLogicMode
+        /// A browse narrowed by the plugin's own search runs that search instead of the table
+        /// filters, so the count has to read the same search or it counts the whole table.
+        let browseFilters = parent.filterCoordinator.usesBrowseSearch && tab.filterState.hasActiveBrowseSearch
+            ? tab.filterState.browseSearch.pluginQueryFilters
+            : nil
         let isNonSQL = PluginManager.shared.editorLanguage(for: parent.connection.type) != .sql
         let queryColumns = parent.queryColumns(for: tab)
         let countSQL = isNonSQL ? nil : parent.queryBuilder.buildFilteredCountQuery(
@@ -195,6 +200,7 @@ final class PaginationCoordinator: ObservableObject {
                 tableName: tableName,
                 filters: filters,
                 logicMode: logicMode,
+                browseFilters: browseFilters,
                 countSQL: countSQL
             )
 
@@ -243,11 +249,15 @@ final class PaginationCoordinator: ObservableObject {
         tableName: String,
         filters: [TableFilter],
         logicMode: FilterLogicMode,
+        browseFilters: [PluginQueryFilter]?,
         countSQL: String?
     ) async -> Result<Int?, Error> {
         do {
             let count = try await DatabaseManager.shared.withMetadataDriver(scope: scope, workload: .bulk) { driver in
-                try await ExactRowCounter.count(
+                if let browseFilters {
+                    return try await driver.fetchExactRowCount(table: tableName, browseFilters: browseFilters)
+                }
+                return try await ExactRowCounter.count(
                     on: driver, table: tableName, filters: filters, logicMode: logicMode, countSQL: countSQL
                 )
             }
```

**File**: `TablePro/Core/Database/DatabaseDriver.swift` (modified, +5/-0)
```diff
@@ -216,6 +216,10 @@ protocol DatabaseDriver: AnyObject, Sendable {
     /// counts to keep browsing responsive must not apply that cap here.
     func fetchExactRowCount(table: String, filters: [TableFilter], logicMode: FilterLogicMode) async throws -> Int?
 
+    /// The exact count of a browse narrowed by a search the plugin defines, such as Redis's key
+    /// pattern and type, rather than by table filters. Nil when the driver has no such count.
+    func fetchExactRowCount(table: String, browseFilters: [PluginQueryFilter]) async throws -> Int?
+
     /// Fetch the DDL (CREATE TABLE statement) for a specific table
     func fetchTableDDL(table: String) async throws -> String
 
@@ -769,6 +773,7 @@ extension DatabaseDriver {
     func fetchExactRowCount(table: String, filters: [TableFilter], logicMode: FilterLogicMode) async throws -> Int? {
         try await fetchFilteredRowCount(table: table, filters: filters, logicMode: logicMode)
     }
+    func fetchExactRowCount(table: String, browseFilters: [PluginQueryFilter]) async throws -> Int? { nil }
 
     func maintenanceOperations() -> [PluginMaintenanceOperation]? { nil }
     func maintenanceStatements(
```

**File**: `TablePro/Core/Plugins/PluginDriverAdapter.swift` (modified, +9/-0)
```diff
@@ -599,6 +599,15 @@ final class PluginDriverAdapter: DatabaseDriver, SchemaSwitchable, DatabaseRepor
         )
     }
 
+    func fetchExactRowCount(table: String, browseFilters: [PluginQueryFilter]) async throws -> Int? {
+        try await pluginDriver.fetchExactRowCount(
+            table: table,
+            schema: pluginDriver.currentSchema,
+            queryFilters: browseFilters,
+            logicMode: "and"
+        )
+    }
+
     func fetchTableDDL(table: String) async throws -> String {
         try await fetchTableDDL(table: table, schema: nil)
     }
```

**File**: `TablePro/Core/Services/Query/TableQueryBuilder.swift` (modified, +2/-8)
```diff
@@ -160,14 +160,8 @@ struct TableQueryBuilder {
             let sortCols = SortColumnResolver.resolvedIndices(
                 for: sortState, displayColumns: columns, targetColumns: targetColumns
             )
-            var tuples: [(column: String, op: String, value: String)] = []
-            let trimmedPattern = pattern.trimmingCharacters(in: .whitespaces)
-            if !trimmedPattern.isEmpty {
-                tuples.append((column: "Key", op: "MATCH", value: trimmedPattern))
-            }
-            if let typeScope, !typeScope.isEmpty {
-                tuples.append((column: "Type", op: "=", value: typeScope))
-            }
+            let tuples = BrowseSearchState(pattern: pattern, typeScope: typeScope).pluginQueryFilters
+                .map { (column: $0.column, op: $0.op, value: $0.value) }
             if let result = pluginDriver.buildFilteredQuery(
                 table: tableName, schema: schemaName, filters: tuples,
                 logicMode: "and", sortColumns: sortCols,
```

---

### Incident Patch 13: `953b52b5` (2026-10-04)
**Commit Message**: fix(editor): check request bodies as JSON and bind :name in SQL only (#3255)

Signed-off-by: Dat Ngo Quoc <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -23,6 +23,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Last column's divider sitting on the grid's right edge, where it could not be dragged to resize.
 - Cells keeping their old width or order while a column is resized or dragged, until the mouse is released.
 - Resize cursor showing a few points from a column divider, where a drag moved the column instead.
+- Elasticsearch, Typesense and Weaviate request bodies underlined as syntax errors although they run.
+- Wildcard index paths such as `GET /_cat/indices/*` underlined as an unterminated comment.
+- Brackets in Redis and etcd command arguments underlined as unmatched.
+- Colons in Elasticsearch URLs, Redis keys and SurrealDB record IDs read as query parameters, holding the run.
 - Counts reading "3 table to export" in the Export dialog, and "1 rows" in the result status bar and query plan.
 - Safe Mode's Touch ID prompt reading "TablePro is trying to Authenticate to execute database operations."
 - VoiceOver reading no name for the AI provider pop-up, max output tokens, plugin category filter and CSV NULL text field.
```

**File**: `TablePro/Core/Coordinators/QueryExecutionCoordinator.swift` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ final class QueryExecutionCoordinator: ObservableObject {
         let statements = batches.flatMap(\.statements)
         guard !statements.isEmpty else { return }
 
-        if AppSettingsManager.shared.editor.queryParametersEnabled, parent.statementModel == .sql {
+        if AppSettingsManager.shared.editor.queryParametersEnabled, parent.bindsNamedParameters {
             let combinedSQL = SQLParameterExtractor.parameterSource(of: statements)
             let detectedNames = SQLParameterExtractor.extractParameters(from: combinedSQL)
 
```

**File**: `TablePro/Core/Diagnostics/ConsoleRequestDiagnosticsProducer.swift` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+import Foundation
+
+/// Underlines what a console request can never send: a JSON body whose brackets do not close.
+///
+/// Elasticsearch, Typesense and Weaviate highlight as JavaScript because their bodies are JSON, but
+/// the document is an HTTP request line followed by that body, not a JavaScript program. Parsed as
+/// one, every `"query": {` is a syntax error.
+///
+/// The request line is left out of the scan because it is a URL: `GET /_cat/indices/*` holds a
+/// `/*` that is a wildcard, not the start of a comment, and a query string may hold any bracket.
+/// Like the console parsers, only the document's first line is read as the request line.
+struct ConsoleRequestDiagnosticsProducer: QueryDiagnosticsProducing {
+    private static let requestMethods: Set<String> = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]
+
+    func diagnostics(for text: String) -> [QueryDiagnostic] {
+        let source = text as NSString
+        guard source.length > 0, source.length <= QueryDiagnosticsLimits.maximumDocumentLength else { return [] }
+
+        // The body highlights as JavaScript, so `//` and `/* */` read as comments on screen and the
+        // scan has to read them the same way.
+        let structure = QueryBracketScanner.scan(blankingRequestLine(source), comments: .javaScript)
+        var results: [QueryDiagnostic] = []
+
+        if let range = structure.unmatchedClose {
+            results.append(QueryDiagnostic(range: range, message: String(localized: "No matching opening bracket")))
+        }
+        if let range = structure.unterminatedComment {
+            results.append(QueryDiagnostic(range: range, message: String(localized: "Unterminated comment")))
+        }
+
+        return results
+    }
+
+    /// The document with its request line replaced by spaces, when its first line is one.
+    ///
+    /// Blanked rather than removed, so a range the scan reports still points at the text the reader typed.
+    /// Weaviate also takes a body on the request line itself, `POST /objects {"class": "Article"}`, so text
+    /// after the path that opens like JSON stays in the scan.
+    private func blankingRequestLine(_ source: NSString) -> NSString {
+        let firstVisible = source.rangeOfCharacter(from: CharacterSet.whitespacesAndNewlines.inverted)
+        guard firstVisible.location != NSNotFound else { return source }
+
+        var contentsEnd = 0
+        source.getLineStart(nil, end: nil, contentsEnd: &contentsEnd, for: firstVisible)
+        let lineText = source.substring(with: NSRange(location: firstVisible.location, length: contentsEnd - firstVisible.location))
+        let words = lineText.split(maxSplits: 2, omittingEmptySubsequences: true, whereSeparator: \.isWhitespace)
+        guard let method = words.first, Self.requestMethods.contains(method.uppercased()) else { return source }
+
+        var requestEnd = lineText.endIndex
+        if words.count == 3, let opener = words[2].first, opener == "{" || opener == "[" {
+            requestEnd = words[2].startIndex
+        }
+        let request = NSRange(lineText.startIndex ..< requestEnd, in: lineText)
+        let blanked = NSMutableString(string: source)
+        blanked.replaceCharacters(
+            in: NSRange(location: firstVisible.location, length: request.length),
+            with: String(repeating: " ", count: request.length)
+        )
+        return blanked
+    }
+}
```

**File**: `TablePro/Core/Diagnostics/QueryDiagnostic.swift` (modified, +12/-2)
```diff
@@ -45,15 +45,25 @@ enum QueryDiagnosticsFactory {
     static func make(for databaseType: DatabaseType?) -> QueryDiagnosticsProducing {
         let resolvedType = databaseType ?? .mysql
 
+        // Highlighting as JavaScript does not make the language JavaScript: Elasticsearch, Typesense
+        // and Weaviate do it for their JSON bodies. Only a MongoDB script is a program the parser can check.
+        if QueryStatementModel.forDatabaseType(resolvedType) == .javascript {
+            return MongoDiagnosticsProducer()
+        }
+
         switch PluginManager.shared.editorLanguage(for: resolvedType) {
         case .javascript:
-            return MongoDiagnosticsProducer()
+            return ConsoleRequestDiagnosticsProducer()
         case .sql:
             return CombinedQueryDiagnosticsProducer(producers: [
                 SQLDiagnosticsProducer(),
                 SQLConfusableCharacterDiagnosticsProducer(grammar: resolvedType.lexicalGrammar)
             ])
-        default:
+        case .bash:
+            // A command line's arguments are plain text, so `SET smile :)` holds a bracket that closes
+            // nothing and is still a valid command. There is no structure to check.
+            return CombinedQueryDiagnosticsProducer(producers: [])
+        case .custom:
             return SQLDiagnosticsProducer()
         }
     }
```

**File**: `TablePro/Views/Main/MainContentCoordinator.swift` (modified, +8/-4)
```diff
@@ -147,6 +147,13 @@ final class MainContentCoordinator: ObservableObject {
         SQLLexicalResolver.executionGrammar(for: connection.type, connectionId: connectionId)
     }
     var statementModel: QueryStatementModel { QueryStatementModel.forDatabaseType(connection.type) }
+    /// Whether `:name` in this connection's queries is a bind parameter, which it is only in SQL.
+    ///
+    /// Every other language already gives the colon a meaning: an object key in a MongoDB script, a field
+    /// query in an Elasticsearch URL (`?q=name:lamp`), a key separator in Redis (`GET user:name`), a record
+    /// id in SurrealQL (`person:tobie`). Read as a parameter, it opens the panel, holds the run until a value
+    /// is typed, and then sends a placeholder the engine's driver never binds.
+    var bindsNamedParameters: Bool { services.pluginManager.editorLanguage(for: connection.type) == .sql }
     var browseDatabaseName: String {
         services.databaseManager.browseDatabaseName(for: connection)
     }
@@ -1117,10 +1124,7 @@ final class MainContentCoordinator: ObservableObject {
             return true
         }
 
-        // `:active` is a bind placeholder in SQL and an ordinary object key in JavaScript, so a
-        // script would open the parameter panel and then be rewritten into something the driver
-        // cannot run.
-        if services.appSettings.editor.queryParametersEnabled, statementModel == .sql {
+        if services.appSettings.editor.queryParametersEnabled, bindsNamedParameters {
             let combinedSQL = SQLParameterExtractor.parameterSource(of: statements)
             let detectedNames = SQLParameterExtractor.extractParameters(from: combinedSQL)
 
```

**File**: `TableProTests/Core/Diagnostics/ConsoleRequestDiagnosticsProducerTests.swift` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+//
+//  ConsoleRequestDiagnosticsProducerTests.swift
+//  TableProTests
+//
+
+import Foundation
+import Testing
+
+@testable import TablePro
+
+struct ConsoleRequestDiagnosticsProducerTests {
+    private let producer = ConsoleRequestDiagnosticsProducer()
+
+    private static let searchRequest = """
+        GET /products/_search
+        {
+          "query": {
+            "match": {
+              "name": "desk lamp"
+            }
+          }
+        }
+        """
+
+    @Test("A search request with a Query DSL body is not flagged")
+    func validSearchRequestIsQuiet() {
+        #expect(producer.diagnostics(for: Self.searchRequest).isEmpty)
+    }
+
+    @Test("A wildcard in the request path is not read as a comment")
+    func wildcardPathIsQuiet() {
+        #expect(producer.diagnostics(for: "GET /_cat/indices/*?v").isEmpty)
+        #expect(producer.diagnostics(for: "\n  get /*/_search\n{\"size\": 0}").isEmpty)
+    }
+
+    @Test("A bracket in the query string is not checked")
+    func queryStringBracketIsQuiet() {
+        #expect(producer.diagnostics(for: "GET /products/_search?q=name:(lamp OR desk))").isEmpty)
+    }
+
+    @Test("A body written on the request line is checked")
+    func inlineBodyIsChecked() {
+        let text = "POST /objects {\"class\": \"Article\"}}"
+        #expect(producer.diagnostics(for: text).map(\.range) == [NSRange(location: (text as NSString).length - 1, length: 1)])
+        #expect(producer.diagnostics(for: "POST /objects {\"class\": \"Article\"}").isEmpty)
+    }
+
+    @Test("A closing bracket in the body with no opener is reported where it was typed")
+    func unmatchedCloseInBodyIsReported() {
+        let text = "POST /products/_search\n{\"size\": 1}}"
+        let results = producer.diagnostics(for: text)
+        #expect(results.map(\.range) == [NSRange(location: (text as NSString).length - 1, length: 1)])
+        #expect(results.first?.severity == .error)
+    }
+
+    @Test("An unterminated comment in the body is reported")
+    func unterminatedCommentInBodyIsReported() {
+        let results = producer.diagnostics(for: "GET /products/_search\n/* size\n{\"size\": 1}")
+        #expect(results.map(\.range) == [NSRange(location: 22, length: 2)])
+    }
+
+    @Test("A half-typed body is left alone")
+    func partialBodyIsQuiet() {
+        #expect(producer.diagnostics(for: "GET /products/_search\n{\"query\": {\"match\": {").isEmpty)
+    }
+
+    @Test("A document with no request line, such as a GraphQL query, is checked whole")
+    func documentWithoutRequestLineIsCheckedWhole() {
+        #expect(producer.diagnostics(for: "{\n  Get {\n    Article { title }\n  }\n}").isEmpty)
+        #expect(producer.diagnostics(for: "{ Get { Article { title } } } }").count == 1)
+    }
+}
+
+@MainActor
+struct QueryDiagnosticsFactoryLanguageTests {
+    @Test(
+        "A console request is checked as a request, not parsed as a MongoDB script",
+        arguments: [DatabaseType.elasticsearch, .typesense, .weaviate]
+    )
+    func consoleRequestIsNotParsedAsJavaScript(type: DatabaseType) {
+        let text = "GET /products/_search\n{\n  \"query\": {\n    \"match\": {\"name\": \"desk lamp\"}\n  }\n}"
+        #expect(QueryDiagnosticsFactory.make(for: type).diagnostics(for: text).isEmpty)
+        #expect(QueryDiagnosticsFactory.make(for: type).diagnostics(for: text + "}").count == 1)
+    }
+
+    @Test("A MongoDB script is still parsed as JavaScript")
+    func mongoScriptIsStillParsed() {
+        #expect(QueryDiagnosticsFactory.make(for: .mongodb).diagnostics(for: "db.orders.find({status: })").count == 1)
+    }
+
+    @Test("A bracket in a command's arguments is not flagged", arguments: [DatabaseType.redis, .etcd])
+    func commandArgumentsAreQuiet(type: DatabaseType) {
+        #expect(QueryDiagnosticsFactory.make(for: type).diagnostics(for: "SET smile :)").isEmpty)
+        #expect(QueryDiagnosticsFactory.make(for: type).diagnostics(for: "KEYS cache/*").isEmpty)
+    }
+}
```

**File**: `TableProTests/Views/Main/QueryParameterDetectionTests.swift` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+//
+//  QueryParameterDetectionTests.swift
+//  TableProTests
+//
+
+import Foundation
+import Testing
+
+@testable import TablePro
+
+@MainActor
+struct QueryParameterDetectionTests {
+    @Test(
+        "Only SQL reads :name as a bind parameter",
+        arguments: [
+            (DatabaseType.mysql, true), (.postgresql, true), (.sqlite, true),
+            (.elasticsearch, false), (.typesense, false), (.weaviate, false), (.mongodb, false),
+            (.redis, false), (.etcd, false), (.surrealdb, false), (.kafka, false)
+        ]
+    )
+    func onlySQLBindsNamedParameters(type: DatabaseType, binds: Bool) {
+        let harness = QueryTabHarness(type: type, query: "")
+        defer { harness.tearDown() }
+        #expect(harness.coordinator.bindsNamedParameters == binds)
+    }
+
+    @Test("A field query in an Elasticsearch URL runs instead of asking for a parameter")
+    func elasticsearchFieldQueryRuns() throws {
+        let query = "GET /products/_search?q=name:lamp"
+        let harness = QueryTabHarness(type: .elasticsearch, query: query)
+        defer { harness.tearDown() }
+
+        #expect(harness.coordinator.runStatement(query, sourceOffset: 0))
+
+        let tab = try #require(harness.tabManager.tabs.first)
+        #expect(tab.content.queryParameters.isEmpty)
+        #expect(!tab.content.isParameterPanelVisible)
+    }
+
+    @Test("A SQL :name still opens the parameter panel before anything runs")
+    func sqlParameterOpensPanel() throws {
+        let query = "SELECT * FROM products WHERE name = :name"
+        let harness = QueryTabHarness(type: .mysql, query: query)
+        defer { harness.tearDown() }
+
+        #expect(!harness.coordinator.runStatement(query, sourceOffset: 0))
+
+        let tab = try #require(harness.tabManager.tabs.first)
+        #expect(tab.content.queryParameters.map(\.name) == ["name"])
+        #expect(tab.content.isParameterPanelVisible)
+    }
+}
+
+/// A coordinator with one query tab selected and no session behind it.
+///
+/// Query parameters are switched on for the length of the test and the user's own setting put back,
+/// so the run paths answer to the shipped default rather than to the machine running them.
+@MainActor
+private struct QueryTabHarness {
+    let coordinator: MainContentCoordinator
+    let tabManager: QueryTabManager
+    private let previousParametersSetting: Bool
+
+    init(type: DatabaseType, query: String) {
+        previousParametersSetting = AppSettingsManager.shared.editor.queryParametersEnabled
+        AppSettingsManager.shared.editor.queryParametersEnabled = true
+        tabManager = QueryTabManager()
+        coordinator = MainContentCoordinator(
+            connection: TestFixtures.makeConnection(type: type),
+            tabManager: tabManager,
+            changeManager: DataChangeManager(),
+            toolbarState: ConnectionToolbarState()
+        )
+        let tab = QueryTab(title: "Query", query: query, tabType: .query)
+        tabManager.tabs.append(tab)
+        tabManager.selectedTabId = tab.id
+    }
+
+    func tearDown() {
+        coordinator.cancelAllQueryTasks()
+        coordinator.teardown()
+        AppSettingsManager.shared.editor.queryParametersEnabled = previousParametersSetting
+    }
+}
```

**File**: `docs/features/query-parameters.mdx` (modified, +2/-0)
```diff
@@ -47,6 +47,8 @@ Where the driver has a parameter API the value is bound, never pasted into the t
 
 The same name twice (`:id = :id`) gets one field and one value.
 
+Parameters are detected on SQL connections only. On MongoDB, Elasticsearch, Typesense, Weaviate, Redis, etcd, SurrealDB and Kafka a `:word` is sent as written, so `GET /products/_search?q=name:lamp` and `GET user:name` run without asking for a value.
+
 ## LIKE patterns and IN lists
 
 One placeholder is one value, which is where both of these go wrong.
```

---

### Incident Patch 14: `90f24b06` (2026-10-04)
**Commit Message**: fix(hig): count agreement, Touch ID reason and unnamed Settings controls (#3256)

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -23,6 +23,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Last column's divider sitting on the grid's right edge, where it could not be dragged to resize.
 - Cells keeping their old width or order while a column is resized or dragged, until the mouse is released.
 - Resize cursor showing a few points from a column divider, where a drag moved the column instead.
+- Counts reading "3 table to export" in the Export dialog, and "1 rows" in the result status bar and query plan.
+- Safe Mode's Touch ID prompt reading "TablePro is trying to Authenticate to execute database operations."
+- VoiceOver reading no name for the AI provider pop-up, max output tokens, plugin category filter and CSV NULL text field.
 
 ## [0.77.1] - 2026-10-03
 
```

**File**: `Plugins/CSVImportPlugin/CSVImportOptionsView.swift` (modified, +2/-1)
```diff
@@ -66,8 +66,9 @@ struct CSVImportOptionsView: View {
 
                 GridRow {
                     Text("NULL text:")
-                    TextField("", text: $plugin.settings.nullString, prompt: Text(verbatim: "\\N"))
+                    TextField(String(localized: "NULL text", bundle: .main), text: $plugin.settings.nullString, prompt: Text(verbatim: "\\N"))
                         .textFieldStyle(.roundedBorder)
+                        .labelsHidden()
                         .frame(width: 170)
                         .help("An extra value that should be imported as NULL, for example \\N.")
                 }
```

**File**: `TablePro/Core/Services/Execution/DefaultExecutionGate.swift` (modified, +10/-3)
```diff
@@ -13,6 +13,15 @@ internal actor DefaultExecutionGate: ExecutionGate {
     private let connectionNameResolver: @Sendable (UUID) async -> String?
     private let auditLog: any ExecutionAuditLogging
 
+    /// The end of a sentence macOS writes, not a sentence of its own. `LAContext` shows the reason
+    /// as "<app> is trying to <reason>.", and the system supplies the closing mark in every
+    /// language the app ships: Vietnamese and Chinese continue the same verb ("đang cố gắng %@.",
+    /// "正在尝试%@。"), Korean and Turkish put the reason after a colon. So each translation is a
+    /// lowercase phrase with no closing period.
+    static var authenticationReason: String {
+        String(localized: "execute database operations")
+    }
+
     init(
         confirming: OperationConfirming,
         authenticating: OperationAuthenticating,
@@ -100,9 +109,7 @@ internal actor DefaultExecutionGate: ExecutionGate {
             if caps.contains(.cannotPrompt) {
                 return .denied(reason: String(localized: "Authentication is required for this operation"))
             }
-            let authenticated = await authenticating.authenticate(
-                reason: String(localized: "Authenticate to execute database operations")
-            )
+            let authenticated = await authenticating.authenticate(reason: Self.authenticationReason)
             guard authenticated else {
                 return .denied(reason: String(localized: "Authentication required to execute write operations"))
             }
```

**File**: `TablePro/Resources/Localizable.xcstrings` (modified, +49/-51)
```diff
@@ -8242,46 +8242,10 @@
         }
       }
     },
-    "%lld ^[row](inflect: true) to export" : {
+    "^[%lld row](inflect: true) to export" : {
 
     },
-    "%lld ^[rows](inflect: true)" : {
-      "comment" : "A label displaying the number of rows in a database table. The argument is the number of rows in the table.",
-      "isCommentAutoGenerated" : true,
-      "localizations" : {
-        "ko" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "%lld행"
-          }
-        },
-        "tr" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "%lld satır"
-          }
-        },
-        "vi" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "%lld dòng"
-          }
-        },
-        "zh-Hans" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "%lld 行"
-          }
-        },
-        "zh-Hant" : {
-          "stringUnit" : {
-            "state" : "translated",
-            "value" : "%lld 列"
-          }
-        }
-      }
-    },
-    "%lld ^[table](inflect: true) to export" : {
+    "^[%lld table](inflect: true) to export" : {
 
     },
     "%lld items" : {
@@ -8776,7 +8740,7 @@
         }
       }
     },
-    "%lld of %lld ^[rows](inflect: true) selected" : {
+    "%lld of ^[%lld row](inflect: true) selected" : {
       "localizations" : {
         "ko" : {
           "stringUnit" : {
@@ -9623,7 +9587,7 @@
         }
       }
     },
-    "%lld-%lld of %lld ^[rows](inflect: true)" : {
+    "%lld-%lld of ^[%lld row](inflect: true)" : {
       "localizations" : {
         "ko" : {
           "stringUnit" : {
@@ -9657,7 +9621,7 @@
         }
       }
     },
-    "%lld-%lld of ~%lld ^[rows](inflect: true)" : {
+    "%lld-%lld of ~^[%lld row](inflect: true)" : {
       "localizations" : {
         "ko" : {
           "stringUnit" : {
@@ -17493,7 +17457,7 @@
         }
       }
     },
-    "All %lld ^[rows](inflect: true) selected" : {
+    "All ^[%lld row](inflect: true) selected" : {
       "localizations" : {
         "ko" : {
           "stringUnit" : {
@@ -22932,36 +22896,36 @@
         }
       }
     },
-    "Authenticate to execute database operations" : {
+    "execute database operations" : {
       "localizations" : {
         "ko" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "데이터베이스 작업을 실행하려면 인증하십시오"
+            "value" : "데이터베이스 작업 실행"
           }
         },
         "tr" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Veritabanı işlemlerini çalıştırmak için kimlik doğrulayın"
+            "value" : "veritabanı işlemlerini çalıştırmak"
           }
         },
         "vi" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "Xác thực để thực thi thao tác cơ sở dữ liệu"
+            "value" : "thực thi thao tác cơ sở dữ liệu"
           }
         },
         "zh-Hans" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "验证身份以执行数据库操作"
+            "value" : "执行数据库操作"
           }
         },
         "zh-Hant" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "驗證身分以執行資料庫操作"
+            "value" : "執行資料庫操作"
           }
         }
       }
@@ -62645,7 +62609,7 @@
         }
       }
     },
-    "Executed %lld ^[statement](inflect: true)" : {
+    "Executed ^[%lld statement](inflect: true)" : {
 
     },
     "Executed %lld statements" : {
@@ -70035,7 +69999,7 @@
     "Filtered Rows (%@)" : {
 
     },
-    "Filtered to %lld of %lld ^[rows](inflect: true)" : {
+    "Filtered to %lld of ^[%lld row](inflect: true)" : {
       "localizations" : {
         "ko" : {
           "stringUnit" : {
@@ -142801,7 +142765,7 @@
         }
       }
     },
-    "Showing %lld ^[rows](inflect: true)" : {
+    "Showing ^[%lld row](inflect: true)" : {
       "localizations" : {
         "ko" : {
           "stringUnit" : {
@@ -184987,6 +184951,40 @@
     },
     "etcd cannot filter with %@." : {
 
+    },
+    "NULL text" : {
+      "localizations" : {
+        "ko" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "NULL 텍스트"
+          }
+        },
+        "tr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "NULL metni"
+          }
+        },
+        "vi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Văn bản NULL"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "NULL 文本"
+          }
+        },
+        "zh-Hant" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "NULL 文字"
+          }
+        }
+      }
     }
   },
   "version" : "1.1"
```

**File**: `TablePro/Views/Export/ExportDialog.swift` (modified, +2/-2)
```diff
@@ -447,12 +447,12 @@ struct ExportDialog: View {
                             .foregroundStyle(.secondary)
                     } else if exportsSingleResult {
                         if let singleResultRowCount {
-                            Text("\(singleResultRowCount) ^[row](inflect: true) to export")
+                            Text("^[\(singleResultRowCount) row](inflect: true) to export")
                                 .font(.subheadline)
                                 .foregroundStyle(.secondary)
                         }
                     } else {
-                        Text("\(exportableCount) ^[table](inflect: true) to export")
+                        Text("^[\(exportableCount) table](inflect: true) to export")
                             .font(.subheadline)
                             .foregroundStyle(.secondary)
 
```

**File**: `TablePro/Views/Import/ImportProgressView.swift` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ struct ImportProgressView: View {
             VStack(spacing: 8) {
                 HStack {
                     if service.state.statusMessage.isEmpty {
-                        Text("Executed \(service.state.processedStatements) ^[statement](inflect: true)")
+                        Text("Executed ^[\(service.state.processedStatements) statement](inflect: true)")
                             .font(.body)
                     } else {
                         Text(service.state.statusMessage)
```

**File**: `TablePro/Views/QueryPlan/QueryPlanDiagramView.swift` (modified, +1/-1)
```diff
@@ -211,7 +211,7 @@ struct QueryPlanDiagramNodeView: View {
                         .foregroundStyle(.tertiary)
                 }
                 if let rows = node.estimatedRows {
-                    Text("\(rows) ^[rows](inflect: true)")
+                    Text("^[\(rows) row](inflect: true)")
                         .font(.system(.caption2, design: .monospaced))
                         .foregroundStyle(.tertiary)
                 }
```

**File**: `TablePro/Views/Results/ResultStatusReadoutView.swift` (modified, +10/-7)
```diff
@@ -11,6 +11,9 @@ import SwiftUI
 /// noun inflects with the count. The previous shape assembled one sentence out of seven independent
 /// keys through `String(format:)`, which never groups and cannot select a plural variant, so it
 /// rendered "1 rows" and put an ungrouped range next to a grouped total in the same breath.
+///
+/// The count the noun agrees with sits inside the `^[...](inflect: true)` span. Agreement reads
+/// only the number the span encloses, so a count written before it still rendered "1 rows".
 struct ResultStatusReadoutView: View {
     let readout: ResultStatusReadout
 
@@ -43,23 +46,23 @@ struct ResultStatusReadoutView: View {
         case .noRows:
             Text("No rows")
         case let .rowCount(count):
-            Text("\(count) ^[rows](inflect: true)")
+            Text("^[\(count) row](inflect: true)")
         case let .partialLoad(count):
-            Text("Showing \(count) ^[rows](inflect: true)")
+            Text("Showing ^[\(count) row](inflect: true)")
         case let .range(start, end, total, isEstimate):
             if isEstimate {
-                Text("\(start)-\(end) of ~\(total) ^[rows](inflect: true)")
+                Text("\(start)-\(end) of ~^[\(total) row](inflect: true)")
             } else {
-                Text("\(start)-\(end) of \(total) ^[rows](inflect: true)")
+                Text("\(start)-\(end) of ^[\(total) row](inflect: true)")
             }
         case let .rangeOfUnknownTotal(start, end):
             Text("Rows \(start)-\(end)")
         case let .valueFiltered(shown, loaded):
-            Text("Filtered to \(shown) of \(loaded) ^[rows](inflect: true)")
+            Text("Filtered to \(shown) of ^[\(loaded) row](inflect: true)")
         case let .selection(selected, total):
-            Text("\(selected) of \(total) ^[rows](inflect: true) selected")
+            Text("\(selected) of ^[\(total) row](inflect: true) selected")
         case let .allSelected(count):
-            Text("All \(count) ^[rows](inflect: true) selected")
+            Text("All ^[\(count) row](inflect: true) selected")
         }
     }
 }
```

---

### Incident Patch 15: `064a15e0` (2026-10-04)
**Commit Message**: fix(datagrid): one "#" on bounce, room after last column, live drags (#3254)

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -19,6 +19,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Database icon filled in the database switcher and query editor, outline in the toolbar and sidebar. (#3250)
 - Status bar buttons a point or two taller or shorter than each other depending on their icon. (#3250)
 - Highlighted row in the database and connection switchers drawn as white text on a grey fill. (#3249)
+- Second "#" column showing beside the row numbers when the data grid bounces past its left edge.
+- Last column's divider sitting on the grid's right edge, where it could not be dragged to resize.
+- Cells keeping their old width or order while a column is resized or dragged, until the mouse is released.
+- Resize cursor showing a few points from a column divider, where a drag moved the column instead.
 
 ## [0.77.1] - 2026-10-03
 
```

**File**: `TablePro/Views/Results/Cells/DataGridCellRegistry.swift` (modified, +18/-1)
```diff
@@ -50,7 +50,7 @@ final class DataGridCellRegistry {
             cell = textField
             cell.font = ThemeEngine.shared.dataGridFonts.rowNumber
         } else {
-            cellView = NSTableCellView()
+            cellView = DataGridRowNumberCellView()
             cellView.identifier = rowNumberCellIdentifier
 
             cell = NSTextField(labelWithString: "")
@@ -61,6 +61,7 @@ final class DataGridCellRegistry {
 
             cellView.textField = cell
             cellView.addSubview(cell)
+            cell.alphaValue = 0
 
             NSLayoutConstraint.activate([
                 cell.leadingAnchor.constraint(
@@ -93,3 +94,19 @@ final class DataGridCellRegistry {
         visualState.isDeleted ? palette.deletedRowText : palette.rowNumberText
     }
 }
+
+/// The row-number cell, mounted under the pinned row gutter, which paints every visible number.
+///
+/// Its number would show beside the gutter while a sideways bounce slides the column out from under
+/// it, so the field draws at zero alpha. Zero alpha keeps the field in the accessibility tree, where
+/// `isHidden` would drop it. It is also the only view a row drag can build its image from, so the
+/// drag image is taken with the field shown.
+final class DataGridRowNumberCellView: NSTableCellView {
+    override var draggingImageComponents: [NSDraggingImageComponent] {
+        guard let textField else { return super.draggingImageComponents }
+        let alpha = textField.alphaValue
+        textField.alphaValue = 1
+        defer { textField.alphaValue = alpha }
+        return super.draggingImageComponents
+    }
+}
```

**File**: `TablePro/Views/Results/Cells/DataGridMetrics.swift` (modified, +3/-0)
```diff
@@ -11,4 +11,7 @@ enum DataGridMetrics {
     static let rowNumberColumnMinWidth: CGFloat = 40
     static let dataColumnMinWidth: CGFloat = 30
     static let dataColumnMaxWidth: CGFloat = 1_200
+    /// Room the grid scrolls past its last column. Without it the last column's divider sits on the
+    /// viewport's last point, which a resizable window claims for its own edge resize.
+    static let trailingSpace: CGFloat = 40
 }
```

**File**: `TablePro/Views/Results/DataGridCoordinator.swift` (modified, +7/-0)
```diff
@@ -172,6 +172,13 @@ final class TableViewCoordinator: NSObject, NSTableViewDelegate, NSTableViewData
         }
     }
 
+    /// Drops only the data index to `tableColumns` map, for a column that moved under a live reorder
+    /// drag. The display order, and the selection held in display positions, stay as they were
+    /// until the reorder commits, so the selection keeps naming the cells the user picked.
+    func invalidateTableColumnIndexMap() {
+        columnIndexByDataIndex.removeAll()
+    }
+
     func invalidateColumnIndexCache() {
         invalidatePresentedColumnCache()
         guard !columnIndexByDataIndex.isEmpty else { return }
```

**File**: `TablePro/Views/Results/DataGridRowGutterView.swift` (modified, +2/-1)
```diff
@@ -25,7 +25,8 @@ import AppKit
 /// The column stays attached underneath. It reserves the leading width, keeps every column-index
 /// computation in the grid working untouched, and keeps mounting the one cell view the grid still
 /// mounts, which is the row number's only `AXCell` and the tooltip host for the reason a reorder is
-/// unavailable. This view draws over it, so the two must agree on the number they show.
+/// unavailable. That cell carries the number for accessibility only and paints nothing, so a bounce
+/// past the leading edge, which slides the column out from under this view, shows no second number.
 @MainActor
 final class DataGridRowGutterView: NSView {
     weak var coordinator: TableViewCoordinator?
```

**File**: `TablePro/Views/Results/DataGridRowView.swift` (modified, +55/-20)
```diff
@@ -154,30 +154,64 @@ class DataGridRowView: NSTableRowView {
     /// The columns are still real `NSTableColumn`s, so AppKit answers which of them the area covers
     /// and where each one sits; only the cell content is drawn rather than mounted.
     func drawCells(in dirtyRect: NSRect, of view: NSView) {
-        guard let coordinator, let tableView = coordinator.tableView else { return }
+        guard let tableView = coordinator?.tableView else { return }
         let inTableView = view.convert(dirtyRect, to: tableView)
-        let onEmphasizedSelection = isSelected && isEmphasized
-        let row = rowIndex
-
-        for tableColumnIndex in tableView.columnIndexes(in: inTableView) {
-            guard tableColumnIndex < tableView.tableColumns.count else { continue }
-            let identifier = tableView.tableColumns[tableColumnIndex].identifier
-            guard let dataColumn = coordinator.dataColumnIndex(from: identifier) else { continue }
-            guard let appearance = coordinator.cellAppearance(
-                row: row,
-                columnIndex: dataColumn,
-                onEmphasizedSelection: onEmphasizedSelection
-            ) else { continue }
-
-            let columnRect = view.convert(tableView.rect(ofColumn: tableColumnIndex), from: tableView)
-            coordinator.cellRenderer.draw(
-                appearance,
-                in: NSRect(x: columnRect.minX, y: 0, width: columnRect.width, height: view.bounds.height),
-                controlView: view
-            )
+        let dragged = Self.draggedColumnIndex(of: tableView)
+
+        for tableColumnIndex in tableView.columnIndexes(in: inTableView) where tableColumnIndex != dragged {
+            drawCell(atTableColumnIndex: tableColumnIndex, in: tableView.rect(ofColumn: tableColumnIndex), of: view)
         }
     }
 
+    /// Draws the column a header drag is moving at the pointer, the way `NSTableView` floats a dragged
+    /// column's cell views: over its neighbours and the separators, its own slot left empty.
+    ///
+    /// The position is read at draw time. `draggedDistance` is measured from the column's current
+    /// slot, which moves as it passes each neighbour, and the two disagree for a moment inside that
+    /// move, measured on macOS 27.
+    func drawDraggedColumn(in dirtyRect: NSRect, of view: NSView) {
+        guard let tableView = coordinator?.tableView,
+              let dragged = Self.draggedColumnIndex(of: tableView),
+              let distance = tableView.headerView?.draggedDistance,
+              let context = NSGraphicsContext.current?.cgContext else { return }
+        let floating = tableView.rect(ofColumn: dragged).offsetBy(dx: distance, dy: 0)
+        guard floating.intersects(view.convert(dirtyRect, to: tableView)) else { return }
+        context.saveGState()
+        context.setAlpha(Self.draggedColumnAlpha)
+        context.beginTransparencyLayer(auxiliaryInfo: nil)
+        drawCell(atTableColumnIndex: dragged, in: floating, of: view)
+        context.endTransparencyLayer()
+        context.restoreGState()
+    }
+
+    /// The `alphaValue` AppKit gives the view it floats a dragged column's cells in, measured on
+    /// macOS 27; AppKit does not publish it.
+    private static let draggedColumnAlpha: CGFloat = 0.6
+
+    private static func draggedColumnIndex(of tableView: NSTableView) -> Int? {
+        guard let dragged = tableView.headerView?.draggedColumn,
+              dragged >= 0, dragged < tableView.numberOfColumns else { return nil }
+        return dragged
+    }
+
+    private func drawCell(atTableColumnIndex tableColumnIndex: Int, in rectInTable: NSRect, of view: NSView) {
+        guard let coordinator, let tableView = coordinator.tableView,
+              tableColumnIndex < tableView.tableColumns.count,
+              let dataColumn = coordinator.dataColumnIndex(from: tableView.tableColumns[tableColumnIndex].identifier),
+              let appearance = coordinator.cellAppearance(
+                  row: rowIndex,
+                  columnIndex: dataColumn,
+                  onEmphasizedSelection: isSelected && isEmphasized
+              ) else { return }
+
+        let columnRect = view.convert(rectInTable, from: tableView)
+        coordinator.cellRenderer.draw(
+            appearance,
+            in: NSRect(x: columnRect.minX, y: 0, width: columnRect.width, height: view.bounds.height),
+            controlView: view
+        )
+    }
+
     /// Draws the column separators crossing this row. See `DataGridBodyChrome`.
     func drawColumnSeparators(in dirtyRect: NSRect, of view: NSView) {
         guard let coordinator, let tableView = coordinator.tableView else { return }
@@ -906,6 +940,7 @@ final class DataGridRowContentView: NSView {
     override func draw(_ dirtyRect: NSRect) {
         rowView?.drawCells(in: dirtyRect, of: self)
         rowView?.drawColumnSeparators(in: dirtyRect, of: self)
+        rowView?.drawDraggedColumn(in: dirtyRect,
```

**File**: `TablePro/Views/Results/Extensions/DataGridView+ColumnGeometry.swift` (modified, +3/-0)
```diff
@@ -15,6 +15,9 @@ extension TableViewCoordinator {
     /// the columns still fit inside the viewport, so nothing is marked dirty and the body keeps the
     /// layout it last drew until an unrelated event invalidates a row (#2449).
     ///
+    /// The column notifications arrive once a gesture ends, so a divider or reorder drag also comes
+    /// here from `SortableHeaderView.viewWillDraw()` on every step.
+    ///
     /// Everything that paints from live `rect(ofColumn:)` is invalidated here: each row, the table
     /// view's own background past the last row, and the cell selection outline. A row is reached
     /// through its drawn cells, which is enough for the whole row: `canDrawSubviewsIntoLayer` makes
```

**File**: `TablePro/Views/Results/Extensions/DataGridView+RowGutter.swift` (modified, +18/-5)
```diff
@@ -16,17 +16,30 @@ extension TableViewCoordinator {
     /// The correction scrolls through `scroll(_:)`, which moves the header with the rows. Scrolling
     /// the clip view and reflecting it leaves the header clip where it was, measured on macOS 27, so
     /// every heading sat as far off its column as the correction had moved.
+    ///
+    /// The last column gets the same treatment on its trailing side. AppKit stops with that
+    /// column's divider on the viewport edge, which leaves the trailing space off screen and the
+    /// divider where the window's edge resize takes the press.
     func scrollColumnToVisible(tableColumnIndex index: Int) {
         guard let tableView, index >= 0, index < tableView.numberOfColumns else { return }
         tableView.scrollColumnToVisible(index)
         guard let clipView = tableView.enclosingScrollView?.contentView else { return }
-        let gutterWidth = DataGridRowGutterView.width(of: tableView)
-        guard gutterWidth > 0 else { return }
         let columnRect = tableView.rect(ofColumn: index)
         guard columnRect.width > 0 else { return }
-        let hidden = clipView.bounds.origin.x + gutterWidth - columnRect.minX
-        guard hidden > 0 else { return }
-        tableView.scroll(NSPoint(x: clipView.bounds.origin.x - hidden, y: clipView.bounds.origin.y))
+        let visible = clipView.bounds
+        let gutterWidth = DataGridRowGutterView.width(of: tableView)
+        let hidden = visible.minX + gutterWidth - columnRect.minX
+        if gutterWidth > 0, hidden > 0 {
+            tableView.scroll(NSPoint(x: visible.minX - hidden, y: visible.minY))
+            return
+        }
+        guard index == lastPresentedColumnIndex() else { return }
+        let trailingEdge = min(columnRect.maxX + DataGridMetrics.trailingSpace, tableView.bounds.maxX)
+        let shortfall = trailingEdge - visible.maxX
+        guard shortfall > 0,
+              columnRect.maxX <= visible.maxX,
+              columnRect.minX - gutterWidth >= visible.minX + shortfall else { return }
+        tableView.scroll(NSPoint(x: visible.minX + shortfall, y: visible.minY))
     }
 
     /// Re-reads the pinned gutter's geometry from the column it mirrors. The width moves when the
```

#### Recent Merged Pull Requests:
- **PR #3271** (2026-10-06): fix(connections): keep one connection per database, no reconnect (@datlechin)
- **PR #3270** (2026-10-06): fix(datagrid): keep the grid on screen while a table loads into a tab (@datlechin)
- **PR #3269** (2026-10-05): fix(windows): reload nothing when switching back to a connection (@datlechin)
- **PR #3268** (2026-10-05): refactor: let Xcode own the string catalog (@datlechin)
- **PR #3266** (2026-10-05): fix(ios): show why the Shortcuts table picker is empty (@datlechin)
- **PR #3265** (2026-10-05): fix(hig): name view controls for VoiceOver, stop License pane crash (@datlechin)
- **PR #3264** (2026-10-04): fix: keep Copy To index names clear of the target's own indexes (@datlechin)
- **PR #3263** (2026-10-04): fix(editor): read query language by engine and wrap at word breaks (@datlechin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
