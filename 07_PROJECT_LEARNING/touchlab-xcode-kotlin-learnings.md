# Forensic Learning Record (Deep Inspection): touchlab/xcode-kotlin

> **Canonical Artifact**: `07_PROJECT_LEARNING/touchlab-xcode-kotlin-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/touchlab/xcode-kotlin](https://github.com/touchlab/xcode-kotlin))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-01T02:08:56.510Z  
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

### Core Architecture Module: `LLDBPlugin/run.py`
```
# Before running this, add LLDB to your PYTHONPATH (e.g. PYTHONPATH=`lldb -P`)

import os
import subprocess
import sys

import lldb


def tracefunc(frame, event, arg, indent=[0]):
    if event == "call":
        indent[0] += 2
        print("-" * indent[0] + "> call function", frame.f_code.co_name)
    elif event == "return":
        print("<" + "-" * indent[0], "exit function", frame.f_code.co_name)
        indent[0] -= 2
    return tracefunc

# sys.setprofile(tracefunc)

gradle_invoke = subprocess.Popen(['./gradlew', 'compileSwift'], cwd='test_project')
gradle_exit_code = gradle_invoke.wait()

if gradle_exit_code != 0:
    exit(gradle_exit_code)

exe = 'test_project/build/swift/app'
framework_path = 'test_project/build/bin/macosArm64/debugFramework'

# Initialize the debugger before making any API calls.
lldb.SBDebugger.Initialize()
# Create a new debugger instance in your module if your module
# can be run from the command line. When we run a script from
# the command line, we won't have any debugger object in
# lldb.debugger, so we can just create it if it will be needed
debugger: lldb.SBDebugger = lldb.SBDebugger.Create()

# When we step or continue, don't return from the function until the process
# stops. Otherwise we would have to handle the process events ourselves which, while doable is
# a little tricky.  We do this by setting the async mode to false.
debugger.SetAsync(False)

# debugger.HandleCommand('log enable lldb default')
# debugger.HandleCommand('log enable lldb default')
debugger.HandleCommand('log enable lldb commands')
debugger.HandleCommand('log enable lldb types')

# Import our module
debugger.HandleCommand('command script import touchlab_kotlin_lldb')

target: lldb.SBTarget = debugger.CreateTargetWithFileAndArch(exe, lldb.LLDB_ARCH_DEFAULT)

if target:
    # target.BreakpointCreateByLocation("main.swift", 14)
    target.BreakpointCreateByLocation('main.kt', 30)

    process: lldb.SBProcess = target.LaunchSimple(None, ["DYLD_FRAMEWORK_PATH={}".format(framework_path)], os.getcwd())

    if process:
        import time

        start = time.perf_counter()
        debugger.HandleCommand('fr v -T --ptr-depth 16')
        print('HandleCommand took {:.6}s'.format(time.perf_counter() - start))
        process.Continue()
        # debugger.HandleCommand('fr v --ptr-depth 16 -- data')
        # debugger.HandleCommand('fr v --ptr-depth 16')

        process.Kill()

# Finally, dispose of the debugger you just made.
lldb.SBDebugger.Destroy(debugger)
# Terminate the debug session
lldb.SBDebugger.Terminate()

```

### Core Architecture Module: `LLDBPlugin/touchlab_kotlin_lldb/__init__.py`
```
import os
from typing import Optional

import lldb

from .stepping.KonanHook import KonanHook
from .types.base import KOTLIN_CATEGORY, KOTLIN_OBJ_HEADER_TYPE, KOTLIN_ARRAY_HEADER_TYPE
from .util.log import log
from .commands import FieldTypeCommand, SymbolByNameCommand, TypeByAddressCommand, GCCollectCommand

from .types.summary import kotlin_object_type_summary, kotlin_objc_class_summary
from .types.proxy import KonanProxyTypeProvider, KonanObjcProxyTypeProvider

from .cache import LLDBCache

os.environ['CLIENT_TYPE'] = 'Xcode'

KONAN_INIT_PREFIX = '_Konan_init_'
KONAN_INIT_MODULE_NAME = '[0-9a-zA-Z_]+'
KONAN_INIT_SUFFIX = '_kexe'

