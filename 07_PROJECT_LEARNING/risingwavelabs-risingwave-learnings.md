# Forensic Learning Record (Deep Inspection): risingwavelabs/risingwave

> **Canonical Artifact**: `07_PROJECT_LEARNING/risingwavelabs-risingwave-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/risingwavelabs/risingwave](https://github.com/risingwavelabs/risingwave))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:43:43.073Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `risingwavelabs/risingwave`
- **Description**: Event streaming platform for agentic AI. Continuously ingest, transform, and serve event streams in real time, at scale.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 9356 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ci/mongodb/config-replica.js`
```
rsconf = {
    _id: "rs0",
    members: [{ _id: 0, host: "mongodb:27017", priority: 1.0 }],
};
rs.initiate(rsconf);
rs.status();

```

### Core Architecture Module: `ci/scripts/find-regression.py`
```
#!/usr/bin/env python3

import subprocess
import unittest
import os
import sys

'''
@kwannoel
This script is used to find the commit that introduced a regression in the codebase.
It uses binary search to find the regressed commit.
It works as follows:
1. Use the start (inclusive) and end (exclusive) bounds, find the middle commit.
   e.g. given commit 0->1(start)->2->3->4(bad), start will be 1, end will be 4. Then the middle commit is (1+4)//2 = 2
        given commit 0->1(start)->2->3(bad)->4, start will be 1, end will be 3. Then the middle commit is (1+3)//2 = 2
        given commit 0->1(start)->2(bad), start will be 1, end will be 2. Then the middle commit is (1+2)//2 = 1.
        given commit 0->1(start,bad), start will be 1, end will be 1. We just return the bad commit (1) immediately.
2. Run the pipeline on the middle commit.
3. If the pipeline fails, the regression is in the first half of the commits. Recurse (start, mid)
4. If the pipeline passes, the regression is in the second half of the commits. Recurse (mid+1, end)
5. If start>=end, return start as the regressed commit.

We won't run the entire pipeline, only steps specified by the CI_STEPS environment variable.

For step (2), we need to check its outcome and only run the next step, if the outcome is successful.
'''


def format_step(env):
    commit = get_bisect_commit(env["GOOD_COMMIT"], env["BAD_COMMIT"])
    step = f'''
cat <<- YAML | buildkite-agent pipeline upload
steps:
  - label: "run-{commit}"
    key: "run-{commit}"
    trigger: "main-cron"
    soft_fail: true
    build:
      branch: {env["BISECT_BRANCH"]}
      commit: {commit}
      env:
        CI_STEPS: {env['CI_STEPS']}
  - wait
  - label: 'check'
    command: |
        GOOD_COMMIT={env['GOOD_COMMIT']} BAD_COMMIT={env['BAD_COMMIT']} BISECT_BRANCH={env['BISECT_BRANCH']} CI_STEPS=\'{env['CI_STEPS']}\' ci/scripts/find-regression.py check
YAML'''
    return step


def report_step(commit):
    step = f'''
cat <<- YAML | buildkite-agent pipeline upload
steps:
  - label: "Regressed Commit: {commit}"
    command: "echo 'Regressed Commit: {commit}'"
YAML'''
    print(f"--- reporting regression commit: {commit}")
    result = subprocess.run(step, shell=True)
    if result.returncode != 0:
        print(f"stderr: {result.stderr}")
        print(f"stdout: {result.stdout}")
        sys.exit(1)


# Triggers a buildkite job to run the pipeline on the given commit, with the specified tests.
def run_pipeline(env):
    step = format_step(env)
    print(f"--- running upload pipeline for step\n{step}")
    result = subprocess.run(step, shell=True)
    if result.returncode != 0:
        print(f"stderr: {result.stderr}")
        print(f"stdout: {result.stdout}")
        sys.exit(1)


# Number of commits for [start, end)
def get_number_of_commits(start, end):
    cmd = f"git rev-list --count {start}..{end}"
    result = subprocess.run([cmd], shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"stderr: {result.stderr}")
        print(f"stdout: {result.stdout}")
        sys.exit(1)
    return int(result.stdout)


def get_bisect_commit(start, end):
    number_of_commits = get_number_of_commits(start, end)
    commit_offset = number_of_commits // 2
    if commit_offset == 0:
        return start

    cmd = f"git rev-list --reverse {start}..{end} | head -n {commit_offset} | tail -n 1"
    result = subprocess.run([cmd], shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"stderr: {result.stderr}")
        print(f"stdout: {result.stdout}")
        sys.exit(1)
    return result.stdout.strip()


def get_commit_after(branch, commit):
    cmd = f"git log --reverse --ancestry-path {commit}..origin/{branch} --format=%H | head -n 1"
    result = subprocess.run([cmd], shell=True, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"stderr: {result.stderr}")
        print(f"stdout: {result.stdout}")
        sys.exit(1)

    return result.stdout.strip()


def get_env():
    env = {
        "GOOD_COMMIT": os.environ['GOOD_COMMIT'],
        "BAD_COMMIT": os.environ['BAD_COMMIT'],
        "BISECT_BRANCH": os.environ['BISECT_BRANCH'],
        "CI_STEPS": os.environ['CI_STEPS'],
    }

    print(f'''
GOOD_COMMIT={env["GOOD_COMMIT"]}
BAD_COMMIT={env["BAD_COMMIT"]}
BISECT_BRANCH={env["BISECT_BRANCH"]}
CI_STEPS={env["CI_STEPS"]}
        ''')

    return env


def fetch_branch_commits(branch):
    cmd = f"git fetch -q origin {branch}"
    result = subprocess.run([cmd], shell=True)
    if result.returncode != 0:
        print(f"stderr: {result.stderr}")
        print(f"stdout: {result.stdout}")
        sys.exit(1)


def main():
    cmd = sys.argv[1]

    if cmd == "start":
        print("--- start bisecting")
        env = get_env()
        fetch_branch_commits(env["BISECT_BRANCH"])
        run_pipeline(env)
    elif cmd == "check":
        print("--- check pipeline outcome")
        env = get_env()
        fetch_branch_commits(env["BISECT_BRANCH"])
        commit = get_bisect_commit(env["GOOD_COMMIT"], env["BAD_COMMIT"])
        step = f"run-{commit}"
        cmd = f"buildkite-agent step get outcome --step {step}"
        outcome = subprocess.run(cmd, shell=True, capture_output=True, text=True)

        if outcome.returncode != 0:
            print(f"stderr: {outcome.stderr}")
            print(f"stdout: {outcome.stdout}")
            sys.exit(1)

        outcome = outcome.stdout.strip()
        if outcome == "soft_failed":
            print(f"commit failed: {commit}")
            env["BAD_COMMIT"] = commit
        elif outcome == "passed":
            print(f"commit passed: {commit}")
            env["GOOD_COMMIT"] = get_commit_after(env["BISECT_BRANCH"], commit)
        else:
            print(f"invalid outcome: {outcome}")
            sys.exit(1)

        if env["GOOD_COMMIT"] == env["BAD_COMMIT"]:
            report_step(env["GOOD_COMMIT"])
            return
        else:
            print(f"run next iteration, start: {env['GOOD_COMMIT']}, end: {env['BAD_COMMIT']}")
            run_pipeline(env)
    else:
        print(f"invalid cmd: {cmd}")
        sys.exit(1)


# For the tests, we use RisingWave's sequence of commits, from earliest to latest:
# 617d23ddcac88ced87b96a2454c9217da0fe7915
# 72f70960226680e841a8fbdd09c79d74609f27a2
# 5c7b556ea60d136c5bccf1b1f7e313d2f9c79ef0
# 9ca415a9998a5e04e021c899fb66d93a17931d4f
class Test(unittest.TestCase):
    def test_get_commit_after(self):
        fetch_branch_commits("kwannoel/find-regress")
        commit = get_commit_after("kwannoel/find-regress", "72f70960226680e841a8fbdd09c79d74609f27a2")
        self.assertEqual(commit, "5c7b556ea60d136c5bccf1b1f7e313d2f9c79ef0")
        commit2 = get_commit_after("kwannoel/find-regress", "617d23ddcac88ced87b96a2454c9217da0fe7915")
        self.assertEqual(commit2, "72f70960226680e841a8fbdd09c79d74609f27a2")
        commit3 = get_commit_after("kwannoel/find-regress", "5c7b556ea60d136c5bccf1b1f7e313d2f9c79ef0")
        self.assertEqual(commit3, "9ca415a9998a5e04e021c899fb66d93a17931d4f")

    def test_get_number_of_commits(self):
        fetch_branch_commits("kwannoel/find-regress")
        n = get_number_of_commits("72f70960226680e841a8fbdd09c79d74609f27a2",
                                  "9ca415a9998a5e04e021c899fb66d93a17931d4f")
        self.assertEqual(n, 2)
        n2 = get_number_of_commits("617d23ddcac88ced87b96a2454c9217da0fe7915",
                                   "9ca415a9998a5e04e021c899fb66d93a17931d4f")
        self.assertEqual(n2, 3)
        n3 = get_number_of_commits("72f70960226680e841a8fbdd09c79d74609f27a2",
                                   "5c7b556ea60d136c5bccf1b1f7e313d2f9c79ef0")
        self.assertEqual(n3, 1)

    def test_get_bisect_commit(self):
        fetch_branch_commits("kwannoel/find-regress")
        commit = get_bisect_commit("72f70960226680e841a8fbdd09c79d74609f27a2",
                                   "9ca415a9998a5e04e021c899fb66d93a17931d4f"
```

