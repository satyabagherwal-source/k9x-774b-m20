# Forensic Learning Record (Deep Inspection): ChrispyBacon-dev/DockFlare

> **Canonical Artifact**: `07_PROJECT_LEARNING/chrispybacon-dev-dockflare-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ChrispyBacon-dev/DockFlare](https://github.com/ChrispyBacon-dev/DockFlare))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:25:19.944Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ChrispyBacon-dev/DockFlare`
- **Description**: DockFlare: Automate Cloudflare Tunnels with Docker Labels
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: N/A
- **Stars / Engagement**: 2474 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Remote API meta.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `dockflare/app/core/access_manager.py`
```
# DockFlare: Automates Cloudflare Tunnel ingress from Docker labels.
# Copyright (C) 2025 ChrispyBacon-Dev <https://github.com/ChrispyBacon-dev/DockFlare>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.
#
# dockflare/app/core/access_manager.py
import logging
import json
import hashlib
import requests
import copy
from flask import current_app
from app.core import cloudflare_api
from app.core.state_manager import access_groups, managed_rules, state_lock
from app.core.access_policy_rules import effective_access_policies, login_method_ids, normalize_managed_access_group
from app.core.utils import normalize_path_value

def _build_access_app_payload(application_domain, name, session_duration, app_launcher_visible, self_hosted_domains, access_policies_or_ids, allowed_idps=None, auto_redirect_to_identity=False, use_reusable=False):
    from app import config

    payload = {
        "name": name,
        "domain": application_domain,
        "type": "self_hosted",
        "session_duration": session_duration,
        "app_launcher_visible": app_launcher_visible,
        "self_hosted_domains": self_hosted_domains,
        "auto_redirect_to_identity": auto_redirect_to_identity,
    }

    if access_policies_or_ids is not None:
        payload["policies"] = access_policies_or_ids

    if allowed_idps is not None:
        payload["allowed_idps"] = allowed_idps

    return payload

def check_for_tld_access_policy(zone_name):
    if not zone_name:
        logging.warning("check_for_tld_access_policy called with no zone_name.")
        return False

    tld_hostname = f"*.{zone_name}"
    
    from app.core.cache import get_redis_client
    import json
    redis_client = get_redis_client()
    cache_key = f"tld_policy_check:{zone_name}"
    cache_ttl = 300  # 5 minutes

    if redis_client:
        try:
            cached_result = redis_client.get(cache_key)
            if cached_result is not None:
                result = json.loads(cached_result)
                logging.debug(f"Returning cached TLD policy check for {tld_hostname}: {result}")
                return result
        except Exception as e:
            logging.warning(f"Failed to read TLD policy cache: {e}")

    logging.info(f"Checking for existing Access Policy for wildcard TLD: {tld_hostname}")

    try:
        
        account_id = current_app.config.get('CF_ACCOUNT_ID')
        endpoint = f"/accounts/{account_id}/access/apps"
        from app.core import cloudflare_api

        response_data = cloudflare_api.cf_api_request("GET", endpoint, params={"domain": tld_hostname})
        apps = response_data.get("result", [])

        existing_app = None
        if apps and isinstance(apps, list):
            for app in apps:
                if app.get("domain") == tld_hostname:
                    existing_app = app
                    break

        if existing_app and existing_app.get("id"):
            logging.info(f"Found existing Access Application ID '{existing_app.get('id')}' for TLD '{tld_hostname}'.")
            result = existing_app.get("id")
        else:
            logging.info(f"No specific Access Application found for TLD '{tld_hostname}'.")
            result = None
        
        if redis_client:
            try:
                redis_client.setex(cache_key, cache_ttl, json.dumps(result))
                logging.debug(f"Cached TLD policy check for {tld_hostname}")
            except Exception as e:
                logging.warning(f"Failed to cache TLD policy check: {e}")

        return result
    except Exception as e:
        logging.error(f"Error while checking for TLD access policy for '{tld_hostname}': {e}", exc_info=True)
        return False

def get_cloudflare_account_email():
    return cloudflare_api.get_cloudflare_account_email()

def find_cloudflare_access_application_by_domain(application_domain):
    account_id = current_app.config.get('CF_ACCOUNT_ID')
    logging.info(f"Finding Cloudflare Access Application for domain '{application_domain}' on account {account_id}")
    endpoint = f"/accounts/{account_id}/access/apps"
    try:
        response_data_direct = cloudflare_api.cf_api_request("GET", endpoint, params={"domain": application_domain})
        apps_direct = response_data_direct.get("result", [])
        if apps_direct and isinstance(apps_direct, list):
            for app in apps_direct:
                if app.get("domain") == application_domain:
                    logging.info(f"Found Access Application ID '{app.get('id')}' for domain '{application_domain}' via direct domain query.")
                    return app

        logging.info(f"No exact match for '{application_domain}' via domain query. Falling back to listing all Access Applications.")

        all_apps_response = cloudflare_api.cf_api_request("GET", endpoint, params={"per_page": 100})
        all_apps = all_apps_response.get("result", [])
        if all_apps and isinstance(all_apps, list):
            for app in all_apps:
                if app.get("domain") == application_domain:
                    logging.info(f"Found Access Application ID '{app.get('id')}' for domain '{application_domain}' via full list scan (domain match).")
                    return app
                if application_domain in app.get("self_hosted_domains", []):
                    logging.info(f"Found Access Application ID '{app.get('id')}' for domain '{application_domain}' (in self_hosted_domains) via full list scan.")
                    return app

        logging.info(f"Access Application for domain '{application_domain}' not found after extensive search.")
        return None
    except requests.exceptions.RequestException as e:
        logging.error(f"API error finding Cloudflare Access Application for '{application_domain}': {e}")
        return None
    except Exception as e:
        logging.error(f"Unexpected error finding Cloudflare Access Application for '{application_domain}': {e}", exc_info=True)
        return None

def create_cloudflare_access_application(application_domain, name, session_duration, app_launcher_visible, self_hosted_domains, access_policies, allowed_idps=None, auto_redirect_to_identity=False, use_reusable=False):
    account_id = current_app.config.get('CF_ACCOUNT_ID')
    logging.info(f"Creating Cloudflare Access Application for domain '{application_domain}' on account {account_id}")
    endpoint = f"/accounts/{account_id}/access/apps"

    payload = _build_access_app_payload(application_domain, name, session_duration, app_launcher_visible, self_hosted_domains, access_policies, allowed_idps, auto_redirect_to_identity, use_reusable)

    logging.info(f"Access Application payload for '{application_domain}': use_reusable={use_reusable}, has_policies={'policies' in payload}")
    if 'policies' in payload:
        if use_reusable:
            logging.info(f"Reusable policy IDs: {payload['policies']}")
        else:
            logging.info(f"Inline policies count: {len(payload['policies']) if payload['policies'] else 0}")
    try:
        response_data = cloudflare_api.cf_api_request("POST", endpoint, json_data=payload)
        app_data = response_data.get("result")
        if app_data and app_data.get("id"):
            app_id = app_data.get('id')
            logging.info(f"Successfully created Access Application '{app_id}' for '{application_domain}'")
            return app_data
        else:
            logging.error(f"Access Application creation for '{application_domain}' API call successful but no ID in response: {app_data}")
            return None
    except requests.exceptions.RequestException as e:
        logging.error(f"API error creating Access Application for '{application_domain}': {e}")
        return None
    except Exception as e:
        logging.error(f"Unexpected error creating Access Application for '{application_domain}': {e}", exc_info=True)
        return None

def get_cloudflare_access_application(app_uuid):
    account_id = current_app.config.get('CF_ACCOUNT_ID')
    logging.info(f"Getting Cloudflare Access Application details for ID '{app_uuid}' on account {account_id}")
    endpoint = f"/accounts/{account_id}/access/apps/{app_uuid}"
    try:
        response_data = cloudflare_api.cf_api_request("GET", endpoint)
        if response_data and response_data.get("success"):
            app_data = response_data.get("result")
            if app_data:
                logging.info(f"Successfully retrieved Access Application details for ID '{app_uuid}'")
                return app_data
            elif response_data.get("success"):
                logging.warning(f"Successfully called API for Access App ID '{app_uuid}', but no result data found. Response: {response_data}")
                return None
            else:
                logging.error(f"API call failed or returned success=false for Access App ID '{app_uuid}'. Response: {response_data}")
                return None
    except requests.exceptions.RequestException as e:
        if hasattr(e, 'response') and e.response is not None and e.response.status_code == 404:
            logging.warning(f"Cloudflare Access Application with ID '{app_uuid}' not found (404).")
        else:
            logging.error(f"API error getting Access Application '{app_uuid}': {e}")
        return None
    except Exception as e:
        logging.error(f"Unexpected error getting Access Application '{app_uuid}': {e}", exc_info=Tru
```

### Core Architecture Module: `dockflare/app/core/access_policy_rules.py`
```
SYSTEM_ACCESS_GROUP_IDS = frozenset({
    "public-default-bypass",
    "authenticated-default",
})


def is_system_access_group(group_id, group=None):
    return group_id in SYSTEM_ACCESS_GROUP_IDS or bool((group or {}).get("system_policy"))


def build_access_policies(email_str, ip_ranges_str=None, countries_list=None, idp_list=None, idp_resolver=None, public_mode=False):
    policies = []
    email_rules = []
    ip_rules = []
    idp_rules = []

    if email_str and email_str.strip():
        for part in [value.strip() for value in email_str.split(',') if value.strip()]:
            if part.startswith('@'):
                email_rules.append({"email_domain": {"domain": part[1:]}})
            else:
                email_rules.append({"email": {"email": part}})

    requested_idps = [] if public_mode else [value.strip() for value in (idp_list or []) if value.strip()]
    unresolved_idps = []
    for friendly_name in requested_idps:
        idp_id = idp_resolver(friendly_name) if idp_resolver else None
        if idp_id:
            idp_rules.append({"login_method": {"id": idp_id}})
        else:
            unresolved_idps.append(friendly_name)

    if unresolved_idps:
        raise ValueError(f"Identity provider not found: {', '.join(unresolved_idps)}")

    if idp_rules and not email_rules and not public_mode:
        raise ValueError("When using Identity Providers, you must specify allowed email addresses to prevent unauthorized access.")

    if ip_ranges_str and ip_ranges_str.strip():
        for ip in [value.strip() for value in ip_ranges_str.split(',') if value.strip()]:
            ip_rules.append({"ip": {"ip": ip}})

    if ip_rules:
        policies.append({"name": "Bypass for defined IPs", "decision": "bypass", "include": ip_rules})

    if public_mode:
        policy = {
            "name": "Public Access (Bypass) with geo-blocking" if countries_list else "Public Access (Bypass)",
            "decision": "bypass",
            "include": [{"everyone": {}}]
        }
        if countries_list:
            policy["exclude"] = [{"geo": {"country_code": country.upper()}} for country in countries_list]
        policies.append(policy)
        return policies

    if countries_list and not email_rules and not idp_rules:
        raise ValueError(
            "Invalid configuration: You've selected geo-restrictions but no authentication method (email or identity provider). "
            "To create a public access rule with geo-restrictions, please switch to 'Public Access' mode."
        )

    allow_policies = []
    if idp_rules:
        for index, idp_rule in enumerate(idp_rules, start=1):
            allow_policies.append({
                "name": "Allow defined users" if len(idp_rules) == 1 else f"Allow defined users via IdP {index}",
                "decision": "allow",
                "include": email_rules,
                "require": [idp_rule]
            })
    elif email_rules:
        allow_policies.append({
            "name": "Allow defined users",
            "decision": "allow",
            "include": email_rules
        })

    if countries_list:
        excluded_countries = [{"geo": {"country_code": country.upper()}} for country in countries_list]
        for policy in allow_policies:
            policy["exclude"] = excluded_countries

    policies.extend(allow_policies)
    if allow_policies:
        policies.append({"name": "Default Deny", "decision": "deny", "include": [{"everyone": {}}]})
    else:
        policies.append({"name": "Default Deny (No rules defined)", "decision": "deny", "include": [{"everyone": {}}]})

    return policies


def is_default_deny_policy(policy):
    return (
        policy.get("decision") == "deny"
        and policy.get("include") == [{"everyone": {}}]
    )


def effective_access_policies(group):
    return [
        policy
        for policy in group.get("policies", [])
        if not is_default_deny_policy(policy)
    ]


def login_method_ids(policies):
    ids = []
    for policy in policies:
        for rule_type in ("include", "require"):
            for rule in policy.get(rule_type, []):
                idp_id = rule.get("login_method", {}).get("id")
                if idp_id and idp_id not in ids:
                    ids.append(idp_id)
    return ids


def normalize_managed_access_group(group):
    if group.get("external_policy"):
        return group, False

    normalized_policies = []
    changed = False
    for policy in group.get("policies", []):
        include_rules = policy.get("include", [])
        require_rules = policy.get("require", [])
        combined_rules = include_rules + require_rules
        email_rules = [
            rule for rule in combined_rules
            if "email" in rule or "email_domain" in rule
        ]
        idp_rules = [rule for rule in combined_rules if "login_method" in rule]
        supported_rules = email_rules + idp_rules

        if (
            policy.get("decision") == "allow"
            and email_rules
            and idp_rules
            and len(supported_rules) == len(combined_rules)
        ):
            for index, idp_rule in enumerate(idp_rules, start=1):
                normalized = {
                    key: value
                    for key, value in policy.items()
                    if key not in ("name", "include", "require")
                }
                normalized["name"] = "Allow defined users" if len(idp_rules) == 1 else f"Allow defined users via IdP {index}"
                normalized["include"] = email_rules
                normalized["require"] = [idp_rule]
                normalized_policies.append(normalized)
            if len(idp_rules) != 1 or include_rules != email_rules or require_rules != [idp_rules[0]]:
                changed = True
        else:
            normalized_policies.append(policy)

    normalized_group = dict(group)
    normalized_group["policies"] = normalized_policies
    normalized_group["allowed_idps"] = login_method_ids(normalized_policies)
    if normalized_policies != group.get("policies", []):
        changed = True
    if normalized_group.get("allowed_idps") != group.get("allowed_idps"):
        changed = True
    return normalized_group, changed

```

### Core Architecture Module: `dockflare/app/core/agent_decommission.py`
```
"""Durable, ownership-safe DockFlare Agent decommission orchestration."""

import copy
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone

from app import config, tunnel_state
from app.core.access_manager import delete_cloudflare_access_application
from app.core.cloudflare_api import delete_cloudflare_dns_record, delete_tunnel_via_api
from app.core.state_manager import (
    agent_decommissions,
    add_agent_key,
    agents,
    list_agent_keys,
    managed_rules,
    revoke_agent_key,
    save_state,
    state_lock,
)
from app.core.tunnel_manager import update_cloudflare_config
from app.core import notification_manager


TERMINAL_STATES = {"completed", "forced_completed"}
RETRYABLE_STATES = {"prepare_failed", "cleanup_failed", "finalize_failed", "force_failed", "timed_out"}
FORCEABLE_STATES = {
    "waiting_for_prepare", "prepare_failed", "timed_out", "cleanup_failed",
    "waiting_for_finalize", "finalize_failed",
}
IMAGE_REFERENCE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,254}$")


def _bounded_int_env(name, default, minimum, maximum):
    try:
        return max(minimum, min(maximum, int(os.getenv(name, str(default)))))
    except (TypeError, ValueError):
        return default


DEFAULT_TIMEOUT_SECONDS = _bounded_int_env("AGENT_DECOMMISSION_TIMEOUT_SECONDS", 180, 30, 1800)


def notification_context(operation):
    plan = operation.get("resource_plan") or {}
    results = operation.get("cleanup_results") or {}
    return {
        "agent_name": operation.get("display_name"),
        "agent_id": str(operation.get("agent_id") or "")[:12],
        "tunnel_id": str(plan.get("tunnel_id") or "")[:12],
        "operation_id": str(operation.get("operation_id") or "")[:12],
        "operation": "decommission",
        "rules_count": results.get("rules_removed", len(plan.get("rule_keys") or [])),
        "source": "admin",
        "public_url": config.DOCKFLARE_PUBLIC_URL,
    }


def notify_transition(operation, previous_state=None):
    """Emit a safe notification for a committed decommission state transition."""
    if not isinstance(operation, dict):
        return False
    state = operation.get("state")
    if state == previous_state:
        return False
    if state in TERMINAL_STATES:
        event_type = "agent.decommission_completed"
    elif state == "timed_out":
        event_type = "agent.decommission_stalled"
    elif state in {"prepare_failed", "cleanup_failed", "finalize_failed", "force_failed"}:
        event_type = "agent.decommission_failed"
    else:
        return False
    return notification_manager.emit(
        event_type,
        str(operation.get("operation_id") or operation.get("agent_id") or "unknown"),
        notification_context(operation),
    )


class DecommissionError(RuntimeError):
    """Stable decommission failure safe to map to an API response."""

    def __init__(self, code, http_status=409):
        super().__init__(code)
        self.code = code
        self.http_status = http_status


def _utcnow():
    return datetime.now(timezone.utc)


def _iso(value=None):
    return (value or _utcnow()).isoformat()


def _deadline():
    return _iso(_utcnow() + timedelta(seconds=DEFAULT_TIMEOUT_SECONDS))


def _valid_image_reference(value):
    if not isinstance(value, str):
        return None
    candidate = value.strip()
    return candidate if IMAGE_REFERENCE_RE.fullmatch(candidate) else None


def _agent_rules(agent_id):
    return {
        key: copy.deepcopy(rule)
        for key, rule in managed_rules.items()
        if rule.get("source") == "agent" and rule.get("agent_id") == agent_id
    }


def _tunnel_disposition(agent_id, agent, rules):
    tunnel_id = agent.get("assigned_tunnel_id")
    ownership = agent.get("assigned_tunnel_ownership", "unknown")
    if not tunnel_id or ownership != "created_exclusive":
        return "preserve_adopted" if ownership == "adopted" else "unknown"
    if tunnel_state.get("id") == tunnel_id:
        return "preserve_shared"
    if any(
        other_id != agent_id and other.get("assigned_tunnel_id") == tunnel_id
        for other_id, other in agents.items()
    ):
        return "preserve_shared"
    owned_keys = set(rules)
    if any(
        key not in owned_keys and rule.get("tunnel_id") == tunnel_id
        for key, rule in managed_rules.items()
    ):
        return "preserve_shared"
    return "delete_exclusive"


def _build_resource_plan(agent_id, agent):
    rules = _agent_rules(agent_id)
    tunnel_id = agent.get("assigned_tunnel_id")
    dns_targets = sorted({
        (rule.get("zone_id"), rule.get("hostname"))
        for rule in rules.values()
        if rule.get("zone_id") and rule.get("hostname") and not rule.get("hostname", "").startswith("*.")
    })
    return {
        "tunnel_id": tunnel_id,
        "tunnel_disposition": _tunnel_disposition(agent_id, agent, rules),
        "rule_keys": sorted(rules),
        "dns_targets": [{"zone_id": zone_id, "hostname": hostname} for zone_id, hostname in dns_targets],
        "access_app_ids": sorted({
            rule.get("access_app_id") for rule in rules.values() if rule.get("access_app_id")
        }),
    }


def preview_decommission(agent_id):
    """Return a non-mutating, secret-safe preflight view for the admin UI."""
    with state_lock:
        agent = agents.get(agent_id)
        if not agent:
            raise DecommissionError("agent_not_found", 404)
        plan = _build_resource_plan(agent_id, agent)
        return {
            "agent_id": agent_id,
            "display_name": str(agent.get("display_name") or f"agent-{agent_id[:8]}")[:128],
            "last_seen": agent.get("last_seen"),
            "assigned_tunnel_name": agent.get("assigned_tunnel_name"),
            "resource_plan": {
                "tunnel_disposition": plan["tunnel_disposition"],
                "rule_count": len(plan["rule_keys"]),
                "dns_record_count": len(plan["dns_targets"]),
                "access_app_count": len(plan["access_app_ids"]),
            },
            "remote_actions": {
                "tunnel_container": "stop_only",
                "agent_container": (
                    "stop_scheduled"
                    if "self_stop.v1" in (agent.get("capabilities") or [])
                    else "manual"
                ),
            },
            "container_names": ["dockflare-agent-tunnel", "dockflare-agent"],
            "deployment_directory": "$HOME/dockflare-agent",
            "preserve_networks": ["cloudflare-net"],
        }


def _new_operation(agent_id, agent):
    operation_id = str(uuid.uuid4())
    command_id = str(uuid.uuid4())
    now = _iso()
    return {
        "operation_id": operation_id,
        "agent_id": agent_id,
        "display_name": str(agent.get("display_name") or f"agent-{agent_id[:8]}")[:128],
        "state": "waiting_for_prepare",
        "requested_at": now,
        "updated_at": now,
        "deadline_at": _deadline(),
        "prepare_command_id": command_id,
        "finalize_command_id": None,
        "requested_self_action": "stop",
        "agent_capabilities": copy.deepcopy(agent.get("capabilities") or []),
        "remote_results": {
            "tombstone_persisted": False,
            "tunnel_container": "pending",
            "agent_container": "stop_pending",
            "host_container_removal_required": True,
        },
        "resource_plan": _build_resource_plan(agent_id, agent),
        "cleanup_results": {},
        "host_cleanup_plan": {
            "agent_container_name": "dockflare-agent",
            "tunnel_container_name": "dockflare-agent-tunnel",
            "socket_proxy_container_name": "dockflare-socket-proxy",
            "compose_services": ["docker-socket-proxy", "dockflare-init", "dockflare-agent"],
            "compose_filename": "docker-compose.yml",
            "deployment_directory": "$HOME/dockflare-agent",
            "agent_image": None,
            "cloudflared_image": None,
            "preserve_networks": ["cloudflare-net"],
        },
        "last_error_code": None,
        "retry_count": 0,
        "forced": False,
        "durable_command": {
            "action": "prepare_decommission",
            "protocol_version": 1,
            "operation_id": operation_id,
            "command_id": command_id,
            "requested_self_action": "stop",
            "expected_tunnel_id": agent.get("assigned_tunnel_id"),
            "created_at": now,
        },
        "acknowledged_commands": [],
    }


def start_decommission(agent_id):
    """Persist or return one active decommission operation for an Agent."""
    with state_lock:
        agent = agents.get(agent_id)
        if not agent:
            raise DecommissionError("agent_not_found", 404)
        for operation in agent_decommissions.values():
            if operation.get("agent_id") == agent_id and operation.get("state") not in TERMINAL_STATES:
                return copy.deepcopy(operation), False
        operation = _new_operation(agent_id, agent)
        previous_agent = copy.deepcopy(agent)
        agent_decommissions[operation["operation_id"]] = operation
        agent.update({
            "decommission_operation_id": operation["operation_id"],
            "decommission_state": operation["state"],
        })
        if not save_state():
            agent.clear()
            agent.update(previous_agent)
            agent_decommissions.pop(operation["operation_id"], None)
            raise DecommissionError("persistence_failed", 503)
        return copy.deepcopy(operation), True


def get_operation(operation_id):
    with state_lock:
        operation = agent_decommissions.get(operation_id)
        return copy.deepcopy(operation) if operation else None


def command_for_agent(agent_id):
    with state_lock:
        agent = agents.get(agent_id)
        if not agent:
            return None
        operation_id = agent.get("decommission_operation_id")
        operation = age
```

