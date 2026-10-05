# Forensic Learning Record (Deep Inspection): trinodb/trino

> **Canonical Artifact**: `07_PROJECT_LEARNING/trinodb-trino-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/trinodb/trino](https://github.com/trinodb/trino))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:30:57.650Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `trinodb/trino`
- **Description**: Official repository of Trino, the distributed SQL query engine for big data, formerly known as PrestoSQL (https://trino.io)
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 13293 stars

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
                                    titl
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

### Incident Patch 1: `76a14518` (2026-09-30)
**Commit Message**: Fix stale null flag in TypedKeyValueHeap flat values

**File**: `core/trino-main/src/main/java/io/trino/operator/aggregation/AbstractMapAggregationState.java` (modified, +3/-4)
```diff
@@ -378,10 +378,9 @@ private void insert(int index, int groupId, ValueBlock keyBlock, int keyPosition
 
         try {
             keyWriteFlat.invokeExact(keyBlock, keyPosition, records, recordOffset + recordKeyOffset, variableWidthChunk, variableWidthChunkOffset);
-            if (valueBlock.isNull(valuePosition)) {
-                records[recordOffset + recordValueNullOffset] = 1;
-            }
-            else {
+            boolean valueIsNull = valueBlock.isNull(valuePosition);
+            records[recordOffset + recordValueNullOffset] = (byte) (valueIsNull ? 1 : 0);
+            if (!valueIsNull) {
                 valueWriteFlat.invokeExact(valueBlock, valuePosition, records, recordOffset + recordValueOffset, variableWidthChunk, variableWidthChunkOffset + keyVariableWidthSize);
             }
         }
```

**File**: `core/trino-main/src/main/java/io/trino/operator/aggregation/arrayagg/FlatArrayBuilder.java` (modified, +3/-2)
```diff
@@ -168,8 +168,9 @@ public void add(ValueBlock block, int position)
             LONG_HANDLE.set(records, recordOffset + recordNextIndexOffset, -1L);
         }
 
-        if (block.isNull(position)) {
-            records[recordOffset + recordNullOffset] = 1;
+        boolean valueIsNull = block.isNull(position);
+        records[recordOffset + recordNullOffset] = (byte) (valueIsNull ? 1 : 0);
+        if (valueIsNull) {
             return;
         }
 
```

**File**: `core/trino-main/src/main/java/io/trino/operator/aggregation/minmaxbyn/TypedKeyValueHeap.java` (modified, +3/-4)
```diff
@@ -294,10 +294,9 @@ private void set(int index, ValueBlock keyBlock, int keyPosition, ValueBlock val
             Throwables.throwIfUnchecked(throwable);
             throw new RuntimeException(throwable);
         }
-        if (valueBlock.isNull(valuePosition)) {
-            fixedChunk[recordOffset + recordValueNullOffset] = 1;
-        }
-        else {
+        boolean valueIsNull = valueBlock.isNull(valuePosition);
+        fixedChunk[recordOffset + recordValueNullOffset] = (byte) (valueIsNull ? 1 : 0);
+        if (!valueIsNull) {
             try {
                 valueWriteFlat.invokeExact(
                         valueBlock,
```

**File**: `core/trino-main/src/test/java/io/trino/sql/query/TestAggregation.java` (modified, +18/-0)
```diff
@@ -235,4 +235,22 @@ SELECT transform(
                 """))
                 .matches("VALUES ARRAY[ARRAY[VARCHAR '616161', VARCHAR 'D091D091', VARCHAR '656E64']]");
     }
+
+    @Test
+    void testMinMaxByNOverValueReplacingNull()
+    {
+        assertThat(assertions.query(
+                """
+                SELECT max_by(v, k, 1), min_by(v, k, 1)
+                FROM (VALUES (0, CAST(null AS varchar)), (1, 'x'), (-1, 'y')) t(k, v)
+                """))
+                .matches("VALUES (ARRAY[VARCHAR 'x'], ARRAY[VARCHAR 'y'])");
+
+        assertThat(assertions.query(
+                """
+                SELECT max_by(v, k, 1), min_by(v, k, 1)
+                FROM (VALUES (0, CAST(null AS bigint)), (1, 11), (-1, 22)) t(k, v)
+                """))
+                .matches("VALUES (ARRAY[BIGINT '11'], ARRAY[BIGINT '22'])");
+    }
 }
```

---

### Incident Patch 2: `8d583437` (2026-09-28)
**Commit Message**: Fix leaked temp tables on concurrent JDBC rollback

A query can be cancelled while the coordinator is still inside
beginCreateTable, beginInsert or beginMerge, creating temporary tables
and registering the rollback actions that drop them. The transaction
abort then runs rollback() on another thread, concurrently with the
ongoing begin call. An action registered while rollback() iterated the
list made the iterator throw ConcurrentModificationException, which
escaped rollback() and skipped the remaining actions. An action
registered after rollback() had finished was never executed. Either
way the temporary tables were leaked.

Guard the rollback actions with a lock and mark the metadata as rolled
back when rollback() starts. An action registered after that point is
executed immediately instead of being queued, so every registered
action runs exactly once.

**File**: `plugin/trino-base-jdbc/src/main/java/io/trino/plugin/jdbc/DefaultJdbcMetadata.java` (modified, +26/-8)
```diff
@@ -17,6 +17,7 @@
 import com.google.common.collect.ImmutableList;
 import com.google.common.collect.ImmutableMap;
 import com.google.common.collect.ImmutableSet;
+import com.google.errorprone.annotations.concurrent.GuardedBy;
 import io.airlift.slice.Slice;
 import io.trino.plugin.base.filter.UtcConstraintExtractor;
 import io.trino.plugin.base.filter.UtcConstraintExtractor.ExtractionResult;
@@ -137,7 +138,10 @@ public class DefaultJdbcMetadata
     private final boolean precalculateStatisticsForPushdown;
     private final Set<JdbcQueryEventListener> jdbcQueryEventListeners;
 
-    protected final List<Runnable> rollbackActions = new ArrayList<>();
+    @GuardedBy("this")
+    private final List<Runnable> rollbackActions = new ArrayList<>();
+    @GuardedBy("this")
+    private boolean rolledBack;
 
     public DefaultJdbcMetadata(
             JdbcClient jdbcClient,
@@ -1200,8 +1204,8 @@ public ConnectorOutputTableHandle beginCreateTable(ConnectorSession session, Con
         if (replace) {
             throw new TrinoException(NOT_SUPPORTED, "This connector does not support replacing tables");
         }
-        JdbcOutputTableHandle handle = jdbcClient.beginCreateTable(session, tableMetadata, rollbackActions::add);
-        rollbackActions.add(() -> jdbcClient.rollbackTemporaryTableCreation(session, handle));
+        JdbcOutputTableHandle handle = jdbcClient.beginCreateTable(session, tableMetadata, this::addRollbackAction);
+        addRollbackAction(() -> jdbcClient.rollbackTemporaryTableCreation(session, handle));
         return handle;
     }
 
@@ -1259,15 +1263,29 @@ private void onQueryEvent(Consumer<JdbcQueryEventListener> queryEventListenerCon
         }
     }
 
+    protected void addRollbackAction(Runnable action)
+    {
+        synchronized (this) {
+            if (!rolledBack) {
+                rollbackActions.add(action);
+                return;
+            }
+        }
+        // rollback() has already taken its snapshot and will never see this action
+        action.run();
+    }
+
     @Override
     public void rollback()
     {
-        if (rollbackActions.isEmpty()) {
-            return;
+        List<Runnable> actions;
+        synchronized (this) {
+            rolledBack = true;
+            actions = ImmutableList.copyOf(rollbackActions);
         }
 
         List<Throwable> exceptions = new ArrayList<>();
-        for (Runnable action : rollbackActions) {
+        for (Runnable action : actions) {
             try {
                 action.run();
             }
@@ -1291,7 +1309,7 @@ public ConnectorInsertTableHandle beginInsert(ConnectorSession session, Connecto
                 .map(JdbcColumnHandle.class::cast)
                 .collect(toImmutableList());
         JdbcOutputTableHandle handle = jdbcClient.beginInsertTable(session, (JdbcTableHandle) tableHandle, columnHandles);
-        rollbackActions.add(() -> jdbcClient.rollbackTemporaryTableCreation(session, handle));
+        addRollbackAction(() -> jdbcClient.rollbackTemporaryTableCreation(session, handle));
         return handle;
     }
 
@@ -1348,7 +1366,7 @@ public ConnectorMergeTableHandle beginMerge(ConnectorSession session, ConnectorT
         JdbcTableHandle handle = (JdbcTableHandle) tableHandle;
         checkArgument(handle.isNamedRelation(), "Merge target must be named relation table");
 
-        return jdbcClient.beginMerge(session, handle, updateColumnHandles, rollbackActions::add, retryMode);
+        return jdbcClient.beginMerge(session, handle, updateColumnHandles, this::addRollbackAction, retryMode);
     }
 
     @Override
```

**File**: `plugin/trino-base-jdbc/src/test/java/io/trino/plugin/jdbc/TestDefaultJdbcMetadata.java` (modified, +16/-0)
```diff
@@ -43,6 +43,7 @@
 import org.junit.jupiter.api.Test;
 import org.junit.jupiter.api.TestInstance;
 
+import java.util.ArrayList;
 import java.util.List;
 import java.util.Map;
 import java.util.Optional;
@@ -136,6 +137,21 @@ public void tearDown()
         database = null;
     }
 
+    @Test
+    public void testRollbackRunsEveryAction()
+    {
+        List<String> executed = new ArrayList<>();
+        metadata.addRollbackAction(() -> {
+            executed.add("before rollback");
+            metadata.addRollbackAction(() -> executed.add("during rollback"));
+        });
+
+        metadata.rollback();
+        metadata.addRollbackAction(() -> executed.add("after rollback"));
+
+        assertThat(executed).containsExactly("before rollback", "during rollback", "after rollback");
+    }
+
     @Test
     public void testListSchemaNames()
     {
```

**File**: `plugin/trino-ignite/src/main/java/io/trino/plugin/ignite/IgniteMetadata.java` (modified, +1/-1)
```diff
@@ -234,7 +234,7 @@ public ConnectorOutputTableHandle beginCreateTable(ConnectorSession session, Con
         if (replace) {
             throw new TrinoException(NOT_SUPPORTED, "This connector does not support replacing tables");
         }
-        return igniteClient.beginCreateTable(session, tableMetadata, rollbackActions::add);
+        return igniteClient.beginCreateTable(session, tableMetadata, this::addRollbackAction);
     }
 
     @Override
```

---

### Incident Patch 3: `2fbc3632` (2026-09-29)
**Commit Message**: Fix flaky TestQueuesDb.testUpdateSoftMemoryLimit

Cluster memory size reaches the resource group configuration manager
through an asynchronous listener, so a percentage soft memory limit may
briefly be computed from a stale pool size, e.g. before all nodes'
memory info has been fetched.

**File**: `testing/trino-tests/src/test/java/io/trino/execution/resourcegroups/db/TestQueuesDb.java` (modified, +7/-4)
```diff
@@ -392,10 +392,13 @@ public void testUpdateSoftMemoryLimit()
 
         dao.updateResourceGroup(2, "bi-${USER}", "100%", 3, 2, 2, null, null, null, null, null, null, 1L, TEST_ENVIRONMENT);
         dbConfigurationManager.load();
-        assertThat(manager.tryGetResourceGroupInfo(new ResourceGroupId(new ResourceGroupId("global"), "bi-user"))
-                .orElseThrow(() -> new IllegalStateException("Resource group not found"))
-                .softMemoryLimit()
-                .toBytes()).isEqualTo(queryRunner.getCoordinator().getClusterMemoryManager().getClusterMemoryBytes());
+        assertEventually(
+                new Duration(10, TimeUnit.SECONDS),
+                new Duration(100, TimeUnit.MILLISECONDS),
+                () -> assertThat(manager.tryGetResourceGroupInfo(new ResourceGroupId(new ResourceGroupId("global"), "bi-user"))
+                        .orElseThrow(() -> new IllegalStateException("Resource group not found"))
+                        .softMemoryLimit()
+                        .toBytes()).isEqualTo(queryRunner.getCoordinator().getClusterMemoryManager().getClusterMemoryBytes()));
 
         dao.updateResourceGroup(2, "bi-${USER}", "123MB", 3, 2, 2, null, null, null, null, null, null, 1L, TEST_ENVIRONMENT);
         dbConfigurationManager.load();
```

---

### Incident Patch 4: `82bd90d1` (2026-09-29)
**Commit Message**: Fix masking the real failure with NPE

**File**: `plugin/trino-exchange-filesystem/src/main/java/io/trino/plugin/exchange/filesystem/azure/AzureBlobFileSystemExchangeStorage.java` (modified, +15/-5)
```diff
@@ -71,6 +71,7 @@
 import reactor.netty.resources.ConnectionProvider;
 
 import java.io.IOException;
+import java.io.UncheckedIOException;
 import java.net.URI;
 import java.net.URISyntaxException;
 import java.nio.ByteBuffer;
@@ -479,7 +480,8 @@ private static boolean isDirectory(URI uri)
     }
 
     @ThreadSafe
-    private static class AzureExchangeStorageReader
+    @VisibleForTesting
+    static class AzureExchangeStorageReader
             implements ExchangeStorageReader
     {
         private static final int INSTANCE_SIZE = instanceSize(AzureExchangeStorageReader.class);
@@ -533,8 +535,11 @@ public synchronized Slice read()
             try {
                 getFutureValue(inProgressReadFuture);
             }
+            catch (UncheckedIOException e) {
+                throw e.getCause();
+            }
             catch (RuntimeException e) {
-                throw toReadFailure(e, currentFile.getFileUri());
+                throw new IOException(e);
             }
 
             if (sliceSize < 0) {
@@ -624,17 +629,18 @@ private void fillBuffer()
                     }
                 }
 
+                URI fileUri = currentFile.getFileUri();
                 BlockBlobAsyncClient blockBlobAsyncClient = blobServiceAsyncClient
-                        .getBlobContainerAsyncClient(getContainerName(currentFile.getFileUri()))
-                        .getBlobAsyncClient(getPath(currentFile.getFileUri()))
+                        .getBlobContainerAsyncClient(getContainerName(fileUri))
+                        .getBlobAsyncClient(getPath(fileUri))
                         .getBlockBlobAsyncClient();
                 for (int i = 0; i < readableBlocks && fileOffset < fileSize; ++i) {
                     int length = (int) min(blockSize, fileSize - fileOffset);
 
                     int finalBufferFill = bufferFill;
                     FluentFuture<Void> downloadFuture = FluentFuture.from(toListenableFuture(blockBlobAsyncClient.downloadStreamWithResponse(new BlobRange(fileOffset, (long) length), null, null, false).toFuture()))
                             .transformAsync(response -> toListenableFuture(response.getValue().collectList().toFuture()), directExecutor())
-                            .transform(byteBuffers -> {
+                            .<Void>transform(byteBuffers -> {
                                 int offset = finalBufferFill;
                                 for (ByteBuffer byteBuffer : byteBuffers) {
                                     int readableBytes = byteBuffer.remaining();
@@ -647,6 +653,10 @@ private void fillBuffer()
                                     offset += readableBytes;
                                 }
                                 return null;
+                            }, directExecutor())
+                            // A single buffer fill spans multiple files, so the failed file is only known when the request is issued
+                            .catching(RuntimeException.class, failure -> {
+                                throw new UncheckedIOException(toReadFailure(failure, fileUri));
                             }, directExecutor());
                     downloadFutures.add(downloadFuture);
                     bufferFill += length;
```

**File**: `plugin/trino-exchange-filesystem/src/main/java/io/trino/plugin/exchange/filesystem/s3/S3FileSystemExchangeStorage.java` (modified, +19/-5)
```diff
@@ -98,6 +98,7 @@
 import java.io.ByteArrayInputStream;
 import java.io.FileInputStream;
 import java.io.IOException;
+import java.io.UncheckedIOException;
 import java.net.URI;
 import java.net.URISyntaxException;
 import java.nio.charset.StandardCharsets;
@@ -530,7 +531,8 @@ private record S3SseContext(S3SseType sseType, Optional<String> sseKmsKeyId)
     }
 
     @ThreadSafe
-    private static class S3ExchangeStorageReader
+    @VisibleForTesting
+    static class S3ExchangeStorageReader
             implements ExchangeStorageReader
     {
         private static final int INSTANCE_SIZE = instanceSize(S3ExchangeStorageReader.class);
@@ -591,8 +593,11 @@ public synchronized Slice read()
             try {
                 getFutureValue(inProgressReadFuture);
             }
+            catch (UncheckedIOException e) {
+                throw e.getCause();
+            }
             catch (RuntimeException e) {
-                throw toReadFailure(e, currentFile.getFileUri());
+                throw new IOException(e);
             }
 
             if (sliceSize < 0) {
@@ -682,8 +687,9 @@ private void fillBuffer()
                     }
                 }
 
-                String key = keyFromUri(currentFile.getFileUri());
-                String bucketName = getBucketName(currentFile.getFileUri());
+                URI fileUri = currentFile.getFileUri();
+                String key = keyFromUri(fileUri);
+                String bucketName = getBucketName(fileUri);
                 for (int i = 0; i < readableParts && fileOffset < fileSize; ++i) {
                     int length = (int) min(partSize, fileSize - fileOffset);
 
@@ -698,7 +704,7 @@ private void fillBuffer()
                     stats.getGetObject().record(getObjectFuture);
                     stats.getGetObjectDataSizeInBytes().add(length);
                     recordDistributionMetric(getObjectFuture, s3GetObjectRequestsSuccessMetric, s3GetObjectRequestsFailedMetric);
-                    getObjectFutures.add(getObjectFuture);
+                    getObjectFutures.add(mapReadFailure(getObjectFuture, fileUri));
                     bufferFill += length;
                     fileOffset += length;
                 }
@@ -738,6 +744,14 @@ public void onFailure(Throwable t)
         }, directExecutor());
     }
 
+    // A single buffer fill spans multiple files, so the failed file is only known when the request is issued
+    private static <T> ListenableFuture<T> mapReadFailure(ListenableFuture<T> future, URI file)
+    {
+        return Futures.catching(future, RuntimeException.class, failure -> {
+            throw new UncheckedIOException(toReadFailure(failure, file));
+        }, directExecutor());
+    }
+
     @VisibleForTesting
     static IOException toReadFailure(RuntimeException failure, URI file)
     {
```

**File**: `plugin/trino-exchange-filesystem/src/test/java/io/trino/plugin/exchange/filesystem/AbstractTestExchangeManager.java` (modified, +46/-0)
```diff
@@ -22,7 +22,9 @@
 import io.airlift.slice.Slices;
 import io.airlift.units.DataSize;
 import io.opentelemetry.api.trace.Span;
+import io.trino.plugin.exchange.filesystem.FileSystemExchangeSourceHandle.SourceFile;
 import io.trino.spi.QueryId;
+import io.trino.spi.TrinoException;
 import io.trino.spi.exchange.Exchange;
 import io.trino.spi.exchange.ExchangeContext;
 import io.trino.spi.exchange.ExchangeId;
@@ -40,19 +42,22 @@
 import org.junit.jupiter.api.TestInstance;
 import org.junit.jupiter.api.parallel.Execution;
 
+import java.net.URI;
 import java.util.ArrayDeque;
 import java.util.List;
 import java.util.Map;
 import java.util.Queue;
 import java.util.function.Function;
 
+import static com.google.common.collect.ImmutableList.toImmutableList;
 import static com.google.common.collect.ImmutableListMultimap.toImmutableListMultimap;
 import static com.google.common.collect.ImmutableMap.toImmutableMap;
 import static io.airlift.concurrent.MoreFutures.getFutureValue;
 import static io.airlift.units.DataSize.Unit.BYTE;
 import static io.airlift.units.DataSize.Unit.KILOBYTE;
 import static io.airlift.units.DataSize.Unit.MEGABYTE;
 import static io.trino.plugin.exchange.filesystem.FileSystemExchangeErrorCode.MAX_OUTPUT_PARTITION_COUNT_EXCEEDED;
+import static io.trino.spi.StandardErrorCode.EXCHANGE_DATA_UNRECOVERABLE;
 import static io.trino.spi.exchange.ExchangeId.createRandomExchangeId;
 import static java.lang.Math.toIntExact;
 import static java.util.Objects.requireNonNull;
@@ -85,6 +90,9 @@ public void destroy()
 
     protected abstract ExchangeManager createExchangeManager();
 
+    protected abstract void deleteFile(URI file)
+            throws Exception;
+
     private record TestExchangeContext(ExchangeId exchangeId)
             implements ExchangeContext
     {
@@ -293,6 +301,44 @@ public void testLargePages()
         exchange.close();
     }
 
+    @Test
+    public void testMissingFileIsUnrecoverable()
+            throws Exception
+    {
+        ExchangeId exchangeId = createRandomExchangeId();
+        Exchange exchange = exchangeManager.createExchange(new TestExchangeContext(exchangeId), 1, false);
+        ExchangeSinkHandle sinkHandle0 = exchange.addSink(0);
+        ExchangeSinkHandle sinkHandle1 = exchange.addSink(1);
+        exchange.noMoreSinks();
+
+        writeData(exchange.instantiateSink(sinkHandle0, 0).get(), ImmutableListMultimap.of(0, "0-0-0"), true);
+        exchange.sinkFinished(sinkHandle0, 0);
+        writeData(exchange.instantiateSink(sinkHandle1, 0).get(), ImmutableListMultimap.of(0, "1-0-0"), true);
+        exchange.sinkFinished(sinkHandle1, 0);
+        exchange.allRequiredSinksFinished();
+
+        List<ExchangeSourceHandle> handles = exchange.getSourceHandles().getNextBatch().get().handles();
+        List<SourceFile> files = handles.stream()
+                .flatMap(handle -> ((FileSystemExchangeSourceHandle) handle).getFiles().stream())
+                .collect(toImmutableList());
+        assertThat(files).hasSize(2);
+        // Small files are read in a single buffer fill, losing the last one is the case where no current file is left
+        deleteFile(URI.create(files.getLast().getFilePath()));
+
+        ExchangeSourceOutputSelector outputSelector = ExchangeSourceOutputSelector.builder(ImmutableSet.of(exchangeId))
+                .include(exchangeId, 0, 0)
+                .include(exchangeId, 1, 0)
+                .setPartitionCount(exchangeId, 2)
+                .setFinal()
+                .build();
+        assertThatThrownBy(() -> readData(handles, outputSelector))
+                .isInstanceOfSatisfying(TrinoException.class, exception ->
+                        assertThat(exception.getErrorCode()).isEqualTo(EXCHANGE_DATA_UNRECOVERABLE.toErrorCode()))
+                .hasMessage("Exchange source data is gone");
+
+        exchange.close();
+    }
+
     @Test
     public void testMaxOutputPartitionCountCheck()
     {
```

**File**: `plugin/trino-exchange-filesystem/src/test/java/io/trino/plugin/exchange/filesystem/azure/TestAzureBlobExchangeReadFailure.java` (modified, +88/-3)
```diff
@@ -13,10 +13,18 @@
  */
 package io.trino.plugin.exchange.filesystem.azure;
 
+import com.azure.core.http.HttpClient;
 import com.azure.core.http.HttpHeaders;
 import com.azure.core.http.HttpRequest;
 import com.azure.core.http.HttpResponse;
+import com.azure.storage.blob.BlobServiceAsyncClient;
+import com.azure.storage.blob.BlobServiceClientBuilder;
 import com.azure.storage.blob.models.BlobStorageException;
+import com.google.common.collect.ImmutableList;
+import io.trino.plugin.exchange.filesystem.ExchangeSourceFile;
+import io.trino.plugin.exchange.filesystem.MetricsBuilder;
+import io.trino.plugin.exchange.filesystem.azure.AzureBlobFileSystemExchangeStorage.AzureExchangeStorageReader;
+import io.trino.spi.exchange.ExchangeId;
 import org.junit.jupiter.api.Test;
 import reactor.core.publisher.Flux;
 import reactor.core.publisher.Mono;
@@ -26,14 +34,64 @@
 import java.nio.ByteBuffer;
 import java.nio.charset.Charset;
 import java.nio.file.NoSuchFileException;
+import java.time.Duration;
+import java.util.List;
 import java.util.concurrent.CompletionException;
+import java.util.concurrent.ExecutionException;
 
 import static io.trino.plugin.exchange.filesystem.azure.AzureBlobFileSystemExchangeStorage.toReadFailure;
 import static org.assertj.core.api.Assertions.assertThat;
+import static org.assertj.core.api.Assertions.assertThatThrownBy;
 
 public class TestAzureBlobExchangeReadFailure
 {
     private static final URI FILE = URI.create("abfs://container@account.dfs.core.windows.net/exchange/file");
+    private static final URI FIRST_FILE = URI.create("abfs://container@account.dfs.core.windows.net/exchange/0_0.data");
+    private static final URI LAST_FILE = URI.create("abfs://container@account.dfs.core.windows.net/exchange/1_0.data");
+    private static final ExchangeId EXCHANGE_ID = new ExchangeId("exchange");
+
+    @Test
+    public void testReaderMissingLastFileOfBufferFill()
+    {
+        // Both files fit into a single buffer fill, which consumes all source files before the requests complete
+        try (AzureExchangeStorageReader reader = createReader(LAST_FILE, 404)) {
+            // Azure client completes requests asynchronously
+            assertThat(reader.isBlocked())
+                    .failsWithin(Duration.ofSeconds(10))
+                    .withThrowableOfType(ExecutionException.class);
+            assertThatThrownBy(reader::read)
+                    .isInstanceOf(NoSuchFileException.class)
+                    .hasMessage(LAST_FILE.toString());
+        }
+    }
+
+    @Test
+    public void testReaderMissingEarlierFileOfBufferFill()
+    {
+        try (AzureExchangeStorageReader reader = createReader(FIRST_FILE, 404)) {
+            // Azure client completes requests asynchronously
+            assertThat(reader.isBlocked())
+                    .failsWithin(Duration.ofSeconds(10))
+                    .withThrowableOfType(ExecutionException.class);
+            assertThatThrownBy(reader::read)
+                    .isInstanceOf(NoSuchFileException.class)
+                    .hasMessage(FIRST_FILE.toString());
+        }
+    }
+
+    @Test
+    public void testReaderOtherFailureStaysGeneric()
+    {
+        try (AzureExchangeStorageReader reader = createReader(LAST_FILE, 403)) {
+            // Azure client completes requests asynchronously
+            assertThat(reader.isBlocked())
+                    .failsWithin(Duration.ofSeconds(10))
+                    .withThrowableOfType(ExecutionException.class);
+            assertThatThrownBy(reader::read)
+                    .isExactlyInstanceOf(IOException.class)
+                    .hasRootCauseInstanceOf(BlobStorageException.class);
+        }
+    }
 
     @Test
     public void testMissingBlob()
@@ -63,17 +121,44 @@ public void testOtherFailureStaysGeneric()
 
     private static BlobStorageException blobStorageException(int statusCode)
     {
-        return new BlobStorageException("storage failure", new StatusOnlyResponse(statusCo
```

**File**: `plugin/trino-exchange-filesystem/src/test/java/io/trino/plugin/exchange/filesystem/containers/FlociStorage.java` (modified, +15/-0)
```diff
@@ -18,9 +18,13 @@
 import io.trino.testing.containers.Floci;
 import software.amazon.awssdk.services.kms.KmsClient;
 import software.amazon.awssdk.services.kms.model.CreateKeyRequest;
+import software.amazon.awssdk.services.s3.S3Client;
+import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
 
+import java.net.URI;
 import java.util.Map;
 
+import static com.google.common.base.Preconditions.checkArgument;
 import static io.trino.plugin.exchange.filesystem.s3.ExchangeS3Config.S3SseType.KMS;
 import static io.trino.testing.containers.Floci.FLOCI_ACCESS_KEY;
 import static io.trino.testing.containers.Floci.FLOCI_REGION;
@@ -72,6 +76,17 @@ public Map<String, String> getExchangeManagerProperties()
         return properties.buildOrThrow();
     }
 
+    public void deleteObject(URI file)
+    {
+        checkArgument(file.getHost().equals(bucketName), "File %s is not in bucket %s", file, bucketName);
+        try (S3Client s3 = floci.createS3Client()) {
+            s3.deleteObject(DeleteObjectRequest.builder()
+                    .bucket(bucketName)
+                    .key(file.getPath().substring(1))
+                    .build());
+        }
+    }
+
     @Override
     public void close()
     {
```

---

### Incident Patch 5: `98e56dcf` (2024-11-04)
**Commit Message**: Fix checkpoint write failures on Delta Lake JSON stats

Non-finite doubles stored as strings, decimals stored as JSON numbers
and timestamps without a zone offset failed to convert.

**File**: `plugin/trino-delta-lake/src/main/java/io/trino/plugin/deltalake/transactionlog/DeltaLakeParquetStatisticsUtils.java` (modified, +41/-7)
```diff
@@ -46,7 +46,9 @@
 import java.math.BigInteger;
 import java.time.Instant;
 import java.time.LocalDate;
+import java.time.LocalDateTime;
 import java.time.ZonedDateTime;
+import java.time.temporal.TemporalAccessor;
 import java.util.Collection;
 import java.util.HashMap;
 import java.util.List;
@@ -85,6 +87,7 @@
 import static java.lang.Math.toIntExact;
 import static java.nio.charset.StandardCharsets.UTF_8;
 import static java.time.ZoneOffset.UTC;
+import static java.time.format.DateTimeFormatter.ISO_DATE_TIME;
 import static java.time.format.DateTimeFormatter.ISO_INSTANT;
 import static java.time.format.DateTimeFormatter.ISO_LOCAL_DATE;
 import static java.time.temporal.ChronoUnit.MILLIS;
@@ -127,15 +130,25 @@ public static Object jsonValueToTrinoValue(Type type, @Nullable Object jsonValue
             throw new IllegalArgumentException("Unexpected value for bigint type: " + jsonValue);
         }
         if (type == REAL) {
-            return (long) floatToRawIntBits((float) (double) jsonValue);
+            if (jsonValue instanceof String stringValue) {
+                return (long) floatToRawIntBits((float) parseNonFiniteValue(type, stringValue));
+            }
+            return (long) floatToRawIntBits(((Number) jsonValue).floatValue());
         }
         if (type == DOUBLE) {
-            //noinspection RedundantCast
-            return (double) jsonValue;
+            if (jsonValue instanceof String stringValue) {
+                return parseNonFiniteValue(type, stringValue);
+            }
+            return ((Number) jsonValue).doubleValue();
         }
         if (type instanceof DecimalType decimalType) {
-            BigDecimal decimal = new BigDecimal((String) jsonValue);
-
+            // Some writers store decimal statistics as JSON numbers instead of strings
+            BigDecimal decimal = switch (jsonValue) {
+                case String stringValue -> new BigDecimal(stringValue);
+                case Double doubleValue -> BigDecimal.valueOf(doubleValue);
+                case Number number -> new BigDecimal(number.toString());
+                default -> throw new IllegalArgumentException("Unexpected value for decimal type: " + jsonValue);
+            };
             if (decimalType.isShort()) {
                 return Decimals.encodeShortScaledValue(decimal, decimalType.getScale());
             }
@@ -151,14 +164,14 @@ public static Object jsonValueToTrinoValue(Type type, @Nullable Object jsonValue
             return Instant.parse((String) jsonValue).toEpochMilli() * MICROSECONDS_PER_MILLISECOND;
         }
         if (type == TIMESTAMP_MICROS) {
-            Instant instant = Instant.parse((String) jsonValue);
+            Instant instant = parseTimestampStatistic((String) jsonValue);
             return (instant.getEpochSecond() * MICROSECONDS_PER_SECOND) + (instant.getNano() / NANOSECONDS_PER_MICROSECOND);
         }
         if (type instanceof RowType rowType) {
             Map<?, ?> values = (Map<?, ?>) jsonValue;
             List<Type> fieldTypes = rowType.getFieldTypes();
             return buildRowValue(rowType, fields -> {
-                for (int i = 0; i < values.size(); ++i) {
+                for (int i = 0; i < fieldTypes.size(); ++i) {
                     Type fieldType = fieldTypes.get(i);
                     String fieldName = rowType.getFields().get(i).getName().orElseThrow(() -> new IllegalArgumentException("Field name must exist"));
                     Object fieldValue = jsonValueToTrinoValue(fieldType, values.remove(fieldName));
@@ -171,6 +184,27 @@ public static Object jsonValueToTrinoValue(Type type, @Nullable Object jsonValue
         throw new UnsupportedOperationException("Unsupported type: " + type);
     }
 
+    // Non-finite floating point statistics are stored as JSON strings
+    private static double parseNonFiniteValue(Type type, String value)
+    {
+        return switch (value) {
+            case "Infinity" -> Double.POSITIVE_INFINITY;
+       
```

**File**: `plugin/trino-delta-lake/src/test/java/io/trino/plugin/deltalake/TestDeltaLakeConnectorTest.java` (modified, +25/-0)
```diff
@@ -1314,6 +1314,31 @@ public void testOptimizeWithFileSizeColumn()
         }
     }
 
+    @Test
+    public void testOptimizeWritesCheckpointWithNonFiniteStatistics()
+    {
+        String tableName = "test_optimize_checkpoint_non_finite_" + randomNameSuffix();
+
+        assertUpdate("CREATE TABLE " + tableName + " (a_double double, a_real real)");
+        String deltaLog = getTableLocation(tableName).replaceFirst("s3://" + bucketName + "/", "") + "/_delta_log";
+        assertUpdate("INSERT INTO " + tableName + " VALUES (infinity(), -infinity()), (-infinity(), nan())", 2);
+        assertUpdate("INSERT INTO " + tableName + " VALUES (nan(), infinity()), (1.5, 2.5)", 2);
+
+        // OPTIMIZE always writes a checkpoint
+        assertUpdate("ALTER TABLE " + tableName + " EXECUTE optimize");
+        assertThat(floci.listObjects(bucketName, deltaLog)).contains(deltaLog + "/00000000000000000003.checkpoint.parquet");
+
+        assertThat(query("SELECT a_double, a_real FROM " + tableName + " WHERE a_double = infinity()"))
+                .matches("VALUES (infinity(), REAL '-Infinity')");
+        assertThat(query("SELECT a_double, a_real FROM " + tableName + " WHERE a_double = -infinity()"))
+                .matches("VALUES (-infinity(), REAL 'NaN')");
+        assertThat(query("SELECT a_double, a_real FROM " + tableName + " WHERE a_real = infinity()"))
+                .matches("VALUES (nan(), REAL 'Infinity')");
+        assertQuery("SELECT count(*) FROM " + tableName, "VALUES 4");
+
+        assertUpdate("DROP TABLE " + tableName);
+    }
+
     @Test
     public void testTableLocationTrailingSpace()
     {
```

**File**: `plugin/trino-delta-lake/src/test/java/io/trino/plugin/deltalake/transactionlog/TestDeltaLakeParquetStatisticsUtils.java` (modified, +76/-3)
```diff
@@ -16,34 +16,45 @@
 import com.google.common.collect.ImmutableMap;
 import io.airlift.slice.Slice;
 import io.airlift.slice.Slices;
-import io.trino.spi.type.DoubleType;
+import io.trino.spi.block.SqlRow;
+import io.trino.spi.type.DecimalType;
+import io.trino.spi.type.Int128;
 import io.trino.spi.type.IntegerType;
+import io.trino.spi.type.RowType;
 import org.apache.parquet.column.statistics.Statistics;
 import org.apache.parquet.schema.PrimitiveType;
 import org.apache.parquet.schema.Type;
 import org.junit.jupiter.api.Test;
 
+import java.math.BigInteger;
 import java.nio.ByteBuffer;
 import java.time.Instant;
 import java.time.LocalDate;
 import java.time.LocalDateTime;
+import java.util.HashMap;
+import java.util.Map;
 import java.util.Optional;
 
 import static io.trino.plugin.deltalake.transactionlog.DeltaLakeParquetStatisticsUtils.jsonValueToTrinoValue;
 import static io.trino.spi.type.DateType.DATE;
+import static io.trino.spi.type.DecimalType.createDecimalType;
+import static io.trino.spi.type.DoubleType.DOUBLE;
 import static io.trino.spi.type.RealType.REAL;
+import static io.trino.spi.type.RowType.field;
 import static io.trino.spi.type.TimestampType.TIMESTAMP_MICROS;
 import static io.trino.spi.type.TimestampWithTimeZoneType.TIMESTAMP_TZ_MILLIS;
 import static io.trino.spi.type.Timestamps.MICROSECONDS_PER_MILLISECOND;
 import static io.trino.spi.type.Timestamps.MICROSECONDS_PER_SECOND;
 import static io.trino.spi.type.Timestamps.NANOSECONDS_PER_MICROSECOND;
 import static io.trino.spi.type.VarcharType.createUnboundedVarcharType;
+import static java.lang.Float.floatToRawIntBits;
 import static java.lang.Math.toIntExact;
 import static java.nio.ByteOrder.LITTLE_ENDIAN;
 import static java.nio.charset.StandardCharsets.UTF_8;
 import static java.time.ZoneOffset.UTC;
 import static java.util.concurrent.TimeUnit.MILLISECONDS;
 import static org.assertj.core.api.Assertions.assertThat;
+import static org.assertj.core.api.Assertions.assertThatThrownBy;
 
 public class TestDeltaLakeParquetStatisticsUtils
 {
@@ -100,8 +111,8 @@ public void testFloatStatistics()
                 .withNumNulls(2)
                 .build();
 
-        assertThat(DeltaLakeParquetStatisticsUtils.jsonEncodeMin(ImmutableMap.of(columnName, Optional.of(stats)), ImmutableMap.of(columnName, DoubleType.DOUBLE))).isEqualTo(ImmutableMap.of(columnName, 100.0));
-        assertThat(DeltaLakeParquetStatisticsUtils.jsonEncodeMax(ImmutableMap.of(columnName, Optional.of(stats)), ImmutableMap.of(columnName, DoubleType.DOUBLE))).isEqualTo(ImmutableMap.of(columnName, 1000.001));
+        assertThat(DeltaLakeParquetStatisticsUtils.jsonEncodeMin(ImmutableMap.of(columnName, Optional.of(stats)), ImmutableMap.of(columnName, DOUBLE))).isEqualTo(ImmutableMap.of(columnName, 100.0));
+        assertThat(DeltaLakeParquetStatisticsUtils.jsonEncodeMax(ImmutableMap.of(columnName, Optional.of(stats)), ImmutableMap.of(columnName, DOUBLE))).isEqualTo(ImmutableMap.of(columnName, 1000.001));
     }
 
     @Test
@@ -130,6 +141,68 @@ public void testTimestampJsonValueToTrinoValue()
                 .isEqualTo(Instant.parse("2020-08-26T01:02:03Z").getEpochSecond() * MICROSECONDS_PER_SECOND + 123999);
     }
 
+    @Test
+    public void testTimestampWithoutZoneJsonValueToTrinoValue()
+    {
+        long expected = Instant.parse("2020-08-26T01:02:03Z").getEpochSecond() * MICROSECONDS_PER_SECOND + 123456;
+        assertThat(jsonValueToTrinoValue(TIMESTAMP_MICROS, "2020-08-26T01:02:03.123456")).isEqualTo(expected);
+        assertThat(jsonValueToTrinoValue(TIMESTAMP_MICROS, "2020-08-26T01:02:03.123456Z")).isEqualTo(expected);
+        assertThat(jsonValueToTrinoValue(TIMESTAMP_MICROS, "2020-08-26T02:02:03.123456+01:00")).isEqualTo(expected);
+        assertThat(jsonValueToTrinoValue(TIMESTAMP_MICROS, "2020-08-25T23:02:03.123456-02:00")).isEqualTo(expected);
+        assertThat(jsonValueToTrinoValue(TIMESTAMP_MICROS, "2020-08-26T01:02:03")).isEqualTo(expected - 123456);
+    }
+
+    
```

**File**: `plugin/trino-delta-lake/src/test/java/io/trino/plugin/deltalake/transactionlog/checkpoint/TestCheckpointWriter.java` (modified, +328/-106)
```diff
@@ -24,6 +24,7 @@
 import io.trino.filesystem.hdfs.HdfsFileSystemFactory;
 import io.trino.parquet.ParquetReaderOptions;
 import io.trino.plugin.base.metrics.FileFormatDataSourceStats;
+import io.trino.plugin.deltalake.DeltaLakeColumnMetadata;
 import io.trino.plugin.deltalake.DeltaLakeConfig;
 import io.trino.plugin.deltalake.transactionlog.AddFileEntry;
 import io.trino.plugin.deltalake.transactionlog.DeletionVectorEntry;
@@ -39,15 +40,19 @@
 import io.trino.spi.block.SqlRow;
 import io.trino.spi.predicate.TupleDomain;
 import io.trino.spi.type.BigintType;
+import io.trino.spi.type.DecimalType;
 import io.trino.spi.type.Int128;
 import io.trino.spi.type.IntegerType;
+import io.trino.spi.type.TimestampType;
+import io.trino.spi.type.Type;
 import io.trino.spi.type.TypeManager;
 import io.trino.util.DateTimeUtils;
 import org.junit.jupiter.api.Test;
 import org.junit.jupiter.api.io.TempDir;
 
 import java.io.File;
 import java.io.IOException;
+import java.math.BigDecimal;
 import java.nio.file.Files;
 import java.nio.file.Path;
 import java.time.LocalDateTime;
@@ -66,6 +71,8 @@
 import static io.trino.hdfs.HdfsTestUtils.HDFS_ENVIRONMENT;
 import static io.trino.hdfs.HdfsTestUtils.HDFS_FILE_SYSTEM_STATS;
 import static io.trino.plugin.deltalake.DeltaTestingConnectorSession.SESSION;
+import static io.trino.plugin.deltalake.transactionlog.DeltaLakeParquetStatisticsUtils.convertParquetToJsonStatistics;
+import static io.trino.plugin.deltalake.transactionlog.DeltaLakeSchemaSupport.extractSchema;
 import static io.trino.plugin.deltalake.transactionlog.DeltaLakeTableFeatures.DELETION_VECTORS_FEATURE_NAME;
 import static io.trino.plugin.deltalake.transactionlog.checkpoint.CheckpointEntryIterator.EntryType.ADD;
 import static io.trino.plugin.deltalake.transactionlog.checkpoint.CheckpointEntryIterator.EntryType.METADATA;
@@ -79,6 +86,7 @@
 import static io.trino.spi.type.VarcharType.createUnboundedVarcharType;
 import static io.trino.type.InternalTypeManager.TESTING_TYPE_MANAGER;
 import static io.trino.util.DateTimeUtils.parseDate;
+import static java.math.RoundingMode.HALF_UP;
 import static java.time.ZoneOffset.UTC;
 import static org.assertj.core.api.Assertions.assertThat;
 
@@ -100,26 +108,35 @@ public void testCheckpointWriteReadJsonRoundtrip()
                         ImmutableMap.of(
                                 "formatOptionX", "blah",
                                 "fomatOptionY", "plah")),
-                "{\"type\":\"struct\",\"fields\":" +
-                        "[{\"name\":\"part_key\",\"type\":\"double\",\"nullable\":true,\"metadata\":{}}," +
-                        "{\"name\":\"ts\",\"type\":\"timestamp\",\"nullable\":true,\"metadata\":{}}," +
-                        "{\"name\":\"ts_ntz\",\"type\":\"timestamp_ntz\",\"nullable\":true,\"metadata\":{}}," +
-                        "{\"name\":\"str\",\"type\":\"string\",\"nullable\":true,\"metadata\":{}}," +
-                        "{\"name\":\"dec_short\",\"type\":\"decimal(5,1)\",\"nullable\":true,\"metadata\":{}}," +
-                        "{\"name\":\"dec_long\",\"type\":\"decimal(25,3)\",\"nullable\":true,\"metadata\":{}}," +
-                        "{\"name\":\"l\",\"type\":\"long\",\"nullable\":true,\"metadata\":{}}," +
-                        "{\"name\":\"in\",\"type\":\"integer\",\"nullable\":true,\"metadata\":{}}," +
-                        "{\"name\":\"sh\",\"type\":\"short\",\"nullable\":true,\"metadata\":{}}," +
-                        "{\"name\":\"byt\",\"type\":\"byte\",\"nullable\":true,\"metadata\":{}}," +
-                        "{\"name\":\"fl\",\"type\":\"float\",\"nullable\":true,\"metadata\":{}}," +
-                        "{\"name\":\"dou\",\"type\":\"double\",\"nullable\":true,\"metadata\":{}}," +
-                        "{\"name\":\"bool\",\"type\":\"boolean\",\"nullable\":true,\"metadata\":{}}," +
-                        "{\"name\":\"bin\",\"type\":\"binary\",\"nullable\":true,\"metadata\":{}}," +
-                        "{\"n
```

---

### Incident Patch 6: `01b12043` (2026-09-19)
**Commit Message**: Fix hamming_distance infinite loop on NUL code point

hamming_distance advanced its scan position by lengthOfCodePoint only
when tryGetCodePointAt returned a strictly positive value, treating any
non-positive return as an invalid sequence to skip by -codePoint bytes.
NUL (U+0000) is a valid single-byte code point whose value is 0, so it
fell into the invalid branch and advanced the position by zero. Two NUL
bytes at the current position left both scans stuck, spinning forever;
a NUL against any other character left one scan stuck and produced a
spurious "must have the same length" error for equal-length inputs.

Treat any non-negative code point as valid so NUL advances by one byte
like any other single-byte character.

**File**: `core/trino-main/src/main/java/io/trino/operator/scalar/StringFunctions.java` (modified, +3/-2)
```diff
@@ -879,8 +879,9 @@ public static long hammingDistance(@SqlType("varchar(x)") Slice left, @SqlType("
                 distance++;
             }
 
-            leftPosition += codePointLeft > 0 ? lengthOfCodePoint(codePointLeft) : -codePointLeft;
-            rightPosition += codePointRight > 0 ? lengthOfCodePoint(codePointRight) : -codePointRight;
+            // a valid code point is non-negative (NUL is the valid code point 0); an invalid sequence is encoded as a negative length
+            leftPosition += codePointLeft >= 0 ? lengthOfCodePoint(codePointLeft) : -codePointLeft;
+            rightPosition += codePointRight >= 0 ? lengthOfCodePoint(codePointRight) : -codePointRight;
         }
 
         checkCondition(
```

**File**: `core/trino-main/src/test/java/io/trino/operator/scalar/TestStringFunctions.java` (modified, +10/-0)
```diff
@@ -397,6 +397,16 @@ public void testHammingDistance()
 
         assertTrinoExceptionThrownBy(assertions.function("hamming_distance", "'\u4FE1\u5FF5,\u7231,\u5E0C\u671B'", "'\u4FE1\u5FF5\u5E0C\u671B'")::evaluate)
                 .hasMessage("The input strings to hamming_distance function must have the same length");
+
+        // NUL (U+0000) is a valid single-byte code point and must be advanced past like any other character
+        assertThat(assertions.function("hamming_distance", "chr(0)", "chr(0)"))
+                .isEqualTo(0L);
+
+        assertThat(assertions.function("hamming_distance", "chr(0)", "'a'"))
+                .isEqualTo(1L);
+
+        assertThat(assertions.function("hamming_distance", "'a' || chr(0) || 'c'", "'a' || chr(0) || 'd'"))
+                .isEqualTo(1L);
     }
 
     @Test
```

---

### Incident Patch 7: `7360ce3c` (2026-09-27)
**Commit Message**: Fix CAST of pre-1970 timestamp to time

**File**: `core/trino-main/src/main/java/io/trino/operator/scalar/timestamp/TimestampToTimeCast.java` (modified, +4/-2)
```diff
@@ -28,6 +28,7 @@
 import static io.trino.spi.type.Timestamps.PICOSECONDS_PER_MICROSECOND;
 import static io.trino.spi.type.Timestamps.PICOSECONDS_PER_SECOND;
 import static io.trino.spi.type.Timestamps.round;
+import static io.trino.type.DateTimes.getMicrosOfSecond;
 import static io.trino.type.DateTimes.rescale;
 import static io.trino.type.DateTimes.scaleEpochMicrosToSeconds;
 import static java.lang.Math.multiplyExact;
@@ -45,7 +46,7 @@ public static long cast(
             @SqlType("timestamp(sourcePrecision)") long timestamp)
     {
         long epochSeconds = scaleEpochMicrosToSeconds(timestamp);
-        long microOfSecond = timestamp % MICROSECONDS_PER_SECOND;
+        long microOfSecond = getMicrosOfSecond(timestamp);
 
         long microOfDay = multiplyExact(getSecondOfDay(epochSeconds), MICROSECONDS_PER_SECOND) + microOfSecond;
 
@@ -64,9 +65,10 @@ public static long cast(
     {
         long epochSeconds = scaleEpochMicrosToSeconds(timestamp.getEpochMicros());
         long secondOfDay = getSecondOfDay(epochSeconds);
+        long microOfSecond = getMicrosOfSecond(timestamp.getEpochMicros());
 
         long picoOfDay = multiplyExact(secondOfDay, PICOSECONDS_PER_SECOND) +
-                multiplyExact(timestamp.getEpochMicros() % MICROSECONDS_PER_SECOND, PICOSECONDS_PER_MICROSECOND) +
+                multiplyExact(microOfSecond, PICOSECONDS_PER_MICROSECOND) +
                 timestamp.getPicosOfMicro();
 
         return round(picoOfDay, (int) (12 - targetPrecision)) % PICOSECONDS_PER_DAY;
```

**File**: `core/trino-main/src/test/java/io/trino/operator/scalar/timestamp/TestTimestamp.java` (modified, +6/-0)
```diff
@@ -788,6 +788,12 @@ public void testCastToTime()
         assertThat(assertions.expression("CAST(TIMESTAMP '2020-05-01 23:59:59.999999999999' AS TIME(10))")).matches("TIME '00:00:00.0000000000'");
 
         assertThat(assertions.expression("CAST(TIMESTAMP '2020-05-01 23:59:59.999999999999' AS TIME(11))")).matches("TIME '00:00:00.00000000000'");
+
+        assertThat(assertions.expression("CAST(TIMESTAMP '1965-06-15 10:20:30.123' AS TIME(3))")).matches("TIME '10:20:30.123'");
+        assertThat(assertions.expression("CAST(TIMESTAMP '1965-06-15 10:20:30.123456789012' AS TIME(12))")).matches("TIME '10:20:30.123456789012'");
+        assertThat(assertions.expression("CAST(TIMESTAMP '1965-06-15 10:20:30.9999' AS TIME(3))")).matches("TIME '10:20:31.000'");
+        assertThat(assertions.expression("CAST(TIMESTAMP '1969-12-31 00:00:00.5' AS TIME(1))")).matches("TIME '00:00:00.5'");
+        assertThat(assertions.expression("CAST(TIMESTAMP '1969-12-31 00:00:00.123456789' AS TIME(9))")).matches("TIME '00:00:00.123456789'");
     }
 
     @Test
```

---

### Incident Patch 8: `900359d6` (2026-09-26)
**Commit Message**: Fix duplicated rows in ClickHouse Distributed tables

Insert stages the rows in a temporary table that is created with
`CREATE TABLE tmp AS target`, which in ClickHouse also copies the target
table's engine. For a Distributed target the temporary table pointed at the
same underlying tables, so the staged rows were already visible in the
target and the following `INSERT INTO target SELECT ... FROM tmp` selected
them again, duplicating every row. A replicated MergeTree target failed
instead, because the temporary table reused the source's replica identity
and ClickHouse rejected it with REPLICA_IS_ALREADY_EXIST.

Create the temporary table with an explicit engine so that it no longer
depends on the target table's engine.

**File**: `plugin/trino-clickhouse/src/main/java/io/trino/plugin/clickhouse/ClickHouseClient.java` (modified, +11/-5)
```diff
@@ -119,6 +119,7 @@
 import static com.google.common.collect.ImmutableMap.toImmutableMap;
 import static io.airlift.slice.Slices.wrappedBuffer;
 import static io.trino.plugin.clickhouse.ClickHouseSessionProperties.isMapStringAsVarchar;
+import static io.trino.plugin.clickhouse.ClickHouseTableProperties.DEFAULT_TABLE_ENGINE;
 import static io.trino.plugin.clickhouse.ClickHouseTableProperties.ENGINE_PROPERTY;
 import static io.trino.plugin.clickhouse.ClickHouseTableProperties.ORDER_BY_PROPERTY;
 import static io.trino.plugin.clickhouse.ClickHouseTableProperties.PARTITION_BY_PROPERTY;
@@ -338,13 +339,18 @@ else if (!isNullOrEmpty(catalog)) {
     @Override
     protected void copyTableSchema(ConnectorSession session, Connection connection, String catalogName, String schemaName, String tableName, String newTableName, List<String> columnNames)
     {
-        // ClickHouse does not support `create table tbl as select * from tbl2 where 0=1`
-        // ClickHouse supports the following two methods to copy schema
-        // 1. create table tbl as tbl2
-        // 2. create table tbl1 ENGINE=<engine> as select * from tbl2
+        // `CREATE TABLE tbl AS tbl2` copies the source table's engine. For a Distributed source that makes the
+        // temporary table point at the same underlying tables, so the staged rows are already visible in the target
+        // and are inserted a second time, duplicating every row. A replicated MergeTree source fails instead, because
+        // the temporary table reuses the source's replica identity (REPLICA_IS_ALREADY_EXIST). Create the temporary
+        // table with an explicit engine so that it is independent of the source, which is all that staging requires.
         String sql = format(
-                "CREATE TABLE %s AS %s ",
+                "CREATE TABLE %s ENGINE = %s AS SELECT %s FROM %s WHERE 0 = 1",
                 quoted(null, schemaName, newTableName),
+                DEFAULT_TABLE_ENGINE.getEngineType(),
+                columnNames.stream()
+                        .map(this::quoted)
+                        .collect(joining(", ")),
                 quoted(null, schemaName, tableName));
         try {
             execute(session, connection, sql);
```

**File**: `plugin/trino-clickhouse/src/test/java/io/trino/plugin/clickhouse/TestClickHouseConnectorTest.java` (modified, +26/-0)
```diff
@@ -1140,6 +1140,32 @@ public void testExecuteProcedureWithInvalidQuery()
         assertQueryFails("CALL system.execute('invalid')", "(?s)Failed to execute query.*");
     }
 
+    @Test
+    public void testInsertIntoDistributedTable()
+    {
+        // Insert stages the rows in a temporary table before moving them into the target table. That temporary table
+        // must not be a Distributed table over the same underlying tables, otherwise the staged rows are already
+        // visible in the target and then inserted a second time.
+        // https://github.com/trinodb/trino/issues/7600
+        String localTableName = "test_distributed_insert_local_" + randomNameSuffix();
+        String distributedTableName = "test_distributed_insert_" + randomNameSuffix();
+        try {
+            // The 'default' cluster is defined by the ClickHouse server's default configuration
+            onRemoteDatabase().execute("CREATE TABLE tpch." + localTableName + " (id Int64, name String) ENGINE = MergeTree ORDER BY id");
+            onRemoteDatabase().execute("CREATE TABLE tpch." + distributedTableName + " (id Int64, name String) ENGINE = Distributed('default', 'tpch', '" + localTableName + "', rand())");
+
+            assertUpdate("INSERT INTO " + distributedTableName + " VALUES (1, 'a')", 1);
+            assertUpdate("INSERT INTO " + distributedTableName + " SELECT * FROM (VALUES (2, 'b'), (3, 'c'))", 2);
+
+            assertQuery("SELECT count(*) FROM " + distributedTableName, "VALUES 3");
+            assertQueryOrdered("SELECT id, name FROM " + distributedTableName + " ORDER BY id", "VALUES (1, 'a'), (2, 'b'), (3, 'c')");
+        }
+        finally {
+            onRemoteDatabase().execute("DROP TABLE IF EXISTS tpch." + distributedTableName);
+            onRemoteDatabase().execute("DROP TABLE IF EXISTS tpch." + localTableName);
+        }
+    }
+
     @Override
     protected OptionalInt maxTableNameLength()
     {
```

---

### Incident Patch 9: `df79abb0` (2026-09-24)
**Commit Message**: Fix stale ambiguous BigQuery name resolution

Cached name mappings only accumulate spellings, so after a case-colliding
table or dataset was dropped or renamed, lookups kept failing with an
ambiguity error for up to bigquery.case-insensitive-name-matching.cache-ttl.

**File**: `plugin/trino-bigquery/pom.xml` (modified, +2/-0)
```diff
@@ -526,6 +526,7 @@
                                 <exclude>**/TestBigQueryAvroConnectorTest.java</exclude>
                                 <exclude>**/TestBigQueryWithDifferentProjectIdConnectorSmokeTest.java</exclude>
                                 <exclude>**/TestBigQueryMetadataCaching.java</exclude>
+                                <exclude>**/TestBigQueryStaleNameResolution.java</exclude>
                                 <exclude>**/TestBigQueryAvroTypeMapping.java</exclude>
                                 <exclude>**/TestBigQueryArrowTypeMapping.java</exclude>
                                 <exclude>**/TestBigQueryArrowSerialization.java</exclude>
@@ -589,6 +590,7 @@
                                 <include>**/TestBigQueryArrowTypeMapping.java</include>
                                 <include>**/TestBigQueryAvroTypeMapping.java</include>
                                 <include>**/TestBigQueryMetadataCaching.java</include>
+                                <include>**/TestBigQueryStaleNameResolution.java</include>
                                 <include>**/TestBigQueryMetadata.java</include>
                                 <include>**/TestBigQuerySplitManager.java</include>
                                 <include>**/TestBigQuery*FailureRecoveryTest.java</include>
```

**File**: `plugin/trino-bigquery/src/main/java/io/trino/plugin/bigquery/BigQueryClient.java` (modified, +16/-2)
```diff
@@ -172,7 +172,16 @@ public Optional<RemoteDatabaseObject> toRemoteDataset(DatasetId datasetId)
 
     public Optional<RemoteDatabaseObject> toRemoteDataset(String projectId, String datasetName)
     {
-        return toRemoteDataset(projectId, datasetName, () -> listDatasetIds(projectId));
+        Supplier<List<DatasetId>> datasetIds = () -> listDatasetIds(projectId);
+        Optional<RemoteDatabaseObject> remoteDataset = toRemoteDataset(projectId, datasetName, datasetIds);
+        if (remoteDataset.isPresent() && remoteDataset.get().isAmbiguous()) {
+            // The colliding dataset may have been dropped or renamed, so re-resolve from the current remote state.
+            // The cached dataset listing must also be dropped, as the mapping is rebuilt from it.
+            remoteDatasetCaseInsensitiveCache.invalidate(DatasetId.of(projectId, datasetName));
+            remoteDatasetIdCache.invalidate(projectId);
+            return toRemoteDataset(projectId, datasetName, datasetIds);
+        }
+        return remoteDataset;
     }
 
     public Optional<RemoteDatabaseObject> toRemoteDataset(String projectId, String datasetName, Supplier<List<DatasetId>> datasetIds)
@@ -267,7 +276,12 @@ private Optional<RemoteDatabaseObject> toRemoteTable(String projectId, String re
 
         Optional<RemoteDatabaseObject> remoteTableFromCache = Optional.ofNullable(remoteTableCaseInsensitiveCache.getIfPresent(cacheKey));
         if (remoteTableFromCache.isPresent()) {
-            return remoteTableFromCache;
+            if (!remoteTableFromCache.get().isAmbiguous()) {
+                return remoteTableFromCache;
+            }
+            // The colliding table may have been dropped or renamed, so invalidate the entry and re-resolve.
+            // The rebuild below seeds from the cache, so the entry must be removed before it runs.
+            remoteTableCaseInsensitiveCache.invalidate(cacheKey);
         }
 
         // Get all information from BigQuery and update cache from all fetched information
```

**File**: `plugin/trino-bigquery/src/main/java/io/trino/plugin/bigquery/BigQueryClientFactory.java` (modified, +12/-6)
```diff
@@ -15,18 +15,18 @@
 
 import com.google.cloud.bigquery.BigQuery;
 import com.google.cloud.bigquery.BigQueryOptions;
-import com.google.common.cache.CacheBuilder;
+import com.google.common.annotations.VisibleForTesting;
+import com.google.common.cache.Cache;
 import com.google.inject.Inject;
 import io.airlift.units.Duration;
-import io.trino.cache.NonEvictableCache;
+import io.trino.cache.EvictableCacheBuilder;
 import io.trino.plugin.base.cache.identity.IdentityCacheMapping;
 import io.trino.spi.connector.ConnectorSession;
 
 import java.util.Optional;
 import java.util.Set;
 
 import static io.trino.cache.CacheUtils.uncheckedCacheGet;
-import static io.trino.cache.SafeCaches.buildNonEvictableCache;
 import static java.util.Objects.requireNonNull;
 
 public class BigQueryClientFactory
@@ -39,7 +39,7 @@ public class BigQueryClientFactory
     private final ViewMaterializationCache materializationCache;
     private final BigQueryLabelFactory labelFactory;
 
-    private final NonEvictableCache<IdentityCacheMapping.IdentityCacheKey, BigQueryClient> clientCache;
+    private final Cache<IdentityCacheMapping.IdentityCacheKey, BigQueryClient> clientCache;
     private final Duration metadataCacheTtl;
     private final int metadataPageSize;
     private final Set<BigQueryOptionsConfigurer> optionsConfigurers;
@@ -65,10 +65,10 @@ public BigQueryClientFactory(
         this.metadataPageSize = bigQueryConfig.getMetadataPageSize();
         this.optionsConfigurers = requireNonNull(optionsConfigurers, "optionsConfigurers is null");
 
-        CacheBuilder<Object, Object> cacheBuilder = CacheBuilder.newBuilder()
+        EvictableCacheBuilder<Object, Object> cacheBuilder = EvictableCacheBuilder.newBuilder()
                 .expireAfterWrite(bigQueryConfig.getServiceCacheTtl().toJavaTime());
 
-        clientCache = buildNonEvictableCache(cacheBuilder);
+        clientCache = cacheBuilder.build();
     }
 
     public BigQueryClient create(ConnectorSession session)
@@ -77,6 +77,12 @@ public BigQueryClient create(ConnectorSession session)
         return uncheckedCacheGet(clientCache, cacheKey, () -> createBigQueryClient(session));
     }
 
+    @VisibleForTesting
+    void flushCache()
+    {
+        clientCache.invalidateAll();
+    }
+
     protected BigQueryClient createBigQueryClient(ConnectorSession session)
     {
         return new BigQueryClient(
```

**File**: `plugin/trino-bigquery/src/main/java/io/trino/plugin/bigquery/BigQueryConnector.java` (modified, +11/-0)
```diff
@@ -13,9 +13,11 @@
  */
 package io.trino.plugin.bigquery;
 
+import com.google.common.annotations.VisibleForTesting;
 import com.google.common.collect.ImmutableList;
 import com.google.common.collect.ImmutableSet;
 import com.google.inject.Inject;
+import com.google.inject.Injector;
 import io.airlift.bootstrap.LifeCycleManager;
 import io.trino.plugin.base.classloader.ClassLoaderSafeConnectorMetadata;
 import io.trino.plugin.base.session.SessionPropertiesProvider;
@@ -40,6 +42,7 @@
 public class BigQueryConnector
         implements Connector
 {
+    private final Injector injector;
     private final LifeCycleManager lifeCycleManager;
     private final BigQueryTransactionManager transactionManager;
     private final BigQuerySplitManager splitManager;
@@ -52,6 +55,7 @@ public class BigQueryConnector
 
     @Inject
     public BigQueryConnector(
+            Injector injector,
             LifeCycleManager lifeCycleManager,
             BigQueryTransactionManager transactionManager,
             BigQuerySplitManager splitManager,
@@ -62,6 +66,7 @@ public BigQueryConnector(
             Set<SessionPropertiesProvider> sessionPropertiesProviders,
             BigQuerySchemaProperties schemaProperties)
     {
+        this.injector = requireNonNull(injector, "injector is null");
         this.lifeCycleManager = requireNonNull(lifeCycleManager, "lifeCycleManager is null");
         this.transactionManager = requireNonNull(transactionManager, "transactionManager is null");
         this.splitManager = requireNonNull(splitManager, "splitManager is null");
@@ -75,6 +80,12 @@ public BigQueryConnector(
         this.schemaProperties = ImmutableList.copyOf(requireNonNull(schemaProperties, "schemaProperties is null").schemaProperties());
     }
 
+    @VisibleForTesting
+    Injector getInjector()
+    {
+        return injector;
+    }
+
     @Override
     public ConnectorTransactionHandle beginTransaction(IsolationLevel isolationLevel, boolean readOnly, boolean autoCommit)
     {
```

**File**: `plugin/trino-bigquery/src/test/java/io/trino/plugin/bigquery/TestBigQueryStaleNameResolution.java` (added, +114/-0)
```diff
@@ -0,0 +1,114 @@
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
+package io.trino.plugin.bigquery;
+
+import com.google.common.collect.ImmutableMap;
+import io.trino.spi.connector.Connector;
+import io.trino.testing.AbstractTestQueryFramework;
+import io.trino.testing.QueryRunner;
+import io.trino.testing.sql.TestTable;
+import org.junit.jupiter.api.Test;
+import org.junit.jupiter.api.parallel.Execution;
+import org.junit.jupiter.api.parallel.ExecutionMode;
+
+import static io.trino.testing.TestingNames.randomNameSuffix;
+import static java.lang.String.format;
+import static java.util.Locale.ENGLISH;
+import static org.assertj.core.api.Assertions.assertThat;
+
+@Execution(ExecutionMode.SAME_THREAD) // Run sequentially to remove tests interference, as both tests flush the cache
+final class TestBigQueryStaleNameResolution
+        extends AbstractTestQueryFramework
+{
+    private final BigQueryQueryRunner.BigQuerySqlExecutor bigQuerySqlExecutor = new BigQueryQueryRunner.BigQuerySqlExecutor();
+
+    private BigQueryClientFactory queryClientFactory;
+
+    @Override
+    protected QueryRunner createQueryRunner()
+            throws Exception
+    {
+        QueryRunner queryRunner = BigQueryQueryRunner.builder()
+                .setConnectorProperties(ImmutableMap.<String, String>builder()
+                        .put("bigquery.case-insensitive-name-matching", "true")
+                        .put("bigquery.case-insensitive-name-matching.cache-ttl", "5m")
+                        .put("bigquery.metadata.cache-ttl", "5m")
+                        // Prevent the client, which holds the caches, from expiring during a test
+                        .put("bigquery.service-cache-ttl", "5m")
+                        .buildOrThrow())
+                .build();
+        Connector connector = queryRunner.getCoordinator().getConnector("bigquery");
+        queryClientFactory = ((BigQueryConnector) connector).getInjector().getInstance(BigQueryClientFactory.class);
+        return queryRunner;
+    }
+
+    @Test
+    void testTableAmbiguityClearedAfterCollidingTableDropped()
+            throws Exception
+    {
+        String schemaName = "test_stale_ambiguous_table_" + randomNameSuffix();
+        try (AutoCloseable _ = withSchemaCreatedInBigQuery(schemaName);
+                TestTable table = new TestTable(bigQuerySqlExecutor, schemaName + ".Test_Table", "(c string)")) {
+            String tableName = table.getName().split("\\.")[1];
+            String tableNameUpperCase = tableName.toUpperCase(ENGLISH);
+            String select = "SELECT * FROM %s.%s".formatted(schemaName, tableName.toLowerCase(ENGLISH));
+
+            assertThat(computeActual(select)).isEmpty();
+
+            // Flush so the collision is observed and the ambiguity cached
+            bigQuerySqlExecutor.execute(format("CREATE TABLE %s.%s (c string)", schemaName, tableNameUpperCase));
+            queryClientFactory.flushCache();
+            assertQueryFails(select, "Found ambiguous names in BigQuery when looking up '%s'.*".formatted(tableName.toLowerCase(ENGLISH)));
+
+            // Drop directly in BigQuery, keeping the cached ambiguity
+            bigQuerySqlExecutor.execute(format("DROP TABLE %s.%s", schemaName, tableNameUpperCase));
+
+            assertThat(computeActual(select)).isEmpty();
+        }
+    }
+
+    @Test
+    void testSchemaAmbiguityClearedAfterCollidingSchemaDropped()
+            throws Exception
+    {
+        St
```

---

### Incident Patch 10: `c94fbe01` (2026-08-27)
**Commit Message**: Fix truncated columns/comments listing with Iceberg Glue

getColumnsFromIcebergMetadata and getCommentsFromIcebergMetadata returned
from the whole batch when loading a single table failed, silently dropping
that table and every table not yet iterated. Schema-level
information_schema.columns therefore returned columns for only a subset of
a schema's tables, while the same query with a table_name predicate, which
routes to the per-table path, returned them.

Skip the failing relation instead, matching the per-table path in
IcebergMetadata.streamTableColumns and the equivalent listing in
DeltaLakeMetadata.

A concurrently deleted table is legitimate and is now logged at DEBUG, as
the removed TODO asked, while a table whose metadata file exists and cannot
be read is still logged at WARN.

**File**: `plugin/trino-iceberg/src/main/java/io/trino/plugin/iceberg/catalog/glue/TrinoGlueCatalog.java` (modified, +16/-8)
```diff
@@ -125,6 +125,7 @@
 import static io.trino.plugin.iceberg.IcebergErrorCode.ICEBERG_BAD_DATA;
 import static io.trino.plugin.iceberg.IcebergErrorCode.ICEBERG_CATALOG_ERROR;
 import static io.trino.plugin.iceberg.IcebergErrorCode.ICEBERG_INVALID_METADATA;
+import static io.trino.plugin.iceberg.IcebergExceptions.isNotFoundException;
 import static io.trino.plugin.iceberg.IcebergExceptions.translateMetadataException;
 import static io.trino.plugin.iceberg.IcebergMaterializedViewDefinition.decodeMaterializedViewData;
 import static io.trino.plugin.iceberg.IcebergMaterializedViewDefinition.encodeMaterializedViewData;
@@ -470,10 +471,8 @@ private void getColumnsFromIcebergMetadata(
                 columns = getColumnMetadatas(icebergTable.schema(), typeManager, TableUtil.formatVersion(icebergTable));
             }
             catch (RuntimeException e) {
-                // Table may be concurrently deleted
-                // TODO detect file not found failure when reading metadata file and silently skip table in such case. Avoid logging warnings for legitimate situations.
-                LOG.warn(e, "Failed to get metadata for table: %s", tableName);
-                return;
+                logSkippedRelation(e, tableName);
+                continue;
             }
             resultsCollector.accept(RelationColumnsMetadata.forTable(tableName, columns));
         }
@@ -566,15 +565,24 @@ private void getCommentsFromIcebergMetadata(
                 comment = getTableComment(loadTable(session, tableName));
             }
             catch (RuntimeException e) {
-                // Table may be concurrently deleted
-                // TODO detect file not found failure when reading metadata file and silently skip table in such case. Avoid logging warnings for legitimate situations.
-                LOG.warn(e, "Failed to get metadata for table: %s", tableName);
-                return;
+                logSkippedRelation(e, tableName);
+                continue;
             }
             resultsCollector.accept(RelationCommentMetadata.forRelation(tableName, comment));
         }
     }
 
+    private static void logSkippedRelation(RuntimeException exception, SchemaTableName tableName)
+    {
+        if (isNotFoundException(exception)) {
+            // A concurrently deleted table is legitimate, so do not warn about it.
+            LOG.debug(exception, "Skipping table with missing metadata: %s", tableName);
+        }
+        else {
+            LOG.warn(exception, "Skipping table with unreadable metadata: %s", tableName);
+        }
+    }
+
     @Override
     public BaseTable loadTable(ConnectorSession session, SchemaTableName table)
     {
```

#### Recent Merged Pull Requests:
- **PR #31385** (2026-09-30): Write not-null flag in FlatHashStrategyCompiler (@pettyjamesm)
- **PR #31384** (closed): [WIP] Add YDB connector (@KirillKurdyukov)
- **PR #31383** (2026-09-30): Fix stale null flag in TypedKeyValueHeap flat values (@pettyjamesm)
- **PR #31381** (2026-09-30): Skip repetition levels for non-repeated nested fields (@raunaqmorarka)
- **PR #31380** (2026-09-30): Bump the web-ui-dependencies group in /core/trino-web-ui/src/main/resources/webapp with 17 updates (@dependabot[bot])
- **PR #31379** (closed): Support listing Iceberg branches (@kmurra)
- **PR #31372** (2026-09-30): Fix flaky TestQueuesDb.testUpdateSoftMemoryLimit (@findepi)
- **PR #31371** (closed): Zero reused flat buffers before writing (@findepi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
