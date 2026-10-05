# Forensic Learning Record (Deep Inspection): openreplay/openreplay

> **Canonical Artifact**: `07_PROJECT_LEARNING/openreplay-openreplay-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/openreplay/openreplay](https://github.com/openreplay/openreplay))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:08:23.076Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `openreplay/openreplay`
- **Description**: Session replay, cobrowsing and product analytics you can self-host. Best for reproducing issues and iterating on your product.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12938 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/chalicelib/core/alerts/alerts.py`
```
import json
import logging
import time
from datetime import datetime

from decouple import config

import schemas
from chalicelib.core import notifications, webhook
from chalicelib.core.collaborations.collaboration_msteams import MSTeams
from chalicelib.core.collaborations.collaboration_slack import Slack
from chalicelib.utils import pg_client, helper, email_helper, smtp
from chalicelib.utils.TimeUTC import TimeUTC
from chalicelib.utils.log import sanitize
from starlette import status
from starlette.exceptions import HTTPException

logger = logging.getLogger(__name__)


def get(project_id, id):
    try:
        with pg_client.PostgresClient() as cur:
            cur.execute(
                cur.mogrify("""\
                    SELECT *
                    FROM public.alerts
                    WHERE alert_id =%(id)s AND project_id=%(project_id)s;""",
                            {"project_id": project_id, "id": id})
            )

            if cur.rowcount == 0:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found.")

            a = helper.dict_to_camel_case(cur.fetchone())

        return helper.custom_alert_to_front(__process_circular(a))
    except Exception as e:
        logger.error(f"Error fetching alert: {sanitize(str(e))}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found.")


def get_all(project_id):
    with pg_client.PostgresClient() as cur:
        query = cur.mogrify("""\
                    SELECT alerts.*,
                           COALESCE(metrics.name || '.' || (COALESCE(metric_series.name, 'series ' || index)) || '.count',
                                    query ->> 'left') AS series_name
                    FROM public.alerts
                         LEFT JOIN metric_series USING (series_id)
                         LEFT JOIN metrics USING (metric_id)
                    WHERE alerts.project_id =%(project_id)s
                        AND alerts.deleted_at ISNULL
                    ORDER BY alerts.created_at;""",
                            {"project_id": project_id})
        cur.execute(query=query)
        all = helper.list_to_camel_case(cur.fetchall())
    for i in range(len(all)):
        all[i] = helper.custom_alert_to_front(__process_circular(all[i]))
    return all


def __process_circular(alert):
    if alert is None:
        return None
    alert.pop("deletedAt")
    alert["createdAt"] = TimeUTC.datetime_to_timestamp(alert["createdAt"])
    return alert


def create(project_id, data: schemas.AlertSchema):
    data = data.model_dump()
    data["query"] = json.dumps(data["query"])
    data["options"] = json.dumps(data["options"])

    with pg_client.PostgresClient() as cur:
        cur.execute(
            cur.mogrify("""\
                    INSERT INTO public.alerts(project_id, name, description, detection_method, query, options, series_id, change)
                    VALUES (%(project_id)s, %(name)s, %(description)s, %(detection_method)s, %(query)s, %(options)s::jsonb, %(series_id)s, %(change)s)
                    RETURNING *;""",
                        {"project_id": project_id, **data})
        )
        a = helper.dict_to_camel_case(cur.fetchone())
    return {"data": helper.custom_alert_to_front(helper.dict_to_camel_case(__process_circular(a)))}


def update(project_id: int, id: int, data: schemas.AlertSchema):
    data = data.model_dump()
    data["query"] = json.dumps(data["query"])
    data["options"] = json.dumps(data["options"])

    try:
        with pg_client.PostgresClient() as cur:
            query = cur.mogrify("""\
                        UPDATE public.alerts
                        SET name = %(name)s,
                            description = %(description)s,
                            active = TRUE,
                            detection_method = %(detection_method)s,
                            query = %(query)s,
                            options = %(options)s,
                            series_id = %(series_id)s,
                            change = %(change)s
                        WHERE alert_id =%(id)s AND project_id = %(project_id)s AND deleted_at ISNULL 
                        RETURNING *;""",
                                {"project_id": project_id, "id": id, **data})
            cur.execute(query=query)

            if cur.rowcount == 0:
                raise ValueError(f"Alert with id {id} not found in project {project_id}.")

            a = helper.dict_to_camel_case(cur.fetchone())

        return {"data": helper.custom_alert_to_front(__process_circular(a))}
    except Exception as e:
        logger.error(f"Error updating alert: {sanitize(str(e))}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update alert.")


def process_notifications(data):
    full = {}
    for n in data:
        if "message" in n["options"]:
            webhook_data = {}
            if "data" in n["options"]:
                webhook_data = n["options"].pop("data")
            for c in n["options"].pop("message"):
                if c["type"] not in full:
                    full[c["type"]] = []
                if c["type"] in ["slack", "msteams", "email"]:
                    full[c["type"]].append({
                        "notification": n,
                        "destination": c["value"]
                    })
                elif c["type"] in ["webhook"]:
                    full[c["type"]].append({"data": webhook_data, "destination": c["value"]})
    notifications.create(data)
    BATCH_SIZE = 200
    for t in full.keys():
        for i in range(0, len(full[t]), BATCH_SIZE):
            notifications_list = full[t][i:min(i + BATCH_SIZE, len(full[t]))]
            if notifications_list is None or len(notifications_list) == 0:
                break

            if t == "slack":
                try:
                    send_to_slack_batch(notifications_list=notifications_list)
                except Exception as e:
                    logger.error("!!!Error while sending slack notifications batch")
                    logger.error(sanitize(str(e)))
            elif t == "msteams":
                try:
                    send_to_msteams_batch(notifications_list=notifications_list)
                except Exception as e:
                    logger.error("!!!Error while sending msteams notifications batch")
                    logger.error(sanitize(str(e)))
            elif t == "email":
                try:
                    send_by_email_batch(notifications_list=notifications_list)
                except Exception as e:
                    logger.error("!!!Error while sending email notifications batch")
                    logger.error(sanitize(str(e)))
            elif t == "webhook":
                try:
                    webhook.trigger_batch(data_list=notifications_list)
                except Exception as e:
                    logger.error("!!!Error while sending webhook notifications batch")
                    logger.error(sanitize(str(e)))


def send_by_email(notification, destination):
    if notification is None:
        return
    email_helper.alert_email(recipients=destination,
                             subject=f'"{notification["title"]}" has been triggered',
                             data={
                                 "message": f'"{notification["title"]}" {notification["description"]}',
                                 "project_id": notification["options"]["projectId"]})


def send_by_email_batch(notifications_list):
    if not smtp.has_smtp():
        logger.info("no SMTP configuration for email notifications")
    if notifications_list is None or len(notifications_list) == 0:
        logger.info("no email notifications")
        return
    for n in notifications_list:
        send_by_email(notification=n.get("notification"), destination=n.get("destination"))
        time.sleep(1)


def send_to_slack_batch(notifications_list):
    webhookId_map = {}
    for n in notifications_list:
        if n.get("destination") not in webhookId_map:
            webhookId_map[n.get("destination")] = {"tenantId": n["notification"]["tenantId"], "batch": []}
        webhookId_map[n.get("destination")]["batch"].append({"text": n["notification"]["description"] \
                                                                     + f"\n<{config('SITE_URL')}{n['notification']['buttonUrl']}|{n['notification']['buttonText']}>",
                                                             "title": n["notification"]["title"],
                                                             "title_link": n["notification"]["buttonUrl"],
                                                             "ts": datetime.now().timestamp()})
    for batch in webhookId_map.keys():
        Slack.send_batch(tenant_id=webhookId_map[batch]["tenantId"], webhook_id=batch,
                         attachments=webhookId_map[batch]["batch"])


def send_to_msteams_batch(notifications_list):
    webhookId_map = {}
    for n in notifications_list:
        if n.get("destination") not in webhookId_map:
            webhookId_map[n.get("destination")] = {"tenantId": n["notification"]["tenantId"], "batch": []}

        link = f"{config('SITE_URL')}{n['notification']['buttonUrl']}"
        # for MSTeams, the batch is the list of `sections`
        webhookId_map[n.get("destination")]["batch"].append(
            {
                "activityTitle": n["notification"]["title"],
                "activitySubtitle": f"On Project *{n['notification']['projectName']}*",
                "facts": [
                    {
                        "name": "Target:",
                        "value": link
                    },
                    {
                        "name": "Description:",
                        "value": n["notification"]["description"]
                    }],
                "markdown": True
            }
        )
    for batch in webhookId_map.keys():
      
```

### Core Architecture Module: `api/chalicelib/core/alerts/alerts_listener.py`
```
from chalicelib.core.alerts.modules import TENANT_ID
from chalicelib.utils import pg_client, helper


def get_all_alerts():
    with pg_client.PostgresClient(long_query=True) as cur:
        query = f"""SELECT {TENANT_ID} AS tenant_id,
                           alert_id,
                           projects.project_id,
                           projects.name AS project_name,
                           detection_method,
                           query,
                           options,
                           (EXTRACT(EPOCH FROM alerts.created_at) * 1000)::BIGINT AS created_at,
                           alerts.name,
                           alerts.series_id,
                           filter,
                           change,
                           COALESCE(metrics.name || '.' || (COALESCE(metric_series.name, 'series ' || index)) || '.count',
                                    query ->> 'left')                             AS series_name
                    FROM public.alerts
                             INNER JOIN projects USING (project_id)
                             LEFT JOIN metric_series USING (series_id)
                             LEFT JOIN metrics USING (metric_id)
                    WHERE alerts.deleted_at ISNULL
                      AND alerts.active
                      AND projects.active
                      AND projects.deleted_at ISNULL
                      AND (alerts.series_id ISNULL OR metric_series.deleted_at ISNULL)
                    ORDER BY alerts.created_at;"""
        cur.execute(query=query)
        all_alerts = helper.list_to_camel_case(cur.fetchall())
    return all_alerts

```

### Core Architecture Module: `api/chalicelib/core/alerts/alerts_processor.py`
```
import logging

from pydantic_core._pydantic_core import ValidationError

import schemas
from chalicelib.utils import pg_client, ch_client, exp_ch_helper
from chalicelib.utils.TimeUTC import TimeUTC
from chalicelib.core.alerts import alerts, alerts_listener
from chalicelib.core.alerts.modules import alert_helpers
from chalicelib.core.sessions import sessions_ch as sessions

logger = logging.getLogger(__name__)

LeftToDb = {
    schemas.AlertColumn.PERFORMANCE__DOM_CONTENT_LOADED__AVERAGE: {
        "table": lambda timestamp: f"{exp_ch_helper.get_main_events_table(timestamp)} AS pages",
        "formula": "COALESCE(AVG(NULLIF(CAST(`$properties`.dom_content_loaded_event_time AS Float32) ,0)),0)",
        "eventType": "LOCATION",
        "condition": "`$auto_captured`"
    },
    schemas.AlertColumn.PERFORMANCE__FIRST_MEANINGFUL_PAINT__AVERAGE: {
        "table": lambda timestamp: f"{exp_ch_helper.get_main_events_table(timestamp)} AS pages",
        "formula": "COALESCE(AVG(NULLIF(CAST(`$properties`.first_contentful_paint_time AS Float32),0)),0)",
        "eventType": "LOCATION",
"condition": "`$auto_captured`"
    },
    schemas.AlertColumn.PERFORMANCE__PAGE_LOAD_TIME__AVERAGE: {
        "table": lambda timestamp: f"{exp_ch_helper.get_main_events_table(timestamp)} AS pages",
        "formula": "AVG(NULLIF(CAST(`$properties`.load_event_time AS Float32) ,0))",
        "eventType": "LOCATION",
"condition": "`$auto_captured`"
    },
    schemas.AlertColumn.PERFORMANCE__DOM_BUILD_TIME__AVERAGE: {
        "table": lambda timestamp: f"{exp_ch_helper.get_main_events_table(timestamp)} AS pages",
        "formula": "AVG(NULLIF(CAST(`$properties`.dom_building_time AS Float32),0))",
        "eventType": "LOCATION",
"condition": "`$auto_captured`"
    },
    schemas.AlertColumn.PERFORMANCE__SPEED_INDEX__AVERAGE: {
        "table": lambda timestamp: f"{exp_ch_helper.get_main_events_table(timestamp)} AS pages",
        "formula": "AVG(NULLIF(speed_index,0))",
        "eventType": "LOCATION",
"condition": "`$auto_captured`"
    },
    schemas.AlertColumn.PERFORMANCE__PAGE_RESPONSE_TIME__AVERAGE: {
        "table": lambda timestamp: f"{exp_ch_helper.get_main_events_table(timestamp)} AS pages",
        "formula": "AVG(NULLIF(CAST(`$properties`.response_time AS Float32),0))",
        "eventType": "LOCATION",
"condition": "`$auto_captured`"
    },
    schemas.AlertColumn.PERFORMANCE__TTFB__AVERAGE: {
        "table": lambda timestamp: f"{exp_ch_helper.get_main_events_table(timestamp)} AS pages",
        "formula": "AVG(NULLIF(CAST(`$properties`.first_contentful_paint_time AS Float32),0))",
        "eventType": "LOCATION",
"condition": "`$auto_captured`"
    },
    schemas.AlertColumn.PERFORMANCE__TIME_TO_RENDER__AVERAGE: {
        "table": lambda timestamp: f"{exp_ch_helper.get_main_events_table(timestamp)} AS pages",
        "formula": "AVG(NULLIF(CAST(`$properties`.visually_complete AS Float32),0))",
        "eventType": "LOCATION",
"condition": "`$auto_captured`"
    },
    schemas.AlertColumn.PERFORMANCE__CRASHES__COUNT: {
        "table": lambda timestamp: f"{exp_ch_helper.get_main_sessions_table(timestamp)} AS sessions",
        "formula": "COUNT(DISTINCT session_id)",
        "condition": "duration>0 AND errors_count>0"
    },
    schemas.AlertColumn.ERRORS__JAVASCRIPT__COUNT: {
        "table": lambda timestamp: f"{exp_ch_helper.get_main_events_table(timestamp)} AS errors",
        "eventType": "ERROR",
        "formula": "COUNT(DISTINCT session_id)",
        "condition": "source='js_exception' AND `$auto_captured`"
    },
    schemas.AlertColumn.ERRORS__BACKEND__COUNT: {
        "table": lambda timestamp: f"{exp_ch_helper.get_main_events_table(timestamp)} AS errors",
        "eventType": "ERROR",
        "formula": "COUNT(DISTINCT session_id)",
        "condition": "source!='js_exception' AND `$auto_captured`"
    },
}


def Build(a):
    now = TimeUTC.now()
    params = {"project_id": a["projectId"], "now": now}
    full_args = {}
    if a["seriesId"] is not None:
        a["filter"]["sort"] = "session_id"
        a["filter"]["order"] = schemas.SortOrderType.DESC
        a["filter"]["startDate"] = 0
        a["filter"]["endDate"] = TimeUTC.now()
        try:
            data = schemas.SessionsSearchPayloadSchema.model_validate(a["filter"])
        except ValidationError:
            logger.warning("Validation error for:")
            logger.warning(a["filter"])
            raise

        full_args, query_part = sessions.search_query_parts_ch(data=data, error_status=None, errors_only=False,
                                                               issue=None, project_id=a["projectId"], user_id=None,
                                                               favorite_only=False)
        subQ = f"""SELECT COUNT(session_id) AS value 
                {query_part}"""
    else:
        colDef = LeftToDb[a["query"]["left"]]
        params["event_type"] = LeftToDb[a["query"]["left"]].get("eventType")
        subQ = f"""SELECT {colDef["formula"]} AS value
                    FROM {colDef["table"](now)}
                    WHERE project_id = %(project_id)s 
                        {"AND event_type=%(event_type)s" if params["event_type"] else ""} 
                        {"AND " + colDef["condition"] if colDef.get("condition") else ""}"""

    q = f"""SELECT coalesce(value,0) AS value, coalesce(value,0) {a["query"]["operator"]} {a["query"]["right"]} AS valid"""

    if a["detectionMethod"] == schemas.AlertDetectionMethod.THRESHOLD:
        if a["seriesId"] is not None:
            q += f""" FROM ({subQ}) AS stat"""
        else:
            q += f""" FROM ({subQ} 
                            AND datetime>=toDateTime(%(startDate)s/1000) 
                            AND datetime<=toDateTime(%(now)s/1000) ) AS stat"""
        params = {**params, **full_args, "startDate": TimeUTC.now() - a["options"]["currentPeriod"] * 60 * 1000}
    else:
        if a["change"] == schemas.AlertDetectionType.CHANGE:
            if a["seriesId"] is not None:
                sub2 = subQ.replace("%(startDate)s", "%(timestamp_sub2)s").replace("%(endDate)s", "%(startDate)s")
                sub1 = f"SELECT (({subQ})-({sub2})) AS value"
                q += f" FROM ( {sub1} ) AS stat"
                params = {**params, **full_args,
                          "startDate": TimeUTC.now() - a["options"]["currentPeriod"] * 60 * 1000,
                          "timestamp_sub2": TimeUTC.now() - 2 * a["options"]["currentPeriod"] * 60 * 1000}
            else:
                sub1 = f"""{subQ} AND datetime>=toDateTime(%(startDate)s/1000)
                                    AND datetime<=toDateTime(%(now)s/1000)"""
                params["startDate"] = TimeUTC.now() - a["options"]["currentPeriod"] * 60 * 1000
                sub2 = f"""{subQ} AND datetime<toDateTime(%(startDate)s/1000) 
                                    AND datetime>=toDateTime(%(timestamp_sub2)s/1000)"""
                params["timestamp_sub2"] = TimeUTC.now() - 2 * a["options"]["currentPeriod"] * 60 * 1000
                sub1 = f"SELECT (( {sub1} )-( {sub2} )) AS value"
                q += f" FROM ( {sub1} ) AS stat"

        else:
            if a["seriesId"] is not None:
                sub2 = subQ.replace("%(startDate)s", "%(timestamp_sub2)s").replace("%(endDate)s", "%(startDate)s")
                sub1 = f"SELECT (({subQ})/NULLIF(({sub2}),0)-1)*100 AS value"
                q += f" FROM ({sub1}) AS stat"
                params = {**params, **full_args,
                          "startDate": TimeUTC.now() - a["options"]["currentPeriod"] * 60 * 1000,
                          "timestamp_sub2": TimeUTC.now() \
                                            - (a["options"]["currentPeriod"] + a["options"]["currentPeriod"]) \
                                            * 60 * 1000}
            else:
                sub1 = f"""{subQ} AND datetime>=toDateTime(%(startDate)s/1000)
                                AND datetime<=toDateTime(%(now)s/1000)"""
                params["startDate"] = TimeUTC.now() - a["options"]["currentPeriod"] * 60 * 1000
                sub2 = f"""{subQ} AND datetime<toDateTime(%(startDate)s/1000)
                                AND datetime>=toDateTime(%(timestamp_sub2)s/1000)"""
                params["timestamp_sub2"] = TimeUTC.now() \
                                           - (a["options"]["currentPeriod"] + a["options"]["currentPeriod"]) * 60 * 1000
                sub1 = f"SELECT (({sub1})/NULLIF(({sub2}),0)-1)*100 AS value"
                q += f" FROM ({sub1}) AS stat"

    return q, params


def process():
    logger.info("> processing alerts on CH")
    notifications = []
    all_alerts = alerts_listener.get_all_alerts()
    with pg_client.PostgresClient() as cur, ch_client.ClickHouseClient() as ch_cur:
        for alert in all_alerts:
            if alert["query"]["left"] != "CUSTOM":
                continue
            if alert_helpers.can_check(alert):
                query, params = Build(alert)
                try:
                    query = ch_cur.format(query=query, parameters=params)
                except Exception as e:
                    logger.error(
                        f"!!!Error while building alert query for alertId:{alert['alertId']} name: {alert['name']}")
                    logger.error(e)
                    continue
                logger.debug(alert)
                logger.debug(query)
                try:
                    # result = ch_cur.execute(query=query)
                    result = 0
                    if len(result) > 0:
                        result = result[0]

                    if result["valid"]:
                        logger.info("Valid alert, notifying users")
                        notifications.append(alert_helpers.generate_notification(alert, result))
                except Exception as e:
                    logger.error(f"!!!Error while running alert query for alertId:{alert['alertId']}")
           
```

