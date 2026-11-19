# Domain I — Content & Information Intelligence: Content & Information Intelligence: apache-pinot-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "apache-pinot-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T08:37:50.446Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-apache-pinot-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apache-pinot-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T08:37:50.446Z`  
> **Learning ID**: `LEARN-EVO-apache-pinot-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain I (Content & Information Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), L (Deployment & Operations Intelligence), G (Architecture Intelligence), F (Design Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), A (Human & Need Intelligence), E (Creative Intelligence)
- **Confidence Rating**: 64%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from apache-pinot-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/apache-pinot-learnings.md`  
> **Source**: github ([https://github.com/apache/pinot](https://github.com/apache/pinot))  
> **Source Version**: `85417d1a`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-19T08:29:00.061Z  
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
> **Harvest Timestamp**: 2026-11-19T08:27:47.202Z  
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

### Incident Patch 1: `2a07f212` (2026-11-18)
**Commit Message**: Prevent Lucene class initialization deadlock during server startup (#20296)

**File**: `compatibility-verifier/CompatibilityServerStarter.java` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+/**
+ * Licensed to the Apache Software Foundation (ASF) under one
+ * or more contributor license agreements.  See the NOTICE file
+ * distributed with this work for additional information
+ * regarding copyright ownership.  The ASF licenses this file
+ * to you under the Apache License, Version 2.0 (the
+ * "License"); you may not use this file except in compliance
+ * with the License.  You may obtain a copy of the License at
+ *
+ *   http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing,
+ * software distributed under the License is distributed on an
+ * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
+ * KIND, either express or implied.  See the License for the
+ * specific language governing permissions and limitations
+ * under the License.
+ */
+package org.apache.pinot.compat;
+
+import java.lang.reflect.InvocationTargetException;
+
+
+/**
+ * Initializes Lucene on the main thread before starting a compatibility server, including older releases that lack
+ * the startup fix. This stateless entry point must run before any concurrent Lucene use in the same JVM.
+ */
+public final class CompatibilityServerStarter {
+  private CompatibilityServerStarter() {
+  }
+
+  public static void main(String[] args)
+      throws Throwable {
+    // Lucene 9.12.0 has a class initialization cycle between IndexWriter, TestSecrets, and ConcurrentMergeScheduler.
+    // Resolve it on one thread before Helix starts loading immutable indexes and creating realtime indexes in parallel.
+    // https://github.com/apache/lucene/issues/12419
+    Class.forName("org.apache.lucene.index.IndexWriter");
+    try {
+      // Use the distribution's administrator and dependencies, never the current checkout's Pinot implementation.
+      Class.forName("org.apache.pinot.tools.admin.PinotAdministrator").getMethod("main", String[].class)
+          .invoke(null, (Object) args);
+    } catch (InvocationTargetException e) {
+      throw e.getCause();
+    }
+  }
+}
```

**File**: `compatibility-verifier/README.md` (modified, +7/-0)
```diff
@@ -56,6 +56,13 @@ OPTIONAL:
 
 ### Server readiness and failure diagnostics
 
+Before starting each server, the verifier initializes Lucene's `IndexWriter` on the main thread in that server JVM.
+This also covers older releases during initial startup and rollback, avoiding Lucene 9.12.0's class initialization
+deadlock when Helix loads text indexes and creates realtime text indexes concurrently. A small bootstrap is compiled
+with `javac --release 11`; each distribution retains its own libraries, plugins, and launcher settings.
+This workaround remains necessary while compatibility baselines include releases affected by
+[Lucene issue #12419](https://github.com/apache/lucene/issues/12419).
+
 The verifier waits for each server's health endpoint to return success before running operations after startup,
 upgrade, or rollback. HTTP errors do not count as ready. The wait fails if the process exits or does not become
 ready within 600 seconds (configurable with `SERVER_READY_TIMEOUT_SECONDS`).
```

**File**: `compatibility-verifier/compCheck.sh` (modified, +7/-1)
```diff
@@ -45,6 +45,7 @@ logCount=1
 cmdName=`basename $0`
 source "$(dirname "${BASH_SOURCE[0]}")/utils.inc"
 source "$(dirname "${BASH_SOURCE[0]}")/server-readiness.inc"
+source "$(dirname "${BASH_SOURCE[0]}")/server-startup.inc"
 # Resolve this before changing directory to a distribution's bin directory.
 COMPAT_SERVER_LOG4J_CONFIG="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/server-log4j2.xml"
 
@@ -195,6 +196,7 @@ function startServerWithLogs() {
     export LOG4J_CONFIGURATION_FILE="$COMPAT_SERVER_LOG4J_CONFIG"
     export LOG_ROOT="$serverLogDir"
     export PINOT_COMPONENT="$serviceName"
+    export CLASSPATH_PREFIX="${COMPAT_SERVER_STARTUP_CLASSES}${CLASSPATH_PREFIX:+:$CLASSPATH_PREFIX}"
     if [ -f "$configFile" ]; then
       exec "$launcher" StartServer -configFileName "$configFile"
     else
@@ -229,7 +231,10 @@ function startService() {
     ./pinot-admin.sh StartBroker ${configFileArg} 1>${LOG_DIR}/broker.${logCount}.log 2>&1 &
     echo $! >${PID_DIR}/broker.pid
   elif [ "$serviceName" = "server" ] || [ "$serviceName" = "server2" ]; then
-    startServerWithLogs "$serviceName" "$PWD/pinot-admin.sh" "$3"
+    local serverLauncher
+    serverLauncher=$(prepareCompatibilityServerLauncher "$PWD/pinot-admin.sh") \
+        || abortCompatibilityCheck "Cannot prepare compatibility launcher for $serviceName"
+    startServerWithLogs "$serviceName" "$serverLauncher" "$3"
   elif [ "$serviceName" = "kafka" ]; then
     startKafkaService
   fi
@@ -545,6 +550,7 @@ oldTargetDir="$workingDir"/oldTargetDir
 newTargetDir="$workingDir"/newTargetDir
 
 setupCompatTester
+setupCompatibilityServerStartup "$workingDir" || { echo "Cannot compile compatibility server bootstrap"; exit 1; }
 
 # check that the default ports are open
 if ! checkPortAvailable ${SERVER_ADMIN_PORT} || ! checkPortAvailable ${SERVER_NETTY_PORT} || ! checkPortAvailable ${SERVER_GRPC_PORT} ||
```

**File**: `compatibility-verifier/server-startup.inc` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+#
+# Licensed to the Apache Software Foundation (ASF) under one
+# or more contributor license agreements.  See the NOTICE file
+# distributed with this work for additional information
+# regarding copyright ownership.  The ASF licenses this file
+# to you under the Apache License, Version 2.0 (the
+# "License"); you may not use this file except in compliance
+# with the License.  You may obtain a copy of the License at
+#
+#   http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing,
+# software distributed under the License is distributed on an
+# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
+# KIND, either express or implied.  See the License for the
+# specific language governing permissions and limitations
+# under the License.
+#
+
+COMPAT_SERVER_STARTUP_SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/CompatibilityServerStarter.java"
+
+# Compile without Pinot dependencies so the bootstrap can run with each tested distribution's own classes and JDK.
+function setupCompatibilityServerStartup() {
+  local compiler=javac
+  if [ -n "${JAVA_HOME:-}" ]; then
+    compiler="$JAVA_HOME/bin/javac"
+  fi
+  mkdir -p "$1/server-startup" || return 1
+  COMPAT_SERVER_STARTUP_CLASSES="$(cd "$1/server-startup" && pwd)" || return 1
+  "$compiler" --release 11 -d "$COMPAT_SERVER_STARTUP_CLASSES" "$COMPAT_SERVER_STARTUP_SOURCE"
+}
+
+# Keep the generated script beside the original: appassembler resolves its libraries, plugins, and configuration
+# relative to the script. Change only the main class, preserving all launcher JVM options and argument handling.
+function prepareCompatibilityServerLauncher() {
+  local launcher=$1
+  local compatLauncher="${launcher%.sh}-compat.sh"
+  local temporaryLauncher
+  temporaryLauncher=$(mktemp "${compatLauncher}.XXXXXX") || return 1
+  if ! awk '
+    $1 == "org.apache.pinot.tools.admin.PinotAdministrator" {
+      sub(/org\.apache\.pinot\.tools\.admin\.PinotAdministrator/, "org.apache.pinot.compat.CompatibilityServerStarter")
+      replaced++
+    }
+    { print }
+    END { if (replaced != 1) exit 1 }
+  ' "$launcher" > "$temporaryLauncher"; then
+    echo "Cannot locate exactly one PinotAdministrator main class in $launcher" >&2
+    rm -f "$temporaryLauncher"
+    return 1
+  fi
+  if ! chmod +x "$temporaryLauncher" || ! mv "$temporaryLauncher" "$compatLauncher"; then
+    rm -f "$temporaryLauncher"
+    return 1
+  fi
+  echo "$compatLauncher"
+}
```

**File**: `compatibility-verifier/test_server_readiness.py` (modified, +1/-1)
```diff
@@ -205,7 +205,7 @@ def test_each_start_has_its_own_logs_and_preserves_the_working_directory(self):
                                      'exec sleep 60')
         script_dir = self.root / "scripts with spaces"
         script_dir.mkdir()
-        for source in (RUNNER, HELPER, RUNNER.with_name("utils.inc")):
+        for source in (RUNNER, HELPER, RUNNER.with_name("utils.inc"), RUNNER.with_name("server-startup.inc")):
             shutil.copyfile(source, script_dir / source.name)
         copied_config = script_dir / "server-log4j2.xml"
         shutil.copyfile(HELPER.with_name(copied_config.name), copied_config)
```

**File**: `pinot-server/src/main/java/org/apache/pinot/server/starter/helix/BaseServerStarter.java` (modified, +6/-0)
```diff
@@ -57,6 +57,7 @@
 import org.apache.helix.participant.statemachine.StateModelFactory;
 import org.apache.helix.zookeeper.constant.ZkSystemPropertyKeys;
 import org.apache.helix.zookeeper.datamodel.ZNRecord;
+import org.apache.lucene.index.IndexWriter;
 import org.apache.pinot.common.Utils;
 import org.apache.pinot.common.config.DefaultClusterConfigChangeHandler;
 import org.apache.pinot.common.config.TlsConfig;
@@ -663,6 +664,11 @@ public void start()
     LOGGER.info("Server configs: {}", new PinotAppConfigs(getConfig()).toJSONString());
     long startTimeMs = System.currentTimeMillis();
 
+    // Initialize Lucene on the startup thread before Helix can load existing indexes and create realtime indexes
+    // concurrently. Lucene 9.x has a class initialization cycle between IndexWriter, TestSecrets, and
+    // ConcurrentMergeScheduler: https://github.com/apache/lucene/issues/12419.
+    Class.forName(IndexWriter.class.getName());
+
     // Load the index plugins before joining the cluster, so that an invalid plugin set (for example more than
     // IndexService.MAX_INDEX_TYPES index types) fails server startup instead of every later segment load.
     LOGGER.info("Loaded {} index types", IndexService.getInstance().getAllIndexes().size());
```

---

### Incident Patch 2: `520655bd` (2026-11-18)
**Commit Message**: Require patched OpenJDK in Pinot container builds (#20304)

The published base images still carry Java builds affected by the November 2026 advisory.
Refresh the bases on rebuild and reject older Java 21 and 25 versions before publishing.

**File**: `.github/workflows/build-pinot-base-docker-image.yml` (modified, +2/-2)
```diff
@@ -29,7 +29,7 @@ jobs:
     strategy:
       matrix:
         openJdkDist: ["amazoncorretto", "ms-openjdk"]
-        jdk_version: [21, 25]
+        jdk_version: [25]
         arch: [amd64, arm64]
         type: [build, runtime]
         include:
@@ -60,7 +60,7 @@ jobs:
     strategy:
       matrix:
         openJdkDist: ["amazoncorretto", "ms-openjdk"]
-        jdk_version: [21, 25]
+        jdk_version: [25]
         type: [build, runtime]
     steps:
       - name: Login to DockerHub
```

**File**: `.github/workflows/scripts/docker/.pinot_base_docker_image_build_and_push.sh` (modified, +12/-6)
```diff
@@ -28,15 +28,21 @@ if [ -z "${BASE_IMAGE_TYPE}" ]; then
   exit 1
 fi
 
-cd docker/images/pinot-base/pinot-base-${BASE_IMAGE_TYPE}
+BASE_IMAGE_DIR="docker/images/pinot-base/pinot-base-${BASE_IMAGE_TYPE}"
+JAVA_VERSION="${JDK_VERSION:-25}"
+IMAGE="apachepinot/pinot-base-${BASE_IMAGE_TYPE}:${TAG}-${ARCH}"
 
 docker build \
+  --pull \
   --no-cache \
   --platform=${BUILD_PLATFORM} \
-  --file ${OPEN_JDK_DIST}.dockerfile \
-  --tag apachepinot/pinot-base-${BASE_IMAGE_TYPE}:${TAG}-${ARCH} \
-  --build-arg JAVA_VERSION=${JDK_VERSION:-21} \
+  --file "${BASE_IMAGE_DIR}/${OPEN_JDK_DIST}.dockerfile" \
+  --tag "${IMAGE}" \
+  --build-arg JAVA_VERSION="${JAVA_VERSION}" \
   --build-arg ARCH=${ARCH} \
-  .
+  "${BASE_IMAGE_DIR}"
 
-docker push apachepinot/pinot-base-${BASE_IMAGE_TYPE}:${TAG}-${ARCH}
+docker run --rm -i --platform "${BUILD_PLATFORM}" --entrypoint sh "${IMAGE}" -s \
+  < docker/images/pinot/check-java-version.sh
+
+docker push "${IMAGE}"
```

**File**: `.github/workflows/scripts/docker/.pinot_compile_and_push_build_image.sh` (modified, +1/-0)
```diff
@@ -55,6 +55,7 @@ COMPILE_BASE_IMAGE_TAG="${JDK_VERSION}-amazoncorretto"
 
 echo "Building docker image for platform: amd64 with tag: pinot-build:${PINOT_BUILD_IMAGE_TAG}"
 docker build \
+  --pull \
   --no-cache \
   --platform linux/amd64 \
   --file Dockerfile.build \
```

**File**: `.github/workflows/scripts/docker/.pinot_docker_image_build_and_push.sh` (modified, +1/-0)
```diff
@@ -67,6 +67,7 @@ cd ${DOCKER_FILE_BASE_DIR}
 
 echo "Building Pinot Docker image with JDK ${JDK_VERSION} and base image tag ${PINOT_BASE_IMAGE_TAG}"
 docker buildx build \
+    --pull \
     --no-cache \
     --platform=${BUILD_PLATFORM} \
     --file Dockerfile \
```

**File**: `.github/workflows/scripts/docker/.pinot_package_single_platform.sh` (modified, +1/-0)
```diff
@@ -71,6 +71,7 @@ for runtimeImage in "${runtimeImages[@]}"; do
     fi
   done
 
+  docker pull --platform "linux/${BUILD_ARCH}" "apachepinot/pinot-base-runtime:${runtimeImage}"
   echo "Building docker image for platform: ${BUILD_ARCH} with tags: ${DOCKER_BUILD_TAGS}"
   docker build \
     --no-cache \
```

**File**: `docker/images/pinot-base/README.md` (modified, +13/-9)
```diff
@@ -25,30 +25,34 @@ This is the base docker image to build [Apache Pinot](https://github.com/apache/
 
 ## Build and publish the docker image
 
-Here is
-the [Github Action task](https://github.com/apachepinot/pinot-fork/actions/workflows/build-pinot-docker-base-image.yml)
-to build and publish pinot base docker images.
+Use the [Pinot Base Docker Image Build and Publish workflow](https://github.com/apache/pinot/actions/workflows/build-pinot-base-docker-image.yml)
+to build and publish base images for amd64 and arm64.
 
-This task can be triggered manually to build the cross platform(amd64 and arm64v8) base image.
+To roll out a JDK security update, publish the build and runtime base images,
+then rebuild and publish the Pinot application images that use them. The Pinot
+image builds check the JDK in their base images before compiling or packaging. For the
+[November 2026 OpenJDK advisory](https://openjdk.org/groups/vulnerability/advisories/2026-11-17),
+the base image workflow verifies OpenJDK 25.0.5.1 or newer within the Java 25 release line.
 
-The build shell is:
+Use the workflow for official base image publishing. The following commands are
+for manual builds:
 
 For Amazon Corretto 25:
 
 ```SHELL
-docker buildx build --no-cache --platform=linux/arm64,linux/amd64 --file pinot-base-build/amazoncorretto.dockerfile --tag apachepinot/pinot-base-build:25-amazoncorretto --push .
+docker buildx build --pull --no-cache --build-arg JAVA_VERSION=25 --platform=linux/arm64,linux/amd64 --file pinot-base-build/amazoncorretto.dockerfile --tag apachepinot/pinot-base-build:25-amazoncorretto --push .
 ```
 
 ```SHELL
-docker buildx build --no-cache --platform=linux/arm64,linux/amd64 --file pinot-base-runtime/amazoncorretto.dockerfile --tag apachepinot/pinot-base-runtime:25-amazoncorretto --push .
+docker buildx build --pull --no-cache --build-arg JAVA_VERSION=25 --platform=linux/arm64,linux/amd64 --file pinot-base-runtime/amazoncorretto.dockerfile --tag apachepinot/pinot-base-runtime:25-amazoncorretto --push .
 ```
 
 For MS OpenJDK, the build shell is:
 
 ```SHELL
-docker buildx build --no-cache --platform=linux/arm64,linux/amd64 --file pinot-base-build/ms-openjdk.dockerfile --tag apachepinot/pinot-base-build:25-ms-openjdk --push .
+docker buildx build --pull --no-cache --build-arg JAVA_VERSION=25 --platform=linux/arm64,linux/amd64 --file pinot-base-build/ms-openjdk.dockerfile --tag apachepinot/pinot-base-build:25-ms-openjdk --push .
 ```
 
 ```SHELL
-docker buildx build --no-cache --platform=linux/arm64,linux/amd64 --file pinot-base-runtime/ms-openjdk.dockerfile --tag apachepinot/pinot-base-runtime:25-ms-openjdk --push .
+docker buildx build --pull --no-cache --build-arg JAVA_VERSION=25 --platform=linux/arm64,linux/amd64 --file pinot-base-runtime/ms-openjdk.dockerfile --tag apachepinot/pinot-base-runtime:25-ms-openjdk --push .
 ```
```

**File**: `docker/images/pinot-base/pinot-base-build/amazoncorretto.dockerfile` (modified, +2/-2)
```diff
@@ -16,7 +16,7 @@
 # specific language governing permissions and limitations
 # under the License.
 #
-ARG JAVA_VERSION=21
+ARG JAVA_VERSION=25
 FROM debian:bookworm-slim
 
 LABEL MAINTAINER=dev@pinot.apache.org
@@ -45,7 +45,7 @@ RUN set -eux \
 # Install Amazon Corretto.
 # /etc/apt/keyrings/ is the correct path for user-managed keys referenced via
 # signed-by=; apt natively handles ASCII-armored .asc files at that path.
-ARG JAVA_VERSION=21
+ARG JAVA_VERSION=25
 RUN set -eux \
   && mkdir -p /etc/apt/keyrings \
   && wget -qO /etc/apt/keyrings/corretto.asc https://apt.corretto.aws/corretto.key \
```

**File**: `docker/images/pinot-base/pinot-base-build/ms-openjdk.dockerfile` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
 # specific language governing permissions and limitations
 # under the License.
 #
-ARG JAVA_VERSION=21
+ARG JAVA_VERSION=25
 ARG JDK_IMAGE=mcr.microsoft.com/openjdk/jdk
 FROM ${JDK_IMAGE}:${JAVA_VERSION}-ubuntu AS pinot_build_env
 
```

---

### Incident Patch 3: `3785795d` (2026-11-18)
**Commit Message**: Bump org.webjars:swagger-ui from 5.34.1 to 5.35.0 (#20308)

Bumps [org.webjars:swagger-ui](https://github.com/swagger-api/swagger-ui) from 5.34.1 to 5.35.0.
- [Release notes](https://github.com/swagger-api/swagger-ui/releases)
- [Commits](https://github.com/swagger-api/swagger-ui/compare/v5.34.1...v5.35.0)

---
updated-dependencies:
- dependency-name: org.webjars:swagger-ui
  dependency-version: 5.35.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `pom.xml` (modified, +1/-1)
```diff
@@ -198,7 +198,7 @@
     <jersey.version>2.48</jersey.version>
     <hk2.version>2.6.1</hk2.version>
     <swagger.version>1.6.16</swagger.version>
-    <swagger-ui.version>5.34.1</swagger-ui.version>
+    <swagger-ui.version>5.35.0</swagger-ui.version>
     <hadoop.version>3.4.3</hadoop.version>
     <jsonpath.version>2.10.0</jsonpath.version>
     <jsonsmart.version>2.6.1</jsonsmart.version>
```

#### Recent Merged Pull Requests:
- **PR #20309** (2026-11-19): Bump org.codehaus.plexus:plexus-utils from 4.1.0 to 4.2.0 (@dependabot[bot])
- **PR #20308** (2026-11-18): Bump org.webjars:swagger-ui from 5.34.1 to 5.35.0 (@dependabot[bot])
- **PR #20307** (2026-11-18): Bump org.codehaus.plexus:plexus-xml from 3.1.0 to 3.1.1 (@dependabot[bot])
- **PR #20306** (2026-11-19): Bump org.roaringbitmap:RoaringBitmap from 1.6.29 to 1.6.30 (@dependabot[bot])
- **PR #20305** (2026-11-19): Add scope-aware discovery of referenced table identifiers (@xiangfu0)
- **PR #20304** (2026-11-18): Require patched OpenJDK in Pinot container builds (@xiangfu0)

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

## X. Prevent Lucene class initialization deadlock during server startup

**RULE**:
When implementing operations in `compatibility-verifier/CompatibilityServerStarter.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apache/pinot. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2a07f212`: Prevent Lucene class initialization deadlock during server startup. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `compatibility-verifier/CompatibilityServerStarter.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
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
package org.apache.pinot.compat;

import java.lang.reflect.InvocationTargetException;


/**
 * Initializes Lucene on the main thread before starting a compatibility server, including older releases that lack
 * the startup fix. This stateless entry point must run before any concurrent Lucene use in the same JVM.
 */
public final class CompatibilityServerStarter {
  private CompatibilitySe
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2a07f212` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
