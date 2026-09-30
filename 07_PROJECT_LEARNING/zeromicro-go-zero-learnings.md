# Forensic Learning Record (Deep Inspection): zeromicro/go-zero

> **Canonical Artifact**: `07_PROJECT_LEARNING/zeromicro-go-zero-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zeromicro/go-zero](https://github.com/zeromicro/go-zero))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:04:03.047Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zeromicro/go-zero`
- **Description**: A cloud-native Go microservices framework with cli tool for productivity.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod
- **Stars / Engagement**: 33363 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `core/bloom/bloom.go`
```
package bloom

import (
	"context"
	_ "embed"
	"errors"
	"strconv"

	"github.com/zeromicro/go-zero/core/hash"
	"github.com/zeromicro/go-zero/core/stores/redis"
)

// for detailed error rate table, see http://pages.cs.wisc.edu/~cao/papers/summary-cache/node8.html
// maps as k in the error rate table
const maps = 14

var (
	// ErrTooLargeOffset indicates the offset is too large in bitset.
	ErrTooLargeOffset = errors.New("too large offset")

	//go:embed setscript.lua
	setLuaScript string
	setScript    = redis.NewScript(setLuaScript)

	//go:embed testscript.lua
	testLuaScript string
	testScript    = redis.NewScript(testLuaScript)
)

type (
	// A Filter is a bloom filter.
	Filter struct {
		bits   uint
		bitSet bitSetProvider
	}

	bitSetProvider interface {
		check(ctx context.Context, offsets []uint) (bool, error)
		set(ctx context.Context, offsets []uint) error
	}
)

// New creates a Filter, store is the backed redis, key is the key for the bloom filter,
// bits is how many bits will be used, maps is how many hashes for each addition.
// best practices:
// elements - means how many actual elements
// when maps = 14, formula: 0.7*(bits/maps), bits = 20*elements, the error rate is 0.000067 < 1e-4
// for detailed error rate table, see http://pages.cs.wisc.edu/~cao/papers/summary-cache/node8.html
func New(store *redis.Redis, key string, bits uint) *Filter {
	return &Filter{
		bits:   bits,
		bitSet: newRedisBitSet(store, key, bits),
	}
}

// Add adds data into f.
func (f *Filter) Add(data []byte) error {
	return f.AddCtx(context.Background(), data)
}

// AddCtx adds data into f with context.
func (f *Filter) AddCtx(ctx context.Context, data []byte) error {
	locations := f.getLocations(data)
	return f.bitSet.set(ctx, locations)
}

// Exists checks if data is in f.
func (f *Filter) Exists(data []byte) (bool, error) {
	return f.ExistsCtx(context.Background(), data)
}

// ExistsCtx checks if data is in f with context.
func (f *Filter) ExistsCtx(ctx context.Context, data []byte) (bool, error) {
	locations := f.getLocations(data)
	isSet, err := f.bitSet.check(ctx, locations)
	if err != nil {
		return false, err
	}

	return isSet, nil
}

func (f *Filter) getLocations(data []byte) []uint {
	locations := make([]uint, maps)
	for i := uint(0); i < maps; i++ {
		hashValue := hash.Hash(append(data, byte(i)))
		locations[i] = uint(hashValue % uint64(f.bits))
	}

	return locations
}

type redisBitSet struct {
	store *redis.Redis
	key   string
	bits  uint
}

func newRedisBitSet(store *redis.Redis, key string, bits uint) *redisBitSet {
	return &redisBitSet{
		store: store,
		key:   key,
		bits:  bits,
	}
}

func (r *redisBitSet) buildOffsetArgs(offsets []uint) ([]string, error) {
	args := make([]string, 0, len(offsets))

	for _, offset := range offsets {
		if offset >= r.bits {
			return nil, ErrTooLargeOffset
		}

		args = append(args, strconv.FormatUint(uint64(offset), 10))
	}

	return args, nil
}

func (r *redisBitSet) check(ctx context.Context, offsets []uint) (bool, error) {
	args, err := r.buildOffsetArgs(offsets)
	if err != nil {
		return false, err
	}

	resp, err := r.store.ScriptRunCtx(ctx, testScript, []string{r.key}, args)
	if errors.Is(err, redis.Nil) {
		return false, nil
	} else if err != nil {
		return false, err
	}

	exists, ok := resp.(int64)
	if !ok {
		return false, nil
	}

	return exists == 1, nil
}

// del only use for testing.
func (r *redisBitSet) del() error {
	_, err := r.store.Del(r.key)
	return err
}

// expire only use for testing.
func (r *redisBitSet) expire(seconds int) error {
	return r.store.Expire(r.key, seconds)
}

func (r *redisBitSet) set(ctx context.Context, offsets []uint) error {
	args, err := r.buildOffsetArgs(offsets)
	if err != nil {
		return err
	}

	_, err = r.store.ScriptRunCtx(ctx, setScript, []string{r.key}, args)
	if errors.Is(err, redis.Nil) {
		return nil
	}

	return err
}

```

### Core Architecture Module: `core/breaker/breaker.go`
```
package breaker

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/zeromicro/go-zero/core/proc"
	"github.com/zeromicro/go-zero/core/stat"
	"github.com/zeromicro/go-zero/core/stringx"
)

const numHistoryReasons = 5

// ErrServiceUnavailable is returned when the Breaker state is open.
var ErrServiceUnavailable = errors.New("circuit breaker is open")

type (
	// Acceptable is the func to check if the error can be accepted.
	Acceptable func(err error) bool

	// A Breaker represents a circuit breaker.
	Breaker interface {
		// Name returns the name of the Breaker.
		Name() string

		// Allow checks if the request is allowed.
		// If allowed, a promise will be returned,
		// otherwise ErrServiceUnavailable will be returned as the error.
		// The caller needs to call promise.Accept() on success,
		// or call promise.Reject() on failure.
		Allow() (Promise, error)
		// AllowCtx checks if the request is allowed when ctx isn't done.
		AllowCtx(ctx context.Context) (Promise, error)

		// Do runs the given request if the Breaker accepts it.
		// Do returns an error instantly if the Breaker rejects the request.
		// If a panic occurs in the request, the Breaker handles it as an error
		// and causes the same panic again.
		Do(req func() error) error
		// DoCtx runs the given request if the Breaker accepts it when ctx isn't done.
		DoCtx(ctx context.Context, req func() error) error

		// DoWithAcceptable runs the given request if the Breaker accepts it.
		// DoWithAcceptable returns an error instantly if the Breaker rejects the request.
		// If a panic occurs in the request, the Breaker handles it as an error
		// and causes the same panic again.
		// acceptable checks if it's a successful call, even if the error is not nil.
		DoWithAcceptable(req func() error, acceptable Acceptable) error
		// DoWithAcceptableCtx runs the given request if the Breaker accepts it when ctx isn't done.
		DoWithAcceptableCtx(ctx context.Context, req func() error, acceptable Acceptable) error

		// DoWithFallback runs the given request if the Breaker accepts it.
		// DoWithFallback runs the fallback if the Breaker rejects the request.
		// If a panic occurs in the request, the Breaker handles it as an error
		// and causes the same panic again.
		DoWithFallback(req func() error, fallback Fallback) error
		// DoWithFallbackCtx runs the given request if the Breaker accepts it when ctx isn't done.
		DoWithFallbackCtx(ctx context.Context, req func() error, fallback Fallback) error

		// DoWithFallbackAcceptable runs the given request if the Breaker accepts it.
		// DoWithFallbackAcceptable runs the fallback if the Breaker rejects the request.
		// If a panic occurs in the request, the Breaker handles it as an error
		// and causes the same panic again.
		// acceptable checks if it's a successful call, even if the error is not nil.
		DoWithFallbackAcceptable(req func() error, fallback Fallback, acceptable Acceptable) error
		// DoWithFallbackAcceptableCtx runs the given request if the Breaker accepts it when ctx isn't done.
		DoWithFallbackAcceptableCtx(ctx context.Context, req func() error, fallback Fallback,
			acceptable Acceptable) error
	}

	// Fallback is the func to be called if the request is rejected.
	Fallback func(err error) error

	// Option defines the method to customize a Breaker.
	Option func(breaker *circuitBreaker)

	// Promise interface defines the callbacks that returned by Breaker.Allow.
	Promise interface {
		// Accept tells the Breaker that the call is successful.
		Accept()
		// Reject tells the Breaker that the call is failed.
		Reject(reason string)
	}

	internalPromise interface {
		Accept()
		Reject()
	}

	circuitBreaker struct {
		name string
		throttle
	}

	internalThrottle interface {
		allow() (internalPromise, error)
		doReq(req func() error, fallback Fallback, acceptable Acceptable) error
	}

	throttle interface {
		allow() (Promise, error)
		doReq(req func() error, fallback Fallback, acceptable Acceptable) error
	}
)

// NewBreaker returns a Breaker object.
// opts can be used to customize the Breaker.
func NewBreaker(opts ...Option) Breaker {
	var b circuitBreaker
	for _, opt := range opts {
		opt(&b)
	}
	if len(b.name) == 0 {
		b.name = stringx.Rand()
	}
	b.throttle = newLoggedThrottle(b.name, newGoogleBreaker())

	return &b
}

func (cb *circuitBreaker) Allow() (Promise, error) {
	return cb.throttle.allow()
}

func (cb *circuitBreaker) AllowCtx(ctx context.Context) (Promise, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
		return cb.Allow()
	}
}

func (cb *circuitBreaker) Do(req func() error) error {
	return cb.throttle.doReq(req, nil, defaultAcceptable)
}

func (cb *circuitBreaker) DoCtx(ctx context.Context, req func() error) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		return cb.Do(req)
	}
}

func (cb *circuitBreaker) DoWithAcceptable(req func() error, acceptable Acceptable) error {
	return cb.throttle.doReq(req, nil, acceptable)
}

func (cb *circuitBreaker) DoWithAcceptableCtx(ctx context.Context, req func() error,
	acceptable Acceptable) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		return cb.DoWithAcceptable(req, acceptable)
	}
}

func (cb *circuitBreaker) DoWithFallback(req func() error, fallback Fallback) error {
	return cb.throttle.doReq(req, fallback, defaultAcceptable)
}

func (cb *circuitBreaker) DoWithFallbackCtx(ctx context.Context, req func() error,
	fallback Fallback) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		return cb.DoWithFallback(req, fallback)
	}
}

func (cb *circuitBreaker) DoWithFallbackAcceptable(req func() error, fallback Fallback,
	acceptable Acceptable) error {
	return cb.throttle.doReq(req, fallback, acceptable)
}

func (cb *circuitBreaker) DoWithFallbackAcceptableCtx(ctx context.Context, req func() error,
	fallback Fallback, acceptable Acceptable) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		return cb.DoWithFallbackAcceptable(req, fallback, acceptable)
	}
}

func (cb *circuitBreaker) Name() string {
	return cb.name
}

// WithName returns a function to set the name of a Breaker.
func WithName(name string) Option {
	return func(b *circuitBreaker) {
		b.name = name
	}
}

func defaultAcceptable(err error) bool {
	return err == nil
}

type loggedThrottle struct {
	name string
	internalThrottle
	errWin *errorWindow
}

func newLoggedThrottle(name string, t internalThrottle) loggedThrottle {
	return loggedThrottle{
		name:             name,
		internalThrottle: t,
		errWin:           new(errorWindow),
	}
}

func (lt loggedThrottle) allow() (Promise, error) {
	promise, err := lt.internalThrottle.allow()
	return promiseWithReason{
		promise: promise,
		errWin:  lt.errWin,
	}, lt.logError(err)
}

func (lt loggedThrottle) doReq(req func() error, fallback Fallback, acceptable Acceptable) error {
	return lt.logError(lt.internalThrottle.doReq(req, fallback, func(err error) bool {
		accept := acceptable(err)
		if !accept && err != nil {
			lt.errWin.add(err.Error())
		}
		return accept
	}))
}

func (lt loggedThrottle) logError(err error) error {
	if errors.Is(err, ErrServiceUnavailable) {
		// if circuit open, not possible to have empty error window
		stat.Report(fmt.Sprintf(
			"proc(%s/%d), callee: %s, breaker is open and requests dropped\nlast errors:\n%s",
			proc.ProcessName(), proc.Pid(), lt.name, lt.errWin))
	}

	return err
}

type errorWindow struct {
	reasons [numHistoryReasons]string
	index   int
	count   int
	lock    sync.Mutex
}

func (ew *errorWindow) add(reason string) {
	ew.lock.Lock()
	ew.reasons[ew.index] = fmt.Sprintf("%s %s", time.Now().Format(time.TimeOnly), reason)
	ew.index = (ew.index + 1) % numHistoryReasons
	ew.count = min(ew.count+1, numHistoryReasons)
	ew.lock.Unlock()
}

func (ew *errorWindow) String() string {
	reasons := make([]string, 0, ew.count)

	ew.lock.Lock()
	// reverse order
	for i := ew.index - 1; i >= ew.index-ew.count; i-- {
		reasons = append(reasons,
```

