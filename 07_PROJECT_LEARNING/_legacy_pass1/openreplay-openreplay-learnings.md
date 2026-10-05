# Forensic Learning Record (Deep Inspection): openreplay/openreplay

> **Canonical Artifact**: `07_PROJECT_LEARNING/openreplay-openreplay-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/openreplay/openreplay](https://github.com/openreplay/openreplay))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:24:16.741Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `openreplay/openreplay`
- **Description**: Session replay, cobrowsing and product analytics you can self-host. Best for reproducing issues and iterating on your product.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12927 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/app.py`
```
import logging
import time
from contextlib import asynccontextmanager

import psycopg_pool
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from decouple import config
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from psycopg import AsyncConnection
from psycopg.rows import dict_row
from starlette.responses import StreamingResponse

from chalicelib.utils import helper
from chalicelib.utils import pg_client, ch_client
from chalicelib.utils.log import sanitize
from crons import core_crons, core_dynamic_crons
from routers import core, core_dynamic
from routers.subs import health, spot, mcp

loglevel = config("LOGLEVEL", default=logging.WARNING)
print(f">Loglevel set to: {loglevel}")
logging.basicConfig(level=loglevel)
logger = logging.getLogger(__name__)


class ORPYAsyncConnection(AsyncConnection):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, row_factory=dict_row, **kwargs)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logging.info(">>>>> starting up <<<<<")
    ap_logger = logging.getLogger("apscheduler")
    ap_logger.setLevel(loglevel)

    app.schedule = AsyncIOScheduler()
    await pg_client.init()
    await ch_client.init()
    app.schedule.start()

    for job in core_crons.cron_jobs + core_dynamic_crons.cron_jobs:
        app.schedule.add_job(id=job["func"].__name__, **job)

    ap_logger.info(">Scheduled jobs:")
    for job in app.schedule.get_jobs():
        ap_logger.info(
            {
                "Name": str(job.id),
                "Run Frequency": str(job.trigger),
                "Next Run": str(job.next_run_time),
            }
        )

    database = {
        "host": config("pg_host", default="localhost"),
        "dbname": config("pg_dbname", default="orpy"),
        "user": config("pg_user", default="orpy"),
        "password": config("pg_password", default="orpy"),
        "port": config("pg_port", cast=int, default=5432),
        "application_name": "AIO" + config("APP_NAME", default="PY"),
    }

    database = psycopg_pool.AsyncConnectionPool(
        kwargs=database,
        connection_class=ORPYAsyncConnection,
        min_size=config("PG_AIO_MINCONN", cast=int, default=1),
        max_size=config("PG_AIO_MAXCONN", cast=int, default=5),
    )
    await database.open()
    app.state.postgresql = database

    # App listening
    yield

    # Shutdown
    await database.close()
    logging.info(">>>>> shutting down <<<<<")
    app.schedule.shutdown(wait=True)
    await pg_client.terminate()


app = FastAPI(
    root_path=config("root_path", default="/api"),
    docs_url=config("docs_url", default=""),
    redoc_url=config("redoc_url", default=""),
    lifespan=lifespan,
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

IGNORE_ENDPOINT_LOG = ["/"]


@app.middleware("http")
async def log_all_requests(request: Request, call_next):
    method = sanitize(request.method, max_length=16)
    endpoint = sanitize(request.url.path)
    response: Response = await call_next(request)
    # Log all endpoints except health check
    if request.url.path not in IGNORE_ENDPOINT_LOG or response.status_code != 200:
        logger.info(f"{method}:{endpoint} {response.status_code}")
    return response


@app.middleware("http")
async def or_middleware(request: Request, call_next):
    if helper.TRACK_TIME:
        now = time.time()
    try:
        response: StreamingResponse = await call_next(request)
    except:
        logging.error(f"{sanitize(request.method, max_length=16)}: {sanitize(request.url.path)} FAILED!")
        raise
    if response.status_code // 100 != 2:
        logging.warning(
            f"{sanitize(request.method, max_length=16)}:{sanitize(request.url.path)} {response.status_code}!")
    if helper.TRACK_TIME:
        now = time.time() - now
        if now > 2:
            now = round(now, 2)
            logging.warning(
                f"Execution time: {now} s for {sanitize(request.method, max_length=16)}: {sanitize(request.url.path)}")
    response.headers["x-robots-tag"] = 'noindex, nofollow'
    return response


origins = [
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(core.public_app)
app.include_router(core.app)
app.include_router(core.app_apikey)
app.include_router(core_dynamic.public_app)
app.include_router(core_dynamic.app)
app.include_router(core_dynamic.app_apikey)
app.include_router(health.public_app)
app.include_router(health.app)
app.include_router(health.app_apikey)

app.include_router(spot.public_app)
app.include_router(spot.app)
app.include_router(spot.app_apikey)

app.include_router(mcp.app)
app.include_router(mcp.public_app)

```

