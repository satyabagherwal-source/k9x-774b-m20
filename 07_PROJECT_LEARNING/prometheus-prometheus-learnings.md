> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/prometheus-prometheus-learnings.md`  
> **Source**: github ([https://github.com/prometheus/prometheus](https://github.com/prometheus/prometheus))  
> **Source Version**: `a5022ef6`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-23T17:37:57.600Z  
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
> **Harvest Timestamp**: 2026-11-23T17:37:57.594Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `prometheus/prometheus`
- **Description**: The Prometheus monitoring system and time series database.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 67768 stars

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
	// TODO(bwplotka): Temporary, fixed in https://github.com/prometheus/prometheus/pull/20070.
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
	}, []string{"reason
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
- **Issue #20541** (2026-11-23): **tsdb: protect series with pending exemplars from eviction**
  *Symptoms*: Appending an exemplar does not take a pending-commit reservation on its series, unlike appending a sample. Since #20467, stale or selected series compaction can then evict the series between an exemplar-only append and its commit. The remote-write receiver can do such appends. The commit logs the exemplar under the evicted ref, after the series' full-range tombstone, and drops it from memory. On WAL replay, the late exemplar can be attributed to a series later recreated with the same labels (see #20512).  This reserves the series when appending an exemplar, in both appenders, and releases it on commit or rollback. If the series was garbage collected before the reservation, it uses the series that replaced it, as sample appends do.  `TestSeriesEviction_PendingExemplarProtectsSeries` fails on main for both appenders and both eviction paths.  This is not in a release: v3.16.0 keeps the identity of series with exemplars that still need replay.  <details> <summary>Benchmark</summary>  `BenchmarkHeadAppender_AppendCommit`, before: f1486b6753663ba3f49a3c75c21c6bf93ff304b2, after: 4fafc6b47622ff0537fe5499eab5e8efdd35ae02. Pinned to two P-cores with the test directory on tmpfs, alternating the binaries 10 times.  ```console goos: linux goarch: amd64 pkg: github.com/prometheus/prometheus/tsdb cpu: Intel(R) Core(TM) Ultra 9 185H                                                                                                          │ before.txt  │             after.txt              │   
  **Post-Mortem & Fix Analysis**:
  > Would you like help adding deterministic tests for eviction between exemplar lookup and reservation in both appenders? I can cover replacement references in the returned value and WAL, reservation release on commit or rollback, and rejection when no replacement exists. 
  > To the best of my knowledge, this is an alternative for #20512. So, please don't reference #20512 in this PR's description.

- **Issue #20536** (2026-11-23): **otlp: drop metrics with unsupported temporality instead of rejecting the request**
  *Symptoms*: #### Which issue(s) does the PR fix:  No issue filed. Same regression as #19338, with a different trigger.  Since #16951 (v3.7.0), `ConsumeMetrics` rolls back the whole OTLP request when `FromMetrics` returns an error, and the handler answers 500. A delta metric sent without `otlp-native-delta-ingestion` (or `otlp-deltatocumulative`) is such an error, so one delta metric in a request drops every other metric in it:  ``` request: Sum "good" (cumulative) + Sum "bad" (delta), default flags main:    500 invalid temporality and type combination for metric "bad", nothing stored v3.6:    good_total stored, the error logged ```  `docs/feature_flags.md` describes delta metrics as dropped without the flag, and `TestTemporality` already expects `test_metric_1` to be appended in "delta rejected when not allowed". The test commits the appender even when `FromMetrics` returns an error, so it did not catch this. Mixed requests are common: SDKs configured to prefer delta, or a collector batching metrics from several services.  This reports the unsupported temporality as a warning instead of an error, the way #19343 handled metrics with no data points, so only that metric is dropped. The warning is counted in `prometheus_api_otlp_translation_warnings_total{category="invalid_temporality"}`.  Tests: `TestTemporality` now checks the warnings, and its 5 invalid-temporality cases expect a warning instead of an error. In `TestOTLPWriteHandler` the "empty metric does not reject healthy metrics" case

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

### Incident Patch 1: `a5022ef6` (2026-11-23)
**Commit Message**: Merge pull request #20541 from roidelapluie/roidelapluie/exemplar-pending-commit