def __lldb_init_module(debugger: lldb.SBDebugger, _):
    log(lambda: "init start")

    reset_cache()
    configure_types(debugger)
    register_commands(debugger)
    register_hooks(debugger)

    configure_objc_types_init(debugger)

    log(lambda: "init end")


def reset_cache():
    """Xcode reuses LLDB between program runs, so we need to clear any symbol references we made as they are no
    longer valid."""
    LLDBCache.reset()


def configure_objc_types_init(debugger: lldb.SBDebugger):
    target = debugger.GetDummyTarget()
    breakpoint = target.BreakpointCreateByRegex(
        "^{}({})({})?$".format(KONAN_INIT_PREFIX, KONAN_INIT_MODULE_NAME, KONAN_INIT_SUFFIX)
    )
    breakpoint.SetOneShot(True)
    breakpoint.SetAutoContinue(True)
    breakpoint.SetScriptCallbackFunction('{}.{}'.format(__name__, configure_objc_types_breakpoint.__name__))


def configure_objc_types_breakpoint(frame: lldb.SBFrame, bp_loc: lldb.SBBreakpointLocation, internal_dict):
    process = frame.thread.process
    target = process.target

    symbols = target.FindSymbols('_OBJC_CLASS_RO_$_KotlinBase')

    base_class_name: Optional[str] = None
    for symbol_context in symbols:
        error = lldb.SBError()
        name_addr = process.ReadPointerFromMemory(symbol_context.symbol.addr.GetLoadAddress(target) + 6 * 4, error)
        # TODO: Log error?
        if not error.success:
            continue
        base_class_name = process.ReadCStringFromMemory(name_addr, 128, error)
        # TODO: Log error?
        if not error.success:
            continue

        break

    module_name = frame.symbol.name.removeprefix(KONAN_INIT_PREFIX).removesuffix(KONAN_INIT_SUFFIX)
    if module_name == "stdlib":
        return False

    specifiers_to_register = [
        lldb.SBTypeNameSpecifier(
            '^{}\\.'.format(module_name),
            lldb.eMatchTypeRegex,
        ),
    ]

    if base_class_name is not None:
        objc_class_prefix = base_class_name.removesuffix("Base")
        specifiers_to_register.append(
            lldb.SBTypeNameSpecifier(
                '^{}'.format(objc_class_prefix),
                lldb.eMatchTypeRegex,
            )
        )

    category = target.debugger.GetCategory(KOTLIN_CATEGORY)

    for type_specifier in specifiers_to_register:
        category.AddTypeSummary(
            type_specifier,
            lldb.SBTypeSummary.CreateWithFunctionName(
                '{}.{}'.format(__name__, kotlin_objc_class_summary.__name__),
                lldb.eTypeOptionHideValue,
            )
        )
        category.AddTypeSynthetic(
            type_specifier,
            lldb.SBTypeSynthetic.CreateWithClassName(
                '{}.{}'.format(__name__, KonanObjcProxyTypeProvider.__name__),
            )
        )

    bp_loc.GetBreakpoint().SetEnabled(False)

    return False


def configure_types(debugger: lldb.SBDebugger):
    category = debugger.CreateCategory(KOTLIN_CATEGORY)

    types_to_register = [
        KOTLIN_OBJ_HEADER_TYPE,
        KOTLIN_ARRAY_HEADER_TYPE,
    ]

    for type_to_register in types_to_register:
        category.AddTypeSummary(
            type_to_register,
            lldb.SBTypeSummary.CreateWithFunctionName(
                '{}.{}'.format(__name__, kotlin_object_type_summary.__name__),
                lldb.eTypeOptionHideValue
            )
        )
        category.AddTypeSynthetic(
            type_to_register,
            lldb.SBTypeSynthetic.CreateWithClassName(
                '{}.{}'.format(__name__, KonanProxyTypeProvider.__name__),
            )
        )

    category.SetEnabled(True)


def register_commands(debugger: lldb.SBDebugger):
    commands_to_register = [
        FieldTypeCommand,
        SymbolByNameCommand,
        TypeByAddressCommand,
        GCCollectCommand,
    ]

    for command in commands_to_register:
        debugger.HandleCommand(
            'command script add -c {}.{} {}'.format(__name__, command.__name__, command.program)
        )


