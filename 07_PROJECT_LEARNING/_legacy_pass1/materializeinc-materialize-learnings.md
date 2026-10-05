# Forensic Learning Record (Deep Inspection): MaterializeInc/materialize

> **Canonical Artifact**: `07_PROJECT_LEARNING/materializeinc-materialize-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MaterializeInc/materialize](https://github.com/MaterializeInc/materialize))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:46:56.611Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MaterializeInc/materialize`
- **Description**: The live data layer for apps and AI agents. Create up-to-the-second views into your business, just using SQL
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: pyproject.toml, Cargo.toml, README.md
- **Stars / Engagement**: 6379 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/mz-query-tracing/trace_tree.py`
```
# Copyright Materialize, Inc. and contributors. All rights reserved.
#
# Use of this software is governed by the Business Source License
# included in the LICENSE file at the root of this repository.
#
# As of the Change Date specified in that file, in accordance with
# the Business Source License, use of this software will be governed
# by the Apache License, Version 2.0.

"""Analyze a Tempo trace JSON file and print a hierarchical span tree."""

import base64
import json
import sys


def decode_id(b64_id):
    """Decode a base64-encoded span/trace ID to hex string."""
    if not b64_id:
        return ""
    try:
        return base64.b64decode(b64_id).hex()
    except Exception:
        return b64_id


def parse_trace(filepath):
    with open(filepath) as f:
        data = json.load(f)
    spans = []
    for batch in data.get("batches", []):
        for scope_spans in batch.get("scopeSpans", []):
            for span in scope_spans.get("spans", []):
                start = int(span["startTimeUnixNano"])
                end = int(span["endTimeUnixNano"])
                attrs = {}
                for a in span.get("attributes", []):
                    v = a.get("value", {})
                    val = (
                        v.get("stringValue")
                        or v.get("intValue")
                        or v.get("boolValue")
                        or v.get("doubleValue")
                        or ""
                    )
                    attrs[a["key"]] = val
                spans.append(
                    {
                        "name": span["name"],
                        "spanId": decode_id(span.get("spanId", "")),
                        "parentSpanId": decode_id(span.get("parentSpanId", "")),
                        "startNs": start,
                        "endNs": end,
                        "durationNs": end - start,
                        "attributes": attrs,
                    }
                )
    return spans


def build_tree(spans):
    by_id = {s["spanId"]: s for s in spans}
    children = {}
    roots = []
    for s in spans:
        pid = s["parentSpanId"]
        if pid and pid in by_id:
            children.setdefault(pid, []).append(s)
        else:
            roots.append(s)
    return roots, children


def fmt_dur(ns):
    ms = ns / 1e6
    if ms >= 1000:
        return f"{ms/1000:.2f}s "
    elif ms >= 1:
        return f"{ms:.1f}ms"
    elif ms >= 0.001:
        return f"{ns/1000:.0f}us"
    else:
        return f"{ns}ns"


def self_time(node, children_map):
    child_time = sum(c["durationNs"] for c in children_map.get(node["spanId"], []))
    return max(0, node["durationNs"] - child_time)


def print_tree(node, children_map, indent=0, min_ms=0.1):
    dur_ms = node["durationNs"] / 1e6
    if dur_ms < min_ms:
        return
    loc = ""
    if "code.file.path" in node["attributes"]:
        loc = f' [{node["attributes"]["code.file.path"]}'
        if "code.line.number" in node["attributes"]:
            loc += f':{node["attributes"]["code.line.number"]}'
        loc += "]"
    st = self_time(node, children_map)
    prefix = "  " * indent
    print(
        f"{prefix}{fmt_dur(node['durationNs']):>10}  (self: {fmt_dur(st):>10})  {node['name']}{loc}"
    )
    for child in sorted(
        children_map.get(node["spanId"], []), key=lambda s: s["startNs"]
    ):
        print_tree(child, children_map, indent + 1, min_ms)


def analyze(filepath, label=""):
    spans = parse_trace(filepath)
    roots, children = build_tree(spans)
    if label:
        print(f"\n{'='*80}\n  {label}\n{'='*80}")
    print(f"\nTotal spans: {len(spans)}")
    print(f"Root duration: {fmt_dur(sum(r['durationNs'] for r in roots))}")

    # Top by self-time
    ranked = sorted(
        [(s, self_time(s, children)) for s in spans], key=lambda x: x[1], reverse=True
    )
    print("\nTop 15 spans by self-time (where actual work happens):")
    print(f"{'Self Time':>12}  {'Total':>12}  Name")
    print(f"{'-'*12}  {'-'*12}  {'-'*60}")
    for s, st in ranked[:15]:
        print(f"{fmt_dur(st):>12}  {fmt_dur(s['durationNs']):>12}  {s['name']}")

    # Span tree
    print(f"\nSpan tree (>= 0.1ms):\n{'-'*80}")
    for root in sorted(roots, key=lambda s: s["startNs"]):
        print_tree(root, children)
        print()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <trace.json> [label]")
        sys.exit(1)
    analyze(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "")

```

### Core Architecture Module: `.agents/skills/mz-release-signoff/scripts/catalog_names.py`
```
# Copyright Materialize, Inc. and contributors. All rights reserved.
#
# Use of this software is governed by the Business Source License
# included in the LICENSE file at the root of this repository.
#
# As of the Change Date specified in that file, in accordance with
# the Business Source License, use of this software will be governed
# by the Apache License, Version 2.0.

"""Read a metrics catalog on stdin and print its metric names, sorted.

The catalog is doc/user/data/metrics.yml, generated by bin/gen-metrics-catalog.
Parsing it with a regex rather than a YAML library keeps this dependency-free,
which matters because it runs against arbitrary git refs during a sign-off.
"""

import re
import sys

NAME = re.compile(r"^- name: '?(.+?)'?$")


def main() -> None:
    names = set()
    for line in sys.stdin:
        match = NAME.match(line.rstrip("\n"))
        if match:
            names.add(match.group(1))
    for name in sorted(names):
        print(name)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.agents/skills/mz-release-signoff/scripts/lint_metrics.py`
```
# Copyright Materialize, Inc. and contributors. All rights reserved.
#
# Use of this software is governed by the Business Source License
# included in the LICENSE file at the root of this repository.
#
# As of the Change Date specified in that file, in accordance with
# the Business Source License, use of this software will be governed
# by the Apache License, Version 2.0.

"""Check that every `mz_*` metric named by the skill resolves in the catalog.

Run from the repository root. Exits non-zero and names the offenders on failure.
"""

import fnmatch
import pathlib
import re
import sys

SKILL = pathlib.Path(".agents/skills/mz-release-signoff")
CATALOG = pathlib.Path("doc/user/data/metrics.yml")
ALLOWLIST = SKILL / "scripts" / "metrics-allowlist.txt"

CATALOG_NAME = re.compile(r"^- name: '?(.+?)'?$")
BACKTICKED = re.compile(r"`([^`]+)`")
CANDIDATE = re.compile(r"\b(mz_[a-z0-9_]+)\b")
# Markdown allows a fence to open with backticks or tildes and to be indented by
# up to three spaces, and leaves an unterminated fence running to end of file.
# Missing any of those shapes costs silent under-coverage rather than a failure,
# so match them all. A fence nested in a longer one would need a backreference on
# the opening run, which the skill's markdown does not call for.
FENCED = re.compile(r"^ {0,3}(?:`{3}|~{3}).*?(?:^ {0,3}(?:`{3}|~{3})|\Z)", re.S | re.M)
# A roster row abbreviates a family as `mz_foo_bar`, `_baz`, `_qux`.
CONTINUATION = re.compile(r"^_[a-z0-9_]+$")

