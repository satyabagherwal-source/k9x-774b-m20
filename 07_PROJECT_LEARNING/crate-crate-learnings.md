# Forensic Learning Record (Deep Inspection): crate/crate

> **Canonical Artifact**: `07_PROJECT_LEARNING/crate-crate-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/crate/crate](https://github.com/crate/crate))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:21:32.951Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `crate/crate`
- **Description**: CrateDB is a distributed and scalable SQL database for storing and analyzing massive amounts of data in near real-time, even with complex queries. It is PostgreSQL-compatible, and based on Lucene.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: N/A
- **Stars / Engagement**: 4442 stars

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
    # the w
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #20274** (2026-09-24): **Restore snapshot from cluster with foreign table fails**
  *Symptoms*: ### CrateDB version  6.4.5  ### CrateDB setup information  Snapshot taken from a Cloud cluster version 6.4.4 which contains a foreign table  Restored snapshot to a local single-node cluster version 6.4.5  ### Problem description  When trying to restore a snapshot specifying a sub-set of tables but excluding the foreign table from the list, I get the following error: ``` SQLParseException[Cannot restore relation `doc.remote_documents` as `doc.remote_documents`, it conflicts with: ForeignTable[name=doc.remote_documents, references={station_name=station_name, measured_at=measured_at, humidity_percent=humidity_percent, temperature_c=temperature_c, reading_id=reading_id}, server=my_postgresql, settings={"schema_name":"bridge_demo","table_name":"weather_readings"}]] ```     ### Steps to Reproduce  Deploy cluster in version 6.4.4 create foreign table create snapshot restore snapshot on cluster 6.4.5  If needed, I can give access to the problematic snapshot  ### Actual Result  ``` SQLParseException[Cannot restore relation `doc.remote_documents` as `doc.remote_documents`, it conflicts with: ForeignTable[name=doc.remote_documents, references={station_name=station_name, measured_at=measured_at, humidity_percent=humidity_percent, temperature_c=temperature_c, reading_id=reading_id}, server=my_postgresql, settings={"schema_name":"bridge_demo","table_name":"weather_readings"}]] ```  ### Expected Result  Snapshot restored successfully 
  **Post-Mortem & Fix Analysis**:
  > Just to be clear, I've tested with the combination 6.4.4 (create snapshot) and 6.4.5 to restore the snapshot. I also tested with both 6.4.4 and it worked with no errors. However, I haven't tested 6.4.5 and 6.4.5. 
  > @karynzv Thx for reporting this, issue has been introduced with 6.3.0 and it will be fixed with 6.4.5  

- **Issue #20269** (2026-09-24): **information_schema.columns reports no scale for NUMERIC columns**
  *Symptoms*: ### CrateDB version  6.4.5, nightly  ### CrateDB setup information  docker crate:6.4.5 with `-Cdiscovery.type=single-node`  ### Problem description  `sqlalchemy-cratedb` reads column types from `information_schema.columns`. While fixing `NUMERIC` support there (crate/sqlalchemy-cratedb#300), I found that a `NUMERIC(10, 2)` column comes back with the precision, but no scale. The server does store the scale, because `SHOW CREATE TABLE` prints it.  `pg_catalog.pg_attribute.atttypmod` is `-1` for the column, so PostgreSQL clients won't see the scale there either.  `numeric_scale` is hard-coded to null: https://github.com/crate/crate/blob/c056e5c1435b8eddae9309bbed6ef78238b5dc7d/server/src/main/java/io/crate/metadata/information/InformationColumnsTableInfo.java#L92  ### Steps to Reproduce   ```sql CREATE TABLE t (a NUMERIC(10, 2)); ```   ```sql  SELECT numeric_precision, numeric_scale FROM information_schema.columns WHERE table_name = 't'; ``` here numeric_scale is NULL  ```sql SHOW CREATE TABLE t;  ``` here it's 2  ### Actual Result  ``` numeric_precision | numeric_scale                10 |          NULL ```  `SHOW CREATE TABLE` prints `"a" NUMERIC(10, 2)`  ### Expected Result  expected the scale to be 2
  **Post-Mortem & Fix Analysis**:
  > Thank you for this report @florinutz ! The fix will be available with 6.4.6 release

- **Issue #20205** (2026-09-18): **`INTEGER` `RANGE` boundaries overflow at `MAX_VALUE`**
  *Symptoms*: ### CrateDB version  current main (71c0093)  ### CrateDB setup information  _No response_  ### Problem description  CrateDB evaluates a `INTEGER` `RANGE` frame incorrectly when adding a positive boundary offset to `2147483647`. The frame starts at `CURRENT ROW`, so the maximum-key row must be included even though its upper boundary is beyond the representable integer domain, but CrateDB returns an empty frame.  ### Steps to Reproduce  Run the following SQL against the target CrateDB runtime:  ```sql SELECT x,        count(*) OVER (ORDER BY x RANGE BETWEEN CURRENT ROW AND 1 FOLLOWING) AS row_count FROM (VALUES (CAST(0 AS INTEGER)), (CAST(2147483647 AS INTEGER))) AS t(x) ORDER BY x;  SET optimizer = false;  SELECT x,        count(*) OVER (ORDER BY x RANGE BETWEEN CURRENT ROW AND 1 FOLLOWING) AS row_count FROM (VALUES (CAST(0 AS INTEGER)), (CAST(2147483647 AS INTEGER))) AS t(x) ORDER BY x;  -- Type-widened control: BIGINT arithmetic does not overflow at the INTEGER maximum. SELECT x,        count(*) OVER (ORDER BY CAST(x AS BIGINT) RANGE BETWEEN CURRENT ROW AND 1 FOLLOWING) AS row_count FROM (VALUES (CAST(0 AS INTEGER)), (CAST(2147483647 AS INTEGER))) AS t(x) ORDER BY x; ```  ### Actual Result  The default and optimizer-disabled queries return:  ```text      x      | row_count -------------+-----------           0 |         1   2147483647 |         0 ```  The maximum-key row is present, but its frame is incorrectly empty.  ### Expected Result  The `CURRENT ROW` start must includ
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting @Yibo-Dong, the fix will be available with the next available hotfix release.

- **Issue #20204** (2026-09-16): **HashJoin misses SQL-equal `CHARACTER` values with different lengths**
  *Symptoms*: ### CrateDB version  current main (71c0093)  ### CrateDB setup information  _No response_  ### Problem description    CrateDB's `HashJoin` misses rows whose `CHARACTER(n)` keys are equal under SQL semantics but have different declared lengths. The equivalent `NestedLoopJoin` returns the correct match.     ### Steps to Reproduce  Run the following SQL on the target CrateDB runtime. It creates two one-row tables, forces `HashJoin`, then disables `HashJoin` as a control.  ```sql DROP TABLE IF EXISTS crate_val_149_left; DROP TABLE IF EXISTS crate_val_149_right;  CREATE TABLE crate_val_149_left (k CHARACTER(3), v INTEGER); CREATE TABLE crate_val_149_right (k CHARACTER(5), v INTEGER);  INSERT INTO crate_val_149_left VALUES ('a', 10); INSERT INTO crate_val_149_right VALUES ('a', 20); REFRESH TABLE crate_val_149_left, crate_val_149_right;  SET optimizer_equi_join_to_lookup_join = false; SET enable_hashjoin = true; SELECT count(*) AS matched, sum(l.v + r.v) AS total FROM crate_val_149_left l JOIN crate_val_149_right r ON l.k = r.k;  SET enable_hashjoin = false; SELECT count(*) AS matched, sum(l.v + r.v) AS total FROM crate_val_149_left l JOIN crate_val_149_right r ON l.k = r.k;  SELECT CAST('a' AS CHARACTER(3)) = CAST('a' AS CHARACTER(5)) AS sql_equal; ```   The final scalar check returns `true` for:  ```sql CAST('a' AS CHARACTER(3)) = CAST('a' AS CHARACTER(5)) ```  Therefore, the rows must join. The result is exact and uses only legal `CHARACTER` values and integer aggregates.  ### A
  **Post-Mortem & Fix Analysis**:
  > thx for reporting this, the fix will be available with 6.4.5.

- **Issue #20203** (2026-09-17): **UNION loses compound-query order before array_agg**
  *Symptoms*: ### CrateDB version  current main (`71c0093`)  ### CrateDB setup information  _No response_  ### Problem description  The query has no outermost `ORDER BY`, but the `ORDER BY x` after `UNION ALL` is defined on the complete compound query, not on either branch. CrateDB moves that compound-query `ORDER BY` into independent `ORDER BY` operators on each UNION branch. This is not equivalent when a downstream order-sensitive aggregate consumes the ordered subquery: `array_agg` then sees branch-local order rather than the requested order of the complete UNION result. ### Steps to Reproduce   ### Reproduction steps  Run the following SQL against the target CrateDB runtime:  ```sql  SET optimizer_move_order_beneath_union = true; SELECT array_agg(x) AS default_array FROM (     SELECT x FROM unnest([3, 1]) AS a(x)     UNION ALL     SELECT x FROM unnest([4, 2]) AS b(x)     ORDER BY x ) AS u;  SET optimizer_move_order_beneath_union = false; SELECT array_agg(x) AS controlled_array FROM (     SELECT x FROM unnest([3, 1]) AS a(x)     UNION ALL     SELECT x FROM unnest([4, 2]) AS b(x)     ORDER BY x ) AS u;  -- The compound query's ordered sequence is [1, 2, 3, 4]. With the rule -- enabled, each UNION branch is sorted independently and array_agg receives -- [1, 3, 2, 4]. With the rule disabled, the top-level order is preserved and -- array_agg receives [1, 2, 3, 4]. ```  ### Notes  Disabling the specific rule restores the top-level `OrderBy` and the expected aggregate result:  ```sql SET opti
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report, fix will be availble in the 6.4.6 hotfix release.

- **Issue #20143** (2026-09-09): **LEFT JOIN `ON` condition dropped when a CROSS JOIN follows an INNER JOIN**
  *Symptoms*: ### CrateDB version  6.4.3  ### CrateDB setup information  Found with docker compose, but also reproducible in (free) Cloud.  Number of nodes: 1 CRATE_HEAP_SIZE: 4g CRATE_JAVA_OPTS: ""  crate.yml contents: ""  ### Problem description  When one query block contains an INNER JOIN, a LEFT JOIN and a CROSS JOIN, the LEFT JOIN's ON condition is silently discarded and the outer join is planned as a cross join instead.  `EXPLAIN` shows the LEFT JOIN losing both its join type and its condition.  ``` OrderBy[x ASC z ASC] (rows=unknown)   └ NestedLoopJoin[CROSS] (rows=unknown)     ├ NestedLoopJoin[CROSS] (rows=unknown)    <-- is HashJoin[LEFT | (x = z)] with optimizer_eliminate_cross_join=false     │  ├ HashJoin[INNER | (x = y)] (rows=unknown)     │  │  ├ Rename[x] AS a (rows=unknown)     │  │  │  └ TableFunction[generate_series | [generate_series] | true] (rows=unknown)     │  │  └ Rename[y] AS b (rows=unknown)     │  │    └ TableFunction[generate_series | [generate_series] | true] (rows=unknown)     │  └ Rename[z] AS c (rows=unknown)     │    └ TableFunction[generate_series | [generate_series] | true] (rows=unknown)     └ Rename[w] AS d (rows=unknown)       └ TableFunction[generate_series | [generate_series] | true] (rows=unknown) ```  ### Steps to Reproduce  The bug only occurs with this set (true by default). ``` SET optimizer_eliminate_cross_join = true; ```  Reproducer with generated data  ``` SELECT a.x, b.y, c.z, d.w FROM generate_series(1,3) AS a (x) INNER JOIN generate_series
  **Post-Mortem & Fix Analysis**:
  > Thank you for the report. This will be fixed in 6.4.5 with https://github.com/crate/crate/pull/20163 