### Core Architecture Module: `dockflare/app/core/agent_key_store.py`
```
# DockFlare: Automates Cloudflare Tunnel ingress from Docker labels.
# Copyright (C) 2025 ChrispyBacon-Dev <https://github.com/ChrispyBacon-dev/DockFlare>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.
#
# dockflare/app/core/agent_key_store.py    
import json
import logging
import os
import threading
from typing import Dict, Optional

from cryptography.fernet import Fernet, InvalidToken

from app import config

_store_lock = threading.RLock()
_cached_keys: Dict[str, Dict] = {}
_initialized = False


def _data_directory() -> str:
    return os.path.dirname(config.STATE_FILE_PATH)


def _store_path() -> str:
    custom_path = getattr(config, "AGENT_KEY_STORAGE_PATH", None)
    if custom_path:
        if os.path.isabs(custom_path):
            return custom_path
        return os.path.join(_data_directory(), custom_path)
    return os.path.join(_data_directory(), "agent_keys.dat")


def get_store_path() -> str:
    """Return the absolute path to the encrypted agent key store."""
    return _store_path()


def _fernet() -> Optional[Fernet]:
    key_file = os.path.join(_data_directory(), "dockflare.key")
    if not os.path.exists(key_file):
        logging.warning("AGENT_KEY_STORE: Encryption key file missing (%s).", key_file)
        return None
    try:
        with open(key_file, "rb") as fh:
            key_bytes = fh.read()
        return Fernet(key_bytes)
    except (OSError, ValueError) as err:
        logging.error("AGENT_KEY_STORE: Failed loading Fernet key: %s", err, exc_info=True)
        return None


def _persist_locked() -> None:
    fernet = _fernet()
    if fernet is None:
        logging.error("AGENT_KEY_STORE: Persist failed because the encryption key is unavailable.")
        raise RuntimeError("Agent key store encryption key is unavailable")

    payload = {"keys": _cached_keys}
    try:
        serialized = json.dumps(payload).encode("utf-8")
        encrypted = fernet.encrypt(serialized)
        target_path = _store_path()
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        temp_path = f"{target_path}.tmp"
        with open(temp_path, "wb") as fh:
            fh.write(encrypted)
        os.replace(temp_path, target_path)
        logging.debug("AGENT_KEY_STORE: Persisted %d keys to encrypted store.", len(_cached_keys))
    except Exception as err:  # pylint: disable=broad-except
        logging.error("AGENT_KEY_STORE: Failed to persist key store: %s", err, exc_info=True)
        raise


def _load_locked() -> None:
    global _initialized
    fernet = _fernet()
    if fernet is None:
        _cached_keys.clear()
        _initialized = True
        return

    store_file = _store_path()
    if not os.path.exists(store_file):
        _cached_keys.clear()
        _initialized = True
        return

    try:
        with open(store_file, "rb") as fh:
            encrypted = fh.read()
        decrypted = fernet.decrypt(encrypted)
        payload = json.loads(decrypted.decode("utf-8"))
        keys = payload.get("keys", {}) if isinstance(payload, dict) else {}
        if not isinstance(keys, dict):
            raise ValueError("Invalid agent key store format: 'keys' is not a dict")
        _cached_keys.clear()
        _cached_keys.update(keys)
        logging.info("AGENT_KEY_STORE: Loaded %d keys from encrypted store.", len(_cached_keys))
    except (InvalidToken, ValueError) as err:
        logging.error("AGENT_KEY_STORE: Failed to decrypt key store: %s", err, exc_info=True)
        _cached_keys.clear()
    except Exception as err:  # pylint: disable=broad-except
        logging.error("AGENT_KEY_STORE: Unexpected error loading store: %s", err, exc_info=True)
        _cached_keys.clear()
    finally:
        _initialized = True


def _ensure_loaded() -> None:
    with _store_lock:
        if not _initialized:
            _load_locked()


def list_keys() -> Dict[str, Dict]:
    _ensure_loaded()
    with _store_lock:
        return {token: dict(meta) for token, meta in _cached_keys.items() if not token.startswith('__')}


def get_key(token: str) -> Optional[Dict]:
    if not token:
        return None
    _ensure_loaded()
    with _store_lock:
        entry = _cached_keys.get(token)
        return dict(entry) if isinstance(entry, dict) else None


def upsert_key(token: str, metadata: Optional[Dict] = None) -> None:
    if not token:
        raise ValueError("token is required")
    _ensure_loaded()
    with _store_lock:
        _cached_keys[token] = dict(metadata) if metadata else {}
        _persist_locked()


def remove_key(token: str) -> None:
    if not token:
        return
    _ensure_loaded()
    with _store_lock:
        if token in _cached_keys:
            del _cached_keys[token]
            _persist_locked()


def bulk_replace(keys: Dict[str, Dict]) -> None:
    if not isinstance(keys, dict):
        raise ValueError("keys must be a dict")
    _ensure_loaded()
    with _store_lock:
        _cached_keys.clear()
        for token, metadata in keys.items():
            if not isinstance(metadata, dict):
                logging.warning("AGENT_KEY_STORE: Skipping non-dict metadata for token %s", token)
                continue
            _cached_keys[token] = metadata
        _persist_locked()


def clear_store() -> None:
    _ensure_loaded()
    with _store_lock:
        _cached_keys.clear()
        _persist_locked()


def reload_store() -> None:
    global _initialized
    with _store_lock:
        _initialized = False
    _ensure_loaded()


_CF_SERVICE_TOKEN_KEY = "__cf_service_token__"


def get_service_token_secret() -> Optional[str]:
    _ensure_loaded()
    with _store_lock:
        entry = _cached_keys.get(_CF_SERVICE_TOKEN_KEY)
        if isinstance(entry, dict):
            return entry.get("secret")
        return None


def store_service_token_secret(secret: str) -> None:
    if not secret:
        raise ValueError("secret is required")
    _ensure_loaded()
    with _store_lock:
        _cached_keys[_CF_SERVICE_TOKEN_KEY] = {"secret": secret}
        _persist_locked()


def clear_service_token_secret() -> None:
    _ensure_loaded()
    with _store_lock:
        if _CF_SERVICE_TOKEN_KEY in _cached_keys:
            del _cached_keys[_CF_SERVICE_TOKEN_KEY]
            _persist_locked()


_AGENT_TUNNEL_PREFIX = "__agent_tunnel__"


def store_agent_tunnel_token(agent_id, token) -> None:
    if not agent_id or not token:
        return
    _ensure_loaded()
    with _store_lock:
        _cached_keys[f"{_AGENT_TUNNEL_PREFIX}{agent_id}"] = {"token": token}
        _persist_locked()


def get_agent_tunnel_token(agent_id):
    if not agent_id:
        return None
    _ensure_loaded()
    with _store_lock:
        entry = _cached_keys.get(f"{_AGENT_TUNNEL_PREFIX}{agent_id}")
        if isinstance(entry, dict):
            return entry.get("token")
        return None


def clear_agent_tunnel_token(agent_id) -> None:
    if not agent_id:
        return
    _ensure_loaded()
    with _store_lock:
        if f"{_AGENT_TUNNEL_PREFIX}{agent_id}" in _cached_keys:
            del _cached_keys[f"{_AGENT_TUNNEL_PREFIX}{agent_id}"]
            _persist_locked()

```

### Core Architecture Module: `dockflare/app/core/backup_manager.py`
```
# DockFlare: Automates Cloudflare Tunnel ingress from Docker labels.
# Copyright (C) 2025 ChrispyBacon-Dev <https://github.com/ChrispyBacon-dev/DockFlare>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.
#
# dockflare/app/core/backup_manager.py
import datetime as _dt
import hashlib
import io
import json
import logging
import os
import threading
import zipfile
from typing import BinaryIO, Dict, List, Tuple

from flask import current_app

from app import config
from app.core import agent_key_store

MANIFEST_NAME = "manifest.json"
MANIFEST_VERSION = 1
RESTART_FLAG_NAME = "restore-restart.flag"


def _data_directory() -> str:
    return os.path.dirname(config.STATE_FILE_PATH)


def _known_files() -> List[Tuple[str, str, bool]]:
    data_dir = _data_directory()
    return [
        ("dockflare.key", os.path.join(data_dir, "dockflare.key"), True),
        ("dockflare_config.dat", os.path.join(data_dir, "dockflare_config.dat"), True),
        ("state.json", config.STATE_FILE_PATH, False),
        ("agent_keys.dat", agent_key_store.get_store_path(), False),
    ]


def _hash_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def create_backup_archive() -> Tuple[io.BytesIO, str]:
    """
    Bundle DockFlare data files into an in-memory ZIP archive.

    Returns (buffer, suggested_filename).
    """
    buffer = io.BytesIO()
    manifest: Dict = {
        "schema": MANIFEST_VERSION,
        "generated_at": _dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "app_version": config.APP_VERSION,
        "files": []
    }

    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, path, required in _known_files():
            if not os.path.exists(path):
                if required:
                    raise FileNotFoundError(f"Required file missing for backup: {path}")
                logging.info("BACKUP: Optional file '%s' not found; skipping.", name)
                continue

            with open(path, "rb") as fh:
                content = fh.read()
            archive.writestr(name, content)
            manifest["files"].append({
                "name": name,
                "sha256": _hash_bytes(content),
                "size": len(content),
                "required": required
            })

        archive.writestr(MANIFEST_NAME, json.dumps(manifest, indent=2).encode("utf-8"))

    buffer.seek(0)
    timestamp = _dt.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"dockflare_backup_{timestamp}.zip"
    return buffer, filename


class RestoreResult:
    """Simple container describing the outcome of a restore."""

    def __init__(self, *, mode: str, files_applied: List[str]):
        self.mode = mode
        self.files_applied = files_applied

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"RestoreResult(mode={self.mode!r}, files_applied={self.files_applied!r})"


def _write_file_atomic(target_path: str, payload: bytes) -> None:
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    temp_path = f"{target_path}.tmp"
    with open(temp_path, "wb") as fh:
        fh.write(payload)
    os.replace(temp_path, target_path)


def _apply_zip_backup(buffer: BinaryIO) -> RestoreResult:
    with zipfile.ZipFile(buffer, mode="r") as archive:
        if MANIFEST_NAME not in archive.namelist():
            raise ValueError("Backup archive missing manifest.json")
        manifest_data = json.loads(archive.read(MANIFEST_NAME).decode("utf-8"))
        files_meta = manifest_data.get("files") or []
        applied: List[str] = []

        index = {name: path for name, path, _ in _known_files()}
        required_map = {name: required for name, _, required in _known_files()}

        for entry in files_meta:
            name = entry.get("name")
            if not name:
                continue
            required = entry.get("required", True)
            if required_map.get(name, required) and name not in archive.namelist():
                raise ValueError(f"Backup archive missing required file: {name}")

            if name not in archive.namelist():
                continue

            payload = archive.read(name)
            expected_hash = entry.get("sha256")
            if expected_hash and _hash_bytes(payload) != expected_hash:
                raise ValueError(f"Checksum mismatch for {name}")

            target = index.get(name)
            if not target:
                logging.warning("RESTORE: Unknown file '%s' in archive; skipping.", name)
                continue

            _write_file_atomic(target, payload)
            applied.append(name)

    return RestoreResult(mode="zip", files_applied=applied)


def _apply_legacy_state(payload: bytes) -> RestoreResult:
    try:
        parsed = json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError as err:
        raise ValueError("Legacy state file is not valid JSON") from err

    if not isinstance(parsed, dict) or "managed_rules" not in parsed:
        raise ValueError("Legacy state file missing expected fields")

    _write_file_atomic(config.STATE_FILE_PATH, json.dumps(parsed, indent=2).encode("utf-8"))
    return RestoreResult(mode="legacy_state", files_applied=["state.json"])


def restore_backup(file_storage, *, allow_legacy_json: bool) -> RestoreResult:
    """
    Restore DockFlare data from an uploaded file-like object.
    """
    raw_bytes = file_storage.read()
    buffer = io.BytesIO(raw_bytes)
    buffer.seek(0)

    if zipfile.is_zipfile(buffer):
        buffer.seek(0)
        result = _apply_zip_backup(buffer)
        buffer.close()
        return result

    if allow_legacy_json:
        return _apply_legacy_state(raw_bytes)

    raise ValueError("Backup must be a DockFlare archive (.zip)")


def refresh_runtime_after_restore(result: RestoreResult) -> None:
    """Best-effort runtime refresh after files have been restored."""
    restart_required = False

    if "state.json" in result.files_applied:
        try:
            from app.core.state_manager import load_state

            load_state()
            logging.info("RESTORE: State file reloaded into memory.")
        except Exception as err:  # pylint: disable=broad-except
            logging.error("RESTORE: Failed to reload state: %s", err, exc_info=True)

    if "agent_keys.dat" in result.files_applied:
        try:
            agent_key_store.reload_store()
        except Exception as err:  # pylint: disable=broad-except
            logging.error("RESTORE: Failed to reload agent key store: %s", err, exc_info=True)

    if any(name in result.files_applied for name in ("dockflare_config.dat", "dockflare.key")):
        try:
            # When restoring config/key we need to ensure Flask config is refreshed if possible.
            from app.web import config_loader

            config_data = config_loader.load_encrypted_config()
            if config_data:
                config_loader.apply_config_to_app(current_app, config_data)
                restart_required = True
        except Exception as err:  # pylint: disable=broad-except
            logging.error("RESTORE: Failed to refresh application config: %s", err, exc_info=True)

    if restart_required:
        flag_path = os.path.join(_data_directory(), RESTART_FLAG_NAME)
        try:
            with open(flag_path, "w", encoding="utf-8") as fh:
                fh.write("restart_pending\n")
            logging.info("RESTORE: Created restart flag at %s", flag_path)
        except Exception as err:  # pylint: disable=broad-except
            logging.error("RESTORE: Failed to create restart flag: %s", err, exc_info=True)
        _schedule_process_exit()


def _schedule_process_exit(delay_seconds: float = 6.0) -> None:
    """Schedule a process exit to allow Docker to restart the container."""

    def _exit_process():
        try:
            logging.info("RESTORE: Exiting process to complete restore restart.")
        finally:
            os._exit(0)

    timer = threading.Timer(delay_seconds, _exit_process)
    timer.daemon = True
    timer.start()

```

### Core Architecture Module: `dockflare/app/core/cache.py`
```
# DockFlare: Automates Cloudflare Tunnel ingress from Docker labels.
# Copyright (C) 2025 ChrispyBacon-Dev <https://github.com/ChrispyBacon-dev/DockFlare>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.
#
# dockflare/app/core/cache.py
import fnmatch
import logging
import os
import threading
import time

import redis
from flask_caching import Cache

from app import config

cache_config = {
    "CACHE_TYPE": "SimpleCache",
    "CACHE_DEFAULT_TIMEOUT": 300  # 5 minutes default
}

redis_url = os.getenv("REDIS_URL")
if redis_url:
    redis_db_index = config.REDIS_DB_INDEX

    if '/' in redis_url:
        base_url = redis_url.rsplit('/', 1)[0]
        final_redis_url = f"{base_url}/{redis_db_index}"
    else:
        final_redis_url = f"{redis_url}/{redis_db_index}"

    cache_config = {
        "CACHE_TYPE": "RedisCache",
        "CACHE_REDIS_URL": final_redis_url,
        "CACHE_DEFAULT_TIMEOUT": 300,
        "CACHE_KEY_PREFIX": "dockflare_"
    }
    logging.info(f"Redis caching enabled with URL: {final_redis_url}")
else:
    logging.warning("Redis URL not provided. Using in-memory caching instead.")

cache = Cache(config=cache_config)

DNS_RECORDS_CACHE_TIMEOUT = int(os.getenv("DNS_RECORDS_CACHE_TIMEOUT", "300"))  # 5 minutes default
CACHE_REFRESH_INTERVAL = int(os.getenv("CACHE_REFRESH_INTERVAL", "3600"))  # 1 hour default
ENABLE_PERIODIC_CACHE_REFRESH = os.getenv("ENABLE_PERIODIC_CACHE_REFRESH", "true").lower() == "true"
CACHE_ENABLED = os.getenv("CACHE_ENABLED", "true").lower() == "true"

_redis_client = None

def get_redis_client():
    global _redis_client
    cache_type = cache_config.get("CACHE_TYPE")

    if cache_type == "RedisCache":
        if _redis_client is None:
            try:
                redis_url = cache_config.get("CACHE_REDIS_URL")
                if not redis_url:
                    logging.error(f"get_redis_client: CACHE_REDIS_URL not found. cache_config keys: {list(cache_config.keys())}")
                    return None
                _redis_client = redis.from_url(redis_url)
                logging.info(f"Created dedicated Redis client for pub/sub from URL: {redis_url}")
            except Exception as e:
                logging.error(f"Failed to create Redis pub/sub client: {e}")
                return None
        return _redis_client
    else:
        logging.info(f"get_redis_client: Redis not configured (CACHE_TYPE={cache_type}), returning None")
    return None

def init_app(app):
    """Initialize the cache with the Flask app"""
    cache.init_app(app)
    logging.info(f"Cache initialized with type: {cache_config['CACHE_TYPE']}")

    if CACHE_ENABLED and ENABLE_PERIODIC_CACHE_REFRESH:
        schedule_periodic_cache_refresh()

def get_dns_records_cache_key(zone_id, tunnel_id):

    return f"dns_records:{zone_id}:{tunnel_id}"

def clear_dns_records_cache(zone_id=None, tunnel_id=None):

    if not CACHE_ENABLED:
        return
        
    if zone_id and tunnel_id:
        key = get_dns_records_cache_key(zone_id, tunnel_id)
        cache.delete(key)
        logging.debug(f"Cleared DNS records cache for zone {zone_id}, tunnel {tunnel_id}")
    elif zone_id:
        pattern = f"dns_records:{zone_id}:*"
        _delete_keys_by_pattern(pattern)
        logging.debug(f"Cleared all DNS records caches for zone {zone_id}")
    elif tunnel_id:
        pattern = f"dns_records:*:{tunnel_id}"
        _delete_keys_by_pattern(pattern)
        logging.debug(f"Cleared all DNS records caches for tunnel {tunnel_id}")
    else:
        pattern = "dns_records:*"
        _delete_keys_by_pattern(pattern)
        logging.debug("Cleared all DNS records caches")

def _delete_keys_by_pattern(pattern):
    
    if not CACHE_ENABLED:
        return
        
    try:

        if cache.config['CACHE_TYPE'] == 'RedisCache' and hasattr(cache, 'cache') and hasattr(cache.cache, '_client'):
            redis_client = cache.cache._client
            prefix = cache.config.get('CACHE_KEY_PREFIX', '')
            full_pattern = f"{prefix}{pattern}"
            cursor = '0'
            while cursor != 0:
                cursor, keys = redis_client.scan(cursor=cursor, match=full_pattern, count=100)
                if keys:
                    redis_client.delete(*keys)
                    logging.debug(f"Deleted {len(keys)} keys matching pattern {full_pattern}")
                cursor = int(cursor)
        elif cache.config['CACHE_TYPE'] == 'SimpleCache' and hasattr(cache, 'cache') and hasattr(cache.cache, '_cache'):
            matching_keys = [
                key for key in list(cache.cache._cache)
                if fnmatch.fnmatch(key, pattern)
            ]
            for key in matching_keys:
                cache.cache.delete(key)
            logging.debug(f"Deleted {len(matching_keys)} SimpleCache keys matching pattern {pattern}")
        else:
            logging.debug("Pattern-based cache invalidation skipped for unsupported cache backend")
    except Exception as e:
        logging.error(f"Error deleting keys by pattern {pattern}: {e}", exc_info=True)

def clear_zone_caches(zone_id=None):
    
    if not CACHE_ENABLED:
        return
        
    if zone_id:
        cache.delete(f"zone_details:{zone_id}")
        clear_dns_records_cache(zone_id=zone_id)
        logging.debug(f"Cleared all caches for zone {zone_id}")
    else:
        _delete_keys_by_pattern("zone_details:*")
        _delete_keys_by_pattern("zone_id:*")
        logging.debug("Cleared all zone caches")

def schedule_periodic_cache_refresh():
    
    if not CACHE_ENABLED:
        return
        
    def refresh_critical_caches():
    
        while True:
            try:
                logging.info("Performing periodic refresh of critical caches")
                clear_dns_records_cache()
                time.sleep(CACHE_REFRESH_INTERVAL)
            except Exception as e:
                logging.error(f"Error in periodic cache refresh: {e}", exc_info=True)
                time.sleep(60) 
        
    refresh_thread = threading.Thread(
        target=refresh_critical_caches,
        daemon=True,
        name="CacheRefreshThread"
    )
    refresh_thread.start()
    logging.info("Started periodic cache refresh thread")

def get_cache_stats():
        
    stats = {
        'connected': False,
        'dns_records_count': 0
    }
    
    if not CACHE_ENABLED:
        return stats
    
    try:
    
        if not hasattr(cache, 'config'):
            logging.warning("Cache not fully initialized yet when getting stats")
            return stats
    
        stats['connected'] = cache.config.get('CACHE_TYPE') == 'RedisCache'
        
        if stats['connected']:
            try:
                if hasattr(cache, 'cache') and hasattr(cache.cache, '_client'):
                    redis_client = cache.cache._client
                    redis_client.ping()
                else:
                    stats['connected'] = False
            except Exception as e:
                logging.error(f"Error connecting to Redis: {e}", exc_info=True)
                stats['connected'] = False
        
        if stats['connected'] and hasattr(cache, 'cache') and hasattr(cache.cache, '_client'):
            redis_client = cache.cache._client
            prefix = cache.config.get('CACHE_KEY_PREFIX', '')
            pattern = f"{prefix}dns_records:*"
            cursor = '0'
            dns_records_count = 0
            
            while cursor != 0:
                cursor, keys = redis_client.scan(cursor=cursor, match=pattern, count=100)
                dns_records_count += len(keys)
                cursor = int(cursor)
                
            stats['dns_records_count'] = dns_records_count
        else:
            
            stats['dns_records_count'] = -1  
            
    except Exception as e:
        logging.error(f"Error getting cache stats: {e}", exc_info=True)
        
    return stats
```

### Core Architecture Module: `dockflare/app/core/cloudflare_api.py`
```
# DockFlare: Automates Cloudflare Tunnel ingress from Docker labels.
# Copyright (C) 2025 ChrispyBacon-Dev <https://github.com/ChrispyBacon-dev/DockFlare>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.
#
# dockflare/app/core/cloudflare_api.py
import logging
import requests
import json
import time
import threading
from flask import current_app
from app import config
from app.core.cache import cache, get_dns_records_cache_key, DNS_RECORDS_CACHE_TIMEOUT, CACHE_ENABLED
from app.core.zone_resolver import ZoneResolutionError, hostname_in_zone, normalize_dns_name, resolve_zone

zone_id_cache = {}  
zone_details_by_id_cache = {}  
_last_good_zone_inventories = {}
_cached_account_email = None
_cached_account_email_timestamp = 0
_cache_lock = threading.Lock()
_zone_inventory_lock = threading.Lock()

dns_semaphore = threading.Semaphore(config.MAX_CONCURRENT_DNS_OPS)

def clear_zone_resolution_caches(account_id=None):
    global zone_id_cache, zone_details_by_id_cache, _last_good_zone_inventories
    with _cache_lock:
        zone_id_cache.clear()
        zone_details_by_id_cache.clear()
        if account_id:
            _last_good_zone_inventories.pop(account_id, None)
        else:
            _last_good_zone_inventories.clear()
    if account_id:
        cache.delete(f"zones:{account_id}")

def _serialize_zone_inventory(func):
    def wrapped(*args, **kwargs):
        with _zone_inventory_lock:
            return func(*args, **kwargs)
    return wrapped

def cf_api_request(method, endpoint, json_data=None, params=None, log_errors=True):

    url = f"{config.CF_API_BASE_URL}{endpoint}"
    error_msg = None
    try:
        logging.info(f"CF API Request: {method} {url} Params: {params}")
        if json_data:

            try:
                log_data = json.dumps(json_data)
            except TypeError:
                log_data = str(json_data) 
            logging.debug(f"CF API Request Data: {log_data[:500]}")
            
        response = requests.request(
            method,
            url,
            headers=config.CF_HEADERS,
            json=json_data,
            params=params,
            timeout=30
        )
        response.raise_for_status()
        logging.info(f"CF API Response Status: {response.status_code}")

        if response.status_code == 204 or not response.content:
            return {"success": True, "result": None}
        
        try:
            response_data = response.json()
            logging.debug(f"CF API Response Body (first 500 chars): {str(response_data)[:500]}")
            
            if isinstance(response_data, dict) and 'success' in response_data:
                if response_data['success']:
                    return response_data
                else:
                    cf_errors = response_data.get('errors', [])
                    error_code = None
                    if cf_errors and isinstance(cf_errors, list) and len(cf_errors) > 0 and isinstance(cf_errors[0], dict):
                        error_msg = f"API Error: {cf_errors[0].get('message', 'Unknown error')}"
                        error_code = cf_errors[0].get('code')
                    else:
                        error_msg = f"API reported failure but no error details provided. Response: {response_data}"
                    if log_errors:
                        logging.error(f"CF API Request Failed ({method} {url}): {error_msg} - Full Errors: {cf_errors}")
                    api_exception = requests.exceptions.RequestException(error_msg, response=response)
                    api_exception.cf_error_code = error_code
                    raise api_exception
            else:
                logging.warning(f"CF API response for {method} {url} was valid JSON but missing 'success' field. Status: {response.status_code}. Body: {str(response_data)[:200]}")
                raise requests.exceptions.RequestException(f"Unexpected JSON response format from API. Status: {response.status_code}", response=response)

        except json.JSONDecodeError:
            logging.error(f"CF API response for {method} {url} was not valid JSON. Status: {response.status_code}. Body: {response.text[:200]}")
            raise requests.exceptions.RequestException(f"Invalid JSON response from API. Status: {response.status_code}", response=response)
            
    except requests.exceptions.RequestException as e:
        if error_msg is None:
            log_error_msg = f"CF API Request Failed: {method} {url}. Original Exception: {e}"

            if e.response is not None:
                try:
                    error_data = e.response.json()
                    cf_errors = error_data.get('errors', [])
                    if cf_errors and isinstance(cf_errors, list) and len(cf_errors) > 0 and isinstance(cf_errors[0], dict):
                        if not hasattr(e, 'cf_error_code'):
                             e.cf_error_code = cf_errors[0].get('code')
                        log_error_msg += f" - API Details: {cf_errors[0].get('message', 'Unknown error')}"
                    else:
                        log_error_msg += f" - HTTP {e.response.status_code} - Response Text (first 100): {e.response.text[:100]}"
                    if log_errors:
                        logging.error(f"CF API Error Response Body: {error_data}")
                except (ValueError, AttributeError, json.JSONDecodeError):
                    log_error_msg += f" - HTTP {e.response.status_code} - Response Text (first 100): {e.response.text[:100]}"
            if log_errors:
                logging.error(log_error_msg)
        raise

def get_zone_id_from_name(zone_name):
 
    global zone_id_cache
    if not zone_name:
        logging.warning("get_zone_id_from_name called with empty zone_name.")
        return None
    
    try:
        normalized_zone_name = normalize_dns_name(zone_name, allow_wildcard=False)
    except ZoneResolutionError:
        return None
    account_id = current_app.config.get('CF_ACCOUNT_ID')
    cache_key = (account_id, normalized_zone_name)
    cache_ttl = config.ACCOUNT_EMAIL_CACHE_TTL
    current_time = time.time()

    with _cache_lock:
        cached_data = zone_id_cache.get(cache_key)
        if cached_data:
            zone_id, timestamp = cached_data
            if current_time - timestamp < cache_ttl:
                logging.debug(f"Zone ID for '{zone_name}' found in cache: {zone_id}")
                return zone_id
            else:
                logging.debug(f"Cached Zone ID for '{zone_name}' expired, refreshing.")
    
    logging.info(f"Zone ID for '{zone_name}' not in cache or expired. Querying Cloudflare API...")
    endpoint = "/zones"
    params = {"name": normalized_zone_name, "status": "active", "account.id": account_id}
    try:
        response_data = cf_api_request("GET", endpoint, params=params)
        results = response_data.get("result", [])

        if results and isinstance(results, list) and len(results) == 1:
            zone_id = results[0].get("id")
            zone_actual_name = results[0].get("name")
            try:
                actual_normalized = normalize_dns_name(zone_actual_name, allow_wildcard=False)
            except ZoneResolutionError:
                actual_normalized = None
            if zone_id and actual_normalized == normalized_zone_name:
                logging.info(f"Found Zone ID for '{zone_name}': {zone_id}")
                with _cache_lock:
                    zone_id_cache[cache_key] = (zone_id, current_time)
                return zone_id
            else:
                logging.error(f"API returned unexpected result or name mismatch for zone '{zone_name}': {results[0]}")
                return None
        elif results and len(results) > 1:
            logging.error(f"API returned multiple ({len(results)}) active zones matching name '{zone_name}' for account {current_app.config.get('CF_ACCOUNT_ID')}. Cannot determine correct zone.")
            return None
        else:
            logging.warning(f"No active zone found matching name '{zone_name}' for account {current_app.config.get('CF_ACCOUNT_ID')} via API.")
            return None
    except requests.exceptions.RequestException as e:
        logging.error(f"API error looking up zone '{zone_name}': {e}")
        return None
    except Exception as e:
        logging.error(f"Unexpected error looking up zone '{zone_name}': {e}", exc_info=True)
        return None

def get_zone_details_by_id(zone_id_to_check): 

    global zone_details_by_id_cache
    if not zone_id_to_check:
        logging.warning("get_zone_details_by_id called with empty zone_id.")
        return None

    with _cache_lock:
        if zone_id_to_check in zone_details_by_id_cache:
            logging.debug(f"Zone details for ID '{zone_id_to_check}' found in cache.")
            return zone_details_by_id_cache[zone_id_to_check]

    logging.info(f"Zone details for ID '{zone_id_to_check}' not in cache. Querying Cloudflare API...")
    endpoint = f"/zones/{zone_id_to_check}"
    try:
        response_data = cf_api_request("GET", endpoint)
        if response_data and response_data.get("success"):
            zone_data = response_data.get("result")
            if zone_data and isinstance(zone_data, dict) and zone_data.get("name"):
                logging.info(f"Found zone details for ID '{zone_id_to_check}': Name '{zone_data['name']}'")
                with _cache_lock:
 
```

