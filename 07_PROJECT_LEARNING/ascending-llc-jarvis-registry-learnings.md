# Forensic Learning Record (Deep Inspection): ascending-llc/jarvis-registry

> **Canonical Artifact**: `07_PROJECT_LEARNING/ascending-llc-jarvis-registry-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ascending-llc/jarvis-registry](https://github.com/ascending-llc/jarvis-registry))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-29T21:27:35.272Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ascending-llc/jarvis-registry`
- **Description**: Connect any AI copilot or autonomous agent to your enterprise tools — through a single, secure MCP/Agent gateway with built-in identity, access control, and full observability.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3223 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `auth-server/cognito_utils.py`
```
"""
Cognito utilities for token generation and AWS Cognito operations.
"""

import logging

import httpx

logger = logging.getLogger(__name__)


async def generate_token(
    client_id: str, client_secret: str, user_pool_id: str, region: str, scopes: list[str] = None, domain: str = None
) -> dict:
    """
    Generate a token using the client credentials flow

    Args:
        client_id: Cognito App Client ID
        client_secret: Cognito App Client Secret
        user_pool_id: Cognito User Pool ID
        region: AWS region
        scopes: List of scopes to request (optional)
        domain: Optional custom domain name (e.g., 'mcp-gateway')

    Returns:
        Dict containing access token and metadata
    """
    try:
        # Construct the Cognito domain
        if domain:
            # Use custom domain if provided
            cognito_domain = f"https://{domain}.auth.{region}.amazoncognito.com"
        else:
            # Otherwise use user pool ID without underscores (standard format)
            user_pool_id_wo_underscore = user_pool_id.replace("_", "")
            cognito_domain = f"https://{user_pool_id_wo_underscore}.auth.{region}.amazoncognito.com"

        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        data = {"grant_type": "client_credentials", "client_id": client_id, "client_secret": client_secret}

        if scopes:
            data["scope"] = " ".join(scopes)

        token_url = f"{cognito_domain}/oauth2/token"

        logger.info(f"Requesting token from {token_url}")
        async with httpx.AsyncClient() as client:
            response = await client.post(token_url, headers=headers, data=data, timeout=10)
            response.raise_for_status()
            token_data = response.json()

        logger.info("Successfully obtained client credentials token")
        return token_data

    except Exception as e:
        logger.error(f"Failed to get client credentials token: {e}")
        raise ValueError(f"Cannot obtain token: {e}")

```

