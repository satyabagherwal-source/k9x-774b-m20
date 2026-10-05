# Forensic Learning Record (Deep Inspection): ascending-llc/jarvis-registry

> **Canonical Artifact**: `07_PROJECT_LEARNING/ascending-llc-jarvis-registry-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ascending-llc/jarvis-registry](https://github.com/ascending-llc/jarvis-registry))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:43:04.079Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ascending-llc/jarvis-registry`
- **Description**: Connect any AI copilot or autonomous agent to your enterprise tools — through a single, secure MCP/Agent gateway with built-in identity, access control, and full observability.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3367 stars

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

### Core Architecture Module: `auth-server/src/auth_server/core/__init__.py`
```
"""Core configuration and settings for auth server."""

```

### Core Architecture Module: `auth-server/src/auth_server/core/config.py`
```
"""
Auth Server Configuration

Centralized configuration management using Pydantic Settings.
All environment variables are loaded here and accessed through the global `settings` instance.
"""

from functools import cached_property
from typing import Any

from registry_pkgs.core.config import JarvisBaseSettings, RedisConfig


class AuthSettings(JarvisBaseSettings):
    """Auth server settings with environment variable support."""

    # ==================== Cookies ====================
    oauth2_temp_session_cookie_name: str = "oauth2_temp_session"
    oauth2_consent_nonce_cookie_name: str = "oauth2_consent_nonce"

    # ==================== Core Settings ====================
    # JWT Settings
    max_token_lifetime_hours: int = 24
    default_token_lifetime_hours: int = 8

    # Rate Limiting
    max_tokens_per_user_per_hour: int = 100

    # ==================== CORS Configuration ====================
    cors_origins: str = "*"  # Comma-separated list of allowed origins, or "*" for all

    # ==================== Keycloak Settings ====================
    keycloak_url: str | None = None
    keycloak_external_url: str | None = None
    keycloak_realm: str = "mcp-gateway"
    keycloak_client_id: str | None = None
    keycloak_client_secret: str | None = None
    keycloak_m2m_client_id: str | None = None
    keycloak_m2m_client_secret: str | None = None
    keycloak_enabled: str = "false"

    # ==================== Cognito Settings ====================
    cognito_user_pool_id: str | None = None
    cognito_client_id: str | None = None
    cognito_client_secret: str | None = None
    cognito_domain: str | None = None
    aws_region: str = "us-east-1"
    cognito_enabled: str = "false"

    # ==================== Entra ID Settings ====================
    # entra_tenant_id / entra_client_id / entra_client_secret are inherited from JarvisBaseSettings.
    entra_token_kind: str = "id"  # "id" or "access"
    entra_enabled: str = "true"

    # ==================== Google Settings ====================
    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_allowed_hd: str = ""
    google_enabled: str = "false"

    # Provider toggles (*_enabled) feed the ${..._ENABLED} substitution in oauth2_providers.yml.
    # Kept as strings so a blank env value (e.g. `ENTRA_ENABLED=`) is valid and falls back to the
    # YAML default; config_loader coerces the substituted value to a real bool. Only entra is on
    # by default — every other provider is opt-in.

    # ==================== Metrics Settings ====================
    metrics_service_url: str = "http://localhost:8890"
    metrics_api_key: str | None = None

    # ==================== OAuth Device Flow Settings ====================
    device_code_expiry_seconds: int = 900  # 15 minutes for real IdP login and possible MFA
    device_code_poll_interval: int = 5  # Poll every 5 seconds
    oauth_access_token_expiry_seconds: int = 3600

    # ==================== Redis ====================
    redis_uri: str = "redis://registry-redis:6379/1"

    @cached_property
    def redis_config(self) -> RedisConfig:
        return RedisConfig(redis_uri=self.redis_uri, redis_key_prefix=self.auth_server_redis_key_prefix)

    def model_post_init(self, __context: Any) -> None:
        super().model_post_init(__context)
        # Set keycloak_external_url to keycloak_url if not provided
        if self.keycloak_url and not self.keycloak_external_url:
            self.keycloak_external_url = self.keycloak_url


# Global settings instance
settings = AuthSettings()

```

### Core Architecture Module: `auth-server/src/auth_server/core/types.py`
```
from typing import Literal, TypedDict

AllowedProvider = Literal["keycloak", "cognito", "entra", "google"]


class AuthProviderConfig(TypedDict):
    display_name: str
    client_id: str
    client_secret: str
    auth_url: str
    token_url: str
    user_info_url: str
    logout_url: str
    scopes: list[str]
    response_type: str
    grant_type: str
    # Claims mapping for user info
    username_claim: str
    groups_claim: str
    email_claim: str
    name_claim: str
    enabled: bool


class EntraConfig(AuthProviderConfig):
    tenant_id: str
    jwks_url: str
    graph_url: str
    m2m_scope: str


class GoogleConfig(AuthProviderConfig):
    jwks_url: str
    allowed_hd: str


class SessionCookieConfig(TypedDict):
    max_age_seconds: int
    secure: bool  # Set to false for development
    httponly: bool
    samesite: str
    domain: str


class OAuth2Providers(TypedDict):
    keycloak: AuthProviderConfig
    cognito: AuthProviderConfig
    entra: EntraConfig
    google: GoogleConfig


class OAuth2Config(TypedDict):
    providers: OAuth2Providers

```

### Core Architecture Module: `auth-server/src/auth_server/utils/__init__.py`
```
from .config_loader import OAuth2ConfigLoader

__all__ = ["OAuth2ConfigLoader"]

```

### Core Architecture Module: `auth-server/src/auth_server/utils/config_loader.py`
```
import logging
import re
from pathlib import Path
from typing import Any

import yaml

from ..core.config import AuthSettings
from ..core.types import AllowedProvider, AuthProviderConfig, EntraConfig, OAuth2Config

logger = logging.getLogger(__name__)


class OAuth2ConfigLoader:
    """OAuth2 configuration loader with environment variable substitution."""

    def __init__(self, settings: AuthSettings):
        self._settings = settings
        # Eagerly load OAuth2 config so app can fail early and loudly on start-up if config file is off.
        self._config = self._load_config()

    def _load_config(self) -> OAuth2Config:
        """Load OAuth2 providers configuration from oauth2_providers.yml.

        Returns:
            Dict containing OAuth2 providers configuration with environment
            variables substituted.
        """
        try:
            oauth2_file = Path(__file__).parent.parent / "oauth2_providers.yml"
            logger.info(f"Loading OAuth2 configuration from: {oauth2_file}")

            with open(oauth2_file) as f:
                config = yaml.safe_load(f)

            # Substitute environment variables in configuration
            processed_config = self._substitute_env_vars(config)

            # Coerce every provider's `enabled` to a real bool: substitution turns bool
            # settings into the string "true"/"false", and the string "false" is truthy.
            for provider_cfg in processed_config.get("providers", {}).values():
                provider_cfg["enabled"] = str(provider_cfg.get("enabled", False)).strip().lower() == "true"

            # Log loaded providers
            providers = list(processed_config.get("providers", {}).keys())
            logger.info(f"Successfully loaded OAuth2 configuration with providers: {providers}")

            return processed_config
        except Exception:
            logger.exception("Failed to load OAuth2 configuration")

            raise

    def _get_value(self, var_name: str) -> str | None:
        field_name = var_name.strip().lower()

        value = getattr(self._settings, field_name, None)

        if value is None:
            return None
        if isinstance(value, bool):
            return str(value).lower()
        return str(value)

    def _substitute_env_vars(self, config: Any) -> Any:
        """Recursively substitute environment variables in configuration.

        Supports bash-style default values: ${VAR_NAME:-default_value}

        Args:
            config: Configuration value (dict, list, or str)

        Returns:
            Configuration with environment variables substituted
        """
        if isinstance(config, dict):
            return {k: self._substitute_env_vars(v) for k, v in config.items()}
        elif isinstance(config, list):
            return [self._substitute_env_vars(item) for item in config]
        elif isinstance(config, str) and "${" in config:
            # Handle special case for auto-derived Cognito domain
            if "COGNITO_DOMAIN:-auto" in config:
                cognito_domain = self._get_value("COGNITO_DOMAIN")
                if not cognito_domain:
                    user_pool_id = self._get_value("COGNITO_USER_POOL_ID") or ""
                    cognito_domain = self._auto_derive_cognito_domain(user_pool_id)
                config = config.replace("${COGNITO_DOMAIN:-auto}", cognito_domain)

            # Support bash-style default values: ${VAR_NAME:-default_value}
            def replace_var(match):
                var_expr = match.group(1)
                # Check if it has a default value
                if ":-" in var_expr:
                    var_name, default_value = var_expr.split(":-", 1)
                    return self._get_value(var_name) or default_value.strip()
                else:
                    var_name = var_expr.strip()
                    value = self._get_value(var_name)
                    if value is not None:
                        return value

                    logger.warning(f"Setting not found for oauth2 placeholder: {var_name}")
                    return match.group(0)  # Return original if not found

            return re.sub(r"\$\{([^}]+)\}", replace_var, config)
        else:
            return config

    def _auto_derive_cognito_domain(self, user_pool_id: str) -> str:
        """Auto-derive Cognito domain from User Pool ID.

        Example: us-east-1_KmP5A3La3 → us-east-1kmp5a3la3

        Args:
            user_pool_id: AWS Cognito User Pool ID

        Returns:
            Derived domain string
        """
        if not user_pool_id:
            return ""

        # Remove underscore and convert to lowercase
        domain = user_pool_id.replace("_", "").lower()
        logger.info(f"Auto-derived Cognito domain '{domain}' from user pool ID '{user_pool_id}'")
        return domain

    def get_config(self) -> OAuth2Config:
        """Get the loaded OAuth2 configuration."""

        return self._config

    def get_provider_config(
        self,
        provider: AllowedProvider,
    ) -> AuthProviderConfig | EntraConfig:
        """Get configuration for a specific provider."""

        return self.get_config()["providers"][provider]

```

### Core Architecture Module: `auth-server/src/auth_server/utils/otel_metrics.py`
```
"""
Metrics client for the Auth service.

This module exports a pre-configured metrics client for recording auth metrics.

Usage:
    from auth_server.utils.otel_metrics import metrics

    # Using generic client directly
    metrics.record_counter("custom_metric", 1, {"label": "value"})
"""

import logging

from registry_pkgs.telemetry.metrics_client import create_metrics_client, load_metrics_config

from ..core.config import settings

logger = logging.getLogger(__name__)


# Load configuration and create service-specific metrics client
_config = load_metrics_config("auth_server", settings.telemetry_config)
metrics = create_metrics_client("auth_server", config=_config)

```

### Core Architecture Module: `auth-server/src/auth_server/utils/security_mask.py`
```
import hashlib
import logging

logger = logging.getLogger(__name__)


def hash_username(username: str) -> str:
    """Hash username for privacy compliance."""
    if not username:
        return "anonymous"
    return f"user_{hashlib.sha256(username.encode()).hexdigest()[:8]}"


def mask_token(token: str) -> str:
    """Mask JWT token showing only last 4 characters."""
    if not token:
        return "***EMPTY***"
    if len(token) > 20:
        return f"...{token[-4:]}"
    return "***MASKED***"

```

### Core Architecture Module: `frontend/src/components/WorkflowCanvas/PropsPanel/Nodes/LoopNodeProperties.tsx`
```
import type { Node } from '@xyflow/react';
import type React from 'react';
import { useUpstreamSchema } from '../../hooks/useUpstreamSchema';
import type { LoopNodeData } from '../../types';
import { CELContextReference } from '../CELContextReference';
import { AddButton } from '../shared';
import { useWorkflowPanel } from '../WorkflowPanelContext';

interface Props {
  node: Node<LoopNodeData>;
}

export const LoopNodeProperties: React.FC<Props> = ({ node }) => {
  const { nodes, edges, agentSchemas, isReadOnly, onNodeDataChange, onOpenAgentPicker } = useWorkflowPanel();
  const { upstreamSchema, sourceLabel } = useUpstreamSchema(node, nodes, edges, agentSchemas);

  const nodeData = node.data;
  // Fix the local state bug: persist agent selection in nodeData.agents (max 1 for loop)
  const loopAgent = nodeData.agents?.[0] ?? null;

  return (
    <div className='px-4 py-3 border-b border-[var(--jarvis-border)]'>
      <div className='font-mono text-[10px] font-bold tracking-wide uppercase text-[var(--jarvis-subtle)] mb-2'>
        Loop config
      </div>
      <CELContextReference upstreamSchema={upstreamSchema} sourceLabel={sourceLabel} />
      <div className='mb-2'>
        <div className='text-xs text-[var(--jarvis-muted)] mb-1'>Agent (runs each iteration)</div>
        {loopAgent ? (
          <div className='flex items-center gap-2 bg-[var(--jarvis-card-muted)] border border-[var(--jarvis-border)] rounded-md px-2 py-1.5'>
            <div className='w-6 h-6 rounded flex items-center justify-center font-mono font-bold text-[9px] shrink-0 bg-[var(--jarvis-primary-soft)] text-[var(--jarvis-primary-text)]'>
              {loopAgent.id
                .split('-')
                .map(w => w[0].toUpperCase())
                .join('')
                .slice(0, 2)}
            </div>
            <div className='flex-1 min-w-0'>
              <div className='text-xs font-medium text-[var(--jarvis-text-strong)]'>{loopAgent.label}</div>
              <div className='text-[10px] text-[var(--jarvis-subtle)]'>{loopAgent.desc}</div>
            </div>
            <button
              type='button'
              disabled={isReadOnly}
              className='shrink-0 rounded p-0.5 transition-colors hover:bg-[var(--jarvis-danger-soft)] hover:text-[var(--jarvis-danger-text)] bg-none border-none text-[var(--jarvis-subtle)] cursor-pointer text-[13px] disabled:cursor-not-allowed disabled:opacity-50'
              onClick={() => onNodeDataChange(node.id, { agents: [] })}
            >
              ×
            </button>
          </div>
        ) : (
          <AddButton
            disabled={isReadOnly}
            onClick={() => {
              onOpenAgentPicker(agent => {
                onNodeDataChange(node.id, { agents: [agent] });
              });
            }}
          >
            + Select agent from registry
          </AddButton>
        )}
      </div>
      <div className='mb-2'>
        <label className='block text-xs text-[var(--jarvis-muted)] mb-1'>Max iterations</label>
        <input
          type='number'
          className='[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none w-20 bg-[var(--jarvis-card-muted)] border border-[var(--jarvis-border)] rounded-md text-[var(--jarvis-text-strong)] font-sans text-xs px-2 py-1.5 outline-none'
          value={nodeData.maxIterations ?? 5}
          onChange={e => onNodeDataChange(node.id, { maxIterations: parseInt(e.target.value, 10) || 1 })}
          min={1}
          disabled={isReadOnly}
        />
      </div>
      <div className='mb-2'>
        <label className='block text-xs text-[var(--jarvis-muted)] mb-1'>Exit when (CEL)</label>
        <input
          className='w-full bg-[var(--jarvis-card-muted)] border border-[var(--jarvis-border)] rounded-md text-[var(--jarvis-text-strong)] font-mono text-[11px] px-2 py-1.5 outline-none'
          value={nodeData.exitCondition ?? 'session_state.done == true'}
          onChange={e => onNodeDataChange(node.id, { exitCondition: e.target.value })}
          disabled={isReadOnly}
        />
      </div>
      <p className='text-[11px] text-[var(--jarvis-subtle)] leading-relaxed'>
        The selected agent runs on each iteration until the exit condition or max iterations is reached.
      </p>
    </div>
  );
};

```

### Core Architecture Module: `frontend/src/components/WorkflowCanvas/PropsPanel/hooks/useRunHistory.ts`
```
import { useEffect, useState } from 'react';
import SERVICES from '@/services';
import type { PanelMode, RunEntry } from '../../types';
import {
  buildNodeRunEntries,
  enrichRunsWithNodeRuns,
  normalizeRunsList,
  workflowRunToEntry,
} from '../utils/runHistoryUtils';
import { useWorkflowPanel } from '../WorkflowPanelContext';

interface UseRunHistoryProps {
  panelMode: PanelMode;
}

export const useRunHistory = ({ panelMode }: UseRunHistoryProps) => {
  const { workflowId, selectedNode, refreshRunHistoryKey = 0 } = useWorkflowPanel();
  const selectedNodeId = selectedNode?.id;
  const selectedNodeLabel = selectedNode?.data?.label as string | undefined;
  const selectedNodeType = selectedNode?.type;

  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllWorkflowRuns, setShowAllWorkflowRuns] = useState(false);

  useEffect(() => {
    if (!workflowId) {
      setRuns([]);
      return;
    }

    let cancelled = false;

    const fetchRuns = async () => {
      setLoading(true);
      setError(null);
      setShowAllWorkflowRuns(false);
      try {
        const result = await SERVICES.WORKFLOW.getWorkflowRunsList(workflowId, { perPage: 20 });
        if (cancelled) return;

        const rawRuns = normalizeRunsList(result);
        const enriched = await enrichRunsWithNodeRuns(workflowId, rawRuns);

        let entries: RunEntry[];
        if (panelMode === 'workflow') {
          entries = enriched.map(workflowRunToEntry);
        } else if (selectedNodeId) {
          entries = buildNodeRunEntries(enriched, selectedNodeId, selectedNodeLabel, selectedNodeType);
        } else {
          entries = [];
        }

        setRuns(entries);
      } catch (err: unknown) {
        if (!cancelled) {
          const e = err as { message?: string; detail?: { message?: string } | string };
          const msg =
            e?.message ||
            (typeof e?.detail === 'object' ? e.detail?.message : undefined) ||
            (typeof e?.detail === 'string' ? e.detail : undefined) ||
            'Failed to load run history';
          setError(msg);
          setRuns([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRuns();
    return () => {
      cancelled = true;
    };
  }, [workflowId, panelMode, selectedNodeId, selectedNodeLabel, refreshRunHistoryKey]);

  return { runs, loading, error, showAllWorkflowRuns, workflowId, selectedNodeId, selectedNodeLabel };
};

```

### Core Architecture Module: `frontend/src/components/WorkflowCanvas/PropsPanel/utils/runHistoryUtils.ts`
```
import SERVICES from '@/services';
import { normalizePendingRequirements } from '@/services/workflow/normalizers';
import type { NodeRun, NodeRunStatus, WorkflowRun, WorkflowRunStatus } from '@/services/workflow/type';
import type { RunEntry } from '../../types';

export const STATUS_MAP: Record<WorkflowRunStatus, RunEntry['status']> = {
  running: 'live',
  pending: 'live',
  paused: 'paused',
  awaiting_approval: 'live',
  completed: 'ok',
  failed: 'fail',
  cancelled: 'fail',
};

export const ACTIONS_BY_STATUS: Record<WorkflowRunStatus, RunEntry['actions']> = {
  running: ['pause', 'cancel'],
  pending: ['cancel'],
  paused: ['resume', 'cancel'],
  awaiting_approval: [],
  completed: [],
  failed: ['retry'],
  cancelled: ['retry'],
};

export const NODE_STATUS_MAP: Record<NodeRunStatus, RunEntry['status']> = {
  running: 'live',
  pending: 'live',
  awaiting_approval: 'paused',
  completed: 'ok',
  failed: 'fail',
  skipped: 'fail',
  cancelled: 'fail',
};

export const normalizeWorkflowRun = (raw: Record<string, unknown>): WorkflowRun => {
  const nodeRunsRaw = (raw.nodeRuns ?? raw.node_runs) as Record<string, unknown>[] | undefined;
  const nodeRuns: NodeRun[] | undefined = nodeRunsRaw?.map(nr => ({
    id: String(nr.id ?? ''),
    workflowRunId: String(nr.workflowRunId ?? nr.workflow_run_id ?? ''),
    nodeId: String(nr.nodeId ?? nr.node_id ?? ''),
    nodeName: String(nr.nodeName ?? nr.node_name ?? ''),
    status: (nr.status ?? 'pending') as NodeRun['status'],
    attempt: Number(nr.attempt ?? 0),
    inputSnapshot: (nr.inputSnapshot ?? nr.input_snapshot) as NodeRun['inputSnapshot'],
    outputSnapshot: (nr.outputSnapshot ?? nr.output_snapshot) as NodeRun['outputSnapshot'],
    error: (nr.error as string | null) ?? null,
    startedAt: (nr.startedAt ?? nr.started_at) as string | undefined,
    finishedAt: (nr.finishedAt ?? nr.finished_at) as string | undefined,
  }));

  const pendingRequirementsRaw = raw.pendingRequirements ?? raw.pending_requirements;
  const pendingRequirements =
    pendingRequirementsRaw === undefined ? undefined : normalizePendingRequirements(pendingRequirementsRaw);

  return {
    id: String(raw.id ?? ''),
    workflowDefinitionId: String(raw.workflowDefinitionId ?? raw.workflow_definition_id ?? ''),
    status: (raw.status ?? 'pending') as WorkflowRun['status'],
    triggerSource: (raw.triggerSource ?? raw.trigger_source) as string | undefined,
    startedAt: String(raw.startedAt ?? raw.started_at ?? ''),
    finishedAt: (raw.finishedAt ?? raw.finished_at) as string | undefined,
    parentRunId: (raw.parentRunId ?? raw.parent_run_id) as string | null | undefined,
    errorSummary: (raw.errorSummary ?? raw.error_summary) as string | null | undefined,
    nodeRuns,
    pendingRequirements,
  };
};

export const normalizeRunsList = (result: unknown): WorkflowRun[] => {
  if (!result || typeof result !== 'object') return [];
  const obj = result as Record<string, unknown>;
  const list = obj.runs ?? obj.data;
  if (!Array.isArray(list)) return [];
  return list.map(item => normalizeWorkflowRun(item as Record<string, unknown>));
};

export const formatDuration = (startedAt: string, finishedAt?: string): string | undefined => {
  if (!finishedAt || !startedAt) return undefined;
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 0) return undefined;
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

export const formatTime = (iso: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const hhmm = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today ${hhmm}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${hhmm}`;
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${hhmm}`;
};

export const workflowRunToEntry = (run: WorkflowRun): RunEntry => ({
  id: run.id.slice(-8),
  fullId: run.id,
  type: 'workflow',
  status: STATUS_MAP[run.status] ?? 'fail',
  time: formatTime(run.startedAt),
  dur: formatDuration(run.startedAt, run.finishedAt),
  err: run.errorSummary ?? undefined,
  actions: ACTIONS_BY_STATUS[run.status] ?? [],
  input: run.initialInput,
  output: run.finalOutput,
});

export const nodeRunToEntry = (run: WorkflowRun, nodeRun: NodeRun, nodeType?: string): RunEntry => ({
  id: run.id.slice(-8),
  fullId: run.id,
  type: 'node',
  status: NODE_STATUS_MAP[nodeRun.status] ?? 'fail',
  time: `${formatTime(run.startedAt)} · attempt ${nodeRun.attempt}`,
  dur: formatDuration(nodeRun.startedAt ?? run.startedAt, nodeRun.finishedAt),
  err: nodeRun.error ?? undefined,
  actions: nodeRun.status === 'failed' ? ['retry'] : [],
  input: nodeRun.inputSnapshot ?? undefined,
  output: nodeRun.outputSnapshot ?? undefined,
  nodeName: nodeRun.nodeName,
  nodeId: nodeRun.nodeId,
  nodeType,
});

export const matchesSelectedNode = (nodeRun: NodeRun, selectedNodeId: string, selectedNodeLabel?: string): boolean => {
  if (nodeRun.nodeId === selectedNodeId) return true;
  if (selectedNodeLabel && nodeRun.nodeName === selectedNodeLabel) return true;
  return false;
};

export const enrichRunsWithNodeRuns = async (workflowId: string, runs: WorkflowRun[]): Promise<WorkflowRun[]> => {
  const needsDetail = runs.filter(r => !r.nodeRuns?.length).slice(0, 10);
  if (needsDetail.length === 0) return runs;

  const detailById = new Map<string, WorkflowRun>();
  await Promise.all(
    needsDetail.map(async run => {
      try {
        const detail = await SERVICES.WORKFLOW.getWorkflowRunDetail(workflowId, run.id);
        detailById.set(run.id, normalizeWorkflowRun(detail as unknown as Record<string, unknown>));
      } catch {
        detailById.set(run.id, run);
      }
    }),
  );

  return runs.map(r => detailById.get(r.id) ?? r);
};

export const buildNodeRunEntries = (
  runs: WorkflowRun[],
  selectedNodeId: string,
  selectedNodeLabel?: string,
  selectedNodeType?: string,
): RunEntry[] =>
  runs.flatMap(run => {
    const nodeRun = (run.nodeRuns ?? []).find(nr => matchesSelectedNode(nr, selectedNodeId, selectedNodeLabel));
    return nodeRun ? [nodeRunToEntry(run, nodeRun, selectedNodeType)] : [];
  });

```