### Core Architecture Module: `core/breaker/breakers.go`
```
package breaker

import (
	"context"
	"sync"
)

var (
	lock     sync.RWMutex
	breakers = make(map[string]Breaker)
)

// Do calls Breaker.Do on the Breaker with given name.
func Do(name string, req func() error) error {
	return do(name, func(b Breaker) error {
		return b.Do(req)
	})
}

// DoCtx calls Breaker.DoCtx on the Breaker with given name.
func DoCtx(ctx context.Context, name string, req func() error) error {
	return do(name, func(b Breaker) error {
		return b.DoCtx(ctx, req)
	})
}

// DoWithAcceptable calls Breaker.DoWithAcceptable on the Breaker with given name.
func DoWithAcceptable(name string, req func() error, acceptable Acceptable) error {
	return do(name, func(b Breaker) error {
		return b.DoWithAcceptable(req, acceptable)
	})
}

// DoWithAcceptableCtx calls Breaker.DoWithAcceptableCtx on the Breaker with given name.
func DoWithAcceptableCtx(ctx context.Context, name string, req func() error,
	acceptable Acceptable) error {
	return do(name, func(b Breaker) error {
		return b.DoWithAcceptableCtx(ctx, req, acceptable)
	})
}

// DoWithFallback calls Breaker.DoWithFallback on the Breaker with given name.
func DoWithFallback(name string, req func() error, fallback Fallback) error {
	return do(name, func(b Breaker) error {
		return b.DoWithFallback(req, fallback)
	})
}

// DoWithFallbackCtx calls Breaker.DoWithFallbackCtx on the Breaker with given name.
func DoWithFallbackCtx(ctx context.Context, name string, req func() error, fallback Fallback) error {
	return do(name, func(b Breaker) error {
		return b.DoWithFallbackCtx(ctx, req, fallback)
	})
}

// DoWithFallbackAcceptable calls Breaker.DoWithFallbackAcceptable on the Breaker with given name.
func DoWithFallbackAcceptable(name string, req func() error, fallback Fallback,
	acceptable Acceptable) error {
	return do(name, func(b Breaker) error {
		return b.DoWithFallbackAcceptable(req, fallback, acceptable)
	})
}

// DoWithFallbackAcceptableCtx calls Breaker.DoWithFallbackAcceptableCtx on the Breaker with given name.
func DoWithFallbackAcceptableCtx(ctx context.Context, name string, req func() error,
	fallback Fallback, acceptable Acceptable) error {
	return do(name, func(b Breaker) error {
		return b.DoWithFallbackAcceptableCtx(ctx, req, fallback, acceptable)
	})
}

// GetBreaker returns the Breaker with the given name.
func GetBreaker(name string) Breaker {
	lock.RLock()
	b, ok := breakers[name]
	lock.RUnlock()
	if ok {
		return b
	}

	lock.Lock()
	b, ok = breakers[name]
	if !ok {
		b = NewBreaker(WithName(name))
		breakers[name] = b
	}
	lock.Unlock()

	return b
}

// NoBreakerFor disables the circuit breaker for the given name.
func NoBreakerFor(name string) {
	lock.Lock()
	breakers[name] = NopBreaker()
	lock.Unlock()
}

func do(name string, execute func(b Breaker) error) error {
	return execute(GetBreaker(name))
}

```

### Core Architecture Module: `core/breaker/bucket.go`
```
package breaker

const (
	success = iota
	fail
	drop
)

// bucket defines the bucket that holds sum and num of additions.
type bucket struct {
	Sum     int64
	Success int64
	Failure int64
	Drop    int64
}

func (b *bucket) Add(v int64) {
	switch v {
	case fail:
		b.fail()
	case drop:
		b.drop()
	default:
		b.succeed()
	}
}

func (b *bucket) Reset() {
	b.Sum = 0
	b.Success = 0
	b.Failure = 0
	b.Drop = 0
}

func (b *bucket) drop() {
	b.Sum++
	b.Drop++
}

func (b *bucket) fail() {
	b.Sum++
	b.Failure++
}

func (b *bucket) succeed() {
	b.Sum++
	b.Success++
}

```

### Core Architecture Module: `core/breaker/googlebreaker.go`
```
package breaker

import (
	"time"

	"github.com/zeromicro/go-zero/core/collection"
	"github.com/zeromicro/go-zero/core/mathx"
	"github.com/zeromicro/go-zero/core/syncx"
	"github.com/zeromicro/go-zero/core/timex"
)

const (
	// 250ms for bucket duration
	window            = time.Second * 10
	buckets           = 40
	forcePassDuration = time.Second
	k                 = 1.5
	minK              = 1.1
	protection        = 5
)

// googleBreaker is a netflixBreaker pattern from google.
// see Client-Side Throttling section in https://landing.google.com/sre/sre-book/chapters/handling-overload/
type (
	googleBreaker struct {
		k        float64
		stat     *collection.RollingWindow[int64, *bucket]
		proba    *mathx.Proba
		lastPass *syncx.AtomicDuration
	}

	windowResult struct {
		accepts        int64
		total          int64
		failingBuckets int64
		workingBuckets int64
	}
)

func newGoogleBreaker() *googleBreaker {
	bucketDuration := time.Duration(int64(window) / int64(buckets))
	st := collection.NewRollingWindow[int64, *bucket](func() *bucket {
		return new(bucket)
	}, buckets, bucketDuration)
	return &googleBreaker{
		stat:     st,
		k:        k,
		proba:    mathx.NewProba(),
		lastPass: syncx.NewAtomicDuration(),
	}
}

func (b *googleBreaker) accept() error {
	var w float64
	history := b.history()
	w = b.k - (b.k-minK)*float64(history.failingBuckets)/buckets
	weightedAccepts := mathx.AtLeast(w, minK) * float64(history.accepts)
	// https://landing.google.com/sre/sre-book/chapters/handling-overload/#eq2101
	// for better performance, no need to care about the negative ratio
	dropRatio := (float64(history.total-protection) - weightedAccepts) / float64(history.total+1)
	if dropRatio <= 0 {
		return nil
	}

	lastPass := b.lastPass.Load()
	if lastPass > 0 && timex.Since(lastPass) > forcePassDuration {
		b.lastPass.Set(timex.Now())
		return nil
	}

	dropRatio *= float64(buckets-history.workingBuckets) / buckets

	if b.proba.TrueOnProba(dropRatio) {
		return ErrServiceUnavailable
	}

	b.lastPass.Set(timex.Now())

	return nil
}

func (b *googleBreaker) allow() (internalPromise, error) {
	if err := b.accept(); err != nil {
		b.markDrop()
		return nil, err
	}

	return googlePromise{
		b: b,
	}, nil
}

func (b *googleBreaker) doReq(req func() error, fallback Fallback, acceptable Acceptable) error {
	if err := b.accept(); err != nil {
		b.markDrop()
		if fallback != nil {
			return fallback(err)
		}

		return err
	}

	var succ bool
	defer func() {
		// if req() panic, success is false, mark as failure
		if succ {
			b.markSuccess()
		} else {
			b.markFailure()
		}
	}()

	err := req()
	if acceptable(err) {
		succ = true
	}

	return err
}

func (b *googleBreaker) markDrop() {
	b.stat.Add(drop)
}

func (b *googleBreaker) markFailure() {
	b.stat.Add(fail)
}

func (b *googleBreaker) markSuccess() {
	b.stat.Add(success)
}

func (b *googleBreaker) history() windowResult {
	var result windowResult

	b.stat.Reduce(func(b *bucket) {
		result.accepts += b.Success
		result.total += b.Sum
		if b.Failure > 0 {
			result.workingBuckets = 0
		} else if b.Success > 0 {
			result.workingBuckets++
		}
		if b.Success > 0 {
			result.failingBuckets = 0
		} else if b.Failure > 0 {
			result.failingBuckets++
		}
	})

	return result
}

type googlePromise struct {
	b *googleBreaker
}

func (p googlePromise) Accept() {
	p.b.markSuccess()
}

func (p googlePromise) Reject() {
	p.b.markFailure()
}

```

### Core Architecture Module: `core/breaker/nopbreaker.go`
```
package breaker

import "context"

const nopBreakerName = "nopBreaker"

type nopBreaker struct{}

// NopBreaker returns a breaker that never trigger breaker circuit.
func NopBreaker() Breaker {
	return nopBreaker{}
}

func (b nopBreaker) Name() string {
	return nopBreakerName
}

func (b nopBreaker) Allow() (Promise, error) {
	return nopPromise{}, nil
}

func (b nopBreaker) AllowCtx(_ context.Context) (Promise, error) {
	return nopPromise{}, nil
}

func (b nopBreaker) Do(req func() error) error {
	return req()
}

func (b nopBreaker) DoCtx(_ context.Context, req func() error) error {
	return req()
}

func (b nopBreaker) DoWithAcceptable(req func() error, _ Acceptable) error {
	return req()
}

func (b nopBreaker) DoWithAcceptableCtx(_ context.Context, req func() error, _ Acceptable) error {
	return req()
}

func (b nopBreaker) DoWithFallback(req func() error, _ Fallback) error {
	return req()
}

func (b nopBreaker) DoWithFallbackCtx(_ context.Context, req func() error, _ Fallback) error {
	return req()
}

func (b nopBreaker) DoWithFallbackAcceptable(req func() error, _ Fallback, _ Acceptable) error {
	return req()
}

func (b nopBreaker) DoWithFallbackAcceptableCtx(_ context.Context, req func() error,
	_ Fallback, _ Acceptable) error {
	return req()
}

type nopPromise struct{}

func (p nopPromise) Accept() {
}

func (p nopPromise) Reject(_ string) {
}

```

### Core Architecture Module: `core/cmdline/input.go`
```
package cmdline

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// EnterToContinue let stdin waiting for an enter key to continue.
func EnterToContinue() {
	fmt.Print("Press 'Enter' to continue...")
	bufio.NewReader(os.Stdin).ReadBytes('\n')
}

// ReadLine shows prompt to stdout and read a line from stdin.
func ReadLine(prompt string) string {
	fmt.Print(prompt)
	input, _ := bufio.NewReader(os.Stdin).ReadString('\n')
	return strings.TrimSpace(input)
}

```

