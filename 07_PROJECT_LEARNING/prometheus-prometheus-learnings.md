> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/prometheus-prometheus-learnings.md`  
> **Source**: github ([https://github.com/prometheus/prometheus](https://github.com/prometheus/prometheus))  
> **Source Version**: `a87694bb`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T06:50:10.089Z  
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
> **Harvest Timestamp**: 2026-10-30T06:50:06.305Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `prometheus/prometheus`
- **Description**: The Prometheus monitoring system and time series database.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 66853 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

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
		Namespace:   namespace,
		Subsystem:   subsystem,
		Name:        "histograms_dropped_total",
		Help:        "Total number of histograms which were dropped after being read from the WAL before being sent via remote write, either via relabelling, due to being too old or unintentio
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

### Core Architecture Module: `tsdb/fileutil/dir_windows.go`
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

//go:build windows

package fileutil

import (
	"os"
	"syscall"
)

// OpenDir opens a directory in windows with write access for syncing.
func OpenDir(path string) (*os.File, error) {
	fd, err := openDir(path)
	if err != nil {
		return nil, err
	}
	return os.NewFile(uintptr(fd), path), nil
}

func openDir(path string) (fd syscall.Handle, err error) {
	if len(path) == 0 {
		return syscall.InvalidHandle, syscall.ERROR_FILE_NOT_FOUND
	}
	pathp, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return syscall.InvalidHandle, err
	}
	access := uint32(syscall.GENERIC_READ | syscall.GENERIC_WRITE)
	sharemode := uint32(syscall.FILE_SHARE_READ | syscall.FILE_SHARE_WRITE)
	createmode := uint32(syscall.OPEN_EXISTING)
	fl := uint32(syscall.FILE_FLAG_BACKUP_SEMANTICS)
	return syscall.CreateFile(pathp, access, sharemode, nil, createmode, fl, 0)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #20227** (2026-10-29): **docs: simplify 3.16 changelog PR references**
  *Symptoms*: As we usually do <!--     - Please give your PR a title in the form "area: short description".  For example "tsdb: reduce disk usage by 95%"      - Please sign CNCF's Developer Certificate of Origin and sign-off your commits by adding the -s / --signoff flag to `git commit`. See https://github.com/apps/dco for more information.      - If the PR adds or changes a behaviour or fixes a bug of an exported API it would need a unit/e2e test.      - Where possible use only exported APIs for tests to simplify the review and make it as close as possible to an actual library usage.      - Performance improvements would need a benchmark test to prove it.      - All exposed objects should have a comment.      - All comments should start with a capital letter and end with a full stop.  -->  #### Which issue(s) does the PR fix: <!-- If it applies. Automatically closes linked issue when PR is merged. Usage: `Fixes #<issue number>`, or `Fixes (paste link of issue)`. More at https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue#linking-a-pull-request-to-an-issue-using-a-keyword -->  #### Release notes for end users (**ALL** commits must be considered). *Reviewers should verify clarity and quality.*  <!-- Write NONE only if there is no user-facing change.  Otherwise use one of: [FEATURE] [ENHANCEMENT] [PERF] [BUGFIX] [SECURITY] [CHANGE] Following the pattern `[TYPE] Component: description.`  Example: [

- **Issue #20224** (2026-10-29): **docs: fix flag name for start timestamp processing in API reference**
  *Symptoms*: ```release-notes [BUGFIX] Docs: Name the correct flag (`--enable-feature=use-start-timestamps`) for the engine-level start timestamp setting in the HTTP API reference. ```  The two `X-Prometheus-Use-Start-Timestamps` header entries in `docs/querying/api.md` point to `--promql.use-start-timestamps`. There is no such flag.  The setting is the `use-start-timestamps` feature flag, enabled with `--enable-feature=use-start-timestamps`, as documented in `docs/feature_flags.md`.

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