### Core Architecture Module: `dockflare/app/core/container_name.py`
```
import re


def build_cloudflared_container_name(tunnel_name):
    if not tunnel_name:
        return None
    tunnel_name_str = str(tunnel_name).strip()
    if not tunnel_name_str:
        return None
    normalized = re.sub(r"[^a-zA-Z0-9_.-]+", "-", tunnel_name_str)
    normalized = re.sub(r"[-_.]{2,}", "-", normalized).strip("-_.")
    if not normalized:
        normalized = "tunnel"
    if not re.match(r"^[a-zA-Z0-9]", normalized):
        normalized = f"tunnel-{normalized}"
    max_suffix_len = 200
    normalized = normalized[:max_suffix_len].rstrip("-_.")
    if not normalized:
        normalized = "tunnel"
    return f"cloudflared-agent-{normalized}"

```

### Core Architecture Module: `dockflare/app/core/docker_handler.py`
```
# DockFlare: Automates Cloudflare Tunnel ingress from Docker labels.
# Copyright (C) 2025 ChrispyBacon-Dev <https://github.com/ChrispyBacon-dev/DockFlare>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.
#
# dockflare/app/core/docker_handler.py
import logging
import time
import requests
import copy 
import re
import threading
from docker.errors import NotFound, APIError
from flask import current_app

from app import config, docker_client, cloudflared_agent_state, tunnel_state, publish_state_event

from app.core.state_manager import (
    find_container_rule,
    managed_rules,
    mark_rule_tunnel_sync_pending,
    restore_rule_lifecycle,
    save_state,
    state_lock,
)
from app.core.tunnel_manager import update_cloudflare_config
from app.core.cloudflare_api import create_cloudflare_dns_record, get_account_zone_inventory, resolve_account_zone
from app.core.zone_resolver import ZoneResolutionError, normalize_dns_name
from app.core.access_manager import handle_access_policy_from_labels
from app.core.utils import get_rule_key, get_source_rule_key, get_label, normalize_access_group_value
from app.core import notification_manager

def is_valid_hostname(hostname):
    try:
        normalize_dns_name(hostname)
        return True
    except ZoneResolutionError:
        return False

def is_valid_service(service_str):
    if not service_str or not isinstance(service_str, str):
        return False

    service_str = service_str.strip()
    
    if service_str == "bastion":
        return True
    
    host_ip_pattern = r"([a-zA-Z0-9_](?:[a-zA-Z0-9\-_]{0,61}[a-zA-Z0-9_])?(?:\.[a-zA-Z0-9_](?:[a-zA-Z0-9\-_]{0,61}[a-zA-Z0-9_])?)*|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}|\[[0-9a-fA-F:]+\])"
    port_pattern = r"[0-9]{1,5}"

    http_https_pattern = rf"^(?:https?)://{host_ip_pattern}(?::{port_pattern})?$"
    tcp_pattern = rf"^(?:tcp)://{host_ip_pattern}:{port_pattern}$"
    ssh_pattern = rf"^(?:ssh)://{host_ip_pattern}:{port_pattern}$"
    rdp_pattern = rf"^(?:rdp)://{host_ip_pattern}:{port_pattern}$"
    http_status_pattern = r"^http_status:([1-5][0-9]{2})$"

    if re.fullmatch(http_https_pattern, service_str):
        return True
    if re.fullmatch(tcp_pattern, service_str):
        return True
    if re.fullmatch(ssh_pattern, service_str):
        return True
    if re.fullmatch(rdp_pattern, service_str):
        return True
    if re.fullmatch(http_status_pattern, service_str):
        return True
        
    logging.warning(f"Invalid service string format: '{service_str}' does not match supported patterns (HTTP, HTTPS, TCP, SSH, RDP, HTTP_STATUS, Bastion).")
    return False

def process_container_start(container_obj):
    from app import app
    with app.app_context():
        if not container_obj:
            return

        container_id_val = None
        container_name_val = "UnknownContainer"
        activated_resources = []
        restored_resources = []
        
        try:
            container_id_val = container_obj.id
            container_obj.reload() # Reload to get fresh labels
            container_name_val = container_obj.name
            logging.info(f"DOCKER_HANDLER_PROCESS_START: Processing container {container_name_val} ({container_id_val[:12]})")
            labels = container_obj.labels
            is_enabled = get_label(labels, "enable", "false").lower() in ["true", "1", "t", "yes"]
            if not is_enabled:
                logging.debug(f"DOCKER_HANDLER: Ignoring start: {container_name_val} ({container_id_val[:12]}): 'enable' label not true.")
                return

            hostnames_to_process = []

            default_path_label = get_label(labels, "path")
            default_originsrvname_label = get_label(labels, "originsrvname")
            default_http_host_header_label = get_label(labels, "httpHostHeader")

            default_access_groups = get_label(labels, "access.groups")
            default_access_group = get_label(labels, "access.group") if not default_access_groups else None
            default_access_policy_type_label = get_label(labels, "access.policy")

            if default_access_policy_type_label == "bypass" and not default_access_group and not default_access_groups:
                logging.info(f"DOCKER_HANDLER: Legacy label 'dockflare.access.policy=bypass' detected for {container_name_val}. Migrating to 'dockflare.access.group=public-default-bypass'.")
                default_access_group = ["public-default-bypass"]
                default_access_policy_type_label = None
            elif default_access_group and not default_access_groups:
                if isinstance(default_access_group, str) and default_access_group == "bypass":
                    logging.info(f"DOCKER_HANDLER: Legacy group 'bypass' detected for {container_name_val}. Migrating to 'public-default-bypass'.")
                    default_access_group = "public-default-bypass"
                elif isinstance(default_access_group, list) and "bypass" in default_access_group:
                    logging.info(f"DOCKER_HANDLER: Legacy group 'bypass' detected in list for {container_name_val}. Migrating to 'public-default-bypass'.")
                    default_access_group = ["public-default-bypass" if g == "bypass" else g for g in default_access_group]
            elif default_access_policy_type_label == "authenticate" and not default_access_group and not default_access_groups:
                from app.core.cloudflare_api import get_cloudflare_account_email
                account_email = get_cloudflare_account_email()
                if account_email:
                    logging.info(f"DOCKER_HANDLER: Legacy label 'dockflare.access.policy=authenticate' detected for {container_name_val}. Migrating to 'dockflare.access.group=authenticated-default' (restricted to {account_email}).")
                    default_access_group = ["authenticated-default"]
                    default_access_policy_type_label = None
                else:
                    logging.warning(f"DOCKER_HANDLER: Cannot migrate 'dockflare.access.policy=authenticate' for {container_name_val}. Cloudflare account email not available. Skipping access policy creation. Use 'dockflare.access.group=<group>' instead.")
                    default_access_policy_type_label = None

            if default_access_groups:
                default_access_group = [gid.strip() for gid in default_access_groups.split(',')]
            elif default_access_group:
                default_access_group = [default_access_group.strip()] if isinstance(default_access_group, str) else default_access_group
            default_access_app_name_label = get_label(labels, "access.name")
            default_access_session_duration_label = get_label(labels, "access.session_duration", "24h")
            default_access_app_launcher_visible_label = get_label(labels, "access.app_launcher_visible", "false").lower() in ["true", "1", "t", "yes"]
            default_access_allowed_idps_label_str = get_label(labels, "access.allowed_idps")
            default_access_auto_redirect_label = get_label(labels, "access.auto_redirect_to_identity", "false").lower() in ["true", "1", "t", "yes"]
            default_access_custom_rules_label_str = get_label(labels, "access.custom_rules")

            hostname_label = get_label(labels, "hostname")
            service_label = get_label(labels, "service")
            zone_name_label = get_label(labels, "zonename")
            no_tls_verify_label = get_label(labels, "no_tls_verify", "false").lower() in ["true", "1", "t", "yes"]
            http2_origin_label = get_label(labels, "http2_origin", "false").lower() in ["true", "1", "t", "yes"]
            disable_chunked_encoding_label = get_label(labels, "disable_chunked_encoding", "false").lower() in ["true", "1", "t", "yes"]
            match_sni_to_host_label = get_label(labels, "match_sni_to_host", "false").lower() in ["true", "1", "t", "yes"]

            if hostname_label and service_label:
                if is_valid_hostname(hostname_label) and is_valid_service(service_label):
                    hostnames_to_process.append({
                        "hostname": hostname_label, "service": service_label, "zone_name": zone_name_label,
                        "path": default_path_label,
                        "no_tls_verify": no_tls_verify_label,
                        "origin_server_name": default_originsrvname_label.strip() if default_originsrvname_label else None,
                        "http_host_header": default_http_host_header_label.strip() if default_http_host_header_label else None,
                        "http2_origin": http2_origin_label,
                        "disable_chunked_encoding": disable_chunked_encoding_label,
                        "match_sni_to_host": match_sni_to_host_label,
                        "access_group": default_access_group,
                        "access_policy_type": default_access_policy_type_label,
                        "access_app_name": default_access_app_name_label,
                        "access_session_duration": default_access_session_duration_label,
                        "access_app_launcher_visible": default_access_app_launcher_visible_label,
                        "access_allowed_idps_str": default_access_allowed_idps_label_str,
                        "access_auto_redirect": default_access_auto_redirect_label,
                        "access_custo
```

### Core Architecture Module: `dockflare/app/core/email_manager.py`
```
import logging
import requests
import json
import boto3
from botocore.config import Config as BotoConfig
from app import config
from app.core.cloudflare_api import cf_api_request, dns_semaphore

def check_token_permissions():
    try:
        perms = {
            "email_routing": False,
            "workers": False,
            "r2": False,
            "workers_kv": False
        }
        token = getattr(config, 'CF_API_TOKEN', '') or ''
        if token.startswith('cfat_'):
            verify_res = cf_api_request('GET', f'/accounts/{config.CF_ACCOUNT_ID}/tokens/verify')
        else:
            verify_res = cf_api_request('GET', '/user/tokens/verify')
        if not verify_res or not verify_res.get('success'):
            return perms
        try:
            cf_api_request('GET', f'/accounts/{config.CF_ACCOUNT_ID}/email/routing/addresses')
            perms["email_routing"] = True
        except Exception:
            perms["email_routing"] = False
        try:
            cf_api_request('GET', f'/accounts/{config.CF_ACCOUNT_ID}/workers/scripts')
            perms["workers"] = True
        except Exception:
            perms["workers"] = False
        try:
            cf_api_request('GET', f'/accounts/{config.CF_ACCOUNT_ID}/r2/buckets')
            perms["r2"] = True
        except Exception as e:
            perms["r2"] = False
            if '10042' in str(e):
                perms["r2_note"] = "R2 must be enabled in the Cloudflare Dashboard before use"
        try:
            cf_api_request('GET', f'/accounts/{config.CF_ACCOUNT_ID}/storage/kv/namespaces?per_page=1')
            perms["workers_kv"] = True
        except Exception:
            perms["workers_kv"] = False
        return perms
    except Exception as e:
        logging.error(f"Error checking token permissions: {e}")
        return {"email_routing": False, "workers": False, "r2": False, "workers_kv": False}

def enable_email_routing(zone_id):
    try:
        return cf_api_request('POST', f'/zones/{zone_id}/email/routing/enable', log_errors=False)
    except Exception as e:
        err_str = str(e)
        if '2004' in err_str or 'already enabled' in err_str.lower() or 'Unprocessable' in err_str:
            logging.info(f"Email routing already enabled on zone {zone_id}, continuing")
            return {}
        if '403' in err_str or 'Forbidden' in err_str or '10000' in err_str or 'Authentication' in err_str:
            logging.info(f"Email routing enable not permitted (zone {zone_id}); CF auto-activates via MX records")
            return {}
        logging.warning(f"Could not enable email routing on zone {zone_id}: {e}")
        raise

def enable_email_sending(zone_id, zone_name):
    try:
        subdomain = f"mail.{zone_name}"
        res = cf_api_request('POST', f'/zones/{zone_id}/email/sending/subdomains', json_data={"name": subdomain})
        logging.info(f"Email sending enabled for {zone_name} (subdomain: {subdomain})")
        return res
    except Exception as e:
        err_str = str(e)
        if 'already exists' in err_str.lower() or '2004' in err_str or 'duplicate' in err_str.lower():
            logging.info(f"Email sending subdomain already exists for {zone_name}, continuing")
            return {}
        logging.warning(f"Could not enable email sending for {zone_name} (may require manual activation in CF Dashboard): {e}")
        return None

def get_email_routing_status(zone_id):
    try:
        res = cf_api_request('GET', f'/zones/{zone_id}/email/routing')
        return res.get('result', {})
    except Exception as e:
        logging.error(f"Error getting email routing status: {e}")
        return {}

def create_dns_record_generic(zone_id, type, name, content, priority=None):
    with dns_semaphore:
        data = {
            "type": type,
            "name": name,
            "content": content,
            "proxied": False,
            "ttl": 1
        }
        if priority is not None:
            data["priority"] = priority
        return cf_api_request('POST', f'/zones/{zone_id}/dns_records', json_data=data)

def find_dns_record_generic(zone_id, type, name):
    with dns_semaphore:
        res = cf_api_request('GET', f'/zones/{zone_id}/dns_records?type={type}&name={name}')
        if res.get('success') and res.get('result'):
            return res['result'][0]
        return None

def delete_dns_record_generic(zone_id, record_id):
    with dns_semaphore:
        return cf_api_request('DELETE', f'/zones/{zone_id}/dns_records/{record_id}')

def _safe_create_dns(zone_id, type, name, content, priority=None):
    try:
        create_dns_record_generic(zone_id, type, name, content, priority)
    except Exception as e:
        cf_codes = []
        err_text = str(e)
        try:
            resp = getattr(e, 'response', None)
            if resp is not None:
                raw = resp.text
                err_text = err_text + ' ' + raw
                cf_codes = [err.get('code') for err in json.loads(raw).get('errors', [])]
        except Exception:
            pass
        cf_code = getattr(e, 'cf_error_code', None)
        if cf_code:
            cf_codes.append(cf_code)
        skip_codes = {81057, 81053, 81058, 890190}
        if cf_codes and any(c in skip_codes for c in cf_codes):
            logging.info(f"DNS record {type} {name} skipped (already exists or managed by CF Email Routing, codes={cf_codes})")
        elif '890190' in err_text or 'already exists' in err_text.lower() or 'managed by Email Routing' in err_text:
            logging.info(f"DNS record {type} {name} skipped: {err_text[:200]}")
        else:
            logging.error(f"DNS record {type} {name} failed, cf_codes={cf_codes}, err={err_text[:500]}")
            raise

def setup_email_dns_records(zone_id, zone_name):
    try:
        res = cf_api_request('GET', f'/zones/{zone_id}/email/routing/dns', log_errors=False)
        required = res.get('result', [])
        for record in required:
            rtype = record.get('type')
            rname = record.get('name')
            rcontent = record.get('content')
            rpriority = record.get('priority')
            if rtype and rname and rcontent:
                _safe_create_dns(zone_id, rtype, rname, rcontent, priority=rpriority)
    except Exception as e:
        logging.info(f"Could not fetch email routing DNS from CF API (falling back to defaults): {e}")
        _safe_create_dns(zone_id, 'MX', zone_name, 'route1.mx.cloudflare.net', priority=14)
        _safe_create_dns(zone_id, 'MX', zone_name, 'route2.mx.cloudflare.net', priority=36)
        _safe_create_dns(zone_id, 'MX', zone_name, 'route3.mx.cloudflare.net', priority=88)
        _safe_create_dns(zone_id, 'TXT', zone_name, 'v=spf1 include:_spf.mx.cloudflare.net ~all')
        _safe_create_dns(zone_id, 'TXT', f'_dmarc.{zone_name}', f'v=DMARC1; p=quarantine; rua=mailto:dmarc@{zone_name}')

def get_email_sending_status(zone_id, zone_name):
    try:
        res = cf_api_request('GET', f'/zones/{zone_id}/dns_records?type=TXT&search=_domainkey', log_errors=False)
        records = res.get('result', [])
        suffix = f'._domainkey.{zone_name}'
        for r in records:
            if r.get('name', '').endswith(suffix):
                return 'configured'
        return 'not_configured'
    except Exception:
        return 'unknown'

def verify_email_dns_records(zone_id, zone_name):
    res = cf_api_request('GET', f'/zones/{zone_id}/dns_records')
    records = res.get('result', [])
    status = {'mx': False, 'spf': False, 'dmarc': False}
    mx_count = 0
    for r in records:
        if r['type'] == 'MX' and r['name'] == zone_name and 'mx.cloudflare.net' in r['content']:
            mx_count += 1
        if r['type'] == 'TXT' and r['name'] == zone_name and 'v=spf1' in r['content']:
            status['spf'] = True
        if r['type'] == 'TXT' and r['name'] == f'_dmarc.{zone_name}' and 'v=DMARC1' in r['content']:
            status['dmarc'] = True
    if mx_count >= 3:
        status['mx'] = True
    return status

def create_r2_bucket(bucket_name):
    try:
        return cf_api_request('PUT', f'/accounts/{config.CF_ACCOUNT_ID}/r2/buckets/{bucket_name}')
    except Exception as e:
        cf_codes = []
        err_text = str(e)
        try:
            resp = getattr(e, 'response', None)
            if resp is not None:
                raw = resp.text
                err_text = err_text + ' ' + raw
                cf_codes = [err.get('code') for err in json.loads(raw).get('errors', [])]
                if resp.status_code == 409:
                    logging.info(f"R2 bucket {bucket_name} already exists (409), continuing")
                    return {"success": True, "result": {"name": bucket_name}}
        except Exception:
            pass
        if 10006 in cf_codes or 'already exists' in err_text.lower() or '409' in err_text:
            logging.info(f"R2 bucket {bucket_name} already exists, continuing")
            return {"success": True, "result": {"name": bucket_name}}
        raise

def get_r2_s3_credentials():
    import hashlib
    token = getattr(config, 'CF_API_TOKEN', '') or ''
    if token.startswith('cfat_'):
        token_verify = cf_api_request('GET', f'/accounts/{config.CF_ACCOUNT_ID}/tokens/verify')
    else:
        token_verify = cf_api_request('GET', '/user/tokens/verify')
    token_id = token_verify.get('result', {}).get('id', '')
    secret = hashlib.sha256(config.CF_API_TOKEN.encode()).hexdigest()
    return {
        'access_key_id': token_id,
        'secret_access_key': secret,
        'endpoint_url': f"https://{config.CF_ACCOUNT_ID}.r2.cloudflarestorage.com"
    }

def get_workers_subdomain():
    res = cf_api_request('GET', f'/accounts/{config.CF_ACCOUNT_ID}/workers/subdomain')
    return res.get('result', {}).get('subdomain', '')

def deploy_worker(script_name, script_content, bindings):
    url = f"{config.CF_API_BASE_URL}/accounts/{config.CF_ACCOUNT_ID}/workers/scripts/{script_name}"
    metadata = {
 
```

### Core Architecture Module: `dockflare/app/core/idp_manager.py`
```
# DockFlare: Automates Cloudflare Tunnel ingress from Docker labels.
# Copyright (C) 2025 ChrispyBacon-Dev <https://github.com/ChrispyBacon-dev/DockFlare>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.
#
# app/core/idp_manager.py
import logging
import requests
from flask import current_app
from app.core import cloudflare_api

def get_supported_idp_types():
    return {
        "google": {
            "name": "Google",
            "category": "oauth",
            "fields": {
                "client_id": {"label": "Client ID", "type": "text", "required": True},
                "client_secret": {"label": "Client Secret", "type": "password", "required": True}
            }
        },
        "google-apps": {
            "name": "Google Workspace",
            "category": "oauth",
            "fields": {
                "client_id": {"label": "Client ID", "type": "text", "required": True},
                "client_secret": {"label": "Client Secret", "type": "password", "required": True},
                "apps_domain": {"label": "Apps Domain", "type": "text", "required": False, "placeholder": "example.com"}
            }
        },
        "azureAD": {
            "name": "Microsoft Azure AD",
            "category": "oauth",
            "fields": {
                "client_id": {"label": "Application (client) ID", "type": "text", "required": True},
                "client_secret": {"label": "Client Secret", "type": "password", "required": True},
                "directory_id": {"label": "Directory (tenant) ID", "type": "text", "required": True}
            }
        },
        "okta": {
            "name": "Okta",
            "category": "oauth",
            "fields": {
                "okta_account": {"label": "Okta Account URL", "type": "text", "required": True, "placeholder": "https://your-domain.okta.com"},
                "client_id": {"label": "Client ID", "type": "text", "required": True},
                "client_secret": {"label": "Client Secret", "type": "password", "required": True}
            }
        },
        "github": {
            "name": "GitHub",
            "category": "oauth",
            "fields": {
                "client_id": {"label": "Client ID", "type": "text", "required": True},
                "client_secret": {"label": "Client Secret", "type": "password", "required": True}
            }
        },
        "oidc": {
            "name": "Generic OpenID Connect",
            "category": "oauth",
            "fields": {
                "client_id": {"label": "Client ID", "type": "text", "required": True},
                "client_secret": {"label": "Client Secret", "type": "password", "required": True},
                "auth_url": {"label": "Authorization URL", "type": "text", "required": True, "placeholder": "https://provider.com/oauth2/authorize"},
                "token_url": {"label": "Token URL", "type": "text", "required": True, "placeholder": "https://provider.com/oauth2/token"},
                "certs_url": {"label": "JWKS URL", "type": "text", "required": True, "placeholder": "https://provider.com/.well-known/jwks.json"}
            }
        }
    }

def list_identity_providers():
    account_id = current_app.config.get('CF_ACCOUNT_ID')
    logging.info(f"Listing Identity Providers for account {account_id}")
    endpoint = f"/accounts/{account_id}/access/identity_providers"

    try:
        response_data = cloudflare_api.cf_api_request("GET", endpoint)
        idps = response_data.get("result", [])
        logging.info(f"Retrieved {len(idps)} Identity Providers from Cloudflare")
        return idps
    except requests.exceptions.RequestException as e:
        logging.error(f"API error listing Identity Providers: {e}")
        return []
    except Exception as e:
        logging.error(f"Unexpected error listing Identity Providers: {e}", exc_info=True)
        return []

def get_identity_provider(idp_id):
    account_id = current_app.config.get('CF_ACCOUNT_ID')
    logging.info(f"Getting Identity Provider {idp_id} for account {account_id}")
    endpoint = f"/accounts/{account_id}/access/identity_providers/{idp_id}"

    try:
        response_data = cloudflare_api.cf_api_request("GET", endpoint)
        idp = response_data.get("result")
        if idp:
            logging.info(f"Retrieved Identity Provider: {idp.get('name', idp.get('type'))}")
        return idp
    except requests.exceptions.RequestException as e:
        logging.error(f"API error getting Identity Provider {idp_id}: {e}")
        return None
    except Exception as e:
        logging.error(f"Unexpected error getting Identity Provider {idp_id}: {e}", exc_info=True)
        return None

def create_identity_provider(name, idp_type, config):
    account_id = current_app.config.get('CF_ACCOUNT_ID')
    logging.info(f"Creating Identity Provider '{name}' of type '{idp_type}' for account {account_id}")
    endpoint = f"/accounts/{account_id}/access/identity_providers"

    payload = {
        "name": name,
        "type": idp_type,
        "config": config
    }

    try:
        response_data = cloudflare_api.cf_api_request("POST", endpoint, json_data=payload)
        idp = response_data.get("result")
        if idp:
            logging.info(f"Successfully created Identity Provider with ID: {idp.get('id')}")
        return idp
    except requests.exceptions.RequestException as e:
        logging.error(f"API error creating Identity Provider '{name}': {e}")
        raise
    except Exception as e:
        logging.error(f"Unexpected error creating Identity Provider '{name}': {e}", exc_info=True)
        raise

def update_identity_provider(idp_id, name=None, config=None):
    account_id = current_app.config.get('CF_ACCOUNT_ID')
    logging.info(f"Updating Identity Provider {idp_id} for account {account_id}")
    endpoint = f"/accounts/{account_id}/access/identity_providers/{idp_id}"

    payload = {}
    if name is not None:
        payload["name"] = name
    if config is not None:
        payload["config"] = config

    if not payload:
        logging.warning(f"No updates provided for Identity Provider {idp_id}")
        return None

    try:
        response_data = cloudflare_api.cf_api_request("PUT", endpoint, json_data=payload)
        idp = response_data.get("result")
        if idp:
            logging.info(f"Successfully updated Identity Provider {idp_id}")
        return idp
    except requests.exceptions.RequestException as e:
        logging.error(f"API error updating Identity Provider {idp_id}: {e}")
        raise
    except Exception as e:
        logging.error(f"Unexpected error updating Identity Provider {idp_id}: {e}", exc_info=True)
        raise

def delete_identity_provider(idp_id):
    account_id = current_app.config.get('CF_ACCOUNT_ID')
    logging.info(f"Deleting Identity Provider {idp_id} for account {account_id}")
    endpoint = f"/accounts/{account_id}/access/identity_providers/{idp_id}"

    try:
        response_data = cloudflare_api.cf_api_request("DELETE", endpoint)
        logging.info(f"Successfully deleted Identity Provider {idp_id}")
        return True
    except requests.exceptions.RequestException as e:
        logging.error(f"API error deleting Identity Provider {idp_id}: {e}")
        raise
    except Exception as e:
        logging.error(f"Unexpected error deleting Identity Provider {idp_id}: {e}", exc_info=True)
        raise

def is_system_managed_idp(idp_type):
    system_types = ["onetimepin"]
    return idp_type in system_types

def build_test_idp_url(idp_id):
    team_domain = current_app.config.get('CF_TEAM_DOMAIN')
    if not team_domain:
        try:
            idps = list_identity_providers()
            if idps and len(idps) > 0:
                redirect_url = idps[0].get('config', {}).get('redirect_url', '')
                if redirect_url:
                    team_domain = redirect_url.split('//')[1].split('/')[0] if '//' in redirect_url else None
        except:
            pass

    if team_domain:
        return f"https://{team_domain}/cdn-cgi/access/test-idp/{idp_id}"
    return None

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #389** (2026-08-17): **Domain parsing incorrectly splits "domain.side.co.uk" as "domain.side" + "co.uk" instead of "domain" + "side.co.uk"**
  *Symptoms*: When entering a domain containing a second-level domain (SLD) pattern like "co.uk", the parsing logic incorrectly separates the domain. The "co" TLD suffix is being treated as a standalone TLD rather than recognizing the "co.uk" pattern as a single second-level domain unit.
  **Post-Mortem & Fix Analysis**:
  > thank you for reporting this. I look into that, this could be really a bug in the pattern logic, I never used a SLD. thank you good catch. 
  > bug confirmed... the problem is I don't have an SLD in my cloudflare account would you be able to test a fix? work on a fix on unstable branch. 
  > a fix is in unstable branch. if you replace the docker image in your compose to unstable you can test it. would that be possible?

- **Issue #388** (2026-09-01): **UI-overridden Docker rules stay pending_deletion after container recreate/update**
  *Symptoms*: ### Summary  When a Docker-sourced rule has `rule_ui_override: true` (set after editing the rule in the UI), container **stop** correctly schedules grace-period deletion, but container **start/recreate** does **not** restore the rule to `active`. The hostname stays `pending_deletion` until `delete_at`, even though the replacement container is healthy and still has valid `dockflare.*` labels.  ### Expected behavior  On container update/recreate:  1. Stop → rule enters `pending_deletion` (grace period) — OK 2. New container starts with the same hostname labels → rule returns to `active`, `delete_at` cleared, tunnel ingress retained  UI override should protect Access/service edits from being overwritten by labels, **not** block tunnel lifecycle recovery.  ### Actual behavior  Step 2 is skipped. Logs show:  ```text DOCKER_HANDLER: Rule <hostname>| is UI-overridden, skipping Docker updates for <container>. ```  The rule remains `pending_deletion` for the full grace period (default 8h) and is then removed from the tunnel despite the app still running.  ### Reproduction  1. Deploy a labeled container (`dockflare.enable=true`, hostname + service). 2. In the DockFlare UI, edit that rule (e.g. Access groups) so it shows **UI Override** / `rule_ui_override: true`. 3. Recreate/update the container (`docker compose up -d --force-recreate` or equivalent). 4. Observe the rule flip to **pending deletion** with an expiration countdown and never return to **active**
  **Post-Mortem & Fix Analysis**:
  > I look into that thank you for the report.
  > I did a first review and this is a rabbit hole.. I plan a bigger patch and rework around this problem. more soon
  > currently in dev branch fixed but further testing is needed. 

- **Issue #330** (2026-03-18): **Disable Password Login not working **
  *Symptoms*: Steps:  - Go to Dockflare settings, set option "Disable Password Login" and save security settings.  - Settings page reloads with all the text entries empty, except for the "Disable Password Login" option which is set.  - Logout and close browser.  - Load Dockflare and presented with login screen.  - Enter credentials and login successfully.  - Go to Dockflare settings, option "Disable Password Login" is unset.  - Repeating the process doesn't resolve the issue. 
  **Post-Mortem & Fix Analysis**:
  > I look into it. just to be sure are you on latest version / image build? 
  > Yes, 3.0.8
  > I can confirm it is a bug, thank you for finding. I believe it has something to do with the recent translation. 

- **Issue #309** (2026-03-03): **Invalid container name**
  *Symptoms*: When configuring the tunnel name, it is possible to use characters in that name that prevent the container, which is needed to activate the tunnel, from being created.  For example, when I put in an additional descriptor in the name - dockflare-tunnel (pve)  This created the tunnel on Cloudflare and added routes to it, but it remained inactive due to this error  dockflare            | 09:55:26 [ERROR] Failed to create new agent container: 400 Client Error for http://docker-socket-proxy:2375/v1.52/containers/create?name=cloudflared-agent-dockflare-tunnel+%28pve%29: Bad Request ("Invalid container name (cloudflared-agent-dockflare-tunnel (pve)), only [a-zA-Z0-9][a-zA-Z0-9_.-] are allowed")  Would it be possible to either have that restriction in the web GUI or map invalid characters to valid ones when it comes to creating the container, so it can start (as it only seems to be an issue with the container name)
  **Post-Mortem & Fix Analysis**:
  > Thank you, it looks like you found a bug! I look into it however, over the holiday season I don't have any time so sometime in January. Wish you a nice Christmas 🎅🏻 holidays.
  > issue resolved see last release notes v3.0.7

- **Issue #296** (2026-02-15): **error in logs constantly....` details or key 'enable' label after multiple attempts.``**
  *Symptoms*: Version 3.0.5  ``` WARNING:root:Pattern-based cache invalidation is only supported with RedisCache 20:00:15 [WARNING] Pattern-based cache invalidation is only supported with RedisCache 20:00:16 [WARNING] Failed to get container d5eb03b87fb3 details or key 'enable' label after multiple attempts. WARNING:root:Failed to get container d5eb03b87fb3 details or key 'enable' label after multiple attempts. WARNING:root:Failed to get container d5eb03b87fb3 details or key 'enable' label after multiple attempts. 20:01:17 [WARNING] Failed to get container d5eb03b87fb3 details or key 'enable' label after multiple attempts. WARNING:root:Failed to get container d5eb03b87fb3 details or key 'enable' label after multiple attempts. 20:02:19 [WARNING] Failed to get container d5eb03b87fb3 details or key 'enable' label after multiple attempts. 20:03:19 [WARNING] Failed to get container d5eb03b87fb3 details or key 'enable' label after multiple attempts. WARNING:root:Failed to get container d5eb03b87fb3 details or key 'enable' label after multiple attempts. 20:04:26 [WARNING] Failed to get container d5eb03b87fb3 details or key 'enable' label after multiple attempts. WARNING:root:Failed to get container d5eb03b87fb3 details or key 'enable' label after multiple attempts. 20:04:30 [WARNING] Failed to get container d5eb03b87fb3 details or key 'enable' label after multiple attempts. WARNING:root:Failed to get container d5eb03b87fb3 details or key 'enable' label after multiple attempts. WARNING:root:Failed
  **Post-Mortem & Fix Analysis**:
  > I look into that, thanks for reporting. 
  > small update on the weekend I already created a fix for this but I leave it in unstable branch for now as I'm looking in some refinements and updating DockFlare Agent as well. 

- **Issue #285** (2025-10-19): **OIDC auth error — “The server encountered an internal error…” before request reaches Authentik**
  *Symptoms*:  This could very well be my fault, but I’m running into an issue after setting up OIDC authentication in Dockflare.  As soon as I click **“Login with Authentik”**, I get the following error:  > *The server encountered an internal error and was unable to complete your request. Either the server is overloaded or there is an error in the application.*  It seems to happen **before** the request even reaches my Authentik instance.  Here’s how I’ve configured things:  * In **Authentik**, I created a provider/application with the callback URL set to:    ```   https://dockflare.{mydomain}.co.uk/auth/authentik/callback   ```    (taken from the “Callback URL” shown in Dockflare’s settings)  * In **Dockflare**, under OIDC setup, I entered:    ```   https://identity.{mydomain}.co.uk/application/o/dockflare/   ```    as the **Issuer URL** (taken from the “OpenID Configuration Issuer” in Authentik)  * Client ID and Secret are from the Authentik UI as usual.  It feels like I’ve missed something obvious, but I can’t figure out what. Any ideas what might be causing this error?   The logs seem to suggest it's the callback URL but that is set!  `  File "/app/web/routes.py", line 2232, in login_provider     return oauth.create_client(provider_id).authorize_redirect(callback_url, state=state_token)            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^`
  **Post-Mortem & Fix Analysis**:
  > I fixed this issue - for anyone else...I don't know if this was a me thing or if it was a dockflare thing, but I had to restart the container after entering the OIDC settings and saving it.
  > Hi @kybernetic-afk  Thank you for reporting this. I think you found a bug. I'm looking into it already and created a fix in the unstable branch to dynamically load OAuth IDP config.   Cheers, Chris
  > fix for #285 is now on stable branch. I added both Google and GitHub OAuth and it’s now dynamically loading. I don't have an Authentik instance running so I cannot directly test this. Furthermore, I changed a little bit the spacing and padding of the login form. I think that is better styled than before. If you have a minute and can you test maybe? thank you  <img width="1292" height="788" alt="Image" src="https://github.com/user-attachments/assets/30ca73fb-849a-43b8-9eee-09248474632e" />

