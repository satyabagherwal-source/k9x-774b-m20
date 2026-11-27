# Domain I — Content & Information Intelligence: Content & Information Intelligence: prometheus-prometheus-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "prometheus-prometheus-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T18:08:35.855Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-prometheus-prometheus-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [prometheus-prometheus-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T18:08:35.855Z`  
> **Learning ID**: `LEARN-EVO-prometheus-prometheus-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain I (Content & Information Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), G (Architecture Intelligence), H (Technical Construction Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), D (Research & Knowledge Intelligence), B (Product Intelligence), A (Human & Need Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 56%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from prometheus-prometheus-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/prometheus-prometheus-learnings.md`  
> **Source**: github ([https://github.com/prometheus/prometheus](https://github.com/prometheus/prometheus))  
> **Source Version**: `ccdfcea8`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-27T18:08:24.299Z  
> **Learning ID**: `learn-github-prometheus-prometheus`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): prometheus/prometheus

> **Canonical Artifact**: `07_PROJECT_LEARNING/prometheus-prometheus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/prometheus/prometheus](https://github.com/prometheus/prometheus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-27T18:08:24.294Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `prometheus/prometheus`
- **Description**: The Prometheus monitoring system and time series database.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 67923 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/contributor-trust/scripts/score_contributors.py`
```
#!/usr/bin/env python3
# Copyright The Prometheus Authors
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""
Computes contributor trust scores for any GitHub repository using repository
governance roles (Maintainer, Member, Contributor, New Contributor) and a
rolling monthly contribution average (1.0x merged PRs + 1.5x reviewed PRs).
"""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
import datetime
import json
import math
import os
import re
import subprocess
import sys
import time


ROLE_MAINTAINER = "Maintainer"
ROLE_MEMBER = "Member"
ROLE_CONTRIBUTOR = "Contributor"
ROLE_NEW_CONTRIBUTOR = "New Contributor"

ROLE_BASE_SCORES = {
    ROLE_MAINTAINER: 50.0,
    ROLE_MEMBER: 35.0,
    ROLE_CONTRIBUTOR: 15.0,
    ROLE_NEW_CONTRIBUTOR: 0.0,
}

ROLE_RANK = {
    ROLE_NEW_CONTRIBUTOR: 0,
    ROLE_CONTRIBUTOR: 1,
    ROLE_MEMBER: 2,
    ROLE_MAINTAINER: 3,
}

ASSOC_RANK = {
    "NONE": 0,
    "FIRST_TIMER": 1,
    "FIRST_TIME_CONTRIBUTOR": 1,
    "CONTRIBUTOR": 2,
    "COLLABORATOR": 3,
    "MEMBER": 4,
    "OWNER": 5,
}

PROMETHEUS_ORGS = {"prometheus", "prometheus-community", "promcon"}
RESERVED_GH_PATHS = {
    "orgs",
    "organizations",
    "teams",
    "issues",
    "pulls",
    "pull",
    "discussions",
    "actions",
    "settings",
    "security",
    "sponsors",
    "about",
    "pricing",
    "features",
}

MERGED_PR_WEIGHT = 1.0
REVIEWED_PR_WEIGHT = 1.5
CONTRIB_LOG_SCALE = 12.0
MAX_CONTRIB_BONUS = 40.0
DEFAULT_WINDOW_DAYS = 90
DEFAULT_AGING_PER_DAY = 1.5
NEW_CONTRIBUTOR_WELCOME_SCORE = 30.0


# NOTE(bwplotka): We query repository.pullRequests ordered by UPDATED_AT DESC
# instead of the GraphQL search connection. GitHub search caps results at 1,000
# items and enforces strict secondary rate limits, whereas repository.pullRequests
# streams cleanly and can stop as soon as updatedAt falls behind the window cutoff.
ACTIVITY_GRAPHQL_QUERY = """
query($owner: String!, $name: String!, $states: [PullRequestState!]!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: $states, first: 100, after: $after, orderBy: {field: UPDATED_AT, direction: DESC}) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        number
        state
        updatedAt
        mergedAt
        mergedBy { __typename login }
        author { __typename login }
        authorAssociation
        reviews(last: 30, states: [APPROVED, CHANGES_REQUESTED, COMMENTED]) {
          nodes {
            submittedAt
            authorAssociation
            author { __typename login }
          }
        }
      }
    }
  }
}
"""


def run_cmd(cmd):
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        return None
    return res.stdout


def fetch_file_from_repo(owner, repo, path):
    out = run_cmd(["gh", "api", f"repos/{owner}/{repo}/contents/{path}"])
    if not out:
        return None
    try:
        data = json.loads(out)
        if "content" in data:
            return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
    except Exception:
        pass
    return None


def is_bot(actor):
    if not actor:
        return True
    if isinstance(actor, dict):
        if actor.get("__typename") == "Bot":
            return True
        login = actor.get("login")
    else:
        login = str(actor)
    if not login:
        return True
    low = login.lower()
    return (
        "[bot]" in low
        or "dependabot" in low
        or "renovate" in low
        or "copilot" in low
        or low in ("prombot", "cla-bot", "netlify", "codecov")
    )


def _extract_handles_from_line(line):
    """Extracts GitHub handles from a line, preferring github.com/<handle> links over @tokens."""
    gh_links = [
        h
        for h in re.findall(r"github\.com/([a-zA-Z0-9-]+)(?:[/?#)\]\s]|$)", line)
        if h.lower() not in RESERVED_GH_PATHS
    ]
    if gh_links:
        seen = []
        for h in gh_links:
            if h not in seen:
                seen.append(h)
        return seen

    # Strip inline code spans containing whitespace (such as CNCF Slack `@Full Name`)
    # before matching @handles so display names are not mistaken for GitHub logins.
    cleaned = re.sub(r"`[^`]*\s[^`]*`", " ", line)
    handles = re.findall(r"(?:^|[\s/(\[|`])@([a-zA-Z0-9-]+)", cleaned)
    seen = []
    for h in handles:
        if h not in seen:
            seen.append(h)
    return seen


def parse_maintainers_md(content):
    """Extracts general maintainers, path-specific rules, and all active maintainer handles."""
    general = []
    specific = []
    all_maintainers = []
    if not content:
        return general, specific, all_maintainers

    # Default to "general" so simple bullet or Markdown-table MAINTAINERS.md files
    # (such as client_golang, common, and thanos-io/thanos) work without specific headers.
    mode = "general"
    prefix_stack = []

    for line in content.splitlines():
        stripped = line.strip()
        low = stripped.lower()
        if not stripped:
            continue
        if low.startswith("general maintainers") or "core maintainers" in low:
            mode = "general"
            prefix_stack = []
            continue
        if low.startswith("maintainers for specific") or "named maintainers" in low:
            mode = "specific"
            prefix_stack = []
            continue
        if (
            low.startswith("v3 release")
            or low.startswith("release coordinators")
            or low.startswith("for the sake of")
            or (
                low.startswith("#")
                and any(
                    stop in low
                    for stop in ("triage", "alumni", "emeritus", "retired", "former")
                )
            )
            or low.startswith("emeritus")
        ):
            mode = None
            prefix_stack = []
            continue
        if mode is None:
            continue

        # Skip Markdown table separator rows (e.g. |---|---|).
        if stripped.startswith("|") and re.match(r"^\|[\s:|-]+\|?$", stripped):
            continue

        handles = _extract_handles_from_line(line)
        indent = len(line) - len(line.lstrip(" "))
        m_code = re.match(r"^\s*[-*]\s*`([^`]+)`", line)

        if m_code:
            token = m_code.group(1).strip("/")
            while prefix_stack and prefix_stack[-1][0] >= indent:
                prefix_stack.pop()
            prefix_stack.append((indent, token))
            full_path = "/".join(t for _, t in prefix_stack)
            if handles:
                specific.append((full_path, handles))
                for h in handles:
                    if h not in all_maintainers:
                        all_maintainers.append(h)
        elif handles and stripped.startswith(("*", "-", "|")):
            for h in handles:
                if mode == "general" and h not in general:
                    general.append(h)
                if h not in all_maintainers:
                    all_maintainers.append(h)

    return general, specific, all_maintainers


def parse_codeowners(content):
    """Parses CODEOWNERS into default owners, path rules, and all individual handles."""
    rules = []
    default_individuals = []
    all_individuals = []
    if not content:
        return default_individuals, rules, all_individuals

    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        pattern = parts[0]
        raw_owners = [o.lstrip("@") for o in parts[1:] if o.startswith("@")]
        indiv = [o for o in raw_owners if "/" not in o]
        teams = [o for o in raw_owners if "/" in o]
        for i in indiv:
            if i not in all_individuals:
                all_individuals.append(i)
        if pattern == "*":
            for i in indiv:
                if i not in default_individuals:
                    default_individuals.append(i)
        else:
            rules.append((pattern.lstrip("/"), indiv, teams))
    return default_individuals, rules, all_individuals


def parse_owners_yaml(owners_content, aliases_content=""):
    """Parses Kubernetes/Prow-style OWNERS and OWNERS_ALIASES files for approvers."""
    if not owners_content:
        return []

    aliases = {}
    if aliases_content:
        current_alias = None
        in_aliases = False
        for raw in aliases_content.splitlines():
            line = raw.split("#", 1)[0].rstrip()
            stripped = line.strip()
            if not stripped:
                continue
            indent = len(line) - len(line.lstrip(" "))
            if indent == 0:
                in_aliases = stripped.startswith("aliases:")
                current_alias = None
                continue
            if not in_aliases:
                continue
            if stripped.endswith(":") and not stripped.startswith("-"):
                current_alias = stripped[:-1].strip()
                aliases.setdefault(current_alias, [])
            elif stripped.startswith("-") and current_alias:
                val = stripped[1:].strip().lstrip("@")
                if val:
                    aliases[current_alias].append(val)

    approvers = []
    in_approvers = False
    for raw in owners_content.splitlines():
        line = raw.split("#", 1)[0].rstrip()
        stripped = line.strip()
        if 
```

### Core Architecture Module: `discovery/util.go`
```
// Copyright The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package discovery

import (
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
)

// MetricRegisterer is used by implementations of discovery.Discoverer that need
// to manage the lifetime of their metrics.
type MetricRegisterer interface {
	RegisterMetrics() error
	UnregisterMetrics()
}

