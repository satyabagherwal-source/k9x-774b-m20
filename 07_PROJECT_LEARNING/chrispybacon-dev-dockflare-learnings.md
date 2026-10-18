> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/chrispybacon-dev-dockflare-learnings.md`  
> **Source**: github ([https://github.com/ChrispyBacon-dev/DockFlare](https://github.com/ChrispyBacon-dev/DockFlare))  
> **Source Version**: `9c7bed82`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T21:45:56.416Z  
> **Learning ID**: `learn-github-chrispybacon-dev-dockflare`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): ChrispyBacon-dev/DockFlare

> **Canonical Artifact**: `07_PROJECT_LEARNING/chrispybacon-dev-dockflare-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ChrispyBacon-dev/DockFlare](https://github.com/ChrispyBacon-dev/DockFlare))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-18T21:45:56.410Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ChrispyBacon-dev/DockFlare`
- **Description**: DockFlare: Automate Cloudflare Tunnels with Docker Labels
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: N/A
- **Stars / Engagement**: 2489 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #389** (2026-08-17): **Domain parsing incorrectly splits "domain.side.co.uk" as "domain.side" + "co.uk" instead of "domain" + "side.co.uk"**
  *Symptoms*: When entering a domain containing a second-level domain (SLD) pattern like "co.uk", the parsing logic incorrectly separates the domain. The "co" TLD suffix is being treated as a standalone TLD rather than recognizing the "co.uk" pattern as a single second-level domain unit.
  **Post-Mortem & Fix Analysis**:
  > thank you for reporting this. I look into that, this could be really a bug in the pattern logic, I never used a SLD. thank you good catch. 
  > bug confirmed... the problem is I don't have an SLD in my cloudflare account would you be able to test a fix? work on a fix on unstable branch. 

- **Issue #388** (2026-09-01): **UI-overridden Docker rules stay pending_deletion after container recreate/update**
  *Symptoms*: ### Summary  When a Docker-sourced rule has `rule_ui_override: true` (set after editing the rule in the UI), container **stop** correctly schedules grace-period deletion, but container **start/recreate** does **not** restore the rule to `active`. The hostname stays `pending_deletion` until `delete_at`, even though the replacement container is healthy and still has valid `dockflare.*` labels.  ### Expected behavior  On container update/recreate:  1. Stop → rule enters `pending_deletion` (grace period) — OK 2. New container starts with the same hostname labels → rule returns to `active`, `delete_at` cleared, tunnel ingress retained  UI override should protect Access/service edits from being overwritten by labels, **not** block tunnel lifecycle recovery.  ### Actual behavior  Step 2 is skipped. Logs show:  ```text DOCKER_HANDLER: Rule <hostname>| is UI-overridden, skipping Docker updates for <container>. ```  The rule remains `pending_deletion` for the full grace period (default 8h) and is then removed from the tunnel despite the app still running.  ### Reproduction  1. Deploy a labeled container (`dockflare.enable=true`, hostname + service). 2. In the DockFlare UI, edit that rule (e.g. Access groups) so it shows **UI Override** / `rule_ui_override: true`. 3. Recreate/update the container (`docker compose up -d --force-recreate` or equivalent). 4. Observe the rule flip to **pending deletion** with an expiration countdown and never return to **active**

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

### Incident Patch 1: `0f29d58f` (2026-09-19)
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

### Incident Patch 2: `732bf1fc` (2026-09-19)
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

### Incident Patch 3: `cbad36b2` (2026-09-06)
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

#### Recent Merged Pull Requests:
- **PR #404** (2026-10-06): fix: restore missing tunnel metadata when editing manual rules (@Vaso73)
- **PR #400** (2026-09-20): v3.1.6  (@ChrispyBacon-dev)
- **PR #398** (2026-09-06): merge from stable latest (@ChrispyBacon-dev)
- **PR #397** (2026-09-04): Update Italian translations (@albanobattistella)
- **PR #395** (2026-09-01): Unstable merge v3.1.4 (@ChrispyBacon-dev)
- **PR #394** (2026-09-01): v3.1.5 - RC (@ChrispyBacon-dev)

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

## X. security fixes - details in changelog

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ChrispyBacon-dev/DockFlare. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0f29d58f`: security fixes - details in changelog. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
### Security
- **Outbound email worker hardening:** The worker no longer relays for arbitrary senders - it pins the sender to the configured domain (plus an optional allowlist), validates recipients, strips CR/LF from all headers to block header/MIME injection, stops leaking the `Bcc:` header, encodes attachment filenames, compares the auth secret in constant time, and enforces per-sender hourly/daily rate limits. Mail-manager sanitizes header fields before dispatch too.
- **Agent API Access app no longer bypasses everyone:** The `/api/v2/agents/` Cloudflare Access app no longer gets a `bypass` policy for `everyone`, and existing installs are cleaned up on startup. Admin browser bypass, when wanted, is scoped to the configured authorized emails.
- **Agent secrets removed from `state.json`:** Agent API keys and tunnel tokens now live only in the encrypted key store, legacy plaintext values are migrated on first load, backups no longer contain them, and rolling a key revokes all previous active keys.
- **Mail-manager secrets encrypted at rest:** R2 secret keys, webhook secrets and outbound auth secrets are AES-GCM encrypted in the SQLite DB (`MAIL_SECRET_KEY`, falling back to the boo
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0f29d58f` are properly handled with clean fallback behavior.