tsdb: protect series with pending exemplars from eviction

**File**: `tsdb/head.go` (modified, +8/-2)
```diff
@@ -98,7 +98,7 @@ type Head struct {
 	// TODO(bwplotka): Consider using record.Pools that's reused with WAL watchers.
 	refSeriesPool       zeropool.Pool[[]record.RefSeries]
 	floatsPool          zeropool.Pool[[]record.RefSample]
-	exemplarsPool       zeropool.Pool[[]exemplarWithSeriesRef]
+	exemplarsPool       zeropool.Pool[[]exemplarWithSeries]
 	histogramsPool      zeropool.Pool[[]record.RefHistogramSample]
 	floatHistogramsPool zeropool.Pool[[]record.RefFloatHistogramSample]
 	metadataPool        zeropool.Pool[[]record.RefMetadata]
@@ -3338,11 +3338,17 @@ func newMemSeries(lset labels.Labels, id chunks.HeadSeriesRef, shardHash uint64,
 // updateExemplarTimestamp records the latest exemplar time while holding the series lock.
 func (s *memSeries) updateExemplarTimestamp(ts int64) {
 	s.Lock()
+	s.updateExemplarTimestampLocked(ts)
+	s.Unlock()
+}
+
+// updateExemplarTimestampLocked records the latest exemplar time.
+// Must be called with the series lock held.
+func (s *memSeries) updateExemplarTimestampLocked(ts int64) {
 	if !s.hasExemplar || ts > s.lastExemplarTs {
 		s.lastExemplarTs = ts
 	}
 	s.hasExemplar = true
-	s.Unlock()
 }
 
 func (s *memSeries) minTime() int64 {
```

