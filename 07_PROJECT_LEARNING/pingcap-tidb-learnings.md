> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/pingcap-tidb-learnings.md`  
> **Source**: github ([https://github.com/pingcap/tidb](https://github.com/pingcap/tidb))  
> **Source Version**: `69d1aac2`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-22T17:19:15.903Z  
> **Learning ID**: `learn-github-pingcap-tidb`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): pingcap/tidb

> **Canonical Artifact**: `07_PROJECT_LEARNING/pingcap-tidb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pingcap/tidb](https://github.com/pingcap/tidb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-22T17:19:13.685Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pingcap/tidb`
- **Description**: TiDB is built for agentic workloads that grow unpredictably, with ACID guarantees and native support for transactions, analytics, and vector search. No data silos. No noisy neighbors. No infrastructure ceiling.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 40670 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `br/pkg/conn/util/util.go`
```
// Copyright 2020 PingCAP, Inc. Licensed under Apache-2.0.

package util

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/pingcap/errors"
	"github.com/pingcap/kvproto/pkg/metapb"
	"github.com/pingcap/log"
	berrors "github.com/pingcap/tidb/br/pkg/errors"
	"github.com/pingcap/tidb/br/pkg/logutil"
	"github.com/pingcap/tidb/br/pkg/utils"
	"github.com/pingcap/tidb/pkg/util/engine"
	"github.com/tikv/client-go/v2/oracle"
	pd "github.com/tikv/pd/client"
	"github.com/tikv/pd/client/opt"
	"go.uber.org/zap"
)

// StoreBehavior is the action to do in GetAllTiKVStores when a non-TiKV
// store (e.g. TiFlash store) is found.
type StoreBehavior uint8

const (
	// ErrorOnTiFlash causes GetAllTiKVStores to return error when the store is
	// found to be a TiFlash node.
	ErrorOnTiFlash StoreBehavior = 0
	// SkipTiFlash causes GetAllTiKVStores to skip the store when it is found to
	// be a TiFlash node.
	SkipTiFlash StoreBehavior = 1
	// TiFlashOnly caused GetAllTiKVStores to skip the store which is not a
	// TiFlash node.
	TiFlashOnly StoreBehavior = 2
)

// StoreMeta is the required interface for a watcher.
// It is striped from pd.Client.
type StoreMeta interface {
	// GetAllStores gets all stores from pd.
	// The store may expire later. Caller is responsible for caching and taking care
	// of store change.
	GetAllStores(ctx context.Context, opts ...opt.GetStoreOption) ([]*metapb.Store, error)
}

// GetAllTiKVStores returns all TiKV stores registered to the PD client. The
// stores must not be a tombstone and must never contain a label `engine=tiflash`.
func GetAllTiKVStores(
	ctx context.Context,
	pdClient StoreMeta,
	storeBehavior StoreBehavior,
) ([]*metapb.Store, error) {
	// get all live stores.
	stores, err := pdClient.GetAllStores(ctx, opt.WithExcludeTombstone())
	if err != nil {
		return nil, errors.Trace(err)
	}

	// filter out all stores which are TiFlash.
	j := 0
	for _, store := range stores {
		isTiFlash := false
		if engine.IsTiFlash(store) {
			if storeBehavior == SkipTiFlash {
				continue
			} else if storeBehavior == ErrorOnTiFlash {
				return nil, errors.Annotatef(berrors.ErrPDInvalidResponse,
					"cannot restore to a cluster with active TiFlash stores (store %d at %s)", store.Id, store.Address)
			}
			isTiFlash = true
		}
		if !isTiFlash && storeBehavior == TiFlashOnly {
			continue
		}
		stores[j] = store
		j++
	}
	return stores[:j], nil
}

func GetAllTiKVStoresWithRetry(ctx context.Context,
	pdClient StoreMeta,
	storeBehavior StoreBehavior,
) ([]*metapb.Store, error) {
	stores := make([]*metapb.Store, 0)
	var err error

	errRetry := utils.WithRetry(
		ctx,
		func() error {
			stores, err = GetAllTiKVStores(ctx, pdClient, storeBehavior)
			return errors.Trace(err)
		},
		utils.NewAggressivePDBackoffStrategy(),
	)

	return stores, errors.Trace(errRetry)
}

// GetCurrentTsFromPD gets current ts from PD.
func GetCurrentTsFromPD(ctx context.Context, pdClient pd.Client) (uint64, error) {
	p, l, err := pdClient.GetTS(ctx)
	if err != nil {
		return 0, errors.Trace(err)
	}

	return oracle.ComposeTS(p, l), nil
}

// GetCurrentTsFromPDWithRetry gets current ts from PD with retry.
func GetCurrentTsFromPDWithRetry(ctx context.Context, pdClient pd.Client) (uint64, error) {
	var currentTS uint64
	var retry uint
	err := utils.WithRetry(ctx, func() error {
		ts, err := GetCurrentTsFromPD(ctx, pdClient)
		retry++
		if err != nil {
			log.Warn("failed to get current TS from PD, retry it",
				zap.Uint("retry time", retry),
				logutil.ShortError(err))
			return err
		}
		currentTS = ts
		return nil
	}, utils.NewAggressivePDBackoffStrategy())
	if err != nil {
		log.Error("failed to get current TS from PD", zap.Error(err))
	}
	return currentTS, errors.Trace(err)
}

// GetConfigFromTiKVStores gets configs from the specified TiKV stores.
func GetConfigFromTiKVStores(
	ctx context.Context,
	stores []*metapb.Store,
	cli *http.Client,
	httpPrefix string,
	fn func(*http.Response) error,
) error {
	for _, store := range stores {
		if store.State != metapb.StoreState_Up {
			continue
		}
		// We need make sure every available store support backup-stream otherwise we might lose data,
		// so check every store's config.
		addr, err := HandleTiKVAddress(store, httpPrefix)
		if err != nil {
			return err
		}
		configAddr := addr.JoinPath("config").String()

		err = utils.WithRetry(ctx, func() error {
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, configAddr, nil)
			if err != nil {
				return err
			}
			resp, err := cli.Do(req)
			if err != nil {
				return err
			}
			defer resp.Body.Close()
			return fn(resp)
		}, utils.NewAggressivePDBackoffStrategy())
		if err != nil {
			// if one store failed, break and return error
			return err
		}
	}
	return nil
}

// GetConfigBytesFromTiKVStores gets config response bodies from the specified TiKV stores.
func GetConfigBytesFromTiKVStores(
	ctx context.Context,
	stores []*metapb.Store,
	cli *http.Client,
	httpPrefix string,
	collect func([]byte) error,
) error {
	return GetConfigFromTiKVStores(ctx, stores, cli, httpPrefix, func(resp *http.Response) error {
		if resp.StatusCode != http.StatusOK {
			return errors.Errorf("request %s failed: %s", resp.Request.URL.String(), resp.Status)
		}
		respBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return err
		}
		return collect(respBytes)
	})
}

// HandleTiKVAddress returns the TiKV status HTTP address used to fetch configs.
func HandleTiKVAddress(store *metapb.Store, httpPrefix string) (*url.URL, error) {
	statusAddr := store.GetStatusAddress()
	if statusAddr == "" {
		return nil, errors.Errorf("TiKV store %d does not have status address", store.GetId())
	}
	nodeAddr := store.GetAddress()
	if !strings.HasPrefix(statusAddr, "http") {
		statusAddr = httpPrefix + statusAddr
	}
	if !strings.HasPrefix(nodeAddr, "http") {
		nodeAddr = httpPrefix + nodeAddr
	}

	statusURL, err := url.Parse(statusAddr)
	if err != nil {
		return nil, err
	}
	nodeURL, err := url.Parse(nodeAddr)
	if err != nil {
		return nil, err
	}

	// We try status address as default.
	addr := statusURL
	// But sometimes we may not get the correct status address from PD.
	if statusURL.Hostname() != nodeURL.Hostname() {
		// If not matched, use the address hostname but keep the status port.
		addr.Host = net.JoinHostPort(nodeURL.Hostname(), statusURL.Port())
		log.Warn("store address and status address mismatch the host, we will use the store address as hostname",
			zap.Uint64("store", store.Id),
			zap.String("status address", statusAddr),
			zap.String("node address", nodeAddr),
			zap.Any("request address", statusURL))
	}
	return addr, nil
}

```

### Core Architecture Module: `br/pkg/logutil/context.go`
```
// Copyright 2020 PingCAP, Inc. Licensed under Apache-2.0.

package logutil

import (
	"context"

	"github.com/pingcap/log"
	"go.uber.org/zap"
)

// We cannot directly set global logger as log.L(),
// or when the global logger updated, we cannot get the latest logger.
var globalLogger *zap.Logger

// ResetGlobalLogger resets the global logger.
// Contexts have already made by `ContextWithField` would keep untouched,
// subsequent wrapping over those contexts would keep using the old global logger,
// only brand new contexts (i.e. context without logger) would be wrapped with the new global logger.
// This method is mainly for testing.
func ResetGlobalLogger(l *zap.Logger) {
	globalLogger = l
}

type loggingContextKey struct{}

var keyLogger = loggingContextKey{}

// ContextWithField wrap a context with a logger with some fields.
func ContextWithField(c context.Context, fields ...zap.Field) context.Context {
	logger := LoggerFromContext(c).With(fields...)
	return context.WithValue(c, keyLogger, logger)
}

// LoggerFromContext returns the contextual logger via the context.
// If there isn't a logger in the context, returns the global logger.
func LoggerFromContext(c context.Context) *zap.Logger {
	logger, ok := c.Value(keyLogger).(*zap.Logger)
	if !ok {
		if globalLogger != nil {
			return globalLogger
		}
		return log.L()
	}
	return logger
}

// CL is the shorthand for LoggerFromContext.
func CL(c context.Context) *zap.Logger {
	return LoggerFromContext(c)
}

```

### Core Architecture Module: `br/pkg/logutil/logging.go`
```
// Copyright 2020 PingCAP, Inc. Licensed under Apache-2.0.

package logutil

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/pingcap/errors"
	backuppb "github.com/pingcap/kvproto/pkg/brpb"
	"github.com/pingcap/kvproto/pkg/import_sstpb"
	"github.com/pingcap/kvproto/pkg/metapb"
	"github.com/pingcap/log"
	"github.com/pingcap/tidb/pkg/kv"
	"github.com/pingcap/tidb/pkg/lightning/metric"
	"github.com/pingcap/tidb/pkg/util/redact"
	"github.com/prometheus/client_golang/prometheus"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// AbbreviatedArrayMarshaler abbreviates an array of elements.
type AbbreviatedArrayMarshaler []string

// MarshalLogArray implements zapcore.ArrayMarshaler.
func (abb AbbreviatedArrayMarshaler) MarshalLogArray(encoder zapcore.ArrayEncoder) error {
	if len(abb) <= 4 {
		for _, e := range abb {
			encoder.AppendString(e)
		}
	} else {
		total := len(abb)
		encoder.AppendString(abb[0])
		encoder.AppendString(fmt.Sprintf("(skip %d)", total-2))
		encoder.AppendString(abb[total-1])
	}
	return nil
}

// AbbreviatedArray constructs a field that abbreviates an array of elements.
func AbbreviatedArray(
	key string, elements any, marshalFunc func(any) []string,
) zap.Field {
	return zap.Array(key, AbbreviatedArrayMarshaler(marshalFunc(elements)))
}

type zapFileMarshaler struct{ *backuppb.File }

func (file zapFileMarshaler) MarshalLogObject(enc zapcore.ObjectEncoder) error {
	enc.AddString("name", file.GetName())
	enc.AddString("CF", file.GetCf())
	enc.AddString("sha256", hex.EncodeToString(file.GetSha256()))
	enc.AddString("startKey", redact.Key(file.GetStartKey()))
	enc.AddString("endKey", redact.Key(file.GetEndKey()))
	enc.AddUint64("startVersion", file.GetStartVersion())
	enc.AddUint64("endVersion", file.GetEndVersion())
	enc.AddUint64("totalKvs", file.GetTotalKvs())
	enc.AddUint64("totalBytes", file.GetTotalBytes())
	enc.AddUint64("CRC64Xor", file.GetCrc64Xor())
	return nil
}

func AbbreviatedStringers[T fmt.Stringer](key string, stringers []T) zap.Field {
	if len(stringers) < 4 {
		return zap.Stringers(key, stringers)
	}
	return zap.Array(key, zapcore.ArrayMarshalerFunc(func(ae zapcore.ArrayEncoder) error {
		ae.AppendString(stringers[0].String())
		ae.AppendString(fmt.Sprintf("(skip %d)", len(stringers)-2))
		ae.AppendString(stringers[len(stringers)-1].String())
		return nil
	}))
}

type zapFilesMarshaler []*backuppb.File

// MarshalLogObjectForFiles is an internal util function to zap something having `Files` field.
func MarshalLogObjectForFiles(files []*backuppb.File, encoder zapcore.ObjectEncoder) error {
	return zapFilesMarshaler(files).MarshalLogObject(encoder)
}

func (fs zapFilesMarshaler) MarshalLogObject(encoder zapcore.ObjectEncoder) error {
	total := len(fs)
	encoder.AddInt("total", total)
	elements := make([]string, 0, total)
	for _, f := range fs {
		elements = append(elements, f.GetName())
	}
	_ = encoder.AddArray("files", AbbreviatedArrayMarshaler(elements))

	totalKVs := uint64(0)
	totalBytes := uint64(0)
	totalSize := uint64(0)
	for _, file := range fs {
		totalKVs += file.GetTotalKvs()
		totalBytes += file.GetTotalBytes()
		totalSize += file.GetSize_()
	}
	encoder.AddUint64("totalKVs", totalKVs)
	encoder.AddUint64("totalBytes", totalBytes)
	encoder.AddUint64("totalSize", totalSize)
	return nil
}

// File make the zap fields for a file.
func File(file *backuppb.File) zap.Field {
	return zap.Object("file", zapFileMarshaler{file})
}

// Files make the zap field for a set of file.
func Files(fs []*backuppb.File) zap.Field {
	return zap.Object("files", zapFilesMarshaler(fs))
}

type zapStreamBackupTaskInfo struct{ *backuppb.StreamBackupTaskInfo }

func (t zapStreamBackupTaskInfo) MarshalLogObject(enc zapcore.ObjectEncoder) error {
	enc.AddString("taskName", t.Name)
	enc.AddUint64("startTs", t.StartTs)
	enc.AddUint64("endTS", t.EndTs)
	enc.AddString("tableFilter", strings.Join(t.TableFilter, ","))
	return nil
}

// StreamBackupTaskInfo makes the zap fields for a stream backup task info.
func StreamBackupTaskInfo(t *backuppb.StreamBackupTaskInfo) zap.Field {
	return zap.Object("streamTaskInfo", zapStreamBackupTaskInfo{t})
}

type zapRewriteRuleMarshaler struct{ *import_sstpb.RewriteRule }

func (rewriteRule zapRewriteRuleMarshaler) MarshalLogObject(enc zapcore.ObjectEncoder) error {
	enc.AddString("oldKeyPrefix", hex.EncodeToString(rewriteRule.GetOldKeyPrefix()))
	enc.AddString("newKeyPrefix", hex.EncodeToString(rewriteRule.GetNewKeyPrefix()))
	enc.AddUint64("newTimestamp", rewriteRule.GetNewTimestamp())
	return nil
}

// RewriteRule make the zap fields for a rewrite rule.
func RewriteRule(rewriteRule *import_sstpb.RewriteRule) zap.Field {
	return zap.Object("rewriteRule", zapRewriteRuleMarshaler{rewriteRule})
}

// RewriteRuleObject make zap object marshaler for a rewrite rule.
func RewriteRuleObject(rewriteRule *import_sstpb.RewriteRule) zapcore.ObjectMarshaler {
	return zapRewriteRuleMarshaler{rewriteRule}
}

type zapMarshalRegionMarshaler struct{ *metapb.Region }

func (region zapMarshalRegionMarshaler) MarshalLogObject(enc zapcore.ObjectEncoder) error {
	peers := make([]string, 0, len(region.GetPeers()))
	for _, peer := range region.GetPeers() {
		peers = append(peers, peer.String())
	}
	enc.AddUint64("ID", region.GetId())
	enc.AddString("startKey", redact.Key(region.GetStartKey()))
	enc.AddString("endKey", redact.Key(region.GetEndKey()))
	enc.AddString("epoch", region.GetRegionEpoch().String())
	enc.AddString("peers", strings.Join(peers, ","))
	return nil
}

// Region make the zap fields for a region.
func Region(region *metapb.Region) zap.Field {
	return zap.Object("region", zapMarshalRegionMarshaler{region})
}

// RegionBy make the zap fields for a region with name.
func RegionBy(key string, region *metapb.Region) zap.Field {
	return zap.Object(key, zapMarshalRegionMarshaler{region})
}

// Leader make the zap fields for a peer as leader.
// nolint:interfacer
func Leader(peer *metapb.Peer) zap.Field {
	return zap.String("leader", peer.String())
}

// Peer make the zap fields for a peer.
func Peer(peer *metapb.Peer) zap.Field {
	return zap.String("peer", peer.String())
}

type zapSSTMetaMarshaler struct{ *import_sstpb.SSTMeta }

func (sstMeta zapSSTMetaMarshaler) MarshalLogObject(enc zapcore.ObjectEncoder) error {
	enc.AddString("CF", sstMeta.GetCfName())
	enc.AddBool("endKeyExclusive", sstMeta.EndKeyExclusive)
	enc.AddUint32("CRC32", sstMeta.Crc32)
	enc.AddUint64("length", sstMeta.Length)
	enc.AddUint64("regionID", sstMeta.RegionId)
	enc.AddString("regionEpoch", sstMeta.RegionEpoch.String())
	enc.AddString("startKey", redact.Key(sstMeta.GetRange().GetStart()))
	enc.AddString("endKey", redact.Key(sstMeta.GetRange().GetEnd()))

	sstUUID, err := uuid.FromBytes(sstMeta.GetUuid())
	if err != nil {
		enc.AddString("UUID", fmt.Sprintf("invalid UUID %s", hex.EncodeToString(sstMeta.GetUuid())))
	} else {
		enc.AddString("UUID", sstUUID.String())
	}
	return nil
}

// SSTMeta make the zap fields for a SST meta.
func SSTMeta(sstMeta *import_sstpb.SSTMeta) zap.Field {
	return zap.Object("sstMeta", zapSSTMetaMarshaler{sstMeta})
}

type zapSSTMetasMarshaler []*import_sstpb.SSTMeta

func (m zapSSTMetasMarshaler) MarshalLogArray(encoder zapcore.ArrayEncoder) error {
	for _, meta := range m {
		if err := encoder.AppendObject(zapSSTMetaMarshaler{meta}); err != nil {
			return errors.Trace(err)
		}
	}
	return nil
}

// Describes the overall range of the SST metas and their size.
func BriefSSTMetas(key string, sstMetas []*import_sstpb.SSTMeta) zap.Field {
	var (
		startKey, endKey []byte
		total            int
		totalSize        uint64
		totalKv          uint64
		totalKvSize      uint64
	)

	for _, meta := range sstMetas {
		if total == 0 {
			startKey = meta.GetRange().GetStart()
			endKey = meta.GetRange().GetEnd()
		}
		if bytes.Compare(meta.GetRange().GetStart(), startKey) < 0 {
			startKey = meta.GetRange().GetStart()
		}
		// NOTE: SST meta shouldn't has an empty end key?
		if bytes.Compare(meta.GetRange().GetEnd(), endKey) > 0 {
			endKey = meta.GetRange().GetEnd()
		}
		totalSize += meta.GetLength()
		totalKv += meta.GetTotalKvs()
		totalKvSize += meta.GetTotalBytes()
		total++
	}
	return zap.Object(key, zapcore.ObjectMarshalerFunc(func(enc zapcore.ObjectEncoder) error {
		enc.AddInt("total", total)
		enc.AddString("startKey", redact.Key(startKey))
		enc.AddString("endKey", redact.Key(endKey))
		enc.AddUint64("totalSize", totalSize)
		enc.AddUint64("totalKvs", totalKv)
		enc.AddUint64("totalKvSize", totalKvSize)
		return nil
	}))
}

// SSTMetas make the zap fields for SST metas.
func SSTMetas(sstMetas []*import_sstpb.SSTMeta) zap.Field {
	return zap.Array("sstMetas", zapSSTMetasMarshaler(sstMetas))
}

type zapKeysMarshaler [][]byte

func (keys zapKeysMarshaler) MarshalLogObject(encoder zapcore.ObjectEncoder) error {
	total := len(keys)
	encoder.AddInt("total", total)
	elements := make([]string, 0, total)
	for _, k := range keys {
		elements = append(elements, redact.Key(k))
	}
	_ = encoder.AddArray("keys", AbbreviatedArrayMarshaler(elements))
	return nil
}

// Key constructs a field that carries upper hex format key.
func Key(fieldKey string, key []byte) zap.Field {
	return zap.String(fieldKey, redact.Key(key))
}

// Keys constructs a field that carries upper hex format keys.
func Keys(keys [][]byte) zap.Field {
	return zap.Object("keys", zapKeysMarshaler(keys))
}

// AShortError make the zap field with key to display error without verbose representation (e.g. the stack trace).
func AShortError(key string, err error) zap.Field {
	if err == nil {
		return zap.Skip()
	}
	return zap.String(key, err.Error())
}

// ShortError make the zap field to display error without verbose representation (e.g. the stack trace).
func ShortError(err error) zap.Field {
	if err == nil {
		return zap.Skip()
	}
	return zap.String("error", err.Error())
}

var loggerToTerm, _, _ = log.InitLogger(new(log.Config), zap.AddCallerSkip(1))

// WarnTe
```

### Core Architecture Module: `br/pkg/logutil/rate.go`
```
package logutil

import (
	"fmt"
	"math"
	"time"

	"github.com/pingcap/log"
	"github.com/pingcap/tidb/pkg/lightning/metric"
	"github.com/prometheus/client_golang/prometheus"
	"go.uber.org/zap"
)

// RateTracer is a trivial rate tracer based on a prometheus counter.
// It traces the average speed from it was created.
type RateTracer struct {
	start time.Time
	base  float64
	prometheus.Counter
}

// TraceRateOver make a trivial rater based on a counter.
// the current value of this counter would be omitted.
func TraceRateOver(counter prometheus.Counter) RateTracer {
	return RateTracer{
		start:   time.Now(),
		Counter: counter,
		base:    metric.ReadCounter(counter),
	}
}

// Rate returns the average rate from when it was created.
func (r *RateTracer) Rate() float64 {
	return r.RateAt(time.Now())
}

// RateAt returns the rate until some instant. This function is mainly for testing.
// WARN: the counter value for calculating is still its CURRENT VALUE.
func (r *RateTracer) RateAt(instant time.Time) float64 {
	if r.Counter == nil {
		return math.NaN()
	}
	return (metric.ReadCounter(r.Counter) - r.base) / instant.Sub(r.start).Seconds()
}

// L make a logger with the current speed.
func (r *RateTracer) L() *zap.Logger {
	return log.L().With(zap.String("speed", fmt.Sprintf("%.2f ops/s", r.Rate())))
}

```

### Core Architecture Module: `br/pkg/metautil/debug.go`
```
// Copyright 2024 PingCAP, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package metautil

import (
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"

	"github.com/gogo/protobuf/proto"
	"github.com/pingcap/errors"
	backuppb "github.com/pingcap/kvproto/pkg/brpb"
	berrors "github.com/pingcap/tidb/br/pkg/errors"
	"github.com/pingcap/tidb/br/pkg/utils"
	"github.com/pingcap/tidb/pkg/objstore/storeapi"
	tidbutil "github.com/pingcap/tidb/pkg/util"
	"golang.org/x/sync/errgroup"
)

const (
	// JSONFileFormat represents json file name format
	JSONFileFormat = "jsons/%s.json"
)

// DecodeStatsFile decodes the stats file to json format, it is called by br debug
func DecodeStatsFile(
	ctx context.Context,
	s storeapi.Storage,
	cipher *backuppb.CipherInfo,
	schemas []*backuppb.Schema,
) error {
	for _, schema := range schemas {
		for _, statsIndex := range schema.StatsIndex {
			if len(statsIndex.Name) == 0 {
				continue
			}
			content, err := s.ReadFile(ctx, statsIndex.Name)
			if err != nil {
				return errors.Trace(err)
			}
			decryptContent, err := utils.Decrypt(content, cipher, statsIndex.CipherIv)
			if err != nil {
				return errors.Trace(err)
			}
			checksum := sha256.Sum256(decryptContent)
			if !bytes.Equal(statsIndex.Sha256, checksum[:]) {
				return berrors.ErrInvalidMetaFile.GenWithStackByArgs(fmt.Sprintf(
					"checksum mismatch expect %x, got %x", statsIndex.Sha256, checksum[:]))
			}
			statsFileBlocks := &backuppb.StatsFile{}
			if err := proto.Unmarshal(decryptContent, statsFileBlocks); err != nil {
				return errors.Trace(err)
			}
			jsonContent, err := utils.MarshalStatsFile(statsFileBlocks)
			if err != nil {
				return errors.Trace(err)
			}
			if err := s.WriteFile(ctx, fmt.Sprintf(JSONFileFormat, statsIndex.Name), jsonContent); err != nil {
				return errors.Trace(err)
			}
		}
	}
	return nil
}

// DecodeMetaFile decodes the meta file to json format, it is called by br debug
func DecodeMetaFile(
	ctx context.Context,
	s storeapi.Storage,
	cipher *backuppb.CipherInfo,
	metaIndex *backuppb.MetaFile,
) error {
	if metaIndex == nil {
		return nil
	}
	eg, ectx := errgroup.WithContext(ctx)
	workers := tidbutil.NewWorkerPool(8, "download files workers")
	for _, node := range metaIndex.MetaFiles {
		workers.ApplyOnErrorGroup(eg, func() error {
			content, err := s.ReadFile(ectx, node.Name)
			if err != nil {
				return errors.Trace(err)
			}

			decryptContent, err := utils.Decrypt(content, cipher, node.CipherIv)
			if err != nil {
				return errors.Trace(err)
			}

			checksum := sha256.Sum256(decryptContent)
			if !bytes.Equal(node.Sha256, checksum[:]) {
				return berrors.ErrInvalidMetaFile.GenWithStackByArgs(fmt.Sprintf(
					"checksum mismatch expect %x, got %x", node.Sha256, checksum[:]))
			}

			child := &backuppb.MetaFile{}
			if err = proto.Unmarshal(decryptContent, child); err != nil {
				return errors.Trace(err)
			}

			// the max depth of the root metafile is only 1.
			// ASSERT: len(child.MetaFiles) == 0
			if len(child.MetaFiles) > 0 {
				return errors.Errorf("the metafile has unexpected level: %v", child)
			}

			jsonContent, err := utils.MarshalMetaFile(child)
			if err != nil {
				return errors.Trace(err)
			}

			if err := s.WriteFile(ctx, fmt.Sprintf(JSONFileFormat, node.Name), jsonContent); err != nil {
				return errors.Trace(err)
			}

			err = DecodeStatsFile(ctx, s, cipher, child.Schemas)
			return errors.Trace(err)
		})
	}
	return eg.Wait()
}

```

### Core Architecture Module: `br/pkg/metautil/load.go`
```
// Copyright 2024 PingCAP, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package metautil

import (
	"context"

	"github.com/pingcap/errors"
	"github.com/pingcap/tidb/pkg/meta/model"
)

// Database wraps the schema and tables of a database.
type Database struct {
	Info   *model.DBInfo
	Tables []*Table
}

// GetTable returns a table of the database by name.
func (db *Database) GetTable(name string) *Table {
	for _, table := range db.Tables {
		if table.Info.Name.String() == name {
			return table
		}
	}
	return nil
}

// LoadBackupTables loads schemas from BackupMeta.
func LoadBackupTables(ctx context.Context, reader *MetaReader, loadStats bool) (map[string]*Database, error) {
	ch := make(chan *Table)
	errCh := make(chan error)
	go func() {
		var opts []ReadSchemaOption
		if !loadStats {
			opts = []ReadSchemaOption{SkipStats}
		}
		if err := reader.ReadSchemasFiles(ctx, ch, opts...); err != nil {
			errCh <- errors.Trace(err)
		}
		close(ch)
	}()

	databases := make(map[string]*Database)
	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case err := <-errCh:
			return nil, errors.Trace(err)
		case table, ok := <-ch:
			if !ok {
				close(errCh)
				return databases, nil
			}
			dbName := table.DB.Name.String()
			db, ok := databases[dbName]
			if !ok {
				db = &Database{
					Info:   table.DB,
					Tables: make([]*Table, 0),
				}
				databases[dbName] = db
			}
			db.Tables = append(db.Tables, table)
		}
	}
}

```

### Core Architecture Module: `br/pkg/metautil/metafile.go`
```
// Copyright 2021 PingCAP, Inc. Licensed under Apache-2.0.

package metautil

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/docker/go-units"
	"github.com/gogo/protobuf/proto"
	"github.com/opentracing/opentracing-go"
	"github.com/pingcap/errors"
	backuppb "github.com/pingcap/kvproto/pkg/brpb"
	"github.com/pingcap/kvproto/pkg/encryptionpb"
	"github.com/pingcap/log"
	berrors "github.com/pingcap/tidb/br/pkg/errors"
	"github.com/pingcap/tidb/br/pkg/logutil"
	"github.com/pingcap/tidb/br/pkg/summary"
	"github.com/pingcap/tidb/br/pkg/utils"
	"github.com/pingcap/tidb/pkg/meta/model"
	"github.com/pingcap/tidb/pkg/objstore/storeapi"
	"github.com/pingcap/tidb/pkg/statistics/util"
	"github.com/pingcap/tidb/pkg/tablecodec"
	tidbutil "github.com/pingcap/tidb/pkg/util"
	"github.com/pingcap/tidb/pkg/util/encrypt"
	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"
	"google.golang.org/protobuf/encoding/protowire"
)

const (
	// LockFile represents file name
	LockFile = "backup.lock"
	// MetaFile represents file name
	MetaFile = "backupmeta"
	// MetaJSONFile represents backup meta json file name
	MetaJSONFile = "jsons/backupmeta.json"
	// MaxBatchSize represents the internal channel buffer size of MetaWriter and MetaReader.
	MaxBatchSize = 1024

	// MetaFileSize represents the limit size of one MetaFile
	MetaFileSize = 128 * units.MiB

	// CrypterIvLen represents the length of iv of crypter method
	CrypterIvLen = 16
)

const (
	// MetaV1 represents the old version of backupmeta.
	// because the old version doesn't have version field, so set it to 0 for compatibility.
	MetaV1 = iota
	// MetaV2 represents the new version of backupmeta.
	MetaV2
)

type protobufFieldInfo struct {
	isMessage  bool
	messageTyp reflect.Type
}

var (
	protoMsgIfaceType = reflect.TypeOf((*proto.Message)(nil)).Elem()
	protoFieldCache   sync.Map // map[reflect.Type]map[protowire.Number]protobufFieldInfo
)

func checkBackupMetaUnknownFieldsFromBytes(
	backupMetaBytes []byte,
	backupMeta *backuppb.BackupMeta,
) error {
	if len(backupMetaBytes) == 0 {
		return errors.Annotate(
			berrors.ErrInvalidArgument,
			"backupmeta bytes are required for compatibility check",
		)
	}
	hasUnknownFields, err := detectUnknownProtobufFields(backupMetaBytes, reflect.TypeOf(backuppb.BackupMeta{}))
	if err != nil {
		return errors.Annotate(err, "failed to detect unknown fields in backupmeta")
	}
	if !hasUnknownFields {
		return nil
	}
	return errors.Annotatef(
		berrors.ErrVersionMismatch,
		"backupmeta contains unknown protobuf fields. restoring with an older BR may silently ignore "+
			"newer backup metadata. backup cluster version: %s, backup BR version: %s. use "+
			"--check-requirements=false to skip this check",
		backupMeta.GetClusterVersion(),
		backupMeta.GetBrVersion(),
	)
}

func detectUnknownProtobufFields(data []byte, messageTyp reflect.Type) (bool, error) {
	fields := getProtobufFieldInfo(messageTyp)
	for len(data) > 0 {
		fieldNumber, wireType, n := protowire.ConsumeTag(data)
		if n < 0 {
			return false, errors.Trace(protowire.ParseError(n))
		}
		data = data[n:]

		fieldInfo, ok := fields[fieldNumber]
		payload, consumed, err := consumeProtobufFieldValue(data, fieldNumber, wireType)
		if err != nil {
			return false, err
		}
		if !ok {
			return true, nil
		}
		if fieldInfo.isMessage && wireType == protowire.BytesType {
			hasUnknown, err := detectUnknownProtobufFields(payload, fieldInfo.messageTyp)
			if err != nil {
				return false, err
			}
			if hasUnknown {
				return true, nil
			}
		}
		data = data[consumed:]
	}
	return false, nil
}

func consumeProtobufFieldValue(
	data []byte,
	fieldNumber protowire.Number,
	wireType protowire.Type,
) (payload []byte, consumed int, err error) {
	switch wireType {
	case protowire.VarintType:
		_, consumed = protowire.ConsumeVarint(data)
	case protowire.Fixed32Type:
		_, consumed = protowire.ConsumeFixed32(data)
	case protowire.Fixed64Type:
		_, consumed = protowire.ConsumeFixed64(data)
	case protowire.BytesType:
		payload, consumed = protowire.ConsumeBytes(data)
	case protowire.StartGroupType:
		_, consumed = protowire.ConsumeGroup(fieldNumber, data)
	case protowire.EndGroupType:
		return nil, 0, errors.New("unexpected end-group wire type in backupmeta")
	default:
		return nil, 0, errors.Errorf("unsupported protobuf wire type %d in backupmeta", wireType)
	}
	if consumed < 0 {
		return nil, 0, errors.Trace(protowire.ParseError(consumed))
	}
	return payload, consumed, nil
}

func getProtobufFieldInfo(messageTyp reflect.Type) map[protowire.Number]protobufFieldInfo {
	if messageTyp.Kind() == reflect.Ptr {
		messageTyp = messageTyp.Elem()
	}
	if cached, ok := protoFieldCache.Load(messageTyp); ok {
		return cached.(map[protowire.Number]protobufFieldInfo)
	}

	result := make(map[protowire.Number]protobufFieldInfo)
	for i := range messageTyp.NumField() {
		field := messageTyp.Field(i)
		protobufTag := field.Tag.Get("protobuf")
		fieldNumber, ok := parseProtobufFieldNumber(protobufTag)
		if !ok {
			continue
		}
		nestedMessageType, isMessage := getNestedMessageType(field.Type)
		result[fieldNumber] = protobufFieldInfo{
			isMessage:  isMessage,
			messageTyp: nestedMessageType,
		}
	}
	protoFieldCache.Store(messageTyp, result)
	return result
}

func parseProtobufFieldNumber(protobufTag string) (protowire.Number, bool) {
	if protobufTag == "" {
		return 0, false
	}
	parts := strings.Split(protobufTag, ",")
	if len(parts) < 2 {
		return 0, false
	}
	n, err := strconv.ParseUint(parts[1], 10, 32)
	if err != nil {
		return 0, false
	}
	return protowire.Number(n), true
}

func getNestedMessageType(fieldTyp reflect.Type) (reflect.Type, bool) {
	switch fieldTyp.Kind() {
	case reflect.Ptr:
		if fieldTyp.Implements(protoMsgIfaceType) {
			return fieldTyp.Elem(), true
		}
	case reflect.Slice:
		if fieldTyp.Elem().Kind() == reflect.Uint8 {
			return nil, false
		}
		elemTyp := fieldTyp.Elem()
		if elemTyp.Kind() == reflect.Ptr && elemTyp.Implements(protoMsgIfaceType) {
			return elemTyp.Elem(), true
		}
		if elemTyp.Kind() == reflect.Struct && reflect.PointerTo(elemTyp).Implements(protoMsgIfaceType) {
			return elemTyp, true
		}
	}
	return nil, false
}

// CheckBackupMetaCompatibilityFromBytes blocks restore when backup metadata
// requires a newer metadata schema reader or contains protobuf fields the
// current BR binary does not recognize.
func CheckBackupMetaCompatibilityFromBytes(
	backupMetaBytes []byte,
	backupMeta *backuppb.BackupMeta,
) error {
	if backupMeta.GetBackupSchemaVersion() > backuppb.BackupSchemaVersion {
		return errors.Annotatef(
			berrors.ErrVersionMismatch,
			"backupmeta requires schema version %d, current BR supports up to %d. restoring with an older BR "+
				"may silently ignore newer backup metadata semantics. backup cluster version: %s, backup BR "+
				"version: %s. use --check-requirements=false to skip this check",
			backupMeta.GetBackupSchemaVersion(),
			backuppb.BackupSchemaVersion,
			backupMeta.GetClusterVersion(),
			backupMeta.GetBrVersion(),
		)
	}
	return checkBackupMetaUnknownFieldsFromBytes(backupMetaBytes, backupMeta)
}

// Encrypt encrypts the content according to CipherInfo.
func Encrypt(content []byte, cipher *backuppb.CipherInfo) (encryptedContent, iv []byte, err error) {
	if len(content) == 0 || cipher == nil {
		return content, iv, nil
	}

	switch cipher.CipherType {
	case encryptionpb.EncryptionMethod_PLAINTEXT:
		return content, iv, nil
	case encryptionpb.EncryptionMethod_AES128_CTR,
		encryptionpb.EncryptionMethod_AES192_CTR,
		encryptionpb.EncryptionMethod_AES256_CTR:
		// generate random iv for aes crypter
		iv = make([]byte, CrypterIvLen)
		_, err = rand.Read(iv)
		if err != nil {
			return content, iv, errors.Trace(err)
		}
		encryptedContent, err = encrypt.AESEncryptWithCTR(content, cipher.CipherKey, iv)
		return
	default:
		return content, iv, errors.Annotate(berrors.ErrInvalidArgument, "cipher type invalid")
	}
}

func DecryptFullBackupMetaIfNeeded(metaData []byte, cipherInfo *backuppb.CipherInfo) ([]byte, error) {
	if cipherInfo == nil || !utils.IsEffectiveEncryptionMethod(cipherInfo.CipherType) {
		return metaData, nil
	}
	// the prefix of backup meta file is iv(16 bytes) for ctr mode if encryption method is valid
	iv := metaData[:CrypterIvLen]
	decryptBackupMeta, err := utils.Decrypt(metaData[len(iv):], cipherInfo, iv)
	if err != nil {
		return nil, errors.Annotate(err, "decrypt failed with wrong key")
	}
	return decryptBackupMeta, nil
}

// walkLeafMetaFile walks the leaves of the given metafile, and deal with it by calling the function `output`.
// Notice: the function `output` should be thread safe.
func walkLeafMetaFile(
	ctx context.Context,
	storage storeapi.Storage,
	file *backuppb.MetaFile,
	cipher *backuppb.CipherInfo,
	output func(*backuppb.MetaFile)) error {
	if file == nil {
		return nil
	}
	if len(file.MetaFiles) == 0 {
		output(file)
		return nil
	}
	eg, ectx := errgroup.WithContext(ctx)
	workers := tidbutil.NewWorkerPool(8, "download files workers")
	for _, node := range file.MetaFiles {
		workers.ApplyOnErrorGroup(eg, func() error {
			content, err := storage.ReadFile(ectx, node.Name)
			if err != nil {
				return errors.Trace(err)
			}

			decryptContent, err := utils.Decrypt(content, cipher, node.CipherIv)
			if err != nil {
				return errors.Trace(err)
			}

			checksum := sha256.Sum256(decryptContent)
			if !bytes.Equal(node.Sha256, checksum[:]) {
				return berrors.ErrInvalidMetaFile.GenWithStackByArgs(fmt.Sprintf(
					"checksum mismatch expect %x, got %x", node.Sha256, checksum[:]))
			}

			child := &backuppb.MetaFile{}
			if err = proto.Unmarshal(decryptContent, child); err != nil {
				return errors.Trace(err)
			}

			// the max depth of the root metafile is only 1.
			// ASSERT: len(child.MetaFiles) == 0
			if err = walkLeafMetaFile(ectx, storage, child, cipher, output); err != nil {
				return errors.Trace(err)
			}

			return nil
		})
	}
	retu
```

### Core Architecture Module: `br/pkg/metautil/statsfile.go`
```
// Copyright 2024 PingCAP, Inc.
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

package metautil

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"

	"github.com/gogo/protobuf/proto"
	"github.com/pingcap/errors"
	backuppb "github.com/pingcap/kvproto/pkg/brpb"
	berrors "github.com/pingcap/tidb/br/pkg/errors"
	"github.com/pingcap/tidb/br/pkg/utils"
	"github.com/pingcap/tidb/pkg/meta/model"
	"github.com/pingcap/tidb/pkg/objstore/storeapi"
	"github.com/pingcap/tidb/pkg/statistics/handle"
	statstypes "github.com/pingcap/tidb/pkg/statistics/handle/types"
	statsutil "github.com/pingcap/tidb/pkg/statistics/util"
	"github.com/pingcap/tidb/pkg/util"
	"golang.org/x/sync/errgroup"
)

var maxStatsJsonTableSize = 32 * 1024 * 1024 // 32 MiB
var inlineSize = 8 * 1024                    // 8 KiB

func getStatsFileName(physicalID int64) string {
	return fmt.Sprintf("backupmeta.schema.stats.%09d", physicalID)
}

// A lightweight function wrapper to dump the statistic
type StatsWriter struct {
	storage storeapi.Storage
	cipher  *backuppb.CipherInfo

	// final stats file indexes
	statsFileIndexes []*backuppb.StatsFileIndex

	// temporary variables, clear after each flush
	totalSize int
	statsFile *backuppb.StatsFile
}

func newStatsWriter(
	storage storeapi.Storage,
	cipher *backuppb.CipherInfo,
) *StatsWriter {
	return &StatsWriter{
		storage: storage,
		cipher:  cipher,

		statsFileIndexes: make([]*backuppb.StatsFileIndex, 0),

		totalSize: 0,
		statsFile: &backuppb.StatsFile{
			Blocks: make([]*backuppb.StatsBlock, 0, 8),
		},
	}
}

// flush temporary and clear []byte to make it garbage collected as soon as possible
func (s *StatsWriter) flushTemporary() ([]byte, error) {
	defer s.clearTemporary()
	return proto.Marshal(s.statsFile)
}

func (s *StatsWriter) clearTemporary() {
	// clear the temporary variables
	s.totalSize = 0
	s.statsFile = &backuppb.StatsFile{
		Blocks: make([]*backuppb.StatsBlock, 0, 8),
	}
}

func (s *StatsWriter) writeStatsFileAndClear(ctx context.Context, physicalID int64) error {
	fileName := getStatsFileName(physicalID)
	content, err := s.flushTemporary()
	if err != nil {
		return errors.Trace(err)
	}

	if len(s.statsFileIndexes) == 0 && len(content) < inlineSize {
		s.statsFileIndexes = append(s.statsFileIndexes, &backuppb.StatsFileIndex{InlineData: content})
		return nil
	}

	checksum := sha256.Sum256(content)
	sizeOri := uint64(len(content))
	encryptedContent, iv, err := Encrypt(content, s.cipher)
	if err != nil {
		return errors.Trace(err)
	}

	if err := s.storage.WriteFile(ctx, fileName, encryptedContent); err != nil {
		return errors.Trace(err)
	}

	s.statsFileIndexes = append(s.statsFileIndexes, &backuppb.StatsFileIndex{
		Name:     fileName,
		Sha256:   checksum[:],
		SizeEnc:  uint64(len(encryptedContent)),
		SizeOri:  sizeOri,
		CipherIv: iv,
	})
	return nil
}

func (s *StatsWriter) BackupStats(ctx context.Context, jsonTable *statsutil.JSONTable, physicalID int64) error {
	if jsonTable == nil {
		return nil
	}

	statsBytes, err := json.Marshal(jsonTable)
	if err != nil {
		return errors.Trace(err)
	}

	s.totalSize += len(statsBytes)
	s.statsFile.Blocks = append(s.statsFile.Blocks, &backuppb.StatsBlock{
		PhysicalId: physicalID,
		JsonTable:  statsBytes,
	})

	// check whether need to flush
	if s.totalSize > maxStatsJsonTableSize {
		if err := s.writeStatsFileAndClear(ctx, physicalID); err != nil {
			return errors.Trace(err)
		}
	}
	return nil
}

func (s *StatsWriter) BackupStatsDone(ctx context.Context) ([]*backuppb.StatsFileIndex, error) {
	if s.totalSize == 0 || len(s.statsFile.Blocks) == 0 {
		return s.statsFileIndexes, nil
	}

	if err := s.writeStatsFileAndClear(ctx, s.statsFile.Blocks[0].PhysicalId); err != nil {
		return nil, errors.Trace(err)
	}
	return s.statsFileIndexes, nil
}

func RestoreStats(
	ctx context.Context,
	storage storeapi.Storage,
	cipher *backuppb.CipherInfo,
	statsHandler *handle.Handle,
	newTableInfo *model.TableInfo,
	statsFileIndexes []*backuppb.StatsFileIndex,
	rewriteIDMap map[int64]int64,
) error {
	eg, ectx := errgroup.WithContext(ctx)
	taskCh := make(chan *statstypes.PartitionStatisticLoadTask, 8)
	eg.Go(func() error {
		return downloadStats(ectx, storage, cipher, statsFileIndexes, rewriteIDMap, taskCh)
	})
	eg.Go(func() error {
		// NOTICE: skip updating cache after load stats from json
		return statsHandler.LoadStatsFromJSONConcurrently(ectx, newTableInfo, taskCh, 0)
	})
	return eg.Wait()
}

func downloadStats(
	ctx context.Context,
	storage storeapi.Storage,
	cipher *backuppb.CipherInfo,
	statsFileIndexes []*backuppb.StatsFileIndex,
	rewriteIDMap map[int64]int64,
	taskCh chan<- *statstypes.PartitionStatisticLoadTask,
) error {
	defer close(taskCh)
	eg, ectx := errgroup.WithContext(ctx)
	downloadWorkerpool := util.NewWorkerPool(4, "download stats for each partition")
	for _, statsFileIndex := range statsFileIndexes {
		if ectx.Err() != nil {
			break
		}
		statsFile := statsFileIndex
		downloadWorkerpool.ApplyOnErrorGroup(eg, func() error {
			var statsContent []byte
			if len(statsFile.InlineData) > 0 {
				statsContent = statsFile.InlineData
			} else {
				content, err := storage.ReadFile(ectx, statsFile.Name)
				if err != nil {
					return errors.Trace(err)
				}

				decryptContent, err := utils.Decrypt(content, cipher, statsFile.CipherIv)
				if err != nil {
					return errors.Trace(err)
				}

				checksum := sha256.Sum256(decryptContent)
				if !bytes.Equal(statsFile.Sha256, checksum[:]) {
					return berrors.ErrInvalidMetaFile.GenWithStackByArgs(fmt.Sprintf(
						"checksum mismatch expect %x, got %x", statsFile.Sha256, checksum[:]))
				}
				statsContent = decryptContent
			}

			statsFileBlocks := &backuppb.StatsFile{}
			if err := proto.Unmarshal(statsContent, statsFileBlocks); err != nil {
				return errors.Trace(err)
			}

			for _, block := range statsFileBlocks.Blocks {
				physicalId, ok := rewriteIDMap[block.PhysicalId]
				if !ok {
					return berrors.ErrRestoreInvalidRewrite.GenWithStackByArgs(fmt.Sprintf(
						"not rewrite rule matched, old physical id: %d", block.PhysicalId))
				}
				jsonTable := &statsutil.JSONTable{}
				if err := json.Unmarshal(block.JsonTable, jsonTable); err != nil {
					return errors.Trace(err)
				}
				// reset the block.JsonTable to nil to make it garbage collected as soon as possible
				block.JsonTable = nil

				select {
				case <-ectx.Done():
					return nil
				case taskCh <- &statstypes.PartitionStatisticLoadTask{
					PhysicalID: physicalId,
					JSONTable:  jsonTable,
				}:
				}
			}

			return nil
		})
	}

	return eg.Wait()
}

```

### Core Architecture Module: `br/pkg/pdutil/pd.go`
```
// Copyright 2020 PingCAP, Inc. Licensed under Apache-2.0.

package pdutil

import (
	"context"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/coreos/go-semver/semver"
	"github.com/docker/go-units"
	"github.com/google/uuid"
	"github.com/opentracing/opentracing-go"
	"github.com/pingcap/errors"
	"github.com/pingcap/failpoint"
	"github.com/pingcap/log"
	berrors "github.com/pingcap/tidb/br/pkg/errors"
	"github.com/pingcap/tidb/pkg/keyspace"
	"github.com/pingcap/tidb/pkg/kv"
	"github.com/pingcap/tidb/pkg/util/codec"
	pd "github.com/tikv/pd/client"
	pdhttp "github.com/tikv/pd/client/http"
	"github.com/tikv/pd/client/opt"
	"github.com/tikv/pd/client/pkg/caller"
	"github.com/tikv/pd/client/pkg/retry"
	"go.uber.org/zap"
	"google.golang.org/grpc"
)

const (
	maxMsgSize   = int(128 * units.MiB) // pd.ScanRegion may return a large response
	pauseTimeout = 5 * time.Minute
	// pd request retry time when connection fail
	PDRequestRetryTime = 120
	// set max-pending-peer-count to a large value to avoid scatter region failed.
	maxPendingPeerUnlimited uint64 = math.MaxInt32
)

// pauseConfigGenerator generate a config value according to store count and current value.
type pauseConfigGenerator func(int, any) any

// zeroPauseConfig sets the config to 0.
func zeroPauseConfig(int, any) any {
	return 0
}

// pauseConfigMulStores multiplies the existing value by
// number of stores. The value is limited to 40, as larger value
// may make the cluster unstable.
func pauseConfigMulStores(stores int, raw any) any {
	rawCfg := raw.(float64)
	return math.Min(40, rawCfg*float64(stores))
}

// pauseConfigFalse sets the config to "false".
func pauseConfigFalse(int, any) any {
	return "false"
}

// constConfigGeneratorBuilder build a pauseConfigGenerator based on a given const value.
func constConfigGeneratorBuilder(val any) pauseConfigGenerator {
	return func(int, any) any {
		return val
	}
}

// ClusterConfig represents a set of scheduler whose config have been modified
// along with their original config.
type ClusterConfig struct {
	// Enable PD schedulers before restore
	Schedulers []string `json:"schedulers"`
	// Original scheudle configuration
	ScheduleCfg map[string]any `json:"schedule_cfg"`
	// The region rule ID registered
	RuleID string `json:"rule_id"`
}

type pauseSchedulerBody struct {
	Delay int64 `json:"delay"`
}

var (
	// in v4.0.8 version we can use pause configs
	// see https://github.com/tikv/pd/pull/3088
	pauseConfigVersion = semver.Version{Major: 4, Minor: 0, Patch: 8}

	// After v6.1.0 version, we can pause schedulers by key range with TTL.
	minVersionForRegionLabelTTL = semver.Version{Major: 6, Minor: 1, Patch: 0}

	// Schedulers represent region/leader schedulers which can impact on performance.
	Schedulers = map[string]struct{}{
		"balance-leader-scheduler":     {},
		"balance-hot-region-scheduler": {},
		"balance-region-scheduler":     {},

		"shuffle-leader-scheduler":     {},
		"shuffle-region-scheduler":     {},
		"shuffle-hot-region-scheduler": {},

		"evict-slow-store-scheduler": {},
	}
	expectPDCfgGenerators = map[string]pauseConfigGenerator{
		"merge-schedule-limit": zeroPauseConfig,
		// TODO "leader-schedule-limit" and "region-schedule-limit" don't support ttl for now,
		// but we still need set these config for compatible with old version.
		// we need wait for https://github.com/tikv/pd/pull/3131 merged.
		// see details https://github.com/pingcap/br/pull/592#discussion_r522684325
		"leader-schedule-limit":       pauseConfigMulStores,
		"region-schedule-limit":       pauseConfigMulStores,
		"max-snapshot-count":          pauseConfigMulStores,
		"enable-location-replacement": pauseConfigFalse,
		"max-pending-peer-count":      constConfigGeneratorBuilder(maxPendingPeerUnlimited),
	}

	// defaultPDCfg find by https://github.com/tikv/pd/blob/master/conf/config.toml.
	// only use for debug command.
	defaultPDCfg = map[string]any{
		"merge-schedule-limit":        8,
		"leader-schedule-limit":       4,
		"region-schedule-limit":       2048,
		"enable-location-replacement": "true",
	}
)

// DefaultExpectPDCfgGenerators returns default pd config generators
func DefaultExpectPDCfgGenerators() map[string]pauseConfigGenerator {
	clone := make(map[string]pauseConfigGenerator, len(expectPDCfgGenerators))
	for k := range expectPDCfgGenerators {
		clone[k] = expectPDCfgGenerators[k]
	}
	return clone
}

// PdController manage get/update config from pd.
type PdController struct {
	pdClient  pd.Client
	pdHTTPCli pdhttp.Client
	version   *semver.Version

	// control the pause schedulers goroutine
	schedulerPauseCh chan struct{}
	// control the ttl of pausing schedulers
	SchedulerPauseTTL time.Duration
}

// NewPdController creates a new PdController.
func NewPdController(
	ctx context.Context,
	keyspaceName string,
	pdAddrs []string,
	tlsConf *tls.Config,
	securityOption pd.SecurityOption,
) (*PdController, error) {
	maxCallMsgSize := []grpc.DialOption{
		grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(maxMsgSize)),
		grpc.WithDefaultCallOptions(grpc.MaxCallSendMsgSize(maxMsgSize)),
	}
	pdClient, err := pd.NewClientWithAPIContext(
		ctx, keyspace.BuildAPIContext(keyspaceName), caller.GetComponent(1), pdAddrs, securityOption,
		opt.WithGRPCDialOptions(maxCallMsgSize...),
		// If the time too short, we may scatter a region many times, because
		// the interface `ScatterRegions` may time out.
		opt.WithCustomTimeoutOption(60*time.Second),
	)
	if err != nil {
		log.Error("fail to create pd client", zap.Error(err))
		return nil, errors.Trace(err)
	}

	pdHTTPCliConfig := make([]pdhttp.ClientOption, 0, 1)
	if tlsConf != nil {
		pdHTTPCliConfig = append(pdHTTPCliConfig, pdhttp.WithTLSConfig(tlsConf))
	}
	pdHTTPCli := pdhttp.NewClientWithServiceDiscovery(
		"br/lightning PD controller",
		pdClient.GetServiceDiscovery(),
		pdHTTPCliConfig...,
	).WithBackoffer(retry.InitialBackoffer(time.Second, time.Second, PDRequestRetryTime*time.Second))
	versionStr, err := pdHTTPCli.GetPDVersion(ctx)
	if err != nil {
		pdHTTPCli.Close()
		pdClient.Close()
		return nil, errors.Trace(err)
	}
	version := parseVersion(versionStr)

	return &PdController{
		pdClient:  pdClient,
		pdHTTPCli: pdHTTPCli,
		version:   version,
		// We should make a buffered channel here otherwise when context canceled,
		// gracefully shutdown will stick at resuming schedulers.
		schedulerPauseCh: make(chan struct{}, 1),
	}, nil
}

func NewPdControllerWithPDClient(pdClient pd.Client, pdHTTPCli pdhttp.Client, v *semver.Version) *PdController {
	return &PdController{
		pdClient:         pdClient,
		pdHTTPCli:        pdHTTPCli,
		version:          v,
		schedulerPauseCh: make(chan struct{}, 1),
	}
}

func parseVersion(versionStr string) *semver.Version {
	// we need trim space or semver will parse failed
	v := strings.TrimSpace(versionStr)
	v = strings.Trim(v, "\"")
	v = strings.TrimPrefix(v, "v")
	version, err := semver.NewVersion(v)
	if err != nil {
		log.Warn("fail back to v0.0.0 version",
			zap.String("version", versionStr), zap.Error(err))
		version = &semver.Version{Major: 0, Minor: 0, Patch: 0}
	}
	failpoint.Inject("PDEnabledPauseConfig", func(val failpoint.Value) {
		if val.(bool) {
			// test pause config is enable
			version = &semver.Version{Major: 5, Minor: 0, Patch: 0}
		}
	})
	return version
}

func (p *PdController) isPauseConfigEnabled() bool {
	return p.version.Compare(pauseConfigVersion) >= 0
}

// SetPDClient set pd addrs and cli for test.
func (p *PdController) SetPDClient(pdClient pd.Client) {
	p.pdClient = pdClient
}

// GetPDClient set pd addrs and cli for test.
func (p *PdController) GetPDClient() pd.Client {
	return p.pdClient
}

// GetPDHTTPClient returns the pd http client.
func (p *PdController) GetPDHTTPClient() pdhttp.Client {
	return p.pdHTTPCli
}

// GetClusterVersion returns the current cluster version.
func (p *PdController) GetClusterVersion(ctx context.Context) (string, error) {
	v, err := p.pdHTTPCli.GetClusterVersion(ctx)
	return v, errors.Trace(err)
}

// GetRegionCount returns the region count in the specified range.
func (p *PdController) GetRegionCount(ctx context.Context, startKey, endKey []byte) (int, error) {
	// TiKV reports region start/end keys to PD in memcomparable-format.
	var start, end []byte
	start = codec.EncodeBytes(nil, startKey)
	if len(endKey) != 0 { // Empty end key means the max.
		end = codec.EncodeBytes(nil, endKey)
	}
	status, err := p.pdHTTPCli.GetRegionStatusByKeyRange(ctx, pdhttp.NewKeyRange(start, end), true)
	if err != nil {
		return 0, errors.Trace(err)
	}
	return status.Count, nil
}

// GetStoreInfo returns the info of store with the specified id.
func (p *PdController) GetStoreInfo(ctx context.Context, storeID uint64) (*pdhttp.StoreInfo, error) {
	info, err := p.pdHTTPCli.GetStore(ctx, storeID)
	return info, errors.Trace(err)
}

func (p *PdController) doPauseSchedulers(
	ctx context.Context,
	schedulers []string,
) ([]string, error) {
	// pause this scheduler with 300 seconds
	delay := int64(p.ttlOfPausing().Seconds())
	removedSchedulers := make([]string, 0, len(schedulers))
	for _, scheduler := range schedulers {
		err := p.pdHTTPCli.SetSchedulerDelay(ctx, scheduler, delay)
		if err != nil {
			return removedSchedulers, errors.Trace(err)
		}
		removedSchedulers = append(removedSchedulers, scheduler)
	}
	return removedSchedulers, nil
}

func (p *PdController) pauseSchedulersAndConfigWith(
	ctx context.Context, schedulers []string,
	schedulerCfg map[string]any,
) ([]string, error) {
	// first pause this scheduler, if the first time failed. we should return the error
	// so put first time out of for loop. and in for loop we could ignore other failed pause.
	removedSchedulers, err := p.doPauseSchedulers(ctx, schedulers)
	if err != nil {
		log.Error("failed to pause scheduler at beginning",
			zap.Strings("name", schedulers), zap.Error(err))
		return nil, errors.Trace(err)
	}
	log.Info("pause scheduler successful at beginning", zap.Strings("name", schedulers))
	i
```

### Core Architecture Module: `br/pkg/pdutil/utils.go`
```
// Copyright 2020 PingCAP, Inc. Licensed under Apache-2.0.

package pdutil

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/pingcap/errors"
	berrors "github.com/pingcap/tidb/br/pkg/errors"
	"github.com/pingcap/tidb/pkg/store/pdtypes"
	"github.com/pingcap/tidb/pkg/tablecodec"
	"github.com/pingcap/tidb/pkg/util/codec"
	"github.com/pingcap/tidb/pkg/util/httputil"
	pd "github.com/tikv/pd/client/http"
)

// UndoFunc is a 'undo' operation of some undoable command.
// (e.g. RemoveSchedulers).
type UndoFunc func(context.Context) error

// Nop is the 'zero value' of undo func.
var Nop UndoFunc = func(context.Context) error { return nil }

// GetPlacementRules return the current placement rules.
func GetPlacementRules(ctx context.Context, pdAddr string, tlsConf *tls.Config) ([]pdtypes.Rule, error) {
	cli := httputil.NewClient(tlsConf)
	prefix := "http://"
	if tlsConf != nil {
		prefix = "https://"
	}
	reqURL := fmt.Sprintf("%s%s%s", prefix, pdAddr, pd.PlacementRules)
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, errors.Trace(err)
	}
	resp, err := cli.Do(req)
	if err != nil {
		return nil, errors.Trace(err)
	}
	defer resp.Body.Close()
	buf := new(bytes.Buffer)
	_, err = buf.ReadFrom(resp.Body)
	if err != nil {
		return nil, errors.Trace(err)
	}
	if resp.StatusCode == http.StatusPreconditionFailed {
		return []pdtypes.Rule{}, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, errors.Annotatef(berrors.ErrPDInvalidResponse,
			"get placement rules failed: resp=%v, err=%v, code=%d", buf.String(), err, resp.StatusCode)
	}
	var rules []pdtypes.Rule
	err = json.Unmarshal(buf.Bytes(), &rules)
	if err != nil {
		return nil, errors.Trace(err)
	}
	return rules, nil
}

// SearchPlacementRule returns the placement rule matched to the table or nil.
func SearchPlacementRule(tableID int64, placementRules []pdtypes.Rule, role pdtypes.PeerRoleType) *pdtypes.Rule {
	for _, rule := range placementRules {
		key, err := hex.DecodeString(rule.StartKeyHex)
		if err != nil {
			continue
		}
		_, decoded, err := codec.DecodeBytes(key, nil)
		if err != nil {
			continue
		}
		if rule.Role == role && tableID == tablecodec.DecodeTableID(decoded) {
			return &rule
		}
	}
	return nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #72210** (2026-10-22): **config: fix diagnostic-mode goroutine profile flake**
  *Symptoms*: <!--  Thank you for contributing to TiDB!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve? <!--  Please create an issue first to describe the problem.  There MUST be one line starting with "Issue Number:  " and linking the relevant issues via the "close" or "ref".  For more info, check https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/contribute-code.html#referring-to-an-issue.  -->  Issue Number: close #71484  Problem Summary:  `TestTiDBServerGoroutinesInDiagnosticMode` can fail with `goroutine group has no frames` when a goroutine profile contains a group whose only frame is `runtime.goexit`. Go's `debug=1` profile writer suppresses that frame, leaving a valid count-and-address header without printable frames. The test incorrectly rejects this output.  ### What changed and how does it work?  Parse and count every goroutine group before checking its frames. For a header-only group, resolve each raw program counter separately and accept it only if every counter resolves to exactly `runtime.goexit`. Missing, malformed, unknown, and other worker frames remain rejected. Preserve the existing worker allowlist and the check that all goroutines are accounted for.  This change only affects the diagnostic-mode test helper.  ### Check List  Tests <!-- At least one of them must be included. -->  - [x] Unit test - [ ] Integration test - [ ] Manual test (add detailed scripts or steps below) - [ ] No need to 

- **Issue #72196** (2026-10-22): **executor: add materialized view refresh runtime**
  *Symptoms*: <!--  Thank you for contributing to TiDB!  PR Title Format: 1. pkg [, pkg2, pkg3]: what's changed 2. *: what's changed  -->  ### What problem does this PR solve? <!--  Please create an issue first to describe the problem.  There MUST be one line starting with "Issue Number:  " and linking the relevant issues via the "close" or "ref".  For more info, check https://pingcap.github.io/tidb-dev-guide/contribute-to-tidb/contribute-code.html#referring-to-an-issue.  -->  Issue Number: ref #18023  Problem Summary:  The FAST and COMPLETE DELTA APPLY executor builders are available on master, but materialized view refresh still needs a shared runtime to coordinate transactions, refresh watermarks, job history, cancellation, and cleanup across refresh modes.  ### What changed and how does it work?  - Add `RefreshMaterializedViewExec` and refresh-step orchestration for FAST, COMPLETE IN PLACE, COMPLETE DELTA APPLY, and COMPLETE OUT OF PLACE refreshes, using the existing internal refresh builders where applicable. - Coordinate refresh locks, snapshot/read-TSO handling, transaction commit or rollback, history finalization, heartbeat and cancellation handling, and out-of-place shadow-table cleanup. - Set up internal refresh sessions with the materialized view definition settings, and attach and restore statistics collectors used by regular sessions. - Add refresh metrics, step observation and plan capture, and slow-log statement restoration; share history timestamp and duration helpers with 

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

### Incident Patch 1: `13544e9b` (2026-10-21)
**Commit Message**: ddl: fix global index copies left or broken by reorganize partition (#72158)

close pingcap/tidb#72167

**File**: `pkg/ddl/index.go` (modified, +21/-3)
```diff
@@ -645,7 +645,8 @@ func DropIndexColumnFlag(tblInfo *model.TableInfo, indexInfo *model.IndexInfo) {
 	col := indexInfo.Columns[0]
 	// other index may still cover this col
 	for _, index := range tblInfo.Indices {
-		if index.Name.L == indexInfo.Name.L {
+		// Compare IDs, since a partition reorganization keeps index copies with the same name.
+		if index.ID == indexInfo.ID {
 			continue
 		}
 
@@ -2261,12 +2262,13 @@ func onDropIndex(sctx sessionctx.Context, jobCtx *jobContext, job *model.Job) (v
 	return ver, errors.Trace(err)
 }
 
-// RemoveDependentHiddenColumns removes hidden columns by the indexInfo.
+// RemoveDependentHiddenColumns removes the hidden columns used by the index, except those still
+// used by another index, e.g. a copy of the index made by a partition reorganization.
 func RemoveDependentHiddenColumns(tblInfo *model.TableInfo, idxInfo *model.IndexInfo) {
 	hiddenColOffs := make([]int, 0)
 	for _, indexColumn := range idxInfo.Columns {
 		col := tblInfo.Columns[indexColumn.Offset]
-		if col.Hidden {
+		if col.Hidden && !isColumnUsedByOtherIndex(tblInfo, idxInfo.ID, col.Offset) {
 			hiddenColOffs = append(hiddenColOffs, col.Offset)
 		}
 	}
@@ -2280,6 +2282,22 @@ func RemoveDependentHiddenColumns(tblInfo *model.TableInfo, idxInfo *model.Index
 	tblInfo.Columns = tblInfo.Columns[:len(tblInfo.Columns)-len(hiddenColOffs)]
 }
 
+// isColumnUsedByOtherIndex checks whether the column is used by an index other than
+// indexID, e.g. a copy of the index made by a partition reorganization.
+func isColumnUsedByOtherIndex(tblInfo *model.TableInfo, indexID int64, offset int) bool {
+	for _, idx := range tblInfo.Indices {
+		if idx.ID == indexID {
+			continue
+		}
+		for _, col := range idx.Columns {
+			if col.Offset == offset {
+				return true
+			}
+		}
+	}
+	return false
+}
+
 func removeIndexInfo(tblInfo *model.TableInfo, idxInfo *model.IndexInfo) {
 	indices := tblInfo.Indices
 	offset := -1
```

**File**: `pkg/ddl/partition.go` (modified, +13/-1)
```diff
@@ -2208,6 +2208,18 @@ func (w *worker) rollbackLikeDropPartition(jobCtx *jobContext, job *model.Job) (
 	if err != nil {
 		return ver, errors.Trace(err)
 	}
+	// Like DROP INDEX, index copies stop taking writes for one schema version before being removed.
+	// convertReorgPartitionJob2RollbackJob has moved every copy that is not delete only to write only.
+	stopWrites := false
+	for _, indexInfo := range tblInfo.Indices {
+		if indexInfo.State == model.StateWriteOnly {
+			indexInfo.State = model.StateDeleteOnly
+			stopWrites = true
+		}
+	}
+	if stopWrites {
+		return updateVersionAndTableInfo(jobCtx, job, tblInfo, true)
+	}
 	tblInfo.Partition.DroppingDefinitions = nil
 	// Collect table/partition ids to clean up, through args.OldPhysicalTblIDs
 	// GC will later also drop matching Placement bundles.
@@ -2239,7 +2251,7 @@ func (w *worker) rollbackLikeDropPartition(jobCtx *jobContext, job *model.Job) (
 
 	var dropIndices []*model.IndexInfo
 	for _, indexInfo := range tblInfo.Indices {
-		if indexInfo.State == model.StateWriteOnly {
+		if indexInfo.State == model.StateDeleteOnly {
 			dropIndices = append(dropIndices, indexInfo)
 		}
 	}
```

**File**: `pkg/ddl/rollingback.go` (modified, +5/-15)
```diff
@@ -427,11 +427,7 @@ func convertReorgPartitionJob2RollbackJob(jobCtx *jobContext, job *model.Job, ot
 	for _, pd := range addingDefinitions {
 		partNames = append(partNames, pd.Name.L)
 	}
-	var dropIndices []*model.IndexInfo
 	for _, indexInfo := range tblInfo.Indices {
-		if !indexInfo.Unique {
-			continue
-		}
 		isNew, ok := pi.DDLChangedIndex[indexInfo.ID]
 		if !ok {
 			// non-changed index
@@ -442,19 +438,13 @@ func convertReorgPartitionJob2RollbackJob(jobCtx *jobContext, job *model.Job, ot
 				// Revert the non-public state
 				indexInfo.State = model.StatePublic
 			}
-		} else {
-			if pi.DDLState == model.StateDeleteReorganization {
-				indexInfo.State = model.StateWriteOnly
-			} else {
-				dropIndices = append(dropIndices, indexInfo)
-			}
+		} else if indexInfo.State != model.StateDeleteOnly {
+			// A copy may be public in delete reorganization, so it keeps taking writes for one more
+			// schema version. rollbackLikeDropPartition then moves it to delete only and removes it.
+			// A copy still in delete only never took writes and stays as is.
+			indexInfo.State = model.StateWriteOnly
 		}
 	}
-	for _, indexInfo := range dropIndices {
-		DropIndexColumnFlag(tblInfo, indexInfo)
-		RemoveDependentHiddenColumns(tblInfo, indexInfo)
-		removeIndexInfo(tblInfo, indexInfo)
-	}
 	if pi.DDLState == model.StateDeleteReorganization {
 		// New partitions are public,
 		// but old is still double written.
```

**File**: `pkg/ddl/tests/partition/BUILD.bazel` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ go_test(
         "modify_column_test.go",
         "multi_domain_test.go",
         "placement_test.go",
+        "reorg_partition_leftover_index_test.go",
         "reorg_partition_test.go",
     ],
     flaky = True,
```

**File**: `pkg/ddl/tests/partition/reorg_partition_leftover_index_test.go` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+// Copyright 2026 PingCAP, Inc.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package partition
+
+import (
+	"context"
+	"fmt"
+	"testing"
+
+	"github.com/pingcap/tidb/pkg/errno"
+	"github.com/pingcap/tidb/pkg/meta/model"
+	"github.com/pingcap/tidb/pkg/testkit"
+	"github.com/pingcap/tidb/pkg/testkit/external"
+	"github.com/pingcap/tidb/pkg/testkit/testfailpoint"
+	"github.com/stretchr/testify/require"
+)
+
+const leftoverIndexTableSQL = `create table t (id bigint not null, a int, s int, ct int not null,
+	unique key uk_id (id, ct),
+	key idx_l (s),
+	key idx_g (a, s, ct) global)
+	partition by range (ct) (
+	partition p0 values less than (10),
+	partition p1 values less than (20),
+	partition pMax values less than (maxvalue))`
+
+func countUpdateMutations(t *testing.T, tk *testkit.TestKit) int {
+	tk.MustExec("begin pessimistic")
+	tk.MustExec("update t set a = a + 1 where id = 3")
+	txn, err := tk.Session().Txn(true)
+	require.NoError(t, err)
+	n := txn.Len()
+	tk.MustExec("rollback")
+	return n
+}
+
+func TestReorgPartitionCancelNonUniqueGlobalIndex(t *testing.T) {
+	store := testkit.CreateMockStore(t)
+	tk := testkit.NewTestKit(t, store)
+	tk.MustExec("use test")
+	tk.MustExec(leftoverIndexTableSQL)
+	tk.MustExec("insert into t values (1, 0, 1, 5), (2, 0, 1, 15), (3, 0, 1, 25), (4, 0, 1, 35)")
+	baseIndices := len(external.GetTableByName(t, tk, "test", "t").Meta().Indices)
+	baseMutations := countUpdateMutations(t, tk)
+
+	var cancelState model.SchemaState
+	var lastRollbackStates []model.SchemaState
+	testfailpoint.EnableCall(t, "github.com/pingcap/tidb/pkg/ddl/beforeRunOneJobStep", func(job *model.Job) {
+		if job.Type != model.ActionReorganizePartition && job.Type != model.ActionAlterTablePartitioning {
+			return
+		}
+		if job.IsRollingback() {
+			lastRollbackStates = lastRollbackStates[:0]
+			for _, idx := range external.GetTableByName(t, testkit.NewTestKit(t, store), "test", "t").Meta().Indices {
+				if idx.State != model.StatePublic {
+					lastRollbackStates = append(lastRollbackStates, idx.State)
+				}
+			}
+			return
+		}
+		if cancelState == model.StateNone || job.SchemaState != cancelState {
+			return
+		}
+		cancelState = model.StateNone
+		tk2 := testkit.NewTestKit(t, store)
+		tk2.MustExec(fmt.Sprintf("admin cancel ddl jobs %d", job.ID))
+	})
+
+	for _, ddl := range []string{
+		"alter table t reorganize partition pMax into (partition p2 values less than (30), partition pMax values less than (maxvalue))",
+		"alter table t partition by range (ct) (partition p0 values less than (10), partition p1 values less than (20), partition p2 values less than (30), partition pMax values less than (maxvalue))",
+	} {
+		for _, state := range []model.SchemaState{
+			model.StateDeleteOnly,
+			model.StateWriteOnly,
+			model.StateWriteReorganization,
+			model.StateDeleteReorganization,
+		} {
+			cancelState = state
+			lastRollbackStates = nil
+			tk.MustGetErrCode(ddl, errno.ErrCancelledDDLJob)
+			tblInfo := external.GetTableByName(t, tk, "test", "t").Meta()
+			// The copies must be delete only in the step that removes them.
+			require.NotEmpty(t, lastRollbackStates, "%s, cancel at %s", ddl, state)
+			for _, s := range lastRollbackStates {
+				require.Equal(t, model.StateDeleteOnly, s, "%s, cancel at %s", ddl, state)
+			}
+			require.Len(t, tblInfo.Indices, baseIndices, "%s, cancel at %s", ddl, state)
+			for _, idx := range tblInfo.Indices {
+				require.Equal(t, model.StatePublic, idx.State, "%s, cancel at %s, index %s", ddl, state, idx.Name.O)
+			}
+			require.Equal(t, baseMutations, countUpdateMutations(t, tk), "%s, cancel at %s", ddl, state)
+			tk.MustExec("admin check table t")
+		}
+	}
+}
+
+func TestReorgPartitionRollbackResumeAfterOwnerChange(t *testing.T) {
+	store, dom := testkit.CreateMockStoreAndDomain(t)
+	tk := testkit.NewTestKit(t, store)
+	tk.MustExec("use test")
+	tk.MustExec(leftoverIndexTableSQL)
+	tk.MustExec("insert into t values (1, 0, 1, 5), (2, 0, 1, 15), (3, 0, 1, 25), (4, 0, 1, 35)")
+	baseIndices := len(external.GetTableByName(t, tk, "test", "t").Meta().Indices)
+	baseMutations := countUpdateMutations(t, tk)
+
+	cancelled, resigned := false, false
+	testfailpoint.EnableCall(t, "github.com/pingcap/tidb/pkg/ddl/beforeRunOneJobStep", func(job *model.Job) {
+		if job.Type != model.ActionReorganizePartition {
+			return
+		}
+		if !cancelled && job.SchemaState == model.StateWriteReorganization {
+			cancelled = true
+			testki
```

---

### Incident Patch 2: `c464391f` (2026-10-22)
**Commit Message**: config: fix diagnostic-mode goroutine profile flake (#72210)

close pingcap/tidb#71484

**File**: `pkg/config/diagnosticmode/mode_server_test.go` (modified, +30/-2)
```diff
@@ -17,7 +17,9 @@ package diagnosticmode_test
 import (
 	"bytes"
 	"fmt"
+	"runtime"
 	"runtime/pprof"
+	"strconv"
 	"testing"
 	"time"
 
@@ -128,15 +130,20 @@ func assertDiagnosticGoroutineAllowlist(t *testing.T, dump []byte) {
 	groups := bytes.Split(bytes.TrimSpace(stacks), []byte("\n\n"))
 	var checked int
 	for _, group := range groups {
-		groupHeader, _, ok := bytes.Cut(group, []byte("\n"))
-		require.True(t, ok, "goroutine group has no frames: %s", group)
+		groupHeader, _, hasFrames := bytes.Cut(group, []byte("\n"))
 		var count int
 		var marker string
 		_, err := fmt.Sscanf(string(groupHeader), "%d %s", &count, &marker)
 		require.NoError(t, err, "invalid goroutine group header: %s", groupHeader)
 		require.Equal(t, "@", marker)
 		require.Positive(t, count)
 		checked += count
+		if !hasFrames {
+			// debug=1 suppresses runtime.goexit even when it is the only frame.
+			// Resolve the raw PCs so no other frameless stack escapes the allowlist.
+			require.True(t, isRuntimeGoexitGroup(groupHeader), "goroutine group has no frames: %s", group)
+			continue
+		}
 
 		allowed := false
 		for _, function := range allowedFunctions {
@@ -155,6 +162,27 @@ func assertDiagnosticGoroutineAllowlist(t *testing.T, dump []byte) {
 	t.Logf("Checked %d goroutines in %d aggregated groups against the diagnostic allowlist", checked, len(groups))
 }
 
+func isRuntimeGoexitGroup(header []byte) bool {
+	fields := bytes.Fields(header)
+	if len(fields) <= 2 {
+		return false
+	}
+	for _, field := range fields[2:] {
+		pc, err := strconv.ParseUint(string(field), 0, strconv.IntSize)
+		if err != nil {
+			return false
+		}
+		// Resolve each PC separately so an unknown PC cannot be skipped while
+		// expanding a stack containing known frames.
+		frames := runtime.CallersFrames([]uintptr{uintptr(pc)})
+		frame, more := frames.Next()
+		if frame.Function != "runtime.goexit" || more {
+			return false
+		}
+	}
+	return true
+}
+
 func startTiDBServer(t *testing.T) (*tidbserver.Server, *config.Config) {
 	t.Helper()
 	if kerneltype.IsNextGen() {
```

---

### Incident Patch 3: `18ec04a2` (2026-10-22)
**Commit Message**: build: prepare Bazel tooling for Go 1.27 (#72082)

ref pingcap/tidb#70069

**File**: `.bazelrc` (modified, +3/-0)
```diff
@@ -8,6 +8,9 @@ build --http_timeout_scaling=0.1
 build --announce_rc
 build --experimental_guard_against_concurrent_changes
 build --incompatible_strict_action_env --incompatible_enable_cc_toolchain_resolution
+# Keep C/C++ objects PIC for Go's Linux -z nocopyreloc links.
+# Remove this override if rules_go restores its cgo PIC default in normal mode.
+build --copt=-fPIC
 build --remote_retries=6 --remote_retry_max_delay=8s
 build:ci --color=yes
 build:ci --experimental_remote_cache_compression
```

**File**: `.github/workflows/check-bazel-prepare.yml` (modified, +23/-0)
```diff
@@ -40,3 +40,26 @@ jobs:
           # Avoid the TiDB CI path that assumes Jenkins-owned temp directories.
           unset CI
           make check-bazel-prepare
+      - name: Test x/tools export-data formats
+        shell: bash
+        run: |
+          set -euo pipefail
+          unset CI
+          # External tests are not included by TiDB's //... target pattern.
+          bazel test @org_golang_x_tools//internal/pkgbits:pkgbits_test \
+            --test_output=all \
+            --nocache_test_results \
+            --flaky_test_attempts=1 \
+            --test_arg=-test.v
+      - name: Check Linux cgo test linking
+        timeout-minutes: 30
+        shell: bash
+        run: |
+          set -euo pipefail
+          unset CI
+          # Link a test executable that failed in Jenkins; do not run business tests.
+          bazel build --config=ci //pkg/sessionctx/stmtctx:stmtctx_test \
+            --linkopt=-Wl,-z,nocopyreloc \
+            --jobs=2 \
+            --local_ram_resources=4096 \
+            --verbose_failures
```

**File**: `DEPS.bzl` (modified, +4/-0)
```diff
@@ -6498,6 +6498,10 @@ def go_deps():
         name = "org_golang_x_tools",
         build_file_proto_mode = "disable_global",
         importpath = "golang.org/x/tools",
+        patch_args = ["-p1"],
+        patches = [
+            "//build/patches:org_golang_x_tools.patch",
+        ],
         sum = "h1:7Kn5x/d1svx/PzryTsqeoZN4TZwqeH5pGWjefhLi/1Q=",
         version = "v0.47.0",
     )
```

**File**: `MODULE.bazel` (modified, +5/-0)
```diff
@@ -4,3 +4,8 @@
 #
 # For more details, please check https://github.com/bazelbuild/bazel/issues/18958
 ###############################################################################
+
+# Keep in sync with rules_go's MODULE.bazel (currently v0.64.2) and WORKSPACE.
+# Bzlmod resolves this through BCR; offline/restricted builders must preseed
+# registry metadata and the archive, or provide an approved registry mirror.
+bazel_dep(name = "platforms", version = "1.1.0")
```

**File**: `WORKSPACE` (modified, +8/-4)
```diff
@@ -36,14 +36,16 @@ http_archive(
 
 load("@bazel_skylib//lib:versions.bzl", "versions")
 
-versions.check(minimum_bazel_version = "6.0.0")
+# Match the minimum declared by rules_go; CI remains pinned in .bazelversion.
+versions.check(minimum_bazel_version = "6.5.0")
 
 http_archive(
     name = "io_bazel_rules_go",
-    sha256 = "86d3dc8f59d253524f933aaf2f3c05896cb0b605fc35b460c0b4b039996124c6",
+    sha256 = "d5c2c953bf24697b209c21f3ff4edf46fedea98514ec358b10c0e78fc35d363e",
+    # v0.64.2 is not available on mirror.bazel.build. Restricted builders must
+    # preseed this checksum-verified archive or allow the official release URL.
     urls = [
-        "https://mirror.bazel.build/github.com/bazel-contrib/rules_go/releases/download/v0.60.0/rules_go-v0.60.0.zip",
-        "https://github.com/bazel-contrib/rules_go/releases/download/v0.60.0/rules_go-v0.60.0.zip",
+        "https://github.com/bazel-contrib/rules_go/releases/download/v0.64.2/rules_go-v0.64.2.zip",
     ],
 )
 
@@ -82,6 +84,8 @@ load("@io_bazel_rules_go//go:deps.bzl", "go_download_sdk", "go_register_toolchai
 load("//:DEPS.bzl", "go_deps")
 
 # gazelle:repository_macro DEPS.bzl%go_deps
+# Declare the patched x/tools v0.47.0 before go_rules_dependencies(), whose
+# fallback is v0.30.0. Existing repository declarations take precedence.
 go_deps()
 
 go_rules_dependencies()
```

**File**: `build/patches/org_golang_x_tools.patch` (added, +262/-0)
```diff
@@ -0,0 +1,262 @@
+Subject: [PATCH] backport Go 1.27 export-data V5 support
+
+The V5 reader and format definitions are copied unchanged from the released
+upstream golang.org/x/tools v0.50.0 (go.dev/issue/81188). Keep v0.47.0's Go 1.25
+minimum instead of upgrading to v0.50.0, which requires Go 1.26. This Bazel-only
+backport can be removed when the module/toolchain upgrade permits that release.
+
+Source: https://go.googlesource.com/tools/+/refs/tags/v0.50.0/internal/gcimporter/ureader.go
+Source: https://go.googlesource.com/tools/+/refs/tags/v0.50.0/internal/pkgbits/version.go
+
+Include upstream V0-V5 format tests and a real-compiler regression checking
+interleaved ordinary/generic method order. The latter skips pre-Go 1.27.
+
+CI: Check Bazel Prepare explicitly runs the external pkgbits_test target for
+format coverage; TiDB's //... pattern alone does not include external tests.
+The gcimporter tests still require the manual compiler-specific checks below.
+Whenever x/tools or this patch changes, reapply it to a pristine, writable
+checkout of the selected x/tools module and run both commands from that module
+root. Replace <go1.25.14> and <go1.27.3> with those exact SDK directories;
+GOTOOLCHAIN=local prevents an implicit compiler upgrade. Keep the command logs
+and actual compiler versions as manual importer compatibility evidence, separate
+from the automated pkgbits format test.
+
+    GOTOOLCHAIN=local <go1.25.14>/bin/go test ./internal/pkgbits ./internal/gcimporter \
+        -run '^(TestRoundTrip|TestVersions|TestImportTestdata)$' -count=1 -v
+    GOTOOLCHAIN=local <go1.27.3>/bin/go test ./internal/pkgbits ./internal/gcimporter \
+        -run '^(TestGo127MethodOrder|TestRoundTrip|TestVersions)$' -count=1 -v
+
+diff --git a/internal/pkgbits/version.go b/internal/pkgbits/version.go
+--- a/internal/pkgbits/version.go
++++ b/internal/pkgbits/version.go
+@@ -36,6 +36,10 @@
+ 
+ 	// V4: encodes generic methods as standalone function objects
+ 	V4
++
++	// V5: encodes the index of methods to preserve relative order
++	// of nongeneric and generic methods (go.dev/issue/81188).
++	V5
+ 
+ 	numVersions = iota
+ )
+@@ -76,6 +80,10 @@
+ 	// Generic methods may appear as standalone function objects.
+ 	GenericMethods
+ 
++	// Method index is encoded to preserve relative order of
++	// nongeneric and generic methods.
++	PreserveMethodOrder
++
+ 	numFields = iota
+ )
+ 
+@@ -85,6 +93,7 @@
+ 	AliasTypeParamNames: V2,
+ 	CompactCompLiterals: V3,
+ 	GenericMethods:      V4,
++	PreserveMethodOrder: V5,
+ }
+ 
+ // removed is the version a field was removed in or 0 for fields
+diff --git a/internal/pkgbits/pkgbits_test.go b/internal/pkgbits/pkgbits_test.go
+--- a/internal/pkgbits/pkgbits_test.go
++++ b/internal/pkgbits/pkgbits_test.go
+@@ -16,6 +16,9 @@
+ 		pkgbits.V0,
+ 		pkgbits.V1,
+ 		pkgbits.V2,
++		pkgbits.V3,
++		pkgbits.V4,
++		pkgbits.V5,
+ 	} {
+ 		pw := pkgbits.NewPkgEncoder(version, -1)
+ 		w := pw.NewEncoder(pkgbits.RelocMeta, pkgbits.SyncPublic)
+@@ -37,6 +40,10 @@
+ // Type checker to enforce that know V* have the constant values they must have.
+ var _ [0]bool = [pkgbits.V0]bool{}
+ var _ [1]bool = [pkgbits.V1]bool{}
++var _ [2]bool = [pkgbits.V2]bool{}
++var _ [3]bool = [pkgbits.V3]bool{}
++var _ [4]bool = [pkgbits.V4]bool{}
++var _ [5]bool = [pkgbits.V5]bool{}
+ 
+ func TestVersions(t *testing.T) {
+ 	type vfpair struct {
+@@ -55,6 +62,9 @@
+ 		{pkgbits.V0, pkgbits.DerivedInfoNeeded},
+ 		{pkgbits.V1, pkgbits.DerivedInfoNeeded},
+ 		{pkgbits.V2, pkgbits.AliasTypeParamNames},
++		{pkgbits.V3, pkgbits.CompactCompLiterals},
++		{pkgbits.V4, pkgbits.GenericMethods},
++		{pkgbits.V5, pkgbits.PreserveMethodOrder},
+ 	} {
+ 		if !c.v.Has(c.f) {
+ 			t.Errorf("Expected version %v to have field %v", c.v, c.f)
+@@ -69,6 +79,18 @@
+ 		{pkgbits.V2, pkgbits.DerivedInfoNeeded},
+ 		{pkgbits.V0, pkgbits.AliasTypeParamNames},
+ 		{pkgbits.V1, pkgbits.AliasTypeParamNames},
++		{pkgbits.V0, pkgbits.CompactCompLiterals},
++		{pkgbits.V1, pkgbits.CompactCompLiterals},
++		{pkgbits.V2, pkgbits.CompactCompLiterals},
++		{pkgbits.V0, pkgbits.GenericMethods},
++		{pkgbits.V1, pkgbits.GenericMethods},
++		{pkgbits.V2, pkgbits.GenericMethods},
++		{pkgbits.V3, pkgbits.GenericMethods},
++		{pkgbits.V0, pkgbits.PreserveMethodOrder},
++		{pkgbits.V1, pkgbits.PreserveMethodOrder},
++		{pkgbits.V2, pkgbits.PreserveMethodOrder},
++		{pkgbits.V3, pkgbits.PreserveMethodOrder},
++		{pkgbits.V4, pkgbits.PreserveMethodOrder},
+ 	} {
+ 		if c.v.Has(c.f) {
+ 			t.Errorf("Expected version %v to not have field %v", c.v, c.f)
+diff --git a/internal/gcimporter/ureader.go b/internal/gcimporter/ureader.go
+--- a/internal/gcimporter/ureader.go
++++ b/internal/gcimporter/ureader.go
+@@ -629,11 +629,26 @@
+ 				})
+ 			}
+ 
+-			for i, n := 0, r.Len(); i < n; i++ {
+-				named.AddMethod(r.method())
+-			}
+-
+ 			if r.Version().Has(pkgbits.GenericMethods) {
++				// V4 (go1.27.0) emitted all non-generic methods
++				// before all generic one
```

#### Recent Merged Pull Requests:
- **PR #72210** (2026-10-22): config: fix diagnostic-mode goroutine profile flake (@D3Hunter)
- **PR #72196** (2026-10-22): executor: add materialized view refresh runtime (@windtalker)
- **PR #72175** (closed): [DNM] ddl, server: add a status API to drop leftover global index (@joechenrh)
- **PR #72173** (2026-10-22): planner, executor: support nested materialized view fast refresh (@windtalker)
- **PR #72168** (2026-10-21): planner: resolve targets for non-OOP materialized view refresh (@windtalker)
- **PR #72162** (closed): [DNM] ddl: drop leftover global index copies with a reserved DROP INDEX name (@joechenrh)

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

## X. ddl: fix global index copies left or broken by reorganize partition (#72158)

**RULE**:
When implementing operations in `pkg/ddl/index.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in pingcap/tidb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `13544e9b`: ddl: fix global index copies left or broken by reorganize partition (#72158). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/ddl/index.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
		// Compare IDs, since a partition reorganization keeps index copies with the same name.
		if index.ID == indexInfo.ID {
// RemoveDependentHiddenColumns removes the hidden columns used by the index, except those still
// used by another index, e.g. a copy of the index made by a partition reorganization.
		if col.Hidden && !isColumnUsedByOtherIndex(tblInfo, idxInfo.ID, col.Offset) {
// isColumnUsedByOtherIndex checks whether the column is used by an index other than
// indexID, e.g. a copy of the index made by a partition reorganization.
func isColumnUsedByOtherIndex(tblInfo *model.TableInfo, indexID int64, offset int) bool {
	for _, idx := range tblInfo.Indices {
		if idx.ID == indexID {
			continue
		}
		for _, col := range idx.Columns {
			if col.Offset == offset {
				return true
			}
		}
	}
	return false
}

```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
		if index.Name.L == indexInfo.Name.L {
// RemoveDependentHiddenColumns removes hidden columns by the indexInfo.
		if col.Hidden {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `13544e9b` are properly handled with clean fallback behavior.
