# Forensic Learning Record (Deep Inspection): open-metadata/OpenMetadata

> **Canonical Artifact**: `07_PROJECT_LEARNING/open-metadata-openmetadata-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/open-metadata/OpenMetadata](https://github.com/open-metadata/OpenMetadata))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:33:09.988Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `open-metadata/OpenMetadata`
- **Description**: The Open Context Layer for Data and AI ,  OpenMetadata is the open platform for building trusted data context and business semantics for humans, AI assistants, and agents.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 15359 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `docker/development/mock-oidc-provider/server.js`
```
/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

const { Provider } = require('oidc-provider');
const express = require('express');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '9090', 10);
// ISSUER_BASE (no trailing slash) is used to build endpoint URLs; ISSUER
// (WITH trailing slash) is the identity string oidc-provider stamps into
// the `iss` claim of every issued token and echoes back in discovery.
// The @auth0/auth0-spa-js SDK computes its expected issuer as `${domain}/`
// (a mandatory trailing slash — mirroring how real Auth0 tenants advertise
// `iss` as `https://<tenant>.auth0.com/`) and refuses any token whose
// `iss` differs by a single character, so the mock has to emit `iss`
// with the slash. Keeping URL construction on the bare base avoids the
// `//` double-slash paths every `${ISSUER}/auth` template would otherwise
// generate.
const ISSUER_BASE = (process.env.ISSUER || `http://localhost:${PORT}`).replace(
  /\/+$/,
  ''
);
const ISSUER = `${ISSUER_BASE}/`;

// Mutable test state — controlled via /test/* endpoints
const DEFAULT_LOGIN_ACCOUNT = 'admin';

const testState = {
  accessTokenTTL: 3600,
  idTokenTTL: 3600,
  forceInteractionRequired: false,
  refreshTokenEnabled: true,
  tokenEndpointError: null, // { errorCode: 'invalid_grant', httpStatus: 400 }
  // Account auto-approved on the next interactive login. Lets a test exercise a
  // specific identity (e.g. one whose sub differs from the email local-part).
  defaultLoginAccount: DEFAULT_LOGIN_ACCOUNT,
};

const resetTestState = () => {
  testState.accessTokenTTL = 3600;
  testState.idTokenTTL = 3600;
  testState.forceInteractionRequired = false;
  testState.refreshTokenEnabled = true;
  testState.tokenEndpointError = null;
  testState.defaultLoginAccount = DEFAULT_LOGIN_ACCOUNT;
};

// Request metrics — reset via /test/metrics/reset
const metrics = { tokenRequests: 0, authRequests: 0, refreshAttempts: 0 };

// Pre-seeded test accounts — auto-approved, no interactive login
const TEST_ACCOUNTS = new Map([
  [
    'admin',
    {
      email: 'admin@open-metadata.org',
      email_verified: true,
      name: 'Test Admin',
      sub: 'admin',
      preferred_username: 'admin',
    },
  ],
  [
    'user1',
    {
      email: 'user1@open-metadata.org',
      email_verified: true,
      name: 'Test User 1',
      sub: 'user1',
      preferred_username: 'user1',
    },
  ],
  // Identity whose sub ('claim-user') deliberately differs from the email
  // local-part ('claim.user.mapped'). Used to verify OIDC self-signup persists
  // the mapped email claim instead of deriving <sub>@<domain>. See issue #29189.
  [
    'claim-user',
    {
      email: 'claim.user.mapped@open-metadata.org',
      email_verified: true,
      name: 'Claim Mapped User',
      sub: 'claim-user',
      preferred_username: 'claim-user',
    },
  ],
]);

const findAccount = (_ctx, id) => {
  const account = TEST_ACCOUNTS.get(id);
  if (!account) return undefined;
  return {
    accountId: id,
    async claims(_use, _scope) {
      return { sub: id, ...account };
    },
  };
};

// Every browser-side SPA client (public OIDC, mocked Auth0 tenant, mocked
// MSAL tenant) shares the same redirect set. Every SDK we host — oidc-client,
// @auth0/auth0-react, @azure/msal-browser — points at the OM SPA's own
// /callback (interactive) and /silent-callback (hidden iframe, oidc-client
// only). Keeping the list on one constant means adding a new port later is a
// single edit; forgetting to sync a client's list has bit us before.
const SPA_REDIRECT_URIS = [
  'http://localhost:8585/callback',
  'http://localhost:3000/callback',
  'http://localhost:8585/silent-callback',
];
const SPA_POST_LOGOUT_REDIRECT_URIS = [
  'http://localhost:8585',
  'http://localhost:3000',
];

const clients = [
  {
    client_id: 'openmetadata-test',
    client_secret: 'openmetadata-test-secret',
    grant_types: ['authorization_code', 'refresh_token'],
    redirect_uris: SPA_REDIRECT_URIS,
    post_logout_redirect_uris: SPA_POST_LOGOUT_REDIRECT_URIS,
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_post',
    scope: 'openid email profile offline_access',
  },
  {
    client_id: 'openmetadata-test-public',
    grant_types: ['authorization_code', 'refresh_token'],
    redirect_uris: SPA_REDIRECT_URIS,
    post_logout_redirect_uris: SPA_POST_LOGOUT_REDIRECT_URIS,
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: 'openid email profile offline_access',
  },
  // Auth0 SPA client. @auth0/auth0-react runs Authorization Code + PKCE with
  // no client secret, discovering endpoints from
  //   https://<domain>/.well-known/openid-configuration
  // — we serve that at the /auth0 path prefix (see the tenant-shape
  // responders below). This client_id is what the auth0-oidc fixture sets in
  // OM's `authenticationConfiguration.clientId`, so the SDK sends it on the
  // /authorize request and on the /oauth/token PKCE exchange.
  {
    client_id: 'openmetadata-auth0-client',
    grant_types: ['authorization_code', 'refresh_token'],
    redirect_uris: SPA_REDIRECT_URIS,
    post_logout_redirect_uris: SPA_POST_LOGOUT_REDIRECT_URIS,
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: 'openid email profile offline_access',
  },
  // MSAL SPA client. @azure/msal-browser runs Authorization Code + PKCE
  // against `${authority}/oauth2/v2.0/authorize` and
  // `${authority}/oauth2/v2.0/token`; the fixture points `authority` at
  //   http://localhost:9090/msal/<tid>/v2.0
  // and MSAL will discover endpoints via
  //   {authority}/.well-known/openid-configuration
  // which the tenant responder below serves. Same PKCE-only flow as Auth0.
  {
    client_id: 'openmetadata-msal-client',
    grant_types: ['authorization_code', 'refresh_token'],
    redirect_uris: SPA_REDIRECT_URIS,
    post_logout_redirect_uris: SPA_POST_LOGOUT_REDIRECT_URIS,
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: 'openid email profile offline_access',
  },
];

const providerConfig = {
  clients,
  findAccount,
  claims: {
    openid: ['sub'],
    email: ['email', 'email_verified'],
    profile: ['name', 'preferred_username'],
  },
  scopes: ['openid', 'email', 'profile', 'offline_access'],
  features: {
    devInteractions: { enabled: false },
    rpInitiatedLogout: { enabled: true },
  },
  pkce: {
    required: () => false,
  },
  ttl: {
    AccessToken: (_ctx, _token, _client) => testState.accessTokenTTL,
    IdToken: (_ctx, _token, _client) => testState.idTokenTTL,
    RefreshToken: (_ctx, _token, _client) =>
      testState.refreshTokenEnabled ? 86400 : 0,
    AuthorizationCode: 600,
    Session: 86400,
    Grant: 86400,
    Interaction: 600,
  },
  cookies: {
    keys: [crypto.randomBytes(32).toString('hex')],
  },
  jwks: {
    keys: [
      {
        kty: 'RSA',
        kid: 'mock-oidc-key-1',
        use: 'sig',
        alg: 'RS256',
        // Generated at startup; see init() below
      },
    ],
  },
  // Auto-approve all interactions (skip login/consent screens)
  interactions: {
    url(_ctx, _interaction) {
      return `/interaction/${_interaction.uid}`;
    },
  },
  renderError: async (ctx, out, _error) => {
    ctx.type = 'html';
    ctx.body = `<html><body><pre>${JSON.stringify(out, null, 2)}</pre></body></html>`;
  },
};

