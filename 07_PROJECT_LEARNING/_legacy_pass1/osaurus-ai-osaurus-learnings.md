# Forensic Learning Record (Deep Inspection): osaurus-ai/osaurus

> **Canonical Artifact**: `07_PROJECT_LEARNING/osaurus-ai-osaurus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/osaurus-ai/osaurus](https://github.com/osaurus-ai/osaurus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:40:51.297Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `osaurus-ai/osaurus`
- **Description**: Own your AI. The native macOS harness for AI agents -- any model, persistent memory, autonomous execution, cryptographic identity. Built in Swift. Fully offline. Open source.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 8015 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Packages/OsaurusCore/ObjCSupport/include/OsaurusObjCSupport.h`
```
//
//  OsaurusObjCSupport.h
//  osaurus
//
//  Small Objective-C shim for the handful of framework calls that can raise
//  an NSException that Swift cannot `catch`.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Runs `block` inside an Objective-C `@try`/`@catch`. Returns `nil` when the
/// block completes normally, or the caught `NSException` when one is raised.
///
/// Swift's `do`/`catch` only handles `Error`, not Objective-C `NSException`, so
/// an exception thrown by a framework call (e.g. AppKit's non-thread-safe
/// `NSPasteboard` type-cache mutation racing another access) otherwise
/// terminates the process. Wrapping such a call in this helper lets the Swift
/// caller treat it as a recoverable failure instead of a crash.
NSException *_Nullable osr_catch_exception(void(NS_NOESCAPE ^_Nonnull block)(void));

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `Packages/OsaurusCore/SQLCipher/include/OsaurusSQLCipher.h`
```
/*
 *  OsaurusSQLCipher.h
 *
 *  Module umbrella header for the vendored SQLCipher amalgamation.
 *  Consumers `import OsaurusSQLCipher` (Swift) and call the standard
 *  SQLite C API plus the SQLCipher codec functions.
 *
 *  ⚠️  LOAD-BEARING: this file is NOT just a re-export of
 *      `sqlite3.h`. It force-defines `SQLITE_HAS_CODEC` BEFORE
 *      `#include "sqlite3.h"` so the codec entry points
 *      (`sqlite3_key`, `sqlite3_key_v2`, `sqlite3_rekey`,
 *      `sqlite3_rekey_v2`, `sqlite3_activate_*`) are visible to
 *      Swift's Clang module parse. The C target's
 *      `cSettings.define("SQLITE_HAS_CODEC")` covers the .c
 *      compilation but does NOT propagate to the Clang module
 *      compilation that Swift uses, so without the local define
 *      here `EncryptedSQLiteOpener.swift` fails with
 *      "cannot find 'sqlite3_key_v2' in scope". Tested: deleting
 *      this file breaks the build immediately.
 *
 *      If you bump SQLCipher and the codec functions become
 *      gated behind a new macro, add the corresponding
 *      `#ifndef X #define X #endif` block here.
 */

#ifndef OSAURUS_SQLCIPHER_H
#define OSAURUS_SQLCIPHER_H

#ifndef SQLITE_HAS_CODEC
#define SQLITE_HAS_CODEC 1
#endif

#ifndef OSAURUS_OMIT_FTS5_HEADERS
#define OSAURUS_OMIT_FTS5_HEADERS 1
#endif

#include "sqlite3.h"
/* `sqlite3ext.h` lives in the same `include/` dir alongside us, so
 * Clang's umbrella-header consistency check requires it to either
 * be included from this umbrella or excluded via a module map.
 * We include it with the loadable-extension API hidden because
 * Osaurus does not compile SQLite loadable extensions, and newer
 * macOS SDKs may expose extension fields that SQLCipher 4.6.1 does
 * not. This silences the
 *
 *   warning: umbrella header for module 'OsaurusSQLCipher' does not
 *            include header 'sqlite3ext.h'
 *
 * without reintroducing Swift Clang-importer type collisions against
 * Apple's system SQLite3 module. */
#ifndef OSAURUS_OMIT_SQLITE_EXTENSION_API
#define OSAURUS_OMIT_SQLITE_EXTENSION_API 1
#endif
#include "sqlite3ext.h"

#endif

```

### Core Architecture Module: `Packages/OsaurusCore/SQLCipher/include/sqlite3.h`
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
** <a href="http://www.fossil-scm.org/">Fossil configuration management
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
#define SQLITE_VERSION        "3.46.1"
#define SQLITE_VERSION_NUMBER 3046001
#define SQLITE_SOURCE_ID      "2024-08-13 09:16:08 c9c2ab54ba1f5f46360f1b4f35d849cd3f080e6fc2b6c60e91b16c63f69aalt1"

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
** ^The sqlite3_version[] string constant contains the text of [SQLITE_VERSION]
** macro.  ^The sqlite3_libversion() function returns a pointer to the
** to the sqlite3_version[] string constant.  The sqlite3_libversion()
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
** ^The sqlite3_compileoption_get() function
```

### Core Architecture Module: `Packages/OsaurusCore/SQLCipher/include/sqlite3ext.h`
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
 * BEGIN OSAURUS LOCAL MODIFICATION (do not remove on SQLCipher
 * version bumps; re-apply after copying a new sqlite3ext.h).
 *
 * Osaurus imports SQLCipher from Swift for the core SQLite API, not
 * for compiling SQLite loadable extensions. Apple's system SQLite3
 * module is also imported by dependencies in the same Swift build,
 * and modern SDKs may append fields to `sqlite3_api_routines` before
 * SQLCipher has adopted the same upstream SQLite version. Swift's
 * Clang importer treats those cross-module struct differences as a
 * build error.
 *
 * The umbrella header defines OSAURUS_OMIT_SQLITE_EXTENSION_API
 * before including this file so the module stays warning-free without
 * exporting the loadable-extension API that Osaurus does not use.
 * The SQLCipher amalgamation is unaffected because sqlite3.c inlines
 * its own sqlite3ext.h text.
 */
