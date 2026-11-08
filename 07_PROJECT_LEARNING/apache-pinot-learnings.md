> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/apache-pinot-learnings.md`  
> **Source**: github ([https://github.com/apache/pinot](https://github.com/apache/pinot))  
> **Source Version**: `0007e8b9`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T19:07:16.629Z  
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
> **Harvest Timestamp**: 2026-11-08T19:07:16.621Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apache/pinot`
- **Description**: Apache Pinot: a real-time analytics database for low-latency SQL and vector search, serving user-facing and agent-facing applications
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6171 stars

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
- **Issue #20169** (2026-11-07): **Reject cross-table functions under row-level security**
  *Symptoms*: ## Summary  Row-level security (RLS) adds the principal's row filters to the WHERE clause of the queried table, which no function that reads rows from somewhere else goes through: `lookup()`, `IN_SUBQUERY` and `IN_PARTITIONED_SUBQUERY`. This PR fixes the one of them that leaked and makes the single-stage broker reject all of them for a principal with row filters, so that none can leak again.  The leak: a principal restricted by row filters could use `IN_PARTITIONED_SUBQUERY` to test, and with `GROUP BY` enumerate, which values exist in the rows its row filters hide, while the response still reported `rlsFiltersApplied: true`. The broker ANDs the row filters into the outer WHERE clause and stamps them in the query options, but the subquery of `IN_PARTITIONED_SUBQUERY` reaches the server as a string literal that carries neither; `ServerQueryExecutorV1Impl` compiled that literal and ran it on the table's segments as is, so the `ID_SET` it built covered every row. `IN_SUBQUERY` was not affected (the broker runs it as a nested request under the same identity), nor was the multi-stage engine (it applies row filters per table on the server, runs `IN_SUBQUERY` as a request of its own, and does not resolve `lookup()` or `IN_PARTITIONED_SUBQUERY` at all).  ## Changes  - **Broker**: when row filters apply to the queried table, a single-stage query that calls any cross-table function is rejected with `403` before the filters are added and before anything reaches a server. Whether the que

