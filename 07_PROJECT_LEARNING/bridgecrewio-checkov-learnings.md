# Forensic Learning Record (Deep Inspection): bridgecrewio/checkov

> **Canonical Artifact**: `07_PROJECT_LEARNING/bridgecrewio-checkov-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bridgecrewio/checkov](https://github.com/bridgecrewio/checkov))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:28:42.909Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bridgecrewio/checkov`
- **Description**: Prevent cloud misconfigurations and find vulnerabilities during build-time in infrastructure as code, container images and open source packages with Checkov by Bridgecrew.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 9046 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `checkov/ansible/__init__.py`
```
from checkov.ansible.checks import *  # noqa

```

### Core Architecture Module: `checkov/ansible/checks/__init__.py`
```
from checkov.ansible.checks.task import *  # noqa

```

### Core Architecture Module: `checkov/ansible/checks/base_ansible_task_check.py`
```
from __future__ import annotations

import json
import logging
from abc import abstractmethod
from collections.abc import Iterable
from typing import TYPE_CHECKING, Any

from checkov.ansible.checks.registry import registry
from checkov.common.checks.base_check import BaseCheck
from checkov.common.models.enums import CheckResult

if TYPE_CHECKING:
    from checkov.common.models.enums import CheckCategories


class BaseAnsibleTaskCheck(BaseCheck):
    def __init__(
        self,
        name: str,
        id: str,
        categories: Iterable[CheckCategories],
        supported_modules: Iterable[str],
        block_type: str,
        guideline: str | None = None,
        path: str | None = None,
    ) -> None:
        supported_entities = [
            entity
            for module in supported_modules
            for entity in (
                f'[].tasks[?"{module}" != null][]',
                f'[?"{module}" != null][]',
                f'[].tasks[].block[?"{module}" != null][]',
                f'[].block[?"{module}" != null][]',
                f'[].tasks[].block[].block[?"{module}" != null][]',
                f'[].block[].block[?"{module}" != null][]',
                # in theory, it can be more nested, but let's stop at 3 levels
                # jmespath lib doesn't support recursive search https://github.com/jmespath/jmespath.py/issues/110
                f'[].tasks[].block[].block[].block[?"{module}" != null][]',
                f'[].block[].block[].block[?"{module}" != null][]',
            )
        ]

        super().__init__(
            name=name,
            id=id,
            categories=categories,
            supported_entities=supported_entities,
            block_type=block_type,
            guideline=guideline,
        )

        self.entity_conf: dict[str, Any]  # stores the complete entity configuration
        self.path = path
        self.supported_modules = supported_modules

        registry.register(self)

    def scan_entity_conf(self, conf: dict[str, Any], entity_type: str) -> tuple[CheckResult, dict[str, Any]]:
        self.entity_type = entity_type
        self.entity_conf = conf

        module_conf = next((conf[module] for module in self.supported_modules if module in conf), None)
        if not module_conf:
            # this should actually never happen, but better to be safe, than sorry
            logging.info(f"Failed to find supported module {self.supported_modules} in {json.dumps(conf)}")
            return CheckResult.UNKNOWN, conf

        return self.scan_conf(module_conf)

    @abstractmethod
    def scan_conf(self, conf: dict[str, Any]) -> tuple[CheckResult, dict[str, Any]]:
        pass

```

### Core Architecture Module: `checkov/ansible/checks/base_ansible_task_value_check.py`
```
from __future__ import annotations

from abc import abstractmethod
from collections.abc import Iterable
from typing import TYPE_CHECKING, Any

from checkov.ansible.checks.base_ansible_task_check import BaseAnsibleTaskCheck
from checkov.common.models.consts import ANY_VALUE
from checkov.common.models.enums import CheckResult
from checkov.common.util.data_structures_utils import find_in_dict
from checkov.yaml_doc.enums import BlockType

if TYPE_CHECKING:
    from checkov.common.models.enums import CheckCategories


class BaseAnsibleTaskValueCheck(BaseAnsibleTaskCheck):
    def __init__(
        self,
        name: str,
        id: str,
        categories: Iterable[CheckCategories],
        supported_modules: Iterable[str],
        guideline: str | None = None,
        path: str | None = None,
        missing_block_result: CheckResult = CheckResult.FAILED,
    ) -> None:
        super().__init__(
            name=name,
            id=id,
            categories=categories,
            supported_modules=supported_modules,
            block_type=BlockType.ARRAY,
            guideline=guideline,
            path=path,
        )
        self.missing_block_result = missing_block_result

    def scan_conf(self, conf: dict[str, Any]) -> tuple[CheckResult, dict[str, Any]]:
        inspected_key = self.get_inspected_key()
        expected_values = self.get_expected_values()

        value = find_in_dict(conf, inspected_key)

        if value is None:
            return self.missing_block_result, self.entity_conf
        if ANY_VALUE in expected_values:
            return CheckResult.PASSED, self.entity_conf
        if value in expected_values:
            return CheckResult.PASSED, self.entity_conf
        # quite often string values are case-insensitive
        if isinstance(value, str) and value.lower() in [exp.lower() for exp in expected_values if isinstance(exp, str)]:
            return CheckResult.PASSED, self.entity_conf

        return CheckResult.FAILED, self.entity_conf

    @abstractmethod
    def get_inspected_key(self) -> str:
        """
        :return: JSONPath syntax path of the checked attribute
        """
        raise NotImplementedError()

    def get_expected_values(self) -> list[Any]:
        """
        Override the method with the list of acceptable values if the check has more than one possible expected value, given
        the inspected key
        :return: List of expected values, defaults to a list of the expected value
        """
        return [self.get_expected_value()]

    def get_expected_value(self) -> Any:
        """
        Returns the default expected value, governed by provider best practices
        """
        return True

    def get_evaluated_keys(self) -> list[str]:
        return [self.get_inspected_key()]

```

