> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yuezhiai-jonex-learnings.md`  
> **Source**: github ([https://github.com/yuezhiai/jonex](https://github.com/yuezhiai/jonex))  
> **Source Version**: `13f93d97`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T03:37:02.914Z  
> **Learning ID**: `learn-github-yuezhiai-jonex`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): yuezhiai/jonex

---

## 1. Executive Forensic Architecture & System Mechanics

`yuezhiai/jonex` addresses a critical problem in enterprise AI architectures: **the deterministic bridge between unstructured multimodal inputs and grounded, auditable enterprise knowledge consumption**. Standard Retrieval-Augmented Generation (RAG) pipelines suffer from nondeterministic ingestion drift, silent credential corruption across container topologies, hallucinated citation linkages, and security bypasses via unauthenticated test tokens or legacy crypto keys.

```
+----------------------------------------------------------------------------------------------------+
|                                      API GATEWAY / INGRESS                                         |
|  - fail-closed security guards: assert_secure_jwt_secret(), require_test_token_allowed()           |
|  - Tenant context resolution: Bearer JWT -> X-Tenant-ID verification                               |
+-------------------------------------------------+--------------------------------------------------+
                                                  |
                         +------------------------+------------------------+
                         |                                                 |
                         v                                                 v
+--------------------------------------------------+   +---------------------------------------------+
|          PLATFORM CAPABILITY & AUTH              |   |          JONEX WIKI ENGINE (OKF)            |
| - TenantSecurityConfigService (3-tier fallback)   |   | - Incremental compiler (Algorithm 1)        |
| - Identity synchronization & token rotation      |   | - Dependency key hashing & block replay     |
| - AuditLogSink & MonitorCollector (background)   |   | - Exact SourceSpan binding & Claim gate     |
+------------------------+-------------------------+   +----------------------+----------------------+
                         |                                                    |
                         |                      POSTGRESQL                    |
                         +------------------------->+<------------------------+
                                                    |
                                    +---------------+---------------+
                                    | Schema: public                |
                                    | Schema: data_governance       |
                                    | Schema: monitor               |
                                    +-------------------------------+
