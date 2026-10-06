# Forensic Learning Record (Deep Inspection): bethington/ghidra-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/bethington-ghidra-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bethington/ghidra-mcp](https://github.com/bethington/ghidra-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:01:38.528Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bethington/ghidra-mcp`
- **Description**: Ghidra MCP Server — 200+ MCP tools for AI-powered reverse engineering. GUI plugin + headless server, lazy tool loading, convention enforcement, batch operations, Ghidra Server integration, and Docker deployment.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4325 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `python/bridge_mcp_ghidra/state.py`
```
"""Mutable connection and tool-registration state shared across the bridge.

All cross-module readers and writers reference these names through this module
object (e.g. ``state._transport_mode``) so a single source of truth is mutated.
Functions in other modules never use ``global`` on these names — they assign
``state.<name> = ...`` instead.
"""

import asyncio
import atexit
import concurrent.futures
import contextvars
import os
import threading
from dataclasses import dataclass
from functools import partial
from contextlib import contextmanager

from .config import CORE_GROUPS, MAX_CONCURRENT_GHIDRA_REQUESTS, logger

# --------------------------------------------------------------------------
# Connection state
# --------------------------------------------------------------------------

_active_socket: str | None = None  # UDS socket path
_active_tcp: str | None = None  # TCP base URL (e.g. "http://127.0.0.1:8089")
_transport_mode: str = "none"  # "uds", "tcp", or "none"
_connected_project: str | None = None  # Project name for auto-reconnect
_connection_generation = 0
_executor_lock = threading.Lock()


@dataclass(frozen=True)
class ConnectionSnapshot:
    mode: str
    active_socket: str | None
    active_tcp: str | None
    connected_project: str | None
    generation: int


class RequestCancelHandle:
    """Shared cancellation handle for one in-flight worker request."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._aborted = False
        self._connections: set[object] = set()

    def register_connection(self, conn: object) -> bool:
        with self._lock:
            if self._aborted:
                try:
                    conn.close()
                except Exception:
                    pass
                return False
            self._connections.add(conn)
            return True

    def unregister_connection(self, conn: object) -> None:
        with self._lock:
            self._connections.discard(conn)

    def abort(self) -> None:
        with self._lock:
            self._aborted = True
            conns = list(self._connections)
        for conn in conns:
            try:
                conn.close()
            except Exception:
                pass

    @property
    def aborted(self) -> bool:
        with self._lock:
            return self._aborted

    def run_if_not_aborted(self, func, /, *args, **kwargs):
        """Run a small critical section only if the request is still live."""
        with self._lock:
            if self._aborted:
                return None
            return func(*args, **kwargs)

    @contextmanager
    def hold_send_window(self, conn: object):
        """Prevent abort() from closing `conn` while a request send starts."""
        with self._lock:
            if self._aborted or conn not in self._connections:
                yield False
            else:
                yield True


def _create_worker_pool() -> concurrent.futures.ThreadPoolExecutor:
    return concurrent.futures.ThreadPoolExecutor(
        max_workers=MAX_CONCURRENT_GHIDRA_REQUESTS,
        thread_name_prefix="GhidraMCP-Bridge",
    )


# Shared worker pool for blocking bridge-side I/O. The executor itself is the
# process-wide concurrency limit, so embedded/multi-loop use cannot exceed the
# configured request cap.
_ghidra_executor = _create_worker_pool()

# Connection routing is captured at request admission time and propagated via a
# context variable into the worker thread.
_request_connection: contextvars.ContextVar[ConnectionSnapshot | None] = contextvars.ContextVar(
    "ghidra_request_connection", default=None
)
_request_cancel_handle: contextvars.ContextVar[RequestCancelHandle | None] = contextvars.ContextVar(
    "ghidra_request_cancel_handle", default=None
)

# Multiple failed in-flight requests can notice the same Ghidra restart. Schema
# discovery and dynamic tool registration mutate shared state and must happen
# once at a time even though normal HTTP requests may proceed concurrently.
_reconnect_lock = threading.RLock()

# Dynamic tool registration reaches into FastMCP internals and mutates shared
# name/group state. Keep those mutations serialized even though normal Ghidra
# requests are concurrent.
_tool_registry_lock = threading.RLock()
_tools_changed_session_lock = threading.Lock()
_tools_changed_targets: list[tuple[asyncio.AbstractEventLoop, object]] = []
_active_request_handles_lock = threading.Lock()
_active_request_handles: set[RequestCancelHandle] = set()

# --------------------------------------------------------------------------
# Strict program routing
# --------------------------------------------------------------------------

# When GHIDRA_MCP_REQUIRE_PROGRAM_SELECTORS=1, the bridge refuses any
# program-scoped call that omits a program selector, so a forgotten one fails
# loudly instead of silently running against the server's mutable "current
# program" and hitting the wrong binary. Off by default. (Full rationale in
# commit 6f85c5e / README.)
_require_selectors: bool = False


def _init_require_selectors() -> None:
    """Read GHIDRA_MCP_REQUIRE_PROGRAM_SELECTORS once, at import. Set it to 1 to enable."""
    global _require_selectors
    _require_selectors = (os.getenv("GHIDRA_MCP_REQUIRE_PROGRAM_SELECTORS") or "").strip() == "1"
    if _require_selectors:
        logger.info(
            "Strict program routing enabled (GHIDRA_MCP_REQUIRE_PROGRAM_SELECTORS=1); "
            "program-scoped calls missing a program selector will be refused"
        )


_init_require_selectors()


def get_connection_snapshot() -> ConnectionSnapshot:
    """Capture the current global connection target atomically."""
    with _reconnect_lock:
        return ConnectionSnapshot(
            mode=_transport_mode,
            active_socket=_active_socket,
            active_tcp=_active_tcp,
            connected_project=_connected_project,
            generation=_connection_generation,
        )


def get_request_connection_snapshot() -> ConnectionSnapshot | None:
    """Get the request-bound connection snapshot, if one is active."""
    return _request_connection.get()


def get_request_cancel_handle() -> RequestCancelHandle | None:
    """Get the request-bound cancellation handle, if one is active."""
    return _request_cancel_handle.get()


def set_connection_snapshot(
    mode: str,
    *,
    active_socket: str | None = None,
    active_tcp: str | None = None,
    connected_project: str | None = None,
) -> ConnectionSnapshot:
    """Install a new global connection target and advance the generation."""
    global _active_socket, _active_tcp, _transport_mode, _connected_project, _connection_generation
    with _reconnect_lock:
        _active_socket = active_socket
        _active_tcp = active_tcp
        _transport_mode = mode
        _connected_project = connected_project
        _connection_generation += 1
        return ConnectionSnapshot(
            mode=_transport_mode,
            active_socket=_active_socket,
            active_tcp=_active_tcp,
            connected_project=_connected_project,
            generation=_connection_generation,
        )


def maybe_promote_connection_snapshot(
    previous: ConnectionSnapshot, candidate: ConnectionSnapshot
) -> ConnectionSnapshot | None:
    """Install `candidate` only if the global connection still equals `previous`."""
    global _active_socket, _active_tcp, _transport_mode, _connected_project, _connection_generation
    with _reconnect_lock:
        current = ConnectionSnapshot(
            mode=_transport_mode,
            active_socket=_active_socket,
            active_tcp=_active_tcp,
            connected_project=_connected_project,
            generation=_connection_generation,
        )
        if current != previous:
            return None
        _active_socket = candidate.active_socket
        _active_tcp = candidate.active_tcp
        _transport_mode = candidate.mode
        _connected_project = candidate.connected_project
        _connection_generation += 1
        return ConnectionSnapshot(
            mode=_transport_mode,
            active_socket=_active_socket,
            active_tcp=_active_tcp,
            connected_project=_connected_project,
            generation=_connection_generation,
        )


def build_connection_snapshot(
    *,
    mode: str,
    active_socket: str | None = None,
    active_tcp: str | None = None,
    connected_project: str | None = None,
    generation: int = 0,
) -> ConnectionSnapshot:
    """Construct an explicit connection snapshot without mutating global state."""
    return ConnectionSnapshot(
        mode=mode,
        active_socket=active_socket,
        active_tcp=active_tcp,
        connected_project=connected_project,
        generation=generation,
    )


def _capture_request_connection_snapshot() -> ConnectionSnapshot:
    """Capture a request-bound snapshot atomically with route/schema switches."""
    with _tool_registry_lock:
        return get_connection_snapshot()


def remember_tools_changed_session(session) -> None:
    """Remember one MCP session that can receive tools/list_changed.

    Must be called from the session's own event loop — the loop is captured
    here so a worker thread can later dispatch the notification back onto it.

    Registration used to happen ONLY inside connect_instance/load_tool_group/
    unload_tool_group/import_file, which are tools the client has to call
    first. That made the whole notification path dead in the one situation it
    exists for: a bridge started BEFORE Ghidra registers 35 static tools, the
    background retry succeeds seconds later and calls
    notify_tools_changed_from_worker() — into an EMPTY target list, because no
    static tool had been invoked yet. The client is never told, so the session
    runs to its end showing 35 of 273 tools while Ghidra is healthy. Capturing
    at tools/list (see server.py) fixes that: every client lists tools right
    after i
```

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
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2QuestDataStrc *":
                try:
                    arg.setName("pQuestData", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2SeedStrc *":
                try:
                    arg.setName("pSeed", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2MonsterRegionStrc *":
                try:
                    arg.setName("pMonsterRegion", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2MonsterRegionStrc * *":
                try:
                    arg.setName("ppMonsterRegion", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "eD2ItemTypes":
                try:
                    arg.setName("eItemType", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2UnitStrc *":
                try:
                    arg.setName("pUnit", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "D2NetDataStrc *":
                try:
                    arg.setName("pNetData", SourceType.USER_DEFINED)
                except DuplicateNameException:
                    c = c - 1
                c = c + 1
            if "{}".format(arg.getDataType()) == "eD2LevelId":
                tr
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

### Core Architecture Module: `ghidra_scripts/signfunction.py`
```
#Sign Function
#
#This script adds a standardized function header comment for the Diablo 2 reverse engineering team.
#The header includes date, author (from Ghidra username), function name, address, and existing description.
#If the function uses custom variable storage, it appends a note listing all custom register parameters.
#Bound to F6 for quick function documentation during reverse engineering sessions.
#
#@author Ben Ethington
#@category Diablo 2
#@description Adds standardized function header comment with date, author, and custom register documentation
#@keybinding F6
#@menupath Diablo II.Sign Function

from ghidra.util.exception import CancelledException, InvalidInputException
from datetime import date

today = date.today()
nick = ghidra.framework.client.ClientUtil.getUserName()

def main():
    func = currentProgram.functionManager.getFunctionContaining(currentAddress);
    
    comment = func.getComment();
    if comment:
      comment = filter(lambda x: '@description: ' in x, comment.splitlines())
    if comment and len(comment) > 0:
        comment = comment[0].split('@description: ')[1]
    else:
        comment = ""
    
    func.setComment("""Diablo 2 1.14d reverse team
https://blizzhackers.dev
        
@Date: {}
@Author: {}
@Function: {}
@Address: {}.0x{}
@description: {}""".format(today.strftime("%Y.%m.%d"), nick, func.getName(), currentProgram.getName().rsplit(".",1)[0], func.getEntryPoint(), comment))
        
    if func.hasCustomVariableStorage():
        s = ""
        for arg in func.getParameters():
            s = s + "\n{}".format(arg)
        func.setComment("{}\n\nFunction uses custom registers for function arguments!{}".format(func.getComment(), s))
                
try:
    main()
except CancelledException:
    pass

```

### Core Architecture Module: `python/bridge_mcp_ghidra/__init__.py`
```
"""GhidraMCP Bridge — thin MCP↔HTTP multiplexer.

On startup: exposes list_instances + connect_instance (plus tool-group and
debugger proxy tools). On connect_instance: fetches /mcp/schema from the Ghidra
server and dynamically registers every analysis tool as a generic HTTP
dispatcher.

Supports two transports to Ghidra:
  - UDS (Unix domain sockets) — preferred for local instances
  - TCP (HTTP) — fallback for headless/remote servers

This package was split out of the historical single-file ``bridge_mcp_ghidra.py``.
The public names below are re-exported for backwards compatibility; mutable
runtime state lives in :mod:`bridge_mcp_ghidra.state` and must be read/written
through that module.
"""

# Import submodules in dependency order. Importing static_tools and debugger
# runs their mcp tool decorators, registering the static tools on the server
# — matching the original single-module import-time behavior.
from . import config  # noqa: F401
from . import state  # noqa: F401
from . import server  # noqa: F401
from . import validation  # noqa: F401
from . import transport  # noqa: F401
from . import discovery  # noqa: F401
from . import schema  # noqa: F401
from . import dispatch  # noqa: F401
from . import registry  # noqa: F401
from . import static_tools  # noqa: F401
from . import debugger  # noqa: F401
from . import oracle  # noqa: F401
from . import cli  # noqa: F401

# --- Public re-exports (backwards-compatible flat API) --------------------

from .config import (  # noqa: F401
    CORE_GROUPS,
    DEBUGGER_URL,
    DEBUGGER_TOOL_NAMES,
    ORACLE_TOOL_NAMES,
    ORACLE_URL,
    DEFAULT_TCP_PORT,
    DEFAULT_TCP_URL,
    ENDPOINT_TIMEOUTS,
    MAX_CONCURRENT_GHIDRA_REQUESTS,
    MAX_REQUEST_TIMEOUT_SECONDS,
    MANAGEMENT_TOOL_NAMES,
    STATIC_TOOL_NAMES,
    TCP_PORT_SCAN_RANGE,
    REQUEST_TIMEOUT_GRACE_SECONDS,
    _ALL_STATIC_TOOL_NAMES,
    logger,
)
from .server import Context, mcp  # noqa: F401
from .validation import (  # noqa: F401
    HEX_ADDRESS_PATTERN,
    MAX_TOOL_NAME_LENGTH,
    SEGMENT_ADDR_WITH_0X_PATTERN,
    SEGMENT_ADDRESS_PATTERN,
    TOOL_NAME_PATTERN,
    _allocate_tool_name,
    is_pid_alive,
    sanitize_address,
    sanitize_tool_name,
    validate_hex_address,
    validate_server_url,
    validate_tool_name,
)
from .transport import (  # noqa: F401
    RequestNotSentError,
    RequestOutcomeUnknownError,
    UnixHTTPConnection,
    do_request,
    get_socket_dir,
    get_socket_dir_candidates,
    tcp_request,
    uds_request,
)
from .discovery import (  # noqa: F401
    _scan_tcp_for_project,
    _unwrap_response_data,
    discover_active_tcp_instance,
    discover_instances,
)
from .schema import _normalize_tool_def_names, _parse_schema  # noqa: F401
from .dispatch import (  # noqa: F401
    _ensure_connected,
    _try_reconnect,
    dispatch_get,
    dispatch_post,
    get_timeout,
)
from .registry import (  # noqa: F401
    _build_tool_function,
    _fetch_and_register_schema,
    _get_group_info,
    _load_group,
    _notify_tools_changed,
    _register_tool_def,
    _unload_group,
    register_tools_from_schema,
)
from .static_tools import (  # noqa: F401
    _auto_connect,
    _start_auto_connect_retry,
    check_tools,
    connect_instance,
    import_file,
    list_instances,
    list_tool_groups,
    load_tool_group,
    search_tools,
    unload_tool_group,
)
from .oracle import (  # noqa: F401
    _ORACLE_ACTIVE,
    _oracle_enabled,
    _oracle_request,
    _oracle_tool,
    _calling_enabled,
    oracle_call_function,
    oracle_modules,
    oracle_prove_function,
    oracle_read_memory,
    oracle_status,
)
from .debugger import (  # noqa: F401
    _DEBUGGER_ACTIVE,
    _debugger_enabled,
    _debugger_request,
    _debugger_tool,
    debugger_attach,
    debugger_continue,
    debugger_detach,
    debugger_list_breakpoints,
    debugger_modules,
    debugger_read_args,
    debugger_read_memory,
    debugger_registers,
    debugger_remove_breakpoint,
    debugger_resolve_ordinal,
    debugger_set_breakpoint,
    debugger_stack_trace,
    debugger_status,
    debugger_step_into,
    debugger_step_over,
    debugger_trace_function,
    debugger_trace_list,
    debugger_trace_log,
    debugger_trace_stop,
    debugger_watch_log,
    debugger_watch_memory,
    debugger_watch_stop,
)

# These two are only ever mutated in place (clear/append/add/discard), so the
# re-exported references stay valid. Reassigned state (_transport_mode,
# _active_socket, _full_schema, _lazy_mode, …) is intentionally NOT re-exported
# here — read/write it through ``bridge_mcp_ghidra.state`` to avoid stale binds.
from .state import _dynamic_tool_names, _loaded_groups  # noqa: F401

from .cli import main  # noqa: F401

try:
    from importlib.metadata import version as _pkg_version

    __version__ = _pkg_version("ghidra-mcp-bridge")
except Exception:  # running from source without an installed distribution
    __version__ = "7.0.0"

```

### Core Architecture Module: `python/bridge_mcp_ghidra/__main__.py`
```
"""Enable ``python -m bridge_mcp_ghidra``."""

from .cli import main

if __name__ == "__main__":
    main()

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

### Incident Patch 1: `3a3ece01` (2026-10-01)
**Commit Message**: fix(bridge): the oracle proxy tools declare their annotations

The five oracle tools register only where the in-process oracle can
exist (Windows, or a remote URL), so the Linux test jobs never saw them
and the Windows job failed both static-tool checks: every static tool
declares readOnlyHint/destructiveHint and no fake output schema.

status, modules and read_memory are read-only. call_function and
prove_function execute real code in the live game, which the module
calls its dangerous half, so they are destructive.

Claude-Session: https://claude.ai/code/session_01FNRMtY3ocPVd7kxcUGi2X6

**File**: `python/bridge_mcp_ghidra/oracle.py` (modified, +12/-6)
```diff
@@ -46,7 +46,13 @@
 
 from . import state
 from . import config
-from .config import ORACLE_URL, ORACLE_TOOL_NAMES, logger
+from .config import (
+    DESTRUCTIVE_TOOL,
+    ORACLE_TOOL_NAMES,
+    ORACLE_URL,
+    READ_ONLY_TOOL,
+    logger,
+)
 from .server import mcp
 from .validation import validate_server_url
 
@@ -178,7 +184,7 @@ def _oracle_request(
         conn.close()
 
 
-@_oracle_tool()
+@_oracle_tool(annotations=READ_ONLY_TOOL, structured_output=False)
 def oracle_status() -> str:
     """Check whether the live game + in-process oracle are up, and what they hold.
 
@@ -193,7 +199,7 @@ def oracle_status() -> str:
     return _oracle_request("GET", "/status")
 
 
-@_oracle_tool()
+@_oracle_tool(annotations=READ_ONLY_TOOL, structured_output=False)
 def oracle_modules() -> str:
     """List every module loaded in the LIVE game, with its RUNTIME base address.
 
@@ -214,7 +220,7 @@ def oracle_modules() -> str:
     return _oracle_request("GET", "/modules")
 
 
-@_oracle_tool()
+@_oracle_tool(annotations=READ_ONLY_TOOL, structured_output=False)
 def oracle_read_memory(module: str, rva: str, length: int = 256) -> str:
     """Read raw bytes out of the LIVE game process (no elevation, no suspend).
 
@@ -317,7 +323,7 @@ def oracle_read_memory(module: str, rva: str, length: int = 256) -> str:
     )
 
 
-@_oracle_tool()
+@_oracle_tool(annotations=DESTRUCTIVE_TOOL, structured_output=False)
 def oracle_call_function(
     module: str,
     rva: str,
@@ -416,7 +422,7 @@ def oracle_call_function(
     )
 
 
-@_oracle_tool()
+@_oracle_tool(annotations=DESTRUCTIVE_TOOL, structured_output=False)
 def oracle_prove_function(spec: str) -> str:
     """Differentially prove one function: call the ORIGINAL and D2MOO's REIMPL and diff.
 
```

---

### Incident Patch 2: `a9edc068` (2026-10-01)
**Commit Message**: fix(bridge): a rejection reports its reason, not just its code

failure_message returned the bare `error` field, so a rename_symbol
refusal surfaced as "name_quality" with the server's explanation and
suggestion dropped. Join error, message and suggestion.

Claude-Session: https://claude.ai/code/session_01FNRMtY3ocPVd7kxcUGi2X6

**File**: `python/bridge_mcp_ghidra/dispatch.py` (modified, +15/-10)
```diff
@@ -55,16 +55,21 @@ def failure_message(text: str) -> str | None:
         return None
 
     error = payload.get("error")
-    if isinstance(error, str) and error.strip():
-        return error
-    if payload.get("success") is False or payload.get("status") == "rejected":
-        # These carry their reason in `message` when there is no `error`.
-        for key in ("error", "message", "status"):
-            value = payload.get(key)
-            if isinstance(value, str) and value.strip():
-                return value
-        return "the server reported failure"
-    return None
+    failed = (isinstance(error, str) and error.strip()) or payload.get("success") is False \
+        or payload.get("status") == "rejected"
+    if not failed:
+        return None
+    # A rejection carries a short code in `error` (``name_quality``) and the reason in
+    # `message` and `suggestion`; reporting the code alone left the caller guessing why.
+    parts = []
+    for key in ("error", "message", "suggestion"):
+        value = payload.get(key)
+        if isinstance(value, str) and value.strip() and value.strip() not in parts:
+            parts.append(value.strip())
+    if parts:
+        return " — ".join(parts)
+    status = payload.get("status")
+    return status if isinstance(status, str) and status.strip() else "the server reported failure"
 
 
 def raise_on_failure(text: str) -> str:
```

**File**: `tests/unit/test_mcp_tools.py` (modified, +9/-0)
```diff
@@ -602,6 +602,15 @@ def test_rejected_status_is_a_failure(self):
         msg = self._msg('{"status": "rejected", "error": "first line too short"}')
         self.assertEqual(msg, "first line too short")
 
+    def test_a_rejection_reports_its_reason_not_just_its_code(self):
+        """Found live: rename_symbol's rejection reached the caller as a bare
+        "name_quality", its message and suggestion dropped."""
+        msg = self._msg('{"status": "rejected", "error": "name_quality", '
+                        '"issue": "missing_g_prefix", '
+                        '"message": "Global \'x\' must start with \'g_\'.", '
+                        '"suggestion": "Prepend g_."}')
+        self.assertEqual(msg, "name_quality — Global 'x' must start with 'g_'. — Prepend g_.")
+
     def test_successful_payloads_are_not_failures(self):
         for body in (
             '{"status": "success", "message": "renamed"}',
```

---

### Incident Patch 3: `98d4a5ec` (2026-08-06)
**Commit Message**: fix(scripts): stop run_script_inline poisoning its own script directory

Ghidra records "these files failed to compile" per script directory and
keeps replaying those errors — prefixed onto the output of every LATER
script, surviving both deletion of the file and a Ghidra restart. So one
failed script poisons the whole directory until its record is cleared.

The pre-cleanup only swept McpInline_* names. But `className` comes from
the caller's own `public class Foo`, so a failed script declaring its own
class left Foo.java + Foo.java_failed behind permanently, and the prefix
filter skipped them forever. Found three such orphans (Find830,
FindHwInitByMmioXrefs, InlineImportGoXLR) blocking a real scripts
directory; every inline run there came back with another script's compile
errors pasted on top.

The oracle is written only by this code path, so its presence proves the
.java alongside it is ours — that makes sweeping any oracle-backed name
safe, which is the fix. The 60-second orphan fallback stays restricted to
generated names, because for a caller-chosen name there is no provenance
and the file may be the operator's own.

Also refuse to overwrite an existing .java that has no orac

**File**: `src/main/java/com/xebyte/core/ProgramScriptService.java` (modified, +74/-33)
```diff
@@ -2648,41 +2648,19 @@ public Response runScriptInline(
         File scriptsDir = new File(System.getProperty("user.home"), "ghidra_scripts");
         scriptsDir.mkdirs();
 
-        // Pre-cleanup: remove stale McpInline_*.java files so Ghidra's per-directory
-        // build state doesn't contaminate this run's output with old failures.
-        //
-        // Three cases handled:
-        //  1. Oracle exists (McpInline_*.java_failed)  → confirmed failure from a
-        //     previous run; delete both the .java and the oracle immediately.
-        //  2. No oracle, file older than 60 s          → crash-orphaned (server died
-        //     before the oracle could be written); delete as a safe fallback.
-        //  3. No oracle, file is fresh                 → likely a concurrent parallel
-        //     agent; leave it alone.
-        // Also purge any orphaned oracles whose .java has already been deleted.
-        long now = System.currentTimeMillis();
-        File[] staleJava = scriptsDir.listFiles(
-            (d, n) -> n.startsWith("McpInline_") && n.endsWith(".java"));
-        if (staleJava != null) {
-            for (File stale : staleJava) {
-                File oracle = new File(scriptsDir, stale.getName() + "_failed");
-                if (oracle.exists()) {
-                    oracle.delete();
-                    stale.delete();
-                } else if (now - stale.lastModified() > 60_000L) {
-                    stale.delete();
-                }
-            }
-        }
-        File[] orphanOracles = scriptsDir.listFiles(
-            (d, n) -> n.startsWith("McpInline_") && n.endsWith(".java_failed"));
-        if (orphanOracles != null) {
-            for (File o : orphanOracles) {
-                String javaName = o.getName().substring(0, o.getName().length() - "_failed".length());
-                if (!new File(scriptsDir, javaName).exists()) o.delete();
-            }
-        }
+        purgeStaleInlineScripts(scriptsDir, System.currentTimeMillis());
 
         File tempScript = new File(scriptsDir, className + ".java");
+        // Refuse to clobber a script this service did not create. `className` comes
+        // from the caller's own `public class Foo`, so without this check an inline
+        // script named after an existing hand-written script silently overwrites it.
+        // A leftover of ours is already gone by now (purge above), so anything still
+        // standing here belongs to the operator.
+        if (tempScript.exists()) {
+            return Response.err("Refusing to overwrite " + tempScript.getName()
+                + " in " + scriptsDir + ": that file was not created by /run_script_inline. "
+                + "Rename the class in your code, or remove the file if it is disposable.");
+        }
 
         // Capture response so the finally block can decide success vs failure.
         Response[] responseHolder = {null};
@@ -2747,6 +2725,69 @@ public Response runScriptInline(
         }
     }
 
+    /** How long an oracle-less inline script may linger before it is presumed orphaned. */
+    public static final long INLINE_SCRIPT_ORPHAN_AGE_MS = 60_000L;
+
+    /**
+     * Remove inline scripts left behind by earlier runs, so Ghidra's per-directory build
+     * state stops replaying their compile errors.
+     *
+     * <p>Ghidra caches "these files failed to compile" per script directory and keeps
+     * reporting them — the stale errors are prefixed onto the output of <em>every</em>
+     * later script, and they survive deleting the file and even restarting Ghidra. So a
+     * single failed script poisons the whole directory until its record is cleared.
+     *
+     * <p>Cases handled, for <em>any</em> class name rather than only {@code McpInline_*}:
+     * <ol>
+     *   <li>An oracle ({@code X.java_failed}) exists → a confirmed failure of ours. Only
+     *       this method writes oracles, so an oracle proves {@code X.java} was written by
+     *       {@code /run_script_inline}; delete both. This is the case that used to be
+     *       missed: a script declaring {@code public class Foo} produced {@code Foo.java},
+     *       which the old {@code McpInline_} prefix filter skipped forever.</li>
+     *   <li>No oracle, name is ours, older than {@link #INLINE_SCRIPT_ORPHAN_AGE_MS} →
+     *       crash-orphaned before the oracle could be written; delete. Restricted to
+     *       generated names, since for a caller-chosen name there is no provenance and
+     *       the file may be the operator's own.</li>
+     *   <li>No oracle, fresh → likely a concurrent run; leave alone.</li>
+     * </ol>
+     * Orphaned oracles whose {@code .java} is already gone are purged too.
+     *
+     * <p>Static, and side-effect-scoped to {@code scriptsDir}, so {@code InlineScriptCleanupTest}
+     * can drive it against a temporary directory. Public only because the offline tests live
+     * in {@code com.xebyte.offline}; it is not part of t
```

**File**: `src/test/java/com/xebyte/offline/InlineScriptCleanupTest.java` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+package com.xebyte.offline;
+
+import com.xebyte.core.ProgramScriptService;
+import junit.framework.TestCase;
+
+import java.io.File;
+import java.nio.file.Files;
+import java.util.List;
+
+/**
+ * {@code /run_script_inline} must not poison its own script directory.
+ *
+ * <p>Ghidra records "these files failed to compile" per script directory and keeps
+ * replaying those errors — prefixed onto the output of every <em>later</em> script, and
+ * surviving both deletion of the file and a Ghidra restart. The old cleanup only swept
+ * {@code McpInline_*}, so a script that declared its own {@code public class Foo} left
+ * {@code Foo.java} + {@code Foo.java_failed} behind permanently and corrupted every
+ * subsequent inline run. Three such orphans were found blocking a real scripts directory.
+ *
+ * <p>Runs fully offline — pure filesystem, no Ghidra.
+ */
+public class InlineScriptCleanupTest extends TestCase {
+
+    private File dir;
+
+    @Override
+    protected void setUp() throws Exception {
+        dir = Files.createTempDirectory("mcp-scripts-test").toFile();
+    }
+
+    @Override
+    protected void tearDown() {
+        File[] leftovers = dir.listFiles();
+        if (leftovers != null) {
+            for (File f : leftovers) f.delete();
+        }
+        dir.delete();
+    }
+
+    private File write(String name, String body) throws Exception {
+        File f = new File(dir, name);
+        Files.writeString(f.toPath(), body);
+        return f;
+    }
+
+    /** The regression: a caller-named script with an oracle must be swept. */
+    public void testCallerNamedFailureIsRemoved() throws Exception {
+        File script = write("Find830.java", "public class Find830 {}");
+        File oracle = write("Find830.java_failed", "{\"error\":\"boom\"}");
+
+        ProgramScriptService.purgeStaleInlineScripts(dir, System.currentTimeMillis());
+
+        assertFalse("caller-named .java with an oracle must be deleted", script.exists());
+        assertFalse("its oracle must be deleted too", oracle.exists());
+    }
+
+    /** The case that already worked; keep it working. */
+    public void testGeneratedNameFailureIsRemoved() throws Exception {
+        File script = write("McpInline_abc123.java", "public class McpInline_abc123 {}");
+        File oracle = write("McpInline_abc123.java_failed", "fail");
+
+        ProgramScriptService.purgeStaleInlineScripts(dir, System.currentTimeMillis());
+
+        assertFalse(script.exists());
+        assertFalse(oracle.exists());
+    }
+
+    /**
+     * An operator's own script must never be deleted. Without an oracle there is no
+     * evidence the service created it, and for a caller-chosen name there is no
+     * provenance at all — so age alone must not condemn it.
+     */
+    public void testHandWrittenScriptIsNeverTouched() throws Exception {
+        File mine = write("AnalyzeFlashBle.java", "public class AnalyzeFlashBle {}");
+        assertTrue(mine.setLastModified(System.currentTimeMillis() - 400L * 24 * 3600 * 1000));
+
+        ProgramScriptService.purgeStaleInlineScripts(dir, System.currentTimeMillis());
+
+        assertTrue("a months-old hand-written script must survive", mine.exists());
+    }
+
+    /** A generated name with no oracle is crash-orphaned once it is old enough. */
+    public void testCrashOrphanedGeneratedScriptIsRemovedWhenStale() throws Exception {
+        File orphan = write("McpInline_dead.java", "public class McpInline_dead {}");
+        long old = System.currentTimeMillis()
+            - ProgramScriptService.INLINE_SCRIPT_ORPHAN_AGE_MS - 5_000L;
+        assertTrue(orphan.setLastModified(old));
+
+        ProgramScriptService.purgeStaleInlineScripts(dir, System.currentTimeMillis());
+
+        assertFalse(orphan.exists());
+    }
+
+    /** A fresh generated file may belong to a concurrent run — leave it alone. */
+    public void testFreshGeneratedScriptSurvives() throws Exception {
+        File fresh = write("McpInline_live.java", "public class McpInline_live {}");
+
+        ProgramScriptService.purgeStaleInlineScripts(dir, System.currentTimeMillis());
+
+        assertTrue("a concurrent run's file must not be swept", fresh.exists());
+    }
+
+    /** An oracle whose script is already gone would otherwise accumulate forever. */
+    public void testOrphanedOracleIsPurgedForAnyName() throws Exception {
+        File oracle = write("SomeUserClass.java_failed", "stale");
+
+        List<String> removed = ProgramScriptService.purgeStaleInlineScripts(
+            dir, System.currentTimeMillis());
+
+        assertFalse(oracle.exists());
+        assertTrue(removed.contains("SomeUserClass.java_failed"));
+    }
+
+    /** Sweeping an empty or absent directory must not throw. */
+    public void testEmptyAndMissingDirectoryAreSafe() {
+        assertTrue(ProgramScriptService.purgeStaleInlineScripts(
+            dir, System.currentTimeMillis()).isEmpty());
+        assertTrue(ProgramScriptServic
```

---

### Incident Patch 4: `72769fe7` (2026-08-06)
**Commit Message**: fix(bridge): stop advertising prompts and resources capabilities

The handshake claimed both, then answered prompts/list and resources/list
with empty arrays — FastMCP registers handlers for them whether or not
anything is registered, so clients rendered dead sections for features this
bridge does not provide.

Gated on emptiness rather than hardcoded off: the capability comes back on
its own if a prompt or resource is ever registered, so this cannot silently
hide a future feature. The methods still answer if a client calls them
anyway, which is friendlier than a method-not-found.

**File**: `python/bridge_mcp_ghidra/server.py` (modified, +24/-1)
```diff
@@ -16,9 +16,32 @@
 
 
 def _patched_init_options(**kwargs):
-    return _orig_init_options(
+    options = _orig_init_options(
         notification_options=NotificationOptions(tools_changed=True), **kwargs
     )
+    _drop_unimplemented_capabilities(options)
+    return options
+
+
+def _drop_unimplemented_capabilities(options) -> None:
+    """Stop advertising `prompts` and `resources` while there are none.
+
+    FastMCP registers handlers for both unconditionally, so the handshake
+    claimed both capabilities and then answered `prompts/list` and
+    `resources/list` with empty arrays — clients render dead sections for
+    features this bridge does not provide. Gated on emptiness rather than
+    hardcoded off, so the capability reappears by itself if a prompt or
+    resource is ever registered.
+    """
+    capabilities = getattr(options, "capabilities", None)
+    if capabilities is None:  # pragma: no cover - SDK shape changed
+        return
+    if not mcp._prompt_manager.list_prompts():
+        capabilities.prompts = None
+    resources = mcp._resource_manager.list_resources()
+    templates = mcp._resource_manager.list_templates()
+    if not resources and not templates:
+        capabilities.resources = None
 
 
 mcp._mcp_server.create_initialization_options = _patched_init_options
```

---

### Incident Patch 5: `f4a534d1` (2026-08-06)
**Commit Message**: fix(bridge): stop advertising an outputSchema no tool honours

Every tool declared outputSchema {"result": {"type": "string"}} and
returned structuredContent {"result": "<the json>"} — FastMCP's automatic
wrapper for a '-> str' return. A declared outputSchema is a promise about
response shape, and this one promised a structured object whose single
field is an opaque string: a client reading `result` still had to parse the
JSON itself, so the schema bought nothing and misdescribed the tool.

structured_output=False on all of them (dynamic, static, debugger proxies),
so no schema is claimed and the body stays the text content it always was.
Real per-tool schemas need response shapes declared server-side, which no
endpoint does yet — and the shapes are genuinely mixed (Ok returns objects,
some endpoints return top-level arrays, Text returns plain text for
paginated listings), so a single blanket schema would just be a different
false promise.

Guarded by a test, since the fake schema comes back automatically the
moment structured_output is dropped.

**File**: `python/bridge_mcp_ghidra/debugger.py` (modified, +22/-22)
```diff
@@ -159,7 +159,7 @@ def _debugger_request(
         conn.close()
 
 
-@_debugger_tool(annotations=WRITE_TOOL)
+@_debugger_tool(annotations=WRITE_TOOL, structured_output=False)
 def debugger_attach(target: str) -> str:
     """Attach the debugger to a running process for live dynamic analysis.
 
@@ -218,19 +218,19 @@ def debugger_attach(target: str) -> str:
     return result
 
 
-@_debugger_tool(annotations=DESTRUCTIVE_TOOL)
+@_debugger_tool(annotations=DESTRUCTIVE_TOOL, structured_output=False)
 def debugger_detach() -> str:
     """Detach from the debugged process. The process continues running."""
     return _debugger_request("POST", "/debugger/detach")
 
 
-@_debugger_tool(annotations=READ_ONLY_TOOL)
+@_debugger_tool(annotations=READ_ONLY_TOOL, structured_output=False)
 def debugger_status() -> str:
     """Get debugger connection status, loaded modules, active traces/watches."""
     return _debugger_request("GET", "/debugger/status")
 
 
-@_debugger_tool(annotations=READ_ONLY_TOOL)
+@_debugger_tool(annotations=READ_ONLY_TOOL, structured_output=False)
 def debugger_modules() -> str:
     """List loaded modules (DLLs) with runtime and Ghidra base addresses.
 
@@ -240,7 +240,7 @@ def debugger_modules() -> str:
     return _debugger_request("GET", "/debugger/modules")
 
 
-@_debugger_tool(annotations=READ_ONLY_TOOL)
+@_debugger_tool(annotations=READ_ONLY_TOOL, structured_output=False)
 def debugger_resolve_ordinal(dll: str, ordinal: int) -> str:
     """Resolve a DLL ordinal export to its runtime and Ghidra addresses.
 
@@ -254,7 +254,7 @@ def debugger_resolve_ordinal(dll: str, ordinal: int) -> str:
     return _debugger_request("GET", "/debugger/ordinal", query={"dll": dll, "ordinal": str(ordinal)})
 
 
-@_debugger_tool(annotations=WRITE_TOOL)
+@_debugger_tool(annotations=WRITE_TOOL, structured_output=False)
 def debugger_set_breakpoint(
     ghidra_address: str,
     module: str = "",
@@ -281,7 +281,7 @@ def debugger_set_breakpoint(
     )
 
 
-@_debugger_tool(annotations=DESTRUCTIVE_TOOL)
+@_debugger_tool(annotations=DESTRUCTIVE_TOOL, structured_output=False)
 def debugger_remove_breakpoint(bp_id: int) -> str:
     """Remove a breakpoint by its ID.
 
@@ -291,13 +291,13 @@ def debugger_remove_breakpoint(bp_id: int) -> str:
     return _debugger_request("DELETE", f"/debugger/breakpoint/{bp_id}")
 
 
-@_debugger_tool(annotations=READ_ONLY_TOOL)
+@_debugger_tool(annotations=READ_ONLY_TOOL, structured_output=False)
 def debugger_list_breakpoints() -> str:
     """List all active breakpoints with their addresses and status."""
     return _debugger_request("GET", "/debugger/breakpoints")
 
 
-@_debugger_tool(annotations=WRITE_TOOL)
+@_debugger_tool(annotations=WRITE_TOOL, structured_output=False)
 def debugger_continue() -> str:
     """Resume execution of the debugged process.
 
@@ -307,7 +307,7 @@ def debugger_continue() -> str:
     return _debugger_request("POST", "/debugger/go")
 
 
-@_debugger_tool(annotations=WRITE_TOOL)
+@_debugger_tool(annotations=WRITE_TOOL, structured_output=False)
 def debugger_step_into(count: int = 1) -> str:
     """Single-step into the next instruction(s). Follows calls.
 
@@ -317,7 +317,7 @@ def debugger_step_into(count: int = 1) -> str:
     return _debugger_request("POST", "/debugger/step_into", {"count": count})
 
 
-@_debugger_tool(annotations=WRITE_TOOL)
+@_debugger_tool(annotations=WRITE_TOOL, structured_output=False)
 def debugger_step_over(count: int = 1) -> str:
     """Step over the next instruction(s). Steps over calls.
 
@@ -327,7 +327,7 @@ def debugger_step_over(count: int = 1) -> str:
     return _debugger_request("POST", "/debugger/step_over", {"count": count})
 
 
-@_debugger_tool(annotations=READ_ONLY_TOOL)
+@_debugger_tool(annotations=READ_ONLY_TOOL, structured_output=False)
 def debugger_registers() -> str:
     """Read all CPU registers. Must be stopped at a breakpoint.
 
@@ -336,7 +336,7 @@ def debugger_registers() -> str:
     return _debugger_request("GET", "/debugger/registers")
 
 
-@_debugger_tool(annotations=READ_ONLY_TOOL)
+@_debugger_tool(annotations=READ_ONLY_TOOL, structured_output=False)
 def debugger_read_memory(address: str, size: int = 64, address_type: str = "runtime", module: str = "") -> str:
     """Read memory from the debugged process.
 
@@ -360,7 +360,7 @@ def debugger_read_memory(address: str, size: int = 64, address_type: str = "runt
     )
 
 
-@_debugger_tool(annotations=READ_ONLY_TOOL)
+@_debugger_tool(annotations=READ_ONLY_TOOL, structured_output=False)
 def debugger_stack_trace(depth: int = 20) -> str:
     """Get the call stack backtrace with return addresses mapped to Ghidra symbols.
 
@@ -370,7 +370,7 @@ def debugger_stack_trace(depth: int = 20) -> str:
     return _debugger_request("GET", "/debugger/stack", query={"depth": str(depth)})
 
 
-@_debugger_tool(annotations=READ_ONLY_TOOL)
+@_debugger_tool(annotations=READ_ONLY_TOOL, structured_
```

**File**: `python/bridge_mcp_ghidra/registry.py` (modified, +15/-1)
```diff
@@ -273,7 +273,21 @@ async def handler(**kwargs):
     handler.__name__ = name
     handler.__doc__ = description
 
-    mcp.tool(name=name, description=description, annotations=_tool_annotations(tool_def))(handler)
+    mcp.tool(
+        name=name,
+        description=description,
+        annotations=_tool_annotations(tool_def),
+        # Every tool here returns the server's response body as text. Left to
+        # infer from the `-> str` annotation, FastMCP declares
+        # outputSchema {"result": {"type": "string"}} and wraps the body in
+        # structuredContent {"result": "<the json>"} — a structured shape whose
+        # single field is an opaque string. That advertises a contract the tool
+        # does not have; a client reading `result` still has to parse the JSON
+        # itself. Declaring truthful per-tool output schemas needs response
+        # shapes described on the Java side, which no endpoint does yet, so the
+        # honest option is to declare none.
+        structured_output=False,
+    )(handler)
     state._dynamic_tool_names.append(name)
     return True
 
```

**File**: `python/bridge_mcp_ghidra/static_tools.py` (modified, +8/-8)
```diff
@@ -213,7 +213,7 @@ def _load_groups_sync(group_names: list[str]) -> list[str]:
     return loaded
 
 
-@mcp.tool(name="list_instances", annotations=READ_ONLY_TOOL)
+@mcp.tool(name="list_instances", annotations=READ_ONLY_TOOL, structured_output=False)
 async def _list_instances_tool() -> str:
     """
     List known Ghidra instances from UDS discovery and the active TCP fallback.
@@ -261,7 +261,7 @@ def _summarize_instance(inst: dict) -> dict:
     return summary
 
 
-@mcp.tool(annotations=WRITE_TOOL)
+@mcp.tool(annotations=WRITE_TOOL, structured_output=False)
 async def connect_instance(
     project: Annotated[str, Field(description="Project name (or substring) to connect to")],
     ctx: Context | None = None,
@@ -294,7 +294,7 @@ async def connect_instance(
     return json.dumps(result)
 
 
-@mcp.tool(annotations=READ_ONLY_TOOL)
+@mcp.tool(annotations=READ_ONLY_TOOL, structured_output=False)
 def list_tool_groups() -> str:
     """
     List all available tool groups with their tool counts and loaded status.
@@ -308,7 +308,7 @@ def list_tool_groups() -> str:
     return json.dumps({"groups": groups, "total_tools": len(state._full_schema)}, indent=2)
 
 
-@mcp.tool(annotations=WRITE_TOOL)
+@mcp.tool(annotations=WRITE_TOOL, structured_output=False)
 async def load_tool_group(
     group: Annotated[str, Field(description='Category name (e.g. "function", "datatype") or "all"')],
     ctx: Context | None = None,
@@ -381,7 +381,7 @@ def _notify_if_changed(result):
     )
 
 
-@mcp.tool(annotations=WRITE_TOOL)
+@mcp.tool(annotations=WRITE_TOOL, structured_output=False)
 async def unload_tool_group(
     group: Annotated[str, Field(description="Category name to unload")],
     ctx: Context | None = None,
@@ -419,7 +419,7 @@ async def unload_tool_group(
     )
 
 
-@mcp.tool(annotations=READ_ONLY_TOOL)
+@mcp.tool(annotations=READ_ONLY_TOOL, structured_output=False)
 async def check_tools(
     tools: Annotated[
         str,
@@ -487,7 +487,7 @@ async def check_tools(
     )
 
 
-@mcp.tool(annotations=READ_ONLY_TOOL)
+@mcp.tool(annotations=READ_ONLY_TOOL, structured_output=False)
 async def search_tools(
     query: Annotated[
         str,
@@ -549,7 +549,7 @@ async def search_tools(
     )
 
 
-@mcp.tool(annotations=WRITE_TOOL)
+@mcp.tool(annotations=WRITE_TOOL, structured_output=False)
 async def import_file(
     file_path: Annotated[str, Field(description="Absolute path to the binary file on disk")],
     project_folder: Annotated[
```

**File**: `tests/unit/test_mcp_tools.py` (modified, +46/-0)
```diff
@@ -680,6 +680,52 @@ def test_dynamic_tool_call_returns_a_successful_body_unchanged(self):
                 state._dynamic_tool_names.remove(name)
 
 
+class TestNoFakeOutputSchema(unittest.TestCase):
+    """No tool may advertise an output schema it does not have.
+
+    Every tool returns the server's response body as text. Inferred from the
+    `-> str` annotation, FastMCP declares outputSchema
+    {"result": {"type": "string"}} and wraps the body in structuredContent
+    {"result": "<the json>"} — a structured shape whose one field is an opaque
+    string, so a client reading `result` still has to parse the JSON. Truthful
+    per-tool schemas need response shapes declared server-side; until then none
+    is the honest answer, hence structured_output=False everywhere.
+    """
+
+    def test_static_tools_declare_no_output_schema(self):
+        from bridge_mcp_ghidra import config
+        from bridge_mcp_ghidra.server import mcp
+
+        offenders = []
+        for name in sorted(config.STATIC_TOOL_NAMES):
+            tool = mcp._tool_manager._tools.get(name)
+            if tool is not None and tool.output_schema is not None:
+                offenders.append(name)
+        self.assertEqual(offenders, [])
+
+    def test_dynamic_tool_declares_no_output_schema(self):
+        from bridge_mcp_ghidra import state
+        from bridge_mcp_ghidra.registry import _register_tool_def
+        from bridge_mcp_ghidra.server import mcp
+
+        name = "output_schema_probe_tool"
+        try:
+            _register_tool_def({
+                "name": name,
+                "endpoint": "/probe",
+                "http_method": "GET",
+                "description": "probe",
+                "input_schema": {"type": "object", "properties": {}},
+                "read_only": True,
+                "destructive": False,
+            })
+            self.assertIsNone(mcp._tool_manager._tools[name].output_schema)
+        finally:
+            mcp._tool_manager._tools.pop(name, None)
+            if name in state._dynamic_tool_names:
+                state._dynamic_tool_names.remove(name)
+
+
 class TestStaticToolsAreAllClassified(unittest.TestCase):
     def test_every_static_tool_declares_annotations(self):
         """A static tool with no annotations is unusable while planning."""
```

---

### Incident Patch 6: `6433a7a2` (2026-08-06)
**Commit Message**: fix(bridge): report tool failures as isError instead of as success

Every failure the bridge or the server can produce arrives as an ordinary
200 body — Response.Err renders {"error": ...} and dispatch builds the
same shape for transport errors, non-200 statuses and "no Ghidra instance
connected" — and the bridge returned it as a normal tool result with
isError unset. A client or agent loop that branches on isError saw every
call succeed; only schema-validation errors (raised by FastMCP itself) ever
set the flag. The model was left inferring failure from the word "error"
inside a JSON string.

dispatch.failure_message() recognises the three shapes actually in use.
Two of them come back through Response.ok, because a write refused by the
naming conventions returns {"status": "rejected", ...} and a failed
program load returns {"success": false, ...}. Detection deliberately
stops at the top level: /get_bulk_xrefs reports "No instruction at
address" inside a per-entry object and that call did succeed, so a nested
error must stay a success.

Verified on the wire: a failed call comes back isError=true with the
server's message, a successful one keeps isError=false and its payload
byte-fo

**File**: `python/bridge_mcp_ghidra/dispatch.py` (modified, +60/-0)
```diff
@@ -15,6 +15,66 @@
 )
 
 
+class GhidraToolError(Exception):
+    """A tool call that failed, so FastMCP can mark the result ``isError``.
+
+    Every failure the bridge or the server can report arrives as a normal HTTP
+    200 body — ``Response.Err`` renders ``{"error": ...}``, and dispatch builds
+    the same shape for transport failures, non-200 statuses and "not connected".
+    Returning that string as a successful tool result made a failure
+    indistinguishable from success at the protocol level: clients and agent
+    loops that branch on ``isError`` saw every call succeed, and the model had
+    to notice the word "error" inside the JSON. Raising is how FastMCP is told
+    otherwise.
+    """
+
+
+def failure_message(text: str) -> str | None:
+    """Return the error message if this response body reports a failure.
+
+    Recognises the three shapes this server uses. Two of them come back through
+    ``Response.ok``, since a rejected write or a failed program load is reported
+    as a well-formed payload rather than an ``Err``:
+
+    * ``{"error": "..."}``            — ``Response.Err`` and the bridge's own failures
+    * ``{"success": false, ...}``     — e.g. /load_program_from_project diagnostics
+    * ``{"status": "rejected", ...}`` — e.g. a plate comment refused by convention
+
+    A top-level list, plain text, or an ``error`` nested inside a per-item entry
+    (``/get_bulk_xrefs`` reports "No instruction at address" that way) is not a
+    call failure and must stay a success.
+    """
+    stripped = text.strip() if text else ""
+    if not stripped.startswith("{"):
+        return None
+    try:
+        payload = json.loads(stripped)
+    except (ValueError, UnicodeDecodeError):
+        return None
+    if not isinstance(payload, dict):
+        return None
+
+    error = payload.get("error")
+    if isinstance(error, str) and error.strip():
+        return error
+    if payload.get("success") is False or payload.get("status") == "rejected":
+        # These carry their reason in `message` when there is no `error`.
+        for key in ("error", "message", "status"):
+            value = payload.get(key)
+            if isinstance(value, str) and value.strip():
+                return value
+        return "the server reported failure"
+    return None
+
+
+def raise_on_failure(text: str) -> str:
+    """Pass a successful body through; raise ``GhidraToolError`` on a failed one."""
+    message = failure_message(text)
+    if message is not None:
+        raise GhidraToolError(message)
+    return text
+
+
 def get_timeout(endpoint: str, payload: dict | None = None) -> int:
     """Get timeout for an endpoint, with dynamic scaling for batch ops."""
     name = endpoint.strip("/").split("/")[-1]
```

**File**: `python/bridge_mcp_ghidra/registry.py` (modified, +4/-1)
```diff
@@ -263,7 +263,10 @@ async def handler(**kwargs):
         # FastMCP calls synchronous tools directly on its event loop. Keep the
         # blocking Ghidra HTTP lifecycle in a worker thread so one slow request
         # cannot close or starve the entire MCP session.
-        return await state.run_blocking_ghidra_call(sync_handler, **kwargs)
+        result = await state.run_blocking_ghidra_call(sync_handler, **kwargs)
+        # Failures arrive as an ordinary 200 body; raising is what makes the
+        # tool result carry isError instead of looking like a success.
+        return dispatch.raise_on_failure(result)
 
     handler.__signature__ = sync_handler.__signature__
     handler.__annotations__ = sync_handler.__annotations__
```

**File**: `python/bridge_mcp_ghidra/static_tools.py` (modified, +3/-0)
```diff
@@ -605,6 +605,9 @@ async def import_file(
         payload["compiler_spec"] = compiler_spec
 
     result = await state.run_blocking_ghidra_call(dispatch.dispatch_post, "/import_file", payload)
+    # A refused import is a failed tool call, not a successful one that happens
+    # to contain the word "error" (see dispatch.raise_on_failure).
+    dispatch.raise_on_failure(result)
 
     # Parse result to check if analysis was started
     try:
```

**File**: `tests/unit/test_mcp_tools.py` (modified, +111/-0)
```diff
@@ -569,6 +569,117 @@ def test_registered_tool_exposes_its_annotations(self):
                 state._dynamic_tool_names.remove(name)
 
 
+class TestFailureDetection(unittest.TestCase):
+    """A failed call must not look like a successful one.
+
+    Every failure — transport, non-200, "not connected", a refused write —
+    arrives as an ordinary 200 body, so without this the tool result carried
+    isError=False and a client branching on it saw every call succeed.
+    """
+
+    def _msg(self, text):
+        from bridge_mcp_ghidra.dispatch import failure_message
+
+        return failure_message(text)
+
+    def test_err_envelope_is_a_failure(self):
+        self.assertEqual(self._msg('{"error": "No function at 0xdead"}'), "No function at 0xdead")
+
+    def test_bridge_transport_failure_is_a_failure(self):
+        self.assertEqual(
+            self._msg('{"error": "No Ghidra instance connected. Use connect_instance() first."}'),
+            "No Ghidra instance connected. Use connect_instance() first.",
+        )
+
+    def test_success_false_payload_is_a_failure(self):
+        # /load_program_from_project reports this way through Response.ok.
+        msg = self._msg('{"success": false, "error": "not checked out", "diagnostics": {}}')
+        self.assertEqual(msg, "not checked out")
+
+    def test_rejected_status_is_a_failure(self):
+        # A plate comment refused by the naming conventions, also via Response.ok.
+        msg = self._msg('{"status": "rejected", "error": "first line too short"}')
+        self.assertEqual(msg, "first line too short")
+
+    def test_successful_payloads_are_not_failures(self):
+        for body in (
+            '{"status": "success", "message": "renamed"}',
+            '{"functions": ["a", "b"]}',
+            '{"error": ""}',            # present but empty
+            '{"error": null}',
+            "[]",
+            '["a", "b"]',
+            "plain text, not JSON",
+            "",
+        ):
+            self.assertIsNone(self._msg(body), body)
+
+    def test_per_item_error_is_not_a_call_failure(self):
+        """/get_bulk_xrefs reports "No instruction at address" per entry; the
+        call itself succeeded and must not be marked isError."""
+        body = '{"results": [{"address": "0x1", "error": "No instruction at address"}]}'
+        self.assertIsNone(self._msg(body))
+
+    def test_raise_on_failure_passes_success_through(self):
+        from bridge_mcp_ghidra.dispatch import raise_on_failure
+
+        body = '{"status": "success"}'
+        self.assertEqual(raise_on_failure(body), body)
+
+    def test_dynamic_tool_call_raises_so_fastmcp_sets_is_error(self):
+        from mcp.server.fastmcp.exceptions import ToolError
+
+        from bridge_mcp_ghidra import dispatch, state
+        from bridge_mcp_ghidra.registry import _register_tool_def
+        from bridge_mcp_ghidra.server import mcp
+
+        name = "failing_probe_tool"
+        try:
+            _register_tool_def({
+                "name": name,
+                "endpoint": "/failing_probe",
+                "http_method": "GET",
+                "description": "probe",
+                "input_schema": {"type": "object", "properties": {}},
+                "read_only": True,
+                "destructive": False,
+            })
+            with mock.patch.object(
+                dispatch, "dispatch_get", return_value='{"error": "No function at 0xdead"}'
+            ):
+                with self.assertRaises(ToolError) as caught:
+                    asyncio.run(mcp._tool_manager.call_tool(name, {}))
+            self.assertIn("No function at 0xdead", str(caught.exception))
+        finally:
+            mcp._tool_manager._tools.pop(name, None)
+            if name in state._dynamic_tool_names:
+                state._dynamic_tool_names.remove(name)
+
+    def test_dynamic_tool_call_returns_a_successful_body_unchanged(self):
+        from bridge_mcp_ghidra import dispatch, state
+        from bridge_mcp_ghidra.registry import _register_tool_def
+        from bridge_mcp_ghidra.server import mcp
+
+        name = "passing_probe_tool"
+        body = '{"functions": ["main"]}'
+        try:
+            _register_tool_def({
+                "name": name,
+                "endpoint": "/passing_probe",
+                "http_method": "GET",
+                "description": "probe",
+                "input_schema": {"type": "object", "properties": {}},
+                "read_only": True,
+                "destructive": False,
+            })
+            with mock.patch.object(dispatch, "dispatch_get", return_value=body):
+                self.assertEqual(asyncio.run(mcp._tool_manager.call_tool(name, {})), body)
+        finally:
+            mcp._tool_manager._tools.pop(name, None)
+            if name in state._dynamic_tool_names:
+                state._dynamic_tool_names.remove(name)
+
+
 class TestStaticToolsAreAllClassified(unittest.TestCase):
     def test_every_static_tool_decl
```

---

### Incident Patch 7: `3aec8dde` (2026-08-06)
**Commit Message**: fix(bridge): answer bare OPTIONS and stop rejected requests leaking sessions

A plain `OPTIONS /mcp` drew a 405 whose own Allow header omitted OPTIONS.
The CORS middleware does not cover this — it answers only a real browser
preflight, which carries both Origin and Access-Control-Request-Method —
so non-browser clients that probe methods before connecting were stuck
(#399, Open WebUI). TransportEdgeGuard now answers 204 with the real
Allow list, and sits inside CORS so genuine preflights are still handled
there.

The probe leaked state too. StreamableHTTPSessionManager registers a new
session before validating the request and never reaps it: 50 bare OPTIONS
plus 50 session-less pings measured as 100 permanent sessions, each with
its own task group, and a session id issued with a 405 was afterwards
usable. Session-less GET/POST/DELETE are refused before the manager sees
them; only initialize passes, with its body buffered and replayed. A
handshake the transport later rejects has its session dropped, which
covers bad Accept, unsupported MCP-Protocol-Version and unparseable JSON
without reimplementing the SDK's checks. The same 50+50 sequence now
creates zero sessions.

Worth reportin

**File**: `python/bridge_mcp_ghidra/cli.py` (modified, +197/-2)
```diff
@@ -2,6 +2,7 @@
 
 import argparse
 import hmac
+import json
 import os
 import re
 import socket
@@ -15,6 +16,14 @@
 from .server import mcp
 from .static_tools import _auto_connect, _start_auto_connect_retry
 
+# Largest body we will buffer while sniffing a session-less POST for the
+# `initialize` handshake. A real initialize is a few hundred bytes; anything
+# past this is either abuse or a client that lost its session id, and both get
+# the same "Missing session ID" answer the SDK would have given.
+_INITIALIZE_SNIFF_LIMIT = 256 * 1024
+
+_ALLOWED_HTTP_METHODS = "GET, POST, DELETE, OPTIONS"
+
 
 _LOOPBACK_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})
 
@@ -182,23 +191,209 @@ async def __call__(self, scope, receive, send):
                 await send({"type": "http.response.body", "body": body})
                 return
         await self.app(scope, receive, send)
+async def _send_json_rpc_error(send, status: int, message: str) -> None:
+    """Reply with the same JSON-RPC error envelope the SDK's transport uses."""
+    body = json.dumps(
+        {
+            "jsonrpc": "2.0",
+            "id": "server-error",
+            "error": {"code": -32600, "message": message},
+        }
+    ).encode()
+    await send(
+        {
+            "type": "http.response.start",
+            "status": status,
+            "headers": [
+                (b"content-type", b"application/json"),
+                (b"content-length", str(len(body)).encode()),
+            ],
+        }
+    )
+    await send({"type": "http.response.body", "body": body})
+
+
+async def _buffer_body(receive, limit: int) -> bytes | None:
+    """Drain the request body, or return None if it exceeds ``limit``.
+
+    None also covers a client that disconnects mid-body — the caller treats
+    both as "not an initialize request".
+    """
+    chunks: list[bytes] = []
+    size = 0
+    while True:
+        message = await receive()
+        if message["type"] != "http.request":
+            return None
+        chunk = message.get("body", b"")
+        size += len(chunk)
+        if size > limit:
+            return None
+        chunks.append(chunk)
+        if not message.get("more_body", False):
+            return b"".join(chunks)
+
+
+async def _drop_session(session_id: str) -> None:
+    """Tear down a session whose creating request was rejected.
+
+    ``StreamableHTTPSessionManager`` registers the new transport *before* the
+    transport validates the request, so a handshake refused for a bad ``Accept``
+    header, an unsupported ``MCP-Protocol-Version`` or unparseable JSON leaves a
+    live session behind. The SDK's own reaper (``session_idle_timeout``) is
+    never enabled by FastMCP, so nothing else collects them.
+    """
+    manager = getattr(mcp, "_session_manager", None)
+    instances = getattr(manager, "_server_instances", None)
+    if not isinstance(instances, dict):
+        logger.warning(
+            "Cannot drop session %s: no _server_instances dict on the session "
+            "manager (SDK internals may have changed)",
+            session_id,
+        )
+        return
+    transport = instances.pop(session_id, None)
+    owners = getattr(manager, "_session_owners", None)
+    if isinstance(owners, dict):
+        owners.pop(session_id, None)
+    if transport is None:
+        return
+    try:
+        await transport.terminate()
+    except Exception as e:
+        logger.warning("Failed to terminate rejected session %s: %s", session_id, e)
+
+
+def _is_initialize_request(body: bytes) -> bool:
+    """True when this body is the JSON-RPC ``initialize`` handshake."""
+    try:
+        payload = json.loads(body)
+    except (ValueError, UnicodeDecodeError):
+        return False
+    # JSON-RPC batching was removed in protocol 2025-11-25, and the SDK never
+    # accepted a batched initialize, so only a lone object can be one.
+    return isinstance(payload, dict) and payload.get("method") == "initialize"
+
+
+class TransportEdgeGuard:
+    """ASGI wrapper doing two things the SDK's transport app does not.
+
+    **Answer a bare ``OPTIONS``.** The transport routes only GET/POST/DELETE,
+    so a plain capability probe drew a 405 whose own ``Allow`` header did not
+    even list OPTIONS. Non-browser clients probe exactly this way before
+    connecting (issue #399, Open WebUI), and ``CORSMiddleware`` does not help
+    them: it answers only a real preflight, which needs both ``Origin`` and
+    ``Access-Control-Request-Method``. CORS sits *outside* this guard, so
+    genuine preflights are handled there and never arrive here.
+
+    **Refuse session-less requests before the session manager sees them.**
+    ``StreamableHTTPSessionManager`` creates a live transport for every request
+    that arrives with no session id — including the ones it is about to reject
+    — and never reaps them. Measured: 50 bare OPTIONS plus 50 session-less
+    pings left 100 permanent sessions, each with its own task gr
```

**File**: `tests/unit/test_bridge_cli.py` (modified, +185/-0)
```diff
@@ -363,6 +363,191 @@ def test_loopback_http_app_preserves_local_unauthenticated_access(self):
         with patch.object(cli, "AUTH_TOKEN", "bridge-secret"):
             app = cli._build_http_app("streamable-http", "127.0.0.1")
         self.assertNotIsInstance(app, cli._BearerAuthMiddleware)
+class TestBareOptionsProbe(unittest.TestCase):
+    """A plain OPTIONS with no CORS headers must not 405.
+
+    Non-browser clients probe the endpoint this way before connecting (#399,
+    Open WebUI). CORSMiddleware ignores it — it answers only a request that
+    carries both Origin and Access-Control-Request-Method — so before
+    TransportEdgeGuard the transport itself replied 405 with an Allow header
+    that did not even list OPTIONS.
+    """
+
+    @classmethod
+    def setUpClass(cls):
+        from starlette.testclient import TestClient
+
+        cls.client = TestClient(cli._build_http_app("streamable-http", "127.0.0.1"))
+
+    def test_bare_options_is_answered(self):
+        resp = self.client.options("/mcp")
+        self.assertEqual(resp.status_code, 204)
+        self.assertIn("OPTIONS", resp.headers["allow"])
+        for method in ("GET", "POST", "DELETE"):
+            self.assertIn(method, resp.headers["allow"])
+
+    def test_options_with_origin_but_no_request_method_is_answered(self):
+        # Not a preflight by the CORS spec, so CORSMiddleware passes it down.
+        resp = self.client.options("/mcp", headers={"Origin": "http://localhost:6274"})
+        self.assertEqual(resp.status_code, 204)
+
+    def test_bare_options_mints_no_session(self):
+        self.assertNotIn("mcp-session-id", self.client.options("/mcp").headers)
+
+    def test_sse_transport_also_answers_options(self):
+        from starlette.testclient import TestClient
+
+        client = TestClient(cli._build_http_app("sse", "127.0.0.1"))
+        self.assertEqual(client.options("/sse").status_code, 204)
+
+
+class TestSessionlessRequestsAreRefusedEarly(unittest.TestCase):
+    """No request may create a session the SDK is about to reject.
+
+    StreamableHTTPSessionManager builds a transport for every request that
+    arrives without a session id and never reaps it, so rejected traffic used
+    to accumulate live sessions (measured: 100 requests, 100 sessions, and a
+    session id issued alongside a 405 was afterwards usable).
+    """
+
+    HEADERS = {"Accept": "application/json, text/event-stream"}
+
+    @classmethod
+    def setUpClass(cls):
+        from starlette.testclient import TestClient
+
+        # The FastMCP singleton caches one session manager and it refuses to
+        # .run() twice, so the lifespan is entered exactly once for the class
+        # (and, by extension, once for this whole test module).
+        # base_url sets the Host header. It needs an explicit port: the default
+        # host policy allows "localhost:*", which does not match a bare
+        # "localhost", and TestClient's own "testserver" is rejected outright.
+        # The session manager is a singleton built by whichever class runs
+        # first, so its host policy cannot be adjusted from here.
+        cls.client = TestClient(
+            cli._build_http_app("streamable-http", "127.0.0.1"),
+            base_url="http://localhost:8000",
+        )
+        cls.client.__enter__()
+
+    @classmethod
+    def tearDownClass(cls):
+        cls.client.__exit__(None, None, None)
+
+    def _instances(self):
+        return len(mcp._session_manager._server_instances)
+
+    def test_sessionless_post_refused_without_creating_a_session(self):
+        before = self._instances()
+        resp = self.client.post(
+            "/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "ping"},
+            headers=self.HEADERS,
+        )
+        self.assertEqual(resp.status_code, 400)
+        self.assertIn("Missing session ID", resp.json()["error"]["message"])
+        self.assertNotIn("mcp-session-id", resp.headers)
+        self.assertEqual(self._instances(), before)
+
+    def test_sessionless_get_and_delete_refused(self):
+        before = self._instances()
+        self.assertEqual(
+            self.client.get("/mcp", headers={"Accept": "text/event-stream"}).status_code,
+            400,
+        )
+        self.assertEqual(self.client.delete("/mcp").status_code, 400)
+        self.assertEqual(self._instances(), before)
+
+    def test_initialize_still_passes_through_with_its_body_intact(self):
+        resp = self.client.post(
+            "/mcp",
+            json={
+                "jsonrpc": "2.0",
+                "id": 1,
+                "method": "initialize",
+                "params": {
+                    "protocolVersion": "2025-06-18",
+                    "capabilities": {},
+                    "clientInfo": {"name": "test", "version": "0"},
+                },
+            },
+            headers=self.HEADERS,
+        )
+        self.assertEqual(resp.status_code, 200)
+        self.assertTrue(resp.headers.get("
```

---

### Incident Patch 8: `5c8446d9` (2026-09-25)
**Commit Message**: docs: illustrated manual GUI install guide

Nine screenshots walking Ghidra's own extension flow end to end: project
window, File > Install Extensions, adding the zip, enabling GhidraMCPPlugin
under Utility in CodeBrowser, and the Tools > GhidraMCP menu with Server
Status. Lives in docs/INSTALL_GUI.md rather than README because README is
also the PyPI long description, where relative image links do not render.

README now links the guide from Installation, the In-Ghidra steps and two
troubleshooting entries, and its menu-item names match the plugin: the
action is "Start Server" (not "Start MCP Server"), the server starts with
the plugin, and the plugin lives under File > Configure > Utility. The
manual install path is ~/.config/ghidra on Linux (XDG, Ghidra 11+), not
~/.ghidra.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +18/-7)
```diff
@@ -151,6 +151,10 @@ v5.0 moves conventions from "things to remember" into the tool layer, where they
    needed, installs the extension, starts Ghidra, waits for MCP health, and runs
    schema smoke checks.
 
+   Prefer to click through Ghidra's own dialogs, or installing a release zip on
+   a machine without the repo? Follow the illustrated
+   [manual GUI install guide](docs/INSTALL_GUI.md).
+
 4. **Optional strict/manual mode** (advanced):
 
    ```text
@@ -301,7 +305,8 @@ v5.0 moves conventions from "things to remember" into the tool layer, where they
    /opt/homebrew/opt/ghidra/libexec/ghidraRun
    ```
 
-   In the main project window: **Tools > GhidraMCP > Start MCP Server**
+   The server starts with the plugin. Check it from the project window:
+   **Tools > GhidraMCP > Server Status**
 
 6. **Configure Cursor/Claude MCP** (`~/.cursor/mcp.json`) — use the **absolute
    path** to `uv` (`which uv`), not the bare name; GUI-launched clients do not
@@ -599,11 +604,13 @@ Set `GHIDRA_DEBUGGER_URL` in `.env` if you change the default port or host so th
 #### In Ghidra
 
 1. Start Ghidra and open a **CodeBrowser** window
-2. In **CodeBrowser**, enable the plugin via **File > Configure > Configure All Plugins > GhidraMCP**
+2. In **CodeBrowser**, enable the plugin via **File > Configure > Utility > Configure > GhidraMCPPlugin**
 3. Optional: configure custom port via **CodeBrowser > Edit > Tool Options > GhidraMCP HTTP Server**
-4. Start the server via **Tools > GhidraMCP > Start MCP Server**
+4. The server starts with the plugin; check it via **Tools > GhidraMCP > Server Status** in the project window
 5. The server runs on `http://127.0.0.1:8089/` by default
 
+Screenshots of every step: [docs/INSTALL_GUI.md](docs/INSTALL_GUI.md).
+
 #### Verify It's Working
 
 ```bash
@@ -730,16 +737,18 @@ path is the smaller and more portable fix.
 **Solution:**
 
 1. Verify extension is installed: **File > Install Extensions** — GhidraMCP should be listed
-2. Enable the plugin: **File > Configure > Configure All Plugins > GhidraMCP** (check the box)
+2. Enable the plugin: **File > Configure > Utility > Configure > GhidraMCPPlugin** (check the box)
 3. **Restart Ghidra** after installation/enabling
 
+Illustrated walkthrough: [docs/INSTALL_GUI.md](docs/INSTALL_GUI.md).
+
 ### Server not responding / Connection refused
 
 **Cause:** Server not started or wrong port.
 
 **Solution:**
 
-1. Ensure you started the server: **Tools > GhidraMCP > Start MCP Server**
+1. Check the server state: **Tools > GhidraMCP > Server Status** (it starts with the plugin; use **Restart Server** if it is stopped)
 2. Check configured port: **Edit > Tool Options > GhidraMCP HTTP Server**
 3. Check if port is in use:
 
@@ -832,8 +841,10 @@ scripts should use PyGhidra instead of the Ghidra Script Manager.
 
 **Solution:**
 
-1. Manual install location: `~/.ghidra/ghidra_12.1.3_PUBLIC/Extensions/GhidraMCP/lib/GhidraMCP.jar`
-2. Or use: **File > Install Extensions > Add** and select the ZIP file
+1. Manual install location: `~/.config/ghidra/ghidra_12.1.3_PUBLIC/Extensions/GhidraMCP/lib/GhidraMCP.jar`
+   (`%APPDATA%\ghidra\...` on Windows, `~/Library/ghidra/...` on macOS)
+2. Or use: **File > Install Extensions > Add** and select the ZIP file — see the
+   [illustrated guide](docs/INSTALL_GUI.md)
 3. Ensure JAR/ZIP was built for your Ghidra version
 
 ### Build fails with "Ghidra dependencies not found"
```

**File**: `docs/INSTALL_GUI.md` (added, +142/-0)
```diff
@@ -0,0 +1,142 @@
+# Installing the extension by hand (Ghidra GUI)
+
+`python -m tools.setup deploy` does everything on this page for you: it copies
+the extension into your Ghidra user profile, patches the tool configuration and
+restarts Ghidra. Use this page when you would rather click through Ghidra's own
+dialogs, when you are installing a release zip on a machine without the repo,
+or when you need to see what the automated deploy just did.
+
+Everything here is Ghidra's standard extension flow. The screenshots were taken
+on Windows with the dark theme; the dialogs are the same on Linux and macOS.
+
+## What you need
+
+One zip file, `GhidraMCP-<version>.zip`, built for the exact Ghidra version you
+run. Ghidra refuses an extension whose stamped version does not match its own,
+so a zip built for 12.1.3 does not load in 12.1.4. Get it from one of:
+
+| Source | Path |
+| --- | --- |
+| GitHub release asset | `GhidraMCP-<version>.zip` on the [Releases](https://github.com/bethington/ghidra-mcp/releases) page |
+| Gradle build (`./gradlew buildExtension`) | `build/distributions/GhidraMCP-<version>.zip` |
+| Maven build (`python -m tools.setup build`) | `target/GhidraMCP-<version>.zip` |
+
+The Gradle build stamps the Ghidra version from the installation you pass in
+`-PGHIDRA_INSTALL_DIR`; the Maven build stamps it from `pom.xml`. Either way,
+check the stamp before installing if you have more than one Ghidra around:
+
+```bash
+unzip -p GhidraMCP-7.0.0.zip GhidraMCP/extension.properties | grep ^version
+```
+
+A stock Ghidra installation looks like this. You do not put anything in here;
+the extension goes into your user profile, not the installation.
+
+```text
+ghidra_12.1.4_PUBLIC/
+├── Extensions/          # Ghidra's own optional extensions (Jython, BSim, ...)
+├── Ghidra/              # the application
+├── GPL/
+├── docs/
+├── licenses/
+├── server/              # Ghidra Server scripts
+├── support/             # analyzeHeadless, launch scripts
+├── ghidraRun            # Linux / macOS launcher
+├── ghidraRun.bat        # Windows launcher
+└── LICENSE
+```
+
+## 1. Open the project window
+
+Launch Ghidra and open or create a project. Extensions are installed from the
+project window, not from CodeBrowser.
+
+![Ghidra project window with an empty project](images/install/01-project-window.png)
+
+## 2. File > Install Extensions
+
+![File menu with Install Extensions highlighted](images/install/02-file-menu-install-extensions.png)
+
+## 3. Add the extension zip
+
+The dialog lists the extensions Ghidra ships with. GhidraMCP is not there yet.
+Click the green **+** (Add extension) in the top right.
+
+![Install Extensions dialog before adding GhidraMCP](images/install/03-install-extensions-dialog.png)
+
+Pick `GhidraMCP-<version>.zip` and press **OK**. The screenshot shows a Maven
+build under `target/`; a Gradle build is under `build/distributions/`.
+
+![Select Extension file chooser with GhidraMCP-7.0.0.zip selected](images/install/04-select-extension-zip.png)
+
+GhidraMCP now appears in the list with its checkbox ticked. Press **OK**. Ghidra
+tells you the change takes effect after a restart. Restart it.
+
+Ghidra unpacks the zip into your user profile:
+
+| OS | Location |
+| --- | --- |
+| Windows | `%APPDATA%\ghidra\ghidra_<version>_PUBLIC\Extensions\GhidraMCP\` |
+| Linux | `~/.config/ghidra/ghidra_<version>_PUBLIC/Extensions/GhidraMCP/` |
+| macOS | `~/Library/ghidra/ghidra_<version>_PUBLIC/Extensions/GhidraMCP/` |
+
+## 4. Enable the plugin in CodeBrowser
+
+After the restart, open a program in **CodeBrowser**. On the first launch after
+installing an extension Ghidra usually asks whether to configure the new
+plugins; answering yes lands you in the same dialog as below. If it did not
+ask, or you said no, open **File > Configure**.
+
+![CodeBrowser File menu with Configure](images/install/05-codebrowser-file-configure.png)
+
+GhidraMCP is a **Utility** plugin. Click **Configure** under Utility.
+
+![Configure Tool dialog showing the Utility package](images/install/06-configure-tool-utility.png)
+
+Tick **GhidraMCPPlugin** and press **OK**, then **Close**.
+
+![Configure Utility Plugins with GhidraMCPPlugin checked](images/install/07-utility-plugins-ghidramcp.png)
+
+Save the tool when Ghidra asks on exit, or the plugin is off again next time.
+
+## 5. Check the server
+
+The HTTP server starts as soon as the plugin loads; there is nothing to start
+by hand. The project window's **Tools > GhidraMCP** menu shows the state and
+lets you restart or stop it. **Start Server** is greyed out while the server is
+already running.
+
+![Tools > GhidraMCP submenu in the project window](images/install/08-tools-ghidramcp-menu.png)
+
+**Server Status** shows both transports, the port, the plugin version and the
+endpoint count.
+
+![GhidraMCP Server Status dialog](images/install/09-server-status.png)
+
+The same check from a shell:
+
+```bash
+curl http://127.0.0.1:8089/check_connection
+```
+
+To chang
```

**File**: `docs/README.md` (modified, +4/-0)
```diff
@@ -7,6 +7,8 @@ release notes for Ghidra MCP.
 
 - Start in the repo root `README.md` for installation, build, and day-to-day
   usage.
+- Read [INSTALL_GUI.md](INSTALL_GUI.md) to install the extension through
+  Ghidra's own dialogs, with a screenshot of every step.
 - Read `PROJECT_STRUCTURE.md` for the current layout of the codebase and where
   major subsystems live.
 - Read `TESTING.md` for local, CI, and live Ghidra release-regression testing.
@@ -34,6 +36,8 @@ release notes for Ghidra MCP.
 ```text
 docs/
 ├── README.md
+├── INSTALL_GUI.md
+├── images/install/
 ├── PROJECT_STRUCTURE.md
 ├── NAMING_CONVENTIONS.md
 ├── HUNGARIAN_NOTATION.md
```

---

### Incident Patch 9: `d38af54c` (2026-09-24)
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

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

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

### Incident Patch 10: `9224c639` (2026-09-24)
**Commit Message**: build: declare support for Ghidra 12.1.3 (#447)

* build: declare support for Ghidra 12.1.3

Bump ghidra.version 12.1.2 -> 12.1.3 and align the functional version
anchors that must move in lockstep:

- pom.xml: ghidra.version -> 12.1.3 (drives Maven resolution from ~/.m2)
- tests.yml: CI download URL / cache key / GHIDRA_VERSION -> 12.1.3
  (build date 20260817)
- release.yml / pre-release.yml: GHIDRA_VERSION + GHIDRA_DATE env,
  self-hosted runner default path
- release-regression.yml: runner default path
- README: badge + prerequisite + shared-server compat note
- test_versioning.py: same-series case for pinned 12.1.2 vs 12.1.3 install

No Java source changes required. Verified against a local Ghidra 12.1.3
install: mvn clean package passes; offline suite 498 tests (2 pre-existing
failures on dev unrelated to this change); live GUI regression (import,
analyze, decompile, rename incl. special-char names per GP-6843 stricter
symbol filtering, comments, xrefs, save/close/reopen persistence) and
headless server flow (load_program/run_analysis/decompile/rename) all pass.

* build: sync remaining Ghidra 12.1.3 version anchors

Dockerfile, CLAUDE.md, AGENTS.md, and two README.md notes w

**File**: `.env.template` (modified, +2/-2)
```diff
@@ -9,7 +9,7 @@
 # Path to your Ghidra installation directory
 # Used by `python -m tools.setup` deploy and prerequisite commands
 # Examples:
-#   Windows: GHIDRA_PATH=F:\ghidra_12.1.2_PUBLIC
+#   Windows: GHIDRA_PATH=F:\ghidra_12.1.3_PUBLIC
 #   Linux:   GHIDRA_PATH=/opt/ghidra_12.1_PUBLIC
 #   macOS:   GHIDRA_PATH=/Applications/ghidra_12.1_PUBLIC
 GHIDRA_PATH=
@@ -128,7 +128,7 @@ TOOLS_SETUP_BACKEND=maven
 
 # Path to Ghidra installation — used by fun-doc to auto-launch Ghidra
 # Defaults to GHIDRA_PATH above when not set separately
-# GHIDRA_INSTALL_DIR=F:\ghidra_12.1.2_PUBLIC
+# GHIDRA_INSTALL_DIR=F:\ghidra_12.1.3_PUBLIC
 
 # =============================================================================
 # Knowledge Database (Optional — RE-Universe PostgreSQL + pgvector)
```

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (modified, +2/-2)
```diff
@@ -45,8 +45,8 @@ body:
     id: ghidra-version
     attributes:
       label: Ghidra version
-      description: From Help > About Ghidra, e.g. 12.1.2 PUBLIC.
-      placeholder: "12.1.2 PUBLIC"
+      description: From Help > About Ghidra, e.g. 12.1.3 PUBLIC.
+      placeholder: "12.1.3 PUBLIC"
     validations:
       required: true
 
```

**File**: `.github/workflows/pre-release.yml` (modified, +3/-3)
```diff
@@ -17,11 +17,11 @@ on:
       ghidra_path:
         description: 'Ghidra path for live regression self-hosted runner'
         required: false
-        default: 'F:\ghidra_12.1.2_PUBLIC'
+        default: 'F:\ghidra_12.1.3_PUBLIC'
 
 env:
-  GHIDRA_VERSION: 12.1.2
-  GHIDRA_DATE: 20260605
+  GHIDRA_VERSION: 12.1.3
+  GHIDRA_DATE: 20260817
 
 # OSSF Scorecard Token-Permissions: default to read-only. The
 # create-prerelease job elevates to contents:write for the GitHub
```

**File**: `.github/workflows/release-regression.yml` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ on:
       ghidra_path:
         description: "Path to the Ghidra install on the self-hosted runner"
         required: true
-        default: "F:\\ghidra_12.1.2_PUBLIC"
+        default: "F:\\ghidra_12.1.3_PUBLIC"
       test_tier:
         description: "Deploy regression tier to run"
         required: true
@@ -48,7 +48,7 @@ jobs:
     runs-on: [self-hosted, Windows]
     timeout-minutes: 30
     env:
-      GHIDRA_REGRESSION_PATH: ${{ inputs.ghidra_path || vars.GHIDRA_PATH || 'F:\ghidra_12.1.2_PUBLIC' }}
+      GHIDRA_REGRESSION_PATH: ${{ inputs.ghidra_path || vars.GHIDRA_PATH || 'F:\ghidra_12.1.3_PUBLIC' }}
       GHIDRA_REGRESSION_TIER: ${{ inputs.test_tier || 'release' }}
 
     steps:
```

**File**: `.github/workflows/release.yml` (modified, +3/-3)
```diff
@@ -21,11 +21,11 @@ on:
       ghidra_path:
         description: 'Ghidra path for live regression self-hosted runner'
         required: false
-        default: 'F:\ghidra_12.1.2_PUBLIC'
+        default: 'F:\ghidra_12.1.3_PUBLIC'
 
 env:
-  GHIDRA_VERSION: 12.1.2
-  GHIDRA_DATE: 20260605
+  GHIDRA_VERSION: 12.1.3
+  GHIDRA_DATE: 20260817
 
 # OSSF Scorecard Token-Permissions: default to read-only. The
 # create-release job elevates to contents:write for tag + asset
```

**File**: `.github/workflows/tests.yml` (modified, +4/-4)
```diff
@@ -36,22 +36,22 @@ jobs:
       uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9  # v6.1.0
       with:
         path: /tmp/ghidra
-        key: ghidra-12.1.2-PUBLIC-20260605
+        key: ghidra-12.1.3-PUBLIC-20260817
 
     - name: Download Ghidra
       if: steps.cache-ghidra.outputs.cache-hit != 'true'
       run: |
-        echo "Downloading Ghidra 12.1.2..."
+        echo "Downloading Ghidra 12.1.3..."
         curl -sL -o /tmp/ghidra.zip \
-          "https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_12.1.2_build/ghidra_12.1.2_PUBLIC_20260605.zip"
+          "https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_12.1.3_build/ghidra_12.1.3_PUBLIC_20260817.zip"
         mkdir -p /tmp/ghidra
         unzip -q /tmp/ghidra.zip -d /tmp/ghidra
         rm /tmp/ghidra.zip
 
     - name: Install Ghidra JARs to Maven local repository
       run: |
         GHIDRA_DIR=$(find /tmp/ghidra -maxdepth 1 -type d -name 'ghidra_*' | head -1)
-        GHIDRA_VERSION="12.1.2"
+        GHIDRA_VERSION="12.1.3"
         echo "Using Ghidra directory: $GHIDRA_DIR"
 
         # Install Framework JARs
```

**File**: `AGENTS.md` (modified, +6/-6)
```diff
@@ -46,12 +46,12 @@ In Git Bash use a **forward-slash** Ghidra path; a backslash path is mangled
 before Gradle sees it and produces ~100 misleading "package does not exist"
 errors.
 
-- Build: `./gradlew buildExtension "-PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.2_PUBLIC"`
-- Quick compile: `./gradlew compileJava "-PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.2_PUBLIC"`
+- Build: `./gradlew buildExtension "-PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.3_PUBLIC"`
+- Quick compile: `./gradlew compileJava "-PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.3_PUBLIC"`
 - Test (Python): `pytest tests/unit/ -v --no-cov`
-- Test (Java, offline): `./gradlew test --tests 'com.xebyte.offline.*' "-PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.2_PUBLIC"`
-- Test (Java, all): `./gradlew test "-PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.2_PUBLIC"`
-- Preflight: `python -m tools.setup preflight --ghidra-path F:\ghidra_12.1.2_PUBLIC`
-- Deploy: `./gradlew buildExtension "-PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.2_PUBLIC"` then `python -m tools.setup deploy --ghidra-path F:\ghidra_12.1.2_PUBLIC` — leave `TOOLS_SETUP_BACKEND` **unset** for this second step, because the Gradle backend's `deploy` runs no post-deploy test tier and refuses `--test`
+- Test (Java, offline): `./gradlew test --tests 'com.xebyte.offline.*' "-PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.3_PUBLIC"`
+- Test (Java, all): `./gradlew test "-PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.3_PUBLIC"`
+- Preflight: `python -m tools.setup preflight --ghidra-path F:\ghidra_12.1.3_PUBLIC`
+- Deploy: `./gradlew buildExtension "-PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.3_PUBLIC"` then `python -m tools.setup deploy --ghidra-path F:\ghidra_12.1.3_PUBLIC` — leave `TOOLS_SETUP_BACKEND` **unset** for this second step, because the Gradle backend's `deploy` runs no post-deploy test tier and refuses `--test`
 - Version bump: `python -m tools.setup bump-version --new X.Y.Z`
 - Maven equivalents (peer backend): `python -m tools.setup ensure-prereqs --ghidra-path <dir>` then `python -m tools.setup build`
```

**File**: `CLAUDE.md` (modified, +23/-23)
```diff
@@ -4,7 +4,7 @@
 
 MCP server bridging Ghidra reverse engineering with AI tools. 253 MCP tools for binary analysis.
 
-- **Package**: `com.xebyte` | **Version**: 7.0.0 | **Java**: 21 LTS | **Ghidra**: 12.1.2
+- **Package**: `com.xebyte` | **Version**: 7.0.0 | **Java**: 21 LTS | **Ghidra**: 12.1.3
 
 ## Boil the ocean
 
@@ -126,19 +126,19 @@ Maven-only reason, and the JaCoCo coverage gate is exactly that reason.
 **Gradle (default):**
 
 ```text
-./gradlew buildExtension -PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.2_PUBLIC
-./gradlew preflight      -PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.2_PUBLIC
-./gradlew verifyVersion  -PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.2_PUBLIC
-./gradlew deploy         -PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.2_PUBLIC
-./gradlew startGhidra    -PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.2_PUBLIC
+./gradlew buildExtension -PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.3_PUBLIC
+./gradlew preflight      -PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.3_PUBLIC
+./gradlew verifyVersion  -PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.3_PUBLIC
+./gradlew deploy         -PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.3_PUBLIC
+./gradlew startGhidra    -PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.3_PUBLIC
 ```
 
 Registered tasks: `buildExtension`, `prepareGhidraClasspath`, `verifyVersion`,
 `preflight`, `deployExtension`, `installUserExtension`, `patchGhidraUserConfig`,
 `stopGhidra`, `deploy`, `startGhidra`, `cleanAll`, plus the standard `test`
 (pinned by `tests/unit/test_gradle_tasks.py`).
 
-**Git Bash: forward slashes in the path.** `-PGHIDRA_INSTALL_DIR=F:\ghidra_12.1.2_PUBLIC`
+**Git Bash: forward slashes in the path.** `-PGHIDRA_INSTALL_DIR=F:\ghidra_12.1.3_PUBLIC`
 is mangled before Gradle sees it, the property resolves to nothing, and you get
 ~100 `package ghidra.program.model.address does not exist` errors that read like
 a broken checkout rather than a broken argument. PowerShell takes the backslash
@@ -149,8 +149,8 @@ form.
 ```text
 $env:TOOLS_SETUP_BACKEND = "gradle"
 python -m tools.setup build
-python -m tools.setup preflight --ghidra-path F:\ghidra_12.1.2_PUBLIC
-python -m tools.setup deploy    --ghidra-path F:\ghidra_12.1.2_PUBLIC
+python -m tools.setup preflight --ghidra-path F:\ghidra_12.1.3_PUBLIC
+python -m tools.setup deploy    --ghidra-path F:\ghidra_12.1.3_PUBLIC
 ```
 
 **`deploy --test <tier>` is the one command that must NOT run under the Gradle
@@ -163,8 +163,8 @@ backend.** `build.gradle`'s `deploy` is `stopGhidra` + `deployExtension` +
 backend produced it. So with no Maven installed the working combination is:
 
 ```text
-./gradlew buildExtension -PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.2_PUBLIC   # Gradle builds
-python -m tools.setup deploy --ghidra-path F:\ghidra_12.1.2_PUBLIC --test release
+./gradlew buildExtension -PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.3_PUBLIC   # Gradle builds
+python -m tools.setup deploy --ghidra-path F:\ghidra_12.1.3_PUBLIC --test release
 ```
 
 The two steps want different backends. Do not export
@@ -174,13 +174,13 @@ The two steps want different backends. Do not export
 **Maven (peer backend; what CI uses):**
 
 ```text
-python -m tools.setup ensure-prereqs --ghidra-path F:\ghidra_12.1.2_PUBLIC
+python -m tools.setup ensure-prereqs --ghidra-path F:\ghidra_12.1.3_PUBLIC
 python -m tools.setup build
-python -m tools.setup preflight      --ghidra-path F:\ghidra_12.1.2_PUBLIC
-python -m tools.setup deploy         --ghidra-path F:\ghidra_12.1.2_PUBLIC
+python -m tools.setup preflight      --ghidra-path F:\ghidra_12.1.3_PUBLIC
+python -m tools.setup deploy         --ghidra-path F:\ghidra_12.1.3_PUBLIC
 ```
 
-- Ghidra install: `F:\ghidra_12.1.2_PUBLIC`
+- Ghidra install: `F:\ghidra_12.1.3_PUBLIC`
 - `ensure-prereqs` / `install-ghidra-deps` exist for Maven's benefit: they
   `install-file` Ghidra's ~19 jars into the local repository. Gradle reads the
   installation directly via `fileTree`, so the Gradle equivalent is
@@ -231,9 +231,9 @@ Release floor before tagging or publishing:
 
 ```text
 python -m tools.setup verify-version                    # no backend, no Maven needed
-./gradlew buildExtension -PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.2_PUBLIC
+./gradlew buildExtension -PGHIDRA_INSTALL_DIR=F:/ghidra_12.1.3_PUBLIC
 pytest tests/unit/ -v --no-cov
-python -m tools.setup deploy --ghidra-path F:\ghidra_12.1.2_PUBLIC --test release
+python -m tools.setup deploy --ghidra-path F:\ghidra_12.1.3_PUBLIC --test release
 git add docs/releases/live-regression-evidence.json   # the tier writes it; commit it
 ```
 
@@ -375,7 +375,7 @@ Find the file(s) you edited below; run everything in that row. Always include th
 | `tools/upgrade_project_language.py` | `tests/unit/test_upgrade_project_language.py` (offline) + a live dry run, then `--apply` on ONE folder before the corpus. **Ghidra records the SLEIGH language version a Program was built against, and a bump makes every older program open READ-ONLY** — measured 2026-08-09, the whole `diablo2` repo sat at `x86:LE:32:default` **4.6** against 12.1.2's **4.7**, and the symptom was "binarie
```

---

### Incident Patch 11: `e9e57157` (2026-09-24)
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

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

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
+        ProjectData data = mock(ProjectData.class);
+        when(data.getFile(target)).thenReturn(targetFile);
+        Project project = mock(Project.class);
+        when(project.getProjectData()).thenReturn(data);
+
+        HeadlessLikeProvider provider = new HeadlessLikeProvider(project);
+        provider.open.add(programAt("/other/solo.exe.bak"));
+
+        Response r = new ProgramScriptService(provider, new NoopThreadingStrategy()).deleteFile(target);
+
+        assertTrue(r instanceof Response.Ok);
+        verify(targetFile).delete();
+        assertTrue("nothing matched exactly, so nothing may be closed", provider.closed.isEmpty());
+    }
+}
```

---

### Incident Patch 12: `66b7f820` (2026-09-24)
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

### Incident Patch 13: `b3f8dfef` (2026-09-22)
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
                 if (isWrite && isDryRunRequested(query, body) && programProvider != null) {
                     Program program = resolveProgramForDryRun(bindings, query, body);
                     if (program != null) {
-                        int tx = program.startTransaction("[DRY RUN] " + tool.path());
-                        try {
-                            Response result = (Response) method.invoke(service, args);
-                            return wrapDryRunResponse(result);
-                        } finally {
-                            program.endTransaction(tx, false); // Always rollback
-                        }
+                        // The transaction must be opened on the same thread Ghidra's
+                        // threading model actually runs the write on -- the Swing EDT
+                        // in GUI mode. Opening it directly here left it on the calling
+                        // HTTP thread, while the wrapped service method's own
+                        // threadingSt
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

**File**: `src/main/java/com/xebyte/headless/GhidraMCPHeadlessServer.java` (modified, +1/-1)
```diff
@@ -394,7 +394,7 @@ private void registerEndpoints() {
         // SHARED ENDPOINTS — Annotation-driven registration via AnnotationScanner
         // ==========================================================================
 
-        AnnotationScanner scanner = new AnnotationScanner(endpointHandler.getProgramProvider(),
+        AnnotationScanner scanner = new AnnotationScanner(endpointHandler.getProgramProvider(), threadingStrategy,
             endpointHandler.getListingService(), endpointHandler.getFunctionService(),
             endpointHandler.getCommentService(), endpointHandler.getSymbolLabelService(),
             endpointHandler.getXrefCallGraphService(), endpointHandler.getDataTypeService(),
```

**File**: `src/test/java/com/xebyte/core/FunctionServiceDeleteFunctionTest.java` (added, +158/-0)
```diff
@@ -0,0 +1,158 @@
+package com.xebyte.core;
+
+import ghidra.program.model.address.Address;
+import ghidra.program.model.address.AddressFactory;
+import ghidra.program.model.address.AddressSetView;
+import ghidra.program.model.address.AddressSpace;
+import ghidra.program.model.listing.Function;
+import ghidra.program.model.listing.FunctionManager;
+import ghidra.program.model.listing.FunctionTag;
+import ghidra.program.model.listing.Program;
+import org.junit.Test;
+
+import java.util.LinkedHashSet;
+import java.util.List;
+import java.util.Map;
+import java.util.Set;
+import java.util.concurrent.Callable;
+
+import static org.junit.Assert.*;
+import static org.mockito.ArgumentMatchers.*;
+import static org.mockito.Mockito.*;
+
+/**
+ * Regression coverage for the 2026-09-21 incident: {@code /delete_function} on any
+ * function that carried a {@link FunctionTag} threw
+ * {@code java.util.ConcurrentModificationException} from inside Ghidra's own
+ * {@code FunctionManagerDB.doRemoveFunction}, which iterates the function's live tag
+ * set while removing tags from it (stack: {@code HashMap$KeyIterator.next} &lt;-
+ * {@code FunctionManagerDB.doRemoveFunction} &lt;- {@code FunctionSymbol.delete} &lt;-
+ * {@code FunctionManagerDB.removeFunction} &lt;-
+ * {@code FunctionService.deleteFunctionAtAddress}). The fix detaches every tag from the
+ * function itself, via the same {@code func.removeTag(name)} call
+ * {@code /remove_function_tag} already uses, before calling
+ * {@code FunctionManager.removeFunction}, so Ghidra's internal loop has nothing left to
+ * iterate.
+ *
+ * <p>This test cannot drive real Ghidra database internals, but it reproduces the exact
+ * failure mechanism with a plain {@link java.util.LinkedHashSet}: the mocked
+ * {@code FunctionManager.removeFunction} stands in for
+ * {@code FunctionManagerDB.doRemoveFunction} and iterates the function's own (mocked)
+ * tag set while removing from that same set outside the iterator -- the textbook
+ * fail-fast trigger, and the same live-view mutation Ghidra's real implementation
+ * performs. If {@code deleteFunctionAtAddress} still had tags attached when this runs,
+ * the test throws a genuine {@code ConcurrentModificationException}, exactly as it does
+ * against a live Ghidra program.
+ */
+public class FunctionServiceDeleteFunctionTest {
+
+    private static final class InlineThreadingStrategy implements ThreadingStrategy {
+        @Override
+        public <T> T executeRead(Callable<T> action) throws Exception {
+            return action.call();
+        }
+
+        @Override
+        public <T> T executeWrite(Program program, String txName, Callable<T> action)
+                throws Exception {
+            return action.call();
+        }
+
+        @Override
+        public boolean isHeadless() {
+            return true;
+        }
+    }
+
+    /** Wires a mocked Program/FunctionManager/Function so deleteFunctionAtAddress runs for real. */
+    private static final class Fixture {
+        final Program program = mock(Program.class);
+        final FunctionManager functionManager = mock(FunctionManager.class);
+        final Function func = mock(Function.class);
+        final Address addr = mock(Address.class);
+        final AddressFactory addressFactory = mock(AddressFactory.class);
+        final ProgramProvider provider = mock(ProgramProvider.class);
+        final Set<FunctionTag> liveTags = new LinkedHashSet<>();
+
+        Fixture(String addressStr, String... tagNames) {
+            AddressSpace space = mock(AddressSpace.class);
+            when(space.isOverlaySpace()).thenReturn(false);
+            when(space.getType()).thenReturn(AddressSpace.TYPE_RAM);
+            when(addr.toString(false)).thenReturn(addressStr.replace("0x", ""));
+            when(addr.getAddressSpace()).thenReturn(space);
+
+            when(addressFactory.getAddress(addressStr)).thenReturn(addr);
+            when(addressFactory.getAddressSpaces()).thenReturn(new AddressSpace[0]);
+            when(program.getAddressFactory()).thenReturn(addressFactory);
+            when(program.getFunctionManager()).thenReturn(functionManager);
+
+            AddressSetView body = mock(AddressSetView.class);
+            when(body.getNumAddresses()).thenReturn(42L);
+            when(func.getName()).thenReturn("FUN_" + addressStr.replace("0x", ""));
+            when(func.getBody()).thenReturn(body);
+
+            for (String name : tagNames) {
+                FunctionTag tag = mock(FunctionTag.class);
+                when(tag.getName()).thenReturn(name);
+                liveTags.add(tag);
+            }
+            when(func.getTags()).thenAnswer(inv -> liveTags);
+            doAnswer(inv -> {
+                String name = inv.getArgument(0);
+                liveTags.removeIf(t -> t.getName().equals(name));
+                return null;
+            }).when(func).removeTag(anyString());
+
+            when(functionManager.getFunctionAt(addr)).thenR
```

**File**: `src/test/java/com/xebyte/offline/AnnotationScannerOfflineTest.java` (modified, +147/-0)
```diff
@@ -469,5 +469,152 @@ public Response write(
             return Response.ok("wrote");
         }
     }
+
+    /**
+     * Regression test for the 2026-09-21 incident: even after {@code delete_function}
+     * detaches a function's tags before removing it (fixing the
+     * {@code ConcurrentModificationException} thrown from inside Ghidra's own
+     * {@code FunctionManagerDB.doRemoveFunction}), a DRY-RUN delete threw its OWN
+     * {@code ConcurrentModificationException} every time, on every function, tagged or
+     * not. Root cause: {@code AnnotationScanner.createHandler}'s dry-run wrapper opened
+     * its transaction directly via {@code program.startTransaction(...)} on the calling
+     * (HTTP) thread, while the wrapped service method's own
+     * {@code threadingStrategy.executeWrite} dispatched the real work to a DIFFERENT
+     * thread (the Swing EDT in GUI mode, via a separate
+     * {@code SwingUtilities.invokeAndWait}) -- nesting a transaction opened by one thread
+     * inside one opened by another. Fix: route the whole dry-run wrapper, including the
+     * transaction it opens, through {@code threadingStrategy.executeWrite}, so it lands on
+     * the same thread the wrapped write's own nested {@code executeWrite} call detects
+     * (via {@code SwingUtilities.isEventDispatchThread()}) and reuses in place, with no
+     * second dispatch.
+     *
+     * <p>This test cannot drive Ghidra's real cross-thread transaction bookkeeping, but it
+     * encodes the exact invariant the fix establishes: {@code program.startTransaction} may
+     * only be called from inside {@code threadingStrategy.executeWrite}'s own callable. A
+     * mocked {@code Program.startTransaction} throws if that invariant is violated, turning
+     * a regression back into a hard test failure instead of a live-only symptom. It also
+     * exercises a TAGGED function through the dry-run path, proving {@code delete_function}'s
+     * tag-detach fix composes correctly with the dry-run wrapper (the bug report noted the
+     * dry-run CME reproduced "even on functions where the fix above would succeed").
+     */
+    public void testDryRunDeleteFunctionOpensItsTransactionOnlyInsideTheThreadingStrategy() throws Exception {
+        boolean[] insideExecuteWrite = {false};
+        com.xebyte.core.ThreadingStrategy strategy = new com.xebyte.core.ThreadingStrategy() {
+            @Override
+            public <T> T executeRead(java.util.concurrent.Callable<T> action) throws Exception {
+                return action.call();
+            }
+
+            @Override
+            public <T> T executeWrite(Program program, String txName,
+                    java.util.concurrent.Callable<T> action) throws Exception {
+                insideExecuteWrite[0] = true;
+                try {
+                    return action.call();
+                } finally {
+                    insideExecuteWrite[0] = false;
+                }
+            }
+
+            @Override
+            public boolean isHeadless() {
+                return true;
+            }
+        };
+
+        Program program = mock(Program.class);
+        when(program.startTransaction(org.mockito.ArgumentMatchers.anyString())).thenAnswer(inv -> {
+            if (!insideExecuteWrite[0]) {
+                throw new IllegalStateException(
+                    "startTransaction called outside threadingStrategy.executeWrite -- this is the "
+                    + "mismatched-thread nesting that threw ConcurrentModificationException on every "
+                    + "dry run before the fix.");
+            }
+            return 42;
+        });
+
+        ghidra.program.model.listing.FunctionManager functionManager =
+            mock(ghidra.program.model.listing.FunctionManager.class);
+        ghidra.program.model.listing.Function func = mock(ghidra.program.model.listing.Function.class);
+        ghidra.program.model.address.Address addr = mock(ghidra.program.model.address.Address.class);
+        ghidra.program.model.address.AddressFactory addressFactory =
+            mock(ghidra.program.model.address.AddressFactory.class);
+        ghidra.program.model.address.AddressSpace space =
+            mock(ghidra.program.model.address.AddressSpace.class);
+        ghidra.program.model.address.AddressSetView body =
+            mock(ghidra.program.model.address.AddressSetView.class);
+
+        when(space.isOverlaySpace()).thenReturn(false);
+        when(space.getType()).thenReturn(ghidra.program.model.address.AddressSpace.TYPE_RAM);
+        when(addr.toString(false)).thenReturn("401000");
+        when(addr.getAddressSpace()).thenReturn(space);
+        when(addressFactory.getAddress("0x401000")).thenReturn(addr);
+        when(addressFactory.getAddressSpaces())
+            .thenReturn(new ghidra.program.model.address.AddressSpace[0]);
+        when(program.getAddressFactory()).thenReturn(addressFactory);
+        when(program.getFunctionManager()).thenRetu
```

---

### Incident Patch 14: `f449d6fe` (2026-09-18)
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
+            f"{installer} is listed here but does not exist. If it moved, move "
+            f"this entry with it; if it is gone, delete the entry. An installer "
+            f"list that quietly checks fewer files each year is not a guard."
+        )
```

---

### Incident Patch 15: `9a55fd6b` (2026-09-18)
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
+    """Wire the non-Maven halves of preflight so a test can vary Maven alone."""
+    from tools.setup.versioning import VersionInfo
 
     monkeypatch.setattr(cli, "detect_repo_root", lambda: tmp_path)
     monkeypatch.setattr(cli, "_get_backend", lambda: "maven")
     monkeypatch.setattr(cli, "_load_repo_env", lambda root: {})
     monkeypatch.setattr(cli, "find_repo_python", lambda root: Path("python"))
+    monkeypatch.setattr(
+        cli, "read_pom_versions", lambda root: VersionInfo("7.0.0", "12.1")
+    )
+    # Patch the module reference on ``cli`` rather than mutating the shared
+    # ``shutil`` module: tools.setup.spawn calls shutil.which too, and a
+    # module-level patch would silently answer for it as well.
+    monkeypatch.setattr(
+        cli,
+        "shutil",
+        SimpleNamespace(
+            which=lambda name: "/usr/bin/java" if java and name == "java" else None
+        ),
+    )
 
-    def raise_not_found():
-        raise FileNotFoundError("Maven not found on PATH")

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

**File**: `tools/setup/maven.py` (modified, +57/-14)
```diff
@@ -10,22 +10,53 @@
 
 REQUIRED_JAVA_MAJOR = 21
 
+MAVEN_NOT_FOUND_MESSAGE = (
+    "Unable to locate Maven. Install mvn or configure M2_HOME/USERPROFILE tools path."
+)
+
+
+class MavenNotFoundError(FileNotFoundError):
+    """Maven is not installed.
+
+    Subclasses ``FileNotFoundError`` so every existing handler keeps catching
+    it; the distinct type lets ``tools.setup``'s entry point tell "no Maven"
+    apart from a missing jar or launcher and report it as a refusal instead of
+    a traceback.
+    """
+
+
+def detect_maven_java_major(maven_command: Path) -> int | None:
+    """Return the Java major version Maven runs on, or None when unreadable.
+
+    None means "could not tell" -- Maven refused to start, or its ``-version``
+    banner carried no ``Java version:`` line. Callers treat that as "no
+    objection" rather than as a failure, which is what the bool wrapper below
+    has always done.
+    """
+    try:
+        completed = subprocess.run(
+            [str(maven_command), "-version"],
+            capture_output=True,
+            text=True,
+            check=False,
+        )
+    except OSError:
+        return None
+    output = f"{completed.stdout}\n{completed.stderr}"
+    match = re.search(r"(?im)^Java version:\s*(?:1\.)?(\d+)", output)
+    if not match:
+        return None
+    return int(match.group(1))
+
 
 def ensure_maven_java_supported(maven_command: Path) -> bool:
-    completed = subprocess.run(
-        [str(maven_command), "-version"],
-        capture_output=True,
-        text=True,
-        check=False,
-    )
-    output = f"{completed.stdout}\n{completed.stderr}"
-    match = re.search(r"(?im)^Java version:\s*(?:1\.)?(\d+)", output)
-    if not match or int(match.group(1)) >= REQUIRED_JAVA_MAJOR:
+    java_major = detect_maven_java_major(maven_command)
+    if java_major is None or java_major >= REQUIRED_JAVA_MAJOR:
         return True
 
     print(
         f"Java {REQUIRED_JAVA_MAJOR}+ is required to build ghidra-mcp; "
-        f"Maven is running on Java {match.group(1)}.",
+        f"Maven is running on Java {java_major}.",
         file=sys.stderr,
     )
     print(
@@ -159,14 +190,26 @@ def candidate_maven_commands() -> list[Path]:
     return unique_candidates
 
 
-def find_maven_command() -> Path:
+def locate_maven_command() -> Path | None:
+    """Return the Maven executable, or None when Maven is not installed.
+
+    Non-raising counterpart to :func:`find_maven_command`. Commands that only
+    REPORT on Maven -- ``tools.setup preflight`` -- use this, so an absent Maven
+    is a line in the report rather than an abort. Commands that actually shell
+    out to ``mvn`` keep calling :func:`find_maven_command` and its
+    ``FileNotFoundError``.
+    """
     for candidate in candidate_maven_commands():
         if candidate.is_file():
             return candidate
+    return None
 
-    raise FileNotFoundError(
-        "Unable to locate Maven. Install mvn or configure M2_HOME/USERPROFILE tools path."
-    )
+
+def find_maven_command() -> Path:
+    maven_command = locate_maven_command()
+    if maven_command is None:
+        raise MavenNotFoundError(MAVEN_NOT_FOUND_MESSAGE)
+    return maven_command
 
 
 def run_maven(repo_root: Path, goals: list[str], dry_run: bool = False) -> int:
```

#### Recent Merged Pull Requests:
- **PR #567** (2026-10-05): refactor!: one call reads a function, /get_functions replaces nine readers (@heeen)
- **PR #566** (2026-10-05): refactor!: one parameter, and one meaning, for "which function" (@heeen)
- **PR #553** (2026-10-05): MCP protocol conformance: isError, tool hints, progress, pagination, opt-in bearer auth (@heeen)
- **PR #552** (2026-09-29): docs(claude): drop two test paths removed with tests/performance (@roli-lpci)
- **PR #543** (2026-09-24): release: merge dev into main for 7.0.0-rc.1 (@bethington)
- **PR #541** (2026-09-22): fix: /delete_function threw CME on tagged functions, dry-run made it worse (@bethington)
- **PR #540** (2026-09-18): fix(docker): the server image could not build, and no gate could see it (@bethington)
- **PR #539** (2026-09-19): release: merge dev into main for 7.0.0 (@bethington)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