### Core Architecture Module: `frontend/src/components/WorkflowCanvas/hooks/useCanvasLayout.ts`
```
import type { Edge } from '@xyflow/react';
import { useCallback } from 'react';
import { getLayoutedElements } from '../layout';
import type { WorkflowNode } from '../types';

export const useCanvasLayout = (
  nodes: WorkflowNode[],
  edges: Edge[],
  setNodes: React.Dispatch<React.SetStateAction<WorkflowNode[]>>,
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
  isReadOnly = false,
) => {
  const generateNodeId = useCallback(
    () => `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    [],
  );
  const generateEdgeId = useCallback(
    () => `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    [],
  );

  const runLayout = useCallback(() => {
    if (isReadOnly) return;
    const { nodes: ln, edges: le } = getLayoutedElements(nodes, edges);
    setNodes(ln);
    setEdges(le);
  }, [nodes, edges, setNodes, setEdges, isReadOnly]);

  return {
    generateNodeId,
    generateEdgeId,
    runLayout,
  };
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #605** (2026-10-05): **docs: add changelog for asc0.5.12**
  *Symptoms*: Automated changelog update for [asc0.5.12](https://github.com/ascending-llc/jarvis-registry/releases/tag/asc0.5.12).  Generated by the Release Changelog workflow. Review and approve to publish the changelog page. 

- **Issue #604** (2026-10-05): **Feature: Flyway-style MongoDB migration runner in `registry-pkgs` (AS-1918)**
  *Symptoms*: Registry had no data-migration mechanism. Data changes shipped as one-off scripts run by hand over `kubectl  port-forward`, and a PROD deploy once went out without its backfill. This PR adds `python -m registry_pkgs.migrations {up|status|wait}`. It ships inside the existing `registry-pkgs` wheel, so the `registry`, `auth-server` and `workflow-worker` images all contain it. AS-1919 wires it into k8s initContainers.  - **Settings/client refactor:** new `JarvisEnvSettings` (`.env` policy, `build_version`) and `MongoSettings` (Mongo fields, `mongo_config`) let the runner load config without JWT keys. `create_mongo_client` is extracted from `MongoDB.connect_db`, so the runner never calls `init_beanie`. The public surface of `JarvisBaseSettings`  and `connect_db` is unchanged. - **Runner** (`registry_pkgs/migrations/`):   - Validated `m<NNNN>_<name>.py` discovery with CRLF-normalised SHA-256 checksums.   - A `registry_migrations` record per applied migration, written only after `up()` succeeds. There is no version pointer, so out-of-order merges still run (with a warning).   - A lease lock with heartbeat; a lost lock stops the run.   - A checksum mismatch stops everything and logs both remediations. - **Migration `0001`:** access-role seeding, ported from `scripts/seed_access_roles_standalone.py` (now deleted) as 21 `$setOnInsert` upserts with no transaction. It is a no-op on PROD and DEMO. - **deploy.yaml:** removed the "Seed AccessRoles Database" step and the `pymongo

- **Issue #603** (2026-10-05): **Integration idea: external source-rights evidence before tool/data admission**
  *Symptoms*: Hi - I am building AcqPath, a narrow rights-observation layer for AI data workflows.  For an agent or MCP gateway, the natural insertion point is before a fetch, ingest, index, or train action: obtain a signed source-rights observation, then let the project policy decide allow, deny, warn, or require review.  Current public interfaces: - MCP: https://api.getacqpath.com/mcp - stock x402 preflight: POST https://api.getacqpath.com/v1/rights/preflight/x402 - fresh preflight price: 0.02 USDC on Base - intended-use values: ai-input, ai-index, ai-train, search  The output is signed observation evidence with source/time context. It does not grant a licence, determine ownership, prove actual use, bypass access controls, or turn UNKNOWN into permission. Coverage is intentionally limited to reviewed origins today.  Would a provider-neutral external evidence hook of this kind fit this project? If yes, I can provide a minimal payload/schema or a project-specific example rather than asking for a broad dependency.
  **Post-Mortem & Fix Analysis**:
  > At best marketing spam. At worst prompt injection attack on us.

- **Issue #602** (2026-09-30): **feat: add workflow scheduling support**
  *Symptoms*: 

- **Issue #601** (2026-09-30): **Feature/as 1893**
  *Symptoms*: 

- **Issue #600** (2026-10-01): **Feature/as 1890**
  *Symptoms*: 

- **Issue #599** (2026-09-25): **Chore: update post-merge git hooks**
  *Symptoms*: 

- **Issue #597** (2026-09-30): **Feature/as 1868**
  *Symptoms*: ## 1. Deviations from what v2 specified  | # | What v2 said | What the implementation does | Why | |---|---|---|---| | 1 | **Drop the previous generation in-job, after the grace period** (Change 5, step 5). A startup GC sweep was listed only under "Out of scope / follow-up". | **Never drops the previous generation in-job.** Old/orphan generations are reclaimed by a **startup GC + a periodic GC**. | Decision ①-A (lazy GC). v2's in-job drop can race a concurrently restarting pod that still reads the old generation; lazy GC removes that risk and pulls the follow-up GC into scope. | | 2 | Grace period is a hard-coded **`_SWITCH_GRACE_PERIOD = 10 s`** (ten watcher polls). | Grace period is **configurable, default 60 s** (`settings.embedding_reindex_grace_period_seconds`; constant `_DEFAULT_GRACE_PERIOD_SECONDS = 60.0`). | Decision ②: configurable, larger default for cross-pod convergence headroom. | | 3 | Grace-period semantics: **wait, then drop** the old generation. | Grace-period semantics: **hold writes 503 only**, until every pod has swapped. No drop. | once GC owns the drop, grace's only job is to keep writes blocked until convergence. | | 4 | Change 8: the watcher **builds the `BackendConfig` itself** (duplicates the build logic). | The watcher **reuses `resolve_vector_backend_config`** (single source of truth for selection → config). | DRY. It also inherits the legacy-`None` fallback and the fail-hard on a missing source for free | | 5 | Files-to-change lists a **`
  **Post-Mortem & Fix Analysis**:
  > This is change request [C1].  The current reindex job has some concurrency problems: (1) GC is not safe under concurrency; (2) a pod whose operation is stalled and loses the lease might insert duplicate data into the new generation after resuming operation; (3) reindex job retry is currently unlimited, and there's no real way to transition the job status to FAILED. The fixes to these three are interconnected, so I grouped them together as [C1] and made a separate spec for it at [as-1868-v2-change-A.md](https://github.com/ascending-llc/registry-working-docs/blob/main/spec/as-1868-v2-change-A.md).
  > This is change request [M1].  In the current code, the following execution sequence is possible: (1) a "reindex job active" gate passes; (2) a reindex job starts; (3) new data saved to MongoDB, but never synced to Weaviate. Example: `refresh_server_capabilities` checks the gate at `server_service.py:1203`, makes an MCP call at `:1219`, and saves at `:1288`. If the sweep passes that server before the save commits, the new generation keeps the old content. The follow-up vector sync is rejected by `write_adapter` and swallowed at `:663-664`. This is another bigger change and it depends on the fixes from [C1], so I made a separate spec for it at [as-1868-v2-change-B.md](https://github.com/ascending-llc/registry-working-docs/blob/main/spec/as-1868-v2-change-B.md).
  > This is change request [M3].  Collection generations are meant to keep each generation on one embedding model. At the moment, a model source's `providerConfig` can be changed underneath the active generation without any check.  `PATCH /api/v1/model-sources/{id}` (`model_source_routes.py:188` → `ModelSourceCrudService.update_source`,  `model_source_crud_service.py:115-150`) replaces `providerConfig` on the source the active embedding selection  points to. The new guard at `:139-146` only covers the *pending* reindex target. If someone changes the active  source's model or deployment:  - Running pods keep their current adapter, because the watcher only compares `collection_generation`, not the  config. - Any pod that restarts comes up embedding queries with the new model against vectors built with the old one.  That gives wrong search results or dimension-mismatch errors, depending on the model.  This predates the PR (AS-1853), but preventing it is exactly what generations

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

The Agent Skills spec requires a skill's frontmatter name to match its
parent directory name. GitHub skill sync now fails such a skill during
discovery with a new skill_name_mismatch error instead of silently
syncing it. A previously synced skill whose folder starts failing the
check is preserved, like any other discovery error.

* refactor(registry): remove unused skill path field

ExtendedSkill.path held either a copy of the skill name (API-created
skills) or the upstream folder path, which sourceMetadata.skillPath
already records (GitHub-synced skills). No client read it: the CLI
names local skill folders after name, 

**File**: `docs/design/skill-sync-source-api.md` (modified, +25/-9)
```diff
@@ -61,7 +61,7 @@
 - `owner` (required, string): GitHub owner (user or org), 1–39 characters, alphanumeric + hyphens, regex: `^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$`
 - `repo` (required, string): GitHub repository name, 1–100 characters, regex: `^[A-Za-z0-9._-]+$`
 - `ref` (optional, string): Git ref to sync from (default: `"main"`), 1–255 characters, validated against path traversal
-- `paths` (required, array of strings, min 1): Repository-relative POSIX paths to scan for skills. Must be safe relative paths (no leading `/`, no `..`, no `\`). Each path is a **container**: only its direct child folders holding a `SKILL.md` become skills — the path itself is never a skill, so a `SKILL.md` at the path root is skipped. Use `["."]` to scan the repository root.
+- `paths` (required, array of strings, min 1): Repository-relative POSIX paths to scan for skills. Must be safe relative paths (no leading `/`, no `..`, no `\`). Each path is a **container**: only its direct child folders holding a `SKILL.md` become skills — the path itself is never a skill, so a `SKILL.md` at the path root is skipped. Use `["."]` to scan the repository root. Per the [Agent Skills spec](https://agentskills.io/specification), each skill's frontmatter `name` must exactly match its folder name; a mismatched skill fails discovery with `skill_name_mismatch`.
 - `githubAppClientId` (required, string): GitHub App OAuth client ID
 - `githubAppClientSecret` (required, string): GitHub App client secret (encrypted at rest via AES-CBC)
 
@@ -621,7 +621,7 @@ MongoDB collection: `skill_sync_jobs`
 | `requestSnapshot` | SkillSyncFullRequestSnapshot \| SkillSyncDeleteRequestSnapshot | Typed, immutable execution input; full sync stores owner/repo/ref/paths/configRevision and delete stores action/configRevision |
 | `discoverySummary` | SkillSyncDiscoverySummary | `{ discoveredSkillCount, discoveredFileCount, skippedPaths }` |
 | `applySummary` | SkillSyncApplySummary | `{ skillsCreated/Updated/Deleted/Failed, filesCreated/Updated/Deleted }` |
-| `skillErrors` | SkillSyncSkillError[] | Per-skill error details |
+| `skillErrors` | SkillSyncSkillError[] | Per-skill error details: `{ skillPath, upstreamId, errorCode, errorMessage, phase }`, where `skillPath` is the skill folder's repository-relative path and `phase` is `extraction`, `discovery`, `apply`, or `delete` |
 | `errorCode` | string \| null | Machine-readable error code |
 | `error` | string \| null | Human-readable error message |
 | `startedAt` | datetime \| null | When execution started |
@@ -656,7 +656,7 @@ from the updated source configuration.
 
 **SkillSyncJobErrorCode**: `github_auth_failed` | `github_rate_limited` | `github_not_found` | `download_failed` | `download_too_large` | `extraction_failed` | `decompression_bomb` | `no_skills_found` | `sync_not_implemented` | `internal_error`
 
-**SkillSyncSkillErrorCode**: `skill_parse_failed` | `skill_name_missing` | `duplicate_skill_name` | `file_too_large` | `too_many_files` | `skill_too_large` | `write_failed`
+**SkillSyncSkillErrorCode**: `skill_parse_failed` | `skill_name_missing` | `skill_name_mismatch` | `duplicate_skill_name` | `file_too_large` | `too_many_files` | `skill_too_large` | `write_failed` | `delete_failed`
 
 ---
 
@@ -705,21 +705,37 @@ QUEUED → DOWNLOADING → EXTRACTING → DISCOVERING → APPLYING → COMPLETED
 ### Prerequisites
 
 1. **Create a GitHub App** (not an OAuth App):
-   - GitHub → Settings → Developer settings → GitHub Apps → New GitHub App
-   - Set Callback URL to `https://<your-domain>/api/v1/skill-sync-sources/oauth/callback`
+   - For an org's repositories, register the App under the org: org → Settings → Developer settings →
+     GitHub Apps → New GitHub App. "Where can this GitHub App be installed?" → **Only on this account**
+   - Set Callback URL to `{REGISTRY_URL}/api/v1/skill-sync-sources/oauth/callback`, e.g.
+     `https://jarvis.example.com/gateway/api/v1/skill-sync-sources/oauth/callback`. The registry builds
+     `redirect_uri` from `REGISTRY_URL`, so the scheme, host, and base path must match it exactly
      (one constant URL for all sources — the `source_id` is carried in the OAuth `state`, not the path)
    - Leave "Request user authorization (OAuth) during installation" **unchecked**. With it enabled,
      GitHub sends the installer to the Callback URL with a `code` but no `state` (and no PKCE), so
      the callback cannot resolve the source and redirects to `?error=invalid_callback`. Users
      authorize from Jarvis instead (Connect GitHub, or a sync / test-connect that needs it)
 
-2. **Set permissions**: Repository permissions → Contents → **Read-only**
+2. **Set permissions**: Repository permissions → Contents → **Read-only** (Metadata → Read-only is
+   added automatically). Contents is what lets the App read a private repository's commits and tarball
 
 3. **Generate client secret** on the App settings page
 
-4. **Install the App** on the target org/user account, granting access 
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
+  updatedAt: '2026-09-24T13:58:35.429Z',
+  ...overrides,
+});
+
+afterEach(() => {
+  cleanup();
+});
+
+describe('GithubLastSyncDetails', () => {
+  test('names each failed skill by its path and shows its error code and message', () => {
+    render(<GithubLastSyncDetails job={makeJob()} />);
+
+    expect(screen.getByText('Failed skills (1)')).toBeTruthy();
+    expect(screen.getByText('skills/claude-api')).toBeTruthy();
+    expect(screen.getByText('skill_parse_failed')).toBeTruthy();
+    expect(screen.getByText(/SKILL\.md frontmatter validation failed/)).toBeTruthy();
+    expect(screen.queryByText('Unknown skill')).toBeNull();
+  });
+
+  test('lists every failed skill', () => {
+    const job = makeJob({
+      skillErrors: [
+        {
+          skillPath: 'skills/a',
+          upstreamId: 'skills/a',
+          errorCode: 'skill_name_mismatch',
+          errorMessage: "Skill name 'b' does not match its folder name 'a'",
+          phase: 'discovery',
+        },
+        {
+          skillPath: 'skills/c',
+          upstreamId: 'skills/c',
+          errorCode: 'write_failed',
+          errorMessage: 'write failed',
+          phase: 'apply',
+        },
+      ],
+    });
+
+    render(<GithubLastSyncDetails job={job} />);
+
+    expect(screen.getByText('Failed skills (2)')).toBeTruthy();
+    expect(screen.getByText('skills/a')).toBeTruthy();
+    expect(screen.getByText("Skill name 'b' does not match its folder name 'a'")).toBeTruthy();
+    expect(screen.getByText('skills/c')).toBeTruthy();
+    expect(screen.getByText('write failed')).toBeTruthy();
+  });
+
+  test('omits the failed skills section when no skill errored', () => {
+    render(<GithubLastSyncDetails job={makeJob({ status: 'success', skillErrors: [] })} />);
+
+    expect(screen.queryByText(/Failed skills/)).toBeNull();
+  });
+});
```

**File**: `frontend/src/pages/FederationRegistryOrEdit/GithubLastSyncDetails.tsx` (modified, +3/-8)
```diff
@@ -3,8 +3,6 @@ import type React from 'react';
 import type { SkillSyncJob } from '@/services/skillSyncSource/type';
 import UTILS from '@/utils';
 
-import { getSkillErrorLabel } from './skillSyncJobUtils';
-
 interface GithubLastSyncDetailsProps {
   job: SkillSyncJob;
 }
@@ -45,17 +43,14 @@ const GithubLastSyncDetails: React.FC<GithubLastSyncDetailsProps> = ({ job }) =>
           <ul className='space-y-2'>
             {skillErrors.map((skillError, index) => (
               <li
-                key={`${skillError.path ?? skillError.skillName ?? 'skill'}-${index}`}
+                key={`${skillError.skillPath}-${index}`}
                 className='rounded-md border border-[color:var(--jarvis-border)] bg-[var(--jarvis-card-muted)] p-3 text-sm'
               >
                 <div className='flex flex-wrap items-center gap-2'>
-                  <span className='font-medium text-[var(--jarvis-text-strong)]'>{getSkillErrorLabel(skillError)}</span>
-                  {skillError.skillName && skillError.path && (
-                    <span className='font-mono text-xs text-[var(--jarvis-subtle)]'>{skillError.path}</span>
-                  )}
+                  <span className='font-mono font-medium text-[var(--jarvis-text-strong)]'>{skillError.skillPath}</span>
                   <span className='font-mono text-xs text-[var(--jarvis-danger-text)]'>{skillError.errorCode}</span>
                 </div>
-                <p className='mt-1 text-[var(--jarvis-muted)]'>{skillError.error}</p>
+                <p className='mt-1 break-words text-[var(--jarvis-muted)]'>{skillError.errorMessage}</p>
               </li>
             ))}
           </ul>
```

**File**: `frontend/src/pages/FederationRegistryOrEdit/skillSyncJobUtils.test.ts` (modified, +1/-13)
```diff
@@ -2,7 +2,7 @@ import { describe, expect, test } from 'vitest';
 
 import type { SkillSyncJob } from '@/services/skillSyncSource/type';
 
-import { getLatestFinishedSyncJob, getSkillErrorLabel } from './skillSyncJobUtils';
+import { getLatestFinishedSyncJob } from './skillSyncJobUtils';
 
 const makeJob = (id: string, overrides: Partial<SkillSyncJob> = {}): SkillSyncJob => ({
   id,
@@ -57,15 +57,3 @@ describe('getLatestFinishedSyncJob', () => {
     expect(getLatestFinishedSyncJob([makeJob('running', { status: 'syncing' })])).toBeNull();
   });
 });