### Core Architecture Module: `api/app_alerts.py`
```
import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from decouple import config
from fastapi import FastAPI

from chalicelib.core.alerts import alerts_processor
from chalicelib.utils import pg_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    ap_logger.info(">>>>> starting up <<<<<")
    await pg_client.init()
    app.schedule.start()
    app.schedule.add_job(id="alerts_processor", **{"func": alerts_processor.process, "trigger": "interval",
                                                   "minutes": config("ALERTS_INTERVAL", cast=int, default=5),
                                                   "misfire_grace_time": 20})

    ap_logger.info(">Scheduled jobs:")
    for job in app.schedule.get_jobs():
        ap_logger.info({"Name": str(job.id), "Run Frequency": str(job.trigger), "Next Run": str(job.next_run_time)})

    # App listening
    yield

    # Shutdown
    ap_logger.info(">>>>> shutting down <<<<<")
    app.schedule.shutdown(wait=False)
    await pg_client.terminate()


loglevel = config("LOGLEVEL", default=logging.INFO)
print(f">Loglevel set to: {loglevel}")
logging.basicConfig(level=loglevel)
ap_logger = logging.getLogger('apscheduler')
ap_logger.setLevel(loglevel)

app = FastAPI(root_path=config("root_path", default="/alerts"), docs_url=config("docs_url", default=""),
              redoc_url=config("redoc_url", default=""), lifespan=lifespan)

app.schedule = AsyncIOScheduler()
ap_logger.info("============= ALERTS =============")


@app.get("/")
async def root():
    return {"status": "Running"}


@app.get("/health")
async def get_health_status():
    return {"data": {
        "health": True,
        "details": {"version": config("version_number", default="unknown")}
    }}


if config("LOCAL_DEV", default=False, cast=bool):
    @app.get('/trigger', tags=["private"])
    async def trigger_main_cron():
        ap_logger.info("Triggering main cron")
        alerts_processor.process()

```

### Core Architecture Module: `api/auth/auth_apikey.py`
```
import logging
from typing import Optional

from fastapi import Request
from fastapi.security import APIKeyHeader
from starlette import status
from starlette.exceptions import HTTPException

from chalicelib.core import authorizers
from schemas import CurrentAPIContext

logger = logging.getLogger(__name__)


class APIKeyAuth(APIKeyHeader):
    def __init__(self, auto_error: bool = True):
        super(APIKeyAuth, self).__init__(name="Authorization", auto_error=auto_error)

    async def __call__(self, request: Request) -> Optional[CurrentAPIContext]:
        api_key: Optional[str] = await super(APIKeyAuth, self).__call__(request)
        r = authorizers.api_key_authorizer(api_key)
        if r is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API Key",
            )
        r["authorizer_identity"] = "api_key"
        logger.debug(r)
        request.state.authorizer_identity = "api_key"
        request.state.currentContext = CurrentAPIContext(tenantId=r["tenantId"])
        return request.state.currentContext

```