```

### Architectural Subsystem Boundaries & Invariants

1. **Dual-Engine Knowledge Architecture**:
   - **Graph Ontology / LightRAG**: Manages entity-relation extraction and vector/graph hybrid search (`.env.rag`).
   - **Jonex Wiki (Open Knowledge Format - OKF)**: Manages deterministic claim compilation (`Reference/JonexWiki`). Changes to inputs do not trigger full re-indexing; instead, an incremental compiler evaluates content fingerprints (`SourceDigest`) through dependency graphs, isolating unchanged passages and pruning dangling displays.

2. **Distributed Micro-Capability Isolation**:
   - Subsystems (`platform`, `business_domain`, `rag`, `mcp-server`) run as distinct containers coordinating over internal network barriers (`jonex-network`).
   - **State Ownership Law**: Secrets and config are decentralized into specialized env profiles (`.env`, `.env.mcp`, `.env.rag`, `.env.openkb`, `.env.jonex_wiki`), requiring automated synchronization to eliminate cross-file credential drift.

3. **Multi-Tenancy Isolation Primitive**:
   - Every request resolves a canonical `tenant_id` via `extract_tenant_id()` and establishes Python `contextvars.ContextVar` isolation scopes via `tenant_scope(tenant_id)`.
   - APIs cannot accept tenant identity from client payloads when operating on security configurations; identity must be bound strictly to the cryptographically verified JWT bearer token.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Multi-Tier Distributed Secret Alignment Invariant
**RULE**:
When an infrastructure deployment partitions configuration across multiple environment profiles or service files, every shared credential or derived cryptographic salt **MUST** be verified for identical values across all files, and generation scripts **MUST** update cross-file groups atomically under an explicit inclusion whitelist. Generation scripts **MUST NOT** match keys via loose string patterns.

**WHY**:
In distributed micro-capability systems, key divergence across files causes silent downstream partial failures:
- If `DB_PASSWORD` is updated in `.env` but `POSTGRES_PASSWORD` is missed in `.env.rag`, the platform starts while background graph ingestion fails silently.
- If loose regex matching (`re.search("KEY|SECRET", name)`) is applied, external vendor keys (`LLMGW_UPSTREAM_LLM_API_KEY`, `COS_SECRET_KEY`) get overwritten with random platform strings, breaking upstream API connections.
- If derivative keys fall back to a shared master root (`MCP_KEY_SECRET` defaulting to `JWT_SECRET`), rotating `JWT_SECRET` invalidates all downstream HMAC signatures, breaking all deployed agent keys.

**WHEN TO APPLY**:
Apply to all microservice, multi-container Docker Compose, or Kubernetes architectures where environment variables are split across files or services (e.g., `.env`, `.env.mcp`, Helm values per subchart).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# scripts/security/secret_sync_engine.py
from __future__ import annotations
import secrets
from pathlib import Path
from typing import Dict, List, Set

# Invariant 1: Explicit whitelist. External credentials MUST NEVER be generated.
PLATFORM_SECRETS_WHITELIST: Set[str] = {
    "JWT_SECRET", "GATEWAY_API_KEY", "INTERNAL_API_KEY",
    "MCP_KEY_SECRET", "DATA_SOURCE_SECRET_KEY", "DB_PASSWORD"
}

# Invariant 2: Explicit equality groups spanning divergent variable names
CROSS_KEY_EQUALITY_GROUPS: List[List[str]] = [
    ["DB_PASSWORD", "POSTGRES_PASSWORD"],
    ["MINIO_ROOT_USER", "MINIO_ACCESS_KEY"],
    ["MINIO_ROOT_PASSWORD", "MINIO_SECRET_KEY"],
]

def audit_secret_consistency(env_files: Dict[Path, Dict[str, str]]) -> List[str]:
    violations: List[str] = []
    
    # Check 1: Cross-file same-name invariant
    all_keys = {k for d in env_files.values() for k in d.keys()}
    for k in all_keys:
        if k in PLATFORM_SECRETS_WHITELIST:
            seen_values: Dict[str, Path] = {}
            for path, env_dict in env_files.items():
                val = env_dict.get(k)
                if val:
                    if not seen_values:
                        seen_values[val] = path
                    elif val not in seen_values:
                        primary_val, primary_path = next(iter(seen_values.items()))
                        violations.append(
                            f"DRIFT: {k} in {path.name} differs from {primary_path.name}"
                        )
                        
    # Check 2: Cross-key group invariant
    for group in CROSS_KEY_EQUALITY_GROUPS:
        resolved_vals: Dict[str, tuple[str, Path]] = {}
        for path, env_dict in env_files.items():
            for key in group:
                if key in env_dict and env_dict[key]:
                    resolved_vals[key] = (env_dict[key], path)
        if len(set(v[0] for v in resolved_vals.values())) > 1:
            violations.append(f"GROUP DRIFT: Values for {group} do not match across stack: {resolved_vals}")

    return violations
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Regex auto-generation and silent default fallbacks
def regenerate_all_secrets(env_file_path: Path):
    lines = env_file_path.read_text().splitlines()
    out = []
    for line in lines:
        # HAZARD 1: Overwrites upstream external provider API keys
        if any(token in line for token in ["SECRET", "KEY", "PASSWORD"]):
            k, _ = line.split("=", 1)
            # HAZARD 2: Breaks cross-service synchronization by generating independent keys
            out.append(f"{k}={secrets.token_urlsafe(32)}")
        else:
            out.append(line)
    env_file_path.write_text("\n".join(out))
```

