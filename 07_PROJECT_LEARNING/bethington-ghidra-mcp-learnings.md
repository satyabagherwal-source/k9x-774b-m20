# Forensic Learning Record (Deep Inspection): bethington/ghidra-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/bethington-ghidra-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bethington/ghidra-mcp](https://github.com/bethington/ghidra-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:30:55.042Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bethington/ghidra-mcp`
- **Description**: Ghidra MCP Server — 200+ MCP tools for AI-powered reverse engineering. GUI plugin + headless server, lazy tool loading, convention enforcement, batch operations, Ghidra Server integration, and Docker deployment.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4066 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ghidra_scripts/ArgumentsRenamer.py`
```
#Arguments Renamer - Automatically renames function parameters based on Diablo 2 data types
#
#Iterates through all functions and renames parameters to follow Hungarian notation:
#  - Pointer types: prefix 'p' (pGame, pClient, pUnit)
#  - Double pointers: prefix 'pp' (ppMonsterRegion)
#  - Enum types: prefix 'e' (eUnitType, eSkill, eState)
#Handles duplicate names gracefully and tracks successful renames.
#
#@author Ben Ethington
#@category Diablo 2
#@description Renames function parameters following Hungarian notation conventions (p, pp, e prefixes)
#@keybinding
#@menupath Diablo II.Arguments Renamer

import json