### Core Architecture Module: `api/auth/auth_jwt.py`
```
import datetime
import logging
from typing import Optional

from decouple import config
from fastapi import Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette import status
from starlette.exceptions import HTTPException

import schemas
from chalicelib.core import authorizers, users, spot

logger = logging.getLogger(__name__)


def _get_jwt_leeway() -> datetime.timedelta:
    days = config("JWT_LEEWAY_DAYS", default=None)
    if days is not None:
        return datetime.timedelta(days=int(days))
    return datetime.timedelta(seconds=config("JWT_LEEWAY_S", cast=int, default=300))


def _get_current_auth_context(request: Request, jwt_payload: dict) -> schemas.CurrentContext:
    user = users.get_user(user_id=jwt_payload.get("userId", -1), tenant_id=jwt_payload.get("tenantId", -1))
    if user is None:
        logger.warning("User not found.")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not found.")
    request.state.authorizer_identity = "jwt"
    request.state.currentContext = schemas.CurrentContext(tenantId=jwt_payload.get("tenantId", -1),
                                                          userId=jwt_payload.get("userId", -1),
                                                          email=user["email"],
                                                          role=user["role"])
    return request.state.currentContext


class JWTAuth(HTTPBearer):
    def __init__(self, auto_error: bool = True):
        super(JWTAuth, self).__init__(auto_error=auto_error)

    async def __call__(self, request: Request) -> Optional[schemas.CurrentContext]:
        if request.url.path in ["/refresh", "/api/refresh"]:
            return await self.__process_refresh_call(request)

        elif request.url.path in ["/spot/refresh", "/api/spot/refresh"]:
            return await self.__process_spot_refresh_call(request)

        else:
            credentials: HTTPAuthorizationCredentials = await super(JWTAuth, self).__call__(request)
            if credentials:
                if not credentials.scheme == "Bearer":
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                        detail="Invalid authentication scheme.")
                jwt_payload = authorizers.jwt_authorizer(scheme=credentials.scheme, token=credentials.credentials)
                auth_exists = jwt_payload is not None and users.auth_exists(user_id=jwt_payload.get("userId", -1),
                                                                            jwt_iat=jwt_payload.get("iat", 100))
                if jwt_payload is None \
                        or jwt_payload.get("iat") is None or jwt_payload.get("aud") is None \
                        or not auth_exists:
                    if jwt_payload is not None:
                        logger.debug(jwt_payload)
                        if jwt_payload.get("iat") is None:
                            logger.debug("iat is None")
                        if jwt_payload.get("aud") is None:
                            logger.debug("aud is None")
                    if not auth_exists:
                        logger.warning("not users.auth_exists")

                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid token or expired token.")

                if jwt_payload.get("aud", "").startswith("spot") and not request.url.path.startswith("/spot"):
                    # Allow access to spot endpoints only
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                        detail="Unauthorized access (spot).")
                elif jwt_payload.get("aud", "").startswith("front") and request.url.path.startswith("/spot"):
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                        detail="Unauthorized access endpoint reserved for Spot only.")

                return _get_current_auth_context(request=request, jwt_payload=jwt_payload)

        logger.warning("Invalid authorization code.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid authorization code.")

    async def __process_refresh_call(self, request: Request) -> schemas.CurrentContext:
        if "refreshToken" not in request.cookies:
            logger.warning("Missing refreshToken cookie.")
            jwt_payload = None
        else:
            jwt_payload = authorizers.jwt_refresh_authorizer(scheme="Bearer", token=request.cookies["refreshToken"])

        if jwt_payload is None or jwt_payload.get("jti") is None:
            logger.warning("Null refreshToken's payload, or null JTI.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Invalid refresh-token or expired refresh-token.")
        auth_exists = users.refresh_auth_exists(user_id=jwt_payload.get("userId", -1),
                                                jwt_jti=jwt_payload["jti"])
        if not auth_exists:
            logger.warning("refreshToken's user not found.")
            logger.warning(jwt_payload)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Invalid refresh-token or expired refresh-token.")

        credentials: HTTPAuthorizationCredentials = await super(JWTAuth, self).__call__(request)
        if credentials:
            if not credentials.scheme == "Bearer":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="Invalid authentication scheme.")
            old_jwt_payload = authorizers.jwt_authorizer(scheme=credentials.scheme, token=credentials.credentials,
                                                         leeway=_get_jwt_leeway())
            if old_jwt_payload is None \
                    or old_jwt_payload.get("userId") is None \
                    or old_jwt_payload.get("userId") != jwt_payload.get("userId"):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid token or expired token.")

            return _get_current_auth_context(request=request, jwt_payload=jwt_payload)

        logger.warning("Invalid authorization code (refresh logic).")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid authorization code for refresh.")

    async def __process_spot_refresh_call(self, request: Request) -> schemas.CurrentContext:
        if "spotRefreshToken" not in request.cookies:
            logger.warning("Missing spotRefreshToken cookie.")
            jwt_payload = None
        else:
            jwt_payload = authorizers.jwt_refresh_authorizer(scheme="Bearer", token=request.cookies["spotRefreshToken"])

        if jwt_payload is None or jwt_payload.get("jti") is None:
            logger.warning("Null spotRefreshToken's payload, or null JTI.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Invalid spotRefreshToken or expired refresh-token.")
        auth_exists = spot.refresh_auth_exists(user_id=jwt_payload.get("userId", -1),
                                               jwt_jti=jwt_payload["jti"])
        if not auth_exists:
            logger.warning("spotRefreshToken's user not found.")
            logger.warning(jwt_payload)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Invalid spotRefreshToken or expired refresh-token.")

        credentials: HTTPAuthorizationCredentials = await super(JWTAuth, self).__call__(request)
        if credentials:
            if not credentials.scheme == "Bearer":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="Invalid spot-authentication scheme.")
            old_jwt_payload = authorizers.jwt_authorizer(scheme=credentials.s
```