### Core Architecture Module: `checkov/ansible/checks/registry.py`
```
from checkov.common.bridgecrew.check_type import CheckType
from checkov.yaml_doc.base_registry import Registry

registry = Registry(CheckType.ANSIBLE)

```

### Core Architecture Module: `checkov/ansible/checks/task/__init__.py`
```
from checkov.ansible.checks.task.aws import *  # noqa
from checkov.ansible.checks.task.builtin import *  # noqa

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5928** (2025-01-06): **Lot of checks have a misleading title : "Ensure Codecommit associates an approval rule"**
  *Symptoms*: **Describe the issue** I am working on checkov tool rollout on our infrastruture. I want to analyse the Docs to prioritize the checks based on our context. On the documentation [Policy Index](https://github.com/bridgecrewio/checkov/blob/main/docs/5.Policy%20Index/terraform.md)  There is a lot of checks with misleading Policy Title.    **Examples** In Terraform Checks Doc : https://github.com/bridgecrewio/checkov/blob/main/docs/5.Policy%20Index/terraform.md There is more than 500 checks with the title "Ensure Codecommit associates an approval rule" .  Is this normal ? Or this is an error in documentation generation ?   **Version (please complete the following information):**  - Checkov Version :  Latest  **Additional context** Add any other context about the problem here. 
  **Post-Mortem & Fix Analysis**:
  > Not normal, bug in generation i imagine.
  > Thx, you think this may be resolved rapidly or it will takes longer time to be resolved ?
  > Hello, Any new about this bug ?

- **Issue #5742** (2023-11-21): **Chekov GitHub Actions Workflow Schema Outdated & not Scanning**
  *Symptoms*: **Describe the issue** When running checkov, various GH workflow files are being ignored. After doing some digging, it looks like the [actions workflow schema](https://github.com/bridgecrewio/checkov/blob/4875adc472f409bc7039a879347b404468e88215/checkov/github_actions/schemas.py#L657) is outdated. Any workflow that contains the [run-name](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#run-name) property is not scanned. Adding this property to the schema on my local install fixes this.   I also did some more digging to see if there are other outdated properties in this schema since it looks like it has not been updated in about a year, and I found a few probably worth mentioning.   - The `check_suit` event trigger should only have `completed` as an activity type, not [these](https://github.com/bridgecrewio/checkov/blob/4875adc472f409bc7039a879347b404468e88215/checkov/github_actions/schemas.py#L1648) 3. Here are the [GitHub docs](https://docs.github.com/en/enterprise-cloud@latest/actions/using-workflows/events-that-trigger-workflows#check_suite). -  I don’t think [member events](https://github.com/bridgecrewio/checkov/blob/4875adc472f409bc7039a879347b404468e88215/checkov/github_actions/schemas.py#L1821) can trigger workflows anymore. - I don't think `project` events can trigger a workflow on `update` events. Here are the [GitHub docs](https://docs.github.com/en/enterprise-cloud@latest/actions/using-workflows/events-that-trigger-work
  **Post-Mortem & Fix Analysis**:
  > Hi @bakosa, thank you for reaching out with this issue.  It is indeed looks like a case Checkov doesn't support, and it seems like you've found the right spots in code that should be addressed. How do you feel about contributing a PR with the solution? 😄  
  > Fixed by @bakosa 😄 

- **Issue #4333** (2023-02-06): **broken links in policy index**
  *Symptoms*: https://www.checkov.io/5.Policy%20Index/all.html  782 links to files directly in [`main/checkov/terraform/checks/graph_checks/`](https://github.com/bridgecrewio/checkov/tree/main/checkov/terraform/checks/graph_checks) (missing the provider subdirectories before the direct file name)  ---  unrelated, it'd also be nice if all policy index links were clickable as well
  **Post-Mortem & Fix Analysis**:
  > hey @PatMyron thanks for reaching out. Nice catch 🥇 should be no problem to add the provider to the link. For the link I need to check, where exactly the docs are generated 🧐 

- **Issue #4278** (2023-05-16): **Suppression is failing for docker graph checks**
  *Symptoms*: On an M1 mac:  Cant suppress any of the CKV2_DOCKER issues:  In the following dockerfile we have a violation of CKV2_DOCKER_2 and a suppression of it: ``` FROM arm64v8/alpine:3.17.1 # checkov:skip=CKV_DOCKER_3: Not a service # checkov:skip=CKV_DOCKER_2: Not a service # checkov:skip=CKV2_DOCKER_2: Not a service  RUN apk --no-cache add build-base git curl jq bash RUN curl -s -k https://api.github.com/repos/bridgecrewio/yor/releases/latest | jq '.assets[] | select(.name | contains("linux_arm64")) | select(.content_type | contains("gzip")) | .browser_download_url' -r | awk '{print "curl -L -k " $0 " -o /usr/bin/yor.tar.gz"}' | sh RUN tar -xf /usr/bin/yor.tar.gz -C /usr/bin/ && rm /usr/bin/yor.tar.gz && chmod +x /usr/bin/yor && echo 'alias yor="/usr/bin/yor"' >> ~/.bashrc COPY entrypoint.sh /entrypoint.sh  # Code file to execute when the docker container starts up (`entrypoint.sh`) ENTRYPOINT ["/entrypoint.sh"] ```  The latest checkov- -2.2.278 gives us: ` check: CKV2_DOCKER_2: "Ensure that certificate validation isn't disabled with curl"         FAILED for resource: /Dockerfile.RUN         File: /Dockerfile:7-7                  7 | RUN curl -s -k https://api.github.com/repos/bridgecrewio/yor/releases/latest | jq '.assets[] | select(.name | contains("linux_386")) | select(.content_type | contains("gzip")) | .browser_download_url' -r | awk '{print "curl -L -k " $0 " -o /usr/bin/yor.tar.gz"}' | sh   `
  **Post-Mortem & Fix Analysis**:
  > I also stumbled upon this issue.   After a bit of code review it looks like `checkov\dockerfile\runner.py` contains code for skipping checks implemented in python (see `checkov\dockerfile\runner.py:142`) using comments, but similar code for graph checks seems to be missing.  `checkov\dockerfile\runner.py:211` calls `BaseRunner.run_graph_checks_results(...)` which relies on the `runner_filter` to decide which result to include in the return value. A quick scan of the `RunnerFilter` class didn't come up with anything related to checking suppression comments in the scanned file. So it looks like the functionality to skip yaml based policies in dockerfiles is missing.  Maybe these findings help you to get to the core of the issue faster.