// metricRegistererImpl is an implementation of MetricRegisterer.
type metricRegistererImpl struct {
	reg     prometheus.Registerer
	metrics []prometheus.Collector
}

var _ MetricRegisterer = &metricRegistererImpl{}

// NewMetricRegisterer creates an instance of a MetricRegisterer.
// Typically called inside the implementation of the NewDiscoverer() method.
func NewMetricRegisterer(reg prometheus.Registerer, metrics []prometheus.Collector) MetricRegisterer {
	return &metricRegistererImpl{
		reg:     reg,
		metrics: metrics,
	}
}

// RegisterMetrics registers the metrics with a Prometheus registerer.
// If any metric fails to register, it will unregister all metrics that
// were registered so far, and return an error.
// Typically called at the start of the SD's Run() method.
func (rh *metricRegistererImpl) RegisterMetrics() error {
	for _, collector := range rh.metrics {
		err := rh.reg.Register(collector)
		if err != nil {
			// Unregister all metrics that were registered so far.
			// This is so that if RegisterMetrics() gets called again,
			// there will not be an error due to a duplicate registration.
			rh.UnregisterMetrics()

			return fmt.Errorf("failed to register metric: %w", err)
		}
	}
	return nil
}

// UnregisterMetrics unregisters the metrics from the same Prometheus
// registerer which was used to register them.
// Typically called at the end of the SD's Run() method by a defer statement.
func (rh *metricRegistererImpl) UnregisterMetrics() {
	for _, collector := range rh.metrics {
		rh.reg.Unregister(collector)
	}
}

```

### Core Architecture Module: `notifier/sendloop.go`
```
// Copyright The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package notifier

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/prometheus/config"
)

type sendLoop struct {
	alertmanagerURL string

	cfg    *config.AlertmanagerConfig
	client *http.Client
	opts   *Options

	metrics *alertMetrics

	mtx      sync.RWMutex
	queue    []*Alert
	hasWork  chan struct{}
	stopped  chan struct{}
	stopOnce sync.Once

	logger *slog.Logger
}

func newSendLoop(
	alertmanagerURL string,
	client *http.Client,
	cfg *config.AlertmanagerConfig,
	opts *Options,
	logger *slog.Logger,
	metrics *alertMetrics,
) *sendLoop {
	// This will initialize the Counters for the AM to 0 and set the static queue capacity gauge.
	metrics.dropped.WithLabelValues(alertmanagerURL)
	metrics.errors.WithLabelValues(alertmanagerURL)
	metrics.sent.WithLabelValues(alertmanagerURL)
	metrics.queueLength.WithLabelValues(alertmanagerURL)

	return &sendLoop{
		alertmanagerURL: alertmanagerURL,
		client:          client,
		cfg:             cfg,
		opts:            opts,
		logger:          logger,
		metrics:         metrics,
		queue:           make([]*Alert, 0, opts.QueueCapacity),
		hasWork:         make(chan struct{}, 1),
		stopped:         make(chan struct{}),
	}
}

func (s *sendLoop) add(alerts ...*Alert) {
	select {
	case <-s.stopped:
		return
	default:
	}

	s.mtx.Lock()
	defer s.mtx.Unlock()

	var dropped int
	// Queue capacity should be significantly larger than a single alert
	// batch could be.
	if d := len(alerts) - s.opts.QueueCapacity; d > 0 {
		s.logger.Warn("Alert batch larger than queue capacity, dropping alerts", "count", d)
		dropped += d
		alerts = alerts[d:]
	}

	// If the queue is full, remove the oldest alerts in favor
	// of newer ones.
	if d := (len(s.queue) + len(alerts)) - s.opts.QueueCapacity; d > 0 {
		s.logger.Warn("Alert notification queue full, dropping alerts", "count", d)
		dropped += d
		s.queue = s.queue[d:]
	}

	s.queue = append(s.queue, alerts...)

	// Notify sending goroutine that there are alerts to be processed.
	// If we cannot send on the channel, it means the signal already exists
	// and has not been consumed yet.
	s.notifyWork()

	s.metrics.queueLength.WithLabelValues(s.alertmanagerURL).Set(float64(len(s.queue)))
	if dropped > 0 {
		s.metrics.dropped.WithLabelValues(s.alertmanagerURL).Add(float64(dropped))
	}
}

func (s *sendLoop) notifyWork() {
	select {
	case <-s.stopped:
		return
	case s.hasWork <- struct{}{}:
	default:
	}
}

func (s *sendLoop) stop() {
	s.stopOnce.Do(func() {
		s.logger.Debug("Stopping send loop")
		close(s.stopped)

		if s.opts.DrainOnShutdown {
			s.drainQueue()
		} else {
			ql := s.queueLen()
			s.logger.Warn("Alert notification queue not drained on shutdown, dropping alerts", "count", ql)
			s.metrics.dropped.WithLabelValues(s.alertmanagerURL).Add(float64(ql))
		}

		s.metrics.latencySummary.DeleteLabelValues(s.alertmanagerURL)
		s.metrics.latencyHistogram.DeleteLabelValues(s.alertmanagerURL)
		s.metrics.sent.DeleteLabelValues(s.alertmanagerURL)
		s.metrics.dropped.DeleteLabelValues(s.alertmanagerURL)
		s.metrics.errors.DeleteLabelValues(s.alertmanagerURL)
		s.metrics.queueLength.DeleteLabelValues(s.alertmanagerURL)
	})
}

func (s *sendLoop) drainQueue() {
	for s.queueLen() > 0 {
		s.sendOneBatch()
	}
}

func (s *sendLoop) queueLen() int {
	s.mtx.RLock()
	defer s.mtx.RUnlock()

	return len(s.queue)
}

func (s *sendLoop) nextBatch() []*Alert {
	s.mtx.Lock()
	defer s.mtx.Unlock()

	var alerts []*Alert
	if maxBatchSize := s.opts.MaxBatchSize; len(s.queue) > maxBatchSize {
		alerts = append(make([]*Alert, 0, maxBatchSize), s.queue[:maxBatchSize]...)
		s.queue = s.queue[maxBatchSize:]
	} else {
		alerts = append(make([]*Alert, 0, len(s.queue)), s.queue...)
		s.queue = s.queue[:0]
	}
	s.metrics.queueLength.WithLabelValues(s.alertmanagerURL).Set(float64(len(s.queue)))

	return alerts
}

func (s *sendLoop) sendOneBatch() {
	alerts := s.nextBatch()

	if !s.sendAll(alerts) {
		s.metrics.dropped.WithLabelValues(s.alertmanagerURL).Add(float64(len(alerts)))
	}
}

// loop continuously consumes the notifications queue and sends alerts to
// the Alertmanager.
func (s *sendLoop) loop() {
	s.logger.Debug("Starting send loop")
	for {
		// If we've been asked to stop, that takes priority over sending any further notifications.
		select {
		case <-s.stopped:
			return
		default:
			select {
			case <-s.stopped:
				return
			case <-s.hasWork:
				s.sendOneBatch()

				// If the queue still has items left, kick off the next iteration.
				if s.queueLen() > 0 {
					s.notifyWork()
				}
			}
		}
	}
}

func (s *sendLoop) sendAll(alerts []*Alert) bool {
	if len(alerts) == 0 {
		return true
	}

	begin := time.Now()

	var payload []byte
	var err error
	switch s.cfg.APIVersion {
	case config.AlertmanagerAPIVersionV2:
		openAPIAlerts := alertsToOpenAPIAlerts(alerts)
		payload, err = json.Marshal(openAPIAlerts)
		if err != nil {
			s.logger.Error("Encoding alerts for Alertmanager API v2 failed", "err", err)
			return false
		}

	default:
		s.logger.Error(
			fmt.Sprintf("Invalid Alertmanager API version '%v', expected one of '%v'", s.cfg.APIVersion, config.SupportedAlertmanagerAPIVersions),
			"err", err,
		)
		return false
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(s.cfg.Timeout))
	defer cancel()

	if err := s.sendOne(ctx, s.client, s.alertmanagerURL, payload); err != nil {
		s.logger.Error("Error sending alerts", "count", len(alerts), "err", err)
		s.metrics.errors.WithLabelValues(s.alertmanagerURL).Add(float64(len(alerts)))
		return false
	}
	durationSeconds := time.Since(begin).Seconds()
	s.metrics.latencySummary.WithLabelValues(s.alertmanagerURL).Observe(durationSeconds)
	s.metrics.latencyHistogram.WithLabelValues(s.alertmanagerURL).Observe(durationSeconds)
	s.metrics.sent.WithLabelValues(s.alertmanagerURL).Add(float64(len(alerts)))

	return true
}

func (s *sendLoop) sendOne(ctx context.Context, c *http.Client, url string, b []byte) error {
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Content-Type", contentTypeJSON)
	resp, err := s.opts.Do(ctx, c, req)
	if err != nil {
		return err
	}
	defer func() {
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}()

	// Any HTTP status 2xx is OK.
	if resp.StatusCode/100 != 2 {
		return fmt.Errorf("bad response status %s", resp.Status)
	}

	return nil
}

```

### Core Architecture Module: `notifier/util.go`
```
// Copyright The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package notifier

import (
	"github.com/go-openapi/strfmt"
	"github.com/prometheus/alertmanager/api/v2/models"

	"github.com/prometheus/prometheus/model/labels"
)

func alertsToOpenAPIAlerts(alerts []*Alert) models.PostableAlerts {
	openAPIAlerts := models.PostableAlerts{}
	for _, a := range alerts {
		start := strfmt.DateTime(a.StartsAt)
		end := strfmt.DateTime(a.EndsAt)
		openAPIAlerts = append(openAPIAlerts, &models.PostableAlert{
			Annotations: labelsToOpenAPILabelSet(a.Annotations),
			EndsAt:      end,
			StartsAt:    start,
			Alert: models.Alert{
				GeneratorURL: strfmt.URI(a.GeneratorURL),
				Labels:       labelsToOpenAPILabelSet(a.Labels),
			},
		})
	}

	return openAPIAlerts
}

func labelsToOpenAPILabelSet(modelLabelSet labels.Labels) models.LabelSet {
	apiLabelSet := models.LabelSet{}
	modelLabelSet.Range(func(label labels.Label) {
		apiLabelSet[label.Name] = label.Value
	})

	return apiLabelSet
}

