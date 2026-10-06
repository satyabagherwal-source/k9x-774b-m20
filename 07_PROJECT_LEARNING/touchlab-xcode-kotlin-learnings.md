# Forensic Learning Record (Deep Inspection): touchlab/xcode-kotlin

> **Canonical Artifact**: `07_PROJECT_LEARNING/touchlab-xcode-kotlin-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/touchlab/xcode-kotlin](https://github.com/touchlab/xcode-kotlin))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:01:01.815Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `touchlab/xcode-kotlin`
- **Description**: Kotlin Native Xcode Plugin
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1399 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `LLDBPlugin/touchlab_kotlin_lldb/stepping/KonanHook.py`
```
import lldb

from .KonanStepIn import KonanStepIn
from .KonanStepOut import KonanStepOut
from .KonanStepOver import KonanStepOver

KONAN_LLDB_DONT_SKIP_BRIDGING_FUNCTIONS = 'KONAN_LLDB_DONT_SKIP_BRIDGING_FUNCTIONS'
MAX_SIZE_FOR_STOP_REASON = 20
PLAN_FROM_STOP_REASON = {
    'step in': KonanStepIn.__name__,
    'step out': KonanStepOut.__name__,
    'step over': KonanStepOver.__name__,
}


class KonanHook:
    def __init__(self, target: lldb.SBTarget, extra_args, _):
        pass

    def handle_stop(self, execution_context: lldb.SBExecutionContext, stream: lldb.SBStream) -> bool:
        is_bridging_functions_skip_enabled = not execution_context.target.GetEnvironment().Get(
            KONAN_LLDB_DONT_SKIP_BRIDGING_FUNCTIONS
        )

        def is_kotlin_bridging_function() -> bool:
            addr = execution_context.frame.addr
            function_name = addr.function.name
            if function_name is None:
                return False
            file_name = addr.line_entry.file.basename
            if file_name is None:
                return False
            return function_name.startswith('objc2kotlin_') and file_name == '<compiler-generated>'

        if is_bridging_functions_skip_enabled and is_kotlin_bridging_function():
            stop_reason = execution_context.frame.thread.GetStopDescription(MAX_SIZE_FOR_STOP_REASON)
            plan = PLAN_FROM_STOP_REASON.get(stop_reason)
            if plan is not None:
                execution_context.thread.StepUsingScriptedThreadPlan('{}.{}'.format(__name__, plan), False)
                return False
        return True

```

### Core Architecture Module: `LLDBPlugin/touchlab_kotlin_lldb/util/DebuggerException.py`
```
class DebuggerException(Exception):
    def __init__(self, msg: str):
        self.msg: str = msg

```

### Core Architecture Module: `LLDBPlugin/touchlab_kotlin_lldb/util/__init__.py`
```
from typing import Optional

from .log import log
from .kotlin_object_to_cstring import kotlin_object_to_string
from .DebuggerException import DebuggerException
from .expression import evaluate

NULL = 'null'


def strip_quotes(name: Optional[str]):
    return "" if (name is None) else name.strip('"')

```

### Core Architecture Module: `LLDBPlugin/touchlab_kotlin_lldb/util/expression.py`
```
import lldb
from .log import log
from ..cache import LLDBCache


def initialize_expression_options():
    options = lldb.SBExpressionOptions()
    options.SetIgnoreBreakpoints(True)
    options.SetAutoApplyFixIts(False)
    options.SetFetchDynamicValue(False)
    options.SetGenerateDebugInfo(False)
    options.SetSuppressPersistentResult(True)
    options.SetREPLMode(False)
    options.SetAllowJIT(True)
    options.SetLanguage(lldb.eLanguageTypeC_plus_plus_20)
    return options


def initialize_top_level_expression_options():
    options = initialize_expression_options()
    options.SetTopLevel(True)
    options.SetSuppressPersistentResult(False)
    return options


EXPRESSION_OPTIONS = initialize_expression_options()
TOP_LEVEL_EXPRESSION_OPTIONS = initialize_top_level_expression_options()


def evaluate(expression: str, *args, **kwargs) -> lldb.SBValue:
    declare_helper_types()
    formatted_expression = expression.format(*args, **kwargs)
    result = lldb.debugger.GetSelectedTarget().EvaluateExpression(formatted_expression, EXPRESSION_OPTIONS)
    log(lambda: "evaluate: {} => {}".format(formatted_expression, result))
    return result


def top_level_evaluate(expr) -> lldb.SBValue:
    log(lambda: "top_level_evaluate: target={}".format(lldb.debugger.GetSelectedTarget()))
    result = lldb.debugger.GetSelectedTarget().EvaluateExpression(expr, TOP_LEVEL_EXPRESSION_OPTIONS)
    log(lambda: "top_level_evaluate: {} => {}".format(expr, result))
    return result


def declare_helper_types():
    self = LLDBCache.instance()
    if not self._helper_types_declared:
        import pathlib
        script_dir = pathlib.Path(__file__).parent.resolve()
        expression = '#include "{}/konan_debug.h"'.format(script_dir)
        result = top_level_evaluate(expression)
        log(lambda: '{} => {}'.format(expression, result))

        self._helper_types_declared = True

```

### Core Architecture Module: `LLDBPlugin/touchlab_kotlin_lldb/util/konan_debug.h`
```
#ifndef KONAN_DEBUG_H
#define KONAN_DEBUG_H

// This is true for K/N runtime that supports ObjC, so for our case it should always be 1.
#define KONAN_TYPE_INFO_HAS_WRITABLE_PART 1

#if KONAN_TYPE_INFO_HAS_WRITABLE_PART
struct WritableTypeInfo;
#endif

struct ObjHeader;
struct TypeInfo;

struct AssociatedObjectTableRecord {
  const TypeInfo* key;
  ObjHeader* (*getAssociatedObjectInstance)(ObjHeader**);
};

// Type for runtime representation of Konan object.
// Keep in sync with runtimeTypeMap in RTTIGenerator.
enum Konan_RuntimeType {
  RT_INVALID    = 0,
  RT_OBJECT     = 1,
  RT_INT8       = 2,
  RT_INT16      = 3,
  RT_INT32      = 4,
  RT_INT64      = 5,
  RT_FLOAT32    = 6,
  RT_FLOAT64    = 7,
  RT_NATIVE_PTR = 8,
  RT_BOOLEAN    = 9,
  RT_VECTOR128  = 10
};

// Flags per type.
// Keep in sync with constants in RTTIGenerator.
enum Konan_TypeFlags {
  TF_IMMUTABLE = 1 << 0,
  TF_ACYCLIC   = 1 << 1,
  TF_INTERFACE = 1 << 2,
  TF_OBJC_DYNAMIC = 1 << 3,
  TF_LEAK_DETECTOR_CANDIDATE = 1 << 4,
  TF_SUSPEND_FUNCTION = 1 << 5,
  TF_HAS_FINALIZER = 1 << 6,
  TF_HAS_FREEZE_HOOK = 1 << 7,
  TF_REFLECTION_SHOW_PKG_NAME = 1 << 8, // If package name is available in reflection, e.g. in `KClass.qualifiedName`.
  TF_REFLECTION_SHOW_REL_NAME = 1 << 9 // If relative name is available in reflection, e.g. in `KClass.simpleName`.
};

// Flags per object instance.
enum Konan_MetaFlags {
  // If freeze attempt happens on such an object - throw an exception.
  MF_NEVER_FROZEN = 1 << 0,
};


typedef signed char int8_t;
typedef unsigned char uint8_t;

typedef short int16_t;

typedef int int32_t;
typedef unsigned int uint32_t;

typedef long long int64_t;

typedef unsigned long uintptr_t;

// Extended information about a type.
struct ExtendedTypeInfo {
  // Number of fields (negated Konan_RuntimeType for array types).
  int32_t fieldsCount_;
  // Offsets of all fields.
  const int32_t* fieldOffsets_;
  // Types of all fields.
  const uint8_t* fieldTypes_;
  // Names of all fields.
  const char** fieldNames_;
  // Number of supported debug operations.
  int32_t debugOperationsCount_;
  // Table of supported debug operations functions.
  void** debugOperations_;
};

typedef void const* VTableElement;

typedef int32_t ClassId;

const ClassId kInvalidInterfaceId = 0;

struct InterfaceTableRecord {
    ClassId id;
    uint32_t vtableSize;
    VTableElement const* vtable;
};

// This struct represents runtime type information and by itself is the compile time
// constant.
// When adding a field here do not forget to adjust:
//   1. RTTIGenerator
//   2. ObjectTestSupport TypeInfoHolder
//   3. createTypeInfo in ObjcExport.mm
struct TypeInfo {
    // Reference to self, to allow simple obtaining TypeInfo via meta-object.
    const TypeInfo* typeInfo_;
    // Extended RTTI, to retain cross-version debuggability, since ABI version 5 shall always be at the second position.
    const ExtendedTypeInfo* extendedInfo_;
    // Unused field.
    uint32_t unused_;
    // Negative value marks array class/string, and it is negated element size.
    int32_t instanceSize_;
    // Must be pointer to Any for array classes, and null for Any.
    const TypeInfo* superType_;
    // All object reference fields inside this object.
    const int32_t* objOffsets_;
    // Count of object reference fields inside this object.
    // 1 for kotlin.Array to mark it as non-leaf.
    int32_t objOffsetsCount_;
    const TypeInfo* const* implementedInterfaces_;
    int32_t implementedInterfacesCount_;
    int32_t interfaceTableSize_;
    InterfaceTableRecord const* interfaceTable_;

    // String for the fully qualified dot-separated name of the package containing class.
    ObjHeader* packageName_;

    // String for the qualified class name relative to the containing package
    // (e.g. TopLevel.Nested1.Nested2) or the effective class name computed for
    // local class or anonymous object (e.g. listOf$1).
    ObjHeader* relativeName_;

    // Various flags.
    int32_t flags_;

    // Class id built with the whole class hierarchy taken into account. The details are in ClassLayoutBuilder.
    ClassId classId_;

#if KONAN_TYPE_INFO_HAS_WRITABLE_PART
    WritableTypeInfo* writableInfo_;
#endif

    // Null-terminated array.
    const AssociatedObjectTableRecord* associatedObjects;

    // Invoked on an object during mark phase.
    // TODO: Consider providing a generic traverse method instead.
    void (*processObjectInMark)(void*,ObjHeader*);

    // Required alignment of instance
    uint32_t instanceAlignment_;


    // vtable starts just after declared contents of the TypeInfo:
    // void* const vtable_[];
};

struct ObjHeader {
    TypeInfo* typeInfoOrMeta_;
};

// Header of value type array objects. Keep layout in sync with that of object header.
struct ArrayHeader {
    TypeInfo* typeInfoOrMeta_;

    // Elements count. Element size is stored in instanceSize_ field of TypeInfo, negated.
    uint32_t count_;
};

typedef void __konan_safe_void_t;
typedef int __konan_safe_int_t;
typedef char __konan_safe_char_t;
typedef bool __konan_safe_bool_t;
typedef float __konan_safe_float_t;
typedef double __konan_safe_double_t;

typedef struct MapEntry { ObjHeader* key; ObjHeader* value; } MapEntry;

int runtimeTypeSize[] = {
    -1,                  // INVALID
    sizeof(ObjHeader*),  // OBJECT
    1,                   // INT8
    2,                   // INT16
    4,                   // INT32
    8,                   // INT64
    4,                   // FLOAT32
    8,                   // FLOAT64
    sizeof(void*),       // NATIVE_PTR
    1,                   // BOOLEAN
    16                   // VECTOR128
};

int runtimeTypeAlignment[] = {
    -1,                  // INVALID
    alignof(ObjHeader*), // OBJECT
    alignof(int8_t),     // INT8
    alignof(int16_t),    // INT16
    alignof(int32_t),    // INT32
    alignof(int64_t),    // INT64
    alignof(float),      // FLOAT32
    alignof(double),     // FLOAT64
    alignof(void*),      // NATIVE_PTR
    1,                   // BOOLEAN
    16                   // VECTOR128
};

class BackRefFromAssociatedObject {
 public:
  union {
    void* ref_; // Regular object.
    ObjHeader* permanentObj_; // Permanent object.
  };
};

#endif // KONAN_DEBUG_H

```

### Core Architecture Module: `LLDBPlugin/touchlab_kotlin_lldb/util/kotlin_object_to_cstring.py`
```
from typing import Optional

from lldb import SBProcess, SBError

from .DebuggerException import DebuggerException
from .expression import evaluate
from .log import log
from ..cache import LLDBCache


def get_debug_buffer_addr() -> int:
    self = LLDBCache.instance()
    if self._debug_buffer_addr is None:
        self._debug_buffer_addr = int(evaluate("(__konan_safe_void_t *)Konan_DebugBuffer()").unsigned)
    return self._debug_buffer_addr


def get_debug_buffer_size() -> int:
    self = LLDBCache.instance()
    if self._debug_buffer_size is None:
        self._debug_buffer_size = int(evaluate("(__konan_safe_int_t)Konan_DebugBufferSize()").unsigned)
    return self._debug_buffer_size


def kotlin_object_to_string(process: SBProcess, object_addr: int) -> Optional[str]:
    debug_buffer_addr = get_debug_buffer_addr()
    debug_buffer_size = get_debug_buffer_size()
    string_len = evaluate(
        '(__konan_safe_int_t)Konan_DebugObjectToUtf8Array((__konan_safe_void_t*){:#x}, (__konan_safe_void_t *){:#x}, {});',
        object_addr,
        debug_buffer_addr,
        debug_buffer_size,
    ).signed

    if not string_len:
        return None

    error = SBError()
    s = process.ReadCStringFromMemory(debug_buffer_addr, int(string_len), error)
    if not error.Success():
        raise DebuggerException("Couldn't read object description Error: {}.".format(error.description))
    return s

```

### Core Architecture Module: `LLDBPlugin/touchlab_kotlin_lldb/util/log.py`
```
import sys
import os
from typing import Callable

logging = False
exe_logging = os.getenv('GLOG_log_dir') is not None