- **Issue #3551** (2022-09-22): **docs(general): Fix TOC rendering issue on checkov.io**
  *Symptoms*: **By submitting this pull request, I confirm that my contribution is made under the terms of the Apache 2.0 license.**  ## Title Fix TOC rendering issue on checkov.io  ## Description  Rendering doesn't like 4 layers of markdown titles on our current stylesheets  ## Checklist:  - [X] My code follows the style guidelines of this project - [X] I have performed a self-review of my own code - [X] I have commented my code, particularly in hard-to-understand areas - [X] I have made corresponding changes to the documentation - [X] I have added tests that prove my feature, policy, or fix is effective and works - [X] New and existing tests pass locally with my changes - [X] Any dependent changes have been merged and published in downstream modules 
  **Post-Mortem & Fix Analysis**:
  > @gruebel @schosterbarak Could one of you approve my humongous chunk of a code change? 😂 

- **Issue #3475** (2022-11-16): **Prisma Policy Labels not working**
  *Symptoms*: **Description**  At the company I work at we are using Checkov together with Prisma Cloud Code Security, and I'm having trouble using the policy labels in Prisma to filter checks.  On Prisma's side, I've added a label to the "Default namespace is used" policy check called "mikko-testaa". ![image](https://user-images.githubusercontent.com/35505856/188586726-f6b34b89-58fd-425a-8927-954af6fe7222.png)  Filtering on Prisma via this label works, as it only shows the namespace policy check. ![image](https://user-images.githubusercontent.com/35505856/188586865-2bcbec64-178f-46df-92d8-45025864267b.png)  **Execution and Results**  With that in mind these are the checkov commands that I used both locally and on Jenkins; checkov -d . --framework helm -o json --output-file-path . --prisma-api-url [PRISMAURL] --bc-api-key [PRISMAUSER::PRISMAKEY]] --policy-metadata-filter policy.label=mikko-testaa  I tried running as-is and also running via a config file, both returning the same result; ![image](https://user-images.githubusercontent.com/35505856/188587531-7377bffb-65e6-4f8c-8518-4dccbb18672e.png)  Have I misunderstood the policy-metadata-filter parameter? What am I doing wrong?  **Version** Checkov version 2.1.179
  **Post-Mortem & Fix Analysis**:
  > The fact that the Available options: shows empty makes me think there is something wrong with getting policies from prisma?
  > Hey @MikkoMyllyniemi I haven't been able to reproduce this issue. I applied a similar label to the poicy and it worked as expected.  ``` ❯ ckv -l --policy-metadata-filter policy.label=kartik-test --bc-api-key "$PC_ACCESS_KEY::$PC_SECRET_KEY" |    | Id         | Type     | Entity                            | Policy                    | IaC       | |----|------------|----------|-----------------------------------|---------------------------|-----------| |  0 | CKV_K8S_21 | resource | kubernetes_config_map             | Default namespace is used | Terraform | |  1 | CKV_K8S_21 | resource | kubernetes_cron_job               | Default namespace is used | Terraform | |  2 | CKV_K8S_21 | resource | kubernetes_daemonset              | Default namespace is used | Terraform | |  3 | CKV_K8S_21 | resource | kubernetes_deployment             | Default namespace is used | Terraform | |  4 | CKV_K8S_21 | resource | kubernetes_ingress                | Default namespace is used | Terraform |
  > Never mind, I found the issue. It appears that  `GET https://api.prismacloud.io/filter/policy/suggest` returns only "recently used" filters and therefore a new label may or may not be returned. I'll fix this to use this method instead https://prisma.pan.dev/api/cloud/cspm/policy#operation/get-policy-filter-options

