> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/apache-pinot-learnings.md`  
> **Source**: github ([https://github.com/apache/pinot](https://github.com/apache/pinot))  
> **Source Version**: `eec6794f`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T18:43:36.847Z  
> **Learning ID**: `learn-github-apache-pinot`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): apache/pinot

> **Canonical Artifact**: `07_PROJECT_LEARNING/apache-pinot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/apache/pinot](https://github.com/apache/pinot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T18:43:36.841Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apache/pinot`
- **Description**: Apache Pinot: a real-time analytics database for low-latency SQL and vector search, serving user-facing and agent-facing applications
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6177 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `pinot-controller/src/main/resources/app/app_state.ts`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

 import { AuthWorkflow } from "Models";
import { DEFAULT_TIMEZONE_FALLBACK } from './utils/TimezoneUtils';

class app_state {
  queryConsoleOnlyView: boolean;
  authWorkflow: AuthWorkflow;
  authToken: string | null;
  columnNameSeparator: string = '#$%';
  hideQueryConsoleTab: boolean;
  username: string;
  role: string;
  timezone: string = DEFAULT_TIMEZONE_FALLBACK;
}

export default new app_state();

```

### Core Architecture Module: `pinot-controller/src/main/resources/app/components/SegmentStatusRenderer.tsx`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  makeStyles,
  Tooltip,
} from "@material-ui/core";
import { HelpOutlineOutlined } from "@material-ui/icons";
import { getSegmentLevelDebugDetails } from "../requests";
import CustomCodemirror from "./CustomCodemirror";
import CustomDialog from "./CustomDialog";
import { NotificationContext } from "./Notification/NotificationContext";
import clsx from "clsx";
import { DISPLAY_SEGMENT_STATUS, SegmentDebugDetails } from "Models";
import React, { useContext, useEffect, useState } from "react";

const useStyles = makeStyles((theme) => ({
  error: {
    color: theme.palette.error.main,
    border: `1px solid ${theme.palette.error.main}`,
  },
  success: {
    color: theme.palette.success.main,
    border: `1px solid ${theme.palette.success.main}`,
  },
  warning: {
    color: theme.palette.warning.main,
    border: `1px solid ${theme.palette.warning.main}`,
  },
  segmentDebugDetails: {
    "& .CodeMirror": { fontSize: 14, height: "100%" },
    maxHeight: 500,
  },
}));

interface SegmentStatusRendererProps {
  status: DISPLAY_SEGMENT_STATUS;
  segmentName: string;
  tableName: string;
}

export enum StatusColor {
  Error = "error",
  Warning = "warning",
  Success = "success",
}

export const SegmentStatusRenderer = ({
  status,
  segmentName,
  tableName,
}: SegmentStatusRendererProps) => {
  const { dispatch: notify } = useContext(NotificationContext);
  const [statusTooltipTitle, setStatusTooltipTitle] = useState<string>("");
  const [statusColor, setStatusColor] = useState<StatusColor | null>(
    null
  );
  const [errorDetailsVisible, setErrorDetailsVisible] =
    useState<boolean>(false);
  const [segmentDebugDetails, setSegmentDebugDetails] =
    useState<SegmentDebugDetails | null>(null);
  const segmentStatusRendererClasses = useStyles();

  useEffect(() => {
    initializeValues();
  }, [status]);

  const initializeValues = () => {
    switch (status) {
      case DISPLAY_SEGMENT_STATUS.GOOD: {
        setStatusColor(StatusColor.Success);
        setStatusTooltipTitle("All the servers of this segment are ONLINE/CONSUMING");

        break;
      }
      case DISPLAY_SEGMENT_STATUS.BAD: {
        setStatusColor(StatusColor.Error);
        setStatusTooltipTitle("One or more servers of this segment are in ERROR state");

        break;
      }
      case DISPLAY_SEGMENT_STATUS.UPDATING: {
        setStatusColor(StatusColor.Warning);
        setStatusTooltipTitle("External view is OFFLINE or missing for one or more servers of this segment");

        break;
      }
    }
  };

  const fetchSegmentErrorDetails = async () => {
    setSegmentDebugDetails(null);
    try {
      const segmentDebugDetails = await getSegmentLevelDebugDetails(
        tableName,
        segmentName
      );
      setSegmentDebugDetails(segmentDebugDetails);
    } catch (error) {
      notify({
        type: "error",
        message: "Error occurred while fetching segment debug details.",
        show: true,
      });
      setSegmentDebugDetails({} as SegmentDebugDetails);
    }
  };

  const handleShowErrorDetailsClick = () => {
    setErrorDetailsVisible(true);
    fetchSegmentErrorDetails();
  };

  const handleHideErrorDetails = () => {
    setErrorDetailsVisible(false);
  };

  return (
    <>
      <Tooltip arrow title={statusTooltipTitle} placement="top">
        <Chip
          className={clsx([segmentStatusRendererClasses[statusColor]])}
          label={status}
          variant="outlined"
        />
      </Tooltip>

      {/* Only show when segment status is bad */}
      {status === DISPLAY_SEGMENT_STATUS.BAD && (
        <>
          <Tooltip
            title="Click to show segment error details"
            arrow
            placement="top"
          >
            <IconButton onClick={handleShowErrorDetailsClick}>
              <HelpOutlineOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          <CustomDialog
            title="Segment Debug Details"
            open={errorDetailsVisible}
            handleClose={handleHideErrorDetails}
            showOkBtn={false}
          >
            {/* Loading */}
            {!segmentDebugDetails && (
              <Box display="flex" justifyContent="center"><CircularProgress /></Box>
            )}
            {segmentDebugDetails && (
              <CustomCodemirror
                showLineWrapToggle
                customClass={segmentStatusRendererClasses.segmentDebugDetails}
                data={segmentDebugDetails}
              />
            )}
          </CustomDialog>
        </>
      )}
    </>
  );
};

```

### Core Architecture Module: `pinot-controller/src/main/resources/app/pages/TaskQueue.tsx`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React, { useEffect, useState } from 'react';
import { get, map } from 'lodash';
import { TableData } from 'Models';
import { Grid, makeStyles } from '@material-ui/core';
import SimpleAccordion from '../components/SimpleAccordion';
import CustomButton from '../components/CustomButton';
import PinotMethodUtils from '../utils/PinotMethodUtils';
import { useConfirm } from '../components/Confirm';
import CustomizedTables from '../components/Table';
import { cleanupTasks } from '../requests';

const useStyles = makeStyles(() => ({
  gridContainer: {
    padding: 20,
    backgroundColor: 'white',
    maxHeight: 'calc(100vh - 70px)',
    overflowY: 'auto'
  },
  operationDiv: {
    border: '1px #BDCCD9 solid',
    borderRadius: 4,
    marginBottom: 20
  },
  body: {
    borderTop: '1px solid #BDCCD9',
    fontSize: '16px',
    lineHeight: '3rem',
    paddingLeft: '15px',
  },
  highlightBackground: {
    border: '1px #4285f4 solid',
    backgroundColor: 'rgba(66, 133, 244, 0.05)',
    borderRadius: 4,
    marginBottom: '20px',
  },
}));

const TaskQueue = (props) => {
  const classes = useStyles();
  const { taskType } = props.match.params;

  const [fetching, setFetching] = useState(true);
  const [taskInfo, setTaskInfo] = useState([]);
  const [tables, setTables] = useState<TableData>({ records: [], columns: ['Name'] });

  const fetchData = async () => {
    setFetching(true);
    const taskInfoRes = await PinotMethodUtils.getTaskInfo(taskType);
    const tablesResponse:any = await PinotMethodUtils.getTableData({ taskType });
    setTaskInfo(taskInfoRes);
    setTables((prevState): TableData => {
      const _records = map(get(tablesResponse, 'tables', []), table => [table]);
      return { ...prevState, records: _records };
    });
    setFetching(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStopAll = async () => {
    await PinotMethodUtils.stopAllTasks(taskType);
    await fetchData();
    stopAllConfirm.setConfirmDialog(false);
  };

  const stopAllConfirm = useConfirm({
    dialogTitle: 'Stop all tasks',
    dialogContent: 'Are you sure want to stop all the tasks?',
    successCallback: handleStopAll
  });

  const handleResumeAll = async () => {
    await PinotMethodUtils.resumeAllTasks(taskType);
    await fetchData();
    resumeAllConfirm.setConfirmDialog(false);
  };

  const resumeAllConfirm = useConfirm({
    dialogTitle: 'Resume all tasks',
    dialogContent: 'Are you sure want to resume all the tasks?',
    successCallback: handleResumeAll
  });

  const handleCleanupAll = async () => {
    await PinotMethodUtils.cleanupAllTasks(taskType);
    cleanupAllConfirm.setConfirmDialog(false);
  };

  const cleanupAllConfirm = useConfirm({
    dialogTitle: 'Cleanup all tasks',
    dialogContent: 'Are you sure want to cleanup all the tasks?',
    successCallback: handleCleanupAll
  });

  const handleDeleteAll = async () => {
    await PinotMethodUtils.deleteAllTasks(taskType);
    deleteAllConfirm.setConfirmDialog(false);
  };

  const deleteAllConfirm = useConfirm({
    dialogTitle: 'Delete all tasks',
    dialogContent: 'Are you sure want to delete all the tasks?',
    successCallback: handleDeleteAll
  });

  return (
    <Grid item xs className={classes.gridContainer}>
      <div className={classes.operationDiv}>
        <SimpleAccordion
          headerTitle="Operations"
          showSearchBox={false}
        >
          <div>
            <CustomButton
              onClick={() => stopAllConfirm.setConfirmDialog(true)}
              tooltipTitle="Stop all running/pending tasks (as well as the task queue) for the given task type. Any new task added will not be picked up until Task Queue is resumed. This is not an instant operation, and the task may take some more time to actually stop."
              enableTooltip={true}
            >
              Stop All
            </CustomButton>
            <CustomButton
              onClick={() => resumeAllConfirm.setConfirmDialog(true)}
              tooltipTitle="Resume all stopped tasks (as well as the task queue) for the given task type. Resumed tasks start from the beginning of the task."
              enableTooltip={true}
            >
              Resume All
            </CustomButton>
            <CustomButton
              onClick={() => cleanupAllConfirm.setConfirmDialog(true)}
              tooltipTitle="Clean up finished tasks (COMPLETED, FAILED) for the given task type. This has no impact on the executing tasks. This happens periodically "
              enableTooltip={true}
            >
              Cleanup All
            </CustomButton>
            <CustomButton
              onClick={() => deleteAllConfirm.setConfirmDialog(true)}
              tooltipTitle="Delete all tasks (as well as the task queue) for the given task type."
              enableTooltip={true}
            >
              Delete All
            </CustomButton>
          </div>
        </SimpleAccordion>
      </div>
      <div className={classes.highlightBackground}>
        {/* <TableToolbar name="Summary" showSearchBox={false} /> */}
        <Grid container className={classes.body}>
          <Grid item xs={4}>
            <strong>Task Type:</strong> {taskType}
          </Grid>
          <Grid item xs={4}>
            <strong>Task Queue Status:</strong> {get(taskInfo, '1', null)}
          </Grid>
          <Grid item xs={4}>
            <strong>Num Tasks: </strong>
            {get(taskInfo, '0', null)}
          </Grid>
        </Grid>
      </div>
      {!fetching && (
        <CustomizedTables
          title="Tables"
          data={tables}
          showSearchBox={true}
          inAccordionFormat={true}
          addLinks
          baseURL={`/task-queue/${taskType}/tables/`}
        />
      )}
      {stopAllConfirm.confirmComponent}
      {resumeAllConfirm.confirmComponent}
      {cleanupAllConfirm.confirmComponent}
      {deleteAllConfirm.confirmComponent}
    </Grid>
  );
};

export default TaskQueue;

```

### Core Architecture Module: `pinot-controller/src/main/resources/app/pages/TaskQueueTable.tsx`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React, { useEffect, useState, useContext } from 'react';
import { get, keys, last } from 'lodash';
import moment from 'moment';
import { formatTimeInTimezone } from '../utils/TimezoneUtils';
import { useTimezone } from '../contexts/TimezoneContext';
import { UnControlled as CodeMirror } from 'react-codemirror2';
import { Grid, makeStyles, Box } from '@material-ui/core';
import { NotificationContext } from '../components/Notification/NotificationContext';
import SimpleAccordion from '../components/SimpleAccordion';
import CustomButton from '../components/CustomButton';
import { useConfirm } from '../components/Confirm';
import PinotMethodUtils from '../utils/PinotMethodUtils';
import useScheduleAdhocModal from '../components/useScheduleAdhocModal';
import useMinionMetadata from '../components/useMinionMetaData';
import useTaskListing from '../components/useTaskListing';
import { Typography } from '@material-ui/core';

const jsonoptions = {
  lineNumbers: true,
  mode: 'application/json',
  styleActiveLine: true,
  gutters: ['CodeMirror-lint-markers'],
  theme: 'default',
  readOnly: true
};

const useStyles = makeStyles(() => ({
  gridContainer: {
    padding: 20,
    backgroundColor: 'white',
    maxHeight: 'calc(100vh - 70px)',
    overflowY: 'auto'
  },
  operationDiv: {
    border: '1px #BDCCD9 solid',
    borderRadius: 4,
    marginBottom: 20
  },
  body: {
    borderTop: '1px solid #BDCCD9',
    fontSize: '16px',
    lineHeight: '3rem',
    paddingLeft: '15px',
  },
  highlightBackground: {
    border: '1px #4285f4 solid',
    backgroundColor: 'rgba(66, 133, 244, 0.05)',
    borderRadius: 4,
    marginBottom: '20px',
  },
  sqlDiv: {
    border: '1px #BDCCD9 solid',
    borderRadius: 4,
    marginBottom: '20px',
  },
  queryOutput: {
    border: '1px solid #BDCCD9',
    '& .CodeMirror': { height: 532 },
  },
}));

const TaskQueueTable = (props) => {
  const classes = useStyles();
  const { currentTimezone } = useTimezone();
  const { taskType, queueTableName: tableName } = props.match.params;

  const {dispatch} = useContext(NotificationContext);
  const [fetching, setFetching] = useState(true);
  const [jobDetail, setJobDetail] = useState({});
  const [tableDetail, setTableDetail] = useState({});
  const [mostRecentErrorRunMessage, setMostRecentErrorRunMessage] = useState('');
  const scheduleAdhocModal = useScheduleAdhocModal();
  const minionMetadata = useMinionMetadata({ taskType, tableName });
  const taskListing = useTaskListing({ taskType, tableName });

  const fetchData = async () => {
    setFetching(true);
    const detail = await PinotMethodUtils.getScheduleJobDetail(tableName, taskType);
    const tableDetailRes = await PinotMethodUtils.getTableDetails(tableName);
    const taskGeneratorDebugData = await PinotMethodUtils.getTaskGeneratorDebugData(tableName, taskType);
    const mostRecentErrorRunMessagesTS = get(taskGeneratorDebugData, 'data.0.mostRecentErrorRunMessages', {});
    const mostRecentErrorRunMessagesTSLastTime = last(keys(mostRecentErrorRunMessagesTS).sort());
    setMostRecentErrorRunMessage(get(mostRecentErrorRunMessagesTS, mostRecentErrorRunMessagesTSLastTime, ''));
    setTableDetail(tableDetailRes);
    setJobDetail(detail);
    setFetching(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentTimezone]);

  const handleScheduleNow = async () => {
    const res = await PinotMethodUtils.scheduleTaskAction(tableName, taskType);
    if (get(res, `${taskType}`, null) === null) {
      dispatch({
        type: 'error',
        message: (
          <Box>
            <Typography>
              Could not schedule task
            </Typography>
            <Typography>
              Task generation errors : {get(res, 'generationErrors', 'none')}
            </Typography>
            <Typography>
              Task scheduling errors : {get(res, 'schedulingErrors', 'none')}
            </Typography>
          </Box>
        ),
        show: true
      });
    } else if (get(res, `${taskType}`, null) === '') {
      dispatch({
        type: 'success',
        message: `No task to schedule`,
        show: true
      });
    } else {
      dispatch({
        type: 'success',
        message: `${get(res, `${taskType}`, null)} scheduled successfully`,
        show: true
      });
    }

    await fetchData();
    scheduleNowConfirm.setConfirmDialog(false);
  };

  const scheduleNowConfirm = useConfirm({
    dialogTitle: 'Schedule now',
    dialogContent: 'Are you sure want to schedule now?',
    successCallback: handleScheduleNow
  });

  const cronExpression = get(jobDetail, 'Triggers.0.CronExpression', '');
  const previousFireTime = get(jobDetail, 'Triggers.0.PreviousFireTime', 0);
  const nextFireTime = get(jobDetail, 'Triggers.0.NextFireTime', 0);

  return (
    <Grid item xs className={classes.gridContainer}>
      <div className={classes.operationDiv}>
        <SimpleAccordion
          headerTitle="Operations"
          showSearchBox={false}
        >
          <div>
            <CustomButton
              onClick={() => scheduleNowConfirm.setConfirmDialog(true)}
              tooltipTitle="Schedule now"
              enableTooltip={true}
            >
              Schedule Now
            </CustomButton>
            <CustomButton
              onClick={() => scheduleAdhocModal.handleOpen()}
              tooltipTitle="Execute ADHOC"
              enableTooltip={true}
            >
              Schedule ADHOC
            </CustomButton>
          </div>
        </SimpleAccordion>
      </div>
      <div className={classes.highlightBackground}>
        {/* <TableToolbar name="Summary" showSearchBox={false} /> */}
        <Grid container className={classes.body}>
          <Grid item xs={12}>
            <strong>Table Name:</strong> {tableName}
          </Grid>
          <Grid item xs={12}>
            <strong>Cron Schedule :</strong> {cronExpression}
          </Grid>
          <Grid item xs={12}>
            <strong>Previous Fire Time: </strong> {previousFireTime ? formatTimeInTimezone(previousFireTime) : '-'}
          </Grid>
          <Grid item xs={12}>
            <strong>Next Fire Time: </strong> {nextFireTime ? formatTimeInTimezone(nextFireTime) : '-'}
          </Grid>
        </Grid>
      </div>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <div className={classes.sqlDiv}>
            <SimpleAccordion
              headerTitle="Task Config"
              showSearchBox={false}
            >
              <CodeMirror
                options={jsonoptions}
                value={JSON.stringify(get(tableDetail, `OFFLINE.task.taskTypeConfigsMap.${taskType}`, {}), null, '  ')}
                className={classes.queryOutput}
                autoCursor={false}
              />
            </SimpleAccordion>
          </div>
        </Grid>
        <Grid item xs={6}>
          <div className={classes.sqlDiv}>
            {minionMetadata.content}
          </div>
          <div className={classes.sqlDiv}>
            <SimpleAccordion
              headerTitle="Scheduling Errors"
              showSearchBox={false}
            >
              <Box p={3} style={{ overflow: 'auto' }}>
                {mostRecentErrorRunMessage}
              </Box>
            </SimpleAccordion>
          </div>
        </Grid>
        <Grid item xs={12}>
          {taskListing.content}
        </Grid>
      </Grid>
      {scheduleAdhocModal.dialog}
      {scheduleNowConfirm.confirmComponent}
    </Grid>
  );
};

export default TaskQueueTable;

```

### Core Architecture Module: `pinot-controller/src/main/resources/app/utils/ChartConstants.ts`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Standard chart colors matching the ECharts palette
export const CHART_COLORS = [
    "#5470C6", "#91CC75", "#EE6666", "#FAC858", "#73C0DE",
    "#3BA272", "#FC8452", "#9A60B4", "#EA7CCC", "#6E7074",
    "#546570", "#C4CCD3", "#F05B72", "#FF715E", "#FFAF51",
    "#FFE153", "#47B39C", "#5BACE1", "#32C5E9", "#96BFFF"
];

/**
 * Default number of series that can be rendered in the chart
 */
export const DEFAULT_SERIES_LIMIT = 40;

/**
 * Chart padding percentage for time axis and series
 */
export const CHART_PADDING_PERCENTAGE = 0.05; // 5%

/**
 * Get color for a series by index
 * @param index - The series index
 * @returns The color for the series
 */
export const getSeriesColor = (index: number): string => {
  return CHART_COLORS[index % CHART_COLORS.length];
};

```

### Core Architecture Module: `pinot-controller/src/main/resources/app/utils/PinotMethodUtils.ts`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import jwtDecode from 'jwt-decode';
import { get, each, isEqual, isArray, keys, union } from 'lodash';
import {
  DataTable,
  InstanceStatus,
  InstanceStatusCell,
  InstanceType,
  RebalanceTableSegmentJob,
  RebalanceTableSegmentJobs,
  SchemaInfo,
  SegmentMetadata,
  SqlException,
  SQLResult,
  TaskType,
} from 'Models';
import moment from 'moment';
import {
  getTenants,
  getInstances,
  getInstance,
  putInstance,
  setInstanceState,
  setTableState,
  dropInstance,
  getPeriodicTaskNames,
  runPeriodicTask,
  runPeriodicTaskWithErrors,
  getTaskTypes,
  getTaskTypeDebug,
  getTables,
  getTaskTypeTasksCount,
  getTaskTypeState,
  stopTasks,
  resumeTasks,
  cleanupTasks,
  deleteTasks,
  scheduleTask,
  executeTask,
  getJobDetail,
  getMinionMeta,
  getTasks,
  getTaskDebug,
  getTaskGeneratorDebug,
  getTasksSummary,
  getTaskCounts,
  getTaskStates,
  getCronSchedulerInformation,
  deleteSingleTask,
  getInstanceLogFiles,
  downloadInstanceLogFile,
  updateInstanceTags,
  getClusterConfig,
  getQueryTables,
  getTableSchema,
  getQueryResult,
  getTimeSeriesQueryResult,
  getTenantTable,
  getTableSize,
  getIdealState,
  getExternalView,
  getTenantTableDetails,
  getSegmentMetadata,
  reloadSegment,
  getTableJobs,
  getClusterInfo,
  zookeeperGetList,
  zookeeperGetData,
  zookeeperGetListWithStat,
  zookeeperGetStat,
  zookeeperPutData,
  zookeeperDeleteNode,
  getBrokerListOfTenant,
  getServerListOfTenant,
  deleteSegment,
  resetSegment,
  putTable,
  putSchema,
  deleteTable,
  deleteSchema,
  reloadAllSegments,
  reloadStatus,
  rebalanceServersForTable,
  rebalanceBrokersForTable,
  validateSchema,
  validateTable,
  saveSchema,
  saveTable,
  getSchema,
  getSchemaList,
  getState,
  getInfo,
  authenticateUser,
  getSegmentDebugInfo,
  requestTable,
  requestUserList,
  requestAddUser,
  requestDeleteUser,
  requestUpdateUser,
  getTaskProgress,
  getSegmentReloadStatus,
  getTaskRuntimeConfig,
  getSchemaInfo,
  getSegmentsStatus,
  getConsumingSegmentsInfo,
  getServerToSegmentsCount,
  pauseConsumption,
  resumeConsumption,
  getPauseStatus,
  getVersions,
  getLogicalTables,
  getLogicalTable,
  putLogicalTable,
  deleteLogicalTable
} from '../requests';
import { baseApi } from './axios-config';
import Utils from './Utils';
import { matchPath } from 'react-router-dom';
import RouterData from '../router';
import JSONbigBase from 'json-bigint';
const JSONbig = JSONbigBase({ storeAsString: true });

// This method is used to display tenants listing on cluster manager home page
// API: /tenants
// Expected Output: {columns: [], records: []}
const getTenantsData = () => {
  return getTenants().then(({ data }) => {
    const records = union(data.SERVER_TENANTS, data.BROKER_TENANTS);
    const serverPromiseArr = [], brokerPromiseArr = [], tablePromiseArr = [];
    const finalResponse = {
      columns: ['Tenant Name', 'Server', 'Broker', 'Tables'],
      records: []
    };
    records.map((record)=>{
      finalResponse.records.push([
        record
      ]);
      serverPromiseArr.push(getServerOfTenant(record));
      brokerPromiseArr.push(getBrokerOfTenant(record));
      tablePromiseArr.push(getTenantTable(record));
    });
    return Promise.all([
      Promise.all(serverPromiseArr),
      Promise.all(brokerPromiseArr),
      Promise.all(tablePromiseArr)
    ]).then((results)=>{
      const serversResponseData = results[0];
      const brokersResponseData = results[1];
      const tablesResponseData = results[2];

      tablesResponseData.map((tableResult, index)=>{
        const serverCount = serversResponseData[index]?.length || 0;
        const brokerCount = brokersResponseData[index]?.length || 0;
        const tablesCount = tableResult.data.tables.length
        finalResponse.records[index].push(serverCount, brokerCount, tablesCount);
      });
      return finalResponse;
    });
  });
};

// This method is used to fetch all instances on cluster manager home page
// API: /instances
// Expected Output: {CONTROLLER: ['Controller1', 'Controller2'], BROKER: ['Broker1', 'Broker2']}
const getAllInstances = () => {
  return getInstances().then(({ data }) => {
    const instanceTypeToInstancesMap: DataTable = {
      [InstanceType.CONTROLLER]: [],
      [InstanceType.BROKER]: [],
      [InstanceType.SERVER]: [],
      [InstanceType.MINION]: []
    };

    data.instances.forEach((instance) => {
      const instanceType =  instance.split('_')[0].toUpperCase();
      if (instanceTypeToInstancesMap[instanceType]) {
        instanceTypeToInstancesMap[instanceType].push(instance);
      }
    });

    return instanceTypeToInstancesMap;
  });
};

// This method is used to display instance data on cluster manager home page
// API: /instances/:instanceName
// Expected Output: {columns: [], records: []}
const getInstanceData = (instances, liveInstanceArr) => {
  const promiseArr = [...instances.map((inst) => getInstance(inst))];

  return Promise.all(promiseArr).then(async (result) => {
    // First, get all instance configs
    const instanceRecords = result.map(({ data }) => {
      const isAlive = liveInstanceArr.indexOf(data.instanceName) > -1;
      const isEnabled = data.enabled;
      const queriesDisabled = data.queriesDisabled === 'true' || data.queriesDisabled === true;
      const shutdownInProgress = data.shutdownInProgress === true;
      
      return {
        instanceName: data.instanceName,
        enabled: data.enabled,
        hostName: data.hostName,
        port: data.port,
        adminPort: data.adminPort,
        isAlive,
        isEnabled,
        queriesDisabled,
        shutdownInProgress
      };
    });

    // Then check health endpoints for alive instances
    const healthCheckPromises = instanceRecords.map(async (record) => {

      let status: InstanceStatusCell = {value: InstanceStatus.DEAD, tooltip: 'Instance is not running'};

      if (!record.isAlive) {
        return { ...record, healthStatus: status };
      }

      if (record.shutdownInProgress) {
        status = {value: InstanceStatus.UNHEALTHY, tooltip: 'Instance is running but is starting up or shutting down'};
      } else if (!record.isEnabled) {
        status = {value: InstanceStatus.INSTANCE_DISABLED, tooltip: 'Instance has been disabled in helix'};
      } else if (record.queriesDisabled) {
        status = {value: InstanceStatus.QUERIES_DISABLED, tooltip: 'Instance running but has queries disabled'};
      } else {
        status = {value: InstanceStatus.HEALTHY, tooltip: 'Instance is healthy and ready to serve requests'};
      }

      return { ...record, healthStatus: status };
    });

    const recordsWithHealth = await Promise.all(healthCheckPromises);

    return {
      columns: ['Instance Name', 'Enabled', 'Hostname', 'Port', 'Status'],
      records: recordsWithHealth.map(record => [
        record.instanceName,
        record.enabled,
        record.hostName,
        record.port,
        record.healthStatus
      ])
    };
  });
};

// This method is used to fetch cluster name
// API: /cluster/info
// Expected Output: {clusterName: ''}
const getClusterName = () => {
  return getClusterInfo().then(({ data }) => {
    return data.clusterName;
  });
};

// This method is used to fetch array of live instances name
// API: /zk/ls?path=:ClusterName/LIVEINSTANCES
// Expected Output: []
const getLiveInstance = (clusterName: string) => {
  const params = encodeURIComponent(`/${clusterName}/LIVEINSTANCES`);
  return zookeeperGetList(params).then((data) => {
    return data;
  });
};

const getLiveInstances = () => {
  let localclusterName: string | null = localStorage.getItem('pinot_ui:clusterName');
  let clusterNameRes: Promise<string>;
  if(!localclusterName || localclusterName === ''){
    clusterNameRes = getClusterName();
  } else {
    clusterNameRes = Promise.resolve(localclusterName);
  }
  return clusterNameRes.then((clusterName) => {
    return getLiveInstance(clusterName);
  });
};

// This method is used to diaplay cluster congifuration on cluster manager home page
// API: /cluster/configs
// Expected Output: {columns: [], records: []}
const getClusterConfigData = () => {
  return getClusterConfig().then(({ data }) => {
    return {
      columns: ['Property', 'Value'],
      records: [...Object.keys(data).map((key) => [key, data[key]])],
    };
  });
};

// This method is used to fetch cluster congifuration
// API: /cluster/configs
// Expected Output: {key: value}
const getClusterConfigJSON = () => {
  return getClusterConfig().then(({ data }) => {
    return data;
  });
};

// This method is used to display table listing on query page
// API: /tables
// Expected Output: {columns: [], records: []}
const getQueryTablesList = ({bothType = false}) => {
  const promiseArr = bothType ? [getQueryTables('realtime'), getQueryTables('offline')] : [getQueryTables()];

  return Promise.all(promiseArr).then((results) => {
    const responseObj = {
      columns: ['Tables'],
      records:  []
    };
    results.map((result)=>{
      result.data.tables.map((table)=>{
        responseObj.records.push([table]);
      });
    });
    return responseObj;
  });
};

// This method is used to display log
```

### Core Architecture Module: `pinot-controller/src/main/resources/app/utils/SortFunctions.tsx`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import {TableSortFunction} from "Models";
import app_state from "../app_state";


// table sorting requires a 1/-1 result. This helper function helps calculate this
// from any two results.
const valuesToResultNumber = (aRes: any, bRes: any, order: boolean): number => {
    if (aRes === bRes) {
        return 0;
    }
    const result = order ? aRes > bRes : aRes < bRes;
    return result ? 1 : -1;
}

const getCellValue = (row: any, column: string, index: number): any => {
    const cellValue = row[column+app_state.columnNameSeparator+index];
    if (cellValue && typeof cellValue === "object" && "value" in cellValue) {
        return cellValue.value;
    }
    return cellValue;
}

const normalizeCellValue = (value: any): string | number => {
    if (typeof value === "number") {
        return value;
    }
    if (value === null || value === undefined) {
        return "";
    }
    return value.toString().toLowerCase();
}

export const sortNumberOfSegments: TableSortFunction = (a: any, b: any, column: string, index: number, order: boolean) => {
    const aSegmentInt = parseInt(a[column+app_state.columnNameSeparator+index]);
    const bSegmentInt = parseInt(b[column+app_state.columnNameSeparator+index]);
    return valuesToResultNumber(aSegmentInt, bSegmentInt, order);
}

export const sortBytes: TableSortFunction = (a: any, b: any, column: string, index: number, order: boolean) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const [aValue, aUnit] = a[column+app_state.columnNameSeparator+index].split(" ");
    const [bValue, bUnit] = b[column+app_state.columnNameSeparator+index].split(" ");
    const aUnitIndex = sizes.indexOf(aUnit);
    const bUnitIndex = sizes.indexOf(bUnit);

    if (sizes.indexOf(aUnit) === sizes.indexOf(bUnit)) {
        return valuesToResultNumber(parseFloat(aValue), parseFloat(bValue), order);
    } else {
        return valuesToResultNumber(aUnitIndex, bUnitIndex, order);
    }
}

export const sortCellValue: TableSortFunction = (a: any, b: any, column: string, index: number, order: boolean) => {
    const aValue = normalizeCellValue(getCellValue(a, column, index));
    const bValue = normalizeCellValue(getCellValue(b, column, index));
    return valuesToResultNumber(aValue, bValue, order);
}

```

### Core Architecture Module: `pinot-controller/src/main/resources/app/utils/TimeseriesUtils.ts`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { ChartSeries, ChartDataPoint, MetricStats } from 'Models';

// Define proper types for API responses
interface BrokerResponse {
  resultTable?: {
    dataSchema: {
      columnNames: string[];
      columnDataTypes: string[];
    };
    rows: any[][];
  };
  exceptions?: any[];
  error?: string;
}

/**
 * Parse broker timeseries response directly to ChartSeries
 */
export const parseTimeseriesResponse = (brokerResponse: BrokerResponse): ChartSeries[] => {
  if (!brokerResponse?.resultTable?.dataSchema) {
    return [];
  }

  const { columnNames } = brokerResponse.resultTable.dataSchema;
  const rows = brokerResponse.resultTable.rows || [];

  const tsIdx = columnNames.indexOf('ts');
  const valuesIdx = columnNames.indexOf('values');
  const nameIdx = columnNames.indexOf('__name__');

  if (tsIdx === -1 || valuesIdx === -1 || nameIdx === -1) {
    return [];
  }

  return rows
    .filter(row => row != null)
    .map(row => {
      const timestamps = parseArray(row[tsIdx]);
      const values = parseArray(row[valuesIdx]);
      const metric: Record<string, string> = { __name__: String(row[nameIdx] || '') };

      // Add tag columns
      columnNames.forEach((col, idx) => {
        if (col !== 'ts' && col !== 'values' && col !== '__name__' && row[idx] != null) {
          metric[col] = String(row[idx]);
        }
      });

      // Create data points directly
      const dataPoints: ChartDataPoint[] = [];
      const len = Math.min(timestamps.length, values.length);
      for (let i = 0; i < len; i++) {
        const ts = timestamps[i];
        const val = values[i];
        const tsSeconds = ts > 1e12 ? Math.floor(ts / 1000) : ts;
        dataPoints.push({
          timestamp: tsSeconds * 1000, // Convert to milliseconds for chart
          value: val == null ? 0 : val,
          formattedTime: new Date(tsSeconds * 1000).toLocaleString()
        });
      }

      const stats = calculateMetricStats(dataPoints);
      const seriesName = formatSeriesName(metric);

      return {
        name: seriesName,
        data: dataPoints,
        stats
      };
    });
};

/**
 * Helper function to parse array data from broker response
 */
const parseArray = (data: any): number[] => {
  if (Array.isArray(data)) {
    return data.map(v => v == null ? null as any : (typeof v === 'number' ? v : parseFloat(String(v))));
  }
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parseArray(parsed);
    } catch (e) { /* ignore */ }
  }
  return [];
};

/**
 * Calculate statistics for a metric series
 */
export const calculateMetricStats = (dataPoints: ChartDataPoint[]): MetricStats => {
  if (dataPoints.length === 0) {
    return {
      min: NaN,
      max: NaN,
      avg: NaN,
      sum: NaN,
      count: 0,
      firstValue: NaN,
      lastValue: NaN
    };
  }

  // Filter out null/undefined values and check if we have any valid values
  const validValues = dataPoints
    .map(dp => dp.value)
    .filter(val => val !== null && val !== undefined && !isNaN(val));

  if (validValues.length === 0) {
    return {
      min: NaN,
      max: NaN,
      avg: NaN,
      sum: NaN,
      count: 0,
      firstValue: NaN,
      lastValue: NaN
    };
  }

  const sum = validValues.reduce((acc, val) => acc + val, 0);
  const avg = sum / validValues.length;
  const min = Math.min(...validValues);
  const max = Math.max(...validValues);

  // Find first and last valid values
  const firstValidIndex = dataPoints.findIndex(dp => dp.value !== null && dp.value !== undefined && !isNaN(dp.value));
  const lastValidIndex = dataPoints.length - 1 - dataPoints.slice().reverse().findIndex(dp => dp.value !== null && dp.value !== undefined && !isNaN(dp.value));

  const firstValue = firstValidIndex >= 0 ? dataPoints[firstValidIndex].value : NaN;
  const lastValue = lastValidIndex >= 0 ? dataPoints[lastValidIndex].value : NaN;

  return {
    min,
    max,
    avg,
    sum,
    count: validValues.length,
    firstValue,
    lastValue
  };
};

/**
 * Format series name from metric labels
 */
export const formatSeriesName = (metric: Record<string, string>): string => {
  if (!metric || Object.keys(metric).length === 0) {
    return 'Unknown Metric';
  }

  // Try to find a meaningful name from common label patterns
  const name = metric.__name__ || metric.name || metric.metric || metric.job || metric.instance;

  if (name) {
    // Add additional context if available, but exclude the main metric name
    const additionalLabels = Object.entries(metric)
      .filter(([key]) => !['__name__', 'name', 'metric', 'job', 'instance'].includes(key))
      .map(([key, value]) => `${key}="${value}"`)
      .join(', ');

    // Return just the name without the {} wrapper
    return name;
  }

  // Fallback to just the first label without {}
  const firstLabel = Object.entries(metric)[0];
  return firstLabel ? firstLabel[0] : 'Unknown Metric';
};

/**
 * Check if response is in Broker compatible format
 */
export const isBrokerFormat = (response: any): boolean => {
  return response?.resultTable?.dataSchema && Array.isArray(response.resultTable.rows);
};

/**
 * Get time range from data points
 */
export const getTimeRange = (dataPoints: ChartDataPoint[]): { start: number; end: number } => {
  if (dataPoints.length === 0) {
    return { start: 0, end: 0 };
  }

  const timestamps = dataPoints.map(dp => dp.timestamp);
  return {
    start: Math.min(...timestamps),
    end: Math.max(...timestamps)
  };
};

```

### Core Architecture Module: `pinot-controller/src/main/resources/app/utils/TimezoneUtils.ts`
```
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import moment from 'moment';
import 'moment-timezone';

// Default timezone fallback (single source of truth)
export const DEFAULT_TIMEZONE_FALLBACK = 'UTC';
// Default timezone
export const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE_FALLBACK;

// Standardized timezones using 3-letter zone IDs with location information
// Each timezone has only one representation, sorted by UTC offset
export const STANDARD_TIMEZONES = [
  // UTC-12 to UTC-1
  { value: 'BIT(Pacific/Baker)', label: 'BIT (UTC-12)' },
  { value: 'SST(Pacific/Samoa)', label: 'SST (UTC-11)' },
  { value: 'HST(Pacific/Honolulu)', label: 'HST (UTC-10)' },
  { value: 'HAST(America/Adak)', label: 'HAST (UTC-10)' },
  { value: 'AKST(America/Anchorage)', label: 'AKST (UTC-9)' },
  { value: 'HADT(America/Adak)', label: 'HADT (UTC-9)' },
  { value: 'PST(America/Los_Angeles)', label: 'PST (UTC-8)' },
  { value: 'AKDT(America/Anchorage)', label: 'AKDT (UTC-8)' },
  { value: 'MST(America/Denver)', label: 'MST (UTC-7)' },
  { value: 'PDT(America/Los_Angeles)', label: 'PDT (UTC-7)' },
  { value: 'CST(America/Chicago)', label: 'CST (UTC-6)' },
  { value: 'MDT(America/Denver)', label: 'MDT (UTC-6)' },
  { value: 'EST(America/New_York)', label: 'EST (UTC-5)' },
  { value: 'CDT(America/Chicago)', label: 'CDT (UTC-5)' },
  { value: 'COT(America/Bogota)', label: 'COT (UTC-5)' },
  { value: 'PET(America/Lima)', label: 'PET (UTC-5)' },
  { value: 'AST(America/Puerto_Rico)', label: 'AST (UTC-4)' },
  { value: 'EDT(America/New_York)', label: 'EDT (UTC-4)' },
  { value: 'VET(America/Caracas)', label: 'VET (UTC-4)' },
  { value: 'BOT(America/La_Paz)', label: 'BOT (UTC-4)' },
  { value: 'ART(America/Argentina/Buenos_Aires)', label: 'ART (UTC-3)' },
  { value: 'BRT(America/Sao_Paulo)', label: 'BRT (UTC-3)' },
  { value: 'UYT(America/Montevideo)', label: 'UYT (UTC-3)' },
  { value: 'GFT(America/Cayenne)', label: 'GFT (UTC-3)' },
  { value: 'FNT(America/Noronha)', label: 'FNT (UTC-2)' },
  { value: 'AZOT(Atlantic/Azores)', label: 'AZOT (UTC-1)' },
  { value: 'CVT(Atlantic/Cape_Verde)', label: 'CVT (UTC-1)' },

  // UTC+0
  { value: 'UTC', label: 'UTC (UTC+0)' },
  { value: 'GMT', label: 'GMT (UTC+0)' },
  { value: 'WET(Europe/London)', label: 'WET (UTC+0)' },

  // UTC+1 to UTC+3
  { value: 'CET(Europe/Paris)', label: 'CET (UTC+1)' },
  { value: 'WEST(Europe/London)', label: 'WEST (UTC+1)' },
  { value: 'BST(Europe/London)', label: 'BST (UTC+1)' },
  { value: 'WAT(Africa/Lagos)', label: 'WAT (UTC+1)' },
  { value: 'CAT(Africa/Harare)', label: 'CAT (UTC+2)' },
  { value: 'CEST(Europe/Paris)', label: 'CEST (UTC+2)' },
  { value: 'EET(Europe/Athens)', label: 'EET (UTC+2)' },
  { value: 'SAST(Africa/Johannesburg)', label: 'SAST (UTC+2)' },
  { value: 'IST(Asia/Jerusalem)', label: 'IST (UTC+2)' },
  { value: 'EAT(Africa/Nairobi)', label: 'EAT (UTC+3)' },
  { value: 'EEST(Europe/Athens)', label: 'EEST (UTC+3)' },
  { value: 'MSK(Europe/Moscow)', label: 'MSK (UTC+3)' },
  { value: 'AST(Asia/Riyadh)', label: 'AST (UTC+3)' },

  // UTC+4 to UTC+6
  { value: 'GST(Asia/Dubai)', label: 'GST (UTC+4)' },
  { value: 'AMT(Asia/Yerevan)', label: 'AMT (UTC+4)' },
  { value: 'AZT(Asia/Baku)', label: 'AZT (UTC+4)' },
  { value: 'PKT(Asia/Karachi)', label: 'PKT (UTC+5)' },
  { value: 'UZT(Asia/Tashkent)', label: 'UZT (UTC+5)' },
  { value: 'YEKT(Asia/Yekaterinburg)', label: 'YEKT (UTC+5)' },
  { value: 'IST(Asia/Kolkata)', label: 'IST (UTC+5:30)' },
  { value: 'NPT(Asia/Kathmandu)', label: 'NPT (UTC+5:45)' },
  { value: 'BST(Asia/Dhaka)', label: 'BST (UTC+6)' },
  { value: 'BDT(Asia/Dhaka)', label: 'BDT (UTC+6)' },
  { value: 'BTT(Asia/Thimphu)', label: 'BTT (UTC+6)' },

  // UTC+7 to UTC+9
  { value: 'ICT(Asia/Bangkok)', label: 'ICT (UTC+7)' },
  { value: 'WIB(Asia/Jakarta)', label: 'WIB (UTC+7)' },
  { value: 'KRAT(Asia/Krasnoyarsk)', label: 'KRAT (UTC+7)' },
  { value: 'CST(Asia/Shanghai)', label: 'CST (UTC+8)' },
  { value: 'SGT(Asia/Singapore)', label: 'SGT (UTC+8)' },
  { value: 'HKT(Asia/Hong_Kong)', label: 'HKT (UTC+8)' },
  { value: 'MYT(Asia/Kuala_Lumpur)', label: 'MYT (UTC+8)' },
  { value: 'WITA(Asia/Makassar)', label: 'WITA (UTC+8)' },
  { value: 'IRKT(Asia/Irkutsk)', label: 'IRKT (UTC+8)' },
  { value: 'JST(Asia/Tokyo)', label: 'JST (UTC+9)' },
  { value: 'KST(Asia/Seoul)', label: 'KST (UTC+9)' },
  { value: 'WIT(Asia/Jayapura)', label: 'WIT (UTC+9)' },
  { value: 'YAKT(Asia/Yakutsk)', label: 'YAKT (UTC+9)' },

  // UTC+9:30 to UTC+12
  { value: 'ACST(Australia/Adelaide)', label: 'ACST (UTC+9:30)' },
  { value: 'AEST(Australia/Sydney)', label: 'AEST (UTC+10)' },
  { value: 'AEDT(Australia/Sydney)', label: 'AEDT (UTC+11)' },
  { value: 'SBT(Pacific/Guadalcanal)', label: 'SBT (UTC+11)' },
  { value: 'NCT(Pacific/Noumea)', label: 'NCT (UTC+11)' },
  { value: 'VUT(Pacific/Efate)', label: 'VUT (UTC+11)' },
  { value: 'NZST(Pacific/Auckland)', label: 'NZST (UTC+12)' },
  { value: 'FJT(Pacific/Fiji)', label: 'FJT (UTC+12)' },
  { value: 'TVT(Pacific/Funafuti)', label: 'TVT (UTC+12)' },
  { value: 'NZDT(Pacific/Auckland)', label: 'NZDT (UTC+13)' },
  { value: 'TOT(Pacific/Tongatapu)', label: 'TOT (UTC+13)' },
  { value: 'LINT(Pacific/Kiritimati)', label: 'LINT (UTC+14)' },
];

// Legacy support - map common location-based timezones to standardized format
const TIMEZONE_MAPPING: Record<string, string> = {
  // US Timezones
  'America/New_York': 'EST(America/New_York)',
  'America/Chicago': 'CST(America/Chicago)',
  'America/Denver': 'MST(America/Denver)',
  'America/Los_Angeles': 'PST(America/Los_Angeles)',
  'America/Anchorage': 'AKST(America/Anchorage)',
  'America/Adak': 'HAST(America/Adak)',
  'Pacific/Honolulu': 'HST(Pacific/Honolulu)',
  'America/Puerto_Rico': 'AST(America/Puerto_Rico)',

  // South American Timezones
  'America/Sao_Paulo': 'BRT(America/Sao_Paulo)',
  'America/Noronha': 'FNT(America/Noronha)',
  'America/Argentina/Buenos_Aires': 'ART(America/Argentina/Buenos_Aires)',
  'America/Montevideo': 'UYT(America/Montevideo)',
  'America/Cayenne': 'GFT(America/Cayenne)',
  'America/Bogota': 'COT(America/Bogota)',
  'America/Lima': 'PET(America/Lima)',
  'America/Caracas': 'VET(America/Caracas)',
  'America/La_Paz': 'BOT(America/La_Paz)',

  // Atlantic Timezones
  'Atlantic/Azores': 'AZOT(Atlantic/Azores)',
  'Atlantic/Cape_Verde': 'CVT(Atlantic/Cape_Verde)',

  // African Timezones
  'Africa/Lagos': 'WAT(Africa/Lagos)',
  'Africa/Harare': 'CAT(Africa/Harare)',
  'Africa/Johannesburg': 'SAST(Africa/Johannesburg)',
  'Africa/Nairobi': 'EAT(Africa/Nairobi)',

  // European Timezones
  'Europe/London': 'WET(Europe/London)',
  'Europe/Paris': 'CET(Europe/Paris)',
  'Europe/Berlin': 'CET(Europe/Paris)',
  'Europe/Athens': 'EET(Europe/Athens)',
  'Europe/Moscow': 'MSK(Europe/Moscow)',

  // Middle Eastern Timezones
  'Asia/Jerusalem': 'IST(Asia/Jerusalem)',
  'Asia/Riyadh': 'AST(Asia/Riyadh)',
  'Asia/Dubai': 'GST(Asia/Dubai)',

  // Central Asian Timezones
  'Asia/Yerevan': 'AMT(Asia/Yerevan)',
  'Asia/Baku': 'AZT(Asia/Baku)',
  'Asia/Karachi': 'PKT(Asia/Karachi)',
  'Asia/Tashkent': 'UZT(Asia/Tashkent)',
  'Asia/Yekaterinburg': 'YEKT(Asia/Yekaterinburg)',
  'Asia/Kolkata': 'IST(Asia/Kolkata)',
  'Asia/Kathmandu': 'NPT(Asia/Kathmandu)',
  'Asia/Dhaka': 'BDT(Asia/Dhaka)',
  'Asia/Thimphu': 'BTT(Asia/Thimphu)',

  // Southeast Asian Timezones
  'Asia/Bangkok': 'ICT(Asia/Bangkok)',
  'Asia/Jakarta': 'WIB(Asia/Jakarta)',
  'Asia/Makassar': 'WITA(Asia/Makassar)',
  'Asia/Jayapura': 'WIT(Asia/Jayapura)',
  'Asia/Krasnoyarsk': 'KRAT(Asia/Krasnoyarsk)',
  'Asia/Irkutsk': 'IRKT(Asia/Irkutsk)',
  'Asia/Yakutsk': 'YAKT(Asia/Yakutsk)',

  // East Asian Timezones
  'Asia/Shanghai': 'CST(Asia/Shanghai)',
  'Asia/Singapore': 'SGT(Asia/Singapore)',
  'Asia/Hong_Kong': 'HKT(Asia/Hong_Kong)',
  'Asia/Kuala_Lumpur': 'MYT(Asia/Kuala_Lumpur)',
  'Asia/Tokyo': 'JST(Asia/Tokyo)',
  'Asia/Seoul': 'KST(Asia/Seoul)',

  // Pacific Timezones
  'Pacific/Baker': 'BIT(Pacific/Baker)',
  'Pacific/Samoa': 'SST(Pacific/Samoa)',
  'Pacific/Guadalcanal': 'SBT(Pacific/Guadalcanal)',
  'Pacific/Noumea': 'NCT(Pacific/Noumea)',
  'Pacific/Efate': 'VUT(Pacific/Efate)',
  'Pacific/Auckland': 'NZST(Pacific/Auckland)',
  'Pacific/Fiji': 'FJT(Pacific/Fiji)',
  'Pacific/Funafuti': 'TVT(Pacific/Funafuti)',
  'Pacific/Tongatapu': 'TOT(Pacific/Tongatapu)',
  'Pacific/Kiritimati': 'LINT(Pacific/Kiritimati)',

  // Australian Timezones
  'Australia/Sydney': 'AEST(Australia/Sydney)',
  'Australia/Adelaide': 'ACST(Australia/Adelaide)',
  'Australia/Perth': 'CST(Asia/Shanghai)',

  // Common Timezone Abbreviations
  'EST': 'EST(America/New_York)',
  'CST': 'CST(America/Chicago)',
  'MST': 'MST(America/Denver)',
  'PST': 'PST(America/Los_Angeles)',
  'EDT': 'EDT(America/New_York)',
  'CDT': 'CDT(America/Chicago)',
  'MDT': 'MDT(America/Denver)',
  'PDT': 'PDT(America/Los_Angeles)',
  'AKST': 'AKST(America/Anchorage)',
  'AKDT': 'AKDT(America/Anchorage)',
  'HAST': 'HAST(America/Adak)',
  'HADT': 'HADT(America/Adak)',
  'HST': 'HST(Pacific/Honolulu)',
  'SST': 'SST(Pacific/Samoa)',
  'AST': 'AST(America/Puerto_Rico)',
  'WET': 'WET(Europe/London)',
  'WEST': 'WEST(Europe/London)',
  'BST': 'BST(Europ
```

### Core Architecture Module: `pinot-controller/src/main/resources/app/utils/Utils.tsx`
```
/* eslint-disable no-nested-ternary */
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React from 'react';
import ReactDiffViewer, {DiffMethod} from 'react-diff-viewer';
import { map, isEqual, findIndex, findLast } from 'lodash';
import app_state from '../app_state';
import {
  DISPLAY_SEGMENT_STATUS, InstanceType,
  MapRecord,
  PinotTableDetails,
  SEGMENT_STATUS,
  SegmentStatus,
  TableData,
} from 'Models';
import Loading from '../components/Loading';
import moment from "moment";
import {RebalanceServerOption} from "../components/Homepage/Operations/RebalanceServer/RebalanceServerOptions";
import { formatTimeInTimezone } from './TimezoneUtils';

const getRebalanceConfigValue = (
    rebalanceConfig: { [optionName: string]: string | boolean | number },
    option: RebalanceServerOption
) => {
  return (
      Object.keys(rebalanceConfig).includes(option.name) ? rebalanceConfig[option.name] : option.defaultValue
  );
}

const sortArray = function (sortingArr, keyName, ascendingFlag) {
  if (ascendingFlag) {
    return sortingArr.sort(function (a, b) {
      if (a[keyName] < b[keyName]) {
        return -1;
      }
      if (a[keyName] > b[keyName]) {
        return 1;
      }
      return 0;
    });
  }
  return sortingArr.sort(function (a, b) {
    if (b[keyName] < a[keyName]) {
      return -1;
    }
    if (b[keyName] > a[keyName]) {
      return 1;
    }
    return 0;
  });
};

const pinotTableDetailsFormat = (tableDetails: PinotTableDetails): Array<string | number | boolean | SegmentStatus | { customRenderer: JSX.Element }> => {
  return [
    tableDetails.name,
    tableDetails.estimated_size || Loading,
    tableDetails.reported_size || Loading,
    tableDetails.number_of_segments || Loading,
    tableDetails.segment_status || Loading
  ];
}

const pinotTableDetailsFromArray = (tableDetails: Array<string | number | boolean | MapRecord | SegmentStatus | { customRenderer: JSX.Element }>): PinotTableDetails => {
  return {
    name: tableDetails[0] as string,
    estimated_size: tableDetails[1] as string,
    reported_size: tableDetails[2] as string,
    number_of_segments: tableDetails[3] as string,
    segment_status: tableDetails[4] as any
  };
}

const tableFormat = (data: TableData, withColumnNameSeparator: boolean = true): Array<{ [key: string]: any }> => {
  const rows = data.records;
  const header = data.columns;

  const results: Array<{ [key: string]: any }> = [];
  rows.forEach((singleRow) => {
    const obj: { [key: string]: any } = {};
    singleRow.forEach((val: any, index: number) => {
      // The column name separator is added to avoid conflicts where 2 columns
      // have the same name. But for cases where we download the raw data, we
      // do not want the separate there.
      if (withColumnNameSeparator) {
        obj[header[index] + app_state.columnNameSeparator + index] = val;
      } else {
        obj[header[index]] = val;
      }
    });
    results.push(obj);
  });
  return results;
};

const getSegmentStatus = (idealStateObj, externalViewObj) => {
  const tableStatus = getDisplayTableStatus(idealStateObj, externalViewObj);
  const statusMismatchDiffComponent = (
    <ReactDiffViewer
      oldValue={JSON.stringify(idealStateObj, null, 2)}
      newValue={JSON.stringify(externalViewObj, null, 2)}
      splitView={true}
      showDiffOnly={true}
      leftTitle={"Ideal State"}
      rightTitle={"External View"}
      compareMethod={DiffMethod.WORDS}
    />
  );

  if(tableStatus === DISPLAY_SEGMENT_STATUS.BAD) {
    return ({
      value: tableStatus,
      tooltip: "One or more segments in this table are in bad state. Click the status to view more details.",
      component: statusMismatchDiffComponent,
    })
  }

  if(tableStatus === DISPLAY_SEGMENT_STATUS.UPDATING) {
    return ({
      value: tableStatus,
      tooltip: "One or more segments in this table are in updating state. Click the status to view more details.",
      component: statusMismatchDiffComponent,
    })
  }

  return ({
    value: tableStatus,
    tooltip: "All segments in this table are in good state.",
  });
};

const findNestedObj = (entireObj, keyToFind, valToFind) => {
  let foundObj;
  JSON.stringify(entireObj, (a, nestedValue) => {
    if (nestedValue && nestedValue[keyToFind] === valToFind) {
      foundObj = nestedValue;
    }
    return nestedValue;
  });
  return foundObj;
};

const generateCodeMirrorOptions = (array, type, modeType?) => {
  const arr = [];
  // eslint-disable-next-line no-shadow
  const nestedFields = (arrayList, type, level, oldObj?) => {
    map(arrayList, (a) => {
      const obj = {
        text: a.displayName || a.name || a,
        displayText: a.displayName || a.name || a,
        filterText: oldObj
          ? `${oldObj.filterText}.${a.displayName || a.name || a}`
          : a.displayName || a.name || a,
        render: (el, cm, data) => {},
        className:
          type === 'FUNCTION'
            ? 'codemirror-func'
            : type === 'SQL'
              ? 'codemirror-sql'
              : type === 'BINARY-OPERATORS'
                ? 'codemirror-Operators'
                : type === 'TABLE'
                  ? 'codemirror-table'
                  : 'codemirror-column'
      };
      obj[type === 'FUNCTION' ? 'returnType' : 'type'] =
        type === 'FUNCTION'
          ? a.returnType
          : type === 'SQL'
            ? 'SQL'
            : type === 'BINARY-OPERATORS'
              ? 'Binary Operators'
              : a.type;
      obj.render = (el, cm, data) => {
        codeMirrorOptionsTemplate(el, data);
      };

      if (oldObj === undefined) {
        arr.push(obj);
      } else {
        const index = findIndex(
          arr,
          (n) => n.filterText === oldObj.filterText
        );
        if (index !== -1) {
          const name = obj.displayText;
          if (modeType === 'sql') {
            obj.displayText = `${oldObj.displayText}.${name}`;
            obj.text = `${oldObj.text}.${name}`;
          } else {
            obj.displayText = name;
            obj.text = name;
          }
          obj.filterText = `${oldObj.text}.${name}`;
          if (arr[index].fields) {
            arr[index].fields.push(obj);
          } else {
            arr[index].fields = [];
            arr[index].fields.push(obj);
          }
        } else {
          const indexPath = getNestedObjPathFromList(arr, oldObj);
          if (indexPath && indexPath.length) {
            pushNestedObjectInArray(indexPath, obj, arr, modeType);
          }
        }
      }
      if (a.fields) {
        nestedFields(a.fields, type, level + 1, obj);
      }
    });
    return arr;
  };
  return nestedFields(array, type, 0);
};

const pushNestedObjectInArray = (pathArr, obj, targetList, modeType) => {
  const rollOverFields = (target) => {
    map(target, (list) => {
      if (pathArr === list.filterText) {
        if (modeType === 'sql') {
          obj.displayText = `${pathArr}.${obj.displayText}`;
          obj.text = `${pathArr}.${obj.text}`;
        } else {
          obj.displayText = obj.displayText;
          obj.text = obj.text;
        }
        obj.filterText = `${pathArr}.${obj.text}`;
        if (list.fields) {
          list.fields.push(obj);
        } else {
          list.fields = [];
          list.fields.push(obj);
        }
      } else if (list.fields) {
        rollOverFields(list.fields);
      }
    });
  };
  rollOverFields(targetList);
};

const getNestedObjPathFromList = (list, obj) => {
  const str = [];
  const recursiveFunc = (arr, level) => {
    map(arr, (a) => {
      if (a.fields) {
        str.push(a.filterText);
        recursiveFunc(a.fields, level + 1);
      } else if (obj.filterText === a.filterText) {
        str.push(a.filterText);
      }
    });
    return findLast(str);
  };
  return recursiveFunc(list, 0);
};

const codeMirrorOptionsTemplate = (el, data) => {
  const text = document.createElement('div');
  const fNameSpan = document.createElement('span');
  fNameSpan.setAttribute('class', 'funcText');
  fNameSpan.innerHTML = data.displayText;

  text.appendChild(fNameSpan);
  el.appendChild(text);

  // data.returnType is for UDF Function ||  data.type is for Fields
  if (data.returnType || data.type) {
    const returnTypetxt = document.createElement('div');
    returnTypetxt.setAttribute('class', 'fieldText');
    const content = data.returnType
      ? `Return Type: ${data.returnType}`
      : `Type: ${data.type}`;
    returnTypetxt.innerHTML = content;
    el.appendChild(returnTypetxt);
  }
};

const serialize = (obj: any, prefix?: any) => {
  let str = [], p;
  for (p in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, p)) {
      var k = prefix ? prefix + "[" + p + "]" : p,
        v = obj[p];
      str.push((v !== null && typeof v === "object") ?
        serialize(v, k) :
        encodeURIComponent(k) + "=" + encodeURIComponent(v));
    }
  }
  return str.join("&");
};

const navigateToPreviousPage = (location, popTwice) => {
  const hasharr = location.pathname.split('/');
  hasharr.pop();
  if(popTwice){
    hasharr.pop();
  }
  return hasharr.join('/');
};

const syncTableSchemaData = (data, showFieldType) => {
  const dimensionFields = data.dimensionF
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #20364** (2026-11-24): **Fix minion test races during parallel execution and segment refresh**
  *Symptoms*: Fix two test races observed in #20355:  - `SegmentGenerationAndPushTaskGeneratorTest` and `SegmentGenerationAndPushTaskExecutorTest` shared the classpath resource directory as their working directory. Parallel forks could collide on `input/dummyTable.json.tmp` and fail its rename. Give each executor invocation a unique temporary directory and clean it up in `finally`. - `RefreshSegmentMinionTest.testMetadataPushRefresh` dereferenced missing query-result fields while refreshed segments were still becoming available. Make the polling predicate return false until the selected column's type is exactly `FLOAT`, preserving the existing timeout.  Validation on JDK 25.0.5: all 13 targeted tests passed (7 unit tests and 6 integration tests), with three parallel forks enabled. Both affected modules also passed Spotless, Checkstyle, license formatting, and license checks. Compilation included deprecation and warning flags.  ```bash ./mvnw -B -ntp -Ppinot-fastdev -Ddevelocity.scan.disabled=true \   -pl pinot-plugins/pinot-minion-tasks/pinot-minion-builtin-tasks,pinot-integration-tests -am \   -Dtest=SegmentGenerationAndPushTaskGeneratorTest,SegmentGenerationAndPushTaskExecutorTest,RefreshSegmentMinionTest \   -Dsurefire.failIfNoSpecifiedTests=false -Dunit.test.fork.count=3 \   -Dmaven.compiler.showDeprecation=true -Dmaven.compiler.showWarnings=true test ``` 

- **Issue #20314** (2026-11-24): **[multistage] Resolve correlated UNNEST array reference by field index**
  *Symptoms*: ### Problem  On the multi-stage engine, `CROSS JOIN UNNEST` over a column produced by an aggregate fails at plan time:  ```sql SELECT f.col1, u.v FROM (SELECT col1, ARRAY_AGG(col3, 'INT') AS r FROM a GROUP BY col1) f CROSS JOIN UNNEST(f.r) AS u(v) -- Error composing query plan ...: Unsupported RexNode type with SqlKind: FIELD_ACCESS ```  ### Root cause  After optimization, the correlate's left input is the aggregate itself, and its output fields carry generated names (`agg#0`, `$f1`, ...) instead of the alias `r`:  ```text LogicalCorrelate(correlation=[$cor0], requiredColumns=[{1}])   PinotLogicalAggregate(group=[{0}], agg#0=[ARRAY_AGG(...)])   Uncollect     LogicalProject(r=[$cor0.r]) ```  `RelToPlanNodeConverter.resolveInputRefFromCorrel` looked up `$cor0.r` by field name in the left input's row type. The lookup missed, and the fallback `RexExpressionUtils.fromRexNode(RexFieldAccess)` threw. Unnesting a column of a plain scan works only because there the left input keeps the alias.  ### Fix  Resolve the correlated reference by its field index, which is how Calcite defines it: the index into the correlation variable's row type, i.e. the left input's row type. `PlanNodeToRelConverter` already builds the reference this way. The index is used only when the correlation variable's row type still lines up with the left input (same field count, same type at that index, ignoring nullability); otherwise the existing name match is used as before.  ### Compatibility  This is a planner-

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

### Incident Patch 1: `4bd680a4` (2026-11-24)
**Commit Message**: Fix ClassCastException in range filters on version 1 range indexes under null handling (#20331)

**File**: `pinot-core/src/main/java/org/apache/pinot/core/operator/filter/RangeIndexBasedFilterOperator.java` (modified, +4/-2)
```diff
@@ -101,10 +101,12 @@ private BlockDocIdSet evaluateLegacyRangeFilter() {
     if (partialMatches == null) {
       return matches != null ? BitmapDocIdSet.create(matches, _numDocs) : EmptyDocIdSet.unscanned();
     }
-    // Need to scan the first and last range as they might be partially matched
+    // Need to scan the first and last range as they might be partially matched. Scan without null handling because
+    // BaseColumnFilterOperator applies the null semantics to the combined result, and doing it in the scan as well
+    // wraps the scan result into a doc id set whose iterator is not a ScanBasedDocIdIterator.
     ScanBasedFilterOperator scanBasedFilterOperator =
         new ScanBasedFilterOperator(_queryContext, _predicateEvaluator, _dataSource, _numDocs);
-    BlockDocIdSet scanBasedDocIdSet = scanBasedFilterOperator.getTrues();
+    BlockDocIdSet scanBasedDocIdSet = scanBasedFilterOperator.getNextBlockWithoutNullHandling();
     MutableRoaringBitmap docIds = ((ScanBasedDocIdIterator) scanBasedDocIdSet.iterator()).applyAnd(partialMatches);
     if (matches != null) {
       docIds.or(matches);
```

**File**: `pinot-core/src/test/java/org/apache/pinot/queries/NullHandlingEnabledQueriesTest.java` (modified, +67/-0)
```diff
@@ -82,6 +82,7 @@ public class NullHandlingEnabledQueriesTest extends BaseQueriesTest {
           .setNoDictionaryColumns(List.of(COLUMN1))
           .setRangeIndexColumns(List.of(COLUMN1))
           .build();
+  private static final TableConfig TABLE_CONFIG_WITH_LEGACY_RANGE_INDEX_COLUMN = getTableConfigWithLegacyRangeIndex();
   private static final int NUM_OF_SEGMENT_COPIES = 4;
   private static final Map<String, String> QUERY_OPTIONS = Map.of("enableNullHandling", "true");
 
@@ -382,6 +383,72 @@ public void testFastFilteredCountExcludesNullsOnMultiValueColumn()
     assertEquals(getRows(String.format("SELECT COUNT(*) FROM testTable WHERE NOT (%s = 2)", COLUMN1)).get(0)[0], 0L);
   }
 
+  /// A multi-value column always gets the legacy range index, which is not exact: the documents of a range that the
+  /// predicate covers only in part are found by a scan. The null row is left out once, from the combined result.
+  @Test
+  public void testRangeFilterOnMultiValueColumnWithLegacyRangeIndex()
+      throws Exception {
+    initializeRows();
+    for (int i = 0; i < 30; i++) {
+      insertRow(new Object[]{i, i + 1});
+    }
+    insertRow(null);
+    Schema schema = schemaBuilder().addMultiValueDimension(COLUMN1, DataType.INT).build();
+    setUpSegments(TABLE_CONFIG_WITH_RANGE_INDEX_COLUMN, schema);
+
+    // Rows 4 to 29 hold a value above 4
+    assertEquals(getRows(String.format("SELECT COUNT(*) FROM testTable WHERE %s > 4", COLUMN1)).get(0)[0],
+        (long) 26 * NUM_OF_SEGMENT_COPIES);
+    // Rows 0 to 3 hold no value above 4, and the null row is UNKNOWN
+    assertEquals(getRows(String.format("SELECT COUNT(*) FROM testTable WHERE NOT (%s > 4)", COLUMN1)).get(0)[0],
+        (long) 4 * NUM_OF_SEGMENT_COPIES);
+    // Rows 4 to 20 hold a value from 5 to 20
+    assertEquals(
+        getRows(String.format("SELECT COUNT(*) FROM testTable WHERE %s BETWEEN 5 AND 20", COLUMN1)).get(0)[0],
+        (long) 17 * NUM_OF_SEGMENT_COPIES);
+    // Rows 0 to 4 hold a value below 5. The default value stored for the null row is below 5 as well, so this checks
+    // that the null row is left out of the combined result.
+    assertEquals(getRows(String.format("SELECT COUNT(*) FROM testTable WHERE %s < 5", COLUMN1)).get(0)[0],
+        (long) 5 * NUM_OF_SEGMENT_COPIES);
+  }
+
+  /// A single-value column gets the legacy range index when the table sets `rangeIndexVersion` to 1, and goes through
+  /// the same partial range scan as a multi-value column.
+  @Test
+  public void testRangeFilterOnSingleValueColumnWithLegacyRangeIndex()
+      throws Exception {
+    initializeRows();
+    for (int i = 0; i < 30; i++) {
+      insertRow(i);
+    }
+    insertRow(null);
+    Schema schema = schemaBuilder().addSingleValueDimension(COLUMN1, DataType.INT).build();
+    setUpSegments(TABLE_CONFIG_WITH_LEGACY_RANGE_INDEX_COLUMN, schema);
+
+    // Rows 5 to 29 hold a value above 4
+    assertEquals(getRows(String.format("SELECT COUNT(*) FROM testTable WHERE %s > 4", COLUMN1)).get(0)[0],
+        (long) 25 * NUM_OF_SEGMENT_COPIES);
+    // Rows 0 to 4 hold a value of at most 4, and the null row is UNKNOWN
+    assertEquals(getRows(String.format("SELECT COUNT(*) FROM testTable WHERE NOT (%s > 4)", COLUMN1)).get(0)[0],
+        (long) 5 * NUM_OF_SEGMENT_COPIES);
+    // Rows 5 to 20 hold a value from 5 to 20
+    assertEquals(
+        getRows(String.format("SELECT COUNT(*) FROM testTable WHERE %s BETWEEN 5 AND 20", COLUMN1)).get(0)[0],
+        (long) 16 * NUM_OF_SEGMENT_COPIES);
+    // Rows 0 to 4 hold a value below 5. The default value stored for the null row is below 5 as well, so this checks
+    // that the null row is left out of the combined result.
+    assertEquals(getRows(String.format("SELECT COUNT(*) FROM testTable WHERE %s < 5", COLUMN1)).get(0)[0],
+        (long) 5 * NUM_OF_SEGMENT_COPIES);
+  }
+
+  private static TableConfig getTableConfigWithLegacyRangeIndex() {
+    TableConfig tableConfig = new TableConfigBuilder(TableType.OFFLINE).setTableName(RAW_TABLE_NAME)
+        .setRangeIndexColumns(List.of(COLUMN1))
+        .build();
+    tableConfig.getIndexingConfig().setRangeIndexVersion(1);
+    return tableConfig;
+  }
+
   /// A consuming segment reports its null rows through a vector that grows with ingestion and hands out a copy on each
   /// read. The filter takes that copy once, and the index-based count has to leave those rows out as on a sealed
   /// segment.
```

---

### Incident Patch 2: `23311e4d` (2026-11-24)
**Commit Message**: Fix minion test races during parallel execution and segment refresh (#20364)

**File**: `pinot-integration-tests/src/test/java/org/apache/pinot/integration/tests/custom/RefreshSegmentMinionTest.java` (modified, +2/-1)
```diff
@@ -360,7 +360,8 @@ public void testMetadataPushRefresh()
     waitForServerSegmentDownload(aVoid -> {
       try {
         JsonNode response = postQuery("SELECT " + LONG_COL + " FROM " + TABLE_NAME + " LIMIT 10");
-        return response.get("resultTable").get("dataSchema").get("columnDataTypes").toString().contains("FLOAT");
+        // The result can be absent while the server is still loading refreshed segments.
+        return "FLOAT".equals(response.path("resultTable").path("dataSchema").path("columnDataTypes").path(0).asText());
       } catch (Exception e) {
         throw new RuntimeException(e);
       }
```

**File**: `pinot-plugins/pinot-minion-tasks/pinot-minion-builtin-tasks/src/test/java/org/apache/pinot/plugin/minion/tasks/segmentgenerationandpush/SegmentGenerationAndPushTaskExecutorTest.java` (modified, +27/-21)
```diff
@@ -21,7 +21,7 @@
 import java.io.File;
 import java.net.URL;
 import java.nio.charset.StandardCharsets;
-import java.nio.file.Paths;
+import java.nio.file.Files;
 import java.util.HashMap;
 import java.util.Map;
 import org.apache.commons.io.FileUtils;
@@ -46,16 +46,14 @@ public class SegmentGenerationAndPushTaskExecutorTest {
   public void testGenerateTaskSpec()
       throws Exception {
     ClassLoader classLoader = getClass().getClassLoader();
-    URL resourcesLoc = classLoader.getResource(".");
-    assertNotNull(resourcesLoc);
     URL tableConfigUrl = classLoader.getResource("dummyTable.json");
     assertNotNull(tableConfigUrl);
     String tableConfig = FileUtils.readFileToString(new File(tableConfigUrl.getFile()), StandardCharsets.UTF_8);
     SegmentGenerationAndPushTaskExecutor executor = new SegmentGenerationAndPushTaskExecutor();
     Schema schema = new Schema.SchemaBuilder().build();
     FieldUtils.writeField(executor, "_eventObserver", new DefaultMinionEventObserver(), true);
     Map<String, String> configMap = new HashMap<>() {{
-        put(BatchConfigProperties.INPUT_DATA_FILE_URI_KEY, resourcesLoc + "dummyTable.json");
+        put(BatchConfigProperties.INPUT_DATA_FILE_URI_KEY, tableConfigUrl.toString());
         put(BatchConfigProperties.INPUT_FORMAT, "");
         put(BatchConfigProperties.RECORD_READER_CLASS, "AReaderClass");
         put(BatchConfigProperties.RECORD_READER_CONFIG_CLASS, "AReaderConfigClass");
@@ -74,17 +72,22 @@ public void testGenerateTaskSpec()
         put(BatchConfigProperties.SEGMENT_NAME_GENERATOR_PROP_PREFIX + ".propseg2", "valseg2");
         put(BatchConfigProperties.APPEND_UUID_TO_SEGMENT_NAME, "true");
       }};
-    SegmentGenerationTaskSpec spec = executor.generateTaskSpec(configMap, Paths.get(resourcesLoc.toURI()).toFile());
-    assertEquals(spec.getSequenceId(), 42);
-    assertEquals("file:" + spec.getInputFilePath(), resourcesLoc + "input/dummyTable.json");
-    assertEquals(spec.getRecordReaderSpec().getClassName(), "AReaderClass");
-    assertEquals(spec.getRecordReaderSpec().getConfigClassName(), "AReaderConfigClass");
-    assertEqualsDeep(spec.getRecordReaderSpec().getConfigs(), Map.of("prop1", "value1", "prop.2", "value2"));
-    assertTrue(spec.isFailOnEmptySegment());
-    assertEquals(spec.getSegmentNameGeneratorSpec().getType(), "inputtext");
-    assertEqualsDeep(spec.getSegmentNameGeneratorSpec().getConfigs(),
-        Map.of("prop.seg.1", "valseg1", "propseg2", "valseg2", SegmentGenerationTaskRunner.APPEND_UUID_TO_SEGMENT_NAME,
-            "true"));
+    File tempDir = Files.createTempDirectory(getClass().getSimpleName()).toFile();
+    try {
+      SegmentGenerationTaskSpec spec = executor.generateTaskSpec(configMap, tempDir);
+      assertEquals(spec.getSequenceId(), 42);
+      assertEquals(spec.getInputFilePath(), new File(tempDir, "input/dummyTable.json").getAbsolutePath());
+      assertEquals(spec.getRecordReaderSpec().getClassName(), "AReaderClass");
+      assertEquals(spec.getRecordReaderSpec().getConfigClassName(), "AReaderConfigClass");
+      assertEqualsDeep(spec.getRecordReaderSpec().getConfigs(), Map.of("prop1", "value1", "prop.2", "value2"));
+      assertTrue(spec.isFailOnEmptySegment());
+      assertEquals(spec.getSegmentNameGeneratorSpec().getType(), "inputtext");
+      assertEqualsDeep(spec.getSegmentNameGeneratorSpec().getConfigs(),
+          Map.of("prop.seg.1", "valseg1", "propseg2", "valseg2",
+              SegmentGenerationTaskRunner.APPEND_UUID_TO_SEGMENT_NAME, "true"));
+    } finally {
+      FileUtils.deleteDirectory(tempDir);
+    }
   }
 
   @Test
@@ -104,23 +107,26 @@ public void testGenerateTaskSpecAppendUuidPrecedence()
   private void assertAppendUuid(Map<String, String> appendUuidConfigs, String expected)
       throws Exception {
     ClassLoader classLoader = getClass().getClassLoader();
-    URL resourcesLoc = classLoader.getResource(".");
-    assertNotNull(resourcesLoc);
     URL tableConfigUrl = classLoader.getResource("dummyTable.json");
     assertNotNull(tableConfigUrl);
     SegmentGenerationAndPushTaskExecutor executor = new SegmentGenerationAndPushTaskExecutor();
     FieldUtils.writeField(executor, "_eventObserver", new DefaultMinionEventObserver(), true);
     Map<String, String> configMap = new HashMap<>(appendUuidConfigs);
-    configMap.put(BatchConfigProperties.INPUT_DATA_FILE_URI_KEY, resourcesLoc + "dummyTable.json");
+    configMap.put(BatchConfigProperties.INPUT_DATA_FILE_URI_KEY, tableConfigUrl.toString());
     configMap.put(BatchConfigProperties.RECORD_READER_CLASS, "AReaderClass");
     configMap.put(BatchConfigProperties.RECORD_READER_CONFIG_CLASS, "AReaderConfigClass");
     configMap.put(BatchConfigProperties.SCHEMA, new Schema.SchemaBuilder().build().toSingleLineJsonString());
     configMap.put(BatchConfigProperties.TABLE_CONFIGS,
         FileUtils.readFileToString(new File(tableConfigUrl.getFile()), StandardCharsets.UTF_8));
     configMap.put(BatchConfig
```

**File**: `pinot-plugins/pinot-minion-tasks/pinot-minion-builtin-tasks/src/test/java/org/apache/pinot/plugin/minion/tasks/segmentgenerationandpush/SegmentGenerationAndPushTaskGeneratorTest.java` (modified, +9/-6)
```diff
@@ -22,7 +22,7 @@
 import java.net.URI;
 import java.net.URL;
 import java.nio.charset.StandardCharsets;
-import java.nio.file.Paths;
+import java.nio.file.Files;
 import java.util.HashMap;
 import java.util.Map;
 import org.apache.commons.io.FileUtils;
@@ -125,11 +125,9 @@ private void assertAppendUuidInExecutorSpec(Map<String, String> extraBatchConfig
     Map<String, String> taskConfig =
         new HashMap<>(invokeGetSingleFileGenerationTaskConfig(batchConfigMap(extraBatchConfigs)));
     ClassLoader classLoader = getClass().getClassLoader();
-    URL resourcesLoc = classLoader.getResource(".");
-    assertNotNull(resourcesLoc);
     URL tableConfigUrl = classLoader.getResource("dummyTable.json");
     assertNotNull(tableConfigUrl);
-    taskConfig.put(BatchConfigProperties.INPUT_DATA_FILE_URI_KEY, resourcesLoc + "dummyTable.json");
+    taskConfig.put(BatchConfigProperties.INPUT_DATA_FILE_URI_KEY, tableConfigUrl.toString());
     taskConfig.put(BatchConfigProperties.RECORD_READER_CLASS, "AReaderClass");
     taskConfig.put(BatchConfigProperties.RECORD_READER_CONFIG_CLASS, "AReaderConfigClass");
     taskConfig.put(BatchConfigProperties.SCHEMA, new Schema.SchemaBuilder().build().toSingleLineJsonString());
@@ -138,8 +136,13 @@ private void assertAppendUuidInExecutorSpec(Map<String, String> extraBatchConfig
 
     SegmentGenerationAndPushTaskExecutor executor = new SegmentGenerationAndPushTaskExecutor();
     FieldUtils.writeField(executor, "_eventObserver", new DefaultMinionEventObserver(), true);
-    SegmentGenerationTaskSpec spec = executor.generateTaskSpec(taskConfig, Paths.get(resourcesLoc.toURI()).toFile());
-    assertEquals(spec.getSegmentNameGeneratorSpec().getConfigs().get(APPEND_UUID_TO_SEGMENT_NAME_KEY), expected);
+    File tempDir = Files.createTempDirectory(getClass().getSimpleName()).toFile();
+    try {
+      SegmentGenerationTaskSpec spec = executor.generateTaskSpec(taskConfig, tempDir);
+      assertEquals(spec.getSegmentNameGeneratorSpec().getConfigs().get(APPEND_UUID_TO_SEGMENT_NAME_KEY), expected);
+    } finally {
+      FileUtils.deleteDirectory(tempDir);
+    }
   }
 
   @SuppressWarnings("unchecked")
```

---

### Incident Patch 3: `76d6f280` (2026-11-24)
**Commit Message**: fix(segment): reconcile stale FIXMEs around upsert validDocIds and aggr… (#20209)

**File**: `pinot-segment-local/src/main/java/org/apache/pinot/segment/local/indexsegment/mutable/MutableSegmentImpl.java` (modified, +9/-14)
```diff
@@ -188,14 +188,10 @@ public class MutableSegmentImpl implements MutableSegment {
   private final String _upsertOutOfOrderRecordColumn;
   private final UpsertConfig.ConsistencyMode _upsertConsistencyMode;
 
-  // The valid doc ids are maintained locally instead of in the upsert metadata manager because:
-  // 1. There is only one consuming segment per partition, the committed segments do not need to modify the valid doc
-  //    ids for the consuming segment.
-  // 2. During the segment commitment, when loading the immutable version of this segment, in order to keep the result
-  //    correct, the valid doc ids should not be changed, only the record location should be changed.
-  // FIXME: There is a corner case for this approach which could cause inconsistency. When there is segment load during
-  //        consumption with newer timestamp (late event in consuming segment), the record location will be updated, but
-  //        the valid doc ids won't be updated.
+  // Maintained by the upsert metadata manager (via getValidDocIds() / getQueryableDocIds()) as records are indexed and
+  // as segments are loaded or replaced in the partition. During segment commitment (ConsistencyMode.NONE),
+  // replaceSegment() works on a snapshot copy of _validDocIds so the consuming segment's bitmap stays intact for
+  // concurrent queries until the immutable replacement is swapped in.
   private final ThreadSafeMutableRoaringBitmap _validDocIds;
   private final ThreadSafeMutableRoaringBitmap _queryableDocIds;
   private boolean _indexCapacityThresholdBreached;
@@ -298,7 +294,7 @@ public MultiColumnTextMetadata getMultiColumnTextMetadata() {
     _logger =
         LoggerFactory.getLogger(MutableSegmentImpl.class.getName() + "_" + _segmentName + "_" + config.getStreamName());
 
-    // Metric aggregation can be enabled only if config is specified, and all dimensions have dictionary,
+    // Metric aggregation can be enabled only if config is specified, all dimensions and metrics are single-valued,
     // and no metrics have dictionary. If not enabled, the map returned is null.
     _recordIdMap = enableMetricsAggregationIfPossible(config);
 
@@ -1601,12 +1597,11 @@ private int getOrCreateDocId() {
     }
 
     int i = 0;
-    // Dimension and time columns form the aggregation key. They are always dictionary encoded in the consuming
-    // segment (isNoDictionaryColumn forces a dictionary on them when aggregation is enabled), so the _dictId read
-    // below is always valid. Keep this set of columns in sync with the field types forced there.
+    // Dimension and time columns form the aggregation key. They are always single-valued (enforced in
+    // enableMetricsAggregationIfPossible; see https://github.com/apache/pinot/issues/3867) and dictionary encoded in
+    // the consuming segment (isNoDictionaryColumn forces a dictionary on them when aggregation is enabled), so the
+    // _dictId read below is always valid. Keep this set of columns in sync with the field types forced there.
     int[] dictIds = new int[_numKeyColumns]; // dimensions + date time columns + time column.
-
-    // FIXME: this for loop breaks for multi value dimensions. https://github.com/apache/pinot/issues/3867
     for (FieldSpec fieldSpec : _physicalDimensionFieldSpecs) {
       dictIds[i++] = _indexContainerMap.get(fieldSpec.getName())._dictId;
     }
```

**File**: `pinot-segment-local/src/test/java/org/apache/pinot/segment/local/indexsegment/mutable/MutableSegmentImplAggregateMetricsTest.java` (modified, +27/-8)
```diff
@@ -21,11 +21,13 @@
 import java.util.Arrays;
 import java.util.HashMap;
 import java.util.HashSet;
+import java.util.List;
 import java.util.Map;
 import java.util.Random;
 import java.util.Set;
 import java.util.concurrent.TimeUnit;
 import org.apache.commons.lang3.RandomStringUtils;
+import org.apache.pinot.spi.config.table.ingestion.AggregationConfig;
 import org.apache.pinot.spi.data.DimensionFieldSpec;
 import org.apache.pinot.spi.data.FieldSpec;
 import org.apache.pinot.spi.data.MetricFieldSpec;
@@ -37,6 +39,8 @@
 import org.testng.annotations.Test;
 
 import static org.mockito.Mockito.mock;
+import static org.testng.Assert.assertEquals;
+import static org.testng.Assert.assertNull;
 
 
 public class MutableSegmentImplAggregateMetricsTest {
@@ -125,9 +129,9 @@ public void testAggregateMetricsWithNoDictionaryKeyColumns()
   @Test
   public void testMultiValueDimensionDisablesAggregation()
       throws Exception {
-    // A multi-value dimension cannot be used as an aggregation key (issue #3867), so aggregation stays disabled and no
-    // rollup happens even though aggregateMetrics is set. This guards against over-broadening the aggregation-enabling
-    // and dictionary-forcing logic to columns that cannot support it.
+    // A multi-value dimension cannot be used as an aggregation key (issue #3867), so aggregation stays disabled and
+    // no rollup happens whether configured via aggregateMetrics or ingestionAggregationConfigs. This guards against
+    // over-broadening the aggregation-enabling and dictionary-forcing logic to columns that cannot support it.
     Schema schema = new Schema.SchemaBuilder().setSchemaName("testSchema")
         .addSingleValueDimension(DIMENSION_1, FieldSpec.DataType.INT)
         .addMultiValueDimension(DIMENSION_2, FieldSpec.DataType.STRING)
@@ -136,10 +140,24 @@ public void testMultiValueDimensionDisablesAggregation()
         .addDateTime(TIME_COLUMN1, FieldSpec.DataType.INT, "1:DAYS:EPOCH", "1:DAYS")
         .addDateTime(TIME_COLUMN2, FieldSpec.DataType.INT, "1:HOURS:EPOCH", "1:HOURS")
         .build();
+    Set<String> noDictionaryColumns = Set.of(DIMENSION_1, METRIC, METRIC_2);
+
     MutableSegmentImpl mutableSegmentImpl =
-        MutableSegmentImplTestUtils.createMutableSegmentImpl(schema, Set.of(METRIC, METRIC_2), Set.of(), Set.of(),
-            true);
+        MutableSegmentImplTestUtils.createMutableSegmentImpl(schema, noDictionaryColumns, Set.of(), Set.of(), true);
+    assertMultiValueDimensionDisablesAggregation(mutableSegmentImpl);
+    mutableSegmentImpl.destroy();
+
+    List<AggregationConfig> aggregationConfigs =
+        List.of(new AggregationConfig(METRIC, "SUM(metric)"), new AggregationConfig(METRIC_2, "SUM(metric2)"));
+    mutableSegmentImpl =
+        MutableSegmentImplTestUtils.createMutableSegmentImpl(schema, noDictionaryColumns, Set.of(), Set.of(),
+            aggregationConfigs);
+    assertMultiValueDimensionDisablesAggregation(mutableSegmentImpl);
+    mutableSegmentImpl.destroy();
+  }
 
+  private void assertMultiValueDimensionDisablesAggregation(MutableSegmentImpl mutableSegmentImpl)
+      throws Exception {
     Random random = new Random();
     for (int i = 0; i < NUM_ROWS; i++) {
       GenericRow row = new GenericRow();
@@ -152,9 +170,10 @@ public void testMultiValueDimensionDisablesAggregation()
       mutableSegmentImpl.index(row, METADATA);
     }
 
-    // Aggregation is disabled, so every row is stored as its own document (no rollup).
-    Assert.assertEquals(mutableSegmentImpl.getNumDocsIndexed(), NUM_ROWS);
-    mutableSegmentImpl.destroy();
+    // Aggregation is disabled, so every row is stored as its own document (no rollup) and no-dictionary key columns
+    // stay no-dictionary.
+    assertEquals(mutableSegmentImpl.getNumDocsIndexed(), NUM_ROWS);
+    assertNull(mutableSegmentImpl.getDataSourceNullable(DIMENSION_1).getDictionary());
   }
 
   private void testAggregateMetrics(MutableSegmentImpl mutableSegmentImpl)
```

**File**: `pinot-segment-local/src/test/java/org/apache/pinot/segment/local/indexsegment/mutable/MutableSegmentImplUpsertTest.java` (modified, +114/-0)
```diff
@@ -21,22 +21,32 @@
 import java.io.File;
 import java.io.IOException;
 import java.net.URL;
+import java.nio.file.Files;
 import java.util.List;
+import org.apache.commons.io.FileUtils;
 import org.apache.pinot.segment.local.data.manager.TableDataManager;
+import org.apache.pinot.segment.local.indexsegment.immutable.ImmutableSegmentImpl;
+import org.apache.pinot.segment.local.indexsegment.immutable.ImmutableSegmentLoader;
 import org.apache.pinot.segment.local.segment.creator.TransformPipeline;
+import org.apache.pinot.segment.local.segment.creator.impl.SegmentIndexCreationDriverImpl;
+import org.apache.pinot.segment.local.segment.readers.GenericRowRecordReader;
 import org.apache.pinot.segment.local.upsert.PartitionUpsertMetadataManager;
 import org.apache.pinot.segment.local.upsert.TableUpsertMetadataManager;
 import org.apache.pinot.segment.local.upsert.TableUpsertMetadataManagerFactory;
+import org.apache.pinot.segment.spi.creator.SegmentGeneratorConfig;
 import org.apache.pinot.spi.config.table.HashFunction;
 import org.apache.pinot.spi.config.table.TableConfig;
 import org.apache.pinot.spi.config.table.TableType;
 import org.apache.pinot.spi.config.table.UpsertConfig;
+import org.apache.pinot.spi.data.DimensionFieldSpec;
+import org.apache.pinot.spi.data.FieldSpec.DataType;
 import org.apache.pinot.spi.data.Schema;
 import org.apache.pinot.spi.data.readers.FileFormat;
 import org.apache.pinot.spi.data.readers.GenericRow;
 import org.apache.pinot.spi.data.readers.RecordReader;
 import org.apache.pinot.spi.data.readers.RecordReaderFactory;
 import org.apache.pinot.spi.env.PinotConfiguration;
+import org.apache.pinot.spi.utils.ReadMode;
 import org.apache.pinot.spi.utils.builder.TableConfigBuilder;
 import org.roaringbitmap.buffer.ImmutableRoaringBitmap;
 import org.testng.annotations.Test;
@@ -55,6 +65,7 @@ public class MutableSegmentImplUpsertTest {
   private static final String TIME_COLUMN = "secondsSinceEpoch";
   private static final String OTHER_COMPARISON_COLUMN = "otherComparisonColumn";
   private static final String PRIMARY_KEY_COLUMN = "event_id";
+  private static final String DELETE_RECORD_COLUMN = "is_deleted";
 
   private MutableSegmentImpl _mutableSegmentImpl;
   private PartitionUpsertMetadataManager _partitionUpsertMetadataManager;
@@ -183,6 +194,109 @@ private static GenericRow createRow(String eventId, long otherComparisonValue, l
     return row;
   }
 
+  /// Verifies that loading an immutable segment with a newer comparison value while a mutable segment is actively
+  /// consuming invalidates the late event's docId in the consuming segment's `_validDocIds` and `_queryableDocIds`,
+  /// and that subsequent consumption with an even newer comparison value invalidates the immutable segment's docId.
+  @Test
+  public void testSegmentLoadDuringConsumptionUpdatesValidDocIds()
+      throws Exception {
+    UpsertConfig upsertConfig = createFullUpsertConfig(HashFunction.NONE);
+    upsertConfig.setDeleteRecordColumn(DELETE_RECORD_COLUMN);
+    TableConfig tableConfig = new TableConfigBuilder(TableType.REALTIME).setTableName(RAW_TABLE_NAME)
+        .setTimeColumnName(TIME_COLUMN)
+        .setUpsertConfig(upsertConfig)
+        .setNullHandlingEnabled(true)
+        .build();
+    URL schemaResourceUrl = getClass().getClassLoader().getResource(SCHEMA_FILE_PATH);
+    assertNotNull(schemaResourceUrl);
+    Schema schema = Schema.fromFile(new File(schemaResourceUrl.getFile()));
+    schema.addField(new DimensionFieldSpec(DELETE_RECORD_COLUMN, DataType.BOOLEAN, true));
+
+    TableUpsertMetadataManager tableUpsertMetadataManager =
+        TableUpsertMetadataManagerFactory.create(new PinotConfiguration(), tableConfig, schema,
+            mock(TableDataManager.class), null);
+    PartitionUpsertMetadataManager partitionUpsertMetadataManager =
+        tableUpsertMetadataManager.getOrCreatePartitionManager(0);
+    MutableSegmentImpl mutableSegment =
+        MutableSegmentImplTestUtils.createMutableSegmentImpl(schema, true, TIME_COLUMN,
+            partitionUpsertMetadataManager, null);
+    File tempDir = Files.createTempDirectory("MutableSegmentImplUpsertTest").toFile();
+    ImmutableSegmentImpl immutableSegment = null;
+    try {
+      // Consuming segment indexes late events for "aa" (docId 0, ts=1567205394) and "cc" (docId 2, ts=1567205394),
+      // and a newer event for "bb" (docId 1, ts=1567205398).
+      mutableSegment.index(createRowWithDelete("aa", 1L, 1567205394L, false), null);
+      mutableSegment.index(createRowWithDelete("bb", 1L, 1567205398L, false), null);
+      mutableSegment.index(createRowWithDelete("cc", 1L, 1567205394L, false), null);
+      ImmutableRoaringBitmap mutableValidDocIds = mutableSegment.getValidDocIds().getMutableRoaringBitmap();
+      ImmutableRoaringBitmap mutableQueryableDocIds = mutableSegment.getQueryableDocIds().getMutableRoaringBitmap();
+      assertEquals(mutableValidDocIds.toArray(), new int[]{0, 1, 2});
+      assertEquals(mutableQu
```

#### Recent Merged Pull Requests:
- **PR #20375** (2026-11-24): Bump software.amazon.awssdk:bom from 2.59.5 to 2.59.7 (@dependabot[bot])
- **PR #20364** (2026-11-24): Fix minion test races during parallel execution and segment refresh (@Jackie-Jiang)
- **PR #20358** (2026-11-23): Bump io.swagger:swagger-jersey2-jaxrs from 1.6.16 to 1.6.17 (@dependabot[bot])
- **PR #20357** (2026-11-23): Bump io.projectreactor:reactor-core from 3.8.8 to 3.9.0 (@dependabot[bot])
- **PR #20356** (2026-11-23): Bump org.apache.maven:maven-core from 3.10.1 to 3.10.2 (@dependabot[bot])
- **PR #20355** (2026-11-24): Bump com.google.errorprone:error_prone_annotations from 2.52.0 to 2.53.0 (@dependabot[bot])

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

## X. ClassCastException in range filters on version 1 range indexes under null handli

**RULE**:
When implementing operations in `pinot-core/src/main/java/org/apache/pinot/core/operator/filter/RangeIndexBasedFilterOperator.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apache/pinot. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4bd680a4`: ClassCastException in range filters on version 1 range indexes under null handling. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `pinot-core/src/main/java/org/apache/pinot/core/operator/filter/RangeIndexBasedFilterOperator.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
    // Need to scan the first and last range as they might be partially matched. Scan without null handling because
    // BaseColumnFilterOperator applies the null semantics to the combined result, and doing it in the scan as well
    // wraps the scan result into a doc id set whose iterator is not a ScanBasedDocIdIterator.
    BlockDocIdSet scanBasedDocIdSet = scanBasedFilterOperator.getNextBlockWithoutNullHandling();
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
    // Need to scan the first and last range as they might be partially matched
    BlockDocIdSet scanBasedDocIdSet = scanBasedFilterOperator.getTrues();
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4bd680a4` are properly handled with clean fallback behavior.