- **Issue #279** (2025-10-14): **Unable to set no_tls_verify for specific container**
  *Symptoms*: Hi.   I am unable to setup a container with Dockflare labels to skip TLS verification, no matter what I do the tunnel is always created without no TLS  verification flag disabled. Dockflare shows at dashboard the option set, even clicking at manage rule the checkbox is set but then the tunnel fails to work and I can see at Cloudflare that the skip TLS is not set.  The labels I have set at container (redacted):  `     dockflare.enable: true       dockflare.hostname: subdomain.example.com        dockflare.service: https://10.0.0.120:6643       dockflare.access.group: "dockflare-example"       dockflare.no_tls_verify: true `  I have other Dockflare tunnels that use no TLS verification and with those is working great. 
  **Post-Mortem & Fix Analysis**:
  > Hi,  Thank you for reporting. I can confirm this is a bug and I already testing in unstable branch.  I update you when I push on stable. Cheers, Chris
  > Hi. Thanks a lot for your work, will wait for the stable push.
  > OK, I pushed to stable and the Docker image is uploaded as well. Just pull the new Docker image on the stable branch and redeploy. My test compose was working and a rule was created with no TLS verify. thanks cheers, Chris   ``` version: '3.8'  services:    nginx-test:     image: nginx:latest     container_name: nginx-test     restart: unless-stopped     networks:       - cloudflare-net     labels:       # Standard DockFlare labels       - "dockflare.enable=true"       - "dockflare.hostname=test-notls.dockflare.app"        - "dockflare.service=https://nginx-test:80"       - "dockflare.no_tls_verify=true"       # --- New Feature ---       - "dockflare.access.policy=bypass"             # Provide a comma-separated list of your Access Group IDs.       #- "dockflare.access.groups=email,ip"  networks:   cloudflare-net:     name: cloudflare-net     external: true ```

- **Issue #276** (2025-10-11): **edge case: multi access policy / *.domain.tld**
  *Symptoms*: ```     labels:       - dockflare.enable=true       - dockflare.0.hostname=www.domain.org       - dockflare.0.service=http://nginx:80       - dockflare.0.access.groups=auth       - dockflare.1.hostname=domain.org       - dockflare.1.service=http://nginx:80       - dockflare.1.access.groups=auth  ``` Hello, I think i stumbled upon an edge case.  the first https://www.domain.org application works fine, and asks for authentication. the second, https://domain.org just bypasses  This is how dockflare shows it:  <img width="1433" height="75" alt="Image" src="https://github.com/user-attachments/assets/7dbf9546-a0f1-4de7-aa57-0c929fe627ca" />  when i look at cloudflare:  <img width="626" height="529" alt="Image" src="https://github.com/user-attachments/assets/21c932d8-0bce-4e64-a406-314647311ec8" />   
  **Post-Mortem & Fix Analysis**:
  > OK, this might be a similar issue to the path rule creation that I had and fixed. As a workaround, you could create a *.tld zone protection rule to have all subdomains protected with a default rule and create a public bypass for the www.domain.tld .   I look into that. 
  > Please update to latest stable DockFlare container. issue is fixed. Details: https://github.com/ChrispyBacon-dev/DockFlare/releases  Thank you again for your feedback. Cheers, Chris
  > works perfectly now, thanks :)

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

### Incident Patch 1: `732bf1fc` (2026-09-19)
**Commit Message**: security hotfixes . mail worker and more fixes

**File**: `CHANGELOG.md` (modified, +3/-1)
```diff
@@ -16,7 +16,9 @@ All notable changes to this project will be documented in this file.
 - **Real-time log stream fixed:** The activity log panel no longer reconnects every ~10s or opens duplicate connections. Proper SSE heartbeats, a single reconnect watchdog, per-viewer log fan-out, and it pauses when the tab is hidden.
 
 ### Security
-- **Outbound email worker hardening:** The worker no longer relays for arbitrary senders - it pins the sender to the configured domain (plus an optional allowlist), validates recipients, strips CR/LF from all headers to block header/MIME injection, stops leaking the `Bcc:` header, encodes attachment filenames, compares the auth secret in constant time, and enforces per-sender hourly/daily rate limits. Mail-manager sanitizes header fields before dispatch too.
+- **Outbound email worker hardening:** The worker no longer relays for arbitrary senders - it pins the sender to the configured domain (plus an optional allowlist), validates recipients, strips CR/LF from all headers to block header/MIME injection, keeps the sender display name in `From`, stops leaking the `Bcc:` header, encodes attachment filenames, compares the auth secret in constant time, and enforces per-sender hourly/daily rate limits. Mail-manager sanitizes header fields before dispatch too.
+- **Inbound mail can't be mis-filed by headers:** Mailbox resolution now trusts the SMTP envelope (and the worker's alias result) instead of the spoofable `To:`/`Delivered-To` headers, so with catch-all enabled a sender can no longer drop mail into an arbitrary mailbox.
+- **Push endpoints can't target internal hosts:** Web Push subscriptions must be HTTPS and resolve to public addresses; invalid or legacy endpoints are rejected on subscribe and cleaned up on send.
 - **Agent API Access app:** The `/api/v2/agents/` Cloudflare Access app keeps an admin bypass policy so the same-origin admin UI can reach those endpoints (an identity `allow` policy breaks the browser request flow), while the endpoints themselves remain protected by the master API key and per-agent keys. Startup now ensures the policy exists instead of creating duplicates.
 - **Agent secrets removed from `state.json`:** Agent API keys and tunnel tokens now live only in the encrypted key store, legacy plaintext values are migrated on first load, backups no longer contain them, and rolling a key revokes all previous active keys.
 - **Mail-manager secrets encrypted at rest:** R2 secret keys, webhook secrets and outbound auth secrets are AES-GCM encrypted in the SQLite DB (`MAIL_SECRET_KEY`, falling back to the bootstrap secret), existing rows are migrated on startup, and DB/directory permissions are tightened.
```

**File**: `dockflare/app/core/agent_key_store.py` (modified, +3/-2)
```diff
@@ -65,8 +65,8 @@ def _fernet() -> Optional[Fernet]:
 def _persist_locked() -> None:
     fernet = _fernet()
     if fernet is None:
-        logging.warning("AGENT_KEY_STORE: Persist skipped because Fernet key is unavailable.")
-        return
+        logging.error("AGENT_KEY_STORE: Persist failed because the encryption key is unavailable.")
+        raise RuntimeError("Agent key store encryption key is unavailable")
 
     payload = {"keys": _cached_keys}
     try:
@@ -81,6 +81,7 @@ def _persist_locked() -> None:
         logging.debug("AGENT_KEY_STORE: Persisted %d keys to encrypted store.", len(_cached_keys))
     except Exception as err:  # pylint: disable=broad-except
         logging.error("AGENT_KEY_STORE: Failed to persist key store: %s", err, exc_info=True)
+        raise
 
 
 def _load_locked() -> None:
```

**File**: `dockflare/app/core/service_token_manager.py` (modified, +5/-3)
```diff
@@ -34,14 +34,14 @@ def _parse_hostname(public_url):
     return parsed.hostname
 
 
-def _create_admin_bypass_policy(account_id, app_uuid):
+def _create_admin_bypass_policy(account_id, app_uuid, precedence=2):
     resp = cf_api_request(
         "POST",
         f"/accounts/{account_id}/access/apps/{app_uuid}/policies",
         json_data={
             "name": "DockFlare Admin Bypass",
             "decision": "bypass",
-            "precedence": 2,
+            "precedence": precedence,
             "include": [{"everyone": {}}]
         }
     )
@@ -84,7 +84,9 @@ def ensure_agent_access_hardening():
                 logging.warning(f"Could not remove the redundant admin access policy {policy_id}: {e}")
 
     try:
-        new_id = _create_admin_bypass_policy(account_id, app_uuid)
+        precedences = [p.get("precedence") for p in policies if isinstance(p.get("precedence"), int)]
+        next_precedence = (max(precedences) if precedences else 1) + 1
+        new_id = _create_admin_bypass_policy(account_id, app_uuid, next_precedence)
         if new_id:
             logging.info(
                 "Ensured the Agent API Access app allows the admin UI; the endpoints still require the master or agent API key"
```

**File**: `dockflare/app/core/state_manager.py` (modified, +11/-3)
```diff
@@ -405,8 +405,6 @@ def load_state():
                 )
             identity_providers.update(idps_to_load)
             agent_cf_token.update(cf_token_to_load)
-            if _migrate_agent_secrets():
-                save_state()
             key_count = len(agent_key_store.list_keys())
             logging.info(
                 "LOAD_STATE: Loaded %s access groups, %s agents and %s agent keys (encrypted backing store).",
@@ -471,7 +469,13 @@ def load_state():
 
                 managed_rules[final_key] = rule_copy
 
-            migration_needed = schema_version < STATE_SCHEMA_VERSION or migrated_count > 0 or tunnel_name_migration_count > 0 or group_migration_count > 0
+            agent_secrets_migrated = False
+            try:
+                agent_secrets_migrated = _migrate_agent_secrets()
+            except Exception as e_agent_migrate:
+                logging.error(f"LOAD_STATE: Agent secret migration failed: {e_agent_migrate}", exc_info=True)
+
+            migration_needed = schema_version < STATE_SCHEMA_VERSION or migrated_count > 0 or tunnel_name_migration_count > 0 or group_migration_count > 0 or agent_secrets_migrated
             if migrated_count > 0:
                 logging.info(f"LOAD_STATE: Migrated {migrated_count} rules to the new key format.")
             if tunnel_name_migration_count > 0:
@@ -898,6 +902,10 @@ def remove_agent(agent_id):
     with state_lock:
         if agent_id in agents:
             del agents[agent_id]
+            try:
+                agent_key_store.clear_agent_tunnel_token(agent_id)
+            except Exception as e:
+                logging.warning(f"Could not clear stored tunnel token for removed agent {agent_id}: {e}")
             save_state()
             return True
         return False
```

**File**: `dockflare/app/core/worker_templates/outbound_worker.js` (modified, +2/-1)
```diff
@@ -105,6 +105,7 @@ export default {
     }
 
     const domain = String(env.DOMAIN_NAME || "").toLowerCase();
+    const fromHeaderValue = stripHeader(body.from);
     const fromAddress = parseAddress(body.from);
     if (!fromAddress) {
       return json({ error: "invalid sender" }, 400);
@@ -183,7 +184,7 @@ export default {
     const innerBoundary = "b" + crypto.randomUUID().replace(/-/g, "");
     const outerBoundary = hasAttachments ? "b" + crypto.randomUUID().replace(/-/g, "") : null;
 
-    let mimeMessage = `From: ${fromAddress}\r\nTo: ${toList.join(", ")}\r\n`;
+    let mimeMessage = `From: ${fromHeaderValue || fromAddress}\r\nTo: ${toList.join(", ")}\r\n`;
     if (ccList.length > 0) mimeMessage += `Cc: ${ccList.join(", ")}\r\n`;
     mimeMessage += `Subject: ${subject}\r\n`;
     mimeMessage += `Date: ${new Date().toUTCString()}\r\n`;
```

**File**: `dockflare/app/web/routes.py` (modified, +1/-2)
```diff
@@ -1299,9 +1299,8 @@ def force_delete_rule_route(hostname):
 def stream_logs_route():
     client_id = f"client-{random.randint(1000, 9999)}"
     logging.debug(f"Log stream client {client_id} connected.")
-    subscriber_id, client_queue = log_broadcaster.subscribe()
-
     def event_stream():
+        subscriber_id, client_queue = log_broadcaster.subscribe()
         try:
             yield "retry: 5000\n\n"
             yield f"event: hello\ndata: --- Log stream connected (client {client_id}) ---\n\n"
```

**File**: `install.sh` (modified, +1/-0)
```diff
@@ -533,6 +533,7 @@ ${LABELS_BLOCK}
       - DOCKFLARE_MASTER_URL=http://dockflare:5000
       - MAIL_DATA_PATH=/data
       - INTERNAL_BOOTSTRAP_SECRET=\${INTERNAL_BOOTSTRAP_SECRET:?set INTERNAL_BOOTSTRAP_SECRET}
+      - MAIL_SECRET_KEY=\${MAIL_SECRET_KEY:?set MAIL_SECRET_KEY}
     volumes:
       - mail_data:/data
     depends_on:
```

**File**: `mail-manager/app/api/routes.py` (modified, +6/-0)
```diff
@@ -129,6 +129,12 @@ def push_subscribe():
     if not endpoint or not p256dh or not auth_key or not mailbox_address:
         return jsonify({"error": "endpoint, keys, and mailbox_address are required"}), 400
 
+    from app.core.push import validate_push_endpoint
+    try:
+        validate_push_endpoint(endpoint)
+    except ValueError as endpoint_error:
+        return jsonify({"error": str(endpoint_error)}), 400
+
     if not _check_mailbox_access(mailbox_address):
         return jsonify({"error": "forbidden"}), 403
 
```

---

### Incident Patch 2: `1be1656e` (2026-09-19)
**Commit Message**: realtime log bugfix stream

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -12,6 +12,8 @@ All notable changes to this project will be documented in this file.
 - **Email domain lifecycle:** Tearing down a domain now removes its webhook bypass Access app, creating a mailbox that already has a routing rule updates it instead of failing with a 409, and quota KV namespace creation no longer logs "already exists" on every start.
 - **Access Group country picker:** With a lot of countries selected the chip list wouldn't scroll and the dropdown was clipped by the modal. It now scrolls, and the dropdown renders outside the modal.
 - **Agent name carries from the API key into new deploys:** When you give an "Owner" name while generating an agent API key, that name is now injected as `AGENT_DISPLAY_NAME` into the generated Compose snippet and one-liner, so the agent shows up in DockFlare with the name you assigned on first enrollment instead of the generic `dockflare-agent` fallback. This only applies to **newly generated deploy commands** - already-deployed agents keep their current name until they're redeployed with the new command or renamed manually.
+- **Open modal no longer closes itself:** Removed the Dashboard's duplicate live-update reload that refreshed the page every few seconds and closed any open dialog (e.g. Add Rule). The remaining fallback reload now waits until dialogs are closed.
+- **Real-time log stream fixed:** The activity log panel no longer reconnects every ~10s or opens duplicate connections. Proper SSE heartbeats, a single reconnect watchdog, per-viewer log fan-out, and it pauses when the tab is hidden.
 
 ### Security
 - **Outbound email worker hardening:** The worker no longer relays for arbitrary senders - it pins the sender to the configured domain (plus an optional allowlist), validates recipients, strips CR/LF from all headers to block header/MIME injection, stops leaking the `Bcc:` header, encodes attachment filenames, compares the auth secret in constant time, and enforces per-sender hourly/daily rate limits. Mail-manager sanitizes header fields before dispatch too.
```

**File**: `dockflare/app/__init__.py` (modified, +44/-15)
```diff
@@ -22,6 +22,7 @@
 import json
 import hashlib
 import ipaddress
+import threading
 
 from flask import Flask
 from flask_wtf.csrf import CSRFProtect
@@ -41,7 +42,42 @@
 tunnel_state = { "name": config.TUNNEL_NAME, "id": None, "token": None, "status_message": "Initializing...", "error": None }
 cloudflared_agent_state = { "container_status": "unknown", "last_action_status": None }
 
-log_queue = queue.Queue(maxsize=config.MAX_LOG_QUEUE_SIZE)
+class LogBroadcaster:
+    def __init__(self, per_client_maxsize):
+        self._per_client_maxsize = max(50, int(per_client_maxsize or 200))
+        self._subscribers = {}
+        self._lock = threading.Lock()
+
+    def subscribe(self):
+        client_queue = queue.Queue(maxsize=self._per_client_maxsize)
+        subscriber_id = id(client_queue)
+        with self._lock:
+            self._subscribers[subscriber_id] = client_queue
+        return subscriber_id, client_queue
+
+    def unsubscribe(self, subscriber_id):
+        with self._lock:
+            self._subscribers.pop(subscriber_id, None)
+
+    def publish(self, line):
+        with self._lock:
+            queues = list(self._subscribers.values())
+        for client_queue in queues:
+            try:
+                client_queue.put_nowait(line)
+            except queue.Full:
+                try:
+                    client_queue.get_nowait()
+                    client_queue.put_nowait(line)
+                except (queue.Empty, queue.Full):
+                    pass
+
+    def subscriber_count(self):
+        with self._lock:
+            return len(self._subscribers)
+
+
+log_broadcaster = LogBroadcaster(config.MAX_LOG_QUEUE_SIZE)
 state_update_queue = queue.Queue(maxsize=50) 
 log_formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s', datefmt='%H:%M:%S')
 
@@ -108,23 +144,16 @@ def _get_real_ip():
     storage_uri=os.environ.get('REDIS_URL', 'memory://')
 )
 
-class QueueLogHandler(logging.Handler):
-    def __init__(self, log_queue_instance):
+class LogBroadcastHandler(logging.Handler):
+    def __init__(self, broadcaster):
         super().__init__()
-        self.log_queue_instance = log_queue_instance
+        self.broadcaster = broadcaster
 
     def emit(self, record):
-        log_entry = self.format(record)
         try:
-            self.log_queue_instance.put_nowait(log_entry)
-        except queue.Full:
-            try:
-                self.log_queue_instance.get_nowait() 
-                self.log_queue_instance.put_nowait(log_entry)
-            except queue.Empty:
-                pass 
-            except queue.Full:
-                 print("Log queue still full after attempting to make space, dropping message.", file=sys.stderr)
+            self.broadcaster.publish(self.format(record))
+        except Exception:
+            pass
 
 root_logger = logging.getLogger()
 
@@ -144,7 +173,7 @@ def emit(self, record):
 console_handler.setFormatter(log_formatter)
 root_logger.addHandler(console_handler)
 
-queue_handler = QueueLogHandler(log_queue)
+queue_handler = LogBroadcastHandler(log_broadcaster)
 queue_handler.setFormatter(log_formatter)
 queue_handler.setLevel(log_level)
 root_logger.addHandler(queue_handler)
```

**File**: `dockflare/app/static/js/main.js` (modified, +70/-57)
```diff
@@ -2,7 +2,8 @@
 const maxLogLines = 250;
 let initialConnectMessageCleared = false;
 let activeLogSource = null;
-let eventSourceHealthCheck = null;
+let logWatchdogTimer = null;
+let logReconnectTimer = null;
 let logsEnabled = false;
 let pingInterval = null;
 let manualTunnelTomSelect = null;
@@ -743,9 +744,26 @@ function setupLogControls() {
             logOutput.textContent = activeLogSource ? t('js.text.log_cleared') + '\n' : t('js.text.enable_logs_prompt');
         }
     });