### Core Architecture Module: `auth-server/src/auth_server/container.py`
```
from functools import cache, cached_property

from itsdangerous import URLSafeTimedSerializer
from redis import Redis

from registry_pkgs.core.consent_store import ConsentStore, PendingConsentStore
from registry_pkgs.core.oauth_state_store import OAuthStateStore
from registry_pkgs.google.cloud_identity_client import CloudIdentityGroupsClient

from .core.config import AuthSettings
from .core.types import AllowedProvider
from .providers.factory import get_auth_provider
from .services.client_registration_service import ClientRegistrationService
from .services.downstream_token_service import DownstreamTokenCheckService
from .services.server_service import ServerService
from .services.token_grant_service import TokenGrantService
from .services.user_service import UserService
from .utils.config_loader import AuthProviderConfig, EntraConfig, OAuth2Config, OAuth2ConfigLoader


class AuthContainer:
    """App-scoped dependencies for the auth server."""

    def __init__(self, settings: AuthSettings, *, redis_client: Redis):
        self._settings = settings
        self.redis_client = redis_client
        # Eagerly load OAuth2 config so app can fail early and loudly on start-up if config file is off.
        self._config_loader = OAuth2ConfigLoader(self._settings)
        self._oauth2_config = self._config_loader.get_config()

    @property
    def oauth2_config(self) -> OAuth2Config:
        return self._oauth2_config

    @cached_property
    def server_service(self) -> ServerService:
        return ServerService()

    @cached_property
    def user_service(self) -> UserService:
        return UserService()

    @cached_property
    def downstream_token_check(self) -> DownstreamTokenCheckService:
        return DownstreamTokenCheckService()

    @cached_property
    def signer(self) -> URLSafeTimedSerializer:
        return URLSafeTimedSerializer(self._settings.secret_key)

    @cached_property
    def oauth_state_store(self) -> OAuthStateStore:
        return OAuthStateStore(
            redis_client=self.redis_client,
            key_prefix=self._settings.auth_server_redis_key_prefix,
            client_secret_hash_key=self._settings.secret_key,
        )

    @cached_property
    def consent_store(self) -> ConsentStore:
        return ConsentStore(redis_client=self.redis_client, key_prefix=self._settings.auth_server_redis_key_prefix)

    @cached_property
    def pending_consent_store(self) -> PendingConsentStore:
        return PendingConsentStore(
          
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #599** (2026-09-25): **Chore: update post-merge git hooks**
  *Symptoms*: 

- **Issue #596** (2026-09-25): **Feature/as 1868**
  *Symptoms*: 

- **Issue #595** (2026-09-24): **docs: add changelog for asc0.5.11**
  *Symptoms*: Automated changelog update for [asc0.5.11](https://github.com/ascending-llc/jarvis-registry/releases/tag/asc0.5.11).  Generated by the Release Changelog workflow. Review and approve to publish the changelog page. 

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

### Incident Patch 1: `eb7cf6b4` (2026-09-24)
**Commit Message**: Fix: various GitHub skill sync minor problems (#594)

* docs: document GitHub App installation and repo access for skill sync

Expand the GitHub App prerequisites with org-level installation, repository
selection, permission-update approval, and the intersection of installation
and user access, plus the misleading 404 github_not_found symptom when the
installation does not cover a private repository. Also correct the Callback
URL to be derived from REGISTRY_URL, including any base path.

* feat(registry): reject synced skills whose name does not match their folder

The Agent Skills spec requir

**File**: `docs/design/skill-sync-source-api.md` (modified, +25/-9)
```diff
@@ -61,7 +61,7 @@
 - `owner` (required, string): GitHub owner (user or org), 1–39 characters, alphanumeric + hyphens, regex: `^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$`
 - `repo` (required, string): GitHub repository name, 1–100 characters, regex: `^[A-Za-z0-9._-]+$`
 - `ref` (optional, string): Git ref to sync from (default: `"main"`), 1–255 characters, validated against path traversal