### Core Architecture Module: `api/chalicelib/core/alerts/modules/__init__.py`
```
TENANT_ID = "-1"

from . import helpers as alert_helpers

```

### Core Architecture Module: `api/chalicelib/core/alerts/modules/helpers.py`
```
import decimal
import logging

import schemas
from chalicelib.utils.TimeUTC import TimeUTC

logger = logging.getLogger(__name__)
# This is the frequency of execution for each threshold
TimeInterval = {
    15: 3,
    30: 5,
    60: 10,
    120: 20,
    240: 30,
    1440: 60,
}


def __format_value(x):
    if x % 1 == 0:
        x = int(x)
    else:
        x = round(x, 2)
    return f"{x:,}"


def can_check(a) -> bool:
    now = TimeUTC.now()

    repetitionBase = a["options"]["currentPeriod"] \
        if a["detectionMethod"] == schemas.AlertDetectionMethod.CHANGE \
           and a["options"]["currentPeriod"] > a["options"]["previousPeriod"] \
        else a["options"]["previousPeriod"]

    if TimeInterval.get(repetitionBase) is None:
        logger.error(f"repetitionBase: {repetitionBase} NOT FOUND")
        return False

    return (a["options"]["renotifyInterval"] <= 0 or
            a["options"].get("lastNotification") is None or
            a["options"]["lastNotification"] <= 0 or
            ((now - a["options"]["lastNotification"]) > a["options"]["renotifyInterval"] * 60 * 1000)) \
        and ((now - a["createdAt"]) % (TimeInterval[repetitionBase] * 60 * 1000)) < 60 * 1000


def generate_notification(alert, result):
    left = __format_value(result['value'])
    right = __format_value(alert['query']['right'])
    return {
        "alertId": alert["alertId"],
        "tenantId": alert["tenantId"],
        "title": alert["name"],
        "description": f"{alert['seriesName']} = {left} ({alert['query']['operator']} {right}).",
        "buttonText": "Check metrics for more details",
        "buttonUrl": f"/{alert['projectId']}/metrics",
        "imageUrl": None,
        "projectId": alert["projectId"],
        "projectName": alert["projectName"],
        "options": {"source": "ALERT", "sourceId": alert["alertId"],
                    "sourceMeta": alert["detectionMethod"],
                    "message": alert["options"]["message"], "projectId": alert["projectId"],
                    "data": {"title": alert["name"],
                             "limitValue": alert["query"]["right"],
                             "actualValue": float(result["value"]) \
                                 if isinstance(result["value"], decimal.Decimal) \
                                 else result["value"],
                             "operator": alert["query"]["operator"],
                             "trigger": alert["query"]["left"],
                             "alertId": alert["alertId"],
                             "detectionMethod": alert["detectionMethod"],
                             "currentPeriod": alert["options"]["currentPeriod"],
                             "previousPeriod": alert["options"]["previousPeriod"],
                             "createdAt": TimeUTC.now()}},
    }

```

### Core Architecture Module: `api/chalicelib/core/announcements.py`
```
from chalicelib.utils import pg_client
from chalicelib.utils import helper
from decouple import config
from chalicelib.utils.TimeUTC import TimeUTC


def get_all(user_id):
    with pg_client.PostgresClient() as cur:
        query = cur.mogrify("""
        SELECT a.*, u.last >= (EXTRACT(EPOCH FROM a.created_at)*1000) AS viewed
        FROM public.announcements AS a,
             (SELECT COALESCE(CAST(data ->> 'lastAnnouncementView' AS bigint), 0)
              FROM public.users
              WHERE user_id = %(userId)s
              LIMIT 1) AS u(last)
        ORDER BY a.created_at DESC;""",
                            {"userId": user_id})
        cur.execute(
            query
        )
        announcements = helper.list_to_camel_case(cur.fetchall())
        for a in announcements:
            a["createdAt"] = TimeUTC.datetime_to_timestamp(a["createdAt"])
            if a["imageUrl"] is not None and len(a["imageUrl"]) > 0:
                a["imageUrl"] = config("announcement_url") + a["imageUrl"]
        return announcements


def view(user_id):
    with pg_client.PostgresClient() as cur:
        query = cur.mogrify("""
        UPDATE public.users
        SET data=data ||
                 ('{"lastAnnouncementView":' ||
                  (EXTRACT(EPOCH FROM timezone('utc'::text, now())) * 1000)::bigint - 20 * 000 ||
                  '}')::jsonb
        WHERE user_id = %(userId)s;""",
                            {"userId": user_id})
        cur.execute(
            query
        )
    return True

```

### Core Architecture Module: `api/chalicelib/core/assist.py`
```
import logging
from os import access, R_OK
from os.path import exists as path_exists, getsize

import jwt
import requests
from decouple import config
from fastapi import HTTPException, status

import schemas
from chalicelib.core import projects
from chalicelib.utils.TimeUTC import TimeUTC
from chalicelib.utils.log import sanitize

logger = logging.getLogger(__name__)

ASSIST_KEY = config("ASSIST_KEY")
ASSIST_URL = config("ASSIST_URL") % ASSIST_KEY


def get_live_sessions_ws_user_id(project_id, user_id):
    data = {
        "filter": {"userId": user_id} if user_id else {}
    }
    return __get_live_sessions_ws(project_id=project_id, data=data)


def get_live_sessions_ws_test_id(project_id, test_id):
    data = {
        "filter": {
            'uxtId': test_id,
            'operator': 'is'
        }
    }
    return __get_live_sessions_ws(project_id=project_id, data=data)


def get_live_sessions_ws(project_id, body: schemas.LiveSessionsSearchPayloadSchema):
    data = {
        "filter": {},
        "pagination": {"limit": body.limit, "page": body.page},
        "sort": {"key": body.sort, "order": body.order}
    }
    for f in body.filters:
        if f.name == schemas.LiveFilterType.METADATA:
            data["filter"][f.source] = {"values": f.value, "operator": f.operator}

        else:
            data["filter"][f.name] = {"values": f.value, "operator": f.operator}
    return __get_live_sessions_ws(project_id=project_id, data=data)


def __get_live_sessions_ws(project_id, data):
    project_key = projects.get_project_key(project_id)
    try:
        results = requests.post(ASSIST_URL + config("assist") + f"/{project_key}",
                                json=data, timeout=config("assistTimeout", cast=int, default=5))
        if results.status_code != 200:
            logger.error(f"!! issue with the peer-server code:{results.status_code} for __get_live_sessions_ws")
            logger.error(sanitize(results.text))
            return {"total": 0, "sessions": []}
        live_peers = results.json().get("data", [])
    except requests.exceptions.Timeout:
        logger.error("!! Timeout getting Assist response")
        live_peers = {"total": 0, "sessions": []}
    except Exception as e:
        logger.error("!! Issue getting Live-Assist response")
        logger.exception(e)
        logger.error("expected JSON, received:")
        try:
            logger.error(sanitize(results.text))
        except:
            logger.error("couldn't get response")
        live_peers = {"total": 0, "sessions": []}
    _live_peers = live_peers
    if "sessions" in live_peers:
        _live_peers = live_peers["sessions"]
    for s in _live_peers:
        s["live"] = True
        s["projectId"] = project_id
        if "projectID" in s:
            s.pop("projectID")
    return live_peers


def __get_agent_token(project_id, project_key, session_id):
    iat = TimeUTC.now()
    return jwt.encode(
        payload={
            "projectKey": project_key,
            "projectId": project_id,
            "sessionId": session_id,
            "iat": iat // 1000,
            "exp": iat // 1000 + config("ASSIST_JWT_EXPIRATION", cast=int) + TimeUTC.get_utc_offset() // 1000,
            "iss": config("JWT_ISSUER"),
            "aud": f"openreplay:agent"
        },
        key=config("ASSIST_JWT_SECRET"),
        algorithm=config("JWT_ALGORITHM")
    )


def get_live_session_by_id(project_id, session_id):
    project_key = projects.get_project_key(project_id)
    try:
        results = requests.get(ASSIST_URL + config("assist") + f"/{project_key}/{session_id}",
                               timeout=config("assistTimeout", cast=int, default=5))
        if results.status_code != 200:
            logger.error(f"!! issue with the peer-server code:{results.status_code} for get_live_session_by_id")
            logger.error(sanitize(results.text))
            return None
        results = results.json().get("data")
        if results is None:
            return None
        results["live"] = True
        results["agentToken"] = __get_agent_token(project_id=project_id, project_key=project_key, session_id=session_id)
    except requests.exceptions.Timeout:
        logger.error("!! Timeout getting Assist response")
        return None
    except Exception as e:
        logger.error("!! Issue getting Assist response")
        logger.exception(e)
        logger.error("expected JSON, received:")
        try:
            logger.error(sanitize(results.text))
        except:
            logger.error("couldn't get response")
        return None
    return results


def is_live(project_id, session_id, project_key=None):
    if project_key is None:
        project_key = projects.get_project_key(project_id)
    try:
        results = requests.get(ASSIST_URL + config("assistList") + f"/{project_key}/{session_id}",
                               timeout=config("assistTimeout", cast=int, default=5))
        if results.status_code != 200:
            logger.error(f"!! issue with the peer-server code:{results.status_code} for is_live")
            logger.error(sanitize(results.text))
            return False
        results = results.json().get("data")
    except requests.exceptions.Timeout:
        logger.error("!! Timeout getting Assist response")
        return False
    except Exception as e:
        logger.error("!! Issue getting Assist response")
        logger.exception(e)
        logger.error("expected JSON, received:")
        try:
            logger.error(sanitize(results.text))
        except:
            logger.error("couldn't get response")
        return False
    return str(session_id) == results


def autocomplete(project_id, q: str, key: str = None):
    project_key = projects.get_project_key(project_id)
    params = {"q": q}
    if key:
        params["key"] = key
    try:
        results = requests.get(
            ASSIST_URL + config("assistList") + f"/{project_key}/autocomplete",
            params=params, timeout=config("assistTimeout", cast=int, default=5))
        if results.status_code != 200:
            logger.error(f"!! issue with the peer-server code:{results.status_code} for autocomplete")
            logger.error(sanitize(results.text))
            return {"errors": [f"Something went wrong wile calling assist:{results.text}"]}
        results = results.json().get("data", [])
    except requests.exceptions.Timeout:
        logger.error("!! Timeout getting Assist response")
        return {"errors": ["Assist request timeout"]}
    except Exception as e:
        logger.error("!! Issue getting Assist response")
        logger.exception(e)
        logger.error("expected JSON, received:")
        try:
            logger.error(sanitize(results.text))
        except:
            logger.error("couldn't get response")
        return {"errors": ["Something went wrong wile calling assist"]}
    for r in results:
        r["type"] = __change_keys(r["type"])
    return {"data": results}


def __get_efs_path():
    efs_path = config("FS_DIR")
    if not path_exists(efs_path):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"EFS not found in path: {efs_path}")

    if not access(efs_path, R_OK):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"EFS found under: {efs_path}; but it is not readable, please check permissions")
    return efs_path


def __get_mob_path(project_id, session_id):
    params = {"projectId": project_id, "sessionId": session_id}
    return config("EFS_SESSION_MOB_PATTERN", default="%(sessionId)s") % params


def get_raw_mob_by_id(project_id, session_id):
    efs_path = __get_efs_path()
    path_to_file = efs_path + "/" + __get_mob_path(project_id=project_id, session_id=session_id)
    if path_exists(path_to_file):
        if not access(path_to_file, R_OK):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Replay file found under: {efs_path};" +
                                       " but it is not readable, please check permissions")
        # getsize return size in bytes, UNPROCESSED_MAX_SIZE is in Kb
        if (getsize(path_to_file) / 1000) >= config("UNPROCESSED_MAX_SIZE", cast=int, default=200 * 1000):
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Replay file too large")
        return path_to_file

    return None


def __get_devtools_path(project_id, session_id):
    params = {"projectId": project_id, "sessionId": session_id}
    return config("EFS_DEVTOOLS_MOB_PATTERN", default="%(sessionId)s") % params


def get_raw_devtools_by_id(project_id, session_id):
    efs_path = __get_efs_path()
    path_to_file = efs_path + "/" + __get_devtools_path(project_id=project_id, session_id=session_id)
    if path_exists(path_to_file):
        if not access(path_to_file, R_OK):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Devtools file found under: {efs_path};"
                                       " but it is not readable, please check permissions")

        return path_to_file

    return None


def session_exists(project_id, session_id):
    project_key = projects.get_project_key(project_id)
    try:
        results = requests.get(ASSIST_URL + config("assist") + f"/{project_key}/{session_id}",
                               timeout=config("assistTimeout", cast=int, default=5))
        if results.status_code != 200:
            logger.error(f"!! issue with the peer-server code:{results.status_code} for session_exists")
            logger.error(sanitize(results.text))
            return None
        results = results.json().get("data")
        if results is None:
            return False
        return True
    except requests.exceptions.Timeout:
        logger.error("!! Timeout getting Assist response")
        return False
    except Exception as e:
        logger.
```