**File**: `tsdb/head_append.go` (modified, +59/-28)
```diff
@@ -256,20 +256,20 @@ func (h *Head) putFloatBuffer(b []record.RefSample) {
 	h.floatsPool.Put(b[:0])
 }
 
-func (h *Head) getExemplarBuffer() []exemplarWithSeriesRef {
+func (h *Head) getExemplarBuffer() []exemplarWithSeries {
 	b := h.exemplarsPool.Get()
 	if b == nil {
-		return make([]exemplarWithSeriesRef, 0, 512)
+		return make([]exemplarWithSeries, 0, 512)
 	}
 	return b
 }
 
-func (h *Head) putExemplarBuffer(b []exemplarWithSeriesRef) {
+func (h *Head) putExemplarBuffer(b []exemplarWithSeries) {
 	if b == nil {
 		return
 	}
-	for i := range b { // Zero out to avoid retaining label data.
-		b[i].exemplar.Labels = labels.EmptyLabels()
+	for i := range b { // Zero out to avoid retaining label data and series.
+		b[i] = exemplarWithSeries{}
 	}
 
 	h.exemplarsPool.Put(b[:0])
@@ -354,8 +354,11 @@ func (h *Head) putBytesBuffer(b []byte) {
 	h.bytesPool.Put(b[:0])
 }
 
-type exemplarWithSeriesRef struct {
-	ref      storage.SeriesRef
+// exemplarWithSeries is an exemplar held by an appender. The appender holds a
+// pending-commit reservation on the series until the exemplar is committed or
+// rolled back.
+type exemplarWithSeries struct {
+	series   *memSeries
 	exemplar exemplar.Exemplar
 }
 
@@ -389,7 +392,7 @@ type appendBatch struct {
 	floatHistogramSeries []*memSeries                     // FloatHistogramSamples series corresponding to the samples held by this appender (using corresponding slice indices - same series may appear more than once).
 	metadata             []record.RefMetadata             // New metadata held by this appender.
 	metadataSeries       []*memSeries                     // Series corresponding to the metadata held by this appender.
-	exemplars            []exemplarWithSeriesRef          // New exemplars held by this appender.
+	exemplars            []exemplarWithSeries             // New exemplars held by this appender.
 }
 
 // close returns all the slices to the pools in Head and nil's them.
@@ -904,6 +907,9 @@ func (a *headAppender) AppendExemplar(ref storage.SeriesRef, lset labels.Labels,
 	if s == nil {
 		return 0, fmt.Errorf("unknown HeadSeriesRef when trying to add exemplar: %d", ref)
 	}
+	if hook := a.head.testAfterSeriesLookup; hook != nil {
+		hook(s)
+	}
 
 	// Ensure no empty labels have gotten through.
 	e.Labels = e.Labels.WithoutEmpty()
@@ -917,14 +923,39 @@ func (a *headAppender) AppendExemplar(ref storage.SeriesRef, lset labels.Labels,
 		return 0, err
 	}
 
-	b := a.getCurrentBatch(stNone, chunks.HeadSeriesRef(ref))
-	// Protect the series from ordinary compaction before the exemplar is committed.
-	s.updateExemplarTimestamp(e.Ts)
-	b.exemplars = append(b.exemplars, exemplarWithSeriesRef{ref, e})
+	if s = a.reserveSeriesForExemplar(s, e.Ts); s == nil {
+		return 0, fmt.Errorf("unknown HeadSeriesRef when trying to add exemplar: %d", ref)
+	}
+	b := a.getCurrentBatch(stNone, s.ref)
+	b.exemplars = append(b.exemplars, exemplarWithSeries{s, e})
 
 	return storage.SeriesRef(s.ref), nil
 }
 
+// reserveSeriesForExemplar takes a pending-commit reservation on s for an
+// exemplar with timestamp ts, so that the series cannot be garbage collected
+// before the exemplar is committed. Otherwise, the commit would log the
+// exemplar after the tombstone of the series. If s was garbage collected in the
+// meantime, it uses the series that replaced it, if any. It returns the reserved
+// series, or nil if there is none.
+func (a *headAppenderBase) reserveSeriesForExemplar(s *memSeries, ts int64) *memSeries {
+	for {
+		s.Lock()
+		if !s.isGCed() {
+			s.updateExemplarTimestampLocked(ts)
+			s.markPendingCommit()
+			s.Unlock()
+			return s
+		}
+		lset := s.lset // Safe to access; the series is locked.
+		s.Unlock()
+
+		if s = a.head.series.getByHash(lset.Hash(), lset); s == nil {
+			return nil
+		}
+	}
+}
+
 func (a *headAppender) AppendHistogram(ref storage.SeriesRef, lset labels.Labels, t int64, h *histogram.Histogram, fh *histogram.FloatHistogram) (storage.SeriesRef, error) {
 	// Fail fast if OOO is disabled and the sample is out of bounds.
 	// Otherwise a full check will be done later to decide if the sample is in-order or out-of-order.
@@ -1271,11 +1302,11 @@ func (a *headAppenderBase) log() error {
 	return nil
 }
 
-func exemplarsForEncoding(es []exemplarWithSeriesRef) []record.RefExemplar {
+func exemplarsForEncoding(es []exemplarWithSeries) []record.RefExemplar {
 	ret := make([]record.RefExemplar, 0, len(es))
 	for _, e := range es {
 		ret = append(ret, record.RefExemplar{
-			Ref:    chunks.HeadSeriesRef(e.ref),
+			Ref:    e.series.ref,
 			T:      e.exemplar.Ts,
 			V:      e.exemplar.Value,
 			Labels: e.exemplar.Labels,
@@ -1329,20 +1360,14 @@ type appenderCommitContext struct {
 func (a *headAppenderBase) commitExemplars(b *appendBatch) {
 	// No errors logging to WAL, so pass the exemplars along to the in memory storage.
 	for _, e := range b.exemplars {
-		s := a.head.series.getByID(chunks.HeadSeriesRef(e.ref))
-		if s == nil {
-			// This is 
```

