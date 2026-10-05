# Forensic Learning Record (Deep Inspection): crate/crate

> **Canonical Artifact**: `07_PROJECT_LEARNING/crate-crate-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/crate/crate](https://github.com/crate/crate))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:10:45.951Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `crate/crate`
- **Description**: CrateDB is a distributed and scalable SQL database for storing and analyzing massive amounts of data in near real-time, even with complex queries. It is PostgreSQL-compatible, and based on Lucene.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: N/A
- **Stars / Engagement**: 4443 stars

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
- **Issue #20317** (2026-10-02): **`pg_publications` does not show all publications for superuser**
  *Symptoms*: ### CrateDB version  6.4.5  ### CrateDB setup information  Single Docker container  ### Problem description  [pg_publication](https://cratedb.com/docs/crate/reference/en/latest/admin/system-information.html#pg-publication) is not documented to have any particular behaviour in regards to visibility of its rows. I would therefore expect that publications are generally visible to users with `DQL` on `pg_catalog.pg_publication`.  However, users appear to only be able to see their own publications. And more importantly, not even the superuser is able to see all of them.  ### Steps to Reproduce  ```sql CREATE TABLE demo (   a INTEGER );  CREATE USER lr_test WITH (password = 'secret'); GRANT ALL TO lr_test; ```  Log in as `lr_test`(`crash --host http://localhost:4200 --user lr_test`): ```sql cr> SELECT CURRENT_USER; +--------------+ | current_user | +--------------+ | lr_test      | +--------------+ SELECT 1 row in set (0.006 sec) cr> CREATE PUBLICATION pub_demo FOR TABLE doc.demo; CREATE OK, 1 row affected (0.023 sec) cr> SELECT * FROM pg_catalog.pg_publication; +-----------+--------------+-----------+-----------+----------+-----------+-----------+ |       oid | puballtables | pubdelete | pubinsert | pubname  |  pubowner | pubupdate | +-----------+--------------+-----------+-----------+----------+-----------+-----------+ | 316895192 | FALSE        | TRUE      | TRUE      | pub_demo | -22308139 | TRUE      | +-----------+--------------+-----------+-----------+----------+-----------+
  **Post-Mortem & Fix Analysis**:
  > thx @hammerhead for reporting this, it will be fixed with 6.4.6 release

- **Issue #20310** (2026-10-02): **WHERE distance(...) >= ... includes rows with a NULL GEO_POINT**
  *Symptoms*: ### CrateDB version  6.4.2, 6.4.3, 6.4.5  ### CrateDB setup information   Number of nodes: 1 CRATE_HEAP_SIZE: 512m CRATE_JAVA_OPTS: None  crate.yml contents: default  ### Problem description  When a row has a NULL `GEO_POINT`, `distance(p, 'POINT (0 0)'::GEO_POINT)` and its comparison with a positive threshold evaluate to SQL NULL. A bare positive-distance range predicate nevertheless retains that row in the result. Explicitly requiring the comparison to be TRUE excludes the NULL row.  On CrateDB 6.4.5, a three-row control containing a NULL point, a point at the origin, and a point outside the 120000-meter radius showed that the bare `>` filter returned the NULL and outside rows. The explicit `IS TRUE` and `p IS NOT NULL` controls returned only the outside row, while the inside-point control behaved as expected.  ### Steps to Reproduce  Run the following statements in a fresh database/schema:  ```sql CREATE TABLE t(id INTEGER PRIMARY KEY, p GEO_POINT) WITH (number_of_replicas = 0); INSERT INTO t(id,p) VALUES (9,NULL); REFRESH TABLE t; SELECT id,p,distance(p,'POINT (0 0)'::GEO_POINT) AS d,distance(p,'POINT (0 0)'::GEO_POINT)>=120000 AS ge FROM t; SELECT id FROM t WHERE distance(p,'POINT (0 0)'::GEO_POINT)>=120000; SELECT id FROM t WHERE (distance(p,'POINT (0 0)'::GEO_POINT)>=120000) IS TRUE; ```  For the additional 6.4.5 control, use a fresh table and these rows:  ```sql CREATE TABLE t(id INTEGER PRIMARY KEY, p GEO_POINT) WITH (number_of_replicas = 0); INSERT INTO t(id,p) VALU
  **Post-Mortem & Fix Analysis**:
  > thx for the report @Explorer-Dong! The issue has been fixed and the fix will be available with 6.4.6 release 

- **Issue #20309** (2026-10-02): **WHERE distance(...) IS NULL or IS NOT NULL returns HTTP 500**
  *Symptoms*: ### CrateDB version  6.4.2, 6.4.3, 6.4.5  ### CrateDB setup information   Number of nodes: 1 CRATE_HEAP_SIZE: 512m CRATE_JAVA_OPTS: None  crate.yml contents: default  ### Problem description  Filtering on `distance(p, origin) IS NULL` fails with an HTTP 500 instead of completing and returning rows for which the distance expression is NULL. The response contains `IndexOutOfBoundsException[Index: 1 Size: 1]` (error code 5000). On 6.4.5, the corresponding `IS NOT NULL` filter also fails with the same exception. The failure occurs with a NULL point, a non-NULL point, and an empty table.  ### Steps to Reproduce  Run the following statements in a fresh database/schema on CrateDB 6.4.2, 6.4.3, or 6.4.5:  ```sql CREATE TABLE t(id INTEGER PRIMARY KEY, p GEO_POINT) WITH (number_of_replicas = 0); INSERT INTO t(id,p) VALUES (9,NULL); REFRESH TABLE t; SELECT id FROM t WHERE distance(p,'POINT (0 0)'::GEO_POINT) IS NULL; ```  On 6.4.5, the same error also occurs for `IS NULL` after replacing the NULL with a non-NULL point, and on an empty table. `IS NOT NULL` fails on each of those states as well:  ```sql UPDATE t SET p='POINT (2 0)'::GEO_POINT WHERE id=9; REFRESH TABLE t; SELECT id FROM t WHERE distance(p,'POINT (0 0)'::GEO_POINT) IS NULL; SELECT id FROM t WHERE distance(p,'POINT (0 0)'::GEO_POINT) IS NOT NULL; DELETE FROM t WHERE id=9; REFRESH TABLE t; SELECT id FROM t WHERE distance(p,'POINT (0 0)'::GEO_POINT) IS NULL; SELECT id FROM t WHERE distance(p,'POINT (0 0)'::GEO_POINT) IS NOT NU
  **Post-Mortem & Fix Analysis**:
  > thx for the report @Explorer-Dong! The issue has been fixed and the fix will be available with 6.4.6 release 

- **Issue #20308** (2026-10-02): **WHERE distance(...) >= ... includes a NULL GEO_POINT row; distance(...) IS NULL returns HTTP 500**
  *Symptoms*: ### CrateDB version  6.4.2, 6.4.3, 6.4.5  ### CrateDB setup information   Number of nodes: 1 CRATE_HEAP_SIZE: 512m CRATE_JAVA_OPTS: None  crate.yml contents: default  ### Problem description  For a row whose GEO_POINT value is SQL NULL, projecting distance(p, 'POINT (0 0)'::GEO_POINT) and comparing that result with >= 120000 both return SQL NULL. However, the same comparison in a bare WHERE clause returns the row. Adding IS TRUE to the comparison excludes it, as expected for an UNKNOWN predicate.  With the same one-row table, WHERE distance(p, 'POINT (0 0)'::GEO_POINT) IS NULL instead fails with HTTP 500 and IndexOutOfBoundsException[Index: 1 Size: 1] (error code 5000). These are two observed symptoms under one trigger; this report does not assume they have the same root cause.  ### Steps to Reproduce  Run the following statements in a fresh database/schema on any of the versions above:  ```sql CREATE TABLE t(id INTEGER PRIMARY KEY, p GEO_POINT) WITH (number_of_replicas = 0); INSERT INTO t(id,p) VALUES (9,NULL); REFRESH TABLE t; SELECT id,p,distance(p,'POINT (0 0)'::GEO_POINT) AS d,distance(p,'POINT (0 0)'::GEO_POINT)>=120000 AS ge FROM t; SELECT id FROM t WHERE distance(p,'POINT (0 0)'::GEO_POINT)>=120000; SELECT id FROM t WHERE (distance(p,'POINT (0 0)'::GEO_POINT)>=120000) IS TRUE; SELECT id FROM t WHERE distance(p,'POINT (0 0)'::GEO_POINT) IS NULL; ```  ### Actual Result  The projection query returns one row with all expression values NULL:  ``` id=9, p=NULL, d=NULL, ge=N
  **Post-Mortem & Fix Analysis**:
  > thx for the report @Explorer-Dong! The issue has been fixed and the fix will be available with 6.4.6 release 

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