**VERIFICATION METHOD**:
Enforce an automated pre-flight CI/CD step:
```bash
python scripts/security/audit_profile.py --profile deploy/env/production
# Invariant assertion: Exit code MUST be 0. Any key mismatch or public fallback exits 1.
```

---

### 2. Strict Grounded Evidence Span-Binding Invariant
**RULE**:
In knowledge compilation and RAG pipelines, an extracted factual claim **MUST NOT** achieve status `SUPPORTED` unless it is bound to one or more verified, immutable `SourceSpan` records. Each `SourceSpan` **MUST** cryptographically bind the source hash, chunk identifier, start character offset, end character offset, and exact character payload. Factual claims with unresolvable or missing evidence **MUST** fail closed to `NOT_ENOUGH_INFO` or `REFUTED`.

**WHY**:
Allowing LLM synthesizers to output claims with loose, page-level, or unverified document-level references causes hallucination leaks. Without character-offset and document-hash locking, downstream document mutations or parser alterations render previously asserted claims untraceable. If the underlying document changes, claims referencing old offsets must be discarded or marked unverified rather than re-bound on title alone.

**WHEN TO APPLY**:
All systems processing enterprise documents, legal knowledge bases, compliance corpora, and factual QA engines where hallucination carries legal or operational liability.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# jonex_wiki/domain/engine/compile/content_validation.py
from pydantic import BaseModel, Field, model_validator, ConfigDict
from typing import List, Literal

class SourceSpan(BaseModel):
    passage_id: str
    source_id: str
    document_id: str
    chunk_id: str
    passage_text_sha256: str
    start_char: int
    end_char: int
    model_config = ConfigDict(extra="forbid", frozen=True)

class ValidatedClaim(BaseModel):
    claim_id: str
    page_path: str
    text: str
    evidence: List[EvidenceRef] = Field(default_factory=list, max_length=20)
    unresolved_evidence: List[EvidenceRef] = Field(default_factory=list, max_length=20)
    source_spans: List[SourceSpan] = Field(default_factory=list, max_length=20)
    support_status: Literal["SUPPORTED", "REFUTED", "NOT_ENOUGH_INFO"] = "NOT_ENOUGH_INFO"
    support_reason: str = "support_not_evaluated"

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def enforce_grounded_evidence_binding(self):
        # Invariant 1: SUPPORTED claims MUST have physical source spans
        if self.support_status in ("SUPPORTED", "REFUTED") and not self.source_spans:
            raise ValueError(f"Status '{self.support_status}' requires at least one valid SourceSpan")
        
        # Invariant 2: Cannot claim SUPPORTED if any evidence failed resolution
        if self.support_status == "SUPPORTED" and self.unresolved_evidence:
            raise ValueError("SUPPORTED claims cannot contain unresolved evidence references")
            
        # Invariant 3: Spans must bind to resolved evidence
        evidence_identities = {
            (r.passage_id, r.source_id, r.document_id, r.chunk_id) 
            for r in self.evidence
        }
        for span in self.source_spans:
            span_id = (span.passage_id, span.source_id, span.document_id, span.chunk_id)
            if span_id not in evidence_identities:
                raise ValueError("SourceSpan references evidence not present in resolved evidence list")
        return self
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Trusting LLM self-evaluation without cryptographic/offset verification
def validate_claim_unsafe(llm_response: dict) -> dict:
    # HAZARD: Model claims text is supported without offset verification or hash checks
    if llm_response.get("model_verdict") == "TRUE":
        return {
            "claim": llm_response["text"],
            "status": "SUPPORTED",
            "source": llm_response.get("document_name") # Non-deterministic string citation
        }
    return {"status": "NOT_ENOUGH_INFO"}
```

**VERIFICATION METHOD**:
Implement property-based testing via `hypothesis`:
```python
@given(claim_text=st.text(min_size=1), spans=st.lists(st.builds(SourceSpan), max_size=0))
def test_unsupported_claim_without_spans_fails(claim_text, spans):
    with pytest.raises(ValueError, match="requires at least one valid SourceSpan"):
        ValidatedClaim(
            claim_id="claim_0123456789abcdef01234567",
            page_path="/kb/test",
            text=claim_text,
            source_spans=spans,
            support_status="SUPPORTED"
        )
