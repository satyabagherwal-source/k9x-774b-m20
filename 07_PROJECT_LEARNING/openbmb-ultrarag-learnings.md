# Forensic Learning Record (Deep Inspection): OpenBMB/UltraRAG

> **Canonical Artifact**: `07_PROJECT_LEARNING/openbmb-ultrarag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/OpenBMB/UltraRAG](https://github.com/OpenBMB/UltraRAG))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:55:19.904Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `OpenBMB/UltraRAG`
- **Description**: A Low-Code MCP Framework for Building Complex and Innovative RAG Pipelines
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 5712 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/ultrarag/utils.py`
```
import ctypes
import logging
import os
import signal
import subprocess
from typing import Dict, List, Optional

IS_POSIX = os.name == "posix"
IS_WINDOWS = os.name == "nt"

if IS_POSIX:
    libc = ctypes.CDLL(None)
else:
    libc = None

_windows_job_handle = None

if IS_WINDOWS:
    import ctypes.wintypes as wintypes

    JobObjectExtendedLimitInformation = 9
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000

    class JOBOBJECT_BASIC_LIMIT_INFORMATION(ctypes.Structure):
        _fields_ = [
            ("PerProcessUserTimeLimit", wintypes.LARGE_INTEGER),
            ("PerJobUserTimeLimit", wintypes.LARGE_INTEGER),
            ("LimitFlags", wintypes.DWORD),
            ("MinimumWorkingSetSize", ctypes.c_size_t),
            ("MaximumWorkingSetSize", ctypes.c_size_t),
            ("ActiveProcessLimit", wintypes.DWORD),
            ("Affinity", ctypes.c_size_t),
            ("PriorityClass", wintypes.DWORD),
            ("SchedulingClass", wintypes.DWORD),
        ]

    class IO_COUNTERS(ctypes.Structure):
        _fields_ = [
            ("ReadOperationCount", ctypes.c_ulonglong),
            ("WriteOperationCount", ctypes.c_ulonglong),
            ("OtherOperationCount", ctypes.c_ulonglong),
            ("ReadTransferCount", ctypes.c_ulonglong),
            ("WriteTransferCount", ctypes.c_ulonglong),
            ("OtherTransferCount", ctypes.c_ulonglong),
        ]

    class JOBOBJECT_EXTENDED_LIMIT_INFORMATION(ctypes.Structure):
        _fields_ = [
            ("BasicLimitInformation", JOBOBJECT_BASIC_LIMIT_INFORMATION),
            ("IoInfo", IO_COUNTERS),
            ("ProcessMemoryLimit", ctypes.c_size_t),
            ("JobMemoryLimit", ctypes.c_size_t),
            ("PeakProcessMemoryUsed", ctypes.c_size_t),
            ("PeakJobMemoryUsed", ctypes.c_size_t),
        ]

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

    def _windows_ensure_job_object():
        """Ensure Windows job object exists for process group management.

        Creates a job object that will kill child processes when the parent
        process terminates, ensuring proper cleanup.

        Returns:
            Job object handle

        Raises:
            OSError: If job object creation or configuration fails
        """
        global _windows_job_handle
        if _windows_job_handle:
            return _windows_job_handle

        hJob = kernel32.CreateJobObjectW(None, None)
        if not hJob:
            raise OSError(ctypes.get_last_error(), "CreateJobObjectW failed")

        info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION()
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE

        res = kernel32.SetInformationJobObject(
            hJob,
            JobObjectExtendedLimitInformation,
            ctypes.byref(info),
            ctypes.sizeof(info),
        )
        if not res:
            err = ctypes.get_last_error()
            kernel32.CloseHandle(hJob)
            raise OSError(err, "SetInformationJobObject failed")

        _windows_job_handle = hJob
        return _windows_job_handle

    kernel32.CreateJobObjectW.restype = wintypes.HANDLE
    kernel32.SetInformationJobObject.argtypes = [
        wintypes.HANDLE,
        wintypes.INT,
        wintypes.LPVOID,
        wintypes.DWORD,
    ]
    kernel32.SetInformationJobObject.restype = wintypes.BOOL
    kernel32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    kernel32.AssignProcessToJobObject.restype = wintypes.BOOL
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL


def set_pdeathsig() -> None:
    """Set parent death signal on POSIX systems.

    Configures the process to receive SIGTERM when the parent process dies,
    ensuring child processes are properly cleaned up.
    """
    if IS_POSIX and libc is not None:
        libc.prctl(1, signal.SIGTERM)


def popen_follow_parent(
    command: List[str], env: Optional[Dict[str, str]] = None
) -> subprocess.Popen:
    """Create a subprocess that will be terminated when parent dies.

    On POSIX systems, uses prctl to set parent death signal.
    On Windows, uses job objects to ensure child processes are killed
    when the parent terminates.

    Args:
        command: Command to execute as a list of strings
        env: Optional environment variables dictionary

    Returns:
        Popen object representing the started subprocess
    """
    if IS_POSIX:
        return subprocess.Popen(command, env=env, preexec_fn=set_pdeathsig)
    elif IS_WINDOWS:
        hJob = _windows_ensure_job_object()
        proc = subprocess.Popen(command, env=env)

        hProcess = wintypes.HANDLE(proc._handle)
        ok = kernel32.AssignProcessToJobObject(hJob, hProcess)
        if not ok:
            logging.warning(
                "AssignProcessToJobObject failed; child may outlive parent."
            )
        return proc
    else:
        return subprocess.Popen(command, env=env)

```

### Core Architecture Module: `ui/frontend/src/features/auth/hooks/useAuthMe.ts`
```
import { useQuery } from "@tanstack/react-query";
import { fetchCurrentUser } from "@/shared/api/auth";

export const AUTH_ME_QUERY_KEY = ["auth", "me"] as const;

export function useAuthMe() {
  return useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: fetchCurrentUser,
    staleTime: 60_000,
  });
}

```

### Core Architecture Module: `ui/frontend/src/features/auth/hooks/useAuthMutations.ts`
```
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  changePassword,
  login,
  logout,
  register,
  updateModelSettings,
  updateNickname,
} from "@/shared/api/auth";
import { AUTH_ME_QUERY_KEY } from "@/features/auth/hooks/useAuthMe";
import { CHAT_SESSIONS_QUERY_KEY } from "@/features/chat/hooks/useChatSessions";

export function useAuthMutations() {
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: CHAT_SESSIONS_QUERY_KEY });
    },
  });

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: CHAT_SESSIONS_QUERY_KEY });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: CHAT_SESSIONS_QUERY_KEY });
    },
  });

  const nicknameMutation = useMutation({
    mutationFn: updateNickname,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: changePassword,
  });

  const modelSettingsMutation = useMutation({
    mutationFn: updateModelSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
    },
  });

  return {
    loginMutation,
    registerMutation,
    logoutMutation,
    nicknameMutation,
    changePasswordMutation,
    modelSettingsMutation,
  };
}

```

### Core Architecture Module: `ui/frontend/src/features/chat/hooks/useChatSessions.ts`
```
import { useQuery } from "@tanstack/react-query";
import { fetchChatSessions } from "@/shared/api/chat";
import type { ChatSession } from "@/shared/api/types";

export const CHAT_SESSIONS_QUERY_KEY = ["chat", "sessions"] as const;

export function useChatSessions(enabled = true) {
  return useQuery<ChatSession[]>({
    queryKey: CHAT_SESSIONS_QUERY_KEY,
    queryFn: () => fetchChatSessions(300),
    staleTime: 10_000,
    enabled,
  });
}

```

### Core Architecture Module: `ui/frontend/src/features/pipeline/hooks/usePipelines.ts`
```
import { useQuery } from "@tanstack/react-query";
import { fetchPipelines } from "@/shared/api/pipelines";

export const PIPELINES_QUERY_KEY = ["pipelines", "list"] as const;

export function usePipelines() {
  return useQuery({
    queryKey: PIPELINES_QUERY_KEY,
    queryFn: fetchPipelines,
    staleTime: 15_000,
  });
}

```

### Core Architecture Module: `script/api_usage_example.py`
```
# Example for ToolCall usage with benchmark and retriever servers

from ultrarag.api import initialize, ToolCall


initialize(["benchmark", "retriever"], server_root="servers") 

benchmark_param_dict = {
    "key_map":{
      "gt_ls": "golden_answers",
      "q_ls": "question"
    },
    "limit": -1,
    "seed": 42,
    "name": "nq",
    "path": "data/sample_nq_10.jsonl",
    
}
benchmark = ToolCall.benchmark.get_data(benchmark_param_dict)

query_list = benchmark['q_ls']


retriever_init_param_dict = {
    "model_name_or_path": "Qwen/Qwen3-Embedding-0.6B",
}

ToolCall.retriever.retriever_init(
    **retriever_init_param_dict
)

result = ToolCall.retriever.retriever_search(
    query_list=query_list,
    top_k=5,
)

retrieve_passages = result['ret_psg']


# Example for PipelineCall usage with rag_deploy.yaml

from ultrarag.api import PipelineCall

result = PipelineCall(
    pipeline_file="examples/rag_deploy.yaml",
    parameter_file="examples/parameter/rag_deploy_parameter.yaml",
)

final_step_result = result['final_result']
all_steps_result = result['all_results']




```