### Core Architecture Module: `core/codec/aesecb.go`
```
package codec

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"errors"
)

// ErrPaddingSize indicates bad padding size.
var ErrPaddingSize = errors.New("padding size error")

type ecb struct {
	b         cipher.Block
	blockSize int
}

func newECB(b cipher.Block) *ecb {
	return &ecb{
		b:         b,
		blockSize: b.BlockSize(),
	}
}

type ecbEncrypter ecb

// Deprecated: NewECBEncrypter returns an ECB encrypter.
// ECB mode is insecure for multi-block data. Use AES-GCM instead.
func NewECBEncrypter(b cipher.Block) cipher.BlockMode {
	return (*ecbEncrypter)(newECB(b))
}

// BlockSize returns the mode's block size.
func (x *ecbEncrypter) BlockSize() int { return x.blockSize }

// CryptBlocks encrypts a number of blocks. The length of src must be a multiple of
// the block size. Dst and src must overlap entirely or not at all.
func (x *ecbEncrypter) CryptBlocks(dst, src []byte) {
	if len(src)%x.blockSize != 0 {
		panic("crypto/cipher: input not full blocks")
	}
	if len(dst) < len(src) {
		panic("crypto/cipher: output smaller than input")
	}

	for len(src) > 0 {
		x.b.Encrypt(dst, src[:x.blockSize])
		src = src[x.blockSize:]
		dst = dst[x.blockSize:]
	}
}

type ecbDecrypter ecb

// Deprecated: NewECBDecrypter returns an ECB decrypter.
// ECB mode is insecure for multi-block data. Use AES-GCM instead.
func NewECBDecrypter(b cipher.Block) cipher.BlockMode {
	return (*ecbDecrypter)(newECB(b))
}

// BlockSize returns the mode's block size.
func (x *ecbDecrypter) BlockSize() int {
	return x.blockSize
}

// CryptBlocks decrypts a number of blocks. The length of src must be a multiple of
// the block size. Dst and src must overlap entirely or not at all.
func (x *ecbDecrypter) CryptBlocks(dst, src []byte) {
	if len(src)%x.blockSize != 0 {
		panic("crypto/cipher: input not full blocks")
	}
	if len(dst) < len(src) {
		panic("crypto/cipher: output smaller than input")
	}

	for len(src) > 0 {
		x.b.Decrypt(dst, src[:x.blockSize])
		src = src[x.blockSize:]
		dst = dst[x.blockSize:]
	}
}

// Deprecated: EcbDecrypt decrypts src with the given key.
// ECB mode is insecure for multi-block data. Use AES-GCM instead.
func EcbDecrypt(key, src []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	if len(src)%block.BlockSize() != 0 {
		return nil, ErrPaddingSize
	}

	decrypter := NewECBDecrypter(block)
	decrypted := make([]byte, len(src))
	decrypter.CryptBlocks(decrypted, src)

	return pkcs5Unpadding(decrypted, decrypter.BlockSize())
}

// Deprecated: EcbDecryptBase64 decrypts base64 encoded src with the given base64 encoded key.
// The returned string is also base64 encoded.
// ECB mode is insecure for multi-block data. Use AES-GCM instead.
func EcbDecryptBase64(key, src string) (string, error) {
	keyBytes, err := getKeyBytes(key)
	if err != nil {
		return "", err
	}

	encryptedBytes, err := base64.StdEncoding.DecodeString(src)
	if err != nil {
		return "", err
	}

	decryptedBytes, err := EcbDecrypt(keyBytes, encryptedBytes)
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(decryptedBytes), nil
}

// Deprecated: EcbEncrypt encrypts src with the given key.
// ECB mode is insecure for multi-block data. Use AES-GCM instead.
func EcbEncrypt(key, src []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	padded := pkcs5Padding(src, block.BlockSize())
	crypted := make([]byte, len(padded))
	encrypter := NewECBEncrypter(block)
	encrypter.CryptBlocks(crypted, padded)

	return crypted, nil
}

// Deprecated: EcbEncryptBase64 encrypts base64 encoded src with the given base64 encoded key.
// The returned string is also base64 encoded.
// ECB mode is insecure for multi-block data. Use AES-GCM instead.
func EcbEncryptBase64(key, src string) (string, error) {
	keyBytes, err := getKeyBytes(key)
	if err != nil {
		return "", err
	}

	srcBytes, err := base64.StdEncoding.DecodeString(src)
	if err != nil {
		return "", err
	}

	encryptedBytes, err := EcbEncrypt(keyBytes, srcBytes)
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(encryptedBytes), nil
}

func getKeyBytes(key string) ([]byte, error) {
	if len(key) <= 32 {
		return []byte(key), nil
	}

	keyBytes, err := base64.StdEncoding.DecodeString(key)
	if err != nil {
		return nil, err
	}

	return keyBytes, nil
}

func pkcs5Padding(ciphertext []byte, blockSize int) []byte {
	padding := blockSize - len(ciphertext)%blockSize
	padtext := bytes.Repeat([]byte{byte(padding)}, padding)
	return append(ciphertext, padtext...)
}

func pkcs5Unpadding(src []byte, blockSize int) ([]byte, error) {
	length := len(src)
	if length == 0 {
		return nil, ErrPaddingSize
	}

	unpadding := int(src[length-1])
	if unpadding < 1 || unpadding > blockSize || unpadding > length {
		return nil, ErrPaddingSize
	}

	for _, b := range src[length-unpadding:] {
		if int(b) != unpadding {
			return nil, ErrPaddingSize
		}
	}

	return src[:length-unpadding], nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4894** (2025-05-25): **Timeout set**
  *Symptoms*: I want to know https://go-zero.dev/docs/tutorials/http/server/middleware The role of TimeoutHandler, a timeout middleware. When I selected to disable timeout middleware in the configuration file, the default three second timeout still took effect, and the code displayed in the log was 200, but my client did not receive any data (I wrote time. Sleep (6 * time. Second) in the processing logic). ``` host: "0.0.0.0" Port: 8888 Middlewares:   Timeout: false ``` Therefore, I attempted to annotate the following content in the goctl source code, which can return data normally under the same conditions. Therefore, I believe that the timeout middleware did not fully take effect. Although the log returned two hundred, the default timeout in RestConf of rest took effect, causing the connection to be disconnected. - v1.8.3 rest/engine.go ``` 	svr := &engine{ 		conf: c, 		//timeout: time.Duration(c.Timeout) * time.Millisecond, 	} ``` 
  **Post-Mortem & Fix Analysis**:
  > I'll check the problem.  But you can workaround to add `Timeout: 0` in config.

- **Issue #4816** (2025-05-02): **Fix the issue of generating swagger @doc "xxx" that fails, and use th…**
  *Symptoms*: Fix the issue of generating swagger `@doc "xxx"` that fails, and use the `handler` **name** as the default `summary`
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/zeromicro/go-zero/pull/4816?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zeromicro) Report All modified and coverable lines are covered by tests :white_check_mark: > Project coverage is 94.80%. Comparing base [(`8690859`)](https://app.codecov.io/gh/zeromicro/go-zero/commit/8690859c7d1c9461bdc422c3c65608bde30904db?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zeromicro) to head [(`dd22ed8`)](https://app.codecov.io/gh/zeromicro/go-zero/commit/dd22ed871d44617bc2f06306c974f6b63a0fdf4f?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zeromicro). > Report is 311 commits behind head on master.  <details><summary>Additional details and impacted files</summary>   [see 18 files with indirect coverage changes](https://app.codecov.io/gh/zeromic

- **Issue #4813** (2026-08-05): **Unable to get response when Prefix is configured in http gateway**
  *Symptoms*: gateway.yaml  Problem 1:  Unable to get response when Prefix is added ```yaml   - Name: testservice     Http:       Target: 127.0.0.1:10010       Prefix: /test       Timeout: 3000     Mappings:       - Method: GET         Path: /hello       - Method: POST         Path: /hi ``` The following configuration works normally ```yaml   - Name: testservice     Http:       Target: 127.0.0.1:10010       Timeout: 3000     Mappings:       - Method: GET         Path: /test/hello       - Method: POST         Path: /test/hi ```  Problem 2: When one address has a prefix and another address doesn't; if the suffix names are the same, it cannot start  ```json {"@timestamp":"2025-04-28T18:45:13.681+08:00","caller":"rest/server.go:324","content":"duplicated item for /hello","level":"error"} ```  ```yaml   - Name: userservice     Http:       Target: 127.0.0.1:10010 #      Prefix: /       Timeout: 3000     Mappings:       - Method: GET         Path: /hello       - Method: POST         Path: /hi    - Name: testservice     Http:       Target: 127.0.0.1:10010       Prefix: /test       Timeout: 3000     Mappings:       - Method: GET         Path: /hello       - Method: POST         Path: /hi ```  ---  gateway.yaml  问题1:   写上Prefix就无法获取响应 ```yaml   - Name: testservice     Http:       Target: 127.0.0.1:10010       Prefix: /test       Timeout: 3000     Mappings:       - Method: GET         Path: /hello       - Method: POST         Path: /hi ``` 下面这样写则正常 ```yaml   - Name: testservice     Http:       Target
  **Post-Mortem & Fix Analysis**:
  > Hello @wisonlau,  I've written a test case that reproduces both issues you reported:  1. Unable to get response when Prefix is added 2. Conflict when one address has a prefix and another doesn't when suffix names are the same  The interesting part is that when I run these tests against the current code in the master branch, they pass successfully. This suggests the issue might have been fixed in a newer version.  Here's the test code I used: ```go func TestHttpPrefixIssue(t *testing.T) {     server := startTestServer(t)     defer server.Close()      // Test case 1: When a Prefix is added to a service in the gateway configuration     t.Run("PrefixAndPathSetup", func(t *testing.T) {         var c GatewayConf         assert.NoError(t, conf.FillDefault(&c))         c.DevServer.Host = "localhost"         c.Host = "localhost"         c.Port = 19001          // Set up a service with Prefix configuration but path doesn't include the prefix         s := MustNewServer(c)         s.upstreams = []
  > v1.8.2  [gateway_gozero.zip](https://github.com/user-attachments/files/20012638/gateway_gozero.zip)
  > Hello @wisonlau,  Thank you for reporting this issue. I'd like to clarify how the current prefix handling works in our gateway component and propose a solution for the issues you're experiencing.  ## Current behavior  The current implementation of `Prefix` in the gateway is different from what you might expect. Here's how it works:  1. When you configure a `Prefix` like `/test` for an upstream with a path like `/hello`, the gateway forwards requests to `/test/hello`, not to `/hello` on a backend that expects `/test/hello`.  2. This means that if your backend API expects requests at paths like `/test/hello`, you should **not** set a prefix but instead include the full path in your mappings:  ```yaml Http:   Target: 127.0.0.1:10010   # No prefix   Timeout: 3000   Mappings:     - Method: GET       Path: /test/hello ```  3. For your second issue with duplicate routes, this is expected behavior because our router doesn't distinguish between routes based on their upstream targets. When you h

- **Issue #4800** (2026-07-31): **When generating TypeScript code, there is an additional headers parameter**
  *Symptoms*: **Describe the bug** When generating TypeScript code, there is an additional headers parameter  **To Reproduce** Steps to reproduce the behavior, if applicable:  1. The code is     ```    type Pagination { 	Page     int32 `json:"page"` 	PageSize int32 `json:"pageSize"`    }        type queryUserListReq {       	Username string `json:"username,optional"`          Pagination     }    ```  2. The error is     ```    export interface QueyrUserListReq { 	username?: string  	page: number 	pageSize: number    }        export function queryUserList(req: components.QueyrUserListReq, headers: components.QueyrUserListReqHeaders) { 	return webapi.post<components.QueryUserListResp>(`/api/v1/queryUserList`, req, headers)    }    ```    An extra headers parameter causes a syntax check error  **Expected behavior**    The correct one should be     ```    export function queryUserList(req: components.QueyrUserListReq) { 	return webapi.post<components.QueryUserListResp>(`/api/v1/queryUserList`, req, headers)    }    ```  **Environments (please complete the following information):**  - OS: [e.g. Linux]  - go-zero version [e.g. 1.8.2]  - goctl version [e.g. 1.8.2, optional]  
  **Post-Mortem & Fix Analysis**:
  > The extra `headers` parameter in the generated TypeScript code is indeed an issue. Based on your API definition, there shouldn't be an additional headers parameter in the generated request function.  This happens because the TypeScript generator is unconditionally adding the headers parameter to request functions. Here are some potential solutions:  1. **Temporary workaround**: You can manually edit the generated TypeScript code to remove the extra headers parameter and its usage in the function body.  2. **Fix your API definition**: Check if you have any header-related annotations or middleware declarations in your API definition that might be triggering this behavior.  3. **Update goctl**: If you're not using the latest version, try updating:    ```    go install github.com/zeromicro/go-zero/tools/goctl@latest    ```  4. **Custom template**: You can create a custom template for TypeScript generation that eliminates the headers parameter for endpoints that don't need it.  I've checked
  > @kevwan   After looking at the source code, the problem may be in the IsTagMember function in the go-zero/tools/goctl/api/spec /fn.go file.  ``` func (m Member) IsTagMember(tagKey string) bool { 	if m.IsInline { 		return true 	}  	tags := m.Tags() 	for _, tag := range tags { 		if tag.Key == tagKey { 			return true 		} 	} 	return false } ```  When m.IsInline is true, it returns true directly, and tagKey is not checked. This will cause the hasRequestHeader function in tsgen to check incorrectly. But I don't know how to modify it without affecting other codes.
  > This issue is stale because it has been open for 30 days with no activity.

- **Issue #4790** (2025-05-02): **fix(marshaler): fix bug when marshal array**
  *Symptoms*: if it is not optional in struct, it panics when do reflect on reflect.isNil, because array never be nullable.
  **Post-Mortem & Fix Analysis**:
  > Nearly a week has passed. Could you inform me if there are any issues with this pull request and whether it can be merged?
  > ## [Codecov](https://app.codecov.io/gh/zeromicro/go-zero/pull/4790?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zeromicro) Report All modified and coverable lines are covered by tests :white_check_mark: > Project coverage is 94.80%. Comparing base [(`8690859`)](https://app.codecov.io/gh/zeromicro/go-zero/commit/8690859c7d1c9461bdc422c3c65608bde30904db?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zeromicro) to head [(`73acf09`)](https://app.codecov.io/gh/zeromicro/go-zero/commit/73acf09d67ff9ed6019cc94324cafabfece9940c?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zeromicro). > Report is 312 commits behind head on master.  <details><summary>Additional details and impacted files</summary>   | [Files with missing lines](https://app.codecov.io/gh/zeromicro/go-zero/pull/4

- **Issue #4788** (2025-05-02): **fix: pg gen model missing cache prefix**
  *Symptoms*: postgres gen model code cache key missing prefix   <img width="861" alt="image" src="https://github.com/user-attachments/assets/b3880a91-fffb-4315-9c61-8d09b959a8ab" /> 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/zeromicro/go-zero/pull/4788?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zeromicro) Report All modified and coverable lines are covered by tests :white_check_mark: > Project coverage is 94.78%. Comparing base [(`8690859`)](https://app.codecov.io/gh/zeromicro/go-zero/commit/8690859c7d1c9461bdc422c3c65608bde30904db?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zeromicro) to head [(`95a34fc`)](https://app.codecov.io/gh/zeromicro/go-zero/commit/95a34fc1fd3834d709f3cb89fd26fddffc7f7114?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zeromicro). > Report is 315 commits behind head on master.  <details><summary>Additional details and impacted files</summary>   [see 18 files with indirect coverage changes](https://app.codecov.io/gh/zeromic
  > @kesonan  Can you review this when you have a moment?

- **Issue #4785** (2025-06-08): **fix: api group set timeout: 0s not working.**
  *Symptoms*: @server( 	timeout: 0s 	group: upload 	prefix: upload  	maxBytes: 10485760 )  fix api group set timeout is zero,  but engine use default timeout duration. cause api  timeout is not the expected result
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/zeromicro/go-zero/pull/4785?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zeromicro) Report All modified and coverable lines are covered by tests :white_check_mark: > Project coverage is 94.88%. Comparing base [(`8690859`)](https://app.codecov.io/gh/zeromicro/go-zero/commit/8690859c7d1c9461bdc422c3c65608bde30904db?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zeromicro) to head [(`5983ae2`)](https://app.codecov.io/gh/zeromicro/go-zero/commit/5983ae2ce517b2eec0979a4923c85e51ce77a294?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=zeromicro). > Report is 359 commits behind head on master.  <details><summary>Additional details and impacted files</summary>   | [Files with missing lines](https://app.codecov.io/gh/zeromicro/go-zero/pull/4

- **Issue #4758** (2025-04-08): **goctl-vscode automatically generates empty struct in .api files**
  *Symptoms*: This issue is marked as a duplicate of #4743. Please refer to #4743 for further updates and discussions.
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting this issue! Since this problem is specific to `goctl-vscode`, it would be best to submit this issue in the [goctl-vscode repository](https://github.com/zeromicro/goctl-vscode/issues). This will ensure it reaches the right maintainers for a quicker resolution.
  > Hi, just a kind reminder — would it be possible to check the issues in goctl-vscode before responding? If there had been an update or reply there, I wouldn’t have needed to raise the question here. Since goctl-vscode is listed as a recommended VSCode extension in the official documentation, I assumed it is still actively maintained.   Thanks for your attention!  &nbsp;   d ***@***.***    &nbsp;     ------------------&nbsp;原始邮件&nbsp;------------------ 发件人: "Kevin ***@***.***&gt;;  发送时间: 2025年4月8日(星期二) 晚上8:43 收件人: ***@***.***&gt;;  抄送: ***@***.***&gt;; ***@***.***&gt;;  主题: Re: [zeromicro/go-zero] goctl-vscode automatically generates empty struct in .api files (Issue #4758)                 Thank you for reporting this issue! Since this problem is specific to goctl-vscode, it would be best to submit this issue in the goctl-vscode repository. This will ensure it reaches the right maintainers for a quicker resolution.  — Reply to this email directly, v
  > Will fix it soon. Thanks!  Duplicate of #4743 

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

### Incident Patch 1: `0eea741c` (2026-09-25)
**Commit Message**: fix(redis): make ZaddnxFloat use ZADD NX semantics (#5779)

Co-authored-by: guoshengfei <guoshengfei@kylinos.cn>

**File**: `core/stores/redis/redis.go` (modified, +1/-1)
```diff
@@ -2027,7 +2027,7 @@ func (s *Redis) ZaddnxCtx(ctx context.Context, key string, score int64, value st
 
 // ZaddnxFloat is the implementation of redis zaddnx command.
 func (s *Redis) ZaddnxFloat(key string, score float64, value string) (bool, error) {
-	return s.ZaddFloatCtx(context.Background(), key, score, value)
+	return s.ZaddnxFloatCtx(context.Background(), key, score, value)
 }
 
 // ZaddnxFloatCtx is the implementation of redis zaddnx command.
```

---

### Incident Patch 2: `88dd61e2` (2026-09-05)
**Commit Message**: fix: force refresh every call when refresh interval is 0 (#5746)

Co-authored-by: waterWang <waterWang@users.noreply.github.com>
Co-authored-by: kevin <wanjunfeng@gmail.com>

**File**: `core/syncx/immutableresource.go` (modified, +4/-0)
```diff
@@ -70,6 +70,10 @@ func (ir *ImmutableResource) Get() (any, error) {
 }
 
 func (ir *ImmutableResource) shouldRefresh() bool {
+	if ir.refreshInterval <= 0 {
+		return true
+	}
+
 	lastTime := ir.lastTime.Load()
 	return lastTime == 0 || lastTime+ir.refreshInterval < timex.Now()
 }
```

**File**: `core/syncx/immutableresource_test.go` (modified, +33/-0)
```diff
@@ -5,6 +5,7 @@ import (
 	"sync"
 	"sync/atomic"
 	"testing"
+	"testing/synctest"
 	"time"
 
 	"github.com/stretchr/testify/assert"
@@ -122,3 +123,35 @@ func TestImmutableResourceErrorRefreshAlways(t *testing.T) {
 	assert.Equal(t, "any", err.Error())
 	assert.Equal(t, 2, count)
 }
+
+func TestImmutableResourceErrorRefreshWithoutClockAdvance(t *testing.T) {
+	synctest.Test(t, func(t *testing.T) {
+		var count int
+		fetchErr := errors.New("fetch failed")
+		r := NewImmutableResource(func() (any, error) {
+			count++
+			if count == 1 {
+				return nil, fetchErr
+			}
+
+			return "hello", nil
+		}, WithRefreshIntervalOnFailure(0))
+
+		res, err := r.Get()
+		assert.Nil(t, res)
+		assert.ErrorIs(t, err, fetchErr)
+		assert.Equal(t, 1, count)
+
+		// The synctest clock stays fixed between calls, reproducing identical clock readings.
+		res, err = r.Get()
+		assert.NoError(t, err)
+		assert.Equal(t, "hello", res)
+		assert.Equal(t, 2, count)
+
+		// A successful fetch stays cached even with a zero refresh interval.
+		res, err = r.Get()
+		assert.NoError(t, err)
+		assert.Equal(t, "hello", res)
+		assert.Equal(t, 2, count)
+	})
+}
```

---

### Incident Patch 3: `35734f9f` (2026-09-05)
**Commit Message**: docs: fix model sql example link (#5744)

Co-authored-by: duheyu <duheyu1224@gmail.com>

**File**: `tools/goctl/model/sql/README.MD` (modified, +1/-1)
```diff
@@ -293,7 +293,7 @@ OPTIONS:
 
 	```
 
-	示例用法请参考[用法](./example/generator.sh)
+	示例用法请参考[用法](./example/makefile)
   
 	> NOTE: goctl model mysql ddl/datasource 均新增了一个`--style`参数，用于标记文件命名风格。
 
```

---

### Incident Patch 4: `4d8fa44e` (2026-09-05)
**Commit Message**: chore(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp from 1.45.0 to 1.46.0 (#5765)

Signed-off-by: dependabot[bot] <support@github.com>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +18/-10)
```diff
@@ -26,7 +26,7 @@ require (
 	go.mongodb.org/mongo-driver/v2 v2.8.0
 	go.opentelemetry.io/otel v1.46.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.40.0
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.46.0
 	go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.46.0
 	go.opentelemetry.io/otel/exporters/zipkin v1.46.0
 	go.opentelemetry.io/otel/sdk v1.46.0
@@ -37,7 +37,7 @@ require (
 	golang.org/x/net v0.58.0
 	golang.org/x/sys v0.47.0
 	golang.org/x/time v0.14.0
-	google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d
+	google.golang.org/genproto/googleapis/api v0.0.0-20260819154853-08b0e4226688
 	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.12
 	gopkg.in/cheggaaa/pb.v1 v1.0.28
@@ -66,28 +66,37 @@ require (
 	github.com/go-jose/go-jose/v4 v4.1.4 // indirect
 	github.com/go-logr/logr v1.4.4 // indirect
 	github.com/go-logr/stdr v1.2.2 // indirect
-	github.com/go-openapi/jsonpointer v0.21.0 // indirect
-	github.com/go-openapi/jsonreference v0.20.2 // indirect
-	github.com/go-openapi/swag v0.23.0 // indirect
+	github.com/go-openapi/jsonpointer v1.0.0 // indirect
+	github.com/go-openapi/jsonreference v1.0.0 // indirect
+	github.com/go-openapi/swag v0.28.0 // indirect
+	github.com/go-openapi/swag/cmdutils v0.28.0 // indirect
+	github.com/go-openapi/swag/conv v0.28.0 // indirect
+	github.com/go-openapi/swag/fileutils v0.28.0 // indirect
+	github.com/go-openapi/swag/jsonutils v0.28.0 // indirect
+	github.com/go-openapi/swag/loading v0.28.0 // indirect
+	github.com/go-openapi/swag/mangling v0.28.0 // indirect
+	github.com/go-openapi/swag/netutils v0.28.0 // indirect
+	github.com/go-openapi/swag/pools v0.28.0 // indirect
+	github.com/go-openapi/swag/stringutils v0.28.0 // indirect
+	github.com/go-openapi/swag/typeutils v0.28.0 // indirect
+	github.com/go-openapi/swag/yamlutils v0.28.0 // indirect
 	github.com/gogo/protobuf v1.3.2 // indirect
 	github.com/golang-jwt/jwt/v5 v5.3.1 // indirect
 	github.com/google/gnostic-models v0.7.1 // indirect
 	github.com/google/go-cmp v0.7.0 // indirect
 	github.com/google/jsonschema-go v0.4.3 // indirect
 	github.com/google/pprof v0.0.0-20260709232956-b9395ee17fa0 // indirect
 	github.com/grafana/pyroscope-go/godeltaprof v0.1.11 // indirect
-	github.com/grpc-ecosystem/grpc-gateway/v2 v2.29.0 // indirect
+	github.com/grpc-ecosystem/grpc-gateway/v2 v2.30.0 // indirect
 	github.com/h2non/parth v0.0.0-20190131123155-b4df798d6542 // indirect
 	github.com/jackc/pgpassfile v1.0.0 // indirect
 	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
 	github.com/jackc/puddle/v2 v2.2.2 // indirect
 	github.com/jhump/protoreflect/v2 v2.0.0-beta.2 // indirect
-	github.com/josharian/intern v1.0.0 // indirect
 	github.com/json-iterator/go v1.1.12 // indirect
 	github.com/klauspost/compress v1.19.1 // indirect
 	github.com/klauspost/cpuid/v2 v2.4.0 // indirect
 	github.com/kylelemons/godebug v1.1.0 // indirect
-	github.com/mailru/easyjson v0.9.2 // indirect
 	github.com/mattn/go-colorable v0.1.15 // indirect
 	github.com/mattn/go-isatty v0.0.24 // indirect
 	github.com/mattn/go-runewidth v0.0.27 // indirect
@@ -117,7 +126,7 @@ require (
 	github.com/yuin/gopher-lua v1.1.2 // indirect
 	go.etcd.io/etcd/client/pkg/v3 v3.5.21 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.46.0 // indirect
 	go.opentelemetry.io/otel/metric v1.46.0 // indirect
 	go.opentelemetry.io/proto/otlp v1.11.0 // indirect
 	go.uber.org/atomic v1.11.0 // indirect
@@ -133,7 +142,6 @@ require (
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260825221802-da73d73af1c5 // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
-	gopkg.in/yaml.v3 v3.0.1 // indirect
 	k8s.io/klog/
```

**File**: `go.sum` (modified, +42/-30)
```diff
@@ -24,7 +24,6 @@ github.com/coreos/go-semver v0.3.1 h1:yi21YpKnrx1gt5R+la8n5WgS0kCrsPp33dmEyHReZr
 github.com/coreos/go-semver v0.3.1/go.mod h1:irMmmIw/7yzSRPWryHsK7EYSg09caPQL03VsM8rvUec=
 github.com/coreos/go-systemd/v22 v22.7.0 h1:LAEzFkke61DFROc7zNLX/WA2i5J8gYqe0rSj9KI28KA=
 github.com/coreos/go-systemd/v22 v22.7.0/go.mod h1:xNUYtjHu2EDXbsxz1i41wouACIwT7Ybq9o0BQhMwD0w=
-github.com/creack/pty v1.1.9/go.mod h1:oKZEueFk5CKHvIhNR5MUki03XCEU+Q6VDXinZuGJ33E=
 github.com/davecgh/go-spew v1.1.0/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
 github.com/davecgh/go-spew v1.1.1 h1:vj9j/u1bqnvCEfJOwUhtlOARqs3+rkHYY13jYWTU97c=
 github.com/davecgh/go-spew v1.1.1/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
@@ -47,14 +46,40 @@ github.com/go-logr/logr v1.4.4 h1:tG4xh9yMsRCAiodLVTxyrkzSZ9+o0L1Kg/+cPVcbP/8=
 github.com/go-logr/logr v1.4.4/go.mod h1:9T104GzyrTigFIr8wt5mBrctHMim0Nb2HLGrmQ40KvY=
 github.com/go-logr/stdr v1.2.2 h1:hSWxHoqTgW2S2qGc0LTAI563KZ5YKYRhT3MFKZMbjag=
 github.com/go-logr/stdr v1.2.2/go.mod h1:mMo/vtBO5dYbehREoey6XUKy/eSumjCCveDpRre4VKE=
-github.com/go-openapi/jsonpointer v0.19.6/go.mod h1:osyAmYz/mB/C3I+WsTTSgw1ONzaLJoLCyoi6/zppojs=
-github.com/go-openapi/jsonpointer v0.21.0 h1:YgdVicSA9vH5RiHs9TZW5oyafXZFc6+2Vc1rr/O9oNQ=
-github.com/go-openapi/jsonpointer v0.21.0/go.mod h1:IUyH9l/+uyhIYQ/PXVA41Rexl+kOkAPDdXEYns6fzUY=
-github.com/go-openapi/jsonreference v0.20.2 h1:3sVjiK66+uXK/6oQ8xgcRKcFgQ5KXa2KvnJRumpMGbE=
-github.com/go-openapi/jsonreference v0.20.2/go.mod h1:Bl1zwGIM8/wsvqjsOQLJ/SH+En5Ap4rVB5KVcIDZG2k=
-github.com/go-openapi/swag v0.22.3/go.mod h1:UzaqsxGiab7freDnrUUra0MwWfN/q7tE4j+VcZ0yl14=
-github.com/go-openapi/swag v0.23.0 h1:vsEVJDUo2hPJ2tu0/Xc+4noaxyEffXNIs3cOULZ+GrE=
-github.com/go-openapi/swag v0.23.0/go.mod h1:esZ8ITTYEsH1V2trKHjAN8Ai7xHb8RV+YSZ577vPjgQ=
+github.com/go-openapi/jsonpointer v1.0.0 h1:kR9tHqY0CtZaOPVFm622dPVNhrvYpwr4uCxgL3h1H8s=
+github.com/go-openapi/jsonpointer v1.0.0/go.mod h1:Z3rw7dWu1p9IgitXCFamSlA5lmDiklEB6vkaxcNZW5Y=
+github.com/go-openapi/jsonreference v1.0.0 h1:jlmTr6torcd1YgDQvSfNmRtKzYDO4FGBkrAdlAVWnpY=
+github.com/go-openapi/jsonreference v1.0.0/go.mod h1:jtwdyGbJk0Xhe5Y+rwtglQP6Sb1WZST4rT32LWB+sv0=
+github.com/go-openapi/swag v0.28.0 h1:xkgbOSKj6DZziNpyqRRAOt3GJGtgjgsd2RoyT30VWuw=
+github.com/go-openapi/swag v0.28.0/go.mod h1:4qYnT3Cqr1p1VknOdPo70evN4rgQnAg6jwApHyxSGIg=
+github.com/go-openapi/swag/cmdutils v0.28.0 h1:7TOeNtkYru1SG8Y34tDh9WBbLsMqGnptuxWiHREPZ4Q=
+github.com/go-openapi/swag/cmdutils v0.28.0/go.mod h1:Sm1MVFMkF6guJJ+pQqHnQA3N0j9qALV3NxzDSv6bETM=
+github.com/go-openapi/swag/conv v0.28.0 h1:GtqqbyFe7vR5Y7ehxG9W6/OvrSFdf1OLeTGp40TqxH8=
+github.com/go-openapi/swag/conv v0.28.0/go.mod h1:mbUE+mzctnhxi864m0Q07SpN8OowD9JhxmxuYvZZD/k=
+github.com/go-openapi/swag/fileutils v0.28.0 h1:Z04XWQD7R8Eq+7GnOrjovBxPPmZzsS4gt2H2GPGIViU=
+github.com/go-openapi/swag/fileutils v0.28.0/go.mod h1:VvJFZLTZS0AI854gEQz5tk7dBESdLjiNUMSZ/th2ry8=
+github.com/go-openapi/swag/jsonutils v0.28.0 h1:YIch6FwO7RXzeAnbO8Tu7dWBZeUEH+4nA0HXltVTnv4=
+github.com/go-openapi/swag/jsonutils v0.28.0/go.mod h1:CYM3WlTUcagR2ZoHdz54di/cbBqt82tuxuXgAjxw+mg=
+github.com/go-openapi/swag/jsonutils/fixtures_test v0.28.0 h1:qV+VVUAx5Oro8WjVWpZeql7YReTKhT4smR4zhcOQZr0=
+github.com/go-openapi/swag/jsonutils/fixtures_test v0.28.0/go.mod h1:mofwUWx70wvskwESqRJ//k/9kURmCgyJl5m5Ppoh5kY=
+github.com/go-openapi/swag/loading v0.28.0 h1:td8QZdZC9MIYGGSnSPKShKiK22I2tU5UQvuUhIBPRLU=
+github.com/go-openapi/swag/loading v0.28.0/go.mod h1:rXB0QiQX5mMveXEA7ouM4KiiM9jVJe4K6BVbwhD1M4k=
+github.com/go-openapi/swag/mangling v0.28.0 h1:pH8eyeNO9SLYsTMWJrurnNfKmDa28XrlA+HePVD53VM=
+github.com/go-openapi/swag/mangling v0.28.0/go.mod h1:jtBE2+V+3pILxOR7Vgce+Cwp6A2PgZbvVqfNntbVs0w=
+github.com/go-openapi/swag/netutils v0.28.0 h1:YXN6TALEi2pzts8/8GNm6T61HTAZsieukGZidap989k=
+github.com/go-openapi/swag/netutils v0.28.0/go.mod h1:J+WYyFMLtvtCGqa6jLv+YNUmIKI3ZRQRrvfNDMoQoEQ=
+github.com/go-openapi/swag/pools v0.28.0 h1:HPMZWSAfce
```

---

### Incident Patch 5: `c8ec158f` (2026-09-04)
**Commit Message**: fix(goctl): support hyphen-only api prefixes (#5747)

Co-authored-by: zihao_wang <zihao_wang@geelark.com>
Co-authored-by: kevin <wanjunfeng@gmail.com>

**File**: `tools/goctl/pkg/parser/api/parser/parser.go` (modified, +13/-4)
```diff
@@ -1172,12 +1172,12 @@ func (p *Parser) parseAtServerKVExpression() *ast.KVExpr {
 
 		slashTok := p.curTok
 		var pathText = slashTok.Text
-		if !p.advanceIfPeekTokenIs(token.IDENT) {
+		if !p.advanceIfPeekTokenIs(token.IDENT, token.SUB) {
 			return nil
 		}
 
 		pathText += p.curTok.Text
-		if p.peekTokenIs(token.SUB) { //  parse abc-efg format
+		if p.peekTokenIs(token.SUB) && p.curTokenIs(token.IDENT) { //  parse abc-efg format
 			if !p.nextToken() {
 				return nil
 			}
@@ -1303,12 +1303,21 @@ func (p *Parser) parseAtServerKVExpression() *ast.KVExpr {
 			slashTok := p.curTok
 			var pathText = valueTok.Text
 			pathText += slashTok.Text
-			if !p.advanceIfPeekTokenIs(token.IDENT) {
+			// Allow a trailing slash at the end of an @server path value.
+			if p.peekTok.Line() > p.curTok.Line() || p.peekTokenIs(token.RPAREN) {
+				valueTok = token.Token{
+					Text:     pathText,
+					Position: valueTok.Position,
+				}
+				leadingCommentGroup = p.curTokenNode().LeadingCommentGroup
+				break
+			}
+			if !p.advanceIfPeekTokenIs(token.IDENT, token.SUB) {
 				return nil
 			}
 
 			pathText += p.curTok.Text
-			if p.peekTokenIs(token.SUB) { //  parse abc-efg format
+			if p.peekTokenIs(token.SUB) && p.curTokenIs(token.IDENT) { //  parse abc-efg format
 				if !p.nextToken() {
 					return nil
 				}
```

**File**: `tools/goctl/pkg/parser/api/parser/parser_test.go` (modified, +6/-0)
```diff
@@ -306,6 +306,10 @@ func TestParser_Parse_atServerStmt(t *testing.T) {
 			"prefix2":    "v1/v2_test/v2-beta",
 			"prefix3":    "v1/v2_",
 			"prefix4":    "a-b-c",
+			"prefix5":    "/-",
+			"prefix6":    "/-/",
+			"prefix7":    "/abc/",
+			"prefix8":    "/comment/",
 			"summary":    `"test"`,
 			"key":        `"bar"`,
 		}
@@ -359,6 +363,8 @@ func TestParser_Parse_atServerStmt(t *testing.T) {
 			`@server(foo: m1,`,
 			`@server(foo: m1,)`,
 			`@server(foo: v1/v2-)`,
+			`@server(prefix:/--)`,
+			`@server(prefix:/-abc)`,
 			`@server(foo:"test")`,
 		}
 		for _, v := range testData {
```

**File**: `tools/goctl/pkg/parser/api/parser/testdata/atserver_test.api` (modified, +4/-0)
```diff
@@ -18,6 +18,10 @@
     prefix2: v1/v2_test/v2-beta
     prefix3: v1/v2_
     prefix4: a-b-c
+    prefix5: /-
+    prefix6: /-/
+    prefix7: /abc/
+    prefix8: /comment/ // trailing slash before a comment and the next key
     summary:"test"
     key:"bar"
 )
```

---

### Incident Patch 6: `ba0c5096` (2026-09-04)
**Commit Message**: fix(timingwheel): allow resetting timers after drain (#5753)

Signed-off-by: racequite <quiterace@gmail.com>

**File**: `core/collection/timingwheel.go` (modified, +6/-0)
```diff
@@ -170,6 +170,12 @@ func (tw *TimingWheel) drainAll(fn func(key, value any)) {
 			task := e.Value.(*timingEntry)
 			next := e.Next()
 			slot.Remove(e)
+			if val, ok := tw.timers.Get(task.key); ok {
+				timer := val.(*positionEntry)
+				if timer.item == task {
+					tw.timers.Del(task.key)
+				}
+			}
 			e = next
 			if !task.removed {
 				runner.Schedule(func() {
```

**File**: `core/collection/timingwheel_test.go` (modified, +29/-0)
```diff
@@ -59,6 +59,35 @@ func TestTimingWheel_Drain(t *testing.T) {
 	assert.Equal(t, ErrClosed, tw.Drain(func(key, value any) {}))
 }
 
+func TestTimingWheel_SetTimerAfterDrain(t *testing.T) {
+	ticker := timex.NewFakeTicker()
+	var count int32
+	tw, _ := NewTimingWheelWithTicker(testStep, 10, func(key, value any) {
+		assert.Equal(t, "foo", key)
+		assert.Equal(t, 2, value)
+		atomic.AddInt32(&count, 1)
+		ticker.Done()
+	}, ticker)
+	defer tw.Stop()
+
+	tw.SetTimer("foo", 1, testStep*4)
+	drained := make(chan lang.PlaceholderType)
+	tw.Drain(func(key, value any) {
+		assert.Equal(t, "foo", key)
+		assert.Equal(t, 1, value)
+		close(drained)
+	})
+	<-drained
+
+	tw.SetTimer("foo", 2, testStep*4)
+	for i := 0; i < 4; i++ {
+		ticker.Tick()
+	}
+
+	assert.Nil(t, ticker.Wait(waitTime))
+	assert.Equal(t, int32(1), atomic.LoadInt32(&count))
+}
+
 func TestTimingWheel_SetTimerSoon(t *testing.T) {
 	run := syncx.NewAtomicBool()
 	ticker := timex.NewFakeTicker()
```

---

### Incident Patch 7: `6928f70e` (2026-09-04)
**Commit Message**: chore(deps): bump go.opentelemetry.io/otel/exporters/stdout/stdouttrace from 1.45.0 to 1.46.0 (#5760)

Signed-off-by: dependabot[bot] <support@github.com>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +6/-6)
```diff
@@ -19,18 +19,18 @@ require (
 	github.com/prometheus/client_golang v1.23.2
 	github.com/redis/go-redis/v9 v9.22.0
 	github.com/spaolacci/murmur3 v1.1.0
-	github.com/stretchr/testify v1.11.1
+	github.com/stretchr/testify v1.12.1
 	github.com/titanous/json5 v1.0.0
 	go.etcd.io/etcd/api/v3 v3.5.21
 	go.etcd.io/etcd/client/v3 v3.5.21
 	go.mongodb.org/mongo-driver/v2 v2.8.0
-	go.opentelemetry.io/otel v1.45.0
+	go.opentelemetry.io/otel v1.46.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.40.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0
-	go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.45.0
+	go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.46.0
 	go.opentelemetry.io/otel/exporters/zipkin v1.45.0
-	go.opentelemetry.io/otel/sdk v1.45.0
-	go.opentelemetry.io/otel/trace v1.45.0
+	go.opentelemetry.io/otel/sdk v1.46.0
+	go.opentelemetry.io/otel/trace v1.46.0
 	go.uber.org/automaxprocs v1.6.0
 	go.uber.org/goleak v1.3.0
 	go.uber.org/mock v0.6.0
@@ -118,7 +118,7 @@ require (
 	go.etcd.io/etcd/client/pkg/v3 v3.5.21 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 // indirect
-	go.opentelemetry.io/otel/metric v1.45.0 // indirect
+	go.opentelemetry.io/otel/metric v1.46.0 // indirect
 	go.opentelemetry.io/proto/otlp v1.11.0 // indirect
 	go.uber.org/atomic v1.11.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
```

**File**: `go.sum` (modified, +14/-14)
```diff
@@ -190,8 +190,8 @@ github.com/stretchr/testify v1.7.0/go.mod h1:6Fq8oRcR53rry900zMqJjRRixrwX3KX962/
 github.com/stretchr/testify v1.7.1/go.mod h1:6Fq8oRcR53rry900zMqJjRRixrwX3KX962/h/Wwjteg=
 github.com/stretchr/testify v1.8.0/go.mod h1:yNjHg4UonilssWZ8iaSj1OCr/vHnekPRkoO+kdMU+MU=
 github.com/stretchr/testify v1.8.1/go.mod h1:w2LPCIKwWwSfY2zedu0+kehJoqGctiVI29o6fzry7u4=
-github.com/stretchr/testify v1.11.1 h1:7s2iGBzp5EwR7/aIZr8ao5+dra3wiQyKjjFuvgVKu7U=
-github.com/stretchr/testify v1.11.1/go.mod h1:wZwfW3scLgRK+23gO65QZefKpKQRnfz6sD981Nm4B6U=
+github.com/stretchr/testify v1.12.1 h1:EuwCh5fleGS7H32xRwO3wRGT7DxrDhLAT6FF8MpWDWE=
+github.com/stretchr/testify v1.12.1/go.mod h1:MDEgiDPPsNp5cuIrHPPCyornHKgEVbtFUmoNlxoYthg=
 github.com/titanous/json5 v1.0.0 h1:hJf8Su1d9NuI/ffpxgxQfxh/UiBFZX7bMPid0rIL/7s=
 github.com/titanous/json5 v1.0.0/go.mod h1:7JH1M8/LHKc6cyP5o5g3CSaRj+mBrIimTxzpvmckH8c=
 github.com/x448/float16 v0.8.4 h1:qLwI1I70+NjRFUR3zs1JPUCgaCXSh3SW62uAKT1mSBM=
@@ -223,26 +223,26 @@ go.mongodb.org/mongo-driver/v2 v2.8.0 h1:CxWDGQYY8QQwNjAl/aq2sfWakdnWZynnqJ9F4Dh
 go.mongodb.org/mongo-driver/v2 v2.8.0/go.mod h1:yOI9kBsufol30iFsl1slpdq1I0eHPzybRWdyYUs8K/0=
 go.opentelemetry.io/auto/sdk v1.2.1 h1:jXsnJ4Lmnqd11kwkBV2LgLoFMZKizbCi5fNZ/ipaZ64=
 go.opentelemetry.io/auto/sdk v1.2.1/go.mod h1:KRTj+aOaElaLi+wW1kO/DZRXwkF4C5xPbEe3ZiIhN7Y=
-go.opentelemetry.io/otel v1.45.0 h1:pdrWmLHofpubmArBv1LgFSv1Z0Ie/ppdZzu+kUN5EeU=
-go.opentelemetry.io/otel v1.45.0/go.mod h1:XZxIqPapzEYnhNSScF5DIqXhm/rYi0FzCe2XddAwZfQ=
+go.opentelemetry.io/otel v1.46.0 h1:FHt5/CDyVxi/8IM1CH7VE/rRgq3kLHa2mSTVMO8AWyc=
+go.opentelemetry.io/otel v1.46.0/go.mod h1:Gj3SEScelsNC45tp4nSxRYlS+f5iez7W8XPMCt905kE=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 h1:QRefszxJmfPdjXUUm3j6iDzY03mTPXMjqErFqQ67vUg=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0/go.mod h1:Tiz03lTBVBrm7eWZBOidzEaYaJa8tjwGUGv6d8mlTyk=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.40.0 h1:DvJDOPmSWQHWywQS6lKL+pb8s3gBLOZUtw4N+mavW1I=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.40.0/go.mod h1:EtekO9DEJb4/jRyN4v4Qjc2yA7AtfCBuz2FynRUWTXs=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0 h1:QBajQ2SrwQijzHyZbQlPsuIzpl/ll8DY6wPWsajeGcI=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0/go.mod h1:08ZQLjrPLQ6R4kAXvuOvODEer5Yh4CoFvll5qB2BCI8=
-go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.45.0 h1:lsA/S1bxgdbyFGkTj+3meEdJ6ADVU7QoFstV6MXgE68=
-go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.45.0/go.mod h1:L7u+MirGoB1bjeLH66+xDykF4RC8C3RN7lIFpBiewUo=
+go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.46.0 h1:KdRxPiAoMptR3vfWzvjjvutTsSiwbC2uG0496rzZNfo=
+go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.46.0/go.mod h1:K/qSA+3G7Eovxi4K09wzrAgkWRnosS0DAOZeEpve7sM=
 go.opentelemetry.io/otel/exporters/zipkin v1.45.0 h1:KN3btaILMTxR4QDHVGAO87lq5ButzK7l+kIfLuxQ1oA=
 go.opentelemetry.io/otel/exporters/zipkin v1.45.0/go.mod h1:yNcodmUclM4InyWoOwX/YW4Jri0Gj5FWAlM+NqCrtqY=
-go.opentelemetry.io/otel/metric v1.45.0 h1:7Eg1uH7CJ5cXv9is6tnBe1FI6rj1nwUdbFypRm3br/M=
-go.opentelemetry.io/otel/metric v1.45.0/go.mod h1:HAPbm1nd3p1PmFH7v2dR+6BjXxw+Lq4a2+pndMAm08s=
-go.opentelemetry.io/otel/sdk v1.45.0 h1:4VVSMgQ83dUgW2aoX5f6JgLvHwIvzcuLnF9lUdCSpCw=
-go.opentelemetry.io/otel/sdk v1.45.0/go.mod h1:Sr40LgXV7DsKMMJMKOhUWOgMWTfAaqvm2kF0g7ilwuA=
-go.opentelemetry.io/otel/sdk/metric v1.45.0 h1:oVFszMfyj1Am6s24Vtc7wBb8BKLcwepJjNEYILuiE3o=
-go.opentelemetry.io/otel/sdk/metric v1.45.0/go.mod h1:vUWUxDZvu1WVRj8JA8S0AdhsPrZoDpA2DdZauIh4mDA=
-go.opentelemetry.io/otel/trace v1.45.0 h1:l/mP6Uv7oNO7/TblbhpbgMidxhq1uO/rPsikOyVhxag=
-go.opentelemetry.io/otel/trace v1.45.0/go.mod h1:qoJJA2xNMnxRrdISU/kLtfUH2wNeQbiv+jhs/CxI8bc=
+go.opentelemetry.io/otel/metric v1.46.0 h1:yBnkXvgV7AXFILZc5K6IZe/CBFF3OS7BJ8ov6/lj0K8=
+go.opentelemetry.io/otel/metric v1.46.0/go.mod h1:iPmdWqifKUdzziPkvvzIJXITl56fQx2mGM/DHLB3/2o
```

---

### Incident Patch 8: `9fd700ec` (2026-08-08)
**Commit Message**: chore(deps): bump go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp from 1.40.0 to 1.45.0 (#5717)

**File**: `go.mod` (modified, +11/-11)
```diff
@@ -26,18 +26,18 @@ require (
 	go.mongodb.org/mongo-driver/v2 v2.8.0
 	go.opentelemetry.io/otel v1.45.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.40.0
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.40.0
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0
 	go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.45.0
 	go.opentelemetry.io/otel/exporters/zipkin v1.40.0
 	go.opentelemetry.io/otel/sdk v1.45.0
 	go.opentelemetry.io/otel/trace v1.45.0
 	go.uber.org/automaxprocs v1.6.0
 	go.uber.org/goleak v1.3.0
 	go.uber.org/mock v0.6.0
-	golang.org/x/net v0.55.0
+	golang.org/x/net v0.57.0
 	golang.org/x/sys v0.47.0
 	golang.org/x/time v0.14.0
-	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa
+	google.golang.org/genproto/googleapis/api v0.0.0-20260803160001-6ac0973c030d
 	google.golang.org/grpc v1.83.0
 	google.golang.org/protobuf v1.36.11
 	gopkg.in/cheggaaa/pb.v1 v1.0.28
@@ -76,7 +76,7 @@ require (
 	github.com/google/jsonschema-go v0.4.3 // indirect
 	github.com/google/pprof v0.0.0-20260709232956-b9395ee17fa0 // indirect
 	github.com/grafana/pyroscope-go/godeltaprof v0.1.10 // indirect
-	github.com/grpc-ecosystem/grpc-gateway/v2 v2.27.7 // indirect
+	github.com/grpc-ecosystem/grpc-gateway/v2 v2.29.0 // indirect
 	github.com/h2non/parth v0.0.0-20190131123155-b4df798d6542 // indirect
 	github.com/jackc/pgpassfile v1.0.0 // indirect
 	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
@@ -117,20 +117,20 @@ require (
 	github.com/yuin/gopher-lua v1.1.2 // indirect
 	go.etcd.io/etcd/client/pkg/v3 v3.5.21 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
-	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.40.0 // indirect
+	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 // indirect
 	go.opentelemetry.io/otel/metric v1.45.0 // indirect
-	go.opentelemetry.io/proto/otlp v1.9.0 // indirect
+	go.opentelemetry.io/proto/otlp v1.11.0 // indirect
 	go.uber.org/atomic v1.11.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
 	go.uber.org/zap v1.28.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.5 // indirect
-	golang.org/x/crypto v0.51.0 // indirect
+	golang.org/x/crypto v0.54.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
-	golang.org/x/sync v0.20.0 // indirect
-	golang.org/x/term v0.43.0 // indirect
-	golang.org/x/text v0.37.0 // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	golang.org/x/sync v0.22.0 // indirect
+	golang.org/x/term v0.45.0 // indirect
+	golang.org/x/text v0.40.0 // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260803160001-6ac0973c030d // indirect
 	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	gopkg.in/yaml.v3 v3.0.1 // indirect
```

**File**: `go.sum` (modified, +24/-24)
```diff
@@ -83,8 +83,8 @@ github.com/grafana/pyroscope-go v1.3.0 h1:t3Jehad8vvqN4oRAB0LdmfQ5ZSUXQw3asoft+K
 github.com/grafana/pyroscope-go v1.3.0/go.mod h1:XA7I3usNx+UdjOZfQnl1WV8y924vsJo9KIVrKB+9jx4=
 github.com/grafana/pyroscope-go/godeltaprof v0.1.10 h1:dvhndEbyavTb59vFCd6PsrAG5qi69/qZZtegh/TJKSY=
 github.com/grafana/pyroscope-go/godeltaprof v0.1.10/go.mod h1:XnWRGg2XO5uxZdiz1rfeJH6w1eZ+YICCBVXNWOfH86g=
-github.com/grpc-ecosystem/grpc-gateway/v2 v2.27.7 h1:X+2YciYSxvMQK0UZ7sg45ZVabVZBeBuvMkmuI2V3Fak=
-github.com/grpc-ecosystem/grpc-gateway/v2 v2.27.7/go.mod h1:lW34nIZuQ8UDPdkon5fmfp2l3+ZkQ2me/+oecHYLOII=
+github.com/grpc-ecosystem/grpc-gateway/v2 v2.29.0 h1:5VipnvEpbqr2gA2VbM+nYVbkIF28c5ZQfqCBQ5g2xfk=
+github.com/grpc-ecosystem/grpc-gateway/v2 v2.29.0/go.mod h1:Hyl3n6Twe1hvtd9XUXDec4pTvgMSEixRuQKPTMH2bNs=
 github.com/h2non/parth v0.0.0-20190131123155-b4df798d6542 h1:2VTzZjLZBgl62/EtslCrtky5vbi9dd7HrQPQIx6wqiw=
 github.com/h2non/parth v0.0.0-20190131123155-b4df798d6542/go.mod h1:Ow0tF8D4Kplbc8s8sSb3V2oUCygFHVp8gC3Dn6U4MNI=
 github.com/jackc/pgpassfile v1.0.0 h1:/6Hmqy13Ss2zCq62VdNG8tM1wchn8zjSGOBJ6icpsIM=
@@ -225,12 +225,12 @@ go.opentelemetry.io/auto/sdk v1.2.1 h1:jXsnJ4Lmnqd11kwkBV2LgLoFMZKizbCi5fNZ/ipaZ
 go.opentelemetry.io/auto/sdk v1.2.1/go.mod h1:KRTj+aOaElaLi+wW1kO/DZRXwkF4C5xPbEe3ZiIhN7Y=
 go.opentelemetry.io/otel v1.45.0 h1:pdrWmLHofpubmArBv1LgFSv1Z0Ie/ppdZzu+kUN5EeU=
 go.opentelemetry.io/otel v1.45.0/go.mod h1:XZxIqPapzEYnhNSScF5DIqXhm/rYi0FzCe2XddAwZfQ=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.40.0 h1:QKdN8ly8zEMrByybbQgv8cWBcdAarwmIPZ6FThrWXJs=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.40.0/go.mod h1:bTdK1nhqF76qiPoCCdyFIV+N/sRHYXYCTQc+3VCi3MI=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0 h1:QRefszxJmfPdjXUUm3j6iDzY03mTPXMjqErFqQ67vUg=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.45.0/go.mod h1:Tiz03lTBVBrm7eWZBOidzEaYaJa8tjwGUGv6d8mlTyk=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.40.0 h1:DvJDOPmSWQHWywQS6lKL+pb8s3gBLOZUtw4N+mavW1I=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.40.0/go.mod h1:EtekO9DEJb4/jRyN4v4Qjc2yA7AtfCBuz2FynRUWTXs=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.40.0 h1:wVZXIWjQSeSmMoxF74LzAnpVQOAFDo3pPji9Y4SOFKc=
-go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.40.0/go.mod h1:khvBS2IggMFNwZK/6lEeHg/W57h/IX6J4URh57fuI40=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0 h1:QBajQ2SrwQijzHyZbQlPsuIzpl/ll8DY6wPWsajeGcI=
+go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.45.0/go.mod h1:08ZQLjrPLQ6R4kAXvuOvODEer5Yh4CoFvll5qB2BCI8=
 go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.45.0 h1:lsA/S1bxgdbyFGkTj+3meEdJ6ADVU7QoFstV6MXgE68=
 go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.45.0/go.mod h1:L7u+MirGoB1bjeLH66+xDykF4RC8C3RN7lIFpBiewUo=
 go.opentelemetry.io/otel/exporters/zipkin v1.40.0 h1:zu+I4j+FdO6xIxBVPeuncQVbjxUM4LiMgv6GwGe9REE=
@@ -243,8 +243,8 @@ go.opentelemetry.io/otel/sdk/metric v1.45.0 h1:oVFszMfyj1Am6s24Vtc7wBb8BKLcwepJj
 go.opentelemetry.io/otel/sdk/metric v1.45.0/go.mod h1:vUWUxDZvu1WVRj8JA8S0AdhsPrZoDpA2DdZauIh4mDA=
 go.opentelemetry.io/otel/trace v1.45.0 h1:l/mP6Uv7oNO7/TblbhpbgMidxhq1uO/rPsikOyVhxag=
 go.opentelemetry.io/otel/trace v1.45.0/go.mod h1:qoJJA2xNMnxRrdISU/kLtfUH2wNeQbiv+jhs/CxI8bc=
-go.opentelemetry.io/proto/otlp v1.9.0 h1:l706jCMITVouPOqEnii2fIAuO3IVGBRPV5ICjceRb/A=
-go.opentelemetry.io/proto/otlp v1.9.0/go.mod h1:xE+Cx5E/eEHw+ISFkwPLwCZefwVjY+pqKg1qcK03+/4=
+go.opentelemetry.io/proto/otlp v1.11.0 h1:5rrYs0Ykyj50sdU/JU0x8etU+LubXWb+gED6TbEdMIk=
+go.opentelemetry.io/proto/otlp v1.11.0/go.mod h1:SmVizdCOAm3XBtG1g1NnOdhW6jtddT72hLMhv8VwA8E=
 go.uber.org/atomic v1.11.0 h1:ZvwS0R+56ePWxUNi+Atn9dWONBPp/AUETXlHW0DxSjE=
 go.uber.org/atomic v1.11.0/go.mod h1:LUxbIzbOniOlMKjJjyPfpl4v+PKK2cNJn91OQbhoJI0=
 go.uber.org/automaxprocs v1.6.0 h1:O3y2/QNTOdbF+e/dpXNNW7Rx2hZ4sTIPyybbxyNqTUs=
@@ -265,8 +
```

---

### Incident Patch 9: `2d3a4d2f` (2026-08-08)
**Commit Message**: chore(deps): bump go.opentelemetry.io/otel/exporters/stdout/stdouttrace from 1.40.0 to 1.45.0 (#5719)

Signed-off-by: dependabot[bot] <support@github.com>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +3/-3)
```diff
@@ -27,15 +27,15 @@ require (
 	go.opentelemetry.io/otel v1.45.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.40.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.40.0
-	go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.40.0
+	go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.45.0
 	go.opentelemetry.io/otel/exporters/zipkin v1.40.0
-	go.opentelemetry.io/otel/sdk v1.44.0
+	go.opentelemetry.io/otel/sdk v1.45.0
 	go.opentelemetry.io/otel/trace v1.45.0
 	go.uber.org/automaxprocs v1.6.0
 	go.uber.org/goleak v1.3.0
 	go.uber.org/mock v0.6.0
 	golang.org/x/net v0.55.0
-	golang.org/x/sys v0.45.0
+	golang.org/x/sys v0.47.0
 	golang.org/x/time v0.14.0
 	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa
 	google.golang.org/grpc v1.83.0
```

**File**: `go.sum` (modified, +8/-8)
```diff
@@ -231,16 +231,16 @@ go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.40.0 h1:DvJDO
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.40.0/go.mod h1:EtekO9DEJb4/jRyN4v4Qjc2yA7AtfCBuz2FynRUWTXs=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.40.0 h1:wVZXIWjQSeSmMoxF74LzAnpVQOAFDo3pPji9Y4SOFKc=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.40.0/go.mod h1:khvBS2IggMFNwZK/6lEeHg/W57h/IX6J4URh57fuI40=
-go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.40.0 h1:MzfofMZN8ulNqobCmCAVbqVL5syHw+eB2qPRkCMA/fQ=
-go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.40.0/go.mod h1:E73G9UFtKRXrxhBsHtG00TB5WxX57lpsQzogDkqBTz8=
+go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.45.0 h1:lsA/S1bxgdbyFGkTj+3meEdJ6ADVU7QoFstV6MXgE68=
+go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.45.0/go.mod h1:L7u+MirGoB1bjeLH66+xDykF4RC8C3RN7lIFpBiewUo=
 go.opentelemetry.io/otel/exporters/zipkin v1.40.0 h1:zu+I4j+FdO6xIxBVPeuncQVbjxUM4LiMgv6GwGe9REE=
 go.opentelemetry.io/otel/exporters/zipkin v1.40.0/go.mod h1:zS6cC4nFBYXbu18e7aLfMzubBjOiN7ZcROu477qtMf8=
 go.opentelemetry.io/otel/metric v1.45.0 h1:7Eg1uH7CJ5cXv9is6tnBe1FI6rj1nwUdbFypRm3br/M=
 go.opentelemetry.io/otel/metric v1.45.0/go.mod h1:HAPbm1nd3p1PmFH7v2dR+6BjXxw+Lq4a2+pndMAm08s=
-go.opentelemetry.io/otel/sdk v1.44.0 h1:nHYwb9lK+fJPU/dnT6s7W7Z8itMWyqrnVfbheVYrZ58=
-go.opentelemetry.io/otel/sdk v1.44.0/go.mod h1:Osuydd3Se74nqjAKxid74N5eC+jfEqfTegHRnq58oK0=
-go.opentelemetry.io/otel/sdk/metric v1.44.0 h1:3LlKgI+VjbVsjNRFZJZAJ30WjXC5VkNRks6si09iEfI=
-go.opentelemetry.io/otel/sdk/metric v1.44.0/go.mod h1:5B5pMARnXxKhltooO4xUuCBorl65a4EpnTalObqOigA=
+go.opentelemetry.io/otel/sdk v1.45.0 h1:4VVSMgQ83dUgW2aoX5f6JgLvHwIvzcuLnF9lUdCSpCw=
+go.opentelemetry.io/otel/sdk v1.45.0/go.mod h1:Sr40LgXV7DsKMMJMKOhUWOgMWTfAaqvm2kF0g7ilwuA=
+go.opentelemetry.io/otel/sdk/metric v1.45.0 h1:oVFszMfyj1Am6s24Vtc7wBb8BKLcwepJjNEYILuiE3o=
+go.opentelemetry.io/otel/sdk/metric v1.45.0/go.mod h1:vUWUxDZvu1WVRj8JA8S0AdhsPrZoDpA2DdZauIh4mDA=
 go.opentelemetry.io/otel/trace v1.45.0 h1:l/mP6Uv7oNO7/TblbhpbgMidxhq1uO/rPsikOyVhxag=
 go.opentelemetry.io/otel/trace v1.45.0/go.mod h1:qoJJA2xNMnxRrdISU/kLtfUH2wNeQbiv+jhs/CxI8bc=
 go.opentelemetry.io/proto/otlp v1.9.0 h1:l706jCMITVouPOqEnii2fIAuO3IVGBRPV5ICjceRb/A=
@@ -293,8 +293,8 @@ golang.org/x/sys v0.0.0-20201119102817-f84b799fce68/go.mod h1:h1NjWce9XRLGQEsW7w
 golang.org/x/sys v0.0.0-20210615035016-665e8c7367d1/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.0.0-20220520151302-bc2c85ada10a/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.0.0-20220722155257-8c9f86f7a55f/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
-golang.org/x/sys v0.45.0 h1:dO4czNzziLiiXplLQgBCEpCvXQ3dnkn0SdaZSYdQ+FY=
-golang.org/x/sys v0.45.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
+golang.org/x/sys v0.47.0 h1:o7XGOvZQCADBQQ4Y7VNq2dRWQR7JmOUW8Kxx4ZsNgWs=
+golang.org/x/sys v0.47.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
 golang.org/x/term v0.0.0-20201126162022-7de9c90e9dd1/go.mod h1:bj7SfCRtBDWHUb9snDiAeCFNEtKQo2Wmx5Cou7ajbmo=
 golang.org/x/term v0.0.0-20210927222741-03fcf44c2211/go.mod h1:jbD1KX2456YbFQfuXm/mYQcufACuNUgVhRMnK/tPxf8=
 golang.org/x/term v0.43.0 h1:S4RLU2sB31O/NCl+zFN9Aru9A/Cq2aqKpTZJ6B+DwT4=
```

---

### Incident Patch 10: `b8ffc99b` (2026-08-08)
**Commit Message**: chore(deps): bump go.opentelemetry.io/otel/trace from 1.44.0 to 1.45.0 (#5718)

Signed-off-by: dependabot[bot] <support@github.com>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +3/-3)
```diff
@@ -24,13 +24,13 @@ require (
 	go.etcd.io/etcd/api/v3 v3.5.21
 	go.etcd.io/etcd/client/v3 v3.5.21
 	go.mongodb.org/mongo-driver/v2 v2.8.0
-	go.opentelemetry.io/otel v1.44.0
+	go.opentelemetry.io/otel v1.45.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.40.0
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.40.0
 	go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.40.0
 	go.opentelemetry.io/otel/exporters/zipkin v1.40.0
 	go.opentelemetry.io/otel/sdk v1.44.0
-	go.opentelemetry.io/otel/trace v1.44.0
+	go.opentelemetry.io/otel/trace v1.45.0
 	go.uber.org/automaxprocs v1.6.0
 	go.uber.org/goleak v1.3.0
 	go.uber.org/mock v0.6.0
@@ -118,7 +118,7 @@ require (
 	go.etcd.io/etcd/client/pkg/v3 v3.5.21 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.40.0 // indirect
-	go.opentelemetry.io/otel/metric v1.44.0 // indirect
+	go.opentelemetry.io/otel/metric v1.45.0 // indirect
 	go.opentelemetry.io/proto/otlp v1.9.0 // indirect
 	go.uber.org/atomic v1.11.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
```

**File**: `go.sum` (modified, +6/-6)
```diff
@@ -223,8 +223,8 @@ go.mongodb.org/mongo-driver/v2 v2.8.0 h1:CxWDGQYY8QQwNjAl/aq2sfWakdnWZynnqJ9F4Dh
 go.mongodb.org/mongo-driver/v2 v2.8.0/go.mod h1:yOI9kBsufol30iFsl1slpdq1I0eHPzybRWdyYUs8K/0=
 go.opentelemetry.io/auto/sdk v1.2.1 h1:jXsnJ4Lmnqd11kwkBV2LgLoFMZKizbCi5fNZ/ipaZ64=
 go.opentelemetry.io/auto/sdk v1.2.1/go.mod h1:KRTj+aOaElaLi+wW1kO/DZRXwkF4C5xPbEe3ZiIhN7Y=
-go.opentelemetry.io/otel v1.44.0 h1:JjwHmHpA4iZ3wBxluu2fbbE7j4kqlE8jXyAyPXH7HqU=
-go.opentelemetry.io/otel v1.44.0/go.mod h1:BMgjTHL9WPRlRjL2oZCBTL4whCGtXch2H4BhOPIAyYc=
+go.opentelemetry.io/otel v1.45.0 h1:pdrWmLHofpubmArBv1LgFSv1Z0Ie/ppdZzu+kUN5EeU=
+go.opentelemetry.io/otel v1.45.0/go.mod h1:XZxIqPapzEYnhNSScF5DIqXhm/rYi0FzCe2XddAwZfQ=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.40.0 h1:QKdN8ly8zEMrByybbQgv8cWBcdAarwmIPZ6FThrWXJs=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.40.0/go.mod h1:bTdK1nhqF76qiPoCCdyFIV+N/sRHYXYCTQc+3VCi3MI=
 go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.40.0 h1:DvJDOPmSWQHWywQS6lKL+pb8s3gBLOZUtw4N+mavW1I=
@@ -235,14 +235,14 @@ go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.40.0 h1:MzfofMZN8ulNqob
 go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.40.0/go.mod h1:E73G9UFtKRXrxhBsHtG00TB5WxX57lpsQzogDkqBTz8=
 go.opentelemetry.io/otel/exporters/zipkin v1.40.0 h1:zu+I4j+FdO6xIxBVPeuncQVbjxUM4LiMgv6GwGe9REE=
 go.opentelemetry.io/otel/exporters/zipkin v1.40.0/go.mod h1:zS6cC4nFBYXbu18e7aLfMzubBjOiN7ZcROu477qtMf8=
-go.opentelemetry.io/otel/metric v1.44.0 h1:1w0gILTcHdr3YI+ixLyjemwrVnsMURbTZFrSYCdDdmc=
-go.opentelemetry.io/otel/metric v1.44.0/go.mod h1:8O7hanEPBNgEMmybD3s2VBKcgWOCsA6tzHBPODAiquo=
+go.opentelemetry.io/otel/metric v1.45.0 h1:7Eg1uH7CJ5cXv9is6tnBe1FI6rj1nwUdbFypRm3br/M=
+go.opentelemetry.io/otel/metric v1.45.0/go.mod h1:HAPbm1nd3p1PmFH7v2dR+6BjXxw+Lq4a2+pndMAm08s=
 go.opentelemetry.io/otel/sdk v1.44.0 h1:nHYwb9lK+fJPU/dnT6s7W7Z8itMWyqrnVfbheVYrZ58=
 go.opentelemetry.io/otel/sdk v1.44.0/go.mod h1:Osuydd3Se74nqjAKxid74N5eC+jfEqfTegHRnq58oK0=
 go.opentelemetry.io/otel/sdk/metric v1.44.0 h1:3LlKgI+VjbVsjNRFZJZAJ30WjXC5VkNRks6si09iEfI=
 go.opentelemetry.io/otel/sdk/metric v1.44.0/go.mod h1:5B5pMARnXxKhltooO4xUuCBorl65a4EpnTalObqOigA=
-go.opentelemetry.io/otel/trace v1.44.0 h1:jxF5CsGYCe74MCRx2X4g7WsY/VBKRqqpNvXlX/6gtIk=
-go.opentelemetry.io/otel/trace v1.44.0/go.mod h1:oLl1jrMQAVo6v3GAggN+1VH9VIz9iUSvW53sW1Q8PIE=
+go.opentelemetry.io/otel/trace v1.45.0 h1:l/mP6Uv7oNO7/TblbhpbgMidxhq1uO/rPsikOyVhxag=
+go.opentelemetry.io/otel/trace v1.45.0/go.mod h1:qoJJA2xNMnxRrdISU/kLtfUH2wNeQbiv+jhs/CxI8bc=
 go.opentelemetry.io/proto/otlp v1.9.0 h1:l706jCMITVouPOqEnii2fIAuO3IVGBRPV5ICjceRb/A=
 go.opentelemetry.io/proto/otlp v1.9.0/go.mod h1:xE+Cx5E/eEHw+ISFkwPLwCZefwVjY+pqKg1qcK03+/4=
 go.uber.org/atomic v1.11.0 h1:ZvwS0R+56ePWxUNi+Atn9dWONBPp/AUETXlHW0DxSjE=
```

#### Recent Merged Pull Requests:
- **PR #5799** (closed): fix(collection): correct TimingWheel moves after ticks (@014-code)
- **PR #5791** (2026-09-25): chore: remove stale issue workflow (@kevwan)
- **PR #5789** (closed): fix(filex): keep long last line in SplitLineChunks (@drakeo338)
- **PR #5785** (2026-09-25): chore(deps): bump github/codeql-action from 4.37.9 to 4.38.1 (@dependabot[bot])
- **PR #5784** (2026-09-25): chore(deps): bump google.golang.org/grpc from 1.83.2 to 1.84.0 in /tools/goctl (@dependabot[bot])
- **PR #5783** (2026-09-22): ci: authenticate Codecov uploads with OIDC (@kevwan)
- **PR #5782** (2026-09-25): chore(deps): bump go.opentelemetry.io/otel/sdk from 1.44.0 to 1.45.0 in /tools/goctl in the go_modules group across 1 directory (@dependabot[bot])
- **PR #5781** (closed): chore(deps): bump github/codeql-action from 4.37.9 to 4.38.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