### Incident Patch 1: `02e25917` (2026-10-05)
**Commit Message**: Fix terms query generation for = ANY (...) on (large) NUMERIC

**File**: `docs/appendices/release-notes/6.4.6.rst` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ Fixes
 =====
 
 - Fixed an issue that could cause ``= ANY (...)`` or ``IN (...)`` expressions to
-  fail on columns of type ``UUID``.
+  fail on columns of type ``UUID`` or ``NUMERIC``.
 
 - Fixed a rounding error if casting timestamp or long values before 1970-01-01
   to ``date``.
```

**File**: `server/src/main/java/io/crate/types/NumericEqQuery.java` (modified, +8/-4)
```diff
@@ -269,9 +269,13 @@ public Query termsQuery(String field,
     }
 
     private static List<BigDecimal> filterOutOfBoundsAndSetScale(List<BigDecimal> values, int scale) {
-        return values.stream().map(val -> {
-            var scaledDown = val.setScale(scale, RoundingMode.DOWN);
-            return scaledDown.compareTo(val) == 0 ? scaledDown : null;
-        }).filter(Objects::nonNull).toList();
+        return values.stream()
+            .map(val -> {
+                var scaledDown = val.setScale(scale, RoundingMode.DOWN);
+                return scaledDown.compareTo(val) == 0 ? scaledDown : null;
+            })
+            .filter(Objects::nonNull)
+            .sorted()
+            .toList();
     }
 }
```

**File**: `server/src/test/java/io/crate/lucene/CommonQueryBuilderTest.java` (modified, +18/-5)
```diff
@@ -29,7 +29,7 @@
 import java.util.Arrays;
 import java.util.List;
 import java.util.Map;
-import java.util.UUID;
+import java.util.function.Supplier;
 
 import org.apache.lucene.document.ShapeField;
 import org.apache.lucene.search.BooleanClause;
@@ -1114,15 +1114,28 @@ public void test_char_comparisons_involving_whitespaces() throws Exception {
     }
 
     @Test