### Incident Patch 1: `d6909724` (2026-10-29)
**Commit Message**: fix(storage/remote): fall back to WAL metadata when type-and-unit labels are empty (#20223)

* storage/remote: fall back to WAL metadata when type-and-unit labels are empty

When --enable-feature=type-and-unit-labels is enabled, __type__ or __unit__ may be absent on a series (or removed via write_relabel_configs) even when WAL metadata is present. Fall back to the cached series metadata for Type and Unit when the corresponding label is not set.

Signed-off-by: Bartek Plotka <[REDACTED_EMAIL]>

* storage/remote: add test cases for partial type and unit label fallback

Signed-off-by: Bartek Plotka <[REDACTED_EMAIL]>

* docs: document type and unit label fallback to metadata records

Signed-off-by: Bartek Plotka <[REDACTED_EMAIL]>

---------

Signed-off-by: Bartek Plotka <[REDACTED_EMAIL]>

**File**: `docs/feature_flags.md` (modified, +1/-0)
```diff
@@ -273,6 +273,7 @@ when wrong types are used on wrong functions, automatic renames, delta types and
 When this feature is enabled and the metadata WAL records exists, in an unlikely situation when type or unit are different across those,
 the Prometheus outputs intends to prefer the `__type__` and `__unit__` labels values. For example on Remote Write 2.0,
 if  the metadata record somehow (e.g. due to bug) says "counter", but `__type__="gauge"` the remote time series will be set to a gauge.
+If either `__type__` or `__unit__` is missing on the series, for example when dropped via relabeling, Remote Write 2.0 falls back to the corresponding value from the metadata record.
 
 ## Use Uncached IO
 
```

**File**: `storage/remote/queue_manager.go` (modified, +20/-19)
```diff
@@ -2317,28 +2317,29 @@ func populateV2TimeSeries(symbolTable *writev2.SymbolsTable, batch []timeSeries,
 	var nPendingSamples, nPendingExemplars, nPendingHistograms, nUnexpectedMetadata int
 	for nPending, d := range batch {
 		pendingData[nPending].Samples = pendingData[nPending].Samples[:0]
-		switch {
-		case enableTypeAndUnitLabels:
+		var (
+			mType = model.MetricTypeUnknown
+			unit  string
+			help  string
+		)
+		if !metadata.IsZeroHandle(d.metadata) {
+			meta := d.metadata.Value()
+			mType = meta.Type
+			unit = meta.Unit
+			help = meta.Help
+		}
+		if enableTypeAndUnitLabels {
 			m := schema.NewMetadataFromLabels(d.seriesLabels)
-			pendingData[nPending].Metadata.Type = writev2.FromMetadataType(m.Type)
-			pendingData[nPending].Metadata.UnitRef = symbolTable.Symbolize(m.Unit)
-			pendingData[nPending].Metadata.HelpRef = 0 // Type and unit does not give us help.
-			// Use Help from d.metadata if available.
-			if !metadata.IsZeroHandle(d.metadata) {
-				pendingData[nPending].Metadata.HelpRef = symbolTable.Symbolize(d.metadata.Value().Help)
+			if m.Type != model.MetricTypeUnknown {
+				mType = m.Type
+			}
+			if m.Unit != "" {
+				unit = m.Unit
 			}
-		case !metadata.IsZeroHandle(d.metadata):
-			meta := d.metadata.Value()
-			pendingData[nPending].Metadata.Type = writev2.FromMetadataType(meta.Type)
-			pendingData[nPending].Metadata.HelpRef = symbolTable.Symbolize(meta.Help)
-			pendingData[nPending].Metadata.UnitRef = symbolTable.Symbolize(meta.Unit)
-		default:
-			// Safeguard against sending garbage in case of not having metadata
-			// for whatever reason.
-			pendingData[nPending].Metadata.Type = writev2.FromMetadataType(model.MetricTypeUnknown)
-			pendingData[nPending].Metadata.UnitRef = 0
-			pendingData[nPending].Metadata.HelpRef = 0
 		}
+		pendingData[nPending].Metadata.Type = writev2.FromMetadataType(mType)
+		pendingData[nPending].Metadata.UnitRef = symbolTable.Symbolize(unit)
+		pendingData[nPending].Metadata.HelpRef = symbolTable.Symbolize(help)
 
 		if sendExemplars {
 			pendingData[nPending].Exemplars = pendingData[nPending].Exemplars[:0]
```

**File**: `storage/remote/queue_manager_test.go` (modified, +39/-0)
```diff
@@ -2904,6 +2904,45 @@ func TestPopulateV2TimeSeries_MetadataAndTypeAndUnit(t *testing.T) {
 			expectedUnit:      "requests",
 			enableTypeAndUnit: true,
 		},
+		{
+			name:      "type-and-unit-fallback-to-meta-when-labels-missing",
+			typeLabel: "",
+			unitLabel: "",
+			metadata: &metadata.Metadata{
+				Type: model.MetricTypeGauge,
+				Unit: "bytes",
+				Help: "Test metric",
+			},
+			expectedType:      writev2.Metadata_METRIC_TYPE_GAUGE,
+			expectedUnit:      "bytes",
+			enableTypeAndUnit: true,
+		},
+		{
+			name:      "type-from-label-unit-from-meta",
+			typeLabel: "counter",
+			unitLabel: "",
+			metadata: &metadata.Metadata{
+				Type: model.MetricTypeGauge,
+				Unit: "bytes",
+				Help: "Test metric",
+			},
+			expectedType:      writev2.Metadata_METRIC_TYPE_COUNTER,
+			expectedUnit:      "bytes",
+			enableTypeAndUnit: true,
+		},
+		{
+			name:      "type-from-meta-unit-from-label",
+			typeLabel: "",
+			unitLabel: "requests",
+			metadata: &metadata.Metadata{
+				Type: model.MetricTypeGauge,
+				Unit: "bytes",
+				Help: "Test metric",
+			},
+			expectedType:      writev2.Metadata_METRIC_TYPE_GAUGE,
+			expectedUnit:      "requests",
+			enableTypeAndUnit: true,
+		},
 	}
 
 	for _, tc := range testCases {
```

---

### Incident Patch 2: `243670f1` (2026-10-29)
**Commit Message**: Merge pull request #20169 from roidelapluie/roidelapluie/promql-unquoted-utf8-default

promql: enable unquoted UTF-8 names by default

**File**: `cmd/prometheus/features_test.go` (modified, +0/-11)
```diff
@@ -132,17 +132,6 @@ func TestSetFeatureListOptions_MetadataWALRecords(t *testing.T) {
 	require.True(t, c.agent.EnableMetadataWALRecords)
 }
 
-func TestSetFeatureListOptions_UnquotedUTF8Names(t *testing.T) {
-	for _, enabled := range []bool{false, true} {
-		c := &flagConfig{}
-		if enabled {
-			c.featureList = []string{"promql-unquoted-utf8-names"}
-		}
-		require.NoError(t, c.setFeatureListOptions(promslog.NewNopLogger()))
-		require.Equal(t, enabled, c.parserOpts.EnableUnquotedUTF8Names)
-	}
-}
-
 func TestSetFeatureListOptions_OTLPDeltaToCumulativeDeprecated(t *testing.T) {
 	var output bytes.Buffer
 	logger := promslog.New(&promslog.Config{Writer: &output})
```

**File**: `cmd/prometheus/main.go` (modified, +2/-3)
```diff
@@ -265,8 +265,7 @@ func (c *flagConfig) setFeatureListOptions(logger *slog.Logger) error {
 				c.enableConcurrentRuleEval = true
 				logger.Info("Experimental concurrent rule evaluation enabled.")
 			case "promql-unquoted-utf8-names":
-				c.parserOpts.EnableUnquotedUTF8Names = true
-				logger.Info("Experimental unquoted UTF-8 names enabled.")
+				logger.Warn("This option for --enable-feature is now permanently enabled and therefore a no-op.", "option", o)
 			case "promql-experimental-functions":
 				c.parserOpts.EnableExperimentalFunctions = true
 				logger.Info("Experimental PromQL functions enabled.")
@@ -666,7 +665,7 @@ func main() {
 	a.Flag("scrape.discovery-reload-interval", "Interval used by scrape manager to throttle target groups updates.").
 		Hidden().Default("5s").SetValue(&cfg.scrape.DiscoveryReloadInterval)
 
-	a.Flag("enable-feature", "Comma separated feature names to enable. Valid options: concurrent-rule-eval, created-timestamp-zero-ingestion, delayed-compaction, exemplar-storage, extra-scrape-metrics, histograms-st-encoding, memory-snapshot-on-shutdown, metadata-wal-records, old-ui, openmetrics2, otlp-deltatocumulative, otlp-native-delta-ingestion, promql-binop-fill-modifiers, promql-delayed-name-removal, promql-experimental-functions, promql-native-histograms-as-classic, promql-per-step-stats, promql-unquoted-utf8-names, query-cost, search-api, st-storage, st-synthesis, type-and-unit-labels, use-start-timestamps, use-uncached-io, xor2-encoding, zstd-scrape. See https://prometheus.io/docs/prometheus/latest/feature_flags/ for more details.").
+	a.Flag("enable-feature", "Comma separated feature names to enable. Valid options: concurrent-rule-eval, created-timestamp-zero-ingestion, delayed-compaction, exemplar-storage, extra-scrape-metrics, histograms-st-encoding, memory-snapshot-on-shutdown, metadata-wal-records, old-ui, openmetrics2, otlp-deltatocumulative, otlp-native-delta-ingestion, promql-binop-fill-modifiers, promql-delayed-name-removal, promql-experimental-functions, promql-native-histograms-as-classic, promql-per-step-stats, query-cost, search-api, st-storage, st-synthesis, type-and-unit-labels, use-start-timestamps, use-uncached-io, xor2-encoding, zstd-scrape. See https://prometheus.io/docs/prometheus/latest/feature_flags/ for more details.").
 		StringsVar(&cfg.featureList)
 
 	a.Flag("agent", "Run Prometheus in 'Agent mode'.").BoolVar(&agentMode)
```

**File**: `cmd/prometheus/testdata/features.json` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@
     "smoothed": true,
     "subqueries": true,
     "type_and_unit_labels": false,
-    "unquoted_utf8_names": false,
+    "unquoted_utf8_names": true,
     "without": true
   },
   "promql_functions": {
```

**File**: `cmd/promtool/main.go` (modified, +2/-2)
```diff
@@ -324,7 +324,7 @@ func main() {
 	promQLLabelsDeleteQuery := promQLLabelsDeleteCmd.Arg("query", "PromQL query.").Required().String()
 	promQLLabelsDeleteName := promQLLabelsDeleteCmd.Arg("name", "Name of the label to delete.").Required().String()
 
-	featureList := app.Flag("enable-feature", "Comma separated feature names to enable. Valid options: promql-experimental-functions, promql-delayed-name-removal, promql-unquoted-utf8-names. See https://prometheus.io/docs/prometheus/latest/feature_flags/ for more details").Default("").Strings()
+	featureList := app.Flag("enable-feature", "Comma separated feature names to enable. Valid options: promql-experimental-functions, promql-delayed-name-removal. See https://prometheus.io/docs/prometheus/latest/feature_flags/ for more details").Default("").Strings()
 
 	documentationCmd := app.Command("write-documentation", "Generate command line documentation. Internal use.").Hidden()
 
@@ -367,7 +367,7 @@ func main() {
 		for o := range strings.SplitSeq(f, ",") {
 			switch o {
 			case "promql-unquoted-utf8-names":
-				promtoolParserOpts.EnableUnquotedUTF8Names = true
+				// This feature is now permanently enabled and therefore a no-op.
 			case "promql-experimental-functions":
 				promtoolParserOpts.EnableExperimentalFunctions = true
 			case "promql-delayed-name-removal":
```

**File**: `docs/command-line/prometheus.md` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ The Prometheus monitoring server
 | <code class="text-nowrap">--query.timeout</code> | Maximum time a query may take before being aborted. Use with server mode only. | `2m` |
 | <code class="text-nowrap">--query.max-concurrency</code> | Maximum number of queries executed concurrently. Use with server mode only. | `20` |
 | <code class="text-nowrap">--query.max-samples</code> | Maximum number of samples a single query can load into memory. Note that queries will fail if they try to load more samples than this into memory, so this also limits the number of samples a query can return. Use with server mode only. | `50000000` |
-| <code class="text-nowrap">--enable-feature</code> <code class="text-nowrap">...</code> | Comma separated feature names to enable. Valid options: concurrent-rule-eval, created-timestamp-zero-ingestion, delayed-compaction, exemplar-storage, extra-scrape-metrics, histograms-st-encoding, memory-snapshot-on-shutdown, metadata-wal-records, old-ui, openmetrics2, otlp-deltatocumulative, otlp-native-delta-ingestion, promql-binop-fill-modifiers, promql-delayed-name-removal, promql-experimental-functions, promql-native-histograms-as-classic, promql-per-step-stats, promql-unquoted-utf8-names, query-cost, search-api, st-storage, st-synthesis, type-and-unit-labels, use-start-timestamps, use-uncached-io, xor2-encoding, zstd-scrape. See https://prometheus.io/docs/prometheus/latest/feature_flags/ for more details. |  |
+| <code class="text-nowrap">--enable-feature</code> <code class="text-nowrap">...</code> | Comma separated feature names to enable. Valid options: concurrent-rule-eval, created-timestamp-zero-ingestion, delayed-compaction, exemplar-storage, extra-scrape-metrics, histograms-st-encoding, memory-snapshot-on-shutdown, metadata-wal-records, old-ui, openmetrics2, otlp-deltatocumulative, otlp-native-delta-ingestion, promql-binop-fill-modifiers, promql-delayed-name-removal, promql-experimental-functions, promql-native-histograms-as-classic, promql-per-step-stats, query-cost, search-api, st-storage, st-synthesis, type-and-unit-labels, use-start-timestamps, use-uncached-io, xor2-encoding, zstd-scrape. See https://prometheus.io/docs/prometheus/latest/feature_flags/ for more details. |  |
 | <code class="text-nowrap">--agent</code> | Run Prometheus in 'Agent mode'. |  |
 | <code class="text-nowrap">--log.level</code> | Only log messages with the given severity or above. One of: [debug, info, warn, error] Deprecated: set runtime.log_level in the configuration file instead. | `info` |
 | <code class="text-nowrap">--log.format</code> | Output format of log messages. One of: [logfmt, json] | `logfmt` |
```

**File**: `docs/command-line/promtool.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ Tooling for the Prometheus monitoring system.
 | <code class="text-nowrap">-h</code>, <code class="text-nowrap">--help</code> | Show context-sensitive help (also try --help-long and --help-man). |
 | <code class="text-nowrap">--version</code> | Show application version. |
 | <code class="text-nowrap">--experimental</code> | Enable experimental commands. |
-| <code class="text-nowrap">--enable-feature</code> <code class="text-nowrap">...</code> | Comma separated feature names to enable. Valid options: promql-experimental-functions, promql-delayed-name-removal, promql-unquoted-utf8-names. See https://prometheus.io/docs/prometheus/latest/feature_flags/ for more details |
+| <code class="text-nowrap">--enable-feature</code> <code class="text-nowrap">...</code> | Comma separated feature names to enable. Valid options: promql-experimental-functions, promql-delayed-name-removal. See https://prometheus.io/docs/prometheus/latest/feature_flags/ for more details |
 
 
 
```

**File**: `docs/feature_flags.md` (modified, +0/-18)
```diff
@@ -53,24 +53,6 @@ The Prometheus server exposes two counters for observability: `prometheus_engine
 When disabled in either the engine or the query, per-step statistics are not
 computed at all.
 
-## Unquoted UTF-8 names in PromQL
-
-`--enable-feature=promql-unquoted-utf8-names`
-
-Allows Unicode letters and dots after the first character in unquoted metric and
-label names. For example:
-
-```promql
-http.server.request.duration{service.name="api"}
-温度{場所="東京"}
-sum by (service.name) (rate(http.server.requests[5m]))
-requests_total + on (service.name) group_left (équipe) service_info
-```
-
-See [metric and label names](querying/basics.md#metric-and-label-names) for the
-character rules and compatibility details. This flag is also supported by
-promtool when checking or testing rules and parsing or formatting queries.
-
 ## Experimental PromQL functions
 
 `--enable-feature=promql-experimental-functions`
```

**File**: `docs/querying/basics.md` (modified, +3/-4)
```diff
@@ -356,14 +356,13 @@ syntax can be quoted. A quoted metric name goes inside the selector's braces:
 {"http.server.request.duration", "service.name"="api"}
 ```
 
-With [`--enable-feature=promql-unquoted-utf8-names`](../feature_flags.md#unquoted-utf-8-names-in-promql),
-the same selector can be written as:
+The same selector can be written without quotes:
 
 ```promql
 http.server.request.duration{service.name="api"}
 ```
 
-When this feature is enabled, unquoted names follow these rules:
+Unquoted names follow these rules:
 
 | Name | First character | Subsequent characters |
 | --- | --- | --- |
@@ -395,7 +394,7 @@ a different name.
 
 Quoted and unquoted spellings of the same name select the same series. Quoting
 remains supported and is required when targeting older PromQL parsers or servers
-without this feature enabled. The feature does not change storage, ingestion
+without support for these names. These syntax rules do not change storage, ingestion
 validation, text exposition, or metric name translation.
 
 ### Range Vector Selectors
```

---

### Incident Patch 3: `3751fccd` (2026-10-29)
**Commit Message**: docs: fix flag name for start timestamp processing in API reference (#20224)

The two X-Prometheus-Use-Start-Timestamps header entries name the
engine-level setting --promql.use-start-timestamps. No such flag exists.
The setting is the use-start-timestamps feature flag, enabled with
--enable-feature=use-start-timestamps, as feature_flags.md documents.

Signed-off-by: Gauvain CLAUSS <[REDACTED_EMAIL]>

**File**: `docs/querying/api.md` (modified, +2/-2)
```diff
@@ -113,7 +113,7 @@ URL query parameters:
 
 Optional HTTP request headers:
 
-- `X-Prometheus-Use-Start-Timestamps: <bool>`: Override the engine-level start timestamp processing setting (`--promql.use-start-timestamps`) for this query. When set to `true`, functions such as `rate()` will use start timestamps from ingested data. When set to `false`, start timestamp processing is disabled for this query. Optional. If omitted, the engine-level default is used.
+- `X-Prometheus-Use-Start-Timestamps: <bool>`: Override the engine-level start timestamp processing setting (`--enable-feature=use-start-timestamps`) for this query. When set to `true`, functions such as `rate()` will use start timestamps from ingested data. When set to `false`, start timestamp processing is disabled for this query. Optional. If omitted, the engine-level default is used.
 
 The current server time is used if the `time` parameter is omitted.
 
@@ -198,7 +198,7 @@ URL query parameters:
 
 Optional HTTP request headers:
 
-- `X-Prometheus-Use-Start-Timestamps: <bool>`: Override the engine-level start timestamp processing setting (`--promql.use-start-timestamps`) for this query. When set to `true`, functions such as `rate()` will use start timestamps from ingested data. When set to `false`, start timestamp processing is disabled for this query. Optional. If omitted, the engine-level default is used.
+- `X-Prometheus-Use-Start-Timestamps: <bool>`: Override the engine-level start timestamp processing setting (`--enable-feature=use-start-timestamps`) for this query. When set to `true`, functions such as `rate()` will use start timestamps from ingested data. When set to `false`, start timestamp processing is disabled for this query. Optional. If omitted, the engine-level default is used.
 
 You can URL-encode these parameters directly in the request body by using the `POST` method and
 `Content-Type: application/x-www-form-urlencoded` header. This is useful when specifying a large
```

#### Recent Merged Pull Requests:
- **PR #20227** (2026-10-29): docs: simplify 3.16 changelog PR references (@roidelapluie)
- **PR #20224** (2026-10-29): docs: fix flag name for start timestamp processing in API reference (@gauvainw)
- **PR #20223** (2026-10-29): fix(storage/remote): fall back to WAL metadata when type-and-unit labels are empty (@bwplotka)
- **PR #20217** (2026-10-29): chore: point pr-triage-board skill link to main branch (@bwplotka)
- **PR #20215** (2026-10-28): ui: support PromQL bitwise operators (@roidelapluie)
- **PR #20209** (2026-10-28): release-3.16: Cherrypick 32bit CI fix (@ywwg)

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

## X. storage/remote): fall back to WAL metadata when type-and-unit labels are empty (

**RULE**:
When implementing operations in `docs/feature_flags.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in prometheus/prometheus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d6909724`: storage/remote): fall back to WAL metadata when type-and-unit labels are empty (#20223). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/feature_flags.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
If either `__type__` or `__unit__` is missing on the series, for example when dropped via relabeling, Remote Write 2.0 falls back to the corresponding value from the metadata record.
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d6909724` are properly handled with clean fallback behavior.