```

### Core Architecture Module: `promql/engine.go`
```
// Copyright The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package promql

import (
	"bytes"
	"container/heap"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"maps"
	"math"
	"reflect"
	"runtime"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"github.com/prometheus/common/promslog"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/timestamp"
	"github.com/prometheus/prometheus/model/value"
	"github.com/prometheus/prometheus/promql/parser"
	"github.com/prometheus/prometheus/promql/parser/posrange"
	"github.com/prometheus/prometheus/schema"
	"github.com/prometheus/prometheus/storage"
	"github.com/prometheus/prometheus/tsdb/chunkenc"
	"github.com/prometheus/prometheus/util/annotations"
	"github.com/prometheus/prometheus/util/features"
	"github.com/prometheus/prometheus/util/kahansum"
	"github.com/prometheus/prometheus/util/logging"
	"github.com/prometheus/prometheus/util/stats"
	"github.com/prometheus/prometheus/util/zeropool"
)

const (
	namespace            = "prometheus"
	subsystem            = "engine"
	queryTag             = "query"
	env                  = "query execution"
	defaultLookbackDelta = 5 * time.Minute

	// The largest SampleValue that can be converted to an int64 without overflow.
	maxInt64 = 9223372036854774784
	// The smallest SampleValue that can be converted to an int64 without underflow.
	minInt64 = -9223372036854775808

	// Max initial size for the pooled points slices.
	// The getHPointSlice and getFPointSlice functions are called with an estimated size which often can be
	// over-estimated.
	maxPointsSliceSize = 5000

	// The default buffer size for points used by the matrix selector.
	matrixSelectorSliceSize = 16
)

type engineMetrics struct {
	currentQueries            prometheus.Gauge
	maxConcurrentQueries      prometheus.Gauge
	queryLogEnabled           prometheus.Gauge
	queryLogFailures          prometheus.Counter
	queryQueueTime            prometheus.Observer
	queryQueueTimeHistogram   prometheus.Observer
	queryPrepareTime          prometheus.Observer
	queryPrepareTimeHistogram prometheus.Observer
	queryInnerEval            prometheus.Observer
	queryInnerEvalHistogram   prometheus.Observer
	queryResultSort           prometheus.Observer
	queryResultSortHistogram  prometheus.Observer
	querySamples              prometheus.Counter
	querySamplesRead          prometheus.Counter
	queryRejectedTotal        *prometheus.CounterVec
	querySeriesTouched        prometheus.Histogram
	querySamplesReadHistogram prometheus.Histogram
}

type (
	// ErrQueryTimeout is returned if a query timed out during processing.
	ErrQueryTimeout string
	// ErrQueryCanceled is returned if a query was canceled during processing.
	ErrQueryCanceled string
	// ErrTooManySamples is returned if a query would load more than the maximum allowed samples into memory.
	ErrTooManySamples string
	// ErrTooManySeries is returned if a query would load more than the maximum allowed series into memory.
	ErrTooManySeries string
	// ErrTooManySamplesRead is returned if a query would read more than the maximum allowed samples.
	ErrTooManySamplesRead string
	// ErrStorage is returned if an error was encountered in the storage layer
	// during query handling.
	ErrStorage struct{ Err error }
)

func (e ErrQueryTimeout) Error() string {
	return fmt.Sprintf("query timed out in %s", string(e))
}

func (e ErrQueryCanceled) Error() string {
	return fmt.Sprintf("query was canceled in %s", string(e))
}

func (e ErrTooManySamples) Error() string {
	return fmt.Sprintf("query processing would load too many samples into memory in %s", string(e))
}

// Error implements the error interface.
func (e ErrTooManySeries) Error() string {
	return fmt.Sprintf("query would load too many series into memory in %s", string(e))
}

// Error implements the error interface.
func (e ErrTooManySamplesRead) Error() string {
	return fmt.Sprintf("query would read too many samples in %s", string(e))
}

func (e ErrStorage) Error() string {
	return e.Err.Error()
}

// ErrLimitAboveCeiling is returned when a per-query limit override asks for a
// value above the operator-set ceiling for that limit. A per-query override may
// only tighten a ceiling, so such a request is rejected rather than silently
// clamped down, making it clear to the caller that the limit it asked for was
// not applied. Callers exposing the engine over an API should map it to a
// client error, e.g. HTTP 400.
type ErrLimitAboveCeiling struct {
	// Limit is the name of the limit as the client spells it, e.g. "max_series".
	Limit string
	// Requested is the value the client asked for, already formatted for display.
	Requested string
	// Ceiling is the operator-set ceiling that the request exceeded, already
	// formatted for display.
	Ceiling string
}

// Error implements the error interface.
func (e ErrLimitAboveCeiling) Error() string {
	return fmt.Sprintf("requested %s of %s exceeds the server limit of %s", e.Limit, e.Requested, e.Ceiling)
}

// QueryEngine defines the interface for the *promql.Engine, so it can be replaced, wrapped or mocked.
type QueryEngine interface {
	NewInstantQuery(ctx context.Context, q storage.Queryable, opts QueryOpts, qs string, ts time.Time) (Query, error)
	NewRangeQuery(ctx context.Context, q storage.Queryable, opts QueryOpts, qs string, start, end time.Time, interval time.Duration) (Query, error)
}

var _ QueryLogger = (*logging.JSONFileLogger)(nil)

// QueryLogger is an interface that can be used to log all the queries logged
// by the engine.
// logging.JSONFileLogger implements this interface, downstream users may use
// different implementations.
type QueryLogger interface {
	slog.Handler
	io.Closer
}

// A Query is derived from a raw query string and can be run against an engine
// it is associated with.
type Query interface {
	// Exec processes the query. Can only be called once.
	Exec(ctx context.Context) *Result
	// Close recovers memory used by the query result.
	Close()
	// Statement returns the parsed statement of the query.
	Statement() parser.Statement
	// Stats returns statistics about the lifetime of the query.
	Stats() *stats.Statistics
	// Cancel signals that a running query execution should be aborted.
	Cancel()
	// String returns the original query string.
	String() string
}

type PrometheusQueryOpts struct {
	// Enables recording per-step statistics if the engine has it enabled as well. Disabled by default.
	enablePerStepStats bool
	// Lookback delta duration for this query.
	lookbackDelta time.Duration
	// Enables start timestamp usage in functions such as rate().
	useStartTimestamps *bool
	// Per-query override for the maximum number of series the query may touch.
	// Zero means no per-query override. It can only lower the operator-set
	// ceiling, never raise it. It is only honored when the query-cost feature
	// is enabled.
	maxSeries uint64
	// Per-query override for the maximum number of samples the query may read.
	// Zero means no per-query override. It can only lower the operator-set
	// ceiling, never raise it. It is only honored when the query-cost feature
	// is enabled.
	maxSamplesRead uint64
	// Per-query override for the maximum wall-clock duration of the query.
	// Zero means no per-query override. It can only lower the operator-set
	// ceiling, never raise it. It is only honored when the query-cost feature
	// is enabled.
	maxQueryDuration time.Duration
}

var _ QueryOpts = &PrometheusQueryOpts{}

func NewPrometheusQueryOpts(enablePerStepStats bool, lookbackDelta time.Duration, useStartTimestamps *bool) QueryOpts {
	var useStartTimestampsCopy *bool
	if useStartTimestamps != nil {
		val := *useStartTimestamps
		useStartTimestampsCopy = &val
	}
	return &PrometheusQueryOpts{
		enablePerStepStats: enablePerStepStats,
		lookbackDelta:      lookbackDelta,
		useStartTimestamps: useStartTimestampsCopy,
	}
}

// NewPrometheusQueryOptsWithLimits returns a QueryOpts that also carries
// per-query cost-limit overrides. The limit overrides may only lower the
// operator-set ceiling and are only honored when the query-cost feature is
// enabled.
func NewPrometheusQueryOptsWithLimits(enablePerStepStats bool, lookbackDelta time.Duration, maxSeries, maxSamplesRead uint64, maxQueryDuration time.Duration, useStartTimestamps *bool) QueryOpts {
	opts := NewPrometheusQueryOpts(enablePerStepStats, lookbackDelta, useStartTimestamps).(*PrometheusQueryOpts)
	opts.maxSeries = maxSeries
	opts.maxSamplesRead = maxSamplesRead
	opts.maxQueryDuration = maxQueryDuration
	return opts
}

func (p *PrometheusQueryOpts) EnablePerStepStats() bool {
	return p.enablePerStepStats
}

func (p *PrometheusQueryOpts) LookbackDelta() time.Duration {
	return p.lookbackDelta
}

func (p *PrometheusQueryOpts) UseStartTimestamps() *bool {
	return p.useStartTimestamps
}

// PrometheusQueryOpts carries the per-query cost overrides, so it satisfies
// QueryCostOpts as well as QueryOpts.
var _ QueryCostOpts = &PrometheusQueryOpts{}

// MaxSeries returns the per-query series limit override.
func (p *PrometheusQueryOpts) MaxSeries() uint64 {
	return p.maxSeries
}

// MaxSamplesRead returns the per-query sample read limit override.
func (p *PrometheusQueryOp
```

### Core Architecture Module: `storage/remote/queue_manager.go`
```
// Copyright The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package remote

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"
	"unique"

	"github.com/gogo/protobuf/proto"
	remoteapi "github.com/prometheus/client_golang/exp/api/remote"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/model"
	"github.com/prometheus/common/promslog"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/atomic"

	"github.com/prometheus/prometheus/config"
	"github.com/prometheus/prometheus/model/histogram"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/metadata"
	"github.com/prometheus/prometheus/model/relabel"
	"github.com/prometheus/prometheus/model/timestamp"
	"github.com/prometheus/prometheus/model/value"
	"github.com/prometheus/prometheus/prompb"
	writev2 "github.com/prometheus/prometheus/prompb/io/prometheus/write/v2"
	"github.com/prometheus/prometheus/schema"
	"github.com/prometheus/prometheus/scrape"
	"github.com/prometheus/prometheus/tsdb/chunks"
	"github.com/prometheus/prometheus/tsdb/record"
	"github.com/prometheus/prometheus/tsdb/wlog"
	"github.com/prometheus/prometheus/util/compression"
)