### Core Architecture Module: `script/case_study.py`
```
# python ./script/case_study.py --data output/memory.json --host 0.0.0.0 --port 8080 --title "Case Study Viewer"


import argparse
import json
import os
from typing import Any, List

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse, FileResponse
from mimetypes import guess_type
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Case Study Viewer Service")


class State:
    data_path: str = ""
    data_files: List[str] = []
    title: str = "Case Study Viewer"
    cases: List[List[dict]] = []
    static_roots: List[str] = []


STATE = State()


def load_cases(path: str) -> List[List[dict]]:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Input file not found: {path}")

    def is_step(d: Any) -> bool:
        return isinstance(d, dict) and ("step" in d) and ("memory" in d)

    def is_case(obj: Any) -> bool:
        return isinstance(obj, list) and all(is_step(x) for x in obj)

    def normalize_case(obj: Any) -> List[dict] | None:
        if is_case(obj):
            return obj
        if isinstance(obj, dict):
            for k in ("steps", "case"):
                if k in obj and is_case(obj[k]):
                    return obj[k]
        return None

    def unwrap_container(obj: Any) -> Any:
        if isinstance(obj, dict):
            for k in (
                "cases",
                "data",
                "items",
                "dataset",
                "results",
                "records",
                "list",
            ):
                if k in obj:
                    return obj[k]
        return obj

    txt = open(path, "r", encoding="utf-8").read().strip()
    try:
        obj = json.loads(txt)
        obj = unwrap_container(obj)

        c = normalize_case(obj)
        if c is not None:
            return [c]

        if isinstance(obj, list):
            out: List[List[dict]] = []
            for elem in obj:
                elem = unwrap_container(elem)
                c = normalize_case(elem)
                if c is None:
                    raise ValueError(
                        "Dataset element is not a valid case; expected a list of {step,memory} or an object with 'steps'."
                    )
                out.append(c)
            if out:
                return out
    except Exception:
        pass

    out: List[List[dict]] = []
    with open(path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception as e:
                raise ValueError(f"Line {i} invalid JSON: {e}")
            obj = unwrap_container(obj)
            c = normalize_case(obj)
            if c is None:
                raise ValueError(
                    f"Line {i} is not a valid case (expect steps list or object with 'steps')."
                )
            out.append(c)
    if not out:
        raise ValueError("No valid cases found.")
    return out


def _estimate_case_count_from_steps(steps: List[dict]) -> int:
    max_len = 1
    for st in steps:
        mem = st.get("memory", {}) if isinstance(st, dict) else {}
        if isinstance(mem, dict):
            for v in mem.values():
                if isinstance(v, list):
                    max_len = max(max_len, len(v))
    return max_len


def _slice_case_by_index(steps: List[dict], idx: int) -> List[dict]:
    out_steps: List[dict] = []
    for st in steps:
        step_name = st.get("step")
        mem = st.get("memory", {})
        new_mem = {}
        if isinstance(mem, dict):
            for k, v in mem.items():
                if isinstance(v, list):
                    new_mem[k] = v[idx] if 0 <= idx < len(v) else None
                else:
                    new_mem[k] = v
        out_steps.append({"step": step_name, "memory": new_mem})
    return out_steps


def _expand_cases_if_needed(cases: List[List[dict]]) -> List[List[dict]]:
    expanded: List[List[dict]] = []
    for steps in cases:
        n = _estimate_case_count_from_steps(steps)
        if n <= 1:
            expanded.append(steps)
        else:
            for i in range(n):
                expanded.append(_slice_case_by_index(steps, i))
    return expanded


# Helper: collect image directories
def _collect_image_dirs(cases: List[List[dict]]) -> List[str]:
    """Scan cases to find directories that contain image paths so we can auto-serve them (supports nested arrays)."""
    exts = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg")
    dirs: set[str] = set()

    def add_if_image_path(v: Any):
        if isinstance(v, str) and v.lower().endswith(exts):
            d = os.path.dirname(v)
            if d:
                dirs.add(d)

    def walk(x: Any):
        if x is None:
            return
        if isinstance(x, list):
            for it in x:
                walk(it)
        elif isinstance(x, dict):
            for vv in x.values():
                walk(vv)
        else:
            add_if_image_path(x)

    for steps in cases or []:
        for st in steps or []:
            if isinstance(st, dict):
                mem = st.get("memory", {})
                walk(mem)

    return sorted(dirs)


def escape_html(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


CSS = r"""
:root {
  --bg-0: #f7f7f8; --bg-1: #ffffff; --bg-2: #efefef; --bg-3: #e5e5e5;
  --text-0: #1a1a1a; --text-1: #374151; --text-2: #6b7280;
  --border: #e3e3e3; --border-h: #d1d1d1;
  --accent: #2563eb; --accent-d: rgba(37,99,235,.08);
  --green: #059669; --green-d: rgba(5,150,105,.08);
  --r: 8px;
}
*{box-sizing:border-box;margin:0;padding:0}
html{height:100%}
body{min-height:100%;background:var(--bg-0);color:var(--text-0);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif;
  font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
.topbar{position:sticky;top:0;z-index:50;
  background:rgba(255,255,255,.88);backdrop-filter:saturate(180%) blur(14px);
  -webkit-backdrop-filter:saturate(180%) blur(14px);
  border-bottom:1px solid var(--border);padding:0 24px}
.topbar-row{display:flex;align-items:center;gap:10px;height:48px}
.topbar-title{font-size:15px;font-weight:700;color:var(--text-0);
  display:flex;align-items:center;gap:8px}
.topbar-icon{width:20px;height:20px;border-radius:5px;
  background:linear-gradient(135deg,#58a6ff,#3fb950)}
.topbar-badge{margin-left:auto;font-size:12px;font-weight:500;color:var(--text-2);
  background:var(--bg-2);border:1px solid var(--border);padding:2px 10px;border-radius:999px}
.topbar-sep{width:1px;height:20px;background:var(--border)}
.btn{appearance:none;border:1px solid var(--border);background:var(--bg-2);color:var(--text-1);
  padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;
  transition:all .12s;white-space:nowrap;line-height:20px}
.btn:hover:not(:disabled){background:var(--bg-3);border-color:var(--border-h);color:var(--text-0)}
.btn:active:not(:disabled){background:var(--bg-1)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn-group{display:inline-flex}
.btn-group .btn{border-radius:0;margin-left:-1px}
.btn-group .btn:first-child{border-radius:6px 0 0 6px;margin-left:0}
.btn-group .btn:last-child{border-radius:0 6px 6px 0}
select.file-select{background:var(--bg-2);border:1px solid var(--border);color:var(--text-0);
  padding:4px 10px;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;
  max-width:320px;line-height:20px;transition:border-color .12s}
select.file-select:hover{border-color:var(--border-h)}
select.file-select:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-d)}
select.file-select option{background:#fff;color:var(--text-0)}
.container{max-width:960px;margin:0 auto;padding:20px 20px 80px}
.overview{background:var(--bg-1);border:1px solid var(--border);border-radius:var(--r);
  padding:14px 16px;margin-bottom:12px}
.overview-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.overview-label{font-size:12px;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.4px}
.overview-count{font-size:12px;color:var(--text-2)}
.flow{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
.flow-chip{font-size:12px;font-weight:500;padding:2px 8px;border-radius:6px;
  background:var(--accent-d);color:var(--accent);border:1px solid rgba(56,139,253,.15)}
.flow-arr{color:var(--text-2);font-size:10px;padding:0 2px}
.step-card{background:var(--bg-1);border:1px solid var(--border);border-radius:var(--r);
  margin-bottom:8px;overflow:hidden;transition:border-color .12s}
.step-card:hover{border-color:var(--border-h)}
.step-header{display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;user-select:none}
.step-num{width:28px;height:28px;display:flex;align-items:center;justify-content:center;
  border-radius:6px;flex-shrink:0;background:var(--accent-d);color:var(--accent);
  font-size:12px;font-weight:700}
.step-info{flex:1;min-width:0}
.step-title{font-size:13px;font-weight:600;color:var(--text-0);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.step-sub{font-size:11px;color:var(--text-2);margin-top:1px}
.step-chev{color:var(--text-2);font-size:10px;transition:transform .2s ease;flex-shrink:0}
.step-chev.open{transform:rotate(90deg)}
.step-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .25s ease}
.step-body.open{grid-template-rows:1fr}
.step-body-inner{overflow:hidden}
.step-body.open .step-body-inner{padding:0 16px 14px;border-top:1px solid var(--border)}
.mem-item{margin-top:12px}
.mem-item:first-child{margin-top:10px}
.mem-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.mem-key{font-size:12px;font-weight:600;color:var(--green);
  font-family:'SF Mono',
```

### Core Architecture Module: `script/deploy_retriever_server.py`
```
import os
import sys
import argparse
from typing import List, Dict, Any, Optional

import orjson
from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, os.pardir))

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


RETRIEVER_SRC = os.path.join(PROJECT_ROOT, "servers", "retriever", "src")
if RETRIEVER_SRC not in sys.path:
    sys.path.insert(0, RETRIEVER_SRC)

from servers.retriever.src.retriever import Retriever, app  




def load_retriever_config(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        raise RuntimeError(f"Config file does not exist: {path}")

    with open(path, "rb") as f:
        cfg = orjson.loads(f.read())

    return cfg



class SearchRequest(BaseModel):
    query_list: List[str]
    top_k: int = 5
    query_instruction: str = ""
    collection_name: str = ""


class SearchResponse(BaseModel):
    ret_psg: List[List[str]]



fastapi_app = FastAPI(title="UltraRAG Retriever Service")

retriever: Optional[Retriever] = None   
retriever_cfg: Optional[Dict[str, Any]] = None


@fastapi_app.on_event("startup")
async def startup_event():

    global retriever, retriever_cfg

    assert retriever_cfg is not None, "retriever_cfg is not set"

    app.logger.info(f"[http retriever] Using configuration: {retriever_cfg}")

    retriever = Retriever(app)

    await retriever.retriever_init(
        model_name_or_path=retriever_cfg["model_name_or_path"],
        backend_configs=retriever_cfg["backend_configs"],
        batch_size=retriever_cfg.get("batch_size", 32),
        corpus_path=retriever_cfg["corpus_path"],
        gpu_ids=retriever_cfg.get("gpu_ids", "0"),
        is_multimodal=retriever_cfg.get("is_multimodal", False),
        backend=retriever_cfg.get("backend", "sentence_transformers"),
        index_backend=retriever_cfg.get("index_backend", "faiss"),
        index_backend_configs=retriever_cfg.get("index_backend_configs", {}),
        is_demo=retriever_cfg.get("is_demo", False),
        collection_name=retriever_cfg.get("collection_name", ""),
    )

    app.logger.info("[http retriever] retriever_init completed (corpus & index loaded)")


@fastapi_app.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest):

    global retriever

    assert retriever is not None, "Retriever is not initialized"

    rets = await retriever.retriever_search(
        query_list=req.query_list,
        top_k=req.top_k,
        query_instruction=req.query_instruction,
        collection_name=req.collection_name,
    )

    return SearchResponse(ret_psg=rets["ret_psg"])


def parse_args():
    parser = argparse.ArgumentParser(description="Standalone Retriever HTTP Service")
    parser.add_argument(
        "--config_path",
        type=str,
        default='script/deploy_retriever_config.json',
        help="Path to retriever_config.json",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Host address to bind the HTTP server",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=64501,
        help="Port to bind the HTTP server",
    )
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()

    retriever_cfg = load_retriever_config(args.config_path)

    uvicorn.run(
        fastapi_app,
        host=args.host,
        port=args.port,
        reload=False,
    )
```

### Core Architecture Module: `servers/benchmark/src/benchmark.py`
```
import json
import random
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd

from fastmcp.exceptions import NotFoundError, ToolError
from ultrarag.server import UltraRAG_MCP_Server


app = UltraRAG_MCP_Server("benchmark")


def _load_data_from_file(
    path: str | Path,
    limit: int,
) -> List[Dict[str, Any]]:
    """Load data from file in various formats (jsonl, json, parquet).

    Args:
        path: Path to the data file
        limit: Maximum number of records to load. -1 means no limit, 0 is invalid.

    Returns:
        List of dictionaries containing the loaded data

    Raises:
        ToolError: If file format is not supported
    """
    # Convert Path object to string for string operations
    path_str = str(path)
    data = []
    if path_str.endswith(".jsonl"):
        with open(path, "r", encoding="utf-8") as f:
            for i, line in enumerate(f):
                if i >= limit and limit > 0:
                    break
                data.append(json.loads(line))
    elif path_str.endswith(".json"):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if limit > 0:
                data = data[:limit]
    elif path_str.endswith(".parquet"):
        df = pd.read_parquet(path)
        data = df.to_dict(orient="records")
        if limit > 0:
            data = data[:limit]
    else:
        app.logger.error(
            f"Unsupported file format: ({path_str}). Supported: .jsonl, .json, .parquet"
        )
        raise ToolError(
            f"Unsupported file format: ({path_str}). Supported: .jsonl, .json, .parquet"
        )

    app.logger.info(f"Loaded from {path_str}")
    app.logger.debug(f"_load_data_from_file data: {data}")
    return data


def _load_from_local(
    path: str,
    key_map: Dict[str, str],
    limit: int,
    is_shuffle: bool = False,
    seed: int = 42,
) -> Dict[str, List[Any]]:
    """Load data from local file and map keys according to key_map.

    Args:
        path: Path to the data file
        key_map: Dictionary mapping alias keys to original keys in the data
        limit: Maximum number of records to load. -1 means no limit.
        is_shuffle: Whether to shuffle the data before limiting
        seed: Random seed for shuffling

    Returns:
        Dictionary with mapped keys containing lists of values
    """
    # Load all data if shuffling, otherwise load with limit
    data = _load_data_from_file(path, -1 if is_shuffle else limit)

    # Build every column from the same records. Filtering each column on its own
    # key drops a row from one column but not the others, which shifts the rest
    # of that column: downstream tools pair questions with ground truths by
    # position, so question i is then scored against another row's answer.
    required = list(key_map.values())
    complete = [item for item in data if all(key in item for key in required)]
    dropped = len(data) - len(complete)
    if dropped:
        app.logger.warning(
            f"Skipped {dropped} of {len(data)} records missing one of the "
            f"key_map keys {required}"
        )

    ret: Dict[str, List[Any]] = {}
    for alias, original_key in key_map.items():
        ret[alias] = [item[original_key] for item in complete]

    if is_shuffle:
        # Check if ret is empty before accessing values
        if not ret:
            app.logger.warning("No data found after key mapping")
            return ret

        length = len(next(iter(ret.values())))
        idx = list(range(length))
        random.seed(seed)
        random.shuffle(idx)
        idx = idx if limit == -1 else idx[:limit]
        for k in ret:
            ret[k] = [ret[k][i] for i in idx]
    else:
        if limit != -1:
            for k in ret:
                ret[k] = ret[k][:limit]

    app.logger.debug(ret)
    return ret


@app.tool(output="benchmark->q_ls,gt_ls")
def get_data(
    benchmark: Dict[str, Any],
) -> Dict[str, List[Any]]:
    """Load benchmark data from file with key mapping and optional shuffling.

    Args:
        benchmark: Dictionary containing:
            - path: Path to the data file (required)
            - key_map: Dictionary mapping alias keys to original keys (required)
            - shuffle: Whether to shuffle the data (default: False)
            - seed: Random seed for shuffling (default: 42)
            - limit: Maximum number of records to load, -1 for no limit (default: -1)
            - name: Name of the benchmark (optional)

    Returns:
        Dictionary with mapped keys containing lists of values

    Raises:
        NotFoundError: If path is missing or invalid
        ToolError: If key_map is invalid or limit is invalid
    """
    app.logger.info(f"Loading data: {benchmark.get('path')}")

    path = benchmark.get("path")
    key_map = benchmark.get("key_map", {})
    is_shuffle = benchmark.get("shuffle", False)
    seed = benchmark.get("seed", 42)
    limit = benchmark.get("limit", -1)

    if not path:
        err_msg = f"Benchmark path: {path} is required"
        app.logger.error(err_msg)
        raise NotFoundError(err_msg)

    if not isinstance(key_map, dict):
        err_msg = f"Benchmark parameter key_map: {key_map} must be a dictionary"
        app.logger.error(err_msg)
        raise ToolError(err_msg)

    if not key_map:
        err_msg = (
            f"Benchmark parameter key_map: {key_map} must contain at least one key"
        )
        app.logger.error(err_msg)
        raise ToolError(err_msg)

    if not isinstance(limit, int) or limit < -1:
        err_msg = (
            f"Benchmark parameter limit: {limit} must be a non-negative integer or -1"
        )
        app.logger.error(err_msg)
        raise ToolError(err_msg)

    if limit == 0:
        err_msg = f"Benchmark parameter limit: {limit} cannot be 0"
        app.logger.error(err_msg)
        raise ToolError(err_msg)

    data = _load_from_local(path, key_map, limit, is_shuffle, seed)

    app.logger.info(
        f"Loaded benchmark: name={benchmark.get('name')}, path={benchmark.get('path')}"
    )
    app.logger.debug(f"Benchmark: {data}")
    return data


if __name__ == "__main__":
    app.run(transport="stdio")

```

