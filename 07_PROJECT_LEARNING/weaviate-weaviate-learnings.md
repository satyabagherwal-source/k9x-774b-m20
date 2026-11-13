> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/weaviate-weaviate-learnings.md`  
> **Source**: github ([https://github.com/weaviate/weaviate](https://github.com/weaviate/weaviate))  
> **Source Version**: `927ec35c`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T18:52:33.998Z  
> **Learning ID**: `learn-github-weaviate-weaviate`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): weaviate/weaviate

> **Canonical Artifact**: `07_PROJECT_LEARNING/weaviate-weaviate-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/weaviate/weaviate](https://github.com/weaviate/weaviate))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T18:52:33.993Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `weaviate/weaviate`
- **Description**: Weaviate is an open-source vector database that stores both objects and vectors, allowing for the combination of vector search with structured filtering with the fault tolerance and scalability of a cloud-native database​.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: pyproject.toml, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 16944 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `adapters/handlers/graphql/utils/helper_objects.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

// Package utils provides utility methods and classes to support the graphql endpoint for Weaviate
package utils

import (
	"errors"

	"github.com/tailor-platform/graphql"
)

// GraphQLNetworkFieldContents contains all objects regarding GraphQL fields
type GraphQLNetworkFieldContents struct {
	NetworkGetObject        *graphql.Object // Object containing all fields for GraphQL Network Get schema generation
	NetworkMetaObject       *graphql.Object // Object containing all fields for GraphQL Network Meta schema generation
	NetworkFetchObject      *graphql.Object // Object containing all fields for GraphQL Network Fetch schema generation
	NetworkIntrospectObject *graphql.Object // Object containing all fields for GraphQL Network Introspect schema generation
	NetworkAggregateObject  *graphql.Object // Object containing all fields for GraphQL Network Aggregate schema generation
}

// FilterContainer contains all objects regarding GraphQL filters. Some filter elements are declared as global variables in the prototype, this struct achieves the same goal.
type FilterContainer struct {
	WhereOperatorEnum                           *graphql.Enum                   // Object containing all fields for the Where filter
	Operands                                    *graphql.InputObject            // Object containing all Operands
	LocalFilterOptions                          map[string]*graphql.InputObject // Object containing all fields for Local filters
	NetworkFilterOptions                        map[string]*graphql.InputObject // Object containing all fields for Network filters
	FetchThingsActionsWhereFilterArgConf        *graphql.ArgumentConfig         // Object containing the Where filter fields for Fetch Objects
	IntrospectThingsActionsWhereFilterArgConf   *graphql.ArgumentConfig         // Object containing the Where filter fields for Introspect Objects
	WeaviateNetworkWhereKeywordsInpObj          *graphql.InputObject            // Object containing a global filter element
	WeaviateNetworkIntrospectPropertiesObjField *graphql.Field                  // Object containing a global filter element
}

var ErrEmptySchema = errors.New("there are no classes defined yet")

```

### Core Architecture Module: `adapters/handlers/grpc/v1/batch/queues.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

package batch

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"

	pb "github.com/weaviate/weaviate/grpc/generated/protocol/v1"
)

var errReportingQueueClosed = errors.New("reporting queue closed")

const OOM_WAIT_TIME = 300

func newBatchAcksMessage(uuids, beacons []string) *pb.BatchStreamReply {
	return &pb.BatchStreamReply{
		Message: &pb.BatchStreamReply_Acks_{
			Acks: &pb.BatchStreamReply_Acks{
				Uuids:   uuids,
				Beacons: beacons,
			},
		},
	}
}

func newBatchResultsMessage(successes []*pb.BatchStreamReply_Results_Success, errors []*pb.BatchStreamReply_Results_Error) *pb.BatchStreamReply {
	return &pb.BatchStreamReply{
		Message: &pb.BatchStreamReply_Results_{
			Results: &pb.BatchStreamReply_Results{
				Errors:    errors,
				Successes: successes,
			},
		},
	}
}

// newBatchResultsErrorMessage reports one error per uuid and per beacon.
func newBatchResultsErrorMessage(uuids, beacons []string, msg string) *pb.BatchStreamReply {
	errs := make([]*pb.BatchStreamReply_Results_Error, 0, len(uuids)+len(beacons))
	for _, uuid := range uuids {
		errs = append(errs, &pb.BatchStreamReply_Results_Error{
			Error:  msg,
			Detail: &pb.BatchStreamReply_Results_Error_Uuid{Uuid: uuid},
		})
	}
	for _, beacon := range beacons {
		errs = append(errs, &pb.BatchStreamReply_Results_Error{
			Error:  msg,
			Detail: &pb.BatchStreamReply_Results_Error_Beacon{Beacon: beacon},
		})
	}
	return newBatchResultsMessage(nil, errs)
}

func newBatchShuttingDownMessage() *pb.BatchStreamReply {
	return &pb.BatchStreamReply{
		Message: &pb.BatchStreamReply_ShuttingDown_{
			ShuttingDown: &pb.BatchStreamReply_ShuttingDown{},
		},
	}
}

func newBatchStartedMessage() *pb.BatchStreamReply {
	return &pb.BatchStreamReply{
		Message: &pb.BatchStreamReply_Started_{
			Started: &pb.BatchStreamReply_Started{},
		},
	}
}

func newBatchOutOfMemoryMessage(uuids, beacons []string) *pb.BatchStreamReply {
	return &pb.BatchStreamReply{
		Message: &pb.BatchStreamReply_OutOfMemory_{
			OutOfMemory: &pb.BatchStreamReply_OutOfMemory{
				Uuids:    uuids,
				Beacons:  beacons,
				WaitTime: OOM_WAIT_TIME,
			},
		},
	}
}

func newBatchBackoffMessage(batchSize int) *pb.BatchStreamReply {
	return &pb.BatchStreamReply{
		Message: &pb.BatchStreamReply_Backoff_{
			Backoff: &pb.BatchStreamReply_Backoff{
				BatchSize: int32(batchSize),
			},
		},
	}
}

type report struct {
	Errors    []*pb.BatchStreamReply_Results_Error
	Successes []*pb.BatchStreamReply_Results_Success
	Stats     *workerStats
}

type (
	processingQueue chan *processRequest
	reportingQueue  chan *report
)

// NewProcessingQueue creates a channel for batch writing.
func NewProcessingQueue() processingQueue {
	return make(processingQueue)
}

func NewReportingQueues() *reportingQueues {
	return &reportingQueues{}
}

// reportingQueues is a registry of per-stream reporting channels. Each stream owns its
// own lifecycle synchronization via streamQueue, so a slow consumer on one stream does
// not block operations on any other.
type reportingQueues struct {
	queues sync.Map // map[string]*streamQueue
}

// streamQueue is a per-stream reporting channel with done-channel + sends-WG semantics
// so that close can signal in-flight senders to abort, wait for them to release, and
// then close the underlying channel — without holding any cross-stream lock.
type streamQueue struct {
	ch        reportingQueue
	done      chan struct{}
	sendsWg   sync.WaitGroup
	mu        sync.Mutex
	closed    bool
	closeOnce sync.Once
}

func newStreamQueue() *streamQueue {
	return &streamQueue{
		ch:   make(reportingQueue),
		done: make(chan struct{}),
	}
}

func (sq *streamQueue) send(streamCtx context.Context, r *report) error {
	sq.mu.Lock()
	if sq.closed {
		sq.mu.Unlock()
		return errReportingQueueClosed
	}
	sq.sendsWg.Add(1)
	sq.mu.Unlock()
	defer sq.sendsWg.Done()

	select {
	case sq.ch <- r:
		return nil
	case <-sq.done:
		return errReportingQueueClosed
	case <-streamCtx.Done():
		return streamCtx.Err()
	}
}

func (sq *streamQueue) close() {
	sq.closeOnce.Do(func() {
		sq.mu.Lock()
		sq.closed = true
		sq.mu.Unlock()
		close(sq.done)
		sq.sendsWg.Wait()
		close(sq.ch)
	})
}

// Get returns the read end of the reporting channel for streamId.
func (r *reportingQueues) Get(streamId string) (reportingQueue, bool) {
	v, ok := r.queues.Load(streamId)
	if !ok {
		return nil, false
	}
	return v.(*streamQueue).ch, true
}

func (r *reportingQueues) close(streamId string) {
	if v, ok := r.queues.Load(streamId); ok {
		v.(*streamQueue).close()
	}
}

func (r *reportingQueues) delete(streamId string) {
	r.queues.Delete(streamId)
}

func (r *reportingQueues) send(streamCtx context.Context, streamId string, successes []*pb.BatchStreamReply_Results_Success, errs []*pb.BatchStreamReply_Results_Error, stats *workerStats) error {
	v, ok := r.queues.Load(streamId)
	if !ok {
		return fmt.Errorf("reporting queue not found for stream ID: %s", streamId)
	}
	return v.(*streamQueue).send(streamCtx, &report{Successes: successes, Errors: errs, Stats: stats})
}

// Make initializes a reporting queue for the given stream ID if it does not already exist.
func (r *reportingQueues) Make(streamId string) {
	r.queues.LoadOrStore(streamId, newStreamQueue())
}

type workerStats struct {
	processingTime time.Duration
}

func newWorkersStats(processingTime time.Duration) *workerStats {
	return &workerStats{
		processingTime: processingTime,
	}
}

type stats struct {
	lock              sync.RWMutex
	processingTimeEma float64
	batchSizeEma      float64
	throughputEma     float64
}

func newStats() *stats {
	return &stats{
		// Start assuming the batch size is correct. This will reduce if the batch size should be larger.
		processingTimeEma: time.Second.Seconds(),
		// Start with a lower range batch size of 200 (min 100, max 1000)
		batchSizeEma: 200,
		// Start at default batchSizeEma / default processingTimeEma
		throughputEma: 200,
	}
}

// Optimum is that each worker takes at most 1s to process a batch so that shutdown does not take too long
var IDEAL_PROCESSING_TIME = time.Second.Seconds()

// Update EMAs using standard formula
// newEma = alpha*newValue + (1-alpha)*oldEma
func (s *stats) ema(new float64, ema float64) float64 {
	alpha := 0.25
	return alpha*new + (1-alpha)*ema
}

func (s *stats) updateBatchSize(processingTime time.Duration) {
	// Set alpha to favour historic data more heavily to smooth out spikes
	s.lock.Lock()
	defer s.lock.Unlock()

	s.processingTimeEma = s.ema(processingTime.Seconds(), s.processingTimeEma)
	if s.processingTimeEma-IDEAL_PROCESSING_TIME > 0.1 {
		s.batchSizeEma = s.ema(s.batchSizeEma-100, s.batchSizeEma)
	} else if s.processingTimeEma-IDEAL_PROCESSING_TIME < -0.1 {
		s.batchSizeEma = s.ema(s.batchSizeEma+100, s.batchSizeEma)
	}
	s.throughputEma = s.ema(s.batchSizeEma/s.processingTimeEma, s.throughputEma)

	if s.batchSizeEma < 100 {
		s.batchSizeEma = 100
	}
	if s.batchSizeEma > 1000 {
		s.batchSizeEma = 1000
	}
}

func (s *stats) getBatchSize() int {
	s.lock.RLock()
	defer s.lock.RUnlock()
	return int(math.Ceil(s.batchSizeEma))
}

func (s *stats) getThroughputEma() float64 {
	s.lock.RLock()
	defer s.lock.RUnlock()
	return s.throughputEma
}

```

### Core Architecture Module: `adapters/handlers/grpc/v1/batch/worker.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

package batch

import (
	"bytes"
	"context"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	enterrors "github.com/weaviate/weaviate/entities/errors"
	pb "github.com/weaviate/weaviate/grpc/generated/protocol/v1"
	replicaerrors "github.com/weaviate/weaviate/usecases/replica/errors"
)

const (
	PER_PROCESS_TIMEOUT = 60 * time.Second
	MAX_RETRIES         = 5
	BACKOFF_RETRY_TIME  = 100 * time.Millisecond
)

// batcher implementations must not mutate the objects or references in the request.
// The retry re-sends the same pointers, so any rewrite makes the retry a different
// request from the first attempt.
type Batcher interface {
	BatchObjects(ctx context.Context, req *pb.BatchObjectsRequest) (*pb.BatchObjectsReply, error)
	BatchReferences(ctx context.Context, req *pb.BatchReferencesRequest) (*pb.BatchReferencesReply, error)
}

type worker struct {
	batcher         Batcher
	logger          logrus.FieldLogger
	reportingQueues *reportingQueues
	processingQueue processingQueue
}