+
+    document.addEventListener('visibilitychange', () => {
+        if (!logsEnabled) return;
+        if (document.hidden) {
+            disconnectEventSource();
+        } else {
+            connectEventSource();
+        }
+    });
 }
 
 function disconnectEventSource() {
+    if (logWatchdogTimer) {
+        clearTimeout(logWatchdogTimer);
+        logWatchdogTimer = null;
+    }
+    if (logReconnectTimer) {
+        clearTimeout(logReconnectTimer);
+        logReconnectTimer = null;
+    }
     if (activeLogSource) {
         try {
             activeLogSource.close();
@@ -754,10 +772,24 @@ function disconnectEventSource() {
         }
         activeLogSource = null;
     }
-    if (eventSourceHealthCheck) {
-        clearInterval(eventSourceHealthCheck);
-        eventSourceHealthCheck = null;
-    }
+}
+
+function armLogWatchdog() {
+    if (logWatchdogTimer) clearTimeout(logWatchdogTimer);
+    logWatchdogTimer = setTimeout(() => {
+        if (!logsEnabled) return;
+        if (activeLogSource) {
+            try {
+                activeLogSource.close();
+            } catch (e) {
+                console.error("Error closing stale log stream:", e);
+            }
+            activeLogSource = null;
+        }
+        addLogLine(t('js.text.log_connection_timeout'), 'error');
+        if (logReconnectTimer) clearTimeout(logReconnectTimer);
+        logReconnectTimer = setTimeout(connectEventSource, 2000);
+    }, 45000);
 }
 
 function connectEventSource() {
@@ -769,6 +801,10 @@ function connectEventSource() {
         addLogLine(t('js.text.browser_sse_not_supported'), 'error');
         return;
     }
+    if (logReconnectTimer) {
+        clearTimeout(logReconnectTimer);
+        logReconnectTimer = null;
+    }
     if (activeLogSource) {
         try {
             activeLogSource.close();
@@ -779,65 +815,41 @@ function connectEventSource() {
     }
 
     const streamUrl = `${document.baseURI}stream-logs?t=${Date.now()}`;
+    let source;
     try {
-        activeLogSource = new EventSource(streamUrl);
-        let connectionTimeout;
-        const resetConnectionTimeout = () => {
-            if (connectionTimeout) clearTimeout(connectionTimeout);
-            connectionTimeout = setTimeout(() => {
-                if (activeLogSource) {
-                    activeLogSource.close();
-                    activeLogSource = null;
-                    addLogLine(t('js.text.log_connection_timeout'), 'error');
-                    setTimeout(connectEventSource, 2000);
-                }
-            }, 10000);
-        };
-        resetConnectionTimeout();
-
-        activeLogSource.onopen = function() {
-            if (connectionTimeout) clearTimeout(connectionTimeout);
-            addLogLine(t('js.text.log_connected'), 'connected');
-        };
-        activeLogSource.onmessage = function(event) {
-            resetConnectionTimeout();
-            if (event.data === "heartbeat" || event.data === ": keepalive") {
-                return;
-            }
-            addLogLine(event.data, 'log');
-        };
-
-        let retryAttempt = 0;
-        activeLogSource.onerror = function(err) {
-            if (connectionTimeout) clearTimeout(connectionTimeout);
-            if (activeLogSource && activeLogSource.readyState !== EventSource.CLOSED) {
-                addLogLine(t('js.text.log_connection_error'), 'error');
-            }
-            if (activeLogSource) {
-                activeLogSource.close();
-                activeLogSource = null;
-            }
-
-            if (logsEnabled) {
-                retryAttempt++;
-                const delay = Math.min(5000 * Math.pow(1.5, Math.min(retryAttempt - 1, 5)), 30000);
-                setTimeout(connectEventSource, delay);
-            }
-        };
+        source = new EventSource(streamUrl);
     } catch (e) {
         addLogLine(t('js.text.log_connection_failed', {error: e.message}), 'error');
         if (logsEnabled) {
-            setTimeout(connectEventSource, 5000);
+            logReconnectTimer = setTimeout(connectEventSource, 5000);
         }
+        return;
     }
+    activeLogSource = source;
 
-    if (eventSourceHealthCheck) clearInterval(eventSourceHealthCheck);
-    eventSourceHealthCheck = setInterval(() => {
-        if (logsEnabled && (!activeLogSource || activeLogSource.readyState === EventSource.CLOSED)) {
-            addLogLine(t('js.text.log_health_check_error'), 'status');
-            connectEventSource();
+    s
```

**File**: `dockflare/app/web/routes.py` (modified, +13/-14)
```diff
@@ -34,7 +34,7 @@
 from flask_login import current_user, login_required, login_user, logout_user
 from app.core.user import User
 
-from app import config, docker_client, tunnel_state, cloudflared_agent_state, log_queue, state_update_queue, publish_state_event, limiter
+from app import config, docker_client, tunnel_state, cloudflared_agent_state, log_broadcaster, state_update_queue, publish_state_event, limiter
 from app.core.cache import CACHE_ENABLED
 from app.core.state_manager import (
     access_groups,
@@ -1298,35 +1298,34 @@ def force_delete_rule_route(hostname):
 @login_required
 def stream_logs_route():
     client_id = f"client-{random.randint(1000, 9999)}"
-    logging.info(f"Log stream client {client_id} connected.")
+    logging.debug(f"Log stream client {client_id} connected.")
+    subscriber_id, client_queue = log_broadcaster.subscribe()
+
     def event_stream():
         try:
-            yield f"data: --- Log stream connected (client {client_id}) ---\n\n"
+            yield "retry: 5000\n\n"
+            yield f"event: hello\ndata: --- Log stream connected (client {client_id}) ---\n\n"
             last_heartbeat = time.time()
             while True:
                 try:
-                    log_entry = log_queue.get(timeout=0.25) 
-                    yield f"data: {log_entry}\n\n"
-                    last_heartbeat = time.time() 
+                    log_entry = client_queue.get(timeout=1.0)
+                    yield f"event: log\ndata: {log_entry}\n\n"
                 except queue.Empty:
-                    if time.time() - last_heartbeat > 2: 
-                        yield ": keepalive\n\n" 
+                    if time.time() - last_heartbeat >= 15:
+                        yield "event: heartbeat\ndata: {}\n\n"
                         last_heartbeat = time.time()
-                    time.sleep(0.1) 
         except GeneratorExit:
-            logging.info(f"Log stream client {client_id} disconnected.")
+            logging.debug(f"Log stream client {client_id} disconnected.")
         except Exception as e_stream:
             logging.error(f"Error in log stream for {client_id}: {e_stream}", exc_info=True)
         finally:
-            logging.info(f"Log stream for client {client_id} ended.")
-            
+            log_broadcaster.unsubscribe(subscriber_id)
+
     response = Response(event_stream(), mimetype='text/event-stream')
     response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
     response.headers['Pragma'] = 'no-cache'
     response.headers['Expires'] = '0'
     response.headers['X-Accel-Buffering'] = 'no'
-    response.headers['Access-Control-Allow-Origin'] = '*'
-    response.headers['Access-Control-Allow-Methods'] = 'GET'
     return response
 
 @bp.route('/stream-state-updates')
```

---

### Incident Patch 3: `078ea7e5` (2026-09-19)
**Commit Message**: SSE reload bug on dashboard

**File**: `dockflare/app/static/js/main.js` (modified, +15/-0)
```diff
@@ -13,6 +13,7 @@ let cachedZonesStale = false;
 let manualZoneDetectionTimeout = null;
 let servicesSnapshotPromise = null;
 let servicesSnapshotQueued = false;
+let pendingServicesReload = false;
 let activeStateEventSource = null;
 function getMasterApiKey() {
     const meta = document.querySelector('meta[name="dockflare-api-key"]');
@@ -388,13 +389,27 @@ function applyServicesSnapshot(services) {
     });
 
     if (servicesById.size > 0) {
+        if (document.querySelector('dialog[open]')) {
+            pendingServicesReload = true;
+            return;
+        }
         window.location.reload();
         return;
     }
 
     updateCountdowns();
 }
 
+document.addEventListener('close', function(event) {
+    if (typeof HTMLDialogElement === 'undefined' || !(event.target instanceof HTMLDialogElement)) {
+        return;
+    }
+    if (pendingServicesReload && !document.querySelector('dialog[open]')) {
+        pendingServicesReload = false;
+        window.location.reload();
+    }
+}, true);
+
 function scheduleServicesSnapshotRefresh() {
     if (!document.querySelector('tr[data-rule-key]')) {
         return;
```

**File**: `dockflare/app/templates/status_page.html` (modified, +0/-46)
```diff
@@ -740,52 +740,6 @@ <h4 class="text-md font-semibold mb-2">{{ t('status.access_policy_optional') }}<
     let allRows = [];
     let filteredRows = [];
 
-    let stateEventSource = null;
-    let reconnectAttempts = 0;
-    const maxReconnectDelay = 30000;
-    let reloadDebounceTimer = null;
-
-    function connectStateUpdates() {
-        if (stateEventSource) {
-            stateEventSource.close();
-        }
-
-        stateEventSource = new EventSource('/stream-state-updates');
-
-        stateEventSource.onmessage = function(event) {
-            try {
-                const data = JSON.parse(event.data);
-                if (data.type === 'snapshot_refresh') {
-                    clearTimeout(reloadDebounceTimer);
-                    reloadDebounceTimer = setTimeout(() => {
-                        window.location.reload();
-                    }, 500);
-                }
-            } catch (e) {
-                console.error('State update parse error:', e);
-            }
-        };
-
-        stateEventSource.onerror = function() {
-            stateEventSource.close();
-            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);
-            reconnectAttempts++;
-            setTimeout(connectStateUpdates, delay);
-        };
-
-        stateEventSource.onopen = function() {
-            reconnectAttempts = 0;
-        };
-    }
-
-    connectStateUpdates();
-
-    window.addEventListener('beforeunload', function() {
-        if (stateEventSource) {
-            stateEventSource.close();
-        }
-    });
-
     function initializeFilters() {
         if (!tableBody) return;
 
```

---

### Incident Patch 4: `cf499861` (2026-09-19)
**Commit Message**: agent display name in compose generated. fix

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ All notable changes to this project will be documented in this file.
 - **Webmail dependency refresh:** Vite 5 → 8, Tiptap 2 → 3, plus the plugin/PWA/workbox bumps - all 35 `npm audit` findings are gone and both webmail and DockFlare audit clean. Composer updated for Tiptap 3, build image moved to Node 22, and the stray `vue-tsc` `.js`/`.js.map` output (102 committed files) is cleaned up with `noEmit` and gitignore.
 - **Email domain lifecycle:** Tearing down a domain now removes its webhook bypass Access app, creating a mailbox that already has a routing rule updates it instead of failing with a 409, and quota KV namespace creation no longer logs "already exists" on every start.
 - **Access Group country picker:** With a lot of countries selected the chip list wouldn't scroll and the dropdown was clipped by the modal. It now scrolls, and the dropdown renders outside the modal.
+- **Agent name carries from the API key into new deploys:** When you give an "Owner" name while generating an agent API key, that name is now injected as `AGENT_DISPLAY_NAME` into the generated Compose snippet and one-liner, so the agent shows up in DockFlare with the name you assigned on first enrollment instead of the generic `dockflare-agent` fallback. This only applies to **newly generated deploy commands** - already-deployed agents keep their current name until they're redeployed with the new command or renamed manually.
 
 ### Security
 - **Outbound email worker hardening:** The worker no longer relays for arbitrary senders - it pins the sender to the configured domain (plus an optional allowlist), validates recipients, strips CR/LF from all headers to block header/MIME injection, stops leaking the `Bcc:` header, encodes attachment filenames, compares the auth secret in constant time, and enforces per-sender hourly/daily rate limits. Mail-manager sanitizes header fields before dispatch too.
```

**File**: `dockflare/app/core/service_token_manager.py` (modified, +14/-4)
```diff
@@ -201,14 +201,24 @@ def delete_agent_service_token():
     clear_agent_cf_token()
 
 
-def generate_compose_content(key_id, public_url, cloudflared_image="cloudflare/cloudflared:latest"):
+def _safe_display_name(value):
+    if not isinstance(value, str):
+        return None
+    cleaned = ''.join(ch for ch in value if ch.isprintable() and ch not in '\\"').strip()
+    return cleaned[:128] or None
+
+
+def generate_compose_content(key_id, public_url, cloudflared_image="cloudflare/cloudflared:latest", agent_display_name=None):
     token_data = get_agent_service_token()
     if not token_data:
         raise ValueError("CF Service Token not configured")
 
     client_id = token_data["client_id"]
     client_secret = token_data["client_secret"]
 
+    safe_name = _safe_display_name(agent_display_name)
+    display_name_env = f'\n      - "AGENT_DISPLAY_NAME={safe_name}"' if safe_name else ''
+
     return f"""services:
   docker-socket-proxy:
     image: tecnativa/docker-socket-proxy:v0.4.1
@@ -245,7 +255,7 @@ def generate_compose_content(key_id, public_url, cloudflared_image="cloudflare/c
     restart: unless-stopped
     environment:
       - DOCKFLARE_MASTER_URL={public_url}
-      - DOCKFLARE_API_KEY={key_id}
+      - DOCKFLARE_API_KEY={key_id}{display_name_env}
       - CF_ACCESS_CLIENT_ID={client_id}
       - CF_ACCESS_CLIENT_SECRET={client_secret}
       - CLOUDFLARED_IMAGE={cloudflared_image}
@@ -273,8 +283,8 @@ def generate_compose_content(key_id, public_url, cloudflared_image="cloudflare/c
 """
 
 
-def generate_deploy_script(key_id, public_url, cloudflared_image="cloudflare/cloudflared:latest"):
-    compose_content = generate_compose_content(key_id, public_url, cloudflared_image)
+def generate_deploy_script(key_id, public_url, cloudflared_image="cloudflare/cloudflared:latest", agent_display_name=None):
+    compose_content = generate_compose_content(key_id, public_url, cloudflared_image, agent_display_name)
 
     return f"""#!/usr/bin/env bash
 set -e
```

**File**: `dockflare/app/web/api_v2_routes.py` (modified, +4/-3)
```diff
@@ -1589,8 +1589,9 @@ def agents_deploy_info(key_id):
         return jsonify({"status": "error", "message": "DOCKFLARE_PUBLIC_URL is not configured"}), 400
 
     try:
-        script_content = generate_deploy_script(key_token, public_url)
-        compose_content = generate_compose_content(key_token, public_url)
+        owner = key_info.get("owner")
+        script_content = generate_deploy_script(key_token, public_url, agent_display_name=owner)
+        compose_content = generate_compose_content(key_token, public_url, agent_display_name=owner)
         return jsonify({
             "status": "success",
             "script_content": script_content,
@@ -1618,7 +1619,7 @@ def agents_deploy_script(key_id):
         return jsonify({"status": "error", "message": "DOCKFLARE_PUBLIC_URL is not configured"}), 400
 
     try:
-        script = generate_deploy_script(key_token, public_url)
+        script = generate_deploy_script(key_token, public_url, agent_display_name=key_info.get("owner"))
         from flask import Response
         return Response(script, mimetype="text/x-shellscript")
     except ValueError as e:
```

---

### Incident Patch 5: `ac89609b` (2026-09-19)
**Commit Message**: bypass policy fix

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ All notable changes to this project will be documented in this file.
 
 ### Security
 - **Outbound email worker hardening:** The worker no longer relays for arbitrary senders - it pins the sender to the configured domain (plus an optional allowlist), validates recipients, strips CR/LF from all headers to block header/MIME injection, stops leaking the `Bcc:` header, encodes attachment filenames, compares the auth secret in constant time, and enforces per-sender hourly/daily rate limits. Mail-manager sanitizes header fields before dispatch too.
-- **Agent API Access app no longer bypasses everyone:** The `/api/v2/agents/` Cloudflare Access app no longer gets a `bypass` policy for `everyone`, and existing installs are cleaned up on startup. Admin browser access, when wanted, is granted through a scoped `allow` policy for the configured authorized emails.
+- **Agent API Access app:** The `/api/v2/agents/` Cloudflare Access app keeps an admin bypass policy so the same-origin admin UI can reach those endpoints (an identity `allow` policy breaks the browser request flow), while the endpoints themselves remain protected by the master API key and per-agent keys. Startup now ensures the policy exists instead of creating duplicates.
 - **Agent secrets removed from `state.json`:** Agent API keys and tunnel tokens now live only in the encrypted key store, legacy plaintext values are migrated on first load, backups no longer contain them, and rolling a key revokes all previous active keys.
 - **Mail-manager secrets encrypted at rest:** R2 secret keys, webhook secrets and outbound auth secrets are AES-GCM encrypted in the SQLite DB (`MAIL_SECRET_KEY`, falling back to the bootstrap secret), existing rows are migrated on startup, and DB/directory permissions are tightened.
 - **Rate limits can't be spoofed:** The client IP used for login/mailbox rate limiting now only trusts forwarded headers from known proxies (Cloudflare ranges, loopback and private ranges by default, overridable via `TRUSTED_PROXY_IPS`).
```

**File**: `dockflare/app/core/service_token_manager.py` (modified, +25/-45)
```diff
@@ -34,27 +34,15 @@ def _parse_hostname(public_url):
     return parsed.hostname
 
 
-def _admin_bypass_emails():
-    emails = []
-    try:
-        from flask import current_app
-        emails = list(current_app.config.get('OAUTH_AUTHORIZED_USERS') or [])
-    except Exception:
-        emails = []
-    if not emails:
-        emails = list(getattr(config, 'OAUTH_AUTHORIZED_USERS', []) or [])
-    return sorted({email.strip() for email in emails if isinstance(email, str) and '@' in email})
-
-
-def _create_admin_allow_policy(account_id, app_uuid, emails):
+def _create_admin_bypass_policy(account_id, app_uuid):
     resp = cf_api_request(
         "POST",
         f"/accounts/{account_id}/access/apps/{app_uuid}/policies",
         json_data={
-            "name": "DockFlare Admin Access",
-            "decision": "allow",
+            "name": "DockFlare Admin Bypass",
+            "decision": "bypass",
             "precedence": 2,
-            "include": [{"email": {"email": email}} for email in emails]
+            "include": [{"everyone": {}}]
         }
     )
     return resp.get("result", {}).get("id")
@@ -83,31 +71,26 @@ def ensure_agent_access_hardening():
         logging.warning(f"Could not list Cloudflare Access policies for the Agent API app: {e}")
         return
 
-    admin_emails = _admin_bypass_emails()
-    has_admin_allow = False
-    broad_bypass_ids = []
+    if any(policy.get("decision") == "bypass" and _policy_includes_everyone(policy) for policy in policies):
+        return
+
     for policy in policies:
-        decision = policy.get("decision")
-        policy_id = policy.get("id") or policy.get("uid")
-        if decision == "bypass" and _policy_includes_everyone(policy):
-            broad_bypass_ids.append(policy_id)
-        elif decision == "allow" and not _policy_includes_everyone(policy):
-            has_admin_allow = True
-
-    for policy_id in broad_bypass_ids:
-        try:
-            cf_api_request("DELETE", f"/accounts/{account_id}/access/apps/{app_uuid}/policies/{policy_id}")
-            logging.warning("Removed an everyone-bypass policy from the Cloudflare Access Agent API application")
-        except Exception as e:
-            logging.warning(f"Could not remove broad Access bypass policy {policy_id}: {e}")
-
-    if not has_admin_allow and admin_emails:
-        try:
-            new_id = _create_admin_allow_policy(account_id, app_uuid, admin_emails)
-            if new_id:
-                logging.info("Created a scoped admin access policy for the Cloudflare Access Agent API application")
-        except Exception as e:
-            logging.warning(f"Could not create scoped admin access policy: {e}")
+        if policy.get("name") == "DockFlare Admin Access" and policy.get("decision") == "allow":
+            policy_id = policy.get("id") or policy.get("uid")
+            try:
+                cf_api_request("DELETE", f"/accounts/{account_id}/access/apps/{app_uuid}/policies/{policy_id}")
+                logging.warning("Removed the redundant DockFlare Admin Access policy from the Agent API app")
+            except Exception as e:
+                logging.warning(f"Could not remove the redundant admin access policy {policy_id}: {e}")
+
+    try:
+        new_id = _create_admin_bypass_policy(account_id, app_uuid)
+        if new_id:
+            logging.info(
+                "Ensured the Agent API Access app allows the admin UI; the endpoints still require the master or agent API key"
+            )
+    except Exception as e:
+        logging.warning(f"Could not ensure the admin bypass policy for the Agent API app: {e}")
 
 
 def ensure_agent_service_token(public_url):
@@ -167,10 +150,7 @@ def ensure_agent_service_token(public_url):
     policy_result = policy_resp.get("result", {})
     policy_id = policy_result.get("id")
 
-    admin_emails = _admin_bypass_emails()
-    admin_policy_id = None
-    if admin_emails:
-        admin_policy_id = _create_admin_allow_policy(account_id, app_uuid, admin_emails)
+    admin_policy_id = _create_admin_bypass_policy(account_id, app_uuid)
 
     agent_key_store.store_service_token_secret(client_secret)
 
@@ -181,7 +161,7 @@ def ensure_agent_service_token(public_url):
         "policy_id": policy_id,
     }
     if admin_policy_id:
-        token_data["admin_policy_id"] = admin_policy_id
+        token_data["bypass_policy_id"] = admin_policy_id
     set_agent_cf_token(token_data)
 
     return {**token_data, "client_secret": client_secret}
```

---

### Incident Patch 6: `bb97b70a` (2026-09-19)
**Commit Message**: bugfix service token admin allow policy for agent api

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ All notable changes to this project will be documented in this file.
 
 ### Security
 - **Outbound email worker hardening:** The worker no longer relays for arbitrary senders - it pins the sender to the configured domain (plus an optional allowlist), validates recipients, strips CR/LF from all headers to block header/MIME injection, stops leaking the `Bcc:` header, encodes attachment filenames, compares the auth secret in constant time, and enforces per-sender hourly/daily rate limits. Mail-manager sanitizes header fields before dispatch too.
-- **Agent API Access app no longer bypasses everyone:** The `/api/v2/agents/` Cloudflare Access app no longer gets a `bypass` policy for `everyone`, and existing installs are cleaned up on startup. Admin browser bypass, when wanted, is scoped to the configured authorized emails.
+- **Agent API Access app no longer bypasses everyone:** The `/api/v2/agents/` Cloudflare Access app no longer gets a `bypass` policy for `everyone`, and existing installs are cleaned up on startup. Admin browser access, when wanted, is granted through a scoped `allow` policy for the configured authorized emails.
 - **Agent secrets removed from `state.json`:** Agent API keys and tunnel tokens now live only in the encrypted key store, legacy plaintext values are migrated on first load, backups no longer contain them, and rolling a key revokes all previous active keys.
 - **Mail-manager secrets encrypted at rest:** R2 secret keys, webhook secrets and outbound auth secrets are AES-GCM encrypted in the SQLite DB (`MAIL_SECRET_KEY`, falling back to the bootstrap secret), existing rows are migrated on startup, and DB/directory permissions are tightened.
 - **Rate limits can't be spoofed:** The client IP used for login/mailbox rate limiting now only trusts forwarded headers from known proxies (Cloudflare ranges, loopback and private ranges by default, overridable via `TRUSTED_PROXY_IPS`).
```

**File**: `dockflare/app/core/service_token_manager.py` (modified, +16/-17)
```diff
@@ -46,13 +46,13 @@ def _admin_bypass_emails():
     return sorted({email.strip() for email in emails if isinstance(email, str) and '@' in email})
 
 
-def _create_scoped_bypass(account_id, app_uuid, emails):
+def _create_admin_allow_policy(account_id, app_uuid, emails):
     resp = cf_api_request(
         "POST",
         f"/accounts/{account_id}/access/apps/{app_uuid}/policies",
         json_data={
-            "name": "DockFlare Admin Bypass",
-            "decision": "bypass",
+            "name": "DockFlare Admin Access",
+            "decision": "allow",
             "precedence": 2,
             "include": [{"email": {"email": email}} for email in emails]
         }
@@ -84,16 +84,15 @@ def ensure_agent_access_hardening():
         return
 
     admin_emails = _admin_bypass_emails()
-    scoped_bypass = None
+    has_admin_allow = False
     broad_bypass_ids = []
     for policy in policies:
-        if policy.get("decision") != "bypass":
-            continue
+        decision = policy.get("decision")
         policy_id = policy.get("id") or policy.get("uid")
-        if _policy_includes_everyone(policy):
+        if decision == "bypass" and _policy_includes_everyone(policy):
             broad_bypass_ids.append(policy_id)
-        else:
-            scoped_bypass = policy_id
+        elif decision == "allow" and not _policy_includes_everyone(policy):
+            has_admin_allow = True
 
     for policy_id in broad_bypass_ids:
         try:
@@ -102,13 +101,13 @@ def ensure_agent_access_hardening():
         except Exception as e:
             logging.warning(f"Could not remove broad Access bypass policy {policy_id}: {e}")
 
-    if not scoped_bypass and admin_emails:
+    if not has_admin_allow and admin_emails:
         try:
-            new_id = _create_scoped_bypass(account_id, app_uuid, admin_emails)
+            new_id = _create_admin_allow_policy(account_id, app_uuid, admin_emails)
             if new_id:
-                logging.info("Created a scoped admin bypass policy for the Cloudflare Access Agent API application")
+                logging.info("Created a scoped admin access policy for the Cloudflare Access Agent API application")
         except Exception as e:
-            logging.warning(f"Could not create scoped admin bypass policy: {e}")
+            logging.warning(f"Could not create scoped admin access policy: {e}")
 
 
 def ensure_agent_service_token(public_url):
@@ -169,9 +168,9 @@ def ensure_agent_service_token(public_url):
     policy_id = policy_result.get("id")
 
     admin_emails = _admin_bypass_emails()
-    bypass_policy_id = None
+    admin_policy_id = None
     if admin_emails:
-        bypass_policy_id = _create_scoped_bypass(account_id, app_uuid, admin_emails)
+        admin_policy_id = _create_admin_allow_policy(account_id, app_uuid, admin_emails)
 
     agent_key_store.store_service_token_secret(client_secret)
 
@@ -181,8 +180,8 @@ def ensure_agent_service_token(public_url):
         "app_uuid": app_uuid,
         "policy_id": policy_id,
     }
-    if bypass_policy_id:
-        token_data["bypass_policy_id"] = bypass_policy_id
+    if admin_policy_id:
+        token_data["admin_policy_id"] = admin_policy_id
     set_agent_cf_token(token_data)
 
     return {**token_data, "client_secret": client_secret}
```

---

### Incident Patch 7: `0f29d58f` (2026-09-19)
**Commit Message**: security fixes - details in changelog

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -12,6 +12,16 @@ All notable changes to this project will be documented in this file.
 - **Email domain lifecycle:** Tearing down a domain now removes its webhook bypass Access app, creating a mailbox that already has a routing rule updates it instead of failing with a 409, and quota KV namespace creation no longer logs "already exists" on every start.
 - **Access Group country picker:** With a lot of countries selected the chip list wouldn't scroll and the dropdown was clipped by the modal. It now scrolls, and the dropdown renders outside the modal.
 
+### Security
+- **Outbound email worker hardening:** The worker no longer relays for arbitrary senders - it pins the sender to the configured domain (plus an optional allowlist), validates recipients, strips CR/LF from all headers to block header/MIME injection, stops leaking the `Bcc:` header, encodes attachment filenames, compares the auth secret in constant time, and enforces per-sender hourly/daily rate limits. Mail-manager sanitizes header fields before dispatch too.
+- **Agent API Access app no longer bypasses everyone:** The `/api/v2/agents/` Cloudflare Access app no longer gets a `bypass` policy for `everyone`, and existing installs are cleaned up on startup. Admin browser bypass, when wanted, is scoped to the configured authorized emails.
+- **Agent secrets removed from `state.json`:** Agent API keys and tunnel tokens now live only in the encrypted key store, legacy plaintext values are migrated on first load, backups no longer contain them, and rolling a key revokes all previous active keys.
+- **Mail-manager secrets encrypted at rest:** R2 secret keys, webhook secrets and outbound auth secrets are AES-GCM encrypted in the SQLite DB (`MAIL_SECRET_KEY`, falling back to the bootstrap secret), existing rows are migrated on startup, and DB/directory permissions are tightened.
+- **Rate limits can't be spoofed:** The client IP used for login/mailbox rate limiting now only trusts forwarded headers from known proxies (Cloudflare ranges, loopback and private ranges by default, overridable via `TRUSTED_PROXY_IPS`).
+- **Email status no longer leaks secrets:** `/email/status` and the Email page now return a non-secret summary instead of the full config (no private JWT/VAPID keys, R2 secrets or webhook secrets).
+- **Cross-mailbox folder protection:** Moving a message now requires the target folder to belong to that mailbox and folder listings are mailbox-scoped; any legacy mis-filed messages are repaired on startup.
+- **Agent UI XSS and CORS:** Agent-supplied fields are HTML-escaped before rendering, and the blanket `Access-Control-Allow-Origin: *` on the master UI was removed.
+
 
 ## [v3.1.5] - 2026-09-01
 
```

**File**: `docker-compose.yml` (modified, +1/-0)
```diff
@@ -93,6 +93,7 @@ services:
       - DOCKFLARE_MASTER_URL=http://dockflare:5000
       - MAIL_DATA_PATH=/data
       - INTERNAL_BOOTSTRAP_SECRET=${INTERNAL_BOOTSTRAP_SECRET:?set INTERNAL_BOOTSTRAP_SECRET}
+      - MAIL_SECRET_KEY=${MAIL_SECRET_KEY:-}
     volumes:
       - mail_data:/data
     depends_on:
```

**File**: `dockflare/app/__init__.py` (modified, +54/-4)
```diff
@@ -21,6 +21,7 @@
 import os
 import json
 import hashlib
+import ipaddress
 
 from flask import Flask
 from flask_wtf.csrf import CSRFProtect
@@ -46,11 +47,60 @@
 
 oauth = None
 
+DEFAULT_TRUSTED_PROXY_NETS = (
+    "127.0.0.0/8", "::1/128",
+    "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7",
+    "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
+    "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
+    "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
+    "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
+    "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32",
+    "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
+)
+
+_trusted_proxy_networks_cache = None
+
+
+def _trusted_proxy_networks():
+    global _trusted_proxy_networks_cache
+    if _trusted_proxy_networks_cache is not None:
+        return _trusted_proxy_networks_cache
+    raw = os.environ.get("TRUSTED_PROXY_IPS", "").strip()
+    entries = [value.strip() for value in raw.split(",") if value.strip()] if raw else list(DEFAULT_TRUSTED_PROXY_NETS)
+    networks = []
+    for entry in entries:
+        try:
+            networks.append(ipaddress.ip_network(entry, strict=False))
+        except ValueError:
+            logging.warning(f"TRUSTED_PROXY_IPS: ignoring invalid entry '{entry}'")
+    _trusted_proxy_networks_cache = tuple(networks)
+    return _trusted_proxy_networks_cache
+
+
+def _is_trusted_proxy(ip_text):
+    if not ip_text:
+        return False
+    try:
+        address = ipaddress.ip_address(ip_text)
+    except ValueError:
+        return False
+    return any(address in network for network in _trusted_proxy_networks())
+
+
+def get_client_ip():
+    peer = flask_request.remote_addr or ""
+    if _is_trusted_proxy(peer):
+        forwarded = flask_request.headers.get('CF-Connecting-IP')
+        if not forwarded:
+            xff = flask_request.headers.get('X-Forwarded-For', '')
+            forwarded = xff.split(',')[0].strip() if xff else None
+        if forwarded:
+            return forwarded
+    return peer
+
+
 def _get_real_ip():
-    return (
-        flask_request.headers.get('CF-Connecting-IP') or
-        get_remote_address()
-    )
+    return get_client_ip()
 
 limiter = Limiter(
     key_func=_get_real_ip,
```

**File**: `dockflare/app/core/agent_key_store.py` (modified, +33/-0)
```diff
@@ -213,3 +213,36 @@ def clear_service_token_secret() -> None:
         if _CF_SERVICE_TOKEN_KEY in _cached_keys:
             del _cached_keys[_CF_SERVICE_TOKEN_KEY]
             _persist_locked()
+
+
+_AGENT_TUNNEL_PREFIX = "__agent_tunnel__"
+
+
+def store_agent_tunnel_token(agent_id, token) -> None:
+    if not agent_id or not token:
+        return
+    _ensure_loaded()
+    with _store_lock:
+        _cached_keys[f"{_AGENT_TUNNEL_PREFIX}{agent_id}"] = {"token": token}
+        _persist_locked()
+
+
+def get_agent_tunnel_token(agent_id):
+    if not agent_id:
+        return None
+    _ensure_loaded()
+    with _store_lock:
+        entry = _cached_keys.get(f"{_AGENT_TUNNEL_PREFIX}{agent_id}")
+        if isinstance(entry, dict):
+            return entry.get("token")
+        return None
+
+
+def clear_agent_tunnel_token(agent_id) -> None:
+    if not agent_id:
+        return
+    _ensure_loaded()
+    with _store_lock:
+        if f"{_AGENT_TUNNEL_PREFIX}{agent_id}" in _cached_keys:
+            del _cached_keys[f"{_AGENT_TUNNEL_PREFIX}{agent_id}"]
+            _persist_locked()
```

**File**: `dockflare/app/core/service_token_manager.py` (modified, +83/-12)
```diff
@@ -34,6 +34,83 @@ def _parse_hostname(public_url):
     return parsed.hostname
 
 
+def _admin_bypass_emails():
+    emails = []
+    try:
+        from flask import current_app
+        emails = list(current_app.config.get('OAUTH_AUTHORIZED_USERS') or [])
+    except Exception:
+        emails = []
+    if not emails:
+        emails = list(getattr(config, 'OAUTH_AUTHORIZED_USERS', []) or [])
+    return sorted({email.strip() for email in emails if isinstance(email, str) and '@' in email})
+
+
+def _create_scoped_bypass(account_id, app_uuid, emails):
+    resp = cf_api_request(
+        "POST",
+        f"/accounts/{account_id}/access/apps/{app_uuid}/policies",
+        json_data={
+            "name": "DockFlare Admin Bypass",
+            "decision": "bypass",
+            "precedence": 2,
+            "include": [{"email": {"email": email}} for email in emails]
+        }
+    )
+    return resp.get("result", {}).get("id")
+
+
+def _policy_includes_everyone(policy):
+    for rule in policy.get("include") or []:
+        if isinstance(rule, dict) and "everyone" in rule:
+            return True
+    return False
+
+
+def ensure_agent_access_hardening():
+    data = get_agent_cf_token()
+    account_id = _account_id()
+    if not data or not account_id:
+        return
+    app_uuid = data.get("app_uuid")
+    if not app_uuid:
+        return
+
+    try:
+        resp = cf_api_request("GET", f"/accounts/{account_id}/access/apps/{app_uuid}/policies")
+        policies = resp.get("result") or []
+    except Exception as e:
+        logging.warning(f"Could not list Cloudflare Access policies for the Agent API app: {e}")
+        return
+
+    admin_emails = _admin_bypass_emails()
+    scoped_bypass = None
+    broad_bypass_ids = []
+    for policy in policies:
+        if policy.get("decision") != "bypass":
+            continue
+        policy_id = policy.get("id") or policy.get("uid")
+        if _policy_includes_everyone(policy):
+            broad_bypass_ids.append(policy_id)
+        else:
+            scoped_bypass = policy_id
+
+    for policy_id in broad_bypass_ids:
+        try:
+            cf_api_request("DELETE", f"/accounts/{account_id}/access/apps/{app_uuid}/policies/{policy_id}")
+            logging.warning("Removed an everyone-bypass policy from the Cloudflare Access Agent API application")
+        except Exception as e:
+            logging.warning(f"Could not remove broad Access bypass policy {policy_id}: {e}")
+
+    if not scoped_bypass and admin_emails:
+        try:
+            new_id = _create_scoped_bypass(account_id, app_uuid, admin_emails)
+            if new_id:
+                logging.info("Created a scoped admin bypass policy for the Cloudflare Access Agent API application")
+        except Exception as e:
+            logging.warning(f"Could not create scoped admin bypass policy: {e}")
+
+
 def ensure_agent_service_token(public_url):
     existing = get_agent_cf_token()
     existing_secret = agent_key_store.get_service_token_secret()
@@ -91,17 +168,10 @@ def ensure_agent_service_token(public_url):
     policy_result = policy_resp.get("result", {})
     policy_id = policy_result.get("id")
 
-    bypass_resp = cf_api_request(
-        "POST",
-        f"/accounts/{account_id}/access/apps/{app_uuid}/policies",
-        json_data={
-            "name": "DockFlare Admin Bypass",
-            "decision": "bypass",
-            "precedence": 2,
-            "include": [{"everyone": {}}]
-        }
-    )
-    bypass_policy_id = bypass_resp.get("result", {}).get("id")
+    admin_emails = _admin_bypass_emails()
+    bypass_policy_id = None
+    if admin_emails:
+        bypass_policy_id = _create_scoped_bypass(account_id, app_uuid, admin_emails)
 
     agent_key_store.store_service_token_secret(client_secret)
 
@@ -110,8 +180,9 @@ def ensure_agent_service_token(public_url):
         "token_id": token_id,
         "app_uuid": app_uuid,
         "policy_id": policy_id,
-        "bypass_policy_id": bypass_policy_id,
     }
+    if bypass_policy_id:
+        token_data["bypass_policy_id"] = bypass_policy_id
     set_agent_cf_token(token_data)
 
     return {**token_data, "client_secret": client_secret}
```

**File**: `dockflare/app/core/state_manager.py` (modified, +85/-2)
```diff
@@ -91,6 +91,80 @@ def _resolve_remote_policy(reusable_policies, policy_name, decision, include_rul
     return None
 
 
+_AGENT_STATE_SECRET_FIELDS = ("api_key", "assigned_tunnel_token")
+
+
+def _sanitize_agent_for_state(agent):
+    clean = dict(agent)
+    for field in _AGENT_STATE_SECRET_FIELDS:
+        clean.pop(field, None)
+    try:
+        token = agent_key_store.get_agent_tunnel_token(agent.get("id"))
+    except Exception:
+        token = None
+    if token:
+        clean["has_tunnel_token"] = True
+    commands = []
+    for command in clean.get("commands") or []:
+        if isinstance(command, dict):
+            command = {key: value for key, value in command.items() if key not in ("token", "tunnel_token")}
+        commands.append(command)
+    clean["commands"] = commands
+    return clean
+
+
+def _scrub_secret_fields(value):
+    if isinstance(value, dict):
+        return {
+            key: _scrub_secret_fields(item)
+            for key, item in value.items()
+            if key not in ("token", "tunnel_token", "api_key", "assigned_tunnel_token")
+        }
+    if isinstance(value, list):
+        return [_scrub_secret_fields(item) for item in value]
+    return value
+
+
+def _migrate_agent_secrets():
+    moved_keys = 0
+    moved_tokens = 0
+    for agent_id, agent_data in list(agents.items()):
+        if not isinstance(agent_data, dict):
+            continue
+        legacy_key = agent_data.get("api_key")
+        if isinstance(legacy_key, str) and legacy_key:
+            existing = agent_key_store.get_key(legacy_key)
+            metadata = dict(existing) if existing else {}
+            metadata.setdefault("bound_agent_id", agent_id)
+            metadata.setdefault("status", "active")
+            agent_key_store.upsert_key(legacy_key, metadata)
+            moved_keys += 1
+        legacy_token = agent_data.get("assigned_tunnel_token")
+        if isinstance(legacy_token, str) and legacy_token:
+            agent_key_store.store_agent_tunnel_token(agent_id, legacy_token)
+            moved_tokens += 1
+        for command in agent_data.get("commands") or []:
+            if not isinstance(command, dict):
+                continue
+            if command.get("action") == "start_tunnel" and not command.get("token"):
+                token = agent_key_store.get_agent_tunnel_token(agent_id)
+                if token:
+                    command["token"] = token
+            elif command.get("action") == "restart_tunnel" and not command.get("tunnel_token"):
+                token = agent_key_store.get_agent_tunnel_token(agent_id)
+                if token:
+                    command["tunnel_token"] = token
+        agent_data.pop("api_key", None)
+        agent_data.pop("assigned_tunnel_token", None)
+    if moved_keys or moved_tokens:
+        logging.warning(
+            "STATE_SECURITY: moved %s plaintext agent key(s) and %s tunnel token(s) out of state.json into the encrypted store",
+            moved_keys,
+            moved_tokens,
+        )
+    return bool(moved_keys or moved_tokens)
+
+
 STATE_SCHEMA_VERSION = 3
 RULE_LIFECYCLE_DEFAULTS = {
     "source_rule_key": None,
@@ -331,6 +405,8 @@ def load_state():
                 )
             identity_providers.update(idps_to_load)
             agent_cf_token.update(cf_token_to_load)
+            if _migrate_agent_secrets():
+                save_state()
             key_count = len(agent_key_store.list_keys())
             logging.info(
                 "LOAD_STATE: Loaded %s access groups, %s agents and %s agent keys (encrypted backing store).",
@@ -698,8 +774,15 @@ def save_state():
         serializable_rules = {}
         rules_to_iterate = list(managed_rules.items())
         groups_to_iterate = dict(access_groups)
-        agents_to_iterate = dict(agents)
-        decommissions_to_iterate = dict(agent_decommissions)
+        agents_to_iterate = {
+            agent_id: _sanitize_agent_for_state(agent_data)
+            for agent_id, agent_data in agents.items()
+            if isinstance(agent_data, dict)
+        }
+        decommissions_to_iterate = {
+            operation_id: _scrub_secret_fields(operation)
+            for operation_id, operation in agent_decommissions.items()
+        }
         idps_to_iterate = dict(identity_providers)
         cf_token_to_iterate = dict(agent_cf_token)
 
```

**File**: `dockflare/app/core/worker_templates/outbound_worker.js` (modified, +196/-46)
```diff
@@ -1,94 +1,244 @@
 import { EmailMessage } from "cloudflare:email";
 
+const MAX_ATTACHMENTS = 25;
+const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
+const MAX_SUBJECT_LENGTH = 998;
+
+function json(payload, status) {
+  return new Response(JSON.stringify(payload), {
+    status,
+    headers: { "Content-Type": "application/json" },
+  });
+}
+
+function stripHeader(value) {
+  return String(value ?? "").replace(/[\r\n\u0000]+/g, " ").trim();
+}
+
+function hasInjection(value) {
+  return /[\r\n\u0000]/.test(String(value ?? ""));
+}
+
+async function safeEqual(a, b) {
+  const encoder = new TextEncoder();
+  const [da, db] = await Promise.all([
+    crypto.subtle.digest("SHA-256", encoder.encode(String(a ?? ""))),
+    crypto.subtle.digest("SHA-256", encoder.encode(String(b ?? ""))),
+  ]);
+  const va = new Uint8Array(da);
+  const vb = new Uint8Array(db);
+  let diff = va.length ^ vb.length;
+  for (let i = 0; i < va.length; i++) diff |= va[i] ^ (vb[i] || 0);
+  return diff === 0;
+}
+
+function parseAddress(value) {
+  if (typeof value !== "string") return null;
+  const text = value.trim();
+  if (hasInjection(text)) return null;
+  const match = text.match(/<([^<>]+)>/);
+  const address = (match ? match[1] : text).trim();
+  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return null;
+  return address;
+}
+
+function addressList(value) {
+  const items = Array.isArray(value) ? value : value ? [value] : [];
+  const seen = [];
+  for (const item of items) {
+    const address = parseAddress(item);
+    if (address && !seen.includes(address)) seen.push(address);
+  }
+  return seen;
+}
+
+function sanitizeFilename(name) {
+  return String(name ?? "").replace(/[\r\n\u0000"\\/]/g, "_").slice(0, 255) || "attachment";
+}
+
+function sanitizeContentType(value) {
+  const text = stripHeader(value);
+  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(\s*;.*)?$/i.test(text)) {
+    return "application/octet-stream";
+  }
+  return text.replace(/[\r\n\u0000]/g, "");
+}
+
+async function isRateLimited(env, sender) {
+  if (!env.RATE_LIMIT_KV) return false;
+  const now = new Date();
+  const hourKey = `outbound:${sender}:h:${now.toISOString().slice(0, 13)}`;
+  const dayKey = `outbound:${sender}:d:${now.toISOString().slice(0, 10)}`;
+  const hourLimit = parseInt(env.RATE_LIMIT_PER_HOUR || "50", 10);
+  const dayLimit = parseInt(env.RATE_LIMIT_PER_DAY || "200", 10);
+  const [hourRaw, dayRaw] = await Promise.all([
+    env.RATE_LIMIT_KV.get(hourKey),
+    env.RATE_LIMIT_KV.get(dayKey),
+  ]);
+  const hourCount = parseInt(hourRaw || "0", 10);
+  const dayCount = parseInt(dayRaw || "0", 10);
+  if (hourCount >= hourLimit || dayCount >= dayLimit) return true;
+  await Promise.all([
+    env.RATE_LIMIT_KV.put(hourKey, String(hourCount + 1), { expirationTtl: 7200 }),
+    env.RATE_LIMIT_KV.put(dayKey, String(dayCount + 1), { expirationTtl: 172800 }),
+  ]);
+  return false;
+}
+
 export default {
   async fetch(request, env, ctx) {
     if (request.method !== "POST") {
-      return new Response("Method not allowed", { status: 405 });
+      return json({ error: "method not allowed" }, 405);
     }
-    const authHeader = request.headers.get("Authorization");
-    if (authHeader !== `Bearer ${env.AUTH_SECRET}`) {
-      return new Response("Unauthorized", { status: 401 });
+
+    const authHeader = request.headers.get("Authorization") || "";
+    const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
+    if (!env.AUTH_SECRET || !(await safeEqual(provided, env.AUTH_SECRET))) {
+      return json({ error: "unauthorized" }, 401);
     }
-    const body = await request.json();
-    const toList = Array.isArray(body.to) ? body.to : [body.to];
-    const toHeader = toList.join(", ");
 
-    const attachments = Array.isArray(body.attachments) ? body.attachments.filter(a => a && a.data_b64) : [];
-    const hasAttachments = attachments.length > 0;
+    let body;
+    try {
+      body = await request.json();
+    } catch (e) {
+      return json({ error: "invalid json" }, 400);
+    }
 
+    const domain = String(env.DOMAIN_NAME || "").toLowerCase();
+    const fromAddress = parseAddress(body.from);
+    if (!fromAddress) {
+      return json({ error: "invalid sender" }, 400);
+    }
+    if (domain) {
+      const fromDomain = fromAddress.slice(fromAddress.lastIndexOf("@") + 1).toLowerCase();
+      if (fromDomain !== domain) {
+        return json({ error: "sender domain not allowed" }, 403);
+      }
+    }
+    if (env.ALLOWED_SENDERS) {
+      let allowedSenders = [];
+      try {
+        allowedSenders = JSON.parse(env.ALLOWED_SENDERS);
+      } catch (e) {
+        allowedSenders = [];
+      }
+      if (Array.isArray(allowedSenders) && allowedSenders.length > 0) {
+        const normalized = allowedSenders.map((a) => String(a).toLowerCase());
+        if (!normalized.includes(fromAddress.toLowerCase())) {
+          return json({ error: "sender not allowed" }, 403);
+        }
+      }
+    }
+
+   
```

**File**: `dockflare/app/main.py` (modified, +7/-0)
```diff
@@ -316,6 +316,13 @@ def start_core_services():
         except Exception as e:
             logging.debug(f"Could not refresh email sending status on startup: {e}")
 
+    try:
+        from app.core.service_token_manager import ensure_agent_access_hardening
+        with app.app_context():
+            ensure_agent_access_hardening()
+    except Exception as e:
+        logging.warning(f"Agent Access hardening check failed: {e}")
+
     notification_manager.end_bootstrap()
     run_all_background_tasks()
 
```

---

### Incident Patch 8: `f8231887` (2026-09-19)
**Commit Message**: webui - countries fix selection clipped

**File**: `CHANGELOG.md` (modified, +6/-5)
```diff
@@ -5,11 +5,12 @@ All notable changes to this project will be documented in this file.
 ## [v3.1.6] - 2026-09-19
 
 ### Fixed
-- **Internal email configuration authentication:** Internal mail bootstrap endpoints now fail closed when `INTERNAL_BOOTSTRAP_SECRET` is missing and require a matching `X-Bootstrap-Token` for every request. Docker Compose passes the same required secret to DockFlare and mail-manager, preventing unauthenticated private-network access to mail storage credentials, webhook and outbound-worker secrets, and VAPID key material. The website installation script now generates and preserves this shared secret automatically.
-- **Missing Access policies on fresh setups:** Fixed a regression from the system-policy work back in v3.0.x. On a fresh install the two built-in policies (`public-default-bypass` and `authenticated-default`) could fail to be created on Cloudflare because setup runs before the config is written, and the stale local-only reference then made DockFlare skip them on every later start - so label-created Access Apps came up with zero policies and every login was denied, with nothing useful in the logs. DockFlare now verifies both policies against Cloudflare on startup and creates or re-links them when they're missing. Also fixed a duplicate `public-default-bypass` being created each time the Access Policies page loaded, and a bad `dockflare.access.policy` value no longer silently strips an existing policy - it logs an error and leaves the app untouched. While in there, `cf_policy_id` and `cloudflare_policy_id` are now kept in sync. Thanks [@PauloJf](https://github.com/PauloJf) for the report and repro ([#399](https://github.com/ChrispyBacon-dev/DockFlare/issues/399)).
-- **Inbound email blocked when Webmail sits behind Cloudflare Access:** If your webmail hostname (e.g. `mail.example.com`) is protected by a Cloudflare Access application, the inbound email worker's webhook to `/api/v1/webhook/inbound` was being caught by the Access login redirect and never reached mail-manager. Outbound worked fine, but received mail just piled up in the R2 `temp_cache` with nothing in the logs, and the retry cron hit the same wall. DockFlare now creates a path-scoped `DockFlare Mail Webhook Bypass` Access application (bypass policy, exact path only) when you set up a domain, and on startup it detects existing installs where the webhook is behind Access and fixes them automatically. Only that one path is opened - the webhook is still authenticated by the per-domain HMAC signature, and your webmail UI stays protected. The auto-fix needs `Account > Access: Apps and Policies: Edit` on the API token (documented in the Email prerequisites).
-- **Webmail dependency refresh and build hygiene:** Upgraded the webmail frontend from Vite 5 to 8, Tiptap 2 to 3, `@vitejs/plugin-vue` 5 to 6, `vite-plugin-pwa` 0.21 to 1.3, and workbox 7.3 to 7.4. This clears all 35 `npm audit` findings (including one high-severity Vite advisory) — both webmail and DockFlare now audit clean. The rich-text composer was adjusted for Tiptap 3 (named `TextStyle` import; Link and Underline now ship inside StarterKit), the Vite config now uses `import.meta.dirname`, and the webmail build image moved to Node 22. Also fixed a long-standing build-hygiene issue: `vue-tsc` was emitting compiled `.js`/`.js.map` files next to the sources and they had been committed, so `noEmit` is now set, the 102 committed artifacts were removed, and the output is git-ignored.
-- **Email domain lifecycle fixes:** Three email issues surfaced while wiring up the webhook bypass. Tearing down a domain (or "teardown all") now removes the `DockFlare Mail Webhook Bypass` Access application it created instead of leaving it orphaned - and it skips the deletion if another configured domain still shares that webmail hostname. Creating a mailbox for an address that already has a routing rule (a leftover from a failed attempt, or one added manually) no longer fails with `409 Duplicated Zone rule`; DockFlare now finds the existing rule and updates it instead of blindly creating a new one. And quota KV namespace creation is idempotent again - it checks for an existing namespace before creating, so the `code 10014 "namespace already exists"` error no longer appears on every startup.
+- **Internal email config auth:** Mail bootstrap endpoints now require the shared `INTERNAL_BOOTSTRAP_SECRET` and a matching `X-Bootstrap-Token`, and the installer generates that secret automatically. Closes off unauthenticated access to mail secrets on the private network.
+- **Built-in Access policies missing on new installs (regression):** On a fresh setup the two default policies (`public-default-bypass`, `authenticated-default`) could fail to reach Cloudflare, and a stale local reference then made DockFlare skip them forever - so label-created apps had no policies attached and every login was denied. DockFlare now verifies both on startup and recreates or re-links them when missing. Also 
```

**File**: `dockflare/app/templates/access_policies.html` (modified, +2/-0)
```diff
@@ -516,6 +516,7 @@ <h3 class="font-bold text-lg mb-4">{{ t('policies.sync_access_policies') }}</h3>
                  },
                  placeholder: "{{ t('policies.search_select_countries') }}",
                  maxOptions: null,
+                 dropdownParent: 'body',
                  render: {
                      item: function(data, escape) {
                          return '<div class="item">' + escape(data.text) + '</div>';
@@ -530,6 +531,7 @@ <h3 class="font-bold text-lg mb-4">{{ t('policies.sync_access_policies') }}</h3>
                 controlWrapper.style.maxHeight = 'none';
                 controlWrapper.style.border = 'none';
                 controlWrapper.style.background = 'transparent';
+                controlWrapper.style.overflowY = 'auto';
 
                 const observer = new ResizeObserver(() => {
                     const containerHeight = parentContainer.offsetHeight;
```

**File**: `dockflare/app/templates/base.html` (modified, +3/-0)
```diff
@@ -341,6 +341,9 @@
             background: rgba(59,130,246,0.30) !important;
             color: hsl(var(--bc)) !important;
         }
+        .ts-dropdown {
+            z-index: 9999;
+        }
         [data-theme="dark"] .ts-control .item {
             background: rgba(59,130,246,0.20) !important;
             border-color: rgba(59,130,246,0.35) !important;
```

---

### Incident Patch 9: `0338c77e` (2026-09-19)
**Commit Message**: auto bypass for worker inbound fix

**File**: `dockflare/app/core/email_manager.py` (modified, +155/-0)
```diff
@@ -413,3 +413,158 @@ def setup_catchall_routing_rule(zone_id, worker_name):
         logging.warning(f"Could not GET catch_all rule: {e}")
     logging.info(f"Setting catch-all routing rule to worker {worker_name} via dedicated endpoint")
     return cf_api_request('PUT', f'/zones/{zone_id}/email/routing/rules/catch_all', json_data=data)
+
+
+WEBHOOK_ACCESS_PATH = "/api/v1/webhook/inbound"
+WEBHOOK_ACCESS_APP_NAME = "DockFlare Mail Webhook Bypass"
+
+
+def _normalize_access_destination(value):
+    text = str(value or "").strip().lower()
+    if text.startswith("https://"):
+        text = text[len("https://"):]
+    elif text.startswith("http://"):
+        text = text[len("http://"):]
+    return text.rstrip("/")
+
+
+def _access_app_destinations(app):
+    destinations = []
+    domain = app.get("domain")
+    path = app.get("path")
+    if domain:
+        domain_text = _normalize_access_destination(domain)
+        if path and not domain_text.endswith("/" + str(path).strip("/").lower()):
+            destinations.append(f"{domain_text}/{str(path).strip('/')}")
+        else:
+            destinations.append(domain_text)
+    for extra in app.get("self_hosted_domains") or []:
+        destinations.append(_normalize_access_destination(extra))
+    return [d for d in destinations if d]
+
+
+def _access_destination_covers(destination, host, path):
+    destination = _normalize_access_destination(destination)
+    if not destination:
+        return False
+    if "/" in destination:
+        dest_host, _, dest_path = destination.partition("/")
+        dest_path = "/" + dest_path.lstrip("/")
+    else:
+        dest_host, dest_path = destination, "/"
+    host = _normalize_access_destination(host)
+    if dest_host.startswith("*."):
+        host_matches = host.endswith(dest_host[1:])
+    else:
+        host_matches = dest_host == host
+    if not host_matches:
+        return False
+    if dest_path in ("", "/"):
+        return True
+    return path == dest_path or path.startswith(dest_path.rstrip("/") + "/")
+
+
+def _find_webhook_bypass_app(apps, host, path):
+    target = f"{_normalize_access_destination(host)}{path}"
+    for app in apps:
+        for destination in _access_app_destinations(app):
+            if destination == target:
+                return app
+    return None
+
+
+def _app_has_bypass_policy(account_id, app_uuid):
+    try:
+        response = cf_api_request(
+            'GET', f'/accounts/{account_id}/access/apps/{app_uuid}/policies'
+        )
+        for policy in response.get('result') or []:
+            if policy.get('decision') == 'bypass':
+                return True
+    except Exception as e:
+        logging.warning(f"Could not read Access policies for app {app_uuid}: {e}")
+    return False
+
+
+def _create_webhook_bypass_policy(account_id, app_uuid):
+    cf_api_request(
+        'POST',
+        f'/accounts/{account_id}/access/apps/{app_uuid}/policies',
+        json_data={
+            "name": "DockFlare Webhook Bypass",
+            "decision": "bypass",
+            "precedence": 1,
+            "include": [{"everyone": {}}],
+        },
+    )
+
+
+def ensure_webhook_access_bypass(webmail_hostname):
+    account_id = getattr(config, 'CF_ACCOUNT_ID', None)
+    if not account_id or not webmail_hostname:
+        return None
+
+    host = _normalize_access_destination(webmail_hostname)
+    path = WEBHOOK_ACCESS_PATH
+
+    try:
+        response = cf_api_request(
+            'GET', f'/accounts/{account_id}/access/apps', params={"per_page": 100}
+        )
+        apps = response.get('result') or []
+    except Exception as e:
+        logging.warning(
+            f"Could not check Cloudflare Access for webhook bypass on {host}: {e}. "
+            f"The email webhook may be blocked if {host} sits behind Access."
+        )
+        return None
+
+    existing = _find_webhook_bypass_app(apps, host, path)
+    if existing:
+        app_uuid = existing.get('id') or existing.get('uid')
+        if app_uuid and not _app_has_bypass_policy(account_id, app_uuid):
+            try:
+                _create_webhook_bypass_policy(account_id, app_uuid)
+                logging.info(f"Added missing webhook bypass policy to Access app {app_uuid}")
+            except Exception as e:
+                logging.warning(f"Could not add webhook bypass policy to {app_uuid}: {e}")
+        return app_uuid
+
+    covered = any(
+        _access_destination_covers(destination, host, path)
+        for app in apps
+        for destination in _access_app_destinations(app)
+    )
+    if not covered:
+        return None
+
+    try:
+        app_response = cf_api_request(
+            'POST',
+            f'/accounts/{account_id}/access/apps',
+            json_data={
+                "name": WEBHOOK_ACCESS_APP_NAME,
+                "domain": f"{host}{path}",
+                "type": "self_hosted",
+                "session_duration": "24h",
+                "app_launcher_visible": F
```

**File**: `dockflare/app/main.py` (modified, +11/-2)
```diff
@@ -290,8 +290,8 @@ def start_core_services():
             logging.debug(f"dockflare-mail-manager not found or could not restart: {e}")
 
         try:
-            from app.core.email_manager import get_email_sending_status
-            from app.web.email_routes import save_email_config
+            from app.core.email_manager import get_email_sending_status, ensure_webhook_access_bypass
+            from app.web.email_routes import save_email_config, _get_webmail_hostname
             email_cfg = config.EMAIL_CONFIG
             updated = False
             for domain, domain_cfg in email_cfg.get('domains', {}).items():
@@ -304,6 +304,15 @@ def start_core_services():
                         logging.info(f"Email sending status for {domain}: {status}")
             if updated:
                 save_email_config(email_cfg)
+
+            webmail_hostname = _get_webmail_hostname()
+            checked_hosts = set()
+            for domain in email_cfg.get('domains', {}).keys():
+                host = webmail_hostname or f"mail.{domain}"
+                if host in checked_hosts:
+                    continue
+                checked_hosts.add(host)
+                ensure_webhook_access_bypass(host)
         except Exception as e:
             logging.debug(f"Could not refresh email sending status on startup: {e}")
 
```

**File**: `dockflare/app/templates/docs/ch-barnduetsch/Email-Prerequisites.md` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ D E-Mail-Suite bruucht zusätzlichi Berechtigunge uf dim bestehende DockFlare-AP
 | **Account** | **Workers Scripts** | **Bearbeite** | Inbound-/Outbound-Worker deploye |
 | **Account** | **Workers KV Storage** | **Bearbeite** | Echtzeit-Quota-Durchsetzung am Edge |
 | **Account** | **R2 Storage** | **Bearbeite** | Transit-Buckets erstelle u verwalte |
+| **Account** | **Access: Apps and Policies** | **Bearbeite** | Es Umgehig für de Iigang-Mail-Webhook-Pfad erstelle, wenn Webmail dür Cloudflare Access gschützt isch |
 | **Zone** | **Email Routing** | **Bearbeite** | Routing aktiviere u Regle verwalte |
 | **Zone** | **DNS** | **Bearbeite** | MX-, SPF-, DMARC- u DKIM-Iiträg erstelle |
 
```

**File**: `dockflare/app/templates/docs/de/Email-Prerequisites.md` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@ Die E-Mail-Suite benötigt zusätzliche Berechtigungen für Ihr vorhandenes Dock
 | **Account** | **Workers Scripts** | **Bearbeiten** | Bereitstellung von Inbound-/Outbound-Workern |
 | **Account** | **Workers KV Storage** | **Bearbeiten** | Echtzeit-Quota-Durchsetzung am Edge |
 | **Account** | **R2 Storage** | **Bearbeiten** | Erstellen und Verwalten von Transit-Buckets |
+| **Account** | **Access: Apps and Policies** | **Bearbeiten** | Bypass-Richtlinie für den eingehenden E-Mail-Webhook-Pfad erstellen, wenn Webmail durch Cloudflare Access geschützt ist |
 | **Zone** | **E-Mail-Routing** | **Bearbeiten** | Routing aktivieren und Regeln verwalten |
 | **Zone** | **DNS** | **Bearbeiten** | Erstellen von MX-, SPF-, DMARC- und DKIM-Einträgen |
 
```

**File**: `dockflare/app/templates/docs/en/Email-Prerequisites.md` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@ The Email Suite requires additional permissions on your existing DockFlare API T
 | **Account** | **Workers Scripts** | **Edit** | Deploying inbound/outbound workers |
 | **Account** | **Workers KV Storage** | **Edit** | Real-time quota enforcement at the edge |
 | **Account** | **R2 Storage** | **Edit** | Creating and managing transit buckets |
+| **Account** | **Access: Apps and Policies** | **Edit** | Create a bypass for the inbound email webhook path when Webmail is protected by Cloudflare Access |
 | **Zone** | **Email Routing** | **Edit** | Activating routing and managing rules |
 | **Zone** | **DNS** | **Edit** | Creating MX, SPF, DMARC, and DKIM records |
 
```

**File**: `dockflare/app/templates/docs/es/Email-Prerequisites.md` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@ La Suite de correo requiere permisos adicionales en su token API de DockFlare ex
 | **Cuenta** | **Workers Scripts** | **Edición** | Despliegue de workers entrantes/salientes |
 | **Cuenta** | **Workers KV Storage** | **Edición** | Aplicación de cuotas en tiempo real en el edge |
 | **Cuenta** | **R2 Storage** | **Edición** | Creación y gestión de buckets de tránsito |
+| **Cuenta** | **Access: Apps and Policies** | **Edición** | Crear una excepción para la ruta del webhook de correo entrante cuando Webmail está protegido por Cloudflare Access |
 | **Zona** | **Email Routing** | **Edición** | Activación del enrutamiento y gestión de reglas |
 | **Zona** | **DNS** | **Edición** | Creación de registros MX, SPF, DMARC y DKIM |
 
```

**File**: `dockflare/app/templates/docs/fr/Email-Prerequisites.md` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@ La Suite e-mail nécessite des permissions supplémentaires sur votre token API
 | **Compte** | **Workers Scripts** | **Édition** | Déploiement des workers entrants/sortants |
 | **Compte** | **Workers KV Storage** | **Édition** | Application des quotas en temps réel à l'edge |
 | **Compte** | **R2 Storage** | **Édition** | Création et gestion des buckets de transit |
+| **Compte** | **Access: Apps and Policies** | **Édition** | Créer une exception pour le chemin du webhook e-mail entrant lorsque Webmail est protégé par Cloudflare Access |
 | **Zone** | **Email Routing** | **Édition** | Activation du routage et gestion des règles |
 | **Zone** | **DNS** | **Édition** | Création des enregistrements MX, SPF, DMARC et DKIM |
 
```

**File**: `dockflare/app/templates/docs/id/Email-Prerequisites.md` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@ Email Suite memerlukan izin tambahan pada Token API DockFlare Anda yang ada. Per
 | **Account** | **Workers Scripts** | **Edit** | Men-deploy worker inbound/outbound |
 | **Account** | **Workers KV Storage** | **Edit** | Penegakan kuota real-time di edge |
 | **Account** | **R2 Storage** | **Edit** | Membuat dan mengelola bucket transit |
+| **Account** | **Access: Apps and Policies** | **Edit** | Membuat bypass untuk jalur webhook email masuk saat Webmail dilindungi Cloudflare Access |
 | **Zone** | **Email Routing** | **Edit** | Mengaktifkan routing dan mengelola aturan |
 | **Zone** | **DNS** | **Edit** | Membuat record MX, SPF, DMARC, dan DKIM |
 
```

---

### Incident Patch 10: `719d56e2` (2026-09-19)
**Commit Message**: hotfix system policies

**File**: `dockflare/app/core/reusable_policies.py` (modified, +2/-1)
```diff
@@ -190,7 +190,8 @@ def sync_access_group_to_reusable_policy(group_id):
 
     is_system_policy = local_definition.get("system_policy", False)
     if is_system_policy and local_definition.get("policies"):
-        policy_name = local_definition["policies"][0].get("name", f"DockFlare-AccessGroup-{group_id}")
+        original_policies = group_definition.get("policies") or [{}]
+        policy_name = original_policies[0].get("name") or local_definition["policies"][0].get("name", f"DockFlare-AccessGroup-{group_id}")
     else:
         policy_name = f"DockFlare-AccessGroup-{group_id}"
 
```

**File**: `dockflare/app/core/state_manager.py` (modified, +19/-2)
```diff
@@ -65,9 +65,15 @@ def set_remote_policy_id(group, policy_id):
 def _resolve_remote_policy(reusable_policies, policy_name, decision, include_rules, require_rules=None, existing_policy_id=None):
     if existing_policy_id:
         existing = reusable_policies.get_reusable_policy(existing_policy_id)
-        if existing:
+        if existing and existing.get("name") == policy_name:
             return existing_policy_id
-        logging.warning(f"Cloudflare policy '{existing_policy_id}' ({policy_name}) not found, searching by name")
+        if existing:
+            logging.warning(
+                f"Cloudflare policy '{existing_policy_id}' is named '{existing.get('name')}' but "
+                f"'{policy_name}' was expected; searching by name instead"
+            )
+        else:
+            logging.warning(f"Cloudflare policy '{existing_policy_id}' ({policy_name}) not found, searching by name")
     existing_by_name = reusable_policies.find_policy_by_name(policy_name)
     if existing_by_name and existing_by_name.get("id"):
         logging.info(f"Found existing policy '{policy_name}' in Cloudflare with ID: {existing_by_name.get('id')}")
@@ -476,6 +482,11 @@ def ensure_default_bypass_policy(flask_app=None):
                 del existing_policy["hide_from_ui"]
                 save_state()
 
+            if existing_policy.get("policies") and existing_policy["policies"][0].get("name") != cf_policy_name:
+                logging.info(f"Restoring bypass policy name to '{cf_policy_name}'")
+                existing_policy["policies"][0]["name"] = cf_policy_name
+                save_state()
+
             remote_policy_id = get_remote_policy_id(existing_policy, default_bypass_id)
 
             if flask_app and getattr(config, "CF_ACCOUNT_ID", None):
@@ -599,6 +610,12 @@ def ensure_authenticated_default_policy(flask_app=None):
                 needs_state_update = True
                 needs_cf_update = True
 
+            if existing_policy.get("policies") and existing_policy["policies"][0].get("name") != cf_policy_name:
+                logging.info(f"Restoring authenticated-default policy name to '{cf_policy_name}'")
+                existing_policy["policies"][0]["name"] = cf_policy_name
+                needs_state_update = True
+                needs_cf_update = True
+
             if existing_policy.get("display_name") != "Authenticated Access":
                 logging.info(f"Updating authenticated-default display name to shorter version")
                 existing_policy["display_name"] = "Authenticated Access"
```

---

### Incident Patch 11: `55fc5471` (2026-09-19)
**Commit Message**: 3.1.6v - bugfixes default policies

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ All notable changes to this project will be documented in this file.
 
 ### Fixed
 - **Internal email configuration authentication:** Internal mail bootstrap endpoints now fail closed when `INTERNAL_BOOTSTRAP_SECRET` is missing and require a matching `X-Bootstrap-Token` for every request. Docker Compose passes the same required secret to DockFlare and mail-manager, preventing unauthenticated private-network access to mail storage credentials, webhook and outbound-worker secrets, and VAPID key material. The website installation script now generates and preserves this shared secret automatically.
+- **Missing Access policies on fresh setups:** Fixed a regression from the system-policy work back in v3.0.x. On a fresh install the two built-in policies (`public-default-bypass` and `authenticated-default`) could fail to be created on Cloudflare because setup runs before the config is written, and the stale local-only reference then made DockFlare skip them on every later start - so label-created Access Apps came up with zero policies and every login was denied, with nothing useful in the logs. DockFlare now verifies both policies against Cloudflare on startup and creates or re-links them when they're missing. Also fixed a duplicate `public-default-bypass` being created each time the Access Policies page loaded, and a bad `dockflare.access.policy` value no longer silently strips an existing policy - it logs an error and leaves the app untouched. While in there, `cf_policy_id` and `cloudflare_policy_id` are now kept in sync. Thanks [@PauloJf](https://github.com/PauloJf) for the report and repro ([#399](https://github.com/ChrispyBacon-dev/DockFlare/issues/399)).
 
 
 ## [v3.1.5] - 2026-09-01
```

**File**: `dockflare/app/cli.py` (modified, +1/-0)
```diff
@@ -257,6 +257,7 @@ def cleanup_duplicate_policies(dry_run=True):
                         else:
                             logging.info(f"  Updating group '{group_id}': {policy_id} → {correct_id}")
                             access_groups[group_id]["cloudflare_policy_id"] = correct_id
+                            access_groups[group_id]["cf_policy_id"] = correct_id
                             state_updated = True
 
         if state_updated and not dry_run:
```

**File**: `dockflare/app/core/access_manager.py` (modified, +9/-0)
```diff
@@ -493,6 +493,15 @@ def handle_access_policy_from_labels(rule_key, hostname_config_item):
                         if current_rule:
                             current_rule.update({"access_app_id": rule_working.get("access_app_id"), "access_policy_type": rule_working.get("access_policy_type"), "access_app_config_hash": rule_working.get("access_app_config_hash"), "access_group_id": rule_working.get("access_group_id")})
                 return local_state_changed_by_access_policy
+            else:
+                logging.error(
+                    f"ACCESS_MANAGER: Refusing to create or update Access App for {application_domain}. "
+                    f"'dockflare.access.policy={policy_source_type}' is not a supported value and no "
+                    f"'dockflare.access.custom_rules' were provided. Valid values are 'bypass', "
+                    f"'authenticate', or 'default_tld'. Use 'dockflare.access.group=<group_id>' to attach "
+                    f"an Access Group such as 'authenticated-default'. Existing Access App left untouched."
+                )
+                return False
 
         new_config_hash = generate_access_app_config_hash(
             policy_source_type, desired_session_duration, desired_app_launcher_visible,
```

**File**: `dockflare/app/core/reusable_policies.py` (modified, +24/-12)
```diff
@@ -280,9 +280,13 @@ def normalize_rules(val):
         needs_save = False
         with state_lock:
             group_definition = access_groups.get(group_id)
-            if group_definition and group_definition.get("cloudflare_policy_id") != policy_id:
+            if group_definition and (
+                group_definition.get("cloudflare_policy_id") != policy_id
+                or group_definition.get("cf_policy_id") != policy_id
+            ):
                 group_definition = copy.deepcopy(group_definition)
                 group_definition["cloudflare_policy_id"] = policy_id
+                group_definition["cf_policy_id"] = policy_id
                 access_groups[group_id] = group_definition
                 needs_save = True
         if needs_save:
@@ -377,21 +381,28 @@ def import_cloudflare_reusable_policies(sync_all=None):
 
         if group_id in access_groups:
             existing_group = access_groups[group_id]
-            if existing_group.get("cloudflare_policy_id") == policy_id:
+            if (
+                existing_group.get("cloudflare_policy_id") == policy_id
+                and existing_group.get("cf_policy_id") == policy_id
+            ):
                 logging.debug(f"Access group '{group_id}' already linked to policy '{policy_id}'")
                 skipped_count += 1
                 continue
+            already_linked = existing_group.get("cloudflare_policy_id") == policy_id
+            existing_group["cloudflare_policy_id"] = policy_id
+            existing_group["cf_policy_id"] = policy_id
+            existing_group["allowed_idps"] = login_method_ids([policy_definition])
+            if not is_dockflare_managed:
+                existing_group["external_policy"] = True
+            # Update system_policy flag if this is a system policy
+            if is_system_policy:
+                existing_group["system_policy"] = True
+                existing_group["display_name"] = display_name
+            if already_linked:
+                logging.info(f"Backfilled cf_policy_id for access group '{group_id}' (policy ID '{policy_id}')")
             else:
-                existing_group["cloudflare_policy_id"] = policy_id
-                existing_group["allowed_idps"] = login_method_ids([policy_definition])
-                if not is_dockflare_managed:
-                    existing_group["external_policy"] = True
-                # Update system_policy flag if this is a system policy
-                if is_system_policy:
-                    existing_group["system_policy"] = True
-                    existing_group["display_name"] = display_name
                 logging.info(f"Updated existing access group '{group_id}' with policy ID '{policy_id}'")
-                updated_count += 1
+            updated_count += 1
         else:
             new_group = {
                 "id": group_id,
@@ -401,7 +412,8 @@ def import_cloudflare_reusable_policies(sync_all=None):
                 "auto_redirect_to_identity": False,
                 "allowed_idps": login_method_ids([policy_definition]),
                 "policies": [policy_definition],
-                "cloudflare_policy_id": policy_id
+                "cloudflare_policy_id": policy_id,
+                "cf_policy_id": policy_id
             }
             if not is_dockflare_managed:
                 new_group["external_policy"] = True
```

**File**: `dockflare/app/core/state_manager.py` (modified, +99/-74)
```diff
@@ -18,6 +18,7 @@
 import json
 import logging
 import os
+import re
 import threading
 from datetime import datetime, timezone
 from typing import Dict, Any, List
@@ -26,6 +27,64 @@
 from app.core.access_policy_rules import normalize_managed_access_group
 from app.core.utils import get_label, get_rule_key, get_source_rule_key
 
+_REMOTE_POLICY_ID_PATTERN = re.compile(
+    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
+)
+
+
+def is_remote_policy_id(value, group_id=None):
+    if not value:
+        return False
+    text = str(value)
+    if group_id is not None and text == str(group_id):
+        return False
+    return bool(_REMOTE_POLICY_ID_PATTERN.match(text))
+
+
+def get_remote_policy_id(group, group_id=None):
+    if not group:
+        return None
+    for key in ("cloudflare_policy_id", "cf_policy_id", "id"):
+        value = group.get(key)
+        if is_remote_policy_id(value, group_id):
+            return value
+    return None
+
+
+def set_remote_policy_id(group, policy_id):
+    if not group or not policy_id:
+        return False
+    changed = False
+    for key in ("cloudflare_policy_id", "cf_policy_id", "id"):
+        if group.get(key) != policy_id:
+            group[key] = policy_id
+            changed = True
+    return changed
+
+
+def _resolve_remote_policy(reusable_policies, policy_name, decision, include_rules, require_rules=None, existing_policy_id=None):
+    if existing_policy_id:
+        existing = reusable_policies.get_reusable_policy(existing_policy_id)
+        if existing:
+            return existing_policy_id
+        logging.warning(f"Cloudflare policy '{existing_policy_id}' ({policy_name}) not found, searching by name")
+    existing_by_name = reusable_policies.find_policy_by_name(policy_name)
+    if existing_by_name and existing_by_name.get("id"):
+        logging.info(f"Found existing policy '{policy_name}' in Cloudflare with ID: {existing_by_name.get('id')}")
+        return existing_by_name.get("id")
+    created = reusable_policies.create_reusable_policy(
+        name=policy_name,
+        decision=decision,
+        include_rules=include_rules,
+        require_rules=require_rules,
+    )
+    if created and created.get("id"):
+        logging.info(f"Created policy '{policy_name}' in Cloudflare with ID: {created.get('id')}")
+        return created.get("id")
+    logging.error(f"Failed to create policy '{policy_name}' in Cloudflare")
+    return None
+
+
 STATE_SCHEMA_VERSION = 3
 RULE_LIFECYCLE_DEFAULTS = {
     "source_rule_key": None,
@@ -417,40 +476,22 @@ def ensure_default_bypass_policy(flask_app=None):
                 del existing_policy["hide_from_ui"]
                 save_state()
 
-            cf_policy_id = existing_policy.get("cf_policy_id") or existing_policy.get("id")
+            remote_policy_id = get_remote_policy_id(existing_policy, default_bypass_id)
 
-            if flask_app and cf_policy_id != default_bypass_id:  # Has a real CF ID
+            if flask_app and getattr(config, "CF_ACCOUNT_ID", None):
                 with flask_app.app_context():
                     try:
-                        cf_policy = reusable_policies.get_reusable_policy(cf_policy_id)
-                        if cf_policy:
-                            logging.debug(f"Verified default bypass policy exists in Cloudflare: {cf_policy_id}")
-                        else:
-                            logging.warning(f"Default bypass policy {cf_policy_id} not found in Cloudflare, searching by name")
-                            existing_by_name = reusable_policies.find_policy_by_name(cf_policy_name)
-                            if existing_by_name:
-                                found_policy_id = existing_by_name.get("id")
-                                logging.info(f"Found existing bypass policy by name with ID: {found_policy_id}")
-                                existing_policy["cloudflare_policy_id"] = found_policy_id
-                                existing_policy["cf_policy_id"] = found_policy_id
-                                save_state()
-                            else:
-                                logging.info(f"No existing bypass policy found, creating new one")
-                                new_policy = reusable_policies.create_reusable_policy(
-                                    name=cf_policy_name,
-                                    decision="bypass",
-                                    include_rules=[{"everyone": {}}]
-                                )
-                                if new_policy and new_policy.get("id"):
-                                    new_cf_policy_id = new_policy["id"]
-                                    logging.info(f"Created bypass policy in Cloudflare with ID: {new_cf_policy_id}")
-                                    existing_policy["cloudflare_policy_id"] = new_cf_policy_id
-                                    existing_policy["cf_policy_id"] = new_cf_policy_id
-    
```

**File**: `dockflare/app/web/routes.py` (modified, +7/-17)
```diff
@@ -39,7 +39,9 @@
 from app.core.state_manager import (
     access_groups,
     agent_inventory_contains_rule,
+    ensure_default_bypass_policy,
     get_agent,
+    get_remote_policy_id,
     load_state,
     managed_rules,
     save_state,
@@ -480,26 +482,14 @@ def fetch_zone_records(zone_id):
 @login_required
 def access_policies_page():
     """Renders the Access Policies page."""
-    from app.core import reusable_policies
-
     default_bypass_id = "public-default-bypass"
     if default_bypass_id in access_groups:
         policy = access_groups[default_bypass_id]
-        cf_policy_id = policy.get("cf_policy_id")
+        cf_policy_id = get_remote_policy_id(policy, default_bypass_id)
 
-        if not cf_policy_id or cf_policy_id == default_bypass_id:
+        if not cf_policy_id:
             try:
-                cf_policy = reusable_policies.create_reusable_policy(
-                    name="DockFlare-Default-Public-Access-Bypass",
-                    decision="bypass",
-                    include_rules=[{"everyone": {}}]
-                )
-                if cf_policy and cf_policy.get("id"):
-                    with state_lock:
-                        access_groups[default_bypass_id]["cf_policy_id"] = cf_policy["id"]
-                        access_groups[default_bypass_id]["id"] = cf_policy["id"]
-                        save_state()
-                    logging.info(f"Synced default bypass policy to Cloudflare with ID: {cf_policy['id']}")
+                ensure_default_bypass_policy(flask_app=current_app)
             except Exception as e:
                 logging.error(f"Failed to sync default bypass policy to Cloudflare: {e}", exc_info=True)
 
@@ -1575,7 +1565,7 @@ def ui_add_manual_rule_route():
                 default_bypass_id = "public-default-bypass"
                 if default_bypass_id in access_groups:
                     default_bypass_group = access_groups[default_bypass_id]
-                    cf_policy_id = default_bypass_group.get("cf_policy_id") or default_bypass_group.get("id")
+                    cf_policy_id = get_remote_policy_id(default_bypass_group, default_bypass_id)
 
                     access_group_id = [default_bypass_id]
                     access_policy_type = "group"
@@ -1909,7 +1899,7 @@ def ui_edit_manual_rule_route():
                 default_bypass_id = "public-default-bypass"
                 if default_bypass_id in access_groups:
                     default_bypass_group = access_groups[default_bypass_id]
-                    cf_policy_id = default_bypass_group.get("cf_policy_id") or default_bypass_group.get("id")
+                    cf_policy_id = get_remote_policy_id(default_bypass_group, default_bypass_id)
 
                     access_group_id = [default_bypass_id]
                     access_policy_type = "group"
```

---

### Incident Patch 12: `cbad36b2` (2026-09-06)
**Commit Message**: fix for CVE email routes

**File**: `.gitignore` (modified, +1/-1)
```diff
@@ -82,7 +82,6 @@ $RECYCLE.BIN/
 *~
 .directory
 .env
-.claude
 .docs
 /dockflare/tests/
 dockflare-agent/overview.json
@@ -96,3 +95,4 @@ logs/
 DockFlare-Agent-prd/
 unstable-compose.yml
 unstable-local.yml
+/artifacts
\ No newline at end of file
```

**File**: `docker-compose.yml` (modified, +2/-0)
```diff
@@ -60,6 +60,7 @@ services:
       - REDIS_URL=redis://redis:6379/0
       - REDIS_DB_INDEX=0  # Optional: specify Redis database index (0-15) for isolation from other containers
       - DOCKER_HOST=tcp://docker-socket-proxy:2375
+      - INTERNAL_BOOTSTRAP_SECRET=${INTERNAL_BOOTSTRAP_SECRET:?set INTERNAL_BOOTSTRAP_SECRET}
     depends_on:
       docker-socket-proxy:
         condition: service_started
@@ -91,6 +92,7 @@ services:
     environment:
       - DOCKFLARE_MASTER_URL=http://dockflare:5000
       - MAIL_DATA_PATH=/data
+      - INTERNAL_BOOTSTRAP_SECRET=${INTERNAL_BOOTSTRAP_SECRET:?set INTERNAL_BOOTSTRAP_SECRET}
     volumes:
       - mail_data:/data
     depends_on:
```

**File**: `dockflare/app/web/email_routes.py` (modified, +10/-8)
```diff
@@ -1103,25 +1103,27 @@ def email_log_stats():
 
 
 def _check_internal_request():
-    # Block any request that carries Cloudflare edge headers (all public internet
-    # requests via the CF tunnel have CF-Ray; internal Docker requests never do)
+
     if request.headers.get('CF-Ray') or request.headers.get('CF-Connecting-IP'):
         return False
 
-    # Block non-private IPs
     try:
         ip = ipaddress.ip_address(request.remote_addr or '')
         if not ip.is_private:
             return False
     except ValueError:
         return False
 
-    # If a shared secret is configured, require it
     expected = os.environ.get('INTERNAL_BOOTSTRAP_SECRET', '')
-    if expected:
-        provided = request.headers.get('X-Bootstrap-Token', '')
-        if not provided or not hmac.compare_digest(provided, expected):
-            return False
+    if not expected:
+        logging.warning(
+            "INTERNAL_BOOTSTRAP_SECRET is not configured; rejecting internal request"
+        )
+        return False
+
+    provided = request.headers.get('X-Bootstrap-Token', '')
+    if not provided or not hmac.compare_digest(provided, expected):
+        return False
 
     return True
 
```

---

### Incident Patch 13: `66c105c0` (2026-09-01)
**Commit Message**: increased timeout to 30min

**File**: `.github/workflows/docker-agent.yml` (modified, +2/-1)
```diff
@@ -34,7 +34,7 @@ concurrency:
 jobs:
   build_self_hosted:
     runs-on: self-hosted
-    timeout-minutes: 3
+    timeout-minutes: 30
 
     steps:
       - name: Checkout repository
@@ -87,6 +87,7 @@ jobs:
     needs: build_self_hosted
     if: failure() || cancelled()
     runs-on: ubuntu-latest
+    timeout-minutes: 30
 
     steps:
       - name: Checkout repository
```

**File**: `.github/workflows/docker-image.yml` (modified, +6/-1)
```diff
@@ -29,7 +29,7 @@ jobs:
   build_self_hosted:
     runs-on: self-hosted
 
-    timeout-minutes: 3
+    timeout-minutes: 30
     steps:
       - name: Checkout repository
         uses: actions/checkout@v7
@@ -75,11 +75,14 @@ jobs:
           push: ${{ github.event_name == 'push' }}
           tags: ${{ steps.meta.outputs.tags }}
           labels: ${{ steps.meta.outputs.labels }}
+          cache-from: type=gha,scope=dockflare
+          cache-to: type=gha,mode=max,scope=dockflare
 
   build_github_hosted_fallback:
     needs: build_self_hosted
     if: failure() || cancelled()
     runs-on: ubuntu-latest
+    timeout-minutes: 30
     steps:
       - name: Checkout repository
         uses: actions/checkout@v7
@@ -125,3 +128,5 @@ jobs:
           push: ${{ github.event_name == 'push' }}
           tags: ${{ steps.meta.outputs.tags }}
           labels: ${{ steps.meta.outputs.labels }}
+          cache-from: type=gha,scope=dockflare
+          cache-to: type=gha,mode=max,scope=dockflare
```

**File**: `.github/workflows/docker-mail-manager.yml` (modified, +6/-1)
```diff
@@ -29,7 +29,7 @@ jobs:
   build_self_hosted:
     runs-on: self-hosted
 
-    timeout-minutes: 3
+    timeout-minutes: 30
     steps:
       - name: Checkout repository
         uses: actions/checkout@v7
@@ -75,11 +75,14 @@ jobs:
           push: ${{ github.event_name == 'push' }}
           tags: ${{ steps.meta.outputs.tags }}
           labels: ${{ steps.meta.outputs.labels }}
+          cache-from: type=gha,scope=dockflare-mail-manager
+          cache-to: type=gha,mode=max,scope=dockflare-mail-manager
 
   build_github_hosted_fallback:
     needs: build_self_hosted
     if: failure() || cancelled()
     runs-on: ubuntu-latest
+    timeout-minutes: 30
     steps:
       - name: Checkout repository
         uses: actions/checkout@v7
@@ -125,3 +128,5 @@ jobs:
           push: ${{ github.event_name == 'push' }}
           tags: ${{ steps.meta.outputs.tags }}
           labels: ${{ steps.meta.outputs.labels }}
+          cache-from: type=gha,scope=dockflare-mail-manager
+          cache-to: type=gha,mode=max,scope=dockflare-mail-manager
```

**File**: `.github/workflows/docker-webmail.yml` (modified, +6/-1)
```diff
@@ -29,7 +29,7 @@ jobs:
   build_self_hosted:
     runs-on: self-hosted
 
-    timeout-minutes: 3
+    timeout-minutes: 30
     steps:
       - name: Checkout repository
         uses: actions/checkout@v7
@@ -75,11 +75,14 @@ jobs:
           push: ${{ github.event_name == 'push' }}
           tags: ${{ steps.meta.outputs.tags }}
           labels: ${{ steps.meta.outputs.labels }}
+          cache-from: type=gha,scope=dockflare-webmail
+          cache-to: type=gha,mode=max,scope=dockflare-webmail
 
   build_github_hosted_fallback:
     needs: build_self_hosted
     if: failure() || cancelled()
     runs-on: ubuntu-latest
+    timeout-minutes: 30
     steps:
       - name: Checkout repository
         uses: actions/checkout@v7
@@ -125,3 +128,5 @@ jobs:
           push: ${{ github.event_name == 'push' }}
           tags: ${{ steps.meta.outputs.tags }}
           labels: ${{ steps.meta.outputs.labels }}
+          cache-from: type=gha,scope=dockflare-webmail
+          cache-to: type=gha,mode=max,scope=dockflare-webmail
```

---

### Incident Patch 14: `0ffb7c52` (2026-08-31)
**Commit Message**: decom agent ui animations

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ All notable changes to this project will be documented in this file.
 
 ### Added
 - **Safe Agent decommissioning:** Replaced immediate Agent deletion with a durable prepare, ownership-safe Cloudflare cleanup, and final Agent shutdown workflow. Decommissioned Agents persist a local tombstone, stop their managed tunnel without Docker delete permission, revoke their API key only after final acknowledgement, and cannot silently recreate the tunnel after restart. The Agents UI now shows retryable progress and provides separately acknowledged host cleanup commands that remove the Agent Docker deployment while preserving the shared external `cloudflare-net` network.
+  - Improved long-running operation feedback with a wider responsive dialog, animated preparation and active-step indicators, accessible live status text, completed/error step markers, sticky controls, reduced-motion support, and duplicate-action protection while requests are pending.
 
 ### Fixed
 - **UI-overridden container lifecycle:** Recreated Docker and Agent-managed containers now reactivate their existing rules, refresh only their runtime container association, and retain UI-controlled routing, origin, tunnel, and Access settings. Fixes [#388](https://github.com/ChrispyBacon-dev/DockFlare/issues/388).
```

**File**: `dockflare/app/i18n/en.json` (modified, +2/-0)
```diff
@@ -455,6 +455,8 @@
     "agents.decommission_manual_message": "Master cleanup completed and Agent access was revoked, but the Agent could not schedule its own stop. The remote Agent container may still be running and requires the host cleanup steps below.",
     "agents.decommission_forced_message": "Master cleanup completed without confirmed remote shutdown. Remote containers may still be running and require the host cleanup steps below.",
     "agents.decommission_waiting_prepare": "Waiting for the Agent to persist its safety marker and stop the tunnel container.",
+    "agents.decommission_contacting_and_stopping": "Contacting the Agent and waiting for the tunnel to stop…",
+    "agents.decommission_working_hint": "Operation in progress — this may take up to 3 minutes.",
     "agents.decommission_remote_prepared": "The Agent is prepared and the tunnel container is stopped or absent.",
     "agents.decommission_cleaning_master": "Cleaning safely owned Cloudflare and DockFlare resources.",
     "agents.decommission_waiting_finalize": "Waiting for the Agent to acknowledge final shutdown scheduling.",
```

**File**: `dockflare/app/templates/agents.html` (modified, +129/-17)
```diff
@@ -249,11 +249,13 @@ <h3 class="font-bold text-lg">{{ t('agents.rename_agent') }}</h3>
 </dialog>
 
 <dialog id="modal-decommission-agent" class="modal">
-  <div class="modal-box w-11/12 max-w-3xl">
-    <h3 class="font-bold text-lg">{{ t('agents.decommission_title') }}</h3>
-    <div class="flex items-center justify-between gap-3 py-3">
-      <p id="decommission-summary" class="min-w-0 text-sm font-medium"></p>
-      <span id="decommission-agent-status" class="badge badge-sm hidden shrink-0"></span>
+  <div class="modal-box decommission-modal-box w-11/12 max-w-5xl">
+    <div class="decommission-modal-header">
+      <h3 class="font-bold text-lg">{{ t('agents.decommission_title') }}</h3>
+      <div class="flex items-center justify-between gap-3 py-3">
+        <p id="decommission-summary" class="min-w-0 text-sm font-medium"></p>
+        <span id="decommission-agent-status" class="badge badge-sm hidden shrink-0"></span>
+      </div>
     </div>
     <div id="decommission-preflight" class="hidden mb-4 rounded-md border border-base-300 bg-base-200/50 p-4">
       <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
@@ -299,7 +301,16 @@ <h3 class="font-bold text-lg">{{ t('agents.decommission_title') }}</h3>
       <li class="step" data-phase="shutdown_scheduled">{{ t('agents.decommission_revoke_access') }}</li>
       <li class="step" data-phase="completed">{{ t('agents.decommission_complete') }}</li>
     </ol>
-    <div id="decommission-message" class="text-sm mb-4" aria-live="polite"></div>
+    <div id="decommission-status" class="mb-4" role="status" aria-live="polite" aria-atomic="true">
+      <div id="decommission-working" class="decommission-working-panel hidden items-center gap-3 rounded-md border p-3">
+        <span class="loading loading-spinner decommission-working-spinner text-primary shrink-0" aria-hidden="true"></span>
+        <div>
+          <p id="decommission-working-message" class="text-sm font-medium"></p>
+          <p class="mt-1 text-xs text-base-content/60">{{ t('agents.decommission_working_hint') }}</p>
+        </div>
+      </div>
+      <div id="decommission-message" class="text-sm"></div>
+    </div>
     <div id="decommission-cleanup" class="hidden space-y-4">
       <div class="alert alert-info"><span>{{ t('agents.decommission_host_responsibility') }}</span></div>
       <label class="label cursor-pointer justify-start gap-3">
@@ -321,7 +332,7 @@ <h3 class="font-bold text-lg">{{ t('agents.decommission_title') }}</h3>
       </div>
       <p class="text-xs text-base-content/60">{{ t('agents.decommission_network_preserved') }}</p>
     </div>
-    <div class="modal-action">
+    <div class="modal-action decommission-modal-actions">
       <button id="btn-start-decommission" class="btn btn-error">{{ t('agents.decommission_action') }}</button>
       <button id="btn-retry-decommission" class="btn btn-warning hidden">{{ t('agents.decommission_retry') }}</button>
       <button id="btn-force-decommission" class="btn btn-error btn-outline hidden">{{ t('agents.decommission_force') }}</button>
@@ -519,6 +530,51 @@ <h3 class="font-bold text-lg">{{ t('agents.key_rolled_success') }}</h3>
   vertical-align: top !important;
 }
 
+.decommission-modal-box {
+  max-height: calc(100vh - 2rem);
+  overflow-y: auto;
+}
+
+.decommission-modal-header {
+  position: sticky;
+  top: -1.5rem;
+  z-index: 10;
+  margin: -1.5rem -1.5rem 0;
+  padding: 1.5rem 1.5rem 0;
+  background: var(--fallback-b1, oklch(var(--b1) / 1));
+}
+
+.decommission-modal-actions {
+  position: sticky;
+  bottom: -1.5rem;
+  z-index: 10;
+  margin-right: -1.5rem;
+  margin-bottom: -1.5rem;
+  margin-left: -1.5rem;
+  padding: 1rem 1.5rem 1.5rem;
+  border-top: 1px solid var(--fallback-b3, oklch(var(--b3) / 1));
+  background: var(--fallback-b1, oklch(var(--b1) / 1));
+}
+
+.decommission-working-panel {
+  border-color: oklch(var(--p) / 0.3);
+  background: oklch(var(--p) / 0.1);
+}
+
+.decommission-working-spinner {
+  width: 1.25rem;
+  height: 1.25rem;
+}
+
+#decommission-progress .decommission-active-step::after,
+#decommission-progress.decommission-preparing .step:nth-child(2)::after {
+  animation: decommission-step-pulse 1.4s ease-in-out infinite;
+}
+
+#decommission-progress.decommission-preparing .step:nth-child(2)::before {
+  animation: decommission-connector-pulse 1.4s ease-in-out infinite;
+}
+
 /* Animations */
 @keyframes led-pulse-critical {
   0% {
@@ -557,6 +613,25 @@ <h3 class="font-bold text-lg">{{ t('agents.key_rolled_success') }}</h3>
   50% { background-color: #065f46; }
   100% { background-color: #1f2937; }
 }
+
+@keyframes decommission-step-pulse {
+  0%, 100% { box-shadow: 0 0 0 0 oklch(var(--p) / 0.4); }
+  50% { box-shadow: 0 0 0 0.45rem oklch(var(--p) / 0); }
+}
+
+@keyframes decommission-connector-pulse {
+  0%, 100% { opacity: 0.35; }
+  50% { opacity: 1; }
+}
+
+@media (prefers-reduced-motion: reduce) {
+  #decommission-progress .decommission-active-step::after,
+  #decommission-pr
```

**File**: `dockflare/tests/test_agent_decommission.py` (modified, +5/-0)
```diff
@@ -374,6 +374,11 @@ def test_agents_page_renders_decommission_workflow_without_internal_spec(self):
         self.assertIn("<dl class=", rendered)
         self.assertIn('id="decommission-last-contact"', rendered)
         self.assertIn('id="decommission-agent-status"', rendered)
+        self.assertIn('max-w-5xl', rendered)
+        self.assertIn('id="decommission-working"', rendered)
+        self.assertIn('aria-live="polite"', rendered)
+        self.assertIn('decommission-preparing', rendered)
+        self.assertIn('prefers-reduced-motion: reduce', rendered)
         self.assertIn("confirm-agent-data-delete", rendered)
         self.assertIn("confirm-agent-files-delete", rendered)
         self.assertNotIn("whitespace-pre-line", rendered)
```

---

### Incident Patch 15: `ae2afdb6` (2026-08-31)
**Commit Message**: agent decom ui fix

**File**: `dockflare/app/i18n/en.json` (modified, +4/-2)
```diff
@@ -415,7 +415,7 @@
     "agents.decommission_action": "Decommission Agent",
     "agents.decommission_view": "View decommission progress",
     "agents.decommissioning": "Decommissioning",
-    "agents.decommission_warning": "Services published by this Agent will become unavailable. DockFlare will stop remote containers but will not delete them.",
+    "agents.decommission_warning": "Published services will become unavailable. Containers are stopped remotely but must be removed manually.",
     "agents.decommission_contact": "Contact Agent",
     "agents.decommission_stop_tunnel": "Stop tunnel",
     "agents.decommission_cloudflare": "Clean resources",
@@ -426,7 +426,9 @@
     "agents.decommission_ready": "Review the impact, then start the decommission operation.",
     "agents.decommission_resume": "Resuming the saved Agent decommission operation.",
     "agents.decommission_online": "Agent is online",
+    "agents.decommission_online_short": "Online",
     "agents.decommission_offline": "Agent is offline; cleanup will wait unless you explicitly force Master cleanup",
+    "agents.decommission_offline_short": "Offline",
     "agents.decommission_unknown_agent": "Agent",
     "agents.decommission_confirm": "Decommission this Agent? DockFlare will first stop its tunnel, clean only safely owned Cloudflare resources, revoke its key, and schedule the Agent container to stop.",
     "agents.decommission_retry": "Retry current step",
@@ -448,7 +450,7 @@
     "agents.decommission_stop_scheduled": "stop will be scheduled after final acknowledgement",
     "agents.decommission_manual_required": "manual host stop is required",
     "agents.decommission_unknown": "unknown; preserve by default",
-    "agents.decommission_reverse_deploy_notice": "After completion, the user-run reverse deploy removes the tunnel, Agent, socket proxy, Agent data volume, private Compose network, and removable images. A separate optional command removes $HOME/dockflare-agent, including docker-compose.yml and any .env file.",
+    "agents.decommission_reverse_deploy_notice": "After completion, run the provided reverse-deploy commands on the Agent host. The external cloudflare-net network is preserved.",
     "agents.decommission_completed_message": "Agent decommissioned. The tunnel container was stopped, Cloudflare resources were cleaned according to ownership, Agent access was revoked, and the Agent container stop was scheduled. Complete host cleanup with the reverse-deploy steps below.",
     "agents.decommission_manual_message": "Master cleanup completed and Agent access was revoked, but the Agent could not schedule its own stop. The remote Agent container may still be running and requires the host cleanup steps below.",
     "agents.decommission_forced_message": "Master cleanup completed without confirmed remote shutdown. Remote containers may still be running and require the host cleanup steps below.",
```

**File**: `dockflare/app/templates/agents.html` (modified, +82/-23)
```diff
@@ -251,12 +251,47 @@ <h3 class="font-bold text-lg">{{ t('agents.rename_agent') }}</h3>
 <dialog id="modal-decommission-agent" class="modal">
   <div class="modal-box w-11/12 max-w-3xl">
     <h3 class="font-bold text-lg">{{ t('agents.decommission_title') }}</h3>
-    <p id="decommission-summary" class="py-3 text-sm text-base-content/70"></p>
-    <p id="decommission-preflight" class="hidden mb-4 rounded-md bg-base-200 p-3 text-sm whitespace-pre-line"></p>
+    <div class="flex items-center justify-between gap-3 py-3">
+      <p id="decommission-summary" class="min-w-0 text-sm font-medium"></p>
+      <span id="decommission-agent-status" class="badge badge-sm hidden shrink-0"></span>
+    </div>
+    <div id="decommission-preflight" class="hidden mb-4 rounded-md border border-base-300 bg-base-200/50 p-4">
+      <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
+        <div>
+          <dt class="text-xs uppercase tracking-wide text-base-content/60">{{ t('agents.decommission_last_contact') }}</dt>
+          <dd id="decommission-last-contact" class="mt-1 text-sm font-medium"></dd>
+        </div>
+        <div>
+          <dt class="text-xs uppercase tracking-wide text-base-content/60">{{ t('agents.decommission_assigned_tunnel') }}</dt>
+          <dd id="decommission-assigned-tunnel" class="mt-1 text-sm font-medium break-all"></dd>
+        </div>
+        <div>
+          <dt class="text-xs uppercase tracking-wide text-base-content/60">{{ t('agents.decommission_tunnel_disposition') }}</dt>
+          <dd id="decommission-tunnel-disposition" class="mt-1 text-sm font-medium"></dd>
+        </div>
+        <div>
+          <dt class="text-xs uppercase tracking-wide text-base-content/60">{{ t('agents.decommission_remote_tunnel_action') }}</dt>
+          <dd id="decommission-tunnel-action" class="mt-1 text-sm font-medium"></dd>
+        </div>
+        <div>
+          <dt class="text-xs uppercase tracking-wide text-base-content/60">{{ t('agents.decommission_remote_agent_action') }}</dt>
+          <dd id="decommission-agent-action" class="mt-1 text-sm font-medium"></dd>
+        </div>
+        <div>
+          <dt class="text-xs uppercase tracking-wide text-base-content/60">{{ t('agents.decommission_container_names') }}</dt>
+          <dd id="decommission-container-names" class="mt-1 text-sm font-mono break-all"></dd>
+        </div>
+        <div>
+          <dt class="text-xs uppercase tracking-wide text-base-content/60">{{ t('agents.decommission_preserved_network') }}</dt>
+          <dd id="decommission-preserved-network" class="mt-1 text-sm font-mono"></dd>
+        </div>
+      </dl>
+      <p class="mt-4 border-t border-base-300 pt-2 text-xs text-base-content/70">{{ t('agents.decommission_reverse_deploy_notice') }}</p>
+    </div>
     <div class="alert alert-warning mb-4">
       <span>{{ t('agents.decommission_warning') }}</span>
     </div>
-    <ol id="decommission-progress" class="steps steps-vertical sm:steps-horizontal w-full text-xs mb-4">
+    <ol id="decommission-progress" class="steps steps-vertical sm:steps-horizontal hidden w-full text-xs mb-4">
       <li class="step" data-phase="waiting_for_prepare">{{ t('agents.decommission_contact') }}</li>
       <li class="step" data-phase="remote_prepared">{{ t('agents.decommission_stop_tunnel') }}</li>
       <li class="step" data-phase="master_cleanup">{{ t('agents.decommission_cloudflare') }}</li>
@@ -290,7 +325,7 @@ <h3 class="font-bold text-lg">{{ t('agents.decommission_title') }}</h3>
       <button id="btn-start-decommission" class="btn btn-error">{{ t('agents.decommission_action') }}</button>
       <button id="btn-retry-decommission" class="btn btn-warning hidden">{{ t('agents.decommission_retry') }}</button>
       <button id="btn-force-decommission" class="btn btn-error btn-outline hidden">{{ t('agents.decommission_force') }}</button>
-      <button type="button" class="btn btn-ghost" onclick="document.getElementById('modal-decommission-agent').close()">{{ t('common.close') }}</button>
+      <button type="button" class="btn btn-ghost" onclick="document.getElementById('modal-decommission-agent').close()">{{ t('common.cancel') }}</button>
     </div>
   </div>
   <form method="dialog" class="modal-backdrop"><button>{{ t('common.close') }}</button></form>
@@ -1025,6 +1060,7 @@ <h3 class="font-bold text-lg">{{ t('agents.key_rolled_success') }}</h3>
   let currentDecommissionOperationId = null;
   let currentDecommissionState = null;
   let currentDecommissionAgentOnline = null;
+  let currentDecommissionPreview = null;
   let decommissionPollTimer = null;
 
   const decommissionPhaseOrder = {
@@ -1086,35 +1122,52 @@ <h3 class="font-bold text-lg">{{ t('agents.key_rolled_success') }}</h3>
     document.getElementById('decommission-docker-command').textContent = '';
     document.getElementById('decommission-files-command').textContent = '';
     document.getElementById('decommission-preflight').classList.add('hidden');
-    docu
```

**File**: `dockflare/tests/test_agent_decommission.py` (modified, +4/-0)
```diff
@@ -371,8 +371,12 @@ def test_agents_page_renders_decommission_workflow_without_internal_spec(self):
         with app.test_request_context("/agents"):
             rendered = render_template("agents.html")
         self.assertIn("modal-decommission-agent", rendered)
+        self.assertIn("<dl class=", rendered)
+        self.assertIn('id="decommission-last-contact"', rendered)
+        self.assertIn('id="decommission-agent-status"', rendered)
         self.assertIn("confirm-agent-data-delete", rendered)
         self.assertIn("confirm-agent-files-delete", rendered)
+        self.assertNotIn("whitespace-pre-line", rendered)
         self.assertNotIn("AGENT_DECOMMISSION_SPEC", rendered)
 
 
```

#### Recent Merged Pull Requests:
- **PR #400** (2026-09-20): v3.1.6  (@ChrispyBacon-dev)
- **PR #398** (2026-09-06): merge from stable latest (@ChrispyBacon-dev)
- **PR #397** (2026-09-04): Update Italian translations (@albanobattistella)
- **PR #395** (2026-09-01): Unstable merge v3.1.4 (@ChrispyBacon-dev)
- **PR #394** (2026-09-01): v3.1.5 - RC (@ChrispyBacon-dev)
- **PR #393** (2026-08-20): stable build to dev branch (@ChrispyBacon-dev)
- **PR #392** (2026-08-17): v3.1.4 (@ChrispyBacon-dev)
- **PR #387** (2026-08-05): merge v3.1.3 (@ChrispyBacon-dev)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
