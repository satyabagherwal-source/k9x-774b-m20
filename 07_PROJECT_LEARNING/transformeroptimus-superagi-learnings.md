# Forensic Learning Record (Deep Inspection): TransformerOptimus/SuperAGI

> **Canonical Artifact**: `07_PROJECT_LEARNING/transformeroptimus-superagi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TransformerOptimus/SuperAGI](https://github.com/TransformerOptimus/SuperAGI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:18:15.016Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TransformerOptimus/SuperAGI`
- **Description**: <⚡️> SuperAGI - A dev-first open source autonomous AI agent framework. Enabling developers to build, manage & run useful autonomous agents quickly and reliably.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, Dockerfile
- **Stars / Engagement**: 17696 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `gui/pages/Content/Agents/TaskQueue.js`
```
import React, {useEffect, useState} from 'react';
import styles from './Agents.module.css';
import 'react-toastify/dist/ReactToastify.css';
import {getExecutionTasks} from '@/pages/api/DashboardService';
import Image from "next/image";

export default function TaskQueue({selectedRunId}) {
  const [tasks, setTasks] = useState({pending: [], completed: []});

  useEffect(() => {
    fetchTasks();
  }, [selectedRunId]);

  function fetchTasks() {
    getExecutionTasks(selectedRunId)
      .then((response) => {
        setTasks({
          pending: response.data.tasks,
          completed: response.data.completed_tasks,
        });
      })
      .catch((error) => {
        console.error('Error fetching execution feeds:', error);
      });
  }

  return (
    <>
      {tasks.pending.length <= 0 && tasks.completed.length <= 0 ? <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: '40px',
        width: '100%'
      }}>
        <Image width={150} height={60} src="/images/no_permissions.svg" alt="no-permissions"/>
        <span className={styles.feed_title} style={{marginTop: '8px'}}>No Tasks found!</span>
      </div> : <div>
        {tasks.pending.length > 0 && <div className={styles.task_header}>Pending Tasks</div>}
        {tasks.pending.map((task, index) => (
          <div key={index} className={styles.history_box}
               style={{background: '#272335', padding: '20px', cursor: 'default'}}>
            <div style={{display: 'flex'}}>
              <div>
                <Image width={14} height={14} style={{mixBlendMode: 'exclusion'}} src="/images/loading.gif"
                       alt="loading-icon"/>
              </div>
              <div className={styles.feed_title}>
                {task.name}
              </div>
            </div>
          </div>
        ))}
        {tasks.completed.length > 0 && <div className={styles.task_header}>Completed Tasks</div>}
        {tasks.completed.map((task, index) => (
          <div key={index} className={styles.history_box}
               style={{background: '#272335', padding: '20px', cursor: 'default'}}>
            <div style={{display: 'flex'}}>
              <div className={styles.feed_title} style={{marginLeft: '0'}}>
                {task.name}
              </div>
            </div>
          </div>
        ))}
      </div>}
    </>
  );
}

```

### Core Architecture Module: `gui/pages/Dashboard/Settings/Webhooks.js`
```
import React, {useState, useEffect} from 'react';
import {ToastContainer, toast} from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import agentStyles from "@/pages/Content/Agents/Agents.module.css";
import {
  editWebhook,
  getWebhook, saveWebhook,
} from "@/pages/api/DashboardService";
import {loadingTextEffect, removeTab} from "@/utils/utils";
import styles from "@/pages/Content/Marketplace/Market.module.css";
export default function Webhooks() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookId, setWebhookId] = useState(-1);
  const [isLoading, setIsLoading] = useState(true)
  const [existingWebhook, setExistingWebhook] = useState(false)
  const [isEdtiting, setIsEdtiting] = useState(false)
  const [loadingText, setLoadingText] = useState("Loading Webhooks");
  const [selectedCheckboxes, setSelectedCheckboxes] = useState([]);
  const checkboxes = [
    { label: 'Agent is running', value: 'RUNNING' },
    { label: 'Agent run is paused', value: 'PAUSED' },
    { label: 'Agent run is completed', value: 'COMPLETED' },
    { label: 'Agent is terminated ', value: 'TERMINATED' },
    { label: 'Agent run max iteration reached', value: 'MAX ITERATION REACHED' },
  ];


  useEffect(() => {
    loadingTextEffect('Loading Webhooks', setLoadingText, 500);
    fetchWebhooks();
  }, []);

  const handleWebhookChange = (event) => {
    setWebhookUrl(event.target.value);
  };

  const handleSaveWebhook = () => {
    if(!webhookUrl || webhookUrl.trim() === ""){
      toast.error("Enter valid webhook", {autoClose: 1800});
      return;
    }
    if(isEdtiting){
      editWebhook(webhookId, { url: webhookUrl, filters: {status: selectedCheckboxes}})
          .then((response) => {
            setIsEdtiting(false)
            fetchWebhooks()
            toast.success("Webhook edited successfully", {autoClose: 1800});
          })
          .catch((error) => {
            console.error('Error fetching webhook', error);
          });
      return;
    }
    saveWebhook({name : "Webhook 1", url: webhookUrl, headers: {}, filters: {status: selectedCheckboxes}})
      .then((response) => {
        setExistingWebhook(true)
        setWebhookId(response.data.id)
        toast.success("Webhook created successfully", {autoClose: 1800});
      })
      .catch((error) => {
        toast.error("Unable to create webhook", {autoClose: 1800});
        console.error('Error saving webhook', error);
      });
  }

  const fetchWebhooks = () => {
    getWebhook()
      .then((response) => {
        setIsLoading(false)
        if(response.data){
          setWebhookUrl(response.data.url)
          setExistingWebhook(true)
          setWebhookId(response.data.id)
          setSelectedCheckboxes(response.data.filters.status)
        }
        else{
          setWebhookUrl('')
          setExistingWebhook(false)
          setWebhookId(-1)
        }
      })
      .catch((error) => {
        console.error('Error fetching webhook', error);
      });
  }

  const toggleCheckbox = (value) => {
    if (selectedCheckboxes.includes(value)) {
      setSelectedCheckboxes(selectedCheckboxes.filter((item) => item !== value));
    } else {
      setSelectedCheckboxes([...selectedCheckboxes, value]);
    }
  };

  return (<>
    <div className="row">
      <div className="col-3"></div>
      <div className="col-6 col-6-scrollable">
        {!isLoading ? <div>
          <div className="title_wrapper mb_15">
            <div className={styles.page_title}>Webhooks</div>
            {existingWebhook &&
              <button className="primary_button" onClick={() => {setExistingWebhook(false);setIsEdtiting(true)} } >
                Edit
              </button>}
          </div>

          <div>
            <label className={agentStyles.form_label}>Destination URL</label>
              <input disabled={existingWebhook ? true : false} className="input_medium" placeholder="Enter your destination url" type="text" value={webhookUrl}
                     onChange={handleWebhookChange}/>
            <br />
            <label className={agentStyles.form_label}>Events to include</label>
            <div className={styles.checkboxGroup} >
              {checkboxes.map((checkbox) => (
                <label key={checkbox.value} className={styles.checkboxLabel}>
                  <input
                    disabled={existingWebhook ? true : false}
                    className="checkbox"
                    type="checkbox"
                    value={checkbox.value}
                    checked={selectedCheckboxes.includes(checkbox.value)}
                    onChange={() => toggleCheckbox(checkbox.value)}
                  />
                  <span className={styles.checkboxText}>&nbsp;{checkbox.label}</span>
                </label>
              ))}
            </div>
          </div>

          {!existingWebhook && <div className="justify_end display_flex_container mt_15">
            <button onClick={() => removeTab(-3, "Settings", "Settings", 0)} className="secondary_button mr_10">
              Cancel
            </button>
            <button className="primary_button" onClick={handleSaveWebhook}>
              {isEdtiting ? "Update" : "Create"}
            </button>
          </div>}

        </div> :  <div className="loading_container">
          <div className="signInInfo loading_text">{loadingText}</div>
        </div>}
      </div>
      <div className="col-3"></div>
    </div>
    <ToastContainer/>
  </>)
}
```

### Core Architecture Module: `gui/utils/eventBus.js`
```
import mitt from 'mitt';

const emitter = mitt();

export const EventBus = {
  on: emitter.on,
  off: emitter.off,
  emit: emitter.emit,
};

```

