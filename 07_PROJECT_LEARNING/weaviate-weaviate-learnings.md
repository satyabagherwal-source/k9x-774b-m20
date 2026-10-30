> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/weaviate-weaviate-learnings.md`  
> **Source**: github ([https://github.com/weaviate/weaviate](https://github.com/weaviate/weaviate))  
> **Source Version**: `0a6bfa1a`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T13:46:31.802Z  
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
> **Harvest Timestamp**: 2026-10-30T13:46:30.631Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `weaviate/weaviate`
- **Description**: Weaviate is an open-source vector database that stores both objects and vectors, allowing for the combination of vector search with structured filtering with the fault tolerance and scalability of a cloud-native database​.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: pyproject.toml, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 16930 stars

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
	"context"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

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
			if w.isTransientReplicationError(err.Error) && retries < MAX_RETRI
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
	AuthzController authorization.Controller
	RBAC            *rbac.Manager
	Crons           *cron.Crons

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
	// can wait for a cancelled task's local goroutine to drain before
	// triggering the on-disk state cleanup — see
	// [db.ReindexProvider.WaitForLocalTaskDrain].
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

### Incident Patch 1: `97571b7e` (2026-10-28)
**Commit Message**: fix(add-class): read the collection cap's fail-fast count from the local schema (#13592)

* Enforce the per-namespace collection cap at the RAFT apply path

- The cap was checked only in the schema handler: a leader count query followed later by the apply, so concurrent creates in one namespace could all pass the check and overshoot the cap.
- Enforce it in PreApplyFilter on the leader, with Store.Execute serializing AddClass per namespace across the apply, mirroring the tenant-cap mechanism.
- Unqualified classes count against the global total; uncapped clusters take no lock and read no count.
- The handler check stays as the fail-fast path.

* Read the collection cap's fail-fast count from the local schema

The handler's cap check queried the leader for a count whose answer is advisory: the authoritative check runs in the FSM's PreApplyFilter since the apply-layer enforcement landed.
- Read the node-local count instead, dropping a gRPC round trip from every capped create.
- The fail-open path dies with the query (a local read cannot fail)
- The leader-side GET_COLLECTIONS_COUNT handling stays so old nodes can still query a new leader during rolling upgrades; the now-dead in-repo 

**File**: `cluster/raft_query_endpoints.go` (modified, +0/-36)
```diff
@@ -123,42 +123,6 @@ func (s *Raft) QuerySchema() (models.Schema, error) {
 	return resp.Schema, nil
 }
 