### Core Architecture Module: `servers/corpus/src/corpus.py`
```
import asyncio
import ast
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from contextlib import contextmanager, suppress
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple
from xml.etree import ElementTree as ET

from fastmcp.exceptions import ToolError
from PIL import Image
from tqdm import tqdm
from ultrarag.server import UltraRAG_MCP_Server


def _validate_path(user_path: str, allowed_base: Optional[str] = None) -> Path:
    """Validate and sanitize file path to prevent path traversal attacks.
    
    Args:
        user_path: User-provided file path
        allowed_base: Optional base directory to restrict paths to
        
    Returns:
        Resolved and validated Path object
        
    Raises:
        ValueError: If path traversal is detected or path is invalid
    """
    try:
        # Resolve the path to absolute
        safe_path = Path(user_path).resolve()
        
        # If allowed_base is provided, ensure path is within it
        if allowed_base:
            base_path = Path(allowed_base).resolve()
            try:
                # Check if safe_path is relative to base_path
                safe_path.relative_to(base_path)
            except ValueError:
                raise ValueError(
                    f"Path traversal detected: '{user_path}' is outside allowed directory '{allowed_base}'"
                )
        
        # Additional safety: check for suspicious patterns
        path_str = str(safe_path)
        if ".." in path_str or path_str.startswith("/etc/") or path_str.startswith("/proc/"):
            # Double check even after resolve
            if ".." in str(Path(user_path)):
                raise ValueError(f"Path traversal detected: '{user_path}' contains '..'")
        
        return safe_path
    except (OSError, ValueError) as e:
        if isinstance(e, ValueError):
            raise
        raise ValueError(f"Invalid path: {user_path}") from e

app = UltraRAG_MCP_Server("corpus")

_ANSI_ESCAPE_RE = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
_TQDM_PROGRESS_RE = re.compile(r"^(?P<name>[^:]{1,120}):\s*(?P<pct>\d{1,3})%")


def _iter_clean_subprocess_lines(raw_line: bytes) -> Iterable[str]:
    """Yield cleaned log lines from a subprocess stdout chunk."""
    text = raw_line.decode("utf-8", errors="replace")
    text = text.replace("\r", "\n")
    text = _ANSI_ESCAPE_RE.sub("", text)
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        if len(line) > 320:
            line = line[:317] + "..."
        yield line


def _extract_progress_update(line: str) -> Optional[Tuple[str, int]]:
    """Extract progress updates from tqdm-like lines."""
    if "|" not in line:
        return None
    match = _TQDM_PROGRESS_RE.match(line)
    if not match:
        return None
    name = match.group("name").strip()
    try:
        pct = int(match.group("pct"))
    except ValueError:
        return None
    return name, pct


def _can_render_live_tqdm() -> bool:
    """Whether current process should render local tqdm progress bars."""
    flag = os.getenv("ULTRARAG_MINERU_LIVE_TQDM", "1").strip().lower()
    if flag in {"0", "false", "no", "off"}:
        return False
    try:
        return sys.stderr.isatty()
    except Exception:
        return False


@contextmanager
def suppress_stdout():
    """Context manager to suppress stdout output."""
    stdout_fd = sys.stdout.fileno()
    saved_stdout_fd = os.dup(stdout_fd)

    try:
        devnull = os.open(os.devnull, os.O_WRONLY)
        os.dup2(devnull, stdout_fd)
        os.close(devnull)
        yield
    finally:
        os.dup2(saved_stdout_fd, stdout_fd)
        os.close(saved_stdout_fd)


def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _read_docx_text_zip(fp: str) -> Optional[str]:
    try:
        with zipfile.ZipFile(fp) as zf:
            if "word/document.xml" not in zf.namelist():
                return None
            xml_bytes = zf.read("word/document.xml")
    except zipfile.BadZipFile:
        return None
    except Exception as e:
        app.logger.warning(f"Docx zip read failed: {fp} | {e}")
        return None

    try:
        root = ET.fromstring(xml_bytes)
    except Exception as e:
        app.logger.warning(f"Docx xml parse failed: {fp} | {e}")
        return None

    paras: List[str] = []
    for p in root.iter():
        if _local_name(p.tag) != "p":
            continue
        buf: List[str] = []
        for node in p.iter():
            lname = _local_name(node.tag)
            if lname == "t":
                if node.text:
                    buf.append(node.text)
            elif lname == "tab":
                buf.append("\t")
            elif lname in ("br", "cr"):
                buf.append("\n")
        para_text = "".join(buf).strip()
        if para_text:
            paras.append(para_text)
    return "\n".join(paras)


def _read_docx_text(fp: str) -> Optional[str]:
    docx_import_error: Optional[Exception] = None
    try:
        from docx import Document
    except ImportError as e:
        docx_import_error = e
    else:
        try:
            doc = Document(fp)
            full_text = [para.text for para in doc.paragraphs]
            for table in doc.tables:
                for row in table.rows:
                    row_text = [cell.text for cell in row.cells]
                    full_text.append(" | ".join(row_text))
            return "\n".join(full_text)
        except Exception as e:
            app.logger.warning(f"Docx read failed (python-docx): {fp} | {e}")

    content = _read_docx_text_zip(fp)
    if content is not None:
        return content

    if docx_import_error is not None:
        err_msg = "python-docx not installed and docx zip parse failed. Please `pip install python-docx`."
        app.logger.error(err_msg)
        raise ToolError(err_msg)
    return None


def _find_office_cmd() -> Optional[str]:
    return shutil.which("soffice") or shutil.which("libreoffice")


def _convert_to_docx_with_office(fp: str, out_dir: str, office_cmd: str) -> Optional[str]:
    cmd = [
        office_cmd,
        "--headless",
        "--convert-to",
        "docx",
        "--outdir",
        out_dir,
        fp,
    ]
    try:
        subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
            timeout=60,
        )
    except Exception as e:
        app.logger.warning(f"Office convert failed: {fp} | {e}")
        return None

    expected = Path(out_dir) / f"{Path(fp).stem}.docx"
    if expected.exists():
        return str(expected)
    for p in Path(out_dir).glob("*.docx"):
        return str(p)
    return None


def _read_via_office_convert(fp: str) -> Optional[str]:
    office_cmd = _find_office_cmd()
    if not office_cmd:
        return None
    with tempfile.TemporaryDirectory(prefix="ultrarag_docx_") as tmpdir:
        out_path = _convert_to_docx_with_office(fp, tmpdir, office_cmd)
        if not out_path:
            return None
        return _read_docx_text(out_path)


def _save_jsonl(rows: Iterable[Dict[str, Any]], file_path: str) -> None:
    """Save rows to a JSONL file.

    Args:
        rows: Iterable of dictionaries to save
        file_path: Path to the output JSONL file
    """
    out_dir = Path(file_path).parent
    if out_dir and str(out_dir) != ".":
        os.makedirs(out_dir, exist_ok=True)

    with open(file_path, "w", encoding="utf-8", newline="\n") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def _load_jsonl(file_path: str) -> List[Dict[str, Any]]:
    """Load documents from a JSONL file.

    Args:
        file_path: Path to the JSONL file

    Returns:
        List of dictionaries loaded from the file
    """
    docs = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            docs.append(json.loads(line))
    return docs


def clean_text(text: str) -> str:
    """Clean text by normalizing whitespace and line breaks.

    Args:
        text: Input text to clean

    Returns:
        Cleaned text string
    """
    if not text:
        return ""
    text = text.replace("\u3000", " ")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def reflow_paragraphs(text: str) -> str:
    """Intelligently remove hard line breaks within paragraphs and merge incorrectly split paragraphs.

    The function:
    1) Splits by blank lines first; within a paragraph, if the previous line doesn't end with
       sentence-ending punctuation, merge it with the next line.
    2) If a paragraph doesn't end with sentence-ending punctuation and the next paragraph
       appears to be a continuation, merge across blank lines.
    3) Handles trailing hyphen word breaks.

    Args:
        text: Input text to reflow

    Returns:
        Reflowed text string
    """
    if not text:
        return ""

    text = text.replace("\r\n", "\n").replace("\r", "\n")

    end_punct_re = re.compile(r"[。！？!?；;…]\s*[”’」』》）】]*\s*$")
    next_start_re = re.compile(r'^[\u4e00-\u9fff0-9a-zA-Z“"‘’《（(【\[「『<]')

    def merge_lines_within_paragraph(para: str) -> str:
        lines = para.split("\n")
        segs: List[str] = []
        for ln in lines:
            ln = ln.strip()
            if not ln:
                continue
            if not segs:
                segs.append(ln)
                continue
            prev = segs[-1]
            should_join = not end_punct_re.search(prev)
            if should_join:
                if prev.endswith("-") and len(prev) > 1:
                    segs[-1] = prev[:-1] + ln
                else:
                    s
```

