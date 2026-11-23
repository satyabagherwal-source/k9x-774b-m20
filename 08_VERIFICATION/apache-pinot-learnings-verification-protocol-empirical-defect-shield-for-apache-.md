# Verification Protocol: Verification Protocol: Empirical Defect Shield for apache-pinot-learnings

<!-- PROVENANCE_START
{
  "source_repository": "apache-pinot-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T22:15:06.958Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-apache-pinot-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apache-pinot-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T22:15:06.958Z`  
> **Learning ID**: `LEARN-EVO-apache-pinot-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `apache-pinot-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/apache-pinot-learnings.md`  
> **Source**: github ([https://github.com/apache/pinot](https://github.com/apache/pinot))  
> **Source Version**: `87886387`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-23T22:15:00.001Z  
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
> **Harvest Timestamp**: 2026-11-23T22:14:59.869Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apache/pinot`
- **Description**: Apache Pinot: a real-time analytics database for low-latency SQL and vector search, serving user-facing and agent-facing applications
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6178 stars

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
- **Issue #20297** (2026-11-19): **Upgrade Lucene from 9.12.0 to 9.12.3**
  *Symptoms*: Upgrade Lucene from 9.12.0 to 9.12.3 through the shared Maven property and update the Lucene artifacts listed in `LICENSE-binary`.  The [9.12.1–9.12.3 releases](https://lucene.apache.org/core/9_12_3/changes/Changes.html) include fixes for vector-index compatibility, HNSW behavior, and an infinite loop during memory-mapped resource cleanup. This dependency update is separate from the startup deadlock workaround in #20296; Lucene 9.12.3 still contains the class-initialization cycle.  Validation:  - 187 existing tests across 15 Lucene text-index, realtime-index, HNSW, rollback-recovery, and core text-query classes passed on JDK 25. - Verified that all seven Lucene artifacts on the test runtime classpaths resolve to 9.12.3. - Scoped reactor compilation with compiler warnings and deprecation reporting enabled. - Root Spotless, Checkstyle, license formatting/checks, and diff whitespace checks passed.  No new tests were added. The full cluster upgrade/rollback compatibility suites remain for CI. 

- **Issue #20296** (2026-11-18): **Prevent Lucene class initialization deadlock during server startup**
  *Symptoms*: Server startup can deadlock when Helix concurrently opens existing text indexes and creates realtime text indexes. Lucene 9.12.0 has a class initialization cycle between `IndexWriter`, `TestSecrets`, and `ConcurrentMergeScheduler` ([Lucene #12419](https://github.com/apache/lucene/issues/12419)). The [compatibility failure during rollback to Pinot 1.5.0](https://github.com/apache/pinot/actions/runs/44070961025/job/133996755187) captured this cycle in its thread dump: segment transitions remain blocked and server readiness times out.  Initialize `IndexWriter` synchronously before the server starts parallel segment loading. The compatibility verifier also uses a Java 11 bootstrap to perform the initialization inside each tested server JVM, including older releases during initial startup and rollback. Its generated launcher preserves the distribution's dependencies, JVM options, arguments, and PID handling. Readiness checks and timeouts remain unchanged.  Validation:  - Scoped server reactor build and `BaseServerStarterTest`: 3 tests passed. - `python3 compatibility-verifier/test_server_readiness.py`: 7 tests passed. - Fresh-JVM Lucene 9.12.0 reproducer: deadlock observed without preinitialization; 20/20 processes completed concurrent index reads and writes with preinitialization. - Scoped Spotless, Checkstyle, license formatting/checks, shell syntax, and diff whitespace checks passed.  The full compatibility suite has not been rerun locally; CI will validate the complete upgrade

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

### Incident Patch 1: `2f3fca63` (2026-11-23)
**Commit Message**: Add an auto spool mode guarded against deadlocks and make it the default (#19944)

**File**: `pinot-broker/src/main/java/org/apache/pinot/broker/requesthandler/MultiStageBrokerRequestHandler.java` (modified, +6/-3)
```diff
@@ -86,6 +86,7 @@
 import org.apache.pinot.query.QueryEnvironment;
 import org.apache.pinot.query.mailbox.MailboxService;
 import org.apache.pinot.query.planner.explain.AskingServerStageExplainer;
+import org.apache.pinot.query.planner.logical.SpoolMode;
 import org.apache.pinot.query.planner.physical.DispatchablePlanFragment;
 import org.apache.pinot.query.planner.physical.DispatchableSubPlan;
 import org.apache.pinot.query.planner.plannode.PlanNode;
@@ -159,6 +160,8 @@ public class MultiStageBrokerRequestHandler extends BaseBrokerRequestHandler {
   protected final String _defaultStreamingGroupByFlushThreshold;
   @Nullable
   protected final String _defaultStreamingDistinctFlushThreshold;
+  /// Parsed once so that an invalid [CommonConstants.Broker#CONFIG_OF_SPOOLS] fails the broker start, not every query.
+  private final SpoolMode _defaultSpoolMode;
 
   protected final PinotMeter _stagesStartedMeter = BrokerMeter.MSE_STAGES_STARTED.getGlobalMeter();
   protected final PinotMeter _stagesFinishedMeter = BrokerMeter.MSE_STAGES_COMPLETED.getGlobalMeter();
@@ -255,6 +258,8 @@ public MultiStageBrokerRequestHandler(PinotConfiguration config, String brokerId
         CommonConstants.Broker.DEFAULT_MSE_STREAMING_DISTINCT_FLUSH_THRESHOLD);
     _defaultStreamingDistinctFlushThreshold =
         streamingDistinctFlushThreshold > 0 ? Integer.toString(streamingDistinctFlushThreshold) : null;
+    _defaultSpoolMode = SpoolMode.fromString(_config.getProperty(CommonConstants.Broker.CONFIG_OF_SPOOLS,
+        CommonConstants.Broker.DEFAULT_SPOOLS_MODE));
   }
 
   /// Returns the planner rules disabled by default: the comma-separated list in
@@ -556,8 +561,6 @@ private ImmutableQueryEnvironment.Config getQueryEnvConf(HttpHeaders httpHeaders
     String database = DatabaseUtils.extractDatabaseFromQueryRequest(queryOptions, httpHeaders);
     boolean inferPartitionHint = _config.getProperty(CommonConstants.Broker.CONFIG_OF_INFER_PARTITION_HINT,
         CommonConstants.Broker.DEFAULT_INFER_PARTITION_HINT);
-    boolean defaultUseSpool = _config.getProperty(CommonConstants.Broker.CONFIG_OF_SPOOLS,
-        CommonConstants.Broker.DEFAULT_OF_SPOOLS);
     boolean defaultUseLeafServerForIntermediateStage = _config.getProperty(
         CommonConstants.Broker.CONFIG_OF_USE_LEAF_SERVER_FOR_INTERMEDIATE_STAGE,
         CommonConstants.Broker.DEFAULT_USE_LEAF_SERVER_FOR_INTERMEDIATE_STAGE);
@@ -625,7 +628,7 @@ private ImmutableQueryEnvironment.Config getQueryEnvConf(HttpHeaders httpHeaders
         .isCaseSensitive(caseSensitive)
         .isNullHandlingEnabled(QueryOptionsUtils.isNullHandlingEnabled(queryOptions))
         .defaultInferPartitionHint(inferPartitionHint)
-        .defaultUseSpools(defaultUseSpool)
+        .defaultSpoolMode(_defaultSpoolMode)
         .defaultUnnestColumnPruning(defaultUnnestColumnPruning)
         .defaultUseLeafServerForIntermediateStage(defaultUseLeafServerForIntermediateStage)
         .defaultEnableGroupTrim(defaultEnableGroupTrim)
```

**File**: `pinot-common/src/main/java/org/apache/pinot/common/metrics/BrokerMeter.java` (modified, +4/-0)
```diff
@@ -266,6 +266,10 @@ public class BrokerMeter implements AbstractMetrics.Meter {
   ///
   /// For each query with at least one join, this meter is increased as many times as joins in the query.
   public static final BrokerMeter JOIN_COUNT = create("JOIN_COUNT", "queries", true);
+  /// How many times the multi-stage planner made a stage feed one more consumer stage (a spool).
+  public static final BrokerMeter SPOOLS_APPLIED = create("SPOOLS_APPLIED", "spools", true);
+  /// How many spools the multi-stage planner refused because the shared stage could block the query.
+  public static final BrokerMeter SPOOLS_REJECTED_BY_GUARD = create("SPOOLS_REJECTED_BY_GUARD", "spools", true);
   /// How many queries with window functions have been executed.
   ///
   /// For each query with at least one window function, this meter is increased exactly once.
```

**File**: `pinot-common/src/main/java/org/apache/pinot/common/utils/config/QueryOptionsUtils.java` (modified, +8/-0)
```diff
@@ -1117,6 +1117,14 @@ public static Boolean getVectorUseBoundedQueue(Map<String, String> queryOptions)
         queryOptions.get(QueryOptionKey.VECTOR_USE_BOUNDED_QUEUE));
   }
 
+  /// Returns whether the response must describe the spool decisions of the multi-stage planner. Defaults to `false`.
+  ///
+  /// @throws IllegalArgumentException if the option is set to a value other than `true` or `false`
+  public static boolean isSpoolsFeedback(Map<String, String> queryOptions) {
+    return Boolean.TRUE.equals(checkedParseBooleanNullable(QueryOptionKey.SPOOLS_FEEDBACK,
+        queryOptions.get(QueryOptionKey.SPOOLS_FEEDBACK)));
+  }
+
   @Nullable
   private static Boolean checkedParseBooleanNullable(String optionName, @Nullable String optionValue) {
     if (optionValue == null) {
```

**File**: `pinot-common/src/test/java/org/apache/pinot/common/utils/config/QueryOptionsUtilsTest.java` (modified, +12/-0)
```diff
@@ -330,6 +330,18 @@ public void testVectorNprobeValid() {
     assertEquals(QueryOptionsUtils.getVectorNprobe(Map.of(VECTOR_NPROBE, "128")), Integer.valueOf(128));
   }
 
+  @Test
+  public void testSpoolsFeedback() {
+    assertFalse(QueryOptionsUtils.isSpoolsFeedback(Map.of()));
+    assertTrue(QueryOptionsUtils.isSpoolsFeedback(Map.of(SPOOLS_FEEDBACK, "true")));
+    assertTrue(QueryOptionsUtils.isSpoolsFeedback(Map.of(SPOOLS_FEEDBACK, " TRUE ")));
+    assertFalse(QueryOptionsUtils.isSpoolsFeedback(Map.of(SPOOLS_FEEDBACK, "false")));
+    expectThrows(IllegalArgumentException.class,
+        () -> QueryOptionsUtils.isSpoolsFeedback(Map.of(SPOOLS_FEEDBACK, "1")));
+    expectThrows(IllegalArgumentException.class,
+        () -> QueryOptionsUtils.isSpoolsFeedback(Map.of(SPOOLS_FEEDBACK, "yes")));
+  }
+
   @Test
   public void testVectorNprobeNull() {
     assertNull(QueryOptionsUtils.getVectorNprobe(Map.of()));
```

**File**: `pinot-integration-tests/src/test/java/org/apache/pinot/integration/tests/SpoolIntegrationTest.java` (modified, +74/-0)
```diff
@@ -127,6 +127,80 @@ public void intermediateSpool()
     checkSpoolSame(parsed, 4, 3, 7);
   }
 
+  /// The query of [#intermediateSpool()] spools stage 4 into the probe input of the join and, through an aggregate,
+  /// into its build input. The join reads the probe input only after the build input finishes, so with a full probe
+  /// mailbox the shared stage stops and the build input never finishes. `auto` must refuse that spool.
+  @Test
+  public void autoRejectsSpoolThatCanBlock()
+      throws Exception {
+    JsonNode jsonNode = postQuery("SET useSpools = 'auto';\n"
+        + "SET spoolsFeedback = true;\n"
+        + "WITH group_and_sum AS (\n"
+        + "  SELECT ArrTimeBlk, Dest, SUM(ArrTime) AS ArrTime\n"
+        + "  FROM mytable\n"
+        + "  GROUP BY ArrTimeBlk, Dest\n"
+        + "  limit 1000\n"
+        + "),\n"
+        + "aggregated_data AS (\n"
+        + "  SELECT Dest, SUM(ArrTime) AS ArrTime\n"
+        + "  FROM group_and_sum\n"
+        + "  GROUP BY Dest\n"
+        + ")\n"
+        + "SELECT s.Dest, s.ArrTime, o.ArrTime AS ArrTime2\n"
+        + "FROM group_and_sum s\n"
+        + "JOIN aggregated_data o\n"
+        + "ON s.Dest = o.Dest\n"
+        + "LIMIT 1");
+    assertNoError(jsonNode);
+    JsonNode spools = jsonNode.get("responseMetadata").get("spools");
+    Assert.assertEquals(spools.get("mode").asText(), "auto", spools.toString());
+    // The shared intermediate stage is refused. The leaf stage below it can still be shared, because both of its
+    // consumers aggregate it, so this test does not assert that no spool is applied.
+    Assert.assertTrue(hasOutcome(spools, "REJECTED_BY_GUARD"), spools.toString());
+  }
+
+  /// Both consumers of the shared stage aggregate it, so each consumer reads the whole shared stage before the join
+  /// waits for any input. `auto` must apply that spool, and the result must not change.
+  @Test
+  public void autoAppliesSpoolWhenConsumersAggregate()
+      throws Exception {
+    // The ORDER BY makes g deterministic. Without it, each copy of g can keep a different set of 1000 groups when
+    // spools are off, so the results differ for a reason that has nothing to do with spools.
+    String query = "WITH g AS (\n"
+        + "  SELECT ArrTimeBlk, Dest, SUM(ArrTime) AS ArrTime\n"
+        + "  FROM mytable\n"
+        + "  GROUP BY ArrTimeBlk, Dest\n"
+        + "  ORDER BY ArrTimeBlk, Dest\n"
+        + "  LIMIT 1000\n"
+        + ")\n"
+        + "SELECT a.Dest, a.s, b.m\n"
+        // Both consumers read the same columns of g. Otherwise the planner prunes each copy of g to different columns,
+        // and the two copies are not equivalent.
+        + "FROM (SELECT Dest, SUM(ArrTime) AS s FROM g GROUP BY Dest) a\n"
+        + "JOIN (SELECT Dest, MAX(ArrTime) AS m FROM g GROUP BY Dest) b\n"
+        + "ON a.Dest = b.Dest\n"
+        + "ORDER BY a.Dest\n"
+        + "LIMIT 10000";
+    JsonNode withSpools = postQuery("SET useSpools = 'auto';\nSET spoolsFeedback = true;\n" + query);
+    assertNoError(withSpools);
+    JsonNode spools = withSpools.get("responseMetadata").get("spools");
+    Assert.assertTrue(hasOutcome(spools, "APPLIED"), spools.toString());
+    Assert.assertFalse(hasOutcome(spools, "REJECTED_BY_GUARD"), spools.toString());
+
+    JsonNode withoutSpools = postQuery("SET useSpools = 'off';\n" + query);
+    assertNoError(withoutSpools);
+    Assert.assertEquals(withSpools.get("resultTable").get("rows"), withoutSpools.get("resultTable").get("rows"));
+  }
+
+  private static boolean hasOutcome(JsonNode spools, String outcome) {
+    for (JsonNode substitution : spools.get("substitutions")) {
+      if (substitution.get("outcome").asText().equals(outcome)) {
+        return true;
+      }
+    }
+    return false;
+  }
+
   /// Test a complex with nested spools.
   ///
   /// Don't try to understand the query, just check that the spools are correct.
```

**File**: `pinot-query-planner/src/main/java/org/apache/pinot/query/QueryEnvironment.java` (modified, +30/-8)
```diff
@@ -84,6 +84,7 @@
 import org.apache.pinot.query.planner.explain.PhysicalExplainPlanVisitor;
 import org.apache.pinot.query.planner.logical.PinotLogicalQueryPlanner;
 import org.apache.pinot.query.planner.logical.RelToPlanNodeConverter;
+import org.apache.pinot.query.planner.logical.SpoolMode;
 import org.apache.pinot.query.planner.logical.TransformationTracker;
 import org.apache.pinot.query.planner.physical.DispatchableSubPlan;
 import org.apache.pinot.query.planner.physical.PinotDispatchPlanner;
@@ -578,8 +579,9 @@ private DispatchableSubPlan toDispatchableSubPlan(RelRoot relRoot, PlannerContex
           _envConfig.getWorkerManager(), requestId, _envConfig.getTableCache());
       return pinotDispatchPlanner.createDispatchableSubPlanV2(plan.getLeft(), plan.getRight());
     }
-    SubPlan plan = PinotLogicalQueryPlanner.makePlan(relRoot, tracker, useSpools(plannerContext.getOptions()),
-        _envConfig.defaultHashFunction(), pruneUnnestColumns(plannerContext.getOptions()));
+    Map<String, String> options = plannerContext.getOptions();
+    SubPlan plan = PinotLogicalQueryPlanner.makePlan(relRoot, tracker, getSpoolMode(options),
+        isSpoolsFeedback(options), _envConfig.defaultHashFunction(), pruneUnnestColumns(options));
     PinotDispatchPlanner pinotDispatchPlanner =
         new PinotDispatchPlanner(plannerContext, _envConfig.getWorkerManager(), _envConfig.getRequestId(),
             _envConfig.getTableCache());
@@ -756,12 +758,32 @@ public static ImmutableQueryEnvironment.Config.Builder configBuilder() {
     return ImmutableQueryEnvironment.Config.builder();
   }
 
-  public boolean useSpools(Map<String, String> options) {
+  /// Returns the spool mode of the query: the [CommonConstants.Broker.Request.QueryOptionKey#USE_SPOOLS] query option
+  /// when it is set, or [Config#defaultSpoolMode()] otherwise.
+  ///
+  /// @throws QueryException with [QueryErrorCode#QUERY_VALIDATION] if the query option is not a valid [SpoolMode].
+  public SpoolMode getSpoolMode(Map<String, String> options) {
     String optionValue = options.get(CommonConstants.Broker.Request.QueryOptionKey.USE_SPOOLS);
     if (optionValue == null) {
-      return _envConfig.defaultUseSpools();
+      return _envConfig.defaultSpoolMode();
+    }
+    try {
+      return SpoolMode.fromString(optionValue);
+    } catch (IllegalArgumentException e) {
+      throw QueryErrorCode.QUERY_VALIDATION.asException(e.getMessage(), e);
+    }
+  }
+
+  /// Whether the response must describe the spool decisions of the planner. See
+  /// [CommonConstants.Broker.Request.QueryOptionKey#SPOOLS_FEEDBACK].
+  ///
+  /// @throws QueryException with [QueryErrorCode#QUERY_VALIDATION] if the query option is not `true` or `false`.
+  public static boolean isSpoolsFeedback(Map<String, String> options) {
+    try {
+      return QueryOptionsUtils.isSpoolsFeedback(options);
+    } catch (IllegalArgumentException e) {
+      throw QueryErrorCode.QUERY_VALIDATION.asException(e.getMessage(), e);
     }
-    return Boolean.parseBoolean(optionValue);
   }
 
   /// Whether to prune unused input (passthrough) columns from the UNNEST output. Defaults to the broker config
@@ -821,15 +843,15 @@ default boolean defaultInferPartitionHint() {
       return CommonConstants.Broker.DEFAULT_INFER_PARTITION_HINT;
     }
 
-    /// Whether to use spools or not.
+    /// The spool mode.
     ///
     /// This is treated as the default value for the broker and it is expected to be obtained from a Pinot
     /// configuration.
     /// This default value can be always overridden at query level by the query option
     /// [CommonConstants.Broker.Request.QueryOptionKey#USE_SPOOLS].
     @Value.Default
-    default boolean defaultUseSpools() {
-      return CommonConstants.Broker.DEFAULT_OF_SPOOLS;
+    default SpoolMode defaultSpoolMode() {
+      return SpoolMode.fromString(CommonConstants.Broker.DEFAULT_SPOOLS_MODE);
     }
 
     /// Whether to prune unused input (passthrough) columns from the UNNEST output by default.
```

**File**: `pinot-query-planner/src/main/java/org/apache/pinot/query/planner/logical/EquivalentStagesFinder.java` (modified, +7/-0)
```diff
@@ -78,6 +78,13 @@ public Void visitMailboxSend(MailboxSendNode node, Void context) {
       // from O(n^3) to O(n^2).
       visitChildren(node, context);
 
+      // A stage that calls a volatile function must draw its own values, so it is never equivalent to another stage.
+      // The stages above it are not equivalent either, because their receives read from different groups.
+      if (VolatileFunctions.callsVolatileFunction(node)) {
+        _equivalentStages.addNewGroup(node);
+        return null;
+      }
+
       // first try to find if the current node/stage is equivalent to an already equivalent stages.
       for (MailboxSendNode uniqueStage : _equivalentStages.getLeaders()) {
         if (_nodeEquivalence.areEquivalent(node, uniqueStage)) {
```

**File**: `pinot-query-planner/src/main/java/org/apache/pinot/query/planner/logical/EquivalentStagesReplacer.java` (modified, +64/-17)
```diff
@@ -18,6 +18,11 @@
  */
 package org.apache.pinot.query.planner.logical;
 
+import java.util.ArrayList;
+import java.util.Collections;
+import java.util.IdentityHashMap;
+import java.util.List;
+import java.util.Set;
 import org.apache.pinot.query.planner.plannode.MailboxReceiveNode;
 import org.apache.pinot.query.planner.plannode.MailboxSendNode;
 import org.apache.pinot.query.planner.plannode.PlanNode;
@@ -32,6 +37,9 @@
 /// For each [MailboxReceiveNode] in the plan, if the sender is not the leader of the group,
 /// replaces the sender with the leader.
 /// The leader is also updated to include the receiver in its list of receivers.
+///
+/// When the replacement is guarded, each substitution is kept only if [SpoolDeadlockGuard] finds no risk in the
+/// resulting plan. Otherwise the substitution is undone and the original sender stays.
 public class EquivalentStagesReplacer {
   private EquivalentStagesReplacer() {
   }
@@ -40,12 +48,26 @@ public static void replaceEquivalentStages(PlanNode root, GroupedStages equivale
     replaceEquivalentStages(root, equivalentStages, OnSubstitution.NO_OP);
   }
 
-  /// Replaces the equivalent stages in the query plan.
+  /// Replaces the equivalent stages in the query plan, without [SpoolDeadlockGuard].
   ///
   /// @param root Root plan node
   /// @param equivalentStages Equivalent stages
   public static void replaceEquivalentStages(PlanNode root, GroupedStages equivalentStages, OnSubstitution listener) {
-    root.visit(new Replacer(listener), equivalentStages);
+    replaceEquivalentStages(root, equivalentStages, listener, false);
+  }
+
+  /// Replaces the equivalent stages in the query plan.
+  ///
+  /// @param root Root plan node
+  /// @param equivalentStages Equivalent stages
+  /// @param listener Called once for each applied substitution
+  /// @param guarded Whether each substitution must pass [SpoolDeadlockGuard]
+  /// @return One entry for each receive whose sender is not the leader of its group, in the order of the decisions
+  public static List<SpoolSubstitution> replaceEquivalentStages(PlanNode root, GroupedStages equivalentStages,
+      OnSubstitution listener, boolean guarded) {
+    Replacer replacer = new Replacer(root, listener, guarded);
+    root.visit(replacer, equivalentStages);
+    return replacer._substitutions;
   }
 
   public interface OnSubstitution {
@@ -55,33 +77,58 @@ public interface OnSubstitution {
   }
 
   private static class Replacer extends PlanNodeVisitor.DepthFirstVisitor<Void, GroupedStages> {
+    private final PlanNode _root;
     private final OnSubstitution _listener;
+    private final boolean _guarded;
+    private final List<SpoolSubstitution> _substitutions = new ArrayList<>();
+    /// A stage can be visited more than once (for example the leader of a group), so a receive is decided only once.
+    private final Set<MailboxReceiveNode> _visitedReceives = Collections.newSetFromMap(new IdentityHashMap<>());
 
-    public Replacer(OnSubstitution listener) {
+    public Replacer(PlanNode root, OnSubstitution listener, boolean guarded) {
+      _root = root;
       _listener = listener;
+      _guarded = guarded;
     }
 
     @Override
     public Void visitMailboxReceive(MailboxReceiveNode node, GroupedStages equivalenceGroups) {
+      if (!_visitedReceives.add(node)) {
+        return null;
+      }
       MailboxSendNode sender = node.getSender();
       MailboxSendNode leader = equivalenceGroups.getGroup(sender).first();
-      if (canSubstitute(sender, leader)) {
-        // we don't want to visit the children of the node given it is going to be pruned
-        node.setSender(leader);
-        leader.addReceiver(node);
-        _listener.onSubstitution(node.getStageId(), sender.getStageId(), leader.getStageId());
-      } else {
+      if (sender == leader) {
         visitMailboxSend(leader, equivalenceGroups);
+        return null;
+      }
+      if (leader.sharesReceiverStages(sender)) {
+        // The leader is already sending to this stage. Given we don't have the ability to send to multiple
+        // receivers in the same stage, we cannot optimize this case right now.
+        _substitutions.add(new SpoolSubstitution(node.getStageId(), sender.getStageId(), leader.getStageId(),
+            SpoolSubstitution.Outcome.REJECTED_SAME_RECEIVER_STAGE, null));
+        // The original sender stays in the plan, so the stages below it can still be shared.
+        visitMailboxSend(sender, equivalenceGroups);
+        return null;
       }
+      node.setSender(leader);
+      leader.addReceiver(node);
+      if (_guarded) {
+        SpoolDeadlockGuard.DeadlockRisk risk = SpoolDeadlockGuard.findRisk(_root);
+        if (risk != null) {
+          leader.removeReceiver(node);
+          node.setSender(sender);
+          _substitutions.add(new SpoolSubstitution(node.getStageId(), sender.getStageId(), leader.getStageId(),
+              SpoolSubstitution.Outcome.REJECTED_BY_GUARD, risk.toString()));
+    
```

---

### Incident Patch 2: `078c814f` (2026-11-23)
**Commit Message**: Rebalance PR CI workers without changing test fixtures (#20085)

**File**: `.github/workflows/pinot_unit_tests.yml` (modified, +68/-5)
```diff
@@ -83,17 +83,28 @@ jobs:
         timeout-minutes: 120
         run: |
           .github/workflows/scripts/.pinot_linter.sh
-  unit-test:
+  unit-test-shards:
     if: github.repository == 'apache/pinot'
     runs-on: ubuntu-latest
     strategy:
       # Changed to false in order to improve coverage using unsafe buffers
       fail-fast: false
       matrix:
-        testset: [ 1, 2 ]
+        testset: [ 1, 2, 3 ]
         java: [ 25 ]
         distribution: [ "temurin" ]
-    name: Pinot Unit Test Set ${{ matrix.testset }} (${{matrix.distribution}}-${{matrix.java}})
+        include:
+          - testset: 1
+            legacy_testset: 1
+          - testset: 2
+            legacy_testset: 2
+          - testset: 3
+            legacy_testset: 1
+    name: Pinot Unit Shard ${{ matrix.testset }} (${{matrix.distribution}}-${{matrix.java}})
+    outputs:
+      testset_1: ${{ steps.completed.outputs.testset_1 }}
+      testset_2: ${{ steps.completed.outputs.testset_2 }}
+      testset_3: ${{ steps.completed.outputs.testset_3 }}
     steps:
       - uses: actions/checkout@v7.0.1
       - name: Set up JDK ${{ matrix.java }}-${{ matrix.distribution }}
@@ -138,6 +149,7 @@ jobs:
         run: |
           .github/workflows/scripts/pr-tests/.pinot_tests_build.sh
       - name: Unit Test
+        id: run-tests
         env:
           RUN_INTEGRATION_TESTS: false
           RUN_TEST_SET: ${{ matrix.testset }}
@@ -163,13 +175,20 @@ jobs:
         timeout-minutes: 120
         run: |
           .github/workflows/scripts/pr-tests/.pinot_tests_unit.sh
+      - name: Record shard completion
+        id: completed
+        if: ${{ success() && steps.run-tests.outcome == 'success' }}
+        env:
+          TEST_SET: ${{ matrix.testset }}
+        run: |
+          echo "testset_${TEST_SET}=${GITHUB_SHA}:${GITHUB_RUN_ID}:${GITHUB_RUN_ATTEMPT}:${TEST_SET}" >> "$GITHUB_OUTPUT"
       - name: Upload coverage to Codecov
         uses: codecov/codecov-action@v7
         continue-on-error: true
         timeout-minutes: 5
         with:
-          flags: unittests,unittests${{ matrix.testset }},${{matrix.distribution}},java-${{matrix.java}}
-          name: codecov-unit-tests
+          flags: unittests,unittests${{ matrix.legacy_testset }},${{matrix.distribution}},java-${{matrix.java}}
+          name: codecov-unit-tests-${{ matrix.testset }}
           token: ${{ secrets.CODECOV_TOKEN }}
           fail_ci_if_error: false
           verbose: true
@@ -188,3 +207,47 @@ jobs:
             **/target/surefire-reports/
             **/target/site/surefire-report.html
           retention-days: 30
+
+  unit-test:
+    # Retain both legacy required check names; each requires every actual unit worker.
+    if: ${{ always() && github.repository == 'apache/pinot' }}
+    needs: unit-test-shards
+    runs-on: ubuntu-latest
+    strategy:
+      fail-fast: false
+      matrix:
+        testset: [ 1, 2 ]
+        java: [ 25 ]
+        distribution: [ "temurin" ]
+    name: Pinot Unit Test Set ${{ matrix.testset }} (${{matrix.distribution}}-${{matrix.java}})
+    steps:
+      - name: Require all unit workers
+        env:
+          SHARD_RESULT: ${{ needs.unit-test-shards.result }}
+          SET_1: ${{ needs.unit-test-shards.outputs.testset_1 }}
+          SET_2: ${{ needs.unit-test-shards.outputs.testset_2 }}
+          SET_3: ${{ needs.unit-test-shards.outputs.testset_3 }}
+        run: |
+          if [ "$SHARD_RESULT" != success ]; then
+            echo "Required unit worker result: $SHARD_RESULT"
+            exit 1
+          fi
+          for shard in 1 2 3; do
+            output="SET_${shard}"
+            IFS=: read -r sha run attempt recorded_shard extra <<< "${!output}"
+            if [ "$sha" != "$GITHUB_SHA" ] || [ "$run" != "$GITHUB_RUN_ID" ] \
+                || [ "$recorded_shard" != "$shard" ] || [ -n "$extra" ] \
+                || [ "${!output}" != "${sha}:${run}:${attempt}:${recorded_shard}" ]; then
+              echo "Unit worker $shard did not record successful completion for this run"
+              exit 1
+            fi
+            case "$attempt" in
+              ''|0*|*[!0-9]*) echo "Invalid completion attempt for unit worker $shard"; exit 1 ;;
+            esac
+            # A failed-jobs rerun retains successful workers from earlier attempts of this same run.
+            if [ "${#attempt}" -gt "${#GITHUB_RUN_ATTEMPT}" ] \
+                || [ "$attempt" -gt "$GITHUB_RUN_ATTEMPT" ]; then
+              echo "Invalid completion attempt for unit worker $shard"
+              exit 1
+            fi
+          done
```

**File**: `.github/workflows/scripts/pr-tests/.pinot_tests_build.sh` (modified, +16/-2)
```diff
@@ -18,6 +18,13 @@
 # under the License.
 #
 
+if [ "${RUN_INTEGRATION_TESTS:-}" == false ]; then
+  case "${RUN_TEST_SET:-}" in
+    1|2|3) ;;
+    *) echo "Unsupported RUN_TEST_SET value: ${RUN_TEST_SET:-unset}" >&2; exit 1 ;;
+  esac
+fi
+
 # Java version
 java -version
 
@@ -36,8 +43,8 @@ if [ "$RUN_INTEGRATION_TESTS" != false ]; then
     -pl 'pinot-bom,pinot-integration-tests' || exit 1
 else
   # Unit Tests
-  #   - TEST_SET#1 runs install and test together so the module list must ensure no additional modules were tested
-  #     due to the -am flag (include dependency modules)
+  # Every worker installs its required dependencies with tests skipped. The subsequent test
+  # command selects only its assigned modules without -am, so dependency tests are not repeated.
   if [ "$RUN_TEST_SET" == "1" ]; then
     mvn clean install \
       -DskipTests -Dcheckstyle.skip -Dspotless.skip -Denforcer.skip -Dlicense.skip -Dmaven.plugin.appassembler.skip=true \
@@ -61,4 +68,11 @@ else
       -pl '!pinot-perf' \
       -pl '!pinot-distribution' || exit 1
   fi
+  if [ "$RUN_TEST_SET" == "3" ]; then
+    mvn clean install \
+      -DskipTests -Dcheckstyle.skip -Dspotless.skip -Denforcer.skip -Dlicense.skip -Dmaven.plugin.appassembler.skip=true \
+      -am -B -T 16 -ntp \
+      -P github-actions \
+      -pl 'pinot-bom,pinot-core' || exit 1
+  fi
 fi
```

**File**: `.github/workflows/scripts/pr-tests/.pinot_tests_unit.sh` (modified, +22/-7)
```diff
@@ -18,6 +18,11 @@
 # under the License.
 #
 
+case "${RUN_TEST_SET:-}" in
+  1|2|3) ;;
+  *) echo "Unsupported RUN_TEST_SET value: ${RUN_TEST_SET:-unset}" >&2; exit 1 ;;
+esac
+
 # Java version
 java -version
 
@@ -26,8 +31,14 @@ ifconfig
 netstat -i
 
 # Unit Tests
-#   - Both test sets run plain `mvn test` (no install, no -am): the modules were already built
-#     and installed by .pinot_tests_build.sh, so only the modules listed here are tested.
+#   - All three workers run `mvn test` (no install, no -am), so only the listed modules are tested.
+#     .pinot_tests_build.sh has already built and installed their required reactor dependencies.
+#   - The preceding clean install built the same sources with the same JDK/compiler settings.
+#     Use Maven's source/class timestamp check on this second invocation: the default incremental
+#     mode otherwise recompiles whole modules when reactor class directories become installed jars
+#     on the classpath. Missing classes or newer sources still compile, including modules omitted
+#     from the build step. Keep the test lifecycle so named Surefire suites, ScalaTest, resources,
+#     and JaCoCo still run. Do not use this setting for ordinary builds after source/API changes.
 #
 # Parallelism / memory:
 #   - UNIT_TEST_FORK_COUNT (default 3) sets surefire forkCount so test *classes* run in
@@ -64,21 +75,19 @@ else
   COVERAGE_PROFILE=""
 fi
 if [ "$RUN_TEST_SET" == "1" ]; then
-  # pinot-segment-local's tests run in set #2 to balance pinot-core's longer test time in this
-  # shard against set #2's longer build. It remains built in set #1 as a pinot-core dependency.
+  # Core tests run in worker #3. Its artifacts are still needed here by the query modules.
   # No -am on this command, so only the listed modules test.
-  mvn test ${FORK_OPTS} \
+  mvn test ${FORK_OPTS} -Dmaven.compiler.useIncrementalCompilation=false \
       -pl 'pinot-spi' \
       -pl 'pinot-segment-spi' \
       -pl 'pinot-common' \
       -pl ':pinot-yammer' \
-      -pl 'pinot-core' \
       -pl 'pinot-query-planner' \
       -pl 'pinot-query-runtime' \
       -P github-actions,no-integration-tests${COVERAGE_PROFILE} || exit 1
 fi
 if [ "$RUN_TEST_SET" == "2" ]; then
-  mvn test ${FORK_OPTS} \
+  mvn test ${FORK_OPTS} -Dmaven.compiler.useIncrementalCompilation=false \
     -pl '!pinot-spi' \
     -pl '!pinot-segment-spi' \
     -pl '!pinot-common' \
@@ -89,6 +98,12 @@ if [ "$RUN_TEST_SET" == "2" ]; then
     -P github-actions,no-integration-tests${COVERAGE_PROFILE} || exit 1
 fi
 
+if [ "$RUN_TEST_SET" == "3" ]; then
+  mvn test ${FORK_OPTS} -Dmaven.compiler.useIncrementalCompilation=false \
+    -pl 'pinot-core' \
+    -P github-actions,no-integration-tests${COVERAGE_PROFILE} || exit 1
+fi
+
 # Aggregate coverage across all per-fork exec files (jacoco-*.exec) written under forkCount>1,
 # while still matching the single-fork jacoco.exec produced by non-parallel runs. Skipped when
 # coverage is disabled.
```

**File**: `pinot-integration-tests/pom.xml` (modified, +2/-5)
```diff
@@ -223,6 +223,8 @@
                 <include>org/apache/pinot/integration/tests/N*Test.java</include>
                 <include>org/apache/pinot/integration/tests/GrpcBrokerClusterIntegrationTest.java</include>
                 <include>org/apache/pinot/integration/tests/legacy/*Test.java</include>
+                <!-- This class starts its own cluster and is excluded from LogicalTableSuite. -->
+                <include>org/apache/pinot/integration/tests/logicaltable/KafkaPartitionSubsetChaosIntegrationTest.java</include>
               </includes>
               <excludes>
                 <exclude>org/apache/pinot/integration/tests/IngestionConfigHybridIntegrationTest.java</exclude>
@@ -291,11 +293,6 @@
                 <include>org/apache/pinot/integration/tests/P*Test.java</include>
                 <include>org/apache/pinot/integration/tests/Q*Test.java</include>
                 <include>org/apache/pinot/integration/tests/R*Test.java</include>
-                <!--
-                  In the logicaltable package but not a BaseLogicalTableIntegrationTest subclass: it runs its own
-                  cluster, so LogicalTableSuite below excludes it and it runs here instead.
-                -->
-                <include>org/apache/pinot/integration/tests/logicaltable/KafkaPartitionSubsetChaosIntegrationTest.java</include>
               </includes>
               <excludes>
                 <exclude>org/apache/pinot/integration/tests/OfflineClusterIntegrationTest.java</exclude>
```

---

### Incident Patch 3: `d6b909c6` (2026-11-23)
**Commit Message**: Bump org.webjars:swagger-ui from 5.35.0 to 5.35.1 (#20346)

Bumps [org.webjars:swagger-ui](https://github.com/swagger-api/swagger-ui) from 5.35.0 to 5.35.1.
- [Release notes](https://github.com/swagger-api/swagger-ui/releases)
- [Commits](https://github.com/swagger-api/swagger-ui/compare/v5.35.0...v5.35.1)

---
updated-dependencies:
- dependency-name: org.webjars:swagger-ui
  dependency-version: 5.35.1
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `pom.xml` (modified, +1/-1)
```diff
@@ -198,7 +198,7 @@
     <jersey.version>2.48</jersey.version>
     <hk2.version>2.6.1</hk2.version>
     <swagger.version>1.6.16</swagger.version>
-    <swagger-ui.version>5.35.0</swagger-ui.version>
+    <swagger-ui.version>5.35.1</swagger-ui.version>
     <hadoop.version>3.4.3</hadoop.version>
     <jsonpath.version>2.10.0</jsonpath.version>
     <jsonsmart.version>2.6.1</jsonsmart.version>
```

#### Recent Merged Pull Requests:
- **PR #20358** (2026-11-23): Bump io.swagger:swagger-jersey2-jaxrs from 1.6.16 to 1.6.17 (@dependabot[bot])
- **PR #20357** (2026-11-23): Bump io.projectreactor:reactor-core from 3.8.8 to 3.9.0 (@dependabot[bot])
- **PR #20356** (2026-11-23): Bump org.apache.maven:maven-core from 3.10.1 to 3.10.2 (@dependabot[bot])
- **PR #20354** (2026-11-23): Bump org.apache.maven:apache-maven from 3.10.1 to 3.10.2 (@dependabot[bot])
- **PR #20353** (2026-11-23): Bump com.google.cloud:libraries-bom from 26.93.0 to 26.94.0 (@dependabot[bot])
- **PR #20352** (2026-11-23): Bump software.amazon.awssdk:bom from 2.59.2 to 2.59.5 (@dependabot[bot])

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

## X. Add an auto spool mode guarded against deadlocks and make it the default

**RULE**:
When implementing operations in `pinot-broker/src/main/java/org/apache/pinot/broker/requesthandler/MultiStageBrokerRequestHandler.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apache/pinot. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2f3fca63`: Add an auto spool mode guarded against deadlocks and make it the default. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `pinot-broker/src/main/java/org/apache/pinot/broker/requesthandler/MultiStageBrokerRequestHandler.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
import org.apache.pinot.query.planner.logical.SpoolMode;
  /// Parsed once so that an invalid [CommonConstants.Broker#CONFIG_OF_SPOOLS] fails the broker start, not every query.
  private final SpoolMode _defaultSpoolMode;
    _defaultSpoolMode = SpoolMode.fromString(_config.getProperty(CommonConstants.Broker.CONFIG_OF_SPOOLS,
        CommonConstants.Broker.DEFAULT_SPOOLS_MODE));
        .defaultSpoolMode(_defaultSpoolMode)
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
    boolean defaultUseSpool = _config.getProperty(CommonConstants.Broker.CONFIG_OF_SPOOLS,
        CommonConstants.Broker.DEFAULT_OF_SPOOLS);
        .defaultUseSpools(defaultUseSpool)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2f3fca63` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