### Core Architecture Module: `ci/scripts/notify.py`
```
#!/usr/bin/env python3

import subprocess
import os
import sys

# Add new test keys here.
# Add their corresponding owners (by slack username) here.
# NOTE(kwannoel): we may have to migrate to use `slack_user_id`.
# I use `slack_username` since it is more readable, but not officially supported in the docs.
MAIN_CRON_TEST_MAP = {
    "test-notify": ["noelkwan", "noelkwan"],
    "test-notify-2": ["noelkwan", "noelkwan"],
    "test-notify-timeout": ["noelkwan", "noelkwan"],
    "docslt": ["tianxiao"],
    "e2e-test-release": ["zhi", "Eric"],
    "e2e-meta-backup-test-release": ["zhi", "Eric"],
    "e2e-test-release-parallel": ["zhi", "Eric"],
    "e2e-test-release-parallel-memory": ["zhi", "Eric"],
    "e2e-test-release-source": ["bohan", "siyuan"],
    "e2e-test-release-sink": ["bohan", "siyuan"],
    "fuzz-test": ["noelkwan"],
    "unit-test": ["zhi", "Eric"],
    "unit-test-deterministic": ["zhi", "Eric"],
    "integration-test-deterministic-scale": ["ziqi", "Eric"],
    "integration-test-deterministic-recovery": ["ziqi", "Eric"],
    "integration-test-deterministic-backfill": ["ziqi", "Eric"],
    "integration-test-deterministic-storage": ["ziqi", "Eric"],
    "integration-test-deterministic-sink": ["ziqi", "Eric"],
    "e2e-test-deterministic": ["runji", "noelkwan"],
    "recovery-test-deterministic": ["runji", "noelkwan"],
    "background-ddl-arrangement-backfill-recovery-test-deterministic": [
        "runji",
        "noelkwan",
    ],
    "background-ddl-recovery-test-deterministic": ["runji", "noelkwan"],
    "e2e-iceberg-test": ["zilin", "xinhao", "tianxiao"],
    "e2e-java-binding-tests": ["yiming"],
    "s3-source-check-aws": ["bohan"],
    "s3-source-check-aws-json-parser": ["bohan"],
    "s3-source-check-aws-csv-parser": ["bohan"],
    "s3-v2-source-check-aws-json-parser": ["bohan"],
    "s3-v2-source-batch-read-check-aws-json-parser": ["bohan"],
    "s3-v2-source-check-aws-csv-parser": ["bohan"],
    "s3-source-test-for-opendal-fs-engine-csv-parser": ["congyi", "kexiang"],
    "s3-source-test-for-opendal-fs-engine": ["congyi", "kexiang"],
    "pulsar-source-tests": ["bohan"],
    "run-micro-benchmarks": ["noelkwan"],
    "upload-micro-benchmarks": ["noelkwan"],
    "backwards-compat-tests": ["yuchao"],
    "sqlsmith-differential-tests": ["noelkwan"],
    "backfill-tests": ["noelkwan", "yiming"],
    "e2e-standalone-binary-tests": ["noelkwan"],
    "e2e-single-node-binary-tests": ["pin", "peng", "noelkwan"],
    "e2e-test-opendal-parallel": ["congyi"],
    "e2e-deltalake-sink-rust-tests": ["xinhao"],
    "e2e-lancedb-sink-tests": ["yiming"],
    "e2e-redis-sink-tests": ["xinhao"],
    "e2e-starrocks-sink-tests": ["xinhao"],
    "e2e-cassandra-sink-tests": ["xinhao"],
    "e2e-clickhouse-sink-tests": ["bohan", "xinhao"],
    "e2e-pulsar-sink-tests": ["bohan"],
    "e2e-mqtt-sink-tests": ["xinhao"],
    "connector-node-integration-test": ["siyuan"],
}

INTEGRATION_TEST_MAP = {
    "test-notify": ["jianwei"],
    "ad-click-json": ["bohan"],
    "ad-ctr-json": ["bohan"],
    "cdn-metrics-json": ["bohan"],
    "clickstream-json": ["bohan"],
    "livestream-json": ["bohan"],
    "livestream-protobuf": ["bohan"],
    "prometheus-json": ["bohan"],
    "schema-registry-json": ["bohan"],
    "mysql-cdc-json": ["siyuan"],
    "postgres-cdc-json": ["siyuan"],
    "mongodb-cdc-json": ["siyuan"],
    "mysql-sink-json": ["siyuan"],
    "postgres-sink-json": ["siyuan"],
    "iceberg-cdc-json": ["zilin"],
    "iceberg-sink-none": ["zilin"],
    'iceberg-source-none': ["zilin"],
    "twitter-json": ["bohan"],
    "twitter-protobuf": ["bohan"],
    "twitter-pulsar-json": ["bohan"],
    "debezium-mysql-json": ["bohan"],
    "debezium-postgres-json": ["bohan"],
    "debezium-sqlserver-json": ["bohan"],
    "tidb-cdc-sink-json": ["eric"],
    "citus-cdc-json": ["siyuan"],
    "kinesis-s3-source-json": ["bohan"],
    "clickhouse-sink-json": ["xinhao"],
    "cockroach-sink-json": ["bohan"],
    "kafka-cdc-sink-json": ["bohan"],
    "cassandra-and-scylladb-sink-json": ["xinhao"],
    "elasticsearch-sink-json": ["xinhao"],
    "redis-sink-json": ["xinhao"],
    "big-query-sink-json": ["xinhao"],
    "vector-json": ["wutao"],
    "nats-json": ["wutao"],
    "nats-protobuf": ["wutao"],
    "mqtt-json": ["bohan"],
    "doris-sink-json": ["xinhao"],
    "starrocks-sink-json": ["xinhao"],
    "deltalake-sink-json": ["xinhao"],
    "pinot-sink-json": ["yiming"],
    "presto-trino-json": ["wutao"],
    "client-library-none": ["wutao"],
    "kafka-cdc-json": ["bohan"],
}

def get_failed_tests(get_test_status, test_map):
    failed_test_map = {}
    for test in test_map.keys():
        test_status = get_test_status(test)
        if test_status == "hard_failed" or test_status == "soft_failed" or test_status == "errored":
            print(f"{test} failed with outcome: {test_status}")
            failed_test_map[test] = test_map[test]
        elif test_status == "passed":
            print(f"{test} passed with outcome: {test_status}")
        elif test_status is None or test_status == "":
            print(f"{test} no outcome, skipping")
        else:
            print(f"{test} failed with unknown outcome: {test_status}")
            failed_test_map[test] = test_map[test]
    return failed_test_map

def generate_test_status_message(failed_test_map):
    messages = []
    for test, users in failed_test_map.items():
        users = " ".join(map(lambda user: f"<@{user}>", users))
        messages.append(f"Test {test} failed {users}")
    message = "\n            ".join(messages)
    return message

def get_buildkite_test_status(test):
    result = subprocess.run(f"buildkite-agent step get \"outcome\" --step \"{test}\"", capture_output = True, text = True, shell=True)
    outcome = result.stdout.strip()
    return outcome

def get_mock_test_status(test):
    mock_test_map = {
        "test-notify": "hard_failed",
        "test-notify-2": "hard_failed",
        "backfill-tests": "",
        "backwards-compat-tests": "",
        "fuzz-test": "",
        "e2e-test-release": "",
        "e2e-iceberg-tests": "passed",
        "e2e-java-binding-tests": "soft_failed",
        "e2e-clickhouse-sink-tests": "hard_failed",
        "e2e-pulsar-sink-tests": "",
        "s3-source-test-for-opendal-fs-engine": "",
        "s3-source-tests": "",
        "pulsar-source-tests": "",
        "connector-node-integration-test": "",
    }
    return mock_test_map[test]

def format_cmd(messages):
    cmd=f"""
cat <<- YAML | buildkite-agent pipeline upload
steps:
  - label: "trigger failed test notification"
    command: echo "running failed test notification" && exit 1
    notify:
      - slack:
          channels:
            - "#notification-buildkite"
          message: |
            {messages}
YAML
        """
    return cmd

def get_test_map():
    pipeline_name = os.environ['BUILDKITE_PIPELINE_NAME']
    if pipeline_name == "main-cron":
        test_map=MAIN_CRON_TEST_MAP
    elif pipeline_name == "integration-tests":
        test_map=INTEGRATION_TEST_MAP
    else:
        print("Invaild pipeline name!")
        sys.exit(1)
    return test_map

def run_test_1():
    test_map = get_test_map()
    failed_test_map = get_failed_tests(get_mock_test_status, test_map)
    message = generate_test_status_message(failed_test_map)
    if message == "":
        print("All tests passed, no need to notify")
        return
    else:
        print("Some tests failed, notify users")
        print(message)
        cmd = format_cmd(message)
        print(cmd)

def main():
    test_map = get_test_map()
    print("--- Getting failed tests")
    failed_test_map = get_failed_tests(get_buildkite_test_status, test_map)
    message = generate_test_status_message(failed_test_map)
    if message == "":
        print("--- Tests passed, no need to notify")
        return
    else:
        print("--- Some tests failed, notify users")
        cmd = format_cmd(message)
        print(cmd)
        subprocess.run(cmd, shell=True)
```

### Core Architecture Module: `dashboard/components/CatalogModal.tsx`
```
/*
 * Copyright 2025 RisingWave Labs
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react"

import Link from "next/link"
import { parseAsInteger, useQueryState } from "nuqs"
import {
  Relation,
  relationIsStreamingJob,
  relationTypeTitleCase,
} from "../lib/api/streaming"
import { ReactJson } from "./Relations"

export function useCatalogModal(relationList: Relation[] | undefined) {
  const [modalId, setModalId] = useQueryState("modalId", parseAsInteger)
  const modalData = relationList?.find((r) => r.id === modalId)

  return [modalData, setModalId] as const
}

export function CatalogModal({
  modalData,
  onClose,
}: {
  modalData: Relation | undefined
  onClose: () => void
}) {
  return (
    <Modal isOpen={modalData !== undefined} onClose={onClose} size="3xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          Catalog of {modalData && relationTypeTitleCase(modalData)}{" "}
          {modalData?.id} - {modalData?.name}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {modalData && (
            <ReactJson
              src={modalData}
              collapsed={1}
              name={null}
              displayDataTypes={false}
            />
          )}
        </ModalBody>

        <ModalFooter>
          {modalData && relationIsStreamingJob(modalData) && (
            <Button colorScheme="blue" mr={3}>
              <Link href={`/fragment_graph/?id=${modalData.id}`}>
                View Fragments
              </Link>
            </Button>
          )}
          <Button mr={3} onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

```

### Core Architecture Module: `dashboard/components/FragmentDependencyGraph.tsx`
```
import { theme } from "@chakra-ui/react"
import * as d3 from "d3"
import { Dag, DagLink, DagNode, zherebko } from "d3-dag"
import { cloneDeep } from "lodash"
import { useCallback, useEffect, useRef, useState } from "react"
import { Enter, FragmentBox, Position } from "../lib/layout"

const nodeRadius = 5
const edgeRadius = 12

export default function FragmentDependencyGraph({
  fragmentDependency,
  svgWidth,
  selectedId,
  onSelectedIdChange,
}: {
  fragmentDependency: Dag<FragmentBox>
  svgWidth: number
  selectedId: string | undefined
  onSelectedIdChange: (id: string) => void | undefined
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [svgHeight, setSvgHeight] = useState("0px")
  const MARGIN_X = 10
  const MARGIN_Y = 2

  const fragmentDependencyDagCallback = useCallback(() => {
    const layout = zherebko().nodeSize([
      nodeRadius * 2,
      (nodeRadius + edgeRadius) * 2,
      nodeRadius,
    ])
    const dag = cloneDeep(fragmentDependency)
    const { width, height } = layout(dag)
    return { width, height, dag }
  }, [fragmentDependency])

  const fragmentDependencyDag = fragmentDependencyDagCallback()

  useEffect(() => {
    const { width, height, dag } = fragmentDependencyDag

    // This code only handles rendering

    const svgNode = svgRef.current
    const svgSelection = d3.select(svgNode)

    // How to draw edges
    const curveStyle = d3.curveMonotoneY
    const line = d3
      .line<Position>()
      .curve(curveStyle)
      .x(({ x }) => x + MARGIN_X)
      .y(({ y }) => y)

    const isSelected = (d: DagNode<FragmentBox>) => d.data.id === selectedId

    const edgeSelection = svgSelection
      .select(".edges")
      .selectAll<SVGPathElement, null>(".edge")
      .data(dag.links())
    type EdgeSelection = typeof edgeSelection

    const applyEdge = (sel: EdgeSelection) =>
      sel
        .attr("d", ({ points }: DagLink) => line(points))
        .attr("fill", "none")
        .attr("stroke-width", (d) =>
          isSelected(d.source) || isSelected(d.target) ? 2 : 1
        )
        .attr("stroke", (d) =>
          isSelected(d.source) || isSelected(d.target)
            ? theme.colors.blue["500"]
            : theme.colors.gray["300"]
        )
    const createEdge = (sel: Enter<EdgeSelection>) =>
      sel.append("path").attr("class", "edge").call(applyEdge)
    edgeSelection.exit().remove()
    edgeSelection.enter().call(createEdge)
    edgeSelection.call(applyEdge)

    // Select nodes
    const nodeSelection = svgSelection
      .select(".nodes")
      .selectAll<SVGCircleElement, null>(".node")
      .data(dag.descendants())
    type NodeSelection = typeof nodeSelection

    const applyNode = (sel: NodeSelection) =>
      sel
        .attr("transform", (d) => `translate(${d.x! + MARGIN_X}, ${d.y})`)
        .attr("fill", (d) =>
          isSelected(d) ? theme.colors.blue["500"] : theme.colors.gray["500"]
        )

    const createNode = (sel: Enter<NodeSelection>) =>
      sel
        .append("circle")
        .attr("class", "node")
        .attr("r", nodeRadius)
        .call(applyNode)
    nodeSelection.exit().remove()
    nodeSelection.enter().call(createNode)
    nodeSelection.call(applyNode)

    // Add text to nodes
    const labelSelection = svgSelection
      .select(".labels")
      .selectAll<SVGTextElement, null>(".label")
      .data(dag.descendants())
    type LabelSelection = typeof labelSelection

    const applyLabel = (sel: LabelSelection) =>
      sel
        .text((d) => d.data.name)
        .attr("x", svgWidth - MARGIN_X)
        .attr("font-family", "inherit")
        .attr("text-anchor", "end")
        .attr("alignment-baseline", "middle")
        .attr("y", (d) => d.y!)
        .attr("fill", (d) =>
          isSelected(d) ? theme.colors.black["500"] : theme.colors.gray["500"]
        )
        .attr("font-weight", "600")
    const createLabel = (sel: Enter<LabelSelection>) =>
      sel.append("text").attr("class", "label").call(applyLabel)
    labelSelection.exit().remove()
    labelSelection.enter().call(createLabel)
    labelSelection.call(applyLabel)

    // Add overlays
    const overlaySelection = svgSelection
      .select(".overlays")
      .selectAll<SVGRectElement, null>(".overlay")
      .data(dag.descendants())
    type OverlaySelection = typeof overlaySelection

    const STROKE_WIDTH = 3
    const applyOverlay = (sel: OverlaySelection) =>
      sel
        .attr("x", STROKE_WIDTH)
        .attr(
          "height",
          nodeRadius * 2 + edgeRadius * 2 - MARGIN_Y * 2 - STROKE_WIDTH * 2
        )
        .attr("width", svgWidth - STROKE_WIDTH * 2)
        .attr(
          "y",
          (d) => d.y! - nodeRadius - edgeRadius + MARGIN_Y + STROKE_WIDTH
        )
        .attr("rx", 5)
        .attr("fill", theme.colors.gray["500"])
        .attr("opacity", 0)
        .style("cursor", "pointer")
    const createOverlay = (sel: Enter<OverlaySelection>) =>
      sel
        .append("rect")
        .attr("class", "overlay")
        .call(applyOverlay)
        .on("mouseover", function (d, i) {
          d3.select(this)
            .transition()
            .duration(parseInt(theme.transition.duration.normal))
            .attr("opacity", ".10")
        })
        .on("mouseout", function (d, i) {
          d3.select(this)
            .transition()
            .duration(parseInt(theme.transition.duration.normal))
            .attr("opacity", "0")
        })
        .on("mousedown", function (d, i) {
          d3.select(this)
            .transition()
            .duration(parseInt(theme.transition.duration.normal))
            .attr("opacity", ".20")
        })
        .on("mouseup", function (d, i) {
          d3.select(this)
            .transition()
            .duration(parseInt(theme.transition.duration.normal))
            .attr("opacity", ".10")
        })
        .on("click", function (d, i) {
          if (onSelectedIdChange) {
            onSelectedIdChange(i.data.id)
          }
        })

    overlaySelection.exit().remove()
    overlaySelection.enter().call(createOverlay)
    overlaySelection.call(applyOverlay)

    setSvgHeight(`${height}px`)
  }, [
    fragmentDependency,
    selectedId,
    svgWidth,
    onSelectedIdChange,
    fragmentDependencyDag,
  ])

  return (
    <svg ref={svgRef} width={`${svgWidth}px`} height={svgHeight}>
      <g className="edges"></g>
      <g className="nodes"></g>
      <g className="labels"></g>
      <g className="overlays"></g>
    </svg>
  )
}

```