### Core Architecture Module: `api/auth/auth_project.py`
```
import logging

from fastapi import Request
from starlette import status
from starlette.exceptions import HTTPException

import schemas
from chalicelib.core import projects
from chalicelib.utils.log import sanitize
from or_dependencies import OR_context

logger = logging.getLogger(__name__)


class ProjectAuthorizer:
    def __init__(self, project_identifier):
        self.project_identifier: str = project_identifier

    async def __call__(self, request: Request) -> None:
        if len(request.path_params.keys()) == 0 or request.path_params.get(self.project_identifier) is None:
            return
        current_user: schemas.CurrentContext = await OR_context(request)
        value = request.path_params[self.project_identifier]
        current_project = None
        if self.project_identifier == "projectId" \
                and (isinstance(value, int) or isinstance(value, str) and value.isnumeric()):
            current_project = projects.get_project(project_id=value, tenant_id=current_user.tenant_id)
        elif self.project_identifier == "projectKey":
            current_project = projects.get_by_project_key(project_key=value)

        if current_project is None:
            logger.debug(f"unauthorized project {self.project_identifier}:{sanitize(value)}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="project not found.")
        else:
            current_project = schemas.ProjectContext(projectId=current_project["projectId"],
                                                     projectKey=current_project["projectKey"],
                                                     platform=current_project["platform"],
                                                     name=current_project["name"])
            request.state.currentContext.project = current_project

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
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

- **Issue #4829** (2026-08-13): **Adding a custom Event filter never triggers a refetch — session list silently keeps the previous results**
  *Symptoms*: **Describe the issue**  Adding a custom event filter in Sessions search does not re-run the search. The chip is added, but no `POST /v2/api/{projectId}/sessions/search` request is issued, so the list silently keeps the previous (unfiltered) results.  **Steps to reproduce the issue**  1. Go to Sessions, click `+ Add` next to `Events`, and pick any custom event (one sent with `tracker.event(name, payload)`). 2. The filter chip appears, but the session count and list stay exactly the same. In DevTools → Network no `sessions/search` request is made — the only request is `GET /api/pa/{projectId}/properties/search?en=<event>&ac=false`. 3. Now change anything else — switch the All/Errors tab, change the date range, or go to page 2. The search fires, and the event filter is applied correctly.  **Expected behavior**  Adding an event filter re-runs the session search immediately, the same way removing or editing a filter does.  **Screenshots**  Not applicable — the symptom is the absence of a network request (step 2).  **OpenReplay Environment**  - Frontend stack: Next.js / React / TanStack Query  - OpenReplay version: 1.27.0 (FOSS, self-hosted)  - Tracker version: 18.1.0  - Plugins used: Fetch (built-in Network module), Product Analytics (`analytics: { active: true }`)  - Cloud provider: AWS  - System specs: m7i.xlarge, 4vCPU/16Gb  **Additional context**  The search API itself returns correct results for the same filter, so this looks like a UI-side refetch problem. Sending the reques
  **Post-Mortem & Fix Analysis**:
  > should be patched in latest frontend image.

- **Issue #4806** (2026-07-29): **SanaUllah**
  *Symptoms*: **Describe the issue** A short description of what the issue is.  **Steps to reproduce the issue** 1. Step 1 2. Step 2 3. You got it :)  **Expected behavior** What you expected to happen.  **Screenshots** If possible, that would be make our life easier.  **OpenReplay Environment**  - Frontend stack: [e.g. React/Axios/MobX, Next]  - OpenReplay version: [e.g. 1.6.0]  - Tracker version: [e.g. 3.5.10]  - Plugins used: [e.g. Fetch, Redux]  - Cloud provider: [e.g. AWS, GCP]  - System specs: [e.g. 2vCPU/16Gb with 50Gb of storage]  **Additional context** Add additional information you think might be relevant for this behavior. 

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

### Incident Patch 1: `9b559750` (2026-09-30)
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

### Incident Patch 2: `870b1873` (2026-09-29)
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

### Incident Patch 3: `50d755d7` (2026-09-25)
**Commit Message**: fix(migration): pg version

Signed-off-by: rjshrjndrn <rjshrjndrn@gmail.com>

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

### Incident Patch 4: `f13d6a82` (2026-09-25)
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

### Incident Patch 5: `c7d9ad13` (2026-09-24)
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

### Incident Patch 6: `0601034c` (2026-09-24)
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

### Incident Patch 7: `785ec441` (2026-09-23)
**Commit Message**: ui: fix charts bundling as side-effect free

**File**: `frontend/package.json` (modified, +2/-1)
```diff
@@ -6,7 +6,8 @@
   "sideEffects": [
     "**/*.css",
     "**/*.scss",
-    "./app/init/**"
+    "./app/init/**",
+    "./app/components/Charts/init.ts"
   ],
   "scripts": {
     "writeCommitHash": "node ./scripts/getCommitHash/getHash.js",
```

---

### Incident Patch 8: `77461b9c` (2026-09-23)
**Commit Message**: fix(dashboards): address review on the detail query

- never serialise userId on dashboard responses
- skip series of soft-deleted metrics inside the series CTE

**File**: `backend/pkg/analytics/dashboards/dashboards.go` (modified, +4/-1)
```diff
@@ -72,7 +72,10 @@ func (s *dashboardsImpl) Get(projectId int, dashboardID int, userID uint64) (*Ge
 				) AS series
 			FROM metric_series ms
 			WHERE ms.metric_id IN (
-				SELECT dw.metric_id FROM dashboard_widgets dw WHERE dw.dashboard_id = $1
+				SELECT dw.metric_id
+				FROM dashboard_widgets dw
+				JOIN metrics m ON m.metric_id = dw.metric_id AND m.deleted_at IS NULL
+				WHERE dw.dashboard_id = $1
 			) AND ms.deleted_at IS NULL
 			GROUP BY ms.metric_id
 		)