### Core Architecture Module: `servers/custom/src/custom.py`
```
import re
import json
import copy
from typing import List, Dict, Any

from ultrarag.server import UltraRAG_MCP_Server

app = UltraRAG_MCP_Server("custom")


@app.tool(output="ans_ls->extract_query_list")
def search_r1_query_extract(ans_ls: List[str]) -> Dict[str, List[str]]:
    """Extract search queries from answer list using <search> tags.

    Args:
        ans_ls: List of answer strings that may contain <search>...</search> tags

    Returns:
        Dictionary with 'extract_query_list' containing extracted queries
    """

    def get_query(text):
        pattern = re.compile(r"<search>([^<]*)", re.DOTALL)
        matches = pattern.findall(text)

        if matches:
            query = matches[-1].strip()
            if not query.endswith("?"):
                query += "?"
            return query
        else:
            return "There is no query."

    query = [get_query(answer) for answer in ans_ls]

    return {"extract_query_list": query}


@app.tool(output="ans_ls->extract_query_list")
def r1_searcher_query_extract(ans_ls: List[str]) -> Dict[str, List[str]]:
    """Extract search queries from answer list using <|begin_of_query|> tags.

    Args:
        ans_ls: List of answer strings that may contain <|begin_of_query|>...</|begin_of_query|> tags

    Returns:
        Dictionary with 'extract_query_list' containing extracted queries
    """

    def get_query(text):
        pattern = re.compile(r"<\|begin_of_query\|>([^<]*)", re.DOTALL)
        matches = pattern.findall(text)

        if matches:
            query = matches[-1].strip()
            if not query.endswith("?"):
                query += "?"
            return query
        else:
            return "There is no query."

    query = [get_query(answer) for answer in ans_ls]

    return {"extract_query_list": query}


@app.tool(output="q_ls,ret_psg->nextq_ls")
def iterretgen_nextquery(
    q_ls: List[str],
    ans_ls: List[str | Any],
) -> Dict[str, List[str]]:
    """Generate next query by combining previous query with answer.

    Args:
        q_ls: List of previous queries
        ans_ls: List of answers corresponding to queries

    Returns:
        Dictionary with 'nextq_ls' containing combined queries
    """
    ret = []
    for q, ans in zip(q_ls, ans_ls):
        next_query = f"{q} {ans}"
        ret.append(next_query)
    return {"nextq_ls": ret}


@app.tool(output="ans_ls->pred_ls")
def output_extract_from_boxed(ans_ls: List[str]) -> Dict[str, List[str]]:
    """Extract content from LaTeX \\boxed{} expressions in answers.

    Args:
        ans_ls: List of answer strings that may contain \\boxed{...} expressions

    Returns:
        Dictionary with 'pred_ls' containing extracted content
    """

    def extract(ans: str) -> str:
        start = ans.rfind(r"\boxed{")
        if start == -1:
            content = ans.strip()
        else:
            i = start + len(r"\boxed{")
            brace_level = 1
            end = i
            while end < len(ans) and brace_level > 0:
                if ans[end] == "{":
                    brace_level += 1
                elif ans[end] == "}":
                    brace_level -= 1
                end += 1
            content = ans[i : end - 1].strip()
            content = re.sub(r"^\$+|\$+$", "", content).strip()
            content = re.sub(r"^\\\(|\\\)$", "", content).strip()
            if content.startswith(r"\text{") and content.endswith("}"):
                content = content[len(r"\text{") : -1].strip()
            content = content.strip("()").strip()

        content = content.replace("\\", " ")
        content = content.replace("  ", " ")
        return content

    return {"pred_ls": [extract(ans) for ans in ans_ls]}


@app.tool(output="ans_ls->q_ls")
def ircot_get_first_sent(
    ans_ls: List[str],
) -> Dict[str, List[str]]:
    """Extract first sentence from answers for IRCoT pipeline.

    Args:
        ans_ls: List of answer strings

    Returns:
        Dictionary with 'q_ls' containing first sentences
    """
    ret = []
    for ans in ans_ls:
        match = re.search(r"(.+?[。！？.!?])", ans)
        if match:
            ret.append(match.group(1))
        else:
            ret.append(ans.strip())
    return {"q_ls": ret}


@app.tool(output="ans_ls->pred_ls")
def ircot_extract_ans(ans_ls: List[str]) -> Dict[str, List[str]]:
    """Extract final answer from IRCoT responses using 'so the answer is' pattern.

    Args:
        ans_ls: List of answer strings

    Returns:
        Dictionary with 'pred_ls' containing extracted answers
    """
    ret = []
    pattern = re.compile(r"so the answer is[\s:]*([^\n]*)", re.IGNORECASE)
    for ans in ans_ls:
        match = pattern.search(ans)
        if match:
            ret.append(match.group(1).strip())
        else:
            ret.append(ans.strip())
    return {"pred_ls": ret}


@app.tool(output="q_ls->total_subq_list,total_reason_list,total_final_info_list")
def search_o1_init_list(q_ls: List[str]) -> Dict[str, List[Any]]:
    """Initialize lists for Search-o1 pipeline.

    Args:
        q_ls: List of queries

    Returns:
        Dictionary with initialized lists for subq, reason, and final_info
    """
    n = len(q_ls)

    return {
        "total_subq_list": [["<PAD>"] for _ in range(n)],
        "total_reason_list": [["<PAD>"] for _ in range(n)],
        "total_final_info_list": [["<PAD>"] for _ in range(n)],
    }


@app.tool(
    output="total_subq_list, extract_query_list, total_reason_list, extract_reason_list"
    "->total_subq_list, total_reason_list"
)
def search_o1_combine_list(
    total_subq_list: List[List[Any]],
    extract_query_list: List[str],
    total_reason_list: List[List[Any]],
    extract_reason_list: List[str],
) -> Dict[str, List[Any]]:
    """Combine extracted queries and reasons into total lists for Search-o1.

    Args:
        total_subq_list: List of lists to accumulate subqueries
        extract_query_list: New queries to add
        total_reason_list: List of lists to accumulate reasons
        extract_reason_list: New reasons to add

    Returns:
        Dictionary with updated total_subq_list and total_reason_list
    """
    PAD = "<PAD>"

    for q, bucket in zip(extract_query_list, total_subq_list):
        if len(bucket) == 1 and bucket[0] == PAD:
            bucket[0] = q
        else:
            bucket.append(q)

    for c, bucket in zip(extract_reason_list, total_reason_list):
        if len(bucket) == 1 and bucket[0] == PAD:
            bucket[0] = c
        else:
            bucket.append(c)

    return {
        "total_subq_list": total_subq_list,
        "total_reason_list": total_reason_list,
    }


@app.tool(output="ans_ls->extract_query_list")
def search_o1_query_extract(ans_ls: List[str]) -> Dict[str, List[str]]:
    """Extract search queries from answers using Search-o1 tags.

    Args:
        ans_ls: List of answer strings containing <|begin_search_query|>...</|end_search_query|> tags

    Returns:
        Dictionary with 'extract_query_list' containing extracted queries
    """
    BEGIN = "<|begin_search_query|>"
    END = "<|end_search_query|>"
    PATTERN = re.escape(BEGIN) + r"(.*?)" + re.escape(END)

    def get_query(text):
        matches = re.findall(PATTERN, text, flags=re.DOTALL)
        if not matches:
            return ""
        q = matches[-1].strip()
        q = re.sub(r"\s+", " ", q).strip(" \"'")
        return q

    query = [get_query(answer) for answer in ans_ls]

    return {"extract_query_list": query}


@app.tool(output="ans_ls->extract_reason_list")
def search_o1_reasoning_extract(ans_ls: List[str]) -> Dict[str, List[str]]:
    """Extract reasoning content before search query tags for Search-o1.

    Args:
        ans_ls: List of answer strings

    Returns:
        Dictionary with 'extract_reason_list' containing reasoning content
    """
    BEGIN = "<|begin_search_query|>"

    def get_content_before(text):
        if BEGIN not in text:
            return text.strip()

        return text.split(BEGIN, 1)[0].strip()

    content_list = [get_content_before(answer) for answer in ans_ls]

    return {"extract_reason_list": content_list}


@app.tool(output="ans_ls->extract_final_infor_list")
def search_o1_extract_final_information(ans_ls: List[str]) -> Dict[str, List[str]]:
    """Extract final information section from answers for Search-o1.

    Args:
        ans_ls: List of answer strings that may contain **Final Information** section

    Returns:
        Dictionary with 'extract_final_infor_list' containing final information
    """
    BEGIN = "**Final Information**"

    def get_content_after(text):
        if BEGIN not in text:
            return ""

        return BEGIN + "\n" + text.split(BEGIN, 1)[1].strip()

    content_list = [get_content_after(answer) for answer in ans_ls]

    return {"extract_final_infor_list": content_list}


@app.tool(
    output="total_final_info_list, extract_final_infor_list->total_final_info_list"
)
def search_o1_combine_final_information(
    total_final_info_list: List[List[str]],
    extract_final_infor_list: List[str],
) -> Dict[str, List[Any]]:
    """Combine extracted final information into total list for Search-o1.

    Args:
        total_final_info_list: List of lists to accumulate final information
        extract_final_infor_list: New final information to add

    Returns:
        Dictionary with updated total_final_info_list
    """
    PAD = "<PAD>"

    for c, bucket in zip(extract_final_infor_list, total_final_info_list):
        if len(bucket) == 1 and bucket[0] == PAD:
            bucket[0] = c
        else:
            bucket.append(c)

    app.logger.warning(f"len total_final_info_list: {len(total_final_info_list)}")
    app.logger.warning(f"total_final_info_list: {total_final_info_list}")

    return {
        "total_final_info_list": total_final_info_list,
    }


@app.tool(output="temp_psg,ret_psg->ret_psg")
def merge_passages(
    temp_psg: List[str | Any],
    ret_psg: List[str | A
```

### Core Architecture Module: `servers/evaluation/src/evaluation.py`
```
import json
import os
import re
import string
import random
from collections import Counter
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from rouge_score import rouge_scorer
from tabulate import tabulate

from ultrarag.server import UltraRAG_MCP_Server

app = UltraRAG_MCP_Server("evaluation")

# Initialize the Rouge scorer for ROUGE metrics
_rouge_scorer = rouge_scorer.RougeScorer(
    ["rouge1", "rouge2", "rougeL"],
    use_stemmer=True,
)


def normalize_text(text: str) -> str:
    """Normalize text for evaluation by applying multiple transformations.

    Args:
        text: Input text to normalize

    Returns:
        Normalized text string
    """

    def _bool_mapping(s: str) -> str:
        return {"True": "yes", "False": "no"}.get(s, s)

    def _remove_articles(t: str) -> str:
        # Article stripping must not consume the whole answer. A multiple-choice
        # gold of "A" (prompt/qa_boxed_multiple_choice labels options with
        # string.ascii_uppercase) normalizes to "" otherwise, and an empty
        # string is a substring of every prediction, so acc and coverem score
        # 1.0 against any answer. Keep the un-stripped form in that case.
        stripped = re.sub(r"\b(a|an|the)\b", " ", t)
        return t if not stripped.strip() else stripped

    def _white_space_fix(t: str) -> str:
        return " ".join(t.split())

    def _remove_punc(t: str) -> str:
        exclude = set(string.punctuation + "".join(["‘", "’", "´", "`"]))
        return "".join(ch if ch not in exclude else " " for ch in t)

    def _lower(t: str) -> str:
        return t.lower()

    def _replace_underscore(t: str) -> str:
        return t.replace("_", " ")

    for func in [
        _bool_mapping,
        _replace_underscore,
        _lower,
        _remove_punc,
        _remove_articles,
        _white_space_fix,
    ]:
        text = func(text)
    return text.strip()


def accuracy_score(gt: List[str], pred: str) -> float:
    """Calculate accuracy score: 1.0 if any ground truth is contained in prediction, else 0.0.

    Args:
        gt: List of ground truth strings
        pred: Prediction string

    Returns:
        Accuracy score (0.0 or 1.0)
    """
    pred_norm = normalize_text(pred)
    if not pred_norm:
        return 0.0
    gt_norm_ls = [normalize_text(g) for g in gt]
    return 1.0 if any(g in pred_norm for g in gt_norm_ls) else 0.0


def exact_match_score(gt: List[str], pred: str) -> float:
    """Calculate exact match score: 1.0 if prediction exactly matches any ground truth, else 0.0.

    Args:
        gt: List of ground truth strings
        pred: Prediction string

    Returns:
        Exact match score (0.0 or 1.0)
    """
    pred_norm = normalize_text(pred)
    gt_norm_ls = [normalize_text(g) for g in gt]
    return 1.0 if any(pred_norm == g for g in gt_norm_ls) else 0.0


def cover_exact_match_score(gt: List[str], pred: str) -> float:
    """Calculate cover exact match score: 1.0 if all tokens of any ground truth are in prediction.

    Args:
        gt: List of ground truth strings
        pred: Prediction string

    Returns:
        Cover exact match score (0.0 or 1.0)
    """
    pred_norm = normalize_text(pred)
    gt_norm_ls = [normalize_text(g) for g in gt]

    pred_tokens = pred_norm.split()
    gt_tokens_ls = [g.split() for g in gt_norm_ls]

    for gt_tokens in gt_tokens_ls:
        if all(token in pred_tokens for token in gt_tokens):
            return 1.0
    return 0.0


def string_em_score(gt: List[str], pred: str) -> float:
    """Calculate string exact match score: fraction of ground truths that exactly match prediction.

    Args:
        gt: List of ground truth strings
        pred: Prediction string

    Returns:
        String exact match score (0.0 to 1.0)
    """
    pred_norm = normalize_text(pred)
    gt_norm_ls = [normalize_text(g) for g in gt]

    match_cnt = sum(1 for g in gt_norm_ls if pred_norm == g)
    return match_cnt / len(gt_norm_ls) if gt_norm_ls else 0.0


def f1_score(gt: List[str], pred: str) -> float:
    """Calculate F1 score: maximum F1 score between prediction and any ground truth.

    Args:
        gt: List of ground truth strings
        pred: Prediction string

    Returns:
        F1 score (0.0 to 1.0)
    """

    def calc_f1(gt_str: str, pred_str: str) -> float:
        pred_norm = normalize_text(pred_str)
        gt_norm = normalize_text(gt_str)

        pred_tokens = pred_norm.split()
        gt_tokens = gt_norm.split()
        if not pred_tokens or not gt_tokens:
            return 0.0

        common = Counter(pred_tokens) & Counter(gt_tokens)
        num_same = sum(common.values())

        precision = 1.0 * num_same / len(pred_tokens)
        recall = 1.0 * num_same / len(gt_tokens)

        if precision + recall == 0:
            return 0.0

        f1 = (2 * precision * recall) / (precision + recall)
        return f1

    scores = [calc_f1(g, pred) for g in gt]
    return max(scores) if scores else 0.0


def rouge1_score(gt: List[str], pred: str) -> float:
    """Calculate ROUGE-1 score: maximum ROUGE-1 F-measure between prediction and any ground truth.

    Args:
        gt: List of ground truth strings
        pred: Prediction string

    Returns:
        ROUGE-1 score (0.0 to 1.0)
    """
    pred_norm = normalize_text(pred)
    gt_norm_ls = [normalize_text(g) for g in gt]
    scores = []
    for g in gt_norm_ls:
        score = _rouge_scorer.score(g, pred_norm)["rouge1"].fmeasure
        scores.append(score)
    return max(scores) if scores else 0.0


def rouge2_score(gt: List[str], pred: str) -> float:
    """Calculate ROUGE-2 score: maximum ROUGE-2 F-measure between prediction and any ground truth.

    Args:
        gt: List of ground truth strings
        pred: Prediction string

    Returns:
        ROUGE-2 score (0.0 to 1.0)
    """
    pred_norm = normalize_text(pred)
    gt_norm_ls = [normalize_text(g) for g in gt]
    scores = []
    for g in gt_norm_ls:
        score = _rouge_scorer.score(g, pred_norm)["rouge2"].fmeasure
        scores.append(score)
    return max(scores) if scores else 0.0


def rougel_score(gt: List[str], pred: str) -> float:
    """Calculate ROUGE-L score: maximum ROUGE-L F-measure between prediction and any ground truth.

    Args:
        gt: List of ground truth strings
        pred: Prediction string

    Returns:
        ROUGE-L score (0.0 to 1.0)
    """
    pred_norm = normalize_text(pred)
    gt_norm_ls = [normalize_text(g) for g in gt]
    scores = []
    for g in gt_norm_ls:
        score = _rouge_scorer.score(g, pred_norm)["rougeL"].fmeasure
        scores.append(score)
    return max(scores) if scores else 0.0


def compute_metrics(
    gt_list: List[List[str]],
    pred_list: List[str],
    metrics: List[str] | None = None,
) -> Dict[str, float]:
    """Compute evaluation metrics for predictions against ground truths.

    Args:
        gt_list: List of ground truth lists (one per prediction)
        pred_list: List of prediction strings
        metrics: List of metric names to compute (default: all available metrics)

    Returns:
        Dictionary containing per-sample scores and average scores for each metric
    """
    METRICS_REGISTRY: Dict[str, Callable[[List[str], str], float]] = {
        "acc": accuracy_score,
        "em": exact_match_score,
        "stringem": string_em_score,
        "coverem": cover_exact_match_score,
        "f1": f1_score,
        "rouge-1": rouge1_score,
        "rouge-2": rouge2_score,
        "rouge-l": rougel_score,
    }
    if not metrics:
        metrics = list(METRICS_REGISTRY.keys())
    metrics = [m.lower() for m in metrics]
    results = {metric: [] for metric in metrics}

    for gt, pred in zip(gt_list, pred_list):
        for metric in metrics:
            if metric in METRICS_REGISTRY:
                score = METRICS_REGISTRY[metric](gt, pred)
                results[metric].append(score)
            else:
                warn_msg = f"Metric '{metric}' is not recognized. Available metrics: {', '.join(METRICS_REGISTRY.keys())}."
                app.logger.warning(warn_msg)

    avg_results = {}
    for metric, scores in results.items():
        if not scores:
            avg_results[f"avg_{metric}"] = 0.0
            continue
        avg_results[f"avg_{metric}"] = sum(scores) / len(scores)
    return {**results, **avg_results}


