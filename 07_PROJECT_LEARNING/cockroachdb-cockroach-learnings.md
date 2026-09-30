# Forensic Learning Record (Deep Inspection): cockroachdb/cockroach

> **Canonical Artifact**: `07_PROJECT_LEARNING/cockroachdb-cockroach-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cockroachdb/cockroach](https://github.com/cockroachdb/cockroach))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:25:53.590Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cockroachdb/cockroach`
- **Description**: CockroachDB — the cloud native, distributed SQL database designed for high availability, effortless scale, and control over data placement.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 32537 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/skills/drt-analyze/scripts/parse_events.py`
```
#!/usr/bin/env python3
# Copyright 2026 The Cockroach Authors.
#
# Use of this software is governed by the CockroachDB Software License
# included in the /LICENSE file.

"""Parse DRT operation events from Datadog MCP responses.

Usage:
  python3 scripts/parse_events.py run.json [cleanup.json] [failed.json] [depcheck.json]

Reads JSON files containing raw Datadog MCP event search responses and produces
a structured operations timeline. Each positional arg corresponds to:
  1. run events (phase:run)
  2. cleanup events (phase:cleanup)
  3. failed events (phase:run result:failed/panicked)
  4. dependency-check events (phase:dependency-check)

Output is a structured report to stdout with:
  - Summary stats (total ops, success/fail/panic counts, success rate)
  - Chronological timeline
  - Failure details
  - Disruptive operation windows (DISRUPTIVE_WINDOW lines for correlation)
"""

import json
import sys
import re
from datetime import datetime, timedelta, timezone

DISRUPTIVE_OPS = {
    "network-partition", "disk-stall", "license-throttle", "resize",
}


def is_disruptive(op_name: str) -> bool:
    """Check if an operation is disruptive (causes expected cluster impact)."""
    for prefix in DISRUPTIVE_OPS:
        if op_name.startswith(prefix):
            return True
    return False


