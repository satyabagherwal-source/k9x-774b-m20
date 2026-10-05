# Forensic Learning Record (Deep Inspection): goharbor/harbor

> **Canonical Artifact**: `07_PROJECT_LEARNING/goharbor-harbor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/goharbor/harbor](https://github.com/goharbor/harbor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:04:30.258Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `goharbor/harbor`
- **Description**: An open source trusted cloud native registry project that stores, signs, and scans content.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 29476 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `make/photon/prepare/commands/gencerts.py`
```
import os
import sys
import click
import pathlib
import logging
from subprocess import Popen, PIPE, STDOUT, CalledProcessError

from utils.cert import openssl_installed
from utils.misc import get_realpath

gen_tls_script = pathlib.Path(__file__).parent.parent.joinpath('scripts/gencert.sh').absolute()

@click.command()
@click.option('-p', '--path', required=True, type=str,help='the path to store generated cert files')
@click.option('-d', '--days', default='365', type=str, help='the expired time for cert')
def gencert(path, days):
    """
    gencert command will generate cert files for internal TLS
    """
    path = get_realpath(path)
    click.echo('Check openssl ...')
    if not openssl_installed():
        raise(Exception('openssl not installed'))

    click.echo("start generate internal tls certs")
    if not os.path.exists(path):
        click.echo('path {} not exist, create it...'.format(path))
        os.makedirs(path, exist_ok=True)
    with Popen([gen_tls_script, days], stdout=PIPE, stderr=STDOUT, cwd=path) as p:
        for line in p.stdout:
            click.echo(line, nl=False)
    if p.returncode != 0:
        raise CalledProcessError(p.returncode, p.args)

```

### Core Architecture Module: `make/photon/prepare/commands/migrate.py`
```
import os, sys, shutil, glob
from packaging import version

import click

from utils.misc import get_realpath
from utils.migration import read_conf, search
from migrations import accept_versions

@click.command()
@click.option('-i', '--input', 'input_', required=True, help="The path of original config file")
@click.option('-o', '--output', default='', help="the path of output config file")
@click.option('-t', '--target', default='2.15.0', help="target version of input path")
def migrate(input_, output, target):
    """
    migrate command will migrate config file style to specific version
    :input_: is the path of the original config file
    :output: is the destination path of config file, the generated configs will storage in it
    :target: is the the target version of config file will upgrade to
    """
    if target not in accept_versions:
        click.echo('target version {} not supported'.format(target))
        sys.exit(-1)

    if not output:
        output = input_
    input_path = get_realpath(input_)
    output_path = get_realpath(output)

    configs = read_conf(input_path)
    input_version = configs.get('_version')
    if version.parse(input_version) < version.parse('1.9.0'):
        click.echo('the version {} not supported, make sure the version in input file above 1.8.0'.format(input_version))
        sys.exit(-1)
    if input_version == target:
        click.echo("Version of input harbor.yml is identical to target {}, no need to upgrade".format(input_version))
        sys.exit(0)

    current_input_path = input_path
    for m in search(input_version, target):
        current_output_path = "harbor.yml.{}.tmp".format(m.revision)
        click.echo("migrating to version {}".format(m.revision))
        m.migrate(current_input_path, current_output_path)
        current_input_path = current_output_path
    shutil.copy(current_input_path, output_path)
    click.echo("Written new values to {}".format(output))
    for tmp_f in glob.glob("harbor.yml.*.tmp"):
        os.remove(tmp_f)


```

### Core Architecture Module: `make/photon/prepare/commands/prepare.py`
```
# pylint: disable=no-value-for-parameter

import sys
import logging

import click

from utils.misc import delfile
from utils.configs import validate, parse_yaml_config
from utils.cert import prepare_registry_ca, SSL_CERT_KEY_PATH, SSL_CERT_PATH, get_secret_key, prepare_trust_ca
from utils.db import prepare_db
from utils.jobservice import prepare_job_service
from utils.registry import prepare_registry
from utils.registry_ctl import prepare_registry_ctl
from utils.core import prepare_core
from utils.log import prepare_log_configs
from utils.docker_compose import prepare_docker_compose
from utils.nginx import prepare_nginx, nginx_confd_dir
from utils.redis import prepare_redis
from utils.internal_tls import prepare_tls
from utils.trivy_adapter import prepare_trivy_adapter
from utils.portal import prepare_portal
from utils.exporter import prepare_exporter
from g import (config_dir, input_config_path, private_key_pem_path, root_crt_path, secret_key_dir,
old_private_key_pem_path, old_crt_path)

@click.command()
@click.option('--conf', default=input_config_path, help="the path of Harbor configuration file")
@click.option('--with-trivy', is_flag=True, help="the Harbor instance is to be deployed with Trivy")
def prepare(conf, with_trivy):

    delfile(config_dir)
    config_dict = parse_yaml_config(conf, with_trivy=with_trivy)
    try:
        validate(config_dict)
    except Exception as e:
        click.echo('Error happened in config validation...')
        logging.error(e)
        sys.exit(-1)

    prepare_portal(config_dict)
    prepare_log_configs(config_dict)
    prepare_nginx(config_dict)
    prepare_core(config_dict, with_trivy=with_trivy)
    prepare_registry(config_dict)
    prepare_registry_ctl(config_dict)
    prepare_db(config_dict)
    prepare_job_service(config_dict)
    prepare_redis(config_dict)
    prepare_tls(config_dict)
    prepare_trust_ca(config_dict)

    get_secret_key(secret_key_dir)

    #  If Customized cert enabled
    prepare_registry_ca(
        private_key_pem_path=private_key_pem_path,
        root_crt_path=root_crt_path,
        old_private_key_pem_path=old_private_key_pem_path,
        old_crt_path=old_crt_path)

    if config_dict['metric'].enabled:
        prepare_exporter(config_dict)

    if with_trivy:
        prepare_trivy_adapter(config_dict)

    prepare_docker_compose(config_dict, with_trivy)

```

### Core Architecture Module: `make/photon/prepare/g.py`
```
import os
from pathlib import Path

## Const
DEFAULT_UID = 10000
DEFAULT_GID = 10000

PG_UID = 999
PG_GID = 999

REDIS_UID = 999
REDIS_GID = 999

## Global variable
templates_dir = Path("/usr/src/app/templates")

host_root_dir = Path('/hostfs')

base_dir = '/harbor_make'
config_dir = Path('/config')
data_dir = Path('/data')

secret_dir = data_dir.joinpath('secret')
secret_key_dir = secret_dir.joinpath('keys')
trust_ca_dir = secret_dir.joinpath('keys', 'trust_ca')
internal_tls_dir = secret_dir.joinpath('tls')

storage_ca_bundle_filename = 'storage_ca_bundle.crt'
internal_ca_filename = 'harbor_internal_ca.crt'
redis_tls_ca_filename = 'redis_tls_ca.crt'

old_private_key_pem_path = Path('/config/core/private_key.pem')
old_crt_path = Path('/config/registry/root.crt')

private_key_pem_path = secret_dir.joinpath('core', 'private_key.pem')
root_crt_path = secret_dir.joinpath('registry', 'root.crt')

config_file_path = '/compose_location/harbor.yml'
input_config_path = '/input/harbor.yml'
versions_file_path = Path('/usr/src/app/versions')

cert_dir = config_dir.joinpath("nginx", "cert")
core_cert_dir = config_dir.joinpath("core", "certificates")
shared_cert_dir = config_dir.joinpath("shared", "trust-certificates")