- **Issue #20120** (2026-09-14): **Correlated scalar subquery is lost across `GROUP BY`**
  *Symptoms*: ### CrateDB version  6.4.2  ### CrateDB setup information   Number of nodes: ? CRATE_HEAP_SIZE: ? CRATE_JAVA_OPTS: ?  crate.yml contents:  ### Problem description   A correlated scalar subquery works without grouping, but adding a valid `GROUP BY` causes CrateDB to lose the subquery result while constructing the execution plan. The query works on PostgreSQL 17.10.  This is related to the correlated-subquery grouping limitation tracked by https://github.com/crate/crate/issues/17224, but reaches an internal `SourceSymbols` error instead of the documented unsupported-feature error.   ### Steps to Reproduce   ```sql DROP TABLE IF EXISTS source_symbols_t;  CREATE TABLE source_symbols_t (     c1 INTEGER );  INSERT INTO source_symbols_t (c1) VALUES (1), (2); REFRESH TABLE source_symbols_t;  SELECT o.c1,        (SELECT i.c1         FROM source_symbols_t AS i         WHERE i.c1 > o.c1         ORDER BY i.c1         LIMIT 1) AS next_c1 FROM source_symbols_t AS o GROUP BY o.c1 ORDER BY o.c1; ```   ### Actual Result  ```text Couldn't create execution plan from logical plan because of: Couldn't find (SELECT c1 FROM (i)) in SourceSymbols ```   ### Expected Result  ```text c1 | next_c1 ---+-------- 1  | 2 2  | NULL ``` 
  **Post-Mortem & Fix Analysis**:
  > Thank you for the report. The fix will be part of the 6.4.5 release

- **Issue #20119** (2026-09-08): **Outer alias incorrectly shadows an inner table name**
  *Symptoms*: ### CrateDB version  6.4.2  ### CrateDB setup information   Number of nodes: ? CRATE_HEAP_SIZE: ? CRATE_JAVA_OPTS: ?  crate.yml contents:  ### Problem description   An outer table alias has the same name as a real table referenced by an inner subquery. CrateDB resolves the inner `FROM alias_inner_t` against the outer alias instead of the real table and reports that `c2` is unknown.  The query works on PostgreSQL 17.10. Qualifying the inner relation as `doc.alias_inner_t` also makes it return the expected result on CrateDB.     ### Steps to Reproduce   ```sql DROP TABLE IF EXISTS alias_outer_t; DROP TABLE IF EXISTS alias_inner_t;  CREATE TABLE alias_outer_t (     c1 INTEGER );  CREATE TABLE alias_inner_t (     c2 INTEGER );  INSERT INTO alias_outer_t (c1) VALUES (1); INSERT INTO alias_inner_t (c2) VALUES (42); REFRESH TABLE alias_outer_t, alias_inner_t;  SELECT (SELECT i.c2         FROM alias_inner_t AS i         LIMIT 1) AS result FROM alias_outer_t AS alias_inner_t; ```  ### Actual Result  ```text Column c2 unknown ```   ### Expected Result  ```text result ------ 42 ``` 
  **Post-Mortem & Fix Analysis**:
  > Thank you for the report. This will be fixed in 6.4.5 via https://github.com/crate/crate/pull/20147

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

### Incident Patch 1: `76ff9edc` (2026-09-29)
**Commit Message**: Fix HTTP session running as the wrong user

HTTP clients are authenticated in HttpAuthUpstreamHandler, but
previously, session creation re-derived the user from the
`Authorization` header and if it was missing it, as a fallback
it used `auth.trust.http_default_user` (defaults to `crate`).
Requests authenticated without the `Authorization` header
(e.g. via client certificate) did not run as the authenticated
user.

Move authentication into the request handlers via a shared
`HttpAuthenticator`. Each HTTP handler authenticates it and
creates the session for the resolved user by calling
`HttpAuthenticator.authenticate()` which returns the user,
or sends a `401` and returns null.

**File**: `server/src/main/java/io/crate/protocols/http/HttpAuthenticator.java` (renamed, +55/-98)
```diff
@@ -19,7 +19,7 @@
  * software solely pursuant to the terms of the relevant commercial agreement.
  */
 
-package io.crate.auth;
+package io.crate.protocols.http;
 
 import static io.crate.auth.AuthSettings.AUTH_HOST_BASED_JWT_ISS_SETTING;
 import static io.crate.protocols.SSL.getSession;
@@ -34,37 +34,40 @@
 import javax.net.ssl.SSLPeerUnverifiedException;
 import javax.net.ssl.SSLSession;
 
-import org.apache.logging.log4j.LogManager;
-import org.apache.logging.log4j.Logger;
 import org.elasticsearch.common.network.InetAddresses;
 import org.elasticsearch.common.settings.Settings;
 import org.elasticsearch.http.netty4.Netty4HttpServerTransport;
 import org.jspecify.annotations.Nullable;
 
+import io.crate.auth.AuthSettings;
+import io.crate.auth.Authentication;
+import io.crate.auth.AuthenticationMethod;
+import io.crate.auth.Credentials;
+import io.crate.auth.Protocol;
 import io.crate.common.annotations.VisibleForTesting;
 import io.crate.protocols.SSL;
-import io.crate.protocols.http.Headers;
 import io.crate.protocols.postgres.ConnectionProperties;
 import io.crate.role.Role;
 import io.crate.role.Roles;
 import io.netty.channel.Channel;
 import io.netty.channel.ChannelFutureListener;
-import io.netty.channel.ChannelHandlerContext;
-import io.netty.channel.SimpleChannelInboundHandler;
 import io.netty.handler.codec.http.DefaultFullHttpResponse;
-import io.netty.handler.codec.http.HttpContent;
 import io.netty.handler.codec.http.HttpHeaderNames;
 import io.netty.handler.codec.http.HttpRequest;
 import io.netty.handler.codec.http.HttpResponse;
 import io.netty.handler.codec.http.HttpResponseStatus;
 import io.netty.handler.codec.http.HttpUtil;
 import io.netty.handler.codec.http.HttpVersion;
-import io.netty.util.ReferenceCountUtil;
 
+/**
+ * Authenticates a single HTTP request
+ * <p>
+ * Each request-handling handler ({@link io.crate.rest.action.SqlHttpHandler},
+ * {@link HttpBlobHandler}, {@link MainAndStaticFileHandler}) must authenticate
+ * the request using this class before creating a session.
+ */
+public final class HttpAuthenticator {
 
-public class HttpAuthUpstreamHandler extends SimpleChannelInboundHandler<Object> {
-
-    private static final Logger LOGGER = LogManager.getLogger(HttpAuthUpstreamHandler.class);
     @VisibleForTesting
     // realm-value should not contain any special characters
     static final String WWW_AUTHENTICATE_REALM_MESSAGE = "Basic realm=\"CrateDB Authenticator\"";
@@ -73,96 +76,56 @@ public class HttpAuthUpstreamHandler extends SimpleChannelInboundHandler<Object>
     private final boolean checkJwtProperties;
     private final boolean supportXRealIp;
     private final String defaultUser;
-
     private final Roles roles;
-    private String authorizedUser = null;
 
-    public HttpAuthUpstreamHandler(Settings settings, Authentication authService, Roles roles) {
-        // do not auto-release reference counted messages which are just in transit here
-        super(false);
+    public HttpAuthenticator(Settings settings, Authentication authService, Roles roles) {
         this.checkJwtProperties = settings.get(AUTH_HOST_BASED_JWT_ISS_SETTING.getKey()) == null;
         this.supportXRealIp = AuthSettings.AUTH_TRUST_HTTP_SUPPORT_X_REAL_IP.get(settings);
         this.defaultUser = AuthSettings.AUTH_TRUST_HTTP_DEFAULT_HEADER.get(settings);
         this.authService = authService;
         this.roles = roles;
     }
 
-    @Override
-    protected void channelRead0(ChannelHandlerContext ctx, Object msg) throws Exception {
-        if (msg instanceof HttpRequest httpRequest) {
-            handleHttpRequest(ctx, httpRequest);
-        } else if (msg instanceof HttpContent httpContent) {
-            handleHttpChunk(ctx, httpContent);
-        } else {
-            // neither http request nor http chunk - send upstream and see ...
-            ctx.fireChannelRead(msg);
-        }
-    }
-
-
-    private void handleHttpRequest(ChannelHandlerContext ctx, HttpRequest request) {
-       
```

**File**: `server/src/main/java/io/crate/protocols/http/HttpBlobHandler.java` (modified, +8/-4)
```diff
@@ -35,7 +35,6 @@
 
 import org.apache.logging.log4j.LogManager;
 import org.apache.logging.log4j.Logger;
-import org.elasticsearch.common.settings.Settings;
 import org.elasticsearch.http.netty4.Netty4HttpServerTransport;
 import org.elasticsearch.index.IndexNotFoundException;
 import org.jspecify.annotations.Nullable;
@@ -111,8 +110,8 @@ public class HttpBlobHandler extends HttpHandler<Object> {
     private String index;
     private String digest;
 
-    public HttpBlobHandler(BlobService blobService, Settings settings, Sessions sessions, Roles roles) {
-        super(settings, sessions, roles);
+    public HttpBlobHandler(BlobService blobService, Sessions sessions, Roles roles, HttpAuthenticator authenticator) {
+        super(sessions, roles, authenticator);
         this.blobService = blobService;
     }
 
@@ -150,7 +149,12 @@ protected void channelRead0(ChannelHandlerContext ctx, Object msg) throws Except
             }
 
             try {
+                Role authenticatedUser = authenticate(ctx, request);
+                if (authenticatedUser == null) {
+                    return;
+                }
                 session = ensureSession(
+                    authenticatedUser,
                     new ConnectionProperties(
                         null, // not used
                         Netty4HttpServerTransport.getRemoteAddress(ctx.channel()),
@@ -364,7 +368,7 @@ private void partialContentResponse(String index, final String digest)
                     return;
                 }
                 end = raf.length() - 1;
-                if (!matcher.group(2).equals("")) {
+                if (!matcher.group(2).isEmpty()) {
                     end = Long.parseLong(matcher.group(2));
                 }
             } catch (NumberFormatException ex) {
```