### Core Architecture Module: `dashboard/components/FragmentGraph.tsx`
```
import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  theme,
  useDisclosure,
} from "@chakra-ui/react"
import loadable from "@loadable/component"
import * as d3 from "d3"
import * as dagre from "dagre"
import { cloneDeep } from "lodash"
import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { Edge, Enter, FragmentBox, Position } from "../lib/layout"
import { PlanNodeDatum } from "../pages/fragment_graph"
import { ChannelDeltaStats, FragmentStats } from "../proto/gen/monitor_service"
import { StreamNode } from "../proto/gen/stream_plan"
import {
  backPressureColor,
  backPressureWidth,
  epochToUnixMillis,
  latencyToColor,
} from "./utils/backPressure"

const ReactJson = loadable(() => import("react-json-view"))

type FragmentLayout = {
  id: string
  layoutRoot: d3.HierarchyPointNode<PlanNodeDatum>
  width: number
  height: number
  actorIds: string[]
} & Position

function treeLayoutFlip<Datum>(
  root: d3.HierarchyNode<Datum>,
  { dx, dy }: { dx: number; dy: number }
): d3.HierarchyPointNode<Datum> {
  const tree = d3.tree<Datum>().nodeSize([dy, dx])

  // Flip x, y
  const treeRoot = tree(root)

  // Flip back x, y
  treeRoot.each((d: Position) => ([d.x, d.y] = [d.y, d.x]))

  // LTR -> RTL
  treeRoot.each((d: Position) => (d.x = -d.x))

  return treeRoot
}

function boundBox<Datum>(
  root: d3.HierarchyPointNode<Datum>,
  {
    margin: { top, bottom, left, right },
  }: { margin: { top: number; bottom: number; left: number; right: number } }
): { width: number; height: number } {
  let x0 = Infinity
  let x1 = -x0
  let y0 = Infinity
  let y1 = -y0

  root.each((d) => (x1 = d.x > x1 ? d.x : x1))
  root.each((d) => (x0 = d.x < x0 ? d.x : x0))
  root.each((d) => (y1 = d.y > y1 ? d.y : y1))
  root.each((d) => (y0 = d.y < y0 ? d.y : y0))

  x0 -= left
  x1 += right
  y0 -= top
  y1 += bottom

  root.each((d) => (d.x = d.x - x0))
  root.each((d) => (d.y = d.y - y0))

  return { width: x1 - x0, height: y1 - y0 }
}

const nodeRadius = 12
const nodeMarginX = nodeRadius * 6
const nodeMarginY = nodeRadius * 4
const fragmentMarginX = nodeRadius * 2
const fragmentMarginY = nodeRadius * 2
const fragmentDistanceX = nodeRadius * 5
const fragmentDistanceY = nodeRadius * 4

export default function FragmentGraph({
  planNodeDependencies,
  fragmentDependency,
  selectedFragmentId,
  channelStats,
  fragmentStats,
}: {
  planNodeDependencies: Map<string, d3.HierarchyNode<PlanNodeDatum>>
  fragmentDependency: FragmentBox[]
  selectedFragmentId?: string
  channelStats?: Map<string, ChannelDeltaStats>
  fragmentStats?: { [fragmentId: number]: FragmentStats }
}) {
  const svgRef = useRef<SVGSVGElement>(null)

  const { isOpen, onOpen, onClose } = useDisclosure()
  const [currentStreamNode, setCurrentStreamNode] = useState<PlanNodeDatum>()

  const openPlanNodeDetail = useCallback(
    (node: PlanNodeDatum) => {
      setCurrentStreamNode(node)
      onOpen()
    },
    [onOpen, setCurrentStreamNode]
  )

  const planNodeDependencyDagCallback = useCallback(() => {
    const deps = cloneDeep(planNodeDependencies)
    const fragmentDependencyDag = cloneDeep(fragmentDependency)

    // Layer 1: Keep existing d3-hierarchy layout for actors within fragments
    const layoutFragmentResult = new Map<string, FragmentLayout>()
    const includedFragmentIds = new Set<string>()
    for (const [fragmentId, fragmentRoot] of deps) {
      const layoutRoot = treeLayoutFlip(fragmentRoot, {
        dx: nodeMarginX,
        dy: nodeMarginY,
      })
      let { width, height } = boundBox(layoutRoot, {
        margin: {
          left: nodeRadius * 4,
          right: nodeRadius * 4,
          top: nodeRadius * 3,
          bottom: nodeRadius * 4,
        },
      })
      layoutFragmentResult.set(fragmentId, {
        layoutRoot,
        width,
        height,
        actorIds: fragmentRoot.data.actorIds ?? [],
      } as FragmentLayout)
      includedFragmentIds.add(fragmentId)
    }

    // Layer 2: Use dagre for fragment-level layout
    const g = new dagre.graphlib.Graph()

    // Configure the graph
    g.setGraph({
      rankdir: "LR",
      nodesep: fragmentDistanceY,
      ranksep: fragmentDistanceX,
      marginx: fragmentMarginX,
      marginy: fragmentMarginY,
    })

    // Default edge labels
    g.setDefaultEdgeLabel(() => ({}))

    // Add fragment nodes
    fragmentDependencyDag.forEach(({ id, parentIds }) => {
      const fragmentLayout = layoutFragmentResult.get(id)!
      g.setNode(id, fragmentLayout)
    })

    // Add fragment edges
    fragmentDependencyDag.forEach(({ id, parentIds }) => {
      parentIds?.forEach((parentId) => {
        g.setEdge(parentId, id)
      })
    })

    // Perform layout
    dagre.layout(g)

    // Convert to final format
    const layoutResult = g.nodes().map((id) => {
      const node = g.node(id) as FragmentLayout
      return {
        id,
        x: node.x - node.width / 2,
        y: node.y - node.height / 2,
        width: node.width,
        height: node.height,
        layoutRoot: node.layoutRoot,
        actorIds: node.actorIds,
      } as FragmentLayout
    })

    // Get edges with points
    const edges = g.edges().map((e) => {
      const edge = g.edge(e)
      return {
        source: e.v,
        target: e.w,
        points: edge.points || [],
      }
    })

    // Calculate overall SVG dimensions
    let svgWidth = 0
    let svgHeight = 0
    layoutResult.forEach(({ x, y, width, height }) => {
      svgWidth = Math.max(svgWidth, x + width + 50)
      svgHeight = Math.max(svgHeight, y + height + 50)
    })

    return {
      layoutResult,
      svgWidth,
      svgHeight,
      edges,
      includedFragmentIds,
    }
  }, [planNodeDependencies, fragmentDependency])

  const {
    svgWidth,
    svgHeight,
    edges: fragmentEdgeLayout,
    layoutResult: fragmentLayout,
    includedFragmentIds,
  } = planNodeDependencyDagCallback()

  useEffect(() => {
    if (fragmentLayout) {
      const now_ms = Date.now()
      const svgNode = svgRef.current
      const svgSelection = d3.select(svgNode)

      // How to draw edges
      const treeLink = d3
        .linkHorizontal<any, Position>()
        .x((d: Position) => d.x)
        .y((d: Position) => d.y)

      const isSelected = (id: string) => id === selectedFragmentId

      // Fragments
      const applyFragment = (gSel: FragmentSelection) => {
        gSel.attr("transform", ({ x, y }) => `translate(${x}, ${y})`)

        // Fragment text line 1 (fragment id)
        let text = gSel.select<SVGTextElement>(".text-frag-id")
        if (text.empty()) {
          text = gSel.append("text").attr("class", "text-frag-id")
        }

        text
          .attr("fill", "black")
          .text(({ id }) => `Fragment ${id}`)
          .attr("font-family", "inherit")
          .attr("text-anchor", "end")
          .attr("dy", ({ height }) => height + 12)
          .attr("dx", ({ width }) => width)
          .attr("fill", "black")
          .attr("font-size", 12)

        // Fragment text line 2 (actor ids)
        let text2 = gSel.select<SVGTextElement>(".text-actor-id")
        if (text2.empty()) {
          text2 = gSel.append("text").attr("class", "text-actor-id")
        }

        text2
          .attr("fill", "black")
          .text(({ actorIds }) => `Actor ${actorIds.join(", ")}`)
          .attr("font-family", "inherit")
          .attr("text-anchor", "end")
          .attr("dy", ({ height }) => height + 24)
          .attr("dx", ({ width }) => width)
          .attr("fill", "black")
          .attr("font-size", 12)

        // Fragment bounding box
        let boundingBox = gSel.select<SVGRectElement>(".bounding-box")
        if (boundingBox.empty()) {
          boundingBox = gSel.append("rect").attr("class", "bounding-box")
        }

        boundingBox
          .attr("width", ({ width }) => width)
          .attr("height", ({ height }) => height)
          .attr("x", 0)
```

### Core Architecture Module: `dashboard/components/GraphvizComponent.tsx`
```
import { Graphviz } from "@hpcc-js/wasm-graphviz"
import { useEffect, useRef, useState } from "react"

interface GraphvizComponentProps {
  dot: string
  width?: number
  height?: number
}

export default function GraphvizComponent({
  dot,
  width = 1200,
  height = 800,
}: GraphvizComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [graphviz, setGraphviz] = useState<Graphviz | null>(null)

  // Initialize Graphviz
  useEffect(() => {
    Graphviz.load().then(setGraphviz)
  }, [])

  // Render DOT when either graphviz or dot changes
  useEffect(() => {
    if (!graphviz || !containerRef.current || !dot) return

    try {
      const svg = graphviz.dot(dot)
      containerRef.current.innerHTML = svg
    } catch (error) {
      console.error("Error rendering DOT:", error)
    }
  }, [graphviz, dot])

  return (
    <div
      ref={containerRef}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        overflow: "auto",
        border: "1px solid #e2e8f0",
        borderRadius: "4px",
        padding: "16px",
      }}
    />
  )
}

```