def parse_timestamp(ts_str: str) -> datetime:
    """Parse various timestamp formats from Datadog events."""
    for fmt in [
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S.%f%z",
    ]:
        try:
            dt = datetime.strptime(ts_str, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    # Try epoch seconds/ms
    try:
        val = float(ts_str)
        if val > 1e12:
            val = val / 1000
        return datetime.fromtimestamp(val, tz=timezone.utc)
    except (ValueError, OSError):
        pass
    raise ValueError(f"Cannot parse timestamp: {ts_str}")


def extract_events(data):
    """Extract event list from various MCP response formats."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        # Try common MCP response shapes
        for key in ["events", "data", "results", "content"]:
            if key in data:
                val = data[key]
                if isinstance(val, list):
                    return val
                if isinstance(val, dict) and "events" in val:
                    return val["events"]
        # If it has text content, try to parse JSON from it
        if "text" in data:
            try:
                inner = json.loads(data["text"])
                return extract_events(inner)
            except (json.JSONDecodeError, TypeError):
                pass
    return []


def extract_field(event, field, default=""):
    """Extract a field from an event, checking tags and attributes."""
    if field in event:
        return event[field]
    for container in ["tags", "attributes"]:
        if container in event and isinstance(event[container], dict):
            if field in event[container]:
                return event[container][field]
    # Check tags as list of "key:value" strings
    if "tags" in event and isinstance(event["tags"], list):
        for tag in event["tags"]:
            if isinstance(tag, str) and tag.startswith(f"{field}:"):
                return tag.split(":", 1)[1]
    return default


def build_timeline(run_events, cleanup_events, failed_events, depcheck_events):
    """Build structured timeline from parsed events."""
    ops = []
    for ev in run_events:
        op = {
            "name": extract_field(ev, "operation", extract_field(ev, "title", "unknown")),
            "timestamp": extract_field(ev, "date_happened", extract_field(ev, "timestamp", "")),
            "worker": extract_field(ev, "worker", ""),
            "result": extract_field(ev, "result", "success"),
            "host": extract_field(ev, "host", ""),
        }
        ops.append(op)

    # Sort by timestamp
    for op in ops:
        try:
            op["_ts"] = parse_timestamp(str(op["timestamp"]))
        except ValueError:
            op["_ts"] = datetime.min.replace(tzinfo=timezone.utc)
    ops.sort(key=lambda x: x["_ts"])

    # Build cleanup lookup: operation_name -> cleanup timestamp
    cleanup_map = {}
    for ev in cleanup_events:
        name = extract_field(ev, "operation", extract_field(ev, "title", ""))
        ts = extract_field(ev, "date_happened", extract_field(ev, "timestamp", ""))
        result = extract_field(ev, "result", "success")
        if name:
            try:
                cleanup_map[name] = {
                    "timestamp": parse_timestamp(str(ts)),
                    "result": result,
                }
            except ValueError:
                pass

    # Count results
    total = len(ops)
    failed = sum(1 for o in ops if o["result"] in ("failed", "failure"))
    panicked = sum(1 for o in ops if o["result"] == "panicked")
    succeeded = total - failed - panicked
    rate = (succeeded / total * 100) if total > 0 else 0

    # Print summary
    print(f"## Operations Summary")
    print(f"Total: {total} | Success: {succeeded} | Failed: {failed} | "
          f"Panicked: {panicked} | Success rate: {rate:.1f}%")
    print()

    # Print timeline
    print("## Timeline")
    for op in ops:
        ts_str = op["_ts"].strftime("%H:%M:%S") if op["_ts"] != datetime.min.replace(tzinfo=timezone.utc) else "??:??:??"
        result_marker = "OK" if op["result"] in ("success", "succeeded") else op["result"].upper()
        print(f"  {ts_str} | {op['name']} | w={op['worker']} | {result_marker}")
    print()

    # Print failures
    fail_ops = [o for o in ops if o["result"] in ("failed", "failure", "panicked")]
    if fail_ops:
        print("## Failures")
        for op in fail_ops:
            ts_str = op["_ts"].strftime("%H:%M:%S")
            print(f"  {ts_str} | {op['name']} | {op['result']}")
        print()

    # Print failed events detail (from query 2)
    if failed_events:
        print("## Failure Details")
        for ev in failed_events:
            name = extract_field(ev, "operation", extract_field(ev, "title", "unknown"))
            text = extract_field(ev, "text", extract_field(ev, "message", ""))
            if text:
                # Truncate long error messages
                text = text[:200] + "..." if len(text) > 200 else text
            print(f"  {name}: {text}")
        print()

    # Print cleanup issues
    cleanup_failures = [ev for ev in cleanup_events
                        if extract_field(ev, "result", "") in ("failed", "failure")]
    if cleanup_failures:
        print("## Cleanup Failures")
        for ev in cleanup_failures:
            name = extract_field(ev, "operation", "unknown")
            print(f"  {name}: cleanup failed")
        print()

    # Print dependency check failures
    if depcheck_events:
        print("## Dependency Check Failures")
        for ev in depcheck_events:
            name = extract_field(ev, "operation", extract_field(ev, "title", "unknown"))
            text = extract_field(ev, "text", "")
            print(f"  {name}: {text[:150]}")
        print()

    # Print disruptive operation windows
    disruptive = [o for o in ops if is_disruptive(o["name"])]
    if disruptive:
        print("## Disruptive Operation Windows")
        for op in disruptive:
            cleanup = cleanup_map.get(op["name"])
            if cleanup:
                cleanup_end = cleanup["timestamp"]
            else:
                # Estimate: run_start + 5 minutes
                cleanup_end = op["_ts"] + timedelta(minutes=5)
            recovery_end = cleanup_end + timedelta(minutes=10)
            print(f"DISRUPTIVE_WINDOW: {op['name']} | "
                  f"{op['_ts'].isoformat()} | "
                  f"{cleanup_end.isoformat()} | "
  
```

### Core Architecture Module: `.claude/skills/engflow-artifacts/engflow_artifacts.py`
```
#!/usr/bin/env python3
# Copyright 2026 The Cockroach Authors.
#
# Use of this software is governed by the CockroachDB Software License
# included in the /LICENSE file.
"""
EngFlow artifact downloader.

Authentication (in priority order):
  1. mTLS certificates: set ENGFLOW_CERT_FILE and ENGFLOW_KEY_FILE env vars
  2. JWT from env: set ENGFLOW_TOKEN env var
  3. JWT from CLI: uses engflow_auth export (requires prior login)

Usage:
    # List all targets and their artifacts for an invocation
    python3 engflow_artifacts.py list <invocation_id> --target <target_label>

    # Download artifacts for a specific shard
    python3 engflow_artifacts.py download <invocation_id> --target <target> --shard N

    # Download a specific blob by hash/size
    python3 engflow_artifacts.py blob <hash> <size> [--outfile FILE]

    # Discover failed targets in an invocation
    python3 engflow_artifacts.py targets <invocation_id>
"""

import argparse
import json
import os
import re
import struct
import subprocess
import sys
import tempfile

# Generated from resultstore.proto — the reverse-engineered subset of
# EngFlow's internal ResultStore v1alpha API that we need for artifact
# downloading. See the proto file for field documentation.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import resultstore_pb2 as pb


ENGFLOW_HOST = "mesolite.cluster.engflow.com"
ENGFLOW_URL = f"https://{ENGFLOW_HOST}"
CAS_API = f"{ENGFLOW_URL}/api/contentaddressablestorage/v1/instances/default/blobs"
GRPC_URL = f"{ENGFLOW_URL}/engflow.resultstore.v1alpha.ResultStore"

# Artifact name mappings from EngFlow's internal names to user-facing names.
_ARTIFACT_NAMES = {
    "test.outputs__outputs.zip": "outputs.zip",
    "test.outputs_manifest__MANIFEST": "manifest",
}


def get_curl_auth_args():
    """Return curl arguments for EngFlow authentication.

    Tries, in order:
      1. mTLS — ENGFLOW_CERT_FILE and ENGFLOW_KEY_FILE env vars
      2. JWT from env — ENGFLOW_TOKEN env var
      3. JWT from CLI — engflow_auth export (interactive login required)
    """
    cert = os.environ.get("ENGFLOW_CERT_FILE")
    key = os.environ.get("ENGFLOW_KEY_FILE")
    if cert and key:
        return ["--cert", cert, "--key", key]

    token = os.environ.get("ENGFLOW_TOKEN")
    if not token:
        try:
            result = subprocess.run(
                ["engflow_auth", "export", ENGFLOW_HOST],
                capture_output=True, text=True,
            )
        except FileNotFoundError:
            print("Error: engflow_auth not found on PATH.", file=sys.stderr)
            print(
                "Install engflow_auth, or set ENGFLOW_TOKEN, or configure "
                "ENGFLOW_CERT_FILE and ENGFLOW_KEY_FILE.",
                file=sys.stderr,
            )
            sys.exit(1)

        if result.returncode != 0:
            print(
                f"Error: engflow_auth export failed: {result.stderr}",
                file=sys.stderr,
            )
            print(
                "Run: engflow_auth login mesolite.cluster.engflow.com",
                file=sys.stderr,
            )
            sys.exit(1)

        try:
            data = json.loads(result.stdout)
            token = data["token"]["access_token"]
        except (json.JSONDecodeError, KeyError):
            print(
                "Error: Failed to parse access token from engflow_auth output.",
                file=sys.stderr,
            )
            print(
                "Try running: engflow_auth login mesolite.cluster.engflow.com "
                "or set ENGFLOW_TOKEN directly.",
                file=sys.stderr,
            )
            sys.exit(1)

    return [
        "-H", "x-engflow-auth-method: jwt-v0",
        "-H", f"x-engflow-auth-token: {token}",
        "-H", f"Cookie: x-engflow-auth={token}",
    ]


def grpc_call(auth_args, method, proto_bytes):
    """Make a gRPC-web call via curl and return the response protobuf bytes.

    EngFlow's gRPC-web endpoint requires HTTP/2 — it serves the web UI HTML
    over HTTP/1.1. We use curl because it negotiates HTTP/2 via ALPN, while
    Python's requests/urllib only speak HTTP/1.1.

    The gRPC-web framing is a 5-byte header (1 byte flags + 4 byte big-endian
    length) around each protobuf message. Large responses may span multiple
    data frames; a trailer frame (flag 0x80) carries the gRPC status.
    """
    frame = struct.pack(">BI", 0, len(proto_bytes)) + proto_bytes
    url = f"{GRPC_URL}/{method}"

    with tempfile.NamedTemporaryFile(suffix=".bin", delete=False) as tmp:
        tmp.write(frame)
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            [
                "curl", "-s", "--data-binary", f"@{tmp_path}",
                "-H", "Content-Type: application/grpc-web+proto",
                "-H", "x-grpc-web: 1",
            ] + auth_args + [url],
            capture_output=True,
        )
    finally:
        os.unlink(tmp_path)

    data = result.stdout
    if result.returncode != 0 or len(data) < 5:
        print(f"gRPC call to {method} failed", file=sys.stderr)
        if result.stderr:
            print(f"  curl error: {result.stderr.decode()}", file=sys.stderr)
        return b""

    # Parse gRPC-web frames. Data frames have flag=0x00; the trailer
    # frame has flag=0x80. Large responses may span multiple data frames.
    payload = b""
    pos = 0
    while pos + 5 <= len(data):
        flag = data[pos]
        frame_len = struct.unpack(">I", data[pos + 1:pos + 5])[0]
        if flag == 0x80:
            trailer = data[pos + 5:pos + 5 + frame_len].decode(
                "utf-8", errors="replace",
            )
            if "grpc-status: 0" not in trailer and "grpc-status:0" not in trailer:
                print(f"gRPC error: {trailer}", file=sys.stderr)
                return b""
            break
        payload += data[pos + 5:pos + 5 + frame_len]
        pos += 5 + frame_len
    return payload


def download_blob(auth_args, blob_hash, blob_size, outfile):
    """Download a blob from the CAS API via curl."""
    url = f"{CAS_API}/{blob_hash}/{blob_size}"
    result = subprocess.run(
        ["curl", "-s"] + auth_args + ["-o", outfile, url],
        capture_output=True,
    )
    if result.returncode != 0:
        print(
            f"  Error downloading blob: {result.stderr.decode()}",
            file=sys.stderr,
        )
        return 0
    return os.path.getsize(outfile)


def get_target_labels_by_status(auth_args, instance, invocation_id, status_code):
    """Call GetTargetLabelsByStatus and return target labels.

    Status codes: 0x08 = passed, 0x09 = failed.
    """
    req = pb.GetTargetLabelsByStatusRequest(
        instance=instance,
        invocation_id=invocation_id,
        status=bytes([status_code]),
        limit=100,
    )
    resp_bytes = grpc_call(
        auth_args, "GetTargetLabelsByStatus", req.SerializeToString(),
    )
    if not resp_bytes:
        return []
    return parse_labels_response(resp_bytes)


def parse_target_response(resp_bytes):
    """Parse a GetTarget response into test actions keyed by (shard, run).

    Returns a dict mapping (shard_number, run_number) to a dict of artifacts:
      {(shard, run): {"test.xml": (hash, size), "test.log": (hash, size), ...}}
    Also returns (total_shards, total_entries) as a second value.
    """
    resp = pb.GetTargetResponse()
    resp.ParseFromString(resp_bytes)

    collection = resp.target.info.test_suite.test_actions
    actions = {}
    for action in collection.actions:
        shard_artifacts = {}
        data = action.data

        # test.xml from CompactDigest.
        if data.test_xml_digest.size_bytes > 0:
            shard_artifacts["test.xml"] = (
                data.test_xml_digest.hash.hex(),
                data.test_xml_digest.size_bytes,
            )

        # test.log.
        if data.test_log.bytestream_uri:
            blob_hash, size = _parse_bytestream_uri(
                data.test_log.bytestream_uri
```

### Core Architecture Module: `.claude/skills/engflow-artifacts/resultstore_pb2.py`
```
# Copyright 2026 The Cockroach Authors.
#
# Use of this software is governed by the CockroachDB Software License
# included in the /LICENSE file.
#
# -*- coding: utf-8 -*-
# Generated by the protocol buffer compiler.  DO NOT EDIT!
# NO CHECKED-IN PROTOBUF GENCODE
# source: resultstore.proto
# Protobuf Python Version: 5.29.1
"""Generated protocol buffer code."""
from google.protobuf import descriptor as _descriptor
from google.protobuf import descriptor_pool as _descriptor_pool
from google.protobuf import runtime_version as _runtime_version
from google.protobuf import symbol_database as _symbol_database
from google.protobuf.internal import builder as _builder
_runtime_version.ValidateProtobufRuntimeVersion(
    _runtime_version.Domain.PUBLIC,
    5,
    29,
    1,
    '',
    'resultstore.proto'
)
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()




DESCRIPTOR = _descriptor_pool.Default().AddSerializedFile(b'\n\x11resultstore.proto\x12\x1b\x65ngflow.resultstore.v1alpha\"Q\n\x10GetTargetRequest\x12\x10\n\x08instance\x18\x01 \x01(\t\x12\x15\n\rinvocation_id\x18\x02 \x01(\t\x12\x14\n\x0ctarget_label\x18\x03 \x01(\t\"h\n\x1eGetTargetLabelsByStatusRequest\x12\x10\n\x08instance\x18\x01 \x01(\t\x12\x15\n\rinvocation_id\x18\x02 \x01(\t\x12\x0e\n\x06status\x18\x03 \x01(\x0c\x12\r\n\x05limit\x18\x04 \x01(\r\"1\n\x1fGetTargetLabelsByStatusResponse\x12\x0e\n\x06labels\x18\x01 \x03(\t\"H\n\x11GetTargetResponse\x12\x33\n\x06target\x18\x01 \x01(\x0b\x32#.engflow.resultstore.v1alpha.Target\"?\n\x06Target\x12\x35\n\x04info\x18\x01 \x01(\x0b\x32\'.engflow.resultstore.v1alpha.TargetInfo\"H\n\nTargetInfo\x12:\n\ntest_suite\x18\x02 \x01(\x0b\x32&.engflow.resultstore.v1alpha.TestSuite\"l\n\tTestSuite\x12\x16\n\x0eoverall_status\x18\x01 \x01(\x05\x12G\n\x0ctest_actions\x18\x03 \x01(\x0b\x32\x31.engflow.resultstore.v1alpha.TestActionCollection\"}\n\x14TestActionCollection\x12\x38\n\x07\x61\x63tions\x18\x04 \x03(\x0b\x32\'.engflow.resultstore.v1alpha.TestAction\x12\x14\n\x0ctotal_shards\x18\x05 \x01(\x05\x12\x15\n\rtotal_entries\x18\x06 \x01(\x05\"c\n\nTestAction\x12\x0b\n\x03run\x18\x01 \x01(\x05\x12\x39\n\x04\x64\x61ta\x18\x02 \x01(\x0b\x32+.engflow.resultstore.v1alpha.TestActionData\x12\r\n\x05shard\x18\x03 \x01(\x05\"\xf2\x01\n\x0eTestActionData\x12\x0f\n\x07\x61ttempt\x18\x01 \x01(\x05\x12\x0e\n\x06status\x18\x02 \x01(\x05\x12\x43\n\x0ftest_xml_digest\x18\x06 \x01(\x0b\x32*.engflow.resultstore.v1alpha.CompactDigest\x12>\n\x0coutput_files\x18\x07 \x03(\x0b\x32(.engflow.resultstore.v1alpha.ArtifactRef\x12:\n\x08test_log\x18\x08 \x01(\x0b\x32(.engflow.resultstore.v1alpha.ArtifactRef\"1\n\rCompactDigest\x12\x0c\n\x04hash\x18\x01 \x01(\x0c\x12\x12\n\nsize_bytes\x18\x02 \x01(\x04\"3\n\x0b\x41rtifactRef\x12\x0c\n\x04name\x18\x01 \x01(\t\x12\x16\n\x0e\x62ytestream_uri\x18\x66 \x01(\tB!\n\x1f\x63om.engflow.resultstore.v1alphab\x06proto3')

_globals = globals()
_builder.BuildMessageAndEnumDescriptors(DESCRIPTOR, _globals)
_builder.BuildTopDescriptorsAndMessages(DESCRIPTOR, 'resultstore_pb2', _globals)
if not _descriptor._USE_C_DESCRIPTORS:
  _globals['DESCRIPTOR']._loaded_options = None
  _globals['DESCRIPTOR']._serialized_options = b'\n\037com.engflow.resultstore.v1alpha'
  _globals['_GETTARGETREQUEST']._serialized_start=50
  _globals['_GETTARGETREQUEST']._serialized_end=131
  _globals['_GETTARGETLABELSBYSTATUSREQUEST']._serialized_start=133
  _globals['_GETTARGETLABELSBYSTATUSREQUEST']._serialized_end=237
  _globals['_GETTARGETLABELSBYSTATUSRESPONSE']._serialized_start=239
  _globals['_GETTARGETLABELSBYSTATUSRESPONSE']._serialized_end=288
  _globals['_GETTARGETRESPONSE']._serialized_start=290
  _globals['_GETTARGETRESPONSE']._serialized_end=362
  _globals['_TARGET']._serialized_start=364
  _globals['_TARGET']._serialized_end=427
  _globals['_TARGETINFO']._serialized_start=429
  _globals['_TARGETINFO']._serialized_end=501
  _globals['_TESTSUITE']._serialized_start=503
  _globals['_TESTSUITE']._serialized_end=611
  _globals['_TESTACTIONCOLLECTION']._serialized_start=613
  _globals['_TESTACTIONCOLLECTION']._serialized_end=738
  _globals['_TESTACTION']._serialized_start=740
  _globals['_TESTACTION']._serialized_end=839
  _globals['_TESTACTIONDATA']._serialized_start=842
  _globals['_TESTACTIONDATA']._serialized_end=1084
  _globals['_COMPACTDIGEST']._serialized_start=1086
  _globals['_COMPACTDIGEST']._serialized_end=1135
  _globals['_ARTIFACTREF']._serialized_start=1137
  _globals['_ARTIFACTREF']._serialized_end=1188
# @@protoc_insertion_point(module_scope)

```

### Core Architecture Module: `cloud/kubernetes/multiregion/setup.py`
```
#!/usr/bin/env python

# Copyright 2018 The Cockroach Authors.
#
# Use of this software is governed by the CockroachDB Software License
# included in the /LICENSE file.


import json
import os
from subprocess import check_call,check_output
from sys import exit
from time import sleep

# Before running the script, fill in appropriate values for all the parameters
# above the dashed line.

# Fill in the `contexts` map with the zones of your clusters and their
# corresponding kubectl context names.
#
# To get the names of your kubectl "contexts" for each of your clusters, run:
#   kubectl config get-contexts
#
# example:
# contexts = {
#     'us-central1-a': 'gke_cockroach-alex_us-central1-a_my-cluster',
#     'us-central1-b': 'gke_cockroach-alex_us-central1-b_my-cluster',
#     'us-west1-b': 'gke_cockroach-alex_us-west1-b_my-cluster',
# }
contexts = {
}

# Fill in the `regions` map with the zones and corresponding regions of your
# clusters.
#
# Setting regions is optional, but recommended, because it improves cockroach's
# ability to diversify data placement if you use more than one zone in the same
# region. If you aren't specifying regions, just leave the map empty.
#
# example:
# regions = {
#     'us-central1-a': 'us-central1',
#     'us-central1-b': 'us-central1',
#     'us-west1-b': 'us-west1',
# }
regions = {
}

# Paths to directories in which to store certificates and generated YAML files.
certs_dir = './certs'
ca_key_dir = './my-safe-directory'
generated_files_dir = './generated'

# Path to the cockroach binary on your local machine that you want to use
# generate certificates. Defaults to trying to find cockroach in your PATH.
cockroach_path = 'cockroach'

# ------------------------------------------------------------------------------

# First, do some basic input validation.
if len(contexts) == 0:
    exit("must provide at least one Kubernetes cluster in the `contexts` map at the top of the script")

if len(regions) != 0 and len(regions) != len(contexts):
    exit("regions not specified for all kubectl contexts (%d regions, %d contexts)" % (len(regions), len(contexts)))

try:
    check_call(["which", cockroach_path])
except:
    exit("no binary found at provided path '" + cockroach_path + "'; please put a cockroach binary in your path or change the cockroach_path variable")

for zone, context in contexts.items():
    try:
        check_call(['kubectl', 'get', 'pods', '--context', context])
    except:
        exit("unable to make basic API call using kubectl context '%s' for cluster in zone '%s'; please check if the context is correct and your Kubernetes cluster is working" % (context, zone))

# Set up the necessary directories and certificates. Ignore errors because they may already exist.
try:
    os.mkdir(certs_dir)
except OSError:
    pass
try:
    os.mkdir(ca_key_dir)
except OSError:
    pass
try:
    os.mkdir(generated_files_dir)
except OSError:
    pass

check_call([cockroach_path, 'cert', 'create-ca', '--certs-dir', certs_dir, '--ca-key', ca_key_dir+'/ca.key'])
check_call([cockroach_path, 'cert', 'create-client', 'root', '--certs-dir', certs_dir, '--ca-key', ca_key_dir+'/ca.key'])

# For each cluster, create secrets containing the node and client certificates.
# Note that we create the root client certificate in both the zone namespace
# and the default namespace so that it's easier for clients in the default
# namespace to use without additional steps.
#
# Also create a load balancer to each cluster's DNS pods.
for zone, context in contexts.items():
    check_call(['kubectl', 'create', 'namespace', zone, '--context', context])
    check_call(['kubectl', 'create', 'secret', 'generic', 'cockroachdb.client.root', '--from-file', certs_dir, '--context', context])
    check_call(['kubectl', 'create', 'secret', 'generic', 'cockroachdb.client.root', '--namespace', zone, '--from-file', certs_dir, '--context', context])
    check_call([cockroach_path, 'cert', 'create-node', '--certs-dir', certs_dir, '--ca-key', ca_key_dir+'/ca.key', 'localhost', '127.0.0.1', 'cockroachdb-public', 'cockroachdb-public.default', 'cockroachdb-public.'+zone, 'cockroachdb-public.%s.svc.cluster.local' % (zone), '*.cockroachdb', '*.cockroachdb.'+zone, '*.cockroachdb.%s.svc.cluster.local' % (zone)])
    check_call(['kubectl', 'create', 'secret', 'generic', 'cockroachdb.node', '--namespace', zone, '--from-file', certs_dir, '--context', context])
    check_call('rm %s/node.*' % (certs_dir), shell=True)

    check_call(['kubectl', 'apply', '-f', 'dns-lb.yaml', '--context', context])

# Set up each cluster to forward DNS requests for zone-scoped namespaces to the
# relevant cluster's DNS server, using load balancers in order to create a
# static IP for each cluster's DNS endpoint.
dns_ips = dict()
for zone, context in contexts.items():
    external_ip = ''
    while True:
        external_ip = check_output(['kubectl', 'get', 'svc', 'kube-dns-lb', '--namespace', 'kube-system', '--context', context, '--template', '{{range .status.loadBalancer.ingress}}{{.ip}}{{end}}']).decode('utf-8')
        if external_ip:
            break
        print('Waiting for DNS load balancer IP in %s...' % (zone))
        sleep(10)
    print('DNS endpoint for zone %s: %s' % (zone, external_ip))
    dns_ips[zone] = external_ip

# Update each cluster's DNS configuration with an appropriate configmap. Note
# that we have to leave the local cluster out of its own configmap to avoid
# infinite recursion through the load balancer IP. We then have to delete the
# existing DNS pods in order for the new configuration to take effect.
for zone, context in contexts.items():
    remote_dns_ips = dict()
    for z, ip in dns_ips.items():
        if z == zone:
            continue
        remote_dns_ips[z+'.svc.cluster.local'] = [ip]
    config_filename = '%s/dns-configmap-%s.yaml' % (generated_files_dir, zone)
    with open(config_filename, 'w') as f:
        f.write("""\
apiVersion: v1
kind: ConfigMap
metadata:
  name: kube-dns
  namespace: kube-system
data:
  stubDomains: |
    %s
""" % (json.dumps(remote_dns_ips)))
    check_call(['kubectl', 'apply', '-f', config_filename, '--namespace', 'kube-system', '--context', context])
    check_call(['kubectl', 'delete', 'pods', '-l', 'k8s-app=kube-dns', '--namespace', 'kube-system', '--context', context])

# Create a cockroachdb-public service in the default namespace in each cluster.
for zone, context in contexts.items():
    yaml_file = '%s/external-name-svc-%s.yaml' % (generated_files_dir, zone)
    with open(yaml_file, 'w') as f:
        check_call(['sed', 's/YOUR_ZONE_HERE/%s/g' % (zone), 'external-name-svc.yaml'], stdout=f)
    check_call(['kubectl', 'apply', '-f', yaml_file, '--context', context])

# Generate the join string to be used.
join_addrs = []
for zone in contexts:
    for i in range(3):
        join_addrs.append('cockroachdb-%d.cockroachdb.%s' % (i, zone))
join_str = ','.join(join_addrs)

# Create the cockroach resources in each cluster.
for zone, context in contexts.items():
    if zone in regions:
        locality = 'region=%s,zone=%s' % (regions[zone], zone)
    else:
        locality = 'zone=%s' % (zone)
    yaml_file = '%s/cockroachdb-statefulset-%s.yaml' % (generated_files_dir, zone)
    with open(yaml_file, 'w') as f:
        check_call(['sed', 's/JOINLIST/%s/g;s/LOCALITYLIST/%s/g' % (join_str, locality), 'cockroachdb-statefulset-secure.yaml'], stdout=f)
    check_call(['kubectl', 'apply', '-f', yaml_file, '--namespace', zone, '--context', context])

# Finally, initialize the cluster.
print('Sleeping 30 seconds before attempting to initialize cluster to give time for volumes to be created and pods started.')
sleep(30)
for zone, context in contexts.items():
    check_call(['kubectl', 'create', '-f', 'cluster-init-secure.yaml', '--namespace', zone, '--context', context])
    # We only need run the init command in one zone given that all the zones are
    # joined together as one cluster.
    break

```

### Core Architecture Module: `cloud/kubernetes/multiregion/teardown.py`
```
#!/usr/bin/env python

# Copyright 2018 The Cockroach Authors.
#
# Use of this software is governed by the CockroachDB Software License
# included in the /LICENSE file.


from shutil import rmtree
from subprocess import call

# Before running the script, fill in appropriate values for all the parameters
# above the dashed line. You should use the same values when tearing down a
# cluster that you used when setting it up.

# To get the names of your kubectl "contexts" for each of your clusters, run:
#   kubectl config get-contexts
contexts = {
    'us-central1-a': 'gke_cockroach-alex_us-central1-a_dns',
    'us-central1-b': 'gke_cockroach-alex_us-central1-b_dns',
    'us-west1-b': 'gke_cockroach-alex_us-west1-b_dns',
}

certs_dir = './certs'
ca_key_dir = './my-safe-directory'
generated_files_dir = './generated'

# ------------------------------------------------------------------------------

# Delete each cluster's special zone-scoped namespace, which transitively
# deletes all resources that were created in the namespace, along with the few
# other resources we created that weren't in that namespace
for zone, context in contexts.items():
    call(['kubectl', 'delete', 'namespace', zone, '--context', context])
    call(['kubectl', 'delete', 'secret', 'cockroachdb.client.root', '--context', context])
    call(['kubectl', 'delete', '-f', 'external-name-svc.yaml', '--context', context])
    call(['kubectl', 'delete', '-f', 'dns-lb.yaml', '--context', context])
    call(['kubectl', 'delete', 'configmap', 'kube-dns', '--namespace', 'kube-system', '--context', context])
    # Restart the DNS pods to clear out our stub-domains configuration.
    call(['kubectl', 'delete', 'pods', '-l', 'k8s-app=kube-dns', '--namespace', 'kube-system', '--context', context])

try:
    rmtree(certs_dir)
except OSError:
    pass
try:
    rmtree(ca_key_dir)
except OSError:
    pass
try:
    rmtree(generated_files_dir)
except OSError:
    pass

```

### Core Architecture Module: `pkg/acceptance/cluster/certs.go`
```
// Copyright 2018 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

package cluster

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/cockroachdb/cockroach/pkg/roachpb"
	"github.com/cockroachdb/cockroach/pkg/security"
	"github.com/cockroachdb/cockroach/pkg/security/certnames"
	"github.com/cockroachdb/cockroach/pkg/security/username"
)

const certsDir = ".localcluster.certs"

var absCertsDir string

// keyLen is the length (in bits) of the generated TLS certs.
//
// This needs to be at least 2048 since the newer versions of openssl
// (used by some tests) produce an error 'ee key too small' for
// smaller values.
const keyLen = 2048

// AbsCertsDir returns the absolute path to the certificate directory.
func AbsCertsDir() string {
	return absCertsDir
}

// GenerateCerts generates CA and client certificates and private keys to be
// used with a cluster. It returns a function that will clean up the generated
// files.
func GenerateCerts(ctx context.Context) func() {
	var err error
	// docker-compose tests change their working directory,
	// so they need to know the absolute path to the certificate directory.
	absCertsDir, err = filepath.Abs(certsDir)
	if err != nil {
		panic(err)
	}
	maybePanic(os.RemoveAll(certsDir))

	maybePanic(security.CreateCAPair(
		certsDir, filepath.Join(certsDir, certnames.EmbeddedCAKey),
		keyLen, 96*time.Hour, false, false))

	// Root user.
	// Scope root user to system tenant and tenant ID 5 which is what we use by default for acceptance
	// tests.
	userScopes := []roachpb.TenantID{roachpb.SystemTenantID, roachpb.MustMakeTenantID(5)}
	maybePanic(security.CreateClientPair(
		certsDir, filepath.Join(certsDir, certnames.EmbeddedCAKey),
		keyLen, 48*time.Hour, false, username.RootUserName(), userScopes,
		nil /* tenantNames */, true /* generate pk8 key */))

	// Test user.
	// Scope test user to system tenant and tenant ID 5 which is what we use by default for acceptance
	// tests.
	maybePanic(security.CreateClientPair(
		certsDir, filepath.Join(certsDir, certnames.EmbeddedCAKey),
		keyLen, 48*time.Hour, false, username.TestUserName(), userScopes,
		nil /* tenantNames */, true /* generate pk8 key */))

	// Certs for starting a cockroach server. Key size is from cli/cert.go:defaultKeySize.
	maybePanic(security.CreateNodePair(
		certsDir, filepath.Join(certsDir, certnames.EmbeddedCAKey),
		keyLen, 48*time.Hour, false, []string{"localhost", "cockroach"}))

	// Store a copy of the client certificate and private key in a PKCS#12
	// bundle, which is the only format understood by Npgsql (.NET).
	{
		execCmd("openssl", "pkcs12", "-export", "-password", "pass:",
			"-in", filepath.Join(certsDir, "client.root.crt"),
			"-inkey", filepath.Join(certsDir, "client.root.key"),
			"-out", filepath.Join(certsDir, "client.root.pk12"))
	}

	return func() { _ = os.RemoveAll(certsDir) }
}

// GenerateCerts is only called in a file protected by a build tag. Suppress the
// unused linter's warning.
var _ = GenerateCerts

func execCmd(args ...string) {
	cmd := exec.Command(args[0], args[1:]...)
	if out, err := cmd.CombinedOutput(); err != nil {
		panic(fmt.Sprintf("error: %s: %s\nout: %s\n", args, err, out))
	}
}

```

### Core Architecture Module: `pkg/acceptance/cluster/cluster.go`
```
// Copyright 2015 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

package cluster

import (
	"context"
	gosql "database/sql"
	"net"
	"testing"

	"github.com/cockroachdb/errors"
)

// A Cluster is an abstraction away from a concrete cluster deployment (i.e.
// a local docker cluster, or an AWS-provisioned one). It exposes a shared
// set of methods for test-related manipulation.
type Cluster interface {
	// NumNodes returns the number of nodes in the cluster, running or not.
	NumNodes() int
	// NewDB returns a sql.DB client for the given node.
	NewDB(context.Context, int) (*gosql.DB, error)
	// PGUrl returns a URL string for the given node postgres server.
	PGUrl(context.Context, int) string
	// InternalIP returns the address used for inter-node communication.
	InternalIP(ctx context.Context, i int) net.IP
	// Assert verifies that the cluster state is as expected (i.e. no unexpected
	// restarts or node deaths occurred). Tests can call this periodically to
	// ascertain cluster health.
	Assert(context.Context, testing.TB)
	// AssertAndStop performs the same test as Assert but then proceeds to
	// dismantle the cluster.
	AssertAndStop(context.Context, testing.TB)
	// ExecCLI runs `./cockroach <args>`, while filling in required flags such as
	// --insecure, --certs-dir, --host.
	//
	// Returns stdout, stderr, and an error.
	ExecCLI(ctx context.Context, i int, args []string) (string, string, error)
	// Kill terminates the cockroach process running on the given node number.
	// The given integer must be in the range [0,NumNodes()-1].
	Kill(context.Context, int) error
	// Restart terminates the cockroach process running on the given node
	// number, unless it is already stopped, and restarts it.
	// The given integer must be in the range [0,NumNodes()-1].
	Restart(context.Context, int) error
	// URL returns the HTTP(s) endpoint.
	URL(context.Context, int) string
	// Addr returns the host and port from the node in the format HOST:PORT.
	Addr(ctx context.Context, i int, port string) string
	// Hostname returns a node's hostname.
	Hostname(i int) string
}

// Consistent performs a replication consistency check on all the ranges
// in the cluster. It depends on a majority of the nodes being up, and does
// the check against the node at index i.
func Consistent(ctx context.Context, c Cluster, i int) error {
	return errors.Errorf("Consistency checking is unimplmented and should be re-implemented using SQL")
}

```

### Core Architecture Module: `pkg/acceptance/cluster/docker.go`
```
// Copyright 2015 The Cockroach Authors.
//
// Use of this software is governed by the CockroachDB Software License
// included in the /LICENSE file.

package cluster

import (
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"math"
	"net"
	"net/url"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/cockroachdb/cockroach/pkg/util/log"
	"github.com/cockroachdb/cockroach/pkg/util/log/severity"
	"github.com/cockroachdb/cockroach/pkg/util/timeutil"
	"github.com/cockroachdb/errors"
	"github.com/cockroachdb/errors/oserror"
	"github.com/docker/distribution/reference"
	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/jsonmessage"
	"github.com/docker/go-connections/nat"
	isatty "github.com/mattn/go-isatty"
	specs "github.com/opencontainers/image-spec/specs-go/v1"
)

// Retrieve the IP address of docker itself.
func dockerIP() net.IP {
	host := os.Getenv("DOCKER_HOST")
	if host == "" {
		host = client.DefaultDockerHost
	}
	u, err := url.Parse(host)
	if err != nil {
		panic(err)
	}
	if u.Scheme == "unix" {
		return net.IPv4(127, 0, 0, 1)
	}
	h, _, err := net.SplitHostPort(u.Host)
	if err != nil {
		panic(err)
	}
	return net.ParseIP(h)
}

// Container provides the programmatic interface for a single docker
// container.
type Container struct {
	id      string
	name    string
	cluster *DockerCluster
}

// Name returns the container's name.
func (c Container) Name() string {
	return c.name
}

func hasImage(ctx context.Context, l *DockerCluster, ref string) error {
	distributionRef, err := reference.ParseNamed(ref)
	if err != nil {
		return err
	}
	path := distributionRef.Name()
	// Images hosted on docker.io have local name without the domain name
	if strings.HasPrefix(path, "docker.io") {
		path = reference.Path(distributionRef)
	}
	// Correct for random docker stupidity:
	//
	// https://github.com/moby/moby/blob/7248742/registry/service.go#L207:L215
	path = strings.TrimPrefix(path, "library/")

	images, err := l.client.ImageList(ctx, types.ImageListOptions{
		All: true,
		Filters: filters.NewArgs(
			filters.Arg("reference", path),
		),
	})
	if err != nil {
		return err
	}

	tagged, ok := distributionRef.(reference.Tagged)
	if !ok {
		return errors.Errorf("untagged reference %s not permitted", ref)
	}

	wanted := fmt.Sprintf("%s:%s", path, tagged.Tag())
	for _, image := range images {
		for _, repoTag := range image.RepoTags {
			// The Image.RepoTags field contains strings of the form <path>:<tag>.
			if repoTag == wanted {
				return nil
			}
		}
	}
	var imageList []string
	for _, image := range images {
		for _, tag := range image.RepoTags {
			imageList = append(imageList, fmt.Sprintf("%s %s", tag, image.ID))
		}
	}
	return errors.Errorf("%s not found in:\n%s", wanted, strings.Join(imageList, "\n"))
}

func pullImage(
	ctx context.Context, l *DockerCluster, ref string, options types.ImagePullOptions,
) error {
	// HACK: on CircleCI, docker pulls the image on the first access from an
	// acceptance test even though that image is already present. So we first
	// check to see if our image is present in order to avoid this slowness.
	if hasImage(ctx, l, ref) == nil {
		log.Dev.Infof(ctx, "ImagePull %s already exists", ref)
		return nil
	}

	log.Dev.Infof(ctx, "ImagePull %s starting", ref)
	defer log.Dev.Infof(ctx, "ImagePull %s complete", ref)

	rc, err := l.client.ImagePull(ctx, ref, options)
	if err != nil {
		return err
	}
	defer rc.Close()
	out := os.Stderr
	outFd := out.Fd()
	isTerminal := isatty.IsTerminal(outFd)

	if err := jsonmessage.DisplayJSONMessagesStream(rc, out, outFd, isTerminal, nil); err != nil {
		return err
	}
	if err := hasImage(ctx, l, ref); err != nil {
		return errors.Wrapf(err, "pulled image %s but still don't have it", ref)
	}
	return nil
}

// splitBindSpec splits a Docker bind specification into its host and container
// paths.
func splitBindSpec(bind string) (hostPath string, containerPath string) {
	s := strings.SplitN(bind, ":", 2)
	return s[0], s[1]
}

// getNonRootContainerUser determines a non-root UID and GID to use in the
// container to minimize file ownership problems in bind mounts. It returns a
// UID:GID string suitable for use as the User field container.Config.
func getNonRootContainerUser() (string, error) {
	// This number is Debian-specific, but for now all of our acceptance test
	// containers are based on Debian.
	// See: https://www.debian.org/doc/debian-policy/#uid-and-gid-classes
	const minUnreservedID = 101
	user, err := user.Current()
	if err != nil {
		return "", err
	}
	uid, err := strconv.Atoi(user.Uid)
	if err != nil {
		return "", errors.Wrap(err, "looking up host UID")
	}
	if uid < minUnreservedID {
		return "", fmt.Errorf("host UID %d in container's reserved UID space", uid)
	}
	gid, err := strconv.Atoi(user.Gid)
	if err != nil {
		return "", errors.Wrap(err, "looking up host GID")
	}
	if gid < minUnreservedID {
		// If the GID is in the reserved space, silently upconvert to the known-good
		// UID. We don't want to return an error because users on a macOS host
		// typically have a GID in the reserved space, and this upconversion has
		// been empirically verified to not cause ownership issues.
		gid = uid
	}
	return fmt.Sprintf("%d:%d", uid, gid), nil
}

// createContainer creates a new container using the specified
// options. Per the docker API, the created container is not running
// and must be started explicitly. Note that the passed-in hostConfig
// will be augmented with the necessary settings to use the network
// defined by l.createNetwork().
func createContainer(
	ctx context.Context,
	l *DockerCluster,
	containerConfig container.Config,
	hostConfig container.HostConfig,
	platformSpec specs.Platform,
	containerName string,
) (*Container, error) {
	hostConfig.NetworkMode = container.NetworkMode(l.networkID)
	// Disable DNS search under the host machine's domain. This can
	// catch upstream wildcard DNS matching and result in odd behavior.
	hostConfig.DNSSearch = []string{"."}

	// Run the container as the current user to avoid creating root-owned files
	// and directories from within the container.
	user, err := getNonRootContainerUser()
	if err != nil {
		return nil, err
	}
	containerConfig.User = user

	// Additionally ensure that the host side of every bind exists. Otherwise, the
	// Docker daemon will create the host directory as root before running the
	// container.
	for _, bind := range hostConfig.Binds {
		hostPath, _ := splitBindSpec(bind)
		if _, err := os.Stat(hostPath); oserror.IsNotExist(err) {
			maybePanic(os.MkdirAll(hostPath, 0755))
		} else {
			maybePanic(err)
		}
	}

	resp, err := l.client.ContainerCreate(ctx, &containerConfig, &hostConfig, nil, &platformSpec, containerName)
	if err != nil {
		return nil, err
	}
	return &Container{
		id:      resp.ID,
		name:    containerName,
		cluster: l,
	}, nil
}

func maybePanic(err error) {
	if err != nil {
		panic(err)
	}
}

// Remove removes the container from docker. It is an error to remove a running
// container.
func (c *Container) Remove(ctx context.Context) error {
	return c.cluster.client.ContainerRemove(ctx, c.id, types.ContainerRemoveOptions{ //lint:ignore SA1019 grandfathered
		RemoveVolumes: true,
		Force:         true,
	})
}

// Kill stops a running container, without removing it.
func (c *Container) Kill(ctx context.Context) error {
	if err := c.cluster.client.ContainerKill(ctx, c.id, "9"); err != nil && !strings.Contains(err.Error(), "is not running") {
		return err
	}
	c.cluster.expectEvent(c, eventDie)
	return nil
}

// Start starts a non-running container.
//
// TODO(pmattis): Generalize the setting of parameters here.
func (c *Container) Start(ctx context.Context) error {
	return c.cluster.client.ContainerStart(ctx, c.id, types.ContainerStartOptions{}) //lint:ignore SA1019 grandfathered
}

// Restar
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #175960** (2026-09-30): **release-26.4: backup: TestBackupRestoreMultiNodeLocal failed**
  *Symptoms*: backup.TestBackupRestoreMultiNodeLocal [failed](https://mesolite.cluster.engflow.com/invocations/default/f223fb24-2415-4694-a34e-86834578be1a?testReportRun=1&testReportShard=28&testReportAttempt=1#targets-Ly9wa2cvYmFja3VwOmJhY2t1cF90ZXN0) on release-26.4 @ [7557488e64f629f9d9df693c6b8b8984001dbdc0](https://github.com/cockroachdb/cockroach/commits/7557488e64f629f9d9df693c6b8b8984001dbdc0):  Data race:  ``` WARNING: DATA RACE Read at 0x00c011162930 by goroutine 40644:   github.com/cockroachdb/cockroach/pkg/util/hlc.(*Timestamp).Size()       bazel-out/k8-fastbuild/bin/pkg/util/hlc/hlc_go_proto_/github.com/cockroachdb/cockroach/pkg/util/hlc/timestamp.pb.go:253 +0x145   github.com/cockroachdb/cockroach/pkg/storage/enginepb.(*TxnMeta).Size()       bazel-out/k8-fastbuild/bin/pkg/storage/enginepb/enginepb_go_proto_/github.com/cockroachdb/cockroach/pkg/storage/enginepb/mvcc3.pb.go:1969 +0xf7   github.com/cockroachdb/cockroach/pkg/roachpb.(*Transaction).Size()       bazel-out/k8-fastbuild/bin/pkg/roachpb/roachpb_go_proto_/github.com/cockroachdb/cockroach/pkg/roachpb/data.pb.go:4470 +0x4d   github.com/cockroachdb/cockroach/pkg/kv/kvpb.(*Header).Size()       bazel-out/k8-fastbuild/bin/pkg/kv/kvpb/kvpb_go_proto_/github.com/cockroachdb/cockroach/pkg/kv/kvpb/api.pb.go:28237 +0x28a   github.com/cockroachdb/cockroach/pkg/kv/kvpb.(*BatchRequest).Size()       bazel-out/k8-fastbuild/bin/pkg/kv/kvpb/kvpb_go_proto_/github.com/cockroachdb/cockroach/pkg/kv/kvpb/api.pb.go:28411 +0x37   github.com/coc
  **Post-Mortem & Fix Analysis**:
  > cc @cockroachdb/disaster-recovery
  > dupe #175582

- **Issue #175959** (2026-09-29): **release-26.4: sql/inspect: TestInspectProgressWithMultiRangeTable failed**
  *Symptoms*: sql/inspect.TestInspectProgressWithMultiRangeTable [failed](https://mesolite.cluster.engflow.com/invocations/default/f223fb24-2415-4694-a34e-86834578be1a?testReportRun=3&testReportShard=1&testReportAttempt=1#targets-Ly9wa2cvc3FsL2luc3BlY3Q6aW5zcGVjdF90ZXN0) on release-26.4 @ [7557488e64f629f9d9df693c6b8b8984001dbdc0](https://github.com/cockroachdb/cockroach/commits/7557488e64f629f9d9df693c6b8b8984001dbdc0):  Data race:  ``` WARNING: DATA RACE Read at 0x00c0117bf8f0 by goroutine 36793:   github.com/cockroachdb/cockroach/pkg/util/hlc.(*Timestamp).Size()       bazel-out/k8-fastbuild/bin/pkg/util/hlc/hlc_go_proto_/github.com/cockroachdb/cockroach/pkg/util/hlc/timestamp.pb.go:253 +0x145   github.com/cockroachdb/cockroach/pkg/storage/enginepb.(*TxnMeta).Size()       bazel-out/k8-fastbuild/bin/pkg/storage/enginepb/enginepb_go_proto_/github.com/cockroachdb/cockroach/pkg/storage/enginepb/mvcc3.pb.go:1969 +0xf7   github.com/cockroachdb/cockroach/pkg/roachpb.(*Transaction).Size()       bazel-out/k8-fastbuild/bin/pkg/roachpb/roachpb_go_proto_/github.com/cockroachdb/cockroach/pkg/roachpb/data.pb.go:4470 +0x4d   github.com/cockroachdb/cockroach/pkg/kv/kvpb.(*Header).Size()       bazel-out/k8-fastbuild/bin/pkg/kv/kvpb/kvpb_go_proto_/github.com/cockroachdb/cockroach/pkg/kv/kvpb/api.pb.go:28237 +0x28a   github.com/cockroachdb/cockroach/pkg/kv/kvpb.(*BatchRequest).Size()       bazel-out/k8-fastbuild/bin/pkg/kv/kvpb/kvpb_go_proto_/github.com/cockroachdb/cockroach/pkg/kv/kvpb/api.pb.go:28411 +0x
  **Post-Mortem & Fix Analysis**:
  > will be fixed via cockroachlabs/cockroach#5529

- **Issue #175958** (2026-09-29): **kv/kvserver: TestCrashWhileTruncatingSideloadedEntries failed**
  *Symptoms*: kv/kvserver.TestCrashWhileTruncatingSideloadedEntries [failed](https://mesolite.cluster.engflow.com/invocations/default/0748f8a0-4727-472f-a557-e16963ad5034?testReportRun=1&testReportShard=46&testReportAttempt=1#targets-Ly9wa2cva3Yva3ZzZXJ2ZXI6a3ZzZXJ2ZXJfdGVzdA==) on release-25.4.17-rc @ [3981ecae25dbf445f122d375bf813b8859158a14](https://github.com/cockroachdb/cockroach/commits/3981ecae25dbf445f122d375bf813b8859158a14):  Failed with:  ``` === RUN   TestCrashWhileTruncatingSideloadedEntries     test_log_scope.go:171: test logs captured to: outputs.zip/logTestCrashWhileTruncatingSideloadedEntries1693155680     test_log_scope.go:82: use -show-logs to present logs inline === RUN   TestCrashWhileTruncatingSideloadedEntries/lease-type=LeaseLeader     test_server_shim.go:561: DRPC is enabled (override by TestingGlobalDRPCOption)     client_raft_log_queue_test.go:331: leader replica: [n1,s1,r79/1:/{Table/Max-Max}]     client_raft_log_queue_test.go:336: follower replica: [n2,s2,r79/2:/{Table/Max-Max}]     client_raft_log_queue_test.go:342: leader: log indices: (10..22]     client_raft_log_queue_test.go:343: leader: applied to: 22     client_raft_log_queue_test.go:342: follower: log indices: (16..22]     client_raft_log_queue_test.go:343: follower: applied to: 22     client_raft_log_queue_test.go:367: committed AddSSTs     client_raft_log_queue_test.go:342: leader: log indices: (10..42]     client_raft_log_queue_test.go:343: leader: applied to: 42     client_raft_log_queue_test.go:342
  **Post-Mortem & Fix Analysis**:
  > /investigate
  > ## Investigation: kv/kvserver.TestCrashWhileTruncatingSideloadedEntries  **Investigated failure:** [issue body](https://github.com/cockroachdb/cockroach/issues/175958) (release-25.4.17-rc, EngFlow invocation `0748f8a0-4727-472f-a557-e16963ad5034`, shard 46 run 1) **Failure SHA:** `3981ecae25dbf445f122d375bf813b8859158a14` **Confidence:** high  **Short version:** this is a duplicate of [#174817](https://github.com/cockroachdb/cockroach/issues/174817) — a known test-harness flake, already fixed on master, never backported to release-25.4. It is not a product bug, and (in my read) not a genuine release blocker.  ### What This Test Does  `TestCrashWhileTruncatingSideloadedEntries` verifies that a follower which crashes right after applying a raft log truncation can restart cleanly. It writes 20 `AddSSTable` commands (each stored as a sideloaded file), commits a `TruncateLog`, waits for the follower to apply it, then emulates a process crash by taking a `CrashClone` of the follower's strict
  > Duplicate of https://github.com/cockroachdb/cockroach/issues/174817. Seems to fail rarely, fixed on master, won't backport.

- **Issue #175955** (2026-09-29): **release-26.4: roachtest: failover/non-system/blackhole-send failed**
  *Symptoms*: roachtest.failover/non-system/blackhole-send [failed](https://teamcity.cockroachdb.com/buildConfiguration/Cockroach_Nightlies_Roachtests_RoachtestNightlyGcePrivateBazel/21535319?buildTab=log) with [artifacts](https://teamcity.cockroachdb.com/buildConfiguration/Cockroach_Nightlies_Roachtests_RoachtestNightlyGcePrivateBazel/21535319?buildTab=artifacts#/failover/non-system/blackhole-send) on release-26.4 @ [7557488e64f629f9d9df693c6b8b8984001dbdc0](https://github.com/cockroachdb/cockroach/commits/7557488e64f629f9d9df693c6b8b8984001dbdc0):  Failed with:  ``` (cluster.go:3571).Start: fetching UI certificate bundle from project "crl-e2e-infra": Get "https://secretmanager.googleapis.com/v1/projects/crl-e2e-infra/secrets/roachprod-ui-cert-tech/versions/latest:access?alt=json&prettyPrint=false": net/http: TLS handshake timeout test artifacts and logs in: /artifacts/failover/non-system/blackhole-send/run_1 ``` Cluster Node to Ip Mapping: | Node | Public IP | Private IP | | --- | --- | --- | | teamcity-21535319-1790667931-64-n7cpu2-0001 |  | 10.91.102.55 | | teamcity-21535319-1790667931-64-n7cpu2-0002 |  | 10.91.98.71 | | teamcity-21535319-1790667931-64-n7cpu2-0003 |  | 10.91.102.54 | | teamcity-21535319-1790667931-64-n7cpu2-0004 |  | 10.91.102.51 | | teamcity-21535319-1790667931-64-n7cpu2-0005 |  | 10.91.102.52 | | teamcity-21535319-1790667931-64-n7cpu2-0006 |  | 10.91.102.53 | | teamcity-21535319-1790667931-64-n7cpu2-0007 |  | 10.91.111.214 |  Parameters:  - <code>arch=amd64</code>  -
  **Post-Mortem & Fix Analysis**:
  > /investigate
  > ## Investigation: `failover/non-system/blackhole-send`  **Investigated failure:** [issue body](https://github.com/cockroachdb/cockroach/issues/175955) (TeamCity build [21535319](https://teamcity.cockroachdb.com/buildConfiguration/Cockroach_Nightlies_Roachtests_RoachtestNightlyGcePrivateBazel/21535319), 2026-09-29 11:26:58 UTC) **Failure SHA:** `7557488e64f629f9d9df693c6b8b8984001dbdc0` (release-26.4) **Confidence:** high — this is a roachtest/roachprod harness infrastructure failure, **not** a CockroachDB or KV bug.  ### What This Test Does  `failover/non-system/blackhole-send` measures unavailability when a node's outbound network traffic is blackholed, for ranges that do *not* hold system data. It runs on a 7-node GCE cluster (6 CRDB nodes + 1 workload node).  ### Where the Failure Occurs  The test never got as far as starting a single CockroachDB node. It died during `cluster.Start()`, in roachprod's certificate distribution step:  ``` (cluster.go:3571).Start: fetching UI certificat
  > Closing this as an infra flake. This test doesn't fail often at all, so we can try to add a retry or look for the underlying cause if it fails again.

- **Issue #175942** (2026-09-28): **Sentry: ordering.go:507: no output column equivalent to 0
(1) while executing: INSERT INTO _(_, _, _, _, _, _, _, _, _, _) SELECT gen_random_uuid(), _._[_ + (_._ % _)], _._[_ + (_._ % (array_length(_....**
  *Symptoms*: This issue was auto filed by Sentry. It represents a crash or reported error on a live cluster with telemetry enabled.  Sentry Link: [https://cockroach-labs.sentry.io/issues/7759550436/?referrer=webhooks_plugin](https://cockroach-labs.sentry.io/issues/7759550436/?referrer=webhooks_plugin)  Panic Message:  ``` ordering.go:507: no output column equivalent to 0 (1) while executing: INSERT INTO _(_, _, _, _, _, _, _, _, _, _) SELECT gen_random_uuid(), _._[_ + (_._ % _)], _._[_ + (_._ % (array_length(_._, _) - _))], _._[_ + (_._ % _)], CASE WHEN (_._ % _) = _ THEN _._[_ + (_._ % _)] ELSE _._[_ + (_._ % _)] END, CASE WHEN (_._ % _) IN (_, _) THEN _._[_ + (_._ % _)] END, CASE _._ % _ WHEN _ THEN ARRAY[gen_random_uuid()] WHEN _ THEN ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()] END, (_._ % _) IN (_, _), ((now() - (_._ * '_'::INTERVAL)) - (((_._ * _) % _) * '_'::INTERVAL))::TIMESTAMP, CASE WHEN (_._ % _) IN (_, _) THEN ((now() - (_._ * '_'::INTERVAL)) + '_'::INTERVAL)::TIMESTAMP END FROM ROWS FROM (generate_series(_, _)) AS _ (_), (SELECT array_agg(_ ORDER BY random()) AS _ FROM _ WHERE _ IS NULL) AS _, (SELECT ARRAY[_, _, __more1_10__] AS _) AS _, (SELECT ARRAY[_, _, __more1_10__] AS _, ARRAY[_, _, __more1_10__] AS _) AS _, (SELECT ARRAY[_, _, __more1_10__] AS _) AS _ Wraps: (2) assertion failure Wraps: (3) attached stack trace   -- stack trace:   | github.com/cockroachdb/cockroach/pkg/sql/opt/ordering.finalizeProvided   | 	pkg/sql/opt/ordering/ordering.go:507   | gi
  **Post-Mortem & Fix Analysis**:
  > CC'ing via the CODEOWNERS-based sentry heuristic: * @cockroachdb/sql-queries  Sentry issue cause: pkg/sql/opt/ordering/ordering.go  <sub>:owl: Hoot! I am a [Blathers](https://github.com/apps/blathers-crl), a bot for [CockroachDB](https://github.com/cockroachdb). My owner is [dev-inf](https://github.com/orgs/cockroachdb/teams/dev-inf).</sub>
  > /investigate
  > ## Investigation: Sentry — `ordering.go:507: no output column equivalent to 0`  **Investigated failure:** [issue body](https://github.com/cockroachdb/cockroach/issues/175942) (single Sentry report) **Failure SHA:** `1a79ea7f3f8dfffbc9f0f32dc05ecc1c6627d5bd` (v26.2.2, CCL, linux arm64, `start-single-node`) **Confidence:** moderate on the mechanism and the prime suspect; low on the exact triggering rule (not reproduced)  ### What This Is  Not a test failure — a Sentry-reported optimizer assertion from a live cluster. The statement is a bulk data-seeding `INSERT ... SELECT`:  ```sql INSERT INTO t (10 cols) SELECT gen_random_uuid(), a.arr[...], ..., CASE ... END, ... FROM ROWS FROM (generate_series(_, _)) AS g (i),      (SELECT array_agg(_ ORDER BY random()) AS arr FROM _ WHERE _ IS NULL) AS a,      (SELECT ARRAY[...] AS _) AS b,      (SELECT ARRAY[...] AS _, ARRAY[...] AS _) AS c,      (SELECT ARRAY[...] AS _) AS d ```  It fails at **plan time** (`Optimizer.Optimize` → `setLowestCostTree`

- **Issue #175941** (2026-09-28): **Sentry: builtins.go:6100: ×
(1) plan gist: AgICABoCEQcGBgY=
Wraps: (2) while executing: SELECT _, repeat(_, _) AS _, CASE WHEN _ = _ THEN crdb_internal.force_error(_, _) ELSE _ END AS _ FROM ROWS FRO...**
  *Symptoms*: This issue was auto filed by Sentry. It represents a crash or reported error on a live cluster with telemetry enabled.  Sentry Link: [https://cockroach-labs.sentry.io/issues/7759482294/?referrer=webhooks_plugin](https://cockroach-labs.sentry.io/issues/7759482294/?referrer=webhooks_plugin)  Panic Message:  ``` builtins.go:6100: × (1) plan gist: AgICABoCEQcGBgY= Wraps: (2) while executing: SELECT _, repeat(_, _) AS _, CASE WHEN _ = _ THEN crdb_internal.force_error(_, _) ELSE _ END AS _ FROM ROWS FROM (generate_series(_, _)) AS _ (_) ORDER BY _ Wraps: (3) Wraps: (4) candidate pg code: XX000 Wraps: (5) attached stack trace   -- stack trace:   | github.com/cockroachdb/cockroach/pkg/sql/sem/builtins.init.func288   | 	pkg/sql/sem/builtins/builtins.go:6100   | github.com/cockroachdb/cockroach/pkg/sql/colexec/colexecbuiltins.(*defaultBuiltinFuncOperator).Next.func1   | 	pkg/sql/colexec/colexecbuiltins/builtin_funcs.go:79   | github.com/cockroachdb/cockroach/pkg/sql/colmem.(*Allocator).PerformOperation   | 	pkg/sql/colmem/allocator.go:443   | github.com/cockroachdb/cockroach/pkg/sql/colexec/colexecbuiltins.(*defaultBuiltinFuncOperator).Next   | 	pkg/sql/colexec/colexecbuiltins/builtin_funcs.go:56   | github.com/cockroachdb/cockroach/pkg/sql/colexecop.NextNoMeta   | 	pkg/sql/colexecop/operator.go:543   | github.com/cockroachdb/cockroach/pkg/sql/colexec.(*caseOp).Next.func1   | 	pkg/sql/colexec/case.go:234   | github.com/cockroachdb/cockroach/pkg/sql/colmem.(*Allocator).PerformOperation 
  **Post-Mortem & Fix Analysis**:
  > CC'ing via the CODEOWNERS-based sentry heuristic: * @cockroachdb/sql-foundations  Sentry issue cause: pkg/sql/sem/builtins/builtins.go  <sub>:owl: Hoot! I am a [Blathers](https://github.com/apps/blathers-crl), a bot for [CockroachDB](https://github.com/cockroachdb). My owner is [dev-inf](https://github.com/orgs/cockroachdb/teams/dev-inf).</sub>
  > /investigate
  > ## Investigation: Sentry report from `crdb_internal.force_error` (`builtins.go:6100`)  **Investigated failure:** [issue body](https://github.com/cockroachdb/cockroach/issues/175941) **Failure SHA:** `8652ac22d9f90501e48ae4f24efd7faab33cf7c5` (v26.2.7) **Confidence:** high — this is a **by-design error, not a CockroachDB bug**  ### What This Is  This is not a test failure. It is a Sentry auto-filed report from a live cluster with telemetry enabled. The reported stack bottoms out in `crdb_internal.force_error`, a builtin whose documented purpose is *"used only by CockroachDB's developers for testing purposes"* — it takes a pgcode and a message and returns exactly that error.  The caller passed pgcode `XX000` (`pgcode.Internal`), so the builtin faithfully manufactured an internal error. Nothing malfunctioned.  ### Where the Failure Occurs  The error is *constructed* (not raised by a fault) at [builtins.go:6100](https://github.com/cockroachlabs/cockroach/blob/8652ac22d9f90501e48ae4f24efd7f

- **Issue #175939** (2026-09-29): **Sentry: routine.go:63: procedure returned null record
(1) candidate pg code: XX000
Wraps: (2) attached stack trace
  -- stack trace:
  | github.com/cockroachdb/cockroach/pkg/sql.(*callNode).startExec
...**
  *Symptoms*: This issue was auto filed by Sentry. It represents a crash or reported error on a live cluster with telemetry enabled.  Sentry Link: [https://cockroach-labs.sentry.io/issues/7759392771/?referrer=webhooks_plugin](https://cockroach-labs.sentry.io/issues/7759392771/?referrer=webhooks_plugin)  Panic Message:  ``` routine.go:63: procedure returned null record (1) candidate pg code: XX000 Wraps: (2) attached stack trace   -- stack trace:   | github.com/cockroachdb/cockroach/pkg/sql.(*callNode).startExec   | 	pkg/sql/routine.go:63   | github.com/cockroachdb/cockroach/pkg/sql.startExec   | 	pkg/sql/plan.go:594   | github.com/cockroachdb/cockroach/pkg/sql.(*planNodeToRowSource).Start   | 	pkg/sql/plan_node_to_row_source.go:210   | github.com/cockroachdb/cockroach/pkg/sql/colflow.(*FlowCoordinator).Start.func1   | 	pkg/sql/colflow/flow_coordinator.go:111   | github.com/cockroachdb/cockroach/pkg/sql/colexecerror.CatchVectorizedRuntimeError   | 	pkg/sql/colexecerror/error.go:162   | github.com/cockroachdb/cockroach/pkg/sql/colflow.(*FlowCoordinator).Start   | 	pkg/sql/colflow/flow_coordinator.go:110   | github.com/cockroachdb/cockroach/pkg/sql/execinfra.(*ProcessorBaseNoHelper).Run   | 	pkg/sql/execinfra/processorsbase.go:748   | github.com/cockroachdb/cockroach/pkg/sql/flowinfra.(*FlowBase).Run   | 	pkg/sql/flowinfra/flow.go:574   | github.com/cockroachdb/cockroach/pkg/sql/colflow.(*vectorizedFlow).Run   | 	pkg/sql/colflow/vectorized_flow.go:301   | github.com/cockroachdb/cockroach/pkg/
  **Post-Mortem & Fix Analysis**:
  > CC'ing via the CODEOWNERS-based sentry heuristic: * @cockroachdb/sql-foundations  Sentry issue cause: pkg/sql/routine.go  <sub>:owl: Hoot! I am a [Blathers](https://github.com/apps/blathers-crl), a bot for [CockroachDB](https://github.com/cockroachdb). My owner is [dev-inf](https://github.com/orgs/cockroachdb/teams/dev-inf).</sub>
  > /investigate
  > ## Investigation: Sentry report `routine.go:63: procedure returned null record`  **Investigated failure:** [issue body](https://github.com/cockroachdb/cockroach/issues/175939) (Sentry, v25.4.17) **Failure SHA:** `3981ecae25dbf445f122d375bf813b8859158a14` **Confidence:** high (that this is Sentry noise, not a crash); moderate on the exact user SQL  ### TL;DR  This is almost certainly **not a bug in execution** — it is a deliberate, Postgres-compatible *user-facing* error that CockroachDB happens to emit with SQLSTATE `XX000`, and CockroachDB unconditionally ships every `XX000` error to Sentry. There is an existing logic test that asserts exactly this error is returned. Recommended action: suppress the Sentry report (and the `encountered internal error` log line) for this error, rather than chase a root cause in the SQL layer.  ### What Produces This Error  Not a test — this is an auto-filed Sentry report from a live cluster (`start-single-node`, CCL, v25.4.17, 4 CPUs). There are no Team

- **Issue #175938** (2026-09-28): **release-26.4: roachtest: sqlsmith/setup=tpch-sf1/setting=default/mem=low failed**
  *Symptoms*: roachtest.sqlsmith/setup=tpch-sf1/setting=default/mem=low [failed](https://teamcity.cockroachdb.com/buildConfiguration/Cockroach_Nightlies_Roachtests_RoachtestNightlyGcePrivateBazel/21534422?buildTab=log) with [artifacts](https://teamcity.cockroachdb.com/buildConfiguration/Cockroach_Nightlies_Roachtests_RoachtestNightlyGcePrivateBazel/21534422?buildTab=artifacts#/sqlsmith/setup=tpch-sf1/setting=default/mem=low) on release-26.4 @ [e6cb6a48fc00ffbe31af4a7a023e23d960bb0746](https://github.com/cockroachdb/cockroach/commits/e6cb6a48fc00ffbe31af4a7a023e23d960bb0746):  Failed with:  ``` (sqlsmith.go:349).func3: ping node 2: driver: bad connection HINT: node likely crashed, check logs in artifacts > logs/2.unredacted previous sql: INSERT INTO 	defaultdb.public.nation AS tab_620 (n_name, n_nationkey, n_regionkey) SELECT 	e'\x00' AS col_872, 6457448564065580707 AS col_873, tab_621.o_shippriority AS col_874 FROM 	defaultdb.public.orders AS tab_621 ORDER BY 	tab_621.tableoid DESC;ping node 2: driver: bad connection HINT: node likely crashed, check logs in artifacts > logs/2.unredacted test artifacts and logs in: /artifacts/sqlsmith/setup=tpch-sf1/setting=default/mem=low/cpu_arch=fips/run_1 ``` Cluster Node to Ip Mapping: | Node | Public IP | Private IP | | --- | --- | --- | | teamcity-21534422-1790572134-145-n4cpu4lm-0001 |  | 10.91.97.115 | | teamcity-21534422-1790572134-145-n4cpu4lm-0002 |  | 10.91.97.94 | | teamcity-21534422-1790572134-145-n4cpu4lm-0003 |  | 10.91.97.12 | | teamcity-2
  **Post-Mortem & Fix Analysis**:
  > /investigate
  > ## Investigation: sqlsmith/setup=tpch-sf1/setting=default/mem=low  **Investigated failure:** [issue body](https://github.com/cockroachdb/cockroach/issues/175938) (TeamCity build 21534422, `arch=fips`) **Failure SHA:** `e6cb6a48fc00ffbe31af4a7a023e23d960bb0746` **Confidence:** high (on *what* happened), moderate (on *what to do about it*)  ### What This Test Does  `sqlsmith/setup=tpch-sf1/setting=default/mem=low` restores the TPC-H sf=1 fixture into a 4-node cluster and fires randomly generated SQL at node 1, pinging all four nodes after every statement to detect crashes. The `/mem=low` variant provisions `n2-highcpu-4` VMs and boxes each `cockroach` process into a hard **2 GiB systemd `MemoryMax` cgroup** ([sqlsmith.go:46-48](https://github.com/cockroachlabs/cockroach/blob/e6cb6a48fc00ffbe31af4a7a023e23d960bb0746/pkg/cmd/roachtest/tests/sqlsmith.go#L46-L48)), deliberately to pressure the optimizer and execution engine.  ### Where the Failure Occurs  The reported error is the generic po
  > The problem here was that we had an INSERT stmt that wrote the same key 10k times. The behavior down in the storage layer in such scenario is quadratic (see #84167), so it led to an OOM (if it wasn't `mem=low` setup, it would've probably hit the raft command size error instead). #157971 is somewhat related too. For now I'll just close it as a dup of #84167.

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

### Incident Patch 1: `00a3c2c5` (2026-08-05)
**Commit Message**: Merge pull request #173146 from rafiss/investigate-fix-local-action

ci/ai: reference setup-roachdev by repo path, not local ./

**File**: `.github/workflows/investigate.yml` (modified, +9/-2)
```diff
@@ -338,13 +338,20 @@ jobs:
       #
       # roachdev is an internal release in another org, which a public repo
       # cannot install via `uses: cockroachlabs/roachdev@main` (GitHub blocks
-      # internal-repo actions from public repos). The local composite action
+      # internal-repo actions from public repos). This composite action
       # downloads the released binary directly, using the cross-org PAT that
       # already checks out the private code repo. On the personal-fork
       # API-key path no token is passed, so roachdev is skipped — that path
       # runs Claude directly and never posts to a public repo.
+      #
+      # This is referenced by full repo path @ref rather than the local `./`
+      # form on purpose: the Checkout step above replaced the workspace with
+      # CODE_REPO, so `./.github/actions/...` (resolved against the workspace)
+      # would not be found. A remote ref is fetched independently of the
+      # workspace. Tracks master so same-repo action edits take effect without
+      # a version bump.
       - name: Set up roachdev and Claude Code
-        uses: ./.github/actions/setup-roachdev
+        uses: cockroachdb/cockroach/.github/actions/setup-roachdev@master
         with:
           # Pinned: claude-code-action@v1 would otherwise install Claude Code
           # 1.0.127 (Sep 2025), which predates --effort and the Sonnet 5 /
```

---

### Incident Patch 2: `d6dab970` (2026-08-05)
**Commit Message**: Merge pull request #172083 from shafi-VM/fix/170544-inlineconstvar-cast

opt: cast inlined constant to the variable's type in InlineConstVar

**File**: `pkg/sql/logictest/testdata/logic_test/select` (modified, +33/-0)
```diff
@@ -1013,3 +1013,36 @@ query ITT
 SELECT * FROM t146637 WHERE (a = 0 OR a = 100) AND b = 'foo' ORDER BY a DESC LIMIT 1;
 ----
 100  foo  bar
+
+# Regression test for #170544. InlineConstVar must cast an inlined constant to
+# the variable's type when the two are equivalent but not identical, so that
+# type-sensitive expressions such as pg_typeof are not changed.
+statement ok
+CREATE TABLE t170544_name (n NAME);
+INSERT INTO t170544_name VALUES ('hello')
+
+# pg_typeof(n) must still observe NAME (not STRING), so the row is returned.
+query T
+SELECT n FROM t170544_name WHERE n = 'hello' AND pg_typeof(n)::TEXT = 'name'
+----
+hello
+
+# The cast added when inlining must not introduce an evaluation error for
+# out-of-range or lossy casts, because the constant only reaches dead rows.
+# INT8 -> INT2 overflow: the query returns zero rows rather than erroring.
+statement ok
+CREATE TABLE t170544_int2 (i2 INT2);
+INSERT INTO t170544_int2 VALUES (5)
+
+query I
+SELECT i2 FROM t170544_int2 WHERE i2 = 40000 AND i2 + 0 = 5
+----
+
+# VARCHAR(n) truncation: the query returns zero rows rather than incorrect rows.
+statement ok
+CREATE TABLE t170544_varchar (s VARCHAR(3));
+INSERT INTO t170544_varchar VALUES ('abc')
+
+query T
+SELECT s FROM t170544_varchar WHERE s = 'abcdef' AND lower(s) = 'abc'
+----
```

**File**: `pkg/sql/opt/norm/inline_funcs.go` (modified, +10/-0)
```diff
@@ -388,6 +388,16 @@ func (c *CustomFuncs) InlineConstVar(f memo.FiltersExpr) memo.FiltersExpr {
 	replace = func(nd opt.Expr) opt.Expr {
 		if t, ok := nd.(*memo.VariableExpr); ok {
 			if e, ok := vals[t.Col]; ok {
+				// The constant was matched against the variable using Equivalent
+				// (not Identical) above, so its type may differ from the
+				// variable's (e.g. a STRING constant for a NAME column).
+				// Substituting the constant directly would change the result of
+				// type-sensitive expressions such as pg_typeof, so cast the
+				// constant to the variable's type when the two are not identical.
+				colType := c.mem.Metadata().ColumnMeta(t.Col).Type
+				if !e.DataType().Identical(colType) {
+					return c.f.ConstructCast(e, colType)
+				}
 				return e
 			}
 		}
```

**File**: `pkg/sql/opt/norm/testdata/rules/inline` (modified, +60/-0)
```diff
@@ -226,6 +226,66 @@ project
                 │              └── true [as=column14:14]
                 └── false
 
+# Regression test for #170544. InlineConstVar must not replace a variable with a
+# constant whose type is equivalent but not identical to the variable's type
+# without a cast, since that changes the result of type-sensitive expressions
+# such as pg_typeof. Here n is NAME and the constant 'hello' is STRING; the
+# inlined constant is cast back to NAME so pg_typeof(n) still reports 'name' and
+# the row is not incorrectly filtered out.
+exec-ddl
+CREATE TABLE t_name (n NAME)
+----
+
+norm expect=InlineConstVar
+SELECT * FROM t_name WHERE n = 'hello' AND pg_typeof(n)::TEXT = 'name'
+----
+select
+ ├── columns: n:1!null
+ ├── fd: ()-->(1)
+ ├── scan t_name
+ │    └── columns: n:1
+ └── filters
+      └── n:1 = 'hello' [outer=(1), constraints=(/1: [/'hello' - /'hello']; tight), fd=()-->(1)]
+
+# Out-of-range constant (#170544). i2 = 40000 is a contradiction for an INT2
+# column, so no row is ever live. The cast that InlineConstVar adds (40000::INT2,
+# which would overflow) must not be folded eagerly, or the query would error
+# instead of returning zero rows.
+exec-ddl
+CREATE TABLE t_int2 (i2 INT2)
+----
+
+norm
+SELECT * FROM t_int2 WHERE i2 = 40000 AND i2 + 0 = 5
+----
+select
+ ├── columns: i2:1!null
+ ├── immutable
+ ├── fd: ()-->(1)
+ ├── scan t_int2
+ │    └── columns: i2:1
+ └── filters
+      ├── i2:1 = 40000 [outer=(1), constraints=(/1: [/40000 - /40000]; tight), fd=()-->(1)]
+      └── 40000::INT2::INT8 = 5 [immutable]
+
+# Length-limited type (#170544). 'abcdef' truncates to 'abc' when cast to
+# VARCHAR(3), but s = 'abcdef' is a contradiction, so the truncated constant is
+# only ever inlined into dead rows.
+exec-ddl
+CREATE TABLE t_varchar (s VARCHAR(3))
+----
+
+norm
+SELECT * FROM t_varchar WHERE s = 'abcdef' AND lower(s) = 'abc'
+----
+select
+ ├── columns: s:1!null
+ ├── fd: ()-->(1)
+ ├── scan t_varchar
+ │    └── columns: s:1
+ └── filters
+      └── s:1 = 'abcdef' [outer=(1), constraints=(/1: [/'abcdef' - /'abcdef']; tight), fd=()-->(1)]
+
 # --------------------------------------------------
 # InlineProjectConstants
 # --------------------------------------------------
```

---

### Incident Patch 3: `c21c6784` (2026-08-05)
**Commit Message**: Merge pull request #172915 from shivamshaw23/fix-172889-compaction-lock-cleanup

backup: clean up BACKUP-LOCK on compaction failure

**File**: `pkg/backup/backup_job.go` (modified, +19/-0)
```diff
@@ -51,6 +51,7 @@ import (
 	"github.com/cockroachdb/cockroach/pkg/sql/sem/tree"
 	"github.com/cockroachdb/cockroach/pkg/sql/sessiondata"
 	"github.com/cockroachdb/cockroach/pkg/sql/stats"
+	"github.com/cockroachdb/cockroach/pkg/util/besteffort"
 	bulkutil "github.com/cockroachdb/cockroach/pkg/util/bulk"
 	"github.com/cockroachdb/cockroach/pkg/util/ctxgroup"
 	"github.com/cockroachdb/cockroach/pkg/util/errorutil/unimplemented"
@@ -1946,6 +1947,10 @@ func (b *backupResumer) processScheduledBackupCompletion(
 	return nil
 }
 
+// compactionBackupLockCleanupOp is the besteffort operation name used when
+// removing the BACKUP-LOCK file left behind by a failed compaction job.
+const compactionBackupLockCleanupOp = "delete-compaction-backup-lock"
+
 // OnFailOrCancel is part of the jobs.Resumer interface.
 func (b *backupResumer) OnFailOrCancel(
 	ctx context.Context, execCtx interface{}, jobErr error,
@@ -1960,6 +1965,20 @@ func (b *backupResumer) OnFailOrCancel(
 	details := b.job.Details().(jobspb.BackupDetails)
 
 	b.deleteCheckpoint(ctx, cfg, p.User())
+
+	// For compaction jobs, clean up the BACKUP-LOCK file from the backup
+	// destination to unblock subsequent compaction attempts that may target
+	// the same location. A failed compaction does not produce a valid backup at
+	// the destination, so the lock serves no purpose and only blocks future
+	// compactions.
+	if details.Compact && details.URI != "" {
+		besteffort.Warning(ctx, compactionBackupLockCleanupOp, func(ctx context.Context) error {
+			return backupinfo.DeleteBackupLock(
+				ctx, cfg, details.URI, b.job.ID(), p.User(),
+			)
+		})
+	}
+
 	if err := cfg.InternalDB.Txn(ctx, func(ctx context.Context, txn isql.Txn) error {
 		pts := cfg.ProtectedTimestampProvider.WithTxn(txn)
 		return releaseProtectedTimestamp(ctx, pts, details.ProtectedTimestampRecord)
```

**File**: `pkg/backup/backupinfo/manifest_handling.go` (modified, +31/-0)
```diff
@@ -541,6 +541,37 @@ func WriteBackupLock(
 	return cloud.WriteFile(ctx, defaultStore, lockFileName, bytes.NewReader([]byte("lock")))
 }
 
+// DeleteBackupLock removes the backup lock file for the given jobID from the
+// default backup destination. This is used to clean up lock files from failed
+// compaction jobs so that subsequent compaction attempts to the same destination
+// are not blocked.
+func DeleteBackupLock(
+	ctx context.Context,
+	execCfg *sql.ExecutorConfig,
+	defaultURI string,
+	jobID jobspb.JobID,
+	user username.SQLUsername,
+) error {
+	ctx, sp := tracing.ChildSpan(ctx, "backupinfo.DeleteBackupLock")
+	defer sp.Finish()
+
+	defaultStore, err := execCfg.DistSQLSrv.ExternalStorageFromURI(ctx, defaultURI, user)
+	if err != nil {
+		return err
+	}
+	defer defaultStore.Close()
+
+	lockFileName := fmt.Sprintf("%s%s", BackupLockFilePrefix, strconv.FormatInt(int64(jobID), 10))
+	if err := defaultStore.Delete(ctx, lockFileName); err != nil {
+		// If the lock file does not exist, there is nothing to clean up.
+		if errors.Is(err, cloud.ErrFileDoesNotExist) {
+			return nil
+		}
+		return err
+	}
+	return nil
+}
+
 // WriteMetadataWithExternalSSTs writes a "slim" version of manifest to
 // `exportStore`. This version has the alloc heavy `Files`, `Descriptors`, and
 // `DescriptorChanges` repeated fields nil'ed out, and written to an
```

**File**: `pkg/backup/datadriven_test.go` (modified, +22/-0)
```diff
@@ -46,6 +46,7 @@ import (
 	"github.com/cockroachdb/cockroach/pkg/testutils/skip"
 	"github.com/cockroachdb/cockroach/pkg/testutils/sqlutils"
 	"github.com/cockroachdb/cockroach/pkg/util/admission"
+	"github.com/cockroachdb/cockroach/pkg/util/besteffort"
 	"github.com/cockroachdb/cockroach/pkg/util/ctxgroup"
 	"github.com/cockroachdb/datadriven"
 	"github.com/cockroachdb/errors"
@@ -485,6 +486,11 @@ func (d *datadrivenTestState) getSQLDBForVC(
 //   - "sleep ms=TIME"
 //     Sleep for TIME milliseconds.
 //
+//   - "besteffort-forbid-skip op=OP"
+//     Forbids the besteffort operation named OP from being randomly skipped in
+//     test builds for the remainder of the test, so its side effects run
+//     deterministically. See pkg/util/besteffort.
+//
 //lint:ignore U1000 unused
 func runTestDataDriven(t *testing.T, testFilePathFromWorkspace string) {
 	// TODO(at): data driven tests will need some tweaks to work with OR metamorphic, which will
@@ -514,6 +520,16 @@ func runTestDataDriven(t *testing.T, testFilePathFromWorkspace string) {
 	var lastCreatedCluster string
 	ds := newDatadrivenTestState()
 	defer ds.cleanup(ctx, t)
+
+	// The "besteffort-forbid-skip" command registers cleanups that must remain
+	// in effect for the remainder of the test; run them once it finishes.
+	var besteffortCleanups []func()
+	defer func() {
+		for _, cleanup := range besteffortCleanups {
+			cleanup()
+		}
+	}()
+
 	datadriven.RunTest(t, path, func(t *testing.T, d *datadriven.TestData) string {
 		execWithTagAndPausePoint := func(jobType jobspb.Type) string {
 			ds.noticeBuffer = nil
@@ -572,6 +588,12 @@ func runTestDataDriven(t *testing.T, testFilePathFromWorkspace string) {
 			skip.UnderDuress(t)
 			return ""
 
+		case "besteffort-forbid-skip":
+			var op string
+			d.ScanArgs(t, "op", &op)
+			besteffortCleanups = append(besteffortCleanups, besteffort.TestForbidSkip(op))
+			return ""
+
 		case "reset":
 			ds.cleanup(ctx, t)
 			ds = newDatadrivenTestState()
```

**File**: `pkg/backup/testdata/backup-restore/compaction-failed-lock-cleanup` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+# Test that when a compaction job is cancelled/fails, its BACKUP-LOCK file is
+# cleaned up, allowing subsequent compactions to proceed without being blocked.
+# See: https://github.com/cockroachdb/cockroach/issues/172889
+
+reset test-nodelocal
+----
+
+new-cluster name=s1 disable-tenant
+----
+
+# The BACKUP-LOCK cleanup in OnFailOrCancel is a besteffort operation, which is
+# randomly skipped in test builds. Forbid skipping it so the cancelled
+# compaction below deterministically removes its lock and the subsequent
+# compaction can proceed.
+besteffort-forbid-skip op=delete-compaction-backup-lock
+----
+
+# 1. Setup: create a table and take a full backup followed by two incrementals,
+# saving timestamps to use as compaction start/end boundaries.
+exec-sql
+CREATE DATABASE orig;
+USE orig;
+CREATE TABLE foo (i INT PRIMARY KEY, s STRING);
+INSERT INTO foo VALUES (1, 'a'), (2, 'b');
+----
+
+save-cluster-ts tag=start
+----
+
+backup aost=start
+BACKUP INTO 'nodelocal://1/test-root/' AS OF SYSTEM TIME start;
+----
+
+exec-sql
+INSERT INTO orig.foo VALUES (3, 'c');
+----
+
+backup
+BACKUP INTO LATEST IN 'nodelocal://1/test-root/';
+----
+
+exec-sql
+INSERT INTO orig.foo VALUES (4, 'd');
+----
+
+save-cluster-ts tag=end
+----
+
+backup aost=end
+BACKUP INTO LATEST IN 'nodelocal://1/test-root/' AS OF SYSTEM TIME end;
+----
+
+let $backup_path
+SHOW BACKUPS IN 'nodelocal://1/test-root/';
+----
+
+# 2. Set a pausepoint so the compaction pauses right after it writes the
+# BACKUP-LOCK, letting us cancel it while the lock is still present. The
+# crdb_internal.backup_compaction builtin starts the job asynchronously, so the
+# call returns immediately with the job ID; we wait for the job to pause
+# separately rather than expecting a synchronous pausepoint error.
+exec-sql
+SET CLUSTER SETTING jobs.debug.pausepoints = 'backup_compaction.after.details_has_checkpoint';
+----
+
+compact start=start end=end tag=comp1
+SELECT crdb_internal.backup_compaction(0, 'BACKUP INTO LATEST IN ''nodelocal://1/test-root/''', '$backup_path', start, end);
+----
+
+job tag=comp1 wait-for-state=paused
+----
+
+# 3. Cancel the paused compaction to trigger OnFailOrCancel, which cleans up the
+# BACKUP-LOCK file.
+job cancel=comp1
+----
+
+# 4. Clear pausepoints so the next compaction can run to completion.
+exec-sql
+SET CLUSTER SETTING jobs.debug.pausepoints = '';
+----
+
+# 5. Run a new compaction over the same range. If the stale BACKUP-LOCK from the
+# cancelled job was not cleaned up, this would fail with FileAlreadyExists.
+compact start=start end=end tag=comp2
+SELECT crdb_internal.backup_compaction(0, 'BACKUP INTO LATEST IN ''nodelocal://1/test-root/''', '$backup_path', start, end);
+----
+
+job tag=comp2 wait-for-state=succeeded
+----
```

---

### Incident Patch 4: `84864bbe` (2026-08-01)
**Commit Message**: backup: fix async pausepoint handling in compaction lock cleanup test

The compaction-failed-lock-cleanup datadriven test used `expect-pausepoint`
on the `compact` directive, which asserts that the SQL call returns a
synchronous "pause point ... hit" error. However,
crdb_internal.backup_compaction starts an asynchronous job and returns
immediately with the job ID, so no such error ever surfaces. The assertion
therefore failed in CI with "expected pause point error".

Start the compaction without expecting a synchronous pausepoint error and
instead wait for the job to reach the paused state before cancelling it,
matching the async pattern already used by the rangekeys test.

Release note: None

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

**File**: `pkg/backup/testdata/backup-restore/compaction-failed-lock-cleanup` (modified, +11/-4)
```diff
@@ -47,17 +47,24 @@ let $backup_path
 SHOW BACKUPS IN 'nodelocal://1/test-root/';
 ----
 
-# 2. Pause compaction after the BACKUP-LOCK is written so we can cancel it.
+# 2. Set a pausepoint so the compaction pauses right after it writes the
+# BACKUP-LOCK, letting us cancel it while the lock is still present. The
+# crdb_internal.backup_compaction builtin starts the job asynchronously, so the
+# call returns immediately with the job ID; we wait for the job to pause
+# separately rather than expecting a synchronous pausepoint error.
 exec-sql
 SET CLUSTER SETTING jobs.debug.pausepoints = 'backup_compaction.after.details_has_checkpoint';
 ----
 
-compact expect-pausepoint start=start end=end tag=comp1
+compact start=start end=end tag=comp1
 SELECT crdb_internal.backup_compaction(0, 'BACKUP INTO LATEST IN ''nodelocal://1/test-root/''', '$backup_path', start, end);
 ----
-job paused at pausepoint
 
-# 3. Cancel the compaction job to trigger OnFailOrCancel cleanup.
+job tag=comp1 wait-for-state=paused
+----
+
+# 3. Cancel the paused compaction to trigger OnFailOrCancel, which cleans up the
+# BACKUP-LOCK file.
 job cancel=comp1
 ----
 
```

---

### Incident Patch 5: `144a7b9c` (2026-07-17)
**Commit Message**: Merge pull request #172571 from harryfallows/opt-histogram-unconstrained-prefix

opt: use histograms for constant columns outside of the exact prefix

**File**: `pkg/sql/opt/memo/testdata/stats/inverted-json-multi-column` (added, +163/-0)
```diff
@@ -0,0 +1,163 @@
+exec-ddl
+CREATE TABLE t (
+    k INT PRIMARY KEY,
+    i INT,
+    s STRING,
+    j JSONB,
+    INVERTED INDEX isj (i, s, j)
+)
+----
+
+exec-ddl
+ALTER TABLE t INJECT STATISTICS '[
+  {
+    "columns": ["i"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 41,
+    "null_count": 0
+  },
+  {
+    "columns": ["s"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 40,
+    "null_count": 100,
+    "histo_col_type": "string",
+    "histo_buckets": [
+      {"num_eq": 0, "num_range": 0, "distinct_range": 0, "upper_bound": "apple"},
+      {"num_eq": 100, "num_range": 200, "distinct_range": 9, "upper_bound": "banana"},
+      {"num_eq": 100, "num_range": 300, "distinct_range": 9, "upper_bound": "cherry"},
+      {"num_eq": 200, "num_range": 400, "distinct_range": 9, "upper_bound": "mango"},
+      {"num_eq": 200, "num_range": 400, "distinct_range": 9, "upper_bound": "pineapple"}
+    ]
+  },
+  {
+    "columns": ["j"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 10,
+    "null_count": 0,
+    "histo_col_type": "BYTES",
+    "histo_buckets": [
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x37000138"},
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x37000139"},
+      {"distinct_range": 0, "num_eq": 990, "num_range": 0, "upper_bound": "\\x37000300012a0200"},
+      {"distinct_range": 0, "num_eq": 100, "num_range": 0, "upper_bound": "\\x37000300012a0400"},
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x37000300012a0600"},
+      {"distinct_range": 0, "num_eq": 990, "num_range": 0, "upper_bound": "\\x3761000112620001"},
+      {"distinct_range": 0, "num_eq": 100, "num_range": 0, "upper_bound": "\\x3763000112640001"},
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x3765000112660001"}
+    ]
+  }
+]'
+----
+
+# Test a multi-column inverted index scan where the leading prefix column i
+# spans multiple values but the second prefix column s is held to a single
+# value. s's histogram should be used even though s is outside the exact prefix.
+opt
+SELECT k FROM t@isj WHERE i IN (200, 300) AND s = 'banana' AND j @> '{"a": "b"}'
+----
+project
+ ├── columns: k:1(int!null)
+ ├── immutable
+ ├── stats: [rows=1]
+ ├── key: (1)
+ └── scan t@isj,inverted
+      ├── columns: k:1(int!null)
+      ├── constraint: /2/3
+      │    ├── [/200/'banana' - /200/'banana']
+      │    └── [/300/'banana' - /300/'banana']
+      ├── inverted constraint: /7/1
+      │    └── spans: ["a"/"b", "a"/"b"]
+      ├── flags: force-index=isj
+      ├── stats: [rows=2.41463, distinct(2)=2, null(2)=0, distinct(3)=1, null(3)=0, distinct(7)=1, null(7)=0, distinct(3,7)=1, null(3,7)=0, distinct(2,3,7)=2, null(2,3,7)=0]
+      │   histogram(3)=  0   2.4146
+      │                <--- 'banana'
+      │   histogram(7)=  0         2.4146         0           0
+      │                <--- '\x3761000112620001' --- '\x3761000112620002'
+      └── key: (1)
+
+exec-ddl
+CREATE TABLE rbr (
+    k INT PRIMARY KEY,
+    s STRING,
+    j JSONB,
+    INVERTED INDEX sj (s, j)
+) LOCALITY REGIONAL BY ROW
+----
+
+exec-ddl
+ALTER TABLE rbr INJECT STATISTICS '[
+  {
+    "columns": ["crdb_region"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 3,
+    "null_count": 0
+  },
+  {
+    "columns": ["s"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 40,
+    "null_count": 100,
+    "histo_col_type": "string",
+    "histo_buckets": [
+      {"num_eq": 0, "num_range": 0, "distinct_range": 0, "upper_bound": "apple"},
+      {"num_eq": 100, "num_range": 200, "distinct_range": 9, "upper_bound": "banana"},
+      {"num_eq": 100, "num_range": 300, "distinct_range": 9, "upper_bound": "cherry"},
+      
```

**File**: `pkg/sql/opt/memo/testdata/stats/scan` (modified, +116/-0)
```diff
@@ -3466,3 +3466,119 @@ index-join stale
       ├── stats: [rows=0.00200002]
       ├── key: ()
       └── fd: ()-->(1-3)
+
+exec-ddl
+CREATE TABLE hist_multi (
+  k INT PRIMARY KEY,
+  a INT NOT NULL,
+  b INT,
+  INDEX ab (a, b)
+)
+----
+
+exec-ddl
+ALTER TABLE hist_multi INJECT STATISTICS '[
+  {
+    "columns": ["a"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 1000,
+    "distinct_count": 5,
+    "null_count": 0
+  },
+  {
+    "columns": ["b"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 1000,
+    "distinct_count": 40,
+    "null_count": 0,
+    "histo_col_type": "int",
+    "histo_buckets": [
+      {"num_eq": 0, "num_range": 0, "distinct_range": 0, "upper_bound": "0"},
+      {"num_eq": 10, "num_range": 90, "distinct_range": 9, "upper_bound": "10"},
+      {"num_eq": 20, "num_range": 180, "distinct_range": 9, "upper_bound": "20"},
+      {"num_eq": 30, "num_range": 270, "distinct_range": 9, "upper_bound": "30"},
+      {"num_eq": 40, "num_range": 360, "distinct_range": 9, "upper_bound": "40"}
+    ]
+  }
+]'
+----
+
+# The leading index column a spans multiple values while b is held to a single
+# value, so b's histogram is used for the estimate even though b falls outside
+# the constraint's exact prefix.
+opt
+SELECT k FROM hist_multi@ab WHERE a IN (1, 2) AND b = 10
+----
+project
+ ├── columns: k:1(int!null)
+ ├── stats: [rows=4]
+ ├── key: (1)
+ └── scan hist_multi@ab
+      ├── columns: k:1(int!null) a:2(int!null) b:3(int!null)
+      ├── constraint: /2/3/1
+      │    ├── [/1/10 - /1/10]
+      │    └── [/2/10 - /2/10]
+      ├── flags: force-index=ab
+      ├── stats: [rows=4, distinct(2)=2, null(2)=0, distinct(3)=1, null(3)=0, distinct(2,3)=2, null(2,3)=0]
+      │   histogram(3)=  0  4
+      │                <--- 10
+      ├── key: (1)
+      └── fd: ()-->(3), (1)-->(2)
+
+exec-ddl
+CREATE TABLE hist_rbr (
+  k INT PRIMARY KEY,
+  a INT,
+  INDEX a_idx (a)
+) LOCALITY REGIONAL BY ROW
+----
+
+exec-ddl
+ALTER TABLE hist_rbr INJECT STATISTICS '[
+  {
+    "columns": ["crdb_region"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 1000,
+    "distinct_count": 3,
+    "null_count": 0
+  },
+  {
+    "columns": ["a"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 1000,
+    "distinct_count": 40,
+    "null_count": 0,
+    "histo_col_type": "int",
+    "histo_buckets": [
+      {"num_eq": 0, "num_range": 0, "distinct_range": 0, "upper_bound": "0"},
+      {"num_eq": 10, "num_range": 90, "distinct_range": 9, "upper_bound": "10"},
+      {"num_eq": 20, "num_range": 180, "distinct_range": 9, "upper_bound": "20"},
+      {"num_eq": 30, "num_range": 270, "distinct_range": 9, "upper_bound": "30"},
+      {"num_eq": 40, "num_range": 360, "distinct_range": 9, "upper_bound": "40"}
+    ]
+  }
+]'
+----
+
+# On a REGIONAL BY ROW table with crdb_region left unconstrained, the optimizer
+# enumerates crdb_region into one span per region, so crdb_region varies while a
+# is held to a single value outside the exact prefix. a's histogram is still used.
+opt
+SELECT k FROM hist_rbr@a_idx WHERE a = 10
+----
+project
+ ├── columns: k:1(int!null)
+ ├── stats: [rows=10]
+ ├── key: (1)
+ └── scan hist_rbr@a_idx
+      ├── columns: k:1(int!null) a:2(int!null)
+      ├── constraint: /3/2/1
+      │    ├── [/'central'/10 - /'central'/10]
+      │    ├── [/'east'/10 - /'east'/10]
+      │    └── [/'west'/10 - /'west'/10]
+      ├── flags: force-index=a_idx
+      ├── stats: [rows=10, distinct(2)=1, null(2)=0]
+      │   histogram(2)=  0  10
+      │                <--- 10
+      ├── key: (1)
+      └── fd: ()-->(2)
```

**File**: `pkg/sql/opt/props/histogram.go` (modified, +32/-1)
```diff
@@ -333,7 +333,8 @@ func maxDistinctValuesInRange(lowerBound, upperBound tree.Datum) (n float64, ok
 
 // CanFilter returns true if the given constraint can filter the histogram.
 // This is the case if the histogram column matches one of the columns in
-// the exact prefix of c or the next column immediately after the exact prefix.
+// the exact prefix of c, the next column immediately after the exact prefix,
+// or a column constrained to a single value in every span (a constant column).
 // Returns the offset of the matching column in the constraint if found, as
 // well as the exact prefix.
 func (h *Histogram) CanFilter(
@@ -346,6 +347,17 @@ func (h *Histogram) CanFilter(
 			return i, exactPrefix, true
 		}
 	}
+	// A constant column (constrained to a single value in every span) can filter
+	// the histogram even when an earlier unconstrained column pushes it past the
+	// exact prefix, e.g. crdb_region on a REGIONAL BY ROW table. See Filter.
+	for i := exactPrefix + 1; i < constrainedCols; i++ {
+		if c.Columns.Get(i).ID() == h.col {
+			if c.ExtractConstCols(ctx, h.evalCtx).Contains(h.col) {
+				return i, exactPrefix, true
+			}
+			break
+		}
+	}
 	return 0, exactPrefix, false
 }
 
@@ -582,6 +594,25 @@ func (h *Histogram) Filter(ctx context.Context, c *constraint.Constraint) *Histo
 	if !ok {
 		panic(errors.AssertionFailedf("column mismatch"))
 	}
+
+	// A column past the exact prefix was admitted as a constant column with value
+	// V. The prefix-based path below assumes the columns before colOffset are
+	// fixed to the first span's values, which does not hold when an earlier
+	// column varies, so filter against a synthetic single-column [V - V]
+	// constraint instead.
+	if colOffset > exactPrefix {
+		val := c.Spans.Get(0).StartKey().Value(colOffset)
+		var cols constraint.Columns
+		cols.InitSingle(opt.MakeOrderingColumn(h.col, false /* descending */))
+		key := constraint.MakeKey(val)
+		var span constraint.Span
+		span.Init(key, constraint.IncludeBoundary, key, constraint.IncludeBoundary)
+		return h.filter(
+			ctx, 1 /* spanCount */, func(int) *constraint.Span { return &span },
+			false /* desc */, 0 /* colOffset */, 1 /* exactPrefix */, nil /* prefix */, cols,
+		)
+	}
+
 	prefix := make([]tree.Datum, colOffset)
 	for i := range prefix {
 		prefix[i] = c.Spans.Get(0).StartKey().Value(i)
```

**File**: `pkg/sql/opt/props/histogram_test.go` (modified, +15/-2)
```diff
@@ -79,7 +79,7 @@ func TestCanFilter(t *testing.T) {
 
 	// The histogram column ID is 1 for all test cases. CanFilter should only
 	// return true for constraints in which column ID 1 is part of the exact
-	// prefix or the first column after.
+	// prefix, the first column after, or a constant column.
 	testData := []struct {
 		constraint string
 		canFilter  bool
@@ -111,7 +111,8 @@ func TestCanFilter(t *testing.T) {
 		},
 		{
 			constraint: "/2/-1: [/0/3 - /0/3] [/2/3 - /2/3]",
-			canFilter:  false,
+			canFilter:  true,
+			colIdx:     1,
 		},
 		{
 			constraint: "/2/1: [/0/3 - /0/3] [/0/5 - /0/5]",
@@ -367,6 +368,18 @@ func TestHistogram(t *testing.T) {
 			distinct:     1,
 			maxFrequency: 5.71,
 		},
+		{
+			constraint: "/2/1: [/0/40 - /0/40] [/2/40 - /2/40]",
+			//   0 5.7143
+			// <---- 40 -
+			buckets: []cat.HistogramBucket{
+				{NumRange: 0, NumEq: 5.71, DistinctRange: 0, UpperBound: tree.NewDInt(40)},
+			},
+			count:        5.71,
+			maxDistinct:  1,
+			distinct:     1,
+			maxFrequency: 5.71,
+		},
 	}
 
 	for i := range testData {
```

---

### Incident Patch 6: `e325c8fe` (2026-07-14)
**Commit Message**: opt: use histograms for constant columns outside the exact prefix

When estimating the row count for a scan over an index whose leading
column is left unconstrained (and therefore spans multiple values), the
optimizer discarded the histogram of a later, equality-constrained column
and fell back to a distinct-count estimate. This happened because
Histogram.CanFilter only admitted a column whose position was within the
constraint's exact prefix, and an unconstrained leading column collapses
that exact prefix to zero.

The effect was most visible on REGIONAL BY ROW tables queried without
pinning crdb_region, especially for multi-column inverted indexes such as
(crdb_region, s, j): the inverted column kept its histogram via the
separate inverted-constraint path, while the forward prefix column s
silently lost its own, producing large row-count misestimates and, in
turn, suboptimal plans.

CanFilter now also admits a histogram column that is constrained to a
single value in every span (a constant column, per
Constraint.ExtractConstCols) even when it falls outside the exact prefix.
Filter cannot reuse the general prefix-based machinery in this case,
because that machinery assumes every c

**File**: `pkg/sql/opt/memo/testdata/stats/inverted-json-multi-column` (added, +163/-0)
```diff
@@ -0,0 +1,163 @@
+exec-ddl
+CREATE TABLE t (
+    k INT PRIMARY KEY,
+    i INT,
+    s STRING,
+    j JSONB,
+    INVERTED INDEX isj (i, s, j)
+)
+----
+
+exec-ddl
+ALTER TABLE t INJECT STATISTICS '[
+  {
+    "columns": ["i"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 41,
+    "null_count": 0
+  },
+  {
+    "columns": ["s"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 40,
+    "null_count": 100,
+    "histo_col_type": "string",
+    "histo_buckets": [
+      {"num_eq": 0, "num_range": 0, "distinct_range": 0, "upper_bound": "apple"},
+      {"num_eq": 100, "num_range": 200, "distinct_range": 9, "upper_bound": "banana"},
+      {"num_eq": 100, "num_range": 300, "distinct_range": 9, "upper_bound": "cherry"},
+      {"num_eq": 200, "num_range": 400, "distinct_range": 9, "upper_bound": "mango"},
+      {"num_eq": 200, "num_range": 400, "distinct_range": 9, "upper_bound": "pineapple"}
+    ]
+  },
+  {
+    "columns": ["j"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 10,
+    "null_count": 0,
+    "histo_col_type": "BYTES",
+    "histo_buckets": [
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x37000138"},
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x37000139"},
+      {"distinct_range": 0, "num_eq": 990, "num_range": 0, "upper_bound": "\\x37000300012a0200"},
+      {"distinct_range": 0, "num_eq": 100, "num_range": 0, "upper_bound": "\\x37000300012a0400"},
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x37000300012a0600"},
+      {"distinct_range": 0, "num_eq": 990, "num_range": 0, "upper_bound": "\\x3761000112620001"},
+      {"distinct_range": 0, "num_eq": 100, "num_range": 0, "upper_bound": "\\x3763000112640001"},
+      {"distinct_range": 0, "num_eq": 10, "num_range": 0, "upper_bound": "\\x3765000112660001"}
+    ]
+  }
+]'
+----
+
+# Test a multi-column inverted index scan where the leading prefix column i
+# spans multiple values but the second prefix column s is held to a single
+# value. s's histogram should be used even though s is outside the exact prefix.
+opt
+SELECT k FROM t@isj WHERE i IN (200, 300) AND s = 'banana' AND j @> '{"a": "b"}'
+----
+project
+ ├── columns: k:1(int!null)
+ ├── immutable
+ ├── stats: [rows=1]
+ ├── key: (1)
+ └── scan t@isj,inverted
+      ├── columns: k:1(int!null)
+      ├── constraint: /2/3
+      │    ├── [/200/'banana' - /200/'banana']
+      │    └── [/300/'banana' - /300/'banana']
+      ├── inverted constraint: /7/1
+      │    └── spans: ["a"/"b", "a"/"b"]
+      ├── flags: force-index=isj
+      ├── stats: [rows=2.41463, distinct(2)=2, null(2)=0, distinct(3)=1, null(3)=0, distinct(7)=1, null(7)=0, distinct(3,7)=1, null(3,7)=0, distinct(2,3,7)=2, null(2,3,7)=0]
+      │   histogram(3)=  0   2.4146
+      │                <--- 'banana'
+      │   histogram(7)=  0         2.4146         0           0
+      │                <--- '\x3761000112620001' --- '\x3761000112620002'
+      └── key: (1)
+
+exec-ddl
+CREATE TABLE rbr (
+    k INT PRIMARY KEY,
+    s STRING,
+    j JSONB,
+    INVERTED INDEX sj (s, j)
+) LOCALITY REGIONAL BY ROW
+----
+
+exec-ddl
+ALTER TABLE rbr INJECT STATISTICS '[
+  {
+    "columns": ["crdb_region"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 3,
+    "null_count": 0
+  },
+  {
+    "columns": ["s"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 2000,
+    "distinct_count": 40,
+    "null_count": 100,
+    "histo_col_type": "string",
+    "histo_buckets": [
+      {"num_eq": 0, "num_range": 0, "distinct_range": 0, "upper_bound": "apple"},
+      {"num_eq": 100, "num_range": 200, "distinct_range": 9, "upper_bound": "banana"},
+      {"num_eq": 100, "num_range": 300, "distinct_range": 9, "upper_bound": "cherry"},
+      
```

**File**: `pkg/sql/opt/memo/testdata/stats/scan` (modified, +116/-0)
```diff
@@ -3466,3 +3466,119 @@ index-join stale
       ├── stats: [rows=0.00200002]
       ├── key: ()
       └── fd: ()-->(1-3)
+
+exec-ddl
+CREATE TABLE hist_multi (
+  k INT PRIMARY KEY,
+  a INT NOT NULL,
+  b INT,
+  INDEX ab (a, b)
+)
+----
+
+exec-ddl
+ALTER TABLE hist_multi INJECT STATISTICS '[
+  {
+    "columns": ["a"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 1000,
+    "distinct_count": 5,
+    "null_count": 0
+  },
+  {
+    "columns": ["b"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 1000,
+    "distinct_count": 40,
+    "null_count": 0,
+    "histo_col_type": "int",
+    "histo_buckets": [
+      {"num_eq": 0, "num_range": 0, "distinct_range": 0, "upper_bound": "0"},
+      {"num_eq": 10, "num_range": 90, "distinct_range": 9, "upper_bound": "10"},
+      {"num_eq": 20, "num_range": 180, "distinct_range": 9, "upper_bound": "20"},
+      {"num_eq": 30, "num_range": 270, "distinct_range": 9, "upper_bound": "30"},
+      {"num_eq": 40, "num_range": 360, "distinct_range": 9, "upper_bound": "40"}
+    ]
+  }
+]'
+----
+
+# The leading index column a spans multiple values while b is held to a single
+# value, so b's histogram is used for the estimate even though b falls outside
+# the constraint's exact prefix.
+opt
+SELECT k FROM hist_multi@ab WHERE a IN (1, 2) AND b = 10
+----
+project
+ ├── columns: k:1(int!null)
+ ├── stats: [rows=4]
+ ├── key: (1)
+ └── scan hist_multi@ab
+      ├── columns: k:1(int!null) a:2(int!null) b:3(int!null)
+      ├── constraint: /2/3/1
+      │    ├── [/1/10 - /1/10]
+      │    └── [/2/10 - /2/10]
+      ├── flags: force-index=ab
+      ├── stats: [rows=4, distinct(2)=2, null(2)=0, distinct(3)=1, null(3)=0, distinct(2,3)=2, null(2,3)=0]
+      │   histogram(3)=  0  4
+      │                <--- 10
+      ├── key: (1)
+      └── fd: ()-->(3), (1)-->(2)
+
+exec-ddl
+CREATE TABLE hist_rbr (
+  k INT PRIMARY KEY,
+  a INT,
+  INDEX a_idx (a)
+) LOCALITY REGIONAL BY ROW
+----
+
+exec-ddl
+ALTER TABLE hist_rbr INJECT STATISTICS '[
+  {
+    "columns": ["crdb_region"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 1000,
+    "distinct_count": 3,
+    "null_count": 0
+  },
+  {
+    "columns": ["a"],
+    "created_at": "2018-01-01 1:00:00.00000+00:00",
+    "row_count": 1000,
+    "distinct_count": 40,
+    "null_count": 0,
+    "histo_col_type": "int",
+    "histo_buckets": [
+      {"num_eq": 0, "num_range": 0, "distinct_range": 0, "upper_bound": "0"},
+      {"num_eq": 10, "num_range": 90, "distinct_range": 9, "upper_bound": "10"},
+      {"num_eq": 20, "num_range": 180, "distinct_range": 9, "upper_bound": "20"},
+      {"num_eq": 30, "num_range": 270, "distinct_range": 9, "upper_bound": "30"},
+      {"num_eq": 40, "num_range": 360, "distinct_range": 9, "upper_bound": "40"}
+    ]
+  }
+]'
+----
+
+# On a REGIONAL BY ROW table with crdb_region left unconstrained, the optimizer
+# enumerates crdb_region into one span per region, so crdb_region varies while a
+# is held to a single value outside the exact prefix. a's histogram is still used.
+opt
+SELECT k FROM hist_rbr@a_idx WHERE a = 10
+----
+project
+ ├── columns: k:1(int!null)
+ ├── stats: [rows=10]
+ ├── key: (1)
+ └── scan hist_rbr@a_idx
+      ├── columns: k:1(int!null) a:2(int!null)
+      ├── constraint: /3/2/1
+      │    ├── [/'central'/10 - /'central'/10]
+      │    ├── [/'east'/10 - /'east'/10]
+      │    └── [/'west'/10 - /'west'/10]
+      ├── flags: force-index=a_idx
+      ├── stats: [rows=10, distinct(2)=1, null(2)=0]
+      │   histogram(2)=  0  10
+      │                <--- 10
+      ├── key: (1)
+      └── fd: ()-->(2)
```

**File**: `pkg/sql/opt/props/histogram.go` (modified, +31/-1)
```diff
@@ -333,7 +333,8 @@ func maxDistinctValuesInRange(lowerBound, upperBound tree.Datum) (n float64, ok
 
 // CanFilter returns true if the given constraint can filter the histogram.
 // This is the case if the histogram column matches one of the columns in
-// the exact prefix of c or the next column immediately after the exact prefix.
+// the exact prefix of c, the next column immediately after the exact prefix,
+// or a column constrained to a single value in every span (a constant column).
 // Returns the offset of the matching column in the constraint if found, as
 // well as the exact prefix.
 func (h *Histogram) CanFilter(
@@ -346,6 +347,16 @@ func (h *Histogram) CanFilter(
 			return i, exactPrefix, true
 		}
 	}
+	// A constant column (constrained to a single value in every span) can filter
+	// the histogram even when an earlier unconstrained column pushes it past the
+	// exact prefix, e.g. crdb_region on a REGIONAL BY ROW table. See Filter.
+	if c.ExtractConstCols(ctx, h.evalCtx).Contains(h.col) {
+		for i := 0; i < constrainedCols; i++ {
+			if c.Columns.Get(i).ID() == h.col {
+				return i, exactPrefix, true
+			}
+		}
+	}
 	return 0, exactPrefix, false
 }
 
@@ -582,6 +593,25 @@ func (h *Histogram) Filter(ctx context.Context, c *constraint.Constraint) *Histo
 	if !ok {
 		panic(errors.AssertionFailedf("column mismatch"))
 	}
+
+	// A column past the exact prefix was admitted as a constant column with value
+	// V. The prefix-based path below assumes the columns before colOffset are
+	// fixed to the first span's values, which does not hold when an earlier
+	// column varies, so filter against a synthetic single-column [V - V]
+	// constraint instead.
+	if colOffset > exactPrefix {
+		val := c.Spans.Get(0).StartKey().Value(colOffset)
+		var cols constraint.Columns
+		cols.InitSingle(opt.MakeOrderingColumn(h.col, false /* descending */))
+		key := constraint.MakeKey(val)
+		var span constraint.Span
+		span.Init(key, constraint.IncludeBoundary, key, constraint.IncludeBoundary)
+		return h.filter(
+			ctx, 1 /* spanCount */, func(int) *constraint.Span { return &span },
+			false /* desc */, 0 /* colOffset */, 1 /* exactPrefix */, nil /* prefix */, cols,
+		)
+	}
+
 	prefix := make([]tree.Datum, colOffset)
 	for i := range prefix {
 		prefix[i] = c.Spans.Get(0).StartKey().Value(i)
```

**File**: `pkg/sql/opt/props/histogram_test.go` (modified, +15/-2)
```diff
@@ -79,7 +79,7 @@ func TestCanFilter(t *testing.T) {
 
 	// The histogram column ID is 1 for all test cases. CanFilter should only
 	// return true for constraints in which column ID 1 is part of the exact
-	// prefix or the first column after.
+	// prefix, the first column after, or a constant column.
 	testData := []struct {
 		constraint string
 		canFilter  bool
@@ -111,7 +111,8 @@ func TestCanFilter(t *testing.T) {
 		},
 		{
 			constraint: "/2/-1: [/0/3 - /0/3] [/2/3 - /2/3]",
-			canFilter:  false,
+			canFilter:  true,
+			colIdx:     1,
 		},
 		{
 			constraint: "/2/1: [/0/3 - /0/3] [/0/5 - /0/5]",
@@ -367,6 +368,18 @@ func TestHistogram(t *testing.T) {
 			distinct:     1,
 			maxFrequency: 5.71,
 		},
+		{
+			constraint: "/2/1: [/0/40 - /0/40] [/2/40 - /2/40]",
+			//   0 5.7143
+			// <---- 40 -
+			buckets: []cat.HistogramBucket{
+				{NumRange: 0, NumEq: 5.71, DistinctRange: 0, UpperBound: tree.NewDInt(40)},
+			},
+			count:        5.71,
+			maxDistinct:  1,
+			distinct:     1,
+			maxFrequency: 5.71,
+		},
 	}
 
 	for i := range testData {
```

---

### Incident Patch 7: `b195566e` (2026-07-14)
**Commit Message**: ci/ai: fix the go-deeper hint, document the effort guard

The go-deeper footer hint listed (high|xhigh|max) as suggestions,
which for a fable-5 xhigh run offers a downgrade and a repeat. The
hint's condition already guarantees the run was not fable-5 at max,
so suggest only that: it is strictly deeper than any run that sees
the hint, with no effort-comparison logic.

Also expand the guard's comment to note that max — unlike xhigh — is
supported on Opus 4.6 (xhigh arrived later, slotted between high and
max), so the guard intentionally downgrades only xhigh. Downgrading
max as well would silently strip a supported capability.

Epic: none

Release note: None

Co-Authored-By: roachdev-claude <roachdev-claude-bot@cockroachlabs.com>

**File**: `.github/workflows/investigate.yml` (modified, +7/-3)
```diff
@@ -291,7 +291,9 @@ jobs:
               low|medium|high|xhigh|max) effort="$arg" ;;
             esac
           done
-          # Opus 4.6 predates the xhigh effort level.
+          # Opus 4.6 predates the xhigh effort level; max, in contrast,
+          # is supported on Opus 4.6 (xhigh arrived later, slotted
+          # between high and max), so only xhigh is downgraded.
           if [ "$model" = 'claude-opus-4-6' ] && [ "$effort" = 'xhigh' ]; then
             effort='high'
           fi
@@ -427,10 +429,12 @@ jobs:
           # Empty if the job failed before the Select model step.
           : "${CLAUDE_MODEL:=unknown}" "${CLAUDE_EFFORT:=unknown}"
           # Footer identifying the model, plus a pointer at the deeper
-          # settings (omitted when this run already used them).
+          # settings (omitted when this run already used them). The
+          # suggested setting is strictly deeper than any run that sees
+          # the hint, since fable-5 at max is excluded above.
           hint=''
           if [ "$CLAUDE_MODEL" != 'claude-fable-5' ] || [ "$CLAUDE_EFFORT" != 'max' ]; then
-            hint=' Use `/investigate fable-5 (high|xhigh|max)` to go deeper.'
+            hint=' Use `/investigate fable-5 max` to go deeper.'
           fi
           if [ -s artifacts/findings.md ]; then
             # Append the footers here rather than asking the agent to write
```

---

### Incident Patch 8: `0eedd74a` (2026-06-02)
**Commit Message**: roachtest: add OR to backup roundtrip chaos test and introduce an OR fixture chaos test (#170867)

roachtest: add OR to backup roundtrip chaos test and introduce an OR fixture chaos test

**File**: `pkg/cmd/roachtest/tests/backup_restore_roundtrip.go` (modified, +18/-3)
```diff
@@ -262,6 +262,10 @@ func backupRestoreChaos(ctx context.Context, t test.Test, c cluster.Cluster) {
 	workloadSeed := testRNG.Int63()
 	t.L().Printf("workload seed: %d", workloadSeed)
 
+	onlineRestore := testRNG.Intn(2) == 0
+	t.L().Printf("online restore: %t", onlineRestore)
+	t.AddParam("onlineRestore", fmt.Sprintf("%t", onlineRestore))
+
 	startOpts := roachtestutil.MaybeUseMemoryBudget(t, 50)
 	startOpts.RoachprodOpts.ExtraArgs = []string{"--vmodule=split_queue=3,cloud_logging_transport=1"}
 	c.Start(ctx, t.L(), startOpts, install.MakeClusterSettings(), c.CRDBNodes())
@@ -291,10 +295,8 @@ func backupRestoreChaos(ctx context.Context, t test.Test, c cluster.Cluster) {
 	// quite a while to backup. Considering the goal of this test, it'd be good
 	// to add some options to provide the caller with more flexibility over the
 	// workload.
-	// TODO (kev-cao): Once OR download phase is resilient to node failures, we
-	// can metamorphically add online restore to this test as well.
 	testUtils, err := setupBackupRestoreTestUtils(
-		ctx, t, c, testRNG, withCompaction(true),
+		ctx, t, c, testRNG, withCompaction(true), withOnlineRestore(onlineRestore),
 	)
 	require.NoError(t, err)
 	defer testUtils.CloseConnections()
@@ -376,6 +378,19 @@ func backupRestoreChaos(ctx context.Context, t test.Test, c cluster.Cluster) {
 		min(randFloatBetween(testRNG, 0.65, 1.1), 1),
 	)
 	require.NoError(t, restoreJob.WaitForJobSuccess(ctx))
+	// If running online restore, inject an additional failure during the download phase.
+	if onlineRestore {
+		downloadJobID, err := d.getORDownloadJobID(ctx, t.L(), testRNG)
+		require.NoError(t, err)
+		injectAndRecoverFailure(
+			ctx, t, t.L(), testUtils, testUtils.RandomNode(testRNG, liveNodes), downloadJobID, failer, args,
+			randFloatBetween(testRNG, 0.15, 0.50),
+			randFloatBetween(testRNG, 0.50, 0.66),
+		)
+		require.NoError(t, testUtils.waitForJobSuccess(
+			ctx, t.L(), testRNG, downloadJobID, true, /* internalSystemJobs */
+		))
+	}
 	require.NoError(t, restoreJob.ValidateRestore(ctx))
 }
 
```

**File**: `pkg/cmd/roachtest/tests/online_restore.go` (modified, +111/-0)
```diff
@@ -582,6 +582,117 @@ func registerOnlineRestoreRecovery(r registry.Registry) {
 	})
 }
 
+// registerOnlineRestoreChaos registers a roachtest that restores SmallFixture
+// (350 GiB TPCC) via online restore and injects a process-kill failure during
+// the download phase, then verifies the restored data against the fixture's
+// stored fingerprint. The link phase is fast (~20s) and the download is
+// ~10min, so most of the 4h timeout is reserved for the fingerprint check.
+func registerOnlineRestoreChaos(r registry.Registry) {
+	sp := onlineRestoreSpecs{
+		restoreSpecs: restoreSpecs{
+			hardware:   makeHardwareSpecs(hardwareSpecs{workloadNode: true}),
+			backup:     backupSpecs{cloud: spec.GCE, fixture: SmallFixture},
+			timeout:    4 * time.Hour,
+			suites:     registry.Suites(registry.Nightly),
+			namePrefix: "online-restore-chaos",
+		},
+	}
+	if !backuptestutils.IsOnlineRestoreSupported() {
+		sp.skip = "online restore is only tested on development branch"
+	}
+	sp.initTestName()
+	r.Add(registry.TestSpec{
+		Name:                      sp.testName,
+		Owner:                     registry.OwnerDisasterRecovery,
+		Cluster:                   sp.hardware.makeClusterSpecs(r),
+		Timeout:                   sp.timeout,
+		EncryptionSupport:         registry.EncryptionMetamorphic,
+		CompatibleClouds:          sp.backup.CompatibleClouds(),
+		Suites:                    sp.suites,
+		TestSelectionOptOutSuites: sp.suites,
+		SkipPostValidations:       registry.PostValidationReplicaDivergence,
+		Randomized:                true,
+		Monitor:                   true,
+		Skip:                      sp.skip,
+		Run: func(ctx context.Context, t test.Test, c cluster.Cluster) {
+			runOnlineRestoreChaos(ctx, t, c, sp)
+		},
+	})
+}
+
+func runOnlineRestoreChaos(
+	ctx context.Context, t test.Test, c cluster.Cluster, sp onlineRestoreSpecs,
+) {
+	testRNG, seed := randutil.NewLockedPseudoRand()
+	t.L().Printf("random seed: %d", seed)
+
+	rd := makeRestoreDriver(ctx, t, c, sp.restoreSpecs)
+	rd.prepareCluster(ctx)
+
+	testUtils, err := setupBackupRestoreTestUtils(
+		ctx, t, c, testRNG, withOnlineRestore(true), withCompaction(false),
+	)
+	require.NoError(t, err)
+	defer testUtils.CloseConnections()
+	defer testUtils.takeDebugZip(ctx, t.L())
+
+	// Cap the download retry duration so a stalled job pauses in minutes
+	// rather than after the 72h default.
+	require.NoError(t, testUtils.Exec(ctx, testRNG,
+		"SET CLUSTER SETTING backup.restore.online_download_retry_max_duration = '30m'",
+	))
+
+	const numToKill = 1
+	failureNodes := c.CRDBNodes()[:numToKill]
+	liveNodes := c.CRDBNodes()[numToKill:]
+	isGraceful := testRNG.Intn(2) == 0
+	t.L().Printf("process kill failure isGraceful: %t", isGraceful)
+	t.Monitor().ExpectProcessDead(failureNodes)
+	failer, args, err := roachtestutil.MakeProcessKillFailer(
+		t.L(), c, failureNodes, isGraceful, 5*time.Minute, /* gracePeriod */
+	)
+	require.NoError(t, err)
+	require.NoError(t, failer.Setup(ctx, t.L(), args))
+	defer func() {
+		if err := failer.Cleanup(ctx, t.L()); err != nil {
+			t.L().Printf("failed to clean up failure: %v", err)
+		}
+	}()
+
+	// Link phase. The non-detached restore blocks until the link completes,
+	// after which the download job is queryable from the jobs table.
+	if _, _, err := executeTestRestorePhase(
+		ctx, t, c, sp, rd, true, /* runOnline */
+	); err != nil {
+		t.Fatal(err)
+	}
+
+	queryNode := testUtils.RandomNode(testRNG, liveNodes)
+	var downloadJobID int
+	require.NoError(t, testUtils.QueryRow(ctx, testRNG,
+		`SELECT job_id FROM [SHOW JOBS]
+		 WHERE description LIKE '%Background Data Download%' AND job_type = 'RESTORE'
+		 ORDER BY created DESC LIMIT 1`,
+	).Scan(&downloadJobID))
+	t.L().Printf("OR download job id: %d", downloadJobID)
+
+	injectAndRecoverFailure(
+		ctx, t, t.L(), testUtils, queryNode, downloadJobID, failer, args,
+		randFloatBetween(testRNG, 0.15, 0.50),
+		randFloatBetween(testRNG, 0.50, 0.66),
+	)
+
+	// injectAndRecoverFailure returns 
```

**File**: `pkg/cmd/roachtest/tests/registry.go` (modified, +1/-0)
```diff
@@ -143,6 +143,7 @@ func RegisterTests(r registry.Registry) {
 	registerOnlineRestorePerfBreakdown(r)
 	registerFastRestorePerf(r)
 	registerOnlineRestoreCorrectness(r)
+	registerOnlineRestoreChaos(r)
 	registerRoachmart(r)
 	registerRoachtest(r)
 	registerRubyPG(r)
```

---

### Incident Patch 9: `78450ef4` (2026-06-02)
**Commit Message**: security: remove CCL imports (#171247)

security: remove CCL imports

**File**: `pkg/security/jwtauth/BUILD.bazel` (modified, +0/-1)
```diff
@@ -41,7 +41,6 @@ go_test(
     embed = [":jwtauth"],
     deps = [
         "//pkg/base",
-        "//pkg/ccl",
         "//pkg/security/certnames",
         "//pkg/security/securityassets",
         "//pkg/security/securitytest",
```

**File**: `pkg/security/jwtauth/main_test.go` (modified, +0/-2)
```diff
@@ -10,7 +10,6 @@ import (
 	"testing"
 
 	"github.com/cockroachdb/cockroach/pkg/base"
-	"github.com/cockroachdb/cockroach/pkg/ccl"
 	"github.com/cockroachdb/cockroach/pkg/security/securityassets"
 	"github.com/cockroachdb/cockroach/pkg/security/securitytest"
 	"github.com/cockroachdb/cockroach/pkg/server"
@@ -20,7 +19,6 @@ import (
 )
 
 func TestMain(m *testing.M) {
-	defer ccl.TestingEnableEnterprise()()
 	securityassets.SetLoader(securitytest.EmbeddedAssets)
 	randutil.SeedForTests()
 	serverutils.InitTestServerFactory(
```

**File**: `pkg/security/ldapauth/BUILD.bazel` (modified, +0/-1)
```diff
@@ -43,7 +43,6 @@ go_test(
     embed = [":ldapauth"],
     deps = [
         "//pkg/base",
-        "//pkg/ccl",
         "//pkg/security/certnames",
         "//pkg/security/distinguishedname",
         "//pkg/security/securityassets",
```

**File**: `pkg/security/ldapauth/ldap_util.go` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@ func (lu *ldapUtil) ListGroups(
 	return ldapGroupsDN, nil
 }
 
-// ILDAPUtil is an interface for the `ldapauthccl` library to wrap various LDAP
+// ILDAPUtil is an interface for the `ldapauth` library to wrap various LDAP
 // functionalities exposed by `go-ldap` library as part of CRDB modules for
 // authN and authZ.
 type ILDAPUtil interface {
```

**File**: `pkg/security/ldapauth/main_test.go` (modified, +0/-2)
```diff
@@ -10,7 +10,6 @@ import (
 	"testing"
 
 	"github.com/cockroachdb/cockroach/pkg/base"
-	"github.com/cockroachdb/cockroach/pkg/ccl"
 	"github.com/cockroachdb/cockroach/pkg/security/securityassets"
 	"github.com/cockroachdb/cockroach/pkg/security/securitytest"
 	"github.com/cockroachdb/cockroach/pkg/server"
@@ -20,7 +19,6 @@ import (
 )
 
 func TestMain(m *testing.M) {
-	defer ccl.TestingEnableEnterprise()()
 	securityassets.SetLoader(securitytest.EmbeddedAssets)
 	randutil.SeedForTests()
 	serverutils.InitTestServerFactory(
```

---

### Incident Patch 10: `e40eab30` (2026-06-02)
**Commit Message**: sql: fix FETCH FIRST on empty WITH HOLD cursor

FETCH FIRST on an empty persisted WITH HOLD cursor discarded the
"no more rows" signal from sqlCursor.Next and returned true, causing
the caller to decode an unset EncDatum. Propagate Next's (more, err)
directly, matching the FetchAbsolute path.

Fixes #171238

Release note (bug fix): FETCH FIRST on an empty WITH HOLD cursor no
longer returns an internal error.

**File**: `pkg/sql/logictest/testdata/logic_test/cursor` (modified, +17/-0)
```diff
@@ -943,3 +943,20 @@ statement ok
 CLOSE foo;
 
 subtest end
+
+# Regression test for FETCH FIRST on a persisted WITH HOLD cursor over an
+# empty result set returning an internal error instead of zero rows (#171238).
+subtest regression_171238
+
+statement ok
+BEGIN;
+DECLARE foo_first CURSOR WITH HOLD FOR SELECT * FROM empty;
+COMMIT;
+
+query empty
+FETCH FIRST FROM foo_first;
+
+statement ok
+CLOSE foo_first;
+
+subtest end
```

**File**: `pkg/sql/sql_cursor.go` (modified, +2/-2)
```diff
@@ -288,8 +288,8 @@ func (b *fetchMoveNodeBase) nextInternal(ctx context.Context) (bool, error) {
 		case tree.FetchFirst:
 			switch b.cursor.curRow {
 			case 0:
-				_, err := b.cursor.Next(ctx)
-				return true, err
+				more, err := b.cursor.Next(ctx)
+				return more, err
 			case 1:
 				return true, nil
 			}
```

#### Recent Merged Pull Requests:
- **PR #175795** (closed): opt: penalize full scans of partial indexes under AVOID_FULL_SCAN (@u9g)
- **PR #175770** (2026-09-23): .github: forward autosolve labels to the code repository's workflow (@rafiss)
- **PR #175567** (2026-09-22): .github: run CI agents on the full Claude Code system prompt (@rafiss)
- **PR #175564** (2026-09-16): .github: fix issue autosolver diagnostics and retry behavior (@rafiss)
- **PR #175527** (2026-09-15): readme: update to new logo (@jlinder)
- **PR #175476** (closed): sql: handle empty geography in inverted DWithin joins (@sakshichitnis27)
- **PR #175301** (closed): sql: resolve PostgreSQL timezone abbreviations as fixed offsets (@Alignyx)
- **PR #174717** (closed): sql: stabilize decimal VARIANCE with large offsets (@Alignyx)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