- **Issue #2632** (2022-03-25): **Bicep false CKV_AZURE_23**
  *Symptoms*: Hi, I get CKV_AZURE_23 on this simple bicep file:  ` @description('SQL Logical server.') param sqlLogicalServer object  @description('The SQL Logical Server password.') @secure() param password string  param tags object  var defaultAuditActionsAndGroups = [   'SUCCESSFUL_DATABASE_AUTHENTICATION_GROUP'   'FAILED_DATABASE_AUTHENTICATION_GROUP'   'BATCH_COMPLETED_GROUP' ]  resource sqlLogicalServerRes 'Microsoft.Sql/servers@2021-02-01-preview' = {   name: sqlLogicalServer.name   location: resourceGroup().location   tags: tags   identity: {     type: sqlLogicalServer.systemManagedIdentity ? 'SystemAssigned' : 'None'   }   properties: {     administratorLogin: sqlLogicalServer.userName     administratorLoginPassword: password     version: '12.0'     minimalTlsVersion: sqlLogicalServer.minimalTlsVersion     publicNetworkAccess: sqlLogicalServer.publicNetworkAccess   } }  // Audit settings need for enabling auditing to Log Analytics workspace resource auditSettings 'Microsoft.Sql/servers/auditingSettings@2021-02-01-preview' = {   name: 'default'   parent: sqlLogicalServerRes   properties: {     state: 'Enabled'     auditActionsAndGroups: defaultAuditActionsAndGroups     storageEndpoint: ''     storageAccountAccessKey: ''     storageAccountSubscriptionId: '00000000-0000-0000-0000-000000000000'     retentionDays: 0     isAzureMonitorTargetEnabled: sqlLogicalServer.diagnosticLogsAndMetrics.auditLogs     isDevopsAuditEnabled: sqlLogicalServ
  **Post-Mortem & Fix Analysis**:
  > hi @acorbos thanks for creating this issue and I'm happy that you gave the Bicep runner a try. It is still in an early stage and I'm improving it step by step.
  > @gruebel thanks for looking into it, I couldn't find the code. Is it somehow converting to ARM and then using the ARM checks? I'm asking because I wanted to switch to ARM and I have the same problem with it. See https://github.com/bridgecrewio/checkov/blob/master/checkov/arm/checks/resource/SQLServerAuditingEnabled.py I think it should check on server level, not on database level if the message is "Ensure that 'Auditing' is set to 'Enabled' **for SQL servers**". By the way, that blank there... shouldn't it be a slash between MicrosoftSql and servers? "Microsoft.Sql servers/databases/auditingSettings"  Why is it not working for me: This code expects a resource with type "auditingSettings" nested inside "Microsoft.Sql/servers". I have a resource with type "Microsoft.Sql/servers/auditingSettings" outside resource "Microsoft.Sql/servers". This is how the Azure portal exports templates.  
  > @acorbos you are right, but it is even a bit more complicated, but I'm working on a fix. It won't cover all possibilities, but it should be better than now 🙂 

- **Issue #2457** (2022-02-21): **Kustomize reorders yaml and crashes checkov**
  *Symptoms*: **Describe the issue**  Checkov should be able to scan Kubernetes objects with arbitrary element names when using kustomize.  I am scanning a rook-ceph deployment, that contains a Storage class with a key `allowVolumeExpansion`. The storage class is included through a `kustomization.yaml`.   This key will be listed before `apiVersion`, and make Checkov break - at it expects the apiVersion to be [the first entry](https://github.com/bridgecrewio/checkov/blob/master/checkov/kustomize/runner.py#L328). However, this is not guaranteed - kustomize will order the items in the .yaml file alphabetically.  **Examples** Please share an example code sample (in the IaC of your choice) + the expected outcomes.  Storageclass: ```yaml apiVersion: storage.k8s.io/v1 kind: StorageClass metadata:   name: rook-ceph-block   annotations:     storageclass.kubernetes.io/is-default-class: "true" # Change "rook-ceph" provisioner prefix to match the operator namespace if needed provisioner: rook-ceph.rbd.csi.ceph.com parameters:   # [...] allowVolumeExpansion: true reclaimPolicy: Delete ```  Kustomization: ```yaml apiVersion: kustomize.config.k8s.io/v1beta1 kind: Kustomization  resources: - storageclass.yaml ```  Storageclass.yaml built with kustomize:  ```sh /code/components/rook-ceph/bases/v1.7.8 # kustomize build allowVolumeExpansion: true apiVersion: storage.k8s.io/v1 kind: StorageClass metadata:   annotations:     storageclass.kubernetes.io/is-default-cla
  **Post-Mortem & Fix Analysis**:
  > Hey @MajorFlamingo many thanks for the detailed issue report!  I've never actually seen a Kubernetes manifest that didn't start with the API line, or a Kustomize example that did that!  Could you point me to the rook-ceph deployment codebase if it's public for my own intrigue?   Currently working on an alternative check for file sanity when processing the kustomize output!
  > See https://github.com/bridgecrewio/checkov/pull/2478 
  > Thanks for responding and submitting a fix so quickly.   I think this storageclass example might help you recreate this issue: [storageclass.yaml](https://github.com/rook/rook/blob/master/deploy/examples/csi/cephfs/storageclass.yaml).  Even though the file starts with the apiVersion, kustomize will sort the file internally - meaning that the `allowVolumeExpansion` key will be ordered before the `apiVersion` key. 

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

### Incident Patch 1: `e8c8decf` (2026-09-30)
**Commit Message**: fix(terraform_json): handle HCL JSON array and single-dict block formats in parser (#7707)

initial impl

Co-authored-by: eshmayovitz <eshmayovitz@paloaltonetworks.com>

**File**: `checkov/terraform_json/parser.py` (modified, +25/-2)
```diff
@@ -53,6 +53,8 @@ def parse(file_path: Path) -> tuple[dict[str, Any], list[tuple[int, str]]] | tup
                 logger.error(f"Tried to parse {file_path} as JSON", exc_info=True)
     except YAMLError:
         pass
+    except Exception:
+        logger.error(f"Failed to parse template: {file_path}", exc_info=True)
 
     if template is None or template_lines is None:
         return None, None
@@ -91,9 +93,28 @@ def prepare_definition(definition: dict[str, Any]) -> dict[str, Any]:
     return definition_new
 
 
-def handle_block_type(block_type: str, blocks: dict[str, Any]) -> list[dict[str, Any]]:
+def handle_block_type(block_type: str, blocks: dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
     result: list[dict[str, Any]] = []
 
+    # HCL JSON spec allows block types as an array of single-key objects
+    if isinstance(blocks, list):
+        normalized: dict[str, Any] = {}
+        for block_obj in blocks:
+            if isinstance(block_obj, dict):
+                for key, value in block_obj.items():
+                    if key in normalized:
+                        # Multiple blocks with same name — merge into list
+                        existing = normalized[key]
+                        if isinstance(existing, list):
+                            existing.append(value)
+                        else:
+                            normalized[key] = [existing, value]
+                    else:
+                        normalized[key] = value
+            else:
+                logger.debug(f"Skipping non-dict element in '{block_type}' blocks array: {type(block_obj).__name__}")
+        blocks = normalized
+
     for block_name, config in blocks.items():
         if block_name == COMMENT_FIELD_NAME or block_name in LINE_FIELD_NAMES:
             continue
@@ -105,7 +126,9 @@ def handle_block_type(block_type: str, blocks: dict[str, Any]) -> list[dict[str,
                     continue
                 result.append({block_name: {resource_name: hclify(obj=resource_config)}})
         elif block_type == BlockType.PROVIDER:
-            # provider are stored as a list, which we need to move one level higher to add the name
+            # provider can be a list of configs or a single dict; normalize to list
+            if isinstance(config, dict):
+                config = [config]
             for provider_config in config:
                 result.append({block_name: hclify(obj=provider_config)})
         elif block_type == BlockType.LOCALS:
```

**File**: `tests/terraform_json/examples/provider_array_with_null.tf.json` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+{
+  "provider": [
+    {
+      "aws": {
+        "region": "us-west-2",
+        "profile": null
+      }
+    }
+  ],
+  "resource": {
+    "aws_instance": {
+      "example": {
+        "ami": "abc-123",
+        "instance_type": "t2.micro"
+      }
+    }
+  }
+}
```

**File**: `tests/terraform_json/examples/provider_single_dict.tf.json` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+{
+  "provider": {
+    "artifactory": {
+      "url": "https://example.com",
+      "access_token": "token123"
+    }
+  },
+  "resource": {
+    "aws_instance": {
+      "example": {
+        "ami": "abc-123",
+        "instance_type": "t2.micro"
+      }
+    }
+  }
+}
```

**File**: `tests/terraform_json/examples/provider_top_level_array.tf.json` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+{
+  "provider": [
+    {"aws": {"region": "us-east-1"}},
+    {"aws": {"alias": "west", "region": "us-west-2"}}
+  ],
+  "resource": {
+    "aws_instance": {
+      "example": {
+        "ami": "abc-123",
+        "instance_type": "t2.micro"
+      }
+    }
+  }
+}
```

**File**: `tests/terraform_json/test_parser.py` (modified, +143/-1)
```diff
@@ -1,4 +1,8 @@
-from checkov.terraform_json.parser import hclify, prepare_definition
+from pathlib import Path
+
+from checkov.terraform_json.parser import handle_block_type, hclify, parse, prepare_definition
+
+EXAMPLES_DIR = Path(__file__).parent / "examples"
 
 
 def test_hclify():
@@ -60,3 +64,141 @@ def test_prepare_definition_locals():
             }
         ]
     }
