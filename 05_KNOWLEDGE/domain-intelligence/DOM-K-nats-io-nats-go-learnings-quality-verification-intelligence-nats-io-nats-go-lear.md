# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: nats-io-nats.go-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "nats-io-nats.go-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T21:41:21.315Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-nats-io-nats.go-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nats-io-nats.go-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T21:41:21.315Z`  
> **Learning ID**: `LEARN-EVO-nats-io-nats.go-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), H (Technical Construction Intelligence), I (Content & Information Intelligence), A (Human & Need Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 53%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from nats-io-nats.go-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nats-io-nats.go-learnings.md`  
> **Source**: github ([https://github.com/nats-io/nats.go](https://github.com/nats-io/nats.go))  
> **Source Version**: `febd2b97`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T21:41:09.123Z  
> **Learning ID**: `learn-github-nats-io-nats-go`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): nats-io/nats.go

> **Canonical Artifact**: `07_PROJECT_LEARNING/nats-io-nats.go-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nats-io/nats.go](https://github.com/nats-io/nats.go))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T21:41:09.118Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nats-io/nats.go`
- **Description**: Golang client for NATS, the cloud native messaging system.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 6813 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `micro/conn_hooks.go`
```
// Copyright 2026 The NATS Authors
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

package micro

import (
	"slices"
	"sync"

	"github.com/nats-io/nats.go"
)

// connHooks holds the services added on a connection and the connection's
// handlers that were set before the first of them was added.
type connHooks struct {
	services   []*service
	prevClosed nats.ConnHandler
	prevErr    nats.ErrHandler
}

var hooks = struct {
	sync.Mutex
	conns map[*nats.Conn]*connHooks
}{conns: make(map[*nats.Conn]*connHooks)}

// registerService adds s to its connection's hooks. The first service on a
// connection installs the connection's closed and error handlers.
func registerService(s *service) {
	hooks.Lock()
	defer hooks.Unlock()
	h, ok := hooks.conns[s.nc]
	if !ok {
		h = &connHooks{
			prevClosed: s.nc.ClosedHandler(),
			prevErr:    s.nc.ErrorHandler(),
		}
		hooks.conns[s.nc] = h
		s.nc.SetClosedHandler(func(c *nats.Conn) {
			h.connClosed(c)
		})
		s.nc.SetErrorHandler(func(c *nats.Conn, sub *nats.Subscription, err error) {
			h.asyncErr(c, sub, err)
		})
	}
	h.services = append(h.services, s)
}

// unregisterService removes s from its connection's hooks. The last service
// on a connection restores the connection's previous handlers.
func unregisterService(s *service) {
	hooks.Lock()
	defer hooks.Unlock()
	h, ok := hooks.conns[s.nc]
	if !ok {
		return
	}
	h.services = slices.DeleteFunc(h.services, func(other *service) bool {
		return other == s
	})
	if len(h.services) > 0 {
		return
	}
	delete(hooks.conns, s.nc)
	if !s.nc.IsClosed() {
		s.nc.SetClosedHandler(h.prevClosed)
		s.nc.SetErrorHandler(h.prevErr)
	}
}

func (h *connHooks) connClosed(c *nats.Conn) {
	hooks.Lock()
	services := h.services
	h.services = nil
	if hooks.conns[c] == h {
		delete(hooks.conns, c)
	}
	hooks.Unlock()
	for _, s := range services {
		s.Stop()
	}
	if h.prevClosed != nil {
		h.prevClosed(c)
	}
}

func (h *connHooks) asyncErr(c *nats.Conn, sub *nats.Subscription, err error) {
	hooks.Lock()
	services := slices.Clone(h.services)
	hooks.Unlock()
	for _, s := range services {
		s.handleAsyncErr(sub, err)
	}
	if h.prevErr != nil {
		h.prevErr(c, sub, err)
	}
}

```

### Core Architecture Module: `util/tls.go`
```
// Copyright 2017-2022 The NATS Authors
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

package util

import "crypto/tls"

// CloneTLSConfig returns a copy of c.
func CloneTLSConfig(c *tls.Config) *tls.Config {
	if c == nil {
		return &tls.Config{}
	}

	return c.Clone()
}

```

### Core Architecture Module: `bench/bench.go`
```
// Copyright 2016-2023 The NATS Authors
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

package bench

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"log"
	"math"
	"strconv"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nuid"
)

// A Sample for a particular client
type Sample struct {
	JobMsgCnt int
	MsgCnt    uint64
	MsgBytes  uint64
	IOBytes   uint64
	Start     time.Time
	End       time.Time
}

// SampleGroup for a number of samples, the group is a Sample itself aggregating the values the Samples
type SampleGroup struct {
	Sample
	Samples []*Sample
}

// Benchmark to hold the various Samples organized by publishers and subscribers
type Benchmark struct {
	Sample
	Name       string
	RunID      string
	Pubs       *SampleGroup
	Subs       *SampleGroup
	subChannel chan *Sample
	pubChannel chan *Sample
}

// NewBenchmark initializes a Benchmark. After creating a bench call AddSubSample/AddPubSample.
// When done collecting samples, call EndBenchmark
func NewBenchmark(name string, subCnt, pubCnt int) *Benchmark {
	bm := Benchmark{Name: name, RunID: nuid.Next()}
	bm.Subs = NewSampleGroup()
	bm.Pubs = NewSampleGroup()
	bm.subChannel = make(chan *Sample, subCnt)
	bm.pubChannel = make(chan *Sample, pubCnt)
	return &bm
}

// Close organizes collected Samples and calculates aggregates. After Close(), no more samples can be added.
func (bm *Benchmark) Close() {
	close(bm.subChannel)
	close(bm.pubChannel)

	for s := range bm.subChannel {
		bm.Subs.AddSample(s)
	}
	for s := range bm.pubChannel {
		bm.Pubs.AddSample(s)
	}

	if bm.Subs.HasSamples() {
		bm.Start = bm.Subs.Start
		bm.End = bm.Subs.End
	} else {
		bm.Start = bm.Pubs.Start
		bm.End = bm.Pubs.End
	}

	if bm.Subs.HasSamples() && bm.Pubs.HasSamples() {
		if bm.Start.After(bm.Subs.Start) {
			bm.Start = bm.Subs.Start
		}
		if bm.Start.After(bm.Pubs.Start) {
			bm.Start = bm.Pubs.Start
		}

		if bm.End.Before(bm.Subs.End) {
			bm.End = bm.Subs.End
		}
		if bm.End.Before(bm.Pubs.End) {
			bm.End = bm.Pubs.End
		}
	}

	bm.MsgBytes = bm.Pubs.MsgBytes + bm.Subs.MsgBytes
	bm.IOBytes = bm.Pubs.IOBytes + bm.Subs.IOBytes
	bm.MsgCnt = bm.Pubs.MsgCnt + bm.Subs.MsgCnt
	bm.JobMsgCnt = bm.Pubs.JobMsgCnt + bm.Subs.JobMsgCnt
}

// AddSubSample to the benchmark
func (bm *Benchmark) AddSubSample(s *Sample) {
	bm.subChannel <- s
}

// AddPubSample to the benchmark
func (bm *Benchmark) AddPubSample(s *Sample) {
	bm.pubChannel <- s
}

// CSV generates a csv report of all the samples collected
func (bm *Benchmark) CSV() string {
	var buffer bytes.Buffer
	writer := csv.NewWriter(&buffer)
	headers := []string{"#RunID", "ClientID", "MsgCount", "MsgBytes", "MsgsPerSec", "BytesPerSec", "DurationSecs"}
	if err := writer.Write(headers); err != nil {
		log.Fatalf("Error while serializing headers %q: %v", headers, err)
	}
	groups := []*SampleGroup{bm.Subs, bm.Pubs}
	pre := "S"
	for i, g := range groups {
		if i == 1 {
			pre = "P"
		}
		for j, c := range g.Samples {
			r := []string{bm.RunID, fmt.Sprintf("%s%d", pre, j), fmt.Sprintf("%d", c.MsgCnt), fmt.Sprintf("%d", c.MsgBytes), fmt.Sprintf("%d", c.Rate()), fmt.Sprintf("%f", c.Throughput()), fmt.Sprintf("%f", c.Duration().Seconds())}
			if err := writer.Write(r); err != nil {
				log.Fatalf("Error while serializing %v: %v", c, err)
			}
		}
	}

	writer.Flush()
	return buffer.String()
}

// NewSample creates a new Sample initialized to the provided values. The nats.Conn information captured
func NewSample(jobCount int, msgSize int, start, end time.Time, nc *nats.Conn) *Sample {
	s := Sample{JobMsgCnt: jobCount, Start: start, End: end}
	s.MsgBytes = uint64(msgSize * jobCount)
	s.MsgCnt = nc.OutMsgs + nc.InMsgs
	s.IOBytes = nc.OutBytes + nc.InBytes
	return &s
}

// Throughput of bytes per second
func (s *Sample) Throughput() float64 {
	return float64(s.MsgBytes) / s.Duration().Seconds()
}

// Rate of messages in the job per second
func (s *Sample) Rate() int64 {
	return int64(float64(s.JobMsgCnt) / s.Duration().Seconds())
}

func (s *Sample) String() string {
	rate := commaFormat(s.Rate())
	throughput := HumanBytes(s.Throughput(), false)
	return fmt.Sprintf("%s msgs/sec ~ %s/sec", rate, throughput)
}

// Duration that the sample was active
func (s *Sample) Duration() time.Duration {
	return s.End.Sub(s.Start)
}

// Seconds that the sample or samples were active
func (s *Sample) Seconds() float64 {
	return s.Duration().Seconds()
}

// NewSampleGroup initializer
func NewSampleGroup() *SampleGroup {
	s := new(SampleGroup)
	s.Samples = make([]*Sample, 0)
	return s
}

// Statistics information of the sample group (min, average, max and standard deviation)
func (sg *SampleGroup) Statistics() string {
	return fmt.Sprintf("min %s | avg %s | max %s | stddev %s msgs", commaFormat(sg.MinRate()), commaFormat(sg.AvgRate()), commaFormat(sg.MaxRate()), commaFormat(int64(sg.StdDev())))
}

// MinRate returns the smallest message rate in the SampleGroup
func (sg *SampleGroup) MinRate() int64 {
	m := int64(0)
	for i, s := range sg.Samples {
		if i == 0 {
			m = s.Rate()
		}
		m = min(m, s.Rate())
	}
	return m
}

// MaxRate returns the largest message rate in the SampleGroup
func (sg *SampleGroup) MaxRate() int64 {
	m := int64(0)
	for i, s := range sg.Samples {
		if i == 0 {
			m = s.Rate()
		}
		m = max(m, s.Rate())
	}
	return m
}

// AvgRate returns the average of all the message rates in the SampleGroup
func (sg *SampleGroup) AvgRate() int64 {
	if !sg.HasSamples() {
		return 0
	}
	sum := uint64(0)
	for _, s := range sg.Samples {
		sum += uint64(s.Rate())
	}
	return int64(sum / uint64(len(sg.Samples)))
}

// StdDev returns the standard deviation the message rates in the SampleGroup
func (sg *SampleGroup) StdDev() float64 {
	if !sg.HasSamples() {
		return 0
	}
	avg := float64(sg.AvgRate())
	sum := float64(0)
	for _, c := range sg.Samples {
		sum += math.Pow(float64(c.Rate())-avg, 2)
	}
	variance := sum / float64(len(sg.Samples))
	return math.Sqrt(variance)
}

// AddSample adds a Sample to the SampleGroup. After adding a Sample it shouldn't be modified.
func (sg *SampleGroup) AddSample(e *Sample) {
	sg.Samples = append(sg.Samples, e)

	if len(sg.Samples) == 1 {
		sg.Start = e.Start
		sg.End = e.End
	}
	sg.IOBytes += e.IOBytes
	sg.JobMsgCnt += e.JobMsgCnt
	sg.MsgCnt += e.MsgCnt
	sg.MsgBytes += e.MsgBytes

	if e.Start.Before(sg.Start) {
		sg.Start = e.Start
	}

	if e.End.After(sg.End) {
		sg.End = e.End
	}
}

// HasSamples returns true if the group has samples
func (sg *SampleGroup) HasSamples() bool {
	return len(sg.Samples) > 0
}

// Report returns a human readable report of the samples taken in the Benchmark
func (bm *Benchmark) Report() string {
	var buffer bytes.Buffer

	indent := ""
	if !bm.Pubs.HasSamples() && !bm.Subs.HasSamples() {
		return "No publisher or subscribers. Nothing to report."
	}

	if bm.Pubs.HasSamples() && bm.Subs.HasSamples() {
		buffer.WriteString(fmt.Sprintf("%s Pub/Sub stats: %s\n", bm.Name, bm))
		indent += " "
	}
	if bm.Pubs.HasSamples() {
		buffer.WriteString(fmt.Sprintf("%sPub stats: %s\n", indent, bm.Pubs))
		if len(bm.Pubs.Samples) > 1 {
			for i, stat := range bm.Pubs.Samples {
				buffer.WriteString(fmt.Sprintf("%s [%d] %v (%d msgs)\n", indent, i+1, stat, stat.JobMsgCnt))
			}
			buffer.WriteString(fmt.Sprintf("%s %s\n", indent, bm.Pubs.Statistics()))
		}
	}

	if bm.Subs.HasSamples() {
		buffer.WriteString(fmt.Sprintf("%sSub stats: %s\n", indent, bm.Subs))
		if len(bm.Subs.Samples) > 1 {
			for i, stat := range bm.Subs.Samples {
				buffer.WriteString(fmt.Sprintf("%s [%d] %v (%d msgs)\n", indent, i+1, stat, stat.JobMsgCnt))
			}
			buffer.WriteString(fmt.Sprintf("%s %s\n", indent, bm.Subs.Statistics()))
		}
	}
	return buffer.String()
}

func commaFormat(n int64) string {
	in := strconv.FormatInt(n, 10)
	out := make([]byte, len(in)+(len(in)-2+int(in[0]/'0'))/3)
	if in[0] == '-' {
		in, out[0] = in[1:], '-'
	}
	for i, j, k := len(in)-1, len(out)-1, 0; ; i, j = i-1, j-1 {
		out[j] = in[i]
		if i == 0 {
			return string(out)
		}
		if k++; k == 3 {
			j, k = j-1, 0
			out[j] = ','
		}
	}
}

// HumanBytes formats bytes as a human readable string
func HumanBytes(bytes float64, si bool) string {
	var base = 1024
	pre := []string{"K", "M", "G", "T", "P", "E"}
	var post = "B"
	if si {
		base = 1000
		pre = []string{"k", "M", "G", "T", "P", "E"}
		post = "iB"
	}
	if bytes < float64(base) {
		return fmt.Sprintf("%.2f B", bytes)
	}
	exp := int(math.Log(bytes) / math.Log(float64(base)))
	index := exp - 1
	units := pre[index] + post
	return fmt.Sprintf("%.2f %s", bytes/math.Pow(float64(base), float64(exp)), units)
}

// MsgsPerClient divides the number of messages by the number of clients and tries to distribute them as evenly as possible
func MsgsPerClient(numMsgs, numClients int) []int {
	var counts []int
	if numClients == 0 || numMsgs == 0 {
		return counts
	}
	counts = make([]int, numClients)
	mc := numMsgs / numClients
	for i := 0; i < numClients; i++ {
		counts[i] = mc
	}
	extra := numMsgs % numClients
	for i := 0; i < extra; i++ {
		counts[i]++
	}
	return counts
}

```

### Core Architecture Module: `context.go`
```
// Copyright 2016-2023 The NATS Authors
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

package nats

import (
	"context"
	"reflect"
)

// RequestMsgWithContext takes a context, a subject and payload
// in bytes and request expecting a single response.
func (nc *Conn) RequestMsgWithContext(ctx context.Context, msg *Msg) (*Msg, error) {
	if msg == nil {
		return nil, ErrInvalidMsg
	}
	hdr, err := msg.headerBytes()
	if err != nil {
		return nil, err
	}
	return nc.requestWithContext(ctx, msg.Subject, hdr, msg.Data)
}

// RequestWithContext takes a context, a subject and payload
// in bytes and request expecting a single response.
func (nc *Conn) RequestWithContext(ctx context.Context, subj string, data []byte) (*Msg, error) {
	return nc.requestWithContext(ctx, subj, nil, data)
}

func (nc *Conn) requestWithContext(ctx context.Context, subj string, hdr, data []byte) (*Msg, error) {
	if ctx == nil {
		return nil, ErrInvalidContext
	}
	if nc == nil {
		return nil, ErrInvalidConnection
	}
	// Check whether the context is done already before making
	// the request.
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}

	var m *Msg
	var err error

	// If user wants the old style.
	if nc.useOldRequestStyle() {
		m, err = nc.oldRequestWithContext(ctx, subj, hdr, data)
	} else {
		mch, token, err := nc.createNewRequestAndSend(subj, hdr, data)
		if err != nil {
			return nil, err
		}

		var ok bool

		select {
		case m, ok = <-mch:
			if !ok {
				if nc.IsClosed() {
					return nil, ErrConnectionClosed
				}
				return nil, ErrDisconnected
			}
		case <-ctx.Done():
			nc.mu.Lock()
			delete(nc.respMap, token)
			nc.mu.Unlock()
			return nil, ctx.Err()
		}
	}
	// Check for no responder status.
	if err == nil && len(m.Data) == 0 && m.Header.Get(statusHdr) == noResponders {
		m, err = nil, ErrNoResponders
	}
	return m, err
}

// oldRequestWithContext utilizes inbox and subscription per request.
func (nc *Conn) oldRequestWithContext(ctx context.Context, subj string, hdr, data []byte) (*Msg, error) {
	inbox := nc.NewInbox()
	ch := make(chan *Msg, RequestChanLen)

	s, err := nc.subscribe(inbox, _EMPTY_, nil, ch, nil, true, nil)
	if err != nil {
		return nil, err
	}
	s.AutoUnsubscribe(1)
	defer s.Unsubscribe()

	err = nc.publish(subj, inbox, false, hdr, data)
	if err != nil {
		return nil, err
	}

	return s.NextMsgWithContext(ctx)
}

func (s *Subscription) nextMsgWithContext(ctx context.Context, pullSubInternal, waitIfNoMsg bool) (*Msg, error) {
	if ctx == nil {
		return nil, ErrInvalidContext
	}
	if s == nil {
		return nil, ErrBadSubscription
	}
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}

	s.mu.Lock()
	err := s.validateNextMsgState(pullSubInternal)
	if err != nil {
		s.mu.Unlock()
		return nil, err
	}

	// snapshot
	mch := s.mch
	s.mu.Unlock()

	var ok bool
	var msg *Msg

	// If something is available right away, let's optimize that case.
	select {
	case msg, ok = <-mch:
		if !ok {
			return nil, s.getNextMsgErr()
		}
		if err := s.processNextMsgDelivered(msg); err != nil {
			return nil, err
		}
		return msg, nil
	default:
		// If internal and we don't want to wait, signal that there is no
		// message in the internal queue.
		if pullSubInternal && !waitIfNoMsg {
			return nil, errNoMessages
		}
	}

	select {
	case msg, ok = <-mch:
		if !ok {
			return nil, s.getNextMsgErr()
		}
		if err := s.processNextMsgDelivered(msg); err != nil {
			return nil, err
		}
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	return msg, nil
}

// NextMsgWithContext takes a context and returns the next message
// available to a synchronous subscriber, blocking until it is delivered
// or context gets canceled.
func (s *Subscription) NextMsgWithContext(ctx context.Context) (*Msg, error) {
	return s.nextMsgWithContext(ctx, false, true)
}

// FlushWithContext will allow a context to control the duration
// of a Flush() call. This context should be non-nil and should
// have a deadline set. We will return an error if none is present.
func (nc *Conn) FlushWithContext(ctx context.Context) error {
	if nc == nil {
		return ErrInvalidConnection
	}
	if ctx == nil {
		return ErrInvalidContext
	}
	_, ok := ctx.Deadline()
	if !ok {
		return ErrNoDeadlineContext
	}

	nc.mu.Lock()
	if nc.isClosed() {
		nc.mu.Unlock()
		return ErrConnectionClosed
	}
	// Create a buffered channel to prevent chan send to block
	// in processPong()
	ch := make(chan struct{}, 1)
	nc.sendPing(ch)
	nc.mu.Unlock()

	var err error

	select {
	case _, ok := <-ch:
		if !ok {
			err = ErrConnectionClosed
		} else {
			close(ch)
		}
	case <-ctx.Done():
		err = ctx.Err()
	}

	if err != nil {
		nc.removeFlushEntry(ch)
	}

	return err
}

// RequestWithContext will create an Inbox and perform a Request
// using the provided cancellation context with the Inbox reply
// for the data v. A response will be decoded into the vPtr last parameter.
//
// Deprecated: Encoded connections are no longer supported.
func (c *EncodedConn) RequestWithContext(ctx context.Context, subject string, v any, vPtr any) error {
	if ctx == nil {
		return ErrInvalidContext
	}

	b, err := c.Enc.Encode(subject, v)
	if err != nil {
		return err
	}
	m, err := c.Conn.RequestWithContext(ctx, subject, b)
	if err != nil {
		return err
	}
	if reflect.TypeOf(vPtr) == emptyMsgType {
		mPtr := vPtr.(*Msg)
		*mPtr = *m
	} else {
		err := c.Enc.Decode(m.Subject, m.Data, vPtr)
		if err != nil {
			return err
		}
	}

	return nil
}

```

### Core Architecture Module: `enc.go`
```
// Copyright 2012-2023 The NATS Authors
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

package nats

import (
	"errors"
	"fmt"
	"reflect"
	"sync"
	"time"

	// Default Encoders
	"github.com/nats-io/nats.go/encoders/builtin"
)

//lint:file-ignore SA1019 Ignore deprecation warnings for EncodedConn

// Encoder interface is for all register encoders
//
// Deprecated: Encoded connections are no longer supported.
type Encoder interface {
	Encode(subject string, v any) ([]byte, error)
	Decode(subject string, data []byte, vPtr any) error
}

var encMap map[string]Encoder
var encLock sync.Mutex

// Indexed names into the Registered Encoders.
const (
	JSON_ENCODER    = "json"
	GOB_ENCODER     = "gob"
	DEFAULT_ENCODER = "default"
)

func init() {
	encMap = make(map[string]Encoder)
	// Register json, gob and default encoder
	RegisterEncoder(JSON_ENCODER, &builtin.JsonEncoder{})
	RegisterEncoder(GOB_ENCODER, &builtin.GobEncoder{})
	RegisterEncoder(DEFAULT_ENCODER, &builtin.DefaultEncoder{})
}

// EncodedConn are the preferred way to interface with NATS. They wrap a bare connection to
// a nats server and have an extendable encoder system that will encode and decode messages
// from raw Go types.
//
// Deprecated: Encoded connections are no longer supported.
type EncodedConn struct {
	Conn *Conn
	Enc  Encoder
}

// NewEncodedConn will wrap an existing Connection and utilize the appropriate registered
// encoder.
//
// Deprecated: Encoded connections are no longer supported.
func NewEncodedConn(c *Conn, encType string) (*EncodedConn, error) {
	if c == nil {
		return nil, errors.New("nats: Nil Connection")
	}
	if c.IsClosed() {
		return nil, ErrConnectionClosed
	}
	ec := &EncodedConn{Conn: c, Enc: EncoderForType(encType)}
	if ec.Enc == nil {
		return nil, fmt.Errorf("no encoder registered for '%s'", encType)
	}
	return ec, nil
}

// RegisterEncoder will register the encType with the given Encoder. Useful for customization.
//
// Deprecated: Encoded connections are no longer supported.
func RegisterEncoder(encType string, enc Encoder) {
	encLock.Lock()
	defer encLock.Unlock()
	encMap[encType] = enc
}

// EncoderForType will return the registered Encoder for the encType.
//
// Deprecated: Encoded connections are no longer supported.
func EncoderForType(encType string) Encoder {
	encLock.Lock()
	defer encLock.Unlock()
	return encMap[encType]
}

// Publish publishes the data argument to the given subject. The data argument
// will be encoded using the associated encoder.
//
// Deprecated: Encoded connections are no longer supported.
func (c *EncodedConn) Publish(subject string, v any) error {
	b, err := c.Enc.Encode(subject, v)
	if err != nil {
		return err
	}
	return c.Conn.publish(subject, _EMPTY_, false, nil, b)
}

// PublishRequest will perform a Publish() expecting a response on the
// reply subject. Use Request() for automatically waiting for a response
// inline.
//
// Deprecated: Encoded connections are no longer supported.
func (c *EncodedConn) PublishRequest(subject, reply string, v any) error {
	b, err := c.Enc.Encode(subject, v)
	if err != nil {
		return err
	}
	return c.Conn.publish(subject, reply, true, nil, b)
}

// Request will create an Inbox and perform a Request() call
// with the Inbox reply for the data v. A response will be
// decoded into the vPtr Response.
//
// Deprecated: Encoded connections are no longer supported.
func (c *EncodedConn) Request(subject string, v any, vPtr any, timeout time.Duration) error {
	b, err := c.Enc.Encode(subject, v)
	if err != nil {
		return err
	}
	m, err := c.Conn.Request(subject, b, timeout)
	if err != nil {
		return err
	}
	if reflect.TypeOf(vPtr) == emptyMsgType {
		mPtr := vPtr.(*Msg)
		*mPtr = *m
	} else {
		err = c.Enc.Decode(m.Subject, m.Data, vPtr)
	}
	return err
}

// Handler is a specific callback used for Subscribe. It is generalized to
// an any, but we will discover its format and arguments at runtime
// and perform the correct callback, including demarshaling encoded data
// back into the appropriate struct based on the signature of the Handler.
//
// Handlers are expected to have one of four signatures.
//
//	type person struct {
//		Name string `json:"name,omitempty"`
//		Age  uint   `json:"age,omitempty"`
//	}
//
//	handler := func(m *Msg)
//	handler := func(p *person)
//	handler := func(subject string, o *obj)
//	handler := func(subject, reply string, o *obj)
//
// These forms allow a callback to request a raw Msg ptr, where the processing
// of the message from the wire is untouched. Process a JSON representation
// and demarshal it into the given struct, e.g. person.
// There are also variants where the callback wants either the subject, or the
// subject and the reply subject.
//
// Deprecated: Encoded connections are no longer supported.
type Handler any

// Dissect the cb Handler's signature
func argInfo(cb Handler) (reflect.Type, int) {
	cbType := reflect.TypeOf(cb)
	if cbType.Kind() != reflect.Func {
		panic("nats: Handler needs to be a func")
	}
	numArgs := cbType.NumIn()
	if numArgs == 0 {
		return nil, numArgs
	}
	return cbType.In(numArgs - 1), numArgs
}

var emptyMsgType = reflect.TypeOf(&Msg{})

// Subscribe will create a subscription on the given subject and process incoming
// messages using the specified Handler. The Handler should be a func that matches
// a signature from the description of Handler from above.
//
// Deprecated: Encoded connections are no longer supported.
func (c *EncodedConn) Subscribe(subject string, cb Handler) (*Subscription, error) {
	return c.subscribe(subject, _EMPTY_, cb)
}

// QueueSubscribe will create a queue subscription on the given subject and process
// incoming messages using the specified Handler. The Handler should be a func that
// matches a signature from the description of Handler from above.
//
// Deprecated: Encoded connections are no longer supported.
func (c *EncodedConn) QueueSubscribe(subject, queue string, cb Handler) (*Subscription, error) {
	return c.subscribe(subject, queue, cb)
}

// Internal implementation that all public functions will use.
func (c *EncodedConn) subscribe(subject, queue string, cb Handler) (*Subscription, error) {
	if cb == nil {
		return nil, errors.New("nats: Handler required for EncodedConn Subscription")
	}
	argType, numArgs := argInfo(cb)
	if argType == nil {
		return nil, errors.New("nats: Handler requires at least one argument")
	}

	cbValue := reflect.ValueOf(cb)
	wantsRaw := (argType == emptyMsgType)

	natsCB := func(m *Msg) {
		var oV []reflect.Value
		if wantsRaw {
			oV = []reflect.Value{reflect.ValueOf(m)}
		} else {
			var oPtr reflect.Value
			if argType.Kind() != reflect.Ptr {
				oPtr = reflect.New(argType)
			} else {
				oPtr = reflect.New(argType.Elem())
			}
			if err := c.Enc.Decode(m.Subject, m.Data, oPtr.Interface()); err != nil {
				if c.Conn.Opts.AsyncErrorCB != nil {
					c.Conn.ach.push(func() {
						c.Conn.Opts.AsyncErrorCB(c.Conn, m.Sub, errors.New("nats: Got an error trying to unmarshal: "+err.Error()))
					})
				}
				return
			}
			if argType.Kind() != reflect.Ptr {
				oPtr = reflect.Indirect(oPtr)
			}

			// Callback Arity
			switch numArgs {
			case 1:
				oV = []reflect.Value{oPtr}
			case 2:
				subV := reflect.ValueOf(m.Subject)
				oV = []reflect.Value{subV, oPtr}
			case 3:
				subV := reflect.ValueOf(m.Subject)
				replyV := reflect.ValueOf(m.Reply)
				oV = []reflect.Value{subV, replyV, oPtr}
			}

		}
		cbValue.Call(oV)
	}

	return c.Conn.subscribe(subject, queue, natsCB, nil, nil, false, nil)
}

// FlushTimeout allows a Flush operation to have an associated timeout.
//
// Deprecated: Encoded connections are no longer supported.
func (c *EncodedConn) FlushTimeout(timeout time.Duration) (err error) {
	return c.Conn.FlushTimeout(timeout)
}

// Flush will perform a round trip to the server and return when it
// receives the internal reply.
//
// Deprecated: Encoded connections are no longer supported.
func (c *EncodedConn) Flush() error {
	return c.Conn.Flush()
}

// Close will close the connection to the server. This call will release
// all blocking calls, such as Flush(), etc.
//
// Deprecated: Encoded connections are no longer supported.
func (c *EncodedConn) Close() {
	c.Conn.Close()
}

// Drain will put a connection into a drain state. All subscriptions will
// immediately be put into a drain state. Upon completion, the publishers
// will be drained and can not publish any additional messages. Upon draining
// of the publishers, the connection will be closed. Use the ClosedCB()
// option to know when the connection has moved from draining to closed.
//
// Deprecated: Encoded connections are no longer supported.
func (c *EncodedConn) Drain() error {
	return c.Conn.Drain()
}

// LastError reports the last error encountered via the Connection.
//
// Deprecated: Encoded connections are no longer supported.
func (c *EncodedConn) LastError() error {
	return c.Conn.LastError()
}

```

### Core Architecture Module: `encoders/builtin/default_enc.go`
```
// Copyright 2012-2023 The NATS Authors
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

package builtin

import (
	"bytes"
	"fmt"
	"reflect"
	"strconv"
	"unsafe"
)

// DefaultEncoder implementation for EncodedConn.
// This encoder will leave []byte and string untouched, but will attempt to
// turn numbers into appropriate strings that can be decoded. It will also
// properly encoded and decode bools. If will encode a struct, but if you want
// to properly handle structures you should use JsonEncoder.
//
// Deprecated: Encoded connections are no longer supported.
type DefaultEncoder struct {
	// Empty
}

var trueB = []byte("true")
var falseB = []byte("false")
var nilB = []byte("")

// Encode
//
// Deprecated: Encoded connections are no longer supported.
func (je *DefaultEncoder) Encode(subject string, v any) ([]byte, error) {
	switch arg := v.(type) {
	case string:
		bytes := *(*[]byte)(unsafe.Pointer(&arg))
		return bytes, nil
	case []byte:
		return arg, nil
	case bool:
		if arg {
			return trueB, nil
		} else {
			return falseB, nil
		}
	case nil:
		return nilB, nil
	default:
		var buf bytes.Buffer
		fmt.Fprintf(&buf, "%+v", arg)
		return buf.Bytes(), nil
	}
}

// Decode
//
// Deprecated: Encoded connections are no longer supported.
func (je *DefaultEncoder) Decode(subject string, data []byte, vPtr any) error {
	// Figure out what it's pointing to...
	sData := *(*string)(unsafe.Pointer(&data))
	switch arg := vPtr.(type) {
	case *string:
		*arg = sData
		return nil
	case *[]byte:
		*arg = data
		return nil
	case *int:
		n, err := strconv.ParseInt(sData, 10, 64)
		if err != nil {
			return err
		}
		*arg = int(n)
		return nil
	case *int32:
		n, err := strconv.ParseInt(sData, 10, 64)
		if err != nil {
			return err
		}
		*arg = int32(n)
		return nil
	case *int64:
		n, err := strconv.ParseInt(sData, 10, 64)
		if err != nil {
			return err
		}
		*arg = int64(n)
		return nil
	case *float32:
		n, err := strconv.ParseFloat(sData, 32)
		if err != nil {
			return err
		}
		*arg = float32(n)
		return nil
	case *float64:
		n, err := strconv.ParseFloat(sData, 64)
		if err != nil {
			return err
		}
		*arg = float64(n)
		return nil
	case *bool:
		b, err := strconv.ParseBool(sData)
		if err != nil {
			return err
		}
		*arg = b
		return nil
	default:
		vt := reflect.TypeOf(arg).Elem()
		return fmt.Errorf("nats: Default Encoder can't decode to type %s", vt)
	}
}

```

### Core Architecture Module: `encoders/builtin/gob_enc.go`
```
// Copyright 2013-2023 The NATS Authors
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

package builtin

import (
	"bytes"
	"encoding/gob"
)

// GobEncoder is a Go specific GOB Encoder implementation for EncodedConn.
// This encoder will use the builtin encoding/gob to Marshal
// and Unmarshal most types, including structs.
//
// Deprecated: Encoded connections are no longer supported.
type GobEncoder struct {
	// Empty
}

// FIXME(dlc) - This could probably be more efficient.

// Encode
//
// Deprecated: Encoded connections are no longer supported.
func (ge *GobEncoder) Encode(subject string, v any) ([]byte, error) {
	b := new(bytes.Buffer)
	enc := gob.NewEncoder(b)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return b.Bytes(), nil
}

// Decode
//
// Deprecated: Encoded connections are no longer supported.
func (ge *GobEncoder) Decode(subject string, data []byte, vPtr any) (err error) {
	dec := gob.NewDecoder(bytes.NewBuffer(data))
	err = dec.Decode(vPtr)
	return
}

```

### Core Architecture Module: `encoders/builtin/json_enc.go`
```
// Copyright 2012-2023 The NATS Authors
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

package builtin

import (
	"encoding/json"
	"strings"
)

// JsonEncoder is a JSON Encoder implementation for EncodedConn.
// This encoder will use the builtin encoding/json to Marshal
// and Unmarshal most types, including structs.
//
// Deprecated: Encoded connections are no longer supported.
type JsonEncoder struct {
	// Empty
}

// Encode
//
// Deprecated: Encoded connections are no longer supported.
func (je *JsonEncoder) Encode(subject string, v any) ([]byte, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	return b, nil
}

// Decode
//
// Deprecated: Encoded connections are no longer supported.
func (je *JsonEncoder) Decode(subject string, data []byte, vPtr any) (err error) {
	switch arg := vPtr.(type) {
	case *string:
		// If they want a string and it is a JSON string, strip quotes
		// This allows someone to send a struct but receive as a plain string
		// This cast should be efficient for Go 1.3 and beyond.
		str := string(data)
		if strings.HasPrefix(str, `"`) && strings.HasSuffix(str, `"`) {
			*arg = str[1 : len(str)-1]
		} else {
			*arg = str
		}
	case *[]byte:
		*arg = data
	default:
		err = json.Unmarshal(data, arg)
	}
	return
}

```

### Core Architecture Module: `encoders/protobuf/protobuf_enc.go`
```
// Copyright 2015-2023 The NATS Authors
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

package protobuf

import (
	"errors"

	"github.com/nats-io/nats.go"
	"google.golang.org/protobuf/proto"
)

//lint:file-ignore SA1019 Ignore deprecation warnings for EncodedConn

// Additional index for registered Encoders.
const (
	PROTOBUF_ENCODER = "protobuf"
)

func init() {
	// Register protobuf encoder
	nats.RegisterEncoder(PROTOBUF_ENCODER, &ProtobufEncoder{})
}

// ProtobufEncoder is a protobuf implementation for EncodedConn
// This encoder will use the builtin protobuf lib to Marshal
// and Unmarshal structs.
//
// Deprecated: Encoded connections are no longer supported.
type ProtobufEncoder struct {
	// Empty
}

var (
	ErrInvalidProtoMsgEncode = errors.New("nats: Invalid protobuf proto.Message object passed to encode")
	ErrInvalidProtoMsgDecode = errors.New("nats: Invalid protobuf proto.Message object passed to decode")
)

// Encode
//
// Deprecated: Encoded connections are no longer supported.
func (pb *ProtobufEncoder) Encode(subject string, v any) ([]byte, error) {
	if v == nil {
		return nil, nil
	}
	i, found := v.(proto.Message)
	if !found {
		return nil, ErrInvalidProtoMsgEncode
	}

	b, err := proto.Marshal(i)
	if err != nil {
		return nil, err
	}
	return b, nil
}

// Decode
//
// Deprecated: Encoded connections are no longer supported.
func (pb *ProtobufEncoder) Decode(subject string, data []byte, vPtr any) error {
	if _, ok := vPtr.(*any); ok {
		return nil
	}
	i, found := vPtr.(proto.Message)
	if !found {
		return ErrInvalidProtoMsgDecode
	}

	return proto.Unmarshal(data, i)
}

```

### Core Architecture Module: `examples/jetstream/js-consume/main.go`
```
// Copyright 2022-2023 The NATS Authors
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

package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Minute)
	defer cancel()

	nc, err := nats.Connect("nats://127.0.0.1:4222")
	if err != nil {
		log.Fatal(err)
	}

	js, err := jetstream.New(nc)
	if err != nil {
		log.Fatal(err)
	}
	s, err := js.CreateStream(ctx, jetstream.StreamConfig{
		Name:     "TEST_STREAM",
		Subjects: []string{"FOO.*"},
	})
	if err != nil {
		log.Fatal(err)
	}

	cons, err := s.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{
		Durable:   "TestConsumerConsume",
		AckPolicy: jetstream.AckExplicitPolicy,
	})
	if err != nil {
		log.Fatal(err)
	}
	go endlessPublish(ctx, nc, js)

	cc, err := cons.Consume(func(msg jetstream.Msg) {
		fmt.Println(string(msg.Data()))
		msg.Ack()
	}, jetstream.ConsumeErrHandler(func(consumeCtx jetstream.ConsumeContext, err error) {
		fmt.Println(err)
	}))
	if err != nil {
		log.Fatal(err)
	}
	defer cc.Stop()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig

}

func endlessPublish(ctx context.Context, nc *nats.Conn, js jetstream.JetStream) {
	var i int
	for {
		time.Sleep(500 * time.Millisecond)
		if nc.Status() != nats.CONNECTED {
			continue
		}
		if _, err := js.Publish(ctx, "FOO.TEST1", []byte(fmt.Sprintf("msg %d", i))); err != nil {
			fmt.Println("pub error: ", err)
		}
		i++
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1370** (2024-01-12): **JetStream OrderedConsumer fails to Consume messages upon reconnecting**
  *Symptoms*: ## Defect JetStream OrderedConsumer fails to reconnect upon hard reset on NATs server. Looking at the GoLang package [here](https://github.com/nats-io/nats.go/blob/e2ac73b92f5baae9aff730a65a8d8cee9d069e4c/jetstream/ordered.go#L138), it feels like we should add a conditional check if the err received from the server is "Consumer not found" err so we can perform a "reset" on the client which then recreates the Consumer for processing.   Have a Slack channel going [here](https://natsio.slack.com/archives/CM3T6T7JQ/p1692318754831879).  Make sure that these boxes are checked before submitting your issue -- thank you!   - [x] Included nats.go version  - [x] Included a [Minimal, Complete, and Verifiable example] (https://stackoverflow.com/help/mcve)  #### Versions of `nats.go` and the `nats-server` if one was involved: nats.go: 1.28.0 nats-server:  2.9.21  #### OS/Container environment: Kubernetes Minikube Cluster. GoLang Linux  #### Steps or code to reproduce the issue: 1. Create Jetstream 2. Send messages to Stream 3. Create Ordered Consumer 4. Hard restart NATs server (Kill/restart pod) 5. Observe the client reconnect handler successfully reconnects 6. Consumer attempts to process messages but fails with "Consumer not found" error  #### Expected result: Expect OrderedConsumer to recreate the Consumer and continue processing messages where it had left off  before the NATs server restarted.  #### Actual result: Consumer fails to "reset" and fails to co

- **Issue #1369** (2023-08-26): **stream.CreateOrUpdateConsumer with FilterSubjects error**
  *Symptoms*:    nats.go version v1.28.0   nats-server version  2.9.21-beta  code : 	cons, err := stream.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{ 		Durable:           durable, 		AckPolicy:         jetstream.AckExplicitPolicy, 		FilterSubjects: []string{"foo.p1.p2"}, // has erro. get foo.u1 subject messags 		// FilterSubject:    "foo.p1.p2", // this works ok  	})   cmd: nats pub foo.u1 msg1   use FilterSubjects: []string{"foo.p1.p2"} for subject, I get foo.u1 messags. but use FilterSubject:    "foo.p1.p2", It works ok, not get foo.u1 messags.   
  **Post-Mortem & Fix Analysis**:
  > Hey @elkmi , thanks for submitting the issue. Unfortunately `FilterSubjects` will only be available as an option in nats-server v2.10.0. This field was already added in `nats.go`, but for now you will have to use `FilterSubject`.

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

### Incident Patch 1: `febd2b97` (2026-11-17)
**Commit Message**: [FIXED] Cap StreamState NumDeleted at MaxInt when decoding

On 32-bit platforms int is 32 bits, so stream info with more than 2^31
interior deletes (e.g. MaxMsgsPerSubject=1 with heavy churn) fails to
decode and Stream()/StreamInfo() return an error.

Keep NumDeleted an int and add a custom UnmarshalJSON on StreamState,
in both jetstream and the legacy nats package, that decodes num_deleted
as int64 and caps it to the range of int. Nothing changes on 64-bit
platforms. On 32-bit platforms values beyond the range of int are
reported as math.MaxInt, which is documented on the field.

Resolves #2230

Signed-off-by: Sven Neumann <[REDACTED_EMAIL]>

**File**: `jetstream/stream_config.go` (modified, +31/-0)
```diff
@@ -17,6 +17,7 @@ import (
 	"encoding/json"
 	"errors"
 	"fmt"
+	"math"
 	"strings"
 	"time"
 )
@@ -294,6 +295,10 @@ type (
 		// stream. Only deleted messages causing a gap in stream sequence numbers
 		// are counted. Messages deleted at the beginning or end of the stream
 		// are not counted.
+		//
+		// The value is capped at math.MaxInt when decoded. This only matters
+		// on 32-bit platforms, where int cannot hold every value the server
+		// can report.
 		NumDeleted int `json:"num_deleted"`
 
 		// NumSubjects is the number of unique subjects the stream has received
@@ -864,3 +869,29 @@ func (alg *StoreCompression) UnmarshalJSON(b []byte) error {
 	}
 	return nil
 }
+
+// UnmarshalJSON decodes num_deleted as an int64 and caps it to the range of
+// int. On 32-bit platforms a stream can have more interior deletes than int
+// can hold, which would otherwise fail decoding of the whole stream info.
+func (s *StreamState) UnmarshalJSON(data []byte) error {
+	type streamState StreamState
+	aux := struct {
+		*streamState
+		NumDeleted int64 `json:"num_deleted"`
+	}{
+		streamState: (*streamState)(s),
+		NumDeleted:  int64(s.NumDeleted),
+	}
+	if err := json.Unmarshal(data, &aux); err != nil {
+		return err
+	}
+	switch {
+	case aux.NumDeleted > math.MaxInt:
+		s.NumDeleted = math.MaxInt
+	case aux.NumDeleted < math.MinInt:
+		s.NumDeleted = math.MinInt
+	default:
+		s.NumDeleted = int(aux.NumDeleted)
+	}
+	return nil
+}
```

**File**: `jetstream/stream_config_test.go` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+// Copyright 2026 The NATS Authors
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+// http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package jetstream
+
+import (
+	"encoding/json"
+	"fmt"
+	"math"
+	"testing"
+)
+
+// On 32-bit platforms int cannot hold every num_deleted value the server can
+// report (e.g. for a stream with MaxMsgsPerSubject=1 and heavy churn). Such
+// values must be capped at math.MaxInt instead of failing to decode.
+func TestStreamStateNumDeletedOverflow(t *testing.T) {
+	tests := []struct {
+		name       string
+		numDeleted int64
+	}{
+		{name: "zero", numDeleted: 0},
+		{name: "max int32", numDeleted: math.MaxInt32},
+		{name: "above int32", numDeleted: 1 << 32},
+		{name: "max int64", numDeleted: math.MaxInt64},
+		{name: "negative", numDeleted: -1},
+		{name: "below int32", numDeleted: -(1 << 32)},
+	}
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			data := fmt.Appendf(nil, `{"messages":5,"last_seq":10,"consumer_count":3,"num_deleted":%d,"deleted":[2,4]}`, test.numDeleted)
+
+			var state StreamState
+			if err := json.Unmarshal(data, &state); err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+
+			want := test.numDeleted
+			if want > math.MaxInt {
+				want = math.MaxInt
+			} else if want < math.MinInt {
+				want = math.MinInt
+			}
+			if int64(state.NumDeleted) != want {
+				t.Fatalf("Invalid NumDeleted; want: %d; got: %d", want, state.NumDeleted)
+			}
+			if state.Msgs != 5 || state.LastSeq != 10 || state.Consumers != 3 || len(state.Deleted) != 2 {
+				t.Fatalf("Other fields not decoded correctly: %+v", state)
+			}
+		})
+	}
+
+	// A response without num_deleted leaves the field untouched, as for any
+	// other field.
+	state := StreamState{NumDeleted: 7}
+	if err := json.Unmarshal([]byte(`{"messages":1}`), &state); err != nil {
+		t.Fatalf("Unexpected error: %v", err)
+	}
+	if state.NumDeleted != 7 || state.Msgs != 1 {
+		t.Fatalf("Unexpected state: %+v", state)
+	}
+}
```

**File**: `jsm.go` (modified, +30/-0)
```diff
@@ -18,6 +18,7 @@ import (
 	"encoding/json"
 	"errors"
 	"fmt"
+	"math"
 	"strconv"
 	"strings"
 	"time"
@@ -1079,6 +1080,9 @@ type StreamSourceInfo struct {
 }
 
 // StreamState is information about the given stream.
+//
+// NumDeleted is capped at math.MaxInt when decoded. This only matters on
+// 32-bit platforms, where int cannot hold every value the server can report.
 type StreamState struct {
 	Msgs        uint64            `json:"messages"`
 	Bytes       uint64            `json:"bytes"`
@@ -1093,6 +1097,32 @@ type StreamState struct {
 	Subjects    map[string]uint64 `json:"subjects"`
 }
 
+// UnmarshalJSON decodes num_deleted as an int64 and caps it to the range of
+// int. On 32-bit platforms a stream can have more interior deletes than int
+// can hold, which would otherwise fail decoding of the whole stream info.
+func (s *StreamState) UnmarshalJSON(data []byte) error {
+	type streamState StreamState
+	aux := struct {
+		*streamState
+		NumDeleted int64 `json:"num_deleted"`
+	}{
+		streamState: (*streamState)(s),
+		NumDeleted:  int64(s.NumDeleted),
+	}
+	if err := json.Unmarshal(data, &aux); err != nil {
+		return err
+	}
+	switch {
+	case aux.NumDeleted > math.MaxInt:
+		s.NumDeleted = math.MaxInt
+	case aux.NumDeleted < math.MinInt:
+		s.NumDeleted = math.MinInt
+	default:
+		s.NumDeleted = int(aux.NumDeleted)
+	}
+	return nil
+}
+
 // ClusterInfo shows information about the underlying set of servers
 // that make up the stream or consumer.
 type ClusterInfo struct {
```

**File**: `nats_test.go` (modified, +51/-0)
```diff
@@ -29,6 +29,7 @@ import (
 	"encoding/json"
 	"errors"
 	"fmt"
+	"math"
 	"math/big"
 	"net"
 	"net/url"
@@ -2279,3 +2280,53 @@ func TestSetServerPoolTLSURLKeepsState(t *testing.T) {
 		}
 	})
 }
+
+// On 32-bit platforms int cannot hold every num_deleted value the server can
+// report (e.g. for a stream with MaxMsgsPerSubject=1 and heavy churn). Such
+// values must be capped at math.MaxInt instead of failing to decode.
+func TestStreamStateNumDeletedOverflow(t *testing.T) {
+	tests := []struct {
+		name       string
+		numDeleted int64
+	}{
+		{name: "zero", numDeleted: 0},
+		{name: "max int32", numDeleted: math.MaxInt32},
+		{name: "above int32", numDeleted: 1 << 32},
+		{name: "max int64", numDeleted: math.MaxInt64},
+		{name: "negative", numDeleted: -1},
+		{name: "below int32", numDeleted: -(1 << 32)},
+	}
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			data := fmt.Appendf(nil, `{"messages":5,"last_seq":10,"consumer_count":3,"num_deleted":%d,"deleted":[2,4]}`, test.numDeleted)
+
+			var state StreamState
+			if err := json.Unmarshal(data, &state); err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+
+			want := test.numDeleted
+			if want > math.MaxInt {
+				want = math.MaxInt
+			} else if want < math.MinInt {
+				want = math.MinInt
+			}
+			if int64(state.NumDeleted) != want {
+				t.Fatalf("Invalid NumDeleted; want: %d; got: %d", want, state.NumDeleted)
+			}
+			if state.Msgs != 5 || state.LastSeq != 10 || state.Consumers != 3 || len(state.Deleted) != 2 {
+				t.Fatalf("Other fields not decoded correctly: %+v", state)
+			}
+		})
+	}
+
+	// A response without num_deleted leaves the field untouched, as for any
+	// other field.
+	state := StreamState{NumDeleted: 7}
+	if err := json.Unmarshal([]byte(`{"messages":1}`), &state); err != nil {
+		t.Fatalf("Unexpected error: %v", err)
+	}
+	if state.NumDeleted != 7 || state.Msgs != 1 {
+		t.Fatalf("Unexpected state: %+v", state)
+	}
+}
```

---

### Incident Patch 2: `8490a898` (2026-10-30)
**Commit Message**: [CHANGED] Require TLS when a TLS configuration is set

Signed-off-by: Piotr Piotrowski <[REDACTED_EMAIL]>

**File**: `nats.go` (modified, +40/-2)
```diff
@@ -354,7 +354,8 @@ type Options struct {
 	Secure bool
 
 	// TLSConfig is a custom TLS configuration to use for secure
-	// transports.
+	// transports. Setting it, RootCAsCB or TLSCertCB asks for TLS with
+	// every server, as Secure does.
 	TLSConfig *tls.Config
 
 	// TLSCertCB is used to fetch and return custom tls certificate.
@@ -693,6 +694,8 @@ type Conn struct {
 	ar            bool // abort reconnect
 	rqch          chan struct{}
 	ws            bool // true if a websocket connection
+	// tlsReason says what made the client ask for TLS.
+	tlsReason string
 
 	// New style response handler
 	respSub       string               // The wildcard subject
@@ -2025,12 +2028,19 @@ func (o Options) Connect() (*Conn, error) {
 		}
 	}
 
+	nc.tlsReason = nc.Opts.tlsReason()
+
 	// If the TLSHandshakeFirst option is specified, make sure that
 	// the Secure boolean is true.
 	if nc.Opts.TLSHandshakeFirst {
 		nc.Opts.Secure = true
 	}
 
+	// A TLS configuration asks for TLS.
+	if nc.Opts.TLSConfig != nil || nc.Opts.RootCAsCB != nil || nc.Opts.TLSCertCB != nil {
+		nc.Opts.Secure = true
+	}
+
 	if err := nc.setupServerPool(); err != nil {
 		return nil, err
 	}
@@ -2217,6 +2227,9 @@ func (nc *Conn) setupServerPool() error {
 		if srv.URL.Scheme == tlsScheme || srv.URL.Scheme == wsSchemeTLS {
 			// FIXME(dlc), this is for all in the pool, should be case by case.
 			nc.Opts.Secure = true
+			if nc.tlsReason == _EMPTY_ {
+				nc.tlsReason = fmt.Sprintf("the URL %s://%s asks for TLS", srv.URL.Scheme, srv.URL.Host)
+			}
 			if nc.Opts.TLSConfig == nil {
 				nc.Opts.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12}
 			}
@@ -3063,6 +3076,27 @@ func (nc *Conn) connect() (bool, error) {
 	return connectionEstablished, err
 }
 
+// tlsReason names the setting that asks for TLS, if any. Secure comes before
+// the TLS fields because the options that set it fill in TLSConfig too.
+func (o *Options) tlsReason() string {
+	var name string
+	switch {
+	case o.TLSHandshakeFirst:
+		name = "TLSHandshakeFirst"
+	case o.Secure:
+		name = "Secure (set by Secure, RootCAs, ClientCert or ClientTLSConfig)"
+	case o.TLSConfig != nil:
+		name = "TLSConfig"
+	case o.RootCAsCB != nil:
+		name = "RootCAsCB"
+	case o.TLSCertCB != nil:
+		name = "TLSCertCB"
+	default:
+		return _EMPTY_
+	}
+	return name + " asks for TLS"
+}
+
 // This will check to see if the connection should be
 // secure. This can be dictated from either end and should
 // only be called after the INIT protocol has been received.
@@ -3072,7 +3106,11 @@ func (nc *Conn) checkForSecure() error {
 
 	// Check for mismatch in setups
 	if o.Secure && !nc.info.TLSRequired && !nc.info.TLSAvailable {
-		return ErrSecureConnWanted
+		host := nc.current.URL.Host
+		if o.InProcessServer != nil {
+			host = "the in-process server"
+		}
+		return fmt.Errorf("%w: %s and %s does not offer it", ErrSecureConnWanted, nc.tlsReason, host)
 	} else if nc.info.TLSRequired && !o.Secure {
 		// Switch to Secure since server needs TLS.
 		o.Secure = true
```

**File**: `test/conn_test.go` (modified, +202/-1)
```diff
@@ -230,7 +230,7 @@ func TestServerSecureConnections(t *testing.T) {
 	t.Cleanup(func() { dInst.Destroy(t) })
 
 	nc, err = nats.Connect(dInst.Servers[0].URL, nats.Secure(), nats.RootCAs(caPath))
-	if err == nil || nc != nil || err != nats.ErrSecureConnWanted {
+	if err == nil || nc != nil || !errors.Is(err, nats.ErrSecureConnWanted) {
 		if nc != nil {
 			nc.Close()
 		}
@@ -587,6 +587,207 @@ func TestServerTLSHintConnections(t *testing.T) {
 	defer nc.Close()
 }
 
+// A TLS configuration keeps asking for TLS on reconnect: once the TLS server
+// is gone, a server without TLS is refused before CONNECT.
+func TestTLSConfigAsksForTLSOnReconnect(t *testing.T) {
+	c := newTester(t)
+	inst := c.CreateServer(t, false, managedTLSOpts(t, testservice.TLSServerOnly()))
+	t.Cleanup(func() { inst.Destroy(t) })
+	cfg, err := testservice.TLSConfig(inst)
+	if err != nil {
+		t.Fatalf("Error on TLS config: %v", err)
+	}
+	connects := make(chan string, 1)
+	plain := newFakeServer(t, recordConnects(connects))
+
+	nc, err := nats.Connect(
+		"nats://"+hostPortFromURL(inst.Servers[0].URL)+",nats://"+plain.addr(),
+		nats.DontRandomize(),
+		nats.ReconnectWait(10*time.Millisecond),
+		nats.ReconnectJitter(0, 0),
+		func(o *nats.Options) error {
+			o.TLSConfig = cfg
+			return nil
+		},
+	)
+	if err != nil {
+		t.Fatalf("Error on connect: %v", err)
+	}
+	defer nc.Close()
+	if _, err := nc.TLSConnectionState(); err != nil {
+		t.Fatalf("Expected a TLS connection, got: %v", err)
+	}
+
+	inst.StopServer(t, inst.Servers[0])
+	select {
+	case c := <-connects:
+		t.Fatalf("CONNECT sent without TLS on reconnect: %s", c)
+	case <-time.After(time.Second):
+	}
+}
+
+// A TLS configuration asks for TLS with a discovered server too: once the TLS
+// server that listed it is gone, a server without TLS is refused before CONNECT.
+func TestTLSConfigAsksForTLSWithDiscoveredServer(t *testing.T) {
+	connects := make(chan string, 1)
+	redialed := make(chan struct{})
+	var dials atomic.Int32
+	plain := newFakeServer(t, func(conn net.Conn) {
+		if dials.Add(1) == 2 {
+			close(redialed)
+		}
+		recordConnects(connects)(conn)
+	})
+	cfg := fakeTLSConfig(t)
+	srv := newFakeServer(t, func(conn net.Conn) {
+		conn.Write(fakeInfoWith(map[string]any{"tls_required": true}))
+		tc := tls.Server(conn, cfg)
+		if tc.Handshake() != nil {
+			return
+		}
+		// Servers send the list inside TLS, after the first PONG.
+		serveProto(tc, func(line string) {
+			if line == "PING" {
+				tc.Write(fakeInfoWith(map[string]any{"tls_required": true}, plain.addr()))
+				tc.Close()
+			}
+		})
+	})
+	ca, err := os.ReadFile("./configs/certs/ca.pem")
+	if err != nil {
+		t.Fatalf("Error reading the CA: %v", err)
+	}
+	pool := x509.NewCertPool()
+	pool.AppendCertsFromPEM(ca)
+	nc, err := nats.Connect("nats://"+srv.addr(),
+		nats.ReconnectWait(10*time.Millisecond),
+		nats.ReconnectJitter(0, 0),
+		func(o *nats.Options) error {
+			o.TLSConfig = &tls.Config{RootCAs: pool}
+			return nil
+		},
+	)
+	if err != nil {
+		t.Fatalf("Error on connect: %v", err)
+	}
+	defer nc.Close()
+	// A second dial means the first attempt ended without CONNECT.
+	select {
+	case c := <-connects:
+		t.Fatalf("CONNECT sent without TLS to discovered server %s: %s", plain.addr(), c)
+	case <-redialed:
+	case <-time.After(5 * time.Second):
+		t.Fatalf("Client did not retry %s", plain.addr())
+	}
+}
+
+// dialInProcess is an InProcessConnProvider that dials the given address.
+type dialInProcess string
+
+func (a dialInProcess) InProcessConn() (net.Conn, error) {
+	return net.Dial("tcp", string(a))
+}
+
+// A TLS configuration asks for TLS: a server without TLS is refused before
+// CONNECT, and a server that only offers TLS is upgraded.
+func TestTLSConfigAsksForTLS(t *testing.T) {
+	pool := x509.NewCertPool()
+	for _, test := range []struct {
+		name string
+		set  nats.Option
+	}{
+		{"TLSConfig", func(o *nats.Options) error {
+			o.TLSConfig = &tls.Config{RootCAs: pool}
+			return nil
+		}},
+		{"RootCAsCB", func(o *nats.Options) error {
+			o.RootCAsCB = func() (*x509.CertPool, error) { return pool, nil }
+			return nil
+		}},
+		{"TLSCertCB", func(o *nats.Options) error {
+			o.TLSCertCB = func() (tls.Certificate, error) { return tls.Certificate{}, nil }
+			return nil
+		}},
+	} {
+		t.Run(test.name+" without TLS", func(t *testing.T) {
+			connects := make(chan string, 1)
+			srv := newFakeServer(t, recordConnects(connects))
+			nc, err := nats.Connect("nats://"+srv.addr(), test.set)
+			if err == nil {
+				nc.Close()
+			}
+			select {
+			case c := <-connects:
+				t.Fatalf("CONNECT sent without TLS: %s", c)
+			default:
+			}
+			if !errors.Is(err, nats.ErrSecureConnWanted) {
+				t.Fatalf("Expected %v, got: %v", nats.ErrSecureConnWanted, err)
+			}
+			if want := test.name + " asks for TLS and " + srv.addr() + " does not offer it"; !strings.Contains(err.Error(), want) {
+				t.Fatalf("Expected the error to say %q, got: %v", want, err)
+			}
+		})
+	}
+
+	// These options fill in TLSConf
```

**File**: `test/helper_test.go` (modified, +16/-0)
```diff
@@ -15,6 +15,7 @@ package test
 
 import (
 	"bufio"
+	"crypto/tls"
 	"encoding/json"
 	"errors"
 	"fmt"
@@ -229,6 +230,21 @@ func fakeInfoWith(extra map[string]any, connectURLs ...string) []byte {
 	return []byte(fmt.Sprintf("INFO %s\r\n", b))
 }
 
+// fakeTLSConfig is the server side of the test certificate that carries both
+// localhost and 127.0.0.1.
+func fakeTLSConfig(t *testing.T) *tls.Config {
+	return fakeTLSConfigFrom(t, "./configs/certs/server.pem", "./configs/certs/key.pem")
+}
+
+func fakeTLSConfigFrom(t *testing.T, certFile, keyFile string) *tls.Config {
+	t.Helper()
+	cert, err := tls.LoadX509KeyPair(certFile, keyFile)
+	if err != nil {
+		t.Fatalf("Could not load the server certificate: %v", err)
+	}
+	return &tls.Config{Certificates: []tls.Certificate{cert}}
+}
+
 // serveProto answers every PING on conn with PONG and passes each line,
 // without its line ending, to onLine, until the connection ends.
 func serveProto(conn net.Conn, onLine func(line string)) {
```

---

### Incident Patch 3: `6b33b5ab` (2026-10-30)
**Commit Message**: [FIXED] Use the reporting server's credentials for discovered servers

Signed-off-by: Piotr Piotrowski <[REDACTED_EMAIL]>

**File**: `nats.go` (modified, +6/-5)
```diff
@@ -2271,11 +2271,8 @@ func (nc *Conn) parseServerURL(sURL string, implicit, saveTLSName bool) (*Server
 	var tlsName string
 	if implicit {
 		curl := nc.current.URL
-		// Check to see if we do not have a url.User but current connected
-		// url does. If so copy over.
-		if u.User == nil && curl.User != nil {
-			u.User = curl.User
-		}
+		// Use the reporting server's credentials, never the entry's own.
+		u.User = curl.User
 		// We are checking to see if we have a secure connection and are
 		// adding an implicit server that just has an IP. If so we will remember
 		// the current hostname we are connected to. If we are connected to an
@@ -4349,6 +4346,10 @@ func (nc *Conn) processInfo(info string) error {
 	// Transform that to a map for easy lookups
 	tmp := make(map[string]struct{}, len(urls))
 	for _, curl := range urls {
+		// An entry is matched by its address; its user info is never used.
+		if at := strings.LastIndex(curl, "@"); at >= 0 {
+			curl = curl[at+1:]
+		}
 		tmp[curl] = struct{}{}
 	}
 	// Walk the pool and removed the implicit servers that are no longer in the
```

**File**: `test/cluster_test.go` (modified, +119/-0)
```diff
@@ -14,6 +14,8 @@
 package test
 
 import (
+	"bufio"
+	"encoding/json"
 	"errors"
 	"fmt"
 	"math"
@@ -1038,3 +1040,120 @@ func TestIgnoreDiscoveredServers(t *testing.T) {
 		}
 	})
 }
+
+// An entry with user info is the same server on every INFO, so the failures
+// to reach it count toward MaxReconnects.
+func TestUserInfoEntryCountsTowardMaxReconnects(t *testing.T) {
+	// b lists itself with a token in front and refuses every CONNECT.
+	b := newFakeServer(t, func(conn net.Conn) {
+		conn.Write(fakeInfo("tok@" + conn.LocalAddr().String()))
+		serveProto(conn, func(line string) {
+			if strings.HasPrefix(line, "CONNECT ") {
+				conn.Write([]byte("-ERR 'Authorization Violation'\r\n"))
+				conn.Close()
+			}
+		})
+	})
+	a := newFakeServer(t, func(conn net.Conn) {
+		conn.Write(fakeInfo("tok@" + b.addr()))
+		serveProto(conn, nil)
+	})
+	closed := make(chan struct{})
+	nc, err := nats.Connect("nats://"+a.addr(),
+		nats.MaxReconnects(3),
+		nats.ReconnectWait(10*time.Millisecond),
+		nats.ReconnectJitter(0, 0),
+		nats.ClosedHandler(func(*nats.Conn) { close(closed) }))
+	if err != nil {
+		t.Fatalf("Error on connect: %v", err)
+	}
+	defer nc.Close()
+	a.close()
+	select {
+	case <-closed:
+	case <-time.After(5 * time.Second):
+		t.Fatal("Client kept reconnecting past MaxReconnects")
+	}
+}
+
+// A discovered server is dialed with the credentials the client uses for the
+// server that reported it; user info in the connect_urls entry itself is
+// dropped.
+func TestDiscoveredServerCredentials(t *testing.T) {
+	for _, test := range []struct {
+		name string
+		url  string
+		opts []nats.Option
+		// userInfo is written in front of the discovered server's entry.
+		userInfo string
+		// relist makes the reporting server list the discovered server a
+		// second time, without user info.
+		relist           bool
+		user, pass, auth string
+	}{
+		{name: "credentials in URL", url: "nats://alice:secret@%s", userInfo: "bob:pw@", user: "alice", pass: "secret"},
+		{name: "credentials in options", url: "nats://%s", opts: []nats.Option{nats.UserInfo("alice", "secret")}, userInfo: "bob:pw@", user: "alice", pass: "secret"},
+		{name: "token in options", url: "nats://%s", opts: []nats.Option{nats.Token("tok")}, userInfo: "other@", auth: "tok"},
+		{name: "no credentials", url: "nats://%s", userInfo: "bob:pw@"},
+		{name: "plain entry, credentials in URL", url: "nats://alice:secret@%s", user: "alice", pass: "secret"},
+		{name: "plain entry, token in URL", url: "nats://tok@%s", auth: "tok"},
+		{name: "empty user info", url: "nats://alice:secret@%s", userInfo: "@", user: "alice", pass: "secret"},
+		{name: "user info that does not parse", url: "nats://alice:secret@%s", userInfo: "%zz@", user: "alice", pass: "secret"},
+		{name: "token handler", url: "nats://%s", opts: []nats.Option{nats.TokenHandler(func() string { return "tok" })}, userInfo: "other@", auth: "tok"},
+		{name: "user JWT", url: "nats://%s", opts: []nats.Option{nats.UserJWT(
+			func() (string, error) { return "jwt", nil },
+			func([]byte) ([]byte, error) { return []byte("sig"), nil })}, userInfo: "other@"},
+		{name: "entry listed again without user info", url: "nats://alice:secret@%s", userInfo: "bob:pw@", relist: true, user: "alice", pass: "secret"},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			connects := make(chan string, 1)
+			b := newFakeServer(t, recordConnects(connects))
+			// a reports b, then drops the client after its first PING.
+			a := newFakeServer(t, func(conn net.Conn) {
+				conn.Write(fakeInfo(test.userInfo + b.addr()))
+				br := bufio.NewReader(conn)
+				for {
+					line, err := br.ReadString('\n')
+					if err != nil {
+						return
+					}
+					if strings.HasPrefix(line, "PING") {
+						conn.Write([]byte("PONG\r\n"))
+						if test.relist {
+							conn.Write(fakeInfo(b.addr()))
+						}
+						return
+					}
+				}
+			})
+
+			opts := append([]nats.Option{
+				nats.ReconnectWait(10 * time.Millisecond),
+				nats.ReconnectJitter(0, 0),
+			}, test.opts...)
+			nc, err := nats.Connect(fmt.Sprintf(test.url, a.addr()), opts...)
+			if err != nil {
+				t.Fatalf("Error on connect: %v", err)
+			}
+			defer nc.Close()
+
+			var connect struct {
+				User string `json:"user"`
+				Pass string `json:"pass"`
+				Auth string `json:"auth_token"`
+			}
+			select {
+			case c := <-connects:
+				if err := json.Unmarshal([]byte(c), &connect); err != nil {
+					t.Fatalf("Invalid CONNECT %q: %v", c, err)
+				}
+			case <-time.After(5 * time.Second):
+				t.Fatal("Client did not connect to the discovered server")
+			}
+			if connect.User != test.user || connect.Pass != test.pass || connect.Auth != test.auth {
+				t.Fatalf("Discovered server got user %q pass %q token %q, expected user %q pass %q token %q",
+					connect.User, connect.Pass, connect.Auth, test.user, test.pass, test.auth)
+			}
+		})
+	}
+}
```

**File**: `test/helper_test.go` (modified, +120/-0)
```diff
@@ -14,10 +14,15 @@
 package test
 
 import (
+	"bufio"
+	"encoding/json"
 	"errors"
 	"fmt"
+	"maps"
+	"net"
 	"runtime"
 	"strings"
+	"sync"
 	"testing"
 	"time"
 )
@@ -143,3 +148,118 @@ func checkFor(t *testing.T, totalWait, sleepDur time.Duration, f func() error) {
 	t.Helper()
 	waitFor(t, totalWait, sleepDur, f)
 }
+
+// fakeServer is a local listener that hands every accepted connection to
+// handle, for tests that script the server side of the protocol.
+type fakeServer struct {
+	ln   net.Listener
+	port int
+
+	mu    sync.Mutex
+	conns map[net.Conn]struct{}
+}
+
+func newFakeServer(t *testing.T, handle func(net.Conn)) *fakeServer {
+	t.Helper()
+	ln, err := net.Listen("tcp", "127.0.0.1:0")
+	if err != nil {
+		t.Fatalf("Could not listen: %v", err)
+	}
+	fs := &fakeServer{
+		ln:    ln,
+		port:  ln.Addr().(*net.TCPAddr).Port,
+		conns: make(map[net.Conn]struct{}),
+	}
+	t.Cleanup(fs.close)
+	go func() {
+		for {
+			conn, err := ln.Accept()
+			if err != nil {
+				return
+			}
+			fs.mu.Lock()
+			fs.conns[conn] = struct{}{}
+			fs.mu.Unlock()
+			go func() {
+				defer fs.drop(conn)
+				handle(conn)
+			}()
+		}
+	}()
+	return fs
+}
+
+func (fs *fakeServer) addr() string {
+	return fmt.Sprintf("127.0.0.1:%d", fs.port)
+}
+
+func (fs *fakeServer) drop(conn net.Conn) {
+	fs.mu.Lock()
+	delete(fs.conns, conn)
+	fs.mu.Unlock()
+	conn.Close()
+}
+
+func (fs *fakeServer) close() {
+	fs.ln.Close()
+	fs.mu.Lock()
+	defer fs.mu.Unlock()
+	for conn := range fs.conns {
+		conn.Close()
+	}
+}
+
+func fakeInfo(connectURLs ...string) []byte {
+	return fakeInfoWith(nil, connectURLs...)
+}
+
+// fakeInfoWith is fakeInfo with extra fields added or overridden.
+func fakeInfoWith(extra map[string]any, connectURLs ...string) []byte {
+	info := map[string]any{
+		"server_id":   "FAKE",
+		"proto":       1,
+		"headers":     true,
+		"max_payload": 1048576,
+	}
+	if len(connectURLs) > 0 {
+		info["connect_urls"] = connectURLs
+	}
+	maps.Copy(info, extra)
+	b, _ := json.Marshal(info)
+	return []byte(fmt.Sprintf("INFO %s\r\n", b))
+}
+
+// serveProto answers every PING on conn with PONG and passes each line,
+// without its line ending, to onLine, until the connection ends.
+func serveProto(conn net.Conn, onLine func(line string)) {
+	br := bufio.NewReader(conn)
+	for {
+		line, err := br.ReadString('\n')
+		if err != nil {
+			return
+		}
+		line = strings.TrimRight(line, "\r\n")
+		if line == "PING" {
+			conn.Write([]byte("PONG\r\n"))
+		}
+		if onLine != nil {
+			onLine(line)
+		}
+	}
+}
+
+// recordConnects serves a plaintext server that reports the payload of every
+// CONNECT on connects, dropping it when nobody is waiting.
+func recordConnects(connects chan<- string) func(net.Conn) {
+	return func(conn net.Conn) {
+		conn.Write(fakeInfo())
+		serveProto(conn, func(line string) {
+			if strings.HasPrefix(line, "CONNECT ") {
+				select {
+				case connects <- strings.TrimSpace(line[len("CONNECT "):]):
+				default:
+				}
+			}
+		})
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #2246** (2026-11-17): Release v1.56.0 (@piotrpio)
- **PR #2245** (2026-11-17): [CHANGED] Fixes for TLS and server discovery (@piotrpio)
- **PR #2243** (2026-11-16): [IMPROVED] Bump ntf-client to v0.0.5 to fix nightly tester failures (@piotrpio)
- **PR #2242** (2026-11-15): docs: remove duplicated word in MemoryMaxStreamBytes comment (@ninglinLiu)
- **PR #2237** (2026-11-12): [FIXED] Require a separator before inline header status (@ViktorBystrov72)
- **PR #2233** (2026-11-08): [IMPROVED] Remove stale go.mod version notes from docs (@nik-6174)

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

## X. [FIXED] Cap StreamState NumDeleted at MaxInt when decoding

**RULE**:
When implementing operations in `jetstream/stream_config.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nats-io/nats.go. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `febd2b97`: [FIXED] Cap StreamState NumDeleted at MaxInt when decoding. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `jetstream/stream_config.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"math"
		//
		// The value is capped at math.MaxInt when decoded. This only matters
		// on 32-bit platforms, where int cannot hold every value the server
		// can report.

// UnmarshalJSON decodes num_deleted as an int64 and caps it to the range of
// int. On 32-bit platforms a stream can have more interior deletes than int
// can hold, which would otherwise fail decoding of the whole stream info.
func (s *StreamState) UnmarshalJSON(data []byte) error {
	type streamState StreamState
	aux := struct {
		*streamState
		NumDeleted int64 `json:"num_deleted"`
	}{
		streamState: (*streamState)(s),
		NumDeleted:  int64(s.NumDeleted),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	switch {
	case aux.NumDeleted > math.MaxInt:
		s.NumDeleted = math.MaxInt
	case aux.NumDeleted < math.MinInt:
		s.NumDeleted = math.MinInt
	default:
		s.NumDeleted = int(aux.NumDeleted)
	}
	return nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `febd2b97` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
