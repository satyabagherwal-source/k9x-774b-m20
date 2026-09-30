# Forensic Learning Record (Deep Inspection): nats-io/nats.go

> **Canonical Artifact**: `07_PROJECT_LEARNING/nats-io-nats.go-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nats-io/nats.go](https://github.com/nats-io/nats.go))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:26:58.289Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nats-io/nats.go`
- **Description**: Golang client for NATS, the cloud native messaging system.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 6764 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

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
				buffer.WriteString(fmt.Sprintf("%s [
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
				return nil, ErrConnectionClosed
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

	return c.Conn.subscribe(subject, queue, natsCB
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
  **Post-Mortem & Fix Analysis**:
  > Thanks for filling the issue!  Ordered Pull Consumer should send new fetch requests to the server when it sees reconnect event, and Consumer is not deleted because server restarted. It probably is deleted because until server is up and running again, the `InactiveThreshold` is reached.  Increasing `InactiveThreshold` to ~30 seconds would be a good test to check if that's the culprit.  I'm not sure about recreating ordered consumer if it's not there - forcing recreation would make `InactiveThreshold` config obsolete and would also not allow operators of the cluster to permanently remove specific consuer, as Client would immediately recreate it.  We will take a look at the code.  
  > @Jarema  I attempted to increase the `InactiveThreshold` to 1 Hour and still no luck. It seems as Consumers are being deleted immediately and not honoring the `InactiveThreshold` on a hard restart. Below is a screenshot of my Consumers from the NATs box:  ![image](https://github.com/nats-io/nats.go/assets/35089121/32d8451a-0cfa-4130-9725-562eeb4390c2)  The `reset` method in [./jetstream/ordered.go](https://github.com/nats-io/nats.go/blob/e2ac73b92f5baae9aff730a65a8d8cee9d069e4c/jetstream/ordered.go#L327) already does recreation of Consumers for certain errors. So it seems like the config is already obsolete to some extent?  Thank you for looking into this. 
  > Forgot to mention, `OrderedConsumers` allow the caller to set the `MaxResetAttempts` -which recreates the Consumer. It seems like recreating the Consumer is by design. To your point, it feels like `InactiveThreshold` kind of contridicts this setting. 

- **Issue #1369** (2023-08-26): **stream.CreateOrUpdateConsumer with FilterSubjects error**
  *Symptoms*:    nats.go version v1.28.0   nats-server version  2.9.21-beta  code : 	cons, err := stream.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{ 		Durable:           durable, 		AckPolicy:         jetstream.AckExplicitPolicy, 		FilterSubjects: []string{"foo.p1.p2"}, // has erro. get foo.u1 subject messags 		// FilterSubject:    "foo.p1.p2", // this works ok  	})   cmd: nats pub foo.u1 msg1   use FilterSubjects: []string{"foo.p1.p2"} for subject, I get foo.u1 messags. but use FilterSubject:    "foo.p1.p2", It works ok, not get foo.u1 messags.   
  **Post-Mortem & Fix Analysis**:
  > Hey @elkmi , thanks for submitting the issue. Unfortunately `FilterSubjects` will only be available as an option in nats-server v2.10.0. This field was already added in `nats.go`, but for now you will have to use `FilterSubject`.

- **Issue #1354** (2026-05-15): **incorrect error message when creating KV watches**
  *Symptoms*: ## Defect  #### Versions of `nats.go` and the `nats-server` if one was involved:  `nats-server: v2.9.19` `github.com/nats-io/nats.go v1.27.1`  #### OS/Container environment:  MacOS 13.4.1 `go version go1.20.5 darwin/arm64`  #### Steps or code to reproduce the issue:  Start a JetStream enabled NATS server:  ``` nats-server -js ```  Spawn a watch on an invalid key:  ```go package main  import ( 	"github.com/nats-io/nats.go" )  func main() { 	nc, _ := nats.Connect(nats.DefaultURL)  	js, err := nc.JetStream() 	if err != nil { 		panic(err) 	}  	kv, err := js.KeyValue("bucket") 	if err != nil { 		panic(err) 	}  	_, err = kv.Watch("test..") 	if err != nil { 		panic(err) 	} } ```  #### Expected result:  An error message similar to the one the CLI provides:  ``` $ nats kv watch bucket test.. nats: error: nats: consumer filter subject is not a valid subset of the interest subjects ```  #### Actual result:  ``` panic: nats: jetstream not enabled ```  
  **Post-Mortem & Fix Analysis**:
  > It's also worth noting that the [`nats`](https://github.com/nats-io/natscli) CLI current `main` branch also shows the error: ``` nats: error: nats: jetstream not enabled ```  I can only get the error: ``` nats: error: nats: consumer filter subject is not a valid subset of the interest subjects ```  With `nats` CLI `v0.0.35` uses `nats.go` version `1.19.0`: ``` go install github.com/nats-io/natscli/nats@v0.0.35 ``` 
  > It is because the trailing “..” is an invalid subject and it causes the API subjects being used to also be invalid.   We should probably fail for such invalid sibjects earlier - but that’s why you get jetstream not enabled, the jetstream API can’t be reached. 
  > > It is because the trailing “..” is an invalid subject and it causes the API subjects being used to also be invalid. >  > We should probably fail for such invalid sibjects earlier - but that’s why you get jetstream not enabled, the jetstream API can’t be reached.  Yes the [`Watch()`](https://github.com/nats-io/nats.go/blob/3e4bc5a4f8598ddc50af2d394c2878ae6557fbf0/kv.go#L874) method does not validate the keys pattern, the other KV methods use the `keyValid()` function to validate the key which is going to fail if in `Watch()` if the pattern contains wildcards.

- **Issue #1343** (2023-07-15): **New JetStream API: calling `Stop()` makes `Next()` block indefinitely or until a missing heartbeat error**
  *Symptoms*: ## Defect  Make sure that these boxes are checked before submitting your issue -- thank you!   - [x] Included nats.go version  - [x] Included a [Minimal, Complete, and Verifiable example] (https://stackoverflow.com/help/mcve)  #### Versions of `nats.go` and the `nats-server` if one was involved: - nats.go: `v1.27.1` - nats-server: `v2.9.19`  #### OS/Container environment: - OS: `linux` -  Arch: `amd64` - Go: `v1.20.5`  #### Steps or code to reproduce the issue: 1. Use the new JetStream API consumer with `Messages()` ```go iter, err := cons.Messages(jetstream.PullMaxMessages(1)) if err != nil { 	log.Fatal(err) } ``` 2. Call the `Next()` method in a **separate** goroutine ```go var wg sync.WaitGroup  wg.Add(1) go func() { 	defer wg.Done()  	for { 		// Next() blocks until a message is available. 		// After calling Stop() keeps blocking until we get an ErrNoHeartbeat, 		// then next call will return ErrMsgIteratorClosed because of the 		// atomic.LoadUint32(&s.closed) == 1 check in Next().                 // If ReportMissingHeartbeats is false, then it will block indefinitely. 		msg, err := iter.Next()  		if err != nil { 			if errors.Is(err, jetstream.ErrMsgIteratorClosed) { 				fmt.Println("Iterator closed") 				break 			}  			fmt.Println("Next err: ", err) 			// If Stop() was called then the next Next() call will return ErrMsgIteratorClosed. 			continue 		}  		fmt.Println(string(msg.Data())) 		msg.Ack() 	} }() ``` 3. Call 

- **Issue #1321** (2023-06-22): **Jetstream K/V bucket fails due to consumer name not being durable**
  *Symptoms*: ## Defect Provided these code snippets: ```go 	kv, err := jetstream.KeyValue("foo") 	switch { 	case errors.Is(err, nats.ErrBucketNotFound): 		return jetstream.CreateKeyValue(&nats.KeyValueConfig{ 			Bucket:      "foo", 			Description: "foobar", 		})  	stuff, err := s.kv.Keys() 	switch { 	// If we find that theres no keys then init is a no-op 	case errors.Is(err, nats.ErrNoKeysFound): 		return nil 	case err != nil: 		return err 	} ``` I receive the following error: ``` nats: consumer expected to be durable but a durable name was not set ```  #### Versions of `nats.go` and the `nats-server` if one was involved:  Client library version: `v1.26.0+`. This bug does NOT exist in `v1.25.0`.  #### Expected result:  No errors when creating accessing k/v buckets.  #### Actual result:  The below error: ``` nats: consumer expected to be durable but a durable name was not set ```
  **Post-Mortem & Fix Analysis**:
  > I assume the version of nats-server you're using is lower than 2.9.0? If so, there was indeed a bug which caused us to use invalid subject to create the consumer on older server versions when durable was not set. I created a PR to solve this issue - #1325   In the meantime, I would encourage you to switch to newer server release (current is 2.9.18) - there were really a lot of new features and improvements throughout 2.9.x releases!
  > same problem @ github.com/nats-io/nats.go v1.27.0 on v1.25.0 - bucket watching works fine  **UPD**: server version - 2.8.4
  > @piotrpio I was actually using server version `v2.7.4` so yes you are correct! I bumped to the latest `v2.9.18` and the problem was resolved.

- **Issue #1318** (2023-06-16): **net jetstream interface; A consumer will get stuck when the call to Consume occurs after AckWait timed out**
  *Symptoms*: ## Defect  Make sure that these boxes are checked before submitting your issue -- thank you!   - [ ] Included nats.go version  - [ ] Included a [Minimal, Complete, and Verifiable example] (https://stackoverflow.com/help/mcve)  #### Versions of `nats.go` and the `nats-server` if one was involved: v1.27.0 and v2.9.17  #### OS/Container environment: Linux  #### Steps or code to reproduce the issue: Create a (named) consumer with AckWait(5*time.Second on a stream that will return atleast one msg Sleep for 6 seconds call con.Consume(...)  It will not error and it will not consume anything   #### Expected result: msgs  #### Actual result: no error, no msgs  
  **Post-Mortem & Fix Analysis**:
  > @tpihl from what I see, this is not tied to `AckWait`. When we're using pull consumers, messages are not sent from a stream to consumer when you create the consumer, only when you actually send the pull request (e.g. call `Consume()`). `AckWait` is the window between when the server sends the message (you send the pull request) and the server receives ACK for the message. If server does not receive `Ack()` (or `InProgress()`), it will redeliver the message.  What you encountered (I think) is the default `InactiveThreshold` kicking in - the default is 5 seconds and that means that if your consumer is inactive for more than that (meaning it does not actively query or receive messages), it will get removed. Unfortunately there is not easy way to tell that it happened (server will simply time out on pull requests, which may as well indicate there are no messages), other than the fact that you should receive `ErrNoHeartbeat`. You can verify if that's the case by adding `jetstream.ConsumeE
  > When explained, it makes sense. But I will argue that this is not intuitive and the solution to cover for this would require the same solution that was deemed a not enough obvious solution for the iterator.   IMHO it will be easier to use if it always uses ConsumeErrHandler than if that's only for some specific corner-cases that otherwise fail silent (and have no good way of recover without catching the missing heartbeat).  I will close this since it's not a  bug, but @piotrpio, i hope it will be considered when evaluating if the new interface fulfill the non-magic part or if there need to be some more compensatory actions in the interface.

- **Issue #1313** (2023-06-13): **Object Store Get with a nats.Context causes a race condition**
  *Symptoms*: ## Defect  Make sure that these boxes are checked before submitting your issue -- thank you!   - [x] Included nats.go version  - [x] Included a [Minimal, Complete, and Verifiable example] (https://stackoverflow.com/help/mcve)  #### Versions of `nats.go` and the `nats-server` if one was involved: * `nats.go` version = `v1.27.0` #### OS/Container environment: mac #### Steps or code to reproduce the issue: Perform a `Get` on an `ObjectStore` while providing the `nats.Context` as a `GetObjectOpt` causes a race condition.  If we modify the `TestObjectBasics` test to add a `nats.Context(context.Background()` as an option to the seciont that gets the object back (line 95), the test will have a race condition.  ``` func TestObjectBasics(t *testing.T) { . . . 	// Now get the object back. 	result, err := obs.Get("BLOB", nats.Context(context.Background())) 	expectOk(t, err) 	expectOk(t, result.Error()) 	defer result.Close() . . . ```  #### Expected result: The test to pass without any race conditions.  #### Actual result: The test will pass when running without the `-race` flag, but as soon as we add the `-race` flag, then the test fails due to the race condition. 
  **Post-Mortem & Fix Analysis**:
  > I believe I have a fix for this, I'm working on creating an MR now.
  > Race condition error: ``` ================== WARNING: DATA RACE Read at 0x00c0001e56d0 by goroutine 41:   github.com/nats-io/nats%2ego.(*obs).Get.func2()       /Users/ajacques/git/nats.go/object.go:635 +0x209   github.com/nats-io/nats%2ego.(*Conn).waitForMsgs()       /Users/ajacques/git/nats.go/nats.go:3001 +0x782   github.com/nats-io/nats%2ego.(*Conn).subscribeLocked.func1()       /Users/ajacques/git/nats.go/nats.go:4232 +0x47  Previous write at 0x00c0001e56d0 by goroutine 6:   github.com/nats-io/nats%2ego.(*obs).Get()       /Users/ajacques/git/nats.go/object.go:667 +0xe31   github.com/nats-io/nats.go/test.TestObjectBasics()       /Users/ajacques/git/nats.go/test/object_test.go:101 +0xd78   testing.tRunner()       /usr/local/opt/go/libexec/src/testing/testing.go:1576 +0x216   testing.(*T).Run.func1()       /usr/local/opt/go/libexec/src/testing/testing.go:1629 +0x47  Goroutine 41 (running) created at:   github.com/nats-io/nats%2ego.(*Conn).subscribeLocked()     

- **Issue #1311** (2023-10-16): **Projects depending on nats.go are also pulling in nats-server as a dependency**
  *Symptoms*: ## Defect  Projects depending on `nats.go` are pulling `nats-server` into their go.mod file. From what I can tell this is a bug, as the go_test.mod and go_test.sum files are intended as a way to prevent library consumers from pulling in test dependencies.   This is stemming from a few test files like [js_test.go](https://github.com/nats-io/nats.go/blob/b2d067b4ce6ddf4b1a8c5b4b7b16cb8bd09bbda0/js_test.go) which are part of the `nats` package instead of `nats_test`. The tests use nats-server and seem to need access to private variables in the `nats` package. Because of these references `go mod tidy` seems to notice the missing `nats-server` dependency and helpfully finds one that will work.  #### Versions of `nats.go` * `nats.go` v1.27.0 * `go` version go1.20.4 linux/amd64   #### Steps or code to reproduce the issue:  We discovered this in [various](https://github.com/cloudfoundry/routing-release/blob/508f625b799f509a81414407a8ff88cf163ddaff/src/code.cloudfoundry.org/go.mod#LL42C21-L42C32) [Cloud Foundry](https://github.com/cloudfoundry/routing-release/blob/508f625b799f509a81414407a8ff88cf163ddaff/src/code.cloudfoundry.org/go.mod#LL42C21-L42C32) [projects](https://github.com/cloudfoundry/diego-release/blob/cbd7cf6167335ffe1b1c4b5a7b77ac51d797f992/src/code.cloudfoundry.org/go.mod#L68), but it's easily reproducible by creating a main.go that looks like this: ``` package main  import (         "github.com/nats-io/nats.go" )  func main() {         // Connect to
  **Post-Mortem & Fix Analysis**:
  > Hey @mkocher, thank you for submitting the issue.  You're right, that is not the correct behavior. This is caused by nats.go having dependencies on nats-server in `nats` package, not just in `test` (as it should). We'll be working on this issue, as there are some tests depending on unexported properties in `nats` package which also depend on `nats-server`. I will keep you updated here.
  > Is there work in flight to address this @piotrpio?  I work on a project that takes great pains to minimize final binary sizes and I am not loving the idea of this going out with our next release this fall (luckily NATS is an optional dependency at this point).  I am happy to open a PR if it has a chance to be merged but don't want to step on the toes of any wider reaching refactoring in the jetstream tests.
  > @piotrpio lets get this fixed asap. Client should not pull in server sans for tests.

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

### Incident Patch 1: `5adc9d5d` (2026-09-25)
**Commit Message**: [IMPROVED] Fix ordered consumer test exceeding 1000 consumers created (#2155)

Signed-off-by: Piotr Piotrowski <piotr@synadia.com>

**File**: `test/js_internal_test.go` (modified, +4/-3)
```diff
@@ -454,9 +454,10 @@ func TestJetStreamOrderedConsumerSIDRace(t *testing.T) {
 			t.Fatalf("Unexpected error: %v", err)
 		}
 		if _, err := js.AddStream(&nats.StreamConfig{
-			Name:     "SIDRACE",
-			Subjects: []string{"a"},
-			Storage:  nats.MemoryStorage,
+			Name:         "SIDRACE",
+			Subjects:     []string{"a"},
+			Storage:      nats.MemoryStorage,
+			MaxConsumers: 5000,
 		}); err != nil {
 			t.Fatalf("Unexpected error: %v", err)
 		}
```

---

### Incident Patch 2: `16b1ac36` (2026-09-24)
**Commit Message**: [FIXED] Panic in `micro` package from closed connection (#2154)

* add failing test that panics

* fix: don't add closed subscriptions to subs

**File**: `micro/service.go` (modified, +2/-1)
```diff
@@ -678,7 +678,7 @@ func (s *service) addInternalHandler(nc *nats.Conn, verb Verb, kind, id, name st
 		return err
 	}
 
-	s.verbSubs[name], err = nc.Subscribe(subj, func(msg *nats.Msg) {
+	sub, err := nc.Subscribe(subj, func(msg *nats.Msg) {
 		handler(&request{msg: msg})
 	})
 	if err != nil {
@@ -687,6 +687,7 @@ func (s *service) addInternalHandler(nc *nats.Conn, verb Verb, kind, id, name st
 		}
 		return err
 	}
+	s.verbSubs[name] = sub
 	return nil
 }
 
```

**File**: `micro/test/service_test.go` (modified, +14/-0)
```diff
@@ -537,6 +537,20 @@ func TestAddService(t *testing.T) {
 	}
 }
 
+func TestAddServiceClosedConnection(t *testing.T) {
+	withServer(t, func(t *testing.T, nc *nats.Conn) {
+		nc.Close()
+
+		_, err := micro.AddService(nc, micro.Config{
+			Name:    "test_service",
+			Version: "0.1.0",
+		})
+		if !errors.Is(err, nats.ErrConnectionClosed) {
+			t.Fatalf("Expected %v; got: %v", nats.ErrConnectionClosed, err)
+		}
+	})
+}
+
 func TestErrHandlerSubjectMatch(t *testing.T) {
 	tests := []struct {
 		name             string
```

---

### Incident Patch 3: `203d8289` (2026-09-18)
**Commit Message**: [FIXED] Panic in DecodeHeadersMsg on status tokens shorter than 3 characters (#2101)

* [FIXED] Panic in DecodeHeadersMsg on status tokens shorter than 3 characters

Signed-off-by: Nikitha Mohithe <nikithamohite@Nikithas-MacBook-Air.local>
Signed-off-by: Nikitha Mohithe <nikithamohithe@gmail.com>
Signed-off-by: Nikitha Mohithe <mohitenikki2002@gmail.com>

* Fix test

Signed-off-by: Piotr Piotrowski <piotr@synadia.com>

---------

Signed-off-by: Nikitha Mohithe <nikithamohite@Nikithas-MacBook-Air.local>
Signed-off-by: Nikitha Mohithe <nikithamohithe@gmail.com>
Signed-off-by: Nikitha Mohithe <mohitenikki2002@gmail.com>
Signed-off-by: Piotr Piotrowski <piotr@synadia.com>
Co-authored-by: Piotr Piotrowski <piotr@synadia.com>

**File**: `nats.go` (modified, +4/-1)
```diff
@@ -4518,7 +4518,10 @@ func DecodeHeadersMsg(data []byte) (Header, error) {
 	if len(l) > hdrPreEnd {
 		var description string
 		status := strings.TrimSpace(l[hdrPreEnd:])
-		if len(status) != statusLen {
+		if len(status) < statusLen {
+			return nil, ErrBadHeaderMsg
+		}
+		if len(status) > statusLen {
 			description = strings.TrimSpace(status[statusLen:])
 			status = status[:statusLen]
 		}
```

**File**: `nats_test.go` (modified, +3/-0)
```diff
@@ -1607,6 +1607,9 @@ func TestHeaderParser(t *testing.T) {
 	shouldErr("NATS/1.0\r\n")
 	shouldErr("NATS/1.0\r\nk1:v1")
 	shouldErr("NATS/1.0\r\nk1:v1\r\n")
+	shouldErr("NATS/1.0 5\r\n\r\n")
+	shouldErr("NATS/1.0 41\r\n\r\n")
+	shouldErr("NATS/1.0 \r\n\r\n")
 
 	// Check that we can do inline status and descriptions
 	checkStatus := func(hdr string, status int, description string) {
```

---

### Incident Patch 4: `dc92fca7` (2026-09-18)
**Commit Message**: [FIXED] Ordered consumer silently losing messages on slow consumer (#2137)

Signed-off-by: Piotr Piotrowski <piotr@synadia.com>

**File**: `js.go` (modified, +122/-27)
```diff
@@ -1438,6 +1438,8 @@ type jsSub struct {
 	dseq    uint64
 	sseq    uint64
 	ccreq   *createConsumerRequest
+	// A reset waits for the buffer to drain, see tryResetOrderedConsumer.
+	resetPending bool
 
 	// Heartbeats and Flow Control handling from push consumers.
 	hbc    *time.Timer
@@ -2158,31 +2160,113 @@ func (sub *Subscription) trackSequences(reply string) {
 	sub.jsi.cmeta = reply
 }
 
+// orderedSeqs carries the sequences of a message that passed the ordering check
+// but has not yet been handed off for delivery.
+type orderedSeqs struct {
+	dseq, sseq uint64
+}
+
 // Check to make sure messages are arriving in order.
-// Returns true if the sub had to be replaced. Will cause upper layers to return.
-// The caller has verified that sub.jsi != nil and that this is not a control message.
+// Returns true when m is not the message the ordered consumer was expecting
+// next. The tracker is not advanced here; the returned sequences are applied
+// with commitOrderedMsg once m is queued for delivery.
 // Lock should be held.
-func (sub *Subscription) checkOrderedMsgs(m *Msg) bool {
+func (sub *Subscription) checkOrderedMsgs(m *Msg) (bool, orderedSeqs) {
 	// Ignore msgs with no reply like HBs and flow control, they are handled elsewhere.
 	if m.Reply == _EMPTY_ {
-		return false
+		return false, orderedSeqs{}
 	}
 
 	// Normal message here.
 	tokens, err := parser.GetMetadataFields(m.Reply)
 	if err != nil {
-		return false
+		return false, orderedSeqs{}
 	}
 	sseq, dseq := parser.ParseNum(tokens[parser.AckStreamSeqTokenPos]), parser.ParseNum(tokens[parser.AckConsumerSeqTokenPos])
 
 	jsi := sub.jsi
 	if dseq != jsi.dseq {
-		sub.resetOrderedConsumer(jsi.sseq + 1)
-		return true
+		return true, orderedSeqs{}
+	}
+	return false, orderedSeqs{dseq: dseq, sseq: sseq}
+}
+
+// commitOrderedMsg advances the ordered consumer tracker for a message that has
+// been queued for delivery. Pairs with checkOrderedMsgs.
+// Lock should be held.
+func (sub *Subscription) commitOrderedMsg(seqs orderedSeqs) {
+	if seqs.dseq == 0 {
+		return
+	}
+	sub.jsi.dseq, sub.jsi.sseq = seqs.dseq+1, seqs.sseq
+}
+
+// jsMsgAction tells processMsg what to do with a message once the ordered
+// consumer checks have run against it.
+type jsMsgAction int
+
+const (
+	jsMsgDeliver jsMsgAction = iota
+	// Cannot be delivered. The caller's slow consumer path counts it and
+	// releases the pending accounting reserved for it.
+	jsMsgDrop
+	// Out of order and fully handled. The caller only unlocks and returns.
+	jsMsgDropGap
+)
+
+// checkOrderedDelivery validates an ordered consumer message's place in the
+// sequence and reports what processMsg should do with it.
+//
+// The caller has verified that sub.jsi != nil and that the consumer is ordered.
+// Lock is held on entry and on return, but a reset releases and reacquires it
+// to recreate the consumer.
+func (sub *Subscription) checkOrderedDelivery(m *Msg) (jsMsgAction, orderedSeqs) {
+	jsi := sub.jsi
+	// Everything still arriving belongs to the consumer about to be replaced
+	// and is refetched by the reset, which may have room by now.
+	if jsi.resetPending {
+		sub.tryResetOrderedConsumer()
+		return jsMsgDrop, orderedSeqs{}
+	}
+	// A full channel would drop the message below anyway; checking first keeps
+	// the drop from reading as a gap.
+	if sub.mch != nil && cap(sub.mch) > 0 && len(sub.mch) == cap(sub.mch) {
+		return jsMsgDrop, orderedSeqs{}
+	}
+
+	gap, seqs := sub.checkOrderedMsgs(m)
+	if !gap {
+		return jsMsgDeliver, seqs
+	}
+
+	// An unbuffered channel has no capacity signal. With nothing delivered
+	// since the last reset, resetting again would just refetch into the same
+	// wall, so leave it to the heartbeat. Once something has been delivered
+	// the reader is there and a drop means it was merely busy, so reset at
+	// once; deferring to the heartbeat here would drain a backlog one message
+	// per interval.
+	if sub.mch != nil && cap(sub.mch) == 0 && jsi.dseq == 1 {
+		return jsM
```

**File**: `nats.go` (modified, +41/-9)
```diff
@@ -3756,6 +3756,9 @@ func (nc *Conn) waitForMsgs(s *Subscription) {
 			s.pMsgs--
 			s.pBytes -= msgLen
 			msgLen = -1
+			if s.jsi != nil && s.jsi.resetPending {
+				s.tryResetOrderedConsumer()
+			}
 		}
 
 		if s.pHead == nil && !s.closed {
@@ -3880,6 +3883,7 @@ func (nc *Conn) processMsg(data []byte) {
 	var ctrlMsg bool
 	var ctrlType int
 	var fcReply string
+	var ordSeqs orderedSeqs
 
 	if nc.ps.ma.hdr > 0 {
 		hbuf := msgPayload[:nc.ps.ma.hdr]
@@ -3935,11 +3939,6 @@ func (nc *Conn) processMsg(data []byte) {
 				fcReply = m.Header.Get(consumerStalledHdr)
 			}
 		}
-		// Check for ordered consumer here. If checkOrderedMsgs returns true that means it detected a gap.
-		if !ctrlMsg && jsi.ordered && sub.checkOrderedMsgs(m) {
-			sub.mu.Unlock()
-			return
-		}
 	}
 
 	// Skip processing if this is a control message and
@@ -3967,6 +3966,20 @@ func (nc *Conn) processMsg(data []byte) {
 			chanSubCheckFC = true
 		}
 
+		// Must run here, between the reservation above and the delivery below.
+		// See checkOrderedDelivery.
+		if jsi != nil && jsi.ordered {
+			var action jsMsgAction
+			action, ordSeqs = sub.checkOrderedDelivery(m)
+			switch action {
+			case jsMsgDrop:
+				goto slowConsumer
+			case jsMsgDropGap:
+				sub.mu.Unlock()
+				return
+			}
+		}
+
 		// We have two modes of delivery. One is the channel, used by channel
 		// subscribers and syncSubscribers, the other is a linked list for async.
 		if sub.mch != nil {
@@ -3993,6 +4006,7 @@ func (nc *Conn) processMsg(data []byte) {
 			}
 		}
 		if jsi != nil {
+			sub.commitOrderedMsg(ordSeqs)
 			// Store the ACK metadata from the message to
 			// compare later on with the received heartbeat.
 			sub.trackSequences(m.Reply)
@@ -4051,14 +4065,19 @@ func (nc *Conn) processMsg(data []byte) {
 	return
 
 slowConsumer:
+	// ordSeqs is deliberately not committed here: leaving the tracker behind is
+	// what makes the next message register as a gap and get refetched.
+	// Except for the consumer's first message: with nothing delivered yet the
+	// tracker has no position, and a reset would resume from the start of the
+	// stream rather than from where the consumer was told to start.
+	if jsi != nil && jsi.ordered && jsi.sseq == 0 && ordSeqs.dseq == 1 {
+		jsi.sseq = ordSeqs.sseq - 1
+	}
 	sub.dropped++
 	sc := !sub.sc
 	sub.sc = true
 	// Undo stats from above
-	if sub.typ != ChanSubscription {
-		sub.pMsgs--
-		sub.pBytes -= len(m.Data)
-	}
+	sub.releaseReserved(m)
 	if sc {
 		sub.changeSubStatus(SubscriptionSlowConsumer)
 		sub.mu.Unlock()
@@ -4076,6 +4095,16 @@ slowConsumer:
 	}
 }
 
+// releaseReserved undoes the pending accounting reserved for m earlier in
+// processMsg. pMsgsMax/pBytesMax are deliberately left alone: they are
+// high-water marks of what was reserved. Lock must be held.
+func (sub *Subscription) releaseReserved(m *Msg) {
+	if sub.typ != ChanSubscription {
+		sub.pMsgs--
+		sub.pBytes -= len(m.Data)
+	}
+}
+
 var (
 	permissionsRe      = regexp.MustCompile(`Subscription to "(\S+)"`)
 	permissionsQueueRe = regexp.MustCompile(`using queue "(\S+)"`)
@@ -5737,6 +5766,9 @@ func (s *Subscription) processNextMsgDelivered(msg *Msg) error {
 		s.pMsgs--
 		s.pBytes -= len(msg.Data)
 	}
+	if s.jsi != nil && s.jsi.resetPending {
+		s.tryResetOrderedConsumer()
+	}
 	s.mu.Unlock()
 
 	if fcReply != _EMPTY_ {
```

**File**: `test/js_internal_test.go` (modified, +1/-1)
```diff
@@ -446,7 +446,7 @@ func TestJetStreamFlowControlStalled(t *testing.T) {
 
 // Ordered consumer resets run from the connection read loop and swap the
 // subscription's sid. This exercises that against concurrent unsubscribes,
-// which is where the sid was previously read under a different lock.
+// which read the same field.
 func TestJetStreamOrderedConsumerSIDRace(t *testing.T) {
 	withJSServer(t, func(t *testing.T, nc *nats.Conn) {
 		js, err := nc.JetStream(nats.MaxWait(10 * time.Second))
```

**File**: `test/js_test.go` (modified, +426/-0)
```diff
@@ -10167,3 +10167,429 @@ func TestJetStreamSubscribeContextCancel(t *testing.T) {
 		})
 	})
 }
+
+// oscStream dials inst and creates the stream the ordered consumer tests use.
+func oscStream(t *testing.T, inst *testservice.Instance, opts ...nats.Option) (*nats.Conn, nats.JetStreamContext) {
+	t.Helper()
+	nc := dialInstance(t, inst, opts...)
+	t.Cleanup(nc.Close)
+	js, err := nc.JetStream(nats.MaxWait(10 * time.Second))
+	if err != nil {
+		t.Fatalf("Unexpected error: %v", err)
+	}
+	if _, err := js.AddStream(&nats.StreamConfig{Name: "OSC", Subjects: []string{"osc.>"}}); err != nil {
+		t.Fatalf("Error adding stream: %v", err)
+	}
+	return nc, js
+}
+
+// countConsumerCreates watches consumer-create traffic from a separate connection.
+func countConsumerCreates(t *testing.T, inst *testservice.Instance) *atomic.Int64 {
+	t.Helper()
+	mon := dialInstance(t, inst)
+	t.Cleanup(mon.Close)
+	creates := &atomic.Int64{}
+	if _, err := mon.Subscribe("$JS.API.CONSUMER.CREATE.>", func(*nats.Msg) {
+		creates.Add(1)
+	}); err != nil {
+		t.Fatalf("Error subscribing monitor: %v", err)
+	}
+	if err := mon.Flush(); err != nil {
+		t.Fatalf("Error flushing monitor: %v", err)
+	}
+	return creates
+}
+
+// publishOSC publishes n messages to the stream and waits for the acks.
+func publishOSC(t *testing.T, js nats.JetStreamContext, n int) {
+	t.Helper()
+	publishOSCSized(t, js, n, 1)
+}
+
+func publishOSCSized(t *testing.T, js nats.JetStreamContext, n, size int) {
+	t.Helper()
+	payload := make([]byte, size)
+	for range n {
+		if _, err := js.PublishAsync("osc.a", payload); err != nil {
+			t.Fatalf("Error publishing: %v", err)
+		}
+	}
+	select {
+	case <-js.PublishAsyncComplete():
+	case <-time.After(30 * time.Second):
+		t.Fatalf("Timed out waiting for publishes to complete")
+	}
+}
+
+// seqRecorder records delivered stream sequences in arrival order.
+type seqRecorder struct {
+	mu       sync.Mutex
+	order    []uint64
+	metaErrs []error
+}
+
+func (r *seqRecorder) add(m *nats.Msg) {
+	meta, err := m.Metadata()
+	r.mu.Lock()
+	defer r.mu.Unlock()
+	if err != nil {
+		r.metaErrs = append(r.metaErrs, err)
+		return
+	}
+	r.order = append(r.order, meta.Sequence.Stream)
+}
+
+func (r *seqRecorder) count() int {
+	r.mu.Lock()
+	defer r.mu.Unlock()
+	return len(r.order)
+}
+
+// waitFor fails unless at least want messages arrive within timeout.
+func (r *seqRecorder) waitFor(t *testing.T, want int, timeout time.Duration) {
+	t.Helper()
+	checkFor(t, timeout, 10*time.Millisecond, func() error {
+		if n := r.count(); n < want {
+			return fmt.Errorf("only %d of %d messages delivered", n, want)
+		}
+		return nil
+	})
+}
+
+// readChan drains ch into the recorder until the test ends.
+func (r *seqRecorder) readChan(t *testing.T, ch <-chan *nats.Msg) {
+	stop := make(chan struct{})
+	t.Cleanup(func() { close(stop) })
+	go func() {
+		for {
+			select {
+			case <-stop:
+				return
+			case m := <-ch:
+				r.add(m)
+			}
+		}
+	}()
+}
+
+// verifyComplete asserts the whole stream arrived, in order and exactly once.
+func (r *seqRecorder) verifyComplete(t *testing.T, want int) {
+	t.Helper()
+	r.mu.Lock()
+	defer r.mu.Unlock()
+	if len(r.metaErrs) != 0 {
+		t.Fatalf("Got %d metadata errors, first: %v", len(r.metaErrs), r.metaErrs[0])
+	}
+	if len(r.order) != want {
+		t.Fatalf("Expected %d messages, got %d", want, len(r.order))
+	}
+	for i, sseq := range r.order {
+		if sseq != uint64(i+1) {
+			t.Fatalf("Message %d out of order: expected stream seq %d, got %d", i, i+1, sseq)
+		}
+	}
+}
+
+// waitForDrops fails unless the subscription actually enters slow consumer.
+func waitForDrops(t *testing.T, sub *nats.Subscription) {
+	t.Helper()
+	checkFor(t, 10*time.Second, 10*time.Millisecond, func() error {
+		if dropped, _ := sub.Dropped(); dropped == 0 {
+			return fmt.Errorf("no messages dropped yet")
+		}
+		return nil
+	})
+}
+
+// Messages dropped as slow consumer must be refetched before anything newer,
+// and a reset must wait until the reader ha
```

---

### Incident Patch 5: `e95c424b` (2026-09-16)
**Commit Message**: [FIXED] Flaky cluster restart tests: waitForStream must see a stream leader (#2141)

Signed-off-by: Piotr Piotrowski <piotr@synadia.com>

**File**: `jetstream/test/testservice_helper_test.go` (modified, +12/-5)
```diff
@@ -15,6 +15,7 @@ package test
 
 import (
 	"context"
+	"errors"
 	"fmt"
 	"net/url"
 	"os"
@@ -135,9 +136,11 @@ func withJSCluster(t *testing.T, size int, fn func(*testing.T, *nats.Conn, jetst
 	fn(t, nc, js, inst)
 }
 
-// waitForStream blocks until the stream is queryable again. StartServer
-// returns on ack, not on readiness, so a publish issued right after a restart
-// can race JetStream recovery.
+// waitForStream blocks until the stream is queryable and has a leader.
+// StartServer returns on ack, not on readiness, so a publish issued right
+// after a restart can race JetStream recovery. A bare lookup is not enough:
+// a replica of a group that has been leaderless for a while answers
+// STREAM.INFO itself, and only the leader subscribes to the stream subjects.
 func waitForStream(t *testing.T, js jetstream.JetStream, name string) {
 	t.Helper()
 	// Per-attempt timeout so one slow lookup cannot eat the whole budget:
@@ -146,10 +149,14 @@ func waitForStream(t *testing.T, js jetstream.JetStream, name string) {
 	var err error
 	for time.Now().Before(deadline) {
 		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
-		_, err = js.Stream(ctx, name)
+		var s jetstream.Stream
+		s, err = js.Stream(ctx, name)
 		cancel()
 		if err == nil {
-			return
+			if ci := s.CachedInfo().Cluster; ci == nil || ci.Leader != "" {
+				return
+			}
+			err = errors.New("stream has no leader")
 		}
 		time.Sleep(100 * time.Millisecond)
 	}
```

---

### Incident Patch 6: `daf8f1c2` (2026-09-15)
**Commit Message**: [IMPROVED] Fix list consumers test to work agains latest server (#2138)

Signed-off-by: Piotr Piotrowski <piotr@synadia.com>

**File**: `jetstream/test/stream_test.go` (modified, +6/-1)
```diff
@@ -1177,6 +1177,11 @@ func TestListConsumers(t *testing.T) {
 			consumersNum: 500,
 			timeout:      5 * time.Second,
 		},
+		{
+			name:         "list consumers multiple pages",
+			consumersNum: 1025,
+			timeout:      5 * time.Second,
+		},
 		{
 			name:         "with empty context",
 			consumersNum: 500,
@@ -1196,7 +1201,7 @@ func TestListConsumers(t *testing.T) {
 	for _, test := range tests {
 		t.Run(test.name, func(t *testing.T) {
 			withJSServer(t, func(t *testing.T, _ *nats.Conn, js jetstream.JetStream) {
-				s, err := js.CreateStream(context.Background(), jetstream.StreamConfig{Name: "foo", Subjects: []string{"FOO.*"}})
+				s, err := js.CreateStream(context.Background(), jetstream.StreamConfig{Name: "foo", Subjects: []string{"FOO.*"}, MaxConsumers: 2000})
 				if err != nil {
 					t.Fatalf("Unexpected error: %v", err)
 				}
```

**File**: `test/js_test.go` (modified, +1/-1)
```diff
@@ -4509,7 +4509,7 @@ func TestConsumersLister(t *testing.T) {
 				if err != nil {
 					t.Fatalf("Unexpected error: %v", err)
 				}
-				js.AddStream(&nats.StreamConfig{Name: "foo"})
+				js.AddStream(&nats.StreamConfig{Name: "foo", MaxConsumers: 2000})
 				for i := range test.consumersNum {
 					if _, err := js.AddConsumer("foo", &nats.ConsumerConfig{Durable: fmt.Sprintf("cons_%d", i), AckPolicy: nats.AckExplicitPolicy}); err != nil {
 						t.Fatalf("Unexpected error: %v", err)
```

---

### Incident Patch 7: `4b406b6e` (2026-09-09)
**Commit Message**: [FIXED] Ordered consumer reset resurrecting a removed subscription (#2133)

Signed-off-by: Tomasz Pietrek <tomasz@synadia.com>
Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `js.go` (modified, +56/-12)
```diff
@@ -2184,14 +2184,23 @@ func (sub *Subscription) checkOrderedMsgs(m *Msg) bool {
 	return false
 }
 
-// Update and replace sid. Returns the old and the new sid.
+// Update and replace sid. Returns the old and the new sid. Returns ok == false,
+// leaving everything untouched, if the subscription is no longer registered on
+// the connection.
 // Lock should be held on entry but will be unlocked to prevent lock inversion.
-func (sub *Subscription) applyNewSID() (osid, nsid int64) {
+func (sub *Subscription) applyNewSID() (osid, nsid int64, ok bool) {
 	nc := sub.conn
 	sub.mu.Unlock()
 
 	nc.subsMu.Lock()
 	osid = sub.sid
+	// removeSub or close() may have run while sub.mu was released;
+	// re-registering would resurrect the sub or write to a nil nc.subs.
+	if nc.subs[osid] != sub {
+		nc.subsMu.Unlock()
+		sub.mu.Lock()
+		return osid, 0, false
+	}
 	delete(nc.subs, osid)
 	// Place new one.
 	nc.ssid++
@@ -2201,15 +2210,15 @@ func (sub *Subscription) applyNewSID() (osid, nsid int64) {
 	nc.subsMu.Unlock()
 
 	sub.mu.Lock()
-	return osid, nsid
+	return osid, nsid, true
 }
 
 // We are here if we have detected a gap with an ordered consumer.
 // We will create a new consumer and rewire the low level subscription.
 // Lock should be held.
 func (sub *Subscription) resetOrderedConsumer(sseq uint64) {
 	nc := sub.conn
-	if sub.jsi == nil || nc == nil || sub.closed {
+	if sub.jsi == nil || nc == nil || sub.closed || sub.draining {
 		return
 	}
 
@@ -2239,7 +2248,10 @@ func (sub *Subscription) resetOrderedConsumer(sseq uint64) {
 	}
 
 	// Quick unsubscribe. Since we know this is a simple push subscriber we do in place.
-	osid, nsid := sub.applyNewSID()
+	osid, nsid, ok := sub.applyNewSID()
+	if !ok {
+		return
+	}
 
 	// Grab new inbox.
 	newDeliver := nc.NewInbox()
@@ -2251,14 +2263,9 @@ func (sub *Subscription) resetOrderedConsumer(sseq uint64) {
 		// Unsubscribe and subscribe with new inbox and sid.
 		// Remap a new low level sub into this sub since its client accessible.
 		// This is done here in this go routine to prevent lock inversion.
-		nc.mu.Lock()
-		nc.bw.appendString(fmt.Sprintf(unsubProto, osid, _EMPTY_))
-		nc.bw.appendString(fmt.Sprintf(subProto, newDeliver, _EMPTY_, nsid))
-		if maxStr != _EMPTY_ {
-			nc.bw.appendString(fmt.Sprintf(unsubProto, nsid, maxStr))
+		if !nc.rewireOrderedSub(sub, osid, nsid, newDeliver, maxStr) {
+			return
 		}
-		nc.kickFlusher()
-		nc.mu.Unlock()
 
 		pushErr := func(err error) {
 			nc.handleConsumerSequenceMismatch(sub, fmt.Errorf("%w: recreating ordered consumer", err))
@@ -2324,11 +2331,48 @@ func (sub *Subscription) resetOrderedConsumer(sseq uint64) {
 		}
 
 		sub.mu.Lock()
+		if sub.closed || sub.draining {
+			// Unsubscribed or drained while the consumer was being created.
+			// The consumer is not attached to anything anymore, so delete it
+			// rather than waiting for the inactivity threshold.
+			sub.mu.Unlock()
+			go js.DeleteConsumer(jsi.stream, cinfo.Name)
+			return
+		}
 		jsi.consumer = cinfo.Name
 		sub.mu.Unlock()
 	}()
 }
 
+// rewireOrderedSub moves the subscription from osid to nsid on the server.
+// The old sid is always unsubscribed; the new one is only subscribed if the
+// subscription is still registered and not draining, so that no interest is
+// created for a subscription that will not accept messages anymore. Returns
+// whether that happened. unsubscribe runs under nc.mu too, so the check is
+// exact.
+func (nc *Conn) rewireOrderedSub(sub *Subscription, osid, nsid int64, deliver, maxStr string) bool {
+	nc.mu.Lock()
+	defer nc.mu.Unlock()
+
+	nc.bw.appendString(fmt.Sprintf(unsubProto, osid, _EMPTY_))
+	nc.subsMu.RLock()
+	sub.mu.Lock()
+	// A draining subscription is only removed from nc.subs once the drain
+	// completes, and that removal sends no UNSUB, so subscribing the new sid
+	// here would leave interest on the server for the life of the connection.
+	registered := nc.subs[nsid] == sub && !sub.draining
+	sub.mu.Unlock()
+	nc.subsMu.R
```

**File**: `js_test.go` (modified, +125/-1)
```diff
@@ -1,4 +1,4 @@
-// Copyright 2012-2023 The NATS Authors
+// Copyright 2012-2026 The NATS Authors
 // Licensed under the Apache License, Version 2.0 (the "License");
 // you may not use this file except in compliance with the License.
 // You may obtain a copy of the License at
@@ -19,6 +19,7 @@ package nats
 
 import (
 	"errors"
+	"fmt"
 	"strings"
 	"testing"
 )
@@ -131,3 +132,126 @@ func TestJetStreamConvertDirectMsgResponseToMsg(t *testing.T) {
 		t.Fatalf("Wrong header: %v", r.Header)
 	}
 }
+
+func TestApplyNewSIDUnregisteredSub(t *testing.T) {
+	newConn := func() (*Conn, *Subscription) {
+		nc := &Conn{subs: make(map[int64]*Subscription)}
+		sub := &Subscription{conn: nc}
+		nc.ssid++
+		sub.sid = nc.ssid
+		nc.subs[sub.sid] = sub
+		return nc, sub
+	}
+
+	t.Run("registered sub is re-keyed", func(t *testing.T) {
+		nc, sub := newConn()
+		sub.mu.Lock()
+		osid, nsid, ok := sub.applyNewSID()
+		sub.mu.Unlock()
+		if !ok {
+			t.Fatal("expected the sid swap to succeed for a registered sub")
+		}
+		if osid != 1 || nsid != 2 {
+			t.Fatalf("expected sids 1 -> 2, got %d -> %d", osid, nsid)
+		}
+		if sub.sid != nsid || nc.subs[nsid] != sub || len(nc.subs) != 1 {
+			t.Fatalf("sub not registered under the new sid only: sid=%d subs=%v", sub.sid, nc.subs)
+		}
+	})
+
+	t.Run("removed sub is not re-registered", func(t *testing.T) {
+		// Simulates removeSub winning the race: the sub was unsubscribed
+		// while applyNewSID had released sub.mu.
+		nc, sub := newConn()
+		delete(nc.subs, sub.sid)
+		sub.mu.Lock()
+		_, _, ok := sub.applyNewSID()
+		sub.mu.Unlock()
+		if ok {
+			t.Fatal("expected the sid swap to be refused for an unregistered sub")
+		}
+		if len(nc.subs) != 0 {
+			t.Fatalf("unsubscribed sub was resurrected in the subs map: %v", nc.subs)
+		}
+		if sub.sid != 1 {
+			t.Fatalf("sid of an unregistered sub should be untouched, got %d", sub.sid)
+		}
+	})
+
+	t.Run("closed connection does not panic", func(t *testing.T) {
+		// close() sets nc.subs to nil, and writing to a nil map panics.
+		nc, sub := newConn()
+		nc.subs = nil
+		sub.mu.Lock()
+		_, _, ok := sub.applyNewSID()
+		sub.mu.Unlock()
+		if ok {
+			t.Fatal("expected the sid swap to be refused on a closed connection")
+		}
+	})
+}
+
+func TestRewireOrderedSub(t *testing.T) {
+	const osid, nsid, deliver, maxStr = 1, 2, "_INBOX.new", "5"
+	newConn := func() (*Conn, *Subscription) {
+		// A writer with a large limit never flushes, so the protocol lines
+		// stay in bufs for inspection.
+		nc := &Conn{subs: make(map[int64]*Subscription), bw: &natsWriter{limit: 1 << 20}}
+		sub := &Subscription{conn: nc, sid: nsid}
+		nc.ssid = nsid
+		nc.subs[nsid] = sub
+		return nc, sub
+	}
+	unsubOld := fmt.Sprintf(unsubProto, osid, _EMPTY_)
+	subNew := fmt.Sprintf(subProto, deliver, _EMPTY_, nsid)
+	unsubMax := fmt.Sprintf(unsubProto, nsid, maxStr)
+
+	t.Run("registered sub is moved to the new sid", func(t *testing.T) {
+		nc, sub := newConn()
+		if !nc.rewireOrderedSub(sub, osid, nsid, deliver, maxStr) {
+			t.Fatal("expected the rewire to proceed for a registered sub")
+		}
+		if got, want := string(nc.bw.bufs), unsubOld+subNew+unsubMax; got != want {
+			t.Fatalf("unexpected protocol:\n got %q\nwant %q", got, want)
+		}
+	})
+
+	t.Run("removed sub only gets the old sid unsubscribed", func(t *testing.T) {
+		// Simulates Unsubscribe landing between applyNewSID and the
+		// goroutine that sends the protocol: it removed the sub under the
+		// new sid, so no interest (nor consumer) must be created for it.
+		nc, sub := newConn()
+		delete(nc.subs, nsid)
+		if nc.rewireOrderedSub(sub, osid, nsid, deliver, maxStr) {
+			t.Fatal("expected the rewire to be refused for an unregistered sub")
+		}
+		if got, want := string(nc.bw.bufs), unsubOld; got != want {
+			t.Fatalf("unexpected protocol:\n got %q\nwant %q", got, want)
+		}
+	})
+
+	t.Run("draining sub only gets the old sid unsubscribed", func(t *testing.T) {
+		// A draining sub stays in nc.subs until the drain complete
```

**File**: `test/js_internal_test.go` (modified, +9/-0)
```diff
@@ -483,6 +483,12 @@ func TestJetStreamOrderedConsumerSIDRace(t *testing.T) {
 		})
 		defer nc.RemoveMsgFilter("a")
 
+		// Everything created below is torn down again, so the number of
+		// low level subscriptions must come back to this after every round:
+		// a reset racing with Unsubscribe used to re-register the removed
+		// subscription under a new sid.
+		baseSubs := nc.NumSubscriptions()
+
 		const rounds, subsPerRound = 15, 12
 		for range rounds {
 			subs := make([]*nats.Subscription, 0, subsPerRound)
@@ -506,6 +512,9 @@ func TestJetStreamOrderedConsumerSIDRace(t *testing.T) {
 				}()
 			}
 			wg.Wait()
+			if n := nc.NumSubscriptions(); n != baseSubs {
+				t.Fatalf("Expected %d subscriptions after unsubscribing, got %d", baseSubs, n)
+			}
 		}
 		// Not proof that a reset happened, but without injected gaps the
 		// test would not be exercising the reset path at all.
```

---

### Incident Patch 8: `afa49df2` (2026-09-09)
**Commit Message**: [FIXED] Messages(): handle a reconnect that completes between Next calls (#2135)

* [FIXED] Messages(): handle a reconnect that completes between Next calls

The pull request accounting of a Messages() iterator was only reset on
reconnect if the same Next call had observed both the RECONNECTING and
the CONNECTED status change: isConnected was a local of Next. With Next
driven by a short NextMaxWait, the reconnect regularly completed between
two calls, the CONNECTED event was discarded, pending stayed at the batch
size and no new pull request was ever sent. The iterator then went silent
on a healthy connection, permanently, with Next returning ErrTimeout and
the server reporting no waiting pull requests.

Track the connection state in the status goroutine that lives as long as
the iterator, and only forward a CONNECTED that follows a RECONNECTING.
Next now treats every errConnected as a real reconnect. The status
forwards also select on done so the goroutine cannot block forever on a
full errs channel after Stop.

Add a regression test that restarts the server while Next is polled with
a 100ms NextMaxWait; it fails on main with 5 of 10 messages delivered.

Signed-off-by: Parham Alva

**File**: `jetstream/pull.go` (modified, +36/-18)
```diff
@@ -560,17 +560,37 @@ func (p *pullConsumer) Messages(opts ...PullMessagesOpt) (MessagesContext, error
 	go sub.pullMessages(subject)
 
 	go func() {
+		// Connection state is tracked here, for the lifetime of the
+		// iterator, rather than inside Next: a reconnect that completes
+		// between two Next calls (for example when Next is driven with a
+		// short NextMaxWait) must still reset the pull request accounting,
+		// otherwise no new pull request is ever sent and the iterator goes
+		// silent on a healthy connection.
+		isConnected := true
 		for {
 			select {
 			case status, ok := <-sub.connStatusChanged:
 				if !ok {
 					return
 				}
-				if status == nats.CONNECTED {
-					sub.errs <- errConnected
-				}
-				if status == nats.RECONNECTING {
-					sub.errs <- errDisconnected
+				switch status {
+				case nats.RECONNECTING:
+					isConnected = false
+					select {
+					case sub.errs <- errDisconnected:
+					case <-sub.done:
+						return
+					}
+				case nats.CONNECTED:
+					if isConnected {
+						continue
+					}
+					isConnected = true
+					select {
+					case sub.errs <- errConnected:
+					case <-sub.done:
+						return
+					}
 				}
 			case <-sub.done:
 				return
@@ -633,7 +653,6 @@ func (s *pullSubscription) Next(opts ...NextOpt) (Msg, error) {
 		}
 	}()
 
-	isConnected := true
 	if s.consumeOpts.StopAfter > 0 && s.delivered >= s.consumeOpts.StopAfter {
 		s.Stop()
 		return nil, ErrMsgIteratorClosed
@@ -686,24 +705,23 @@ func (s *pullSubscription) Next(opts ...NextOpt) (Msg, error) {
 				}
 			}
 			if errors.Is(err, errConnected) {
-				if !isConnected {
-					isConnected = true
-
-					if s.consumeOpts.notifyOnReconnect {
-						return nil, errConnected
-					}
-					s.pending.msgCount = 0
-					s.pending.byteCount = 0
-					if hbMonitor != nil {
-						hbMonitor.Reset(2 * s.consumeOpts.Heartbeat)
-					}
+				// errConnected is only sent for a CONNECTED that follows a
+				// RECONNECTING, so this is always a real reconnect: the pull
+				// request parked on the previous server is gone and a new one
+				// has to be issued.
+				if s.consumeOpts.notifyOnReconnect {
+					return nil, errConnected
+				}
+				s.pending.msgCount = 0
+				s.pending.byteCount = 0
+				if hbMonitor != nil {
+					hbMonitor.Reset(2 * s.consumeOpts.Heartbeat)
 				}
 			}
 			if errors.Is(err, errDisconnected) {
 				if hbMonitor != nil {
 					hbMonitor.Stop()
 				}
-				isConnected = false
 			}
 		case <-timeoutCh:
 			return nil, nats.ErrTimeout
```

**File**: `jetstream/test/pull_test.go` (modified, +67/-0)
```diff
@@ -19,6 +19,7 @@ import (
 	"errors"
 	"fmt"
 	"sync"
+	"sync/atomic"
 	"testing"
 	"time"
 
@@ -1507,6 +1508,72 @@ func TestPullConsumerMessages(t *testing.T) {
 		})
 	})
 
+	t.Run("with server restart and short Next timeout", func(t *testing.T) {
+		// Reconnect handling used to be tracked per Next call, so a reconnect
+		// that completed between two short Next calls was never acted on: the
+		// pull request parked on the old server was still counted as pending,
+		// no new pull request was sent and the iterator went silent on a
+		// healthy connection.
+		withJSServerInstance(t, func(t *testing.T, _ *nats.Conn, js jetstream.JetStream, inst *testservice.Instance) {
+			ctx := newTesterCtx(t, 5*time.Second)
+			s, err := js.CreateStream(ctx, jetstream.StreamConfig{Name: "foo", Subjects: []string{"FOO.*"}})
+			if err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+			c, err := s.CreateOrUpdateConsumer(ctx, jetstream.ConsumerConfig{Durable: "cons", AckPolicy: jetstream.AckExplicitPolicy})
+			if err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+			it, err := c.Messages()
+			if err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+			defer it.Stop()
+
+			var received atomic.Int32
+			done := make(chan struct{})
+			errs := make(chan error, 1)
+			go func() {
+				for received.Load() < int32(2*len(testMsgs)) {
+					msg, err := it.Next(jetstream.NextMaxWait(100 * time.Millisecond))
+					if errors.Is(err, nats.ErrTimeout) {
+						continue
+					}
+					if err != nil {
+						errs <- err
+						return
+					}
+					msg.Ack()
+					received.Add(1)
+				}
+				close(done)
+			}()
+
+			publishTestMsgs(t, js)
+			checkFor(t, 5*time.Second, 50*time.Millisecond, func() error {
+				if n := received.Load(); n != int32(len(testMsgs)) {
+					return fmt.Errorf("expected %d messages before restart; got %d", len(testMsgs), n)
+				}
+				return nil
+			})
+
+			// restart the server; the reconnect completes while no Next call
+			// is in flight for long enough to observe it
+			inst.StopServer(t, inst.Servers[0])
+			inst.StartServer(t, inst.Servers[0])
+			waitForStream(t, js, "foo")
+			publishTestMsgs(t, js)
+
+			select {
+			case <-done:
+			case err := <-errs:
+				t.Fatalf("Unexpected error: %s", err)
+			case <-time.After(10 * time.Second):
+				t.Fatalf("Timeout waiting for messages after restart; got %d of %d", received.Load(), 2*len(testMsgs))
+			}
+		})
+	})
+
 	t.Run("with graceful shutdown", func(t *testing.T) {
 		cases := map[string]func(jetstream.MessagesContext){
 			"stop":  func(mc jetstream.MessagesContext) { mc.Stop() },
```

---

### Incident Patch 9: `d455dd93` (2026-09-08)
**Commit Message**: [FIXED] Data race on Subscription.sid between applyNewSID and removeSub (#2122)

Signed-off-by: Piotr Piotrowski <piotr@synadia.com>

**File**: `js.go` (modified, +15/-13)
```diff
@@ -1,4 +1,4 @@
-// Copyright 2020-2025 The NATS Authors
+// Copyright 2020-2026 The NATS Authors
 // Licensed under the Apache License, Version 2.0 (the "License");
 // you may not use this file except in compliance with the License.
 // You may obtain a copy of the License at
@@ -2184,9 +2184,9 @@ func (sub *Subscription) checkOrderedMsgs(m *Msg) bool {
 	return false
 }
 
-// Update and replace sid.
+// Update and replace sid. Returns the old and the new sid.
 // Lock should be held on entry but will be unlocked to prevent lock inversion.
-func (sub *Subscription) applyNewSID() (osid int64) {
+func (sub *Subscription) applyNewSID() (osid, nsid int64) {
 	nc := sub.conn
 	sub.mu.Unlock()
 
@@ -2195,13 +2195,13 @@ func (sub *Subscription) applyNewSID() (osid int64) {
 	delete(nc.subs, osid)
 	// Place new one.
 	nc.ssid++
-	nsid := nc.ssid
+	nsid = nc.ssid
 	nc.subs[nsid] = sub
+	sub.sid = nsid
 	nc.subsMu.Unlock()
 
 	sub.mu.Lock()
-	sub.sid = nsid
-	return osid
+	return osid, nsid
 }
 
 // We are here if we have detected a gap with an ordered consumer.
@@ -2222,27 +2222,29 @@ func (sub *Subscription) resetOrderedConsumer(sseq uint64) {
 			maxStr = strconv.Itoa(int(adjustedMax))
 		} else {
 			// We are already at the max, so we should just unsub the
-			// existing sub and be done
-			go func(sid int64) {
+			// existing sub and be done. The sid is read in the go routine
+			// because it is protected by subsMu, which cannot be acquired
+			// here since sub.mu is held.
+			go func() {
 				nc.mu.Lock()
+				nc.subsMu.RLock()
+				sid := sub.sid
+				nc.subsMu.RUnlock()
 				nc.bw.appendString(fmt.Sprintf(unsubProto, sid, _EMPTY_))
 				nc.kickFlusher()
 				nc.mu.Unlock()
-			}(sub.sid)
+			}()
 			return
 		}
 	}
 
 	// Quick unsubscribe. Since we know this is a simple push subscriber we do in place.
-	osid := sub.applyNewSID()
+	osid, nsid := sub.applyNewSID()
 
 	// Grab new inbox.
 	newDeliver := nc.NewInbox()
 	sub.Subject = newDeliver
 
-	// Snapshot the new sid under sub lock.
-	nsid := sub.sid
-
 	// We are still in the low level readLoop for the connection so we need
 	// to spin a go routine to try to create the new consumer.
 	go func() {
```

**File**: `nats.go` (modified, +45/-25)
```diff
@@ -24,6 +24,7 @@ import (
 	"errors"
 	"fmt"
 	"io"
+	"maps"
 	"math/rand"
 	"net"
 	"net/http"
@@ -647,16 +648,24 @@ type Conn struct {
 	mu sync.RWMutex
 	// Opts holds the configuration of the Conn.
 	// Modifying the configuration of a running Conn is a race.
-	Opts          Options
-	wg            sync.WaitGroup
-	srvPool       []*Server
-	current       *Server
-	urls          map[string]struct{} // Keep track of all known URLs (used by processInfo)
-	conn          net.Conn
-	bw            *natsWriter
-	br            *natsReader
-	fch           chan struct{}
-	info          ServerInfo
+	Opts    Options
+	wg      sync.WaitGroup
+	srvPool []*Server
+	current *Server
+	urls    map[string]struct{} // Keep track of all known URLs (used by processInfo)
+	conn    net.Conn
+	bw      *natsWriter
+	br      *natsReader
+	fch     chan struct{}
+	info    ServerInfo
+	// subsMu protects subs, ssid and the sid of every Subscription in subs,
+	// so that a subscription and the id it is registered under always stay
+	// in sync.
+	//
+	// The lock ordering for a connection is nc.mu -> nc.subsMu -> sub.mu:
+	// each of these may be acquired while holding any of the ones to its
+	// left, and none of them may be acquired while holding one to its
+	// right.
 	ssid          int64
 	subsMu        sync.RWMutex
 	subs          map[int64]*Subscription
@@ -704,7 +713,10 @@ type natsWriter struct {
 
 // Subscription represents interest in a given subject.
 type Subscription struct {
-	mu  sync.Mutex
+	mu sync.Mutex
+
+	// Key under which this subscription is registered in conn.subs.
+	// Protected by conn.subsMu, not by the mutex above.
 	sid int64
 
 	// Subject that represents this subscription. This can be different
@@ -4051,6 +4063,7 @@ func (nc *Conn) processTransientError(err error) {
 				q = queueMatches[1]
 			}
 			subject := matches[1]
+			nc.subsMu.RLock()
 			for _, sub := range nc.subs {
 				if sub.Subject == subject && sub.Queue == q && sub.permissionsErr == nil {
 					sub.mu.Lock()
@@ -4061,6 +4074,7 @@ func (nc *Conn) processTransientError(err error) {
 					sub.mu.Unlock()
 				}
 			}
+			nc.subsMu.RUnlock()
 		}
 	}
 	if asyncErrorCB := nc.Opts.AsyncErrorCB; asyncErrorCB != nil {
@@ -5071,8 +5085,9 @@ func (nc *Conn) subscribeLocked(subj, queue string, cb MsgHandler, ch chan *Msg,
 
 	nc.subsMu.Lock()
 	nc.ssid++
-	sub.sid = nc.ssid
-	nc.subs[sub.sid] = sub
+	sid := nc.ssid
+	sub.sid = sid
+	nc.subs[sid] = sub
 	nc.subsMu.Unlock()
 
 	// Let's start the go routine now that it is fully setup and registered.
@@ -5083,7 +5098,7 @@ func (nc *Conn) subscribeLocked(subj, queue string, cb MsgHandler, ch chan *Msg,
 	// We will send these for all subs when we reconnect
 	// so that we can suppress here if reconnecting.
 	if !nc.isReconnecting() {
-		nc.bw.appendString(fmt.Sprintf(subProto, subj, queue, sub.sid))
+		nc.bw.appendString(fmt.Sprintf(subProto, subj, queue, sid))
 		nc.kickFlusher()
 	}
 
@@ -5093,8 +5108,8 @@ func (nc *Conn) subscribeLocked(subj, queue string, cb MsgHandler, ch chan *Msg,
 
 // NumSubscriptions returns active number of subscriptions.
 func (nc *Conn) NumSubscriptions() int {
-	nc.mu.RLock()
-	defer nc.mu.RUnlock()
+	nc.subsMu.RLock()
+	defer nc.subsMu.RUnlock()
 	return len(nc.subs)
 }
 
@@ -5455,7 +5470,13 @@ func (nc *Conn) unsubscribe(sub *Subscription, max int, drainMode bool) error {
 	// We will send these for all subs when we reconnect
 	// so that we can suppress here.
 	if !nc.isReconnecting() {
-		nc.bw.appendString(fmt.Sprintf(unsubProto, s.sid, maxStr))
+		// Deliberately re-read the sid: in the AutoUnsubscribe case removeSub
+		// is skipped, so an ordered consumer reset may have swapped it since
+		// the lookup above and the max has to apply to what the server knows.
+		nc.subsMu.RLock()
+		sid := s.sid
+		nc.subsMu.RUnlock()
+		nc.bw.appendString(fmt.Sprintf(unsubProto, sid, maxStr))
 		nc.kickFlusher()
 	}
 
@@ -5997,14 +6018,11 @@ func (nc *Conn) Buffered() (int, error) {
 func (nc *Co
```

**File**: `test/js_internal_test.go` (modified, +72/-0)
```diff
@@ -21,6 +21,7 @@ import (
 	"fmt"
 	"math/rand"
 	"strings"
+	"sync"
 	"sync/atomic"
 	"testing"
 	"time"
@@ -442,3 +443,74 @@ func TestJetStreamFlowControlStalled(t *testing.T) {
 		}
 	})
 }
+
+// Ordered consumer resets run from the connection read loop and swap the
+// subscription's sid. This exercises that against concurrent unsubscribes,
+// which is where the sid was previously read under a different lock.
+func TestJetStreamOrderedConsumerSIDRace(t *testing.T) {
+	withJSServer(t, func(t *testing.T, nc *nats.Conn) {
+		js, err := nc.JetStream(nats.MaxWait(10 * time.Second))
+		if err != nil {
+			t.Fatalf("Unexpected error: %v", err)
+		}
+		if _, err := js.AddStream(&nats.StreamConfig{
+			Name:     "SIDRACE",
+			Subjects: []string{"a"},
+			Storage:  nats.MemoryStorage,
+		}); err != nil {
+			t.Fatalf("Unexpected error: %v", err)
+		}
+		for range 200 {
+			if _, err := js.PublishAsync("a", []byte("hello")); err != nil {
+				t.Fatalf("Unexpected error: %v", err)
+			}
+		}
+		select {
+		case <-js.PublishAsyncComplete():
+		case <-time.After(5 * time.Second):
+			t.Fatalf("Did not receive completion signal")
+		}
+
+		// Drop roughly half of the delivered messages so that every ordered
+		// consumer keeps detecting gaps and resetting itself.
+		var dropped atomic.Uint64
+		nc.AddMsgFilter("a", func(m *nats.Msg) *nats.Msg {
+			if rand.Intn(2) == 0 {
+				dropped.Add(1)
+				return nil
+			}
+			return m
+		})
+		defer nc.RemoveMsgFilter("a")
+
+		const rounds, subsPerRound = 15, 12
+		for range rounds {
+			subs := make([]*nats.Subscription, 0, subsPerRound)
+			for range subsPerRound {
+				sub, err := js.Subscribe("a", func(m *nats.Msg) {},
+					nats.OrderedConsumer(), nats.IdleHeartbeat(100*time.Millisecond))
+				if err != nil {
+					t.Fatalf("Unexpected error: %v", err)
+				}
+				subs = append(subs, sub)
+			}
+			// Let the resets start churning, then tear everything down from
+			// a set of independent go routines.
+			time.Sleep(time.Duration(20+rand.Intn(60)) * time.Millisecond)
+			var wg sync.WaitGroup
+			for _, sub := range subs {
+				wg.Add(1)
+				go func() {
+					defer wg.Done()
+					sub.Unsubscribe()
+				}()
+			}
+			wg.Wait()
+		}
+		// Not proof that a reset happened, but without injected gaps the
+		// test would not be exercising the reset path at all.
+		if n := dropped.Load(); n == 0 {
+			t.Fatalf("Expected the filter to drop messages, got %d", n)
+		}
+	})
+}
```

---

### Incident Patch 10: `02b0e3e8` (2026-09-07)
**Commit Message**: [FIXED] Migrate golangci-lint config to v2 (#2134)

The v1 binary cannot decode export data from current Go toolchains, so
typechecking collapsed and the lint job failed on every branch.

Signed-off-by: Piotr Piotrowski <piotr@synadia.com>

**File**: `.github/workflows/ci.yaml` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ jobs:
                 go mod download -modfile=go_test.mod
                 go install honnef.co/go/tools/cmd/staticcheck@latest
                 go install github.com/client9/misspell/cmd/misspell@latest
-                go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
+                go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest
 
             - name: Run linters
               shell: bash --noprofile --norc -x -eo pipefail {0}
```

**File**: `.golangci.yaml` (modified, +40/-13)
```diff
@@ -1,16 +1,43 @@
+version: "2"
+linters:
+  settings:
+    staticcheck:
+      # The merged staticcheck linter pulls in more check families than this
+      # repo has ever run; keep it to the set that was in force before.
+      checks:
+        - SA*
+        - S1*
+  exclusions:
+    generated: lax
+    presets:
+      - comments
+      - common-false-positives
+      - legacy
+      - std-error-handling
+    rules:
+      - linters:
+          - errcheck
+        text: Unsubscribe
+      - linters:
+          - errcheck
+        text: Drain
+      - linters:
+          - errcheck
+        text: msg.Ack
+      - linters:
+          - errcheck
+        text: watcher.Stop
+    paths:
+      - third_party$
+      - builtin$
+      - examples$
 issues:
   max-issues-per-linter: 0
   max-same-issues: 0
-  exclude-rules:
-    - linters:
-      - errcheck
-      text: "Unsubscribe"
-    - linters:
-      - errcheck
-      text: "Drain"
-    - linters:
-      - errcheck
-      text: "msg.Ack"
-    - linters:
-      - errcheck
-      text: "watcher.Stop"
+formatters:
+  exclusions:
+    generated: lax
+    paths:
+      - third_party$
+      - builtin$
+      - examples$
```

#### Recent Merged Pull Requests:
- **PR #2155** (2026-09-25): [IMPROVED] Fix ordered consumer test exceeding 1000 consumers created (@piotrpio)
- **PR #2154** (2026-09-24): Fix panic in `micro` package from closed connection (@joeriddles)
- **PR #2148** (2026-09-18): Release v1.54.0 (@piotrpio)
- **PR #2146** (2026-09-18): [IMPROVED] Bump dependencies and update server version in CI (@piotrpio)
- **PR #2145** (2026-09-16): Add `nats.MultipathTCP()` for enabling or disabling MPTCP (@neilalexander)
- **PR #2144** (2026-09-16): [ADDED] Desired state, peer ID/pending and source seq in stream and consumer infos (@piotrpio)
- **PR #2142** (2026-09-16): [ADDED] Nats-Schedule-Rollup header const and publish options (@piotrpio)
- **PR #2141** (2026-09-16): [FIXED] Flaky cluster restart tests: waitForStream must see a stream leader (@piotrpio)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