def _load_qrels(qrels_path: str) -> Dict[str, Dict[str, int]]:
    """Load TREC qrels file.

    Format: <qid> <iter> <docid> <rel>

    Args:
        qrels_path: Path to qrels file

    Returns:
        Dictionary mapping qid to docid to relevance score
    """
    qrel: Dict[str, Dict[str, int]] = {}  # {qid: {docid: rel_int}}
    with open(qrels_path, "r", encoding="utf-8") as f:
        for line in f:
            p = line.strip().split()  # <qid> <iter> <docid> <rel>
            if len(p) < 4:
                continue
            qid, _, docid, rel = p[0], p[1], p[2], p[3]
            try:
                rel_i = int(rel)
            except ValueError:
                rel_i = 1 if rel != "0" else 0
            qrel.setdefault(qid, {})[docid] = rel_i
    return qrel


def _load_run(run_path: str) -> Dict[str, Dict[str, float]]:
    """Load TREC run file.

    Format: <qid> Q0 <docid> <rank> <score> <tag>

    Args:
        run_path: Path to run file

    Returns:
        Dictionary mapping qid to docid to score
    """
    run: Dict[str, Dict[str, float]] = {}  # {qid: {docid: score_float}}
    with open(run_path, "r", encoding="utf-8") as f:
        for line in f:
            p = line.strip().split()  # <qid> Q0 <docid> <rank> <score> <tag>
            if len(p) < 6:
                continue
            qid, docid, score = p[0], p[2], p[4]
            try:
                s = float(score)
            except ValueError:
                s = 0.0
            run.setdefault(qid, {})[docid] = s
    return run


def _mean(xs) -> float:
    """Calculate mean of a list o
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #502** (2026-09-02): **fix: preload FAISS selectively on Windows**
  *Symptoms*: ## Summary  - preload FAISS before FastMCP starts on Windows to avoid the native OpenMP/BLAS loading hang - enable the preload only for non-demo pipelines configured with `index_backend: faiss` - leave demo, non-FAISS, macOS, and Linux startup behavior unchanged  ## Validation  - `ultrarag build <pipeline>` — passed - non-demo FAISS `ultrarag run <pipeline> --param <parameter>` — passed with `faiss-cpu 1.15.0`; indexed 4 test vectors - non-demo Milvus pipeline with a fail-on-import fake FAISS module — passed, confirming FAISS was not imported - demo pipeline with FAISS in the parameter file but Milvus forced at runtime — passed, confirming FAISS was not imported - targeted Ruff checks, `compileall`, `pip check`, and `git diff --check` — passed  ## Why  On Windows, importing some FAISS builds for the first time after FastMCP has started its stdio event loop can hang the retriever process. Importing FAISS before server startup avoids the hang, but doing so for every retriever pipeline would affect users of other index backends. The client therefore passes a one-process environment flag only for the affected non-demo FAISS pipeline.

- **Issue #439** (2026-09-08): **fix(custom): escape pipes in r1_searcher_query_extract tag regex**
  *Symptoms*: ## Bug  `r1_searcher_query_extract` extracts the wrong text because its tag regex has unescaped pipes:  ```python pattern = re.compile(r"<|begin_of_query|>([^<]*)", re.DOTALL) ```  In a regex `|` is alternation, so this matches `<` **or** `begin_of_query` **or** `>([^<]*)` — not the literal `<|begin_of_query|>` tag the function intends (and that its docstring documents).  ### Reproduction  ```python text = "Reasoning... <|begin_of_query|>capital of France<|end_of_query|> done" r1_searcher_query_extract([text]) # before: {'extract_query_list': ['done?']}              <- trailing text, wrong # after:  {'extract_query_list': ['capital of France?']} ```  `findall` on the buggy pattern returns `['', '', 'capital of France', '', ' done']`, and `get_query` takes `matches[-1]` → `' done'`, so the extracted "query" is whatever trails the tag.  ## Fix  Escape the pipes so the literal tag is matched:  ```python pattern = re.compile(r"<\|begin_of_query\|>([^<]*)", re.DOTALL) ```  The sibling `<search>` extractor is unaffected (no pipes).  ## Tests  Adds `tests/servers/custom/test_query_extract.py` covering correct extraction, last-query selection, the `?` suffix, and the no-tag fallback. `pytest` is already declared as a dev dependency; these are the first tests in the repo. All 4 pass locally. 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the fix!

- **Issue #433** (2026-05-29): **fix: update AgentCPM-Report pipeline**
  *Symptoms*: 

- **Issue #388** (2026-04-09): **fix: builder error caused by fastmcp 3.x & configs for demo**
  *Symptoms*: 

- **Issue #385** (2026-04-08): **fix: async func error mentioned in #349**
  *Symptoms*: 

- **Issue #349** (2026-04-08): **部署 Retriever Server后进行在线检索时报错**
  *Symptoms*: 进行ultrarag run examples/deploy_corpus_search.yaml后，报如下错误： `AttributeError: 'Retriever' object has no attribute 'backend，错误发生在 `servers/retriever/src/retriever.py` 第 883 行。  错误原因：在 deploy_retriever_server.py:67 ：retriever.retriever_init(......)缺少await 。  加上await之后就可以正确运行了 
  **Post-Mortem & Fix Analysis**:
  > 感谢您的反馈，我们将在后续版本中修复这个问题~

- **Issue #301** (2026-07-17): **win10下运行CPU版本遇到了docker部署的parameter.cpu.yaml未生效问题**
  *Symptoms*: retriever.py 第268行 `   infinity_engine_args = EngineArgs(     model_name_or_path=model_name_or_path,     batch_size=self.batch_size,     device=self.device,     **self.cfg, ) ` 这里的self.cfg是{}空对象 我机器出现如下报错，需要加上bettertransformer=False才能正常入向量库 <img width="985" height="696" alt="Image" src="https://github.com/user-attachments/assets/925a874b-219b-495c-a2f2-ae736e53d998" />
  **Post-Mortem & Fix Analysis**:
  > @Kaguya-19 
  > 你好，感谢关注！  我们在 main 分支的最新版 UltraRAG 中已经正式支持了 AgentCPM-Report 的实现。具体的实现细节和使用指南可以参考我们的官方文档： 📖 [DeepResearch Demo - UltraRAG](https://ultrarag.openbmb.cn/pages/cn/demo/deepresearch)  建议更新到最新版本后尝试，如有其他问题欢迎随时反馈。
  > 我看一下哈

- **Issue #298** (2026-02-02): **安装corpus报错？**
  *Symptoms*: <img width="2062" height="1036" alt="Image" src="https://github.com/user-attachments/assets/c462b71c-fc15-4133-85df-cc05fb7e5cb9" /> conda环境安装，试了pip install -e ".[all]" 命令，如上图一直报错，后续一层层安装，执行顺序如下： pip install -e ".[retriever]" pip install -e ".[generator]" python -m pip install -e ".[evaluation]" 这些都没问题，只在pip install -e ".[corpus]"时报错了，请问这个有解决办法吗？ 
  **Post-Mortem & Fix Analysis**:
  > @soundmemories 你好！感谢反馈。报错 `resolution-too-deep` 主要是由于 `mineru` 依赖树较为复杂，导致 `pip` 默认解析器无法处理。建议尝试以下方案：  - 方案一：使用 uv 安装（推荐，解析速度更快且更稳定） 如果你已经安装了 uv，请尝试：  ```bash uv pip install -e ".[corpus]" ```  - 方案二：尝试分步安装并升级 `pip`，如果坚持使用 `pip`，建议先更新 `pip` 并手动安装 `mineru`，再安装项目可选依赖：  ```bash python -m pip install --upgrade pip pip install "mineru[core]" pip install -e ".[corpus]" ```  - 方案三：使用清华源或其他镜像时尝试关闭缓存 有时缓存的旧版本元数据也会干扰解析，可以尝试：  ```bash pip install -e ".[corpus]" --no-cache-dir ```  如果以上方法仍未解决，请参考 `mineru` 的官方安装教程：https://github.com/opendatalab/MinerU 。
  > @xhd0728 感谢，按照您的方法安装成功了，问题已解决！

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

### Incident Patch 1: `a763d344` (2026-09-19)
**Commit Message**: fix(retriever): skip FAISS padding slots instead of returning the last document (#518)

FAISS fills the result with -1 when the index holds fewer vectors than the
requested `top_k`. `BaseIndexBackend.contents` is a plain list, so reading
`contents[-1]` for those slots returned the LAST document rather than a miss:
a 3-passage index queried with `top_k=5` came back as 5 passages, two of them
copies of the last one. Downstream that padding is indistinguishable from a
real hit, so it is fed to the generator as retrieved evidence.

Skip the -1 slots. The other backends are unaffected because they look the
content up by the payload the store returns, not by position.

Verified with a 3-vector index and top_k=5: before, FAISS returned
[0, 2, 1, -1, -1] and the backend produced
['DOC_A', 'DOC_C', 'DOC_B', 'DOC_C', 'DOC_C']; after, it produces
['DOC_A', 'DOC_C', 'DOC_B'].

**File**: `servers/retriever/src/index_backends/faiss_backend.py` (modified, +5/-0)
```diff
@@ -206,6 +206,11 @@ def search(
         for doc_ids in indices:
             cur_ret = []
             for doc_id in doc_ids:
+                # FAISS pads the result with -1 when the index holds fewer than
+                # `top_k` vectors. Indexing `contents` with -1 would silently
+                # return the LAST document instead of signalling a miss.
+                if doc_id == -1:
+                    continue
                 cur_ret.append(self.contents[doc_id])
             results.append(cur_ret)
         return results
```

**File**: `tests/servers/retriever/test_faiss_search_padding.py` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+"""Tests for FAISS result handling in the ``retriever`` MCP server.
+
+FAISS pads its result with ``-1`` when the index holds fewer vectors than the
+requested ``top_k``. ``BaseIndexBackend.contents`` is a plain list, so indexing
+it with ``-1`` returns the *last* document instead of signalling a miss: the
+padding used to surface as duplicated passages, and in a RAG pipeline those
+passages feed the generator as if they were retrieved evidence.
+
+``faiss`` is an optional extra, so the module is skipped when it is missing.
+
+    uv sync --extra retriever
+    uv run pytest tests/servers/retriever/test_faiss_search_padding.py -v
+"""
+
+import sys
+from pathlib import Path
+
+import numpy as np
+import pytest
+
+RETRIEVER_SRC = Path(__file__).resolve().parents[3] / "servers" / "retriever" / "src"
+sys.path.insert(0, str(RETRIEVER_SRC))
+
+faiss = pytest.importorskip("faiss")
+
+from index_backends.faiss_backend import FaissIndexBackend
+
+
+class _Logger:
+    def info(self, *args, **kwargs):
+        pass
+
+    def warning(self, *args, **kwargs):
+        pass
+
+    def error(self, *args, **kwargs):
+        pass
+
+
+CONTENTS = ["DOC_A", "DOC_B", "DOC_C"]
+
+# Points straight at DOC_A so the expected top hit is unambiguous.
+QUERY = np.array([[1.0, 0.0, 0.0]], dtype=np.float32)
+
+
+def _backend(tmp_path, contents=CONTENTS):
+    """A backend holding one orthogonal embedding per passage."""
+    backend = FaissIndexBackend(
+        contents=contents,
+        config={"index_path": str(tmp_path / "index.index")},
+        logger=_Logger(),
+    )
+    dim = len(contents)
+    backend.build_index(
+        embeddings=np.eye(dim, dtype=np.float32),
+        ids=np.array(list(range(dim)), dtype=np.int64),
+    )
+    return backend
+
+
+def test_padding_slots_are_not_returns_as_the_last_document(tmp_path):
+    backend = _backend(tmp_path)
+
+    hits = backend.search(QUERY, top_k=5)[0]
+
+    # Before the fix FAISS returned [0, 2, 1, -1, -1]; the two -1 slots were
+    # read as contents[-1], so three passages came back as five, two of them
+    # copies of the last document.
+    assert hits == ["DOC_A", "DOC_C", "DOC_B"], hits
+    assert len(set(hits)) == len(hits), f"duplicated passages returned: {hits}"
+
+
+def test_top_k_below_index_size_still_returns_top_k(tmp_path):
+    backend = _backend(tmp_path)
+
+    hits = backend.search(QUERY, top_k=2)[0]
+
+    assert len(hits) == 2
+    assert hits[0] == "DOC_A"
+
+
+def test_top_k_equal_to_index_size_returns_every_passage_once(tmp_path):
+    backend = _backend(tmp_path)
+
+    hits = backend.search(QUERY, top_k=3)[0]
+
+    assert sorted(hits) == sorted(CONTENTS)
+
+
+def test_single_passage_index_does_not_repeat_padding(tmp_path):
+    backend = _backend(tmp_path, contents=["ONLY_DOC"])
+
+    hits = backend.search(np.array([[1.0]], dtype=np.float32), top_k=3)[0]
+
+    assert hits == ["ONLY_DOC"]
```

---

### Incident Patch 2: `c696cf8e` (2026-09-15)
**Commit Message**: fix(evaluation): keep answers that are entirely articles (#510)

**File**: `servers/evaluation/src/evaluation.py` (modified, +7/-1)
```diff
@@ -35,7 +35,13 @@ def _bool_mapping(s: str) -> str:
         return {"True": "yes", "False": "no"}.get(s, s)
 
     def _remove_articles(t: str) -> str:
-        return re.sub(r"\b(a|an|the)\b", " ", t)
+        # Article stripping must not consume the whole answer. A multiple-choice
+        # gold of "A" (prompt/qa_boxed_multiple_choice labels options with
+        # string.ascii_uppercase) normalizes to "" otherwise, and an empty
+        # string is a substring of every prediction, so acc and coverem score
+        # 1.0 against any answer. Keep the un-stripped form in that case.
+        stripped = re.sub(r"\b(a|an|the)\b", " ", t)
+        return t if not stripped.strip() else stripped
 
     def _white_space_fix(t: str) -> str:
         return " ".join(t.split())
```

**File**: `tests/servers/evaluation/test_normalize_text.py` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+"""Tests for evaluation-metric normalization in the ``evaluation`` MCP server.
+
+The ``evaluation`` server lives under ``servers/evaluation/src`` rather than
+inside the installable ``ultrarag`` package. Importing the module directly would
+pull in the MCP app and the rouge scorer, so the pure functions under test are
+lifted out of the source with ``ast`` instead.
+"""
+
+import ast
+import re
+import string
+from pathlib import Path
+from typing import List
+
+EVALUATION_SRC = (
+    Path(__file__).resolve().parents[3] / "servers" / "evaluation" / "src" / "evaluation.py"
+)
+
+_WANTED = {
+    "normalize_text",
+    "accuracy_score",
+    "exact_match_score",
+    "cover_exact_match_score",
+}
+
+
+def _load():
+    tree = ast.parse(EVALUATION_SRC.read_text())
+    module = ast.Module(
+        body=[
+            node
+            for node in tree.body
+            if isinstance(node, ast.FunctionDef) and node.name in _WANTED
+        ],
+        type_ignores=[],
+    )
+    namespace = {"re": re, "string": string, "List": List}
+    exec(compile(module, str(EVALUATION_SRC), "exec"), namespace)
+    return namespace
+
+
+_NS = _load()
+normalize_text = _NS["normalize_text"]
+accuracy_score = _NS["accuracy_score"]
+exact_match_score = _NS["exact_match_score"]
+cover_exact_match_score = _NS["cover_exact_match_score"]
+
+
+def test_single_letter_answer_survives_normalization():
+    # qa_boxed_multiple_choice labels options with string.ascii_uppercase, so
+    # "A" is a real gold value. Stripping it to "" makes it match everything.
+    assert normalize_text("A") == "a"
+
+
+def test_article_only_answer_survives_normalization():
+    assert normalize_text("the") == "the"
+
+
+def test_accuracy_rejects_a_wrong_multiple_choice_answer():
+    assert accuracy_score(["A"], "D") == 0.0
+
+
+def test_accuracy_accepts_a_correct_multiple_choice_answer():
+    assert accuracy_score(["A"], "A") == 1.0
+
+
+def test_cover_exact_match_rejects_a_wrong_multiple_choice_answer():
+    assert cover_exact_match_score(["A"], "D") == 0.0
+
+
+def test_cover_exact_match_accepts_a_correct_multiple_choice_answer():
+    # Regression guard: passes with and without the fix, because an empty
+    # token list also matched. It pins the behaviour the fix must not break.
+    assert cover_exact_match_score(["A"], "A") == 1.0
+
+
+def test_articles_are_still_stripped_inside_a_longer_answer():
+    # Regression guard: passes with and without the fix.
+    assert normalize_text("The Beatles") == "beatles"
+    assert accuracy_score(["the beatles"], "Beatles") == 1.0
+
+
+def test_unaffected_option_letters_are_unchanged():
+    # Regression guard: passes with and without the fix.
+    assert accuracy_score(["B"], "D") == 0.0
+    assert accuracy_score(["B"], "B") == 1.0
```

---

### Incident Patch 3: `e9820f7d` (2026-09-15)
**Commit Message**: chore(deps): bump js-yaml from 4.3.1 to 4.3.2 in /ui/frontend (#506)

Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 4.3.1 to 4.3.2.
- [Changelog](https://github.com/nodeca/js-yaml/blob/4.3.2/CHANGELOG.md)
- [Commits](https://github.com/nodeca/js-yaml/compare/4.3.1...4.3.2)

---
updated-dependencies:
- dependency-name: js-yaml
  dependency-version: 4.3.2
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `ui/frontend/package-lock.json` (modified, +4/-4)
```diff
@@ -19,7 +19,7 @@
         "clsx": "^2.1.1",
         "dompurify": "^3.4.13",
         "highlight.js": "^11.11.1",
-        "js-yaml": "^4.3.1",
+        "js-yaml": "^4.3.2",
         "katex": "^0.16.33",
         "lucide-react": "^0.576.0",
         "marked": "^17.0.3",
@@ -3228,9 +3228,9 @@
       "license": "MIT"
     },
     "node_modules/js-yaml": {
-      "version": "4.3.1",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.1.tgz",
-      "integrity": "sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==",
+      "version": "4.3.2",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.2.tgz",
+      "integrity": "sha512-SFNOvSJ+Dgf/9An904Yx+CgSlIPCkIpao4qo51lpee25TIRejdH3rhR4EZMGoNx3/TP3O+wzWuiTFl4sqbltzA==",
       "funding": [
         {
           "type": "github",
```

**File**: `ui/frontend/package.json` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@
     "clsx": "^2.1.1",
     "dompurify": "^3.4.13",
     "highlight.js": "^11.11.1",
-    "js-yaml": "^4.3.1",
+    "js-yaml": "^4.3.2",
     "katex": "^0.16.33",
     "lucide-react": "^0.576.0",
     "marked": "^17.0.3",
```

---

### Incident Patch 4: `0ba52ed6` (2026-09-08)
**Commit Message**: fix(custom): escape pipes in r1_searcher_query_extract tag regex (#439)

The tag regex used unescaped pipes: re.compile(r"<|begin_of_query|>([^<]*)").
In a regex `|` is alternation, so the pattern matched `<` OR `begin_of_query`
OR `>([^<]*)` instead of the literal tag `<|begin_of_query|>`. The extractor
therefore returned trailing text after the query rather than the query itself.

For "... <|begin_of_query|>capital of France<|end_of_query|> done" get_query()
returned "done?" instead of "capital of France?".

Escape the pipes so the literal tag is matched, and add the first test suite for
the custom server covering this extractor.

**File**: `servers/custom/src/custom.py` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ def r1_searcher_query_extract(ans_ls: List[str]) -> Dict[str, List[str]]:
     """
 
     def get_query(text):