### Core Architecture Module: `gui/utils/utils.js`
```
import {formatDistanceToNow, format, addMinutes} from 'date-fns';
import {utcToZonedTime} from 'date-fns-tz';
import {baseUrl, analyticsMeasurementId, analyticsApiSecret, mixpanelId} from "@/pages/api/apiConfig";
import {EventBus} from "@/utils/eventBus";
import JSZip from "jszip";
import moment from 'moment';
import mixpanel from 'mixpanel-browser'
import Cookies from "js-cookie";

const toolkitData = {
  'Jira Toolkit': '/images/jira_icon.svg',
  'Email Toolkit': '/images/gmail_icon.svg',
  'Google Calendar Toolkit': '/images/google_calender_icon.svg',
  'GitHub Toolkit': '/images/github_icon.svg',
  'Google Search Toolkit': '/images/google_search_icon.svg',
  'Searx Toolkit': '/images/searx_icon.svg',
  'Slack Toolkit': '/images/slack_icon.svg',
  'Web Scraper Toolkit': '/images/webscraper_icon.svg',
  'Web Scrapper Toolkit': '/images/webscraper_icon.svg',
  'Twitter Toolkit': '/images/twitter_icon.svg',
  'Google SERP Toolkit': '/images/google_serp_icon.svg',
  'File Toolkit': '/images/filemanager_icon.svg',
  'CodingToolkit': '/images/superagi_logo.png',
  'Thinking Toolkit': '/images/superagi_logo.png',
  'Image Generation Toolkit': '/images/superagi_logo.png',
  'DuckDuckGo Search Toolkit': '/images/duckduckgo_icon.png',
  'Instagram Toolkit': '/images/instagram.png',
  'Knowledge Search Toolkit': '/images/knowledeg_logo.png',
  'Notion Toolkit': '/images/notion_logo.png',
  'ApolloToolkit': '/images/apollo_logo.png',
  'Google Analytics Toolkit': '/images/google_analytics_logo.png'
};

export const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export const convertToGMT = (dateTime) => {
  if (!dateTime) {
    return null;
  }
  return moment.utc(dateTime).format('YYYY-MM-DD HH:mm:ss');
};

export const formatTimeDifference = (timeDifference) => {
  const units = ['years', 'months', 'days', 'hours', 'minutes'];
  const singularUnits = ['year', 'month', 'day', 'hour', 'minute'];

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    if (timeDifference[unit] !== 0) {
      if (unit === 'minutes') {
        return `${timeDifference[unit]} ${timeDifference[unit] === 1 ? singularUnits[i] : unit} ago`;
      } else {
        return `${timeDifference[unit]} ${timeDifference[unit] === 1 ? singularUnits[i] : unit} ago`;
      }
    }
  }

  return 'Just now';
};

export const formatNumber = (number) => {
  if (number === null || number === undefined || number === 0) {
    return '0';
  }

  const suffixes = ['', 'k', 'M', 'B', 'T'];
  const magnitude = Math.floor(Math.log10(number) / 3);
  const scaledNumber = number / Math.pow(10, magnitude * 3);
  const suffix = suffixes[magnitude];

  if (scaledNumber % 1 === 0) {
    return scaledNumber.toFixed(0) + suffix;
  }

  return scaledNumber.toFixed(1) + suffix;
};

export const formatTime = (lastExecutionTime) => {
  try {
    const parsedTime = new Date(lastExecutionTime + 'Z'); // append 'Z' to indicate UTC
    if (isNaN(parsedTime.getTime())) {
      throw new Error('Invalid time value');
    }

    const timeZone = 'Asia/Kolkata';
    const zonedTime = utcToZonedTime(parsedTime, timeZone);

    return formatDistanceToNow(zonedTime, {
      addSuffix: true,
      includeSeconds: true
    }).replace(/about\s/, '')
      .replace(/minutes?/, 'min')
      .replace(/hours?/, 'hrs')
      .replace(/days?/, 'day')
      .replace(/weeks?/, 'week');
  } catch (error) {
    console.error('Error formatting time:', error);
    return 'Invalid Time';
  }
};

export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const formattedValue = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));

  return `${formattedValue} ${sizes[i]}`;
};

export const downloadFile = (fileId, fileName = null) => {
  // const authToken = localStorage.getItem('accessToken');
  const authToken = Cookies.get("accessToken");
  const url = `${baseUrl()}/resources/get/${fileId}`;
  const env = localStorage.getItem('applicationEnvironment');

  if (env === 'PROD') {
    const headers = {
      Authorization: `Bearer ${authToken}`,
    };

    return fetch(url, {headers})
      .then((response) => response.blob())
      .then((blob) => {
        if (fileName) {
          const fileUrl = window.URL.createObjectURL(blob);
          const anchorElement = document.createElement('a');
          anchorElement.href = fileUrl;
          anchorElement.download = fileName;
          anchorElement.click();
          window.URL.revokeObjectURL(fileUrl);
        } else {
          return blob;
        }
      })
      .catch((error) => {
        console.error('Error downloading file:', error);
      });
  } else {
    if (fileName) {
      window.open(url, '_blank');
    } else {
      return fetch(url)
        .then((response) => response.blob())
        .catch((error) => {
          console.error('Error downloading file:', error);
        });
    }
  }
};

export const downloadAllFiles = (files, run_name) => {
  const zip = new JSZip();
  const promises = [];
  const fileNamesCount = {};

  files.forEach((file, index) => {
    fileNamesCount[file.name]
      ? fileNamesCount[file.name]++
      : (fileNamesCount[file.name] = 1);

    let modifiedFileName = file.name;
    if (fileNamesCount[file.name] > 1) {
      const fileExtensionIndex = file.name.lastIndexOf(".");
      const name = file.name.substring(0, fileExtensionIndex);
      const extension = file.name.substring(fileExtensionIndex + 1);
      modifiedFileName = `${name} (${fileNamesCount[file.name] - 1}).${extension}`;
    }

    const promise = downloadFile(file.id)
      .then((blob) => {
        const fileBlob = new Blob([blob], {type: file.type});
        zip.file(modifiedFileName, fileBlob);
      })
      .catch((error) => {
        console.error("Error downloading file:", error);
      });

    promises.push(promise);
  });

  Promise.all(promises)
    .then(() => {
      zip.generateAsync({type: "blob"})
        .then((content) => {
          const now = new Date();
          const timestamp = `${now.getFullYear()}-${("0" + (now.getMonth() + 1)).slice(-2)}-${("0" + now.getDate()).slice(-2)}_${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`.replace(/:/g, '-');
          const zipFilename = `${run_name}_${timestamp}.zip`;
          const downloadLink = document.createElement("a");
          downloadLink.href = URL.createObjectURL(content);
          downloadLink.download = zipFilename;
          downloadLink.click();
        })
        .catch((error) => {
          console.error("Error generating zip:", error);
        });
    });
};

export const refreshUrl = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const {origin, pathname} = window.location;
  const urlWithoutToken = origin + pathname;
  window.history.replaceState({}, document.title, urlWithoutToken);
};

export const loadingTextEffect = (loadingText, setLoadingText, timer) => {
  const text = loadingText;
  let dots = '';

  const interval = setInterval(() => {
    dots = dots.length < 3 ? dots + '.' : '';
    setLoadingText(`${text}${dots}`);
  }, timer);

  return () => clearInterval(interval)
};

export const openNewTab = (id, name, contentType, hasInternalId = false) => {
  EventBus.emit('openNewTab', {
    element: {id: id, name: name, contentType: contentType, internalId: hasInternalId ? createInternalId() : 0}
  });
};

export const removeTab = (id, name, contentType, internalId) => {
  EventBus.emit('removeTab', {
    element: {id: id, name: name, contentType: contentType, internalId: internalId}
  });
};

export const setLocalStorageValue = (key, value, stateFunction) => {
  stateFunction(value);
  localStorage.setItem(key, value);
};

export const setLocalStorageArray = (key, value, stateFunction) => {
  stateFunction(value);
  const arrayString = JSON.stringify(value);
  localStorage.setItem(key, arrayString);
};

const getInternalIds = () => {
  const internal_ids = localStorage.getItem("agi_internal_ids");
  return internal_ids ? JSON.parse(internal_ids) : [];
};

const removeAgentInternalId = (internalId) => {
  let idsArray = getInternalIds();
  const internalIdIndex = idsArray.indexOf(internalId);

  if (internalIdIndex !== -1) {
    idsArray.splice(internalIdIndex, 1);
    localStorage.setItem('agi_internal_ids', JSON.stringify(idsArray));
    localStorage.removeItem("agent_create_click_" + String(internalId));
    localStorage.removeItem("agent_name_" + String(internalId));
    localStorage.removeItem("agent_description_" + String(internalId));
    localStorage.removeItem("agent_goals_" + String(internalId));
    localStorage.removeItem("agent_instructions_" + String(internalId));
    localStorage.removeItem("agent_constraints_" + String(internalId));
    localStorage.removeItem("agent_model_" + String(internalId));
    localStorage.removeItem("agent_type_" + String(internalId));
    localStorage.removeItem("tool_names_" + String(internalId));
    localStorage.removeItem("tool_ids_" + String(internalId));
    localStorage.removeItem("agent_rolling_window_" + String(internalId));
    localStorage.removeItem("agent_database_" + String(internalId));
    localStorage.removeItem("agent_permission_" + String(internalId));
    localStorage.removeItem("agent_exit_criterion_" + String(internalId));
    localStorage.removeItem("agent_iterations_" + String(internalId));
    localStorage.removeItem("agent_step_time_" + String(internalId));
    localStorage.removeItem("advanced_options_" + String(internalId));
    localStorage.removeItem("has_LTM_" + String(internalId));
    localStorage.removeItem("has_resource_" + String(internalId));
    localStorage.removeItem("agent_files_" + String(internalId));
    localStorage.removeItem("agent_start_time_" + String(internalId));
    localStorage.removeItem("ag
```

### Core Architecture Module: `migrations/versions/40affbf3022b_add_filter_colume_in_webhooks.py`
```
"""add filter colume in webhooks

Revision ID: 40affbf3022b
Revises: 5d5f801f28e7
Create Date: 2023-08-28 12:30:35.171176

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '40affbf3022b'
down_revision = '5d5f801f28e7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('webhooks', sa.Column('filters', sa.JSON(), nullable=True))
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('webhooks', 'filters')
    # ### end Alembic commands ###

```

### Core Architecture Module: `migrations/versions/446884dcae58_add_api_key_and_web_hook.py`
```
"""add api_key and web_hook

Revision ID: 446884dcae58
Revises: 71e3980d55f5
Create Date: 2023-07-29 10:55:21.714245

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '446884dcae58'
down_revision = '2fbd6472112c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('api_keys',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('org_id', sa.Integer(), nullable=True),
    sa.Column('name', sa.String(), nullable=True),
    sa.Column('key', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.Column('is_expired',sa.Boolean(),nullable=True,default=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('webhooks',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=True),
    sa.Column('org_id', sa.Integer(), nullable=True),
    sa.Column('url', sa.String(), nullable=True),
    sa.Column('headers', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.Column('is_deleted',sa.Boolean(),nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('webhook_events',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('agent_id', sa.Integer(), nullable=True),
    sa.Column('run_id', sa.Integer(), nullable=True),
    sa.Column('event', sa.String(), nullable=True),
    sa.Column('status', sa.String(), nullable=True),
    sa.Column('errors', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )

    #add index *********************
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    
    op.drop_table('webhooks')
    op.drop_table('api_keys')
    op.drop_table('webhook_events')

    # ### end Alembic commands ###

```

### Core Architecture Module: `superagi/agent/queue_step_handler.py`
```
import time

import numpy as np

from superagi.agent.agent_message_builder import AgentLlmMessageBuilder
from superagi.agent.task_queue import TaskQueue
from superagi.helper.error_handler import ErrorHandler
from superagi.helper.json_cleaner import JsonCleaner
from superagi.helper.prompt_reader import PromptReader
from superagi.helper.token_counter import TokenCounter
from superagi.lib.logger import logger
from superagi.models.agent_execution import AgentExecution
from superagi.models.agent_execution_feed import AgentExecutionFeed
from superagi.models.workflows.agent_workflow_step import AgentWorkflowStep
from superagi.models.workflows.agent_workflow_step_tool import AgentWorkflowStepTool
from superagi.models.agent import Agent
from superagi.types.queue_status import QueueStatus


class QueueStepHandler:
    """Handles the queue step of the agent workflow"""
    def __init__(self, session, llm, agent_id: int, agent_execution_id: int):
        self.session = session
        self.llm = llm
        self.agent_execution_id = agent_execution_id
        self.agent_id = agent_id
        self.organisation = Agent.find_org_by_agent_id(self.session, agent_id=self.agent_id)

    def _queue_identifier(self, step_tool):
        return step_tool.unique_id + "_" + str(self.agent_execution_id)

    def _build_task_queue(self, step_tool):
        return TaskQueue(self._queue_identifier(step_tool))

    def execute_step(self):
        execution = AgentExecution.get_agent_execution_from_id(self.session, self.agent_execution_id)
        workflow_step = AgentWorkflowStep.find_by_id(self.session, execution.current_agent_step_id)
        step_tool = AgentWorkflowStepTool.find_by_id(self.session, workflow_step.action_reference_id)
        task_queue = self._build_task_queue(step_tool)

        if not task_queue.get_status() or task_queue.get_status() == QueueStatus.COMPLETE.value:
            task_queue.set_status(QueueStatus.INITIATED.value)

        if task_queue.get_status() == QueueStatus.INITIATED.value:
            self._add_to_queue(task_queue, step_tool)
            execution.current_feed_group_id = "DEFAULT"
            task_queue.set_status(QueueStatus.PROCESSING.value)

        if not task_queue.get_tasks():
            task_queue.set_status(QueueStatus.COMPLETE.value)
            return "COMPLETE"
        self._consume_from_queue(task_queue)
        return "default"

    def _add_to_queue(self, task_queue: TaskQueue, step_tool: AgentWorkflowStepTool):
        assistant_reply = self._process_input_instruction(step_tool)
        self._process_reply(task_queue, assistant_reply)

    def _consume_from_queue(self, task_queue: TaskQueue):
        tasks = task_queue.get_tasks()
        agent_execution = AgentExecution.find_by_id(self.session, self.agent_execution_id)
        if tasks:
            task = task_queue.get_first_task()
            # generating the new feed group id
            agent_execution.current_feed_group_id = "GROUP_" + str(int(time.time()))
            self.session.commit()
            task_response_feed = AgentExecutionFeed(agent_execution_id=self.agent_execution_id,
                                                    agent_id=self.agent_id,
                                                    feed="Input: " + task,
                                                    role="assistant",
                                                    feed_group_id=agent_execution.current_feed_group_id)
            self.session.add(task_response_feed)
            self.session.commit()
            task_queue.complete_task("PROCESSED")

    def _process_reply(self, task_queue: TaskQueue, assistant_reply: str):
        assistant_reply = JsonCleaner.extract_json_array_section(assistant_reply)
        print("Queue reply:", assistant_reply)
        task_array = np.array(eval(assistant_reply)).flatten().tolist()
        for task in task_array:
            task_queue.add_task(str(task))
            logger.info("RAMRAM: Added task to queue: ", task)

    def _process_input_instruction(self, step_tool):
        prompt = self._build_queue_input_prompt(step_tool)
        logger.info("Prompt: ", prompt)
        agent_feeds = AgentExecutionFeed.fetch_agent_execution_feeds(self.session, self.agent_execution_id)
        print(".........//////////////..........2")
        messages = AgentLlmMessageBuilder(self.session, self.llm, self.llm.get_model(), self.agent_id, self.agent_execution_id) \
            .build_agent_messages(prompt, agent_feeds, history_enabled=step_tool.history_enabled,
                                  completion_prompt=step_tool.completion_prompt)
        current_tokens = TokenCounter.count_message_tokens(messages, self.llm.get_model())
        response = self.llm.chat_completion(messages, TokenCounter(session=self.session, organisation_id=self.organisation.id).token_limit(self.llm.get_model()) - current_tokens)
        
        if 'error' in response and response['message'] is not None:
            ErrorHandler.handle_openai_errors(self.session, self.agent_id, self.agent_execution_id, response['message'])
            
        if 'content' not in response or response['content'] is None:
            raise RuntimeError(f"Failed to get response from llm")
        total_tokens = current_tokens + TokenCounter.count_message_tokens(response, self.llm.get_model())
        AgentExecution.update_tokens(self.session, self.agent_execution_id, total_tokens)
        assistant_reply = response['content']
        return assistant_reply

    def _build_queue_input_prompt(self, step_tool: AgentWorkflowStepTool):
        queue_input_prompt = PromptReader.read_agent_prompt(__file__, "agent_queue_input.txt")
        queue_input_prompt = queue_input_prompt.replace("{instruction}", step_tool.input_instruction)

        return queue_input_prompt

```

### Core Architecture Module: `superagi/agent/task_queue.py`
```
import json

import redis

from superagi.config.config import get_config

redis_url = get_config('REDIS_URL') or "localhost:6379"
"""TaskQueue manages current tasks and past tasks in Redis """
class TaskQueue:
    def __init__(self, queue_name: str):
        self.queue_name = queue_name + "_q"
        self.completed_tasks = queue_name + "_q_completed"
        self.db = redis.Redis.from_url("redis://" + redis_url + "/0", decode_responses=True)

    def add_task(self, task: str):
        self.db.lpush(self.queue_name, task)
        # print("Added task. New tasks:", str(self.get_tasks()))

    def complete_task(self, response):
        if len(self.get_tasks()) <= 0:
            return
        task = self.db.lpop(self.queue_name)
        self.db.lpush(self.completed_tasks, str({"task": task, "response": response}))

    def get_first_task(self):
        return self.db.lindex(self.queue_name, 0)

    def get_tasks(self):
        return self.db.lrange(self.queue_name, 0, -1)

    def get_completed_tasks(self):
        tasks = self.db.lrange(self.completed_tasks, 0, -1)
        return [eval(task) for task in tasks]

    def clear_tasks(self):
        self.db.delete(self.queue_name)

    def get_last_task_details(self):
        response = self.db.lindex(self.completed_tasks, 0)
        if response is None:
            return None

        return eval(response)

    def set_status(self, status):
        self.db.set(self.queue_name + "_status", status)

    def get_status(self):
        return self.db.get(self.queue_name + "_status")


```

### Core Architecture Module: `superagi/controllers/webhook.py`
```
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi import Depends
from fastapi_jwt_auth import AuthJWT
from fastapi_sqlalchemy import db
from pydantic import BaseModel

# from superagi.types.db import AgentOut, AgentIn
from superagi.helper.auth import check_auth, get_user_organisation
from superagi.models.webhooks import Webhooks

router = APIRouter()


class WebHookIn(BaseModel):
    name: str
    url: str
    headers: dict
    filters: dict

    class Config:
        orm_mode = True


class WebHookOut(BaseModel):
    id: int
    org_id: int
    name: str
    url: str
    headers: dict
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    filters: dict

    class Config:
        orm_mode = True

class WebHookEdit(BaseModel):
    url: str
    filters: dict

    class Config:
        orm_mode = True



# CRUD Operations`
@router.post("/add", response_model=WebHookOut, status_code=201)
def create_webhook(webhook: WebHookIn, Authorize: AuthJWT = Depends(check_auth),
                   organisation=Depends(get_user_organisation)):
    """
        Creates a new webhook

        Args:
            
        Returns:
            Agent: An object of Agent representing the created Agent.

        Raises:
            HTTPException (Status Code=404): If the associated project is not found.
    """
    db_webhook = Webhooks(name=webhook.name, url=webhook.url, headers=webhook.headers, org_id=organisation.id,
                          is_deleted=False, filters=webhook.filters)
    db.session.add(db_webhook)
    db.session.commit()
    db.session.flush()
    return db_webhook

@router.get("/get", response_model=Optional[WebHookOut])
def get_all_webhooks(
    Authorize: AuthJWT = Depends(check_auth),
    organisation=Depends(get_user_organisation),
):
    """
    Retrieves a single webhook for the authenticated user's organisation.

    Returns:
        JSONResponse: A JSON response containing the retrieved webhook.

    Raises:
    """
    webhook = db.session.query(Webhooks).filter(Webhooks.org_id == organisation.id, Webhooks.is_deleted == False).first()
    return webhook

@router.post("/edit/{webhook_id}", response_model=WebHookOut)
def edit_webhook(
    updated_webhook: WebHookEdit,
    webhook_id: int,
    Authorize: AuthJWT = Depends(check_auth),
    organisation=Depends(get_user_organisation),
):
    """
    Soft-deletes a webhook by setting the value of is_deleted to True.

    Args:
        webhook_id (int): The ID of the webhook to delete.

    Returns:
        WebHookOut: The deleted webhook.

    Raises:
        HTTPException (Status Code=404): If the webhook is not found.
    """
    webhook = db.session.query(Webhooks).filter(Webhooks.org_id == organisation.id, Webhooks.id == webhook_id, Webhooks.is_deleted == False).first()
    if webhook is None:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    webhook.url = updated_webhook.url
    webhook.filters = updated_webhook.filters

    db.session.commit()

    return webhook
```

### Core Architecture Module: `superagi/helper/webhook_manager.py`
```
from superagi.models.agent import Agent
from superagi.models.agent_execution import AgentExecution
from superagi.models.webhooks import Webhooks
from superagi.models.webhook_events import WebhookEvents
import requests
import json
from superagi.lib.logger import logger

class WebHookManager:
    def __init__(self,session):
        self.session=session

    def agent_status_change_callback(self, agent_execution_id, curr_status, old_status):
        if curr_status=="CREATED" or agent_execution_id is None:
            return
        agent_id=AgentExecution.get_agent_execution_from_id(self.session,agent_execution_id).agent_id
        agent=Agent.get_agent_from_id(self.session,agent_id)
        org=agent.get_agent_organisation(self.session)
        org_webhooks=self.session.query(Webhooks).filter(Webhooks.org_id == org.id).all()

        for webhook_obj in org_webhooks:
            if "status" in webhook_obj.filters and curr_status in webhook_obj.filters["status"]:
                webhook_obj_body={"agent_id":agent_id,"org_id":org.id,"event":f"{old_status} to {curr_status}"}
                error=None
                request=None
                status='sent'
                try:
                    request = requests.post(webhook_obj.url.strip(), data=json.dumps(webhook_obj_body), headers=webhook_obj.headers)
                except Exception as e:
                    logger.error(f"Exception occured in webhooks {e}")
                    error=str(e)
                if request is not None and request.status_code not in [200,201] and error is None:
                    error=request.text
                if error is not None:
                    status='Error'
                webhook_event=WebhookEvents(agent_id=agent_id, run_id=agent_execution_id, event=f"{old_status} to {curr_status}", status=status, errors=error)
                self.session.add(webhook_event)
                self.session.commit()


```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1128** (2023-09-29): **Can't choose model after following setup steps in readme to the point.**
  *Symptoms*: ### ⚠️ Check for existing issues before proceeding. ⚠️  - [X] I have searched the existing issues, and there is no existing issue for my problem  ### Where are you using SuperAGI?  Windows  ### Which branch of SuperAGI are you using?  Main  ### Do you use OpenAI GPT-3.5 or GPT-4?  GPT-3.5  ### Which area covers your issue best?  Installation and setup  ### Describe your issue.  Following the setup steps in the readme doesn't result in a working SuperAGI agent because you can't pick a model from he drop down list. Had to search through discord to find that the fix is to "update changes" in the settings in the UI.  I'm not a dev so I can't fix this but it should be simple for a dev to do. It's a shame for new users to have to troubleshoot the first thing they do. I understand that these things get overlooked because the devs will probably rarely do a clean new install and read through the setup steps to get it working so I thought that I'd create my first issue on github to help this project be more appealing to new users.  ### How to replicate your Issue?  Just follow the setup steps in the readme from a clean install and try to run the agent, you'll see that you can't pick a model without updating the changes in settings in the UI.  ### Upload Error Log Content  Don't have an error log but must type something here to submit issue
  **Post-Mortem & Fix Analysis**:
  > Can you tell me have you added the api key in the Settings?? If no then please add your OpenAI api key there and click on "Update Changes". Once it has been successfully added, all the OpenAI models for the given api key will added and enabled for your usage. If the issue still persists then let me know and if this response is not in the context of your issue then please elaborate your issue
  >  We've marked this GitHub issue resolved as of now. If it's not resolved to your satisfaction, please feel free to reopen it. Your involvement in our community means a lot to us! 😊 

- **Issue #1096** (2023-09-29): **Hardcoded Credentials in Docker Image superagidev/superagi:main**
  *Symptoms*: ### ⚠️ Check for existing issues before proceeding. ⚠️  - [X] I have searched the existing issues, and there is no existing issue for my problem  ### Where are you using SuperAGI?  Linux  ### Which branch of SuperAGI are you using?  Main  ### Do you use OpenAI GPT-3.5 or GPT-4?  GPT-3.5  ### Which area covers your issue best?  Installation and setup  ### Describe your issue.  The Docker image superagidev/superagi:main contains hardcoded credentials and host name. Particularly concerning is the database password which is set as "password". This design restricts users from setting their own security credentials.  Expected Behavior: The Docker image should not contain any hardcoded credentials, allowing users to specify their own, especially for security-sensitive components like database passwords.  Workaround: For now, users can create a copy of the affected configuration file and bind it as a volume in the Docker Compose setup. ```yaml volumes:       - "./alembic.ini:/app/alembic.ini"   ```  See error log: ``` psycopg2.OperationalError: could not translate host name "super__postgres" to address: Temporary failure in name resolution ```   ### How to replicate your Issue?  To reproduce the issue, follow the steps in the instructions at: https://hub.docker.com/r/superagidev/superagi. Before starting, replace the database connection credentials with your own in  `docker-compose.yaml` and `config.yaml`.  ### Upload Error Log Content  psycopg2.OperationalError: coul
  **Post-Mortem & Fix Analysis**:
  > Hi @dotnetautor  thanks for reporting this.  I'll fix this asap

- **Issue #568** (2023-07-03): **Cannot connect to redis://localhost:6379/0: Error 99 connecting to localhost:6379**
  *Symptoms*: superagi-backend-1          | ERROR:    Application startup failed. Exiting. superagi-celery-1           | [2023-06-30 10:54:39,863: ERROR/MainProcess] consumer: Cannot connect to redis://localhost:6379/0: Error 99 connecting to localhost:6379. Cannot assign requested address..
  **Post-Mortem & Fix Analysis**:
  > Can you share some more detailed logs? Also, is the issue persisting?
  > Sorry iv moved on and tried again with latest version !
  > Sorry iv moved on and tried again with latterst version 

- **Issue #560** (2023-07-05): ** if response['content'] is None:      | KeyError: 'content'**
  *Symptoms*: I am writing this issue to bring your attention to a recurring error I have encountered while working with your system.  I included the precursors to the problem for context regarding what triggers the error. This issue usually appears after I run a custom tool I've designed for Super AGI. I'm fairly certain the tool isn't be causing the error, but more so that it merely reveals a pre-existing issue in the codebase. The tool is returning almost 200 lines of data, I've included 6 below to demonstrate. ``` superagi-celery-1           | [2023-06-30 01:00:21,960: INFO/ForkPoolWorker-8] You are an AI assistant to create task. superagi-celery-1           |  superagi-celery-1           | High level goal: superagi-celery-1           | 1. Get Product Information and data from my shopify store superagi-celery-1           |  superagi-celery-1           |  superagi-celery-1           | INSTRUCTION(Follow these instruction to decide the flow of execution and decide the next steps for achieving the task): superagi-celery-1           | 1. First search the store for all products using the Get All Products tool  superagi-celery-1           | 2.  Second, get all the product data with the All Product Data tool based on the first product Id found with the previous get all products command superagi-celery-1           | 3. Last, use the  All Product Data tool to get all the product data with the title of a product superagi-celery-1           |  superagi-celery-1           |  supera
  **Post-Mortem & Fix Analysis**:
  > Can you check if you have a valid openai api key? 
  > I hope your offer to provide help is taken up on! That was really well written, and it sounds like you might have some insights into the potential cause of this pesky KeyError: 'content' issue..
  > > Can you check if you have a valid openai api key?   I've been using Super AGI for a month now coding tools, I'm certain that the API key is properly working, as i've ran numerous operations with it in the past that have compiled successfully

- **Issue #553** (2023-07-03): **issue with dependencies clashing **
  *Symptoms*: I have just tried so many combination of dependencies but can seem to find one thAT WORKS CAN YOU HELP PLEASE ?   It seems that even after installing SQLAlchemy version 1.3.16, you're still encountering dependency conflicts. The packages langchain and superagi have specific requirements for SQLAlchemy versions that are incompatible with each other.
  **Post-Mortem & Fix Analysis**:
  > yes, we are removing the conflicting dependency it is due to `pydantic-sqlalchemy` which we use to convert sqlalchemy to pydantic models which are then used by fastapi for validation   We are working on writing our own pydantic models
  > ``` from typing import Container, Optional, Type  from pydantic import BaseConfig, BaseModel, create_model from sqlalchemy.inspection import inspect from sqlalchemy.orm.properties import ColumnProperty   class OrmConfig(BaseConfig):     orm_mode = True   def sqlalchemy_to_pydantic(         db_model: Type, *, config: Type = OrmConfig, exclude: Container[str] = [] ) -> Type[BaseModel]:     mapper = inspect(db_model)     fields = {}     for attr in mapper.attrs:         if isinstance(attr, ColumnProperty):             if attr.columns:                 name = attr.key                 if name in exclude:                     continue                 column = attr.columns[0]                 python_type: Optional[type] = None                 if hasattr(column.type, "impl"):                     if hasattr(column.type.impl, "python_type"):                         python_type = column.type.impl.python_type                 elif hasattr(column.type, "python_type"):      
  > Hi i just pull lattest fixes and still getting the error "    Uninstalling urllib3-1.26.16:       Successfully uninstalled urllib3-1.26.16 ERROR: pip's dependency resolver does not currently take into account all the packages that are installed. This behabotocore 1.29.146 requires urllib3<1.27,>=1.25.4, but you  google-auth 2.19.1 requires urllib3<2.0, but you have urllib3 2.0.3 which is incompatible. llama-index 0.6.35 requires urllib3<2, but you have urllib3 2.0.3 which is incompatible. pyppeteer 1.0.2 requires urllib3<2.0.0,>=1.25.8, but you have urllib3 2.0.3 which is incompatible. qdrant-client 1.3.1 requires urllib3<2.0.0,>=1.26.14, but  you have urllib3 2.0.3 which is incompatible. superagi 0.0.26 requires fastapi==0.96.0, but you have fastapi 0.98.0 which is incompatible. superagi 0.0.26 requires SQLAlchemy==2.0.15, but you have  sqlalchemy 2.0.17 which is incompatible. Successfully installed urllib3-2.0.3 PS C:\Users\Dell User\SuperAGI> pip uninstall numpy        

- **Issue #507** (2023-10-03): **error message when running docker compose up --build**
  *Symptoms*: => ERROR [celery 3/8] RUN pip install --upgrade pip. How to fix this?
  **Post-Mortem & Fix Analysis**:
  > Use this command to run a shell in a container  - docker exec -it { celery container id} bash  Now run  - pip install --upgrade pip  it should work now
  > @didisoft69 is this issue resolved?
  > another problem "=> ERROR [gui deps 4/4] RUN npm ci "

- **Issue #488** (2023-10-03): **Error1: HTTPSConnectionPool(host='www.googleapis.com', port=443)**
  *Symptoms*: Tool GoogleSearch returned: Error1: HTTPSConnectionPool(host='www.googleapis.com', port=443): Max retries exceeded with url: /customsearch/v1?key=AIzaSyAqWMxG3gd-dP3Iat7DRoHz3qjwOKzzC1E&cx=81ad3e5916118434a&q=Informative+Path+Planning+research+papers&num=10&start=1 (Caused by NewConnectionError('<urllib3.connection.HTTPSConnection object at 0x7fe09e0fed60>: Failed to establish a new connection: [Errno -3] Temporary failure in name resolution')), ConnectionError, args: {'query': 'Informative Path Planning research papers'}
  **Post-Mortem & Fix Analysis**:
  > Looks like a network issue. You could try switching to a different WiFi or a mobile network. Lemme know if this works.
  > @SUTLZY can you try again and check if you got the same error?
  > >   I am currently in Mainland China, and it seems that the Great Firewall is causing the issue. Typical VPN solutions are evidently not suitable for the current situation. I have not yet found a solution, but I will update here once I do.

- **Issue #330** (2023-10-03): **Configure Super AGI**
  *Symptoms*: I followed all the steps as per the video: https://youtu.be/Unj5NLNTkLY  Stuck at: docker-compose up --build Error: error during connect: this error may indicate that the docker daemon is not running: Get "http://%2F%2F.%2Fpipe%2Fdocker_engine/v1.24/containers/json?all=1&filters=%7B%22label%22%3A%7B%22com.docker.compose.config-hash%22%3Atrue%2C%22com.docker.compose.project%3Dsuperagi-main%22%3Atrue%7D%7D": open //./pipe/docker_engine: The system cannot find the file specified.
  **Post-Mortem & Fix Analysis**:
  > seems like docker setup is skipped in the video  you need to setup docker before running this command  https://docs.docker.com/desktop/
  > I followed the tutorial but it shows..   [tasks] celery_1           |   . execute_agent celery_1           |  celery_1           | [2023-06-12 12:00:58,796: ERROR/MainProcess] consumer: Cannot connect to redis://super__redis:6379/0: Error 110 connecting to super__redis:6379. Connection timed out.. celery_1           | Trying again in 2.00 seconds... (1/100) celery_1           |  celery_1           | [2023-06-12 12:03:11,916: ERROR/MainProcess] consumer: Cannot connect to redis://super__redis:6379/0: Error 110 connecting to super__redis:6379. Connection timed out.. celery_1           | Trying again in 4.00 seconds... (2/100) restarted the process several times but still the same outcome..
  > backend_1          | Process SpawnProcess-1: backend_1          | Traceback (most recent call last): backend_1          |   File "/usr/local/lib/python3.9/site-packages/sqlalchemy/engine/base.py", line 3366, in _wrap_pool_connect backend_1          |     return fn() backend_1          |   File "/usr/local/lib/python3.9/site-packages/sqlalchemy/pool/base.py", line 327, in connect backend_1          |     return _ConnectionFairy._checkout(self) backend_1          |   File "/usr/local/lib/python3.9/site-packages/sqlalchemy/pool/base.py", line 894, in _checkout backend_1          |     fairy = _ConnectionRecord.checkout(pool) backend_1          |   File "/usr/local/lib/python3.9/site-packages/sqlalchemy/pool/base.py", line 493, in checkout backend_1          |     rec = pool._do_get() backend_1          |   File "/usr/local/lib/python3.9/site-packages/sqlalchemy/pool/impl.py", line 146, in _do_get backend_1          |     self._dec_overflow() backend_1          |   File "/usr/l

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

### Incident Patch 1: `6cd85efa` (2025-01-17)
**Commit Message**: Merge pull request #1 from r0path/zvuln_fix_insecure_direct_object_reference_idor_1737105809757082

Title: Fix authorization flaw in `download_file_by_id` function to ensure proper user access validation for resource downloads.

**File**: `superagi/controllers/resources.py` (modified, +16/-3)
```diff
@@ -130,17 +130,30 @@ def download_file_by_id(resource_id: int,
 
     Raises:
         HTTPException (status_code=400): If the resource with the specified ID is not found.
+        HTTPException (status_code=403): If the user doesn't have permission to access this resource.
         HTTPException (status_code=404): If the file is not found.
 
     """
+    # Get current user's organization_id from JWT token
+    current_user_org_id = Authorize.get_jwt_subject()
 
+    # First check if resource exists
     resource = db.session.query(Resource).filter(Resource.id == resource_id).first()
-    download_file_path = resource.path
-    file_name = resource.name
-
     if not resource:
         raise HTTPException(status_code=400, detail="Resource Not found!")
 
+    # Get the agent that owns this resource
+    agent = db.session.query(Agent).filter(Agent.id == resource.agent_id).first()
+    if not agent:
+        raise HTTPException(status_code=400, detail="Associated agent not found!")
+
+    # Verify the authenticated user belongs to the same organization as the agent
+    if str(agent.organisation_id) != str(current_user_org_id):
+        raise HTTPException(status_code=403, detail="You don't have permission to access this resource")
+
+    download_file_path = resource.path
+    file_name = resource.name
+
     if resource.storage_type == StorageType.S3.value:
         bucket_name = get_config("BUCKET_NAME")
         file_key = resource.path
```

---

### Incident Patch 2: `e0b99b2b` (2025-01-17)
**Commit Message**: fix: Add permission checks to prevent IDOR vulnerability in file download

**File**: `superagi/controllers/resources.py` (modified, +16/-3)
```diff
@@ -130,17 +130,30 @@ def download_file_by_id(resource_id: int,
 
     Raises:
         HTTPException (status_code=400): If the resource with the specified ID is not found.
+        HTTPException (status_code=403): If the user doesn't have permission to access this resource.
         HTTPException (status_code=404): If the file is not found.
 
     """
+    # Get current user's organization_id from JWT token
+    current_user_org_id = Authorize.get_jwt_subject()
 
+    # First check if resource exists
     resource = db.session.query(Resource).filter(Resource.id == resource_id).first()
-    download_file_path = resource.path
-    file_name = resource.name
-
     if not resource:
         raise HTTPException(status_code=400, detail="Resource Not found!")
 
+    # Get the agent that owns this resource
+    agent = db.session.query(Agent).filter(Agent.id == resource.agent_id).first()
+    if not agent:
+        raise HTTPException(status_code=400, detail="Associated agent not found!")
+
+    # Verify the authenticated user belongs to the same organization as the agent
+    if str(agent.organisation_id) != str(current_user_org_id):
+        raise HTTPException(status_code=403, detail="You don't have permission to access this resource")
+
+    download_file_path = resource.path
+    file_name = resource.name
+
     if resource.storage_type == StorageType.S3.value:
         bucket_name = get_config("BUCKET_NAME")
         file_key = resource.path
```

---

### Incident Patch 3: `1ee81454` (2024-12-05)
**Commit Message**: Fixed Discord Link README.MD (#1396)

Fixed Discord Link in 
"Join our [Discord community] for support and discussions" 
in README.MD

**File**: `README.MD` (modified, +2/-2)
```diff
@@ -189,7 +189,7 @@ cd SuperAGI
 
 ### 📖 Need Help?
 
-Join our [Discord community](https://discord.gg/YRUmuRMd) for support and discussions.
+Join our [Discord community](https://discord.gg/dXbRe5BHJC) for support and discussions.
 
 [![Join us on Discord](https://invidget.switchblade.xyz/uJ3XUGsY2R)](https://discord.gg/uJ3XUGsY2R)
 
@@ -239,4 +239,4 @@ Explore some [good first issues](https://github.com/TransformerOptimus/SuperAGI/
 <p align="center"><a href="https://github.com/TransformerOptimus/SuperAGI#"><img src="https://superagi.com/wp-content/uploads/2023/05/backToTopButton.png" alt="Back to top" height="29"/></a></p>
 
 ### ⚠️ Under Development!
-This project is under active development and may still have issues. We appreciate your understanding and patience. If you encounter any problems, please check the open issues first. If your issue is not listed, kindly create a new issue detailing the error or problem you experienced. Thank you for your support!
\ No newline at end of file
+This project is under active development and may still have issues. We appreciate your understanding and patience. If you encounter any problems, please check the open issues first. If your issue is not listed, kindly create a new issue detailing the error or problem you experienced. Thank you for your support!
```

---

### Incident Patch 4: `6c816d24` (2024-06-03)
**Commit Message**: Merge pull request #1423 from TransformerOptimus/fixes_for_settings_error

fixes for settings error

**File**: `superagi/models/models_config.py` (modified, +1/-2)
```diff
@@ -117,8 +117,7 @@ def fetch_api_keys(cls, session, organisation_id):
             logging.error("No API key found for the provided model provider")
             return []
 
-        api_keys = [{"provider": provider, "api_key": decrypt_data(api_key)} for provider, api_key in
-                    api_key_info]
+        api_keys = [{"provider": provider, "api_key": decrypt_data(api_key)} for provider, api_key in api_key_info if api_key != 'EMPTY']
 
         return api_keys
 
```

---

### Incident Patch 5: `aefdd8cc` (2024-06-03)
**Commit Message**: fixes for settings error

**File**: `superagi/models/models_config.py` (modified, +1/-2)
```diff
@@ -117,8 +117,7 @@ def fetch_api_keys(cls, session, organisation_id):
             logging.error("No API key found for the provided model provider")
             return []
 
-        api_keys = [{"provider": provider, "api_key": decrypt_data(api_key)} for provider, api_key in
-                    api_key_info]
+        api_keys = [{"provider": provider, "api_key": decrypt_data(api_key)} for provider, api_key in api_key_info if api_key != 'EMPTY']
 
         return api_keys
 
```

---

### Incident Patch 6: `eb94dcbf` (2024-01-30)
**Commit Message**: fixes for encryption_decryption (#1398)

**File**: `superagi/helper/encyption_helper.py` (modified, +2/-1)
```diff
@@ -2,6 +2,7 @@
 
 from cryptography.fernet import Fernet, InvalidToken, InvalidSignature
 from superagi.config.config import get_config
+from superagi.lib.logger import logger
 # Generate a key
 # key = Fernet.generate_key()
 
@@ -53,7 +54,7 @@ def decrypt_data(encrypted_data):
 
 
 def is_encrypted(value):
-    key = b'e3mp0E0Jr3jnVb96A31_lKzGZlSTPIp4-rPaVseyn58='
+    #key = get_config("ENCRYPTION_KEY")
     try:
         f = Fernet(key)
         f.decrypt(value)
```

---

### Incident Patch 7: `60d91ff8` (2024-01-09)
**Commit Message**: fix(Dockerfile): Removed trailing '\' (#1386)

**File**: `Dockerfile` (modified, +2/-2)
```diff
@@ -15,7 +15,7 @@ RUN pip install --upgrade pip && \
     pip install --no-cache-dir -r requirements.txt
 
 RUN python3.10 -c "import nltk; nltk.download('punkt')" && \
-  python3.10 -c "import nltk; nltk.download('averaged_perceptron_tagger')" \
+  python3.10 -c "import nltk; nltk.download('averaged_perceptron_tagger')"
 
 COPY . .
 
@@ -36,4 +36,4 @@ COPY --from=compile-image /root/nltk_data /root/nltk_data
 
 ENV PATH="/opt/venv/bin:$PATH"
 
-EXPOSE 8001
\ No newline at end of file
+EXPOSE 8001
```

---

### Incident Patch 8: `240d05d0` (2023-12-13)
**Commit Message**: Openai error handling for ratelimit, timeout and try again errors(fix #1255) (#1361)

* Adds error handling for openai's rate limit error in llms/openai module and its tests

- Adds test for rate limit error handling in the llms/openai module
- Adds error handling for rate limit error in the llms/openai module
- Refactors code in llms/openai module to be readable and modular

* Adds error handling for openai's timeout error in llms/openai module and its test

- Adds test for timeout error handling in chat_completion in llms/openai module
- Adds error handling for openai's timeout error in chat_completion in llms/openai module

* Adds error handling for openai's try again error in llms/openai module and its test

- Adds test for openai's try again error handling in chat_completion in llms/openai module
- Adds error handling for openai's try again error in chat_completion in llms/openai module

* Refactors llms/openai module and its tests to return error after retry attempts are exausted

* Increases wait time for retry of chat_completion in llms/openai module

* Removes unused import

**File**: `superagi/llms/openai.py` (modified, +30/-4)
```diff
@@ -1,11 +1,20 @@
 import openai
 from openai import APIError, InvalidRequestError
-from openai.error import RateLimitError, AuthenticationError
+from openai.error import RateLimitError, AuthenticationError, Timeout, TryAgain
+from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_random_exponential
 
 from superagi.config.config import get_config
 from superagi.lib.logger import logger
 from superagi.llms.base_llm import BaseLlm
 
+MAX_RETRY_ATTEMPTS = 5
+MIN_WAIT = 30 # Seconds
+MAX_WAIT = 300 # Seconds
+
+def custom_retry_error_callback(retry_state):
+    logger.info("OpenAi Exception:", retry_state.outcome.exception())
+    return {"error": "ERROR_OPENAI", "message": "Open ai exception: "+str(retry_state.outcome.exception())}
+
 
 class OpenAi(BaseLlm):
     def __init__(self, api_key, model="gpt-4", temperature=0.6, max_tokens=get_config("MAX_MODEL_TOKEN_LIMIT"), top_p=1,
@@ -50,6 +59,17 @@ def get_model(self):
         """
         return self.model
 
+    @retry(
+        retry=(
+            retry_if_exception_type(RateLimitError) |
+            retry_if_exception_type(Timeout) |
+            retry_if_exception_type(TryAgain)
+        ),
+        stop=stop_after_attempt(MAX_RETRY_ATTEMPTS), # Maximum number of retry attempts
+        wait=wait_random_exponential(min=MIN_WAIT, max=MAX_WAIT),
+        before_sleep=lambda retry_state: logger.info(f"{retry_state.outcome.exception()} (attempt {retry_state.attempt_number})"),
+        retry_error_callback=custom_retry_error_callback
+    )
     def chat_completion(self, messages, max_tokens=get_config("MAX_MODEL_TOKEN_LIMIT")):
         """
         Call the OpenAI chat completion API.
@@ -75,12 +95,18 @@ def chat_completion(self, messages, max_tokens=get_config("MAX_MODEL_TOKEN_LIMIT
             )
             content = response.choices[0].message["content"]
             return {"response": response, "content": content}
+        except RateLimitError as api_error:
+            logger.info("OpenAi RateLimitError:", api_error)
+            raise RateLimitError(str(api_error))
+        except Timeout as timeout_error:
+            logger.info("OpenAi Timeout:", timeout_error)
+            raise Timeout(str(timeout_error))
+        except TryAgain as try_again_error:
+            logger.info("OpenAi TryAgain:", try_again_error)
+            raise TryAgain(str(try_again_error))
         except AuthenticationError as auth_error:
             logger.info("OpenAi AuthenticationError:", auth_error)
             return {"error": "ERROR_AUTHENTICATION", "message": "Authentication error please check the api keys: "+str(auth_error)}
-        except RateLimitError as api_error:
-            logger.info("OpenAi RateLimitError:", api_error)
-            return {"error": "ERROR_RATE_LIMIT", "message": "Openai rate limit exceeded: "+str(api_error)}
         except InvalidRequestError as invalid_request_error:
             logger.info("OpenAi InvalidRequestError:", invalid_request_error)
             return {"error": "ERROR_INVALID_REQUEST", "message": "Openai invalid request error: "+str(invalid_request_error)}
```

**File**: `tests/unit_tests/llms/test_open_ai.py` (modified, +75/-1)
```diff
@@ -1,6 +1,8 @@
+import openai
 import pytest
 from unittest.mock import MagicMock, patch
-from superagi.llms.openai import OpenAi
+
+from superagi.llms.openai import OpenAi, MAX_RETRY_ATTEMPTS
 
 
 @patch('superagi.llms.openai.openai')
@@ -33,6 +35,78 @@ def test_chat_completion(mock_openai):
     )
 
 
+@patch('superagi.llms.openai.wait_random_exponential.__call__')
+@patch('superagi.llms.openai.openai')
+def test_chat_completion_retry_rate_limit_error(mock_openai, mock_wait_random_exponential):
+    # Arrange
+    model = 'gpt-4'
+    api_key = 'test_key'
+    openai_instance = OpenAi(api_key, model=model)
+
+    messages = [{"role": "system", "content": "You are a helpful assistant."}]
+    max_tokens = 100
+
+    mock_openai.ChatCompletion.create.side_effect = openai.error.RateLimitError("Rate limit exceeded")
+
+    # Mock sleep time
+    mock_wait_random_exponential.return_value = 0.1
+
+    # Act
+    result = openai_instance.chat_completion(messages, max_tokens)
+
+    # Assert
+    assert result == {"error": "ERROR_OPENAI", "message": "Open ai exception: Rate limit exceeded"}
+    assert mock_openai.ChatCompletion.create.call_count == MAX_RETRY_ATTEMPTS
+
+
+@patch('superagi.llms.openai.wait_random_exponential.__call__')
+@patch('superagi.llms.openai.openai')
+def test_chat_completion_retry_timeout_error(mock_openai, mock_wait_random_exponential):
+    # Arrange
+    model = 'gpt-4'
+    api_key = 'test_key'
+    openai_instance = OpenAi(api_key, model=model)
+
+    messages = [{"role": "system", "content": "You are a helpful assistant."}]
+    max_tokens = 100
+
+    mock_openai.ChatCompletion.create.side_effect = openai.error.Timeout("Timeout occured")
+
+    # Mock sleep time
+    mock_wait_random_exponential.return_value = 0.1
+
+    # Act
+    result = openai_instance.chat_completion(messages, max_tokens)
+
+    # Assert
+    assert result == {"error": "ERROR_OPENAI", "message": "Open ai exception: Timeout occured"}
+    assert mock_openai.ChatCompletion.create.call_count == MAX_RETRY_ATTEMPTS
+
+
+@patch('superagi.llms.openai.wait_random_exponential.__call__')
+@patch('superagi.llms.openai.openai')
+def test_chat_completion_retry_try_again_error(mock_openai, mock_wait_random_exponential):
+    # Arrange
+    model = 'gpt-4'
+    api_key = 'test_key'
+    openai_instance = OpenAi(api_key, model=model)
+
+    messages = [{"role": "system", "content": "You are a helpful assistant."}]
+    max_tokens = 100
+
+    mock_openai.ChatCompletion.create.side_effect = openai.error.TryAgain("Try Again")
+
+    # Mock sleep time
+    mock_wait_random_exponential.return_value = 0.1
+
+    # Act
+    result = openai_instance.chat_completion(messages, max_tokens)
+
+    # Assert
+    assert result == {"error": "ERROR_OPENAI", "message": "Open ai exception: Try Again"}
+    assert mock_openai.ChatCompletion.create.call_count == MAX_RETRY_ATTEMPTS
+
+
 def test_verify_access_key():
     model = 'gpt-4'
     api_key = 'test_key'
```

---

### Incident Patch 9: `ea2a0b6c` (2023-11-29)
**Commit Message**: fix for #1373 (#1375)

* use get_config

* add a check on the key

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -110,7 +110,7 @@ jobs:
           PLAIN_OUTPUT: True
           REDIS_URL: "localhost:6379"
           IS_TESTING: True
-          ENCRYPTION_KEY: "dummy key"
+          ENCRYPTION_KEY: "abcdefghijklmnopqrstuvwxyz123456"
 
       - name: Upload coverage reports to Codecov
         uses: codecov/codecov-action@v3
```

**File**: `config_template.yaml` (modified, +2/-2)
```diff
@@ -55,8 +55,8 @@ GITHUB_CLIENT_ID:
 GITHUB_CLIENT_SECRET:
 FRONTEND_URL: "http://localhost:3000"
 
-#ENCRPYTION KEY
-ENCRYPTION_KEY: secret
+#ENCRPYTION KEY, Replace this with your own key for production
+ENCRYPTION_KEY: abcdefghijklmnopqrstuvwxyz123456
 
 #WEAVIATE
 
```

**File**: `superagi/helper/encyption_helper.py` (modified, +12/-0)
```diff
@@ -1,3 +1,5 @@
+import base64
+
 from cryptography.fernet import Fernet, InvalidToken, InvalidSignature
 from superagi.config.config import get_config
 # Generate a key
@@ -6,9 +8,19 @@
 key = get_config("ENCRYPTION_KEY")
 if key is None:
     raise Exception("Encryption key not found in config file.")
+
+if len(key) != 32:
+    raise ValueError("Encryption key must be 32 bytes long.")
+
+# Encode the key to UTF-8
 key = key.encode(
     "utf-8"
 )
+
+# base64 encode the key
+key = base64.urlsafe_b64encode(key)
+
+# Create a cipher suite
 cipher_suite = Fernet(key)
 
 
```

---

### Incident Patch 10: `a613785a` (2023-11-08)
**Commit Message**: Merge pull request #1360 from TransformerOptimus/fixes_for_main_1

fixes

**File**: `gui/pages/Content/Models/ModelForm.js` (modified, +3/-3)
```diff
@@ -143,7 +143,7 @@ export default function ModelForm({internalId, getModels, sendModelData, env}){
                 <div>
                     {modelDropdown && <div className="custom_select_options w_100" ref={modelRef}>
                         {models.map((model, index) => (
-                            <div key={index} className="custom_select_option" onClick={() => handleModelSelect(index)} style={{padding: '12px 14px', maxWidth: '100%'}}>
+                            <div key={index} className="custom_select_option" onClick={() => {setModelStatus(null); handleModelSelect(index)}} style={{padding: '12px 14px', maxWidth: '100%'}}>
                                 {model}
                             </div>))}
                     </div>}
@@ -186,14 +186,14 @@ export default function ModelForm({internalId, getModels, sendModelData, env}){
                        onChange={(event) => setModelTokenLimit(parseInt(event.target.value, 10))}/>
             </div>
 
-            {modelStatus===false && <div className="horizontal_container align_start error_box mt_24 gap_6">
+            {selectedModel === 'Local LLM' && modelStatus===false && <div className="horizontal_container align_start error_box mt_24 gap_6">
                 <Image width={16} height={16} src="/images/icon_error.svg" alt="error-icon" />
                 <div className="vertical_containers">
                     <span className="text_12 color_white lh_16">Test model failed</span>
                 </div>
             </div>}
 
-            {modelStatus===true && <div className="horizontal_container align_start success_box mt_24 gap_6">
+            {selectedModel === 'Local LLM' && modelStatus===true && <div className="horizontal_container align_start success_box mt_24 gap_6">
                 <Image width={16} height={16} src="/images/icon_info.svg"/>
                 <div className="vertical_containers">
                     <span className="text_12 color_white lh_16">Test model successful</span>
```

**File**: `superagi/controllers/models_controller.py` (modified, +6/-2)
```diff
@@ -1,3 +1,4 @@
+from typing import Optional
 from fastapi import APIRouter, Depends, HTTPException, Query, Body
 from superagi.helper.auth import check_auth, get_user_organisation
 from superagi.helper.models_helper import ModelsHelper
@@ -28,7 +29,7 @@ class StoreModelRequest(BaseModel):
     token_limit: int
     type: str
     version: str
-    context_length: int
+    context_length: Optional[int]
 
 class ModelName (BaseModel):
     model: str
@@ -74,7 +75,10 @@ async def store_model(request: StoreModelRequest, organisation=Depends(get_user_
     try:
         #context_length = 4096
         logger.info(request)
-        return Models.store_model_details(db.session, organisation.id, request.model_name, request.description, request.end_point, request.model_provider_id, request.token_limit, request.type, request.version, request.context_length)
+        if 'context_length' in request.dict():
+            return Models.store_model_details(db.session, organisation.id, request.model_name, request.description, request.end_point, request.model_provider_id, request.token_limit, request.type, request.version, request.context_length)
+        else:
+            return Models.store_model_details(db.session, organisation.id, request.model_name, request.description, request.end_point, request.model_provider_id, request.token_limit, request.type, request.version, 0)
     except Exception as e:
         logging.error(f"Error storing the Model Details: {str(e)}")
         raise HTTPException(status_code=500, detail="Internal Server Error")
```

**File**: `superagi/models/models_config.py` (modified, +1/-1)
```diff
@@ -106,7 +106,7 @@ def storeGptModels(cls, session, organisation_id, model_provider_id, model_api_k
         for model in models:
             if model not in installed_models and model in default_models:
                 result = Models.store_model_details(session, organisation_id, model, model, '',
-                                                 model_provider_id, default_models[model], 'Custom', '')
+                                                 model_provider_id, default_models[model], 'Custom', '', 0)
 
     @classmethod
     def fetch_api_keys(cls, session, organisation_id):
```

---

### Incident Patch 11: `8e1d2231` (2023-11-08)
**Commit Message**: fixes

**File**: `gui/pages/Content/Models/ModelForm.js` (modified, +3/-3)
```diff
@@ -143,7 +143,7 @@ export default function ModelForm({internalId, getModels, sendModelData, env}){
                 <div>
                     {modelDropdown && <div className="custom_select_options w_100" ref={modelRef}>
                         {models.map((model, index) => (
-                            <div key={index} className="custom_select_option" onClick={() => handleModelSelect(index)} style={{padding: '12px 14px', maxWidth: '100%'}}>
+                            <div key={index} className="custom_select_option" onClick={() => {setModelStatus(null); handleModelSelect(index)}} style={{padding: '12px 14px', maxWidth: '100%'}}>
                                 {model}
                             </div>))}
                     </div>}
@@ -186,14 +186,14 @@ export default function ModelForm({internalId, getModels, sendModelData, env}){
                        onChange={(event) => setModelTokenLimit(parseInt(event.target.value, 10))}/>
             </div>
 
-            {modelStatus===false && <div className="horizontal_container align_start error_box mt_24 gap_6">
+            {selectedModel === 'Local LLM' && modelStatus===false && <div className="horizontal_container align_start error_box mt_24 gap_6">
                 <Image width={16} height={16} src="/images/icon_error.svg" alt="error-icon" />
                 <div className="vertical_containers">
                     <span className="text_12 color_white lh_16">Test model failed</span>
                 </div>
             </div>}
 
-            {modelStatus===true && <div className="horizontal_container align_start success_box mt_24 gap_6">
+            {selectedModel === 'Local LLM' && modelStatus===true && <div className="horizontal_container align_start success_box mt_24 gap_6">
                 <Image width={16} height={16} src="/images/icon_info.svg"/>
                 <div className="vertical_containers">
                     <span className="text_12 color_white lh_16">Test model successful</span>
```

**File**: `superagi/controllers/models_controller.py` (modified, +6/-2)
```diff
@@ -1,3 +1,4 @@
+from typing import Optional
 from fastapi import APIRouter, Depends, HTTPException, Query, Body
 from superagi.helper.auth import check_auth, get_user_organisation
 from superagi.helper.models_helper import ModelsHelper
@@ -28,7 +29,7 @@ class StoreModelRequest(BaseModel):
     token_limit: int
     type: str
     version: str
-    context_length: int
+    context_length: Optional[int]
 
 class ModelName (BaseModel):
     model: str
@@ -74,7 +75,10 @@ async def store_model(request: StoreModelRequest, organisation=Depends(get_user_
     try:
         #context_length = 4096
         logger.info(request)
-        return Models.store_model_details(db.session, organisation.id, request.model_name, request.description, request.end_point, request.model_provider_id, request.token_limit, request.type, request.version, request.context_length)
+        if 'context_length' in request.dict():
+            return Models.store_model_details(db.session, organisation.id, request.model_name, request.description, request.end_point, request.model_provider_id, request.token_limit, request.type, request.version, request.context_length)
+        else:
+            return Models.store_model_details(db.session, organisation.id, request.model_name, request.description, request.end_point, request.model_provider_id, request.token_limit, request.type, request.version, 0)
     except Exception as e:
         logging.error(f"Error storing the Model Details: {str(e)}")
         raise HTTPException(status_code=500, detail="Internal Server Error")
```

**File**: `superagi/models/models_config.py` (modified, +1/-1)
```diff
@@ -106,7 +106,7 @@ def storeGptModels(cls, session, organisation_id, model_provider_id, model_api_k
         for model in models:
             if model not in installed_models and model in default_models:
                 result = Models.store_model_details(session, organisation_id, model, model, '',
-                                                 model_provider_id, default_models[model], 'Custom', '')
+                                                 model_provider_id, default_models[model], 'Custom', '', 0)
 
     @classmethod
     def fetch_api_keys(cls, session, organisation_id):
```

---

### Incident Patch 12: `4afbd7c0` (2023-11-03)
**Commit Message**: Merge pull request #1356 from TransformerOptimus/fixes-for-main

fixes for main

**File**: `docker-compose.yaml` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ services:
       - redis_data:/data
 
   super__postgres:
-    image: "docker.io/library/postgres:latest"
+    image: "docker.io/library/postgres:15"
     environment:
       - POSTGRES_USER=superagi
       - POSTGRES_PASSWORD=password
```

**File**: `gui/pages/Content/Models/AddModel.js` (modified, +2/-2)
```diff
@@ -1,14 +1,14 @@
 import React, {useEffect, useState} from "react";
 import ModelForm from "./ModelForm";
 
-export default function AddModel({internalId, getModels, sendModelData}){
+export default function AddModel({internalId, getModels, sendModelData, env}){
 
     return(
         <div id="add_model">
             <div className="row">
                 <div className="col-3" />
                 <div className="col-6 col-6-scrollable">
-                    <ModelForm internalId={internalId} getModels={getModels} sendModelData={sendModelData}/>
+                    <ModelForm internalId={internalId} getModels={getModels} sendModelData={sendModelData} env={env}/>
                 </div>
                 <div className="col-3" />
             </div>
```

**File**: `gui/pages/Content/Models/ModelForm.js` (modified, +55/-10)
```diff
@@ -1,22 +1,25 @@
 import React, {useEffect, useRef, useState} from "react";
 import {removeTab, openNewTab, createInternalId, getUserClick} from "@/utils/utils";
 import Image from "next/image";
-import {fetchApiKey, storeModel, verifyEndPoint} from "@/pages/api/DashboardService";
+import {fetchApiKey, storeModel, testModel, verifyEndPoint} from "@/pages/api/DashboardService";
 import {BeatLoader, ClipLoader} from "react-spinners";
 import {ToastContainer, toast} from 'react-toastify';
 
-export default function ModelForm({internalId, getModels, sendModelData}){
-    const models = ['OpenAI', 'Replicate', 'Hugging Face', 'Google Palm'];
+export default function ModelForm({internalId, getModels, sendModelData, env}){
+    const models = env === 'DEV' ? ['OpenAI', 'Replicate', 'Hugging Face', 'Google Palm', 'Local LLM'] : ['OpenAI', 'Replicate', 'Hugging Face', 'Google Palm'];
     const [selectedModel, setSelectedModel] = useState('Select a Model');
     const [modelName, setModelName] = useState('');
     const [modelDescription, setModelDescription] = useState('');
     const [modelTokenLimit, setModelTokenLimit] = useState(4096);
     const [modelEndpoint, setModelEndpoint] = useState('');
     const [modelDropdown, setModelDropdown] = useState(false);
     const [modelVersion, setModelVersion] = useState('');
+    const [modelContextLength, setContextLength] = useState(4096);
     const [tokenError, setTokenError] = useState(false);
     const [lockAddition, setLockAddition] = useState(true);
     const [isLoading, setIsLoading] = useState(false)
+    const [modelStatus, setModelStatus] = useState(null);
+    const [createClickable, setCreateClickable] = useState(true);
     const modelRef = useRef(null);
 
     useEffect(() => {
@@ -79,13 +82,31 @@ export default function ModelForm({internalId, getModels, sendModelData}){
         })
     }
 
+    const handleModelStatus = async () => {
+        try {
+            setCreateClickable(false);
+            const response = await testModel();
+            if(response.status === 200) {
+                setModelStatus(true);
+                setCreateClickable(true);
+            } else {
+                setModelStatus(false);
+                setCreateClickable(true);
+            }
+        } catch(error) {
+            console.log("Error Message:: " + error);
+            setModelStatus(false);
+            setCreateClickable(true);
+        }
+    }
+
     const handleModelSuccess = (model) => {
         model.contentType = 'Model'
         sendModelData(model)
     }
 
     const storeModelDetails = (modelProviderId) => {
-        storeModel(modelName,modelDescription, modelEndpoint, modelProviderId, modelTokenLimit, "Custom", modelVersion).then((response) =>{
+        storeModel(modelName,modelDescription, modelEndpoint, modelProviderId, modelTokenLimit, "Custom", modelVersion, modelContextLength).then((response) =>{
             setIsLoading(false)
             let data = response.data
             if (data.error) {
@@ -153,18 +174,42 @@ export default function ModelForm({internalId, getModels, sendModelData}){
                        onChange={(event) => setModelVersion(event.target.value)}/>
             </div>}
 
+            {(selectedModel === 'Local LLM') && <div className="mt_24">
+                <span>Model Context Length</span>
+                <input className="input_medium mt_8" type="number" placeholder="Enter Model Context Length" value={modelContextLength}
+                       onChange={(event) => setContextLength(event.target.value)}/>
+            </div>}
+
             <div className="mt_24">
                 <span>Token Limit</span>
                 <input className="input_medium mt_8" type="number" placeholder="Enter Model Token Limit" value={modelTokenLimit}
                        onChange={(event) => setModelTokenLimit(parseInt(event.target.value, 10))}/>
             </div>
 
-            <div className="horizontal_container justify_end mt_24">
-                <button className="secondary_button mr_7"
-                        onClick={() => removeTab(-5, "new model", "Add_Model", internalId)}>Cancel</button>
-                <button className='primary_button' onClick={handleAddModel} disabled={lockAddition || isLoading}>
-                    {isLoading ? <><span>Adding Model &nbsp;</span><ClipLoader size={16} color={"#000000"} /></> : 'Add Model'}
-                </button>
+            {modelStatus===false && <div className="horizontal_container align_start error_box mt_24 gap_6">
+                <Image width={16} height={16} src="/images/icon_error.svg" alt="error-icon" />
+                <div className="vertical_containers">
+                    <span className="text_12 color_white lh_16">Test model failed</span>
+                </div>
+            </div>}
+
+            {modelStatus===true && <div className="horizontal_container align_start success_box mt_24 gap_6">
+                <Image width={16} height={16} src
```

**File**: `gui/pages/Dashboard/Content.js` (modified, +1/-1)
```diff
@@ -470,7 +470,7 @@ export default function Content({env, selectedView, selectedProjectId, organisat
                                      organisationId={organisationId} sendKnowledgeData={addTab}
                                      sendAgentData={addTab} selectedProjectId={selectedProjectId} editAgentId={tab.id}
                                      fetchAgents={getAgentList} toolkits={toolkits} template={null} edit={true} agents={agents}/>}
-                    {tab.contentType === 'Add_Model' && <AddModel internalId={tab.internalId} getModels={getModels} sendModelData={addTab}/>}
+                    {tab.contentType === 'Add_Model' && <AddModel internalId={tab.internalId} getModels={getModels} sendModelData={addTab} env={env}/>}
                     {tab.contentType === 'Model' && <ModelDetails modelId={tab.id} modelName={tab.name} />}
                   </div>}
                 </div>
```

**File**: `gui/pages/_app.css` (modified, +10/-60)
```diff
@@ -231,18 +231,6 @@ input[type="range"]::-moz-range-track {
     z-index: 10;
 }
 
-.dropdown_container_models {
-    flex-direction: column;
-    align-items: flex-start;
-    border-radius: 8px;
-    background: #2E293F;
-    box-shadow: -2px 2px 24px rgba(0, 0, 0, 0.4);
-    position: absolute;
-    width: fit-content;
-    height: fit-content;
-    padding: 8px;
-}
-
 .dropdown_container {
     width: 150px;
     height: auto;
@@ -783,7 +771,6 @@ p {
 .mt_74{margin-top: 74px;}
 .mt_80{margin-top: 80px;}
 .mt_90{margin-top: 90px;}
-.mt_130{margin-top: 130px;}
 
 .mb_1{margin-bottom: 1px;}
 .mb_2{margin-bottom: 2px;}
@@ -991,22 +978,6 @@ p {
     line-height: normal;
 }
 
-.text_20 {
-    color: #FFF;
-    font-size: 20px;
-    font-style: normal;
-    font-weight: 400;
-    line-height: normal;
-}
-
-.text_20 {
-    color: #FFF;
-    font-size: 20px;
-    font-style: normal;
-    font-weight: 400;
-    line-height: normal;
-}
-
 .text_20_bold{
     color: #FFF;
     font-size: 20px;
@@ -1107,7 +1078,6 @@ p {
 .w_73{width: 73%}
 .w_97{width: 97%}
 .w_100{width: 100%}
-.w_99vw{width: 99vw}
 .w_inherit{width: inherit}
 .w_fit_content{width:fit-content}
 .w_inherit{width: inherit}
@@ -1125,11 +1095,11 @@ p {
 .h_80vh{height: 80vh}
 .h_calc92{height: calc(100vh - 92px)}
 .h_calc_add40{height: calc(80vh + 40px)}
-.h_calc_sub_60{height: calc(92.5vh - 60px)}
 
 .mxh_78vh{max-height: 78vh}
 
 .flex_dir_col{flex-direction: column}
+.flex_none{flex: none}
 
 .justify_center{justify-content: center}
 .justify_end{justify-content: flex-end}
@@ -1138,8 +1108,6 @@ p {
 
 .display_flex{display: inline-flex}
 .display_flex_container{display: flex}
-.display_none{display: none}
-.display_block{display: block}
 
 .align_center{align-items: center}
 .align_start{align-items: flex-start}
@@ -1178,8 +1146,6 @@ p {
 
 .bt_white{border-top: 1px solid rgba(255, 255, 255, 0.08);}
 
-.bt_white{border-top: 1px solid rgba(255, 255, 255, 0.08);}
-
 .color_white{color:#FFFFFF}
 .color_gray{color:#888888}
 
@@ -1188,7 +1154,7 @@ p {
 .lh_18{line-height: 18px;}
 .lh_24{line-height: 24px;}
 
-.padding_0{padding: 0}
+.padding_0{padding: 0;}
 .padding_5{padding: 5px;}
 .padding_6{padding: 6px;}
 .padding_8{padding: 8px;}
@@ -1505,7 +1471,6 @@ tr{
 .bg_none{background: none;}
 .bg_primary{background: #2E293F;}
 .bg_secondary{background: #272335;}
-.bg_none{background: none}
 
 .container {
     height: 100%;
@@ -1871,6 +1836,13 @@ tr{
     padding: 12px;
 }
 
+.success_box{
+    border-radius: 8px;
+    padding: 12px;
+    border-left: 4px solid rgba(255, 255, 255, 0.60);
+    background: rgba(255, 255, 255, 0.08);
+}
+
 .horizontal_line {
     margin: 16px 0 16px -16px;
     border: 1px solid #ffffff20;
@@ -1922,26 +1894,4 @@ tr{
 .tooltip-class {
     background-color: green;
     border-radius: 6px;
-}
-
-.text_dropdown {
-    color: #FFFFFF;
-    font-family: Plus Jakarta Sans, sans-serif;
-    font-style: normal;
-    font-weight: 500;
-    line-height: normal;
-}
-
-.text_dropdown_18 {
-    font-size: 18px;
-}
-
-.vertical_divider {
-    background: transparent;
-    /*border-color: rgba(255, 255, 255, 0.08);*/
-    border: 1.2px solid rgba(255, 255, 255, 0.08);;
-    height: 20px;
-    width: 0;
-}
-
-
+}
\ No newline at end of file
```

**File**: `gui/pages/api/DashboardService.js` (modified, +6/-3)
```diff
@@ -358,8 +358,12 @@ export const verifyEndPoint = (model_api_key, end_point, model_provider) => {
   });
 }
 
-export const storeModel = (model_name, description, end_point, model_provider_id, token_limit, type, version) => {
-  return api.post(`/models_controller/store_model`,{model_name, description, end_point, model_provider_id, token_limit, type, version});
+export const storeModel = (model_name, description, end_point, model_provider_id, token_limit, type, version, context_length) => {
+  return api.post(`/models_controller/store_model`,{model_name, description, end_point, model_provider_id, token_limit, type, version, context_length});
+}
+
+export const testModel = () => {
+  return api.get(`/models_controller/test_local_llm`);
 }
 
 export const fetchModels = () => {
@@ -389,7 +393,6 @@ export const getToolLogs = (toolName) => {
 export const publishTemplateToMarketplace = (agentData) => {
   return api.post(`/agent_templates/publish_template`, agentData);
 };
-
 export const getKnowledgeMetrics = (knowledgeName) => {
   return api.get(`analytics/knowledge/${knowledgeName}/usage`)
 }
```

**File**: `superagi/controllers/models_controller.py` (modified, +35/-2)
```diff
@@ -2,13 +2,15 @@
 from superagi.helper.auth import check_auth, get_user_organisation
 from superagi.helper.models_helper import ModelsHelper
 from superagi.apm.call_log_helper import CallLogHelper
+from superagi.lib.logger import logger
 from superagi.models.models import Models
 from superagi.models.models_config import ModelsConfig
 from superagi.config.config import get_config
 from superagi.controllers.types.models_types import ModelsTypes
 from fastapi_sqlalchemy import db
 import logging
 from pydantic import BaseModel
+from superagi.helper.llm_loader import LLMLoader
 
 router = APIRouter()
 
@@ -26,6 +28,7 @@ class StoreModelRequest(BaseModel):
     token_limit: int
     type: str
     version: str
+    context_length: int
 
 class ModelName (BaseModel):
     model: str
@@ -69,7 +72,9 @@ async def verify_end_point(model_api_key: str = None, end_point: str = None, mod
 @router.post("/store_model", status_code=200)
 async def store_model(request: StoreModelRequest, organisation=Depends(get_user_organisation)):
     try:
-        return Models.store_model_details(db.session, organisation.id, request.model_name, request.description, request.end_point, request.model_provider_id, request.token_limit, request.type, request.version)
+        #context_length = 4096
+        logger.info(request)
+        return Models.store_model_details(db.session, organisation.id, request.model_name, request.description, request.end_point, request.model_provider_id, request.token_limit, request.type, request.version, request.context_length)
     except Exception as e:
         logging.error(f"Error storing the Model Details: {str(e)}")
         raise HTTPException(status_code=500, detail="Internal Server Error")
@@ -164,4 +169,32 @@ def get_models_details(page: int = 0):
     marketplace_models = Models.fetch_marketplace_list(page)
     marketplace_models_with_install = Models.get_model_install_details(db.session, marketplace_models, organisation_id,
                                                                        ModelsTypes.MARKETPLACE.value)
-    return marketplace_models_with_install
\ No newline at end of file
+    return marketplace_models_with_install
+
+@router.get("/test_local_llm", status_code=200)
+def test_local_llm():
+    try:
+        llm_loader = LLMLoader(context_length=4096)
+        llm_model = llm_loader.model
+        llm_grammar = llm_loader.grammar
+        if llm_model is None:
+            logger.error("Model not found.")
+            raise HTTPException(status_code=404, detail="Error while loading the model. Please check your model path and try again.")
+        if llm_grammar is None:
+            logger.error("Grammar not found.")
+            raise HTTPException(status_code=404, detail="Grammar not found.")
+
+        messages = [
+            {"role":"system",
+             "content":"You are an AI assistant. Give response in a proper JSON format"},
+             {"role":"user",
+             "content":"Hi!"}
+        ]
+        response = llm_model.create_chat_completion(messages=messages, grammar=llm_grammar)
+        content = response["choices"][0]["message"]["content"]
+        logger.info(content)
+        return "Model loaded successfully."
+        
+    except Exception as e:
+        logger.info("Error: ",e)
+        raise HTTPException(status_code=404, detail="Error while loading the model. Please check your model path and try again.")
\ No newline at end of file
```

**File**: `superagi/helper/llm_loader.py` (modified, +1/-1)
```diff
@@ -35,4 +35,4 @@ def grammar(self):
                     "superagi/llms/grammar/json.gbnf")
             except Exception as e:
                 logger.error(e)
-        return self._grammar
+        return self._grammar
\ No newline at end of file
```

---

### Incident Patch 13: `b9f7a608` (2023-11-03)
**Commit Message**: fixes

**File**: `superagi/models/models_config.py` (modified, +1/-1)
```diff
@@ -157,7 +157,7 @@ def fetch_model_by_id_marketplace(cls, session, model_provider_id):
             return {"provider": model.provider}
     
     @classmethod
-    def add_model_config(cls, session, organisation_id):
+    def add_llm_config(cls, session, organisation_id):
         existing_models_config = session.query(ModelsConfig).filter(ModelsConfig.org_id == organisation_id, ModelsConfig.provider == 'Local LLM').first()
         if existing_models_config is None:
             models_config = ModelsConfig(org_id=organisation_id, provider='Local LLM', api_key="EMPTY")
```

---

### Incident Patch 14: `b8b8b18a` (2023-11-03)
**Commit Message**: fixes

**File**: `superagi/models/models_config.py` (modified, +1/-1)
```diff
@@ -157,7 +157,7 @@ def fetch_model_by_id_marketplace(cls, session, model_provider_id):
             return {"provider": model.provider}
     
     @classmethod
-    def local_llm_model_config(cls, session, organisation_id):
+    def add_model_config(cls, session, organisation_id):
         existing_models_config = session.query(ModelsConfig).filter(ModelsConfig.org_id == organisation_id, ModelsConfig.provider == 'Local LLM').first()
         if existing_models_config is None:
             models_config = ModelsConfig(org_id=organisation_id, provider='Local LLM', api_key="EMPTY")
```

---

### Incident Patch 15: `3c43030b` (2023-11-03)
**Commit Message**: fixes

**File**: `docker-compose.yaml` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ services:
       - redis_data:/data
 
   super__postgres:
-    image: "docker.io/library/postgres:latest"
+    image: "docker.io/library/postgres:15"
     environment:
       - POSTGRES_USER=superagi
       - POSTGRES_PASSWORD=password
```

**File**: `gui/pages/Content/Models/AddModel.js` (modified, +2/-2)
```diff
@@ -1,14 +1,14 @@
 import React, {useEffect, useState} from "react";
 import ModelForm from "./ModelForm";
 
-export default function AddModel({internalId, getModels, sendModelData}){
+export default function AddModel({internalId, getModels, sendModelData, env}){
 
     return(
         <div id="add_model">
             <div className="row">
                 <div className="col-3" />
                 <div className="col-6 col-6-scrollable">
-                    <ModelForm internalId={internalId} getModels={getModels} sendModelData={sendModelData}/>
+                    <ModelForm internalId={internalId} getModels={getModels} sendModelData={sendModelData} env={env}/>
                 </div>
                 <div className="col-3" />
             </div>
```

**File**: `gui/pages/Content/Models/ModelForm.js` (modified, +55/-10)
```diff
@@ -1,22 +1,25 @@
 import React, {useEffect, useRef, useState} from "react";
 import {removeTab, openNewTab, createInternalId, getUserClick} from "@/utils/utils";
 import Image from "next/image";
-import {fetchApiKey, storeModel, verifyEndPoint} from "@/pages/api/DashboardService";
+import {fetchApiKey, storeModel, testModel, verifyEndPoint} from "@/pages/api/DashboardService";
 import {BeatLoader, ClipLoader} from "react-spinners";
 import {ToastContainer, toast} from 'react-toastify';
 
-export default function ModelForm({internalId, getModels, sendModelData}){
-    const models = ['OpenAI', 'Replicate', 'Hugging Face', 'Google Palm'];
+export default function ModelForm({internalId, getModels, sendModelData, env}){
+    const models = env === 'DEV' ? ['OpenAI', 'Replicate', 'Hugging Face', 'Google Palm', 'Local LLM'] : ['OpenAI', 'Replicate', 'Hugging Face', 'Google Palm'];
     const [selectedModel, setSelectedModel] = useState('Select a Model');
     const [modelName, setModelName] = useState('');
     const [modelDescription, setModelDescription] = useState('');
     const [modelTokenLimit, setModelTokenLimit] = useState(4096);
     const [modelEndpoint, setModelEndpoint] = useState('');
     const [modelDropdown, setModelDropdown] = useState(false);
     const [modelVersion, setModelVersion] = useState('');
+    const [modelContextLength, setContextLength] = useState(4096);
     const [tokenError, setTokenError] = useState(false);
     const [lockAddition, setLockAddition] = useState(true);
     const [isLoading, setIsLoading] = useState(false)
+    const [modelStatus, setModelStatus] = useState(null);
+    const [createClickable, setCreateClickable] = useState(true);
     const modelRef = useRef(null);
 
     useEffect(() => {
@@ -79,13 +82,31 @@ export default function ModelForm({internalId, getModels, sendModelData}){
         })
     }
 
+    const handleModelStatus = async () => {
+        try {
+            setCreateClickable(false);
+            const response = await testModel();
+            if(response.status === 200) {
+                setModelStatus(true);
+                setCreateClickable(true);
+            } else {
+                setModelStatus(false);
+                setCreateClickable(true);
+            }
+        } catch(error) {
+            console.log("Error Message:: " + error);
+            setModelStatus(false);
+            setCreateClickable(true);
+        }
+    }
+
     const handleModelSuccess = (model) => {
         model.contentType = 'Model'
         sendModelData(model)
     }
 
     const storeModelDetails = (modelProviderId) => {
-        storeModel(modelName,modelDescription, modelEndpoint, modelProviderId, modelTokenLimit, "Custom", modelVersion).then((response) =>{
+        storeModel(modelName,modelDescription, modelEndpoint, modelProviderId, modelTokenLimit, "Custom", modelVersion, modelContextLength).then((response) =>{
             setIsLoading(false)
             let data = response.data
             if (data.error) {
@@ -153,18 +174,42 @@ export default function ModelForm({internalId, getModels, sendModelData}){
                        onChange={(event) => setModelVersion(event.target.value)}/>
             </div>}
 
+            {(selectedModel === 'Local LLM') && <div className="mt_24">
+                <span>Model Context Length</span>
+                <input className="input_medium mt_8" type="number" placeholder="Enter Model Context Length" value={modelContextLength}
+                       onChange={(event) => setContextLength(event.target.value)}/>
+            </div>}
+
             <div className="mt_24">
                 <span>Token Limit</span>
                 <input className="input_medium mt_8" type="number" placeholder="Enter Model Token Limit" value={modelTokenLimit}
                        onChange={(event) => setModelTokenLimit(parseInt(event.target.value, 10))}/>
             </div>
 
-            <div className="horizontal_container justify_end mt_24">
-                <button className="secondary_button mr_7"
-                        onClick={() => removeTab(-5, "new model", "Add_Model", internalId)}>Cancel</button>
-                <button className='primary_button' onClick={handleAddModel} disabled={lockAddition || isLoading}>
-                    {isLoading ? <><span>Adding Model &nbsp;</span><ClipLoader size={16} color={"#000000"} /></> : 'Add Model'}
-                </button>
+            {modelStatus===false && <div className="horizontal_container align_start error_box mt_24 gap_6">
+                <Image width={16} height={16} src="/images/icon_error.svg" alt="error-icon" />
+                <div className="vertical_containers">
+                    <span className="text_12 color_white lh_16">Test model failed</span>
+                </div>
+            </div>}
+
+            {modelStatus===true && <div className="horizontal_container align_start success_box mt_24 gap_6">
+                <Image width={16} height={16} src
```

**File**: `gui/pages/Dashboard/Content.js` (modified, +1/-1)
```diff
@@ -470,7 +470,7 @@ export default function Content({env, selectedView, selectedProjectId, organisat
                                      organisationId={organisationId} sendKnowledgeData={addTab}
                                      sendAgentData={addTab} selectedProjectId={selectedProjectId} editAgentId={tab.id}
                                      fetchAgents={getAgentList} toolkits={toolkits} template={null} edit={true} agents={agents}/>}
-                    {tab.contentType === 'Add_Model' && <AddModel internalId={tab.internalId} getModels={getModels} sendModelData={addTab}/>}
+                    {tab.contentType === 'Add_Model' && <AddModel internalId={tab.internalId} getModels={getModels} sendModelData={addTab} env={env}/>}
                     {tab.contentType === 'Model' && <ModelDetails modelId={tab.id} modelName={tab.name} />}
                   </div>}
                 </div>
```

**File**: `gui/pages/_app.css` (modified, +10/-60)
```diff
@@ -231,18 +231,6 @@ input[type="range"]::-moz-range-track {
     z-index: 10;
 }
 
-.dropdown_container_models {
-    flex-direction: column;
-    align-items: flex-start;
-    border-radius: 8px;
-    background: #2E293F;
-    box-shadow: -2px 2px 24px rgba(0, 0, 0, 0.4);
-    position: absolute;
-    width: fit-content;
-    height: fit-content;
-    padding: 8px;
-}
-
 .dropdown_container {
     width: 150px;
     height: auto;
@@ -783,7 +771,6 @@ p {
 .mt_74{margin-top: 74px;}
 .mt_80{margin-top: 80px;}
 .mt_90{margin-top: 90px;}
-.mt_130{margin-top: 130px;}
 
 .mb_1{margin-bottom: 1px;}
 .mb_2{margin-bottom: 2px;}
@@ -991,22 +978,6 @@ p {
     line-height: normal;
 }
 
-.text_20 {
-    color: #FFF;
-    font-size: 20px;
-    font-style: normal;
-    font-weight: 400;
-    line-height: normal;
-}
-
-.text_20 {
-    color: #FFF;
-    font-size: 20px;
-    font-style: normal;
-    font-weight: 400;
-    line-height: normal;
-}
-
 .text_20_bold{
     color: #FFF;
     font-size: 20px;
@@ -1107,7 +1078,6 @@ p {
 .w_73{width: 73%}
 .w_97{width: 97%}
 .w_100{width: 100%}
-.w_99vw{width: 99vw}
 .w_inherit{width: inherit}
 .w_fit_content{width:fit-content}
 .w_inherit{width: inherit}
@@ -1125,11 +1095,11 @@ p {
 .h_80vh{height: 80vh}
 .h_calc92{height: calc(100vh - 92px)}
 .h_calc_add40{height: calc(80vh + 40px)}
-.h_calc_sub_60{height: calc(92.5vh - 60px)}
 
 .mxh_78vh{max-height: 78vh}
 
 .flex_dir_col{flex-direction: column}
+.flex_none{flex: none}
 
 .justify_center{justify-content: center}
 .justify_end{justify-content: flex-end}
@@ -1138,8 +1108,6 @@ p {
 
 .display_flex{display: inline-flex}
 .display_flex_container{display: flex}
-.display_none{display: none}
-.display_block{display: block}
 
 .align_center{align-items: center}
 .align_start{align-items: flex-start}
@@ -1178,8 +1146,6 @@ p {
 
 .bt_white{border-top: 1px solid rgba(255, 255, 255, 0.08);}
 
-.bt_white{border-top: 1px solid rgba(255, 255, 255, 0.08);}
-
 .color_white{color:#FFFFFF}
 .color_gray{color:#888888}
 
@@ -1188,7 +1154,7 @@ p {
 .lh_18{line-height: 18px;}
 .lh_24{line-height: 24px;}
 
-.padding_0{padding: 0}
+.padding_0{padding: 0;}
 .padding_5{padding: 5px;}
 .padding_6{padding: 6px;}
 .padding_8{padding: 8px;}
@@ -1505,7 +1471,6 @@ tr{
 .bg_none{background: none;}
 .bg_primary{background: #2E293F;}
 .bg_secondary{background: #272335;}
-.bg_none{background: none}
 
 .container {
     height: 100%;
@@ -1871,6 +1836,13 @@ tr{
     padding: 12px;
 }
 
+.success_box{
+    border-radius: 8px;
+    padding: 12px;
+    border-left: 4px solid rgba(255, 255, 255, 0.60);
+    background: rgba(255, 255, 255, 0.08);
+}
+
 .horizontal_line {
     margin: 16px 0 16px -16px;
     border: 1px solid #ffffff20;
@@ -1922,26 +1894,4 @@ tr{
 .tooltip-class {
     background-color: green;
     border-radius: 6px;
-}
-
-.text_dropdown {
-    color: #FFFFFF;
-    font-family: Plus Jakarta Sans, sans-serif;
-    font-style: normal;
-    font-weight: 500;
-    line-height: normal;
-}
-
-.text_dropdown_18 {
-    font-size: 18px;
-}
-
-.vertical_divider {
-    background: transparent;
-    /*border-color: rgba(255, 255, 255, 0.08);*/
-    border: 1.2px solid rgba(255, 255, 255, 0.08);;
-    height: 20px;
-    width: 0;
-}
-
-
+}
\ No newline at end of file
```

**File**: `gui/pages/api/DashboardService.js` (modified, +6/-3)
```diff
@@ -358,8 +358,12 @@ export const verifyEndPoint = (model_api_key, end_point, model_provider) => {
   });
 }
 
-export const storeModel = (model_name, description, end_point, model_provider_id, token_limit, type, version) => {
-  return api.post(`/models_controller/store_model`,{model_name, description, end_point, model_provider_id, token_limit, type, version});
+export const storeModel = (model_name, description, end_point, model_provider_id, token_limit, type, version, context_length) => {
+  return api.post(`/models_controller/store_model`,{model_name, description, end_point, model_provider_id, token_limit, type, version, context_length});
+}
+
+export const testModel = () => {
+  return api.get(`/models_controller/test_local_llm`);
 }
 
 export const fetchModels = () => {
@@ -389,7 +393,6 @@ export const getToolLogs = (toolName) => {
 export const publishTemplateToMarketplace = (agentData) => {
   return api.post(`/agent_templates/publish_template`, agentData);
 };
-
 export const getKnowledgeMetrics = (knowledgeName) => {
   return api.get(`analytics/knowledge/${knowledgeName}/usage`)
 }
```

**File**: `superagi/controllers/models_controller.py` (modified, +35/-2)
```diff
@@ -2,13 +2,15 @@
 from superagi.helper.auth import check_auth, get_user_organisation
 from superagi.helper.models_helper import ModelsHelper
 from superagi.apm.call_log_helper import CallLogHelper
+from superagi.lib.logger import logger
 from superagi.models.models import Models
 from superagi.models.models_config import ModelsConfig
 from superagi.config.config import get_config
 from superagi.controllers.types.models_types import ModelsTypes
 from fastapi_sqlalchemy import db
 import logging
 from pydantic import BaseModel
+from superagi.helper.llm_loader import LLMLoader
 
 router = APIRouter()
 
@@ -26,6 +28,7 @@ class StoreModelRequest(BaseModel):
     token_limit: int
     type: str
     version: str
+    context_length: int
 
 class ModelName (BaseModel):
     model: str
@@ -69,7 +72,9 @@ async def verify_end_point(model_api_key: str = None, end_point: str = None, mod
 @router.post("/store_model", status_code=200)
 async def store_model(request: StoreModelRequest, organisation=Depends(get_user_organisation)):
     try:
-        return Models.store_model_details(db.session, organisation.id, request.model_name, request.description, request.end_point, request.model_provider_id, request.token_limit, request.type, request.version)
+        #context_length = 4096
+        logger.info(request)
+        return Models.store_model_details(db.session, organisation.id, request.model_name, request.description, request.end_point, request.model_provider_id, request.token_limit, request.type, request.version, request.context_length)
     except Exception as e:
         logging.error(f"Error storing the Model Details: {str(e)}")
         raise HTTPException(status_code=500, detail="Internal Server Error")
@@ -164,4 +169,32 @@ def get_models_details(page: int = 0):
     marketplace_models = Models.fetch_marketplace_list(page)
     marketplace_models_with_install = Models.get_model_install_details(db.session, marketplace_models, organisation_id,
                                                                        ModelsTypes.MARKETPLACE.value)
-    return marketplace_models_with_install
\ No newline at end of file
+    return marketplace_models_with_install
+
+@router.get("/test_local_llm", status_code=200)
+def test_local_llm():
+    try:
+        llm_loader = LLMLoader(context_length=4096)
+        llm_model = llm_loader.model
+        llm_grammar = llm_loader.grammar
+        if llm_model is None:
+            logger.error("Model not found.")
+            raise HTTPException(status_code=404, detail="Error while loading the model. Please check your model path and try again.")
+        if llm_grammar is None:
+            logger.error("Grammar not found.")
+            raise HTTPException(status_code=404, detail="Grammar not found.")
+
+        messages = [
+            {"role":"system",
+             "content":"You are an AI assistant. Give response in a proper JSON format"},
+             {"role":"user",
+             "content":"Hi!"}
+        ]
+        response = llm_model.create_chat_completion(messages=messages, grammar=llm_grammar)
+        content = response["choices"][0]["message"]["content"]
+        logger.info(content)
+        return "Model loaded successfully."
+        
+    except Exception as e:
+        logger.info("Error: ",e)
+        raise HTTPException(status_code=404, detail="Error while loading the model. Please check your model path and try again.")
\ No newline at end of file
```

**File**: `superagi/helper/llm_loader.py` (modified, +1/-1)
```diff
@@ -35,4 +35,4 @@ def grammar(self):
                     "superagi/llms/grammar/json.gbnf")
             except Exception as e:
                 logger.error(e)
-        return self._grammar
+        return self._grammar
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #1575** (closed): Fix extension-less filenames never getting a .txt default (@Osamaali313)
- **PR #1494** (closed): Add News, Salesforce, and YouTube Toolkits (@zhaoshanren8808-ship-it)
- **PR #1487** (closed): Add Nory x402 payment toolkit for AI agent payments (@TheMemeBanker)
- **PR #1477** (closed): Improve SearX host selection using searx.space API (@Leoneldev2026)
- **PR #1472** (closed): Update auth.py (@Aryasb-art)
- **PR #1469** (closed): Request, Depends dependency fix (@nandal)
- **PR #1457** (closed): Copilot-workspace-84e (@dominikrsmn)
- **PR #1455** (closed): renamed config_template.yaml to config.yaml (@eddygk)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
