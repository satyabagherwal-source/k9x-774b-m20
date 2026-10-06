# Forensic Learning Record (Deep Inspection): Osmantic/ODS

> **Canonical Artifact**: `07_PROJECT_LEARNING/osmantic-ods-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Osmantic/ODS](https://github.com/Osmantic/ODS))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:53:14.284Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Osmantic/ODS`
- **Description**: ODS V3 Pre-Release: Public testing and refinement ahead of the official V3 launch. Turn your PC, Mac, or Linux box into a private AI server.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7049 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ods/bin/model_switchboard/state.py`
```
"""Versioned model-state record for the ODS Model Switchboard (PR 1).

Contract highlights (see ods/docs/MODEL-SWITCHBOARD.md, section 3.2):

- The host agent is the only writer. Writes are temp-file + flush + fsync
  where available + atomic replace; a reader can never observe partial JSON.
- ``seq`` increments on every mutation; ``routeSeq`` increments only when the
  active route changes.
- ``active`` always remains the last proven route. In observe mode this module
  is called only after the existing activation transaction has already proved
  success, so a failed activation never touches the record.
- ``history`` keeps the last ``HISTORY_LIMIT`` verified active routes.
- Startup reconstruction from ``.env`` is permitted only when no v1 state has
  ever been committed, and is marked ``reconstructed`` with an unproven
  completion so it can never masquerade as a verified proof.

Stdlib only: the standalone host agent imports this from the installed tree.
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "ods.model-state.v1"
HISTORY_LIMIT = 10
PUBLIC_MODEL_DEFAULT = "ods/current"
STATE_FILE_MODE = 0o644

_WRITABLE_BACKEND_KINDS = {"llama-server", "hipfire", "unknown"}
# Readable for one release only: records written before round F carry the
# retired Lemonade route until the host agent rewrites and re-proves them.
_LEGACY_BACKEND_KINDS = {"lemonade"}
_LEGACY_ENDPOINT_IDS = {"lemonade-default"}
_BACKEND_KINDS = _WRITABLE_BACKEND_KINDS | _LEGACY_BACKEND_KINDS
DEFAULT_ENDPOINT_ID = "llama-server-default"
_OPERATION_PHASES = {
    "requested", "staging", "verifying", "publishing",
    "flipping", "serving", "failed", "rolling_back",
}
_AVAILABILITY_MODES = {"serve_active", "queue"}

_TOP_LEVEL_KEYS = {
    "schema", "seq", "routeSeq", "operation", "desired", "active",
    "history", "availability",
}
_OPERATION_KEYS = {"id", "phase", "requestedModelId", "startedAt", "error"}
_ACTIVE_KEYS = {
    "routeSeq", "catalogId", "runtimeModelId", "publicModel", "backend",
    "contextLength", "capabilities", "verifiedAt", "reconstructed", "proof",
}
_BACKEND_KEYS = {"kind", "endpointId", "nativeRoute"}
_CAPABILITY_KEYS = {"chat", "tools", "vision", "agentViable"}
_PROOF_KEYS = {"identity", "completion"}
_HISTORY_KEYS = {"routeSeq", "catalogId", "runtimeModelId", "verifiedAt"}
_AVAILABILITY_KEYS = {"mode", "queueDeadline"}

_WRITE_LOCK = threading.Lock()
_LAST_GOOD: dict[str, dict[str, Any]] = {}


class StateError(RuntimeError):
    """Raised for unrecoverable state-record violations (writer side)."""


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _check_keys(
    value: dict[str, Any],
    *,
    allowed: set[str] | None,
    required: set[str],
    label: str,
    errors: list[str],
) -> None:
    missing = required - set(value)
    unexpected = set(value) - allowed if allowed is not None else set()
    if missing:
        errors.append(f"{label} is missing required keys: {', '.join(sorted(missing))}")
    if unexpected:
        errors.append(f"{label} has unexpected keys: {', '.join(sorted(unexpected))}")


def initial_state() -> dict[str, Any]:
    return {
        "schema": SCHEMA_VERSION,
        "seq": 0,
        "routeSeq": 0,
        "operation": None,
        "desired": None,
        "active": None,
        "history": [],
        "availability": {"mode": "serve_active", "queueDeadline": None},
    }


def validate_state(doc: Any) -> list[str]:
    """Structural validation without third-party dependencies.

    Returns a list of human-readable problems; empty means valid. The JSON
    Schema at ods/config/model-state.schema.v1.json is the authoritative
    published contract; this validator must stay in agreement with it.
    """
    errors: list[str] = []
    if not isinstance(doc, dict):
        return ["state root must be an object"]
    _check_keys(
        doc,
        allowed=_TOP_LEVEL_KEYS,
        required=_TOP_LEVEL_KEYS - {"operation"},
        label="state",
        errors=errors,
    )
    if doc.get("schema") != SCHEMA_VERSION:
        errors.append(f"schema must be {SCHEMA_VERSION!r}")
    for key in ("seq", "routeSeq"):
        value = doc.get(key)
        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
            errors.append(f"{key} must be a non-negative integer")

    operation = doc.get("operation")
    if operation is not None:
        if not isinstance(operation, dict):
            errors.append("operation must be null or an object")
        else:
            _check_keys(
                operation,
                allowed=_OPERATION_KEYS,
                required={"id", "phase", "requestedModelId", "startedAt"},
                label="operation",
                errors=errors,
            )
            if not isinstance(operation.get("id"), str) or not operation.get("id"):
                errors.append("operation.id must be a non-empty string")
            if operation.get("phase") not in _OPERATION_PHASES:
                errors.append("operation.phase is not a known phase")
            if not isinstance(operation.get("requestedModelId"), str):
                errors.append("operation.requestedModelId must be a string")
            if not isinstance(operation.get("startedAt"), str):
                errors.append("operation.startedAt must be a string")
            if operation.get("error") is not None and not isinstance(
                operation.get("error"), str
            ):
                errors.append("operation.error must be a string or null")

    desired = doc.get("desired")
    if desired is not None:
        if not isinstance(desired, dict):
            errors.append("desired must be null or {catalogId: non-empty string}")
        else:
            _check_keys(
                desired,
                allowed={"catalogId"},
                required={"catalogId"},
                label="desired",
                errors=errors,
            )
            if (
                not isinstance(desired.get("catalogId"), str)
                or not desired.get("catalogId")
            ):
                errors.append("desired.catalogId must be a non-empty string")

    active = doc.get("active")
    if active is not None:
        if not isinstance(active, dict):
            errors.append("active must be null or an object")
        else:
            _check_keys(
                active,
                allowed=_ACTIVE_KEYS,
                required=_ACTIVE_KEYS - {"reconstructed"},
                label="active",
                errors=errors,
            )
            active_route_seq = active.get("routeSeq")
            if (
                not isinstance(active_route_seq, int)
                or isinstance(active_route_seq, bool)
                or active_route_seq < 0
            ):
                errors.append("active.routeSeq must be a non-negative integer")
            for key in ("catalogId", "runtimeModelId", "publicModel"):
                if not isinstance(active.get(key), str) or not active.get(key):
                    errors.append(f"active.{key} must be a non-empty string")
            backend = active.get("backend")
            if not isinstance(backend, dict):
                errors.append("active.backend must be an object")
            else:
                _check_keys(
                    backend,
                    allowed=_BACKEND_KEYS,
                    required={"kind", "endpointId"},
                    label="active.backend",
                    errors=errors,
                )
                if backend.get("kind") not in _BACKEND_KINDS:
                    errors.append("active.backend.kind is not a known backend kind")
                if (
                    not isinstance(backend.get("endpointId"), str)
                    or not backend.get("endpointId")
                ):
                    errors.append("active.backend.endpointId must be a non-empty string")
                native_route = backend.get("nativeRoute")
                if native_route is not None and not isinstance(native_route, str):
                    errors.append("active.backend.nativeRoute must be a string or null")
            context_length = active.get("contextLength")
            if not isinstance(context_length, int) or isinstance(context_length, bool) or context_length < 0:
                errors.append("active.contextLength must be a non-negative integer")
            capabilities = active.get("capabilities")
            if not isinstance(capabilities, dict):
                errors.append("active.capabilities must be an object")
            else:
                _check_keys(
                    capabilities,
                    allowed=_CAPABILITY_KEYS,
                    required=_CAPABILITY_KEYS,
                    label="active.capabilities",
                    errors=errors,
                )
                for key in ("chat", "tools", "vision", "agentViable"):
                    if not isinstance(capabilities.get(key), bool):
                        errors.append(f"active.capabilities.{key} must be a boolean")
            verified_at = active.get("verifiedAt")
            if verified_at is not None and not isinstance(verified_at, str):
                errors.append("active.verifiedAt must be a string or null")
            if "reconstructed" in active and not isinstance(active.get("reconstructed"), bool):
                errors.append("active.reconstructed must be a boolean")
            proof = active.get("proof")
            if not isinstance(proof, dict):
                errors.append("active.proof must be {identity, completion: bool}")
            else:
                _check_keys(
                    proof,
                    allowed=_PROOF_KEYS,
                    required=_PROOF_KEYS,
                    label="active
```

### Core Architecture Module: `ods/bin/pixel_provider/advice_setup_worker.py`
```
"""One stdlib setup operation in its own parent-supervised process group."""
import asyncio
import os
from pathlib import Path
import resource
import select
import signal
import sys

if __package__ in (None,''):
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]))

from pixel_provider.advice import JOB_ID
from pixel_provider.advice_frames import encode_frame,read_frame
from pixel_provider.advice_python import select_candidate
from pixel_provider.advice_runtime import prepare_runtime,source_digest
from pixel_provider.store import StoreError


def main():
    if os.name!='posix' or os.getpgrp()!=os.getpid():
        return 2
    try:
        resource.setrlimit(resource.RLIMIT_CORE,(0,0))
        with os.fdopen(os.dup(0),'rb',buffering=0) as stream:
            value=read_frame(stream)
        if (set(value)!={'schemaVersion','requestId','directory','candidateId','expectedRevision','sourceSha256','lockFds'}
                or type(value['schemaVersion']) is not int or value['schemaVersion']!=1
                or not isinstance(value['requestId'],str) or not JOB_ID.fullmatch(value['requestId'])
                or not isinstance(value['directory'],str) or not os.path.isabs(value['directory'])
                or not isinstance(value['lockFds'],list) or len(value['lockFds'])!=2
                or any(type(fd) is not int or fd<3 for fd in value['lockFds'])):
            raise ValueError('invalid-setup-frame')
        for fd in value['lockFds']:
            os.fstat(fd)
        if select.select([0],[],[],0)[0]:
            raise ValueError('parent-disconnected')
        # A thread dies with this worker, possibly leaving a pip grandchild
        # behind. A separate watchdog retains the inherited slot locks and
        # survives worker exit until the supervisor closes its private pipe.
        # Close output descriptors so it cannot prevent normal result EOF.
        group=os.getpgrp()
        if os.fork()==0:
            os.close(1)
            os.close(2)
            try:
                os.read(0,1)
            finally:
                os.killpg(group,signal.SIGKILL)
                os._exit(1)
        if source_digest()!=value['sourceSha256']:
            raise StoreError('advice-runtime-drift')
        candidate=select_candidate(value['candidateId'])
        result=prepare_runtime(value['directory'],python=candidate['path'],expected_revision=value['expectedRevision'],
            confirmed=True,lock_fds=tuple(value['lockFds']),inherited_group=True,
            runtime_id='runtime-'+value['requestId'].replace('-',''))
        sys.stdout.buffer.write(encode_frame(dict(schemaVersion=1,requestId=value['requestId'],result=result)))
        sys.stdout.buffer.flush()
        return 0
    except (Exception,asyncio.CancelledError):
        sys.stderr.write('advice-setup-failed\n')
        return 1


if __name__=='__main__':
    raise SystemExit(main())

```

### Core Architecture Module: `ods/bin/pixel_provider/advice_worker.py`
```
"""One tools-free inference call, controlled by a private parent-owned pipe.

EOF/extra input cancels the call and terminates a stuck worker within two
seconds, including on macOS where Linux PDEATHSIG is unavailable. No listeners.
"""
import asyncio
import os
import resource
from pathlib import Path
import select
import sys
import threading

# Invoked by a custody-checked absolute path with Python -I -B. The package path
# is explicit; neither the caller's CWD nor PYTHONPATH becomes executable input.
if __package__ in (None,''):
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]))

from pixel_provider.advice import AdvisoryCall
from pixel_provider.advice_frames import encode_frame,read_frame


async def execute(value):
    if set(value) != {'schemaVersion','requestId','snapshot'} or type(value['schemaVersion']) is not int or value['schemaVersion'] != 1:
        raise ValueError('invalid-worker-request')
    call = AdvisoryCall.from_snapshot(value['snapshot'])
    if value['requestId'] != call.body['requestId']:
        raise ValueError('invalid-worker-request')
    cancelled = threading.Event()
    done = threading.Event()

    def watch_parent():
        try:
            # The parent deliberately keeps its write end open after the frame.
            # EOF means parent loss/cancel; any data means an invalid second frame.
            os.read(0,1)
        finally:
            cancelled.set()
            if not done.wait(2):
                os._exit(125)

    if select.select([0],[],[],0)[0]:
        raise ValueError('worker-parent-disconnected')
    watcher = threading.Thread(target=watch_parent,daemon=True,name='advice-parent-watch')
    watcher.start()
    try:
        result = await call.execute(cancelled=cancelled.is_set)
        if cancelled.is_set():
            raise asyncio.CancelledError()
        return dict(schemaVersion=1,requestId=call.body['requestId'],result=result)
    finally:
        done.set()


def main():
    if os.name != 'posix' or sys.version_info < (3,11):
        return 2
    try:
        resource.setrlimit(resource.RLIMIT_CORE,(0,0))
        # Unbuffered IO prevents read-ahead swallowing a forbidden second frame.
        with os.fdopen(os.dup(0),'rb',buffering=0) as stream:
            value = read_frame(stream)
        if sys.argv[1:] == ['--check']:
            import fastapi
            import httpx
            import uvicorn
            result = dict(schemaVersion=1,ready=True,python=list(sys.version_info[:3]),
                          fastapi=fastapi.__version__,httpx=httpx.__version__,uvicorn=uvicorn.__version__)
            sys.stdout.buffer.write(encode_frame(result))
            sys.stdout.buffer.flush()
            return 0
        if sys.argv[1:]:
            raise ValueError('invalid-worker-arguments')
        result = asyncio.run(execute(value))
        sys.stdout.buffer.write(encode_frame(result))
        sys.stdout.buffer.flush()
        return 0
    except (Exception,asyncio.CancelledError):
        # No traceback, provider body or capsule/key appears on stderr.
        sys.stderr.write('advice-worker-failed\n')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())

```

### Core Architecture Module: `ods/bin/pixel_provider/handoff_worker.py`
```
"""Fixed private checkpoint pipe. No API keys, model calls or child commands."""
import json
import os
from pathlib import Path
import select
import signal
import struct
import sys
import threading
import time

if __package__ in (None,''):
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]))

from pixel_provider.handoff_approvals import FRAME_LIMIT,HandoffApprovals,decode_large
from pixel_provider.store import StoreError


def read_request(stream):
    def exact(size):
        data=bytearray()
        while len(data)<size:
            part=stream.read(size-len(data))
            if not part: raise StoreError('truncated-handoff-frame')
            data.extend(part)
        return bytes(data)
    size=struct.unpack('!I',exact(4))[0]
    if not 0<size<=FRAME_LIMIT: raise StoreError('invalid-handoff-frame')
    value=decode_large(exact(size))
    if (type(value) is not dict or set(value)!={'schemaVersion','checkpointJson','checkpointDigest','timeoutSeconds'}
            or type(value['schemaVersion']) is not int or value['schemaVersion']!=1):
        raise StoreError('invalid-handoff-frame')
    return value


def main():
    if os.name!='posix' or len(sys.argv)!=3 or sys.argv[1]!='--provider-directory' or not os.path.isabs(sys.argv[2]):
        return 2
    import resource
    resource.setrlimit(resource.RLIMIT_CORE,(0,0))
    stopped=threading.Event()
    done=threading.Event()
    armed=threading.Event()
    signal.signal(signal.SIGTERM,lambda *_:stopped.set())
    signal.signal(signal.SIGINT,lambda *_:stopped.set())
    def watch():
        if not armed.wait(10): os._exit(125)
        while not done.is_set() and not stopped.is_set():
            if select.select([0],[],[],.05)[0]:
                os.read(0,1)
                stopped.set()
        if stopped.is_set() and not done.wait(2): os._exit(125)
    threading.Thread(target=watch,daemon=True,name='handoff-parent-watch').start()
    try:
        with os.fdopen(os.dup(0),'rb',buffering=0) as stream: value=read_request(stream)
        manager=HandoffApprovals(sys.argv[2])
        publication=manager.publish(value['checkpointJson'],value['checkpointDigest'],value['timeoutSeconds'])
        if select.select([0],[],[],0)[0]: raise StoreError('handoff-parent-disconnected')
        armed.set()
        deadline=time.monotonic()+value['timeoutSeconds']
        with publication:
            while not stopped.is_set() and time.monotonic()<deadline:
                receipt=publication.receipt()
                if receipt is not None:
                    if stopped.is_set(): break
                    raw=json.dumps(receipt,separators=(',',':')).encode()
                    sys.stdout.buffer.write(struct.pack('!I',len(raw))+raw)
                    sys.stdout.buffer.flush()
                    publication.finish('approved' if receipt['approved'] else 'declined')
                    return 0
                stopped.wait(.05)
            publication.finish('cancelled' if stopped.is_set() else 'expired')
        return 1
    except Exception:
        sys.stderr.write('handoff-worker-unavailable\n')
        return 1
    finally:
        done.set()
        armed.set()


if __name__=='__main__':
    raise SystemExit(main())

```

### Core Architecture Module: `ods/bin/pixel_provider/route_worker.py`
```
"""One process, one frozen gateway, no tools or child commands.

Only a trusted host launcher may supply the provider directory and reviewed
activation request. This internal pipe is not a public activation endpoint.
Process death closes every listener and OS lock; durable claims prohibit replay.
"""
import os
from pathlib import Path
import resource
import select
import signal
import sys
import threading
import time

if __package__ in (None,''):
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]))

from pixel_provider.advice_frames import encode_frame,read_frame
from pixel_provider.lease_claim import LeaseClaim
from pixel_provider.runtime_session import ProviderSession
from pixel_provider.store import StoreError


def validate_request(value):
    required = {'schemaVersion','runId','sessionId','expectedRevision','allowCloud','timeoutSeconds','confirmed'}
    if (not isinstance(value,dict) or set(value) not in (required,required|{'handoffProviderId'},required|{'scopeSessionKey'})
            or type(value['schemaVersion']) is not int or value['schemaVersion']!=1
            or value['confirmed'] is not True or type(value['allowCloud']) is not bool
            or type(value['timeoutSeconds']) is not int or not 1<=value['timeoutSeconds']<=3600):
        raise StoreError('invalid-provider-lease-request')
    if 'handoffProviderId' in value and (type(value['handoffProviderId']) is not str
            or not value['handoffProviderId'] or len(value['handoffProviderId'])>64):
        raise StoreError('invalid-provider-lease-request')
    return value


def scoped_request(directory, value):
    """Resolve owner state once; the resulting run contract is then frozen."""
    if 'scopeSessionKey' not in value:
        return value
    from pixel_provider.scopes import ScopeStore
    selection = ScopeStore(directory).resolve(value['scopeSessionKey'], value['expectedRevision'])
    if selection is None:
        return value
    # A persisted preference cannot widen the activation's cloud boundary.
    # Both owner authorities must allow transfer; checkpoint approval is separate.
    return dict(value, handoffProviderId=selection['providerId'], allowCloud=value['allowCloud'] and selection['allowCloud'],
                handoffSelectionScope=selection['scope'])


def main():
    if os.name!='posix' or sys.version_info<(3,11):
        return 2
    if len(sys.argv)!=3 or sys.argv[1]!='--provider-directory' or not os.path.isabs(sys.argv[2]):
        return 2
    stopped,done,armed = threading.Event(),threading.Event(),threading.Event()
    duration = [10]
    reason = ['failed']
    phase = 'request'
    def requested_stop(*_args):
        # An orderly owner/supervisor cancellation is not a worker failure.
        # Preserve a deadline/protocol cause already observed by the watchdog.
        if not stopped.is_set():
            reason[0] = 'closed'
            stopped.set()
    def watchdog():
        # Bound even a truncated first frame. No third-party imports, listeners
        # or child processes exist yet. Once armed, this thread owns stdin reads.
        if not armed.wait(10):
            os._exit(125)
        deadline = time.monotonic()+duration[0]
        while not done.is_set() and not stopped.is_set():
            remaining = deadline-time.monotonic()
            if remaining<=0:
                reason[0]='deadline'
                stopped.set()
                break
            try:
                if select.select([0],[],[],min(.05,remaining))[0]:
                    extra = os.read(0,1)
                    reason[0]='failed' if extra else 'closed'
                    stopped.set()
            except OSError:
                stopped.set()
        if not done.wait(2):
            # A stuck Python/uvicorn thread cannot extend this lease indefinitely.
            # This inference-only process never spawns descendants.
            os._exit(125)
    try:
        resource.setrlimit(resource.RLIMIT_CORE,(0,0))
        signal.signal(signal.SIGTERM,requested_stop)
        signal.signal(signal.SIGINT,requested_stop)
        threading.Thread(target=watchdog,daemon=True,name='provider-parent-watch').start()
        with os.fdopen(os.dup(0),'rb',buffering=0) as stream:
            value = validate_request(read_frame(stream))
        claim = LeaseClaim(sys.argv[2],value['runId'],value['sessionId'],value['expectedRevision'])
        if select.select([0],[],[],0)[0]:
            raise StoreError('provider-parent-disconnected')
        duration[0]=value['timeoutSeconds']
        armed.set()
        phase = 'snapshot'
        value = scoped_request(sys.argv[2], value)
        session = ProviderSession(sys.argv[2],expected_revision=value['expectedRevision'],
            confirmed=value['confirmed'],allow_cloud=value['allowCloud'],
            handoff_provider_id=value.get('handoffProviderId'),handoff_selection_scope=value.get('handoffSelectionScope'))
        phase = 'claim'
        with claim:
            try:
                if stopped.is_set():
                    raise StoreError('provider-lease-cancelled')
                phase = 'serve'
                with session.serve() as lease:
                    if stopped.is_set():
                        raise StoreError('provider-lease-cancelled')
                    sys.stdout.buffer.write(encode_frame(dict(schemaVersion=1,runId=value['runId'],
                        sessionId=value['sessionId'],lease=lease)))
                    sys.stdout.buffer.flush()
                    stopped.wait()
                claim.finish(reason[0],session.events)
            except BaseException:
                try:
                    claim.finish('failed',session.events)
                except (OSError,ValueError):
                    pass
                raise
        return 0
    except Exception:
        sys.stderr.write('provider-lease-worker-failed:'+phase+'\n')
        return 1
    finally:
        done.set()
        armed.set()


if __name__=='__main__':
    raise SystemExit(main())

```

### Core Architecture Module: `ods/bin/remote_provider/lifecycle.py`
```
"""Typed remote-provider lifecycle operation planning.

This module is intentionally side-effect free.  It gives the host-agent and
Dashboard/API one shared contract for configure/test/enable/disable/remove before
later slices add file mutation and live probes.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from .policy import (
    FORBIDDEN_PUBLIC_SECRET_ENV,
    PolicyError,
    plan_route,
    public_activation_receipt,
    redacted_secret_refs,
)


LIFECYCLE_OPERATION_SCHEMA = "ods.remote-provider-lifecycle-operation.v1"
LIFECYCLE_ACTIONS = frozenset({"configure", "test", "enable", "disable", "remove"})

_ACTION_PHASE = {
    "configure": "stage",
    "test": "validate",
    "enable": "stage",
    "disable": "commit",
    "remove": "commit",
}
_ACTION_DETAIL = {
    "configure": "remote provider route staged",
    "test": "remote provider route validated",
    "enable": "saved remote provider route requested for reactivation",
    "disable": "remote provider route disabled",
    "remove": "remote provider route removed",
}
_SECRET_FIELD_TO_REF = {
    "apiKey": "REMOTE_LLM_API_KEY",
    "peerToken": "REMOTE_ODS_PEER_TOKEN",
    "sshPrivateKey": "REMOTE_LLM_SSH_PRIVATE_KEY",
    "sshKnownHosts": "REMOTE_LLM_SSH_KNOWN_HOSTS",
    "tlsCaPem": "REMOTE_LLM_TLS_CA_PEM",
    "tlsClientCert": "REMOTE_LLM_TLS_CLIENT_CERT",
    "tlsClientKey": "REMOTE_LLM_TLS_CLIENT_KEY",
}
_SINGLE_LINE_SECRET_FIELDS = {"apiKey", "peerToken"}
_SSH_SECRET_FIELDS = {"sshPrivateKey", "sshKnownHosts"}
_DEFAULT_CONTEXT_LENGTH = 32768
_DEFAULT_MAX_TOKENS = 4096


class LifecycleError(PolicyError):
    """Raised when a lifecycle action request violates the public contract."""


def _string(value: object) -> str:
    return str(value or "").strip()


def _mapping(value: object, field: str) -> Mapping[str, Any]:
    if value is None:
        return {}
    if isinstance(value, Mapping):
        return value
    raise LifecycleError(f"{field} must be an object")


def _has_control_chars(value: str) -> bool:
    return any(ord(char) < 32 or ord(char) == 127 for char in value)


def _has_forbidden_multiline_secret_chars(value: str) -> bool:
    return any(
        (ord(char) < 32 and char not in "\r\n\t") or ord(char) == 127
        for char in value
    )


def _reject_public_secret_keys(payload: Mapping[str, Any]) -> None:
    present = sorted(key for key in payload if key in FORBIDDEN_PUBLIC_SECRET_ENV)
    if present:
        names = ", ".join(present)
        raise LifecycleError(
            "remote provider secrets must be passed under lifecycle secrets: "
            f"{names}"
        )


def _read_provider_field(
    payload: Mapping[str, Any],
    provider: Mapping[str, Any],
    key: str,
    env_name: str,
) -> str:
    return _string(provider.get(key) or payload.get(key) or payload.get(env_name))


def _read_ssh_field(
    payload: Mapping[str, Any],
    ssh: Mapping[str, Any],
    env_name: str,
    camel_name: str,
) -> str:
    return _string(ssh.get(camel_name) or payload.get(env_name) or payload.get(camel_name))