-- `paths` (required, array of strings, min 1): Repository-relative POSIX paths to scan for skills. Must be safe relative paths (no leading `/`, no `..`, no `\`). Each path is a **container**: only its direct child folders holding a `SKILL.md` become skills — the path itself is never a skill, so a `SKILL.md` at the path root is skipped. Use `["."]` to scan the repository root.
+- `paths` (required, array of strings, min 1): Repository-relative POSIX paths to scan for skills. Must be safe relative paths (no leading `/`, no `..`, no `\`). Each path is a **container**: only its direct child folders holding a `SKILL.md` become skills — the path itself is never a skill, so a `SKILL.md` at the path root is skipped. Use `["."]` to scan the repository root. Per the [Agent Skills spec](https://agentskills.io/specification), each skill's frontmatter `name` must exactly match its folder name; a mismatched skill fails discovery with `skill_name_mismatch`.
 - `githubAppClientId` (required, string): GitHub App OAuth client ID
 - `githubAppClientSecret` (required, string): GitHub App client secret (enc
```

**File**: `docs/design/skills-sync-api.md` (modified, +0/-2)
```diff
@@ -96,7 +96,6 @@ Accept: application/json
       "description": "Convert Mongoose schemas to Beanie models",
       "category": "development",
       "tags": ["python", "mongodb"],
-      "path": "mongoose-to-beanie",
       "version": 3,
       "fileCount": 0,
       "alwaysApply": false,
@@ -130,7 +129,6 @@ Accept: application/json
 | `skills[].description` | string | Skill description |
 | `skills[].category` | string | Skill category |
 | `skills[].tags` | string[] | Tags |
-| `skills[].path` | string | Local directory name; falls back to `name` |
 | `skills[].version` | integer | Increments on each update |
 | `skills[].fileCount` | integer | Number of supporting files |
 | `skills[].alwaysApply` | boolean | Whether the skill is always applied |
```

**File**: `frontend/src/pages/FederationRegistryOrEdit/GithubLastSyncDetails.test.tsx` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+// @vitest-environment jsdom
+import { cleanup, render, screen } from '@testing-library/react';
+import { afterEach, describe, expect, test } from 'vitest';
+
+import type { SkillSyncJob } from '@/services/skillSyncSource/type';
+
+import GithubLastSyncDetails from './GithubLastSyncDetails';
+
+// Mirrors a real partial_success job from the Registry API (GET /skill-sync-sources/{id}/jobs/{jobId}).
+const makeJob = (overrides: Partial<SkillSyncJob> = {}): SkillSyncJob => ({
+  id: 'job-1',
+  sourceId: 'source-1',
+  jobType: 'full_sync',
+  triggerType: 'manual',
+  status: 'partial_success',
+  phase: 'completed',
+  requestSnapshot: { owner: 'anthropics', repo: 'skills', ref: 'main', paths: ['skills'], configRevision: 2 },
+  discoverySummary: { discoveredSkillCount: 18, discoveredFileCount: 343, skippedPaths: [] },
+  applySummary: {
+    skillsCreated: 0,
+    skillsUpdated: 18,
+    skillsDeleted: 0,
+    skillsFailed: 0,
+    filesCreated: 0,
+    filesUpdated: 325,
+    filesDeleted: 0,
+  },
+  skillErrors: [
+    {
+      skillPath: 'skills/claude-api',
+      upstreamId: 'skills/claude-api',
+      errorCode: 'skill_parse_failed',
+      errorMessage: "SKILL.md frontmatter validation failed: [{'type': 'string_too_long', 'loc': ('description',)}]",
+      phase: 'discovery',
+    },
+  ],
+  errorCode: null,
+  error: null,
+  startedAt: '2026-09-24T13:58:33.652Z',
+  finishedAt: '2026-09-24T13:58:35.429Z',
+  createdAt: '2026-09-24T13:58:33.083Z',

```

---

### Incident Patch 2: `885c2f7b` (2026-09-24)
**Commit Message**: fix(registry): build skill sync OAuth redirect_uri from REGISTRY_URL (#593)

request.url_for reflects the proxy-internal request, so behind a
TLS-terminating proxy the GitHub OAuth redirect_uri was sent as http://
instead of https://. Build it from settings.registry_url plus the
callback route path instead, shared by the initiate and callback
endpoints so both send an identical value.

**File**: `registry/src/registry/api/v1/skill_sync/skill_sync_source_routes.py` (modified, +15/-3)
```diff
@@ -55,6 +55,8 @@
 
 router = APIRouter(prefix="/skill-sync-sources", tags=["skill-sync-sources"])
 
+_OAUTH_CALLBACK_ROUTE_NAME = "skill_sync_oauth_callback"
+
 
 def _to_job_response(job: SkillSyncJob) -> SkillSyncJobResponse:
     return SkillSyncJobResponse(
@@ -136,6 +138,16 @@ async def _to_detail_response(
     )
 
 
+def _skill_sync_oauth_callback_url(request: Request) -> str:
+    """Build the public GitHub OAuth callback URL for skill sync.
+
+    Uses ``settings.registry_url`` (public scheme, host and root path) instead of ``request.url_for``,
+    which reflects the proxy-internal request and yields ``http://`` behind a TLS-terminating proxy.
+    """
+    callback_path = request.app.url_path_for(_OAUTH_CALLBACK_ROUTE_NAME)
+    return f"{settings.registry_url}{callback_path}"
+
+
 async def _required_source(source_id: str, source_service: SkillSyncSourceCrudService) -> SkillSyncSource:
     source = await source_service.get_source(source_id)
     if source is None:
@@ -466,7 +478,7 @@ async def initiate_skill_sync_oauth(
             resource_id=source.id,
             required_permission="EDIT",
         )
-        redirect_uri = str(request.url_for("skill_sync_oauth_callback"))
+        redirect_uri = _skill_sync_oauth_callback_url(request)
         authorization_url = oauth_service.create_authorization_url(
             source=source,
             user_id=str(user_context["user_id"]),
@@ -483,7 +495,7 @@ async def initiate_skill_sync_oauth(
         ) from exc
```

**File**: `registry/tests/integration/test_skill_sync_source_routes.py` (modified, +61/-0)
```diff
@@ -9,6 +9,7 @@
 
 from registry.api.v1.skill_sync.skill_sync_source_routes import router
 from registry.auth.dependencies import get_current_user
+from registry.core.config import settings
 from registry.deps import (
     get_acl_service,
     get_skill_sync_job_service,
@@ -336,6 +337,66 @@ def test_oauth_initiate_redirects_to_github(skill_sync_route_context) -> None:
     _assert_permission_checked(ctx, "EDIT")
 
 
+_PUBLIC_REGISTRY_URL = "https://jarvis.example.com/gateway"
+_EXPECTED_CALLBACK_URL = f"{_PUBLIC_REGISTRY_URL}/skill-sync-sources/oauth/callback"
+
+
+@pytest.fixture
+def proxied_client(skill_sync_route_context, monkeypatch):
+    """Client that mimics the deployed hop: plain http from a TLS-terminating proxy, under a root path."""
+    monkeypatch.setattr(settings, "registry_url", _PUBLIC_REGISTRY_URL)
+    with TestClient(
+        skill_sync_route_context.client.app,
+        base_url="http://registry-internal:7860",
+        root_path="/gateway",
+    ) as client:
+        yield client
+
+
+def test_oauth_initiate_uses_public_registry_url_for_redirect_uri(skill_sync_route_context, proxied_client) -> None:
+    ctx = skill_sync_route_context
+    response = proxied_client.get(
+        f"/gateway/skill-sync-sources/{ctx.source.id}/oauth/initiate",
+        follow_redirects=False,
+    )
+    assert response.status_code == 307
+    assert ctx.oauth_service.create_authorization_url.call_args.kwargs["redirect_uri"] == _EXPECTED_CALLBACK_URL
+
+
+def test_oaut
```

---

### Incident Patch 3: `b5956359` (2026-09-22)
**Commit Message**: fix: `seed_access_roles_standalone.py` script also seeds (#586)

- `mcpServer` and `remoteAgent` access roles.

**File**: `scripts/seed_access_roles_standalone.py` (modified, +73/-4)
```diff
@@ -4,8 +4,14 @@
 This script directly operates on MongoDB collections without using Beanie ORM
 to completely avoid any model imports that might trigger A2AAgent initialization.
 
-Jarvis Chat initializes base roles (agent, mcpServer, promptGroup, etc).
-Jarvis Registry seeds federation, workflow, and skill roles.
+Registry seeds federation, workflow, skill, skillSyncSource, mcpServer, and
+remoteAgent roles.
+
+Jarvis Chat predates Registry and owns seeding mcpServer roles in deployments
+where it shares a MongoDB with Registry. This script also seeds mcpServer here,
+using the same accessRoleId/name/description/permBits values Chat already
+creates there, so the upsert below is a no-op in a shared deployment — it only
+fills the gap for a Registry-only deployment with no Chat present.
 
 Usage:
     python scripts/seed_access_roles_standalone.py
@@ -26,9 +32,12 @@ async def seed_access_roles(collection, session):
     Uses direct MongoDB operations instead of Beanie ORM to avoid
     triggering A2AAgent model initialization.
     """
-    print("=== Seeding Federation, Workflow, Skill & Skill Sync Source AccessRoles ===\n")
+    print("=== Seeding Federation, Workflow, Skill, Skill Sync Source, MCP Server & Remote Agent AccessRoles ===\n")
 
-    # Chat handles its own resource types. Registry owns these additional role catalogs.
+    # Chat owns its own resource types (agent, promptGroup) plus mcpServer (see module
+    # docstring). Registry owns federation, workflow, sk
```

---

### Incident Patch 4: `8d74a153` (2026-09-21)
**Commit Message**: Fix/as 1813 v2 (#583)

* fix: halt workflows on terminal step failures across containers and resumes

* fix: prevent failed workflows from resuming after persistence errors

**File**: `registry-pkgs/src/registry_pkgs/workflows/agno_compat.py` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+"""Narrow compatibility fixes for the registry's agno 2.7.2 execution path."""
+
+from typing import Any
+
+from agno.run import RunContext
+from agno.run.workflow import WorkflowRunOutput
+from agno.session.workflow import WorkflowSession
+from agno.workflow import Router, Workflow
+from agno.workflow.types import WorkflowExecutionInput
+
+
+class RegistryWorkflow(Workflow):
+    """Honor stop signals after manual routing in async, non-streaming runs.
+
+    Agno 2.7.2's special router-selection continuation skips its stop check.
+    Bind the user's choice to the selector instead, then reuse the ordinary
+    continuation path, including output review, stop handling and persistence.
+    Revisit this adapter when upgrading agno; the registry uses neither sync
+    nor streaming execution.
+    """
+
+    async def _acontinue_execute(
+        self,
+        session: WorkflowSession,
+        execution_input: WorkflowExecutionInput,
+        workflow_run_response: WorkflowRunOutput,
+        run_context: RunContext,
+        start_step_index: int,
+        background_tasks: Any = None,
+        **kwargs: Any,
+    ) -> WorkflowRunOutput:
+        router = None
+        original_selector = None
+        selection = kwargs.get("router_selection")
+        if selection and isinstance(self.steps, list) and start_step_index < len(self.steps):
+            step = self.steps[start_step_index]
+            if isinstance(step, Router):
+                step._prepare
```

**File**: `registry-pkgs/src/registry_pkgs/workflows/compiler.py` (modified, +2/-1)
```diff
@@ -26,6 +26,7 @@
     WorkflowNode,
     WorkflowRun,
 )
+from registry_pkgs.workflows.agno_compat import RegistryWorkflow
 from registry_pkgs.workflows.hitl.field_types import field_type_to_agno
 from registry_pkgs.workflows.media_snapshot import (
     media_from_snapshot,
@@ -427,7 +428,7 @@ def _build(node: WorkflowNode) -> Any:
     }
     if db is not None:
         workflow_kwargs["db"] = db
-    return Workflow(**workflow_kwargs)
+    return RegistryWorkflow(**workflow_kwargs)
 
 
 def step_kwargs(cfg: StepConfig | None) -> dict[str, Any]:
```

**File**: `registry-pkgs/src/registry_pkgs/workflows/control/wrapper.py` (modified, +8/-1)
```diff
@@ -20,10 +20,15 @@
    of each attempt, and the terminal outcome is written as soon as the final
    attempt finishes so later steps never leave a completed node looking active.
 
+5. **Workflow-level halting** — a terminal failure not tolerated by
+   ``on_error="skip"`` sets agno's ``StepOutput.stop`` signal. Containers
+   propagate the signal so no later sequential step starts; already-running
+   branches inside a ``Parallel`` are not cancelled.
+
 Node-level HITL (confirmation / user_input / output_review / iteration review)
 is handled by agno's native ``HumanReview`` configuration — agno's execution
 loop detects and pauses on its own, and we surface the pause via
-``WorkflowRunner._handle_run_output`` writing ``WorkflowRun.pending_requirements``.
+``WorkflowRunner._handle_run_output`` for runs without a terminal failure.
 This wrapper covers what agno does not: ad-hoc pause/resume, exponential-backoff
 retry, and per-attempt persistence.
 """
@@ -167,6 +172,8 @@ async def wrapped(step_input: StepInput, session_state: dict | None = None) -> S
 
             logger.warning("Node %r: all %d attempt(s) failed, last error: %s", node_name, max_attempts, result.error)
             await _record_attempt_result(run_id, node_id, node_name, step_config, result)
+            if not is_skip_tolerated_failure(result.success, step_config):
+                result.stop = True
             return result
 
         return StepOutput(content="", success=False, error="Max retries excee
```

---

### Incident Patch 5: `911d36c9` (2026-09-15)
**Commit Message**: fix: match the Step Objective resize handle to the theme color (#574)

**File**: `frontend/src/components/WorkflowCanvas/PropsPanel/StepObjectiveEditor.tsx` (modified, +2/-2)
```diff
@@ -75,7 +75,7 @@ export const StepObjectiveEditor: React.FC<StepObjectiveEditorProps> = ({ value,
         onChange={event => onChange(event.target.value)}
         disabled={disabled}
         spellCheck={false}
-        className='h-[144px] min-h-[96px] max-h-[320px] w-full resize-y overflow-auto rounded-md border border-[var(--jarvis-border)] bg-[var(--jarvis-card-muted)] px-2 py-2 font-mono text-xs leading-relaxed text-[var(--jarvis-text-strong)] outline-none focus:ring-2 focus:ring-[var(--jarvis-primary)] disabled:cursor-not-allowed disabled:opacity-60'
+        className='step-objective-textarea h-[144px] min-h-[96px] max-h-[320px] w-full resize-y overflow-auto rounded-md border border-[var(--jarvis-border)] bg-[var(--jarvis-card-muted)] px-2 py-2 font-mono text-xs leading-relaxed text-[var(--jarvis-text-strong)] outline-none focus:ring-2 focus:ring-[var(--jarvis-primary)] disabled:cursor-not-allowed disabled:opacity-60'
         placeholder={STEP_OBJECTIVE_PLACEHOLDER}
       />
 
@@ -146,7 +146,7 @@ export const StepObjectiveEditor: React.FC<StepObjectiveEditorProps> = ({ value,
                       disabled={disabled || isSaving}
                       spellCheck={false}
                       aria-label='Step objective Markdown source'
-                      className='h-[360px] min-h-[240px] max-h-[60vh] w-full resize-y overflow-auto rounded-lg border border-[var(--jarvis-border)] bg-[var(--jarvis-card-muted)] px-4 py-3 font-mono text-sm leading-relaxed text-[va
```

**File**: `frontend/src/components/WorkflowCanvas/index.css` (modified, +13/-0)
```diff
@@ -83,6 +83,19 @@
   margin: 12px !important;
 }
 
+/* Keep the Step Objective resize handle aligned with the active theme. */
+.step-objective-textarea::-webkit-resizer {
+  background-color: var(--jarvis-card-muted);
+  background-image: linear-gradient(
+    135deg,
+    transparent 0 48%,
+    var(--jarvis-primary) 48% 56%,
+    transparent 56% 68%,
+    var(--jarvis-primary) 68% 76%,
+    transparent 76%
+  );
+}
+
 /* Shared live-status animation for canvas nodes and run history. */
 @keyframes workflow-status-spin {
   from {
```

#### Recent Merged Pull Requests:
- **PR #599** (2026-09-25): Chore: update post-merge git hooks (@satoseino)
- **PR #596** (closed): Feature/as 1868 (@DYL521)
- **PR #595** (2026-09-24): docs: add changelog for asc0.5.11 (@github-actions[bot])
- **PR #594** (2026-09-24): Fix: various GitHub skill sync minor problems (@satoseino)
- **PR #593** (2026-09-24): Fix: build skill sync OAuth redirect_uri from REGISTRY_URL (@satoseino)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