+
+
+def test_handle_block_type_provider_single_dict_config():
+    """Provider config as a single dict (not wrapped in a list) should be handled without crashing.
+
+    When a provider has a single configuration in .tf.json, the HCL JSON spec allows it
+    as a plain dict. The parser must normalize it to a list before iterating, otherwise
+    iterating a dict yields its keys (strings) and hclify() crashes with
+    'Exception: this method receives only dicts'.
+    """
+    # given — provider name maps to a dict (not a list)
+    blocks = {"artifactory": {"url": "https://example.com", "access_token": "token123"}}
+
+    # when / then — should NOT crash, should return valid parsed result
+    result = handle_block_type(block_type="provider", blocks=blocks)
+
+    assert isinstance(result, list)
+    assert len(result) == 1
+    assert "artifactory" in result[0]
+    # The inner dict should be hclified (values wrapped in lists)
+    assert result[0]["artifactory"] == {
+        "url": ["https://example.com"],
+        "access_token": ["token123"],
+    }
+
+
+def test_handle_block_type_provider_list_config():
+    """Provider config as a list of dicts (the existing working case).
+
+    This should continue to work — it's the format the current code already handles.
+    """
+    # given — provider name maps to a list of dicts
+    blocks = {"aws": [{"region": "us-east-1"}, {"alias": "west", "region": "us-west-2"}]}
+
+    # when
+    result = handle_block_type(block_type="provider", blocks=blocks)
+
+    # then
+    assert isinstance(result, list)
+    assert len(result) == 2
+    assert result[0] == {"aws": {"region": ["us-east-1"]}}
+    assert result[1] == {"aws": {"alias": ["west"], "region": ["us-west-2"]}}
+
+
+def test_parse_provider_single_dict_config_file():
+    """End-to-end parse of a .tf.json file where a provider config is a plain dict.
+
+    This exercises the full parse → loads → prepare_definition → handle_block_type pipeline
+    with the single-dict provider crash scenario.
+    """
+    # given
+    fixture = EXAMPLES_DIR / "provider_single_dict.tf.json"
+
+    # when
+    template, file_lines = parse(file_path=fixture)
+
+    # then — should not crash and should return a valid template
+    assert template is not None
+    assert file_lines is not None
+
+    # Provider block should be parsed correctly
+    assert "provider" in template
+    provider_blocks = template["provider"]
+    assert isinstance(provider_blocks, list)
+    assert len(provider_blocks) == 1
+    assert "artifactory" in provider_blocks[0]
+    assert provider_blocks[0]["artifactory"]["url"] == ["https://example.com"]
+    assert provider_blocks[0]["artifactory"]["access_token"] == ["token123"]
+
+    # Resource block should also be parsed correctly
+    assert "resource" in template
+    resource_blocks = template["resource"]
+    assert isinstance(resource_blocks, list)
+    assert len(resource_blocks) == 1
+    assert "aws_instance" in resource_blocks[0]
+
+
+def test_parse_provider_array_of_objects_file():
+    """End-to-end parse of a .tf.json file where provider is a top-level array of objects.
+
+    The HCL JSON spec also allows:
+      "provider": [{"aws": {"region": "us-east-1"}}, {"aws": {...}}]
+    This is a different format from the dict-of-lists format and exercises another code path.
+    """
+    # given
+    fixture = EXAMPLES_DIR / "provider_top_level_array.tf.json"
+
+    # when
+    template, file_lines = parse(file_path=fixture)
+
+    # then — should not crash and should return a valid template
+    assert template is not None
+    assert 
```

---

### Incident Patch 2: `d89e8dd4` (2026-07-10)
**Commit Message**: fix(terraform_plan): skip resources being removed from state ('forget' action)

**File**: `checkov/version.py` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version = '3.3.19'
+version = '3.3.20'
```

**File**: `kubernetes/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-checkov==3.3.19
+checkov==3.3.20
```

---