-    public void test_any_on_uuid() throws Exception {
+    public void test_any_is_value_order_independent() throws Exception {
+        for (DataType<?> type : DataTypeTesting.getStorableTypesExceptArrays(random())) {
+            if (type.equals(DataTypes.GEO_POINT) || type.id() == ObjectType.ID) {
+                // - point doc-value storage changes/looses precision and would fail the assertion
+                // - object type is inner type dependent
+                continue;
+            }
+            assert_any_is_value_order_independent(type);
+        }
+    }
+
+    private <T> void assert_any_is_value_order_independent(DataType<T> type) throws Exception {
+        Supplier<T> dataGenerator = DataTypeTesting.getDataGenerator(type);
+        T val1 = dataGenerator.get();
+        T val2 = dataGenerator.get();
+        String typeDefinition = SqlFormatter.formatSql(type.toColumnType(null));
         QueryTester.Builder builder = new QueryTester.Builder(
             THREAD_POOL,
             clusterService,
             Version.CURRENT,
-            "create table tbl (x uuid)");
+            "create table tbl (x " + typeDefinition + ")");
 
-        UUID val1 = UUID.fromString("5f0b6b4e-6d2a-4a55-9b0e-1c9a3f2d7e41");
-        UUID val2 = UUID.fromString("0c1a1f6e-8b55-4f0a-9d3e-2b6c7a8e9f10");
         builder.indexValues("x", val1);
         builder.indexValues("x", val2);
         try (QueryTester tester = builder.build()) {
```

---

### Incident Patch 2: `e62c4f24` (2026-10-05)
**Commit Message**: Fix terms query generation for = ANY(...) on UUID

Relates to https://github.com/crate/crate/issues/20319

**File**: `docs/appendices/release-notes/6.4.6.rst` (modified, +3/-0)
```diff
@@ -46,6 +46,9 @@ series.
 Fixes
 =====
 
+- Fixed an issue that could cause ``= ANY (...)`` or ``IN (...)`` expressions to
+  fail on columns of type ``UUID``.
+
 - Fixed a rounding error if casting timestamp or long values before 1970-01-01
   to ``date``.
 
```

**File**: `server/src/main/java/io/crate/types/UUIDType.java` (modified, +2/-0)
```diff
@@ -22,6 +22,7 @@
 package io.crate.types;
 
 import java.io.IOException;
+import java.util.Collections;
 import java.util.List;
 import java.util.UUID;
 import java.util.function.Function;
@@ -247,6 +248,7 @@ public Query termsQuery(String field,
             if (!isIndexed) {
                 return null;
             }
+            Collections.sort(nonNullValues);
             PointInSetQuery.Stream stream = new PointInSetQuery.Stream() {
 
                 int idx = 0;
```

**File**: `server/src/test/java/io/crate/integrationtests/AnyIntegrationTest.java` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@
 package io.crate.integrationtests;
 
 import static io.crate.testing.Asserts.assertThat;
+import static org.assertj.core.api.Assertions.assertThat;
 
 import org.elasticsearch.test.IntegTestCase;
 import org.junit.Test;
```

**File**: `server/src/test/java/io/crate/lucene/CommonQueryBuilderTest.java` (modified, +22/-0)
```diff
@@ -29,6 +29,7 @@
 import java.util.Arrays;
 import java.util.List;
 import java.util.Map;
+import java.util.UUID;
 
 import org.apache.lucene.document.ShapeField;
 import org.apache.lucene.search.BooleanClause;
@@ -1111,4 +1112,25 @@ public void test_char_comparisons_involving_whitespaces() throws Exception {
             assertThat(tester.runQuery("a", "a = e'\na'")).containsExactly("\na ");
         }
     }
+
+    @Test
+    public void test_any_on_uuid() throws Exception {
+        QueryTester.Builder builder = new QueryTester.Builder(
+            THREAD_POOL,
+            clusterService,
+            Version.CURRENT,
+            "create table tbl (x uuid)");
+
+        UUID val1 = UUID.fromString("5f0b6b4e-6d2a-4a55-9b0e-1c9a3f2d7e41");
+        UUID val2 = UUID.fromString("0c1a1f6e-8b55-4f0a-9d3e-2b6c7a8e9f10");
+        builder.indexValues("x", val1);
+        builder.indexValues("x", val2);
+        try (QueryTester tester = builder.build()) {
+            assertThat(tester.runQuery("x", "x = any([?, ?])", val1, val2))
+                .containsExactlyInAnyOrder(val1, val2);
+
+            assertThat(tester.runQuery("x", "x = any([?, ?])", val2, val1))
+                .containsExactlyInAnyOrder(val1, val2);
+        }
+    }
 }
```

---

### Incident Patch 3: `acc50845` (2026-10-05)
**Commit Message**: Extend type storage test with null value & ordering assertion

To help catch issues with null sentinels

**File**: `server/src/test/java/io/crate/integrationtests/TransportSQLActionTest.java` (modified, +20/-3)
```diff
@@ -1905,10 +1905,13 @@ public void test_types_with_storage_can_be_inserted_and_queried() {
             }
             Supplier<?> dataGenerator = DataTypeTesting.getDataGenerator(type);
             Object val1 = dataGenerator.get();
+            Object val2 = dataGenerator.get();
             var extendedType = DataTypeTesting.extendedType(type, val1);
             String typeDefinition = SqlFormatter.formatSql(extendedType.toColumnType(null));
             execute("create table tbl (id int primary key, x " + typeDefinition + ")");
             execute("insert into tbl (id, x) values (?, ?)", new Object[] { 1, val1 });
+            execute("insert into tbl (id, x) values (?, ?)", new Object[] { 2, val2 });
+            execute("insert into tbl (id, x) values (?, ?)", new Object[] { 3, null });
             execute("refresh table tbl");
 
             var resp1 = execute("select _doc['x'], x, _raw FROM tbl where x = ?", new Object[] { val1 });
@@ -1924,6 +1927,7 @@ public void test_types_with_storage_can_be_inserted_and_queried() {
             if (DataTypes.BYTE.equals(type)) {
                 type = DataTypes.SHORT;
                 val1 = ((Byte) val1).shortValue();
+                val2 = ((Byte) val2).shortValue();
             }
 
             if (!hasPrecisionChange) {
@@ -1938,10 +1942,23 @@ public void test_types_with_storage_can_be_inserted_and_queried() {
 
             if (type.sortSupport() != DataType.Sort.NONE) {
                 // should use doc-values/query-without-fetch execution path due to order + limit
-                var resp3 = execute("select _doc['x'], x, _raw FROM tbl order by x limit 1");
-                assertThat(resp3.rows()[0])
+                var resp3 = execute("select _doc['x'], x, _raw FROM tbl order by x limit 3");
+                List<Object> values = Arrays.stream(resp3.rows())
+                    .map(row -> row[0])
+                    .toList();
+
+                Object fstValue;
+                Object sndValue;
+                if (((DataType<Object>) type).compare(val1, val2) <= 0) {
+                    fstValue = val1;
+                    sndValue = val2;
+                } else {
+                    fstValue = val2;
+                    sndValue = val1;
+                }
+                assertThat(values)
                     .as("output of query with order and limit must match output of query without" + type)
-                    .contains(resp1.rows()[0]);
+                    .containsExactly(fstValue, sndValue, null);
             }
 
             execute("drop table tbl");
```

---

### Incident Patch 4: `3f0dc55b` (2026-10-02)
**Commit Message**: Fix distance() filters on NULL geo points

 - `distance(p, ...) > x` and `>= x` convert into a Lucene query that
   negates the "within distance" query, which also matches documents
   without a point. `>= 0` used a match-all query with the same effect.
   Add a `FieldExistsQuery` for both cases to exclude `NULL`s.

 - `distance(p, ...) IS NULL` failed with an `IndexOutOfBoundsException`,
   as the outer function was expecting to always have two arguments.
   Since `distance` is `NULL` only if one of its arguments is `NULL`, use
   the same query as for `p IS NULL` instead.

 - `distance(p, NULL) > x` failed with a `NullPointerException`, as the
   `NULL` point was passed to the Lucene distance query. Use a generic
   function filter if the point literal is `NULL`.

Fixes: #20308
Fixes: #20309
Fixes: #20310

**File**: `docs/appendices/release-notes/6.4.6.rst` (modified, +9/-0)
```diff
@@ -96,3 +96,12 @@ Fixes
   show the publications owned by the current user, even for superusers and
   users with the :ref:`AL <privilege_types_al>` privilege. Superusers and users
   with ``AL`` can now see all publications.
+
+- Fixed an issue that caused a ``>`` or ``>=`` comparison on the
+  :ref:`distance <scalar-distance>` function in a ``WHERE`` clause, e.g.
+  ``WHERE distance(p, 'POINT (0 0)') > 100``, to also match rows where the
+  :ref:`GEO_POINT <data-types-geo-point>` column ``p`` is ``NULL``.
+
+- Fixed an issue that caused ``WHERE distance(p, ...) IS NULL`` to fail with an
+  ``IndexOutOfBoundsException``, and comparisons like
+  ``WHERE distance(p, NULL) > 100`` to fail with a ``NullPointerException``.
```

**File**: `server/src/main/java/io/crate/expression/predicate/IsNullPredicate.java` (modified, +10/-5)
```diff
@@ -109,15 +109,20 @@ public Query toQuery(Function function, Context context) {
         List<Symbol> arguments = function.arguments();
         assert arguments.size() == 1 : "`<expression> IS NULL` function must have one argument";
         if (arguments.get(0) instanceof Reference ref) {
-            if (!ref.isNullable()) {
-                return new MatchNoDocsQuery("`x IS NULL` on column that is NOT NULL can't match");
-            }
-            Query refExistsQuery = refExistsQuery(ref, context);
-            return refExistsQuery == null ? null : Queries.not(refExistsQuery);
+            return refIsNullQuery(ref, context);
         }
         return null;
     }
 
+    @Nullable
+    public static Query refIsNullQuery(Reference ref, Context context) {
+        if (!ref.isNullable()) {
+            return new MatchNoDocsQuery("`x IS NULL` on column that is NOT NULL can't match");
+        }
+        Query refExistsQuery = refExistsQuery(ref, context);
+        return refExistsQuery == null ? null : Queries.not(refExistsQuery);
+    }
+
 
     @Nullable
     public static Query refExistsQuery(Reference ref, Context context) {
```

**File**: `server/src/main/java/io/crate/expression/scalar/geo/DistanceFunction.java` (modified, +32/-16)
```diff
@@ -27,10 +27,8 @@
 import org.apache.lucene.document.LatLonPoint;
 import org.apache.lucene.search.BooleanClause;
 import org.apache.lucene.search.BooleanQuery;
-import org.apache.lucene.search.MatchAllDocsQuery;
 import org.apache.lucene.search.Query;
 import org.elasticsearch.common.geo.GeoUtils;
-import org.elasticsearch.common.lucene.search.Queries;
 import org.locationtech.spatial4j.shape.Point;
 
 import io.crate.data.Input;
@@ -39,6 +37,7 @@
 import io.crate.expression.operator.GteOperator;
 import io.crate.expression.operator.LtOperator;
 import io.crate.expression.operator.LteOperator;
+import io.crate.expression.predicate.IsNullPredicate;
 import io.crate.expression.symbol.Function;
 import io.crate.expression.symbol.Literal;
 import io.crate.expression.symbol.Symbol;
@@ -93,6 +92,7 @@ public static Double evaluate(Input<Point> arg1, Input<Point> arg2) {
         return GeoUtils.arcDistance(value1.getY(), value1.getX(), value2.getY(), value2.getX());
     }
 
+    @SuppressWarnings("unchecked")
     @Override
     public Symbol normalizeSymbol(Function symbol, TransactionContext txnCtx, NodeContext nodeCtx) {
         Symbol arg1 = symbol.arguments().get(0);
@@ -111,7 +111,7 @@ public Symbol normalizeSymbol(Function symbol, TransactionContext txnCtx, NodeCo
         }
 
         if (numLiterals == 2) {
-            return Literal.of(evaluate((Input) arg1, (Input) arg2));
+            return Literal.of(evaluate((Input<Point>) arg1, (Input<Point>) arg2));
         }
 
         // ensure reference is the first argument.
@@ -142,16 +142,24 @@ public Query toQuery(Function parent, Function inner, Context context) {
             // can't use distance filter without literal, fallback to genericFunction
             return null;
         }
+        Point pointValue = (Point) pointLiteral.value();
+        if (pointValue == null) {
+            // distance(p, NULL) is always NULL, the generic function filter handles that
+            return null;
+        }
+        String parentName = parent.name();
+        if (parentName.equals(IsNullPredicate.NAME)) {
+            // distance(p, point) is only NULL if p is NULL
+            return IsNullPredicate.refIsNullQuery(pointRef, context);
+        }
         List<Symbol> parentArgs = parent.arguments();
-        if (!(parentArgs.get(1) instanceof Literal<?> parentRhs)) {
+        if (parentArgs.size() != 2
+            || !(parentArgs.get(1) instanceof Literal<?> parentRhs)) {  
             // must be something like cmp(distance(..), non-literal) - fallback to genericFunction
             return null;
         }
         Double distance = DataTypes.DOUBLE.implicitCast(parentRhs.value());
-        String parentName = parent.name();
-        Point pointValue = (Point) pointLiteral.value();
-        String fieldName = pointRef.storageIdent();
-        return esV5DistanceQuery(parent, context, parentName, fieldName, distance, pointValue);
+        return esV5DistanceQuery(parent, context, parentName, pointRef, distance, pointValue);
     }
 
     /**
@@ -172,7 +180,7 @@ public Query toQuery(Function parent, Function inner, Context context) {
      *        ' - , _ _ _ ,  '
      *
      *  lt and lte -> match everything WITHIN distance
-     *  gt and gte -> match everything OUTSIDE distance
+     *  gt and gte -> match everything OUTSIDE distance, excluding rows where the point is NULL
      *
      *  eq distance ~ 0 -> match everything within distance + tolerance
      *
@@ -183,22 +191,31 @@ public Query toQuery(Function parent, Function inner, Context context) {
     private static Query esV5DistanceQuery(Function parentFunction,
                                            LuceneQueryBuilder.Context context,
                                            String parentOperatorName,
-                                           String columnName,
+                                           Reference pointRef,
                                            Double distance,
                                            Point lonLat) {
+        String columnName = pointRef.storageIdent();
         switch (parentOperatorName) {
             // We documented that using distance in the WHERE clause utilizes the index which isn't precise so treating
             // lte & lt the same should be acceptable
             case LteOperator.NAME:
             case LtOperator.NAME:
                 return LatLonPoint.newDistanceQuery(columnName, lonLat.getY(), lonLat.getX(), distance);
             case GteOperator.NAME:
-                if (distance - GeoUtils.TOLERANCE <= 0.0d) {
-                    return MatchAllDocsQuery.INSTANCE;
+            case GtOperator.NAME: {
+                // distance(NULL, ...) should be NULL, so rows without a point must not match
+                Query pointExists = IsNullPredicate.refExistsQuery(pointRef, context);
+                if (pointExists == null) {
+                    return null;
                 }
-                // fall through
-   
```

**File**: `server/src/test/java/io/crate/lucene/DistanceQueryBuilderTest.java` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+/*
+ * Licensed to Crate.io GmbH ("Crate") under one or more contributor
+ * license agreements.  See the NOTICE file distributed with this work for
+ * additional information regarding copyright ownership.  Crate licenses
+ * this file to you under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.  You may
+ * obtain a copy of the License at
+ *
+ *   http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
+ * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  See the
+ * License for the specific language governing permissions and limitations
+ * under the License.
+ *
+ * However, if you have executed another commercial license agreement
+ * with Crate these terms will supersede the license and you may use the
+ * software solely pursuant to the terms of the relevant commercial agreement.
+ */
+
+package io.crate.lucene;
+
+import static io.crate.testing.Asserts.assertThat;
+
+import org.apache.lucene.search.Query;
+import org.junit.Test;
+
+public class DistanceQueryBuilderTest extends LuceneQueryBuilderTest {
+
+    @Test
+    public void test_distance_lt_matches_points_within_distance() {
+        Query query = convert("distance(point, 'POINT (10 20)') < 120000");
+        assertThat(query).hasToString("point:20.0,10.0 +/- 120000.0 meters");
+    }
+
+    @Test
+    public void test_distance_gt_and_gte_exclude_null_points() {
+        Query query = convert("distance(point, 'POINT (10 20)') > 120000");
+        assertThat(query).hasToString("+FieldExistsQuery [field=point] -point:20.0,10.0 +/- 120000.0 meters");
+
+        query = convert("distance(point, 'POINT (10 20)') >= 120000");
+        assertThat(query).hasToString("+FieldExistsQuery [field=point] -point:20.0,10.0 +/- 120000.0 meters");
+    }
+
+    @Test
+    public void test_distance_gte_zero_matches_all_non_null_points() {
+        Query query = convert("distance(point, 'POINT (10 20)') >= 0");
+        assertThat(query).hasToString("FieldExistsQuery [field=point]");
+    }
+
+    @Test
+    public void test_distance_is_null_matches_null_points() {
+        Query query = convert("distance(point, 'POINT (10 20)') IS NULL");
+        assertThat(query).hasToString("+*:* -FieldExistsQuery [field=point]");
+
+        query = convert("distance(point, 'POINT (10 20)') IS NOT NULL");
+        assertThat(query).hasToString("FieldExistsQuery [field=point]");
+
+    }
+
+    @Test
+    public void test_distance_to_null_point_uses_generic_function_query() {
+        // distance(point, NULL) is NULL for every row
+        Query query = convert("distance(point, null) IS NULL");
+        assertThat(query).isExactlyInstanceOf(GenericFunctionQuery.class);
+
+        query = convert("distance(point, null) IS NOT NULL");
+        assertThat(query).hasToString("+*:* -(distance(_doc['point'], NULL) IS NULL)");
+
+        query = convert("distance(point, null) > 10");
+        assertThat(query).isExactlyInstanceOf(GenericFunctionQuery.class);
+    }
+}
```

---

### Incident Patch 5: `76ff9edc` (2026-09-29)
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
-        SSLSession session = getSession(ctx.channel());
-        Credentials credentials;
-        try {
-            credentials = credentialsFromRequest(request, session, defaultUser);
-        } catch (Throwable t) {
-            ReferenceCountUtil.release(request);
-            sendUnauthorized(ctx.channel(), t.getMessage());
-            return;
-        }
-        Predicate<Role> rolePredicate = credentials.matchByToken(checkJwtProperties);
-        if (rolePredicate != null) {
-            Role role = roles.findUser(rolePredicate);
-            if (role != null) {
-                credentials.setUsername(role.name());
-            }
-        }
-
-        String username = credentials.username();
-        InetAddress address = addressFromRequestOrChannel(request, ctx.channel());
-        ConnectionProperties connectionProperties = new ConnectionProperties(credentials, address, Protocol.HTTP, session);
-
-        AuthenticationMethod authMethod = authService.resolveAuthenticationType(use
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
-            if (username == null || username.isEmpty()) {
-                username = AuthSettings.AUTH_TRUST_HTTP_DEFAULT_HEADER.get(settings);
-            }
-            return roles.findUser(username);
-        }
-    }
 }
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

**File**: `server/src/main/java/org/elasticsearch/http/netty4/Netty4HttpServerTransport.java` (modified, +8/-7)
```diff
@@ -101,11 +101,11 @@
 import com.carrotsearch.hppc.IntSet;
 
 import io.crate.auth.Authentication;
-import io.crate.auth.HttpAuthUpstreamHandler;
 import io.crate.auth.Protocol;
 import io.crate.blob.BlobService;
 import io.crate.common.exceptions.Exceptions;
 import io.crate.netty.NettyBootstrap;
+import io.crate.protocols.http.HttpAuthenticator;
 import io.crate.protocols.http.HttpBlobHandler;
 import io.crate.protocols.http.MainAndStaticFileHandler;
 import io.crate.protocols.ssl.SslContextProvider;
@@ -598,28 +598,29 @@ public void initChannel(Channel ch) throws Exception {
             final HttpObjectAggregator aggregator = new HttpObjectAggregator(Math.toIntExact(transport.maxContentLength.getBytes()));
             aggregator.setMaxCumulationBufferComponents(transport.maxCompositeBufferComponents);
             pipeline.addLast("chunked", new ChunkedWriteHandler());
-            pipeline.addLast("auth_handler", new HttpAuthUpstreamHandler(settings, authentication, roles));
+            HttpAuthenticator authenticator = new HttpAuthenticator(settings, authentication, roles);
             pipeline.addLast("blob_handler", new HttpBlobHandler(
                 blobService,
-                settings,
                 sessions,
-                roles
+                roles,
+                authenticator
             ));
 
             pipeline.addLast("aggregator", aggregator);
             if (transport.compression) {
                 pipeline.addLast("encoder_compress", new HttpContentCompressor(transport.compressionLevel));
             }
             pipeline.addLast("sql_handler", new SqlHttpHandler(
-                settings,
                 sessions,
                 breakerService::getBreaker,
-                roles
+                roles,
+                authenticator
             ));
             pipeline.addLast("handler", new MainAndStaticFileHandler(
                 nodeName,
                 home,
-                nodeClient
+                nodeClient,
+                authenticator
             ));
             if (SETTING_CORS_ENABLED.get(transport.settings())) {
                 pipeline.addAfter("encoder", "cors", new Netty4CorsHandler(transport.getCorsConfig()));
```

**File**: `server/src/test/java/io/crate/protocols/http/HttpAuthenticatorTest.java` (renamed, +80/-174)
```diff
@@ -19,9 +19,9 @@
  * software solely pursuant to the terms of the relevant commercial agreement.
  */
 
-package io.crate.auth;
+package io.crate.protocols.http;
 
-import static io.crate.auth.HttpAuthUpstreamHandler.WWW_AUTHENTICATE_REALM_MESSAGE;
+import static io.crate.protocols.http.HttpAuthenticator.WWW_AUTHENTICATE_REALM_MESSAGE;
 import static io.crate.role.metadata.RolesHelper.JWT_TOKEN;
 import static io.crate.role.metadata.RolesHelper.JWT_USER;
 import static org.assertj.core.api.Assertions.assertThat;
@@ -47,6 +47,13 @@
 import org.junit.Test;
 import org.mockito.Mockito;
 
+import io.crate.auth.AlwaysOKAuthentication;
+import io.crate.auth.AuthSettings;
+import io.crate.auth.Authentication;
+import io.crate.auth.AuthenticationMethod;
+import io.crate.auth.Credentials;
+import io.crate.auth.HostBasedAuthentication;
+import io.crate.auth.JWTAuthenticationMethod;
 import io.crate.protocols.postgres.ConnectionProperties;
 import io.crate.role.Role;
 import io.crate.role.Roles;
@@ -55,7 +62,6 @@
 import io.netty.channel.embedded.EmbeddedChannel;
 import io.netty.handler.codec.http.DefaultFullHttpRequest;
 import io.netty.handler.codec.http.DefaultFullHttpResponse;
-import io.netty.handler.codec.http.DefaultHttpRequest;
 import io.netty.handler.codec.http.HttpHeaderNames;
 import io.netty.handler.codec.http.HttpMethod;
 import io.netty.handler.codec.http.HttpRequest;
@@ -64,7 +70,7 @@
 import io.netty.handler.codec.http.HttpVersion;
 import io.netty.pkitesting.CertificateBuilder;
 
-public class HttpAuthUpstreamHandlerTest extends ESTestCase {
+public class HttpAuthenticatorTest extends ESTestCase {
 
     private final Settings hbaEnabled = Settings.builder()
         .put("auth.host_based.enabled", true)
@@ -78,7 +84,12 @@ public class HttpAuthUpstreamHandlerTest extends ESTestCase {
         DnsResolver.SYSTEM,
         () -> "dummy"
     );
-    private final HttpAuthUpstreamHandler handlerWithHBA = new HttpAuthUpstreamHandler(Settings.EMPTY, authService, new StubRoleManager());
+    private final HttpAuthenticator authenticatorWithHBA =
+        new HttpAuthenticator(Settings.EMPTY, authService, new StubRoleManager());
+
+    private static HttpRequest sqlRequest() {
+        return new DefaultFullHttpRequest(HttpVersion.HTTP_1_1, HttpMethod.POST, "/_sql");
+    }
 
     private static void assertUnauthorized(DefaultFullHttpResponse resp, String expectedBody) {
         assertThat(resp.status()).isEqualTo(HttpResponseStatus.UNAUTHORIZED);
@@ -89,7 +100,7 @@ private static void assertUnauthorized(DefaultFullHttpResponse resp, String expe
     @Test
     public void testChannelClosedWhenUnauthorized() throws Exception {
         EmbeddedChannel ch = new EmbeddedChannel();
-        HttpAuthUpstreamHandler.sendUnauthorized(ch, null);
+        HttpAuthenticator.sendUnauthorized(ch, null);
         ch.releaseInbound();
 
         HttpResponse resp = ch.readOutbound();
@@ -100,7 +111,7 @@ public void testChannelClosedWhenUnauthorized() throws Exception {
     @Test
     public void testSendUnauthorizedWithoutBody() throws Exception {
         EmbeddedChannel ch = new EmbeddedChannel();
-        HttpAuthUpstreamHandler.sendUnauthorized(ch, null);
+        HttpAuthenticator.sendUnauthorized(ch, null);
         ch.releaseInbound();
 
         DefaultFullHttpResponse resp = ch.readOutbound();
@@ -110,7 +121,7 @@ public void testSendUnauthorizedWithoutBody() throws Exception {
     @Test
     public void testSendUnauthorizedWithBody() throws Exception {
         EmbeddedChannel ch = new EmbeddedChannel();
-        HttpAuthUpstreamHandler.sendUnauthorized(ch, "not allowed\n");
+        HttpAuthenticator.sendUnauthorized(ch, "not allowed\n");
         ch.releaseInbound();
 
         DefaultFullHttpResponse resp = ch.readOutbound();
@@ -120,7 +131,7 @@ public void testSendUnauthorizedWithBody() throws Exception {
     @Test
     public void testSendUnauthorizedWithBodyNoNewline() throws Exception {
         EmbeddedChannel ch = new EmbeddedChannel();
-        HttpAuthUpstreamHandler.sendUnauthorized(ch, "not allowed");
+        HttpAuthenticator.sendUnauthorized(ch, "not allowed");
         ch.releaseInbound();
 
         DefaultFullHttpResponse resp = ch.readOutbound();
@@ -129,28 +140,19 @@ public void testSendUnauthorizedWithBodyNoNewline() throws Exception {
 
     @Test
     public void testAuthorized() throws Exception {
-        HttpAuthUpstreamHandler handler = new HttpAuthUpstreamHandler(
+        HttpAuthenticator authenticator = new HttpAuthenticator(
             Settings.EMPTY, new AlwaysOKAuthentication(() -> List.of(Role.CRATE_USER)), new StubRoleManager());
-        EmbeddedChannel ch = new EmbeddedChannel(handler);
 
-        DefaultHttpRequest request = new DefaultFullHttpRequest(HttpVersion.HTTP_1_1, HttpMethod.POST, "/_sql");
-        ch.writeInbound(request);
-        ch.releaseInbound();
-
-        assertThat(handler.authorized()).isTrue();
+        assertThat(authenticator.authenticate(s
```

**File**: `server/src/test/java/io/crate/protocols/http/HttpBlobHandlerTest.java` (modified, +7/-5)
```diff
@@ -39,6 +39,7 @@
 import org.junit.Test;
 import org.mockito.Answers;
 
+import io.crate.auth.AlwaysOKAuthentication;
 import io.crate.blob.BlobContainer;
 import io.crate.blob.BlobService;
 import io.crate.blob.RemoteDigestBlob;
@@ -47,6 +48,7 @@
 import io.crate.metadata.settings.CoordinatorSessionSettings;
 import io.crate.protocols.postgres.ConnectionProperties;
 import io.crate.role.Role;
+import io.crate.role.Roles;
 import io.crate.session.Session;
 import io.crate.session.Sessions;
 import io.crate.test.integration.CrateDummyClusterServiceUnitTest;
@@ -65,6 +67,7 @@ public class HttpBlobHandlerTest extends CrateDummyClusterServiceUnitTest {
 
     private static final String VALID_DIGEST = "a".repeat(40);
     private static final String BLOB_URI = "/_blobs/mytable/" + VALID_DIGEST;
+    private static final Roles ROLES = () -> List.of(Role.CRATE_USER);
 
     // An instance for cases where it returns some data and doesn't throw.
     private final BlobService blobService = mock(BlobService.class);
@@ -332,19 +335,18 @@ public Session newSession(ConnectionProperties connectionProperties, @Nullable S
 
         return new EmbeddedChannel(new HttpBlobHandler(
             blobService,
-            Settings.EMPTY,
             mockedSessions,
-            () -> List.of(Role.CRATE_USER)
+            ROLES,
+            new HttpAuthenticator(Settings.EMPTY, new AlwaysOKAuthentication(ROLES), ROLES)
         ));
     }
 
     private EmbeddedChannel createEmbeddedChannel(BlobService blobService, Sessions sessions) {
         return new EmbeddedChannel(new HttpBlobHandler(
             blobService,
-            Settings.EMPTY,
             sessions,
-            () -> List.of(Role.CRATE_USER)
+            ROLES,
+            new HttpAuthenticator(Settings.EMPTY, new AlwaysOKAuthentication(ROLES), ROLES)
         ));
-
     }
 }
```

---

### Incident Patch 6: `d8c817b9` (2026-09-29)
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

### Incident Patch 7: `7a108456` (2026-09-28)
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

### Incident Patch 8: `6cac3f6a` (2026-09-24)
**Commit Message**: Optimize loop in LogicalPlanner.PlanBuilder#getOutputsForRelation

**File**: `server/src/main/java/io/crate/planner/operators/LogicalPlanner.java` (modified, +4/-4)
```diff
@@ -499,10 +499,10 @@ private static List<Symbol> getOutputsForRelation(AnalyzedRelation relation, Lis
             LinkedHashSet<Symbol> result = new LinkedHashSet<>();
             SequencedSet<RelationName> relationNamesFromRelation = RelationNames.getShallow(relation);
             Predicate<Symbol> collectFiltered = node -> {
-                SequencedSet<RelationName> relationNamesFromSymbol = RelationNames.getShallow(node);
-                for (RelationName relationName : relationNamesFromSymbol) {
-                    if (relationNamesFromRelation.contains(relationName)) {
-                        if (node instanceof ScopedSymbol || node instanceof Reference) {
+                if (node instanceof ScopedSymbol || node instanceof Reference) {
+                    SequencedSet<RelationName> relationNamesFromSymbol = RelationNames.getShallow(node);
+                    for (RelationName relationName : relationNamesFromSymbol) {
+                        if (relationNamesFromRelation.contains(relationName)) {
                             result.add(node);
                             break;
                         }
```

---

### Incident Patch 9: `89224ba4` (2026-09-24)
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
         assertThat(response.rows()[10][1]).isEqualTo(11L);
         assertThat(response.rows()[10][2]).isEqualTo(List.of("level1", "level2_nullable"));
         assertThat(response.rows()[10][3]).isEqualTo("strict");
+
+        // NUMERIC with NULL precision/scale
+        execute("CREATE VIEW v AS SELECT 123.456::NUMERIC");
+        execute("""
+            SELECT column_name, numeric_precision, numeric_scale
+            FROM information_schema.columns
+            WHERE table_schema = ? AND table_name = 'v'
+            """, new Object[]{defaultSchema});
+        assertThat(response).hasRows("123.456| NULL| NULL");
     }
 
     @Test
```

---

### Incident Patch 10: `f7abdbbd` (2026-09-23)
**Commit Message**: Remove dead code from XContentBuilder

**File**: `libs/es-x-content/src/main/java/org/elasticsearch/common/xcontent/XContentBuilder.java` (modified, +0/-168)
```diff
@@ -23,7 +23,6 @@
 import java.io.Closeable;
 import java.io.Flushable;
 import java.io.IOException;
-import java.io.InputStream;
 import java.io.OutputStream;
 import java.math.BigDecimal;
 import java.math.BigInteger;
@@ -212,32 +211,12 @@ public XContentBuilder nullValue() throws IOException {
     // Boolean
     //////////////////////////////////
 
-    public XContentBuilder field(String name, Boolean value) throws IOException {
-        return (value == null) ? nullField(name) : field(name, value.booleanValue());
-    }
-
     public XContentBuilder field(String name, boolean value) throws IOException {
         ensureNameNotNull(name);
         generator.writeBooleanField(name, value);
         return this;
     }
 
-    public XContentBuilder array(String name, boolean[] values) throws IOException {
-        return field(name).values(values);
-    }
-
-    private XContentBuilder values(boolean[] values) throws IOException {
-        if (values == null) {
-            return nullValue();
-        }
-        startArray();
-        for (boolean b : values) {
-            value(b);
-        }
-        endArray();
-        return this;
-    }
-
     public XContentBuilder value(Boolean value) throws IOException {
         return (value == null) ? nullValue() : value(value.booleanValue());
     }
@@ -251,10 +230,6 @@ public XContentBuilder value(boolean value) throws IOException {
     // Byte
     //////////////////////////////////
 
-    public XContentBuilder field(String name, Byte value) throws IOException {
-        return (value == null) ? nullField(name) : field(name, value.byteValue());
-    }
-
     public XContentBuilder field(String name, byte value) throws IOException {
         return field(name).value(value);
     }
@@ -272,20 +247,6 @@ public XContentBuilder value(byte value) throws IOException {
     // Double
     //////////////////////////////////
 
-    public XContentBuilder field(String name, Double value) throws IOException {
-        return (value == null) ? nullField(name) : field(name, value.doubleValue());
-    }
-
-    public XContentBuilder field(String name, double value) throws IOException {
-        ensureNameNotNull(name);
-        generator.writeNumberField(name, value);
-        return this;
-    }
-
-    public XContentBuilder array(String name, double[] values) throws IOException {
-        return field(name).values(values);
-    }
-
     private XContentBuilder values(double[] values) throws IOException {
         if (values == null) {
             return nullValue();
@@ -311,20 +272,12 @@ public XContentBuilder value(double value) throws IOException {
     // Float
     //////////////////////////////////
 
-    public XContentBuilder field(String name, Float value) throws IOException {
-        return (value == null) ? nullField(name) : field(name, value.floatValue());
-    }
-
     public XContentBuilder field(String name, float value) throws IOException {
         ensureNameNotNull(name);
         generator.writeNumberField(name, value);
         return this;
     }
 
-    public XContentBuilder array(String name, float[] values) throws IOException {
-        return field(name).values(values);
-    }
-
     private XContentBuilder values(float[] values) throws IOException {
         if (values == null) {
             return nullValue();
@@ -350,20 +303,12 @@ public XContentBuilder value(float value) throws IOException {
     // Integer
     //////////////////////////////////
 
-    public XContentBuilder field(String name, Integer value) throws IOException {
-        return (value == null) ? nullField(name) : field(name, value.intValue());
-    }
-
     public XContentBuilder field(String name, int value) throws IOException {
         ensureNameNotNull(name);
         generator.writeNumberField(name, value);
         return this;
     }
 
-    public XContentBuilder array(String name, int[] values) throws IOException {
-        return field(name).values(values);
-    }
-
     private XContentBuilder values(int[] values) throws IOException {
         if (values == null) {
             return nullValue();
@@ -389,20 +334,12 @@ public XContentBuilder value(int value) throws IOException {
     // Long
     //////////////////////////////////
 
-    public XContentBuilder field(String name, Long value) throws IOException {
-        return (value == null) ? nullField(name) : field(name, value.longValue());
-    }
-
     public XContentBuilder field(String name, long value) throws IOException {
         ensureNameNotNull(name);
         generator.writeNumberField(name, value);
         return this;
     }
 
-    public XContentBuilder array(String name, long[] values) throws IOException {
-        return field(name).values(values);
-    }
-
     private XContentBuilder values(long[] values) throws IOException {
         if (values == null) {
             return nullValue();
@@ -428,18 +365,6 @@ public XContentBuilder value(long value) throws IOException {
     // Short
 
```

---

### Incident Patch 11: `05dc51b1` (2026-09-23)
**Commit Message**: Remove unused HumanReadableTransformers from XContentBuilder

**File**: `libs/es-x-content/src/main/java/org/elasticsearch/common/xcontent/XContentBuilder.java` (modified, +0/-61)
```diff
@@ -60,7 +60,6 @@ public static XContentBuilder builder(XContent xContent) throws IOException {
     }
 
     private static final Map<Class<?>, Writer> WRITERS;
-    private static final Map<Class<?>, HumanReadableTransformer> HUMAN_READABLE_TRANSFORMERS;
 
     static {
         Map<Class<?>, Writer> writers = new HashMap<>();
@@ -86,37 +85,22 @@ public static XContentBuilder builder(XContent xContent) throws IOException {
         writers.put(BigDecimal.class, (b, v) -> b.value((BigDecimal) v));
         writers.put(UUID.class, (b, v) -> b.value(v.toString()));
 
-        Map<Class<?>, HumanReadableTransformer> humanReadableTransformer = new HashMap<>();
-
         // Load pluggable extensions
         for (XContentBuilderExtension service : ServiceLoader.load(XContentBuilderExtension.class)) {
             Map<Class<?>, Writer> addlWriters = service.getXContentWriters();
-            Map<Class<?>, HumanReadableTransformer> addlTransformers = service.getXContentHumanReadableTransformers();
             addlWriters.forEach((key, value) -> Objects.requireNonNull(value,
                 "invalid null xcontent writer for class " + key));
-            addlTransformers.forEach((key, value) -> Objects.requireNonNull(value,
-                "invalid null xcontent transformer for human readable class " + key));
             writers.putAll(addlWriters);
-            humanReadableTransformer.putAll(addlTransformers);
         }
 
         WRITERS = Collections.unmodifiableMap(writers);
-        HUMAN_READABLE_TRANSFORMERS = Collections.unmodifiableMap(humanReadableTransformer);
     }
 
     @FunctionalInterface
     public interface Writer {
         void write(XContentBuilder builder, Object value) throws IOException;
     }
 
-    /**
-     * Interface for transforming complex objects into their "raw" equivalents for human-readable fields
-     */
-    @FunctionalInterface
-    public interface HumanReadableTransformer {
-        Object rawValue(Object value) throws IOException;
-    }
-
     /**
      * XContentGenerator used to build the XContent object
      */
@@ -127,11 +111,6 @@ public interface HumanReadableTransformer {
      */
     private final OutputStream bos;
 
-    /**
-     * When this flag is set to true, some types of values are written in a format easier to read for a human.
-     */
-    private boolean humanReadable = false;
-
     /**
      * Constructs a new builder using the provided XContent and an OutputStream. Make sure
      * to call {@link #close()} when the builder is done with.
@@ -180,23 +159,6 @@ public XContentBuilder lfAtEnd() {
         return this;
     }
 
-    /**
-     * Set the "human readable" flag. Once set, some types of values are written in a
-     * format easier to read for a human.
-     */
-    public XContentBuilder humanReadable(boolean humanReadable) {
-        this.humanReadable = humanReadable;
-        return this;
-    }
-
-    /**
-     * @return the value of the "human readable" flag. When the value is equal to true,
-     * some types of values are written in a format easier to read for a human.
-     */
-    public boolean humanReadable() {
-        return this.humanReadable;
-    }
-
     ////////////////////////////////////////////////////////////////////////////
     // Structure (object, array, field, null values...)
     //////////////////////////////////
@@ -798,29 +760,6 @@ private XContentBuilder value(Iterable<?> values, Map<Class<?>, Writer> writerOv
         return this;
     }
 
-    ////////////////////////////////////////////////////////////////////////////
-    // Human readable fields
-    //
-    // These are fields that have a "raw" value and a "human readable" value,
-    // such as time values or byte sizes. The human readable variant is only
-    // used if the humanReadable flag has been set
-    //////////////////////////////////
-
-    public XContentBuilder humanReadableField(String rawFieldName, String readableFieldName, Object value) throws IOException {
-        if (humanReadable) {
-            field(readableFieldName, Objects.toString(value));
-        }
-        HumanReadableTransformer transformer = HUMAN_READABLE_TRANSFORMERS.get(value.getClass());
-        if (transformer != null) {
-            Object rawValue = transformer.rawValue(value);
-            field(rawFieldName, rawValue);
-        } else {
-            throw new IllegalArgumentException("no raw transformer found for class " + value.getClass());
-        }
-        return this;
-    }
-
-
     ////////////////////////////////////////////////////////////////////////////
     // Raw fields
     //////////////////////////////////
```

**File**: `libs/es-x-content/src/main/java/org/elasticsearch/common/xcontent/XContentBuilderExtension.java` (modified, +0/-17)
```diff
@@ -44,21 +44,4 @@ public interface XContentBuilderExtension {
      * @return a map of class name to writer
      */
     Map<Class<?>, XContentBuilder.Writer> getXContentWriters();
-
-    /**
-     * Used for plugging in a human readable version of a class's encoding. It is assumed that
-     * the human readable equivalent is <b>always</b> behind the {@code toString()} method, so
-     * this transformer returns the raw value to be used.
-     *
-     * An example implementation:
-     *
-     * <pre>
-     * {@code
-     *     Map<Class<?>, XContentBuilder.HumanReadableTransformer> transformers = new HashMap<>();
-     *     transformers.put(ByteSizeValue.class, (value) -> ((ByteSizeValue) value).bytes());
-     * }
-     * </pre>
-     * @return a map of class name to transformer used to retrieve raw value
-     */
-    Map<Class<?>, XContentBuilder.HumanReadableTransformer> getXContentHumanReadableTransformers();
 }
```

**File**: `server/src/main/java/io/crate/server/xcontent/ServerXContentExtension.java` (modified, +0/-9)
```diff
@@ -25,7 +25,6 @@
 
 import org.apache.lucene.util.BytesRef;
 import org.elasticsearch.common.bytes.BytesReference;
-import org.elasticsearch.common.unit.ByteSizeValue;
 import org.elasticsearch.common.xcontent.XContentBuilder;
 import org.elasticsearch.common.xcontent.XContentBuilderExtension;
 import org.locationtech.spatial4j.shape.Point;
@@ -113,12 +112,4 @@ public Map<Class<?>, XContentBuilder.Writer> getXContentWriters() {
         });
         return writers;
     }
-
-    @Override
-    public Map<Class<?>, XContentBuilder.HumanReadableTransformer> getXContentHumanReadableTransformers() {
-        return Map.of(
-            TimeValue.class, v -> ((TimeValue) v).millis(),
-            ByteSizeValue.class, v -> ((ByteSizeValue) v).getBytes()
-        );
-    }
 }
```

---

### Incident Patch 12: `7673e53b` (2026-09-23)
**Commit Message**: Remove unused date transformers from XContentBuilderExtension

**File**: `libs/es-x-content/src/main/java/org/elasticsearch/common/xcontent/XContentBuilder.java` (modified, +0/-68)
```diff
@@ -30,17 +30,13 @@
 import java.nio.file.Path;
 import java.time.ZonedDateTime;
 import java.util.Arrays;
-import java.util.Calendar;
 import java.util.Collections;
-import java.util.Date;
-import java.util.GregorianCalendar;
 import java.util.HashMap;
 import java.util.Locale;
 import java.util.Map;
 import java.util.Objects;
 import java.util.ServiceLoader;
 import java.util.UUID;
-import java.util.function.UnaryOperator;
 
 import org.jspecify.annotations.Nullable;
 
@@ -65,14 +61,12 @@ public static XContentBuilder builder(XContent xContent) throws IOException {
 
     private static final Map<Class<?>, Writer> WRITERS;
     private static final Map<Class<?>, HumanReadableTransformer> HUMAN_READABLE_TRANSFORMERS;
-    private static final Map<Class<?>, UnaryOperator<Object>> DATE_TRANSFORMERS;
 
     static {
         Map<Class<?>, Writer> writers = new HashMap<>();
         writers.put(Boolean.class, (b, v) -> b.value((Boolean) v));
         writers.put(Byte.class, (b, v) -> b.value((Byte) v));
         writers.put(byte[].class, (b, v) -> b.value((byte[]) v));
-        writers.put(Date.class, XContentBuilder::timeValue);
         writers.put(Double.class, (b, v) -> b.value((Double) v));
         writers.put(double[].class, (b, v) -> b.values((double[]) v));
         writers.put(Float.class, (b, v) -> b.value((Float) v));
@@ -88,39 +82,26 @@ public static XContentBuilder builder(XContent xContent) throws IOException {
         writers.put(Locale.class, (b, v) -> b.value(v.toString()));
         writers.put(Class.class, (b, v) -> b.value(v.toString()));
         writers.put(ZonedDateTime.class, (b, v) -> b.value(v.toString()));
-        writers.put(Calendar.class, XContentBuilder::timeValue);
-        writers.put(GregorianCalendar.class, XContentBuilder::timeValue);
         writers.put(BigInteger.class, (b, v) -> b.value((BigInteger) v));
         writers.put(BigDecimal.class, (b, v) -> b.value((BigDecimal) v));
         writers.put(UUID.class, (b, v) -> b.value(v.toString()));
 
         Map<Class<?>, HumanReadableTransformer> humanReadableTransformer = new HashMap<>();
-        Map<Class<?>, UnaryOperator<Object>> dateTransformers = new HashMap<>();
-
-        // treat strings as already converted
-        dateTransformers.put(String.class, UnaryOperator.identity());
 
         // Load pluggable extensions
         for (XContentBuilderExtension service : ServiceLoader.load(XContentBuilderExtension.class)) {
             Map<Class<?>, Writer> addlWriters = service.getXContentWriters();
             Map<Class<?>, HumanReadableTransformer> addlTransformers = service.getXContentHumanReadableTransformers();
-            Map<Class<?>, UnaryOperator<Object>> addlDateTransformers = service.getDateTransformers();
-
             addlWriters.forEach((key, value) -> Objects.requireNonNull(value,
                 "invalid null xcontent writer for class " + key));
             addlTransformers.forEach((key, value) -> Objects.requireNonNull(value,
                 "invalid null xcontent transformer for human readable class " + key));
-            addlDateTransformers.forEach((key, value) -> Objects.requireNonNull(value,
-                "invalid null xcontent date transformer for class " + key));
-
             writers.putAll(addlWriters);
             humanReadableTransformer.putAll(addlTransformers);
-            dateTransformers.putAll(addlDateTransformers);
         }
 
         WRITERS = Collections.unmodifiableMap(writers);
         HUMAN_READABLE_TRANSFORMERS = Collections.unmodifiableMap(humanReadableTransformer);
-        DATE_TRANSFORMERS = Collections.unmodifiableMap(dateTransformers);
     }
 
     @FunctionalInterface
@@ -674,55 +655,6 @@ public XContentBuilder utf8Value(byte[] bytes, int offset, int length) throws IO
     }
 
 
-    ////////////////////////////////////////////////////////////////////////////
-    // Date
-    //////////////////////////////////
-
-    /**
-     * Write a time-based field and value, if the passed timeValue is null a
-     * null value is written, otherwise a date transformers lookup is performed.
-
-     * @throws IllegalArgumentException if there is no transformers for the type of object
-     */
-    public XContentBuilder timeField(String name, Object timeValue) throws IOException {
-        return field(name).timeValue(timeValue);
-    }
-
-    /**
-     * If the {@code humanReadable} flag is set, writes both a formatted and
-     * unformatted version of the time value using the date transformer for the
-     * {@link Long} class.
-     */
-    public XContentBuilder timeField(String name, String readableName, long value) throws IOException {
-        if (humanReadable) {
-            UnaryOperator<Object> longTransformer = DATE_TRANSFORMERS.get(Long.class);
-            if (longTransformer == null) {
-                throw new IllegalArgumentException("cannot write time value xcontent for unknown value of type Long");
-            }
-            field(readableName
```

**File**: `libs/es-x-content/src/main/java/org/elasticsearch/common/xcontent/XContentBuilderExtension.java` (modified, +0/-17)
```diff
@@ -20,7 +20,6 @@
 package org.elasticsearch.common.xcontent;
 
 import java.util.Map;
-import java.util.function.UnaryOperator;
 
 /**
  * This interface provides a way for non-JDK classes to plug in a way to serialize to xcontent.
@@ -62,20 +61,4 @@ public interface XContentBuilderExtension {
      * @return a map of class name to transformer used to retrieve raw value
      */
     Map<Class<?>, XContentBuilder.HumanReadableTransformer> getXContentHumanReadableTransformers();
-
-    /**
-     * Used for plugging a transformer for a date or time type object into a String (or other
-     * encodable object).
-     *
-     * For example:
-     *
-     * <pre>
-     * {@code
-     *     final DateTimeFormatter datePrinter = ISODateTimeFormat.dateTime().withZone(DateTimeZone.UTC);
-     *     Map<Class<?>, UnaryOperator<Object>> transformers = new HashMap<>();
-     *     transformers.put(Date.class, d -> datePrinter.print(((Date) d).getTime()));
-     * }
-     * </pre>
-     */
-    Map<Class<?>, UnaryOperator<Object>> getDateTransformers();
 }
```

**File**: `server/src/main/java/io/crate/server/xcontent/ServerXContentExtension.java` (modified, +0/-6)
```diff
@@ -22,7 +22,6 @@
 import java.util.HashMap;
 import java.util.Map;
 import java.util.Objects;
-import java.util.function.UnaryOperator;
 
 import org.apache.lucene.util.BytesRef;
 import org.elasticsearch.common.bytes.BytesReference;
@@ -122,9 +121,4 @@ public Map<Class<?>, XContentBuilder.HumanReadableTransformer> getXContentHumanR
             ByteSizeValue.class, v -> ((ByteSizeValue) v).getBytes()
         );
     }
-
-    @Override
-    public Map<Class<?>, UnaryOperator<Object>> getDateTransformers() {
-        return Map.of();
-    }
 }
```

---

### Incident Patch 13: `472a4319` (2026-09-22)
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

### Incident Patch 14: `3198c342` (2026-09-21)
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

### Incident Patch 15: `2f8226d0` (2026-09-21)
**Commit Message**: Remove value->Literal->String roundtrip in CommonQueryBuilderTest

**File**: `server/src/test/java/io/crate/lucene/CommonQueryBuilderTest.java` (modified, +2/-23)
```diff
@@ -47,7 +47,6 @@
 import org.apache.lucene.spatial.prefix.IntersectsPrefixTreeQuery;
 import org.elasticsearch.Version;
 import org.junit.Test;
-import org.locationtech.spatial4j.shape.impl.PointImpl;
 
 import io.crate.analyze.WhereClause;
 import io.crate.analyze.relations.AnalyzedRelation;
@@ -71,9 +70,6 @@
 import io.crate.types.DataType;
 import io.crate.types.DataTypes;
 import io.crate.types.FloatVectorType;
-import io.crate.types.GeoPointType;
-import io.crate.types.GeoShapeType;
-import io.crate.types.NumericType;
 import io.crate.types.ObjectType;
 
 public class CommonQueryBuilderTest extends LuceneQueryBuilderTest {
@@ -999,19 +995,7 @@ public void test_all_eq_query_for_all_types() throws Exception {
                 builder.indexValue("a", listOfVal1AndNull);
                 builder.indexValue("a", listOfVal2AndNull);
 
-                String val1Str = Literal.ofUnchecked(type, val1).toString();
-                if (type.id() == GeoPointType.ID) {
-                    PointImpl p = (PointImpl) val1;
-                    val1Str = "[" + p.getX() + "," + p.getY() + "]";
-                } else if (type.id() == GeoShapeType.ID) {
-                    // DataTypeTesting.getDataGenerator generates points only
-                    List<Double> c = (List<Double>) ((Map<String, Object>) val1).get("coordinates");
-                    val1Str = String.format("'POINT (%s %s)'", c.get(0), c.get(1));
-                } else if (type.id() == NumericType.ID) {
-                    // TODO: quoting the numeric literals to preserve precision then correctly match - https://github.com/crate/crate/issues/18220
-                    val1Str = "'" + val1 + "'";
-                }
-                assertThat(tester.runQuery("a", String.format("%s = all(a)", val1Str)))
+                assertThat(tester.runQuery("a", "? = all(a)", val1))
                     .containsExactly(List.of(val1), List.of(val1, val1), List.of());
             }
         }
@@ -1054,12 +1038,7 @@ public void test_all_eq_query_for_all_types_with_columnstore_false() throws Exce
                 builder.indexValue("a", listOfVal1AndNull);
                 builder.indexValue("a", listOfVal2AndNull);
 
-                String val1Str = Literal.ofUnchecked(type, val1).toString();
-                if (type.id() == NumericType.ID) {
-                    // TODO: quoting the numeric literals to preserve precision then correctly match - https://github.com/crate/crate/issues/18220
-                    val1Str = "'" + val1 + "'";
-                }
-                assertThat(tester.runQuery("a", String.format("%s = all(a)", val1Str)))
+                assertThat(tester.runQuery("a", "? = all(a)", val1))
                     .containsExactly(List.of(val1), List.of(val1, val1), List.of());
             }
         }
```

#### Recent Merged Pull Requests:
- **PR #20326** (2026-10-05): Fix terms query generation for = ANY(...) on UUID & Numeric (backport #20324) (@mergify[bot])
- **PR #20325** (2026-10-05): Extend type storage test with null value & ordering assertion (@mfussenegger)
- **PR #20324** (2026-10-05): Fix terms query generation for = ANY(...) on UUID & Numeric (@mfussenegger)
- **PR #20323** (2026-10-03): Fix distance() `>` and `>=` filters on NULL geo points (backport #20322) (@mergify[bot])
- **PR #20322** (2026-10-03): Fix distance() `>` and `>=` filters on NULL geo points (@matriv)
- **PR #20320** (2026-10-02): Show all publications to superusers and users with `AL` (backport #20318) (@mergify[bot])
- **PR #20318** (2026-10-02): Show all publications to superusers and users with `AL` (@matriv)
- **PR #20315** (2026-10-01): Add missing `AL` privilege to `sys.jobs/operations(_log)` visibility documentation (backport #20313) (@mergify[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