const (
	// We track samples in/out and how long pushes take using an Exponentially
	// Weighted Moving Average.
	ewmaWeight          = 0.2
	shardUpdateDuration = 10 * time.Second

	// Allow 30% too many shards before scaling down.
	shardToleranceFraction = 0.3

	reasonTooOld                     = "too_old"
	reasonDroppedSeries              = "dropped_series"
	reasonUnintentionalDroppedSeries = "unintentionally_dropped_series"
	reasonNHCBNotSupported           = "nhcb_in_rw1_not_supported"
	reasonNHCBConversionError        = "nhcb_to_classic_conversion_error"
	reasonClassicHistogramNotAllowed = "classic_histogram_not_allowed"
	reasonDetachedExemplarNotAllowed = "detached_exemplar_not_allowed"
	reasonMissingMetadataType        = "missing_metadata_type"
	reasonMissingStartTimestamp      = "missing_start_timestamp"
)

type queueManagerMetrics struct {
	reg prometheus.Registerer

	samplesTotal           prometheus.Counter
	exemplarsTotal         prometheus.Counter
	histogramsTotal        prometheus.Counter
	metadataTotal          prometheus.Counter
	failedSamplesTotal     prometheus.Counter
	failedExemplarsTotal   prometheus.Counter
	failedHistogramsTotal  prometheus.Counter
	failedMetadataTotal    prometheus.Counter
	retriedSamplesTotal    prometheus.Counter
	retriedExemplarsTotal  prometheus.Counter
	retriedHistogramsTotal prometheus.Counter
	retriedMetadataTotal   prometheus.Counter
	droppedSamplesTotal    *prometheus.CounterVec
	droppedExemplarsTotal  *prometheus.CounterVec
	droppedHistogramsTotal *prometheus.CounterVec
	enqueueRetriesTotal    prometheus.Counter
	sentBatchDuration      prometheus.Histogram
	highestTimestamp       *maxTimestamp
	highestSentTimestamp   *maxTimestamp
	pendingSamples         prometheus.Gauge
	pendingExemplars       prometheus.Gauge
	pendingHistograms      prometheus.Gauge
	shardCapacity          prometheus.Gauge
	numShards              prometheus.Gauge
	maxNumShards           prometheus.Gauge
	minNumShards           prometheus.Gauge
	desiredNumShards       prometheus.Gauge
	sentBytesTotal         prometheus.Counter
	metadataBytesTotal     prometheus.Counter
	maxSamplesPerSend      prometheus.Gauge

	samplesMetadataTotal    *prometheus.CounterVec
	histogramsMetadataTotal *prometheus.CounterVec
}

func newQueueManagerMetrics(r prometheus.Registerer, rn, e string) *queueManagerMetrics {
	m := &queueManagerMetrics{
		reg: r,
	}
	constLabels := prometheus.Labels{
		remoteName: rn,
		endpoint:   e,
	}

	m.samplesTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "samples_total",
		Help:        "Total number of samples sent to remote storage.",
		ConstLabels: constLabels,
	})
	m.samplesMetadataTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "samples_metadata_total",
		Help:        "Total number of samples sent to remote storage using Remote Write 2.0 with the specified metadata field set.",
		ConstLabels: constLabels,
	}, []string{"field"})
	m.exemplarsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "exemplars_total",
		Help:        "Total number of exemplars sent to remote storage.",
		ConstLabels: constLabels,
	})
	m.histogramsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "histograms_total",
		Help:        "Total number of histograms sent to remote storage.",
		ConstLabels: constLabels,
	})
	m.histogramsMetadataTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "histograms_metadata_total",
		Help:        "Total number of histograms sent to remote storage using Remote Write 2.0 with the specified metadata field set.",
		ConstLabels: constLabels,
	}, []string{"field"})
	for _, field := range []string{metadataFieldType, metadataFieldUnit, metadataFieldHelp} {
		m.samplesMetadataTotal.WithLabelValues(field)
		m.histogramsMetadataTotal.WithLabelValues(field)
	}
	m.metadataTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "metadata_total",
		Help:        "Total number of metadata entries sent to remote storage. Deprecated: This metric only applies to Remote Write 1.0.",
		ConstLabels: constLabels,
	})
	m.failedSamplesTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "samples_failed_total",
		Help:        "Total number of samples which failed on send to remote storage, non-recoverable errors.",
		ConstLabels: constLabels,
	})
	m.failedExemplarsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "exemplars_failed_total",
		Help:        "Total number of exemplars which failed on send to remote storage, non-recoverable errors.",
		ConstLabels: constLabels,
	})
	m.failedHistogramsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "histograms_failed_total",
		Help:        "Total number of histograms which failed on send to remote storage, non-recoverable errors.",
		ConstLabels: constLabels,
	})
	m.failedMetadataTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "metadata_failed_total",
		Help:        "Total number of metadata entries which failed on send to remote storage, non-recoverable errors. Deprecated: This metric only applies to Remote Write 1.0.",
		ConstLabels: constLabels,
	})
	m.retriedSamplesTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "samples_retried_total",
		Help:        "Total number of samples which failed on send to remote storage but were retried because the send error was recoverable.",
		ConstLabels: constLabels,
	})
	m.retriedExemplarsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "exemplars_retried_total",
		Help:        "Total number of exemplars which failed on send to remote storage but were retried because the send error was recoverable.",
		ConstLabels: constLabels,
	})
	m.retriedHistogramsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "histograms_retried_total",
		Help:        "Total number of histograms which failed on send to remote storage but were retried because the send error was recoverable.",
		ConstLabels: constLabels,
	})
	m.retriedMetadataTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "metadata_retried_total",
		Help:        "Total number of metadata entries which failed on send to remote storage but were retried because the send error was recoverable. Deprecated: This metric only applies to Remote Write 1.0.",
		ConstLabels: constLabels,
	})
	m.droppedSamplesTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "samples_dropped_total",
		Help:        "Total number of samples which were dropped after being read from the WAL before being sent via remote write, either via relabelling, due to being too old or unintentionally because of an unknown reference ID.",
		ConstLabels: constLabels,
	}, []string{"reason"})
	m.droppedExemplarsTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "exemplars_dropped_total",
		Help:        "Total number of exemplars which were dropped after being read from the WAL before being sent via remote write, either via relabelling, due to being too old or unintentionally because of an unknown reference ID.",
		ConstLabels: constLabels,
	}, []string{"reason"})
	m.droppedHistogramsTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace:
```

### Core Architecture Module: `tsdb/chunks/chunk_write_queue.go`
```
// Copyright The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package chunks

import (
	"errors"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/prometheus/prometheus/tsdb/chunkenc"
)

const (
	// Minimum recorded peak since the last shrinking of chunkWriteQueue.chunkRefMap to shrink it again.
	chunkRefMapShrinkThreshold = 1000

	// Minimum interval between shrinking of chunkWriteQueue.chunkRefMap.
	chunkRefMapMinShrinkInterval = 10 * time.Minute

	// Maximum size of segment used by job queue (number of elements). With chunkWriteJob being 64 bytes,
	// this will use ~512 KiB for empty queue.
	maxChunkQueueSegmentSize = 8192
)

type chunkWriteJob struct {
	seriesRef HeadSeriesRef
	mint      int64
	maxt      int64
	chk       chunkenc.Chunk
	ref       ChunkDiskMapperRef
	cutFile   bool
	isOOO     bool
	callback  func(error)
}

// chunkWriteQueue is a queue for writing chunks to disk in a non-blocking fashion.
// Chunks that shall be written get added to the queue, which is consumed asynchronously.
// Adding jobs to the queue is non-blocking as long as the queue isn't full.
type chunkWriteQueue struct {
	jobs *writeJobQueue

	chunkRefMapMtx        sync.RWMutex
	chunkRefMap           map[ChunkDiskMapperRef]chunkenc.Chunk
	chunkRefMapPeakSize   int       // Largest size that chunkRefMap has grown to since the last time we shrank it.
	chunkRefMapLastShrink time.Time // When the chunkRefMap has been shrunk the last time.

	// isRunningMtx serves two purposes:
	// 1. It protects isRunning field.
	// 2. It serializes adding of jobs to the chunkRefMap in addJob() method. If jobs channel is full then addJob() will block
	// while holding this mutex, which guarantees that chunkRefMap won't ever grow beyond the queue size + 1.
	isRunningMtx sync.Mutex
	isRunning    bool // Used to prevent that new jobs get added to the queue when the chan is already closed.

	workerWg sync.WaitGroup

	writeChunk writeChunkF

	// Keeping separate counters instead of only a single CounterVec to improve the performance of the critical
	// addJob() method which otherwise would need to perform a WithLabelValues call on the CounterVec.
	adds      prometheus.Counter
	gets      prometheus.Counter
	completed prometheus.Counter
	shrink    prometheus.Counter
}

// writeChunkF is a function which writes chunks, it is dynamic to allow mocking in tests.
type writeChunkF func(HeadSeriesRef, int64, int64, chunkenc.Chunk, ChunkDiskMapperRef, bool, bool) error

func newChunkWriteQueue(reg prometheus.Registerer, size int, writeChunk writeChunkF) *chunkWriteQueue {
	counters := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "prometheus_tsdb_chunk_write_queue_operations_total",
			Help: "Number of operations on the chunk_write_queue.",
		},
		[]string{"operation"},
	)

	segmentSize := min(size, maxChunkQueueSegmentSize)

	q := &chunkWriteQueue{
		jobs:                  newWriteJobQueue(size, segmentSize),
		chunkRefMap:           make(map[ChunkDiskMapperRef]chunkenc.Chunk),
		chunkRefMapLastShrink: time.Now(),
		writeChunk:            writeChunk,

		adds:      counters.WithLabelValues("add"),
		gets:      counters.WithLabelValues("get"),
		completed: counters.WithLabelValues("complete"),
		shrink:    counters.WithLabelValues("shrink"),
	}

	if reg != nil {
		reg.MustRegister(counters)
	}

	q.start()
	return q
}

func (c *chunkWriteQueue) start() {
	c.workerWg.Go(func() {
		for {
			job, ok := c.jobs.pop()
			if !ok {
				return
			}

			c.processJob(job)
		}
	})

	c.isRunningMtx.Lock()
	c.isRunning = true
	c.isRunningMtx.Unlock()
}