### Incident Patch 3: `06ac5717` (2026-09-27)
**Commit Message**: fix(terraform_plan): skip resources being removed from state ('forget' action) (#7676)

**File**: `checkov/terraform/plan_parser.py` (modified, +8/-1)
```diff
@@ -19,6 +19,7 @@
 TF_PLAN_RESOURCE_ADDRESS = CustomAttributes.TF_RESOURCE_ADDRESS
 TF_PLAN_RESOURCE_CHANGE_ACTIONS = "__change_actions__"
 TF_PLAN_RESOURCE_CHANGE_KEYS = "__change_keys__"
+TF_PLAN_RESOURCE_FORGET_ACTION = "forget"
 TF_PLAN_RESOURCE_PROVISIONERS = "provisioners"
 TF_PLAN_RESOURCE_AFTER_UNKNOWN = 'after_unknown'
 
@@ -211,7 +212,13 @@ def _prepare_resource_block(
 
         changes = resource_changes.get(resource_address)  # type:ignore[arg-type]  # because it can be None
         if changes:
-            resource_conf[TF_PLAN_RESOURCE_CHANGE_ACTIONS] = changes.get("change", {}).get("actions") or []
+            actions = changes.get("change", {}).get("actions") or []
+            # Skip resources being removed from state ('forget' action). 'Forgotten' resources are mistakenly
+            # included with no values in planned_values due to Terraform bug (issue: hashicorp/terraform#38641).
+            if actions == [TF_PLAN_RESOURCE_FORGET_ACTION]:
+                return resource_block, block_type, False
+
+            resource_conf[TF_PLAN_RESOURCE_CHANGE_ACTIONS] = actions
             resource_conf[TF_PLAN_RESOURCE_CHANGE_KEYS] = changes.get(TF_PLAN_RESOURCE_CHANGE_KEYS) or []
             # enrich conf with after_unknown values
             _eval_after_unknown(changes, resource_conf)
```

**File**: `tests/terraform/runner/resources/plan_forget_action/tfplan.json` (added, +238/-0)
```diff
@@ -0,0 +1,238 @@
+{
+  "format_version": "1.2",
+  "terraform_version": "1.9.8",
+  "planned_values": {
+    "root_module": {
+      "resources": [
+        {
+          "address": "aws_s3_bucket.forgotten",
+          "mode": "managed",
+          "type": "aws_s3_bucket",
+          "name": "forgotten",
+          "provider_name": "registry.terraform.io/hashicorp/aws",
+          "schema_version": 0,
+          "sensitive_values": false
+        }
+      ]
+    }
+  },
+  "resource_changes": [
+    {
+      "address": "aws_s3_bucket.forgotten",
+      "mode": "managed",
+      "type": "aws_s3_bucket",
+      "name": "forgotten",
+      "provider_name": "registry.terraform.io/hashicorp/aws",
+      "change": {
+        "actions": [
+          "forget"
+        ],
+        "before": {
+          "acceleration_status": "",
+          "acl": null,
+          "arn": "arn:aws:s3:::forgotten-bucket",
+          "bucket": "forgotten-bucket",
+          "bucket_domain_name": "forgotten-bucket.s3.amazonaws.com",
+          "bucket_prefix": "",
+          "bucket_regional_domain_name": "forgotten-bucket.s3.us-west-2.amazonaws.com",
+          "cors_rule": [],
+          "force_destroy": false,
+          "grant": [
+            {
+              "id": "75aa57f09aa0c8caeab4f8c24e99d10f8e7faeebf76c078efc7c6caea54ba06a",
+              "permissions": [
+                "FULL_CONTROL"
+              ],
+              "type": "CanonicalUser",
+              "uri": ""
+            }
+          ],
+          "hosted_zone_id": "Z3BJ6K6RIION7M",
+          "id": "forgotten-bucket",
+          "lifecycle_rule": [],
+          "logging": [],
+          "object_lock_configuration": [],
+          "object_lock_enabled": false,
+          "policy": "",
+          "region": "us-west-2",
+          "replication_configuration": [],
+          "request_payer": "BucketOwner",
+          "server_side_encryption_configuration": [
+            {
+              "rule": [
+                {
+                  "apply_server_side_encryption_by_default": [
+                    {
+                      "kms_master_key_id": "arn:aws:kms:us-west-2:123456789012:key/12345678-1234-1234-1234-123456789012",
+                      "sse_algorithm": "aws:kms"
+                    }
+                  ],
+                  "bucket_key_enabled": false
+                }
+              ]
+            }
+          ],
+          "tags": null,
+          "tags_all": {},
+          "timeouts": null,
+          "versioning": [
+            {
+              "enabled": false,
+              "mfa_delete": false
+            }
+          ],
+          "website": [],
+          "website_domain": null,
+          "website_endpoint": null
+        },
+        "after": null,
+        "after_unknown": {},
+        "before_sensitive": {
+          "cors_rule": [],
+          "grant": [
+            {
+              "permissions": [
+                false
+              ]
+            }
+          ],
+          "lifecycle_rule": [],
+          "logging": [],
+          "object_lock_configuration": [],
+          "replication_configuration": [],
+          "server_side_encryption_configuration": [
+            {
+              "rule": [
+                {
+                  "apply_server_side_encryption_by_default": [
+                    {}
+                  ]
+                }
+              ]
+            }
+          ],
+          "tags_all": {},
+          "versioning": [
+            {}
+          ],
+          "website": []
+        },
+        "after_sensitive": false
+      },
+      "action_reason": "delete_because_no_resource_config"
+    }
+  ],
+  "prior_state": {
+    "format_version": "1.0",
+    "terraform_version": "1.9.8",
+    "values": {
+      "root_module": {
+        "resources": [
+          {
+            "address": "aws_s3_bucket.forgotten",
+            "mode": "managed",
+            "type": "aws_s3_bucket",
+            "name": "forgotten",
+            "provider
```

**File**: `tests/terraform/runner/test_plan_runner.py` (modified, +21/-0)
```diff
@@ -397,6 +397,27 @@ def test_runner_root_module_resources_no_values_route53(self):
 
         self.assertCountEqual(passed_check_ids, expected_passed_check_ids)
 
+    def test_runner_skip_forget_action_resources(self):
+        # A resource being removed from state (no destroy) via a 'removed' block has a 'forget' change action and will
+        # appear in planned_values without values due to a Terraform bug (issue: hashicorp/terraform#38641), causing false positives.
+        # This test verifies 'forgotten' resources are getting skipped to account for the bug.
+        current_dir = os.path.dirname(os.path.realpath(__file__))
+        plan_path = current_dir + "/resources/plan_forget_action/tfplan.json"
+
+        report = Runner().run(
+            root_folder=None,
+            files=[plan_path],
+            external_checks_dir=None,
+            runner_filter=RunnerFilter(framework=["terraform_plan"]),
+        )
+
+        scanned_resources = {
+            record.resource
+            for record in itertools.chain(report.passed_checks, report.failed_checks, report.skipped_checks)
+        }
+
+        self.assertNotIn("aws_s3_bucket.forgotten", scanned_resources)
+
     def test_runner_data_resource_partial_values(self):
         # In rare circumstances a data resource with partial values in the plan could cause false negatives
         # Often 'data' does not even appear in the *_modules[x].resources field within planned_values and is not scanned as expected
```

---

### Incident Patch 4: `f6824442` (2026-09-10)
**Commit Message**: fix(general): honour scope.provider for platform-downloaded custom po… (#7677)

fix(general): honour scope.provider for platform-downloaded custom policies

Co-authored-by: mblonder <mblonder@paloaltonetworks.com>

**File**: `checkov/version.py` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version = '3.3.16'
+version = '3.3.17'
```

**File**: `kubernetes/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-checkov==3.3.16
+checkov==3.3.17
```

---

### Incident Patch 5: `ba421a3a` (2026-09-10)
**Commit Message**: fix(general): honour scope.provider for platform-downloaded custom po… (#7677)

fix(general): honour scope.provider for platform-downloaded custom policies

Co-authored-by: mblonder <mblonder@paloaltonetworks.com>

**File**: `checkov/common/bridgecrew/integration_features/features/custom_policies_integration.py` (modified, +2/-2)
```diff
@@ -68,7 +68,7 @@ def pre_scan(self) -> None:
                         policy['severity'] = Severities[policy['severity']]
                         self.bc_cloned_checks[source_incident_id].append(policy)
                         continue
-                    resource_types = Registry._get_resource_types(converted_check['metadata'])
+                    resource_types = Registry._get_resource_types(converted_check)
 
                     if policy.get('category') == LICENSES_CATEGORY:
                         continue
@@ -105,10 +105,10 @@ def _convert_raw_check(policy: dict[str, Any]) -> dict[str, Any]:
             'name': policy['title'],
             'category': policy['category'],
             'frameworks': policy.get('frameworks', []),
-            'scope': {'provider': policy.get('provider', '').lower()}
         }
         check = {
             'metadata': metadata,
+            'scope': {'provider': policy.get('provider', '').lower()},
             'definition': json.loads(policy['code'])
         }
         return check
```

**File**: `tests/common/integration_features/test_custom_policies_integration.py` (modified, +33/-2)
```diff
@@ -495,8 +495,39 @@ def test_policy_load_with_resources_types_as_str(self):
             Path(__file__).parent.parent.parent.parent / "checkov" / "terraform" / "checks" / "graph_checks"))
         checks = [parser.parse_raw_check(CustomPoliciesIntegration._convert_raw_check(p)) for p in policies]
         registry.checks = checks  # simulate that the policy downloader will do