def register_hooks(debugger: lldb.SBDebugger):
    # Avoid Kotlin/Native runtime
    debugger.HandleCommand('settings set target.process.thread.step-avoid-regexp ^::Kotlin_')

    hooks_to_register = [
        KonanHook,
    ]

    for hook in hooks_to_register:
        debugger.HandleCommand('target stop-hook add -P {}.{}'.format(__name__, hook.__name__))

```

### Core Architecture Module: `LLDBPlugin/touchlab_kotlin_lldb/cache/__init__.py`
```
from typing import Optional

import lldb

__lldb_cache_instance: 'LLDBCache'


class LLDBCache:
    @classmethod
    def reset(cls):
        global __lldb_cache_instance
        __lldb_cache_instance = LLDBCache()

    @classmethod
    def instance(cls):
        global __lldb_cache_instance
        return __lldb_cache_instance

    def __init__(self):
        self._debug_buffer_addr: Optional[int] = None
        self._debug_buffer_size: Optional[int] = None
        self._string_symbol_value: Optional[lldb.value] = None
        self._list_symbol_value: Optional[lldb.value] = None
        self._map_symbol_value: Optional[lldb.value] = None
        self._helper_types_declared: bool = False
        self._type_info_type: Optional[lldb.SBType] = None
        self._obj_header_type: Optional[lldb.SBType] = None
        self._array_header_type: Optional[lldb.SBType] = None
        self._runtime_type_size: Optional[lldb.value] = None
        self._runtime_type_alignment: Optional[lldb.value] = None

```

### Core Architecture Module: `LLDBPlugin/touchlab_kotlin_lldb/commands/FieldTypeCommand.py`
```
from lldb import SBDebugger, SBExecutionContext, SBCommandReturnObject

from ..types.proxy import KonanProxyTypeProvider
from ..types.base import get_runtime_type


class FieldTypeCommand:
    program = 'field_type'

    def __init__(self, debugger, unused):
        pass

    def __call__(
            self,
            debugger: SBDebugger,
            command,
            exe_ctx: SBExecutionContext,
            result: SBCommandReturnObject,
    ):
        """
        Returns runtime type of foo.bar.baz field in the form "(foo.bar.baz <TYPE_NAME>)".
        If requested field could not be traced, then "<NO_FIELD_FOUND>" plug is used for type name.
        """
        fields = command.split('.')

        variable = exe_ctx.GetFrame().FindVariable(fields[0])

        for field_name in fields[1:]:
            if variable is not None:
                provider = KonanProxyTypeProvider(variable, {})
                field_index = provider.get_child_index(field_name)
                variable = provider.get_child_at_index(field_index)
            else:
                break

        desc = "<NO_FIELD_FOUND>"

        if variable is not None:
            rt = get_runtime_type(variable)
            if len(rt) > 0:
                desc = rt

        result.write("{}".format(desc))

```

### Core Architecture Module: `LLDBPlugin/touchlab_kotlin_lldb/commands/GCCollectCommand.py`
```
from typing import Optional

from lldb import SBDebugger, SBExecutionContext, SBCommandReturnObject, SBTarget, SBSymbol, SBInstructionList
from touchlab_kotlin_lldb.util import evaluate, DebuggerException

import re


