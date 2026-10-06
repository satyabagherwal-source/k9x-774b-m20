# Forensic Learning Record (Deep Inspection): trinodb/trino

> **Canonical Artifact**: `07_PROJECT_LEARNING/trinodb-trino-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/trinodb/trino](https://github.com/trinodb/trino))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:07:38.988Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `trinodb/trino`
- **Description**: Official repository of Trino, the distributed SQL query engine for big data, formerly known as PrestoSQL (https://trino.io)
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 13304 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `core/trino-web-ui/src/main/resources/webapp-legacy/assets/js/login.js`
```
/*
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
 */

$(document).ready(function () {
    var hidePassword = $('#hide-password').text().toLowerCase() === 'true';

    var redirectPath = window.location.search.substring(1);
    if (redirectPath.indexOf('&') !== -1) {
        redirectPath = redirectPath.substring(0, redirectPath.indexOf('&'));
    }
    $("#redirectPath").val(redirectPath);

    if (hidePassword) {
        $("#password")
                .prop('required', false)
                .prop('placeholder', 'Password not allowed')
                .prop('readonly', true);
    }
    $("#login").show();
    $("#username").focus().val("");
});

```

### Core Architecture Module: `core/trino-web-ui/src/main/resources/webapp-legacy/assets/js/timeline.js`
```
/*
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
 */

$(document).ready(function () {
    $.ajax({url: '/ui/api/query/' + window.location.search.substring(1)})
        .done(function(data) {
            $('#queryId').text(data.queryId);
            renderTimeline(data);

        });

    function renderTimeline(data) {
        tasks = []

        data.stages.stages.forEach((stage) => {
            Array.prototype.push.apply(tasks, stage.tasks)
        })

        tasks = tasks.map(function (task) {
            return {
                taskId: task.taskStatus.taskId.substring(task.taskStatus.taskId.indexOf('.') + 1),
                time: {
                    create: task.stats.createTime,
                    firstStart: task.stats.firstStartTime,
                    lastStart: task.stats.lastStartTime,
                    lastEnd: task.stats.lastEndTime,
                    end: task.stats.endTime,
                },
            };
        });

        var groups = new vis.DataSet();
        var items = new vis.DataSet();
        for (var i = 0; i < tasks.length; i++) {
            var task = tasks[i];
            var stageId = task.taskId.substr(0, task.taskId.indexOf("."));
            var taskNumber = task.taskId.substr(task.taskId.indexOf(".") + 1);
            if (taskNumber == 0) {
                groups.add({
                    id: stageId,
                    content: stageId,
                    sort: stageId,
                    subgroupOrder: 'sort',
                });
            }
            items.add({
                group: stageId,
                start: task.time.create,
                end: task.time.firstStart,
                className: 'gray',
                subgroup: taskNumber,
                sort: -taskNumber,
            });
            items.add({
                group: stageId,
                start: task.time.firstStart,
                end: task.time.lastStart,
                className: 'red',
                subgroup: taskNumber,
                sort: -taskNumber,
            });
            items.add({
                group: stageId,
                start: task.time.lastStart,
                end: task.time.lastEnd,
                className: 'blue',
                subgroup: taskNumber,
                sort: -taskNumber,
            });
            items.add({
                group: stageId,
                start: task.time.lastEnd,
                end: task.time.end,
                className: 'orange',
                subgroup: taskNumber,
                sort: -taskNumber,
            });
        }

        var options = {
            stack: false,
            groupOrder: 'sort',
            margin: 0,
            clickToUse: true,
        };

        new vis.Timeline(document.getElementById('timeline'), items, groups, options);
    }
});

```

### Core Architecture Module: `core/trino-web-ui/src/main/resources/webapp-legacy/src/components/ClusterHUD.jsx`
```
/*
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
 */

import React from 'react'

import {
    addExponentiallyWeightedToHistory,
    addToHistory,
    formatCount,
    formatDataSizeBytes,
    precisionRound,
} from '../utils'

const SPARKLINE_PROPERTIES = {
    width: '100%',
    height: '75px',
    fillColor: '#3F4552',
    lineColor: '#747F96',
    spotColor: '#1EDCFF',
    tooltipClassname: 'sparkline-tooltip',
    disableHiddenCheck: true,
}