**File**: `tsdb/head_append_v2.go` (modified, +19/-8)
```diff
@@ -224,7 +224,7 @@ func (a *headAppenderV2) Append(ref storage.SeriesRef, ls labels.Labels, st, t i
 	// Append exemplars if any and if storage was configured for it.
 	if len(opts.Exemplars) > 0 && a.head.opts.EnableExemplarStorage && a.head.opts.MaxExemplars.Load() > 0 {
 		// Currently only exemplars can return partial errors.
-		partialErr = a.appendExemplars(s, opts.Exemplars)
+		s, partialErr = a.appendExemplars(s, opts.Exemplars)
 	}
 	if a.head.opts.EnableMetadataWALRecords && !opts.Metadata.IsEmpty() {
 		s.Lock()
@@ -256,11 +256,15 @@ func (a *headAppenderV2) AppendExemplars(ref storage.SeriesRef, ls labels.Labels
 	if s == nil {
 		return 0, fmt.Errorf("unknown HeadSeriesRef when trying to add exemplars: %d: %w", ref, storage.ErrNotFound)
 	}
+	if hook := a.head.testAfterSeriesLookup; hook != nil {
+		hook(s)
+	}
 	if len(exemplars) == 0 || !a.head.opts.EnableExemplarStorage || a.head.opts.MaxExemplars.Load() <= 0 {
 		return storage.SeriesRef(s.ref), nil
 	}
 
-	return storage.SeriesRef(s.ref), a.appendExemplars(s, exemplars)
+	s, err := a.appendExemplars(s, exemplars)
+	return storage.SeriesRef(s.ref), err
 }
 
 // appendFloat appends v to s, and returns the series the sample was appended to, which
@@ -363,7 +367,10 @@ func (a *headAppenderV2) appendFloatHistogram(s *memSeries, st, t int64, fh *his
 	return s, nil
 }
 
-func (a *headAppenderV2) appendExemplars(s *memSeries, exemplars []exemplar.Exemplar) error {
+// appendExemplars appends the exemplars to s. It returns the series they were
+// appended to, which may differ from s if s was garbage-collected in the
+// meantime (see reserveSeriesForExemplar).
+func (a *headAppenderV2) appendExemplars(s *memSeries, exemplars []exemplar.Exemplar) (*memSeries, error) {
 	var errs []storage.ExemplarError
 	for i, e := range exemplars {
 		// Ensure no empty labels have gotten through.
@@ -379,15 +386,19 @@ func (a *headAppenderV2) appendExemplars(s *memSeries, exemplars []exemplar.Exem
 			}
 			continue
 		}
+		reserved := a.reserveSeriesForExemplar(s, e.Ts)
+		if reserved == nil {
+			errs = append(errs, storage.ExemplarError{Index: i, Err: fmt.Errorf("unknown HeadSeriesRef when trying to add exemplars: %d: %w", s.ref, storage.ErrNotFound)})
+			continue
+		}
+		s = reserved
 		b := a.getCurrentBatch(stNone, s.ref)
-		// Protect the series from compaction before the exemplar is committed.
-		s.updateExemplarTimestamp(e.Ts)
-		b.exemplars = append(b.exemplars, exemplarWithSeriesRef{storage.SeriesRef(s.ref), e})
+		b.exemplars = append(b.exemplars, exemplarWithSeries{s, e})
 	}
 	if len(errs) > 0 {
-		return &storage.AppendPartialError{ExemplarErrors: errs}
+		return s, &storage.AppendPartialError{ExemplarErrors: errs}
 	}
-	return nil
+	return s, nil
 }
 
 // NOTE(bwplotka): This feature might be deprecated and removed once PROM-60
```