**File**: `server/src/main/java/io/crate/protocols/http/HttpHandler.java` (modified, +14/-43)
```diff
@@ -21,16 +21,8 @@
 
 package io.crate.protocols.http;
 
-import static io.crate.auth.AuthSettings.AUTH_HOST_BASED_JWT_ISS_SETTING;
-
-import java.util.function.Predicate;
-
-import org.elasticsearch.common.settings.Settings;
 import org.jspecify.annotations.Nullable;
 
-import io.crate.auth.AuthSettings;
-import io.crate.auth.Credentials;
-import io.crate.auth.HttpAuthUpstreamHandler;
 import io.crate.common.annotations.VisibleForTesting;
 import io.crate.protocols.postgres.ConnectionProperties;
 import io.crate.role.Role;
@@ -39,29 +31,25 @@
 import io.crate.session.Sessions;
 import io.netty.channel.ChannelHandlerContext;
 import io.netty.channel.SimpleChannelInboundHandler;
-import io.netty.handler.codec.http.HttpHeaderNames;
 import io.netty.handler.codec.http.HttpMessage;
+import io.netty.handler.codec.http.HttpRequest;
 
 public abstract class HttpHandler<T> extends SimpleChannelInboundHandler<T> {
 
     private static final String REQUEST_HEADER_SCHEMA = "Default-Schema";
 
-    private final Settings settings;
     private final Sessions sessions;
     private final Roles roles;
-    private final boolean checkJwtProperties;
+    private final HttpAuthenticator authenticator;
 
     @VisibleForTesting
     Session session;
 
-    public HttpHandler(Settings settings,
-                       Sessions sessions,
-                       Roles roles) {
+    public HttpHandler(Sessions sessions, Roles roles, HttpAuthenticator authenticator) {
         super(false);
-        this.settings = settings;
         this.sessions = sessions;
         this.roles = roles;
-        this.checkJwtProperties = settings.get(AUTH_HOST_BASED_JWT_ISS_SETTING.getKey()) == null;
+        this.authenticator = authenticator;
     }
 
     protected Roles roles() {
@@ -77,10 +65,18 @@ public void channelUnregistered(ChannelHandlerContext ctx) throws Exception {
         super.channelUnregistered(ctx);
     }
 
+    /**
+     * On failure a {@code 401} has already been sent and {@code null} is returned;
+     * the caller must stop processing and release the request.
+     */
+    @Nullable
+    protected Role authenticate(ChannelHandlerContext ctx, HttpRequest request) {
+        return authenticator.authenticate(request, ctx.channel());
+    }
+
     @VisibleForTesting
-    public Session ensureSession(ConnectionProperties connectionProperties, HttpMessage request) {
+    public Session ensureSession(Role authenticatedUser, ConnectionProperties connectionProperties, HttpMessage request) {
         String defaultSchema = request.headers().get(REQUEST_HEADER_SCHEMA);
-        Role authenticatedUser = userFromAuthHeader(request.headers().get(HttpHeaderNames.AUTHORIZATION));
         Session session = this.session;
         if (session == null) {
             session = sessions.newSession(connectionProperties, defaultSchema, authenticatedUser);
@@ -91,29 +87,4 @@ public Session ensureSession(ConnectionProperties connectionProperties, HttpMess
         this.session = session;
         return session;
     }
-
-    /**
-     * Doesn't do authentication as it's already done
-     * in {@link HttpAuthUpstreamHandler} which is registered before this handler
-     * Checks user existence and if not possible to resolve from header (basic or jwt),
-     * returns trusted user from configuration.
-     */
-    @VisibleForTesting
-    public Role userFromAuthHeader(@Nullable String authHeaderValue) {
-        try (Credentials credentials = Headers.extractCredentialsFromHttpAuthHeader(authHeaderValue)) {
-            Predicate<Role> rolePredicate = credentials.matchByToken(checkJwtProperties);
-            if (rolePredicate != null) {
-                Role role = roles.findUser(rolePredicate);
-                if (role != null) {
-                    credentials.setUsername(role.name());
-                }
-            }
-            String username = credentials.username();
-            // Fallback to trusted user from configuration
-            if (username
```

**File**: `server/src/main/java/io/crate/protocols/http/MainAndStaticFileHandler.java` (modified, +6/-1)
```diff
@@ -76,11 +76,13 @@ public class MainAndStaticFileHandler extends SimpleChannelInboundHandler<FullHt
     private final Path sitePath;
     private final NodeClient client;
     private final String nodeName;
+    private final HttpAuthenticator authenticator;
 
-    public MainAndStaticFileHandler(String nodeName, Path home, NodeClient client) {
+    public MainAndStaticFileHandler(String nodeName, Path home, NodeClient client, HttpAuthenticator authenticator) {
         this.nodeName = nodeName;
         this.sitePath = home.resolve("lib").resolve("site");
         this.client = client;
+        this.authenticator = authenticator;
     }
 
     @Override
@@ -143,6 +145,9 @@ private void send500(ChannelHandlerContext ctx, String message) {
 
     @Override
     protected void channelRead0(ChannelHandlerContext ctx, FullHttpRequest msg) throws Exception {
+        if (authenticator.authenticate(msg, ctx.channel()) == null) {
+            return;
+        }
         switch (msg.uri().trim().toLowerCase(Locale.ENGLISH)) {
             case "/admin":
             case "/_plugin/crate-admin":
```

**File**: `server/src/main/java/io/crate/rest/action/SqlHttpHandler.java` (modified, +13/-5)
```diff
@@ -38,7 +38,6 @@
 import org.apache.logging.log4j.LogManager;
 import org.apache.logging.log4j.Logger;
 import org.elasticsearch.common.breaker.CircuitBreaker;
-import org.elasticsearch.common.settings.Settings;
 import org.elasticsearch.common.xcontent.XContentBuilder;
 import org.elasticsearch.common.xcontent.XContentType;
 import org.elasticsearch.common.xcontent.json.JsonXContent;
@@ -57,8 +56,10 @@
 import io.crate.metadata.settings.CoordinatorSessionSettings;
 import io.crate.netty.AccountedByteBuf;
 import io.crate.protocols.http.Headers;
+import io.crate.protocols.http.HttpAuthenticator;
 import io.crate.protocols.http.HttpHandler;
 import io.crate.protocols.postgres.ConnectionProperties;
+import io.crate.role.Role;
 import io.crate.role.Roles;
 import io.crate.session.DescribeResult;
 import io.crate.session.ResultReceiver;
@@ -89,11 +90,11 @@ public class SqlHttpHandler extends HttpHandler<FullHttpRequest> {
     @VisibleForTesting
     Session session;
 
-    public SqlHttpHandler(Settings settings,
-                          Sessions sessions,
+    public SqlHttpHandler(Sessions sessions,
                           Function<String, CircuitBreaker> circuitBreakerProvider,
-                          Roles roles) {
-        super(settings, sessions, roles);
+                          Roles roles,
+                          HttpAuthenticator authenticator) {
+        super(sessions, roles, authenticator);
         this.circuitBreakerProvider = circuitBreakerProvider;
     }
 
@@ -104,10 +105,17 @@ protected void channelRead0(ChannelHandlerContext ctx, FullHttpRequest request)
             return;
         }
 
+        Role authenticatedUser = authenticate(ctx, request);
+        if (authenticatedUser == null) {
+            request.release();
+            return;
+        }
+
         Session session;
         Map<String, List<String>> parameters;
         try {
             session = ensureSession(
+                authenticatedUser,
                 new ConnectionProperties(
                     null, // not used
                     Netty4HttpServerTransport.getRemoteAddress(ctx.channel()),
```

---

### Incident Patch 2: `d8c817b9` (2026-09-29)
**Commit Message**: Fix NPE in EXPLAIN ANALYZE caused by unsynchronized QueryProfiler#pollLast

**File**: `docs/appendices/release-notes/6.4.6.rst` (modified, +3/-0)
```diff
@@ -80,3 +80,6 @@ Fixes
 - Fixed a rare race condition causing the ``query`` CircuitBreaker’s state not
   to be reset after ``KILL``, and leading to consequent queries to fail with
   false positive ``CircuitBreakingException``.
+
+- Fixed a race condition in ``EXPLAIN ANALYZE`` that could cause an intermittent
+  ``NullPointerException``.
```

**File**: `server/src/main/java/org/elasticsearch/search/profile/query/QueryProfiler.java` (modified, +3/-3)
```diff
@@ -59,7 +59,7 @@ public QueryProfiler() {
      * Returns a {@link QueryProfileBreakdown} for a scoring query.  Scoring queries (e.g. those
      * that are past the rewrite phase and are now being wrapped by createWeight() ) follow
      * a recursive progression.  We can track the dependency tree by a simple stack
-     *
+     * <p>
      * The only hiccup is that the first scoring query will be identical to the last rewritten
      * query, so we need to take special care to fix that
      *
@@ -98,7 +98,7 @@ public synchronized QueryProfileBreakdown getProfileBreakdown(Query query) {
 
     /**
      * Helper method to add a new node to the dependency tree.
-     *
+     * <p>
      * Initializes a new list in the dependency tree, saves the query and
      * generates a new {@link QueryProfileBreakdown} to track the timings of
      * this query
@@ -129,7 +129,7 @@ private QueryProfileBreakdown createProfileBreakdown() {
     /**
      * Removes the last (e.g. most recent) value on the stack
      */
-    public void pollLast() {
+    public synchronized void pollLast() {
         stack.pollLast();
     }
 
```