#ifndef OSAURUS_OMIT_SQLITE_EXTENSION_API

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
  void * (*trace)(sqlite3*,void(*xTra
```

### Core Architecture Module: `Packages/OsaurusCore/SQLCipher/sqlite3.c`
```
/******************************************************************************
** This file is an amalgamation of many separate C source files from SQLite
** version 3.46.1.  By combining all the individual C code files into this
** single large file, the entire code can be compiled as a single translation
** unit.  This allows many compilers to do optimizations that would not be
** possible if the files were compiled separately.  Performance improvements
** of 5% or more are commonly seen when SQLite is compiled as a single
** translation unit.
**
** This file is all you need to compile SQLite.  To use SQLite in other
** programs, you need this file and the "sqlite3.h" header file that defines
** the programming interface to the SQLite library.  (If you do not have
** the "sqlite3.h" header file at hand, you will find a copy embedded within
** the text of this file.  Search for "Begin file sqlite3.h" to find the start
** of the embedded sqlite3.h header file.) Additional code files may be needed
** if you want a wrapper to interface SQLite with your choice of programming
** language. The code for the "sqlite3" command-line shell is also in a
** separate file. This file contains only code for the core SQLite library.
**
** The content in this amalgamation comes from Fossil check-in
** c9c2ab54ba1f5f46360f1b4f35d849cd3f08 with changes in files:
**
**    .fossil-settings/empty-dirs
**    .fossil-settings/ignore-glob
**    LICENSE.md
**    Makefile.in
**    Makefile.msc
**    README.md
**    aclocal.m4
**    configure
**    configure.ac
**    ltmain.sh
**    sqlite3.1
**    sqlite3.pc.in
**    sqlite_cfg.h.in
**    src/attach.c
**    src/backup.c
**    src/ctime.c
**    src/func.c
**    src/global.c
**    src/main.c
**    src/malloc.c
**    src/pager.c
**    src/pager.h
**    src/pragma.c
**    src/pragma.h
**    src/shell.c.in
**    src/sqlite.h.in
**    src/sqliteInt.h
**    src/tclsqlite.c
**    src/test1.c
**    src/test_config.c
**    src/test_thread.c
**    src/util.c
**    src/vacuum.c
**    src/wal.c
**    tool/mkpragmatab.tcl
**    tool/mksqlite3c.tcl
*/
#define SQLITE_CORE 1
#define SQLITE_AMALGAMATION 1
#ifndef SQLITE_PRIVATE
# define SQLITE_PRIVATE static
#endif
/************** Begin file sqliteInt.h ***************************************/
/*
** 2001 September 15
**
** The author disclaims copyright to this source code.  In place of
** a legal notice, here is a blessing:
**
**    May you do good and not evil.
**    May you find forgiveness for yourself and forgive others.
**    May you share freely, never taking more than you give.
**
*************************************************************************
** Internal interface definitions for SQLite.
**
*/
#ifndef SQLITEINT_H
#define SQLITEINT_H

/* Special Comments:
**
** Some comments have special meaning to the tools that measure test
** coverage:
**
**    NO_TEST                     - The branches on this line are not
**                                  measured by branch coverage.  This is
**                                  used on lines of code that actually
**                                  implement parts of coverage testing.
**
**    OPTIMIZATION-IF-TRUE        - This branch is allowed to always be false
**                                  and the correct answer is still obtained,
**                                  though perhaps more slowly.
**
**    OPTIMIZATION-IF-FALSE       - This branch is allowed to always be true
**                                  and the correct answer is still obtained,
**                                  though perhaps more slowly.
**
**    PREVENTS-HARMLESS-OVERREAD  - This branch prevents a buffer overread
**                                  that would be harmless and undetectable
**                                  if it did occur.
**
** In all cases, the special comment must be enclosed in the usual
** slash-asterisk...asterisk-slash comment marks, with no spaces between the
** asterisks and the comment text.
*/

/*
** Make sure the Tcl calling convention macro is defined.  This macro is
** only used by test code and Tcl integration code.
*/
#ifndef SQLITE_TCLAPI
#  define SQLITE_TCLAPI
#endif

/*
** Include the header file used to customize the compiler options for MSVC.
** This should be done first so that it can successfully prevent spurious
** compiler warnings due to subsequent content in this file and other files
** that are included by this file.
*/
/************** Include msvc.h in the middle of sqliteInt.h ******************/
/************** Begin file msvc.h ********************************************/
/*
** 2015 January 12
**
** The author disclaims copyright to this source code.  In place of
** a legal notice, here is a blessing:
**
**    May you do good and not evil.
**    May you find forgiveness for yourself and forgive others.
**    May you share freely, never taking more than you give.
**
******************************************************************************
**
** This file contains code that is specific to MSVC.
*/
#ifndef SQLITE_MSVC_H
#define SQLITE_MSVC_H

#if defined(_MSC_VER)
#pragma warning(disable : 4054)
#pragma warning(disable : 4055)
#pragma warning(disable : 4100)
#pragma warning(disable : 4127)
#pragma warning(disable : 4130)
#pragma warning(disable : 4152)
#pragma warning(disable : 4189)
#pragma warning(disable : 4206)
#pragma warning(disable : 4210)
#pragma warning(disable : 4232)
#pragma warning(disable : 4244)
#pragma warning(disable : 4305)
#pragma warning(disable : 4306)
#pragma warning(disable : 4702)
#pragma warning(disable : 4706)
#endif /* defined(_MSC_VER) */

#if defined(_MSC_VER) && !defined(_WIN64)
#undef SQLITE_4_BYTE_ALIGNED_MALLOC
#define SQLITE_4_BYTE_ALIGNED_MALLOC
#endif /* defined(_MSC_VER) && !defined(_WIN64) */

#if !defined(HAVE_LOG2) && defined(_MSC_VER) && _MSC_VER<1800
#define HAVE_LOG2 0
#endif /* !defined(HAVE_LOG2) && defined(_MSC_VER) && _MSC_VER<1800 */

#endif /* SQLITE_MSVC_H */

/************** End of msvc.h ************************************************/
/************** Continuing where we left off in sqliteInt.h ******************/

/*
** Special setup for VxWorks
*/
/************** Include vxworks.h in the middle of sqliteInt.h ***************/
/************** Begin file vxworks.h *****************************************/
/*
** 2015-03-02
**
** The author disclaims copyright to this source code.  In place of
** a legal notice, here is a blessing:
**
**    May you do good and not evil.
**    May you find forgiveness for yourself and forgive others.
**    May you share freely, never taking more than you give.
**
******************************************************************************
**
** This file contains code that is specific to Wind River's VxWorks
*/
#if defined(__RTP__) || defined(_WRS_KERNEL)
/* This is VxWorks.  Set up things specially for that OS
*/
#include <vxWorks.h>
#include <pthread.h>  /* amalgamator: dontcache */
#define OS_VXWORKS 1
#define SQLITE_OS_OTHER 0
#define SQLITE_HOMEGROWN_RECURSIVE_MUTEX 1
#define SQLITE_OMIT_LOAD_EXTENSION 1
#define SQLITE_ENABLE_LOCKING_STYLE 0
#define HAVE_UTIME 1
#else
/* This is not VxWorks. */
#define OS_VXWORKS 0
#define HAVE_FCHOWN 1
#define HAVE_READLINK 1
#define HAVE_LSTAT 1
#endif /* defined(_WRS_KERNEL) */

/************** End of vxworks.h *********************************************/
/************** Continuing where we left off in sqliteInt.h ******************/

/*
** These #defines should enable >2GB file support on POSIX if the
** underlying operating system supports it.  If the OS lacks
** large file support, or if the OS is windows, these should be no-ops.
**
** Ticket #2739:  The _LARGEFILE_SOURCE macro must appear before any
** system #includes.  Hence, this block of code must be the very first
** code in all source files.
**
** Large file support can be disabled using the -DSQLITE_DISABLE_LFS switch
** on the compiler command line.  This is necessary if you are compiling
** on a recent mach
```

### Core Architecture Module: `Packages/OsaurusCore/Tools/PluginABI/osaurus_plugin.h`
```
// osaurus_plugin.h
//
// Osaurus Plugin ABI — current documented surface is v6.
//
// COMPATIBILITY
// =============
// Both legacy entry points continue to load:
//
//   - osaurus_plugin_entry      (v1 — never received the host API)
//   - osaurus_plugin_entry_v2   (current — receives `osr_host_api*`)
//
// New plugins should target v6 by exporting `osaurus_plugin_entry_v2`
// and reading `host->version >= 6`. Plugins compiled against an older
// version (v3 / v4 / v5) keep working — `host->version` advertises the
// highest documented surface the host implements; new slots present
// on a newer host are simply unused by older plugins. Plugins
// compiled against a newer ABI than the host implements should
// defensively check `host->version >= N && host->callback != NULL`
// before invoking a new slot.
//
// See `docs/plugins/ABI_VERSIONS.md` for the per-version evolution
// (v1 base, v2 host injection, v3 streaming cancel, v4 agent
// introspection, v5 structured logging, v6 host-side free_string).
//
// The struct layout is FROZEN —
// position of every callback is preserved across versions. Two slots
// (dispatch_clarify, dispatch_add_issue) are RESERVED for ABI
// compatibility and return a structured `not_supported` JSON envelope
// when invoked. Do not call them from new plugins.
//
// JSON ENVELOPE POLICY
// ====================
// Host callbacks return JSON strings. On error every callback returns:
//
//   {"error": "<code>", "message": "<human-readable>"}
//
// The single exception is `config_get`, which returns NULL when the
// requested key is absent (because the value is itself an arbitrary
// string and "missing" is not an error condition). Every other
// callback uses the structured envelope.
//
// MEMORY OWNERSHIP
// ================
// All `const char*` strings returned from host callbacks are
// heap-allocated by the host with `strdup` and must be released with
// `host->free_string` (added in v6) — see below. Plugins compiled
// against v5 or earlier can equivalently call `libc free()` on the
// returned pointer, which is what the host's `free_string` does
// internally; the v6 callback exists so plugins don't have to depend
// on the libc symbol directly and so a future allocator change on the
// host side stays transparent. NEVER free a host-returned string with
// the plugin's own `free_string` callback — that one is for the
// reverse direction.
//
// Strings the host receives from the plugin (via `invoke`,
// `get_manifest`, `handle_route`) are released with the plugin's
// `free_string` callback.
//
// VERSIONING
// ==========
// The host populates `osr_host_api.version` with the highest version
// it implements. Plugins that read `version` should treat it as a
// monotonic forward-compatible field — a v3 host is a strict superset
// of v2 behavior with the same memory layout.

#ifndef OSAURUS_PLUGIN_H
#define OSAURUS_PLUGIN_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define OSR_ABI_VERSION_1 1
#define OSR_ABI_VERSION_2 2
#define OSR_ABI_VERSION_3 3
#define OSR_ABI_VERSION_4 4
#define OSR_ABI_VERSION_5 5
#define OSR_ABI_VERSION_6 6

// Opaque context provided by the plugin, passed back to all function calls.
typedef void* osr_plugin_ctx_t;

// ── Plugin → Host callbacks (injected at init for v2+ plugins) ──

// Config store (Keychain-backed).
//
// Scope. Every entry is keyed by `(plugin_id, agent_id, key)`. The
// `agent_id` is resolved from the host-enforced agent scope (see the
// "AGENT SCOPING" note on `osr_dispatch_fn` for how that's set). One
// plugin's config never collides with another plugin's, and one
// agent's config never collides with another agent's.
//
// Echo. `config_set` and `config_delete` do NOT echo the change back
// through `on_config_changed`. The plugin already knows what it just
// wrote; echoing would create a feedback loop for plugins that mutate
// state inside their config handler. UI-driven changes from the host
// (Save / Disconnect, tunnel up/down, fresh load) DO call
// `on_config_changed` so the plugin can reconcile.
//
// Cleared values. Empty string `""` is a real value, distinct from
// "deleted". Use `config_delete` to remove a key entirely. Host-side
// pushes that signal a transition (e.g. `tunnel_url` going down)
// deliver `""` to `on_config_changed`; treat it as "no value right
// now" rather than "no value ever stored".
//
// Size. `config_set` rejects values larger than 1 MiB silently with a
// one-shot warning. The keychain is for credentials and small state,
// not blob storage; use `db_exec` / `db_query` for larger payloads.
//
// Returns NULL when the key is missing. All other host callbacks return
// a structured JSON error envelope; `config_get` is the single exception
// because the value space is arbitrary strings.
typedef const char* (*osr_config_get_fn)(const char* key);
typedef void        (*osr_config_set_fn)(const char* key, const char* value);
typedef void        (*osr_config_delete_fn)(const char* key);

// Data store (sandboxed SQLite).
// `params_json` may be NULL or a JSON array `[v1, v2, ...]` for `?` placeholders,
// or a JSON object `{":name": v1, ...}` for named placeholders.
typedef const char* (*osr_db_exec_fn)(const char* sql, const char* params_json);
typedef const char* (*osr_db_query_fn)(const char* sql, const char* params_json);

// Logging — level: 0=trace, 1=debug, 2=info, 3=warn, 4=error.
typedef void        (*osr_log_fn)(int level, const char* message);

// Agent dispatch (via BackgroundTaskManager).
//
// AGENT SCOPING (security boundary):
//   Plugin-initiated dispatches always run under the agent that invoked
//   the plugin — i.e. the agent whose route delivered the webhook
//   (`handle_route`), whose tool call entered (`invoke`), or whose
//   config / task-event callback fired. The host enforces this scope
//   from thread-local state captured before this trampoline is
//   entered. Caller-supplied `agent_address` / `agent_id` keys in
//   `request_json` are IGNORED, and a one-shot warning is logged so
//   cross-agent dispatch attempts remain visible. A plugin can never
//   spawn work in another agent's context. Background work the plugin
//   spawned itself (no invoke / route / event frame above it) is
//   resolved against the built-in default agent and also logged once.
//
// Schema for `osr_dispatch_request` (passed as JSON):
//   prompt          (required, string)        — initial prompt
//   mode            (optional, string)        — execution mode
//   title           (optional, string)        — display title
//   id              (optional, UUID string)   — caller-supplied request id
//   folder_bookmark (optional, base64 string) — security-scoped folder bookmark
//   session_id      (optional, UUID string)   — reattach to an existing
//                                                session. Reattach is
//                                                naturally agent-scoped:
//                                                a session belonging to a
//                                                different agent silently
//                                                misses and a fresh one
//                                                is created.
//
// Returns: {"id": "<uuid>", "status": "running"} on success or an error envelope.
// Non-blocking. Rate-limited to 10 dispatches per minute per (plugin, agent) pair.
// No authentication required — the host trusts in-process plugin calls.
typedef const char* (*osr_dispatch_fn)(const char* request_json);

// Returns JSON with task status, progress, activity feed.
// Terminal statuses: "completed", "failed", "cancelled".
// Returns {"error": "not_found"} if the task does not belong to the calling plugin.
typedef const char* (*osr_task_status_fn)(const char* task_id);

// Cancel a running task. No-ops silently if `task_id` is invalid or
// does not belong to the calling plugin.
typedef void        (*osr_dispatch_cancel_fn)(const char* task_id);

// RE
```

### Core Architecture Module: `helpers/osaurus-wa/bridge.go`
```
// whatsmeow wrapper: session store, QR pairing, connection lifecycle, and
// the message/watch surface exposed over JSON-RPC.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"go.mau.fi/whatsmeow"
	waCompanionReg "go.mau.fi/whatsmeow/proto/waCompanionReg"
	waProto "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

type bridge struct {
	container *sqlstore.Container
	client    *whatsmeow.Client
	writer    *stdioWriter

	debug bool

	mu            sync.Mutex
	watching      bool
	downloadMedia bool
	maxMediaBytes int64
	mediaDir      string

	// QR-pairing session state (guarded by mu). The bridge owns login event
	// handling instead of whatsmeow's GetQRChannel because the passkey
	// linking flow (WhatsApp's SHORTCAKE gate) emits non-terminal events and
	// can outlive the QR rotation window; GetQRChannel disconnects as soon
	// as the code pool drains, which would kill a passkey dance in flight.
	loginActive  bool
	loginHandler uint32
	loginQRStop  chan struct{}
	loginTimer   *time.Timer
	passkeyDance bool
}

// stderrLogger routes whatsmeow logs to stderr (stdout carries the JSON-RPC
// stream and must stay clean). Enabled via OSAURUS_WA_DEBUG for diagnosing
// live protocol issues; production runs with waLog.Noop.
type stderrLogger struct{ mod string }

func (l *stderrLogger) logf(level, msg string, args ...any) {
	fmt.Fprintf(
		os.Stderr, "%s [%s %s] %s\n",
		time.Now().Format("15:04:05.000"), l.mod, level, fmt.Sprintf(msg, args...),
	)
}

func (l *stderrLogger) Errorf(msg string, args ...any) { l.logf("ERROR", msg, args...) }
func (l *stderrLogger) Warnf(msg string, args ...any)  { l.logf("WARN", msg, args...) }
func (l *stderrLogger) Infof(msg string, args ...any)  { l.logf("INFO", msg, args...) }
func (l *stderrLogger) Debugf(msg string, args ...any) { l.logf("DEBUG", msg, args...) }
func (l *stderrLogger) Sub(module string) waLog.Logger {
	return &stderrLogger{mod: l.mod + "/" + module}
}

func helperLogger(debug bool) waLog.Logger {
	if debug {
		return &stderrLogger{mod: "wa"}
	}
	return waLog.Noop
}

func newBridge(storeDir string) (*bridge, error) {
	if err := os.MkdirAll(storeDir, 0o700); err != nil {
		return nil, fmt.Errorf("create store dir: %w", err)
	}
	// Primary phones validate the pairing QR's client-type field against the
	// values real WA Web emits and reject the scan outright otherwise
	// (whatsmeow's unset default derives "other web client"). Mirror WA
	// Web's platform (Chrome; the value it reports even from Electron) like
	// other bridges do, and keep the product name in Os so the entry in the
	// phone's Linked Devices list stays identifiable.
	store.DeviceProps.Os = proto.String("Osaurus (Mac OS)")
	store.DeviceProps.PlatformType = waCompanionReg.DeviceProps_CHROME.Enum()
	debug := os.Getenv("OSAURUS_WA_DEBUG") != ""
	dbPath := filepath.Join(storeDir, "whatsapp.db")
	container, err := sqlstore.New(
		context.Background(),
		"sqlite3",
		"file:"+dbPath+"?_foreign_keys=on&_busy_timeout=5000",
		helperLogger(debug),
	)
	if err != nil {
		return nil, fmt.Errorf("open session store: %w", err)
	}
	device, err := container.GetFirstDevice(context.Background())
	if err != nil {
		container.Close()
		return nil, fmt.Errorf("load device: %w", err)
	}
	b := &bridge{container: container, debug: debug}
	b.client = whatsmeow.NewClient(device, helperLogger(debug))
	b.client.AddEventHandler(b.handleEvent)
	return b, nil
}

// resetClientForPairing replaces a dead whatsmeow client with a fresh one.
// After a logout or a remote unlink from the phone, whatsmeow marks the
// device Deleted and swaps all of its session stores for no-op stubs that
// fail every operation (and Connect refuses outright with ErrDeviceDeleted),
// so re-pairing in a long-lived helper process needs a new device + client.
func (b *bridge) resetClientForPairing() {
	old := b.client
	device := b.container.NewDevice()
	client := whatsmeow.NewClient(device, helperLogger(b.debug))
	client.AddEventHandler(b.handleEvent)
	b.mu.Lock()
	b.client = client
	b.mu.Unlock()
	old.RemoveEventHandlers()
	old.Disconnect()
}

// debugf traces bridge-level flow to stderr when OSAURUS_WA_DEBUG is set.
func (b *bridge) debugf(msg string, args ...any) {
	if !b.debug {
		return
	}
	fmt.Fprintf(
		os.Stderr, "%s [bridge] %s\n",
		time.Now().Format("15:04:05.000"), fmt.Sprintf(msg, args...),
	)
}

func (b *bridge) close() {
	b.finishLogin(nil)
	if b.client != nil {
		b.client.Disconnect()
	}
	if b.container != nil {
		b.container.Close()
	}
}

func (b *bridge) selfJID() string {
	if b.client == nil || b.client.Store.ID == nil {
		return ""
	}
	return b.client.Store.ID.String()
}

func (b *bridge) selfNumber() string {
	if b.client == nil || b.client.Store.ID == nil {
		return ""
	}
	return "+" + b.client.Store.ID.User
}

func (b *bridge) selfLID() string {
	if b.client == nil || b.client.Store.LID.IsEmpty() {
		return ""
	}
	return b.client.Store.LID.String()
}

// resolveToPN maps a LID (hidden-user) JID to its phone-number JID when the
// mapping is known, preferring the alt address whatsmeow already resolved on
// the event. Phone-based allowlists depend on this: without it, LID senders
// would never match a `+E.164` entry.
func (b *bridge) resolveToPN(jid types.JID, alt types.JID) types.JID {
	if jid.Server != types.HiddenUserServer {
		return jid
	}
	if !alt.IsEmpty() && alt.Server == types.DefaultUserServer {
		return alt
	}
	if pn, err := b.client.Store.LIDs.GetPNForLID(context.Background(), jid); err == nil && !pn.IsEmpty() {
		return pn
	}
	return jid
}

// ensureConnected connects the client when a device is linked. Callers that
// need an active socket (send, watch, chats) go through this; whatsmeow
// handles reconnects internally once connected.
func (b *bridge) ensureConnected() *rpcError {
	if b.client.Store.ID == nil {
		return &rpcError{Code: -32001, Message: "not linked: scan the QR code in WhatsApp settings first"}
	}
	if b.client.IsConnected() {
		return nil
	}
	if err := b.client.Connect(); err != nil {
		return &rpcError{Code: -32002, Message: "connect failed: " + err.Error()}
	}
	// Give the socket a moment to authenticate so the first send after
	// connect does not race the login handshake.
	deadline := time.Now().Add(15 * time.Second)
	for !b.client.IsLoggedIn() && time.Now().Before(deadline) {
		time.Sleep(100 * time.Millisecond)
	}
	if !b.client.IsLoggedIn() {
		return &rpcError{Code: -32002, Message: "connected but not authenticated within 15s"}
	}
	return nil
}

// MARK: - Dispatch

func (b *bridge) handle(method string, params json.RawMessage) (map[string]any, *rpcError) {
	switch method {
	case "status":
		return b.handleStatus()
	case "login.start":
		return b.handleLoginStart()
	case "login.cancel":
		return b.handleLoginCancel()
	case "login.passkey_response":
		return b.handlePasskeyResponse(params)
	case "login.passkey_confirm":
		return b.handlePasskeyConfirm()
	case "logout":
		return b.handleLogout()
	case "chats.list":
		return b.handleChatsList()
	case "send":
		return b.handleSend(params)
	case "send.attachment":
		return b.handleSendAttachment(params)
	case "message.edit":
		return b.handleEdit(params)
	case "message.revoke":
		return b.handleRevoke(params)
	case "react":
		return b.handleReact(params)
	case "typing":
		return b.handleTyping(params)
	case "read":
		return b.handleRead(params)
	case "watch.subscribe":
		return b.handleWatchSubscribe(params)
	default:
		return nil, &rpcError{Code: -32601, Message: "method not found: " + method}
	}
}

func (b *bridge) handleStatus() (map[string]any, *rpcError) {
	return map[string]any{
		"version":     helperVersion,
		"rpc_methods": rpcMethods,
		"linked":      b.client.Store.ID != 
```

### Core Architecture Module: `helpers/osaurus-wa/main.go`
```
// osaurus-wa: WhatsApp Web bridge helper for Osaurus.
//
// Wraps whatsmeow (the Go WhatsApp Web multi-device library) behind the same
// newline-framed JSON-RPC 2.0 stdio protocol the pinned `imsg rpc` helper
// uses, so the Swift side can reuse its process-RPC client shape.
//
// Subcommands:
//
//	osaurus-wa rpc [--store-dir DIR]           long-lived JSON-RPC server on stdio
//	osaurus-wa status --json [--store-dir DIR] one-shot link/status probe
//	osaurus-wa version                         print the helper version
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const helperVersion = "0.2.3"

var rpcMethods = []string{
	"status",
	"login.start",
	"login.cancel",
	"login.passkey_response",
	"login.passkey_confirm",
	"logout",
	"chats.list",
	"send",
	"send.attachment",
	"message.edit",
	"message.revoke",
	"react",
	"typing",
	"read",
	"watch.subscribe",
}

func defaultStoreDir() string {
	if env := os.Getenv("OSAURUS_WA_STORE_DIR"); env != "" {
		return env
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(".", "osaurus-wa-session")
	}
	return filepath.Join(home, ".osaurus", "whatsapp", "session")
}

func parseStoreDir(args []string) string {
	dir := defaultStoreDir()
	for i := 0; i < len(args); i++ {
		if args[i] == "--store-dir" && i+1 < len(args) {
			dir = args[i+1]
			i++
		}
	}
	return dir
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: osaurus-wa <rpc|status|version> [--store-dir DIR]")
		os.Exit(2)
	}
	switch os.Args[1] {
	case "version":
		fmt.Println(helperVersion)
	case "status":
		runStatus(parseStoreDir(os.Args[2:]))
	case "rpc":
		runRPC(parseStoreDir(os.Args[2:]))
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand %q\n", os.Args[1])
		os.Exit(2)
	}
}

// runStatus probes the session store without connecting to WhatsApp and
// prints one JSON line, mirroring `imsg status --json`.
func runStatus(storeDir string) {
	payload := map[string]any{
		"version":     helperVersion,
		"rpc_methods": rpcMethods,
		"store_dir":   storeDir,
		"linked":      false,
	}
	if bridge, err := newBridge(storeDir); err == nil {
		if jid := bridge.selfJID(); jid != "" {
			payload["linked"] = true
			payload["self_jid"] = jid
			payload["self_number"] = bridge.selfNumber()
			payload["self_lid"] = bridge.selfLID()
		}
		bridge.close()
	} else {
		payload["error"] = err.Error()
	}
	line, err := json.Marshal(payload)
	if err != nil {
		os.Exit(1)
	}
	fmt.Println(string(line))
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2952** (2026-09-30): **only show the model switch advisory when leaving a local model**
  *Symptoms*: ## Changes  - [x] Behavior change - [ ] UI change (screenshots below) - [ ] Refactor / chore - [ ] Tests - [ ] Docs  ## Checklist  - [ ] I have read `CONTRIBUTING.md` - [ ] I added/updated tests where reasonable - [ ] I updated docs/README as needed - [ ] I verified build on macOS with Xcode 16.4+ 

- **Issue #2949** (2026-09-30): **fix: reject chunk transfers after lane invalidation**
  *Symptoms*: Canceling a chunked model download could invalidate a lane's URLSession between admission and `dataTask(with:)`, raising an Objective-C exception instead of a recoverable cancellation. The original implementation also permitted a later fetch on an already invalidated session.  Serialize session construction, task creation and terminal invalidation with the lane's state lock. Reject late fetches with `CancellationError`; resume tasks and invalidate sessions outside the lock. An admitted request's delegate still owns its continuation completion.  Validation: original-code actual-module regression reproduces the exact invalidated-session exception; the candidate passes it plus real HTTP range integrity/reuse, admitted cancellation and concurrent lifecycle tests. All nine canonical CI checks passed. A Release app GUI exercise passed download/pause/resume with retained-chunk reuse, final file SHA-256 verification, fresh-transfer cancellation and clean exit. That GUI run used an isolated loopback repository adapter with unchanged downloader/UI sources. It does not claim public-network or model-inference coverage. 
  **Post-Mortem & Fix Analysis**:
  > The invalidated-session failure is reproduced against the original production implementation, and the candidate passes the same regression.  - Baseline diagnostic run: https://github.com/osaurus-ai/osaurus/actions/runs/36671760691, head `26b1ef9247db3380b4b4837986ea950f468a4cf8`. This never-merge branch uses `61127dc` production code, changing only lane visibility for the test, plus the regression and branch-only focused test filter. - The actual OsaurusCore build succeeded. `invalidatedLaneRejectsFetchBeforeCreatingTask()` started and raised `NSGenericException: Task created in a session that has been invalidated`. The SIGABRT backtrace contains `TransferLane.fetch` and that exact regression method. The result is not a timeout or an empty test selection. - Candidate head `5a2415f90884f4ff495950f83b3cb05da0766ffa` passes that regression plus actual HTTP Range reuse/integrity, cancellation of an admitted request, and 32 concurrent creation/invalidation attempts. All nine canonical check
  > The download lifecycle gate now passes on candidate `5a2415f90884f4ff495950f83b3cb05da0766ffa`.  - Original production code reproduced `NSGenericException: Task created in a session that has been invalidated` in the actual module, through `TransferLane.fetch` and the intended regression: [baseline run](https://github.com/osaurus-ai/osaurus/actions/runs/36671760691). - Candidate passes the preinvalidated regression and three real HTTP lifecycle tests (range reuse/integrity, admitted cancellation and 32 concurrent creation/invalidation attempts). All nine [canonical checks](https://github.com/osaurus-ai/osaurus/actions/runs/36669104468) passed. - Built the actual Release app and exercised Import → Download → Pause → Resume → completion, then a fresh download → Cancel through its GUI. Pausing retained completed chunk 0; resume requested only the remaining three 32 MiB chunks. The completed 134,217,728-byte file matched SHA-256 `b907e3543dfb71276845cd55fcc4ecc53d933e9e8be8c71b4ab216ce52102

- **Issue #2940** (2026-09-29): **Respect automatic update policy on model notifications**
  *Symptoms*: When a model detail view stays open, every `localModelsChanged` notification forces a remote manifest check. That bypasses the manager's automatic-update opt-out and due-time policy. Remove the duplicate forced request from the view; it still refreshes local download state and diagnostics, while the manager owns cached local-manifest refresh and scheduled automatic checks.  Behavior retained:  - Explicit **Check** still forces a check; the initial detail-navigation check is unchanged. Turning off automatic polling does not disable these existing user-driven paths. - Registered official legacy bundles without an installed `osaurus.json` remain eligible under the existing policy. Repository eligibility is unchanged. - Missing remote metadata is distinct from an authorization/network failure. A newly published manifest requires local verification; metadata checks never install or repair files.  One new regression test is authored using the existing metadata-request injection seam. It counts actual service calls across a missing remote sidecar (2 requests), an unchanged immutable revision (1 additional request), and a new revision with a manifest (2 additional requests). It also checks the transition from unversioned publisher to verification required while the local manifest stays absent. This tests service requests and status handling, not a replica of the manager's scheduling logic.  Validation: source parsing and whitespace checks pass. The test has not yet executed on this c
  **Post-Mortem & Fix Analysis**:
  > SOURCE EVIDENCE: PR head `a61ceab1095b025a6dea161db61eaed260f92d04`. GUI integration `c1565e1b01821106a56302b6a65eb7454f9e0ee7` contains the identical local-model notification handler and identical ModelUpdatePollingTests. Its only additional ModelDetailView delta is an opt-in diagnostic reason on the existing manual Check call; manager/service differences for this path forward fixed diagnostic categories and emit request-boundary logs, without changing notification or due-policy decisions. Engine pin `27d4b68009645f8b2b884e52bac7b87b82d30315`; linked engine `2e12899c608a9a340a6d8eca634b7a6ec5b1f6b9` has identical runtime/build sources (the pin delta is test formatting).  LIVE EVIDENCE: fresh Release development app binary SHA-256 `334f1becfe88efacbdda1f94d2423b30bbb337a7c8de92360f0ca39c7e1b2109`, actual Settings/model-detail controls, isolated metadata-only legacy fixture without a local osaurus.json. The model-detail sheet remained mounted while actual discovery pruning emitted the n

- **Issue #2939** (2026-09-29): **Keep decimal settings editable until commit**
  *Symptoms*: Decimal settings currently clamp and rewrite the text after each keystroke. In the app, typing `0.70` produced `0.10.70` and left the value at 10%; replacing the text with one paste avoided the problem.  Buffer partial decimal input until Return, focus loss, or Save. Commit parses finite values and applies the existing clamp; invalid input preserves the previous bound value. Save flushes a focused edit before validation, and Reset discards it. A pending correction can reach Save even when the previous value is invalid, but validation still runs after the flush before anything is persisted.  Validation status:  - The original keystroke failure was observed through the app UI; corrected GUI behavior has not yet been exercised on this candidate. - Seven test methods covering 15 rows are authored, not yet executed. They cover partial typing/deletion, invalid and nonfinite input, paste/clamp/reopen, external reset, focused Save/Reset ownership, and correcting an invalid `0` to `20` while still rejecting invalid results. - Source parsing and whitespace checks pass. The three changed files match the reviewed isolated candidate when replayed on current main.  Pending: full-module `OptionalDoubleFieldEditingTests`, `OptionalIntFieldEditingTests`, `ServerRuntimeSettingsStoreTests`; required CI; actual keystroke, Return/blur, focused Save/Cmd-S, Reset, section-switch and reopen checks. This draft makes no claim that SwiftUI event ordering is proven by the editing-model tests.  No engine
  **Post-Mortem & Fix Analysis**:
  > Bounded Release GUI verification completed with the three changed source files byte-identical to this PR in app integration `3154ae381ac6f23b1d3bf5389e831a57253f2b7c`, engine `2e12899c608a9a340a6d8eca634b7a6ec5b1f6b9` (binary SHA-256 `f38c4179c045de4a833ae72fe15cb46e0acf0dc7df1cec0642ea8b2208d585f1`).  - Incremental physical-fraction typing preserved `0.70`; Return + Save persisted it. Invalid `bad` + Save restored the previous `0.70` and showed Saved. Clearing + Save removed the optional override. - Disk percent `0` + Return showed a configuration issue and disabled Save. Correcting to `20` while still focused enabled Save; clicking Save flushed the pending edit and persisted exactly `20`. - Reset after editing `30.` reset the entire form to defaults. Typing `15.5` and pressing Cmd-S persisted exactly `15.5`; clearing with Cmd-S restored Automatic. Persisted final configuration contains no disk-percent override. - The app exited normally with no guard-triggered termination.  This veri
  > Additional cold-load GUI check passed: a fresh isolated profile was initialized from the actual configuration saved by Cmd-S in the prior GUI run. The same verified Release app (`3154ae381`, engine `2e12899c`) cold-read that saved configuration; Settings → Server → Cache displayed `15.5` and rendered `15.5%`. No model was loaded, and the app exited normally without guard termination.  This is a cold read of a saved-configuration clone, not a reboot of the original profile. The post-exit configuration still contains `15.5`; an unrelated performance configuration normalization means the complete post-exit file is not byte-identical to its input snapshot.  All nine checks passed on exact head `ee913035fc2e501ae99c5dd0ddd0f7c66dceb0d7`, including the [actual core test job](https://github.com/osaurus-ai/osaurus/actions/runs/36613429321/job/109574921583), whose log reports `OptionalDoubleFieldEditingTests` passed. The separate local integration module run is not claimed complete here.  Merge

- **Issue #2938** (2026-09-30): **Surface preparation errors and pin validated logits runtime**
  *Symptoms*: Model preparation failures can otherwise arrive as cancelled terminal metadata, hiding the originating error behind an empty or cancelled response. This change surfaces the structured engine failure while continuing to drain the producer. Explicit consumer cancellation and cancellation metadata without a failure remain separate paths.  All six engine references are pinned to `27d4b68009645f8b2b884e52bac7b87b82d30315`, consuming [#532](https://github.com/osaurus-ai/vmlx-swift/pull/532), [#533](https://github.com/osaurus-ai/vmlx-swift/pull/533), and [#534](https://github.com/osaurus-ai/vmlx-swift/pull/534). The runtime validates prepared logits before sampling, checks the originating error in initial token-tail preparation, and preserves the GLM single-sequence device-offset optimization.  Validation:  - Exact combined engine `2e12899c` passed 94 tests. The merged runtime sources match that tested engine; the only subsequent tree difference is whitespace in a GLM test. The tested identities are preserved rather than relabeled as a new run. - Actual integration app `3154ae381ac6f23b1d3bf5389e831a57253f2b7c` reproduced the previously trapping malformed output-head request and now displayed its original matmul shape diagnostic, unlocked input, and remained alive. It then completed four natural-stop GLM turns, including idle unload/reload, and exited cleanly without guard intervention. [GUI evidence and binary identity](https://github.com/osaurus-ai/osaurus/pull/2938#issuecomment-5
  **Post-Mortem & Fix Analysis**:
  > Healthy-path GUI validation completed on app integration ff38b820a1c4622ecdd60e7b525ee7fc2522561b with engine 55ef175d0fa355d111c2568bba70654249f66d13. This integration adds only the now-merged subprocess fix to this PR; owned mapper and pin files match this PR.  Three consecutive GLM JANGH2 GUI turns completed coherently with separate reasoning and natural `stop`: 105/184/129 tokens at 17.9433/17.8579/17.8679 tok/s. Follow-ups correctly recalled and applied prior conversation. After observed idle unload, regenerating the identical third prompt completed naturally at 17.8848 tok/s (122 tokens). The earlier slow third-turn observation did not reproduce in this run; no causal performance fix is claimed.  App binary SHA-256: `1ea31ca1e8802c45bf22cf29202d75ac611154a0244f4a49bc8bd92843c085b9`. Owned launch guard exited 0 with no violation; peak physical footprint 3,504,703,864 bytes. Model defaults were preserved. This proves the healthy GUI path, not live injection of the prepared-logits f
  > The core CI run failed one new cancellation fixture: it expected only a completion event, but the existing bridge first emits the authoritative input-token count. The baseline implementation already has this behavior.  Commit dc76c1ce5 corrects the test to assert the exact event sequence: input-token count of 8, then a zero-token completion with `cancelled`, no preparation failure, and no unclosed reasoning or MTP result. Production code and all dependency pins are unchanged.  The previous run passed the preparation-error propagation, delayed producer-drain, and live-consumer cancellation controls. The corrected head still requires fresh CI; this is not a passing-test claim for the new commit.  Failure receipt: https://github.com/osaurus-ai/osaurus/actions/runs/36608853219/job/109563333926 
  > Post-merge negative GUI validation found an uncovered path in this hardening. The consuming app pin remains unmerged.  On app `ff38b820a1c4622ecdd60e7b525ee7fc2522561b` / engine `55ef175d0fa355d111c2568bba70654249f66d13`, actual Chat Send with an isolated tiny Llama fixture (valid embedding IDs, deliberately mismatched output-head inner dimension) terminated with SIGTRAP. A corresponding valid-head control loaded/prepared first; it stopped without visible output and is not a coherence or performance pass.  Crash stack: `TokenIterator.prepareRemainder` `.tokens` branch → `step` → `convertToToken` → `getItemND` precondition. The solo priming forward slices the failed projection before the outer error check. The checks added here cover prepared `.logits` and batch token-tail handling but do not cover that solo priming path. A focused follow-up and direct iterator regression are being implemented; the negative GUI case must then be rerun.  SOURCE EVIDENCE: `Evaluate.swift` at this exact en

- **Issue #2937** (2026-09-29): **Drain Claude subprocess output after in-flight delivery**
  *Symptoms*: A fast Claude subprocess can exit after its readability callback consumes stdout bytes but before those bytes reach the decoder. Finalization could then report exit-zero/no-output or reorder the final chunks.  Serialize each pipe's read-and-deliver operation with its final drain. Keep stdout and stderr ownership separate and preserve cancellation semantics.  Validation on PR head `66f580d1c859c2cc2713d51ab1121c9160692a6d`: - All nine CI checks passed. Relevant actual app-module suites: configuration49, pipe delivery3, decoder15 (**67 passed**). [Module proof](https://github.com/osaurus-ai/osaurus/pull/2937#issuecomment-5895750341). - Deterministically gated production-runner extraction: baseline fails with exit-zero/no-output; corrected source returns the expected text. Four uninstrumented Foundation controls also pass. No sleep/retry masks the race. - Real Release app GUI: FAST output, final JSON without newline, actual Stop→SIGTERM, success after Stop, explicit exit7/stderr display, and success after failure all passed. All six owned children exited; app exit0 with no guard trigger. User markers traveled via stdin, not argv. - GUI artifact `1ea31ca1e8802c45bf22cf29202d75ac611154a0244f4a49bc8bd92843c085b9` built from private integration `ff38b820a1c4622ecdd60e7b525ee7fc2522561b`, combining this PR's two byte-identical files with #2938 and engine `55ef175d`. The local dependency-resolution change removed only the engine's remote entry; all other package pins stayed identical.
  **Post-Mortem & Fix Analysis**:
  > Full-module CI passed at exact head `66f580d1c859c2cc2713d51ab1121c9160692a6d`: [test-core job](https://github.com/osaurus-ai/osaurus/actions/runs/36603917526/job/109536448694).  The actual job log reports these relevant suites passing:  - Claude Code pipe delivery ownership: 3 tests. - Claude Code configuration: 49 tests, including `generationPromptUsesStdinInsteadOfArgv`. - Claude Code stream decoder: 15 tests.  This closes the full-module test gate for these selectors. Actual provider GUI/Stop checks remain pending; no Claude API or authentication claim is implied. 
  > A fast Claude subprocess can exit after its readability callback consumes stdout bytes but before those bytes reach the decoder. Finalization could then report exit-zero/no-output or reorder the final chunks.  Serialize each pipe's read-and-deliver operation with its final drain. Keep stdout and stderr ownership separate and preserve cancellation semantics.  Validation on PR head `66f580d1c859c2cc2713d51ab1121c9160692a6d`: - All nine CI checks passed. Relevant actual app-module suites: configuration49, pipe delivery3, decoder15 (**67 passed**). [Module proof](https://github.com/osaurus-ai/osaurus/pull/2937#issuecomment-5895750341). - Deterministically gated production-runner extraction: baseline fails with exit-zero/no-output; corrected source returns the expected text. Four uninstrumented Foundation controls also pass. No sleep/retry masks the race. - Real Release app GUI: FAST output, final JSON without newline, actual Stop→SIGTERM, success after Stop, explicit exit7/stderr display, 

- **Issue #2933** (2026-09-29): **Recognize weights in symlinked model bundle diagnostics**
  *Symptoms*: A healthy local model appeared as “Bundle is incomplete” when its selected bundle directory was a symlink: config/tokenizer probes followed the link, but weight enumeration did not.  Resolve the bundle root before probing and enumeration. Preserve the selected path in diagnostics and retain symlink-containment checks. The focused change is three files; #2932 is already merged and its engine pin is preserved.  Validation: - Exact production Foundation fixture: baseline four failed expectations; candidate six of six passed, including genuinely missing weights and rejected escaping-weight links. - Actual rebuilt Release-app GUI: both GLM and Naive symlinked bundles show “Local bundle ready,” with the selected path preserved. A metadata-only control shows “Bundle is incomplete” and “Expected at least one .safetensors weight file”; restoring the original link returns to ready after reopening the detail sheet. The report is cached while the sheet remains open. - All app CI checks passed. The first core run failed in unchanged `generationPromptUsesStdinInsteadOfArgv` with exit 0/no output; the identical baseline passed. The single failed-job retry passed. The separate deterministically reproduced stdout/final-drain race is tracked in #2937; this PR did not alter its assertions or implementation.  GUI artifact SHA-256: `db1072fac94a1f8d780c2da255b1e598e8c63bf5aa0637fe66e6262b69b27f78`. Diagnostic source matches `e913dceb7`. These checks establish bundle diagnostics, not model speed o
  **Post-Mortem & Fix Analysis**:
  > Rebuilt Release app GUI validation passed for both GLM and Naive symlinked bundles. In Local Models → Runtime Diagnostics, the former false missing-safetensors diagnosis is now “Local bundle ready” with `bundle.status=available`; the selected symlink path is preserved. Missing-weight and escaping-symlink fixture controls still pass (6/6). App exited cleanly.  Proof app: base `3dad2dad` plus the identical diagnostic patch, exact engine `0d02bc7b` via an isolated package override; executable SHA256 `db1072fac94a1f8d780c2da255b1e598e8c63bf5aa0637fe66e6262b69b27f78`. This is diagnostic GUI proof, not new generation/performance proof. Current full-module CI remains pending. 
  > Final GUI negative control passed: metadata-only bundle reports missing safetensors; restored healthy symlink returns to ready after reopening the detail sheet. All current CI checks passed after the documented single retry. Original subprocess failure is preserved and separately addressed by #2937. No model-weight modification or repair was needed. 

- **Issue #2932** (2026-09-29): **Pin GLM and Naive JANGH runtime support**
  *Symptoms*: Pin the GLM/Naive JANGH runtime from osaurus-ai/vmlx-swift#529 at `0d02bc7bf21ff4832e574b0f1dac41690b1c5008` across the package manifest, three resolved graphs, and two pin-contract tests.  The runtime adds packed JANGH execution, native router precision, model-owned cache restore, and mapped-weight memory accounting. Native three-turn harness checks pass for both local models; current Release app build passed against the same engine source using an isolated local package override. Actual GUI proof completed: four GLM turns and three Naive turns, coherent natural stops and disk restore after idle unload. GLM measured 17.9/17.7/12.1/12.3 tokens/s; Naive measured 28.5/29.5/29.5 tokens/s. A combined model-switch run hit the compressor-growth guard and remains a failed row. All six source pins agree; remote-pinned CI is pending.  This is an interim correctness/runtime integration, not a universal speedup claim. Naive remains text-only, single-sequence; broader batching, video, delegation, and decode performance work are separate gates. No sampler or thinking defaults changed.  Depends on engine#529. Merge after the engine and required app CI checks pass. The Release GUI binary used the identical engine source through a local package override; remote dependency resolution is a separate CI gate. 
  **Post-Mortem & Fix Analysis**:
  > Interim text-runtime validation at engine `0d02bc7bf21ff4832e574b0f1dac41690b1c5008`:  - Release Osaurus build completed with unchanged source. App base `3dad2dad457b64f863f67209df3c278e88cd4a1d`, exact engine via isolated local dependency override; app executable SHA256 `406cd6bd7d311590ef1af922e571b604e43abc396f4669f9157f3a637420baa9`. - Actual GUI GLM: four completed coherent turns, natural stops, separate reasoning, 17.9 / 17.7 / 12.1 / 12.3 tokens/s. Follow-ups restored3429/3569tokens; after idle unload the fourth restored3715tokens and continued correctly. - Actual GUI Naive in a fresh process: three completed coherent turns, native thinking, natural stops, 28.5 / 29.5 / 29.5tokens/s. Follow-ups restored disk prefixes after idle unload. Clean GUI quit, process exit0, host-pressure normal, no swap growth; compression growth294MB. - The earlier combined GLM-to-Naive process was stopped by the diagnostic compressor-growth guard during Naive prefill (1.125GB growth, no swap growth). 

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

### Incident Patch 1: `47fcad49` (2026-09-30)
**Commit Message**: fix: reject chunk transfers after lane invalidation (#2949)

* fix: reject chunk transfers after lane invalidation

* test: exercise transfer lane reuse and concurrent cancellation

---------

Co-authored-by: Eric <eric@erics-m5-max2.lan>

**File**: `Packages/OsaurusCore/Services/ChunkedFileDownloader.swift` (modified, +35/-6)
```diff
@@ -586,7 +586,7 @@ private final class Counter: @unchecked Sendable {
 /// Exactly one request is in flight per lane, so the per-request state below
 /// needs no queue — only a lock, since the delegate callbacks land on a
 /// `URLSession` thread.
-private final class TransferLane: NSObject, URLSessionDataDelegate, @unchecked Sendable {
+final class TransferLane: NSObject, URLSessionDataDelegate, @unchecked Sendable {
     private let lock = NSLock()
     private var handle: FileHandle?
     private var expected: Int64 = 0
@@ -595,9 +595,11 @@ private final class TransferLane: NSObject, URLSessionDataDelegate, @unchecked S
     private var continuation: CheckedContinuation<Void, Error>?
     private var failure: Error?
 
-    private lazy var session: URLSession = {
-        GlobalProxySettings.makeSession(base: .default, delegate: self)
-    }()
+    // The lane is terminal after invalidation. Session construction and task
+    // creation share the state lock so cancellation cannot invalidate a session
+    // between the admission check and dataTask(with:).
+    private var session: URLSession?
+    private var invalidated = false
 
     func fetch(
         url: URL,
@@ -612,18 +614,45 @@ private final class TransferLane: NSObject, URLSessionDataDelegate, @unchecked S
 
         try await withCheckedThrowingContinuation { (c: CheckedContinuation<Void, Error>) in
             lock.lock()
+            guard !invalidated else {
+                lock.unlock()
+                c.resume(throwing: CancellationError())
+                return
+            }
+            let session: URLSession
+            if let existing = self.session {
+                session = existing
+            } else {
+                session = GlobalProxySettings.makeSession(base: .default, delegate: self)
+                self.session = session
+            }
             self.handle = handle
             self.expected = expected
             self.onBytes = onBytes
             self.received = 0
             self.failure = nil
             self.continuation = c
+            let task = session.dataTask(with: request)
             lock.unlock()
-            session.dataTask(with: request).resume()
+            // Cancellation after task creation is a normal URLSession task
+            // cancellation. Never hold the lane lock while resuming callbacks.
+            task.resume()
         }
     }
 
-    func invalidate() { session.invalidateAndCancel() }
+    func invalidate() {
+        lock.lock()
+        guard !invalidated else {
+            lock.unlock()
+            return
+        }
+        invalidated = true
+        let session = self.session
+        lock.unlock()
+        // Do not eagerly create a session merely to invalidate an unused lane.
+        // Completion of an admitted task still owns its continuation.
+        session?.invalidateAndCancel()
+    }
 
     private func setFailure(_ error: Error) {
         lock.lock()
```

**File**: `Packages/OsaurusCore/Tests/Service/ChunkedFileDownloaderTests.swift` (modified, +23/-0)
```diff
@@ -21,6 +21,29 @@ private func liveHFDownloadEnabled() -> Bool {
 @Suite(.serialized)
 struct ChunkedFileDownloaderTests {
 
+    // A paused lane can be observed by a worker immediately before its next
+    // fetch. This used to ask an invalidated URLSession to create a task, which
+    // raises an Objective-C exception instead of a catchable Swift error.
+    @Test(.timeLimit(.minutes(1))) func invalidatedLaneRejectsFetchBeforeCreatingTask() async throws {
+        let lane = TransferLane()
+        lane.invalidate()
+        lane.invalidate()
+        for _ in 0 ..< 2 {
+            do {
+                try await lane.fetch(
+                    url: URL(string: "http://127.0.0.1:1/cancelled-lane")!,
+                    range: "bytes=0-0", handle: .nullDevice, expected: 1,
+                    onBytes: { _ in Issue.record("Invalidated lane transferred data") }
+                )
+                Issue.record("Invalidated lane unexpectedly completed")
+            } catch is CancellationError {
+                // The same terminal result must hold for every later fetch.
+            } catch {
+                Issue.record("Expected cancellation, received \(error)")
+            }
+        }
+    }
+
     // MARK: - Commit pinning
 
     @Test func pinsResolveMainToCommitSHA() {
```

**File**: `Packages/OsaurusCore/Tests/Service/TransferLaneLifecycleTests.swift` (added, +226/-0)
```diff
@@ -0,0 +1,226 @@
+import Foundation
+import Network
+import Testing
+
+@testable import OsaurusCore
+
+@Suite(.serialized, .timeLimit(.minutes(1)))
+struct TransferLaneLifecycleTests {
+    @Test func sequentialRangesReuseLaneAndPreserveBytes() async throws {
+        let server = try await LaneRangeFixture.start(holdBody: false)
+        defer { server.stop() }
+        let lane = TransferLane()
+        defer { lane.invalidate() }
+        let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
+        FileManager.default.createFile(atPath: file.path, contents: nil)
+        defer { try? FileManager.default.removeItem(at: file) }
+        let handle = try FileHandle(forWritingTo: file)
+        defer { try? handle.close() }
+        for start in [0, 4] {
+            try handle.seek(toOffset: UInt64(start))
+            try await lane.fetch(
+                url: server.url, range: "bytes=\(start)-\(start + 3)",
+                handle: handle, expected: 4, onBytes: { _ in }
+            )
+        }
+        #expect(try Data(contentsOf: file) == Data("abcdefgh".utf8))
+        #expect(server.ranges == ["bytes=0-3", "bytes=4-7"])
+    }
+
+    @Test func admittedFetchCompletesCancellationAndRejectsReuse() async throws {
+        let server = try await LaneRangeFixture.start(holdBody: true)
+        defer { server.stop() }
+        let lane = TransferLane()
+        defer { lane.invalidate() }
+        let fetch = Task {
+            try await lane.fetch(
+                url: server.url, range: "bytes=0-3", handle: .nullDevice,
+                expected: 4, onBytes: { _ in }
+            )
+        }
+        do {
+            try await server.waitForRequests(1)
+        } catch {
+            lane.invalidate()
+            server.stop()
+            _ = await fetch.result
+            throw error
+        }
+        lane.invalidate()
+        lane.invalidate()
+        do {
+            try await fetch.value
+            Issue.record("An incomplete admitted response unexpectedly succeeded")
+        } catch let error as URLError {
+            #expect(error.code == .cancelled)
+        } catch {
+            Issue.record("Expected admitted URLSession cancellation, received \(error)")
+        }
+        do {
+            try await lane.fetch(
+                url: server.url, range: "bytes=4-7", handle: .nullDevice,
+                expected: 4, onBytes: { _ in }
+            )
+            Issue.record("Terminal lane admitted another request")
+        } catch is CancellationError {
+        } catch {
+            Issue.record("Expected terminal CancellationError, received \(error)")
+        }
+        #expect(server.ranges == ["bytes=0-3"])
+    }
+
+    @Test func concurrentInvalidationAndTaskCreationCompleteWithoutException() async throws {
+        let server = try await LaneRangeFixture.start(holdBody: true)
+        defer { server.stop() }
+        for _ in 0 ..< 32 {
+            let lane = TransferLane()
+            let fetch = Task {
+                try await lane.fetch(
+                    url: server.url, range: "bytes=0-3", handle: .nullDevice,
+                    expected: 4, onBytes: { _ in }
+                )
+            }
+            let invalidation = Task.detached {
+                lane.invalidate()
+                lane.invalidate()
+            }
+            await invalidation.value
+            do {
+                try await fetch.value
+                Issue.record("A held response unexpectedly completed")
+            } catch is CancellationError {
+                // Invalidation won admission.
+            } catch let error as URLError {
+                // Task creation won admission; URLSession owns cancellation.
+                #expect(error.code == .cancelled)
+            } catch {
+                Issue.record("Unexpected race outcome: \(error)")
+            }
+        }
+    }
+}
+
+/// A real loopback HTTP server, not a replacement transfer
```

---

### Incident Patch 2: `e8eb360d` (2026-09-29)
**Commit Message**: Fix diagnostics for symlinked model bundle roots (#2933)

Resolve bundle roots before diagnostic probes and weight enumeration, while retaining the selected path and existing containment checks.

Validated with production-source fixtures, actual healthy/missing/restored GUI controls, and app CI.

**File**: `Packages/OsaurusCore/Services/ExternalModelLocator.swift` (modified, +6/-2)
```diff
@@ -795,6 +795,10 @@ enum ExternalModelLocator {
         enforceSymlinkContainment: Bool = true
     ) -> BundleDiagnostic {
         let fm = FileManager.default
+        // Directory enumeration can return ENOTDIR for a URL naming a symlink,
+        // even though individual config/tokenizer probes succeed through it.
+        // Resolve the bundle itself just as discovery resolves its scan root.
+        let directory = dir.resolvingSymlinksInPath().standardizedFileURL
 
         enum Probe {
             case present
@@ -803,7 +807,7 @@ enum ExternalModelLocator {
         }
 
         func probe(_ name: String) -> Probe {
-            let url = dir.appendingPathComponent(name)
+            let url = directory.appendingPathComponent(name)
             guard fm.fileExists(atPath: url.path) else { return .missing }
             // Reject symlinks that escape the scan root.
             let resolved = url.resolvingSymlinksInPath().standardizedFileURL
@@ -829,7 +833,7 @@ enum ExternalModelLocator {
         var sawSafetensors = false
         var sawGGUF = false
         var weightEscapesRoot = false
-        if let items = try? fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) {
+        if let items = try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) {
             for item in items {
                 if item.pathExtension == "gguf" {
                     sawGGUF = true
```

**File**: `Packages/OsaurusCore/Tests/Service/ExternalModelLocatorTests.swift` (modified, +31/-0)
```diff
@@ -37,6 +37,37 @@ struct ExternalModelLocatorTests {
         #expect(report.skipped.contains { $0.reason == .unreadableRoot && $0.path == missing.path })
     }
 
+    @Test(arguments: [false, true])
+    func symlinkedBundleDiagnosticFindsWeights(enforceContainment: Bool) throws {
+        let root = makeTempDir()
+        defer { try? FileManager.default.removeItem(at: root) }
+        let actual = root.appendingPathComponent("actual", isDirectory: true)
+        writeBundle(at: actual)
+        let link = root.appendingPathComponent("bundle-link", isDirectory: true)
+        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: actual)
+        let diagnostic = ExternalModelLocator.bundleDiagnostic(
+            at: link, root: link, enforceSymlinkContainment: enforceContainment)
+        #expect(diagnostic.isValid)
+        #expect(diagnostic.reason == nil)
+    }
+
+    @Test func symlinkedBundleStillRejectsEscapingWeight() throws {
+        let root = makeTempDir()
+        defer { try? FileManager.default.removeItem(at: root) }
+        let actual = root.appendingPathComponent("actual", isDirectory: true)
+        writeBundle(at: actual)
+        let weight = actual.appendingPathComponent("model.safetensors")
+        try FileManager.default.removeItem(at: weight)
+        let outside = root.appendingPathComponent("outside.safetensors")
+        try Data("w".utf8).write(to: outside)
+        try FileManager.default.createSymbolicLink(at: weight, withDestinationURL: outside)
+        let link = root.appendingPathComponent("bundle-link", isDirectory: true)
+        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: actual)
+        let diagnostic = ExternalModelLocator.bundleDiagnostic(at: link, root: link)
+        #expect(!diagnostic.isValid)
+        #expect(diagnostic.reason == .symlinkEscapesRoot)
+    }
+
     // MARK: - Helpers
 
     private func makeTempDir() -> URL {
```

**File**: `Packages/OsaurusCore/Tests/Service/ModelCompatibilityDiagnosticsTests.swift` (modified, +15/-0)
```diff
@@ -51,6 +51,21 @@ struct ModelCompatibilityDiagnosticsTests {
         }
     }
 
+    @Test func symlinkedBundleReportsAvailableAndKeepsSelectedPath() throws {
+        let root = makeTempDir()
+        defer { try? FileManager.default.removeItem(at: root) }
+        let actual = root.appendingPathComponent("actual", isDirectory: true)
+        writeBundle(at: actual)
+        let link = root.appendingPathComponent("bundle-link", isDirectory: true)
+        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: actual)
+        let report = ModelCompatibilityDiagnostics.report(
+            modelId: "org/repo", modelName: "Repo", modelTypeHint: nil,
+            bundleURL: link, externalSource: ExternalModelLocator.Source.huggingFaceCache.rawValue)
+        #expect(report.localBundle.kind == .available)
+        #expect(report.localBundle.path == link.path)
+        #expect(report.runtime.reason != .incompleteBundle)
+    }
+
     @Test func externalBundle_reportsUnprovenRuntimeAndMissingProof() {
         let root = makeTempDir()
         defer { try? FileManager.default.removeItem(at: root) }
```

---

### Incident Patch 3: `764124dc` (2026-09-29)
**Commit Message**: Update gathered matmul runtime and fix tied-head cache identity (#2917)

* Pin gathered Metal matmul update with explicit runtime proof gates

* Pin engine batching and media cache boundary fixes

* Pin tied-head activation dtype correction

* Isolate cached state by tied-head activation policy

* Distinguish compile requests from actual execution in diagnostics

* Pin final tied-head fix and record host cache validation gates

* Pin Gemma native cache dtype preservation

* Pin standalone Xcode build closeout and update proof boundaries

---------

Co-authored-by: Eric <eric@erics-m5-max2.lan>
Co-authored-by: Eric <eric@osaurus.ai>

**File**: `App/osaurus.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/osaurus-ai/vmlx-swift",
       "state" : {
-        "revision" : "934dd5c8dc052cc6c8b4b960fe1bffd6badf0998"
+        "revision" : "094cc09b8e0130504976a38370a5a92fbcf258b0"
       }
     },
     {
```

**File**: `Packages/OsaurusCore/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind": "remoteSourceControl",
       "location": "https://github.com/osaurus-ai/vmlx-swift",
       "state": {
-        "revision": "934dd5c8dc052cc6c8b4b960fe1bffd6badf0998"
+        "revision": "094cc09b8e0130504976a38370a5a92fbcf258b0"
       }
     },
     {
```

**File**: `Packages/OsaurusCore/Package.swift` (modified, +4/-1)
```diff
@@ -318,9 +318,12 @@ let package = Package(
         // #512 validates persisted architecture state before granting SSD hits
         // and serializes validation with MLX disk I/O. #513 honors validated
         // max_tokens bundle aliases with max_new_tokens precedence.
+        // Gather row scheduling includes affine expert prefill and partial-K
+        // bounds correction. This pin also consumes the Unicode/BPE ordering,
+        // quantization_config, and SDK-gated JACCL fixes merged after #518.
         .package(
             url: "https://github.com/osaurus-ai/vmlx-swift",
-            revision: "934dd5c8dc052cc6c8b4b960fe1bffd6badf0998"
+            revision: "094cc09b8e0130504976a38370a5a92fbcf258b0"
         ),
         // FluidAudio 0.14.3 added a breaking `language:` parameter to TTS
         // calls that osaurus's `TTSService` doesn't pass. Pinning to the
```

**File**: `Packages/OsaurusCore/Services/ModelRuntime.swift` (modified, +26/-2)
```diff
@@ -5174,7 +5174,8 @@ public actor ModelRuntime {
             weightsFingerprint: weightsFingerprint,
             cacheTopology: cacheTopology,
             deepseekV4ActivationQAT:
-                resolvedSettings.effectivePerformance.deepseekV4ActivationQAT
+                resolvedSettings.effectivePerformance.deepseekV4ActivationQAT,
+            tiedHeadCodec: resolvedSettings.effectivePerformance.tiedHeadCodec
         )
 
         // Delegate the full coordinator config to vmlx's spec'd builder
@@ -5404,12 +5405,31 @@ public actor ModelRuntime {
         return String(format: "%016llx", hash)
     }
 
+    /// Match the loader's optional tied-head policy, including explicit bench
+    /// overrides. Conservatively separate codecs even for bundles whose shipped
+    /// head is already quantized and therefore ignores the optional conversion.
+    nonisolated static func tiedHeadCacheIdentity(
+        codec: VMLXTiedHeadCodec,
+        environment: [String: String] = ProcessInfo.processInfo.environment
+    ) -> String {
+        let quantization = codec.quantization
+        let bits = environment["VMLX_QUANT_TIED_HEAD_BITS"].flatMap(Int.init)
+            ?? quantization?.bits
+        guard let bits, bits > 0 else {
+            return "tied-head=as-shipped;activation=source-dtype-v1"
+        }
+        let groupSize = environment["VMLX_QUANT_TIED_HEAD_GS"].flatMap(Int.init)
+            ?? quantization?.groupSize ?? 64
+        return "tied-head=q\(bits)-gs\(groupSize);activation=source-dtype-v1"
+    }
+
     nonisolated static func cacheCoordinatorModelKey(
         modelName: String,
         kvModeTag: String,
         weightsFingerprint: String,
         cacheTopology: ModelCacheTopologySnapshot? = nil,
-        deepseekV4ActivationQAT: Bool = false
+        deepseekV4ActivationQAT: Bool = false,
+        tiedHeadCodec: VMLXTiedHeadCodec = .fp16Passthrough
     ) -> String {
         var tags = [
             modelName,
@@ -5431,6 +5451,10 @@ public actor ModelRuntime {
             // can replay a prior tool turn after reasoning-mode changes, so
             // keep every previous record outside this cache namespace.
             "warmup=recurrent-safe-seed-v2",
+            // Optional tied embedding quantization changes both input embeddings
+            // and stored attention state. The source-dtype contract also excludes
+            // entries produced before the loader stopped forcing BF16 outputs.
+            tiedHeadCacheIdentity(codec: tiedHeadCodec),
         ]
 
         if let cacheTopology {
```

**File**: `Packages/OsaurusCore/Services/ModelRuntime/MLXBatchAdapter.swift` (modified, +1/-1)
```diff
@@ -1860,7 +1860,7 @@ struct MLXBatchAdapter {
         }
 
         batchAdapterLog.info(
-            "submit: model=\(modelName, privacy: .public) promptTokens=\(prepared.promptTokens.count, privacy: .public) temperature=\(effective.temperature, privacy: .public) topP=\(effective.topP, privacy: .public) topK=\(effective.topK, privacy: .public) minP=\(effective.minP, privacy: .public) maxTokens=\(effective.maxTokens, privacy: .public) draftStrategy=\(effectiveDraftStrategy?.kindName ?? "none", privacy: .public) nativeMTPFallback=\(nativeMTPFallbackReason ?? "none", privacy: .public) compiledBatchDecode=\(effective.compiledBatchDecode, privacy: .public)"
+            "submit: model=\(modelName, privacy: .public) promptTokens=\(prepared.promptTokens.count, privacy: .public) temperature=\(effective.temperature, privacy: .public) topP=\(effective.topP, privacy: .public) topK=\(effective.topK, privacy: .public) minP=\(effective.minP, privacy: .public) maxTokens=\(effective.maxTokens, privacy: .public) draftStrategy=\(effectiveDraftStrategy?.kindName ?? "none", privacy: .public) nativeMTPFallback=\(nativeMTPFallbackReason ?? "none", privacy: .public) compiledBatchDecodeRequested=\(effective.compiledBatchDecode, privacy: .public)"
         )
 
         return PreparedStream(
```

---

### Incident Patch 4: `fcda29d3` (2026-09-28)
**Commit Message**: fix chat jumping up when a run finishes while scrolled up (#2909)

**File**: `Packages/OsaurusCore/Managers/BlockMemoizer.swift` (modified, +3/-2)
```diff
@@ -263,8 +263,9 @@ final class BlockMemoizer {
             return rolledUp(ContentBlock.coalesceToolGroups(cached))
         }
         // during streaming, cap tightly to prevent layout thrash on every delta.
-        // use a smooth transition: once streaming ends the cap rises gradually so
-        // the table doesn't get a sudden burst of new rows all at once.
+        // when streaming ends the cap widens in one step, prepending older rows
+        // above the reader. the table's scroll anchor resolves by block id so
+        // that insert doesn't move the reading position.
         let target = streaming ? streamingMaxBlocks : nonStreamingMaxBlocks
         let windowed = cached.count > target ? Array(cached.suffix(target)) : cached
         // Coalesce adjacent tool groups for display. `cached` keeps the original
```

**File**: `Packages/OsaurusCore/Views/Chat/MessageTableRepresentable.swift` (modified, +12/-3)
```diff
@@ -570,6 +570,13 @@ extension MessageTableRepresentable {
         ) {
             scrollAnchor.onScrolledToBottom = onScrolledToBottom
             scrollAnchor.onScrolledAwayFromBottom = onScrolledAwayFromBottom
+            scrollAnchor.blockIdForRow = { [weak self] row in
+                guard let self, row >= 0, row < self.blockIds.count else { return nil }
+                return self.blockIds[row]
+            }
+            scrollAnchor.rowForBlockId = { [weak self] id in
+                self?.blockIds.firstIndex(of: id)
+            }
             scrollAnchor.attach(to: scrollView, tableView: tableView)
 
             // observe actual frame changes from AppKit layout (fires after
@@ -1019,6 +1026,11 @@ extension MessageTableRepresentable {
                 newIds.reversed().filter { seenIds.insert($0).inserted }.reversed()
             )
 
+            // Save the anchor while `blockIds` still matches the table's rows,
+            // so the anchor records the block the reader is actually on.
+            let wasPinnedToBottom = scrollAnchor.isPinnedToBottom
+            scrollAnchor.saveAnchor()
+
             blockLookup = newLookup
             blockIds = uniqueIds
             streamingBlockId = newStreamingBlockId
@@ -1027,9 +1039,6 @@ extension MessageTableRepresentable {
                 oldIdSet.contains(id) && newLookup[id] != oldLookup[id]
             }
 
-            let wasPinnedToBottom = scrollAnchor.isPinnedToBottom
-            scrollAnchor.saveAnchor()
-
             var snapshot = NSDiffableDataSourceSnapshot<MessageSection, String>()
             snapshot.appendSections([.main])
             snapshot.appendItems(uniqueIds, toSection: .main)
```

**File**: `Packages/OsaurusCore/Views/Chat/ScrollAnchorManager.swift` (modified, +31/-7)
```diff
@@ -10,9 +10,12 @@
 //  - Saves / restores a scroll anchor so that applying a new diffable snapshot
 //    preserves the user's reading position.
 //
-//  The anchor is row-based: we record the topmost visible row and the pixel
-//  offset from that row's top edge. After a snapshot, we recalculate the
-//  origin from the (possibly shifted) row rect.
+//  The anchor is block-based: we record the block in the topmost visible row
+//  and the pixel offset from that row's top edge. After a snapshot, we find
+//  that block's (possibly shifted) row and recalculate the origin from its
+//  rect. Resolving by id matters because a snapshot can insert rows above the
+//  reader (e.g. the streaming block window widening when a run ends), which
+//  would leave a bare row index pointing at older content.
 //
 
 import AppKit
@@ -34,6 +37,13 @@ final class ScrollAnchorManager {
     var onScrolledToBottom: (() -> Void)?
     var onScrolledAwayFromBottom: (() -> Void)?
 
+    /// Maps a table row to its block id. Must reflect the rows currently
+    /// in the table at `saveAnchor()` time.
+    var blockIdForRow: ((Int) -> String?)?
+
+    /// Maps a block id to its row after a snapshot applies.
+    var rowForBlockId: ((String) -> Int?)?
+
     // MARK: - Private State
 
     private weak var scrollView: NSScrollView?
@@ -53,6 +63,7 @@ final class ScrollAnchorManager {
 
     private struct Anchor {
         let row: Int
+        let blockId: String?
         let offsetFromRowTop: CGFloat
     }
 
@@ -94,18 +105,31 @@ final class ScrollAnchorManager {
         guard topRow >= 0 else { savedAnchor = nil; return }
 
         let rowRect = tableView.rect(ofRow: topRow)
-        savedAnchor = Anchor(row: topRow, offsetFromRowTop: topY - rowRect.origin.y)
+        savedAnchor = Anchor(
+            row: topRow,
+            blockId: blockIdForRow?(topRow),
+            offsetFromRowTop: topY - rowRect.origin.y
+        )
     }
 
     /// Restore position from the saved anchor. Call **after** the snapshot completes.
     func restoreAnchor() {
         guard let tableView, let scrollView, let anchor = savedAnchor else { return }
         savedAnchor = nil
 
-        let clampedRow = min(anchor.row, tableView.numberOfRows - 1)
-        guard clampedRow >= 0 else { return }
+        // Prefer the anchored block's new row; fall back to the old index
+        // only when that block left the thread.
+        let row: Int
+        if let blockId = anchor.blockId, let resolved = rowForBlockId?(blockId),
+            resolved < tableView.numberOfRows
+        {
+            row = resolved
+        } else {
+            row = min(anchor.row, tableView.numberOfRows - 1)
+        }
+        guard row >= 0 else { return }
 
-        let rowRect = tableView.rect(ofRow: clampedRow)
+        let rowRect = tableView.rect(ofRow: row)
         let targetY = rowRect.origin.y + anchor.offsetFromRowTop
         let curY = scrollView.contentView.bounds.origin.y
 
```

---

### Incident Patch 5: `a53e1b45` (2026-09-27)
**Commit Message**: Fix covariant Self default argument in ProductHuntLaunchCampaign init (#2906)

Default arguments in a class initializer cannot reference Self; name the
type explicitly.

**File**: `Packages/OsaurusCore/Services/ProductHuntLaunchCampaign.swift` (modified, +1/-1)
```diff
@@ -98,7 +98,7 @@ public final class ProductHuntLaunchCampaign {
     init(
         defaults: UserDefaults = .standard,
         now: @escaping () -> Date = Date.init,
-        isPostponed: Bool = Self.isPostponed
+        isPostponed: Bool = ProductHuntLaunchCampaign.isPostponed
     ) {
         self.defaults = defaults
         self.now = now
```

---

### Incident Patch 6: `12a02a9f` (2026-09-26)
**Commit Message**: Fix timing export choices for restored chats (#2902)

* Preserve generation metrics when reopening chat history

* Label reconstructed legacy export rates as estimates

* Hydrate history timing availability before export choices

* Update subagent history regression for schema v19

---------

Co-authored-by: Eric <eric@erics-m5-max2.lan>

**File**: `Packages/OsaurusCore/Managers/Chat/ChatSessionExportCoordinator.swift` (modified, +13/-0)
```diff
@@ -12,6 +12,19 @@ import UniformTypeIdentifiers
 
 @MainActor
 enum ChatSessionExportCoordinator {
+    /// History lists and restored tabs hold metadata with empty turns. Resolve
+    /// availability before the chooser treats those rows as having no metrics.
+    static func hasTimingData(
+        metadataSession: ChatSessionData,
+        load: @MainActor (UUID) async -> ChatSessionData? = { id in
+            await ChatSessionStore.loadAsync(id: id)
+                ?? ChatSessionsManager.shared.session(for: id)
+        }
+    ) async -> Bool {
+        if metadataSession.hasAnyTimingData { return true }
+        return await load(metadataSession.id)?.hasAnyTimingData ?? false
+    }
+
     static func run(
         metadataSession: ChatSessionData,
         format: ChatSessionSidebar.ExportFormat,
```

**File**: `Packages/OsaurusCore/Tests/Chat/ChatExportTimingAvailabilityTests.swift` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+import Foundation
+import Testing
+
+@testable import OsaurusCore
+
+@MainActor
+struct ChatExportTimingAvailabilityTests {
+    @Test func metadataHydratesPersistedMetrics() async throws {
+        let db = ChatHistoryDatabase()
+        try db.openInMemory()
+        defer { db.close() }
+        let full = ChatSessionData(
+            title: "Restored chat",
+            turns: [ChatTurnData(role: .assistant, content: "Answer", generationTokensPerSecond: 42)]
+        )
+        try db.saveSession(full)
+        let metadata = try #require(db.loadMetadata(ids: [full.id]).first)
+        #expect(metadata.turns.isEmpty)
+        var requested: UUID?
+        let available = await ChatSessionExportCoordinator.hasTimingData(metadataSession: metadata) { id in
+            requested = id
+            return db.loadSession(id: id)
+        }
+        #expect(requested == metadata.id)
+        #expect(available)
+    }
+
+    @Test func loadedMetricsDoNotNeedAnotherRead() async {
+        let full = ChatSessionData(
+            title: "Live chat",
+            turns: [ChatTurnData(role: .assistant, content: "Answer", generationTokenCount: 8)]
+        )
+        var loaded = false
+        let available = await ChatSessionExportCoordinator.hasTimingData(metadataSession: full) { _ in
+            loaded = true
+            return nil
+        }
+        #expect(available)
+        #expect(!loaded)
+    }
+
+    @Test func untimedHistoryRemainsUnavailable() async {
+        let metadata = ChatSessionData(title: "Imported chat", turns: [])
+        var full = metadata
+        full.turns = [ChatTurnData(role: .assistant, content: "Untimed answer")]
+        let available = await ChatSessionExportCoordinator.hasTimingData(metadataSession: metadata) { _ in full }
+        #expect(!available)
+    }
+
+    @Test func missingSessionDoesNotInventMetrics() async {
+        let metadata = ChatSessionData(title: "Missing chat", turns: [])
+        let available = await ChatSessionExportCoordinator.hasTimingData(metadataSession: metadata) { _ in nil }
+        #expect(!available)
+    }
+}
```

**File**: `Packages/OsaurusCore/Views/Chat/ExportChooserSheet.swift` (modified, +13/-2)
```diff
@@ -20,6 +20,7 @@ struct ExportChooserSheet: View {
     @State private var direction: SlideDirection = .forward
     @State private var selectedFormat: ChatSessionSidebar.ExportFormat?
     @State private var options: ChatExportOptions = ChatExportOptions.loadLast()
+    @State private var hydratedHasTimingData: Bool?
 
     private enum Page { case format, options }
     private enum SlideDirection { case forward, backward }
@@ -29,7 +30,9 @@ struct ExportChooserSheet: View {
 
     /// Disable the toggles if no turn carries timing data so users
     /// aren't tricked into selecting flags that would produce nothing.
-    private var hasTimingData: Bool { session.hasAnyTimingData }
+    private var hasTimingData: Bool {
+        session.hasAnyTimingData || hydratedHasTimingData == true
+    }
 
     var body: some View {
         ZStack {
@@ -38,6 +41,12 @@ struct ExportChooserSheet: View {
                 .transition(slideTransition)
         }
         .frame(width: contentWidth, height: pageHeight, alignment: .top)
+        .task(id: session.id) {
+            hydratedHasTimingData = nil
+            let available = await ChatSessionExportCoordinator.hasTimingData(metadataSession: session)
+            guard !Task.isCancelled else { return }
+            hydratedHasTimingData = available
+        }
     }
 
     @ViewBuilder
@@ -147,7 +156,9 @@ struct ExportChooserSheet: View {
                 toggleRow("Deltas", binding: $options.includeDeltas)
                 toggleRow("Token usage", binding: $options.includeTokenUsage)
 
-                if !hasTimingData {
+                if !hasTimingData, hydratedHasTimingData == nil {
+                    ProgressView().controlSize(.small)
+                } else if !hasTimingData {
                     Text("No timing data captured for this conversation.", bundle: .module)
                         .font(.system(size: 11))
                         .foregroundColor(theme.tertiaryText)
```

---

### Incident Patch 7: `f90c8dcb` (2026-09-26)
**Commit Message**: fix right-click copy dropping the chat drag selection (#2899)

route context-menu and Edit menu copy through the cross-block chat selection (#2886)

**File**: `Packages/OsaurusCore/Views/Chat/ChatCrossSelection.swift` (modified, +23/-1)
```diff
@@ -75,6 +75,22 @@ extension CrossSelectableTextView {
             rect.offsetBy(dx: origin.x, dy: origin.y).fill()
         }
     }
+
+    /// Body for adopters' `copy(_:)` override. The context menu's Copy and
+    /// Edit > Copy reach `copy(_:)` directly, bypassing the Cmd+C key
+    /// monitor, while the native selectedRange is only the drag caret (or
+    /// the word AppKit selects on right-click), so an active cross-block
+    /// selection has to win here too (#2886).
+    func copyCrossSelectionIfActive() -> Bool {
+        ChatCrossSelection.shared.copyIfActive(window: window)
+    }
+
+    /// Keeps Copy enabled while a cross-block selection is active, even
+    /// when the native selection under a right-click is empty.
+    func crossSelectionEnablesCopy(_ item: NSValidatedUserInterfaceItem) -> Bool {
+        item.action == #selector(NSText.copy(_:))
+            && ChatCrossSelection.shared.hasSelection(in: window)
+    }
 }
 
 @MainActor
@@ -101,6 +117,12 @@ final class ChatCrossSelection {
 
     var hasSelection: Bool { !selectionString.isEmpty }
 
+    /// True when a selection exists and belongs to `window`.
+    func hasSelection(in window: NSWindow?) -> Bool {
+        guard hasSelection, let window else { return false }
+        return window === selectionWindow
+    }
+
     // MARK: - Drag gesture
 
     /// Owns the full drag gesture starting in `anchorView`. Blocks in a
@@ -153,7 +175,7 @@ final class ChatCrossSelection {
     /// Returns true when the copy was handled.
     @discardableResult
     func copyIfActive(window: NSWindow?) -> Bool {
-        guard hasSelection, let window, window === selectionWindow else { return false }
+        guard hasSelection(in: window) else { return false }
         let pasteboard = NSPasteboard.general
         pasteboard.clearContents()
         pasteboard.setString(selectionString, forType: .string)
```

**File**: `Packages/OsaurusCore/Views/Chat/NativeBlockViews.swift` (modified, +10/-0)
```diff
@@ -1091,6 +1091,16 @@ final class CellTextView: NSTextView, CrossSelectableTextView {
         }
     }
 
+    /// See SelectableNSTextView.copy — the cross-block selection wins.
+    override func copy(_ sender: Any?) {
+        if copyCrossSelectionIfActive() { return }
+        super.copy(sender)
+    }
+
+    override func validateUserInterfaceItem(_ item: NSValidatedUserInterfaceItem) -> Bool {
+        crossSelectionEnablesCopy(item) || super.validateUserInterfaceItem(item)
+    }
+
     override func draw(_ dirtyRect: NSRect) {
         drawCrossSelectionHighlight()
         super.draw(dirtyRect)
```

**File**: `Packages/OsaurusCore/Views/Chat/SelectableTextView.swift` (modified, +11/-0)
```diff
@@ -1023,6 +1023,17 @@ final class SelectableNSTextView: NSTextView, CrossSelectableTextView {
     override var acceptsFirstResponder: Bool { true }
     override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
 
+    /// Context-menu Copy and Edit > Copy prefer the cross-block selection
+    /// (see `copyCrossSelectionIfActive`).
+    override func copy(_ sender: Any?) {
+        if copyCrossSelectionIfActive() { return }
+        super.copy(sender)
+    }
+
+    override func validateUserInterfaceItem(_ item: NSValidatedUserInterfaceItem) -> Bool {
+        crossSelectionEnablesCopy(item) || super.validateUserInterfaceItem(item)
+    }
+
     override func becomeFirstResponder() -> Bool {
         let result = super.becomeFirstResponder()
         if result { needsDisplay = true }
```

**File**: `Packages/OsaurusCore/Views/Common/CodeBlockView.swift` (modified, +10/-0)
```diff
@@ -450,6 +450,16 @@ final class CodeNSTextView: NSTextView, CrossSelectableTextView {
     override var acceptsFirstResponder: Bool { true }
     override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
 
+    /// See SelectableNSTextView.copy — the cross-block selection wins.
+    override func copy(_ sender: Any?) {
+        if copyCrossSelectionIfActive() { return }
+        super.copy(sender)
+    }
+
+    override func validateUserInterfaceItem(_ item: NSValidatedUserInterfaceItem) -> Bool {
+        crossSelectionEnablesCopy(item) || super.validateUserInterfaceItem(item)
+    }
+
     /// Suppress NSTextView's default scroll-rect-to-visible.
     /// See `SelectableNSTextView.scrollToVisible(_:)` for the rationale —
     /// this view is read-only and any `scrollRectToVisible` originating
```

---

### Incident Patch 8: `a7d2f37e` (2026-09-26)
**Commit Message**: Fix description backfill after in-flight prompt edits (#2897)

* Fix description backfill retries after prompt edits

* Scope manual-description regression to its agent and eligible companion

---------

Co-authored-by: Eric <eric@erics-m5-max2.lan>

**File**: `Packages/OsaurusCore/Services/Inference/AgentDescriptionBackfill.swift` (modified, +16/-10)
```diff
@@ -28,8 +28,10 @@ public final class AgentDescriptionBackfill {
     /// Short so a roster-time decline does not block the post-chat trigger.
     var declineRetryInterval: TimeInterval = 15
 
-    private var inFlight: Set<UUID> = []
-    private var retryAfter: [UUID: Date] = [:]
+    // Track the prompt, not just the agent: a save during generation must
+    // queue its replacement while duplicate requests for that prompt coalesce.
+    private var inFlight: [UUID: String] = [:]
+    private var retryAfter: [UUID: (promptHash: String, until: Date)] = [:]
     private var queue: [(id: UUID, fallbackModel: String?)] = []
     private var drainTask: Task<Void, Never>?
 
@@ -62,8 +64,9 @@ public final class AgentDescriptionBackfill {
     public func scheduleIfNeeded(_ id: UUID, fallbackModel: String? = nil) {
         guard isEnabled, let agent = AgentManager.shared.agent(for: id) else { return }
         guard Self.needsGeneration(agent) else { return }
-        guard !inFlight.contains(id), !queue.contains(where: { $0.id == id }) else { return }
-        if let until = retryAfter[id], until > Date() { return }
+        let hash = AgentDescriptionPolicy.promptHash(agent.systemPrompt)
+        guard inFlight[id] != hash, !queue.contains(where: { $0.id == id }) else { return }
+        if let retry = retryAfter[id], retry.promptHash == hash, retry.until > Date() { return }
         queue.append((id, fallbackModel))
         drainIfNeeded()
     }
@@ -109,10 +112,13 @@ public final class AgentDescriptionBackfill {
 
     private func run(_ id: UUID, fallbackModel: String?) async {
         guard let agent = AgentManager.shared.agent(for: id), Self.needsGeneration(agent) else { return }
-        inFlight.insert(id)
-        defer { inFlight.remove(id) }
         let prompt = AgentDescriptionPolicy.normalized(agent.systemPrompt)
         let hash = AgentDescriptionPolicy.promptHash(prompt)
+        // A queued replacement can be edited back to a prompt that just
+        // failed. Respect that prompt's cooldown when the queue drains too.
+        if let retry = retryAfter[id], retry.promptHash == hash, retry.until > Date() { return }
+        inFlight[id] = hash
+        defer { inFlight[id] = nil }
         do {
             // Save/roster triggers do not know the chat model. Borrow whatever
             // is already resident so an unset or unavailable core model still
@@ -127,7 +133,7 @@ public final class AgentDescriptionBackfill {
             else { return }
             let normalized = AgentDescriptionPolicy.normalized(summary)
             guard !normalized.isEmpty else {
-                retryAfter[id] = Date().addingTimeInterval(retryInterval)
+                retryAfter[id] = (hash, Date().addingTimeInterval(retryInterval))
                 return
             }
             current.generatedDescription = normalized
@@ -142,13 +148,13 @@ public final class AgentDescriptionBackfill {
             // turn has a resident model.
             switch error {
             case .backgroundWouldEvictUserModel, .modelUnavailable, .circuitBreakerOpen:
-                retryAfter[id] = Date().addingTimeInterval(declineRetryInterval)
+                retryAfter[id] = (hash, Date().addingTimeInterval(declineRetryInterval))
             case .timedOut, .unresponsive:
-                retryAfter[id] = Date().addingTimeInterval(retryInterval)
+                retryAfter[id] = (hash, Date().addingTimeInterval(retryInterval))
             }
             logger.debug("description backfill skipped for \(id.uuidString, privacy: .public): \(error.localizedDescription, privacy: .public)")
         } catch {
-            retryAfter[id] = Date().addingTimeInterval(retryInterval)
+            retryAfter[id] = (hash, Date().addingTimeInterval(retryInterval))
             logger.debug("description backfill failed for \(id.uuidString, privacy: .public): \(error.localizedDescription, privacy: .public)")
         }
     }
```

**File**: `Packages/OsaurusCore/Tests/Agent/AgentDescriptionBackfillTests.swift` (modified, +69/-2)
```diff
@@ -80,13 +80,23 @@ struct AgentDescriptionBackfillTests {
             defer { SubagentStoreTestLock.shared.release() }
             let recorder = Recorder()
             let backfill = makeBackfill(recorder)
+            let manualPrompt = "Manual prompt \(UUID())"
+            let generatedPrompt = "Companion prompt \(UUID())"
             let agent = AgentManager.shared.create(
-                name: "Manual \(UUID())", description: "Mine.", systemPrompt: "Review Swift code.")
+                name: "Manual \(UUID())", description: "Mine.", systemPrompt: manualPrompt)
+            let companion = AgentManager.shared.create(name: "Automatic \(UUID())", systemPrompt: generatedPrompt)
             backfill.scheduleIfNeeded(agent.id)
             backfill.scheduleAll()
             await backfill.drain()
-            #expect(recorder.prompts.isEmpty)
+            // scheduleAll also services unrelated eligible agents (including
+            // starter fixtures). Assert this agent is excluded, not that the
+            // entire manager had no work; prove eligible work still ran.
+            #expect(!recorder.prompts.contains(manualPrompt))
+            #expect(recorder.prompts.filter { $0 == generatedPrompt }.count == 1)
+            #expect(AgentManager.shared.agent(for: agent.id)?.generatedDescription == nil)
             #expect(AgentManager.shared.agent(for: agent.id)?.routingDescription == "Mine.")
+            #expect(AgentManager.shared.agent(for: companion.id)?.generatedDescription == "Generated purpose.")
+            _ = await AgentManager.shared.delete(id: companion.id)
             _ = await AgentManager.shared.delete(id: agent.id)
         }
     }
@@ -148,6 +158,63 @@ struct AgentDescriptionBackfillTests {
         }
     }
 
+    @Test func promptEditDuringGenerationQueuesLatestPrompt() async throws {
+        try await SandboxTestLock.runWithStoragePaths {
+            await SubagentStoreTestLock.shared.acquire()
+            defer { SubagentStoreTestLock.shared.release() }
+            let agent = AgentManager.shared.create(name: "Prompt race \(UUID())", systemPrompt: "Review Swift code.")
+            var prompts: [String] = []
+            var backfill: AgentDescriptionBackfill!
+            backfill = AgentDescriptionBackfill(isEnabled: true) { prompt, _ in
+                prompts.append(prompt)
+                if prompts.count == 1 {
+                    var current = try #require(AgentManager.shared.agent(for: agent.id))
+                    current.systemPrompt = "Review release notes."
+                    AgentManager.shared.update(current)
+                    // Mirror the save trigger on this injected instance while
+                    // the old prompt is still in flight.
+                    backfill.scheduleIfNeeded(agent.id)
+                    backfill.scheduleIfNeeded(agent.id)
+                    return "Stale code review summary."
+                }
+                return "Reviews release notes."
+            }
+            backfill.scheduleIfNeeded(agent.id)
+            await backfill.drain()
+            #expect(prompts == ["Review Swift code.", "Review release notes."])
+            let saved = try #require(AgentManager.shared.agent(for: agent.id))
+            #expect(saved.description.isEmpty)
+            #expect(saved.generatedDescription == "Reviews release notes.")
+            #expect(saved.generatedDescriptionPromptHash == AgentDescriptionPolicy.promptHash(saved.systemPrompt))
+            _ = await AgentManager.shared.delete(id: agent.id)
+        }
+    }
+
+    @Test func changedPromptDoesNotInheritFailedPromptCooldown() async throws {
+        try await SandboxTestLock.runWithStoragePaths {
+            await SubagentStoreTestLock.shared.acquire()
+            defer { SubagentStoreTestLock.shared.release() }
+            let recorder = Recorder()
+            recorder.result = .failure(CoreModelError.unresponsive("old prompt failed"))
+            let backfill = makeB
```

---

### Incident Patch 9: `be361723` (2026-09-26)
**Commit Message**: Pin runtime with composite and recurrent disk-cache fixes (#2896)

* Pin runtime with composite and recurrent cache boundary fixes

* Align core package lockfile with composite cache runtime pin

* Consume composite coordinator store boundary fix

* Record composite cache runtime proof and eval limits

---------

Co-authored-by: Eric <eric@erics-m5-max2.lan>

**File**: `App/osaurus.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/osaurus-ai/vmlx-swift",
       "state" : {
-        "revision" : "6827ef1153efa434f04ebeff801d9d6b0ce3e6bd"
+        "revision" : "934dd5c8dc052cc6c8b4b960fe1bffd6badf0998"
       }
     },
     {
```

**File**: `Packages/OsaurusCore/Package.resolved` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@
       "kind": "remoteSourceControl",
       "location": "https://github.com/osaurus-ai/vmlx-swift",
       "state": {
-        "revision": "6827ef1153efa434f04ebeff801d9d6b0ce3e6bd"
+        "revision": "934dd5c8dc052cc6c8b4b960fe1bffd6badf0998"
       }
     },
     {
```

**File**: `Packages/OsaurusCore/Package.swift` (modified, +1/-1)
```diff
@@ -320,7 +320,7 @@ let package = Package(
         // max_tokens bundle aliases with max_new_tokens precedence.
         .package(
             url: "https://github.com/osaurus-ai/vmlx-swift",
-            revision: "6827ef1153efa434f04ebeff801d9d6b0ce3e6bd"
+            revision: "934dd5c8dc052cc6c8b4b960fe1bffd6badf0998"
         ),
         // FluidAudio 0.14.3 added a breaking `language:` parameter to TTS
         // calls that osaurus's `TTSService` doesn't pass. Pinning to the
```

**File**: `Packages/OsaurusCore/Tests/Service/ImageGenerationBridgeContractTests.swift` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ struct ImageGenerationBridgeContractTests {
             encoding: .utf8
         )
 
-        let expectedRevision = "6827ef1153efa434f04ebeff801d9d6b0ce3e6bd"
+        let expectedRevision = "934dd5c8dc052cc6c8b4b960fe1bffd6badf0998"
         #expect(packageSwift.contains(#"revision: "\#(expectedRevision)""#))
         // Whitespace-insensitive: the literal spacing is SwiftPM's to choose,
         // not part of the contract. `Package.resolved` used to be written
```

**File**: `Packages/OsaurusCore/Tests/Service/RuntimePolicySourceTests.swift` (modified, +1/-1)
```diff
@@ -808,7 +808,7 @@ struct RuntimePolicySourceTests {
         // and both xcworkspace Package.resolved files. Miss one and a release
         // surface resolves a revision nobody proved. OsaurusEvals resolves
         // this manifest transitively and its local Package.resolved is ignored.
-        let expectedRuntimeHardenedRevision = "6827ef1153efa434f04ebeff801d9d6b0ce3e6bd"
+        let expectedRuntimeHardenedRevision = "934dd5c8dc052cc6c8b4b960fe1bffd6badf0998"
         let manifestRevision = try Self.vmlxPinRevision(in: manifest)
         let coreResolvedRevision = try Self.vmlxPinRevision(in: coreResolved)
         let workspaceRevision = try Self.vmlxPinRevision(in: workspaceResolved)
```

---

### Incident Patch 10: `0ee59527` (2026-09-26)
**Commit Message**: Fix integer setting editing and persistence, search, and follow-up parsing (#2893)

* Preserve partially typed integer settings across clamped binding echoes

* Make concurrency and prefill controls discoverable by their displayed labels

* Reject malformed follow-up JSON instead of displaying array fragments

* Preserve the saved context window cap when decoding chat settings

---------

Co-authored-by: Eric <eric@erics-m5-max2.lan>

**File**: `Packages/OsaurusCore/Models/Chat/ChatConfiguration.swift` (modified, +3/-0)
```diff
@@ -146,6 +146,7 @@ public struct ChatConfiguration: Codable, Equatable, Sendable {
         temperature: Float? = nil,
         maxTokens: Int? = nil,
         contextLength: Int? = nil,
+        contextLengthCap: Int? = nil,
         topPOverride: Float? = nil,
         maxToolAttempts: Int? = nil,
         defaultModel: String? = nil,
@@ -163,6 +164,7 @@ public struct ChatConfiguration: Codable, Equatable, Sendable {
         self.temperature = temperature
         self.maxTokens = maxTokens
         self.contextLength = contextLength
+        self.contextLengthCap = contextLengthCap
         self.topPOverride = topPOverride
         self.maxToolAttempts = maxToolAttempts
         self.defaultModel = defaultModel
@@ -183,6 +185,7 @@ public struct ChatConfiguration: Codable, Equatable, Sendable {
         temperature = try container.decodeIfPresent(Float.self, forKey: .temperature)
         maxTokens = try container.decodeIfPresent(Int.self, forKey: .maxTokens)
         contextLength = try container.decodeIfPresent(Int.self, forKey: .contextLength)
+        contextLengthCap = try container.decodeIfPresent(Int.self, forKey: .contextLengthCap)
         topPOverride = try container.decodeIfPresent(Float.self, forKey: .topPOverride)
         maxToolAttempts = try container.decodeIfPresent(Int.self, forKey: .maxToolAttempts)
         defaultModel = try container.decodeIfPresent(String.self, forKey: .defaultModel)
```

**File**: `Packages/OsaurusCore/Models/Configuration/SettingsSearchIndex.swift` (modified, +17/-0)
```diff
@@ -619,6 +619,23 @@ public enum SettingsSearchIndex {
             keywords: ["parallel", "batch", "requests", "threads"],
             subTab: "concurrency"
         ),
+        .init(
+            id: "settings.server.concurrentSessions",
+            tab: .server,
+            section: "Concurrency & Batching",
+            title: "Concurrent Sessions",
+            keywords: ["parallel", "batch engine", "local subagents", "maximum requests"],
+            subTab: "concurrency",
+            disambiguation: "Shared engine ceiling for same-model local work; memory safety and Continuous Batching can reduce the effective limit."
+        ),
+        .init(
+            id: "settings.server.prefillChunkSize",
+            tab: .server,
+            section: "Concurrency & Batching",
+            title: "Prompt Prefill Chunk Size",
+            keywords: ["prompt processing", "prefill step", "tokens per step", "chunk"],
+            subTab: "concurrency"
+        ),
         .init(
             id: "server.proxy",
             tab: .server,
```

**File**: `Packages/OsaurusCore/Resources/Guide/guide-settings.md` (modified, +7/-0)
```diff
@@ -176,3 +176,10 @@ and **Re-derive SSM State After Generation**. Each result opens Server → Setti
 → Cache and scrolls to that control. Prefix Cache controls all reuse; Enable GPU
 Cache controls the optional RAM tier, Disk Cache controls SSD reuse, and the
 SSM option retains architecture-specific companion state for hybrid models.
+
+### Concurrency and prompt processing
+
+- **Server → Concurrency & Batching → Concurrent Sessions** sets the shared BatchEngine ceiling for same-model local jobs and local subagents. Continuous Batching must be on for concurrent decoding. Memory Safety overrides and current occupancy can reduce the effective limit displayed below the field; an empty override uses the Memory Safety profile.
+- **Server → Concurrency & Batching → Prompt Prefill Chunk Size** sets how many prompt tokens are processed per prefill step. Empty uses the engine default. This is not the context window or the response token limit.
+
+Search settings or ask Settings Help using either exact control name to navigate directly to it.
```

**File**: `Packages/OsaurusCore/Services/Chat/FollowUpSuggestionService.swift` (modified, +9/-6)
```diff
@@ -186,16 +186,19 @@ public actor FollowUpSuggestionService {
     /// when there's no array to decode so the caller can fall back to the
     /// line-list parser.
     private static func parseJSONArray(_ text: String) -> [String]? {
-        guard
-            let start = text.firstIndex(of: "["),
-            let end = text.lastIndex(of: "]"),
-            start < end
-        else { return nil }
+        guard let start = text.firstIndex(of: "[") else { return nil }
+        let tail = text[text.index(after: start)...].trimmingCharacters(in: .whitespacesAndNewlines)
+        // Plain questions may contain bracket notation. Only an array-shaped
+        // response (or quoted array after a preamble) commits to JSON parsing.
+        guard start == text.startIndex || tail.hasPrefix("\"") else { return nil }
+        // Once an array starts, malformed/truncated JSON is not a plain list.
+        // Reject it rather than exposing JSON fragments as clickable prompts.
+        guard let end = text.lastIndex(of: "]"), start < end else { return [] }
         let slice = String(text[start...end])
         guard
             let data = slice.data(using: .utf8),
             let array = try? JSONDecoder().decode([String].self, from: data)
-        else { return nil }
+        else { return [] }
         return array
     }
 
```

**File**: `Packages/OsaurusCore/Tests/Chat/ContextWindowUserCapTests.swift` (modified, +22/-0)
```diff
@@ -37,6 +37,28 @@ final class ContextWindowUserCapTests: XCTestCase {
 
     // MARK: - Lowering
 
+    func testSavedContextCapSurvivesDecodingAndStillConstrainsTheModel() throws {
+        for cap: Int? in [nil, 8_192, 131_072] {
+            let original = ChatConfiguration(
+                hotkey: nil, systemPrompt: "", contextLength: 128_000,
+                contextLengthCap: cap)
+            let decoded = try JSONDecoder().decode(
+                ChatConfiguration.self, from: JSONEncoder().encode(original))
+            XCTAssertEqual(decoded.contextLengthCap, cap)
+            XCTAssertEqual(decoded.contextLength, 128_000)
+            let effective = AgentLoopBudget.applyingUserCap(
+                resolution(222_000, .bundleMetadata), cap: decoded.contextLengthCap)
+            XCTAssertEqual(effective.tokens, cap ?? 222_000)
+        }
+    }
+
+    func testOlderSettingsWithoutACapContinueFollowingTheModel() throws {
+        let legacy = Data(#"{"systemPrompt":"","contextLength":128000}"#.utf8)
+        let decoded = try JSONDecoder().decode(ChatConfiguration.self, from: legacy)
+        XCTAssertNil(decoded.contextLengthCap)
+        XCTAssertEqual(decoded.contextLength, 128_000)
+    }
+
     func testCapLowersAModelDeclaredWindow() {
         let capped = AgentLoopBudget.applyingUserCap(
             resolution(222_000, .bundleMetadata), cap: 32_000)
```

#### Recent Merged Pull Requests:
- **PR #2952** (2026-09-30): only show the model switch advisory when leaving a local model (@RaajeevChandran)
- **PR #2950** (2026-09-30): Settings UX/IA cleanup: grouped-form kit, renamed tabs, Tools & MCP Services rework (@tpae)
- **PR #2949** (2026-09-30): fix: reject chunk transfers after lane invalidation (@jjang-ai)
- **PR #2940** (2026-09-29): Respect automatic update policy on model notifications (@jjang-ai)
- **PR #2939** (2026-09-29): Keep decimal settings editable until commit (@jjang-ai)
- **PR #2938** (2026-09-30): Surface preparation errors and pin validated logits runtime (@jjang-ai)
- **PR #2937** (2026-09-29): Drain Claude subprocess output after in-flight delivery (@jjang-ai)
- **PR #2936** (2026-09-29): Orchestrator audit remediation: truthful addendum, apply-first config, pool guard, default new-chat agent, compact spawn envelope (@tpae)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