# Histograms and summaries are catalogued as their expanded families, so a
# reference naming the base is correct and must resolve through any suffix.
SUFFIXES = ("_bucket", "_count", "_sum")


def catalog_names():
    """Return (exact names, glob patterns) from the catalog.

    A `metric!` whose name is built with `format!` is catalogued with its
    placeholders globbed, for example `mz_persist_*_bytes`, so the catalog is
    a mix of literal names and patterns and membership is not a set lookup.
    """
    exact, globs = set(), set()
    for line in CATALOG.read_text().splitlines():
        match = CATALOG_NAME.match(line)
        if match:
            name = match.group(1)
            (globs if "*" in name else exact).add(name)
    # A base name is resolvable when any member of its family is catalogued.
    bases = {
        name.rsplit("_", 1)[0]
        for name in exact
        if name.rsplit("_", 1)[-1] in ("bucket", "count", "sum")
    }
    return exact | bases, globs


def resolves(name, exact, globs):
    if name in exact:
        return True
    # Try the histogram and summary suffixes against the patterns too, so a
    # reference naming the base of a globbed family still resolves.
    candidates = [name] + [name + suffix for suffix in SUFFIXES]
    return any(
        fnmatch.fnmatchcase(candidate, pattern)
        for candidate in candidates
        for pattern in globs
    )


def resolve_continuation(continuation, base, exact, globs, allowed):
    """Resolve `_baz` against the family of a preceding `mz_foo_bar`.

    Return every name the continuation resolves to, longest base first. How
    many components the continuation drops is not stated by the row, so every
    cut of the base has to be tried: the roster writes both
    `mz_persist_gc_seconds`, `_started`, which drops one, and
    `mz_compute_controller_replica_count`, `_peek_count`, which drops two.

    More than one hit means the row is not pinned to a single metric. That
    matters on removal rather than today, because the longest cut is the
    intended one and comes first: delete the intended metric and a shorter cut
    still resolves, so the row stays green while pointing at nothing. The
    caller rejects an ambiguous row for that reason, and the fix is to spell
    the member out in full.
    """
    parts = base.split("_")
    candidates = [
        "_".join(parts[:cut]) + continuation for cut in range(len(parts) - 1, 0, -1)
    ]
    return [
        candidate
        for candidate in candidates
        if candidate in allowed or resolves(candidate, exact, globs)
    ]


def allowlisted():
    names = set()
    for line in ALLOWLIST.read_text().splitlines():
        line = line.split("#", 1)[0].strip()
        if line:
            names.add(line)
    return names


def names_in(token):
    """Yield every catalogued-namespace metric name inside one code token.

    A wildcard names a family whose stem is not itself catalogued, so a name
    written as a glob stem is skipped. The test is per name rather than per
    whitespace-delimited word, because a PromQL selector puts a label matcher
    such as {mz_version!~".*-dev.*"} in the same word as the metric name.
    """
    for match in CANDIDATE.finditer(token):
        name = match.group(1)
        follows = token[match.end() : match.end() + 1]
        if follows == "*":
            continue
        # A trailing underscore continues the name only when something follows
        # it: brace expansion such as `mz_foo_{sum,count}`, whose base the
        # catalog holds as an expanded family. Standing alone the token is a
        # prefix named in prose, as in "its `mz_compute_` prefix".
        if name.endswith("_"):
            if follows != "{":
                continue
            name = name.rstrip("_")
        yield name


def names_in_document(text):
    """Yield (label, name, base) for every metric named in one markdown file.

    `base` is None for a name written out in full, and the name an abbreviation
    attaches to otherwise.

    Fenced blocks have to be pulled out before backticks are paired. A fence
    contains backticks of its own, so pairing sequentially across one flips the
    parity of every span after it: prose gets captured as code and the real
    code spans become the separators between matches. Left unhandled, that
    silently disables the check for every file containing a fence.
    """
    for block in FENCED.findall(text):
        for name in names_in(block):
            yield name, name, None
    # Continuations abbreviate within a single roster row, so the base is only
    # sought on the same line. Tracking it across lines attaches a `_sum` to
    # whatever full name happened to appear in an earlier paragraph, which
    # manufactures failures rather than finding them.
    for line in FENCED.sub("\n", text).splitlines():
        previous = None
        for span in BACKTICKED.findall(line):
            stripped = span.strip()
            # A bare histogram suffix is prose about the parts of a histogram,
            # as in "the `_sum` rate of `mz_slow_message_handling`", never a
            # family member abbreviated in a roster row.
            if stripped in SUFFIXES:
                continue
            if CONTINUATION.match(stripped):
                # With no in-scope base on this line the continuation belongs
                # to a family the catalog does not hold, such as v2_mz_* or
                # container_*, and cannot be checked.
                if previous:
                    yield f"{stripped} (after {previous})", stripped, previous
                continue
            for name in names_in(span):
                yield name, name, None
                previous = name


def referenced():
    for path in sorted(SKILL.rglob("*.md")):
        for label, name, base in names_in_document(path.read_text()):
            yield label, name, base, path


# How many names each file contributes. A parity bug drops a whole file at once
# and changes no name that survives, so a count is what catches it, and the
# version of this lint that shipped without one checked nothing in three of the
# six files while exiting 0. Update deliberately when a reference gains or loses
# a metric, never to make the test pass.
REFERENCE_NAME_COUNTS = {
    "SKILL.md": 18,
    "adapter.md": 35,
    "compute.md": 31,
    "persist.md": 84,
    "reference-dashboards.md": 24,
    "sources-and-sinks.md": 63,
}


def reference_name_counts():
    c
```

### Core Architecture Module: `.agents/skills/mz-release-signoff/scripts/panel-metrics.py`
```
# Copyright Materialize, Inc. and contributors. All rights reserved.
#
# Use of this software is governed by the Business Source License
# included in the LICENSE file at the root of this repository.
#
# As of the Change Date specified in that file, in accordance with
# the Business Source License, use of this software will be governed
# by the Apache License, Version 2.0.

"""Extract metric names and label selectors from a dashboard panel-query dump.

`mcp__grafana__get_dashboard_panel_queries` returns about 62 KB across 165
panels for the compute dashboard, which overflows the tool result and is
written to a file instead. That file must never be read whole or pasted into
the conversation. Slice it with this:

    $ panel-metrics.py panels.json                 # metric -> panels that use it
    $ panel-metrics.py panels.json --selectors     # also show label selectors
    $ panel-metrics.py panels.json --names-only    # bare names, for a roster

The output is a superset of what the build exports, because a panel outlives
the metric it plots. Resolve the names against the catalog for the release
under test before trusting them.
"""

import argparse
import collections
import json
import re
import sys

# A PromQL metric name, optionally followed by a label selector. Excludes
# names immediately preceded by a word character so that `foo_bucket` inside
# an already-matched token is not matched again.
METRIC = re.compile(
    r"(?<![\w.])((?:mz_|v2_mz_|container_|kube_|kubelet_|crdb_)[a-z0-9_]+)(\{[^}]*\})?"
)