**File**: `server/src/test/java/org/elasticsearch/search/profile/query/QueryProfilerTest.java` (modified, +17/-32)
```diff
@@ -21,13 +21,12 @@
 
 package org.elasticsearch.search.profile.query;
 
-import static org.assertj.core.api.Assertions.assertThat;
-
-import java.util.concurrent.CountDownLatch;
+import java.util.ArrayList;
+import java.util.List;
+import java.util.concurrent.Callable;
 import java.util.concurrent.ExecutorService;
 import java.util.concurrent.Executors;
 import java.util.concurrent.TimeUnit;
-import java.util.concurrent.atomic.AtomicReference;
 
 import org.apache.lucene.search.MatchAllDocsQuery;
 import org.elasticsearch.test.ESTestCase;
@@ -57,40 +56,26 @@ public void tearDown() throws Exception {
     @Test
     public void test_ensure_thread_safety() throws Exception {
         QueryProfiler profiler = new QueryProfiler();
-        final AtomicReference<Throwable> lastThrowable = new AtomicReference<>();
 
         int concurrency = 20;
-
-        final CountDownLatch writeLatch = new CountDownLatch(concurrency);
+        // getProfileBreakdown + pollLast
+        List<Callable<Object>> tasks = new ArrayList<>(concurrency * 2);
         for (int i = 0; i < concurrency; i++) {
-            executor.submit(() -> {
-                try {
-                    profiler.getProfileBreakdown(MatchAllDocsQuery.INSTANCE);
-                } catch (Exception e) {
-                    lastThrowable.set(e);
-                } finally {
-                    writeLatch.countDown();
-                }
-            });
+            tasks.add(() -> profiler.getProfileBreakdown(MatchAllDocsQuery.INSTANCE));
+            tasks.add(Executors.callable(profiler::pollLast));
+        }
+        for (var future : executor.invokeAll(tasks, 10, TimeUnit.SECONDS)) {
+            future.get();
         }
-        writeLatch.await(10, TimeUnit.SECONDS);
-
-        assertThat(lastThrowable.get()).isNull();
 
-        final CountDownLatch readLatch = new CountDownLatch(concurrency);
+        // getProfileBreakdown + getTree
+        tasks = new ArrayList<>(concurrency * 2);
         for (int i = 0; i < concurrency; i++) {
-            executor.submit(() -> {
-                try {
-                    profiler.getTree();
-                } catch (Exception e) {
-                    lastThrowable.set(e);
-                } finally {
-                    readLatch.countDown();
-                }
-            });
+            tasks.add(() -> profiler.getProfileBreakdown(MatchAllDocsQuery.INSTANCE));
+            tasks.add(profiler::getTree);
+        }
+        for (var future : executor.invokeAll(tasks, 10, TimeUnit.SECONDS)) {
+            future.get();
         }
-        readLatch.await(10, TimeUnit.SECONDS);
-
-        assertThat(lastThrowable.get()).isNull();
     }
 }
```

---

### Incident Patch 3: `7a108456` (2026-09-28)
**Commit Message**: Fix rounding error on casts to date of values < 1970

**File**: `docs/appendices/release-notes/6.4.6.rst` (modified, +3/-0)
```diff
@@ -46,6 +46,9 @@ series.
 Fixes
 =====
 
+- Fixed a rounding error if casting timestamp or long values before 1970-01-01
+  to ``date``.
+
 - Fixed an issue that caused order-sensitive aggregations
   (``string_agg``, ``array_agg``) applied on top of ``UNION ALL ... ORDER BY``
   to return incorrect results.
```

**File**: `server/src/main/java/io/crate/types/DateType.java` (modified, +19/-2)
```diff
@@ -55,6 +55,24 @@ public class DateType extends DataType<Long>
     public static final String NAME = "date";
     public static final DateType INSTANCE = new DateType();
     public static final int TYPE_SIZE = (int) RamUsageEstimator.shallowSizeOfInstance(Long.class);
+    public static final int DAY_TO_MS = 86400000;
+
+    // Date values are streamed as timestamp (in ms since epoch) to clients via HTTP
+    // So our max/min values are smaller than LocalDate.MAX/MIN
+    public static final LocalDate MAX_NULL_SENTINEL = ofTimestamp(Long.MAX_VALUE);
+    public static final LocalDate MIN_NULL_SENTINEL = ofTimestamp(Long.MIN_VALUE);
+    public static final LocalDate MAX = MAX_NULL_SENTINEL.minusDays(1);
+    public static final LocalDate MIN = MIN_NULL_SENTINEL.plusDays(1);
+
+    public static LocalDate ofTimestamp(long msValue) {
+        return msValue >= 0
+            ? LocalDate.ofEpochDay(msValue / DAY_TO_MS)
+            : LocalDate.ofEpochDay(Math.floorDiv(msValue, DAY_TO_MS));
+    }
+
+    public static long toTimestamp(LocalDate date) {
+        return date.toEpochDay() * DAY_TO_MS;
+    }
 
     private static final StorageSupport<Long> STORAGE = new StorageSupport<>(true, true, new LongEqQuery()) {
         @Override
@@ -140,8 +158,7 @@ public Long implicitCast(Object value) throws IllegalArgumentException, ClassCas
             throw new ClassCastException("Can't cast '" + value + "' to " + getName());
         }
 
-        var epochDay = longVal / 1000 / 86400;
-        var localDate = LocalDate.ofEpochDay(epochDay);
+        LocalDate localDate = ofTimestamp(longVal);
         return localDate.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();
     }
 
```

**File**: `server/src/test/java/io/crate/integrationtests/GroupByAggregateTest.java` (modified, +10/-1)
```diff
@@ -60,6 +60,7 @@
 import io.crate.testing.UseRandomizedSchema;
 import io.crate.types.DataType;
 import io.crate.types.DataTypes;
+import io.crate.types.DateType;
 
 @IntegTestCase.ClusterScope(numDataNodes = 2, numClientNodes = 0, supportsDedicatedMasters = false)
 public class GroupByAggregateTest extends IntegTestCase {
@@ -159,7 +160,15 @@ record TestCase(DataType<?> dataType, List<Object> values) { }
             ),
             new TestCase(DataTypes.FLOAT, List.of(-Float.MAX_VALUE, -Float.MAX_VALUE, Float.MAX_VALUE, -1.23f)),
             new TestCase(DataTypes.DOUBLE, List.of(-Double.MAX_VALUE, -Double.MAX_VALUE, Double.MAX_VALUE, -1.23d)),
-            new TestCase(DataTypes.DATE, List.of(Long.MIN_VALUE, Long.MIN_VALUE, Long.MAX_VALUE, 0L)),
+            new TestCase(
+                DataTypes.DATE,
+                List.of(
+                    DateType.toTimestamp(DateType.MIN),
+                    DateType.toTimestamp(DateType.MIN),
+                    DateType.toTimestamp(DateType.MAX),
+                    0L
+                )
+            ),
             new TestCase(
                 DataTypes.TIMESTAMPZ,
                 List.of(Long.MIN_VALUE + 1, Long.MIN_VALUE + 1, Long.MAX_VALUE - 1, -1)
```

**File**: `server/src/test/java/io/crate/types/DateTypeTest.java` (modified, +9/-0)
```diff
@@ -67,4 +67,13 @@ public void testCastNumericNonFloatValue() {
     public void testCastNull() {
         assertThat(DateType.INSTANCE.implicitCast(null)).isNull();
     }
+
+    @Test
+    public void test_cast_of_timestamps_near_1970_rounds_up_or_down() throws Exception {
+        Long timestamp = DataTypes.TIMESTAMP.implicitCast("1969-12-31 12:00");
+        assertThat(DataTypes.DATE.implicitCast(timestamp)).isEqualTo(-86400000L);
+
+        timestamp = DataTypes.TIMESTAMP.implicitCast("1970-01-01 12:00");
+        assertThat(DataTypes.DATE.implicitCast(timestamp)).isEqualTo(0L);
+    }
 }
```

---

### Incident Patch 4: `89224ba4` (2026-09-24)
**Commit Message**: Fix `numeric_scale` in `information_schema.columns`

Previously it was always returning `NULL`, so to follow
postgres behavior it now returns `0` for integral numerics,
the defined `scale` for `NUMERIC` and `NULL` for anything else.

```
matriv=# create table tbl(a int, b bigint, c smallint, d real, e double precision, ts timestamp, f numeric(12,8), g numeric(6,6)[]);
CREATE TABLE
matriv=# SELECT column_name, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_name = 'tbl'
        ORDER BY column_name;
 column_name | numeric_precision | numeric_scale
-------------+-------------------+---------------
 a           |                32 |             0
 b           |                64 |             0
 c           |                16 |             0
 d           |                24 |
 e           |                53 |
 f           |                12 |             8
 g           |                   |
 ts          |                   |
(8 rows)
```
Fixes: https://github.com/crate/crate/issues/20269

**File**: `docs/appendices/release-notes/6.4.6.rst` (modified, +6/-0)
```diff
@@ -57,3 +57,9 @@ Fixes
 - Fixed an issue that caused ``CREATE SNAPSHOT`` to fail if repository had at
   least one snapshot created before and backend storage's DELETE API was
   temporarily unavailable.
+
+- Fixed an issue that caused ``NULL`` to always be returned for
+  ``numeric_scale`` of :ref:`information_schema.columns
+  <information_schema_columns>` table. Now it returns the defined ``scale`` for
+  ``NUMERIC``, ``0`` for integral numeric types (``BYTE``, ``SHORT``,
+  ``INTEGER``, ``LONG``) and ``NULL`` for all other types.
```

**File**: `server/src/main/java/io/crate/metadata/information/InformationColumnsTableInfo.java` (modified, +14/-1)
```diff
@@ -24,6 +24,7 @@
 import static io.crate.types.DataTypes.BOOLEAN;
 import static io.crate.types.DataTypes.INTEGER;
 import static io.crate.types.DataTypes.LONG;
+import static io.crate.types.DataTypes.NUMERIC;
 import static io.crate.types.DataTypes.STRING;
 import static io.crate.types.DataTypes.STRING_ARRAY;
 import static io.crate.types.DataTypes.TIMESTAMP;
@@ -36,7 +37,9 @@
 import io.crate.metadata.GeneratedReference;
 import io.crate.metadata.RelationName;
 import io.crate.metadata.SystemTable;
+import io.crate.types.DataType;
 import io.crate.types.DataTypes;
+import io.crate.types.NumericType;
 
 
 public final class InformationColumnsTableInfo {
@@ -89,7 +92,17 @@ private InformationColumnsTableInfo() {}
             }
             return null;
         })
-        .add("numeric_scale", INTEGER, ignored -> null)
+        .add("numeric_scale", INTEGER, c -> {
+            DataType<?> type = c.ref().valueType();
+            int id = type.id();
+            if (id == DataTypes.BYTE.id() || id == DataTypes.SHORT.id() || id == INTEGER.id() || id == LONG.id()) {
+                return 0;
+            }
+            if (id == NUMERIC.id()) {
+                return ((NumericType) type).scale();
+            }
+            return null;
+        })
         .add("datetime_precision", INTEGER, r -> {
             if (r.ref().valueType() == TIMESTAMPZ || r.ref().valueType() == TIMESTAMP) {
                 return DATETIME_PRECISION;
```