-        
-        
+
+    def test_convert_raw_check_places_scope_at_top_level(self):
+        policy = {
+            "id": "test_azure_taggable_1",
+            "title": "Ensure taggable Azure resources are tagged",
+            "category": "General",
+            "provider": "azure",
+            "frameworks": ["Terraform"],
+            "severity": "MEDIUM",
+            "code": json.dumps({
+                "cond_type": "attribute",
+                "resource_types": "taggable",
+                "attribute": "tags",
+                "operator": "exists",
+            }),
+        }
+
+        converted = CustomPoliciesIntegration._convert_raw_check(policy)
+
+        self.assertEqual(converted["scope"], {"provider": "azure"})
+        self.assertNotIn("scope", converted["metadata"])
+
+        parser = GraphCheckParser()
+        resource_types = Registry._get_resource_types(converted)
+        check = parser.parse_raw_check(converted, resources_types=resource_types)
+        self.assertTrue(check.resource_types)
+        self.assertTrue(
+            all(rt.startswith("azurerm_") for rt in check.resource_types),
+            f"Azure-scoped taggable policy leaked to non-azure resources: "
+            f"{[rt for rt in check.resource_types if not rt.startswith('azurerm_')][:5]}"
+        )
+
+
 def mock_custom_policies_response():
     return {
         "customPolicies": [
```

**File**: `tests/terraform/graph/runner/test_graph_builder.py` (modified, +5/-0)
```diff
@@ -48,6 +48,11 @@ def test_build_graph_new_tf_module(self):
     def test_run_clean(self):
         resources_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "resources", "graph_files_test")
         runner = Runner(db_connector=self.db_connector())
+        # Isolate from cross-test pollution of the shared terraform graph_checks
+        # registry (same pattern used by tests in tests/terraform/runner/test_runner.py,
+        # e.g. lines 1220-1221) so the hard-coded pass/fail counts below stay stable.
+        runner.graph_registry.checks = []
+        runner.graph_registry.load_checks()
         report = runner.run(root_folder=resources_path)
         self.assertEqual(6, len(report.failed_checks))
         self.assertEqual(5, len(report.passed_checks))
```

---

### Incident Patch 6: `48dbc906` (2026-08-30)
**Commit Message**: fix(terraform): Added current Azure Terraform resources and taggable resources as of hashicorp/azurerm provider version 4.81 (#7652)

* Added current Azure Terraform resources as of provider version 4.81

* Fixed copy/past issues with azure resource types

---------

Co-authored-by: Joshua Brule <brule.joshua@mayo.edu>

**File**: `checkov/version.py` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version = '3.3.15'
+version = '3.3.16'
```

**File**: `kubernetes/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-checkov==3.3.15
+checkov==3.3.16
```

---

### Incident Patch 7: `8c7c152b` (2026-08-30)
**Commit Message**: fix(terraform): Added current Azure Terraform resources and taggable resources as of hashicorp/azurerm provider version 4.81 (#7652)

* Added current Azure Terraform resources as of provider version 4.81

* Fixed copy/past issues with azure resource types

---------

Co-authored-by: Joshua Brule <brule.joshua@mayo.edu>



---

### Incident Patch 8: `9514f12d` (2026-08-26)
**Commit Message**: fix(sca): match CVE suppressions case-insensitively (#7659)

* fix(sca): match CVE suppressions case-insensitively

* chore(ci): pin pipenv on all python versions

* chore(ci): pin pipenv and bump danger-check to node 20

**File**: `checkov/version.py` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version = '3.3.14'
+version = '3.3.15'
```

**File**: `kubernetes/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-checkov==3.3.14
+checkov==3.3.15
```

---

### Incident Patch 9: `2637543b` (2026-08-26)
**Commit Message**: fix(sca): match CvesAccounts suppressions on unprefixed account ids (#7660)

**File**: `checkov/common/bridgecrew/integration_features/features/suppressions_integration.py` (modified, +2/-1)
```diff
@@ -232,7 +232,8 @@ def _check_suppression(self, record: Record, suppression: dict[str, Any]) -> boo
         elif type == 'CvesAccounts':
             if 'accountIds' not in suppression:
                 return False
-            if self.bc_integration.source_id in suppression['accountIds']:
+            if self.bc_integration.source_id in suppression['accountIds'] or \
+                    any(self.bc_integration.repo_matches(account) for account in suppression['accountIds']):
                 if record.vulnerability_details and record.vulnerability_details['id'].lower() in {
                         cve.lower() for cve in suppression['cves']}:
                     return True
```

**File**: `tests/common/integration_features/test_suppressions_integration.py` (modified, +30/-0)
```diff
@@ -352,6 +352,36 @@ def test_suppress_by_cve_accounts_with_repo_id_package_scan(self):
         self.assertTrue(suppressions_integration._check_suppression(record2, suppression))
         self.assertFalse(suppressions_integration._check_suppression(record3, suppression))
 
+    def test_suppress_by_cve_accounts_unprefixed_account_id(self):
+        instance = BcPlatformIntegration()
+        instance.repo_id = 'some/repo'
+        instance.source_id = f"customer_{instance.repo_id}"
+        suppressions_integration = SuppressionsIntegration(instance)
+        suppressions_integration._init_repo_regex()
+
+        suppression = {
+            'suppressionType': 'CvesAccounts',
+            'policyId': 'BC_VUL_2',
+            'comment': 'suppress by accounts',
+            'cves': ['CVE-2021-44420'],
+            'accountIds': ['some/repo'],
+            'checkovPolicyId': 'BC_VUL_2'
+        }
+
+        matching = Record(check_id='BC_VUL_2', check_name=None, check_result=None,
+                          code_block=None, file_path=None, file_line_range=None,
+                          resource=None, evaluations=None, check_class=None,
+                          file_abs_path='.', entity_tags=None,
+                          vulnerability_details={'id': 'CVE-2021-44420'})
+        other_repo = Record(check_id='BC_VUL_2', check_name=None, check_result=None,
+                            code_block=None, file_path=None, file_line_range=None,
+                            resource=None, evaluations=None, check_class=None,
+                            file_abs_path='.', entity_tags=None,
+                            vulnerability_details={'id': 'CVE-2021-99999'})
+
+        self.assertTrue(suppressions_integration._check_suppression(matching, suppression))
+        self.assertFalse(suppressions_integration._check_suppression(other_repo, suppression))
+
     def test_suppress_by_cve_accounts_without_repo_id_package_scan(self):
         instance = BcPlatformIntegration()
         suppressions_integration = SuppressionsIntegration(instance)
```

---

### Incident Patch 10: `317f4a68` (2026-08-26)
**Commit Message**: fix(sca): match CVE suppressions case-insensitively (#7659)

* fix(sca): match CVE suppressions case-insensitively

* chore(ci): pin pipenv on all python versions

* chore(ci): pin pipenv and bump danger-check to node 20

**File**: `checkov/version.py` (modified, +1/-1)
```diff
@@ -1 +1 @@
-version = '3.3.13'
+version = '3.3.14'
```

**File**: `kubernetes/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-checkov==3.3.13
+checkov==3.3.14
```

#### Recent Merged Pull Requests:
- **PR #7707** (2026-09-30): fix(terraform_json): handle HCL JSON array and single-dict block formats in parser (@talazuri)
- **PR #7688** (2026-09-17): fix(secrets): disable spawn mode in frozen environment (@AdamDev)
- **PR #7687** (2026-09-17): chore(general): upgrade parallelism and drain (@GillSami)
- **PR #7677** (2026-09-10): fix(general): honour scope.provider for platform-downloaded custom po… (@mayblo)
- **PR #7676** (2026-09-27): fix(terraform_plan): skip resources being removed from state ('forget' action) (@v3n7i)
- **PR #7662** (closed): fix(terraform): create edges to outputs of modules called with count or for_each (@AlexKantor87)
- **PR #7660** (2026-08-26): fix(sca): match CvesAccounts suppressions on unprefixed account ids (@Saarett)
- **PR #7659** (2026-08-26): fix(sca): match CVE suppressions case-insensitively (@Saarett)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