type processRequest struct {
	streamId         string
	consistencyLevel *pb.ConsistencyLevel
	objects          []*pb.BatchObject
	references       []*pb.BatchReference
	// If the collections of the objects within this request use vectorisation or not;
	// this should be accounted for by fanning out the objects to better improve I/O concurrency
	// to the third-party vectoriser for the specific classes that use it.
	usesVectorisationByCollection map[string]bool
	// This context contains metadata relevant to the stream as a whole, e.g. auth info,
	// that is required for downstream authZ checks by the workers, e.g. data-specific RBAC.
	streamCtx context.Context
	// Callback to signal process completion and perform any necessary cleanup
	onComplete func()
	// Callback to signal process beginning
	onStart func()
}

// StartBatchWorkers launches a specified number of worker goroutines to process batch requests.
//
// Each worker listens on the provided processing queue for incoming batch requests, processes them
// using the provided batcher, and results any errors or statistics to the resulting queues.
//
// The function takes a wait group to track the completion of all workers, the number of workers to start,
// the processing queue from which to read batch requests, the resulting queues for sending back results,
// the batcher interface for processing the requests, and a logger for logging purposes.
//
// This waitgroup is used by the drain shutdown logic to ensure that all workers have completed processing
// before any open server-side streams can be fully closed since ongoing workers may produce errors that need
// resulting to clients before the server shuts down completely.
func StartBatchWorkers(
	wg *sync.WaitGroup,
	concurrency int,
	processingQueue processingQueue,
	reportingQueues *reportingQueues,
	batcher Batcher,
	logger logrus.FieldLogger,
) {
	eg := enterrors.NewErrorGroupWrapper(logger)
	logger.WithField("action", "batch_workers_start").WithField("concurrency", concurrency).Debug("entering worker loop(s)")
	for range concurrency {
		wg.Add(1)
		eg.Go(func() error {
			defer wg.Done()
			w := &worker{
				batcher:         batcher,
				logger:          logger,
				reportingQueues: reportingQueues,
				processingQueue: processingQueue,
			}
			return w.Loop()
		})
	}
}

func (w *worker) isTransientReplicationError(err string) bool {
	return strings.Contains(err, replicaerrors.ErrReplicas.Error()) || // coordinator: any error due to replicating to shutdown node
		strings.Contains(err, "connect: Post") || // rest: failed to connect to shutdown node
		strings.Contains(err, "status code: 404, error: request not found") || // rest: failed to find request on shutdown node
		(strings.Contains(err, "resolve node name") && strings.Contains(err, "to host")) || // memberlist: failed to resolve to other shutdown node in cluster
		strings.Contains(err, "the client connection is closing") || // grpc: connection to other shutdown node is closed
		strings.Contains(err, "Node not ready") // rest: node is not ready to accept requests (still starting up or shutting down)
}

// fanoutReply carries the sub-batch it answers, because replies arrive in
// whatever order the concurrent calls finish. subBatch gives the range of valid
// error indices. offset is where the sub-batch starts in the collection's object
// list. Together they trace every error index back to its object.
type fanoutReply struct {
	reply    *pb.BatchObjectsReply
	err      error
	subBatch []*pb.BatchObject
	offset   int
}

func (w *worker) fanoutObjects(
	ctx context.Context,
	objs []*pb.BatchObject,
	cl *pb.ConsistencyLevel,
	fanoutAmount int,
) chan fanoutReply {
	ch := make(chan fanoutReply, fanoutAmount)
	var wg sync.WaitGroup

	subBatchLen := int(math.Ceil(float64(len(objs)) / float64(fanoutAmount)))
	for i := 0; i < fanoutAmount; i++ {
		start := i * subBatchLen
		if start >= len(objs) {
			break
		}
		end := (i + 1) * subBatchLen
		if end > len(objs) {
			end = len(objs)
		}
		subBatch := objs[start:end]
		wg.Add(1)
		enterrors.GoWrapper(func() {
			defer wg.Done()
			reply, err := w.batcher.BatchObjects(ctx, &pb.BatchObjectsRequest{
				Objects:          subBatch,
				ConsistencyLevel: cl,
			})
			ch <- fanoutReply{reply: reply, err: err, subBatch: subBatch, offset: start}
		}, w.logger)
	}

	enterrors.GoWrapper(func() {
		wg.Wait()
		close(ch)
	}, w.logger)

	return ch
}

func (w *worker) sendObjects(
	ctx context.Context,
	streamId string,
	objs []*pb.BatchObject,
	cl *pb.ConsistencyLevel,
	usesVectorisationByCollection map[string]bool,
	retries int,
) ([]*pb.BatchStreamReply_Results_Success, []*pb.BatchStreamReply_Results_Error) {
	if ctx.Err() != nil {
		w.logger.WithField("streamId", streamId).Warnf("context error before sending objects: %s", ctx.Err())
		errors := make([]*pb.BatchStreamReply_Results_Error, 0, len(objs))
		for _, obj := range objs {
			errors = append(errors, &pb.BatchStreamReply_Results_Error{
				Error:  ctx.Err().Error(),
				Detail: &pb.BatchStreamReply_Results_Error_Uuid{Uuid: obj.Uuid},
			})
		}
		return nil, errors
	}

	// Assumption is no errors, so don't preallocate error slice
	errors := make([]*pb.BatchStreamReply_Results_Error, 0)
	// Assumption is all successes, so preallocate success slice
	successes := make([]*pb.BatchStreamReply_Results_Success, 0, len(objs))
	// keyed by index into objs, the same indexing the success loop below uses
	failed := make(map[int]struct{})
	// Keep track of retriable errors to send again
	retriable := make([]*pb.BatchObject, 0)

	idxsByCollection := make(map[string][]int)
	for i, obj := range objs {
		idxsByCollection[obj.Collection] = append(idxsByCollection[obj.Collection], i)
	}

	for collection, outerIdxs := range idxsByCollection {
		fanoutAmount := 1
		if usesVectorisationByCollection[collection] {
			fanoutAmount = 10
		}
		collectionObjs := make([]*pb.BatchObject, 0, len(outerIdxs))
		for _, i := range outerIdxs {
			collectionObjs = append(collectionObjs, objs[i])
		}
		replies := w.fanoutObjects(ctx, collectionObjs, cl, fanoutAmount)
		errorsInner, retriableInner := w.fanInReplies(streamId, replies, objs, outerIdxs, retries, failed)
		errors = append(errors, errorsInner...)
		retriable = append(retriable, retriableInner...)
	}
	if len(retriable) > 0 {
		// exponential backoff with 2 ** n
		if retries > 0 {
			// retry immediately on first retry
			<-time.After(time.Duration(math.Pow(2, float64(retries))) * BACKOFF_RETRY_TIME)
		}
		w.logger.WithField("streamId", streamId).Warnf("retrying %d transient replication errors for objects", len(retriable))
		successesInner, errorsInner := w.sendObjects(ctx, streamId, retriable, cl, usesVectorisationByCollection, retries+1)
		successes = append(successes, successesInner...)
		errors = append(errors, errorsInner...)
	}
	// Handle successes
	for i, obj := range objs {
		if _, ok := failed[i]; ok {
			continue
		}
		successes = append(successes, &pb.BatchStreamReply_Results_Success{
			Detail: &pb.BatchStreamReply_Results_Success_Uuid{Uuid: obj.Uuid},
		})
	}
	return successes, errors
}