class GCCollectCommand:
    program = 'force_gc'

    def __init__(self, debugger, unused):
        pass

    def __call__(self, debugger: SBDebugger, command, exe_ctx: SBExecutionContext, result: SBCommandReturnObject):
        try:
            target = debugger.GetSelectedTarget()
            schedule_gc_function = self._find_single_function_symbol('kotlin::gcScheduler::GCScheduler::scheduleAndWaitFinalized()', target, result)
            deinit_memory_function = self._find_single_function_symbol('DeinitMemory', target, result)
            global_data_symbol = self._find_single_symbol("(anonymous namespace)::globalDataInstance", target, result)

            gc_scheduler_offset = self._find_gc_scheduler_offset(deinit_memory_function, schedule_gc_function, target)

            schedule_gc_function_addr = schedule_gc_function.addr.GetLoadAddress(target)
            global_data_addr = global_data_symbol.addr.GetLoadAddress(target)
            gc_scheduler_addr = global_data_addr + gc_scheduler_offset

            evaluate(
                '((void (*)(void*)){:#x})((void*){:#x})',
                schedule_gc_function_addr,
                gc_scheduler_addr
            )
            evaluate(
                '((void (*)(void*)){:#x})((void*){:#x})',
                schedule_gc_function_addr,
                gc_scheduler_addr
            )

        except DebuggerException as e:
            result.SetError("{} Please report this to the xcode-kotlin GitHub.".format(e.msg))
            return


    @staticmethod
    def _find_single_function_symbol(symbol_name: str, target: SBTarget, result: SBCommandReturnObject) -> SBSymbol:
        functions = target.FindFunctions(symbol_name)
        if functions.GetSize() >= 1:
            if not functions.GetSize() == 1:
                result.AppendWarning("Multiple ({}) symbols found for function {}".format(functions.GetSize(), symbol_name))
            return functions[0].GetSymbol()
        else:
            raise DebuggerException("Could not find symbol for function {}.".format(symbol_name))

    @staticmethod
    def _find_single_symbol(symbol_name: str, target: SBTarget, result: SBCommandReturnObject) -> SBSymbol:
        symbols = target.FindSymbols(symbol_name)
        if symbols.GetSize() >= 1:
            if not symbols.GetSize() == 1:
                result.AppendWarning(
                    "Multiple ({}) symbols found for function {}".format(symbols.GetSize(), symbol_name))
            return symbols[0].GetSymbol()
        else:
            raise DebuggerException("Could not find symbol for function {}.".format(symbol_name))

    @staticmethod
    def _find_gc_scheduler_offset(deinit_memory: SBSymbol, schedule_gc: SBSymbol, target: SBTarget) -> int:
        instructions = deinit_memory.GetInstructions(target)
        load_addr = "{:#x}".format(schedule_gc.addr.GetLoadAddress(target))

        previous_branch_instruction_index: int = 0
        schedule_gc_branch_instruction_index: Optional[int] = None
        for i in range(len(instructions)):
            instruction = instructions[i]
            if instruction.DoesBranch():
                if instruction.GetOperands(target) == load_addr:
                    schedule_gc_branch_instruction_index = i
                    break
                else:
                    previous_branch_instruction_index = i

        if not schedule_gc_branch_instruction_index:
            raise DebuggerException(
                "Could not find a branch instruction to {} inside {}.".format(
                    schedule_gc.GetDisplayName(), deinit_memory.GetDisplayName()))

        match_pattern = "\\(anonymous namespace\\)::globalDataInstance\\s+\\+\\s+(\\d+)"
        gc_scheduler_offset: Optional[int] = None
        for i in range(previous_branch_instruction_index, schedule_gc_branch_instruction_index):
            instruction = instructions[i]
            match = re.search(match_pattern, instruction.GetComment(target))
            if match:
                gc_scheduler_offset = int(match.group(1))
                break

        if not gc_scheduler_offset:
            raise DebuggerException("Could not find gc_scheduler offset for globalDataInstance.")

        return gc_scheduler_offset
```

### Core Architecture Module: `LLDBPlugin/touchlab_kotlin_lldb/commands/KonanGlobalsCommand.py`
```
import re

from lldb import SBDebugger, SBExecutionContext, SBCommandReturnObject

from ..types.summary import kotlin_object_type_summary
from ..util.expression import evaluate


__KONAN_VARIABLE = re.compile('kvar:(.*)#internal')
__KONAN_VARIABLE_TYPE = re.compile('^kfun:<get-(.*)>\\(\\)(.*)$')
__TYPES_KONAN_TO_C = {
   'kotlin.Byte': ('int8_t', lambda v: v.signed),
   'kotlin.Short': ('short', lambda v: v.signed),
   'kotlin.Int': ('int', lambda v: v.signed),
   'kotlin.Long': ('long', lambda v: v.signed),
   'kotlin.UByte': ('int8_t', lambda v: v.unsigned),
   'kotlin.UShort': ('short', lambda v: v.unsigned),
   'kotlin.UInt': ('int', lambda v: v.unsigned),
   'kotlin.ULong': ('long', lambda v: v.unsigned),
   'kotlin.Char': ('short', lambda v: v.signed),
   'kotlin.Boolean': ('bool', lambda v: v.signed),
   'kotlin.Float': ('float', lambda v: v.value),
   'kotlin.Double': ('double', lambda v: v.value)
}