-
-describe('getSkillErrorLabel', () => {
-  test('prefers the skill name, then the path', () => {
-    expect(getSkillErrorLabel({ skillName: 'review', path: 'skills/review', errorCode: 'E', error: 'x' })).toBe(
-      'review',
-    );
-    expect(getSkillErrorLabel({ skillName: null, path: 'skills/review', errorCode: 'E', error: 'x' })).toBe(
-      'skills/review',
-    );
-    expect(getSkillErrorLabel({ errorCode: 'E', error: 'x' })).toBe('Unknown skill');
-  });
-});
```

**File**: `frontend/src/pages/FederationRegistryOrEdit/skillSyncJobUtils.ts` (modified, +1/-4)
```diff
@@ -1,10 +1,7 @@
-import type { SkillSyncJob, SkillSyncSkillError } from '@/services/skillSyncSource/type';
+import type { SkillSyncJob } from '@/services/skillSyncSource/type';
 
 const FINISHED_JOB_STATUSES = new Set<SkillSyncJob['status']>(['success', 'partial_success', 'failed']);
 
 /** The most recent finished sync (not delete) job; `recentJobs` is newest first. */
 export const getLatestFinishedSyncJob = (recentJobs: SkillSyncJob[]): SkillSyncJob | null =>
   recentJobs.find(job => job.jobType !== 'delete_sync' && FINISHED_JOB_STATUSES.has(job.status)) ?? null;