**File**: `tsdb/head_series_eviction_test.go` (modified, +159/-0)
```diff
@@ -626,6 +626,165 @@ func TestSeriesEviction_SeriesAreOnlyPublishedWhileTheyAreEvicted(t *testing.T)
 	}
 }
 
+// evictionTestExemplarAppenders returns the ways of appending an exemplar without a sample. Each returns the
+// uncommitted appender and the ref of the series the exemplar was appended to.
+func evictionTestExemplarAppenders() map[string]func(*DB, storage.SeriesRef, labels.Labels, exemplar.Exemplar) (storage.AppenderTransaction, storage.SeriesRef, error) {
+	return map[string]func(*DB, storage.SeriesRef, labels.Labels, exemplar.Exemplar) (storage.AppenderTransaction, storage.SeriesRef, error){
+		"Appender": func(db *DB, ref storage.SeriesRef, lset labels.Labels, e exemplar.Exemplar) (storage.AppenderTransaction, storage.SeriesRef, error) {
+			app := db.Appender(context.Background())
+			ref, err := app.AppendExemplar(ref, lset, e)
+			return app, ref, err
+		},
+		"AppenderV2": func(db *DB, ref storage.SeriesRef, lset labels.Labels, e exemplar.Exemplar) (storage.AppenderTransaction, storage.SeriesRef, error) {
+			app := db.AppenderV2(context.Background())
+			ref, err := app.(storage.ExemplarAppenderV2).AppendExemplars(ref, lset, []exemplar.Exemplar{e})
+			return app, ref, err
+		},
+	}
+}
+
+// TestSeriesEviction_PendingExemplarProtectsSeries verifies that a series that only received an exemplar in an
+// uncommitted appender is not evicted. Otherwise, the commit logs the exemplar after the series' tombstone and
+// drops it from memory. Once the appender is committed or rolled back, the series can be evicted again.
+func TestSeriesEviction_PendingExemplarProtectsSeries(t *testing.T) {
+	for appName, appendExemplar := range evictionTestExemplarAppenders() {
+		for evictName, evict := range evictionTestEvictions() {
+			for _, commit := range []bool{true, false} {
+				t.Run(fmt.Sprintf("%s/%s/commit=%t", appName, evictName, commit), func(t *testing.T) {
+					testDB := newSeriesEvictionTestDB(t, 0)
+					db := testDB.db
+					head := db.Head()
+					lset := evictionTestLabels(0)
+
+					app, _, err := appendExemplar(db, testDB.evictedRefs[0], lset, exemplar.Exemplar{
+						Labels: labels.FromStrings("trace_id", "pending"), Value: 1, Ts: 300,
+					})
+					require.NoError(t, err)
+					require.NoError(t, evict(db, testDB.evictedRefs))
+					require.Equal(t, uint64(evictionTestSeries-evictionTestEvictedSeries+1), head.NumSeries())
+					if commit {
+						require.NoError(t, app.Commit())
+					} else {
+						require.NoError(t, app.Rollback())
+					}
+
+					expectedTraceID := "0"
+					if commit {
+						expectedTraceID = "pending"
+					}
+					q, err := head.ExemplarQuerier(t.Context())
+					require.NoError(t, err)
+					res, err := q.Select(0, 1000, []*labels.Matcher{labels.MustNewMatcher(labels.MatchEqual, "id", lset.Get("id"))})
+					require.NoError(t, err)
+					require.Len(t, res, 1)
+					require.Len(t, res[0].Exemplars, 1)
+					require.Equal(t, expectedTraceID, res[0].Exemplars[0].Labels.Get("trace_id"))
+
+					// The exemplar survives a restart.
+					opts := db.opts
+					require.NoError(t, db.Close())
+					db, err = Open(db.Dir(), nil, nil, opts, nil)
+					require.NoError(t, err)
+					t.Cleanup(func() { require.NoError(t, db.Close()) })
+					head = db.Head()
+					q, err = head.ExemplarQuerier(t.Context())
+					require.NoError(t, err)
+					res, err = q.Select(0, 1000, []*labels.Matcher{labels.MustNewMatcher(labels.MatchEqual, "id", lset.Get("id"))})
+					require.NoError(t, err)
+					require.Len(t, res, 1)
+					require.Len(t, res[0].Exemplars, 1)
+					require.Equal(t, expectedTraceID, res[0].Exemplars[0].Labels.Get("trace_id"))
+
+					// The appender released the series.
+					require.NoError(t, evict(db, testDB.evictedRefs))
+					require.Equal(t, uint64(evictionTestSeries-evictionTestEvictedSeries), head.NumSeries())
+					require.Equal(t, float64(0), prom_testutil.ToFloat64(head.metrics.pendingCommitUnderflow))
+				})
+			}
+		}
+	}
+}
+
+// TestSeriesEviction_ExemplarAppendRetriesAfterEviction verifies that an exemplar append that looked up a series
+// just before its eviction does not reserve the evicted series. It uses the series recreated with the same labels if
+// there is one, and fails otherwise.
+func TestSeriesEviction_ExemplarAppendRetriesAfterEviction(t *testing.T) {
+	for appName, appendExemplar := range evictionTestExemplarAppenders() {
+		for _, recreated := range []bool{true, false} {
+			t.Run(fmt.Sprintf("%s/recreated=%t", appName, recreated), func(t *testing.T) {
+				testDB := newSeriesEvictionTestDB(t, 0)
+				db := testDB.db
+				head := db.Head()
+				oldRef := testDB.evictedRefs[0]
+				lset := evictionTestLabels(0)
+				oldSeries := head.series.getByID(chunks.HeadSeriesRef(oldRef))
+				require.NotNil(t, oldSeries)
+
+				lookupDone := make(chan struct{})
+				resumeAppend := make(chan struct{})
+				// Pause after the appender resolves the old series, before it reserves it.
+				head.testAfterSeriesLookup = func(series *memSeries) {
```