-// QueryCollectionsCount issues a leader-directed count query. An empty
-// namespace returns the cluster-global total; a non-empty namespace returns
-// the count restricted to classes in that namespace.
-func (s *Raft) QueryCollectionsCount(namespace string) (int, error) {
-	ctx := context.Background()
-	if entSentry.Enabled() {
-		transaction := sentry.StartSpan(ctx, "grpc.client",
-			sentry.WithTransactionName("raft.query.collections.count"),
-			sentry.WithDescription("Query the collections count"),
-		)
-		transaction.SetData("namespace", namespace)
-		ctx = transaction.Context()
-		defer transaction.Finish()
-	}
-
-	req := cmd.QueryCollectionsCountRequest{Namespace: namespace}
-	subCommand, err := json.Marshal(&req)
-	if err != nil {
-		return 0, fmt.Errorf("marshal collections count request (namespace=%q): %w", namespace, err)
-	}
-	command := &cmd.QueryRequest{
-		Type:       cmd.QueryRequest_TYPE_GET_COLLECTIONS_COUNT,
-		SubCommand: subCommand,
-	}
-	queryResp, err := s.Query(ctx, command)
-	if err != nil {
-		return 0, fmt.Errorf("execute collections count query (namespace=%q): %w", namespace, err)
-	}
-
-	resp := cmd.QueryCollectionsCountResponse{}
-	if err := json.Unmarshal(queryResp.Payload, &resp); err != nil {
-		return 0, fmt.Errorf("unmarshal collections count response (namespace=%q): %w", namespace, err)
-	}
-	return resp.Count, nil
-}
-
 // QueryTenants build a Query to read the tenants of a given class that will be directed to the leader to ensure we
 // will read the class with strong consistency
 func (s *Raft) QueryTenants(class string, tenants []string) ([]*models.Tenant, uint64, error) {
```

**File**: `cluster/schema/reader.go` (modified, +9/-0)
```diff
@@ -272,6 +272,15 @@ func (rs SchemaReader) GetShardsStatus(class, tenant string) (models.ShardStatus
 
 func (rs SchemaReader) Len() int { return rs.schema.len() }
 
+// CollectionsCount returns the local count of stored classes: the global total
+// for an empty namespace, otherwise only classes in that namespace.
+func (rs SchemaReader) CollectionsCount(namespace string) int {
+	t := prometheus.NewTimer(monitoring.GetMetrics().SchemaReadsLocal.WithLabelValues("CollectionsCount"))
+	defer t.ObserveDuration()
+
+	return rs.schema.CollectionsCount(namespace)
+}
+
 func (rs SchemaReader) retry(f func(*schema) error) error {
 	return backoff.Retry(func() error {
 		return f(rs.schema)
```

**File**: `docs/usage_limits.md` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ On namespace-enabled clusters the chokepoint passes the (namespace-qualified) cl
 
 We deliberately don't route through `UsageForIndex` — that path triggers other usage-module computations beyond a count.
 
-The collection count is **schema/RAFT-backed**: the limit check in `AddClass()` calls `schemaManager.QueryCollectionsCount(namespace)`, which goes through RAFT to the leader. When `NAMESPACES_ENABLED=false` the namespace selector is empty and the response is the cluster-global `len(s.classes)`. When `NAMESPACES_ENABLED=true` the selector is the caller's `principal.Namespace` (namespaced creates already require a namespaced principal) and the count is restricted to stored class names whose `<namespace>:` prefix matches. Aliases live outside this map and do not consume the cap.
+The collection count is **schema/RAFT-backed** and checked twice. `AddClass()` fails fast on the node-local schema via `schemaReader.CollectionsCount(namespace)`, which can lag the leader. The authoritative check runs in the schema FSM's `PreApplyFilter` before the `AddClass` commits. When `NAMESPACES_ENABLED=false` the namespace selector is empty and the response is the cluster-global `len(s.classes)`. When `NAMESPACES_ENABLED=true` the selector is the caller's `principal.Namespace` (namespaced creates already require a namespaced principal) and the count is restricted to stored class names whose `<namespace>:` prefix matches. Aliases live outside this map and do not consume the cap.
 
 ## Error response
 
```

**File**: `usecases/schema/class.go` (modified, +4/-9)
```diff
@@ -185,9 +185,9 @@ func (h *Handler) AddClass(ctx context.Context, principal *models.Principal,
 		return nil, 0, err
 	}
 
-	// Read the limit before the count: no cap is the default, and the count
-	// costs a round trip to the leader whose answer an uncapped cluster
-	// discards.
+	// This check fails fast on the local schema, which can lag the leader.
+	// The authoritative cap check runs in the schema FSM's PreApplyFilter
+	// before the AddClass commits.
 	limit := h.schemaConfig.MaximumAllowedCollectionsCount.Get()
 	if limit != config.DefaultMaximumAllowedCollectionsCount {
 		// On namespace-enabled clusters the cap is enforced per namespace.
@@ -198,12 +198,7 @@ func (h *Handler) AddClass(ctx context.Context, principal *models.Principal,
 			countNamespace = principal.Namespace
 		}
 
-		existingCollectionsCount, err := h.schemaManager.QueryCollectionsCount(countNamespace)
-		if err != nil {
-			h.logger.WithField("namespace", countNamespace).Errorf("could not query the collections count: %v", err)
-		}
-
-		if existingCollectionsCount >= limit {
+		if h.schemaReader.CollectionsCount(countNamespace) >= limit {
 			// Migrated from a free-text 422 to a typed 429 / RESOURCE_EXHAUSTED
 			// in the usage-limits work; see docs/usage_limits.md for the wire
 			// contract.
```

**File**: `usecases/schema/class_test.go` (modified, +4/-4)
```diff
@@ -540,10 +540,10 @@ func Test_AddClassWithLimits(t *testing.T) {
 			t.Run(tt.name, func(t *testing.T) {
 				handler, fakeSchemaManager := newTestHandler(t, &fakeDB{})
 
-				// An unlimited cap must not ask the leader for a count it would
-				// discard, so the expectation is only set where the cap is on.
+				// An unlimited cap skips the count, so the expectation is only
+				// set where the cap is on.
 				if tt.maxAllowed != config.DefaultMaximumAllowedCollectionsCount {
-					fakeSchemaManager.On("QueryCollectionsCount", "").Return(tt.existingCount, nil)
+					fakeSchemaManager.On("CollectionsCount", "").Return(tt.existingCount)
 				}
 
 				// Set the max collections limit in config
@@ -571,7 +571,7 @@ func Test_AddClassWithLimits(t *testing.T) {
 					require.Nil(t, err)
 				}
 				if tt.maxAllowed == config.DefaultMaximumAllowedCollectionsCount {
-					fakeSchemaManager.AssertNotCalled(t, "QueryCollectionsCount", "")
+					fakeSchemaManager.AssertNotCalled(t, "CollectionsCount", "")
 				}
 				fakeSchemaManager.AssertExpectations(t)
 			})
```

**File**: `usecases/schema/fakes_test.go` (modified, +2/-2)
```diff
@@ -152,9 +152,9 @@ func (f *fakeSchemaManager) QuerySchema() (models.Schema, error) {
 	return args.Get(0).(models.Schema), args.Error(1)
 }
 
-func (f *fakeSchemaManager) QueryCollectionsCount(namespace string) (int, error) {
+func (f *fakeSchemaManager) CollectionsCount(namespace string) int {
 	args := f.Called(namespace)
-	return args.Get(0).(int), args.Error(1)
+	return args.Int(0)
 }
 
 func (f *fakeSchemaManager) QueryReadOnlyClasses(classes ...string) (map[string]versioned.Class, error) {
```

**File**: `usecases/schema/handler.go` (modified, +4/-4)
```diff
@@ -91,10 +91,6 @@ type SchemaManager interface {
 	QueryReadOnlyClasses(names ...string) (map[string]versioned.Class, error)
 	QuerySchema() (models.Schema, error)
 	QueryTenants(class string, tenants []string) ([]*models.Tenant, uint64, error)
-	// QueryCollectionsCount returns a leader-consistent count. Empty
-	// namespace returns the cluster-global total; a non-empty namespace
-	// restricts the count to classes in that namespace.
-	QueryCollectionsCount(namespace string) (int, error)
 	QueryShardOwner(class, shard string) (string, uint64, error)
 	QueryTenantsShards(class string, tenants ...string) (map[string]string, uint64, error)
 	QueryShardingState(class string) (*sharding.State, uint64, error)
@@ -134,6 +130,10 @@ type SchemaReader interface {
 	GetShardsStatus(class, tenant string) (models.ShardStatusList, error)
 	ResolveAlias(alias string) string
 	GetAliasesForClass(class string) []*models.Alias
+	// CollectionsCount returns the local count of stored classes. Empty
+	// namespace returns the cluster-global total; a non-empty namespace
+	// restricts the count to classes in that namespace.
+	CollectionsCount(namespace string) int
 
 	// These schema reads function (...WithVersion) return the metadata once the local schema has caught up to the
 	// version parameter. If version is 0 is behaves exactly the same as eventual consistent reads.
```

**File**: `usecases/schema/mock_schema_reader.go` (modified, +46/-0)
```diff
@@ -237,6 +237,52 @@ func (_c *MockSchemaReader_ClassInfoWithVersion_Call) RunAndReturn(run func(cont
 	return _c
 }
 
+// CollectionsCount provides a mock function with given fields: namespace
+func (_m *MockSchemaReader) CollectionsCount(namespace string) int {
+	ret := _m.Called(namespace)
+
+	if len(ret) == 0 {
+		panic("no return value specified for CollectionsCount")
+	}
+
+	var r0 int
+	if rf, ok := ret.Get(0).(func(string) int); ok {
+		r0 = rf(namespace)
+	} else {
+		r0 = ret.Get(0).(int)
+	}
+
+	return r0
+}
+
+// MockSchemaReader_CollectionsCount_Call is a *mock.Call that shadows Run/Return methods with type explicit version for method 'CollectionsCount'
+type MockSchemaReader_CollectionsCount_Call struct {
+	*mock.Call
+}
+
+// CollectionsCount is a helper method to define mock.On call
+//   - namespace string
+func (_e *MockSchemaReader_Expecter) CollectionsCount(namespace interface{}) *MockSchemaReader_CollectionsCount_Call {
+	return &MockSchemaReader_CollectionsCount_Call{Call: _e.mock.On("CollectionsCount", namespace)}
+}
+
+func (_c *MockSchemaReader_CollectionsCount_Call) Run(run func(namespace string)) *MockSchemaReader_CollectionsCount_Call {
+	_c.Call.Run(func(args mock.Arguments) {
+		run(args[0].(string))
+	})
+	return _c
+}
+
+func (_c *MockSchemaReader_CollectionsCount_Call) Return(_a0 int) *MockSchemaReader_CollectionsCount_Call {
+	_c.Call.Return(_a0)
+	return _c
+}
+
+func (_c *MockSchemaReader_CollectionsCount_Call) RunAndReturn(run func(string) int) *MockSchemaReader_CollectionsCount_Call {
+	_c.Call.Return(run)
+	return _c
+}
+
 // GetAliasesForClass provides a mock function with given fields: class
 func (_m *MockSchemaReader) GetAliasesForClass(class string) []*models.Alias {
 	ret := _m.Called(class)
```

---

### Incident Patch 2: `4f432b07` (2026-10-30)
**Commit Message**: feat: make builds reproducible (#13633)

* Make builds reproducible

* fix: gse tokenizers

* fix: revert gse changes as will target stable/v1.38

**File**: `.github/workflows/pull_requests.yaml` (modified, +1/-1)
```diff
@@ -1033,7 +1033,7 @@ jobs:
           install-only: true
       - name: goreleaser
         run: |
-          GIT_REVISION=$(git rev-parse --short HEAD) GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD) BUILD_USER=ci BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") goreleaser build  --clean --snapshot
+          GIT_REVISION=$(git rev-parse --short HEAD) GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD) BUILD_USER=ci goreleaser build --clean --snapshot
       - name: Upload macos
         uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7
         with:
```

**File**: `.github/workflows/release.yaml` (modified, +10/-1)
```diff
@@ -20,6 +20,12 @@ jobs:
         goarch: [amd64, arm64]
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+      - name: Build stamps
+        id: stamps
+        # Commit timestamp, not wall clock, so the binary is reproducible (docs/reproducible-builds.md).
+        run: |
+          echo "revision=${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"
+          echo "date=$(TZ=UTC git log -1 --date=format-local:%Y-%m-%dT%H:%M:%SZ --format=%cd)" >> "$GITHUB_OUTPUT"
       - uses: wangyoucao577/go-release-action@279495102627de7960cbc33434ab01a12bae144b # v1.55
         with:
           github_token: ${{ secrets.GITHUB_TOKEN }}
@@ -28,5 +34,8 @@ jobs:
           goversion: "1.27"
           project_path: "./cmd/weaviate-server"
           extra_files: LICENSE README.md
-          ldflags: -w -extldflags "-static" -X github.com/weaviate/weaviate/usecases/config.GitHash='"$GITHASH"'
+          # -buildvcs=false: the checkout is shallow and tagless, so VCS stamping would embed a
+          # v0.0.0 pseudo-version that no full clone reproduces. Same flags as the Dockerfile.
+          build_flags: -trimpath -buildvcs=false
+          ldflags: -s -w -extldflags "-static" -X github.com/weaviate/weaviate/usecases/build.Branch=${{ github.ref_name }} -X github.com/weaviate/weaviate/usecases/build.Revision=${{ steps.stamps.outputs.revision }} -X github.com/weaviate/weaviate/usecases/build.BuildUser=ci -X github.com/weaviate/weaviate/usecases/build.BuildDate=${{ steps.stamps.outputs.date }}
           sha256sum: true
```

**File**: `.goreleaser.yaml` (modified, +7/-5)
```diff
@@ -1,7 +1,6 @@
-before:
-  hooks:
-    # You may remove this if you don't use go modules.
-    - go mod tidy
+# Reproducible builds (docs/reproducible-builds.md): no `go mod tidy` hook, because a
+# hook that touches go.mod/go.sum flips vcs.modified in the embedded build info; no
+# wall-clock date anywhere; -trimpath so the checkout path is not embedded.
 builds:
   - env:
       - CGO_ENABLED=0
@@ -12,13 +11,16 @@ builds:
     goarch:
       - amd64
       - arm64
+    flags:
+      - -trimpath
+    mod_timestamp: "{{ .CommitTimestamp }}"
     ldflags:
       - -w
       - -extldflags "-static"
       - -X github.com/weaviate/weaviate/usecases/build.Branch={{ .Env.GIT_BRANCH }}
       - -X github.com/weaviate/weaviate/usecases/build.Revision={{ .Env.GIT_REVISION }}
       - -X github.com/weaviate/weaviate/usecases/build.BuildUser={{ .Env.BUILD_USER }}
-      - -X github.com/weaviate/weaviate/usecases/build.BuildDate={{ .Env.BUILD_DATE }}
+      - -X github.com/weaviate/weaviate/usecases/build.BuildDate={{ .CommitDate }}
 
 # create a "fat" binary for MacOS
 universal_binaries:
```

**File**: `Makefile` (modified, +16/-9)
```diff
@@ -9,9 +9,14 @@ help:
 
 GO_VERSION         := $(shell go version | cut -d' ' -f3 | sed 's/^go//')
 
-# Git tags
-GIT_REVISION       := $(shell git rev-parse --short HEAD)
-GIT_BRANCH         := $(shell git rev-parse --abbrev-ref HEAD)
+# Git tags. Overridable so a verifier can rebuild a binary with the exact values
+# recorded in it (`go version -m weaviate` shows the -ldflags that were used).
+GIT_REVISION       ?= $(shell git rev-parse --short HEAD)
+GIT_BRANCH         ?= $(shell git rev-parse --abbrev-ref HEAD)
+# Build stamps. BUILD_DATE defaults to the commit's timestamp, not the wall clock, so
+# two builds of the same commit are byte-identical (see docs/reproducible-builds.md).
+BUILD_USER         ?= $(shell whoami)@$(shell hostname)
+BUILD_DATE         ?= $(shell TZ=UTC git log -1 --date=format-local:%Y-%m-%dT%H:%M:%SZ --format=%cd)
 
 # Golang environment
 GOOS               ?= $(shell go env GOOS)
@@ -27,12 +32,14 @@ GOTEST             ?= go test
 VPREFIX            := github.com/weaviate/weaviate/usecases/build
 GO_LDFLAGS         := -X $(VPREFIX).Branch=$(GIT_BRANCH) \
                       -X $(VPREFIX).Revision=$(GIT_REVISION) \
-                      -X $(VPREFIX).BuildUser=$(shell whoami)@$(shell hostname) \
-                      -X $(VPREFIX).BuildDate=$(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
-GO_FLAGS           := -ldflags "-extldflags \"-static\" -s -w $(GO_LDFLAGS)" -tags netgo
-DYN_GO_FLAGS       := -ldflags "-s -w $(GO_LDFLAGS)" -tags netgo
-
-# Debug build flags
+                      -X $(VPREFIX).BuildUser=$(BUILD_USER) \
+                      -X $(VPREFIX).BuildDate=$(BUILD_DATE)
+# -trimpath keeps the checkout's absolute path out of the binary (file names in
+# pclntab and panic traces), so builds from different directories match.
+GO_FLAGS           := -trimpath -ldflags "-extldflags \"-static\" -s -w $(GO_LDFLAGS)" -tags netgo
+DYN_GO_FLAGS       := -trimpath -ldflags "-s -w $(GO_LDFLAGS)" -tags netgo
+
+# Debug build flags. No -trimpath: delve needs the real source paths.
 DEBUG_GO_FLAGS     := -gcflags "all=-N -l" -ldflags "-extldflags \"-static\" $(GO_LDFLAGS)" -tags netgo
 DEBUG_DYN_GO_FLAGS := -gcflags "all=-N -l" -ldflags "$(GO_LDFLAGS)" -tags netgo
 
```

**File**: `ci/push_docker.sh` (modified, +2/-1)
```diff
@@ -43,7 +43,8 @@ function release() {
   git_revision=$(echo "$GITHUB_SHA" | cut -c1-7)
   git_branch="$GITHUB_HEAD_REF"
   build_user="ci"
-  build_date=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
+  # Commit timestamp, not wall clock, so the binary is reproducible (docs/reproducible-builds.md).
+  build_date=$(TZ=UTC git log -1 --date=format-local:%Y-%m-%dT%H:%M:%SZ --format=%cd "$GITHUB_SHA")
 
   # Determine architecture and platform
   arch=""
```

**File**: `docs/reproducible-builds.md` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+# Reproducible builds
+
+Building the same commit twice must produce a byte-identical `weaviate` binary, from
+any checkout directory, on any machine with the same Go toolchain. This lets anyone
+verify that a shipped binary (GitHub release asset or the `/bin/weaviate` inside the
+Docker image) really was built from the commit it claims.
+
+`tools/dev/check_reproducible_build.sh` builds twice and compares hashes.
+
+## What goes into the binary
+
+Everything below is a build input. Change any of it and the hash changes.
+
+| Input | Where it comes from | Why it is deterministic |
+|---|---|---|
+| Source tree | the commit | must be clean (see `vcs.modified`) |
+| Go toolchain | `golang:1.27-alpine` (Docker), `goversion: 1.27` (release action), local `go` (Makefile) | deliberately **not** pinned to a patch version, so Go security fixes keep rolling in. The exact version is recorded in the binary (first line of `go version -m`), and a verifier rebuilds with that version. See below |
+| `-trimpath` | Makefile, Dockerfile, `.goreleaser.yaml`, `release.yaml` | without it ~2300 absolute source paths of the checkout are embedded in pclntab |
+| `-X build.Revision` | `git rev-parse --short HEAD` | derived from the commit |
+| `-X build.Branch` | branch or tag name | a declared input; CI passes the tag name for releases, so re-derivable. Nothing else reads it: Docker tags are computed in `ci/push_docker.sh` from the GitHub ref, not from the binary |
+| `-X build.BuildUser` | `ci` in CI, `user@host` locally | override with `make BUILD_USER=ci` to match a CI binary |
+| `-X build.BuildDate` | **the commit timestamp**, never the wall clock | `TZ=UTC git log -1 --date=format-local:%Y-%m-%dT%H:%M:%SZ --format=%cd`; goreleaser uses `{{ .CommitDate }}` |
+| ldflags string | all of the above, verbatim | `go build` embeds the exact `-ldflags` text in the build info, so flag order and spacing matter too |
+| VCS stamp (`vcs.revision`, `vcs.time`, `vcs.modified`, main-module version) | `-buildvcs` (default `auto`) | see below |
+
+`go version -m weaviate` prints every one of these, so a verifier can read the inputs
+straight out of the binary they want to check.
+
+## Code must not find files through runtime.Caller
+
+`-trimpath` rewrites the file names that `runtime.Caller` reports from absolute paths to
+module-relative ones, so any code that builds a path from them breaks in a release binary.
+The gse tokenizer did exactly this to locate its dictionaries and was silently unavailable
+in every Docker image from v1.34.0 until it was switched to the dictionaries gse embeds.
+Ship data as `//go:embed` files, never as paths derived from the source tree, and run the
+tests of any code that loads data with `go test -trimpath`.
+
+## The VCS stamp
+
+With `-buildvcs=auto` (the default) `go build` records the commit, its time, whether the
+tree was dirty, and a main-module version derived from the nearest reachable tag.
+
+- **Dirty tree.** Any modified *or untracked* file flips `vcs.modified=true` and changes
+  the binary. Build from a clean checkout. This is why `.goreleaser.yaml` has no
+  `go mod tidy` hook: a hook that rewrites `go.mod` dirties the tree mid-build.
+- **Shallow or tagless clone.** `actions/checkout` fetches depth 1 with no tags. The main
+  module version then becomes `v0.0.0-<time>-<sha>` instead of `v1.40.2-0.<time>-<sha>`,
+  which a full clone can never reproduce. The GitHub release job therefore builds with
+  `-buildvcs=false`.
+- **Docker.** `.dockerignore` excludes `.git`, so the Docker binary has no VCS stamp and
+  reports its module version as `(devel)`.
+
+To reproduce a CI binary locally, pass `-buildvcs=false` as well.
+
+## Reproducing the Docker image's binary locally
+
+```sh
+CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -buildvcs=false \
+  -ldflags="<the -ldflags line printed by: go version -m /bin/weaviate>" \
+  -o weaviate ./cmd/weaviate-server
+sha256sum weaviate
+```
+
+Use the Go version printed on the first line of `go version -m /bin/weaviate`, for example
+by running the build inside `golang:<that version>-alpine`.
+
+## Reproducing a Makefile build
+
+```sh
+make weaviate BUILD_USER=<user@host from go version -m> GIT_BRANCH=<branch>
+```
+
+`GIT_REVISION` and `BUILD_DATE` default to values derived from the commit and only need
+overriding when they were overridden for the original build.
+
+## What is not reproducible by design
+
+- `make weaviate-debug` keeps absolute paths (no `-trimpath`) because delve needs them.
+- The signed and notarized macOS zip produced by `tools/dev/goreleaser_and_sign.sh`:
+  code signatures carry a signing timestamp. The binary *before* signing is reproducible.
```

**File**: `tools/dev/check_reproducible_build.sh` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+#!/usr/bin/env bash
+# Builds the weaviate binary twice with the Makefile and fails if the two builds differ.
+# Run from the repository root on a clean checkout. See docs/reproducible-builds.md.
+set -euo pipefail
+
+if [[ -n "$(git status --porcelain)" ]]; then
+  echo "working tree is dirty; vcs.modified would be stamped into the binary" >&2
+  git status --short >&2
+  exit 1
+fi
+
+out=$(mktemp -d)
+trap 'rm -rf "$out"' EXIT
+
+for i in 1 2; do
+  make weaviate BUILD_USER=ci >/dev/null
+  cp cmd/weaviate-server/weaviate "$out/weaviate.$i"
+done
+
+a=$(sha256sum "$out/weaviate.1" | cut -d' ' -f1)
+b=$(sha256sum "$out/weaviate.2" | cut -d' ' -f1)
+if [[ "$a" != "$b" ]]; then
+  echo "builds differ: $a != $b" >&2
+  echo "build info of the first binary:" >&2
+  go version -m "$out/weaviate.1" >&2
+  exit 1
+fi
+echo "reproducible: $a"
```

**File**: `tools/dev/goreleaser_and_sign.sh` (modified, +2/-2)
```diff
@@ -9,7 +9,7 @@ set -eou pipefail
 GIT_REVISION=$(git rev-parse --short HEAD)
 GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
 BUILD_USER="ci"
-BUILD_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
+# BuildDate comes from .goreleaser.yaml ({{ .CommitDate }}) so the binary is reproducible.
 
 extra_args=""
 
@@ -19,7 +19,7 @@ if [[ "$VERSION" == *"-"* ]]; then
     extra_args="--snapshot"
 fi
 
-GIT_REVISION="$GIT_REVISION" GIT_BRANCH="$GIT_BRANCH" BUILD_USER="$BUILD_USER" BUILD_DATE="$BUILD_DATE" goreleaser build --clean $extra_args
+GIT_REVISION="$GIT_REVISION" GIT_BRANCH="$GIT_BRANCH" BUILD_USER="$BUILD_USER" goreleaser build --clean $extra_args
 
 codesign -f -o runtime --timestamp -s "Developer ID Application: Weaviate B.V. (QUZ8SKLS6R)" dist/weaviate_darwin_all/weaviate
 
```

#### Recent Merged Pull Requests:
- **PR #13672** (2026-10-30): Merge stable/v1.39 into stable/v1.40 (@antas-marcin)
- **PR #13671** (2026-10-30): Merge stable/v1.38 into stable/v1.39 (@antas-marcin)
- **PR #13670** (2026-10-30): Merge stable/v1.37 into stable/v1.38 (@antas-marcin)
- **PR #13664** (2026-10-30): Deny namespaced callers on RBAC paths with an unrecognized shape (@dirkkul)
- **PR #13663** (2026-10-30): Merge stable/v1.40 into main (@antas-marcin)
- **PR #13662** (2026-10-29): Merge stable/v1.39 into stable/v1.40 (@antas-marcin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