export class ClusterHUD extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            runningQueries: [],
            queuedQueries: [],
            blockedQueries: [],
            activeWorkers: [],
            runningDrivers: [],
            reservedMemory: [],
            rowInputRate: [],
            byteInputRate: [],
            perWorkerCpuTimeRate: [],

            lastRender: null,
            lastRefresh: null,

            lastInputRows: null,
            lastInputBytes: null,
            lastCpuTime: null,

            initialized: false,
        }

        this.refreshLoop = this.refreshLoop.bind(this)
    }

    resetTimer() {
        clearTimeout(this.timeoutId)
        // stop refreshing when query finishes or fails
        if (this.state.query === null || !this.state.ended) {
            this.timeoutId = setTimeout(this.refreshLoop, 1000)
        }
    }

    refreshLoop() {
        clearTimeout(this.timeoutId) // to stop multiple series of refreshLoop from going on simultaneously
        $.get(
            '/ui/api/stats',
            function (clusterState) {
                let newRowInputRate = []
                let newByteInputRate = []
                let newPerWorkerCpuTimeRate = []
                if (this.state.lastRefresh !== null) {
                    const rowsInputSinceRefresh = clusterState.totalInputRows - this.state.lastInputRows
                    const bytesInputSinceRefresh = clusterState.totalInputBytes - this.state.lastInputBytes
                    const cpuTimeSinceRefresh = clusterState.totalCpuTimeSecs - this.state.lastCpuTime
                    const secsSinceRefresh = (Date.now() - this.state.lastRefresh) / 1000.0

                    newRowInputRate = addExponentiallyWeightedToHistory(
                        rowsInputSinceRefresh / secsSinceRefresh,
                        this.state.rowInputRate
                    )
                    newByteInputRate = addExponentiallyWeightedToHistory(
                        bytesInputSinceRefresh / secsSinceRefresh,
                        this.state.byteInputRate
                    )
                    newPerWorkerCpuTimeRate = addExponentiallyWeightedToHistory(
                        cpuTimeSinceRefresh / clusterState.activeWorkers / secsSinceRefresh,
                        this.state.perWorkerCpuTimeRate
                    )
                }

                this.setState({
                    // instantaneous stats
                    runningQueries: addToHistory(clusterState.runningQueries, this.state.runningQueries),
                    queuedQueries: addToHistory(clusterState.queuedQueries, this.state.queuedQueries),
                    blockedQueries: addToHistory(clusterState.blockedQueries, this.state.blockedQueries),
                    activeWorkers: addToHistory(clusterState.activeWorkers, this.state.activeWorkers),

                    // moving averages
                    runningDrivers: addExponentiallyWeightedToHistory(
                        clusterState.runningDrivers,
                        this.state.runningDrivers
                    ),
                    reservedMemory: addExponentiallyWeightedToHistory(
                        clusterState.reservedMemory,
                        this.state.reservedMemory
                    ),

                    // moving averages for diffs
                    rowInputRate: newRowInputRate,
                    byteInputRate: newByteInputRate,
                    perWorkerCpuTimeRate: newPerWorkerCpuTimeRate,

                    lastInputRows: clusterState.totalInputRows,
                    lastInputBytes: clusterState.totalInputBytes,
                    lastCpuTime: clusterState.totalCpuTimeSecs,

                    initialized: true,

                    lastRefresh: Date.now(),
                })
                this.resetTimer()
            }.bind(this)
        ).fail(
            function () {
                this.resetTimer()
            }.bind(this)
        )
    }

    componentDidMount() {
        this.refreshLoop()
    }

    componentDidUpdate() {
        // prevent multiple calls to componentDidUpdate (resulting from calls to setState or otherwise) within the refresh interval from re-rendering sparklines/charts
        if (this.state.lastRender === null || Date.now() - this.state.lastRender >= 1000) {
            const renderTimestamp = Date.now()
            $('#running-queries-sparkline').sparkline(
                this.state.runningQueries,
                $.extend({}, SPARKLINE_PROPERTIES, { chartRangeMin: 0 })
            )
            $('#blocked-queries-sparkline').sparkline(
                this.state.blockedQueries,
                $.extend({}, SPARKLINE_PROPERTIES, { chartRangeMin: 0 })
            )
            $('#queued-queries-sparkline').sparkline(
                this.state.queuedQueries,
                $.extend({}, SPARKLINE_PROPERTIES, { chartRangeMin: 0 })
            )

            $('#active-workers-sparkline').sparkline(
                this.state.activeWorkers,
                $.extend({}, SPARKLINE_PROPERTIES, { chartRangeMin: 0 })
            )
            $('#running-drivers-sparkline').sparkline(
                this.state.runningDrivers,
                $.extend({}, SPARKLINE_PROPERTIES, {
                    numberFormatter: precisionRound,
                })
            )
            $('#reserved-memory-sparkline').sparkline(
                this.state.reservedMemory,
                $.extend({}, SPARKLINE_PROPERTIES, {
                    numberFormatter: formatDataSizeBytes,
                })
            )

            $('#row-input-rate-sparkline').sparkline(
                this.state.rowInputRate,
                $.extend({}, SPARKLINE_PROPERTIES, {
                    numberFormatter: formatCount,
                })
            )
            $('#byte-input-rate-sparkline').sparkline(
                this.state.byteInputRate,
                $.extend({}, SPARKLINE_PROPERTIES, {
                    numberFormatter: formatDataSizeBytes,
                })
            )
            $('#cpu-time-rate-sparkline').sparkline(
                this.state.perWorkerCpuTimeRate,
                $.extend({}, SPARKLINE_PROPERTIES, {
                    numberFormatter: precisionRound,
                })
            )

            this.setState({
                lastRender: renderTimestamp,
            })
        }

        $('[data-toggle="tooltip"]').tooltip()
    }

    render() {
        return (
            <div className="row">
                <div className="col-xs-12">
                    <div className="row">
                        <div className="col-xs-4">
                            <div className="stat-title">
                                <span
                                    className="text"
                                    data-toggle="tooltip"
                                    data-placement="right"
                                    title="Total number of queries currently running"
                                >
                                    Running queries
                                </span>
                            </div>
                        </div>
                        <div className="col-xs-4">
                            <div className="stat-title">
                                <span
                                    className="text"
                                    data-toggle="tooltip"
                                    data-placement="right"
                                    title="Total number of active worker nodes"
                                >
                                    Active workers
                                </span>
                            </div>
                        </div>
                        <div className="col-xs-4">
                            <div className="stat-title">
                                <span
                                    className="text"
                                    data-toggle="tooltip"
                                    data-placement="right"
                                    title="Moving average of input rows processed per second"
                                >
                                    rows/s
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="row stat-line-end">
                        <div className="col-xs-4">
                            <div className="stat stat-large">
                                <span className="stat-text">
                                    {this.state.runningQueries[this.state.runningQueries.length - 1]}
                                </span>
                                <span className="sparkline" id="running-queries-sparkline">
                                    <div className="loader">Loading ...</div>
             
```

### Core Architecture Module: `core/trino-web-ui/src/main/resources/webapp-legacy/src/components/LivePlan.jsx`
```
/*
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
 */
//@flow

import React from 'react'
import ReactDOMServer from 'react-dom/server'
import * as dagreD3 from 'dagre-d3'
import * as d3 from 'd3'

import {
    formatRows,
    getStageStateColor,
    initializeGraph,
    initializeSvg,
    parseAndFormatDataSize,
    truncateString,
} from '../utils'
import { QueryHeader } from './QueryHeader'

type StageStatisticsProps = {
    stage: any,
}
type StageStatisticsState = {}
type StageNodeInfo = {
    stageId: string,
    id: string,
    root: string,
    distribution: any,
    stageStats: any,
    state: string,
    nodes: Map<string, any>,
}

class StageStatistics extends React.Component<StageStatisticsProps, StageStatisticsState> {
    static getStages(queryInfo: any): Map<string, StageNodeInfo> {
        const stages: Map<string, StageNodeInfo> = new Map()
        queryInfo.stages.stages.forEach(function (stageInfo) {
            const nodes = new Map<any, PlanNodeProps>()
            StageStatistics.flattenNode(stageInfo.plan.root, JSON.parse(stageInfo.plan.jsonRepresentation), nodes)
            stages.set(stageInfo.plan.id, {
                stageId: stageInfo.stageId,
                id: stageInfo.plan.id,
                root: stageInfo.plan.root.id,
                distribution: stageInfo.plan.distribution,
                stageStats: stageInfo.stageStats,
                state: stageInfo.state,
                nodes: nodes,
            })
        })
        return stages
    }

    static flattenNode(rootNodeInfo: any, node: any, result: Map<any, PlanNodeProps>) {
        result.set(node.id, {
            id: node.id,
            name: node['name'],
            descriptor: node['descriptor'],
            details: node['details'],
            sources: node.children.map((node) => node.id),
        })

        node.children.forEach(function (child) {
            StageStatistics.flattenNode(rootNodeInfo, child, result)
        })
    }

    render(): any {
        const stage = this.props.stage
        const stats = this.props.stage.stageStats
        return (
            <div>
                <div>
                    <h3 className="margin-top: 0">Stage {stage.id}</h3>
                    {stage.state}
                    <hr />
                    CPU: {stats.totalCpuTime}
                    <br />
                    Buffered: {parseAndFormatDataSize(stats.bufferedDataSize)}
                    <br />
                    {stats.fullyBlocked ? (
                        <div style={{ color: '#ff0000' }}>Blocked: {stats.totalBlockedTime} </div>
                    ) : (
                        <div>Blocked: {stats.totalBlockedTime} </div>
                    )}
                    Memory: {parseAndFormatDataSize(stats.userMemoryReservation)}
                    <br />
                    Splits:{' '}
                    {'Q:' + stats.queuedDrivers + ', R:' + stats.runningDrivers + ', F:' + stats.completedDrivers}
                    <hr />
                    Input:{' '}
                    {parseAndFormatDataSize(stats.processedInputDataSize) +
                        ' / ' +
                        formatRows(stats.processedInputPositions)}
                </div>
            </div>
        )
    }
}

type PlanNodeProps = {
    id: string,
    name: string,
    descriptor: Map<string, string>,
    details: string[],
    sources: string[],
}
type PlanNodeState = {}

class PlanNode extends React.Component<PlanNodeProps, PlanNodeState> {
    constructor(props: PlanNodeProps) {
        super(props)
    }

    render(): any {
        // get join distribution type by matching details to a regular expression
        var distribution = ''
        var matchArray = this.props.details.join('\n').match(/Distribution:\s+(\w+)/)
        if (matchArray !== null) {
            distribution = ' (' + matchArray[1] + ')'
        }

        var descriptor = Object.entries(this.props.descriptor)
            .map(([key, value]) => key + ' = ' + String(value))
            .join(', ')
        descriptor = '(' + descriptor + ')'

        return (
            <div
                style={{ color: '#000' }}
                data-toggle="tooltip"
                data-placement="bottom"
                data-container="body"
                data-html="true"
                title={'<h4>' + this.props.name + '</h4>' + descriptor}
            >
                <strong>{this.props.name + distribution}</strong>
                <div>{truncateString(descriptor, 35)}</div>
            </div>
        )
    }
}

type LivePlanProps = {
    queryId: string,
    isEmbedded: boolean,
}

type LivePlanState = {
    initialized: boolean,
    ended: boolean,

    query: ?any,

    graph: any,
    svg: any,
    render: any,
}

export class LivePlan extends React.Component<LivePlanProps, LivePlanState> {
    timeoutId: TimeoutID

    constructor(props: LivePlanProps) {
        super(props)
        this.state = {
            initialized: false,
            ended: false,

            query: null,

            graph: initializeGraph(),
            svg: null,
            render: new dagreD3.render(),
        }
    }

    resetTimer() {
        clearTimeout(this.timeoutId)
        // stop refreshing when query finishes or fails
        if (this.state.query === null || !this.state.ended) {
            this.timeoutId = setTimeout(this.refreshLoop.bind(this), 1000)
        }
    }

    refreshLoop = () => {
        clearTimeout(this.timeoutId) // to stop multiple series of refreshLoop from going on simultaneously
        fetch('/ui/api/query/' + this.props.queryId)
            .then((response) => response.json())
            .then((query) => {
                this.setState({
                    query: query,

                    initialized: true,
                    ended: query.finalQueryInfo,
                })
                this.resetTimer()
            })
            .catch(() => {
                this.setState({
                    initialized: true,
                })
                this.resetTimer()
            })
    }

    static handleStageClick(stageCssId: string) {
        window.open('stage.html?' + stageCssId, '_blank')
    }

    componentDidMount() {
        this.refreshLoop.bind(this)()
        new window.ClipboardJS('.copy-button')
    }

    updateD3Stage(stage: StageNodeInfo, graph: any, allStages: Map<string, StageNodeInfo>) {
        const clusterId = stage.stageId
        const stageRootNodeId = 'stage-' + stage.id + '-root'
        const color = getStageStateColor(stage)

        graph.setNode(clusterId, {
            style: 'fill: ' + color,
            labelStyle: 'fill: #fff',
        })

        // this is a non-standard use of ReactDOMServer, but it's the cleanest way to unify DagreD3 with React
        const html = ReactDOMServer.renderToString(<StageStatistics key={stage.id} stage={stage} />)

        graph.setNode(stageRootNodeId, {
            class: 'stage-stats',
            label: html,
            labelType: 'html',
        })
        graph.setParent(stageRootNodeId, clusterId)
        graph.setEdge('node-' + stage.root, stageRootNodeId, {
            style: 'visibility: hidden',
        })

        stage.nodes.forEach((node) => {
            const nodeId = 'node-' + node.id
            const nodeHtml = ReactDOMServer.renderToString(<PlanNode {...node} />)

            graph.setNode(nodeId, {
                label: nodeHtml,
                style: 'fill: #fff',
                labelType: 'html',
            })
            graph.setParent(nodeId, clusterId)

            node.sources.forEach((source) => {
                graph.setEdge('node-' + source, nodeId, {
                    class: 'plan-edge',
                    arrowheadClass: 'plan-arrowhead',
                })
            })

            var sourceFragmentIds = node.descriptor['sourceFragmentIds']
            if (sourceFragmentIds) {
                var remoteSources = sourceFragmentIds.replace('[', '').replace(']', '').split(', ')
                if (remoteSources.length > 0) {
                    graph.setNode(nodeId, { label: '', shape: 'circle' })

                    remoteSources.forEach((sourceId) => {
                        const source = allStages.get(sourceId)
                        if (source) {
                            const sourceStats = source.stageStats
                            graph.setEdge('stage-' + sourceId + '-root', nodeId, {
                                class: 'plan-edge',
                                style: 'stroke-width: 4px',
                                arrowheadClass: 'plan-arrowhead',
                                label:
                                    parseAndFormatDataSize(sourceStats.outputDataSize) +
                                    ' / ' +
                                    formatRows(sourceStats.outputPositions),
                                labelStyle: 'color: #fff; font-weight: bold; font-size: 24px;',
                                labelType: 'html',
                            })
                        }
                    })
                }
            }
        })
    }

    updateD3Graph() {
        if (!this.state.svg) {
            this.setState({
                svg: initializeSvg('#plan-canvas'),
            })
            return
        }

        if (!this.state.query) {
            return
        }

        const graph = this.state.graph
        const stages = StageStatistics.getSta
```

### Core Architecture Module: `core/trino-web-ui/src/main/resources/webapp-legacy/src/components/PageTitle.jsx`
```
/*
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
 */
//@flow
import React from 'react'

type Props = {
    title: string,
}

type State = {
    noConnection: boolean,
    lightShown: boolean,
    info: ?any,
    lastSuccess: number,
    modalShown: boolean,
    errorText: ?string,
}

export class PageTitle extends React.Component<Props, State> {
    timeoutId: TimeoutID

    constructor(props: Props) {
        super(props)
        this.state = {
            noConnection: false,
            lightShown: false,
            info: null,
            lastSuccess: Date.now(),
            modalShown: false,
            errorText: null,
        }
    }

    refreshLoop = () => {
        clearTimeout(this.timeoutId)
        fetch('/ui/api/cluster')
            .then((response) => {
                if (response.status === 401) {
                    location.reload()
                }
                return response.json()
            })
            .then((info) => {
                this.setState({
                    info: info,
                    noConnection: false,
                    lastSuccess: Date.now(),
                    modalShown: false,
                })
                //$FlowFixMe$ Bootstrap 3 plugin
                $('#no-connection-modal').modal('hide')
                this.resetTimer()
            })
            .catch((fail) => {
                this.setState({
                    noConnection: true,
                    lightShown: !this.state.lightShown,
                    errorText: fail,
                })
                this.resetTimer()

                if (!this.state.modalShown && (fail || Date.now() - this.state.lastSuccess > 30 * 1000)) {
                    //$FlowFixMe$ Bootstrap 3 plugin
                    $('#no-connection-modal').modal()
                    this.setState({ modalShown: true })
                }
            })
    }

    resetTimer() {
        clearTimeout(this.timeoutId)
        this.timeoutId = setTimeout(this.refreshLoop.bind(this), 1000)
    }

    componentDidMount() {
        this.refreshLoop.bind(this)()
    }

    renderStatusLight(): any {
        if (this.state.noConnection) {
            if (this.state.lightShown) {
                return <span className="status-light status-light-red" id="status-indicator" />
            } else {
                return <span className="status-light" id="status-indicator" />
            }
        }
        return <span className="status-light status-light-green" id="status-indicator" />
    }

    render(): any {
        const info = this.state.info
        if (!info) {
            return null
        }

        return (
            <div>
                <nav className="navbar">
                    <div className="container-fluid">
                        <div className="navbar-header">
                            <table>
                                <tbody>
                                    <tr>
                                        <td>
                                            <a href="/ui/">
                                                <img src="assets/logo.png" />
                                            </a>
                                        </td>
                                        <td>
                                            <span className="navbar-brand">{this.props.title}</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div id="navbar" className="navbar-collapse collapse">
                            <ul className="nav navbar-nav navbar-right">
                                <li>
                                    <span className="navbar-cluster-info">
                                        <span className="text">
                                            <a className="btn btn-info" href="/ui">
                                                New Web UI
                                            </a>
                                        </span>
                                    </span>
                                </li>
                                <li>
                                    <span className="navbar-cluster-info">
                                        <span className="uppercase">Version</span>
                                        <br />
                                        <span className="text uppercase" id="version-number">
                                            {info.nodeVersion.version}
                                        </span>
                                    </span>
                                </li>
                                <li>
                                    <span className="navbar-cluster-info">
                                        <span className="uppercase">Environment</span>
                                        <br />
                                        <span className="text uppercase" id="environment">
                                            {info.environment}
                                        </span>
                                    </span>
                                </li>
                                <li>
                                    <span className="navbar-cluster-info">
                                        <span className="uppercase">Uptime</span>
                                        <br />
                                        <span data-toggle="tooltip" data-placement="bottom" title="Connection status">
                                            {this.renderStatusLight()}
                                        </span>
                                        &nbsp;
                                        <span className="text" id="uptime">
                                            {info.uptime}
                                        </span>
                                    </span>
                                </li>
                                <li>
                                    <span className="navbar-cluster-info">
                                        <span className="text" id="logout">
                                            <a className="btn btn-logout" href="logout">
                                                Log Out
                                            </a>
                                        </span>
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </nav>
                <div id="no-connection-modal" className="modal" tabIndex="-1" role="dialog">
                    <div className="modal-dialog modal-sm" role="document">
                        <div className="modal-content">
                            <div className="row error-message">
                                <div className="col-xs-12">
                                    <br />
                                    <h4>Unable to connect to server</h4>
                                    <p>{this.state.errorText ? 'Error: ' + this.state.errorText : null}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

```

### Core Architecture Module: `core/trino-web-ui/src/main/resources/webapp-legacy/src/components/QueryDetail.jsx`
```
/*
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
 */

import React from 'react'
import Reactable from 'reactable'
import { SqlBlock } from './SqlBlock'

import {
    addToHistory,
    computeRate,
    formatCount,
    formatDataSize,
    formatDataSizeBytes,
    formatDuration,
    formatShortDateTime,
    getFirstParameter,
    getHostAndPort,
    getHostname,
    getPort,
    getStageNumber,
    getStageStateColor,
    getTaskIdSuffix,
    getTaskNumber,
    GLYPHICON_HIGHLIGHT,
    parseAndFormatDataSize,
    parseDataSize,
    parseDuration,
    precisionRound,
} from '../utils'
import { QueryHeader } from './QueryHeader'

const Table = Reactable.Table,
    Thead = Reactable.Thead,
    Th = Reactable.Th,
    Tr = Reactable.Tr,
    Td = Reactable.Td

class TaskList extends React.Component {
    static removeQueryId(id) {
        const pos = id.indexOf('.')
        if (pos !== -1) {
            return id.substring(pos + 1)
        }
        return id
    }

    static compareTaskId(taskA, taskB) {
        const taskIdArrA = TaskList.removeQueryId(taskA).split('.')
        const taskIdArrB = TaskList.removeQueryId(taskB).split('.')

        if (taskIdArrA.length > taskIdArrB.length) {
            return 1
        }
        for (let i = 0; i < taskIdArrA.length; i++) {
            const anum = Number.parseInt(taskIdArrA[i])
            const bnum = Number.parseInt(taskIdArrB[i])
            if (anum !== bnum) {
                return anum > bnum ? 1 : -1
            }
        }

        return 0
    }

    static showPortNumbers(tasks) {
        // check if any host has multiple port numbers
        const hostToPortNumber = {}
        for (let i = 0; i < tasks.length; i++) {
            const taskUri = tasks[i].taskStatus.self
            const hostname = getHostname(taskUri)
            const port = getPort(taskUri)
            if (hostname in hostToPortNumber && hostToPortNumber[hostname] !== port) {
                return true
            }
            hostToPortNumber[hostname] = port
        }

        return false
    }

    static formatState(state, fullyBlocked) {
        if (fullyBlocked && state === 'RUNNING') {
            return 'BLOCKED'
        } else {
            return state
        }
    }

    render() {
        const tasks = this.props.tasks
        const taskRetriesEnabled = this.props.taskRetriesEnabled

        if (tasks === undefined || tasks.length === 0) {
            return (
                <div className="row error-message">
                    <div className="col-xs-12">
                        <h4>No threads in the selected group</h4>
                    </div>
                </div>
            )
        }

        const showPortNumbers = TaskList.showPortNumbers(tasks)

        const renderedTasks = tasks.map((task) => {
            let elapsedTime = parseDuration(task.stats.elapsedTime)
            if (elapsedTime === 0) {
                elapsedTime = Date.now() - Date.parse(task.stats.createTime)
            }

            return (
                <Tr key={task.taskStatus.taskId}>
                    <Td column="id" value={task.taskStatus.taskId}>
                        <a
                            href={
                                '/ui/api/worker/' +
                                task.taskStatus.nodeId +
                                '/task/' +
                                task.taskStatus.taskId +
                                '?pretty'
                            }
                        >
                            {getTaskIdSuffix(task.taskStatus.taskId)}
                        </a>
                    </Td>
                    <Td column="host" value={getHostname(task.taskStatus.self)}>
                        <a href={'worker.html?' + task.taskStatus.nodeId} className="font-light" target="_blank">
                            {showPortNumbers ? getHostAndPort(task.taskStatus.self) : getHostname(task.taskStatus.self)}
                        </a>
                    </Td>
                    <Td column="state" value={TaskList.formatState(task.taskStatus.state, task.stats.fullyBlocked)}>
                        {TaskList.formatState(task.taskStatus.state, task.stats.fullyBlocked)}
                    </Td>
                    <Td column="rows" value={task.stats.processedInputPositions}>
                        {formatCount(task.stats.processedInputPositions)}
                    </Td>
                    <Td column="rowsSec" value={computeRate(task.stats.processedInputPositions, elapsedTime)}>
                        {formatCount(computeRate(task.stats.processedInputPositions, elapsedTime))}
                    </Td>
                    <Td column="bytes" value={parseDataSize(task.stats.processedInputDataSize)}>
                        {formatDataSizeBytes(parseDataSize(task.stats.processedInputDataSize))}
                    </Td>
                    <Td
                        column="bytesSec"
                        value={computeRate(parseDataSize(task.stats.processedInputDataSize), elapsedTime)}
                    >
                        {formatDataSizeBytes(
                            computeRate(parseDataSize(task.stats.processedInputDataSize), elapsedTime)
                        )}
                    </Td>
                    <Td column="splitsPending" value={task.stats.queuedDrivers}>
                        {task.stats.queuedDrivers}
                    </Td>
                    <Td column="splitsRunning" value={task.stats.runningDrivers}>
                        {task.stats.runningDrivers}
                    </Td>
                    <Td column="splitsBlocked" value={task.stats.blockedDrivers}>
                        {task.stats.blockedDrivers}
                    </Td>
                    <Td column="splitsDone" value={task.stats.completedDrivers}>
                        {task.stats.completedDrivers}
                    </Td>
                    <Td column="elapsedTime" value={parseDuration(task.stats.elapsedTime)}>
                        {task.stats.elapsedTime}
                    </Td>
                    <Td column="cpuTime" value={parseDuration(task.stats.totalCpuTime)}>
                        {task.stats.totalCpuTime}
                    </Td>
                    <Td column="bufferedBytes" value={task.outputBuffers.totalBufferedBytes}>
                        {formatDataSizeBytes(task.outputBuffers.totalBufferedBytes)}
                    </Td>
                    <Td column="memory" value={parseDataSize(task.stats.userMemoryReservation)}>
                        {parseAndFormatDataSize(task.stats.userMemoryReservation)}
                    </Td>
                    <Td column="peakMemory" value={parseDataSize(task.stats.peakUserMemoryReservation)}>
                        {parseAndFormatDataSize(task.stats.peakUserMemoryReservation)}
                    </Td>
                    {taskRetriesEnabled && (
                        <Td column="estimatedMemory" value={parseDataSize(task.estimatedMemory)}>
                            {parseAndFormatDataSize(task.estimatedMemory)}
                        </Td>
                    )}
                </Tr>
            )
        })

        return (
            <Table
                id="tasks"
                className="table table-striped sortable"
                sortable={[
                    {
                        column: 'id',
                        sortFunction: TaskList.compareTaskId,
                    },
                    'host',
                    'state',
                    'splitsPending',
                    'splitsRunning',
                    'splitsBlocked',
                    'splitsDone',
                    'rows',
                    'rowsSec',
                    'bytes',
                    'bytesSec',
                    'elapsedTime',
                    'cpuTime',
                    'bufferedBytes',
                    'memory',
                    'peakMemory',
                    'estimatedMemory',
                ]}
                defaultSort={{ column: 'id', direction: 'asc' }}
            >
                <Thead>
                    <Th column="id">ID</Th>
                    <Th column="host">Host</Th>
                    <Th column="state">State</Th>
                    <Th column="splitsPending">
                        <span
                            className="glyphicon glyphicon-pause"
                            style={GLYPHICON_HIGHLIGHT}
                            data-toggle="tooltip"
                            data-placement="top"
                            title="Pending splits"
                        />
                    </Th>
                    <Th column="splitsRunning">
                        <span
                            className="glyphicon glyphicon-play"
                            style={GLYPHICON_HIGHLIGHT}
                            data-toggle="tooltip"
                            data-placement="top"
                            title="Running splits"
                        />
                    </Th>
                    <Th column="splitsBlocked">
                        <span
                            className="glyphicon glyphicon-bookmark"
                            style={GLYPHICON_HIGHLIGHT}
                            data-toggle="tooltip"
                            data-placement="top"
                            title="Blocked splits"
                        />
                    </Th
```

### Core Architecture Module: `core/trino-web-ui/src/main/resources/webapp-legacy/src/components/QueryHeader.jsx`
```
/*
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
 */

import React from 'react'

import { getProgressBarPercentage, getProgressBarTitle, getQueryStateColor, isQueryEnded } from '../utils'

export class QueryHeader extends React.Component {
    constructor(props) {
        super(props)
    }

    renderProgressBar() {
        const query = this.props.query
        const progressBarStyle = {
            width: getProgressBarPercentage(query) + '%',
            backgroundColor: getQueryStateColor(query),
        }

        if (isQueryEnded(query)) {
            return (
                <div className="progress-large">
                    <div
                        className="progress-bar progress-bar-info"
                        role="progressbar"
                        aria-valuenow={getProgressBarPercentage(query)}
                        aria-valuemin="0"
                        aria-valuemax="100"
                        style={progressBarStyle}
                    >
                        {getProgressBarTitle(query, false)}
                    </div>
                </div>
            )
        }

        return (
            <table>
                <tbody>
                    <tr>
                        <td width="100%">
                            <div className="progress-large">
                                <div
                                    className="progress-bar progress-bar-info"
                                    role="progressbar"
                                    aria-valuenow={getProgressBarPercentage(query)}
                                    aria-valuemin="0"
                                    aria-valuemax="100"
                                    style={progressBarStyle}
                                >
                                    {getProgressBarTitle(query, false)}
                                </div>
                            </div>
                        </td>
                        <td>
                            <a
                                onClick={() =>
                                    $.ajax({
                                        url: '/ui/api/query/' + query.queryId + '/preempted',
                                        type: 'PUT',
                                        data: 'Preempted via web UI',
                                    })
                                }
                                className="btn btn-warning"
                                target="_blank"
                            >
                                Preempt
                            </a>
                        </td>
                        <td>
                            <a
                                onClick={() =>
                                    $.ajax({
                                        url: '/ui/api/query/' + query.queryId + '/killed',
                                        type: 'PUT',
                                        data: 'Killed via web UI',
                                    })
                                }
                                className="btn btn-warning"
                                target="_blank"
                            >
                                Kill
                            </a>
                        </td>
                    </tr>
                </tbody>
            </table>
        )
    }

    renderTab(path, name) {
        const queryId = this.props.query.queryId
        if (window.location.pathname.includes(path)) {
            return (
                <a href={path + '?' + queryId} className="btn btn-info navbar-btn nav-disabled">
                    {name}
                </a>
            )
        }

        return (
            <a href={path + '?' + queryId} className="btn btn-info navbar-btn">
                {name}
            </a>
        )
    }

    render() {
        const query = this.props.query
        return (
            <div>
                <div className="row">
                    <div className="col-xs-6">
                        <h3 className="query-id">
                            <span id="query-id">{query.queryId}</span>
                            <a
                                className="btn copy-button"
                                data-clipboard-target="#query-id"
                                data-toggle="tooltip"
                                data-placement="right"
                                title="Copy to clipboard"
                            >
                                <span className="glyphicon glyphicon-copy" aria-hidden="true" alt="Copy to clipboard" />
                            </a>
                        </h3>
                    </div>
                    <div className="col-xs-6">
                        <table className="header-inline-links">
                            <tbody>
                                <tr>
                                    <td>
                                        {this.renderTab('query.html', 'Overview')}
                                        &nbsp;
                                        {this.renderTab('plan.html', 'Live Plan')}
                                        &nbsp;
                                        {this.renderTab('stage.html', 'Stage Performance')}
                                        &nbsp;
                                        {this.renderTab('timeline.html', 'Splits')}
                                        &nbsp;
                                        <a
                                            href={'/ui/api/query/' + query.queryId + '?pretty'}
                                            className="btn btn-info navbar-btn"
                                            target="_blank"
                                        >
                                            JSON
                                        </a>
                                        &nbsp;
                                        {this.renderTab('references.html', 'References')}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <hr className="h2-hr" />
                <div className="row">
                    <div className="col-xs-12">{this.renderProgressBar()}</div>
                </div>
            </div>
        )
    }
}

```

### Core Architecture Module: `core/trino-web-ui/src/main/resources/webapp-legacy/src/components/QueryList.jsx`
```
/*
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
 */

import React from 'react'

import {
    formatDataSizeBytes,
    formatShortTime,
    getHumanReadableState,
    getProgressBarPercentage,
    getProgressBarTitle,
    getQueryStateColor,
    GLYPHICON_DEFAULT,
    GLYPHICON_HIGHLIGHT,
    parseAndFormatDataSize,
    parseDataSize,
    parseDuration,
    truncateString,
} from '../utils'

import { SqlBlock } from './SqlBlock'

export class QueryListItem extends React.Component {
    static stripQueryTextWhitespace(queryText) {
        const maxLines = 6
        const lines = queryText.split('\n')
        let minLeadingWhitespace = -1
        for (let i = 0; i < lines.length; i++) {
            if (minLeadingWhitespace === 0) {
                break
            }

            if (lines[i].trim().length === 0) {
                continue
            }

            const leadingWhitespace = lines[i].search(/\S/)

            if (leadingWhitespace > -1 && (leadingWhitespace < minLeadingWhitespace || minLeadingWhitespace === -1)) {
                minLeadingWhitespace = leadingWhitespace
            }
        }

        let formattedQueryText = ''

        for (let i = 0; i < lines.length; i++) {
            const trimmedLine = lines[i].substring(minLeadingWhitespace).replace(/\s+$/g, '')

            if (trimmedLine.length > 0) {
                formattedQueryText += trimmedLine
                if (i < maxLines - 1) {
                    formattedQueryText += '\n'
                } else {
                    formattedQueryText += '\n...'
                    break
                }
            }
        }

        return formattedQueryText
    }

    render() {
        const query = this.props.query
        const progressBarStyle = {
            width: getProgressBarPercentage(query) + '%',
            backgroundColor: getQueryStateColor(query),
        }

        const splitDetails = (
            <div className="col-xs-12 tinystat-row">
                <span className="tinystat" data-toggle="tooltip" data-placement="top" title="Completed splits">
                    <span className="glyphicon glyphicon-ok" style={GLYPHICON_HIGHLIGHT} />
                    &nbsp;&nbsp;
                    {query.queryStats.completedDrivers}
                </span>
                <span className="tinystat" data-toggle="tooltip" data-placement="top" title="Running splits">
                    <span className="glyphicon glyphicon-play" style={GLYPHICON_HIGHLIGHT} />
                    &nbsp;&nbsp;
                    {query.state === 'FINISHED' || query.state === 'FAILED' ? 0 : query.queryStats.runningDrivers}
                </span>
                <span className="tinystat" data-toggle="tooltip" data-placement="top" title="Queued splits">
                    <span className="glyphicon glyphicon-pause" style={GLYPHICON_HIGHLIGHT} />
                    &nbsp;&nbsp;
                    {query.state === 'FINISHED' || query.state === 'FAILED' ? 0 : query.queryStats.queuedDrivers}
                </span>
                {query.retryPolicy === 'TASK' && (
                    <span className="tinystat" data-toggle="tooltip" data-placement="top" title="Failed tasks">
                        <span className="glyphicon glyphicon-remove-circle" style={GLYPHICON_HIGHLIGHT} />
                        &nbsp;&nbsp;
                        {query.queryStats.failedTasks}
                    </span>
                )}
            </div>
        )

        const timingDetails = (
            <div className="col-xs-12 tinystat-row">
                <span
                    className="tinystat"
                    data-toggle="tooltip"
                    data-placement="top"
                    title="Wall time spent executing the query (not including queued time)"
                >
                    <span className="glyphicon glyphicon-hourglass" style={GLYPHICON_HIGHLIGHT} />
                    &nbsp;&nbsp;
                    {query.queryStats.executionTime}
                </span>
                <span className="tinystat" data-toggle="tooltip" data-placement="top" title="Total query wall time">
                    <span className="glyphicon glyphicon-time" style={GLYPHICON_HIGHLIGHT} />
                    &nbsp;&nbsp;
                    {query.queryStats.elapsedTime}
                </span>
                <span
                    className="tinystat"
                    data-toggle="tooltip"
                    data-placement="top"
                    title="CPU time spent by this query"
                >
                    <span className="glyphicon glyphicon-dashboard" style={GLYPHICON_HIGHLIGHT} />
                    &nbsp;&nbsp;
                    {query.queryStats.totalCpuTime}
                </span>
            </div>
        )

        const memoryDetails = (
            <div className="col-xs-12 tinystat-row">
                <span
                    className="tinystat"
                    data-toggle="tooltip"
                    data-placement="top"
                    title="Current total reserved memory"
                >
                    <span className="glyphicon glyphicon-scale" style={GLYPHICON_HIGHLIGHT} />
                    &nbsp;&nbsp;
                    {parseAndFormatDataSize(query.queryStats.totalMemoryReservation)}
                </span>
                <span className="tinystat" data-toggle="tooltip" data-placement="top" title="Peak total memory">
                    <span className="glyphicon glyphicon-fire" style={GLYPHICON_HIGHLIGHT} />
                    &nbsp;&nbsp;
                    {parseAndFormatDataSize(query.queryStats.peakTotalMemoryReservation)}
                </span>
                <span className="tinystat" data-toggle="tooltip" data-placement="top" title="Cumulative user memory">
                    <span className="glyphicon glyphicon-equalizer" style={GLYPHICON_HIGHLIGHT} />
                    &nbsp;&nbsp;
                    {formatDataSizeBytes(query.queryStats.cumulativeUserMemory / 1000.0)}
                </span>
            </div>
        )

        let user = <span>{query.sessionUser}</span>
        if (query.sessionPrincipal) {
            user = (
                <span>
                    {query.sessionUser}
                    <span className="glyphicon glyphicon-lock-inverse" style={GLYPHICON_DEFAULT} />
                </span>
            )
        }

        return (
            <div className="query">
                <div className="row">
                    <div className="col-xs-4">
                        <div className="row stat-row query-header query-header-queryid">
                            <div
                                className="col-xs-6"
                                data-toggle="tooltip"
                                data-placement="bottom"
                                data-trigger="hover"
                                title="Query ID"
                            >
                                <a href={'query.html?' + query.queryId} target="_blank">
                                    {query.queryId}
                                </a>
                            </div>
                            <div className="col-xs-4 text-right">
                                <a
                                    href={'/ui/api/query/' + query.queryId + '?pretty'}
                                    target="_blank"
                                    data-toggle="tooltip"
                                    data-placement="bottom"
                                    data-trigger="hover"
                                    title="Query JSON"
                                >
                                    <span className="glyphicon glyphicon-save-file" style={GLYPHICON_DEFAULT} />
                                </a>
                                &nbsp;
                                <a
                                    href={'stage.html?' + query.queryId}
                                    data-toggle="tooltip"
                                    data-placement="bottom"
                                    data-trigger="hover"
                                    title="Stage performance"
                                >
                                    <span className="glyphicon glyphicon-equalizer" style={GLYPHICON_DEFAULT} />
                                </a>
                                &nbsp;
                                <a
                                    href={'plan.html?' + query.queryId}
                                    data-toggle="tooltip"
                                    data-placement="bottom"
                                    data-trigger="hover"
                                    title="Query plan"
                                >
                                    <span
                                        className="glyphicon glyphicon-object-align-vertical"
                                        style={GLYPHICON_DEFAULT}
                                    />
                                </a>
                                &nbsp;
                                <a
                                    href={'references.html?' + query.queryId}
                                    data-toggle="tooltip"
                                    data-placement="bottom"
                                    data-trigger="hover"
                                    title="References"
         
```

### Core Architecture Module: `core/trino-web-ui/src/main/resources/webapp-legacy/src/components/ReferenceDetail.jsx`
```
/*
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
 */

import React from 'react'

import {
    formatCount,
    formatDataSize,
    formatDuration,
    getChildren,
    getFirstParameter,
    getTaskNumber,
    initializeGraph,
    initializeSvg,
    isQueryEnded,
    parseAndFormatDataSize,
    parseDataSize,
    parseDuration,
} from '../utils'
import { QueryHeader } from './QueryHeader'

export class ReferenceDetail extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            initialized: false,
            ended: false,
            query: null,
        }

        this.refreshLoop = this.refreshLoop.bind(this)
    }

    resetTimer() {
        clearTimeout(this.timeoutId)
        // stop refreshing when query finishes or fails
        if (this.state.query === null || !this.state.ended) {
            this.timeoutId = setTimeout(this.refreshLoop, 1000)
        }
    }

    refreshLoop() {
        clearTimeout(this.timeoutId) // to stop multiple series of refreshLoop from going on simultaneously
        const queryString = getFirstParameter(window.location.search).split('.')
        const queryId = queryString[0]

        $.get('/ui/api/query/' + queryId + '?pruned=true', (query) => {
            this.setState({
                initialized: true,
                ended: query.finalQueryInfo,
                query: query,
            })
            this.resetTimer()
        }).fail(() => {
            this.setState({
                initialized: true,
            })
            this.resetTimer()
        })
    }

    componentDidMount() {
        this.refreshLoop()
    }

    renderReferencedTables(tables) {
        if (!tables || tables.length === 0) {
            return (
                <div>
                    <h3>Referenced Tables</h3>
                    <hr className="h3-hr" />
                    <tr>
                        <td className="info-text wrap-text">
                            <pr>No referenced tables.</pr>
                        </td>
                    </tr>
                </div>
            )
        }
        return (
            <div>
                <h3>Referenced Tables</h3>
                <hr className="h3-hr" />
                <table className="table">
                    <tbody>
                        {tables.map((table) => (
                            <tr>
                                <td className="info-text wrap-text">
                                    <pr>{`${table.catalog}.${table.schema}.${table.table} (Authorization: ${table.authorization}, Directly Referenced: ${table.directlyReferenced})`}</pr>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    }

    renderRoutines(routines) {
        if (!routines || routines.length === 0) {
            return (
                <div>
                    <h3>Routines</h3>
                    <hr className="h3-hr" />
                    <tr>
                        <td className="info-text wrap-text">
                            <pr>No referenced routines.</pr>
                        </td>
                    </tr>
                </div>
            )
        }
        return (
            <div>
                <h3>Routines</h3>
                <hr className="h3-hr" />
                <table className="table">
                    <tbody>
                        {routines.map((routine) => (
                            <tr>
                                <td className="info-text wrap-text">
                                    <pr>{`${routine.routine} (Authorization: ${routine.authorization})`}</pr>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    }

    render() {
        const { query, jsonData, initialized } = this.state
        if (!query) {
            let label = initialized ? 'Query not found' : <div className="loader">Loading...</div>
            return (
                <div className="row error-message">
                    <div className="col-xs-12">
                        <h4>{label}</h4>
                    </div>
                </div>
            )
        }

        const referencedTables = query.referencedTables || []
        const routines = query.routines || []

        let referencesData = this.state.ended ? (
            <div className="col-xs-12">
                {this.renderReferencedTables(referencedTables)}
                {this.renderRoutines(routines)}
            </div>
        ) : (
            <div className="row error-message">
                <div className="col-xs-12">
                    <h4>References will appear automatically when query completes.</h4>
                    <div className="loader">Loading...</div>
                </div>
            </div>
        )

        return (
            <div>
                <QueryHeader query={query} />
                <hr className="h3-hr" />
                <div className="row">
                    <div className="col-xs-12">{referencesData}</div>
                </div>
            </div>
        )
    }
}

```

### Core Architecture Module: `core/trino-web-ui/src/main/resources/webapp-legacy/src/components/SqlBlock.jsx`
```
import React, { useEffect, useRef } from 'react'
import hljs from 'highlight.js/lib/core'
import sql from 'highlight.js/lib/languages/sql'
hljs.registerLanguage('sql', sql)

export const SqlBlock = ({ language, code }) => {
    const codeRef = useRef()
    useEffect(() => {
        if (codeRef && codeRef.current) {
            hljs.highlightElement(codeRef.current)
        }
    }, [code])

    return (
        <code className="language-sql sql" ref={codeRef}>
            {code}
        </code>
    )
}

```

### Core Architecture Module: `core/trino-web-ui/src/main/resources/webapp-legacy/src/components/StageDetail.jsx`
```
/*
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
 */

import React from 'react'
import ReactDOM from 'react-dom'
import ReactDOMServer from 'react-dom/server'
import * as dagreD3 from 'dagre-d3'
import * as d3 from 'd3'

import {
    formatCount,
    formatDataSize,
    formatDuration,
    getChildren,
    getFirstParameter,
    getTaskNumber,
    initializeGraph,
    initializeSvg,
    isQueryEnded,
    parseAndFormatDataSize,
    parseDataSize,
    parseDuration,
} from '../utils'
import { QueryHeader } from './QueryHeader'

function getTotalWallTime(operator) {
    return (
        parseDuration(operator.addInputWall) +
        parseDuration(operator.getOutputWall) +
        parseDuration(operator.finishWall) +
        parseDuration(operator.blockedWall)
    )
}

function getTotalCpuTime(operator) {
    return (
        parseDuration(operator.addInputCpu) + parseDuration(operator.getOutputCpu) + parseDuration(operator.finishCpu)
    )
}

class OperatorSummary extends React.Component {
    render() {
        const operator = this.props.operator

        const totalWallTime = getTotalWallTime(operator)
        const totalCpuTime = getTotalCpuTime(operator)

        const rowInputRate = totalWallTime === 0 ? 0 : (1.0 * operator.inputPositions) / (totalWallTime / 1000.0)
        const byteInputRate =
            totalWallTime === 0 ? 0 : (1.0 * parseDataSize(operator.inputDataSize)) / (totalWallTime / 1000.0)

        return (
            <div>
                <div className="highlight-row">
                    <div className="header-row">{operator.operatorType}</div>
                    <div>{formatCount(rowInputRate) + ' rows/s (' + formatDataSize(byteInputRate) + '/s)'}</div>
                </div>
                <table className="table">
                    <tbody>
                        <tr>
                            <td>Output</td>
                            <td>
                                {formatCount(operator.outputPositions) +
                                    ' rows (' +
                                    parseAndFormatDataSize(operator.outputDataSize) +
                                    ')'}
                            </td>
                        </tr>
                        <tr>
                            <td>Drivers</td>
                            <td>{operator.totalDrivers}</td>
                        </tr>
                        <tr>
                            <td>CPU Time</td>
                            <td>{formatDuration(totalCpuTime)}</td>
                        </tr>
                        <tr>
                            <td>Wall Time</td>
                            <td>{formatDuration(totalWallTime)}</td>
                        </tr>
                        <tr>
                            <td>Blocked</td>
                            <td>{formatDuration(parseDuration(operator.blockedWall))}</td>
                        </tr>
                        <tr>
                            <td>Input</td>
                            <td>
                                {formatCount(operator.inputPositions) +
                                    ' rows (' +
                                    parseAndFormatDataSize(operator.inputDataSize) +
                                    ')'}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        )
    }
}

const BAR_CHART_PROPERTIES = {
    type: 'bar',
    barSpacing: '0',
    height: '80px',
    barColor: '#747F96',
    zeroColor: '#8997B3',
    tooltipClassname: 'sparkline-tooltip',
    tooltipFormat: 'Task {{offset:offset}} - {{value}}',
    disableHiddenCheck: true,
}

class OperatorStatistic extends React.Component {
    componentDidMount() {
        const operators = this.props.operators
        const statistic = operators.map(this.props.supplier)
        const numTasks = operators.length

        const tooltipValueLookups = { offset: {} }
        for (let i = 0; i < numTasks; i++) {
            tooltipValueLookups['offset'][i] = '' + i
        }

        const stageBarChartProperties = $.extend({}, BAR_CHART_PROPERTIES, {
            barWidth: 800 / numTasks,
            tooltipValueLookups: tooltipValueLookups,
        })
        $('#' + this.props.id).sparkline(
            statistic,
            $.extend({}, stageBarChartProperties, {
                numberFormatter: this.props.renderer,
            })
        )
    }

    render() {
        return (
            <div className="row operator-statistic">
                <div className="col-xs-2 italic-uppercase operator-statistic-title">{this.props.name}</div>
                <div className="col-xs-10">
                    <span className="bar-chart" id={this.props.id} />
                </div>
            </div>
        )
    }
}

class OperatorDetail extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            selectedStatistics: this.getInitialStatistics(),
        }
    }

    getInitialStatistics() {
        return [
            {
                name: 'Total CPU Time',
                id: 'totalCpuTime',
                supplier: getTotalCpuTime,
                renderer: formatDuration,
            },
            {
                name: 'Total Wall Time',
                id: 'totalWallTime',
                supplier: getTotalWallTime,
                renderer: formatDuration,
            },
            {
                name: 'Input Rows',
                id: 'inputPositions',
                supplier: (operator) => operator.inputPositions,
                renderer: formatCount,
            },
            {
                name: 'Input Data Size',
                id: 'inputDataSize',
                supplier: (operator) => parseDataSize(operator.inputDataSize),
                renderer: formatDataSize,
            },
            {
                name: 'Output Rows',
                id: 'outputPositions',
                supplier: (operator) => operator.outputPositions,
                renderer: formatCount,
            },
            {
                name: 'Output Data Size',
                id: 'outputDataSize',
                supplier: (operator) => parseDataSize(operator.outputDataSize),
                renderer: formatDataSize,
            },
        ]
    }

    getOperatorTasks() {
        // sort the x-axis
        const tasks = this.props.tasks.sort(function (taskA, taskB) {
            return getTaskNumber(taskA.taskStatus.taskId) - getTaskNumber(taskB.taskStatus.taskId)
        })

        const operatorSummary = this.props.operator

        const operatorTasks = []
        tasks.forEach((task) => {
            task.stats.pipelines.forEach((pipeline) => {
                if (pipeline.pipelineId === operatorSummary.pipelineId) {
                    pipeline.operatorSummaries.forEach((operator) => {
                        if (operatorSummary.operatorId === operator.operatorId) {
                            operatorTasks.push(operator)
                        }
                    })
                }
            })
        })

        return operatorTasks
    }

    render() {
        const operator = this.props.operator
        const operatorTasks = this.getOperatorTasks()
        const totalWallTime = getTotalWallTime(operator)
        const totalCpuTime = getTotalCpuTime(operator)

        const rowInputRate = totalWallTime === 0 ? 0 : (1.0 * operator.inputPositions) / totalWallTime
        const byteInputRate =
            totalWallTime === 0 ? 0 : (1.0 * parseDataSize(operator.inputDataSize)) / (totalWallTime / 1000.0)

        const rowOutputRate = totalWallTime === 0 ? 0 : (1.0 * operator.outputPositions) / totalWallTime
        const byteOutputRate =
            totalWallTime === 0 ? 0 : (1.0 * parseDataSize(operator.outputDataSize)) / (totalWallTime / 1000.0)

        return (
            <div className="row">
                <div className="col-xs-12">
                    <div className="modal-header">
                        <button type="button" className="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                        <h3>
                            <small>Pipeline {operator.pipelineId}</small>
                            <br />
                            {operator.operatorType}
                        </h3>
                    </div>
                    <div className="row">
                        <div className="col-xs-6">
                            <table className="table">
                                <tbody>
                                    <tr>
                                        <td>Input</td>
                                        <td>
                                            {formatCount(operator.inputPositions) +
                                                ' rows (' +
                                                parseAndFormatDataSize(operator.inputDataSize) +
                                                ')'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Input Rate</td>
                                        <td>
                                            {formatCount(rowInputRate) +
                                                ' rows/s
```

### Core Architecture Module: `core/trino-web-ui/src/main/resources/webapp-legacy/src/components/WorkerList.jsx`
```
/*
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
 */

import React from 'react'

const SMALL_SPARKLINE_PROPERTIES = {
    width: '100%',
    height: '57px',
    fillColor: '#3F4552',
    lineColor: '#747F96',
    spotColor: '#1EDCFF',
    tooltipClassname: 'sparkline-tooltip',
    disableHiddenCheck: true,
}

export class WorkerList extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            initialized: false,
            workers: [],
        }
        this.refreshLoop = this.refreshLoop.bind(this)
    }

    refreshLoop() {
        clearTimeout(this.timeoutId)
        $.get(
            '/ui/api/worker',
            function (workers) {
                if (workers != null) {
                    workers.sort(function (workerA, workerB) {
                        if (workerA.coordinator && !workerB.coordinator) {
                            return -1
                        }
                        if (!workerA.coordinator && workerB.coordinator) {
                            return 1
                        }
                        return workerA.nodeId.localeCompare(workerB.nodeId)
                    })
                }
                this.setState({
                    initialized: true,
                    workers: workers,
                })
                this.resetTimer()
            }.bind(this)
        ).fail(() => {
            this.setState({
                initialized: true,
            })
            this.resetTimer()
        })
    }

    resetTimer() {
        clearTimeout(this.timeoutId)
        this.timeoutId = setTimeout(this.refreshLoop.bind(this), 1000)
    }

    componentDidMount() {
        this.refreshLoop()
    }

    render() {
        const workers = this.state.workers
        if (workers === null) {
            if (this.state.initialized === false) {
                return <div className="loader">Loading...</div>
            } else {
                return (
                    <div className="row error-message">
                        <div className="col-xs-12">
                            <h4>Worker list information could not be loaded</h4>
                        </div>
                    </div>
                )
            }
        }
        let workerList = function () {
            let trs = []
            workers.forEach((worker) => {
                trs.push(
                    <tr>
                        <td className="info-text wrap-text">
                            <a href={'worker.html?' + worker.nodeId} className="font-light" target="_blank">
                                {worker.nodeId}
                            </a>
                        </td>
                        <td className="info-text wrap-text">
                            <a href={'worker.html?' + worker.nodeId} className="font-light" target="_blank">
                                {worker.nodeIp}
                            </a>
                        </td>
                        <td className="info-text wrap-text">{worker.nodeVersion}</td>
                        <td className="info-text wrap-text">{String(worker.coordinator)}</td>
                        <td className="info-text wrap-text">{worker.state}</td>
                    </tr>
                )
            })
            return trs
        }

        return (
            <div>
                <div className="row">
                    <div className="col-xs-12">
                        <h3>Overview</h3>
                        <hr className="h3-hr" />
                        <table className="table">
                            <tbody>
                                <tr>
                                    <td className="info-title stage-table-stat-text">Node ID</td>
                                    <td className="info-title stage-table-stat-text">Node IP</td>
                                    <td className="info-title stage-table-stat-text">Node Version</td>
                                    <td className="info-title stage-table-stat-text">Coordinator</td>
                                    <td className="info-title stage-table-stat-text">State</td>
                                </tr>
                                {workerList()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #27403** (2025-11-22): **Test `TestRedshiftUnloadTypeMapping.testVarbinary` is failing**
  *Symptoms*: https://github.com/trinodb/trino/actions/runs/19572217039/job/56048341054?pr=27388  ``` Error:  Tests run: 26, Failures: 0, Errors: 1, Skipped: 0, Time elapsed: 560.9 s <<< FAILURE! -- in io.trino.plugin.redshift.TestRedshiftUnloadTypeMapping Error:  io.trino.plugin.redshift.TestRedshiftUnloadTypeMapping.testVarbinary -- Time elapsed: 3.769 s <<< ERROR! io.trino.testing.QueryFailedException: Table 'test_schema.test_varbinary2uxztefsvf' has no supported columns (all 19 columns are not supported) 	at io.trino.testing.AbstractTestingTrinoClient.execute(AbstractTestingTrinoClient.java:138) 	at io.trino.testing.DistributedQueryRunner.executeInternal(DistributedQueryRunner.java:587) 	at io.trino.testing.DistributedQueryRunner.execute(DistributedQueryRunner.java:570) 	at io.trino.sql.query.QueryAssertions$QueryAssert.lambda$new$1(QueryAssertions.java:317) 	at com.google.common.base.Suppliers$NonSerializableMemoizingSupplier.get(Suppliers.java:201) 	at io.trino.sql.query.QueryAssertions$QueryAssert.result(QueryAssertions.java:436) 	at io.trino.testing.datatype.SqlDataTypeTest.verifySelect(SqlDataTypeTest.java:102) 	at io.trino.testing.datatype.SqlDataTypeTest.execute(SqlDataTypeTest.java:90) 	at io.trino.testing.datatype.SqlDataTypeTest.execute(SqlDataTypeTest.java:83) 	at io.trino.plugin.redshift.TestRedshiftTypeMapping.testVarbinary(TestRedshiftTypeMapping.java:286) 	at java.base/java.lang.reflect.Method.invoke(Method.java:565) 	at java.base/java.util.concurrent.ForkJoinTask.doExec
  **Post-Mortem & Fix Analysis**:
  > https://github.com/trinodb/trino/actions/runs/19573111140/job/56059415346?pr=27388
  > https://github.com/trinodb/trino/actions/runs/19573111140/job/56063019580?pr=27388

- **Issue #27402** (2025-11-25): **Exclusive write to a new S3 location may fail with `FileAlreadyExistsException`**
  *Symptoms*: Trino S3 filesystem implements `TrinoOutputFile.createExclusive` using S3 condition writes, i.e. `If-None-Match: *`. When upload succeeds on the server, but due to network conditions the AWS SDK S3 client doesn't know about that, it retries the request. Such retried request then legitimately fails due to write precondition. As an effect, writing via `S3OutputFile.createExclusive` to a location that did not exist before may fail with `FileAlreadyExistsException`.  This is similar to the following issue. That issue covers `TrinoOutputFile.create`'s behavior which doesn't have to be exclusive. This issue covers `createExclusive` behavior. - https://github.com/trinodb/trino/issues/27400
  **Post-Mortem & Fix Analysis**:
  > we perhaps wouldn't need to do anything on our side: - like we did here https://github.com/trinodb/trino/pull/27388  if the AWS SDK library supported exclusive writes with retries out of the box -- both exclusive writes and retries are AWS SDK's own features after all. i filed an issue for this - https://github.com/aws/aws-sdk-java-v2/issues/6580

- **Issue #27401** (2025-11-21): **Exclusive write to existing S3 location bigger than multi-part upload size fails with wrong exception**
  *Symptoms*: When `TrinoOutputFile.createExclusive` (or `TrinoOutputFile.create`  before https://github.com/trinodb/trino/pull/27330, i.e. up to and including 478) writes to a pre-existing location, it is supposed to throw `FileAlreadyExistsException` and it indeed does so. However, when written size is bigger than multi-part upload size (32 MB by default), then the call fails with a wrong exception, because the S3 response is not translated to `FileAlreadyExistsException`.
  **Post-Mortem & Fix Analysis**:
  > Issue created for visibility.  Fixed by https://github.com/trinodb/trino/pull/27374

- **Issue #27400** (2025-11-21): **Writing to S3 may fail with `FileAlreadyExistsException`**
  *Symptoms*: When `s3.exclusive-create=true` (default), the S3 filesystem uses `If-None-Match: *` for all object uploads. When upload succeeds on the server, but due to network conditions the AWS SDK S3 client doesn't know about that, it retries the request. Such retried request then legitimately fails due to write precondition.  As an effect, writing via `S3OutputFile.create` to a location that did not exist before may fail with `FileAlreadyExistsException`.
  **Post-Mortem & Fix Analysis**:
  > Issue created for visibility. This is fixed in https://github.com/trinodb/trino/pull/27330

- **Issue #26786** (2025-10-04): **Trino version 477 with FTE - MERGE WHEN MATCHED results in duplicates**
  *Symptoms*: MERGE WHEN MATCHED on Iceberg connector results in duplicates on Trino version 477 with FTE enabled (retry_policy='TASK'). The behavior cannot be replicated without FTE or with FTE on version 476.  ``` SET SESSION retry_policy='TASK'; DROP TABLE IF EXISTS pulse.sa.search_extended_temp_1; CREATE TABLE pulse.sa.search_extended_temp_1 with (format='PARQUET') as  select * from pulse.sa.search_extended_temp_0 where ts='20250930' order by search_id limit 100000 ;  -- Check that there is no duplicates on both search_extended_temp_1 and temp_outlier_codes_20250930 select count(distinct search_id) dist_searches, count(1) total_rows from pulse.sa.search_extended_temp_1; -- 100000	100000 select count(distinct search_id) dist_searches, count(1) total_rows from pulse.sa.temp_outlier_codes_20250930; -- 57571	57571  --Merge MERGE INTO pulse.sa.search_extended_temp_1 s     USING     (     SELECT  ts, search_id,             OUTLIER_CODE     FROM         pulse.SA.temp_outlier_codes_20250930     WHERE TS ='20250930'     ) a ON s.TS = '20250930'     AND s.ts = a.ts     AND s.search_id = a.search_id WHEN MATCHED     THEN UPDATE SET outlier_code = a.outlier_code  ;  -- Check search_extended_temp_1 for duplicates again. select count(distinct search_id) dist_searches, count(1) total_rows from pulse.sa.search_extended_temp_1; -- 100000	100641 ```  When reducing the base table to 10000 rows (instead of 100000), the issue cannot be reproduced.  When running EXPLAIN on the two verisions, I see that the 
  **Post-Mortem & Fix Analysis**:
  > cc @losipiuk 
  > I could reproduce on tpch datasets: ``` SET SESSION retry_policy='TASK'; create table pulse.sa.test_duplication_base with (format='PARQUET') as  select * from tpch.sf1.customer;  create table pulse.sa.test_duplication_merge with (format='PARQUET') as  select custkey, max(orderkey) as orderkey from tpch.sf1.orders group by custkey;  -- Check that there is no duplicates on both tables select count(distinct custkey) dist_custkey, count(1) total_rows from pulse.sa.test_duplication_base; -- 150000	150000 select  count(distinct custkey) dist_custkey, count(1) total_rows from pulse.sa.test_duplication_merge; -- 99996	99996  MERGE INTO pulse.sa.test_duplication_base s     USING     (     SELECT  custkey,             orderkey     FROM         pulse.sa.test_duplication_merge     ) a ON s.custkey = a.custkey WHEN MATCHED     THEN UPDATE SET nationkey = a.orderkey  ;    select count(distinct custkey) dist_custkey, count(1) total_rows from pulse.sa.test_duplication_base; -- 150000	151152 ```
  > 👀 

- **Issue #26464** (2025-09-23): **Internal error if pattern variables are not uppercase**
  *Symptoms*: Hi,  I experience an internal error with no further error message if the pattern variable in the `AFTER MATCH` subclause of a `MATCH_RECOGNIZE` query is lowercase instead of uppercase.  Minimal working example: ```sql SELECT mr.a, mr.b, mr.c FROM (SELECT 1 AS a, 6 AS b UNION SELECT 2 AS a, 4 AS b UNION SELECT 3 AS a, 8 AS b) MATCH_RECOGNIZE (     ORDER BY a     MEASURES CLASSIFIER() AS c     ALL ROWS PER MATCH     AFTER MATCH SKIP TO FIRST Y     PATTERN (x+ y z?)     DEFINE         x AS x.b > 5,         y AS y.b < x.b ) AS mr;  ```  While this query runs fine, switching `AFTER MATCH SKIP TO FIRST Y` to `AFTER MATCH SKIP TO FIRST y` (lowercase `y`) the new query fails.   ``` Query FAILED, 2 nodes Splits: 131 total, 3 done (2.29%) 0.02 [2 rows, 0B] [100 rows/s, 0B/s]  Query failed: Internal error ```  This feels unexpected since uppercase/lowercase should not matter and it does not in all the other places.  I tried this in a minimal setup running trino 476 in docker (2 workers, 1 coordinator, 1 ubuntu container with the trino cli).  Cheers!
  **Post-Mortem & Fix Analysis**:
  > cc @kasiafi 
  > Created pull request: https://github.com/trinodb/trino/pull/26691

- **Issue #26299** (2025-07-30): **Repeated DELETE with deletion vectors duplicate rows in partitioned tables in Delta Lake with partitions that include whitespace**
  *Symptoms*: Similar to #24648 but now with whitespaces   ```sql CREATE TABLE test_dv (a int, test_column varchar) WITH (deletion_vectors_enabled = true, partitioned_by = ARRAY['test_column']); INSERT INTO test_dv(a, test_column) SELECT *, 'I love whitespaces' FROM TABLE(sequence(start => 1, stop => 10, step => 1)); SELECT count(1) FROM test_dv; -- 10 DELETE FROM test_dv WHERE a = 5; SELECT count(1) FROM test_dv; -- 9 DELETE FROM test_dv WHERE a = 9; SELECT count(1) FROM test_dv; -- Both Trino and Spark return 18 ```  I have attached  [test_dv.zip](https://github.com/user-attachments/files/21487392/test_dv.zip) 
  **Post-Mortem & Fix Analysis**:
  > cc: @ebyhr @chenjian2664 

- **Issue #26270** (2025-07-24): **Problem with Dynamic filtering Trino 468**
  *Symptoms*: We are having a query like this  ```sql select (     existing_df.full_name is not distinct from new_df.full_name     and existing_df.last_name is not distinct from new_df.last_name     and existing_df.first_name is not distinct from new_df.first_name     and existing_df.email is not distinct from new_df.email     and existing_df.phone is not distinct from new_df.phone     and existing_df.is_normalized_phone is not distinct from new_df.is_normalized_phone     and existing_df.company_name is not distinct from new_df.company_name     and existing_df.department_name is not distinct from new_df.department_name     and existing_df.department_code is not distinct from new_df.department_code     and existing_df.shop_id is not distinct from new_df.shop_id     and existing_df.created_at is not distinct from new_df.created_at     ) AS condition_result  from dim_employee existing_df inner join tmp_dim_employee_current new_df   on new_df.raw_id = existing_df.raw_id   -- all attributes are not changed WHERE     existing_df.full_name is not distinct from new_df.full_name     and existing_df.last_name is not distinct from new_df.last_name     and existing_df.first_name is not distinct from new_df.first_name     and existing_df.email is not distinct from new_df.email     and existing_df.phone is not distinct from new_df.phone     and existing_df.is_normalized_phone is not distinct from new_df.is_normalized_phone     and existing_df.company_name is not distinct from new_df.company_name     and
  **Post-Mortem & Fix Analysis**:
  > Is this a duplicate of #26257? 

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

### Incident Patch 1: `a02b3257` (2026-10-04)
**Commit Message**: Fix $files on tables with duplicate partition field names

Querying $files (and $partitions, a view over it) failed on tables
that underwent bucket or truncate partition evolution on the same
column before 4330af6e23b -- e.g. bucket(x, 4) -> bucket(x, 8). Such
tables are valid Iceberg (fields are identified by id, not name), and
existing ones cannot be rewritten, so $files/$partitions were unusable
on them.

The failure came from FilesTable serializing the full name-indexed
FILES metadata-table schema, which breaks when two partition fields
share a name. Serialize just the readable_metrics schema instead,
which workers actually need and which tolerates duplicate names.

**File**: `plugin/trino-iceberg/src/main/java/io/trino/plugin/iceberg/system/FilesTable.java` (modified, +4/-3)
```diff
@@ -31,8 +31,7 @@
 import io.trino.spi.type.Type;
 import io.trino.spi.type.TypeDescriptor;
 import io.trino.spi.type.TypeManager;
-import org.apache.iceberg.MetadataTableType;
-import org.apache.iceberg.MetadataTableUtils;
+import org.apache.iceberg.MetricsUtil;
 import org.apache.iceberg.PartitionField;
 import org.apache.iceberg.PartitionSpecParser;
 import org.apache.iceberg.Schema;
@@ -168,7 +167,9 @@ public Optional<ConnectorSplitSource> splitSource(ConnectorSession connectorSess
                 icebergTable,
                 snapshotId,
                 SchemaParser.toJson(icebergTable.schema()),
-                SchemaParser.toJson(MetadataTableUtils.createMetadataTableInstance(icebergTable, MetadataTableType.FILES).schema()),
+                // Only readable_metrics schema, not full FILES schema: the latter fails to build on
+                // tables with duplicate partition field names (e.g. after bucket/truncate evolution).
+                SchemaParser.toJson(MetricsUtil.readableMetricsSchema(icebergTable.schema(), icebergTable.schema())),
                 icebergTable.specs().entrySet().stream().collect(toImmutableMap(
                         Map.Entry::getKey,
                         partitionSpec -> PartitionSpecParser.toJson(partitionSpec.getValue()))),
```

**File**: `plugin/trino-iceberg/src/test/java/io/trino/plugin/iceberg/TestIcebergPartitionEvolutionOnSameColumn.java` (modified, +5/-6)
```diff
@@ -28,7 +28,6 @@
 import static io.trino.testing.containers.Floci.FLOCI_SECRET_KEY;
 import static java.lang.String.format;
 import static org.assertj.core.api.Assertions.assertThat;
-import static org.assertj.core.api.Assertions.assertThatThrownBy;
 
 public class TestIcebergPartitionEvolutionOnSameColumn
         extends AbstractTestQueryFramework
@@ -129,7 +128,7 @@ void testFilesPartitionEvolutionUsingBucketOnSameColumn()
      * @see iceberg.conflict_truncate
      */
     @Test
-    void testFilesPartitionEvolutionWithTruncateMetadataCorruption()
+    void testFilesPartitionEvolutionWithDuplicatePartitionFieldNames()
     {
         String tableName = "test_iceberg_partition_evolution_" + randomNameSuffix();
 
@@ -142,10 +141,10 @@ void testFilesPartitionEvolutionWithTruncateMetadataCorruption()
         assertThat(query("SELECT * FROM " + tableName))
                 .matches("VALUES (VARCHAR 'abc'), (VARCHAR 'abcd')");
 
-        // In the generated table, the latest metadata incorrectly reuses the same partition
-        // field name for different truncate widths, each with its own field ID, resulting in an invalid schema
-        assertThatThrownBy(() -> computeActual("SELECT partition FROM \"" + tableName + "$files\""))
-                .hasMessage("Invalid schema: multiple fields for name partition.a_trunc: 1000 and 1001");
+        // Table has duplicate partition field names (a_trunc) across specs, which is valid Iceberg;
+        // $files must still read it. See https://github.com/trinodb/trino/issues/31435
+        assertQuerySucceeds("SELECT partition FROM \"" + tableName + "$files\"");
+        assertThat(query("SELECT count(*) FROM \"" + tableName + "$files\"")).matches("VALUES BIGINT '2'");
 
         // Fix partition evolution by setting the partitioning to use the same truncation level as the current configuration
         assertUpdate("ALTER TABLE " + tableName + " SET PROPERTIES partitioning = ARRAY['truncate(a, 10)']");
```

---

### Incident Patch 2: `30a691fe` (2026-09-14)
**Commit Message**: Recognize created Iceberg table by its UUID

A later commit can move the metadata location past the file this
create wrote, so the location alone cannot show the create succeeded.

**File**: `plugin/trino-iceberg/src/main/java/io/trino/plugin/iceberg/catalog/hms/AbstractMetastoreTableOperations.java` (modified, +33/-7)
```diff
@@ -27,6 +27,7 @@
 import io.trino.spi.connector.ConnectorSession;
 import io.trino.spi.connector.TableNotFoundException;
 import org.apache.iceberg.TableMetadata;
+import org.apache.iceberg.TableMetadataParser;
 import org.apache.iceberg.exceptions.CommitStateUnknownException;
 import org.apache.iceberg.io.FileIO;
 
@@ -136,8 +137,8 @@ protected final void commitNewTable(TableMetadata metadata)
             // on a timeout, or when a retried request observes the table that the first (successful) attempt created
             // and reports AlreadyExists. Deleting the new metadata file in that case would corrupt the just-created
             // table, so the actual commit outcome is verified before any cleanup is performed.
-            switch (checkNewTableCommitStatus(newMetadataLocation)) {
-                // The table exists and references the metadata we wrote: the commit succeeded despite the exception.
+            switch (checkNewTableCommitStatus(newMetadataLocation, metadata.uuid())) {
+                // The table exists and is the one this operation created: the commit succeeded despite the exception.
                 case SUCCESS -> {
                     log.warn(e, "Received an error from metastore while creating table %s, but the table was actually created; treating the commit as successful", getSchemaTableName());
                     return;
@@ -160,15 +161,20 @@ protected final void commitNewTable(TableMetadata metadata)
     /**
      * Determines whether a failed {@code createTable} call actually applied the commit, by re-reading the table from
      * the metastore and comparing its metadata location against the one this operation wrote. {@code newMetadataLocation}
-     * carries a freshly generated UUID, so an equal value can only mean this very operation created the table.
+     * carries a freshly generated UUID, so an equal value can only mean this very operation created the table. When the
+     * metastore already points at other metadata, that metadata is read and its table UUID is compared with the one this
+     * operation assigned: the UUID is set once at creation and carried over by every later commit (a replacement
+     * included), so a match means a later commit built on the table this operation created, and the create still counts
+     * as applied.
      * <p>
      * The check is biased towards {@link CommitStatus#UNKNOWN}: an orphaned metadata file is cheap to clean up later
      * (e.g. via {@code remove_orphan_files}), whereas deleting a file the metastore still references is an
      * unrecoverable data-integrity issue. A single read is enough because the metastore client already retries
      * transient failures internally.
      */
-    private CommitStatus checkNewTableCommitStatus(String newMetadataLocation)
+    private CommitStatus checkNewTableCommitStatus(String newMetadataLocation, String tableUuid)
     {
+        requireNonNull(tableUuid, "tableUuid is null");
         Optional<Table> table;
         try {
             metastore.invalidateTable(database, tableName);
@@ -183,9 +189,29 @@ private CommitStatus checkNewTableCommitStatus(String newMetadataLocation)
             return CommitStatus.FAILURE;
         }
         String committedLocation = table.get().getParameters().get(METADATA_LOCATION_PROP);
-        // A matching location proves this operation committed; a different (or missing) location means another writer owns the name.
-        boolean committed = committedLocation != null && newMetadataLocation.equals(fixBrokenMetadataLocation(committedLocation));
-        return committed ? CommitStatus.SUCCESS : CommitStatus.FAILURE;
+        if (committedLocation == null) {
+            // Another writer owns the name, with a table that is not an Iceberg table.
+            return CommitStatus.FAILURE;
+        }
+        committedLocation = fixBrokenMetadataLocation(committedLocation);
+        // A matching location proves this operation committed.
+        if (newMetadataLocation.equals(committedLocation)) {
+            return CommitStatus.SUCCESS;
+        }
+        // The metastore points elsewhere: either another writer owns the name, or a later commit already built on the
+        // table this operation created. The table UUID of the current metadata tells the two apart.
+        TableMetadata committedMetadata;
+        try {
+            committedMetadata = TableMetadataParser.read(io(), committedLocation);
+        }
+        catch (RuntimeException e) {
+            log.error(e, "Could not read current metadata %s of new table %s to determine commit status; treating commit state as unknown", committedLocation, getSchemaTableName());
+            return CommitStatus.UNKNOWN;
+        }
+        if (tableUuid.equals(committedMetadata.uuid())) {
+            return CommitStatus.SUCCESS;
+        }
+        return CommitStatus.FAILURE;
     }
 
     private enum CommitStatus
```

**File**: `plugin/trino-iceberg/src/test/java/io/trino/plugin/iceberg/catalog/file/TestIcebergFileMetastoreCreateTableFailure.java` (modified, +151/-10)
```diff
@@ -13,6 +13,7 @@
  */
 package io.trino.plugin.iceberg.catalog.file;
 
+import com.google.common.collect.ImmutableMap;
 import io.trino.Session;
 import io.trino.filesystem.local.LocalFileSystemFactory;
 import io.trino.metastore.HiveMetastore;
@@ -22,26 +23,43 @@
 import io.trino.plugin.hive.metastore.file.FileHiveMetastore;
 import io.trino.plugin.hive.metastore.file.FileHiveMetastoreConfig;
 import io.trino.plugin.iceberg.TestingIcebergPlugin;
+import io.trino.plugin.iceberg.fileio.ForwardingFileIo;
 import io.trino.spi.NodeVersion;
 import io.trino.spi.connector.SchemaNotFoundException;
+import io.trino.spi.security.ConnectorIdentity;
 import io.trino.testing.AbstractTestQueryFramework;
 import io.trino.testing.DistributedQueryRunner;
+import org.apache.iceberg.PartitionSpec;
+import org.apache.iceberg.Schema;
+import org.apache.iceberg.TableMetadata;
+import org.apache.iceberg.TableMetadataParser;
+import org.apache.iceberg.io.FileIO;
+import org.apache.iceberg.types.Types;
 import org.junit.jupiter.api.AfterAll;
 import org.junit.jupiter.api.BeforeEach;
 import org.junit.jupiter.api.Test;
 import org.junit.jupiter.api.TestInstance;
 import org.junit.jupiter.api.parallel.Execution;
 
+import java.io.IOException;
 import java.nio.file.Files;
 import java.nio.file.Path;
+import java.util.List;
 import java.util.Optional;
 import java.util.concurrent.atomic.AtomicBoolean;
+import java.util.concurrent.atomic.AtomicInteger;
 import java.util.concurrent.atomic.AtomicReference;
+import java.util.stream.Stream;
 
+import static com.google.common.collect.ImmutableList.toImmutableList;
 import static com.google.common.io.MoreFiles.deleteRecursively;
 import static com.google.common.io.RecursiveDeleteOption.ALLOW_INSECURE;
 import static io.trino.testing.TestingNames.randomNameSuffix;
 import static io.trino.testing.TestingSession.testSessionBuilder;
+import static java.util.UUID.randomUUID;
+import static org.apache.iceberg.BaseMetastoreTableOperations.METADATA_LOCATION_PROP;
+import static org.apache.iceberg.BaseMetastoreTableOperations.PREVIOUS_METADATA_LOCATION_PROP;
+import static org.apache.iceberg.TableProperties.METADATA_PREVIOUS_VERSIONS_MAX;
 import static org.assertj.core.api.Assertions.assertThat;
 import static org.assertj.core.api.Assertions.assertThatThrownBy;
 import static org.junit.jupiter.api.TestInstance.Lifecycle.PER_CLASS;
@@ -58,19 +76,20 @@ public class TestIcebergFileMetastoreCreateTableFailure
     private Path dataDirectory;
     private HiveMetastore metastore;
     private final AtomicReference<RuntimeException> createTableFailure = new AtomicReference<>();
-    // When set, the metastore persists the table before raising createTableFailure, simulating a commit that
-    // actually landed but whose response was lost (e.g. a timeout, or a retried request observing AlreadyExists).
     private final AtomicBoolean createTableCommitsBeforeFailure = new AtomicBoolean();
-    // When set, the metastore becomes unreachable once a createTable has been attempted, simulating a metastore that
-    // is unavailable during the post-failure commit-status check (but reachable for the initial existence check).
     private final AtomicBoolean metastoreUnavailableAfterCreate = new AtomicBoolean();
     private final AtomicBoolean metastoreUnavailable = new AtomicBoolean();
+    private final AtomicInteger laterCommitsBeforeFailure = new AtomicInteger();
+    private final AtomicBoolean otherTableTakesNameBeforeFailure = new AtomicBoolean();
+    private final AtomicBoolean otherTableWithMissingMetadataTakesNameBeforeFailure = new AtomicBoolean();
+    private FileIO fileIo;
 
     @Override
     protected DistributedQueryRunner createQueryRunner()
             throws Exception
     {
         this.dataDirectory = Files.createTempDirectory("test_iceberg_create_table_failure");
+        this.fileIo = new ForwardingFileIo(new LocalFileSystemFactory(dataDirectory).create(ConnectorIdentity.ofUser("test")), false);
         // Using FileHiveMetastore as approximation of HMS
         this.metastore = new FileHiveMetastore(
                 new NodeVersion("testversion"),
@@ -83,10 +102,22 @@ protected DistributedQueryRunner createQueryRunner()
             public synchronized void createTable(Table table, PrincipalPrivileges principalPrivileges)
             {
                 RuntimeException failure = createTableFailure.get();
-                // Persist the table on a normal create, and also when simulating a commit that landed before the
-                // injected failure (createTableCommitsBeforeFailure), so the metastore actually holds the table.
+                // Persist the table on a normal create, and when simulating a commit that landed before the injected failure
                 if (failure == null || createTableCommitsBeforeFailure.get()) {
                     super.createTable(table, principalPrivileges);
+                    Table current = table;
+                    for (int commitN
```

---

### Incident Patch 3: `8fc917fe` (2026-10-02)
**Commit Message**: Enable local builds without installing reactor artifacts

**File**: `.mvn/extensions.xml` (modified, +5/-0)
```diff
@@ -1,5 +1,10 @@
 <?xml version="1.0" encoding="UTF-8"?>
 <extensions>
+    <extension>
+        <groupId>ca.vanzyl.maven</groupId>
+        <artifactId>allprojects-reactor</artifactId>
+        <version>1.2</version>
+    </extension>
     <extension>
         <groupId>io.takari.maven</groupId>
         <artifactId>takari-smart-builder</artifactId>
```

**File**: `pom.xml` (modified, +1/-1)
```diff
@@ -2523,7 +2523,7 @@
                 <plugin>
                     <groupId>ca.vanzyl.provisio.maven.plugins</groupId>
                     <artifactId>provisio-maven-plugin</artifactId>
-                    <version>2.0.0</version>
+                    <version>2.0.1</version>
                 </plugin>
 
                 <plugin>
```

---

### Incident Patch 4: `288f7a53` (2026-05-11)
**Commit Message**: Parse and render typed JSON values

JSON values must enter and leave the engine as text while retaining the
precision and structure available in that representation.

Add parsing into typed encodings or trees, text rendering, and Jackson
tree adapters. Preserve duplicate members and numeric literal types.
Allow validated raw text to remain unparsed until structural access and
share the nesting limit between input and output.

Test text round trips, numeric boundaries, nesting limits, and
equivalent traversal and equality across raw, tree, and encoded
representations.

Avoid per-stream reader buffers for small UTF-8 Slice inputs while
retaining streaming decoding for larger values.

**File**: `lib/trino-json/pom.xml` (modified, +15/-0)
```diff
@@ -18,6 +18,16 @@
     </properties>
 
     <dependencies>
+        <dependency>
+            <groupId>com.fasterxml.jackson.core</groupId>
+            <artifactId>jackson-core</artifactId>
+        </dependency>
+
+        <dependency>
+            <groupId>com.fasterxml.jackson.core</groupId>
+            <artifactId>jackson-databind</artifactId>
+        </dependency>
+
         <dependency>
             <groupId>com.google.errorprone</groupId>
             <artifactId>error_prone_annotations</artifactId>
@@ -43,6 +53,11 @@
             <artifactId>fastutil</artifactId>
         </dependency>
 
+        <dependency>
+            <groupId>org.gaul</groupId>
+            <artifactId>modernizer-maven-annotations</artifactId>
+        </dependency>
+
         <dependency>
             <groupId>io.airlift</groupId>
             <artifactId>junit-extensions</artifactId>
```

**File**: `lib/trino-json/src/main/java/io/trino/json/EncodedJson.java` (modified, +138/-7)
```diff
@@ -38,40 +38,104 @@
 import static io.trino.json.JsonItemEncoding.stringEndOffset;
 import static java.util.Objects.requireNonNull;
 
-/// Byte-backed [Json]. The slice carries the typed-item encoding, with
-/// `offset..end` identifying the view. Sub-views share their parent's backing
-/// slice, and accessors read tag bytes directly.
+/// Byte-backed [Json]. Two modes share the same class:
+///
+/// * **Typed-encoded** — `slice` carries the typed-item encoding; `offset..end` is a
+///   view (sub-views of larger documents share the backing slice with the parent).
+///   Accessors read tag bytes directly. This is the canonical "JSON in flight" form.
+///
+/// * **Raw text** — `slice` carries raw JSON text (no `VERSION` prefix); `offset = 0`
+///   and `end = slice.length()` always. Structural accessors lazy-parse to a tree
+///   (cached in [#parsed]) and delegate. Connectors that produce already-validated text
+///   ([io.trino.json.Json#unchecked]) use this mode to avoid an upfront parse on values
+///   that may never be structurally accessed.
+///
+/// Mode is fixed at construction. The leading byte of `slice` discriminates: `VERSION`
+/// means typed-encoded, anything else means raw text. Sub-views created during traversal
+/// are always typed (a sub-view of raw text isn't a meaningful JSON value).
 public final class EncodedJson
         implements Json
 {
     private final Slice slice;
     private final int offset;
     private final int end;
+    private final boolean rawText;
+    // Lazy-computed for rawText mode; never written in typed mode.
+    private volatile Json parsed;
 
     public static Json of(Slice slice)
     {
         requireNonNull(slice, "slice is null");
         int rootOffset = rootItemOffset(slice);
         int rootEnd = itemEndOffset(slice, rootOffset);
-        return new EncodedJson(slice, rootOffset, rootEnd);
+        return new EncodedJson(slice, rootOffset, rootEnd, false);
     }
 
-    /// Sub-view factory used by traversal accessors.
+    /// Wraps already-validated raw JSON text. Skips the eager parse; structural
+    /// accessors lazy-parse on first call. The bytes flow through a JSON-typed block
+    /// write as-is via the [Json#isRawText] / [Json#rawText] shortcut.
+    public static Json unchecked(Slice rawText)
+    {
+        requireNonNull(rawText, "rawText is null");
+        return new EncodedJson(rawText, 0, rawText.length(), true);
+    }
+
+    /// Sub-view factory used by traversal accessors. Always typed-encoded — a sub-view
+    /// of raw text would carry partial JSON text, which isn't meaningful.
     static EncodedJson view(Slice slice, int offset, int end)
     {
-        return new EncodedJson(slice, offset, end);
+        return new EncodedJson(slice, offset, end, false);
     }
 
-    private EncodedJson(Slice slice, int offset, int end)
+    private EncodedJson(Slice slice, int offset, int end, boolean rawText)
     {
         this.slice = requireNonNull(slice, "slice is null");
         this.offset = offset;
         this.end = end;
+        this.rawText = rawText;
+    }
+
+    /// Lazy-parsed tree for raw-text mode. Package-private so [JsonItems#writeTreeJson]
+    /// can recurse directly into the parsed tree rather than round-tripping through
+    /// `encoding()`.
+    Json parsed()
+    {
+        // Racy single-check on a volatile field: parseToTree is deterministic (same input
+        // produces an equal-by-content tree), so concurrent callers may each compute a tree
+        // and the last write wins. The volatile read/write guarantees safe publication, so
+        // any reader sees a fully constructed tree. The cost of a redundant parse on the
+        // first race is bounded; on every subsequent call the cache hit avoids it. This is
+        // the standard idempotent-DCL idiom, not double-checked locking.
+        Json value = parsed;
+        if (value == null) {
+            // In raw-text mode, slice is the raw text; offset/end span the full slice.
+            value = JsonItems.parseToTree(slice);
+            parsed = value;
+        }
+        return value;
+    }
+
+    @Override
+    public boolean isRawText()
+    {
+        return rawText;
+    }
+
+    @Override
+    public Slice rawText()
+    {
+        if (!rawText) {
+            throw new IllegalStateException("Not a raw-text Json");
+        }
+        return slice;
     }
 
     @Override
     public Kind kind()
     {
+        if (rawText) {
+            return parsed().kind();
+        }
         return switch (itemTag(slice, offset)) {
             case JSON_NULL -> Kind.NULL;
             case ARRAY, ARRAY_INDEXED -> Kind.ARRAY;
@@ -84,32 +148,47 @@ public Kind kind()
     @Override
     public boolean isNull()
     {
+        if (rawText) {
+            return parsed().isNull();
+        }
         return itemTag(slice, offset) == ItemTag.JSON_NULL;
     }
 
     @Override
     public boolean isArray()
     {
+        if (rawText) {
+          
```

**File**: `lib/trino-json/src/main/java/io/trino/json/Json.java` (modified, +43/-5)
```diff
@@ -27,11 +27,17 @@
 ///
 /// Implementations come in two families:
 ///
-/// * **Byte-form** ([EncodedJson]) — backed by the typed-item encoding in a
-///   [Slice], the canonical wire representation for block storage and exchange.
+/// * **Byte-form** ([EncodedJson]) — backed by a [Slice], either the typed-item
+///   encoding (the canonical wire representation for Block storage / network
+///   exchange) or raw JSON text (a connector-side shortcut produced by
+///   [#unchecked] that lazy-parses on first structural access). The mode is
+///   discriminated by the slice's leading byte ([JsonItemEncoding#VERSION] vs.
+///   anything else).
 ///
 /// * **Tree-form** ([JsonObject], [JsonArray], [TypedValue], [JsonNullValue],
-///   [JsonErrorValue]) — Java object graphs whose byte encoding is materialized
+///   [JsonErrorValue]) — Java object graphs. Produced by the text-input parsers
+///   ([JsonItems#parseToTree]); used by the path engine when traversing values that
+///   originated as text. The byte encoding for a tree-form value is materialized
 ///   lazily on first [#encoding] call.
 ///
 /// `equals` and `hashCode` implement the SQL grouping semantics — multiset object
@@ -63,6 +69,21 @@ static Json of(Slice slice)
         return EncodedJson.of(slice);
     }
 
+    /// Wraps a stored payload, whichever form it is in: the leading byte distinguishes the typed
+    /// encoding from raw JSON text. Copies nothing and parses nothing.
+    static Json wrap(Slice slice)
+    {
+        return JsonItemEncoding.isEncoding(slice) ? of(slice) : unchecked(slice);
+    }
+
+    /// Wraps already-validated raw JSON text. Skips eager parsing; the bytes are
+    /// written to a JSON-typed block as-is, and structural access lazily parses to
+    /// a tree.
+    static Json unchecked(Slice rawText)
+    {
+        return EncodedJson.unchecked(rawText);
+    }
+
     // --- discriminators -----------------------------------------------------------
 
     Kind kind();
@@ -177,11 +198,11 @@ default TypedValue materializeScalar()
 
     /// Returns a fresh, self-contained encoded slice (with the VERSION byte
     /// prepended). For byte-backed implementations this is a copy of the existing
-    /// view; for tree forms it materializes the encoding lazily.
+    /// view; for tree / raw-text forms it materializes the encoding lazily.
     Slice encoding();
 
     /// Returns the underlying backing slice. May be larger than this view (when the
-    /// view points at an inner item of a larger document). For tree
+    /// view points at an inner item of a larger document). For tree / raw-text
     /// forms this triggers materialization. Use [#encoding] for a self-contained
     /// copy.
     Slice backingSlice();
@@ -191,4 +212,21 @@ default TypedValue materializeScalar()
 
     /// Byte offset just past this item within [#backingSlice].
     int viewEnd();
+
+    // --- raw-text shortcuts (used by JsonType.writeObject to avoid encoding). ----
+
+    /// True for an [EncodedJson] in raw-text mode — one wrapping raw JSON text (via [#unchecked])
+    /// rather than the typed encoding. This is the immutable storage mode, not a cache-state probe:
+    /// it stays true after structural access has lazily parsed and cached the tree. JsonType uses it
+    /// to write the raw bytes directly without materializing through the tree.
+    default boolean isRawText()
+    {
+        return false;
+    }
+
+    /// Returns the underlying raw text. Caller must have verified [#isRawText].
+    default Slice rawText()
+    {
+        throw new IllegalStateException("Not a raw-text Json");
+    }
 }
```

**File**: `lib/trino-json/src/main/java/io/trino/json/JsonItemEncoding.java` (modified, +110/-0)
```diff
@@ -13,6 +13,7 @@
  */
 package io.trino.json;
 
+import com.fasterxml.jackson.core.JsonGenerator;
 import com.google.common.primitives.Shorts;
 import com.google.common.primitives.SignedBytes;
 import io.airlift.slice.DynamicSliceOutput;
@@ -22,6 +23,7 @@
 import io.trino.spi.type.TrinoNumber;
 import io.trino.spi.type.TrinoNumber.AsBigDecimal;
 
+import java.io.IOException;
 import java.math.BigDecimal;
 import java.math.BigInteger;
 
@@ -737,6 +739,114 @@ public static Slice copyItemEncoding(Slice slice, int itemOffset, int endOffset)
         return output.slice();
     }
 
+    /// Walks the typed-item encoding starting at `itemOffset` and emits JSON text via
+    /// `generator`. Numeric scalars are written as digit-strings (via
+    /// `BigDecimal.toPlainString` for DECIMAL / NUMBER) so trailing zeros and full
+    /// precision survive a round-trip — Jackson's `writeNumber(BigDecimal)` would
+    /// otherwise normalize away the original scale.
+    public static void writeJson(Slice slice, int itemOffset, JsonGenerator generator)
+            throws IOException
+    {
+        switch (itemTag(slice, itemOffset)) {
+            case JSON_ERROR -> throw new IllegalArgumentException("JSON_ERROR cannot be rendered as JSON text");
+            case JSON_NULL -> generator.writeNull();
+            case ARRAY, ARRAY_INDEXED -> {
+                int count = arraySize(slice, itemOffset);
+                int cursor = arrayItemsStart(slice, itemOffset);
+                generator.writeStartArray();
+                for (int i = 0; i < count; i++) {
+                    writeJson(slice, cursor, generator);
+                    cursor = itemEndOffset(slice, cursor);
+                }
+                generator.writeEndArray();
+            }
+            case OBJECT, OBJECT_INDEXED -> {
+                int count = objectSize(slice, itemOffset);
+                int cursor = objectEntriesStart(slice, itemOffset);
+                generator.writeStartObject();
+                for (int i = 0; i < count; i++) {
+                    generator.writeFieldName(readString(slice, cursor));
+                    cursor = stringEndOffset(slice, cursor);
+                    writeJson(slice, cursor, generator);
+                    cursor = itemEndOffset(slice, cursor);
+                }
+                generator.writeEndObject();
+            }
+            case TYPED_VALUE -> writeTypedValueJson(slice, itemOffset + Byte.BYTES, generator);
+        }
+    }
+
+    private static void writeTypedValueJson(Slice slice, int bodyOffset, JsonGenerator generator)
+            throws IOException
+    {
+        TypeTag typeTag = TypeTag.fromEncoded(slice.getByte(bodyOffset));
+        int payload = bodyOffset + Byte.BYTES;
+        switch (typeTag) {
+            case BOOLEAN -> generator.writeBoolean(slice.getByte(payload) != 0);
+            case VARCHAR -> generator.writeString(readString(slice, payload));
+            case BIGINT -> generator.writeNumber(slice.getLong(payload));
+            case INTEGER -> generator.writeNumber(slice.getInt(payload));
+            case SMALLINT -> generator.writeNumber(slice.getShort(payload));
+            case TINYINT -> generator.writeNumber(slice.getByte(payload));
+            case DOUBLE -> {
+                double d = Double.longBitsToDouble(slice.getLong(payload));
+                if (Double.isFinite(d)) {
+                    generator.writeNumber(Double.toString(d));
+                }
+                else {
+                    generator.writeString(Double.toString(d));
+                }
+            }
+            case REAL -> {
+                float f = Float.intBitsToFloat(slice.getInt(payload));
+                if (Float.isFinite(f)) {
+                    generator.writeNumber(Float.toString(f));
+                }
+                else {
+                    generator.writeString(Float.toString(f));
+                }
+            }
+            case DECIMAL -> {
+                // payload layout: int32 precision (unused at render time) + int32 scale + byte longFlag + body
+                int scale = slice.getInt(payload + Integer.BYTES);
+                int longFlag = slice.getByte(payload + Integer.BYTES + Integer.BYTES);
+                int unscaledStart = payload + Integer.BYTES + Integer.BYTES + Byte.BYTES;
+                BigInteger unscaled;
+                if (longFlag == 0) {
+                    unscaled = BigInteger.valueOf(slice.getLong(unscaledStart));
+                }
+                else {
+                    byte[] bytes = new byte[Int128.SIZE];
+                    slice.getBytes(unscaledStart, bytes, 0, Int128.SIZE);
+                    unscaled = Int128.fromBigEndian(bytes).toBigInteger();
+                }
+                // toPlainString preserves the scale (so DECIMAL(3,1) value 1.0 renders as
+                // "1.0", not "1"); Jackson's writeNumber(BigDecimal) would otherwise route
+                // through BigDecimal.toStr
```

**File**: `lib/trino-json/src/main/java/io/trino/json/JsonItemSemantics.java` (modified, +2/-2)
```diff
@@ -82,8 +82,8 @@ public static boolean equal(Json left, Json right)
         }
         // Byte-identical encodings are always equal. Only taken when both operands already hold
         // bytes, so it never forces a tree to materialize just to answer a comparison.
-        if (left instanceof EncodedJson leftEncoded &&
-                right instanceof EncodedJson rightEncoded &&
+        if (left instanceof EncodedJson leftEncoded && !leftEncoded.isRawText() &&
+                right instanceof EncodedJson rightEncoded && !rightEncoded.isRawText() &&
                 encodingEquals(leftEncoded, rightEncoded)) {
             return true;
         }
```

**File**: `lib/trino-json/src/main/java/io/trino/json/JsonItems.java` (modified, +606/-3)
```diff
@@ -13,9 +13,38 @@
  */
 package io.trino.json;
 
+import com.fasterxml.jackson.core.JsonFactory;
+import com.fasterxml.jackson.core.JsonFactoryBuilder;
+import com.fasterxml.jackson.core.JsonGenerator;
+import com.fasterxml.jackson.core.JsonParseException;
+import com.fasterxml.jackson.core.JsonParser;
+import com.fasterxml.jackson.core.JsonProcessingException;
+import com.fasterxml.jackson.core.JsonToken;
+import com.fasterxml.jackson.core.StreamReadConstraints;
+import com.fasterxml.jackson.core.StreamWriteConstraints;
+import com.fasterxml.jackson.databind.DeserializationFeature;
+import com.fasterxml.jackson.databind.JsonNode;
+import com.fasterxml.jackson.databind.cfg.JsonNodeFeature;
+import com.fasterxml.jackson.databind.json.JsonMapper;
+import com.fasterxml.jackson.databind.node.ArrayNode;
+import com.fasterxml.jackson.databind.node.BigIntegerNode;
+import com.fasterxml.jackson.databind.node.BooleanNode;
+import com.fasterxml.jackson.databind.node.DecimalNode;
+import com.fasterxml.jackson.databind.node.DoubleNode;
+import com.fasterxml.jackson.databind.node.FloatNode;
+import com.fasterxml.jackson.databind.node.IntNode;
+import com.fasterxml.jackson.databind.node.JsonNodeFactory;
+import com.fasterxml.jackson.databind.node.LongNode;
+import com.fasterxml.jackson.databind.node.NullNode;
+import com.fasterxml.jackson.databind.node.ObjectNode;
+import com.fasterxml.jackson.databind.node.ShortNode;
+import com.fasterxml.jackson.databind.node.TextNode;
+import com.google.common.primitives.Shorts;
 import io.airlift.slice.DynamicSliceOutput;
 import io.airlift.slice.Slice;
 import io.trino.json.JsonItemBuilder.JsonItemWriter;
+import io.trino.spi.StandardErrorCode;
+import io.trino.spi.TrinoException;
 import io.trino.spi.type.BigintType;
 import io.trino.spi.type.BooleanType;
 import io.trino.spi.type.CharType;
@@ -30,18 +59,268 @@
 import io.trino.spi.type.TrinoNumber;
 import io.trino.spi.type.Type;
 import io.trino.spi.type.VarcharType;
+import org.gaul.modernizer_maven_annotations.SuppressModernizer;
 
+import java.io.IOException;
+import java.io.InputStream;
+import java.io.InputStreamReader;
+import java.io.Reader;
+import java.io.StringWriter;
 import java.math.BigDecimal;
+import java.math.BigInteger;
+import java.util.ArrayList;
+import java.util.LinkedHashMap;
+import java.util.List;
+import java.util.Map;
 
 import static io.airlift.slice.Slices.utf8Slice;
+import static io.trino.spi.type.DecimalType.createDecimalType;
+import static io.trino.spi.type.Decimals.MAX_PRECISION;
+import static java.lang.Float.floatToRawIntBits;
+import static java.lang.Float.intBitsToFloat;
+import static java.lang.Math.toIntExact;
+import static java.nio.charset.StandardCharsets.UTF_8;
 
-/// Encodes tree-form JSON values as typed-item bytes.
+/// Adapters between Jackson [JsonNode] trees and the typed-item [Json] encoding, used where a
+/// value arrives from a Jackson-based path (`JsonMapper.readTree`) and has to cross into the
+/// value model.
+///
+/// [#fromJsonNode] walks a Jackson tree and emits the typed-item encoding, discriminating
+/// numbers per node type exactly as
+/// `SqlJsonLiteralConverter#getNumericTypedValue` does: an `IntNode` becomes a
+/// `TYPED_VALUE` with an `INTEGER` tag, a `LongNode` a `BIGINT`, a `DecimalNode` a
+/// `DECIMAL(precision, scale)`.
 public final class JsonItems
 {
+    /// Decimal-form JSON numbers parse as BigDecimal rather than Double so the SQL/JSON
+    /// path engine can preserve precision (small values land in `DECIMAL`, oversized
+    /// values promote to `NUMBER` via [#fromJsonNode]). Without this flag Jackson would
+    /// silently round high-precision decimals to the nearest Double. Disabling
+    /// `STRIP_TRAILING_BIGDECIMAL_ZEROES` keeps `1.0` from collapsing to `1` — the
+    /// trailing zero is part of the source-side scale that the cast and round-trip
+    /// paths rely on for byte-faithful output.
+    // Trino columns can carry arbitrarily large strings and arbitrary-precision numbers;
+    // Jackson's defaults (~5 MB string, 1000-digit number) would reject SQL-valid inputs,
+    // so those caps are lifted to match the policy used by TrinoJsonCodec.
+    //
+    // Nesting depth is capped intentionally: parseTreeItem recurses on container depth,
+    // and uncapped depth would let a hostile JSON column (e.g. ingested from an external
+    // connector) crash the worker with a StackOverflowError. 1024 is comfortably above
+    // any reasonable SQL workload and well below the JVM's default stack budget.
+    // Serialization uses the same cap so values accepted by the parser can be rendered.
+    public static final int MAX_NESTING_DEPTH = 1024;
+
+    private static final JsonFactory JSON_FACTORY = buildJsonFactory();
+    private static final int STRING_READER_LENGTH_LIMIT = 8192;
+
+    @SuppressModernizer
+    // JsonFactoryBuilder usage is intentional to set custom read/write constraints
+    // (uncapped string/number length to admit 
```

**File**: `lib/trino-json/src/main/java/io/trino/json/TypedValue.java` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@
 /// (boxed if the type is `long`/`double`/`boolean` for storage uniformity).
 ///
 /// `TypedValue` is also the tree-form scalar leaf of [Json]: an INTEGER literal arriving
-/// can land here directly with no encode/decode round-trip, and the path
+/// via `parseToTree` lands here directly with no encode/decode round-trip, and the path
 /// engine reads it as the same instance it would have produced for `$.foo + 1`. When this
 /// scalar needs to cross to a byte sink, [#encoding] materializes the corresponding
 /// `TYPED_VALUE` item on demand. Scalars are tiny (≤ ~20 bytes) so each call re-encodes
```

**File**: `lib/trino-json/src/test/java/io/trino/json/TestJson.java` (modified, +9/-0)
```diff
@@ -38,6 +38,15 @@
 /// detection, ARRAY_INDEXED / OBJECT_INDEXED behavior at the threshold boundary.
 class TestJson
 {
+    @Test
+    void testRawTextIsParsedOnStructuralAccess()
+    {
+        Json raw = Json.unchecked(utf8Slice("[invalid"));
+        assertThat(raw.isRawText()).isTrue();
+        assertThat(raw.rawText()).isEqualTo(utf8Slice("[invalid"));
+        assertThatThrownBy(raw::arraySize).isInstanceOf(RuntimeException.class);
+    }
+
     @Test
     void testNarrowIntegerRange()
     {
```

---

### Incident Patch 5: `4373b6d3` (2026-10-02)
**Commit Message**: Require deletionVectors feature before writing new vectors

Legacy protocols without table features never support deletion vectors,
so the table property alone must not enable writing them.

**File**: `plugin/trino-delta-lake/src/main/java/io/trino/plugin/deltalake/transactionlog/DeltaLakeSchemaSupport.java` (modified, +2/-4)
```diff
@@ -172,10 +172,8 @@ public static boolean isDeletionVectorSupported(ProtocolEntry protocolEntry)
 
     public static boolean isDeletionVectorEnabled(MetadataEntry metadataEntry, ProtocolEntry protocolEntry)
     {
-        if (protocolEntry.supportsWriterFeatures() && !protocolEntry.writerFeaturesContains(DELETION_VECTORS_FEATURE_NAME)) {
-            return false;
-        }
-        return parseBoolean(metadataEntry.getConfiguration().get(DELETION_VECTORS_CONFIGURATION_KEY));
+        // Legacy protocols without table features never support deletion vectors
+        return isDeletionVectorSupported(protocolEntry) && parseBoolean(metadataEntry.getConfiguration().get(DELETION_VECTORS_CONFIGURATION_KEY));
     }
 
     public static int getRandomPrefixLength(MetadataEntry metadataEntry)
```

**File**: `plugin/trino-delta-lake/src/test/java/io/trino/plugin/deltalake/transactionlog/TestDeltaLakeSchemaSupport.java` (modified, +30/-0)
```diff
@@ -17,6 +17,7 @@
 import com.fasterxml.jackson.databind.json.JsonMapper;
 import com.google.common.collect.ImmutableList;
 import com.google.common.collect.ImmutableMap;
+import com.google.common.collect.ImmutableSet;
 import io.trino.plugin.deltalake.DeltaLakeColumnHandle;
 import io.trino.plugin.deltalake.DeltaLakeColumnMetadata;
 import io.trino.plugin.deltalake.DeltaLakeTable;
@@ -47,6 +48,8 @@
 import static com.google.common.collect.ImmutableList.toImmutableList;
 import static com.google.common.io.Resources.getResource;
 import static io.trino.plugin.deltalake.DeltaLakeColumnType.REGULAR;
+import static io.trino.plugin.deltalake.transactionlog.DeltaLakeSchemaSupport.isDeletionVectorEnabled;
+import static io.trino.plugin.deltalake.transactionlog.DeltaLakeSchemaSupport.isDeletionVectorSupported;
 import static io.trino.plugin.deltalake.transactionlog.DeltaLakeSchemaSupport.serializeColumnType;
 import static io.trino.plugin.deltalake.transactionlog.DeltaLakeSchemaSupport.serializeSchemaAsJson;
 import static io.trino.plugin.deltalake.transactionlog.DeltaLakeSchemaSupport.serializeStatsAsJson;
@@ -303,4 +306,31 @@ public void testTimestampNestedInStructTypeIsNotSupported()
         assertThatCode(() -> DeltaLakeSchemaSupport.validateType(RowType.anonymous(ImmutableList.of(TIMESTAMP_TZ_SECONDS)))).hasMessage("Unsupported type: timestamp(0) with time zone");
         assertThatCode(() -> DeltaLakeSchemaSupport.validateType(new ArrayType(TIMESTAMP_TZ_SECONDS))).hasMessage("Unsupported type: timestamp(0) with time zone");
     }
+
+    @Test
+    public void testIsDeletionVectorEnabled()
+    {
+        MetadataEntry enabled = metadataEntry(ImmutableMap.of("delta.enableDeletionVectors", "true"));
+        MetadataEntry disabled = metadataEntry(ImmutableMap.of("delta.enableDeletionVectors", "false"));
+        MetadataEntry unset = metadataEntry(ImmutableMap.of());
+
+        ProtocolEntry legacy = new ProtocolEntry(1, 2, Optional.empty(), Optional.empty());
+        ProtocolEntry withoutFeature = new ProtocolEntry(3, 7, Optional.of(ImmutableSet.of()), Optional.of(ImmutableSet.of()));
+        ProtocolEntry withFeature = new ProtocolEntry(3, 7, Optional.of(ImmutableSet.of("deletionVectors")), Optional.of(ImmutableSet.of("deletionVectors")));
+
+        assertThat(isDeletionVectorEnabled(enabled, legacy)).isFalse();
+        assertThat(isDeletionVectorEnabled(enabled, withoutFeature)).isFalse();
+        assertThat(isDeletionVectorEnabled(enabled, withFeature)).isTrue();
+        assertThat(isDeletionVectorEnabled(disabled, withFeature)).isFalse();
+        assertThat(isDeletionVectorEnabled(unset, withFeature)).isFalse();
+
+        assertThat(isDeletionVectorSupported(legacy)).isFalse();
+        assertThat(isDeletionVectorSupported(withoutFeature)).isFalse();
+        assertThat(isDeletionVectorSupported(withFeature)).isTrue();
+    }
+
+    private static MetadataEntry metadataEntry(Map<String, String> configuration)
+    {
+        return new MetadataEntry("id", "name", "description", new MetadataEntry.Format("parquet", ImmutableMap.of()), "{}", ImmutableList.of(), configuration, 0);
+    }
 }
```

---

### Incident Patch 6: `c6c0dfff` (2026-10-02)
**Commit Message**: Fix empty frame detection for ROWS frames

RowsFraming.emptyFrame read the frame offsets at position 0 of the
PagesIndex instead of at the current row. When offsets differ per row,
every row was checked against the first row's offsets.

**File**: `core/trino-main/src/main/java/io/trino/operator/window/RowsFraming.java` (modified, +6/-6)
```diff
@@ -50,7 +50,7 @@ public Range getRange(int currentPosition, int currentGroup, int peerGroupStart,
         int endPosition = partitionEnd - partitionStart - 1;
 
         // handle empty frame
-        if (emptyFrame(frameInfo, rowPosition, endPosition)) {
+        if (emptyFrame(frameInfo, currentPosition, rowPosition, endPosition)) {
             return new Range(-1, -1);
         }
 
@@ -88,19 +88,19 @@ else if (frameInfo.getEndType() == FOLLOWING) {
         return new Range(frameStart, frameEnd);
     }
 
-    private boolean emptyFrame(FrameInfo frameInfo, int rowPosition, int endPosition)
+    private boolean emptyFrame(FrameInfo frameInfo, int currentPosition, int rowPosition, int endPosition)
     {
         FrameBoundType startType = frameInfo.getStartType();
         FrameBoundType endType = frameInfo.getEndType();
 
         int positions = endPosition - rowPosition;
 
         if ((startType == UNBOUNDED_PRECEDING) && (endType == PRECEDING)) {
-            return getValue(frameInfo.getEndChannel(), 0) > rowPosition;
+            return getValue(frameInfo.getEndChannel(), currentPosition) > rowPosition;
         }
 
         if ((startType == FOLLOWING) && (endType == UNBOUNDED_FOLLOWING)) {
-            return getValue(frameInfo.getStartChannel(), 0) > positions;
+            return getValue(frameInfo.getStartChannel(), currentPosition) > positions;
         }
 
         if (startType != endType) {
@@ -112,8 +112,8 @@ private boolean emptyFrame(FrameInfo frameInfo, int rowPosition, int endPosition
             return false;
         }
 
-        long start = getValue(frameInfo.getStartChannel(), 0);
-        long end = getValue(frameInfo.getEndChannel(), 0);
+        long start = getValue(frameInfo.getStartChannel(), currentPosition);
+        long end = getValue(frameInfo.getEndChannel(), currentPosition);
 
         if (type == PRECEDING) {
             return (start < end) || ((start > rowPosition) && (end > rowPosition));
```

**File**: `core/trino-main/src/test/java/io/trino/sql/query/TestWindowFrameRows.java` (modified, +44/-0)
```diff
@@ -101,4 +101,48 @@ public void testOffsetTypes()
                 "FROM (VALUES 2, 2, 1, null, null) t(a)"))
                 .matches(expected);
     }
+
+    @Test
+    public void testEmptyFrame()
+    {
+        // PRECEDING to PRECEDING: both offsets before partition start
+        assertThat(assertions.query("SELECT a, array_agg(a) OVER(ORDER BY a ROWS BETWEEN start_offset PRECEDING AND end_offset PRECEDING) " +
+                "FROM (VALUES (1, 0, 0), (2, 5, 3)) t(a, start_offset, end_offset)"))
+                .matches("VALUES (1, ARRAY[1]), (2, null)");
+
+        // FOLLOWING to FOLLOWING: start offset past partition end
+        assertThat(assertions.query("SELECT a, array_agg(a) OVER(ORDER BY a ROWS BETWEEN start_offset FOLLOWING AND end_offset FOLLOWING) " +
+                "FROM (VALUES (1, 0, 0), (2, 3, 5)) t(a, start_offset, end_offset)"))
+                .matches("VALUES (1, ARRAY[1]), (2, null)");
+
+        // PRECEDING to PRECEDING: start after end, regular, start clamped, start equal to end
+        assertThat(assertions.query("SELECT a, array_agg(a) OVER(ORDER BY a ROWS BETWEEN start_offset PRECEDING AND end_offset PRECEDING) " +
+                "FROM (VALUES (1, 0, 1), (2, 1, 0), (3, 5, 2), (4, 2, 2)) t(a, start_offset, end_offset)"))
+                .matches("VALUES (2, ARRAY[1, 2]), (1, null), (3, ARRAY[1]), (4, ARRAY[2])");
+
+        // FOLLOWING to FOLLOWING: start after end, regular, end clamped
+        assertThat(assertions.query("SELECT a, array_agg(a) OVER(ORDER BY a ROWS BETWEEN start_offset FOLLOWING AND end_offset FOLLOWING) " +
+                "FROM (VALUES (1, 1, 0), (2, 0, 1), (3, 0, 10)) t(a, start_offset, end_offset)"))
+                .matches("VALUES (2, ARRAY[2, 3]), (1, null), (3, ARRAY[3])");
+
+        // UNBOUNDED PRECEDING to PRECEDING: offset before partition start, regular, offset equal to row position
+        assertThat(assertions.query("SELECT a, array_agg(a) OVER(ORDER BY a ROWS BETWEEN UNBOUNDED PRECEDING AND end_offset PRECEDING) " +
+                "FROM (VALUES (1, 5), (2, 0), (3, 2)) t(a, end_offset)"))
+                .matches("VALUES (2, ARRAY[1, 2]), (1, null), (3, ARRAY[1])");
+
+        // FOLLOWING to UNBOUNDED FOLLOWING: offset past partition end, regular, offset equal to remaining rows
+        assertThat(assertions.query("SELECT a, array_agg(a) OVER(ORDER BY a ROWS BETWEEN start_offset FOLLOWING AND UNBOUNDED FOLLOWING) " +
+                "FROM (VALUES (1, 5), (2, 0), (3, 0)) t(a, start_offset)"))
+                .matches("VALUES (2, ARRAY[2, 3]), (1, null), (3, ARRAY[3])");
+
+        // UNBOUNDED PRECEDING to PRECEDING: offsets read from the current partition, regardless of partition order
+        assertThat(assertions.query("SELECT p, a, array_agg(a) OVER(PARTITION BY p ORDER BY a ROWS BETWEEN UNBOUNDED PRECEDING AND end_offset PRECEDING) " +
+                "FROM (VALUES (1, 1, 1), (1, 2, 0), (2, 10, 0), (2, 20, 2), (2, 30, 0)) t(p, a, end_offset)"))
+                .matches("VALUES (1, 2, ARRAY[1, 2]), (1, 1, null), (2, 10, ARRAY[10]), (2, 20, null), (2, 30, ARRAY[10, 20, 30])");
+
+        // FOLLOWING to UNBOUNDED FOLLOWING: offsets read from the current partition, regardless of partition order
+        assertThat(assertions.query("SELECT p, a, array_agg(a) OVER(PARTITION BY p ORDER BY a ROWS BETWEEN start_offset FOLLOWING AND UNBOUNDED FOLLOWING) " +
+                "FROM (VALUES (1, 1, 2), (1, 2, 0), (2, 10, 0), (2, 20, 2), (2, 30, 0)) t(p, a, start_offset)"))
+                .matches("VALUES (1, 2, ARRAY[2]), (1, 1, null), (2, 10, ARRAY[10, 20, 30]), (2, 20, null), (2, 30, ARRAY[30])");
+    }
 }
```

---

### Incident Patch 7: `0e59aa2b` (2026-04-13)
**Commit Message**: Fix OPTIMIZE skipping single files with deletion vectors

**File**: `plugin/trino-delta-lake/src/main/java/io/trino/plugin/deltalake/DeltaLakeSplitManager.java` (modified, +5/-1)
```diff
@@ -269,7 +269,7 @@ private Stream<DeltaLakeSplit> getSplits(
     private static Stream<AddFileEntry> filterValidDataFilesForOptimize(Stream<AddFileEntry> validDataFiles, long maxScannedFileSizeInBytes)
     {
         // Value being present is a pending file (potentially the only one) for a given partition.
-        // Value being empty is a tombstone, indicates that there were in the stream previously at least 2 files selected for processing for a given partition.
+        // Value being empty is a tombstone, indicates that files of a given partition were already selected for processing.
         Map<Map<String, Optional<String>>, Optional<AddFileEntry>> pendingAddFileEntriesMap = new HashMap<>();
         return validDataFiles
                 .filter(addFileEntry -> addFileEntry.getSize() < maxScannedFileSizeInBytes)
@@ -283,6 +283,10 @@ private static Stream<AddFileEntry> filterValidDataFilesForOptimize(Stream<AddFi
                         pendingAddFileEntriesMap.put(canonicalPartitionValues, Optional.empty());
                         return Stream.of(alreadyQueuedAddFileEntry.get(), addFileEntry);
                     }
+                    if (addFileEntry.getDeletionVector().isPresent()) {
+                        pendingAddFileEntriesMap.put(canonicalPartitionValues, Optional.empty());
+                        return Stream.of(addFileEntry);
+                    }
 
                     pendingAddFileEntriesMap.put(canonicalPartitionValues, Optional.of(addFileEntry));
                     return Stream.empty();
```

**File**: `plugin/trino-delta-lake/src/test/java/io/trino/plugin/deltalake/TestDeltaLakeConnectorTest.java` (modified, +33/-0)
```diff
@@ -1230,6 +1230,39 @@ public void testOptimizeWithFileModifiedTimeColumn()
         }
     }
 
+    @Test
+    public void testOptimizeSingleFileWithDeletionVector()
+            throws Exception
+    {
+        try (TestTable table = newTrinoTable(
+                "test_optimize_single_file_dv_",
+                "(x int) WITH (deletion_vectors_enabled = true)")) {
+            String tableName = table.getName();
+
+            assertUpdate("INSERT INTO " + tableName + " VALUES 1, 2, 3", 3);
+            assertUpdate("DELETE FROM " + tableName + " WHERE x = 1", 1);
+
+            Set<String> initialFiles = getActiveFiles(tableName);
+            assertThat(initialFiles).hasSize(1);
+
+            // For optimize we need to set task_min_writer_count to 1, otherwise it will create more than one file.
+            Session singleWriterSession = Session.builder(getSession())
+                    .setSystemProperty("task_min_writer_count", "1")
+                    .build();
+            assertQuerySucceeds(singleWriterSession, "ALTER TABLE " + tableName + " EXECUTE OPTIMIZE");
+
+            Set<String> updatedFiles = getActiveFiles(tableName);
+            assertThat(updatedFiles)
+                    .hasSize(1)
+                    .doesNotContainAnyElementsOf(initialFiles);
+
+            assertQuery("SELECT * FROM " + tableName, "VALUES (2), (3)");
+
+            assertQuerySucceeds(singleWriterSession, "ALTER TABLE " + tableName + " EXECUTE OPTIMIZE");
+            assertThat(getActiveFiles(tableName)).isEqualTo(updatedFiles);
+        }
+    }
+
     @Test
     public void testFileSizeHiddenColumn()
     {
```

**File**: `plugin/trino-delta-lake/src/test/java/io/trino/plugin/deltalake/TestDeltaLakeSplitManager.java` (modified, +61/-0)
```diff
@@ -29,6 +29,7 @@
 import io.trino.plugin.deltalake.statistics.ExtendedStatistics;
 import io.trino.plugin.deltalake.statistics.MetaDirStatisticsAccess;
 import io.trino.plugin.deltalake.transactionlog.AddFileEntry;
+import io.trino.plugin.deltalake.transactionlog.DeletionVectorEntry;
 import io.trino.plugin.deltalake.transactionlog.MetadataEntry;
 import io.trino.plugin.deltalake.transactionlog.ProtocolEntry;
 import io.trino.plugin.deltalake.transactionlog.TableSnapshot;
@@ -60,6 +61,7 @@
 
 import java.util.List;
 import java.util.Optional;
+import java.util.OptionalInt;
 import java.util.concurrent.ExecutionException;
 import java.util.stream.Collectors;
 import java.util.stream.Stream;
@@ -101,6 +103,24 @@ public class TestDeltaLakeSplitManager
             Optional.empty(),
             0,
             false);
+    private static final DeltaLakeTableHandle optimizeTableHandle = new DeltaLakeTableHandle(
+            "schema",
+            "table",
+            true,
+            TABLE_PATH,
+            metadataEntry,
+            new ProtocolEntry(1, 2, Optional.empty(), Optional.empty()),
+            TupleDomain.all(),
+            TupleDomain.all(),
+            ImmutableSet.of(),
+            false,
+            Optional.empty(),
+            Optional.empty(),
+            false,
+            true, // isOptimize
+            Optional.of(DataSize.ofBytes(1_000_000)),
+            0,
+            false);
     private final HiveTransactionHandle transactionHandle = new HiveTransactionHandle(true);
 
     @Test
@@ -181,6 +201,26 @@ public void testSplitsFromMultipleFiles()
         assertThat(splits).isEqualTo(expected);
     }
 
+    @Test
+    public void testOptimizeSingleFileWithDeletionVector()
+            throws ExecutionException, InterruptedException
+    {
+        AddFileEntry fileWithDv = addFileEntryWithDeletionVector(FILE_PATH, 100L);
+        DeltaLakeConfig config = new DeltaLakeConfig();
+        DeltaLakeSplitManager splitManager = setupSplitManager(ImmutableList.of(fileWithDv), config);
+
+        ConnectorSplitSource splitSource = splitManager.getSplits(
+                transactionHandle,
+                testingConnectorSessionWithConfig(config),
+                optimizeTableHandle,
+                ImmutableSet.of(),
+                Constraint.alwaysTrue());
+
+        List<ConnectorSplit> splits = splitSource.getNextBatch(10, new DynamicFilterSnapshot(TupleDomain.all(), true)).get();
+
+        assertThat(splits).hasSize(1);
+    }
+
     private DeltaLakeSplitManager setupSplitManager(List<AddFileEntry> addFileEntries, DeltaLakeConfig deltaLakeConfig)
     {
         TestingConnectorContext context = new TestingConnectorContext();
@@ -262,6 +302,27 @@ private AddFileEntry addFileEntryOfSize(String path, long fileSize)
         return new AddFileEntry(path, ImmutableMap.of(), fileSize, 0, false, Optional.empty(), Optional.empty(), ImmutableMap.of(), Optional.empty());
     }
 
+    private AddFileEntry addFileEntryWithDeletionVector(String path, long fileSize)
+    {
+        DeletionVectorEntry dvEntry = new DeletionVectorEntry(
+                "u",
+                "random_id",
+                OptionalInt.empty(),
+                1,
+                1);
+
+        return new AddFileEntry(
+                path,
+                ImmutableMap.of(),
+                fileSize,
+                0L,
+                false,
+                Optional.empty(),
+                Optional.empty(),
+                ImmutableMap.of(),
+                Optional.of(dvEntry));
+    }
+
     private DeltaLakeSplit makeSplit(String path, long start, long splitSize, long fileSize, long maxSplitSize, double minimumAssignedSplitWeight)
     {
         SplitWeight splitWeight = SplitWeight.fromProportion(clamp((double) splitSize / maxSplitSize, minimumAssignedSplitWeight, 1.0));
```

---

### Incident Patch 8: `1f1306fb` (2026-09-10)
**Commit Message**: Fix SQL Server NULLIF pushdown over character columns

**File**: `docs/src/main/sphinx/connector/sqlserver.md` (modified, +5/-6)
```diff
@@ -524,12 +524,11 @@ SQL Server compares character values with PAD SPACE semantics and with the colum
 so it can match values that Trino, which compares `varchar` with NO PAD and is always
 case-sensitive, treats as different. Pushdown on character columns is restricted accordingly:
 
-- On `CHAR` and `NCHAR` columns with a case-sensitive collation, `=`, `<>`, `IN`, and `NOT IN`
-  against a literal are pushed down. Between two such columns, `IN` and `NOT IN` are pushed down as
-  a filter.
-- On all other character columns, `=`, `<>`, `IN`, and `NOT IN` are not pushed down between two
-  columns or as a join condition, and against a literal `=` and `IN` are pushed only as a pre-filter
-  with Trino re-applying the comparison, so the query is not fully pushed down.
+- Fully pushed down, only on `CHAR` and `NCHAR` columns with a case-sensitive collation: `=`,
+  `<>`, `IN`, and `NOT IN` against a literal, and `IN`, `NOT IN`, and `NULLIF` between two such
+  columns.
+- Pushed down only as a pre-filter that Trino re-checks, on all other character columns: `=` and
+  `IN` against a literal. The query is not fully pushed down.
 - `=` and `<>` join conditions on `VARCHAR` and `NVARCHAR` columns are not pushed down.
 - Range predicates, such as `>` or `BETWEEN`, are never pushed down on character columns.
 
```

**File**: `plugin/trino-sqlserver/src/main/java/io/trino/plugin/sqlserver/RewriteSqlServerNullIf.java` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+/*
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
+package io.trino.plugin.sqlserver;
+
+import com.google.common.collect.ImmutableList;
+import io.trino.matching.Capture;
+import io.trino.matching.Captures;
+import io.trino.matching.Pattern;
+import io.trino.plugin.base.expression.ConnectorExpressionRule;
+import io.trino.plugin.jdbc.QueryParameter;
+import io.trino.plugin.jdbc.expression.ParameterizedExpression;
+import io.trino.spi.expression.Call;
+import io.trino.spi.expression.ConnectorExpression;
+
+import java.util.Optional;
+
+import static io.trino.matching.Capture.newCapture;
+import static io.trino.plugin.base.expression.ConnectorExpressionPatterns.argument;
+import static io.trino.plugin.base.expression.ConnectorExpressionPatterns.argumentCount;
+import static io.trino.plugin.base.expression.ConnectorExpressionPatterns.call;
+import static io.trino.plugin.base.expression.ConnectorExpressionPatterns.expression;
+import static io.trino.plugin.base.expression.ConnectorExpressionPatterns.functionName;
+import static io.trino.plugin.sqlserver.RemoteComparison.isSupportedComparison;
+import static io.trino.spi.expression.StandardFunctions.NULLIF_FUNCTION_NAME;
+
+/**
+ * Pushes {@code NULLIF} down only when {@link RemoteComparison} allows comparing the values remotely.
+ */
+public class RewriteSqlServerNullIf
+        implements ConnectorExpressionRule<Call, ParameterizedExpression>
+{
+    private static final Capture<ConnectorExpression> FIRST = newCapture();
+    private static final Capture<ConnectorExpression> SECOND = newCapture();
+
+    private static final Pattern<Call> PATTERN = call()
+            .with(functionName().equalTo(NULLIF_FUNCTION_NAME))
+            .with(argumentCount().equalTo(2))
+            .with(argument(0).matching(expression().capturedAs(FIRST)))
+            .with(argument(1).matching(expression().capturedAs(SECOND)));
+
+    @Override
+    public Pattern<Call> getPattern()
+    {
+        return PATTERN;
+    }
+
+    @Override
+    public Optional<ParameterizedExpression> rewrite(Call call, Captures captures, RewriteContext<ParameterizedExpression> context)
+    {
+        if (!isSupportedComparison(call, context)) {
+            return Optional.empty();
+        }
+        return context.defaultRewrite(captures.get(FIRST)).flatMap(first ->
+                context.defaultRewrite(captures.get(SECOND)).map(second ->
+                        new ParameterizedExpression(
+                                "NULLIF((%s), (%s))".formatted(first.expression(), second.expression()),
+                                ImmutableList.<QueryParameter>builder()
+                                        .addAll(first.parameters())
+                                        .addAll(second.parameters())
+                                        .build())));
+    }
+}
```

**File**: `plugin/trino-sqlserver/src/main/java/io/trino/plugin/sqlserver/SqlServerClient.java` (modified, +1/-1)
```diff
@@ -336,6 +336,7 @@ public SqlServerClient(
         this.connectorExpressionRewriter = JdbcConnectorExpressionRewriterBuilder.newBuilder()
                 .addStandardRules(this::quoted)
                 .add(new RewriteSqlServerIn())
+                .add(new RewriteSqlServerNullIf())
                 .add(new RewriteLikeWithCaseSensitivity())
                 .add(new RewriteLikeEscapeWithCaseSensitivity())
                 .withTypeClass("integer_type", ImmutableSet.of("tinyint", "smallint", "integer", "bigint"))
@@ -355,7 +356,6 @@ public SqlServerClient(
                 .map("$not($is_null(value))").to("value IS NOT NULL")
                 .map("$not(value: boolean)").to("NOT value")
                 .map("$is_null(value)").to("value IS NULL")
-                .map("$nullif(first, second)").to("NULLIF(first, second)")
                 .build();
 
         this.aggregateFunctionRewriter = new AggregateFunctionRewriter<>(
```

**File**: `plugin/trino-sqlserver/src/test/java/io/trino/plugin/sqlserver/BaseSqlServerConnectorTest.java` (modified, +23/-0)
```diff
@@ -137,6 +137,29 @@ public void testVarcharInPredicatePushdownIgnoresTrailingSpaces()
         }
     }
 
+    @Test
+    public void testVarcharNullIfPushdownIgnoresTrailingSpaces()
+    {
+        try (TestTable table = new TestTable(
+                onRemoteDatabase(),
+                "test_varchar_nullif_pad_space",
+                "(a varchar(10) COLLATE Latin1_General_CS_AS, b varchar(10) COLLATE Latin1_General_CS_AS, d1 date, d2 date)",
+                List.of("'a', 'a', '2001-01-01', '2001-01-01'", "'a', 'a ', '2001-01-02', '2001-01-02'", "'a ', 'a', '2001-01-03', '2001-01-04'", "'a ', 'a ', '2001-01-05', '2001-01-06'"))) {
+            assertThat(query("SELECT a, b FROM " + table.getName() + " WHERE NULLIF(a, b) IS NULL"))
+                    .skippingTypesCheck()
+                    .matches("VALUES ('a', 'a'), ('a ', 'a ')")
+                    .isNotFullyPushedDown(FilterNode.class);
+            assertThat(query("SELECT a, b FROM " + table.getName() + " WHERE NULLIF(a, 'a') IS NULL"))
+                    .skippingTypesCheck()
+                    .matches("VALUES ('a', 'a'), ('a', 'a ')")
+                    .isNotFullyPushedDown(FilterNode.class);
+            // nullif over a non-character type is still pushed down
+            assertThat(query("SELECT d1 FROM " + table.getName() + " WHERE NULLIF(d1, d2) IS NULL"))
+                    .matches("VALUES DATE '2001-01-01', DATE '2001-01-02'")
+                    .isFullyPushedDown();
+        }
+    }
+
     @Test
     public void testCharInPredicatePushdown()
     {
```

---

### Incident Patch 9: `62bd3694` (2026-09-10)
**Commit Message**: Fix SQL Server IN pushdown over character columns

**File**: `docs/src/main/sphinx/connector/sqlserver.md` (modified, +5/-4)
```diff
@@ -525,10 +525,11 @@ so it can match values that Trino, which compares `varchar` with NO PAD and is a
 case-sensitive, treats as different. Pushdown on character columns is restricted accordingly:
 
 - On `CHAR` and `NCHAR` columns with a case-sensitive collation, `=`, `<>`, `IN`, and `NOT IN`
-  against a literal are pushed down.
-- On all other character columns, `=` and `<>` are not pushed down between two columns or as a join
-  condition, and against a literal `=` and `IN` are pushed only as a pre-filter with Trino re-applying
-  the comparison, so the query is not fully pushed down.
+  against a literal are pushed down. Between two such columns, `IN` and `NOT IN` are pushed down as
+  a filter.
+- On all other character columns, `=`, `<>`, `IN`, and `NOT IN` are not pushed down between two
+  columns or as a join condition, and against a literal `=` and `IN` are pushed only as a pre-filter
+  with Trino re-applying the comparison, so the query is not fully pushed down.
 - `=` and `<>` join conditions on `VARCHAR` and `NVARCHAR` columns are not pushed down.
 - Range predicates, such as `>` or `BETWEEN`, are never pushed down on character columns.
 
```

**File**: `plugin/trino-sqlserver/src/main/java/io/trino/plugin/sqlserver/RemoteComparison.java` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+/*
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
+package io.trino.plugin.sqlserver;
+
+import io.trino.plugin.base.expression.ConnectorExpressionRule.RewriteContext;
+import io.trino.plugin.jdbc.JdbcColumnHandle;
+import io.trino.spi.expression.ConnectorExpression;
+import io.trino.spi.expression.Variable;
+import io.trino.spi.type.CharType;
+import io.trino.spi.type.Type;
+import io.trino.spi.type.VarcharType;
+
+import static io.trino.plugin.jdbc.CaseSensitivity.CASE_INSENSITIVE;
+import static io.trino.plugin.jdbc.CaseSensitivity.CASE_SENSITIVE;
+
+final class RemoteComparison
+{
+    private RemoteComparison() {}
+
+    /**
+     * Whether the connector pushes down a comparison over the values in the expression. varchar is never pushed
+     * down, because SQL Server compares it with PAD SPACE semantics while Trino compares it with NO PAD. char is
+     * pushed down only when the column collation is classified as case-sensitive, which still allows it to be
+     * accent-, width- or kana-insensitive and so to match values that Trino treats as different.
+     */
+    static boolean isSupportedComparison(ConnectorExpression expression, RewriteContext<?> context)
+    {
+        Type type = expression.getType();
+        if (type instanceof VarcharType) {
+            return false;
+        }
+        if (type instanceof CharType && expression instanceof Variable variable && !isCaseSensitive(variable, context)) {
+            return false;
+        }
+        return expression.getChildren().stream().allMatch(child -> isSupportedComparison(child, context));
+    }
+
+    private static boolean isCaseSensitive(Variable variable, RewriteContext<?> context)
+    {
+        return ((JdbcColumnHandle) context.getAssignment(variable.getName())).getJdbcTypeHandle().caseSensitivity().orElse(CASE_INSENSITIVE) == CASE_SENSITIVE;
+    }
+}
```

**File**: `plugin/trino-sqlserver/src/main/java/io/trino/plugin/sqlserver/RewriteSqlServerIn.java` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+/*
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
+package io.trino.plugin.sqlserver;
+
+import io.trino.matching.Captures;
+import io.trino.plugin.jdbc.expression.ParameterizedExpression;
+import io.trino.plugin.jdbc.expression.RewriteIn;
+import io.trino.spi.expression.Call;
+
+import java.util.Optional;
+
+import static io.trino.plugin.sqlserver.RemoteComparison.isSupportedComparison;
+
+/**
+ * Pushes {@code IN} down only when {@link RemoteComparison} allows comparing the values remotely.
+ */
+public class RewriteSqlServerIn
+        extends RewriteIn
+{
+    @Override
+    public Optional<ParameterizedExpression> rewrite(Call call, Captures captures, RewriteContext<ParameterizedExpression> context)
+    {
+        if (!isSupportedComparison(call, context)) {
+            return Optional.empty();
+        }
+        return super.rewrite(call, captures, context);
+    }
+}
```

**File**: `plugin/trino-sqlserver/src/main/java/io/trino/plugin/sqlserver/SqlServerClient.java` (modified, +1/-2)
```diff
@@ -63,7 +63,6 @@
 import io.trino.plugin.jdbc.aggregation.ImplementSum;
 import io.trino.plugin.jdbc.expression.JdbcConnectorExpressionRewriterBuilder;
 import io.trino.plugin.jdbc.expression.ParameterizedExpression;
-import io.trino.plugin.jdbc.expression.RewriteIn;
 import io.trino.plugin.jdbc.expression.RewriteLikeEscapeWithCaseSensitivity;
 import io.trino.plugin.jdbc.expression.RewriteLikeWithCaseSensitivity;
 import io.trino.plugin.jdbc.logging.RemoteQueryModifier;
@@ -336,7 +335,7 @@ public SqlServerClient(
 
         this.connectorExpressionRewriter = JdbcConnectorExpressionRewriterBuilder.newBuilder()
                 .addStandardRules(this::quoted)
-                .add(new RewriteIn())
+                .add(new RewriteSqlServerIn())
                 .add(new RewriteLikeWithCaseSensitivity())
                 .add(new RewriteLikeEscapeWithCaseSensitivity())
                 .withTypeClass("integer_type", ImmutableSet.of("tinyint", "smallint", "integer", "bigint"))
```

**File**: `plugin/trino-sqlserver/src/test/java/io/trino/plugin/sqlserver/BaseSqlServerConnectorTest.java` (modified, +48/-0)
```diff
@@ -114,6 +114,54 @@ public void testVarcharColumnComparisonPushdownIgnoresTrailingSpaces()
         }
     }
 
+    @Test
+    public void testVarcharInPredicatePushdownIgnoresTrailingSpaces()
+    {
+        try (TestTable table = new TestTable(
+                onRemoteDatabase(),
+                "test_varchar_in_pad_space",
+                "(a varchar(10) COLLATE Latin1_General_CS_AS, b varchar(10) COLLATE Latin1_General_CS_AS, c varchar(10) COLLATE Latin1_General_CS_AS)",
+                List.of("'a', 'a', 'zz'", "'a', 'a ', 'zz'", "'a ', 'a', 'zz'", "'a ', 'a ', 'zz'"))) {
+            assertThat(query("SELECT a, b FROM " + table.getName() + " WHERE a IN (b, c)"))
+                    .skippingTypesCheck()
+                    .matches("VALUES ('a', 'a'), ('a ', 'a ')")
+                    .isNotFullyPushedDown(FilterNode.class);
+            assertThat(query("SELECT a, b FROM " + table.getName() + " WHERE a NOT IN (b, c)"))
+                    .skippingTypesCheck()
+                    .matches("VALUES ('a', 'a '), ('a ', 'a')")
+                    .isNotFullyPushedDown(FilterNode.class);
+            assertThat(query("SELECT a, b FROM " + table.getName() + " WHERE a IN ('a', 'x') OR c = 'yy'"))
+                    .skippingTypesCheck()
+                    .matches("VALUES ('a', 'a'), ('a', 'a ')")
+                    .isNotFullyPushedDown(FilterNode.class);
+        }
+    }
+
+    @Test
+    public void testCharInPredicatePushdown()
+    {
+        List<String> rows = List.of("'a', 'a', 'zz'", "'a', 'A', 'zz'");
+        try (TestTable caseSensitive = new TestTable(
+                onRemoteDatabase(),
+                "test_char_in_case_sensitive",
+                "(a char(3) COLLATE Latin1_General_CS_AS, b char(3) COLLATE Latin1_General_CS_AS, c char(3) COLLATE Latin1_General_CS_AS)",
+                rows);
+                TestTable caseInsensitive = new TestTable(
+                        onRemoteDatabase(),
+                        "test_char_in_case_insensitive",
+                        "(a char(3) COLLATE Latin1_General_CI_AS, b char(3) COLLATE Latin1_General_CI_AS, c char(3) COLLATE Latin1_General_CI_AS)",
+                        rows)) {
+            assertThat(query("SELECT a, b FROM " + caseSensitive.getName() + " WHERE a IN (b, c)"))
+                    .skippingTypesCheck()
+                    .matches("VALUES ('a  ', 'a  ')")
+                    .isFullyPushedDown();
+            assertThat(query("SELECT a, b FROM " + caseInsensitive.getName() + " WHERE a IN (b, c)"))
+                    .skippingTypesCheck()
+                    .matches("VALUES ('a  ', 'a  ')")
+                    .isNotFullyPushedDown(FilterNode.class);
+        }
+    }
+
     @Override
     protected TestTable createTableWithDefaultColumns()
     {
```

---

### Incident Patch 10: `03b02018` (2026-08-28)
**Commit Message**: Fix SQL Server varchar comparison and join pushdown

**File**: `docs/src/main/sphinx/connector/sqlserver.md` (modified, +15/-12)
```diff
@@ -519,18 +519,21 @@ The connector supports pushdown for a number of operations:
 
 #### Predicate pushdown support
 
-The connector supports pushdown of predicates on `VARCHAR` and `NVARCHAR`
-columns if the underlying columns in SQL Server use a case-sensitive [collation](https://learn.microsoft.com/en-us/sql/relational-databases/collations/collation-and-unicode-support?view=sql-server-ver16).
-
-The following operators are pushed down:
-
-- `=`
-- `<>`
-- `IN`
-- `NOT IN`
-
-To ensure correct results, operators are not pushed down for columns using a
-case-insensitive collation.
+SQL Server compares character values with PAD SPACE semantics and with the column
+[collation](https://learn.microsoft.com/en-us/sql/relational-databases/collations/collation-and-unicode-support?view=sql-server-ver16),
+so it can match values that Trino, which compares `varchar` with NO PAD and is always
+case-sensitive, treats as different. Pushdown on character columns is restricted accordingly:
+
+- On `CHAR` and `NCHAR` columns with a case-sensitive collation, `=`, `<>`, `IN`, and `NOT IN`
+  against a literal are pushed down.
+- On all other character columns, `=` and `<>` are not pushed down between two columns or as a join
+  condition, and against a literal `=` and `IN` are pushed only as a pre-filter with Trino re-applying
+  the comparison, so the query is not fully pushed down.
+- `=` and `<>` join conditions on `VARCHAR` and `NVARCHAR` columns are not pushed down.
+- Range predicates, such as `>` or `BETWEEN`, are never pushed down on character columns.
+
+A collation counts as case-sensitive if its name contains `_CS` or `_BIN`, which still allows it to
+be accent-, width-, or kana-insensitive. Use a `_BIN2` collation to match Trino exactly.
 
 (sqlserver-bulk-insert)=
 ### Bulk insert
```

**File**: `plugin/trino-base-jdbc/src/main/java/io/trino/plugin/jdbc/expression/RewriteCaseSensitiveComparison.java` (removed, +0/-94)
```diff
@@ -1,94 +0,0 @@
-/*
- * Licensed under the Apache License, Version 2.0 (the "License");
- * you may not use this file except in compliance with the License.
- * You may obtain a copy of the License at
- *
- *     http://www.apache.org/licenses/LICENSE-2.0
- *
- * Unless required by applicable law or agreed to in writing, software
- * distributed under the License is distributed on an "AS IS" BASIS,
- * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
- * See the License for the specific language governing permissions and
- * limitations under the License.
- */
-package io.trino.plugin.jdbc.expression;
-
-import com.google.common.collect.ImmutableList;
-import io.trino.matching.Capture;
-import io.trino.matching.Captures;
-import io.trino.matching.Pattern;
-import io.trino.plugin.base.expression.ConnectorExpressionRule;
-import io.trino.plugin.jdbc.JdbcColumnHandle;
-import io.trino.plugin.jdbc.QueryParameter;
-import io.trino.spi.expression.Call;
-import io.trino.spi.expression.FunctionName;
-import io.trino.spi.expression.Variable;
-import io.trino.spi.type.VarcharType;
-
-import java.util.Optional;
-import java.util.Set;
-
-import static com.google.common.collect.ImmutableSet.toImmutableSet;
-import static io.trino.matching.Capture.newCapture;
-import static io.trino.plugin.base.expression.ConnectorExpressionPatterns.argument;
-import static io.trino.plugin.base.expression.ConnectorExpressionPatterns.argumentCount;
-import static io.trino.plugin.base.expression.ConnectorExpressionPatterns.call;
-import static io.trino.plugin.base.expression.ConnectorExpressionPatterns.functionName;
-import static io.trino.plugin.base.expression.ConnectorExpressionPatterns.type;
-import static io.trino.plugin.base.expression.ConnectorExpressionPatterns.variable;
-import static io.trino.plugin.jdbc.CaseSensitivity.CASE_SENSITIVE;
-import static io.trino.spi.type.BooleanType.BOOLEAN;
-
-public class RewriteCaseSensitiveComparison
-        implements ConnectorExpressionRule<Call, ParameterizedExpression>
-{
-    private static final Capture<Variable> LEFT = newCapture();
-    private static final Capture<Variable> RIGHT = newCapture();
-
-    private final Pattern<Call> pattern;
-
-    public RewriteCaseSensitiveComparison(Set<ComparisonOperator> enabledOperators)
-    {
-        Set<FunctionName> functionNames = enabledOperators.stream()
-                .map(ComparisonOperator::getFunctionName)
-                .collect(toImmutableSet());
-
-        pattern = call()
-                .with(type().equalTo(BOOLEAN))
-                .with(functionName().matching(functionNames::contains))
-                .with(argumentCount().equalTo(2))
-                .with(argument(0).matching(variable().with(type().matching(VarcharType.class::isInstance)).capturedAs(LEFT)))
-                .with(argument(1).matching(variable().with(type().matching(VarcharType.class::isInstance)).capturedAs(RIGHT)));
-    }
-
-    @Override
-    public Pattern<Call> getPattern()
-    {
-        return pattern;
-    }
-
-    @Override
-    public Optional<ParameterizedExpression> rewrite(Call expression, Captures captures, RewriteContext<ParameterizedExpression> context)
-    {
-        ComparisonOperator comparison = ComparisonOperator.forFunctionName(expression.getFunctionName());
-        Variable firstArgument = captures.get(LEFT);
-        Variable secondArgument = captures.get(RIGHT);
-
-        if (!isCaseSensitive(firstArgument, context) || !isCaseSensitive(secondArgument, context)) {
-            return Optional.empty();
-        }
-        return context.defaultRewrite(firstArgument).flatMap(first ->
-                context.defaultRewrite(secondArgument).map(second ->
-                        new ParameterizedExpression(
-                                "(%s) %s (%s)".formatted(first.expression(), comparison.getOperator(), second.expression()),
-                                ImmutableList.<QueryParameter>builder()
-                                        .addAll(first.parameters())
-                                        .addAll(second.parameters())
-                                        .build())));
-    }
-
-    private static boolean isCaseSensitive(Variable variable, RewriteContext<?> context)
-    {
-        return ((JdbcColumnHandle) context.getAssignment(variable.getName())).getJdbcTypeHandle().caseSensitivity().equals(Optional.of(CASE_SENSITIVE));
-    }
-}
```

**File**: `plugin/trino-sqlserver/src/main/java/io/trino/plugin/sqlserver/SqlServerClient.java` (modified, +5/-5)
```diff
@@ -61,10 +61,8 @@
 import io.trino.plugin.jdbc.aggregation.ImplementAvgFloatingPoint;
 import io.trino.plugin.jdbc.aggregation.ImplementMinMax;
 import io.trino.plugin.jdbc.aggregation.ImplementSum;
-import io.trino.plugin.jdbc.expression.ComparisonOperator;
 import io.trino.plugin.jdbc.expression.JdbcConnectorExpressionRewriterBuilder;
 import io.trino.plugin.jdbc.expression.ParameterizedExpression;
-import io.trino.plugin.jdbc.expression.RewriteCaseSensitiveComparison;
 import io.trino.plugin.jdbc.expression.RewriteIn;
 import io.trino.plugin.jdbc.expression.RewriteLikeEscapeWithCaseSensitivity;
 import io.trino.plugin.jdbc.expression.RewriteLikeWithCaseSensitivity;
@@ -349,7 +347,6 @@ public SqlServerClient(
                 .map("$less_than_or_equal(left: numeric_type, right: numeric_type)").to("left <= right")
                 .map("$greater_than(left: numeric_type, right: numeric_type)").to("left > right")
                 .map("$greater_than_or_equal(left: numeric_type, right: numeric_type)").to("left >= right")
-                .add(new RewriteCaseSensitiveComparison(ImmutableSet.of(ComparisonOperator.EQUAL, ComparisonOperator.NOT_EQUAL)))
                 .map("$add(left: integer_type, right: integer_type)").to("left + right")
                 .map("$subtract(left: integer_type, right: integer_type)").to("left - right")
                 .map("$multiply(left: integer_type, right: integer_type)").to("left * right")
@@ -1205,15 +1202,18 @@ protected boolean isSupportedJoinCondition(ConnectorSession session, JdbcJoinCon
             JoinCondition.Operator operator = joinCondition.getOperator();
             return switch (operator) {
                 case LESS_THAN, LESS_THAN_OR_EQUAL, GREATER_THAN, GREATER_THAN_OR_EQUAL -> false;
-                case EQUAL, NOT_EQUAL -> isCaseSensitiveVarchar(joinCondition.getLeftColumn()) && isCaseSensitiveVarchar(joinCondition.getRightColumn());
+                case EQUAL, NOT_EQUAL -> joinCondition.getLeftColumn().getColumnType() instanceof CharType
+                        && joinCondition.getRightColumn().getColumnType() instanceof CharType
+                        && isCaseSensitive(joinCondition.getLeftColumn())
+                        && isCaseSensitive(joinCondition.getRightColumn());
                 default -> false;
             };
         }
 
         return true;
     }
 
-    private boolean isCaseSensitiveVarchar(JdbcColumnHandle columnHandle)
+    private boolean isCaseSensitive(JdbcColumnHandle columnHandle)
     {
         return columnHandle.getJdbcTypeHandle().caseSensitivity().orElse(CASE_INSENSITIVE) == CASE_SENSITIVE;
     }
```

**File**: `plugin/trino-sqlserver/src/test/java/io/trino/plugin/sqlserver/BaseSqlServerConnectorTest.java` (modified, +34/-5)
```diff
@@ -51,9 +51,6 @@ protected boolean hasBehavior(TestingConnectorBehavior connectorBehavior)
     {
         return switch (connectorBehavior) {
             case SUPPORTS_JOIN_PUSHDOWN -> true;
-            // Equality predicates over varchar are pushed only as a superset pre-filter (PAD SPACE), so this derived
-            // behavior is off; a column-to-column join is unaffected, so re-enable the join behavior it would cascade off.
-            case SUPPORTS_JOIN_PUSHDOWN_WITH_VARCHAR_EQUALITY -> true;
             case SUPPORTS_ADD_COLUMN_WITH_COMMENT,
                  SUPPORTS_ADD_COLUMN_WITH_POSITION,
                  SUPPORTS_AGGREGATION_PUSHDOWN_CORRELATION,
@@ -84,6 +81,39 @@ protected boolean hasBehavior(TestingConnectorBehavior connectorBehavior)
         };
     }
 
+    @Test
+    public void testVarcharEqualityJoinPushdownIgnoresTrailingSpaces()
+    {
+        try (TestTable table = new TestTable(
+                onRemoteDatabase(),
+                "test_varchar_join_pad_space",
+                "(v varchar(10) COLLATE Latin1_General_CS_AS)",
+                List.of("'a'", "'a '"))) {
+            Session session = Session.builder(joinPushdownEnabled(getSession()))
+                    .setCatalogSessionProperty("sqlserver", "join_pushdown_strategy", "EAGER")
+                    .build();
+            assertThat(query(session, "SELECT l.v, r.v FROM " + table.getName() + " l JOIN " + table.getName() + " r ON l.v = r.v"))
+                    .skippingTypesCheck()
+                    .matches("VALUES ('a', 'a'), ('a ', 'a ')")
+                    .joinIsNotFullyPushedDown();
+        }
+    }
+
+    @Test
+    public void testVarcharColumnComparisonPushdownIgnoresTrailingSpaces()
+    {
+        try (TestTable table = new TestTable(
+                onRemoteDatabase(),
+                "test_varchar_cmp_pad_space",
+                "(a varchar(10) COLLATE Latin1_General_CS_AS, b varchar(10) COLLATE Latin1_General_CS_AS)",
+                List.of("'a', 'a'", "'a', 'a '", "'a ', 'a'"))) {
+            assertThat(query("SELECT a, b FROM " + table.getName() + " WHERE a = b"))
+                    .skippingTypesCheck()
+                    .matches("VALUES ('a', 'a')")
+                    .isNotFullyPushedDown(FilterNode.class);
+        }
+    }
+
     @Override
     protected TestTable createTableWithDefaultColumns()
     {
@@ -237,9 +267,8 @@ public void testPredicatePushdown()
                 // the varchar equality predicate leaves a residual filter that prevents full pushdown
                 .isNotFullyPushedDown(FilterNode.class);
 
-        // join on varchar columns is unaffected: a column-to-column join is not pushed via the domain pushdown path
         assertThat(query(joinPushdownEnabled, "SELECT n.name, n2.regionkey FROM nation n JOIN nation n2 ON n.name = n2.name"))
-                .isFullyPushedDown();
+                .joinIsNotFullyPushedDown();
 
         // bigint equality
         assertThat(query("SELECT regionkey, nationkey, name FROM nation WHERE nationkey = 19"))
```

**File**: `plugin/trino-sqlserver/src/test/java/io/trino/plugin/sqlserver/TestSqlServerClient.java` (modified, +44/-0)
```diff
@@ -15,28 +15,37 @@
 
 import io.trino.plugin.base.mapping.DefaultIdentifierMapping;
 import io.trino.plugin.jdbc.BaseJdbcConfig;
+import io.trino.plugin.jdbc.CaseSensitivity;
 import io.trino.plugin.jdbc.ColumnMapping;
 import io.trino.plugin.jdbc.DefaultQueryBuilder;
 import io.trino.plugin.jdbc.JdbcClient;
 import io.trino.plugin.jdbc.JdbcColumnHandle;
 import io.trino.plugin.jdbc.JdbcExpression;
+import io.trino.plugin.jdbc.JdbcJoinCondition;
 import io.trino.plugin.jdbc.JdbcStatisticsConfig;
 import io.trino.plugin.jdbc.JdbcTypeHandle;
 import io.trino.plugin.jdbc.logging.RemoteQueryModifier;
 import io.trino.spi.connector.AggregateFunction;
 import io.trino.spi.connector.ColumnHandle;
 import io.trino.spi.expression.ConnectorExpression;
 import io.trino.spi.expression.Variable;
+import io.trino.spi.type.CharType;
+import io.trino.spi.type.Type;
 import org.junit.jupiter.api.Test;
 
 import java.sql.Types;
 import java.util.List;
 import java.util.Map;
 import java.util.Optional;
 
+import static io.trino.plugin.jdbc.CaseSensitivity.CASE_SENSITIVE;
+import static io.trino.spi.connector.JoinCondition.Operator.EQUAL;
+import static io.trino.spi.connector.JoinCondition.Operator.NOT_EQUAL;
 import static io.trino.spi.type.BigintType.BIGINT;
 import static io.trino.spi.type.BooleanType.BOOLEAN;
+import static io.trino.spi.type.CharType.createCharType;
 import static io.trino.spi.type.DoubleType.DOUBLE;
+import static io.trino.spi.type.VarcharType.createVarcharType;
 import static io.trino.testing.TestingConnectorSession.SESSION;
 import static io.trino.type.InternalTypeManager.TESTING_TYPE_MANAGER;
 import static org.assertj.core.api.Assertions.assertThat;
@@ -68,6 +77,41 @@ public class TestSqlServerClient
             new DefaultIdentifierMapping(),
             RemoteQueryModifier.NONE);
 
+    private static JdbcColumnHandle characterColumn(String name, Type type, CaseSensitivity caseSensitivity)
+    {
+        return JdbcColumnHandle.builder()
+                .setColumnName(name)
+                .setColumnType(type)
+                .setJdbcTypeHandle(new JdbcTypeHandle(
+                        type instanceof CharType ? Types.CHAR : Types.VARCHAR,
+                        Optional.of(type instanceof CharType ? "char" : "varchar"),
+                        Optional.of(10),
+                        Optional.empty(),
+                        Optional.empty(),
+                        Optional.of(caseSensitivity)))
+                .build();
+    }
+
+    @Test
+    public void testVarcharEqualityJoinPushdownDisabledUnderPadSpace()
+    {
+        SqlServerClient client = (SqlServerClient) JDBC_CLIENT;
+        JdbcColumnHandle varcharColumn = characterColumn("v", createVarcharType(10), CASE_SENSITIVE);
+
+        assertThat(client.isSupportedJoinCondition(SESSION, new JdbcJoinCondition(varcharColumn, EQUAL, varcharColumn))).isFalse();
+        assertThat(client.isSupportedJoinCondition(SESSION, new JdbcJoinCondition(varcharColumn, NOT_EQUAL, varcharColumn))).isFalse();
+    }
+
+    @Test
+    public void testCharEqualityJoinPushdownEnabledUnderCaseSensitiveCollation()
+    {
+        SqlServerClient client = (SqlServerClient) JDBC_CLIENT;
+        JdbcColumnHandle charColumn = characterColumn("c", createCharType(10), CASE_SENSITIVE);
+
+        assertThat(client.isSupportedJoinCondition(SESSION, new JdbcJoinCondition(charColumn, EQUAL, charColumn))).isTrue();
+        assertThat(client.isSupportedJoinCondition(SESSION, new JdbcJoinCondition(charColumn, NOT_EQUAL, charColumn))).isTrue();
+    }
+
     @Test
     public void testImplementCount()
     {
```

---

### Incident Patch 11: `05b9fd9a` (2026-09-30)
**Commit Message**: Fix Iceberg equality deletes on keys nested in a row column

A key nested in a row column was read as NULL, so a delete file with
several keys deleted every older row in the partition.

**File**: `plugin/trino-iceberg/src/main/java/io/trino/plugin/iceberg/IcebergPageSourceProvider.java` (modified, +12/-4)
```diff
@@ -209,6 +209,7 @@
 import static io.trino.plugin.iceberg.IcebergUtil.getColumnHandle;
 import static io.trino.plugin.iceberg.IcebergUtil.getPartitionKeys;
 import static io.trino.plugin.iceberg.IcebergUtil.getPartitionValues;
+import static io.trino.plugin.iceberg.IcebergUtil.getProjectedColumns;
 import static io.trino.plugin.iceberg.IcebergUtil.schemaFromHandles;
 import static io.trino.plugin.iceberg.util.OrcIcebergIds.fileColumnsByIcebergId;
 import static io.trino.plugin.iceberg.util.OrcTypeConverter.ORC_ICEBERG_ID_KEY;
@@ -413,8 +414,12 @@ public ConnectorPageSource createPageSource(
         List<IcebergColumnHandle> requiredColumns = new ArrayList<>(icebergColumns);
 
         Set<IcebergColumnHandle> deleteFilterRequiredColumns = requiredColumnsForDeletes(tableSchema, deletes);
+        // compare by field id not handle; IcebergColumnHandle can differ when fields have comments
+        Set<Integer> projectedIds = icebergColumns.stream()
+                .map(IcebergColumnHandle::getId)
+                .collect(toImmutableSet());
         deleteFilterRequiredColumns.stream()
-                .filter(not(icebergColumns::contains))
+                .filter(column -> !projectedIds.contains(column.getId()))
                 .forEach(requiredColumns::add);
 
         Optional<FileDecryptionProperties> parquetFileDecryptionProperties = createParquetFileDecryptionProperties(parquetFileDecryptionData, arePlaintextFilesAllowedForEncryptedTables(session));
@@ -560,16 +565,19 @@ private TupleDomain<IcebergColumnHandle> prunePredicate(
     private Set<IcebergColumnHandle> requiredColumnsForDeletes(Schema schema, List<DeleteFile> deletes)
     {
         ImmutableSet.Builder<IcebergColumnHandle> requiredColumns = ImmutableSet.builder();
+        ImmutableSet.Builder<Integer> equalityFieldIds = ImmutableSet.builder();
         for (DeleteFile deleteFile : deletes) {
             if (deleteFile.content() == POSITION_DELETES) {
                 requiredColumns.add(getColumnHandle(ROW_POSITION, typeManager));
             }
             else if (deleteFile.content() == EQUALITY_DELETES) {
-                deleteFile.equalityFieldIds().stream()
-                        .map(id -> getColumnHandle(schema.findField(id), typeManager))
-                        .forEach(requiredColumns::add);
+                equalityFieldIds.addAll(deleteFile.equalityFieldIds());
             }
         }
+        Set<Integer> fieldIds = equalityFieldIds.build();
+        if (!fieldIds.isEmpty()) {
+            requiredColumns.addAll(getProjectedColumns(schema, typeManager, fieldIds));
+        }
 
         return requiredColumns.build();
     }
```

**File**: `plugin/trino-iceberg/src/main/java/io/trino/plugin/iceberg/delete/DeleteManager.java` (modified, +8/-16)
```diff
@@ -15,13 +15,13 @@
 
 import com.google.common.base.VerifyException;
 import com.google.common.collect.ImmutableList;
+import com.google.common.collect.ImmutableSet;
 import com.google.common.util.concurrent.Futures;
 import com.google.common.util.concurrent.ListenableFuture;
 import io.trino.plugin.iceberg.IcebergColumnHandle;
 import io.trino.spi.BlocksHashFactory;
 import io.trino.spi.TrinoException;
 import io.trino.spi.connector.MemoryContext;
-import io.trino.spi.type.Type;
 import io.trino.spi.type.TypeManager;
 import org.apache.iceberg.Schema;
 
@@ -37,11 +37,9 @@
 import java.util.stream.IntStream;
 
 import static com.google.common.base.Verify.verify;
-import static com.google.common.collect.ImmutableList.toImmutableList;
 import static com.google.common.collect.MoreCollectors.onlyElement;
 import static io.trino.plugin.iceberg.IcebergErrorCode.ICEBERG_BAD_DATA;
-import static io.trino.plugin.iceberg.IcebergUtil.getColumnHandle;
-import static io.trino.plugin.iceberg.IcebergUtil.schemaFromHandles;
+import static io.trino.plugin.iceberg.IcebergUtil.getProjectedColumns;
 import static io.trino.spi.type.BigintType.BIGINT;
 import static java.util.Objects.requireNonNull;
 import static java.util.concurrent.Future.State.SUCCESS;
@@ -162,20 +160,14 @@ private List<EqualityDeleteFilter> createEqualityDeleteFilter(List<DeleteFile> e
         for (DeleteFile deleteFile : equalityDeleteFiles) {
             List<Integer> fieldIds = deleteFile.equalityFieldIds();
             verify(!fieldIds.isEmpty(), "equality field IDs are missing");
-            List<IcebergColumnHandle> deleteColumns = fieldIds.stream()
-                    .map(id -> getColumnHandle(schema.findField(id), typeManager))
-                    .collect(toImmutableList());
-
-            // each file can have a different set of columns for the equality delete, so we need to create a new builder for each set of columns
-            EqualityDeleteFilterBuilder builder = equalityDeleteFiltersBySchema.computeIfAbsent(fieldIds, _ -> {
-                List<Type> deleteTypes = deleteColumns.stream()
-                        .map(IcebergColumnHandle::getType)
-                        .collect(toImmutableList());
-                return EqualityDeleteFilter.builder(schemaFromHandles(deleteColumns), deleteTypes, blocksHashFactory);
-            });
+            // each file can have a different set of columns for the equality delete, so we need to create a new builder for each set of columns;
+            // the key fields are projected themselves, so a key nested in a row column is read through a dereference
+            EqualityDeleteFilterBuilder builder = equalityDeleteFiltersBySchema.computeIfAbsent(
+                    fieldIds,
+                    _ -> EqualityDeleteFilter.builder(getProjectedColumns(schema, typeManager, ImmutableSet.copyOf(fieldIds)), blocksHashFactory));
             deleteFilters.add(builder);
 
-            ListenableFuture<?> loadFuture = builder.readEqualityDeletes(deleteFile, deleteColumns, deletePageSourceProvider);
+            ListenableFuture<?> loadFuture = builder.readEqualityDeletes(deleteFile, deletePageSourceProvider);
             if (loadFuture.state() != SUCCESS) {
                 pendingLoads.add(loadFuture);
             }
```

**File**: `plugin/trino-iceberg/src/main/java/io/trino/plugin/iceberg/delete/EqualityDeleteFilter.java` (modified, +25/-32)
```diff
@@ -13,6 +13,7 @@
  */
 package io.trino.plugin.iceberg.delete;
 
+import com.google.common.collect.ImmutableList;
 import com.google.common.util.concurrent.Futures;
 import com.google.common.util.concurrent.ListenableFuture;
 import com.google.common.util.concurrent.ListenableFutureTask;
@@ -27,7 +28,6 @@
 import io.trino.spi.predicate.TupleDomain;
 import io.trino.spi.type.Type;
 import it.unimi.dsi.fastutil.longs.LongArrayList;
-import org.apache.iceberg.Schema;
 
 import java.io.IOException;
 import java.io.UncheckedIOException;
@@ -38,7 +38,7 @@
 import java.util.concurrent.locks.ReadWriteLock;
 import java.util.concurrent.locks.ReentrantReadWriteLock;
 
-import static com.google.common.base.Verify.verify;
+import static com.google.common.collect.ImmutableList.toImmutableList;
 import static io.airlift.slice.SizeOf.instanceSize;
 import static io.airlift.slice.SizeOf.sizeOf;
 import static io.trino.plugin.iceberg.IcebergErrorCode.ICEBERG_CANNOT_OPEN_SPLIT;
@@ -47,39 +47,31 @@
 
 public final class EqualityDeleteFilter
 {
-    private final Schema deleteSchema;
+    private final List<Integer> deleteFieldIds;
     private final EqualityDeleteIndex index;
 
-    private EqualityDeleteFilter(Schema deleteSchema, EqualityDeleteIndex index)
+    private EqualityDeleteFilter(List<Integer> deleteFieldIds, EqualityDeleteIndex index)
     {
-        this.deleteSchema = requireNonNull(deleteSchema, "deleteSchema is null");
+        this.deleteFieldIds = requireNonNull(deleteFieldIds, "deleteFieldIds is null");
         this.index = requireNonNull(index, "index is null");
     }
 
     public PageFilter createPageFilter(List<IcebergColumnHandle> columns, long splitDataSequenceNumber)
     {
-        // Deduplicate by base column ID to handle nested field projections where multiple
-        // nested fields from the same base struct appear (e.g., root.a, root.b, root all reference base column "root")
-        // The base struct wins if it appears anywhere in the projections list.
-        Map<Integer, Integer> dataChannelsByBaseId = new HashMap<>();
+        // Key by the leaf field ID: a nested key field is read through its own dereference column
+        Map<Integer, Integer> dataChannelsByFieldId = new HashMap<>();
         for (int channel = 0; channel < columns.size(); channel++) {
             IcebergColumnHandle column = columns.get(channel);
             if (isMetadataColumnId(column.getId())) {
                 continue;
             }
-            int baseId = column.getBaseColumnIdentity().getId();
-            if (column.isBaseColumn()) {
-                dataChannelsByBaseId.put(baseId, channel);
-            }
-            else {
-                dataChannelsByBaseId.putIfAbsent(baseId, channel);
-            }
+            dataChannelsByFieldId.putIfAbsent(column.getId(), channel);
         }
         // map from delete schema channel to data page channel
-        int[] channels = new int[deleteSchema.columns().size()];
-        for (int deleteChannel = 0; deleteChannel < deleteSchema.columns().size(); deleteChannel++) {
-            int fieldId = deleteSchema.columns().get(deleteChannel).fieldId();
-            Integer channel = dataChannelsByBaseId.get(fieldId);
+        int[] channels = new int[deleteFieldIds.size()];
+        for (int deleteChannel = 0; deleteChannel < deleteFieldIds.size(); deleteChannel++) {
+            int fieldId = deleteFieldIds.get(deleteChannel);
+            Integer channel = dataChannelsByFieldId.get(fieldId);
             if (channel == null) {
                 throw new TrinoException(ICEBERG_CANNOT_OPEN_SPLIT, "columns list doesn't contain equality delete field ID %s".formatted(fieldId));
             }
@@ -113,9 +105,9 @@ public Positions filterPositions(SourcePage page, Positions positions)
         }
     }
 
-    public static EqualityDeleteFilterBuilder builder(Schema deleteSchema, List<Type> columnTypes, BlocksHashFactory blocksHashFactory)
+    public static EqualityDeleteFilterBuilder builder(List<IcebergColumnHandle> deleteColumns, BlocksHashFactory blocksHashFactory)
     {
-        return new FlatHashEqualityDeleteFilterBuilder(deleteSchema, columnTypes, blocksHashFactory);
+        return new FlatHashEqualityDeleteFilterBuilder(deleteColumns, blocksHashFactory);
     }
 
     /**
@@ -188,31 +180,32 @@ private static final class FlatHashEqualityDeleteFilterBuilder
         private static final int EXPECTED_SIZE = 1024;
         private static final boolean CACHE_HASH_VALUES = true;
 
-        private final Schema deleteSchema;
+        private final List<IcebergColumnHandle> deleteColumns;
         private final EqualityDeleteIndex index;
         private final Map<String, ListenableFutureTask<?>> loadingFiles = new ConcurrentHashMap<>();
 
-        private FlatHashEqualityDeleteFilterBuilder(Schema deleteSchema, List<Type> columnTypes, BlocksHashFactory blocksHashFactory)
+        private FlatHashEqualityDeleteFilterBuilder(List<IcebergColumnHandle> dele
```

**File**: `plugin/trino-iceberg/src/main/java/io/trino/plugin/iceberg/delete/EqualityDeleteFilterBuilder.java` (modified, +1/-4)
```diff
@@ -15,14 +15,11 @@
 
 import com.google.common.util.concurrent.ListenableFuture;
 import com.google.errorprone.annotations.ThreadSafe;
-import io.trino.plugin.iceberg.IcebergColumnHandle;
-
-import java.util.List;
 
 @ThreadSafe
 public interface EqualityDeleteFilterBuilder
 {
-    ListenableFuture<?> readEqualityDeletes(DeleteFile deleteFile, List<IcebergColumnHandle> deleteColumns, DeletePageSourceProvider deletePageSourceProvider);
+    ListenableFuture<?> readEqualityDeletes(DeleteFile deleteFile, DeletePageSourceProvider deletePageSourceProvider);
 
     /**
      * Builds the EqualityDeleteFilter.
```

**File**: `plugin/trino-iceberg/src/test/java/io/trino/plugin/iceberg/TestIcebergV2.java` (modified, +62/-0)
```diff
@@ -752,6 +752,68 @@ public void testMultipleEqualityDeletesWithNestedFields()
         }
     }
 
+    @Test
+    public void testEqualityDeletesWithDistinctNestedKeys()
+            throws Exception
+    {
+        try (TestTable table = newTrinoTable("test_equality_deletes_distinct_nested_keys_", "(id BIGINT, root ROW(nested BIGINT))")) {
+            String tableName = table.getName();
+            assertUpdate("INSERT INTO " + tableName + " VALUES (1, row(10)), (2, row(20)), (3, row(30))", 3);
+            Table icebergTable = loadTable(tableName);
+
+            Schema deleteRowSchema = icebergTable.schema().select("root.nested");
+            List<Integer> equalityFieldIds = ImmutableList.of(deleteRowSchema.findField("root.nested").fieldId());
+            for (long key : ImmutableList.of(20L, 30L)) {
+                Record nestedStruct = GenericRecord.create((Types.StructType) deleteRowSchema.findField("root").type());
+                nestedStruct.setField("nested", key);
+                writeEqualityDeleteToNationTableWithDeleteColumns(
+                        icebergTable,
+                        Optional.empty(),
+                        Optional.empty(),
+                        ImmutableMap.of("root", nestedStruct),
+                        deleteRowSchema,
+                        equalityFieldIds);
+            }
+
+            assertThat(query("SELECT id FROM " + tableName))
+                    .matches("VALUES BIGINT '1'");
+        }
+    }
+
+    @Test
+    public void testEqualityDeleteOnNestedKeyWithComment()
+            throws Exception
+    {
+        try (TestTable table = newTrinoTable("test_equality_delete_nested_key_with_comment_", "(id BIGINT, root ROW(nested BIGINT))")) {
+            String tableName = table.getName();
+            // the handle built for the equality delete key carries the field comment, the one built for the query projection does not
+            loadTable(tableName).updateSchema()
+                    .updateColumnDoc("root.nested", "key comment")
+                    .commit();
+            // single INSERT so both rows share one data file and the equality delete is applied to it
+            assertUpdate("INSERT INTO " + tableName + " VALUES (1, row(10)), (2, row(20))", 2);
+
+            Table icebergTable = loadTable(tableName);
+            Schema deleteRowSchema = icebergTable.schema().select("root.nested");
+            Record root = GenericRecord.create(deleteRowSchema.findField("root").type().asStructType());
+            root.setField("nested", 20L);
+            writeEqualityDeleteToNationTableWithDeleteColumns(
+                    icebergTable,
+                    Optional.empty(),
+                    Optional.empty(),
+                    ImmutableMap.of("root", root),
+                    deleteRowSchema,
+                    ImmutableList.of(deleteRowSchema.findField("root.nested").fieldId()));
+
+            assertThat(query("SELECT id FROM " + tableName))
+                    .matches("VALUES BIGINT '1'");
+            assertThat(query("SELECT root.nested FROM " + tableName))
+                    .matches("VALUES BIGINT '10'");
+            assertThat(query("SELECT id, root.nested FROM " + tableName))
+                    .matches("VALUES (BIGINT '1', BIGINT '10')");
+        }
+    }
+
     @Test
     public void testEqualityDeletesWithStructColumnAsKey()
             throws Exception
```

**File**: `plugin/trino-iceberg/src/test/java/io/trino/plugin/iceberg/delete/TestEqualityDeleteFilter.java` (modified, +20/-37)
```diff
@@ -31,12 +31,9 @@
 import io.trino.spi.connector.FixedPageSource;
 import io.trino.spi.connector.SourcePage;
 import io.trino.spi.type.RowType;
-import io.trino.spi.type.Type;
 import io.trino.spi.type.TypeOperators;
 import org.apache.iceberg.FileContent;
 import org.apache.iceberg.FileFormat;
-import org.apache.iceberg.Schema;
-import org.apache.iceberg.types.Types;
 import org.junit.jupiter.api.Test;
 
 import java.util.ArrayList;
@@ -71,12 +68,6 @@ class TestEqualityDeleteFilter
     private static final IcebergColumnHandle BIGINT_KEY_HANDLE = IcebergColumnHandle.optional(KEY_IDENTITY).columnType(BIGINT).build();
     private static final IcebergColumnHandle VALUE_HANDLE = IcebergColumnHandle.optional(VALUE_IDENTITY).columnType(BIGINT).build();
 
-    private static final Schema VARCHAR_KEY_SCHEMA = new Schema(optional(KEY_FIELD_ID, "key", Types.StringType.get()));
-    private static final Schema BIGINT_KEY_SCHEMA = new Schema(optional(KEY_FIELD_ID, "key", Types.LongType.get()));
-    private static final Schema TWO_COLUMN_SCHEMA = new Schema(
-            optional(KEY_FIELD_ID, "key", Types.StringType.get()),
-            optional(VALUE_FIELD_ID, "value", Types.LongType.get()));
-
     private static final BlocksHashFactory BLOCKS_HASH_FACTORY =
             new FlatHashStrategyCompiler(new TypeOperators(), new NullSafeHashCompiler(new TypeOperators())).createBlocksHashFactory();
 
@@ -89,7 +80,7 @@ class TestEqualityDeleteFilter
     @Test
     void testVarcharKeyDeletesMatchingRows()
     {
-        EqualityDeleteFilterBuilder builder = newBuilder(VARCHAR_KEY_SCHEMA, ImmutableList.of(VARCHAR));
+        EqualityDeleteFilterBuilder builder = newBuilder(VARCHAR_KEY_HANDLE);
         loadDeleteFile(builder, ImmutableList.of(VARCHAR_KEY_HANDLE), DELETE_FILE_SEQUENCE_NUMBER, varcharPage("key-1"));
 
         PageFilter predicate = builder.build().createPageFilter(
@@ -108,7 +99,7 @@ void testVarcharKeyDeletesMatchingRows()
     @Test
     void testBigintKeyDeletesMatchingRows()
     {
-        EqualityDeleteFilterBuilder builder = newBuilder(BIGINT_KEY_SCHEMA, ImmutableList.of(BIGINT));
+        EqualityDeleteFilterBuilder builder = newBuilder(BIGINT_KEY_HANDLE);
         loadDeleteFile(builder, ImmutableList.of(BIGINT_KEY_HANDLE), DELETE_FILE_SEQUENCE_NUMBER, bigintPage(42L));
 
         PageFilter predicate = builder.build().createPageFilter(
@@ -136,11 +127,8 @@ void testStructKeyDeletesMatchingRows()
         RowType rootRowType = RowType.rowType(RowType.field("a", VARCHAR), RowType.field("b", VARCHAR));
         IcebergColumnHandle rootHandle = IcebergColumnHandle.optional(rootIdentity).columnType(rootRowType).build();
         IcebergColumnHandle rootBHandle = IcebergColumnHandle.optional(rootIdentity).fieldType(rootRowType, VARCHAR).path(rootBFieldId).build();
-        Schema rootKeySchema = new Schema(optional(rootFieldId, "root", Types.StructType.of(
-                optional(rootAFieldId, "a", Types.StringType.get()),
-                optional(rootBFieldId, "b", Types.StringType.get()))));
 
-        EqualityDeleteFilterBuilder builder = newBuilder(rootKeySchema, ImmutableList.of(rootRowType));
+        EqualityDeleteFilterBuilder builder = newBuilder(rootHandle);
         loadDeleteFile(builder, ImmutableList.of(rootHandle), DELETE_FILE_SEQUENCE_NUMBER, new Page(rowBlock(new String[][] {{"x2", "y2"}})));
         EqualityDeleteFilter filter = builder.build();
 
@@ -165,7 +153,7 @@ void testStructKeyDeletesMatchingRows()
     @Test
     void testMultiColumnKeyRequiresBothColumnsToMatch()
     {
-        EqualityDeleteFilterBuilder builder = newBuilder(TWO_COLUMN_SCHEMA, ImmutableList.of(VARCHAR, BIGINT));
+        EqualityDeleteFilterBuilder builder = newBuilder(VARCHAR_KEY_HANDLE, VALUE_HANDLE);
 
         Page deleteRows = new Page(varcharBlock("key-1"), bigintBlock(10L));
         loadDeleteFile(
@@ -194,7 +182,7 @@ void testMultiColumnKeyRequiresBothColumnsToMatch()
     @Test
     void testNonMatchingRowsAreNotDeleted()
     {
-        EqualityDeleteFilterBuilder builder = newBuilder(VARCHAR_KEY_SCHEMA, ImmutableList.of(VARCHAR));
+        EqualityDeleteFilterBuilder builder = newBuilder(VARCHAR_KEY_HANDLE);
         loadDeleteFile(builder, ImmutableList.of(VARCHAR_KEY_HANDLE), DELETE_FILE_SEQUENCE_NUMBER, varcharPage("key-deleted"));
 
         PageFilter predicate = builder.build().createPageFilter(
@@ -209,7 +197,7 @@ void testNonMatchingRowsAreNotDeleted()
     @Test
     void testNullKeyDeletesNullRow()
     {
-        EqualityDeleteFilterBuilder builder = newBuilder(VARCHAR_KEY_SCHEMA, ImmutableList.of(VARCHAR));
+        EqualityDeleteFilterBuilder builder = newBuilder(VARCHAR_KEY_HANDLE);
         loadDeleteFile(builder, ImmutableList.of(VARCHAR_KEY_HANDLE), DELETE_FILE_SEQUENCE_NUMBER, varcharPageWithNulls((String) null));
 
         PageFilter predicate = builder.build().createPageFilter(
@@ -225,7 +213,7 @@ void testNullKeyDeletesNullRow()
     @Test
     void testDeleteApplies
```

---

### Incident Patch 12: `48f41005` (2026-09-03)
**Commit Message**: Fix filtering of extended CASE with NULL operand

SimplifyFilterPredicate assumed a Match with a NULL operand always
selects its default. Extended CASE clauses can match NULL, so remove
that shortcut and leave clause evaluation to expression rules.

**File**: `core/trino-main/src/main/java/io/trino/sql/planner/iterative/rule/SimplifyFilterPredicate.java` (modified, +2/-8)
```diff
@@ -210,19 +210,13 @@ private Optional<Expression> simplify(Session session, Case caseExpression)
 
     private static Optional<Expression> simplify(Match caseExpression)
     {
-        Optional<Expression> defaultValue = Optional.of(caseExpression.defaultValue());
-
-        if (caseExpression.operand() instanceof Constant literal && literal.value() == null) {
-            return defaultValue;
-        }
-
         List<Expression> results = caseExpression.clauses().stream()
                 .map(MatchClause::result)
                 .collect(toImmutableList());
-        if (results.stream().allMatch(result -> result.equals(TRUE)) && defaultValue.get().equals(TRUE)) {
+        if (results.stream().allMatch(result -> result.equals(TRUE)) && caseExpression.defaultValue().equals(TRUE)) {
             return Optional.of(TRUE);
         }
-        if (results.stream().allMatch(SimplifyFilterPredicate::isNotTrue) && isNotTrue(defaultValue.get())) {
+        if (results.stream().allMatch(SimplifyFilterPredicate::isNotTrue) && isNotTrue(caseExpression.defaultValue())) {
             return Optional.of(FALSE);
         }
         return Optional.empty();
```

**File**: `core/trino-main/src/test/java/io/trino/sql/planner/iterative/rule/TestSimplifyFilterPredicate.java` (modified, +25/-10)
```diff
@@ -25,6 +25,7 @@
 import io.trino.sql.ir.Constant;
 import io.trino.sql.ir.Expression;
 import io.trino.sql.ir.IrExpressions;
+import io.trino.sql.ir.Lambda;
 import io.trino.sql.ir.Logical;
 import io.trino.sql.ir.Match;
 import io.trino.sql.ir.MatchClause;
@@ -398,6 +399,26 @@ public void testSimplifySearchedCaseExpression()
                 .doesNotFire();
     }
 
+    @Test
+    public void testNullOperandCanMatch()
+    {
+        Symbol operand = new Symbol(INTEGER, "operand");
+        // an extended CASE predicate, unlike a bare-equality one, can be true for a NULL operand
+        Lambda matchesNull = new Lambda(ImmutableList.of(operand), comparison(IDENTICAL, operand.toSymbolReference(), new Reference(INTEGER, "a")));
+
+        tester().assertThat(new SimplifyFilterPredicate(FUNCTIONS.getMetadata()))
+                .on(p -> p.filter(
+                        new Match(new Constant(INTEGER, null), ImmutableList.of(new MatchClause(matchesNull, TRUE)), FALSE),
+                        p.values(p.symbol("a", INTEGER))))
+                .doesNotFire();
+
+        tester().assertThat(new SimplifyFilterPredicate(FUNCTIONS.getMetadata()))
+                .on(p -> p.filter(
+                        new Match(new Constant(INTEGER, null), ImmutableList.of(new MatchClause(matchesNull, FALSE)), TRUE),
+                        p.values(p.symbol("a", INTEGER))))
+                .doesNotFire();
+    }
+
     @Test
     public void testSimplifySimpleCaseExpression()
     {
@@ -412,7 +433,7 @@ public void testSimplifySimpleCaseExpression()
                         p.values(p.symbol("a"), p.symbol("b"))))
                 .doesNotFire();
 
-        // comparison with null returns null - no WHEN branch matches, return default value
+        // The rule does not evaluate clause predicates even when the operand is NULL
         tester().assertThat(new SimplifyFilterPredicate(FUNCTIONS.getMetadata()))
                 .on(p -> p.filter(
                         new Match(
@@ -422,12 +443,9 @@ public void testSimplifySimpleCaseExpression()
                                         equalityClause(new Reference(BOOLEAN, "a"), FALSE)),
                                 new Reference(BOOLEAN, "b")),
                         p.values(p.symbol("a"), p.symbol("b"))))
-                .matches(
-                        filter(
-                                new Reference(BOOLEAN, "b"),
-                                values("a", "b")));
+                .doesNotFire();
 
-        // comparison with null returns null - no WHEN branch matches, the result is default null, simplified to FALSE
+        // Evaluating NULL-rejecting predicates belongs to expression rules
         tester().assertThat(new SimplifyFilterPredicate(FUNCTIONS.getMetadata()))
                 .on(p -> p.filter(
                         new Match(
@@ -437,10 +455,7 @@ public void testSimplifySimpleCaseExpression()
                                         equalityClause(new Reference(BOOLEAN, "a"), FALSE)),
                                 NULL_BOOLEAN),
                         p.values(p.symbol("a"))))
-                .matches(
-                        filter(
-                                FALSE,
-                                values("a")));
+                .doesNotFire();
 
         // all results true
         tester().assertThat(new SimplifyFilterPredicate(FUNCTIONS.getMetadata()))
```

**File**: `core/trino-main/src/test/java/io/trino/sql/query/TestExtendedCase.java` (modified, +67/-0)
```diff
@@ -220,6 +220,73 @@ WHEN IS NOT DISTINCT FROM CAST(NULL AS integer) THEN 1
                 .matches("VALUES 1, 2, 1");
     }
 
+    @Test
+    public void testNullOperandInFilter()
+    {
+        assertThat(assertions.query(
+                """
+                SELECT x
+                FROM UNNEST(ARRAY[NULL, 1]) t(x)
+                WHERE CASE CAST(NULL AS integer) WHEN IS NOT DISTINCT FROM x THEN true ELSE false END
+                """))
+                .matches("VALUES CAST(NULL AS integer)");
+    }
+
+    @Test
+    public void testNullOperandInFilterWithTrueDefault()
+    {
+        assertThat(assertions.query(
+                """
+                SELECT x
+                FROM UNNEST(ARRAY[NULL, 1]) t(x)
+                WHERE CASE CAST(NULL AS integer) WHEN IS NOT DISTINCT FROM x THEN false ELSE true END
+                """))
+                .matches("VALUES 1");
+    }
+
+    @Test
+    public void testNullOperandInFilterWithPrecedingClause()
+    {
+        assertThat(assertions.query(
+                """
+                SELECT x
+                FROM UNNEST(ARRAY[NULL, 1]) t(x)
+                WHERE CASE CAST(NULL AS integer)
+                          WHEN 1 THEN false
+                          WHEN IS NOT DISTINCT FROM x THEN true
+                          ELSE false
+                      END
+                """))
+                .matches("VALUES CAST(NULL AS integer)");
+    }
+
+    @Test
+    public void testNullOperandControls()
+    {
+        assertThat(assertions.query(
+                """
+                SELECT x, CASE CAST(NULL AS integer) WHEN IS NOT DISTINCT FROM x THEN true ELSE false END
+                FROM UNNEST(ARRAY[NULL, 1]) t(x)
+                """))
+                .matches("VALUES (CAST(NULL AS integer), true), (1, false)");
+
+        assertThat(assertions.query(
+                """
+                SELECT x
+                FROM UNNEST(ARRAY[NULL, 1]) t(x)
+                WHERE CASE WHEN CAST(NULL AS integer) IS NOT DISTINCT FROM x THEN true ELSE false END
+                """))
+                .matches("VALUES CAST(NULL AS integer)");
+
+        assertThat(assertions.query(
+                """
+                SELECT x
+                FROM UNNEST(ARRAY[NULL, 1]) t(x)
+                WHERE CASE CAST(NULL AS integer) WHEN x THEN false ELSE true END
+                """))
+                .matches("VALUES CAST(NULL AS integer), 1");
+    }
+
     @Test
     public void testTypeReconciliation()
     {
```

---

### Incident Patch 13: `81a4cca3` (2026-10-01)
**Commit Message**: Fix flaky SHOW SCHEMAS test in Faker

Also, extract a test method.

**File**: `plugin/trino-faker/src/test/java/io/trino/plugin/faker/TestFakerQueries.java` (modified, +8/-1)
```diff
@@ -41,10 +41,17 @@ protected QueryRunner createQueryRunner()
         return FakerQueryRunner.builder().build();
     }
 
+    @Test
+    void testShowSchemas()
+    {
+        // Using 'contains' method because other tests may create schemas concurrently
+        assertThat(computeActual("SHOW SCHEMAS FROM faker").getOnlyColumnAsSet())
+                .contains("default", "information_schema");
+    }
+
     @Test
     void testShowTables()
     {
-        assertQuery("SHOW SCHEMAS FROM faker", "VALUES 'default', 'information_schema'");
         assertUpdate("CREATE TABLE faker.default.test (id INTEGER, name VARCHAR)");
         assertTableColumnNames("faker.default.test", "id", "name");
     }
```

---

### Incident Patch 14: `ae6bc2eb` (2026-09-09)
**Commit Message**: Fix time zone of Parquet INT64 timestamp statistics

Pruning dropped matching rows when the reader time zone was not UTC.

**File**: `lib/trino-parquet/src/main/java/io/trino/parquet/predicate/TupleDomainParquetPredicate.java` (modified, +17/-6)
```diff
@@ -23,6 +23,7 @@
 import io.trino.parquet.ParquetCorruptionException;
 import io.trino.parquet.ParquetDataSourceId;
 import io.trino.parquet.dictionary.Dictionary;
+import io.trino.plugin.base.type.DecodedTimestamp;
 import io.trino.plugin.base.type.TrinoTimestampEncoder;
 import io.trino.spi.predicate.Domain;
 import io.trino.spi.predicate.SortedRangeSet;
@@ -81,6 +82,7 @@
 import static io.trino.spi.type.IntegerType.INTEGER;
 import static io.trino.spi.type.RealType.REAL;
 import static io.trino.spi.type.SmallintType.SMALLINT;
+import static io.trino.spi.type.Timestamps.MILLISECONDS_PER_SECOND;
 import static io.trino.spi.type.TinyintType.TINYINT;
 import static java.lang.Float.floatToRawIntBits;
 import static java.lang.Float.intBitsToFloat;
@@ -474,16 +476,25 @@ private static Domain getDomain(
                 if (timestampTypeAnnotation.getUnit() == null) {
                     return Domain.create(ValueSet.all(type), hasNullValue);
                 }
-                TrinoTimestampEncoder<?> timestampEncoder = createTimestampEncoder(timestampType, DateTimeZone.UTC);
+                // Match ColumnReaderFactory: adjusted-to-UTC values are shifted into the configured zone, others are read verbatim
+                DateTimeZone statisticsTimeZone = timestampTypeAnnotation.isAdjustedToUTC() ? timeZone : DateTimeZone.UTC;
+                TrinoTimestampEncoder<?> timestampEncoder = createTimestampEncoder(timestampType, statisticsTimeZone);
 
                 SortedRangeSet.Builder rangesBuilder = SortedRangeSet.builder(type, minimums.size());
                 for (int i = 0; i < minimums.size(); i++) {
-                    long min = (long) minimums.get(i);
-                    long max = (long) maximums.get(i);
+                    DecodedTimestamp min = decodeInt64Timestamp((long) minimums.get(i), timestampTypeAnnotation.getUnit());
+                    DecodedTimestamp max = decodeInt64Timestamp((long) maximums.get(i), timestampTypeAnnotation.getUnit());
+
+                    // Local time is not monotonic across an offset decrease, so a range that straddles a transition cannot be expressed as [convert(min), convert(max)]
+                    if (!statisticsTimeZone.isFixed()) {
+                        long minEpochMillis = min.epochSeconds() * MILLISECONDS_PER_SECOND;
+                        long nextTransition = statisticsTimeZone.nextTransition(minEpochMillis);
+                        if (nextTransition != minEpochMillis && nextTransition <= max.epochSeconds() * MILLISECONDS_PER_SECOND) {
+                            return Domain.create(ValueSet.all(type), hasNullValue);
+                        }
+                    }
 
-                    rangesBuilder.addRangeInclusive(
-                            timestampEncoder.getTimestamp(decodeInt64Timestamp(min, timestampTypeAnnotation.getUnit())),
-                            timestampEncoder.getTimestamp(decodeInt64Timestamp(max, timestampTypeAnnotation.getUnit())));
+                    rangesBuilder.addRangeInclusive(timestampEncoder.getTimestamp(min), timestampEncoder.getTimestamp(max));
                 }
                 return Domain.create(rangesBuilder.build(), hasNullValue);
             }
```

**File**: `lib/trino-parquet/src/test/java/io/trino/parquet/ParquetTestUtils.java` (modified, +18/-3)
```diff
@@ -152,6 +152,21 @@ public static ParquetReader createParquetReader(
             TupleDomain<String> predicate,
             boolean forceSelectedPositionsPushdown)
             throws IOException
+    {
+        return createParquetReader(input, parquetMetadata, options, memoryContext, types, columnNames, predicate, forceSelectedPositionsPushdown, UTC);
+    }
+
+    public static ParquetReader createParquetReader(
+            ParquetDataSource input,
+            ParquetMetadata parquetMetadata,
+            ParquetReaderOptions options,
+            AggregatedMemoryContext memoryContext,
+            List<Type> types,
+            List<String> columnNames,
+            TupleDomain<String> predicate,
+            boolean forceSelectedPositionsPushdown,
+            DateTimeZone timeZone)
+            throws IOException
     {
         FileMetadata fileMetaData = parquetMetadata.getFileMetaData();
         MessageType fileSchema = fileMetaData.getSchema();
@@ -168,7 +183,7 @@ public static ParquetReader createParquetReader(
         Map<List<String>, ColumnDescriptor> descriptorsByPath = getDescriptors(fileSchema, fileSchema);
         TupleDomain<ColumnDescriptor> parquetTupleDomain = predicate.transformKeys(
                 columnName -> descriptorsByPath.get(ImmutableList.of(columnName.toLowerCase(ENGLISH))));
-        TupleDomainParquetPredicate parquetPredicate = buildPredicate(fileSchema, parquetTupleDomain, descriptorsByPath, UTC);
+        TupleDomainParquetPredicate parquetPredicate = buildPredicate(fileSchema, parquetTupleDomain, descriptorsByPath, timeZone);
         List<RowGroupInfo> rowGroups = getFilteredRowGroups(
                 0,
                 input.getEstimatedSize(),
@@ -177,7 +192,7 @@ public static ParquetReader createParquetReader(
                 ImmutableList.of(parquetTupleDomain),
                 ImmutableList.of(parquetPredicate),
                 descriptorsByPath,
-                UTC,
+                timeZone,
                 1000,
                 options);
         return new ParquetReader(
@@ -186,7 +201,7 @@ public static ParquetReader createParquetReader(
                 false,
                 rowGroups,
                 input,
-                UTC,
+                timeZone,
                 memoryContext,
                 options,
                 exception -> {
```

**File**: `lib/trino-parquet/src/test/java/io/trino/parquet/TestTupleDomainParquetPredicate.java` (modified, +54/-0)
```diff
@@ -48,6 +48,7 @@
 import org.apache.parquet.schema.PrimitiveType;
 import org.apache.parquet.schema.PrimitiveType.PrimitiveTypeName;
 import org.apache.parquet.schema.Types;
+import org.joda.time.DateTimeZone;
 import org.junit.jupiter.api.Test;
 
 import java.io.ByteArrayOutputStream;
@@ -599,6 +600,59 @@ else if (baseDomainValue instanceof LongTimestamp longTimestamp) {
         assertThat(getDomain(columnDescriptor, timestampType, 10, longColumnStats(minValue, maxValue), ID, UTC)).isEqualTo(create(ValueSet.ofRanges(range(timestampType, baseDomainValue, true, maxDomainValue, true)), false));
     }
 
+    @Test
+    public void testTimestampInt64AdjustedToUtcUsesConfiguredTimeZoneForStatistics()
+            throws ParquetCorruptionException
+    {
+        DateTimeZone singapore = DateTimeZone.forID("Asia/Singapore"); // UTC+8, no DST transitions
+
+        PrimitiveType type = Types.required(INT64)
+                .as(LogicalTypeAnnotation.timestampType(true, TimeUnit.MICROS))
+                .named("TimestampColumn");
+        ColumnDescriptor columnDescriptor = new ColumnDescriptor(new String[] {}, type, 0, 0);
+        TimestampType timestampType = createTimestampType(6);
+
+        LocalDateTime utcInstant = LocalDateTime.of(2024, 1, 1, 0, 4, 50);
+        long minValue = toEpochWithPrecision(utcInstant, 6);
+        long maxValue = minValue + 50 * MICROSECONDS_PER_MILLISECOND;
+        LocalDateTime expectedWallClock = utcInstant.plusHours(8);
+        long expectedMinDomainValue = toEpochWithPrecision(expectedWallClock, 6);
+        long expectedMaxDomainValue = expectedMinDomainValue + 50 * MICROSECONDS_PER_MILLISECOND;
+
+        assertThat(getDomain(columnDescriptor, timestampType, 10, longColumnStats(minValue, maxValue), ID, singapore))
+                .isEqualTo(create(ValueSet.ofRanges(range(timestampType, expectedMinDomainValue, true, expectedMaxDomainValue, true)), false));
+        assertThat(getDomain(columnDescriptor, timestampType, 10, longColumnStats(minValue, maxValue), ID, UTC))
+                .isEqualTo(create(ValueSet.ofRanges(range(timestampType, minValue, true, maxValue, true)), false));
+    }
+
+    @Test
+    public void testTimestampInt64AdjustedToUtcAcrossDstFallbackTransitionIsUnbounded()
+            throws ParquetCorruptionException
+    {
+        DateTimeZone newYork = DateTimeZone.forID("America/New_York");
+
+        PrimitiveType type = Types.required(INT64)
+                .as(LogicalTypeAnnotation.timestampType(true, TimeUnit.MICROS))
+                .named("TimestampColumn");
+        ColumnDescriptor columnDescriptor = new ColumnDescriptor(new String[] {}, type, 0, 0);
+        TimestampType timestampType = createTimestampType(6);
+
+        // UTC instant of the America/New_York fall-back from UTC-4 to UTC-5
+        LocalDateTime transition = LocalDateTime.of(2024, 11, 3, 6, 0);
+        long minValue = toEpochWithPrecision(transition.minusMinutes(30), 6);
+        long maxValue = toEpochWithPrecision(transition.plusMinutes(30), 6);
+        assertThat(getDomain(columnDescriptor, timestampType, 10, longColumnStats(minValue, maxValue), ID, newYork))
+                .isEqualTo(create(ValueSet.all(timestampType), false));
+
+        LocalDateTime laterInstant = transition.plusDays(60);
+        long laterMinValue = toEpochWithPrecision(laterInstant, 6);
+        long laterMaxValue = laterMinValue + 50 * MICROSECONDS_PER_MILLISECOND;
+        long expectedMinDomainValue = toEpochWithPrecision(laterInstant.minusHours(5), 6);
+        long expectedMaxDomainValue = expectedMinDomainValue + 50 * MICROSECONDS_PER_MILLISECOND;
+        assertThat(getDomain(columnDescriptor, timestampType, 10, longColumnStats(laterMinValue, laterMaxValue), ID, newYork))
+                .isEqualTo(create(ValueSet.ofRanges(range(timestampType, expectedMinDomainValue, true, expectedMaxDomainValue, true)), false));
+    }
+
     private static long toEpochWithPrecision(LocalDateTime time, int precision)
     {
         long scaledEpochSeconds = time.toEpochSecond(ZoneOffset.UTC) * (long) Math.pow(10, precision);
```

**File**: `lib/trino-parquet/src/test/java/io/trino/parquet/reader/TestParquetReader.java` (modified, +78/-0)
```diff
@@ -15,6 +15,7 @@
 
 import com.google.common.collect.ImmutableList;
 import com.google.common.collect.ImmutableMap;
+import com.google.common.collect.ImmutableSet;
 import com.google.common.collect.ListMultimap;
 import com.google.common.io.Resources;
 import io.airlift.slice.Slice;
@@ -46,13 +47,23 @@
 import io.trino.spi.type.BooleanType;
 import io.trino.spi.type.Type;
 import org.apache.parquet.column.ColumnDescriptor;
+import org.apache.parquet.example.data.Group;
+import org.apache.parquet.example.data.simple.SimpleGroupFactory;
+import org.apache.parquet.hadoop.ParquetWriter;
+import org.apache.parquet.hadoop.example.ExampleParquetWriter;
+import org.apache.parquet.io.LocalOutputFile;
 import org.apache.parquet.io.MessageColumnIO;
 import org.apache.parquet.schema.MessageType;
+import org.apache.parquet.schema.Types;
+import org.joda.time.DateTimeZone;
 import org.junit.jupiter.api.Test;
+import org.junit.jupiter.api.io.TempDir;
 
 import java.io.File;
 import java.io.IOException;
 import java.net.URISyntaxException;
+import java.nio.file.Path;
+import java.time.Instant;
 import java.time.LocalDate;
 import java.util.ArrayList;
 import java.util.Arrays;
@@ -62,6 +73,7 @@
 import java.util.Optional;
 import java.util.stream.IntStream;
 
+import static com.google.common.collect.ImmutableList.toImmutableList;
 import static io.airlift.slice.Slices.utf8Slice;
 import static io.trino.memory.context.AggregatedMemoryContext.newSimpleAggregatedMemoryContext;
 import static io.trino.parquet.ParquetTestUtils.createArrayBlock;
@@ -80,13 +92,19 @@
 import static io.trino.spi.type.BigintType.BIGINT;
 import static io.trino.spi.type.DateType.DATE;
 import static io.trino.spi.type.IntegerType.INTEGER;
+import static io.trino.spi.type.TimestampType.TIMESTAMP_MILLIS;
 import static io.trino.spi.type.VarcharType.VARCHAR;
 import static java.lang.Math.min;
 import static java.lang.Math.toIntExact;
+import static java.util.concurrent.TimeUnit.MINUTES;
+import static org.apache.parquet.hadoop.ParquetFileWriter.Mode.OVERWRITE;
+import static org.apache.parquet.schema.LogicalTypeAnnotation.TimeUnit.MILLIS;
+import static org.apache.parquet.schema.LogicalTypeAnnotation.timestampType;
 import static org.apache.parquet.schema.PrimitiveType.PrimitiveTypeName.BINARY;
 import static org.apache.parquet.schema.PrimitiveType.PrimitiveTypeName.BOOLEAN;
 import static org.apache.parquet.schema.PrimitiveType.PrimitiveTypeName.FIXED_LEN_BYTE_ARRAY;
 import static org.apache.parquet.schema.PrimitiveType.PrimitiveTypeName.INT32;
+import static org.apache.parquet.schema.PrimitiveType.PrimitiveTypeName.INT64;
 import static org.assertj.core.api.Assertions.assertThat;
 import static org.assertj.core.api.Assertions.assertThatThrownBy;
 import static org.joda.time.DateTimeZone.UTC;
@@ -846,6 +864,66 @@ private static ParquetReader createFilteredParquetReader(File parquetFile, List<
                 predicate);
     }
 
+    @Test
+    public void testInt64TimestampAdjustedToUtcPredicateAcrossDstTransition(@TempDir Path directory)
+            throws IOException
+    {
+        MessageType schema = Types.buildMessage()
+                .required(INT64).as(timestampType(true, MILLIS)).named("ts")
+                .named("test");
+        int rowCount = 240;
+        Path file = directory.resolve("timestamps.parquet");
+        // One row per minute across the America/New_York fall-back transition at 2024-11-03T06:00Z
+        long startMillis = Instant.parse("2024-11-03T04:00:00Z").toEpochMilli();
+        ExampleParquetWriter.Builder builder = ExampleParquetWriter.builder(new LocalOutputFile(file))
+                .withType(schema)
+                .withWriteMode(OVERWRITE)
+                .withDictionaryEncoding(false)
+                .withRowGroupRowCountLimit(75)
+                .withPageRowCountLimit(10);
+        try (ParquetWriter<Group> writer = builder.build()) {
+            SimpleGroupFactory factory = new SimpleGroupFactory(schema);
+            for (int row = 0; row < rowCount; row++) {
+                writer.write(factory.newGroup().append("ts", startMillis + MINUTES.toMillis(row)));
+            }
+        }
+
+        DateTimeZone timeZone = DateTimeZone.forID("America/New_York");
+        List<Long> values = readTimestampValues(file, timeZone, TupleDomain.all());
+        assertThat(values).hasSize(rowCount);
+        for (long value : ImmutableSet.copyOf(values)) {
+            List<Long> expected = values.stream()
+                    .filter(candidate -> candidate == value)
+                    .collect(toImmutableList());
+            assertThat(readTimestampValues(file, timeZone, TupleDomain.withColumnDomains(ImmutableMap.of("ts", Domain.singleValue(TIMESTAMP_MILLIS, value)))))
+                    .filteredOn(candidate -> candidate == value)
+                    .isEqualTo(expected);
+        }
+    }
+
+    private static List<Long> readTimestampValues(Path file, DateTimeZone timeZone, TupleDomain<String> predicate
```

---

### Incident Patch 15: `738d178b` (2026-09-30)
**Commit Message**: Write not-null flag in FlatHashStrategyCompiler

**File**: `core/trino-main/src/main/java/io/trino/operator/FlatHashStrategyCompiler.java` (modified, +1/-0)
```diff
@@ -545,6 +545,7 @@ private static BytecodeNode writeFlatField(
             Parameter variableOffset)
     {
         BytecodeBlock writeNonNullFlat = new BytecodeBlock()
+                .append(fixedChunk.setElement(fieldIsNullOffset, constantInt(0).cast(byte.class)))
                 .append(invoke(
                         callSiteBinder.bind(keyField.writeFlatMethod()),
                         "writeFlat",
```

**File**: `core/trino-main/src/test/java/io/trino/operator/TestFlatHashStrategy.java` (modified, +3/-0)
```diff
@@ -80,6 +80,9 @@ void test()
 
                 byte[] fixedChunk = new byte[flatFixedLength + FIXED_CHUNK_OFFSET];
                 byte[] variableChunk = new byte[variableWidth + VARIABLE_CHUNK_OFFSET];
+                // Fill the region with bytes to assert that flat data works even with non-zeroed buffers
+                Arrays.fill(fixedChunk, FIXED_CHUNK_OFFSET, FIXED_CHUNK_OFFSET + flatFixedLength, (byte) 0xFF);
+                Arrays.fill(variableChunk, VARIABLE_CHUNK_OFFSET, VARIABLE_CHUNK_OFFSET + variableWidth, (byte) 0xFF);
                 flatHashStrategy.writeFlat(blocks, position, fixedChunk, FIXED_CHUNK_OFFSET, variableChunk, VARIABLE_CHUNK_OFFSET);
                 assertThat(fixedChunk).startsWith(new byte[FIXED_CHUNK_OFFSET]);
                 assertThat(variableChunk).startsWith(new byte[VARIABLE_CHUNK_OFFSET]);
```

#### Recent Merged Pull Requests:
- **PR #31447** (closed): Gn/topn dynamic filtering (@grantatspothero)
- **PR #31445** (2026-10-05): Bump org.codehaus.woodstox:stax2-api from 4.3.0 to 4.3.1 (@dependabot[bot])
- **PR #31444** (2026-10-05): Bump software.amazon.awssdk:bom from 2.55.5 to 2.55.6 (@dependabot[bot])
- **PR #31442** (2026-10-05): Bump org.apache.maven:maven-model from 3.9.16 to 3.10.0 (@dependabot[bot])
- **PR #31441** (2026-10-05): Bump at.yawk.lz4:lz4-java from 1.11.3 to 1.12.0 (@dependabot[bot])
- **PR #31440** (2026-10-05): Bump mongo-java.version from 5.12.0 to 5.13.0 (@dependabot[bot])
- **PR #31439** (closed): Bump com.h2database:h2 from 2.4.240 to 2.5.252 (@dependabot[bot])
- **PR #31438** (2026-10-05): Bump org.jdbi:jdbi3-bom from 3.54.0 to 3.55.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