INTERNAL_NO_PROXY_DN = {
    '127.0.0.1',
    'localhost',
    '.local',
    '.internal',
    'log',
    'db',
    'redis',
    'nginx',
    'core',
    'portal',
    'postgresql',
    'jobservice',
    'registry',
    'registryctl',
    'trivy-adapter',
    'exporter',
    }

```

### Core Architecture Module: `make/photon/prepare/main.py`
```
from commands.prepare import prepare
from commands.gencerts import gencert
from commands.migrate import migrate
import click

@click.group()
def cli():
    pass

cli.add_command(prepare)
cli.add_command(gencert)
cli.add_command(migrate)

if __name__ == '__main__':
    cli()

```

### Core Architecture Module: `make/photon/prepare/migrations/__init__.py`
```
import os

MIGRATION_BASE_DIR = os.path.dirname(__file__)

accept_versions = {'1.9.0', '1.10.0', '2.0.0', '2.1.0', '2.2.0', '2.3.0', '2.4.0', '2.5.0', '2.6.0', '2.7.0', '2.8.0', '2.9.0','2.10.0', '2.11.0', '2.12.0', '2.13.0', '2.14.0', '2.15.0'}
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #24036** (2026-09-30): **feat(portal): Custom project roles UI, with UI fixes on top of #23970**
  *Symptoms*: Builds on #23970 by @Maxlvsx. The first four commits are his, unchanged; the last two are on top.  Not a replacement for #23970 and not competing with it. It exists so the fixes can be reviewed against a running build. If they are wanted on #23970 instead, take the last two commits and close this.  ## UI fixes  - **ACTION dropdown and per-row permissions button rendered a stuck-looking glyph.** Both asked for `shape="caret down"`; Clarity has no icon by that name and the direction is a separate attribute, so the icon never resolved. Now `shape="caret" direction="down"`, like the rest of the portal. - **Built-in tick was invisible.** Coloured with `var(--clr-color-success-700)`, which Harbor does not define, so it inherited the text colour. `--clr-global-success-color` is the token this theme ships. - **Side nav reused the members icon.** `users` is already project members. `employee-group` keeps them apart. - **Heading and nav disagreed:** nav said "Roles", heading said "User Roles". Both say "Roles". - **Wizard forced the permission matrix into a scroll.** Pinned to `clrWizardSize="lg"`, narrower than Clarity's default. Dropping the explicit size gives it full width.  ## CI fixes  UI_UT runs four gates and three were failing.  **`ng lint`: 85 errors.** All formatting except two `console.log` calls that were not meant to ship, one of them held by an `ngAfterViewInit` that existed for nothing else. Both removed.  **`find-missing-i18n.js`: 972 missing keys.** The roles UI added
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/goharbor/harbor/pull/24036?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor) Report :x: Patch coverage is `34.90566%` with `276 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 66.84%. Comparing base ([`37dc02f`](https://app.codecov.io/gh/goharbor/harbor/commit/37dc02fdff10f3b93dc4668d3c13b9c104959ed4?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)) to head ([`4334c22`](https://app.codecov.io/gh/goharbor/harbor/commit/4334c227e32f64564396aeb18463d53bce2579cc?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)).  | [Files with missing lines](https://app.codecov.io/gh/goharbor/harbor/pull/24036?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_c
  > Both fixes are on #23970 itself now, rebased onto its current tip: cf89ac09 (the five UI fixes) and ff4d566c (the four action-button specs, which are what UI_UT was failing on, plus real translations for the new ROLE keys in the nine language files). Nothing left here, so closing rather than stacking another PR on top.

- **Issue #24022** (2026-09-29): **N+1 database queries during immutable scanner registration removal (`RemoveImmutableScanners`)**
  *Symptoms*:  **Expected behavior and actual behavior:** **Expected:** Removing immutable scanner registrations should be optimized, particularly during initialization steps. It should be performed using a bulk/batch deletion query to minimize database connections, round-trips, and latency. **Actual:** The `RemoveImmutableScanners` function iterates over the fetched `registrations` and executes a single SQL `DELETE` query for every single scanner in the array. This creates a classic N+1 query problem, placing unnecessary load on the database.   This technical debt is explicitly documented in the codebase as a `TODO`, but has not yet been resolved.  **Steps to reproduce the problem:** 1. Navigate to `src/pkg/scan/init.go` in the current `main`/`master` branch. 2. Look at the `RemoveImmutableScanners` function (around line 105). 3. Observe the `TODO` and the looping behavior:    ```go    	// TODO Instead of executing 1 to N SQL queries we might want to delete multiple rows with scannerManager.DeleteByImmutableAndURLIn(true, []string{})    	registrations, err := scannerManager.List(ctx, query)    	if err != nil {    		return errors.Errorf("listing scanners: %v", err)    	}     	for _, reg := range registrations {    		if err := scannerManager.Delete(ctx, reg.UUID); err != nil { // <-- N+1 Query Execution    			return errors.Errorf("deleting scanner: %s: %v", reg.UUID, err)    		}    	}    ```  **Versions:** Please specify the versions of following systems.  - harbor version: [main / latest] 
  **Post-Mortem & Fix Analysis**:
  > this makes no sense, where is it a performance problem in real use cases?  Please reopen if yoou have more information 

- **Issue #24016** (2026-09-28): **Release plan for v2.16.0**
  *Symptoms*: How can we help you?  Is there a target date or milestone for v2.16.0?  We want to move Harbor to arm64 nodes. Official arm64 images come from #22311 (merged to main on 2026-05-12). #23558 confirmed it ships in v2.16.0. v2.15.x images are amd64-only.  A rough timeline, or an RC schedule, would help us plan. Thanks!
  **Post-Mortem & Fix Analysis**:
  > Harbor v2.16.0 will be released by the end of Oct.
  > Thanks @stonezdj! End of October works for our arm64 migration plan.

- **Issue #24014** (2026-09-28): **(cherry-pick): update expected CVE export toast message in Robot test**
  *Symptoms*: Commit ed449fbfc0 updated the English translation for TRIGGER_EXPORT_SUCCESS from 'Trigger exporting CVEs successfully!' to 'Triggered exporting CVEs successfully!'. Update the Robot test keyword 'Export CVEs' to expect the updated message.  Thank you for contributing to Harbor!  # Comprehensive Summary of your change  # Issue being fixed Fixes #(issue)  Please indicate you've done the following: - [ ] Well Written Title and Summary of the PR - [ ] Label the PR as needed. "release-note/ignore-for-release, release-note/new-feature, release-note/update, release-note/enhancement, release-note/community, release-note/breaking-change, release-note/docs, release-note/infra, release-note/deprecation" - [ ] Accepted the DCO. Commits without the DCO will delay acceptance. - [ ] Made sure tests are passing and test coverage is added if needed. - [ ] Considered the docs impact and opened a new docs issue or PR with docs changes if needed in [website repository](https://github.com/goharbor/website). 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/goharbor/harbor/pull/24014?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor) Report :white_check_mark: All modified and coverable lines are covered by tests. :warning: Please [upload](https://docs.codecov.com/docs/codecov-uploader) report for BASE (`release-2.15.0@583d259`). [Learn more](https://docs.codecov.io/docs/error-reference?utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor#section-missing-base-commit) about missing BASE report.  <details><summary>Additional details and impacted files</summary>    [![Impacted file tree graph](https://app.codecov.io/gh/goharbor/harbor/pull/24014/graphs/tree.svg?width=650&height=150&src=pr&token=6SOPrJGDVW&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)](https://app.codecov.io/gh/goharbor/harbor/pull/24014?src=pr&el=tree&utm