-        pattern = re.compile(r"<|begin_of_query|>([^<]*)", re.DOTALL)
+        pattern = re.compile(r"<\|begin_of_query\|>([^<]*)", re.DOTALL)
         matches = pattern.findall(text)
 
         if matches:
```

**File**: `tests/servers/custom/test_query_extract.py` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+"""Tests for the query-extraction tools in the ``custom`` MCP server.
+
+The ``custom`` server lives under ``servers/custom/src`` rather than inside the
+installable ``ultrarag`` package, so its module is made importable here without
+installing each server separately.
+"""
+
+import sys
+from pathlib import Path
+
+CUSTOM_SRC = Path(__file__).resolve().parents[3] / "servers" / "custom" / "src"
+sys.path.insert(0, str(CUSTOM_SRC))
+
+import custom  # noqa: E402
+
+
+def test_r1_searcher_query_extract_returns_tagged_query():
+    answers = [
+        "Let me reason about this. "
+        "<|begin_of_query|>capital of France<|end_of_query|> then continue."
+    ]
+    result = custom.r1_searcher_query_extract(answers)
+    assert result == {"extract_query_list": ["capital of France?"]}
+
+
+def test_r1_searcher_query_extract_uses_last_query():
+    answers = [
+        "<|begin_of_query|>first question<|end_of_query|> ... "
+        "<|begin_of_query|>second question<|end_of_query|> done."
+    ]
+    result = custom.r1_searcher_query_extract(answers)
+    assert result == {"extract_query_list": ["second question?"]}
+
+
+def test_r1_searcher_query_extract_appends_question_mark():
+    answers = ["<|begin_of_query|>already a question?<|end_of_query|>"]
+    result = custom.r1_searcher_query_extract(answers)
+    assert result == {"extract_query_list": ["already a question?"]}
+
+
+def test_r1_searcher_query_extract_without_tag():
+    result = custom.r1_searcher_query_extract(["no query tags in this text"])
+    assert result == {"extract_query_list": ["There is no query."]}
```

---