---

### Incident Patch 2: `f1486b67` (2026-11-23)
**Commit Message**: Merge pull request #20469 from roidelapluie/roidelapluie/wal-replay-tombstoned-exemplars

tsdb: delete tombstoned series after replaying their exemplars

**File**: `tsdb/head_wal.go` (modified, +37/-12)
```diff
@@ -97,7 +97,9 @@ func (h *Head) loadWAL(r *wlog.Reader, syms *labels.SymbolTable, multiRef map[ch
 		wg             sync.WaitGroup
 		concurrency    = h.opts.WALReplayConcurrency
 		processors     = make([]walSubsetProcessor, concurrency)
-		exemplarsInput chan record.RefExemplar
+		exemplarsInput chan exemplarReplayItem
+		// Closed when the exemplar worker exits.
+		exemplarsDone = make(chan struct{})
 
 		shards          = make([][]record.RefSample, concurrency)
 		histogramShards = make([][]histogramRecord, concurrency)
@@ -110,10 +112,12 @@ func (h *Head) loadWAL(r *wlog.Reader, syms *labels.SymbolTable, multiRef map[ch
 		// For CorruptionErr ensure to terminate all workers before exiting.
 		_, ok := err.(*wlog.CorruptionErr)
 		if ok || seriesCreationErr != nil {
+			// The exemplar worker forwards deletions to the processors, so it must exit first.
+			close(exemplarsInput)
+			<-exemplarsDone
 			for i := range concurrency {
 				processors[i].closeAndDrain()
 			}
-			close(exemplarsInput)
 			wg.Wait()
 		}
 	}()
@@ -132,13 +136,19 @@ func (h *Head) loadWAL(r *wlog.Reader, syms *labels.SymbolTable, multiRef map[ch
 		}(&processors[i])
 	}
 
-	wg.Add(1)
-	exemplarsInput = make(chan record.RefExemplar, 300)
-	go func(input <-chan record.RefExemplar) {
+	exemplarsInput = make(chan exemplarReplayItem, 300)
+	go func(input <-chan exemplarReplayItem) {
 		missingSeries := make(map[chunks.HeadSeriesRef]struct{})
 		var err error
-		defer wg.Done()
-		for e := range input {
+		defer close(exemplarsDone)
+		for in := range input {
+			if len(in.deletedSeriesRefs) > 0 {
+				// The exemplars preceding the tombstone have been processed, so the
+				// processor owning the series can delete them.
+				processors[in.shard].input <- walSubsetProcessorInputItem{deletedSeriesRefs: in.deletedSeriesRefs}
+				continue
+			}
+			e := in.exemplar
 			ms := h.series.getByID(e.Ref)
 			if ms == nil {
 				unknownExemplarRefs.Inc()
@@ -336,8 +346,8 @@ Outer:
 					if series := h.series.getByID(ref); series != nil {
 						// Remove the series from the hash index so that a later series
 						// record with the same labels creates a fresh series instead of
-						// mapping onto this one. It stays in the by-ref map so
-						// already-queued samples still resolve until the deletion applies.
+						// mapping onto this one. It stays in the by-ref map so already-queued
+						// samples and exemplars still resolve until the deletion applies.
 						h.series.unlinkHash(series.lset.Hash(), ref)
 						mod := uint64(ref) % uint64(concurrency)
 						deleteSeriesShards[mod] = append(deleteSeriesShards[mod], ref)
@@ -364,7 +374,12 @@ Outer:
 
 			for i := range concurrency {
 				if len(deleteSeriesShards[i]) > 0 {
-					processors[i].input <- walSubsetProcessorInputItem{deletedSeriesRefs: deleteSeriesShards[i]}
+					// Exemplars are replayed by a separate worker. Route the deletion
+					// through it, so that the exemplars preceding the tombstone still
+					// find their series. Records following the tombstone for the same
+					// series, which are not expected, may still be applied to the
+					// series before its deletion.
+					exemplarsInput <- exemplarReplayItem{deletedSeriesRefs: deleteSeriesShards[i], shard: i}
 					deleteSeriesShards[i] = nil
 				}
 			}
@@ -381,7 +396,7 @@ Outer:
 					h.updateWALExpiry(e.Ref, e.T)
 					e.Ref = r
 				}
-				exemplarsInput <- e
+				exemplarsInput <- exemplarReplayItem{exemplar: e}
 			}
 			for i := range v { // Zero out to avoid retaining label data.
 				v[i].Labels = labels.EmptyLabels()
@@ -495,10 +510,12 @@ Outer:
 	}
 
 	// Signal termination to each worker and wait for it to close its output channel.
+	// The exemplar worker forwards deletions to the processors, so it must exit first.
+	close(exemplarsInput)
+	<-exemplarsDone
 	for i := range concurrency {
 		processors[i].closeAndDrain()
 	}
-	close(exemplarsInput)
 	wg.Wait()
 
 	if err := r.Err(); err != nil {
@@ -644,6 +661,14 @@ type walSubsetProcessor struct {
 	histogramsOutput chan []histogramRecord
 }
 
+// exemplarReplayItem is either an exemplar, or series deleted by tombstones that the
+// exemplar worker forwards to the processor of the given shard.
+type exemplarReplayItem struct {
+	exemplar          record.RefExemplar
+	deletedSeriesRefs []chunks.HeadSeriesRef
+	shard             int
+}
+
 type walSubsetProcessorInputItem struct {
 	samples           []record.RefSample
 	histogramSamples  []histogramRecord
```