func (c *chunkWriteQueue) processJob(job chunkWriteJob) {
	err := c.writeChunk(job.seriesRef, job.mint, job.maxt, job.chk, job.ref, job.isOOO, job.cutFile)
	if job.callback != nil {
		job.callback(err)
	}

	c.chunkRefMapMtx.Lock()
	defer c.chunkRefMapMtx.Unlock()

	delete(c.chunkRefMap, job.ref)

	c.completed.Inc()

	c.shrinkChunkRefMap()
}

// shrinkChunkRefMap checks whether the conditions to shrink the chunkRefMap are met,
// if so chunkRefMap is reinitialized. The chunkRefMapMtx must be held when calling this method.
//
// We do this because Go runtime doesn't release internal memory used by map after map has been emptied.
// To achieve that we create new map instead and throw the old one away.
func (c *chunkWriteQueue) shrinkChunkRefMap() {
	if len(c.chunkRefMap) > 0 {
		// Can't shrink it while there is data in it.
		return
	}

	if c.chunkRefMapPeakSize < chunkRefMapShrinkThreshold {
		// Not shrinking it because it has not grown to the minimum threshold yet.
		return
	}

	now := time.Now()

	if now.Sub(c.chunkRefMapLastShrink) < chunkRefMapMinShrinkInterval {
		// Not shrinking it because the minimum duration between shrink-events has not passed yet.
		return
	}

	// Re-initialize the chunk ref map to half of the peak size that it has grown to since the last re-init event.
	// We are trying to hit the sweet spot in the trade-off between initializing it to a very small size
	// potentially resulting in many allocations to re-grow it, and initializing it to a large size potentially
	// resulting in unused allocated memory.
	c.chunkRefMap = make(map[ChunkDiskMapperRef]chunkenc.Chunk, c.chunkRefMapPeakSize/2)

	c.chunkRefMapPeakSize = 0
	c.chunkRefMapLastShrink = now
	c.shrink.Inc()
}

func (c *chunkWriteQueue) addJob(job chunkWriteJob) (err error) {
	defer func() {
		if err == nil {
			c.adds.Inc()
		}
	}()

	c.isRunningMtx.Lock()
	defer c.isRunningMtx.Unlock()

	if !c.isRunning {
		return errors.New("queue is not running")
	}

	c.chunkRefMapMtx.Lock()
	c.chunkRefMap[job.ref] = job.chk

	// Keep track of the peak usage of c.chunkRefMap.
	if len(c.chunkRefMap) > c.chunkRefMapPeakSize {
		c.chunkRefMapPeakSize = len(c.chunkRefMap)
	}
	c.chunkRefMapMtx.Unlock()

	if ok := c.jobs.push(job); !ok {
		c.chunkRefMapMtx.Lock()
		delete(c.chunkRefMap, job.ref)
		c.chunkRefMapMtx.Unlock()

		return errors.New("queue is closed")
	}

	return nil
}

func (c *chunkWriteQueue) get(ref ChunkDiskMapperRef) chunkenc.Chunk {
	c.chunkRefMapMtx.RLock()
	defer c.chunkRefMapMtx.RUnlock()

	chk, ok := c.chunkRefMap[ref]
	if ok {
		c.gets.Inc()
	}

	return chk
}

func (c *chunkWriteQueue) stop() {
	c.isRunningMtx.Lock()
	defer c.isRunningMtx.Unlock()

	if !c.isRunning {
		return
	}

	c.isRunning = false

	c.jobs.close()

	c.workerWg.Wait()
}

func (c *chunkWriteQueue) queueIsEmpty() bool {
	return c.queueSize() == 0
}

func (c *chunkWriteQueue) queueIsFull() bool {
	// When the queue is full and blocked on the writer the chunkRefMap has one more job than the cap of the jobCh
	// because one job is currently being processed and blocked in the writer.
	return c.queueSize() == c.jobs.maxSize+1
}

func (c *chunkWriteQueue) queueSize() int {
	c.chunkRefMapMtx.Lock()
	defer c.chunkRefMapMtx.Unlock()

	// Looking at chunkRefMap instead of jobCh because the job is popped from the chan before it has
	// been fully processed, it remains in the chunkRefMap until the processing is complete.
	return len(c.chunkRefMap)
}

```

### Core Architecture Module: `tsdb/chunks/queue.go`
```
// Copyright The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package chunks

import "sync"

// writeJobQueue is similar to buffered channel of chunkWriteJob, but manages its own buffers
// to avoid using a lot of memory when it's empty. It does that by storing elements into segments
// of equal size (segmentSize). When segment is not used anymore, reference to it are removed,
// so it can be treated as a garbage.
type writeJobQueue struct {
	maxSize     int
	segmentSize int

	mtx            sync.Mutex            // protects all following variables
	pushed, popped *sync.Cond            // signalled when something is pushed into the queue or popped from it
	first, last    *writeJobQueueSegment // pointer to first and last segment, if any
	size           int                   // total size of the queue
	closed         bool                  // after closing the queue, nothing can be pushed to it
}

type writeJobQueueSegment struct {
	segment             []chunkWriteJob
	nextRead, nextWrite int                   // index of next read and next write in this segment.
	nextSegment         *writeJobQueueSegment // next segment, if any
}

func newWriteJobQueue(maxSize, segmentSize int) *writeJobQueue {
	if maxSize <= 0 || segmentSize <= 0 {
		panic("invalid queue")
	}

	q := &writeJobQueue{
		maxSize:     maxSize,
		segmentSize: segmentSize,
	}

	q.pushed = sync.NewCond(&q.mtx)
	q.popped = sync.NewCond(&q.mtx)
	return q
}

func (q *writeJobQueue) close() {
	q.mtx.Lock()
	defer q.mtx.Unlock()

	q.closed = true

	// Unblock all blocked goroutines.
	q.pushed.Broadcast()
	q.popped.Broadcast()
}

// push blocks until there is space available in the queue, and then adds job to the queue.
// If queue is closed or gets closed while waiting for space, push returns false.
func (q *writeJobQueue) push(job chunkWriteJob) bool {
	q.mtx.Lock()
	defer q.mtx.Unlock()

	// Wait until queue has more space or is closed.
	for !q.closed && q.size >= q.maxSize {
		q.popped.Wait()
	}

	if q.closed {
		return false
	}

	// Check if this segment has more space for writing, and create new one if not.
	if q.last == nil || q.last.nextWrite >= q.segmentSize {
		prevLast := q.last
		q.last = &writeJobQueueSegment{
			segment: make([]chunkWriteJob, q.segmentSize),
		}

		if prevLast != nil {
			prevLast.nextSegment = q.last
		}
		if q.first == nil {
			q.first = q.last
		}
	}

	q.last.segment[q.last.nextWrite] = job
	q.last.nextWrite++
	q.size++
	q.pushed.Signal()
	return true
}

// pop returns first job from the queue, and true.
// If queue is empty, pop blocks until there is a job (returns true), or until queue is closed (returns false).
// If queue was already closed, pop first returns all remaining elements from the queue (with true value), and only then returns false.
func (q *writeJobQueue) pop() (chunkWriteJob, bool) {
	q.mtx.Lock()
	defer q.mtx.Unlock()

	// wait until something is pushed to the queue, or queue is closed.
	for q.size == 0 {
		if q.closed {
			return chunkWriteJob{}, false
		}

		q.pushed.Wait()
	}

	res := q.first.segment[q.first.nextRead]
	q.first.segment[q.first.nextRead] = chunkWriteJob{} // clear just-read element
	q.first.nextRead++
	q.size--

	// If we have read all possible elements from first segment, we can drop it.
	if q.first.nextRead >= q.segmentSize {
		q.first = q.first.nextSegment
		if q.first == nil {
			q.last = nil
		}
	}

	q.popped.Signal()
	return res, true
}

// length returns number of all jobs in the queue.
func (q *writeJobQueue) length() int {
	q.mtx.Lock()
	defer q.mtx.Unlock()

	return q.size
}

```

### Core Architecture Module: `tsdb/fileutil/dir.go`
```
// Copyright The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package fileutil

import (
	"os"
	"path/filepath"
)