class KonanGlobalsCommand:
    program = 'konan_globals'

    def __init__(self, debugger, unused):
        pass

    def __call__(
            self,
            debugger: SBDebugger,
            command,
            exe_ctx: SBExecutionContext,
            result: SBCommandReturnObject,
    ):
        global __KONAN_VARIABLE, __KONAN_VARIABLE_TYPE, __TYPES_KONAN_TO_C
        target = debugger.GetSelectedTarget()
        process = target.GetProcess()
        thread = process.GetSelectedThread()
        frame = thread.GetSelectedFrame()

        konan_variable_symbols = list(filter(lambda v: __KONAN_VARIABLE.match(v.name), frame.GetModule().symbols))
        visited = list()
        for symbol in konan_variable_symbols:
            name = __KONAN_VARIABLE.search(symbol.name).group(1)

            if name in visited:
                continue
            visited.append(name)

            getters = list(
                filter(lambda v: re.match('^kfun:<get-{}>\\(\\).*$'.format(name), v.name), frame.module.symbols))
            if not getters:
                result.AppendMessage("storage not found for name:{}".format(name))
                continue

            getter_functions = frame.module.FindFunctions(getters[0].name)
            if not getter_functions:
                continue

            address = getter_functions[0].function.GetStartAddress().GetLoadAddress(target)
            type = __KONAN_VARIABLE_TYPE.search(getters[0].name).group(2)
            (c_type, extractor) = __TYPES_KONAN_TO_C[type] if type in __TYPES_KONAN_TO_C.keys() else ('ObjHeader *', lambda v: kotlin_object_type_summary(v))
            value = evaluate('(({0} (*)()){1:#x})()', c_type, address)
            str_value = extractor(value)
            result.AppendMessage('{} {}: {}'.format(type, name, str_value))

```

### Core Architecture Module: `LLDBPlugin/touchlab_kotlin_lldb/commands/SymbolByNameCommand.py`
```
import re

from lldb import SBDebugger, SBExecutionContext, SBCommandReturnObject


class SymbolByNameCommand:
    program = 'symbol_by_name'

    def __init__(self, debugger, unused):
        pass

    def __call__(
            self,
            debugger: SBDebugger,
            command,
            exe_ctx: SBExecutionContext,
            result: SBCommandReturnObject,
    ):
        target = debugger.GetSelectedTarget()
        process = target.GetProcess()
        thread = process.GetSelectedThread()
        frame = thread.GetSelectedFrame()
        tokens = command.split()
        mask = re.compile(tokens[0])
        symbols = list(filter(lambda v: mask.match(v.name), frame.GetModule().symbols))
        visited = list()
        for symbol in symbols:
            name = symbol.name
            if name in visited:
                continue
            visited.append(name)
            result.AppendMessage("{}: {:#x}".format(name, symbol.GetStartAddress().GetLoadAddress(target)))

```

### Core Architecture Module: `LLDBPlugin/touchlab_kotlin_lldb/commands/TypeByAddressCommand.py`
```
import lldb

from ..util import log


class TypeByAddressCommand:
    program = 'type_by_address'

    def __init__(self, debugger, internal_dict):
        pass

    def __call__(
            self,
            debugger: lldb.SBDebugger,
            command,
            exe_ctx: lldb.SBExecutionContext,
            result: lldb.SBCommandReturnObject
    ):
        log(lambda: "type_by_address_command:{}".format(command))
        result.AppendMessage("DEBUG: {}".format(command))
        tokens = command.split()
        target = debugger.GetSelectedTarget()
        types = _type_info_by_address(tokens[0], debugger)
        result.AppendMessage("DEBUG: {}".format(types))
        for t in types:
            result.AppendMessage("{}: {:#x}".format(t.name, t.GetStartAddress().GetLoadAddress(target)))


def _type_info_by_address(address, debugger: lldb.SBDebugger):
    target = debugger.GetSelectedTarget()
    process = target.GetProcess()
    thread = process.GetSelectedThread()
    frame = thread.GetSelectedFrame()
    candidates = list(filter(lambda x: x.GetStartAddress().GetLoadAddress(target) == address, frame.module.symbols))
    return candidates

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
     
-    def GetDeref
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
+
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
+        Pl
```

---

### Incident Patch 10: `b17d2ae4` (2022-05-19)
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