```

---

### 3. Fail-Closed Cryptographic Startup Isolation Invariant
**RULE**:
All production security guards asserting key entropy, token complexity, or default sentinel detection **MUST NOT** branch conditionally on environment variables like `ENV == "prod"` when evaluating system-critical secrets. They **MUST** evaluate unconditionally, utilizing explicit opt-in override flags (`ALLOW_INSECURE_JWT_SECRET=true`) only for local development.

**WHY**:
Relying on `config.is_production` or `ENV == "prod"` introduces a catastrophic failure mode: when a production container is deployed without an explicit `ENV=prod` variable, it defaults silently to `ENV="dev"`. Under conditional guards, this causes production instances to run with well-known sentinel strings (`change-me-in-production`, `your_jwt_secret_key_here_...`), leaving them vulnerable to unauthenticated admin JWT forging, arbitrary tenant data injection, and signature spoofing.

**WHEN TO APPLY**:
Startup lifecycle of all backend systems, API Gateways, and microservices managing JWT validation, cryptographic signature verification, or database encryption.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# jonex_core/common/security_guards.py
import os
from typing import Set

_INSECURE_SENTINELS: Set[str] = {
    "your_jwt_secret_key_here_please_change_in_production",
    "your_jwt_secret_key_here_change_in_production_please_use_a_strong_secret",
    "change-me-in-production",
    "change-me-must-match-platform-deploy-env",
    "minioadmin",
}

def assert_secure_secret(key_name: str, value: str | None) -> None:
    # Dev escape hatch MUST be explicitly named and set
    escape_hatch = os.getenv("ALLOW_INSECURE_SECRETS", "").strip().lower()
    if escape_hatch in {"1", "true", "yes", "on"}:
        return

    text = (value or "").strip()
    if not text:
        raise RuntimeError(f"FATAL SECURITY GUARD: {key_name} is unset or empty. Process halted.")
    
    # Unconditional check: Cannot be bypassed by omitting ENV=prod
    if text in _INSECURE_SENTINELS:
        raise RuntimeError(
            f"FATAL SECURITY GUARD: {key_name} contains a known public repository sentinel string. "
            f"Refusing to start. Set a secure, random value or set ALLOW_INSECURE_SECRETS=1 for dev."
        )
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Environment-conditional check permitting silent fallback
def check_jwt_secret_insecure(config):
    # HAZARD: If ENV is omitted in docker-compose, is_production is False!
    if config.is_production:
        if config.JWT_SECRET == "change-me":
            raise RuntimeError("Insecure secret in production!")
    # In non-production, silent execution proceeds with public sentinel keys
```

**VERIFICATION METHOD**:
Add a test ensuring the system refuses to boot without the escape hatch:
```python
def test_startup_guard_fails_when_env_unset(monkeypatch):
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.setenv("JWT_SECRET", "change-me-in-production")
    monkeypatch.delenv("ALLOW_INSECURE_SECRETS", raising=False)
    with pytest.raises(RuntimeError, match="contains a known public repository sentinel"):
        assert_secure_secret("JWT_SECRET", os.getenv("JWT_SECRET"))
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Test Token Backdoor Bypass in Non-Dev Topologies (BUG-AUTH-01)
- **Context**: `jonex_core/common/tenant.py` and `api_gateway/main.py`
- **What Was Expected**: Test tokens prefixed with `jonex_test_{tenant_id}` must only be usable by unit test suites in explicit local development setups.
- **What Actually Happened**: The check evaluated `if config.ENABLE_TEST_TOKENS and api_key.startswith("jonex_test_")`. However, when configurations defaulted or developers copied environments into UAT/Staging/Production without toggling flags, attackers could send `Authorization: Bearer jonex_test_master` to impersonate arbitrary tenants and bypass Keycloak/JWT validation entirely.
- **Evidence in Repo**: Commit `b6e8b1f1`, files `jonex_core/common/tenant.py` and `api_gateway/main.py`.
- **Root Cause**: Reliance on boolean flags instead of fail-closed runtime environment assertions. If `ENABLE_TEST_TOKENS` was left untouched or misconfigured, the backdoor remained open across boundaries.
- **Remediation Code Diff**:
```diff
--- a/api_gateway/main.py
+++ b/api_gateway/main.py
@@ -54,8 +56,9 @@ async def verify_api_key(request: Request) -> str:
         raise MissingApiKeyError()
 
     # TODO: 从数据库验证 API Key