def log(msg: Callable[[], str]):
    if logging:
        sys.stderr.write(msg())
        sys.stderr.write('\n')
    exelog(msg)


def exelog(stmt: Callable[[], str]):
    if exe_logging:
        f = open(os.getenv('GLOG_log_dir', '') + "/konan_lldb.log", "a")
        f.write(stmt())
        f.write("\n")
        f.close()

```

### Core Architecture Module: `src/macosMain/kotlin/co/touchlab/xcode/cli/util/BackupHelper.kt`
```
package co.touchlab.xcode.cli.util

object BackupHelper {
    private val backupRoot = File(Path.home / ".xcode-kotlin" / "backup")

    fun backupPath(filename: String): Path {
        ensureBackupRootExists()
        return backupRoot.path / filename
    }

    fun ensureBackupRootExists() {
        if (!backupRoot.exists()) {
            backupRoot.mkdirs()
        }
    }
}

```

### Core Architecture Module: `src/macosMain/kotlin/co/touchlab/xcode/cli/util/Console.kt`
```
@file:Suppress("invisible_reference", "invisible_member")

package co.touchlab.xcode.cli.util

import com.github.ajalt.mordant.internal.STANDARD_TERM_INTERFACE
import com.github.ajalt.mordant.terminal.Terminal
import com.github.ajalt.mordant.terminal.YesNoPrompt
import com.github.ajalt.mordant.terminal.danger
import com.github.ajalt.mordant.terminal.info
import com.github.ajalt.mordant.terminal.muted
import com.github.ajalt.mordant.terminal.success
import com.github.ajalt.mordant.terminal.warning

object Console {
    val terminalRecorder = DelegatingTerminalRecorder(delegate = STANDARD_TERM_INTERFACE)
    val terminal = Terminal(terminalInterface = terminalRecorder)

    fun echo(text: String = "") {
        terminal.println(text)
    }

    fun confirm(text: String): Boolean {
        while (true) {
            val result = YesNoPrompt(text, terminal).ask()
            if (result != null) {
                return result
            }
        }
    }

    fun muted(message: String) {
        terminal.muted(message)
    }

    fun info(message: String) {
        terminal.info(message)
    }

    fun warning(message: String) {
        terminal.warning(message)
    }

    fun danger(message: String) {
        terminal.danger(message, stderr = true)
    }

    fun success(message: String) {
        terminal.success(message)
    }
}

```

### Core Architecture Module: `src/macosMain/kotlin/co/touchlab/xcode/cli/util/CrashHelper.kt`
```
package co.touchlab.xcode.cli.util

import com.github.ajalt.mordant.terminal.TerminalRecorder
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.runBlocking
import platform.Foundation.NSError
import platform.Foundation.NSMutableURLRequest
import platform.Foundation.NSURL
import platform.Foundation.NSURLSession
import platform.Foundation.NSURLSessionConfiguration.Companion.defaultSessionConfiguration
import platform.Foundation.NSUTF8StringEncoding
import platform.Foundation.dataTaskWithRequest
import platform.Foundation.dataUsingEncoding
import platform.Foundation.setHTTPBody
import platform.Foundation.setHTTPMethod
import platform.Foundation.setValue

class CrashHelper {
    fun upload(e: Throwable, recorder: TerminalRecorder) {
        upload(capture(e, recorder.output()))
    }

    private fun upload(crashReport: String) {
        val tagQuery = "?tag=xcode-kotlin" + if (Platform.isDebugBinary) "-DEBUG" else ""
        val url = "https://api.touchlab.dev/crash/report$tagQuery".let { urlString ->
            checkNotNull(NSURL.URLWithString(urlString)) {
                "Couldn't construct NSURL from $urlString"
            }
        }
        val request = NSMutableURLRequest.requestWithURL(url).apply {
            setHTTPMethod("POST")
            setValue("text/plain", "Content-Type")
            setHTTPBody(crashReport.objc.dataUsingEncoding(NSUTF8StringEncoding))
        }

        val uploadComplete = CompletableDeferred<Unit>()
        val session = NSURLSession
            .sessionWithConfiguration(defaultSessionConfiguration)
            .dataTaskWithRequest(request) { _, _, error ->
                if (error != null) {
                    uploadComplete.completeExceptionally(CrashReportUploadException(error))
                } else {
                    uploadComplete.complete(Unit)
                }
            }

        runBlocking {
            session.resume()
            uploadComplete.await()
        }
    }

    private fun capture(e: Throwable, recorderOutput: String): String = buildString {
        if (recorderOutput.isNotBlank()) {
            append("BREADCRUMBS\n===========\n\n")
            append(recorderOutput)
            append("\n\n")
        }

        append("FINAL CRASH\n===========\n\n")
        append(e.stackTraceToString())
    }

    class CrashReportUploadException(val error: NSError): Exception("Crash report upload failed: ${error.localizedDescription}")
}

```

### Core Architecture Module: `src/macosMain/kotlin/co/touchlab/xcode/cli/util/DelegatingTerminalRecorder.kt`
```
package co.touchlab.xcode.cli.util

import com.github.ajalt.mordant.rendering.AnsiLevel
import com.github.ajalt.mordant.terminal.PrintRequest
import com.github.ajalt.mordant.terminal.TerminalInfo
import com.github.ajalt.mordant.terminal.TerminalInterface
import com.github.ajalt.mordant.terminal.TerminalRecorder

class DelegatingTerminalRecorder(
    val delegate: TerminalInterface,
): TerminalInterface {
    val recorder = TerminalRecorder()

    override fun completePrintRequest(request: PrintRequest) {
        delegate.completePrintRequest(request)
        recorder.completePrintRequest(request)
    }

    override fun info(
        ansiLevel: AnsiLevel?,
        hyperlinks: Boolean?,
        outputInteractive: Boolean?,
        inputInteractive: Boolean?
    ): TerminalInfo = delegate.info(ansiLevel, hyperlinks, outputInteractive, inputInteractive)

    override fun readLineOrNull(hideInput: Boolean): String? = delegate.readLineOrNull(hideInput)
}

```

### Core Architecture Module: `src/macosMain/kotlin/co/touchlab/xcode/cli/util/File.kt`
```
package co.touchlab.xcode.cli.util

import co.touchlab.xcode.cli.LLDBInitManager
import kotlinx.cinterop.*
import platform.Foundation.NSData
import platform.Foundation.NSDataWritingAtomic
import platform.Foundation.NSError
import platform.Foundation.NSFileManager
import platform.Foundation.NSString
import platform.Foundation.NSUTF8StringEncoding
import platform.Foundation.create
import platform.Foundation.writeToFile

@OptIn(ExperimentalForeignApi::class)
class File(private val providedPath: Path, private val resolveSymlinks: Boolean = true) {
    val path: Path
        get() = if (resolveSymlinks) {
            providedPath.resolvingSymlinksInPath()
        } else {
            providedPath
        }

    fun dataContents(): NSData = throwingIOException { errorPointer ->
        NSData.create(contentsOfFile = path.value, options = 0u, error = errorPointer.ptr)
    } ?: error("Couldn't load data contents of file $path. This shouldn't have been thrown, because we should receive a NSError!")

    fun stringContents(): NSString = throwingIOException { errorPointer ->
        NSString.create(contentsOfFile = path.value, encoding = NSUTF8StringEncoding, error = errorPointer.ptr)
    } ?: error("Couldn't load UTF8 content of file $path. This shouldn't have been thrown, because we should receive a NSError!")

    fun exists(): Boolean = NSFileManager.defaultManager.fileExistsAtPath(path.value)

    fun write(data: NSData): Boolean = throwingIOException { errorPointer ->
        data.writeToFile(path.value, options = NSDataWritingAtomic, error = errorPointer.ptr)
    }

    fun write(string: NSString): Boolean = throwingIOException { errorPointer ->
        string.writeToFile(path.value, true, NSUTF8StringEncoding, errorPointer.ptr)
    }

    fun copy(destination: Path): Boolean = throwingIOException { errorPointer ->
        NSFileManager.defaultManager.copyItemAtPath(path.value, destination.value, errorPointer.ptr)
    }

    fun mkdirs(): Boolean = throwingIOException { errorPointer ->
        NSFileManager.defaultManager.createDirectoryAtPath(path.value, true, null, errorPointer.ptr)
    }

    fun delete(): Boolean {
        if (!exists()) {
            return false
        }
        return throwingIOException { errorPointer ->
            NSFileManager.defaultManager.removeItemAtPath(path.value, errorPointer.ptr)
        }
    }

    override fun toString(): String {
        return "File($path)"
    }

    private inline fun <T> throwingIOException(crossinline block: (ObjCObjectVar<NSError?>) -> T): T {
        return memScoped {
            val errorPointer: ObjCObjectVar<NSError?> = alloc()
            val result = block(errorPointer)
            val error = errorPointer.value
            if (error != null) {
                throw IOException(error)
            }
            result
        }
    }