```

**File**: `backend/pkg/analytics/dashboards/model.go` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ import (
 type Dashboard struct {
 	DashboardID int              `json:"dashboardId"`
 	ProjectID   int              `json:"projectId"`
-	UserID      int              `json:"userId,omitempty"`
+	UserID      int              `json:"-"`
 	Name        string           `json:"name"`
 	Description string           `json:"description"`
 	IsPublic    bool             `json:"isPublic"`
```

---

### Incident Patch 9: `36329876` (2026-09-23)
**Commit Message**: tracker: review unit tests suite, fix minor bugs in version routing, privacy settings, unsafe calls, add untainted dom exports, bump idSeq max id 2^22 -> 2^23, update changelogs

**File**: `tracker/tracker/CHANGELOG.md` (modified, +41/-0)
```diff
@@ -1,3 +1,44 @@
+## 19.0.0
+
+- click rage, dead click, CPU and memory issue detection moved from the backend into the tracker worker; detected issues are sent as issue messages with correct message indexes (#4861)
+- full type definitions for every entry point (`@openreplay/tracker`, `/class`, `/cjs`), checked on publish with `attw`
+- handle the root `<html>` element being replaced during recording (re-announces the document instead of losing the tree)
+- pages that override core DOM getters (Prototype.js, MooTools, some polyfills) no longer corrupt recording: the tracker reads native `parentNode`/`previousSibling`/`nextSibling`/`firstChild` from a pristine iframe, only when the page's getters are patched
+- standalone privacy/consent module (`modules/privacy`, not wired in yet): GPC/DNT, Google Consent Mode, cookieless storage, SHA-256 user id; integration plan in `PRIVACY_MODULE.md`
+- `data-openreplay-unmask` in `privateMode` now works on regular elements and applies to the whole subtree, including shadow roots of an unmasked host (before, it was overridden by the parent's default masking)
+- `privateMode` no longer downgrades hidden elements to obscured: `data-openreplay-hidden`, `htmlmasked` and `domSanitizer` → Hidden are respected
+- referrer is passed through `urls.urlSanitizer` (default one masks `token`, `jwt`, `password` …) in the start request and in page location messages; wiped in `privateMode`. Before, e.g. `?token=abc` in the referrer was sent as is, and after an SPA navigation the previous raw URL became the next referrer
+- messages recorded before the server confirms the session are no longer dropped when the protocol version is applied
+- the first (visual) batch never exceeds `beaconSizeLimit`; when it would, player and asset parts go out as separate batches
+- at most one batch in flight after unload flush started; a 401 no longer re-sends the queue with the rejected token; a retry firing after `clean()` no longer loops forever
+- errors in deferred commits are caught and handled like immediate ones (stop + restart) instead of surfacing as uncaught page errors
+- shadow root observers are disconnected on stop and when their host is removed or re-observed (previously leaked after restarts, cold start, Assist, bfcache)
+- node maintainer (detached node cleanup) only runs while recording
+- string dictionary is capped (LRU, 100k entries / 20M chars) so long sessions don't grow tracker memory without bound; keys stay unique even with >10k new strings in one millisecond
+- crossdomain iframes: 8,388,608 node ids per frame (was 4,194,304); a frame that runs out of ids stops itself instead of corrupting a sibling frame's tree — the top page is not affected
+- fixed invalid UTF-8 for lone surrogates in the fallback text encoder
+- visited URL conditions match against the pathname: `is /checkout` matches `https://site.com/checkout?step=2`; `is`/`isNot` are now exact matches (were substring), numbers compare numerically; a `=` status-code condition no longer throws during cold start
+- tag selectors like `#id.class`, `[data-x='v']`, `[data-x=v]`, chained attributes, and several tags sharing the same id/class now match
+- session reset between tabs works again (the broadcast was filtered out by other tabs)
+- `session.reset()` clears the in-memory token; `getSessionHash()` returns undefined instead of `"1&null"` without a token
+- fonts: descriptors (weight, style …) are recorded again; creating a `FontFace` inside a not-yet-tracked iframe no longer throws in page code
+- FPS no longer stuck at 0 when `requestAnimationFrame` runs synchronously
+- console: correct level when console methods are wrapped by other tools (Sentry etc.); objects keep 10 keys (was 9)
+- JS errors: message no longer cut at the second colon (`TypeError: a: b`)
+- page load timings not reached yet are sent as 0 instead of a large negative number
+- input labels are limited to 100 chars on every path
+- `generateRandomId` fallback (no `crypt
```

**File**: `tracker/tracker/src/main/app/index.ts` (modified, +50/-10)
```diff
@@ -36,7 +36,9 @@ import { MASK_ORDER } from './nodes/idSeq.js'
 import type { Options as ObserverOptions } from './observer/top_observer.js'
 import Observer, { InlineCssMode } from './observer/top_observer.js'
 import type { Options as SanitizerOptions } from './sanitizer.js'
-import Sanitizer, { SanitizeLevel } from './sanitizer.js'
+import Sanitizer, { SanitizeLevel, stringWiper } from './sanitizer.js'
+import { defaultUrlSanitizer } from '../modules/viewport.js'
+import type { Options as ViewportOptions } from '../modules/viewport.js'
 import type { Options as SessOptions } from './session.js'
 import Session from './session.js'
 import Ticker from './ticker.js'
@@ -124,6 +126,7 @@ enum ActivityState {
 
 type AppOptions = {
   revID: string
+  urls?: Partial<ViewportOptions>
   node_id: string
   session_reset_key: string
   session_token_key: string
@@ -366,6 +369,7 @@ export default class App {
       node_id: this.options.node_id,
       forceNgOff: Boolean(options.forceNgOff),
       maintainer: this.options.nodes?.maintainer,
+      onIdSpaceExhausted: this.ignoreThisFrame,
     })
     this.observer = new Observer({ app: this, options })
     this.ticker = new Ticker(this)
@@ -407,7 +411,7 @@ export default class App {
        * */
       window.addEventListener('message', this.parentCrossDomainFrameListener)
       window.addEventListener('message', this.crossDomainIframeListener)
-      setInterval(() => {
+      this.childPollingInterval = setInterval(() => {
         window.parent.postMessage(
           {
             line: proto.polling,
@@ -479,6 +483,9 @@ export default class App {
         }
         if (ev.data.line === proto.reset) {
           const newToken = ev.data.token
+          if (!newToken || newToken === this.session.getSessionToken(this.projectKey)) {
+            return
+          }
           this.debug.log('Received reset signal from another tab')
           this.session.setSessionToken(newToken, this.projectKey)
           this.restart()
@@ -489,6 +496,20 @@ export default class App {
 
   /** used by child iframes for crossdomain only */
   parentActive = false
+  /** child iframe that ran out of its node id block: silent for the rest of its lifetime */
+  private frameIgnored = false
+  private childPollingInterval: ReturnType<typeof setInterval> | null = null
+  private ignoreThisFrame = () => {
+    if (this.frameIgnored) return
+    this.frameIgnored = true
+    this.debug.error('OpenReplay: crossdomain iframe exhausted its node id space, ignoring it')
+    if (this.childPollingInterval) {
+      clearInterval(this.childPollingInterval)
+      this.childPollingInterval = null
+    }
+    // deferred: we are inside a commit that is still walking nodes
+    setTimeout(() => this.stop(false))
+  }
   checkStatus = () => {
     return this.parentActive
   }
@@ -557,6 +578,9 @@ export default class App {
     ) {
       this.lastParentMsgAt = Date.now()
     }
+    if (this.frameIgnored) {
+      return
+    }
     if (data.line === proto.startIframe) {
       // Avoid corrupting an in-flight start; let it complete.
       if (this.activityState === ActivityState.Starting) return
@@ -1250,10 +1274,20 @@ export default class App {
     this.debug.error('OpenReplay error: ', context, e)
   }
 
+  private sanitizeReferrer(referrer: string): string {
+    if (!referrer) return ''
+    if (this.sanitizer.privateMode) return stringWiper(referrer)
+    return (this.options.urls?.urlSanitizer ?? defaultUrlSanitizer)(referrer)
+  }
+
   send = (message: Message, urgent = false): void => {
     if (this.activityState === ActivityState.NotActive) {
       return
     }
+    // ids past the frame's block would corrupt a sibling frame in replay
+    if (this.frameIgnored) {
+      return
+    }
     // ====================================================
     if (this.activityState === ActivityState.ColdStart) {
       this.bufferedMessages1.push(message)
@@ -1332,16 +1366,20 @@ export default class A
```

**File**: `tracker/tracker/src/main/app/nodes/idSeq.ts` (modified, +3/-2)
```diff
@@ -1,8 +1,9 @@
-// 4 levels, 128 frames between each level, 8_388_608 nodes per page
+// 4 levels, 128 frames between each level, 8_388_608 node ids per frame (uses all 32 bits)
+// (top context is level 0 / order 0 and never collides: children start at level 1)
 // lets hope no one will need more :D
 export const BITS_LEVEL = 2 // 4
 export const BITS_ORDER = 7 // 128
-export const BITS_NODE  = 22 // 8_388_608
+export const BITS_NODE  = 23 // 8_388_608
 
 export const SHIFT_ORDER = BITS_NODE
 export const SHIFT_LEVEL = BITS_NODE + BITS_ORDER
```

**File**: `tracker/tracker/src/main/app/nodes/index.ts` (modified, +24/-2)
```diff
@@ -1,6 +1,6 @@
 import { createEventListener, deleteEventListener } from '../../utils.js'
 import Maintainer, { MaintainerOptions } from './maintainer.js'
-import { pack } from './idSeq.js'
+import { pack, MASK_NODE } from './idSeq.js'
 
 type NodeCallback = (node: Node, isStart: boolean) => void
 type ElementListener = [string, EventListener, boolean]
@@ -9,6 +9,8 @@ export interface NodesOptions {
   node_id: string
   forceNgOff: boolean
   maintainer?: Partial<MaintainerOptions>
+  /** called once when a crossdomain frame runs out of its node id block */
+  onIdSpaceExhausted?: () => void
 }
 
 export default class Nodes {
@@ -20,18 +22,26 @@ export default class Nodes {
   private readonly node_id: string
   private readonly forceNgOff: boolean
   private readonly maintainer: Maintainer
+  private maintainerRunning = false
+  // last id of this frame's packed block; ids past it would land in another frame's block
+  private idLimit = Infinity
+  private idSpaceExhausted = false
+  private readonly onIdSpaceExhausted?: () => void
 
   constructor(params: NodesOptions) {
     this.node_id = params.node_id
     this.forceNgOff = params.forceNgOff
     this.maintainer = new Maintainer(this.nodes, this.unregisterNode, params.maintainer)
-    this.maintainer.start()
+    this.onIdSpaceExhausted = params.onIdSpaceExhausted
   }
 
   crossdomainMode(level: number, frameOrder: number) {
     this.nextNodeId = this.createFrameId(level, frameOrder)
+    this.idLimit = this.nextNodeId + MASK_NODE
+    this.idSpaceExhausted = false
   }
 
+
   // Attached once per Tracker instance
   attachNodeCallback = (nodeCallback: NodeCallback): number => {
     return this.nodeCallbacks.push(nodeCallback)
@@ -69,7 +79,15 @@ export default class Nodes {
     const isNew = existing === undefined || this.nodes.get(existing) !== node
     let id: number = existing as number
     if (isNew) {
+      if (!this.maintainerRunning) {
+        this.maintainerRunning = true
+        this.maintainer.start()
+      }
       id = this.nextNodeId
+      if (id > this.idLimit && !this.idSpaceExhausted) {
+        this.idSpaceExhausted = true
+        this.onIdSpaceExhausted?.()
+      }
       this.totalNodeAmount++
       this.nextNodeId++
       this.nodes.set(id, node)
@@ -132,13 +150,17 @@ export default class Nodes {
   }
 
   clear(): void {
+    this.maintainer.stop()
+    this.maintainerRunning = false
     for (const [_, node] of this.nodes) {
       if (node) {
         this.unregisterNode(node)
       }
     }
 
     this.nextNodeId = 0
+    this.idLimit = Infinity
+    this.idSpaceExhausted = false
     this.nodes.clear()
   }
 }
```

**File**: `tracker/tracker/src/main/app/observer/observer.ts` (modified, +7/-6)
```diff
@@ -29,6 +29,7 @@ import {
 import { inlineRemoteCss } from './cssInliner.js'
 import { nextID } from '../../modules/constructedStyleSheets.js'
 import { SanitizeLevel } from '../sanitizer.js'
+import { parentNode, previousSibling, nextSibling, firstChild } from '../untaintedDom.js'
 
 const iconCache = {}
 const svgUrlCache = {}
@@ -610,7 +611,7 @@ export default abstract class Observer {
     }
     let slot = (node as any).assignedSlot as HTMLSlotElement | null
 
-    const parent = node.parentNode
+    const parent = parentNode(node)
     let parentID: number | undefined
 
     // Disable parent check for the upper context HTMLHtmlElement, because it is root there... (before)
@@ -637,15 +638,15 @@ export default abstract class Observer {
       }
     }
     // From here parentID === undefined if node is top context HTML node
-    let sibling = node.previousSibling
+    let sibling = previousSibling(node)
     while (sibling !== null) {
       const siblingID = this.app.nodes.getID(sibling)
       if (siblingID !== undefined) {
         this.commitNode(siblingID)
         this.indexes[id] = this.indexes[siblingID] + 1
         break
       }
-      sibling = sibling.previousSibling
+      sibling = previousSibling(sibling)
     }
     if (sibling === null) {
       this.indexes[id] = 0
@@ -782,7 +783,7 @@ export default abstract class Observer {
     if (!isObservable(root)) {
       return
     }
-    const parent = root.parentNode
+    const parent = parentNode(root)
     const parentId = parent !== null ? this.app.nodes.getID(parent) : undefined
     const parentLevel =
       parentId !== undefined ? this.app.sanitizer.getLevel(parentId) : SanitizeLevel.Plain
@@ -817,7 +818,7 @@ export default abstract class Observer {
       this.app.sanitizer.setLevel(id, newLevel)
       this.reemitNode(id, node)
     }
-    for (let child = node.firstChild; child !== null; child = child.nextSibling) {
+    for (let child = firstChild(node); child !== null; child = nextSibling(child)) {
       this.resanitizeNode(child, newLevel)
     }
   }
@@ -866,7 +867,7 @@ export default abstract class Observer {
 
   private reemitNode(id: number, node: Node): void {
     if (isTextNode(node)) {
-      const parent = node.parentNode
+      const parent = parentNode(node)
       if (parent !== null && isElementNode(parent)) {
         // re-runs sanitize() at the level we just set
         this.sendNodeData(id, parent, node.data)
```

---

### Incident Patch 10: `8c4631fe` (2026-09-23)
**Commit Message**: fix(events): keep CreatedAt out of the JSON response

**File**: `backend/pkg/events/events.go` (modified, +7/-7)
```diff
@@ -20,7 +20,7 @@ type errorEvent struct {
 	Source    string    `ch:"source" json:"source"`
 	Name      string    `ch:"name" json:"name"`
 	Message   string    `ch:"message" json:"message"`
-	CreatedAt time.Time `ch:"created_at"`
+	CreatedAt time.Time `ch:"created_at" json:"-"`
 	Timestamp int64     `json:"timestamp"`
 }
 
@@ -77,7 +77,7 @@ type event struct {
 	Value          *string   `ch:"value"`
 	InputDuration  *string   `ch:"input_duration"`
 	WebVitals      *string   `ch:"web_vitals"`
-	CreatedAt      time.Time `ch:"created_at"`
+	CreatedAt      time.Time `ch:"created_at" json:"-"`
 }
 
 type ClickEvent struct {
@@ -277,7 +277,7 @@ type customEvent struct {
 	Type                   string     `ch:"type" json:"type"`
 	AutoCapturedProperties chcol.JSON `ch:"auto_props" json:"autoCapturedProperties"`
 	Properties             chcol.JSON `ch:"properties" json:"properties"`
-	CreatedAt              time.Time  `ch:"created_at"`
+	CreatedAt              time.Time  `ch:"created_at" json:"-"`
 }
 
 func (e *eventsImpl) GetCustomsBySessionID(projectID uint32, sessID uint64, lower, upper time.Time) ([]interface{}, error) {
@@ -341,7 +341,7 @@ type issueEvent struct {
 	ID        string    `ch:"issue_id" json:"issueId"`
 	Type      string    `ch:"issue_type" json:"type"`
 	Context   string    `ch:"context_string" json:"contextString"`
-	CreatedAt time.Time `ch:"created_at"`
+	CreatedAt time.Time `ch:"created_at" json:"-"`
 	Timestamp int64     `json:"timestamp"`
 }
 
@@ -372,7 +372,7 @@ type issue struct {
 	Type      string    `ch:"issue_type"`
 	Context   string    `ch:"context_string"`
 	Payload   string    `ch:"payload_string"`
-	CreatedAt time.Time `ch:"created_at"`
+	CreatedAt time.Time `ch:"created_at" json:"-"`
 }
 
 func (i *issue) CountFromPayload() int {
@@ -403,7 +403,7 @@ type incidentEvent struct {
 
 type issueEventRow struct {
 	EventID       string    `ch:"event_id"`
-	CreatedAt     time.Time `ch:"created_at"`
+	CreatedAt     time.Time `ch:"created_at" json:"-"`
 	IssueID       string    `ch:"issue_id"`
 	IssueType     string    `ch:"issue_type"`
 	ContextString string    `ch:"context_string"`
@@ -503,7 +503,7 @@ type mobileEvent struct {
 	Name         string    `ch:"name" json:"name"`
 	AutoCaptures string    `ch:"auto_captures" json:"autoCaptures"`
 	Properties   string    `ch:"properties" json:"properties"`
-	CreatedAt    time.Time `ch:"created_at"`
+	CreatedAt    time.Time `ch:"created_at" json:"-"`
 	Timestamp    int64     `ch:"timestamp" json:"timestamp"`
 }
 
```

#### Recent Merged Pull Requests:
- **PR #4949** (2026-09-30): Updated patch build from main c94fe7970b22cb34eac146b202444d8180c58952 (@estradino)
- **PR #4948** (2026-09-30): Patch api v1.28.0 (@tahayk)
- **PR #4944** (2026-09-29): Updated patch build from main 3db9704a7edcb13666166956cdb0bd6b013e9eb1 (@estradino)
- **PR #4943** (2026-09-29): ui: move mcp auth page to general codespace (@nick-delirium)
- **PR #4942** (2026-09-29): fix(tracker): keep the first value when squashing set_property_once (@sarmah-rup)
- **PR #4939** (2026-09-28): Updated patch build from main 7fdbeb502f933c46d4ebc95ebc9cc79577edd696 (@estradino)
- **PR #4938** (2026-09-28): ui: update env tracker v (@nick-delirium)
- **PR #4937** (2026-09-28): Added a session token on assist connect (@zavorotynskiy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