### Incident Patch 5: `d9fee1a4` (2026-09-08)
**Commit Message**: chore(deps-dev): bump @humanfs/node in /ui/frontend (#504)

Bumps [@humanfs/node](https://github.com/humanwhocodes/humanfs/tree/HEAD/packages/node) from 0.16.7 to 0.16.8.
- [Release notes](https://github.com/humanwhocodes/humanfs/releases)
- [Changelog](https://github.com/humanwhocodes/humanfs/blob/main/packages/node/CHANGELOG.md)
- [Commits](https://github.com/humanwhocodes/humanfs/commits/node-v0.16.8/packages/node)

---
updated-dependencies:
- dependency-name: "@humanfs/node"
  dependency-version: 0.16.8
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `ui/frontend/package-lock.json` (modified, +21/-7)
```diff
@@ -557,29 +557,43 @@
       "license": "MIT"
     },
     "node_modules/@humanfs/core": {
-      "version": "0.19.1",
-      "resolved": "https://registry.npmmirror.com/@humanfs/core/-/core-0.19.1.tgz",
-      "integrity": "sha512-5DyQ4+1JEUzejeK1JGICcideyfUbGixgS9jNgex5nqkW+cY7WZhxBigmieN5Qnw9ZosSNVC9KQKyb+GUaGyKUA==",
+      "version": "0.19.2",
+      "resolved": "https://registry.npmjs.org/@humanfs/core/-/core-0.19.2.tgz",
+      "integrity": "sha512-UhXNm+CFMWcbChXywFwkmhqjs3PRCmcSa/hfBgLIb7oQ5HNb1wS0icWsGtSAUNgefHeI+eBrA8I1fxmbHsGdvA==",
       "dev": true,
       "license": "Apache-2.0",
+      "dependencies": {
+        "@humanfs/types": "^0.15.0"
+      },
       "engines": {
         "node": ">=18.18.0"
       }
     },
     "node_modules/@humanfs/node": {
-      "version": "0.16.7",
-      "resolved": "https://registry.npmmirror.com/@humanfs/node/-/node-0.16.7.tgz",
-      "integrity": "sha512-/zUx+yOsIrG4Y43Eh2peDeKCxlRt/gET6aHfaKpuq267qXdYDFViVHfMaLyygZOnl0kGWxFIgsBy8QFuTLUXEQ==",
+      "version": "0.16.8",
+      "resolved": "https://registry.npmjs.org/@humanfs/node/-/node-0.16.8.tgz",
+      "integrity": "sha512-gE1eQNZ3R++kTzFUpdGlpmy8kDZD/MLyHqDwqjkVQI0JMdI1D51sy1H958PNXYkM2rAac7e5/CnIKZrHtPh3BQ==",
       "dev": true,
       "license": "Apache-2.0",
       "dependencies": {
-        "@humanfs/core": "^0.19.1",
+        "@humanfs/core": "^0.19.2",
+        "@humanfs/types": "^0.15.0",
         "@humanwhocodes/retry": "^0.4.0"
       },
       "engines": {
         "node": ">=18.18.0"
       }
     },
+    "node_modules/@humanfs/types": {
+      "version": "0.15.0",
+      "resolved": "https://registry.npmjs.org/@humanfs/types/-/types-0.15.0.tgz",
+      "integrity": "sha512-ZZ1w0aoQkwuUuC7Yf+7sdeaNfqQiiLcSRbfI08oAxqLtpXQr9AIVX7Ay7HLDuiLYAaFPu8oBYNq/QIi9URHJ3Q==",
+      "dev": true,
+      "license": "Apache-2.0",
+      "engines": {
+        "node": ">=18.18.0"
+      }
+    },
     "node_modules/@humanwhocodes/module-importer": {
       "version": "1.0.1",
       "resolved": "https://registry.npmmirror.com/@humanwhocodes/module-importer/-/module-importer-1.0.1.tgz",
```

---

### Incident Patch 6: `70d61686` (2026-09-08)
**Commit Message**: fix: keep legacy knowledge bases private by default (#497)

**File**: `ui/backend/kb_visibility_store.py` (modified, +3/-3)
```diff
@@ -135,14 +135,14 @@ def ensure_legacy_public(
                     f"""
                     INSERT INTO {TABLE_NAME}
                     (collection_name, owner_user_id, is_public, visible_users_json, created_at, updated_at)
-                    VALUES (?, ?, 1, '[]', ?, ?)
+                    VALUES (?, ?, 0, '[]', ?, ?)
                     """,
                     (normalized_collection, normalized_owner, now, now),
                 )
                 conn.commit()
                 existing = self._fetch_row(conn, normalized_collection)
         if not existing:
-            raise RuntimeError("failed to ensure legacy public visibility mapping")
+            raise RuntimeError("failed to ensure legacy private visibility mapping")
         return self._row_to_dict(existing)
 
     def bootstrap_legacy_public(
@@ -175,7 +175,7 @@ def bootstrap_legacy_public(
                 f"""
                 INSERT INTO {TABLE_NAME}
                 (collection_name, owner_user_id, is_public, visible_users_json, created_at, updated_at)
-                VALUES (?, ?, 1, '[]', ?, ?)
+                VALUES (?, ?, 0, '[]', ?, ?)
                 """,
                 [(name, normalized_owner, now, now) for name in missing],
             )
```

---

### Incident Patch 7: `d1b80091` (2026-09-02)
**Commit Message**: fix: preload faiss selectively on Windows (#502)

**File**: `servers/retriever/src/retriever.py` (modified, +7/-0)
```diff
@@ -1273,5 +1273,12 @@ async def retriever_batch_websearch(
 
 
 if __name__ == "__main__":
+    if os.name == "nt" and os.environ.get("ULTRARAG_PRELOAD_FAISS") == "1":
+        try:
+            # Load FAISS before FastMCP starts its event loop on Windows.
+            import faiss  # noqa: F401
+        except ImportError:
+            pass
+
     Retriever(app)
     app.run(transport="stdio")
```

**File**: `src/ultrarag/client.py` (modified, +13/-0)
```diff
@@ -2107,6 +2107,19 @@ async def run(
     log_server_banner(Path(config_path).stem)
 
     context = load_pipeline_context(config_path, param_path)
+    if os.name == "nt":
+        for name, server_config in context["server_cfg"].items():
+            mcp_server = context["mcp_cfg"]["mcpServers"].get(name)
+            if not isinstance(mcp_server, dict):
+                continue
+            mcp_server["env"].pop("ULTRARAG_PRELOAD_FAISS", None)
+            server_params = server_config.get("parameter", {})
+            if (
+                not is_demo
+                and isinstance(server_params, dict)
+                and str(server_params.get("index_backend", "")).lower() == "faiss"
+            ):
+                mcp_server["env"]["ULTRARAG_PRELOAD_FAISS"] = "1"
 
     client = create_mcp_client(context["mcp_cfg"])
 
```

---

### Incident Patch 8: `082c4a0f` (2026-09-02)
**Commit Message**: chore(deps-dev): bump browserslist from 4.28.1 to 4.28.8 in /ui/frontend (#500)

Bumps [browserslist](https://github.com/browserslist/browserslist) from 4.28.1 to 4.28.8.
- [Release notes](https://github.com/browserslist/browserslist/releases)
- [Changelog](https://github.com/browserslist/browserslist/blob/main/CHANGELOG.md)
- [Commits](https://github.com/browserslist/browserslist/compare/4.28.1...4.28.8)

---
updated-dependencies:
- dependency-name: browserslist
  dependency-version: 4.28.8
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `ui/frontend/package-lock.json` (modified, +28/-25)
```diff
@@ -2374,9 +2374,9 @@
       "license": "MIT"
     },
     "node_modules/baseline-browser-mapping": {
-      "version": "2.10.0",
-      "resolved": "https://registry.npmmirror.com/baseline-browser-mapping/-/baseline-browser-mapping-2.10.0.tgz",
-      "integrity": "sha512-lIyg0szRfYbiy67j9KN8IyeD7q7hcmqnJ1ddWmNt19ItGpNN64mnllmxUNFIOdOm6by97jlL6wfpTTJrmnjWAA==",
+      "version": "2.11.20",
+      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.11.20.tgz",
+      "integrity": "sha512-H0ulySigv6icDJ1F7SjtdCD6PrhTpdYCmP0CactWy1+ekh0AFd0o1Wn5T8b+hnTmdBx19u9yhL6wvCylXMY7zw==",
       "dev": true,
       "license": "Apache-2.0",
       "bin": {
@@ -2398,9 +2398,9 @@
       }
     },
     "node_modules/browserslist": {
-      "version": "4.28.1",
-      "resolved": "https://registry.npmmirror.com/browserslist/-/browserslist-4.28.1.tgz",
-      "integrity": "sha512-ZC5Bd0LgJXgwGqUknZY/vkUQ04r8NXnJZ3yYi4vDmSiZmC/pdSN0NbNRPxZpbtO4uAfDUAFffO8IZoM3Gj8IkA==",
+      "version": "4.28.8",
+      "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.28.8.tgz",
+      "integrity": "sha512-V2NpofLblG64mfOtSgDhOJESZEGogzDMBv/q+W6oc4LXWP/q75eOXoOaaOu1EOadB9U4Bwx/e0yzbvwKH8zalA==",
       "dev": true,
       "funding": [
         {
@@ -2418,11 +2418,11 @@
       ],
       "license": "MIT",
       "dependencies": {
-        "baseline-browser-mapping": "^2.9.0",
-        "caniuse-lite": "^1.0.30001759",
-        "electron-to-chromium": "^1.5.263",
-        "node-releases": "^2.0.27",
-        "update-browserslist-db": "^1.2.0"
+        "baseline-browser-mapping": "^2.11.12",
+        "caniuse-lite": "^1.0.30001809",
+        "electron-to-chromium": "^1.5.402",
+        "node-releases": "^2.0.53",
+        "update-browserslist-db": "^1.3.0"
       },
       "bin": {
         "browserslist": "cli.js"
@@ -2442,9 +2442,9 @@
       }
     },
     "node_modules/caniuse-lite": {
-      "version": "1.0.30001776",
-      "resolved": "https://registry.npmmirror.com/caniuse-lite/-/caniuse-lite-1.0.30001776.tgz",
-      "integrity": "sha512-sg01JDPzZ9jGshqKSckOQthXnYwOEP50jeVFhaSFbZcOy05TiuuaffDOfcwtCisJ9kNQuLBFibYywv2Bgm9osw==",
+      "version": "1.0.30001810",
+      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001810.tgz",
+      "integrity": "sha512-TITQPUkaz+aVk5GL6NhOdwk1aEaNTSDPsGFWrTuhKGtjTF70jL/Oht2W4c6rXUe5fu7Ie19VIahAXHIIiWWNeg==",
       "dev": true,
       "funding": [
         {
@@ -2740,15 +2740,15 @@
       }
     },
     "node_modules/electron-to-chromium": {
-      "version": "1.5.307",
-      "resolved": "https://registry.npmmirror.com/electron-to-chromium/-/electron-to-chromium-1.5.307.tgz",
-      "integrity": "sha512-5z3uFKBWjiNR44nFcYdkcXjKMbg5KXNdciu7mhTPo9tB7NbqSNP2sSnGR+fqknZSCwKkBN+oxiiajWs4dT6ORg==",
+      "version": "1.5.420",
+      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.420.tgz",
+      "integrity": "sha512-2yD6XreGusOfNV+dUcvipJEXc3n/n7fgr7996aszTG+YY5E4mqM4tOq/3uhP129cazL9YHbVWSpc79ePotWtPA==",
       "dev": true,
       "license": "ISC"
     },
     "node_modules/escalade": {
       "version": "3.2.0",
-      "resolved": "https://registry.npmmirror.com/escalade/-/escalade-3.2.0.tgz",
+      "resolved": "https://registry.npmjs.org/escalade/-/escalade-3.2.0.tgz",
       "integrity": "sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==",
       "dev": true,
       "license": "MIT",
@@ -3684,11 +3684,14 @@
       "license": "MIT"
     },
     "node_modules/node-releases": {
-      "version": "2.0.27",
-      "resolved": "https://registry.npmmirror.com/node-releases/-/node-releases-2.0.27.tgz",
-      "integrity": "sha512-nmh3lCkYZ3grZvqcCH+fjmQ7X+H0OeZgP40OierEaAptX4XofMh5kwNbWh7lBduUzCcV/8kZ+NDLCwm2iorIlA==",
+      "version": "2.0.54",
+      "resolved": "https://registry.npmjs.org/node-releases/-/node-releases-2.0.54.tgz",
+      "integrity": "sha512-YHs7BmmcsdAI5Ozuf8JZo6PT0mv2GIWC9vMfvUC3dp65M8hn7Ux8CPL+2oBI7juNuj9d0ndhTcznq2ODBps9cQ==",
       "dev": true,
-      "license": "MIT"
+      "license": "MIT",
+      "engines": {
+        "node": ">=18"
+      }
     },
     "node_modules/optionator": {
       "version": "0.9.4",
@@ -4217,9 +4220,9 @@
       "license": "MIT"
     },
     "node_modules/update-browserslist-db": {
-      "version": "1.2.3",
-      "resolved": "https://registry.npmmirror.com/update-browserslist-db/-/update-browserslist-db-1.2.3.tgz",
-      "integrity": "sha512-Js0m9cx+qOgDxo0eMiFGEueWztz+d4+M3rGlmKPT+T4IS/jP4ylw3Nwpu6cpTTP8R1MAC1kF4VbdLt3ARf209w==",
+      "version": "1.3.2",
+      "resolved": "https://registry.npmjs.org/update-browserslist-db/-/update-browserslist-db-1.3.2.tgz",
+      "integrity": "sha512-UQ+MSxlhRm1bzjhU+DcuXfjFO1FzNtqhK5+9Yvlp90ItDLk5vT932A0rFu619nf7RVS+Y/VeaUW1jaRDqZ8VJw==",
       "dev": true,
       "funding": [
         {
```

---

### Incident Patch 9: `53cefae5` (2026-08-24)
**Commit Message**: docs: fix broken star history chart (#491)

The star history chart in the README was broken due to the GitHub stargazer API rate limits, which prevented the chart from loading for both dark and light themes. This change points the chart to a working hosting of the star history widget so the chart renders again.

The current chart is broken, which is a regression that this fix addresses.

**File**: `README.md` (modified, +4/-4)
```diff
@@ -268,11 +268,11 @@ You can contribute by following the standard process: **Fork this repository →
 
 If you find this repository helpful for your research, please consider giving us a ⭐ to show your support.
 
-<a href="https://star-history.com/#OpenBMB/UltraRAG&Date">
+<a href="https://star-history.dera.page/#OpenBMB/UltraRAG&type=Date">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=OpenBMB/UltraRAG&type=Date&theme=dark" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=OpenBMB/UltraRAG&type=Date" />
-   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=OpenBMB/UltraRAG&type=Date" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=OpenBMB/UltraRAG&type=Date&theme=dark" />
+   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=OpenBMB/UltraRAG&type=Date" />
+   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=OpenBMB/UltraRAG&type=Date" />
  </picture>
 </a>
 
```

**File**: `docs/README_zh.md` (modified, +4/-4)
```diff
@@ -268,11 +268,11 @@ Hello, UltraRAG v3!
 
 如果您觉得本项目对您的研究有所帮助，欢迎点亮一颗 ⭐ 来支持我们！
 
-<a href="https://star-history.com/#OpenBMB/UltraRAG&Date">
+<a href="https://star-history.dera.page/#OpenBMB/UltraRAG&type=Date">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=OpenBMB/UltraRAG&type=Date&theme=dark" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=OpenBMB/UltraRAG&type=Date" />
-   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=OpenBMB/UltraRAG&type=Date" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=OpenBMB/UltraRAG&type=Date&theme=dark" />
+   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=OpenBMB/UltraRAG&type=Date" />
+   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=OpenBMB/UltraRAG&type=Date" />
  </picture>
 </a>
 
```

---

### Incident Patch 10: `6a312254` (2026-08-24)
**Commit Message**: chore(deps-dev): update setuptools requirement from >=83.0.0 to >=84.0.0 (#490)

Updates the requirements on [setuptools](https://github.com/pypa/setuptools) to permit the latest version.
- [Release notes](https://github.com/pypa/setuptools/releases)
- [Changelog](https://github.com/pypa/setuptools/blob/main/NEWS.rst)
- [Commits](https://github.com/pypa/setuptools/compare/v83.0.0...v84.0.0)

---
updated-dependencies:
- dependency-name: setuptools
  dependency-version: 84.0.0
  dependency-type: direct:development
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 [build-system]
-requires = ["setuptools>=83.0.0"]
+requires = ["setuptools>=84.0.0"]
 build-backend = "setuptools.build_meta"
 
 [project]
```

---

### Incident Patch 11: `015e838c` (2026-08-16)
**Commit Message**: chore(deps): bump js-yaml from 4.3.0 to 4.3.1 in /ui/frontend (#488)

Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 4.3.0 to 4.3.1.
- [Changelog](https://github.com/nodeca/js-yaml/blob/4.3.1/CHANGELOG.md)
- [Commits](https://github.com/nodeca/js-yaml/compare/4.3.0...4.3.1)

---
updated-dependencies:
- dependency-name: js-yaml
  dependency-version: 4.3.1
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `ui/frontend/package-lock.json` (modified, +4/-4)
```diff
@@ -19,7 +19,7 @@
         "clsx": "^2.1.1",
         "dompurify": "^3.4.13",
         "highlight.js": "^11.11.1",
-        "js-yaml": "^4.3.0",
+        "js-yaml": "^4.3.1",
         "katex": "^0.16.33",
         "lucide-react": "^0.576.0",
         "marked": "^17.0.3",
@@ -3214,9 +3214,9 @@
       "license": "MIT"
     },
     "node_modules/js-yaml": {
-      "version": "4.3.0",
-      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.0.tgz",
-      "integrity": "sha512-1td788aAnnZ5qs7V2QIRl1owjtYpbKt749Y3xauqQgwIIGF/xXWz1wMTEBx5O3LK3lXLVuqXPdPxj2BoFHaW9Q==",
+      "version": "4.3.1",
+      "resolved": "https://registry.npmjs.org/js-yaml/-/js-yaml-4.3.1.tgz",
+      "integrity": "sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==",
       "funding": [
         {
           "type": "github",
```

**File**: `ui/frontend/package.json` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@
     "clsx": "^2.1.1",
     "dompurify": "^3.4.13",
     "highlight.js": "^11.11.1",
-    "js-yaml": "^4.3.0",
+    "js-yaml": "^4.3.1",
     "katex": "^0.16.33",
     "lucide-react": "^0.576.0",
     "marked": "^17.0.3",
```

---

### Incident Patch 12: `055ade44` (2026-08-11)
**Commit Message**: chore(deps): bump dompurify from 3.4.12 to 3.4.13 in /ui/frontend (#486)

Bumps [dompurify](https://github.com/cure53/DOMPurify) from 3.4.12 to 3.4.13.
- [Release notes](https://github.com/cure53/DOMPurify/releases)
- [Commits](https://github.com/cure53/DOMPurify/compare/3.4.12...3.4.13)

---
updated-dependencies:
- dependency-name: dompurify
  dependency-version: 3.4.13
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `ui/frontend/package-lock.json` (modified, +4/-4)
```diff
@@ -17,7 +17,7 @@
         "@xyflow/react": "^12.10.1",
         "class-variance-authority": "^0.7.1",
         "clsx": "^2.1.1",
-        "dompurify": "^3.4.12",
+        "dompurify": "^3.4.13",
         "highlight.js": "^11.11.1",
         "js-yaml": "^4.3.0",
         "katex": "^0.16.33",
@@ -2731,9 +2731,9 @@
       "license": "MIT"
     },
     "node_modules/dompurify": {
-      "version": "3.4.12",
-      "resolved": "https://registry.npmjs.org/dompurify/-/dompurify-3.4.12.tgz",
-      "integrity": "sha512-zQvGet8Z2sWbQhCmfFz/T5QWH2oBmjnqK3qvOjaqaNLrLEF912WamU+ohnTp0TCep/MFVHpdJuCZEdFOdTnEFg==",
+      "version": "3.4.13",
+      "resolved": "https://registry.npmjs.org/dompurify/-/dompurify-3.4.13.tgz",
+      "integrity": "sha512-2vmYIoqjze2d+kakP8S/nS5shfsl587kzwEjcGlTdiksUVgFHnFCsLYDVj/JNqJVOQZGSYBTmuycv0PodwmnMQ==",
       "license": "(MPL-2.0 OR Apache-2.0)",
       "optionalDependencies": {
         "@types/trusted-types": "^2.0.7"
```

**File**: `ui/frontend/package.json` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@
     "@xyflow/react": "^12.10.1",
     "class-variance-authority": "^0.7.1",
     "clsx": "^2.1.1",
-    "dompurify": "^3.4.12",
+    "dompurify": "^3.4.13",
     "highlight.js": "^11.11.1",
     "js-yaml": "^4.3.0",
     "katex": "^0.16.33",
```

---

### Incident Patch 13: `5eb8e54b` (2026-08-11)
**Commit Message**: chore(deps): bump react-router and react-router-dom in /ui/frontend (#485)

Bumps [react-router](https://github.com/remix-run/react-router/tree/HEAD/packages/react-router) to 7.18.2 and updates ancestor dependency [react-router-dom](https://github.com/remix-run/react-router/tree/HEAD/packages/react-router-dom). These dependencies need to be updated together.


Updates `react-router` from 7.16.0 to 7.18.2
- [Release notes](https://github.com/remix-run/react-router/releases)
- [Changelog](https://github.com/remix-run/react-router/blob/react-router@7.18.2/packages/react-router/CHANGELOG.md)
- [Commits](https://github.com/remix-run/react-router/commits/react-router@7.18.2/packages/react-router)

Updates `react-router-dom` from 7.16.0 to 7.18.2
- [Release notes](https://github.com/remix-run/react-router/releases)
- [Changelog](https://github.com/remix-run/react-router/blob/react-router-dom@7.18.2/packages/react-router-dom/CHANGELOG.md)
- [Commits](https://github.com/remix-run/react-router/commits/react-router-dom@7.18.2/packages/react-router-dom)

---
updated-dependencies:
- dependency-name: react-router
  dependency-version: 7.18.2
  dependency-type: indirect
- dependency-name: react-r

**File**: `ui/frontend/package-lock.json` (modified, +8/-8)
```diff
@@ -25,7 +25,7 @@
         "marked": "^17.0.3",
         "react": "^19.2.0",
         "react-dom": "^19.2.0",
-        "react-router-dom": "^7.16.0",
+        "react-router-dom": "^7.18.2",
         "tailwind-merge": "^3.5.0",
         "zustand": "^5.0.11"
       },
@@ -3921,9 +3921,9 @@
       }
     },
     "node_modules/react-router": {
-      "version": "7.16.0",
-      "resolved": "https://registry.npmjs.org/react-router/-/react-router-7.16.0.tgz",
-      "integrity": "sha512-wArC8lVyJb3+jM9OpDyW6hLCizACWkvQR/sSGqSs+o5uEXEtGlqdZ4v8hENR3Jad6i+LRkK93q/+bQAcvl6V1A==",
+      "version": "7.18.2",
+      "resolved": "https://registry.npmjs.org/react-router/-/react-router-7.18.2.tgz",
+      "integrity": "sha512-aUVMjFm3GAPTTZL7oYr5E7ETiqfQCHRLH+B+5afnICvf0r7kkK4eR6SMuwbSTJw/7t+12khT/Kahij49fqOCIg==",
       "license": "MIT",
       "dependencies": {
         "cookie": "^1.0.1",
@@ -3943,12 +3943,12 @@
       }
     },
     "node_modules/react-router-dom": {
-      "version": "7.16.0",
-      "resolved": "https://registry.npmjs.org/react-router-dom/-/react-router-dom-7.16.0.tgz",
-      "integrity": "sha512-kMUAbimWB5FVbF4Bce4bJsiKJWLIUHq/mEG8+CFDnCSgltptBiG5nguducmsJeGKytlCvQud9Qhzpn49iduTlA==",
+      "version": "7.18.2",
+      "resolved": "https://registry.npmjs.org/react-router-dom/-/react-router-dom-7.18.2.tgz",
+      "integrity": "sha512-AIKJ/jgGlFb3EbfCXk5Gzshiwt+l3mqbCrNjmEWMMjqQxNJ3svBa6bgzFyCC2Sw3RA0VWF1kg3uQf2OFhxb8hw==",
       "license": "MIT",
       "dependencies": {
-        "react-router": "7.16.0"
+        "react-router": "7.18.2"
       },
       "engines": {
         "node": ">=20.0.0"
```

**File**: `ui/frontend/package.json` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@
     "marked": "^17.0.3",
     "react": "^19.2.0",
     "react-dom": "^19.2.0",
-    "react-router-dom": "^7.16.0",
+    "react-router-dom": "^7.18.2",
     "tailwind-merge": "^3.5.0",
     "zustand": "^5.0.11"
   },
```

---

### Incident Patch 14: `e5d2f1d7` (2026-07-30)
**Commit Message**: chore(deps): bump postcss from 8.5.15 to 8.5.25 in /ui/frontend (#476)

Bumps [postcss](https://github.com/postcss/postcss) from 8.5.15 to 8.5.25.
- [Release notes](https://github.com/postcss/postcss/releases)
- [Changelog](https://github.com/postcss/postcss/blob/main/CHANGELOG.md)
- [Commits](https://github.com/postcss/postcss/compare/8.5.15...8.5.25)

---
updated-dependencies:
- dependency-name: postcss
  dependency-version: 8.5.25
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `ui/frontend/package-lock.json` (modified, +7/-7)
```diff
@@ -3658,9 +3658,9 @@
       "license": "MIT"
     },
     "node_modules/nanoid": {
-      "version": "3.3.12",
-      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.12.tgz",
-      "integrity": "sha512-ZB9RH/39qpq5Vu6Y+NmUaFhQR6pp+M2Xt76XBnEwDaGcVAqhlvxrl3B2bKS5D3NH3QR76v3aSrKaF/Kiy7lEtQ==",
+      "version": "3.3.16",
+      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.16.tgz",
+      "integrity": "sha512-bzlKTyNJ7+LdGIIwy8ijFpIqEQIvafahV7eYykJ8Cvh42EdJeODoJ6gUJXpQJvej1BddH8OqTXZNE/KfbWAu8Q==",
       "dev": true,
       "funding": [
         {
@@ -3794,9 +3794,9 @@
       }
     },
     "node_modules/postcss": {
-      "version": "8.5.15",
-      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.15.tgz",
-      "integrity": "sha512-FfR8sjd4em2T6fb3I2MwAJU7HWVMr9zba+enmQeeWFfCbm+UOC/0X4DS8XtpUTMwWMGbjKYP7xjfNekzyGmB3A==",
+      "version": "8.5.25",
+      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.25.tgz",
+      "integrity": "sha512-DTPx3RWSSnWyzLxQnlH0rJP+EW5ekl16ZU4/psbIhA0e53kJfdgaN5vKM+xP7yJtXVu+nfdVFmlgFDEKAe4Pyw==",
       "dev": true,
       "funding": [
         {
@@ -3814,7 +3814,7 @@
       ],
       "license": "MIT",
       "dependencies": {
-        "nanoid": "^3.3.12",
+        "nanoid": "^3.3.16",
         "picocolors": "^1.1.1",
         "source-map-js": "^1.2.1"
       },
```

---

### Incident Patch 15: `47135991` (2026-07-30)
**Commit Message**: chore(deps-dev): bump brace-expansion in /ui/frontend (#477)

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 1.1.12 to 1.1.17.
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v1.1.12...v1.1.17)

---
updated-dependencies:
- dependency-name: brace-expansion
  dependency-version: 1.1.17
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `ui/frontend/package-lock.json` (modified, +7/-7)
```diff
@@ -2115,16 +2115,16 @@
       }
     },
     "node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion": {
-      "version": "5.0.4",
-      "resolved": "https://registry.npmmirror.com/brace-expansion/-/brace-expansion-5.0.4.tgz",
-      "integrity": "sha512-h+DEnpVvxmfVefa4jFbCf5HdH5YMDXRsmKflpf1pILZWRFlTbJpxeU55nJl4Smt5HQaGzg1o6RHFPJaOqnmBDg==",
+      "version": "5.0.8",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.8.tgz",
+      "integrity": "sha512-JZyDyq3D4AUifKTPOB7DELf6XsB3WdPuNxCtob1vFXPsSXhdAiHBWJ/tJ8HAc9aH84BK+5JFZLNkJKx3G9kzQg==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
         "balanced-match": "^4.0.2"
       },
       "engines": {
-        "node": "18 || 20 || >=22"
+        "node": "20 || >=22"
       }
     },
     "node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch": {
@@ -2387,9 +2387,9 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "1.1.12",
-      "resolved": "https://registry.npmmirror.com/brace-expansion/-/brace-expansion-1.1.12.tgz",
-      "integrity": "sha512-9T9UjW3r0UW5c1Q7GTwllptXwhvYmEzFhzMfZ9H7FQWt+uZePjZPjBP/W1ZEyZ1twGWom5/56TF4lPcqjnDHcg==",
+      "version": "1.1.17",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.17.tgz",
+      "integrity": "sha512-w+aeW/mkgM4PyRMOJCgi3fOrTm5Q8QY1OSfn2TO2iuDj3ezIHqejmuxbjfPrqUkgqRew1iqkyAn0tr0ZwHD9+w==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
```

#### Recent Merged Pull Requests:
- **PR #524** (closed): chore(deps-dev): update mineru requirement from <4,>=3 to >=4.0.4,<5 (@dependabot[bot])
- **PR #523** (closed): chore(deps-dev): update litellm requirement from <2.0,>=1.60 to >=1.102.0,<2.0 (@dependabot[bot])
- **PR #518** (2026-09-19): fix(retriever): skip FAISS padding slots instead of returning the last document (@winter-street)
- **PR #516** (closed): chore(deps-dev): bump vllm from 0.22.1 to 0.29.0 (@dependabot[bot])
- **PR #515** (closed): chore(deps-dev): update litellm requirement from <2.0,>=1.60 to >=1.100.1,<2.0 (@dependabot[bot])
- **PR #514** (closed): chore(deps-dev): update xgrammar requirement from <0.2.4 to <0.2.7 (@dependabot[bot])
- **PR #512** (2026-09-16): fix(benchmark): keep key_map columns aligned when a record is incomplete (@chiruu12)
- **PR #510** (2026-09-15): fix(evaluation): keep answers that are entirely articles (@chiruu12)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
