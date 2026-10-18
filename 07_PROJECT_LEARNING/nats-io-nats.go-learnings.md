> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nats-io-nats.go-learnings.md`  
> **Source**: github ([https://github.com/nats-io/nats.go](https://github.com/nats-io/nats.go))  
> **Source Version**: `e1312b80`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T21:45:54.504Z  
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
> **Harvest Timestamp**: 2026-10-18T21:45:54.498Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nats-io/nats.go`
- **Description**: Golang client for NATS, the cloud native messaging system.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 6781 stars

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

### Incident Patch 1: `dafa2540` (2026-10-13)
**Commit Message**: [FIXED] Pull consumer deadlock sending pull requests after Stop/Drain (#2165)

Symptom: draining (or stopping) a pull Consume or Messages iterator can
deadlock. With buffered messages still being delivered during Drain,
the Consume message handler blocks forever, Closed() never returns (it
blocks on the subscription lock) and the drain never completes; a
Messages iterator's Next blocks forever the same way.

Root cause: checkPending and the Consume status goroutine (the
ErrNoHeartbeat and CONNECTED branches) send the next pull request on
fetchNext, which buffers a single request, while holding the
subscription lock. fetchNext is only read by pullMessages, which
returns as soon as done is closed by Stop or Drain. Messages delivered
after that (all of the client-side buffer while draining) still call
checkPending, so once one request sits unread in fetchNext the next
send blocks forever with the lock held.

Fix: route every send on fetchNext through requestNext, which selects
on done and drops the request once the subscription is done. Nothing
would send it anyway: pullMessages only exits after done is closed.

Test: TestPullConsumer_checkPendingAfterDone calls checkPending with a
fu

**File**: `jetstream/jetstream_test.go` (modified, +34/-0)
```diff
@@ -389,6 +389,40 @@ func TestRetryWithBackoff(t *testing.T) {
 	}
 }
 
+func TestPullConsumer_checkPendingAfterDone(t *testing.T) {
+	// Once the subscription is stopped or drained, pullMessages no longer
+	// reads fetchNext. Messages delivered while draining still call
+	// checkPending (with the lock held), and fetchNext only buffers one
+	// request, so checkPending must not block on a full fetchNext.
+	sub := &pullSubscription{
+		pending: pendingMsgs{
+			msgCount: 4,
+		},
+		consumeOpts: &consumeOpts{
+			ThresholdMessages: 5,
+			MaxMessages:       10,
+		},
+		done:      make(chan struct{}, 1),
+		fetchNext: make(chan *pullRequest, 1),
+	}
+	// A request queued before pullMessages returned, which nobody reads.
+	sub.fetchNext <- &pullRequest{}
+	close(sub.done)
+
+	returned := make(chan struct{})
+	go func() {
+		sub.Lock()
+		sub.checkPending()
+		sub.Unlock()
+		close(returned)
+	}()
+	select {
+	case <-returned:
+	case <-time.After(5 * time.Second):
+		t.Fatal("checkPending blocked on fetchNext after the subscription was done")
+	}
+}
+
 func TestPullConsumer_checkPending(t *testing.T) {
 
 	tests := []struct {
```

**File**: `jetstream/pull.go` (modified, +15/-6)
```diff
@@ -370,7 +370,7 @@ func (p *pullConsumer) Consume(handler MessageHandler, opts ...PullConsumeOpt) (
 							sub.errs <- errConnected
 						}
 
-						sub.fetchNext <- &pullRequest{
+						sub.requestNext(&pullRequest{
 							Expires:       sub.consumeOpts.Expires,
 							Batch:         sub.consumeOpts.MaxMessages,
 							MaxBytes:      sub.consumeOpts.MaxBytes,
@@ -380,7 +380,7 @@ func (p *pullConsumer) Consume(handler MessageHandler, opts ...PullConsumeOpt) (
 							Priority:      sub.consumeOpts.Priority,
 							Group:         sub.consumeOpts.Group,
 							PinID:         p.getPinID(),
-						}
+						})
 						if sub.hbMonitor != nil {
 							sub.hbMonitor.Reset(2 * sub.consumeOpts.Heartbeat)
 						}
@@ -398,7 +398,7 @@ func (p *pullConsumer) Consume(handler MessageHandler, opts ...PullConsumeOpt) (
 					if sub.consumeOpts.StopAfter > 0 {
 						batchSize = min(batchSize, sub.consumeOpts.StopAfter-sub.delivered)
 					}
-					sub.fetchNext <- &pullRequest{
+					sub.requestNext(&pullRequest{
 						Expires:       sub.consumeOpts.Expires,
 						Batch:         batchSize,
 						MaxBytes:      sub.consumeOpts.MaxBytes,
@@ -408,7 +408,7 @@ func (p *pullConsumer) Consume(handler MessageHandler, opts ...PullConsumeOpt) (
 						Priority:      sub.consumeOpts.Priority,
 						Group:         sub.consumeOpts.Group,
 						PinID:         p.getPinID(),
-					}
+					})
 					if sub.hbMonitor != nil {
 						sub.hbMonitor.Reset(2 * sub.consumeOpts.Heartbeat)
 					}
@@ -485,7 +485,7 @@ func (s *pullSubscription) checkPending() {
 			if s.consumer != nil {
 				pinID = s.consumer.getPinID()
 			}
-			s.fetchNext <- &pullRequest{
+			s.requestNext(&pullRequest{
 				Expires:       s.consumeOpts.Expires,
 				Batch:         batchSize,
 				MaxBytes:      maxBytes,
@@ -495,14 +495,23 @@ func (s *pullSubscription) checkPending() {
 				MinPending:    s.consumeOpts.MinPending,
 				MinAckPending: s.consumeOpts.MinAckPending,
 				Priority:      s.consumeOpts.Priority,
-			}
+			})
 
 			s.pending.msgCount = s.consumeOpts.MaxMessages
 			s.pending.byteCount = s.consumeOpts.MaxBytes
 		}
 	}
 }
 
+// requestNext queues req for pullMessages, giving up once the
+// subscription is done.
+func (s *pullSubscription) requestNext(req *pullRequest) {
+	select {
+	case s.fetchNext <- req:
+	case <-s.done:
+	}
+}
+
 // Messages returns MessagesContext, allowing continuously iterating
 // over messages on a stream. Messages cannot be used concurrently
 // when using ordered consumer.
```

**File**: `jetstream/test/pull_test.go` (modified, +105/-0)
```diff
@@ -3430,6 +3430,111 @@ func TestConsumeErrHandlerNoDeadlock(t *testing.T) {
 	})
 }
 
+func TestPullConsumerDrainWithBufferedMessages(t *testing.T) {
+	// While draining, messages already buffered on the client are still
+	// delivered, and with a threshold just below max messages every second
+	// one queues the next pull request. Nothing reads those requests any
+	// more, which must not block the handler or Next.
+	const numMsgs = 10
+	setup := func(t *testing.T, js jetstream.JetStream) jetstream.Consumer {
+		t.Helper()
+		ctx := newTesterCtx(t, 5*time.Second)
+		s, err := js.CreateStream(ctx, jetstream.StreamConfig{Name: "foo", Subjects: []string{"FOO.*"}})
+		if err != nil {
+			t.Fatalf("Unexpected error: %v", err)
+		}
+		c, err := s.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{AckPolicy: jetstream.AckExplicitPolicy})
+		if err != nil {
+			t.Fatalf("Unexpected error: %v", err)
+		}
+		for i := 0; i < numMsgs; i++ {
+			if _, err := js.Publish(ctx, "FOO.A", []byte("msg")); err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+		}
+		return c
+	}
+
+	t.Run("consume", func(t *testing.T) {
+		withJSServer(t, func(t *testing.T, nc *nats.Conn, js jetstream.JetStream) {
+			c := setup(t, js)
+
+			firstMsg := make(chan struct{})
+			drained := make(chan struct{})
+			var received atomic.Int32
+			cc, err := c.Consume(func(msg jetstream.Msg) {
+				if received.Add(1) == 1 {
+					close(firstMsg)
+					<-drained
+				}
+			}, jetstream.PullMaxMessages(numMsgs), jetstream.PullThresholdMessages(numMsgs-1))
+			if err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+
+			<-firstMsg
+			// let the rest of the batch reach the client
+			time.Sleep(100 * time.Millisecond)
+			cc.Drain()
+			close(drained)
+
+			closed := make(chan struct{})
+			go func() {
+				<-cc.Closed()
+				close(closed)
+			}()
+			select {
+			case <-closed:
+			case <-time.After(5 * time.Second):
+				t.Fatalf("Consume did not finish draining; received %d messages", received.Load())
+			}
+			if got := received.Load(); got != numMsgs {
+				t.Fatalf("Expected %d messages delivered while draining; got: %d", numMsgs, got)
+			}
+		})
+	})
+
+	t.Run("messages", func(t *testing.T) {
+		withJSServer(t, func(t *testing.T, nc *nats.Conn, js jetstream.JetStream) {
+			c := setup(t, js)
+
+			it, err := c.Messages(jetstream.PullMaxMessages(numMsgs), jetstream.PullThresholdMessages(numMsgs-1))
+			if err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+			if _, err := it.Next(); err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+			// let the rest of the batch reach the client
+			time.Sleep(100 * time.Millisecond)
+			it.Drain()
+
+			received := 1
+			done := make(chan error, 1)
+			go func() {
+				for {
+					if _, err := it.Next(); err != nil {
+						done <- err
+						return
+					}
+					received++
+				}
+			}()
+			select {
+			case err := <-done:
+				if !errors.Is(err, jetstream.ErrMsgIteratorClosed) {
+					t.Fatalf("Expected error: %v; got: %v", jetstream.ErrMsgIteratorClosed, err)
+				}
+				if received != numMsgs {
+					t.Fatalf("Expected %d messages delivered while draining; got: %d", numMsgs, received)
+				}
+			case <-time.After(5 * time.Second):
+				t.Fatal("Next blocked while draining")
+			}
+		})
+	})
+}
+
 func TestPullConsumerMaxReconnectsExceeded(t *testing.T) {
 	t.Run("messages", func(t *testing.T) {
 		c := newTester(t)
```

---

### Incident Patch 2: `db667e2f` (2026-10-08)
**Commit Message**: [FIXED] Ordered consumer StopAfter deadlock and miscount on reset (#2167)

An ordered consumer with StopAfter misbehaved whenever it reset its
inner pull subscription:

- Messages: after a reset on a sequence mismatch, Stop or Drain on the
  iterator, or the next reset, blocked forever while holding the
  ordered consumer's lock.
- Messages: after a reset on a missed heartbeat or a reconnect, the
  iterator delivered more than StopAfter messages.
- Consume: a reset on a sequence mismatch delivered fewer than
  StopAfter messages.
- Consume: calling Stop or Drain after the consume had stopped itself on
  reaching StopAfter panicked with "close of closed channel".

The ordered consumer learned how many messages were left from a single
channel (buffer 1) that it shared between all of its inner pull
subscriptions: each inner Stop or Drain sent StopAfter minus its own
delivered count to it, or closed it once the limit was reached. The
Messages error path read that channel without blocking before the inner
subscription was stopped, so it always found it empty, kept the
original limit for the next subscription, and left the value that the
reset's Stop then sent in the channel. The sequenc

**File**: `jetstream/ordered.go` (modified, +73/-95)
```diff
@@ -17,6 +17,7 @@ import (
 	"context"
 	"errors"
 	"fmt"
+	"slices"
 	"strconv"
 	"strings"
 	"sync"
@@ -40,9 +41,8 @@ type (
 		doReset           chan struct{}
 		resetInProgress   atomic.Uint32
 		userErrHandler    ConsumeErrHandler
-		stopAfter         int
-		stopAfterMsgsLeft chan int
-		withStopAfter     bool
+		stopAfter         int // StopAfter of Consume or Messages, 0 if not set
+		deliveredMessages int // messages handed to the caller, across resets
 		runningFetch      *fetchResult
 		subscription      *orderedSubscription
 		sync.Mutex
@@ -99,15 +99,17 @@ func (c *orderedConsumer) Consume(handler MessageHandler, opts ...PullConsumeOpt
 		return nil, fmt.Errorf("%w: %s", ErrInvalidOption, err)
 	}
 	c.userErrHandler = consumeOpts.ErrHandler
-	opts = append(opts, consumeReconnectNotify(),
-		ConsumeErrHandler(c.errHandler(c.serial)))
-	if consumeOpts.StopAfter > 0 {
-		c.withStopAfter = true
-		c.stopAfter = consumeOpts.StopAfter
-	}
-	c.stopAfterMsgsLeft = make(chan int, 1)
-	if c.stopAfter > 0 {
-		opts = append(opts, consumeStopAfterNotify(c.stopAfter, c.stopAfterMsgsLeft))
+	c.stopAfter = max(consumeOpts.StopAfter, 0)
+	c.deliveredMessages = 0
+	opts = append(opts, consumeReconnectNotify())
+	// innerOpts returns the options for the inner pull subscription of the
+	// current serial. Lock should be held when calling it.
+	innerOpts := func() []PullConsumeOpt {
+		o := append(slices.Clip(opts), ConsumeErrHandler(c.errHandler(c.serial)))
+		if c.stopAfter > 0 {
+			o = append(o, StopAfter(c.stopAfter-c.deliveredMessages))
+		}
+		return o
 	}
 	sub := &orderedSubscription{
 		consumer: c,
@@ -135,14 +137,23 @@ func (c *orderedConsumer) Consume(handler MessageHandler, opts ...PullConsumeOpt
 				c.errHandler(serial)(sub, errOrderedSequenceMismatch)
 				return
 			}
+			if c.stopAfter > 0 && c.deliveredMessages >= c.stopAfter {
+				c.Unlock()
+				return
+			}
 			c.cursor.deliverSeq = dseq
 			c.cursor.streamSeq = meta.Sequence.Stream
+			c.deliveredMessages++
+			last := c.stopAfter > 0 && c.deliveredMessages == c.stopAfter
 			c.Unlock()
 			handler(msg)
+			if last {
+				sub.Stop()
+			}
 		}
 	}
 
-	cc, err := c.currentConsumer.Consume(internalHandler(c.serial), opts...)
+	cc, err := c.currentConsumer.Consume(internalHandler(c.serial), innerOpts()...)
 	if err != nil {
 		return nil, err
 	}
@@ -152,35 +163,25 @@ func (c *orderedConsumer) Consume(handler MessageHandler, opts ...PullConsumeOpt
 		for {
 			select {
 			case <-c.doReset:
+				c.Lock()
+				done := c.stopAfter > 0 && c.deliveredMessages >= c.stopAfter
+				c.Unlock()
+				if done {
+					sub.Stop()
+					return
+				}
 				if err := c.reset(); err != nil {
 					if errors.Is(err, errOrderedConsumerClosed) {
 						continue
 					}
 					c.errHandler(c.serial)(c.currentSub, err)
 				}
-				if c.withStopAfter {
-					select {
-					case c.stopAfter = <-c.stopAfterMsgsLeft:
-					default:
-					}
-					if c.stopAfter <= 0 {
-						sub.Stop()
-						return
-					}
-				}
-				if c.stopAfter > 0 {
-					opts = opts[:len(opts)-2]
-				} else {
-					opts = opts[:len(opts)-1]
-				}
-
-				// overwrite the previous err handler to use the new serial
-				opts = append(opts, ConsumeErrHandler(c.errHandler(c.serial)))
-				if c.withStopAfter {
-					opts = append(opts, consumeStopAfterNotify(c.stopAfter, c.stopAfterMsgsLeft))
-				}
-				if cc, err := c.currentConsumer.Consume(internalHandler(c.serial), opts...); err != nil {
-					c.errHandler(c.serial)(cc, err)
+				c.Lock()
+				serial := c.serial
+				consumeOpts := innerOpts()
+				c.Unlock()
+				if cc, err := c.currentConsumer.Consume(internalHandler(serial), consumeOpts...); err != nil {
+					c.errHandler(serial)(cc, err)
 				} else {
 					c.Lock()
 					c.currentSub = cc.(*pullSubscription)
@@ -194,12 +195,6 @@ func (c *orderedConsumer) Consume(handler MessageHandler, opts ...PullConsumeOpt
 					sub.consumer.Unlock()
 				}
 				return
-			case msgsLeft, ok := <-c.stopAfterMsgsLeft:
-				if !ok {
-					close(sub.done)
-				}
-				c.stopAfter = msgsLeft
-				return
 			}
 		}
 	}()
@@ -263,15 +258,9 @@ func (c *orderedConsumer) Messages(opts ...PullMessagesOpt) (MessagesContext, er
 	opts = append(opts,
 		WithMessagesErrOnMissingHeartbeat(true),
 		messagesReconnectNotify())
-	c.stopAfterMsgsLeft = make(chan int, 1)
-	if consumeOpts.StopAfter > 0 {
-		c.withStopAfter = true
-		c.stopAfter = consumeOpts.StopAfter
-	}
+	c.stopAfter = max(consumeOpts.StopAfter, 0)
+	c.deliveredMessages = 0
 	c.userErrHandler = consumeOpts.ErrHandler
-	if c.stopAfter > 0 {
-		opts = append(opts, messagesStopAfterNotify(c.stopAfter, c.stopAfterMsgsLeft))
-	}
 	cc, err := c.currentConsumer.Messages(opts...)
 	if err != nil {
 		return nil, err
@@ -307,28 +296,9 @@ func (s *orderedSubscription) Next(opts ...NextOpt) (Msg, error) {
 				s.Stop()
 				return nil, err
 			}
-			if s.consumer.withStopAfter {
-				select {
-				case s.consumer.stopAfter = <-s.consumer.stopAfterMsgsLeft:
-				default
```

**File**: `jetstream/pull.go` (modified, +0/-15)
```diff
@@ -124,7 +124,6 @@ type (
 		ThresholdMessages       int
 		ThresholdBytes          int
 		StopAfter               int
-		stopAfterMsgsLeft       chan int
 		notifyOnReconnect       bool
 	}
 
@@ -792,13 +791,6 @@ func (s *pullSubscription) Stop() {
 		return
 	}
 	close(s.done)
-	if s.consumeOpts.stopAfterMsgsLeft != nil {
-		if s.delivered >= s.consumeOpts.StopAfter {
-			close(s.consumeOpts.stopAfterMsgsLeft)
-		} else {
-			s.consumeOpts.stopAfterMsgsLeft <- s.consumeOpts.StopAfter - s.delivered
-		}
-	}
 }
 
 // Drain unsubscribes from the stream and cancels subscription. All
@@ -811,13 +803,6 @@ func (s *pullSubscription) Drain() {
 	}
 	s.draining.Store(1)
 	close(s.done)
-	if s.consumeOpts.stopAfterMsgsLeft != nil {
-		if s.delivered >= s.consumeOpts.StopAfter {
-			close(s.consumeOpts.stopAfterMsgsLeft)
-		} else {
-			s.consumeOpts.stopAfterMsgsLeft <- s.consumeOpts.StopAfter - s.delivered
-		}
-	}
 }
 
 // Closed returns a channel that is closed when consuming is
```

**File**: `jetstream/test/ordered_test.go` (modified, +180/-0)
```diff
@@ -20,6 +20,7 @@ import (
 	"reflect"
 	"strings"
 	"sync"
+	"sync/atomic"
 	"testing"
 	"time"
 
@@ -546,6 +547,77 @@ func TestOrderedConsumerConsume(t *testing.T) {
 			}
 		})
 	})
+
+	t.Run("with auto unsubscribe, stop after limit is reached", func(t *testing.T) {
+		withJSServer(t, func(t *testing.T, _ *nats.Conn, js jetstream.JetStream) {
+			ctx := newTesterCtx(t, 10*time.Second)
+			s, err := js.CreateStream(ctx, jetstream.StreamConfig{Name: "foo", Subjects: []string{"FOO.*"}})
+			if err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+			c, err := s.OrderedConsumer(ctx, jetstream.OrderedConsumerConfig{})
+			if err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+			publishTestMsgs(t, js)
+			var received atomic.Int32
+			cc, err := c.Consume(func(msg jetstream.Msg) {
+				received.Add(1)
+			}, jetstream.StopAfter(3))
+			if err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+			select {
+			case <-cc.Closed():
+			case <-time.After(5 * time.Second):
+				t.Fatalf("Timeout waiting for consume to be closed")
+			}
+			// Stopping a consume which already stopped itself after
+			// reaching the limit is a no-op.
+			cc.Stop()
+			cc.Drain()
+			if received.Load() != 3 {
+				t.Fatalf("Unexpected received message count; want %d; got %d", 3, received.Load())
+			}
+		})
+	})
+
+	t.Run("with auto unsubscribe and sequence mismatch", func(t *testing.T) {
+		withJSServer(t, func(t *testing.T, _ *nats.Conn, js jetstream.JetStream) {
+			ctx := newTesterCtx(t, 10*time.Second)
+			s, err := js.CreateStream(ctx, jetstream.StreamConfig{Name: "foo", Subjects: []string{"FOO.*"}})
+			if err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+			c, err := s.OrderedConsumer(ctx, jetstream.OrderedConsumerConfig{})
+			if err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+			for range 20 {
+				if _, err := js.Publish(ctx, "FOO.A", []byte("msg")); err != nil {
+					t.Fatalf("Unexpected error during publish: %s", err)
+				}
+			}
+			// messages the ordered consumer discards to reset on the
+			// sequence mismatch must not count towards StopAfter
+			fetchOneFromOrderedConsumer(t, js, "foo", c.CachedInfo().Name)
+			var received atomic.Int32
+			cc, err := c.Consume(func(msg jetstream.Msg) {
+				received.Add(1)
+			}, jetstream.StopAfter(10))
+			if err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+			select {
+			case <-cc.Closed():
+			case <-time.After(5 * time.Second):
+				t.Fatalf("Timeout waiting for consume to be closed; received %d", received.Load())
+			}
+			if received.Load() != 10 {
+				t.Fatalf("Unexpected received message count; want %d; got %d", 10, received.Load())
+			}
+		})
+	})
 }
 
 func TestOrderedConsumerMessages(t *testing.T) {
@@ -920,6 +992,91 @@ func TestOrderedConsumerMessages(t *testing.T) {
 			}
 		})
 	})
+
+	t.Run("with auto unsubscribe and sequence mismatch, stop", func(t *testing.T) {
+		withJSServer(t, func(t *testing.T, _ *nats.Conn, js jetstream.JetStream) {
+			ctx := newTesterCtx(t, 10*time.Second)
+			s, err := js.CreateStream(ctx, jetstream.StreamConfig{Name: "foo", Subjects: []string{"FOO.*"}})
+			if err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+			c, err := s.OrderedConsumer(ctx, jetstream.OrderedConsumerConfig{})
+			if err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+			publishTestMsgs(t, js)
+			name := c.CachedInfo().Name
+			fetchOneFromOrderedConsumer(t, js, "foo", name)
+			it, err := c.Messages(jetstream.StopAfter(100))
+			if err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+			for range len(testMsgs) {
+				if _, err := it.Next(); err != nil {
+					t.Fatalf("Unexpected error: %v", err)
+				}
+			}
+			if c.CachedInfo().Name == name {
+				t.Fatalf("Expected consumer to be reset")
+			}
+			stopped := make(chan struct{})
+			go func() {
+				it.Stop()
+				close(stopped)
+			}()
+			select {
+			case <-stopped:
+			case <-time.After(5 * time.Second):
+				t.Fatalf("Timeout waiting for Stop to return")
+			}
+		})
+	})
+
+	t.Run("with auto unsubscribe and server restart", func(t *testing.T) {
+		withJSServerInstance(t, func(t *testing.T, _ *nats.Conn, js jetstream.JetStream, inst *testservice.Instance) {
+			ctx := newTesterCtx(t, 30*time.Second)
+			s, err := js.CreateStream(ctx, jetstream.StreamConfig{Name: "foo", Subjects: []string{"FOO.*"}})
+			if err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+			c, err := s.OrderedConsumer(ctx, jetstream.OrderedConsumerConfig{})
+			if err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+			publishTestMsgs(t, js)
+			it, err := c.Messages(jetstream.StopAfter(10))
+			if err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+			defer it.Stop()
+			received := 0
+			for range 3 {
+				if _, err := it.Next(); err != nil {
+					t.Fatalf("Unexpected error: %v", err)
+				}
+				received++
+			}
+			inst.StopServer(t, inst.Servers[0])
+			inst.StartServer(t, inst.Servers[0])
+			wai
```

---

### Incident Patch 3: `bd189988` (2026-10-08)
**Commit Message**: [FIXED] Abort publish drain when connection is closed during Drain (#2163)

drainConnection waited for subscriptions to drain and then
unconditionally flipped the connection to DRAINING_PUBS and called
FlushTimeout, without rechecking whether the connection had been
closed in the meantime. A Close concurrent with Drain was therefore
undone: the closed connection was resurrected to DRAINING_PUBS and
the drain goroutine started a new 5s flush on it, surviving long
after Close returned.

Recheck isClosed under the connection lock before flipping the
state, and return early if the connection is already closed.

Adds TestDrainConnectionCloseDuringDrain, which holds a subscription
callback, starts Drain, waits for the drain goroutine to enter its
pending-subscription wait, closes the connection, and asserts the
connection stays CLOSED and the drain goroutine exits.

Fixes #2162

Signed-off-by: Kyle Cox <[REDACTED_EMAIL]>

**File**: `nats.go` (modified, +9/-1)
```diff
@@ -6404,8 +6404,16 @@ func (nc *Conn) drainConnection() {
 		pushErr(ErrDrainTimeout)
 	}
 
-	// Flip State
+	// Flip State, unless the connection was closed while we were
+	// draining subscriptions (for example by a concurrent Close call).
+	// In that case abort the publish drain: the connection is already
+	// terminal, and flipping the state here would resurrect it and
+	// start a new flush on a closed connection.
 	nc.mu.Lock()
+	if nc.isClosed() {
+		nc.mu.Unlock()
+		return
+	}
 	nc.changeConnStatus(DRAINING_PUBS)
 	nc.mu.Unlock()
 
```

**File**: `test/drain_test.go` (modified, +78/-0)
```diff
@@ -16,6 +16,8 @@ package test
 import (
 	"errors"
 	"fmt"
+	"runtime"
+	"strings"
 	"sync"
 	"sync/atomic"
 	"testing"
@@ -444,3 +446,79 @@ func TestDrainClosedHandlerRace(t *testing.T) {
 		time.Sleep(500 * time.Millisecond)
 	})
 }
+
+// Closing the connection while drainConnection is still waiting for
+// subscriptions to drain must abort the rest of the drain: the drain
+// goroutine must not flip the (already closed) connection back to
+// DRAINING_PUBS and start a new FlushTimeout on it.
+func TestDrainConnectionCloseDuringDrain(t *testing.T) {
+	withServer(t, func(t *testing.T, nc *nats.Conn) {
+		entered := make(chan struct{})
+		release := make(chan struct{})
+		if _, err := nc.Subscribe("pending", func(*nats.Msg) {
+			close(entered)
+			<-release
+		}); err != nil {
+			t.Fatalf("Error creating subscription: %v", err)
+		}
+		defer close(release)
+
+		if err := nc.Publish("pending", nil); err != nil {
+			t.Fatalf("Error on publish: %v", err)
+		}
+		if err := nc.Flush(); err != nil {
+			t.Fatalf("Error on flush: %v", err)
+		}
+		select {
+		case <-entered:
+		case <-time.After(time.Second):
+			t.Fatal("callback not entered")
+		}
+
+		if err := nc.Drain(); err != nil {
+			t.Fatalf("Unexpected error on drain: %v", err)
+		}
+
+		// Wait until the drain goroutine is in its pending-subscription
+		// wait loop, so that Close lands mid-drain.
+		waiting := false
+		for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline) && !waiting; {
+			b := make([]byte, 1<<20)
+			n := runtime.Stack(b, true)
+			for _, stack := range strings.Split(string(b[:n]), "\n\n") {
+				if strings.Contains(stack, "(*Conn).drainConnection") && strings.Contains(stack, "time.Sleep(") {
+					waiting = true
+					break
+				}
+			}
+			if !waiting {
+				runtime.Gosched()
+			}
+		}
+		if !waiting {
+			t.Fatal("drain did not enter pending-subscription wait")
+		}
+
+		nc.Close()
+		if !nc.IsClosed() {
+			t.Fatalf("connection not closed after Close: %v", nc.Status())
+		}
+
+		// The connection must stay closed: before the fix, the drain
+		// goroutine resurrects it to DRAINING_PUBS and then sits in
+		// FlushTimeout for 5 seconds.
+		time.Sleep(250 * time.Millisecond)
+		if !nc.IsClosed() {
+			t.Fatalf("connection resurrected after Close: %v", nc.Status())
+		}
+		for deadline := time.Now().Add(2 * time.Second); time.Now().Before(deadline); {
+			b := make([]byte, 1<<20)
+			n := runtime.Stack(b, true)
+			if !strings.Contains(string(b[:n]), "(*Conn).drainConnection") {
+				return
+			}
+			time.Sleep(10 * time.Millisecond)
+		}
+		t.Fatal("drain goroutine still running after Close")
+	})
+}
```

#### Recent Merged Pull Requests:
- **PR #2198** (2026-10-16): [ADDED] JetStream FetchMaxBytes option (@manenim)
- **PR #2192** (2026-10-14): [FIXED] Match v2 ack subjects in JetStream ack tests (@piotrpio)
- **PR #2191** (2026-10-14): [FIXED] Dependencies report workflow (@piotrpio)
- **PR #2188** (2026-10-14): [FIXED] Pull iterator Drain racing with Next returns ErrMsgIteratorClosed early (@piotrpio)
- **PR #2187** (2026-10-14): [FIXED] Unpin Go in the lint job (@piotrpio)
- **PR #2186** (2026-10-14): [FIXED] Measure delivered message size in pull consumer max bytes tests (@piotrpio)

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

## X. [FIXED] Pull consumer deadlock sending pull requests after Stop/Drain (#2165)

**RULE**:
When implementing operations in `jetstream/jetstream_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nats-io/nats.go. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dafa2540`: [FIXED] Pull consumer deadlock sending pull requests after Stop/Drain (#2165). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `jetstream/jetstream_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
func TestPullConsumer_checkPendingAfterDone(t *testing.T) {
	// Once the subscription is stopped or drained, pullMessages no longer
	// reads fetchNext. Messages delivered while draining still call
	// checkPending (with the lock held), and fetchNext only buffers one
	// request, so checkPending must not block on a full fetchNext.
	sub := &pullSubscription{
		pending: pendingMsgs{
			msgCount: 4,
		},
		consumeOpts: &consumeOpts{
			ThresholdMessages: 5,
			MaxMessages:       10,
		},
		done:      make(chan struct{}, 1),
		fetchNext: make(chan *pullRequest, 1),
	}
	// A request queued before pullMessages returned, which nobody reads.
	sub.fetchNext <- &pullRequest{}
	close(sub.done)

	returned := make(chan struct{})
	go func() {
		sub.Lock()
		sub.checkPending()
		sub.Unlock()
		close(returned)
	}()
	select {
	case <-returned:
	case <-time.After(5 * time.Second):
		t.Fatal("checkPending blocked on fetchNext after the subscription was done")
	}
}

```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dafa2540` are properly handled with clean fallback behavior.