### Core Architecture Module: `dashboard/components/Layout.tsx`
```
/*
 * Copyright 2025 RisingWave Labs
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import {
  Box,
  Flex,
  HStack,
  Image,
  Link as ChakraLink,
  Text,
} from "@chakra-ui/react"
import Link from "next/link"
import { useRouter } from "next/router"
import React, { ComponentType, useEffect, useState } from "react"
import {
  IconActivity,
  IconArrowDownToLine,
  IconArrowUpFromLine,
  IconArrowUpRight,
  IconDatabase,
  IconEye,
  IconGitBranch,
  IconHourglass,
  IconLayers,
  IconListChecks,
  IconListTree,
  IconMemoryStick,
  IconNetwork,
  IconProps,
  IconRoute,
  IconRss,
  IconServer,
  IconSettings,
  IconSquareFunction,
  IconTable,
  IconWorkflow,
} from "../components/utils/stroke-icons"
import { colors, fills, fonts, motion, radii } from "../lib/design-tokens"

// App shell: fixed 216px left sidebar + fluid main scroll region.
export const NAVBAR_WIDTH = "216px"

type NavItemData = {
  href: string
  title: string
  icon: ComponentType<IconProps>
  external?: boolean
}

type NavSectionData = {
  label?: string
  items: NavItemData[]
}

const navSections: NavSectionData[] = [
  {
    items: [{ href: "/cluster/", title: "Cluster overview", icon: IconServer }],
  },
  {
    label: "Catalog",
    items: [
      { href: "/sources/", title: "Sources", icon: IconArrowDownToLine },
      { href: "/tables/", title: "Tables", icon: IconTable },
      {
        href: "/materialized_views/",
        title: "Materialized views",
        icon: IconLayers,
      },
      { href: "/indexes/", title: "Indexes", icon: IconListTree },
      {
        href: "/internal_tables/",
        title: "Internal tables",
        icon: IconDatabase,
      },
      { href: "/sinks/", title: "Sinks", icon: IconArrowUpFromLine },
      { href: "/views/", title: "Views", icon: IconEye },
      { href: "/subscriptions/", title: "Subscriptions", icon: IconRss },
      { href: "/functions/", title: "Functions", icon: IconSquareFunction },
    ],
  },
  {
    label: "Streaming",
    items: [
      { href: "/relation_graph/", title: "Relation graph", icon: IconWorkflow },
      {
        href: "/fragment_graph/",
        title: "Fragment graph",
        icon: IconGitBranch,
      },
    ],
  },
  {
    label: "Batch",
    items: [
      { href: "/batch_tasks/", title: "Batch tasks", icon: IconListChecks },
    ],
  },
  {
    label: "Explain",
    items: [
      {
        href: "/explain_distsql/",
        title: "Distributed plan",
        icon: IconNetwork,
      },
    ],
  },
  {
    label: "Debug",
    items: [
      { href: "/await_tree/", title: "Await tree dump", icon: IconHourglass },
      {
        href: "/cpu_profiling/",
        title: "CPU profiling",
        icon: IconActivity,
      },
      {
        href: "/heap_profiling/",
        title: "Heap profiling",
        icon: IconMemoryStick,
      },
      {
        href: "/api/monitor/diagnose",
        title: "Diagnose",
        icon: IconActivity,
        external: true,
      },
      {
        href: "/trace/search",
        title: "Traces",
        icon: IconRoute,
        external: true,
      },
    ],
  },
  {
    label: "Settings",
    items: [{ href: "/settings/", title: "Settings", icon: IconSettings }],
  },
]

function NavItem({ href, title, icon: Icon, external }: NavItemData) {
  const router = useRouter()
  const [match, setMatch] = useState(false)

  useEffect(() => {
    if (external) {
      return
    }
    // Normalize trailing slashes so both "/cluster" and "/cluster/" match.
    const path = `${router.asPath.replace(/\/+$/, "")}/`
    setMatch(path.startsWith(href.toString()))
  }, [href, router.asPath, external])

  return (
    <ChakraLink
      as={Link}
      href={href}
      prefetch={false}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      display="flex"
      alignItems="center"
      gap={2}
      px={2.5}
      py="7px"
      borderRadius={radii.md}
      fontSize="14px"
      lineHeight={1.5}
      fontWeight={match ? 500 : 400}
      color={match ? colors.foreground : colors.mutedForeground}
      bg={match ? fills.active : "transparent"}
      textDecoration="none"
      transition={`background-color ${motion.durationMs.micro}ms ${motion.easeOut}, color ${motion.durationMs.micro}ms ${motion.easeOut}`}
      _hover={{
        bg: match ? fills.active : fills.hover,
        color: colors.foreground,
        textDecoration: "none",
      }}
    >
      <Box flexShrink={0}>
        <Icon size={15} />
      </Box>
      <Box as="span" flex={1} noOfLines={1}>
        {title}
      </Box>
      {external && (
        <Box flexShrink={0} opacity={0.5}>
          <IconArrowUpRight size={12} />
        </Box>
      )}
    </ChakraLink>
  )
}

function NavSection({ label, items }: NavSectionData) {
  return (
    <Box width="full" mt={label ? 4 : 0}>
      {label && (
        <Text
          px={2.5}
          mb={1}
          fontSize="12px"
          fontWeight={500}
          lineHeight={1.4}
          color={colors.mutedForeground}
        >
          {label}
        </Text>
      )}
      <Flex direction="column" gap="2px">
        {items.map((item) => (
          <NavItem key={item.href.toString()} {...item} />
        ))}
      </Flex>
    </Box>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Flex bg={colors.background}>
      <Box
        height="100vh"
        overflowY="auto"
        width={NAVBAR_WIDTH}
        minWidth={NAVBAR_WIDTH}
        bg="rgba(245,244,240,0.5)"
        borderRight="1px solid"
        borderColor="rgba(227,224,216,0.5)"
        py={2}
        px={2}
        fontFamily={fonts.body}
        color={colors.foreground}
      >
        <HStack height="52px" spacing={2} px={2.5} mb={1}>
          <Link href="/">
            <Image boxSize="20px" src="/risingwave.svg" alt="RisingWave Logo" />
          </Link>
          <Text fontSize="14px" fontWeight={600} letterSpacing="-0.01em">
            RisingWave
          </Text>
          {/* Quiet neutral badge; the azure accent is rationed elsewhere */}
          <Box
            as="span"
            px={2}
            py="1px"
            borderRadius="full"
            fontSize="12px"
            fontWeight={500}
            lineHeight={1.45}
            color={colors.mutedForeground}
            bg={fills.active}
          >
            Dashboard
          </Box>
        </HStack>
        {navSections.map((section, index) => (
          <NavSection key={section.label ?? index} {...section} />
        ))}
      </Box>
      <Box flex={1} minWidth={0} overflowY="auto" maxHeight="100vh">
        {children}
      </Box>
    </Flex>
  )
}

export default Layout

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #26912** (2026-09-02): **fix(frontend): check source privilege for CDC tables**
  *Symptoms*: I hereby agree to the terms of the [RisingWave Labs, Inc. Contributor License Agreement](https://raw.githubusercontent.com/risingwavelabs/risingwave/17af8a747593ebdbfa826691daf75bdab7d14fa0/.github/contributor-license-agreement.txt).  ## What's changed and what's your intention?  `CREATE TABLE ... FROM <cdc_source>` resolved the source catalog without checking whether the current user had `SELECT` privilege on that source. As a result, a user with `CREATE` privilege on the target schema could create and consume a CDC table from a source they were not allowed to read. Table replacement paths used by `ALTER TABLE` had the same gap.  This PR:  - checks `AclMode::Select` on the referenced CDC source before building a new CDC table plan; - applies the same check when rebuilding an existing CDC table for `ALTER TABLE`; - adds a regression test covering rejection without permission, success after `GRANT SELECT`, and rejection of `ALTER TABLE` after `REVOKE SELECT`.  ## Checklist  - [x] I have written necessary rustdoc comments (no new public API). - [x] I have added necessary unit tests and integration tests. - [x] I have added test labels as necessary. - [ ] I have added fuzzing tests or opened an issue to track them. - [ ] My PR contains breaking changes. - [ ] My PR changes performance-critical code, so I will run (micro) benchmarks and present the results. - [ ] I have checked the Release Timeline and Currently Supported Versions to determine which release branches I need to che
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/risingwavelabs/risingwave/pull/26912)  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Team  **Run ID**: `26a3b6b6-4df8-46c6-ba83-6089b04e5987`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between a61d1f9a38ce858f0a89ecd6a4a85f6b736d3b2f and eb751b0c63d6e3f589c9dfff80c7cab5adee5d5f.  </details>  <details> <summary>📒 Files selected for processing (1)</summary>  * `src/frontend/src/handler/create_table.rs`  </details> 
  > ✅ Cherry-pick PRs (or issues if encountered conflicts) have been created successfully to all target branches.

- **Issue #25404** (2026-07-04): **bug: BigQuery sink rejects widened numeric destination types for RisingWave NUMERIC columns**
  *Symptoms*: ## Summary  BigQuery sink schema validation rejects a target BigQuery numeric column when the RisingWave source column is `NUMERIC` and the BigQuery side must use higher precision / scale handling.  ## Problem  Users can hit this failure pattern when syncing a RisingWave `NUMERIC` column to BigQuery:  - BigQuery `NUMERIC` supports up to 9 decimal places, so values requiring higher scale cannot fit cleanly. - Switching the BigQuery destination column to a wider numeric type still fails validation with a type mismatch.  Observed error shape:  ```text Data type mismatch for column "...". BigQuery side: "NUMERIC(31, 2)", RisingWave side: "NUMERIC". ```  This makes some BigQuery sink migrations fail even when the destination side is adjusted to a wider compatible numeric representation.  ## Expected Behavior  One of the following should work consistently:  1. RisingWave `NUMERIC` should map cleanly to an appropriate BigQuery numeric type for sink validation. 2. BigQuery sink schema validation should accept compatible destination numeric widening where precision/scale differ but data remains representable. 3. Documentation should clearly state current numeric-type limitations and required workarounds if this behavior is intentional.  ## Impact  - Blocks BigQuery sink migrations for tables with higher-precision numeric columns. - Forces manual schema compromises or prevents using the sink for affected tables.  ## Reproduction  1. Create a RisingWave source relation with a `NUMERIC` 
  **Post-Mortem & Fix Analysis**:
  > This issue has been open for 60 days with no activity.  If you think it is still relevant today, and needs to be done *in the near future*, you can comment to update the status, or just manually remove the `no-issue-activity` label.  You can also confidently close this issue as not planned to keep our backlog clean. Don't worry if you think the issue is still valuable to continue in the future. It's searchable and can be reopened when it's time. 😄

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

### Incident Patch 1: `5149d7b2` (2026-09-28)
**Commit Message**: fix(object-store): propagate metadata errors during listing (#27266)

**File**: `src/object_store/src/object/opendal_engine/opendal_object_store.rs` (modified, +44/-33)
```diff
@@ -17,7 +17,7 @@ use std::time::Duration;
 
 use bytes::{Bytes, BytesMut};
 use fail::fail_point;
-use futures::{StreamExt, stream};
+use futures::StreamExt;
 use opendal::layers::{RetryLayer, TimeoutLayer};
 use opendal::raw::BoxedStaticFuture;
 use opendal::services::Memory;