from ghidra.util.exception import CancelledException, InvalidInputException
from ghidra.program.model.listing import VariableFilter
from ghidra.program.model.symbol import SourceType
from ghidra.util.exception import DuplicateNameException
    
    
def main():
    monitor.initialize(currentProgram.getFunctionManager().getFunctionCount())
    c = 0
    for func in currentProgram.functionManager.getFunctions(1): 
        if "{}".format(func.getEntryPoint()) == "00681a48":
            break
            
        monitor.incrementProgress(1)
        monitor.setShowProgressValue(True)
        
        args = func.getParameters()
        
        for arg in args:
            if "{}".format(arg.getDataType()) == "D2GameStrc *":
                try:
                    arg.setName("pGame", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2ClientStrc *":
                try:
                    arg.setName("pClient", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2PoolManagerStrc *":
                try:
                    arg.setName("pMemory", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2RoomStrc *":
                try:
                    arg.setName("pRoom", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2RoomExStrc *":
                try:
                    arg.setName("pRoomEx", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2DrlgLevelStrc *":
                try:
                    arg.setName("pLevel", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2PresetUnitStrc *":
                try:
                    arg.setName("pPresetUnit", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "eD2UnitType":
                try:
                    arg.setName("eUnitType", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2RosterStrc *":
                try:
                    arg.setName("pRoster", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "eD2Skills":
                try:
                    arg.setName("eSkill", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "eD2States":
                try:
                    arg.setName("eState", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "eD2UnitStat":
                try:
                    arg.setName("eUnitStat", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "eD2PlayerClassID":
                try:
                    arg.setName("ePlayerClass", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2InventoryStrc *":
                try:
                    arg.setName("pInventory", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "DC6 *":
                try:
                    arg.setName("pDC6", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2SkillStrc *":
                try:
                    arg.setName("pSkill", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2DynamicPathStrc *":
                try:
                    arg.setName("pDynamicPath", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2PlayerListStrc *":
                try:
                    arg.setName("pPlayerList", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2ParticleStrc *":
                try:
                    arg.setName("pParticle", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2DrlgStrc *":
                try:
                    arg.setName("pDrlg", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2DrlgActStrc *":
                try:
                    arg.setName("pDrlgAct", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2DrlgEnvironmentStrc *":
                try:
                    arg.setName("pDrlgEnvironment", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2DrlgMapStrc *":
                try:
                    arg.setName("pDrlgMap", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2TimerQueueStrc *":
                try:
                    arg.setName("pTimerQueue", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2TimerListStrc *":
                try:
                    arg.setName("pTimerList", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2BitBufferStrc *":
                try:
                    arg.setName("pBitBuffer", SourceType.USER_DEFINED)
                except Dupli
```

### Core Architecture Module: `ghidra_scripts/ArgumentsUnifier.py`
```
#Arguments Unifier - Standardizes function parameter and return types to fixed-width types
#
#Converts variable-sized types to explicit fixed-width equivalents:
#  - int → int32_t, uint → uint32_t
#  - short → int16_t, ushort → uint16_t
#  - BYTE → int8_t
#Applies to both function parameters and return types across all functions.
#Ensures consistent type sizes regardless of platform or compiler settings.
#
#@author Ben Ethington
#@category Diablo 2
#@description Standardizes function parameter and return types to fixed-width equivalents (int32_t, uint16_t, etc.)
#@keybinding
#@menupath Diablo II.Arguments Unifier

import json

from ghidra.util.exception import CancelledException, InvalidInputException
from ghidra.program.model.listing import VariableFilter
from ghidra.program.model.symbol import SourceType
from ghidra.util.exception import DuplicateNameException
from ghidra.app.services import DataTypeManagerService

# thanks weiry6922
def exportParamName(param):
    if "(" in param:
        #print("Skippping function parameter")
        return None, None
    elif not " " in param:
        #print("Skipping function pointer")
        return None, None
    elif "unsigned" in param:
        sig, strc, name = param.split(" ")
    elif "signed" in param:
        sig, strc, name = param.split(" ")
    elif "const" in param:
        sig, strc, name = param.split(" ")
    else:
        strc, name = param.split(" ")
    
    return strc, name

# thanks weiry6922
def getDataTypeManagerByName(name):
    tool = state.getTool()
    service = tool.getService(DataTypeManagerService)
    dataTypeManagers = service.getDataTypeManagers()
    for manager in dataTypeManagers:
        managerName = manager.getName()
        if name in managerName:
            return manager
    return None

# thanks weiry6922
def findDataTypeByNameInDataManager(nameDT, nameDTM):
    manager = getDataTypeManagerByName(nameDTM)
    allDataTypes = manager.getAllDataTypes()
    while allDataTypes.hasNext():
        dataType = allDataTypes.next()
        dataTypeName = dataType.getName()
        if dataTypeName.startswith(nameDT):
            return dataType
    return None

# thanks weiry6922
def findDataTypeByName(name):
    dt = findDataTypeByNameInDataManager(name, currentProgram.name)
    if dt == None:
        dt = findDataTypeByNameInDataManager(name, u"BuiltInTypes")
    if dt == None:
        dt = findDataTypeByNameInDataManager(name, u"windows_vs12_32")
    return dt
    
def retypeArgs(args):
    c = 0
    for arg in args:
        if "{}".format(arg.getDataType()) == "int":
            arg.setDataType(findDataTypeByName("int32_t"), SourceType.USER_DEFINED)
            c = c + 1
        if "{}".format(arg.getDataType()) == "uint":
            arg.setDataType(findDataTypeByName("uint32_t"), SourceType.USER_DEFINED)
            c = c + 1
        if "{}".format(arg.getDataType()) == "short":
            arg.setDataType(findDataTypeByName("int16_t"), SourceType.USER_DEFINED)
            c = c + 1
        if "{}".format(arg.getDataType()) == "ushort":
            arg.setDataType(findDataTypeByName("uint16_t"), SourceType.USER_DEFINED)
            c = c + 1
        if "{}".format(arg.getDataType()) == "BYTE":
            arg.setDataType(findDataTypeByName("int8_t"), SourceType.USER_DEFINED)
            c = c + 1
    return c
    
def main():
    monitor.initialize(currentProgram.getFunctionManager().getFunctionCount())
    c = 0
    for func in currentProgram.functionManager.getFunctions(1): 
        if "{}".format(func.getEntryPoint()) == "00681a48":
            break
            
        monitor.incrementProgress(1)
        monitor.setShowProgressValue(True)
        
        # retype function arguments
        args = func.getParameters()
        c = c + retypeArgs(args)
        
        # retype function return
        retu = func.getReturn()
        c = c + retypeArgs([retu])

    print("Fixed {} argument types".format(c))         
try:
    main()
except CancelledException:
    pass
```

### Core Architecture Module: `ghidra_scripts/CreateFunctionsFromArray.py`
```
#Create Functions From Array
#
#This script reads an array of function pointers starting at the current address,
#disassembles each target address, and creates a function at each location.
#Useful for processing function pointer tables or vtables in Diablo 2.
#Place cursor at the start of the array before running.
#
#@author Ben Ethington
#@category Diablo 2
#@description Creates functions at addresses stored in function pointer arrays and vtables
#@keybinding
#@menupath Diablo II.Create Functions From Array

from ghidra.app.cmd.function import CreateFunctionCmd
from ghidra.app.cmd.disassemble import DisassembleCommand



# helper function to get a Ghidra Address type
# accepts hexstring
def getAddress(addr):
    # Address getAddress(java.lang.String addrString)
    return currentProgram.getAddressFactory().getAddress(addr)

base = currentAddress
for i in range(52):
    number = currentProgram.getMemory().getInt(base.add(i*4))
    addr = getAddress("{:08X}".format(number))

    cmd = DisassembleCommand(addr, None, False)
    cmd.applyTo(currentProgram, monitor)

    cmd = CreateFunctionCmd(addr)
    cmd.applyTo(currentProgram)
```

### Core Architecture Module: `ghidra_scripts/CustomRegisters.py`
```
#Custom Registers
#
#This script identifies functions in Diablo 2 that use non-standard registers (in_* or unaff_*)
#as parameters and promotes them to explicit function arguments. It enables custom variable storage,
#adds the register parameters to the function signature, and sets the calling convention to "unknown".
#Useful for fixing functions with unusual register usage patterns that Ghidra doesn't detect automatically.
#
#@author Ben Ethington
#@category Diablo 2
#@description Promotes non-standard registers (in_*, unaff_*) to explicit function arguments with custom storage
#@keybinding
#@menupath Diablo II.Custom Registers

import json
import os
import platform
import time

from ghidra.util.exception import CancelledException, InvalidInputException
from ghidra.program.model.symbol import SourceType
from ghidra.app.cmd.label import AddLabelCmd
from ghidra.app.cmd.label import RenameLabelCmd
from ghidra.app.cmd.label import CreateNamespacesCmd
from ghidra.app.cmd.function import CreateFunctionCmd
from ghidra.app.util import NamespaceUtils
from ghidra.app.cmd.disassemble import DisassembleCommand
from ghidra.app.decompiler import DecompileOptions
from ghidra.app.decompiler import DecompInterface
from ghidra.program.model.listing import ParameterImpl
from ghidra.program.model.pcode import HighFunctionDBUtil
from ghidra.app.services import DataTypeManagerService

def stepFindCustomRegisters(s):
    c = 0
    monitor.setMessage(s)
    print(s)
    monitor.initialize(currentProgram.getFunctionManager().getFunctionCount())
    # decompiler setup
    options = DecompileOptions()
    ifc = DecompInterface()
    ifc.setOptions(options)
    ifc.openProgram(currentProgram)
    for func in currentProgram.functionManager.getFunctions(1): 
        monitor.incrementProgress(1)
        monitor.setShowProgressValue(True)
        
        # stop on this address - after that we have standard garbage code we dont care about
        if "{}".format(func.getEntryPoint()) == "00681a48":
            break
            
        monitor.setMessage("Analyzing 0x{}".format(func.getEntryPoint()))
        res = ifc.decompileFunction(func, 60, monitor)
        high_func = res.getHighFunction()
        if high_func:
            lsm = high_func.getLocalSymbolMap()
            
            hfdb = HighFunctionDBUtil()
            hfdb.commitParamsToDatabase(high_func, True, SourceType.USER_DEFINED)
            hfdb.commitReturnToDatabase(high_func, SourceType.USER_DEFINED)
            hfdb.commitLocalNamesToDatabase(high_func, SourceType.USER_DEFINED)
            
            symbols = lsm.getSymbols()
            update = False
            for i, symbol in enumerate(symbols):
                if (symbol.name.startswith("in_") or symbol.name.startswith("unaff_")) and not symbol.name.startswith("in_register") and not symbol.name.startswith("in_FS") and symbol.parameter == False and not "{}".format(symbol.storage).startswith("unique") and not "{}".format(symbol.storage).startswith("Stack") and not "{}".format(symbol.storage).startswith("HASH"):
                    func.setCustomVariableStorage(True)
                    p = ParameterImpl(None, symbol.dataType, symbol.storage, currentProgram)
                    print("Adding {} as param for 0x{}".format(symbol.storage, func.getEntryPoint()))
                    func.addParameter(p, SourceType.USER_DEFINED)
                    update = True
                else:
                    if symbol.name.startswith("in_stack_000000"):
                        print("0x{} require stack param {}".format(func.getEntryPoint(), symbol))
            
            if update:
                #print("Function 0x{} uses custom registers!".format(func.getEntryPoint()))
                func.setCallingConvention("unknown")
                c = c + 1
        monitor.checkCanceled()
    print("Found {} functions using custom registers!".format(c))
    
def main():
    start = time.time()
    stepFindCustomRegisters("Find functions what uses custom registers as arguments and fix them")
    end = time.time()
    print(end - start)
        
try:
    main()
except CancelledException:
    pass
```

### Core Architecture Module: `ghidra_scripts/FunctionExporter.py`
```
#Function Exporter
#
#This script exports all Diablo 2 functions to JSON format with complete metadata including
#function names, addresses, parameter counts, return types, disassembly snippets (first 5 bytes),
#jumpback addresses for hooking, and detailed parameter information (name, type, location, size).
#Outputs both formatted (game.json) and minified (game_minify.json) versions.
#Useful for creating function hooking frameworks or external analysis tools.
#
#@author Ben Ethington
#@category Diablo 2
#@description Exports all functions to JSON with metadata, parameters, addresses, and hooking information
#@keybinding
#@menupath Diablo II.Function Exporter

import json

from ghidra.util.exception import CancelledException, InvalidInputException

def minify(file_name):
    file_data = open(file_name, "r", 1).read() # store file info in variable
    json_data = json.loads(file_data) # store in json structure
    json_string = json.dumps(json_data, separators=(',', ":")) # Compact JSON structure
    file_name = str(file_name).replace(".json", "") # remove .json from end of file_name string
    new_file_name = "{0}_minify.json".format(file_name)
    open(new_file_name, "w+", 1).write(json_string) # open and write json_string to file
    
def write_json(data, filename='game.json'):
    with open(filename,'w') as f:
        json.dump(data, f, indent=2)

try:
    data = []
    o = 0
    for func in currentProgram.functionManager.getFunctions(1):
        if "{}".format(func.getEntryPoint()) == "00681a48":
            break
        o = o + 1
        e = {
            "name" : func.getName(),
            "address" : "0x{}".format(func.getEntryPoint()),
            "paramcount" : func.getParameterCount(),
            "returntype" : "{}".format(func.getReturn().getDataType()),
            "ASM" : "",
            "jumpback" : "",
            "params": [
            ]
        }
        
        #get asm what we replace in case we want to hook function and it's jumpback location
        for inst in currentProgram.listing.getInstructions(func.getBody(), True):
            if inst.getAddress() >= func.getEntryPoint().add(5):
                e["jumpback"] = "0x{}".format(inst.getAddress())
                break
            e["ASM"] = e["ASM"] + "{}\n".format(inst)
        
        i = 0
        for p in func.getParameters():
            t = e["params"]
            name = p.getName()
            type = p.getDataType()
            size = type.getLength()
            if p.isRegisterVariable():
                loc = p.getRegister()
            if p.isStackVariable():
                loc = "Stack[0x{:02X}]".format(p.getStackOffset())
            w = {
                "name" : "{}".format(name),
                "type" : "{}".format(type),
                "location" : "{}".format(loc),
                "idx" : i,
                "size" : size
            }
            i = i + 1
            t.append(w)
        data.append(e)
    write_json(data)
    minify('game.json')
    print("Exported {} functions".format(o))
except CancelledException:
    pass
```

### Core Architecture Module: `ghidra_scripts/StackArgumentsSearcher.py`
```
#Stack Arguments Searcher
#
#This script identifies Diablo 2 functions with incorrect stack parameter counts by analyzing
#RET instructions (opcode C2). It compares the stack cleanup size in RET with the declared
#parameter size and automatically adds missing undefined4 parameters to match the actual count.
#Essential for fixing __stdcall and __fastcall functions where Ghidra misidentifies parameter counts.
#Also ensures functions with custom variable storage use "unknown" calling convention.
#
#@author Ben Ethington
#@category Diablo 2
#@description Identifies functions with incorrect stack parameter counts using RET instruction analysis
#@keybinding
#@menupath Diablo II.Stack Arguments Searcher

import json
import time

from ghidra.util.exception import CancelledException, InvalidInputException
from ghidra.program.model.listing import VariableFilter
from ghidra.program.model.listing import ParameterImpl
from ghidra.program.model.symbol import SourceType
from ghidra.app.services import DataTypeManagerService
    
# thanks weiry6922
def getDataTypeManagerByName(name):
    tool = state.getTool()
    service = tool.getService(DataTypeManagerService)
    dataTypeManagers = service.getDataTypeManagers()
    for manager in dataTypeManagers:
        managerName = manager.getName()
        if name in managerName:
            return manager
    return None

# thanks weiry6922
def findDataTypeByNameInDataManager(nameDT, nameDTM):
    manager = getDataTypeManagerByName(nameDTM)
    allDataTypes = manager.getAllDataTypes()
    while allDataTypes.hasNext():
        dataType = allDataTypes.next()
        dataTypeName = dataType.getName()
        if dataTypeName.startswith(nameDT):
            return dataType
    return None

# thanks weiry6922
def findDataTypeByName(name):
    dt = findDataTypeByNameInDataManager(name, currentProgram.name)
    if dt == None:
        dt = findDataTypeByNameInDataManager(name, u"BuiltInTypes")
    if dt == None:
        dt = findDataTypeByNameInDataManager(name, u"windows_vs12_32")
    return dt
    
def main():
    start = time.time()
    monitor.initialize(currentProgram.getFunctionManager().getFunctionCount())
    c = 0
    for func in currentProgram.functionManager.getFunctions(1): 
        if "{}".format(func.getEntryPoint()) == "00681a48":
            break
            
        if func.hasCustomVariableStorage():
            func.setCallingConvention("unknown")
            
        monitor.incrementProgress(1)
        monitor.setShowProgressValue(True)
        
        found = False
        
        args = func.getParameters(VariableFilter.STACK_VARIABLE_FILTER)
        
        argsSize = 0
        for arg in args:
            a = arg.getLength()
            if a < 4:
                a = 4
            argsSize = argsSize + a
            
        argcount = len(args)
        retcount = 0
        retSize = 0
        
        for inst in currentProgram.listing.getInstructions(func.getBody(), True):
            if '{:02X}'.format(inst.getUnsignedByte(0)) == "C2":
                retSize = inst.getUnsignedShort(1)
                retcount = retSize / 4
                found = True
                break;
        
        if found:
            if argsSize != retSize:
                if argsSize < retSize:
                    if not func.hasCustomVariableStorage():
                        for i in range(retcount - argcount):
                            dt = findDataTypeByName("undefined4")
                            p = ParameterImpl(None, dt, currentProgram)
                            func.addParameter(p, SourceType.USER_DEFINED)
                c = c + 1
                print("Function 0x{} has defined {}/{} stack arguments".format(func.getEntryPoint(), argcount, retcount))
                
    print("Found {} functions with wrong stack arguments count".format(c))
    end = time.time()
    print(end - start)
try:
    main()
except CancelledException:
    pass
```

### Core Architecture Module: `ghidra_scripts/ThisCallReplacer.py`
```
#This Call Replacer
#
#This script finds all functions using the __thiscall calling convention and changes them
#to "unknown" calling convention. Useful when __thiscall is incorrectly applied in Diablo 2
#or when you need to force Ghidra to re-analyze calling conventions for C++ member functions.
#Reports the total count of modified functions.
#
#@author Ben Ethington
#@category Diablo 2
#@description Replaces __thiscall calling convention with unknown for functions with non-standard member semantics
#@keybinding
#@menupath Diablo II.This Call Replacer

import json

from ghidra.util.exception import CancelledException, InvalidInputException

try:
    i = 0
    for func in currentProgram.functionManager.getFunctions(1):
        if func.getCallingConventionName() == "__thiscall":
            i = i + 1
            func.setCallingConvention("unknown")
            
    print("Found {} functions with __thiscall calling convention".format(i))
        
except CancelledException:
    pass
```

### Core Architecture Module: `ghidra_scripts/namespacer.py`
```
#Namespacer
#
#This script assigns all functions after the current address to the same namespace
#as the currently selected function. It continues until it encounters two consecutive
#functions that already belong to the target namespace, indicating the end of the range.
#Useful for bulk namespace organization when functions are grouped by memory region.
#
#@author Ben Ethington
#@category Diablo 2
#@description Bulk assigns functions to the same namespace as the currently selected function
#@keybinding
#@menupath Diablo II.Namespacer

c = 0
n = currentProgram.functionManager.getFunctionAt(currentAddress).getParentNamespace()

for f in currentProgram.functionManager.getFunctions(currentAddress, True):
    cn = f.getParentNamespace()
    if cn == n:
        c = c + 1
        print(f.getName())
        if c == 2:
            break
    else:
        f.setParentNamespace(n)
    
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #217** (2026-05-31): **Deploy targets wrong user-config dir on Ghidra version change (12.0.4 → 12.1)**
  *Symptoms*: ## Problem  During the v5.10 → v5.11 deploy (Ghidra 12.0.4 → 12.1) two additional gaps surfaced beyond the process-detection one (fixed in `d8cb60e`):  ### Bug A — extension installed to the wrong user-config dir  Deploy log:  ``` Installed user extension to C:\Users\benam\AppData\Roaming\ghidra\ghidra_12.1_DEV\Extensions\GhidraMCP ```  The target install is `F:\ghidra_12.1_PUBLIC`. Its actual user-config dir is `%APPDATA%\ghidra\ghidra_12.1_PUBLIC\` (not `_DEV`). The deploy picked the wrong dir, so the running 12.1 install doesn't see the freshly-installed user extension.  ### Bug B — FrontEndTool.xml patch targeted the old install's user dir  ``` Patched FrontEnd config C:\Users\benam\AppData\Roaming\ghidra\ghidra_12.0.4_PUBLIC\FrontEndTool.xml ```  `patch_ghidra_user_configs` uses `user_base_dir.glob("*/FrontEndTool.xml")` and patches every file that needs modification. After v5.10's deploy the 12.0.4 user dir already had `<INCLUDE CLASS="com.xebyte.GhidraMCPPlugin" />` inside the Utility package; for v5.11 the patcher would have detected `PLUGIN_CLASS in updated` and short-circuited the modify-and-write path for 12.0.4 — so the *only* file that should have been logged as patched was 12.1's. The deploy log shows the opposite: 12.0.4 was modified, 12.1 was NOT.  Verified by hand after the deploy:  ``` $ grep -c "xebyte" %APPDATA%\ghidra\ghidra_12.1_PUBLIC\FrontEndTool.xml 0 $ grep -c "xebyte" %APPDATA%\ghidra\ghidra_12.0.4_PUBLIC\FrontEndTool.xml 0 ```  Neither has the incl

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

### Incident Patch 1: `d38af54c` (2026-09-24)
**Commit Message**: release: record live-regression evidence for 7.0.0 on Ghidra 12.1.3

`deploy --test release` against a live Ghidra 12.1.3 GUI instance, on
dev at ea06ae3d. Every step passed: MCP smoke (239 tools), selected
endpoint contract (29 tools), extended read, benchmark YAML regression
(46 assertion blocks, 16 explicit skips), multi-program targeting,
negative/error-shape contract, and the debugger live test, which RAN --
it launched BenchmarkDebug.exe and read trace state. No skip hole.

The first attempt failed at that last step: the repo-local .env named a
debugger interpreter that no longer existed, and gave no WINDBG_DIR, so
the dbgeng back-end exited before connecting. Pointing it at the
interpreter provisioned from Ghidra's own shipped wheels (ghidratrace and
ghidradbg 12.1, matching 12.1.3) with WINDBG_DIR=C:\Windows\System32
fixed it. That is local configuration and is not part of this commit.

`tools.release_evidence verify --version 7.0.0` passes on this tree.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `docs/releases/live-regression-evidence.json` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+{
+  "schema": 1,
+  "version": "7.0.0",
+  "tier": "release",
+  "tiers_run": [
+    "release"
+  ],
+  "result": "passed",
+  "source_fingerprint": "c0bf4dbda3f6dd5a84d4d623aa341469b72d1292d0fd308b9801a4b21a0d1ab9",
+  "fingerprinted_paths": [
+    "src/main/java",
+    "python/bridge_mcp_ghidra",
+    "tools/setup",
+    "tests/fixtures/benchmark",
+    "tests/endpoints.json",
+    "pom.xml",
+    "build.gradle"
+  ],
+  "ghidra_version": "12.1.3",
+  "recorded_utc": "2026-09-24T07:35:35Z"
+}
```

---

### Incident Patch 2: `e9e57157` (2026-09-24)
**Commit Message**: fix: headless delete_file closed every program whose path contained the target

#507 routed the headless close-before-delete through closeProgram(path,
false). That matcher falls back to a substring test and closes every hit,
and the headless provider's close is a bare release with no save -- so
deleting /Mods/D2Common.dll also closed /Mods/D2Common.dll.orig and threw
away its unsaved edits, while the response still reported success.

The headless branch now matches the exact path and stops after one, the
same rule the GUI branch already used. DeleteFileHeadlessCloseTest failed
on both assertions before the fix (the neighbour was closed; a non-matching
program was closed) and passes after it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -1532,6 +1532,9 @@ load-bearing: removing it turns 7 passing tests into 7 errors.
 - **`move_file` / `move_folder` were unreachable outside one mode.**
 - **`list_project_files`, `create_folder`, and `delete_file` failed in headless mode with `"requires GUI mode"`.**
   Now routed through `resolveProject()` to operate across GUI, FrontEnd, and headless modes alike.
+  Headless `delete_file` closes the program it deletes by **exact** path: the first cut
+  went through `close_program`'s substring matcher, which would also close (and, headless,
+  discard the unsaved edits of) any open program whose path merely contained the target.
 - **`rename_function` now refuses to overwrite a Function ID name** unless
   `strict_mode=warn`. See below for why.
 - **A non-loopback HTTP bridge approved a browser's preflight and then refused
```

**File**: `src/main/java/com/xebyte/core/ProgramScriptService.java` (modified, +13/-1)
```diff
@@ -1783,7 +1783,19 @@ private void closeOpenProgramForFile(PluginTool tool, String filePath) {
             return;
         }
         if (tool == null) {
-            closeProgram(filePath, false);
+            // Headless: close exactly this file, the same rule the GUI branch
+            // below uses. Not closeProgram(filePath, false) -- its matcher falls
+            // back to a SUBSTRING test and closes every hit, and the headless
+            // provider's close is a bare release with no save, so deleting
+            // /x/a.dll would also close /x/a.dll.orig and discard its unsaved
+            // edits while still reporting success.
+            for (Program prog : programProvider.getAllOpenPrograms()) {
+                ghidra.framework.model.DomainFile df = prog.getDomainFile();
+                if (df != null && df.getPathname().equalsIgnoreCase(filePath)) {
+                    programProvider.closeProgram(prog);
+                    return;
+                }
+            }
             return;
         }
         // Close paths must NEVER spawn a CodeBrowser — there is nothing useful
```

**File**: `src/test/java/com/xebyte/offline/DeleteFileHeadlessCloseTest.java` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+package com.xebyte.offline;
+
+import com.xebyte.core.ProgramProvider;
+import com.xebyte.core.ProgramScriptService;
+import com.xebyte.core.Response;
+import ghidra.framework.model.DomainFile;
+import ghidra.framework.model.Project;
+import ghidra.framework.model.ProjectData;
+import ghidra.program.model.listing.Program;
+import org.junit.Test;
+
+import java.util.ArrayList;
+import java.util.List;
+
+import static org.junit.Assert.*;
+import static org.mockito.Mockito.*;
+
+/**
+ * Headless /delete_file must close exactly the file it deletes.
+ *
+ * <p>With no PluginTool (the headless case) the close-before-delete step once
+ * went through closeProgram(path, false), whose matcher falls back to a
+ * SUBSTRING test and closes every hit. The headless provider's close is a bare
+ * release with no save, so deleting /Mods/D2Common.dll also closed
+ * /Mods/D2Common.dll.orig and silently discarded its unsaved edits -- while the
+ * response still reported success. The GUI branch always matched the exact
+ * path; this pins the headless branch to the same rule.
+ */
+public class DeleteFileHeadlessCloseTest {
+
+    /** A provider that is none of the GUI provider types, so no PluginTool resolves. */
+    private static final class HeadlessLikeProvider implements ProgramProvider {
+        final List<Program> open = new ArrayList<>();
+        final List<Program> closed = new ArrayList<>();
+        final Project project;
+
+        HeadlessLikeProvider(Project project) { this.project = project; }
+
+        @Override public Program getCurrentProgram() { return open.isEmpty() ? null : open.get(0); }
+        @Override public Program getProgram(String name) { return null; }
+        @Override public Program[] getAllOpenPrograms() { return open.toArray(new Program[0]); }
+        @Override public void setCurrentProgram(Program program) { }
+        @Override public boolean closeProgram(Program program) {
+            open.remove(program);
+            closed.add(program);
+            return true;
+        }
+        @Override public Project getProject() { return project; }
+    }
+
+    private static Program programAt(String path) {
+        Program p = mock(Program.class);
+        DomainFile df = mock(DomainFile.class);
+        when(df.getPathname()).thenReturn(path);
+        when(p.getDomainFile()).thenReturn(df);
+        when(p.getName()).thenReturn(path.substring(path.lastIndexOf('/') + 1));
+        return p;
+    }
+
+    @Test
+    public void deleteClosesOnlyTheExactPathNotSubstringNeighbours() throws Exception {
+        String target = "/Mods/D2Common.dll";
+        DomainFile targetFile = mock(DomainFile.class);
+        ProjectData data = mock(ProjectData.class);
+        when(data.getFile(target)).thenReturn(targetFile);
+        Project project = mock(Project.class);
+        when(project.getProjectData()).thenReturn(data);
+
+        HeadlessLikeProvider provider = new HeadlessLikeProvider(project);
+        Program victim = programAt(target);
+        Program neighbour = programAt("/Mods/D2Common.dll.orig");   // path CONTAINS the target
+        provider.open.add(neighbour);
+        provider.open.add(victim);
+
+        ProgramScriptService scripts = new ProgramScriptService(provider, new NoopThreadingStrategy());
+        Response r = scripts.deleteFile(target);
+
+        assertTrue("delete should succeed: " + r, r instanceof Response.Ok);
+        verify(targetFile).delete();
+        assertTrue("the deleted file's program must be closed", provider.closed.contains(victim));
+        assertFalse("a program whose path merely contains the target must survive",
+                    provider.closed.contains(neighbour));
+        assertTrue(provider.open.contains(neighbour));
+    }
+
+    @Test
+    public void deleteWithNothingOpenClosesNothing() throws Exception {
+        String target = "/solo.exe";
+        DomainFile targetFile = mock(DomainFile.class);
+        ProjectData data = mock
```

---

### Incident Patch 3: `66b7f820` (2026-09-24)
**Commit Message**: fix: allow routing aliases on loopback binds (#510)

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -850,6 +850,10 @@ name-quality rejection that `rename_data` applied.
 
 **Bug fixes shipped with the merges.**
 
+- `GHIDRA_MCP_ALLOWED_HOSTS` now extends Host/Origin validation for loopback
+  HTTP binds as well as wildcard binds. Containers can therefore address a
+  bridge through a host-routing alias while the listener remains bound to
+  `127.0.0.1`; defaults and DNS-rebinding protection remain unchanged.
 - `validate_data_type_exists` returned a false negative for every bare type
   name (`int`, `DWORD`, `char *`) because it required a full category path. The
   survivor reuses `get_type_size`'s resolver.
```

**File**: `README.md` (modified, +14/-0)
```diff
@@ -406,6 +406,20 @@ the `mcp-session-id` / `mcp-protocol-version` headers to scripts. Allowed origin
 Host-header policy — loopback on any port is always permitted, plus the bind host and any
 hosts listed in `GHIDRA_MCP_ALLOWED_HOSTS`.
 
+`GHIDRA_MCP_ALLOWED_HOSTS` also supports clients that route a loopback-bound
+bridge through another network namespace. For example, a container can address
+the host as `host.containers.internal` without exposing the bridge on a LAN
+interface:
+
+```bash
+GHIDRA_MCP_ALLOWED_HOSTS=host.containers.internal \
+  uv run bridge-mcp-ghidra --transport streamable-http \
+  --mcp-host 127.0.0.1 --mcp-port 8081
+```
+
+The setting extends DNS-rebinding Host/Origin validation only; it does not
+change the bind address or make the listener reachable on additional interfaces.
+
 #### Option 3: SSE Transport (Deprecated — use streamable-http instead)
 
 ```bash
```

**File**: `python/bridge_mcp_ghidra/cli.py` (modified, +4/-1)
```diff
@@ -284,7 +284,10 @@ def main():
         mcp.settings.port = args.mcp_port
 
     _host = args.mcp_host
-    if _host not in _LOOPBACK_HOSTS:
+    _has_extra_hosts = any(
+        host.strip() for host in os.environ.get("GHIDRA_MCP_ALLOWED_HOSTS", "").split(",")
+    )
+    if _host not in _LOOPBACK_HOSTS or _has_extra_hosts:
         # Wildcard bind is the MOST exposed configuration — keep
         # DNS-rebinding protection ON and allow only the machine's actual
         # hostnames/IPs. Previously this branch disabled protection
```

**File**: `tests/unit/test_bridge_cli.py` (modified, +20/-0)
```diff
@@ -15,6 +15,7 @@
 
 from bridge_mcp_ghidra import cli, state  # noqa: E402
 from bridge_mcp_ghidra.server import mcp  # noqa: E402
+from mcp.server.transport_security import TransportSecurityMiddleware  # noqa: E402
 
 
 class _CliHarness(unittest.TestCase):
@@ -161,6 +162,25 @@ def test_loopback_host_leaves_security_untouched(self):
         self.run_main("--mcp-host", "127.0.0.1")
         self.assertIs(mcp.settings.transport_security, sentinel)
 
+    def test_loopback_default_security_rejects_unlisted_host(self):
+        self.run_main("--mcp-host", "127.0.0.1")
+        guard = TransportSecurityMiddleware(mcp.settings.transport_security)
+        self.assertTrue(guard._validate_host("localhost:8091"))
+        self.assertFalse(guard._validate_host("host.containers.internal:8091"))
+
+    def test_loopback_bind_extra_hosts_from_env(self):
+        self.run_main(
+            "--mcp-host",
+            "127.0.0.1",
+            env={"GHIDRA_MCP_ALLOWED_HOSTS": "host.containers.internal"},
+        )
+        sec = mcp.settings.transport_security
+        guard = TransportSecurityMiddleware(sec)
+        self.assertTrue(sec.enable_dns_rebinding_protection)
+        self.assertTrue(guard._validate_host("host.containers.internal:8091"))
+        self.assertTrue(guard._validate_host("127.0.0.1:8091"))
+        self.assertFalse(guard._validate_host("unlisted.example:8091"))
+
     def test_specific_remote_host_enables_protection(self):
         self.run_main("--mcp-host", "192.168.1.50")
         sec = mcp.settings.transport_security
```

---

### Incident Patch 4: `b3f8dfef` (2026-09-22)
**Commit Message**: fix: /delete_function threw CME on tagged functions, dry-run made it worse (#541)

* fix: /delete_function threw CME on tagged functions, dry-run made it worse

FunctionManagerDB.doRemoveFunction iterates a function's own tag set while
removing tags from it, so deleteFunctionAtAddress on any tagged function
threw ConcurrentModificationException (HashMap$KeyIterator.next <-
FunctionManagerDB.doRemoveFunction <- FunctionSymbol.delete <-
FunctionManagerDB.removeFunction). Fixed by detaching the function's tags
via func.removeTag(name) -- the same call /remove_function_tag already
uses -- before calling removeFunction, so Ghidra's internal loop has
nothing left to iterate. The response now reports detached_tags.

A second, independent CME hit every dry_run delete regardless of tags.
AnnotationScanner's dry-run wrapper opened its transaction directly via
program.startTransaction() on the calling HTTP thread, while the wrapped
write's own threadingStrategy.executeWrite dispatched the real work to a
different thread (the Swing EDT via a separate
SwingUtilities.invokeAndWait) -- nesting a transaction opened by one
thread inside one opened by another. The whole dry-run wrapper, including
th

**File**: `CHANGELOG.md` (modified, +39/-0)
```diff
@@ -19,6 +19,45 @@ the same cycle.
 > the *cause* of a change here (`uv.lock`'s stale dependency group, the
 > release workflows' dangling paths, the benchmark fixture that left with it).
 
+### Fixed — `/delete_function` threw `ConcurrentModificationException` on any tagged function, and dry-run made it worse
+
+`FunctionManagerDB.doRemoveFunction` iterates a function's own tag set while
+removing tags from it — a Ghidra internal, not ours to patch — so
+`deleteFunctionAtAddress` calling `removeFunction` on a tagged function threw
+`ConcurrentModificationException` every time (`HashMap$KeyIterator.next` <-
+`FunctionManagerDB.doRemoveFunction` <- `FunctionSymbol.delete` <-
+`FunctionManagerDB.removeFunction`). Found while clearing tagged funclet
+functions out of a live project; the previous workaround was two calls —
+`/remove_function_tag` with every tag, then `/delete_function`. It now
+detaches the function's tags itself, via the same `func.removeTag(name)` call
+`/remove_function_tag` already uses, before calling `removeFunction`, so
+Ghidra's internal loop has nothing left to iterate. The response now reports
+`detached_tags`.
+
+A second, independent `ConcurrentModificationException` hit every `dry_run`
+delete, tagged or not, even after the fix above. `AnnotationScanner`'s
+dry-run wrapper opened its transaction directly via `program.startTransaction`
+on the calling (HTTP) thread, while the wrapped write's own
+`threadingStrategy.executeWrite` dispatched the real work to a *different*
+thread — the Swing EDT in GUI mode, via a separate
+`SwingUtilities.invokeAndWait` — nesting a transaction opened by one thread
+inside one opened by another. The dry-run wrapper, including the transaction
+it opens, now runs entirely through `threadingStrategy.executeWrite`, so it
+lands on the same thread the wrapped write's own nested `executeWrite` call
+detects (`SwingUtilities.isEventDispatchThread()`) and reuses in place, with
+no second dispatch. `AnnotationScanner` gained a `ThreadingStrategy`
+constructor parameter for this; the two varargs constructors kept for
+existing callers and offline test fixtures default to a same-thread fallback,
+so no existing call site needed to change.
+
+Covered by `FunctionServiceDeleteFunctionTest` (tagged and untagged deletes)
+and `AnnotationScannerOfflineTest`'s
+`testDryRunDeleteFunctionOpensItsTransactionOnlyInsideTheThreadingStrategy`,
+both of which fail against the previous behaviour — the former with a real
+`ConcurrentModificationException` from a live-view tag set, the latter via a
+mocked `Program.startTransaction` that throws if called outside
+`executeWrite`.
+
 ### Added — two endpoints, after the consolidation pass
 
 Both landed in the 7.0.0 cycle after the 272 → 251 consolidation, which is why
```

**File**: `src/main/java/com/xebyte/GhidraMCPPlugin.java` (modified, +7/-2)
```diff
@@ -265,6 +265,11 @@ public class GhidraMCPPlugin extends Plugin implements ApplicationLevelPlugin {
     // Program provider for on-demand program access (FrontEnd mode)
     private final FrontEndProgramProvider programProvider;
 
+    // Threading strategy shared by every service AND the AnnotationScanner's
+    // dry-run wrapper, so a dry-run transaction and the write it wraps always
+    // nest on the same thread (see AnnotationScanner.createHandler).
+    private final com.xebyte.core.ThreadingStrategy threadingStrategy;
+
     // Server authenticator for programmatic login (bypasses GUI password dialog)
     private com.xebyte.core.GhidraMCPAuthenticator authenticator;
 
@@ -290,7 +295,7 @@ public GhidraMCPPlugin(PluginTool tool) {
 
         // Initialize service layer — FrontEnd mode: opens programs on-demand from project
         this.programProvider = new FrontEndProgramProvider(tool, this);
-        com.xebyte.core.ThreadingStrategy threadingStrategy = new com.xebyte.headless.DirectThreadingStrategy();
+        this.threadingStrategy = new com.xebyte.headless.DirectThreadingStrategy();
         this.listingService = new com.xebyte.core.ListingService(programProvider);
         this.commentService = new com.xebyte.core.CommentService(programProvider, threadingStrategy);
         this.symbolLabelService = new com.xebyte.core.SymbolLabelService(programProvider, threadingStrategy);
@@ -641,7 +646,7 @@ private void startServer() throws IOException {
         // Discovers @McpTool-annotated methods on service instances via reflection
         // ==========================================================================
 
-        AnnotationScanner scanner = new AnnotationScanner(programProvider,
+        AnnotationScanner scanner = new AnnotationScanner(programProvider, threadingStrategy,
             listingService, functionService, commentService, symbolLabelService,
             xrefCallGraphService, dataTypeService, analysisService,
             documentationHashService, malwareSecurityService, programScriptService,
```

**File**: `src/main/java/com/xebyte/core/AnnotationScanner.java` (modified, +79/-8)
```diff
@@ -5,6 +5,7 @@
 import java.lang.reflect.Method;
 import java.lang.reflect.Parameter;
 import java.util.*;
+import java.util.concurrent.Callable;
 import java.util.logging.Level;
 import java.util.logging.Logger;
 
@@ -36,17 +37,54 @@ public class AnnotationScanner {
     private static final Logger LOG = Logger.getLogger(AnnotationScanner.class.getName());
     private static final String NO_DEFAULT = Param.NO_DEFAULT;
 
+    /**
+     * Fallback used only by the constructors that predate {@link ThreadingStrategy}
+     * support (kept so existing callers and offline test fixtures compile
+     * unchanged). Runs directly on the calling thread with no EDT dispatch and
+     * no locking -- adequate for single-threaded offline scanning, never used
+     * by the real plugin or headless server, both of which always pass their
+     * own strategy through the three-argument constructor below.
+     */
+    private static final ThreadingStrategy DIRECT_NO_LOCK = new ThreadingStrategy() {
+        @Override
+        public <T> T executeRead(Callable<T> action) throws Exception {
+            return action.call();
+        }
+
+        @Override
+        public <T> T executeWrite(Program program, String txName, Callable<T> action) throws Exception {
+            if (program == null) {
+                throw new IllegalArgumentException("Program cannot be null for write operations");
+            }
+            int tx = program.startTransaction(txName);
+            boolean success = false;
+            try {
+                T result = action.call();
+                success = true;
+                return result;
+            } finally {
+                program.endTransaction(tx, success);
+            }
+        }
+
+        @Override
+        public boolean isHeadless() {
+            return true;
+        }
+    };
+
     private final List<EndpointDef> endpoints = new ArrayList<>();
     private final List<ToolDescriptor> descriptors = new ArrayList<>();
     private final ProgramProvider programProvider;
+    private final ThreadingStrategy threadingStrategy;
 
     /**
      * Scan the given service instances for {@link McpTool}-annotated methods.
      *
      * @param services service objects to scan (e.g., ListingService, FunctionService, ...)
      */
     public AnnotationScanner(Object... services) {
-        this(null, services);
+        this(null, DIRECT_NO_LOCK, services);
     }
 
     /**
@@ -56,7 +94,24 @@ public AnnotationScanner(Object... services) {
      * @param services        service objects to scan
      */
     public AnnotationScanner(ProgramProvider programProvider, Object... services) {
+        this(programProvider, DIRECT_NO_LOCK, services);
+    }
+
+    /**
+     * Scan the given service instances for {@link McpTool}-annotated methods.
+     *
+     * @param programProvider  provider for resolving programs (enables dry-run support)
+     * @param threadingStrategy strategy the dry-run wrapper uses to run the wrapped
+     *                          write on the same thread Ghidra's own threading model
+     *                          requires (the Swing EDT in GUI mode); pass the same
+     *                          instance the scanned services themselves were built
+     *                          with, e.g. {@link SwingThreadingStrategy}
+     * @param services          service objects to scan
+     */
+    public AnnotationScanner(ProgramProvider programProvider, ThreadingStrategy threadingStrategy,
+            Object... services) {
         this.programProvider = programProvider;
+        this.threadingStrategy = threadingStrategy != null ? threadingStrategy : DIRECT_NO_LOCK;
         for (Object service : services) {
             scanService(service);
         }
@@ -181,13 +236,29 @@ private EndpointDef.EndpointHandler createHandler(Object service, Method method,
                 if (isWrite && isDryRu
```

**File**: `src/main/java/com/xebyte/core/FunctionService.java` (modified, +19/-0)
```diff
@@ -3113,13 +3113,32 @@ public Response deleteFunctionAtAddress(
 
                 String funcName = func.getName();
                 long bodySize = func.getBody().getNumAddresses();
+
+                // FunctionManagerDB.doRemoveFunction iterates the function's own
+                // tag set (a live HashMap-backed view) while removing tags from
+                // that same set, throwing ConcurrentModificationException on any
+                // tagged function -- confirmed via HashMap$KeyIterator.next <-
+                // FunctionManagerDB.doRemoveFunction <- FunctionSymbol.delete <-
+                // FunctionManagerDB.removeFunction. Detach the tags ourselves
+                // first into a detached snapshot so removeFunction has nothing
+                // left to iterate; func.removeTag(name) is the same call
+                // removeFunctionTag already uses for this.
+                List<String> detachedTags = new ArrayList<>();
+                for (FunctionTag tag : new ArrayList<>(func.getTags())) {
+                    detachedTags.add(tag.getName());
+                }
+                for (String tagName : detachedTags) {
+                    func.removeTag(tagName);
+                }
+
                 program.getFunctionManager().removeFunction(addr);
 
                 Map<String, Object> delResult = new LinkedHashMap<>();
                 delResult.put("success", true);
                 delResult.putAll(ServiceUtils.addressToJson(addr, program));
                 delResult.put("deleted_function", funcName);
                 delResult.put("body_size", bodySize);
+                delResult.put("detached_tags", detachedTags);
                 delResult.put("message", "Function '" + funcName + "' deleted at " + addr);
                 resultData.set(delResult);
                 return null;
```

**File**: `src/main/java/com/xebyte/core/ServerManager.java` (modified, +1/-1)
```diff
@@ -72,7 +72,7 @@ public synchronized void registerTool(PluginTool tool,
             MalwareSecurityService malwareSecurityService = new MalwareSecurityService(programProvider, ts);
             ProgramScriptService programScriptService = new ProgramScriptService(programProvider, ts);
 
-            AnnotationScanner scanner = new AnnotationScanner(programProvider,
+            AnnotationScanner scanner = new AnnotationScanner(programProvider, ts,
                 listingService, functionService, commentService, symbolLabelService,
                 xrefCallGraphService, dataTypeService, analysisService,
                 documentationHashService, malwareSecurityService, programScriptService);
```

---

### Incident Patch 5: `f449d6fe` (2026-09-18)
**Commit Message**: fix(docker): the server image could not build, and no gate could see it (#540)

`docker compose up --build` died in the Ghidra image:

    [ERROR] dependency: ghidra:Graph:jar:12.1.2 (test)
    [ERROR]     Could not find artifact ghidra:Graph:jar:12.1.2 in central

Ghidra is not on Maven Central, so four files hand-maintain a list of
`mvn install:install-file` calls: tests.yml, release.yml, pre-release.yml and
docker/Dockerfile. Four copies of one list, none derived from pom.xml, which is
what actually decides what the build needs. `ghidra:Graph` was added as a
dependency and three of the four were updated; docker/Dockerfile installed 15
jars against the pom's 16.

CI stayed green throughout, because nothing in CI builds the Docker image. The
only possible signal was a person running the documented command -- which is the
worst place to find out, and why the check added here is offline and free.

tests/unit/test_ghidra_jar_install_lists.py asserts every installer list COVERS
pom.xml's ghidra:* dependencies. Coverage rather than equality on purpose: the
workflows also install PDB and FunctionID, which the pom does not declare, and
an extra jar is harmless while a missing one cannot 

**File**: `CHANGELOG.md` (modified, +67/-0)
```diff
@@ -144,6 +144,73 @@ non-raising paths) and `tests/unit/test_setup_ghidra.py`
 `install_ghidra_dependencies` still raises). CONTRIBUTING.md's "known rough
 edge" paragraph is replaced by what the command now does.
 
+### Fixed — `docker/Dockerfile` could not build, and no gate could see it
+
+The documented Docker deployment did not work. `docker compose up --build` died
+in the server image:
+
+```text
+[ERROR] Failed to execute goal on project GhidraMCP: Could not resolve dependencies
+[ERROR] dependency: ghidra:Graph:jar:12.1.2 (test)
+[ERROR]     Could not find artifact ghidra:Graph:jar:12.1.2 in central
+```
+
+Ghidra is not on Maven Central, so four files hand-maintain a list of
+`mvn install:install-file` calls that stamp jars out of a Ghidra installation:
+`tests.yml`, `release.yml`, `pre-release.yml` and `docker/Dockerfile`. Four
+copies of one list, none derived from `pom.xml`, which is what actually decides
+what the build needs.
+
+`ghidra:Graph` was added as a dependency and three of the four were updated.
+`docker/Dockerfile` installed 15 jars against the pom's 16.
+
+**CI stayed green throughout, because nothing in CI builds the Docker image.**
+The only possible signal was a person running the documented command — which is
+the worst place to find out, and exactly why the check added here is offline and
+costs nothing.
+
+`tests/unit/test_ghidra_jar_install_lists.py` asserts every installer list
+*covers* `pom.xml`'s `ghidra:*` dependencies. Coverage rather than equality on
+purpose: the CI workflows also install `PDB` and `FunctionID`, which the pom
+does not declare, and an extra jar is harmless while a missing one is a build
+that cannot resolve.
+
+With the one missing line added, `docker compose up -d --build` was run for real
+and both containers reported healthy. Recorded because the previous entry could
+only promise it:
+
+```text
+Container ghidra-mcp          Healthy
+Container ghidra-mcp-bridge   Started
+
+ghidra-mcp-bridge   Up (healthy)
+ghidra-mcp          Up (healthy)   0.0.0.0:18089->8089/tcp, 0.0.0.0:18081->8081/tcp
+```
+
+The topology behaved as designed, and the container's own logs say why it works:
+
+```text
+Auto-connected via TCP to http://127.0.0.1:8089, registered 83 tools
+MCP endpoint: http://0.0.0.0:8081/mcp
+```
+
+- the bridge's `NetworkMode` is `container:38e338c76504…`, which is the
+  `ghidra-mcp` container's id — the namespace really is shared, which is what
+  makes `127.0.0.1:8089` mean Ghidra;
+- the bridge's own published ports are `map[]` — it publishes nothing, and both
+  host ports are on the `ghidra-mcp` service;
+- a real MCP client over the published port got `initialize` (protocol
+  `2025-11-25`), `tools/list` with **91 tools** (83 registered from the headless
+  server's schema plus the 8 static bridge tools), and
+  `tools/call list_open_programs` → `{"programs":[],"count":0}` — a true answer
+  for a container with nothing imported yet, not an error;
+- `GHIDRA_MCP_AUTH_TOKEN` is enforced end to end: **401** with no token, **200**
+  with the compose token, **401** with a wrong one.
+
+Host ports were remapped to 18089/18081 for that run only, because a live Ghidra
+already owned 8089 on the machine; container-side ports, and therefore
+everything above, are exactly as shipped.
+
 ### Fixed — a release could publish with the live regression never having run
 
 `release.yml` and `pre-release.yml` gated publishing on:
```

**File**: `docker/Dockerfile` (modified, +2/-0)
```diff
@@ -65,6 +65,8 @@ RUN mvn -q install:install-file -Dfile=/opt/ghidra/Ghidra/Framework/Generic/lib/
         -DgroupId=ghidra -DartifactId=DB -Dversion=${GHIDRA_VERSION} -Dpackaging=jar && \
     mvn -q install:install-file -Dfile=/opt/ghidra/Ghidra/Framework/Emulation/lib/Emulation.jar \
         -DgroupId=ghidra -DartifactId=Emulation -Dversion=${GHIDRA_VERSION} -Dpackaging=jar && \
+    mvn -q install:install-file -Dfile=/opt/ghidra/Ghidra/Framework/Graph/lib/Graph.jar \
+        -DgroupId=ghidra -DartifactId=Graph -Dversion=${GHIDRA_VERSION} -Dpackaging=jar && \
     mvn -q install:install-file -Dfile=/opt/ghidra/Ghidra/Debug/Debugger-api/lib/Debugger-api.jar \
         -DgroupId=ghidra -DartifactId=Debugger-api -Dversion=${GHIDRA_VERSION} -Dpackaging=jar && \
     mvn -q install:install-file -Dfile=/opt/ghidra/Ghidra/Debug/Framework-TraceModeling/lib/Framework-TraceModeling.jar \
```

**File**: `tests/unit/test_ghidra_jar_install_lists.py` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+"""Every place that hand-installs Ghidra jars must cover pom.xml's dependencies.
+
+Why this exists
+---------------
+Ghidra is not on Maven Central. Four files therefore carry a hand-maintained
+list of ``mvn install:install-file`` calls that stamp jars out of a Ghidra
+installation into a local repository: ``tests.yml``, ``release.yml``,
+``pre-release.yml`` and ``docker/Dockerfile``. Four copies of one list, none of
+them derived from ``pom.xml``, which is the thing that decides what the build
+actually needs.
+
+They drifted. ``ghidra:Graph`` became a dependency and three of the four were
+updated; ``docker/Dockerfile`` was not. The result:
+
+```text
+[ERROR] Failed to execute goal on project GhidraMCP: Could not resolve dependencies
+[ERROR] dependency: ghidra:Graph:jar:12.1.2 (test)
+[ERROR]     Could not find artifact ghidra:Graph:jar:12.1.2 in central
+```
+
+So ``docker build -f docker/Dockerfile`` — and therefore ``docker compose up``,
+and therefore the entire documented Docker deployment — could not succeed. **CI
+stayed green throughout**, because nothing in CI builds the Docker image. The
+only signal was a person actually running the documented command, which is the
+worst possible place to discover it and exactly why this check is cheap and
+offline.
+
+This asserts coverage, not equality: the CI workflows also install ``PDB`` and
+``FunctionID``, which the pom does not declare as dependencies. Extra jars are
+harmless; a missing one is a build that cannot resolve.
+"""
+
+from __future__ import annotations
+
+import pathlib
+import re
+
+import pytest
+
+REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
+POM = REPO_ROOT / "pom.xml"
+
+# Every file that hand-maintains an install-file list, relative to the repo.
+INSTALLERS = (
+    ".github/workflows/tests.yml",
+    ".github/workflows/release.yml",
+    ".github/workflows/pre-release.yml",
+    "docker/Dockerfile",
+)
+
+_POM_GHIDRA_DEP = re.compile(
+    r"<groupId>ghidra</groupId>\s*<artifactId>([^<]+)</artifactId>"
+)
+_INSTALLED_ARTIFACT = re.compile(r"-DartifactId=([A-Za-z0-9_.-]+)")
+
+
+def _pom_ghidra_dependencies() -> set[str]:
+    deps = set(_POM_GHIDRA_DEP.findall(POM.read_text(encoding="utf-8")))
+    assert deps, (
+        "no ghidra:* dependencies found in pom.xml. Either the build stopped "
+        "depending on Ghidra (in which case delete this guard) or the parse "
+        "broke -- and a guard that silently finds nothing to check is worse "
+        "than no guard."
+    )
+    return deps
+
+
+def _installed_artifacts(relative_path: str) -> set[str]:
+    text = (REPO_ROOT / relative_path).read_text(encoding="utf-8")
+    found = set(_INSTALLED_ARTIFACT.findall(text))
+    assert found, f"{relative_path} passes no -DartifactId= at all"
+    return found
+
+
+@pytest.mark.parametrize("installer", INSTALLERS)
+def test_installer_covers_every_ghidra_dependency(installer):
+    """A missing jar is a build that cannot resolve, wherever it runs."""
+    missing = sorted(_pom_ghidra_dependencies() - _installed_artifacts(installer))
+    assert not missing, (
+        f"{installer} never installs ghidra:{{{','.join(missing)}}}, which "
+        f"pom.xml declares as a dependency. Maven will fail with 'Could not "
+        f"find artifact ghidra:{missing[0]}:jar:<version> in central' -- Ghidra "
+        f"is not on Maven Central, so an artifact nothing install-files is "
+        f"simply absent.\n"
+        f"This is four hand-maintained copies of one list, and it has already "
+        f"drifted once: `Graph` was added to three of them and not to "
+        f"docker/Dockerfile, so the documented `docker compose up` could not "
+        f"build while CI stayed green -- nothing in CI builds that image."
+    )
+
+
+def test_every_installer_is_a_real_file():
+    """A renamed workflow must not silently drop out of the check."""
+    for installer in INSTALLERS:
+        assert (REPO_ROOT / installer).is_file(), (
+       
```

---

### Incident Patch 6: `9a55fd6b` (2026-09-18)
**Commit Message**: fix(setup): preflight aborted on a missing Maven it never uses (#533)

`python -m tools.setup preflight` -- the command CONTRIBUTING.md hands a
Python-only contributor to "check what you have", in a section that says
"Python-only changes need Java and Ghidra for nothing at all" -- exited 1 on a
machine with no Maven, printing one line and checking nothing else:

    $ python -m tools.setup preflight
    Unable to locate Maven. Install mvn or configure M2_HOME/USERPROFILE tools path.
    $ echo $?
    1

`cmd_preflight` resolved Maven via `find_maven_command()` before anything else,
whichever backend was selected. Nothing downstream needed it: preflight never
invokes `mvn`, `collect_preflight_issues` is Maven-free, and Gradle -- the
backend the docs have led with since #528 -- needs it for nothing. So the first
command a new contributor runs hard-failed for a reason that did not apply to
them, and #528 documented the rough edge rather than removing it.

Maven is now a REPORT LINE, not a gate. Absent, preflight prints
`Maven: not found (the Gradle backend does not need it)` plus the list of
commands that do need it, then continues through uv, the MCP spawn check, Java,
the versions a

**File**: `CHANGELOG.md` (modified, +53/-0)
```diff
@@ -91,6 +91,59 @@ Dockerfile nothing builds is a file, not a deployment.
   licence ([#487](https://github.com/bethington/ghidra-mcp/issues/487)), and
   two images nothing referenced were deleted.
 
+### Fixed — `preflight` aborted on a missing Maven it never uses
+
+`python -m tools.setup preflight` — the command CONTRIBUTING.md hands a
+**Python-only** contributor to "check what you have", in a section that says
+"Python-only changes need Java and Ghidra for nothing at all" — exited 1 on a
+machine with no Maven, printing one line and checking nothing else:
+
+```text
+$ python -m tools.setup preflight
+Unable to locate Maven. Install mvn or configure M2_HOME/USERPROFILE tools path.
+$ echo $?
+1
+```
+
+`cmd_preflight` resolved Maven via `find_maven_command()` before anything else,
+whichever backend was selected. Nothing downstream needed it: `preflight` never
+invokes `mvn`, `collect_preflight_issues` is Maven-free, and Gradle — the
+backend the docs lead with since
+[#528](https://github.com/bethington/ghidra-mcp/pull/528) — needs it for
+nothing. So the first command a new contributor runs hard-failed for a reason
+that did not apply to them, and the fix in #528 was to document the rough edge
+rather than remove it.
+
+Maven is now a **report line**, not a gate. Absent, it prints
+`Maven: not found (the Gradle backend does not need it)` plus the list of
+commands that do need it, and preflight continues through uv, the MCP spawn
+check, Java, the versions and the full Ghidra sweep. Present but running Java
+below 21 — the same class of problem — is likewise a warning, not an abort.
+
+**The hard failure stays where Maven is genuinely required**: `run_maven`
+(`build`, `clean`, `run-tests` under the Maven backend) and
+`install_ghidra_dependencies` (`ensure-prereqs`, `install-ghidra-deps`) both
+still call `find_maven_command()` and still refuse to start without it, with
+the same message. `find_maven_command()` keeps raising; the new
+`locate_maven_command()` is its non-raising counterpart, for callers that only
+report.
+
+Those refusals now read as refusals. Preflight names `build` as a command that
+needs Maven, and running it produced a Python **traceback** ending in
+`FileNotFoundError` — the message was there, but it looked like a crash in the
+tool rather than a "you need Maven for this". `find_maven_command()` raises
+`MavenNotFoundError` (a `FileNotFoundError` subclass, so every existing handler
+still catches it) and `tools.setup`'s entry point turns it into two lines and
+exit 1, naming the subcommand and the Gradle route.
+
+Pinned by `tests/unit/test_setup_cli.py` (preflight exits 0 with Maven
+unresolvable, names what actually needs Maven, writes nothing to stderr, and
+warns without failing on an old-Java Maven; plus the resolver's own raising and
+non-raising paths) and `tests/unit/test_setup_ghidra.py`
+(`collect_preflight_issues` stays Maven-free with no Maven on disk;
+`install_ghidra_dependencies` still raises). CONTRIBUTING.md's "known rough
+edge" paragraph is replaced by what the command now does.
+
 ### Fixed — a release could publish with the live regression never having run
 
 `release.yml` and `pre-release.yml` gated publishing on:
```

**File**: `CONTRIBUTING.md` (modified, +32/-9)
```diff
@@ -91,6 +91,8 @@ checks were skipped, which is the correct state for a Python-only contributor:
 Python: .../.venv/Scripts/python.exe
 Maven: .../mvn.cmd
 uv: available
+MCP client spawn commands:
+  ...                        (advisory; how your MCP client would spawn the bridge)
 Java: available on PATH
 Project version: 7.0.0
 Ghidra version from pom.xml: 12.1.2
@@ -100,12 +102,36 @@ No Ghidra path configured; skipped Ghidra-specific preflight checks.
 Add `--ghidra-path <dir>` to also validate the install and that its version
 matches `pom.xml`.
 
-**If you do not have Maven, that command exits 1** with a single line,
-`Unable to locate Maven. Install mvn or configure M2_HOME/USERPROFILE tools
-path.`, and reports nothing else — it locates Maven before it checks anything,
-even though Gradle is now the default backend and a Python-only contributor
-needs neither. Use the Gradle backend instead, which reports the same things and
-more:
+**If you do not have Maven, that command still exits 0.** Maven is a report
+line, not a gate: `preflight` never invokes it, and Gradle — the default
+backend — needs it for nothing, so a Python-only contributor gets the whole
+report anyway.
+
+```text
+Python: .../.venv/Scripts/python.exe
+Maven: not found (the Gradle backend does not need it)
+  Maven is required only by `tools.setup build|clean|run-tests` under the Maven backend
+  and by `ensure-prereqs`/`install-ghidra-deps`. To build without it: `./gradlew buildExtension`
+  or TOOLS_SETUP_BACKEND=gradle.
+uv: available
+...
+```
+
+A Maven that *is* installed but runs on Java below 21 is reported the same
+way — warned about, not fatal. The hard failure lives where Maven is actually
+needed: `tools.setup build`, `clean` and `run-tests` under the Maven backend,
+and `ensure-prereqs` / `install-ghidra-deps`, all of which shell out to `mvn`.
+Those exit 1 with a refusal naming the Gradle route:
+
+```text
+$ python -m tools.setup build
+Unable to locate Maven. Install mvn or configure M2_HOME/USERPROFILE tools path.
+`tools.setup build` runs Maven directly, so it cannot proceed without it.
+For the Java build, use `./gradlew buildExtension -PGHIDRA_INSTALL_DIR=<dir>` or set TOOLS_SETUP_BACKEND=gradle.
+```
+
+Preflight also runs through the Gradle backend, which covers the same ground
+from Gradle's own side and requires a Ghidra path:
 
 ```text
 TOOLS_SETUP_BACKEND=gradle python -m tools.setup preflight --ghidra-path <dir>
@@ -129,9 +155,6 @@ Write access: user extensions dir OK
 Preflight passed.
 ```
 
-The Maven-first ordering in the default backend's `preflight` is a known rough
-edge, not a requirement.
-
 ## Build
 
 Two Java backends are supported and both are maintained. **Gradle is the
```

**File**: `tests/unit/test_setup_cli.py` (modified, +265/-11)
```diff
@@ -779,26 +779,230 @@ def test_should_install_debugger_toggle_off():
     )
 
 
+# ===========================================================================
+# tools.setup.maven — resolution, raising and non-raising
+# ===========================================================================
+
+
+def test_locate_maven_command_returns_none_when_absent(monkeypatch):
+    from tools.setup import maven
+
+    monkeypatch.setattr(maven, "candidate_maven_commands", lambda: [Path("/nope/mvn")])
+    assert maven.locate_maven_command() is None
+
+
+def test_locate_maven_command_returns_first_existing_candidate(tmp_path, monkeypatch):
+    from tools.setup import maven
+
+    missing = tmp_path / "missing" / "mvn"
+    present = tmp_path / "mvn"
+    present.write_text("#!/bin/sh\n", encoding="utf-8")
+
+    monkeypatch.setattr(maven, "candidate_maven_commands", lambda: [missing, present])
+    assert maven.locate_maven_command() == present
+
+
+def test_find_maven_command_still_raises_with_the_documented_message(monkeypatch):
+    """The hard failure has to survive: build/ensure-prereqs depend on it."""
+    from tools.setup import maven
+
+    monkeypatch.setattr(maven, "candidate_maven_commands", lambda: [Path("/nope/mvn")])
+    with pytest.raises(FileNotFoundError) as excinfo:
+        maven.find_maven_command()
+
+    assert "Unable to locate Maven" in str(excinfo.value)
+    assert str(excinfo.value) == maven.MAVEN_NOT_FOUND_MESSAGE
+
+
+def test_detect_maven_java_major_reads_the_version_banner(monkeypatch):
+    from tools.setup import maven
+
+    monkeypatch.setattr(
+        maven.subprocess,
+        "run",
+        lambda *a, **kw: SimpleNamespace(
+            returncode=0,
+            stdout="Apache Maven 3.9.6\nJava version: 17.0.11, vendor: Eclipse\n",
+            stderr="",
+        ),
+    )
+    assert maven.detect_maven_java_major(Path("mvn")) == 17
+
+
+def test_detect_maven_java_major_is_none_when_maven_cannot_start(monkeypatch):
+    """A candidate that exists but will not execute must not raise out of preflight."""
+    from tools.setup import maven
+
+    def boom(*a, **kw):
+        raise OSError("not executable")
+
+    monkeypatch.setattr(maven.subprocess, "run", boom)
+    assert maven.detect_maven_java_major(Path("mvn")) is None
+
+
+def test_detect_maven_java_major_is_none_without_a_java_version_line(monkeypatch):
+    from tools.setup import maven
+
+    monkeypatch.setattr(
+        maven.subprocess,
+        "run",
+        lambda *a, **kw: SimpleNamespace(
+            returncode=0, stdout="Apache Maven 3.9.6\n", stderr=""
+        ),
+    )
+    assert maven.detect_maven_java_major(Path("mvn")) is None
+
+
+def test_ensure_maven_java_supported_rejects_old_java(monkeypatch):
+    from tools.setup import maven
+
+    monkeypatch.setattr(maven, "detect_maven_java_major", lambda command: 17)
+    assert maven.ensure_maven_java_supported(Path("mvn")) is False
+
+
+def test_ensure_maven_java_supported_accepts_unreadable_version(monkeypatch):
+    """Unknown is not "too old" -- refusing here would block a working build."""
+    from tools.setup import maven
+
+    monkeypatch.setattr(maven, "detect_maven_java_major", lambda command: None)
+    assert maven.ensure_maven_java_supported(Path("mvn")) is True
+
+
+def test_ensure_maven_java_supported_accepts_current_java(monkeypatch):
+    from tools.setup import maven
+
+    monkeypatch.setattr(
+        maven, "detect_maven_java_major", lambda command: maven.REQUIRED_JAVA_MAJOR
+    )
+    assert maven.ensure_maven_java_supported(Path("mvn")) is True
+
+
 # ===========================================================================
 # cmd_preflight — Maven backend
 # ===========================================================================
 
 
-def test_cmd_preflight_maven_missing_maven_returns_1(tmp_path, monkeypatch):
-    from tools.setup import cli
+def _stub_preflight_environment(cli, monkeypatch, tmp_path, *, java: bool = True):
+    """Wire th
```

**File**: `tests/unit/test_setup_ghidra.py` (modified, +61/-0)
```diff
@@ -566,6 +566,67 @@ def test_collect_preflight_issues_passes_with_required_files(
     assert issues == []
 
 
+def test_collect_preflight_issues_needs_no_maven(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+):
+    """The deep preflight body must stay Maven-free.
+
+    ``cmd_preflight`` reports Maven's absence instead of aborting on it, which
+    is only honest if nothing further down reintroduces the requirement. This
+    unresolves Maven for real -- no candidate on disk -- rather than stubbing a
+    locator, so a future ``find_maven_command()`` call added anywhere inside
+    ``collect_preflight_issues`` raises here instead of shipping.
+    """
+    ghidra_path = tmp_path / "ghidra_12.1_PUBLIC"
+    (ghidra_path / "Extensions" / "Ghidra").mkdir(parents=True)
+    (ghidra_path / "ghidraRun.bat").write_text("echo off\n", encoding="utf-8")
+    for _artifact_id, relative_path in REQUIRED_GHIDRA_JARS:
+        jar_path = ghidra_path / relative_path
+        jar_path.parent.mkdir(parents=True, exist_ok=True)
+        jar_path.write_text("jar", encoding="utf-8")
+
+    user_base = tmp_path / "user-ghidra"
+    (user_base / "ghidra_12.1_PUBLIC").mkdir(parents=True)
+    monkeypatch.setattr(
+        "tools.setup.ghidra.shutil.which",
+        lambda name: "java" if name == "java" else None,
+    )
+    monkeypatch.setattr(
+        "tools.setup.maven.candidate_maven_commands",
+        lambda: [tmp_path / "no-such-maven" / "mvn"],
+    )
+
+    issues = collect_preflight_issues(
+        tmp_path,
+        ghidra_path,
+        Path(sys.executable),
+        install_debugger=False,
+        strict=False,
+        user_base_dir=user_base,
+    )
+
+    assert issues == []
+
+
+def test_install_ghidra_dependencies_still_hard_fails_without_maven(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+):
+    """`ensure-prereqs` / `install-ghidra-deps` genuinely cannot proceed.
+
+    Relaxing preflight must not relax the commands that actually shell out to
+    ``mvn install:install-file``.
+    """
+    monkeypatch.setattr(
+        "tools.setup.maven.candidate_maven_commands",
+        lambda: [tmp_path / "no-such-maven" / "mvn"],
+    )
+
+    with pytest.raises(FileNotFoundError) as excinfo:
+        install_ghidra_dependencies(tmp_path, tmp_path / "ghidra_12.1_PUBLIC")
+
+    assert "Unable to locate Maven" in str(excinfo.value)
+
+
 def test_resolve_mcp_url_uses_env_url(tmp_path: Path):
     (tmp_path / ".env").write_text(
         "GHIDRA_MCP_URL=http://127.0.0.1:9999\n", encoding="utf-8"
```

**File**: `tools/setup/cli.py` (modified, +60/-10)
```diff
@@ -19,7 +19,14 @@
     start_ghidra,
 )
 from .python_env import detect_repo_root, find_repo_python
-from .maven import ensure_maven_java_supported, find_maven_command, run_gradle, run_maven
+from .maven import (
+    REQUIRED_JAVA_MAJOR,
+    MavenNotFoundError,
+    detect_maven_java_major,
+    locate_maven_command,
+    run_gradle,
+    run_maven,
+)
 from .requirements import (
     ensure_uv_available,
     execute_install_plan,
@@ -362,6 +369,43 @@ def cmd_verify_version(args: argparse.Namespace) -> int:
     return 0
 
 
+def _report_maven(maven_command: Path | None) -> None:
+    """Print Maven's status as a preflight report line. Never fails preflight.
+
+    ``preflight`` does not invoke Maven, and Gradle -- the backend the docs lead
+    with -- needs it for nothing, so a contributor who has no Maven must still
+    get the full report. Before this, ``find_maven_command()`` ran first and its
+    ``FileNotFoundError`` aborted the command after one line, which hard-failed
+    the "check what you have" step CONTRIBUTING.md hands a Python-only
+    contributor for a reason that does not apply to them.
+
+    The hard failure still lives where Maven is actually needed: ``run_maven``
+    (``build`` / ``clean`` / ``run-tests`` under the Maven backend) and
+    ``install_ghidra_dependencies`` (``ensure-prereqs`` /
+    ``install-ghidra-deps``) both call ``find_maven_command()``.
+    """
+    if maven_command is None:
+        print("Maven: not found (the Gradle backend does not need it)")
+        print(
+            "  Maven is required only by `tools.setup build|clean|run-tests` under the "
+            "Maven backend\n"
+            "  and by `ensure-prereqs`/`install-ghidra-deps`. To build without it: "
+            "`./gradlew buildExtension`\n"
+            "  or TOOLS_SETUP_BACKEND=gradle."
+        )
+        return
+
+    print(f"Maven: {maven_command}")
+    java_major = detect_maven_java_major(maven_command)
+    if java_major is not None and java_major < REQUIRED_JAVA_MAJOR:
+        print(
+            f"  WARNING: this Maven runs on Java {java_major}; Java "
+            f"{REQUIRED_JAVA_MAJOR}+ is required to build with it.\n"
+            f"  Set JAVA_HOME to a JDK {REQUIRED_JAVA_MAJOR} install, or build with "
+            "`./gradlew buildExtension`."
+        )
+
+
 def cmd_preflight(args: argparse.Namespace) -> int:
     repo_root = detect_repo_root()
     env_values = _load_repo_env(repo_root)
@@ -379,15 +423,8 @@ def cmd_preflight(args: argparse.Namespace) -> int:
         ghidra_path = _resolve_ghidra_path(repo_root, args.ghidra_path)
         return run_gradle(repo_root, ["preflight"], ghidra_path=ghidra_path)
 
-    try:
-        maven_command = find_maven_command()
-    except FileNotFoundError as exc:
-        print(str(exc), file=sys.stderr)
-        return 1
     print(f"Python: {python_executable}")
-    print(f"Maven: {maven_command}")
-    if not ensure_maven_java_supported(maven_command):
-        return 1
+    _report_maven(locate_maven_command())
     try:
         ensure_uv_available()
     except FileNotFoundError as exc:
@@ -578,4 +615,17 @@ def cmd_bump_version(args: argparse.Namespace) -> int:
 def main(argv: list[str] | None = None) -> int:
     parser = build_parser()
     args = parser.parse_args(argv)
-    return args.func(args)
+    try:
+        return args.func(args)
+    except MavenNotFoundError as exc:
+        # A refusal, not a crash. `preflight` now tells the reader which
+        # commands need Maven; those commands should answer in the same voice
+        # rather than with a traceback.
+        print(str(exc), file=sys.stderr)
+        print(
+            f"`tools.setup {args.command}` runs Maven directly, so it cannot proceed "
+            "without it.\nFor the Java build, use `./gradlew buildExtension "
+            "-PGHIDRA_INSTALL_DIR=<dir>` or set TOOLS_SETUP_BACKEND=gradle.",
+            file=sys.stderr,
+        )
+        return 1
```

---

### Incident Patch 7: `7ac79b98` (2026-09-18)
**Commit Message**: fix: install ghidratrace with uv (#451)

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -1231,6 +1231,9 @@ load-bearing: removing it turns 7 passing tests into 7 errors.
   Container user creation reclaims UID and GID 1000 from the base image and
   assigns them explicitly to `ghidra`, retaining the numeric ownership expected
   by persisted volumes.
+- **`ensure-prereqs` no longer requires `pip` inside a uv-managed environment.**
+  The optional Ghidra `ghidratrace` wheel is installed with `uv pip --python`,
+  so the debugger dependency sync works after `uv sync` removes unmanaged pip.
 - **`close_program` and auto-analysis could freeze the MCP server.** Both paths
   now stay responsive.
 - **`debugger_launch`** failed for reasons that had been misattributed to the
```

**File**: `tests/unit/test_setup_ghidra.py` (modified, +13/-7)
```diff
@@ -1423,7 +1423,7 @@ def test_install_ghidratrace_skips_when_no_wheel(
     assert "No ghidratrace wheel found" in capsys.readouterr().out
 
 
-def test_install_ghidratrace_dry_run_does_not_invoke_pip(
+def test_install_ghidratrace_dry_run_does_not_invoke_uv(
     tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys
 ):
     from tools.setup import ghidra
@@ -1451,7 +1451,7 @@ def fail_if_called(*_a, **_kw):
     assert "ghidratrace-12.1" in out
 
 
-def test_install_ghidratrace_invokes_pip_with_force_reinstall(
+def test_install_ghidratrace_invokes_uv_for_target_python(
     tmp_path: Path, monkeypatch: pytest.MonkeyPatch
 ):
     from tools.setup import ghidra
@@ -1463,6 +1463,7 @@ def test_install_ghidratrace_invokes_pip_with_force_reinstall(
     fake_py = tmp_path / "debugger-python.exe"
     fake_py.write_text("", encoding="utf-8")
     monkeypatch.setenv("GHIDRA_DEBUGGER_PYTHON", str(fake_py))
+    monkeypatch.setattr(ghidra, "uv_executable", lambda: "uv-test")
 
     invocations: list[list[str]] = []
 
@@ -1480,14 +1481,19 @@ def fake_run(cmd, **kwargs):
     )
     assert rc == 0
     assert len(invocations) == 2, (
-        "expected 2 pip invocations (protobuf + ghidratrace)"
+        "expected 2 uv invocations (protobuf + ghidratrace)"
     )
     # First: protobuf upgrade
-    assert invocations[0][0] == str(fake_py)
-    assert invocations[0][1:5] == ["-m", "pip", "install", "--upgrade"]
+    assert invocations[0][:5] == [
+        "uv-test", "pip", "install", "--python", str(fake_py)
+    ]
+    assert "--upgrade" in invocations[0]
     assert any("protobuf" in arg for arg in invocations[0])
-    # Second: ghidratrace --force-reinstall pointing at the bundled wheel
-    assert invocations[1][1:5] == ["-m", "pip", "install", "--force-reinstall"]
+    # Second: ghidratrace reinstall pointing at the bundled wheel
+    assert invocations[1][:5] == [
+        "uv-test", "pip", "install", "--python", str(fake_py)
+    ]
+    assert "--reinstall" in invocations[1]
     assert str(wheel) in invocations[1]
 
 
```

**File**: `tools/setup/ghidra.py` (modified, +28/-4)
```diff
@@ -19,6 +19,7 @@
 from tools.release_evidence import GATING_TIER
 from .envfile import load_env_file
 from .maven import find_maven_command
+from .requirements import uv_executable
 from .versioning import (
     infer_ghidra_install_meta,
     infer_ghidra_version_from_path,
@@ -2320,23 +2321,46 @@ def install_ghidratrace_for_debugger(
         print("  Could not resolve a debugger Python (set GHIDRA_DEBUGGER_PYTHON) — skipping")
         return 0
 
+    uv = uv_executable()
+    protobuf_command = [
+        uv,
+        "pip",
+        "install",
+        "--python",
+        str(debugger_python),
+        "--upgrade",
+        "protobuf>=6.31.0",
+    ]
+    ghidratrace_command = [
+        uv,
+        "pip",
+        "install",
+        "--python",
+        str(debugger_python),
+        "--reinstall",
+        str(wheel),
+    ]
+
     if dry_run:
-        print(f"DRY RUN: {debugger_python} -m pip install --force-reinstall {wheel}")
-        print(f"DRY RUN: {debugger_python} -m pip install --upgrade 'protobuf>=6.31.0'")
+        for command in (protobuf_command, ghidratrace_command):
+            print("DRY RUN:", end=" ")
+            print_command(command)
         return 0
 
     # protobuf>=6.31.0 is gated separately by ghidratrace.setuputils — install
     # it before the wheel so the post-install setuputils check doesn't trip.
+    # Use uv rather than ``python -m pip`` because uv-managed environments do
+    # not include pip unless the project declares it as a dependency.
     pb = subprocess.run(
-        [str(debugger_python), "-m", "pip", "install", "--upgrade", "protobuf>=6.31.0"],
+        protobuf_command,
         check=False, capture_output=True, text=True,
     )
     if pb.returncode != 0:
         print(f"  protobuf install failed: {pb.stderr.strip()[:200]}")
         return pb.returncode
 
     gt = subprocess.run(
-        [str(debugger_python), "-m", "pip", "install", "--force-reinstall", str(wheel)],
+        ghidratrace_command,
         check=False, capture_output=True, text=True,
     )
     if gt.returncode != 0:
```

---

### Incident Patch 8: `af4b83d6` (2026-09-18)
**Commit Message**: fix(params): keep empty nullable Boolean defaults unset (#448)

* fix(params): keep empty nullable Boolean defaults unset

Treat @Param(defaultValue = "") on boxed Boolean query/body values as unset (null), preserving explicit true and false.

* Add regression tests for boxed params with empty defaults

Add omitted, explicit true, and explicit false regression coverage for nullable boxed Boolean parameters across query and body coercion.

* Update CHANGELOG for v7.0.0 parameter coercion fixes

Added details about parameter coercion fixes in v7.0.0.Document the v7.0.0 fix for omitted tri-state Boolean filters.

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -505,6 +505,13 @@ compatibility) plus five that are a genuine backlog — and a companion test tha
 fails when an allowlist entry is finally wired up, so the list cannot outlive
 its own justification.
 
+### Parameter coercion fixes
+
+- Omitted nullable `Boolean` parameters whose annotation uses `defaultValue = ""`
+  now resolve to `null` for both query-string and JSON-body inputs. Previously,
+  the empty string was coerced to `false`, silently activating tri-state filters
+  such as `has_custom_name`, `is_thunk`, and `is_external`.
+
 ### Tool consolidation (breaking) — 272 → 251 tools
 
 Redundant tools were folded into "one-or-many" survivors. **No capability was
@@ -5348,3 +5355,4 @@ code = decompile_function(address='0x401000', offset=100, limit=100)
 ---
 
 For older release details, see the [docs/releases/](docs/releases/) directory.
+
```

**File**: `src/main/java/com/xebyte/core/AnnotationScanner.java` (modified, +9/-2)
```diff
@@ -350,7 +350,11 @@ private static Object resolveQueryParam(ParamBinding binding, Map<String, String
 
         } else if (type == Boolean.class) {
             if (value == null || value.isEmpty()) {
-                return hasDef ? Boolean.valueOf(def) : null;
+                // An EMPTY defaultValue means "no default" for a nullable tri-state
+                // filter, exactly as the String/Integer branches above treat it.
+                // Boolean.valueOf("") is false, so returning it here would turn an
+                // OMITTED filter into an active "== false" filter.
+                return (hasDef && !def.isEmpty()) ? Boolean.valueOf(def) : null;
             }
             return Boolean.parseBoolean(value);
 
@@ -419,7 +423,9 @@ private static Object resolveBodyParam(ParamBinding binding, Map<String, Object>
 
         } else if (type == Boolean.class) {
             if (raw == null) {
-                return hasDef ? Boolean.valueOf(def) : null;
+                // See the note in the query-string coercion above: an empty
+                // defaultValue means "unset", not "false".
+                return (hasDef && !def.isEmpty()) ? Boolean.valueOf(def) : null;
             }
             if (raw instanceof Boolean b) return b;
             return Boolean.parseBoolean(String.valueOf(raw));
@@ -629,3 +635,4 @@ record ParamBinding(Param param, Class<?> javaType, String[] aliases) {
         }
     }
 }
+
```

**File**: `src/test/java/com/xebyte/offline/AnnotationScannerOfflineTest.java` (modified, +129/-0)
```diff
@@ -234,6 +234,108 @@ public void testBoxedParamHonorsDefaultValue() throws Exception {
             Boolean.FALSE, fixture.lastBodyStrict);
     }
 
+    /**
+     * Regression test: a boxed param declared with an EMPTY {@code defaultValue}
+     * must resolve to {@code null} ("unset"), not to a concrete value.
+     *
+     * <p>This is the counterpart to the H13 fix above, which overcorrected. H13
+     * changed the boxed branches to {@code hasDef ? Boolean.valueOf(def) : null},
+     * but {@code hasDef} is true for {@code defaultValue = ""} (it only tests
+     * against the {@code NO_DEFAULT} sentinel), and {@code Boolean.valueOf("")}
+     * is {@code false}. Every nullable tri-state filter in the codebase is
+     * declared exactly that way — e.g. {@code has_custom_name}, {@code is_thunk},
+     * {@code is_external} on {@code /search_functions_enhanced}. The effect was
+     * that OMITTING such a filter silently applied it as {@code == false}:
+     * {@code search_functions_enhanced} with a name_pattern and no other args
+     * returned zero results for every user-named function, reporting a
+     * well-formed empty list rather than an error.
+     *
+     * <p>{@code Integer} was unaffected only by accident — {@code Integer.valueOf("")}
+     * throws {@code NumberFormatException}, which that branch already catches and
+     * turns into {@code null}. {@code Boolean.valueOf} never throws, so the Boolean
+     * branch failed silently. Both are asserted here so the behaviour is pinned
+     * explicitly rather than resting on a parse failure.
+     */
+    public void testBoxedParamWithEmptyDefaultResolvesToNull() throws Exception {
+        BoxedDefaultFixture fixture = new BoxedDefaultFixture();
+        AnnotationScanner fixtureScanner = new AnnotationScanner(fixture);
+
+        EndpointDef getEndpoint = null;
+        EndpointDef postEndpoint = null;
+        for (EndpointDef ep : fixtureScanner.getEndpoints()) {
+            if ("/test_empty_default_query".equals(ep.path())) getEndpoint = ep;
+            if ("/test_empty_default_body".equals(ep.path()))  postEndpoint = ep;
+        }
+        assertNotNull("GET empty-default fixture endpoint not found", getEndpoint);
+        assertNotNull("POST empty-default fixture endpoint not found", postEndpoint);
+
+        Map<String, String> emptyQuery = Collections.emptyMap();
+        Map<String, Object> emptyBody  = Collections.emptyMap();
+
+        fixture.lastOptFilter = Boolean.TRUE;   // poison, so a no-op write is visible
+        fixture.lastOptCount  = Integer.valueOf(-1);
+        getEndpoint.handler().handle(emptyQuery, emptyBody);
+        assertNull("QUERY: boxed Boolean with defaultValue=\"\" and absent value must be null (unset), "
+            + "not false — otherwise an omitted tri-state filter is applied as '== false'",
+            fixture.lastOptFilter);
+        assertNull("QUERY: boxed Integer with defaultValue=\"\" and absent value must be null",
+            fixture.lastOptCount);
+
+        fixture.lastBodyOptFilter = Boolean.TRUE;
+        fixture.lastBodyOptCount  = Integer.valueOf(-1);
+        postEndpoint.handler().handle(emptyQuery, emptyBody);
+        assertNull("BODY: boxed Boolean with defaultValue=\"\" and absent value must be null (unset), not false",
+            fixture.lastBodyOptFilter);
+        assertNull("BODY: boxed Integer with defaultValue=\"\" and absent value must be null",
+            fixture.lastBodyOptCount);
+    }
+
+    /**
+     * An EXPLICIT value must still win over the empty default, in both directions —
+     * the fix must not make these params unsettable.
+     */
+    public void testBoxedParamWithEmptyDefaultStillHonorsExplicitValue() throws Exception {
+        BoxedDefaultFixture fixture = new BoxedDefaultFixture();
+        AnnotationScanner fixtureScanner = new AnnotationScanner(fixture);
+
+        EndpointDef getEndpoint = null;
+        EndpointDef postEndpoint = null;
+        for (Endpoin
```

---

### Incident Patch 9: `b73d288a` (2026-09-18)
**Commit Message**: fix(docker): avoid fixed container user IDs (#449)

* fix(docker): avoid fixed container user IDs

* fix(docker): preserve ghidra UID and GID 1000

---------

Co-authored-by: Ben Ethington <benaminde@gmail.com>

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -1219,6 +1219,11 @@ load-bearing: removing it turns 7 passing tests into 7 errors.
 
 ### Fixed
 
+- **The headless Docker image builds on current Ubuntu Noble-based Temurin
+  images while preserving access to existing data and project volumes.**
+  Container user creation reclaims UID and GID 1000 from the base image and
+  assigns them explicitly to `ghidra`, retaining the numeric ownership expected
+  by persisted volumes.
 - **`close_program` and auto-analysis could freeze the MCP server.** Both paths
   now stay responsive.
 - **`debugger_launch`** failed for reasons that had been misattributed to the
```

**File**: `docker/Dockerfile` (modified, +12/-3)
```diff
@@ -136,9 +136,18 @@ RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh
 # it; /data and /projects are chown'd before the VOLUME declaration so the
 # anonymous volumes inherit ghidra ownership. HOME drives Java's user.home,
 # where Ghidra writes its per-user settings.
-RUN groupadd --gid 1000 ghidra \
-    && useradd --uid 1000 --gid 1000 --create-home --home-dir /home/ghidra ghidra \
-    && chown -R ghidra:ghidra /app /data /projects /home/ghidra
+# Preserve UID/GID 1000 for existing data and project volumes. Ubuntu Noble
+# reserves these IDs for its default ubuntu account, so reclaim them first.
+RUN set -eux; \
+    if getent passwd 1000 >/dev/null; then \
+        userdel --remove "$(getent passwd 1000 | cut -d: -f1)"; \
+    fi; \
+    if getent group 1000 >/dev/null; then \
+        groupdel "$(getent group 1000 | cut -d: -f1)"; \
+    fi; \
+    groupadd --gid 1000 ghidra; \
+    useradd --uid 1000 --gid 1000 --create-home --home-dir /home/ghidra ghidra; \
+    chown -R ghidra:ghidra /app /data /projects /home/ghidra
 ENV HOME=/home/ghidra
 USER ghidra
 
```

---

### Incident Patch 10: `9131a005` (2026-09-18)
**Commit Message**: fix: require bearer auth for exposed MCP bridge (#438)

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -1636,6 +1636,11 @@ whole 0-100 range and asserts no gated score bands.
 
 ### Security (pre-release hardening)
 
+- **Authenticated non-loopback MCP bridge.** When the bridge has
+  `GHIDRA_MCP_AUTH_TOKEN` and exposes its HTTP/SSE transport beyond loopback,
+  clients must present the same bearer token. This prevents the bridge from
+  acting as an unauthenticated confused deputy for its protected Ghidra server.
+
 - **Anti-CSRF / DNS-rebinding guard on the HTTP servers.** Loopback binding
   does not stop a web page the operator visits from issuing a cross-origin
   `fetch()` to `127.0.0.1` (responses are `text/plain` and bodies parse as JSON
```

**File**: `docs/prompts/TOOL_USAGE_GUIDE.md` (modified, +1/-1)
```diff
@@ -515,7 +515,7 @@ GhidraMCP defaults to localhost-unauthenticated — safe on a single-user dev bo
 
 The headless server refuses to start on a non-loopback bind address (`0.0.0.0`, explicit external IP) unless `GHIDRA_MCP_AUTH_TOKEN` is set.
 
-**The MCP bridge reads the same `GHIDRA_MCP_AUTH_TOKEN`** and attaches `Authorization: Bearer <token>` to every outbound call (UDS and TCP). Export the same token in the bridge's environment — otherwise it will hit `401 Unauthorized` on every tool call to an auth-enabled server. Unset = no header (matches the localhost default).
+**The MCP bridge reads the same `GHIDRA_MCP_AUTH_TOKEN`** and attaches `Authorization: Bearer <token>` to every outbound call (UDS and TCP). Export the same token in the bridge's environment — otherwise it will hit `401 Unauthorized` on every tool call to an auth-enabled server. When an HTTP/SSE bridge binds beyond loopback, clients must also send that bearer token to the bridge; unauthenticated requests receive `401 Unauthorized`. Unset = no header (matches the localhost default).
 
 ### Worked example — exposing to a private LAN with auth
 
```

**File**: `python/bridge_mcp_ghidra/cli.py` (modified, +35/-1)
```diff
@@ -1,6 +1,7 @@
 """Command-line entry point for the GhidraMCP bridge."""
 
 import argparse
+import hmac
 import os
 import re
 import socket
@@ -10,7 +11,7 @@
 from starlette.middleware.cors import CORSMiddleware
 
 from . import state
-from .config import logger
+from .config import AUTH_TOKEN, logger
 from .server import mcp
 from .static_tools import _auto_connect, _start_auto_connect_retry
 
@@ -154,6 +155,35 @@ def _cors_origin_regex(bind_host: str) -> str:
     return rf"^https?://({alternatives})(:\d+)?$"
 
 
+class _BearerAuthMiddleware:
+    """Require the backend bearer token from clients of an exposed bridge."""
+
+    def __init__(self, app, token: str):
+        self.app = app
+        self.expected = f"Bearer {token}".encode("utf-8")
+
+    async def __call__(self, scope, receive, send):
+        if scope["type"] == "http" and scope.get("method") != "OPTIONS":
+            headers = dict(scope.get("headers", ()))
+            supplied = headers.get(b"authorization", b"")
+            if not hmac.compare_digest(supplied, self.expected):
+                body = b"Unauthorized"
+                await send(
+                    {
+                        "type": "http.response.start",
+                        "status": 401,
+                        "headers": [
+                            (b"content-type", b"text/plain; charset=utf-8"),
+                            (b"content-length", str(len(body)).encode("ascii")),
+                            (b"www-authenticate", b"Bearer"),
+                        ],
+                    }
+                )
+                await send({"type": "http.response.body", "body": body})
+                return
+        await self.app(scope, receive, send)
+
+
 def _build_http_app(transport: str, bind_host: str):
     """Return the transport's Starlette app wrapped in CORS middleware.
 
@@ -173,6 +203,10 @@ def _build_http_app(transport: str, bind_host: str):
         expose_headers=["mcp-session-id", "mcp-protocol-version"],
         max_age=3600,
     )
+    if AUTH_TOKEN and bind_host not in {"127.0.0.1", "localhost", "::1"}:
+        # The bridge reuses this credential for its backend requests.  Do not
+        # let an unauthenticated network client turn it into a confused deputy.
+        app = _BearerAuthMiddleware(app, AUTH_TOKEN)
     return app
 
 
```

**File**: `tests/unit/test_bridge_cli.py` (modified, +44/-0)
```diff
@@ -301,6 +301,50 @@ def test_session_id_header_exposed_to_scripts(self):
         self.assertIn("mcp-session-id", cors[0].kwargs["expose_headers"])
 
 
+class TestBridgeBearerAuth(unittest.TestCase):
+    """An exposed bridge must not replay its backend token for strangers."""
+
+    def setUp(self):
+        from starlette.applications import Starlette
+        from starlette.responses import PlainTextResponse
+        from starlette.routing import Route
+        from starlette.testclient import TestClient
+
+        async def endpoint(_request):
+            return PlainTextResponse("proxied")
+
+        app = Starlette(routes=[Route("/mcp", endpoint, methods=["POST", "OPTIONS"])])
+        self.client = TestClient(cli._BearerAuthMiddleware(app, "bridge-secret"))
+
+    def test_missing_token_is_rejected(self):
+        response = self.client.post("/mcp")
+        self.assertEqual(response.status_code, 401)
+        self.assertEqual(response.headers["www-authenticate"], "Bearer")
+
+    def test_wrong_token_is_rejected(self):
+        response = self.client.post("/mcp", headers={"Authorization": "Bearer wrong"})
+        self.assertEqual(response.status_code, 401)
+
+    def test_matching_token_reaches_bridge(self):
+        response = self.client.post("/mcp", headers={"Authorization": "Bearer bridge-secret"})
+        self.assertEqual(response.status_code, 200)
+        self.assertEqual(response.text, "proxied")
+
+    def test_cors_preflight_does_not_require_credentials(self):
+        response = self.client.options("/mcp")
+        self.assertNotEqual(response.status_code, 401)
+
+    def test_remote_http_app_is_wrapped_when_backend_token_is_set(self):
+        with patch.object(cli, "AUTH_TOKEN", "bridge-secret"):
+            app = cli._build_http_app("streamable-http", "0.0.0.0")
+        self.assertIsInstance(app, cli._BearerAuthMiddleware)
+
+    def test_loopback_http_app_preserves_local_unauthenticated_access(self):
+        with patch.object(cli, "AUTH_TOKEN", "bridge-secret"):
+            app = cli._build_http_app("streamable-http", "127.0.0.1")
+        self.assertNotIsInstance(app, cli._BearerAuthMiddleware)
+
+
 class TestWildcardAllowedHosts(unittest.TestCase):
     def test_includes_loopbacks_with_port_wildcards(self):
         hosts = cli._wildcard_allowed_hosts()
```

#### Recent Merged Pull Requests:
- **PR #552** (2026-09-29): docs(claude): drop two test paths removed with tests/performance (@roli-lpci)
- **PR #543** (2026-09-24): release: merge dev into main for 7.0.0-rc.1 (@bethington)
- **PR #541** (2026-09-22): fix: /delete_function threw CME on tagged functions, dry-run made it worse (@bethington)
- **PR #540** (2026-09-18): fix(docker): the server image could not build, and no gate could see it (@bethington)
- **PR #539** (2026-09-19): release: merge dev into main for 7.0.0 (@bethington)
- **PR #538** (2026-09-18): ci(markdown): make the documentation gate actually gate (@bethington)
- **PR #537** (2026-09-18): docs(changelog): drop the trailing blank line three merges left behind (@bethington)
- **PR #536** (2026-09-19): test(offline): re-record /mcp/schema, closing the four-endpoint contract hole (@bethington)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