async function init() {
  const { generateKeyPair, exportJWK } = aw
```

### Core Architecture Module: `docker/validate_compose.py`
```
"""Wait for the sample_data DAG triggered by run_local_docker_common.sh to finish.

This runs inside the openmetadata_ingestion container via `docker exec`, which does
NOT inherit the host shell's exports. Every knob therefore has to be handed over as
an explicit `-e` flag by the caller; see the `docker exec` invocation in
run_local_docker_common.sh.

Output uses plain `print(flush=True)` rather than metadata.utils.logger: that module's
`basicConfig` never sets a level, so the root logger stays at WARNING and every INFO
progress line is silently dropped — the reason CI failures here used to arrive with no
diagnostics at all.

Every HTTP call is bounded by the time actually left, and the post-deadline diagnostic
pass gets its own small budget. A flat per-request timeout larger than the caller's
margin would let one stalled Airflow call carry the process past the outer `timeout`,
which killed the very diagnostics this script exists to print.

The wait is governed by VALIDATION_TIMEOUT_SECONDS on the host, forwarded here as
VALIDATE_COMPOSE_TIMEOUT_SECONDS. VALIDATE_COMPOSE_MAX_RETRIES may shorten that
deadline, but it cannot extend past the outer timeout's diagnostic margin.
"""

import os
import sys
import time
from urllib.parse import quote, urlencode

import requests

AIRFLOW_URL = "http://localhost:8080"
USERNAME = "admin"
PASSWORD = "admin"

DAG_ID = "sample_data"
TASK_ID = "ingest_using_recipe"

# Upper bound for a single poll request. Well under any caller margin, so a stalled
# Airflow cannot outlive the deadline.
POLL_REQUEST_TIMEOUT = 30
# Floor, so a request issued moments before the deadline still gets a fair chance
# rather than failing on a sub-second timeout.
MIN_REQUEST_TIMEOUT = 5
# The diagnostic pass runs *after* the deadline, inside the caller's margin, so it is
# capped hard: total wall clock and per request.
DIAGNOSTIC_BUDGET_SECONDS = 20
DIAGNOSTIC_REQUEST_TIMEOUT = 8
TASK_INSTANCE_PAGE_SIZE = 100

_access_token: str | None = None
_http_session: requests.Session | None = None
_last_dag_logs_supported: bool | None = None
_deadline: float | None = None


def log(message: str) -> None:
    print(message, flush=True)


def get_http_session() -> requests.Session:
    """Return the HTTP session shared by this validator invocation."""
    global _http_session

    if _http_session is None:
        _http_session = requests.Session()
    return _http_session


def get_json_object(
    response: requests.Response, response_name: str
) -> dict[str, object] | None:
    """Parse an Airflow JSON object without turning a proxy error into a validator crash."""
    try:
        payload = response.json()
    except ValueError:
        log(f"Airflow returned invalid JSON for {response_name}.")
        return None

    if not isinstance(payload, dict):
        log(f"Airflow returned an invalid {response_name} response.")
        return None

    return payload


def get_env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default

    try:
        return int(value)
    except ValueError:
        log(f"Invalid integer for {name}: {value}. Falling back to {default}.")
        return default


def resolve_timeout_seconds(poll_interval_seconds: int) -> int:
    """
    Wall-clock budget for the whole wait.

    An explicit retry count can shorten the wait, but cannot let it outlive the
    forwarded deadline. The host reserves the remaining outer-timeout budget for
    diagnostics, so extending this deadline would let `timeout` kill their output.
    """
    timeout_seconds = get_env_int("VALIDATE_COMPOSE_TIMEOUT_SECONDS", 600)
    if os.getenv("VALIDATE_COMPOSE_MAX_RETRIES") is not None:
        retry_timeout_seconds = get_env_int("VALIDATE_COMPOSE_MAX_RETRIES", 60) * poll_interval_seconds
        return min(timeout_seconds, retry_timeout_seconds)

    return timeout_seconds


def remaining_seconds() -> float:
    """Time left before the wait deadline; infinite until main() sets one."""
    if _deadline is None:
        return float("inf")

    return _deadline - time.monotonic()


def poll_request_timeout() -> float:
    """Bound a poll request by whatever budget is actually left."""
    return max(MIN_REQUEST_TIMEOUT, min(POLL_REQUEST_TIMEOUT, remaining_seconds()))


def get_access_token(timeout: float) -> str | None:
    """Get OAuth access token for the Airflow 3.x API."""
    global _access_token

    if _access_token:
        return _access_token

    try:
        response = get_http_session().post(
            f"{AIRFLOW_URL}/auth/token",
            headers={"Content-Type": "application/json"},
            json={"username": USERNAME, "password": PASSWORD},
            timeout=timeout,
        )
    except requests.exceptions.RequestException as exc:
        log(f"Could not reach the Airflow token endpoint: {exc}")
        return None

    if response.status_code != 201:
        log(f"Failed to get access token: {response.status_code} - {response.text}")
        return None

    payload = get_json_object(response, "access-token")
    if payload is None:
        return None

    access_token = payload.get("access_token")
    if not isinstance(access_token, str) or not access_token:
        log("Airflow access-token response did not contain an access token.")
        return None

    _access_token = access_token
    return _access_token


def airflow_get(path: str, timeout: float) -> requests.Response | None:
    """
    GET an Airflow API path, refreshing the cached token on 401.

    Returns None on any transport/auth problem so callers can keep polling: the
    Airflow API is routinely unreachable for the first ~40s after the container
    starts, and a blip mid-poll must not abort the wait.
    """
    global _access_token

    # Authentication shares this endpoint's budget; otherwise a token refresh can
    # double the duration of a poll issued close to the validation deadline.
    request_deadline = time.monotonic() + timeout
    for request_attempt in range(2):
        remaining = request_deadline - time.monotonic()
        if remaining <= 0:
            log(f"No time left to call {path} after authentication.")
            return None

        token = get_access_token(remaining)
        if not token:
            return None

        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        remaining = request_deadline - time.monotonic()
        if remaining <= 0:
            log(f"No time left to call {path} after authentication.")
            return None

        try:
            response = get_http_session().get(
                f"{AIRFLOW_URL}{path}", headers=headers, timeout=remaining
            )
        except requests.exceptions.RequestException as exc:
            log(f"Error calling {path}: {exc}")
            return None

        if response.status_code != 401:
            return response

        _access_token = None
        if request_attempt == 0:
            log(f"Airflow token rejected on {path}; refreshing it once.")
        else:
            log(f"Airflow token rejected after refresh on {path}.")

    return None


def get_last_run_info(
    target_dag_run_id: str | None,
    target_logical_date: str | None,
    timeout: float,
) -> tuple[str | None, str | None, bool]:
    """
    Targeted sample_data DAG run id and state.

    The third element reports whether the poll itself succeeded, so the caller can
    tell "Airflow has no run yet" apart from "we could not reach Airflow" — during the
    ~40s startup window those are very different things.
    """
    if target_dag_run_id:
        path = f"/api/v2/dags/{DAG_ID}/dagRuns/{quote(target_dag_run_id, safe='')}"
    else:
        query_params: dict[str, str | int] = {"limit": 1, "order_by": "-logical_date"}
        if target_logical_date:
            query_params["logical_date_gte"] = target_logical_date
            query_params["logical_date_lte"] = target_logical_date
        path = 
```

### Core Architecture Module: `ingestion/examples/airflow/dags/airflow_docker_operator.py`
```
#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
You can run this DAG from the default OM installation
"""

from datetime import datetime

from airflow import models
from airflow.providers.docker.operators.docker import DockerOperator

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineType,
)

config = """
source:
  type: mysql
  serviceName: local_mysql
  serviceConnection:
    config:
      type: Mysql
      username: openmetadata_user
      password: openmetadata_password
      hostPort: localhost:3306
      databaseSchema: openmetadata_db
      connectionOptions: {}
      connectionArguments: {}
  sourceConfig:
    config:
      type: DatabaseMetadata
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
"""


with models.DAG(
    "ingestion-docker-operator",
    schedule="@once",
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["OpenMetadata"],
) as dag:
    DockerOperator(
        command="python main.py",
        image="openmetadata/ingestion-base:local",
        environment={"config": config, "pipelineType": PipelineType.metadata.value},
        docker_url="unix://var/run/docker.sock",  # To allow to start Docker. Needs chmod 666 permissions
        tty=True,
        auto_remove="success",
        network_mode="host",  # To reach the OM server
        task_id="ingest",
        dag=dag,
    )

```

### Core Architecture Module: `ingestion/examples/airflow/dags/airflow_extended_sample_data.py`
```
#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

from datetime import datetime, timedelta

import yaml
from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from metadata.workflow.metadata import MetadataWorkflow

default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(seconds=10),
    "execution_timeout": timedelta(minutes=60),
}

config = """
source:
  type: custom-database
  serviceName: extended_sample_data
  serviceConnection:
    config:
      type: CustomDatabase
      sourcePythonClass: metadata.ingestion.source.database.extended_sample_data.ExtendedSampleDataSource
      connectionOptions:
        sampleDataFolder: "/home/airflow/ingestion/examples/sample_data"
        extendedSampleDataFolder: "/home/airflow/ingestion/examples/extended_sample_data"
  sourceConfig: {}
sink:
  type: metadata-rest
  config:
    api_endpoint: null
    bulk_sink_batch_size: 1
    enable_async_pipeline: false
    async_pipeline_workers: 2
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://openmetadata-server:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
"""


def metadata_ingestion_workflow():
    workflow_config = yaml.safe_load(config)
    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


with DAG(
    "extended_sample_data",
    default_args=default_args,
    description="An example DAG which runs a OpenMetadata ingestion workflow",
    start_date=datetime(2024, 1, 1),
    is_paused_upon_creation=True,
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="ingest_using_recipe",
        python_callable=metadata_ingestion_workflow,
    )

```

### Core Architecture Module: `ingestion/examples/airflow/dags/airflow_lineage_example.py`
```
#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
OpenMetadata Airflow Lineage Backend example. Airflow provides a pluggable lineage backend that can
read a DAG's configured inlets and outlets to compose a lineage. With OpenMetadata we have a airflow lineage backend
to get all of the workflows in Airflow and also any lineage user's configured.

IMPORTANT: This DAG requires the OpenMetadata Lineage Backend to be configured.
To enable it, set the following environment variables before starting Airflow:

    export OPENMETADATA_LINEAGE_ENABLED=true
    export AIRFLOW__LINEAGE__JWT_TOKEN=<your-openmetadata-jwt-token>

The ingestion_dependency.sh script will automatically configure the lineage backend when
OPENMETADATA_LINEAGE_ENABLED=true is set.

Please refer to https://docs.open-metadata.org/connectors/pipeline/airflow/lineage-backend on how to configure the lineage backend
with Airflow Scheduler

This is an example to demonstrate on how to configure a Airflow DAG's inlets and outlets.
"""

from datetime import datetime, timedelta

from airflow.decorators import dag, task

from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.source.pipeline.airflow.lineage_parser import OMEntity

default_args = {
    "owner": "openmetadata_airflow_example",
    "depends_on_past": False,
    "email": ["user@company.com"],
    "execution_timeout": timedelta(minutes=5),
}


@dag(
    default_args=default_args,
    dag_id="sample_lineage",
    description="OpenMetadata Airflow Lineage example DAG",
    schedule=timedelta(days=1),
    start_date=datetime(2024, 1, 1),
    catchup=False,
    is_paused_upon_creation=True,
)
def openmetadata_airflow_lineage_example():
    """
    This DAG demonstrates three different patterns for defining lineage with inlets and outlets.

    Requirements:
    1. OpenMetadata server must be accessible
    2. AIRFLOW__LINEAGE__* environment variables must be configured (see LINEAGE_SETUP.md)
    3. Set OPENMETADATA_LINEAGE_ENABLED=true before starting Airflow
    """

    # Example 1: Simple dict with tables list
    @task(
        inlets={"tables": ["sample_data.ecommerce_db.shopify.raw_order"]},
        outlets={"tables": ["sample_data.ecommerce_db.shopify.fact_order"]},
    )
    def generate_data():
        """Task demonstrating simple lineage with table FQNs"""
        pass  # noqa: PIE790

    # Example 2: Using OMEntity objects
    @task(
        inlets=[OMEntity(entity=Container, fqn="s3_storage_sample.transactions", key="test")],
        outlets=[
            OMEntity(
                entity=Table,
                fqn="sample_data.ecommerce_db.shopify.raw_order",
                key="test",
            )
        ],
    )
    def generate_data2():
        """Task demonstrating lineage with OMEntity objects"""
        pass  # noqa: PIE790

    # Example 3: Using dict with entity type
    @task(
        inlets=[
            {
                "entity": "container",
                "fqn": "s3_storage_sample.departments",
                "key": "test",
            }
        ],
        outlets=[
            {
                "entity": "table",
                "fqn": "sample_data.ecommerce_db.shopify.raw_order",
                "key": "test",
            }
        ],
    )
    def generate_data3():
        """Task demonstrating lineage with dict-based entity definitions"""
        pass  # noqa: PIE790

    generate_data()
    generate_data2()
    generate_data3()


openmetadata_airflow_lineage_example_dag = openmetadata_airflow_lineage_example()

```

### Core Architecture Module: `ingestion/examples/airflow/dags/airflow_metadata_extraction.py`
```
#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
This DAG can be used directly in your Airflow instance after installing
the `openmetadata-ingestion[airflow-container]` package. Its purpose
is to connect to the underlying database, retrieve the information
and push it to OpenMetadata.
"""

from datetime import datetime, timedelta

import yaml
from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from metadata.workflow.metadata import MetadataWorkflow

default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
    "execution_timeout": timedelta(minutes=60),
}

config = """
source:
  type: airflow
  serviceName: airflow_source
  serviceConnection:
    config:
      type: Airflow
      hostPort: http://localhost:8080
      numberOfStatus: 10
      connection:
        type: Backend
  sourceConfig:
    config:
      type: PipelineMetadata
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  loggerLevel: INFO
  openMetadataServerConfig:
    hostPort: http://openmetadata-server:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
"""


def metadata_ingestion_workflow():
    workflow_config = yaml.safe_load(config)
    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


with DAG(
    "airflow_metadata_extraction",
    default_args=default_args,
    description="An example DAG which pushes Airflow data to OM",
    start_date=datetime(2024, 1, 1),
    is_paused_upon_creation=True,
    schedule="*/5 * * * *",
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="ingest_using_recipe",
        python_callable=metadata_ingestion_workflow,
    )

```

### Core Architecture Module: `ingestion/examples/airflow/dags/airflow_sample_data.py`
```
#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

from datetime import datetime, timedelta

import yaml
from airflow import DAG

try:
    from airflow.operators.python import PythonOperator
except ModuleNotFoundError:
    from airflow.operators.python_operator import PythonOperator

from metadata.workflow.metadata import MetadataWorkflow

default_args = {
    "owner": "user_name",
    "email": ["username@org.com"],
    "email_on_failure": False,
    "retries": 3,
    "retry_delay": timedelta(seconds=10),
    "execution_timeout": timedelta(minutes=60),
}

config = """
source:
  type: custom-database
  serviceName: sample_data
  serviceConnection:
    config:
      type: CustomDatabase
      sourcePythonClass: metadata.ingestion.source.database.sample_data.SampleDataSource
      connectionOptions:
        sampleDataFolder: "/home/airflow/ingestion/examples/sample_data"
  sourceConfig: {}
sink:
  type: metadata-rest
  config:
    api_endpoint: null
    bulk_sink_batch_size: 1
    enable_async_pipeline: false
    async_pipeline_workers: 2
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://openmetadata-server:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
"""


def metadata_ingestion_workflow():
    workflow_config = yaml.safe_load(config)
    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


with DAG(
    "sample_data",
    default_args=default_args,
    description="An example DAG which runs a OpenMetadata ingestion workflow",
    start_date=datetime(2024, 1, 1),
    is_paused_upon_creation=True,
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="ingest_using_recipe",
        python_callable=metadata_ingestion_workflow,
    )

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #34277** (2026-09-30): **Late or deleted test results leave a test case's status and incident out of date**
  *Symptoms*: ### Affected module  Backend (data quality)  ### Describe the bug  A test case carries its current status. The table's Data Quality tab, the table's DQ icon, the data quality dashboards and the test case search filters all read it. That status should follow the **newest** result. Since 1.13.0 it follows whichever result was **written or deleted last**:  - If a result with an older timestamp is posted after a newer one (a backfill, a retry, re-ingesting an old run), the older result's status becomes the test case's status. - If the newest result is deleted, the test case keeps the deleted result's status instead of going back to the previous one. If the only result is deleted, the old status stays in search. - The incident side effects ignore ordering too. An older Success posted late auto-resolves the incident opened by a newer failure, and an older Failed posted late can open an incident while the test is currently passing.  ### Why it happens  `TestCaseResultRepository.updateTestCaseStatus` has a guard that skips results older than the current one (it logs `[RACE-CONDITION-MONITOR]`), added in 1.12. #25751 (1.13.0) changed how the test case is loaded there, so the search document is always refreshed. Loaded that way, `testCaseResult` is empty: the latest result is never stored on the test case row, it is only rebuilt from the results table on read. So the guard's comparison never runs, and the delete branch never recomputes the latest result. The incident calls in `addTestC

- **Issue #34226** (2026-09-29): **An announcement with no entityLink crashes the MyData and Data Marketplace pages**
  *Symptoms*: ## Describe the bug  An announcement with **no `entityLink`** crashes the whole MyData page and the Data Marketplace announcements widget:  ``` TypeError: Cannot read properties of undefined (reading 'split') ```  `EntityLink.split` returns `[]` for an empty or unparseable link, so `getEntityFqn` indexes it to `undefined` while its signature promises a `string`. Two callers take it at its word:  ```ts // AnnouncementCardV1.component.tsx:56   (MyData widget) // AnnouncementItemV2.component.tsx:40   (Data Marketplace widget) const fqn = getEntityFQN(announcement.entityLink ?? ''); entityName: fqn.split('::').pop() || '', ```  It throws inside a `useMemo` during render, so React unwinds to the error boundary — the **entire page** becomes *"Something went wrong"*, not just the card.  The `?? ''` already on those call sites is the tell: the *input* was guarded, the return value was not.  `getEntityColumnFqn` has a quieter variant of the same bug — it interpolates `undefined` into the literal string `"undefined"`, a non-empty value that reads as a real FQN wherever it is rendered or compared.  ## To Reproduce  1. Create an announcement over the API with no `entityLink` — the schema allows it, `createAnnouncement.json` requires only `description`, `startTime` and `endTime`. The API returns `201`. 2. Open `/my-data`. 3. The page renders *"Something went wrong — Cannot read properties of undefined (reading 'split')"*.  Same on the Data Marketplace announcements widget.  ## Expected be

- **Issue #34212** (2026-09-29): **TierUpdate approval leaves assets with multiple tiers**
  *Symptoms*: ### Describe the bug  Approving a `TierUpdate` task adds the requested tier without removing the asset's current tier. For example, approving Tier1 for an asset tagged Tier3 leaves both `Tier.Tier1` and `Tier.Tier3` attached.  The approval writes directly to tag relationships instead of using the normal entity update path. As a result, the entity version does not advance and the tier change is not recorded in the entity change description.  ### Steps to reproduce  1. Create or select an asset tagged `Tier.Tier3`. 2. Create a `TierUpdate` task requesting `Tier.Tier1`. 3. Approve the task. 4. Fetch the asset and inspect its tags and version. 5. Attempt another entity update, such as changing its description.  ### Actual behavior  - The asset contains both `Tier.Tier1` and `Tier.Tier3`. - The entity version is unchanged. - The tier change is absent from the change description. - Later PATCH/PUT requests fail because the two tiers are mutually exclusive.  ### Expected behavior  - The incoming tier replaces the existing mutually exclusive tier. - The update follows the normal entity PATCH path. - The entity version advances and the change description records the removed and added tiers. - Subsequent entity updates continue to succeed.  ### Impact  Affected assets become invalid and cannot be edited until the extra tier is removed manually. 

- **Issue #34137** (2026-09-29): **Table/View Definition Removed After Custom Property Update**
  *Symptoms*: ### Affected module  Backend  ### Describe the bug  When a custom property is added or updated on a table or view, the existing schema definition or view definition is removed and is not persisted.  ### To Reproduce  1. Navigate to a table or view in Collate. 2. Add or update a custom property. 3. Save the changes. 4. Check the table's schema definition or the view's view definition.  ### Expected behavior  Updating a custom property should preserve the existing schema definition or view definition.  ### OS  _No response_  ### Python version  _No response_  ### OpenMetadata version  2.0.2  ### OpenMetadata Ingestion package version  _No response_  ### Additional context  _No response_  ### Pre-submission checklist  - [x] I searched for duplicate issues. - [x] I removed credentials, hostnames, emails, and other sensitive data from logs and config.
  **Post-Mortem & Fix Analysis**:
  > Fixed by #34053 (main), backported to 2.0 in #34164 and 1.13 in #34165. It will ship in **2.0.3** and **1.13.7**.  **Cause:** backend, not UI. The UI sends only `replace /extension/<property>`, but `TableRepository.PATCH_FIELDS` did not include `schemaDefinition`. So any table PATCH (custom property, description, tags, display name, …) loaded the table without its definition and saved it that way.  **Verified** on fresh instances built from the merged `1.13` and `2.0` branch tips, compared against the 1.13.6 and 2.0.2 release images: - UI: edit a custom property on a view, reload → View Definition is gone on 1.13.6 / 2.0.2 and kept on both branch tips. - API: on a table with every settable field populated, each PATCH type (custom property, description, tag, display name, column description) was checked against every field. The unpatched releases drop only `schemaDefinition`; the branch tips keep all fields. - Also fixed by the same change: `remove /schemaDefinition` (sent by ingestion)

- **Issue #34112** (2026-09-29): **Explore column cards show the parent table's certification badge**
  *Symptoms*: ### Affected module UI: Explore page search result cards.  ### Describe the bug When a table is certified, every one of its columns shows the same certification badge on its Explore search result card. Open the column in the Explore summary panel, though, and there's no certification at all. A column isn't certified just because its table is, so the badge on the card is misleading and doesn't match the panel.  The badge comes from the column's search doc, which carries the parent table's `certification`. `ExploreSearchCard` draws a badge for any search result that has one, whatever its entity type.  ### To Reproduce 1. Certify a table, e.g. set **Certification.Gold** on it. 2. Go to **Explore → Columns** and search for one of that table's columns. 3. The column's card shows the Gold certification badge next to its name. 4. Click the card. The summary panel shows no certification.  ### Expected behavior Column cards don't show a certification badge. Table cards still show theirs.  ### Version - OpenMetadata: main (2.0.0-SNAPSHOT)

- **Issue #34058** (2026-09-27): **Flaky ITs: async restore 404s on restored children with the Redis cache; IT search pool runs on schema defaults**
  *Symptoms*: ### Affected module  Backend (entity cache) and the backend integration-test harness  ### Describe the bug  Two integration tests fail intermittently in CI and have been evicting PRs from the merge queue.  **1. With the Redis cache on, a restored child can 404 right after an async restore commits.** `RestoreHierarchyIT.asyncRestore_returns202AndRestoresFullHierarchy` fails in the `postgres-elasticsearch-redis, parallel` lane with `databaseSchema instance for <id> not found`.  Since #33866, the restore cascade's children are evicted from Redis only after the transaction commits, in `EntityRepository.drainCacheInvalidations`. The drain goes one entity at a time, with about ten synchronous Redis calls each. The restored root (the database) is still evicted inline by `EntityUpdater`, so it reads as restored the moment the transaction commits. Its schemas and tables keep serving their soft-deleted cached copies until the drain reaches them. A client that sees the restored database and then fetches a schema inside that window gets a 404.  Any read in that window also copies the stale Redis entry into the in-JVM L1 cache, and nothing evicts it after the commit. `EntityCacheRepair`'s 500 ms backstop is timed from the in-transaction eviction, so it can fire before a long transaction commits.  In one failing run (merge queue for #33338), the database was re-read as restored at 14:40:43.21 (server log) and the schema GET 404'd about 0.2 s later. The async restore job finished at 14:40:4

- **Issue #34044** (2026-09-25): **Bulk pipeline status updates blank owners, domains, tags and certification in the pipeline search index**
  *Symptoms*: ### Affected module  Search / Discovery  ### Describe the bug  `PUT /api/v1/pipelines/{fqn}/status/bulk` wipes the pipeline's relationship fields from its search document. After a bulk status push, `pipeline_search_index` holds `owners: []`, `ownerName: []`, `domains: []`, `tags: []` and no `certification`. `GET /api/v1/pipelines/name/{fqn}?fields=owners,domains,tags,certification` still returns them. Explore filters and facets, and anything else reading the search API, then miss these pipelines.  A full reindex restores the documents, but the next bulk status push blanks them again. The single-status endpoint (`PUT /api/v1/pipelines/{fqn}/status`) is not affected.  **Cause.** `PipelineRepository.addBulkPipelineStatus` loads the pipeline with `findEntityByName`, which returns no owners, domains, tags or certification. It then re-indexes that entity without a status change description, so `SearchRepository.updateEntityIndex` takes the full-document path. The document is rebuilt from the bare entity and its empty values overwrite the indexed ones.  `addPipelineStatus` attaches a `pipelineStatus` change description. That routes it to the scripted update, which writes only `pipelineStatus` and `updatedAt`.  ### To Reproduce  1. Create a pipeline with an owner, a domain, a tag and a certification. 2. Once it's indexed, `GET /api/v1/search/get/pipeline_search_index/doc/{id}` shows owners, domains, tags and certification. 3. `PUT /api/v1/pipelines/{fqn}/status/bulk` with one or more

- **Issue #34041** (2026-09-28): **Ingestion list Success count shows 0 for runs that only update records (e.g. Automator)**
  *Symptoms*: ### Description  On the ingestion list **Count** column (the Automations page and the service **Ingestion** tab), the **Success** count shows **0** for pipeline types that report their applied changes under `updated_records` instead of `records`. The **Automator** is the clearest case — a fully successful run that updated N entities reports:  ```json "status": [{ "name": "Automator", "records": 0, "updated_records": 30 }] ```  …and the UI shows `Success: 0` (with `Failed: 0`, `Warning: 0`), which reads as "nothing happened," even though the run succeeded and demonstrably updated entities.  ### Steps to reproduce  1. Run an Automator automation that updates some entities (e.g. an "Add Owner" action). 2. Open the Automations page (or the service Ingestion tab) and look at the Count column for that run.  **Actual:** Success = 0. **Expected:** Success reflects the applied changes (e.g. 30).  ### Root cause  `getIngestionStatusCountData` (`openmetadata-ui/src/main/resources/ui/src/utils/IngestionConfigUtils.ts`) computes Success from `summary.records` only:  ```ts value: getReadableCountString(summary?.records ?? 0, 1),  // Success ```  `updated_records` is never read in the count path, so any pipeline type that records work as *updates* rather than *new records* shows 0. (Failed/Warning read `errors`/`warnings` and are correct.)  ### Expected fix  Count `records` + `updated_records` for Success — disjoint successes (created vs updated), matching the ingestion framework's own succ

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

### Incident Patch 1: `b77012a2` (2026-09-30)
**Commit Message**: fix(data-quality): keep a test case's status on its newest result (#34280)

* fix(data-quality): keep a test case's status on its newest result

* fix(data-quality): drop cleared test case status fields on every search update path

* fix(data-quality): keep indexed test case status on unrelated edits and close the status update race

* fix(data-quality): only clear the indexed test case status when no newer result was indexed

**File**: `openmetadata-integration-tests/src/test/java/org/openmetadata/it/tests/TestCaseLatestStatusIT.java` (added, +326/-0)
```diff
@@ -0,0 +1,326 @@
+package org.openmetadata.it.tests;
+
+import static org.awaitility.Awaitility.await;
+import static org.junit.jupiter.api.Assertions.assertEquals;
+import static org.junit.jupiter.api.Assertions.assertNotNull;
+import static org.junit.jupiter.api.Assertions.assertNull;
+
+import com.fasterxml.jackson.core.type.TypeReference;
+import java.time.Duration;
+import java.util.List;
+import java.util.Map;
+import java.util.Optional;
+import java.util.UUID;
+import java.util.function.Predicate;
+import org.junit.jupiter.api.Test;
+import org.junit.jupiter.api.extension.ExtendWith;
+import org.junit.jupiter.api.parallel.Execution;
+import org.junit.jupiter.api.parallel.ExecutionMode;
+import org.openmetadata.it.factories.ShortStackFactory;
+import org.openmetadata.it.util.SdkClients;
+import org.openmetadata.it.util.TestNamespace;
+import org.openmetadata.it.util.TestNamespaceExtension;
+import org.openmetadata.schema.api.tests.CreateTestCaseResult;
+import org.openmetadata.schema.api.tests.CreateTestSuite;
+import org.openmetadata.schema.entity.data.Table;
+import org.openmetadata.schema.tests.TestCase;
+import org.openmetadata.schema.tests.TestSuite;
+import org.openmetadata.schema.tests.type.TestCaseResult;
+import org.openmetadata.schema.tests.type.TestCaseStatus;
+import org.openmetadata.schema.utils.JsonUtils;
+import org.openmetadata.schema.utils.ResultList;
+import org.openmetadata.sdk.client.OpenMetadataClient;
+import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
+import org.openmetadata.sdk.network.HttpMethod;
+import org.openmetadata.sdk.network.RequestOptions;
+
+/**
+ * A test case's current status (stored on the test case and copied into its search document) must
+ * follow its newest result by timestamp, whatever order results are written or deleted in. Reads
+ * here deliberately avoid {@code fields=testCaseResult}: that field is rebuilt from the results
+ * table on read, so it looks right even when the stored status is stale.
+ */
+@Execution(ExecutionMode.CONCURRENT)
+@ExtendWith(TestNamespaceExtension.class)
+class TestCaseLatestStatusIT {
+
+  private static final Duration SEARCH_TIMEOUT = Duration.ofSeconds(120);
+  private static final Duration HOLD = Duration.ofSeconds(5);
+  private static final String INCIDENT_WORKFLOW = "TestCaseResolutionTaskWorkflow";
+  private static final long MINUTE = 60_000L;
+
+  private final OpenMetadataClient client = SdkClients.adminClient();
+
+  @Test
+  void anOlderSuccessPostedLateKeepsTheNewerFailureAndItsIncident(TestNamespace ns) {
+    Fixture f = fixture(ns, "late_success");
+    enableAutoCloseIncident(f.testCase());
+    long now = System.currentTimeMillis();
+
+    postResult(f, now, TestCaseStatus.Failed);
+    UUID incident = awaitOpenIncident(f);
+    postResult(f, now - MINUTE, TestCaseStatus.Success);
+
+    awaitCurrentStatus(f, TestCaseStatus.Failed);
+    await().during(HOLD).atMost(HOLD.plusSeconds(10)).until(() -> incident.equals(incidentId(f)));
+  }
+
+  @Test
+  void anOlderFailurePostedLateKeepsTheNewerSuccessAndOpensNoIncident(TestNamespace ns) {
+    Fixture f = fixture(ns, "late_failure");
+    long now = System.currentTimeMillis();
+
+    postResult(f, now, TestCaseStatus.Success);
+    postResult(f, now - MINUTE, TestCaseStatus.Failed);
+
+    awaitCurrentStatus(f, TestCaseStatus.Success);
+    await().during(HOLD).atMost(HOLD.plusSeconds(10)).until(() -> incidentId(f) == null);
+  }
+
+  @Test
+  void deletingTheNewestResultFallsBackToThePreviousOne(TestNamespace ns) {
+    Fixture f = fixture(ns, "delete_newest");
+    long now = System.currentTimeMillis();
+    postResult(f, now - MINUTE, TestCaseStatus.Failed);
+    postResult(f, now, TestCaseStatus.Success);
+    awaitCurrentStatus(f, TestCaseStatus.Success);
+
+    client.testCaseResults().delete(f.fqn(), now);
+
+    awaitCurrentStatus(f, TestCaseStatus.Failed);
+  }
+
+  @Test
+  void deletingTheOnlyResultClearsTheStatus(TestNamespace ns) {
+    Fixture f = fixture
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/jdbi3/TestCaseResultRepository.java` (modified, +96/-31)
```diff
@@ -5,6 +5,7 @@
 import static org.openmetadata.service.Entity.TEST_CASE_RESULT;
 import static org.openmetadata.service.Entity.TEST_DEFINITION;
 
+import com.google.common.annotations.VisibleForTesting;
 import jakarta.json.JsonPatch;
 import jakarta.ws.rs.core.Response;
 import jakarta.ws.rs.core.UriInfo;
@@ -32,6 +33,7 @@
 import org.openmetadata.schema.utils.ResultList;
 import org.openmetadata.service.Entity;
 import org.openmetadata.service.exception.EntityNotFoundException;
+import org.openmetadata.service.exception.PreconditionFailedException;
 import org.openmetadata.service.governance.workflows.WorkflowEventConsumer;
 import org.openmetadata.service.resources.dqtests.TestCaseResultResource;
 import org.openmetadata.service.search.SearchListFilter;
@@ -43,8 +45,19 @@
 public class TestCaseResultRepository extends EntityTimeSeriesRepository<TestCaseResult> {
   public static final String TESTCASE_RESULT_EXTENSION = "testCase.testCaseResult";
   private static final String TEST_CASE_RESULT_FIELD = "testCaseResult";
+  private static final String CLEAR_INDEXED_STATUS_SCRIPT =
+      """
+      def indexed = ctx._source.testCaseResult;
+      if (indexed == null || indexed.timestamp == null || indexed.timestamp <= params.deletedTimestamp) {
+        ctx._source.remove('testCaseResult');
+        ctx._source.remove('testCaseStatus');
+      } else {
+        ctx.op = 'noop';
+      }
+      """;
   public static final String TEST_CASE_INDEX_FIELDS =
       "testDefinition,testSuite,testSuites,owners,tags,followers";
+  private static final int STATUS_UPDATE_ATTEMPTS = 3;
   private final TestCaseRepository testCaseRepository;
   private final TestCaseDimensionResultRepository dimensionResultRepository;
   public static String INCLUDE_SEARCH_FIELDS =
@@ -91,11 +104,17 @@ public ResultList<TestCaseResult> getTestCaseResults(String fqn, Long startTs, L
   public Response addTestCaseResult(
       String updatedBy, UriInfo uriInfo, String fqn, TestCaseResult testCaseResult) {
     TestCase testCase = Entity.getEntityByName(TEST_CASE, fqn, "incidentId", Include.ALL);
-    if (testCaseResult.getTestCaseStatus() == TestCaseStatus.Success) {
-      testCaseRepository.deleteTestCaseFailedRowsSample(testCase.getId());
-      autoResolveIncidentOnSuccess(testCase);
+    // A result older than the stored newest one is history: it must not resolve or open incidents,
+    // nor drop the failed rows sample, which all describe the test case's current state.
+    if (isCurrentResult(testCaseResult, getLatestRecord(testCase.getFullyQualifiedName()))) {
+      if (testCaseResult.getTestCaseStatus() == TestCaseStatus.Success) {
+        testCaseRepository.deleteTestCaseFailedRowsSample(testCase.getId());
+        autoResolveIncidentOnSuccess(testCase);
+      }
+      setTestCaseResultIncidentId(testCaseResult, testCase, updatedBy);
+    } else {
+      testCaseResult.setIncidentId(null);
     }
-    setTestCaseResultIncidentId(testCaseResult, testCase, updatedBy);
 
     // Store dimensional results if present
     if (testCaseResult.getDimensionResults() != null
@@ -287,40 +306,86 @@ private EntityReference getTestDefinitionReference(TestCase testCase, String tes
     return testCase.getTestDefinition();
   }
 
-  private void updateTestCaseStatus(TestCaseResult testCaseResult, OperationType operationType) {
-    // Load the index-relevant relationship fields, but avoid the hydrated "*" view. The "*"
-    // path now reads the latest result/incident back from the time-series table, which masks the
-    // denormalized change we need to persist into the entity row and search document.
+  /**
+   * Keeps the test case's denormalized status (entity row and search document) on its newest
+   * result. The test case row never stores {@code testCaseResult}, so the newest result is read
+   * back from the results table, which already reflects the write or delete that triggered this.
+   */
+  private void updateTestCaseStatus(TestCaseResult chan
```

**File**: `openmetadata-service/src/test/java/org/openmetadata/service/jdbi3/TestCaseResultRepositoryTest.java` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+package org.openmetadata.service.jdbi3;
+
+import static org.junit.jupiter.api.Assertions.assertEquals;
+import static org.junit.jupiter.api.Assertions.assertFalse;
+import static org.junit.jupiter.api.Assertions.assertTrue;
+import static org.mockito.ArgumentMatchers.any;
+import static org.mockito.ArgumentMatchers.anyString;
+import static org.mockito.ArgumentMatchers.eq;
+import static org.mockito.Mockito.doAnswer;
+import static org.mockito.Mockito.mock;
+
+import java.util.ArrayList;
+import java.util.List;
+import org.junit.jupiter.api.Test;
+import org.mockito.MockedStatic;
+import org.mockito.Mockito;
+import org.openmetadata.schema.tests.TestCase;
+import org.openmetadata.schema.tests.type.TestCaseResult;
+import org.openmetadata.schema.tests.type.TestCaseStatus;
+import org.openmetadata.service.Entity;
+import org.openmetadata.service.jdbi3.TestCaseResultRepository.OperationType;
+
+class TestCaseResultRepositoryTest {
+
+  private static final String FQN = "svc.db.schema.table.row_count";
+
+  private static TestCaseResult result(long timestamp) {
+    return new TestCaseResult().withTimestamp(timestamp).withTestCaseStatus(TestCaseStatus.Success);
+  }
+
+  @Test
+  void aResultIsCurrentWhenNothingNewerIsStored() {
+    assertTrue(TestCaseResultRepository.isCurrentResult(result(10), null));
+    assertTrue(TestCaseResultRepository.isCurrentResult(result(10), result(5)));
+    assertTrue(TestCaseResultRepository.isCurrentResult(result(10), result(10)));
+  }
+
+  @Test
+  void anOlderResultIsNotCurrent() {
+    assertFalse(TestCaseResultRepository.isCurrentResult(result(5), result(10)));
+  }
+
+  @Test
+  void theTestCaseIsSnapshottedBeforeItsNewestResultIsRead() {
+    // A newer result stored after the snapshot must make the optimistic update conflict. Reading
+    // the
+    // newest result first would let an older write pass the version check and overwrite it.
+    List<String> calls = new ArrayList<>();
+    TestCaseResultRepository repository =
+        mock(TestCaseResultRepository.class, Mockito.CALLS_REAL_METHODS);
+    doAnswer(
+            invocation -> {
+              calls.add("newest result");
+              return result(20);
+            })
+        .when(repository)
+        .getLatestRecord(FQN);
+
+    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
+      entity
+          .when(() -> Entity.getEntityByName(eq(Entity.TEST_CASE), eq(FQN), anyString(), any()))
+          .thenAnswer(
+              invocation -> {
+                calls.add("test case");
+                return new TestCase();
+              });
+
+      repository.syncTestCaseStatus(result(10).withTestCaseFQN(FQN), OperationType.CREATE, true);
+    }
+
+    assertEquals(List.of("test case", "newest result"), calls);
+  }
+}
```

**File**: `openmetadata-service/src/test/java/org/openmetadata/service/search/indexes/TestCaseIndexTest.java` (modified, +28/-0)
```diff
@@ -26,6 +26,8 @@
 import org.openmetadata.schema.tests.TestCase;
 import org.openmetadata.schema.tests.TestDefinition;
 import org.openmetadata.schema.tests.TestPlatform;
+import org.openmetadata.schema.tests.type.TestCaseResult;
+import org.openmetadata.schema.tests.type.TestCaseStatus;
 import org.openmetadata.schema.type.EntityReference;
 import org.openmetadata.schema.type.TagLabel;
 import org.openmetadata.schema.type.TestDefinitionEntityType;
@@ -245,6 +247,32 @@ void testBuildSearchIndexDoc_endToEnd_hasCommonAndTagFields() {
     assertNotNull(result.get("originEntityFQN"));
   }
 
+  @Test
+  void testTestCaseWithoutALoadedResultLeavesTheIndexedResultAlone() {
+    // Most test case updates never load the latest result. Sending it as null would remove the
+    // indexed result and status that the data quality filters and dashboards read.
+    TestCase tc = createTestCaseWithDefinition().withTestCaseStatus(TestCaseStatus.Failed);
+
+    Map<String, Object> result = new TestCaseIndex(tc).buildSearchIndexDoc();
+
+    assertFalse(result.containsKey("testCaseResult"));
+    assertEquals(TestCaseStatus.Failed.value(), String.valueOf(result.get("testCaseStatus")));
+  }
+
+  @Test
+  void testTestCaseWithResultKeepsItsStatus() {
+    TestCase tc =
+        createTestCaseWithDefinition()
+            .withTestCaseStatus(TestCaseStatus.Failed)
+            .withTestCaseResult(
+                new TestCaseResult().withTimestamp(1L).withTestCaseStatus(TestCaseStatus.Failed));
+
+    Map<String, Object> result = new TestCaseIndex(tc).buildSearchIndexDoc();
+
+    assertNotNull(result.get("testCaseResult"));
+    assertEquals(TestCaseStatus.Failed.value(), String.valueOf(result.get("testCaseStatus")));
+  }
+
   @Test
   void testBuildSearchIndexDocCarriesRelationshipRevisionFromContext() {
     TestCase tc = createTestCaseWithDefinition();
```

---

### Incident Patch 2: `80a765a1` (2026-09-30)
**Commit Message**: fix(ui): swap workflow canvas/node surfaces and stretch empty states (#34293)

* fix(ui): swap workflow canvas/node surfaces and stretch empty states

Workflow builder: the graph now paints `bg-surface` and everything floating
on it — nodes, the sidebar palette, the zoom controls — paints `bg-canvas`,
inverting the previous relationship. Start/End node headings drop from
`text-lg` to `text-sm` so they match the task nodes.

Execution history: replace the deprecated `ErrorPlaceHolder` with the core
`NoDataPlaceholder`. It is `absolute inset-0`, so the empty state is rendered
in place of the table rather than inside the table's fixed-height empty slot,
letting it fill the tab. `TableV2` resolves `locale.emptyText` with `??`, so a
null override would have fallen through to its own default placeholder and
stacked two empty states.

Metrics list: `PageLayout.Content` becomes a column flex container so the list
card can claim the leftover height while a placeholder is showing. The error
and empty boxes swap their fixed `min-h-*` for `flex-1`, and the stretch is
gated on a placeholder state so the populated table keeps its intrinsic
height. The predicate lives in a module-level helper to 

**File**: `openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/Workflows/WorkflowOssRestrictions.spec.ts` (modified, +14/-1)
```diff
@@ -652,6 +652,19 @@ if (process.env.PLAYWRIGHT_IS_OSS) {
         page,
       }) => {
         await redirectToHomePage(page);
+
+        // Trigger fires on table Created, so pin the payload to stay deterministic.
+        await page.route(
+          '**/api/v1/governance/workflowInstances**',
+          async (route) => {
+            await route.fulfill({
+              status: 200,
+              contentType: 'application/json',
+              body: JSON.stringify({ data: [], paging: { total: 0 } }),
+            });
+          }
+        );
+
         await navigateToWorkflowDetailPage(page, workflowName);
 
         const historyResponse = page.waitForResponse(
@@ -665,7 +678,7 @@ if (process.env.PLAYWRIGHT_IS_OSS) {
         await historyResponse;
 
         await expect(
-          page.getByTestId('workflow-execution-history-table')
+          page.getByTestId('workflow-execution-history-empty')
         ).toBeVisible();
       });
     });
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/WorkflowDefinitions/WorkflowBuilder/CustomControls.tsx` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ export const CustomControls: React.FC<CustomControlsProps> = ({
 
   return (
     <Card
-      className="tw:absolute tw:bottom-5 tw:right-5 tw:flex tw:items-center tw:gap-0.5 tw:z-10 tw:p-1"
+      className="tw:absolute tw:bottom-5 tw:right-5 tw:flex tw:items-center tw:gap-0.5 tw:z-10 tw:p-1 tw:bg-canvas"
       data-testid="workflow-controls">
       <Button
         color="tertiary"
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/WorkflowDefinitions/WorkflowBuilder/CustomNodes.tsx` (modified, +8/-8)
```diff
@@ -32,7 +32,7 @@ export const StartNode: React.FC<NodeProps<CustomNodeData>> = () => {
 
   return (
     <Card
-      className="tw:flex tw:items-center tw:rounded-full tw:relative tw:overflow-visible"
+      className="tw:flex tw:items-center tw:rounded-full tw:relative tw:overflow-visible tw:bg-canvas"
       data-testid="workflow-start-node">
       <div className="tw:flex tw:items-center tw:justify-center tw:p-1.5">
         {getCanvasNodeIcon(NodeSubType.StartEvent, {
@@ -42,7 +42,7 @@ export const StartNode: React.FC<NodeProps<CustomNodeData>> = () => {
       <div className="tw:pl-1.5 tw:pr-5.5">
         <Typography
           className="tw:m-0 tw:text-primary"
-          size="text-lg"
+          size="text-sm"
           weight="medium">
           {t('label.start')}
         </Typography>
@@ -67,7 +67,7 @@ export const EndNode: React.FC<NodeProps<CustomNodeData>> = () => {
 
   return (
     <Card
-      className="tw:flex tw:items-center tw:rounded-full tw:relative tw:overflow-visible"
+      className="tw:flex tw:items-center tw:rounded-full tw:relative tw:overflow-visible tw:bg-canvas"
       data-testid="workflow-end-node">
       <Handle
         className={HANDLE_CLASS_NAME}
@@ -88,7 +88,7 @@ export const EndNode: React.FC<NodeProps<CustomNodeData>> = () => {
       <div className="tw:pl-1.5 tw:pr-5.5">
         <Typography
           className="tw:m-0 tw:text-primary"
-          size="text-lg"
+          size="text-sm"
           weight="medium">
           {t('label.end')}
         </Typography>
@@ -105,7 +105,7 @@ export const AutomatedTaskNode: React.FC<NodeProps<CustomNodeData>> = ({
   // `ring-inset`, so it drew outward from the border box — outline-offset 0 (the default)
   // reproduces that exactly.
   const nodeClassName = classNames(
-    'tw:min-w-66 tw:relative tw:overflow-visible tw:transition-all tw:duration-200 tw:hover:outline-2 tw:hover:outline-brand-solid',
+    'tw:min-w-66 tw:relative tw:overflow-visible tw:bg-canvas tw:transition-all tw:duration-200 tw:hover:outline-2 tw:hover:outline-brand-solid',
     { 'tw:outline-2 tw:outline-brand-solid': selected }
   );
 
@@ -128,7 +128,7 @@ export const AutomatedTaskNode: React.FC<NodeProps<CustomNodeData>> = ({
       />
 
       <div className="tw:p-3 tw:rounded-lg tw:flex tw:items-center tw:gap-2">
-        <div className="tw:w-4 tw:h-4 tw:bg-surface tw:rounded-sm tw:flex tw:items-center tw:justify-center">
+        <div className="tw:w-4 tw:h-4 tw:bg-canvas tw:rounded-sm tw:flex tw:items-center tw:justify-center">
           {getCanvasNodeIcon(data.subType, {
             size: 'sm',
           })}
@@ -171,7 +171,7 @@ export const UserTaskNode: React.FC<NodeProps<CustomNodeData>> = ({
   // `ring-inset`, so it drew outward from the border box — outline-offset 0 (the default)
   // reproduces that exactly.
   const nodeClassName = classNames(
-    'tw:min-w-66 tw:relative tw:overflow-visible tw:transition-all tw:duration-200 tw:hover:outline-2 tw:hover:outline-brand-solid',
+    'tw:min-w-66 tw:relative tw:overflow-visible tw:bg-canvas tw:transition-all tw:duration-200 tw:hover:outline-2 tw:hover:outline-brand-solid',
     { 'tw:outline-2 tw:outline-brand-solid': selected }
   );
 
@@ -193,7 +193,7 @@ export const UserTaskNode: React.FC<NodeProps<CustomNodeData>> = ({
         type="target"
       />
       <div className="tw:px-4 tw:py-3 tw:rounded-lg tw:flex tw:items-center tw:gap-2">
-        <div className="tw:w-4 tw:h-4 tw:bg-surface tw:rounded-sm tw:flex tw:items-center tw:justify-center">
+        <div className="tw:w-4 tw:h-4 tw:bg-canvas tw:rounded-sm tw:flex tw:items-center tw:justify-center">
           {getCanvasNodeIcon(data.subType, {
             size: 'sm',
           })}
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/WorkflowDefinitions/WorkflowBuilder/WorkflowCanvas.tsx` (modified, +1/-1)
```diff
@@ -277,7 +277,7 @@ const WorkflowCanvasInternal: React.FC<WorkflowCanvasProps> = ({
   const canvasClassName = classNames(
     'workflow-canvas',
     isViewMode ? 'view-mode' : 'edit-mode',
-    'tw:relative tw:flex-1 tw:min-h-0 tw:w-full tw:overflow-hidden tw:bg-canvas'
+    'tw:relative tw:flex-1 tw:min-h-0 tw:w-full tw:overflow-hidden tw:bg-surface'
   );
 
   return (
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/WorkflowDefinitions/WorkflowBuilder/WorkflowExecutionHistory.tsx` (modified, +8/-10)
```diff
@@ -17,7 +17,7 @@ import { capitalize } from 'lodash';
 import React, { useCallback, useEffect, useMemo, useState } from 'react';
 import { useTranslation } from 'react-i18next';
 import { Link } from 'react-router-dom';
-import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
+import NoDataPlaceholder from '../../../components/common/EmptyPlaceholder/NoDataPlaceholder';
 import NextPrevious from '../../../components/common/NextPrevious/NextPrevious';
 import { PagingHandlerParams } from '../../../components/common/NextPrevious/NextPrevious.interface';
 import { StatusType } from '../../../components/common/StatusBadge/StatusBadge.interface';
@@ -28,7 +28,6 @@ import {
   PAGE_SIZE_BASE,
 } from '../../../constants/constants';
 import { getStatusMapping } from '../../../constants/WorkflowBuilder.constants';
-import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
 import { EntityType } from '../../../enums/entity.enum';
 import { CursorType } from '../../../enums/pagination.enum';
 import {
@@ -220,10 +219,14 @@ export const WorkflowExecutionHistory: React.FC = () => {
     fetchExecutionHistory();
   }, [workflowFqn, pageSize, fetchExecutionHistory]);
 
-  if (!workflowFqn) {
+  const isEmpty = !loading && instances.length === 0;
+
+  if (!workflowFqn || isEmpty) {
     return (
-      <div className="tw:flex tw:justify-center tw:items-center tw:min-h-100">
-        <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.NO_DATA} />
+      <div
+        className="tw:relative tw:flex-1 tw:min-h-0"
+        data-testid="workflow-execution-history-empty">
+        <NoDataPlaceholder />
       </div>
     );
   }
@@ -243,11 +246,6 @@ export const WorkflowExecutionHistory: React.FC = () => {
           data-testid="workflow-execution-history-table"
           dataSource={instances}
           loading={loading}
-          locale={{
-            emptyText: (
-              <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.NO_DATA} />
-            ),
-          }}
           pagination={false}
           rowKey={(record) => record.id ?? ''}
           size="small"
```

---

### Incident Patch 3: `9e3ee2d4` (2026-09-30)
**Commit Message**: fix(ui): sanitise QuickLink URLs to prevent stored XSS (#34271)

* fix(ui): sanitise QuickLink URLs to prevent stored XSS

Route every navigable QuickLink.url through getSafeHttpUrl so a stored
javascript:/data: scheme (settable via the REST API, which has no scheme
validation) can never become a clickable/executable link. Covers all five
render/navigation sites in the Knowledge Center: KnowledgeCard,
KnowledgePageSummary, KnowledgeCenterWidget, KnowledgePages, and the
ai-shell ContextCenterSubNavSections window.open handler. Adds XSS-guard
unit tests for each.

* fix(ui): sanitise remaining QuickLink URL sinks (getLink, dashboard)

Two more sinks routed raw QuickLink.url to a navigable link: getLink() in
KnowledgePageUtils (used by KnowledgePageListRightPanel and BookMarkWidget)
and handleOpenKnowledgePage in ContextCenterDashboardPage. Apply getSafeHttpUrl
to both — '#' fallback for the Link, skip window.open when unsafe — and add a
getLink XSS-guard unit test.

**File**: `openmetadata-ui/src/main/resources/ui/src/components/KnowledgeCenter/KnowledgeCard/KnowledgeCard.test.tsx` (modified, +31/-0)
```diff
@@ -143,6 +143,7 @@ jest.mock('../../../components/common/DeleteModal/DeleteModal', () =>
 );
 
 jest.mock('../../../utils/StringUtils', () => ({
+  ...jest.requireActual('../../../utils/StringUtils'),
   stripMarkdown: jest.fn().mockImplementation((text: string) => text),
 }));
 
@@ -397,6 +398,36 @@ describe('Knowledge Card', () => {
     );
   });
 
+  it('should neutralise a javascript: quick link url (XSS guard)', () => {
+    const maliciousQuickLink: KnowledgePage = {
+      ...QUICK_LINK_MOCK_DATA,
+      page: { url: 'javascript:alert(document.domain)' },
+    } as KnowledgePage;
+    render(
+      <KnowledgeCard {...mockProps} knowledgeItem={maliciousQuickLink} />,
+      { wrapper: MemoryRouter }
+    );
+
+    const link = screen.getByTestId('knowledge-link');
+
+    // getSafeHttpUrl rejects the javascript: scheme, so the '#' fallback is
+    // used — React Router renders that as href="/", never the script url.
+    expect(link.getAttribute('href')).not.toContain('javascript:');
+    expect(link).toHaveAttribute('href', '/');
+  });
+
+  it('should render a safe http(s) quick link url unchanged', () => {
+    render(
+      <KnowledgeCard {...mockProps} knowledgeItem={QUICK_LINK_MOCK_DATA} />,
+      { wrapper: MemoryRouter }
+    );
+
+    expect(screen.getByTestId('knowledge-link')).toHaveAttribute(
+      'href',
+      'https://open-metadata.org'
+    );
+  });
+
   it('should not render edit and delete buttons when user has no permission', async () => {
     setMockPermissions({
       Create: false,
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/KnowledgeCenter/KnowledgeCard/KnowledgeCard.tsx` (modified, +2/-2)
```diff
@@ -44,7 +44,7 @@ import {
   addToKnowledgeCenterRecentViewed,
   updateKnowledgeCenterRecentViewed,
 } from '../../../utils/KnowledgePageUtils';
-import { stripMarkdown } from '../../../utils/StringUtils';
+import { getSafeHttpUrl, stripMarkdown } from '../../../utils/StringUtils';
 import { showErrorToast } from '../../../utils/ToastUtils';
 import {
   QuickLinkFormModal,
@@ -182,7 +182,7 @@ const KnowledgeCard: FC<KnowledgeCardProps> = ({
 
   const isQuickLink = knowledgePage.pageType === PageType.QUICK_LINK;
   const path = isQuickLink
-    ? (knowledgePage.page as QuickLink).url
+    ? getSafeHttpUrl((knowledgePage.page as QuickLink).url) ?? '#'
     : contextCenterClassBase.getArticlePath(knowledgePage.fullyQualifiedName);
 
   // Single useEntityPermissions call, `enabled: isQuickLink` — only quick-link cards render
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/KnowledgeCenter/KnowledgeCenterWidget/KnowledgeCenterWidget.test.tsx` (modified, +28/-0)
```diff
@@ -18,6 +18,7 @@ import {
   waitFor,
 } from '@testing-library/react';
 import { MemoryRouter } from 'react-router-dom';
+import { PageType } from '../../../interface/knowledge-center.interface';
 import { getListKnowledgePages } from '../../../rest/knowledgeCenterAPI';
 import KnowledgeCenterWidget from './KnowledgeCenterWidget';
 import { MOCK_KNOWLEDGE_PAGE_LIST } from './KnowledgeCenterWidget.mock';
@@ -178,4 +179,31 @@ describe('Knowledge center widget', () => {
       );
     });
   });
+
+  it('should neutralise a javascript: quick link url (XSS guard)', async () => {
+    const quickLink = MOCK_KNOWLEDGE_PAGE_LIST.find(
+      (page) => page.pageType === PageType.QUICK_LINK
+    );
+    (getListKnowledgePages as jest.Mock).mockImplementationOnce(() =>
+      Promise.resolve({
+        data: [{ ...quickLink, page: { url: 'javascript:alert(1)' } }],
+        paging: { total: 15 },
+      })
+    );
+
+    await act(async () => {
+      render(<KnowledgeCenterWidget widgetKey="KnowledgeCenterWidget" />, {
+        wrapper: MemoryRouter,
+      });
+    });
+
+    await waitFor(() => {
+      const quickLinkAnchor = screen.getAllByTestId('quick-link-link')[0];
+
+      // getSafeHttpUrl drops the javascript: scheme, so the '#' fallback is
+      // used — React Router renders that as href="/", never the script url.
+      expect(quickLinkAnchor.getAttribute('href')).not.toContain('javascript:');
+      expect(quickLinkAnchor).toHaveAttribute('href', '/');
+    });
+  });
 });
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/KnowledgeCenter/KnowledgeCenterWidget/KnowledgeCenterWidget.tsx` (modified, +2/-1)
```diff
@@ -39,6 +39,7 @@ import { getListKnowledgePages } from '../../../rest/knowledgeCenterAPI';
 import { getEntityName } from '../../../utils/EntityNameUtils';
 import { t } from '../../../utils/i18next/LocalUtil';
 import { getKnowledgePagePath } from '../../../utils/KnowledgePagePureUtils';
+import { getSafeHttpUrl } from '../../../utils/StringUtils';
 import { showErrorToast } from '../../../utils/ToastUtils';
 import './KnowledgeCenterWidget.less';
 const KnowledgeCenterWidget = ({
@@ -141,7 +142,7 @@ const KnowledgeCenterWidget = ({
                     target={isQuickLink ? '_blank' : '_self'}
                     to={
                       isQuickLink
-                        ? quickLink.url
+                        ? getSafeHttpUrl(quickLink.url) ?? '#'
                         : {
                             pathname: getKnowledgePagePath(
                               knowledgePage.fullyQualifiedName
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/KnowledgeCenter/KnowledgePageSummary/KnowledgePageSummary.test.tsx` (modified, +25/-0)
```diff
@@ -92,4 +92,29 @@ describe('KnowledgePageSummary', () => {
     ).toBeInTheDocument();
     expect(screen.getByTestId('quick-link-data')).toBeInTheDocument();
   });
+
+  it('should neutralise a javascript: quick link url (XSS guard)', async () => {
+    render(
+      <KnowledgePageSummary
+        entityDetails={{
+          ...mockData,
+          page: {
+            url: 'javascript:alert(document.domain)',
+          },
+          pageType: PageType.QUICK_LINK,
+        }}
+      />,
+      {
+        wrapper: MemoryRouter,
+      }
+    );
+
+    // The mocked summary children render as <div>s, so the only anchor is the
+    // quick-link. getSafeHttpUrl drops the javascript: scheme, so the '#'
+    // fallback is used — React Router renders that as href="/".
+    const link = await screen.findByRole('link');
+
+    expect(link.getAttribute('href')).not.toContain('javascript:');
+    expect(link).toHaveAttribute('href', '/');
+  });
 });
```

---

### Incident Patch 4: `52b617c2` (2026-09-30)
**Commit Message**: Fixes #33635: stop the knowledge graph canvas overflowing its grid area (#33639)

`.kg-content` and `.kg-stage` are grids whose implicit column is `auto`,
and grid items default to `min-width: auto`. The absolutely-sized G6 canvas
inside `.knowledge-graph-body` therefore became the column's intrinsic
minimum and propped the stage open past its grid area — 1340px inside a
1246px area in a 1280px viewport.

That fed back on itself: the next `fitViewport()` measures
`container.clientWidth`, which was the inflated value, and resized the
canvas to match, so the width only converged on the truth after several
redraws (1340 -> 1305 -> 1286). The focus node stays exactly centred in the
canvas throughout, so every redraw slid the whole scene sideways instead.

Constraining the columns to `minmax(0, 1fr)` and adding the horizontal
counterpart of the `min-height: 0` already on both elements lets the stage
shrink to its grid area, so the measured width is correct on the first fit
and stays put. Measured on the same scenarios afterwards, the chain is a
stable 1246 and positional drift is 0 across the filter-row toggle, filter
application and label-mode change — previously 13px, 34.5px and 17.5p

**File**: `openmetadata-ui/src/main/resources/ui/src/components/discovery/knowledge-graph/KnowledgeGraph.style.less` (modified, +11/-0)
```diff
@@ -24,13 +24,23 @@
   .kg-content {
     display: grid;
     grid-template-rows: auto minmax(min-content, 1fr) auto;
+    grid-template-columns: minmax(0, 1fr);
     min-height: 0;
+    // Grid items default to min-width:auto, so the absolutely-sized G6 canvas
+    // inside .knowledge-graph-body becomes this column's intrinsic minimum and
+    // props the stage open past its grid area. The next fit then measures that
+    // inflated width and re-sizes the canvas to it, so the graph only converges
+    // on the real width after several redraws -- drifting the whole scene
+    // sideways each time. Same reason min-height:0 is already here, one axis over.
+    min-width: 0;
   }
 
   .kg-stage {
     display: grid;
     grid-template-rows: minmax(calc(var(--om-space-40) * 8), 1fr) auto;
+    grid-template-columns: minmax(0, 1fr);
     min-height: 0;
+    min-width: 0;
     position: relative;
   }
 
@@ -58,6 +68,7 @@
   .knowledge-graph-body {
     flex: 1;
     min-height: calc(var(--om-space-40) * 8);
+    min-width: 0;
     position: relative;
     overflow: hidden;
     isolation: isolate;
```

---

### Incident Patch 5: `d389ad69` (2026-09-30)
**Commit Message**: Fixes #33918: [Snowflake] Bound the stored-procedure history scan and isolate its failures (#33919)

* Bound the Snowflake stored-procedure history read and stop a cancelled one failing the run

The stored-procedure history statement scanned the whole lookback window with no upper bound, and our own network_timeout default armed the driver's per-statement cancel timer, so a long queryLogDuration died with 000604 and took the whole run down with it, query lineage included.

The read is now bounded at both ends and split in half only when Snowflake cancels it, the socket guard moves to socket_timeout, and a read that still fails is reported against the pipeline instead of raising.

* Size the stored-procedure overlap to Snowflake's statement timeout ceiling

The two-day overlap was Snowflake's default statement timeout, but an account can raise it up to 604800 seconds, so after a split a long CALL near the window boundary could lose the child queries it ran past the overlap. Reaching the hard seven-day ceiling means no CALL on any account can outlive it.

* Stop setting a Snowflake client timeout and classify cancels by SQLSTATE only

- Drop the `socket_timeout` default: the driver a

**File**: `ingestion/.basedpyright/baseline.json` (modified, +0/-16)
```diff
@@ -50241,22 +50241,6 @@
                     "lineCount": 1
                 }
             },
-            {
-                "code": "reportIncompatibleMethodOverride",
-                "range": {
-                    "startColumn": 6,
-                    "endColumn": 28,
-                    "lineCount": 1
-                }
-            },
-            {
-                "code": "reportArgumentType",
-                "range": {
-                    "startColumn": 37,
-                    "endColumn": 72,
-                    "lineCount": 1
-                }
-            },
             {
                 "code": "reportOperatorIssue",
                 "range": {
```

**File**: `ingestion/src/metadata/ingestion/source/database/snowflake/connection.py` (modified, +7/-5)
```diff
@@ -500,11 +500,13 @@ def get_connection(self) -> Engine:
         if keep_alive := self._get_client_session_keep_alive():
             connect_args["client_session_keep_alive"] = keep_alive
 
-        # Bound the Snowflake socket so a silently-severed TCP connection
-        # (NAT/LB idle reaping in K8s/hybrid runners) surfaces as a network
-        # error within 10 minutes instead of hanging the worker indefinitely.
-        # User-supplied connectionArguments win via setdefault.
-        connect_args.setdefault("network_timeout", 600)
+        # No client-side timeout is set on purpose. The driver arms `network_timeout`
+        # as a cancel timer on every statement it executes, so any value kills a
+        # query that legitimately runs longer, with `000604 (57014): SQL execution
+        # was cancelled by the client due to a timeout`. A severed socket is already
+        # bounded without it: when `socket_timeout` is unset the driver applies its
+        # own 60-second read timeout to every request. Users who want a hard cap can
+        # still pass either key in `connectionArguments`.
 
         session_parameters = dict(connect_args.get("session_parameters") or {})
         if connection.queryTag:
```

**File**: `ingestion/src/metadata/ingestion/source/database/snowflake/lineage.py` (modified, +102/-8)
```diff
@@ -68,7 +68,6 @@
     StoredProcedureLineageMixin,
 )
 from metadata.utils import fqn
-from metadata.utils.helpers import get_start_and_end
 from metadata.utils.logger import ingestion_logger
 
 logger = ingestion_logger()
@@ -77,8 +76,41 @@
 
 DEFAULT_ACCESS_HISTORY_CHUNK_DAYS = 2
 
+# How far past a stored-procedure window the non-CALL half of the query-history read has
+# to reach. A CALL that starts just inside a window keeps running after it closes, and its
+# child queries are only joinable if they are in the scan. This is Snowflake's hard ceiling
+# on STATEMENT_TIMEOUT_IN_SECONDS (604800 seconds), not its two-day default, because an
+# account can raise the timeout and a CALL may then run for up to seven days.
+STORED_PROCEDURE_OVERLAP_DAYS = 7
+
+# The stored-procedure history read starts as one statement over the whole window and is
+# only split when Snowflake cancels it. Splitting up front is much worse than it looks:
+# every ACCOUNT_USAGE statement carries a large fixed cost regardless of how little it
+# scans, so a fixed small chunk turns a 30-second read into half an hour of overhead.
+STORED_PROCEDURE_MIN_WINDOW = timedelta(days=1)
+STORED_PROCEDURE_MAX_SPLIT_DEPTH = 4
+# Every statement a fully split window can render: the root plus both halves at each level.
+STORED_PROCEDURE_WINDOW_CACHE_SIZE = 2 ** (STORED_PROCEDURE_MAX_SPLIT_DEPTH + 1)
+
+# Snowflake reports both its own statement timeout (000630) and a client-side cancel
+# (000604, only when the user sets `network_timeout`) under SQLSTATE 57014. Only those are
+# worth retrying on a narrower window: a permission or syntax failure would fail again on
+# every half and multiply one error into many.
+STATEMENT_CANCELLED_SQLSTATE = "57014"
+
 EXTERNAL_STAGE_PREFIXES = ("s3://", "azure://", "gcs://", "https://")
 
+
+def _is_statement_cancelled(exc: Exception) -> bool:
+    """
+    Whether Snowflake cancelled the statement rather than rejecting it. SQLAlchemy wraps the
+    driver error, which carries the SQLSTATE on `.sqlstate`. An error without one did not
+    come from the Snowflake server, so it is never treated as a cancel.
+    """
+    driver_error = getattr(exc, "orig", exc)
+    return str(getattr(driver_error, "sqlstate", None)) == STATEMENT_CANCELLED_SQLSTATE
+
+
 LINEAGE_OBJECT_DOMAINS = {
     "Table",
     "View",
@@ -118,6 +150,9 @@ def __init__(
         self._table_cache: LRUCache = LRUCache(maxsize=TABLE_CACHE_MAX_SIZE)
         self._access_history_chunk_days = self._resolve_chunk_days()
         self._use_access_history = self._resolve_use_access_history()
+        # Window each rendered stored-procedure statement covers, so a cancelled one can be
+        # retried over its halves. Bounded because splitting is capped anyway.
+        self._stored_procedure_windows: LRUCache = LRUCache(maxsize=STORED_PROCEDURE_WINDOW_CACHE_SIZE)
 
     def _resolve_chunk_days(self) -> int:
         """
@@ -170,15 +205,74 @@ def _build_filter_condition_clause(self) -> str:
 
     def get_stored_procedure_sql_statement(self) -> str:
         """
-        Return the SQL statement to get the stored procedure queries
+        Return the SQL statement to get the stored procedure queries over the whole
+        configured window. Kept for the mixin's single-statement contract, bounded at
+        both ends so it can never scan to `now`.
         """
-        start, _ = get_start_and_end(self.source_config.queryLogDuration)
-        query = self.stored_procedure_query.format(
-            start_date=start,
-            account_usage=quote_account_usage_schema(self.service_connection.accountUsageSchema),
+        return self._render_stored_procedure_query(self.start, self.end)
+
+    def get_stored_procedure_sql_statements(self) -> Iterator[str]:
+        """
+        Read the whole configured window in one bounded statement, and let
+        `narrow_stored_procedure_statement` split it only if Snowflake cancels it.
+        """
+        yield self._render_sto
```

**File**: `ingestion/src/metadata/ingestion/source/database/snowflake/queries.py` (modified, +8/-1)
```diff
@@ -478,6 +478,12 @@ def _snowflake_string_literal(value: str) -> str:
 
 SNOWFLAKE_DESC_FUNCTION = "DESC FUNCTION {database_name}.{schema_name}.{procedure_name}{procedure_signature}"
 
+# Both halves are bounded at both ends so the caller can re-read a narrower window when
+# Snowflake cancels the scan: unbounded, one statement reads QUERY_HISTORY twice end to
+# end. `query_end_date` reaches past `end_date` because a CALL that starts inside the
+# window keeps running past it, and its child queries have to stay joinable. There is
+# deliberately no ORDER BY: it sorts the entire join for nothing, since the rows are
+# processed by a thread pool and no consumer depends on the order.
 SNOWFLAKE_GET_STORED_PROCEDURE_QUERIES = textwrap.dedent(
     """
 WITH SP_HISTORY AS (
@@ -489,6 +495,7 @@ def _snowflake_string_literal(value: str) -> str:
     FROM {account_usage}.QUERY_HISTORY SP
     WHERE QUERY_TYPE = 'CALL'
       AND START_TIME >= '{start_date}'
+      AND START_TIME < '{end_date}'
       AND QUERY_TEXT <> ''
       AND QUERY_TEXT IS NOT NULL
 ),
@@ -508,6 +515,7 @@ def _snowflake_string_literal(value: str) -> str:
       AND QUERY_TEXT NOT LIKE '/* {{"app": "OpenMetadata", %%}} */%%'
       AND QUERY_TEXT NOT LIKE '/* {{"app": "dbt", %%}} */%%'
       AND START_TIME >= '{start_date}'
+      AND START_TIME < '{query_end_date}'
       AND (
         QUERY_TYPE IN ('MERGE', 'UPDATE','CREATE_TABLE_AS_SELECT')
         OR (QUERY_TYPE = 'INSERT' and query_text ILIKE '%%insert%%into%%select%%')
@@ -531,7 +539,6 @@ def _snowflake_string_literal(value: str) -> str:
    Q.START_TIME BETWEEN SP.START_TIME AND SP.END_TIME
    OR Q.END_TIME BETWEEN SP.START_TIME AND SP.END_TIME
    )
-ORDER BY PROCEDURE_START_TIME DESC
     """
 )
 
```

**File**: `ingestion/src/metadata/ingestion/source/database/stored_procedures_mixin.py` (modified, +63/-22)
```diff
@@ -86,37 +86,78 @@ def get_stored_procedure_engines(self) -> Iterator[Engine]:
         """
         yield self.engine
 
+    def get_stored_procedure_sql_statements(self) -> Iterator[str]:
+        """
+        Statements to read stored-procedure query history with. Defaults to the single
+        statement returned by `get_stored_procedure_sql_statement`. Sources that split the
+        read across several statements override this.
+        """
+        yield self.get_stored_procedure_sql_statement()
+
+    def narrow_stored_procedure_statement(self, statement: str, exc: Exception) -> Iterator[str]:
+        """
+        Statements to try instead of one that failed, for sources that can read the same
+        history over a narrower window (Snowflake halves the date window when the engine
+        cancels the scan). Yielding nothing means the failure is final and is reported.
+        """
+        yield from ()
+
     def yield_stored_procedure_queries(self) -> Iterator[QueryByProcedure]:
         """
         Yield query and stored procedure object for lineage processing.
         """
         for engine in self.get_stored_procedure_engines():
-            query = self.get_stored_procedure_sql_statement()
+            for query in self.get_stored_procedure_sql_statements():
+                yield from self._yield_queries_for_statement(engine, query)
+
+    def _yield_queries_for_statement(self, engine: Engine, query: str) -> Iterator[QueryByProcedure]:
+        """
+        Read one history statement. A statement that fails is retried over whatever narrower
+        statements the source offers, and otherwise recorded and skipped rather than raised:
+        the exception would otherwise escape the lineage producer and abort the whole
+        workflow, so a query history too large to scan used to cost the run its query
+        lineage as well.
+        """
+        try:
             with engine.connect() as conn:
                 results = conn.execute(text(query)).all()
+        except Exception as exc:
+            narrowed = list(self.narrow_stored_procedure_statement(query, exc))
+            if not narrowed:
+                self.status.failed(
+                    StackTraceError(
+                        name="Stored Procedure",
+                        error=f"Error reading stored procedure query history due to [{exc}]",
+                        stackTrace=traceback.format_exc(),
+                    )
+                )
+                return
+            for narrower_query in narrowed:
+                yield from self._yield_queries_for_statement(engine, narrower_query)
+            return
 
-            for row in results:
-                # Bound outside the try so the handler can still name the procedure, and
-                # assigned inside it so an unreadable row cannot escape and silently drop
-                # every row after it.
-                row_data = {}
-                try:
-                    row_data = row._asdict()
-                    query_by_procedure = QueryByProcedure.model_validate(row_data)
-                    if not query_by_procedure.procedure_name and query_by_procedure.procedure_text:
-                        query_by_procedure.procedure_name = get_procedure_name_from_call(
-                            query_text=query_by_procedure.procedure_text
-                        )
-                    yield query_by_procedure
-                except Exception as exc:
-                    self.status.failed(
-                        StackTraceError(
-                            name="Stored Procedure",
-                            error=f"Error trying to get procedure name for "
-                            f"[{row_data.get('PROCEDURE_NAME') or 'unknown procedure'}] due to [{exc}]",
-                            stackTrace=traceback.format_exc(),
-                        )
+        for row in results:
+            # Bound outside the try so the handler can still name the procedure, and

```

---

### Incident Patch 6: `5455c873` (2026-09-30)
**Commit Message**: Fixes #34260: list a service's data assets like classic in AI mode (#34261)

* fix(ui): list a service's data assets like classic in AI mode

The AI-mode service details page fetched child assets with no fields, so
owners, tags, domains, data products, tier, certification and usage were
blank in the table. Its fetch also ignored the page cursor, page size and
the Deleted switch, had no Drive services case, and listed nested
containers and search indexes flat.

Route the fetch through one table of per-category fetchers that requests
the table's fields (usage only with ViewUsage), keeps nested assets to
their top level and lists drive directories. Refetch on cursor, page size,
the Deleted switch and restore, leave the list to the search while one is
active, and reset to the first page when the switch flips.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

* test(ui): cover the AI-mode service data-assets table end to end

Adds a Playwright spec for the data-assets table on the AI-mode service
details page: owners and tags per row, Next and a reload on page two,
the Deleted switch, a soft-deleted service and its restore, clearing a
search, top-level containers on

**File**: `.github/playwright/impact-map.generated.json` (modified, +23/-0)
```diff
@@ -72,6 +72,7 @@
         "openmetadata-ui/src/main/resources/ui/playwright/constant/config.ts"
       ],
       "specs": [
+        "playwright/e2e/Features/AIMode/ConnectionServiceDetails.spec.ts",
         "playwright/e2e/Features/AccessControlSettings.spec.ts",
         "playwright/e2e/Features/ActivityAPI.spec.ts",
         "playwright/e2e/Features/AdvancedSearch.spec.ts",
@@ -665,6 +666,7 @@
         "playwright/e2e/Features/AIMode/AiAlertPermissions.spec.ts",
         "playwright/e2e/Features/AIMode/AiNotificationAlerts.spec.ts",
         "playwright/e2e/Features/AIMode/AiObservabilityAlerts.spec.ts",
+        "playwright/e2e/Features/AIMode/ConnectionServiceDetails.spec.ts",
         "playwright/e2e/Features/AIMode/CustomPropertiesPanel.spec.ts",
         "playwright/e2e/Features/AIMode/Observability.spec.ts",
         "playwright/e2e/Features/AIMode/ObservabilityClickPaths.spec.ts",
@@ -697,6 +699,7 @@
         "openmetadata-ui/src/main/resources/ui/playwright/e2e/fixtures/pages.ts"
       ],
       "specs": [
+        "playwright/e2e/Features/AIMode/ConnectionServiceDetails.spec.ts",
         "playwright/e2e/Features/ActivityAPI.spec.ts",
         "playwright/e2e/Features/AdvancedSearch.spec.ts",
         "playwright/e2e/Features/AdvancedSearchSuggestions.spec.ts",
@@ -1875,6 +1878,7 @@
         "openmetadata-ui/src/main/resources/ui/playwright/support/entity/service/DatabaseServiceClass.ts"
       ],
       "specs": [
+        "playwright/e2e/Features/AIMode/ConnectionServiceDetails.spec.ts",
         "playwright/e2e/Features/BulkImport.spec.ts",
         "playwright/e2e/Features/DataAssetRulesDisabled.spec.ts",
         "playwright/e2e/Features/DataAssetRulesEnabled.spec.ts",
@@ -1898,6 +1902,7 @@
         "openmetadata-ui/src/main/resources/ui/playwright/support/entity/service/DriveServiceClass.ts"
       ],
       "specs": [
+        "playwright/e2e/Features/AIMode/ConnectionServiceDetails.spec.ts",
         "playwright/e2e/Features/DataAssetRulesDisabled.spec.ts",
         "playwright/e2e/Features/DataAssetRulesEnabled.spec.ts",
         "playwright/e2e/Features/Pagination.spec.ts",
@@ -1969,6 +1974,7 @@
         "openmetadata-ui/src/main/resources/ui/playwright/support/entity/service/StorageServiceClass.ts"
       ],
       "specs": [
+        "playwright/e2e/Features/AIMode/ConnectionServiceDetails.spec.ts",
         "playwright/e2e/Features/DataAssetRulesDisabled.spec.ts",
         "playwright/e2e/Features/DataAssetRulesEnabled.spec.ts",
         "playwright/e2e/Features/StorageMetadataAgentForm.spec.ts",
@@ -2549,6 +2555,7 @@
       "specs": [
         "playwright/e2e/Features/AIMode/AiAlertPermissions.spec.ts",
         "playwright/e2e/Features/AIMode/AiObservabilityAlerts.spec.ts",
+        "playwright/e2e/Features/AIMode/ConnectionServiceDetails.spec.ts",
         "playwright/e2e/Features/AIMode/CustomPropertiesPanel.spec.ts",
         "playwright/e2e/Features/AIMode/ObservabilityPermissions.spec.ts",
         "playwright/e2e/Features/AIMode/ProfileNotificationTab.spec.ts",
@@ -2781,6 +2788,7 @@
         "playwright/e2e/Features/AIMode/AiAlertPermissions.spec.ts",
         "playwright/e2e/Features/AIMode/AiNotificationAlerts.spec.ts",
         "playwright/e2e/Features/AIMode/AiObservabilityAlerts.spec.ts",
+        "playwright/e2e/Features/AIMode/ConnectionServiceDetails.spec.ts",
         "playwright/e2e/Features/AIMode/CustomPropertiesPanel.spec.ts",
         "playwright/e2e/Features/AIMode/ObservabilityLayout.spec.ts",
         "playwright/e2e/Features/AIMode/ObservabilityPermissions.spec.ts",
@@ -2993,6 +3001,7 @@
         "openmetadata-ui/src/main/resources/ui/playwright/utils/apiResponse.ts"
       ],
       "specs": [
+        "playwright/e2e/Features/AIMode/ConnectionServiceDetails.spec.ts",
         "playwright/e2e/Features/AdvancedSearch.spec.ts",
         "playwright/e2e/Features/DomainFilterQueryFilter.spec.ts",
         "playwright/e2e/Flow/CustomizeWidgets.spec.ts",
@@ -3078,6 +3087,7 @@
  
```

**File**: `openmetadata-ui/src/main/resources/ui/playwright/e2e/Features/AIMode/ConnectionServiceDetails.spec.ts` (added, +550/-0)
```diff
@@ -0,0 +1,550 @@
+/*
+ *  Copyright 2026 Collate.
+ *  Licensed under the Apache License, Version 2.0 (the "License");
+ *  you may not use this file except in compliance with the License.
+ *  You may obtain a copy of the License at
+ *  http://www.apache.org/licenses/LICENSE-2.0
+ *  Unless required by applicable law or agreed to in writing, software
+ *  distributed under the License is distributed on an "AS IS" BASIS,
+ *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ *  See the License for the specific language governing permissions and
+ *  limitations under the License.
+ */
+
+/**
+ * The AI-mode service details page (`/connections/<category>/<fqn>`) must match classic service
+ * details (#34260).
+ *
+ * Its data-assets table lists each asset's owners and tags, pages that move the rows, the Deleted
+ * switch, a soft-deleted service's children, the list after a restore and after a search is
+ * cleared, only the top level of nesting assets, and drive directories.
+ *
+ * It gates what classic gates: the Connection tab, which shows the connection config, only for
+ * users who may edit the service; and no domain / owner / tier edits on a soft-deleted service.
+ *
+ * Every service here is the spec's own: the lists, pages and switches under test are scoped to
+ * it, so no other worker's entities can shift a row.
+ */
+
+import { expect } from '@playwright/test';
+import { DOMAIN_TAGS } from '../../../constant/config';
+import { DatabaseServiceClass } from '../../../support/entity/service/DatabaseServiceClass';
+import { DriveServiceClass } from '../../../support/entity/service/DriveServiceClass';
+import { StorageServiceClass } from '../../../support/entity/service/StorageServiceClass';
+import { UserClass } from '../../../support/user/UserClass';
+import { performAdminLogin } from '../../../utils/admin';
+import { okJson, settleAll } from '../../../utils/apiResponse';
+import { uuid } from '../../../utils/common';
+import { waitForAllLoadersToDisappear } from '../../../utils/entity';
+import { waitForSearchIndexed } from '../../../utils/polling';
+import { getRowByName } from '../../../utils/scopedLocators';
+import {
+  visitAiModeServiceDetailsPage,
+  waitForServiceChildList,
+} from '../../../utils/service';
+import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
+import { test } from '../../fixtures/pages';
+import { enableAiAppMode } from '../../Utils/appMode';
+
+type EntityRef = { id: string; fullyQualifiedName: string };
+
+const PERSONAL_TAG = {
+  tagFQN: 'PersonalData.Personal',
+  source: 'Classification',
+  labelType: 'Manual',
+  state: 'Confirmed',
+};
+
+test.describe(
+  'AI mode service details',
+  { tag: [DOMAIN_TAGS.INTEGRATION] },
+  () => {
+    test.describe('database service', () => {
+      let service: DatabaseServiceClass;
+      let owner: UserClass;
+      let serviceFqn = '';
+      // Three live databases, so a two-row page has a second page, and one soft-deleted one.
+      let databases: string[] = [];
+      let deletedDatabase = '';
+
+      test.beforeAll(async ({ browser }) => {
+        test.setTimeout(120_000);
+        const { apiContext, afterAction } = await performAdminLogin(browser);
+        service = new DatabaseServiceClass();
+        owner = new UserClass();
+        await settleAll([service.create(apiContext), owner.create(apiContext)]);
+        serviceFqn = service.entityResponseData.fullyQualifiedName;
+
+        const prefix = `pw-ai-db-${uuid()}`;
+        databases = [`${prefix}-1`, `${prefix}-2`, `${prefix}-3`];
+        deletedDatabase = `${prefix}-4`;
+
+        const [, searched, , toDelete] = await Promise.all(
+          [...databases, deletedDatabase].map(async (name, index) =>
+            okJson<EntityRef>(
+              await apiContext.post('/api/v1/databases', {
+                data: {
+                  name,
+                  service: serviceFqn,
+                  ...(index === 0 && {
+         
```

**File**: `openmetadata-ui/src/main/resources/ui/playwright/utils/service.ts` (modified, +68/-1)
```diff
@@ -10,9 +10,17 @@
  *  See the License for the specific language governing permissions and
  *  limitations under the License.
  */
-import { expect, Page } from '@playwright/test';
+import { expect, Page, Response } from '@playwright/test';
 import { waitForAllLoadersToDisappear } from './entity';
 import { settingClick, SettingOptionsType } from './sidebar';
+import { waitForResponseWithStatus } from './waitHelpers';
+
+// The child-asset list the AI-mode service details page reads, by service category.
+const SERVICE_CHILD_LIST_PATHS: Record<string, string> = {
+  databaseServices: 'databases',
+  storageServices: 'containers',
+  driveServices: 'drives/directories',
+};
 
 export const searchServiceFromSettingPage = async (
   page: Page,
@@ -62,3 +70,62 @@ export const visitServiceDetailsPage = async (
     );
   }
 };
+
+/** The AI-mode service details page's child-asset list request, optionally narrowed by its params. */
+export const waitForServiceChildList = (
+  page: Page,
+  category: string,
+  serviceFqn: string,
+  matchesParams: (params: URLSearchParams) => boolean = () => true
+): Promise<Response> =>
+  waitForResponseWithStatus(
+    page,
+    (response) => {
+      const url = new URL(response.url());
+
+      return (
+        response.request().method() === 'GET' &&
+        url.pathname === `/api/v1/${SERVICE_CHILD_LIST_PATHS[category]}` &&
+        url.searchParams.get('service') === serviceFqn &&
+        matchesParams(url.searchParams)
+      );
+    },
+    200
+  );
+
+/**
+ * Opens a service on the AI-mode details page (`/connections/<category>/<fqn>[/<tab>]`) and waits
+ * for its child-asset list. The caller puts the page in AI mode first (`enableAiAppMode`).
+ */
+export const visitAiModeServiceDetailsPage = async (
+  page: Page,
+  {
+    category,
+    fqn,
+    tab = '',
+    query = '',
+    include = 'non-deleted',
+  }: {
+    category: string;
+    fqn: string;
+    tab?: string;
+    query?: string;
+    include?: string;
+  }
+) => {
+  const list = waitForServiceChildList(
+    page,
+    category,
+    fqn,
+    (params) => params.get('include') === include
+  );
+  await page.goto(
+    `/connections/${category}/${encodeURIComponent(fqn)}${
+      tab ? `/${tab}` : ''
+    }${query}`,
+    { waitUntil: 'domcontentloaded' }
+  );
+  await list;
+  await waitForAllLoadersToDisappear(page);
+  await expect(page.getByTestId('entity-header-display-name')).toBeVisible();
+};
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/integration/ConnectionServiceDetailsPage/ConnectionServiceDetailsPage.test.tsx` (modified, +318/-10)
```diff
@@ -19,7 +19,9 @@ import {
   waitFor,
 } from '@testing-library/react';
 import React from 'react';
+import { getDatabases } from '../../../rest/databaseAPI';
 import { getServiceByFQN } from '../../../rest/serviceAPI';
+import { getTopics } from '../../../rest/topicsAPI';
 import { EXTENSION_POINTS } from '../../../utils/ExtensionPointTypes';
 import ConnectionServiceDetailsPage from './ConnectionServiceDetailsPage';
 
@@ -38,6 +40,17 @@ const MOCK_SERVICE = {
 const mockNavigate = jest.fn();
 let mockTabParam: string | undefined = undefined;
 let mockServiceCategory = 'databaseServices';
+const mockPermissions: { database: Record<string, boolean> } = { database: {} };
+const FULL_SERVICE_PERMISSION = { EditAll: true, Delete: true, ViewAll: true };
+let mockServicePermission: Record<string, boolean> = FULL_SERVICE_PERMISSION;
+const mockTableFilters: { showDeletedTables: boolean; schema?: string } = {
+  showDeletedTables: false,
+};
+const mockSetFilters = jest.fn();
+const mockPagingCursor: { cursorType?: string; cursorValue?: string } = {};
+const mockHandlePageChange = jest.fn();
+// Stable like the real hook's `setPaging`: a fresh function per render would refetch forever.
+const mockHandlePagingChange = jest.fn();
 
 jest.mock('react-router-dom', () => ({
   useNavigate: () => mockNavigate,
@@ -50,11 +63,10 @@ jest.mock('react-router-dom', () => ({
 
 jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
   usePermissionProvider: () => ({
-    getEntityPermissionByFqn: jest.fn().mockResolvedValue({
-      EditAll: true,
-      Delete: true,
-      ViewAll: true,
-    }),
+    permissions: mockPermissions,
+    getEntityPermissionByFqn: jest.fn(() =>
+      Promise.resolve(mockServicePermission)
+    ),
   }),
 }));
 
@@ -155,14 +167,16 @@ jest.mock('../../../hooks/paging/usePaging', () => ({
     paging: { total: 0 },
     pageSize: 15,
     currentPage: 1,
-    handlePagingChange: jest.fn(),
+    handlePagingChange: mockHandlePagingChange,
+    handlePageChange: mockHandlePageChange,
+    pagingCursor: mockPagingCursor,
   }),
 }));
 
 jest.mock('../../../hooks/useTableFilters', () => ({
   useTableFilters: () => ({
-    filters: { showDeletedTables: false },
-    setFilters: jest.fn(),
+    filters: mockTableFilters,
+    setFilters: mockSetFilters,
   }),
 }));
 
@@ -336,28 +350,75 @@ jest.mock(
 
 jest.mock('./DataAssetsTab', () => ({
   __esModule: true,
-  default: () => <div data-testid="data-assets-tab" />,
+  default: ({
+    data,
+    onShowDeletedChange,
+  }: {
+    data: { name: string }[];
+    onShowDeletedChange: (value: boolean) => void;
+  }) => (
+    <div data-testid="data-assets-tab">
+      <button onClick={() => onShowDeletedChange(true)}>show-deleted</button>
+      {data.map(({ name }) => (
+        <span key={name}>{name}</span>
+      ))}
+    </div>
+  ),
 }));
 
 // Exercises the owner/domain/tier editing UI on its own OSS primitives (DomainSelectableList,
 // OwnerLabel, TierCard, UserTeamSelectableList) — out of scope for this frame test, and rendering
 // it for real here would pull in every icon those primitives import.
 jest.mock('./DataAssetHeaderDetailsRow/DataAssetHeaderDetailsRow', () => ({
   __esModule: true,
-  default: () => <div data-testid="entity-meta-strip" />,
+  default: ({
+    canEditDomains,
+    canEditOwners,
+    canEditTier,
+  }: Record<'canEditDomains' | 'canEditOwners' | 'canEditTier', boolean>) => (
+    <div
+      data-can-edit-domains={String(canEditDomains)}
+      data-can-edit-owners={String(canEditOwners)}
+      data-can-edit-tier={String(canEditTier)}
+      data-testid="entity-meta-strip"
+    />
+  ),
 }));
 
 jest.mock('@untitledui/icons', () => ({
   Settings01: () => null,
 }));
 
 jest.mock('../../../constants/constants', () => ({
+  INITIAL_PAGING_VALUE: 1,
   INITIAL_TABLE_FILTERS: { showDeletedTables: false },
   pagingObject: {},
 }));
 
 jest.mock('fast-json-patch', () => ({ compare: jest.fn(() => []) }));
 
+// Holds
```

**File**: `openmetadata-ui/src/main/resources/ui/src/components/integration/ConnectionServiceDetailsPage/ConnectionServiceDetailsPage.tsx` (modified, +120/-116)
```diff
@@ -23,6 +23,7 @@ import {
 import { Settings01 } from '@untitledui/icons';
 import { AxiosError } from 'axios';
 import { compare } from 'fast-json-patch';
+import { PagingWithoutTotal } from 'Models';
 import React, {
   FC,
   ReactNode,
@@ -35,39 +36,32 @@ import React, {
 import { useTranslation } from 'react-i18next';
 import { useNavigate, useParams } from 'react-router-dom';
 import {
+  INITIAL_PAGING_VALUE,
   INITIAL_TABLE_FILTERS,
   pagingObject,
 } from '../../../constants/constants';
 import { ExportTypes } from '../../../constants/Export.constants';
 import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
 import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
-import { EntityType } from '../../../enums/entity.enum';
+import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
 import { ServiceCategory } from '../../../enums/service.enum';
 import { Tag } from '../../../generated/entity/classification/tag';
 import { DataProduct } from '../../../generated/entity/domains/dataProduct';
 import { EntityReference } from '../../../generated/entity/type';
 import { Include } from '../../../generated/type/include';
-import { Paging } from '../../../generated/type/paging';
 import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
 import { usePaging } from '../../../hooks/paging/usePaging';
 import { useTableFilters } from '../../../hooks/useTableFilters';
 import { ServicePageData } from '../../../interface/platform/service.interface';
 import { ConfigData, ServicesType } from '../../../interface/service.interface';
-import { getApiCollections } from '../../../rest/apiCollectionsAPI';
-import { getDashboards } from '../../../rest/dashboardAPI';
-import { getDatabases } from '../../../rest/databaseAPI';
-import { getMlModels } from '../../../rest/mlModelAPI';
-import { getPipelines } from '../../../rest/pipelineAPI';
-import { getSearchIndexes } from '../../../rest/SearchIndexAPI';
 import {
   exportDatabaseServiceDetailsInCSV,
   getServiceByFQN,
   patchService,
   restoreService,
 } from '../../../rest/serviceAPI';
-import { getContainers } from '../../../rest/storageAPI';
-import { getTopics } from '../../../rest/topicsAPI';
 import connectionsRouterClassBase from '../../../utils/ConnectionsRouterClassBase';
+import { commonTableFields } from '../../../utils/DatasetDetailsUtils';
 import { getServiceLogo } from '../../../utils/EntityDisplayUtils';
 import { getEntityName } from '../../../utils/EntityNameUtils';
 import { getEntityImportPath } from '../../../utils/EntityPureUtils';
@@ -102,6 +96,7 @@ import {
   getConnectionsRootBreadcrumb,
   getServiceCategoryBreadcrumb,
 } from './connectionsBreadcrumb.utils';
+import { fetchServiceChildren } from './connectionServiceChildren.utils';
 import DataAssetHeaderDetailsRow from './DataAssetHeaderDetailsRow/DataAssetHeaderDetailsRow';
 import DataAssetsTab from './DataAssetsTab';
 
@@ -163,7 +158,7 @@ const ConnectionServiceDetailsPage: React.FC = () => {
 
   const decodedFqn = useMemo(() => decodeURIComponent(fqn ?? ''), [fqn]);
 
-  const { getEntityPermissionByFqn } = usePermissionProvider();
+  const { getEntityPermissionByFqn, permissions } = usePermissionProvider();
   const { extensionRegistry } = useApplicationsProvider();
 
   const [activeTab, setActiveTab] = useState<TabKey>(() => tab ?? 'dataAssets');
@@ -193,10 +188,12 @@ const ConnectionServiceDetailsPage: React.FC = () => {
   const pagingInfo = usePaging();
   const { paging, pageSize, currentPage, handlePagingChange } = pagingInfo;
 
-  const { filters: tableFilters, setFilters } = useTableFilters(
-    INITIAL_TABLE_FILTERS
-  );
-  const { showDeletedTables: showDeleted } = tableFilters;
+  // `schema` is the data-assets search box's URL param, owned by ServiceMainTabContent.
+  const { filters: tableFilters, setFilters } = useTableFilters({
+    ...INITIAL_TABLE_FILTERS,
+
```

---

### Incident Patch 7: `ad9da971` (2026-09-30)
**Commit Message**: fix(cli-e2e): update BigQuery partition assertion for the widened 3-day window (#34185)

PR #33221 widened the auto-detected partition window for DAY-granularity
BigQuery partitions from 1 day to 3 days. The partition predicate is
`partition_col >= CAST(CURRENT_DATE - interval N DAY AS DATE)`, and the E2E
fixture table holds one row per day, so the profiler now samples 3 rows where
it previously sampled 1.

That PR updated the affected unit tests but not this E2E assertion, which is
schedule-only and therefore did not run on the PR.

Fixes #34184

Co-authored-by: Mayur Singal <39544459+ulixius9@users.noreply.github.com>

**File**: `ingestion/tests/cli_e2e/test_cli_bigquery.py` (modified, +2/-2)
```diff
@@ -244,5 +244,5 @@ def test_profiler_w_partition_table(self):
             end_ts,
             profile_type=ColumnProfile,
         ).entities[0]
-        # We ingest 1 row for each day and the profiler should default to the latest partition
-        assert column_profile.valuesCount == 1
+        # We ingest 1 row per day; the auto-detected BigQuery DAY window is 3 days (#33221)
+        assert column_profile.valuesCount == 3
```

---

### Incident Patch 8: `1ef0dd3c` (2026-09-30)
**Commit Message**: fix(ingestion): bind table name in PGSpider child-tables lineage query (#34206)

The multi-tenant table name read back from pg_class was spliced into a
single-quoted SQL literal with str.format(); a crafted table name could
break out of it. Pass it as a bound parameter instead.

Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `ingestion/src/metadata/ingestion/source/database/postgres/pgspider/lineage.py` (modified, +4/-3)
```diff
@@ -49,10 +49,11 @@ def _get_child_tables(connection, multi_tenant_table: str) -> Iterable[any]:
     """
     Get list of child foreign tables of a multi-tenant table
     """
-    sql = PGSPIDER_GET_CHILD_TABLES.format(multi_tenant_table=multi_tenant_table)
-
     with get_connection(connection).connect() as conn:
-        rows = conn.execute(text(sql))
+        rows = conn.execute(
+            text(PGSPIDER_GET_CHILD_TABLES),
+            {"multi_tenant_table": multi_tenant_table},
+        )
         return rows  # noqa: RET504
 
 
```

**File**: `ingestion/src/metadata/ingestion/source/database/postgres/pgspider/queries.py` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@
         JOIN pg_foreign_server fs ON ft.ftserver = fs.oid GROUP BY srvname ORDER BY srvname),
         regex_pattern AS 
             (SELECT '^' || relname || '\\_\\_' || srv.srvname  || '\\_\\_[0-9]+$' regex FROM pg_class
-            CROSS JOIN srv where relname = '{multi_tenant_table}')
+            CROSS JOIN srv where relname = :multi_tenant_table)
             SELECT relname FROM pg_class
             WHERE (relname ~ (SELECT string_agg(regex, '|') FROM regex_pattern))
             AND (relname NOT LIKE '%%\\_%%\\_seq')
```

**File**: `ingestion/tests/unit/lineage/test_pgspider_lineage_unit.py` (modified, +15/-0)
```diff
@@ -734,3 +734,18 @@ def test_next_record_6(self, multi_tenant_tables):
 
             """Validate number of AddLineageRequest"""
             self.assertEqual(0, len(requests))
+
+
+def test_child_tables_query_binds_table_name():
+    """A crafted multi-tenant table name is bound, never spliced into the SQL"""
+    from metadata.ingestion.source.database.postgres.pgspider.lineage import (
+        _get_child_tables,
+    )
+
+    evil = "x'; DROP TABLE t; --"
+    with patch("metadata.ingestion.source.database.postgres.pgspider.lineage.get_connection") as get_connection:
+        _get_child_tables(None, evil)
+
+    query, params = get_connection.return_value.connect.return_value.__enter__.return_value.execute.call_args.args
+    assert evil not in str(query)
+    assert params == {"multi_tenant_table": evil}
```

---

### Incident Patch 9: `1c01620c` (2026-09-30)
**Commit Message**: Fixes 5963: migrate BigQuery CLI E2E to v2 and fix the bugs it found (#33946)

* fix(ingestion): BigQuery types, FKs, complex constraints, system metrics and profiler

Found by strict assertions in the BigQuery CLI E2E v2 migration
(open-metadata/openmetadata-collate#5963):

- bigquery: reflect NUMERIC/BIGNUMERIC as NUMERIC (was INT) and JSON as
  JSON (was VARCHAR); profile JSON with a pass-through type because the
  BigQuery dialect has no JSON deserializer.
- bigquery system metrics: restore the per-table filter; every DML job in
  a dataset was attributed to every profiled table.
- common db source: FK lookup falls back to the current database when a
  connector reports no referred_database (was `svc.None.schema.table`).
- column handler: ARRAY/STRUCT/MAP columns get their NULL/NOT_NULL
  constraint like primitive columns.
- bigquery sampler: pass SQLAlchemy 2 `_set_parent` arguments for STRUCT
  subfields.
- profiler: unique count addresses STRUCT subfields by path and runs on
  the metric thread's session instead of the shared one.

* test(cli-e2e-v2): migrate BigQuery CLI E2E coverage to the v2 framework (#33947)

Adds the `bigquery` connector suite (22 contracts) under
inge

**File**: `ingestion/src/metadata/ingestion/source/database/bigquery/metadata.py` (modified, +6/-9)
```diff
@@ -23,7 +23,7 @@
 from google.cloud.bigquery.schema import SchemaField
 from sqlalchemy import text
 from sqlalchemy.engine.reflection import Inspector
-from sqlalchemy.sql.sqltypes import Interval
+from sqlalchemy.sql.sqltypes import JSON, NUMERIC, Interval
 from sqlalchemy.types import String
 from sqlalchemy_bigquery import BigQueryDialect, _types
 from sqlalchemy_bigquery._types import _get_sqla_column_type
@@ -133,20 +133,17 @@
 }
 
 
-class BQJSON(String):
-    """The SQL JSON type."""
-
-    def get_col_spec(self, **kw):  # pylint: disable=unused-argument
-        return "JSON"
-
-
 logger = ingestion_logger()
 # pylint: disable=protected-access
+# sqlalchemy-bigquery reflects NUMERIC/BIGNUMERIC as the generic Numeric, which the column
+# type parser maps to INT; the NUMERIC class keeps their decimal semantics.
 _types._type_map.update(
     {
         "GEOGRAPHY": create_sqlalchemy_type("GEOGRAPHY"),
-        "JSON": BQJSON,
+        "JSON": JSON,
         "INTERVAL": Interval,
+        "NUMERIC": NUMERIC,
+        "BIGNUMERIC": NUMERIC,
     }
 )
 
```

**File**: `ingestion/src/metadata/ingestion/source/database/common_db_source.py` (modified, +1/-4)
```diff
@@ -660,10 +660,7 @@ def _prepare_foreign_constraints(  # pylint: disable=too-many-arguments, too-man
         Method to prepare the foreign constraints
         """
         referred_column_fqns = []
-        if supports_database:
-            database_name = column.get("referred_database")
-        else:
-            database_name = self.context.get().database
+        database_name = (column.get("referred_database") if supports_database else None) or self.context.get().database  # pyright: ignore[reportAttributeAccessIssue]
 
         referred_schema = column.get("referred_schema") or schema_name
         referred_table_fqn = (
```

**File**: `ingestion/src/metadata/ingestion/source/database/sql_column_handler.py` (modified, +2/-2)
```diff
@@ -350,8 +350,8 @@ def process_column(column: dict):
                     om_column.precision = int(precision[0])
                     om_column.scale = int(precision[1])
             else:
-                col_obj = self._process_complex_col_type(column=column, parsed_string=parsed_string)
-                om_column = col_obj
+                om_column = self._process_complex_col_type(column=column, parsed_string=parsed_string)
+                om_column.constraint = self._get_column_constraints(column, pk_columns, column_level_unique_constraints)
 
                 if column.get("children"):
                     # Prioritize source-provided children for column processing.
```

**File**: `ingestion/src/metadata/profiler/interface/sqlalchemy/profiler_interface.py` (modified, +11/-3)
```diff
@@ -26,6 +26,7 @@
 from typing import Any
 
 from sqlalchemy import Column, inspect, text
+from sqlalchemy import column as sa_column
 from sqlalchemy.exc import DBAPIError, ProgrammingError, ResourceClosedError
 from sqlalchemy.orm import scoped_session
 from sqlalchemy.sql.elements import Label
@@ -289,15 +290,22 @@ def _compute_query_metrics(
                 return {metric.name(): data}
             if isinstance(metric_query, Label):
                 # hotfix to handle transition of unique count implementation
-                sample_column = sample.__table__.c[column.key] if hasattr(sample, "__table__") else sample.c[column.key]
+                sample_columns = sample.__table__.c if hasattr(sample, "__table__") else sample.c
+                # A BigQuery STRUCT subfield (`parent.child`) is sampled through its parent, so it is not a
+                # sample column; address it by path, as the metric query itself does.
+                sample_column = (
+                    sample_columns[column.key] if column.key in sample_columns else sa_column(column.name, column.type)
+                )
                 subquery = (
-                    self.session.query(Count(sample_column).fn().label(UNIQUE_COUNT_GROUP_ALIAS))
+                    session.query(
+                        Count(sample_column).fn().label(UNIQUE_COUNT_GROUP_ALIAS)  # pyright: ignore[reportArgumentType]
+                    )
                     .select_from(sample)
                     .group_by(sample_column)
                     .subquery()
                 )
 
-                metric_query = self.session.query(metric_query).select_from(subquery)
+                metric_query = session.query(metric_query).select_from(subquery)
 
             row = runner.select_first_from_query(metric_query)
             return row._asdict()
```

**File**: `ingestion/src/metadata/profiler/metrics/system/bigquery/system.py` (modified, +3/-5)
```diff
@@ -136,10 +136,8 @@ def get_system_profile(
                     "rowsAffected": getattr(q, rows_affected_field),
                 }
                 for q in query_results
-                if getattr(q, rows_affected_field)
-                or -1 > 0  # noqa: RUF021
-                and q.project_id == project_id
-                and q.dataset_id == dataset_id
-                and q.table_name == table
+                # JOBS is queried per dataset, so every sibling table's DML is in query_results.
+                if (getattr(q, rows_affected_field) or 0) > 0
+                and (q.project_id, q.dataset_id, q.table_name) == (project_id, dataset_id, table)
             ]
         )
```

---

### Incident Patch 10: `857ded97` (2026-09-30)
**Commit Message**: Fix memory extraction loss and reuse duplicate facts (#34154)

* fix(context): persist memory extraction jobs

Keep page extraction queued across restarts and coalesce autosaves in
background_jobs using the existing page row. Reject incomplete LLM
runs before reconciliation so source hashes cannot hide missing memories.

* fix(context): queue file memories with pages

Send uploaded-file LLM extraction through the shared background worker.
Keep file status recovery for crashes before the memory job is queued,
and deduplicate recovery jobs by content snapshot.

* fix(memory): reuse existing file facts

Share memory IDs for identical file bytes and equivalent extracted facts. Preserve shared memories when one source changes or is removed.

* fix(jobs): protect memory queue and page saves

Update pending page jobs by primary key to avoid MySQL gap locks. Keep article saves successful when queueing fails, process a claimed page if deferral fails, and reserve shared worker capacity for other job types.

**File**: `docs/adr/2026-09-29-context-file-memory-reuse.md` (added, +106/-0)
```diff
@@ -0,0 +1,106 @@
+# ADR: Reuse context memories during file extraction
+
+- **Status:** Accepted (implementation on this branch)
+- **Date:** 2026-09-29
+- **Branch:** `pmbrull/memphis`
+- **Related:** Context Center file upload and memory extraction
+
+## Context
+
+Uploading the same document under two different file names produced two sets of memories with
+identical questions and answers. The existing content-hash gate only compared a file with its own
+previous extraction, and reconciliation only looked at memories linked to that source. Neither
+check found information already extracted from another file.
+
+File identity and fact identity are different. An identical upload can reuse the complete result
+of a prior extraction without invoking the memory extraction model. A different document may still
+contain facts that existing memories cover, so each newly derived fact needs a separate check
+before persistence.
+
+## Decision
+
+### 1. Process the current file content
+
+The upload stores the file and a SHA-256 checksum of its bytes. Asynchronous processing reads the
+current content from object storage and extracts text. When memory extraction is enabled, a
+persistent job processes the current head content. The file moves through `Uploaded`, `Analyzing`,
+and `ExtractingContext` to `Processed`, or to `Failed` when a stage fails. A job for a superseded
+content version does not process that older version.
+
+The shared `ContextProcessingEngine` skips extraction when a source's checksum matches its last
+successful `extractionStats.sourceHash`. For a new file, `FileContextProcessingEngine` also looks
+for a processed, non-deleted file whose recorded extraction hash matches the new checksum. If all
+of that file's linked memories are active, entity-visible, entity-scoped file extractions, the
+new file links to those same memory IDs. It records the source hash and prior chunk counts with
+`pillsCreated = 0`; it does not call the memory extraction model. If no eligible prior result
+exists, normal extraction proceeds. In particular, an earlier result with no linked memories
+cannot supply a reusable set.
+
+### 2. Derive candidate facts for other content
+
+`ContextMemoryExtractor` splits extracted text into paragraph-aligned chunks, at most eight, and
+asks the LLM for candidate memories. It deduplicates repeated normalized questions within that
+derivation. An incomplete or over-limit derivation fails the run so that a partial result is not
+recorded as successfully extracted.
+
+`ContextMemoryReconciler` first compares candidates with memories already linked to the same
+source. Exact normalized questions and then weighted text similarity preserve memory IDs across
+re-extractions, including retrieval telemetry. A human-edited memory is left unchanged. If a
+shared memory's fact changes in one source, that source releases its link before reconciling the
+new fact; the other source retains the old memory.
+
+### 3. Check each unmatched fact against existing memories
+
+Before creating an unmatched candidate, `SemanticMemoryDuplicateFinder` searches for existing
+file-extracted memories. It uses vector search when available. If vector search fails or returns
+no eligible candidates, it queries the regular memory search index. The lookup examines up to
+five candidates; a nonempty vector result does not trigger a second keyword search.
+
+Candidates are loaded from the repository and must still be active, entity-visible
+`FILE_EXTRACTION` memories with the same memory scope and memory type. Conflicting numeric values
+are rejected. Identical normalized question and answer text is accepted directly. Otherwise, an
+LLM selects a candidate only when the two question-and-answer pairs express the same factual
+claim in both directions, preserving entities, numbers, units, qualifiers, and negation. When one
+qualifies, reconciliation links its existing memory ID to the new file. Otherwise it creates a
+new memory. The searc
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/OpenMetadataApplication.java` (modified, +2/-0)
```diff
@@ -102,6 +102,7 @@
 import org.openmetadata.service.config.CacheConfiguration;
 import org.openmetadata.service.config.OMWebBundle;
 import org.openmetadata.service.config.OMWebConfiguration;
+import org.openmetadata.service.context.center.ContextMemoryExtractionJobHandler;
 import org.openmetadata.service.csv.CsvAsyncJobManager;
 import org.openmetadata.service.csv.CsvImportExportJobHandler;
 import org.openmetadata.service.events.EventFilter;
@@ -531,6 +532,7 @@ protected void registerMCPServer(
         CsvAsyncJobManager.CSV_JOB_HANDLER_NAME,
         new CsvImportExportJobHandler(CsvAsyncJobManager.getInstance()));
     registry.register(OntologyBulkJobManager.HANDLER_NAME, ontologyBulkJobHandler);
+    registry.register(new ContextMemoryExtractionJobHandler());
     return registry;
   }
 
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/context/center/ContextFileProcessingService.java` (modified, +48/-23)
```diff
@@ -30,16 +30,16 @@
 import org.openmetadata.service.jdbi3.ContextFileRepository;
 import org.openmetadata.service.jdbi3.ContextMemoryRepository;
 import org.openmetadata.service.jdbi3.ListFilter;
+import org.openmetadata.service.jobs.JobDAO;
 import org.openmetadata.service.llm.LLMClientHolder;
 import org.openmetadata.service.util.RequestEntityCache;
 
 /**
  * Orchestrates asynchronous processing of an uploaded {@link ContextFile}: text extraction
  * (Analyzing) followed by LLM knowledge-pill extraction (ExtractingContext), ending at Processed.
- * The two stages run on separate pools — text extraction is CPU-bound, the LLM step is
- * network-bound and seconds-long, so mixing them would starve the text pool. All persistence goes
- * through conditional updates so a concurrent writer never has its change clobbered; exhausted
- * contention requeues the stage instead of failing the file.
+ * Text extraction runs on a bounded pool; the LLM stage uses the shared persistent background job
+ * queue with article memory extraction. All entity persistence goes through conditional updates so
+ * a concurrent writer never has its change clobbered; exhausted contention requeues the stage.
  */
 @Slf4j
 public class ContextFileProcessingService {
@@ -49,7 +49,7 @@ public class ContextFileProcessingService {
   private final Supplier<AssetService> assetServiceSupplier;
   private final Executor executor;
   private final ContextFileTextExtractor textExtractor;
-  private final Executor llmExecutor;
+  private final JobDAO jobDao;
   private final Supplier<DocumentMemoryExtractor> memoryExtractorSupplier;
   private final Supplier<Boolean> llmEnabledSupplier;
   private final Supplier<FileContextProcessingEngine> fileEngineSupplier;
@@ -61,7 +61,7 @@ public ContextFileProcessingService(ContextFileRepository repository) {
         AssetServiceFactory::getService,
         DEFAULT_EXECUTOR,
         new ContextFileTextExtractor(),
-        LLM_EXECUTOR,
+        Entity.getJobDAO(),
         () -> AiProviderHolder.get().documentExtractor(),
         LLMClientHolder::isMemoryExtractionEnabled,
         null);
@@ -72,22 +72,22 @@ public ContextFileProcessingService(ContextFileRepository repository) {
       Supplier<AssetService> assetServiceSupplier,
       Executor executor,
       ContextFileTextExtractor textExtractor,
-      Executor llmExecutor,
+      JobDAO jobDao,
       Supplier<DocumentMemoryExtractor> memoryExtractorSupplier,
       Supplier<Boolean> llmEnabledSupplier,
       Supplier<FileContextProcessingEngine> fileEngineSupplier) {
     this.repository = repository;
     this.assetServiceSupplier = assetServiceSupplier;
     this.executor = executor;
     this.textExtractor = textExtractor;
-    this.llmExecutor = llmExecutor;
+    this.jobDao = jobDao;
     this.memoryExtractorSupplier = memoryExtractorSupplier;
     this.llmEnabledSupplier = llmEnabledSupplier;
     this.fileEngineSupplier = fileEngineSupplier;
   }
 
   /**
-   * Single shared thread pool per stage. Kept separate from {@code
+   * Shared text-extraction pool. Kept separate from {@code
    * AsyncService.getExecutorService()} because {@link #process(UUID, UUID)} blocks on {@code
    * AssetService.read(...).join()} for S3/Azure reads, which are themselves scheduled on
    * AsyncService — sharing the pool would starve those read tasks (and potentially deadlock) once
@@ -100,9 +100,6 @@ public ContextFileProcessingService(ContextFileRepository repository) {
   private static final Executor DEFAULT_EXECUTOR =
       createBoundedExecutor("context-file-extraction-");
 
-  /** Separate network-bound pool for LLM completion so slow calls never starve text extraction. */
-  private static final Executor LLM_EXECUTOR = createBoundedExecutor("context-memory-extraction-");
-
   private static final Set<ProcessingStatus> TRANSIENT_STATUSES =
       Set.of(
           ProcessingStatus.Uploaded,
@@ -163,8 +160,17 @@ public int recoverInterruptedProcessing() {
        
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/context/center/ContextMemoryExtractionJobHandler.java` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+package org.openmetadata.service.context.center;
+
+import java.util.UUID;
+import java.util.function.Supplier;
+import org.openmetadata.schema.jobs.BackgroundJob;
+import org.openmetadata.schema.utils.JsonUtils;
+import org.openmetadata.service.Entity;
+import org.openmetadata.service.jdbi3.ContextFileRepository;
+import org.openmetadata.service.jobs.BackgroundJobException;
+import org.openmetadata.service.jobs.JobHandler;
+import org.openmetadata.service.util.RequestEntityCache;
+
+/** Runs article and uploaded-file memory extraction from the same persistent job queue. */
+public class ContextMemoryExtractionJobHandler implements JobHandler {
+  public record Args(String entityType, UUID sourceId, UUID contentId, String jobKey) {
+    public static Args page(UUID pageId) {
+      return new Args(Entity.PAGE, pageId, null, Entity.PAGE + ":" + pageId);
+    }
+
+    public static Args file(UUID fileId, UUID contentId) {
+      return new Args(
+          Entity.CONTEXT_FILE,
+          fileId,
+          contentId,
+          Entity.CONTEXT_FILE + ":" + fileId + ":" + contentId);
+    }
+  }
+
+  private final Supplier<PageContextProcessingEngine> pageEngineSupplier;
+  private final Supplier<ContextFileProcessingService> fileServiceSupplier;
+
+  public ContextMemoryExtractionJobHandler() {
+    this(
+        PageContextProcessingEngineHolder::get,
+        () ->
+            new ContextFileProcessingService(
+                (ContextFileRepository) Entity.getEntityRepository(Entity.CONTEXT_FILE)));
+  }
+
+  ContextMemoryExtractionJobHandler(
+      Supplier<PageContextProcessingEngine> pageEngineSupplier,
+      Supplier<ContextFileProcessingService> fileServiceSupplier) {
+    this.pageEngineSupplier = pageEngineSupplier;
+    this.fileServiceSupplier = fileServiceSupplier;
+  }
+
+  @Override
+  public void runJob(BackgroundJob job) throws BackgroundJobException {
+    try {
+      Args args = JsonUtils.convertValue(job.getJobArgs(), Args.class);
+      if (args == null || args.sourceId() == null) {
+        throw new IllegalArgumentException("sourceId is required");
+      }
+      RequestEntityCache.clear();
+      if (Entity.PAGE.equals(args.entityType())) {
+        pageEngineSupplier.get().runQueued(args.sourceId());
+      } else if (Entity.CONTEXT_FILE.equals(args.entityType()) && args.contentId() != null) {
+        fileServiceSupplier.get().runMemoryExtraction(args.sourceId(), args.contentId());
+      } else {
+        throw new IllegalArgumentException("Unsupported memory source or missing contentId");
+      }
+    } catch (RuntimeException e) {
+      throw new BackgroundJobException(
+          job.getId(), "Context memory extraction failed: " + e.getMessage(), e);
+    } finally {
+      RequestEntityCache.clear();
+    }
+  }
+
+  @Override
+  public boolean sendStatusToWebSocket() {
+    return false;
+  }
+}
```

**File**: `openmetadata-service/src/main/java/org/openmetadata/service/context/center/ContextMemoryExtractor.java` (modified, +19/-8)
```diff
@@ -8,6 +8,7 @@
 import java.util.UUID;
 import lombok.extern.slf4j.Slf4j;
 import org.openmetadata.schema.entity.context.ContextMemory;
+import org.openmetadata.schema.entity.context.ContextMemoryScope;
 import org.openmetadata.schema.entity.context.ContextMemorySourceType;
 import org.openmetadata.schema.entity.context.ContextMemoryStatus;
 import org.openmetadata.schema.entity.context.ContextMemoryType;
@@ -46,16 +47,19 @@ public ContextMemoryExtractor(LLMCompletionClient llmClient) {
 
   /**
    * Derives memories from {@code text} without persisting anything. Long documents are processed in
-   * paragraph-aligned chunks, one LLM call per chunk, with pills deduplicated across chunks. Chunk
-   * failures are tolerated as long as at least one chunk succeeds — the stats in the result expose
-   * partial coverage; if every chunk fails the run fails. Kept side-effect free so callers can
-   * reconcile the source's previous pills only after the LLM pass succeeded. Each derived memory is
-   * linked to {@code sourceRef} and tagged {@code sourceType}.
+   * paragraph-aligned chunks, one LLM call per chunk, with pills deduplicated across chunks. The
+   * whole derivation fails if any chunk fails or the document exceeds the configured chunk budget;
+   * otherwise reconciliation could retire good pills and stamp an incomplete run as successful.
+   * Each derived memory is linked to {@code sourceRef} and tagged {@code sourceType}.
    */
   @Override
   public DeriveResult derive(
       String text, EntityReference sourceRef, ContextMemorySourceType sourceType) {
     ChunkPlan plan = chunkText(text, sourceRef);
+    if (plan.totalChunks() > plan.chunks().size()) {
+      throw new LLMCompletionException(
+          "Knowledge pill extraction exceeds the " + MAX_CHUNKS + " chunk limit");
+    }
     List<KnowledgePill> collected = new ArrayList<>();
     int processed = 0;
     RuntimeException firstFailure = null;
@@ -72,9 +76,14 @@ public DeriveResult derive(
         firstFailure = firstFailure == null ? e : firstFailure;
       }
     }
-    if (processed == 0 && firstFailure != null) {
+    if (firstFailure != null) {
       throw new LLMCompletionException(
-          "All " + plan.chunks().size() + " chunks failed knowledge pill extraction", firstFailure);
+          "Knowledge pill extraction failed for "
+              + (plan.chunks().size() - processed)
+              + " of "
+              + plan.chunks().size()
+              + " chunks",
+          firstFailure);
     }
     List<ContextMemory> memories = new ArrayList<>();
     for (KnowledgePill pill : dedupe(collected)) {
@@ -173,10 +182,12 @@ private ContextMemory toMemory(
         .withAnswer(pill.answer())
         .withSummary(pill.summary())
         .withMemoryType(parseType(pill.memoryType()))
+        .withMemoryScope(ContextMemoryScope.ENTITY_SCOPED)
         .withStatus(ContextMemoryStatus.ACTIVE)
         .withSourceType(sourceType)
         .withSourceEntity(sourceRef)
-        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.SHARED))
+        .withPrimaryEntity(sourceRef)
+        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY))
         .withUpdatedBy(Entity.ADMIN_USER_NAME)
         .withUpdatedAt(System.currentTimeMillis());
   }
```

#### Recent Merged Pull Requests:
- **PR #34319** (2026-09-30): test(e2e): give Glossary Term tab-order test its own persona (@karanh37)
- **PR #34311** (closed): feat(ui): add persona General Preferences with default landing page (backport #34189 to 2.0) (@anuj-kumary)
- **PR #34296** (2026-09-30): test(e2e): quarantine flaky Playwright specs (@Rohit0301)
- **PR #34293** (2026-09-30): fix(ui): swap workflow canvas/node surfaces and stretch empty states (@anuj-kumary)
- **PR #34289** (2026-09-30): fix(data-quality): keep a test case's status on its newest result (backport 1.13 #34280) (@manerow)
- **PR #34288** (2026-09-30): Fixes #34212: Replace existing tier on approval [2.0] (@yan-3005)
- **PR #34285** (2026-09-30): fix(data-quality): keep a test case's status on its newest result (backport 2.0 #34280) (@manerow)
- **PR #34283** (2026-09-30): ci(playwright): post merge-queue flaky tests to #pw-health (@chirag-madlani)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