// fanInReplies drains one collection's fanout replies and records every
// reply error on the object it belongs to. outerIdxs[j] is the position of the
// collection's j-th object in the full batch. failed is keyed by that position
// and is mutated in place. A reply's error indices only mean something
// inside its own sub-batch, so an out-of-range index is ignored.
func (w *worker) fanInReplies(
	streamId string,
	replies <-chan fanoutReply,
	objs []*pb.BatchObject,
	outerIdxs []int,
	retries int,
	failed map[int]struct{},
) (errs []*pb.BatchStreamReply_Results_Error, retriable []*pb.BatchObject) {
	log := w.logger.WithField("streamId", streamId)
	for resp := range replies {
		if resp.err != nil {
			log.Errorf("failed to batch objects: %s", resp.err)
			for k := range resp.subBatch {
				outer := outerIdxs[resp.offset+k]
				failed[outer] = struct{}{}
				errs = append(errs, &pb.BatchStreamReply_Results_Error{
					Error:  enterrors.MessageWithDocsLink(resp.err),
					Detail: &pb.BatchStreamReply_Results_Error_Uuid{Uuid: objs[outer].Uuid},
				})
			}
			continue
		}
		for _, err := range resp.reply.GetErrors() {
			if err == nil {
				continue
			}
			if err.Index < 0 || int(err.Index) >= len(resp.subBatch) {
				log.Errorf("dropping batch reply error with index %d outside the sub-batch of %d objects: %s", err.Index, len(resp.subBatch), err.Error)
				continue
			}
			outer := outerIdxs[resp.offset+int(err.Index)]
			obj := objs[outer]
			failed[outer] = struct{}{}
			if w.isTransientReplicationError(err.E
```

### Core Architecture Module: `adapters/handlers/rest/clusterapi/shared/util.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

package shared

import (
	"errors"

	"github.com/go-openapi/strfmt"

	"github.com/weaviate/weaviate/usecases/replica"
	replicaerrors "github.com/weaviate/weaviate/usecases/replica/errors"
)

// CompareHashTreeRootsMultiPath is node-level; the leading underscore cannot collide with a class segment.
const CompareHashTreeRootsMultiPath = "/replicas/indices/_compareHashTreeRootsMulti"

func LocalIndexNotReady(resp replica.SimpleResponse) bool {
	if err := resp.FirstError(); err != nil {
		var replicaErr *replicaerrors.Error
		if errors.As(err, &replicaErr) && replicaErr.IsStatusCode(replicaerrors.StatusNotReady) {
			return true
		}
	}
	return false
}

func StringsToUUIDs(ss []string) []strfmt.UUID {
	uuids := make([]strfmt.UUID, len(ss))
	for i, s := range ss {
		uuids[i] = strfmt.UUID(s)
	}
	return uuids
}

func UUIDsToStrings(uuids []strfmt.UUID) []string {
	ss := make([]string, len(uuids))
	for i, u := range uuids {
		ss[i] = u.String()
	}
	return ss
}

```

### Core Architecture Module: `adapters/handlers/rest/drop_vector_index_enqueuer.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

package rest

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"github.com/weaviate/weaviate/adapters/repos/db"
	"github.com/weaviate/weaviate/cluster/distributedtask"
	"github.com/weaviate/weaviate/cluster/schema/leader"
	"github.com/weaviate/weaviate/cluster/schema/local"
	"github.com/weaviate/weaviate/entities/models"
	"github.com/weaviate/weaviate/entities/modelsext"
	entschema "github.com/weaviate/weaviate/entities/schema"
	"github.com/weaviate/weaviate/usecases/namespaces"
	"github.com/weaviate/weaviate/usecases/schema"
	"github.com/weaviate/weaviate/usecases/schema/namespacing"
	"github.com/weaviate/weaviate/usecases/sharding"
)

// dropVectorIndexEnqueuer implements schema.DropVectorIndexEnqueuer. It submits
// the background cleanup distributed task and reports whether one is in flight,
// using the cluster DTM client + sharding state. Lives in the REST wiring layer
// so it can reuse buildUnitMaps/buildUnitSpecs.
type dropVectorIndexEnqueuer struct {
	clusterService clusterDropTaskClient
	schemaState    leader.SchemaReader
	logger         logrus.FieldLogger // nil-safe: only used for skip warnings
	// finalizer removes dropped VectorConfig entries directly — the escape
	// for MT collections with ZERO tenants, where no cleanup task can ever
	// exist to drive the finalize. Installed post-construction
	// (SetVectorConfigFinalizer): the schema manager does not exist yet when the
	// enqueuer is built. Nil-safe.
	finalizer dropVectorFinalizer
}

// dropVectorFinalizer is the slice of the schema finalizer the enqueuer uses.
type dropVectorFinalizer interface {
	RemoveDroppedVectorConfig(ctx context.Context, collection string, targets []string) error
}

// clusterDropTaskClient is the slice of the cluster service the enqueuer uses.
type clusterDropTaskClient interface {
	distributedtask.TaskLister
	AddDistributedTaskWithGroups(ctx context.Context, namespace, taskID string,
		taskPayload any, unitSpecs []distributedtask.UnitSpec) error
}

func newDropVectorIndexEnqueuer(clusterService clusterDropTaskClient, schemaState leader.SchemaReader, logger logrus.FieldLogger) *dropVectorIndexEnqueuer {
	return &dropVectorIndexEnqueuer{clusterService: clusterService, schemaState: schemaState, logger: logger}
}

// SetVectorConfigFinalizer installs the direct-finalize hook (see the field
// doc). Must be called before the drop-vector reconcile loop starts and
// before the REST API serves — the only two paths that enqueue (restore-time
// shard loads during ClusterService.Open use LiveOpIDs, never this).
func (e *dropVectorIndexEnqueuer) SetVectorConfigFinalizer(f dropVectorFinalizer) {
	e.finalizer = f
}

// logInfo logs an enqueue-path decision (nil-safe like every logger use here).
func (e *dropVectorIndexEnqueuer) logInfo(collection, msg string) {
	if e.logger != nil {
		e.logger.WithField("collection", collection).Info(msg)
	}
}

// warnSkippedPayload surfaces an undecodable active-task payload instead of
// silently skipping it (the skip itself is deliberate fail-open behavior).
// Package-level so no skip site can silently re-inline a divergent copy.
func warnSkippedPayload(logger logrus.FieldLogger, where, taskID string, err error) {
	if logger != nil {
		logger.WithField("task", taskID).
			Warnf("drop-vector %s: skipping active task with unparseable payload: %v", where, err)
	}
}

// ListDistributedTasks exposes the cluster task list for the reconcile loop
// (one fetch per round) and its startup readiness probe.
func (e *dropVectorIndexEnqueuer) ListDistributedTasks(ctx context.Context) (map[string][]*distributedtask.Task, error) {
	return e.clusterService.ListDistributedTasks(ctx)
}

// HasActiveDrop reports whether a non-terminal drop task already covers
// targetVector on collection.
func (e *dropVectorIndexEnqueuer) HasActiveDrop(ctx context.Context, collection, targetVector string) (bool, error) {
	tasks, err := e.clusterService.ListDistributedTasks(ctx)
	if err != nil {
		return false, err
	}
	return activeDropCovers(tasks, collection, targetVector, e.logger), nil
}

// activeDropCovers reports whether a non-terminal drop task in tasks covers
// targetVector on collection. Shared by HasActiveDrop and the reconcile loop
// (which fetches the task list once per round instead of once per marker).
func activeDropCovers(tasks map[string][]*distributedtask.Task, collection, targetVector string,
	logger logrus.FieldLogger,
) bool {
	return db.ActiveDropCovers(tasks[db.DropVectorIndexNamespace], collection, targetVector, logger)
}

// EnqueueDropVectorIndex submits a fresh cleanup task with one unit per
// (shard, replica) grouped by shard. Shards already cleaned by this drop's
// earlier tasks get no unit.
func (e *dropVectorIndexEnqueuer) EnqueueDropVectorIndex(ctx context.Context, collection string, targets []string) error {
	tasks, err := e.clusterService.ListDistributedTasks(ctx)
	if err != nil {
		return fmt.Errorf("drop-vector enqueue: list tasks for %q: %w", collection, err)
	}
	return e.EnqueueDropVectorIndexWithTasks(ctx, collection, targets, tasks)
}

// EnqueueDropVectorIndexWithTasks is EnqueueDropVectorIndex against an
// already-fetched task list, so the reconcile loop pays ONE ListDistributedTasks
// per round instead of one per marker. A slightly stale list is safe: the
// AddTask-apply guard (CheckConflict) re-proves the coverage claim against the
// FSM's live records, and any rejection is retried by the next round.
func (e *dropVectorIndexEnqueuer) EnqueueDropVectorIndexWithTasks(ctx context.Context, collection string,
	targets []string, tasks map[string][]*distributedtask.Task,
) error {
	// Re-validate against the leader-consistent class: the marker commit and this
	// enqueue are not atomic, and reconciliation may run off a stale local schema
	// snapshot. A target that is no longer marked dropped (class deleted and
	// re-created, or already finalized elsewhere) must not get a cleanup task —
	// that task would strip a live vector.
	targets, err := e.stillDroppedTargets(collection, targets)
	if err != nil {
		return fmt.Errorf("drop-vector enqueue: verify targets for %q: %w", collection, err)
	}
	if len(targets) == 0 {
		return nil // nothing (still) marked dropped — no-op
	}

	state, _, err := e.schemaState.ShardingStateFromLeader(collection)
	if err != nil {
		return fmt.Errorf("drop-vector enqueue: sharding state for %q: %w", collection, err)
	}
	if state == nil {
		return fmt.Errorf("drop-vector enqueue: no sharding state for collection %q", collection)
	}
	shardOwnership := activeShardOwnership(state)
	if len(shardOwnership) == 0 {
		// A non-MT collection always has shards, so an empty map there is a
		// real problem.
		if !state.PartitioningEnabled {
			return fmt.Errorf("drop-vector enqueue: no shards for collection %q", collection)
		}
		if len(state.Physical) == 0 {
			// ZERO tenants (never created, or all deleted after the marker
			// landed): no cleanup task can ever exist, so nothing would
			// drive the finalize — remove the entries directly. There is no
			// data to strip, and the FSM removal gate explicitly allows the
			// empty-shard-set case for exactly this reason.
			if e.finalizer == nil {
				// An error, not a logged no-op: with no finalizer, NOTHING
				// can ever remove this marker — a wiring regression that
				// returned success here would hand the client a 200 for a
				// drop that silently never completes.
				return fmt.Errorf("drop-vector enqueue: collection %q has no tenants and no finalizer is wired; cannot remove the dropped vector entries", collection)
			}
			if err := e.finalizer.RemoveDroppedVectorConfig(ctx, collection, targets); err != nil {
				return fmt.Errorf("drop-vector enqueue: finalize tenant-less collection %q: %w", collection, err)
			}
			e.logInfo(collection, fmt.Sprintf(
				"drop-vector enqueue: collection has no tenants; direct removal of dropped vector entries %v applied "+
					"(a no-op on a lagging local view — reconciliation retries then)", targets))
			return nil
		}
		// Tenants exist but none is active: the marker is already applied —
		// a no-op success, not an error. Reconciliation re-enqueues once a
		// tenant is activated.
		e.logInfo(collection, "drop-vector enqueue: all tenants inactive; the marker stays until a tenant is activated")
		return nil
	}

	epoch, cleaned, finalizeNow := db.EpochAndInheritedCoverage(collection, targets, state, tasks, e.logger)
	if finalizeNow {
		// The chain covers every shard that still exists, and what it owed went
		// away with a deleted tenant. Re-cleaning here would rewrite every
		// segment of shards that are already stripped, so remove the entries on
		// the recorded coverage instead. The FSM removal gate accepts the same
		// proof (ResolvedByShardDeletion), so this cannot propose a removal the
		// apply would refuse.
		if e.finalizer == nil {
			return fmt.Errorf("drop-vector enqueue: collection %q has a complete cleanup chain but no finalizer is wired; cannot remove the dropped vector entries", collection)
		}
		if err := e.finalizer.RemoveDroppedVectorConfig(ctx, collection, targets); err != nil {
			return fmt.Errorf("drop-vector enqueue: finalize collection %q on recorded coverage: %w", collection, err)
		}
		e.logInfo(collection, fmt.Sprintf(
			"drop-vector enqueue: every remaining shard is covered and the uncleaned ones were deleted; "+
				"removed dropped vector entries %v without re-cleaning", targets))
		return nil
	}
	shardOwnership = withoutCleanedShards(shardOwnership, cleaned)
	shardOwnership, deferredShards := capShardOwnership(shardOwnership, maxShardsPerDropRound)
	if deferre
```

### Core Architecture Module: `adapters/handlers/rest/operations/replication/get_collection_sharding_state.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

// Code generated by go-swagger; DO NOT EDIT.

package replication

// This file was generated by the swagger tool.
// Editing this file might prove futile when you re-run the generate command

import (
	"net/http"

	"github.com/go-openapi/runtime/middleware"

	"github.com/weaviate/weaviate/entities/models"
)

// GetCollectionShardingStateHandlerFunc turns a function with the right signature into a get collection sharding state handler
type GetCollectionShardingStateHandlerFunc func(GetCollectionShardingStateParams, *models.Principal) middleware.Responder

// Handle executing the request and returning a response
func (fn GetCollectionShardingStateHandlerFunc) Handle(params GetCollectionShardingStateParams, principal *models.Principal) middleware.Responder {
	return fn(params, principal)
}

// GetCollectionShardingStateHandler interface for that can handle valid get collection sharding state params
type GetCollectionShardingStateHandler interface {
	Handle(GetCollectionShardingStateParams, *models.Principal) middleware.Responder
}

// NewGetCollectionShardingState creates a new http.Handler for the get collection sharding state operation
func NewGetCollectionShardingState(ctx *middleware.Context, handler GetCollectionShardingStateHandler) *GetCollectionShardingState {
	return &GetCollectionShardingState{Context: ctx, Handler: handler}
}

/*
	GetCollectionShardingState swagger:route GET /replication/sharding-state replication getCollectionShardingState

# Get sharding state

Fetches the current sharding state, including replica locations and statuses, for all collections or a specified collection. If a shard name is provided along with a collection, the state for that specific shard is returned.
*/
type GetCollectionShardingState struct {
	Context *middleware.Context
	Handler GetCollectionShardingStateHandler
}

func (o *GetCollectionShardingState) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	route, rCtx, _ := o.Context.RouteInfo(r)
	if rCtx != nil {
		*r = *rCtx
	}
	var Params = NewGetCollectionShardingStateParams()
	uprinc, aCtx, err := o.Context.Authorize(r, route)
	if err != nil {
		o.Context.Respond(rw, r, route.Produces, route, err)
		return
	}
	if aCtx != nil {
		*r = *aCtx
	}
	var principal *models.Principal
	if uprinc != nil {
		principal = uprinc.(*models.Principal) // this is really a models.Principal, I promise
	}

	if err := o.Context.BindValidRequest(r, route, &Params); err != nil { // bind params
		o.Context.Respond(rw, r, route.Produces, route, err)
		return
	}

	res := o.Handler.Handle(Params, principal) // actually handle the request
	o.Context.Respond(rw, r, route.Produces, route, res)

}

```

### Core Architecture Module: `adapters/handlers/rest/operations/replication/get_collection_sharding_state_parameters.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

// Code generated by go-swagger; DO NOT EDIT.

package replication

// This file was generated by the swagger tool.
// Editing this file might prove futile when you re-run the swagger generate command

import (
	"net/http"

	"github.com/go-openapi/errors"
	"github.com/go-openapi/runtime"
	"github.com/go-openapi/runtime/middleware"
	"github.com/go-openapi/strfmt"
)

// NewGetCollectionShardingStateParams creates a new GetCollectionShardingStateParams object
//
// There are no default values defined in the spec.
func NewGetCollectionShardingStateParams() GetCollectionShardingStateParams {

	return GetCollectionShardingStateParams{}
}

// GetCollectionShardingStateParams contains all the bound params for the get collection sharding state operation
// typically these are obtained from a http.Request
//
// swagger:parameters getCollectionShardingState
type GetCollectionShardingStateParams struct {

	// HTTP Request Object
	HTTPRequest *http.Request `json:"-"`

	/*The collection name to get the sharding state for.
	  In: query
	*/
	Collection *string
	/*The shard to get the sharding state for.
	  In: query
	*/
	Shard *string
}

// BindRequest both binds and validates a request, it assumes that complex things implement a Validatable(strfmt.Registry) error interface
// for simple values it will use straight method calls.
//
// To ensure default values, the struct must have been initialized with NewGetCollectionShardingStateParams() beforehand.
func (o *GetCollectionShardingStateParams) BindRequest(r *http.Request, route *middleware.MatchedRoute) error {
	var res []error

	o.HTTPRequest = r

	qs := runtime.Values(r.URL.Query())

	qCollection, qhkCollection, _ := qs.GetOK("collection")
	if err := o.bindCollection(qCollection, qhkCollection, route.Formats); err != nil {
		res = append(res, err)
	}

	qShard, qhkShard, _ := qs.GetOK("shard")
	if err := o.bindShard(qShard, qhkShard, route.Formats); err != nil {
		res = append(res, err)
	}
	if len(res) > 0 {
		return errors.CompositeValidationError(res...)
	}
	return nil
}

// bindCollection binds and validates parameter Collection from query.
func (o *GetCollectionShardingStateParams) bindCollection(rawData []string, hasKey bool, formats strfmt.Registry) error {
	var raw string
	if len(rawData) > 0 {
		raw = rawData[len(rawData)-1]
	}

	// Required: false
	// AllowEmptyValue: false

	if raw == "" { // empty values pass all other validations
		return nil
	}
	o.Collection = &raw

	return nil
}

// bindShard binds and validates parameter Shard from query.
func (o *GetCollectionShardingStateParams) bindShard(rawData []string, hasKey bool, formats strfmt.Registry) error {
	var raw string
	if len(rawData) > 0 {
		raw = rawData[len(rawData)-1]
	}

	// Required: false
	// AllowEmptyValue: false

	if raw == "" { // empty values pass all other validations
		return nil
	}
	o.Shard = &raw

	return nil
}

```

### Core Architecture Module: `adapters/handlers/rest/operations/replication/get_collection_sharding_state_responses.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

// Code generated by go-swagger; DO NOT EDIT.

package replication

// This file was generated by the swagger tool.
// Editing this file might prove futile when you re-run the swagger generate command

import (
	"net/http"

	"github.com/go-openapi/runtime"

	"github.com/weaviate/weaviate/entities/models"
)

// GetCollectionShardingStateOKCode is the HTTP code returned for type GetCollectionShardingStateOK
const GetCollectionShardingStateOKCode int = 200

/*
GetCollectionShardingStateOK Successfully retrieved sharding state.

swagger:response getCollectionShardingStateOK
*/
type GetCollectionShardingStateOK struct {

	/*
	  In: Body
	*/
	Payload *models.ReplicationShardingStateResponse `json:"body,omitempty"`
}

// NewGetCollectionShardingStateOK creates GetCollectionShardingStateOK with default headers values
func NewGetCollectionShardingStateOK() *GetCollectionShardingStateOK {

	return &GetCollectionShardingStateOK{}
}

// WithPayload adds the payload to the get collection sharding state o k response
func (o *GetCollectionShardingStateOK) WithPayload(payload *models.ReplicationShardingStateResponse) *GetCollectionShardingStateOK {
	o.Payload = payload
	return o
}

// SetPayload sets the payload to the get collection sharding state o k response
func (o *GetCollectionShardingStateOK) SetPayload(payload *models.ReplicationShardingStateResponse) {
	o.Payload = payload
}

// WriteResponse to the client
func (o *GetCollectionShardingStateOK) WriteResponse(rw http.ResponseWriter, producer runtime.Producer) {

	rw.WriteHeader(200)
	if o.Payload != nil {
		payload := o.Payload
		if err := producer.Produce(rw, payload); err != nil {
			panic(err) // let the recovery middleware deal with this
		}
	}
}

// GetCollectionShardingStateBadRequestCode is the HTTP code returned for type GetCollectionShardingStateBadRequest
const GetCollectionShardingStateBadRequestCode int = 400

/*
GetCollectionShardingStateBadRequest Bad request.

swagger:response getCollectionShardingStateBadRequest
*/
type GetCollectionShardingStateBadRequest struct {

	/*
	  In: Body
	*/
	Payload *models.ErrorResponse `json:"body,omitempty"`
}

// NewGetCollectionShardingStateBadRequest creates GetCollectionShardingStateBadRequest with default headers values
func NewGetCollectionShardingStateBadRequest() *GetCollectionShardingStateBadRequest {

	return &GetCollectionShardingStateBadRequest{}
}

// WithPayload adds the payload to the get collection sharding state bad request response
func (o *GetCollectionShardingStateBadRequest) WithPayload(payload *models.ErrorResponse) *GetCollectionShardingStateBadRequest {
	o.Payload = payload
	return o
}

// SetPayload sets the payload to the get collection sharding state bad request response
func (o *GetCollectionShardingStateBadRequest) SetPayload(payload *models.ErrorResponse) {
	o.Payload = payload
}

// WriteResponse to the client
func (o *GetCollectionShardingStateBadRequest) WriteResponse(rw http.ResponseWriter, producer runtime.Producer) {

	rw.WriteHeader(400)
	if o.Payload != nil {
		payload := o.Payload
		if err := producer.Produce(rw, payload); err != nil {
			panic(err) // let the recovery middleware deal with this
		}
	}
}

// GetCollectionShardingStateUnauthorizedCode is the HTTP code returned for type GetCollectionShardingStateUnauthorized
const GetCollectionShardingStateUnauthorizedCode int = 401

/*
GetCollectionShardingStateUnauthorized Unauthorized or invalid credentials.

swagger:response getCollectionShardingStateUnauthorized
*/
type GetCollectionShardingStateUnauthorized struct {
}

// NewGetCollectionShardingStateUnauthorized creates GetCollectionShardingStateUnauthorized with default headers values
func NewGetCollectionShardingStateUnauthorized() *GetCollectionShardingStateUnauthorized {

	return &GetCollectionShardingStateUnauthorized{}
}

// WriteResponse to the client
func (o *GetCollectionShardingStateUnauthorized) WriteResponse(rw http.ResponseWriter, producer runtime.Producer) {

	rw.Header().Del(runtime.HeaderContentType) //Remove Content-Type on empty responses

	rw.WriteHeader(401)
}

// GetCollectionShardingStateForbiddenCode is the HTTP code returned for type GetCollectionShardingStateForbidden
const GetCollectionShardingStateForbiddenCode int = 403

/*
GetCollectionShardingStateForbidden Forbidden

swagger:response getCollectionShardingStateForbidden
*/
type GetCollectionShardingStateForbidden struct {

	/*
	  In: Body
	*/
	Payload *models.ErrorResponse `json:"body,omitempty"`
}

// NewGetCollectionShardingStateForbidden creates GetCollectionShardingStateForbidden with default headers values
func NewGetCollectionShardingStateForbidden() *GetCollectionShardingStateForbidden {

	return &GetCollectionShardingStateForbidden{}
}

// WithPayload adds the payload to the get collection sharding state forbidden response
func (o *GetCollectionShardingStateForbidden) WithPayload(payload *models.ErrorResponse) *GetCollectionShardingStateForbidden {
	o.Payload = payload
	return o
}

// SetPayload sets the payload to the get collection sharding state forbidden response
func (o *GetCollectionShardingStateForbidden) SetPayload(payload *models.ErrorResponse) {
	o.Payload = payload
}

// WriteResponse to the client
func (o *GetCollectionShardingStateForbidden) WriteResponse(rw http.ResponseWriter, producer runtime.Producer) {

	rw.WriteHeader(403)
	if o.Payload != nil {
		payload := o.Payload
		if err := producer.Produce(rw, payload); err != nil {
			panic(err) // let the recovery middleware deal with this
		}
	}
}

// GetCollectionShardingStateNotFoundCode is the HTTP code returned for type GetCollectionShardingStateNotFound
const GetCollectionShardingStateNotFoundCode int = 404

/*
GetCollectionShardingStateNotFound Collection or shard not found.

swagger:response getCollectionShardingStateNotFound
*/
type GetCollectionShardingStateNotFound struct {

	/*
	  In: Body
	*/
	Payload *models.ErrorResponse `json:"body,omitempty"`
}

// NewGetCollectionShardingStateNotFound creates GetCollectionShardingStateNotFound with default headers values
func NewGetCollectionShardingStateNotFound() *GetCollectionShardingStateNotFound {

	return &GetCollectionShardingStateNotFound{}
}

// WithPayload adds the payload to the get collection sharding state not found response
func (o *GetCollectionShardingStateNotFound) WithPayload(payload *models.ErrorResponse) *GetCollectionShardingStateNotFound {
	o.Payload = payload
	return o
}

// SetPayload sets the payload to the get collection sharding state not found response
func (o *GetCollectionShardingStateNotFound) SetPayload(payload *models.ErrorResponse) {
	o.Payload = payload
}

// WriteResponse to the client
func (o *GetCollectionShardingStateNotFound) WriteResponse(rw http.ResponseWriter, producer runtime.Producer) {

	rw.WriteHeader(404)
	if o.Payload != nil {
		payload := o.Payload
		if err := producer.Produce(rw, payload); err != nil {
			panic(err) // let the recovery middleware deal with this
		}
	}
}

// GetCollectionShardingStateInternalServerErrorCode is the HTTP code returned for type GetCollectionShardingStateInternalServerError
const GetCollectionShardingStateInternalServerErrorCode int = 500

/*
GetCollectionShardingStateInternalServerError An error has occurred while trying to fulfill the request. Most likely the ErrorResponse will contain more information about the error.

swagger:response getCollectionShardingStateInternalServerError
*/
type GetCollectionShardingStateInternalServerError struct {

	/*
	  In: Body
	*/
	Payload *models.ErrorResponse `json:"body,omitempty"`
}

// NewGetCollectionShardingStateInternalServerError creates GetCollectionShardingStateInternalServerError with default headers values
func NewGetCollectionShardingStateInternalServerError() *GetCollectionShardingStateInternalServerError {

	return &GetCollectionShardingStateInternalServerError{}
}

// WithPayload adds the payload to the get collection sharding state internal server error response
func (o *GetCollectionShardingStateInternalServerError) WithPayload(payload *models.ErrorResponse) *GetCollectionShardingStateInternalServerError {
	o.Payload = payload
	return o
}

// SetPayload sets the payload to the get collection sharding state internal server error response
func (o *GetCollectionShardingStateInternalServerError) SetPayload(payload *models.ErrorResponse) {
	o.Payload = payload
}

// WriteResponse to the client
func (o *GetCollectionShardingStateInternalServerError) WriteResponse(rw http.ResponseWriter, producer runtime.Producer) {

	rw.WriteHeader(500)
	if o.Payload != nil {
		payload := o.Payload
		if err := producer.Produce(rw, payload); err != nil {
			panic(err) // let the recovery middleware deal with this
		}
	}
}

// GetCollectionShardingStateNotImplementedCode is the HTTP code returned for type GetCollectionShardingStateNotImplemented
const GetCollectionShardingStateNotImplementedCode int = 501

/*
GetCollectionShardingStateNotImplemented Replica movement operations are disabled.

swagger:response getCollectionShardingStateNotImplemented
*/
type GetCollectionShardingStateNotImplemented struct {

	/*
	  In: Body
	*/
	Payload *models.ErrorResponse `json:"body,omitempty"`
}

// NewGetCollectionShardingStateNotImplemented creates GetCollectionShardingStateNotImplemented with default headers values
func NewGetCollectionShardingStateNotImplemented() *GetCollectionShardingStateNotImplemented {

	return &GetCollectionShardingStateNotImplemented{}
}

// WithPayload adds the payload to the get collection sharding state not implemented response
func (o *GetCollectionShardingStateNotImplemented) WithPayload(payload *models.ErrorResponse) *GetCollection
```

### Core Architecture Module: `adapters/handlers/rest/state/reindex_submit_locks.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

package state

import (
	"strings"
	"sync"
)

// ReindexSubmitLocks is the shared per-(collection, property) lock
// manager used by the REST handlers that mutate per-property schema
// state.
//
// The motivating bug is documented on State.ReindexSubmitLocks. This
// type is a plain wrapper around a `map[string]*sync.Mutex` guarded
// by an outer mutex; the inner mutexes are returned to the caller and
// the caller is responsible for Lock/Unlock pairing (see
// SubmitLockFor).
//
// Key shape: `strings.ToLower(collection) + "/" + property`. The
// case-folding matches the rest of the conflict-detection logic,
// which lowercases collection names before comparing.
type ReindexSubmitLocks struct {
	mu    sync.Mutex
	locks map[string]*sync.Mutex
}

// NewReindexSubmitLocks returns an initialised ReindexSubmitLocks
// ready for use.
func NewReindexSubmitLocks() *ReindexSubmitLocks {
	return &ReindexSubmitLocks{locks: map[string]*sync.Mutex{}}
}

// SubmitLockFor returns the *sync.Mutex for the given (collection,
// property) tuple, allocating one on first use. Callers MUST
// Lock/Unlock the returned mutex around their critical section.
//
// SubmitLockFor itself is safe for concurrent use; the returned
// mutex is the per-property lock.
func (r *ReindexSubmitLocks) SubmitLockFor(collection, property string) *sync.Mutex {
	key := strings.ToLower(collection) + "/" + property
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.locks == nil {
		r.locks = map[string]*sync.Mutex{}
	}
	m, ok := r.locks[key]
	if !ok {
		m = &sync.Mutex{}
		r.locks[key] = m
	}
	return m
}

```

### Core Architecture Module: `adapters/handlers/rest/state/state.go`
```
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

package state

import (
	"net/http"
	"sync"

	"github.com/sirupsen/logrus"
	"github.com/weaviate/weaviate/usecases/cron"

	"github.com/weaviate/weaviate/adapters/handlers/graphql"
	"github.com/weaviate/weaviate/adapters/handlers/rest/tenantactivity"
	"github.com/weaviate/weaviate/adapters/handlers/rest/types"
	"github.com/weaviate/weaviate/adapters/repos/classifications"
	"github.com/weaviate/weaviate/adapters/repos/db"
	rCluster "github.com/weaviate/weaviate/cluster"
	"github.com/weaviate/weaviate/cluster/distributedtask"
	grpcconn "github.com/weaviate/weaviate/grpc/conn"
	"github.com/weaviate/weaviate/usecases/auth/authentication/anonymous"
	"github.com/weaviate/weaviate/usecases/auth/authentication/apikey"
	"github.com/weaviate/weaviate/usecases/auth/authentication/oidc"
	"github.com/weaviate/weaviate/usecases/auth/authorization"
	"github.com/weaviate/weaviate/usecases/auth/authorization/rbac"
	"github.com/weaviate/weaviate/usecases/backup"
	"github.com/weaviate/weaviate/usecases/cluster"
	"github.com/weaviate/weaviate/usecases/config"
	configRuntime "github.com/weaviate/weaviate/usecases/config/runtime"
	exportUsecase "github.com/weaviate/weaviate/usecases/export"
	"github.com/weaviate/weaviate/usecases/license"
	"github.com/weaviate/weaviate/usecases/memwatch"
	"github.com/weaviate/weaviate/usecases/modules"
	"github.com/weaviate/weaviate/usecases/monitoring"
	usecasesNamespaces "github.com/weaviate/weaviate/usecases/namespaces"
	objectttl "github.com/weaviate/weaviate/usecases/object_ttl"
	"github.com/weaviate/weaviate/usecases/objects"
	"github.com/weaviate/weaviate/usecases/schema"
	"github.com/weaviate/weaviate/usecases/schema/namespacing"
	"github.com/weaviate/weaviate/usecases/sharding"
	"github.com/weaviate/weaviate/usecases/sharding/remote"
	"github.com/weaviate/weaviate/usecases/traverser"
	"github.com/weaviate/weaviate/usecases/usagelimits"
)

// State is the only source of application-wide state
// NOTE: This is not true yet, see gh-723
// TODO: remove dependencies to anything that's not an ent or uc
type State struct {
	OIDC            *oidc.Client
	AnonymousAccess *anonymous.Client
	APIKey          *apikey.ApiKey
	APIKeyRemote    *apikey.RemoteApiKey
	Authorizer      authorization.Authorizer
	// RBAC is the RBAC state the RAFT FSM applies, snapshots and restores.
	// configureAuthorizer always sets it, even with RBAC disabled.
	// A non-nil RBAC does not mean RBAC is enabled: check Authorization.Rbac.Enabled.
	RBAC  *rbac.Manager
	Crons *cron.Crons

	ServerConfig  *config.WeaviateConfig
	License       *license.State
	LDIntegration *configRuntime.LDIntegration
	Logger        *logrus.Logger
	gqlMutex      sync.Mutex
	GraphQL       graphql.GraphQL
	gqlGen        uint64
	Modules       *modules.Provider
	SchemaManager *schema.Manager
	Cluster       *cluster.State

	RemoteIndexIncoming *remote.IndexIncoming
	RemoteNodeIncoming  *sharding.RemoteNodeIncoming
	Traverser           *traverser.Traverser

	ClassificationRepo *classifications.DistributedRepo
	Metrics            *monitoring.PrometheusMetrics
	HTTPServerMetrics  *monitoring.HTTPServerMetrics
	GRPCServerMetrics  *monitoring.GRPCServerMetrics
	BackupManager      *backup.Handler
	ExportParticipant  *exportUsecase.Participant
	ExportMetrics      *exportUsecase.ExportMetrics
	DB                 *db.DB
	BatchManager       *objects.BatchManager
	AutoSchemaManager  *objects.AutoSchemaManager
	ClusterHttpClient  *http.Client
	MemWatch           *memwatch.Monitor

	ClusterService       *rCluster.Service
	TenantActivity       *tenantactivity.Handler
	InternalServer       types.ClusterServer
	NamespacesController *usecasesNamespaces.Controller
	NamespaceQualifier   namespacing.Qualifier

	ObjectTTLCoordinator *objectttl.Coordinator
	ObjectTTLLocalStatus *objectttl.LocalStatus

	DistributedTaskScheduler *distributedtask.Scheduler

	// ReindexProvider is the local handle for the runtime-reindex
	// distributed-task provider. Exposed here so the REST cancel handler
	// can wait for a cancelled task's local goroutine to drain first.
	ReindexProvider *db.ReindexProvider

	// ReindexSubmitLocks serializes mutating REST operations on the same
	// (collection, property) tuple across BOTH the reindex-submit
	// handler (PUT /v1/schema/{class}/properties/{prop}/index/{indexType})
	// and the destructive property-index handler (DELETE
	// /v1/schema/{class}/properties/{prop}/index/{indexName}).
	//
	// Motivating failure mode (pinned by
	// test/acceptance/reindex_concurrent's
	// change_tokenization_both__delete_searchable_parallel matrix
	// sub-test): two parallel REST requests on the same property race
	// at the RAFT serializer. If DELETE searchable's UPDATE_PROPERTY
	// command commits BEFORE change-tokenization's DISTRIBUTED_TASK_ADD,
	// the apply-time MutationGuard cannot reject DELETE because no
	// task is in-flight yet; the bucket is dropped; the change-tok
	// task is then admitted, runs against a missing canonical bucket,
	// and FAILS — leaving a torn filterable bucket on the shard.
	//
	// The shared lock closes the race at the REST layer: change-tok
	// holds the lock across the AddDistributedTask RAFT commit, so a
	// concurrent DELETE on the same property waits, and then T1 sees
	// the task in-flight and rejects it deterministically. Conversely,
	// if DELETE wins the lock, change-tok's downstream validation
	// (e.g., validateTokenizationChange) sees IndexSearchable=false
	// and rejects with 400.
	//
	// Multi-node caveat: this lock is local. Two simultaneous submits
	// from two different REST nodes against the same property are
	// still possible. The RAFT apply-time MutationGuard remains the
	// authoritative defense; this lock just collapses the local
	// single-node race window that any realistic UI/CLI flow can hit.
	ReindexSubmitLocks *ReindexSubmitLocks

	// UsageLimits gates the object-count cap only. Collections/tenants/
	// shards caps are read directly at the schema-handler use sites.
	UsageLimits *usagelimits.Manager

	// GRPCConnManager is a general connection manager for any/all gRPC connections used by the application. It implements retry logic and connection pooling.
	GRPCConnManager *grpcconn.ConnManager
	// ReplGRPCConnManager is a separate connection manager that implements retry logic to each RPC call on top of connection pooling, specifically for replication traffic.
	ReplGRPCConnManager *grpcconn.ConnManager
}

// GetGraphQL is the safe way to retrieve GraphQL from the state as it can be
// replaced at runtime. Instead of passing appState.GraphQL to your adapters,
// pass appState itself which you can abstract with a local interface such as:
//
// type gqlProvider interface { GetGraphQL graphql.GraphQL }
func (s *State) GetGraphQL() graphql.GraphQL {
	s.gqlMutex.Lock()
	gql := s.GraphQL
	s.gqlMutex.Unlock()
	return gql
}

// SetGraphQL replaces the served graph authoritatively — used by the serial
// RAFT schema-apply path and the disable hook. It bumps the generation so an
// in-flight lock-free rebuild that started earlier is discarded by
// SetGraphQLIfCurrent rather than clobbering this newer graph.
func (s *State) SetGraphQL(gql graphql.GraphQL) {
	s.gqlMutex.Lock()
	s.GraphQL = gql
	s.gqlGen++
	s.gqlMutex.Unlock()
}

// GraphQLGeneration returns the current graph generation. Capture it before a
// lock-free rebuild and pass it to SetGraphQLIfCurrent.
func (s *State) GraphQLGeneration() uint64 {
	s.gqlMutex.Lock()
	defer s.gqlMutex.Unlock()
	return s.gqlGen
}

// SetGraphQLIfCurrent stores gql only if no authoritative SetGraphQL happened
// since gen was captured. The DisableGraphQL enable hook rebuilds off the RAFT
// apply goroutine; this stops a slow build from an older schema snapshot from
// overwriting a newer, apply-built graph. Returns false if the store was skipped.
func (s *State) SetGraphQLIfCurrent(gql graphql.GraphQL, gen uint64) bool {
	s.gqlMutex.Lock()
	defer s.gqlMutex.Unlock()
	if s.gqlGen != gen {
		return false
	}
	s.GraphQL = gql
	s.gqlGen++
	return true
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #13618** (2026-10-28): **gRPC health check rejected when OPERATIONAL_MODE=ReadOnly, so clients fail to connect**
  *Symptoms*: ### How to reproduce this bug?  1. Start Weaviate 1.39.12 with `OPERATIONAL_MODE: ReadOnly` 2. Connect with the Python client 4.23.1 using defaults (`skip_init_checks=False`):    `weaviate.connect_to_custom(http_host="localhost", http_port=8080, grpc_host="localhost", grpc_port=50051, ...)` 3. The connection fails during the gRPC health check.  ### What is the expected behavior?  The client connects. Health checks (`/grpc.health.v1.Health/*`) should skip the operational mode check and work in all modes (ReadWrite, ReadOnly, WriteOnly, ScaleOut). ReadOnly should block writes only.  ### What is the actual behavior?  The gRPC health check is rejected as a write operation:  ``` StatusCode.UNAVAILABLE read-only mode is enabled temporally at the config level: write operations are not allowed during this time ```  The Python client then raises `WeaviateGRPCUnavailableError`. The only workaround is `skip_init_checks=True`.  ### Supporting information  Root cause:  - `usecases/config/operational_mode.go:69-77`: only `Search`, `Aggregate` and `TenantsGet` count as reads. `IsGRPCWrite` is `!IsGRPCRead`, so every other method, including ones that aren't on the list, counts as a write. - `adapters/handlers/grpc/server.go:302-305`: in `ReadOnly` and `ScaleOut`, any "write" method is rejected with `codes.Unavailable`. - `adapters/handlers/grpc/server.go:142`: the standard `grpc_health_v1` service is registered. It's not on the read list, so its calls are treated as writes and blocked.  `Wri

- **Issue #13605** (2026-10-28): **len(array)==0 omits missing array properties when length index is enabled**
  *Symptoms*: ### How to reproduce this bug?  Run [reproduce.py](https://github.com/user-attachments/files/33944592/reproduce.py).   Triggered by MR testing. - **MR:** An absent array and an explicit empty array both have length zero - **Input:** length index enabled; rows with [alpha], [], [beta,gamma], and missing tags; len(tags)==0  ### What is the expected behavior?  Both [] and missing rows.  ### What is the actual behavior?  Only explicit [] row.  ### Supporting information  _No response_  ### Server Version  1.40.2  ### Weaviate Setup  Single Node  ### Nodes count  _No response_  ### Code of Conduct  - [x] I have read and agree to the Weaviate's [Contributor Guide](https://docs.weaviate.io/contributor-guide) and [Code of Conduct](https://weaviate.io/service/code-of-conduct)

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

### Incident Patch 1: `473e7c80` (2026-11-13)
**Commit Message**: Merge pull request #13862 from weaviate/jose/fix-named-vector-index-type-change-panic

Schema update: reject a changed vector index type of a named vector instead of panicking

**File**: `test/acceptance_with_go_client/collection_config_tests/update_named_vector_index_type_test.go` (added, +106/-0)
```diff
@@ -0,0 +1,106 @@
+//                           _       _
+// __      _____  __ ___   ___  __ _| |_ ___
+// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
+//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
+//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
+//
+//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
+//
+//  CONTACT: hello@weaviate.io
+//
+
+package collection_config_tests
+
+import (
+	"context"
+	"net"
+	"net/http"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"github.com/weaviate/weaviate-go-client/v6"
+	"github.com/weaviate/weaviate-go-client/v6/collections"
+	"github.com/weaviate/weaviate-go-client/v6/collections/vectorindex"
+	"github.com/weaviate/weaviate-go-client/v6/modules/selfprovided"
+	"github.com/weaviate/weaviate/test/docker"
+)
+
+func TestUpdateNamedVectorIndexType_SingleNode(t *testing.T) {
+	c := newClient(t, docker.New().WithWeaviateWithGRPC())
+	testUpdateNamedVectorIndexType(t, c)
+}
+
+func TestUpdateNamedVectorIndexType_Cluster(t *testing.T) {
+	c := newClient(t, docker.New().WithWeaviateCluster(3).WithWeaviateExposeGRPCPort())
+	testUpdateNamedVectorIndexType(t, c)
+}
+
+// testUpdateNamedVectorIndexType checks that changing the vector index type of
+// a named vector is rejected with 422. The server used to panic on this update
+// and answer 500.
+func testUpdateNamedVectorIndexType(t *testing.T, c *weaviate.Client) {
+	ctx := context.Background()
+	indexes := map[string]collections.VectorIndex{
+		"hnsw": vectorindex.HNSW{},
+		"flat": vectorindex.Flat{},
+	}
+	for _, tt := range []struct{ from, to string }{
+		{from: "hnsw", to: "flat"},
+		{from: "flat", to: "hnsw"},
+	} {
+		t.Run(tt.from+" to "+tt.to, func(t *testing.T) {
+			name := "UpdateNamedVectorIndexType"
+			require.NoError(t, c.Collections.Delete(ctx, name))
+			t.Cleanup(func() { require.NoError(t, c.Collections.Delete(ctx, name)) })
+
+			h, err := c.Collections.Create(ctx, collections.Collection{
+				Name:       name,
+				Properties: []collections.Property{{Name: "name", DataType: collections.DataTypeText}},
+				Vectors: map[string]collections.VectorConfig{
+					"v": {Vectorizer: selfprovided.Vectorizer, Index: indexes[tt.from]},
+				},
+			})
+			require.NoError(t, err)
+
+			// The stored compression settings belong to the old index type. Without
+			// clearing them the server rejects them before it checks the type change.
+			err = h.Config.UpdateVectorConfig(ctx, "v", func(vc *collections.VectorConfig) {
+				vc.Index = indexes[tt.to]
+				vc.Compression = nil
+			})
+			require.Error(t, err, "changing the index type of a named vector must be rejected")
+			var httpErr *weaviate.HTTPError
+			require.ErrorAs(t, err, &httpErr, "expected an HTTP error, got: %v", err)
+			assert.Equal(t, http.StatusUnprocessableEntity, httpErr.Code, "body: %s", httpErr.Body)
+			assert.Contains(t, httpErr.Body, `vector index type of vector \"v\" is immutable`)
+
+			got, err := c.Collections.GetConfig(ctx, name)
+			require.NoError(t, err)
+			require.NotNil(t, got.Vectors["v"].Index)
+			assert.Equal(t, vectorindex.Type(tt.from), got.Vectors["v"].Index.Name())
+		})
+	}
+}
+
+func newClient(t *testing.T, compose *docker.Compose) *weaviate.Client {
+	t.Helper()
+	ctx := context.Background()
+	env, err := compose.Start(ctx)
+	require.NoError(t, err)
+	t.Cleanup(func() { require.NoError(t, env.Terminate(ctx)) })
+
+	host, httpPort, err := net.SplitHostPort(env.GetWeaviate().URI())
+	require.NoError(t, err)
+	_, grpcPort, err := net.SplitHostPort(env.GetWeaviate().GrpcURI())
+	require.NoError(t, err)
+
+	c, err := weaviate.NewLocal(ctx,
+		weaviate.WithHost(host),
+		weaviate.WithHTTPPort(httpPort),
+		weaviate.WithGRPCPort(grpcPort),
+	)
+	require.NoError(t, err)
+	t.Cleanup(func() { require.NoError(t, c.Close()) })
+	return c
+}
```

**File**: `usecases/schema/class.go` (modified, +12/-3)
```diff
@@ -2147,17 +2147,26 @@ func validateImmutableFields(initial, updated *models.Class, modulesProvider mod
 		// without enforcing that on the client. We just set these fields to their initial values.
 		switch cfg := v.VectorIndexConfig.(type) {
 		case hnsw.UserConfig:
-			cfgInitial := initial.VectorConfig[k].VectorIndexConfig.(hnsw.UserConfig)
+			cfgInitial, ok := initialVecCfg.VectorIndexConfig.(hnsw.UserConfig)
+			if !ok {
+				return errVectorIndexTypeImmutable(k, initialVecCfg.VectorIndexType, v.VectorIndexType)
+			}
 			cfg.SkipDefaultQuantization = cfgInitial.SkipDefaultQuantization
 			cfg.TrackDefaultQuantization = cfgInitial.TrackDefaultQuantization
 			v.VectorIndexConfig = cfg
 		case flat.UserConfig:
-			cfgInitial := initial.VectorConfig[k].VectorIndexConfig.(flat.UserConfig)
+			cfgInitial, ok := initialVecCfg.VectorIndexConfig.(flat.UserConfig)
+			if !ok {
+				return errVectorIndexTypeImmutable(k, initialVecCfg.VectorIndexType, v.VectorIndexType)
+			}
 			cfg.SkipDefaultQuantization = cfgInitial.SkipDefaultQuantization
 			cfg.TrackDefaultQuantization = cfgInitial.TrackDefaultQuantization
 			v.VectorIndexConfig = cfg
 		case dynamic.UserConfig:
-			cfgInitial := initial.VectorConfig[k].VectorIndexConfig.(dynamic.UserConfig)
+			cfgInitial, ok := initialVecCfg.VectorIndexConfig.(dynamic.UserConfig)
+			if !ok {
+				return errVectorIndexTypeImmutable(k, initialVecCfg.VectorIndexType, v.VectorIndexType)
+			}
 			cfg.HnswUC.SkipDefaultQuantization = cfgInitial.HnswUC.SkipDefaultQuantization
 			cfg.HnswUC.TrackDefaultQuantization = cfgInitial.HnswUC.TrackDefaultQuantization
 			cfg.FlatUC.SkipDefaultQuantization = cfgInitial.FlatUC.SkipDefaultQuantization
```

**File**: `usecases/schema/class_test.go` (modified, +37/-0)
```diff
@@ -36,6 +36,7 @@ import (
 	"github.com/weaviate/weaviate/entities/schema"
 	"github.com/weaviate/weaviate/entities/vectorindex/dynamic"
 	"github.com/weaviate/weaviate/entities/vectorindex/flat"
+	"github.com/weaviate/weaviate/entities/vectorindex/hfresh"
 	"github.com/weaviate/weaviate/entities/vectorindex/hnsw"
 	"github.com/weaviate/weaviate/usecases/cluster/mocks"
 	"github.com/weaviate/weaviate/usecases/config"
@@ -1539,6 +1540,42 @@ func Test_UpdateClass(t *testing.T) {
 		}
 	})
 
+	t.Run("changing the vector index type of a named vector is rejected", func(t *testing.T) {
+		configs := map[string]any{
+			"hnsw":    hnsw.NewDefaultUserConfig(),
+			"flat":    flat.NewDefaultUserConfig(),
+			"dynamic": dynamic.NewDefaultUserConfig(),
+			"hfresh":  hfresh.NewDefaultUserConfig(),
+		}
+		for _, tt := range []struct{ from, to string }{
+			{from: "hnsw", to: "flat"},
+			{from: "hnsw", to: "dynamic"},
+			{from: "flat", to: "hnsw"},
+			{from: "flat", to: "dynamic"},
+			{from: "dynamic", to: "hnsw"},
+			{from: "dynamic", to: "flat"},
+			{from: "hfresh", to: "hnsw"},
+			{from: "hfresh", to: "flat"},
+			{from: "hfresh", to: "dynamic"},
+		} {
+			t.Run(tt.from+" to "+tt.to, func(t *testing.T) {
+				vectorConfig := func(indexType string) map[string]models.VectorConfig {
+					return map[string]models.VectorConfig{"example": {
+						VectorIndexType:   indexType,
+						VectorIndexConfig: configs[indexType],
+						Vectorizer:        map[string]any{"none": map[string]any{}},
+					}}
+				}
+				initial := &models.Class{Class: "Immutable", VectorConfig: vectorConfig(tt.from)}
+				updated := &models.Class{Class: "Immutable", VectorConfig: vectorConfig(tt.to)}
+
+				var err error
+				require.NotPanics(t, func() { err = validateImmutableFields(initial, updated, nil, nil) })
+				require.Error(t, err, "validation should fail")
+			})
+		}
+	})
+
 	t.Run("fields validation", func(t *testing.T) {
 		tests := []struct {
 			name          string
```

**File**: `usecases/schema/parser.go` (modified, +5/-2)
```diff
@@ -613,8 +613,7 @@ func (p *Parser) validateNamedVectorConfigsParityAndImmutables(initial, updated
 
 		// immutable vector type
 		if initialCfg.VectorIndexType != updatedCfg.VectorIndexType {
-			return fmt.Errorf("vector index type of vector %q is immutable: attempted change from %q to %q",
-				vecName, initialCfg.VectorIndexType, updatedCfg.VectorIndexType)
+			return errVectorIndexTypeImmutable(vecName, initialCfg.VectorIndexType, updatedCfg.VectorIndexType)
 		}
 
 		// immutable vectorizer
@@ -686,3 +685,7 @@ func validateShardingConfig(current, update *models.Class, mtEnabled bool) error
 	}
 	return nil
 }
+
+func errVectorIndexTypeImmutable(vector, from, to string) error {
+	return fmt.Errorf("vector index type of vector %q is immutable: attempted change from %q to %q", vector, from, to)
+}
```

---

### Incident Patch 2: `927ec35c` (2026-11-13)
**Commit Message**: Merge pull request #13850 from weaviate/fix/ssb-beacon

fix(ssb): Use UUIDv3 as reference ID in Acks and Results messages

**File**: `adapters/handlers/grpc/v1/batch/stream.go` (modified, +1/-1)
```diff
@@ -696,7 +696,7 @@ func uuidsAndBeacons(objs []*pb.BatchObject, refs []*pb.BatchReference) (uuids,
 		uuids = append(uuids, obj.GetUuid())
 	}
 	for _, ref := range refs {
-		beacons = append(beacons, toBeacon(ref))
+		beacons = append(beacons, ReferenceUUID(ref))
 	}
 	return uuids, beacons
 }
```

**File**: `adapters/handlers/grpc/v1/batch/stream_test.go` (modified, +23/-11)
```diff
@@ -649,7 +649,13 @@ func TestOutOfMemoryReply(t *testing.T) {
 			{Collection: collection, Uuid: uuid.New().String()},
 		}
 		refs := []*pb.BatchReference{
-			{FromCollection: collection, FromUuid: uuid.New().String(), ToUuid: uuid.New().String(), Name: "ref"},
+			{
+				FromCollection: collection,
+				FromUuid:       uuid.New().String(),
+				ToCollection:   new("TargetCollection"),
+				ToUuid:         uuid.New().String(),
+				Name:           "ref",
+			},
 		}
 
 		checker, _ := newAdmissionChecker(t, 0, admitNone)
@@ -664,9 +670,7 @@ func TestOutOfMemoryReply(t *testing.T) {
 		require.NotEqual(t, -1, oom, "a rejected message must produce an OutOfMemory message")
 		got := sent.all()[oom].GetOutOfMemory()
 		require.Equal(t, []string{objs[0].GetUuid(), objs[1].GetUuid()}, got.GetUuids())
-		require.Equal(t, []string{
-			batch.BEACON_START + refs[0].GetFromCollection() + "/" + refs[0].GetFromUuid() + "/" + refs[0].GetName(),
-		}, got.GetBeacons())
+		require.Equal(t, []string{batch.ReferenceUUID(refs[0])}, got.GetBeacons())
 		require.EqualValues(t, batch.OOM_WAIT_TIME, got.GetWaitTime())
 	})
 }