func DirSize(dir string) (int64, error) {
	var size int64
	err := filepath.Walk(dir, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			// Ignore missing files that may have been deleted during the walk.
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	return size, err
}

```

### Core Architecture Module: `tsdb/fileutil/dir_unix.go`
```
// Copyright The Prometheus Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build !windows

package fileutil

import "os"

// OpenDir opens a directory for syncing.
func OpenDir(path string) (*os.File, error) { return os.Open(path) }

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #20622** (2026-11-27): **chore: sync release-4.0 with main**
  *Symptoms*: Automated sync of main into release-4.0 while 4.0 is still under development.  Opened by [workflow run](https://github.com/machine424/prometheus/actions/runs/45985014624).  Use Create a merge commitâ€”squashing or rebasing erases main's merge history and causes future syncs to repeat these commits and conflicts.  While this is open the sync is paused, so merging or closing it is what lets the next run continue.  ```release-notes NONE ```

- **Issue #20610** (2026-11-27): **ui: escape line breaks in autocompleted label values**
  *Symptoms*: #### Which issue(s) does the PR fix:  No issue filed.  When a label value is autocompleted inside a string (`metric{label="|"}`), the editor inserts `escapePromQLString(value)` (`web/ui/module/codemirror-promql/src/complete/hybrid.ts`). It escaped `\` and `"`, but not line breaks. PromQL doesn't allow a raw newline in a quoted string (the lexer reports `unterminated quoted string`), so picking a value that contains a line break, as some exporters put in error or description labels, leaves the query broken right away.  The function now also escapes `\n` and `\r`. Other characters are unchanged.  This is the same rule as #20602, which fixes `escapeString` in the mantine UI. Neither change depends on the other.  Test: the label value fixture (`src/test/label_env_values.json`) gets a value with a line break, and the "online autocomplete of label value corresponding to a metric and a label name" case in `hybrid.test.ts` now expects `apply: 'multi\nline'`. Without the change that case fails; with it, the full `codemirror-promql` suite passes (9 suites, 425 tests).  #### Release notes for end users (**ALL** commits must be considered). *Reviewers should verify clarity and quality.*  ```release-notes [BUGFIX] UI: Escape line breaks in label values inserted by autocompletion, so the resulting query stays valid. ``` 

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

### Incident Patch 1: `77b65d53` (2026-11-27)
**Commit Message**: api: honor search cancellation and report timeouts (#19991)

* api: honor cancellation during indexed search

Stop indexed filtering on context cancellation and classify search deadlines before and during streaming. Preserve secondary storage errors as warnings.

---------

Signed-off-by: Arve Knudsen <[REDACTED_EMAIL]>

**File**: `storage/generic.go` (modified, +44/-31)
```diff
@@ -247,58 +247,59 @@ func NewSearchResultSetFromSliceAndError(results []SearchResult, warns annotatio
 // keeping the upfront allocation small for sparse matches against large indices.
 const minLinearAllocCap = 256
 
-// ApplySearchHints filters, sorts, and limits a slice of string values according to hints,
-// returning scored SearchResult entries. A nil hints value is treated as the zero value.
-// The input values slice is assumed to be ordered ascending by value; the function only
-// performs extra work for orderings that differ from this.
-//
-// Allocation and ordering are tuned to the (Filter, OrderBy, Limit) combination:
-//   - Filter == nil: at most Limit entries are copied; OrderByValueDesc walks the input
-//     in reverse so we never materialise the full slice when limited.
-//   - OrderByValueAsc + Filter + Limit: stream-filter with early exit at Limit matches.
-//   - OrderByValueDesc + Filter + Limit: reverse stream-filter with early exit at Limit
-//     matches, taking advantage of the input being ascending so the tail is the largest.
-//   - OrderByScoreDesc + Filter + Limit: top-K min-heap of size Limit, avoiding a full
-//     sort over the matched set.
-//   - Other combinations fall back to filter-then-reorder-then-slice, with the upfront
-//     capacity capped by min(len(values), max(2*Limit, minLinearAllocCap)).
-func ApplySearchHints(values []string, hints *SearchHints) []SearchResult {
+// checkContextEveryNIterations is used in some tight loops to check if the context is done.
+const checkContextEveryNIterations = 128
+
+// ApplySearchHints filters, orders, and limits values using a non-nil ctx.
+// Values must be ascending unless hints specifies score ordering with a filter.
+// Nil hints use the zero-value defaults. Cancellation returns the context error.
+func ApplySearchHints(ctx context.Context, values []string, hints *SearchHints) ([]SearchResult, error) {
 	if hints == nil {
 		hints = &SearchHints{}
 	}
 	if hints.Filter == nil {
-		return applySearchHintsNoFilter(values, hints)
+		return applySearchHintsNoFilter(ctx, values, hints)
 	}
 	if hints.Limit > 0 {
 		switch hints.OrderBy {
 		case OrderByScoreDesc:
-			return topKByScore(values, hints.Filter, hints.Limit)
+			return topKByScore(ctx, values, hints.Filter, hints.Limit)
 		case OrderByValueDesc:
-			return reverseFilterEarlyExit(values, hints.Filter, hints.Limit)
+			return reverseFilterEarlyExit(ctx, values, hints.Filter, hints.Limit)
 		}
 	}
-	return applySearchHintsLinear(values, hints)
+	return applySearchHintsLinear(ctx, values, hints)
+}
+
+func searchHintsContextErr(ctx context.Context, i int) error {
+	if i%checkContextEveryNIterations != 0 {
+		return nil
+	}
+	return ctx.Err()
 }
 
 // reverseFilterEarlyExit walks the input ascending-sorted slice from the tail,
 // accepting up to limit matches. Because the input is ascending, the tail
 // holds the lex-largest entries, so iterating in reverse yields results in
 // descending order without an extra sort.
-func reverseFilterEarlyExit(values []string, filter Filter, limit int) []SearchResult {
+func reverseFilterEarlyExit(ctx context.Context, values []string, filter Filter, limit int) ([]SearchResult, error) {
 	results := make([]SearchResult, 0, min(limit, len(values)))
 	for i := len(values) - 1; i >= 0 && len(results) < limit; i-- {
+		if err := searchHintsContextErr(ctx, len(values)-1-i); err != nil {
+			return nil, err
+		}
 		accepted, score := filter.Accept(values[i])
 		if !accepted {
 			continue
 		}
 		results = append(results, SearchResult{Value: values[i], Score: score})
 	}
-	return results
+	return results, nil
 }
 
 // applySearchHintsNoFilter handles the unfiltered path: scores are uniformly 1.0
 // and at most Limit entries are emitted in the requested order.
-func applySearchHintsNoFilter(values []string, hints *SearchHints) []SearchResult {
+func applySearchHintsNoFilter(ctx context.Context, values []string, hints *SearchHints) ([]SearchResult, error) {
 	n := len(values)
 	if hints.Limit > 0 && hints.Limit < n {
 		n = hints.Limit
@@ -310,25 +311,34 @@ func applySearchHintsNoFilter(values []string, hints *SearchHints) []SearchResul
 		// guard is defensive: n is clamped to len(values) above, so we
 		// should always exit on len(results) == n first.
 		for i := len(values) - 1; i >= 0 && len(results) < n; i-- {
+			if err := searchHintsContextErr(ctx, len(values)-1-i); err != nil {
+				return nil, err
+			}
 			results = append(results, SearchResult{Value: values[i], Score: 1.0})
 		}
-		return results
+		return results, nil
 	}
 	// OrderByValueAsc and OrderByScoreDesc both reduce to value-ascending here:
 	// uniform scores tie-break on Value asc under (Score desc, Value asc).
 	for i := range n {
+		if err := searchHintsContextErr(ctx, i); err != nil {
+			return nil, err
+		}
 		results = append(results, SearchResult{Value: values[i], Score: 1.0})
 	}
-	return results
+	return results, nil
 }
 
 // applySearchHintsLinear 
```

**File**: `storage/generic_test.go` (modified, +120/-22)
```diff
@@ -14,6 +14,7 @@
 package storage
 
 import (
+	"context"
 	"errors"
 	"fmt"
 	"math"
@@ -46,10 +47,12 @@ type constScoreFilter float64
 func (f constScoreFilter) Accept(string) (bool, float64) { return true, float64(f) }
 
 func TestApplySearchHints(t *testing.T) {
-	values := []string{"alpha", "beta", "gamma", "delta", "epsilon"}
+	values := []string{"alpha", "beta", "delta", "epsilon", "gamma"}
+	unsortedValues := []string{"alpha", "beta", "gamma", "delta", "epsilon"}
 
 	t.Run("nil hints returns all with score 1", func(t *testing.T) {
-		got := ApplySearchHints(values, nil)
+		got, err := ApplySearchHints(t.Context(), values, nil)
+		require.NoError(t, err)
 		require.Len(t, got, len(values))
 		for i, r := range got {
 			require.Equal(t, values[i], r.Value)
@@ -58,19 +61,21 @@ func TestApplySearchHints(t *testing.T) {
 	})
 
 	t.Run("no filter ascending limit", func(t *testing.T) {
-		got := ApplySearchHints(values, &SearchHints{Limit: 3})
+		got, err := ApplySearchHints(t.Context(), values, &SearchHints{Limit: 3})
+		require.NoError(t, err)
 		require.Equal(t, []SearchResult{
 			{Value: "alpha", Score: 1.0},
 			{Value: "beta", Score: 1.0},
-			{Value: "gamma", Score: 1.0},
+			{Value: "delta", Score: 1.0},
 		}, got)
 	})
 
 	t.Run("no filter descending limit walks input in reverse", func(t *testing.T) {
-		got := ApplySearchHints(values, &SearchHints{OrderBy: OrderByValueDesc, Limit: 2})
+		got, err := ApplySearchHints(t.Context(), values, &SearchHints{OrderBy: OrderByValueDesc, Limit: 2})
+		require.NoError(t, err)
 		require.Equal(t, []SearchResult{
+			{Value: "gamma", Score: 1.0},
 			{Value: "epsilon", Score: 1.0},
-			{Value: "delta", Score: 1.0},
 		}, got)
 	})
 
@@ -80,23 +85,25 @@ func TestApplySearchHints(t *testing.T) {
 			hits++
 			return true, 1.0
 		})
-		got := ApplySearchHints(values, &SearchHints{Filter: filter, Limit: 2})
+		got, err := ApplySearchHints(t.Context(), values, &SearchHints{Filter: filter, Limit: 2})
+		require.NoError(t, err)
 		require.Len(t, got, 2)
 		// Early exit: the filter should not have been called for values past
 		// the second match.
 		require.Equal(t, 2, hits)
 	})
 
 	t.Run("filter descending reverses then limits", func(t *testing.T) {
-		got := ApplySearchHints(values, &SearchHints{
+		got, err := ApplySearchHints(t.Context(), values, &SearchHints{
 			Filter:  prefixScoreFilter{prefix: ""}, // accepts everything.
 			OrderBy: OrderByValueDesc,
 			Limit:   2,
 		})
+		require.NoError(t, err)
 		require.Len(t, got, 2)
-		// Input order is values[0..4]; reverse picks epsilon then delta.
-		require.Equal(t, "epsilon", got[0].Value)
-		require.Equal(t, "delta", got[1].Value)
+		// Reverse picks gamma then epsilon.
+		require.Equal(t, "gamma", got[0].Value)
+		require.Equal(t, "epsilon", got[1].Value)
 	})
 
 	t.Run("filter descending limit early exits without scanning all", func(t *testing.T) {
@@ -107,14 +114,15 @@ func TestApplySearchHints(t *testing.T) {
 			hits++
 			return true, 1.0
 		})
-		got := ApplySearchHints(values, &SearchHints{
+		got, err := ApplySearchHints(t.Context(), values, &SearchHints{
 			Filter:  filter,
 			OrderBy: OrderByValueDesc,
 			Limit:   2,
 		})
+		require.NoError(t, err)
 		require.Equal(t, []SearchResult{
+			{Value: "gamma", Score: 1.0},
 			{Value: "epsilon", Score: 1.0},
-			{Value: "delta", Score: 1.0},
 		}, got)
 		require.Equal(t, 2, hits, "must early-exit at limit for OrderByValueDesc")
 	})
@@ -126,11 +134,12 @@ func TestApplySearchHints(t *testing.T) {
 		for i := range 100 {
 			input = append(input, fmt.Sprintf("x%0*d", i+1, i))
 		}
-		got := ApplySearchHints(input, &SearchHints{
+		got, err := ApplySearchHints(t.Context(), input, &SearchHints{
 			Filter:  prefixScoreFilter{prefix: "x"},
 			OrderBy: OrderByScoreDesc,
 			Limit:   3,
 		})
+		require.NoError(t, err)
 		require.Len(t, got, 3)
 		// Scores are non-increasing.
 		for i := 1; i < len(got); i++ {
@@ -142,11 +151,12 @@ func TestApplySearchHints(t *testing.T) {
 
 	t.Run("score desc tie-break on Value asc", func(t *testing.T) {
 		// With a constant score, ordering tie-breaks on Value ascending.
-		got := ApplySearchHints(values, &SearchHints{
+		got, err := ApplySearchHints(t.Context(), unsortedValues, &SearchHints{
 			Filter:  constScoreFilter(0.5),
 			OrderBy: OrderByScoreDesc,
 			Limit:   3,
 		})
+		require.NoError(t, err)
 		require.Equal(t, []SearchResult{
 			{Value: "alpha", Score: 0.5},
 			{Value: "beta", Score: 0.5},
@@ -155,10 +165,11 @@ func TestApplySearchHints(t *testing.T) {
 	})
 
 	t.Run("score desc unlimited keeps all matches sorted", func(t *testing.T) {
-		got := ApplySearchHints(values, &SearchHints{
+		got, err := ApplySearchHints(t.Context(), unsortedValues, &SearchHints{
 			Filter:  prefixScoreFilter{prefix: ""},
 			OrderBy: OrderByScoreDesc,
 		})
+		require.NoError(t, err)
 		require.Len(t, got, len(values))
 		for i := 1; i < len(got); i++ {
 			if got[i-1].Score == got[i].Score {
@@ -173,20 +184,22 @@ f
```

**File**: `storage/interface.go` (modified, +2/-0)
```diff
@@ -417,6 +417,8 @@ type SearchResult struct {
 //
 // For a given Value and SearchHints.Filter, Score must be deterministic
 // and identical across Searcher implementations.
+// Implementations must stop on context cancellation and report the context error through Err.
+// Composites may convert errors from best-effort secondary storage into warnings.
 type Searcher interface {
 	// SearchLabelNames returns an iterator over label names matching the search criteria.
 	// Results include relevance scores based on the Filter.
```

**File**: `tsdb/querier.go` (modified, +11/-4)
```diff
@@ -103,7 +103,11 @@ func (q *blockBaseQuerier) SearchLabelNames(ctx context.Context, hints *storage.
 		return storage.ErrSearchResultSet(err)
 	}
 
-	return storage.NewSearchResultSetFromSlice(storage.ApplySearchHints(names, hints), nil)
+	results, err := storage.ApplySearchHints(ctx, names, hints)
+	if err != nil {
+		return storage.ErrSearchResultSet(err)
+	}
+	return storage.NewSearchResultSetFromSlice(results, nil)
 }
 
 // SearchLabelValues implements storage.Searcher.
@@ -133,8 +137,7 @@ func (q *blockBaseQuerier) SearchLabelValues(ctx context.Context, name string, h
 		values []string
 		err    error
 	)
-	// ApplySearchHints needs the values ascending by value.
-	// OrderByScore relies on the score calculated by the filter.
+	// ApplySearchHints needs ascending values except for score ordering with a filter.
 	if hints.OrderBy == storage.OrderByScoreDesc && hints.Filter != nil {
 		values, err = q.index.LabelValues(ctx, name, labelHints, matchers...)
 	} else {
@@ -144,7 +147,11 @@ func (q *blockBaseQuerier) SearchLabelValues(ctx context.Context, name string, h
 		return storage.ErrSearchResultSet(err)
 	}
 
-	return storage.NewSearchResultSetFromSlice(storage.ApplySearchHints(values, hints), nil)
+	results, err := storage.ApplySearchHints(ctx, values, hints)
+	if err != nil {
+		return storage.ErrSearchResultSet(err)
+	}
+	return storage.NewSearchResultSetFromSlice(results, nil)
 }
 
 func (q *blockBaseQuerier) Close() error {
```

**File**: `tsdb/querier_test.go` (modified, +2/-3)
```diff
@@ -4476,9 +4476,8 @@ func TestSearchLabelValuesLimitAppliedAfterOrdering(t *testing.T) {
 		})
 	})
 
-	// ApplySearchHints documents that its input must be ascending by value. With
-	// a nil filter the score ordering degenerates to value ascending, so the
-	// index-level sort cannot be skipped.
+	// With a nil filter, score ordering degenerates to value ascending, so
+	// ApplySearchHints requires ascending input and the index-level sort cannot be skipped.
 	t.Run("OrderByScoreDesc without a filter", func(t *testing.T) {
 		forEachSearchBackend(t, unorderedInsertion, func(t *testing.T, q storage.Searcher) {
 			rs := q.SearchLabelValues(t.Context(), "__name__", &storage.SearchHints{
```

**File**: `util/searchexpr/compiler_test.go` (modified, +2/-1)
```diff
@@ -185,9 +185,10 @@ func TestCompileEquivalentExpressionsRankIdentically(t *testing.T) {
 	} {
 		t.Run(expression, func(t *testing.T) {
 			filter := compileContains(t, expression, map[string]float64{"a": 0.75, "b": 0.75, "c": 0.75, "d": 0.25, "other": 0.55})
-			results := storage.ApplySearchHints([]string{"a_b_c_d", "other"}, &storage.SearchHints{
+			results, err := storage.ApplySearchHints(t.Context(), []string{"a_b_c_d", "other"}, &storage.SearchHints{
 				Filter: filter, Limit: 1, OrderBy: storage.OrderByScoreDesc,
 			})
+			require.NoError(t, err)
 			require.Equal(t, []storage.SearchResult{{Value: "a_b_c_d", Score: 1.75 / 3}}, results)
 		})
 	}
```

**File**: `web/api/v1/search.go` (modified, +24/-3)
```diff
@@ -503,6 +503,9 @@ func sortOrdering(sortBy, sortDir string) storage.Ordering {
 }
 
 func searchAPIError(err error) *apiError {
+	if errors.Is(err, context.DeadlineExceeded) {
+		return &apiError{errorTimeout, err}
+	}
 	result := setUnavailStatusOnTSDBNotReady(apiFuncResult{err: returnAPIError(err)})
 	return result.err
 }
@@ -520,6 +523,19 @@ func writeStreamInternalError(nw *ndjsonWriter, err error) {
 	_ = nw.writeLine(searchErrorResponse{Status: "error", ErrorType: errorInternal.str, Error: err.Error()})
 }
 
+// streamContextDone reports whether ctx is done, ending the stream with a timeout
+// record on deadline expiry and writing nothing for a canceled request.
+func streamContextDone(ctx context.Context, nw *ndjsonWriter) bool {
+	err := ctx.Err()
+	if err == nil {
+		return false
+	}
+	if errors.Is(err, context.DeadlineExceeded) {
+		writeStreamSearchError(nw, err)
+	}
+	return true
+}
+
 func searchWarnings(rs storage.SearchResultSet) []string {
 	var warnings []string
 	for _, w := range rs.Warnings() {
@@ -575,6 +591,10 @@ func streamSearchResults[T any](ctx context.Context, api *API, w http.ResponseWr
 	}
 
 	firstBatch, firstErr := streamer.nextBatch()
+	if err := ctx.Err(); errors.Is(err, context.DeadlineExceeded) {
+		api.respondPreStreamSearchError(w, err)
+		return
+	}
 	// A non-nil firstErr with zero results means the underlying iterator
 	// could not produce anything; respond with the standard JSON error so
 	// clients see a well-formed failure. When firstErr arrives alongside
@@ -631,12 +651,13 @@ func streamSearchResults[T any](ctx context.Context, api *API, w http.ResponseWr
 		// Stop pulling from storage as soon as the client goes away.
 		// Without this check, an abandoned request keeps iterating the
 		// underlying SearchResultSet (which may itself be doing real I/O).
-		select {
-		case <-ctx.Done():
+		if streamContextDone(ctx, nw) {
 			return
-		default:
 		}
 		batch, err := streamer.nextBatch()
+		if streamContextDone(ctx, nw) {
+			return
+		}
 		if len(batch) > 0 {
 			if writeErr := nw.writeLine(searchBatch[T]{Results: batch}); writeErr != nil {
 				writeStreamInternalError(nw, writeErr)
```

**File**: `web/api/v1/search_test.go` (modified, +153/-46)
```diff
@@ -27,6 +27,7 @@ import (
 	"strconv"
 	"strings"
 	"testing"
+	"testing/synctest"
 	"time"
 
 	"github.com/prometheus/common/model"
@@ -1446,21 +1447,16 @@ func TestSearchEndpointsCtxCancelled(t *testing.T) {
 	// Use a controlled fake searcher so the test does not depend on the
 	// shape of any storage fixture. With three explicit results and
 	// batch_size=1, firstBatch is non-empty and the streaming loop must
-	// observe the pre-cancelled context on its first iteration and return
-	// before writing a success trailer.
-	q := &sequentialSearchQuerier{
-		calls: []sequentialResp{
-			{results: []storage.SearchResult{
-				{Value: "alpha", Score: 1.0},
-				{Value: "beta", Score: 1.0},
-				{Value: "gamma", Score: 1.0},
-			}},
-		},
-	}
-	queryable := errorTestQueryable{q: q}
+	// observe the pre-cancelled context on its first iteration, returning
+	// before it pulls more results or writes a success trailer.
+	rs := &hookedSearchResultSet{SearchResultSet: storage.NewSearchResultSetFromSlice([]storage.SearchResult{
+		{Value: "alpha", Score: 1.0},
+		{Value: "beta", Score: 1.0},
+		{Value: "gamma", Score: 1.0},
+	}, nil)}
 
 	api := minimalSearchAPI()
-	api.Queryable = queryable
+	api.Queryable = errorTestQueryable{q: fixedSearchQuerier{rs: rs}}
 
 	ctx, cancel := context.WithCancel(t.Context())
 	cancel()
@@ -1477,6 +1473,8 @@ func TestSearchEndpointsCtxCancelled(t *testing.T) {
 	// returning. An empty body would otherwise let a regression slip
 	// through this test silently.
 	require.NotEmpty(t, lines, "expected at least the first batch line to be written before ctx-cancel takes effect")
+	// An abandoned request must not keep iterating storage past the first batch.
+	require.Equal(t, 1, rs.calls, "expected no Next call after the first batch")
 
 	// No line should decode as a success trailer. This is robust to a
 	// truncated body, an empty firstBatch path, or an earlier exit before
@@ -1505,45 +1503,154 @@ func (q fixedSearchQuerier) SearchLabelValues(context.Context, string, *storage.
 	return q.rs
 }
 
-// TestSearchStreamFirstBatchError exercises the boundary where the first
-// batch that streamSearchResults assembles already contains both partial
-// results and a tail error. The handler must stream the partial results
-// before terminating with an in-band NDJSON error line.
-func TestSearchStreamFirstBatchError(t *testing.T) {
-	rs := storage.NewSearchResultSetFromSliceAndError(
-		[]storage.SearchResult{
-			{Value: "alpha", Score: 1.0},
-			{Value: "beta", Score: 1.0},
+// hookedSearchResultSet counts Next calls and runs onNext, if set, before each
+// one, so tests can observe how far streaming pulls or act at a given call.
+type hookedSearchResultSet struct {
+	storage.SearchResultSet
+	calls  int
+	onNext func(call int)
+}
+
+func (s *hookedSearchResultSet) Next() bool {
+	s.calls++
+	if s.onNext != nil {
+		s.onNext(s.calls)
+	}
+	return s.SearchResultSet.Next()
+}
+
+// TestAPI_SearchMetricNames_StreamErrors checks storage errors and request
+// deadlines before streaming and after partial results.
+func TestAPI_SearchMetricNames_StreamErrors(t *testing.T) {
+	for _, tc := range []struct {
+		name      string
+		resultSet storage.SearchResultSet
+		// expireOnNext, when positive, lets the request deadline pass during that Next call.
+		expireOnNext      int
+		expectedNames     []string
+		expectedCode      int
+		expectedErrorType string
+		expectedError     string
+	}{
+		{
+			name: "execution error after partial results",
+			resultSet: storage.NewSearchResultSetFromSliceAndError(
+				[]storage.SearchResult{{Value: "alpha", Score: 1.0}, {Value: "beta", Score: 1.0}},
+				nil,
+				errors.New("tail failure"),
+			),
+			expectedNames:     []string{"alpha", "beta"},
+			expectedCode:      http.StatusOK,
+			expectedErrorType: errorExec.str,
+			expectedError:     "tail failure",
+		},
+		{
+			name:              "deadline error before streaming",
+			resultSet:         storage.ErrSearchResultSet(context.DeadlineExceeded),
+			expectedCode:      http.StatusServiceUnavailable,
+			expectedErrorType: errorTimeout.str,
+			expectedError:     context.DeadlineExceeded.Error(),
+		},
+		{
+			name: "deadline error after partial results",
+			resultSet: storage.NewSearchResultSetFromSliceAndError(
+				[]storage.SearchResult{{Value: "alpha", Score: 1.0}},
+				nil,
+				context.DeadlineExceeded,
+			),
+			expectedNames:     []string{"alpha"},
+			expectedCode:      http.StatusOK,
+			expectedErrorType: errorTimeout.str,
+			expectedError:     context.DeadlineExceeded.Error(),
 		},
-		nil,
-		errors.New("tail failure"),
-	)
-	queryable := errorTestQueryable{q: fixedSearchQuerier{rs: rs}}
+		{
+			// Composites turn secondary errors, deadlines included, into
+			// warnings, so a nil Err does not prove the results are complete.
+			// Unlike a finished ApplySearchHints scan, results pulled after
+			// the deadline are therefore rejected.
+			name: "deadline during first batch",
+			r
```

---

### Incident Patch 2: `b1bbab44` (2026-11-27)
**Commit Message**: Merge pull request #20610 from rida-ghreizy/ui-completion-escape-newlines

ui: escape line breaks in autocompleted label values

**File**: `web/ui/module/codemirror-promql/src/complete/hybrid.test.ts` (modified, +5/-0)
```diff
@@ -1804,6 +1804,11 @@ describe('autocomplete promQL test', () => {
             apply: 'quoted\\"value',
             type: 'text',
           },
+          {
+            label: 'multi\nline',
+            apply: 'multi\\nline',
+            type: 'text',
+          },
         ],
         from: 25,
         to: 25,
```

**File**: `web/ui/module/codemirror-promql/src/complete/hybrid.ts` (modified, +6/-2)
```diff
@@ -185,8 +185,12 @@ function arrayToCompletionResult(data: Completion[], from: number, to: number, i
 function escapePromQLString(str: string): string {
   // PromQL only evaluates escape sequences in single- and double-quoted strings.
   // Backtick-quoted string completions are not handled separately today, so keep
-  // the inserted value escaped unconditionally.
-  return str.replace(/([\\"])/g, '\\$1');
+  // the inserted value escaped unconditionally. A raw line break would end the
+  // string literal with a syntax error, so line breaks are escaped as well.
+  return str
+    .replace(/([\\"])/g, '\\$1')
+    .replace(/\n/g, '\\n')
+    .replace(/\r/g, '\\r');
 }
 
 function isAfterClosedFunctionCallBody(state: EditorState, node: SyntaxNode, pos: number): boolean {
```

**File**: `web/ui/module/codemirror-promql/src/test/label_env_values.json` (modified, +2/-1)
```diff
@@ -3,6 +3,7 @@
   "data": [
     "demo",
     "\\x2d",
-    "quoted\"value"
+    "quoted\"value",
+    "multi\nline"
   ]
 }
```

---

### Incident Patch 3: `b168ccab` (2026-11-27)
**Commit Message**: Merge pull request #20607 from rida-ghreizy/ui-duration-rounding-carry

ui: carry rounded milliseconds over to the next duration unit

**File**: `web/ui/mantine-ui/src/lib/formatTime.test.ts` (modified, +8/-0)
```diff
@@ -48,6 +48,14 @@ describe("formatPrometheusDuration", () => {
     expect(formatPrometheusDuration(3599999)).toBe("59m59s999ms");
   });
 
+  test("carries over fractional milliseconds that round up to the next unit", () => {
+    expect(humanizeDuration(59999.6)).toBe("1m");
+    expect(humanizeDuration(119999.7)).toBe("2m");
+    expect(humanizeDuration(3599999.8)).toBe("1h");
+    expect(humanizeDuration(1999.9996)).toBe("2s");
+    expect(humanizeDuration(1500.4)).toBe("1.5s");
+  });
+
   test("formats hours correctly", () => {
     expect(formatPrometheusDuration(3600000)).toBe("1h");
     expect(formatPrometheusDuration(7200000)).toBe("2h");
```

**File**: `web/ui/mantine-ui/src/lib/formatTime.ts` (modified, +3/-1)
```diff
@@ -58,7 +58,9 @@ const formatDuration = (
   }
 
   const sign = d < 0 ? "-" : "";
-  let ms = Math.abs(d);
+  // Round to whole milliseconds first, so that e.g. 59999.6ms carries over to
+  // "1m" instead of being shown as "60s" (or "59m 60s" for one hour).
+  let ms = Math.round(Math.abs(d));
   const r: string[] = [];
 
   for (const { unit, mult, exact } of [
```

#### Recent Merged Pull Requests:
- **PR #20622** (2026-11-27): chore: sync release-4.0 with main (@machine424)
- **PR #20610** (2026-11-27): ui: escape line breaks in autocompleted label values (@rida-ghreizy)
- **PR #20607** (2026-11-27): ui: carry rounded milliseconds over to the next duration unit (@rida-ghreizy)
- **PR #20606** (closed): textparse: reject NaN count in OpenMetrics 2.0 native histograms (@CJstate)
- **PR #20605** (closed): textparse: reject duplicate label names in OpenMetrics 2.0 (@CJstate)
- **PR #20602** (2026-11-27): ui: escape line breaks in PromQL strings built by the UI (@rida-ghreizy)

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

## X. api: honor search cancellation and report timeouts

**RULE**:
When implementing operations in `storage/generic.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in prometheus/prometheus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `77b65d53`: api: honor search cancellation and report timeouts. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `storage/generic.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// checkContextEveryNIterations is used in some tight loops to check if the context is done.
const checkContextEveryNIterations = 128

// ApplySearchHints filters, orders, and limits values using a non-nil ctx.
// Values must be ascending unless hints specifies score ordering with a filter.
// Nil hints use the zero-value defaults. Cancellation returns the context error.
func ApplySearchHints(ctx context.Context, values []string, hints *SearchHints) ([]SearchResult, error) {
		return applySearchHintsNoFilter(ctx, values, hints)
			return topKByScore(ctx, values, hints.Filter, hints.Limit)
			return reverseFilterEarlyExit(ctx, values, hints.Filter, hints.Limit)
	return applySearchHintsLinear(ctx, values, hints)
}

func searchHintsContextErr(ctx context.Context, i int) error {
	if i%checkContextEveryNIterations != 0 {
		return nil
	}
	return ctx.Err()
func reverseFilterEarlyExit(ctx context.Context, values []string, filter Filter, limit int) ([]SearchResult, error) {
		if err := searchHintsContextErr(ctx, len(values)-1-i); err != nil {
			return nil, err
		}
	return results, nil
func applySearchHintsNoFilter(ctx context.Context, values []string, hints *SearchHints) ([]SearchResult, e
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// ApplySearchHints filters, sorts, and limits a slice of string values according to hints,
// returning scored SearchResult entries. A nil hints value is treated as the zero value.
// The input values slice is assumed to be ordered ascending by value; the function only
// performs extra work for orderings that differ from this.
//
// Allocation and ordering are tuned to the (Filter, OrderBy, Limit) combination:
//   - Filter == nil: at most Limit entries are copied; OrderByValueDesc walks the input
//     in reverse so we never materialise the full slice when limited.
//   - OrderByValueAsc + Filter + Limit: stream-filter with early exit at Limit matches.
//   - OrderByValueDesc + Filter + Limit: reverse stream-filter with early exit at Limit
//     matches, taking advantage of the input being ascending so the tail is the largest.
//   - OrderByScoreDesc + Filter + Limit: top-K min-heap of size Limit, avoiding a full
//     sort over the matched set.
//   - Other combinations fall back to filter-then-reorder-then-slice, with the upfront
//     capacity capped by min(len(values), max(2*Limit, minLinearAllocCap)).
func ApplySearchHints(values []string, hints *SearchHints) []SearchRe
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `77b65d53` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