### Core Architecture Module: `api/chalicelib/core/authorizers.py`
```
import logging

import jwt
from decouple import config

from chalicelib.core import tenants
from chalicelib.core import users, spot
from chalicelib.utils.TimeUTC import TimeUTC
from chalicelib.utils.log import sanitize

logger = logging.getLogger(__name__)


def get_supported_audience():
    return [users.AUDIENCE, spot.AUDIENCE]


def is_spot_token(token: str) -> bool:
    try:
        if len(token) < 5 or "." not in token:
            return False
        decoded_token = jwt.decode(token, options={"verify_signature": False, "verify_exp": False})
        audience = decoded_token.get("aud")
        return audience == spot.AUDIENCE
    except jwt.InvalidTokenError:
        logger.error(f"Invalid token for is_spot_token: {sanitize(token, max_length=16)}...")
        raise


def jwt_authorizer(scheme: str, token: str, leeway=0) -> dict | None:
    if scheme.lower() != "bearer" or len(token) < 5 or "." not in token:
        return None
    if not token or token.count(".") != 2:
        logger.debug("! JWT Malformed token")
        return None
    try:
        payload = jwt.decode(jwt=token,
                             key=config("JWT_SECRET") if not is_spot_token(token) else config("JWT_SPOT_SECRET"),
                             algorithms=config("JWT_ALGORITHM"),
                             audience=get_supported_audience(),
                             leeway=leeway)
    except jwt.ExpiredSignatureError:
        logger.debug("! JWT Expired signature")
        return None
    except jwt.exceptions.InvalidSignatureError:
        logger.warning("! JWT Signature verification failed")
        return None
    except BaseException as e:
        logger.warning("! JWT Base Exception", exc_info=e)
        return None
    return payload


def jwt_refresh_authorizer(scheme: str, token: str):
    if scheme.lower() != "bearer" or len(token) < 5 or "." not in token:
        return None
    if not token or token.count(".") != 2:
        logger.debug("! JWT-refresh Malformed token")
        logger.debug(token)
        return None
    try:
        payload = jwt.decode(jwt=token,
                             key=config("JWT_REFRESH_SECRET") if not is_spot_token(token) \
                                 else config("JWT_SPOT_REFRESH_SECRET"),
                             algorithms=config("JWT_ALGORITHM"),
                             audience=get_supported_audience())
    except jwt.ExpiredSignatureError:
        logger.debug("! JWT-refresh Expired signature")
        return None
    except jwt.exceptions.InvalidSignatureError:
        logger.warning("! JWT-refresh Signature verification failed")
        return None
    except BaseException as e:
        logger.error("! JWT-refresh Base Exception", exc_info=e)
        return None
    return payload


def generate_jwt(user_id, tenant_id, iat, aud, for_spot=False):
    token = jwt.encode(
        payload={
            "userId": user_id,
            "tenantId": tenant_id,
            "exp": iat + (config("JWT_EXPIRATION", cast=int) if not for_spot
                          else config("JWT_SPOT_EXPIRATION", cast=int)),
            "iss": config("JWT_ISSUER"),
            "iat": iat,
            "aud": aud
        },
        key=config("JWT_SECRET") if not for_spot else config("JWT_SPOT_SECRET"),
        algorithm=config("JWT_ALGORITHM")
    )
    return token


def generate_jwt_refresh(user_id, tenant_id, iat, aud, jwt_jti, for_spot=False):
    token = jwt.encode(
        payload={
            "userId": user_id,
            "tenantId": tenant_id,
            "exp": iat + (config("JWT_REFRESH_EXPIRATION", cast=int) if not for_spot
                          else config("JWT_SPOT_REFRESH_EXPIRATION", cast=int)),
            "iss": config("JWT_ISSUER"),
            "iat": iat,
            "aud": aud,
            "jti": jwt_jti
        },
        key=config("JWT_REFRESH_SECRET") if not for_spot else config("JWT_SPOT_REFRESH_SECRET"),
        algorithm=config("JWT_ALGORITHM")
    )
    return token


def api_key_authorizer(token):
    t = tenants.get_by_api_key(token)
    if t is not None:
        t["createdAt"] = TimeUTC.datetime_to_timestamp(t["createdAt"])
    return t

```

### Core Architecture Module: `api/chalicelib/core/boarding.py`
```
from cachetools import TTLCache, cached

from chalicelib.core import projects
from chalicelib.core import users
from chalicelib.core.log_tools import datadog, stackdriver, sentry
from chalicelib.core.modules import TENANT_CONDITION
from chalicelib.utils import pg_client

cache = TTLCache(maxsize=1000, ttl=180)


@cached(cache)
def get_state(tenant_id):
    pids = projects.get_projects_ids(tenant_id=tenant_id)
    with pg_client.PostgresClient() as cur:
        recorded = False
        meta = False

        if len(pids) > 0:
            cur.execute(
                cur.mogrify(
                    """SELECT EXISTS((SELECT 1
                                      FROM public.sessions AS s
                                      WHERE s.project_id IN %(ids)s)) AS exists;""",
                    {"ids": tuple(pids)},
                )
            )
            recorded = cur.fetchone()["exists"]
            meta = False
            if recorded:
                query = cur.mogrify(
                    f"""SELECT EXISTS((SELECT 1
                               FROM public.projects AS p
                                        LEFT JOIN LATERAL ( SELECT 1
                                                            FROM public.sessions
                                                            WHERE sessions.project_id = p.project_id
                                                              AND sessions.user_id IS NOT NULL
                                                            LIMIT 1) AS sessions(user_id) ON (TRUE)
                               WHERE {TENANT_CONDITION} AND p.deleted_at ISNULL
                                 AND ( sessions.user_id IS NOT NULL OR p.metadata_1 IS NOT NULL
                                       OR p.metadata_2 IS NOT NULL OR p.metadata_3 IS NOT NULL
                                       OR p.metadata_4 IS NOT NULL OR p.metadata_5 IS NOT NULL
                                       OR p.metadata_6 IS NOT NULL OR p.metadata_7 IS NOT NULL
                                       OR p.metadata_8 IS NOT NULL OR p.metadata_9 IS NOT NULL
                                       OR p.metadata_10 IS NOT NULL )
                                   )) AS exists;""",
                    {"tenant_id": tenant_id},
                )
                cur.execute(query)

                meta = cur.fetchone()["exists"]

    return [
        {
            "task": "Install OpenReplay",
            "done": recorded,
            "URL": "https://docs.openreplay.com/getting-started/quick-start",
        },
        {
            "task": "Identify Users",
            "done": meta,
            "URL": "https://docs.openreplay.com/data-privacy-security/metadata",
        },
        {
            "task": "Invite Team Members",
            "done": len(users.get_members(tenant_id=tenant_id)) > 1,
            "URL": "https://app.openreplay.com/client/manage-users",
        },
        {
            "task": "Integrations",
            "done": len(datadog.get_all(tenant_id=tenant_id)) > 0
                    or len(sentry.get_all(tenant_id=tenant_id)) > 0
                    or len(stackdriver.get_all(tenant_id=tenant_id)) > 0,
            "URL": "https://docs.openreplay.com/integrations",
        },
    ]


def get_state_installing(tenant_id):
    pids = projects.get_projects_ids(tenant_id=tenant_id)
    with pg_client.PostgresClient() as cur:
        recorded = False

        if len(pids) > 0:
            cur.execute(
                cur.mogrify(
                    """SELECT EXISTS((SELECT 1
                                      FROM public.sessions AS s
                                      WHERE s.project_id IN %(ids)s)) AS exists;""",
                    {"ids": tuple(pids)},
                )
            )
            recorded = cur.fetchone()["exists"]

    return {
        "task": "Install OpenReplay",
        "done": recorded,
        "URL": "https://docs.openreplay.com/getting-started/quick-start",
    }


def get_state_identify_users(tenant_id):
    with pg_client.PostgresClient() as cur:
        query = cur.mogrify(
            f"""SELECT EXISTS((SELECT 1
                                       FROM public.projects AS p
                                                LEFT JOIN LATERAL ( SELECT 1
                                                                    FROM public.sessions
                                                                    WHERE sessions.project_id = p.project_id
                                                                      AND sessions.user_id IS NOT NULL
                                                                    LIMIT 1) AS sessions(user_id) ON (TRUE)
                                       WHERE {TENANT_CONDITION} AND p.deleted_at ISNULL
                                         AND ( sessions.user_id IS NOT NULL OR p.metadata_1 IS NOT NULL
                                               OR p.metadata_2 IS NOT NULL OR p.metadata_3 IS NOT NULL
                                               OR p.metadata_4 IS NOT NULL OR p.metadata_5 IS NOT NULL
                                               OR p.metadata_6 IS NOT NULL OR p.metadata_7 IS NOT NULL
                                               OR p.metadata_8 IS NOT NULL OR p.metadata_9 IS NOT NULL
                                               OR p.metadata_10 IS NOT NULL )
                                           )) AS exists;""",
            {"tenant_id": tenant_id},
        )
        cur.execute(query)

        meta = cur.fetchone()["exists"]

    return {
        "task": "Identify Users",
        "done": meta,
        "URL": "https://docs.openreplay.com/data-privacy-security/metadata",
    }


def get_state_manage_users(tenant_id):
    return {
        "task": "Invite Team Members",
        "done": len(users.get_members(tenant_id=tenant_id)) > 1,
        "URL": "https://app.openreplay.com/client/manage-users",
    }


def get_state_integrations(tenant_id):
    return {
        "task": "Integrations",
        "done": len(datadog.get_all(tenant_id=tenant_id)) > 0
                or len(sentry.get_all(tenant_id=tenant_id)) > 0
                or len(stackdriver.get_all(tenant_id=tenant_id)) > 0,
        "URL": "https://docs.openreplay.com/integrations",
    }

```