# PromQL keywords that can precede a brace and would otherwise look like a name.
NOT_METRICS = {"by", "on", "without", "group_left", "group_right", "ignoring", "offset"}


def panels(doc):
    """Yield (title, query) for each panel target, tolerating both dump shapes."""
    items = doc if isinstance(doc, list) else doc.get("panels", doc.get("targets", []))
    for item in items:
        if not isinstance(item, dict):
            continue
        title = item.get("title") or item.get("refId") or "<untitled>"
        query = item.get("query") or item.get("processedQuery") or item.get("expr")
        if query:
            yield title, query


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("dump", help="JSON file written by get_dashboard_panel_queries")
    parser.add_argument(
        "--selectors", action="store_true", help="show label selectors too"
    )
    parser.add_argument(
        "--names-only", action="store_true", help="print bare metric names"
    )
    args = parser.parse_args()

    with open(args.dump) as f:
        doc = json.load(f)

    uses = collections.defaultdict(set)
    selectors = collections.defaultdict(set)
    for title, query in panels(doc):
        for name, selector in METRIC.findall(query):
            if name in NOT_METRICS:
                continue
            uses[name].add(title)
            if selector:
                selectors[name].add(selector)

    if not uses:
        print("no metric names found; check the dump shape", file=sys.stderr)
        return 1

    for name in sorted(uses):
        if args.names_only:
            print(name)
            continue
        print(f"{name}  ({len(uses[name])} panels)")
        if args.selectors:
            for selector in sorted(selectors[name]):
                print(f"    {selector}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `ci/cleanup/aws.py`
```
# Copyright Materialize, Inc. and contributors. All rights reserved.
#
# Use of this software is governed by the Business Source License
# included in the LICENSE file at the root of this repository.
#
# As of the Change Date specified in that file, in accordance with
# the Business Source License, use of this software will be governed
# by the Apache License, Version 2.0.

from datetime import datetime, timedelta, timezone
from pathlib import PurePosixPath
from typing import Any
from urllib.parse import unquote, urlparse

import boto3

from materialize import scratch

MAX_AGE = timedelta(hours=1)


def clean_up_kinesis() -> None:
    print(f"Deleting Kinesis streams whose age exceeds {MAX_AGE}")
    client = boto3.client("kinesis")
    streams = client.list_streams()["StreamNames"]
    for stream in streams:
        if not stream.startswith("testdrive"):
            print("Skipping non-testdrive stream {}", stream)
            continue
        desc = client.describe_stream(StreamName=stream)
        created_at = desc["StreamDescription"]["StreamCreationTimestamp"]
        age = datetime.now(timezone.utc) - created_at
        if age <= MAX_AGE:
            print(f"Skipping stream {stream} whose age is beneath threshold")
            continue
        print(f"Deleting Kinesis stream {stream!r} (age={age})")
        client.delete_stream(StreamName=stream)


def clean_up_s3() -> None:
    print(f"Deleting S3 buckets whose age exceeds {MAX_AGE}")
    client = boto3.client("s3")
    buckets = client.list_buckets()["Buckets"]
    for desc in buckets:
        if not desc["Name"].startswith("testdrive"):
            print("Skipping non-testdrive bucket {}".format(desc["Name"]))
            continue
        age = datetime.now(timezone.utc) - desc["CreationDate"]
        if age <= MAX_AGE:
            print(
                "Skipping bucket {} whose age is beneath threshold".format(desc["Name"])
            )
            continue
        print("Deleting bucket {} (age={})".format(desc["Name"], age))
        try:
            bucket = boto3.resource("s3").Bucket(desc["Name"])
            bucket.objects.all().delete()
            bucket.delete()
        except client.exceptions.NoSuchBucket:
            print(
                f"Couldn't delete {desc['Name']}: NoSuchBucket. This might be a transient issue."
            )


def clean_up_sqs() -> None:
    print(f"Deleting SQS queues whose age exceeds {MAX_AGE}")
    client = boto3.client("sqs")
    queues = client.list_queues()
    if "QueueUrls" in queues:
        for queue in queues["QueueUrls"]:
            name = PurePosixPath(unquote(urlparse(queue).path)).parts[2]
            if not name.startswith("testdrive"):
                print(f"Skipping non-testdrive queue {name}")
                continue
            attributes = client.get_queue_attributes(
                QueueUrl=queue, AttributeNames=["All"]
            )
            created_at = int(attributes["Attributes"]["CreatedTimestamp"])
            age = datetime.now(timezone.utc) - datetime.fromtimestamp(
                created_at, timezone.utc
            )
            if age <= MAX_AGE:
                print(f"Skipping queue {name} whose age is beneath threshold")
                continue
            print(f"Deleting SQS queue {name} (age={age})")
            client.delete_queue(QueueUrl=queue)


def clean_up_ec2() -> None:
    print("Terminating scratch ec2 instances whose age exceeds the deletion time")
    olds = [i["InstanceId"] for i in scratch.get_old_instances()]
    if olds:
        print(f"Instances to delete: {olds}")
        boto3.client("ec2").terminate_instances(InstanceIds=olds)
    else:
        print("No instances to delete")


def clean_up_iam() -> None:
    client = boto3.client("iam")
    roles = get_testdrive_roles(client)

    if not roles:
        print("No testdrive IAM roles found")
        return

    now = datetime.utcnow().timestamp()

    print(f"Found {len(roles)} candidate IAM roles for deletion")
    for role in roles:
        used = role.get("RoleLastUsed", {}).get("LastUsedDate")
        if used is None:
            used = role["CreateDate"]

        role_name = role["RoleName"]
        expiration = (used + MAX_AGE).timestamp()
        if now > expiration:
            policy_response = client.list_role_policies(RoleName=role_name)
            for policy_name in policy_response.get("PolicyNames", []):
                client.delete_role_policy(RoleName=role_name, PolicyName=policy_name)

            client.delete_role(RoleName=role_name)
            print(f"Deleted role {role_name}")
        else:
            print(f"Skipping role {role_name}")


def get_testdrive_roles(client: Any) -> list[Any]:
    roles = []

    paginator = client.get_paginator("list_roles")
    page_iterator = paginator.paginate()

    for page in page_iterator:
        roles.extend(page.get("Roles", []))

    return [r for r in roles if r["RoleName"].startswith("testdrive")]


def main() -> None:
    clean_up_kinesis()
    clean_up_s3()
    clean_up_sqs()
    clean_up_ec2()
    clean_up_iam()


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `ci/cleanup/launchdarkly.py`
```
# Copyright Materialize, Inc. and contributors. All rights reserved.
#
# Use of this software is governed by the Business Source License
# included in the LICENSE file at the root of this repository.
#
# As of the Change Date specified in that file, in accordance with
# the Business Source License, use of this software will be governed
# by the Apache License, Version 2.0.

from datetime import datetime, timedelta
from os import environ

import launchdarkly_api  # type: ignore
from launchdarkly_api.api import feature_flags_api  # type: ignore

MAX_AGE = timedelta(hours=24)

# Access keys required for interacting with LaunchDarkly.
LAUNCHDARKLY_API_TOKEN = environ.get("LAUNCHDARKLY_API_TOKEN")


def clean_up_test_features() -> None:
    print(f"Deleting LaunchDarkly features whose age exceeds {MAX_AGE}")

    configuration = launchdarkly_api.Configuration(
        api_key=dict(ApiKey=LAUNCHDARKLY_API_TOKEN)
    )
    with launchdarkly_api.ApiClient(configuration) as api_client:
        api = feature_flags_api.FeatureFlagsApi(api_client)

        project_key = "default"
        now = datetime.utcnow()

        flags = api.get_feature_flags(
            project_key,
            env="ci-cd",
            tag="ci-test",
            archived=True,
        )

        for flag in flags["items"]:
            key = flag["key"]
            age = now - datetime.fromtimestamp(flag["creation_date"] / 1000)
            if age <= MAX_AGE:
                print(f"Skipping flag {key} (age={age}) whose age is beneath threshold")
            else:
                try:
                    print(f"Deleting flag {key} (age={age})")
                    api.delete_feature_flag(project_key, key)
                except Exception as e:
                    print(f"Error while trying to delete flag {key}: {e}")


def main() -> None:
    clean_up_test_features()


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #39380** (2026-09-30): **doc/user: address review feedback on protect sensitive columns pattern**
  *Symptoms*: ### Motivation Follow-up to https://github.com/MaterializeInc/materialize/pull/39350, addressing review comments left after it merged. [EDU-98](https://linear.app/materializeinc/issue/EDU-98).  ### Description In `doc/user/content/security/patterns/protect-sensitive-columns.md`: - Rephrase the intro to recommend bespoke materialized views that exclude sensitive columns, with access granted only to those views. - Remove the `select-views-privileges` note under the intro. - Remove the "build the exposed materialized view from as few upstream objects as possible" mitigation, leaving the guarded-expression advice as prose. - Remove the "Remaining columns can identify individuals" limitation section.  - https://preview.materialize.com/materialize/39380/security/patterns/protect-sensitive-columns/  ### Verification Docs-only change. No SQL examples changed.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01SkNVF55kfzA2e8tA9kPm43

- **Issue #39373** (2026-09-30): **build(deps): bump lz4_flex from 0.12.1 to 0.14.0**
  *Symptoms*: mz-ore and mz-timely-util move from lz4_flex 0.12.1 to 0.14.0. lz4_flex 0.14 puts the Vec-returning APIs behind a new `alloc` feature, which the `std` feature the workspace already enables implies, so the code compiles unchanged. The mz-ore and mz-timely-util tests pass, including the chunk test that compares `compress_into` against `compress_prepend_size`.  parquet 58 still depends on lz4_flex 0.13, so the deny.toml skip moves from 0.12.1 to 0.13.1. parquet 60 uses 0.14, so the skip goes away with the arrow/parquet 60 bump (#39016).  Posted by Claude Code.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

- **Issue #39372** (2026-09-30): **build(deps): bump jsonwebtoken from 10.3.0 to 11.1.0**
  *Symptoms*: jsonwebtoken 11 makes `Algorithm` and related enums `non_exhaustive`, and it changes `Header.extras` and `Jwk.thumbprint`. It also removes `Validation.insecure_disable_signature_validation` and several `DecodingKey`/`EncodingKey` byte accessors. The workspace uses none of these, so it compiles unchanged, and Cargo.lock moves only jsonwebtoken, plus its new zeroize dependency.  Posted by Claude Code.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

- **Issue #39371** (2026-09-30): **build(deps): bump semver-compatible workspace dependencies**
  *Symptoms*: This raises the workspace requirements of eleven dependencies to their latest semver-compatible releases: * aws-sdk-glue 1.171 * bitflags 2.13 * bytes 1.12 * bytesize 2.7 * cc 1.5 * either 1.18 * http 1.5 * humantime 2.4 * hyper 1.11 * launchdarkly-server-sdk 3.3 * tokio-test 0.4.6  Cargo.lock moves only these crates and what they require, which is eventsource-client and launchdarkly-server-sdk-evaluation for launchdarkly, and find-msvc-tools and shlex 2 for cc. The pgwire fuzz crate pins bytes to the root version.  cc 1.5 moves to shlex 2. bindgen 0.72, the build dependency of custom-labels 0.4.6, still requires shlex 1, so deny.toml skips shlex 1.3.0.  `cargo update -p` on main's lock also re-resolves unrelated edges, for example windows-sys 0.61 to 0.59 in tempfile and rustix. Those edges are restored to main's values, and `cargo metadata --locked` accepts the result.  Posted by Claude Code.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

- **Issue #39363** (2026-09-30): **mzbuild: fix jemalloc 5.3.1 configure in release builds**
  *Symptoms*: Nightly release builds on x86_64 and aarch64 fail since #39339 bumped tikv-jemalloc-sys to 0.7.1 (jemalloc 5.3.1). jemalloc's configure aborts with `cannot determine return type of strerror_r`.  jemalloc 5.3.1 runs its `strerror_r` link checks with `-Werror`. The release LDFLAGS contain `-static-libstdc++`, which clang reports as unused when linking a C program, so both checks fail. This change adds `-Wno-unused-command-line-argument` to the release LDFLAGS. Running configure in the ci-builder image with clang-22 and the nightly's flags reproduces the failure, and with this flag configure succeeds and detects `JEMALLOC_STRERROR_R_RETURNS_CHAR_WITH_GNU_SOURCE`.  Posted by Claude Code.  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > Thanks for the review!  <!-- linear:isThreadRoot -->

- **Issue #39362** (2026-09-30): **kafka-util: clear OpenSSL error queue after creating Kafka clients**
  *Symptoms*: The Kafka auth tests flake with `PEM routines:get_name:no start line ... Expecting: CERTIFICATE` on schema registry requests ([SS-115](https://linear.app/materializeinc/issue/SS-115)). librdkafka reads `ssl.ca.pem` certificates until `PEM_read_bio_X509` fails and leaves that final error on the calling thread's OpenSSL error queue. OpenSSL's `SSL_get_error` reports any queued error as `SSL_ERROR_SSL`, so the next TLS read on the same tokio worker that would block fails with the stale error. Whether a request fails depends on which worker thread it lands on, which makes the failure flaky. librdkafka v2.15.1 clears the queue itself (confluentinc/librdkafka#5561), but we are on 2.5.0.  This PR routes all rdkafka client creation through new `mz_kafka_util::client::{create, create_with_context}` wrappers that drain the queue, and forbids the direct `ClientConfig` methods in `clippy.toml`. Testdrive creates Kafka clients next to its own schema registry client, so it goes through the wrappers too.  Adds `test_create_with_context_clears_openssl_error_queue`, which fails with the exact CI error string when the drain is removed.  Closes: [SS-115](https://linear.app/materializeinc/issue/SS-115)  Posted by Claude Code.  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > Thanks for the review!

- **Issue #39361** (2026-09-30): **mysql-util: return an error when the MySQL client panics while connecting**
  *Symptoms*: mysql_async 0.37 (#36831) added MariaDB `parsec` authentication. Without mysql_common's `client_parsec` feature, building the parsec response is a bare `panic!`. So a server that answers the handshake with an auth switch to `parsec` panics the connecting task. Outside a catch scope, Materialize's panic hook then aborts the process. In environmentd this path is reached through connection purification and `VALIDATE CONNECTION`, and in clusterd through MySQL sources. The report is in https://github.com/MaterializeInc/materialize/pull/36831#issuecomment-5902476325.  This PR catches unwinds around `Conn::new` in `connect_with_timeout`, which every connection path in mz-mysql-util goes through, and returns the panic as the new `MySqlError::ConnectionPanicked`. The catch scope is task-local, so it wraps `Conn::new` inside the spawned task when `InTask::Yes` is set. The same catch also covers the `.unwrap()` in mysql_async's parsec path and any other client panic during the handshake.  `client_parsec` stays disabled. Enabling it would let the server choose a PBKDF2 work factor that runs synchronously on a runtime thread, and Materialize does not support MariaDB.  The integration test `tests/parsec_auth.rs` runs a fake server that switches the client to `parsec`, for both `InTask` modes. It installs the enhanced panic handler that production uses. Without the fix, the test panics at `mysql_common/src/scramble.rs:252`. With the catch placed around the spawned task's handle instead, it 
  **Post-Mortem & Fix Analysis**:
  > ## QA LLM Review  ### 1. MEDIUM -- Test never installs the aborting panic hook, so it passes when the catch is in the wrong task  `src/mysql-util/src/tunnel/tests.rs:86`  `parsec_auth_switch_returns_error` runs without `mz_ore::panic::install_enhanced_handler`, so it only checks that the panic becomes an error. It does not check that the process survives, which is what the fix is for. A version that wraps the spawned task's handle in `ore_catch_unwind` passes the test but aborts environmentd or clusterd in production.  <details> <summary>Details</summary>  I checked both variants locally. I rewrote `connect_with_timeout` to catch around `spawn(..., Conn::new(..)).abort_on_drop()`, which is the placement the NOTE at `src/mysql-util/src/tunnel.rs:396` warns against. With that change the test still passes for both `InTask` modes. When I add `install_enhanced_handler()` at the top of the test, the same variant dies with SIGABRT, and the PR's placement passes.  The test can't tell the two p
  > Agreed, and reproduced: catching around the spawned task's handle passed the old test. In 9125ac3e79 the test moves to its own integration binary, `tests/parsec_auth.rs`, which installs `install_enhanced_handler` and restores the old hook in a `defer!`. The PR's placement passes there, and the catch-around-the-handle variant aborts with SIGABRT.  Posted by Claude Code.
  > Thanks for the review!

- **Issue #39359** (2026-09-30): **doc: update generated developer documentation**
  *Symptoms*: ## Summary  Automated daily refresh of `doc/developer/generated/` to reflect source code changes.  This PR was generated by the `update-generated-docs` workflow running `.claude/commands/update-docs.md`.  ## Scope  Only files under `doc/developer/generated/` are modified.  ## Review checklist  - [ ] No unrelated rewording or restructuring of existing text - [ ] No changelog language ("now", "added", "previously", etc.) - [ ] Changes correspond to actual source code changes  🤖 Generated with [Claude Code](https://claude.com/claude-code)

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

### Incident Patch 1: `19f8796d` (2026-09-30)
**Commit Message**: doc/user: add protect sensitive columns security pattern (#39350)

**File**: `doc/user/content/security/_index.md` (modified, +6/-0)
```diff
@@ -24,6 +24,12 @@ menu:
 | [Authentication](/security/self-managed/authentication/) | Enable authentication |
 | [Access control](/security/self-managed/access-control/) | Reference for role-based access management (RBAC) |
 
+## Patterns
+
+| Pattern | Description |
+|---------|-------------|
+| [Protect sensitive columns](/security/patterns/protect-sensitive-columns/) | Expose a materialized view that excludes sensitive columns, and grant roles access to only that view |
+
 ## Appendix
 
 See also:
```

**File**: `doc/user/content/security/patterns/_index.md` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+---
+title: "Patterns"
+description: "Common patterns for securing data in Materialize."
+disable_toc: true
+menu:
+  main:
+    parent: "security"
+    identifier: "security-patterns"
+    weight: 80
+---
+
+| Pattern | Description |
+|---------|-------------|
+| [Protect sensitive columns](/security/patterns/protect-sensitive-columns/) | Expose a materialized view that excludes sensitive columns, and grant roles access to only that view |
```

**File**: `doc/user/content/security/patterns/protect-sensitive-columns.md` (added, +218/-0)
```diff
@@ -0,0 +1,218 @@
+---
+title: "Protect sensitive columns"
+description: "Expose a materialized view that excludes sensitive columns, such as PII, and grant roles access to only that view."
+menu:
+  main:
+    parent: "security-patterns"
+    weight: 10
+---
+
+To keep sensitive columns, such as personally identifiable information (PII),
+away from some users, expose a materialized view that excludes those columns.
+Then grant those users a role that can read only that materialized view.
+
+{{< note >}}
+{{% include-headless "/headless/rbac-cloud/select-views-privileges" %}}
+{{</ note >}}
+
+{{< warning >}}
+This pattern is not a strong security barrier. An error in any object upstream
+of the exposed materialized view, including an intermediate materialized view,
+reaches readers of the exposed view, and the error message can contain
+sensitive values. See [Limitations](#limitations).
+{{</ warning >}}
+
+This guide uses the following setup:
+
+- **Data:** `restricted.customers` (raw data) => `restricted.customers_enriched`
+  (materialized view) => `analytics.customers_public` (materialized view that
+  excludes sensitive columns).
+- **Roles:** `admin` can read every object. `developer` can read only
+  `analytics.customers_public`.
+
+## Before you start
+
+- In Self-Managed Materialize, [enable RBAC](/security/self-managed/access-control/#enabling-rbac).
+  Without RBAC, all users are superusers. Materialize Cloud always enforces
+  RBAC.
+- Create the login roles that will receive access. In Materialize Cloud,
+  [invite the users or create service accounts](/security/cloud/users-service-accounts/).
+  In Self-Managed Materialize, create them with
+  [`CREATE ROLE ... WITH LOGIN PASSWORD`](/sql/create-role/).
+- Run the steps below as a role that can create roles and schemas, such as a
+  superuser or Organization Admin.
+
+## Step 1. Create the schemas
+
+Keep the raw data and intermediate objects in one schema, and the objects you
+expose in another. The `developer` role never gets `USAGE` on the first schema.
+
+```mzsql
+CREATE SCHEMA restricted;
+CREATE SCHEMA analytics;
+```
+
+## Step 2. Create the raw data
+
+In production this is usually a [source](/sql/create-source/). This guide uses a
+table:
+
+```mzsql
+CREATE TABLE restricted.customers (
+  id int, name text, email text, ssn text, region text, plan text
+);
+
+INSERT INTO restricted.customers VALUES
+  (1, 'Ada Lovelace', 'ada@example.com',   '123-45-6789', 'EU', 'pro'),
+  (2, 'Alan Turing',  'alan@example.com',  '987-65-4321', 'EU', 'free'),
+  (3, 'Grace Hopper', 'grace@example.com', '555-12-3456', 'US', 'pro');
+```
+
+## Step 3. Create the materialized views
+
+Create the intermediate materialized view in `restricted`, and the exposed one
+in `analytics`. The exposed view selects only non-sensitive columns.
+
+```mzsql
+CREATE MATERIALIZED VIEW restricted.customers_enriched AS
+  SELECT id, name, email, region, plan, right(ssn, 4) AS ssn_last4
+  FROM restricted.customers;
+
+CREATE MATERIALIZED VIEW analytics.customers_public AS
+  SELECT id, region, plan
+  FROM restricted.customers_enriched;
+```
+
+Use a materialized view, not a view, for the exposed object. A query against a
+materialized view reads only its stored results. A query against a view is
+optimized together with the view's definition, so whether an upstream error
+surfaces can depend on the reader's query.
+
+## Step 4. Create the roles and grant privileges
+
+```mzsql
+CREATE ROLE admin;
+CREATE ROLE developer;
+
+GRANT USAGE ON SCHEMA restricted, analytics TO admin;
+GRANT SELECT ON ALL TABLES IN SCHEMA restricted, analytics TO admin;
+
+GRANT USAGE ON SCHEMA analytics TO developer;
+GRANT SELECT ON analytics.customers_public TO developer;
+```
+
+{{% include-headless "/headless/rbac-cloud/grant-privilege-all-tables" %}}
+It covers only objects that exist when you run it. To cover objects you create
+later, use [`ALTER DEFAULT PRIVILEGES`](/sql/alter-default-privileges/).
+
+To ru
```

---

### Incident Patch 2: `95079729` (2026-09-30)
**Commit Message**: sql-parser: support OPERATOR(pg_catalog.=) and prefix OPERATOR(...) (#37643)

Fixes [SQL-486](https://linear.app/materializeinc/issue/SQL-486)

### Motivation

`expr OPERATOR(pg_catalog.=) expr` failed to parse (`Expected operator,
found equals sign`), while every other operator worked inside
`OPERATOR(...)`. psqlODBC generates this construct routinely. PostgreSQL
also accepts the prefix form, e.g. `OPERATOR(pg_catalog.-) 1`.

### Description

1. Accept `=` inside `OPERATOR(...)` (it has its own lexer token).
2. Support the prefix `OPERATOR(...)` form. As in PostgreSQL, the
operand parses at the precedence of "any other operator", looser than
bare unary `+`/`-`, so `OPERATOR(pg_catalog.-) 1 + 2` means `-(1 + 2)`.
Both printers share one rule for when a prefix operand needs
parentheses.

User-facing changes: both forms now parse. In expression position,
`operator(` now always starts an operator call, as in PostgreSQL, so a
function named `operator` must be quoted; both printers quote it.

### Tests

New parser datadriven cases (ASTs, round trips, precedence),
`test/sqllogictest/operator.slt` (results, precedence, errors, `SHOW
CREATE VIEW` round trips), and round-trip tests for a fu

**File**: `src/sql-parser/src/ast/defs/expr.rs` (modified, +28/-16)
```diff
@@ -356,12 +356,7 @@ impl<T: AstInfo> AstDisplay for Expr<T> {
                 } else {
                     f.write_str(op);
                     f.write_str(" ");
-                    // A prefix operator binds tighter than `COLLATE` and the
-                    // binary operators but looser than the postfix `::`/`[…]`
-                    // forms, and `- <number>` lexes as a negative literal, so a
-                    // low-precedence or numeric-leftmost operand must be
-                    // parenthesized to keep the prefix operator's scope.
-                    if prefix_operand_needs_parens(expr1.as_ref()) {
+                    if prefix_operand_needs_parens(op, expr1.as_ref()) {
                         f.write_str("(");
                         f.write_node(&expr1);
                         f.write_str(")");
@@ -867,16 +862,32 @@ fn prints_self_delimiting<T: AstInfo>(expr: &Expr<T>) -> bool {
     }
 }
 
-/// Whether the operand of a prefix operator (`-`/`+`/`~`) must be parenthesized
-/// to round-trip. A prefix op binds *tighter* than `COLLATE`/`AT TIME ZONE` and
-/// the binary/comparison operators, but *looser* than the postfix `::`/`[…]`
-/// forms — and `- <number>` additionally lexes as a negative literal. So peel
-/// the tight postfixes (`::`/`[…]`); if the chain bottoms out at a numeric
-/// literal the sign would fold into it, and if it bottoms out at anything other
-/// than a self-delimiting non-`COLLATE` primary (a `COLLATE`, a binary op, …) the
-/// prefix op would re-associate — both need parens. (`a + b COLLATE c` reparses
-/// as `a + (b COLLATE c)`; `- x COLLATE c` as `(- x) COLLATE c`.)
-fn prefix_operand_needs_parens<T: AstInfo>(operand: &Expr<T>) -> bool {
+/// Whether the operand of a prefix operator (an `Op` with no second operand)
+/// must be parenthesized so the printed expression reparses to the same tree.
+/// Both printers (`AstDisplay` and `mz-sql-pretty`) must use it, so they agree.
+pub fn prefix_operand_needs_parens<T: AstInfo>(op: &Op, operand: &Expr<T>) -> bool {
+    if unary_prec(op) == prec::PREFIX {
+        bare_prefix_operand_needs_parens(operand)
+    } else {
+        // An `Other`-level prefix (`~`, a namespaced `OPERATOR(...)`) reparses
+        // its operand at `Other`, so the operand re-associates exactly when its
+        // left spine exposes that level or looser, as for the right operand of
+        // a binary operator.
+        left_edge(operand) <= prec::OTHER
+    }
+}
+
+/// Whether the operand of a bare prefix `-`/`+` must be parenthesized to
+/// round-trip. Such a prefix op binds *tighter* than `COLLATE`/`AT TIME ZONE`
+/// and the binary/comparison operators, but *looser* than the postfix
+/// `::`/`[…]` forms, and `- <number>` additionally lexes as a negative literal.
+/// So peel the tight postfixes (`::`/`[…]`). If the chain bottoms out at a
+/// numeric literal, the sign would fold into it, and if it bottoms out at
+/// anything other than a self-delimiting non-`COLLATE` primary (a `COLLATE`, a
+/// binary op, …), the prefix op would re-associate. Both need parens.
+/// (`a + b COLLATE c` reparses as `a + (b COLLATE c)`, and `- x COLLATE c` as
+/// `(- x) COLLATE c`.)
+fn bare_prefix_operand_needs_parens<T: AstInfo>(operand: &Expr<T>) -> bool {
     let mut e = operand;
     let mut saw_postfix = false;
     loop {
@@ -1384,6 +1395,7 @@ impl<T: AstInfo> Function<T> {
                 | r#""map""#
                 | r#""normalize""#
                 | r#""nullif""#
+                | r#""operator""#
                 | r#""position""#
                 | r#""row""#
                 | r#""substring""#
```

**File**: `src/sql-parser/src/parser.rs` (modified, +17/-0)
```diff
@@ -695,6 +695,20 @@ impl<'a> Parser<'a> {
             (Token::Keyword(NOT), _) => Ok(Expr::Not {
                 expr: Box::new(self.parse_subexpr(Precedence::PrefixNot)?),
             }),
+            (Token::Keyword(OPERATOR), Some(Token::LParen)) => {
+                self.expect_token(&Token::LParen)?;
+                let op = self.parse_operator()?;
+                self.expect_token(&Token::RParen)?;
+                // Like PostgreSQL, the operand of a prefix `OPERATOR(...)`
+                // parses at the precedence of "any other operator", not at
+                // the tighter precedence of bare unary `+` and `-`, so
+                // `OPERATOR(pg_catalog.-) 1 + 2` means `- (1 + 2)`.
+                Ok(Expr::Op {
+                    op,
+                    expr1: Box::new(self.parse_subexpr(Precedence::Other)?),
+                    expr2: None,
+                })
+            }
             (Token::Keyword(ROW), Some(Token::LParen)) => self.parse_row_expr(),
             (Token::Keyword(TRIM), Some(Token::LParen)) => self.parse_trim_expr(),
             (Token::Keyword(POSITION), Some(Token::LParen)) => self.parse_position_expr(),
@@ -1556,7 +1570,10 @@ impl<'a> Parser<'a> {
                 Some(Token::Keyword(kw)) => namespace.push(kw.into()),
                 Some(Token::Ident(id)) => namespace.push(self.new_identifier(id)?),
                 Some(Token::Op(op)) => break op,
+                // The lexer emits `*` and `=` as dedicated tokens rather than
+                // `Token::Op`, but both are valid operator names here.
                 Some(Token::Star) => break "*".to_string(),
+                Some(Token::Eq) => break "=".to_string(),
                 tok => self.expected(self.peek_prev_pos(), "operator", tok)?,
             }
             self.expect_token(&Token::Dot)?;
```

**File**: `src/sql-parser/tests/sqlparser_common.rs` (modified, +10/-0)
```diff
@@ -451,6 +451,7 @@ fn test_special_keyword_function_name_display_roundtrip() {
         "row",
         "substring",
         "trim",
+        "operator",
         "case",
         "any",
         "all",
@@ -1169,6 +1170,15 @@ fn binary_op_operand_reparenthesized_after_nested_stripped() {
         // for a tighter quantified `*`: `~ a * ANY (...)` would bind the `* ANY`
         // into the `~`'s operand without the parens.
         "SELECT (~ a) * ANY (ARRAY[c])",
+        // An `Other`-level prefix operand needs parens exactly when its left
+        // spine exposes `Other` or looser, and not for tighter operators.
+        "SELECT ~ (a || b)",
+        "SELECT ~ (a < b)",
+        "SELECT ~ (a + b)",
+        "SELECT OPERATOR(pg_catalog.-) (a || b)",
+        "SELECT OPERATOR(pg_catalog.-) (a IS NULL)",
+        "SELECT OPERATOR(pg_catalog.-) (a OPERATOR(pg_catalog.+) b)",
+        "SELECT OPERATOR(pg_catalog.-) (a + b)",
     ] {
         let mut ast = mz_sql_parser::parser::parse_statements(sql)
             .unwrap()
```

**File**: `src/sql-parser/tests/testdata/scalar` (modified, +80/-0)
```diff
@@ -678,6 +678,86 @@ parse-scalar
 ----
 Op { op: Op { namespace: Some([Ident("pg_catalog")]), op: "+" }, expr1: Value(Number("1")), expr2: Some(Value(Number("2"))) }
 
+parse-scalar
+1 OPERATOR(=) 2
+----
+Op { op: Op { namespace: Some([]), op: "=" }, expr1: Value(Number("1")), expr2: Some(Value(Number("2"))) }
+
+parse-scalar roundtrip
+1 OPERATOR(=) 2
+----
+1 OPERATOR(=) 2
+
+parse-scalar
+1 OPERATOR(pg_catalog.=) 2
+----
+Op { op: Op { namespace: Some([Ident("pg_catalog")]), op: "=" }, expr1: Value(Number("1")), expr2: Some(Value(Number("2"))) }
+
+parse-scalar roundtrip
+1 OPERATOR(pg_catalog.=) 2
+----
+1 OPERATOR(pg_catalog.=) 2
+
+parse-scalar
+OPERATOR(pg_catalog.-) 1
+----
+Op { op: Op { namespace: Some([Ident("pg_catalog")]), op: "-" }, expr1: Value(Number("1")), expr2: None }
+
+parse-scalar roundtrip
+OPERATOR(pg_catalog.-) 1
+----
+OPERATOR(pg_catalog.-) 1
+
+parse-scalar roundtrip
+OPERATOR(-) 1
+----
+OPERATOR(-) 1
+
+parse-scalar
+OPERATOR(pg_catalog.-) 1 + 2
+----
+Op { op: Op { namespace: Some([Ident("pg_catalog")]), op: "-" }, expr1: Op { op: Op { namespace: None, op: "+" }, expr1: Value(Number("1")), expr2: Some(Value(Number("2"))) }, expr2: None }
+
+parse-scalar roundtrip
+OPERATOR(pg_catalog.-) (1 + 2)
+----
+OPERATOR(pg_catalog.-) (1 + 2)
+
+parse-scalar roundtrip
+OPERATOR(pg_catalog.-) 1 + 2
+----
+OPERATOR(pg_catalog.-) 1 + 2
+
+parse-scalar roundtrip
+2 * OPERATOR(pg_catalog.-) 3 + 4
+----
+2 * OPERATOR(pg_catalog.-) 3 + 4
+
+parse-scalar roundtrip
+~ 1 + 2
+----
+~ 1 + 2
+
+parse-scalar
+OPERATOR(pg_catalog.-) 1 < 2
+----
+Op { op: Op { namespace: None, op: "<" }, expr1: Op { op: Op { namespace: Some([Ident("pg_catalog")]), op: "-" }, expr1: Value(Number("1")), expr2: None }, expr2: Some(Value(Number("2"))) }
+
+parse-scalar roundtrip
+OPERATOR(pg_catalog.-) 1 < 2
+----
+OPERATOR(pg_catalog.-) 1 < 2
+
+parse-scalar
+2 * OPERATOR(pg_catalog.-) 3
+----
+Op { op: Op { namespace: None, op: "*" }, expr1: Value(Number("2")), expr2: Some(Op { op: Op { namespace: Some([Ident("pg_catalog")]), op: "-" }, expr1: Value(Number("3")), expr2: None }) }
+
+parse-scalar
+OPERATOR(-) OPERATOR(-) 1
+----
+Op { op: Op { namespace: Some([]), op: "-" }, expr1: Op { op: Op { namespace: Some([]), op: "-" }, expr1: Value(Number("1")), expr2: None }, expr2: None }
+
 parse-scalar
 1 < ANY (SELECT 2)
 ----
```

**File**: `src/sql-pretty/src/doc.rs` (modified, +2/-43)
```diff
@@ -1225,49 +1225,7 @@ impl Pretty {
                         self.doc_expr(expr2).nest(TAB),
                     ])
                 } else {
-                    // See the AstDisplay `Expr::Op` comment (`prefix_operand_needs_parens`):
-                    // a prefix op binds tighter than `COLLATE`/the binary ops but
-                    // looser than the postfix `::`/`[…]`, and `- <number>` folds, so
-                    // peel the tight postfixes and parenthesize when the chain
-                    // bottoms out at a numeric literal or a non-self-delimiting /
-                    // `COLLATE` operand.
-                    let needs_parens = {
-                        let mut e = expr1.as_ref();
-                        let mut saw_postfix = false;
-                        loop {
-                            match e {
-                                Expr::Cast { expr, .. } | Expr::Subscript { expr, .. } => {
-                                    saw_postfix = true;
-                                    e = expr.as_ref();
-                                }
-                                Expr::Value(Value::Number(_)) => break saw_postfix,
-                                // Another prefix operator stacks directly (no
-                                // re-association, no `- <number>` fold) — safe,
-                                // and avoids exploding deep unary chains.
-                                Expr::Op { expr2: None, .. } | Expr::Not { .. } => break false,
-                                Expr::Value(_)
-                                | Expr::Identifier(_)
-                                | Expr::QualifiedWildcard(_)
-                                | Expr::Parameter(_)
-                                | Expr::Function(_)
-                                | Expr::HomogenizingFunction { .. }
-                                | Expr::NullIf { .. }
-                                | Expr::Subquery(_)
-                                | Expr::Exists(_)
-                                | Expr::Nested(_)
-                                | Expr::Array(_)
-                                | Expr::ArraySubquery(_)
-                                | Expr::List(_)
-                                | Expr::ListSubquery(_)
-                                | Expr::Map(_)
-                                | Expr::MapSubquery(_)
-                                | Expr::Case { .. }
-                                | Expr::Row { .. } => break false,
-                                _ => break true,
-                            }
-                        }
-                    };
-                    let operand = if needs_parens {
+                    let operand = if prefix_operand_needs_parens(op, expr1.as_ref()) {
                         bracket("(", self.doc_expr(expr1), ")")
                     } else {
                         self.doc_expr(expr1)
@@ -1444,6 +1402,7 @@ impl Pretty {
                         | r#""map""#
                         | r#""normalize""#
                         | r#""nullif""#
+                        | r#""operator""#
                         | r#""position""#
                         | r#""row""#
                         | r#""substring""#
```

---

### Incident Patch 3: `da730ebf` (2026-09-30)
**Commit Message**: mzbuild: fix jemalloc 5.3.1 configure in release builds (#39363)

Nightly release builds on x86_64 and aarch64 fail since #39339 bumped
tikv-jemalloc-sys to 0.7.1 (jemalloc 5.3.1). jemalloc's configure aborts
with `cannot determine return type of strerror_r`.

jemalloc 5.3.1 runs its `strerror_r` link checks with `-Werror`. The
release LDFLAGS contain `-static-libstdc++`, which clang reports as
unused when linking a C program, so both checks fail. This change adds
`-Wno-unused-command-line-argument` to the release LDFLAGS. Running
configure in the ci-builder image with clang-22 and the nightly's flags
reproduces the failure, and with this flag configure succeeds and
detects `JEMALLOC_STRERROR_R_RETURNS_CHAR_WITH_GNU_SOURCE`.

Posted by Claude Code.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `misc/python/materialize/mzbuild.py` (modified, +6/-1)
```diff
@@ -732,7 +732,12 @@ def generate_cargo_build_command(
                 "RANLIB": "llvm-ranlib-22",
                 "CFLAGS": "-flto=thin",
                 "CXXFLAGS": "-flto=thin",
-                "LDFLAGS": "--ld-path=/usr/bin/ld.lld-22 -static-libstdc++",
+                # `-static-libstdc++` is unused when clang links a C program,
+                # and jemalloc's configure runs its `strerror_r` link checks
+                # with `-Werror`. Without `-Wno-unused-command-line-argument`
+                # both checks fail and configure aborts with "cannot determine
+                # return type of strerror_r".
+                "LDFLAGS": "--ld-path=/usr/bin/ld.lld-22 -static-libstdc++ -Wno-unused-command-line-argument",
                 "CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER": "/usr/local/bin/clang-lld-22",
                 "CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER": "/usr/local/bin/clang-lld-22",
             }
```

---

### Incident Patch 4: `23ec3f2c` (2026-09-29)
**Commit Message**: mz-debug-ci: make the open-PR search a required known-vs-new step (#38701)

### Motivation

Step 5 of the skill lists "look at recently opened PRs" as one optional
way to establish known vs new. Listed that way, the check gets skipped
once the log has named the cause, and a fix that is already in flight
goes unnoticed: #38695 duplicated the provider bump that #38584 had been
carrying for a week.

### Description

Give the check a concrete command (`gh pr list --state open --search`),
make it required for every failure, and require the summary to name any
hit.

### Verification

Documentation only.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `.agents/skills/mz-debug-ci/SKILL.md` (modified, +5/-3)
```diff
@@ -263,9 +263,11 @@ More ways to establish known vs new:
   on an older main. From an up-to-date main checkout run
   `git log <BUILD_COMMIT>..HEAD -- <suspect-file>` or
   `git log -S '<error token>'`. A fix can also sit in a not-yet-merged PR,
-  invisible to git log: look at recently opened PRs for one that already
-  addresses the failure (a PR's file list shows which of the build's root
-  causes it covers). When citing a later build as evidence
+  invisible to git log: search open PRs for the step name or error token
+  (`gh pr list --state open --search '<...>'`); a PR's file list shows
+  which of the build's root causes it covers. Do this for every failure,
+  and name any hit in the summary so nobody authors a duplicate. When
+  citing a later build as evidence
   of a fix, confirm the specific job's state there is `passed`: a build can
   be green because the job was `broken` and never ran.
 - Known-issue tracking lives in Linear. Annotations and `bin/ci-failures`
```

---

### Incident Patch 5: `d0d06eb6` (2026-09-28)
**Commit Message**: kafka-matrix: disable metric sinks until SQL-730 is fixed (#39169)

With curated metric sinks on (the CI default), the first catalog status
queries after a restart take minutes on 4-CPU agents, so "Previous Kafka
versions" times out in release qualification. This sets
`enable_metric_sink=false` for the kafka-matrix Materialized service via
`additional_system_parameter_defaults`. It only hides the symptom in
this suite, and
[SQL-730](https://linear.app/materializeinc/issue/SQL-730) stays open
for the actual fix.

Works around [SQL-730](https://linear.app/materializeinc/issue/SQL-730).

Posted by Claude Code.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `test/kafka-matrix/mzcompose.py` (modified, +8/-1)
```diff
@@ -56,7 +56,14 @@
 ]
 
 SERVICES = [
-    Materialized(default_replication_factor=2),
+    Materialized(
+        default_replication_factor=2,
+        # Curated metric sinks make the first catalog status queries after a
+        # restart take minutes on 4-CPU agents, which times out this suite.
+        # The flag defaults off in production.
+        # TODO(SQL-730): remove once the post-restart slowdown is fixed.
+        additional_system_parameter_defaults={"enable_metric_sink": "false"},
+    ),
     # Occasional timeouts in CI with 60s timeout
     Testdrive(
         volumes_extra=["../testdrive:/workdir/testdrive"], default_timeout="120s"
```

#### Recent Merged Pull Requests:
- **PR #39380** (2026-09-30): doc/user: address review feedback on protect sensitive columns pattern (@maheshwarip)
- **PR #39373** (2026-09-30): build(deps): bump lz4_flex from 0.12.1 to 0.14.0 (@antiguru)
- **PR #39372** (2026-09-30): build(deps): bump jsonwebtoken from 10.3.0 to 11.1.0 (@antiguru)
- **PR #39371** (2026-09-30): build(deps): bump semver-compatible workspace dependencies (@antiguru)
- **PR #39363** (2026-09-30): mzbuild: fix jemalloc 5.3.1 configure in release builds (@antiguru)
- **PR #39362** (2026-09-30): kafka-util: clear OpenSSL error queue after creating Kafka clients (@antiguru)
- **PR #39361** (2026-09-30): mysql-util: return an error when the MySQL client panics while connecting (@antiguru)
- **PR #39359** (2026-09-30): doc: update generated developer documentation (@github-actions[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
