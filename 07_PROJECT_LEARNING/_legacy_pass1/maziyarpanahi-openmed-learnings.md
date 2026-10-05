# Forensic Learning Record (Deep Inspection): maziyarpanahi/openmed

> **Canonical Artifact**: `07_PROJECT_LEARNING/maziyarpanahi-openmed-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/maziyarpanahi/openmed](https://github.com/maziyarpanahi/openmed))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-01T00:13:50.889Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `maziyarpanahi/openmed`
- **Description**: Local-first healthcare AI: clinical NER & HIPAA PII de-identification that runs 100% on-device. 2,200+ medical models, 21 languages, Apple MLX + Python, no cloud, no patient data leaving your network. Apache-2.0
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 5441 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `clients/go/client.go`
```
// Package openmed provides a dependency-light Go client for the OpenMed REST
// service. It is built on the standard library net/http package and tracks the
// operations and request schemas published in the committed OpenAPI spec
// (docs/api/openapi.json), with typed representations for stable responses.
//
// The client keeps enums (deidentification method, PII language, aggregation
// strategy) as typed string constants so callers get compile-time help, and it
// surfaces non-2xx responses as a typed *APIError carrying the service error
// envelope. Every request method takes a context.Context for cancellation and
// deadlines.
package openmed

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"mime"
	"net"
	"net/http"
	"net/url"
	"strings"
)

// DefaultBaseURL is the base URL assumed when none is provided.
const DefaultBaseURL = "http://localhost:8080"

// DefaultMaxResponseBodyBytes bounds buffered JSON responses. Streaming
// responses are read incrementally and are not subject to this total limit.
const DefaultMaxResponseBodyBytes int64 = 64 << 20

// DefaultMaxStreamEventBytes bounds one NDJSON event returned by a streaming
// PII endpoint. The total stream remains unbounded and is consumed
// incrementally.
const DefaultMaxStreamEventBytes = 4 << 20

const maxErrorBodyBytes int64 = 1 << 20

// ErrResponseTooLarge is returned when a buffered success response exceeds the
// configured response-body limit.
var ErrResponseTooLarge = errors.New("openmed: response body exceeds configured limit")

// Path templates for the endpoints that take a path parameter. The {job_id}
// placeholder mirrors the OpenAPI path exactly and is substituted with the
// URL-escaped job identifier at call time.
const (
	pathGetJob                       = "/jobs/{job_id}"
	pathSMARTBackendIngestionStatus  = "/fhir/smart-backend/ingestions/{job_id}"
	pathSMARTBackendIngestionSummary = "/fhir/smart-backend/ingestions/{job_id}/summary"
)

// AggregationStrategy selects how token-level predictions are grouped by the
// /analyze endpoint.
type AggregationStrategy string

// Aggregation strategies accepted by /analyze.
const (
	AggregationSimple  AggregationStrategy = "simple"
	AggregationFirst   AggregationStrategy = "first"
	AggregationAverage AggregationStrategy = "average"
	AggregationMax     AggregationStrategy = "max"
)

// PIILanguage is one of the languages supported by the PII endpoints.
type PIILanguage string

// Languages supported by the PII endpoints.
const (
	LangAM PIILanguage = "am"
	LangAS PIILanguage = "as"
	LangBN PIILanguage = "bn"
	LangEN PIILanguage = "en"
	LangFR PIILanguage = "fr"
	LangDE PIILanguage = "de"
	LangIT PIILanguage = "it"
	LangES PIILanguage = "es"
	LangNL PIILanguage = "nl"
	LangHI PIILanguage = "hi"
	LangGU PIILanguage = "gu"
	LangKN PIILanguage = "kn"
	LangML PIILanguage = "ml"
	LangMR PIILanguage = "mr"
	LangNE PIILanguage = "ne"
	LangOR PIILanguage = "or"
	LangPL PIILanguage = "pl"
	LangPA PIILanguage = "pa"
	LangTA PIILanguage = "ta"
	LangTE PIILanguage = "te"
	LangUR PIILanguage = "ur"
	LangPT PIILanguage = "pt"
	LangAR PIILanguage = "ar"
	LangFA PIILanguage = "fa"
	LangHE PIILanguage = "he"
	LangJA PIILanguage = "ja"
	LangTR PIILanguage = "tr"
	LangID PIILanguage = "id"
	LangTH PIILanguage = "th"
	LangKO PIILanguage = "ko"
	LangRO PIILanguage = "ro"
	LangRU PIILanguage = "ru"
	LangSV PIILanguage = "sv"
	LangDA PIILanguage = "da"
	LangNO PIILanguage = "no"
	LangSW PIILanguage = "sw"
	LangZU PIILanguage = "zu"
	LangXH PIILanguage = "xh"
	LangZH PIILanguage = "zh"
	LangUK PIILanguage = "uk"
	LangCS PIILanguage = "cs"
	LangEL PIILanguage = "el"
	LangVI PIILanguage = "vi"
)

// DeidentificationMethod selects how detected PII spans are transformed by the
// /pii/deidentify endpoint and de-identification jobs.
type DeidentificationMethod string

// De-identification methods accepted by /pii/deidentify.
const (
	MethodMask       DeidentificationMethod = "mask"
	MethodRemove     DeidentificationMethod = "remove"
	MethodReplace    DeidentificationMethod = "replace"
	MethodHash       DeidentificationMethod = "hash"
	MethodShiftDates DeidentificationMethod = "shift_dates"
)

// PrivacyPolicy names a redaction policy for /pii/deidentify and
// /privacy-gateway/complete.
type PrivacyPolicy string

// Built-in privacy policies. Callers may also pass any custom policy name the
// service recognizes.
const (
	PolicyStrict   PrivacyPolicy = "strict"
	PolicyBalanced PrivacyPolicy = "balanced"
	PolicyMinimal  PrivacyPolicy = "minimal"
)

// DecisionMode selects one bounded fixed-output decision shape.
type DecisionMode string

// Decision modes accepted by POST /v1/decisions.
const (
	DecisionFixedChoice       DecisionMode = "fixed_choice"
	DecisionBooleanChoice     DecisionMode = "boolean_choice"
	DecisionOrderedPreference DecisionMode = "ordered_preference"
	DecisionScalarScore       DecisionMode = "scalar_score"
	DecisionMultiLabel        DecisionMode = "multi_label"
)

// DecisionState reports whether a decision succeeded or stopped safely.
type DecisionState string

const (
	DecisionSuccess     DecisionState = "success"
	DecisionAbstained   DecisionState = "abstained"
	DecisionPartial     DecisionState = "partial"
	DecisionUnknown     DecisionState = "unknown"
	DecisionConflict    DecisionState = "conflict"
	DecisionUnsupported DecisionState = "unsupported"
	DecisionDenied      DecisionState = "denied"
	DecisionFailure     DecisionState = "failure"
)

// JourneyResourceType selects a versioned Journey resource family.
type JourneyResourceType string

// Journey resource families supported by the versioned read contract.
const (
	JourneyArtifact        JourneyResourceType = "artifact"
	JourneyJob             JourneyResourceType = "job"
	JourneyFact            JourneyResourceType = "fact"
	JourneyConflict        JourneyResourceType = "conflict"
	Journey                JourneyResourceType = "journey"
	JourneyCohort          JourneyResourceType = "cohort"
	JourneyDataset         JourneyResourceType = "dataset"
	JourneyRegistry        JourneyResourceType = "registry"
	JourneyMeasure         JourneyResourceType = "measure"
	JourneyTrialReview     JourneyResourceType = "trial_review"
	JourneyEvidence        JourneyResourceType = "evidence"
	JourneyCurrentFact     JourneyResourceType = "current_fact"
	JourneyEvent           JourneyResourceType = "journey_event"
	JourneyMapping         JourneyResourceType = "mapping"
	JourneyCohortRun       JourneyResourceType = "cohort_run"
	JourneyDatasetManifest JourneyResourceType = "dataset_manifest"
)

// JobStatus enumerates the lifecycle states of a de-identification job.
type JobStatus string

// De-identification job statuses.
const (
	JobQueued  JobStatus = "queued"
	JobRunning JobStatus = "running"
	JobDone    JobStatus = "done"
	JobFailed  JobStatus = "failed"
)

// JSONObject is an untyped JSON object, used for open-ended metadata fields.
type JSONObject = map[string]any

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