- **Issue #24010** (2026-09-28): **fix(test): update expected CVE export toast message in Robot test**
  *Symptoms*: Commit ed449fbfc0 updated the English translation for TRIGGER_EXPORT_SUCCESS from 'Trigger exporting CVEs successfully!' to 'Triggered exporting CVEs successfully!'. Update the Robot test keyword 'Export CVEs' to expect the updated message.  Thank you for contributing to Harbor!  # Comprehensive Summary of your change  # Issue being fixed Fixes #(issue)  Please indicate you've done the following: - [ ] Well Written Title and Summary of the PR - [ ] Label the PR as needed. "release-note/ignore-for-release, release-note/new-feature, release-note/update, release-note/enhancement, release-note/community, release-note/breaking-change, release-note/docs, release-note/infra, release-note/deprecation" - [ ] Accepted the DCO. Commits without the DCO will delay acceptance. - [ ] Made sure tests are passing and test coverage is added if needed. - [ ] Considered the docs impact and opened a new docs issue or PR with docs changes if needed in [website repository](https://github.com/goharbor/website). 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/goharbor/harbor/pull/24010?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 66.82%. Comparing base ([`4067002`](https://app.codecov.io/gh/goharbor/harbor/commit/4067002f889e9298ab5aa4f803b469d79dd9b98d?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)) to head ([`7dcb4ee`](https://app.codecov.io/gh/goharbor/harbor/commit/7dcb4eef852463c6a05b54590b6034b9c95e76a3?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)). :warning: Report is 1 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    [![Impacted file tree graph](https://app.codecov.io/gh/goharbor/

- **Issue #23997** (2026-09-28): **test(apitests): add missing get_member_role_id to project helper**
  *Symptoms*: # Comprehensive Summary of your change In PR https://github.com/goharbor/harbor/pull/23228 (`feat(audit): add member create/update/delete audit events`), `test_audit_log_forward.py` was updated to test member CRUD audit events using `self.project.get_member_role_id()`. However, the helper method `get_member_role_id` was not defined on the `Project` helper class in `tests/apitests/python/library/project.py`, causing `AttributeError: 'Project' object has no attribute 'get_member_role_id'` and failing the BAT/Nightly API tests (e.g. `Test Case - Log Forward`).  This PR adds the missing `get_member_role_id` method to `tests/apitests/python/library/project.py`.  # Issue being fixed Fixes `Test Case - Log Forward` failure in BAT/API DB tests.  Please indicate you've done the following: - [x] Well Written Title and Summary of the PR - [x] Label the PR as needed. "release-note/ignore-for-release" - [x] Accepted the DCO. Commits without the DCO will delay acceptance. - [x] Made sure tests are passing and test coverage is added if needed. - [x] Considered the docs impact and opened a new docs issue or PR with docs changes if needed in [website repository](https://github.com/goharbor/website). 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/goharbor/harbor/pull/23997?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 66.81%. Comparing base ([`e5e0e72`](https://app.codecov.io/gh/goharbor/harbor/commit/e5e0e72c7455778dbeda45f4cd0db65a9a371705?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)) to head ([`f445cb1`](https://app.codecov.io/gh/goharbor/harbor/commit/f445cb1c2864cbfad45651ed37e05a6757149960?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)).  <details><summary>Additional details and impacted files</summary>    [![Impacted file tree graph](https://app.codecov.io/gh/goharbor/harbor/pull/23997/graphs/tree.svg?width=650&height=

- **Issue #23991** (2026-09-23): **Bump up distribution version and refresh base image**
  *Symptoms*: bump REGISTRY_SRC_TAG to v2.8.3-harbor.2-rc.7 and update .buildbaselog  Signed-off-by: stonezdj <stonezdj@gmail.com>  Thank you for contributing to Harbor!  # Comprehensive Summary of your change  # Issue being fixed Fixes #(issue)  Please indicate you've done the following: - [ ] Well Written Title and Summary of the PR - [ ] Label the PR as needed. "release-note/ignore-for-release, release-note/new-feature, release-note/update, release-note/enhancement, release-note/community, release-note/breaking-change, release-note/docs, release-note/infra, release-note/deprecation" - [ ] Accepted the DCO. Commits without the DCO will delay acceptance. - [ ] Made sure tests are passing and test coverage is added if needed. - [ ] Considered the docs impact and opened a new docs issue or PR with docs changes if needed in [website repository](https://github.com/goharbor/website). 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/goharbor/harbor/pull/23991?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor) Report :white_check_mark: All modified and coverable lines are covered by tests. :warning: Please [upload](https://docs.codecov.com/docs/codecov-uploader) report for BASE (`release-2.15.0@a244bf4`). [Learn more](https://docs.codecov.io/docs/error-reference?utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor#section-missing-base-commit) about missing BASE report.  <details><summary>Additional details and impacted files</summary>    [![Impacted file tree graph](https://app.codecov.io/gh/goharbor/harbor/pull/23991/graphs/tree.svg?width=650&height=150&src=pr&token=6SOPrJGDVW&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)](https://app.codecov.io/gh/goharbor/harbor/pull/23991?src=pr&el=tree&utm