def _route_env(payload: Mapping[str, Any]) -> dict[str, str]:
    provider = _mapping(payload.get("provider"), "provider")
    peer = _mapping(payload.get("peer"), "peer")
    ssh = _mapping(payload.get("ssh"), "ssh")
    env = {
        "ODS_MODE": _string(payload.get("mode") or "cloud"),
        "REMOTE_LLM_ENABLED": "true",
        "REMOTE_LLM_TRANSPORT": _read_provider_field(
            payload, provider, "transport", "REMOTE_LLM_TRANSPORT"
        ).lower(),
        "REMOTE_LLM_BASE_URL": _read_provider_field(
            payload, provider, "baseUrl", "REMOTE_LLM_BASE_URL"
        ),
        "REMOTE_LLM_MODEL": _read_provider_field(
            payload, provider, "model", "REMOTE_LLM_MODEL"
        ),
    }
    for env_name, camel_name in (
        ("REMOTE_LLM_SSH_HOST", "host"),
        ("REMOTE_LLM_SSH_USER", "user"),
        ("REMOTE_LLM_SSH_PORT", "port"),
        ("REMOTE_LLM_SSH_INFERENCE_HOST", "inferenceHost"),
        ("REMOTE_LLM_SSH_INFERENCE_PORT", "inferencePort"),
        ("REMOTE_LLM_SSH_CONTROL_HOST", "controlHost"),
        ("REMOTE_LLM_SSH_CONTROL_PORT", "controlPort"),
    ):
        value = _read_ssh_field(payload, ssh, env_name, camel_name)
        if value:
            env[env_name] = value
    peer_url = _string(
        peer.get("controlBaseUrl")
        or peer.get("baseUrl")
        or payload.get("peerUrl")
        or payload.get("REMOTE_ODS_PEER_URL")
    )
    if peer_url:
        env["REMOTE_ODS_PEER_URL"] = peer_url
    return env