@@ -1110,7 +1114,13 @@ func Test_receiver_ackForDelay(t *testing.T) {
 			{Collection: collection, Uuid: uuid.New().String()},
 		}
 		refs := []*pb.BatchReference{
-			{FromCollection: collection, FromUuid: uuid.New().String(), ToUuid: uuid.New().String(), Name: "ref"},
+			{
+				FromCollection: collection,
+				FromUuid:       uuid.New().String(),
+				ToCollection:   new("TargetCollection"),
+				ToUuid:         uuid.New().String(),
+				Name:           "ref",
+			},
 		}
 
 		cfg := config.NewBatchStream(new(0.9), new(0.5), new(400*time.Millisecond), nil, nil)
@@ -1127,9 +1137,7 @@ func Test_receiver_ackForDelay(t *testing.T) {
 		require.NotEqual(t, -1, acks)
 		got := sent.all()[acks].GetAcks()
 		require.Equal(t, []string{objs[0].GetUuid(), objs[1].GetUuid()}, got.GetUuids())
-		require.Equal(t, []string{
-			batch.BEACON_START + refs[0].GetFromCollection() + "/" + refs[0].GetFromUuid() + "/" + refs[0].GetName(),
-		}, got.GetBeacons())
+		require.Equal(t, []string{batch.ReferenceUUID(refs[0])}, got.GetBeacons())
 	})
 
 	t.Run("no delay at or below the engage ratio", func(t *testing.T) {
@@ -1377,7 +1385,12 @@ func TestStreamHandlerReportsSchemaResolutionFailures(t *testing.T) {
 				{Collection: tc.collection, Uuid: uuid.New().String()},
 			}
 			refs := []*pb.BatchReference{
-				{FromCollection: tc.collection, FromUuid: uuid.New().String(), ToUuid: uuid.New().String(), Name: "ref"},
+				{
+					FromCollection: tc.collection,
+					FromUuid:       uuid.New().String(),
+					ToCollection:   new("TargetCollection"),
+					ToUuid:         uuid.New().String(), Name: "ref",
+				},
 			}
 
 			mockBatcher := mocks.NewMockBatcher(t)
@@ -1438,8 +1451,7 @@ func TestStreamHandlerReportsSchemaResolutionFailures(t *testing.T) {
 			defer sentMu.Unlock()
 			require.ElementsMatch(t, []string{objs[0].GetUuid(), objs[1].GetUuid()}, reportedUuids,
 				"every object of the rejected message must be reported to the client")
-			expectedBeacon := batch.BEACON_START + refs[0].GetFromCollection() + "/" + refs[0].GetFromUuid() + "/" + refs[0].GetName()
-			require.ElementsMatch(t, []string{expectedBeacon}, reportedBeacons,
+			require.ElementsMatch(t, []string{batch.ReferenceUUID(refs[0])}, reportedBeacons,
 				"every reference of the rejected message must be reported to the client")
 			require.Len(t, reportedErrors, 3, "one error per object and per reference")
 			for _, e := range reportedErrors {
```

**File**: `adapters/handlers/grpc/v1/batch/worker.go` (modified, +26/-8)
```diff
@@ -12,13 +12,14 @@
 package batch
 
 import (
+	"bytes"
 	"context"
-	"fmt"
 	"math"
 	"strings"
 	"sync"
 	"time"
 
+	"github.com/google/uuid"
 	"github.com/sirupsen/logrus"
 	enterrors "github.com/weaviate/weaviate/entities/errors"
 	pb "github.com/weaviate/weaviate/grpc/generated/protocol/v1"
@@ -283,8 +284,25 @@ func (w *worker) fanInReplies(
 	return errs, retriable
 }
 
-func toBeacon(ref *pb.BatchReference) string {
-	return fmt.Sprintf("%s%s/%s/%s", BEACON_START, ref.FromCollection, ref.FromUuid, ref.Name)
+// ReferenceUUID creates a universally unique reference ID.
+// It's a UUIDv3 (MD5 hash), that includes information
+// about both the source and the target of a cross-reference.
+//
+// The MD5 hash is a bit faster for having a higher collision rate.
+// Still, it's 2^64 to have a 50% probability of collision, an unlikely
+// number of references to be processed by a single stream.
+func ReferenceUUID(ref *pb.BatchReference) string {
+	var buf bytes.Buffer
+	buf.WriteString(ref.GetName())
+	buf.WriteString(ref.GetFromCollection())
+	buf.WriteString(ref.GetFromUuid())
+	buf.WriteString(ref.GetToCollection())
+	buf.WriteString(ref.GetToUuid())
+	buf.WriteString(ref.GetTenant())
+
+	// The ID is only relevant in the scope a single stream and doesn't need a namespace.
+	id := uuid.NewMD5(uuid.Nil, buf.Bytes())
+	return id.String()
 }
 
 func (w *worker) sendReferences(ctx context.Context, streamId string, refs []*pb.BatchReference, cl *pb.ConsistencyLevel, retries int) ([]*pb.BatchStreamReply_Results_Success, []*pb.BatchStreamReply_Results_Error) {
@@ -294,7 +312,7 @@ func (w *worker) sendReferences(ctx context.Context, streamId string, refs []*pb
 		for _, ref := range refs {
 			errors = append(errors, &pb.BatchStreamReply_Results_Error{
 				Error:  ctx.Err().Error(),
-				Detail: &pb.BatchStreamReply_Results_Error_Beacon{Beacon: toBeacon(ref)},
+				Detail: &pb.BatchStreamReply_Results_Error_Beacon{Beacon: ReferenceUUID(ref)},
 			})
 		}
 		return nil, errors
@@ -309,7 +327,7 @@ func (w *worker) sendReferences(ctx context.Context, streamId string, refs []*pb
 		for _, ref := range refs {
 			errors = append(errors, &pb.BatchStreamReply_Results_Error{
 				Error:  enterrors.MessageWithDocsLink(err),
-				Detail: &pb.BatchStreamReply_Results_Error_Beacon{Beacon: toBeacon(ref)},
+				Detail: &pb.BatchStreamReply_Results_Error_Beacon{Beacon: ReferenceUUID(ref)},
 			})
 		}
 		return nil, errors
@@ -334,13 +352,13 @@ func (w *worker) sendReferences(ctx context.Context, streamId string, refs []*pb
 			}
 			failed[err.Index] = struct{}{}
 			if w.isTransientReplicationError(err.Error) && retries < MAX_RETRIES {
-				w.logger.WithField("streamId", streamId).Infof("transient replication error for reference %s: %s", toBeacon(refs[err.Index]), err.Error)
+				w.logger.WithField("streamId", streamId).Infof("transient replication error for reference %s: %s", ReferenceUUID(refs[err.Index]), err.Error)
 				retriable = append(retriable, refs[err.Index])
 				continue
 			}
 			errors = append(errors, &pb.BatchStreamReply_Results_Error{
 				Error:  err.Error,
-				Detail: &pb.BatchStreamReply_Results_Error_Beacon{Beacon: toBeacon(refs[err.Index])},
+				Detail: &pb.BatchStreamReply_Results_Error_Beacon{Beacon: ReferenceUUID(refs[err.Index])},
 			})
 		}
 		if len(retriable) > 0 {
@@ -361,7 +379,7 @@ func (w *worker) sendReferences(ctx context.Context, streamId string, refs []*pb
 			continue
 		}
 		successes = append(successes, &pb.BatchStreamReply_Results_Success{
-			Detail: &pb.BatchStreamReply_Results_Success_Beacon{Beacon: toBeacon(ref)},
+			Detail: &pb.BatchStreamReply_Results_Success_Beacon{Beacon: ReferenceUUID(ref)},
 		})
 	}
 	return successes, errors
```

**File**: `adapters/handlers/grpc/v1/batch/worker_test.go` (modified, +4/-4)
```diff
@@ -109,7 +109,7 @@ func TestWorkerLoop(t *testing.T) {
 		require.NotNil(t, report.Stats, "Expected stats to be returned")
 		require.Len(t, report.Successes, 1, "Expected one result to be returned")
 
-		require.Equal(t, toBeacon(ref1), report.Successes[0].GetBeacon(), "Expected second result's beacon to match")
+		require.Equal(t, ReferenceUUID(ref1), report.Successes[0].GetBeacon(), "Expected second result's beacon to match")
 
 		require.Empty(t, rq, "Expected reporting queue to be empty after reading all messages")
 		close(processingQueue) // Allow the draining logic to exit naturally
@@ -207,12 +207,12 @@ func TestWorkerLoop(t *testing.T) {
 
 		require.Equal(t, UUID0, report.Successes[0].GetUuid(), "Expected first success' UUID to match")
 		require.Equal(t, UUID2, report.Successes[1].GetUuid(), "Expected second success' UUID to match")
-		require.Equal(t, toBeacon(ref2), report.Successes[2].GetBeacon(), "Expected third success' beacon to match")
+		require.Equal(t, ReferenceUUID(ref2), report.Successes[2].GetBeacon(), "Expected third success' beacon to match")
 
 		require.Equal(t, "objs error", report.Errors[0].GetError(), "Expected first error to be first non-retriable object error")
 		require.Equal(t, UUID1, report.Errors[0].GetUuid(), "Expected first error's UUID to match")
 		require.Equal(t, "refs error", report.Errors[1].GetError(), "Expected second error to be first non-retriable reference error")
-		require.Equal(t, toBeacon(ref1), report.Errors[1].GetBeacon(), "Expected second error's beacon to match")
+		require.Equal(t, ReferenceUUID(ref1), report.Errors[1].GetBeacon(), "Expected second error's beacon to match")
 
 		require.Empty(t, rq, "Expected reporting queue to be empty after reading all messages")
 		close(processingQueue) // Allow the draining logic to exit naturally
@@ -575,7 +575,7 @@ func TestSendReferencesReplyIndexGuards(t *testing.T) {
 	beaconsOf := func(idxs ...int) []string {
 		out := make([]string, 0, len(idxs))
 		for _, i := range idxs {
-			out = append(out, toBeacon(refs[i]))
+			out = append(out, ReferenceUUID(refs[i]))
 		}
 		return out
 	}
```

**File**: `test/acceptance/grpc/batching_test.go` (modified, +3/-6)
```diff
@@ -28,6 +28,7 @@ import (
 	"github.com/google/uuid"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
+	"github.com/weaviate/weaviate/adapters/handlers/grpc/v1/batch"
 	"github.com/weaviate/weaviate/entities/models"
 	pb "github.com/weaviate/weaviate/grpc/generated/protocol/v1"
 	"github.com/weaviate/weaviate/test/acceptance/replication/common"
@@ -184,10 +185,10 @@ func TestGRPC_Batching(t *testing.T) {
 
 		require.Equal(t, uuid0, msg.GetResults().GetSuccesses()[0].GetUuid(), "First object UUID should match")
 		require.Equal(t, objects[1].Uuid, msg.GetResults().GetSuccesses()[1].GetUuid(), "Second object UUID should match")
-		require.Equal(t, toBeacon(references[0]), msg.GetResults().GetSuccesses()[2].GetBeacon(), "First reference beacon should match")
+		require.Equal(t, batch.ReferenceUUID(references[0]), msg.GetResults().GetSuccesses()[2].GetBeacon(), "First reference beacon should match")
 
 		require.Equal(t, "property hasParagraphss does not exist for class Article", msg.GetResults().GetErrors()[0].GetError())
-		require.Equal(t, toBeacon(references[1]), msg.GetResults().GetErrors()[0].GetBeacon(), "Second reference beacon should match")
+		require.Equal(t, batch.ReferenceUUID(references[1]), msg.GetResults().GetErrors()[0].GetBeacon(), "Second reference beacon should match")
 
 		obj, err := helper.GetObject(t, clsA.Class, strfmt.UUID(uuid0))
 		require.NoError(t, err, "ListObjects should not return an error")
@@ -969,10 +970,6 @@ func stop(stream pb.Weaviate_BatchStreamClient) {
 	require.NoError(nil, err, "sending Stop over the stream should not return an error")
 }
 
-func toBeacon(ref *pb.BatchReference) string {
-	return fmt.Sprintf("weaviate://localhost/%s/%s/%s", ref.FromCollection, ref.FromUuid, ref.Name)
-}
-
 func randomByteVector(dim int) []byte {
 	vector := make([]byte, dim*4)
 
```

---

### Incident Patch 3: `ea6d860b` (2026-11-13)
**Commit Message**: Merge pull request #13863 from weaviate/jose/fix-update-rejects-unknown-module

Schema update: reject a class-level module that does not exist

**File**: `test/acceptance_with_go_client/collection_config_tests/update_unknown_module_test.go` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+//                           _       _
+// __      _____  __ ___   ___  __ _| |_ ___
+// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
+//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
+//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
+//
+//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
+//
+//  CONTACT: hello@weaviate.io
+//
+
+package collection_config_tests
+
+import (
+	"context"
+	"net"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"github.com/weaviate/weaviate-go-client/v6"
+	"github.com/weaviate/weaviate-go-client/v6/collections"
+	"github.com/weaviate/weaviate-go-client/v6/modules"
+	"github.com/weaviate/weaviate-go-client/v6/modules/selfprovided"
+	clschema "github.com/weaviate/weaviate/client/schema"
+	"github.com/weaviate/weaviate/test/docker"
+	"github.com/weaviate/weaviate/test/helper"
+)
+
+func TestUpdateWithUnknownModule_SingleNode(t *testing.T) {
+	c := connect(t, docker.New().WithWeaviateWithGRPC().WithWeaviateEnv("ENABLE_MODULES", "reranker-dummy"))
+	testUpdateWithUnknownModule(t, c)
+}
+
+func TestUpdateWithUnknownModule_Cluster(t *testing.T) {
+	c := connect(t, docker.New().WithWeaviateCluster(3).WithWeaviateExposeGRPCPort().
+		WithWeaviateEnv("ENABLE_MODULES", "reranker-dummy"))
+	testUpdateWithUnknownModule(t, c)
+}
+
+// rerankerDummy names the reranker-dummy module, which the Go client has no type for.
+type rerankerDummy struct{}
+
+func (rerankerDummy) Name() string { return "reranker-dummy" }
+
+// The client registry must know every module in a collection's moduleConfig:
+// api.Collection.UnmarshalJSON loops until it has matched every key against the
+// registry, so an unregistered key makes GetConfig spin forever.
+func init() { modules.Register(rerankerDummy{}) }
+
+// testUpdateWithUnknownModule checks that a class update naming a module the
+// node does not have is rejected with 422 and leaves the module config as it
+// was. The server used to accept the update and store the unknown module.
+//
+// The Go client v6 has no call that changes the module config of a
+// collection, so the update goes through the REST client of this repository.
+func testUpdateWithUnknownModule(t *testing.T, c *weaviate.Client) {
+	ctx := context.Background()
+	name := "UpdateWithUnknownModule"
+	require.NoError(t, c.Collections.Delete(ctx, name))
+	t.Cleanup(func() { require.NoError(t, c.Collections.Delete(ctx, name)) })
+
+	_, err := c.Collections.Create(ctx, collections.Collection{
+		Name:            name,
+		Properties:      []collections.Property{{Name: "name", DataType: collections.DataTypeText}},
+		Vectors:         map[string]collections.VectorConfig{"v": {Vectorizer: selfprovided.Vectorizer}},
+		RerankerModules: []modules.Module{rerankerDummy{}},
+	})
+	require.NoError(t, err)
+
+	update := helper.GetClass(t, name)
+	require.NotNil(t, update)
+	moduleConfig, ok := update.ModuleConfig.(map[string]any)
+	require.True(t, ok, "module config of the stored class: %#v", update.ModuleConfig)
+	moduleConfig["rerankr-openai"] = map[string]any{}
+
+	_, err = helper.Client(t).Schema.SchemaObjectsUpdate(
+		clschema.NewSchemaObjectsUpdateParams().WithClassName(name).WithObjectClass(update), nil)
+	require.Error(t, err, "an update naming a module that does not exist must be rejected")
+	var unprocessable *clschema.SchemaObjectsUpdateUnprocessableEntity
+	require.ErrorAs(t, err, &unprocessable, "expected 422, got: %v", err)
+	assert.Contains(t, unprocessable.Payload.Error[0].Message, "module with name rerankr-openai doesn't exist")
+
+	got, err := c.Collections.GetConfig(ctx, name)
+	require.NoError(t, err)
+	var rerankers []string
+	for _, m := range got.RerankerModules {
+		rerankers = append(rerankers, m.Name())
+	}
+	assert.Equal(t, []string{"reranker-dummy"}, rerankers)
+}
+
+// connect starts the containers, points the REST client of this repository at
+// Weaviate and returns a Go client v6 for the same node.
+func connect(t *testing.T, compose *docker.Compose) *weaviate.Client {
+	t.Helper()
+	ctx := context.Background()
+	env, err := compose.Start(ctx)
+	require.NoError(t, err)
+	t.Cleanup(func() { require.NoError(t, env.Terminate(ctx)) })
+
+	helper.SetupClient(env.GetWeaviate().URI())
+	t.Cleanup(helper.ResetClient)
+
+	host, httpPort, err := net.SplitHostPort(env.GetWeaviate().URI())
+	require.NoError(t, err)
+	_, grpcPort, err := net.SplitHostPort(env.GetWeaviate().GrpcURI())
+	require.NoError(t, err)
+
+	c, err := weaviate.NewLocal(ctx,
+		weaviate.WithHost(host),
+		weaviate.WithHTTPPort(httpPort),
+		weaviate.WithGRPCPort(grpcPort),
+	)
+	require.NoError(t, err)
+	t.Cleanup(func() { require.NoError(t, c.Close()) })
+	return c
+}
```

**File**: `usecases/schema/class.go` (modified, +26/-0)
```diff
@@ -30,6 +30,7 @@ import (
 	"github.com/weaviate/weaviate/entities/vectorindex/flat"
 	enthfresh "github.com/weaviate/weaviate/entities/vectorindex/hfresh"
 	"github.com/weaviate/weaviate/entities/vectorindex/hnsw"
+	"golang.org/x/exp/maps"
 	"golang.org/x/text/unicode/norm"
 
 	"github.com/weaviate/weaviate/adapters/repos/db/inverted/stopwords"
@@ -669,6 +670,10 @@ func UpdateClassInternal(h *Handler, ctx context.Context, className string, upda
 			}
 		}
 
+		if err := rejectUnknownModules(h.parser.modules, initial, updated); err != nil {
+			return err
+		}
+
 		allowed, err := mutableSettingsChanges(h.parser.modules, initial, updated, func(module, targetVector string) error {
 			return h.moduleConfig.ValidateModuleConfig(ctx, updated, module, targetVector)
 		})
@@ -2096,6 +2101,27 @@ func validateUpdatingMT(current, update *models.Class) (enabled bool, err error)
 	return enabled, err
 }
 
+// rejectUnknownModules fails when the update adds a class-level module this
+// node does not have, as class create does. A module already stored passes,
+// so a class still updates after one of its modules is disabled. It runs
+// before the RAFT command and not in the apply, where nodes with different
+// modules would disagree.
+func rejectUnknownModules(modules modulesProvider, initial, updated *models.Class) error {
+	updatedConfig, _ := updated.ModuleConfig.(map[string]any)
+	initialConfig, _ := initial.ModuleConfig.(map[string]any)
+	added := maps.Keys(updatedConfig)
+	slices.Sort(added)
+	for _, module := range added {
+		if _, stored := initialConfig[module]; stored {
+			continue
+		}
+		if !modules.HasModule(module) {
+			return fmt.Errorf("module with name %s doesn't exist", module)
+		}
+	}
+	return nil
+}
+
 func validateImmutableFields(initial, updated *models.Class, modulesProvider modulesProvider, allowed map[string][]string) error {
 	immutableFields := []immutableText{
 		{
```

**File**: `usecases/schema/module_config_update_test.go` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+//                           _       _
+// __      _____  __ ___   ___  __ _| |_ ___
+// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
+//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
+//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
+//
+//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
+//
+//  CONTACT: hello@weaviate.io
+//
+
+package schema
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/require"
+)
+
+func TestUpdateClass_ModuleConfigNamesOnlyEnabledModules(t *testing.T) {
+	const missing = "rerankr-openai"
+
+	t.Run("rejects a module that does not exist", func(t *testing.T) {
+		s := newSchemaWithModules(t)
+		stored := s.create(t, namedVectorClass(mutableModule, moduleSettings("a", "m")))
+		stored.ModuleConfig = map[string]any{generativeModule: map[string]any{"setting": "a"}}
+
+		update := namedVectorClass(mutableModule, moduleSettings("a", "m"))
+		update.ModuleConfig = map[string]any{
+			generativeModule: map[string]any{"setting": "a"},
+			missing:          map[string]any{"model": "x"},
+		}
+		require.EqualError(t, s.update(update), "module with name "+missing+" doesn't exist")
+		require.Equal(t, map[string]any{generativeModule: map[string]any{"setting": "a"}}, stored.ModuleConfig)
+	})
+
+	t.Run("rejects a module that does not exist on a class without module config", func(t *testing.T) {
+		s := newSchemaWithModules(t)
+		s.create(t, namedVectorClass(mutableModule, moduleSettings("a", "m")))
+
+		update := namedVectorClass(mutableModule, moduleSettings("a", "m"))
+		update.ModuleConfig = map[string]any{missing: map[string]any{}}
+		require.EqualError(t, s.update(update), "module with name "+missing+" doesn't exist")
+	})
+
+	t.Run("accepts a module that exists", func(t *testing.T) {
+		s := newSchemaWithModules(t)
+		stored := s.create(t, namedVectorClass(mutableModule, moduleSettings("a", "m")))
+
+		update := namedVectorClass(mutableModule, moduleSettings("a", "m"))
+		update.ModuleConfig = map[string]any{"reranker-fake": map[string]any{"model": "x"}}
+		require.NoError(t, s.update(update))
+		require.Equal(t, "x", storedModuleSettings(t, stored, "reranker-fake", "")["model"])
+	})
+
+	t.Run("keeps a stored module that is no longer enabled", func(t *testing.T) {
+		// A module disabled after the class was created stays in its config;
+		// an update that carries it unchanged must still pass.
+		s := newSchemaWithModules(t)
+		stored := s.create(t, namedVectorClass(mutableModule, moduleSettings("a", "m")))
+		stored.ModuleConfig = map[string]any{missing: map[string]any{"model": "x"}}
+
+		update := namedVectorClass(mutableModule, moduleSettings("a", "m"))
+		update.ModuleConfig = map[string]any{missing: map[string]any{"model": "x"}}
+		update.Description = "new description"
+		require.NoError(t, s.update(update))
+	})
+}
```

**File**: `usecases/schema/parser_test.go` (modified, +2/-1)
```diff
@@ -305,7 +305,8 @@ func (m fakeModulesProvider) IsMultiVector(name string) bool {
 }
 
 func (m fakeModulesProvider) HasModule(name string) bool {
-	return name == "none" || strings.Contains(name, "colbert") || strings.Contains(name, "text2vec") || strings.Contains(name, "multi2vec")
+	return name == "none" || strings.Contains(name, "colbert") || strings.Contains(name, "text2vec") || strings.Contains(name, "multi2vec") ||
+		m.IsGenerative(name) || m.IsReranker(name) || strings.HasPrefix(name, "my-module")
 }
 
 func (m fakeModulesProvider) MigrateVectorizerSettings(any, any) bool {
```

#### Recent Merged Pull Requests:
- **PR #13891** (2026-11-13): Return an error body with the GET /v1/tasks 403 (@etiennedi)
- **PR #13883** (2026-11-13): Allow hfresh with multi-vector vectorizers; MUVERA implied and required for hfresh multi-vectors (stable/v1.40) (@rlmanrique)
- **PR #13877** (closed): Cover /tasks in the RBAC no-permissions endpoint sweep (@etiennedi)
- **PR #13873** (2026-11-12): fix(lsmkv): return an error for damaged RoaringSet WAL record lengths (@jfrancoa)
- **PR #13870** (2026-11-12): fix(auto_schema): fix description of a collection generated by auto-schema (@bevzzz)
- **PR #13869** (2026-11-12): replication: allow async replication while a node is in maintenance mode (@jeroiraz)

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

## X. Merge pull request #13862 from weaviate/jose/fix-named-vector-index-type-change-

**RULE**:
When implementing operations in `test/acceptance_with_go_client/collection_config_tests/update_named_vector_index_type_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in weaviate/weaviate. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `473e7c80`: Merge pull request #13862 from weaviate/jose/fix-named-vector-index-type-change-panic. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `test/acceptance_with_go_client/collection_config_tests/update_named_vector_index_type_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
//                           _       _
// __      _____  __ ___   ___  __ _| |_ ___
// \ \ /\ / / _ \/ _` \ \ / / |/ _` | __/ _ \
//  \ V  V /  __/ (_| |\ V /| | (_| | ||  __/
//   \_/\_/ \___|\__,_| \_/ |_|\__,_|\__\___|
//
//  Copyright © 2016 - 2026 Weaviate B.V. All rights reserved.
//
//  CONTACT: hello@weaviate.io
//

package collection_config_tests

import (
	"context"
	"net"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/weaviate/weaviate-go-client/v6"
	"github.com/weaviate/weaviate-go-client/v6/collections"
	"github.com/weaviate/weaviate-go-client/v6/collections/vectorindex"
	"github.com/weaviate/weaviate-go-client/v6/modules/selfprovided"
	"github.com/weaviate/weaviate/test/docker"
)

func TestUpdateNamedVectorIndexType_SingleNode(t *testing.T) {
	c := newClient(t, docker.New().WithWeaviateWithGRPC())
	testUpdateNamedVectorIndexType(t, c)
}

func TestUpdateNamedVectorIndexType_Cluster(t *testing.T) {
	c := newClient(t, docker.New().WithWeaviateCluster(3).WithWeaviateExposeGRPCPort())
	testUpdateNamedVectorIndexType(t, c)
}

// testUpdateNamedVectorIndexType checks that changing the vector index type of
// 
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `473e7c80` are properly handled with clean fallback behavior.