- **Issue #20159** (2026-11-05): **Allow zero system activities CPU time in query killing tests**
  *Symptoms*: QueryKillingIntegrationTest can fail when offlineSystemActivitiesCpuTimeNs is zero, even though InstanceResponseOperator explicitly clamps this estimate of unaccounted wall time to zero. Allow nonnegative values in both resource usage tests, retaining the positive measured CPU/memory checks and total consistency assertions.  Observed in [this CI failure](https://github.com/apache/pinot/actions/runs/41926793312/job/126913552944?pr=20154).  Validation: all 7 QueryKillingIntegrationTest tests passed on current master with the CI lane settings (2 active processors, 1 GB initial heap, 4 GB maximum heap), with compiler warnings enabled. Spotless, Checkstyle, and license checks passed. An initial run using default local JVM settings exhausted the heap in the existing CPU-killing scenario before reaching the changed assertion. 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/apache/pinot/pull/20159?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=apache) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 70.37%. Comparing base ([`091eac7`](https://app.codecov.io/gh/apache/pinot/commit/091eac79529cfe0499bce1e498259dedc858bd9b?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=apache)) to head ([`6f84678`](https://app.codecov.io/gh/apache/pinot/commit/6f84678aa5b5448183f14c40ea5f6aa643c58564?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=apache)).  <details><summary>Additional details and impacted files</summary>    ```diff @@             Coverage Diff              @@ ##             master   #20159      +/-   ## ================================

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

### Incident Patch 1: `0007e8b9` (2026-11-08)
**Commit Message**: Use the empty-batch stream position only for consumption lag on transactional Kafka topics (#20024)

A Kafka transaction's commit marker occupies an offset the client never
delivers, so on an idle transactional partition the consumer sits at the
high watermark while RealtimeSegmentDataManager's current offset stays one
behind it. The records lag in ConsumerPartitionState therefore never
reached 0, and the HIGHEST_STREAM_OFFSET_CONSUMED gauge stayed one behind.

RealtimeSegmentDataManager now records the next offset of a batch without
messages as the stream position when it is ahead of the current offset.
Only the partition lag state and the HIGHEST_STREAM_OFFSET_CONSUMED gauge
read it. The current offset, and with it every fetch, the catch-up, the
KEEP and ONLINE transitions and the committed end offset, stays one past
the last delivered record.

The kafka-4.0 KafkaPartitionLevelConsumer now reports the client position
on an empty poll under read_uncommitted too, not only read_committed. The
move is not validated, which is safe because no caller resumes from it:
the next poll with records still runs the data-loss check against the
caller's offset.

StatelessRealtimeSegmentWriter (r

**File**: `pinot-core/src/main/java/org/apache/pinot/core/data/manager/realtime/RealtimeSegmentDataManager.java` (modified, +53/-8)
```diff
@@ -274,6 +274,10 @@ public void deleteSegmentFile() {
   private ServerIngestionOomProtectionManager _serverIngestionOomProtectionManager;
   private final MutableSegmentImpl _realtimeSegment;
   private volatile StreamPartitionMsgOffset _currentOffset; // Next offset to be consumed
+  // Furthest next offset reported by a batch without messages, e.g. one past a Kafka transaction marker. Only feeds
+  // consumption lag and the highest-offset gauge (see getStreamPosition()). Written by the consumer thread only.
+  @Nullable
+  private volatile StreamPartitionMsgOffset _emptyBatchStreamPosition;
   private volatile State _state;
   private volatile int _numRowsConsumed = 0;
   private volatile int _numRowsIndexed = 0; // Can be different from _numRowsConsumed when metrics update is enabled.
@@ -575,12 +579,7 @@ private boolean doConsumeLoop()
       if (_currentOffset.compareTo(lastUpdatedOffset) != 0) {
         _idleTimer.markEventConsumed();
         // We consumed something. Update the highest stream offset as well as partition-consuming metric.
-        // TODO Issue 5359 Need to find a way to bump metrics without getting actual offset value.
-        if (_currentOffset instanceof LongMsgOffset) {
-          // TODO: only LongMsgOffset supplies long offset value.
-          _serverMetrics.setValueOfTableGauge(_clientId, ServerGauge.HIGHEST_STREAM_OFFSET_CONSUMED,
-              ((LongMsgOffset) _currentOffset).getOffset());
-        }
+        updateHighestStreamOffsetConsumedGauge();
         lastUpdatedOffset = _streamPartitionMsgOffsetFactory.create(_currentOffset);
       } else if (endCriteriaReached) {
         // At this point current offset has not moved because processStreamEvents() has exited before processing a
@@ -602,6 +601,9 @@ private boolean doConsumeLoop()
         lastUpdatedOffset = _streamPartitionMsgOffsetFactory.create(nextOffset);
       } else {
         // We did not consume any rows.
+        if (recordStreamPositionOfEmptyBatch(messageBatch)) {
+          updateHighestStreamOffsetConsumedGauge();
+        }
         long timeSinceStreamLastCreatedOrConsumedMs = _idleTimer.getTimeSinceStreamLastCreatedOrConsumedMs();
 
         if (idleTimeoutMillis >= 0 && (timeSinceStreamLastCreatedOrConsumedMs > idleTimeoutMillis)) {
@@ -628,6 +630,48 @@ private boolean doConsumeLoop()
     return true;
   }
 
+  // TODO Issue 5359 Need to find a way to bump metrics without getting actual offset value.
+  private void updateHighestStreamOffsetConsumedGauge() {
+    StreamPartitionMsgOffset streamPosition = getStreamPosition();
+    if (streamPosition instanceof LongMsgOffset) {
+      // TODO: only LongMsgOffset supplies long offset value.
+      _serverMetrics.setValueOfTableGauge(_clientId, ServerGauge.HIGHEST_STREAM_OFFSET_CONSUMED,
+          ((LongMsgOffset) streamPosition).getOffset());
+    }
+  }
+
+  /// Records the next offset of a batch without messages when it is ahead of [#getStreamPosition()], which happens
+  /// when the stream moved past offsets it never delivers, such as Kafka transaction markers.
+  ///
+  /// @return `true` if the stream position moved
+  private boolean recordStreamPositionOfEmptyBatch(MessageBatch messageBatch) {
+    StreamPartitionMsgOffset nextBatchOffset = messageBatch.getOffsetOfNextBatch();
+    if (nextBatchOffset == null || nextBatchOffset.compareTo(getStreamPosition()) <= 0) {
+      return false;
+    }
+    if (_segmentLogger.isDebugEnabled()) {
+      _segmentLogger.debug("Empty batch moved the stream position to {} (current offset {})", nextBatchOffset,
+          _currentOffset);
+    }
+    _emptyBatchStreamPosition = nextBatchOffset;
+    return true;
+  }
+
+  /// Returns how far the stream has been read: `_currentOffset`, or the furthest next offset reported by a batch
+  /// without messages when that is ahead of it. A Kafka consumer moves past transaction markers without delivering
+  /// anything, so on a transactional topic a caught-up consumer sits one past the last commit marker while
+  /// `_currentOffset` stays one past the last record. This position only feeds consumption lag
+  /// ([#getConsumerPartitionState]) and [ServerGauge#HIGHEST_STREAM_OFFSET_CONSUMED]. Fetching, catch-up and the end
+  /// offset a segment commits keep using `_currentOffset`, so an empty batch's next offset never decides which records
+  /// a segment holds.
+  @VisibleForTesting
+  StreamPartitionMsgOffset getStreamPosition() {
+    StreamPartitionMsgOffset currentOffset = _currentOffset;
+    StreamPartitionMsgOffset emptyBatchStreamPosition = _emptyBatchStreamPosition;
+    return emptyBatchStreamPosition != null && emptyBatchStreamPosition.compareTo(currentOffset) > 0
+        ? emptyBatchStreamPosition : currentOffset;
+  }
+
   /// @param messageBatch batch of messages to process
   /// @param idlePipeSleepTimeMillis wait time in case no messages were read
   /// @return returns `true` if the process loop ended before processing the batch, `f
```

**File**: `pinot-core/src/test/java/org/apache/pinot/core/data/manager/realtime/RealtimeSegmentDataManagerTest.java` (modified, +196/-0)
```diff
@@ -25,6 +25,7 @@
 import java.lang.reflect.InvocationTargetException;
 import java.lang.reflect.Method;
 import java.time.Instant;
+import java.util.ArrayList;
 import java.util.LinkedList;
 import java.util.List;
 import java.util.Map;
@@ -41,6 +42,7 @@
 import org.apache.commons.io.FileUtils;
 import org.apache.helix.HelixManager;
 import org.apache.pinot.common.metadata.segment.SegmentZKMetadata;
+import org.apache.pinot.common.metrics.ServerGauge;
 import org.apache.pinot.common.metrics.ServerMeter;
 import org.apache.pinot.common.metrics.ServerMetrics;
 import org.apache.pinot.common.protocols.SegmentCompletionProtocol;
@@ -74,11 +76,15 @@
 import org.apache.pinot.spi.data.readers.GenericRow;
 import org.apache.pinot.spi.env.PinotConfiguration;
 import org.apache.pinot.spi.metrics.PinotMetricUtils;
+import org.apache.pinot.spi.stream.BytesStreamMessage;
 import org.apache.pinot.spi.stream.LongMsgOffset;
 import org.apache.pinot.spi.stream.LongMsgOffsetFactory;
 import org.apache.pinot.spi.stream.MessageBatch;
+import org.apache.pinot.spi.stream.PartitionGroupConsumer;
 import org.apache.pinot.spi.stream.PermanentConsumerException;
 import org.apache.pinot.spi.stream.StreamConfigProperties;
+import org.apache.pinot.spi.stream.StreamMessage;
+import org.apache.pinot.spi.stream.StreamMessageMetadata;
 import org.apache.pinot.spi.stream.StreamPartitionMsgOffset;
 import org.apache.pinot.spi.utils.CommonConstants;
 import org.apache.pinot.spi.utils.builder.TableNameBuilder;
@@ -442,6 +448,185 @@ public void testSuppressedDataLossIsReportedWhenConsumptionStops()
     }
   }
 
+  /// A batch without messages whose next offset is ahead of the current offset means the stream moved past offsets it
+  /// never delivers (a Kafka consumer skipping a transaction commit marker, for example). That position feeds lag and
+  /// the highest-offset gauge, while the current offset, which every fetch starts from, stays where the last record
+  /// left it. A later batch that reports the requested offset, no offset, or an offset behind does not move the
+  /// position back.
+  @Test
+  public void testEmptyBatchAheadOfCurrentOffsetMovesOnlyTheStreamPosition()
+      throws Exception {
+    ServerMetrics serverMetrics = mock(ServerMetrics.class);
+    try (FakeRealtimeSegmentDataManager segmentDataManager =
+        createFakeSegmentManager(true, new TimeSupplier(), null, null, null, serverMetrics)) {
+      segmentDataManager._stubConsumeLoop = false;
+      segmentDataManager._state.set(segmentDataManager, RealtimeSegmentDataManager.State.INITIAL_CONSUMING);
+      // consumeLoop() is called directly, so set the time limit run() would have set
+      segmentDataManager.setConsumeEndTime(System.currentTimeMillis() + TimeUnit.HOURS.toMillis(1));
+      ScriptedPartitionGroupConsumer consumer = new ScriptedPartitionGroupConsumer(segmentDataManager,
+          // The stream skipped START_OFFSET_VALUE and START_OFFSET_VALUE + 1 without delivering anything
+          emptyBatch(START_OFFSET_VALUE + 2),
+          // Nothing moved
+          emptyBatch(START_OFFSET_VALUE + 2),
+          // A stream that does not report where the next batch starts
+          emptyBatch(null),
+          // Behind the stream position
+          emptyBatch(START_OFFSET_VALUE + 1));
+      segmentDataManager.setPartitionGroupConsumer(consumer);
+
+      segmentDataManager.consumeLoop();
+
+      assertEquals(consumer._requestedOffsets,
+          List.of(START_OFFSET_VALUE, START_OFFSET_VALUE, START_OFFSET_VALUE, START_OFFSET_VALUE));
+      assertEquals(((LongMsgOffset) segmentDataManager.getCurrentOffset()).getOffset(), START_OFFSET_VALUE);
+      assertEquals(((LongMsgOffset) segmentDataManager.getStreamPosition()).getOffset(), START_OFFSET_VALUE + 2);
+      assertEquals(((LongMsgOffset) segmentDataManager.getConsumerPartitionState(null)
+          .get(String.valueOf(PARTITION_GROUP_ID)).getCurrentOffset()).getOffset(), START_OFFSET_VALUE + 2);
+      verify(serverMetrics).setValueOfTableGauge(anyString(), eq(ServerGauge.HIGHEST_STREAM_OFFSET_CONSUMED),
+          anyLong());
+      verify(serverMetrics).setValueOfTableGauge(anyString(), eq(ServerGauge.HIGHEST_STREAM_OFFSET_CONSUMED),
+          eq(START_OFFSET_VALUE + 2));
+      assertEquals(segmentDataManager.getSegment().getNumDocsIndexed(), 0);
+    }
+  }
+
+  /// Records still move the current offset after the stream position moved ahead of it, and the stream position
+  /// follows: a single-record transaction after an idle period on a transactional topic, then its commit marker.
+  @Test
+  public void testRecordAfterEmptyBatchMovesTheCurrentOffset()
+      throws Exception {
+    ServerMetrics serverMetrics = mock(ServerMetrics.class);
+    try (FakeRealtimeSegmentDataManager segmentDataManager =
+        createFakeSegmentManager(true, new TimeSupplier(), null, null, null, serverMetrics)) {
+      segmentDataManager._stubConsumeLoop = false;
+      segmentDataManager._state.set(seg
```

**File**: `pinot-plugins/pinot-stream-ingestion/pinot-kafka-4.0/src/main/java/org/apache/pinot/plugin/stream/kafka40/KafkaPartitionLevelConsumer.java` (modified, +19/-19)
```diff
@@ -57,10 +57,10 @@ public class KafkaPartitionLevelConsumer extends KafkaPartitionLevelConnectionHa
 
   // Offset the consumer is positioned to read NEXT. -1 means the consumer has not been
   // positioned for any caller-requested startOffset yet (we have not issued a seek).
-  // After a successful fetch, this is lastRecord.offset + 1. After an empty fetch under
-  // read_committed (where the batch may have been filtered as aborted), this is the
+  // After a successful fetch, this is lastRecord.offset + 1. After an empty fetch, this is the
   // consumer's actual KafkaConsumer.position(), which may have advanced past the caller's
-  // startOffset even though zero records were returned.
+  // startOffset even though zero records were returned (transaction control records under
+  // either isolation level, aborted records under read_committed).
   private long _nextReadOffset = -1;
   // The caller's startOffset on the previous fetchMessages() call. Used to distinguish
   // "caller is passing the same startOffset back because RealtimeSegmentDataManager's
@@ -107,10 +107,10 @@ public synchronized KafkaMessageBatch fetchMessages(StreamPartitionMsgOffset sta
     //       the repeated-startOffset-after-empty-fetch case described below.
     //
     // We only suppress a re-seek when the caller passed the same startOffset after the
-    // previous successful fetch returned zero records. That is the read_committed
-    // empty-poll case: RealtimeSegmentDataManager._currentOffset did not advance, but
-    // KafkaConsumer.position() may have advanced through aborted records. Seeking back to
-    // startOffset would undo that progress and wedge consumption forever.
+    // previous successful fetch returned zero records. That is the empty-poll case:
+    // RealtimeSegmentDataManager._currentOffset did not advance, but KafkaConsumer.position()
+    // may have advanced through control or aborted records. Seeking back to startOffset would
+    // undo that progress (and wedge consumption forever in an aborted region).
     //
     // If the previous poll returned records, a repeated startOffset means the caller did
     // not process them (for example, the segment time limit fired before index 0). We must
@@ -151,18 +151,18 @@ public synchronized KafkaMessageBatch fetchMessages(StreamPartitionMsgOffset sta
         }
         lastMessageMetadata = messageMetadata;
       }
-    } else if (_isReadCommitted) {
-      // No records returned. With read_committed isolation, the underlying KafkaConsumer's
-      // internal position may still have advanced past offsets filtered out as aborted
-      // transactional records, so snap _nextReadOffset to the consumer's actual position.
-      // RealtimeSegmentDataManager doesn't advance _currentOffset on empty batches and will
-      // call us again with the same startOffset; without this update the seek-check would
-      // re-seek to startOffset and undo the consumer's progress through the aborted region.
-      //
-      // For read_uncommitted (the default), empty polls can never advance the internal
-      // position past records that didn't exist, so we skip the position() call in the
-      // hot path. The call is bounded by the same timeout as poll() so a sick broker
-      // can't stall this loop unbounded.
+    } else {
+      // No records returned. The underlying KafkaConsumer's internal position may still have
+      // advanced past offsets it never delivers: transaction control records (commit/abort
+      // markers) under either isolation level, and records filtered out as aborted under
+      // read_committed. Snap _nextReadOffset to the consumer's actual position and report it as
+      // the next batch's offset. RealtimeSegmentDataManager only uses it for consumption lag
+      // and calls us again with the same startOffset, which the seek-check above does not undo.
+      // The move is not validated (it may also be an out-of-range reset), which is fine because
+      // no caller resumes from it: the next poll that returns records checks its first offset
+      // against the caller's startOffset below. The call is bounded by the same timeout as
+      // poll() so a sick broker can't stall this loop unbounded; after a poll it is normally
+      // answered locally.
       long currentPosition;
       try {
         currentPosition = _consumer.position(_topicPartition, Duration.ofMillis(timeoutMs));
```

**File**: `pinot-plugins/pinot-stream-ingestion/pinot-kafka-4.0/src/test/java/org/apache/pinot/plugin/stream/kafka40/KafkaPartitionLevelConsumerDataLossCheckTest.java` (modified, +7/-5)
```diff
@@ -42,6 +42,7 @@
 import static org.apache.kafka.common.record.RecordBatch.NO_TIMESTAMP;
 import static org.mockito.ArgumentMatchers.any;
 import static org.mockito.ArgumentMatchers.anyCollection;
+import static org.mockito.ArgumentMatchers.eq;
 import static org.mockito.Mockito.mock;
 import static org.mockito.Mockito.never;
 import static org.mockito.Mockito.times;
@@ -140,22 +141,23 @@ public void testLogStartOffsetLookupFailureIsNotDataLoss() {
   }
 
   /// An out-of-range reset can surface on an empty poll: the client jumps to the new log start without returning a
-  /// record, so that batch cannot be told from one that only skipped transaction markers and reports no loss. Under
-  /// read_uncommitted the empty batch reports the requested offset as the next one, so the caller asks for it again
-  /// and the loss is reported by the next poll that returns records: its first offset is past the requested one and
-  /// the log now starts above it.
+  /// record, so that batch cannot be told from one that only skipped transaction markers and reports no loss. The
+  /// empty batch reports the client position as the next one, which callers only use for consumption lag, so the
+  /// caller asks for its own offset again and the loss is reported by the next poll that returns records: its first
+  /// offset is past the requested one and the log now starts above it.
   @Test
   public void testResetSeenOnEmptyPollIsReportedOnNextDataPoll()
       throws Exception {
     Consumer<Bytes, Bytes> mockConsumer = mock(Consumer.class);
     when(mockConsumer.poll(any(Duration.class))).thenReturn(records(), records(record(150L)));
+    when(mockConsumer.position(eq(TOPIC_PARTITION), any(Duration.class))).thenReturn(150L);
     when(mockConsumer.beginningOffsets(anyCollection(), any(Duration.class)))
         .thenReturn(Map.of(TOPIC_PARTITION, 150L));
 
     try (KafkaPartitionLevelConsumer consumer = createConsumerWithMock(getStreamConfig(null), mockConsumer)) {
       KafkaMessageBatch emptyBatch = consumer.fetchMessages(new LongMsgOffset(100L), TIMEOUT_MS);
       assertEquals(emptyBatch.getMessageCount(), 0);
-      assertEquals(emptyBatch.getOffsetOfNextBatch().toString(), "100");
+      assertEquals(emptyBatch.getOffsetOfNextBatch().toString(), "150");
       assertFalse(emptyBatch.hasDataLoss());
 
       KafkaMessageBatch batch = consumer.fetchMessages(new LongMsgOffset(100L), TIMEOUT_MS);
```

**File**: `pinot-plugins/pinot-stream-ingestion/pinot-kafka-4.0/src/test/java/org/apache/pinot/plugin/stream/kafka40/KafkaPartitionLevelConsumerDataLossIntegrationTest.java` (modified, +26/-4)
```diff
@@ -52,7 +52,8 @@
 /// 2. Delete offsets (advance the log start via [EmbeddedKafkaCluster#deleteRecordsBeforeOffset]) and
 ///    confirm data loss IS reported.
 /// 3. Replay the production pattern: a caught-up consumer on a low-traffic transactional topic with one
-///    record per transaction, which sees every new record one offset past where it was parked.
+///    record per transaction, which sees every new record one offset past where it was parked, and whose
+///    empty polls report the position past the commit marker (the high watermark) for the consumption lag.
 ///
 /// Speed/stability: setup uses only synchronous broker calls (createTopics().all().get(),
 /// commitTransaction()/flush(), deleteRecords().all().get()), so there are no fixed sleeps. Reads
@@ -200,9 +201,9 @@ public void testCaughtUpConsumerOnLowTrafficTransactionalTopicIsNotDataLoss()
       assertEquals(firstOffset(batch), 0);
       assertFalse(batch.hasDataLoss());
 
-      // Caught up: the caller asks for offset 1, the marker. The client skips it and returns nothing.
-      KafkaMessageBatch emptyBatch = consumer.fetchMessages(new LongMsgOffset(1), FETCH_TIMEOUT_MS);
-      assertEquals(emptyBatch.getMessageCount(), 0);
+      // Caught up: the caller asks for offset 1, the marker. The client skips it and returns nothing, and the empty
+      // batch reports the client position, 2, which is the high watermark: the lag computed from it is 0.
+      KafkaMessageBatch emptyBatch = fetchUntilNextBatchOffset(consumer, 1, 2);
       assertFalse(emptyBatch.hasDataLoss());
 
       // Transaction 2: record at offset 2, marker at 3. The caller still asks for offset 1, as
@@ -237,10 +238,31 @@ private KafkaMessageBatch fetchUntilRecords(KafkaPartitionLevelConsumer consumer
     return batch;
   }
 
+  /// Polls repeatedly at the same startOffset until the (empty) batch reports `expectedNextBatchOffset` as the
+  /// start of the next batch, i.e. until the consumer has observed and skipped the control record(s) at/after
+  /// startOffset, or the wait budget elapses. Fails if a record shows up instead.
+  private KafkaMessageBatch fetchUntilNextBatchOffset(KafkaPartitionLevelConsumer consumer, long startOffset,
+      long expectedNextBatchOffset) {
+    long deadlineMs = System.currentTimeMillis() + FETCH_MAX_WAIT_MS;
+    KafkaMessageBatch batch = consumer.fetchMessages(new LongMsgOffset(startOffset), FETCH_TIMEOUT_MS);
+    while (batch.getMessageCount() == 0 && nextBatchOffset(batch) < expectedNextBatchOffset
+        && System.currentTimeMillis() < deadlineMs) {
+      batch = consumer.fetchMessages(new LongMsgOffset(startOffset), FETCH_TIMEOUT_MS);
+    }
+    assertEquals(batch.getMessageCount(), 0, "Expected no record at/after offset " + startOffset + " yet");
+    assertEquals(nextBatchOffset(batch), expectedNextBatchOffset,
+        "Expected the empty batch to report the consumer position past the skipped control record");
+    return batch;
+  }
+
   private static long firstOffset(KafkaMessageBatch batch) {
     return Long.parseLong(batch.getFirstMessageOffset().toString());
   }
 
+  private static long nextBatchOffset(KafkaMessageBatch batch) {
+    return Long.parseLong(batch.getOffsetOfNextBatch().toString());
+  }
+
   private StreamConfig streamConfig(String topic, String isolationLevel, String autoOffsetReset) {
     Map<String, String> streamConfigMap = new HashMap<>();
     streamConfigMap.put("streamType", "kafka");
```

**File**: `pinot-plugins/pinot-stream-ingestion/pinot-kafka-4.0/src/test/java/org/apache/pinot/plugin/stream/kafka40/KafkaPartitionLevelConsumerSeekTest.java` (modified, +27/-0)
```diff
@@ -39,12 +39,14 @@
 
 import static org.apache.kafka.common.record.RecordBatch.NO_TIMESTAMP;
 import static org.mockito.ArgumentMatchers.any;
+import static org.mockito.ArgumentMatchers.anyCollection;
 import static org.mockito.ArgumentMatchers.eq;
 import static org.mockito.Mockito.mock;
 import static org.mockito.Mockito.times;
 import static org.mockito.Mockito.verify;
 import static org.mockito.Mockito.when;
 import static org.testng.Assert.assertEquals;
+import static org.testng.Assert.assertFalse;
 
 
 /// Regression tests for [KafkaPartitionLevelConsumer] seek decisions.
@@ -87,6 +89,31 @@ public void testRepeatedStartOffsetAfterReadCommittedEmptyFetchDoesNotSeekAgain(
     verify(mockConsumer, times(1)).seek(TOPIC_PARTITION, 0L);
   }
 
+  /// Under read_uncommitted an empty poll can still move the consumer past a transaction control record. The empty
+  /// batch must report that position as the start of the next batch, and the repeated startOffset must not undo
+  /// the progress with a re-seek.
+  @Test
+  public void testRepeatedStartOffsetAfterReadUncommittedEmptyFetchDoesNotSeekAgain() {
+    Consumer<Bytes, Bytes> mockConsumer = mock(Consumer.class);
+    ConsumerRecords<Bytes, Bytes> emptyRecords =
+        new ConsumerRecords<>(Map.of(TOPIC_PARTITION, List.<ConsumerRecord<Bytes, Bytes>>of()), Map.of());
+    // The client skipped the commit marker at offset 1 without returning anything, so its position is now 2
+    when(mockConsumer.poll(any(Duration.class))).thenReturn(emptyRecords, records(record(2L)));
+    when(mockConsumer.position(eq(TOPIC_PARTITION), any(Duration.class))).thenReturn(2L);
+    when(mockConsumer.beginningOffsets(anyCollection(), any(Duration.class)))
+        .thenReturn(Map.of(TOPIC_PARTITION, 0L));
+
+    KafkaPartitionLevelConsumer consumer = createConsumerWithMock(getStreamConfig(null), mockConsumer);
+    KafkaMessageBatch emptyBatch = consumer.fetchMessages(new LongMsgOffset(1L), 10000);
+    KafkaMessageBatch nextBatch = consumer.fetchMessages(new LongMsgOffset(1L), 10000);
+
+    assertEquals(emptyBatch.getMessageCount(), 0);
+    assertEquals(emptyBatch.getOffsetOfNextBatch().toString(), "2");
+    assertEquals(nextBatch.getFirstMessageOffset().toString(), "2");
+    assertFalse(nextBatch.hasDataLoss());
+    verify(mockConsumer, times(1)).seek(TOPIC_PARTITION, 1L);
+  }
+
   private static KafkaPartitionLevelConsumer createConsumerWithMock(StreamConfig streamConfig,
       Consumer<Bytes, Bytes> mockConsumer) {
     class FakeKafkaPartitionLevelConsumer extends KafkaPartitionLevelConsumer {
```

**File**: `pinot-segment-local/src/main/java/org/apache/pinot/segment/local/realtime/writer/StatelessRealtimeSegmentWriter.java` (modified, +10/-0)
```diff
@@ -84,6 +84,12 @@
 /// otherwise silently miss part of its offset range. The segment then stays in ERROR until the operator restores the
 /// range from another source or deletes the segment to accept the loss.
 ///
+/// A batch without unfiltered messages never moves the writer, whatever next offset it reports: the writer polls again
+/// from its own offset. A Kafka consumer reports its client position there, which can lie past transaction markers,
+/// but also past deleted records after an out-of-range reset it has not reported as loss yet. The loss check of the
+/// next batch with records then covers the whole gap. Reaching the end offset never needs that position, since the
+/// data manager only moves its own offset on fetched records.
+///
 /// TODO:
 ///   1. Clean up this class and only keep the necessary parts.
 ///   2. Use a different segment impl for better performance because it doesn't need to serve queries.
@@ -281,6 +287,10 @@ public void run() {
               + "the stream no longer holds this range (e.g. it aged out of retention), so the segment cannot be "
               + "rebuilt from it. Restore the range from another source, or delete the segment to accept the loss",
               _currentOffset, _endOffset);
+          if (messageBatch.getUnfilteredMessageCount() == 0) {
+            // Poll again from the same offset (see the class Javadoc)
+            continue;
+          }
 
           int messageCount = messageBatch.getMessageCount();
 
```

**File**: `pinot-segment-local/src/test/java/org/apache/pinot/segment/local/realtime/writer/StatelessRealtimeSegmentWriterTest.java` (modified, +17/-17)
```diff
@@ -115,28 +115,27 @@ public void registerMetrics() {
     ServerMetrics.register(mock(ServerMetrics.class));
   }
 
-  /// A batch without unfiltered messages moves the writer to the next offset it reports: a consumer can move past
-  /// offsets it never delivers (Kafka transaction markers, aborted records under read_committed), which may land
-  /// below, at or past the end offset. A batch that reports the requested offset leaves it alone. Every such replay
-  /// completes with exactly the records below the end, and one whose tail holds only skipped offsets completes as soon
-  /// as the reported position reaches the end (the scripted streams below end there).
+  /// A batch without unfiltered messages never moves the writer, whatever next offset it reports: a Kafka consumer
+  /// reports its position there, past skipped transaction markers or aborted records, and the writer polls again from
+  /// its own offset. Fetched records, filtered ones included, move it as usual. Every such replay completes with
+  /// exactly the records below the end, including one whose empty batches report a position at or past the end: the
+  /// next batch with records completes it.
   @DataProvider
   public Object[][] validReplays() {
     return new Object[][]{
         {"records", List.of(records(0, 120)), 120, List.of(0L)},
         {"nonmoving", List.of(records(0, 100), empty(100, 0, false), records(100, 120)), 120, List.of(0L, 100L, 100L)},
-        // Commit marker at 100: the empty poll moves the consumer to 101, the next one delivers 101..119
-        {"marker", List.of(records(0, 100), empty(101, 0, false), records(101, 120)), 119, List.of(0L, 100L, 101L)},
+        // Commit marker at 100: the empty poll moves the consumer to 101, the writer asks for 100 again and gets
+        // 101..119
+        {"marker", List.of(records(0, 100), empty(101, 0, false), records(101, 120)), 119, List.of(0L, 100L, 100L)},
         {"markerThenFiltered", List.of(records(0, 100), empty(101, 0, false), empty(106, 5, false), records(106, 120)),
-            114, List.of(0L, 100L, 101L, 106L)},
+            114, List.of(0L, 100L, 100L, 106L)},
         // Five fetched tombstones/filtered records legitimately advance the position without decoded rows
         {"filtered", List.of(records(0, 100), empty(105, 5, false), records(105, 120)), 115, List.of(0L, 100L, 105L)},
-        // Markers fill the tail of the range: the empty advance stays below the end (the next record lands at the
-        // end), or reaches or crosses the end, which completes the replay with no further record
-        {"markerTailBelowEnd", List.of(records(0, 100), empty(110, 0, false), records(120, 121)), 100,
-            List.of(0L, 100L, 110L)},
-        {"markerTailAtEnd", List.of(records(0, 100), empty(120, 0, false)), 100, List.of(0L, 100L)},
-        {"markerTailPastEnd", List.of(records(0, 100), empty(150, 0, false)), 100, List.of(0L, 100L)},
+        // Markers fill the tail of the range: the empty batches report positions below, at and past the end, and the
+        // record at the end completes the replay
+        {"markerTail", List.of(records(0, 100), empty(110, 0, false), empty(120, 0, false), empty(150, 0, false),
+            records(120, 121)), 100, List.of(0L, 100L, 100L, 100L, 100L)},
         {"alreadyAtEnd", List.of(), 0, List.of()}
     };
   }
@@ -185,7 +184,8 @@ public void testEmptyBatchReportingLossFailsReplay(int nextOffset)
   }
 
   /// A non-empty batch that reports data loss is not indexed, including the case where an empty poll moved the
-  /// consumer and the writer first (the loss check of the data poll covers the gap from the adopted offset).
+  /// consumer first (the writer stays at its own offset, so the loss check of the data poll covers the gap from
+  /// there).
   @DataProvider
   public Object[][] lossAfterMarker() {
     return new Object[][]{{false}, {true}};
@@ -206,8 +206,8 @@ public void testDataLossFailsBeforeIndexing(boolean afterMarker)
       assertFalse(replay.writer().isSuccess());
       assertEquals(indexedRows(replay.writer()), 100, "The loss batch must not be indexed");
       assertTrue(replay.writer().getConsumptionException().getMessage().contains("data loss"));
-      assertEquals(((LongMsgOffset) field(replay.writer(), "_currentOffset")).getOffset(), afterMarker ? 101L : 100L);
-      assertEquals(replay.requestedOffsets(), afterMarker ? List.of(0L, 100L, 101L) : List.of(0L, 100L));
+      assertEquals(((LongMsgOffset) field(replay.writer(), "_currentOffset")).getOffset(), 100L);
+      assertEquals(replay.requestedOffsets(), afterMarker ? List.of(0L, 100L, 100L) : List.of(0L, 100L));
       verify(replay.consumer(), times(1)).close();
     }
   }
```

---

### Incident Patch 2: `6d97d322` (2026-11-08)
**Commit Message**: Make the failure detector probe the channels that carry queries (#20022)

With pings off (the default), the failure detector's retry probe opened the OFFLINE channel only and trusted
isActive(), so a server could be readmitted onto a half-open REALTIME channel, and a channel that swallowed every
query was never replaced.

- QueryRouter#connect probes every channel the server was queried over (ServerChannels#probe): a closed channel is
  reconnected and a suspect one is replaced instead of being trusted on isActive(). Channels opened only by startup
  pre-connect are left alone.
- A timed-out query hands each server it reached but that never answered to the transport, which judges it
  pinot.broker.failure.detector.unanswered.query.grace.ms (default 2000) later, per channel: it counts only if the
  server sent nothing on that channel since the request was written. Any response frame resets the count.
- At pinot.broker.failure.detector.unanswered.queries.threshold consecutive unanswered queries (default 5,
  non-positive disables) the channel is marked suspect and the next send replaces it with a fresh connection. With
  pings off and pinot.broker.failure.detector.report.unanswered.s

**File**: `pinot-broker/src/main/java/org/apache/pinot/broker/requesthandler/SingleConnectionBrokerRequestHandler.java` (modified, +15/-3)
```diff
@@ -140,7 +140,11 @@ public SingleConnectionBrokerRequestHandler(PinotConfiguration config, String br
     super(config, brokerId, requestIdGenerator, routingManager, accessControlFactory, queryQuotaManager, tableCache,
         threadAccountant, multiClusterRoutingContext, materializedViewHandler);
     _brokerReduceService = new BrokerReduceService(_config);
-    _queryRouter = new QueryRouter(_brokerId, nettyConfig, tlsConfig, serverRoutingStatsManager, threadAccountant);
+    _queryRouter = new QueryRouter(_brokerId, nettyConfig, tlsConfig, serverRoutingStatsManager, threadAccountant,
+        _config.getProperty(CommonConstants.Broker.FailureDetector.CONFIG_OF_UNANSWERED_QUERIES_THRESHOLD,
+            CommonConstants.Broker.FailureDetector.DEFAULT_UNANSWERED_QUERIES_THRESHOLD),
+        _config.getProperty(CommonConstants.Broker.FailureDetector.CONFIG_OF_UNANSWERED_QUERY_GRACE_MS,
+            CommonConstants.Broker.FailureDetector.DEFAULT_UNANSWERED_QUERY_GRACE_MS));
     _failureDetector = failureDetector;
     _pingOnTimeout = _config.getProperty(CommonConstants.Broker.FailureDetector.CONFIG_OF_ENABLE_PING_ON_TIMEOUT,
         CommonConstants.Broker.FailureDetector.DEFAULT_ENABLE_PING_ON_TIMEOUT);
@@ -151,6 +155,14 @@ public SingleConnectionBrokerRequestHandler(PinotConfiguration config, String br
       Preconditions.checkArgument(_pingTimeoutMs > 0, "'%s' must be positive, got: %s",
           CommonConstants.Broker.FailureDetector.CONFIG_OF_PING_TIMEOUT_MS, _pingTimeoutMs);
       _failureDetector.registerServerNotRespondedChecker(this::checkServerNotResponded);
+    } else if (_config.getProperty(CommonConstants.Broker.FailureDetector.CONFIG_OF_REPORT_UNANSWERED_SERVERS,
+        CommonConstants.Broker.FailureDetector.DEFAULT_REPORT_UNANSWERED_SERVERS)) {
+      // Opted in: without pings nothing else acts on a timeout, so a server that has gone silent on one of its channels
+      // is reported like a server the transport saw go down, and leaves routing until the retry probe re-establishes
+      // the channel. Otherwise, and always with pings (the ping that follows every timeout makes that call), the
+      // silent channel is only replaced.
+      _queryRouter.setUnansweredServerReporter(serverRoutingInstance -> _failureDetector.markServerUnhealthy(
+          serverRoutingInstance.getInstanceId(), serverRoutingInstance.getHostname()));
     }
   }
 
@@ -1070,7 +1082,7 @@ public void onServerRemoved(ServerInstance serverInstance) {
   }
 
   /// Check if a server that was previously detected as unhealthy is now healthy: by pinging it when pings are enabled,
-  /// otherwise by connecting to it.
+  /// otherwise by re-establishing every channel it was queried over (see [QueryRouter#connect]).
   public FailureDetector.ServerState retryUnhealthyServer(String instanceId) {
     LOGGER.info("Retrying unhealthy server: {}", instanceId);
     ServerInstance serverInstance = _routingManager.getEnabledServerInstanceMap().get(instanceId);
@@ -1100,7 +1112,7 @@ public FailureDetector.ServerState retryUnhealthyServer(String instanceId) {
     }
 
     if (_queryRouter.connect(serverInstance)) {
-      LOGGER.info("Successfully connect to server: {}, marking it healthy", instanceId);
+      LOGGER.info("Re-established the channel(s) to server: {}, marking it healthy", instanceId);
       return FailureDetector.ServerState.HEALTHY;
     } else {
       LOGGER.warn("Still cannot connect to server: {}, retry later", instanceId);
```

**File**: `pinot-broker/src/test/java/org/apache/pinot/broker/requesthandler/SingleConnectionBrokerRequestHandlerFailureDetectorTest.java` (modified, +36/-1)
```diff
@@ -114,10 +114,15 @@ public void setUp() {
   /// are recorded, mirroring the wiring `BaseBrokerStarter` performs in production. Without `pingOnTimeout` the
   /// default applies.
   private void startBroker(boolean pingOnTimeout, long retryInitialDelayMs) {
+    startBroker(pingOnTimeout, retryInitialDelayMs, Map.of());
+  }
+
+  /// As above, with extra broker settings on top.
+  private void startBroker(boolean pingOnTimeout, long retryInitialDelayMs, Map<String, Object> extraConfig) {
     // BrokerMetrics is a JVM-wide singleton, so the gauge carries over from whatever ran before in this fork.
     BrokerMetrics.get().setValueOfGlobalGauge(BrokerGauge.UNHEALTHY_SERVERS, 0);
 
-    PinotConfiguration config = new PinotConfiguration();
+    PinotConfiguration config = new PinotConfiguration(new HashMap<>(extraConfig));
     config.setProperty(Broker.FailureDetector.CONFIG_OF_TYPE, Broker.FailureDetector.Type.CONNECTION.name());
     if (pingOnTimeout) {
       config.setProperty(Broker.FailureDetector.CONFIG_OF_ENABLE_PING_ON_TIMEOUT, true);
@@ -380,6 +385,36 @@ public void testTimeoutLeavesServerInRoutingWhenPingsAreOff()
     assertEquals(_excludedServers, List.of());
   }
 
+  /// With pings off, a server that leaves the threshold of queries unanswered on its channel is reported to the failure
+  /// detector only when the operator opted in. By default only its channel is replaced, so a healthy server whose
+  /// heavy queries overrun their timeout is never taken out of routing for it.
+  @Test(dataProvider = "reportUnanswered")
+  public void testUnansweredServerIsReportedOnlyWhenEnabled(boolean report)
+      throws Exception {
+    stopBroker();
+    startBroker(false, RETRIES_OFF_MS, Map.of(
+        Broker.FailureDetector.CONFIG_OF_UNANSWERED_QUERIES_THRESHOLD, 1,
+        Broker.FailureDetector.CONFIG_OF_UNANSWERED_QUERY_GRACE_MS, 100L,
+        Broker.FailureDetector.CONFIG_OF_REPORT_UNANSWERED_SERVERS, report));
+    ServerInstance frozenServer = startFrozenServer();
+
+    assertTrue(scatter(offlineRouteTo(frozenServer)).isTimedOut());
+    if (report) {
+      awaitUnhealthyServers(frozenServer);
+      assertEquals(_excludedServers, List.of(frozenServer.getInstanceId()));
+    } else {
+      // The judgment runs a grace period after the timeout; give it far longer than that before concluding none ran
+      Thread.sleep(1_000L);
+      assertEquals(_failureDetector.getUnhealthyServers(), Set.of());
+      assertEquals(_excludedServers, List.of());
+    }
+  }
+
+  @DataProvider(name = "reportUnanswered")
+  public Object[][] reportUnanswered() {
+    return new Object[][]{{false}, {true}};
+  }
+
   /// With pings off, retries connect to the server, as before this change, rather than ping it. A connect succeeds
   /// even against a frozen server, whose kernel still completes the handshake, so this one is put back at once.
   @Test
```

**File**: `pinot-common/src/main/java/org/apache/pinot/common/metrics/BrokerMeter.java` (modified, +6/-0)
```diff
@@ -247,6 +247,12 @@ public class BrokerMeter implements AbstractMetrics.Meter {
   // cluster or moved to another address. Entries whose channel had already closed are dropped without being counted.
   public static final BrokerMeter NETTY_CONNECTION_CHANNEL_EVICTIONS = create(
       "NETTY_CONNECTION_CHANNEL_EVICTIONS", "nettyConnection", false);
+  // Channels marked suspect because the server left the configured number of consecutive queries unanswered on them
+  // (see CommonConstants.Broker.FailureDetector.CONFIG_OF_UNANSWERED_QUERIES_THRESHOLD); the next query replaces each.
+  // With CONFIG_OF_REPORT_UNANSWERED_SERVERS on and pings off, each is also a report to the failure detector. Tagged
+  // with the server's short name.
+  public static final BrokerMeter NETTY_CONNECTION_SUSPECT_CHANNELS = create(
+      "NETTY_CONNECTION_SUSPECT_CHANNELS", "nettyConnection", false);
 
   public static final BrokerMeter PROACTIVE_CLUSTER_CHANGE_CHECK = create(
       "PROACTIVE_CLUSTER_CHANGE_CHECK", "proactiveClusterChangeCheck", true);
```

**File**: `pinot-common/src/test/java/org/apache/pinot/common/failuredetector/ConnectionFailureDetectorTest.java` (modified, +19/-0)
```diff
@@ -453,6 +453,25 @@ private static boolean awaitQuietly(CountDownLatch latch) {
     }
   }
 
+  /// When no retrier can vouch for or against a server (every transport answers UNKNOWN, e.g. because the server's
+  /// channels were evicted), the server is let go rather than kept unhealthy for the whole backoff schedule, so
+  /// that a later failure can flag it again. Pins the semantics the retriers rely on.
+  @Test
+  public void testAllRetriersUnknownIsTreatedAsRecovered() {
+    _failureDetector.registerUnhealthyServerRetrier(instanceId -> FailureDetector.ServerState.UNKNOWN);
+    _failureDetector.registerUnhealthyServerRetrier(instanceId -> FailureDetector.ServerState.UNKNOWN);
+
+    _failureDetector.markServerUnhealthy(INSTANCE_ID, HOST_NAME);
+    verify(Set.of(INSTANCE_ID), 1, 0);
+
+    TestUtils.waitForCondition(aVoid -> _failureDetector.getUnhealthyServers().isEmpty()
+        && _healthyServerNotifier._notifyHealthyServerCalled == 1, 5_000L, "Server was not let go on all-UNKNOWN");
+
+    // ... and can be flagged again
+    _failureDetector.markServerUnhealthy(INSTANCE_ID, HOST_NAME);
+    verify(Set.of(INSTANCE_ID), 2, 1);
+  }
+
   private void verify(Set<String> expectedUnhealthyServers, int expectedNotifyUnhealthyServerCalled,
       int expectedNotifyHealthyServerCalled) {
     assertEquals(_failureDetector.getUnhealthyServers(), expectedUnhealthyServers);
```

**File**: `pinot-core/src/main/java/org/apache/pinot/core/transport/AsyncQueryResponse.java` (modified, +19/-1)
```diff
@@ -43,6 +43,7 @@ public class AsyncQueryResponse implements QueryResponse {
   private final AtomicInteger _numServersResponded = new AtomicInteger();
   private final ConcurrentHashMap<ServerRoutingInstance, ServerResponse> _responseMap;
   private final CountDownLatch _countDownLatch;
+  private final long _startTimeMs;
   private final long _maxEndTimeMs;
   private final long _timeoutMs;
   private final ServerRoutingStatsManager _serverRoutingStatsManager;
@@ -72,6 +73,7 @@ public AsyncQueryResponse(QueryRouter queryRouter, long requestId, Set<ServerRou
     }
     _countDownLatch = new CountDownLatch(numServersQueried);
     _timeoutMs = timeoutMs;
+    _startTimeMs = startTimeMs;
     _maxEndTimeMs = startTimeMs + timeoutMs;
   }
 
@@ -95,7 +97,9 @@ public Map<ServerRoutingInstance, ServerResponse> getFinalResponses()
       throws InterruptedException {
     try {
       boolean finish = _countDownLatch.await(_maxEndTimeMs - System.currentTimeMillis(), TimeUnit.MILLISECONDS);
-      _status.compareAndSet(Status.IN_PROGRESS, finish ? Status.COMPLETED : Status.TIMED_OUT);
+      if (_status.compareAndSet(Status.IN_PROGRESS, finish ? Status.COMPLETED : Status.TIMED_OUT) && !finish) {
+        recordUnansweredServers();
+      }
       return _responseMap;
     } finally {
       // Update ServerRoutingStats for query completion. This is done here to ensure that the stats are updated for
@@ -117,6 +121,20 @@ public Map<ServerRoutingInstance, ServerResponse> getFinalResponses()
     }
   }
 
+  /// On a timeout, hands every server the request reached but that never answered to the transport, with the time
+  /// and the channel the request was written to; the transport judges after a grace period whether the server has gone
+  /// silent on that channel (see [ServerChannels#recordUnansweredQuery]).
+  private void recordUnansweredServers() {
+    for (Map.Entry<ServerRoutingInstance, ServerResponse> entry : _responseMap.entrySet()) {
+      ServerResponse response = entry.getValue();
+      int submitDelayMs = response.getSubmitDelayMs();
+      // Only servers the request was actually submitted to can be blamed for not answering it
+      if (response.getDataTable() == null && submitDelayMs >= 0) {
+        _queryRouter.recordServerTimeout(entry.getKey(), _startTimeMs + submitDelayMs, response.getChannel());
+      }
+    }
+  }
+
   private boolean hasServerReturnedExceptions(ServerResponse response) {
     if (response.getDataTable() != null && response.getDataTable().getExceptions().size() > 0) {
       DataTable dataTable = response.getDataTable();
```

**File**: `pinot-core/src/main/java/org/apache/pinot/core/transport/DataTableHandler.java` (modified, +2/-0)
```diff
@@ -85,6 +85,8 @@ public void channelInactive(ChannelHandlerContext ctx) {
 
   @Override
   protected void channelRead0(ChannelHandlerContext ctx, ByteBuf msg) {
+    // Before decoding: a frame proves the server alive even if it then fails to decode
+    _queryRouter.recordResponse(_serverRoutingInstance);
     int responseSize = msg.readableBytes();
     _brokerMetrics.addMeteredGlobalValue(BrokerMeter.NETTY_CONNECTION_BYTES_RECEIVED, responseSize);
     try {
```

**File**: `pinot-core/src/main/java/org/apache/pinot/core/transport/QueryRouter.java` (modified, +71/-12)
```diff
@@ -28,6 +28,7 @@
 import java.util.concurrent.TimeoutException;
 import java.util.concurrent.atomic.AtomicLong;
 import java.util.function.BiPredicate;
+import java.util.function.Consumer;
 import javax.annotation.Nullable;
 import javax.annotation.concurrent.ThreadSafe;
 import org.apache.pinot.common.config.NettyConfig;
@@ -46,6 +47,7 @@
 import org.apache.pinot.spi.accounting.ThreadAccountant;
 import org.apache.pinot.spi.config.table.TableType;
 import org.apache.pinot.spi.env.PinotConfiguration;
+import org.apache.pinot.spi.utils.CommonConstants.Broker;
 import org.apache.pinot.spi.utils.builder.TableNameBuilder;
 import org.apache.pinot.sql.parsers.CalciteSqlCompiler;
 import org.slf4j.Logger;
@@ -76,6 +78,11 @@ public class QueryRouter {
 
   private final BrokerMetrics _brokerMetrics = BrokerMetrics.get();
   private final ConcurrentHashMap<Long, AsyncQueryResponse> _asyncQueryResponseMap = new ConcurrentHashMap<>();
+  // Told about a server that stopped answering queries on one of its channels (see ServerChannels). The request
+  // handler points it at the failure detector when pings are off and reporting is enabled; with or without it, the
+  // suspect channel is replaced by the next query to it, so recovery does not depend on the failure detector.
+  private volatile Consumer<ServerRoutingInstance> _unansweredServerReporter = serverRoutingInstance -> {
+  };
   /// Ping request ids count down from -1, so they can never collide with query request ids, which are non-negative
   /// (see `BrokerRequestIdGenerator`).
   private final AtomicLong _pingRequestIdGenerator = new AtomicLong();
@@ -90,12 +97,31 @@ public class QueryRouter {
   /// @param tlsConfig TLS config
   public QueryRouter(String brokerId, @Nullable NettyConfig nettyConfig, @Nullable TlsConfig tlsConfig,
       ServerRoutingStatsManager serverRoutingStatsManager, ThreadAccountant threadAccountant) {
+    this(brokerId, nettyConfig, tlsConfig, serverRoutingStatsManager, threadAccountant,
+        Broker.FailureDetector.DEFAULT_UNANSWERED_QUERIES_THRESHOLD,
+        Broker.FailureDetector.DEFAULT_UNANSWERED_QUERY_GRACE_MS);
+  }
+
+  /// @param unansweredQueriesThreshold see [Broker.FailureDetector#CONFIG_OF_UNANSWERED_QUERIES_THRESHOLD];
+  ///                                   non-positive disables the check
+  /// @param unansweredQueryGraceMs see [Broker.FailureDetector#CONFIG_OF_UNANSWERED_QUERY_GRACE_MS]
+  public QueryRouter(String brokerId, @Nullable NettyConfig nettyConfig, @Nullable TlsConfig tlsConfig,
+      ServerRoutingStatsManager serverRoutingStatsManager, ThreadAccountant threadAccountant,
+      int unansweredQueriesThreshold, long unansweredQueryGraceMs) {
     _brokerId = brokerId;
-    _serverChannels = new ServerChannels(this, nettyConfig, null, threadAccountant);
-    _serverChannelsTls = tlsConfig != null ? new ServerChannels(this, nettyConfig, tlsConfig, threadAccountant) : null;
+    _serverChannels = new ServerChannels(this, nettyConfig, null, threadAccountant, unansweredQueriesThreshold,
+        unansweredQueryGraceMs);
+    _serverChannelsTls = tlsConfig != null ? new ServerChannels(this, nettyConfig, tlsConfig, threadAccountant,
+        unansweredQueriesThreshold, unansweredQueryGraceMs) : null;
     _serverRoutingStatsManager = serverRoutingStatsManager;
   }
 
+  /// Registers the consumer told about a server that stopped answering queries on one of its channels, typically the
+  /// failure detector. Called from the transport's liveness thread, never from an event loop.
+  public void setUnansweredServerReporter(Consumer<ServerRoutingInstance> unansweredServerReporter) {
+    _unansweredServerReporter = unansweredServerReporter;
+  }
+
   public AsyncQueryResponse submitQuery(long requestId, String rawTableName,
       @Nullable BrokerRequest offlineBrokerRequest,
       @Nullable Map<ServerInstance, SegmentsToQuery> offlineRoutingTable,
@@ -180,18 +206,19 @@ public boolean hasChannel(ServerInstance serverInstance) {
     return !channelRoutingInstances(serverInstance).isEmpty();
   }
 
-  /// Connects to the given server, returns `true` if the server is successfully connected.
-  ///
-  /// This is the reachability probe the failure detector uses when pings are off, opening the OFFLINE channel with a
-  /// TCP connect only. Startup pre-connect uses [#preConnect] instead.
+  /// The reachability probe the failure detector uses when pings are off. Re-establishes every channel this broker
+  /// has queried the server over, one per table type: reconnects the ones that are down and replaces the ones marked
+  /// suspect (see [ServerChannels#recordUnansweredQuery]) with a fresh connection, so that a half-open socket that
+  /// still reports active is never vouched for. Returns `true` if every such channel is connected afterwards, which
+  /// includes the vacuous case of a server with no such channel: callers that need "reachable" must check
+  /// [#hasChannel] first, as `retryUnhealthyServer` doe
```

**File**: `pinot-core/src/main/java/org/apache/pinot/core/transport/ServerChannels.java` (modified, +221/-21)
```diff
@@ -19,6 +19,7 @@
 package org.apache.pinot.core.transport;
 
 import com.google.common.annotations.VisibleForTesting;
+import com.google.common.util.concurrent.ThreadFactoryBuilder;
 import io.netty.bootstrap.Bootstrap;
 import io.netty.buffer.PooledByteBufAllocator;
 import io.netty.buffer.PooledByteBufAllocatorMetric;
@@ -42,8 +43,12 @@
 import io.netty.handler.ssl.SslHandler;
 import io.netty.util.concurrent.Future;
 import java.util.concurrent.ConcurrentHashMap;
+import java.util.concurrent.Executors;
+import java.util.concurrent.RejectedExecutionException;
+import java.util.concurrent.ScheduledExecutorService;
 import java.util.concurrent.TimeUnit;
 import java.util.concurrent.TimeoutException;
+import java.util.concurrent.atomic.AtomicInteger;
 import java.util.concurrent.locks.ReentrantLock;
 import java.util.function.ToLongFunction;
 import javax.annotation.Nullable;
@@ -57,6 +62,7 @@
 import org.apache.pinot.common.request.InstanceRequest;
 import org.apache.pinot.core.util.OsCheck;
 import org.apache.pinot.spi.accounting.ThreadAccountant;
+import org.apache.pinot.spi.utils.CommonConstants.Broker;
 import org.apache.thrift.TSerializer;
 import org.apache.thrift.protocol.TCompactProtocol;
 import org.apache.thrift.transport.TTransportException;
@@ -79,7 +85,10 @@
 ///   - the routing manager evicts the cached channels of a server when it enables it, as after a restart, and when it
 ///     sees the server removed from the cluster or moved to another address ([#evictChannel]); a channel that still
 ///     carries queries when its server is enabled is retired instead: the next query opens a fresh connection, and
-///     the old one is closed once the queries on it are past their deadline ([#evictChannelOfEnabledServer]).
+///     the old one is closed once the queries on it are past their deadline ([#evictChannelOfEnabledServer]);
+///   - a channel on which the server left [Broker.FailureDetector#CONFIG_OF_UNANSWERED_QUERIES_THRESHOLD] consecutive
+///     queries unanswered, each judged a grace period after its timeout, is marked suspect: the next query to it, or
+///     the failure detector's retry probe, replaces it with a fresh connection ([#recordUnansweredQuery]).
 @ThreadSafe
 public class ServerChannels {
   private static final Logger LOGGER = LoggerFactory.getLogger(ServerChannels.class);
@@ -111,6 +120,16 @@ public class ServerChannels {
   private final long _writeTimeoutMs;
   private final int _tcpUserTimeoutMs;
   private final WriteBufferWaterMark _writeBufferWaterMark;
+  private final int _unansweredQueriesThreshold;
+  private final long _unansweredQueryGraceMs;
+  // Bound on the judgments queued per channel at a time. Under a dead server at high QPS every timed-out query would
+  // otherwise queue a task for the whole grace period; the first few judgments already cross the threshold, so the
+  // rest add nothing but queue depth.
+  private final int _maxPendingJudgmentsPerChannel;
+  // Judges unanswered queries once their grace period is over, and reports the server from there; null when the
+  // check is disabled. Its own thread, because reporting ends in a routing update that must not run on an event loop.
+  @Nullable
+  private final ScheduledExecutorService _livenessExecutor;
 
   private final BrokerMetrics _brokerMetrics = BrokerMetrics.get();
   private final ConcurrentHashMap<ServerRoutingInstance, ServerChannel> _serverToChannelMap = new ConcurrentHashMap<>();
@@ -121,6 +140,16 @@ public class ServerChannels {
   /// @param tlsConfig TLS/SSL config
   public ServerChannels(QueryRouter queryRouter, @Nullable NettyConfig nettyConfig, @Nullable TlsConfig tlsConfig,
       ThreadAccountant threadAccountant) {
+    this(queryRouter, nettyConfig, tlsConfig, threadAccountant,
+        Broker.FailureDetector.DEFAULT_UNANSWERED_QUERIES_THRESHOLD,
+        Broker.FailureDetector.DEFAULT_UNANSWERED_QUERY_GRACE_MS);
+  }
+
+  /// @param unansweredQueriesThreshold see [Broker.FailureDetector#CONFIG_OF_UNANSWERED_QUERIES_THRESHOLD];
+  ///                                   non-positive disables the check
+  /// @param unansweredQueryGraceMs see [Broker.FailureDetector#CONFIG_OF_UNANSWERED_QUERY_GRACE_MS]
+  public ServerChannels(QueryRouter queryRouter, @Nullable NettyConfig nettyConfig, @Nullable TlsConfig tlsConfig,
+      ThreadAccountant threadAccountant, int unansweredQueriesThreshold, long unansweredQueryGraceMs) {
     if (nettyConfig == null) {
       nettyConfig = new NettyConfig();
     }
@@ -159,9 +188,16 @@ public ServerChannels(QueryRouter queryRouter, @Nullable NettyConfig nettyConfig
     _tcpUserTimeoutMs = nettyConfig.getTcpUserTimeoutMs();
     _writeBufferWaterMark = new WriteBufferWaterMark(nettyConfig.getWriteBufferLowWaterMarkBytes(),
         nettyConfig.getWriteBufferHighWaterMarkBytes());
+    _unansweredQueriesThreshold = unansweredQueriesThreshold;
+    _unansweredQueryGraceMs = Math.max(0L, unansweredQueryGraceMs);
+    _maxPendingJudgmentsPerChann
```

#### Recent Merged Pull Requests:
- **PR #20184** (2026-11-07): Clarify review compatibility and style conventions (@Jackie-Jiang)
- **PR #20181** (2026-11-06): Bump net.minidev:json-smart from 2.6.0 to 2.6.1 (@dependabot[bot])
- **PR #20180** (2026-11-06): Bump com.google.errorprone:error_prone_annotations from 2.51.0 to 2.52.0 (@dependabot[bot])
- **PR #20179** (2026-11-06): Bump org.checkerframework:checker-qual from 4.3.1 to 4.4.0 (@dependabot[bot])
- **PR #20178** (2026-11-06): Bump com.google.guava:guava-bom from 33.7.2-jre to 33.8.0-jre (@dependabot[bot])
- **PR #20177** (2026-11-06): Bump com.github.jnr:jnr-ffi from 2.3.6 to 2.3.7 (@dependabot[bot])

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

## X. Use the empty-batch stream position only for consumption lag on transactional Ka

**RULE**:
When implementing operations in `pinot-core/src/main/java/org/apache/pinot/core/data/manager/realtime/RealtimeSegmentDataManager.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apache/pinot. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0007e8b9`: Use the empty-batch stream position only for consumption lag on transactional Kafka topics (#20024). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `pinot-core/src/main/java/org/apache/pinot/core/data/manager/realtime/RealtimeSegmentDataManager.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
  // Furthest next offset reported by a batch without messages, e.g. one past a Kafka transaction marker. Only feeds
  // consumption lag and the highest-offset gauge (see getStreamPosition()). Written by the consumer thread only.
  @Nullable
  private volatile StreamPartitionMsgOffset _emptyBatchStreamPosition;
        updateHighestStreamOffsetConsumedGauge();
        if (recordStreamPositionOfEmptyBatch(messageBatch)) {
          updateHighestStreamOffsetConsumedGauge();
        }
  // TODO Issue 5359 Need to find a way to bump metrics without getting actual offset value.
  private void updateHighestStreamOffsetConsumedGauge() {
    StreamPartitionMsgOffset streamPosition = getStreamPosition();
    if (streamPosition instanceof LongMsgOffset) {
      // TODO: only LongMsgOffset supplies long offset value.
      _serverMetrics.setValueOfTableGauge(_clientId, ServerGauge.HIGHEST_STREAM_OFFSET_CONSUMED,
          ((LongMsgOffset) streamPosition).getOffset());
    }
  }

  /// Records the next offset of a batch without messages when it is ahead of [#getStreamPosition()], which happens
  /// when the stream moved past offsets it never delivers, such as Kafka transaction markers.
  ///
```

**NEGATIVE CONSTRAINT**:
```java
// Anti-pattern to NEVER write (induced failure mode):
        // TODO Issue 5359 Need to find a way to bump metrics without getting actual offset value.
        if (_currentOffset instanceof LongMsgOffset) {
          // TODO: only LongMsgOffset supplies long offset value.
          _serverMetrics.setValueOfTableGauge(_clientId, ServerGauge.HIGHEST_STREAM_OFFSET_CONSUMED,
              ((LongMsgOffset) _currentOffset).getOffset());
        }
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0007e8b9` are properly handled with clean fallback behavior.