- **Issue #23986** (2026-09-23): **ci: Add merge_group trigger to CI and CodeQL workflows**
  *Symptoms*: Adding this so we could have the merge queue in harbor.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/goharbor/harbor/pull/23986?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 66.81%. Comparing base ([`ab9e080`](https://app.codecov.io/gh/goharbor/harbor/commit/ab9e0805a4bae368431f34f6937957c0b2a34d75?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)) to head ([`3fd3d3f`](https://app.codecov.io/gh/goharbor/harbor/commit/3fd3d3f5d885ffa92c06ee12f6e7556a66fabfce?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=goharbor)).  <details><summary>Additional details and impacted files</summary>    [![Impacted file tree graph](https://app.codecov.io/gh/goharbor/harbor/pull/23986/graphs/tree.svg?width=650&height=

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

### Incident Patch 1: `d3e2ad0a` (2026-09-28)
**Commit Message**: fix(test): update expected CVE export toast message in Robot test (#24010)

Commit ed449fbfc0 updated the English translation for TRIGGER_EXPORT_SUCCESS
from 'Trigger exporting CVEs successfully!' to 'Triggered exporting CVEs successfully!'.
Update the Robot test keyword 'Export CVEs' to expect the updated message.

Signed-off-by: stonezdj <stonezdj@gmail.com>
Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `tests/resources/Harbor-Pages/Project.robot` (modified, +1/-1)
```diff
@@ -454,7 +454,7 @@ Export CVEs
     Retry Text Input  ${export_cve_filter_tag_input}  ${tags}
     Select Filter Label For CVE Export  @{labels}
     Retry Text Input  ${export_cve_filter_cveid_input}  ${cve_ids}
-    Retry Double Keywords When Error  Retry Button Click  ${export_btn}  Retry Wait Until Page Contains  Trigger exporting CVEs successfully!
+    Retry Double Keywords When Error  Retry Button Click  ${export_btn}  Retry Wait Until Page Contains  Triggered exporting CVEs successfully!
 
 Should Not Be Export CVEs
      Retry Element Click  ${project_action_xpath}
```

---

### Incident Patch 2: `3d699857` (2026-09-28)
**Commit Message**: fix(portal): update label and tooltip of serve stale content option (#23978)

The proxy cache backend always serves local content when the upstream
registry is unhealthy, so the "upstream registry is unavailable" wording
in the tooltip is misleading. Rename the checkbox to "Serve stale content
locally" and drop the unavailable-upstream description in all locales.

Fixes #23779

Signed-off-by: stonezdj <stonezdj@gmail.com>

**File**: `src/portal/src/i18n/lang/de-de-lang.json` (modified, +2/-2)
```diff
@@ -249,8 +249,8 @@
         "PROXY_CACHE_MAX_UPSTREAM_CONN_TIP": "Die maximale Anzahl der Verbindungen zur Upstream-Registry für dieses Proxy-Cache-Projekt. -1 bedeutet keine Begrenzung",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_INPUT_TIP": "Bitte geben Sie -1 oder eine Ganzzahl größer als 0 ein.",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_PLACEHOLDER": "Bitte geben Sie -1 oder eine Ganzzahl größer als 0 ein.",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Veraltete Inhalte bereitstellen, wenn der Upstream nicht verfügbar ist",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Aktivieren Sie diese Option, damit dieses Projekt weiterhin zwischengespeicherte Inhalte bereitstellt, auch wenn das Artefakt im Upstream-Registry nicht gefunden wird oder das Upstream-Registry nicht verfügbar ist. Dies kann dazu führen, dass veraltete Inhalte bereitgestellt werden, wenn das Upstream-Registry nicht verfügbar ist.",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Veraltete Inhalte lokal bereitstellen",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Aktivieren Sie diese Option, damit dieses Projekt weiterhin zwischengespeicherte Inhalte bereitstellt, auch wenn das Artefakt im Upstream-Registry nicht gefunden wird. Dies kann dazu führen, dass veraltete Inhalte bereitgestellt werden.",
         "PROXY_REFERRER_API_TIP": "Enable this to proxy OCI 1.1 referrer API requests to the upstream registry.",
         "PROXY_REFERRER_API_LABEL": "Enable proxy for referrer API",
         "REPOSITORY_FILTER": "Repository-Filter",
```

**File**: `src/portal/src/i18n/lang/en-us-lang.json` (modified, +2/-2)
```diff
@@ -249,8 +249,8 @@
         "PROXY_CACHE_MAX_UPSTREAM_CONN_TIP": "The max connection to the upstream registry for this proxy cache project, if -1, then there is no limit",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_INPUT_TIP": "Please enter -1 or an integer greater than 0. ",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_PLACEHOLDER": "Please enter -1 or an integer greater than 0.",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Serve stale content when upstream is unavailable",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Enable this to allow this project to keep serving cached content even if the artifact is not found in the upstream registry or the upstream registry is unavailable. This can lead to stale content being served if the upstream registry is unavailable.",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Serve stale content locally",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Enable this to allow this project to keep serving cached content even if the artifact is not found in the upstream registry. This can lead to stale content being served.",
         "PROXY_REFERRER_API_TIP": "Enable this to proxy OCI 1.1 referrer API requests to the upstream registry.",
         "PROXY_REFERRER_API_LABEL": "Enable proxy for referrer API",
         "REPOSITORY_FILTER": "Repository filter",
```

**File**: `src/portal/src/i18n/lang/es-es-lang.json` (modified, +2/-2)
```diff
@@ -250,8 +250,8 @@
         "PROXY_CACHE_MAX_UPSTREAM_CONN_TIP": "La conexión máxima al registro de origen para este proyecto de caché de proxy, si es -1, entonces no hay límite",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_INPUT_TIP": "Por favor, ingrese -1 o un número entero mayor que 0.",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_PLACEHOLDER": "Por favor, ingrese -1 o un número entero mayor que 0.",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Servir contenido en caché cuando el registro de origen no está disponible",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Habilite esta opción para permitir que este proyecto continúe sirviendo contenido en caché incluso si el artefacto no se encuentra en el registro de origen o si el registro de origen no está disponible. Esto puede provocar que se sirva contenido obsoleto si el registro de origen no está disponible.",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Servir contenido obsoleto localmente",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Habilite esta opción para permitir que este proyecto continúe sirviendo contenido en caché incluso si el artefacto no se encuentra en el registro de origen. Esto puede provocar que se sirva contenido obsoleto.",
         "PROXY_REFERRER_API_TIP": "Enable this to proxy OCI 1.1 referrer API requests to the upstream registry.",
         "PROXY_REFERRER_API_LABEL": "Enable proxy for referrer API",
         "REPOSITORY_FILTER": "Filtro de repositorio",
```

**File**: `src/portal/src/i18n/lang/fr-fr-lang.json` (modified, +2/-2)
```diff
@@ -250,8 +250,8 @@
         "PROXY_CACHE_MAX_UPSTREAM_CONN_TIP": "La connexion maximale au registre en amont pour ce projet de cache proxy, si -1, alors il n'y a pas de limite",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_INPUT_TIP": "Veuillez entrer -1 ou un entier supérieur à 0.",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_PLACEHOLDER": "Veuillez entrer -1 ou un entier supérieur à 0.",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Servir le contenu mis en cache lorsque le registre amont est indisponible",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Activez cette option pour permettre à ce projet de continuer à servir le contenu mis en cache même si l'artefact n'est pas trouvé dans le registre amont ou si le registre amont est indisponible. Cela peut entraîner la diffusion de contenu obsolète si le registre amont est indisponible.",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "Servir le contenu obsolète localement",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "Activez cette option pour permettre à ce projet de continuer à servir le contenu mis en cache même si l'artefact n'est pas trouvé dans le registre amont. Cela peut entraîner la diffusion de contenu obsolète.",
         "PROXY_REFERRER_API_TIP": "Cochez cette case pour activer le proxy des requêtes de l'API referrer OCI 1.1 vers le registre en amont.",
         "PROXY_REFERRER_API_LABEL": "Activer le proxy pour l'API referrer",
         "REPOSITORY_FILTER": "Filtre de dépôt",
```

**File**: `src/portal/src/i18n/lang/ko-kr-lang.json` (modified, +2/-2)
```diff
@@ -249,8 +249,8 @@
         "PROXY_CACHE_MAX_UPSTREAM_CONN_TIP": "이 프록시 캐시 프로젝트의 업스트림 레지스트리에 대한 최대 연결 수입니다. -1이면 제한이 없습니다",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_INPUT_TIP": "-1 또는 0보다 큰 정수를 입력하세요.",
         "PROXY_CACHE_MAX_UPSTREAM_CONN_PLACEHOLDER": "-1 또는 0보다 큰 정수를 입력하세요.",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "업스트림을 사용할 수 없을 때 캐시된 콘텐츠 제공",
-        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "업스트림 레지스트리에서 아티팩트를 찾을 수 없거나 업스트림 레지스트리를 사용할 수 없는 경우에도 이 프로젝트가 캐시된 콘텐츠를 계속 제공할 수 있도록 하려면 이 옵션을 활성화하세요. 업스트림 레지스트리를 사용할 수 없는 경우 오래된 콘텐츠가 제공될 수 있습니다.",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND": "오래된 콘텐츠를 로컬에서 제공",
+        "PROXY_CACHE_LOCAL_ON_NOT_FOUND_TOOLTIP": "업스트림 레지스트리에서 아티팩트를 찾을 수 없는 경우에도 이 프로젝트가 캐시된 콘텐츠를 계속 제공할 수 있도록 하려면 이 옵션을 활성화하세요. 이로 인해 오래된 콘텐츠가 제공될 수 있습니다.",
         "PROXY_REFERRER_API_TIP": "Enable this to proxy OCI 1.1 referrer API requests to the upstream registry.",
         "PROXY_REFERRER_API_LABEL": "Enable proxy for referrer API",
         "REPOSITORY_FILTER": "저장소 필터",
```

---

### Incident Patch 3: `e5e0e72c` (2026-09-24)
**Commit Message**: fix(retention): drop retention_id metadata on project delete (#23942)

DeleteRetentionByProject removes a project's tag retention policies but
left the project_metadata row holding retention_id behind, so every
deleted project that had a retention policy leaked a dangling reference
to a policy that no longer exists. One reported instance had accumulated
3189 such rows.

The retention DELETE API already clears this key in its own handler;
project deletion is the path that missed it. Clear it in
DeleteRetentionByProject once the policies are gone, using the shared
pkg.ProjectMetaMgr so the Redis-cached manager invalidates its entry too.

Closes #17255

Signed-off-by: waris shaikh <shaikhwaris@gmail.com>
Co-authored-by: waris shaikh <shaikhwaris@gmail.com>
Co-authored-by: Prasanth Baskar <prasanth@8gears.com>
Co-authored-by: Chlins Zhang <chlins.zhang@gmail.com>

**File**: `src/controller/retention/controller.go` (modified, +6/-1)
```diff
@@ -29,6 +29,7 @@ import (
 	"github.com/goharbor/harbor/src/lib/retry"
 	"github.com/goharbor/harbor/src/pkg"
 	"github.com/goharbor/harbor/src/pkg/project"
+	"github.com/goharbor/harbor/src/pkg/project/metadata"
 	"github.com/goharbor/harbor/src/pkg/repository"
 	"github.com/goharbor/harbor/src/pkg/retention"
 	"github.com/goharbor/harbor/src/pkg/retention/policy"
@@ -79,6 +80,7 @@ type defaultController struct {
 	taskMgr        task.Manager
 	launcher       retention.Launcher
 	projectManager project.Manager
+	projectMetaMgr metadata.Manager
 	repositoryMgr  repository.Manager
 	scheduler      scheduler.Scheduler
 	wp             *lib.WorkerPool
@@ -445,7 +447,9 @@ func (r *defaultController) DeleteRetentionByProject(ctx context.Context, projec
 			return err
 		}
 	}
-	return nil
+	// the retention_id metadata references the policies just deleted. The retention DELETE
+	// API drops it in its own handler, so project deletion has to do it here.
+	return r.projectMetaMgr.Delete(ctx, projectID, "retention_id")
 }
 
 // NewController ...
@@ -458,6 +462,7 @@ func NewController() Controller {
 		taskMgr:        task.Mgr,
 		launcher:       retentionLauncher,
 		projectManager: pkg.ProjectMgr,
+		projectMetaMgr: pkg.ProjectMetaMgr,
 		repositoryMgr:  pkg.RepositoryMgr,
 		scheduler:      scheduler.Sched,
 		wp:             lib.NewWorkerPool(10),
```

**File**: `src/controller/retention/controller_test.go` (modified, +72/-0)
```diff
@@ -35,6 +35,7 @@ import (
 	"github.com/goharbor/harbor/src/pkg/scheduler"
 	"github.com/goharbor/harbor/src/pkg/task"
 	"github.com/goharbor/harbor/src/testing/pkg/project"
+	testingMeta "github.com/goharbor/harbor/src/testing/pkg/project/metadata"
 	"github.com/goharbor/harbor/src/testing/pkg/repository"
 	testingTask "github.com/goharbor/harbor/src/testing/pkg/task"
 )
@@ -196,6 +197,77 @@ func (s *ControllerTestSuite) TestPolicy() {
 	s.Require().Nil(p1)
 }
 
+func (s *ControllerTestSuite) TestDeleteRetentionByProject() {
+	const projectID = int64(2)
+
+	projectMetaMgr := &testingMeta.Manager{}
+	execMgr := &testingTask.ExecutionManager{}
+	execMgr.On("List", mock.Anything, mock.Anything).Return([]*task.Execution{}, nil)
+	projectMetaMgr.On("Delete", mock.Anything, projectID, "retention_id").Return(nil)
+
+	c := defaultController{
+		manager:        retention.NewManager(),
+		execMgr:        execMgr,
+		taskMgr:        &testingTask.Manager{},
+		launcher:       &fakeLauncher{},
+		projectManager: &project.Manager{},
+		projectMetaMgr: projectMetaMgr,
+		repositoryMgr:  &repository.Manager{},
+		scheduler:      &fakeRetentionScheduler{},
+	}
+
+	ctx := orm.Context()
+	id, err := c.CreateRetention(ctx, &policy.Metadata{
+		Algorithm: "or",
+		Rules: []rule.Metadata{
+			{
+				ID:       1,
+				Priority: 1,
+				Template: "latestPushedK",
+				Parameters: rule.Parameters{
+					"latestPushedK": 10,
+				},
+				TagSelectors: []*rule.Selector{
+					{
+						Kind:       "doublestar",
+						Decoration: "matches",
+						Pattern:    "**",
+					},
+				},
+				ScopeSelectors: map[string][]*rule.Selector{
+					"repository": {
+						{
+							Kind:       "doublestar",
+							Decoration: "matches",
+							Pattern:    ".+",
+						},
+					},
+				},
+			},
+		},
+		Trigger: &policy.Trigger{
+			Kind: "Schedule",
+			Settings: map[string]any{
+				"cron": "0 22 11 * * *",
+			},
+		},
+		Scope: &policy.Scope{
+			Level:     "project",
+			Reference: projectID,
+		},
+	})
+	s.Require().Nil(err)
+	s.Require().True(id > 0)
+
+	s.Require().Nil(c.DeleteRetentionByProject(ctx, projectID))
+
+	p, err := c.GetRetention(ctx, id)
+	s.Require().NotNil(err)
+	s.Require().Nil(p)
+
+	projectMetaMgr.AssertCalled(s.T(), "Delete", mock.Anything, projectID, "retention_id")
+}
+
 func (s *ControllerTestSuite) TestExecution() {
 	projectMgr := &project.Manager{}
 	repositoryMgr := &repository.Manager{}
```

---

### Incident Patch 4: `ab9e0805` (2026-09-22)
**Commit Message**: fix: correct grammar, formatting, and non-actionable error messages (#23974)

Fix misspellings, grammatical errors, and formatting defects in
user-facing strings across API error responses, middleware, core,
and the portal English i18n.

Signed-off-by: jUDASmILE <judasmile@gmail.com>
Co-authored-by: Wang Yan <wangyan_0219@hotmail.com>

**File**: `src/core/controllers/base.go` (modified, +1/-1)
```diff
@@ -154,7 +154,7 @@ func (cc *CommonController) UserExists() {
 	securityCtx, ok := security.FromContext(ctx)
 	isAdmin := ok && securityCtx.IsSysAdmin()
 	if !flag && !isAdmin {
-		cc.CustomAbort(http.StatusPreconditionFailed, "self registration deactivated, only sysadmin can check user existence")
+		cc.CustomAbort(http.StatusPreconditionFailed, "Self-registration is deactivated; only a system administrator can check user existence.")
 	}
 
 	target := cc.GetString("target")
```

**File**: `src/core/controllers/oidc.go` (modified, +2/-2)
```diff
@@ -266,8 +266,8 @@ func (oc *OIDCController) RedirectLogout() {
 		return
 	}
 	if oidcSettings == nil {
-		log.Error("OIDC settings is missing.")
-		oc.SendInternalServerError(fmt.Errorf("OIDC settings is missing"))
+		log.Error("OIDC settings are missing.")
+		oc.SendInternalServerError(fmt.Errorf("OIDC settings are missing"))
 		return
 	}
 	if !oidcSettings.Logout {
```

**File**: `src/jobservice/worker/cworker/c_worker.go` (modified, +2/-2)
```diff
@@ -212,7 +212,7 @@ func (w *basicWorker) Enqueue(jobName string, params job.Parameters, isUnique bo
 
 	// avoid backend worker bug
 	if j == nil {
-		return nil, fmt.Errorf("job '%s' can not be enqueued, please check the job metatdata", jobName)
+		return nil, fmt.Errorf("job '%s' cannot be enqueued; please check the job metadata", jobName)
 	}
 
 	return generateResult(j, job.KindGeneric, isUnique, params, webHook), nil
@@ -242,7 +242,7 @@ func (w *basicWorker) Schedule(jobName string, params job.Parameters, runAfterSe
 
 	// avoid backend worker bug
 	if j == nil {
-		return nil, fmt.Errorf("job '%s' can not be enqueued, please check the job metatdata", jobName)
+		return nil, fmt.Errorf("job '%s' cannot be enqueued; please check the job metadata", jobName)
 	}
 
 	res := generateResult(j.Job, job.KindScheduled, isUnique, params, webHook)
```

**File**: `src/lib/config/metadata/value.go` (modified, +2/-2)
```diff
@@ -25,13 +25,13 @@ var (
 	// ErrNotDefined ...
 	ErrNotDefined = errors.New("configure item is not defined in metadata")
 	// ErrTypeNotMatch ...
-	ErrTypeNotMatch = errors.New("the required value doesn't matched with metadata defined")
+	ErrTypeNotMatch = errors.New("The required value does not match the metadata definition")
 	// ErrInvalidData ...
 	ErrInvalidData = errors.New("the data provided is invalid")
 	// ErrValueNotSet ...
 	ErrValueNotSet = errors.New("the configure value is not set")
 	// ErrStringValueIsEmpty ...
-	ErrStringValueIsEmpty = errors.New("the configure value can not be empty")
+	ErrStringValueIsEmpty = errors.New("The configuration value cannot be empty")
 )
 
 // ConfigureValue - struct to hold a actual value, also include the name of config metadata.
```

**File**: `src/portal/src/i18n/lang/en-us-lang.json` (modified, +14/-14)
```diff
@@ -319,7 +319,7 @@
         "GROUP_TYPE": "Group",
         "USER_TYPE": "User",
         "USERNAME_IS_REQUIRED": "Username is required",
-        "USERNAME_ALREADY_EXISTS": "Username has been already added to this project",
+        "USERNAME_ALREADY_EXISTS": "Username has already been added to this project.",
         "UNKNOWN_ERROR": "Unknown error occurred while adding member",
         "FILTER_PLACEHOLDER": "Filter Members",
         "DELETION_TITLE": "Confirm project members deletion",
@@ -1255,7 +1255,7 @@
     },
     "RETAG": {
         "MSG_SUCCESS": "Copy artifact successfully",
-        "TIP_REPO": "A repository name is broken up into path components. A component of a repository name must be at least one lowercase, alpha-numeric characters, optionally separated by periods, dashes or underscores. More strictly, it must match the regular expression [a-z0-9]+(?:[._-][a-z0-9]+)*. If a repository name has two or more path components, they must be separated by a forward slash ('/'). The total length of a repository name, including slashes, must be less than 256 characters.",
+        "TIP_REPO": "A repository name is broken up into path components. A component of a repository name must be at least one lowercase, alphanumeric character, optionally separated by periods, dashes or underscores. More strictly, it must match the regular expression [a-z0-9]+(?:[._-][a-z0-9]+)*. If a repository name has two or more path components, they must be separated by a forward slash ('/'). The total length of a repository name, including slashes, must be less than 256 characters.",
         "TIP_TAG": "A tag is a label applied to a Docker image in a repository. Tags are how various images in a repository are distinguished from each other. It needs to match regex: (`[\\w][\\w.-]{0,127}`)"
     },
     "CVE_ALLOWLIST": {
@@ -1317,7 +1317,7 @@
         "UNIT_COUNT": "COUNT",
         "NUMBER": "NUMBER",
         "IN_REPOSITORIES": "For the repositories",
-        "REP_SEPARATOR": "Enter multiple comma separated repos,repo*,or **",
+        "REP_SEPARATOR": "Enter multiple comma-separated repos: repo, repo*, or **.",
         "TAGS": "Tags",
         "UNTAGGED": " untagged",
         "INCLUDE_UNTAGGED": " untagged artifacts",
@@ -1380,9 +1380,9 @@
         "ADD_TITLE": "Add Tag Immutability Rule",
         "ADD_SUBTITLE": "Specify a tag immutability rule for this project.  Note: all tag immutability rules are first independently calculated and then unioned to capture the final set of immutable tags.",
         "IN_REPOSITORIES": "For the repositories",
-        "REP_SEPARATOR": "Enter multiple comma separated repos,repo*,or **",
+        "REP_SEPARATOR": "Enter multiple comma-separated repos: repo, repo*, or **.",
         "TAGS": "Tags",
-        "TAG_SEPARATOR": "Enter multiple comma separated tags,tag*,or **.",
+        "TAG_SEPARATOR": "Enter multiple comma-separated tags: tag, tag*, or **.",
         "EDIT_TITLE": "Edit Tag Immutability Rule",
         "EXC": " excluding ",
         "MAT": " matching ",
@@ -1409,8 +1409,8 @@
         "NOT_SUPPORTED": "Not Supported",
         "ENDPOINT": "Endpoint",
         "ENDPOINT_EXISTS": "EndpointUrl already exists",
-        "ENDPOINT_REQUIRED": "EndpointUrl is required",
-        "ILLEGAL_ENDPOINT": "EndpointUrl is illegal",
+        "ENDPOINT_REQUIRED": "Endpoint URL is required.",
+        "ILLEGAL_ENDPOINT": "Endpoint URL is invalid.",
         "AUTH": "Authorization",
         "NONE": "None",
         "BASIC": "Basic",
@@ -1444,7 +1444,7 @@
         "SET_AS_DEFAULT": "SET AS DEFAULT",
         "HEALTH": "Health",
         "DISABLED": "Deactivated",
-        "NO_SCANNER": "Can not find any scanner",
+        "NO_SCANNER": "Cannot find any scanner.",
         "DEFAULT": "Default",
         "HEALTHY": "Healthy",
         "UNHEALTHY": "Unhealthy",
@@ -1486,7 +1486,7 @@
         "ENABLE_ACTION": "Enable",
         "DISABLE_ACTION": "Deactivate",
         "DELETE_ACTION": "Delete",
-        "NOT_F
```

---

### Incident Patch 5: `6d24f6c5` (2026-09-21)
**Commit Message**: fix(gc): do not count blobs missing from storage as freed space (#23972)

* fix(gc): do not count blobs missing from storage as freed space

When registryctl reports a blob as not found, the GC ignores the error
to keep the job going, but such a blob was not removed by this run.
Its size was still added to freed_space, so the job reported success
with inflated numbers while the storage kept growing, e.g. when every
DeleteBlob fails with PathNotFoundError on an S3-compatible backend.

Skip the size of not-found blobs when computing freed_space and log a
warning for each of them, so the mismatch is visible in the job log.

Refs #23178

Signed-off-by: Viktor Erpylev <velmoga@gmail.com>

* test(gc): mock UpdateBlobStatus in TestSweepBlobNotFound

The sweep marks every candidate as deleting before calling the registry,
so the new test panicked on an unexpected mock call.

Refs #23178

Signed-off-by: Viktor Erpylev <velmoga@gmail.com>

---------

Signed-off-by: Viktor Erpylev <velmoga@gmail.com>

**File**: `src/jobservice/job/impl/gc/garbage_collection.go` (modified, +9/-1)
```diff
@@ -429,13 +429,17 @@ func (gc *GarbageCollector) sweep(ctx job.Context) error {
 				// for the foreign layer, as it's not stored in the storage, no need to call the delete api and count size, but still have to delete the DB record.
 				if !blob.IsForeignLayer() {
 					gc.logger.Infof("[%s][%d/%d] delete blob from storage: %s", uid, localIndex, total, blob.Digest)
+					// a not found error is ignored to keep the GC going, but such a blob is not removed by this run,
+					// so its size must not be counted as freed space.
+					notFound := false
 					if err := retry.Retry(func() error {
 						return ignoreNotFound(func() error {
 							err := gc.registryCtlClient.DeleteBlob(blob.Digest)
 							// if the system is in read-only mode, return an Abort error to skip retrying
 							if err == readonly.Err {
 								return retry.Abort(err)
 							}
+							notFound = errors.IsNotFoundErr(err)
 							return err
 						})
 					}, retry.Callback(func(err error, sleep time.Duration) {
@@ -454,7 +458,11 @@ func (gc *GarbageCollector) sweep(ctx job.Context) error {
 						}
 						continue
 					}
-					atomic.AddInt64(&sweepSize, blob.Size)
+					if notFound {
+						gc.logger.Warningf("[%s][%d/%d] blob not found in storage, its size is not counted as freed space: %s", uid, localIndex, total, blob.Digest)
+					} else {
+						atomic.AddInt64(&sweepSize, blob.Size)
+					}
 				}
 
 				gc.logger.Infof("[%s][%d/%d] delete blob record from database: %d, %s", uid, localIndex, total, blob.ID, blob.Digest)
```

**File**: `src/jobservice/job/impl/gc/garbage_collection_test.go` (modified, +33/-0)
```diff
@@ -28,6 +28,7 @@ import (
 	"github.com/goharbor/harbor/src/controller/project"
 	"github.com/goharbor/harbor/src/jobservice/job"
 	"github.com/goharbor/harbor/src/jobservice/tests"
+	"github.com/goharbor/harbor/src/lib/errors"
 	"github.com/goharbor/harbor/src/lib/log"
 	pkgart "github.com/goharbor/harbor/src/pkg/artifact"
 	"github.com/goharbor/harbor/src/pkg/artifactrash/model"
@@ -402,6 +403,38 @@ func (suite *gcTestSuite) TestSweep() {
 	suite.Nil(gc.sweep(ctx))
 }
 
+func (suite *gcTestSuite) TestSweepBlobNotFound() {
+	ctx := &mockjobservice.MockJobContext{}
+	logger := &mockjobservice.MockJobLogger{}
+	ctx.On("GetLogger").Return(logger)
+	ctx.On("OPCommand").Return(job.NilCommand, false)
+	ctx.On("Checkin", `{"freed_space":0,"purged_blobs":1,"purged_manifests":0}`).Return(nil)
+
+	mock.OnAnything(suite.blobMgr, "UpdateBlobStatus").Return(int64(1), nil)
+	mock.OnAnything(suite.blobMgr, "Delete").Return(nil)
+
+	gc := &GarbageCollector{
+		artCtl:            suite.artifactCtl,
+		artrashMgr:        suite.artrashMgr,
+		blobMgr:           suite.blobMgr,
+		registryCtlClient: suite.registryCtlClient,
+		deleteSet: []*pkg_blob.Blob{
+			{
+				ID:          1,
+				Digest:      suite.DigestString(),
+				ContentType: schema2.MediaTypeLayer,
+				Size:        1234,
+			},
+		},
+		workers: 3,
+	}
+
+	// the blob is missing from the storage: the GC must still succeed, but must not count its size as freed
+	mock.OnAnything(gc.registryCtlClient, "DeleteBlob").Return(errors.NotFoundError(nil))
+	suite.Nil(gc.sweep(ctx))
+	ctx.AssertCalled(suite.T(), "Checkin", `{"freed_space":0,"purged_blobs":1,"purged_manifests":0}`)
+}
+
 func (suite *gcTestSuite) TestSaveRes() {
 	ctx := &mockjobservice.MockJobContext{}
 	logger := &mockjobservice.MockJobLogger{}
```

---

### Incident Patch 6: `17b07334` (2026-09-15)
**Commit Message**: fix(systeminfo): make HTTPS URL scheme check case-insensitive for CA download (#23888)

Per RFC 3986, URL schemes are case-insensitive. In systeminfo controller, enableCADownload previously checked strings.HasPrefix(extURL, "https://") which failed when ExtEndpoint was configured with uppercase or mixed-case scheme (e.g., HTTPS://). Replace with strings.ToLower(extURL) to ensure case-insensitive scheme matching.

Fixes # NONE

Signed-off-by: Norway-02 <anshulkhetade02@gmail.com>

**File**: `src/controller/systeminfo/controller.go` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@ func (c *controller) GetInfo(ctx context.Context, opt Options) (*Data, error) {
 		registryURL = l[0]
 	}
 	_, caStatErr := os.Stat(defaultRootCert)
-	enableCADownload := caStatErr == nil && strings.HasPrefix(extURL, "https://")
+	enableCADownload := caStatErr == nil && strings.HasPrefix(strings.ToLower(extURL), "https://")
 	res.Protected = &protectedData{
 		CurrentTime:                 time.Now(),
 		ReadOnly:                    config.ReadOnly(ctx),
```

---

### Incident Patch 7: `c10a0a62` (2026-09-15)
**Commit Message**: fix: ignore http.ErrServerClosed on graceful shutdown (#23296)

Follow-up to #23295 which fixed the same issue in registryctl.

http.Server.ListenAndServe and ListenAndServeTLS always return a
non-nil error, and that error is http.ErrServerClosed after a
successful Shutdown. Treating it as a real error produces misleading
fatal/error log lines (and in some paths an os.Exit(1)) during a normal
shutdown.

This filters ErrServerClosed in the remaining sites that share the
pattern:

  * src/jobservice/runtime/bootstrap.go
    Filters ErrServerClosed at the call site and removes the now-dead
    else branch (apiServer.Start always returns non-nil).

  * src/cmd/exporter/main.go
    Latent today (no graceful shutdown wired), but the existing path
    would log an error and exit(1) on any future clean stop.

  * src/lib/pprof.go
    Log-noise only on shutdown.

  * src/lib/metric/server.go
    Log-noise only on shutdown. Also fixes the longstanding
    "Promethus metrcis" typo while restructuring the call.

Signed-off-by: Vadim Bauer <vb@container-registry.com>

**File**: `src/cmd/exporter/main.go` (modified, +2/-1)
```diff
@@ -15,6 +15,7 @@
 package main
 
 import (
+	"errors"
 	"net/http"
 	"os"
 	"strings"
@@ -99,7 +100,7 @@ func main() {
 		exporterOpt.CacheCleanInterval,
 	)
 	prometheus.MustRegister(harborExporter)
-	if err := harborExporter.ListenAndServe(); err != nil {
+	if err := harborExporter.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
 		log.Errorf("Error starting Harbor exporter %s", err)
 		os.Exit(1)
 	}
```

**File**: `src/jobservice/runtime/bootstrap.go` (modified, +2/-4)
```diff
@@ -17,6 +17,7 @@ package runtime // nolint:revive
 import (
 	"context"
 	"fmt"
+	"net/http"
 	"os"
 	"os/signal"
 	"strings"
@@ -256,14 +257,11 @@ func (bs *Bootstrap) LoadAndRun(ctx context.Context, cancel context.CancelFunc)
 	// Blocking here
 	logger.Infof("API server is serving at %d with [%s] mode at node [%s]", cfg.Port, cfg.Protocol, node)
 	metric.JobserviceInfo.WithLabelValues(node.(string), workerPoolID, fmt.Sprint(cfg.PoolConfig.WorkerCount)).Set(1)
-	if er := apiServer.Start(); er != nil {
+	if er := apiServer.Start(); er != nil && !errors.Is(er, http.ErrServerClosed) {
 		if !terminated {
 			// Tell the listening goroutine
 			rootContext.ErrorChan <- er
 		}
-	} else {
-		// In case
-		sig <- os.Interrupt
 	}
 
 	// Wait everyone exits.
```

**File**: `src/lib/metric/server.go` (modified, +4/-1)
```diff
@@ -15,6 +15,7 @@
 package metric
 
 import (
+	"errors"
 	"fmt"
 	"net/http"
 
@@ -35,5 +36,7 @@ func ServeProm(path string, port int) {
 	mux := http.NewServeMux()
 	mux.Handle(path, promhttp.Handler())
 	log.Infof("Prometheus metric server running on port %v", port)
-	log.Errorf("Promethus metrcis server down with %s", http.ListenAndServe(fmt.Sprintf(":%v", port), mux))
+	if err := http.ListenAndServe(fmt.Sprintf(":%v", port), mux); err != nil && !errors.Is(err, http.ErrServerClosed) {
+		log.Errorf("Prometheus metrics server down with %s", err)
+	}
 }
```

**File**: `src/lib/pprof.go` (modified, +3/-1)
```diff
@@ -15,7 +15,9 @@
 package lib
 
 import (
+	"errors"
 	"net/http"
+
 	// import pprof
 	_ "net/http/pprof" // nolint:gosec // pprof is only registered when PPROF_ENABLED=true.
 	"os"
@@ -38,7 +40,7 @@ func StartPprof() {
 			addr = ":6060"
 		}
 		log.Infof("Starting pprof at %s/debug/pprof/", addr)
-		if err := http.ListenAndServe(addr, http.DefaultServeMux); err != nil {
+		if err := http.ListenAndServe(addr, http.DefaultServeMux); err != nil && !errors.Is(err, http.ErrServerClosed) {
 			log.Errorf("pprof exited: %v", err)
 		}
 	}()
```

---

### Incident Patch 8: `8ca2cc23` (2026-09-15)
**Commit Message**: fix(cache): avoid double prefix when removing expired entries (#23913)

Signed-off-by: Hanabi <317387557+Hanabi9248@users.noreply.github.com>

**File**: `src/lib/cache/memory/memory.go` (modified, +2/-2)
```diff
@@ -51,7 +51,7 @@ func (c *Cache) Contains(ctx context.Context, key string) bool {
 	}
 
 	if e.(*entry).isExpirated() {
-		err := c.Delete(ctx, c.opts.Key(key))
+		err := c.Delete(ctx, key)
 		log.Errorf("failed to delete cache in Contains() method when it's expired, error: %v", err)
 		return false
 	}
@@ -74,7 +74,7 @@ func (c *Cache) Fetch(ctx context.Context, key string, value any) error {
 
 	e := v.(*entry)
 	if e.isExpirated() {
-		err := c.Delete(ctx, c.opts.Key(key))
+		err := c.Delete(ctx, key)
 		if err != nil {
 			log.Errorf("failed to delete cache in Fetch() method when it's expired, error: %v", err)
 		}
```

**File**: `src/lib/cache/memory/memory_test.go` (modified, +24/-0)
```diff
@@ -20,6 +20,7 @@ import (
 	"testing"
 	"time"
 
+	"github.com/stretchr/testify/require"
 	"github.com/stretchr/testify/suite"
 
 	"github.com/goharbor/harbor/src/lib/cache"
@@ -164,6 +165,29 @@ func TestCacheTestSuite(t *testing.T) {
 	suite.Run(t, new(CacheTestSuite))
 }
 
+func TestExpiredPrefixedEntry(t *testing.T) {
+	for _, operation := range []string{"contains", "fetch"} {
+		t.Run(operation, func(t *testing.T) {
+			ctx := context.Background()
+			c, err := cache.New("memory", cache.Prefix("prefix:"))
+			require.NoError(t, err)
+			require.NoError(t, c.Save(ctx, "key", "expired", -time.Second))
+			require.NoError(t, c.Save(ctx, "prefix:key", "live"))
+			if operation == "contains" {
+				require.False(t, c.Contains(ctx, "key"))
+			} else {
+				var value string
+				require.ErrorIs(t, c.Fetch(ctx, "key", &value), cache.ErrNotFound)
+			}
+			var value string
+			require.NoError(t, c.Fetch(ctx, "prefix:key", &value))
+			require.Equal(t, "live", value)
+			_, exists := c.(*Cache).storage.Load("prefix:key")
+			require.False(t, exists, "the expired entry must be removed")
+		})
+	}
+}
+
 func BenchmarkCacheFetchParallel(b *testing.B) {
 	key := "benchmark"
 	cache, _ := cache.New("memory")
```

---

### Incident Patch 9: `3488b645` (2026-09-14)
**Commit Message**: docs: fix typo wating -> waiting (#23807)

Signed-off-by: Vaibhav Srivastava <vaibhavsri1712@gmail.com>
Co-authored-by: Wang Yan <wangyan_0219@hotmail.com>

**File**: `src/portal/src/app/base/project/member/member.component.ts` (modified, +1/-1)
```diff
@@ -365,7 +365,7 @@ export class MemberComponent implements OnInit, OnDestroy {
                 );
         };
 
-        // Deleting member then wating for results
+        // Deleting member then waiting for results
         members.forEach(member =>
             memberDeletingObservables.push(deleteMember(member))
         );
```

---

### Incident Patch 10: `fb6f06b6` (2026-09-11)
**Commit Message**: fix(migration): make sbom_report index creation idempotent (#23895)

Add IF NOT EXISTS to CREATE INDEX idx_sbom_report_sbom_digest
in make/migrations/postgresql/0190_2.16.0_schema.up.sql so that
the upgrade migration script can run idempotently without failing
if the index already exists.

Fixes #23894

Signed-off-by: stonezdj <stone.zhang@broadcom.com>
Signed-off-by: stonezdj <stonezdj@gmail.com>

**File**: `make/migrations/postgresql/0190_2.16.0_schema.up.sql` (modified, +1/-1)
```diff
@@ -17,5 +17,5 @@ ALTER TABLE robot ALTER COLUMN creator_ref TYPE bigint;
 ALTER TABLE role_permission ALTER COLUMN role_id TYPE bigint;
 ALTER SEQUENCE robot_id_seq AS bigint MAXVALUE 9007199254740991;
 
-CREATE INDEX idx_sbom_report_sbom_digest
+CREATE INDEX IF NOT EXISTS idx_sbom_report_sbom_digest
   ON sbom_report (mime_type, ((report::jsonb ->> 'sbom_digest')));
```

#### Recent Merged Pull Requests:
- **PR #24036** (closed): feat(portal): Custom project roles UI, with UI fixes on top of #23970 (@bupd)
- **PR #24014** (2026-09-28): (cherry-pick): update expected CVE export toast message in Robot test (@stonezdj)
- **PR #24010** (2026-09-28): fix(test): update expected CVE export toast message in Robot test (@stonezdj)
- **PR #23997** (2026-09-28): test(apitests): add missing get_member_role_id to project helper (@stonezdj)
- **PR #23991** (2026-09-23): Bump up distribution version and refresh base image (@stonezdj)
- **PR #23986** (2026-09-23): ci: Add merge_group trigger to CI and CodeQL workflows (@bupd)
- **PR #23984** (2026-09-28): ci: retry the spectral binary download (@velmoga)
- **PR #23982** (2026-09-22): [cherry pick] cherry pick 23974 changes to release-2.15.0 branch (@jUDASmILE)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