// AnalyzeRequest is the request body for POST /analyze.
type AnalyzeRequest struct {
	Text                string               `json:"text"`
	ModelName           string               `json:"model_name,omitempty"`
	ConfidenceThreshold *float64             `json:"confidence_threshold,omitempty"`
	GroupEntities       bool                 `json:"group_entities,omitempty"`
	AggregationStrategy *AggregationStrategy `json:"aggregation_strategy,omitempty"`
	SentenceDetection   *bool                `json:"sentence_detection,omitempty"`
	SentenceLanguage    string               `json:"sentence_language,omitempty"`
	SentenceClean       bool                 `json:"sentence_clean,omitempty"`
	UseFastTokenizer    *bool                `json:"use_fast_tokenizer,omitempty"`
	KeepAlive           any                  `json:"keep_alive,omitempty"
```

### Core Architecture Module: `clients/typescript/src/index.ts`
```
import {
  JOURNEY_WORKFLOW_RESOURCE_TYPES,
  type JourneyResourcePage,
  type JourneyResourceQuery,
  type JourneyResourceState,
  type JourneyResourceType,
  type JourneyWorkflowName,
  type JourneyWorkflowQuery,
} from "./journey-workflows.generated.js";

export {
  JOURNEY_WORKFLOW_RESOURCE_TYPES,
  type JourneyResourcePage,
  type JourneyResourceQuery,
  type JourneyResourceState,
  type JourneyResourceType,
  type JourneyWorkflowName,
  type JourneyWorkflowQuery,
} from "./journey-workflows.generated.js";

export type JsonObject = Record<string, unknown>;

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export type KeepAliveValue = number | string;

export type AggregationStrategy = "simple" | "first" | "average" | "max";

export type PIILanguage =
  | "am"
  | "as"
  | "bn"
  | "en"
  | "fr"
  | "de"
  | "it"
  | "es"
  | "nl"
  | "hi"
  | "gu"
  | "kn"
  | "ml"
  | "mr"
  | "ne"
  | "or"
  | "pl"
  | "pa"
  | "ta"
  | "te"
  | "ur"
  | "pt"
  | "ar"
  | "fa"
  | "he"
  | "ja"
  | "tr"
  | "id"
  | "th"
  | "ko"
  | "ro"
  | "ru"
  | "sv"
  | "da"
  | "no"
  | "sw"
  | "zu"
  | "xh"
  | "zh"
  | "uk"
  | "ur"
  | "cs"
  | "el"
  | "vi";

export type DeidentificationMethod =
  | "mask"
  | "remove"
  | "replace"
  | "hash"
  | "shift_dates";

export interface OpenMedClientOptions {
  baseUrl: string;
  fetch?: FetchLike;
}

export interface AnalyzeRequest {
  text: string;
  model_name?: string;
  confidence_threshold?: number | null;
  group_entities?: boolean;
  aggregation_strategy?: AggregationStrategy | null;
  sentence_detection?: boolean;
  sentence_language?: string;
  sentence_clean?: boolean;
  use_fast_tokenizer?: boolean;
  keep_alive?: KeepAliveValue | null;
}

export interface GroundRequest {
  entities?: JsonObject[] | null;
  offline?: boolean;
  source_language?: string;
  systems?: string[];
  text?: string | null;
  top_k?: number;
}

export interface PIIExtractRequest {
  text: string;
  model_name?: string;
  confidence_threshold?: number;
  use_smart_merging?: boolean;
  lang?: PIILanguage;
  normalize_accents?: boolean | null;
  keep_alive?: KeepAliveValue | null;
}

export interface PIIExtractStreamRequest extends PIIExtractRequest {
  chunk_size?: number;
  window_chars?: number;
  tokenizer_context_chars?: number;
  max_entity_chars?: number;
  include_text?: boolean;
}

export interface PIIDeidentifyRequest {
  text: string;
  method?: DeidentificationMethod;
  model_name?: string;
  confidence_threshold?: number;
  keep_year?: boolean;
  shift_dates?: boolean | null;
  date_shift_days?: number | null;
  keep_mapping?: boolean;
  policy?: string | null;
  use_smart_merging?: boolean;
  use_safety_sweep?: boolean;
  lang?: PIILanguage;
  normalize_accents?: boolean | null;
  keep_alive?: KeepAliveValue | null;
}

export interface PIIDeidentifyStreamRequest extends PIIDeidentifyRequest {
  chunk_size?: number;
}

export interface PrivacyGatewayRequest {
  text: string;
  model_name?: string;
  confidence_threshold?: number;
  detector_confidence_floor?: number;
  policy?: string;
  disallowed_entity_categories?: string[];
  use_smart_merging?: boolean;
  lang?: PIILanguage;
  normalize_accents?: boolean | null;
  keep_alive?: KeepAliveValue | null;
}

export type DecisionMode =
  | "fixed_choice"
  | "boolean_choice"
  | "ordered_preference"
  | "scalar_score"
  | "multi_label";

export type DecisionState =
  | "success"
  | "abstained"
  | "partial"
  | "unknown"
  | "conflict"
  | "unsupported"
  | "denied"
  | "failure";

export interface FixedOptionDecisionRequest {
  mode: DecisionMode;
  input_text: string;
  options?: string[];
  namespace?: string;
  purpose?: string;
  calibration_id?: string;
  timeout_ms?: number;
  schema_version?: "1.0.0";
  compatibility_policy?: "same_major";
}

export interface DecisionOptionScore {
  index: number;
  option: string;
  score: number;
}

export interface FixedOptionDecisionResult {
  mode: DecisionMode;
  state: DecisionState;
  code: string | null;
  option_scores: DecisionOptionScore[];
  choice: string | null;
  choices: string[];
  ranking: string[];
  scalar_score: number | null;
  confidence: number | null;
  margin: number | null;
  calibration: JsonObject;
  backend: JsonObject;
  access: JsonObject;
  warnings: string[];
  review: { required: true; reasons: string[] };
  advisory: string;
  autonomous_action: false;
  schema_version: "1.0.0";
  compatibility_policy: "same_major";
  extensions: JsonObject;
}

export interface DeidentifyJobDocument {
  text: string;
  id?: string | null;
}

export interface JobWebhookRequest {
  url: string;
  secret: string;
  max_attempts?: number;
  backoff_seconds?: number;
}

export interface DeidentifyJobRequest {
  documents: DeidentifyJobDocument[];
  webhook?: JobWebhookRequest | null;
  method?: DeidentificationMethod;
  model_name?: string;
  confidence_threshold?: number;
  keep_year?: boolean;
  shift_dates?: boolean | null;
  date_shift_days?: number | null;
  keep_mapping?: boolean;
  policy?: string | null;
  use_smart_merging?: boolean;
  use_safety_sweep?: boolean;
  lang?: PIILanguage;
  normalize_accents?: boolean | null;
  keep_alive?: KeepAliveValue | null;
}

export interface ModelUnloadRequest {
  model_name?: string | null;
  all?: boolean;
}

export interface SMARTBackendIngestionRequest {
  fhir_base_url: string;
  token_url: string;
  client_id: string;
  private_key_pem: string;
  output_dir: string;
  checkpoint_path?: string | null;
  key_id?: string | null;
  scope?: string;
  export_path?: string;
  max_inflight_downloads?: number;
  poll_interval_seconds?: number;
  request_timeout_seconds?: number;
  policy?: string | null;
  method?: DeidentificationMethod;
  model_name?: string;
  confidence_threshold?: number;
  use_smart_merging?: boolean;
  use_safety_sweep?: boolean;
  lang?: PIILanguage;
  normalize_accents?: boolean | null;
  keep_alive?: KeepAliveValue | null;
}

export interface OMOPLoadRequest {
  records_jsonl: string;
  vocabulary_version?: string | null;
  validate_constraints?: boolean;
  completeness_floor?: number | null;
  required_fields?: string[];
}

export interface OMOPRejectedSpan {
  reason: string;
  source_note_hash: string;
  start: number | null;
  end: number | null;
  domain: string | null;
}

export interface OMOPConstraintViolations {
  count: number;
  by_reason: Record<string, number>;
}

export interface OMOPLoadResponse {
  row_counts: Record<string, number>;
  rejection_counts: Record<string, number>;
  rejected_spans: OMOPRejectedSpan[];
  source_note_hashes: string[];
  constraint_violations?: OMOPConstraintViolations;
}

export interface ConceptAncestorRequest {
  ancestor_concept_id: number;
  descendant_concept_id: number;
}

export interface CohortResolveRequest {
  phenotype: JsonObject;
  records_jsonl: string;
  concept_ancestors?: ConceptAncestorRequest[];
  completeness_floor?: number | null;
  required_fields?: string[];
}

export interface ProfileRequest {
  records_jsonl: string;
  completeness_floor?: number;
  required_fields?: string[];
  athena_index?: JsonObject | null;
}

export type ProfileResponse = JsonObject;

export interface CohortEvidencePointer {
  criterion_id: string;
  concept_set_id: string;
  concept_id: number;
  vocabulary: string;
  domain_table: string;
  event_id: number;
  note_id: number;
  note_nlp_id: number;
  source_note_hash: string;
  start: number;
  end: number;
}

export interface CohortResolveResponse {
  schema_version: string;
  advisory: string;
  patient_ids: number[];
  evidence: Array<{
    patient_id: number;
    matches: CohortEvidencePointer[];
  }>;
  provenance: JsonObject;
}

export interface EntityPrediction {
  text: string;
  label: string;
  confidence: number;
  start: number | null;
  end: number | null;
  metadata: JsonObject;
}

export interface PredictionResult {
  text: string;
  entities: EntityPrediction[];
  model_name: string;
  timestamp: st
```

### Core Architecture Module: `clients/typescript/src/journey-workflows.generated.ts`
```
// Generated from the canonical Journey workflow registry. Do not edit.

export type JourneyResourceType =
  | "artifact"
  | "job"
  | "fact"
  | "conflict"
  | "journey"
  | "cohort"
  | "dataset"
  | "registry"
  | "measure"
  | "trial_review"
  | "evidence"
  | "current_fact"
  | "journey_event"
  | "mapping"
  | "cohort_run"
  | "dataset_manifest";

export type JourneyResourceState =
  | "success"
  | "partial"
  | "empty"
  | "unknown"
  | "conflict"
  | "unsupported"
  | "denied"
  | "failure";

export type JourneyWorkflowName =
  | "journey"
  | "cohort"
  | "dataset"
  | "registry"
  | "measure"
  | "trial_review";

export interface JourneyResourceQuery {
  resource_type: JourneyResourceType;
  namespace?: string;
  purpose?: string;
  role?: string;
  attributes?: string[];
  consent_state?: "active" | "unknown" | "withdrawn";
  export_policy?: string;
  first?: number;
  after?: string | null;
  fields?: string[];
}

export type JourneyWorkflowQuery = Omit<JourneyResourceQuery, "resource_type">;

export interface JourneyResourcePage {
  state: JourneyResourceState;
  code: string | null;
  resources: Array<{
    resource_type: JourneyResourceType;
    resource_id: string;
    namespace: string;
    data: Record<string, unknown>;
    state: JourneyResourceState;
    version: number;
    revision: number;
    schema_version: string;
    compatibility_policy: "same_major";
    extensions: Record<string, unknown>;
  }>;
  page_info: {
    has_next_page: boolean;
    end_cursor: string | null;
    page_size: number;
    snapshot_digest: string;
  };
  policy: {
    state: "success" | "denied";
    namespace: string;
    purpose: string;
    role: string;
    attributes: string[];
    consent_state: "active" | "unknown" | "withdrawn";
    export_policy: string;
    decision_id: string;
    request_digest: string;
    allowed_fields: string[];
    code: string | null;
    policy_version: string;
  };
  schema_version: string;
  compatibility_policy: "same_major";
}

export const JOURNEY_WORKFLOW_RESOURCE_TYPES = {
  journey: "journey",
  cohort: "cohort",
  dataset: "dataset",
  registry: "registry",
  measure: "measure",
  trial_review: "trial_review",
} as const satisfies Record<JourneyWorkflowName, JourneyResourceType>;

```

### Core Architecture Module: `deploy/operator/__init__.py`
```
"""Deployment assets for the OpenMed Kubernetes operator."""

```

### Core Architecture Module: `deploy/operator/openmed_operator.py`
```
"""Kopf operator for declarative OpenMed model lifecycle management.

The reconciliation core is deliberately independent from Kopf so it can be
exercised against a synthetic Kubernetes API server without a live cluster.
The production handlers registered at the bottom of this module adapt Kopf
events to the same deterministic reconciliation function.
"""

from __future__ import annotations

import asyncio
import copy
import hashlib
import json
import os
import re
import ssl
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Mapping, MutableMapping, Sequence
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen

try:
    import kopf
except ModuleNotFoundError as exc:  # pragma: no cover - exercised without extra
    if exc.name != "kopf":
        raise
    kopf = None  # type: ignore[assignment]


API_GROUP = "openmed.ai"
API_VERSION = "v1alpha1"
API_PLURAL = "openmedmodels"
API_KIND = "OpenMedModel"

MANIFEST_DATA_KEY = "manifest.json"
PRELOAD_DATA_KEY = "OPENMED_SERVICE_PRELOAD_MODELS"
PRELOAD_ENV_NAME = PRELOAD_DATA_KEY
MANIFEST_HASH_ANNOTATION = "openmed.ai/model-manifest-hash"
MODEL_RESOURCE_ANNOTATION = "openmed.ai/model-resource"
ROLLBACK_ANNOTATION = "openmed.ai/rollback-to"

DEFAULT_CONTAINER_NAME = "openmed-service"
DEFAULT_PROGRESS_DEADLINE_SECONDS = 600
DEFAULT_MAX_UNAVAILABLE: int | str = 0
DEFAULT_MAX_SURGE: int | str = 1

ALLOWED_TIERS = frozenset(
    {"Tiny", "Small", "Medium", "Base", "Large", "XLarge", "Accurate-XLarge"}
)
PHASE_PENDING = "Pending"
PHASE_ROLLING_OUT = "RollingOut"
PHASE_READY = "Ready"
PHASE_FAILED = "Failed"
PHASE_ROLLED_BACK = "RolledBack"

_FAMILY_RE = re.compile(r"^[A-Za-z](?:[A-Za-z0-9._-]{0,61}[A-Za-z0-9])?$")
_VERSION_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:@/+~-]{0,252}$")
_DNS_LABEL_RE = re.compile(r"^[a-z0-9](?:[-a-z0-9]{0,61}[a-z0-9])?$")
_DNS_SUBDOMAIN_RE = re.compile(
    r"^[a-z0-9](?:[-a-z0-9]{0,61}[a-z0-9])?"
    r"(?:\.[a-z0-9](?:[-a-z0-9]{0,61}[a-z0-9])?)*$"
)
_PERCENT_RE = re.compile(r"^(?:0|[1-9][0-9]{0,2})%$")

Clock = Callable[[], datetime]


class SpecValidationError(ValueError):
    """Raised when a resource bypasses or violates CRD validation."""


class KubernetesAPIError(RuntimeError):
    """A sanitized Kubernetes API failure safe for operator status/logs."""

    def __init__(self, operation: str, status_code: int | None = None) -> None:
        self.operation = operation
        self.status_code = status_code
        suffix = "" if status_code is None else f" (HTTP {status_code})"
        super().__init__(f"Kubernetes API request failed: {operation}{suffix}")


@dataclass(frozen=True)
class DesiredModel:
    """Normalized desired state for one ``OpenMedModel`` resource."""

    family: str
    version: str
    tier: str
    replicas: int
    rollout_type: str
    max_unavailable: int | str
    max_surge: int | str
    rollback_on_failure: bool
    progress_deadline_seconds: int
    deployment_name: str
    container_name: str
    manifest_config_map_name: str

    @classmethod
    def from_resource(cls, body: Mapping[str, Any]) -> "DesiredModel":
        """Validate and normalize a Kubernetes custom-resource body."""

        metadata = _mapping(body.get("metadata"), field="metadata")
        spec = _mapping(body.get("spec"), field="spec")
        resource_name = _required_string(metadata, "name", field="metadata.name")

        family = _required_string(spec, "family", field="spec.family")
        if _FAMILY_RE.fullmatch(family) is None:
            raise SpecValidationError(
                "spec.family must start with a letter, end with a letter or digit, "
                "and contain only letters, digits, '.', '_' or '-'"
            )

        version = _required_string(spec, "version", field="spec.version")
        if _VERSION_RE.fullmatch(version) is None:
            raise SpecValidationError(
                "spec.version must be a non-empty local path or model pointer "
                "without whitespace"
            )

        tier = _required_string(spec, "tier", field="spec.tier")
        if tier not in ALLOWED_TIERS:
            raise SpecValidationError(
                f"spec.tier must be one of {', '.join(sorted(ALLOWED_TIERS))}"
            )

        replicas = _required_int(spec, "replicas", field="spec.replicas")
        if replicas < 1 or replicas > 1000:
            raise SpecValidationError("spec.replicas must be between 1 and 1000")

        strategy = _mapping(spec.get("rolloutStrategy"), field="spec.rolloutStrategy")
        rollout_type = _required_string(
            strategy, "type", field="spec.rolloutStrategy.type"
        )
        if rollout_type not in {"RollingUpdate", "Recreate"}:
            raise SpecValidationError(
                "spec.rolloutStrategy.type must be RollingUpdate or Recreate"
            )
        max_unavailable = _int_or_percent(
            strategy.get("maxUnavailable", DEFAULT_MAX_UNAVAILABLE),
            field="spec.rolloutStrategy.maxUnavailable",
        )
        max_surge = _int_or_percent(
            strategy.get("maxSurge", DEFAULT_MAX_SURGE),
            field="spec.rolloutStrategy.maxSurge",
        )
        if (
            rollout_type == "RollingUpdate"
            and _is_zero(max_unavailable)
            and _is_zero(max_surge)
        ):
            raise SpecValidationError(
                "RollingUpdate cannot set both maxUnavailable and maxSurge to zero"
            )
        rollback_on_failure = strategy.get("rollbackOnFailure", True)
        if not isinstance(rollback_on_failure, bool):
            raise SpecValidationError(
                "spec.rolloutStrategy.rollbackOnFailure must be a boolean"
            )
        deadline = strategy.get(
            "progressDeadlineSeconds", DEFAULT_PROGRESS_DEADLINE_SECONDS
        )
        if isinstance(deadline, bool) or not isinstance(deadline, int) or deadline < 1:
            raise SpecValidationError(
                "spec.rolloutStrategy.progressDeadlineSeconds must be a positive "
                "integer"
            )

        target_ref = spec.get("targetRef", {})
        target = _mapping(target_ref, field="spec.targetRef")
        deployment_name = str(target.get("name") or resource_name)
        container_name = str(target.get("containerName") or DEFAULT_CONTAINER_NAME)
        config_map_name = str(
            spec.get("manifestConfigMapName")
            or _name_with_suffix(resource_name, "model-manifest")
        )
        for value, field_name in (
            (deployment_name, "spec.targetRef.name"),
            (config_map_name, "spec.manifestConfigMapName"),
        ):
            _validate_dns_subdomain(value, field=field_name)
        _validate_dns_label(container_name, field="spec.targetRef.containerName")

        return cls(
            family=family,
            version=version,
            tier=tier,
            replicas=replicas,
            rollout_type=rollout_type,
            max_unavailable=max_unavailable,
            max_surge=max_surge,
            rollback_on_failure=rollback_on_failure,
            progress_deadline_seconds=deadline,
            deployment_name=deployment_name,
            container_name=container_name,
            manifest_config_map_name=config_map_name,
        )

    @classmethod
    def from_status(cls, value: Mapping[str, Any]) -> "DesiredModel":
        """Restore a previously successful desired state from CR status."""

        rollout = _mapping(value.get("rolloutStrategy"), field="status rollout")
        target = _mapping(value.get("targetRef"), field="status targetRef")
        return cls(
            family=_required_string(value, "family", field="status family"),
            version=_required_string(value, "version", field="status version"),
            tier=_required_string(value, "tier", field="status tier"),
            r
```

### Core Architecture Module: `eval/suites/multilingual_grounding.py`
```
"""Synthetic offline Acc@5 evaluation for multilingual grounding."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any

from openmed.clinical.grounding import (
    MultilingualGroundingResult,
    ground_multilingual,
)

MULTILINGUAL_GROUNDING_TOP5_FLOOR = 0.80
SYNTHETIC_MULTILINGUAL_GROUNDING_PROVENANCE = "synthetic-cc0"


@dataclass(frozen=True)
class MultilingualGroundingCase:
    """One synthetic source-language mention and international-code gold."""

    case_id: str
    mention: str
    locale: str
    expected_system: str
    expected_code: str
    provenance: str = SYNTHETIC_MULTILINGUAL_GROUNDING_PROVENANCE


@dataclass(frozen=True)
class MultilingualGroundingReport:
    """Per-language top-5 accuracy with aggregate gate status."""

    per_language_acc_at_5: dict[str, float]
    per_language_hits: dict[str, int]
    per_language_total: dict[str, int]
    overall_acc_at_5: float
    floor: float
    synthetic_provenance: bool
    passed: bool

    def to_dict(self) -> dict[str, Any]:
        """Return a raw-text-free, JSON-serializable report."""

        return {
            "per_language_acc_at_5": dict(self.per_language_acc_at_5),
            "per_language_hits": dict(self.per_language_hits),
            "per_language_total": dict(self.per_language_total),
            "overall_acc_at_5": self.overall_acc_at_5,
            "floor": self.floor,
            "synthetic_provenance": self.synthetic_provenance,
            "passed": self.passed,
        }


SYNTHETIC_MULTILINGUAL_GROUNDING_GOLD: tuple[MultilingualGroundingCase, ...] = (
    MultilingualGroundingCase(
        "zh-icd-diabetes", "2型糖尿病", "zh-CN", "ICD10", "E11.9"
    ),
    MultilingualGroundingCase(
        "zh-icd-hypertension", "原发性高血压", "zh-CN", "ICD10", "I10"
    ),
    MultilingualGroundingCase("zh-icd-pneumonia", "肺炎", "zh-CN", "ICD10", "J18.9"),
    MultilingualGroundingCase("zh-hpo-fever", "发热", "zh-CN", "HPO", "HP:0001945"),
    MultilingualGroundingCase("zh-hpo-headache", "头痛", "zh-CN", "HPO", "HP:0002315"),
    MultilingualGroundingCase("hi-hpo-fever", "बुखार", "hi-IN", "HPO", "HP:0001945"),
    MultilingualGroundingCase(
        "hi-hpo-headache", "सिरदर्द", "hi-IN", "HPO", "HP:0002315"
    ),
    MultilingualGroundingCase(
        "hi-hpo-weakness", "मांसपेशियों में कमजोरी", "hi-IN", "HPO", "HP:0001324"
    ),
    MultilingualGroundingCase("bn-hpo-fever", "জ্বর", "bn-IN", "HPO", "HP:0001945"),
    MultilingualGroundingCase("bn-hpo-headache", "মাথাব্যথা", "bn-IN", "HPO", "HP:0002315"),
    MultilingualGroundingCase(
        "bn-hpo-weakness", "পেশী দুর্বলতা", "bn-IN", "HPO", "HP:0001324"
    ),
    MultilingualGroundingCase("ta-hpo-fever", "காய்ச்சல்", "ta-IN", "HPO", "HP:0001945"),
    MultilingualGroundingCase(
        "ta-hpo-headache", "தலைவலி", "ta-IN", "HPO", "HP:0002315"
    ),
    MultilingualGroundingCase(
        "ta-hpo-weakness", "தசை பலவீனம்", "ta-IN", "HPO", "HP:0001324"
    ),
    MultilingualGroundingCase("te-hpo-fever", "జ్వరం", "te-IN", "HPO", "HP:0001945"),
    MultilingualGroundingCase("te-hpo-headache", "తలనొప్పి", "te-IN", "HPO", "HP:0002315"),
    MultilingualGroundingCase(
        "te-hpo-weakness", "కండరాల బలహీనత", "te-IN", "HPO", "HP:0001324"
    ),
)

Grounder = Callable[[str, str], MultilingualGroundingResult]


def run_multilingual_grounding_eval(
    *,
    cases: Sequence[MultilingualGroundingCase] = SYNTHETIC_MULTILINGUAL_GROUNDING_GOLD,
    grounder: Grounder = ground_multilingual,
    floor: float = MULTILINGUAL_GROUNDING_TOP5_FLOOR,
) -> MultilingualGroundingReport:
    """Measure top-5 international-code accuracy for every source language."""

    if not cases:
        raise ValueError("multilingual grounding evaluation requires gold cases")
    if not 0.0 <= floor <= 1.0:
        raise ValueError("floor must be between 0.0 and 1.0")

    hits: dict[str, int] = defaultdict(int)
    totals: dict[str, int] = defaultdict(int)
    for case in cases:
        result = grounder(case.mention, case.locale)
        language = result.source_language
        totals[language] += 1
        ranked = {
            (candidate.system, candidate.code) for candidate in result.candidates[:5]
        }
        if (case.expected_system, case.expected_code) in ranked:
            hits[language] += 1

    languages = sorted(totals)
    per_language = {
        language: hits[language] / totals[language] for language in languages
    }
    total = sum(totals.values())
    total_hits = sum(hits.values())
    synthetic = all(
        case.provenance == SYNTHETIC_MULTILINGUAL_GROUNDING_PROVENANCE for case in cases
    )
    passed = synthetic and all(score >= floor for score in per_language.values())
    return MultilingualGroundingReport(
        per_language_acc_at_5=per_language,
        per_language_hits={language: hits[language] for language in languages},
        per_language_total={language: totals[language] for language in languages},
        overall_acc_at_5=total_hits / total,
        floor=floor,
        synthetic_provenance=synthetic,
        passed=passed,
    )


__all__ = [
    "MULTILINGUAL_GROUNDING_TOP5_FLOOR",
    "MultilingualGroundingCase",
    "MultilingualGroundingReport",
    "SYNTHETIC_MULTILINGUAL_GROUNDING_GOLD",
    "SYNTHETIC_MULTILINGUAL_GROUNDING_PROVENANCE",
    "run_multilingual_grounding_eval",
]

```

### Core Architecture Module: `eval/suites/negation_grounding_traps.py`
```
"""Curated negation / experiencer grounding trap suite (release gate).

Every case here is a synthetic clinical sentence whose surface concept *matches*
a real code but whose assertion means it must never be emitted as an active
patient ``Condition``. The suite is the hard release gate behind OM-741: if any
denied, hypothetical, or non-patient (family / other experiencer) finding leaks
through :func:`~openmed.clinical.grounding.assertion_grounding.ground_with_context`
as an active patient condition, :func:`active_patient_condition_leaks` returns a
non-empty list and the gate fails.

The same gold set doubles as a status-mapping accuracy fixture: each case
carries its expected :mod:`~openmed.clinical.grounding.assertion_grounding`
status, and :func:`status_mapping_accuracy` scores the resolver against them.

All text is synthetic and algorithmically templated; it contains no real
patient data. Only cue offsets and axis labels ever reach provenance.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass

from openmed.clinical.exporters.codeable_concept import GroundedSpan
from openmed.clinical.exporters.fhir.condition import to_condition
from openmed.clinical.grounding import Candidate
from openmed.clinical.grounding.assertion_grounding import (
    GROUNDING_HISTORICAL,
    GROUNDING_HYPOTHETICAL,
    GROUNDING_NON_PATIENT,
    GROUNDING_PRESENT,
    GROUNDING_REFUTED,
    GROUNDING_UNCERTAIN,
    AssertedGroundedSpan,
    ground_with_context,
)

#: Axes whose findings must never surface as an active patient condition.
HARD_GATE_STATUSES = frozenset(
    {GROUNDING_REFUTED, GROUNDING_HYPOTHETICAL, GROUNDING_NON_PATIENT}
)

_SUBJECT_REFERENCE = "Patient/trap"


@dataclass(frozen=True)
class TrapCase:
    """One synthetic finding with its expected grounding status.

    ``text`` is the full synthetic sentence, ``surface`` the concept mention
    inside it (located by exact substring), ``system``/``code`` the coded
    concept the mention grounds to, ``axis`` the assertion axis exercised, and
    ``expected_status`` the grounding status the resolver must produce.
    """

    text: str
    surface: str
    system: str
    code: str
    axis: str
    expected_status: str

    @property
    def is_hard_gate(self) -> bool:
        """Whether a leak of this case as an active patient code fails release."""

        return self.expected_status in HARD_GATE_STATUSES

    def grounded_span(self) -> GroundedSpan:
        """Build the pre-grounded span (offsets located inside ``text``)."""

        start = self.text.index(self.surface)
        return GroundedSpan(
            text=self.surface,
            start=start,
            end=start + len(self.surface),
            candidates=(
                Candidate(
                    system=self.system,
                    code=self.code,
                    display=self.surface,
                    score=1.0,
                ),
            ),
        )


# Synthetic finding/code pairs reused across templates. Codes are illustrative
# ICD-10-CM / SNOMED identifiers, not drawn from any licensed distribution.
_FINDINGS = (
    ("pneumonia", "ICD10CM", "J18.9"),
    ("colon cancer", "ICD10CM", "C18.9"),
    ("deep vein thrombosis", "ICD10CM", "I82.90"),
    ("myocardial infarction", "ICD10CM", "I21.9"),
    ("diabetes mellitus", "ICD10CM", "E11.9"),
    ("pulmonary embolism", "ICD10CM", "I26.99"),
)

# axis -> (status, template with a ``{f}`` placeholder for the finding surface).
_TEMPLATES: tuple[tuple[str, str, str], ...] = (
    ("negation", GROUNDING_REFUTED, "No evidence of {f} on exam."),
    ("negation", GROUNDING_REFUTED, "The patient denies {f}."),
    ("hypothetical", GROUNDING_HYPOTHETICAL, "Return if {f} develops."),
    ("hypothetical", GROUNDING_HYPOTHETICAL, "Start heparin if {f} is suspected."),
    ("experiencer", GROUNDING_NON_PATIENT, "Family history of {f}."),
    ("experiencer", GROUNDING_NON_PATIENT, "Her mother had {f}."),
    ("temporality", GROUNDING_HISTORICAL, "History of {f}, now resolved."),
    ("uncertainty", GROUNDING_UNCERTAIN, "Possible {f} pending imaging."),
    ("present", GROUNDING_PRESENT, "The patient has acute {f}."),
    ("present", GROUNDING_PRESENT, "Assessment: {f} confirmed on exam."),
)


def _build_cases() -> tuple[TrapCase, ...]:
    cases: list[TrapCase] = []
    for axis, status, template in _TEMPLATES:
        for surface, system, code in _FINDINGS:
            cases.append(
                TrapCase(
                    text=template.format(f=surface),
                    surface=surface,
                    system=system,
                    code=code,
                    axis=axis,
                    expected_status=status,
                )
            )
    return tuple(cases)


#: The frozen trap gold set.
TRAP_CASES: tuple[TrapCase, ...] = _build_cases()


def iter_trap_cases() -> Iterator[TrapCase]:
    """Yield every trap case in the frozen gold set."""

    yield from TRAP_CASES


def assert_case(case: TrapCase) -> AssertedGroundedSpan:
    """Ground a single trap case through the assertion-aware path."""

    return ground_with_context(case.text, [case.grounded_span()])[0]


def active_patient_condition_leaks() -> list[TrapCase]:
    """Return hard-gate cases that leak as active patient conditions.

    A case leaks if its grounded span reports itself as an active patient
    condition, or if the FHIR ``Condition`` exporter emits an ``active`` +
    ``confirmed`` patient resource for it. The list must be empty for release.
    """

    leaks: list[TrapCase] = []
    for case in TRAP_CASES:
        if not case.is_hard_gate:
            continue
        asserted = assert_case(case)
        if asserted.is_active_patient_condition:
            leaks.append(case)
            continue
        condition = to_condition(asserted, subject_reference=_SUBJECT_REFERENCE)
        if _is_active_confirmed_patient(condition):
            leaks.append(case)
    return leaks


def status_mapping_accuracy() -> float:
    """Fraction of trap cases whose resolved status matches the gold status."""

    if not TRAP_CASES:
        return 0.0
    correct = sum(
        1
        for case in TRAP_CASES
        if assert_case(case).status.status == case.expected_status
    )
    return correct / len(TRAP_CASES)


def _is_active_confirmed_patient(condition: dict | None) -> bool:
    if condition is None:
        return False
    clinical = _coding_code(condition.get("clinicalStatus"))
    verification = _coding_code(condition.get("verificationStatus"))
    return clinical == "active" and verification == "confirmed"


def _coding_code(concept: dict | None) -> str | None:
    if not concept:
        return None
    codings = concept.get("coding") or []
    if not codings:
        return None
    return codings[0].get("code")

```

### Core Architecture Module: `eval/suites/postcoordinated_expressions.py`
```
"""Compatibility imports for the packaged post-coordinated expression suite."""

from openmed.eval.suites.postcoordinated_expressions import (
    SYNTHETIC_EXPRESSION_GOLD,
    SyntheticExpressionCase,
    evaluate_postcoordinated_expressions,
    synthetic_ecl_validator,
)

__all__ = [
    "SYNTHETIC_EXPRESSION_GOLD",
    "SyntheticExpressionCase",
    "evaluate_postcoordinated_expressions",
    "synthetic_ecl_validator",
]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3553** (2026-09-28): **fix: recover punctuation-split structured identifiers**
  *Symptoms*: ## Description Recover punctuation-split structured identifiers in the deterministic safety sweep while keeping spans on the original text and guarding clinical numerics.  ## Type of Change - [x] Bug fix - [x] Documentation update - [x] Test addition/improvement  ## Changes Made - Match bounded SSN, card, MRN, and IBAN shapes containing visible separator mutations. Require SSN and card context, a card or IBAN checksum, or an explicit MRN prefix. - Preserve the full original matched surface and offsets for redaction. - Add synthetic AC-02 recovery, blind-detector critical-leakage, and clinical false-positive regressions; update the threat-model status and residual boundary.  ## Testing - [x] `make format`, `make lint`, `make format-check` - [x] `.venv/bin/python -m pytest tests/unit/security/test_redactor_leakage_bypass.py tests/unit/core -q` — 3,245 passed, 3 skipped on the initial base - [x] `.venv/bin/python -m pytest tests/unit/eval/test_directid_evidence.py tests/unit/eval/test_directid_release.py tests/unit/risk/test_regression_suites.py -q` — 18 passed - [x] `make docs-build` — strict build passed - [x] `.venv/bin/python -m pytest tests/unit/security/test_redactor_leakage_bypass.py tests/unit/core/test_safety_sweep.py tests/unit/core/test_script_detect.py tests/unit/test_pii_i18n.py -q` — 1,036 passed on the refreshed base - [x] `.venv/bin/python -m pytest tests/ -q` — 21,684 passed, 174 skipped on the refreshed base with macOS sysctl access  Tested PR head: `33d1a1f5cc
  **Post-Mortem & Fix Analysis**:
  > Reviewed against #1345 and current master. Fixed two additional split-identifier regressions: MRN colon/hash prefixes now retain the complete source span, and overlong separated digit runs cannot be accepted as partial identifiers. Added eight regression cases.  Validation on exact head 90ddb2f01a0b7e3e816d30dd26116d76daa7902b: canonical format/lint/format-check passed; 63 focused privacy/direct-identifier tests passed; the full offline suite passed 21,878 tests with 174 skips; strict documentation staging passed; both staged-artifact manifest/budget checks passed; repository and license policies passed.  Hosted jobs on this new head are still queued/running; no failing result is reported. Local Python/privacy/docs gates above validate the exact reviewed source. Cross-platform/container/Nix results are not claimed as rerun locally. Master has no required status checks or repository rulesets. This scoped three-file repair is ready for a head-guarded squash merge based on the exact-head 

- **Issue #3542** (2026-09-27): **fix: load prefetched models offline with Transformers 5**
  *Symptoms*: ## Description Fix #1983 for models prefetched into the standard Hugging Face cache when OpenMed runs offline. The earlier resolution claim was premature: the old change handled a verified local path, while the broader cache fix in #2020 was never merged.  ## Type of Change - [x] Bug fix (non-breaking change which fixes an issue) - [x] Test addition/improvement  ## Changes Made - Resolve locally cached Hub snapshots from both the configured OpenMed cache and the standard Hugging Face cache, including a requested revision. - Remove local_files_only from pipeline model_kwargs before passing it to Transformers 5, which already supplies that keyword separately. - Preserve strict integrity behavior so an unverified snapshot cannot bypass require_integrity=True. - Add regression tests for the prefetched-cache path, nested local-only kwargs, revision handling, and strict integrity; update the changelog.  ## Testing - [x] Tests prove the reported failure path and its fix - [x] New and existing unit tests pass locally - [x] Tested model and pipeline loading with a real cached OpenMed PII model - Full suite: 21,542 passed, 217 skipped. - Final focused run: 78 passed. - Real offline smoke: transformers==5.17.0, huggingface-hub==1.33.0, with OPENMED_OFFLINE=1, HF_HUB_OFFLINE=1, and TRANSFORMERS_OFFLINE=1; prefetch_model, load_model, and extract_pii succeeded from a standard Hub cache snapshot and a separate OpenMed cache. - make format, make lint, make format-check, m

- **Issue #2967** (2026-08-26): **Refresh v2.3 wheel-size release budget**
  *Symptoms*: # Pull Request  ## Description Refreshes the committed wheel-size baseline from the v2.2 release-candidate measurement to the exact final v2.3 Linux CI measurement. The existing 10% headroom policy is preserved unchanged.  ## Type of Change - [x] Bug fix (non-breaking change which fixes an issue) - [ ] New feature (non-breaking change which adds functionality) - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected) - [ ] Documentation update - [ ] Code refactoring - [ ] Performance improvement - [x] Test/release-gate repair  ## Changes Made - Set the wheel baseline to the final v2.3 Linux CI measurement: 4,618,352 bytes. - Recalculate the maximum at the existing 10% headroom: 5,080,188 bytes. - Leave package contents, dependencies, and enforcement logic unchanged.  ## Testing - [x] New and existing release unit tests pass locally - [x] Real wheel-size gate passes against the final v2.3 wheel - [x] Built-wheel license policy passes  Commands run:  - python -m pytest tests/unit/release -q — 183 passed - python scripts/release/check_size_budget.py --skip-build --wheel-dir <final-v2.3-wheel> — passed at 4,618,569 / 5,080,188 bytes locally - python scripts/release/check_license_policy.py --wheel <final-v2.3-wheel> — passed  ## Documentation - [x] No documentation change is needed for a release-budget baseline refresh - [ ] I have updated the CHANGELOG.md  ## Code Quality - [x] I have performed a self-review - [x] The committed maximum
  **Post-Mortem & Fix Analysis**:
  > Release-blocker review complete on exact head 91b6e9d81f68f10ddc09b8c404a51042e65c5208. The PR changes only the committed wheel baseline and its derived maximum: 4,618,352 bytes with the existing 10% headroom, yielding 5,080,188 bytes. Package contents, dependencies, and enforcement logic are unchanged. Validation: all 183 release unit tests passed; the real wheel-size gate passed at 4,618,569 / 5,080,188 bytes on the local build; built-wheel license policy passed; diff and ancestry checks are clean; and there are no unresolved review threads. GitHub reports no hosted checks for this head, and the repository has no required status contexts or rulesets. Ready to merge. Closes #2966.

- **Issue #2966** (2026-08-26): **Refresh v2.3 wheel-size release budget**
  *Symptoms*: ## Summary  The final v2.3 package wheel is 4,618,352 bytes in Linux CI, while the committed maximum is 4,483,996 bytes. The current baseline of 4,076,360 bytes was recorded for the v2.2 release candidate and does not include the accepted v2.3 package modules. The release build therefore fails deterministically by 134,356 bytes even though package construction and license checks pass.  ## Acceptance criteria  - Refresh the committed wheel baseline to the exact final v2.3 Linux CI measurement of 4,618,352 bytes. - Preserve the existing 10% headroom policy, with a calculated maximum of 5,080,188 bytes. - Keep package contents and dependencies unchanged. - Pass the focused size-budget tests, wheel build, wheel license policy, and the real size-budget command.  ## Release impact  This is a v2.3 release blocker because the current master build job cannot pass the committed wheel-size gate.

- **Issue #2965** (2026-08-26): **Fix multi-stage container digest policy gate**
  *Symptoms*: # Pull Request  ## Description Updates the container digest policy test for the multi-stage service image introduced in #2947 while strengthening the gate to validate every root Dockerfile stage.  ## Type of Change - [x] Bug fix (non-breaking change which fixes an issue) - [ ] New feature (non-breaking change which adds functionality) - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected) - [ ] Documentation update - [ ] Code refactoring - [ ] Performance improvement - [x] Test addition/improvement  ## Changes Made - Accept a valid alias on the digest-pinned Python build stage. - Parse all root Dockerfile stage images. - Require every parsed stage image to carry a full SHA-256 digest.  ## Testing - [x] I have added tests that prove my fix is effective or that my feature works - [x] New and existing unit tests pass locally with my changes - [ ] I have tested this change with different models/inputs  Commands run:  - `python -m pytest tests/unit/deploy/test_container_multiarch.py -q` — 7 passed - `python -m pytest --last-failed -q` outside the restricted sandbox — 26 passed - `ruff check tests/unit/deploy/test_container_multiarch.py` - `ruff format --check tests/unit/deploy/test_container_multiarch.py`  ## Documentation - [x] No documentation change is needed for this test-only policy repair - [ ] I have added docstrings to new functions/classes - [ ] I have updated the CHANGELOG.md  ## Code Quality - [x] I ran the scoped canonica
  **Post-Mortem & Fix Analysis**:
  > Maintainer completion receipt for exact head `aad67c43f1fac6bdb34209c52080ca346e7c8241`.  - Issue gate: #2964 is maintainer-authored, open in milestone `v2.3`, and the implementation matches its release-blocking acceptance criteria. The PR label union exactly mirrors the issue: `roadmap-v2`, `bug`, `P1`. - Review gate: inspected the PR description, issue, conversation, single owner-authored commit, and complete one-file diff. Normal merge applies. - Repair: the pinned Python-stage policy now accepts a valid Docker stage alias, and the root policy extracts every `FROM` image and requires every stage to carry a full SHA-256 digest. This preserves the existing deployment-image assertion while covering the multi-stage runtime introduced in #2947. - Exact-head validation: full repository suite passed with 13,649 passed and 116 skipped. The focused container policy suite passed 7/7. Ruff check, Ruff format-check, and `git diff --check` passed for the changed file. - Failure classification: t

- **Issue #2964** (2026-08-26): **Fix multi-stage container digest policy gate**
  *Symptoms*: ## Summary  The root service image became a digest-pinned multi-stage Dockerfile in #2947. The existing container policy test still accepts only an unaliased single-stage Python `FROM` line, so the full test suite now fails even though both image stages are pinned.  ## Acceptance criteria  - Accept the digest-pinned Python build stage when it has a valid stage alias. - Parse every root Dockerfile `FROM` instruction and require each stage image to use a full SHA-256 digest. - Preserve the deployment Dockerfile's pinned Python-base assertion. - Pass the focused container policy tests, Ruff, format-check, and the previously failing audit subset.  ## Release impact  This is a v2.3 release blocker because current `master` does not pass the repository's full unit-test policy gate. 

- **Issue #2962** (2026-08-25): **Remove hosted model publication automation**
  *Symptoms*: # Pull Request  ## Description  Removes GitHub-hosted model conversion and Hugging Face publication automation, along with the scheduled model gate and real-model Apple Silicon conversion job. Model release tooling remains available for deliberate local maintainer use on explicitly provisioned hardware.  ## Type of Change  - [x] Bug fix (non-breaking change which fixes an issue) - [ ] New feature (non-breaking change which adds functionality) - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected) - [x] Documentation update - [ ] Code refactoring - [ ] Performance improvement - [x] Test addition/improvement  ## Changes Made  - Delete the hosted conversion/publication and nightly release workflows. - Remove the daily release-gate schedule while retaining explicit manual and metadata-only rollback dispatches. - Remove the automatic macOS real-model conversion job while retaining mocked, no-hardware MLX unit coverage. - Document model conversion, evaluation, and publication as explicit local maintainer operations. - Add a workflow-policy regression test that rejects hosted model conversion/publication commands, credentials, environments, and schedules. - Preserve the PyPI publishing workflow and local model release tooling.  ## Testing  - [x] I have added tests that prove my fix is effective or that my feature works - [x] New and existing unit tests pass locally with my changes - [ ] I have tested this change with different models/i
  **Post-Mortem & Fix Analysis**:
  > Reviewed against #2961 and the current `master` branch.  This removes the hosted model conversion/publication workflows, the scheduled model gate, and the real-model macOS conversion job while preserving explicit local release tooling, manual gate dispatch, mocked MLX unit coverage, and the unchanged PyPI publishing workflow.  Validation is complete: 13,108 local tests passed with 130 skips; the focused workflow/release/PyPI safety suite passed; lint, formatting, pre-commit, actionlint, strict docs, package builds, policy scans, and every exact-head hosted check passed. No Hugging Face repository content or visibility was changed.  This satisfies #2961 and is ready to merge. 

- **Issue #2961** (2026-08-25): **Remove GitHub Actions model publication automation**
  *Symptoms*: ## Summary  Remove GitHub-hosted model conversion and Hugging Face publication automation, and stop automatic hosted model evaluation. The current design schedules heavyweight model work on hosted runners without a provisioned compute or credential model, creates failed deployment noise, and could begin creating public model repositories if credentials were added later.  The local conversion, evaluation, gate, and publication tools remain available for deliberate maintainer-run releases on explicitly provisioned hardware. The existing model release gate remains available only through explicit manual dispatch and its metadata-only rollback dispatch.  ## Scope  - Remove the `.github/workflows/convert-models.yml` workflow, including both its weekday macOS batch and manual hosted conversion jobs. - Remove the `.github/workflows/nightly-release.yml` weekday build, gate, publish, smoke, and audit workflow. - Remove the daily cron from `.github/workflows/release-gates.yml` while preserving explicit manual evaluation and rollback dispatch. - Remove the hosted Apple Silicon real-model download, conversion, and inference job from `.github/workflows/mlx-test.yml` while preserving mocked no-hardware unit coverage. - Update release and security documentation to state that model conversion and Hugging Face publication are local/manual operations, never scheduled GitHub Actions work. - Add regression coverage that rejects any Actions workflow referencing the `hf-publish` environment, `HF_WR

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

### Incident Patch 1: `a88fe2fe` (2026-09-29)
**Commit Message**: Add offline clinical brief walkthrough and golden regression (#3613)

* Add native guarded clinical brief interoperability

* Add offline synthetic clinical brief walkthrough

* Invalidate verified brief when source changes

* Account for reviewed brief documentation payload

* Account for measured clinical walkthrough documentation

* Bind citation-support metrics to generated claim spans

* Index the clinical brief walkthrough in the cookbook

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -1,5 +1,7 @@
 # Changelog
 
+- Add the offline synthetic clinical-brief walkthrough, golden pipeline test,
+  explicit fixture-provider disclaimers and a recording script.
 - Add OpenMedKit guarded clinical-brief packets, local Maple brief generation,
   native leakage/envelope/citation validation and shared Python wire fixtures.
 - Add fail-closed summary release gates, seeded synthetic benchmark execution,
```

**File**: `README.hi.md` (modified, +19/-0)
```diff
@@ -89,6 +89,25 @@ for entity in result.entities:
 
 ---
 
+## 30 सेकंड में क्लिनिकल सारांश का उदाहरण
+
+सोर्स चेकआउट से केवल CPU पर चलने वाला सिंथेटिक इंटरफ़ेस प्रदर्शन चलाएँ:
+
+```bash
+python examples/v30_clinical_brief.py
+# वैकल्पिक: --model mlx; Apple silicon पर निश्चित मॉडल पहले से कैश होना चाहिए।
+```
+
+यह अंतर्निहित नोट का डी-आइडेंटिफिकेशन, एंटिटी निष्कर्षण और कॉन्सेप्ट मिलान करके
+स्रोत-संदर्भ वाला सारांश, सत्यापन परिणाम और मूल मानों के बिना समीक्षा पैकेट दिखाता है।
+**NER/NLI प्रदाता स्पष्ट रूप से सिंथेटिक टेस्ट डबल हैं; ये प्रशिक्षित मॉडल या
+क्लिनिकल सत्यापन नहीं हैं।** बाहरी नोट इनपुट स्वीकार नहीं किया जाता। MLX असमर्थित
+आउटपुट को अस्वीकार कर सकता है; सुरक्षा जाँच कभी नहीं छोड़ी जाती।
+[सारांश गाइड](docs/clinical/clinical-brief.md) और
+[डेमो स्क्रिप्ट](docs/demo/clinical-brief.md) में सीमाएँ और स्थानीय सेटअप देखें।
+
+---
+
 ## एजेंट के साथ बना रहे हैं?
 
 [उपभोक्ता एजेंट-उपयोग गाइड](docs/agent-usage.md) से शुरू करें या चुनी हुई
```

**File**: `README.md` (modified, +18/-0)
```diff
@@ -89,6 +89,24 @@ A clinical NER model using the local runtime after its required artifacts are av
 
 ---
 
+## Clinical brief in 30 seconds
+
+From a source checkout, run the CPU-only synthetic contract demonstration:
+
+```bash
+python examples/v30_clinical_brief.py
+# Optional: --model mlx, with the pinned model already cached on Apple silicon.
+```
+
+It de-identifies an embedded note, extracts and grounds a finding, then prints
+a cited brief, verdicts and a value-free review packet. **NER/NLI providers are
+explicit synthetic test doubles, not trained-model or clinical validation.**
+No external note input is accepted. The MLX option may refuse unsupported output;
+it never bypasses the guards. See the [brief guide](docs/clinical/clinical-brief.md)
+and [demo script](docs/demo/clinical-brief.md) for the boundaries and local setup.
+
+---
+
 ## Building with an agent?
 
 Start with the [consumer agent-usage guide](docs/agent-usage.md), or load the
```

**File**: `README.sw.md` (modified, +20/-0)
```diff
@@ -89,6 +89,26 @@ Modeli ya NER ya kliniki hutumia runtime ya ndani baada ya vipengee vinavyohitaj
 
 ---
 
+## Mfano wa muhtasari wa kliniki kwa sekunde 30
+
+Kutoka kwenye nakala ya msimbo, endesha onyesho la mikataba ya kiolesura kwa data
+sintetiki kwa kutumia CPU pekee:
+
+```bash
+python examples/v30_clinical_brief.py
+# Hiari: --model mlx; modeli ya toleo lililowekwa ihifadhiwe mapema kwenye Apple silicon.
+```
+
+Mfano huondoa utambulisho kwenye dokezo lililojumuishwa, hutoa na kuoanisha dhana,
+kisha huonyesha muhtasari wenye marejeo, matokeo ya ukaguzi na pakiti ya mapitio
+isiyo na thamani ghafi. **Watoa huduma wa NER/NLI ni vibadala vya majaribio ya
+data sintetiki, si modeli zilizofunzwa wala uthibitisho wa kliniki.** Haukubali
+madokezo ya nje. MLX inaweza kukataa matokeo yasiyoungwa mkono; haipiti ukaguzi
+wa usalama. Angalia [mwongozo](docs/clinical/clinical-brief.md) na
+[hati ya onyesho](docs/demo/clinical-brief.md) kwa mipaka na usanidi wa ndani.
+
+---
+
 ## Unajenga kwa wakala?
 
 Anza na [mwongozo wa matumizi ya wakala](docs/agent-usage.md), au pakia
```

**File**: `README.zh-CN.md` (modified, +17/-0)
```diff
@@ -89,6 +89,23 @@ for entity in result.entities:
 
 ---
 
+## 30 秒运行临床摘要示例
+
+在源码检出目录中运行仅使用 CPU 的合成数据接口演示：
+
+```bash
+python examples/v30_clinical_brief.py
+# 可选：--model mlx，需要在 Apple 芯片设备上预先缓存固定版本的模型。
+```
+
+该示例对内置记录进行去标识化、实体抽取和概念匹配，然后输出带来源引用的摘要、
+核验结果和不含原始值的审核包。**NER/NLI 提供程序是明确标注的合成测试替身，
+不是经过训练的模型，也不代表临床验证。** 不接受外部记录输入。
+MLX 输出若缺乏证据支持会被拒绝，不会绕过保护检查。
+详见[摘要指南](docs/clinical/clinical-brief.md)和[演示脚本](docs/demo/clinical-brief.md)。
+
+---
+
 ## 使用智能体构建？
 
 请从[面向使用者的智能体指南](docs/agent-usage.md)开始，或加载精选的
```

---

### Incident Patch 2: `d0df2391` (2026-09-28)
**Commit Message**: Complete clinical document routing and regression evaluation (#3593)

* Route discharge extraction by note type (#3474)

* feat: route discharge extraction by note type

* fix: make clinical routing abstain on invalid confidence and empty spans

* Record measured note-routing documentation budget

* Add bounded clinical document fixture generators (#2488)

* feat: add synthetic clinical fixture generator

* fix: calibrate clinical fixture documentation budget

* fix: validate synthetic fixture imports and safe artifact boundaries

* Record validated synthetic fixture documentation budget

---------

Co-authored-by: Maziyar Panahi <5762953+maziyarpanahi@users.noreply.github.com>

* Add bounded OCR and note-routing evaluation (#2441)

* feat: add OCR routing evaluation harness

* feat: add synthetic clinical fixture generator

* feat: normalize OCR box coordinates

* feat: add OCR page rotation transforms

* fix: preserve artifact bytes in SDK readiness fixtures

* feat: route discharge extraction by note type

* fix: keep OCR page size exports distinct

* feat: reconstruct clinical layout from OCR boxes

* fix: validate OCR layout geometry inputs

* fix: infer isolated OCR bands wit

**File**: `docs/brand/system/publication.yml` (modified, +2/-0)
```diff
@@ -409,8 +409,10 @@ classification:
     - export-awq.md
     - export-gptq.md
     - export-gguf.md
+    - evaluation/clinical-fixtures.md
     - multimodal/box-normalization.md
     - multimodal/page-rotation.md
+    - evaluation/ocr-routing.md
     - multimodal/dicom-sr-provenance.md
     - clinical/lab-reference-ranges.md
     - clinical/lab-measurements.md
```

**File**: `docs/clinical/note-routing.md` (modified, +40/-0)
```diff
@@ -72,3 +72,43 @@ The router itself is deterministic, rules-first, and offline. It does not load
 a model, fetch terminology, read credentials, or make a mandatory network
 call. It is assistive extraction plumbing and does not make clinical
 decisions.
+
+## Route extraction by document type
+
+`openmed.clinical.routing` uses the local `classify_document` result to select
+radiology, pathology, or discharge-summary extraction scopes. The discharge
+route reuses the existing discharge profile's source section boundaries for
+diagnoses, procedures, medications, follow-up, and instructions. Medication
+candidates stay in discharge medications; problem mentions stay in discharge
+diagnoses. Every route includes the selected profile, classifier confidence,
+and a fallback reason when routing abstains.
+
+```python
+from openmed.clinical.routing import build_extraction_plan
+
+plan = build_extraction_plan(
+    "DISCHARGE SUMMARY\nDischarge Medications:\n- Synthetic tablet 5 mg daily.",
+)
+assert plan.profile.name == "discharge_summary"
+assert plan.routing_provenance.fallback_reason is None
+```
+
+Unknown labels and invalid or low-confidence predictions use the generic pass-through
+profile. The generic route keeps the existing entity list and order. The
+specialized profiles reject zero-length entities and retain absolute source offsets and do not infer clinical
+decisions.
+
+The committed synthetic fixture harness in
+`tests/unit/clinical/test_note_type_routing.py` compares unscoped candidate
+entities with routed stage inputs. It includes one deliberate irrelevant
+candidate per document type and uses exact span identity as the match key:
+
+| Synthetic type | Unscoped entity F1 | Routed entity F1 | Gain |
+| --- | ---: | ---: | ---: |
+| Radiology | 0.80 | 1.00 | +0.20 |
+| Pathology | 0.86 | 1.00 | +0.14 |
+| Discharge summary | 0.80 | 1.00 | +0.20 |
+
+These are deterministic fixture checks of routing precision, not estimates of
+clinical accuracy. The fixtures contain only synthetic text and no restricted
+corpus material.
```

**File**: `docs/evaluation/clinical-fixtures.md` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+# Synthetic clinical fixture generator
+
+`openmed.eval.clinical_fixtures` provides small, deterministic documents for
+offline extraction-profile evaluation. The generator uses only the Python
+standard library; it does not download models, terminology, or datasets and it
+does not modify global random state.
+
+These are synthetic evaluation inputs, not clinical ground truth, a medical
+device, or a substitute for qualified clinical judgment.
+
+## Generate fixtures
+
+```python
+from openmed.eval.clinical_fixtures import generate_fixtures
+
+fixtures = generate_fixtures(
+    profiles=("progress_note", "radiology_report"),
+    seed=17,
+)
+
+fixture = fixtures[0]
+document = fixture.text  # Pass to a local extraction runner.
+gold_spans = fixture.gold_spans
+expected_fields = fixture.expected_structured_fields
+```
+
+The canonical profiles are:
+
+| Profile | Coverage |
+|---|---|
+| `progress_note` | history, negation, historical context, assessment, and plan |
+| `radiology_report` | indication, modality, anatomy, findings, and uncertainty |
+| `lab_report` | coded test, quantity, unit, and interpretation |
+| `discharge_summary` | diagnosis, absent finding, medication, and follow-up |
+| `pathology_report` | specimen, microscopy, and diagnostic uncertainty |
+
+`generic`, `clinical_note`, `radiology`, `lab`, `discharge`, `progress`, and
+`pathology` are accepted as short aliases. A profile-specific derivation of the
+requested seed makes each document stable even when the order of a selected
+profile list changes.
+
+## Gold contract
+
+Each `GoldSpan` contains `start` and `end` character offsets, a label, its
+section, assertion axes, and an optional `CodedValue`. It intentionally does
+not require a copied mention string for scoring. `fixture.span_text(span)` is
+available when a local model test needs the in-memory substring.
+
+Codes use the `openmed.synthetic` system and local code tokens. They exercise
+code-system and code propagation without bundling a restricted terminology
+vocabulary or making a network call.
+
+`ExpectedField` records link structured output expectations to span IDs. This
+keeps field assertions traceable without duplicating source text. The fixture
+validates that section ranges, span ranges, and field references are
+consistent when it is created.
+
+## Privacy-safe artifacts
+
+`fixture.to_dict()` and `fixture.to_json()` omit the document and span text by
+default. They retain only offsets, labels, assertion axes, code identities (without display text), field
+references, synthetic metadata, and a `sha256:` document fingerprint; scalar
+field values are also omitted. This is the safe form for reports, logs, and
+audit artifacts:
+
+```python
+safe_report = fixture.to_dict()
+assert "text" not in safe_report
+```
+
+`include_text=True` is an explicit local round-trip opt-in that also retains
+scalar expected-field values. Do not use that form for reports or logs. The
+committed tests and generated metadata are synthetic-only and mark
+`synthetic=True` and `phi=False`.
+
+The generator is an evaluation aid only. It does not certify privacy, coding
+accuracy, clinical safety, or production model behavior.
+
+Imported offsets must be integers, and supplied schema versions, document hashes, and synthetic/no-PHI markers must agree. Collections are limited to 4096 entries, documents to 1 MiB of characters, string metadata to 4096 characters, and seeds to signed 64-bit integers. Validation exceptions omit caller values. Typed values are revalidated before fixture serialization.
+
+Custom fixture IDs, labels, code identities, and field names must be non-sensitive controlled identifiers. Synthetic/no-PHI markers describe caller-provided provenance; they do not anonymize arbitrary input or certify privacy. Code display text is included only with the explicit text-inclusive fixture serialization.
```

**File**: `docs/evaluation/ocr-routing.md` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+# OCR document-routing evaluation
+
+`openmed.eval.ocr_routing` provides a deterministic, offline evaluation harness
+for routing clinical documents after OCR. It exercises the local document
+classifier and the existing routing profiles with synthetic examples for
+radiology, pathology, progress, discharge, operative, consult, and unknown
+documents.
+
+Radiology, pathology, and discharge summaries expect their specialized local
+profiles. Other document families exercise the generic pass-through fallback.
+
+The harness is an evaluation of the routing pipeline, not a compliance
+certification or a clinical decision guarantee. It does not load a model, make
+a network request, or call an external OCR service.
+
+## Run the default corpus
+
+```python
+from openmed.eval.ocr_routing import assert_ocr_routing_gate
+
+report = assert_ocr_routing_gate()
+print(report.metrics.to_dict())
+```
+
+`run_ocr_routing_eval()` returns a report without raising when a case fails.
+`assert_ocr_routing_gate()` raises an `AssertionError` whose diagnostic names
+only fixture IDs, failure categories, and safe structural details.
+
+## What is scored
+
+The report includes three aggregate surfaces:
+
+- `route_selection_accuracy` compares the predicted document type with the
+  fixture's expected family.
+- `offset_projection_accuracy` compares section labels and canonical
+  half-open offsets after projecting detector output from OCR text back to the
+  canonical coordinate space. Precision, recall, and F1 are also reported.
+- `safe_fallback_rate` checks that unknown, unsupported, or low-confidence
+  classifications select the generic pass-through profile and preserve all
+  offset-bearing sections and probe entities.
+
+OCR-to-canonical alignment uses Python's standard-library
+`difflib.SequenceMatcher`. Equal runs retain exact boundaries; insertions,
+deletions, and replacements are mapped monotonically. Callers can build the
+map directly with `build_offset_projection(source_text, target_text)` and
+project a range with `projection.project_span(start, end)`.
+
+## Privacy and fixture policy
+
+The default corpus is synthetic and lives in memory. Fixture manifests and
+reports contain lengths, labels, offsets, counts, confidence values, fixture
+IDs, and domain-separated SHA-256 digests. They do not serialize canonical or
+OCR text. Custom fixtures should use synthetic offline values and should not
+place source text in logs, exception messages, committed golden data, or
+evaluation artifacts.
+
+The routing result is an engineering signal. Downstream clinical review,
+privacy controls, and application-specific safety gates remain required.
+
+## Limits and interpretation
+
+This is a fixture regression gate, not model-accuracy evidence. Unless supplied
+explicitly, gold section boundaries are produced by the same local detector on
+canonical text. A complete mismatch scores zero F1; an empty/empty comparison
+scores one by convention. Every case must pass, even when aggregate thresholds
+are relaxed.
+
+Each text is limited to 4,096 characters and each alignment to 4,000,000
+source/target character pairs. A run accepts at most 512 fixtures and each
+section collection at most 4,096 entries. Oversized inputs fail closed before
+alignment. These limits bound this small offline harness, not the production
+document pipeline.
+
+Classifier and detector errors use fixed categories. Unknown document types
+map to `unknown`; unknown section labels are domain-separated hashes. Callback
+errors do not trigger a second detector invocation. Invalid confidence values
+fall back conservatively to zero.
+
+Fixture IDs and language metadata are caller-owned identifiers: use
+non-sensitive values. Excluding document text is not anonymization of those
+identifiers or proof that a caller-supplied fixture is synthetic.
```

**File**: `mkdocs.yml` (modified, +2/-0)
```diff
@@ -334,8 +334,10 @@ nav:
       - AWQ Export: export-awq.md
       - GPTQ Export: export-gptq.md
       - GGUF Embedding Export: export-gguf.md
+      - Synthetic Clinical Fixtures: evaluation/clinical-fixtures.md
       - OCR box-coordinate normalization: multimodal/box-normalization.md
       - OCR page-rotation transforms: multimodal/page-rotation.md
+      - OCR document-routing evaluation: evaluation/ocr-routing.md
       - DICOM-SR provenance mapping: multimodal/dicom-sr-provenance.md
       - Typed laboratory reference-range provenance: clinical/lab-reference-ranges.md
       - Lab Measurement Normalization: clinical/lab-measurements.md
```

---

### Incident Patch 3: `6d970aa4` (2026-09-28)
**Commit Message**: fix: reject unmatched numeric fragments in schema values

**File**: `openmed/structured/schema_extract.py` (modified, +8/-0)
```diff
@@ -529,12 +529,20 @@ def _coerce(spec: _FieldSpec, raw: str) -> tuple[Any, str | None]:
     elif field_type == "integer":
         matches = list(_NUMBER_TOKEN_RE.finditer(raw))
         match = matches[0] if len(matches) == 1 else None
+        if match is not None and any(
+            char.isdigit() for char in raw[: match.start()] + raw[match.end() :]
+        ):
+            match = None
         if match is None or "." in match.group():
             return None, "expected an integer value"
         value = int(match.group())
     elif field_type == "number":
         matches = list(_NUMBER_TOKEN_RE.finditer(raw))
         match = matches[0] if len(matches) == 1 else None
+        if match is not None and any(
+            char.isdigit() for char in raw[: match.start()] + raw[match.end() :]
+        ):
+            match = None
         if match is None:
             return None, "expected a numeric value"
         value = float(match.group())
```

**File**: `tests/unit/structured/test_schema_extract.py` (modified, +3/-1)
```diff
@@ -353,7 +353,9 @@ def test_advisory_exposed():
     assert isinstance(SCHEMA_EXTRACT_ADVISORY, str) and SCHEMA_EXTRACT_ADVISORY
 
 
-@pytest.mark.parametrize("raw", ["1e3", "10-20", "2 and 3", "1/2"])
+@pytest.mark.parametrize(
+    "raw", ["1e3", "10-20", "2 and 3", "1/2", "3,5 and 8", "1.2.3 and 8"]
+)
 def test_ambiguous_numeric_value_is_not_silently_truncated(raw):
     result = extract_to_schema(
         "Dose: " + raw, {"properties": {"dose": {"type": "number"}}}
```

---

### Incident Patch 4: `c77cc0db` (2026-09-28)
**Commit Message**: fix: bound schema extraction and reject ambiguous source values

**File**: `docs/structured/schema-guided-extraction.md` (modified, +17/-0)
```diff
@@ -100,3 +100,20 @@ gaps recorded in `missing_required` and `errors`.
 `data`, `bindings`, and `errors` contain extracted values in memory. Keep the
 result inside the caller's protected workflow; do not write those values to
 logs or audit artifacts.
+
+## Bounded extraction
+
+Notes are limited to 1 MiB, input collections and table cells to 4,096 entries,
+and candidate values to 4,096 characters. Invalid or oversized source iterables
+are reported as value-free entries in `errors` (empty field/raw and zero offsets);
+other valid sources can still fill slots. Duplicate table coordinates are
+rejected instead of being resolved by input order. Numeric ranges, fractions,
+scientific notation and multiple numeric tokens are not guessed or truncated.
+
+Schemas allow at most 256 properties/aliases/enum values. Regex patterns are
+limited to 256 characters and a non-branching subset: literals, anchors, character
+classes, exact repetitions up to 256, and at most one flexible repetition.
+Groups, alternatives, backreferences and nested repetitions are rejected.
+Schema errors use a fixed message without retaining source exception context.
+A partial result with missing required fields is not a valid complete instance
+of the target schema; check both `missing_required` and `errors` before use.
```

**File**: `openmed/structured/schema_extract.py` (modified, +135/-18)
```diff
@@ -24,6 +24,8 @@
 
 import re
 from collections.abc import Iterable, Mapping
+from functools import wraps
+from itertools import islice
 from math import isfinite
 from typing import Any, Literal, TypedDict
 
@@ -137,6 +139,80 @@ class _FieldSpec(TypedDict):
     pattern: re.Pattern[str] | None
 
 
+def _schema_boundary(function):
+    @wraps(function)
+    def checked(*args, **kwargs):
+        try:
+            return function(*args, **kwargs)
+        except Exception:
+            pass
+        raise SchemaDefinitionError("invalid or unsupported extraction schema")
+
+    return checked
+
+
+def _bounded(values, limit=4096):
+    result = tuple(islice(iter(values), limit + 1))
+    if len(result) > limit:
+        raise ValueError("input limit exceeded")
+    return result
+
+
+def _safe_pattern(source):
+    """Accept linear, non-branching scalar patterns, not arbitrary regex programs."""
+    if not isinstance(source, str) or len(source) > 256:
+        raise SchemaDefinitionError("invalid pattern")
+    index, flexible, atom = 0, 0, False
+    while index < len(source):
+        char = source[index]
+        if char == "\\":
+            index += 1
+            if (
+                index >= len(source)
+                or source[index].isdigit()
+                or source[index] in {"g", "k"}
+            ):
+                raise SchemaDefinitionError("unsupported regex reference")
+            atom = True
+        elif char == "[":
+            index += 1
+            if index < len(source) and source[index] == "^":
+                index += 1
+            while index < len(source) and source[index] != "]":
+                if source[index] == "\\":
+                    index += 1
+                index += 1
+            if index >= len(source):
+                raise SchemaDefinitionError("invalid character class")
+            atom = True
+        elif char in "()|":
+            raise SchemaDefinitionError("branching regex is unsupported")
+        elif char in "*+?":
+            flexible += 1
+            if not atom or flexible > 1:
+                raise SchemaDefinitionError("ambiguous regex repetition")
+            atom = False
+        elif char == "{":
+            end = source.find("}", index)
+            count = source[index + 1 : end] if end >= 0 else ""
+            if (
+                not atom
+                or not count.isascii()
+                or not count.isdigit()
+                or not 1 <= int(count) <= 256
+            ):
+                raise SchemaDefinitionError("unsupported regex repetition")
+            index, atom = end, False
+        elif char in "^$":
+            atom = False
+        elif char == "}":
+            raise SchemaDefinitionError("unsupported regex repetition")
+        else:
+            atom = True
+        index += 1
+    return re.compile(source)
+
+
 def normalize_field_key(label: str) -> str:
     """Normalize a slot name or source label to a comparable key.
 
@@ -188,15 +264,37 @@ def extract_to_schema(
 
     specs, required = _compile_schema(schema)
 
-    candidates: dict[FieldSource, dict[str, list[_Candidate]]] = {
-        "entity": _entity_candidates(text, entities),
-        "table": _table_candidates(text, tables),
-        "key_value": _key_value_candidates(text),
-    }
+    input_errors: list[SchemaValidationIssue] = []
+
+    def invalid_source(source):
+        input_errors.append(
+            SchemaValidationIssue(
+                field="",
+                reason="invalid or oversized source input",
+                raw="",
+                start=0,
+                end=0,
+                source=source,
+            )
+        )
+
+    if not isinstance(text, str) or len(text) > 1048576:
+        invalid_source("key_value")
+        text = ""
+    candidates = {"entity": {}, "table": {}, "key_value": {}}
+    for source, builder, values in (
+        ("entity", _entity_candidates, entities),
+        ("table", _table_candidates, table
```

**File**: `tests/unit/structured/test_schema_extract.py` (modified, +87/-0)
```diff
@@ -351,3 +351,90 @@ def test_deterministic():
 
 def test_advisory_exposed():
     assert isinstance(SCHEMA_EXTRACT_ADVISORY, str) and SCHEMA_EXTRACT_ADVISORY
+
+
+@pytest.mark.parametrize("raw", ["1e3", "10-20", "2 and 3", "1/2"])
+def test_ambiguous_numeric_value_is_not_silently_truncated(raw):
+    result = extract_to_schema(
+        "Dose: " + raw, {"properties": {"dose": {"type": "number"}}}
+    )
+    assert result["data"] == {}
+    assert result["errors"]
+
+
+@pytest.mark.parametrize(
+    "definition",
+    [
+        {"type": []},
+        {"type": "string", "aliases": 0},
+        {"type": "string", "pattern": "(a+)+$"},
+    ],
+)
+def test_malformed_or_unsafe_schema_is_a_definition_error(definition):
+    with pytest.raises(SchemaDefinitionError) as caught:
+        extract_to_schema("", {"properties": {"synthetic-sensitive-value": definition}})
+    assert "synthetic-sensitive-value" not in str(caught.value)
+    assert caught.value.__context__ is None
+
+
+def test_bad_source_iterator_returns_partial_extraction():
+    def broken():
+        raise RuntimeError("synthetic-sensitive-value")
+        yield
+
+    result = extract_to_schema(NOTE, SCHEMA, entities=broken())
+    assert result["data"]["patient_age"] == 54
+    assert result["errors"]
+    assert "synthetic-sensitive-value" not in repr(result["errors"])
+
+
+def test_oversized_integer_is_reported_without_raising():
+    result = extract_to_schema(
+        "Age: " + "9" * 5000, {"properties": {"age": {"type": "integer"}}}
+    )
+    assert result["data"] == {}
+    assert result["errors"]
+
+
+def test_ambiguous_enum_canonicalization_is_rejected():
+    with pytest.raises(SchemaDefinitionError):
+        extract_to_schema(
+            "Kind: a", {"properties": {"kind": {"type": "string", "enum": ["A", "a"]}}}
+        )
+
+
+def test_duplicate_table_cell_is_not_resolved_by_input_order():
+    text = "Age 10 20"
+    key = {"row": 0, "column": 0, "text": "Age", "start": 0, "end": 3}
+    a = {"row": 0, "column": 1, "text": "10", "start": 4, "end": 6}
+    b = {"row": 0, "column": 1, "text": "20", "start": 7, "end": 9}
+    schema = {"properties": {"age": {"type": "integer"}}}
+    first = extract_to_schema(text, schema, tables=[{"cells": [key, a, b]}])
+    second = extract_to_schema(text, schema, tables=[{"cells": [key, b, a]}])
+    assert first == second
+    assert first["data"] == {}
+    assert first["errors"]
+
+
+def test_source_collections_are_bounded():
+    result = extract_to_schema(NOTE, SCHEMA, entities=[{}] * 4097)
+    assert result["errors"]
+    assert result["data"]["patient_age"] == 54
+
+
+def test_canonical_enum_value_must_still_satisfy_pattern():
+    schema = {
+        "properties": {
+            "sex": {"type": "string", "enum": ["Female"], "pattern": "female"}
+        }
+    }
+    result = extract_to_schema("Sex: female", schema)
+    assert result["data"] == {}
+    assert result["errors"]
+
+
+def test_pattern_on_numeric_slot_is_rejected():
+    with pytest.raises(SchemaDefinitionError):
+        extract_to_schema(
+            "Age: 10", {"properties": {"age": {"type": "integer", "pattern": "[0-9]+"}}}
+        )
```

---

### Incident Patch 5: `02f6b5cb` (2026-09-28)
**Commit Message**: fix: recover punctuation-split structured identifiers (#3553)

* fix: recover punctuation-split structured identifiers

* fix: retain split-identifier regex import after merge

* Fix split identifier boundaries and MRN prefixes

**File**: `docs/security/threat-model.md` (modified, +6/-7)
```diff
@@ -161,7 +161,7 @@ published examples are **synthetic**.
 | ID | Abuse case | Vector | Mitigation | Status |
 |---|---|---|---|---|
 | **AC-01** | Zero-width / whitespace split identifier | Zero-width joiners or stray spaces inside an SSN/card/email so the ML token and the regex both break. | `normalize_for_pii_detection` strips zero-width controls; whitespace variants are matched by sweep regexes; smart-merge reunites ML fragments. Then `safety_sweep` recovers. | **Mitigated** |
-| **AC-02** | Uncanonicalized separator mutation | Some visible separator mutations can disrupt structured-identifier matching. The current document intentionally omits actionable forms and reproduction details and routes future reports through `SECURITY.md`. | No complete deterministic mitigation is claimed. The ML detector may add defense in depth but is not treated as a guaranteed control. | **Known gap** |
+| **AC-02** | Punctuation-split structured identifiers | Visible punctuation inserted between characters can defeat ordinary identifier patterns. | The deterministic safety sweep recognizes bounded split SSN, card, MRN, and IBAN shapes at their original offsets. SSN and card matches require context or a checksum; MRN requires its explicit prefix, and IBAN requires a checksum. Synthetic regression tests cover leakage and clinical-number false positives. | **Mitigated for the bounded shapes** |
 | **AC-03** | Unicode confusable / mixed-script obfuscation | Greek/Cyrillic/full-width lookalikes substituted into an identifier (`janе.doe@…` with a Cyrillic `е`). | Confusable folding maps lookalikes to Latin before detection; mixed-script is flagged in metadata; spans remap to the original. | **Mitigated** |
 | **AC-04** | Full-width digit encoding | Identifier written with full-width digits (`４１１１ …`) to dodge ASCII-digit regexes. | Full-width forms (U+FF01–FF5E) are folded to ASCII in `normalize_for_pii_detection` before the sweep. | **Mitigated** |
 | **AC-05** | Combining-mark obfuscation | Standalone combining diacritics layered over identifier characters. | Category-`Mn` combining marks are stripped offset-preservingly before detection. | **Mitigated** |
@@ -191,13 +191,12 @@ OpenMed version instead of re-exporting the legacy artifact.
 | No-telemetry / no phone-home enforcement | **OM-099** | [`no-telemetry.md`](no-telemetry.md) |
 | Adversarial-Unicode normalization | this task / de-id path | [`script_detect.py`](https://github.com/maziyarpanahi/openmed/blob/master/openmed/core/script_detect.py) |
 
-### 6.2 Open gaps (no complete mitigation today)
+### 6.2 Residual separator risk
 
-- **AC-02 — uncanonicalized separator mutation.** Some visible separator
-  transformations fall outside the normalization and deterministic-pattern
-  contracts. This remains a residual leakage class. The current document
-  intentionally omits exploit details; report new findings through the
-  vulnerability-reporting process in `SECURITY.md`.
+- **AC-02 — separator mutation outside bounded shapes.** The deterministic
+  control covers the named structured identifiers and separators above. Other
+  identifier types and separator mutations may still evade it. Report new
+  findings through the vulnerability-reporting process in `SECURITY.md`.
 
 ## 7. Residual-leakage risks
 
```

**File**: `openmed/core/safety_sweep.py` (modified, +59/-0)
```diff
@@ -3,6 +3,7 @@
 from __future__ import annotations
 
 import hashlib
+import re
 from dataclasses import dataclass
 from typing import Any, Mapping, Sequence
 
@@ -19,6 +20,24 @@
 SAFETY_SWEEP_SOURCE = "safety_sweep"
 SAFETY_SWEEP_PATTERNS_VERSION = "safety-sweep-v1"
 
+# Bound separator tolerance to structured shapes. A visible mutation must be
+# present, and the existing validator or explicit MRN context must still pass.
+_SPLIT_IDENTIFIER_PATTERNS = (
+    ("ssn", re.compile(r"(?<!\w)\d(?:[-.,· ]{0,2}\d){8}(?!\w)")),
+    (
+        "credit_debit_card",
+        re.compile(r"(?<!\w)\d(?:[-.,· ]{0,2}\d){15}(?!\w)"),
+    ),
+    (
+        "medical_record_number",
+        re.compile(r"(?<!\w)MRN[: #]*\d(?:[-.,· ]{0,2}\d){5,9}(?!\w)", re.I),
+    ),
+    (
+        "iban",
+        re.compile(r"(?<!\w)[A-Z]{2}\d{2}(?:[-.,· ]{0,2}[A-Z0-9]){11,30}(?!\w)"),
+    ),
+)
+
 
 @dataclass(frozen=True)
 class _Candidate:
@@ -154,6 +173,46 @@ def _collect_candidates(text: str, patterns: Sequence[PIIPattern]) -> list[_Cand
                 )
             )
 
+    by_label = {pattern.entity_type: pattern for pattern in patterns}
+    for label, split_pattern in _SPLIT_IDENTIFIER_PATTERNS:
+        pattern = by_label.get(label)
+        if pattern is None:
+            continue
+        for match in split_pattern.finditer(text):
+            start, end = match.span()
+            surface = match.group()
+            if not any(char in surface for char in ".,·"):
+                continue
+            if label != "iban" and (
+                re.search(r"\d[-.,· ]{0,2}$", text[max(0, start - 3) : start])
+                or re.match(r"[-.,· ]{0,2}\d", text[end : end + 3])
+            ):
+                # Never reinterpret a fragment of a longer separated digit run.
+                continue
+            canonical = re.sub(r"[-.,·\s]", "", surface)
+            if label == "medical_record_number":
+                if not re.fullmatch(r"MRN[:#]*\d{6,10}", canonical, re.I):
+                    continue
+            elif not _validated(pattern, canonical):
+                continue
+            if label == "ssn" and not _has_context(text, start, end, pattern):
+                continue
+            if label == "credit_debit_card" and not _has_context(
+                text, start, end, pattern
+            ):
+                continue
+            candidates.append(
+                _Candidate(
+                    start=start,
+                    end=end,
+                    label=label,
+                    text=surface,
+                    confidence=_confidence(text, start, end, pattern),
+                    priority=pattern.priority,
+                    pattern=pattern,
+                )
+            )
+
     candidates.sort(
         key=lambda candidate: (
             -candidate.confidence,
```

**File**: `tests/unit/security/test_redactor_leakage_bypass.py` (modified, +77/-4)
```diff
@@ -174,10 +174,83 @@ def test_ac01_zero_width_chars_are_all_stripped_offset_preserving():
     assert 0 <= start <= end <= len(text)
 
 
-# AC-02 is a known, unmitigated separator-mutation class. The current public
-# regression suite intentionally omits its actionable reproduction and routes
-# future findings through SECURITY.md. A public regression should land with the
-# coordinated fix and disclosure.
+# --- AC-02: punctuation-split structured identifiers -------------------------
+
+
+@pytest.mark.parametrize(
+    "split",
+    ["1.2.3-4.5-6.7.8.9", "1,2,3-4,5-6,7,8,9", "·".join("123456789")],
+)
+def test_ac02_split_ssn_has_exact_offsets_and_no_critical_leakage(split):
+    """The deterministic sweep recovers a synthetic split SSN without ML help."""
+    text = f"SSN {split} is synthetic."
+    normalized = normalize_for_pii_detection(text)
+    entities = safety_sweep(normalized.text, [])
+    matches = [entity for entity in entities if entity.label == "ssn"]
+    assert len(matches) == 1
+    start, end = normalized.remap_span(matches[0].start, matches[0].end)
+    assert (start, end) == (4, 4 + len(split))
+    assert text[start:end] == split
+    output = _deidentify_with_blind_model(text)
+    assert split not in output
+    assert "ssn" in output.lower()
+
+
+@pytest.mark.parametrize(
+    ("text", "label"),
+    [
+        ("Card 4.111.111.111.111.111", "credit_debit_card"),
+        ("MRN 1,2,3,4,5,6", "medical_record_number"),
+        ("IBAN GB82.WE.ST.1234.5698.7654.32", "iban"),
+    ],
+)
+def test_ac02_other_split_identifiers_are_recovered(text, label):
+    """Checksum or explicit context gates the remaining structured shapes."""
+    assert label in _swept_labels(safety_sweep(text, []))
+
+
+@pytest.mark.parametrize("prefix", ["MRN: ", "MRN #", "MRN: #", "mrn:"])
+def test_ac02_mrn_prefix_variants_preserve_full_source_span(prefix):
+    surface = f"{prefix}1,2,3,4,5,6"
+    text = f"Synthetic {surface} is recorded."
+    matches = [
+        entity
+        for entity in safety_sweep(text, [])
+        if entity.label == "medical_record_number"
+    ]
+    assert len(matches) == 1
+    assert text[matches[0].start : matches[0].end] == surface
+    assert surface not in _deidentify_with_blind_model(text)
+
+
+@pytest.mark.parametrize(
+    ("text", "label"),
+    [
+        ("SSN 1.2.3.4.5.6.7.8.9.0", "ssn"),
+        ("SSN 0.1.2.3.4.5.6.7.8.9.0", "ssn"),
+        ("Card 4.111.111.111.111.111.0", "credit_debit_card"),
+        ("MRN: 1,2,3,4,5,6,7,8,9,0,1", "medical_record_number"),
+    ],
+)
+def test_ac02_overlong_split_runs_are_not_partial_identifiers(text, label):
+    assert label not in _swept_labels(safety_sweep(text, []))
+
+
+@pytest.mark.parametrize(
+    "text",
+    [
+        "BP 1.2.3.4.5.6.7.8.9 mmHg",
+        "dose 1,2,3,4,5,6,7,8,9 mg",
+        "HbA1c 6.7, glucose 8.9 mmol/L",
+        "Card 4.111.111.111.111.112",
+    ],
+)
+def test_ac02_clinical_numbers_and_invalid_card_are_not_identifiers(text):
+    """Clinical punctuation and failed checksums do not become identifiers."""
+    labels = _swept_labels(safety_sweep(text, []))
+    assert not labels.intersection(
+        {"ssn", "credit_debit_card", "medical_record_number", "iban"}
+    )
 
 
 # --- AC-03: unicode confusable / mixed-script obfuscation ---------------------
```

---

### Incident Patch 6: `6af1d8e6` (2026-09-27)
**Commit Message**: fix: consolidate eight contributor correctness repairs (#3558)

* fix(budget): reject unknown mapping fields (#3531)

* fix(eval): preserve explicitly empty gold spans (#3533)

Co-authored-by: Maziyar Panahi <maziyar@live.co.uk>

* fix(eval): stream dataset content hashing (#3532)

Co-authored-by: Maziyar Panahi <maziyar@live.co.uk>

* fix(config): preserve hashes inside quoted values (#3525)

Co-authored-by: Maziyar Panahi <maziyar@live.co.uk>

* fix(processing): strip BIO prefixes only at label start (#3526)

Co-authored-by: Maziyar Panahi <maziyar@live.co.uk>

* fix(processing): validate sharding counts before iteration (#3536)

Co-authored-by: Maziyar Panahi <maziyar@live.co.uk>

* fix(processing): reject overlapping nested siblings (#3541)

Co-authored-by: Maziyar Panahi <maziyar@live.co.uk>

* fix(ner): isolate cached GLiNER models by device (#3520)

Co-authored-by: Maziyar Panahi <maziyar@live.co.uk>

---------

Co-authored-by: Belal Embaby <113125888+Bembaby@users.noreply.github.com>

**File**: `CHANGELOG.md` (modified, +13/-1)
```diff
@@ -250,9 +250,21 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   publishing permissions are limited to the publish job.
 
 ### Fixed
-
+- Reject unsupported RequestBudget mapping keys instead of silently ignoring
+  misspelled limits (#3509).
+- Preserve hash characters inside quoted configuration values while stripping
+  trailing comments (#3502).
+- Strip BIO prefixes only at label beginnings, preserving interior labels such as
+  HLA-B-27 (#3503).
+- Key GLiNER model cache entries by requested device so a cached instance is not
+  moved under a later caller (#3501).
+
+- Hash dataset files with bounded memory (#3510).
+- Respect explicitly empty gold annotations (#3511).
 - Load prefetched Hugging Face models from the standard cache during offline
   inference, including Transformers 5.x pipeline and component loading (#1983).
+- Reject non-integer sharding counts before reading documents.
+- Reject overlapping sibling items at nested list levels.
 - Require strict decoder validation before auto-detecting ISCII, preserving
   malformed Latin-1 strings through privacy preprocessing instead of raising
   or partially rewriting the input (#3242).
```

**File**: `openmed/core/budget.py` (modified, +8/-0)
```diff
@@ -241,12 +241,20 @@ def coerce_budget(
 
     Raises:
         TypeError: If ``budget`` is not a supported type.
+        InputError: If a mapping contains unsupported fields or invalid values.
     """
     if budget is None:
         return None
     if isinstance(budget, RequestBudget):
         return None if budget.is_unlimited else budget
     if isinstance(budget, Mapping):
+        allowed_fields = ("max_wall_time", "max_input_chars")
+        if any(key not in allowed_fields for key in budget):
+            raise InputError(
+                "Budget mapping contains unsupported fields. Use max_wall_time "
+                "and max_input_chars.",
+                details={"argument": "budget", "allowed_fields": list(allowed_fields)},
+            )
         coerced = RequestBudget(
             max_wall_time=budget.get("max_wall_time"),
             max_input_chars=budget.get("max_input_chars"),
```

**File**: `openmed/core/config.py` (modified, +23/-1)
```diff
@@ -749,11 +749,33 @@ def _format_value(value: Any) -> str:
     return f'"{value}"'
 
 
+def _strip_toml_comment(line: str) -> str:
+    """Remove an inline comment outside a single-line quoted value."""
+    quote = None
+    escaped = False
+    for index, character in enumerate(line):
+        if quote == '"':
+            if escaped:
+                escaped = False
+            elif character == "\\":
+                escaped = True
+            elif character == quote:
+                quote = None
+        elif quote == "'":
+            if character == quote:
+                quote = None
+        elif character in ("'", '"'):
+            quote = character
+        elif character == "#":
+            return line[:index]
+    return line
+
+
 def _load_toml(path: Path) -> Dict[str, Any]:
     data: Dict[str, Any] = {}
     with path.open("r", encoding="utf-8") as handle:
         for raw_line in handle:
-            line = raw_line.split("#", 1)[0].strip()
+            line = _strip_toml_comment(raw_line).strip()
             if not line or "=" not in line:
                 continue
             key, value = line.split("=", 1)
```

**File**: `openmed/eval/data_provenance.py` (modified, +27/-10)
```diff
@@ -74,30 +74,48 @@ def build_dataset_provenance(
 
 
 def compute_dataset_content_hash(path: str | Path) -> str:
-    """Hash a dataset file or directory without retaining its bytes."""
+    """Hash a dataset file or directory without retaining file contents.
+
+    Files are streamed in bounded 1 MiB chunks. Directory manifests still retain
+    one digest per file, and the resulting digest encoding is unchanged.
+    """
 
     source_path = Path(path)
     if not source_path.exists():
         raise FileNotFoundError(f"dataset source does not exist: {source_path}")
     if source_path.is_file():
-        return _hash_bytes(source_path.read_bytes())
+        return _hash_file(source_path)
 
     entries = {
-        child.relative_to(source_path).as_posix(): _hash_bytes(child.read_bytes())
+        child.relative_to(source_path).as_posix(): _hash_file(child)
         for child in sorted(source_path.rglob("*"))
         if child.is_file()
     }
     return _hash_json({"files": entries})
 
 
+def _hash_file(path: Path) -> str:
+    """Hash a file with bounded read buffers and the existing digest format."""
+
+    digest = hashlib.sha256()
+    with path.open("rb") as handle:
+        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
+            digest.update(chunk)
+    return f"sha256:{digest.hexdigest()}"
+
+
 def build_training_data_manifest(
     fixtures: Iterable[Any],
     *,
     dataset_id: str,
     data_revision: str,
     source: str | None = None,
 ) -> dict[str, Any]:
-    """Build a content-addressed manifest without persisting raw text."""
+    """Build a content-addressed manifest without persisting raw text.
+
+    For mapping fixtures, the first non-None field among ``gold_spans``,
+    ``spans``, and ``entities`` is authoritative, including an empty list.
+    """
 
     entries = sorted(
         (_fixture_manifest_entry(fixture) for fixture in fixtures),
@@ -212,12 +230,11 @@ def _fixture_language(fixture: Any) -> str | None:
 
 def _fixture_spans(fixture: Any) -> Iterable[Any]:
     if isinstance(fixture, Mapping):
-        return (
-            fixture.get("gold_spans")
-            or fixture.get("spans")
-            or fixture.get("entities")
-            or []
-        )
+        for field in ("gold_spans", "spans", "entities"):
+            value = fixture.get(field)
+            if value is not None:
+                return value
+        return []
     return getattr(fixture, "gold_spans", ())
 
 
```

**File**: `openmed/ner/families/gliner.py` (modified, +15/-9)
```diff
@@ -91,13 +91,7 @@ def load_gliner_handle(
     """Load a GLiNER model and wrap it in ``GLiNERHandle``."""
 
     ensure_gliner_available()
-    model = _load_model(model_id, cache_dir or None, token or None)
-
-    if device and hasattr(model, "to"):
-        try:
-            model = model.to(device)
-        except Exception:  # pragma: no cover - defensive path
-            pass
+    model = _load_model(model_id, cache_dir or None, token or None, device or None)
 
     return GLiNERHandle(model_id=model_id, model=model)
 
@@ -109,7 +103,12 @@ def clear_gliner_cache() -> None:
 
 
 @lru_cache(maxsize=4)
-def _load_model(model_id: str, cache_dir: Optional[str], token: Optional[str]) -> Any:
+def _load_model(
+    model_id: str,
+    cache_dir: Optional[str],
+    token: Optional[str],
+    device: Optional[str] = None,
+) -> Any:
     ensure_gliner_available()
     module = importlib.import_module(_PRIMARY_IMPORT)
     loader = getattr(module, "GLiNER")
@@ -118,7 +117,14 @@ def _load_model(model_id: str, cache_dir: Optional[str], token: Optional[str]) -
         kwargs["cache_dir"] = cache_dir
     if token:
         kwargs["token"] = token
-    return loader.from_pretrained(model_id, **kwargs)
+    model = loader.from_pretrained(model_id, **kwargs)
+    # Place each cached instance once; another device must not move live handles.
+    if device and hasattr(model, "to"):
+        try:
+            model = model.to(device)
+        except Exception:  # pragma: no cover - defensive path
+            pass
+    return model
 
 
 __all__ = [
```

---

### Incident Patch 7: `98b0dc18` (2026-09-27)
**Commit Message**: fix: calibrate schema extraction documentation budget

**File**: `tests/browser/brand/budgets.json` (modified, +3/-2)
```diff
@@ -1,8 +1,8 @@
 {
   "schema_version": 2,
   "artifact": {
-    "maximum_total_bytes": 80302400,
-    "maximum_unique_payload_bytes": 79964821,
+    "maximum_total_bytes": 80540213,
+    "maximum_unique_payload_bytes": 80202634,
     "maximum_duplicate_payload_bytes": 458752,
     "maximum_source_map_files": 0
   },
@@ -37,6 +37,7 @@
     "With the multimodal batch-memory guide, the staged artifact measures 79767347 total bytes, 79429768 unique payload bytes, and 337579 duplicate payload bytes on macOS.",
     "With the agent run commitment guide, the staged artifact measures 79975507 total bytes, 79637928 unique payload bytes, and 337579 duplicate payload bytes on macOS.",
     "With the agent action-phase guide, the staged artifact measures 80186914 total bytes, 79849335 unique payload bytes, and 337579 duplicate payload bytes on macOS.",
+    "With the schema-guided extraction guide and the current master documentation, the staged artifact measures 80424727 total bytes, 80087148 unique payload bytes, and 337579 duplicate payload bytes on macOS.",
     "The aggregate ceilings retain the largest observed 4736-byte platform delta plus 110750 bytes of bounded headroom. Per-file non-JSON caps, duplicate-byte allowance, source-map exclusion, and page metric budgets remain unchanged.",
     "The published clinical, agent, multimodal, language-pack, interoperability, governance, social-needs, outbound-privacy, evidence-recency, NLI, and guardrail guides remain searchable. The combined search index measures 4185784 bytes against its 4197641-byte JSON ceiling; the 5752-byte increase preserves its previous measured headroom.",
     "The generated 2266-row model registry remains directly accessible but is excluded from global search indexing so unrelated documentation routes do not absorb its search payload.",
```

---

### Incident Patch 8: `24a13406` (2026-09-27)
**Commit Message**: Merge pull request #3542 from maziyarpanahi/fix/issue-1983-offline-cache-loading

fix: load prefetched models offline with Transformers 5

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -251,6 +251,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- Load prefetched Hugging Face models from the standard cache during offline
+  inference, including Transformers 5.x pipeline and component loading (#1983).
 - Require strict decoder validation before auto-detecting ISCII, preserving
   malformed Latin-1 strings through privacy preprocessing instead of raising
   or partially rewriting the input (#3242).
```

**File**: `openmed/core/models.py` (modified, +50/-11)
```diff
@@ -205,6 +205,7 @@ def load_model(
                 full_model_name,
                 local_only=bool(requested_local_loading.get("local_files_only")),
                 require_integrity=True,
+                revision=kwargs.get("revision"),
             )
 
         # A model loaded earlier under the permissive policy must not silently
@@ -233,6 +234,7 @@ def load_model(
                 model_name,
                 full_model_name,
                 local_only=bool(requested_local_loading.get("local_files_only")),
+                revision=kwargs.get("revision"),
             )
 
         try:
@@ -446,6 +448,7 @@ def _create_hf_pipeline(
             model_name,
             full_model_name,
             local_only=bool(requested_local_loading.get("local_files_only")),
+            revision=kwargs.get("revision"),
         )
 
         model_kwargs: Dict[str, Any] = {}
@@ -464,28 +467,22 @@ def _create_hf_pipeline(
                 pipeline_model_reference,
                 kwargs,
             )
-            prepared_reference_is_local = (
-                self._as_existing_local_path(pipeline_model_reference) is not None
-            )
             prepared_reference_local_only = bool(
                 local_loading_kwargs.get("local_files_only")
             )
             pipeline_load_kwargs = dict(kwargs)
             model_kwargs = dict(pipeline_load_kwargs.pop("model_kwargs", {}) or {})
-            # Transformers forwards loader options through ``model_kwargs``;
-            # top-level extras are sent to the instantiated pipeline instead.
+            # The local snapshot and socket guard enforce offline loading.
+            # Transformers 5 supplies local_files_only to AutoConfig itself;
+            # forwarding it through model_kwargs passes the keyword twice.
             pipeline_load_kwargs.pop("local_files_only", None)
             model_kwargs.update(local_loading_kwargs)
+            model_kwargs.pop("local_files_only", None)
             cache_dir = pipeline_load_kwargs.pop("cache_dir", None)
             if cache_dir is None and prepared_reference_local_only:
                 cache_dir = getattr(self.config, "cache_dir", None)
             if cache_dir is not None:
                 model_kwargs.setdefault("cache_dir", cache_dir)
-            if prepared_reference_is_local:
-                # Transformers 5 already marks filesystem model references as
-                # local. Repeating the option through ``model_kwargs`` makes
-                # AutoConfig receive ``local_files_only`` twice.
-                model_kwargs.pop("local_files_only", None)
             if "quantization_config" in pipeline_load_kwargs:
                 model_kwargs.setdefault(
                     "quantization_config",
@@ -772,19 +769,57 @@ def _prepare_model_reference(
         *,
         local_only: bool,
         require_integrity: bool = False,
+        revision: Optional[str] = None,
     ) -> str:
         """Resolve and verify cached artifacts before model construction."""
         registry_info = get_model_info(requested_model_name) or get_model_info(
             resolved_model_name
         )
-        return prepare_model_reference(
+        prepared_reference = prepare_model_reference(
             resolved_model_name,
             registry_info=registry_info,
             cache_dir=str(self.config.cache_dir),
             local_only=local_only,
             token=getattr(self.config, "hf_token", None),
             require_integrity=require_integrity,
         )
+        if (
+            require_integrity
+            or not local_only
+            or self._as_existing_local_path(prepared_reference) is not None
+        ):
+            return prepared_reference
+
+        cached_snapshot = self._find_cached_hf_snapshot(
+            prepared_reference,
+            revision=revision,
+        )
+        return cached_snapshot or prepared_reference
+
+    def _find_cached_hf_snapshot(
+        self,
+        mod
```

**File**: `tests/unit/test_offline_mode.py` (modified, +123/-2)
```diff
@@ -63,7 +63,7 @@ def test_local_only_hf_pipeline_uses_cached_files(mock_pipeline, monkeypatch):
 
     pipeline_kwargs = mock_pipeline.call_args.kwargs
     assert "local_files_only" not in pipeline_kwargs
-    assert pipeline_kwargs["model_kwargs"]["local_files_only"] is True
+    assert "local_files_only" not in pipeline_kwargs["model_kwargs"]
     assert pipeline_kwargs["model_kwargs"]["cache_dir"] == loader.config.cache_dir
 
 
@@ -82,7 +82,128 @@ def test_local_only_config_cannot_be_disabled_by_pipeline_kwarg(
 
     pipeline_kwargs = mock_pipeline.call_args.kwargs
     assert "local_files_only" not in pipeline_kwargs
-    assert pipeline_kwargs["model_kwargs"]["local_files_only"] is True
+    assert "local_files_only" not in pipeline_kwargs["model_kwargs"]
+
+
+@patch("openmed.core.models.HF_AVAILABLE", True)
+@patch("openmed.core.backends._module_available", lambda _: True)
+@patch("openmed.core.models.pipeline")
+@patch("openmed.core.models.prepare_model_reference")
+@patch("openmed.core.hf_hub._import_snapshot_download")
+def test_prefetched_standard_hub_snapshot_loads_offline_without_duplicate_kwarg(
+    mock_import_snapshot_download,
+    mock_prepare_model_reference,
+    mock_pipeline,
+    tmp_path,
+    monkeypatch,
+):
+    _clear_offline_env(monkeypatch)
+    monkeypatch.setenv(OFFLINE_ENV_VAR, "1")
+    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
+    monkeypatch.setenv("TRANSFORMERS_OFFLINE", "1")
+
+    model_id = "OpenMed/prefetched-pii"
+    snapshot = tmp_path / "standard-hub" / "snapshot"
+    snapshot.mkdir(parents=True)
+    openmed_cache = tmp_path / "openmed-cache"
+    calls = []
+
+    class LocalEntryNotFoundError(Exception):
+        pass
+
+    def fake_snapshot_download(**kwargs):
+        calls.append(kwargs)
+        if "cache_dir" in kwargs:
+            raise LocalEntryNotFoundError
+        return str(snapshot)
+
+    mock_prepare_model_reference.return_value = model_id
+    mock_import_snapshot_download.return_value = (
+        fake_snapshot_download,
+        LocalEntryNotFoundError,
+    )
+
+    from openmed.core.models import ModelLoader
+
+    loader = ModelLoader(
+        OpenMedConfig(local_only=True, backend="hf", cache_dir=str(openmed_cache))
+    )
+    loader.create_pipeline(model_id, revision="a" * 40)
+
+    pipeline_kwargs = mock_pipeline.call_args.kwargs
+    assert pipeline_kwargs["model"] == str(snapshot)
+    assert "local_files_only" not in pipeline_kwargs
+    assert "local_files_only" not in pipeline_kwargs["model_kwargs"]
+    assert calls == [
+        {
+            "repo_id": model_id,
+            "repo_type": "model",
+            "revision": "a" * 40,
+            "local_files_only": True,
+            "cache_dir": str(openmed_cache),
+        },
+        {
+            "repo_id": model_id,
+            "repo_type": "model",
+            "revision": "a" * 40,
+            "local_files_only": True,
+        },
+    ]
+
+
+@patch("openmed.core.models.HF_AVAILABLE", True)
+@patch("openmed.core.backends._module_available", lambda _: True)
+@patch("openmed.core.models.pipeline")
+def test_nested_local_only_pipeline_kwarg_uses_cached_snapshot(
+    mock_pipeline, tmp_path, monkeypatch
+):
+    _clear_offline_env(monkeypatch)
+    snapshot = tmp_path / "snapshot"
+    snapshot.mkdir()
+
+    from openmed.core.models import ModelLoader
+
+    loader = ModelLoader(OpenMedConfig(backend="hf"))
+    with patch.object(
+        loader, "_prepare_model_reference", return_value=str(snapshot)
+    ) as mock_prepare:
+        loader.create_pipeline(
+            "OpenMed/local-pii",
+            model_kwargs={"local_files_only": True},
+        )
+
+    assert mock_prepare.call_args.kwargs["local_only"] is True
+    pipeline_kwargs = mock_pipeline.call_args.kwargs
+    assert pipeline_kwargs["model"] == str(snapshot)
+    assert "local_files_only" not in pipeline_kwargs["model_kwargs"]
+
+
+@patch("openmed.core.models.HF_AVAILABLE", True)
+def test_integrity_required_load_r
```

---

### Incident Patch 9: `7dbf28b6` (2026-09-27)
**Commit Message**: Merge pull request #3498 from kokokoXUY/fix/terminal-metadata-ttl

fix(service): keep a terminal job's full metadata retention

**File**: `openmed/service/jobs.py` (modified, +9/-4)
```diff
@@ -279,12 +279,16 @@ def shutdown(self) -> None:
             self._shutdown = True
         self._executor.shutdown(wait=False, cancel_futures=True)
 
-    def _new_record(self, payload: DeidentifyJobRequest) -> dict[str, Any]:
-        now = self.clock()
+    def _expiry_timestamp(self, moment: datetime) -> str:
+        """Return the metadata expiry for a record that reached *moment*."""
         expires_at = datetime.fromtimestamp(
-            now.timestamp() + self.store.ttl_seconds,
+            moment.timestamp() + self.store.ttl_seconds,
             tz=timezone.utc,
         )
+        return _isoformat(expires_at)
+
+    def _new_record(self, payload: DeidentifyJobRequest) -> dict[str, Any]:
+        now = self.clock()
         documents = [
             _document_metadata(index, document)
             for index, document in enumerate(payload.documents)
@@ -306,7 +310,7 @@ def _new_record(self, payload: DeidentifyJobRequest) -> dict[str, Any]:
             "updated_at": _isoformat(now),
             "started_at": None,
             "completed_at": None,
-            "expires_at": _isoformat(expires_at),
+            "expires_at": self._expiry_timestamp(now),
         }
 
     def _run_job(self, item: _JobWorkItem) -> None:
@@ -339,6 +343,7 @@ def _run_job(self, item: _JobWorkItem) -> None:
             progress_percent=100.0,
             error=error,
             completed_at=_isoformat(completed_at),
+            expires_at=self._expiry_timestamp(completed_at),
         )
         self._send_terminal_webhook(item.payload.webhook, final_record)
 
```

**File**: `tests/unit/service/test_jobs_api.py` (modified, +42/-0)
```diff
@@ -197,6 +197,48 @@ def process(_payload: DeidentifyJobRequest, document: DeidentifyJobDocument):
     assert "synthetic first" not in path.read_text(encoding="utf-8")
 
 
+def test_terminal_record_keeps_its_full_metadata_ttl_after_completion(
+    monkeypatch: pytest.MonkeyPatch,
+    tmp_path: Path,
+) -> None:
+    from types import SimpleNamespace
+
+    from openmed.service.schemas import DeidentifyJobDocument, DeidentifyJobRequest
+
+    now = [datetime(2026, 1, 1, tzinfo=timezone.utc)]
+    store = jobs.LocalJobStore(
+        tmp_path / "jobs.json",
+        ttl_seconds=10,
+        clock=lambda: now[0],
+    )
+    queue = jobs.DeidentifyJobQueue(
+        SimpleNamespace(),
+        store=store,
+        clock=lambda: now[0],
+    )
+    payload = DeidentifyJobRequest(
+        documents=[DeidentifyJobDocument(id="synthetic-0", text="synthetic sample")]
+    )
+    record = queue._new_record(payload)
+    store.create(record)
+
+    def process(_payload: DeidentifyJobRequest, _document: DeidentifyJobDocument):
+        now[0] += timedelta(seconds=11)
+        return SimpleNamespace(pii_entities=[])
+
+    monkeypatch.setattr(queue, "_deidentify_document", process)
+    try:
+        queue._run_job(jobs._JobWorkItem(record["id"], payload))
+    finally:
+        queue.shutdown()
+
+    completed = store.get(record["id"])
+    assert completed is not None
+    assert completed["completed_at"] == "2026-01-01T00:00:11Z"
+    assert completed["expires_at"] == "2026-01-01T00:00:21Z"
+    assert completed["status"] == "done"
+
+
 def _wait_for_job(
     client: TestClient,
     job_id: str,
```

---

### Incident Patch 10: `45b19ff5` (2026-09-27)
**Commit Message**: Merge pull request #3492 from kokokoXUY/fix/webhook-timeout-with-supplied-client

fix(service): honour the requested timeout for supplied webhook clients

**File**: `openmed/service/webhooks.py` (modified, +9/-1)
```diff
@@ -92,6 +92,9 @@ def deliver_webhook(
 
     Each HTTP delivery attempt receives its own timestamp and nonce so a
     receiver can apply replay protection without rejecting a legitimate retry.
+    ``timeout_seconds`` bounds each attempt's connect/read/write/pool I/O and is
+    applied to every request, including when the caller supplies ``client``; a
+    supplied client's own configuration and ownership are left unchanged.
     """
     if max_attempts < 1:
         raise ValueError("max_attempts must be at least 1")
@@ -121,7 +124,12 @@ def deliver_webhook(
             )
             headers = {**base_headers, **signed_headers}
             try:
-                response = active_client.post(url, content=body, headers=headers)
+                response = active_client.post(
+                    url,
+                    content=body,
+                    headers=headers,
+                    timeout=timeout_seconds,
+                )
                 last_status_code = response.status_code
                 if 200 <= response.status_code < 300:
                     return WebhookDeliveryResult(
```

**File**: `tests/unit/service/test_webhooks.py` (modified, +118/-0)
```diff
@@ -13,6 +13,7 @@
     verify_request_signature,
 )
 from openmed.service.webhooks import (
+    DEFAULT_WEBHOOK_TIMEOUT_SECONDS,
     SIGNATURE_HEADER,
     TIMESTAMP_HEADER,
     canonical_json_bytes,
@@ -129,3 +130,120 @@ def test_canonical_json_bytes_is_stable() -> None:
         separators=(",", ":"),
         sort_keys=True,
     ).encode("utf-8")
+
+
+def _timeout_extensions(seconds: float) -> dict[str, float]:
+    return {"connect": seconds, "read": seconds, "write": seconds, "pool": seconds}
+
+
+def _recording_transport(
+    seen: list[dict[str, float]],
+    statuses: list[int] | None = None,
+) -> httpx.MockTransport:
+    remaining = list(statuses or [204])
+
+    def handler(request: httpx.Request) -> httpx.Response:
+        seen.append(dict(request.extensions["timeout"]))
+        status = remaining.pop(0) if remaining else 204
+        return httpx.Response(status)
+
+    return httpx.MockTransport(handler)
+
+
+def test_deliver_webhook_applies_timeout_to_a_supplied_client() -> None:
+    seen: list[dict[str, float]] = []
+    with httpx.Client(
+        timeout=None,
+        transport=_recording_transport(seen),
+    ) as client:
+        result = deliver_webhook(
+            "https://callbacks.example.test/openmed",
+            {"event": "job.done", "job_id": "abc", "status": "done"},
+            secret="secret",
+            client=client,
+            timeout_seconds=0.5,
+            max_attempts=1,
+        )
+
+        assert result.success is True
+        assert seen == [_timeout_extensions(0.5)]
+        assert client.is_closed is False
+
+
+def test_deliver_webhook_timeout_overrides_the_supplied_client_default() -> None:
+    seen: list[dict[str, float]] = []
+    with httpx.Client(
+        timeout=httpx.Timeout(30.0),
+        transport=_recording_transport(seen),
+    ) as client:
+        result = deliver_webhook(
+            "https://callbacks.example.test/openmed",
+            {"event": "job.done", "job_id": "abc", "status": "done"},
+            secret="secret",
+            client=client,
+            timeout_seconds=1.25,
+            max_attempts=1,
+        )
+
+        assert result.success is True
+        assert seen == [_timeout_extensions(1.25)]
+        assert client.timeout.connect == 30.0
+        assert client.timeout.read == 30.0
+
+
+def test_deliver_webhook_applies_timeout_to_every_attempt() -> None:
+    seen: list[dict[str, float]] = []
+    client = httpx.Client(
+        timeout=None,
+        transport=_recording_transport(seen, statuses=[503, 204]),
+    )
+    result = deliver_webhook(
+        "https://callbacks.example.test/openmed",
+        {"event": "job.done", "job_id": "abc", "status": "done"},
+        secret="secret",
+        client=client,
+        timeout_seconds=0.25,
+        max_attempts=2,
+        backoff_seconds=0,
+    )
+
+    assert result.success is True
+    assert result.attempts == 2
+    assert seen == [_timeout_extensions(0.25), _timeout_extensions(0.25)]
+
+
+def test_deliver_webhook_uses_the_default_timeout_when_unspecified() -> None:
+    seen: list[dict[str, float]] = []
+    with httpx.Client(
+        timeout=None,
+        transport=_recording_transport(seen),
+    ) as client:
+        deliver_webhook(
+            "https://callbacks.example.test/openmed",
+            {"event": "job.done", "job_id": "abc", "status": "done"},
+            secret="secret",
+            client=client,
+            max_attempts=1,
+        )
+
+        assert seen == [_timeout_extensions(DEFAULT_WEBHOOK_TIMEOUT_SECONDS)]
+
+
+def test_deliver_webhook_leaves_the_supplied_client_ownership_alone() -> None:
+    seen: list[dict[str, float]] = []
+    client = httpx.Client(
+        timeout=httpx.Timeout(30.0),
+        transport=_recording_transport(seen),
+    )
+    deliver_webhook(
+        "https://callbacks.example.test/openmed",
+        {"event": "job.done", "job_id": "abc", "status": "done"},
+        secret="secret",
+        client=client,
+
```

#### Recent Merged Pull Requests:
- **PR #3613** (2026-09-29): Add offline clinical brief walkthrough and golden regression (@maziyarpanahi)
- **PR #3612** (2026-09-29): Add guarded native clinical briefs and demo integration (@maziyarpanahi)
- **PR #3611** (2026-09-29): Gate summary release on measured local evidence (@maziyarpanahi)
- **PR #3610** (2026-09-29): Expose guarded clinical brief interfaces and clients (@maziyarpanahi)
- **PR #3609** (2026-09-29): Compose guarded local clinical briefs (@maziyarpanahi)
- **PR #3598** (2026-09-28): Add bounded cache-only local summarizer backends (@maziyarpanahi)
- **PR #3597** (2026-09-28): Add offline benchmark suite inspection and report comparison (@maziyarpanahi)
- **PR #3595** (2026-09-28): Integrate Indic language routing and locale support (@maziyarpanahi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