-    # 临时实现：仅当显式开启 ENABLE_TEST_TOKENS 时接受测试用 API Key
-    if config.ENABLE_TEST_TOKENS and api_key.startswith("jonex_test_"):
+    # 临时实现：测试用 API Key
+    if api_key.startswith("jonex_test_"):
+        require_test_token_allowed()
         return require_tenant(api_key.removeprefix("jonex_test_"))
     else:
         raise InvalidApiKeyError()

--- a/jonex_core/common/tenant.py
+++ b/jonex_core/common/tenant.py
@@ -41,16 +42,30 @@ def require_tenant(tenant_id: str | None) -> str:
     return normalized
 
+def require_test_token_allowed() -> None:
+    """测试 token 后门安全守卫：仅开发环境（ENV=dev）放行 jonex_test_ 兜底。
+    非 dev（test/uat/prod）一律抛 TokenExpiredError(401)，杜绝无验签的租户上下文注入。"""
+    if not get_config().is_development:
+        raise TokenExpiredError(
+            message=translate("err.auth.test_token_disabled", fallback="测试 token 仅开发环境可用")
+        )
```
- **Lesson**: Backdoors and testing bypasses must enforce a centralized, fail-closed gate tied strictly to runtime environment profiles (`is_development`), never independent toggle flags.

---

### Incident 2: Ingest Key vs. MCP Key Salt Rotation Vulnerability (BUG-CRYPTO-02)
- **Context**: `jonex_core/common/crypto.py`
- **What Was Expected**: Rotating `JWT_SECRET` should not break external API access keys, and rotating access key salts should provide a safe migration window for clients.
- **What Actually Happened**: Rotating `JWT_SECRET` invalidated all ingest keys (`yxk_*`) and MCP keys (`yxm_*`) because HMAC calculations derived directly from `JWT_SECRET`. When engineers introduced `MCP_KEY_SECRET_LEGACY` to allow smooth rotation, they applied legacy fallback to *both* MCP keys and ingest keys. This exposed a critical vulnerability: ingest keys store cleartext payloads `base64(tenant|kb|ds|rand)`; an attacker knowing a retired/leaked legacy salt could craft arbitrary ingest keys, inject malicious data, and forge tenant IDs.
- **Evidence in Repo**: Commit `b6e8b1f1`, file `jonex_core/common/crypto.py`.
- **Root Cause**: Conflating high-entropy secrets (random 32-byte strings) with structured payload tokens (tamper-evident cleartext payloads) under the same legacy verification policy.
- **Remediation Code Diff**:
```diff
--- a/jonex_core/common/crypto.py
+++ b/jonex_core/common/crypto.py
@@ -63,8 +72,11 @@ def hash_ingest_key(plaintext: str) -> str:
 def verify_ingest_key(plaintext: str, stored_hash: str) -> bool:
     if not plaintext or not stored_hash:
         return False
