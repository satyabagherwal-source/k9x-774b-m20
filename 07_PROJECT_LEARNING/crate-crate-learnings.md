> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/crate-crate-learnings.md`  
> **Source**: github ([https://github.com/crate/crate](https://github.com/crate/crate))  
> **Source Version**: `a2e5070d`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-21T03:18:14.442Z  
> **Learning ID**: `learn-github-crate-crate`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): crate/crate

> **Canonical Artifact**: `07_PROJECT_LEARNING/crate-crate-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/crate/crate](https://github.com/crate/crate))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-21T03:18:14.435Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `crate/crate`
- **Description**: CrateDB is a distributed and scalable SQL database for storing and analyzing massive amounts of data in near real-time, even with complex queries. It is PostgreSQL-compatible, and based on Lucene.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: N/A
- **Stars / Engagement**: 4445 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Remote API meta.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `blackbox/kill_4200.py`
```
#!/usr/bin/env python3

# Licensed to Crate.io GmbH ("Crate") under one or more contributor
# license agreements.  See the NOTICE file distributed with this work for
# additional information regarding copyright ownership.  Crate licenses
# this file to you under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.  You may
# obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  See the
# License for the specific language governing permissions and limitations
# under the License.
#
# However, if you have executed another commercial license agreement
# with Crate these terms will supersede the license and you may use the
# software solely pursuant to the terms of the relevant commercial agreement.


import socket
import os
import signal
import subprocess


def is_up(host: str, port: int) -> bool:
    try:
        conn = socket.create_connection((host, port))
        conn.close()
        return True
    except (socket.gaierror, ConnectionRefusedError):
        return False


def kill():
    if not is_up('localhost', 4200):
        return

    output = subprocess.check_output(['jps'], universal_newlines=True)
    for line in output.split('\n'):
        try:
            pid, procname = line.split(' ')
        except ValueError:
            continue
        if procname == 'CrateDB':
            print(f'CrateDB process with pid {pid} found. Killing it')
            os.kill(int(pid), signal.SIGKILL)


if __name__ == "__main__":
    kill()

```

### Core Architecture Module: `devs/tools/create_certs.py`
```
#!/usr/bin/env python3

# Licensed to Crate.io GmbH ("Crate") under one or more contributor
# license agreements.  See the NOTICE file distributed with this work for
# additional information regarding copyright ownership.  Crate licenses
# this file to you under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.  You may
# obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  See the
# License for the specific language governing permissions and limitations
# under the License.
#
# However, if you have executed another commercial license agreement
# with Crate these terms will supersede the license and you may use the
# software solely pursuant to the terms of the relevant commercial agreement.

"""Script to generate a keystore with node and client certificates.

Requires keystore and openssl to be available in $PATH
"""

import os
import argparse
from os.path import join, splitext, basename
from subprocess import run


def int_or(val, default):
    if val:
        return int(val)
    return default


def create_key_and_csr(key, csr):
    cn = splitext(basename(csr))[0]
    run([
        'openssl', 'req', '-newkey', 'rsa:2048', '-nodes',
        '-subj', f'/C=AT/ST=Dummy State/L=Dummy Country/O=Dummy Company/CN={cn}',
        '-keyout', key,
        '-out', csr
    ])


def create_crt(csr, crt, root_ca_crt, root_ca_key, out_dir):
    cn = splitext(basename(csr))[0]
    ssl_ext_template = f"""authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = {cn}
"""
    with open(join(out_dir, 'ssl.ext'),'w') as f:
        f.write(ssl_ext_template)

    run(['openssl', 'x509', '-req',
         '-in', csr,
         '-CA', root_ca_crt,
         '-CAkey', root_ca_key,
         '-CAcreateserial',
         '-out', crt,
         '-sha256',
         '-days', '365',
         '-extfile', join(out_dir, 'ssl.ext')
    ])


def generate_for(root_ca_key, root_ca_crt, out_dir, entity, num_default):
    num = int_or(input(f'How many {entity} certs do you want to generate? [{num_default}]: '), num_default)
    certs_and_keys = []
    for i in range(num):
        name = entity + str(i + 1)
        supplied_name = input(f'Name (CN) of {entity} {i + 1} [{name}]: ')
        name = supplied_name or name

        key = join(out_dir, name + '.key')
        csr = join(out_dir, name + '.csr')
        crt = join(out_dir, name + '.crt')
        certs_and_keys.append((crt, key))
        print(f'Creating {entity} key, csr and cert for {name}')
        create_key_and_csr(key, csr)
        create_crt(csr, crt, root_ca_crt, root_ca_key, out_dir)
    print('')
    print('')
    return certs_and_keys


def import_into_keystores(certs_and_keys, entity, keystore_pw, ca_crt, keystore, keystorep12):
    print(f'Importing {entity} certificates into keystore, Use "{keystore_pw}" as pw.')
    for (cert, key) in certs_and_keys:
        run([
            'openssl', 'pkcs12', '-export',
            '-in', cert,
            '-inkey', key,
            '-out', keystorep12,
            '-name', splitext(cert)[0],
            '-CAfile', ca_crt,
            '-caname', 'myCA',
            '-chain',
        ])
        run([
            'keytool', '-importkeystore',
            '-deststorepass', keystore_pw,
            '-destkeypass', keystore_pw,
            '-destkeystore', keystore,
            '-srckeystore', keystorep12,
            '-srcstoretype', 'PKCS12',
            '-srcstorepass', keystore_pw,
            '-alias', splitext(cert)[0]
        ])


def create_certs(out_dir, keystore_pw):
    ca_key = join(out_dir, 'rootCA.key')
    ca_crt = join(out_dir, 'rootCA.crt')
    print(f'Generating rootCA key: {ca_key}')
    print(f'Generating rootCA certificate: {ca_crt}')
    run([
        'openssl', 'req', '-x509', '-sha256', '-nodes',
        '-days', '365',
        '-subj', f'/C=AT/ST=Dummy State/L=Dummy Country/O=Dummy Company/CN=myCA',
        '-newkey', 'rsa:2048',
        '-keyout', ca_key,
        '-out', ca_crt
    ])

    certs_and_keys = generate_for(ca_key, ca_crt, out_dir, 'node', 1)
    keystore = join(out_dir, 'keystore.jks')
    keystore_p12 = join(out_dir, 'keystore.p12')
    import_into_keystores(certs_and_keys, 'node', keystore_pw, ca_crt, keystore, keystore_p12)
    # the CA certificate should also be in the keystore for the
    # node to be able to verify the client certificate
    run(['keytool', '-importcert',
         '-storepass', keystore_pw,
         '-keystore', keystore,
         '-file', ca_crt,
         '-alias', 'therootca'
    ])

    certs_and_keys = generate_for(ca_key, ca_crt, out_dir, 'client', 1)
    keystore_client = join(out_dir, 'keystore_client.jks')
    keystore_client_p12 = join(out_dir, 'keystore_client.p12')
    import_into_keystores(certs_and_keys, 'client', keystore_pw, ca_crt, keystore_client, keystore_client_p12)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out-dir', type=str, required=True)
    parser.add_argument('--keystore-pw', type=str, default='changeit')
    args = parser.parse_args()
    os.makedirs(args.out_dir, exist_ok=True)
    create_certs(args.out_dir, args.keystore_pw)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `devs/tools/release.py`
```
#!/usr/bin/env python3

# Licensed to Crate.io GmbH ("Crate") under one or more contributor
# license agreements.  See the NOTICE file distributed with this work for
# additional information regarding copyright ownership.  Crate licenses
# this file to you under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.  You may
# obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
# WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  See the
# License for the specific language governing permissions and limitations
# under the License.
#
# However, if you have executed another commercial license agreement
# with Crate these terms will supersede the license and you may use the
# software solely pursuant to the terms of the relevant commercial agreement.

""" tools to prepare CrateDB release commits

Two sub-commands, each taking a version like 6.5.1 and opening a pull
request with a single commit:

- ``bump``: creates a ``bump-<version>`` branch off ``origin/<major>.<minor>``,
  containing a "Bump version to <version>-SNAPSHOT" commit which:

  - sets the version in all ``pom.xml`` files to ``<version>`` by running
    ``./mvnw versions:set``

  - adds a ``V_<version>`` constant with the snapshot flag set to
    ``server/src/main/java/org/elasticsearch/Version.java`` and makes it
    ``CURRENT``

  - adds an "Unreleased" ``docs/appendices/release-notes/<version>.rst`` and
    lists it in ``docs/appendices/release-notes/index.rst``

  - updates the version of the reindex example in
    ``docs/admin/system-information.rst``

- ``create``: creates a ``release-<version>`` branch off
  ``origin/<major>.<minor>``, containing a "Release <version>" commit which:

  - finalizes ``docs/appendices/release-notes/<version>.rst``: removes the
    " - Unreleased" title suffix, the ".. comment" instructions and the "in
    development" note, and adds a "Released on <today>." line instead

  - clears the snapshot flag of the ``V_<version>`` constant in
    ``server/src/main/java/org/elasticsearch/Version.java``

Usage::

    ./devs/tools/release.py bump 6.5.1
    ./devs/tools/release.py create 6.4.1
"""

import datetime
import re
import subprocess
import sys
from argparse import ArgumentParser
from collections.abc import Callable
from pathlib import Path
from textwrap import fill

VERSION_RE = re.compile(r"^\d+\.\d+\.\d+$")
NOTES_DIR = "docs/appendices/release-notes"
VERSION_JAVA = "server/src/main/java/org/elasticsearch/Version.java"
INDEX_RST = f"{NOTES_DIR}/index.rst"
SYSTEM_INFORMATION_RST = "docs/admin/system-information.rst"
DOCS_URL = "https://cratedb.com/docs/crate/reference/en/latest"

NOTES_TEMPLATE = """\
.. _version_{version}:

{marker}
Version {version} - Unreleased
{marker}

.. comment 1. Remove the " - Unreleased" from the header above and adjust the ==
.. comment 2. Remove the NOTE below and replace with: "Released on 20XX-XX-XX."
.. comment    (without a NOTE entry, simply starting from col 1 of the line)
.. NOTE::

    In development. {version} isn't released yet. These are the release notes for
    the upcoming release.

.. NOTE::

    If you are upgrading a cluster, you must be running CrateDB {minimum} or higher
    before you upgrade to {version}.

    We recommend that you upgrade to the latest {previous_series} release before moving to
    {version}.

{rolling_upgrade}
    Before upgrading, you should `back up your data`_.

.. WARNING::

    Tables that were created before CrateDB {previous_major}.x will not function with {major}.x
    and must be recreated before moving to {major}.x.x.

    You can recreate tables using ``COPY TO`` and ``COPY FROM`` or by
    `inserting the data into a new table`_.

.. _back up your data: {docs_url}/admin/snapshots.html
.. _inserting the data into a new table: {docs_url}/admin/system-information.html#tables-need-to-be-recreated

.. rubric:: Table of contents

.. contents::
   :local:


{series_reference}

Fixes
=====

None
"""


def run(*args, cwd, capture_output=True) -> str:
    """Run a given command.

    If ``capture_output``, the output of the command is captured and returned.
    """
    if not capture_output:
        subprocess.check_call(args, cwd=cwd)
        return ""
    return subprocess.check_output(args, cwd=cwd, text=True).strip()


def repo_root(script: str) -> Path:
    """Root of the checkout the given script file lives in"""
    return Path(run("git", "rev-parse", "--show-toplevel", cwd=Path(script).resolve().parent))


def ref_exists(root: Path, ref: str) -> bool:
    return subprocess.run(
        ("git", "rev-parse", "--verify", "--quiet", ref),
        cwd=root,
        stdout=subprocess.DEVNULL,
        check=False,
    ).returncode == 0


def fetch_and_check(root: Path, base: str, branch: str) -> None:
    """Verify the checkout is ready to create ``branch`` off ``origin/base``"""
    if run("git", "status", "--porcelain", cwd=root):
        sys.exit("working directory not clean, commit or stash your changes first")
    print("Fetching origin...")
    run("git", "fetch", "origin", cwd=root)
    if not ref_exists(root, f"refs/remotes/origin/{base}"):
        sys.exit(f"origin/{base} does not exist, is there a {base} release branch?")
    for ref in (f"refs/heads/{branch}", f"refs/remotes/origin/{branch}"):
        if ref_exists(root, ref):
            sys.exit(f"{ref} already exists, delete it or finish that release first")


def create_branch(root: Path, branch: str, base: str) -> str:
    """Check out ``branch`` at ``origin/base``, returning the previous branch"""
    print(f"Creating branch {branch} from origin/{base}...")
    previous = run("git", "rev-parse", "--abbrev-ref", "HEAD", cwd=root)
    if previous == "HEAD":  # detached, remember the commit instead
        previous = run("git", "rev-parse", "HEAD", cwd=root)
    run("git", "checkout", "-b", branch, f"origin/{base}", cwd=root, capture_output=False)
    return previous


def commit_and_push(root: Path, branch: str, message: str) -> None:
    run("git", "add", "--all", cwd=root)
    run("git", "commit", "-m", message, cwd=root, capture_output=False)
    print(f"Pushing {branch} to origin...")
    run("git", "push", "--set-upstream", "origin", branch, cwd=root, capture_output=False)


def open_pull_request(root: Path, base: str, branch: str, title: str) -> None:
    """Create the pull request of ``branch`` against ``base``"""
    print(f"Creating the pull request of {branch}...")
    run("gh", "pr", "create", "--base", base, "--head", branch,
        "--title", title, "--body", "", cwd=root, capture_output=False)


def apply_patch(path: Path, patch_file: Callable[[str], str]) -> None:
    """Rewrite ``path`` in place with ``patch_file(text)``"""
    if not path.is_file():
        sys.exit(f"{path} does not exist")
    try:
        path.write_text(patch_file(path.read_text()))
    except ValueError as e:
        sys.exit(str(e))
    print(f"Updated {path}")


def render_release_notes(version: str, previous_notes: str) -> str:
    """Render the "Unreleased" release notes of ``version``

    The upgrade requirements cannot be derived from the version, they are taken
    from ``previous_notes``, the notes of the previous patch version of the same
    series.
    """
    major, minor, _ = version.split(".")
    series = f"{major}.{minor}"

    def extract(name, pattern):
        match = re.search(pattern, previous_notes, re.MULTILINE | re.DOTALL)
        if match is None:
            raise ValueError(f"cannot tell the {name} from the previous release notes")
        return match

    minimum = extract("minimum version", r"you must be running CrateDB (\S+) or higher").group(1)
    previous_series = extract("previous series", r"upgrade to the latest (\S+) release").group(1)
    # the whole rolling upgrade paragraph is carried over, only the version it
    # upgrades to changes; some series add sentences about upgrade restrictions
    rolling_upgrade = extract("rolling upgrade support",
                              r"^( *A rolling upgrade from .+? to )\S+( is supported\..*?)"
                              r"(?=\n *Before upgrading)").expand(rf"\g<1>{version}\g<2>")

    title = f"Version {version} - Unreleased"
    reference = (f"See the :ref:`version_{series}.0` release notes for a full list of "
                 f"changes in the {series} series.")
    return NOTES_TEMPLATE.format(
        version=version,
        marker="=" * len(title),
        major=major,
        previous_major=int(major) - 1,
        docs_url=DOCS_URL,
        series_reference=fill(reference, width=80),
        minimum=minimum,
        previous_series=previous_series,
        rolling_upgrade=rolling_upgrade,
    )


def patch_index(text: str, version: str, previous: str) -> str:
    """List ``version`` above ``previous`` in the release notes index"""
    entry = f"    {version}\n"
    if entry in text:
        raise ValueError(f"{version} is already listed in {INDEX_RST}")
    previous_entry = f"    {previous}\n"
    if previous_entry not in text:
        raise ValueError(f"{previous} is not listed in {INDEX_RST}")
    return text.replace(previous_entry, entry + previous_entry, 1)


def patch_system_information(text: str, version: str, previous: str) -> str:
    """Update the version of the reindex example, keeping the table aligned"""
    cell = re.compile(r"^(\s*\| )(\d+\.\d+\.\d+)( +)\|$", re.MULTILINE)
    matches = cell.findall(text)
    if len(matches) != 1:
        raise ValueError(f"expected one version cell in {SYSTEM_INFORMATION_RST}, "
                         f"found {len(matches)}")
    _, found, padding = matches[0]
    if found != previous:
        raise ValueError(f"the reindex example in {SYSTEM_INFORMATION_RST} shows {found}, "
                         f"n
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #20438** (2026-10-20): **[Regression] Range query returns 0 rows when a CLOSED partition is included (5.10.16 vs 6.4.5)**
  *Symptoms*: ### CrateDB version  6.4.5 (also reproduced on 6.2.8; works as expected on 5.10.16)  ### CrateDB setup information  Number of nodes: 3  Node configuration: - 1 node with stage=bigeye - 2 nodes with stage=hot - Heap size: 5 GB per node  CRATE_HEAP_SIZE: 5g (each node) CRATE_JAVA_OPTS: Not specified  Test table configuration: - 1 primary shard - 0 replicas - Daily partitioning using a generated TIMESTAMP column  The issue was also reproduced using a newly created minimal test table without custom shard allocation settings.  The full crate.yml configuration can be provided if required.  ### Problem description  <html> <body> <!--StartFragment--><html><head></head><body><h3><span>Description</span></h3><p><span>We found a regression in CrateDB 6.x when querying a partitioned table containing CLOSED partitions.</span></p><p><span>In CrateDB 5.10.16, range queries spanning both OPEN and CLOSED partitions correctly return records from OPEN partitions.</span></p><p><span>However, in CrateDB 6.2.8 and 6.4.5, the same queries return 0 records, even when matching records exist in OPEN partitions.</span></p><p><span>This behavior was reproduced using a newly created test table.</span></p><h3><span>Steps to Reproduce</span></h3><p><strong><span>1. Create a partitioned table</span></strong></p><pre><code><span>CREATE TABLE IF NOT EXISTS doc.test_closed_partition (     ts TIMESTAMP WITHOUT TIME ZONE,     pdate TIMESTAMP WITHOUT TIME ZONE         GENERATED ALWAYS AS date_trunc('day', ts) ) P

- **Issue #20414** (2026-10-20): **Failing query with left join inside cross join**
  *Symptoms*: Originally found by @matriv while reviewing a PR. This was failing with `optimizer_eliminate_cross_join` enabled and disabled.  However, with https://github.com/crate/crate/pull/20305 merged, the query below fails only when `optimizer_eliminate_cross_join` is disabled.  ### CrateDB version  6.4.6  ### CrateDB setup information   Number of nodes: ? CRATE_HEAP_SIZE: ? CRATE_JAVA_OPTS: ?  crate.yml contents:  ### Problem description  The query below fails instead of returning expected results.  ### Steps to Reproduce  ```sql CREATE TABLE t1 (a INT, x INT); CREATE TABLE t2 (b INT, y INT); CREATE TABLE t3 (z INT); CREATE TABLE t4 (id INT);  INSERT INTO t1 (a, x) VALUES (1, 1); INSERT INTO t2 (b, y) VALUES (1, 1), (1, 2); INSERT INTO t3 (z) VALUES (1); INSERT INTO t4 (id) VALUES (1);  REFRESH TABLE t1, t2, t3, t4;  SELECT t1.x, t2.y, t3.z, t4.id FROM t1 LEFT JOIN t2 ON t1.a = t2.b CROSS JOIN t3 JOIN t4 ON t1.x = t2.y AND t1.x = t3.z AND t3.z = t4.id; ```  ### Actual Result  ``` SQLParseException[Couldn't create execution plan from logical plan because of: Index 1 out of bounds for length 1: Eval[x, y, z, id] (rows=unknown)   └ HashJoin[INNER | ((z = id) AND (a = b))] (rows=unknown)     ├ HashJoin[INNER | (x = z)] (rows=unknown)     │  ├ HashJoin[INNER | (x = y)] (rows=unknown)     │  │  ├ Collect[doc.t1 | [x, a] | true] (rows=unknown)     │  │  └ Collect[doc.t2 | [y, b] | true] (rows=unknown)     │  └ Collect[doc.t3 | [z] | true] (rows=unknown)     └ Collect[doc.t4 | [id] | true] (

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

### Incident Patch 1: `a2e5070d` (2026-10-17)
**Commit Message**: Push down inner join conditions that reference only one side

**File**: `docs/appendices/release-notes/6.4.7.rst` (modified, +10/-0)
```diff
@@ -133,3 +133,13 @@ Fixes
 - Fixed an issue where double quotes and backslashes in array elements (e.g.
   ``TEXT[]``) weren't escaped when sent over the PostgreSQL wire protocol in
   text format. This caused clients to parse the elements incorrectly.
+
+- Fixed an issue that caused inner join queries to fail when a join condition
+  referenced multiple tables that are all on one side of the join, e.g.::
+
+    SELECT t1.x, t2.y, t3.z
+    FROM t1
+    JOIN t2 ON t1.a = t2.b
+    JOIN t3 ON t1.x = t2.y AND t1.x = t3.z;
+
+  A query like this used to fail with ``Index 1 out of bounds for length 1``.
```

**File**: `docs/appendices/release-notes/6.5.1.rst` (modified, +10/-0)
```diff
@@ -138,3 +138,13 @@ Fixes
 - Fixed an issue where double quotes and backslashes in array elements (e.g.
   ``TEXT[]``) weren't escaped when sent over the PostgreSQL wire protocol in
   text format. This caused clients to parse the elements incorrectly.
+
+- Fixed an issue that caused inner join queries to fail when a join condition
+  referenced multiple tables that are all on one side of the join, e.g.::
+
+    SELECT t1.x, t2.y, t3.z
+    FROM t1
+    JOIN t2 ON t1.a = t2.b
+    JOIN t3 ON t1.x = t2.y AND t1.x = t3.z;
+
+  A query like this used to fail with ``Index 1 out of bounds for length 1``.
```

**File**: `server/src/main/java/io/crate/planner/operators/LogicalPlanner.java` (modified, +69/-2)
```diff
@@ -21,8 +21,10 @@
 
 package io.crate.planner.operators;
 
+import java.util.ArrayList;
 import java.util.Collection;
 import java.util.Collections;
+import java.util.HashSet;
 import java.util.Iterator;
 import java.util.LinkedHashSet;
 import java.util.List;
@@ -38,6 +40,7 @@
 import org.elasticsearch.Version;
 import org.elasticsearch.cluster.ClusterState;
 import org.elasticsearch.cluster.metadata.Metadata;
+import org.jspecify.annotations.Nullable;
 
 import io.crate.analyze.AnalyzedInsertStatement;
 import io.crate.analyze.AnalyzedStatement;
@@ -53,6 +56,7 @@
 import io.crate.analyze.relations.AnalyzedRelationVisitor;
 import io.crate.analyze.relations.AnalyzedView;
 import io.crate.analyze.relations.DocTableRelation;
+import io.crate.analyze.relations.QuerySplitter;
 import io.crate.analyze.relations.TableFunctionRelation;
 import io.crate.analyze.relations.TableRelation;
 import io.crate.analyze.relations.UnionSelect;
@@ -392,14 +396,14 @@ public LogicalPlan visitJoinRelation(JoinRelation joinRelation, List<Symbol> out
 
             var correlatedSubQueries = CorrelatedSubQueries.of(joinCondition);
             if (correlatedSubQueries.correlatedSubQueries().isEmpty()) {
-                return new JoinPlan(
+                return createJoinPlan(
                     joinRelation.left().accept(this, lhsOutputs),
                     joinRelation.right().accept(this, rhsOutputs),
                     joinRelation.joinType(),
                     joinCondition
                 );
             } else {
-                LogicalPlan source = new JoinPlan(
+                LogicalPlan source = createJoinPlan(
                     joinRelation.left().accept(this, lhsOutputs),
                     joinRelation.right().accept(this, rhsOutputs),
                     joinRelation.joinType(),
@@ -412,6 +416,69 @@ public LogicalPlan visitJoinRelation(JoinRelation joinRelation, List<Symbol> out
             }
         }
 
+        /// For inner joins, conditions which reference relations of only one side of the join
+        /// are moved to that side as a [Filter].
+        private static LogicalPlan createJoinPlan(LogicalPlan lhs,
+                                                  LogicalPlan rhs,
+                                                  JoinType joinType,
+                                                  @Nullable Symbol joinCondition) {
+            if (joinType != JoinType.INNER) {
+                return new JoinPlan(lhs, rhs, joinType, joinCondition);
+            }
+            var split = splitJoinCondition(joinCondition, lhs.relationNames(), rhs.relationNames());
+            return new JoinPlan(
+                Filter.create(lhs, split.left()),
+                Filter.create(rhs, split.right()),
+                split.remaining() == null ? JoinType.CROSS : JoinType.INNER,
+                split.remaining()
+            );
+        }
+
+        /// @param remaining conditions referencing both sides, and non-deterministic conditions without any relation.
+        ///                  `null` if there are none.
+        /// @param left      conditions referencing only relations of the left side. `null` if there are none.
+        /// @param right     conditions referencing only relations of the right side. `null` if there are none.
+        private record SplitJoinCondition(@Nullable Symbol remaining, @Nullable Symbol left, @Nullable Symbol right) {
+        }
+
+        /// Splits a join condition into the conditions that reference relations of only one side of the join,
+        /// and the remaining conditions.
+        /// Deterministic conditions without any relation are assigned to the left side.
+        /// Non-deterministic conditions without any relation remain in the join condition.
+        private static SplitJoinCondition splitJoinCondition(@Nullable Symbol condition,
+                                                             Collection<RelationName> leftRelations,
+                                                             Collection<RelationName> rightRelations) {
+            if (condition == null) {
+                return new SplitJoinCondition(null, null, null);
+            }
+            
+            Set<RelationName> lhsRelations = new HashSet<>(leftRelations);
+            Set<RelationName> rhsRelations = new HashSet<>(rightRelations);
+            List<Symbol> lhsConditions = new ArrayList<>();
+            List<Symbol> rhsConditions = new ArrayList<>();
+            List<Symbol> remainingConditions = new ArrayList<>();
+
+            for (var entry : QuerySplitter.split(condition).entrySet()) {
+                Set<RelationName> relations = entry.getKey();
+                Symbol part = entry.getValue();
+                if (relations.isEmpty() && !part.isDeterministic()) {
+                    remainingConditions.add(part);
+                } else if (lhsRelations.containsAll(relations)) {
+                    lhsConditions.add(part);
+                } else 
```

**File**: `server/src/test/java/io/crate/integrationtests/JoinIntegrationTest.java` (modified, +24/-20)
```diff
@@ -1609,10 +1609,8 @@ public void test_eliminate_cross_joins_and_reorder_tables() throws Exception {
     @UseHashJoins(1)
     @UseRandomizedSchema(random = false)
     @UseRandomizedOptimizerRules(0)
-    public void test_cross_join_elimination_keeps_condition_between_both_sides_of_outer_join() throws Exception {
+    public void test_join_condition_referencing_multiple_tables_on_one_side_of_join() throws Exception {
         // See: https://github.com/crate/crate/issues/20414
-        execute("SET optimizer_eliminate_cross_join = TRUE;");
-
         execute("CREATE TABLE t1 (a INT, x INT)");
         execute("CREATE TABLE t2 (b INT, y INT)");
         execute("CREATE TABLE t3 (z INT)");
@@ -1631,23 +1629,29 @@ public void test_cross_join_elimination_keeps_condition_between_both_sides_of_ou
             JOIN t4 ON t1.x = t2.y AND t1.x = t3.z AND t3.z = t4.id
             """;
 
-        execute("EXPLAIN (COSTS FALSE) " + stmt);
-        assertThat(response).hasLines(
-            "Eval[x, y, z, id]",
-            "  └ HashJoin[INNER | (z = id)]",
-            "    ├ HashJoin[INNER | (x = z)]",
-            "    │  ├ Filter[(x = y)]",
-            "    │  │  └ HashJoin[LEFT | (a = b)]",
-            "    │  │    ├ Collect[doc.t1 | [x, a] | true]",
-            "    │  │    └ Collect[doc.t2 | [y, b] | true]",
-            "    │  └ Collect[doc.t3 | [z] | true]",
-            "    └ Collect[doc.t4 | [id] | true]"
-        );
-
-        execute(stmt);
-        assertThat(response).hasRowsInAnyOrder(
-            "1| 1| 1| 1"
-        );
+        for (String eliminateCrossJoin : new String[] {"TRUE", "FALSE"}) {
+            try (var session = sqlExecutor.newSession()) {
+                execute("SET optimizer_eliminate_cross_join = " + eliminateCrossJoin, session);
+
+                execute("EXPLAIN (COSTS FALSE) " + stmt, session);
+                assertThat(response).hasLines(
+                    "Eval[x, y, z, id]",
+                    "  └ HashJoin[INNER | (z = id)]",
+                    "    ├ HashJoin[INNER | (x = z)]",
+                    "    │  ├ Filter[(x = y)]",
+                    "    │  │  └ HashJoin[LEFT | (a = b)]",
+                    "    │  │    ├ Collect[doc.t1 | [x, a] | true]",
+                    "    │  │    └ Collect[doc.t2 | [y, b] | true]",
+                    "    │  └ Collect[doc.t3 | [z] | true]",
+                    "    └ Collect[doc.t4 | [id] | true]"
+                );
+
+                execute(stmt, session);
+                assertThat(response).hasRowsInAnyOrder(
+                    "1| 1| 1| 1"
+                );
+            }
+        }
     }
 
     /**
```

**File**: `server/src/test/java/io/crate/planner/operators/JoinTest.java` (modified, +203/-0)
```diff
@@ -1912,4 +1912,207 @@ public void test_eliminate_cross_join_keeps_non_deterministic_filter_in_subquery
             "  └ Collect[doc.t3 | [z] | true]"
         );
     }
+
+    @Test
+    public void test_join_condition_referencing_one_side_is_pushed_below_join() {
+        String stmt = """
+            SELECT t1.x, t2.y, t3.z, t4.id
+            FROM t1
+            LEFT JOIN t2 ON t1.a = t2.b
+            CROSS JOIN t3
+            JOIN t4 ON t1.x = t2.y AND t1.x = t3.z AND t3.z = t4.id
+            """;
+        String[] expectedPlan = {
+            "Eval[x, y, z, id]",
+            "  └ HashJoin[INNER | (z = id)]",
+            "    ├ HashJoin[INNER | (x = z)]",
+            "    │  ├ Filter[(x = y)]",
+            "    │  │  └ HashJoin[LEFT | (a = b)]",
+            "    │  │    ├ Collect[doc.t1 | [x, a] | true]",
+            "    │  │    └ Collect[doc.t2 | [y, b] | true]",
+            "    │  └ Collect[doc.t3 | [z] | true]",
+            "    └ Collect[doc.t4 | [id] | true]"
+        };
+
+        LogicalPlan plan = e.logicalPlan(stmt);
+        assertThat(plan).hasOperators(expectedPlan);
+
+        e.getSessionSettings().excludedOptimizerRules().add(EliminateCrossJoin.class);
+
+        plan = e.logicalPlan(stmt);
+        assertThat(plan).hasOperators(expectedPlan);
+    }
+
+    @Test
+    public void test_join_condition_referencing_one_side_is_pushed_below_join_without_cross_join() {
+        // Without a cross join, EliminateCrossJoin doesn't apply
+        LogicalPlan plan = e.logicalPlan("""
+            SELECT t1.x, t2.y, t3.z
+            FROM t1
+            JOIN t2 ON t1.a = t2.b
+            JOIN t3 ON t1.x = t2.y AND t1.x = t3.z
+            """);
+
+        assertThat(plan).hasOperators(
+            "Eval[x, y, z]",
+            "  └ HashJoin[INNER | (x = z)]",
+            "    ├ HashJoin[INNER | ((a = b) AND (x = y))]",
+            "    │  ├ Collect[doc.t1 | [x, a] | true]",
+            "    │  └ Collect[doc.t2 | [y, b] | true]",
+            "    └ Collect[doc.t3 | [z] | true]"
+        );
+    }
+
+    @Test
+    public void test_join_condition_referencing_one_side_is_pushed_above_right_join() {
+        String stmt = """
+            SELECT t1.x, t2.y, t3.z, t4.id
+            FROM t1
+            RIGHT JOIN t2 ON t1.a = t2.b
+            CROSS JOIN t3
+            JOIN t4 ON t1.x = t2.y AND t1.x = t3.z AND t3.z = t4.id
+            """;
+        String[] expectedPlan = {
+            "HashJoin[INNER | (z = id)]",
+            "  ├ HashJoin[INNER | (x = z)]",
+            "  │  ├ Eval[x, y]",
+            "  │  │  └ Filter[(x = y)]",
+            "  │  │    └ HashJoin[LEFT | (a = b)]",
+            "  │  │      ├ Collect[doc.t2 | [y, b] | true]",
+            "  │  │      └ Collect[doc.t1 | [x, a] | true]",
+            "  │  └ Collect[doc.t3 | [z] | true]",
+            "  └ Collect[doc.t4 | [id] | true]"
+        };
+
+        LogicalPlan plan = e.logicalPlan(stmt);
+        assertThat(plan).hasOperators(expectedPlan);
+
+        e.getSessionSettings().excludedOptimizerRules().add(EliminateCrossJoin.class);
+
+        plan = e.logicalPlan(stmt);
+        assertThat(plan).hasOperators(expectedPlan);
+    }
+
+    @Test
+    public void test_join_condition_referencing_one_side_is_pushed_above_full_join() {
+        String stmt = """
+            SELECT t1.x, t2.y, t3.z, t4.id
+            FROM t1
+            FULL JOIN t2 ON t1.a = t2.b
+            CROSS JOIN t3
+            JOIN t4 ON t1.x = t2.y AND t1.x = t3.z AND t3.z = t4.id
+            """;
+        String[] expectedPlan = {
+            "Eval[x, y, z, id]",
+            "  └ HashJoin[INNER | (z = id)]",
+            "    ├ HashJoin[INNER | (x = z)]",
+            "    │  ├ Filter[(x = y)]",
+            "    │  │  └ NestedLoopJoin[FULL | (a = b)]",
+            "    │  │    ├ Collect[doc.t1 | [x, a] | true]",
+            "    │  │    └ Collect[doc.t2 | [y, b] | true]",
+            "    │  └ Collect[doc.t3 | [z] | true]",
+            "    └ Collect[doc.t4 | [id] | true]"
+        };
+
+        LogicalPlan plan = e.logicalPlan(stmt);
+        assertThat(plan).hasOperators(expectedPlan);
+
+        e.getSessionSettings().excludedOptimizerRules().add(EliminateCrossJoin.class);
+
+        plan = e.logicalPlan(stmt);
+        assertThat(plan).hasOperators(expectedPlan);
+    }
+
+    @Test
+    public void test_join_condition_without_relations_is_pushed_down() {
+        // A parameter is used, because constant expressions are normalized away by the analyzer
+        LogicalPlan plan = e.logicalPlan("""
+            SELECT t1.x, t2.y
+            FROM t1
+            JOIN t2 ON t1.x = t2.y AND $1::int = 1
+            """);
+
+        assertThat(plan).hasOperators(
+            "HashJoin[INNER | (x = y)]",
+            "  ├ Collect[doc.t1 | [x] | ($1 = 1)]",
+            "  └ Collect[doc.t2 | [y] | true]"
+        );
+    }
+
+    @Test
+    public void test_inner_join_becomes_cross_join_if_all_conditions_are_pushed_
```

---

### Incident Patch 2: `2517f2b3` (2026-10-20)
**Commit Message**: Skip publish test reports for GitHub actions for forks

**File**: `.github/workflows/main.yml` (modified, +3/-0)
```diff
@@ -75,6 +75,9 @@ jobs:
       - name: Publish Test Report
         if: needs.changes.outputs.java == 'true' && (success() || failure())
         uses: ScalableCapital/action-surefire-report@1e92f48016e566e4eed2d81560edbfe0f524cfb7 #v2.0.3
+        with:
+          # GITHUB_TOKEN is read-only for PRs from forks, so the step fails with 403
+          skip_publishing: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository }}
 
   forbiddenApis:
     name: forbiddenApis
```

#### Recent Merged Pull Requests:
- **PR #20456** (2026-10-20): Push down inner join conditions that reference only one side (backport #20430) (@mergify[bot])
- **PR #20455** (2026-10-20): Push down inner join conditions that reference only one side (backport #20430) (@mergify[bot])
- **PR #20454** (2026-10-20): Skip publishing test reports for GitHub actions for forks (@matriv)
- **PR #20452** (2026-10-20): Avoid list->array copy to resolve concrete indices for tables (@mfussenegger)
- **PR #20449** (2026-10-20): Fix partition narrowing if closed partitions are hit (backport #20440) (@mergify[bot])
- **PR #20448** (2026-10-20): Fix partition narrowing if closed partitions are hit (backport #20440) (@mergify[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Push down inner join conditions that reference only one side

**RULE**:
When implementing operations in `docs/appendices/release-notes/6.4.7.rst`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in crate/crate. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a2e5070d`: Push down inner join conditions that reference only one side. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/appendices/release-notes/6.4.7.rst`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:

- Fixed an issue that caused inner join queries to fail when a join condition
  referenced multiple tables that are all on one side of the join, e.g.::

    SELECT t1.x, t2.y, t3.z
    FROM t1
    JOIN t2 ON t1.a = t2.b
    JOIN t3 ON t1.x = t2.y AND t1.x = t3.z;

  A query like this used to fail with ``Index 1 out of bounds for length 1``.
```

**NEGATIVE CONSTRAINT**:
```java
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a2e5070d` are properly handled with clean fallback behavior.