**File**: `tsdb/head_wal_replay_test.go` (modified, +86/-0)
```diff
@@ -14,20 +14,28 @@
 package tsdb
 
 import (
+	"context"
 	"fmt"
 	"math"
 	"os"
+	"strconv"
+	"sync"
 	"testing"
 	"time"
 
 	prom_testutil "github.com/prometheus/client_golang/prometheus/testutil"
 	"github.com/stretchr/testify/require"
+	"go.uber.org/atomic"
 
+	"github.com/prometheus/prometheus/model/exemplar"
 	"github.com/prometheus/prometheus/model/labels"
 	"github.com/prometheus/prometheus/storage"
 	"github.com/prometheus/prometheus/tsdb/chunkenc"
 	"github.com/prometheus/prometheus/tsdb/chunks"
+	"github.com/prometheus/prometheus/tsdb/record"
+	"github.com/prometheus/prometheus/tsdb/tombstones"
 	"github.com/prometheus/prometheus/tsdb/wlog"
+	"github.com/prometheus/prometheus/util/compression"
 )
 
 func TestWALReplayPreservesMappedChunksAcrossSeriesRefs(t *testing.T) {
@@ -207,3 +215,81 @@ func TestMergeReplayMmappedChunks(t *testing.T) {
 		})
 	}
 }
+
+// recordingExemplarStorage records the series of the exemplars added to it.
+type recordingExemplarStorage struct {
+	ExemplarStorage
+	added sync.Map
+}
+
+func (s *recordingExemplarStorage) AddExemplar(l labels.Labels, e exemplar.Exemplar) error {
+	err := s.ExemplarStorage.AddExemplar(l, e)
+	if err == nil {
+		s.added.Store(l.String(), struct{}{})
+	}
+	return err
+}
+
+// exemplarCheckingSeriesCallback counts the deleted series whose exemplar has not been added yet.
+type exemplarCheckingSeriesCallback struct {
+	// Keep missing first so that it is 64-bit aligned on 32-bit platforms.
+	missing atomic.Int64
+	noopSeriesLifecycleCallback
+	exemplars *recordingExemplarStorage
+}
+
+func (c *exemplarCheckingSeriesCallback) PostDeletion(deleted map[chunks.HeadSeriesRef]labels.Labels) {
+	for _, l := range deleted {
+		if _, ok := c.exemplars.added.Load(l.String()); !ok {
+			c.missing.Inc()
+		}
+	}
+}
+
+// TestHead_WALReplay_ExemplarsBeforeFullRangeTombstone verifies that a series deleted by
+// a full-range tombstone during WAL replay is only deleted after the exemplars preceding
+// the tombstone have been replayed, so that they are not counted as unknown references.
+func TestHead_WALReplay_ExemplarsBeforeFullRangeTombstone(t *testing.T) {
+	// The exemplar of the last series is queued behind the others when its tombstone
+	// is replayed.
+	const numSeries = 1000
+	series := make([]record.RefSeries, 0, numSeries)
+	samples := make([]record.RefSample, 0, numSeries)
+	exemplars := make([]record.RefExemplar, 0, numSeries)
+	for i := range numSeries {
+		ref := chunks.HeadSeriesRef(i + 1)
+		series = append(series, record.RefSeries{Ref: ref, Labels: labels.FromStrings("a", strconv.Itoa(i))})
+		samples = append(samples, record.RefSample{Ref: ref, T: 100, V: 1})
+		exemplars = append(exemplars, record.RefExemplar{Ref: ref, T: 100, V: 1, Labels: labels.FromStrings("trace_id", strconv.Itoa(i))})
+	}
+	stones := []tombstones.Stone{{Ref: numSeries, Intervals: tombstones.Intervals{{Mint: math.MinInt64, Maxt: math.MaxInt64}}}}
+	entries := []any{series, samples, exemplars, stones}
+
+	cb := &exemplarCheckingSeriesCallback{}
+	opts := newTestHeadDefaultOptions(1000, false)
+	opts.SeriesCallback = cb
+	head, w := newTestHeadWithOptions(t, compression.None, opts)
+	defer func() {
+		require.NoError(t, head.Close())
+	}()
+	populateTestWL(t, w, entries, nil, false)
+
+	cb.exemplars = &recordingExemplarStorage{ExemplarStorage: head.exemplars}
+	head.exemplars = cb.exemplars
+
+	require.NoError(t, head.Init(math.MinInt64))
+
+	require.Equal(t, uint64(numSeries-1), head.NumSeries())
+	require.Zero(t, cb.missing.Load(), "series must not be deleted before their exemplars are replayed")
+	require.Zero(t, prom_testutil.ToFloat64(head.metrics.walReplayUnknownRefsTotal.WithLabelValues("exemplars")))
+
+	q, err := head.ExemplarQuerier(context.Background())
+	require.NoError(t, err)
+	res, err := q.Select(0, 100, []*labels.Matcher{labels.MustNewMatcher(labels.MatchRegexp, "a", ".+")})
+	require.NoError(t, err)
+	require.Len(t, res, numSeries)
+	for _, r := range res {
+		require.Len(t, r.Exemplars, 1)
+		require.Equal(t, r.SeriesLabels.Get("a"), r.Exemplars[0].Labels.Get("trace_id"))
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #20541** (2026-11-23): tsdb: protect series with pending exemplars from eviction (@roidelapluie)
- **PR #20536** (2026-11-23): otlp: drop metrics with unsupported temporality instead of rejecting the request (@r0h1tb)
- **PR #20521** (2026-11-20): cmd/prometheus: pass --scrape.discovery-reload-interval=100ms in scrape tests (@machine424)
- **PR #20520** (2026-11-20): tsdb: downgrade compaction cancel log from error to info on shutdown (@machine424)
- **PR #20512** (closed): tsdb: honor full-range tombstones during exemplar replay (@aknuds1)
- **PR #20499** (2026-11-19): ui: fix function signatures in the codemirror-promql lint table (@BahaaMattar)

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

## X. Empirical Invariant Guard in head.go

**RULE**:
When implementing operations in `tsdb/head.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in prometheus/prometheus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a5022ef6`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `tsdb/head.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	exemplarsPool       zeropool.Pool[[]exemplarWithSeries]
	s.updateExemplarTimestampLocked(ts)
	s.Unlock()
}

// updateExemplarTimestampLocked records the latest exemplar time.
// Must be called with the series lock held.
func (s *memSeries) updateExemplarTimestampLocked(ts int64) {
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	exemplarsPool       zeropool.Pool[[]exemplarWithSeriesRef]
	s.Unlock()
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a5022ef6` are properly handled with clean fallback behavior.