def _provider_runtime_contract(provider: Mapping[str, Any]) -> dict[str, Any]:
    """Validate the model limits Pixel and other agent consumers must know."""
    context_length = provider.get("contextLength", _DEFAULT_CONTEXT_LENGTH)
    if type(context_length) is not int or not 16384 <= context_length <= 10_000_000:
        raise LifecycleError("provider.contextLength must be an integer from 16384 to 10000000")
    max_tokens = provider.get("maxTokens", min(_DEFAULT_MAX_TOKENS, context_length // 8))
    if type(max_tokens) is not int or not 1 <= max_tokens <= context_length:
        raise LifecycleError("provider.maxTokens must be an integer within the context window")
    reasoning = provider.get("reasoning", False)
    if type(reasoning) is not bool:
        raise LifecycleError("provider.reasoning must be a boolean")
    return {
        "contextLength": context_length,
        "maxTokens": max_tokens,
        "reasoning": reasoning,
    }


def _disabled_route(payload: Mapping[str, Any]) -> dict[str, Any]:
    return plan_route(
        {
            "ODS_MODE": _string(payload.get("mode") or "cloud"),
            "REMOTE_LLM_ENABLED": "false",
        }
    )


def _validate_secret_value(field: str, value: object) -> str:
    if not isinstance(value, str):
        raise LifecycleError(f"secrets.{field} must be a string")
    secret = value.strip()
    if not secret:
        raise LifecycleError(f"secrets.{field} must not be empty")
    if field in _SINGLE_LINE_SECRET_FIELDS and _has_control_chars(secret):
        raise LifecycleError(f"secrets.{field} must be a single-line secret")
    if (
        field not in _SINGLE_LINE_SECRET_FIELDS
        and _has_forbidden_multiline_secret_chars(secret)
    ):
        raise LifecycleError(f"secrets.{field} contains unsupported control characters")
    return secret


def _secret_refs_for_action(
    *,
    action: str,
    transport: str,
    secrets: Mapping[str, Any],
) -> dict[str, str]:
    if action not in {"configure", "test"}:
        return {}
    unknown = sorted(key for key in secrets if key not in _SECRET_FIELD_TO_REF)
    if unknown:
        names = ", ".join(unknown)
        raise LifecycleError(f"unsupported remote-provider secret fields: {names}")
    if any(key in FORBIDDEN_PUBLIC_SECRET_ENV for key in secrets):
        raise LifecycleError("remote provider secrets must use lifecycle secret field names")
    if "apiKey" not in secrets:
        raise LifecycleError("secrets.apiKey is required for remote-provider validation")
    required = {"apiKey"}
    if transport == "ssh":
        required |= _SSH_SECRET_FIELDS
    missing = sorted(field for field in required if field not in secrets)
    if missing:
        names = ", ".join(f"secrets.{field}" for field in missing)
        raise LifecycleError(f"{names} required for {transport} remote-provider transport")
    refs: dict[str, str] = {}
    for field, value in secrets.items():
        _validate_secret_value(field, value)
        refs[field] = _SECRET_FIELD_TO_REF[field]
    return refs


def _write_plan(action: str, secret_refs: Mapping[str, str]) -> dict[str, bool]:
    return {
        "routingState": action in {"configure", "enable", "disable"},
        "providerSecret": action == "configure" and "apiKey" in secret_refs,
        "peerToken": action == "configure" and "peerToken" in secret_refs,
        "sshIdentity": action == "configure" and "sshPrivateKey" in secret_refs,
        "sshKnownHosts": action == "configure" and "sshKnownHosts" in secret_refs,
        "removesRoutingState": action == "remove",
        "removesSecrets": action == "remove",
    }


def plan_lifecycle_operation(
    payload: Mapping[str, Any],
    *,
    action: str | None = None,
) -> dict[str, Any]:
    """Return the public, redacted lifecycle operation plan for a request."""
    if not isinstance(payload, Mapping):
        raise LifecycleError("remote-provider lifecycle payload must be an object")
    _reject_public_secret_keys(payload)
    requested_action = _string(action or payload.get("action")).lower()
    if requested_action not in LIFECYCLE_ACTIONS:
        allowed = ", ".join(sorted(LIFECYCLE_ACTIONS))
        raise LifecycleError(f"remote-provider lifecycle action must be one of: {allowed}")

    if requested_action in {"configure", "test"}:
        provider = _mapping(payload.get("provider"), "provider")
        route = plan_route(_route_env(payload))
        route_provider = route.get("provider")
        if not isinstance(route_provider, dict):
            raise LifecycleError("remote-provider route is missing provider metadata")
        route_provider.update(_provider_runtime_contract(provider))
        transport = str(route.get("transport") or "")
    else:
        route = _disabled_route(payload)
        transport = ""

    secrets = _mapping(payload.get("secrets"), "secrets")
    secret_refs = _secret_refs_for_action(
        action=requested_action,
        transport=transport,
        secrets=secrets,
    )
    redacted_refs = redacted_secret_refs(secret_refs.values())
    receipt = public_activation_receipt(
        route,
        phase=_ACTION_PHASE[requested_action],
        ok=True,
        detail=_ACTION_DETAIL[requested_action],
        secret_refs=secret_refs.values(),
    )
    return {
        "schema": LIFECYCLE_OPERATION_SCHEMA,
        "action": requested_action,
        "
```

### Core Architecture Module: `ods/extensions/services/dashboard-api/pixel_runtime_state.py`
```
"""Process-local coordination between Pixel streams and model activation."""

from __future__ import annotations

import os
import threading

import httpx


_lock = threading.Lock()
_active_streams = 0
_PIXEL_EDGE_ACTIVITY_URL = "http://pixel-edge:9595/v1/activity"
_MAX_ACTIVITY_BYTES = 1024
_DEFAULT_MAX_STREAMS = 8


def begin_pixel_stream() -> None:
    """Record a dashboard Pixel stream after its upstream accepts the turn."""
    global _active_streams
    with _lock:
        _active_streams += 1


def try_begin_pixel_stream() -> bool:
    """Atomically admit a stream before opening an upstream connection."""
    global _active_streams
    try:
        limit = int(os.environ.get("ODS_PIXEL_MAX_STREAMS", _DEFAULT_MAX_STREAMS))
    except (TypeError, ValueError):
        limit = _DEFAULT_MAX_STREAMS
    limit = max(1, min(limit, 1024))
    with _lock:
        if _active_streams >= limit:
            return False
        _active_streams += 1
        return True


def end_pixel_stream() -> None:
    """Release one dashboard Pixel stream without allowing counter underflow."""
    global _active_streams
    with _lock:
        _active_streams = max(0, _active_streams - 1)


def _local_pixel_stream_active() -> bool:
    with _lock:
        return _active_streams > 0


def _pixel_edge_stream_active() -> bool:
    """Read the content-free activity projection shared with Open WebUI."""
    key = os.environ.get("PIXEL_OPENWEBUI_KEY", "")
    if not key or key != key.strip() or len(key) < 32 or len(key) > 4096:
        return False
    try:
        timeout = httpx.Timeout(connect=2.0, read=2.0, write=2.0, pool=2.0)
        with httpx.Client(timeout=timeout, trust_env=False, follow_redirects=False) as client:
            response = client.get(
                _PIXEL_EDGE_ACTIVITY_URL,
                headers={"Authorization": f"Bearer {key}", "Accept": "application/json"},
            )
        if response.status_code != 200:
            return False
        if not response.headers.get("content-type", "").lower().startswith("application/json"):
            return False
        if len(response.content) > _MAX_ACTIVITY_BYTES:
            return False
        payload = response.json()
    except (httpx.HTTPError, ValueError, TypeError):
        return False
    return (
        isinstance(payload, dict)
        and set(payload) == {"active", "streams"}
        and payload.get("active") is True
        and isinstance(payload.get("streams"), int)
        and not isinstance(payload.get("streams"), bool)
        and payload["streams"] > 0
    )


def pixel_stream_active() -> bool:
    """Return whether model activation would interrupt any live Pixel turn."""
    return _local_pixel_stream_active() or _pixel_edge_stream_active()

```

### Core Architecture Module: `ods/extensions/services/dashboard-api/routers/model_state.py`
```
"""Read-only Model Switchboard state endpoint (PR 1, observe mode).

Registered before the dynamic ``/api/models/{model_id}`` routes. The host
agent is the only writer of ``data/model-state.json``; this endpoint is a
sanitized reader. Malformed state is reported diagnostically — it is never
promoted, repaired, or treated as a server error.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends
from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

from config import DATA_DIR, INSTALL_DIR
from security import verify_api_key

logger = logging.getLogger(__name__)

router = APIRouter(tags=["models"])

_STATE_SCHEMA = "ods.model-state.v1"


def _state_path() -> Path:
    data_dir = os.environ.get("ODS_DATA_DIR") or DATA_DIR
    return Path(data_dir) / "model-state.json"


def _schema_path() -> Path:
    override = os.environ.get("ODS_MODEL_STATE_SCHEMA_PATH")
    if override:
        return Path(override)
    return Path(INSTALL_DIR) / "config" / "model-state.schema.v1.json"


def _invalid_response(errors: list[str], *, exists: bool = True) -> dict[str, Any]:
    return {
        "exists": exists,
        "valid": False,
        "errors": errors,
        "schema": _STATE_SCHEMA,
        "seq": None,
        "routeSeq": None,
        "operation": None,
        "desired": None,
        "active": None,
        "history": [],
        "historyCount": 0,
        "availability": None,
        "capabilityImpact": {"agentViable": None},
    }


def _validate_document(doc: Any) -> list[str]:
    try:
        schema = json.loads(_schema_path().read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        validator = Draft202012Validator(schema)
    except (OSError, ValueError, SchemaError) as exc:
        logger.warning("model-state schema unavailable or invalid: %s", exc)
        return ["state schema unavailable or invalid"]

    errors = []
    def sort_key(item):
        return tuple(str(part) for part in item.absolute_path)

    for error in sorted(validator.iter_errors(doc), key=sort_key):
        location = ".".join(str(part) for part in error.absolute_path) or "state"
        errors.append(f"{location}: {error.message}")
    return errors


def _summarize(doc: dict[str, Any]) -> dict[str, Any]:
    active = doc.get("active") if isinstance(doc.get("active"), dict) else None
    capabilities = None
    if active and isinstance(active.get("capabilities"), dict):
        capabilities = active["capabilities"]
    history = doc.get("history") if isinstance(doc.get("history"), list) else []
    return {
        "exists": True,
        "valid": True,
        "errors": [],
        "schema": doc.get("schema"),
        "seq": doc.get("seq"),
        "routeSeq": doc.get("routeSeq"),
        "operation": doc.get("operation"),
        "desired": doc.get("desired"),
        "active": active,
        "history": history,
        "historyCount": len(history),
        "availability": doc.get("availability"),
        "capabilityImpact": {
            "agentViable": bool(capabilities.get("agentViable")) if capabilities else None,
        },
    }


@router.get("/api/models/state")
async def get_model_state(api_key: str = Depends(verify_api_key)):
    """Sanitized switchboard state summary; read-only by contract."""
    path = _state_path()
    try:
        raw = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return _invalid_response([], exists=False)
    except (OSError, UnicodeError) as exc:
        logger.warning("model-state read failed: %s", exc)
        return _invalid_response(["read failed"])

    try:
        doc = json.loads(raw)
    except ValueError as exc:
        logger.warning("model-state is not valid JSON: %s", exc)
        return _invalid_response(["not valid JSON"])

    if not isinstance(doc, dict):
        return _invalid_response(["document root must be a JSON object"])

    errors = _validate_document(doc)
    if errors:
        return _invalid_response(errors)
    return _summarize(doc)

```

### Core Architecture Module: `ods/extensions/services/dashboard/src/hooks/useBeforeUnload.js`
```
import { useEffect } from 'react'

/** Request the browser's leave-page confirmation only while edits may be lost. */
export function useBeforeUnload(enabled) {
  useEffect(() => {
    if (!enabled) return
    const protectDraft = (event) => {
      event.preventDefault()
      event.returnValue = true // Legacy browsers also require returnValue.
    }
    window.addEventListener('beforeunload', protectDraft)
    return () => window.removeEventListener('beforeunload', protectDraft)
  }, [enabled])
}

```

### Core Architecture Module: `ods/extensions/services/dashboard/src/hooks/useComposerFocus.js`
```
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

const hasSelection = () => Boolean(window.getSelection()?.toString())
// A persistent notice (for example the install banner) opts out with
// data-composer-focus-ignore so it cannot disable focus restoration for good.
const hasOverlay = () => Array.from(document.querySelectorAll(
  'dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"], [role="menu"], [role="listbox"]',
)).some(element => !element.closest('[hidden], [aria-hidden="true"], [data-composer-focus-ignore]'))
const isPageFocused = () => [document.body, document.documentElement].includes(document.activeElement)
const isHidden = field => !field.isConnected || Boolean(field.closest('[hidden], [aria-hidden="true"], [inert]'))

// Disabled textareas lose browser focus during a turn. Restore only the user's
// composer focus, never focus that has since moved to another control or window.
export function useComposerFocus({ inputRef, disabled, visible = true, onType }) {
  const pending = useRef(true)
  const initial = useRef(true)
  const pendingCaret = useRef(null)

  useEffect(() => {
    const focused = event => {
      pending.current = event.target === inputRef.current
      if (pending.current) initial.current = false
    }
    const pointer = event => {
      if (event.target !== inputRef.current) pending.current = false
    }
    const blur = () => { pending.current = false }
    const keydown = event => {
      if (event.key === 'Tab' || event.key === 'Escape') pending.current = false
      if (disabled || !visible || event.defaultPrevented || event.isComposing || event.keyCode === 229
        || event.ctrlKey || event.metaKey || event.altKey || Array.from(event.key).length !== 1
        || ![document.body, document.documentElement].includes(event.target)
        || !isPageFocused() || hasSelection() || hasOverlay()) return
      const field = inputRef.current
      if (!field || field.disabled || field.readOnly || isHidden(field)) return
      event.preventDefault()
      const start = field.selectionStart ?? field.value.length
      const end = field.selectionEnd ?? start
      pendingCaret.current = start + event.key.length
      // Do not rely on browsers retargeting the original key after focus changes.
      onType(event.key, start, end)
      field.focus({ preventScroll: true })
    }
    document.addEventListener('focusin', focused)
    document.addEventListener('pointerdown', pointer)
    document.addEventListener('keydown', keydown)
    window.addEventListener('blur', blur)
    return () => {
      document.removeEventListener('focusin', focused)
      document.removeEventListener('pointerdown', pointer)
      document.removeEventListener('keydown', keydown)
      window.removeEventListener('blur', blur)
    }
  }, [inputRef, disabled, visible, onType])

  // Apply the caret only after React commits the value produced by onType.
  useLayoutEffect(() => {
    const caret = pendingCaret.current
    if (caret === null) return
    pendingCaret.current = null
    const field = inputRef.current
    if (!field || document.activeElement !== field || field.disabled || field.readOnly || !visible || isHidden(field)) return
    const position = Math.min(caret, field.value.length)
    field.setSelectionRange(position, position)
  })

  useEffect(() => {
    if (disabled || !visible || !pending.current) return
    pending.current = false
    const field = inputRef.current
    // Opening the page on touch devices should not summon the software keyboard.
    const touchEntry = initial.current && window.matchMedia?.('(pointer: coarse)').matches
    initial.current = false
    if (!touchEntry && field && !field.disabled && !field.readOnly && !isHidden(field)
      && (isPageFocused() || document.activeElement === field) && !hasSelection() && !hasOverlay()) {
      field.focus({ preventScroll: true })
    }
  }, [disabled, visible, inputRef])

  return useCallback(() => {
    pending.current = true
    initial.current = false
    const field = inputRef.current
    if (visible && field && !field.disabled && !field.readOnly && !isHidden(field)) {
      field.focus({ preventScroll: true })
    }
  }, [inputRef, visible])
}

```

### Core Architecture Module: `ods/extensions/services/dashboard/src/hooks/useDownloadProgress.js`
```
import { useState, useEffect, useCallback, useRef } from 'react'

const TERMINAL_DOWNLOAD_STATUSES = new Set(['failed', 'error', 'cancelled'])
// Allow the API's 30-second host-agent request to settle before giving up.
const CANCEL_ACK_TIMEOUT_MS = 45000

function isTerminalProgress(progress) {
  return TERMINAL_DOWNLOAD_STATUSES.has(progress?.status)
}

async function errorFromResponse(response, fallback) {
  try {
    const payload = await response.json()
    const detail = payload?.detail
    if (typeof detail === 'string' && detail.trim()) return detail
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error
    if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message
  } catch {
    // Fall through to the stable user-facing fallback.
  }
  return fallback
}

/**
 * Hook to poll download progress during model downloads.
 * Returns progress data when a download is active.
 */
export function useDownloadProgress(pollIntervalMs = 1000) {
  const [progress, setProgress] = useState(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [completedDownload, setCompletedDownload] = useState(null)
  const [statusError, setStatusError] = useState(null)
  const [cancelError, setCancelError] = useState(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const lastCompleteKeyRef = useRef(null)
  const progressRequestRef = useRef(0)
  const latestAppliedProgressRequestRef = useRef(0)
  const cancelInFlightRef = useRef(false)

  const fetchProgress = useCallback(async () => {
    const requestId = ++progressRequestRef.current
    try {
      const response = await fetch('/api/models/download-status')
      if (requestId < latestAppliedProgressRequestRef.current) return null
      latestAppliedProgressRequestRef.current = requestId
      if (!response.ok) {
        const detail = await errorFromResponse(
          response,
          `Download status unavailable (HTTP ${response.status}).`,
        )
        if (requestId < latestAppliedProgressRequestRef.current) return null
        setStatusError(detail)
        return null
      }
      
      const data = await response.json()
      if (requestId < latestAppliedProgressRequestRef.current) return null
      setStatusError(null)
      
      if (data.status === 'downloading' || data.status === 'verifying') {
        const downloaded = data.bytesDownloaded || 0
        const total = data.bytesTotal || 0
        const rawPercent = total > 0 ? (downloaded / total) * 100 : 0
        const percent = Math.min(100, Math.max(0, rawPercent))

        setIsDownloading(true)
        setProgress({
          model: data.model,
          status: data.status,
          percent,
          bytesDownloaded: downloaded,
          bytesTotal: total,
          speedMbps: data.speedBytesPerSec ? data.speedBytesPerSec / (1024 * 1024) : 0,
          eta: data.eta,
          startedAt: data.startedAt
        })
      } else if (data.status === 'complete' || data.status === 'idle') {
        setIsDownloading(false)
        setCancelError(null)
        if (data.status === 'complete') {
          setProgress(null)
          const completeKey = `${data.model || ''}:${data.updatedAt || ''}`
          if (completeKey && completeKey !== lastCompleteKeyRef.current) {
            lastCompleteKeyRef.current = completeKey
            setCompletedDownload({
              model: data.model,
              status: data.status,
              updatedAt: data.updatedAt
            })
          }
        } else {
          // A later idle snapshot must not erase the only visible record of a
          // failed or cancelled transfer. The next download or dismissal does.
          setProgress(current => isTerminalProgress(current) ? current : null)
        }
      } else if (TERMINAL_DOWNLOAD_STATUSES.has(data.status)) {
        setIsDownloading(false)
        setCancelError(null)
        setProgress({
          status: data.status,
          error: data.error || data.message || (data.status === 'cancelled' ? 'Download cancelled' : 'Download failed'),
          model: data.model
        })
      }
      return data
    } catch (err) {
      if (requestId < latestAppliedProgressRequestRef.current) return null
      latestAppliedProgressRequestRef.current = requestId
      setStatusError(`Download status unavailable: ${err?.message || 'network error'}`)
      return null
    }
  }, [])

  useEffect(() => {
    void fetchProgress()
  }, [fetchProgress])

  useEffect(() => {
    // Poll frequently only while downloading; otherwise check every 10s.
    // Skip ticks while the tab is hidden — nobody sees the progress bar and
    // the visibility handler below catches state up on return (#1490).
    const activeInterval = isDownloading ? pollIntervalMs : 10000
    const tick = () => { if (!document.hidden) fetchProgress() }
    const interval = setInterval(tick, activeInterval)

    // Resume immediately when the tab becomes visible again
    const onVisibility = () => { if (!document.hidden) fetchProgress() }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [fetchProgress, pollIntervalMs, isDownloading])

  // Format helpers
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B'
    const gb = bytes / (1024 ** 3)
    if (gb >= 1) return `${gb.toFixed(2)} GB`
    const mb = bytes / (1024 ** 2)
    if (mb >= 1) return `${mb.toFixed(1)} MB`
    const kb = bytes / 1024
    if (kb >= 1) return `${kb.toFixed(0)} KB`
    return `${bytes.toFixed(0)} B`
  }

  const formatEta = (eta) => {
    if (!eta || eta === 'calculating...') return 'calculating...'
    if (typeof eta === 'number') {
      const mins = Math.floor(eta / 60)
      // Floor the seconds too — a fractional eta (bytes-remaining / rate is a
      // float) otherwise renders as "1m 30.700000000000003s". Mirrors the
      // Math.floor already applied to minutes.
      const secs = Math.floor(eta % 60)
      if (mins > 0) return `${mins}m ${secs}s`
      return `${secs}s`
    }
    return eta
  }

  const cancelDownload = useCallback(async () => {
    if (cancelInFlightRef.current) return null
    cancelInFlightRef.current = true
    setIsCancelling(true)
    setCancelError(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CANCEL_ACK_TIMEOUT_MS)
    try {
      const response = await fetch('/api/models/download/cancel', {
        method: 'POST',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(await errorFromResponse(response, 'Failed to cancel download.'))
      // The acknowledgement owns this guard. Status polling remains authoritative
      // about the transfer and must not keep the Cancel button locked on a stall.
      return fetchProgress()
    } catch (err) {
      setCancelError(controller.signal.aborted
        ? 'Cancellation was not acknowledged within 45 seconds. Check download progress before retrying.'
        : err?.message || 'Failed to cancel download.')
      return null
    } finally {
      clearTimeout(timeout)
      cancelInFlightRef.current = false
      setIsCancelling(false)
    }
  }, [fetchProgress])

  const clearTerminal = useCallback(() => {
    setProgress(current => isTerminalProgress(current) ? null : current)
    setCancelError(null)
  }, [])

  return {
    isDownloading,
    progress,
    completedDownload,
    statusError,
    cancelError,
    isCancelling,
    formatBytes,
    formatEta,
    refresh: fetchProgress,
    cancelDownload,
    clearTerminal
  }
}

```

### Core Architecture Module: `ods/extensions/services/dashboard/src/hooks/useExtensionInstallation.js`
```
import { useCallback, useEffect, useRef, useState } from 'react'
import { extensionSetupTarget } from '../components/PortalExtensionSetup'

const terminal = new Set(['succeeded', 'failed', 'blocked', 'configuration_required', 'reconciliation_required'])

export async function advanceCatalogInstallation(target, signal, report, fetcher = fetch) {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(target)) throw new Error('Invalid extension')
  // Only the server coordinator chooses dependencies and submits host effects.
  // Its durable journal prevents replay after a lost or delayed acknowledgement.
  for (let attempt = 0; attempt < 720 && !signal.aborted; attempt++) {
    const request = new AbortController()
    const abort = () => request.abort()
    signal.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(abort, 240000)
    let receipt
    try {
      const response = await fetcher(`/api/extensions/${target}/install-next`, {
        method: 'POST', signal: request.signal, cache: 'no-store',
      })
      if (!response.ok) throw new Error('Installation acknowledgement unavailable')
      receipt = await response.json()
      if (receipt?.schemaVersion !== 1 || receipt.extensionId !== target ||
          !['pending', ...terminal].includes(receipt.state) || typeof receipt.dispatched !== 'boolean' ||
          receipt.plan?.extensionId !== target || !Array.isArray(receipt.plan.steps) ||
          !receipt.plan.steps.length || receipt.plan.steps.length > 128 ||
          (receipt.state === 'succeeded' && (receipt.dispatched || receipt.plan.steps.some(step =>
            step.action !== 'none' || !['enabled', 'cli_installed'].includes(step.status))))) {
        throw new Error('Installation receipt is inconsistent')
      }
    } finally {
      clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
    }
    if (signal.aborted) return
    report({ target, state: receipt.state })
    if (terminal.has(receipt.state)) return
    await new Promise(resolve => {
      const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve() }
      const timer = setTimeout(finish, 5000)
      signal.addEventListener('abort', finish, { once: true })
      if (signal.aborted) finish()
    })
  }
  if (!signal.aborted) report({ target, state: 'reconciliation_required' })
}

export default function useExtensionInstallation(chatId) {
  const current = useRef(null)
  const [state, setState] = useState(null)
  const stop = useCallback(() => {
    current.current?.controller.abort()
    current.current = null
    setState(null)
  }, [])
  useEffect(() => { stop(); return () => current.current?.controller.abort() }, [chatId, stop])
  const start = useCallback((command, parentSignal, identity = {}) => {
    const target = extensionSetupTarget(command)
    if (!target || parentSignal?.aborted) return
    if (current.current?.target === target && current.current.command === command && !current.current.controller.signal.aborted) return
    current.current?.controller.abort()
    const controller = new AbortController()
    const run = { target, command, controller }
    current.current = run
    const abort = () => {
      controller.abort()
      if (current.current === run) setState({ target, command, state: 'reconciliation_required' })
    }
    parentSignal?.addEventListener('abort', abort, { once: true })
    const report = value => { if (current.current === run && !controller.signal.aborted) setState({ ...value, command, requestId: identity.requestId, chatId: identity.chatId }) }
    report({ target, state: 'pending' })
    advanceCatalogInstallation(target, controller.signal, report).catch(() => {
      report({ target, state: 'reconciliation_required' })
    }).finally(() => {
      parentSignal?.removeEventListener('abort', abort)
      if (current.current === run) current.current = null
    })
  }, [])
  const resume = useCallback(() => {
    if (state?.chatId !== chatId || state.state !== 'reconciliation_required') return
    start(state.command, undefined, { chatId: state.chatId, requestId: state.requestId })
  }, [chatId, state, start])
  return { state, start, stop, resume }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7092** (2026-10-05): **Installer failed - Strix Halo - CachyOS**
  *Symptoms*: ### Description  ` ░▒▓█▓▒░ Waking the stack...   ▸ I'm bringing systems online. You can breathe.    ⠧ [00:07] [1/12] Building dashboard (attempt 1/3)      « ODS will use the external inference endpoint you selected. »   ⠴ [00:15] [1/12] Building dashboard (attempt 1/3)      « Traffic handling depends on that endpoint and its operator. »   ✓ dashboard built                                                ⠧ [00:07] [2/12] Building dashboard-api (attempt 1/3)      « ODS will use the external inference endpoint you selected. »   ⠴ [00:15] [2/12] Building dashboard-api (attempt 1/3)      « Traffic handling depends on that endpoint and its operator. »   ✓ dashboard-api built                                            ⠧ [00:07] [3/12] Building model-router (attempt 1/3)      « ODS will use the external inference endpoint you selected. »   ✓ model-router built                                             ⚠ remote-provider-egress build failed (attempt 1/3)               ⚠ remote-provider-egress build failed; retrying in 5s (attempt 2/3)...   ⚠ remote-provider-egress build failed (attempt 2/3)               ⚠ remote-provider-egress build failed; retrying in 5s (attempt 3/3)...   ⚠ remote-provider-egress build failed (attempt 3/3)               ⚠ remote-provider-egress build failed or image missing           ▸ Build log: /tmp/ods-install-1000.log.remote-provider-egress.build.log   ⚠ remote-provider-ssh-tunnel build failed (attempt 1/3)       1/3)    ⚠ remote-provider-ssh-tunnel build fail
  **Post-Mortem & Fix Analysis**:
  > Looks like `docker-buildx` package is required, but not installed by the script. Manually installing this package allowed the install to complete.

- **Issue #3763** (2026-10-04): **ComfyUI workflows mount should be read write.**
  *Symptoms*: ### Description  The workflows are getting saved in docker container, not on ods/data/comfyui/workflows: It should be read write.   "Mode": "ro,z" -> "Mode": "rw,z".   ### Steps to Reproduce  1. Open the URL : http://localhost:8188 2. Click on Workflows, it won't show the workflows on ods/data/comfyui/workflows. 3. Try to save any workflow, it saves in the docker container only.  ### Expected Behavior  The ComfyUI workflows should be saved on ods/data/comfyui/workflows  ### Actual Behavior  Saves in docker container /opt/comfyui/user/default/workflows  ### Operating System  Ubuntu 24.04  ### GPU  GB10  ### Docker Version  29.2.1  ### VRAM  128GB Unified  ### Logs  ```shell  ```  ### Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > Confirmed, but the root cause is a level deeper than the mount mode, so flipping `ro,z` to `rw,z` will not fix it.  `/workflows` is not where ComfyUI saves anything. `startup.sh:57-63` treats it as a read-only *template* source and copies `*.json` out of it into `${COMFYUI_DIR}/user/default/workflows`, i.e. `/opt/comfyui/user/default/workflows` — exactly the in-container path you observed. The README documents `/workflows` as "Workflow JSON templates (read-only)", so the `ro` there is deliberate.  The actual defect is that **`/opt/comfyui/user` is not bind-mounted at all**. `compose.nvidia.yaml` mounts `models`, `output`, `input` and the template dir, but nothing maps ComfyUI's user directory to the host. Everything it writes there — saved workflows and the UI settings that live alongside them — exists only in the container's writable layer, so it is destroyed on any recreate, including a routine `ods update`. That makes this data loss, not just a save that lands in the wrong place.  A
  > Opened #4123 with a fix for the persistence gap described above.  It mounts `./data/comfyui/user` at `/user` and symlinks `$COMFYUI_DIR/user` to it — outside the ComfyUI tree, matching the shape `output/` and `input/` already use — and links it before the workflow templates are copied so those land in the persisted directory too. Existing container-side workflows are migrated on the first start rather than discarded, and the block is skipped when `/user` is not mounted so an older compose file still works. Phase 11 pre-creates the host directory; rootless installs are already covered by the recursive `data/comfyui` entry in `lib/rootless-ownership.sh`.  The read-only `/workflows` mount is left as-is, since it is a deliberate template source rather than where ComfyUI saves anything.  I do not have a Docker host, so it is validated by rendering the resolved NVIDIA stack and by running `startup.sh`'s persistence block against a fixture — not against a live container. A check on a GPU host
  > Fixed by #4123, which merged into `public-beta` on 2026-09-13. `public-beta` was promoted into `main` on 2026-09-24 (#6515), and the fix commit is part of `main` (`f2abac3e3`). GitHub only closes issues automatically when a fix merges into the default branch, which is why this stayed open.  Closing as completed. If it still reproduces on current `main`, please reopen with the details.

- **Issue #3140** (2026-09-04): **Guide dashboard setup failed with "Failed to mark setup complete"**
  *Symptoms*: ### Description  I accessed the URL http://localhost:3001 and followed up the guided process.  No matters which option I choose I always get:  `ods-dashboard  | 192.168.16.1 - - [24/Aug/2026:19:56:27 +0000] "POST /api/setup/complete HTTP/1.1" 500 21 "http://localhost:3001/" "Mozilla/5.0 (X11; Linux x86_64; rv:148.0) Gecko/20100101 Firefox/148.0" "-" `  <img width="1198" height="1475" alt="Image" src="https://github.com/user-attachments/assets/dae54c68-3431-4b0b-b0f1-69fbb4cdaefa" />   and from the dashboard-api logs:  ``` ods-dashboard-api  | INFO:     192.168.16.10:38096 - "GET /health HTTP/1.1" 200 OK ods-dashboard-api  | Failed to read .env for model info: [Errno 13] Permission denied: '/ods/.env' ods-dashboard-api  | INFO:     192.168.16.17:47420 - "GET /api/status HTTP/1.1" 200 OK ods-dashboard-api  | INFO:     192.168.16.17:47426 - "GET /api/external-links HTTP/1.1" 200 OK ods-dashboard-api  | INFO:     192.168.16.17:47442 - "GET /api/service-tokens HTTP/1.1" 200 OK ods-dashboard-api  | Failed to read .env for model info: [Errno 13] Permission denied: '/ods/.env' ods-dashboard-api  | INFO:     192.168.16.17:47470 - "GET /api/setup/status HTTP/1.1" 200 OK ods-dashboard-api  | INFO:     192.168.16.17:47440 - "GET /api/auth/verify-session HTTP/1.1" 200 OK ods-dashboard-api  | INFO:     192.168.16.17:47468 - "GET /api/version HTTP/1.1" 200 OK ods-dashboard-api  | INFO:     192.168.16.17:47452 - "GET /api/status HTTP/1.1" 200 OK ods-dashboard-api  | INFO:     192.168.16.17:4

- **Issue #2988** (2026-08-22): **linux-install-preflight.sh hard-fails Podman as unsupported, contradicting installer support added in #2804**
  *Symptoms*: ### Description  ## Description  `scripts/linux-install-preflight.sh` detects when the Docker CLI is actually a Podman-compatible shim and deliberately fails three checks (`DOCKER_ENGINE`, `DOCKER_DAEMON`, `COMPOSE_CLI`), instructing the user to "remove podman-docker or put Docker Engine first in PATH."  It also skips real daemon/Compose probing entirely once Podman is detected, so a Podman user gets no diagnostic information at all — just three canned failures.  This directly contradicts `installers/phases/05-docker.sh`, which as of PR #2804 (merged 2026-08-21) actively detects and configures Podman:  - It sources `installers/lib/podman-registries.sh` to fix Podman's short-name image resolution. - It calls `_runtime_is_podman()` to branch installer behavior. - Its own error text at line 143 reads "Install Docker or Podman first, then re-run ODS." - `installers/lib/sudo.sh:68` likewise says "Core ODS runs rootless via Docker/Podman."  So the installer phases treat Podman as supported; the preflight script that runs before them still treats it as a hard blocker.  A user following the documented `./scripts/linux-install-preflight.sh` pre-check will be told to abandon their working Podman setup, even though the actual installer would proceed.  This matches the community-reported issue #2933-adjacent behavior: issue #2932 ("install script incompatible with podman") reports the installer dying with an error under Podman on Fedora, though that report has no logs attached, so I can'
  **Post-Mortem & Fix Analysis**:
  > same root cause as test-linux-install-preflight.sh and test-podman-rootless-contracts.sh assert opposite Podman support contracts  #2977

- **Issue #2977** (2026-09-04): **test-linux-install-preflight.sh and test-podman-rootless-contracts.sh assert opposite Podman support contracts**
  *Symptoms*: ### Description    PR #2804 (merged 2026-08-21) added rootless Podman support to the Linux installer through:  - `installers/lib/podman-registries.sh` - Podman detection in `installers/phases/05-docker.sh` - `tests/test-podman-rootless-contracts.sh`  However, the existing `tests/test-linux-install-preflight.sh` was not updated and still asserts the opposite behavior: that a Podman-backed Docker CLI must fail preflight as an unsupported runtime.  Both tests run as part of the same CI suite, so the test suite currently encodes two contradictory contracts for Podman support on Linux.    ### Steps to Reproduce      1. Check out `main` at commit `6ff9b4fc` or later. 2. Open `tests/test-linux-install-preflight.sh`, lines 83–124. 3. Observe that the test expects the following for a Docker CLI reporting itself as Podman:    - `checks["DOCKER_ENGINE"]["status"] == "fail"`    - `checks["DOCKER_DAEMON"]["status"] == "fail"`    - `checks["COMPOSE_CLI"]["status"] == "fail"`    - `report["summary"]["exit_ok"] is False` 4. Open `tests/test-podman-rootless-contracts.sh`, added by PR #2804. 5. Open `installers/phases/05-docker.sh`, lines 390–406, and inspect `_runtime_is_podman` and `_ensure_podman_dockerhub_search`. 6. Compare the two contracts:    - `test-linux-install-preflight.sh` expects Podman to fail.    - `test-podman-rootless-contracts.sh` exists to verify that Podman works.    ### Expected Behavior    The test suite should have one consistent contract for whether ODS supports Podman

- **Issue #2701** (2026-10-05): **`direct_http_clients` dictionary in egress service grows without bound leaking HTTP clients and connection pools**
  *Symptoms*: ### Description  In the `remote-provider-egress` service (`ods/extensions/services/remote-provider-egress/app/main.py`), `_http_client(connection_key)` caches `httpx.AsyncClient` instances inside `app.state.direct_http_clients` keyed by `connection_key` (derived from scheme, host, and port).  When an operator rotates remote providers or updates provider URLs over time (e.g. `configure` -> `disable` -> `configure` with a different endpoint), a new `httpx.AsyncClient` is created and stored in `app.state.direct_http_clients` on each URL change. However, old clients for previous provider endpoints are never evicted or closed during runtime. Over time, the dictionary grows indefinitely and accumulates stale HTTP clients with active connection pools.   ### Steps to Reproduce  1. Run the `remote-provider-egress` service with an active direct remote provider. 2. Send requests to `/v1/chat/completions` (triggers client creation for target provider A). 3. Update the remote provider configuration to target provider endpoint B, then C, then D. 4. Send requests after each endpoint update. 5. Inspect `app.state.direct_http_clients` or monitor open sockets / container memory:    Notice that client instances for A, B, C, and D remain in memory and are never closed or evicted.   ### Expected Behavior  Stale `httpx.AsyncClient` instances for previous endpoints should be closed and evicted from `direct_http_clients` when a new connection key is used or when the cache exceeds a small capacity bo

- **Issue #2699** (2026-10-05): **Blocking urllib call in async /probe handler stalls FastAPI event loop during remote provider test.**
  *Symptoms*: ### Description  `probe_route_response()` is called directly inside the `async def probe()` FastAPI route handler in the `remote-provider-egress` service. Internally, it calls `probe_provider_route()` → `_probe_models_endpoint()`, which uses `urllib.request.urlopen()` — a fully synchronous, blocking HTTP call.  Because FastAPI runs on an asyncio event loop and this call is not offloaded to a thread executor, the entire event loop is blocked for the full duration of the probe timeout (10 seconds by default). All concurrent inference requests (`/v1/chat/completions`, streaming or not) are frozen while the probe waits for the remote provider to respond.   ### Steps to Reproduce  ### Reproduction Steps  1. Install ODS with a remote provider configured in direct or SSH transport mode. 2. Start a long-running streaming inference request:  ```bash curl -N http://localhost:8091/v1/chat/completions \   -H "Content-Type: application/json" \   -d '{"model":"ods/current","messages":[{"role":"user","content":"Count slowly to 100"}],"stream":true}' ```  3. While the stream is in progress, trigger a remote provider probe from the dashboard or directly:  ```bash curl -X POST http://localhost:8091/probe ```  4. Observe that the streaming inference response pauses completely for up to 10 seconds (the default probe timeout) while the probe runs. 5. Check the event loop: no other requests are served during the probe.   ### Expected Behavior    The `/probe` endpoint executes the synchronous `urll

- **Issue #2623** (2026-09-05): **ods-uninstall.sh echoes sudo password to terminal**
  *Symptoms*: ### Description  Running ./ods-uninstall.sh --force ``` ╔══════════════════════════════════════════════════╗ ║         ODS UNINSTALLER                ║ ╚══════════════════════════════════════════════════╝  [INFO] Install directory: /home/XXXX/ods  [INFO] Stopping Docker containers... [INFO] Removing ODS containers... ods-model-router ods-llama-server [OK] Docker cleanup complete [INFO] Removing systemd user services... [INFO] Reaping any orphan host-managed processes... [sudo] password for XXXXX: YYYYYYYYY ````  The YYYYYY above would be the echoed password.  ### Steps to Reproduce  1. Run ./ods-uninstall.sh --force 2. If your account uses sudo, it'll echo your sudo password  ### Expected Behavior  No echo of sudo password  ### Actual Behavior  Sudo password shown  ### Operating System  Debian 13 (Trixie)  ### GPU  None  ### Docker Version  Docker 29.7.2  ### VRAM  0  ### Logs  ```shell  ```  ### Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report — I'm trying to narrow this down, and a few details from your run would help. These are just questions; I don't want to assume the cause.  1. Between the `Reaping any orphan host-managed processes...` line and the `[sudo] password` prompt appearing, was there a silent pause — and if so, roughly how long (a few seconds, ~20–30 seconds, longer)? 2. Did you start typing, or paste your password, before the `[sudo] password` prompt actually appeared on screen? 3. Were the characters you typed visible on screen as you typed them?  For context, the uninstaller wraps its first `sudo` call in `timeout` (`ods-uninstall.sh:289`), and there may be an interaction there worth checking — your answers would help confirm or rule that out. 
  > 1. I'm not sure tbh.  I'll need to run through it again.  Right now I'm just trying to get it to run... 2. No 3. Yes

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

### Incident Patch 1: `c5b5533e` (2026-10-06)
**Commit Message**: fix(cli): respect GPU_BACKEND when reporting GPU status (#7388)

* fix(cli): respect GPU_BACKEND when reporting GPU status

* fix(cli): tolerate unavailable GPU status probes

---------

Co-authored-by: Neo <[REDACTED_EMAIL]>
Co-authored-by: Mike Bradley <[REDACTED_EMAIL]>

**File**: `ods/CHANGELOG.md` (modified, +9/-0)
```diff
@@ -6,6 +6,15 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
 
 ## [Unreleased]
 
+### Fixed
+- `ods status` now respects `GPU_BACKEND`, using the existing AMD and Apple
+  GPU reporters instead of choosing NVIDIA tooling merely because it is
+  installed. AMD device counting in `ods gpu status` uses DRM sysfs, and
+  `ods status --json` no longer queries `nvidia-smi` for non-NVIDIA backends.
+  AMD JSON GPU summaries remain `null`.
+  Unavailable Apple GPU details and disappearing AMD device/sensor probes no
+  longer abort text status reporting.
+
 ### Security
 - Open WebUI no longer starts for other devices while its built-in
   administrator, `admin@localhost`, still has the password `admin`. Open WebUI
```

**File**: `ods/ods-cli` (modified, +21/-8)
```diff
@@ -1488,8 +1488,10 @@ cmd_status() {
 
     echo ""
 
-    # GPU status if available
-    if command -v nvidia-smi &> /dev/null; then
+    # Select GPU tooling by backend, not by installed vendor utilities.
+    if [[ "${GPU_BACKEND:-}" == "amd" || "${GPU_BACKEND:-}" == "apple" ]]; then
+        ( _gpu_status )
+    elif [[ "${GPU_BACKEND:-nvidia}" == "nvidia" ]] && command -v nvidia-smi &> /dev/null; then
         echo -e "${BLUE}━━━ GPU Status ━━━${NC}"
         nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits | \
             awk -F', ' '{printf "  %s: %s%% GPU | %sMB/%sMB VRAM | %s°C\n", $1, $2, $3, $4, $5}' \
@@ -1609,7 +1611,7 @@ cmd_status_json() {
             --argjson unified_memory_gb "$_total_mem_gb" \
             --argjson gpu_cores "$([[ "$_gpu_cores" =~ ^[0-9]+$ ]] && printf '%s' "$_gpu_cores" || printf 'null')" \
             '{backend: $backend, chip: $chip, unified_memory_gb: $unified_memory_gb, gpu_cores: $gpu_cores}')
-    elif command -v nvidia-smi >/dev/null 2>&1; then
+    elif [[ "${GPU_BACKEND:-nvidia}" == "nvidia" ]] && command -v nvidia-smi >/dev/null 2>&1; then
         # Represent each GPU line as raw strings in an array
         gpu_summary_json=$(nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu \
             --format=csv,noheader,nounits 2>/dev/null | jq -R -s 'split("\n") | map(select(length > 0))')
@@ -5465,8 +5467,18 @@ _gpu_status() {
         echo -e "${BLUE}━━━ GPU Status (1 integrated GPU) ━━━${NC}"
         echo ""
     else
-        local gpu_count
-        gpu_count=$(nvidia-smi --list-gpus 2>/dev/null | wc -l | tr -d ' ') || gpu_count=0
+        local gpu_count=0
+        if [[ "${GPU_BACKEND:-}" == "amd" ]]; then
+            local card_dir vendor
+            for card_dir in /sys/class/drm/card*/device; do
+                [[ -r "$card_dir/vendor" ]] || continue
+                # A device may disappear during enumeration; skip unreadable vendors.
+                vendor=$(cat "$card_dir/vendor" 2>/dev/null) || continue
+                [[ "$vendor" == "0x1002" ]] && gpu_count=$((gpu_count + 1))
+            done
+        elif [[ "${GPU_BACKEND:-nvidia}" == "nvidia" ]] && command -v nvidia-smi &>/dev/null; then
+            gpu_count=$(nvidia-smi --list-gpus 2>/dev/null | wc -l | tr -d ' ') || gpu_count=0
+        fi
         echo -e "${BLUE}━━━ GPU Status (${gpu_count} GPU$([ "$gpu_count" -ne 1 ] && echo s)) ━━━${NC}"
         echo ""
     fi
@@ -5555,7 +5567,7 @@ _gpu_status() {
         for card_dir in /sys/class/drm/card*/device; do
             [[ -f "$card_dir/vendor" ]] || continue
             local vendor
-            vendor=$(cat "$card_dir/vendor" 2>/dev/null)
+            vendor=$(cat "$card_dir/vendor" 2>/dev/null) || continue
             [[ "$vendor" == "0x1002" ]] || continue
             local name vram_total vram_used busy temp_c pw_w
             name=$(cat "$card_dir/product_name" 2>/dev/null || echo "AMD Radeon")
@@ -5571,7 +5583,7 @@ _gpu_status() {
                 for label_file in "$hwmon_dir"/temp*_label; do
                     [[ -f "$label_file" ]] || continue
                     local label_val
-                    label_val=$(cat "$label_file" 2>/dev/null)
+                    label_val=$(cat "$label_file" 2>/dev/null) || continue
                     if [[ "$label_val" == "junction" || "$label_val" == "edge" ]]; then
                         local input_file="${label_file/_label/_input}"
                         if [[ -f "$input_file" ]]; then
@@ -5666,7 +5678,8 @@ _gpu_status() {
         _total_mem_gb=$(( $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1024 / 1024 / 1024 ))
         if command -v jq >/dev/null 2>&1; then
             _gpu_cores=$(system_profiler SPDisplaysDataType -json 2>/dev/null \
-                | jq -r '.SPDisplaysDataType[0].sppci_cores // "?"' 2>/dev/null)
+                | jq -r '.SPDisplaysDataType[0].sppci_cores // "?"' 2>/dev/null) || _gpu_cores="?"
+            [[ -n "$_gpu_cores" ]] || _gpu_cores="?"
         else
             _gpu_cores="?"
         fi
```

**File**: `ods/tests/ci-suite.txt` (modified, +1/-0)
```diff
@@ -41,6 +41,7 @@ tests/test-cli-macos-native-llama.sh
 tests/test-cli-preset-restore-user-extensions.sh
 tests/test-cli-prompts-noninteractive.sh
 tests/test-cli-status-docker-error.sh
+tests/test-cli-status-gpu-backend.sh
 tests/test-cli-status-optional-webui.sh
 tests/test-cli-stt-env.py
 tests/test-cli-update-verification.sh
```

**File**: `ods/tests/test-cli-status-gpu-backend.sh` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+#!/usr/bin/env bash
+# Run the real CLI with vendor tools installed for every configured backend.
+set -euo pipefail
+
+ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
+CLI="$ROOT_DIR/ods-cli"
+FIXTURE=$(mktemp -d)
+trap 'rm -rf "$FIXTURE"' EXIT
+mkdir -p "$FIXTURE/install" "$FIXTURE/bin"
+: > "$FIXTURE/install/docker-compose.base.yml"
+export NVIDIA_CALLS="$FIXTURE/nvidia-calls"
+
+cat > "$FIXTURE/bin/nvidia-smi" <<'STUB'
+#!/usr/bin/env bash
+printf '%s\n' "$*" >> "$NVIDIA_CALLS"
+case "$*" in
+    --list-gpus) echo 'GPU 0: Test NVIDIA GPU' ;;
+    *query-gpu=index,name*) echo '0, Test NVIDIA GPU, 1024, 8192, 25, 50, 75' ;;
+    *) echo 'Test NVIDIA GPU, 25, 1024, 8192, 50' ;;
+esac
+STUB
+cat > "$FIXTURE/bin/docker" <<'STUB'
+#!/usr/bin/env bash
+exit 0
+STUB
+cat > "$FIXTURE/bin/curl" <<'STUB'
+#!/usr/bin/env bash
+exit 1
+STUB
+cat > "$FIXTURE/bin/sysctl" <<'STUB'
+#!/usr/bin/env bash
+case "$*" in
+    *hw.memsize*) echo 34359738368 ;;
+    *machdep.cpu.brand_string*) echo 'Apple Test Chip' ;;
+esac
+STUB
+cat > "$FIXTURE/bin/system_profiler" <<'STUB'
+#!/usr/bin/env bash
+[[ "${FAIL_APPLE_PROBE:-0}" == 0 ]] || exit 1
+echo '{"SPDisplaysDataType":[{"sppci_cores":"16"}]}'
+STUB
+chmod +x "$FIXTURE/bin/"*
+
+fail() { echo "[FAIL] $*" >&2; exit 1; }
+run_cli() {
+    INSTALL_DIR="$FIXTURE/install" PATH="$FIXTURE/bin:$PATH" bash "$CLI" "$@"
+}
+
+for backend in amd apple cpu intel arc; do
+    printf 'GPU_BACKEND=%s\n' "$backend" > "$FIXTURE/install/.env"
+    : > "$NVIDIA_CALLS"
+    output=$(run_cli status)
+    if [[ "$backend" == amd ]]; then
+        [[ "$output" == *'VRAM Used/Total'* ]] || fail 'AMD status did not show its GPU report'
+    elif [[ "$backend" == apple ]]; then
+        [[ "$output" == *'Apple Test Chip'* ]] || fail 'Apple status did not show its GPU report'
+    fi
+    summary=$(run_cli status --json)
+    if [[ "$backend" == apple ]]; then
+        jq -e '.gpu.backend == "apple" and .gpu.unified_memory_gb == 32' <<< "$summary" >/dev/null
+    else
+        jq -e '.gpu == null' <<< "$summary" >/dev/null
+    fi
+    if [[ "$backend" == amd || "$backend" == apple ]]; then
+        run_cli gpu status > "$FIXTURE/gpu-status"
+    fi
+    [[ ! -s "$NVIDIA_CALLS" ]] || fail "$backend invoked nvidia-smi: $(cat "$NVIDIA_CALLS")"
+    echo "[PASS] $backend status avoids NVIDIA tooling"
+done
+
+printf 'GPU_BACKEND=apple\n' > "$FIXTURE/install/.env"
+: > "$NVIDIA_CALLS"
+output=$(FAIL_APPLE_PROBE=1 run_cli status)
+[[ "$output" == *'Apple Test Chip'* && "$output" == *'GPU cores:        ?'* ]] \
+    || fail 'Apple status did not degrade gracefully when its GPU probe failed'
+[[ ! -s "$NVIDIA_CALLS" ]] || fail 'Apple probe failure invoked NVIDIA tooling'
+echo '[PASS] Apple status survives an unavailable GPU probe'
+
+# Exercise the production AMD reporter with a private DRM tree. Intercept
+# reads after the existence checks to model a disappearing device or sensor.
+mkdir -p "$FIXTURE/drm/card0/device/hwmon/hwmon0" "$FIXTURE/drm/card1/device"
+printf '0x1002\n' > "$FIXTURE/drm/card0/device/vendor"
+printf '0x8086\n' > "$FIXTURE/drm/card1/device/vendor"
+printf 'Test AMD GPU\n' > "$FIXTURE/drm/card0/device/product_name"
+printf '8589934592\n' > "$FIXTURE/drm/card0/device/mem_info_vram_total"
+printf '1073741824\n' > "$FIXTURE/drm/card0/device/mem_info_vram_used"
+printf '25\n' > "$FIXTURE/drm/card0/device/gpu_busy_percent"
+printf 'junction\n' > "$FIXTURE/drm/card0/device/hwmon/hwmon0/temp1_label"
+printf '45000\n' > "$FIXTURE/drm/card0/device/hwmon/hwmon0/temp1_input"
+sed -n '/^_gpu_status() {/,/^}/p' "$CLI" \
+    | sed "s|/sys/class/drm|$FIXTURE/drm|g" > "$FIXTURE/amd-reporter.sh"
+for probe in normal vendor sensor; do
+    rm -f "$FIXTURE/vendor-read"
+    (
+        set -euo pipefail
+        BLUE='' NC='' GPU_BACKEND=amd
+        check_install() { :; }
+        load_env() { :; }
+        cat() {
+            if [[ "$probe" == vendor && "$1" == "$FIXTURE/drm/card0/device/vendor" ]]; then
+                [[ ! -e "$FIXTURE/vendor-read" ]] || return 1
+                : > "$FIXTURE/vendor-read"
+            elif [[ "$probe" == sensor && "$1" == */temp1_label ]]; then
+                return 1
+            fi
+            command cat "$@"
+        }
+        source "$FIXTURE/amd-reporter.sh"
+        _gpu_status
+    ) > "$FIXTURE/amd-output"
+    grep -q 'GPU Status (1 GPU)' "$FIXTURE/amd-output" || fail 'AMD count included a non-AMD device'
+    if [[ "$probe" != vendor ]]; then
+        grep -q 'Test AMD GPU.*1.0 / 8.0 GB' "$FIXTURE/amd-output" || fail 'AMD metrics were lost'
+    fi
+    echo "[PASS] AMD reporting tolerates $probe probe state"
+done
+
+printf 'GPU_BACKEND=nvidia\n' > "$FIXTURE/install/.env"
+output=$(run_cli status)
+[[ "$output" == *'Test NVIDIA GPU: 25% GPU | 1024MB/8192MB VRAM | 50°C'* ]] \
+    || fail 'NVIDIA status did not format GPU metrics correctly'
+output=$(run_cli gpu status)
+[[ "$output" == *'GPU Status (1 GPU)'* && "$outp
```

---

### Incident Patch 2: `132d36a1` (2026-10-06)
**Commit Message**: Merge pull request #7389 from Osmantic/fix/preview-static-form-intent

Fix false show/hide requirements for static form content

**File**: `ods/extensions/services/pixel-agent/plugin/preview-interaction-assurance.mjs` (modified, +8/-1)
```diff
@@ -26,7 +26,14 @@ export function requestsVisibilityInteraction(text) {
       /\b(?:button|toggle|link|tab|switch)\s*,?\s*(?:(?:named|called|labelled|labeled)\s*)?$/i.test(clause.slice(0, offset)) ||
       /^\s*,?\s*(?:button|toggle|link|tab|switch)\b/i.test(clause.slice(offset + name.length)) ? ' ' : name)
       .replace(/\b(?:its|their|the|this|that|a|an|my|your|our)\s+(?:show|hide|reveal|expand|collapse)(?:[ \t]+[\p{L}\p{N}_-]+){0,4}[ \t]+(?:button|toggle|link|tab|switch)(?=[ \t]+(?:starts?|begins?|defaults?)\b)/giu, ' control ') : clause;
-    return /\b(?:shows?|hides?|hidden|reveals?|expands?|collapses?|visible|visibility)\b/i.test(bare);
+    if (/\b(?:hides?|hidden|reveals?|expands?|collapses?|visibility)\b/i.test(bare)) return true;
+    // Static page contents can be shown or visible beside a form control.
+    // Bind those ambiguous words to the control's action or show-control name.
+    return /\bclick(?:s|ed|ing)?\b[^.!?;\n]{0,100}\bshows?\b/i.test(bare) ||
+      /\b(?:buttons?|toggles?)\b(?:(?!\band\b)[^,.!?;\n]){0,80}\bshows?\b/i.test(bare) ||
+      /\bshows?\b[^,.!?;\n]{0,80}\b(?:with|using|via|when|after|on)\b[^.!?;\n]{0,40}\b(?:buttons?|toggles?|click(?:s|ed|ing)?)\b/i.test(bare) ||
+      /\bshow(?:[ \t]+(?!and\b)[\p{L}\p{N}_-]+){0,4}["”»’']?[ \t]+(?:buttons?|toggles?)\b/iu.test(bare) ||
+      /\b(?:makes?|becomes?|turns?)\b[^.!?;\n]{0,40}\b(?:in)?visible\b/i.test(bare);
   });
 }
 
```

**File**: `ods/extensions/services/pixel-agent/tests/preview_interaction_assurance.test.mjs` (modified, +19/-0)
```diff
@@ -176,6 +176,25 @@ test('visibility gate only requests checks supported by the installed capability
   }
 });
 
+test('static page contents beside form controls do not request show/hide inspection',()=>{
+  const prompt='Create a tiny reading-list webpage in a new Playground/fleet-reading-list folder. It should show the title Fleet Reading List, a text box for a book title, and an Add book button that adds the title to the visible list. Save it as index.html, publish a workspace preview, and give me the preview link. Keep everything local; no external services.';
+  for (const text of [prompt,
+    'Show a heading and a Submit button.',
+    'Add a visible list and a button that appends a book.',
+    'Show the title, a contact form, and a Submit button.',
+    'Add a Submit button and show the page title.',
+  ]) assert.equal(requestsVisibilityInteraction(text), false, text);
+  const {guard}=setup({prompt});
+  assert.equal(guard.verificationForRun('run').status,'passed');
+  assert.doesNotMatch(guard.verificationForRun('run').text,/show\/hide interaction/);
+  for (const text of [
+    'Show a title and a contact form with a button that reveals hidden help.',
+    'Add a book button and a button that shows the details.',
+    'A click makes the details visible.',
+    'Show the details when the button is clicked.',
+  ]) assert.equal(requestsVisibilityInteraction(text), true, text);
+});
+
 test('initial control-state corrections do not imply a new visibility transition',()=>{
   for (const text of [
     'First, wireframe is off initially, but its Show wireframe button starts with aria-pressed=true; initialise it to match the actual state.',
```

---

### Incident Patch 3: `8c253e20` (2026-10-06)
**Commit Message**: fix(pixel): distinguish static form content from visibility actions

**File**: `ods/extensions/services/pixel-agent/plugin/preview-interaction-assurance.mjs` (modified, +8/-1)
```diff
@@ -26,7 +26,14 @@ export function requestsVisibilityInteraction(text) {
       /\b(?:button|toggle|link|tab|switch)\s*,?\s*(?:(?:named|called|labelled|labeled)\s*)?$/i.test(clause.slice(0, offset)) ||
       /^\s*,?\s*(?:button|toggle|link|tab|switch)\b/i.test(clause.slice(offset + name.length)) ? ' ' : name)
       .replace(/\b(?:its|their|the|this|that|a|an|my|your|our)\s+(?:show|hide|reveal|expand|collapse)(?:[ \t]+[\p{L}\p{N}_-]+){0,4}[ \t]+(?:button|toggle|link|tab|switch)(?=[ \t]+(?:starts?|begins?|defaults?)\b)/giu, ' control ') : clause;
-    return /\b(?:shows?|hides?|hidden|reveals?|expands?|collapses?|visible|visibility)\b/i.test(bare);
+    if (/\b(?:hides?|hidden|reveals?|expands?|collapses?|visibility)\b/i.test(bare)) return true;
+    // Static page contents can be shown or visible beside a form control.
+    // Bind those ambiguous words to the control's action or show-control name.
+    return /\bclick(?:s|ed|ing)?\b[^.!?;\n]{0,100}\bshows?\b/i.test(bare) ||
+      /\b(?:buttons?|toggles?)\b(?:(?!\band\b)[^,.!?;\n]){0,80}\bshows?\b/i.test(bare) ||
+      /\bshows?\b[^,.!?;\n]{0,80}\b(?:with|using|via|when|after|on)\b[^.!?;\n]{0,40}\b(?:buttons?|toggles?|click(?:s|ed|ing)?)\b/i.test(bare) ||
+      /\bshow(?:[ \t]+(?!and\b)[\p{L}\p{N}_-]+){0,4}["”»’']?[ \t]+(?:buttons?|toggles?)\b/iu.test(bare) ||
+      /\b(?:makes?|becomes?|turns?)\b[^.!?;\n]{0,40}\b(?:in)?visible\b/i.test(bare);
   });
 }
 
```

**File**: `ods/extensions/services/pixel-agent/tests/preview_interaction_assurance.test.mjs` (modified, +19/-0)
```diff
@@ -176,6 +176,25 @@ test('visibility gate only requests checks supported by the installed capability
   }
 });
 
+test('static page contents beside form controls do not request show/hide inspection',()=>{
+  const prompt='Create a tiny reading-list webpage in a new Playground/fleet-reading-list folder. It should show the title Fleet Reading List, a text box for a book title, and an Add book button that adds the title to the visible list. Save it as index.html, publish a workspace preview, and give me the preview link. Keep everything local; no external services.';
+  for (const text of [prompt,
+    'Show a heading and a Submit button.',
+    'Add a visible list and a button that appends a book.',
+    'Show the title, a contact form, and a Submit button.',
+    'Add a Submit button and show the page title.',
+  ]) assert.equal(requestsVisibilityInteraction(text), false, text);
+  const {guard}=setup({prompt});
+  assert.equal(guard.verificationForRun('run').status,'passed');
+  assert.doesNotMatch(guard.verificationForRun('run').text,/show\/hide interaction/);
+  for (const text of [
+    'Show a title and a contact form with a button that reveals hidden help.',
+    'Add a book button and a button that shows the details.',
+    'A click makes the details visible.',
+    'Show the details when the button is clicked.',
+  ]) assert.equal(requestsVisibilityInteraction(text), true, text);
+});
+
 test('initial control-state corrections do not imply a new visibility transition',()=>{
   for (const text of [
     'First, wireframe is off initially, but its Show wireframe button starts with aria-pressed=true; initialise it to match the actual state.',
```

---

### Incident Patch 4: `60299fe3` (2026-10-06)
**Commit Message**: fix(installer): recover interrupted Windows WSL first installs (#7375)

* fix(installer): recover interrupted Windows WSL first installs

* fix(installer): bind bootstrap resume to the requested Pixel source

* fix(pixel): preserve the Docker engine selected by the installer

* fix(installer): explain retained Pixel sandbox conflicts after WSL recreation

* fix(uninstall): scope cross-project checks to listed installation paths

* test(uninstall): model formatted Docker path listings in shell fixture

* fix(installer): guide retained Pixel sandbox recovery and report WSL memory

* test(installer): verify delegated WSL memory policy in model selection

* chore(ci): record exact synthetic relay hash scan fingerprint

**File**: `.github/workflows/lint-powershell.yml` (modified, +14/-0)
```diff
@@ -89,11 +89,25 @@ jobs:
         shell: pwsh
         run: ./tests/contracts/test-windows-portal-prereqs.ps1
 
+      - name: Public Windows bootstrap (PowerShell 7)
+        shell: pwsh
+        run: ./tests/contracts/test-windows-readme-bootstrap.ps1
+
+      - name: Public Windows bootstrap (Windows PowerShell)
+        if: runner.os == 'Windows'
+        shell: powershell
+        run: ./tests/contracts/test-windows-readme-bootstrap.ps1
+
       - name: Windows Portal Prerequisite Contracts (Windows PowerShell)
         if: runner.os == 'Windows'
         shell: powershell
         run: ./tests/contracts/test-windows-portal-prereqs.ps1
 
+      - name: Fresh Ubuntu account configuration without Python
+        if: runner.os == 'Linux'
+        shell: bash
+        run: bash tests/test-wsl-first-account.sh
+
       - name: Windows Portal AMD Contracts (PowerShell 7)
         shell: pwsh
         run: ./tests/contracts/test-windows-portal-amd.ps1
```

**File**: `.github/workflows/test-linux.yml` (modified, +3/-1)
```diff
@@ -289,7 +289,7 @@ jobs:
         run: python3 -m unittest discover -s tests -p 'test_pixel_*.py' -v
 
       - name: Pixel Inspection Upgrade Cleanup Contracts
-        run: python3 -m pytest -q tests/test_pixel_inspection_upgrade_dispatch.py tests/test_preview_inspection_distribution.py tests/test_preview_select.py
+        run: python3 -m pytest -q tests/test_pixel_inspection_upgrade_dispatch.py tests/test_preview_inspection_distribution.py tests/test_preview_select.py tests/test_pixel_verify_lifecycle.py
 
       - name: Pixel Native Integration Contracts
         run: python3 -m pytest -q tests/test_pixel_macos_apps.py tests/test_pixel_native_compose_live.py tests/test_pixel_onboarding.py tests/test_pixel_open_app_handler.py tests/test_pixel_runtime_budget.py
@@ -542,6 +542,8 @@ jobs:
           python3 tests/test-configure-wsl-model-store.py
           python3 tests/test-retire-wsl-runtime.py
           bash tests/test-native-llm-flags.sh
+          bash tests/test-wsl-memory-reporting.sh
+          bash tests/test-recover-retired-pixel-sandbox.sh
 
       - name: Pixel Public Source and Local Bundle Contract
         run: |
```

**File**: `.gitleaksignore` (modified, +4/-0)
```diff
@@ -4,6 +4,10 @@
 #
 # Example: abc123def456...
 
+# Synthetic relay error-redaction hash: a hexadecimal sequence repeated four times.
+# The repository-wide history scan includes this test fixture from another branch.
+304b9550dd8068d26189384051c8d0b1e05576ce:ods/extensions/services/pixel-model-relay/tests/test_relay.py:generic-api-key:77
+
 # Test fixtures in privacy-shield PII scrubber tests (not real secrets)
 bc47367431025198fcbea19a54abcde8c30847fd:ods/extensions/services/privacy-shield/tests/test_pii_scrubber.py:generic-api-key:125
 bc47367431025198fcbea19a54abcde8c30847fd:ods/extensions/services/privacy-shield/tests/test_pii_scrubber.py:generic-api-key:131
```

**File**: `README.md` (modified, +13/-9)
```diff
@@ -69,15 +69,19 @@ curl -fsSL https://install.osmantic.com/ods.sh | bash
 **Windows PowerShell** — guided Ubuntu/WSL2 setup with Pixel/Portal
 
 ```powershell
-$ProgressPreference = "SilentlyContinue"
-$odsSrc = Join-Path $env:TEMP ("ods-install-" + [guid]::NewGuid().ToString("N"))
-$odsZip = Join-Path $odsSrc "ods-main.zip"
-New-Item -ItemType Directory -Path $odsSrc | Out-Null
-Invoke-WebRequest "https://github.com/Osmantic/ODS/archive/refs/heads/main.zip" -OutFile $odsZip
-Expand-Archive -LiteralPath $odsZip -DestinationPath $odsSrc -Force
-cd (Get-ChildItem -LiteralPath $odsSrc -Directory | Select-Object -First 1).FullName
-Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
-.\install.ps1
+& {
+    $ErrorActionPreference = 'Stop'
+    $ProgressPreference = 'SilentlyContinue'
+    $odsSrc = Join-Path $env:TEMP ('ods-install-' + [guid]::NewGuid().ToString('N'))
+    $odsZip = Join-Path $odsSrc 'ods-main.zip'
+    New-Item -ItemType Directory -Path $odsSrc | Out-Null
+    Invoke-WebRequest -UseBasicParsing 'https://github.com/Osmantic/ODS/archive/refs/heads/main.zip' -OutFile $odsZip
+    Expand-Archive -LiteralPath $odsZip -DestinationPath $odsSrc
+    $odsEntry = Join-Path $odsSrc 'ODS-main\install.ps1'
+    if (-not (Test-Path -LiteralPath $odsEntry -PathType Leaf)) { throw 'The downloaded archive does not contain the ODS installer.' }
+    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
+    & $odsEntry
+}
 ```
 
 Linux and macOS: Docker must be installed and running.
```

**File**: `ods/QUICKSTART.md` (modified, +13/-9)
```diff
@@ -66,15 +66,19 @@ is the same folder as the default install directory `~/ods`.
 ### Windows
 
 ```powershell
-$ProgressPreference = "SilentlyContinue"
-$odsSrc = Join-Path $env:TEMP ("ods-install-" + [guid]::NewGuid().ToString("N"))
-$odsZip = Join-Path $odsSrc "ods-main.zip"
-New-Item -ItemType Directory -Path $odsSrc | Out-Null
-Invoke-WebRequest "https://github.com/Osmantic/ODS/archive/refs/heads/main.zip" -OutFile $odsZip
-Expand-Archive -LiteralPath $odsZip -DestinationPath $odsSrc -Force
-cd (Get-ChildItem -LiteralPath $odsSrc -Directory | Select-Object -First 1).FullName
-Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
-.\install.ps1
+& {
+    $ErrorActionPreference = 'Stop'
+    $ProgressPreference = 'SilentlyContinue'
+    $odsSrc = Join-Path $env:TEMP ('ods-install-' + [guid]::NewGuid().ToString('N'))
+    $odsZip = Join-Path $odsSrc 'ods-main.zip'
+    New-Item -ItemType Directory -Path $odsSrc | Out-Null
+    Invoke-WebRequest -UseBasicParsing 'https://github.com/Osmantic/ODS/archive/refs/heads/main.zip' -OutFile $odsZip
+    Expand-Archive -LiteralPath $odsZip -DestinationPath $odsSrc
+    $odsEntry = Join-Path $odsSrc 'ODS-main\install.ps1'
+    if (-not (Test-Path -LiteralPath $odsEntry -PathType Leaf)) { throw 'The downloaded archive does not contain the ODS installer.' }
+    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
+    & $odsEntry
+}
 ```
 
 The Windows command guides Ubuntu/WSL2 preparation and requires Pixel, with no Hermes fallback. It installs missing WSL, Docker Desktop and Ubuntu after asking, continues by itself after the one restart, and opens Portal when done. See [Windows Quickstart](docs/WINDOWS-QUICKSTART.md).
```

**File**: `ods/README.md` (modified, +13/-9)
```diff
@@ -125,15 +125,19 @@ llama-server runs natively with Metal GPU acceleration; all other services run i
 > **Prerequisite:** Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) with WSL2 backend and make sure it is running before you start.
 
 ```powershell
-$ProgressPreference = "SilentlyContinue"
-$odsSrc = Join-Path $env:TEMP ("ods-install-" + [guid]::NewGuid().ToString("N"))
-$odsZip = Join-Path $odsSrc "ods-main.zip"
-New-Item -ItemType Directory -Path $odsSrc | Out-Null
-Invoke-WebRequest "https://github.com/Osmantic/ODS/archive/refs/heads/main.zip" -OutFile $odsZip
-Expand-Archive -LiteralPath $odsZip -DestinationPath $odsSrc -Force
-cd (Get-ChildItem -LiteralPath $odsSrc -Directory | Select-Object -First 1).FullName
-Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
-.\install.ps1
+& {
+    $ErrorActionPreference = 'Stop'
+    $ProgressPreference = 'SilentlyContinue'
+    $odsSrc = Join-Path $env:TEMP ('ods-install-' + [guid]::NewGuid().ToString('N'))
+    $odsZip = Join-Path $odsSrc 'ods-main.zip'
+    New-Item -ItemType Directory -Path $odsSrc | Out-Null
+    Invoke-WebRequest -UseBasicParsing 'https://github.com/Osmantic/ODS/archive/refs/heads/main.zip' -OutFile $odsZip
+    Expand-Archive -LiteralPath $odsZip -DestinationPath $odsSrc
+    $odsEntry = Join-Path $odsSrc 'ODS-main\install.ps1'
+    if (-not (Test-Path -LiteralPath $odsEntry -PathType Leaf)) { throw 'The downloaded archive does not contain the ODS installer.' }
+    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
+    & $odsEntry
+}
 ```
 
 The Windows entry point guides Ubuntu/WSL2 preparation and requires Pixel with
```

**File**: `ods/docs/FAQ.md` (modified, +13/-9)
```diff
@@ -124,15 +124,19 @@ audited commit manually.
 Windows:
 
 ```powershell
-$ProgressPreference = "SilentlyContinue"
-$odsSrc = Join-Path $env:TEMP ("ods-install-" + [guid]::NewGuid().ToString("N"))
-$odsZip = Join-Path $odsSrc "ods-main.zip"
-New-Item -ItemType Directory -Path $odsSrc | Out-Null
-Invoke-WebRequest "https://github.com/Osmantic/ODS/archive/refs/heads/main.zip" -OutFile $odsZip
-Expand-Archive -LiteralPath $odsZip -DestinationPath $odsSrc -Force
-cd (Get-ChildItem -LiteralPath $odsSrc -Directory | Select-Object -First 1).FullName
-Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
-.\install.ps1
+& {
+    $ErrorActionPreference = 'Stop'
+    $ProgressPreference = 'SilentlyContinue'
+    $odsSrc = Join-Path $env:TEMP ('ods-install-' + [guid]::NewGuid().ToString('N'))
+    $odsZip = Join-Path $odsSrc 'ods-main.zip'
+    New-Item -ItemType Directory -Path $odsSrc | Out-Null
+    Invoke-WebRequest -UseBasicParsing 'https://github.com/Osmantic/ODS/archive/refs/heads/main.zip' -OutFile $odsZip
+    Expand-Archive -LiteralPath $odsZip -DestinationPath $odsSrc
+    $odsEntry = Join-Path $odsSrc 'ODS-main\install.ps1'
+    if (-not (Test-Path -LiteralPath $odsEntry -PathType Leaf)) { throw 'The downloaded archive does not contain the ODS installer.' }
+    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
+    & $odsEntry
+}
 ```
 
 Do not run the `curl ... | bash` installer from Windows PowerShell. The Windows entry point guides Ubuntu/WSL2 preparation and requires Pixel with Hermes disabled. It installs missing WSL, Docker Desktop and Ubuntu after asking, continues by itself after the one restart, and opens Portal when done; see [Windows Quickstart](WINDOWS-QUICKSTART.md).
```

**File**: `ods/docs/WINDOWS-QUICKSTART.md` (modified, +56/-9)
```diff
@@ -13,15 +13,19 @@ support an elevated UAC-disabled session; it requests elevation separately for
 Windows prerequisites.
 
 ```powershell
-$ProgressPreference = "SilentlyContinue"
-$odsSrc = Join-Path $env:TEMP ("ods-install-" + [guid]::NewGuid().ToString("N"))
-$odsZip = Join-Path $odsSrc "ods-main.zip"
-New-Item -ItemType Directory -Path $odsSrc | Out-Null
-Invoke-WebRequest "https://github.com/Osmantic/ODS/archive/refs/heads/main.zip" -OutFile $odsZip
-Expand-Archive -LiteralPath $odsZip -DestinationPath $odsSrc -Force
-cd (Get-ChildItem -LiteralPath $odsSrc -Directory | Select-Object -First 1).FullName
-Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
-.\install.ps1
+& {
+    $ErrorActionPreference = 'Stop'
+    $ProgressPreference = 'SilentlyContinue'
+    $odsSrc = Join-Path $env:TEMP ('ods-install-' + [guid]::NewGuid().ToString('N'))
+    $odsZip = Join-Path $odsSrc 'ods-main.zip'
+    New-Item -ItemType Directory -Path $odsSrc | Out-Null
+    Invoke-WebRequest -UseBasicParsing 'https://github.com/Osmantic/ODS/archive/refs/heads/main.zip' -OutFile $odsZip
+    Expand-Archive -LiteralPath $odsZip -DestinationPath $odsSrc
+    $odsEntry = Join-Path $odsSrc 'ODS-main\install.ps1'
+    if (-not (Test-Path -LiteralPath $odsEntry -PathType Leaf)) { throw 'The downloaded archive does not contain the ODS installer.' }
+    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
+    & $odsEntry
+}
 ```
 
 Pixel uses source bundled in public Osmantic/ODS, not a private repository.
@@ -231,6 +235,49 @@ cd $env:USERPROFILE\ods
 .\ods.ps1 uninstall --force
 ```
 
+## Retained Pixel sandbox after recreating Ubuntu
+
+Removing an Ubuntu distribution does not remove images from Docker Desktop.
+If Pixel reports `Shared live sandbox tag exists without an active Pixel release`,
+the shared `openclaw-sandbox:bookworm-slim` tag can still belong to the previous
+installation. For example, its sandbox can be built for UID 1000 while the new
+Ubuntu account is UID 1001. A matching Pixel version alone is insufficient.
+This is separate from the `unsafe-inspection-docker` executable-permissions error.
+
+In the new Ubuntu terminal, run this recovery helper from your installation
+folder (replace `~/ods` if you chose another folder):
+
+```bash
+bash ~/ods/scripts/recover-retired-pixel-sandbox.sh
+```
+
+The helper shows the Docker engine, exact image, Pixel version, old UID and
+current UID, then checks all containers using that image, including stopped
+containers. It refuses an active local Pixel release, invalid image labels,
+Docker failures, consumers, or changed identities. Run it as your Ubuntu
+account, without `sudo`.
+
+No listed containers does not prove that another WSL installation has stopped
+using this shared tag. Check those installations too. Type `RETIRED` only after
+you have confirmed that **all old installations using the tag are retired** and
+that no Docker/Pixel installation or recovery runs in parallel. Pressing Enter
+or providing no input stops without changing any tags. If another installation
+still uses the tag, retain it and use a separate Docker engine for the new
+deployment, or retire the old deployment through its own uninstall.
+
+After confirmation, the helper preserves the old image under
+`pixel-sandbox-retained:sha256-<complete-image-id>`, rechecks the engine, image,
+retention tag and consumers, and removes **only the old shared tag**. Docker
+has no atomic compare-and-remove operation for shared tags, so other
+installation work must remain stopped until the helper exits. It does not
+remove the image by ID, prune images/volumes, reset Docker Desktop, or retag
+Pixel's new candidate.
+
+When the helper reports success, rerun the same ODS installation command.
+Pixel validates and activates the new account's candidate itself. If recovery
+stops, read its reason and inspect the current state; do not retry with force
+or edit UID labels.
+
 ## Uninstall WSL ODS
 
 Inside Ubuntu, use your chosen runtime directory:
```

---

### Incident Patch 5: `ff390d56` (2026-10-05)
**Commit Message**: Merge pull request #7347 from roshangupta00750/fix/root-build-context-dockerignore

fix(compose): keep root-context builds from reading the whole install

**File**: `ods/.dockerignore` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+# Three images build with the install root as their context
+# (remote-provider-egress and remote-provider-ssh-tunnel in
+# docker-compose.base.yml, and the opt-in pixel-inference overlay). Send only
+# the paths their Dockerfiles copy. BuildKit reads pixel-inference's own
+# Dockerfile.dockerignore instead; the classic builder reads only this file.
+#
+# Without this, the classic builder (what Compose uses when the buildx plugin
+# is missing, as on Arch-family distros without the docker-buildx package)
+# reads the whole install, including data/ directories owned by container
+# users, and fails with "can't stat". BuildKit also stops scanning data/.
+*
+!extensions/services/remote-provider-egress/requirements.lock
+!extensions/services/remote-provider-egress/app
+!extensions/services/remote-provider-ssh-tunnel/app
+!bin/remote_provider
+!extensions/services/pixel-inference/requirements.lock
+!extensions/services/pixel-inference/app
+!bin/pixel_provider
+**/__pycache__
```

**File**: `ods/installers/lib/source-copy.sh` (modified, +5/-0)
```diff
@@ -59,5 +59,10 @@ ods_copy_install_source() {
         # preservation. A rerun cannot safely use an unfiltered recursive cp.
         cp -r "$source_dir"/* "$install_dir/" 2>>"$log_file" || return 1
         cp "$source_dir/.gitignore" "$install_dir/" 2>>"$log_file" || return 1
+        # Root-context image builds read it (see .dockerignore). Sources from
+        # before it existed copy as they did.
+        if [[ -f "$source_dir/.dockerignore" ]]; then
+            cp "$source_dir/.dockerignore" "$install_dir/" 2>>"$log_file" || return 1
+        fi
     fi
 }
```

**File**: `ods/tests/ci-suite.txt` (modified, +1/-0)
```diff
@@ -173,6 +173,7 @@ tests/test-restore-data-transaction-contract.sh
 tests/test-restore-empty-config.sh
 tests/test-restore-safety-ux.sh
 tests/test-rollback-compose-stack.sh
+tests/test-root-build-context.sh
 tests/test-rootless-docker-ownership.sh
 tests/test-router-transport.py
 tests/test-service-registry-cache.sh
```

**File**: `ods/tests/test-phase06-cloud-config-preservation.sh` (modified, +3/-1)
```diff
@@ -15,7 +15,7 @@ src="$tmp/src"
 mkdir -p "$src/config/litellm"
 printf 'bundled-template\n' > "$src/config/litellm/cloud.yaml"
 printf 'source-canary\n' > "$src/canary"
-touch "$src/.gitignore"
+touch "$src/.gitignore" "$src/.dockerignore"
 setup() { inst="$tmp/$1"; mkdir -p "$inst/config/litellm"; }
 copy() { ods_copy_install_source "$src" "$inst" "$tmp/log"; }
 setup fresh
@@ -60,6 +60,8 @@ setup fresh-fallback
 copy
 cmp "$src/config/litellm/cloud.yaml" "$inst/config/litellm/cloud.yaml" || fail 'fresh fallback template absent'
 pass 'fresh fallback copies the template'
+[[ -f "$inst/.dockerignore" ]] || fail 'fresh fallback dropped the root .dockerignore'
+pass 'fresh fallback copies the root .dockerignore'
 unset -f command
 
 # Exercise the actual Phase 06 normalization after a copy from a checkout
```

**File**: `ods/tests/test-root-build-context.sh` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+#!/usr/bin/env bash
+# Builds whose context is the install root must not read the whole install.
+# The classic builder (used when the buildx plugin is missing) stats every file
+# in the context and fails on data/ directories owned by container users. The
+# root .dockerignore must exclude everything except the paths these Dockerfiles
+# copy.
+set -euo pipefail
+
+SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
+DOCKERFILES=(
+    extensions/services/pixel-inference/Dockerfile
+    extensions/services/remote-provider-egress/Dockerfile
+    extensions/services/remote-provider-ssh-tunnel/Dockerfile
+)
+# Every shipped Compose file is read with the install root as its project
+# directory, so `context: .` in any of them (enabled or .disabled) is the
+# install root. Library extensions are not listed: the resolver rewrites
+# their `context: .` to the extension's own directory.
+# A file that names another Compose project runs on its own, with contexts
+# relative to its own directory (the Windows standalone ComfyUI).
+COMPOSE_FILES=()
+shopt -s nullglob
+for compose_file in "$ROOT_DIR"/docker-compose*.yml "$ROOT_DIR"/extensions/services/*/compose*.yaml*; do
+    project="$(awk '/^name:/ { print $2; exit }' "$compose_file")"
+    [[ -z "$project" || "$project" == ods ]] && COMPOSE_FILES+=("$compose_file")
+done
+shopt -u nullglob
+
+PASSED=0
+FAILED=0
+pass() { echo "[PASS] $1"; PASSED=$((PASSED + 1)); }
+fail() { echo "[FAIL] $1"; FAILED=$((FAILED + 1)); }
+
+# Every Dockerfile built from the install root must be listed above.
+root_context_dockerfiles="$(awk '
+    FNR == 1 { root = 0 }
+    /^[[:space:]]+context:[[:space:]]*\.[[:space:]]*$/ { root = 1; next }
+    root && /^[[:space:]]+dockerfile:/ { print $2; root = 0; next }
+    /^[[:space:]]+[a-z_]+:/ { root = 0 }
+' "${COMPOSE_FILES[@]}" | sort -u)"
+expected="$(printf '%s\n' "${DOCKERFILES[@]}" | sort)"
+if [[ "$root_context_dockerfiles" == "$expected" ]]; then
+    pass "the root-context builds are the ones this test covers"
+else
+    fail "root-context builds changed; update DOCKERFILES and .dockerignore: $(printf '%s ' $root_context_dockerfiles)"
+fi
+
+sources=()
+for dockerfile in "${DOCKERFILES[@]}"; do
+    while IFS= read -r src; do
+        sources+=("$src")
+    done < <(awk '$1 == "COPY" && $2 !~ /^--from/ { print $2 }' "$ROOT_DIR/$dockerfile")
+done
+
+if grep -qx '\*' "$ROOT_DIR/.dockerignore"; then
+    pass ".dockerignore excludes everything by default"
+else
+    fail ".dockerignore must start from '*' so data/ is never sent"
+fi
+for src in "${sources[@]}"; do
+    if grep -qxF "!$src" "$ROOT_DIR/.dockerignore"; then
+        pass ".dockerignore admits $src"
+    else
+        fail ".dockerignore does not admit $src, which a root-context Dockerfile copies"
+    fi
+done
+
+# Behavioural: the classic builder against an install-shaped context with an
+# unreadable data/ directory. A FROM scratch Dockerfile with the same COPY
+# lines checks the context without pulling or running anything.
+if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
+    echo "[SKIP] Docker unavailable; classic-builder check skipped"
+else
+    TMP_DIR="$(mktemp -d)"
+    trap 'chmod -R u+rwx "$TMP_DIR"; rm -rf "$TMP_DIR"' EXIT
+    cp "$ROOT_DIR/.dockerignore" "$TMP_DIR/"
+    for src in "${sources[@]}"; do
+        mkdir -p "$TMP_DIR/$(dirname "$src")"
+        cp -R "$ROOT_DIR/$src" "$TMP_DIR/$src"
+    done
+    mkdir -p "$TMP_DIR/data/container-owned" "$TMP_DIR/data/models"
+    echo private > "$TMP_DIR/data/container-owned/state"
+    chmod 000 "$TMP_DIR/data/container-owned"
+    head -c 1048576 /dev/zero > "$TMP_DIR/data/models/model.gguf"
+    for dockerfile in "${DOCKERFILES[@]}"; do
+        probe="$TMP_DIR/probe.Dockerfile"
+        { echo "FROM scratch"; awk '$1 == "COPY" && $2 !~ /^--from/' "$ROOT_DIR/$dockerfile"; } > "$probe"
+        if out="$(DOCKER_BUILDKIT=0 docker build -q -f "$probe" "$TMP_DIR" 2>&1)"; then
+            pass "classic builder builds $dockerfile's context with unreadable data/"
+            docker image rm -f "${out##*$'\n'}" >/dev/null 2>&1 || echo "[WARN] could not remove probe image"
+        else
+            fail "classic builder failed for $dockerfile: $(printf '%s' "$out" | tail -1)"
+        fi
+    done
+fi
+
+echo "Result: $PASSED passed, $FAILED failed"
+[[ $FAILED -eq 0 ]]
```

---

### Incident Patch 6: `97f2e75f` (2026-10-05)
**Commit Message**: Merge pull request #7387 from Osmantic/fix/wsl-hardware-display

Installer: Windows hardware summary reads true; skip the Linux NVIDIA check on WSL

**File**: `ods/installers/lib/detection.sh` (modified, +3/-0)
```diff
@@ -720,6 +720,9 @@ nvidia_kernel_module_flavor() {
 }
 
 validate_nvidia_blackwell_open_modules() {
+    # WSL uses the Windows display driver through /dev/dxg. Linux module
+    # metadata does not apply there, and installing a Linux driver breaks it.
+    ods_is_wsl_host && return 0
     nvidia_blackwell_hardware_detected || return 0
 
     local flavor
```

**File**: `ods/installers/lib/ui.sh` (modified, +3/-1)
```diff
@@ -603,6 +603,8 @@ show_hardware_summary() {
     local cpu_info="$3"
     local ram_gb="$4"
     local disk_gb="$5"
+    # Optional: why the RAM figure differs from the machine's total (WSL).
+    local ram_note="${6:-}"
 
     echo ""
     echo -e "${GRN}+-------------------------------------------------------------+${NC}"
@@ -611,7 +613,7 @@ show_hardware_summary() {
     printf "${GRN}|${NC}  GPU:    %-50s ${GRN}|${NC}\n" "${gpu_name:-Not detected}"
     [[ -n "$gpu_vram" ]] && printf "${GRN}|${NC}  VRAM:   %-50s ${GRN}|${NC}\n" "${gpu_vram}GB"
     printf "${GRN}|${NC}  CPU:    %-50s ${GRN}|${NC}\n" "${cpu_info:-Unknown}"
-    printf "${GRN}|${NC}  RAM:    %-50s ${GRN}|${NC}\n" "${ram_gb}GB"
+    printf "${GRN}|${NC}  RAM:    %-50s ${GRN}|${NC}\n" "${ram_gb}GB${ram_note:+ ($ram_note)}"
     printf "${GRN}|${NC}  Disk:   %-50s ${GRN}|${NC}\n" "${disk_gb}GB available"
     echo -e "${GRN}+-------------------------------------------------------------+${NC}"
 }
```

**File**: `ods/installers/phases/02-detection.sh` (modified, +9/-2)
```diff
@@ -90,6 +90,9 @@ load_capability_profile || true
 # actually address, not the Windows host's physical total. Keep a smaller
 # reserved value only for coarse tier selection; system_ram_min_gb profiles and
 # the persisted SYSTEM_RAM_GB contract describe actual addressable VM memory.
+# The hardware summary shows the VM figure; say why it is below the machine's
+# total so a 96GB PC showing 46GB doesn't read as a detection error (#7311).
+_ram_note=""
 if grep -qi microsoft /proc/version 2>/dev/null; then
     _wsl_ram_kb="$(ods_wsl_host_ram_kb)" || _wsl_ram_kb=""
     _wsl_vm_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
@@ -99,8 +102,10 @@ if grep -qi microsoft /proc/version 2>/dev/null; then
     _wsl_headroom_gb=$((RAM_GB - MODEL_TIER_RAM_GB))
     if [[ -n "$_wsl_ram_kb" && "$_wsl_ram_kb" =~ ^[0-9]+$ ]]; then
         _wsl_host_gb=$((_wsl_ram_kb / 1024 / 1024))
+        _ram_note="WSL limit; Windows has ${_wsl_host_gb}GB"
         log "WSL2 detected — Windows host RAM: ${_wsl_host_gb}GB; VM RAM: ${RAM_GB}GB; tier budget: ${MODEL_TIER_RAM_GB}GB (${_wsl_headroom_gb}GB reserved for ODS services)"
     else
+        _ram_note="WSL limit"
         log "WSL2 detected — could not query Windows host RAM; VM RAM: ${RAM_GB}GB; tier budget: ${MODEL_TIER_RAM_GB}GB (${_wsl_headroom_gb}GB reserved for ODS services)"
         log "For correct tier selection: use --tier N or configure .wslconfig"
     fi
@@ -804,9 +809,11 @@ if [[ "$INTERACTIVE" == "true" ]]; then
     # A host-native llama-server (Windows under WSL) runs the model on a GPU
     # this Linux probe cannot see; show that GPU instead of "None".
     if ods_native_llm_requested && [[ -n "${NATIVE_LLM_GPU_NAME:-}" ]]; then
-        show_hardware_summary "${NATIVE_LLM_GPU_NAME} (llama-server on Windows)" "$(( (${NATIVE_LLM_GPU_VRAM_MB:-0} + 512) / 1024 ))" "$CPU_INFO" "$RAM_GB" "$DISK_AVAIL"
+        show_hardware_summary "${NATIVE_LLM_GPU_NAME} (llama-server on Windows)" "$(( (${NATIVE_LLM_GPU_VRAM_MB:-0} + 512) / 1024 ))" "$CPU_INFO" "$RAM_GB" "$DISK_AVAIL" "${_ram_note:-}"
     else
-        show_hardware_summary "$GPU_NAME" "$((GPU_VRAM / 1024))" "$CPU_INFO" "$RAM_GB" "$DISK_AVAIL"
+        # Round to the nearest GB: a 24GB card reports about 24564MiB, which
+        # truncates to 23GB (#7311).
+        show_hardware_summary "$GPU_NAME" "$(( (GPU_VRAM + 512) / 1024 ))" "$CPU_INFO" "$RAM_GB" "$DISK_AVAIL" "${_ram_note:-}"
     fi
 
     _shown_model="$LLM_MODEL"
```

**File**: `ods/tests/ci-suite.txt` (modified, +1/-0)
```diff
@@ -204,6 +204,7 @@ tests/test-windows-stop-native-helpers.sh
 tests/test-windows-whisper-compose-fallback.sh
 tests/test-wsl-bind-recovery-live.py
 tests/test-wsl-docker-desktop-nvidia.sh
+tests/test-wsl-hardware-display.sh
 tests/test-wsl-host-ram-fallback.sh
 tests/test-wsl-nvidia-detection.sh
 tests/test-wsl-runtime-proof.py
```

**File**: `ods/tests/test-wsl-hardware-display.sh` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+#!/usr/bin/env bash
+# The installer's hardware summary must not read as a detection error on
+# Windows (#7311): VRAM rounds to the nearest GB (a 24GB card reports about
+# 24564MiB), and the WSL RAM limit is named next to the RAM figure. The
+# Linux-only NVIDIA Blackwell module check is skipped under WSL, where the
+# Windows driver serves the GPU.
+set -euo pipefail
+
+ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
+fail() { echo "FAIL: $1"; exit 1; }
+
+extract() {
+    awk -v signature="$1() {" '$0 == signature { f = 1 } f { print } f && $0 == "}" { exit }' "$2"
+}
+
+summary="$(extract show_hardware_summary "$ROOT/installers/lib/ui.sh")"
+[[ -n "$summary" ]] || fail "show_hardware_summary was not found"
+eval "$summary"
+GRN="" NC="" BGRN=""
+
+out="$(show_hardware_summary "NVIDIA RTX 3090 Ti" "24" "Ryzen 9" "46" "500" "WSL limit; Windows has 96GB")"
+grep -qF "46GB (WSL limit; Windows has 96GB)" <<< "$out" || fail "the WSL RAM note is missing: $out"
+out="$(show_hardware_summary "NVIDIA RTX 3090 Ti" "24" "Ryzen 9" "64" "500")"
+grep -qE 'RAM: +64GB +\|' <<< "$out" || fail "RAM without a note changed: $out"
+
+grep -qF 'show_hardware_summary "$GPU_NAME" "$(( (GPU_VRAM + 512) / 1024 ))"' \
+    "$ROOT/installers/phases/02-detection.sh" \
+    || fail "the GPU summary must round VRAM to the nearest GB"
+grep -qF '"$DISK_AVAIL" "${_ram_note:-}"' "$ROOT/installers/phases/02-detection.sh" \
+    || fail "the hardware summary must receive the WSL RAM note"
+
+check="$(extract validate_nvidia_blackwell_open_modules "$ROOT/installers/lib/detection.sh")"
+[[ -n "$check" ]] || fail "validate_nvidia_blackwell_open_modules was not found"
+eval "$check"
+
+ods_is_wsl_host() { return 0; }
+nvidia_blackwell_hardware_detected() { fail "the Blackwell module probe ran under WSL"; }
+validate_nvidia_blackwell_open_modules || fail "the Blackwell check failed under WSL"
+
+ods_is_wsl_host() { return 1; }
+probed=false
+nvidia_blackwell_hardware_detected() { probed=true; return 1; }
+validate_nvidia_blackwell_open_modules
+[[ "$probed" == true ]] || fail "the Blackwell check no longer runs on native Linux"
+
+echo "PASS: WSL hardware summary names the RAM limit, rounds VRAM, and skips the Linux Blackwell check"
```

---

### Incident Patch 7: `25c58870` (2026-10-05)
**Commit Message**: Merge pull request #7379 from IronicRayquaza/fix/uninstall-unconfigured-install

fix(uninstall): remove installs that stopped before .env was written

**File**: `ods/ods-uninstall.sh` (modified, +26/-3)
```diff
@@ -254,11 +254,32 @@ if [[ "$FORCE" != "true" ]]; then
     echo ""
 fi
 
+# An install that stopped before phase 06 has no .env. Its Compose stack needs
+# secrets that only .env provides, so it was never started and cannot be
+# rendered now. When Docker also holds nothing in the ods Compose project there
+# is nothing to stop or purge: skip the Docker steps instead of refusing every
+# uninstall. Any resource in that project keeps the full ownership checks, and
+# a Docker query failure keeps them too.
+DOCKER_CLEANUP=false
+if command -v docker >/dev/null 2>&1; then
+    DOCKER_CLEANUP=true
+    if [[ ! -f "$INSTALL_DIR/.env" ]]; then
+        if _ods_project_resources="$(docker ps -aq --filter label=com.docker.compose.project=ods \
+                && docker volume ls -q --filter label=com.docker.compose.project=ods \
+                && docker network ls -q --filter label=com.docker.compose.project=ods)" \
+            && [[ -z "$_ods_project_resources" ]]; then
+            DOCKER_CLEANUP=false
+            log_info "No .env and no Docker resources in the ods Compose project; skipping Docker cleanup"
+        fi
+        unset _ods_project_resources
+    fi
+fi
+
 # Compose down can execute extension lifecycle hooks. Refuse unsafe saved
 # recipes before retiring Pixel, privileged services, or any installation data.
 compose_flags=""
 compose_args=()
-if command -v docker >/dev/null 2>&1; then
+if $DOCKER_CLEANUP; then
     compose_flags="$(resolve_compose_flags)"
     if [[ -n "$compose_flags" ]]; then
         read -ra compose_args <<< "$compose_flags"
@@ -276,7 +297,7 @@ fi
 # exact ownership before retiring Pixel or system services. Keep the snapshot
 # outside the install tree so a failed purge can retain that tree for recovery.
 volume_snapshot=""
-if command -v docker >/dev/null 2>&1; then
+if $DOCKER_CLEANUP; then
     volume_snapshot="$(mktemp "${TMPDIR:-/tmp}/ods-uninstall-volumes.XXXXXXXX")"
     trap '[[ -z "$volume_snapshot" ]] || rm -f -- "$volume_snapshot"' EXIT
     # macOS ships Bash 3.2, where expanding an empty array under nounset is
@@ -457,7 +478,7 @@ fi
 # 1. Stop and remove Docker containers
 log_info "Stopping Docker containers..."
 cd "$INSTALL_DIR" 2>/dev/null || true
-if command -v docker &>/dev/null; then
+if $DOCKER_CLEANUP; then
     # Use ODS's resolved compose stack. The repo does not ship a
     # top-level docker-compose.yml, so bare `docker compose down` can fail with
     # "no configuration file provided" even from the correct install dir.
@@ -516,6 +537,8 @@ if command -v docker &>/dev/null; then
 
     log_ok "Verified Docker cleanup complete"
     log_info "Docker images and shared build cache retained"
+elif command -v docker &>/dev/null; then
+    log_info "Docker holds nothing for this unconfigured installation; no container cleanup needed"
 else
     log_warn "Docker not found — skipping container cleanup"
 fi
```

**File**: `ods/tests/test-macos-uninstall-launchagents.sh` (modified, +23/-2)
```diff
@@ -97,6 +97,8 @@ make_install() {
     cp "$ROOT_DIR/scripts/resolve-compose-stack.sh" "$install_dir/scripts/"
     touch "$install_dir/docker-compose.base.yml"
     printf '%s\n' '-f docker-compose.base.yml' > "$install_dir/.compose-flags"
+    # A configured install: the only state with destructive Docker cleanup.
+    printf '%s\n' 'WEBUI_SECRET=test-only' > "$install_dir/.env"
     mkdir -p "$install_dir/installers/macos/lib"
     cp "$ROOT_DIR/installers/macos/lib/pixel-native-uninstall.py" "$install_dir/installers/macos/lib/"
     touch "$install_dir/ods-cli"
@@ -168,8 +170,10 @@ main() {
     done
     pass "macOS uninstall boots out loaded agents and removes all ODS plists (incl. legacy)"
     local retire_line down_line
-    retire_line="$(grep -n '^native-retire$' "$TMP_DIR/out1.log.commands" | head -n 1 | cut -d: -f1)"
-    down_line="$(grep -n '^docker compose .* down --remove-orphans$' "$TMP_DIR/out1.log.commands" | head -n 1 | cut -d: -f1)"
+    # || true: under pipefail a missing line would end the test silently
+    # instead of printing the FAIL below.
+    retire_line="$(grep -n '^native-retire$' "$TMP_DIR/out1.log.commands" | head -n 1 | cut -d: -f1 || true)"
+    down_line="$(grep -n '^docker compose .* down --remove-orphans$' "$TMP_DIR/out1.log.commands" | head -n 1 | cut -d: -f1 || true)"
     [[ -n "$retire_line" && -n "$down_line" && "$retire_line" -lt "$down_line" ]] \
         || fail "native retirement must precede destructive Docker cleanup"
 
@@ -239,6 +243,23 @@ main() {
         fail "rejected retirement must not mutate Docker resources"
     fi
     pass "native retirement failure retains the install, agents and Docker resources"
+
+    # An install that stopped before .env was written (#7377): native
+    # retirement still runs, Docker is not touched, and the tree is removed.
+    local install7="$TMP_DIR/install7" home7="$TMP_DIR/home7"
+    make_install "$install7"
+    rm -f "$install7/.env"
+    mkdir -p "$home7/Library/LaunchAgents"
+    LAUNCHCTL_LOG="$TMP_DIR/launchctl7.log" \
+        run_uninstall "$install7" "$home7" "$stub_dir" "$TMP_DIR/out7.log" \
+        || { cat "$TMP_DIR/out7.log" >&2; fail "uninstall without .env exited non-zero"; }
+    grep -qx 'native-retire' "$TMP_DIR/out7.log.commands" \
+        || fail "uninstall without .env skipped native retirement"
+    if grep -q '^docker compose ' "$TMP_DIR/out7.log.commands"; then
+        fail "uninstall without .env ran Docker Compose"
+    fi
+    [[ ! -e "$install7" ]] || fail "uninstall without .env left the install directory"
+    pass "an install without .env retires native services and is removed without Docker cleanup"
 }
 
 main "$@"
```

**File**: `ods/tests/test-uninstall-compose-flags.sh` (modified, +41/-0)
```diff
@@ -67,6 +67,11 @@ if [[ "${1:-}" == "volume" && "${2:-}" == "ls" ]]; then
     emit_filtered "$@"
     exit 0
 fi
+if [[ "${1:-}" == "compose" && -n "${DOCKER_REQUIRE_ENV:-}" && ! -f "$INSTALL_DIR/.env" ]]; then
+    # Real Compose cannot render the base stack without the secrets in .env.
+    printf 'required variable WEBUI_SECRET is missing a value\n' >&2
+    exit 1
+fi
 if [[ "${1:-}" == "compose" && -n "${DOCKER_GID_EXPECTED:-}" ]]; then
     [[ "${PIXEL_INGRESS_GID:-}" == "$DOCKER_GID_EXPECTED" ]] || {
         printf 'Compose interpolation GID mismatch\n' >&2
@@ -182,6 +187,7 @@ run_uninstall() {
     DOCKER_PROFILE_STATE_FILE="${DOCKER_PROFILE_STATE_FILE:-}" \
     DOCKER_GID_EXPECTED="${DOCKER_GID_EXPECTED:-}" \
     DOCKER_GID_ENV_COPY="${DOCKER_GID_ENV_COPY:-}" \
+    DOCKER_REQUIRE_ENV="${DOCKER_REQUIRE_ENV:-}" \
     PIXEL_INGRESS_GID="${PIXEL_INGRESS_GID-}" \
     ID_PRIMARY_GROUP="${ID_PRIMARY_GROUP-1000}" \
     ID_PRIMARY_EXIT="${ID_PRIMARY_EXIT-0}" \
@@ -269,6 +275,41 @@ EOF
         || fail "missing Compose flags must explain the refusal"
     pass "missing Compose flags are refused before uninstall mutation"
 
+    # An install that stopped before phase 06 has no .env, so its Compose stack
+    # cannot render. With nothing in the ods Compose project there is nothing
+    # to stop or purge, and the uninstall must still complete.
+    local unconfigured_install="$TMP_DIR/unconfigured-install" unconfigured_home="$TMP_DIR/unconfigured-home"
+    local unconfigured_docker="$TMP_DIR/unconfigured-docker.log"
+    make_install "$unconfigured_install"
+    mkdir -p "$unconfigured_home"
+    rm "$unconfigured_install/.env"
+    DOCKER_LOG="$unconfigured_docker" SUDO_LOG="$TMP_DIR/unconfigured-sudo.log" DOCKER_REQUIRE_ENV=1 \
+        run_uninstall "$unconfigured_install" "$unconfigured_home" "$stub_dir" 2>"$TMP_DIR/unconfigured-error" \
+        || fail "an install without .env and without ODS Docker resources must uninstall: $(cat "$TMP_DIR/unconfigured-error")"
+    [[ ! -e "$unconfigured_install" ]] || fail "unconfigured install directory must be removed"
+    if grep -q '^compose ' "$unconfigured_docker"; then
+        fail "an unconfigured install must not render or run its Compose stack"
+    fi
+    assert_no_name_cleanup "$unconfigured_docker"
+    pass "an install that stopped before .env uninstalls when Docker holds nothing for it"
+
+    # The same install with a container in the ods project keeps the full
+    # ownership checks, which refuse because the stack cannot render.
+    local residual_install="$TMP_DIR/unconfigured-residual" residual_home="$TMP_DIR/unconfigured-residual-home"
+    make_install "$residual_install"
+    mkdir -p "$residual_home"
+    rm "$residual_install/.env"
+    printf 'retain owner data\n' > "$residual_install/data/owner.txt"
+    if DOCKER_LOG="$TMP_DIR/unconfigured-residual-docker.log" SUDO_LOG="$TMP_DIR/unconfigured-sudo.log" \
+        DOCKER_REQUIRE_ENV=1 DOCKER_RESIDUAL_CONTAINER_ID="dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" \
+        run_uninstall "$residual_install" "$residual_home" "$stub_dir" 2>"$TMP_DIR/unconfigured-residual-error"; then
+        fail "an unconfigured install with ODS Docker resources must not skip ownership checks"
+    fi
+    [[ -f "$residual_install/data/owner.txt" ]] || fail "refused unconfigured install must keep its data"
+    grep -qF 'Docker ownership could not be proven' "$TMP_DIR/unconfigured-residual-error" \
+        || fail "unconfigured install with ODS resources must report the ownership refusal"
+    pass "an install without .env keeps ownership checks while ODS Docker resources exist"
+
     if [[ "$(uname -s)" == "Linux" ]]; then
         local changed_install="$TMP_DIR/changed-install" changed_home="$TMP_DIR/changed-home"
         local changed_docker="$TMP_DIR/changed-docker.log"
```

---

### Incident Patch 8: `ceceead2` (2026-10-05)
**Commit Message**: Merge pull request #7156 from Osmantic/fix/wsl-uninstall-registered-transport

fix(uninstall): retire registered runtimes and private Review state

**File**: `ods/lib/pixel-uninstall.sh` (modified, +9/-3)
```diff
@@ -412,6 +412,7 @@ state_limits = {
     "model-completed.json": 256 * 1024,
     "model-promotion-completed.json": 256 * 1024,
     "model-route-completed.json": 256 * 1024,
+    "source-overlay-completed.json": 8192,
     "settings-verified.json": 256 * 1024,
     "provider-root-plan.json": 8 * 1024 * 1024,
     "provider-root-managed.json": 8 * 1024 * 1024,
@@ -1525,10 +1526,14 @@ if workspace_preview_state.exists() or workspace_preview_state.is_symlink():
                     or child.st_uid != owner_uid or stat.S_IMODE(child.st_mode) != 0o700):
                 raise SystemExit("unsafe Pixel workspace preview state")
         for name in names:
-            child = (root_path / name).lstat()
+            path = root_path / name
+            child = path.lstat()
+            # Source capture owns one writable quota lock; publication bytes
+            # remain read-only. Do not extend this exception to other paths.
+            expected_mode = 0o600 if path == workspace_preview_state / '.review-sources/.quota.lock' else 0o400
             if (not stat.S_ISREG(child.st_mode) or stat.S_ISLNK(child.st_mode)
                     or child.st_nlink != 1 or child.st_uid != owner_uid
-                    or stat.S_IMODE(child.st_mode) != 0o400):
+                    or stat.S_IMODE(child.st_mode) != expected_mode):
                 raise SystemExit("unsafe Pixel workspace preview state")
 
 if gateway_unit.exists():
@@ -2844,8 +2849,9 @@ for path in [root, *root.rglob("*")]:
         if stat.S_ISLNK(info.st_mode) or info.st_uid != owner_uid or stat.S_IMODE(info.st_mode) != 0o700:
             raise SystemExit("unsafe Pixel workspace preview cleanup directory")
     elif stat.S_ISREG(info.st_mode):
+        expected_mode = 0o600 if path == root / '.review-sources/.quota.lock' else 0o400
         if (stat.S_ISLNK(info.st_mode) or info.st_nlink != 1
-                or info.st_uid != owner_uid or stat.S_IMODE(info.st_mode) != 0o400):
+                or info.st_uid != owner_uid or stat.S_IMODE(info.st_mode) != expected_mode):
             raise SystemExit("unsafe Pixel workspace preview cleanup file")
     else:
         raise SystemExit("unsafe Pixel workspace preview cleanup artifact")
```

**File**: `ods/scripts/retire-wsl-runtime.py` (modified, +16/-5)
```diff
@@ -90,12 +90,23 @@ def retire(install_dir: Path, *, validate_only: bool = False) -> dict:
     if 'ODS_WINDOWS_SYSTEM_DIRECTORY' in values and not values['ODS_WINDOWS_SYSTEM_DIRECTORY']:
         raise ValueError('The registered Windows system directory is empty; restore it before uninstalling')
     managed = None
-    if wsl_lemonade.candidate(values):
-        managed = wsl_lemonade.status(root, values)
+    runtime_values = values
+    routed = wsl_lemonade.candidate(values)
+    if registered and not routed:
+        # Routing can move to an API or the cloud while the owned Windows task
+        # stays registered. Custody comes from that task's user, distro,
+        # install root and immutable plan, not from the current endpoint, so
+        # probe it with a control-only environment. Nothing here changes the
+        # installation's routing or is written to its .env.
+        runtime_values = _with_bridge_aliases({
+            **{key: values[key] for key in ('ODS_WINDOWS_SYSTEM_DIRECTORY', 'ODS_WSL_STATE_ROOT')
+               if key in values},
+            'ODS_HOST_LLM_TRANSPORT': 'model-router',
+        })
+    if routed or registered:
+        managed = wsl_lemonade.status(root, runtime_values)
         if not managed['managed'] and registered:
             raise ValueError('The registered Windows runtime no longer belongs to this installation')
-    elif registered:
-        raise ValueError('Restore the registered Windows runtime transport before uninstalling')
     # All Windows ownership checks precede the first mutation. Disable and
     # settle sign-in startup before stopping Lemonade or retiring Pixel, so a
     # boot coordinator cannot restart services during their removal.
@@ -104,7 +115,7 @@ def retire(install_dir: Path, *, validate_only: bool = False) -> dict:
         return {'state': 'validated', 'startup': startup['state']}
     startup = wsl_lemonade.disable_startup(root, values, retire_relay=True)
     if managed and managed['managed']:
-        wsl_lemonade.stop(root, values, managed['planDigest'])
+        wsl_lemonade.stop(root, runtime_values, managed['planDigest'])
     return {'state': 'retired', 'startup': startup['state']}
 
 
```

**File**: `ods/tests/test-pixel-uninstall.sh` (modified, +75/-2)
```diff
@@ -15,6 +15,35 @@ log_info() { :; }
 log_ok() { :; }
 log_error() { :; }
 
+if python3 - "$ROOT_DIR" <<'PY'
+import ast
+import pathlib
+import re
+import sys
+
+source = pathlib.Path(sys.argv[1])
+bridge = ast.parse((source / 'bin/pixel_access_bridge.py').read_text(encoding='utf-8'))
+completed = {
+    node.right.value
+    for node in ast.walk(bridge)
+    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div)
+    and isinstance(node.left, ast.Attribute) and node.left.attr == 'state'
+    and isinstance(node.left.value, ast.Name) and node.left.value.id == 'self'
+    and isinstance(node.right, ast.Constant) and isinstance(node.right.value, str)
+    and node.right.value.endswith('-completed.json')
+}
+consumer = (source / 'lib/pixel-uninstall.sh').read_text(encoding='utf-8')
+limits = ast.parse(re.search(r'^state_limits = (\{.*?^\})', consumer, re.M | re.S)[1], mode='eval').body
+allowed = {ast.literal_eval(key) for key in limits.keys}
+assert completed, 'No completion writers found'
+assert not completed - allowed, 'Uninstall omits bridge completions: ' + ', '.join(sorted(completed - allowed))
+PY
+then
+    pass "uninstall recognizes the bridge's durable completion records"
+else
+    fail "uninstall completion inventory diverged from its producer"
+fi
+
 TEST_ROOT="$(mktemp -d)"
 trap 'rm -rf "$TEST_ROOT"' EXIT
 MOCK_BIN="$TEST_ROOT/bin"
@@ -666,6 +695,10 @@ ENV
     printf '%s\n' '<!doctype html><title>fixture</title>' \
         >"$PREVIEW_STATE/site-0123456789abcdef01234567/index.html"
     chmod 0400 "$PREVIEW_STATE/site-0123456789abcdef01234567/index.html"
+    # The real Review source publisher retains this private writable lock.
+    mkdir -m 0700 "$PREVIEW_STATE/.review-sources"
+    : >"$PREVIEW_STATE/.review-sources/.quota.lock"
+    chmod 0600 "$PREVIEW_STATE/.review-sources/.quota.lock"
 
     printf 'pixel-ops-broker:x:%s:%s:Pixel Operations Broker:%s:/usr/sbin/nologin\n' \
         "$uid" "$gid" "$OPS_STATE" >"$OPS_PASSWD_STATE"
@@ -1551,6 +1584,7 @@ for drift_target in program broker-source-mode public-state-file onboarding-sour
     extension-manager-program extension-manager-unit extension-manager-owner-unit approval-helper \
     artifact-promoter-program artifact-promoter-unit artifact-promoter-owner-unit \
     workspace-preview-program workspace-preview-unit workspace-preview-owner-unit workspace-preview-state \
+    preview-quota-readonly preview-quota-public preview-quota-symlink preview-quota-hardlink preview-quota-wrong-path \
     system-observer-program system-observer-source unix-peer-program unix-peer-ops unix-peer-source \
     unit dropin dropin-source environment policy; do
     write_ops_fixture
@@ -1581,6 +1615,17 @@ PY
         workspace-preview-unit) printf '%s\n' '# drift' >>"$SYSTEMD_DIR/pixel-workspace-preview.service" ;;
         workspace-preview-owner-unit) printf '%s\n' '# drift' >>"$INSTALL_DIR/data/pixel/workspace-preview.service" ;;
         workspace-preview-state) chmod 0600 "$PREVIEW_STATE/site-0123456789abcdef01234567/index.html" ;;
+        preview-quota-readonly) chmod 0400 "$PREVIEW_STATE/.review-sources/.quota.lock" ;;
+        preview-quota-public) chmod 0644 "$PREVIEW_STATE/.review-sources/.quota.lock" ;;
+        preview-quota-symlink)
+            rm "$PREVIEW_STATE/.review-sources/.quota.lock"
+            ln -s "$PREVIEW_STATE/site-0123456789abcdef01234567/index.html" "$PREVIEW_STATE/.review-sources/.quota.lock"
+            ;;
+        preview-quota-hardlink) ln "$PREVIEW_STATE/.review-sources/.quota.lock" "$PREVIEW_STATE/.review-sources/linked.lock" ;;
+        preview-quota-wrong-path)
+            : >"$PREVIEW_STATE/site-0123456789abcdef01234567/.quota.lock"
+            chmod 0600 "$PREVIEW_STATE/site-0123456789abcdef01234567/.quota.lock"
+            ;;
         system-observer-program) printf '%s\n' '# drift' >>"$LIBEXEC_DIR/ods-pixel-system-observe.py" ;;
         system-observer-source) printf '%s\n' '# drift' >>"$INSTALL_DIR/extensions/services/pixel-agent/host/system_observe.py" ;;
         unix-peer-program) printf '%s\n' '# drift' >>"$LIBEXEC_DIR/unix_peer.py" ;;
@@ -2436,17 +2481,45 @@ for scenario in foreign modified_unit modified_program relay_key state_symlink p
 done
 
 write_access_fixture
-for receipt in release-intent release-prepared release-completed; do
+for receipt in release-intent release-prepared release-completed source-overlay-completed; do
     printf '{}\n' > "$ACCESS_STATE/$receipt.json"
     chmod 0600 "$ACCESS_STATE/$receipt.json"
 done
 if ods_pixel_uninstall_managed "$INSTALL_DIR" "$HOME_DIR" \
     && [[ ! -e "$ACCESS_STATE" ]]; then
-    pass "completed release coordinator state permits verified cleanup"
+    pass "completed release and source overlay coordinator state permits verified cleanup"
 else
     fail "completed release coordinator state stranded the installation"
 fi
 
+for scenario in public symlink hardlink oversized invalid-json non-object unknown-file pending; do
+    write_acces
```

**File**: `ods/tests/test-retire-wsl-runtime.py` (modified, +33/-3)
```diff
@@ -138,12 +138,42 @@ def test_other_wsl_backends_only_retire_their_startup_task(self):
         self.stop.assert_not_called()
         self.assertEqual(self.disable_startup.call_count, 2)
 
-    def test_registered_runtime_cannot_be_hidden_by_a_changed_transport(self):
+    def test_registered_runtime_is_verified_after_routing_changes(self):
+        # An API or cloud route leaves the owned Windows task registered.
+        # Custody is proven from the task with a control-only environment;
+        # startup checks still get the installation's own values.
         (self.root / 'data').mkdir()
         (self.root / 'data/wsl-lemonade-runtime.json').write_text('{}')
         self.candidate.return_value = False
-        with self.assertRaises(ValueError):
-            helper.retire(self.root, validate_only=True)
+        for key in ('ODS_HOST_LLM_TRANSPORT', 'LEMONADE_HOST_TRANSPORT'):
+            for transport in ('direct', 'cloud', ''):
+                content = (key + '=' + transport + '\n'
+                           'ODS_WINDOWS_SYSTEM_DIRECTORY="C:\\Windows\\System32"\n'
+                           'NATIVE_LLM_BASE_URL=\nNATIVE_LLM_CONTAINER_BASE_URL=https://example.com/api\n'
+                           'AMD_INFERENCE_PORT=\n')
+                (self.root / '.env').write_text(content)
+                with self.subTest(key=key, transport=transport):
+                    self.assertEqual(helper.retire(self.root, validate_only=True)['state'], 'validated')
+                    self.status.assert_called_with(self.root, ENV)
+                    self.stop.assert_not_called()
+                    self.assertEqual(helper.retire(self.root)['state'], 'retired')
+                    self.stop.assert_called_once_with(self.root, ENV, 'a' * 64)
+                    self.assertEqual(self.disable_startup.call_args.args[1][key], transport)
+                    self.assertEqual((self.root / '.env').read_text(), content)
+                    self.stop.reset_mock()
+
+    def test_changed_routing_does_not_allow_unowned_registered_runtime(self):
+        (self.root / 'data').mkdir()
+        (self.root / 'data/wsl-lemonade-runtime.json').write_text('{}')
+        (self.root / '.env').write_text('ODS_HOST_LLM_TRANSPORT=direct\n')
+        self.candidate.return_value = False
+        for result in ({'managed': False}, OSError('foreign Windows task')):
+            self.status.side_effect = result if isinstance(result, Exception) else None
+            self.status.return_value = result
+            with self.subTest(result=result), self.assertRaises((ValueError, OSError)):
+                helper.retire(self.root)
+        self.status.assert_called_with(self.root, {'ODS_HOST_LLM_TRANSPORT': 'model-router',
+                                                   'LEMONADE_HOST_TRANSPORT': 'model-router'})
         self.disable_startup.assert_not_called()
         self.stop.assert_not_called()
 
```

---

### Incident Patch 9: `f4ff983a` (2026-10-05)
**Commit Message**: fix(installer): copy .dockerignore in the no-rsync fallback only when present

The fallback copy failed on a source tree without .dockerignore, which is
what test-phase06-cloud-config-preservation.sh builds (CI integration-smoke).
A real checkout always has the file. Older and synthetic sources now copy as
before, and the test checks the fallback copies the file when the source has it.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `ods/installers/lib/source-copy.sh` (modified, +5/-2)
```diff
@@ -59,7 +59,10 @@ ods_copy_install_source() {
         # preservation. A rerun cannot safely use an unfiltered recursive cp.
         cp -r "$source_dir"/* "$install_dir/" 2>>"$log_file" || return 1
         cp "$source_dir/.gitignore" "$install_dir/" 2>>"$log_file" || return 1
-        # Root-context image builds read it (see .dockerignore).
-        cp "$source_dir/.dockerignore" "$install_dir/" 2>>"$log_file" || return 1
+        # Root-context image builds read it (see .dockerignore). Sources from
+        # before it existed copy as they did.
+        if [[ -f "$source_dir/.dockerignore" ]]; then
+            cp "$source_dir/.dockerignore" "$install_dir/" 2>>"$log_file" || return 1
+        fi
     fi
 }
```

**File**: `ods/tests/test-phase06-cloud-config-preservation.sh` (modified, +3/-1)
```diff
@@ -15,7 +15,7 @@ src="$tmp/src"
 mkdir -p "$src/config/litellm"
 printf 'bundled-template\n' > "$src/config/litellm/cloud.yaml"
 printf 'source-canary\n' > "$src/canary"
-touch "$src/.gitignore"
+touch "$src/.gitignore" "$src/.dockerignore"
 setup() { inst="$tmp/$1"; mkdir -p "$inst/config/litellm"; }
 copy() { ods_copy_install_source "$src" "$inst" "$tmp/log"; }
 setup fresh
@@ -60,6 +60,8 @@ setup fresh-fallback
 copy
 cmp "$src/config/litellm/cloud.yaml" "$inst/config/litellm/cloud.yaml" || fail 'fresh fallback template absent'
 pass 'fresh fallback copies the template'
+[[ -f "$inst/.dockerignore" ]] || fail 'fresh fallback dropped the root .dockerignore'
+pass 'fresh fallback copies the root .dockerignore'
 unset -f command
 
 # Exercise the actual Phase 06 normalization after a copy from a checkout
```

---

### Incident Patch 10: `50a62bf9` (2026-10-05)
**Commit Message**: Merge pull request #7386 from Osmantic/fix/bootstrap-download-dead-end

Models: a download blocked by the first full model says how to go on

**File**: `ods/extensions/services/dashboard-api/routers/models.py` (modified, +19/-4)
```diff
@@ -1640,21 +1640,36 @@ def _stale_bootstrap_download_status(status: dict[str, Any]) -> dict[str, Any]:
     }
 
 
+def _bootstrap_retry_pending_error(model_name: Any) -> str:
+    """Say why downloads wait on the first full model and how to retry it.
+
+    The retry starts with the next ODS start or restart, and nothing else
+    told the owner that (a user hit this on three computers with no way on).
+    """
+    model = str(model_name or "").strip() or "the full model"
+    return (f"ODS's first download of {model} stopped before it finished, and it goes before other "
+            "model downloads. Restart ODS to retry it (ods restart). The reason is in "
+            "logs/model-upgrade.log in your ODS folder.")
+
+
 def _bootstrap_upgrade_download_conflict() -> dict[str, Any] | None:
     """Return a lifecycle-busy payload when bootstrap upgrade owns download priority."""
     bootstrap_status = _read_bootstrap_status_file()
     if _is_stale_active_bootstrap_status(bootstrap_status):
+        target = bootstrap_status.get("model") if bootstrap_status else None
         return {
-            "error": "Cannot start model download while bootstrap full-model upgrade is pending retry",
+            "error": _bootstrap_retry_pending_error(target),
             "code": "model_lifecycle_busy",
             "activeOperation": "bootstrap_upgrade_retry_pending",
-            "activeTarget": bootstrap_status.get("model") if bootstrap_status else None,
+            "activeTarget": target,
         }
 
     bootstrap_info = get_bootstrap_status()
     if bootstrap_info.active:
+        model = str(bootstrap_info.model_name or "").strip() or "the full model"
         return {
-            "error": "Cannot start model download while bootstrap full-model upgrade is in progress",
+            "error": (f"ODS is still downloading {model}, its first full model. "
+                      "Other model downloads can start when it finishes."),
             "code": "model_lifecycle_busy",
             "activeOperation": "bootstrap_upgrade",
             "activeTarget": bootstrap_info.model_name,
@@ -1682,7 +1697,7 @@ def _bootstrap_upgrade_download_conflict() -> dict[str, Any] | None:
         return None
 
     return {
-        "error": "Cannot start model download while bootstrap full-model upgrade is pending retry",
+        "error": _bootstrap_retry_pending_error(model_name),
         "code": "model_lifecycle_busy",
         "activeOperation": "bootstrap_upgrade_retry_pending",
         "activeTarget": model_name,
```

**File**: `ods/extensions/services/dashboard-api/tests/test_models.py` (modified, +4/-4)
```diff
@@ -1908,7 +1908,7 @@ def test_download_model_rejects_while_bootstrap_upgrade_active(test_client, monk
 
     assert resp.status_code == 409
     assert resp.json()["detail"] == {
-        "error": "Cannot start model download while bootstrap full-model upgrade is in progress",
+        "error": "ODS is still downloading Qwen3.6-35B-A3B-UD-Q4_K_M.gguf, its first full model. Other model downloads can start when it finishes.",
         "code": "model_lifecycle_busy",
         "activeOperation": "bootstrap_upgrade",
         "activeTarget": "Qwen3.6-35B-A3B-UD-Q4_K_M.gguf",
@@ -1958,7 +1958,7 @@ def test_load_model_rejects_while_bootstrap_upgrade_active(test_client, monkeypa
 
     assert resp.status_code == 409
     assert resp.json()["detail"] == {
-        "error": "Cannot start model download while bootstrap full-model upgrade is in progress",
+        "error": "ODS is still downloading Qwen3.5-9B-Q4_K_M.gguf, its first full model. Other model downloads can start when it finishes.",
         "code": "model_lifecycle_busy",
         "activeOperation": "bootstrap_upgrade",
         "activeTarget": "Qwen3.5-9B-Q4_K_M.gguf",
@@ -2012,7 +2012,7 @@ def test_download_model_rejects_while_bootstrap_upgrade_retry_pending(test_clien
 
     assert resp.status_code == 409
     assert resp.json()["detail"] == {
-        "error": "Cannot start model download while bootstrap full-model upgrade is pending retry",
+        "error": "ODS's first download of Qwen3.6-35B-A3B-UD-Q4_K_M.gguf stopped before it finished, and it goes before other model downloads. Restart ODS to retry it (ods restart). The reason is in logs/model-upgrade.log in your ODS folder.",
         "code": "model_lifecycle_busy",
         "activeOperation": "bootstrap_upgrade_retry_pending",
         "activeTarget": "Qwen3.6-35B-A3B-UD-Q4_K_M.gguf",
@@ -2067,7 +2067,7 @@ def test_download_model_rejects_stale_active_bootstrap_upgrade_as_retry_pending(
 
     assert resp.status_code == 409
     assert resp.json()["detail"] == {
-        "error": "Cannot start model download while bootstrap full-model upgrade is pending retry",
+        "error": "ODS's first download of Qwen3.6-35B-A3B-UD-Q4_K_M.gguf stopped before it finished, and it goes before other model downloads. Restart ODS to retry it (ods restart). The reason is in logs/model-upgrade.log in your ODS folder.",
         "code": "model_lifecycle_busy",
         "activeOperation": "bootstrap_upgrade_retry_pending",
         "activeTarget": "Qwen3.6-35B-A3B-UD-Q4_K_M.gguf",
```

**File**: `ods/extensions/services/dashboard/src/pages/Models.jsx` (modified, +3/-1)
```diff
@@ -1407,7 +1407,9 @@ function DownloadProgressBar({ progress, helpers, onRetry }) {
             <AlertCircle size={20} className="shrink-0 text-red-400" />
             <div className="min-w-0">
               <p className="font-medium text-red-300">{cancelled ? 'Download Cancelled' : 'Download Failed'}</p>
-              <p className="break-words text-sm text-red-300/70">{progress.error}</p>
+              <p className="break-words text-sm text-red-300/70">
+                {progress.error}{!cancelled && <> <HelpLink /></>}
+              </p>
             </div>
           </div>
           {onRetry && (
```

**File**: `ods/extensions/services/dashboard/src/pages/Models.test.jsx` (modified, +3/-0)
```diff
@@ -1060,6 +1060,9 @@ test('shows terminal download failures with a retry action', async () => {
 
   expect(screen.getByText('Download Failed')).toBeInTheDocument()
   expect(screen.getByText('The download checksum did not match.')).toBeInTheDocument()
+  // A failed download names where to get help, like the page's other errors.
+  expect(screen.getByRole('link', { name: /get help on discord/i }))
+    .toHaveAttribute('href', expect.stringContaining('discord.gg/'))
   fireEvent.click(screen.getByRole('button', { name: /retry/i }))
 
   expect(clearTerminal).toHaveBeenCalled()
```

---

### Incident Patch 11: `7f587298` (2026-10-05)
**Commit Message**: Merge pull request #7380 from IronicRayquaza/fix/macos-hermes-prompt-with-portal

fix(macos): stop offering Hermes in the custom menu while Portal is on

**File**: `ods/installers/macos/install-macos.sh` (modified, +15/-3)
```diff
@@ -392,6 +392,19 @@ _macos_apply_fresh_feature_defaults() {
     fi
 }
 
+_macos_ask_hermes() {
+    # Portal and Hermes are alternative agents, and native Portal always
+    # replaces Hermes. Asking would offer a choice the installer then ignores.
+    if $ENABLE_PIXEL; then
+        ENABLE_HERMES=false
+        ai "Hermes Agent is not offered while Portal is the agent. To use Hermes instead, do a fresh install with --no-pixel."
+        return 0
+    fi
+    local yn
+    read -r -p "  Enable Hermes Agent (default AI agent)? [Y/n] " yn < /dev/tty
+    [[ "$yn" =~ ^[nN] ]] && ENABLE_HERMES=false || ENABLE_HERMES=true
+}
+
 _macos_resolve_webui_selection() {
     [[ -f "${INSTALL_DIR}/.env" ]] || return 0
     WEBUI_RETAINED="$(read_env_value "${INSTALL_DIR}/.env" ENABLE_OPEN_WEBUI)"
@@ -1765,8 +1778,7 @@ if ! $NON_INTERACTIVE && ! $ALL_FEATURES && ! $DRY_RUN; then
             [[ "$yn" =~ ^[yY] ]] && ENABLE_RAG=true
             read -r -p "  Enable extra support (SearXNG + Token Spy)? [Y/n] " yn < /dev/tty
             [[ "$yn" =~ ^[nN] ]] && ENABLE_RECOMMENDED=false || ENABLE_RECOMMENDED=true
-            read -r -p "  Enable Hermes Agent (default AI agent)? [Y/n] " yn < /dev/tty
-            [[ "$yn" =~ ^[nN] ]] && ENABLE_HERMES=false || ENABLE_HERMES=true
+            _macos_ask_hermes
             if ! $OPENCODE_ENABLE_EXPLICIT && ! $OPENCODE_DISABLE_EXPLICIT; then
                 read -r -p "  Enable OpenCode browser IDE? [y/N] " yn < /dev/tty
                 if [[ "$yn" =~ ^[yY] ]]; then
@@ -1908,7 +1920,7 @@ info_box "  RAG:" "$(if $ENABLE_RAG; then echo enabled; else echo disabled; fi)"
 info_box "  SearXNG search:" "$(if $ENABLE_SEARXNG; then echo enabled; else echo disabled; fi)"
 info_box "  Token Spy:" "$(if $ENABLE_RECOMMENDED; then echo enabled; else echo disabled; fi)"
 info_box "  LiteLLM gateway:" "$(if $ENABLE_LITELLM; then echo enabled; else echo disabled; fi)"
-info_box "  Hermes:" "$(if $ENABLE_HERMES; then echo enabled; else echo disabled; fi)"
+info_box "  Hermes:" "$(if $ENABLE_HERMES; then echo enabled; elif $ENABLE_PIXEL; then echo 'disabled (Portal is the agent)'; else echo disabled; fi)"
 info_box "  Portal (native):" "$(if $ENABLE_PIXEL; then echo enabled; else echo disabled; fi)"
 info_box "  OpenCode:" "$(if $ENABLE_OPENCODE; then echo enabled; else echo disabled; fi)"
 info_box "  Perplexica:" "$(if $ENABLE_PERPLEXICA; then echo enabled; else echo disabled; fi)"
```

**File**: `ods/tests/test-macos-lean-feature-selection.sh` (modified, +21/-1)
```diff
@@ -136,4 +136,24 @@ _macos_sync_builtin_compose_states
     && -f "$INSTALL_DIR/extensions/services/searxng/compose.yaml" ]] \
     || { echo 'FAIL: selected recommended services were not restored' >&2; exit 1; }
 
-echo 'PASS: Mac gateway and optional search selection'
+# Custom selection must not offer Hermes while native Portal replaces it: the
+# answer would be overridden after the menu and the summary would contradict it.
+eval "$(sed -n '/^_macos_ask_hermes() {/,/^}/p' "$installer")"
+prompted="$scratch/hermes-prompted"
+# shellcheck disable=SC2162,SC2329  # records any prompt; called by the installer function
+read() { : > "$prompted"; builtin read "$@"; }
+ai() { printf '%s\n' "$*"; }
+ENABLE_PIXEL=true ENABLE_HERMES=true
+hermes_note="$(_macos_ask_hermes < /dev/null; printf 'ENABLE_HERMES=%s\n' "$ENABLE_HERMES")"
+unset -f read
+[[ ! -e "$prompted" ]] \
+    || { echo 'FAIL: custom selection asked about Hermes while Portal is the agent' >&2; exit 1; }
+[[ "$hermes_note" == *"ENABLE_HERMES=false"* && "$hermes_note" == *"--no-pixel"* ]] \
+    || { echo "FAIL: Portal selection did not explain why Hermes is off: $hermes_note" >&2; exit 1; }
+if [[ "$(grep -c 'Enable Hermes Agent' "$installer")" != 1 ]] \
+    || ! grep -q '^            _macos_ask_hermes$' "$installer"; then
+    echo 'FAIL: the custom menu asks about Hermes outside _macos_ask_hermes' >&2
+    exit 1
+fi
+
+echo 'PASS: Mac gateway, optional search and agent selection'
```

---

### Incident Patch 12: `27add7ce` (2026-10-05)
**Commit Message**: fix(installer): Windows hardware summary reads true; skip Linux NVIDIA check on WSL

#7311 (cjhmdm, 96GB RAM, RTX 3090 Ti 24GB) read the WSL install's summary
as a detection error: it showed RAM 46GB and VRAM 23GB.
- VRAM now rounds to the nearest GB, as the native-GPU line already did.
  A 24GB card reports about 24564MiB, which truncated to 23.
- On WSL the RAM line names the limit, e.g. "46GB (WSL limit; Windows has
  96GB)". Sizing is unchanged: it still uses the WSL figure.
- The NVIDIA Blackwell open-module check is skipped under WSL, where the
  Windows driver serves the GPU. On WSL it told every RTX 50-series owner to
  install a Linux driver, which breaks WSL GPU access. Split from #7375.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `ods/installers/lib/detection.sh` (modified, +3/-0)
```diff
@@ -720,6 +720,9 @@ nvidia_kernel_module_flavor() {
 }
 
 validate_nvidia_blackwell_open_modules() {
+    # WSL uses the Windows display driver through /dev/dxg. Linux module
+    # metadata does not apply there, and installing a Linux driver breaks it.
+    ods_is_wsl_host && return 0
     nvidia_blackwell_hardware_detected || return 0
 
     local flavor
```

**File**: `ods/installers/lib/ui.sh` (modified, +3/-1)
```diff
@@ -603,6 +603,8 @@ show_hardware_summary() {
     local cpu_info="$3"
     local ram_gb="$4"
     local disk_gb="$5"
+    # Optional: why the RAM figure differs from the machine's total (WSL).
+    local ram_note="${6:-}"
 
     echo ""
     echo -e "${GRN}+-------------------------------------------------------------+${NC}"
@@ -611,7 +613,7 @@ show_hardware_summary() {
     printf "${GRN}|${NC}  GPU:    %-50s ${GRN}|${NC}\n" "${gpu_name:-Not detected}"
     [[ -n "$gpu_vram" ]] && printf "${GRN}|${NC}  VRAM:   %-50s ${GRN}|${NC}\n" "${gpu_vram}GB"
     printf "${GRN}|${NC}  CPU:    %-50s ${GRN}|${NC}\n" "${cpu_info:-Unknown}"
-    printf "${GRN}|${NC}  RAM:    %-50s ${GRN}|${NC}\n" "${ram_gb}GB"
+    printf "${GRN}|${NC}  RAM:    %-50s ${GRN}|${NC}\n" "${ram_gb}GB${ram_note:+ ($ram_note)}"
     printf "${GRN}|${NC}  Disk:   %-50s ${GRN}|${NC}\n" "${disk_gb}GB available"
     echo -e "${GRN}+-------------------------------------------------------------+${NC}"
 }
```

**File**: `ods/installers/phases/02-detection.sh` (modified, +9/-2)
```diff
@@ -90,6 +90,9 @@ load_capability_profile || true
 # actually address, not the Windows host's physical total. Keep a smaller
 # reserved value only for coarse tier selection; system_ram_min_gb profiles and
 # the persisted SYSTEM_RAM_GB contract describe actual addressable VM memory.
+# The hardware summary shows the VM figure; say why it is below the machine's
+# total so a 96GB PC showing 46GB doesn't read as a detection error (#7311).
+_ram_note=""
 if grep -qi microsoft /proc/version 2>/dev/null; then
     _wsl_ram_kb="$(ods_wsl_host_ram_kb)" || _wsl_ram_kb=""
     _wsl_vm_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
@@ -99,8 +102,10 @@ if grep -qi microsoft /proc/version 2>/dev/null; then
     _wsl_headroom_gb=$((RAM_GB - MODEL_TIER_RAM_GB))
     if [[ -n "$_wsl_ram_kb" && "$_wsl_ram_kb" =~ ^[0-9]+$ ]]; then
         _wsl_host_gb=$((_wsl_ram_kb / 1024 / 1024))
+        _ram_note="WSL limit; Windows has ${_wsl_host_gb}GB"
         log "WSL2 detected — Windows host RAM: ${_wsl_host_gb}GB; VM RAM: ${RAM_GB}GB; tier budget: ${MODEL_TIER_RAM_GB}GB (${_wsl_headroom_gb}GB reserved for ODS services)"
     else
+        _ram_note="WSL limit"
         log "WSL2 detected — could not query Windows host RAM; VM RAM: ${RAM_GB}GB; tier budget: ${MODEL_TIER_RAM_GB}GB (${_wsl_headroom_gb}GB reserved for ODS services)"
         log "For correct tier selection: use --tier N or configure .wslconfig"
     fi
@@ -804,9 +809,11 @@ if [[ "$INTERACTIVE" == "true" ]]; then
     # A host-native llama-server (Windows under WSL) runs the model on a GPU
     # this Linux probe cannot see; show that GPU instead of "None".
     if ods_native_llm_requested && [[ -n "${NATIVE_LLM_GPU_NAME:-}" ]]; then
-        show_hardware_summary "${NATIVE_LLM_GPU_NAME} (llama-server on Windows)" "$(( (${NATIVE_LLM_GPU_VRAM_MB:-0} + 512) / 1024 ))" "$CPU_INFO" "$RAM_GB" "$DISK_AVAIL"
+        show_hardware_summary "${NATIVE_LLM_GPU_NAME} (llama-server on Windows)" "$(( (${NATIVE_LLM_GPU_VRAM_MB:-0} + 512) / 1024 ))" "$CPU_INFO" "$RAM_GB" "$DISK_AVAIL" "${_ram_note:-}"
     else
-        show_hardware_summary "$GPU_NAME" "$((GPU_VRAM / 1024))" "$CPU_INFO" "$RAM_GB" "$DISK_AVAIL"
+        # Round to the nearest GB: a 24GB card reports about 24564MiB, which
+        # truncates to 23GB (#7311).
+        show_hardware_summary "$GPU_NAME" "$(( (GPU_VRAM + 512) / 1024 ))" "$CPU_INFO" "$RAM_GB" "$DISK_AVAIL" "${_ram_note:-}"
     fi
 
     _shown_model="$LLM_MODEL"
```

**File**: `ods/tests/ci-suite.txt` (modified, +1/-0)
```diff
@@ -204,6 +204,7 @@ tests/test-windows-stop-native-helpers.sh
 tests/test-windows-whisper-compose-fallback.sh
 tests/test-wsl-bind-recovery-live.py
 tests/test-wsl-docker-desktop-nvidia.sh
+tests/test-wsl-hardware-display.sh
 tests/test-wsl-host-ram-fallback.sh
 tests/test-wsl-nvidia-detection.sh
 tests/test-wsl-runtime-proof.py
```

**File**: `ods/tests/test-wsl-hardware-display.sh` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+#!/usr/bin/env bash
+# The installer's hardware summary must not read as a detection error on
+# Windows (#7311): VRAM rounds to the nearest GB (a 24GB card reports about
+# 24564MiB), and the WSL RAM limit is named next to the RAM figure. The
+# Linux-only NVIDIA Blackwell module check is skipped under WSL, where the
+# Windows driver serves the GPU.
+set -euo pipefail
+
+ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
+fail() { echo "FAIL: $1"; exit 1; }
+
+extract() {
+    awk -v signature="$1() {" '$0 == signature { f = 1 } f { print } f && $0 == "}" { exit }' "$2"
+}
+
+summary="$(extract show_hardware_summary "$ROOT/installers/lib/ui.sh")"
+[[ -n "$summary" ]] || fail "show_hardware_summary was not found"
+eval "$summary"
+GRN="" NC="" BGRN=""
+
+out="$(show_hardware_summary "NVIDIA RTX 3090 Ti" "24" "Ryzen 9" "46" "500" "WSL limit; Windows has 96GB")"
+grep -qF "46GB (WSL limit; Windows has 96GB)" <<< "$out" || fail "the WSL RAM note is missing: $out"
+out="$(show_hardware_summary "NVIDIA RTX 3090 Ti" "24" "Ryzen 9" "64" "500")"
+grep -qE 'RAM: +64GB +\|' <<< "$out" || fail "RAM without a note changed: $out"
+
+grep -qF 'show_hardware_summary "$GPU_NAME" "$(( (GPU_VRAM + 512) / 1024 ))"' \
+    "$ROOT/installers/phases/02-detection.sh" \
+    || fail "the GPU summary must round VRAM to the nearest GB"
+grep -qF '"$DISK_AVAIL" "${_ram_note:-}"' "$ROOT/installers/phases/02-detection.sh" \
+    || fail "the hardware summary must receive the WSL RAM note"
+
+check="$(extract validate_nvidia_blackwell_open_modules "$ROOT/installers/lib/detection.sh")"
+[[ -n "$check" ]] || fail "validate_nvidia_blackwell_open_modules was not found"
+eval "$check"
+
+ods_is_wsl_host() { return 0; }
+nvidia_blackwell_hardware_detected() { fail "the Blackwell module probe ran under WSL"; }
+validate_nvidia_blackwell_open_modules || fail "the Blackwell check failed under WSL"
+
+ods_is_wsl_host() { return 1; }
+probed=false
+nvidia_blackwell_hardware_detected() { probed=true; return 1; }
+validate_nvidia_blackwell_open_modules
+[[ "$probed" == true ]] || fail "the Blackwell check no longer runs on native Linux"
+
+echo "PASS: WSL hardware summary names the RAM limit, rounds VRAM, and skips the Linux Blackwell check"
```

---

### Incident Patch 13: `a924ed1b` (2026-10-05)
**Commit Message**: test(uninstall): configured macOS fixture, visible failures, and a no-.env case

make_install wrote no .env, so after this change every scenario took the
new no-.env path: Docker cleanup never ran, the ordering grep found no
`down` line, and pipefail ended the test silently (the macOS CI failure).
The fixture is now a configured install again, the two greps print their
FAIL instead of exiting, and a new scenario covers #7377 itself: native
retirement runs, Docker Compose is not called, and the tree is removed.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `ods/tests/test-macos-uninstall-launchagents.sh` (modified, +23/-2)
```diff
@@ -97,6 +97,8 @@ make_install() {
     cp "$ROOT_DIR/scripts/resolve-compose-stack.sh" "$install_dir/scripts/"
     touch "$install_dir/docker-compose.base.yml"
     printf '%s\n' '-f docker-compose.base.yml' > "$install_dir/.compose-flags"
+    # A configured install: the only state with destructive Docker cleanup.
+    printf '%s\n' 'WEBUI_SECRET=test-only' > "$install_dir/.env"
     mkdir -p "$install_dir/installers/macos/lib"
     cp "$ROOT_DIR/installers/macos/lib/pixel-native-uninstall.py" "$install_dir/installers/macos/lib/"
     touch "$install_dir/ods-cli"
@@ -168,8 +170,10 @@ main() {
     done
     pass "macOS uninstall boots out loaded agents and removes all ODS plists (incl. legacy)"
     local retire_line down_line
-    retire_line="$(grep -n '^native-retire$' "$TMP_DIR/out1.log.commands" | head -n 1 | cut -d: -f1)"
-    down_line="$(grep -n '^docker compose .* down --remove-orphans$' "$TMP_DIR/out1.log.commands" | head -n 1 | cut -d: -f1)"
+    # || true: under pipefail a missing line would end the test silently
+    # instead of printing the FAIL below.
+    retire_line="$(grep -n '^native-retire$' "$TMP_DIR/out1.log.commands" | head -n 1 | cut -d: -f1 || true)"
+    down_line="$(grep -n '^docker compose .* down --remove-orphans$' "$TMP_DIR/out1.log.commands" | head -n 1 | cut -d: -f1 || true)"
     [[ -n "$retire_line" && -n "$down_line" && "$retire_line" -lt "$down_line" ]] \
         || fail "native retirement must precede destructive Docker cleanup"
 
@@ -239,6 +243,23 @@ main() {
         fail "rejected retirement must not mutate Docker resources"
     fi
     pass "native retirement failure retains the install, agents and Docker resources"
+
+    # An install that stopped before .env was written (#7377): native
+    # retirement still runs, Docker is not touched, and the tree is removed.
+    local install7="$TMP_DIR/install7" home7="$TMP_DIR/home7"
+    make_install "$install7"
+    rm -f "$install7/.env"
+    mkdir -p "$home7/Library/LaunchAgents"
+    LAUNCHCTL_LOG="$TMP_DIR/launchctl7.log" \
+        run_uninstall "$install7" "$home7" "$stub_dir" "$TMP_DIR/out7.log" \
+        || { cat "$TMP_DIR/out7.log" >&2; fail "uninstall without .env exited non-zero"; }
+    grep -qx 'native-retire' "$TMP_DIR/out7.log.commands" \
+        || fail "uninstall without .env skipped native retirement"
+    if grep -q '^docker compose ' "$TMP_DIR/out7.log.commands"; then
+        fail "uninstall without .env ran Docker Compose"
+    fi
+    [[ ! -e "$install7" ]] || fail "uninstall without .env left the install directory"
+    pass "an install without .env retires native services and is removed without Docker cleanup"
 }
 
 main "$@"
```

---

### Incident Patch 14: `b1f1663b` (2026-10-05)
**Commit Message**: fix(uninstall): probe a moved Windows runtime with round F's control keys only

Rebased onto main (round F renamed the transport keys). When routing is
unchanged, retirement keeps main's path and full environment, so the
endpoint keys still reach the bridge. Only a registered runtime whose
routing moved (an API or cloud route) is probed with a control-only
environment: ODS_HOST_LLM_TRANSPORT=model-router plus its one-release
alias, and the Windows directory and state root. The probe never writes
the .env.

Tests use round F's keys and check both spellings, the unowned refusal,
and that startup checks still get the installation's own values.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `ods/scripts/retire-wsl-runtime.py` (modified, +14/-9)
```diff
@@ -90,15 +90,20 @@ def retire(install_dir: Path, *, validate_only: bool = False) -> dict:
     if 'ODS_WINDOWS_SYSTEM_DIRECTORY' in values and not values['ODS_WINDOWS_SYSTEM_DIRECTORY']:
         raise ValueError('The registered Windows system directory is empty; restore it before uninstalling')
     managed = None
-    if registered or wsl_lemonade.candidate(values):
-        # Routing can change to direct/cloud while the owned Windows task
-        # remains registered. Retirement discovers custody from that task's
-        # user, distro, install root and immutable plan, not from the current
-        # inference endpoint. This is a control-only environment; never change
-        # the installation's routing or persist these values into its .env.
-        runtime_values = {key: value for key, value in values.items()
-                          if key in {'ODS_WINDOWS_SYSTEM_DIRECTORY', 'ODS_WSL_STATE_ROOT'}}
-        runtime_values['LEMONADE_HOST_TRANSPORT'] = 'model-router'
+    runtime_values = values
+    routed = wsl_lemonade.candidate(values)
+    if registered and not routed:
+        # Routing can move to an API or the cloud while the owned Windows task
+        # stays registered. Custody comes from that task's user, distro,
+        # install root and immutable plan, not from the current endpoint, so
+        # probe it with a control-only environment. Nothing here changes the
+        # installation's routing or is written to its .env.
+        runtime_values = _with_bridge_aliases({
+            **{key: values[key] for key in ('ODS_WINDOWS_SYSTEM_DIRECTORY', 'ODS_WSL_STATE_ROOT')
+               if key in values},
+            'ODS_HOST_LLM_TRANSPORT': 'model-router',
+        })
+    if routed or registered:
         managed = wsl_lemonade.status(root, runtime_values)
         if not managed['managed'] and registered:
             raise ValueError('The registered Windows runtime no longer belongs to this installation')
```

**File**: `ods/tests/test-retire-wsl-runtime.py` (modified, +22/-24)
```diff
@@ -139,46 +139,44 @@ def test_other_wsl_backends_only_retire_their_startup_task(self):
         self.assertEqual(self.disable_startup.call_count, 2)
 
     def test_registered_runtime_is_verified_after_routing_changes(self):
+        # An API or cloud route leaves the owned Windows task registered.
+        # Custody is proven from the task with a control-only environment;
+        # startup checks still get the installation's own values.
         (self.root / 'data').mkdir()
         (self.root / 'data/wsl-lemonade-runtime.json').write_text('{}')
         self.candidate.return_value = False
-        for transport in ('direct', 'cloud', ''):
-            content = ('LEMONADE_HOST_TRANSPORT=' + transport + '\n'
-                       'ODS_WINDOWS_SYSTEM_DIRECTORY="C:\\Windows\\System32"\n'
-                       'LEMONADE_BASE_URL=\nLEMONADE_CONTAINER_BASE_URL=https://example.com/api\n'
-                       'AMD_INFERENCE_PORT=\n')
-            (self.root / '.env').write_text(content)
-            with self.subTest(transport=transport):
-                self.assertEqual(helper.retire(self.root, validate_only=True)['state'], 'validated')
-                self.status.assert_called_with(self.root, ENV)
-                self.stop.assert_not_called()
-                self.assertEqual(helper.retire(self.root)['state'], 'retired')
-                self.stop.assert_called_once_with(self.root, ENV, 'a' * 64)
-                self.assertEqual((self.root / '.env').read_text(), content)
-                self.stop.reset_mock()
+        for key in ('ODS_HOST_LLM_TRANSPORT', 'LEMONADE_HOST_TRANSPORT'):
+            for transport in ('direct', 'cloud', ''):
+                content = (key + '=' + transport + '\n'
+                           'ODS_WINDOWS_SYSTEM_DIRECTORY="C:\\Windows\\System32"\n'
+                           'NATIVE_LLM_BASE_URL=\nNATIVE_LLM_CONTAINER_BASE_URL=https://example.com/api\n'
+                           'AMD_INFERENCE_PORT=\n')
+                (self.root / '.env').write_text(content)
+                with self.subTest(key=key, transport=transport):
+                    self.assertEqual(helper.retire(self.root, validate_only=True)['state'], 'validated')
+                    self.status.assert_called_with(self.root, ENV)
+                    self.stop.assert_not_called()
+                    self.assertEqual(helper.retire(self.root)['state'], 'retired')
+                    self.stop.assert_called_once_with(self.root, ENV, 'a' * 64)
+                    self.assertEqual(self.disable_startup.call_args.args[1][key], transport)
+                    self.assertEqual((self.root / '.env').read_text(), content)
+                    self.stop.reset_mock()
 
     def test_changed_routing_does_not_allow_unowned_registered_runtime(self):
         (self.root / 'data').mkdir()
         (self.root / 'data/wsl-lemonade-runtime.json').write_text('{}')
-        (self.root / '.env').write_text('LEMONADE_HOST_TRANSPORT=direct\n')
+        (self.root / '.env').write_text('ODS_HOST_LLM_TRANSPORT=direct\n')
         self.candidate.return_value = False
         for result in ({'managed': False}, OSError('foreign Windows task')):
             self.status.side_effect = result if isinstance(result, Exception) else None
             self.status.return_value = result
             with self.subTest(result=result), self.assertRaises((ValueError, OSError)):
                 helper.retire(self.root)
-        self.status.assert_called_with(self.root, {'LEMONADE_HOST_TRANSPORT': 'model-router'})
+        self.status.assert_called_with(self.root, {'ODS_HOST_LLM_TRANSPORT': 'model-router',
+                                                   'LEMONADE_HOST_TRANSPORT': 'model-router'})
         self.disable_startup.assert_not_called()
         self.stop.assert_not_called()
 
-    def test_retirement_ignores_changed_endpoints_for_owned_runtime_only(self):
-        with (self.root / '.env').open('a') as stream:
-            stream.write('LEMONADE_BASE_URL=https://example.com/api\nAMD_INFERENCE_PORT=\n')
-        helper.retire(self.root)
-        self.status.assert_called_once_with(self.root, ENV)
-        self.stop.assert_called_once_with(self.root, ENV, 'a' * 64)
-        self.assertEqual(self.disable_startup.call_args.args[1]['LEMONADE_BASE_URL'], 'https://example.com/api')
-
     def test_non_wsl_backends_do_not_even_read_configuration(self):
         for system, release in (('Darwin', '25'), ('Windows', '11'), ('Linux', '6.8')):
             with self.subTest(system=system), patch.object(helper.platform, 'system', return_value=system), \
```

---

### Incident Patch 15: `20ae5569` (2026-10-05)
**Commit Message**: Merge remote-tracking branch 'origin/main' into fix/wsl-uninstall-registered-transport

**File**: `.gitattributes` (modified, +10/-0)
```diff
@@ -1,3 +1,10 @@
+# Every text file is LF in the repository, in checkouts and in `git archive`
+# output, whatever the local core.autocrlf says. Git for Windows defaults to
+# core.autocrlf=true, which turned Python, JavaScript and other unpinned files
+# into CRLF in Windows checkouts and archives, so they no longer matched the
+# bytes users download. The rules below override this one where needed.
+* text=auto eol=lf
+
 # Force LF line endings for all shell scripts and Docker-mounted files.
 # Windows Git's core.autocrlf converts LF→CRLF on checkout, which breaks
 # shell shebangs inside Linux Docker containers (kernel reads #!/bin/sh\r
@@ -31,3 +38,6 @@ ods/tests/fixtures/amd/*.txt -whitespace
 
 # Recorded preview pages reproduce a published snapshot digest byte for byte.
 ods/tests/fixtures/preview-inspection-laptop-round*.html -text -whitespace
+
+# Exact third-party Vane bundle fixture is hash-bound and not a reviewable diff.
+ods/tests/fixtures/vane-v1.12.2-*.js -text -diff
```

**File**: `.github/dependabot.yml` (modified, +0/-34)
```diff
@@ -10,40 +10,6 @@ updates:
         patterns:
           - "*"
 
-  - package-ecosystem: "npm"
-    directory: "/installer"
-    schedule:
-      interval: "weekly"
-    open-pull-requests-limit: 1
-    groups:
-      installer-npm:
-        patterns:
-          - "*"
-        update-types:
-          - "minor"
-          - "patch"
-    ignore:
-      - dependency-name: "*"
-        update-types:
-          - "version-update:semver-major"
-
-  - package-ecosystem: "cargo"
-    directory: "/installer/src-tauri"
-    schedule:
-      interval: "weekly"
-    open-pull-requests-limit: 1
-    groups:
-      tauri-cargo:
-        patterns:
-          - "*"
-        update-types:
-          - "minor"
-          - "patch"
-    ignore:
-      - dependency-name: "*"
-        update-types:
-          - "version-update:semver-major"
-
   - package-ecosystem: "npm"
     directory: "/ods/extensions/services/dashboard"
     schedule:
```

**File**: `.github/mypy-baseline.json` (added, +282/-0)
```diff
@@ -0,0 +1,282 @@
+{
+ "dashboard-api": {
+  "agent_monitor.py [assignment] Incompatible types in assignment (expression has type \"tuple[Any, Any]\", variable has type \"None\")": 1,
+  "agent_monitor.py [var-annotated] Need type annotation for \"observation\" (hint: \"observation: dict[<type>, <type>] = ...\")": 1,
+  "config.py [assignment] Incompatible types in assignment (expression has type \"Iterator[Never]\", variable has type \"Generator[Any, None, None]\")": 1,
+  "config.py [var-annotated] Need type annotation for \"DEFAULT_WORKFLOW_CATALOG\"": 1,
+  "config.py [var-annotated] Need type annotation for \"memo\" (hint: \"memo: dict[<type>, <type>] = ...\")": 1,
+  "extension_github.py [assignment] Incompatible types in assignment (expression has type \"float\", variable has type \"int\")": 2,
+  "extension_github.py [var-annotated] Need type annotation for \"_CACHE\"": 1,
+  "extension_github.py [var-annotated] Need type annotation for \"_INFLIGHT\" (hint: \"_INFLIGHT: dict[<type>, <type>] = ...\")": 1,
+  "extension_install_plan.py [var-annotated] Need type annotation for \"visited\" (hint: \"visited: set[<type>] = ...\")": 1,
+  "extension_install_plan.py [var-annotated] Need type annotation for \"visiting\" (hint: \"visiting: set[<type>] = ...\")": 1,
+  "extension_integration.py [assignment] Incompatible types in assignment (expression has type \"int\", target has type \"str\")": 1,
+  "extension_recipe_validation.py [var-annotated] Need type annotation for \"errors\" (hint: \"errors: list[<type>] = ...\")": 1,
+  "gpu.py [arg-type] Argument \"memory_usage_available\" to \"GPUInfo\" has incompatible type \"object\"; expected \"bool\"": 1,
+  "gpu.py [arg-type] Argument \"name\" to \"GPUInfo\" has incompatible type \"object\"; expected \"str\"": 1,
+  "gpu.py [arg-type] Argument \"power_w\" to \"GPUInfo\" has incompatible type \"object\"; expected \"float\"": 1,
+  "gpu.py [arg-type] Argument \"temperature_available\" to \"GPUInfo\" has incompatible type \"object\"; expected \"bool\"": 1,
+  "gpu.py [arg-type] Argument \"temperature_c\" to \"GPUInfo\" has incompatible type \"object\"; expected \"int\"": 2,
+  "gpu.py [arg-type] Argument \"utilization_available\" to \"GPUInfo\" has incompatible type \"object\"; expected \"bool\"": 1,
+  "gpu.py [arg-type] Argument \"utilization_percent\" to \"GPUInfo\" has incompatible type \"object\"; expected \"int\"": 1,
+  "gpu.py [arg-type] Argument 1 to \"join\" of \"str\" has incompatible type \"list[object]\"; expected \"Iterable[str]\"": 1,
+  "gpu.py [arg-type] Argument 1 to \"sum\" has incompatible type \"list[object]\"; expected \"Iterable[bool]\"": 1,
+  "gpu.py [assignment] Incompatible types in assignment (expression has type \"object\", variable has type \"int\")": 1,
+  "gpu.py [attr-defined] Module has no attribute \"binascii\"": 1,
+  "gpu.py [misc] Generator has incompatible item type \"object\"; expected \"bool\"": 3,
+  "gpu.py [type-var] Value of type variable \"SupportsRichComparisonT\" of \"max\" cannot be \"object\"": 1,
+  "helpers.py [assignment] Incompatible types in assignment (expression has type \"float\", target has type \"None\")": 7,
+  "helpers.py [assignment] Incompatible types in assignment (expression has type \"int\", target has type \"None\")": 2,
+  "helpers.py [attr-defined] \"Callable[[], dict[Any, Any]]\" has no attribute \"_prev\"": 3,
+  "helpers.py [attr-defined] \"None\" has no attribute \"get\"": 1,
+  "helpers.py [attr-defined] Module has no attribute \"windll\"": 1,
+  "helpers.py [valid-type] Function \"builtins.any\" is not valid as a type": 2,
+  "helpers.py [var-annotated] Need type annotation for \"_llama_metrics_sample\" (hint: \"_llama_metrics_sample: dict[<type>, <type>] = ...\")": 1,
+  "helpers.py [var-annotated] Need type annotation for \"_prev_tokens\" (hint: \"_prev_tokens: dict[<type>, <type>] = ...\")": 1,
+  "host_metrics.py [assignment] Incompatible types in assignment (expression has type \"dict[str, Any]\", target has type \"list[Any]\")": 1,
+  "host_metrics.py [assignment] Incompatible types in assignment (expression has type \"tuple[float, dict[str, dict[str, str]]]\", variable has type \"tuple[float, None]\")": 1,
+  "host_metrics.py [assignment] Incompatible types in assignment (expression has type \"tuple[float, dict[str, list[Any]]]\", variable has type \"tuple[float, None]\")": 1,
+  "host_metrics.py [call-overload] No overload variant of \"__setitem__\" of \"list\" matches argument types \"str\", \"None\"": 1,
+  "host_metrics.py [dict-item] Dict entry 1 has incompatible type \"str\": \"int\"; expected \"str\": \"str\"": 1,
+  "host_metrics.py [var-annotated] Need type annotation for \"result\"": 1,
+  "main.py [arg-type] Argument 1 to \"_serialize_services\" has incompatible type \"object\"; expected \"list[ServiceStatus]\"": 1,
+  "main.py [arg-type] Argument 2 to \"_serialize_services\" has incompatible type \"object\"; expected \"int\"": 1,
+  "main.py [attr-defined] \"Sequence[st
```

**File**: `.github/scripts/anthropic_helper.py` (removed, +0/-77)
```diff
@@ -1,77 +0,0 @@
-#!/usr/bin/env python3
-"""
-Shared helper for Anthropic API authentication.
-
-Provides a unified `create_message()` function using the Anthropic Python SDK.
-Used by scanner scripts: generate-type-hints.py, generate-docstrings.py
-"""
-
-import os
-import sys
-from dataclasses import dataclass, field
-from typing import Any
-
-
-@dataclass
-class Usage:
-    input_tokens: int
-    output_tokens: int
-
-
-@dataclass
-class ContentBlock:
-    type: str
-    text: str = ""
-
-
-@dataclass
-class MessageResponse:
-    """Minimal response object matching anthropic.Message interface used by scanner scripts."""
-
-    content: list[ContentBlock] = field(default_factory=list)
-    usage: Usage = field(default_factory=lambda: Usage(0, 0))
-
-
-def create_message(
-    *,
-    model: str,
-    max_tokens: int,
-    temperature: float,
-    messages: list[dict[str, Any]],
-    thinking: dict[str, Any] | None = None,
-) -> MessageResponse:
-    """Create a message using the Anthropic API."""
-    import anthropic
-
-    api_key = os.getenv("ANTHROPIC_API_KEY")
-    if not api_key:
-        print(
-            "::error::No API credentials. Set ANTHROPIC_API_KEY",
-            file=sys.stderr,
-        )
-        sys.exit(1)
-
-    client = anthropic.Anthropic(api_key=api_key)
-
-    kwargs: dict[str, Any] = dict(model=model, max_tokens=max_tokens, messages=messages)
-    if thinking:
-        kwargs["thinking"] = thinking
-        kwargs["temperature"] = 1
-    else:
-        kwargs["temperature"] = temperature
-
-    response = client.messages.create(**kwargs)
-
-    content_blocks = [
-        ContentBlock(type="text", text=block.text)
-        for block in response.content
-        if block.type == "text"
-    ]
-
-    return MessageResponse(
-        content=content_blocks,
-        usage=Usage(
-            input_tokens=response.usage.input_tokens,
-            output_tokens=response.usage.output_tokens,
-        ),
-    )
```

**File**: `.github/scripts/apply-docstrings.py` (removed, +0/-224)
```diff
@@ -1,224 +0,0 @@
-#!/usr/bin/env python3
-"""
-Apply Docstrings from suggestions JSON to source files.
-
-Reads /tmp/documentation-suggestions.json (generated by generate-docstrings.py),
-inserts Google-style docstrings into source files using AST-based function lookup.
-
-Safety: validates each file with py_compile after modification; reverts on failure.
-"""
-
-import ast
-import json
-import py_compile
-import sys
-from pathlib import Path
-
-PROTECTED_PATTERNS = [
-    ".github/workflows/",
-    ".env",
-    "ods/installers/",
-    "ods/ods-cli",
-    "ods/config/",
-]
-
-
-def is_protected(file_path: str) -> bool:
-    """Check if a file path matches any protected patterns."""
-    for pattern in PROTECTED_PATTERNS:
-        if file_path.startswith(pattern) or f"/{pattern}" in file_path:
-            return True
-    return False
-
-
-def find_function_info(source: str, function_name: str) -> dict | None:
-    """Use AST to find function line and check if it already has a docstring."""
-    try:
-        tree = ast.parse(source)
-    except SyntaxError:
-        return None
-
-    for node in ast.walk(tree):
-        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
-            if node.name == function_name:
-                has_docstring = ast.get_docstring(node) is not None
-                return {
-                    "lineno": node.lineno,
-                    "has_docstring": has_docstring,
-                    "body_start": node.body[0].lineno if node.body else node.lineno + 1,
-                }
-    return None
-
-
-def find_def_end_line(lines: list[str], start_idx: int) -> int:
-    """Find the 0-based index of the last line of a def statement."""
-    depth = 0
-    for i in range(start_idx, len(lines)):
-        line = lines[i]
-        depth += line.count("(") - line.count(")")
-        if depth <= 0 and ":" in line:
-            stripped = line.rstrip()
-            if stripped.endswith(":"):
-                return i
-            colon_pos = stripped.rfind(":")
-            if colon_pos >= 0:
-                return i
-    return start_idx
-
-
-def get_body_indent(lines: list[str], def_end_idx: int) -> str:
-    """Determine the indentation level of the function body."""
-    for i in range(def_end_idx + 1, min(def_end_idx + 5, len(lines))):
-        line = lines[i]
-        stripped = line.strip()
-        if stripped and not stripped.startswith("#"):
-            return line[: len(line) - len(line.lstrip())]
-
-    def_line = lines[def_end_idx] if def_end_idx < len(lines) else ""
-    def_indent = def_line[: len(def_line) - len(def_line.lstrip())]
-    return def_indent + "    "
-
-
-def format_docstring(docstring: str, indent: str) -> list[str]:
-    """Format a docstring with proper indentation as lines to insert."""
-    doc_lines = docstring.split("\n")
-
-    if len(doc_lines) == 1:
-        return [f'{indent}"""{doc_lines[0]}"""\n']
-
-    result = [f'{indent}"""{doc_lines[0]}\n']
-    for line in doc_lines[1:]:
-        if line.strip():
-            result.append(f"{indent}{line}\n")
-        else:
-            result.append("\n")
-    result.append(f'{indent}"""\n')
-    return result
-
-
-def apply_docstrings(suggestions_path: str) -> dict:
-    """Apply generated docstring suggestions to Python source files."""
-    with open(suggestions_path, "r") as f:
-        data = json.load(f)
-
-    functions = data.get("functions_documented", [])
-    if not functions:
-        print("No docstring suggestions to apply.")
-        return {
-            "files_modified": 0,
-            "docstrings_inserted": 0,
-            "files_reverted": 0,
-            "skipped_existing": 0,
-        }
-
-    by_file: dict[str, list] = {}
-    for func in functions:
-        file_path = func.get("file", "")
-        if not file_path:
-            continue
-        if is_protected(file_path):
-            print(f"  Skipping protected file: {file_path}")
-            continue
-        if not Path(file_path).exists():
-            print(f"  Skipping missing file: {file_path}")
-            continue
-        by_file.setdefault(file_path, []).append(func)
-
-    files_modified = 0
-    docstrings_inserted = 0
-    files_reverted = 0
-    skipped_existing = 0
-
-    for file_path, file_funcs in by_file.items():
-        print(f"\nProcessing {file_path} ({len(file_funcs)} functions)...")
-
-        original_content = Path(file_path).read_text()
-        source = original_content
-        lines = source.splitlines(keepends=True)
-
-        located = []
-        for func in file_funcs:
-            info = find_function_info(source, func["function"])
-            if info is None:
-                print(
-                    f"  Could not find function '{func['function']}' in AST, skipping"
-                )
-                continue
-            if info["has_docstring"]:
-                print(
-                    f"  Function '{func['function']}' already has docstring, skipping"
-          
```

**File**: `.github/scripts/apply-type-hints.py` (removed, +0/-245)
```diff
@@ -1,245 +0,0 @@
-#!/usr/bin/env python3
-"""
-Apply Type Hints from suggestions JSON to source files.
-
-Reads /tmp/type-hints-suggestions.json (generated by generate-type-hints.py),
-applies typed signatures to source files using AST-based function lookup.
-
-Safety: validates each file with py_compile after modification; reverts on failure.
-"""
-
-import ast
-import json
-import py_compile
-import sys
-from pathlib import Path
-
-PROTECTED_PATTERNS = [
-    ".github/workflows/",
-    ".env",
-    "ods/installers/",
-    "ods/ods-cli",
-    "ods/config/",
-]
-
-
-def is_protected(file_path: str) -> bool:
-    """Check if a file path matches any protected patterns."""
-    for pattern in PROTECTED_PATTERNS:
-        if file_path.startswith(pattern) or f"/{pattern}" in file_path:
-            return True
-    return False
-
-
-def find_function_line(source: str, function_name: str) -> int | None:
-    """Use AST to find the actual line number of a function by name."""
-    try:
-        tree = ast.parse(source)
-    except SyntaxError:
-        return None
-
-    for node in ast.walk(tree):
-        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
-            if node.name == function_name:
-                return node.lineno
-    return None
-
-
-def find_def_end_line(lines: list[str], start_idx: int) -> int:
-    """Find the line index where a def statement ends (the line with the colon)."""
-    depth = 0
-    for i in range(start_idx, len(lines)):
-        line = lines[i]
-        depth += line.count("(") - line.count(")")
-        if depth <= 0 and ":" in line:
-            stripped = line.rstrip()
-            if stripped.endswith(":"):
-                return i
-            colon_pos = stripped.rfind(":")
-            if colon_pos >= 0:
-                return i
-    return start_idx
-
-
-def get_existing_imports(source: str) -> set[str]:
-    """Extract all existing import statements from source."""
-    imports = set()
-    for line in source.splitlines():
-        stripped = line.strip()
-        if stripped.startswith("import ") or stripped.startswith("from "):
-            imports.add(stripped)
-    return imports
-
-
-def find_last_import_line(lines: list[str]) -> int:
-    """Find the 0-based index of the last import line in the file."""
-    last_import = -1
-    for i, line in enumerate(lines):
-        stripped = line.strip()
-        if stripped.startswith("import ") or stripped.startswith("from "):
-            last_import = i
-    return last_import
-
-
-def normalize_import(imp: str) -> list[str]:
-    """Normalize an import statement."""
-    return [imp.strip()]
-
-
-def apply_type_hints(suggestions_path: str) -> dict:
-    """Apply generated type hint suggestions to Python function signatures."""
-    with open(suggestions_path, "r") as f:
-        data = json.load(f)
-
-    functions = data.get("functions_annotated", [])
-    if not functions:
-        print("No type hint suggestions to apply.")
-        return {"files_modified": 0, "functions_applied": 0, "files_reverted": 0}
-
-    by_file: dict[str, list] = {}
-    for func in functions:
-        file_path = func.get("file", "")
-        if not file_path:
-            continue
-        if is_protected(file_path):
-            print(f"  Skipping protected file: {file_path}")
-            continue
-        if not Path(file_path).exists():
-            print(f"  Skipping missing file: {file_path}")
-            continue
-        by_file.setdefault(file_path, []).append(func)
-
-    files_modified = 0
-    functions_applied = 0
-    files_reverted = 0
-
-    for file_path, file_funcs in by_file.items():
-        print(f"\nProcessing {file_path} ({len(file_funcs)} functions)...")
-
-        original_content = Path(file_path).read_text()
-        source = original_content
-        lines = source.splitlines(keepends=True)
-
-        located = []
-        for func in file_funcs:
-            actual_line = find_function_line(source, func["function"])
-            if actual_line is None:
-                print(
-                    f"  Could not find function '{func['function']}' in AST, skipping"
-                )
-                continue
-            located.append((actual_line, func))
-
-        located.sort(key=lambda x: x[0], reverse=True)
-
-        applied_in_file = 0
-        for actual_line, func in located:
-            typed_sig = func.get("typed_signature", "").strip()
-            if not typed_sig:
-                continue
-
-            start_idx = actual_line - 1
-            if start_idx >= len(lines) or start_idx < 0:
-                continue
-
-            end_idx = find_def_end_line(lines, start_idx)
-
-            current_line = lines[start_idx]
-            indent = current_line[: len(current_line) - len(current_line.lstrip())]
-
-            current_stripped = current_line.lstrip()
-            is_async = current_stripped.startswith("async ")
-
-            typed_stripped = typed_sig.lstrip()
-     
```

**File**: `.github/scripts/check-commit-identities.py` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+#!/usr/bin/env python3
+"""Reject placeholder or machine-local git identities on the commits a PR adds.
+
+  check-commit-identities.py BASE HEAD
+
+Every author and committer must have a name that is not a template placeholder
+("User Name") and an email on a real domain: not a reserved example domain
+(RFC 2606, RFC 6761), and not a machine-local name such as `portal@local`,
+`root@DESKTOP-ABC1234` or `me@laptop.local`. GitHub noreply addresses are fine.
+"""
+import subprocess
+import sys
+
+PLACEHOLDER_NAMES = {'user name', 'your name', 'name', 'user', 'root', 'unknown', 'username'}
+# Final labels that never belong to a deliverable mail domain.
+LOCAL_SUFFIXES = {'example', 'invalid', 'localhost', 'test', 'local', 'localdomain', 'lan', 'internal', 'home'}
+EXAMPLE_DOMAINS = {'example.com', 'example.net', 'example.org'}
+
+
+def problem(name, email):
+    """Return why an identity is not acceptable, or None."""
+    if name.strip().lower() in PLACEHOLDER_NAMES:
+        return f'placeholder name "{name}"'
+    _, at, domain = email.strip().rpartition('@')
+    domain = domain.lower().rstrip('.')
+    if not at or '.' not in domain:
+        return f'email "{email}" has no real domain'
+    labels = domain.split('.')
+    if labels[-1] in LOCAL_SUFFIXES or domain.endswith('.home.arpa'):
+        return f'email "{email}" uses a machine-local or reserved domain'
+    if '.'.join(labels[-2:]) in EXAMPLE_DOMAINS:
+        return f'email "{email}" uses a reserved example domain'
+    return None
+
+
+def commits(base, head):
+    output = subprocess.run(
+        ['git', 'log', '--format=%H%x00%an%x00%ae%x00%cn%x00%ce', f'{base}..{head}'],
+        check=True, capture_output=True, text=True).stdout
+    for line in output.splitlines():
+        sha, author, author_email, committer, committer_email = line.split('\0')
+        yield sha, (('author', author, author_email), ('committer', committer, committer_email))
+
+
+def main():
+    if len(sys.argv) != 3:
+        raise SystemExit(__doc__)
+    base, head = sys.argv[1:]
+    failures = checked = 0
+    for sha, roles in commits(base, head):
+        checked += 1
+        for role, name, email in roles:
+            reason = problem(name, email)
+            if reason:
+                failures += 1
+                print(f'::error::{sha[:12]} {role} {name} <{email}>: {reason}')
+    if failures:
+        print(f'{failures} placeholder or machine-local identities in {checked} commits.\n'
+              'Set a real identity (your GitHub noreply address works):\n'
+              '  git config user.name "Your Real Name"\n'
+              '  git config user.email "ID+LOGIN@users.noreply.github.com"\n'
+              f'then rewrite this branch\'s commits and force-push:\n'
+              f'  git rebase -r {base[:12]} --exec "git commit --amend --no-edit --reset-author"')
+        return 1
+    print(f'[PASS] {checked} commits have real author and committer identities')
+    return 0
+
+
+if __name__ == '__main__':
+    raise SystemExit(main())
```

**File**: `.github/scripts/check-upstream-advisories.py` (added, +174/-0)
```diff
@@ -0,0 +1,174 @@
+#!/usr/bin/env python3
+"""Report advisories that affect the upstream versions ODS pins.
+
+Each pin is read from the file that sets it; a pin that can no longer be found
+fails the check, so the watch cannot silently stop covering a product. Two
+sources are combined: the reviewed GitHub Advisory Database, and the upstream
+repository's own published advisories, which can precede that review by weeks.
+
+  check-upstream-advisories.py                 print a Markdown report
+  check-upstream-advisories.py --fail-on high  exit 1 if any high or critical
+                                               advisory affects a pinned version
+"""
+import json
+import os
+import re
+import sys
+import urllib.parse
+import urllib.request
+from pathlib import Path
+
+ROOT = Path(__file__).resolve().parents[2]
+PINS = [
+    # (product, file, regex for the version, ecosystem, package, upstream repository)
+    ('Open WebUI (core chat UI)', 'ods/docker-compose.base.yml',
+     r'ghcr\.io/open-webui/open-webui:v([0-9][0-9.]*)@', 'pip', 'open-webui', 'open-webui/open-webui'),
+    ('n8n (optional workflows)', 'ods/extensions/services/n8n/compose.yaml',
+     r'n8nio/n8n:([0-9][0-9.]*)@', 'npm', 'n8n', 'n8n-io/n8n'),
+    ('LiteLLM (optional gateway)', 'ods/extensions/services/litellm/compose.yaml',
+     r'ghcr\.io/berriai/litellm:v([0-9][0-9.]*)', 'pip', 'litellm', 'BerriAI/litellm'),
+    ('OpenClaw (Pixel runtime)', 'ods/vendor/pixel/OPENCLAW-COMPATIBILITY.json',
+     r'"openclaw":\s*"([0-9][0-9.]*)"', 'npm', 'openclaw', 'openclaw/openclaw'),
+    ('OpenCode (macOS install)', 'ods/installers/macos/lib/constants.sh',
+     r'OPENCODE_VERSION="([0-9][0-9.]*)"', 'npm', 'opencode-ai', None),
+]
+SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'unknown']
+LISTED_PER_PRODUCT = 30  # keeps the tracking issue under GitHub's body size limit
+
+
+def pinned_version(path, pattern):
+    match = re.search(pattern, (ROOT / path).read_text(encoding='utf-8'))
+    if not match:
+        raise SystemExit(f'Pin not found in {path} (pattern {pattern}); update {Path(__file__).name}')
+    return match.group(1)
+
+
+def get_all(url):
+    """GET every page; these endpoints page with cursors in the Link header."""
+    token = os.environ.get('GITHUB_TOKEN') or os.environ.get('GH_TOKEN')
+    items = []
+    while url:
+        request = urllib.request.Request(url, headers={
+            'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
+            **({'Authorization': f'Bearer {token}'} if token else {})})
+        with urllib.request.urlopen(request, timeout=30) as response:
+            items.extend(json.load(response))
+            links = re.findall(r'<([^>]+)>;\s*rel="next"', response.headers.get('Link', ''))
+        url = links[0] if links else None
+    return items
+
+
+def parse_version(text):
+    main, _, pre = text.strip().lstrip('v').partition('-')
+    return tuple(int(part) for part in re.findall(r'\d+', main)), pre
+
+
+def compare(left, right):
+    (ln, lp), (rn, rp) = left, right
+    width = max(len(ln), len(rn))
+    ln, rn = ln + (0,) * (width - len(ln)), rn + (0,) * (width - len(rn))
+    if ln != rn:
+        return (ln > rn) - (ln < rn)
+    if lp == rp:
+        return 0
+    if not lp or not rp:  # a release sorts after its pre-releases
+        return 1 if not lp else -1
+    return (lp > rp) - (lp < rp)
+
+
+CONSTRAINT = r'(<=|>=|<|>|=)?\s*v?([0-9][0-9A-Za-z.+-]*)'
+
+
+def in_range(version, spec):
+    """Evaluate a range such as '>= 2026.6.6, < 2026.8.1' (commas optional); None if unparseable."""
+    current = parse_version(version)
+    spec = spec.replace(',', ' ')
+    if not re.fullmatch(rf'\s*(?:{CONSTRAINT}\s*)+', spec):
+        return None
+    for match in re.finditer(CONSTRAINT, spec):
+        operator, bound = match.group(1) or '=', parse_version(match.group(2))
+        result = compare(current, bound)
+        if not {'<': result < 0, '<=': result <= 0, '>': result > 0,
+                '>=': result >= 0, '=': result == 0}[operator]:
+            return False
+    return True
+
+
+def repository_range_affects(version, vulnerability):
+    """Whether a repository advisory's range covers version; None if unparseable.
+
+    Some advisories put the range's upper bound in `patched_versions`, e.g.
+    vulnerable '>= 0.211.0' with patched '< 1.122.0'. A patched value that starts
+    with a comparison operator is read as part of the vulnerable range.
+    """
+    affected = in_range(version, vulnerability.get('vulnerable_version_range') or '')
+    patched = (vulnerability.get('patched_versions') or '').strip()
+    if affected and re.match(r'(<=|>=|<|>)', patched):
+        return in_range(version, patched)
+    return affected
+
+
+def collect(ecosystem, package, version, repository):
+    """Map GHSA id -> (severity, summary, url, fixed-in) from both sources."""
+    found, unparsed = {}, 0
+    query = urllib.parse.urlencode({'ecosystem':
```

#### Recent Merged Pull Requests:
- **PR #7389** (2026-10-06): Fix false show/hide requirements for static form content (@Lightheartdevs)
- **PR #7388** (2026-10-06): fix(cli): respect GPU_BACKEND when reporting GPU status (@NeoAiLabs)
- **PR #7387** (2026-10-05): Installer: Windows hardware summary reads true; skip the Linux NVIDIA check on WSL (@Lightheartdevs)
- **PR #7386** (2026-10-05): Models: a download blocked by the first full model says how to go on (@Lightheartdevs)
- **PR #7385** (2026-10-05): Restarts wait for the model gateway; macOS ods stop llama-server stops the model (@Lightheartdevs)
- **PR #7381** (2026-10-05): Round G: cloud and API mode on every platform; errors with causes, recovery and help links (@Lightheartdevs)
- **PR #7380** (2026-10-05): fix(macos): stop offering Hermes in the custom menu while Portal is on (@IronicRayquaza)
- **PR #7379** (2026-10-05): fix(uninstall): remove installs that stopped before .env was written (@IronicRayquaza)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