**File**: `server/src/test/java/io/crate/integrationtests/InformationSchemaTest.java` (modified, +31/-3)
```diff
@@ -24,7 +24,6 @@
 import static io.crate.protocols.postgres.PGErrorStatus.INTERNAL_ERROR;
 import static io.crate.testing.Asserts.assertThat;
 import static io.netty.handler.codec.http.HttpResponseStatus.BAD_REQUEST;
-import static org.assertj.core.api.Assertions.assertThat;
 
 import java.util.Collections;
 import java.util.List;
@@ -701,7 +700,10 @@ public void testSelectFromTableColumns() {
                 "    level2 string not null," +
                 "    level2_nullable string" +
                 "  ) not null" +
-                ") not null)");
+                ") not null, " +
+                "ts timestamp, " +
+                "y numeric(10, 6), " +
+                "y_array numeric(10, 6)[])");
 
         execute("select * from INFORMATION_SCHEMA.Columns where table_schema = ? order by column_name asc", new Object[]{defaultSchema});
         assertThat(response).hasColumns(
@@ -747,7 +749,7 @@ public void testSelectFromTableColumns() {
             "udt_schema"
         );
 
-        assertThat(response.rowCount()).isEqualTo(11L);
+        assertThat(response.rowCount()).isEqualTo(14L);
 
         Map<String, Integer> cols = IntStream.range(0, response.cols().length)
                                              .boxed()
@@ -764,6 +766,9 @@ public void testSelectFromTableColumns() {
         assertThat(response.rows()[8][cols.get("column_name")]).isEqualTo("stuff['level1']");
         assertThat(response.rows()[9][cols.get("column_name")]).isEqualTo("stuff['level1']['level2']");
         assertThat(response.rows()[10][cols.get("column_name")]).isEqualTo("stuff['level1']['level2_nullable']");
+        assertThat(response.rows()[11][cols.get("column_name")]).isEqualTo("ts");
+        assertThat(response.rows()[12][cols.get("column_name")]).isEqualTo("y");
+        assertThat(response.rows()[13][cols.get("column_name")]).isEqualTo("y_array");
 
         assertThat(response.rows()[0][cols.get("data_type")]).isEqualTo("integer");
         assertThat(response.rows()[0][cols.get("datetime_precision")]).isEqualTo(null);
@@ -794,6 +799,20 @@ public void testSelectFromTableColumns() {
         assertThat(response.rows()[6][cols.get("numeric_precision")]).isEqualTo(16);
         assertThat(response.rows()[4][cols.get("numeric_precision")]).isEqualTo(53);
         assertThat(response.rows()[5][cols.get("numeric_precision")]).isEqualTo(24);
+        assertThat(response.rows()[11][cols.get("numeric_precision")]).isNull();
+        assertThat(response.rows()[12][cols.get("numeric_precision")]).isEqualTo(10);
+        assertThat(response.rows()[13][cols.get("numeric_precision")]).isNull();
+
+        assertThat(response.rows()[0][cols.get("numeric_scale")]).isEqualTo(0);  // age integer
+        assertThat(response.rows()[1][cols.get("numeric_scale")]).isEqualTo(0);  // b byte
+        assertThat(response.rows()[3][cols.get("numeric_scale")]).isNull();               // col2 string
+        assertThat(response.rows()[4][cols.get("numeric_scale")]).isNull();               // d double
+        assertThat(response.rows()[5][cols.get("numeric_scale")]).isNull();               // f float
+        assertThat(response.rows()[6][cols.get("numeric_scale")]).isEqualTo(0);  // s short
+        assertThat(response.rows()[7][cols.get("numeric_scale")]).isNull();               // stuff object
+        assertThat(response.rows()[11][cols.get("numeric_scale")]).isNull();              // ts timestamp
+        assertThat(response.rows()[12][cols.get("numeric_scale")]).isEqualTo(6); // y numeric(10, 2)
+        assertThat(response.rows()[13][cols.get("numeric_scale")]).isNull();              // y_array numeric(10, 2)[]
 
         // Select the column_details values explicitly to preserve the long value of column_details['oid'].
         // If column_details is select, it will be returned as JSON using pgJDBC, resulting in an integer.
@@ -824,6 +843,15 @@ public void testSelectFromTableColumns() {
         assertThat(response.rows()[10][1]).isEqual
```

---

### Incident Patch 5: `472a4319` (2026-09-22)
**Commit Message**: Revert back to surefire plugin 3.5.6

3.6.0 discovers no tests with the toolchain jvm and forkCount > 1

Follows: #20251

**File**: `pom.xml` (modified, +35/-1)
```diff
@@ -209,6 +209,40 @@
                                     </ignoreVersion>
                                 </ignoreVersions>
                             </rule>
+                            <!-- Ignore anything above 3.5.6: 3.6.0 discovers 0 tests when forkCount > 1.
+                                 Drop these rules once a release with the fix is out. -->
+                            <rule>
+                                <groupId>org.apache.maven.plugins</groupId>
+                                <artifactId>maven-surefire-plugin</artifactId>
+                                <ignoreVersions>
+                                    <!-- 3.5.7+ within the 3.5 line -->
+                                    <ignoreVersion>
+                                        <version>^3\.5\.([7-9]|\d{2,}).*</version>
+                                        <type>regex</type>
+                                    </ignoreVersion>
+                                    <!-- 3.6.0+ -->
+                                    <ignoreVersion>
+                                        <version>^3\.([6-9]|\d{2,})\..*</version>
+                                        <type>regex</type>
+                                    </ignoreVersion>
+                                </ignoreVersions>
+                            </rule>
+                            <rule>
+                                <groupId>org.apache.maven.plugins</groupId>
+                                <artifactId>maven-surefire-report-plugin</artifactId>
+                                <ignoreVersions>
+                                    <!-- 3.5.7+ within the 3.5 line -->
+                                    <ignoreVersion>
+                                        <version>^3\.5\.([7-9]|\d{2,}).*</version>
+                                        <type>regex</type>
+                                    </ignoreVersion>
+                                    <!-- 3.6.0+ -->
+                                    <ignoreVersion>
+                                        <version>^3\.([6-9]|\d{2,})\..*</version>
+                                        <type>regex</type>
+                                    </ignoreVersion>
+                                </ignoreVersions>
+                            </rule>
                         </rules>
                     </ruleSet>
                 </configuration>
@@ -368,7 +402,7 @@
         <versions.plugin.resources>3.5.0</versions.plugin.resources>
         <versions.plugin.install>3.2.0</versions.plugin.install>
         <versions.plugin.compiler>3.16.0</versions.plugin.compiler>
-        <versions.plugin.surefire>3.6.0</versions.plugin.surefire>
+        <versions.plugin.surefire>3.5.6</versions.plugin.surefire>
         <versions.plugin.checkstyle>3.6.0</versions.plugin.checkstyle>
         <versions.plugin.puppycrawl>12.3.1</versions.plugin.puppycrawl>
         <versions.plugin.toolchains>4.5.0</versions.plugin.toolchains>
```

---

### Incident Patch 6: `3198c342` (2026-09-21)
**Commit Message**: Revert crate-python version pin and fix docs tests for >= 2.3

crate-python 2.3.0 contacts the configured servers within `connect()` and
raises `ConnectionError` when none of them responds.

Previously, `test_docs.py` created its `CrateTestShell` at import time and
the shell connects within its constructor, so importing the module connected
to the default `localhost:4200` before any node was started.

Create the shell in `ConnectingCrateLayer.start()`, against the http_url of the
node that has just been started.

Follows: #20233

**File**: `blackbox/requirements.txt` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 # set up your environment from scratch
 
 crash>=0.25.0
-crate<2.3
+crate
 asyncpg>=0.27.0
 cr8>=0.19.1
 tqdm>=4.66.4
```

**File**: `blackbox/test_docs.py` (modified, +11/-5)
```diff
@@ -58,12 +58,16 @@ def is_target_file_name(item):
 
 class CrateTestShell(CrateShell):
 
-    def __init__(self):
-        super(CrateTestShell, self).__init__(is_tty=False)
+    def __init__(self, crate_hosts):
+        super().__init__(crate_hosts, is_tty=False)
         self.logger = ColorPrinter(False, stream=PrintWrapper(), line_end='\n')
 
 
-cmd = CrateTestShell()
+# The shell connects within its constructor, and crate-python >= 2.3 checks
+# the servers in `connect()` and raises `ConnectionError` if none of them
+# responds. It is therefore created once the node is up, in
+# `ConnectingCrateLayer.start()`, instead of at import time.
+cmd = None
 
 
 def pretty_print(s):
@@ -82,8 +86,9 @@ def __init__(self, *args, **kwargs):
         super().__init__(*args, **kwargs)
 
     def start(self):
+        global cmd
         super().start()
-        cmd._connect(self.http_url)
+        cmd = CrateTestShell(self.http_url)
 
     def stop(self):
         print('')
@@ -432,7 +437,8 @@ def run(self, result, debug=False):
             super().run(result, debug)
         finally:
             crate.stop()