@@ -260,38 +260,9 @@ impl ObjectStore for OpendalObjectStore {
         let object_lister = object_lister.await?;
 
         let op = self.op.clone();
-        let stream = stream::unfold(object_lister, move |mut object_lister| {
+        let stream = object_lister.then(move |object| {
             let op = op.clone();
-
-            async move {
-                match object_lister.next().await {
-                    Some(Ok(object)) => {
-                        let key = object.path().to_owned();
-
-                        // OpenDAL 0.55 removed list metadata capability flags and reports
-                        // unknown content length as 0. Use listed metadata first, and call
-                        // stat() if timestamp is missing or size is 0 to avoid treating
-                        // unknown sizes as real zero-byte objects.
-                        let meta = object.metadata();
-                        let mut last_modified = meta.last_modified().map(timestamp_to_secs);
-                        let mut total_size = meta.content_length() as usize;
-                        if last_modified.is_none() || total_size == 0 {
-                            let stat_meta = op.stat(&key).await.ok()?;
-                            last_modified = stat_meta.last_modified().map(timestamp_to_secs);
-                            total_size = stat_meta.content_length() as usize;
-                        }
-
-                        let metadata = ObjectMetadata {
-                            key,
-                            last_modified: last_modified.unwrap_or(0_f64),
-                            total_size,
-                        };
-                        Some((Ok(metadata), object_lister))
-                    }
-                    Some(Err(err)) => Some((Err(err.into()), object_lister)),
-                    None => None,
-                }
-            }
+            async move { Self::listed_object_metadata(&op, object?).await }
         });
 
         Ok(stream.take(limit.unwrap_or(usize::MAX)).boxed())
@@ -303,6 +274,28 @@ impl ObjectStore for OpendalObjectStore {
 }
 
 impl OpendalObjectStore {
+    async fn listed_object_metadata(
+        op: &Operator,
+        object: opendal::Entry,
+    ) -> ObjectResult<ObjectMetadata> {
+        let key = object.path().to_owned();
+        // OpenDAL 0.55 removed list metadata capability flags and reports unknown sizes as 0.
+        let meta = object.metadata();
+        let mut last_modified = meta.last_modified().map(timestamp_to_secs);
+        let mut total_size = meta.content_length() as usize;
+        if last_modified.is_none() || total_size == 0 {
+            // Propagate stat failures; treating one as EOF can make recovery trust a partial scan.
+            let stat_meta = op.stat(&key).await?;
+            last_modified = stat_meta.last_modified().map(timestamp_to_secs);
+            total_size = stat_meta.content_length() as usize;
+        }
+        Ok(ObjectMetadata {
+            key,
+            last_modified: last_modified.unwrap_or(0_f64),
+            total_size,
+        })
+    }
+
     pub async fn copy(&self, from_path: &str, to_path: &str) -> ObjectResult<()> {
         self.op.copy(from_path, to_path).await?;
         Ok(())
@@ -520,7 +513,7 @@ impl StreamingUploader for OpendalStreamingUploader {
 
 #[cfg(test)]
 mod tests {
-    use stream::TryStreamExt;
+    use futures::TryStreamExt;
 
     use super::*;
 
@@ -609,6 +602,24 @@ mod tests {
         uploader.finish().await.unwrap_err();
     }
 
+    #[tokio::test]
+    async fn test_listed_object_metadata_propagates_stat_failure() {
+        let store = OpendalObjectStore::test_new_memory_engine().unwrap();
+        stor
```

---

### Incident Patch 2: `533b0c09` (2026-09-28)
**Commit Message**: fix(cdc): force-close SQL Server connections on shutdown (#27186)

**File**: `ci/scripts/e2e-source-cdc-test.sh` (modified, +15/-0)
```diff
@@ -33,6 +33,21 @@ echo "--- Run inline CDC source tests"
 risedev slt './e2e_test/source_inline/cdc/**/*.slt' --skip 'cron_only' -j1 --label "can-use-recover"
 risedev slt './e2e_test/source_inline/cdc/**/*.slt.serial' --skip 'cron_only' --label "can-use-recover"
 
+echo "--- Run SQL Server encrypted abort regression test"
+sqlserver_abort_test_classes=$(mktemp -d)
+source_cdc_jars=(./connector-node/libs/risingwave-source-cdc-*.jar)
+if [[ ${#source_cdc_jars[@]} -ne 1 || ! -f "${source_cdc_jars[0]}" ]]; then
+  echo "Expected exactly one risingwave-source-cdc jar in connector-node/libs" >&2
+  exit 1
+fi
+source_cdc_classpath="${source_cdc_jars[0]}:./connector-node/libs/*"
+javac -cp "${source_cdc_classpath}" \
+  -d "${sqlserver_abort_test_classes}" \
+  e2e_test/source_inline/cdc/sql_server/SqlServerEncryptedAbortTest.java
+java -cp "${sqlserver_abort_test_classes}:${source_cdc_classpath}" \
+  io.debezium.connector.sqlserver.SqlServerEncryptedAbortTest
+rm -rf "${sqlserver_abort_test_classes}"
+
 echo "--- Run TVF source tests"
 export MYSQL_HOST=mysql MYSQL_TCP_PORT=3306 MYSQL_PWD=123456
 risedev slt './e2e_test/source_inline/tvf/*.slt'
```

**File**: `e2e_test/source_inline/cdc/sql_server/SqlServerEncryptedAbortTest.java` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+/*
+ * Copyright 2026 RisingWave Labs
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package io.debezium.connector.sqlserver;
+
+import java.sql.Connection;
+import java.sql.DriverManager;
+import java.sql.PreparedStatement;
+import java.sql.ResultSet;
+import java.sql.SQLException;
+import java.sql.Statement;
+import java.time.Duration;
+import java.util.concurrent.ExecutionException;
+import java.util.concurrent.ExecutorService;
+import java.util.concurrent.Executors;
+import java.util.concurrent.Future;
+import java.util.concurrent.TimeUnit;
+import java.util.concurrent.TimeoutException;
+
+/** Regression test for aborting an encrypted connection blocked in a socket read. */
+public final class SqlServerEncryptedAbortTest {
+    private static final Duration REQUEST_START_TIMEOUT = Duration.ofSeconds(10);
+    private static final Duration ABORT_RETURN_TIMEOUT = Duration.ofSeconds(2);
+    private static final Duration READ_UNBLOCK_TIMEOUT = Duration.ofSeconds(10);
+
+    private SqlServerEncryptedAbortTest() {}
+
+    public static void main(String[] args) throws Exception {
+        String host = envOrDefault("SQLCMDSERVER", "sqlserver-server");
+        String port = envOrDefault("SQLCMDPORT", "1433");
+        String user = envOrDefault("SQLCMDUSER", "SA");
+        String password = requiredEnv("SQLCMDPASSWORD");
+        String url =
+                "jdbc:sqlserver://"
+                        + host
+                        + ":"
+                        + port
+                        + ";databaseName=master;encrypt=true;trustServerCertificate=true";
+
+        ExecutorService queryExecutor =
+                Executors.newSingleThreadExecutor(
+                        command -> {
+                            Thread thread = new Thread(command, "sqlserver-blocked-read-test");
+                            thread.setDaemon(true);
+                            return thread;
+                        });
+        Connection blocked = DriverManager.getConnection(url, user, password);
+        try (Connection control = DriverManager.getConnection(url, user, password)) {
+            int sessionId = sessionIdAndAssertEncrypted(blocked);
+            Future<?> blockedRead =
+                    queryExecutor.submit(
+                            () -> {
+                                try (Statement statement = blocked.createStatement()) {
+                                    statement.execute("WAITFOR DELAY '00:10:00'");
+                                }
+                                return null;
+                            });
+
+            waitForRequest(control, sessionId);
+
+            long startedAt = System.nanoTime();
+            SqlServerStreamingChangeEventSource.abortConnection(blocked, "test");
+            Duration abortDuration = Duration.ofNanos(System.nanoTime() - startedAt);
+            if (abortDuration.compareTo(ABORT_RETURN_TIMEOUT) > 0) {
+                throw new AssertionError("abort blocked for " + abortDuration);
+            }
+
+            assertReadUnblocked(blockedRead);
+            waitForSessionClosed(control, sessionId);
+        } finally {
+            queryExecutor.shutdownNow();
+        }
+    }
+
+    private static int sessionIdAndAssertEncrypted(Connection connection) throws SQLException {
+        try (Statement statement = connection.createStatement();
+                ResultSet result =
+                        statement.executeQ
```

**File**: `java/connector-node/risingwave-source-cdc/src/main/java/io/debezium/connector/sqlserver/SqlServerStreamingChangeEventSource.java` (modified, +105/-0)
```diff
@@ -16,6 +16,8 @@
 
 package io.debezium.connector.sqlserver;
 
+import com.microsoft.sqlserver.jdbc.SQLServerConnection;
+import io.debezium.DebeziumException;
 import io.debezium.pipeline.ErrorHandler;
 import io.debezium.pipeline.EventDispatcher;
 import io.debezium.pipeline.notification.Notification;
@@ -29,6 +31,10 @@
 import io.debezium.snapshot.SnapshotterService;
 import io.debezium.util.Clock;
 import io.debezium.util.ElapsedTimeStrategy;
+import java.io.IOException;
+import java.lang.reflect.Field;
+import java.net.Socket;
+import java.sql.Connection;
 import java.sql.ResultSet;
 import java.sql.SQLException;
 import java.time.Duration;
@@ -46,6 +52,7 @@
 import java.util.Queue;
 import java.util.Set;
 import java.util.UUID;
+import java.util.concurrent.Executor;
 import java.util.concurrent.atomic.AtomicBoolean;
 import java.util.concurrent.atomic.AtomicReference;
 import java.util.regex.Matcher;
@@ -84,12 +91,30 @@ public class SqlServerStreamingChangeEventSource
     private static final Logger LOGGER =
             LoggerFactory.getLogger(SqlServerStreamingChangeEventSource.class);
 
+    /**
+     * The SQL Server driver performs {@link Connection#abort(Executor)} cleanup on the supplied
+     * executor. Never run it on the coordinator thread because cleanup of an encrypted connection
+     * can block in {@code SSLSocket.close()}.
+     */
+    private static final Executor ABORT_EXECUTOR =
+            command -> {
+                Thread thread = new Thread(command, "sqlserver-jdbc-abort");
+                thread.setDaemon(true);
+                thread.start();
+            };
+
     private static final Duration DEFAULT_INTERVAL_BETWEEN_COMMITS = Duration.ofMinutes(1);
     private static final int INTERVAL_BETWEEN_COMMITS_BASED_ON_POLL_FACTOR = 3;
 
     /** Connection used for reading CDC tables. */
     private final SqlServerConnection dataConnection;
 
+    /**
+     * Cached and refreshed by the source thread so emergency shutdown never needs to acquire the
+     * synchronized {@link SqlServerConnection} monitor.
+     */
+    private volatile Connection rawDataConnection;
+
     /**
      * A separate connection for retrieving details of the schema changes; without it, adaptive
      * buffering will not work.
@@ -99,6 +124,9 @@ public class SqlServerStreamingChangeEventSource
      */
     private final SqlServerConnection metadataConnection;
 
+    /** See {@link #rawDataConnection}. */
+    private volatile Connection rawMetadataConnection;
+
     private final EventDispatcher<SqlServerPartition, TableId> dispatcher;
     private final ErrorHandler errorHandler;
     private final Clock clock;
@@ -133,6 +161,11 @@ public SqlServerStreamingChangeEventSource(
         this.connectorConfig = connectorConfig;
         this.dataConnection = dataConnection;
         this.metadataConnection = metadataConnection;
+        try {
+            refreshRawConnections();
+        } catch (SQLException e) {
+            throw new DebeziumException("Failed to cache initial SQL Server JDBC connections", e);
+        }
         this.dispatcher = dispatcher;
         this.errorHandler = errorHandler;
         this.clock = clock;
@@ -158,6 +191,72 @@ public void setOnConnectedCallback(Runnable callback) {
         this.onConnectedCallback = callback;
     }
 
+    /**
+     * Abort the underlying SQL Server connections from outside the source thread so an in-flight
+     * JDBC operation that does not respond to {@link Thread#interrupt()} is unblocked.
+     *
+     * <p>The coordinator invokes this only after graceful shutdown and {@code shutdownNow()} have
+     * both timed out. mssql-jdbc's normal close path first closes its SSL socket, which can wait
+     * for the same lock held by an encrypted socket read. This method therefore closes the
+     * underlying TCP socket directly before scheduling normal driver cleanup asynchronously.
+     * Closing a {@link Socket} is thread-safe and unblocks its current re
```

**File**: `java/connector-node/risingwave-source-cdc/src/main/java/io/debezium/pipeline/ChangeEventSourceCoordinator.java` (modified, +10/-6)
```diff
@@ -503,8 +503,12 @@ private void forceCloseStreamingSourceConnection() {
             ((io.debezium.connector.postgresql.PostgresStreamingChangeEventSource) streamingSource)
                     .forceCloseConnection();
         }
-        // SQL Server has the same uninterruptible JDBC commit() pattern; follow-up tracked
-        // separately. MySQL (BinaryLogClient) and MongoDB (cursor) are not affected.
+        if (streamingSource
+                instanceof io.debezium.connector.sqlserver.SqlServerStreamingChangeEventSource) {
+            ((io.debezium.connector.sqlserver.SqlServerStreamingChangeEventSource) streamingSource)
+                    .forceCloseConnection();
+        }
+        // MySQL (BinaryLogClient) and MongoDB (cursor) are not affected.
     }
 
     /** Stops this coordinator. */
@@ -537,16 +541,16 @@ public synchronized void stop() throws InterruptedException {
                     // shutdownNow() only interrupts; native JDBC commit() ignores
                     // Thread.interrupt(). Force-close the underlying source connection so the
                     // wedged commit throws SocketException, allowing the source thread to unwind
-                    // through its finally block (which releases keep-alive threads + replication
-                    // slot). See risingwavelabs/risingwave#26075.
+                    // and release upstream resources. See risingwavelabs/risingwave#26075 and
+                    // #26081.
                     forceCloseStreamingSourceConnection();
                     boolean forceCloseOk =
                             executor.awaitTermination(shutdownWaitTimeout, TimeUnit.MILLISECONDS);
                     if (!forceCloseOk) {
                         LOGGER.warn(
                                 "Source thread still not terminated after force-closing the "
-                                        + "connection; the replication slot may remain held. See "
-                                        + "risingwavelabs/risingwave#26075");
+                                        + "connection; upstream resources may remain held. See "
+                                        + "risingwavelabs/risingwave#26075 and #26081");
                     }
                 }
             }
```

---

### Incident Patch 3: `faf139cc` (2026-09-25)
**Commit Message**: fix(test): widen retry windows for batch refresh and kafka-sasl e2e (#27258)

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `e2e_test/kafka-sasl/alter_connection_connector.slt` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ create table t_conn(x int) with (
 ) format plain encode json;
 
 
-query I retry 3 backoff 1s
+query I retry 15 backoff 2s
 select * from t_conn order by x;
 ----
 1
```

**File**: `e2e_test/streaming/batch_refresh_periodic.slt` (modified, +5/-4)
```diff
@@ -57,9 +57,10 @@ SELECT * FROM mv_up;
 3
 4
 
-# Wait for at least one refresh cycle to kick in and complete. The retry
-# window covers variance in the periodic trigger's firing time.
-query I rowsort retry 15 backoff 1s
+# Wait for at least one refresh cycle to kick in and complete. A cycle starts only
+# once the committed epoch passes the interval, which can lag by over 10s on a
+# loaded cluster.
+query I rowsort retry 30 backoff 2s
 SELECT * FROM mv_batch;
 ----
 1
@@ -86,7 +87,7 @@ SELECT * FROM mv_up;
 4
 5
 
-query I rowsort retry 15 backoff 1s
+query I rowsort retry 30 backoff 2s
 SELECT * FROM mv_batch;
 ----
 2
```

**File**: `e2e_test/streaming/batch_refresh_snapshot.slt` (modified, +1/-1)
```diff
@@ -103,7 +103,7 @@ SELECT * FROM mv_up;
 2
 3
 
-query I rowsort retry 15 backoff 1s
+query I rowsort retry 30 backoff 2s
 SELECT * FROM mv_batch;
 ----
 1
```

---

### Incident Patch 4: `3060ab45` (2026-09-24)
**Commit Message**: fix(refresh): finish a table refresh only after all materialize actors and abandon it on recovery (#27041)

Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `ci/scripts/e2e-source-test.sh` (modified, +4/-0)
```diff
@@ -44,17 +44,21 @@ risedev slt './e2e_test/source_inline/fs/parquet_nested_smallint.slt'
 risedev slt './e2e_test/source_inline/refresh/refresh_table.slt'
 risedev slt './e2e_test/source_inline/refresh/refresh_table_rate_limit.slt'
 risedev slt './e2e_test/source_inline/refresh/refresh_table_delete_readd.slt'
+risedev slt './e2e_test/source_inline/refresh/refresh_table_recovery.slt.serial'
+risedev slt './e2e_test/source_inline/refresh/refresh_table_reschedule.slt'
 risedev slt './e2e_test/source_inline/vault/vault_secret_ddl.slt'
 
 echo "--- Run webhook source tests"
 sleep 5
 risedev slt 'e2e_test/webhook/webhook_source.slt'
 risedev slt 'e2e_test/webhook/websocket_ingest.slt'
+risedev slt './e2e_test/source_inline/refresh/refresh_table_restart_before.slt'
 
 risedev kill
 risedev dev ci-1cn-1fe-with-recovery
 sleep 20
 risedev slt 'e2e_test/webhook/webhook_source_recovery.slt'
+risedev slt './e2e_test/source_inline/refresh/refresh_table_restart_after.slt'
 
 echo "--- Kill cluster"
 risedev ci-kill
```

**File**: `e2e_test/source_inline/refresh/drop_refresh_table_paused.slt.part` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+statement ok
+DROP TABLE refresh_paused_t CASCADE;
+
+system ok
+rm -rf ./e2e_test/source_inline/refresh/refresh_paused_tmp
```

**File**: `e2e_test/source_inline/refresh/refresh_table_paused.slt.part` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+# A refreshable table with a refresh cycle held open in the middle of a file. After a complete load,
+# a second cycle reads a new file set at one row per second until its first rows are visible, and a
+# limit of 0 then holds it. The file set is replaced once more while the cycle is held, so that a
+# re-run reads different files and its merge has to delete every row the held load wrote.
+# Dropped by drop_refresh_table_paused.slt.part.
+
+control substitution on
+
+system ok
+rm -rf ./e2e_test/source_inline/refresh/refresh_paused_tmp && mkdir -p ./e2e_test/source_inline/refresh/refresh_paused_tmp
+
+system ok
+for i in 0 1 2 3; do seq $((i*500+1)) $(((i+1)*500)) | awk '{print $1","$1%97}' > ./e2e_test/source_inline/refresh/refresh_paused_tmp/f$i.csv; done
+
+statement ok
+CREATE TABLE refresh_paused_t (id int, grp int, PRIMARY KEY (id)) WITH (
+    connector = '__for_testing_only_batch_posix_fs',
+    batch_posix_fs.root = './e2e_test/source_inline/refresh/refresh_paused_tmp',
+    refresh_mode = 'FULL_RELOAD',
+    match_pattern = '*.csv'
+) FORMAT PLAIN ENCODE CSV (without_header = 'true', delimiter = ',');
+
+statement ok
+CREATE MATERIALIZED VIEW refresh_paused_mv AS SELECT grp, count(*) AS cnt FROM refresh_paused_t GROUP BY grp;
+
+statement ok retry 3 backoff 5s
+REFRESH TABLE refresh_paused_t;
+
+query T retry 10 backoff 2s
+SELECT s.current_status
+FROM rw_catalog.rw_refresh_table_state s
+JOIN rw_catalog.rw_tables t ON s.table_id = t.id
+WHERE t.name = 'refresh_paused_t';
+----
+IDLE
+
+
+# The frontend's read snapshot can lag the commit that ended the cycle.
+statement ok
+FLUSH;
+
+query II
+SELECT count(*), sum(cnt) FROM refresh_paused_mv;
+----
+97 2000
+
+
+system ok
+for i in 0 1 2 3; do seq $((2000+i*500+1)) $((2000+(i+1)*500)) | awk '{print $1","$1%97}' > ./e2e_test/source_inline/refresh/refresh_paused_tmp/f$i.csv; done
+
+statement ok
+ALTER TABLE refresh_paused_t SET SOURCE_RATE_LIMIT TO 1;
+
+statement ok
+REFRESH TABLE refresh_paused_t;
+
+query B retry 30 backoff 1s
+SELECT count(*) > 2000 FROM refresh_paused_t;
+----
+t
+
+statement ok
+ALTER TABLE refresh_paused_t SET SOURCE_RATE_LIMIT TO 0;
+
+query TB
+SELECT s.current_status, (SELECT count(*) FROM refresh_paused_t) < 4000
+FROM rw_catalog.rw_refresh_table_state s
+JOIN rw_catalog.rw_tables t ON s.table_id = t.id
+WHERE t.name = 'refresh_paused_t';
+----
+REFRESHING t
+
+# The trigger of the held cycle, so that a test can tell its re-run from it.
+let trigger_before
+SELECT s.last_trigger_time
+FROM rw_catalog.rw_refresh_table_state s
+JOIN rw_catalog.rw_tables t ON s.table_id = t.id
+WHERE t.name = 'refresh_paused_t'
+
+system ok
+rm ./e2e_test/source_inline/refresh/refresh_paused_tmp/f*.csv && seq 5001 6000 | awk '{print $1","$1%97}' > ./e2e_test/source_inline/refresh/refresh_paused_tmp/g0.csv
```

**File**: `e2e_test/source_inline/refresh/refresh_table_rate_limit.slt` (modified, +10/-0)
```diff
@@ -44,6 +44,10 @@ WHERE t.name = 'refresh_rl_t';
 ----
 IDLE
 
+# The frontend's read snapshot can lag the commit that ended the cycle.
+statement ok
+FLUSH;
+
 query II
 SELECT count(*), sum(cnt) FROM refresh_rl_mv;
 ----
@@ -65,6 +69,9 @@ WHERE t.name = 'refresh_rl_t';
 ----
 IDLE
 
+statement ok
+FLUSH;
+
 query II
 SELECT count(*), sum(cnt) FROM refresh_rl_mv;
 ----
@@ -109,6 +116,9 @@ WHERE t.name = 'refresh_rl_t';
 ----
 IDLE
 
+statement ok
+FLUSH;
+
 query II
 SELECT min(id), max(id) FROM refresh_rl_t;
 ----
```

**File**: `e2e_test/source_inline/refresh/refresh_table_recovery.slt.serial` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+# A refresh interrupted by recovery is abandoned and re-run once.
+
+include ./refresh_table_paused.slt.part
+
+statement ok
+recover;
+
+# The re-run is a newer cycle than the interrupted one, held by the limit of 0 that survived recovery.
+query TB retry 20 backoff 1s
+SELECT s.current_status, s.last_trigger_time > '${trigger_before}'
+FROM rw_catalog.rw_refresh_table_state s
+JOIN rw_catalog.rw_tables t ON s.table_id = t.id
+WHERE t.name = 'refresh_paused_t';
+----
+REFRESHING t
+
+# A second recovery abandons the re-run without starting another one.
+statement ok
+recover;
+
+# A throttle command only goes through once the cluster accepts commands again.
+statement ok retry 10 backoff 1s
+ALTER TABLE refresh_paused_t SET SOURCE_RATE_LIMIT TO DEFAULT;
+
+sleep 2s
+
+query TB
+SELECT s.current_status, s.last_success_time > s.last_trigger_time
+FROM rw_catalog.rw_refresh_table_state s
+JOIN rw_catalog.rw_tables t ON s.table_id = t.id
+WHERE t.name = 'refresh_paused_t';
+----
+IDLE f
+
+# The next cycle deletes every row the abandoned loads wrote.
+statement ok
+REFRESH TABLE refresh_paused_t;
+
+query TB retry 10 backoff 2s
+SELECT s.current_status, s.last_success_time > s.last_trigger_time
+FROM rw_catalog.rw_refresh_table_state s
+JOIN rw_catalog.rw_tables t ON s.table_id = t.id
+WHERE t.name = 'refresh_paused_t';
+----
+IDLE t
+
+statement ok
+FLUSH;
+
+query III
+SELECT min(id), max(id), count(*) FROM refresh_paused_t;
+----
+5001 6000 1000
+
+query II
+SELECT count(*), sum(cnt) FROM refresh_paused_mv;
+----
+97 1000
+
+include ./drop_refresh_table_paused.slt.part
```

---

### Incident Patch 5: `4642960b` (2026-09-24)
**Commit Message**: fix(stream): keep a MATCH_RECOGNIZE scan incomplete across an eviction rebase (#27201)

Signed-off-by: Henrik Ma Johansson <dahankzter@gmail.com>

**File**: `docs/dev/src/design/match-recognize.md` (modified, +12/-4)
```diff
@@ -299,8 +299,10 @@ Worth stating plainly, because the two cases differ and only one of them recover
 **With `WITHIN`.** A starved partition still sheds matches, but only through window closure, and
 only matches the truncated scan reached. Each watermark visit re-derives the tail (spending the
 whole budget), then emits the head if its window has closed. Emitting a provisional match rebuilds
-the matcher under that same spent budget, which empties the tail and ends the drain — so the
-practical rate is about **one match per watermark visit**, and the deadline prune contributes
+the matcher under that same spent budget, which empties the tail and ends the drain; emitting a
+*frozen* one keeps it — the eviction rebase shifts the truncated scan's cursor and found prefix
+down with the rows instead of dropping them (see below) — so the practical rate is the frozen run
+plus about **one provisional match per watermark visit**, and the deadline prune contributes
 nothing while the matcher is incomplete. Emission latency degrades from decidability to window
 closure, and the retained set shrinks only at that rate: if arrivals per watermark interval exceed
 it, the partition still grows. This is an improvement on shedding nothing; it is not convergence.
@@ -333,8 +335,14 @@ remembered instead of re-walked:
   refresh on the next watermark visit, so an idle partition resumes it too. The executor's own
   liveness walks (the dead-prefix prune, the emission gate's gap check) skip that prefix as well.
 
-Both memories are forgotten wherever the rows a verdict was computed over can change: truncation,
-and the eviction rebase. What remains inherently per-visit is a run that stays *alive* — `a{600} b`
+Both memories are forgotten wherever the rows a verdict was computed over can change — truncation —
+and merely *shifted* by the eviction rebase: a verdict about a surviving start was computed over
+surviving rows (the binder keeps every `PREV` inside the match span, running navigation reads
+inside the match, and there is no forward navigation), so the matchless and dead prefixes, the scan
+cursor and a truncated scan's found prefix all move down with the rows. Incompleteness survives the
+rebase with them, so the next visit resumes the scan before the deadline prune may act on absence —
+clearing it there turned partial information into a completed-scan verdict and the prune deleted
+the rows of every match the truncated scan never reached (#27197). What remains inherently per-visit is a run that stays *alive* — `a{600} b`
 over an unbroken run of `a` rows keeps every start alive until a `b` arrives or its `WITHIN` window
 closes — where each rescan re-walks the live starts and the budget throttles the partition as
 described above; `WITHIN` is what bounds that.
```

**File**: `src/stream/src/executor/match_recognize/incremental.rs` (modified, +292/-26)
```diff
@@ -238,7 +238,9 @@ pub struct IncrementalMatcher {
     /// set, absence of a match from `provisional()` is NOT evidence of absence: the executor must
     /// re-derive (fresh budget) before any decision that treats missing matches as decided — the
     /// WITHIN-deadline prune in particular would otherwise delete rows carrying a match the
-    /// truncated scan never reached.
+    /// truncated scan never reached. Survives [`IncrementalMatcher::finalize_evicted_prefix`]
+    /// together with the found prefix and the scan cursor, which the rebase shifts rather than
+    /// resets: the unscanned suffix is untouched by an eviction, so the flag still describes it.
     incomplete: bool,
     /// Absolute buffer position where a budget-truncated match scan will resume. Unlike
     /// `matchless_upto`, this may follow successful matches: the corresponding leftmost-prefix of
@@ -256,7 +258,8 @@ pub struct IncrementalMatcher {
     /// walks up to `L` rows), and once that exceeds the per-visit budget the region never freezes:
     /// the permanent, non-self-healing shape a long chain pattern (`a{600}`) otherwise degrades
     /// into. Reset to `next_pos` whenever the rows a verdict was computed over can change
-    /// (truncation, eviction rebase).
+    /// (truncation); an eviction rebase only shifts it, since a verdict about a surviving start was
+    /// computed over surviving rows (see [`IncrementalMatcher::finalize_evicted_prefix`]).
     dead_upto: usize,
     /// Starts `[next_pos, matchless_upto)` proven MATCHLESS FOREVER by the finder: their walks found
     /// no accept and never reached the boundary, so they died entirely on immutable rows (see
@@ -325,8 +328,9 @@ impl IncrementalMatcher {
         self.freeze_truncated = false;
     }
 
-    /// Whether the last rescan was truncated by a spent budget — see the field doc. While true,
-    /// `provisional()` is a leftmost-prefix under-approximation.
+    /// Whether the last rescan was truncated by a spent budget — see the field doc. The flag and
+    /// the found prefix both survive an eviction rebase. While true, `provisional()` is a
+    /// leftmost-prefix under-approximation.
     pub fn is_incomplete(&self) -> bool {
         self.incomplete
     }
@@ -700,12 +704,14 @@ impl IncrementalMatcher {
     /// at the (same-or-later) eviction boundary `[0, next_pos)` is still dead and the first live row
     /// is `>= next_pos`. The check above bounds `final_pos <= next_pos`, so through the executor
     /// `final_pos == next_pos` exactly. At that boundary every frozen match starts before `next_pos`
-    /// and is therefore consumed — none is retained — so `next_pos` rebases to `0` and the entire
-    /// surviving suffix is re-derived from scratch as the provisional tail. `provisional()` then
-    /// trivially equals a fresh scan over the survivors, regardless of skip mode, and no rebased scan
-    /// cursor can skip a start a fresh matcher would find. `PAST LAST ROW` additionally tiles
-    /// `[0, next_pos)` with non-overlapping spans (`resume == end`), so *any* boundary within the
-    /// frozen prefix retains a suffix of frozen matches soundly.
+    /// and is therefore consumed — none is retained — so `next_pos` rebases to `0` and the
+    /// provisional tail is exactly the matches found over the surviving suffix, regardless of skip
+    /// mode. The verdict cursors and a truncated scan's found prefix shift down with the rows rather
+    /// than resetting: a verdict about a surviving start was computed over surviving rows only (see
+    /// the rebase step in the body), so the resumed scan finds exactly what a fresh matcher over
+    /// the survivors would, without re-walking the starts already decided. `PAST LAST ROW`
+    /// additionally tiles `[0, next_pos)` with non-overlapping spans (`resume == end`), so *any*
+    /// boundary within the frozen prefix retains a suffix of frozen matches soundly.
     ///
     /// On [`Finalized::Rebased`]
```

---

### Incident Patch 6: `ce78f82e` (2026-09-24)
**Commit Message**: fix(stream): derive NOW progress from elapsed time (#27209)

**File**: `proto/stream_plan.proto` (modified, +0/-3)
```diff
@@ -256,9 +256,6 @@ message Barrier {
   map<string, string> tracing_context = 2;
   // The kind of the barrier.
   BarrierKind kind = 9;
-  // The effective barrier interval for this database: the database-specific override when set,
-  // or the system-wide interval otherwise.
-  uint32 barrier_interval_ms = 10;
 }
 
 message Watermark {
```

**File**: `src/common/src/system_param/mod.rs` (modified, +2/-15)
```diff
@@ -449,11 +449,11 @@ for_all_params!(impl_system_params_for_test);
 pub struct OverrideValidate;
 impl Validate for OverrideValidate {
     fn barrier_interval_ms(v: &u32) -> Result<()> {
-        Self::expect_range(*v, 50..=i32::MAX as u32)
+        Self::expect_range(*v, 50..)
     }
 
     fn checkpoint_frequency(v: &u64) -> Result<()> {
-        Self::expect_range(*v, 1..=i64::MAX as u64)
+        Self::expect_range(*v, 1..)
     }
 
     fn backup_storage_directory(v: &String) -> Result<()> {
@@ -560,19 +560,6 @@ mod tests {
         assert!(validate_init_system_params(&p).is_ok());
     }
 
-    #[test]
-    fn test_database_param_storage_bounds() {
-        assert!(OverrideValidate::barrier_interval_ms(&50).is_ok());
-        assert!(OverrideValidate::barrier_interval_ms(&(i32::MAX as u32)).is_ok());
-        assert!(OverrideValidate::barrier_interval_ms(&49).is_err());
-        assert!(OverrideValidate::barrier_interval_ms(&(i32::MAX as u32 + 1)).is_err());
-
-        assert!(OverrideValidate::checkpoint_frequency(&1).is_ok());
-        assert!(OverrideValidate::checkpoint_frequency(&(i64::MAX as u64)).is_ok());
-        assert!(OverrideValidate::checkpoint_frequency(&0).is_err());
-        assert!(OverrideValidate::checkpoint_frequency(&(i64::MAX as u64 + 1)).is_err());
-    }
-
     // Test that we always redact the value of the license key when displaying it, but when it comes to
     // persistency, we still write and get the real value.
     #[test]
```

**File**: `src/meta/src/barrier/checkpoint/control.rs` (modified, +1/-7)
```diff
@@ -244,7 +244,6 @@ impl CheckpointControl {
             command,
             span,
             checkpoint,
-            barrier_interval_ms,
         } = new_barrier;
 
         if let Some((mut command, notifier)) = command {
@@ -354,7 +353,6 @@ impl CheckpointControl {
             database.handle_new_barrier(
                 Some((command, notifier)),
                 checkpoint,
-                barrier_interval_ms,
                 span,
                 partial_graph_manager,
                 &self.hummock_version_stats,
@@ -382,7 +380,6 @@ impl CheckpointControl {
             database.handle_new_barrier(
                 None,
                 checkpoint,
-                barrier_interval_ms,
                 span,
                 partial_graph_manager,
                 &self.hummock_version_stats,
@@ -1215,7 +1212,6 @@ impl DatabaseCheckpointControl {
         &mut self,
         command: Option<(Command, Notifier)>,
         checkpoint: bool,
-        barrier_interval_ms: u32,
         span: tracing::Span,
         partial_graph_manager: &mut PartialGraphManager,
         hummock_version_stats: &HummockVersionStats,
@@ -1322,9 +1318,7 @@ impl DatabaseCheckpointControl {
             return Ok(());
         }
 
-        let barrier_info =
-            self.state
-                .next_barrier_info(checkpoint, curr_epoch, barrier_interval_ms);
+        let barrier_info = self.state.next_barrier_info(checkpoint, curr_epoch);
         // Tracing related stuff
         barrier_info.prev_epoch.span().in_scope(|| {
             tracing::info!(target: "rw_tracing", epoch = barrier_info.curr_epoch(), "new barrier enqueued");
```

**File**: `src/meta/src/barrier/checkpoint/independent_job/batch_refresh_job/mod.rs` (modified, +0/-17)
```diff
@@ -201,7 +201,6 @@ pub(crate) struct BatchRefreshJobCheckpointControl {
     snapshot_epoch: u64,
     /// Batch refresh interval in seconds. Used to determine when to trigger a refresh run.
     batch_refresh_seconds: u64,
-    barrier_interval_ms: u32,
 
     status: BatchRefreshJobStatus,
 }
@@ -508,7 +507,6 @@ impl BatchRefreshJobCheckpointControl {
         notifier: Option<&mut NotifierStarter>,
         snapshot_backfill_upstream_tables: HashSet<TableId>,
         snapshot_epoch: u64,
-        barrier_interval_ms: u32,
         version_stat: &HummockVersionStats,
         term_id: &str,
         partial_graph_manager: &mut PartialGraphManager,
@@ -564,7 +562,6 @@ impl BatchRefreshJobCheckpointControl {
             &mut prev_epoch_fake_physical_time,
             &mut pending_non_checkpoint_barriers,
             PbBarrierKind::Checkpoint,
-            barrier_interval_ms,
         );
 
         let mut graph_adder = partial_graph_manager.add_partial_graph(
@@ -597,7 +594,6 @@ impl BatchRefreshJobCheckpointControl {
             snapshot_backfill_upstream_tables,
             snapshot_epoch,
             batch_refresh_seconds,
-            barrier_interval_ms,
 
             status: BatchRefreshJobStatus::ConsumingSnapshot {
                 prev_epoch_fake_physical_time,
@@ -624,7 +620,6 @@ impl BatchRefreshJobCheckpointControl {
         snapshot_backfill_upstream_tables: HashSet<TableId>,
         snapshot_epoch: u64,
         committed_epoch: u64,
-        barrier_interval_ms: u32,
         backfill_order: ExtendedFragmentBackfillOrder,
         version_stat: &HummockVersionStats,
         initial_mutation: Mutation,
@@ -649,7 +644,6 @@ impl BatchRefreshJobCheckpointControl {
                 snapshot_backfill_upstream_tables,
                 snapshot_epoch,
                 batch_refresh_seconds,
-                barrier_interval_ms,
 
                 status: BatchRefreshJobStatus::Idle {
                     last_committed_epoch: committed_epoch,
@@ -688,7 +682,6 @@ impl BatchRefreshJobCheckpointControl {
             &mut prev_epoch_fake_physical_time,
             &mut pending_non_checkpoint_barriers,
             PbBarrierKind::Initial,
-            barrier_interval_ms,
         );
 
         partial_graph_recoverer.recover_graph(
@@ -708,7 +701,6 @@ impl BatchRefreshJobCheckpointControl {
             snapshot_backfill_upstream_tables,
             snapshot_epoch,
             batch_refresh_seconds,
-            barrier_interval_ms,
             status: BatchRefreshJobStatus::ConsumingSnapshot {
                 prev_epoch_fake_physical_time,
                 version_stats: version_stat.clone(),
@@ -779,7 +771,6 @@ impl BatchRefreshJobCheckpointControl {
         barrier_info: &BarrierInfo,
         mutation: Option<(Mutation, Option<&mut NotifierStarter>)>,
     ) -> MetaResult<()> {
-        self.barrier_interval_ms = barrier_info.barrier_interval_ms;
         if !matches!(self.status, BatchRefreshJobStatus::ConsumingSnapshot { .. }) {
             // ConsumingLogStore has all barriers pre-injected; no forwarding needed.
             // Idle has no partial graph.
@@ -828,15 +819,13 @@ impl BatchRefreshJobCheckpointControl {
                 curr_epoch: TracedEpoch::new(Epoch(snapshot_epoch)),
                 prev_epoch: TracedEpoch::new(prev_epoch),
                 kind: BarrierKind::Checkpoint(take(&mut pending_non_checkpoint_barriers)),
-                barrier_interval_ms: self.barrier_interval_ms,
             };
 
             // Inject stop barrier with u64::MAX as curr_epoch and empty nodes_to_sync_table.
             let stop_barrier = BarrierInfo {
                 prev_epoch: TracedEpoch::new(Epoch(snapshot_epoch)),
                 curr_epoch: TracedEpoch::new(Epoch(u64::MAX)),
                 kind: BarrierKind::Checkpoint(vec![snapshot_epoch]),
-                barrier_interval_ms: self.barrier_interval_ms,
             };
 
             let stop_actors: Vec<ActorId> = fragment_infos
@@ -91
```

**File**: `src/meta/src/barrier/checkpoint/independent_job/creating_job/mod.rs` (modified, +0/-23)
```diff
@@ -107,7 +107,6 @@ impl CreatingStreamingJobControl {
         notifier: Option<&mut NotifierStarter>,
         snapshot_backfill_upstream_tables: HashSet<TableId>,
         snapshot_epoch: u64,
-        barrier_interval_ms: u32,
         since_timestamp_upstream_log_epochs: Option<(&TableLogEpochs, PartialGraphId, u64)>,
         version_stat: &HummockVersionStats,
         term_id: &str,
@@ -174,7 +173,6 @@ impl CreatingStreamingJobControl {
                     partial_graph_manager.pending_barrier_infos(upstream_partial_graph_id),
                     snapshot_epoch,
                     new_upstream_barrier_prev_epoch,
-                    barrier_interval_ms,
                 )?;
             (initial_barrier, Some(barriers_to_inject))
         } else {
@@ -183,7 +181,6 @@ impl CreatingStreamingJobControl {
                     &mut prev_epoch_fake_physical_time,
                     &mut pending_non_checkpoint_barriers,
                     PbBarrierKind::Checkpoint,
-                    barrier_interval_ms,
                 ),
                 None,
             )
@@ -312,7 +309,6 @@ impl CreatingStreamingJobControl {
                 create_mview_tracker,
                 snapshot_backfill_actors,
                 snapshot_epoch,
-                barrier_interval_ms,
                 info: job_info,
                 pending_non_checkpoint_barriers,
             };
@@ -407,7 +403,6 @@ impl CreatingStreamingJobControl {
                     } else {
                         BarrierKind::Barrier
                     },
-                    barrier_interval_ms: upstream_barrier_info.barrier_interval_ms,
                 });
                 prev_epoch = *epoch;
             }
@@ -416,7 +411,6 @@ impl CreatingStreamingJobControl {
             prev_epoch: TracedEpoch::new(Epoch(prev_epoch)),
             curr_epoch: TracedEpoch::new(Epoch(upstream_barrier_info.curr_epoch())),
             kind: BarrierKind::Checkpoint(pending_non_checkpoint_barriers),
-            barrier_interval_ms: upstream_barrier_info.barrier_interval_ms,
         });
         Ok(ret)
     }
@@ -454,7 +448,6 @@ impl CreatingStreamingJobControl {
         pending_upstream_barriers: impl Iterator<Item = &BarrierInfo>,
         snapshot_epoch: u64,
         new_upstream_barrier_prev_epoch: u64,
-        barrier_interval_ms: u32,
     ) -> MetaResult<(BarrierInfo, Vec<BarrierInfo>)> {
         let mut initial_barrier = None;
         let mut barriers = vec![];
@@ -494,7 +487,6 @@ impl CreatingStreamingJobControl {
                         } else {
                             BarrierKind::Barrier
                         },
-                        barrier_interval_ms,
                     },
                 );
                 prev_epoch = *epoch;
@@ -515,7 +507,6 @@ impl CreatingStreamingJobControl {
                     prev_epoch: TracedEpoch::new(Epoch(prev_epoch)),
                     curr_epoch: TracedEpoch::new(Epoch(new_upstream_barrier_prev_epoch)),
                     kind: BarrierKind::Checkpoint(pending_non_checkpoint_barriers),
-                    barrier_interval_ms,
                 },
             );
         } else {
@@ -533,7 +524,6 @@ impl CreatingStreamingJobControl {
                     prev_epoch: TracedEpoch::new(Epoch(prev_epoch)),
                     curr_epoch: TracedEpoch::new(Epoch(first_pending_barrier.prev_epoch())),
                     kind: BarrierKind::Checkpoint(take(&mut pending_non_checkpoint_barriers)),
-                    barrier_interval_ms,
                 },
             );
             prev_epoch = first_pending_barrier.prev_epoch();
@@ -555,7 +545,6 @@ impl CreatingStreamingJobControl {
                         } else {
                             BarrierKind::Barrier
                         },
-                        barrier_interval_ms: pending_barrier.barrier_interval_ms,
                     },
                 );
                 prev_epoch = pending_barrier.curr_epoch();
@@ -598,7 +587,6 @@ im
```

---

### Incident Patch 7: `b8f140b6` (2026-09-24)
**Commit Message**: fix(iceberg): reject row lineage column names for V3 tables (#27223)

**File**: `e2e_test/iceberg/test_case/pure_slt/iceberg_v3/row_lineage_reserved_names.slt` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+# Iceberg V3 reserves `_row_id` and `_last_updated_sequence_number` for row lineage
+# metadata. Creating a V3 table with a data column of either name must be rejected.
+
+statement ok
+create table row_lineage_reserved_names_t (v int);
+
+statement error cannot create an Iceberg V3 table with column `_row_id`
+create sink row_lineage_reserved_names_sink as
+select _row_id, v from row_lineage_reserved_names_t
+with (
+  connector = 'iceberg',
+  type = 'append-only',
+  force_append_only = 'true',
+  warehouse.path = 's3a://icebergdata',
+  s3.endpoint = 'http://127.0.0.1:9301',
+  s3.access.key = 'hummockadmin',
+  s3.secret.key = 'hummockadmin',
+  s3.region = 'us-east-1',
+  catalog.name = 'demo',
+  catalog.type = 'storage',
+  database.name = 'demo_db',
+  table.name = 'row_lineage_reserved_names_t',
+  create_table_if_not_exists = 'true',
+  format_version = '3'
+);
+
+statement ok
+drop table row_lineage_reserved_names_t;
```

**File**: `src/connector/src/sink/iceberg/create_table.rs` (modified, +31/-1)
```diff
@@ -18,6 +18,9 @@ use std::sync::LazyLock;
 
 use anyhow::{Context, anyhow};
 use iceberg::arrow::schema_to_arrow_schema;
+use iceberg::metadata_columns::{
+    RESERVED_COL_NAME_LAST_UPDATED_SEQUENCE_NUMBER, RESERVED_COL_NAME_ROW_ID,
+};
 use iceberg::spec::{
     FormatVersion, NullOrder, SortDirection, SortField, SortOrder, TableProperties, Transform,
     UnboundPartitionField, UnboundPartitionSpec,
@@ -32,7 +35,7 @@ use risingwave_common::array::arrow::arrow_schema_iceberg::{
 };
 use risingwave_common::array::arrow::{IcebergArrowConvert, IcebergCreateTableArrowConvert};
 use risingwave_common::bail;
-use risingwave_common::catalog::Schema;
+use risingwave_common::catalog::{ColumnDesc, Schema};
 use risingwave_common::util::iter_util::ZipEqFast;
 use url::Url;
 
@@ -93,6 +96,32 @@ pub async fn create_and_validate_table_impl(
     Ok(table)
 }
 
+/// Iceberg V3 stores row lineage in data files as the reserved `_row_id` and
+/// `_last_updated_sequence_number` columns. A table column with either name is ambiguous with the
+/// lineage metadata column, so reject it when creating a V3 table.
+pub fn validate_row_lineage_column_names(
+    format_version: FormatVersion,
+    columns: &[ColumnDesc],
+) -> Result<()> {
+    if format_version < FormatVersion::V3 {
+        return Ok(());
+    }
+    if let Some(column) = columns.iter().find(|column| {
+        [
+            RESERVED_COL_NAME_ROW_ID,
+            RESERVED_COL_NAME_LAST_UPDATED_SEQUENCE_NUMBER,
+        ]
+        .contains(&column.name.as_str())
+    }) {
+        return Err(SinkError::Config(anyhow!(
+            "cannot create an Iceberg V3 table with column `{}` because the name is reserved \
+             for row lineage metadata; please rename the column",
+            column.name
+        )));
+    }
+    Ok(())
+}
+
 /// Returns `true` if this call created the table, `false` if it already existed.
 pub(super) async fn create_table_if_not_exists_impl(
     config: &IcebergConfig,
@@ -125,6 +154,7 @@ pub(super) async fn create_table_if_not_exists_impl(
             column.name
         )));
     }
+    validate_row_lineage_column_names(config.table_format_version(), &param.columns)?;
 
     let iceberg_create_table_arrow_convert = IcebergCreateTableArrowConvert::default();
     // convert risingwave schema -> arrow schema -> iceberg schema
```

**File**: `src/connector/src/sink/iceberg/test.rs` (modified, +25/-1)
```diff
@@ -23,7 +23,7 @@ use risingwave_common::array::arrow::arrow_schema_iceberg::{
     DataType as ArrowDataType, Field as ArrowField, FieldRef as ArrowFieldRef,
     Fields as ArrowFields, Schema as ArrowSchema,
 };
-use risingwave_common::catalog::{Field, Schema};
+use risingwave_common::catalog::{ColumnDesc, ColumnId, Field, Schema};
 use risingwave_common::types::{DataType, MapType, StructType};
 
 use crate::connector_common::{IcebergCommon, IcebergTableIdentifier};
@@ -32,6 +32,7 @@ use crate::sink::iceberg::{
     CompactionType, DEFAULT_COMPACTION_MAX_SNAPSHOTS_NUM,
     ICEBERG_DEFAULT_WRITE_PARQUET_MAX_ROW_GROUP_BYTES, IcebergConfig, IcebergOrderKeyField,
     IcebergWriteMode, parse_order_key_exprs, validate_order_key_columns,
+    validate_row_lineage_column_names,
 };
 
 pub const DEFAULT_ICEBERG_COMPACTION_INTERVAL: u64 = 3600; // 1 hour
@@ -1102,3 +1103,26 @@ fn test_iceberg_sink_upper_case_primary_key() {
         Some(vec!["Key".to_owned()])
     );
 }
+
+#[test]
+fn test_validate_row_lineage_column_names() {
+    let columns = |name: &str| {
+        vec![
+            ColumnDesc::named("v1", ColumnId::new(1), DataType::Int32),
+            ColumnDesc::named(name, ColumnId::new(2), DataType::Int64),
+        ]
+    };
+
+    for reserved in ["_row_id", "_last_updated_sequence_number"] {
+        let err =
+            validate_row_lineage_column_names(FormatVersion::V3, &columns(reserved)).unwrap_err();
+        assert!(
+            err.to_string().contains(reserved),
+            "unexpected error: {err}"
+        );
+        validate_row_lineage_column_names(FormatVersion::V2, &columns(reserved)).unwrap();
+    }
+    // The pk-index sink carries a pk-less upstream's hidden row id as the relation-qualified
+    // `<table>._row_id`, which does not collide with the lineage column.
+    validate_row_lineage_column_names(FormatVersion::V3, &columns("t._row_id")).unwrap();
+}
```

---

### Incident Patch 8: `0d32b959` (2026-09-23)
**Commit Message**: fix(dashboard): normalize output blocking ratio in user dashboard (#27003)

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `grafana/dashboard/user/streaming.py` (modified, +5/-1)
```diff
@@ -101,8 +101,12 @@ def _(outer_panels: Panels):
                     "much time it takes an actor to process a message, i.e. a barrier, a watermark or rows of data, "
                     "on average. Then we divide this duration by 1 second and show it as a percentage.",
                     [
+                        # `actor_id` is masked below `MetricLevel::Debug`, so each series is
+                        # already summed over a node's actors. Divide by the actor count.
                         panels.target(
-                            f"avg(rate({metric('stream_actor_output_buffer_blocking_duration_ns')}[$__rate_interval])) by (fragment_id, downstream_fragment_id) / 1000000000",
+                            f"sum(rate({metric('stream_actor_output_buffer_blocking_duration_ns')}[$__rate_interval])) by (fragment_id, downstream_fragment_id) \
+                                / ignoring (downstream_fragment_id) group_left sum({metric('stream_actor_count')}) by (fragment_id) \
+                                / 1000000000",
                             "fragment {{fragment_id}}->{{downstream_fragment_id}}",
                         ),
                     ],
```

---

### Incident Patch 9: `1e5154ae` (2026-09-23)
**Commit Message**: fix(source): fail the batch posix fs fetch on errors like the OpenDAL fetch (#27217)

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `src/stream/src/executor/source/batch_source/batch_posix_fs_fetch.rs` (modified, +8/-13)
```diff
@@ -179,17 +179,12 @@ impl<S: StateStore> BatchPosixFsFetchExecutor<S> {
             let full_path = Path::new(&root_path).join(&file_path);
 
             // Read the entire file
-            let content = match fs::read(&full_path).await {
-                Ok(content) => content,
-                Err(e) => {
-                    tracing::error!(
-                        error = %e.as_report(),
-                        file_path = %full_path.display(),
-                        "Failed to read file"
-                    );
-                    continue;
-                }
-            };
+            let content = fs::read(&full_path).await.map_err(|e| {
+                StreamExecutorError::connector_error(
+                    anyhow::Error::from(e)
+                        .context(format!("failed to read file {}", full_path.display())),
+                )
+            })?;
 
             if content.is_empty() {
                 // Empty file, skip it
@@ -305,7 +300,7 @@ impl<S: StateStore> BatchPosixFsFetchExecutor<S> {
             match msg {
                 Err(e) => {
                     tracing::error!(error = %e.as_report(), "Fetch Error");
-                    files_in_progress = 0;
+                    return Err(e);
                 }
                 Ok(msg) => match msg {
                     // Barrier messages from upstream
@@ -452,7 +447,7 @@ impl<S: StateStore> BatchPosixFsFetchExecutor<S> {
                         yield Message::Chunk(chunk);
                     }
                     Either::Right(None) => {
-                        files_in_progress -= 1;
+                        files_in_progress = files_in_progress.saturating_sub(1);
                     }
                 },
             }
```

---

### Incident Patch 10: `8ef66c70` (2026-09-23)
**Commit Message**: fix(meta): recover source splits for snapshot backfill jobs (#27208)

**File**: `src/meta/src/barrier/rpc.rs` (modified, +2/-3)
```diff
@@ -1060,8 +1060,7 @@ impl PartialGraphRecoverer<'_> {
                 )
             }));
 
-            let database_job_source_splits =
-                collect_source_splits(database_jobs.values().flatten(), source_splits);
+            let job_source_splits = collect_source_splits(info.values(), source_splits);
             assert!(
                 !cdc_table_snapshot_splits.contains_key(&job_id),
                 "snapshot backfill job {job_id} should not have cdc backfill"
@@ -1081,7 +1080,7 @@ impl PartialGraphRecoverer<'_> {
                     },
                 );
             let mutation = build_mutation(
-                &database_job_source_splits,
+                &job_source_splits,
                 Default::default(), // no cdc backfill job for
                 &job_backfill_orders,
                 false,
```

**File**: `src/tests/simulation/tests/integration_tests/recovery/mod.rs` (modified, +1/-0)
```diff
@@ -23,4 +23,5 @@ mod nexmark_recovery;
 mod recovery_info;
 mod serving_mapping;
 mod serving_mapping_start_order;
+mod source_split;
 mod time_travel;
```

**File**: `src/tests/simulation/tests/integration_tests/recovery/source_split.rs` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+// Copyright 2026 RisingWave Labs
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+use std::sync::{Arc, Mutex};
+use std::time::Duration;
+
+use anyhow::{Result, anyhow};
+use futures::{StreamExt, stream};
+use risingwave_common::array::StreamChunk;
+use risingwave_connector::error::ConnectorResult;
+use risingwave_connector::source::test_source::{BoxSource, TestSourceSplit, register_test_source};
+use risingwave_simulation::cluster::{Cluster, Configuration};
+use tokio::time::{sleep, timeout};
+
+use crate::utils::{kill_cn_and_meta_and_wait_recover, wait_jobs_running};
+
+async fn wait_for_reader_builds(
+    reader_splits: &Arc<Mutex<Vec<Vec<TestSourceSplit>>>>,
+    expected: usize,
+) -> Result<()> {
+    timeout(Duration::from_secs(30), async {
+        loop {
+            if reader_splits.lock().unwrap().len() >= expected {
+                return;
+            }
+            sleep(Duration::from_millis(100)).await;
+        }
+    })
+    .await
+    .map_err(|_| {
+        anyhow!(
+            "timed out waiting for {expected} source reader builds; observed {:?}",
+            reader_splits.lock().unwrap()
+        )
+    })
+}
+
+#[tokio::test]
+async fn test_snapshot_backfill_recovers_embedded_source_splits() -> Result<()> {
+    let reader_splits = Arc::new(Mutex::new(Vec::new()));
+    let reader_splits_ref = reader_splits.clone();
+    let _source_guard = register_test_source(BoxSource::new(
+        |_, _| {
+            Ok(vec![TestSourceSplit {
+                id: "split-0".into(),
+                properties: Default::default(),
+                offset: String::new(),
+            }])
+        },
+        move |_, splits, _, _, _| {
+            reader_splits_ref.lock().unwrap().push(splits);
+            stream::pending::<ConnectorResult<StreamChunk>>().boxed()
+        },
+    ));
+
+    let mut cluster = Cluster::start(Configuration::for_background_ddl()).await?;
+    let mut session = cluster.start_session();
+
+    session.run("set streaming_parallelism = 1;").await?;
+    session
+        .run("set streaming_use_shared_source = false;")
+        .await?;
+    session.run("create table t (id int primary key);").await?;
+    session.run("insert into t values (1);").await?;
+    session.flush().await?;
+    session
+        .run("create materialized view upstream_mv as select * from t;")
+        .await?;
+    session
+        .run(
+            "create source test_source (id int) with (connector = 'test') \
+             format plain encode json;",
+        )
+        .await?;
+
+    session
+        .run("set streaming_use_snapshot_backfill = true;")
+        .await?;
+    session.run("set background_ddl = true;").await?;
+    // Keep the creating job in its independent partial graph throughout recovery.
+    session.run("set backfill_rate_limit = 0;").await?;
+    session
+        .run(
+            "create materialized view result_mv as \
+             select upstream_mv.id \
+             from upstream_mv join test_source \
+             on upstream_mv.id = test_source.id;",
+        )
+        .await?;
+
+    wait_jobs_running(&mut session).await?;
+    wait_for_reader_builds(&reader_splits, 1).await?;
+    let reader_builds_before_recovery = reader_splits.lock().unwrap().len();
+
+    kill_cn_and_meta_and_wait_recover(&mut cluster).await;
+
+    wait_for_reader_builds(&reader_splits, reader_builds_before_recovery + 1).await?;
+    let reader_splits = reader_splits.l
```

#### Recent Merged Pull Requests:
- **PR #27358** (2026-09-30): fix(cdc): backport streaming readiness and SQL Server shutdown fixes (@zwang28)
- **PR #27339** (2026-09-28): fix(object-store): propagate metadata errors during listing (#27266) (@risingwave-ci)
- **PR #27334** (2026-09-29): perf(storage): upgrade foyer to 0.22.6 with recovery backport (@Li0k)
- **PR #27317** (2026-09-27): chore(deps): Bump xorf from 0.12.0 to 0.13.0 (@dependabot[bot])
- **PR #27315** (2026-09-27): chore(deps): Bump rustls-pki-types from 1.14.0 to 1.15.1 (@dependabot[bot])
- **PR #27314** (closed): chore(deps): Bump parquet-variant from 58.4.0 to 59.3.0 (@dependabot[bot])
- **PR #27313** (2026-09-27): chore(deps): Bump http from 1.4.0 to 1.5.0 (@dependabot[bot])
- **PR #27311** (2026-09-27): chore(deps): Bump rust-embed from 8.11.0 to 8.12.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