### Core Architecture Module: `api/chalicelib/core/collaborations/__init__.py`
```
from . import collaboration_base as _

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4972** (2026-10-05): **chalice:v1.28.0 ships EE code — MCP auth-status 500s on FOSS (column "tenant_id" does not exist)**
  *Symptoms*: ### Description  On a FOSS docker-compose install of v1.28.0, the MCP login flow always fails. Every poll to `/api/v1/mcp/auth-status` returns 500:  ``` psycopg2.errors.UndefinedColumn: column "tenant_id" does not exist LINE 8:                 (SELECT tenant_id                                 ^   File "/work/chalicelib/core/mcp/authorizers.py", line 102, in get_token_by_state     cur.execute(query=query)   File "/work/routers/subs/mcp.py", line 27, in get_mcp_jwt     jwt = authorizers.get_token_by_state(client_id=client_id, state=state) INFO:app:GET:/v1/mcp/auth-status 500 ```  The query being executed is the **EE** variant of `get_token_by_state()`:  ```sql (SELECT tenant_id  FROM public.users  WHERE users.user_id = mcp_authentication_tokens.user_id     AND users.deleted_at IS NULL) AS tenant_id; ```  The FOSS version of the same function in `api/chalicelib/core/mcp/authorizers.py` returns a constant instead, because FOSS is single-tenant and `public.users` has no `tenant_id` column:  ```sql 1 AS tenant_id; ```  So the published `chalice:v1.28.0` image appears to be built from the `ee/api` tree and executes EE SQL against a FOSS schema.  ### To Reproduce  1. Install v1.28.0 via `scripts/docker-compose/docker-install.sh` (FOSS) 2. Install the OpenReplay MCP extension and point it at the instance 3. Start the login flow and click **Authorize** 4. Every poll to `/api/v1/mcp/auth-status` returns 500 5. `docker logs chalice` shows the traceback above  Confirm the column is absent
  **Post-Mortem & Fix Analysis**:
  > This has been fixed in chalice `v1.28.4`. Refer to this [thread](https://github.com/openreplay/openreplay/issues/4940#issuecomment-5930793917).
  > @estradino Thanks! check my [comment](https://github.com/openreplay/openreplay/issues/4940#issuecomment-5997241900) there please
  > Is your comment still valid with chalice `v1.28.4` version?

- **Issue #4940** (2026-10-01): **MCP unusable on self-hosted OSS v1.28.0: EE-gated authorize page + missing mcp_authentication_tokens table**
  *Symptoms*:   Summary    On self-hosted Community (OSS) v1.28.0, the MCP browser login flow cannot complete. Two separate issues block it. Confirmed on Slack that MCP is intended to be available in the OSS edition.    Environment    - OpenReplay v1.28.0, self-hosted on Kubernetes (Helm), Community edition   - Upgraded from v1.22.0   - MCP client: OpenReplay MCP connector (browser login flow)    Issue 1 — Authorize page is gated to Enterprise    Opening the authorize URL produced by the MCP client:    https://<host>/mcp/authorize?state=…&client_id=…&app_name=OpenReplay%20MCP    renders only:    ▎ This page is only available for Enterprise Edition of Open Replay    There is no Authorize button, so the flow cannot be completed.    The gate is in frontend/app/components/McpAuthorize/McpAuthorize.tsx, which early-returns on if (!userStore.isEnterprise) (added in 6784a3371, "ui: mcp auth ee check", 2026-06-24).    This contradicts the backend: since v1.28.0 the MCP router ships in the community API — api/routers/subs/mcp.py, registered in api/app.py via include_router(mcp.app) and include_router(mcp.public_app) (added in 249f5eb37,   "refactor(chalice): MCP auth", 2026-09-07). The file does not exist at tag v1.27.0.    So the OSS backend exposes POST /v1/mcp/authorize and GET /v1/mcp/auth-status, but the OSS UI refuses to render the page that calls them.    Issue 2 — auth-status returns 500: table does not exist    GET /api/v1/mcp/auth-status?client_id=…&state=…  →  500   {"errors":["Internal 
  **Post-Mortem & Fix Analysis**:
  > **Update after testing on self-hosted OSS v1.28.0**  Thanks for shipping the missing tables and removing the EE gate on the authorize page — both confirmed fixed on `[main](https://github.com/openreplay/openreplay/commit/9b559750bd748bcbb7d5d9f539a0bcf59a6d85b8)`.  We kept testing the full flow end to end and hit four more issues. All of them affect any self-hosted OSS install, not a specific setup.  ## Backend (`api/`)  1. **`/v1/mcp/authorize` rejects all non-OpenReplay accounts.** The handler only allows emails ending in `asayer.io` or `openreplay.com`, so on any self-hosted instance it returns `401` for every user, including the instance owner. This alone makes the browser login flow unusable outside OpenReplay's own accounts.  2. **`users.tenant_id` doesn't exist in the OSS schema.** `get_token_by_state()` selects `tenant_id` from `public.users`; that column is only in the EE schema. On OSS the query fails with `UndefinedColumn`. In OSS, `public.tenants` has `CHECK (tenant_id = 1)
  > This has been fixed, but you have to run these queries in postgres: ```sql CREATE TABLE IF NOT EXISTS public.mcp_authentication_tokens (     user_id   integer                     NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,     client_id text                        NOT NULL,     state     text                        NOT NULL,     jti       text                        NOT NULL DEFAULT generate_api_key(10),     iat       timestamp without time zone NULL     DEFAULT NULL,     generated bool                                 DEFAULT FALSE,     PRIMARY KEY (user_id, client_id, state) );  CREATE TABLE IF NOT EXISTS public.mcp_app_users (     user_id    integer                     NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,     client_id  text                        NOT NULL,     created_at timestamp without time zone NOT NULL DEFAULT (now() at time zone 'utc'),     PRIMARY KEY (user_id, client_id) );  ```
  > @JulianOcampo-cleverman you can do `openreplay -u` to fetch the patch.

- **Issue #4895** (2026-09-18): **Sprite icons blank in replay: #OPENREPLAY_SPRITES_MAP container missing**
  *Symptoms*: ### Environment   - Self-hosted OpenReplay v1.27.0   - Tracker: @openreplay/tracker 18.1.0   - App uses an external SVG sprite, e.g. `<use href="/assets/sprite-16-C_dNYwPC.svg#chevron-xs-down">`  ### Problem  All SVG sprite icons render blank in session replay. The recorded DOM in the replay looks like this:  ```html   <!-- live app -->   <svg width="16" height="16" aria-hidden="true">     <use href="/assets/sprite-16-C_dNYwPC.svg#chevron-xs-down"></use>   </svg>    <!-- in replay -->   <svg data-openreplay-id="2191" width="16" height="16" aria-hidden="true">     <use data-openreplay-id="2192" href="#symbol-209"></use>   </svg> ```  The #symbol-209 rewrite itself is expected (per #3318 the player reconstructs sprites and rewrites use hrefs), but symbol-209 does not exist anywhere in the replay document, so nothing renders. In devtools inside the replay iframe:    - document.querySelector('#OPENREPLAY_SPRITES_MAP') → null   - document.getElementById('symbol-209') → null    The reconstructed symbols do exist — but only in a detached `<svg id="reconstructed-sprite">` in the player's own document, never injected into the replay.   ### Root cause  The sprite feature was added in f791d06e with three parts:   1. Tracker inlines sprite symbols and sends them as `_$OPENREPLAY_SPRITE$_ SetNodeAttribute` messages.  2. `MessageManager.handleSprites` builds `<symbol id="symbol-{nodeId}">` elements into a detached `spriteMapSvg` and [rewrites the use href](https://github.com/openreplay/ope
  **Post-Mortem & Fix Analysis**:
  > @bel0v can you try with latest tracker version `18.1.6`?
  > patched, frontend image v1.27.31. Please reopen if you'll get any other issues with it.

- **Issue #4879** (2026-09-15): **Tracker: People batcher drops user_id when merging same-type actions, so the server silently skips them**
  *Symptoms*: **Describe the issue**  When two or more People mutations of the same type (`setProperties`, `setPropertiesOnce`, `increment`) are queued before a batch flush, the tracker's `Batcher.squashPeopleEvents()` merges them into one action but rebuilds the merged object with only `type`, `timestamp` and `payload`. The `user_id` that `People` attached to each individual event is lost in the merge.  The backend's SDK ingestion then skips any action whose `UserID` is empty, so the merged mutation is accepted with HTTP 200 and silently discarded. A correction or replacement of profile properties made within one flush window never reaches the profile. Only the un-merged case (exactly one action of a given type per flush) works, because that branch keeps the original event object which still carries `user_id`.  **Steps to reproduce the issue**  1. Load tracker 18.1.5 (the `static.openreplay.com/18.1.5/openreplay.js` bundle) with `analytics: { active: true }` and call `tracker.start({ userID: 'visitor-a' })`. 2. Before any flush happens, call synchronously:    ```js    tracker.analytics.people.setProperties({ name: 'Alpha', email: 'alpha@example.invalid' });    tracker.analytics.people.setProperties({ name: 'Beta',  email: 'beta@example.invalid'  });    ``` 3. Force a flush (`tracker.stop()`, or wait for the 30 s interval) and inspect the `POST …/ingest/v1/sdk/i` request body. 4. The merged action on the wire is    ```json    {"type":"set_property","timestamp":1789…,"payload":{"name":"Beta
  **Post-Mortem & Fix Analysis**:
  > fixed and released as 18.1.6

- **Issue #4858** (2026-09-03): **[Bug]: Live co-browsing does not update input values in Firefox after the inputs are mounted in the replay iframe**
  *Symptoms*: # [Bug]: Live co-browsing does not update input values in Firefox after the inputs are mounted in the replay iframe  ## Description  During a live Assist co-browsing session, the viewer does not show incremental value changes for existing `input` elements. The application uses controlled React inputs. The local application shows the new values correctly. The viewer receives and consumes the corresponding `SetInputValue` messages, but the mirrored inputs keep their old values. Ordinary text-node updates in the same message stream work correctly. The problem reproduces in Firefox but does not reproduce in Chrome.  The problem occurs when remote control is disabled and when remote control is enabled. When remote control is enabled, clicks on plus and minus buttons reach the local application and change its state, but the values in the viewer remain unchanged. Changing focus or causing a blur does not correct the viewer. Switching to another application tab and then returning to the original tab reconstructs the affected DOM and makes the viewer show the current values.  ## Steps to reproduce  1. Create a page with a controlled text input whose `value` is changed programmatically, such as with a plus button.  2. Start an OpenReplay Assist live co-browsing session.  3. Observe that the local input and the viewer input initially show the same value, such as `1`.  4. Use the local plus button to change the value to `2`.  5. Observe that the local input shows `2`, but the viewer inpu
  **Post-Mortem & Fix Analysis**:
  > Fixed in latest patch, thanks for the detailed report.

- **Issue #4853** (2026-09-02): **Canvas replay is blank in Chrome: player iframe sandbox lacks allow-scripts (regression from #4725)**
  *Symptoms*: **What breaks**  Canvas/WebGL content is blank in every replay in Chrome. The rest of the page replays fine.  **Cause**  #4725 ("ui: security pass on player layer", `e37e0d54`) added a sandbox to the replay iframe — `player/src/web/Screen/Screen.ts:81`:  ```js iframe.setAttribute('sandbox', 'allow-same-origin'); ```  Chrome does not rasterize a `<canvas>` inside an iframe sandboxed **without** `allow-scripts`. Everything else in the frame paints normally.  **Why this breaks recordings that are actually fine**  Nothing is wrong with capture. The `.webp.frames.zst` archives return HTTP 200 with real payloads, and the player *does* draw them into the canvas — reading the canvas back out from the parent document returns the correct, fully rendered frame:  ```js const d = document.querySelector('iframe').contentDocument; const c = d.querySelector('canvas'); const t = d.createElement('canvas'); t.width = 640; t.height = 320; t.getContext('2d').drawImage(c, 0, 0, 640, 320); open(t.toDataURL());   // correct image ```  The canvas is laid out, hit-testable, `opacity: 1`, `visibility: visible`, with no overlay above it. Only the paint step is skipped. So this affects existing recordings retroactively — the stored frames are intact.  **Minimal reproduction — no OpenReplay session needed**  Paste into any page's console. Three iframes, identical blue `<canvas>` drawn from the parent, plus an orange `<div>` as a control:  ```js const mk = (sandbox, left, label) => {   const f = document.c
  **Post-Mortem & Fix Analysis**:
  > Canvases are disabled in our cloud installation at the moment and v1.27.0 reads player from frontend/player which was not changed by the commit itself. I suspect that only 1.26.0 actually had sandboxing without [workaround](https://github.com/openreplay/openreplay/blob/dev/player/src/web/managers/CanvasManager.ts#L295) that been put in place to make sure that canvas painting still works. In any case, I patched both images with same sandbox+workaround combo that current dev branch had just in case.

- **Issue #4844** (2026-09-02): **Session metadata chips overlap the session timestamp in the Sessions list when metadata keys/values are long**
  *Symptoms*: **Describe the issue**  In the Sessions list, the per-session metadata chips overflow their column and render on top of the session timestamp and the events/duration line, making both hard to read.  Each chip's *text* is correctly truncated with an ellipsis (e.g. `8717137d-896d-475f-b078-c4…`), but the chip container itself extends past the boundary of its column, so the block overlaps the neighbouring column instead of being constrained to the space available to it.  The severity scales with value length: rows where several metadata values are full UUIDs sit squarely over the timestamp, while rows with short values (e.g. a numeric ID) overflow only slightly.  **Steps to reproduce the issue**  1. On a project, define three metadata keys with long names, e.g.    `applicantConsumerId`, `applicantId`, `applicantSessionId` 2. Record sessions that set all three, with full 36-character UUIDs as values 3. Open **Sessions** (default view: Past 24 Hours, sorted Newest) 4. The metadata chips render over the session time (e.g. `04:57pm`) and over the    `N Events • <duration>` line beneath it  **Expected behavior**  Metadata chips should stay within their own column — truncating, wrapping or reflowing as needed — and never overlap the timestamp or the events/duration line, regardless of how long the metadata keys or values are.  **Screenshots**  <img width="2205" height="897" alt="Image" src="https://github.com/user-attachments/assets/b114116f-4f6a-4adf-aa5c-7022c0d46fc6" />  **OpenRepl
  **Post-Mortem & Fix Analysis**:
  > should be fixed with latest image, now entire element has unified width budget 

- **Issue #4836** (2026-09-02): **Early user input during tracker start produces a malformed batch, truncating the session to   ~1s**
  *Symptoms*: **Describe the issue**  If the user presses a key within about the first second after the tracker starts, the tracker sends a batch whose `BatchMetadata` message is not the first message in the batch. The backend rejects it in `backend/pkg/messages/reader.go`:  ```go if m.msgType == MsgBatchMetadata {     if m.index > 1 {         return fmt.Errorf("batch meta not at the start of batch")     } ```  `ender` then logs:  ``` session <id> ended with 1 broken batch(es), first error: batch meta not at the start of batch ```  Everything after that point is dropped. The session shows up in the UI as 1 event and 1 second long, even though the user stayed on the page for minutes and the browser went on uploading batches the whole time.  Nothing about this is visible to the client. Every `POST /ingest/v1/web/i` returns 200 and the browser console is clean. The only sign is the backend log.  **Steps to reproduce the issue**  1. Start the tracker on page load (`new Tracker({...})`, then `await tracker.start()`). 2. As soon as the page renders, send a handful of keydowns about 250ms apart, with the first one    landing within about a second of `start()` resolving. Ordinary keys are enough. No    application handler and no `tracker.event()` call is needed. 3. Keep using the page for a minute or more. 4. Check the network tab. Batches keep posting and keep returning 200. 5. Open the session in the UI. It is about 1 second long with a single event, and `docker logs    ender` has one `broken ba
  **Post-Mortem & Fix Analysis**:
  > Please test out openreplay/tracker@18.1.4 which should resolve the issue. Reopen if its still broken, in that case please provide more info and logs, ideally hook up to tracker via `tracker.attachCommitCallback(messages => ...)` to save incoming batches as they come and attatch it as log file here so I can reproduce whats going on

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

### Incident Patch 1: `86eb2fdb` (2026-10-05)
**Commit Message**: fix(DB): partition CH autocomplete tables by month

Add PARTITION BY toYYYYMM(_timestamp) to autocomplete_events_grouped,
autocomplete_event_properties_grouped, and autocomplete_simple in the
1.23.0 upgrade migrations so the TTL drop can prune whole partitions
instead of scanning rows. Backfills the upgrade path to match the
already-partitioned create/init_schema.

**File**: `scripts/schema/db/init_dbs/clickhouse/1.23.0/14.sql` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ CREATE TABLE IF NOT EXISTS product_analytics.autocomplete_simple
     _timestamp    DateTime
 ) ENGINE = AggregatingMergeTree()
       ORDER BY (project_id, auto_captured, source, name, value)
+      PARTITION BY toYYYYMM(_timestamp)
       TTL _timestamp + INTERVAL 1 MONTH;
 
 DROP TABLE IF EXISTS product_analytics.autocomplete_simple_user_browser_mv;
```

**File**: `scripts/schema/db/init_dbs/clickhouse/1.23.0/7.sql` (modified, +2/-1)
```diff
@@ -25,9 +25,10 @@ CREATE TABLE IF NOT EXISTS product_analytics.autocomplete_events_grouped
     project_id UInt16,
     value      String COMMENT 'The $event_name',
     data_count AggregateFunction(sum, UInt16) COMMENT 'The number of appearance during the past month',
-    _timestamp DateTime
+    _timestamp DateTime DEFAULT now()
 ) ENGINE = AggregatingMergeTree()
       ORDER BY (project_id, value)
+      PARTITION BY toYYYYMM(_timestamp)
       TTL _timestamp + INTERVAL 1 MONTH;
 
 CREATE MATERIALIZED VIEW IF NOT EXISTS product_analytics.autocomplete_events_grouped_mv
```

**File**: `scripts/schema/db/init_dbs/clickhouse/1.23.0/8.sql` (modified, +1/-0)
```diff
@@ -30,6 +30,7 @@ CREATE TABLE IF NOT EXISTS product_analytics.autocomplete_event_properties_group
     _timestamp    DateTime DEFAULT now()
 ) ENGINE = AggregatingMergeTree()
       ORDER BY (project_id, event_name, property_name, value)
+      PARTITION BY toYYYYMM(_timestamp)
       TTL _timestamp + INTERVAL 1 MONTH;
 
 CREATE MATERIALIZED VIEW IF NOT EXISTS product_analytics.autocomplete_event_properties_grouped_mv
```

---

### Incident Patch 2: `832aa128` (2026-10-01)
**Commit Message**: fix(api): address review feedback

- quote raw project id in parse error
- quote project key in api key warning log, drop unused context value
- tenant-aware fake pool in project key tests
- test for other tenant's project key being rejected
- test for 5xx error message masking
- tests for single-sided wildcard autocomplete patterns

**File**: `backend/pkg/analytics/filters_catalog/autocomplete_test.go` (modified, +4/-0)
```diff
@@ -15,6 +15,10 @@ func TestStringToSQLLike(t *testing.T) {
 		"a_c":   `%a\_c%`,
 		`a\c`:   `%a\\c%`,
 		"*abc*": "%abc%",
+		"abc*":  "%abc%",
+		"*abc":  "%abc%",
+		"^abc*": "abc%",
+		"*abc$": "%abc",
 	}
 	for in, want := range cases {
 		if got := stringToSQLLike(in); got != want {
```

**File**: `backend/pkg/server/api/request.go` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ func GetProject(r *http.Request) (uint32, error) {
 	}
 	projectID, err := ParseUint32(raw)
 	if err != nil || projectID == 0 {
-		return 0, fmt.Errorf("invalid project id: %s", raw)
+		return 0, fmt.Errorf("invalid project id: %q", raw)
 	}
 	return projectID, nil
 }
```

**File**: `backend/pkg/server/api/responser_test.go` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+package api
+
+import (
+	"context"
+	"encoding/json"
+	"errors"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+	"time"
+
+	"openreplay/backend/pkg/logger"
+	"openreplay/backend/pkg/metrics/web"
+)
+
+func TestResponseWithErrorMasks5xx(t *testing.T) {
+	cases := []struct {
+		name    string
+		code    int
+		err     error
+		wantMsg string
+	}{
+		{"5xx hides internal error", http.StatusInternalServerError, errors.New("failed to encode args[0]: int4 overflow"), "internal server error"},
+		{"503 hides internal error", http.StatusServiceUnavailable, errors.New("pool exhausted"), "internal server error"},
+		{"5xx with nil error", http.StatusNotImplemented, nil, "internal server error"},
+		{"4xx keeps message", http.StatusNotFound, errors.New("session not found"), "session not found"},
+		{"400 keeps message", http.StatusBadRequest, errors.New(`invalid project id: "abc"`), `invalid project id: "abc"`},
+	}
+	resp := NewResponser(web.New("test"))
+	log := logger.New()
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			w := httptest.NewRecorder()
+			resp.ResponseWithError(log, context.Background(), w, tc.code, tc.err, time.Now(), "/test", 0)
+			if w.Code != tc.code {
+				t.Fatalf("status = %d, want %d", w.Code, tc.code)
+			}
+			var body response
+			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
+				t.Fatalf("invalid json body %q: %s", w.Body.String(), err)
+			}
+			if len(body.Errors) != 1 || body.Errors[0] != tc.wantMsg {
+				t.Fatalf("errors = %v, want [%q]", body.Errors, tc.wantMsg)
+			}
+		})
+	}
+}
```

**File**: `ee/backend/pkg/projects/projects_tenant_test.go` (modified, +35/-5)
```diff
@@ -49,12 +49,18 @@ func (r fakeRow) Scan(dest ...interface{}) error {
 }
 
 type fakePool struct {
-	row fakeRow
+	tenantID int
+	row      fakeRow
 }
 
 func (p *fakePool) Query(sql string, args ...interface{}) (pgx.Rows, error) { return nil, nil }
-func (p *fakePool) QueryRow(sql string, args ...interface{}) pgx.Row        { return p.row }
-func (p *fakePool) Exec(sql string, arguments ...interface{}) error         { return nil }
+func (p *fakePool) QueryRow(sql string, args ...interface{}) pgx.Row {
+	if len(args) < 2 || args[1] != p.tenantID {
+		return fakeRow{err: pgx.ErrNoRows}
+	}
+	return p.row
+}
+func (p *fakePool) Exec(sql string, arguments ...interface{}) error { return nil }
 func (p *fakePool) ExecContext(ctx context.Context, sql string, arguments ...interface{}) error {
 	return nil
 }
@@ -72,7 +78,7 @@ func TestGetProjectByKeyAndTenant_CacheTenantMismatch(t *testing.T) {
 		cache:          redisCache,
 		projectsByID:   cache.New(time.Minute, time.Minute),
 		projectsByKeys: cache.New(time.Minute, time.Minute),
-		db: &fakePool{row: fakeRow{
+		db: &fakePool{tenantID: 2, row: fakeRow{
 			projectID: 9,
 		}},
 	}
@@ -95,7 +101,7 @@ func TestGetProjectByKeyAndTenant_CacheTenantMatch(t *testing.T) {
 		cache:          redisCache,
 		projectsByID:   cache.New(time.Minute, time.Minute),
 		projectsByKeys: cache.New(time.Minute, time.Minute),
-		db:             &fakePool{row: fakeRow{err: errNotReached}},
+		db:             &fakePool{tenantID: 1, row: fakeRow{err: errNotReached}},
 	}
 
 	got, err := c.GetProjectByKeyAndTenant(key, 1)
@@ -106,3 +112,27 @@ func TestGetProjectByKeyAndTenant_CacheTenantMatch(t *testing.T) {
 		t.Fatalf("expected the cached project for the matching tenant, got %d", got.ProjectID)
 	}
 }
+
+func TestGetProjectByKeyAndTenant_OtherTenantKeyRejected(t *testing.T) {
+	const key = "shared-key"
+	redisCache := &fakeTenantCache{byKey: map[string]*Project{
+		key: {ProjectID: 7, ProjectKey: key, TenantID: 1},
+	}}
+	c := &projectsImpl{
+		cache:          redisCache,
+		projectsByID:   cache.New(time.Minute, time.Minute),
+		projectsByKeys: cache.New(time.Minute, time.Minute),
+		db:             &fakePool{tenantID: 1, row: fakeRow{projectID: 7}},
+	}
+
+	got, err := c.GetProjectByKeyAndTenant(key, 2)
+	if !errors.Is(err, pgx.ErrNoRows) {
+		t.Fatalf("expected pgx.ErrNoRows for another tenant's key, got err=%v project=%v", err, got)
+	}
+	if got != nil {
+		t.Fatalf("expected no project for another tenant's key, got project %d", got.ProjectID)
+	}
+	if _, ok := c.projectsByKeys.Get(key + ":2"); ok {
+		t.Fatalf("other tenant's project must not be cached for tenant 2")
+	}
+}
```

**File**: `ee/backend/pkg/server/auth/authorizer_tenant.go` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ func (a *authImpl) isAuthorizedApiKey(apiKey string, projectKey string) (*tenant
 
 	_, err = a.projects.GetProjectByKeyAndTenant(projectKey, dbTenant.TenantID)
 	if err != nil {
-		a.log.Warn(context.WithValue(context.Background(), "projectKey", projectKey), "Unauthorized request, wrong api key for project %s", projectKey)
+		a.log.Warn(context.Background(), "Unauthorized request, wrong api key for project %q", projectKey)
 		return nil, err
 	}
 
```

---

### Incident Patch 3: `c3013800` (2026-10-01)
**Commit Message**: fix(api): security quick wins

- escape LIKE wildcards in cards, dashboards and autocomplete
- generic message on 5xx responses
- nosniff and X-Frame-Options headers
- session ownership check on note create and favorite
- saved search get limited to owner, public or shared
- project_id filter on mobile events queries
- separate short-lived cache for not-deleted project check
- deny service accounts on routes without SERVICE_* permissions
- stop logging auth struct on wrong api key

**File**: `backend/pkg/analytics/cards/cards.go` (modified, +3/-2)
```diff
@@ -7,6 +7,7 @@ import (
 	"strings"
 
 	"openreplay/backend/pkg/analytics/model"
+	"openreplay/backend/pkg/db/postgres"
 	"openreplay/backend/pkg/db/postgres/pool"
 	"openreplay/backend/pkg/logger"
 
@@ -218,8 +219,8 @@ func (s *cardsImpl) GetAllPaginated(projectID int, filters CardListFilter, sort
 	params := []interface{}{projectID}
 	idx := 2
 	if name := filters.GetNameFilter(); name != nil {
-		conds = append(conds, fmt.Sprintf("m.name ILIKE $%d", idx))
-		params = append(params, "%"+*name+"%")
+		conds = append(conds, fmt.Sprintf("m.name ILIKE $%d ESCAPE '\\'", idx))
+		params = append(params, "%"+postgres.EscapeILIKE(*name)+"%")
 		idx++
 	}
 	if t := filters.GetMetricTypeFilter(); t != nil {
```

**File**: `backend/pkg/analytics/dashboards/dashboards.go` (modified, +2/-2)
```diff
@@ -287,8 +287,8 @@ func buildBaseQuery(projectId int, userID uint64, req *GetDashboardsRequest) (st
 
 	// Handle search query
 	if req.Query != "" {
-		conditions = append(conditions, "(d.name ILIKE $3 OR d.description ILIKE $3)")
-		args = append(args, "%"+req.Query+"%")
+		conditions = append(conditions, "(d.name ILIKE $3 ESCAPE '\\' OR d.description ILIKE $3 ESCAPE '\\')")
+		args = append(args, "%"+postgres.EscapeILIKE(req.Query)+"%")
 	}
 
 	conditions = append(conditions, "d.deleted_at IS NULL")
```

**File**: `backend/pkg/analytics/filters_catalog/autocomplete.go` (modified, +10/-6)
```diff
@@ -16,20 +16,24 @@ const autocompleteCacheTTL = 180 * time.Second
 
 var multiSpaceRe = regexp.MustCompile(` +`)
 
+var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`, `*`, `%`)
+
 func stringToSQLLike(value string) string {
 	value = multiSpaceRe.ReplaceAllString(value, " ")
-	value = strings.ReplaceAll(value, "*", "%")
+	prefix, suffix := "%", "%"
 	if strings.HasPrefix(value, "^") {
 		value = value[1:]
-	} else if !strings.HasPrefix(value, "%") {
-		value = "%" + value
+		prefix = ""
+	} else if strings.HasPrefix(value, "*") {
+		prefix = ""
 	}
 	if strings.HasSuffix(value, "$") {
 		value = value[:len(value)-1]
-	} else if !strings.HasSuffix(value, "%") {
-		value = value + "%"
+		suffix = ""
+	} else if strings.HasSuffix(value, "*") {
+		suffix = ""
 	}
-	return value
+	return prefix + likeEscaper.Replace(value) + suffix
 }
 
 func scanAutocompleteRows(rows driver.Rows) ([]model.AutocompleteRow, error) {
```

**File**: `backend/pkg/analytics/filters_catalog/autocomplete_test.go` (modified, +5/-3)
```diff
@@ -10,9 +10,11 @@ func TestStringToSQLLike(t *testing.T) {
 		"^abc$": "abc",
 		"a*c":   "%a%c%",
 		"a  b":  "%a b%",
-		"%abc":  "%abc%",
-		"abc%":  "%abc%",
-		"%abc%": "%abc%",
+		"%abc":  `%\%abc%`,
+		"abc%":  `%abc\%%`,
+		"a_c":   `%a\_c%`,
+		`a\c`:   `%a\\c%`,
+		"*abc*": "%abc%",
 	}
 	for in, want := range cases {
 		if got := stringToSQLLike(in); got != want {
```

**File**: `backend/pkg/analytics/saved_searches/handlers.go` (modified, +2/-1)
```diff
@@ -134,7 +134,8 @@ func (e *handlersImpl) getSavedSearch(w http.ResponseWriter, r *http.Request) {
 		return
 	}
 
-	resp, err := e.savedSearches.Get(projectID, searchID)
+	currentUser := r.Context().Value("userData").(*user.User)
+	resp, err := e.savedSearches.Get(projectID, currentUser.ID, searchID)
 	if err != nil {
 		if errors.Is(err, ErrSavedSearchNotFound) {
 			e.responser.ResponseWithError(e.log, r.Context(), w, http.StatusNotFound, err, startTime, r.URL.Path, bodySize)
```

**File**: `backend/pkg/analytics/saved_searches/saved_searches.go` (modified, +4/-3)
```diff
@@ -39,7 +39,7 @@ type SegmentsListItem struct {
 
 type SavedSearches interface {
 	Save(projectID int, userID uint64, req *model.SavedSearchRequest) (*model.SavedSearchResponse, error)
-	Get(projectID int, searchID string) (*model.SavedSearch, error)
+	Get(projectID int, userID uint64, searchID string) (*model.SavedSearch, error)
 	List(ctx context.Context, projectID int, userID uint64, limit, offset int, sort, order string, withStats bool) ([]*model.SavedSearch, int, error)
 	Update(projectID int, userID uint64, searchID string, req *model.SavedSearchRequest) (*model.SavedSearchResponse, error)
 	Delete(projectID int, userID uint64, searchID string) error
@@ -132,7 +132,7 @@ func (s *savedSearchesImpl) Save(projectID int, userID uint64, req *model.SavedS
 	}, nil
 }
 
-func (s *savedSearchesImpl) Get(projectID int, searchID string) (*model.SavedSearch, error) {
+func (s *savedSearchesImpl) Get(projectID int, userID uint64, searchID string) (*model.SavedSearch, error) {
 	ctx := context.Background()
 
 	const selectQuery = `
@@ -141,12 +141,13 @@ func (s *savedSearchesImpl) Get(projectID int, searchID string) (*model.SavedSea
 		FROM public.saved_searches
 		WHERE search_id=$1 AND project_id=$2 AND deleted_at IS NULL
 			AND (expires_at IS NULL OR expires_at > NOW())
+			AND (user_id=$3 OR is_public OR is_share)
 	`
 
 	var savedSearch model.SavedSearch
 	var searchDataJSON []byte
 
-	err := s.pgconn.QueryRow(selectQuery, searchID, projectID).Scan(
+	err := s.pgconn.QueryRow(selectQuery, searchID, projectID, userID).Scan(
 		&savedSearch.SearchID,
 		&savedSearch.ProjectID,
 		&savedSearch.UserID,
```

**File**: `backend/pkg/api/builder.go` (modified, +2/-2)
```diff
@@ -198,7 +198,7 @@ func NewServiceBuilder(log logger.Logger, cfg *config.Config, webMetrics web.Web
 	if err != nil {
 		return nil, err
 	}
-	favHandlers, err := favoriteAPI.NewHandlers(log, responser, favService)
+	favHandlers, err := favoriteAPI.NewHandlers(log, responser, favService, sessionService)
 	if err != nil {
 		return nil, err
 	}
@@ -207,7 +207,7 @@ func NewServiceBuilder(log logger.Logger, cfg *config.Config, webMetrics web.Web
 	if err != nil {
 		return nil, err
 	}
-	noteHandlers, err := noteAPI.NewHandlers(log, &cfg.HTTP, responser, noteService)
+	noteHandlers, err := noteAPI.NewHandlers(log, &cfg.HTTP, responser, noteService, sessionService)
 	if err != nil {
 		return nil, err
 	}
```

**File**: `backend/pkg/events/api/handlers.go` (modified, +2/-2)
```diff
@@ -141,12 +141,12 @@ func (h *handlersImpl) getEvents(w http.ResponseWriter, r *http.Request) {
 		})
 		crashesErr = runLane(&wg, "crashes", func() error {
 			var err error
-			crashesRes, err = h.events.GetMobileCrashesBySessionID(sessID, lower, upper)
+			crashesRes, err = h.events.GetMobileCrashesBySessionID(projID, sessID, lower, upper)
 			return err
 		})
 		customsErr = runLane(&wg, "customs", func() error {
 			var err error
-			userEventsRes, err = h.events.GetMobileCustomsBySessionID(sessID, lower, upper)
+			userEventsRes, err = h.events.GetMobileCustomsBySessionID(projID, sessID, lower, upper)
 			return err
 		})
 	}
```

---

### Incident Patch 4: `90774d48` (2026-09-29)
**Commit Message**: fix(api): stricter project id parsing

**File**: `backend/pkg/server/api/request.go` (modified, +14/-9)
```diff
@@ -1,6 +1,7 @@
 package api
 
 import (
+	"errors"
 	"fmt"
 	"io"
 	"net/http"
@@ -16,14 +17,21 @@ import (
 	"openreplay/backend/pkg/server/user"
 )
 
+var ErrNoProjectInPath = errors.New("no project in request path")
+
 func GetProject(r *http.Request) (uint32, error) {
-	vars := mux.Vars(r)
-	projID := vars["project"]
-	projectID, err := strconv.Atoi(projID)
-	if err != nil {
-		return 0, err
+	raw, ok := mux.Vars(r)["projectId"]
+	if !ok || raw == "" {
+		raw, ok = mux.Vars(r)["project"]
+	}
+	if !ok || raw == "" {
+		return 0, ErrNoProjectInPath
 	}
-	return uint32(projectID), nil
+	projectID, err := ParseUint32(raw)
+	if err != nil || projectID == 0 {
+		return 0, fmt.Errorf("invalid project id: %s", raw)
+	}
+	return projectID, nil
 }
 
 func GetParam(r *http.Request, param string) (string, error) {
@@ -150,9 +158,6 @@ func GetPathParam[T any](r *http.Request, key string, parseFunc func(string) (T,
 	}
 	value, err := parseFunc(valueStr)
 	if err != nil {
-		if len(defaultValue) > 0 {
-			return defaultValue[0], nil
-		}
 		return zero, fmt.Errorf("invalid path param %s: %w", key, err)
 	}
 	return value, nil
```

**File**: `backend/pkg/server/api/request_test.go` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+package api
+
+import (
+	"errors"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+
+	"github.com/gorilla/mux"
+)
+
+func requestWithVars(t *testing.T, vars map[string]string) *http.Request {
+	t.Helper()
+	r := httptest.NewRequest(http.MethodGet, "/", nil)
+	if vars != nil {
+		r = mux.SetURLVars(r, vars)
+	}
+	return r
+}
+
+func TestGetPathParamDefaultOnlyForMissing(t *testing.T) {
+	cases := []struct {
+		name    string
+		vars    map[string]string
+		wantVal uint32
+		wantErr bool
+	}{
+		{"missing returns default", map[string]string{}, 7, false},
+		{"empty returns default", map[string]string{"projectId": ""}, 7, false},
+		{"valid parses", map[string]string{"projectId": "42"}, 42, false},
+		{"plus prefix errors, does not fall back to default", map[string]string{"projectId": "+42"}, 0, true},
+		{"negative errors", map[string]string{"projectId": "-42"}, 0, true},
+		{"overflow errors", map[string]string{"projectId": "4294967301"}, 0, true},
+		{"garbage errors", map[string]string{"projectId": "42abc"}, 0, true},
+	}
+	for _, c := range cases {
+		t.Run(c.name, func(t *testing.T) {
+			r := requestWithVars(t, c.vars)
+			got, err := GetPathParam(r, "projectId", ParseUint32, uint32(7))
+			if c.wantErr {
+				if err == nil {
+					t.Fatalf("expected error, got value %d", got)
+				}
+				return
+			}
+			if err != nil {
+				t.Fatalf("unexpected error: %s", err)
+			}
+			if got != c.wantVal {
+				t.Fatalf("got %d, want %d", got, c.wantVal)
+			}
+		})
+	}
+}
+
+func TestGetPathParamNoDefault(t *testing.T) {
+	r := requestWithVars(t, map[string]string{})
+	if _, err := GetPathParam(r, "projectId", ParseUint32); err == nil {
+		t.Fatalf("expected error for missing param without a default")
+	}
+	r = requestWithVars(t, map[string]string{"projectId": "+42"})
+	if _, err := GetPathParam(r, "projectId", ParseUint32); err == nil {
+		t.Fatalf("expected error for malformed param without a default")
+	}
+}
+
+func TestGetProjectResolution(t *testing.T) {
+	cases := []struct {
+		name    string
+		vars    map[string]string
+		wantID  uint32
+		wantErr bool
+		wantNo  bool // expect ErrNoProjectInPath specifically
+	}{
+		{"no project var", map[string]string{}, 0, true, true},
+		{"empty vars", map[string]string{"projectId": "", "project": ""}, 0, true, true},
+		{"projectId valid", map[string]string{"projectId": "42"}, 42, false, false},
+		{"project alias valid", map[string]string{"project": "42"}, 42, false, false},
+		{"projectId preferred over project", map[string]string{"projectId": "42", "project": "99"}, 42, false, false},
+		{"empty projectId falls back to project", map[string]string{"projectId": "", "project": "42"}, 42, false, false},
+		{"leading zero parses to its value", map[string]string{"projectId": "042"}, 42, false, false},
+		{"plus prefix rejected", map[string]string{"projectId": "+42"}, 0, true, false},
+		{"negative rejected", map[string]string{"projectId": "-42"}, 0, true, false},
+		{"overflow rejected", map[string]string{"projectId": "4294967301"}, 0, true, false},
+		{"zero rejected", map[string]string{"projectId": "0"}, 0, true, false},
+		{"garbage rejected", map[string]string{"projectId": "42abc"}, 0, true, false},
+	}
+	for _, c := range cases {
+		t.Run(c.name, func(t *testing.T) {
+			r := requestWithVars(t, c.vars)
+			id, err := GetProject(r)
+			if c.wantErr {
+				if err == nil {
+					t.Fatalf("expected error, got id=%d", id)
+				}
+				if c.wantNo && !errors.Is(err, ErrNoProjectInPath) {
+					t.Fatalf("expected ErrNoProjectInPath, got: %s", err)
+				}
+				if !c.wantNo && errors.Is(err, ErrNoProjectInPath) {
+					t.Fatalf("expected a malformed-id error, got ErrNoProjectInPath")
+				}
+				return
+			}
+			if err != nil {
+				t.Fatalf("unexpected error: %s", err)
+			}
+			if id != c.wantID {
+				t.Fatalf("id: got %d, want %d", id, c.wantID)
+			}
+		})
+	}
+}
```

**File**: `ee/backend/pkg/projects/projects_tenant.go` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ func (c *projectsImpl) GetProjectByKeyAndTenant(projectKey string, tenantId int)
 	if proj, ok := c.projectsByKeys.Get(cacheKey); ok {
 		return proj.(*Project), nil
 	}
-	if proj, err := c.cache.GetByKey(projectKey); err == nil {
+	if proj, err := c.cache.GetByKey(projectKey); err == nil && proj.TenantID == tenantId {
 		c.projectsByKeys.Set(cacheKey, proj)
 		return proj, nil
 	}
```

**File**: `ee/backend/pkg/projects/projects_tenant_test.go` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+package projects
+
+import (
+	"context"
+	"errors"
+	"testing"
+	"time"
+
+	"github.com/jackc/pgx/v5"
+
+	"openreplay/backend/pkg/cache"
+	"openreplay/backend/pkg/db/postgres/pool"
+)
+
+var errNotReached = errors.New("the DB should not have been queried")
+
+type fakeTenantCache struct {
+	byKey map[string]*Project
+}
+
+func (f *fakeTenantCache) Set(project *Project) error { return nil }
+
+func (f *fakeTenantCache) GetByID(projectID uint32) (*Project, error) {
+	return nil, ErrDisabledCache
+}
+
+func (f *fakeTenantCache) GetByKey(projectKey string) (*Project, error) {
+	if p, ok := f.byKey[projectKey]; ok {
+		return p, nil
+	}
+	return nil, ErrDisabledCache
+}
+
+type fakeRow struct {
+	projectID uint32
+	err       error
+}
+
+func (r fakeRow) Scan(dest ...interface{}) error {
+	if r.err != nil {
+		return r.err
+	}
+	for _, d := range dest {
+		if v, ok := d.(*uint32); ok {
+			*v = r.projectID
+		}
+	}
+	return nil
+}
+
+type fakePool struct {
+	row fakeRow
+}
+
+func (p *fakePool) Query(sql string, args ...interface{}) (pgx.Rows, error) { return nil, nil }
+func (p *fakePool) QueryRow(sql string, args ...interface{}) pgx.Row        { return p.row }
+func (p *fakePool) Exec(sql string, arguments ...interface{}) error         { return nil }
+func (p *fakePool) ExecContext(ctx context.Context, sql string, arguments ...interface{}) error {
+	return nil
+}
+func (p *fakePool) SendBatch(b *pgx.Batch) pgx.BatchResults { return nil }
+func (p *fakePool) Begin() (*pool.Tx, error)                { return nil, nil }
+func (p *fakePool) Ping(ctx context.Context) error          { return nil }
+func (p *fakePool) Close()                                  {}
+
+func TestGetProjectByKeyAndTenant_CacheTenantMismatch(t *testing.T) {
+	const key = "shared-key"
+	redisCache := &fakeTenantCache{byKey: map[string]*Project{
+		key: {ProjectID: 7, ProjectKey: key, TenantID: 1},
+	}}
+	c := &projectsImpl{
+		cache:          redisCache,
+		projectsByID:   cache.New(time.Minute, time.Minute),
+		projectsByKeys: cache.New(time.Minute, time.Minute),
+		db: &fakePool{row: fakeRow{
+			projectID: 9,
+		}},
+	}
+
+	got, err := c.GetProjectByKeyAndTenant(key, 2)
+	if err != nil {
+		t.Fatalf("unexpected error: %s", err)
+	}
+	if got.ProjectID != 9 {
+		t.Fatalf("expected the DB result for the correct tenant (project 9), got the cached other-tenant project %d", got.ProjectID)
+	}
+}
+
+func TestGetProjectByKeyAndTenant_CacheTenantMatch(t *testing.T) {
+	const key = "shared-key"
+	redisCache := &fakeTenantCache{byKey: map[string]*Project{
+		key: {ProjectID: 7, ProjectKey: key, TenantID: 1},
+	}}
+	c := &projectsImpl{
+		cache:          redisCache,
+		projectsByID:   cache.New(time.Minute, time.Minute),
+		projectsByKeys: cache.New(time.Minute, time.Minute),
+		db:             &fakePool{row: fakeRow{err: errNotReached}},
+	}
+
+	got, err := c.GetProjectByKeyAndTenant(key, 1)
+	if err != nil {
+		t.Fatalf("unexpected error: %s", err)
+	}
+	if got.ProjectID != 7 {
+		t.Fatalf("expected the cached project for the matching tenant, got %d", got.ProjectID)
+	}
+}
```

**File**: `ee/backend/pkg/server/auth/authorizer_tenant.go` (modified, +7/-6)
```diff
@@ -1,6 +1,7 @@
 package auth
 
 import (
+	"errors"
 	"fmt"
 	"net/http"
 
@@ -43,12 +44,12 @@ func (a *authImpl) validateProjectAccess(r *http.Request, u *user.User) error {
 		return nil
 	}
 
-	projectID, err := api.GetPathParam(r, "projectId", api.ParseUint32, uint32(0))
-	if err != nil || projectID == 0 {
-		projectID, err = api.GetPathParam(r, "project", api.ParseUint32, uint32(0))
-		if err != nil || projectID == 0 {
-			return nil
-		}
+	projectID, err := api.GetProject(r)
+	if errors.Is(err, api.ErrNoProjectInPath) {
+		return nil
+	}
+	if err != nil {
+		return err
 	}
 
 	project, err := a.projects.GetProjectNotDeleted(projectID)
```

**File**: `ee/backend/pkg/server/auth/authorizer_tenant_test.go` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+package auth
+
+import (
+	"errors"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+
+	"github.com/gorilla/mux"
+
+	"openreplay/backend/pkg/projects"
+	"openreplay/backend/pkg/server/user"
+)
+
+var errNoSuchProject = errors.New("no such project")
+
+type fakeProjects struct {
+	byID map[uint32]*projects.Project
+}
+
+func (f *fakeProjects) GetProject(projectID uint32) (*projects.Project, error) {
+	return f.GetProjectNotDeleted(projectID)
+}
+
+func (f *fakeProjects) GetProjectByKey(projectKey string) (*projects.Project, error) {
+	return nil, nil
+}
+
+func (f *fakeProjects) GetProjectByKeyAndTenant(projectKey string, tenantId int) (*projects.Project, error) {
+	return nil, nil
+}
+
+func (f *fakeProjects) GetProjectNotDeleted(projectID uint32) (*projects.Project, error) {
+	if p, ok := f.byID[projectID]; ok {
+		return p, nil
+	}
+	return nil, errNoSuchProject
+}
+
+func (f *fakeProjects) ListProjectsByTenantID(tenantID int) ([]*projects.Project, error) {
+	return nil, nil
+}
+
+func (f *fakeProjects) ExistsByName(name string, tenantID int) (bool, error) {
+	return false, nil
+}
+
+func (f *fakeProjects) CreateProject(tenantID int, name string, platform string) (*projects.Project, error) {
+	return nil, nil
+}
+
+func newRequest(t *testing.T, pathVar, value string) *http.Request {
+	t.Helper()
+	r := httptest.NewRequest(http.MethodGet, "/", nil)
+	if pathVar != "" {
+		r = mux.SetURLVars(r, map[string]string{pathVar: value})
+	}
+	return r
+}
+
+func TestValidateProjectAccess(t *testing.T) {
+	fp := &fakeProjects{byID: map[uint32]*projects.Project{
+		5: {ProjectID: 5, TenantID: 1},
+	}}
+	a := &authImpl{projects: fp}
+	other := &user.User{TenantID: 2}
+	owner := &user.User{TenantID: 1}
+
+	cases := []struct {
+		name     string
+		pathVar  string
+		value    string
+		u        *user.User
+		wantDeny bool
+	}{
+		{"no project on route", "", "", other, false},
+		{"own tenant, plain id", "projectId", "5", owner, false},
+		{"cross tenant, plain id", "projectId", "5", other, true},
+		{"cross tenant, plus prefix", "projectId", "+5", other, true},
+		{"cross tenant, leading zero", "projectId", "05", other, true},
+		{"cross tenant, negative", "projectId", "-5", other, true},
+		{"cross tenant, uint32 overflow", "projectId", "4294967301", other, true},
+		{"garbage id", "projectId", "5abc", other, true},
+		{"empty id", "projectId", "", other, false},
+		{"zero id", "projectId", "0", other, true},
+		{"project path var name", "project", "5", other, true},
+	}
+
+	for _, c := range cases {
+		t.Run(c.name, func(t *testing.T) {
+			r := newRequest(t, c.pathVar, c.value)
+			err := a.validateProjectAccess(r, c.u)
+			if c.wantDeny && err == nil {
+				t.Fatalf("expected access to be denied, got nil error")
+			}
+			if !c.wantDeny && err != nil {
+				t.Fatalf("expected access to be allowed, got error: %s", err)
+			}
+		})
+	}
+}
+
+func TestValidateProjectAccessNoProjectsService(t *testing.T) {
+	a := &authImpl{}
+	r := newRequest(t, "projectId", "+5")
+	if err := a.validateProjectAccess(r, &user.User{TenantID: 2}); err != nil {
+		t.Fatalf("expected nil when projects service is not configured, got: %s", err)
+	}
+}
```

---

### Incident Patch 5: `820d6c38` (2026-10-01)
**Commit Message**: fix(chalice): fixed MCP validation

**File**: `api/routers/subs/mcp.py` (modified, +0/-2)
```diff
@@ -13,8 +13,6 @@
 def authorize_mcp_app(background_tasks: BackgroundTasks,
                       data: schemas.MCP.AuthorizeSchema = Body(...),
                       context: schemas.CurrentContext = Depends(OR_context)):
-    if not (context.email.endswith("asayer.io") or context.email.endswith("openreplay.com")):
-        raise HTTPException(status_code=401, detail="Unauthorized")
     authorizers.store_token_request(data=data, cotext=context)
     background_tasks.add_task(tracer.store_client_id,
                               user_id=context.user_id,
```

---

### Incident Patch 6: `9b559750` (2026-09-30)
**Commit Message**: fix(DB): fixed missing MCP tables

**File**: `ee/scripts/schema/db/init_dbs/postgresql/1.28.0/1.28.0.sql` (modified, +20/-0)
```diff
@@ -35,6 +35,26 @@ CREATE INDEX IF NOT EXISTS dashboards_project_id_idx ON public.dashboards (proje
 CREATE INDEX IF NOT EXISTS dashboard_widgets_dashboard_id_metric_id_idx ON public.dashboard_widgets (dashboard_id, metric_id);
 DROP INDEX IF EXISTS public.user_favorite_sessions_user_id_session_id_idx;
 
+
+CREATE TABLE IF NOT EXISTS public.mcp_authentication_tokens
+(
+    user_id   integer                     NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
+    client_id text                        NOT NULL,
+    state     text                        NOT NULL,
+    jti       text                        NOT NULL DEFAULT generate_api_key(10),
+    iat       timestamp without time zone NULL     DEFAULT NULL,
+    generated bool                                 DEFAULT FALSE,
+    PRIMARY KEY (user_id, client_id, state)
+);
+
+CREATE TABLE IF NOT EXISTS public.mcp_app_users
+(
+    user_id    integer                     NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
+    client_id  text                        NOT NULL,
+    created_at timestamp without time zone NOT NULL DEFAULT (now() at time zone 'utc'),
+    PRIMARY KEY (user_id, client_id)
+);
+
 COMMIT;
 
 \elif :is_next
```

**File**: `ee/scripts/schema/db/init_dbs/postgresql/init_schema.sql` (modified, +19/-0)
```diff
@@ -1334,4 +1334,23 @@ CREATE INDEX actions_name_gin_idx ON public.actions USING GIN (name gin_trgm_ops
 CREATE UNIQUE INDEX actions_project_id_name_idx ON public.actions (project_id, name);
 CREATE INDEX actions_project_id_created_at_idx ON public.actions (project_id, created_at DESC);
 
+CREATE TABLE IF NOT EXISTS public.mcp_authentication_tokens
+(
+    user_id   integer                     NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
+    client_id text                        NOT NULL,
+    state     text                        NOT NULL,
+    jti       text                        NOT NULL DEFAULT generate_api_key(10),
+    iat       timestamp without time zone NULL     DEFAULT NULL,
+    generated bool                                 DEFAULT FALSE,
+    PRIMARY KEY (user_id, client_id, state)
+);
+
+CREATE TABLE IF NOT EXISTS public.mcp_app_users
+(
+    user_id    integer                     NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
+    client_id  text                        NOT NULL,
+    created_at timestamp without time zone NOT NULL DEFAULT (now() at time zone 'utc'),
+    PRIMARY KEY (user_id, client_id)
+);
+
 COMMIT;
```

**File**: `scripts/schema/db/init_dbs/postgresql/1.28.0/1.28.0.sql` (modified, +19/-0)
```diff
@@ -31,6 +31,25 @@ CREATE INDEX IF NOT EXISTS dashboards_project_id_idx ON public.dashboards (proje
 CREATE INDEX IF NOT EXISTS dashboard_widgets_dashboard_id_metric_id_idx ON public.dashboard_widgets (dashboard_id, metric_id);
 DROP INDEX IF EXISTS public.user_favorite_sessions_user_id_session_id_idx;
 
+CREATE TABLE IF NOT EXISTS public.mcp_authentication_tokens
+(
+    user_id   integer                     NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
+    client_id text                        NOT NULL,
+    state     text                        NOT NULL,
+    jti       text                        NOT NULL DEFAULT generate_api_key(10),
+    iat       timestamp without time zone NULL     DEFAULT NULL,
+    generated bool                                 DEFAULT FALSE,
+    PRIMARY KEY (user_id, client_id, state)
+);
+
+CREATE TABLE IF NOT EXISTS public.mcp_app_users
+(
+    user_id    integer                     NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
+    client_id  text                        NOT NULL,
+    created_at timestamp without time zone NOT NULL DEFAULT (now() at time zone 'utc'),
+    PRIMARY KEY (user_id, client_id)
+);
+
 COMMIT;
 
 \elif :is_next
```

**File**: `scripts/schema/db/init_dbs/postgresql/init_schema.sql` (modified, +19/-0)
```diff
@@ -1190,4 +1190,23 @@ CREATE INDEX actions_name_gin_idx ON public.actions USING GIN (name gin_trgm_ops
 CREATE UNIQUE INDEX actions_project_id_name_idx ON public.actions (project_id, name);
 CREATE INDEX actions_project_id_created_at_idx ON public.actions (project_id, created_at DESC);
 
+CREATE TABLE IF NOT EXISTS public.mcp_authentication_tokens
+(
+    user_id   integer                     NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
+    client_id text                        NOT NULL,
+    state     text                        NOT NULL,
+    jti       text                        NOT NULL DEFAULT generate_api_key(10),
+    iat       timestamp without time zone NULL     DEFAULT NULL,
+    generated bool                                 DEFAULT FALSE,
+    PRIMARY KEY (user_id, client_id, state)
+);
+
+CREATE TABLE IF NOT EXISTS public.mcp_app_users
+(
+    user_id    integer                     NOT NULL REFERENCES public.users (user_id) ON DELETE CASCADE,
+    client_id  text                        NOT NULL,
+    created_at timestamp without time zone NOT NULL DEFAULT (now() at time zone 'utc'),
+    PRIMARY KEY (user_id, client_id)
+);
+
 COMMIT;
```

---

### Incident Patch 7: `870b1873` (2026-09-29)
**Commit Message**: fix(tracker): keep the first value when squashing set_property_once (#4942)

The people batcher merges same-type actions in a batch with the later payload winning. For set_property_once that is backwards: the backend keeps the first value it sees for a key, so two set_once calls inside one flush window sent the second value instead of the first, and the result depended on batch timing.

**File**: `tracker/tracker/src/main/modules/analytics/batcher.ts` (modified, +7/-2)
```diff
@@ -121,12 +121,17 @@ class Batcher {
           })
           continue
         }
-        // merge payloads, taking priority to the latest one
+        // merge payloads, taking priority to the latest one; set_once is the
+        // exception, the first value for a key is the one the backend would keep
+        const payload =
+          event.type === mutationTypes.setPropertyOnce
+            ? { ...(event.payload ?? {}), ...(prev.payload ?? {}) }
+            : { ...(prev.payload ?? {}), ...(event.payload ?? {}) }
         uniqueEventsByType.set(eventKey, {
           type: event.type,
           user_id: event.user_id,
           timestamp: event.timestamp,
-          payload: { ...(prev.payload ?? {}), ...(event.payload ?? {}) },
+          payload,
         })
       } else {
         uniqueEventsByType.set(eventKey, event)
```

**File**: `tracker/tracker/src/main/modules/analytics/tests/batcher.test.ts` (modified, +16/-0)
```diff
@@ -143,6 +143,22 @@ describe('Batcher', () => {
     ])
   })
 
+  test('squashed set_property_once keeps the first value for a repeated key', () => {
+    batcher.addEvent(makePeopleEvent('set_property_once', 1, { plan: 'free', a: 1 }, 'visitor-a'))
+    batcher.addEvent(makePeopleEvent('set_property_once', 2, { plan: 'pro', b: 2 }, 'visitor-a'))
+
+    const peopleBatch = batcher.getBatches().data[categories.people]
+
+    expect(peopleBatch).toEqual([
+      {
+        type: 'set_property_once',
+        user_id: 'visitor-a',
+        timestamp: 2,
+        payload: { plan: 'free', a: 1, b: 2 },
+      },
+    ])
+  })
+
   test('user_id survives the serialized flush body', () => {
     batcher.addEvent(makePeopleEvent('set_property', 1, { a: 1 }, 'visitor-a'))
     batcher.addEvent(makePeopleEvent('set_property', 2, { b: 2 }, 'visitor-a'))
```

---

### Incident Patch 8: `3db9704a` (2026-09-29)
**Commit Message**: ui: move mcp auth page to general codespace (#4943)

**File**: `frontend/app/components/McpAuthorize/McpAuthorize.tsx` (modified, +0/-22)
```diff
@@ -46,28 +46,6 @@ function McpAuthorize() {
     void userStore.logout();
   };
 
-  if (!userStore.isEnterprise) {
-    return (
-      <div className="flex items-center justify-center bg-gray-lightest fixed top-0 bottom-0 left-0 right-0">
-        <Card style={{ width: 400 }}>
-          <div className="flex flex-col items-center gap-4">
-            <Logo siteId={projectsStore.activeSiteId} />
-            <div className="text-center">
-              <div>
-                {t(
-                  'This page is only available for Enterprise Edition of Open Replay',
-                )}
-              </div>
-            </div>
-            <div className="link mt-2" onClick={openRoot}>
-              {t('Back to Openreplay')}
-            </div>
-          </div>
-        </Card>
-      </div>
-    );
-  }
-
   return (
     <div className="flex items-center justify-center bg-gray-lightest fixed top-0 bottom-0 left-0 right-0">
       <Card style={{ width: 400 }}>
```

---

### Incident Patch 9: `7fdbeb50` (2026-09-28)
**Commit Message**: ui: update env tracker v (#4938)

**File**: `frontend/.env.sample` (modified, +2/-2)
```diff
@@ -16,8 +16,8 @@ CAPTCHA_SITE_KEY = ''
 
 # APP and TRACKER VERSIONS
 VERSION = 1.28.0
-TRACKER_VERSION = '18.2.0'
-TRACKER_MAJOR_VERSION = '18'
+TRACKER_VERSION = '19.0.0'
+TRACKER_MAJOR_VERSION = '19'
 
 COMMIT_HASH = 'unknown'
 COMMIT_HASH=629f7bb6ef247f10370d204b46930538e3eef455
```

---

### Incident Patch 10: `50d755d7` (2026-09-25)
**Commit Message**: fix(migration): pg version

Signed-off-by: rjshrjndrn <[REDACTED_EMAIL]>

**File**: `scripts/helmcharts/openreplay/templates/job.yaml` (modified, +1/-1)
```diff
@@ -288,7 +288,7 @@ spec:
         args:
           - |
             lowVersion=16.4
-            highVersion=17
+            highVersion=18
             pg_version=`psql -c "SHOW server_version;" -t | tr -d ' '`
             echo $pg_version |\
               awk -v pg_version=$pg_version -v low="$lowVersion" -v high="$highVersion" -F. '{
```

---

### Incident Patch 11: `f13d6a82` (2026-09-25)
**Commit Message**: fix(db): run 1.28.0 index changes inside transaction

**File**: `ee/scripts/schema/db/init_dbs/postgresql/1.28.0/1.28.0.sql` (modified, +5/-4)
```diff
@@ -30,11 +30,12 @@ DROP TYPE IF EXISTS error_status;
 ALTER TABLE IF EXISTS public.scim_auth_codes
     ADD COLUMN IF NOT EXISTS used_for_jwt bool DEFAULT NULL;
 
+CREATE INDEX IF NOT EXISTS sessions_notes_project_id_session_id_idx ON public.sessions_notes (project_id, session_id) WHERE deleted_at IS NULL;
+CREATE INDEX IF NOT EXISTS dashboards_project_id_idx ON public.dashboards (project_id) WHERE deleted_at IS NULL;
+CREATE INDEX IF NOT EXISTS dashboard_widgets_dashboard_id_metric_id_idx ON public.dashboard_widgets (dashboard_id, metric_id);
+DROP INDEX IF EXISTS public.user_favorite_sessions_user_id_session_id_idx;
+
 COMMIT;
-CREATE INDEX CONCURRENTLY IF NOT EXISTS sessions_notes_project_id_session_id_idx ON public.sessions_notes (project_id, session_id) WHERE deleted_at IS NULL;
-CREATE INDEX CONCURRENTLY IF NOT EXISTS dashboards_project_id_idx ON public.dashboards (project_id) WHERE deleted_at IS NULL;
-CREATE INDEX CONCURRENTLY IF NOT EXISTS dashboard_widgets_dashboard_id_metric_id_idx ON public.dashboard_widgets (dashboard_id, metric_id);
-DROP INDEX CONCURRENTLY IF EXISTS public.user_favorite_sessions_user_id_session_id_idx;
 
 \elif :is_next
 \echo new version detected :'next_version', nothing to do
```

**File**: `scripts/schema/db/init_dbs/postgresql/1.28.0/1.28.0.sql` (modified, +5/-4)
```diff
@@ -26,11 +26,12 @@ DROP TABLE IF EXISTS public.errors;
 DROP TYPE IF EXISTS error_source;
 DROP TYPE IF EXISTS error_status;
 
+CREATE INDEX IF NOT EXISTS sessions_notes_project_id_session_id_idx ON public.sessions_notes (project_id, session_id) WHERE deleted_at IS NULL;
+CREATE INDEX IF NOT EXISTS dashboards_project_id_idx ON public.dashboards (project_id) WHERE deleted_at IS NULL;
+CREATE INDEX IF NOT EXISTS dashboard_widgets_dashboard_id_metric_id_idx ON public.dashboard_widgets (dashboard_id, metric_id);
+DROP INDEX IF EXISTS public.user_favorite_sessions_user_id_session_id_idx;
+
 COMMIT;
-CREATE INDEX CONCURRENTLY IF NOT EXISTS sessions_notes_project_id_session_id_idx ON public.sessions_notes (project_id, session_id) WHERE deleted_at IS NULL;
-CREATE INDEX CONCURRENTLY IF NOT EXISTS dashboards_project_id_idx ON public.dashboards (project_id) WHERE deleted_at IS NULL;
-CREATE INDEX CONCURRENTLY IF NOT EXISTS dashboard_widgets_dashboard_id_metric_id_idx ON public.dashboard_widgets (dashboard_id, metric_id);
-DROP INDEX CONCURRENTLY IF EXISTS public.user_favorite_sessions_user_id_session_id_idx;
 
 \elif :is_next
 \echo new version detected :'next_version', nothing to do
```

---

### Incident Patch 12: `c7d9ad13` (2026-09-24)
**Commit Message**: fix(api): drop replay-exporter route prefix

**File**: `ee/backend/pkg/videoreplays/api/handlers.go` (modified, +4/-4)
```diff
@@ -41,10 +41,10 @@ func NewHandlers(log logger.Logger, cfg *config.Config, responser api.Responser,
 
 func (e *handlersImpl) GetAll() []*api.Description {
 	return []*api.Description{
-		{"/replay-exporter/{projectId}/session-videos", "POST", e.exportSessionVideo, []string{"SESSION_EXPORT"}, api.DoNotTrack},
-		{"/replay-exporter/{projectId}/session-videos", "GET", e.getSessionVideos, []string{"SESSION_EXPORT"}, api.DoNotTrack},
-		{"/replay-exporter/{projectId}/session-videos/{sessionId}", "DELETE", e.deleteSessionVideo, []string{"SESSION_EXPORT"}, api.DoNotTrack},
-		{"/replay-exporter/{projectId}/session-videos/{sessionId}", "GET", e.downloadSessionVideo, []string{"SESSION_EXPORT"}, api.DoNotTrack},
+		{"/{projectId}/session-videos", "POST", e.exportSessionVideo, []string{"SESSION_EXPORT"}, api.DoNotTrack},
+		{"/{projectId}/session-videos", "GET", e.getSessionVideos, []string{"SESSION_EXPORT"}, api.DoNotTrack},
+		{"/{projectId}/session-videos/{sessionId}", "DELETE", e.deleteSessionVideo, []string{"SESSION_EXPORT"}, api.DoNotTrack},
+		{"/{projectId}/session-videos/{sessionId}", "GET", e.downloadSessionVideo, []string{"SESSION_EXPORT"}, api.DoNotTrack},
 	}
 }
 
```

---

### Incident Patch 13: `0601034c` (2026-09-24)
**Commit Message**: fix(api): restore redis param, fix ee constructors, read replay export flag from config

**File**: `backend/internal/config/api/config.go` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@ type Config struct {
 	AssistCacheTTL        time.Duration `env:"REDIS_CACHE_TTL,default=5s"`
 	AssistBatchSize       int           `env:"REDIS_BATCH_SIZE,default=1000"`
 	AssistScanSize        int64         `env:"REDIS_SCAN_SIZE,default=1000"`
+	ReplayExportEnabled   bool          `env:"REPLAY_EXPORT_ENABLED,default=false"`
 	WorkerID              uint16
 }
 
```

**File**: `backend/pkg/api/builder.go` (modified, +3/-2)
```diff
@@ -38,8 +38,8 @@ import (
 	integrationsService "openreplay/backend/pkg/integrations/service"
 	"openreplay/backend/pkg/jobs"
 	"openreplay/backend/pkg/logger"
-	"openreplay/backend/pkg/metrics/database"
 	assistMetrics "openreplay/backend/pkg/metrics/assist"
+	"openreplay/backend/pkg/metrics/database"
 	"openreplay/backend/pkg/metrics/web"
 	"openreplay/backend/pkg/notes"
 	noteAPI "openreplay/backend/pkg/notes/api"
@@ -101,7 +101,7 @@ func (b *serviceBuilder) Close() {
 	b.wg.Wait()
 }
 
-func NewServiceBuilder(log logger.Logger, cfg *config.Config, webMetrics web.Web, assistMetric assistMetrics.Assist, dbMetrics database.Database, pgconn pool.Pool, chconn clickhouse.Conn, chSessionFactory chdb.SessionFactory, objStore objectstorage.ObjectStorage, projects projects.Projects, canvases canvas.Canvases) (Service, error) {
+func NewServiceBuilder(log logger.Logger, cfg *config.Config, webMetrics web.Web, assistMetric assistMetrics.Assist, dbMetrics database.Database, pgconn pool.Pool, redisClient *redis.Client, chconn clickhouse.Conn, chSessionFactory chdb.SessionFactory, objStore objectstorage.ObjectStorage, projects projects.Projects, canvases canvas.Canvases) (Service, error) {
 	responser := api.NewResponser(webMetrics)
 
 	reqValidator := validator.New()
@@ -268,6 +268,7 @@ func NewServiceBuilder(log logger.Logger, cfg *config.Config, webMetrics web.Web
 
 	extraHandlers, workers, err := eeServices(eeDeps{
 		log:        log,
+		cfg:        cfg,
 		pgconn:     pgconn,
 		objStore:   objStore,
 		projects:   projects,
```

**File**: `backend/pkg/api/extensions.go` (modified, +2/-0)
```diff
@@ -1,6 +1,7 @@
 package api
 
 import (
+	config "openreplay/backend/internal/config/api"
 	"openreplay/backend/pkg/db/postgres/pool"
 	"openreplay/backend/pkg/logger"
 	"openreplay/backend/pkg/metrics/database"
@@ -23,6 +24,7 @@ type Service interface {
 
 type eeDeps struct {
 	log        logger.Logger
+	cfg        *config.Config
 	pgconn     pool.Pool
 	objStore   objectstorage.ObjectStorage
 	projects   projects.Projects
```

**File**: `ee/backend/pkg/api/ee.go` (modified, +3/-5)
```diff
@@ -2,8 +2,6 @@ package api
 
 import (
 	"context"
-	"os"
-	"strconv"
 
 	"github.com/go-playground/validator/v10"
 
@@ -19,7 +17,7 @@ import (
 )
 
 func eeServices(d eeDeps) ([]api.Handlers, []Worker, error) {
-	if enabled, _ := strconv.ParseBool(os.Getenv("REPLAY_EXPORT_ENABLED")); !enabled {
+	if !d.cfg.ReplayExportEnabled {
 		d.log.Info(context.Background(), "replay export disabled, skipping video-replays setup")
 		return nil, nil, nil
 	}
@@ -36,8 +34,8 @@ func eeServices(d eeDeps) ([]api.Handlers, []Worker, error) {
 		return nil, nil, err
 	}
 
-	sess := sessions.New(d.log, d.pgconn, d.projects, nil, d.dbMetrics)
-	users := user.New(d.pgconn)
+	sess := sessions.New(d.log, d.pgconn, d.projects, nil, d.dbMetrics, sessions.DoNotIgnoreInactiveProjects)
+	users := user.New(d.pgconn, user.MCPConfig{})
 
 	svc, err := vsvc.New(d.log, vcfg, storage, batchJobs, d.objStore, users)
 	if err != nil {
```

---

### Incident Patch 14: `2987dde3` (2026-09-24)
**Commit Message**: ui: mobile layout for issues and tests

**File**: `frontend/app/components/Client/SmartTests/components/Defaults.tsx` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ function Defaults({ value, onChange }: Props) {
           {t('New tests start with these. You can override them per test.')}
         </Typography.Text>
       </div>
-      <div className="grid grid-cols-3 gap-3">
+      <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
         <Field label={t('Default environment')}>
           <Select
             allowClear
```

**File**: `frontend/app/components/Client/SmartTests/components/Environments.tsx` (modified, +2/-2)
```diff
@@ -173,15 +173,15 @@ function Environments() {
                 >
                   <Button
                     type="text"
-                    className="invisible group-hover:visible"
+                    className="invisible group-hover:visible pointer-coarse:visible"
                     icon={<PencilIcon size={16} />}
                     aria-label={t('Edit')}
                     onClick={() => openEdit(env)}
                   />
                   <Button
                     type="text"
                     danger
-                    className="invisible group-hover:visible"
+                    className="invisible group-hover:visible pointer-coarse:visible"
                     loading={
                       deleteEnv.isPending &&
                       deleteEnv.variables?.environmentId === env.id
```

**File**: `frontend/app/components/Client/SmartTests/components/RunsTab.tsx` (modified, +111/-63)
```diff
@@ -1,14 +1,16 @@
 import {
   Button,
+  Grid,
   Input,
+  Popover,
   Segmented,
   Select,
   Skeleton,
   Table,
   Tooltip,
 } from 'antd';
 import type { TableColumnsType } from 'antd';
-import { RotateCw } from 'lucide-react';
+import { RotateCw, SlidersHorizontal } from 'lucide-react';
 import React, { useEffect, useMemo, useRef, useState } from 'react';
 import { useTranslation } from 'react-i18next';
 import { toast } from 'react-toastify';
@@ -124,6 +126,10 @@ function RunsTab() {
     order?: 'ascend' | 'descend';
   }>({ field: 'date', order: 'descend' });
   const [page, setPage] = useState(1);
+  // below md: secondary columns drop, the table scrolls sideways and the
+  // filter selects fold into a popover
+  const narrow = Grid.useBreakpoint().md === false;
+  const selectWidth = (px: number) => (narrow ? '100%' : px);
 
   // adopt a cross-tab handoff exactly once when handoffId bumps — this pane stays
   // mounted between visits, so a fresh id is the signal
@@ -327,12 +333,14 @@ function RunsTab() {
       title: t('Tags'),
       dataIndex: 'tags',
       width: 160,
+      responsive: ['md'],
       render: (tags: string[]) => <RowTags tags={tags} />,
     },
     {
       title: t('Environment'),
       dataIndex: 'envName',
       width: 140,
+      responsive: ['md'],
       render: (envName?: string) =>
         envName ? (
           <span className="text-gray-dark truncate">{envName}</span>
@@ -344,6 +352,7 @@ function RunsTab() {
       title: t('Duration'),
       dataIndex: 'duration',
       width: 120,
+      responsive: ['md'],
       sorter: true,
       showSorterTooltip: false,
       render: (_: unknown, run) =>
@@ -390,6 +399,70 @@ function RunsTab() {
     },
   ];
 
+  const activeFilters =
+    [resFilter, tagFilter, envFilter, regionFilter].filter((f) => f !== 'all')
+      .length + (periodFilter !== '7' ? 1 : 0);
+  const filterSelects = (
+    <>
+      <Select
+        size="small"
+        value={resFilter}
+        onChange={setResFilter}
+        style={{ width: selectWidth(140) }}
+        options={[
+          { value: 'all', label: t('All viewports') },
+          ...RESOLUTION_OPTIONS.map((o) => ({
+            value: o.value,
+            label: t(o.label),
+          })),
+        ]}
+      />
+      <Select
+        size="small"
+        value={tagFilter}
+        onChange={setTagFilter}
+        style={{ width: selectWidth(130) }}
+        options={[
+          { value: 'all', label: t('All tags') },
+          ...tagOptions.map((tag) => ({ value: tag, label: tag })),
+        ]}
+      />
+      <Select
+        size="small"
+        value={envFilter}
+        onChange={setEnvFilter}
+        style={{ width: selectWidth(150) }}
+        options={[
+          { value: 'all', label: t('All environments') },
+          ...envOptions,
+        ]}
+      />
+      <Select
+        size="small"
+        value={regionFilter}
+        onChange={setRegionFilter}
+        style={{ width: selectWidth(140) }}
+        options={[
+          { value: 'all', label: t('All regions') },
+          ...REGION_OPTIONS.map((o) => ({
+            value: o.value,
+            label: o.label,
+          })),
+        ]}
+      />
+      <Select
+        size="small"
+        value={periodFilter}
+        onChange={setPeriodFilter}
+        style={{ width: selectWidth(130) }}
+        options={PERIOD_OPTIONS.map((o) => ({
+          value: o.value,
+          label: t(o.label),
+        }))}
+      />
+    </>
+  );
+
   if (isPending || holdingForTrigger) {
     return (
       <div className="p-4">
@@ -402,12 +475,23 @@ function RunsTab() {
     <div className="flex flex-col">
       {/* controls bar — status tabs (left) + search & filters (right) */}
       <div className="flex items-center justify-between gap-2 px-4 py-3 border-b flex-wrap">
-        <Segmented
-          size="small"
-          value={statusTab}
-          onChange={(v) => setStatusTab(v as StatusTab)}
-          options={statusOptions}
-        />
+        {narrow ? (
+          <Select
+            size="small"
+            value={statusTab}
+            onChange={(v) => setStatusTab(v as StatusTab)}
+            options={statusOptions}
+            popupMatchSelectWidth={false}
+            style={{ minWidth: 150 }}
+          />
+        ) : (
+          <Segmented
+            size="small"
+            value={statusTab}
+            onChange={(v) => setStatusTab(v as StatusTab)}
+            options={statusOptions}
+          />
+        )}
         <div className="flex items-center gap-2 flex-wrap">
           <Input.Search
             size="small"
@@ -417,69 +501,33 @@ function RunsTab() {
             onChange={(e) => setQuery(e.target.value)}
             style={{ width: 170 }}
           />
-          <Select
-            size="small"
-            value={resFilter}
-            onChange={setResFilter}
-            style={{ width: 140 }}
-            options={[
-              { value: 'all',
```

**File**: `frontend/app/components/Client/SmartTests/components/TestsTab.tsx` (modified, +26/-6)
```diff
@@ -3,6 +3,7 @@ import {
   Badge,
   Button,
   Dropdown,
+  Grid,
   Input,
   Segmented,
   Select,
@@ -128,6 +129,8 @@ function TestsTab() {
   // merge-in-review: the base test (first selected) carrying a client-only pendingMerge.
   // Nothing persists until "Combine".
   const [mergeTest, setMergeTest] = useState<TestCase | null>(null);
+  // below md: secondary columns drop and the table scrolls sideways
+  const narrow = Grid.useBreakpoint().md === false;
 
   // debounce the search box (the setState runs in a timer callback, not synchronously
   // in the effect body)
@@ -641,12 +644,14 @@ function TestsTab() {
       title: t('Tags'),
       dataIndex: 'tags',
       width: 190,
+      responsive: ['md'],
       render: (tags: string[]) => <RowTags tags={tags} />,
     },
     {
       title: t('Environment'),
       dataIndex: 'envNames',
       width: 150,
+      responsive: ['md'],
       showSorterTooltip: false,
       render: (envNames?: string[]) => {
         if (!envNames || envNames.length === 0)
@@ -670,6 +675,7 @@ function TestsTab() {
       title: t('Schedule'),
       dataIndex: 'schedule',
       width: 180,
+      responsive: ['md'],
       showSorterTooltip: false,
       render: (_: unknown, tc) =>
         !isScheduled(tc.schedule) ? (
@@ -689,6 +695,7 @@ function TestsTab() {
       title: t('Created'),
       dataIndex: 'createdAt',
       width: 120,
+      responsive: ['md'],
       sorter: true, // server-sorted via created_at (see SORT_FIELD)
       showSorterTooltip: false,
       render: (ts?: number) =>
@@ -807,12 +814,23 @@ function TestsTab() {
     <div className="flex flex-col">
       {/* controls bar — status tabs (left) + search & filters (right) */}
       <div className="flex items-center justify-between gap-2 px-4 py-3 border-b flex-wrap">
-        <Segmented
-          size="small"
-          value={statusTab}
-          onChange={(v) => setStatusTab(v as StatusTab)}
-          options={statusOptions}
-        />
+        {narrow ? (
+          <Select
+            size="small"
+            value={statusTab}
+            onChange={(v) => setStatusTab(v as StatusTab)}
+            options={statusOptions}
+            popupMatchSelectWidth={false}
+            style={{ minWidth: 150 }}
+          />
+        ) : (
+          <Segmented
+            size="small"
+            value={statusTab}
+            onChange={(v) => setStatusTab(v as StatusTab)}
+            options={statusOptions}
+          />
+        )}
         {selectedKeys.length > 0 ? (
           <div className="flex items-center gap-2 flex-wrap">
             <span className="text-sm text-disabled-text">
@@ -905,6 +923,8 @@ function TestsTab() {
         className="kai-table"
         rowKey="key"
         columns={columns}
+        tableLayout={narrow ? 'fixed' : undefined}
+        scroll={narrow ? { x: 520 } : undefined}
         dataSource={tests}
         pagination={false}
         rowSelection={{
```

**File**: `frontend/app/components/Client/SmartTests/components/drawers/DraftDrawer.tsx` (modified, +18/-5)
```diff
@@ -125,8 +125,14 @@ function DraftDrawer({
       <div className="flex items-center justify-between">
         {/* Dismiss rejects the proposal → the X ("reject a suggestion") rather than the
             bin ("delete something you built") */}
-        <Button type="text" danger icon={<X size={15} />} onClick={dismiss}>
-          {t('Dismiss')}
+        <Button
+          type="text"
+          danger
+          icon={<X size={15} />}
+          onClick={dismiss}
+          aria-label={t('Dismiss')}
+        >
+          <span className="max-sm:hidden">{t('Dismiss')}</span>
         </Button>
         <div className="flex items-center gap-2">
           <Button onClick={saveDraft}>{t('Save draft')}</Button>
@@ -146,20 +152,27 @@ function DraftDrawer({
           type="text"
           onClick={() => setStep(0)}
           icon={<ArrowLeft size={15} />}
+          aria-label={t('Back')}
         >
-          {t('Back')}
+          <span className="max-sm:hidden">{t('Back')}</span>
         </Button>
         <div className="flex items-center gap-2">
           <Button type="text" onClick={finalize}>
-            {scheduled ? t('Skip tags & finish') : t('Finish without schedule')}
+            <span className="max-sm:hidden">
+              {scheduled
+                ? t('Skip tags & finish')
+                : t('Finish without schedule')}
+            </span>
+            <span className="sm:hidden">{t('Finish')}</span>
           </Button>
           <Button
             type="primary"
             onClick={() => setStep(2)}
             icon={<ArrowRight size={15} />}
             iconPosition="end"
           >
-            {t('Continue to tags')}
+            <span className="max-sm:hidden">{t('Continue to tags')}</span>
+            <span className="sm:hidden">{t('Continue')}</span>
           </Button>
         </div>
       </div>
```

**File**: `frontend/app/components/Client/SmartTests/components/drawers/EditableSteps.tsx` (modified, +64/-2)
```diff
@@ -1,5 +1,7 @@
 import { Tooltip } from 'antd';
 import {
+  ArrowDown,
+  ArrowUp,
   Check,
   ChevronRight,
   CornerDownLeft,
@@ -161,8 +163,9 @@ function Gap({
       role="button"
       aria-label={label ?? t('Insert step')}
       onClick={onInsert}
+      // no hover on touch to reveal it, so there it would only catch stray taps
       className={`group/ins relative flex items-center justify-center cursor-pointer ${
-        always ? 'h-7' : 'h-5'
+        always ? 'h-7' : 'h-5 pointer-coarse:pointer-events-none'
       }`}
     >
       <div
@@ -197,6 +200,10 @@ interface StepRowProps {
   onEscape: () => void;
   onDragStart: (idx: number) => void;
   onDragEnd: () => void;
+  /** touch stand-in for drag: shift the row being edited up / down one slot */
+  onMove: (dir: -1 | 1) => void;
+  canMoveUp: boolean;
+  canMoveDown: boolean;
   onDecide?: (idx: number, decision: StepDecision) => void;
   /** merge review: "· N steps" suffix and collapse state of a group label row */
   groupMeta?: string;
@@ -221,6 +228,9 @@ function StepRow({
   onEscape,
   onDragStart,
   onDragEnd,
+  onMove,
+  canMoveUp,
+  canMoveDown,
   onDecide,
   groupMeta,
   groupCollapsed,
@@ -360,6 +370,26 @@ function StepRow({
           // mousedown-preventDefault keeps the input focused so its onBlur doesn't fire
           // first and commit/close before the click handler runs
           <>
+            <button
+              type="button"
+              aria-label={t('Move step up')}
+              disabled={!canMoveUp}
+              onMouseDown={(e) => e.preventDefault()}
+              onClick={() => onMove(-1)}
+              className="hidden pointer-coarse:flex w-6 h-6 rounded items-center justify-center text-gray-medium disabled:opacity-30"
+            >
+              <ArrowUp size={14} />
+            </button>
+            <button
+              type="button"
+              aria-label={t('Move step down')}
+              disabled={!canMoveDown}
+              onMouseDown={(e) => e.preventDefault()}
+              onClick={() => onMove(1)}
+              className="hidden pointer-coarse:flex w-6 h-6 rounded items-center justify-center text-gray-medium disabled:opacity-30"
+            >
+              <ArrowDown size={14} />
+            </button>
             <Tooltip title={t('Confirm — Enter')}>
               <button
                 type="button"
@@ -403,7 +433,7 @@ function StepRow({
                 e.stopPropagation();
                 onRemove(idx);
               }}
-              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 w-6 h-6 rounded flex items-center justify-center text-gray-medium hover:text-red hover:bg-red-lightest"
+              className="opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity shrink-0 w-6 h-6 rounded flex items-center justify-center text-gray-medium hover:text-red hover:bg-red-lightest"
             >
               <Trash2 size={14} />
             </button>
@@ -548,6 +578,35 @@ function EditableSteps({
     if (editingIdx === idx) setEditingIdx(null);
   };
 
+  // keeps the row in edit mode at its new slot so repeated taps keep moving it
+  const moveStep = (dir: -1 | 1) => {
+    if (editingIdx == null) return;
+    const to = editingIdx + dir;
+    if (to < 0 || to >= items.length) return;
+    const next = commitInto(editingIdx);
+    if (draft.trim() === '') {
+      emit(next);
+      setEditingIdx(null);
+      return;
+    }
+    const [row] = next.splice(editingIdx, 1);
+    next.splice(to, 0, row);
+    emit(next);
+    setEditingIdx(to);
+    // landing inside a collapsed merge group would hide the row being edited
+    for (let i = to - 1; i >= 0; i -= 1) {
+      if (next[i].kind !== 'group') continue;
+      const key = groupKey(next[i]);
+      setCollapsedGroups((prev) => {
+        if (!prev.has(key)) return prev;
+        const open = new Set(prev);
+        open.delete(key);
+        return open;
+      });
+      break;
+    }
+  };
+
   // ---- drag reorder ----
   const onDragStart = (idx: number) => {
     dragRef.current = idx;
@@ -728,6 +787,9 @@ function EditableSteps({
                     onEscape={onEscape}
                     onDragStart={onDragStart}
                     onDragEnd={onDragEnd}
+                    onMove={moveStep}
+                    canMoveUp={idx > 0}
+                    canMoveDown={idx < items.length - 1}
                     onDecide={onDecide}
                   />
                 </div>
```

**File**: `frontend/app/components/Client/SmartTests/components/drawers/EntityDrawer.tsx` (modified, +1/-1)
```diff
@@ -156,7 +156,7 @@ function EditableTitle({
         <span className="text-xl font-semibold text-black leading-tight truncate">
           {title}
         </span>
-        <span className="shrink-0 text-main opacity-0 group-hover:opacity-100 transition-opacity">
+        <span className="shrink-0 text-main opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity">
           <EditOutlined />
         </span>
       </div>
```

**File**: `frontend/app/components/Client/SmartTests/components/drawers/NetworkPanel.tsx` (modified, +8/-8)
```diff
@@ -114,9 +114,9 @@ function HeaderRows({ rows }: { rows?: { name: string; value: string }[] }) {
         // header names repeat (set-cookie, link…), so the index is part of the key
         <div
           key={`${h.name}-${i}`}
-          className="flex items-start gap-3 px-3 py-2 text-xs font-mono"
+          className="flex items-start gap-3 px-3 py-2 text-xs font-mono max-sm:flex-col max-sm:gap-0.5"
         >
-          <span className="w-40 shrink-0 text-gray-dark font-medium break-all">
+          <span className="w-40 shrink-0 text-gray-dark font-medium break-all max-sm:w-auto">
             {h.name}
           </span>
           <span className="flex-1 min-w-0 text-gray-darkest break-all">
@@ -343,9 +343,9 @@ function Detail({
   );
 }
 
-/** Grid columns shared by the request list header + rows. */
+/** Grid columns shared by the request list header + rows. Phones drop At + Size. */
 const NET_GRID =
-  'grid items-center gap-2 grid-cols-[52px_56px_minmax(0,1fr)_58px_64px_60px]';
+  'grid items-center gap-2 grid-cols-[52px_56px_minmax(0,1fr)_58px_64px_60px] max-sm:grid-cols-[40px_48px_minmax(0,1fr)_52px]';
 
 function NetworkPanel({
   reqs,
@@ -470,9 +470,9 @@ function NetworkPanel({
           <span>{t('Method')}</span>
           <span>{t('Request')}</span>
           <Tooltip title={t('When it fired, relative to the run start')}>
-            <span className="text-right">{t('At')}</span>
+            <span className="text-right max-sm:hidden">{t('At')}</span>
           </Tooltip>
-          <span className="text-right">{t('Size')}</span>
+          <span className="text-right max-sm:hidden">{t('Size')}</span>
           <span className="text-right">{t('Time')}</span>
         </div>
         {visible.length === 0 ? (
@@ -498,10 +498,10 @@ function NetworkPanel({
                 <span className="text-disabled-text">{hostOf(r.url)}</span>
                 <span className="text-gray-darkest"> {pathOf(r.url)}</span>
               </span>
-              <span className="text-right text-disabled-text tabular-nums">
+              <span className="text-right text-disabled-text tabular-nums max-sm:hidden">
                 {fmtOffset(r.time)}
               </span>
-              <span className="text-right text-disabled-text">
+              <span className="text-right text-disabled-text max-sm:hidden">
                 {fmtBytes(r.size)}
               </span>
               <span className="text-right text-disabled-text">
```

---

### Incident Patch 15: `51d03d9d` (2026-09-24)
**Commit Message**: ui: prevent react-compiler from freezing window.search read

**File**: `frontend/app/components/Client/SmartTests/components/shared/useUrlState.ts` (modified, +5/-4)
```diff
@@ -3,7 +3,7 @@ import { useCallback, useEffect, useRef } from 'react';
 import { useHistory, useLocation } from 'App/routing';
 
 // Track a single URL query param — the shape the Activity page uses for `event_id`. Returns
-// the current value (read natively from window.location.search) and a setter. The drawer/
+// the current value (from the router location) and a setter. The drawer/
 // modal open state is DERIVED from this value (open iff present); there is NO separate React
 // state syncing back to the URL, which is what created the back/forward feedback loop.
 //
@@ -15,15 +15,16 @@ import { useHistory, useLocation } from 'App/routing';
 export function useQueryParam(
   key: string,
 ): [string | null, (value?: string | null, push?: boolean) => void] {
-  // subscribe to location so the component re-renders on navigation (our writes + back/fwd)
-  useLocation();
+  // read from location.search, not window.location: React Compiler memoizes a
+  // window read with no reactive deps, freezing the value at mount
+  const { search } = useLocation();
   const history = useHistory();
   const historyRef = useRef(history);
   useEffect(() => {
     historyRef.current = history;
   }, [history]);
 
-  const value = new URLSearchParams(window.location.search).get(key);
+  const value = new URLSearchParams(search).get(key);
 
   const setParam = useCallback(
     (next?: string | null, push = false) => {
```

#### Recent Merged Pull Requests:
- **PR #4973** (2026-10-05): Updated patch build from main 86eb2fdb7db35c98419fa72c509604bae9462e9a (@estradino)
- **PR #4963** (2026-10-02): Updated patch build from main 0766e4555d64ef4e7ee03ca7b0ecffb2127c199f (@estradino)
- **PR #4962** (2026-10-02): Heatmap patch (@nick-delirium)
- **PR #4961** (2026-10-05): Player rewrites (@nick-delirium)
- **PR #4960** (2026-10-01): Updated patch build from main 832aa12844194c7aea1868149bb7d1d5ba592e72 (@estradino)
- **PR #4959** (2026-10-02): change(api): api improvements (@shekarsiri)
- **PR #4958** (2026-10-01): Updated patch build from main 820d6c3885fe4444c9218f99bc4d488a9468d65e (@estradino)
- **PR #4957** (2026-10-01): fix(chalice): fixed MCP validation (@tahayk)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