-            cmd.close()
+            if cmd is not None:
+                cmd.close()
 
 class CrateDBVersionTest(unittest.TestCase):
     """
```

---

### Incident Patch 7: `a1b11cd2` (2026-09-16)
**Commit Message**: Fix overflow in integral RANGE window boundaries

**File**: `docs/appendices/release-notes/6.4.6.rst` (modified, +4/-0)
```diff
@@ -49,3 +49,7 @@ Fixes
 - Fixed an issue that caused order-sensitive aggregations
   (``string_agg``, ``array_agg``) applied on top of ``UNION ALL ... ORDER BY``
   to return incorrect results.
+
+- Fixed an issue that could cause window functions using ``RANGE`` with
+  integral ``PRECEDING``/``FOLLOWING`` bounds to compute frames incorrectly due
+  to boundary overflow.
```

**File**: `server/src/main/java/io/crate/execution/engine/window/WindowFrameBoundaryArithmetic.java` (renamed, +36/-9)
```diff
@@ -40,21 +40,48 @@
 import io.crate.types.ShortType;
 import io.crate.types.TimestampType;
 
-class ArithmeticOperatorsFactory {
+// Clamps integral overflow instead of wrapping around.
+class WindowFrameBoundaryArithmetic {
 
     private static final BinaryOperator<Double> ADD_DOUBLE_FUNCTION = Double::sum;
-    private static final BinaryOperator<Byte> ADD_BYTE_FUNCTION = (Byte x, Byte y) -> (byte) (x.intValue() + y.intValue());
-    private static final BinaryOperator<Short> ADD_SHORT_FUNCTION = (Short x, Short y) -> (short) (x.intValue() + y.intValue());
-    private static final BinaryOperator<Integer> ADD_INTEGER_FUNCTION = Integer::sum;
-    private static final BinaryOperator<Long> ADD_LONG_FUNCTION = Long::sum;
     private static final BinaryOperator<Float> ADD_FLOAT_FUNCTION = Float::sum;
+    private static final BinaryOperator<Byte> ADD_BYTE_FUNCTION = (Byte x, Byte y) -> {
+        int result = x.intValue() + y.intValue();
+        return (byte) Math.clamp(result, Byte.MIN_VALUE, Byte.MAX_VALUE);
+    };
+    private static final BinaryOperator<Short> ADD_SHORT_FUNCTION = (Short x, Short y) -> {
+        int result = x.intValue() + y.intValue();
+        return (short) Math.clamp(result, Short.MIN_VALUE, Short.MAX_VALUE);
+    };
+    private static final BinaryOperator<Integer> ADD_INTEGER_FUNCTION = (Integer x, Integer y) ->
+        Math.clamp(x.longValue() + y.longValue(), Integer.MIN_VALUE, Integer.MAX_VALUE);
+    private static final BinaryOperator<Long> ADD_LONG_FUNCTION = (Long x, Long y) -> {
+        try {
+            return Math.addExact(x, y);
+        } catch (ArithmeticException e) {
+            return y > 0 ? Long.MAX_VALUE : Long.MIN_VALUE;
+        }
+    };
 
     private static final BinaryOperator<Double> SUB_DOUBLE_FUNCTION = (arg0, arg1) -> arg0 - arg1;
-    private static final BinaryOperator<Byte> SUB_BYTE_FUNCTION = (arg0, arg1) -> (byte) (arg0.intValue() - arg1.intValue());
-    private static final BinaryOperator<Short> SUB_SHORT_FUNCTION = (arg0, arg1) -> (short) (arg0.intValue() - arg1.intValue());
-    private static final BinaryOperator<Integer> SUB_INTEGER_FUNCTION = (arg0, arg1) -> arg0 - arg1;
-    private static final BinaryOperator<Long> SUB_LONG_FUNCTION = (arg0, arg1) -> arg0 - arg1;
     private static final BinaryOperator<Float> SUB_FLOAT_FUNCTION = (arg0, arg1) -> arg0 - arg1;
+    private static final BinaryOperator<Byte> SUB_BYTE_FUNCTION = (Byte x, Byte y) -> {
+        int result = x.intValue() - y.intValue();
+        return (byte) Math.clamp(result, Byte.MIN_VALUE, Byte.MAX_VALUE);
+    };
+    private static final BinaryOperator<Short> SUB_SHORT_FUNCTION = (Short x, Short y) -> {
+        int result = x.intValue() - y.intValue();
+        return (short) Math.clamp(result, Short.MIN_VALUE, Short.MAX_VALUE);
+    };
+    private static final BinaryOperator<Integer> SUB_INTEGER_FUNCTION = (Integer x, Integer y) ->
+        Math.clamp(x.longValue() - y.longValue(), Integer.MIN_VALUE, Integer.MAX_VALUE);
+    private static final BinaryOperator<Long> SUB_LONG_FUNCTION = (Long x, Long y) -> {
+        try {
+            return Math.subtractExact(x, y);
+        } catch (ArithmeticException e) {
+            return y < 0 ? Long.MAX_VALUE : Long.MIN_VALUE;
+        }
+    };
 
     static BiFunction getAddFunction(DataType<?> fstArgDataType, DataType<?> sndArgDataType) {
         switch (fstArgDataType.id()) {
```

**File**: `server/src/main/java/io/crate/execution/engine/window/WindowProjector.java` (modified, +4/-4)
```diff
@@ -182,8 +182,8 @@ static ComputeFrameBoundary<Object[]> createComputeEndFrameBoundary(int numCells
         BiFunction<Object[], Object[], Object[]> updateProbeValues;
         if (offsetValue != null && framingMode == WindowFrame.Mode.RANGE) {
             BiFunction<DataType<?>, DataType<?>, BiFunction> offsetFn = windowDefinition.orderBy().reverseFlags()[0]
-                ? ArithmeticOperatorsFactory::getSubtractFunction
-                : ArithmeticOperatorsFactory::getAddFunction;
+                ? WindowFrameBoundaryArithmetic::getSubtractFunction
+                : WindowFrameBoundaryArithmetic::getAddFunction;
             updateProbeValues = createUpdateProbeValueFunction(windowDefinition, offsetFn, offsetValue, offsetType);
         } else {
             updateProbeValues = (currentRow, x) -> x;
@@ -214,8 +214,8 @@ static ComputeFrameBoundary<Object[]> createComputeStartFrameBoundary(int numCel
         BiFunction<Object[], Object[], Object[]> updateStartProbeValue;
         if (offsetValue != null && framingMode == WindowFrame.Mode.RANGE) {
             BiFunction<DataType<?>, DataType<?>, BiFunction> offsetFn = windowDefinition.orderBy().reverseFlags()[0]
-                ? ArithmeticOperatorsFactory::getAddFunction
-                : ArithmeticOperatorsFactory::getSubtractFunction;
+                ? WindowFrameBoundaryArithmetic::getAddFunction
+                : WindowFrameBoundaryArithmetic::getSubtractFunction;
             updateStartProbeValue = createUpdateProbeValueFunction(windowDefinition, offsetFn, offsetValue, offsetType);
         } else {
             updateStartProbeValue = (currentRow, x) -> x;
```

**File**: `server/src/test/java/io/crate/execution/engine/window/AggregationWindowFunctionsTest.java` (modified, +35/-0)
```diff
@@ -417,6 +417,41 @@ public void test_agg_over_range_desc_preceding_with_null_values() throws Throwab
         );
     }
 
+    @Test
+    public void test_agg_over_range_with_integral_boundary_overflow() throws Throwable {
+        assertEvaluate(
+            "count(*) OVER (ORDER BY x RANGE BETWEEN CURRENT ROW AND 1 FOLLOWING)",
+            new Object[] { 1L, 1L },
+            List.of(ColumnIdent.of("x")),
+            new Object[] { 0 },
+            new Object[] { Integer.MAX_VALUE }
+        );
+
+        assertEvaluate(
+            "count(*) OVER (ORDER BY x RANGE BETWEEN 1 PRECEDING AND CURRENT ROW)",
+            new Object[] { 1L, 1L },
+            List.of(ColumnIdent.of("x")),
+            new Object[] { Integer.MIN_VALUE },
+            new Object[] { 0 }
+        );
+
+        assertEvaluate(
+            "count(*) OVER (ORDER BY y RANGE BETWEEN CURRENT ROW AND 1 FOLLOWING)",
+            new Object[] { 1L, 1L },
+            List.of(ColumnIdent.of("y")),
+            new Object[] { 0L },
+            new Object[] { Long.MAX_VALUE }
+        );
+
+        assertEvaluate(
+            "count(*) OVER (ORDER BY y RANGE BETWEEN 1 PRECEDING AND CURRENT ROW)",
+            new Object[] { 1L, 1L },
+            List.of(ColumnIdent.of("y")),
+            new Object[] { Long.MIN_VALUE },
+            new Object[] { 0L }
+        );
+    }
+
     @Test
     public void test_agg_over_range_following() throws Throwable {
         Object[] expected = new Object[]{
```

---

### Incident Patch 8: `ee3151ff` (2026-09-16)
**Commit Message**: Fix RAM accounting in AccountableList when the list grows

**File**: `server/src/main/java/io/crate/collections/accountable/AccountableList.java` (modified, +14/-4)
```diff
@@ -166,18 +166,28 @@ private Object[] grow(int minCapacity) {
             int newCapacity = newLength(oldCapacity,
                 minCapacity - oldCapacity, /* minimum growth */
                 oldCapacity >> 1           /* preferred growth */);
-            // Same as RamUsageEstimator.shallowSizeOf(array) but without NUM_BYTES_ARRAY_HEADER as we are accounting only for expansion.
-            allocateBytes.accept(RamUsageEstimator.alignObjectSize((long) NUM_BYTES_OBJECT_REF * (newCapacity - oldCapacity)));
+            allocateBytes.accept(calculateAdditionalMem(newCapacity, oldCapacity));
             elementData = Arrays.copyOf(elementData, newCapacity);
         } else {
             int length = Math.max(DEFAULT_CAPACITY, minCapacity);
-            // Inlining RamUsageEstimator.shallowSizeOf(array) since we want to account before allocation.
-            allocateBytes.accept(RamUsageEstimator.alignObjectSize((long) NUM_BYTES_ARRAY_HEADER + (long) NUM_BYTES_OBJECT_REF * length));
+            allocateBytes.accept(shallowSizeOfArray(length));
             elementData = new Object[length];
         }
         return elementData;
     }
 
+    private static long calculateAdditionalMem(int newCapacity, int oldCapacity) {
+        // NB: Cannot be simplified as: alignObjectSize(OBJECT_REF * (newCapacity - oldCapacity)),
+        // because alignObjectSize() isn't an additive function.
+        // Example is: NUM_BYTES_ARRAY_HEADER = 16, NUM_BYTES_OBJECT_REF = 4, newCapacity = 22, oldCapacity = 15.
+        return shallowSizeOfArray(newCapacity) - shallowSizeOfArray(oldCapacity);
+    }
+
+    // Inlining RamUsageEstimator.shallowSizeOf(array) since we want to account before allocation.
+    private static long shallowSizeOfArray(int length) {
+        return RamUsageEstimator.alignObjectSize((long) NUM_BYTES_ARRAY_HEADER + (long) NUM_BYTES_OBJECT_REF * length);
+    }
+
     /**
      * Copy of ArraysSupport.newLength
      */
```

**File**: `server/src/test/java/io/crate/collections/accountable/AccountableListTest.java` (modified, +38/-4)
```diff
@@ -25,6 +25,7 @@
 
 import java.util.Comparator;
 import java.util.List;
+import java.util.stream.IntStream;
 
 import org.junit.Test;
 
@@ -42,17 +43,50 @@ public void test_list_accounts_for_shallow_size() throws Exception {
         for (int i = 0; i < length; i++) {
             list.add(i);
         }
-        assertThat(accounting.totalBytes()).isEqualTo(468L);
+        assertThat(accounting.totalBytes()).isEqualTo(460);
 
         List<Integer> subList = list.subList(10, 20);
-        assertThat(accounting.totalBytes()).isEqualTo(480L); // Sub list structures (pointer, offset and size).
+        assertThat(accounting.totalBytes()).isEqualTo(472); // Sub list structures (pointer, offset and size).
 
         // Temporal storage overhead on list sorting is not accounted for.
         list.sort(Comparator.comparingInt(x -> x));
-        assertThat(accounting.totalBytes()).isEqualTo(480L);
+        assertThat(accounting.totalBytes()).isEqualTo(472);
 
         // Temporal storage overhead on sub-list sorting is not accounted for.
         subList.sort(Comparator.comparingInt(x -> x));
-        assertThat(accounting.totalBytes()).isEqualTo(480L);
+        assertThat(accounting.totalBytes()).isEqualTo(472);
+    }
+
+    @Test
+    public void test_accounts_addAll() {
+        // list1 adds 15 elements one by one.
+        // list2 adds 15 elements in one go.
+        // 15 was chosen because that capacity is reached when the list grows,
+        // i.e. a list with the size of 15 also has the capacity of 15.
+        // Both lists should have the same capacity and same accounted memory.
+        PlainRamAccounting acct1 = new PlainRamAccounting();
+        AccountableList<Integer> list1 = new AccountableList<>(acct1::addBytes);
+        assertThat(acct1.totalBytes()).isEqualTo(4); // Size
+
+        int length = 15;
+        for (int i = 0; i < length; i++) {
+            list1.add(i);
+        }
+        // growth:
+        // initial: 4
+        // 1st growth, to 10 elements, array header 16 bytes + 10 elements * 4 bytes, aligned to 56, total = 60
+        // 2nd growth, to 15 elements, 16 + 15 * 4 = 76, aligned to 80, total = 84
+        assertThat(acct1.totalBytes()).isEqualTo(84);
+
+        // Add 15 elements at once. This makes the list's capacity grow to 15.
+        // The resulting AccountableLists should be the same, and use the same amount of memory.
+        PlainRamAccounting acct2 = new PlainRamAccounting();
+        AccountableList<Integer> list2 = new AccountableList<>(acct2::addBytes);
+        assertThat(acct2.totalBytes()).isEqualTo(4); // Size
+
+        list2.addAll(IntStream.range(0, length).boxed().toList());
+        assertThat(acct2.totalBytes()).isEqualTo(84);
+
+        assertThat(list1.equals(list2));
     }
 }
```

---

### Incident Patch 9: `4554890c` (2026-09-16)
**Commit Message**: Fix hashjoin for char(n) cols in join condition

With https://github.com/crate/crate/pull/19625 optimization,
the CharacterType->StringType->equalsSignature() prevents casting
between char(n) columns in a join condition like: `t1.c1 = t2.c2`,
where `t1.c1 is char(3)` and `t2.c2 is `char(5)`. As a consequence,
those if the join is executed with the HashJoin implementation,
for  values like `a` for both `c1` and `c2`, will produce different
hashes, becaue the values are actually `a  ` and `a    `, thus
those values will never reach the `CharacterType#valueEq` which would
return a match. The values for SQL are equal, and such join executed
with NestedLoop would match them.

Fix the issues by applying a cast during the creation of the hash
symbols.

Fixes: #20204

**File**: `docs/appendices/release-notes/6.4.5.rst` (modified, +6/-0)
```diff
@@ -102,3 +102,9 @@ Fixes
   if a column used in a query could not be resolved and multiple relations are
   involved. This could also lead to privileges being checked on the wrong
   relation while generating the error.
+
+- Fixed a regression introduced in :ref:`version_6.4.0` which caused a join,
+  executed with the hash join implementation, to not match rows when the join
+  condition used :ref:`CHAR(n) <data-type-character>` join keys of different
+  length but same value, because of the blank padding, which is applied to match
+  the defined ``n`` length.
```

**File**: `server/src/main/java/io/crate/planner/operators/HashJoin.java` (modified, +34/-1)
```diff
@@ -46,6 +46,7 @@
 import io.crate.execution.dsl.projection.EvalProjection;
 import io.crate.execution.dsl.projection.builder.InputColumns;
 import io.crate.execution.dsl.projection.builder.ProjectionBuilder;
+import io.crate.expression.scalar.cast.CastMode;
 import io.crate.expression.symbol.Symbol;
 import io.crate.expression.symbol.Symbols;
 import io.crate.metadata.RelationName;
@@ -57,6 +58,8 @@
 import io.crate.planner.distribution.DistributionType;
 import io.crate.planner.node.dql.join.Join;
 import io.crate.sql.tree.JoinType;
+import io.crate.types.DataType;
+import io.crate.types.TypeCompatibility;
 
 public class HashJoin extends AbstractJoinPlan {
 
@@ -312,7 +315,7 @@ static HashSymbols createHashSymbols(List<RelationName> lhsRelationNames,
                                          List<RelationName> rhsRelationNames,
                                          Symbol symbol) {
         /* It is important here to process the hashSymbols in order as there values are used for building the
-         *  hash codes. For example:
+         * hash codes. For example:
          *
          *      join-condition:     t1.a = t2.c AND t1.b = t2.d
          *      left hashSymbols:   [t1.a, t1.b]
@@ -340,9 +343,39 @@ static HashSymbols createHashSymbols(List<RelationName> lhsRelationNames,
             }
         }
         assert rhsHashSymbols.size() == lhsHashSymbols.size() : "Number of hash values for left and right hand side of a hash-join must be equal";
+        castToCommonType(lhsHashSymbols, rhsHashSymbols);
         return new HashSymbols(lhsHashSymbols, rhsHashSymbols);
     }
 
+    /**
+     * Casts both symbols of each hash symbol pair to their common type.
+     * <p>
+     * The hash codes are built from the values of these symbols, and the join condition is
+     * evaluated using {@link DataType#valueEq(Object, Object)}. For types which are parametrized the two
+     * can disagree, e.g.: `character(n)` values are padded to match the defined length, so "a" for a
+     * `char(2)` column, becomes "a ", and for a `char(3) becomes "a  ".
+     * Both values are equal under SQL semantics but their hash codes are not, so without normalizing the
+     * type pairs the rows can end up in different hash buckets, or even on different nodes if the join
+     * executes as modulo-distributed.
+     */
+    private static void castToCommonType(List<Symbol> lhsHashSymbols, List<Symbol> rhsHashSymbols) {
+        for (int i = 0; i < lhsHashSymbols.size(); i++) {
+            Symbol lhs = lhsHashSymbols.get(i);
+            Symbol rhs = rhsHashSymbols.get(i);
+            DataType<?> lhsType = lhs.valueType();
+            DataType<?> rhsType = rhs.valueType();
+            if (lhsType.id() != rhsType.id() || lhsType.equals(rhsType)) {
+                continue;
+            }
+            DataType<?> commonType = TypeCompatibility.getCommonType(lhsType, rhsType);
+            if (commonType == null) {
+                continue;
+            }
+            lhsHashSymbols.set(i, lhs.cast(commonType, CastMode.EXPLICIT));
+            rhsHashSymbols.set(i, rhs.cast(commonType, CastMode.EXPLICIT));
+        }
+    }
+
     record HashSymbols(List<Symbol> lhsHashSymbols, List<Symbol> rhsHashSymbols) { }
 
 }
```

**File**: `server/src/test/java/io/crate/planner/operators/HashJoinTest.java` (modified, +38/-0)
```diff
@@ -34,8 +34,10 @@
 import io.crate.expression.symbol.Symbol;
 import io.crate.metadata.RelationName;
 import io.crate.test.integration.CrateDummyClusterServiceUnitTest;
+import io.crate.testing.SQLExecutor;
 import io.crate.testing.SqlExpressions;
 import io.crate.testing.T3;
+import io.crate.types.CharacterType;
 
 public class HashJoinTest extends CrateDummyClusterServiceUnitTest {
 
@@ -90,4 +92,40 @@ public void test_create_lsh_rhs_hash_symbols_from_three_eq_conditions() {
         assertThat(result.rhsHashSymbols()).satisfiesExactly(isSQL("doc.t3.c"), isSQL("doc.t2.b"), isSQL("doc.t2.i"));
 
     }
+
+    @Test
+    public void test_hash_symbols_of_both_sides_are_paired_by_position() {
+        Symbol joinCondition = sqlExpressions.asSymbol("t1.a = t3.c AND t2.i = t5.i AND t1.i = t5.i");
+        var result = HashJoin.createHashSymbols(
+            List.of(T3.T1, T3.T2),
+            List.of(T3.T3, T3.T5),
+            joinCondition);
+
+        assertThat(result.lhsHashSymbols()).satisfiesExactly(
+            isSQL("doc.t1.a"), isSQL("doc.t2.i"), isSQL("doc.t1.i"));
+        assertThat(result.rhsHashSymbols()).satisfiesExactly(
+            isSQL("doc.t3.c"), isSQL("doc.t5.i"), isSQL("doc.t5.i"));
+    }
+
+    @Test
+    public void test_hash_symbols_of_character_columns_are_normalized_to_a_common_type() throws Exception {
+        SQLExecutor e = SQLExecutor.of(clusterService)
+            .addTable("create table tbl1 (a int, c1 char(2))")
+            .addTable("create table tbl2 (b int, c2 char(3))");
+
+        Symbol joinCondition = e.asSymbol("tbl1.c1 = tbl2.c2");
+        var result = HashJoin.createHashSymbols(
+            List.of(new RelationName("doc", "tbl1")),
+            List.of(new RelationName("doc", "tbl2")),
+            joinCondition);
+
+        // character(n) values are blank padded to their declared length, so hashing them by value
+        // can only find a match if both sides of a pair are normalized to the same length.
+        assertThat(result.lhsHashSymbols()).zipSatisfy(
+            result.rhsHashSymbols(),
+            (lhs, rhs) -> {
+                assertThat(lhs.valueType()).isEqualTo(CharacterType.of(3));
+                assertThat(rhs.valueType()).isEqualTo(CharacterType.of(3));
+            });
+    }
 }
```

---

### Incident Patch 10: `ed3b79a8` (2026-09-15)
**Commit Message**: Fix shadowing of CTE relations by tables/views

The regression was introduced by: #20147. To be able
to resolve columns first by looking into the CTE defined tables,
add another structure `withTree`, which is populated in the
`RelationAnalyze#visitWithQuery` and try to resolve the column
using this new structure, and then fallback to the `sourcesTree`.

**File**: `server/src/main/java/io/crate/analyze/relations/ParentRelations.java` (modified, +25/-17)
```diff
@@ -35,52 +35,60 @@ public class ParentRelations {
     public static final ParentRelations NO_PARENTS = new ParentRelations();
 
     private final List<Map<RelationName, AnalyzedRelation>> sourcesTree;
+    private final List<Map<RelationName, AnalyzedRelation>> withTree;
 
     private ParentRelations() {
         sourcesTree = Collections.emptyList();
+        withTree = Collections.emptyList();
     }
 
-    private ParentRelations(ArrayList<Map<RelationName, AnalyzedRelation>> sourcesTree) {
+    private ParentRelations(ArrayList<Map<RelationName, AnalyzedRelation>> sourcesTree,
+                            ArrayList<Map<RelationName, AnalyzedRelation>> withTree) {
         this.sourcesTree = sourcesTree;
+        this.withTree = withTree;
     }
 
-    public ParentRelations newLevel(Map<RelationName, AnalyzedRelation> sources) {
+    public ParentRelations newLevel(Map<RelationName, AnalyzedRelation> sources,
+                                    Map<RelationName, AnalyzedRelation> withRelations) {
         ArrayList<Map<RelationName, AnalyzedRelation>> newSourcesTree = new ArrayList<>(sourcesTree.size() + 1);
         newSourcesTree.addAll(sourcesTree);
         newSourcesTree.add(sources);
-        return new ParentRelations(newSourcesTree);
+        ArrayList<Map<RelationName, AnalyzedRelation>> newWithTree = new ArrayList<>(withTree.size() + 1);
+        newWithTree.addAll(withTree);
+        newWithTree.add(withRelations);
+        return new ParentRelations(newSourcesTree, newWithTree);
     }
 
     public boolean containsRelation(RelationName qualifiedName) {
         return getAncestor(qualifiedName) != null;
     }
 
-    @Nullable
-    public AnalyzedRelation getParent(RelationName relationName) {
-        if (sourcesTree.isEmpty() || sourcesTree.size() < 2) {
-            return null;
-        }
-        // the last item is the _current_ relation, need one before that for the immediate parent
-        Map<RelationName, AnalyzedRelation> parent = sourcesTree.get(sourcesTree.size() - 2);
-        return parent.get(relationName);
-    }
-
     public Iterable<AnalyzedRelation> getParents() {
         if (sourcesTree.isEmpty() || sourcesTree.size() < 2) {
             return Collections.emptyList();
         }
         return sourcesTree.get(sourcesTree.size() - 2).values();
     }
 
+    @Nullable
+    public AnalyzedRelation getAncestorWithQuery(RelationName relationName) {
+        for (int i = withTree.size() - 1; i >= 0; i--) {
+            AnalyzedRelation relation = withTree.get(i).get(relationName);
+            if (relation != null) {
+                return relation;
+            }
+        }
+        return null;
+    }
+
     @Nullable
     public AnalyzedRelation getAncestor(RelationName relationName) {
-        AnalyzedRelation relation = null;
         for (int i = sourcesTree.size() - 1; i >= 0; i--) {
-            relation = sourcesTree.get(i).get(relationName);
+            AnalyzedRelation relation = sourcesTree.get(i).get(relationName);
             if (relation != null) {
-                break;
+                return relation;
             }
         }
-        return relation;
+        return null;
     }
 }
```

**File**: `server/src/main/java/io/crate/analyze/relations/RelationAnalysisContext.java` (modified, +13/-0)
```diff
@@ -37,6 +37,7 @@ public class RelationAnalysisContext {
     // keep order of sources.
     //  e.g. something like:  select * from t1, t2 must not become select t2.*, t1.*
     private final Map<RelationName, AnalyzedRelation> sources = new LinkedHashMap<>();
+    private final Map<RelationName, AnalyzedRelation> withQueries = new LinkedHashMap<>();
 
     RelationAnalysisContext(boolean aliasedRelation,
                             ParentRelations parents,
@@ -54,6 +55,10 @@ public Map<RelationName, AnalyzedRelation> sources() {
         return sources;
     }
 
+    public Map<RelationName, AnalyzedRelation> withQueries() {
+        return withQueries;
+    }
+
     void addSourceRelation(AnalyzedRelation relation) {
         RelationName relationName = relation.relationName();
         if (sources.put(relationName, relation) != null) {
@@ -62,6 +67,14 @@ void addSourceRelation(AnalyzedRelation relation) {
         }
     }
 
+    void addWithRelation(AnalyzedRelation relation) {
+        RelationName relationName = relation.relationName();
+        if (withQueries.put(relationName, relation) != null) {
+            String errorMessage = String.format(Locale.ENGLISH, "WITH query name \"%s\" specified more than once", relationName);
+            throw new IllegalArgumentException(errorMessage);
+        }
+    }
+
     public ExpressionAnalysisContext expressionAnalysisContext() {
         return expressionAnalysisContext;
     }
```

**File**: `server/src/main/java/io/crate/analyze/relations/RelationAnalyzer.java` (modified, +10/-14)
```diff
@@ -677,7 +677,7 @@ public AnalyzedRelation visitWithQuery(WithQuery node, StatementAnalysisContext
             new RelationName(null, node.name()),
             node.columnNames()
         );
-        context.currentRelationContext().addSourceRelation(aliasedRelation);
+        context.currentRelationContext().addWithRelation(aliasedRelation);
         return aliasedRelation;
     }
 
@@ -687,20 +687,16 @@ protected AnalyzedRelation visitTable(Table<?> node, StatementAnalysisContext co
         SearchPath searchPath = context.sessionSettings().searchPath();
         var relationContext = context.currentRelationContext();
 
-        RelationInfo relationInfo;
-        try {
-            relationInfo = nodeCtx.schemas().findRelation(
-                tableQualifiedName, context.currentOperation(), context.sessionSettings().sessionUser(), searchPath);
-        } catch (Throwable t) {
-            AnalyzedRelation ancestor = relationContext.parentSources()
-                .getAncestor(RelationName.of(tableQualifiedName, null));
-            if (ancestor == null) {
-                throw t;
-            }
-            relationContext.addSourceRelation(ancestor);
-            return ancestor;
+        AnalyzedRelation relation = relationContext.parentSources()
+            .getAncestorWithQuery(RelationName.of(tableQualifiedName, null));
+        if (relation != null) {
+            relationContext.addSourceRelation(relation);
+            return relation;
         }
-        AnalyzedRelation relation = switch (relationInfo) {
+        RelationInfo relationInfo = nodeCtx.schemas().findRelation(
+            tableQualifiedName, context.currentOperation(), context.sessionSettings().sessionUser(), searchPath);
+
+        relation = switch (relationInfo) {
             case DocTableInfo docTable -> new DocTableRelation(docTable);
             case RelationMetadata.ForeignTable table -> new ForeignTableRelation(table);
             case TableInfo table -> new TableRelation(table);
```

**File**: `server/src/main/java/io/crate/analyze/relations/StatementAnalysisContext.java` (modified, +1/-1)
```diff
@@ -73,7 +73,7 @@ RelationAnalysisContext startRelation(boolean aliasedRelation) {
             parentRelations = ParentRelations.NO_PARENTS;
         } else {
             RelationAnalysisContext parentCtx = lastRelationContextQueue.get(lastRelationContextQueue.size() - 1);
-            parentRelations = parentCtx.parentSources().newLevel(parentCtx.sources());
+            parentRelations = parentCtx.parentSources().newLevel(parentCtx.sources(), parentCtx.withQueries());
         }
         RelationAnalysisContext currentRelationContext =
             new RelationAnalysisContext(aliasedRelation, parentRelations, sessionSettings());
```

**File**: `server/src/test/java/io/crate/analyze/relations/RelationAnalyzerTest.java` (modified, +65/-0)
```diff
@@ -22,8 +22,10 @@
 package io.crate.analyze.relations;
 
 import static io.crate.testing.Asserts.assertThat;
+import static io.crate.testing.Asserts.isField;
 import static io.crate.testing.Asserts.isFunction;
 import static io.crate.testing.Asserts.isLiteral;
+import static io.crate.testing.Asserts.isReference;
 import static org.assertj.core.api.Assertions.assertThatThrownBy;
 
 import java.io.IOException;
@@ -35,8 +37,10 @@
 
 import io.crate.analyze.ParamTypeHints;
 import io.crate.analyze.QueriedSelectRelation;
+import io.crate.exceptions.RelationUnknown;
 import io.crate.exceptions.RelationValidationException;
 import io.crate.expression.scalar.SubscriptFunction;
+import io.crate.expression.symbol.SelectSymbol;
 import io.crate.expression.symbol.Symbol;
 import io.crate.expression.tablefunctions.ValuesFunction;
 import io.crate.metadata.RelationName;
@@ -166,4 +170,65 @@ public void test_resolve_relations_by_going_through_each_search_path_at_a_time()
         assertThat(relation.from()).hasSize(1);
         assertThat(relation.from().getFirst()).isInstanceOf(AnalyzedView.class);
     }
+
+    @Test
+    public void test_with_query_takes_precedence_over_tables_and_views_with_same_name() throws IOException {
+        var executor = SQLExecutor.of(clusterService)
+            .addTable("create table tbl (k int, other int)")
+            .addView(new RelationName("doc", "v"), "select 1 as x");
+
+        QueriedSelectRelation relation = executor.analyze(
+            "WITH tbl(a, b) AS (VALUES (1, 100)) SELECT tbl.b FROM tbl");
+        assertThat(relation.from().getFirst()).isExactlyInstanceOf(AliasedAnalyzedRelation.class);
+        assertThat(relation.outputs()).satisfiesExactly(isField("b", new RelationName(null, "tbl")));
+
+        relation = executor.analyze(
+            "WITH v(c) AS (VALUES (100)) SELECT v.c FROM v");
+        assertThat(relation.from().getFirst()).isExactlyInstanceOf(AliasedAnalyzedRelation.class);
+        assertThat(relation.outputs()).satisfiesExactly(isField("c", new RelationName(null, "v")));
+    }
+
+    @Test
+    public void test_schema_qualified_name_resolves_to_table_and_not_to_with_query() throws IOException {
+        var executor = SQLExecutor.of(clusterService)
+            .addTable("create table tbl (a int, b int)");
+
+        QueriedSelectRelation relation = executor.analyze(
+            "WITH tbl (a, b) AS (VALUES (1, 100)) SELECT tbl.b FROM doc.tbl");
+        assertThat(relation.from().getFirst().relationName()).isEqualTo(new RelationName("doc", "tbl"));
+        assertThat(relation.outputs()).satisfiesExactly(isReference("b"));
+    }
+
+    @Test
+    public void test_with_query_is_visible_within_nested_subqueries() {
+        QueriedSelectRelation relation = executor.analyze(
+            "WITH tbl AS (SELECT 1 AS x) SELECT (SELECT max(x) FROM tbl) FROM t1");
+        assertThat(relation.outputs()).satisfiesExactly(
+            s -> assertThat(s).isExactlyInstanceOf(SelectSymbol.class));
+    }
+
+    @Test
+    public void test_correlated_subquery_resolves_parent_column_if_statement_has_with_queries() {
+        QueriedSelectRelation relation = executor.analyze(
+            "WITH c AS (SELECT 1 AS x) " +
+            "SELECT t1.a, (SELECT count(*) FROM t2 WHERE t2.b = t1.a) FROM t1");
+        assertThat(relation.outputs()).satisfiesExactly(
+            isReference("a"),
+            s -> assertThat(s).isExactlyInstanceOf(SelectSymbol.class)
+        );
+    }
+
+    @Test
+    public void test_columns_of_with_query_are_not_accessible_without_using_it_in_from() {
+        assertThatThrownBy(() -> executor.analyze("WITH tbl AS (SELECT 1 AS x) SELECT tbl.x FROM t1"))
+            .isExactlyInstanceOf(RelationUnknown.class)
+            .hasMessage("Relation 'doc.tbl' unknown");
+    }
+
+    @Test
+    public void test_duplicate_with_query_names_are_rejected() {
+        assertThatThrownBy(() -> executor.analyze("WITH tbl AS (SELECT 1), tbl AS (SELECT 2) SELECT * FROM 
```

#### Recent Merged Pull Requests:
- **PR #20301** (2026-09-30): Fix HTTP session running as the wrong user (@matriv)
- **PR #20299** (2026-09-29): Avoid creating nested proxy connections in sniff remote client (backport #20292) (@mergify[bot])
- **PR #20298** (2026-09-30): Add NumberType interface; reduce scattered concrete type checks (@mfussenegger)
- **PR #20297** (2026-09-29): Synchronize QueryProfiler#pollLast (backport #20296) (@mergify[bot])
- **PR #20296** (2026-09-29): Synchronize QueryProfiler#pollLast (@hariso)
- **PR #20295** (closed): Use add/subtract scalars for window function frame boundary calculation (@mfussenegger)
- **PR #20294** (2026-09-29): Fix rounding error on casts to date of values < 1970 (backport #20290) (@mergify[bot])
- **PR #20293** (closed): Fix SQL admission during node decommissioning (@somiljain2006)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