-
-export const getSkillErrorLabel = (skillError: SkillSyncSkillError): string =>
-  skillError.skillName || skillError.path || 'Unknown skill';
```

**File**: `frontend/src/pages/Skills/skillDraft.ts` (modified, +0/-1)
```diff
@@ -360,7 +360,6 @@ export const metadataFromDetail = (detail: SkillDetail): SkillMetadata => ({
   description: detail.description,
   category: normalizeSkillCategory(detail.category),
   tags: detail.tags,
-  path: detail.name,
   version: detail.version,
   fileCount: detail.fileCount,
   alwaysApply: detail.alwaysApply,
```

**File**: `frontend/src/services/skill/type.ts` (modified, +0/-1)
```diff
@@ -39,7 +39,6 @@ export type SkillMetadata = {
   description: string;
   category: string;
   tags: string[];
-  path: string;
   version: number;
   fileCount: number;
   alwaysApply: boolean;
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
 
 
-@router.get("/oauth/callback", name="skill_sync_oauth_callback")
+@router.get("/oauth/callback", name=_OAUTH_CALLBACK_ROUTE_NAME)
 async def skill_sync_oauth_callback(
     request: Request,
     code: str | None = Query(default=None),
@@ -512,7 +524,7 @@ async def skill_sync_oauth_callback(
         return RedirectResponse(error_redirect)
     try:
         source = await _required_source(resolved_source_id, source_service)
-        redirect_uri = str(request.url_for("skill_sync_oauth_callback"))
+        redirect_uri = _skill_sync_oauth_callback_url(request)
         # Store the token only; the frontend then drives dryRun (test-connect) and sync explicitly.
         await oauth_service.exchange_callback(
             source=source,
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
+def test_oauth_callback_uses_public_registry_url_for_redirect_uri(skill_sync_route_context, proxied_client) -> None:
+    ctx = skill_sync_route_context
+    ctx.oauth_service.exchange_callback = AsyncMock(return_value=USER_ID)
+    response = proxied_client.get(
+        "/gateway/skill-sync-sources/oauth/callback?code=code&state=state",
+        follow_redirects=False,
+    )
+    assert response.status_code == 307
+    assert "status=connected" in response.headers["location"]
+    assert ctx.oauth_service.exchange_callback.call_args.kwargs["redirect_uri"] == _EXPECTED_CALLBACK_URL
+
+
+def test_oauth_initiate_and_callback_send_identical_redirect_uri(skill_sync_route_context, proxied_client) -> None:
+    # GitHub rejects the token exchange unless redirect_uri matches the one sent to /authorize exactly.
+    ctx = skill_sync_route_context
+    ctx.oauth_service.exchange_callback = AsyncMock(return_value=USER_ID)
+    proxied_client.get(f"/gateway/skill-sync-sources/{ctx.source.id}/oauth/initiate", follow_redirects=False)
+    proxied_client.get("/gateway/skill-sync-sources/oauth/callback?code=code&state=state", follow_redirects=False)
+    initiate_uri = ctx.oauth_service.create_authorization_url.call_args.kwargs["redirect_uri"]
+    callback_uri = ctx.oauth_service.exchange_callback.call_args.kwargs["redirect_uri"]
+    assert initiate_uri == callback_uri
+
+
+def test_oauth_callback_path_on_registered_app() -> None:
+    # Guards the helper's reliance on url_path_for returning the full public path under the real router wiring.
+    from registry.routers import register_routers
+
+    app = FastAPI()
+    register_routers(app)
+    assert app.url_path_for("skill_sync_oauth_callback") == (
+        f"/api/{settings.api_version}/skill-sync-sources/oauth/callback"
+    )
+
+
 def test_create_source_delegates_transaction_to_service(skill_sync_route_context) -> None:
     ctx = skill_sync_route_context
     payload = {
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
+    # docstring). Registry owns federation, workflow, skill, skillSyncSource, and
+    # remoteAgent, and also seeds mcpServer here so a Registry-only deployment (no
+    # Chat) still gets it.
     roles_data = [
         {
             "accessRoleId": "federation_viewer",
@@ -180,6 +189,66 @@ async def seed_access_roles(collection, session):
             "updatedAt": datetime.now(UTC),
             "__v": 0,
         },
+        {
+            "accessRoleId": "mcpServer_viewer",
+            "resourceType": "mcpServer",
+            "name": "com_ui_mcp_server_role_viewer",
+            "description": "com_ui_mcp_server_role_viewer_desc",
+            "permBits": 1,
+            "createdAt": datetime.now(UTC),
+            "updatedAt": datetime.now(UTC),
+            "__v": 0,
+        },
+        {
+            "accessRoleId": "mcpServer_editor",
+            "resourceType": "mcpServer",
+            "name": "com_ui_mcp_server_role_editor",
+            "description": "com_ui_mcp_server_role_editor_desc",
+            "permBits": 3,
+            "createdAt": datetime.now(UTC),
+            "updatedAt": datetime.now(UTC),
+            "__v": 0,
+        },
+        {
+            "accessRoleId": "mcpServer_owner",
+            "resourceType": "mcpServer",
+            "name": "com_ui_mcp_server_role_owner",
+            "description": "com_ui_mcp_server_role_owner_desc",
+            "permBits": 15,
+            "createdAt": datetime.now(UTC),
+            "updatedAt": datetime.now(UTC),
+            "__v": 0,
+        },
+        {
+            "accessRoleId": "remoteAgent_viewer",
+            "resourceType": "remoteAgent",
+            "name": "com_ui_remote_agent_role_viewer",
+            "description": "com_ui_remote_agent_role_viewer_desc",
+            "permBits": 1,
+            "createdAt": datetime.now(UTC),
+            "updatedAt": datetime.now(UTC),
+            "__v": 0,
+        },
+        {
+            "accessRoleId": "remoteAgent_editor",
+            "resourceType": "remoteAgent",
+            "name": "com_ui_remote_agent_role_editor",
+            "description": "com_ui_remote_agent_role_editor_desc",
+            "permBits": 3,
+            "createdAt": datetime.now(UTC),
+            "updatedAt": datetime.now(UTC),
+            "__v": 0,
+        },
+        {
+            "accessRoleId": "remoteAgent_owner",
+            "resourceType": "remoteAgent",
+            "name": "com_ui_remote_agent_role_owner",
+            "description": "com_ui_remote_agent_role_owner_desc",
+            "permBits": 15,
+            "createdAt": datetime.now(UTC),
+            "updatedAt": datetime.now(UTC),
+            "__v": 0,
+        },
     ]
 
     for role_data in roles_data:
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
+                step._prepare_steps()
+                selected_steps = step._get_steps_from_user_selection(selection)
+                router = step
+                original_selector = router.selector
+                router.selector = lambda _: selected_steps
+                kwargs.pop("router_selection")
+
+        try:
+            return await super()._acontinue_execute(
+                session=session,
+                execution_input=execution_input,
+                workflow_run_response=workflow_run_response,
+                run_context=run_context,
+                start_step_index=start_step_index,
+                background_tasks=background_tasks,
+                **kwargs,
+            )
+        finally:
+            if router is not None:
+                router.selector = original_selector
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
 
         return StepOutput(content="", success=False, error="Max retries exceeded")
```

**File**: `registry-pkgs/src/registry_pkgs/workflows/persistence.py` (modified, +55/-8)
```diff
@@ -160,6 +160,10 @@ async def _update_workflow_run(
         run = self._workflow_run
         mapped_status = _resolve_workflow_run_status(run_output, step_outputs or [], self._node_by_name)
         run.status = mapped_status
+        if mapped_status == WorkflowRunStatus.FAILED:
+            run.error_summary = _first_failure_error(step_outputs or [], self._node_by_name) or run.error_summary
+            if any(step.stop and _has_non_skip_failure(step, self._node_by_name) for step in step_outputs or []):
+                run.pending_requirements = []
         if mapped_status in _TERMINAL_STATUSES:
             if run.finished_at is None:
                 run.finished_at = datetime.now(UTC)
@@ -202,10 +206,13 @@ async def _upsert_node_run(
         if node_run.status not in _TERMINAL_NODE_RUN_STATUSES:
             if step_output.success:
                 node_run.status = NodeRunStatus.COMPLETED
-            elif _is_skip_tolerated_failure(step_output, self._node_by_name):
-                # on_error=skip: a tolerated failure is recorded as SKIPPED (not FAILED)
-                # so the UI distinguishes "skipped over" from a hard failure.
-                node_run.status = NodeRunStatus.SKIPPED
+            elif not _has_non_skip_failure(step_output, self._node_by_name):
+                # A container aggregates skip-tolerated child failures into
+                # success=False; those children must not fail the container.
+                if step_output.steps:
+                    node_run.status = NodeRunStatus.COMPLETED
+                else:
+                    node_run.status = NodeRunStatus.SKIPPED
             else:
                 node_run.status = NodeRunStatus.FAILED
             node_run.finished_at = datetime.now(UTC)
@@ -272,6 +279,49 @@ def _is_skip_tolerated_failure(
     return is_skip_tolerated_failure(step_output.success, node.step_config if node else None)
 
 
+def _has_non_skip_failure(
+    step_output: StepOutput,
+    node_by_name: dict[str, WorkflowNode] | None,
+) -> bool:
+    """Ignore a container's aggregate failure when all failed children are skipped."""
+    if step_output.success:
+        return False
+    if step_output.steps:
+        return (
+            bool(step_output.error)
+            or all(child.success for child in step_output.steps)
+            or any(_has_non_skip_failure(child, node_by_name) for child in step_output.steps)
+        )
+    return not _is_skip_tolerated_failure(step_output, node_by_name)
+
+
+def _first_failure_error(
+    step_outputs: list[StepOutput],
+    node_by_name: dict[str, WorkflowNode] | None,
+) -> str | None:
+    """Prefer a failed leaf's original error over a container's aggregate output."""
+    fallback_name: str | None = None
+    container_name: str | None = None
+    container_error: str | None = None
+    for step_output in step_outputs:
+        if not _has_non_skip_failure(step_output, node_by_name):
+            continue
+        if step_output.steps:
+            container_error = container_error or step_output.error
+            container_name = container_name or step_output.step_name
+            continue
+        if step_output.error:
+            return step_output.error
+        fallback_name = fallback_name or step_output.step_name
+    if container_error:
+        return container_error
+    if fallback_name:
+        return f"Step {fallback_name!r} failed"
+    if container_name:
+        return f"Step {container_name!r} failed"
+    return None
+
+
 def _resolve_workflow_run_status(
     run_output: WorkflowRunOutput,
     step_outputs: list[StepOutput],
@@ -286,10 +336,7 @@ def _resolve_workflow_run_status(
 
     # A failed step forces FAILED only when it is *not* tolerated by on_error=skip;
     # skip-tolerated failures keep the run eligible to COMPLETE.
-    if any(
-        not step_output.success and not _is_skip_tolerated_failure(step_output, node_by_name)
-        for step_output in step_outputs
-    ):
+    if any(_has_non_skip_failure(step_output, node_by_name) for step_output in step_outputs):
         return WorkflowRunStatus.FAILED
 
     return mapped_status
```

**File**: `registry-pkgs/src/registry_pkgs/workflows/runner.py` (modified, +55/-13)
```diff
@@ -52,6 +52,7 @@
 from agno.exceptions import RunCancelledException
 from agno.models.base import Model
 from agno.run.cancel import acancel_run as agno_acancel_run
+from agno.run.workflow import WorkflowRunOutput
 from beanie import PydanticObjectId
 from beanie.exceptions import DocumentNotFound
 from beanie.operators import In
@@ -75,6 +76,11 @@
 from registry_pkgs.workflows.hitl import hydrate_requirement, serialize_requirement
 from registry_pkgs.workflows.mcp_executor import McpHeadersProvider
 from registry_pkgs.workflows.model_resolution import AzureAdTokenProvider, resolve_default_workflow_model
+from registry_pkgs.workflows.persistence import (
+    _first_failure_error,
+    _flatten_step_results,
+    _resolve_workflow_run_status,
+)
 from registry_pkgs.workflows.types import WorkflowConfigError
 
 logger = logging.getLogger(__name__)
@@ -485,13 +491,26 @@ async def _execute(
     async def _handle_run_output(self, run: WorkflowRun, result: Any) -> None:
         """Route the WorkflowRunOutput returned by arun / acontinue_run.
 
-        - If ``result.is_paused``: persist serialized ``step_requirements`` into
-          ``WorkflowRun.pending_requirements`` and flip status to AWAITING_APPROVAL.
-          The runner coroutine then returns (no busy-waiting; pod-restart safe).
-        - Otherwise: trust WorkflowRunSyncer to have already written terminal state,
-          and just reload from Mongo so the in-memory ``run`` reflects what
-          callers will see.
+        Reload the state written by WorkflowRunSyncer first: a terminal step
+        failure may cause agno to request output review, but must never become
+        resumable. Also inspect the returned output in case the syncer's Beanie
+        transaction failed. Only non-terminal pauses become AWAITING_APPROVAL.
         """
+        try:
+            await run.sync()
+        except DocumentNotFound:
+            logger.warning("[run=%s] sync() skipped — document deleted before reload", run.id)
+            return
+
+        # agno checks post-execution output review before StepOutput.stop. A
+        # failing step may therefore report a pause after the syncer has already
+        # persisted FAILED; that terminal outcome must win over human review.
+        if run.status in _TERMINAL_RUN_STATUSES:
+            return
+
+        if await self._persist_stopped_failure(run, result):
+            return
+
         if getattr(result, "is_paused", False):
             serialized: list[dict[str, Any]] = []
             for req in getattr(result, "step_requirements", None) or []:
@@ -520,13 +539,36 @@ async def _handle_run_output(self, run: WorkflowRun, result: Any) -> None:
             )
             return
 
-        try:
-            await run.sync()
-        except DocumentNotFound:
-            # The document was deleted between workflow completion and this sync
-            # (e.g. concurrent cleanup). The run already reached a terminal state
-            # via WorkflowRunSyncer, so there is nothing left to do.
-            logger.warning("[run=%s] sync() skipped — document deleted before reload", run.id)
+    async def _persist_stopped_failure(
+        self,
+        run: WorkflowRun,
+        result: Any,
+    ) -> bool:
+        """Persist a terminal step failure even when the session mirror failed.
+
+        WorkflowRunSyncer logs Beanie transaction errors without raising. Its
+        previously saved agno session may still offer output review, so a stale
+        WorkflowRun must not make the failed output resumable. Save errors must
+        propagate to the caller instead of falling through to approval handling.
+        """
+        if not isinstance(result, WorkflowRunOutput):
+            return False
+        step_outputs = _flatten_step_results(result.step_results)
+        if not any(output.stop for output in step_outputs):
+            return False
+
+        definition = definition_from_snapshot(run.definition_snapshot) if run.definition_snapshot else None
+        nodes = flatten_workflow_nodes(definition.nodes) if definition else []
+        node_by_name = {node.name: node for node in nodes}
+        if _resolve_workflow_run_status(result, step_outputs, node_by_name) != WorkflowRunStatus.FAILED:
+            return False
+
+        run.status = WorkflowRunStatus.FAILED
+        run.error_summary = _first_failure_error(step_outputs, node_by_name) or run.error_summary
+        run.pending_requirements = []
+        run.finished_at = run.finished_at or datetime.now(UTC)
+        await run.save()
+        return True
 
     async def _finalize_cancel(self, run: WorkflowRun, exc: BaseException) -> None:
         """Mark the run CANCELLED and reverse-notify agno (M2)."""
```

**File**: `registry-pkgs/tests/unit/workflow/test_agno_compat.py` (added, +174/-0)
```diff
@@ -0,0 +1,174 @@
+"""Exercise continuation through the production compiler and real agno dispatch."""
+
+import asyncio
+from types import SimpleNamespace
+from unittest.mock import AsyncMock
+
+import pytest
+from agno.db.in_memory import InMemoryDb
+from agno.workflow import Router, Step, StepInput, StepOutput, Workflow
+from beanie import PydanticObjectId
+
+from registry_pkgs.models.enums import WorkflowRunStatus
+from registry_pkgs.models.workflow import (
+    HumanReviewSpec,
+    RouterChoice,
+    StepConfig,
+    WorkflowDefinition,
+    WorkflowNode,
+    WorkflowRun,
+)
+from registry_pkgs.workflows.agno_compat import RegistryWorkflow
+from registry_pkgs.workflows.compiler import compile_workflow, flatten_workflow_nodes
+from registry_pkgs.workflows.control import DirectiveQueue
+from registry_pkgs.workflows.control import wrapper as wrapper_module
+from registry_pkgs.workflows.hitl import hydrate_requirement, serialize_requirement
+from registry_pkgs.workflows.persistence import WorkflowRunSyncer, _flatten_step_results
+from registry_pkgs.workflows.prompt import ADDITIONAL_DATA_STEP_OBJECTIVE
+
+
+@pytest.mark.unit
+@pytest.mark.asyncio
+@pytest.mark.parametrize("outcome", ["raise", "return_failure", "retry", "skip", "success"])
+@pytest.mark.parametrize("output_review", [False, True])
+async def test_manual_router_continuation_honors_stop(
+    monkeypatch: pytest.MonkeyPatch,
+    outcome: str,
+    output_review: bool,
+) -> None:
+    executed: list[str] = []
+
+    async def selected_executor(step_input: StepInput, session_state: dict | None = None) -> StepOutput:
+        executed.append("selected")
+        if outcome == "success":
+            return StepOutput(content="selected output")
+        if outcome == "return_failure":
+            return StepOutput(success=False, error="original auth error")
+        raise RuntimeError("original auth error")
+
+    async def record_executor(step_input: StepInput, session_state: dict | None = None) -> StepOutput:
+        name = step_input.additional_data[ADDITIONAL_DATA_STEP_OBJECTIVE]
+        executed.append(name)
+        return StepOutput(content=name)
+
+    def node(name: str) -> WorkflowNode:
+        return WorkflowNode(name=name, executor_key="fixture", step_objective=name)
+
+    selected = node("selected")
+    selected.step_config = StepConfig(
+        on_error=outcome if outcome in {"retry", "skip"} else "fail",
+        max_retries=2 if outcome == "retry" else 0,
+        backoff_base_seconds=0.001,
+    )
+    route = WorkflowNode(
+        name="router",
+        node_type="router",
+        condition_cel='"other"',  # The user's selection must override the default route.
+        human_review=HumanReviewSpec(requires_user_input=True, requires_output_review=output_review),
+        choices=[
+            RouterChoice(name="chosen", steps=[selected, node("inner-after")]),
+            RouterChoice(name="other", steps=[node("unselected")]),
+        ],
+    )
+    definition = WorkflowDefinition.model_construct(
+        id=PydanticObjectId(), name="manual-route", nodes=[node("before"), route, node("downstream")]
+    )
+    run = WorkflowRun.model_construct(id=PydanticObjectId(), workflow_definition_id=definition.id)
+    nodes = flatten_workflow_nodes(definition.nodes)
+    executors = {item.id: record_executor for item in nodes if item.executor_key}
+    executors[selected.id] = selected_executor
+    queue = DirectiveQueue()
+    db = InMemoryDb()
+    monkeypatch.setattr(wrapper_module, "_read_mongodb_directive", AsyncMock(return_value=None))
+    monkeypatch.setattr(wrapper_module, "_record_attempt_start", AsyncMock())
+    monkeypatch.setattr(wrapper_module, "_record_attempt_result", AsyncMock())
+
+    def compile_run() -> Workflow:
+        workflow = compile_workflow(definition, run, executor_registry=executors, directive_queue=queue)
+        workflow.db = db
+        workflow.telemetry = False
+        return workflow
+
+    paused = await compile_run().arun(input="hello", session_id=str(run.id))
+    assert paused.is_paused
+    assert executed == ["before"]
+    requirement = paused.step_requirements[-1]
+    assert requirement.requires_route_selection
+    requirement.select("chosen")
+
+    # Production rebuilds the workflow and hydrates the decision on another request/worker.
+    workflow = compile_run()
+    result = await workflow.acontinue_run(
+        run_id=paused.run_id,
+        session_id=str(run.id),
+        step_requirements=[hydrate_requirement(serialize_requirement(requirement))],
+    )
+    assert workflow.steps[1].selector == '"other"'
+    assert executed.count("before") == 1
+    assert "unselected" not in executed
+    assert executed.count("selected") == (3 if outcome == "retry" else 1)
+
+    run_doc = SimpleNamespace(
+        id=run.id,
+        status=WorkflowRunStatus.RUNNING,
+        error_summary=None,
+        pending_requirements=[serialize_requirement(requirement)],
+        fin
```

**File**: `registry-pkgs/tests/unit/workflow/test_control_wrapper.py` (modified, +205/-2)
```diff
@@ -4,7 +4,7 @@
 from unittest.mock import AsyncMock
 
 import pytest
-from agno.workflow import StepOutput
+from agno.workflow import Condition, Loop, Parallel, Router, Step, StepOutput, Steps, Workflow
 from beanie import PydanticObjectId
 from opentelemetry import baggage
 
@@ -18,6 +18,7 @@
 from registry_pkgs.workflows.control import DirectiveQueue
 from registry_pkgs.workflows.control import wrapper as wrapper_module
 from registry_pkgs.workflows.control.wrapper import WorkflowCancelledError, _record_attempt_result, with_control
+from registry_pkgs.workflows.persistence import _flatten_step_results, _resolve_workflow_run_status
 from registry_pkgs.workflows.types import is_skip_tolerated_failure
 
 
@@ -181,6 +182,7 @@ async def test_executor_exception_converted_to_failed_step_output(self, monkeypa
         assert result.success is False
         assert result.error == "RuntimeError: downstream server exploded"
         assert result.content == ""
+        assert result.stop is True
         executor.assert_awaited_once()
         record_attempt_result.assert_awaited_once_with(
             run_id,
@@ -197,7 +199,7 @@ async def test_executor_exception_triggers_retry(self, monkeypatch: pytest.Monke
         queue = DirectiveQueue()
         queue.register(run_id)
 
-        success_output = SimpleNamespace(success=True, content="done", error=None)
+        success_output = StepOutput(success=True, content="done")
         executor = AsyncMock(side_effect=[RuntimeError("transient"), success_output])
 
         step_config = StepConfig(on_error="retry", max_retries=2, backoff_base_seconds=0.01, backoff_max_seconds=0.01)
@@ -229,6 +231,7 @@ async def test_executor_exception_triggers_retry(self, monkeypatch: pytest.Monke
 
         assert result.success is True
         assert result.content == "done"
+        assert result.stop is False
         assert executor.await_count == 2
         record_attempt_result.assert_awaited_once_with(
             run_id,
@@ -267,6 +270,7 @@ async def test_exhausted_retries_persist_only_final_failure(self, monkeypatch: p
         result = await wrapped(SimpleNamespace(input="hello"), {})
 
         assert result is failures[-1]
+        assert result.stop is True
         assert executor.await_count == 3
         record_attempt_result.assert_awaited_once_with(
             run_id,
@@ -276,6 +280,205 @@ async def test_exhausted_retries_persist_only_final_failure(self, monkeypatch: p
             failures[-1],
         )
 
+    @pytest.mark.asyncio
+    async def test_skip_tolerated_failure_does_not_request_workflow_stop(self, monkeypatch: pytest.MonkeyPatch):
+        run_id = str(PydanticObjectId())
+        queue = DirectiveQueue()
+        queue.register(run_id)
+        failure = StepOutput(content="", success=False, error="optional step failed")
+        step_config = StepConfig(on_error="skip")
+        wrapped = with_control(
+            AsyncMock(return_value=failure),
+            run_id=run_id,
+            node_id="node-1",
+            node_name="optional",
+            step_config=step_config,
+            directive_queue=queue,
+        )
+        monkeypatch.setattr(wrapper_module, "_read_mongodb_directive", AsyncMock(return_value=None))
+        monkeypatch.setattr(wrapper_module, "_record_attempt_start", AsyncMock())
+        monkeypatch.setattr(wrapper_module, "_record_attempt_result", AsyncMock())
+
+        result = await wrapped(SimpleNamespace(input="hello"), {})
+
+        assert result is failure
+        assert result.stop is False
+
+    @pytest.mark.asyncio
+    async def test_terminal_failure_is_persisted_before_stop_is_set(self, monkeypatch: pytest.MonkeyPatch):
+        run_id = str(PydanticObjectId())
+        queue = DirectiveQueue()
+        queue.register(run_id)
+        failure = StepOutput(content="", success=False, error="boom")
+        stop_values_at_persistence: list[bool] = []
+
+        async def record_result(*args: object) -> None:
+            stop_values_at_persistence.append(args[-1].stop)  # type: ignore[union-attr]
+
+        wrapped = with_control(
+            AsyncMock(return_value=failure),
+            run_id=run_id,
+            node_id="node-1",
+            node_name="critical",
+            step_config=None,
+            directive_queue=queue,
+        )
+        monkeypatch.setattr(wrapper_module, "_read_mongodb_directive", AsyncMock(return_value=None))
+        monkeypatch.setattr(wrapper_module, "_record_attempt_start", AsyncMock())
+        monkeypatch.setattr(wrapper_module, "_record_attempt_result", record_result)
+
+        result = await wrapped(SimpleNamespace(input="hello"), {})
+
+        assert stop_values_at_persistence == [False]
+        assert result.stop is True
+
+
+@pytest.mark.unit
+class TestWithControlHaltsAgnoWorkflow:
+    @pytest.mark.asyncio
+    @pytest.mark.parametrize("container_kind", ["sequential", "loop", "parallel", "router", "condition"])
+    async def test_non_skip_failure_stops_
```

**File**: `registry-pkgs/tests/unit/workflow/test_persistence.py` (modified, +243/-0)
```diff
@@ -42,6 +42,8 @@ def _sync_with_fake_run():
         status=WorkflowRunStatus.RUNNING,
         finished_at=None,
         final_output=None,
+        error_summary=None,
+        pending_requirements=[],
         save=AsyncMock(),
     )
     sync._node_by_name = {}
@@ -132,6 +134,194 @@ async def test_update_workflow_run_fails_when_any_step_failed(self):
         assert sync._workflow_run.status == WorkflowRunStatus.FAILED
         assert sync._workflow_run.finished_at is not None
         assert sync._workflow_run.final_output == {"content": "step failed"}
+        assert sync._workflow_run.error_summary == "boom"
+
+    @pytest.mark.asyncio
+    async def test_update_workflow_run_uses_failed_step_name_when_error_is_empty(self):
+        sync = _sync_with_fake_run()
+
+        await sync._update_workflow_run(
+            WorkflowRunOutput(content="step failed", status=RunStatus.completed),
+            [StepOutput(step_name="bad-step", success=False)],
+        )
+
+        assert sync._workflow_run.status == WorkflowRunStatus.FAILED
+        assert sync._workflow_run.error_summary == "Step 'bad-step' failed"
+
+    @pytest.mark.asyncio
+    async def test_update_workflow_run_prefers_nested_failure_error_over_parallel_aggregate(self):
+        sync = _sync_with_fake_run()
+        child = StepOutput(step_name="bad-step", success=False, error="original auth error", stop=True)
+        parallel = StepOutput(
+            step_name="parallel",
+            step_type="Parallel",
+            success=False,
+            stop=True,
+            steps=[child],
+        )
+
+        await sync._update_workflow_run(
+            WorkflowRunOutput(content="step failed", status=RunStatus.completed),
+            persistence._flatten_step_results([parallel]),
+        )
+
+        assert sync._workflow_run.status == WorkflowRunStatus.FAILED
+        assert sync._workflow_run.error_summary == "original auth error"
+
+    @pytest.mark.asyncio
+    async def test_update_workflow_run_ignores_skip_only_container_aggregate_failure(self):
+        sync = _sync_with_fake_run()
+        sync._node_by_name = {
+            "optional": WorkflowNode(
+                name="optional",
+                executor_key="tool",
+                step_config=StepConfig(on_error="skip"),
+                step_objective="optional work",
+            )
+        }
+        skipped = StepOutput(step_name="optional", success=False, error="optional failure")
+        parallel = StepOutput(
+            step_name="parallel",
+            step_type="Parallel",
+            success=False,
+            steps=[skipped],
+        )
+
+        await sync._update_workflow_run(
+            WorkflowRunOutput(content="done", status=RunStatus.completed),
+            persistence._flatten_step_results([parallel]),
+        )
+
+        assert sync._workflow_run.status == WorkflowRunStatus.COMPLETED
+        assert sync._workflow_run.error_summary is None
+
+    @pytest.mark.asyncio
+    async def test_update_workflow_run_ignores_skipped_error_when_real_failure_follows(self):
+        sync = _sync_with_fake_run()
+        sync._node_by_name = {
+            "optional": WorkflowNode(
+                name="optional",
+                executor_key="tool",
+                step_config=StepConfig(on_error="skip"),
+                step_objective="optional work",
+            ),
+            "critical": WorkflowNode(
+                name="critical",
+                executor_key="tool",
+                step_objective="critical work",
+            ),
+        }
+        skipped = StepOutput(step_name="optional", success=False, error="ignored error")
+        skipped_container = StepOutput(
+            step_name="parallel",
+            step_type="Parallel",
+            success=False,
+            steps=[skipped],
+        )
+        critical = StepOutput(step_name="critical", success=False, error="fatal error", stop=True)
+
+        await sync._update_workflow_run(
+            WorkflowRunOutput(content="failed", status=RunStatus.completed),
+            persistence._flatten_step_results([skipped_container, critical]),
+        )
+
+        assert sync._workflow_run.status == WorkflowRunStatus.FAILED
+        assert sync._workflow_run.error_summary == "fatal error"
+        assert sync._workflow_run.pending_requirements == []
+
+    @pytest.mark.asyncio
+    async def test_update_workflow_run_clears_stale_review_on_stopped_failure(self):
+        sync = _sync_with_fake_run()
+        sync._workflow_run.pending_requirements = [{"step_id": "review"}]
+
+        await sync._update_workflow_run(
+            WorkflowRunOutput(status=RunStatus.paused),
+            [StepOutput(step_name="critical", success=False, stop=True, error="fatal")],
+        )
+
+        assert sync._workflow_run.status == WorkflowRunStatus.FAILED
+        assert sync._workflow_run.error_summary == "fatal"
+        assert sync._workflow_run.pending_requirements == []
+
+    @pytest.mark
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
-                      className='h-[360px] min-h-[240px] max-h-[60vh] w-full resize-y overflow-auto rounded-lg border border-[var(--jarvis-border)] bg-[var(--jarvis-card-muted)] px-4 py-3 font-mono text-sm leading-relaxed text-[var(--jarvis-text-strong)] outline-none focus:ring-2 focus:ring-[var(--jarvis-primary)] disabled:cursor-not-allowed disabled:opacity-60'
+                      className='step-objective-textarea h-[360px] min-h-[240px] max-h-[60vh] w-full resize-y overflow-auto rounded-lg border border-[var(--jarvis-border)] bg-[var(--jarvis-card-muted)] px-4 py-3 font-mono text-sm leading-relaxed text-[var(--jarvis-text-strong)] outline-none focus:ring-2 focus:ring-[var(--jarvis-primary)] disabled:cursor-not-allowed disabled:opacity-60'
                       placeholder={STEP_OBJECTIVE_PLACEHOLDER}
                     />
                   </div>
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

---

### Incident Patch 6: `3accaeb7` (2026-09-11)
**Commit Message**: fix(skills): derive name from display title on update, not just create (#571)

toUpdateRequest never included name, so renaming a skill's display title
in the editor silently updated only displayTitle — the immutable name
(and therefore the CLI sync-down folder/frontmatter identity) never
changed, despite the editor preview implying otherwise. Mirror
toCreateRequest by deriving name via slugifySkillName on every save, and
extend validateDraft's empty-slug guard to update drafts too.

**File**: `frontend/src/pages/Skills/skillDraft.test.ts` (modified, +38/-0)
```diff
@@ -12,6 +12,7 @@ import {
   toCreateRequest,
   toUpdateRequest,
   updateSkillMarkdownMetadata,
+  validateDraft,
 } from './skillDraft';
 
 const makeDetail = (overrides: Partial<SkillDetail> = {}): SkillDetail => ({
@@ -357,4 +358,41 @@ future-field:
     expect(createDraft(makeDetail({ alwaysApply: true })).alwaysApply).toBe(true);
     expect(createEmptyDraft('Author').alwaysApply).toBe(false);
   });
+
+  test('derives an update request name from the display title, same as create', () => {
+    const draft = createDraft(makeDetail({ name: 'old-name', displayTitle: 'Old Name' }));
+    draft.markdown = updateSkillMarkdownMetadata(draft.markdown, { displayTitle: 'New Display Title' });
+
+    expect(toUpdateRequest(draft).name).toBe('new-display-title');
+    expect(toUpdateRequest(draft).name).toBe(toCreateRequest(draft).name);
+  });
+});
+
+describe('validateDraft', () => {
+  test('rejects a create draft whose display title has no usable identifier characters', () => {
+    const draft = createEmptyDraft('Author');
+    draft.markdown = updateSkillMarkdownMetadata(draft.markdown, { displayTitle: '!!!', description: 'A description' });
+
+    const result = validateDraft(draft);
+
+    expect(result.valid).toBe(false);
+    if (!result.valid) expect(result.message).toMatch(/skill identifier/);
+  });
+
+  test('rejects an update draft whose renamed display title has no usable identifier characters', () => {
+    const draft = createDraft(makeDetail());
+    draft.markdown = updateSkillMarkdownMetadata(draft.markdown, { displayTitle: '@@@' });
+
+    const result = validateDraft(draft);
+
+    expect(result.valid).toBe(false);
+    if (!result.valid) expect(result.message).toMatch(/skill identifier/);
+  });
+
+  test('accepts an update draft with a valid renamed display title', () => {
+    const draft = createDraft(makeDetail());
+    draft.markdown = updateSkillMarkdownMetadata(draft.markdown, { displayTitle: 'Renamed Skill' });
+
+    expect(validateDraft(draft).valid).toBe(true);
+  });
 });
```

**File**: `frontend/src/pages/Skills/skillDraft.ts` (modified, +2/-1)
```diff
@@ -319,7 +319,7 @@ export const validateDraft = (draft: SkillDraft): DraftValidation => {
   }
   if (parsed.body.length > 100_000) return { valid: false, message: 'Skill instructions are too long.' };
   if (!isSkillCategory(draft.category)) return { valid: false, message: 'Choose a valid category.' };
-  if (draft.id === null && !slugifySkillName(parsed.displayTitle)) {
+  if (!slugifySkillName(parsed.displayTitle)) {
     return { valid: false, message: 'Name must include letters or numbers that can form a skill identifier.' };
   }
 
@@ -343,6 +343,7 @@ export const toCreateRequest = (draft: SkillDraft): CreateSkillRequest => {
 export const toUpdateRequest = (draft: SkillDraft): UpdateSkillRequest => {
   const parsed = draft.markdown.parsed;
   return {
+    name: slugifySkillName(parsed.displayTitle),
     displayTitle: parsed.displayTitle,
     description: parsed.description,
     body: parsed.body,
```

---

### Incident Patch 7: `6bbb9ac7` (2026-09-11)
**Commit Message**: fix: remove race-prone ordered stubs from AgentCore/federation sync tests (#570)

AgentCoreControlExecutor dispatches get_agent_runtime/list_tags_for_resource
calls concurrently via asyncio.to_thread (run_bounded fan-out), but two tests
still used botocore.stub.Stubber, which requires calls in strict FIFO order.
Replace both with a hand-rolled fake control client keyed by request params
(order-independent, same pattern already used elsewhere in this file).

Also relax an over-specified order assertion in
test_vector_cleanup_isolates_per_runtime_delete_failure: run_bounded only
guarantees the returned outcome list preserves input order, not the order
handler side effects execute in.

**File**: `registry/tests/unit/services/test_agentcore_federation_client.py` (modified, +96/-113)
```diff
@@ -69,54 +69,40 @@ def _fake_from_a2a_agent_card(**kwargs):
         assert config.description == "a2a runtime"
         assert config.type == "jsonrpc"
 
-    async def test_discover_runtime_entities_classifies_mcp_and_a2a_with_stubber(self, monkeypatch):
+    async def test_discover_runtime_entities_classifies_mcp_and_a2a(self, monkeypatch):
         client = AgentCoreFederationClient()
 
-        boto_client = boto3.client(
-            "bedrock-agentcore-control",
-            region_name="us-east-1",
-            aws_access_key_id="test",
-            aws_secret_access_key="test",
-        )
-        stubber = Stubber(boto_client)
-        stubber.add_response(
-            "list_agent_runtimes",
+        runtime_summaries = [
             {
-                "agentRuntimes": [
-                    {
-                        "agentRuntimeArn": "arn:aws:bedrock-agentcore:us-east-1:123:runtime/r1",
-                        "agentRuntimeId": "r1",
-                        "agentRuntimeVersion": "1",
-                        "agentRuntimeName": "runtime-mcp",
-                        "description": "mcp runtime",
-                        "lastUpdatedAt": datetime.now(UTC),
-                        "status": "READY",
-                    },
-                    {
-                        "agentRuntimeArn": "arn:aws:bedrock-agentcore:us-east-1:123:runtime/r2",
-                        "agentRuntimeId": "r2",
-                        "agentRuntimeVersion": "2",
-                        "agentRuntimeName": "runtime-a2a",
-                        "description": "a2a runtime",
-                        "lastUpdatedAt": datetime.now(UTC),
-                        "status": "READY",
-                    },
-                    {
-                        "agentRuntimeArn": "arn:aws:bedrock-agentcore:us-east-1:123:runtime/r3",
-                        "agentRuntimeId": "r3",
-                        "agentRuntimeVersion": "1",
-                        "agentRuntimeName": "runtime-http",
-                        "description": "http runtime",
-                        "lastUpdatedAt": datetime.now(UTC),
-                        "status": "READY",
-                    },
-                ]
+                "agentRuntimeArn": "arn:aws:bedrock-agentcore:us-east-1:123:runtime/r1",
+                "agentRuntimeId": "r1",
+                "agentRuntimeVersion": "1",
+                "agentRuntimeName": "runtime-mcp",
+                "description": "mcp runtime",
+                "lastUpdatedAt": datetime.now(UTC),
+                "status": "READY",
             },
-            {"maxResults": 100},
-        )
-        stubber.add_response(
-            "get_agent_runtime",
             {
+                "agentRuntimeArn": "arn:aws:bedrock-agentcore:us-east-1:123:runtime/r2",
+                "agentRuntimeId": "r2",
+                "agentRuntimeVersion": "2",
+                "agentRuntimeName": "runtime-a2a",
+                "description": "a2a runtime",
+                "lastUpdatedAt": datetime.now(UTC),
+                "status": "READY",
+            },
+            {
+                "agentRuntimeArn": "arn:aws:bedrock-agentcore:us-east-1:123:runtime/r3",
+                "agentRuntimeId": "r3",
+                "agentRuntimeVersion": "1",
+                "agentRuntimeName": "runtime-http",
+                "description": "http runtime",
+                "lastUpdatedAt": datetime.now(UTC),
+                "status": "READY",
+            },
+        ]
+        runtime_details_by_id = {
+            "r1": {
                 "agentRuntimeArn": "arn:aws:bedrock-agentcore:us-east-1:123:runtime/r1",
                 "agentRuntimeId": "r1",
                 "agentRuntimeName": "runtime-mcp",
@@ -129,11 +115,7 @@ async def test_discover_runtime_entities_classifies_mcp_and_a2a_with_stubber(sel
                 "lifecycleConfiguration": {"idleRuntimeSessionTimeout": 900, "maxLifetime": 3600},
                 "protocolConfiguration": {"serverProtocol": "MCP"},
             },
-            {"agentRuntimeId": "r1", "agentRuntimeVersion": "1"},
-        )
-        stubber.add_response(
-            "get_agent_runtime",
-            {
+            "r2": {
                 "agentRuntimeArn": "arn:aws:bedrock-agentcore:us-east-1:123:runtime/r2",
                 "agentRuntimeId": "r2",
                 "agentRuntimeName": "runtime-a2a",
@@ -146,11 +128,7 @@ async def test_discover_runtime_entities_classifies_mcp_and_a2a_with_stubber(sel
                 "lifecycleConfiguration": {"idleRuntimeSessionTimeout": 900, "maxLifetime": 3600},
                 "protocolConfiguration": {"serverProtocol": "A2A"},
             },
-            {"agentRuntimeId": "r2", "agentRuntimeVersion": "2"},
-        )
-        stubber.add_response(
-            "get_agent_runtime",
-            {
+            "r3": {
                 "agentRuntimeArn": "arn:aws:bedrock-agentcore:us-east-1:123:runtime/r3",
                 "agentRuntimeId": "r3",
      
```

**File**: `registry/tests/unit/services/test_federation_sync_service.py` (modified, +2/-1)
```diff
@@ -333,7 +333,8 @@ async def _delete(_federation_id: str, runtime_arn: str) -> None:
         [],
     )
 
-    assert attempted == ["arn:mcp:broken", "arn:mcp:healthy"]
+    # run_bounded fans deletes out concurrently, so completion order isn't guaranteed.
+    assert sorted(attempted) == ["arn:mcp:broken", "arn:mcp:healthy"]
     assert errors == ["mcp vector cleanup failed for arn:mcp:broken"]
 
 
```

---

### Incident Patch 8: `a25b5991` (2026-09-10)
**Commit Message**: Fix/as 1838 (#565)

* fix(auth): handle IdP group resolution failures

* fix(auth): harden login gates and error redirects

* fix(frontend): avoid double-decoding login errors

* Fix code review by Copilot

* Fix code review by Copilot

* fix: finding m1

**File**: `auth-server/src/auth_server/providers/base.py` (modified, +11/-0)
```diff
@@ -8,6 +8,17 @@
 logger = logging.getLogger(__name__)
 
 
+def log_group_resolution_failure(provider: str, identifier: str, exc: Exception) -> None:
+    """Log an IdP group-source-of-truth outage with one consistent, greppable signature."""
+    logger.error(
+        "Group resolution failed for provider=%s identifier=%s; proceeding with empty groups: %s",
+        provider,
+        identifier,
+        exc,
+        exc_info=True,
+    )
+
+
 class AuthProvider(ABC):
     """Abstract base class for authentication providers."""
 
```

**File**: `auth-server/src/auth_server/providers/entra.py` (modified, +9/-5)
```diff
@@ -17,7 +17,7 @@
 )
 
 from ..core.config import settings
-from .base import AuthProvider
+from .base import AuthProvider, log_group_resolution_failure
 
 # Get logger - logging is configured centrally in server.py via settings.configure_logging()
 logger = logging.getLogger(__name__)
@@ -355,11 +355,13 @@ async def _fetch_user_info_from_graph(self, access_token: str) -> dict[str, Any]
             logger.error(f"Failed to fetch user info from Graph API: {e}")
             raise ValueError(f"Graph API request failed: {e}")
 
-    async def get_user_groups(self, access_token: str) -> list:
+    async def get_user_groups(self, access_token: str, identifier: str) -> list:
         """Get user's group memberships from Microsoft Graph API.
 
         Args:
             access_token: OAuth2 access token
+            identifier: Email/username of the user, used only to identify the user in logs
+                when the group lookup fails.
 
         Returns:
             List of group display names
@@ -380,8 +382,8 @@ async def get_user_groups(self, access_token: str) -> list:
             logger.info(f"Retrieved {groups} groups for user")
             return groups
 
-        except Exception as e:
-            logger.warning(f"Failed to fetch user groups: {e}")
+        except Exception as exc:
+            log_group_resolution_failure("entra", identifier, exc)
             return []
 
     async def get_user_info(self, access_token: str, id_token: str | None = None) -> dict[str, Any]:
@@ -428,7 +430,9 @@ async def get_user_info(self, access_token: str, id_token: str | None = None) ->
                 user_info = await self._fetch_user_info_from_graph(access_token)
 
             # Get user groups separately using access_token (required for Graph API)
-            groups = await self.get_user_groups(access_token)
+            groups = await self.get_user_groups(
+                access_token, user_info.get("email") or user_info.get("username") or "unknown"
+            )
             user_info["groups"] = groups
 
             logger.info(f"User info retrieved: {user_info.get('username')} with {len(groups)} groups")
```

**File**: `auth-server/src/auth_server/providers/google.py` (modified, +6/-2)
```diff
@@ -15,7 +15,7 @@
 )
 from registry_pkgs.google.cloud_identity_client import CloudIdentityGroupsClient
 
-from .base import AuthProvider
+from .base import AuthProvider, log_group_resolution_failure
 
 logger = logging.getLogger(__name__)
 
@@ -148,7 +148,11 @@ async def get_user_info(self, access_token: str, id_token: str | None = None) ->
                 f"Domain '{claims.get('hd')}' is not the allowed domain '{self.allowed_hd}'"
             )
 
-        groups = await self._cloud_identity_client.list_transitive_groups_for_member(email)
+        try:
+            groups = await self._cloud_identity_client.list_transitive_groups_for_member(email)
+        except Exception as exc:
+            log_group_resolution_failure("google", email, exc)
+            groups = []
 
         return {
             "username": email,
```

**File**: `auth-server/src/auth_server/routes/oauth_flow.py` (modified, +50/-5)
```diff
@@ -100,6 +100,16 @@
 _REDIRECT_ERROR_CONSENT_FLOW_TYPE = "redirect_error"
 
 
+class NoScopesResolvedError(Exception):
+    """A browser login resolved zero scopes for the user's own account.
+
+    Covers both a genuinely group-less user and an IdP group-lookup failure — both already
+    produce ``default_user_scopes == []`` upstream, and the correct browser-facing action is
+    identical either way: reject the login with an explanation instead of minting a
+    zero-privilege session.
+    """
+
+
 class _RedirectValidationError(NamedTuple):
     error: str
     error_description: str
@@ -385,6 +395,15 @@ def _finish_oauth2_callback(
     return response
 
 
+def _redirect_to_login_error(message: str) -> RedirectResponse:
+    """Redirect to the frontend's /login page with a finished, human-readable error message."""
+    response = RedirectResponse(
+        url=f"{settings.registry_error_redirect}?{urlencode({'error': message})}", status_code=302
+    )
+    response.delete_cookie(settings.oauth2_temp_session_cookie_name)
+    return response
+
+
 def _redirect_error_to_client(
     redirect_uri: str,
     error: str,
@@ -1088,15 +1107,16 @@ async def oauth2_callback(
     pending_store: PendingConsentStore = Depends(get_pending_consent_store),
     is_https: bool = Depends(check_if_https),
 ):
-    error_url = settings.registry_error_redirect
     is_device_flow = False
     device_code: str | None = None
 
     try:
         if error is not None:
             logger.error(f"OAuth2 error from {provider}: {error}")
 
-            return RedirectResponse(url=f"{error_url}?error=oauth2_error&details={error}", status_code=302)
+            return _redirect_to_login_error(
+                "Sign-in was cancelled or failed at the identity provider. Please try again."
+            )
 
         if code is None or state is None or oauth2_temp_session is None:
             return JSONResponse({"detail": "Missing required OAuth2 parameters"}, 400)
@@ -1185,6 +1205,18 @@ async def oauth2_callback(
 
             mapped_user = map_user_info(user_info, provider_config)
 
+            if provider == "google":
+                # The generic userinfo path never enforces the login gate that
+                # GoogleProvider.get_user_info applies, so re-check it here on the raw
+                # userinfo JSON (email_verified / hd) before minting a session.
+                if user_info.get("email_verified") is not True:
+                    raise GoogleEmailNotVerifiedError(f"Email not verified for {mapped_user.get('email')}")
+                allowed_hd = provider_config.get("allowed_hd")
+                if allowed_hd and user_info.get("hd") != allowed_hd:
+                    raise GoogleDomainNotAllowedError(
+                        f"Domain '{user_info.get('hd')}' is not the allowed domain '{allowed_hd}'"
+                    )
+
         # Resolve user_id from MongoDB and add to mapped_user
         user_id = await user_service.resolve_user_id(mapped_user)
         if user_id:
@@ -1244,6 +1276,12 @@ async def oauth2_callback(
             # Client did not request specific scopes, use default user scopes
             resolved_scopes = default_user_scopes
             logger.info(f"No scope requested, using default user scopes: {resolved_scopes}")
+            if not resolved_scopes and not is_device_flow:
+                logger.warning(
+                    f"Login blocked: user {mapped_user['username']} resolved zero scopes "
+                    f"(provider={provider}, groups={user_groups})"
+                )
+                raise NoScopesResolvedError
 
         if is_device_flow:
             if not isinstance(device_code, str) or device_data is None:
@@ -1293,10 +1331,17 @@ async def oauth2_callback(
 
     except GoogleEmailNotVerifiedError:
         logger.warning(f"Google login rejected: email not verified (provider={provider})")
-        return RedirectResponse(url=f"{error_url}?error=google_email_unverified", status_code=302)
+        return _redirect_to_login_error(
+            "Your Google email address is not verified. Please verify it with Google and try again."
+        )
     except GoogleDomainNotAllowedError:
         logger.warning(f"Google login rejected: domain not allowed (provider={provider})")
-        return RedirectResponse(url=f"{error_url}?error=google_domain_not_allowed", status_code=302)
+        return _redirect_to_login_error("This Google account's organization is not authorized to sign in here.")
+    except NoScopesResolvedError:
+        return _redirect_to_login_error(
+            "You've signed in successfully, but no permissions are currently assigned to your "
+            "account yet. Contact your administrator to be added to a group."
+        )
     except Exception:
         logger.exception(f"Error in OAuth2 callback for {provider}")
 
@@ -1314,7 +1359,7 @@ async def oauth2_callback(
             response.delete_cookie(settings.oauth2_temp_session_cookie_name)
 
```

**File**: `auth-server/tests/integration/test_oauth_callback_token_flow.py` (modified, +134/-12)
```diff
@@ -74,14 +74,14 @@ def test_oauth_callback_always_generates_authorization_code(
             "preferred_username": "testuser",
             "email": "test@example.com",
             "name": "Test User",
-            "groups": ["user-group"],
+            "groups": ["jarvis-registry-admin"],
         }
         mock_get_user_info.return_value = {
             "sub": "provider-user-123",
             "preferred_username": "testuser",
             "email": "test@example.com",
             "name": "Test User",
-            "groups": ["user-group"],
+            "groups": ["jarvis-registry-admin"],
         }
 
         oauth2_config = {
@@ -195,14 +195,14 @@ def test_oauth_callback_external_client_with_client_id(
             "preferred_username": "externaluser",
             "email": "external@example.com",
             "name": "External User",
-            "groups": ["external-group"],
+            "groups": ["jarvis-registry-admin"],
         }
         mock_get_user_info.return_value = {
             "sub": "provider-user-456",
             "preferred_username": "externaluser",
             "email": "external@example.com",
             "name": "External User",
-            "groups": ["external-group"],
+            "groups": ["jarvis-registry-admin"],
         }
 
         oauth2_config = {
@@ -299,7 +299,7 @@ def test_oauth_callback_keycloak_id_token_parsing(
             "preferred_username": "keycloakuser",
             "email": "keycloak@example.com",
             "name": "Keycloak User",
-            "groups": ["/admin", "/users"],
+            "groups": ["jarvis-registry-admin", "/users"],
         }
 
         oauth2_config = {
@@ -369,7 +369,7 @@ def test_oauth_callback_keycloak_id_token_parsing(
             user_info = code_data["user_info"]
             assert user_info["username"] == "keycloakuser"
             assert user_info["email"] == "keycloak@example.com"
-            assert user_info["groups"] == ["/admin", "/users"]
+            assert user_info["groups"] == ["jarvis-registry-admin", "/users"]
             assert user_info["idp_id"] == "keycloak-sub-789"
 
     @patch("auth_server.routes.oauth_flow.exchange_code_for_token")
@@ -445,7 +445,7 @@ def test_oauth_callback_rejects_invalid_token_signature(
             )
 
         assert response.status_code == 302
-        assert "oauth2_callback_failed" in response.headers["location"]
+        assert "Something+went+wrong+during+sign-in" in response.headers["location"]
         mock_get_user_info.assert_not_called()
 
     @patch("auth_server.routes.oauth_flow.exchange_code_for_token")
@@ -518,7 +518,7 @@ def test_oauth_callback_rejects_invalid_token_signature_entra(
             )
 
         assert response.status_code == 302
-        assert "oauth2_callback_failed" in response.headers["location"]
+        assert "Something+went+wrong+during+sign-in" in response.headers["location"]
         mock_get_user_info.assert_not_called()
 
     def _run_google_gate_callback(
@@ -596,12 +596,134 @@ def _run_google_gate_callback(
     def test_oauth_callback_google_unverified_email_redirects(self, clear_device_storage, mock_user_service):
         response = self._run_google_gate_callback(GoogleEmailNotVerifiedError("email not verified"), mock_user_service)
         assert response.status_code == 302
-        assert "error=google_email_unverified" in response.headers["location"]
+        assert "Your+Google+email+address+is+not+verified" in response.headers["location"]
 
     def test_oauth_callback_google_domain_not_allowed_redirects(self, clear_device_storage, mock_user_service):
         response = self._run_google_gate_callback(GoogleDomainNotAllowedError("domain not allowed"), mock_user_service)
         assert response.status_code == 302
-        assert "error=google_domain_not_allowed" in response.headers["location"]
+        assert "organization+is+not+authorized" in response.headers["location"]
+
+    @staticmethod
+    def _google_oauth2_config() -> dict:
+        return {
+            "providers": {
+                "google": {
+                    "enabled": True,
+                    "client_id": "test-client",
+                    "client_secret": "test-secret",
+                    "token_url": "http://google/token",
+                    "user_info_url": "http://google/userinfo",
+                    "username_claim": "email",
+                    "email_claim": "email",
+                    "name_claim": "name",
+                    "groups_claim": None,
+                    "allowed_hd": "corp.example",
+                }
+            }
+        }
+
+    def _drive_google_callback(self, mock_google_provider, mock_user_service, module_get_user_info=None):
+        """Drive a browser (non-device) Google callback with the given provider mock and return
+        the 302 response. When ``module_get_user_info`` is set, the module-level ``get_user_info``
+        fallback is patched to return it."""
+        with (
+            patch("auth
```

**File**: `auth-server/tests/unit/test_consent_routes.py` (modified, +3/-3)
```diff
@@ -504,7 +504,7 @@ def test_oauth_callback_without_client_consent_redirects_to_consent(
         "preferred_username": "alice",
         "email": "alice@example.com",
         "name": "Alice",
-        "groups": [],
+        "groups": ["jarvis-registry-admin"],
     }
 
     client.app.dependency_overrides[get_oauth2_config] = _oauth2_config
@@ -556,7 +556,7 @@ def test_oauth_callback_with_cached_client_consent_skips_consent(
         "preferred_username": "alice",
         "email": "alice@example.com",
         "name": "Alice",
-        "groups": [],
+        "groups": ["jarvis-registry-admin"],
     }
 
     client.app.dependency_overrides[get_oauth2_config] = _oauth2_config
@@ -607,7 +607,7 @@ def test_oauth_callback_registry_client_skips_consent(
         "preferred_username": "alice",
         "email": "alice@example.com",
         "name": "Alice",
-        "groups": [],
+        "groups": ["jarvis-registry-admin"],
     }
 
     client.app.dependency_overrides[get_oauth2_config] = _oauth2_config
```

**File**: `auth-server/tests/unit/test_entra_provider.py` (modified, +45/-0)
```diff
@@ -72,3 +72,48 @@ async def test_get_user_info_rejects_invalid_id_token_signature(self):
                 await provider.get_user_info("access-token", id_token="id-token")
 
         provider.get_user_groups.assert_not_called()
+
+
+@pytest.mark.unit
+@pytest.mark.auth
+class TestEntraGetUserGroups:
+    @pytest.mark.asyncio
+    async def test_get_user_groups_failure_returns_empty_and_logs(self):
+        provider = _provider()
+
+        with (
+            patch("auth_server.providers.entra.httpx.AsyncClient", side_effect=RuntimeError("graph down")),
+            patch("auth_server.providers.entra.log_group_resolution_failure") as mock_log,
+        ):
+            groups = await provider.get_user_groups("access-token", "user@example.com")
+
+        assert groups == []
+        mock_log.assert_called_once()
+        args = mock_log.call_args.args
+        assert args[0] == "entra"
+        assert args[1] == "user@example.com"
+        assert isinstance(args[2], RuntimeError)
+
+    @pytest.mark.asyncio
+    async def test_get_user_info_passes_identifier_to_get_user_groups(self):
+        provider = _provider()
+        provider.get_jwks = AsyncMock(return_value={"keys": [{"kid": "kid-1"}]})
+        provider.get_user_groups = AsyncMock(return_value=[])
+
+        verified_claims = {
+            "preferred_username": "verified@example.com",
+            "email": "verified@example.com",
+            "name": "Verified User",
+            "oid": "verified-oid",
+        }
+
+        with (
+            patch("auth_server.providers.entra.settings") as mock_settings,
+            patch("auth_server.providers.entra.get_token_kid", return_value="kid-1"),
+            patch("auth_server.providers.entra.decode_jwt_unverified", return_value={"iss": provider.issuer_v2}),
+            patch("auth_server.providers.entra.decode_jwt_with_jwk", return_value=verified_claims),
+        ):
+            mock_settings.entra_token_kind = "id"
+            await provider.get_user_info("access-token", id_token="id-token")
+
+        provider.get_user_groups.assert_awaited_once_with("access-token", "verified@example.com")
```

**File**: `auth-server/tests/unit/test_google_provider.py` (modified, +16/-0)
```diff
@@ -63,6 +63,22 @@ async def test_returns_group_local_parts_from_cloud_identity(self):
             "groups": ["eng", "all"],
         }
 
+    @pytest.mark.asyncio
+    async def test_cloud_identity_failure_returns_empty_groups_and_logs(self):
+        """A Cloud Identity outage must degrade to empty groups (not raise), so it never reaches
+        oauth_flow's generic userinfo fallback."""
+        provider = _provider()
+        provider._verify_id_token = AsyncMock(return_value=_claims())
+        exc = RuntimeError("cloud identity down")
+        provider._cloud_identity_client.list_transitive_groups_for_member = AsyncMock(side_effect=exc)
+
+        with patch("auth_server.providers.google.log_group_resolution_failure") as mock_log:
+            info = await provider.get_user_info("access-token", id_token="id-token")
+
+        assert info["email"] == "user@example.com"
+        assert info["groups"] == []
+        mock_log.assert_called_once_with("google", "user@example.com", exc)
+
     @pytest.mark.asyncio
     async def test_rejects_unverified_email_before_group_lookup(self):
         provider = _provider()
```

---

### Incident Patch 9: `0a860d90` (2026-09-09)
**Commit Message**: fix: adjust skill frontmatter rendering in frontend (#562)

- Do NOT display `null`-valued fields, e.g. `allowed-tools: null`
    no longer shows up.
  - Make sure `name` is always first and `description` is always
    second. The rest are not explicitly ordered.

**File**: `frontend/src/pages/Skills/skillDraft.test.ts` (modified, +34/-2)
```diff
@@ -8,6 +8,7 @@ import {
   createEmptyDraft,
   createSkillMarkdownState,
   parseSkillMarkdown,
+  splitSkillMarkdown,
   toCreateRequest,
   toUpdateRequest,
   updateSkillMarkdownMetadata,
@@ -93,10 +94,41 @@ describe('composeSkillMarkdown', () => {
     expect(parseSkillMarkdown(markdown).frontmatter['allowed-tools']).toBe('');
   });
 
-  test('leaves a null allowedTools (no tool restriction) as YAML null, not an empty string', () => {
+  test('omits a null allowedTools (no tool restriction) entirely, rather than rendering it as null', () => {
     const markdown = composeSkillMarkdown(makeDetail({ allowedTools: null }));
 
-    expect(parseSkillMarkdown(markdown).frontmatter['allowed-tools']).toBeNull();
+    expect(markdown).not.toContain('allowed-tools');
+    expect(parseSkillMarkdown(markdown).frontmatter).not.toHaveProperty('allowed-tools');
+  });
+
+  test('omits any other explicitly-null frontmatter field entirely', () => {
+    const markdown = composeSkillMarkdown(
+      makeDetail({ frontmatter: { license: null, argumentHint: null, custom: 'kept' } }),
+    );
+
+    const parsed = parseSkillMarkdown(markdown);
+    expect(parsed.frontmatter).not.toHaveProperty('license');
+    expect(parsed.frontmatter).not.toHaveProperty('argument-hint');
+    expect(parsed.frontmatter.custom).toBe('kept');
+  });
+
+  test('always renders name first and description second, regardless of collection order', () => {
+    const markdown = composeSkillMarkdown(
+      makeDetail({
+        frontmatter: {
+          license: 'MIT',
+          allowedTools: ['Read'],
+          argumentHint: '[pull-request]',
+        },
+      }),
+    );
+
+    const frontmatterKeys = splitSkillMarkdown(markdown)
+      .frontmatterSource.split('\n')
+      .filter(line => /^[A-Za-z-]+:/.test(line))
+      .map(line => line.split(':')[0]);
+
+    expect(frontmatterKeys.slice(0, 2)).toEqual(['name', 'description']);
   });
 
   test('renders every other array-valued frontmatter field in YAML flow style', () => {
```

**File**: `frontend/src/pages/Skills/skillDraft.ts` (modified, +18/-7)
```diff
@@ -133,6 +133,11 @@ const toKebabCaseFrontmatter = (frontmatter: { [key: string]: JsonValue }): { [k
     Object.entries(frontmatter).map(([key, value]) => [CLAUDE_CODE_FRONTMATTER_KEBAB_KEYS[key] ?? key, value]),
   );
 
+// A null field (e.g. allowedTools with no restriction) means "not set", matching the backend's
+// `exclude_none=True` dump and the CLI's `omitempty` — so it's dropped rather than rendered as `null`.
+const dropNullFrontmatterFields = (frontmatter: { [key: string]: JsonValue }): { [key: string]: JsonValue } =>
+  Object.fromEntries(Object.entries(frontmatter).filter(([, value]) => value !== null));
+
 // Renders `allowed-tools` as a plain space-joined string instead of a YAML list (Claude Code's own
 // preferred style for this field) and every other array-valued field in flow style (`[a, b]`) instead of
 // YAML's default block list style, without changing the parsed value of either.
@@ -203,25 +208,31 @@ export const composeSkillMarkdown = (detail: SkillDetail): string => {
   const inlineBody = parseInlineBodyFrontmatter(detail.body);
   const inlineFrontmatter = normalizeFrontmatterKeys(inlineBody.frontmatter);
   const storedFrontmatter = normalizeFrontmatterKeys(detail.frontmatter);
-  const frontmatter: { [key: string]: JsonValue } = {
+  const rest: { [key: string]: JsonValue } = {
     ...inlineFrontmatter,
     ...storedFrontmatter,
   };
 
-  for (const key of REGISTRY_BOOKKEEPING_FRONTMATTER_KEYS) delete frontmatter[key];
-  frontmatter.name = getSkillDisplayName(detail);
-  frontmatter.description = detail.description;
-  frontmatter.allowedTools =
+  for (const key of REGISTRY_BOOKKEEPING_FRONTMATTER_KEYS) delete rest[key];
+  rest.allowedTools =
     firstDefined(storedFrontmatter.allowedTools, detail.allowedTools, inlineFrontmatter.allowedTools) ?? null;
-  frontmatter.disableModelInvocation =
+  rest.disableModelInvocation =
     firstDefined(
       storedFrontmatter.disableModelInvocation,
       detail.disableModelInvocation,
       inlineFrontmatter.disableModelInvocation,
     ) ?? false;
-  frontmatter.userInvocable =
+  rest.userInvocable =
     firstDefined(storedFrontmatter.userInvocable, detail.userInvocable, inlineFrontmatter.userInvocable) ?? true;
 
+  // name and description always lead the rendered frontmatter; every other field follows in
+  // whatever order it was collected in.
+  const frontmatter: { [key: string]: JsonValue } = {
+    name: getSkillDisplayName(detail),
+    description: detail.description,
+    ...dropNullFrontmatterFields(rest),
+  };
+
   const yaml = stringifyFrontmatterYaml(toKebabCaseFrontmatter(frontmatter));
   const body = inlineBody.body ? `\n${inlineBody.body.replace(/^\n+/, '')}` : '';
   return `---\n${yaml}\n---${body}`;
```

---

### Incident Patch 10: `0fcd631d` (2026-09-08)
**Commit Message**: fix: warn before triggering workflows with unsaved changes (#558)

* fix: warn before triggering workflows with unsaved changes

* feat: apply Change 3 and Change 4

  - To close a potential gap in the future. Currently the code has
    no bug.

---------

Co-authored-by: kxue43 <[REDACTED_EMAIL]>

**File**: `frontend/src/components/WorkflowCanvas/index.tsx` (modified, +2/-1)
```diff
@@ -63,7 +63,8 @@ const WorkflowCanvasInner = forwardRef<WorkflowCanvasRef, WorkflowCanvasProps>(
 
     useImperativeHandle(ref, () => ({
       save: () => {
-        if (!isReadOnly) onSave?.(canvas.nodes, canvas.edges, reactFlow.getViewport());
+        if (isReadOnly || !onSave) return Promise.resolve(false);
+        return onSave(canvas.nodes, canvas.edges, reactFlow.getViewport());
       },
       getElements: () => ({ nodes: canvas.nodes, edges: canvas.edges }),
       clearSelection: canvas.clearSelection,
```

**File**: `frontend/src/components/WorkflowCanvas/types.ts` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@ import type { Workflow, WorkflowRunStatusResponse } from '@/services/workflow/ty
 export type PanelMode = 'node' | 'workflow';
 
 export interface WorkflowCanvasRef {
-  save: () => void;
+  save: () => Promise<boolean>;
   getElements: () => { nodes: WorkflowNode[]; edges: Edge[] };
   clearSelection: () => void;
   /** Toggle panel: expand if collapsed, collapse if expanded and workflow mode */
@@ -25,7 +25,7 @@ export interface WorkflowCanvasProps {
   isNewWorkflow: boolean;
   onDeleteWorkflow: () => void;
   onWorkflowChange: (patch: Partial<Pick<Workflow, 'name' | 'description'>>) => void;
-  onSave?: (nodes: WorkflowNode[], edges: Edge[], viewport: { x: number; y: number; zoom: number }) => void;
+  onSave?: (nodes: WorkflowNode[], edges: Edge[], viewport: { x: number; y: number; zoom: number }) => Promise<boolean>;
 }
 
 /** Base node data */
```

**File**: `frontend/src/pages/WorkflowRegistryOrEdit/TriggerUnsavedChangesDialog.tsx` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+import { Dialog, Transition } from '@headlessui/react';
+import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
+import type React from 'react';
+import { Fragment } from 'react';
+
+interface TriggerUnsavedChangesDialogProps {
+  isOpen: boolean;
+  saving: boolean;
+  onCancel: () => void;
+  onContinueWithoutSaving: () => void;
+  onSaveAndContinue: () => Promise<void>;
+}
+
+const TriggerUnsavedChangesDialog: React.FC<TriggerUnsavedChangesDialogProps> = ({
+  isOpen,
+  saving,
+  onCancel,
+  onContinueWithoutSaving,
+  onSaveAndContinue,
+}) => {
+  const handleClose = () => {
+    if (!saving) onCancel();
+  };
+
+  return (
+    <Transition appear show={isOpen} as={Fragment}>
+      <Dialog as='div' className='relative z-50' onClose={handleClose}>
+        <Transition.Child
+          as={Fragment}
+          enter='ease-out duration-200'
+          enterFrom='opacity-0'
+          enterTo='opacity-100'
+          leave='ease-in duration-150'
+          leaveFrom='opacity-100'
+          leaveTo='opacity-0'
+        >
+          <div className='fixed inset-0 bg-black/25' />
+        </Transition.Child>
+
+        <div className='fixed inset-0 overflow-y-auto'>
+          <div className='flex min-h-full items-center justify-center p-4'>
+            <Transition.Child
+              as={Fragment}
+              enter='ease-out duration-200'
+              enterFrom='opacity-0 scale-95'
+              enterTo='opacity-100 scale-100'
+              leave='ease-in duration-150'
+              leaveFrom='opacity-100 scale-100'
+              leaveTo='opacity-0 scale-95'
+            >
+              <Dialog.Panel className='w-full max-w-lg transform overflow-hidden rounded-xl bg-[var(--jarvis-card)] p-6 shadow-xl transition-all'>
+                <div className='mb-4 flex items-center gap-3'>
+                  <div className='flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--jarvis-warning-soft)]'>
+                    <ExclamationTriangleIcon className='h-5 w-5 text-[var(--jarvis-warning-text)]' />
+                  </div>
+                  <Dialog.Title as='h3' className='text-lg font-semibold text-[var(--jarvis-text-strong)]'>
+                    Unsaved changes
+                  </Dialog.Title>
+                </div>
+
+                <Dialog.Description className='mb-6 text-sm text-[var(--jarvis-text)]'>
+                  This workflow has unsaved edits. Continuing without saving will run the last saved version, not the
+                  changes currently on screen.
+                </Dialog.Description>
+
+                <div className='flex flex-col-reverse justify-end gap-2 sm:flex-row'>
+                  <button
+                    type='button'
+                    onClick={onCancel}
+                    disabled={saving}
+                    className='rounded-lg bg-[var(--jarvis-card-muted)] px-4 py-2 text-sm font-medium text-[var(--jarvis-text)] transition-colors hover:bg-[var(--jarvis-surface)] disabled:cursor-not-allowed disabled:opacity-50'
+                  >
+                    Cancel
+                  </button>
+                  <button
+                    type='button'
+                    onClick={onContinueWithoutSaving}
+                    disabled={saving}
+                    className='rounded-lg border border-[var(--jarvis-border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--jarvis-text)] transition-colors hover:bg-[var(--jarvis-card-muted)] disabled:cursor-not-allowed disabled:opacity-50'
+                  >
+                    Continue without saving
+                  </button>
+                  <button
+                    type='button'
+                    onClick={() => void onSaveAndContinue()}
+                    disabled={saving}
+                    className='inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--jarvis-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--jarvis-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50'
+                  >
+                    {saving && (
+                      <span className='h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-b-white' />
+                    )}
+                    Save and continue
+                  </button>
+                </div>
+              </Dialog.Panel>
+            </Transition.Child>
+          </div>
+        </div>
+      </Dialog>
+    </Transition>
+  );
+};
+
+export default TriggerUnsavedChangesDialog;
```

**File**: `frontend/src/pages/WorkflowRegistryOrEdit/index.tsx` (modified, +67/-15)
```diff
@@ -18,15 +18,16 @@ import { useGlobal } from '@/contexts/GlobalContext';
 import { useServer } from '@/contexts/ServerContext';
 import SERVICES from '@/services';
 import type {
+  WorkflowNode as ApiWorkflowNode,
   PendingAuthorization,
   TriggerWorkflowRunRequest,
-  WorkflowNode as ApiWorkflowNode,
   Workflow,
 } from '@/services/workflow/type';
 import DeleteWorkflowDialog from './DeleteWorkflowDialog';
 import { useActiveWorkflowRun } from './hooks/useActiveWorkflowRun';
 import { useWorkflowDraftGuard } from './hooks/useWorkflowDraftGuard';
 import TriggerRunModal from './TriggerRunModal';
+import TriggerUnsavedChangesDialog from './TriggerUnsavedChangesDialog';
 import UnsavedChangesDialog from './UnsavedChangesDialog';
 import WorkflowReauthModal from './WorkflowReauthModal';
 
@@ -79,29 +80,34 @@ const WorkflowRegistryOrEdit: React.FC = () => {
   // ── 4. Dirty Checking & UI State ───────────────────────────────────────────────
   const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
   const [triggerModalOpen, setTriggerModalOpen] = useState(false);
+  const [unsavedTriggerDialogOpen, setUnsavedTriggerDialogOpen] = useState(false);
   const [reauthModalOpen, setReauthModalOpen] = useState(false);
   const [pendingWorkflowReauth, setPendingWorkflowReauth] = useState<PendingWorkflowReauth | null>(null);
   const [shareOpen, setShareOpen] = useState(false);
   const [runHistoryRefresh, setRunHistoryRefresh] = useState(0);
   const canShareWorkflow = isEditMode && isExistingDetailReady && workflow?.permissions?.SHARE === true;
   const activeWorkflowRun = useActiveWorkflowRun(id ?? undefined, message => showToast(message, 'error'));
+  const activeWorkflowRunLockedRef = useRef(activeWorkflowRun.isLocked);
+  activeWorkflowRunLockedRef.current = activeWorkflowRun.isLocked;
 
   useEffect(() => {
-    if (activeWorkflowRun.isLocked) setTriggerModalOpen(false);
+    if (!activeWorkflowRun.isLocked) return;
+    setTriggerModalOpen(false);
+    setUnsavedTriggerDialogOpen(false);
   }, [activeWorkflowRun.isLocked]);
 
   // ── Side Effects: Save shortcut (Cmd+S / Ctrl+S) ───────────────────────────────
   useEffect(() => {
-    if (isReadOnly || mutatingAction !== 'idle' || existingDetailUnavailable) return;
+    if (isReadOnly || mutatingAction !== 'idle' || existingDetailUnavailable || unsavedTriggerDialogOpen) return;
     const handleKeyDown = (e: KeyboardEvent) => {
       if ((e.metaKey || e.ctrlKey) && e.key === 's') {
         e.preventDefault();
-        canvasRef.current?.save();
+        void canvasRef.current?.save();
       }
     };
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
-  }, [existingDetailUnavailable, isReadOnly, mutatingAction]);
+  }, [existingDetailUnavailable, isReadOnly, mutatingAction, unsavedTriggerDialogOpen]);
 
   // ── Fetch Initial Data ─────────────────────────────────────────────────────────
   useEffect(() => {
@@ -197,35 +203,35 @@ const WorkflowRegistryOrEdit: React.FC = () => {
     nodes: CanvasWorkflowNode[],
     edges: Edge[],
     viewport: { x: number; y: number; zoom: number },
-  ) => {
-    if (isReadOnly) return;
+  ): Promise<boolean> => {
+    if (isReadOnly) return false;
     if (existingDetailUnavailable) {
       showToast(detailLoadError ?? 'Workflow details are not ready', 'error');
-      return;
+      return false;
     }
     const canvasValidationError = validateCanvasNodes(nodes, edges);
     if (canvasValidationError) {
       showToast(canvasValidationError, 'error');
-      return;
+      return false;
     }
 
     let apiNodes: ReturnType<typeof canvasToApiNodes>;
     try {
       apiNodes = canvasToApiNodes(nodes, edges);
     } catch (error) {
       showToast(error instanceof Error ? error.message : 'Failed to convert workflow', 'error');
-      return;
+      return false;
     }
 
     if (apiNodes.length === 0) {
       showToast('Add at least one node before saving', 'error');
-      return;
+      return false;
     }
 
     const validationError = validateApiNodes(apiNodes);
     if (validationError) {
       showToast(validationError, 'error');
-      return;
+      return false;
     }
 
     // validateApiNodes guarantees no unresolved gate placeholders remain past this point.
@@ -246,8 +252,9 @@ const WorkflowRegistryOrEdit: React.FC = () => {
         });
         handleWorkflowUpdate(id, { nodeCount: updated.numNodes ?? validatedNodes.length, name: workflow?.name });
         markSaved(submittedMetadata, nodes, edges, workflow);
-        setWorkflow(current => (current === workflow && current ? { ...current, ...submittedMetadata } : current));
+        setWorkflow(current => (current === workflow && current ? { ...current, ...updated } : current));
         showToast('Workflow updated successfully!', 'success');
+        return true;
       } else {
         const submittedMetadata = {
           name: workflow?.name?.trim
```

**File**: `frontend/src/services/workflow/index.ts` (modified, +4/-2)
```diff
@@ -24,8 +24,10 @@ const getWorkflowDetail = async (id: string): Promise<TYPE.GetWorkflowDetailResp
 const createWorkflow = async (data: TYPE.CreateWorkflowRequest): Promise<TYPE.CreateWorkflowResponse> =>
   await Request.post(API.createWorkflow, data);
 
-const updateWorkflow = async (id: string, data: TYPE.UpdateWorkflowRequest): Promise<TYPE.UpdateWorkflowResponse> =>
-  await Request.put(API.updateWorkflow(id), data);
+const updateWorkflow = async (id: string, data: TYPE.UpdateWorkflowRequest): Promise<TYPE.UpdateWorkflowResponse> => {
+  const response = await Request.put(API.updateWorkflow(id), data);
+  return { ...response, permissions: response?.aclPermission ?? EMPTY_WORKFLOW_PERMISSIONS };
+};
 
 const deleteWorkflow = async (id: string): Promise<void> => await Request.delete(API.deleteWorkflow(id));
 
```

---

### Incident Patch 11: `d947250a` (2026-09-08)
**Commit Message**: fix(auth): enforce client-declared grant types during DCR (#557)

**File**: `auth-server/src/auth_server/routes/oauth_flow.py` (modified, +11/-1)
```diff
@@ -17,7 +17,11 @@
 from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
 from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
 
-from registry_pkgs.core.client_categories import ClientCategory, resolve_granted_scopes
+from registry_pkgs.core.client_categories import (
+    AUTHORIZATION_CODE_GRANT_TYPE,
+    ClientCategory,
+    resolve_granted_scopes,
+)
 from registry_pkgs.core.consent_store import PENDING_CONSENT_TTL_SECONDS, ConsentStore, PendingConsentStore
 from registry_pkgs.core.downstream_oauth import (
     DEVICE_CODE_GRANT_TYPE,
@@ -239,6 +243,12 @@ def _validate_known_client_for_redirect(
     if not _is_registered_redirect_uri(client_metadata, redirect_uri):
         return _RedirectValidationError("invalid_request", "redirect_uri is not registered for this client")
 
+    if AUTHORIZATION_CODE_GRANT_TYPE not in (client_metadata.get("grant_types") or []):
+        return _RedirectValidationError(
+            "unauthorized_client",
+            f"client is not authorized for {AUTHORIZATION_CODE_GRANT_TYPE}",
+        )
+
     return None
 
 
```

**File**: `auth-server/src/auth_server/services/client_registration_service.py` (modified, +18/-1)
```diff
@@ -40,6 +40,22 @@ def _validate_redirect_uris(redirect_uris: list[str] | None) -> list[str]:
     return uris
 
 
+def _resolve_grant_types(
+    requested_grant_types: list[str] | None,
+    allowed_grant_types: tuple[str, ...],
+) -> list[str]:
+    if requested_grant_types is None:
+        return list(allowed_grant_types)
+
+    grant_types = [grant_type for grant_type in allowed_grant_types if grant_type in requested_grant_types]
+    if not grant_types:
+        raise ClientRegistrationError(
+            "invalid_client_metadata",
+            "none of the requested grant_types are supported",
+        )
+    return grant_types
+
+
 class ClientRegistrationService:
     """Register MCP and A2A OAuth clients under their category policy."""
 
@@ -59,6 +75,7 @@ def register(
             raise RuntimeError(f"DCR policy is not configured for category {category}")
 
         redirect_uris = _validate_redirect_uris(registration.redirect_uris)
+        grant_types = _resolve_grant_types(registration.grant_types, policy.allowed_grant_types)
         requested_scope = registration.scope or policy.default_scope
         token_endpoint_auth_method = self._resolve_auth_method(registration)
         client_secret = secrets.token_urlsafe(32) if token_endpoint_auth_method == CLIENT_SECRET_POST_METHOD else None
@@ -72,7 +89,7 @@ def register(
             "client_name": registration.client_name or default_client_name,
             "client_uri": registration.client_uri,
             "redirect_uris": redirect_uris,
-            "grant_types": list(policy.allowed_grant_types),
+            "grant_types": grant_types,
             "response_types": ["code"],
             "scope": requested_scope,
             "token_endpoint_auth_method": token_endpoint_auth_method,
```

**File**: `auth-server/tests/integration/test_oauth_flow_routes.py` (modified, +132/-3)
```diff
@@ -177,7 +177,11 @@ def test_register_client_includes_device_grant_by_default(self, test_client: Tes
         assert data["token_endpoint_auth_method"] == "none"
         assert data["client_id"] in registered_clients
 
-    def test_register_client_full_metadata_keeps_device_grant(self, test_client: TestClient, clear_device_storage):
+    def test_register_client_full_metadata_persists_declared_grant_types(
+        self,
+        test_client: TestClient,
+        clear_device_storage,
+    ):
         response = test_client.post(
             f"{API_PREFIX}/oauth2/register",
             json={
@@ -195,10 +199,59 @@ def test_register_client_full_metadata_keeps_device_grant(self, test_client: Tes
         assert response.status_code == 200
         data = response.json()
         assert data["client_name"] == "Test MCP Client"
-        assert data["grant_types"] == ["authorization_code", "refresh_token", DEVICE_CODE_GRANT_TYPE]
+        assert data["grant_types"] == ["authorization_code"]
+        assert registered_clients[data["client_id"]]["grant_types"] == ["authorization_code"]
         assert data["token_endpoint_auth_method"] == "client_secret_post"
         assert data["scope"] == "mcp-proxy-ops"
 
+    def test_register_client_rejects_unsupported_grant_types_without_persisting(
+        self,
+        test_client: TestClient,
+        clear_device_storage,
+    ) -> None:
+        existing_client_ids = set(registered_clients)
+
+        response = test_client.post(
+            f"{API_PREFIX}/oauth2/register",
+            json={
+                "redirect_uris": ["https://example.com/callback"],
+                "grant_types": ["client_credentials"],
+            },
+        )
+
+        assert response.status_code == 400
+        assert response.json() == {
+            "error": "invalid_client_metadata",
+            "error_description": "none of the requested grant_types are supported",
+        }
+        assert set(registered_clients) == existing_client_ids
+
+    def test_registered_authorization_code_client_cannot_start_device_flow(
+        self,
+        test_client: TestClient,
+        clear_device_storage,
+    ) -> None:
+        registration = test_client.post(
+            f"{API_PREFIX}/oauth2/register",
+            json={
+                "redirect_uris": ["https://example.com/callback"],
+                "grant_types": ["authorization_code"],
+            },
+        )
+        assert registration.status_code == 200
+        client_id = registration.json()["client_id"]
+
+        response = test_client.post(
+            f"{API_PREFIX}/oauth2/device/code",
+            data={"client_id": client_id},
+        )
+
+        assert response.status_code == 400
+        assert response.json() == {
+            "error": "unauthorized_client",
+            "error_description": "client is not registered for the device_code grant type",
+        }
+
     def test_register_client_preserves_scope_outside_category_ceiling(
         self,
         test_client: TestClient,
@@ -327,7 +380,8 @@ def test_register_a2a_client_full_metadata(self, test_client: TestClient, clear_
         data = response.json()
         assert data["client_id"].startswith("a2a-client-")
         assert data["client_name"] == "My A2A Agent"
-        assert data["grant_types"] == ["authorization_code", "refresh_token", DEVICE_CODE_GRANT_TYPE]
+        assert data["grant_types"] == ["authorization_code"]
+        assert registered_clients[data["client_id"]]["grant_types"] == ["authorization_code"]
         assert data["token_endpoint_auth_method"] == "client_secret_post"
         assert data["scope"] == "a2a-proxy-ops"
 
@@ -440,6 +494,81 @@ def test_a2a_discovery_registration_and_token_scope_closed_loop(
 @pytest.mark.integration
 @pytest.mark.oauth_flow
 class TestLoginRedirectErrorConsent:
+    def test_client_without_authorization_code_uses_consent_detour(
+        self,
+        test_client: TestClient,
+        clear_device_storage,
+    ) -> None:
+        _configure_oauth2(test_client)
+        redirect_uri = "http://localhost:43123/callback"
+        registration = test_client.post(
+            f"{API_PREFIX}/oauth2/register",
+            json={
+                "redirect_uris": [redirect_uri],
+                "grant_types": [DEVICE_CODE_GRANT_TYPE, "refresh_token"],
+            },
+        )
+        assert registration.status_code == 200
+        client_id = registration.json()["client_id"]
+
+        response = test_client.get(
+            f"{API_PREFIX}/oauth2/login/entra",
+            params={
+                "client_id": client_id,
+                "response_type": "code",
+                "redirect_uri": redirect_uri,
+                "code_challenge": "challenge",
+                "code_challenge_method": "S256",
+                "state": "client-state",
+            },
+            follow_redirects=False,
+        )
+
+        assert response.status_code == 302
+        nonce = response.headers[
```

**File**: `auth-server/tests/unit/services/test_client_registration_service.py` (modified, +86/-1)
```diff
@@ -5,7 +5,12 @@
 
 from auth_server.models.client_registration import ClientRegistrationRequest
 from auth_server.services.client_registration_service import ClientRegistrationError, ClientRegistrationService
-from registry_pkgs.core.client_categories import ClientCategory
+from registry_pkgs.core.client_categories import (
+    AUTHORIZATION_CODE_GRANT_TYPE,
+    REFRESH_TOKEN_GRANT_TYPE,
+    ClientCategory,
+)
+from registry_pkgs.core.downstream_oauth import DEVICE_CODE_GRANT_TYPE
 
 
 @pytest.fixture
@@ -54,6 +59,86 @@ def test_register_preserves_whitespace_only_scope(
     assert store.registered_clients[response.client_id]["scope"] == "   "
 
 
+def test_register_persists_requested_grant_types(
+    service: ClientRegistrationService,
+    store: InMemoryOAuthStateStore,
+) -> None:
+    response = service.register(
+        ClientRegistrationRequest(
+            redirect_uris=["https://example.com/callback"],
+            grant_types=[AUTHORIZATION_CODE_GRANT_TYPE],
+        ),
+        category=ClientCategory.MCP_DCR,
+        default_client_name="MCP Client",
+        ip_address="127.0.0.1",
+    )
+
+    assert response.grant_types == [AUTHORIZATION_CODE_GRANT_TYPE]
+    assert store.registered_clients[response.client_id]["grant_types"] == [AUTHORIZATION_CODE_GRANT_TYPE]
+
+
+def test_register_defaults_to_policy_grant_types_when_omitted(
+    service: ClientRegistrationService,
+    store: InMemoryOAuthStateStore,
+) -> None:
+    response = service.register(
+        ClientRegistrationRequest(redirect_uris=["https://example.com/callback"]),
+        category=ClientCategory.MCP_DCR,
+        default_client_name="MCP Client",
+        ip_address="127.0.0.1",
+    )
+
+    expected = [AUTHORIZATION_CODE_GRANT_TYPE, REFRESH_TOKEN_GRANT_TYPE, DEVICE_CODE_GRANT_TYPE]
+    assert response.grant_types == expected
+    assert store.registered_clients[response.client_id]["grant_types"] == expected
+
+
+def test_register_orders_and_deduplicates_supported_grant_types(
+    service: ClientRegistrationService,
+    store: InMemoryOAuthStateStore,
+) -> None:
+    response = service.register(
+        ClientRegistrationRequest(
+            redirect_uris=["https://example.com/callback"],
+            grant_types=[
+                DEVICE_CODE_GRANT_TYPE,
+                "client_credentials",
+                AUTHORIZATION_CODE_GRANT_TYPE,
+                DEVICE_CODE_GRANT_TYPE,
+            ],
+        ),
+        category=ClientCategory.MCP_DCR,
+        default_client_name="MCP Client",
+        ip_address="127.0.0.1",
+    )
+
+    expected = [AUTHORIZATION_CODE_GRANT_TYPE, DEVICE_CODE_GRANT_TYPE]
+    assert response.grant_types == expected
+    assert store.registered_clients[response.client_id]["grant_types"] == expected
+
+
+@pytest.mark.parametrize("grant_types", [[], ["client_credentials"]])
+def test_register_rejects_empty_grant_type_intersection_before_persisting(
+    service: ClientRegistrationService,
+    store: InMemoryOAuthStateStore,
+    grant_types: list[str],
+) -> None:
+    with pytest.raises(ClientRegistrationError) as exc_info:
+        service.register(
+            ClientRegistrationRequest(
+                redirect_uris=["https://example.com/callback"],
+                grant_types=grant_types,
+            ),
+            category=ClientCategory.MCP_DCR,
+            default_client_name="MCP Client",
+            ip_address="127.0.0.1",
+        )
+
+    assert exc_info.value.error == "invalid_client_metadata"
+    assert exc_info.value.description == "none of the requested grant_types are supported"
+    assert store.registered_clients == {}
+
+
 def test_register_rejects_unsafe_redirect_before_persisting(
     service: ClientRegistrationService,
     store: InMemoryOAuthStateStore,
```

**File**: `auth-server/tests/unit/test_oauth_flow_helpers.py` (modified, +25/-1)
```diff
@@ -9,6 +9,7 @@
     _trusted_error_redirect_uris,
     _validate_known_client_for_redirect,
 )
+from registry_pkgs.core.client_categories import AUTHORIZATION_CODE_GRANT_TYPE
 from registry_pkgs.core.redirect_uri import is_safe_unverified_redirect_target
 from tests.support.oauth_state_store import InMemoryOAuthStateStore
 
@@ -68,7 +69,10 @@ def test_registered_redirect_returns_none(self) -> None:
         store = InMemoryOAuthStateStore()
         store.save_client(
             "known-client",
-            {"redirect_uris": ["http://localhost/callback"]},
+            {
+                "redirect_uris": ["http://localhost/callback"],
+                "grant_types": [AUTHORIZATION_CODE_GRANT_TYPE],
+            },
         )
 
         assert (
@@ -80,6 +84,26 @@ def test_registered_redirect_returns_none(self) -> None:
             is None
         )
 
+    def test_registered_redirect_without_authorization_code_returns_unauthorized_client(self) -> None:
+        store = InMemoryOAuthStateStore()
+        store.save_client(
+            "known-client",
+            {
+                "redirect_uris": ["http://localhost/callback"],
+                "grant_types": ["refresh_token"],
+            },
+        )
+
+        error = _validate_known_client_for_redirect(
+            "known-client",
+            "http://localhost/callback",
+            store,
+        )
+
+        assert error is not None
+        assert error.error == "unauthorized_client"
+        assert error.error_description == "client is not authorized for authorization_code"
+
 
 def test_trusted_error_redirect_uris_adds_exact_deployment_callback() -> None:
     callback = "https://jarvis.example.com/api/mcp/jarvis_registry/oauth/callback"
```

---

### Incident Patch 12: `2f0870c6` (2026-09-08)
**Commit Message**: fix(skill-sync): enforce standalone frontmatter fences (#559)

**File**: `registry/src/registry/services/skill_sync_discovery_service.py` (modified, +24/-3)
```diff
@@ -173,19 +173,40 @@ def _process_skill_folder(
     )
 
 
+def _index_closing_fence(text: str) -> int:
+    """Return the newline index before the first standalone closing fence.
+
+    A closing fence must be terminated by LF, CRLF, or the end of the string.
+    A bare CR is not a valid line terminator.
+    """
+    for newline_index, character in enumerate(text):
+        if character != "\n":
+            continue
+
+        fence_start = newline_index + 1
+        fence_end = fence_start + 3
+        if text[fence_start:fence_end] != "---":
+            continue
+
+        if fence_end == len(text) or text[fence_end] == "\n" or text.startswith("\r\n", fence_end):
+            return newline_index
+
+    return -1
+
+
 def _parse_frontmatter(content: str) -> tuple[dict[str, Any], str] | None:
     stripped = content.lstrip()
     if not stripped.startswith("---"):
         return None
     after_first_fence = stripped[3:]
-    if after_first_fence and after_first_fence[0] not in ("\n", "\r"):
+    if after_first_fence and after_first_fence[0] != "\n" and not after_first_fence.startswith("\r\n"):
         return None
-    end_idx = after_first_fence.find("\n---")
+    end_idx = _index_closing_fence(after_first_fence)
     if end_idx == -1:
         return None
     yaml_str = after_first_fence[:end_idx]
     body_start = end_idx + 4
-    body = after_first_fence[body_start:].lstrip("\n")
+    body = after_first_fence[body_start:].lstrip("\n\r")
     try:
         fm = yaml.safe_load(yaml_str)
     except yaml.YAMLError:
```

**File**: `registry/tests/unit/services/test_skill_sync_discovery_service.py` (modified, +59/-0)
```diff
@@ -4,6 +4,7 @@
 
 from registry.services.skill_sync_discovery_service import (
     SkillSyncDiscoveryService,
+    _index_closing_fence,
     _parse_frontmatter,
 )
 from registry.services.skill_sync_github_service import ExtractedAuxFile, ExtractedSkillFolder, ExtractionResult
@@ -355,6 +356,64 @@ def test_parse_frontmatter_leading_whitespace():
     assert result[0]["name"] == "test"
 
 
+def test_parse_frontmatter_closing_fence_must_be_alone_on_line() -> None:
+    content = "---\nname: test\ndescription: hello\n---bar: baz\n---\nBody text"
+
+    result = _parse_frontmatter(content)
+
+    assert result is not None
+    frontmatter, body = result
+    assert frontmatter["---bar"] == "baz"
+    assert body == "Body text"
+
+
+def test_parse_frontmatter_rejects_bare_cr_after_opening_fence() -> None:
+    content = "---\rname: test\ndescription: hello\n---\nBody text"
+
+    assert _parse_frontmatter(content) is None
+
+
+def test_parse_frontmatter_handles_crlf_without_leaking_line_endings() -> None:
+    content = "---\r\nname: test\r\ndescription: hello\r\n---\r\nBody text"
+
+    result = _parse_frontmatter(content)
+
+    assert result is not None
+    frontmatter, body = result
+    assert frontmatter == {"name": "test", "description": "hello"}
+    assert body == "Body text"
+
+
+def test_parse_frontmatter_accepts_eof_terminated_closing_fence() -> None:
+    content = "---\nname: test\ndescription: hello\n---"
+
+    result = _parse_frontmatter(content)
+
+    assert result is not None
+    frontmatter, body = result
+    assert frontmatter == {"name": "test", "description": "hello"}
+    assert body == ""
+
+
+@pytest.mark.parametrize("candidate", ["---bar: baz", "----", "--- "])
+def test_index_closing_fence_skips_nonconformant_candidates(candidate: str) -> None:
+    text = f"\n{candidate}\n---\nBody text"
+
+    assert _index_closing_fence(text) == len(candidate) + 1
+
+
+def test_index_closing_fence_skips_bare_cr_terminated_candidate() -> None:
+    invalid_candidate = "\n---\rnot-a-terminator"
+    text = f"{invalid_candidate}\n---\nBody text"
+
+    assert _index_closing_fence(text) == len(invalid_candidate)
+
+
+@pytest.mark.parametrize("suffix", ["", "\nBody text", "\r\nBody text"])
+def test_index_closing_fence_accepts_supported_terminators(suffix: str) -> None:
+    assert _index_closing_fence(f"\n---{suffix}") == 0
+
+
 def test_discovery_summary_file_count(tmp_path):
     folders = [
         _skill_folder(tmp_path, "a", _md("alpha", "A"), aux_files={"helper.py": b"x"}),
```

---

### Incident Patch 13: `c04715a1` (2026-09-01)
**Commit Message**: fix: propagate Langfuse trace attributes to A2A agents (#547)

**File**: `registry-pkgs/src/registry_pkgs/workflows/a2a_client.py` (modified, +22/-3)
```diff
@@ -1,9 +1,10 @@
 from __future__ import annotations
 
 import asyncio
+import json
 import logging
 import uuid
-from collections.abc import Awaitable, Callable
+from collections.abc import Awaitable, Callable, Mapping
 from dataclasses import dataclass
 from time import monotonic
 from typing import Any
@@ -25,7 +26,7 @@
 )
 from a2a.utils.artifact import get_artifact_text
 from a2a.utils.message import get_message_text
-from opentelemetry import baggage
+from opentelemetry import baggage, trace
 from opentelemetry.baggage.propagation import W3CBaggagePropagator
 from opentelemetry.propagators.composite import CompositePropagator
 from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
@@ -57,6 +58,8 @@
 )
 _TRACE_CONTEXT_HEADERS = frozenset({"baggage", "traceparent", "tracestate"})
 _LANGFUSE_ENVIRONMENT_BAGGAGE_KEY = "langfuse.environment"
+_LANGFUSE_TRACE_NAME_BAGGAGE_KEY = "langfuse.trace.name"
+_LANGFUSE_TRACE_TAGS_BAGGAGE_KEY = "langfuse.trace.tags"
 
 HeadersProvider = Callable[[A2AAgent], Awaitable[dict[str, str]]]
 ClientProvider = Callable[[A2AAgent], Awaitable[httpx.AsyncClient]]
@@ -205,7 +208,7 @@ def _extra_call_headers(agent: A2AAgent) -> dict[str, str]:
 
 
 def _inject_traceparent(headers: dict[str, str]) -> dict[str, str]:
-    """Return copied headers with the current trace and controlled environment baggage."""
+    """Return copied headers with the current trace and controlled Langfuse baggage."""
     outbound_headers = {key: value for key, value in headers.items() if key.lower() not in _TRACE_CONTEXT_HEADERS}
     try:
         outbound_context = baggage.clear()
@@ -216,6 +219,22 @@ def _inject_traceparent(headers: dict[str, str]) -> dict[str, str]:
                 environment,
                 context=outbound_context,
             )
+        span_attributes = getattr(trace.get_current_span(), "attributes", None)
+        if isinstance(span_attributes, Mapping):
+            trace_name = span_attributes.get(_LANGFUSE_TRACE_NAME_BAGGAGE_KEY)
+            if isinstance(trace_name, str) and trace_name:
+                outbound_context = baggage.set_baggage(
+                    _LANGFUSE_TRACE_NAME_BAGGAGE_KEY,
+                    trace_name,
+                    context=outbound_context,
+                )
+            trace_tags = span_attributes.get(_LANGFUSE_TRACE_TAGS_BAGGAGE_KEY)
+            if isinstance(trace_tags, (list, tuple)) and trace_tags:
+                outbound_context = baggage.set_baggage(
+                    _LANGFUSE_TRACE_TAGS_BAGGAGE_KEY,
+                    json.dumps(trace_tags, separators=(",", ":")),
+                    context=outbound_context,
+                )
         _TRACE_CONTEXT_PROPAGATOR.inject(
             outbound_headers,
             context=outbound_context,
```

**File**: `registry-pkgs/tests/unit/workflow/test_a2a_client.py` (modified, +27/-0)
```diff
@@ -22,6 +22,7 @@
     TransportProtocol,
 )
 from beanie import PydanticObjectId
+from opentelemetry.sdk.trace import TracerProvider
 from opentelemetry.trace import NonRecordingSpan, SpanContext, TraceFlags, TraceState, use_span
 
 from registry_pkgs.core.config import JwtSigningConfig
@@ -850,6 +851,32 @@ async def headers_provider(_: A2AAgent) -> dict[str, str]:
     }
 
 
+@pytest.mark.asyncio
+async def test_call_a2a_injects_current_langfuse_trace_attributes():
+    agent = _make_agent()
+    mock_factory, mock_client = _mock_client([_msg("ok")])
+    tracer = TracerProvider().get_tracer(__name__)
+
+    with (
+        patch("registry_pkgs.workflows.a2a_client.ClientFactory", return_value=mock_factory),
+        patch("registry_pkgs.workflows.a2a_client.get_trace_environment", return_value="demo"),
+    ):
+        with tracer.start_as_current_span(
+            "a2a.agent.execute",
+            attributes={
+                "langfuse.trace.name": "AgentRun",
+                "langfuse.trace.tags": ["registry", "agent"],
+            },
+        ):
+            result = await call_a2a(agent, "test")
+
+    assert result.success is True
+    send_context = mock_client.send_message.call_args.kwargs["context"]
+    assert send_context.state["http_kwargs"]["headers"]["baggage"] == (
+        "langfuse.environment=demo,langfuse.trace.name=AgentRun,langfuse.trace.tags=%5B%22registry%22%2C%22agent%22%5D"
+    )
+
+
 @pytest.mark.asyncio
 async def test_call_a2a_continues_when_trace_context_injection_fails(caplog: pytest.LogCaptureFixture):
     agent = _make_agent()
```

---

### Incident Patch 14: `4ec61154` (2026-09-01)
**Commit Message**: feat: propagate deployment environment to A2A agent traces (#545)

* feat: propagate deployment environment to A2A agent traces

* fix: finding m1

---------

Co-authored-by: kxue43 <[REDACTED_EMAIL]>

**File**: `registry-pkgs/src/registry_pkgs/telemetry/__init__.py` (modified, +21/-2)
```diff
@@ -26,6 +26,7 @@
     "WORKFLOW_LATENCY_BUCKETS",
     "track_duration",
     "create_timed_context",
+    "get_trace_environment",
 ]
 
 
@@ -48,6 +49,20 @@
 _TRACE_MAX_QUEUE_SIZE = 2048
 _TRACE_MAX_EXPORT_BATCH_SIZE = 512
 _TRACE_SCHEDULE_DELAY_MILLIS = 5000
+_trace_environment: str | None = None
+
+
+def get_trace_environment() -> str | None:
+    """Return the deployment environment configured for outbound trace calls."""
+    return _trace_environment
+
+
+def _normalize_deployment_environment(value: str | None) -> str | None:
+    """Strip whitespace and collapse a blank deployment environment to None."""
+    if value is None:
+        return None
+    stripped = value.strip()
+    return stripped or None
 
 
 def _otlp_headers(telemetry_config: TelemetryConfig) -> dict[str, str] | None:
@@ -138,8 +153,9 @@ def _build_resource(service_name: str, telemetry_config: TelemetryConfig) -> Res
         SERVICE_NAME: service_name,
         _SERVICE_VERSION: telemetry_config.build_version,
     }
-    if telemetry_config.deployment_environment:
-        attributes[_DEPLOYMENT_ENVIRONMENT_NAME] = telemetry_config.deployment_environment
+    environment = _normalize_deployment_environment(telemetry_config.deployment_environment)
+    if environment:
+        attributes[_DEPLOYMENT_ENVIRONMENT_NAME] = environment
     return Resource.create(attributes=attributes)
 
 
@@ -233,7 +249,10 @@ def setup_tracing(
     Uses AgnoInstrumentor to auto-instrument all agno Agent/Model/Tool calls.
     Shares the same OTLP collector endpoint and Resource as setup_metrics().
     """
+    global _trace_environment
+
     logger.info("Setting up tracing...")
+    _trace_environment = _normalize_deployment_environment(telemetry_config.deployment_environment)
     try:
         instrumentor_type, trace_config_type = _load_agno_instrumentation()
         current_provider = trace.get_tracer_provider()
```

**File**: `registry-pkgs/src/registry_pkgs/workflows/a2a_client.py` (modified, +24/-3)
```diff
@@ -25,6 +25,9 @@
 )
 from a2a.utils.artifact import get_artifact_text
 from a2a.utils.message import get_message_text
+from opentelemetry import baggage
+from opentelemetry.baggage.propagation import W3CBaggagePropagator
+from opentelemetry.propagators.composite import CompositePropagator
 from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
 
 from registry_pkgs.core.agentcore_jwt import mint_agentcore_runtime_jwt
@@ -34,6 +37,7 @@
     AgentCoreA2AFederationMetadata,
     AzureFoundryFederationMetadata,
 )
+from registry_pkgs.telemetry import get_trace_environment
 
 logger = logging.getLogger(__name__)
 
@@ -45,8 +49,14 @@
 _A2A_HTTP_TIMEOUT = httpx.Timeout(30.0, read=_A2A_TASK_BUDGET_SECONDS)
 # Preemptive backstop: a still-streaming send never reaches the poll loop's own check.
 _A2A_HARD_TIMEOUT_SECONDS = _A2A_TASK_BUDGET_SECONDS + 60
-_TRACE_CONTEXT_PROPAGATOR = TraceContextTextMapPropagator()
+_TRACE_CONTEXT_PROPAGATOR = CompositePropagator(
+    [
+        TraceContextTextMapPropagator(),
+        W3CBaggagePropagator(),
+    ]
+)
 _TRACE_CONTEXT_HEADERS = frozenset({"baggage", "traceparent", "tracestate"})
+_LANGFUSE_ENVIRONMENT_BAGGAGE_KEY = "langfuse.environment"
 
 HeadersProvider = Callable[[A2AAgent], Awaitable[dict[str, str]]]
 ClientProvider = Callable[[A2AAgent], Awaitable[httpx.AsyncClient]]
@@ -195,10 +205,21 @@ def _extra_call_headers(agent: A2AAgent) -> dict[str, str]:
 
 
 def _inject_traceparent(headers: dict[str, str]) -> dict[str, str]:
-    """Return copied request headers containing only the current W3C traceparent."""
+    """Return copied headers with the current trace and controlled environment baggage."""
     outbound_headers = {key: value for key, value in headers.items() if key.lower() not in _TRACE_CONTEXT_HEADERS}
     try:
-        _TRACE_CONTEXT_PROPAGATOR.inject(outbound_headers)
+        outbound_context = baggage.clear()
+        environment = get_trace_environment()
+        if environment is not None:
+            outbound_context = baggage.set_baggage(
+                _LANGFUSE_ENVIRONMENT_BAGGAGE_KEY,
+                environment,
+                context=outbound_context,
+            )
+        _TRACE_CONTEXT_PROPAGATOR.inject(
+            outbound_headers,
+            context=outbound_context,
+        )
     except Exception:
         logger.warning("Failed to inject trace context into A2A request headers", exc_info=True)
     outbound_headers.pop("tracestate", None)
```

**File**: `registry-pkgs/tests/unit/telemetry/test_telemetry_setup.py` (modified, +55/-1)
```diff
@@ -6,7 +6,7 @@
 from opentelemetry.sdk.trace import TracerProvider
 
 from registry_pkgs.core.config import TelemetryConfig
-from registry_pkgs.telemetry import setup_metrics, setup_tracing, shutdown_telemetry
+from registry_pkgs.telemetry import get_trace_environment, setup_metrics, setup_tracing, shutdown_telemetry
 
 
 @pytest.mark.unit
@@ -103,6 +103,26 @@ def test_setup_metrics_identifies_deployment_environment(self, mock_otel_deps):
         _, kwargs = mock_otel_deps["resource"].create.call_args
         assert kwargs["attributes"]["deployment.environment.name"] == "demo"
 
+    def test_setup_metrics_strips_deployment_environment_whitespace(self, mock_otel_deps):
+        setup_metrics(
+            "test-service",
+            TelemetryConfig(deployment_environment="  demo  "),
+            enable_metrics=False,
+        )
+
+        _, kwargs = mock_otel_deps["resource"].create.call_args
+        assert kwargs["attributes"]["deployment.environment.name"] == "demo"
+
+    def test_setup_metrics_omits_deployment_environment_when_blank_after_strip(self, mock_otel_deps):
+        setup_metrics(
+            "test-service",
+            TelemetryConfig(deployment_environment="   "),
+            enable_metrics=False,
+        )
+
+        _, kwargs = mock_otel_deps["resource"].create.call_args
+        assert "deployment.environment.name" not in kwargs["attributes"]
+
     def test_setup_metrics_disabled(self, mock_otel_deps):
         """Test setup with metrics disabled."""
         setup_metrics("test-service", TelemetryConfig(), enable_metrics=False)
@@ -375,6 +395,40 @@ def test_setup_tracing_graceful_without_openinference(self):
             setup_tracing("test-service", TelemetryConfig())
             mock_set.assert_not_called()
 
+    def test_setup_tracing_configures_outbound_environment_before_instrumentation(self):
+        """A2A propagation remains configured even if optional instrumentation is unavailable."""
+        with (
+            patch("registry_pkgs.telemetry._trace_environment", None),
+            patch("registry_pkgs.telemetry._load_agno_instrumentation", side_effect=ImportError("missing")),
+        ):
+            setup_tracing(
+                "test-service",
+                TelemetryConfig(deployment_environment="demo"),
+            )
+            assert get_trace_environment() == "demo"
+
+    def test_setup_tracing_normalizes_deployment_environment_like_setup_metrics(self):
+        """setup_tracing()'s outbound environment matches _build_resource()'s normalization."""
+        with (
+            patch("registry_pkgs.telemetry._trace_environment", None),
+            patch("registry_pkgs.telemetry._load_agno_instrumentation", side_effect=ImportError("missing")),
+        ):
+            setup_tracing(
+                "test-service",
+                TelemetryConfig(deployment_environment="  demo  "),
+            )
+            assert get_trace_environment() == "demo"
+
+        with (
+            patch("registry_pkgs.telemetry._trace_environment", None),
+            patch("registry_pkgs.telemetry._load_agno_instrumentation", side_effect=ImportError("missing")),
+        ):
+            setup_tracing(
+                "test-service",
+                TelemetryConfig(deployment_environment="   "),
+            )
+            assert get_trace_environment() is None
+
     def test_setup_tracing_uses_same_resource_as_metrics(self):
         """setup_tracing() uses _build_resource() with same args pattern as setup_metrics()."""
         with (
```

**File**: `registry-pkgs/tests/unit/workflow/test_a2a_client.py` (modified, +5/-1)
```diff
@@ -827,7 +827,10 @@ async def headers_provider(_: A2AAgent) -> dict[str, str]:
         trace_state=TraceState([("vendor", "state")]),
     )
 
-    with patch("registry_pkgs.workflows.a2a_client.ClientFactory", return_value=mock_factory):
+    with (
+        patch("registry_pkgs.workflows.a2a_client.ClientFactory", return_value=mock_factory),
+        patch("registry_pkgs.workflows.a2a_client.get_trace_environment", return_value="demo"),
+    ):
         with use_span(NonRecordingSpan(span_context), end_on_exit=False):
             result = await call_a2a(agent, "test", headers_provider=headers_provider)
 
@@ -836,6 +839,7 @@ async def headers_provider(_: A2AAgent) -> dict[str, str]:
     headers = send_context.state["http_kwargs"]["headers"]
     assert headers == {
         "Authorization": "Bearer test-token",
+        "baggage": "langfuse.environment=demo",
         "traceparent": "00-00000000000000000000000000000001-0000000000000001-01",
     }
     assert provided_headers == {
```

---

### Incident Patch 15: `5bcbee77` (2026-08-26)
**Commit Message**: Fix: workflow node dependency (#537)

* fix(frontend): stop hiding cross-branch upstream nodes as reference candidates

getEffectiveExecutingParents tunneled through structural nodes
(Condition/Router/Loop/Parallel) to find the nearest execution node and
always treated it as an implicit dependency, hiding it from "Reference
upstream outputs". The backend's implicit-dependency chain
(_build_implicit_previous_step_names) intentionally breaks at every
container boundary, so a branch's first node never actually receives
that implicit input - the node was neither auto-injected nor
selectable, silently dropping the upstream output at runtime.

Restrict the check to a single hop so it matches the backend's real
semantics: a node's output is only implicit for its direct execution
parent, never across a structural node.

* test(frontend): add Vitest and regression tests for workflow DAG helpers

The frontend has no test runner yet. Add Vitest, since it reuses the
project's existing Vite transform pipeline with no extra config, and
wire it up with a plain node environment (no jsdom) so it stays scoped
to pure logic rather than UI/snapshot testing.

Cover dag.ts's ancestor/reference-candidate

**File**: `.github/workflows/frontend-test.yml` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+name: Frontend Tests
+
+on:
+  push:
+    branches: [main]
+    paths:
+      - 'frontend/**'
+  pull_request:
+    branches: [main]
+    paths:
+      - 'frontend/**'
+  workflow_dispatch:
+
+jobs:
+  test:
+    name: "Vitest"
+    runs-on: ubuntu-latest
+
+    steps:
+    - name: Checkout code
+      uses: actions/checkout@v6
+
+    - name: Set up Node.js
+      uses: actions/setup-node@v4
+      with:
+        node-version: 22
+        cache: npm
+        cache-dependency-path: frontend/package-lock.json
+
+    - name: Install dependencies
+      working-directory: frontend
+      run: npm ci
+
+    - name: Run unit tests
+      working-directory: frontend
+      run: npm run test
```

**File**: `frontend/package-lock.json` (modified, +399/-1)
```diff
@@ -41,7 +41,8 @@
         "eslint-plugin-react-refresh": "^0.4.9",
         "globals": "^15.9.0",
         "typescript-eslint": "^8.0.1",
-        "vite": "^7.2.2"
+        "vite": "^7.2.2",
+        "vitest": "^4.1.11"
       }
     },
     "node_modules/@alloc/quick-lru": {
@@ -4858,6 +4859,13 @@
         "@sinonjs/commons": "^1.7.0"
       }
     },
+    "node_modules/@standard-schema/spec": {
+      "version": "1.1.0",
+      "resolved": "https://registry.npmjs.org/@standard-schema/spec/-/spec-1.1.0.tgz",
+      "integrity": "sha512-l2aFy5jALhniG5HgqrD6jXLi/rUWrKvqN/qJx6yoJsgKhblVd+iqqU4RCXavm/jPityDo5TCvKMnpjKnOriy0w==",
+      "dev": true,
+      "license": "MIT"
+    },
     "node_modules/@surma/rollup-plugin-off-main-thread": {
       "version": "2.2.3",
       "resolved": "https://registry.npmjs.org/@surma/rollup-plugin-off-main-thread/-/rollup-plugin-off-main-thread-2.2.3.tgz",
@@ -5199,6 +5207,17 @@
         "@types/node": "*"
       }
     },
+    "node_modules/@types/chai": {
+      "version": "5.2.3",
+      "resolved": "https://registry.npmjs.org/@types/chai/-/chai-5.2.3.tgz",
+      "integrity": "sha512-Mw558oeA9fFbv65/y4mHtXDs9bPnFMZAL/jxdPFUpOHHIXX91mcgEHbS5Lahr+pwZFR8A7GQleRWeI6cGFC2UA==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "@types/deep-eql": "*",
+        "assertion-error": "^2.0.1"
+      }
+    },
     "node_modules/@types/connect": {
       "version": "3.4.38",
       "resolved": "https://registry.npmjs.org/@types/connect/-/connect-3.4.38.tgz",
@@ -5274,6 +5293,13 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/@types/deep-eql": {
+      "version": "4.0.2",
+      "resolved": "https://registry.npmjs.org/@types/deep-eql/-/deep-eql-4.0.2.tgz",
+      "integrity": "sha512-c9h9dVVMigMPc4bwTvC5dxqtqJZwQPePsWjPlpSOnojbor6pGqdk541lfA7AqFQr5pB1BRdq0juY9db81BwyFw==",
+      "dev": true,
+      "license": "MIT"
+    },
     "node_modules/@types/eslint": {
       "version": "9.6.1",
       "resolved": "https://registry.npmjs.org/@types/eslint/-/eslint-9.6.1.tgz",
@@ -5887,6 +5913,149 @@
         "vite": "^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0"
       }
     },
+    "node_modules/@vitest/expect": {
+      "version": "4.1.11",
+      "resolved": "https://registry.npmjs.org/@vitest/expect/-/expect-4.1.11.tgz",
+      "integrity": "sha512-VX2x5vNJXET47KAFzwERI+KRMtTTCSWTfSMKsW7JsUsXV4psq++e3DvZpuTDOpHcxytiDs6p2nhVb2tVDiiUYw==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "@standard-schema/spec": "^1.1.0",
+        "@types/chai": "^5.2.2",
+        "@vitest/spy": "4.1.11",
+        "@vitest/utils": "4.1.11",
+        "chai": "^6.2.2",
+        "tinyrainbow": "^3.1.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/vitest"
+      }
+    },
+    "node_modules/@vitest/mocker": {
+      "version": "4.1.11",
+      "resolved": "https://registry.npmjs.org/@vitest/mocker/-/mocker-4.1.11.tgz",
+      "integrity": "sha512-2XJVD55d1o5AZous5CCGKS74g/riOj9odEt2bQpCVZeblHyHdnMeFl4jl0XjU21stf4mbjUkew2eXQZt65g5CQ==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "@vitest/spy": "4.1.11",
+        "estree-walker": "^3.0.3",
+        "magic-string": "^0.30.21"
+      },
+      "funding": {
+        "url": "https://opencollective.com/vitest"
+      },
+      "peerDependencies": {
+        "msw": "^2.4.9",
+        "vite": "^6.0.0 || ^7.0.0 || ^8.0.0"
+      },
+      "peerDependenciesMeta": {
+        "msw": {
+          "optional": true
+        },
+        "vite": {
+          "optional": true
+        }
+      }
+    },
+    "node_modules/@vitest/mocker/node_modules/estree-walker": {
+      "version": "3.0.3",
+      "resolved": "https://registry.npmjs.org/estree-walker/-/estree-walker-3.0.3.tgz",
+      "integrity": "sha512-7RUKfXgSMMkzt6ZuXmqapOurLGPPfgj6l9uRZ7lRGolvk0y2yocc35LdcxKC5PQZdn2DMqioAQ2NoWcrTKmm6g==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "@types/estree": "^1.0.0"
+      }
+    },
+    "node_modules/@vitest/mocker/node_modules/magic-string": {
+      "version": "0.30.21",
+      "resolved": "https://registry.npmjs.org/magic-string/-/magic-string-0.30.21.tgz",
+      "integrity": "sha512-vd2F4YUyEXKGcLHoq+TEyCjxueSeHnFxyyjNp80yg0XV4vUhnDer/lvvlqM/arB5bXQN5K2/3oinyCRyx8T2CQ==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "@jridgewell/sourcemap-codec": "^1.5.5"
+      }
+    },
+    "node_modules/@vitest/pretty-format": {
+      "version": "4.1.11",
+      "resolved": "https://registry.npmjs.org/@vitest/pretty-format/-/pretty-format-4.1.11.tgz",
+      "integrity": "sha512-yiZzPbGTS9Sr/JpFl8zHrcIkAofNbFV6k21vIgQN/cY/oxZeXhJv5sc/MBJ5jFKWmWs+oJHw0UXLZjmf931+Vw==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "tinyrainbow": "^3.1.0"
+      },
+      "funding": {
+        "url": "https://opencollective.com/vitest"
+      }
+    },
+
```

**File**: `frontend/package.json` (modified, +3/-1)
```diff
@@ -30,6 +30,7 @@
     "start": "vite",
     "build": "vite build",
     "serve": "vite preview",
+    "test": "vitest run",
     "format": "biome check --write",
     "rebuild:package-lock": "rm -rf node_modules package-lock.json && npm install"
   },
@@ -56,7 +57,8 @@
     "eslint-plugin-react-refresh": "^0.4.9",
     "globals": "^15.9.0",
     "typescript-eslint": "^8.0.1",
-    "vite": "^7.2.2"
+    "vite": "^7.2.2",
+    "vitest": "^4.1.11"
   },
   "overrides": {
     "nth-check": "^2.1.1",
```

**File**: `frontend/src/components/WorkflowCanvas/utils/dag.test.ts` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+import type { Edge, Node } from '@xyflow/react';
+import { describe, expect, it } from 'vitest';
+import type { NodeData } from '../types';
+import { getAncestors, getEffectiveExecutingParents, getReferenceCandidates, pruneInvalidRefs } from './dag';
+
+const makeNode = (id: string, type: string, refs?: string[]): Node<NodeData> => ({
+  id,
+  type,
+  position: { x: 0, y: 0 },
+  data: refs ? { label: id, refs } : { label: id },
+});
+
+const makeEdge = (source: string, target: string): Edge => ({ id: `${source}->${target}`, source, target });
+
+describe('getEffectiveExecutingParents', () => {
+  it('treats a direct execution-to-execution edge as an implicit parent', () => {
+    const nodes = [makeNode('A', 'agent'), makeNode('B', 'agent')];
+    const edges = [makeEdge('A', 'B')];
+
+    expect(getEffectiveExecutingParents('B', edges, nodes)).toEqual(new Set(['A']));
+  });
+
+  it('returns nothing for a node with no parents', () => {
+    const nodes = [makeNode('A', 'agent')];
+
+    expect(getEffectiveExecutingParents('A', [], nodes)).toEqual(new Set());
+  });
+
+  it('does not tunnel through a Condition node to reach an implicit parent (regression)', () => {
+    // A -> B -> Condition -> C, where C is the first node inside the Condition's branch.
+    const nodes = [
+      makeNode('A', 'agent'),
+      makeNode('B', 'agent'),
+      makeNode('Condition', 'cond'),
+      makeNode('C', 'agent'),
+    ];
+    const edges = [makeEdge('A', 'B'), makeEdge('B', 'Condition'), makeEdge('Condition', 'C')];
+
+    expect(getEffectiveExecutingParents('C', edges, nodes)).toEqual(new Set());
+  });
+
+  it.each(['router', 'loop', 'parallel'])('does not tunnel through a %s node either', structuralType => {
+    const nodes = [makeNode('B', 'agent'), makeNode('S', structuralType), makeNode('C', 'agent')];
+    const edges = [makeEdge('B', 'S'), makeEdge('S', 'C')];
+
+    expect(getEffectiveExecutingParents('C', edges, nodes)).toEqual(new Set());
+  });
+
+  it('treats the node directly after a branch entry as having that entry as its implicit parent', () => {
+    // Condition -> C -> D, both C and D inside the same branch.
+    const nodes = [makeNode('Condition', 'cond'), makeNode('C', 'agent'), makeNode('D', 'agent')];
+    const edges = [makeEdge('Condition', 'C'), makeEdge('C', 'D')];
+
+    expect(getEffectiveExecutingParents('D', edges, nodes)).toEqual(new Set(['C']));
+  });
+});
+
+describe('getAncestors', () => {
+  it('returns every upstream node reachable through reverse edges, regardless of node type', () => {
+    const edges = [makeEdge('A', 'B'), makeEdge('B', 'Condition'), makeEdge('Condition', 'C')];
+
+    expect(getAncestors('C', edges)).toEqual(new Set(['Condition', 'B', 'A']));
+  });
+});
+
+describe('getReferenceCandidates', () => {
+  it('offers every non-implicit execution ancestor for the first node inside a branch (IT Helpdesk workflow regression)', () => {
+    // A -> B -> Condition -> C -> D
+    const nodes = [
+      makeNode('A', 'agent'),
+      makeNode('B', 'agent'),
+      makeNode('Condition', 'cond'),
+      makeNode('C', 'agent'),
+      makeNode('D', 'agent'),
+    ];
+    const edges = [makeEdge('A', 'B'), makeEdge('B', 'Condition'), makeEdge('Condition', 'C'), makeEdge('C', 'D')];
+
+    expect(getReferenceCandidates('C', nodes, edges).map(n => n.id)).toEqual(['A', 'B']);
+  });
+
+  it('excludes a direct execution parent as implicit, but still offers earlier nodes', () => {
+    // Same graph as above: D's direct parent C is implicit and excluded, A and B remain.
+    const nodes = [
+      makeNode('A', 'agent'),
+      makeNode('B', 'agent'),
+      makeNode('Condition', 'cond'),
+      makeNode('C', 'agent'),
+      makeNode('D', 'agent'),
+    ];
+    const edges = [makeEdge('A', 'B'), makeEdge('B', 'Condition'), makeEdge('Condition', 'C'), makeEdge('C', 'D')];
+
+    expect(getReferenceCandidates('D', nodes, edges).map(n => n.id)).toEqual(['A', 'B']);
+  });
+
+  it('excludes structural nodes and the node itself from candidates', () => {
+    const nodes = [makeNode('A', 'agent'), makeNode('Condition', 'cond'), makeNode('C', 'agent')];
+    const edges = [makeEdge('A', 'Condition'), makeEdge('Condition', 'C')];
+
+    expect(getReferenceCandidates('C', nodes, edges).map(n => n.id)).toEqual(['A']);
+  });
+});
+
+describe('pruneInvalidRefs', () => {
+  it('strips a ref pointing at a node that is now an implicit (direct execution) parent', () => {
+    const nodes = [makeNode('A', 'agent'), makeNode('B', 'agent', ['A'])];
+    const edges = [makeEdge('A', 'B')];
+
+    const [, b] = pruneInvalidRefs(nodes, edges);
+
+    expect(b.data.refs).toEqual([]);
+  });
+
+  it('strips a ref that is no longer reachable after its edge is removed', () => {
+    const nodes = [makeNode('A', 'agent'), makeNode('B', 'agent'), makeNode('C', 'agent', ['A'])];
+    const edges = [makeEdge('B', 'C')];
+
+    const pruned = pruneInvalidRefs(nodes, edges);
+
+    
```

**File**: `frontend/src/components/WorkflowCanvas/utils/dag.ts` (modified, +11/-15)
```diff
@@ -11,26 +11,22 @@ export const getDirectParents = (nodeId: string, edges: Edge[]): Set<string> =>
   new Set(edges.filter(edge => edge.target === nodeId).map(edge => edge.source));
 
 /**
- * Returns the closest execution nodes on every upstream path.
- * Structural nodes are traversed; traversal stops when an Agent, MCP, or Pool is reached.
+ * Returns the node's direct parents that are themselves execution nodes.
+ *
+ * Their output is already injected as implicit input at runtime (see
+ * compiler._build_implicit_previous_step_names), but only across a direct
+ * edge — a structural node (Condition/Router/Loop/Parallel) between two
+ * execution nodes breaks that implicit chain, so it must not be tunneled
+ * through here either. A node whose direct parent is structural has no
+ * effective executing parent at all.
  */
 export const getEffectiveExecutingParents = (nodeId: string, edges: Edge[], nodes: Node<NodeData>[]): Set<string> => {
   const effectiveParents = new Set<string>();
-  const visited = new Set<string>();
-  const queue = [nodeId];
   const nodeMap = new Map(nodes.map(node => [node.id, node]));
 
-  for (let index = 0; index < queue.length; index += 1) {
-    const current = queue[index];
-    if (current === undefined || visited.has(current)) continue;
-    visited.add(current);
-
-    for (const upstreamId of getDirectParents(current, edges)) {
-      const upstreamNode = nodeMap.get(upstreamId);
-      if (!upstreamNode) continue;
-      if (isExecutionNode(upstreamNode)) effectiveParents.add(upstreamId);
-      else queue.push(upstreamId);
-    }
+  for (const parentId of getDirectParents(nodeId, edges)) {
+    const parentNode = nodeMap.get(parentId);
+    if (parentNode && isExecutionNode(parentNode)) effectiveParents.add(parentId);
   }
 
   return effectiveParents;
```

**File**: `frontend/vitest.config.ts` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+import path from 'node:path';
+import { defineConfig } from 'vitest/config';
+
+export default defineConfig({
+  resolve: {
+    alias: {
+      '@': path.resolve(__dirname, './src'),
+    },
+  },
+  test: {
+    environment: 'node',
+    include: ['src/**/*.test.ts'],
+    // 'agent': silent for passing tests/files, full detail (diff, stack, code frame)
+    // preserved for failures. Keeps a green run to a few summary lines.
+    reporters: ['agent'],
+  },
+});
```

#### Recent Merged Pull Requests:
- **PR #605** (2026-10-05): docs: add changelog for asc0.5.12 (@github-actions[bot])
- **PR #604** (2026-10-05): Feature: Flyway-style MongoDB migration runner in `registry-pkgs` (AS-1918) (@satoseino)
- **PR #602** (2026-09-30): feat: add workflow scheduling support (@Port127)
- **PR #601** (2026-09-30): Feature/as 1893 (@DYL521)
- **PR #600** (2026-10-01): Feature/as 1890 (@DYL521)
- **PR #599** (2026-09-25): Chore: update post-merge git hooks (@satoseino)
- **PR #597** (2026-09-30): Feature/as 1868 (@DYL521)
- **PR #596** (closed): Feature/as 1868 (@DYL521)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