    class IOException(nsError: NSError): Exception(nsError.description)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #129** (2026-04-21): **Fix: list count is incorrect**
  *Symptoms*: ## Summary For a list variable, the count is displayed incorrectly; it shows the capacity of the backing object instead.  ## Fix This fix first tries to read the `length` property, falling back to the original logic if it’s not present.  ## Pull Request Labels  <!--- While not necessary, you can help organize our pull requests by labeling this issue when you open it.  To add a label automatically, simply [x] mark the appropriate box below: -->  - [ ] has-reproduction - [ ] feature - [ ] blocking - [ ] good first review  <!--- To add a label not listed above, simply place `/label another-label-name` on a line by itself. -->

- **Issue #127** (2025-08-26): **Xcode Kotlin plugin seems to conflict with Jetbrain's Kotlin Multiplatform plugin**
  *Symptoms*: When JetBrains released the new Kotlin Multiplatform plugin for IDEA and Android Studio, I enabled it on my KMP project. However, code under `commonMain` in the new directory structure would result in the IDE claiming "Project JDK not defined".  I created an issue with JetBrains. Others have also discovered the issue and commented. Further, in the Kotlin Slack, several have responded to my questions there.  2 months later, I revisited by striving to recreate in a new project. After some experimentation, I found that the setup to make this Xcode Kotlin plugin work seems to be the underlying issue.  I discovered that the referenced Kotlin code in my `project.pbxproj` was creating complications in the new Kotlin Multiplatform plugin.  I describe my findings here:  https://youtrack.jetbrains.com/issue/KMT-1299/After-upgrading-to-Narwhal-Project-JDK-is-not-defined#focus=Comments-27-12540399.0-0  
  **Post-Mortem & Fix Analysis**:
  > Looks like this will be handled on the JB side https://youtrack.jetbrains.com/issue/KMT-1299/Kotlin-files-referenced-from-project.pbxproj-file-lead-to-Project-JDK-is-not-defined#focus=Comments-27-12553801.0-0

- **Issue #126** (2025-09-16): **Debug into code provided by klib**
  *Symptoms*: Hi i have the Following Setup  Project A (KMP) generates a .klib Project B (KMP) exposes the .klib in a XCFramework and has a Package.swift file in it's root folder.  Project C (XCode) includes the XCFramework via Swift Package Manager.  When i have some code in Project B i can debug into it from XCode directly in the code that is shown under Package Dependencies.  Now i want to debug into the code from Project A so i added it as Reference as mentioned in https://touchlab.co/xcodekotlin unfortunately the breakpoints are not called. Is there any limitation why i cannot debug in the code that was provided via a .klib?
  **Post-Mortem & Fix Analysis**:
  > Debugging a klib that isn't built on your machine doesn't generally work. We were able to work around specific cases in https://skie.touchlab.co/configuration/swift-compiler#making-debug-source-paths-relative but I don't think that would apply to your case. If you have a sample project you'd like to share, it may help us understand
  > @Nailik Is there any progress?
  > @yuhanle sorry no progress i didn't further invest time into this.

- **Issue #124** (2025-06-16): **Plugin exception on Xcode 15.0 / 16.0**
  *Symptoms*: Traceback (most recent call last):   File "/Users/leo/Library/Developer/Xcode/Plug-ins/Kotlin.ideplugin/Contents/Resources/touchlab_kotlin_lldb/types/select_provider.py", line 18, in _is_subtype     if (int(type_info.flags_) & TF_INTERFACE) != 0:   File "/Applications/Xcode15.app/Contents/SharedFrameworks/LLDB.framework/Resources/Python/lldb/__init__.py", line 15425, in __getattr__     raise AttributeError("Attribute '%s' is not defined" % name) AttributeError: Attribute 'flags_' is not defined Traceback (most recent call last):   File "/Users/leo/Library/Developer/Xcode/Plug-ins/Kotlin.ideplugin/Contents/Resources/touchlab_kotlin_lldb/types/select_provider.py", line 18, in _is_subtype     if (int(type_info.flags_) & TF_INTERFACE) != 0:   File "/Applications/Xcode15.app/Contents/SharedFrameworks/LLDB.framework/Resources/Python/lldb/__init__.py", line 15425, in __getattr__     raise AttributeError("Attribute '%s' is not defined" % name) AttributeError: Attribute 'flags_' is not defined Traceback (most recent call last):   File "/Users/leo/Library/Developer/Xcode/Plug-ins/Kotlin.ideplugin/Contents/Resources/touchlab_kotlin_lldb/types/select_provider.py", line 18, in _is_subtype     if (int(type_info.flags_) & TF_INTERFACE) != 0:   File "/Applications/Xcode15.app/Contents/SharedFrameworks/LLDB.framework/Resources/Python/lldb/__init__.py", line 15425, in __getattr__     raise AttributeError("Attribute '%s' is not defined" % name) AttributeError: Attribute 'flags_' is not defined 

- **Issue #123** (2025-06-11): **Xcode 16.0 exception**
  *Symptoms*: Traceback (most recent call last):   File "/Users/leo/Library/Developer/Xcode/Plug-ins/Kotlin.ideplugin/Contents/Resources/touchlab_kotlin_lldb/types/select_provider.py", line 18, in _is_subtype     if (int(type_info.flags_) & TF_INTERFACE) != 0:   File "/Applications/Xcode15.app/Contents/SharedFrameworks/LLDB.framework/Resources/Python/lldb/__init__.py", line 15425, in __getattr__     raise AttributeError("Attribute '%s' is not defined" % name) AttributeError: Attribute 'flags_' is not defined Traceback (most recent call last):   File "/Users/leo/Library/Developer/Xcode/Plug-ins/Kotlin.ideplugin/Contents/Resources/touchlab_kotlin_lldb/types/select_provider.py", line 18, in _is_subtype     if (int(type_info.flags_) & TF_INTERFACE) != 0:   File "/Applications/Xcode15.app/Contents/SharedFrameworks/LLDB.framework/Resources/Python/lldb/__init__.py", line 15425, in __getattr__     raise AttributeError("Attribute '%s' is not defined" % name) AttributeError: Attribute 'flags_' is not defined Traceback (most recent call last):   File "/Users/leo/Library/Developer/Xcode/Plug-ins/Kotlin.ideplugin/Contents/Resources/touchlab_kotlin_lldb/types/select_provider.py", line 18, in _is_subtype     if (int(type_info.flags_) & TF_INTERFACE) != 0:   File "/Applications/Xcode15.app/Contents/SharedFrameworks/LLDB.framework/Resources/Python/lldb/__init__.py", line 15425, in __getattr__     raise AttributeError("Attribute '%s' is not defined" % name) AttributeError: Attribute 'flags_' is not defined 

- **Issue #122** (2025-07-28): **Xcode16.2 could not add breakpoint**
  *Symptoms*: hello, when I update Xcode from 15.1 to 16.2, while debugging source code I can add breakpoint while not running, but after the app running the breakpoint miss
  **Post-Mortem & Fix Analysis**:
  > <img width="647" alt="Image" src="https://github.com/user-attachments/assets/4c6a75dc-9f38-4984-9b8d-7224374896c9" />
  > If it was working previously, see https://touchlab.co/xcodekotlin#sync as a first step. Xcode isn't super open to extension, so this is one of the constraints. The relevant part of that doc:  ## Sync  When you update Xcode versions, you'll need to enable the plugin for that version. Run:  ```shell xcode-kotlin sync ```  This process adds the UUID for the new Xcode version to the local plugin configuration. For users familiar with earlier versions of `xcode-kotlin`, Xcode updates would previously require an [update from GitHub](https://github.com/touchlab/xcode-kotlin/pull/37/files).
  > @kpgalligan thanks reply, I runned xcode-kotlin sync, and the logs below, I both have xcode15.1 and xcode16.2 on my mac    ~ xcode-kotlin sync /Applications/Xcode16.2.app Running xcode-cli with arguments: sync, /Applications/Xcode16.2.app Loading property list from /Applications/Xcode16.2.app/Contents/version.plist. Loading property list from /Applications/Xcode16.2.app/Contents/version.plist. Loading property list from /Applications/Xcode.app/Contents/version.plist. Checking if any Xcode runs. Found running Xcode instance. Xcode is running. Attempt to shut down? [y/n]: y Shutting down Xcode. Shutting down Xcode... Loading property list from file at /Users/lijie/Library/Developer/Xcode/Plug-ins/Kotlin.ideplugin/Contents/Info.plist Removing Kotlin Plugin defaults so we can add it to skipped. Removing plugin from allowed/skipped list in Xcode defaults. Saving a backup of com.apple.dt.Xcode defaults to `/Users/lijie/.xcode-kotlin/backup/XcodeDefaults_BeforeRemove.plist` Loading property l

- **Issue #121** (2025-04-15): **Fix: An address is returned when the string is empty**
  *Symptoms*: <!--- [Issue-XYZ] Add issue number and title to Title above -->  <!-- Add issue link --> ## Summary <!--- Copy summary from issue link or write a shortened description of it --> The address is returned when the string is empty  ## Fix <!-- What did you do to fix the issue? --> If the c string read from memory is not `None`, then format the string and return.  ## Pull Request Labels  <!--- While not necessary, you can help organize our pull requests by labeling this issue when you open it.  To add a label automatically, simply [x] mark the appropriate box below: -->  - [ ] has-reproduction - [ ] feature - [ ] blocking - [ ] good first review  <!--- To add a label not listed above, simply place `/label another-label-name` on a line by itself. -->
  **Post-Mortem & Fix Analysis**:
  > Hey, thanks for the PR. It took me a while to understand why the change is actually needed, so for my future reference:  When `s` returned by `kotlin_object_to_string` is an empty string, the `self._valobj.GetValue()` was called, because Python considers an empty string a false value. The `s is None` makes it that we consider `""` a valid value and return it.
  > Thanks for the merge~ Yeah, that's right, the `None` and `""` in Python are different things ``` if my_str is None:     print("the str is None") elif not my_str:     print("the str is empty") ```

- **Issue #120** (2025-02-28): **In my project, the variable value cannot be expanded when the breakpoint is in effect.**
  *Symptoms*: In my project, the variable value cannot be expanded when the breakpoint is in effect.  It is OK in the sample（KaMPKitiOS） project。  <img width="273" alt="Image" src="https://github.com/user-attachments/assets/5d6c33e3-96e6-41e9-b299-8b3579a3bf64" />
  **Post-Mortem & Fix Analysis**:
  > Can you share more details about the project and the variables? Is it a release build? If you could share a minimal reproducing project that would be best
  > Thanks! I resolve it  by changing ‘struct TypeInfo’ to 'struct KMPTypeInfo;';

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

### Incident Patch 1: `00970b1c` (2026-04-21)
**Commit Message**: Fix: list count is incorrect (#129)

**File**: `LLDBPlugin/touchlab_kotlin_lldb/types/KonanListSyntheticProvider.py` (modified, +29/-2)
```diff
@@ -10,9 +10,11 @@
 
 class KonanListSyntheticProvider(KonanObjectSyntheticProvider):
     __possible_backing_properties = {'backing', '$this_asList', 'backingArray'}
+    __possible_size_properties = {'length'}
 
     def __init__(self, valobj: lldb.SBValue, type_info: lldb.value):
         self._backing: KonanArraySyntheticProvider = None  # type: ignore
+        self._size: Optional[int] = None
 
         super().__init__(valobj, type_info)
 
@@ -35,10 +37,14 @@ def update(self):
             self._backing = backing
 
         self._backing.update()
+        self._size = self._try_update_size()
         return False
 
     def num_children(self):
-        return self._backing.num_children()
+        if self._size is None:
+            return self._backing.num_children()
+        else:
+            return self._size
 
     def has_children(self):
         return True
@@ -50,7 +56,12 @@ def get_child_at_index(self, index):
         return self._backing.get_child_at_index(index)
 
     def to_string(self):
-        return self._backing.to_string()
+        if self._size is None:
+            return self._backing.to_string()
+        elif self._size == 1:
+            return '1 value'
+        else:
+            return '{} values'.format(self._size)
 
     def _create_backing(self, index: int, name: str) -> Optional[KonanArraySyntheticProvider]:
         address = self.get_child_address_at_index(index)
@@ -64,3 +75,19 @@ def _create_backing(self, index: int, name: str) -> Optional[KonanArraySynthetic
             return None
         else:
             return KonanArraySyntheticProvider(backing_value, child_type_info)
+
+    def _try_update_size(self) -> Optional[int]:
+        for index, name in enumerate(self._children_names):
+            if name not in KonanListSyntheticProvider.__possible_size_properties:
+                continue
+            try:
+                value = super().get_child_at_index(index)
+                if value is None or not value.IsValid():
+                    continue
+                size = value.GetValueAsSigned()
+                if size < 0:
+                    continue
+                return int(size)
+            except BaseException:
+                continue
+        return None
```

---

### Incident Patch 2: `9bb9df2b` (2025-04-14)
**Commit Message**: Fix: An address was returned when the string was empty

**File**: `LLDBPlugin/touchlab_kotlin_lldb/types/KonanStringSyntheticProvider.py` (modified, +4/-1)
```diff
@@ -26,4 +26,7 @@ def get_child_at_index(self, _):
 
     def to_string(self):
         s = kotlin_object_to_string(self._process, self._valobj.unsigned)
-        return '"{}"'.format(s) if s else self._valobj.GetValue()
+        if s is None:
+            return self._valobj.GetValue()
+        else:
+            return '"{}"'.format(s)
```

---

### Incident Patch 3: `d9affdb1` (2025-01-12)
**Commit Message**: Fix using lower Xcode version than minimum required by macOS: _LSOpenURLsWithCompletionHandler() failed for the application /Applications/Xcode.app with error -10664.

**File**: `src/macosMain/kotlin/co/touchlab/xcode/cli/XcodeHelper.kt` (modified, +8/-2)
```diff
@@ -44,8 +44,14 @@ object XcodeHelper {
     }
 
     fun openInBackground(installation: XcodeInstallation) {
-        Shell.exec("/usr/bin/open", "-gjFa", installation.path.value).checkSuccessful {
-            "Couldn't open ${installation.name} at ${installation.path}!"
+        // Fix using lower Xcode version than minimum required by macOS:
+        // _LSOpenURLsWithCompletionHandler() failed for the application /Applications/Xcode.app with error -10664.
+        // Usage: ./build/bin/macosArm64/debugExecutable/xcode-kotlin.kexe sync /Applications/Xcode.app
+        val realXcodePath = "${installation.path.value}/Contents/MacOS/Xcode"
+        logger.i { "Opening realXcodePath in background." }
+        Console.echo("Opening realXcodePath in background.")
+        Shell.exec("/usr/bin/open", "-gjF", realXcodePath).checkSuccessful {
+            "Couldn't open ${installation.name} at $realXcodePath!"
         }
     }
 
```

---

### Incident Patch 4: `ebadf2b3` (2024-11-28)
**Commit Message**: Grab fix for KT-71374 from upstream.

**File**: `LLDBPlugin/touchlab_kotlin_lldb/stepping/KonanHook.py` (modified, +2/-1)
```diff
@@ -36,5 +36,6 @@ def is_kotlin_bridging_function() -> bool:
             stop_reason = execution_context.frame.thread.GetStopDescription(MAX_SIZE_FOR_STOP_REASON)
             plan = PLAN_FROM_STOP_REASON.get(stop_reason)
             if plan is not None:
-                execution_context.thread.StepUsingScriptedThreadPlan('{}.{}'.format(__name__, plan))
+                execution_context.thread.StepUsingScriptedThreadPlan('{}.{}'.format(__name__, plan), False)
+                return False
         return True
```

---

### Incident Patch 5: `1d14300d` (2024-07-09)
**Commit Message**: Fix Swift and ObjC debugging.

**File**: `LLDBPlugin/lldb/__init__.pyi` (modified, +96/-102)
```diff
@@ -10801,11 +10801,11 @@ class SBType:
         ...
     
     __bool__ = ...
-    def IsValid(self):
+    def IsValid(self) -> bool:
         r"""IsValid(SBType self) -> bool"""
         ...
     
-    def GetByteSize(self):
+    def GetByteSize(self) -> int:
         r"""
         GetByteSize(SBType self) -> uint64_t
         Returns the number of bytes a variable with the given types occupies in memory.
@@ -10828,7 +10828,7 @@ class SBType:
         """
         ...
     
-    def IsPointerType(self):
+    def IsPointerType(self) -> bool:
         r"""
         IsPointerType(SBType self) -> bool
         Returns true if this type is a pointer type.
@@ -10844,7 +10844,7 @@ class SBType:
         """
         ...
     
-    def IsReferenceType(self):
+    def IsReferenceType(self) -> bool:
         r"""
         IsReferenceType(SBType self) -> bool
         Returns true if this type is a reference type.
@@ -10858,11 +10858,11 @@ class SBType:
         """
         ...
     
-    def IsFunctionType(self):
+    def IsFunctionType(self) -> bool:
         r"""IsFunctionType(SBType self) -> bool"""
         ...
     
-    def IsPolymorphicClass(self):
+    def IsPolymorphicClass(self) -> bool:
         r"""
         IsPolymorphicClass(SBType self) -> bool
         Returns true if this type is a polymorphic type.
@@ -10878,7 +10878,7 @@ class SBType:
         """
         ...
     
-    def IsArrayType(self):
+    def IsArrayType(self) -> bool:
         r"""
         IsArrayType(SBType self) -> bool
         Returns true if this type is an array type.
@@ -10895,7 +10895,7 @@ class SBType:
         """
         ...
     
-    def IsVectorType(self):
+    def IsVectorType(self) -> bool:
         r"""
         IsVectorType(SBType self) -> bool
         Returns true if this type is a vector type.
@@ -10910,7 +10910,7 @@ class SBType:
         """
         ...
     
-    def IsTypedefType(self):
+    def IsTypedefType(self) -> bool:
         r"""
         IsTypedefType(SBType self) -> bool
         Returns true if this type is a typedef.
@@ -10924,7 +10924,7 @@ class SBType:
         """
         ...
     
-    def IsAnonymousType(self):
+    def IsAnonymousType(self) -> bool:
         r"""
         IsAnonymousType(SBType self) -> bool
         Returns true if this type is an anonymous type.
@@ -10939,7 +10939,7 @@ class SBType:
         """
         ...
     
-    def IsScopedEnumerationType(self):
+    def IsScopedEnumerationType(self) -> bool:
         r"""
         IsScopedEnumerationType(SBType self) -> bool
         Returns true if this type is a scoped enum.
@@ -10953,7 +10953,7 @@ class SBType:
         """
         ...
     
-    def IsAggregateType(self):
+    def IsAggregateType(self) -> bool:
         r"""
         IsAggregateType(SBType self) -> bool
         Returns true if this type is an aggregate type.
@@ -10967,7 +10967,7 @@ class SBType:
         """
         ...
     
-    def GetPointerType(self):
+    def GetPointerType(self) -> SBType:
         r"""
         GetPointerType(SBType self) -> SBType
         Returns a type that represents a pointer to this type.
@@ -10984,7 +10984,7 @@ class SBType:
         """
         ...
     
-    def GetPointeeType(self):
+    def GetPointeeType(self) -> SBType:
         r"""
         GetPointeeType(SBType self) -> SBType
         Returns the underlying pointee type.
@@ -11008,7 +11008,7 @@ class SBType:
         """
         ...
     
-    def GetReferenceType(self):
+    def GetReferenceType(self) -> SBType:
         r"""
         GetReferenceType(SBType self) -> SBType
         Returns a type that represents a reference to this type.
@@ -11027,7 +11027,7 @@ class SBType:
         """
         ...
     
-    def GetTypedefedType(self):
+    def GetTypedefedType(self) -> SBType:
         r"""
         GetTypedefedType(SBType self) -> SBType
         Returns the underlying type of a typedef.
@@ -11045,7 +11045,7 @@ class SBType:
         """
         ...
     
-    def GetDereferencedType(self):
+    def GetDereferencedType(self) -> SBType:
         r"""
         GetDereferencedType(SBType self) -> SBType
         Returns the underlying type of a reference type.
@@ -11064,7 +11064,7 @@ class SBType:
         """
         ...
     
-    def GetUnqualifiedType(self):
+    def GetUnqualifiedType(self) -> SBType:
         r"""
         GetUnqualifiedType(SBType self) -> SBType
         Returns the unqualified version of this type.
@@ -11078,7 +11078,7 @@ class SBType:
         """
         ...
     
-    def GetArrayElementType(self):
+    def GetArrayElementType(self) -> SBType:
         r"""
         GetArrayElementType(SBType self) -> SBType
         Returns the array element type if this type is an array type.
@@ -11098,7 +11098,7 @@ class SBType:
         """
         ...
     
-    def GetArrayType(self, size):
+    def GetArrayType(self, size) -> SBType:
         r"""
         GetArrayType(SBType self, uint64_t size) -> SBType
         Returns the array t
```

**File**: `LLDBPlugin/run.py` (modified, +20/-3)
```diff
@@ -2,9 +2,22 @@
 
 import os
 import subprocess
+import sys
 
 import lldb
 
+
+def tracefunc(frame, event, arg, indent=[0]):
+    if event == "call":
+        indent[0] += 2
+        print("-" * indent[0] + "> call function", frame.f_code.co_name)
+    elif event == "return":
+        print("<" + "-" * indent[0], "exit function", frame.f_code.co_name)
+        indent[0] -= 2
+    return tracefunc
+
+# sys.setprofile(tracefunc)
+
 gradle_invoke = subprocess.Popen(['./gradlew', 'compileSwift'], cwd='test_project')
 gradle_exit_code = gradle_invoke.wait()
 
@@ -28,6 +41,9 @@
 debugger.SetAsync(False)
 
 # debugger.HandleCommand('log enable lldb default')
+# debugger.HandleCommand('log enable lldb default')
+debugger.HandleCommand('log enable lldb commands')
+debugger.HandleCommand('log enable lldb types')
 
 # Import our module
 debugger.HandleCommand('command script import touchlab_kotlin_lldb')
@@ -42,16 +58,17 @@
 
     if process:
         import time
+
         start = time.perf_counter()
-        debugger.HandleCommand('fr v --ptr-depth 16 -- string')
+        debugger.HandleCommand('fr v -T --ptr-depth 16')
         print('HandleCommand took {:.6}s'.format(time.perf_counter() - start))
         process.Continue()
         # debugger.HandleCommand('fr v --ptr-depth 16 -- data')
-        debugger.HandleCommand('fr v --ptr-depth 16')
+        # debugger.HandleCommand('fr v --ptr-depth 16')
 
         process.Kill()
 
 # Finally, dispose of the debugger you just made.
 lldb.SBDebugger.Destroy(debugger)
 # Terminate the debug session
-lldb.SBDebugger.Terminate()
\ No newline at end of file
+lldb.SBDebugger.Terminate()
```

**File**: `LLDBPlugin/touchlab_kotlin_lldb/__init__.py` (modified, +3/-5)
```diff
@@ -19,7 +19,6 @@
 KONAN_INIT_MODULE_NAME = '[0-9a-zA-Z_]+'
 KONAN_INIT_SUFFIX = '_kexe'
 
-
 def __lldb_init_module(debugger: lldb.SBDebugger, _):
     log(lambda: "init start")
 
@@ -28,7 +27,7 @@ def __lldb_init_module(debugger: lldb.SBDebugger, _):
     register_commands(debugger)
     register_hooks(debugger)
 
-    configure_objc_types(debugger)
+    configure_objc_types_init(debugger)
 
     log(lambda: "init end")
 
@@ -39,7 +38,7 @@ def reset_cache():
     LLDBCache.reset()
 
 
-def configure_objc_types(debugger: lldb.SBDebugger):
+def configure_objc_types_init(debugger: lldb.SBDebugger):
     target = debugger.GetDummyTarget()
     breakpoint = target.BreakpointCreateByRegex(
         "^{}({})({})?$".format(KONAN_INIT_PREFIX, KONAN_INIT_MODULE_NAME, KONAN_INIT_SUFFIX)
@@ -89,8 +88,7 @@ def configure_objc_types_breakpoint(frame: lldb.SBFrame, bp_loc: lldb.SBBreakpoi
             )
         )
 
-    debugger = target.debugger
-    category = debugger.GetCategory(KOTLIN_CATEGORY)
+    category = target.debugger.GetCategory(KOTLIN_CATEGORY)
 
     for type_specifier in specifiers_to_register:
         category.AddTypeSummary(
```

**File**: `LLDBPlugin/touchlab_kotlin_lldb/cache/__init__.py` (modified, +3/-3)
```diff
@@ -19,9 +19,9 @@ def instance(cls):
     def __init__(self):
         self._debug_buffer_addr: Optional[int] = None
         self._debug_buffer_size: Optional[int] = None
-        self._string_symbol_addr: Optional[int] = None
-        self._list_symbol_addr: Optional[int] = None
-        self._map_symbol_addr: Optional[int] = None
+        self._string_symbol_value: Optional[lldb.value] = None
+        self._list_symbol_value: Optional[lldb.value] = None
+        self._map_symbol_value: Optional[lldb.value] = None
         self._helper_types_declared: bool = False
         self._type_info_type: Optional[lldb.SBType] = None
         self._obj_header_type: Optional[lldb.SBType] = None
```

**File**: `LLDBPlugin/touchlab_kotlin_lldb/types/KonanArraySyntheticProvider.py` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ def num_children(self):
         return self._children_count
 
     def has_children(self):
-        return self._children_count > 0
+        return True
 
     def get_child_index(self, name):
         log(lambda: "KonanArraySyntheticProvider::get_child_index({})".format(name))
```

**File**: `LLDBPlugin/touchlab_kotlin_lldb/types/KonanBaseSyntheticProvider.py` (modified, +8/-6)
```diff
@@ -5,19 +5,21 @@
 
 class KonanBaseSyntheticProvider(object):
     def __init__(self, valobj: lldb.SBValue, type_info: lldb.value):
+        super().__init__()
+
         self._valobj: lldb.SBValue = valobj
         self._val: lldb.value = lldb.value(valobj.GetNonSyntheticValue())
         self._type_info: lldb.value = type_info
         self._process: lldb.SBProcess = lldb.debugger.GetSelectedTarget().process
 
-        super().__init__()
-
-        # We need to call it ourselves, because Xcode doesn't seem to call it in some cases
-        self.update()
-
     def update(self) -> bool:
         return False
 
+    def get_type_name(self) -> str:
+        package_name = kotlin_object_to_string(self._process, self._type_info.packageName_.sbvalue.unsigned)
+        relative_name = kotlin_object_to_string(self._process, self._type_info.relativeName_.sbvalue.unsigned)
+        return '{}.{}'.format(package_name, relative_name)
+
     def read_cstring(self, address: int) -> str:
         error = lldb.SBError()
         result = self._process.ReadCStringFromMemory(
@@ -35,4 +37,4 @@ def read_cstring(self, address: int) -> str:
         return result
 
     def to_string(self):
-        return kotlin_object_to_string(self._process, self._valobj.unsigned)
\ No newline at end of file
+        return kotlin_object_to_string(self._process, self._valobj.unsigned)
```

**File**: `LLDBPlugin/touchlab_kotlin_lldb/types/KonanListSyntheticProvider.py` (modified, +3/-3)
```diff
@@ -33,15 +33,15 @@ def update(self):
                 )
 
             self._backing = backing
-        else:
-            self._backing.update()
+
+        self._backing.update()
         return False
 
     def num_children(self):
         return self._backing.num_children()
 
     def has_children(self):
-        return self._backing.has_children()
+        return True
 
     def get_child_index(self, name):
         return self._backing.get_child_index(name)
```

**File**: `LLDBPlugin/touchlab_kotlin_lldb/types/KonanMapSyntheticProvider.py` (modified, +6/-6)
```diff
@@ -33,20 +33,20 @@ def update(self):
                 raise DebuggerException(
                     "Couldn't find backing for map {:#x}, name: {}".format(self._valobj.unsigned, self._valobj.name)
                 )
+            else:
+                self._keys = keys
+                self._values = values
 
-            self._keys = keys
-            self._values = values
-        else:
-            self._keys.update()
-            self._values.update()
+        self._keys.update()
+        self._values.update()
 
         return False
 
     def num_children(self):
         return self._keys.num_children()
 
     def has_children(self):
-        return self._keys.has_children()
+        return True
 
     def get_child_index(self, name):
         # TODO: Not correct, we need to look at the values which this doesn't do
```

---

### Incident Patch 6: `8dfe2891` (2024-07-08)
**Commit Message**: Fixup init and xcode-kotlin semver support.

**File**: `LLDBPlugin/lldb/__init__.pyi` (modified, +32/-32)
```diff
@@ -5767,19 +5767,19 @@ class SBLineEntry:
         r"""__ne__(SBLineEntry self, SBLineEntry rhs) -> bool"""
         ...
     
-    def GetDescription(self, description):
+    def GetDescription(self, description: SBStream) -> bool:
         r"""GetDescription(SBLineEntry self, SBStream description) -> bool"""
         ...
     
-    def __repr__(self):
+    def __repr__(self) -> str:
         r"""__repr__(SBLineEntry self) -> std::string"""
         ...
     
-    file = ...
-    line = ...
-    column = ...
-    addr = ...
-    end_addr = ...
+    file: SBFileSpec = ...
+    line: int = ...
+    column: int = ...
+    addr: SBAddress = ...
+    end_addr: SBAddress = ...
     def __eq__(self, rhs) -> bool:
         ...
     
@@ -6259,31 +6259,31 @@ class SBModule:
         """
         ...
     
-    def GetNumSymbols(self):
+    def GetNumSymbols(self) -> int:
         r"""GetNumSymbols(SBModule self) -> size_t"""
         ...
     
-    def GetSymbolAtIndex(self, idx):
+    def GetSymbolAtIndex(self, idx) -> SBSymbol:
         r"""GetSymbolAtIndex(SBModule self, size_t idx) -> SBSymbol"""
         ...
     
-    def FindSymbol(self, *args):
+    def FindSymbol(self, *args) -> SBSymbol:
         r"""FindSymbol(SBModule self, char const * name, lldb::SymbolType type=eSymbolTypeAny) -> SBSymbol"""
         ...
     
-    def FindSymbols(self, *args):
+    def FindSymbols(self, *args) -> SBSymbolContextList:
         r"""FindSymbols(SBModule self, char const * name, lldb::SymbolType type=eSymbolTypeAny) -> SBSymbolContextList"""
         ...
     
-    def GetNumSections(self):
+    def GetNumSections(self) -> int:
         r"""GetNumSections(SBModule self) -> size_t"""
         ...
     
-    def GetSectionAtIndex(self, idx):
+    def GetSectionAtIndex(self, idx) -> SBSection:
         r"""GetSectionAtIndex(SBModule self, size_t idx) -> SBSection"""
         ...
     
-    def FindFunctions(self, *args):
+    def FindFunctions(self, *args) -> SBSymbolContextList:
         r"""
         FindFunctions(SBModule self, char const * name, uint32_t name_type_mask=eFunctionNameTypeAny) -> SBSymbolContextList
 
@@ -6344,23 +6344,23 @@ class SBModule:
         """
         ...
     
-    def FindFirstType(self, name):
+    def FindFirstType(self, name) -> SBType:
         r"""FindFirstType(SBModule self, char const * name) -> SBType"""
         ...
     
-    def FindTypes(self, type):
+    def FindTypes(self, type) -> SBTypeList:
         r"""FindTypes(SBModule self, char const * type) -> SBTypeList"""
         ...
     
-    def GetTypeByID(self, uid):
+    def GetTypeByID(self, uid) -> SBType:
         r"""GetTypeByID(SBModule self, lldb::user_id_t uid) -> SBType"""
         ...
     
-    def GetBasicType(self, type):
+    def GetBasicType(self, type) -> SBType:
         r"""GetBasicType(SBModule self, lldb::BasicType type) -> SBType"""
         ...
     
-    def GetTypes(self, *args):
+    def GetTypes(self, *args) -> SBTypeList:
         r"""
         GetTypes(SBModule self, uint32_t type_mask=eTypeClassAny) -> SBTypeList
 
@@ -8607,19 +8607,19 @@ class SBSymbolContextList:
         ...
     
     __bool__ = ...
-    def IsValid(self):
+    def IsValid(self) -> bool:
         r"""IsValid(SBSymbolContextList self) -> bool"""
         ...
     
-    def GetSize(self):
+    def GetSize(self) -> int:
         r"""GetSize(SBSymbolContextList self) -> uint32_t"""
         ...
     
-    def GetContextAtIndex(self, idx):
+    def GetContextAtIndex(self, idx) -> SBSymbolContext:
         r"""GetContextAtIndex(SBSymbolContextList self, uint32_t idx) -> SBSymbolContext"""
         ...
     
-    def GetDescription(self, description):
+    def GetDescription(self, description: SBStream) -> bool:
         r"""GetDescription(SBSymbolContextList self, SBStream description) -> bool"""
         ...
     
@@ -8634,7 +8634,7 @@ class SBSymbolContextList:
         r"""Clear(SBSymbolContextList self)"""
         ...
     
-    def __repr__(self):
+    def __repr__(self) -> str:
         r"""__repr__(SBSymbolContextList self) -> std::string"""
         ...
     
@@ -8643,10 +8643,10 @@ class SBSymbolContextList:
         object.'''
         ...
     
-    def __len__(self): # -> int:
+    def __len__(self) -> int:
         ...
     
-    def __getitem__(self, key):
+    def __getitem__(self, key) -> SBSymbolContext:
         ...
     
     def get_module_array(self): # -> list[Any]:
@@ -11652,27 +11652,27 @@ class SBTypeList:
         ...
     
     __bool__ = ...
-    def IsValid(self):
+    def IsValid(self) -> bool:
         r"""IsValid(SBTypeList self) -> bool"""
         ...
     
-    def Append(self, type):
+    def Append(self, type: SBType):
         r"""Append(SBTypeList self, SBType type)"""
         ...
     
-    def GetTypeAtIndex(self, index):
+    def GetTypeAtIndex(self, index) -> SBType:
         r"""GetTypeAtIndex(SBTypeList self, uint32_t index) -> SBType"""
         ...
     
-    def GetSize(self):
+    def 
```

**File**: `LLDBPlugin/run.py` (modified, +4/-3)
```diff
@@ -12,6 +12,7 @@
     exit(gradle_exit_code)
 
 exe = 'test_project/build/swift/app'
+framework_path = 'test_project/build/bin/macosArm64/debugFramework'
 
 # Initialize the debugger before making any API calls.
 lldb.SBDebugger.Initialize()
@@ -35,14 +36,14 @@
 
 if target:
     # target.BreakpointCreateByLocation("main.swift", 14)
-    target.BreakpointCreateByLocation('main.kt', 47)
+    target.BreakpointCreateByLocation('main.kt', 30)
 
-    process: lldb.SBProcess = target.LaunchSimple(None, None, os.getcwd())
+    process: lldb.SBProcess = target.LaunchSimple(None, ["DYLD_FRAMEWORK_PATH={}".format(framework_path)], os.getcwd())
 
     if process:
         import time
         start = time.perf_counter()
-        debugger.HandleCommand('fr v --ptr-depth 16')
+        debugger.HandleCommand('fr v --ptr-depth 16 -- string')
         print('HandleCommand took {:.6}s'.format(time.perf_counter() - start))
         process.Continue()
         # debugger.HandleCommand('fr v --ptr-depth 16 -- data')
```

**File**: `LLDBPlugin/test_project/main.swift` (modified, +6/-0)
```diff
@@ -15,6 +15,12 @@ let dataObject = DataObject.shared
 let basicList = [basic]
 let dataList = [data]
 let dataMap = ["hello": data]
+let test = Test()
+let testList = [test]
 
 let nsBasic = basic as NSObject
 
+
+struct Test {
+    let x = Foo()
+}
```

**File**: `LLDBPlugin/touchlab_kotlin_lldb/__init__.py` (modified, +8/-4)
```diff
@@ -8,15 +8,15 @@
 from .util.log import log
 from .commands import FieldTypeCommand, SymbolByNameCommand, TypeByAddressCommand
 
-from .types import kotlin_object_type_summary, kotlin_objc_class_summary
-from .types.KonanProxyTypeProvider import KonanProxyTypeProvider
-from .types.KonanObjcProxyTypeProvider import KonanObjcProxyTypeProvider
+from .types.summary import kotlin_object_type_summary, kotlin_objc_class_summary
+from .types.proxy import KonanProxyTypeProvider, KonanObjcProxyTypeProvider
 
 from .cache import LLDBCache
 
 os.environ['CLIENT_TYPE'] = 'Xcode'
 
 KONAN_INIT_PREFIX = '_Konan_init_'
+KONAN_INIT_MODULE_NAME = '[0-9a-zA-Z_]+'
 KONAN_INIT_SUFFIX = '_kexe'
 
 
@@ -41,7 +41,9 @@ def reset_cache():
 
 def configure_objc_types(debugger: lldb.SBDebugger):
     target = debugger.GetDummyTarget()
-    breakpoint = target.BreakpointCreateByRegex("^{}(.*){}$".format(KONAN_INIT_PREFIX, KONAN_INIT_SUFFIX))
+    breakpoint = target.BreakpointCreateByRegex(
+        "^{}({})({})?$".format(KONAN_INIT_PREFIX, KONAN_INIT_MODULE_NAME, KONAN_INIT_SUFFIX)
+    )
     breakpoint.SetOneShot(True)
     breakpoint.SetAutoContinue(True)
     breakpoint.SetScriptCallbackFunction('{}.{}'.format(__name__, configure_objc_types_breakpoint.__name__))
@@ -68,6 +70,8 @@ def configure_objc_types_breakpoint(frame: lldb.SBFrame, bp_loc: lldb.SBBreakpoi
         break
 
     module_name = frame.symbol.name.removeprefix(KONAN_INIT_PREFIX).removesuffix(KONAN_INIT_SUFFIX)
+    if module_name == "stdlib":
+        return False
 
     specifiers_to_register = [
         lldb.SBTypeNameSpecifier(
```

**File**: `LLDBPlugin/touchlab_kotlin_lldb/commands/FieldTypeCommand.py` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 from lldb import SBDebugger, SBExecutionContext, SBCommandReturnObject
 
-from ..types.KonanProxyTypeProvider import KonanProxyTypeProvider
+from ..types.proxy import KonanProxyTypeProvider
 from ..types.base import get_runtime_type
 
 
```

**File**: `LLDBPlugin/touchlab_kotlin_lldb/commands/KonanGlobalsCommand.py` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 from lldb import SBDebugger, SBExecutionContext, SBCommandReturnObject
 
-from ..types import kotlin_object_type_summary
+from ..types.summary import kotlin_object_type_summary
 from ..util.expression import evaluate
 
 
```

**File**: `LLDBPlugin/touchlab_kotlin_lldb/types/KonanArraySyntheticProvider.py` (modified, +9/-8)
```diff
@@ -7,13 +7,14 @@
 
 class KonanArraySyntheticProvider(KonanBaseSyntheticProvider):
     def __init__(self, valobj: lldb.SBValue, type_info: lldb.value):
-        super().__init__(valobj.Cast(array_header_type()), type_info)
-
         self._children_count = 0
 
-    def update(self):
+        super().__init__(valobj.Cast(array_header_type()), type_info)
+
+    def update(self) -> bool:
+        super().update()
         self._children_count = int(self._val.count_)
-        return True
+        return False
 
     def num_children(self):
         return self._children_count
@@ -29,7 +30,7 @@ def get_child_index(self, name):
     def get_child_at_index(self, index):
 
         value_type = -int(self._type_info.extendedInfo_.fieldsCount_)
-        address = self._valobj.unsigned + _align_up(
+        address = self._valobj.unsigned + self._align_up(
             self._valobj.type.GetPointeeType().GetByteSize(),
             int(runtime_type_alignment()[value_type])
         ) + index * int(runtime_type_size()[value_type])
@@ -41,6 +42,6 @@ def to_string(self):
         else:
             return '{} values'.format(self._children_count)
 
-
-def _align_up(size, alignment):
-    return (size + alignment - 1) & ~(alignment - 1)
+    @staticmethod
+    def _align_up(size, alignment):
+        return (size + alignment - 1) & ~(alignment - 1)
```

**File**: `LLDBPlugin/touchlab_kotlin_lldb/types/KonanBaseSyntheticProvider.py` (modified, +8/-7)
```diff
@@ -1,21 +1,22 @@
-from typing import Optional
-
 import lldb
 
-from ..util import log, DebuggerException, kotlin_object_to_string, evaluate
+from ..util import DebuggerException, kotlin_object_to_string
 
 
 class KonanBaseSyntheticProvider(object):
     def __init__(self, valobj: lldb.SBValue, type_info: lldb.value):
-        super().__init__()
-
         self._valobj: lldb.SBValue = valobj
         self._val: lldb.value = lldb.value(valobj.GetNonSyntheticValue())
         self._type_info: lldb.value = type_info
         self._process: lldb.SBProcess = lldb.debugger.GetSelectedTarget().process
 
-    def update(self) -> Optional[bool]:
-        pass
+        super().__init__()
+
+        # We need to call it ourselves, because Xcode doesn't seem to call it in some cases
+        self.update()
+
+    def update(self) -> bool:
+        return False
 
     def read_cstring(self, address: int) -> str:
         error = lldb.SBError()
```

---

### Incident Patch 7: `22c40a7e` (2024-05-03)
**Commit Message**: Fix info command for 15.3

**File**: `src/macosMain/kotlin/co/touchlab/xcode/cli/XcodeHelper.kt` (modified, +13/-7)
```diff
@@ -1,15 +1,14 @@
 package co.touchlab.xcode.cli
 
 import co.touchlab.kermit.Logger
-import co.touchlab.xcode.cli.XcodeHelper.Defaults.nonApplePlugins
 import co.touchlab.xcode.cli.util.BackupHelper
 import co.touchlab.xcode.cli.util.Console
 import co.touchlab.xcode.cli.util.File
-import co.touchlab.xcode.cli.util.fromString
 import co.touchlab.xcode.cli.util.Path
 import co.touchlab.xcode.cli.util.PropertyList
 import co.touchlab.xcode.cli.util.Shell
 import co.touchlab.xcode.cli.util.Version
+import co.touchlab.xcode.cli.util.fromString
 import kotlinx.serialization.SerialName
 import kotlinx.serialization.Serializable
 import kotlinx.serialization.json.Json
@@ -85,7 +84,7 @@ object XcodeHelper {
             checkNotNull(versionPlist.build?.trim()) { "Couldn't get build number of Xcode at $path." }
         }
 
-        if (Version.fromString(version) >= Version.fromString("15.3")) {
+        if (version15_3_orHigher(version)) {
             return XcodeInstallation(
                 version = version,
                 build = build,
@@ -94,10 +93,11 @@ object XcodeHelper {
         }
 
         val xcodeInfoPath = path / "Contents" / "Info"
-        val pluginCompatabilityIdResult = Shell.exec("/usr/bin/defaults", "read", xcodeInfoPath.value, "DVTPlugInCompatibilityUUID")
-            .checkSuccessful {
-                "Couldn't get plugin compatibility UUID from Xcode at ${path}."
-            }
+        val pluginCompatabilityIdResult =
+            Shell.exec("/usr/bin/defaults", "read", xcodeInfoPath.value, "DVTPlugInCompatibilityUUID")
+                .checkSuccessful {
+                    "Couldn't get plugin compatibility UUID from Xcode at ${path}."
+                }
         val pluginCompatabilityId = checkNotNull(pluginCompatabilityIdResult.output?.trim()) {
             "Couldn't get plugin compatibility ID of Xcode at path: ${path}."
         }
@@ -167,8 +167,13 @@ object XcodeHelper {
         val pluginCompatabilityId: String? = null,
     ) {
         val name: String = "Xcode $version ($build)"
+
+        fun supported(supportedXcodeUuids: Set<String>): Boolean = version15_3_orHigher(version) ||
+                supportedXcodeUuids.contains(pluginCompatabilityId)
     }
 
+    fun version15_3_orHigher(version: String) = Version.fromString(version) >= Version.fromString("15.3")
+
     @Serializable
     private data class SystemProfilerOutput(
         @SerialName("SPDeveloperToolsDataType")
@@ -216,6 +221,7 @@ object XcodeHelper {
                 NonApplePlugins(value.dictionary)
             }
         }
+
         fun PropertyList.nonApplePlugins(xcodeVersion: String): NonApplePlugins {
             val backingDictionary = root.dictionary.getOrPut(nonApplePluginsKeyPrefix + xcodeVersion) {
                 PropertyList.Object.Dictionary(
```

**File**: `src/macosMain/kotlin/co/touchlab/xcode/cli/command/Info.kt` (modified, +3/-2)
```diff
@@ -43,8 +43,9 @@ class Info: BaseXcodeListSubcommand("info", "Shows information about the plugin"
             echo("Installed Xcode versions:")
             val longestNameLength = xcodeInstallations.maxOf { it.name.length }
             for (install in xcodeInstallations) {
-                val spacesAfterName = (1..(longestNameLength - install.name.length)).joinToString(separator = "") { " " }
-                val compatibilityMark = if (supportedXcodeUuids.contains(install.pluginCompatabilityId)) "✔" else "x"
+                val spacesAfterName =
+                    (1..(longestNameLength - install.name.length)).joinToString(separator = "") { " " }
+                val compatibilityMark = if (install.supported(supportedXcodeUuids)) "✔" else "x"
                 echo("$compatibilityMark\t${install.name}$spacesAfterName\t${install.pluginCompatabilityId}\t${install.path}")
             }
 
```

---

### Incident Patch 8: `86b78fb1` (2024-03-06)
**Commit Message**: Fix crash for Xcode 15.3

**File**: `src/macosMain/kotlin/co/touchlab/xcode/cli/PluginManager.kt` (modified, +1/-1)
```diff
@@ -73,7 +73,7 @@ object PluginManager {
 
         Console.echo("Synchronizing plugin compatibility list.")
         val additionalPluginCompatibilityIds =
-            xcodeInstallations.map { PropertyList.Object.String(it.pluginCompatabilityId) }
+            xcodeInstallations.mapNotNull { it.pluginCompatabilityId?.let { PropertyList.Object.String(it) } }
         logger.v { "Xcode installation IDs to include: ${additionalPluginCompatibilityIds.joinToString { it.value }}" }
         val infoPlist = PropertyList.create(pluginTargetInfoFile)
         val rootDictionary = infoPlist.root.dictionary
```

**File**: `src/macosMain/kotlin/co/touchlab/xcode/cli/XcodeHelper.kt` (modified, +11/-1)
```diff
@@ -5,9 +5,11 @@ import co.touchlab.xcode.cli.XcodeHelper.Defaults.nonApplePlugins
 import co.touchlab.xcode.cli.util.BackupHelper
 import co.touchlab.xcode.cli.util.Console
 import co.touchlab.xcode.cli.util.File
+import co.touchlab.xcode.cli.util.fromString
 import co.touchlab.xcode.cli.util.Path
 import co.touchlab.xcode.cli.util.PropertyList
 import co.touchlab.xcode.cli.util.Shell
+import co.touchlab.xcode.cli.util.Version
 import kotlinx.serialization.SerialName
 import kotlinx.serialization.Serializable
 import kotlinx.serialization.json.Json
@@ -83,6 +85,14 @@ object XcodeHelper {
             checkNotNull(versionPlist.build?.trim()) { "Couldn't get build number of Xcode at $path." }
         }
 
+        if (Version.fromString(version) >= Version.fromString("15.3")) {
+            return XcodeInstallation(
+                version = version,
+                build = build,
+                path = path
+            )
+        }
+
         val xcodeInfoPath = path / "Contents" / "Info"
         val pluginCompatabilityIdResult = Shell.exec("/usr/bin/defaults", "read", xcodeInfoPath.value, "DVTPlugInCompatibilityUUID")
             .checkSuccessful {
@@ -154,7 +164,7 @@ object XcodeHelper {
         val version: String,
         val build: String,
         val path: Path,
-        val pluginCompatabilityId: String,
+        val pluginCompatabilityId: String? = null,
     ) {
         val name: String = "Xcode $version ($build)"
     }
```

---

### Incident Patch 9: `bd82c3d5` (2023-10-19)
**Commit Message**: Add support for "fixing" Xcode 15.

**File**: `.run/install.run.xml` (modified, +4/-4)
```diff
@@ -1,14 +1,14 @@
 <component name="ProjectRunConfigurationManager">
-  <configuration default="false" name="install" type="KonanRunConfiguration" factoryName="KonanApp" PROGRAM_PARAMS="install" REDIRECT_INPUT="false" ELEVATE="false" USE_EXTERNAL_CONSOLE="false" WORKING_DIR="file://$PROJECT_DIR$" PASS_PARENT_ENVS_2="true">
+  <configuration default="false" name="install" type="KonanRunConfiguration" factoryName="KonanApp" PROGRAM_PARAMS="install" REDIRECT_INPUT="false" ELEVATE="false" USE_EXTERNAL_CONSOLE="false" EMULATE_TERMINAL="false" WORKING_DIR="file://$PROJECT_DIR$" PASS_PARENT_ENVS_2="true">
     <executable TARGET="macos_arm64" TARGET_NAME="macosArm64" EXECUTABLE_NAME="xcode-kotlin" PROJECT_PREFIX="xcode-kotlin:" IS_TEST="false">
-      <variant NAME="Debug" GRADLE_TASK=":linkDebugExecutableMacosArm64" FILE="$PROJECT_DIR$/build/bin/macosArm64/debugExecutable/xcode-kotlin.kexe" WORKING_DIR="" PROGRAM_PARAMS="">
+      <variant NAME="Debug" GRADLE_TASK=":linkDebugExecutableMacosArm64" FILE="$PROJECT_DIR$/build/bin/macosArm64/debugExecutable/xcode-kotlin.kexe" WORKING_DIR="$PROJECT_DIR$" PROGRAM_PARAMS="&quot;&quot;">
         <envs />
       </variant>
-      <variant NAME="Release" GRADLE_TASK=":linkReleaseExecutableMacosArm64" FILE="$PROJECT_DIR$/build/bin/macosArm64/releaseExecutable/xcode-kotlin.kexe" WORKING_DIR="" PROGRAM_PARAMS="">
+      <variant NAME="Release" GRADLE_TASK=":linkReleaseExecutableMacosArm64" FILE="$PROJECT_DIR$/build/bin/macosArm64/releaseExecutable/xcode-kotlin.kexe" WORKING_DIR="$PROJECT_DIR$" PROGRAM_PARAMS="&quot;&quot;">
         <envs />
       </variant>
     </executable>
-    <variant NAME="Debug" GRADLE_TASK=":linkDebugExecutableMacosArm64" FILE="$PROJECT_DIR$/build/bin/macosArm64/debugExecutable/xcode-kotlin.kexe" WORKING_DIR="" PROGRAM_PARAMS="">
+    <variant NAME="Debug" GRADLE_TASK=":linkDebugExecutableMacosArm64" FILE="$PROJECT_DIR$/build/bin/macosArm64/debugExecutable/xcode-kotlin.kexe" WORKING_DIR="$PROJECT_DIR$" PROGRAM_PARAMS="&quot;&quot;">
       <envs />
     </variant>
     <method v="2">
```

**File**: `README.md` (modified, +37/-7)
```diff
@@ -14,12 +14,35 @@ Let us know how you're using (or will use) the xcode-kotlin plugin by taking our
 > [Open Touchlab Xcode Plugin User Survey](https://touchlabwaitlist.typeform.com/xcodepluginuser)
 *************************************************************************
 
-
-## Beta Version!!!
-
-The CLI installer is a significant improvement over our original install process, but is also more complex. We are considering this version to be a beta release. Please let us know if you have issues! If there is a crash using the tool, it will ask if you want to upload a report. Please do. For other problems, [please file an issue in Github](https://github.com/touchlab/xcode-kotlin/issues).
-
-We aren't anticipating any major problems, but If you cannot get the plugin to install properly, you can follow the [MANUAL_INSTALL](MANUAL_INSTALL.md) instructions as a workaround.
+## 💥 Xcode 15+ support 💥
+
+Xcode 15 introduced a bug where it crashes if you have any non-Apple Xcode plugin installed.
+Until the bug is fixed, we have found a workaround that's built into the `xcode-kotlin` CLI.
+All your Xcode 15 installations will have the workaround applied to them during `install`,
+`sync` and a new `fix-xcode15` commands.
+
+The workaround works like this:
+1. Disabling Xcode Kotlin plugin (if it's installed)
+2. Enabling `IDEPerformanceDebugger` plugin that's in Xcode
+3. Running each Xcode 15 installation you have (15.0, 15.0.1, etc.)
+4. Disabling `IDEPerformanceDebugger` plugin
+5. Re-enabling Xcode Kotlin plugin (if it's installed)
+
+This lets Xcode create a valid plugin cache and use it the next time it runs. 
+When the plugin cache isn't used,
+Xcode tries to scan all plugins and due to a bug freezes extension points that are used by custom plugins,
+like Xcode Kotlin.
+When the plugin cache is used, the execution goes through a different path so those extension points are not frozen,
+allowing Xcode Kotlin to load properly.
+
+The reason Xcode doesn't use the cache otherwise is 
+that it expects to find an entry for `IDEPerformanceDebugger.framework`.
+But for some reason,
+Xcode doesn't add the `IDEPerformanceDebugger` entry to the plugin cache unless the plugin is enabled.
+So essentially, performing these steps should also lead to faster Xcode startup time, what a bargain!
+
+In case your Xcode starts crashing again, run `xcode-kotlin fix-xcode15` (or `xcode-kotlin sync`).
+This will reapply the workaround and should make your Xcode work again.
 
 ## Getting Help
 
@@ -63,7 +86,14 @@ This will install the plugin with support for all of your currently installed Xc
 
 ## Manual Install
 
-If needed, you can install manually. See [MANUAL_INSTALL](MANUAL_INSTALL.md).
+The CLI installer is a significant improvement over our original install process, but is also more complex.
+Please let us know if you encounter any issues.
+If there is a crash using the tool, it will ask if you want to upload a report.
+Please do.
+For other problems, [please file an issue in Github](https://github.com/touchlab/xcode-kotlin/issues).
+
+We aren't anticipating any major problems, but If you cannot get the plugin to install properly,
+you can follow the [MANUAL_INSTALL](MANUAL_INSTALL.md) instructions as a workaround.
 
 ## Sync
 
```

**File**: `build.gradle.kts` (modified, +5/-0)
```diff
@@ -20,6 +20,9 @@ kotlin {
                 runTask?.run {
                     val args = providers.gradleProperty("runArgs")
                     args(args.getOrElse("").split(' '))
+
+                    standardOutput = System.out
+                    errorOutput = System.err
                 }
             }
         }
@@ -61,6 +64,8 @@ kotlin {
 
         all {
             languageSettings.optIn("kotlinx.cli.ExperimentalCli")
+            languageSettings.optIn("kotlinx.cinterop.BetaInteropApi")
+            languageSettings.optIn("kotlin.experimental.ExperimentalNativeApi")
         }
     }
 }
```

**File**: `src/macosMain/kotlin/co/touchlab/xcode/cli/EchoWriter.kt` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+package co.touchlab.xcode.cli
+
+import co.touchlab.kermit.LogWriter
+import co.touchlab.kermit.Severity
+import kotlinx.cinterop.ExperimentalForeignApi
+import platform.posix.fflush
+import platform.posix.fprintf
+import platform.posix.stderr
+
+class EchoWriter: LogWriter() {
+    override fun log(severity: Severity, message: String, tag: String, throwable: Throwable?) {
+        val printString: (String) -> Unit = when (severity) {
+            Severity.Verbose, Severity.Debug -> return
+            Severity.Info -> { string -> println(string) }
+            Severity.Warn -> { string -> println("WARN: $string") }
+            Severity.Error, Severity.Assert -> @OptIn(ExperimentalForeignApi::class) { string ->
+                fprintf(stderr, string)
+                fflush(stderr)
+            }
+        }
+
+        printString(message)
+        throwable?.let {
+            printString(it.stackTraceToString())
+        }
+    }
+}
```

**File**: `src/macosMain/kotlin/co/touchlab/xcode/cli/InstallationFacade.kt` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+package co.touchlab.xcode.cli
+
+import co.touchlab.kermit.Logger
+import co.touchlab.xcode.cli.command.Install
+import co.touchlab.xcode.cli.util.Console
+
+object InstallationFacade {
+    private val logger = Logger.withTag("InstallationFacade")
+
+    fun installAll(xcodeInstallations: List<XcodeHelper.XcodeInstallation>, fixXcode15: Boolean) {
+        XcodeHelper.ensureXcodeNotRunning()
+
+        val bundledVersion = PluginManager.bundledVersion
+        logger.v { "Bundled plugin version = $bundledVersion" }
+        val installedVersion = PluginManager.installedVersion
+        logger.v { "Installed plugin version = ${installedVersion ?: "N/A"}" }
+
+        if (installedVersion != null) {
+            val (confirmation, notification) = when {
+                bundledVersion > installedVersion -> {
+                    "Do you want to update from $installedVersion to $bundledVersion? y/n: " to "Updating to $bundledVersion"
+                }
+                bundledVersion == installedVersion -> {
+                    "Do you want to reinstall version $installedVersion? y/n: " to "Reinstalling $installedVersion"
+                }
+                bundledVersion < installedVersion -> {
+                    "Do you want to downgrade from $installedVersion to $bundledVersion? y/n: " to "Downgrading to $bundledVersion"
+                }
+                else -> error("Unhandled comparison possibility!")
+            }
+
+            if (!Console.confirm(confirmation)) {
+                return
+            }
+
+            logger.v { "Installation confirmed." }
+            logger.i { notification }
+            uninstallAll()
+        } else {
+            logger.i { "Installing $bundledVersion." }
+        }
+
+        PluginManager.install()
+        PluginManager.disable(bundledVersion, xcodeInstallations)
+        if (fixXcode15) {
+            PluginManager.fixXcode15(xcodeInstallations)
+        }
+        PluginManager.sync(xcodeInstallations)
+        LangSpecManager.install()
+        LLDBInitManager.install()
+        PluginManager.enable(bundledVersion, xcodeInstallations)
+
+        logger.i { "Installation complete." }
+    }
+
+    fun enable(xcodeInstallations: List<XcodeHelper.XcodeInstallation>) {
+        XcodeHelper.ensureXcodeNotRunning()
+
+        val installedVersion = PluginManager.installedVersion ?: run {
+            Console.echo("Plugin not installed, nothing to enable.")
+            return
+        }
+
+        PluginManager.enable(installedVersion, xcodeInstallations)
+
+        logger.i { "Plugin enabled." }
+    }
+
+    fun disable(xcodeInstallations: List<XcodeHelper.XcodeInstallation>) {
+        XcodeHelper.ensureXcodeNotRunning()
+
+        val installedVersion = PluginManager.installedVersion ?: run {
+            Console.echo("Plugin not installed, nothing to disable.")
+            return
+        }
+
+        PluginManager.disable(installedVersion, xcodeInstallations)
+
+        logger.i { "Plugin disabled." }
+    }
+
+    fun fixXcode15(xcodeInstallations: List<XcodeHelper.XcodeInstallation>) {
+        XcodeHelper.ensureXcodeNotRunning()
+
+        val installedVersion = PluginManager.installedVersion
+        try {
+            if (installedVersion != null) {
+                PluginManager.disable(installedVersion, xcodeInstallations)
+            }
+
+            PluginManager.fixXcode15(xcodeInstallations)
+        } finally {
+            if (installedVersion != null) {
+                PluginManager.enable(installedVersion, xcodeInstallations)
+            }
+        }
+
+        logger.i { "Xcode 15 fix applied." }
+    }
+
+    fun sync(xcodeInstallations: List<XcodeHelper.XcodeInstallation>, fixXcode15: Boolean) {
+        XcodeHelper.ensureXcodeNotRunning()
+
+        val installedVersion = PluginManager.installedVersion ?: run {
+            Console.echo("Plugin not installed, nothing to synchronize.")
+            return
+        }
+
+        PluginManager.disable(installedVersion, xcodeInstallations)
+        PluginManager.sync(xcodeInstallations)
+        if (fixXcode15) {
+            PluginManager.fixXcode15(xcodeInstallations)
+        }
+        PluginManager.enable(installedVersion, xcodeInstallations)
+
+        logger.i { "Synchronization complete." }
+    }
+
+    fun uninstallAll() {
+        logger.v { "Will uninstall all plugin components." }
+        XcodeHelper.ensureXcodeNotRunning()
+        PluginManager.uninstall()
+        LangSpecManager.uninstall()
+        LLDBInitManager.uninstall()
+
+        logger.i { "Uninstallation complete." }
+    }
+}
```

**File**: `src/macosMain/kotlin/co/touchlab/xcode/cli/Installer.kt` (removed, +0/-12)
```diff
@@ -1,12 +0,0 @@
-package co.touchlab.xcode.cli
-
-object Installer {
-    fun installAll(xcodeInstallations: List<XcodeHelper.XcodeInstallation>) {
-        XcodeHelper.ensureXcodeNotRunning()
-
-        PluginManager.install(xcodeInstallations)
-        LangSpecManager.install()
-        LLDBInitManager.install()
-    }
-}
-
```

**File**: `src/macosMain/kotlin/co/touchlab/xcode/cli/PluginManager.kt` (modified, +97/-28)
```diff
@@ -1,12 +1,8 @@
 package co.touchlab.xcode.cli
 
 import co.touchlab.kermit.Logger
-import co.touchlab.xcode.cli.util.Console
-import co.touchlab.xcode.cli.util.File
-import co.touchlab.xcode.cli.util.Path
-import co.touchlab.xcode.cli.util.PropertyList
-import co.touchlab.xcode.cli.util.Version
-import co.touchlab.xcode.cli.util.fromString
+import co.touchlab.xcode.cli.util.*
+import platform.posix.sleep
 
 object PluginManager {
     val pluginName = "Kotlin.ideplugin"
@@ -19,6 +15,7 @@ object PluginManager {
     private val pluginVersionInfoKey = "CFBundleShortVersionString"
     private val pluginCompatibilityInfoKey = "DVTPlugInCompatibilityUUIDs"
     private val logger = Logger.withTag("PluginManager")
+    private val fixXcode15Timeout = 10
 
     val bundledVersion: Version
         get() {
@@ -50,41 +47,113 @@ object PluginManager {
             emptyList()
         }
 
-    fun install(xcodeInstallations: List<XcodeHelper.XcodeInstallation>) {
+    fun install() {
         logger.v { "Ensuring plugins directory exists at ${pluginsDirectory.path}" }
         pluginsDirectory.mkdirs()
         logger.v { "Copying Xcode plugin to target path ${pluginTargetFile.path}" }
         pluginSourceFile.copy(pluginTargetFile.path)
-        sync(xcodeInstallations)
     }
 
-    fun sync(xcodeInstallations: List<XcodeHelper.XcodeInstallation>) {
+    fun enable(version: Version, xcodeInstallations: List<XcodeHelper.XcodeInstallation>) {
+        logger.i { "Removing Kotlin Plugin defaults so we can add it to allowed." }
         XcodeHelper.removeKotlinPluginFromDefaults()
-        if (isInstalled) {
-            XcodeHelper.addKotlinPluginToDefaults(installedVersion ?: bundledVersion, xcodeInstallations)
-            Console.echo("Synchronizing plugin compatibility list.")
-            val additionalPluginCompatibilityIds = xcodeInstallations.map { PropertyList.Object.String(it.pluginCompatabilityId) }
-            logger.v { "Xcode installation IDs to include: ${additionalPluginCompatibilityIds.joinToString { it.value }}" }
-            val infoPlist = PropertyList.create(pluginTargetInfoFile)
-            val rootDictionary = infoPlist.root.dictionary
-            val oldPluginCompatibilityIds = rootDictionary
-                .getOrPut(pluginCompatibilityInfoKey) { PropertyList.Object.Array(mutableListOf()) }
-                .array
-            logger.v { "Previous Xcode installation IDs: ${oldPluginCompatibilityIds.mapNotNull { it.stringOrNull?.value }.joinToString()}" }
-            oldPluginCompatibilityIds.addAll(additionalPluginCompatibilityIds)
-            val distinctPluginCompatibilityIds = oldPluginCompatibilityIds.distinctBy { it.stringOrNull?.value }.toMutableList()
-            logger.v { "Xcode installation IDs to save: ${distinctPluginCompatibilityIds.mapNotNull { it.stringOrNull?.value }.joinToString()}" }
-            rootDictionary[pluginCompatibilityInfoKey] = PropertyList.Object.Array(distinctPluginCompatibilityIds)
-            pluginTargetInfoFile.write(infoPlist.toData(PropertyList.Format.XML))
-        } else {
-            Console.echo("Plugin not installed, nothing to synchronize.")
+        logger.i { "Allowing Kotlin Plugin" }
+        XcodeHelper.allowKotlinPlugin(version, xcodeInstallations)
+    }
+
+    fun disable(version: Version, xcodeInstallations: List<XcodeHelper.XcodeInstallation>) {
+        logger.i { "Removing Kotlin Plugin defaults so we can add it to skipped." }
+        XcodeHelper.removeKotlinPluginFromDefaults()
+        logger.i { "We need Xcode to skip the plugin, so it doesn't crash." }
+        XcodeHelper.skipKotlinPlugin(version, xcodeInstallations)
+    }
+
+    fun sync(xcodeInstallations: List<XcodeHelper.XcodeInstallation>) {
+        check(isInstalled) { "Plugin is not installed!" }
+
+        Console.echo("Synchronizing plugin compatibility list.")
+        val additionalPluginCompatibilityIds =
+            xcodeInstallations.map { PropertyList.Object.String(it.pluginCompatabilityId) }
+        logger.v { "Xcode installation IDs to include: ${additionalPluginCompatibilityIds.joinToString { it.value }}" }
+        val infoPlist = PropertyList.create(pluginTargetInfoFile)
+        val rootDictionary = infoPlist.root.dictionary
+        val oldPluginCompatibilityIds = rootDictionary
+            .getOrPut(pluginCompatibilityInfoKey) { PropertyList.Object.Array(mutableListOf()) }
+            .array
+        logger.v {
+            "Previous Xcode installation IDs: ${
+                oldPluginCompatibilityIds.mapNotNull { it.stringOrNull?.value }.joinToString()
+            }"
+        }
+        oldPluginCompatibilityIds.addAll(additionalPluginCompatibilityIds)
+        val distinctPluginCompatibilityIds =
+            oldPluginCompatibilityIds.distinctBy { it.stringOrNull?.value }.toMutableList()
+        logger.v {
+            "Xcode installation IDs to save: ${
+                distinctPluginCompatibilityIds.mapNotNull { it.stringOrNull?.val
```

**File**: `src/macosMain/kotlin/co/touchlab/xcode/cli/Uninstaller.kt` (removed, +0/-14)
```diff
@@ -1,14 +0,0 @@
-package co.touchlab.xcode.cli
-
-import co.touchlab.kermit.Logger
-
-object Uninstaller {
-    private val logger = Logger.withTag("Uninstaller")
-    fun uninstallAll() {
-        logger.v { "Will uninstall all plugin components." }
-        XcodeHelper.ensureXcodeNotRunning()
-        PluginManager.uninstall()
-        LangSpecManager.uninstall()
-        LLDBInitManager.uninstall()
-    }
-}
\ No newline at end of file
```

---

### Incident Patch 10: `32ff0c00` (2022-12-13)
**Commit Message**: Merge pull request #90 from touchlab/jj/building-and-contributing-docs

Add BUILDING and CONTRIBUTING docs, add more sections to templates.

**File**: `.github/ISSUE_TEMPLATE.md` (modified, +32/-4)
```diff
@@ -1,12 +1,40 @@
+## Summary
 
-<!--**Issue Labels**
+<!--- Sum up what this issue is about -->
 
-While not necessary, you can help organize our issues by labeling this issue when you open it.  To add a label automatically, simply [x] mark the appropriate box below:
+## Details
+
+<!--- Provide detailed information about the issue, the more specific you are, the better -->
+
+## Reproduction
+
+<!--- Provide steps for reproduction, if relevant, provide a link to a minimal sample project -->
+
+## Expected result
+
+<!--- Explain what the behavior after fixing this issue should be like -->
+
+## Current state
+
+<!--- Describe the incorrect behavior you are encountering -->
+
+## Possible Fix
+
+<!--- If you have any suggestions or ideas about the reason for this bug, mention them here -->
+
+## Screenshots
+
+<!--- If relevant, include screenshots or videos, especially useful with UI bugs / suggestions -->
+
+<img width="250" alt="fix in action" src="https://media.makeameme.org/created/yes-it-works.jpg">
+
+## Issue Labels
+
+<!--- While not necessary, you can help organize our issues by labeling this issue when you open it.  To add a label automatically, simply [x] mark the appropriate box below: -->
 
 - [ ] has-reproduction
 - [ ] feature
 - [ ] blocking
 - [ ] good first issue
 
-To add a label not listed above, simply place `/label another-label-name` on a line by itself.
--->
\ No newline at end of file
+<!--- To add a label not listed above, simply place `/label another-label-name` on a line by itself. -->
\ No newline at end of file
```

**File**: `.github/PULL_REQUEST_TEMPLATE.md` (modified, +13/-4)
```diff
@@ -1,12 +1,21 @@
+<!--- [Issue-XYZ] Add issue number and title to Title above -->
 
-<!--**Pull Request Labels**
+<!-- Add issue link -->
+Issue: https://github.com/touchlab/xcode-kotlin/issues/[issue number]
 
-While not necessary, you can help organize our pull requests by labeling this issue when you open it.  To add a label automatically, simply [x] mark the appropriate box below:
+## Summary
+<!--- Copy summary from issue link or write a shortened description of it -->
+
+## Fix
+<!-- What did you do to fix the issue? -->
+
+## Pull Request Labels
+
+<!--- While not necessary, you can help organize our pull requests by labeling this issue when you open it.  To add a label automatically, simply [x] mark the appropriate box below: -->
 
 - [ ] has-reproduction
 - [ ] feature
 - [ ] blocking
 - [ ] good first review
 
-To add a label not listed above, simply place `/label another-label-name` on a line by itself.
--->
\ No newline at end of file
+<!--- To add a label not listed above, simply place `/label another-label-name` on a line by itself. -->
\ No newline at end of file
```

**File**: `BUILDING.md` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+# Building
+
+The xcode-kotlin plugin is written in **Kotlin**. It uses 
+[Kotlin/Native](https://kotlinlang.org/docs/native-overview.html) for compiling Kotlin code to native binaries. 
+
+Building environment: **IntelliJ IDEA**
+
+
+## Libraries
+
+- [kotlinx-cli](org.jetbrains.kotlinx:kotlinx-cli) - a generic command-line parser used to create user-friendly and flexible command-line interfaces
+- [kotlinx-serialization-json](https://kotlinlang.org/docs/serialization.html) - JSON serialization for Kotlin projects
+- [kotlinx-coroutines](https://github.com/Kotlin/kotlinx.coroutines) - library support for Kotlin coroutines with multiplatform support
+- [Kermit](https://github.com/touchlab/Kermit) - logging utility with composable log outputs
+
+## Project structure
+
+In the `command` directory the commands users can call are implemented: *info*, *install*, *sync* and *uninstall*. 
+Each has an `execute` function with the implementation, that calls classes like `Installer` or `Uninstaller`.
+- `BaseXcodeListSubcommand` is an abstract class overriden by the following classes (Info, Install and Sync). It 
+provides them with a protected method for getting a list of Xcode installations.
+- `Info` checks for an available update or if the plugin is not yet installed, writes information about the plugin to 
+the console, such as installed and bundles versions, if Language spec and LLDB is installed and if LLDB for Xcode has 
+been initialized, also Xcode version and the plugin compatibility.
+- `Install` checks for current version and offers updating, reinstalling or downgrading if it is already installed or 
+installs it if not.
+- `Sync` adds IDs of Xcode installations to the currently installed Xcode Kotlin plugin.
+- `Uninstall` uninstalls the plugin.
+
+In the `util` directory are, as the name suggests, util classes.
+- `Console` provides convenience functions for prompting user for confirmation or value and printing output to the 
+console.
+- `CrashHelper` provides functions for logging, capturing and uploading errors (crash reports).
+- `File` is a class for holding a file path and providing methods for working with a file.
+- `Path` holds a string value and provides methods for appending and deleting path components and resolving sym links. 
+It also provides convenience methods for creating Paths to home, work, binary and data directories in its companion 
+object.
+- `PropertyList` is a class for converting to and from Swift classes.
+- `Shell` is a helper for executing shell tasks.
+
+The other classes in the `cli` directory are mainly managers and helpers that provide methods for installing and 
+uninstalling various parts of the plugin.
+- `Installer` has an `installAll` method for calling install on all the managers.
+- `LangSpecManager` provides `install` and `uninstall` methods and `isInstalled` check for the Kotlin.xclangspec.
+- `LLDBInitManager` provides `install` and `uninstall` methods and `isInstalled` and `sourcesMainLlvmInit` checks for 
+the LLDB init.
+- `PluginManager` provides `install`, `sync` and `uninstall` methods,`isInstalled` check and `bundledVersion`, 
+`installedVersion` and `targetSupportedXcodeUUIds` properties for the plugin.
+- `Uninstaller` has an `uninstallAll` method for calling uninstall on all the managers.
+- `XcodeHelper` provides methods for interacting with Xcode installations: `ensureXcodeNotRunning` to check and 
+optionally shut down running Xcode instances, `allXcodeInstallations` that returns a list of found Xcode installations, 
+`addKotlinPluginToDefaults` for adding a plugin to allowed list in Xcode defaults and `removeKotlinPluginFromDefaults` 
+for removing it.
+
+In `build.gradle` there are two gradle tasks added: `assembleReleaseExecutableMacos` for building a universal macOS 
+binary and `preparePlugin` for preparing the plugin and language specification to build dir.
+
+This project uses Object classes instead of dependency injection (DI) because of its small size.
\ No newline at end of file
```

**File**: `CONTRIBUTING.md` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+# How to contribute
+
+In the first place, thank you for thinking about contributing to **xcode-kotlin**!
+Here you can find a set of guidelines for pitching in.
+
+## Questions
+
+If you have any questions, please, contact us in the Kotlin [Community Slack](https://kotlinlang.slack.com/) in
+[the #touchlab-tools channel](https://kotlinlang.slack.com/archives/CTJB58X7X). To join the Kotlin Community Slack, 
+[request access here](http://slack.kotlinlang.org/).
+
+For direct assistance, please [reach out to Touchlab](https://touchlab.co/contact-us/) to discuss support options.
+
+## Set up environment
+
+For instructions on how to set up your environment and run the project, refer to the 
+[README](https://github.com/touchlab/xcode-kotlin/blob/main/README.md) and 
+[BUILDING](https://github.com/touchlab/xcode-kotlin/blob/main/BUILDING.md).
+
+## Create an issue
+
+If you have stumbled across a bug or have a good feature suggestion / enhancement, you can create an 
+[issue](https://github.com/touchlab/xcode-kotlin/issues), but please don't mistake it for the general helpline. You can 
+get answers for general questions in Slack. Please, fill in carefully all the info the issue template suggests. It will 
+save us time when investigating the problem. There might be a bit of a delay until we get to your ticket, so we ask for 
+your patience.
+
+## Submit a merge request
+
+If you wish to participate in submitting code changes, to start with, you can look for issues tagged with **good first 
+issue**. In case you feel like making significant changes or adding features, please discuss with the team first before 
+you start working on it, to ensure we are on the same page. When your fix / feature is ready, create a merge request 
+using the pull request template and fill in as much information as possible. All merge requests need to pass a code 
+review from our team member, and subsequently they are approved or rejected with a reason. It might take some time 
+before we get to your merge request, but don’t worry, it didn't get lost.
```

---

### Incident Patch 11: `0798115a` (2022-11-28)
**Commit Message**: Add BUILDING and CONTRIBUTING docs, add more sections to templates.

**File**: `.github/ISSUE_TEMPLATE.md` (modified, +32/-4)
```diff
@@ -1,12 +1,40 @@
+## Summary
 
-<!--**Issue Labels**
+<!--- Sum up what this issue is about -->
 
-While not necessary, you can help organize our issues by labeling this issue when you open it.  To add a label automatically, simply [x] mark the appropriate box below:
+## Details
+
+<!--- Provide detailed information about the issue, the more specific you are, the better -->
+
+## Reproduction
+
+<!--- Provide steps for reproduction, if relevant, provide a link to a minimal sample project -->
+
+## Expected result
+
+<!--- Explain what the behavior after fixing this issue should be like -->
+
+## Current state
+
+<!--- Describe the incorrect behavior you are encountering -->
+
+## Possible Fix
+
+<!--- If you have any suggestions or ideas about the reason for this bug, mention them here -->
+
+## Screenshots
+
+<!--- If relevant, include screenshots or videos, especially useful with UI bugs / suggestions -->
+
+<img width="250" alt="fix in action" src="https://media.makeameme.org/created/yes-it-works.jpg">
+
+## Issue Labels
+
+<!--- While not necessary, you can help organize our issues by labeling this issue when you open it.  To add a label automatically, simply [x] mark the appropriate box below: -->
 
 - [ ] has-reproduction
 - [ ] feature
 - [ ] blocking
 - [ ] good first issue
 
-To add a label not listed above, simply place `/label another-label-name` on a line by itself.
--->
\ No newline at end of file
+<!--- To add a label not listed above, simply place `/label another-label-name` on a line by itself. -->
\ No newline at end of file
```

**File**: `.github/PULL_REQUEST_TEMPLATE.md` (modified, +13/-4)
```diff
@@ -1,12 +1,21 @@
+<!--- [Issue-XYZ] Add issue number and title to Title above -->
 
-<!--**Pull Request Labels**
+<!-- Add issue link -->
+Issue: https://github.com/touchlab/xcode-kotlin/issues/[issue number]
 
-While not necessary, you can help organize our pull requests by labeling this issue when you open it.  To add a label automatically, simply [x] mark the appropriate box below:
+## Summary
+<!--- Copy summary from issue link or write a shortened description of it -->
+
+## Fix
+<!-- What did you do to fix the issue? -->
+
+## Pull Request Labels
+
+<!--- While not necessary, you can help organize our pull requests by labeling this issue when you open it.  To add a label automatically, simply [x] mark the appropriate box below: -->
 
 - [ ] has-reproduction
 - [ ] feature
 - [ ] blocking
 - [ ] good first review
 
-To add a label not listed above, simply place `/label another-label-name` on a line by itself.
--->
\ No newline at end of file
+<!--- To add a label not listed above, simply place `/label another-label-name` on a line by itself. -->
\ No newline at end of file
```

**File**: `BUILDING.md` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+# Building
+
+The xcode-kotlin plugin is written in **Kotlin**. It uses 
+[Kotlin/Native](https://kotlinlang.org/docs/native-overview.html) for compiling Kotlin code to native binaries. 
+
+Building environment: **IntelliJ IDEA**
+
+
+## Libraries
+
+- [kotlinx-cli](org.jetbrains.kotlinx:kotlinx-cli) - a generic command-line parser used to create user-friendly and flexible command-line interfaces
+- [kotlinx-serialization-json](https://kotlinlang.org/docs/serialization.html) - JSON serialization for Kotlin projects
+- [kotlinx-coroutines](https://github.com/Kotlin/kotlinx.coroutines) - library support for Kotlin coroutines with multiplatform support
+- [Kermit](https://github.com/touchlab/Kermit) - logging utility with composable log outputs
+
+## Project structure
+
+In the `command` directory the commands users can call are implemented: *info*, *install*, *sync* and *uninstall*. 
+Each has an `execute` function with the implementation, that calls classes like `Installer` or `Uninstaller`.
+- `BaseXcodeListSubcommand` is an abstract class overriden by the following classes (Info, Install and Sync). It 
+provides them with a protected method for getting a list of Xcode installations.
+- `Info` checks for an available update or if the plugin is not yet installed, writes information about the plugin to 
+the console, such as installed and bundles versions, if Language spec and LLDB is installed and if LLDB for Xcode has 
+been initialized, also Xcode version and the plugin compatibility.
+- `Install` checks for current version and offers updating, reinstalling or downgrading if it is already installed or 
+installs it if not.
+- `Sync` adds IDs of Xcode installations to the currently installed Xcode Kotlin plugin.
+- `Uninstall` uninstalls the plugin.
+
+In the `util` directory are, as the name suggests, util classes.
+- `Console` provides convenience functions for prompting user for confirmation or value and printing output to the 
+console.
+- `CrashHelper` provides functions for logging, capturing and uploading errors (crash reports).
+- `File` is a class for holding a file path and providing methods for working with a file.
+- `Path` holds a string value and provides methods for appending and deleting path components and resolving sym links. 
+It also provides convenience methods for creating Paths to home, work, binary and data directories in its companion 
+object.
+- `PropertyList` is a class for converting to and from Swift classes.
+- `Shell` is a helper for executing shell tasks.
+
+The other classes in the `cli` directory are mainly managers and helpers that provide methods for installing and 
+uninstalling various parts of the plugin.
+- `Installer` has an `installAll` method for calling install on all the managers.
+- `LangSpecManager` provides `install` and `uninstall` methods and `isInstalled` check for the Kotlin.xclangspec.
+- `LLDBInitManager` provides `install` and `uninstall` methods and `isInstalled` and `sourcesMainLlvmInit` checks for 
+the LLDB init.
+- `PluginManager` provides `install`, `sync` and `uninstall` methods,`isInstalled` check and `bundledVersion`, 
+`installedVersion` and `targetSupportedXcodeUUIds` properties for the plugin.
+- `Uninstaller` has an `uninstallAll` method for calling uninstall on all the managers.
+- `XcodeHelper` provides methods for interacting with Xcode installations: `ensureXcodeNotRunning` to check and 
+optionally shut down running Xcode instances, `allXcodeInstallations` that returns a list of found Xcode installations, 
+`addKotlinPluginToDefaults` for adding a plugin to allowed list in Xcode defaults and `removeKotlinPluginFromDefaults` 
+for removing it.
+
+In `build.gradle` there are two gradle tasks added: `assembleReleaseExecutableMacos` for building a universal macOS 
+binary and `preparePlugin` for preparing the plugin and language specification to build dir.
+
+This project uses Object classes instead of dependency injection (DI) because of its small size.
\ No newline at end of file
```

**File**: `CONTRIBUTING.md` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+# How to contribute
+
+In the first place, thank you for thinking about contributing to **xcode-kotlin**!
+Here you can find a set of guidelines for pitching in.
+
+## Questions
+
+If you have any questions, please, contact us in the Kotlin [Community Slack](https://kotlinlang.slack.com/) in 
+<channel-name> channel. To join the Kotlin Community Slack, [request access here](http://slack.kotlinlang.org/).
+
+For direct assistance, please [reach out to Touchlab](https://touchlab.co/contact-us/) to discuss support options.
+
+## Set up environment
+
+For instructions on how to set up your environment and run the project, refer to the 
+[README](https://github.com/touchlab/xcode-kotlin/blob/main/README.md) and 
+[BUILDING](https://github.com/touchlab/xcode-kotlin/blob/main/BUILDING.md).
+
+## Create an issue
+
+If you have stumbled across a bug or have a good feature suggestion / enhancement, you can create an 
+[issue](https://github.com/touchlab/xcode-kotlin/issues), but please don't mistake it for the general helpline. You can 
+get answers for general questions in Slack. Please, fill in carefully all the info the issue template suggests. It will 
+save us time when investigating the problem. There might be a bit of a delay until we get to your ticket, so we ask for 
+your patience.
+
+## Submit a merge request
+
+If you wish to participate in submitting code changes, to start with, you can look for issues tagged with **good first 
+issue**. In case you feel like making significant changes or adding features, please discuss with the team first before 
+you start working on it, to ensure we are on the same page. When your fix / feature is ready, create a merge request 
+using the pull request template and fill in as much information as possible. All merge requests need to pass a code 
+review from our team member, and subsequently they are approved or rejected with a reason. It might take some time 
+before we get to your merge request, but don’t worry, it didn't get lost.
```

---

### Incident Patch 12: `b17d2ae4` (2022-05-19)
**Commit Message**: revert workaround

**File**: `README.md` (modified, +1/-3)
```diff
@@ -44,11 +44,9 @@ Xcode does not generally allow plugins, but it does allow for language definitio
 First you need to install the CLI that takes care of installing the plugin into Xcode. The CLI is available through Homebrew:
 
 ```shell
-brew install xcode-kotlin --head
+brew install xcode-kotlin
 ```
 
-**Note** We are in beta and had [an issue with the published homebrew version](https://github.com/touchlab/xcode-kotlin/issues/85). The command above will build locally. Once [approved by the homebrew team](https://github.com/Homebrew/homebrew-core/pull/101920), you can run `brew install xcode-kotlin` and it will grab an compiled binary
-
 Once installed, run the CLI:
 
 ```shell
```

---

### Incident Patch 13: `ee537375` (2022-05-19)
**Commit Message**: Local build while Homebrew updates

**File**: `README.md` (modified, +4/-2)
```diff
@@ -41,12 +41,14 @@ Xcode does not generally allow plugins, but it does allow for language definitio
 
 ## Installation
 
-First you need to install the CLI that takes care of installing the plugin into Xcode. The CLI is available throuh Homebrew:
+First you need to install the CLI that takes care of installing the plugin into Xcode. The CLI is available through Homebrew:
 
 ```shell
-brew install xcode-kotlin
+brew install xcode-kotlin --head
 ```
 
+**Note** We are in beta and had [an issue with the published homebrew version](https://github.com/touchlab/xcode-kotlin/issues/85). The command above will build locally. Once [approved by the homebrew team](https://github.com/Homebrew/homebrew-core/pull/101920), you can run `brew install xcode-kotlin` and it will grab an compiled binary
+
 Once installed, run the CLI:
 
 ```shell
```

---

### Incident Patch 14: `ac26a5ba` (2022-05-05)
**Commit Message**: Add tag to crash reports.

**File**: `src/macosMain/kotlin/co/touchlab/xcode/cli/util/CrashHelper.kt` (modified, +8/-3)
```diff
@@ -19,7 +19,12 @@ class CrashHelper : LogWriter() {
     }
 
     private fun upload(crashReport: String) {
-        val url: NSURL = NSURL.URLWithString("https://api.touchlab.dev/crash/report")!!
+        val tagQuery = "?tag=xcode-kotlin" + if (Platform.isDebugBinary) "-DEBUG" else ""
+        val url = "https://api.touchlab.dev/crash/report$tagQuery".let { urlString ->
+            checkNotNull(NSURL.URLWithString(urlString)) {
+                "Couldn't construct NSURL from $urlString"
+            }
+        }
         val request = NSMutableURLRequest.requestWithURL(url).apply {
             setHTTPMethod("POST")
             setValue("text/plain", "Content-Type")
@@ -33,8 +38,8 @@ class CrashHelper : LogWriter() {
                 if (error != null) {
                     uploadComplete.completeExceptionally(CrashReportUploadException(error))
                 } else {
-                uploadComplete.complete(Unit)
-            }
+                    uploadComplete.complete(Unit)
+                }
             }
 
         runBlocking {
```

---

### Incident Patch 15: `22ad9538` (2022-05-05)
**Commit Message**: Include more information when sending the crash upstream.

**File**: `src/macosMain/kotlin/co/touchlab/xcode/cli/util/CrashHelper.kt` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ class CrashHelper : LogWriter() {
         }
 
         append("FINAL CRASH\n===========\n\n")
-        append(e.getStackTrace().joinToString("\n"))
+        append(e.stackTraceToString())
     }
 
     data class LogEntry(val severity: Severity, val message: String, val tag: String, val throwable: Throwable?) {
```

#### Recent Merged Pull Requests:
- **PR #129** (2026-04-21): Fix: list count is incorrect (@Insta360-Infra)
- **PR #121** (2025-04-15): Fix: An address is returned when the string is empty (@TheDadda)
- **PR #119** (2025-04-08): Replace kotlinx.cli with Clikt and make stuff suspending. (@TadeasKriz)
- **PR #117** (2025-04-08): Fix using lower Xcode version than minimum required by macOS: _LSOpenURLsWithCompletionHandler() failed for the application /Applications/Xcode.app with error -10664. (@xiaobailong24)
- **PR #111** (2024-07-06): Improve type summaries and children synthetization. (@TadeasKriz)
- **PR #108** (2024-06-11): Fix info command for 15.3 (@kpgalligan)
- **PR #107** (2024-03-14): Paraselene main (@kpgalligan)
- **PR #106** (2024-03-14): Fix crash for Xcode 15.3 (@paraselene)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