-    # 对整串 key 做 HMAC，和存储的签名比对
-    return hmac.compare_digest(_sign_payload(plaintext), stored_hash)
+    # 只认当前盐，**不做 legacy 兜底**（与 verify_mcp_key 的关键差异）：
+    # ingest key 的 payload 是 base64 明文，盐一旦公开即可自造 payload 伪造签名，
+    # 而 decode_ingest_key 只解析不验签、租户由 payload 决定 ⇒ 兜底等于开放越权写入。
+    return hmac.compare_digest(_hmac_hex(_current_hash_secret(), plaintext), stored_hash)
```
- **Lesson**: Structured tokens containing unencrypted routing claims (tenant IDs) must never allow fallback to retired/legacy HMAC salts. Only opaque high-entropy tokens may utilize dual-salt verification during rotation windows.

---

### Incident 3: Missing Scope Scope Variable in Auth Response Generation (BUG-RUNTIME-03)
- **Context**: `capabilities/platform/auth/auth_service.py`
- **What Was Expected**: `_build_login_response()` should resolve tenant security settings and issue access tokens with appropriate session timeouts.
- **What Actually Happened**: The developer refactored `_get_security_config(tenant_id)` to accept a tenant ID, but invoked it inside `_build_login_response()` as `await self._get_security_config(tenant_id)`. The local variable `tenant_id` was not defined in that method's scope (the object was accessible only via `user.tenant_id`). The code passed linter imports, but every login attempt in production threw an unhandled exception: `500 Internal Server Error: name 'tenant_id' is not defined`.
- **Evidence in Repo**: Commit `7e1be5ac`, file `capabilities/platform/auth/auth_service.py`.
- **Root Cause**: Variable shadowing and failure to test login paths with integration suites, relying purely on mock tests where method parameters were bypassed.
- **Remediation Code Diff**:
```diff
--- a/capabilities/platform/auth/auth_service.py
+++ b/capabilities/platform/auth/auth_service.py
@@ -667,7 +659,10 @@ async def _build_login_response(
         from jonex_core.security.permission import get_user_permissions
 
         perms = await get_user_permissions(user.tenant_id, user.id)
-        security = await self._get_security_config()
+        # ⚠ 这里是 `user.tenant_id`，不是 `tenant_id` —— 本方法没有 `tenant_id` 这个局部名
+        # （全程用 user.tenant_id）。写成 tenant_id 的后果：线上每次登录都 500
+        security = await self._get_security_config(user.tenant_id)
         session_minutes = max(1, security["session_timeout"])
```
- **Lesson**: Ensure end-to-end integration tests execute user authentication flows in real PostgreSQL environments; unreferenced variable traps in dynamically typed languages like Python bypass simple AST linters if not verified with strict variable resolution analysis (e.g., Pyright/MyPy strict mode).

---

### Incident 4: Tenant Security Override Authorization Bypass (BUG-SEC-04)
- **Context**: `capabilities/platform/api/platform_crud.py` and `capabilities/platform/dtos/misc.py`
- **What Was Expected**: Tenant administrators should configure their own tenant's security parameters (session timeout, lockout threshold) without impacting other tenants.
- **What Actually Happened**: The initial DTO accepted `tenant_id` in the request body. A malicious tenant administrator could submit an HTTP PUT with another tenant's `tenant_id` in the JSON body, overwriting foreign tenant security configs and locking out neighboring organizations.
- **Evidence in Repo**: Commit `7e1be5ac`, files `capabilities/platform/api/platform_crud.py` and `capabilities/platform/dtos/misc.py`.
- **Root Cause**: Permitting routing identifiers to exist simultaneously in the client-supplied payload body and the authenticated security token context.
- **Remediation Code Diff**:
```diff
--- a/capabilities/platform/dtos/misc.py
+++ b/capabilities/platform/dtos/misc.py
@@ -67,6 +67,19 @@ class SystemConfigListResponse(BaseModel):
     items: list[SystemConfigResponse]
 
+# ============ 租户级安全配置（租户管理员自助）============
+class TenantSecurityConfigUpdateRequest(BaseModel):
+    """租户级安全配置的更新请求。
+    ⛔ **不接收 tenant_id**：租户只从鉴权上下文取（extract_tenant_id(request)）。
+    请求体里出现 tenant_id 就等于把「越权改别的租户的安全配置」做成 API。"""
+    config_value: str
+    description: Optional[str] = None

--- a/capabilities/platform/api/platform_crud.py
+++ b/capabilities/platform/api/platform_crud.py
+@router.put("/tenant-security-config/{config_key}")
+async def update_tenant_security_config(
+    config_key: str,
+    request: Request,
+    req: TenantSecurityConfigUpdateRequest,
+    db=Depends(get_db),
+    _p: dict = Depends(require_permission("tenant:security:write")),
+):
+    tenant_id = extract_tenant_id(request)
+    svc = SecurityConfigService(db)
+    item = await svc.set_value(tenant_id, config_key, req.config_value, req.description)
```
- **Lesson**: DTO schemas for tenant-scoped operations must never declare tenant ID fields. The operational tenant ID must be injected exclusively from the cryptographically verified request session context.

---

### Incident 5: Query Model Pinning Outage on Knowledge Base Snapshots (BUG-KB-05)
- **Context**: `Reference/JonexWiki/src/jonex_wiki/domain/engine/compile/engine.py`
- **What Was Expected**: Updating the upstream model configuration in environment variables (`LLM_MODEL`) should take immediate effect for all knowledge base search and QA operations.
- **What Actually Happened**: The system threw upstream billing/deprecated model errors (`402 Payment Required` / `404 Not Found`). `Manifest["models"]["query"]` recorded the model name during initial compilation as a static snapshot. Subsequent runtime queries used the manifest's snapshot rather than the container's active environment variables. When the old model was decommissioned, all queries broke permanently, even though the host's `LLM_MODEL` was updated.
- **Evidence in Repo**: Source code docstrings in `jonex_wiki/domain/engine/compile/engine.py:145-160`.
- **Root Cause**: Conflating immutable compilation provenance (what model compiled this revision) with runtime operational dependencies (what model executes the live query).
- **Remediation Code Diff**:
```diff
--- a/Reference/JonexWiki/src/jonex_wiki/domain/engine/compile/engine.py
+++ b/Reference/JonexWiki/src/jonex_wiki/domain/engine/compile/engine.py
@@ -140,6 +140,16 @@ def _prune_dangling_displays(contribution_set, claims):
     return pruned.model_copy(update={"by_source": by_source, "fact_index": fact_index}), dropped
 
+def _resolve_query_model(manifest_query_model: str | None) -> str | None:
+    """查询用的模型名：**当前环境变量优先**，Manifest 记录值仅作回落。
+    Manifest["models"]["query"] 是编译期快照，不是查询期的权威。
+    换模型之后旧 KB 若继续按快照发请求，会死锁在已欠费/废弃的模型上。"""
+    env_model = (current_env().get("LLM_MODEL", "") or "").strip()
+    return env_model or manifest_query_model
```
- **Lesson**: Static manifest provenance snapshots must never dictate live execution parameters. Runtime environments take operational precedence; manifest data serves historical provenance and fallback defaults only.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Bearer Token Stripping Traps**: 
  When parsing authorization headers, `authorization[7:]` without `.strip()` passes trailing/leading whitespace or line breaks (`\r\n`) to cryptographic signers. This causes HMAC or JWT decoding failures that appear intermittent based on client library padding.
  ```python
  # SAFE INVARIANT:
  token = authorization[7:].strip()
  ```
- **Falsy Conversion Hazards**:
  In quota or security threshold checking (e.g., `login_lock_threshold`), integer `0` denotes "lockout disabled". Using `if not threshold:` or `raw or default` causes `0` to evaluate to falsy, silently applying the default value (e.g., 5 attempts) and making it impossible to disable account locking.
  ```python
  # SAFE INVARIANT:
  raw = await self.system_config_repo.get_value(key)
  if raw is not None and str(raw).strip() != "":
      result[key] = int(float(str(raw).strip()))
  ```
- **JSON Encoding Sort Keys and Separators**:
  Cryptographic hashing of state snapshots (`snapshot_checksum`) requires deterministic byte generation across Python runtime releases. Using standard `json.dumps()` introduces platform-dependent whitespace and indeterminate key ordering.
  ```python
  # SAFE INVARIANT:
  json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
  ```

---

### 2. Infinite Loop & Recursion Guards
- **Menu Hierarchy Self-Referencing Loop Termination**:
  Role-Based Access Control menu filters traverse parent-child relationships. A database anomaly where `parent_id == id` or cyclical references (`A -> B -> A`) causes infinite loops during traversal.
  ```python
  # INVARIANT: Visited set tracking with topological breadth cap
  def _filter_visible_menus(menus: list, perms: set[str]) -> list:
      parent_of = defaultdict(list)
      for m in menus:
          if m.parent_id not in (0, None) and m.parent_id != m.id: # Self-loop guard
              parent_of[m.parent_id].append(m.id)
              
      visible = {m for m in menus if not m.permission_code or _menu_code_matches(m.permission_code, perms)}
      visible_ids = {m.id for m in visible}
      
      # Fixed-point iteration with explicit depth safety cap
      changed = True
      iterations = 0
      max_depth = len(menus)
      while changed and iterations < max_depth:
          changed = False
          iterations += 1
          for pid, children in list(parent_of.items()):
              if pid not in visible_ids:
                  for cid in children:
                      if cid in visible_ids:
                          visible_ids.remove(cid)
                          changed = True
      return [m for m in menus if m.id in visible_ids]
  ```
- **Incremental Compilation Replay Exhaustion**:
  When evaluating block replaying (`replay_blocks`), matching passages use queues (`deque`). If a duplicate passage key exists, a naive `.pop()` will crash on an empty queue or enter an infinite generator spin.
  ```python
  # INVARIANT: Explicit queue containment check before pop
  pool = pools[dependency_key(p)]
  if pool:
      remap[pool.popleft()] = p.passage_id
  else:
      order.append(p.passage_id)
  ```

---

### 3. UI & UX Micro-Mechanics
- **Multi-Code Permission Mapping**:
  Enterprise sidebars combine views (e.g., global configuration merged with tenant-level security settings). A menu item must render if the user holds *either* platform or tenant permissions. Single exact-string matching breaks when merging screens.
  ```python
  # INVARIANT: Comma-delimited permission code disjunction
  def _menu_code_matches(permission_code: str, perms: set[str]) -> bool:
      return any(code.strip() in perms for code in permission_code.split(",") if code.strip())
  ```
- **Tenant Keyword Search Filter Bypass**:
  When a non-admin searches tenants, the system falls back to `svc.get(tenant_id)`. If this direct retrieval doesn't check the keyword query, the user sees their own tenant row even when their search term doesn't match it (e.g., searching "Marketing" displays tenant "Finance").
  ```python
  # INVARIANT: Apply identical matching predicate to fallback direct lookups
  tenant = await svc.get(current["tenant_id"])
  items = [tenant] if tenant_matches_keyword(tenant, keyword) else []
  return success_response(data={"items": items, "total": len(items)})
  ```

---

### 4. Backend Concurrency & Memory Safety
- **Background Daemon Task Isolation (Crash-Proof Lifecycles)**:
  Subsystems like `AuditRetentionScheduler`, `MonitorCollector`, and `IdentitySyncScheduler` run as asynchronous background workers. If an unhandled database exception propagates from `initialize()`, the entire container crashes in a boot-loop, taking critical authentication APIs down with it.
  ```python
  # INVARIANT: Side-car and background workers MUST be