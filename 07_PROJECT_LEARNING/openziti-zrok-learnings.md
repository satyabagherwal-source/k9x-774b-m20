> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/openziti-zrok-learnings.md`  
> **Source**: github ([https://github.com/openziti/zrok](https://github.com/openziti/zrok))  
> **Source Version**: `fea58ae4`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T21:30:06.713Z  
> **Learning ID**: `learn-github-openziti-zrok`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): openziti/zrok

> **Canonical Artifact**: `07_PROJECT_LEARNING/openziti-zrok-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/openziti/zrok](https://github.com/openziti/zrok))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-30T21:30:06.256Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `openziti/zrok`
- **Description**: Secure internet sharing made simple.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 4796 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent/publicWorker.go`
```
package agent

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/michaelquigley/df/dl"
	"github.com/openziti/zrok/v2/agent/proctree"
	"github.com/openziti/zrok/v2/cmd/zrok2/subordinate"
	"github.com/openziti/zrok/v2/sdk/golang/sdk"
)

// publicCreateError distinguishes a refused create from a later backend or cleanup failure.
type publicCreateError struct{ cause error }

func (e *publicCreateError) Error() string { return e.cause.Error() }
func (e *publicCreateError) Unwrap() error { return e.cause }

func (a *Agent) launchPublic(op *operation, attempt *startAttempt, req *SharePublicRequest) (*share, error) {
	prepared, err := a.preparePublicRequest(req)
	if err != nil {
		return nil, err
	}
	if err := errors.Join(attempt.ctx.Err(), attempt.caller.Err()); err != nil {
		return nil, err
	}
	// once dispatched, let the bounded request settle even if the caller or agent stops.
	// a returned token must enter the registered operation before any cancellation is handled.
	ctx, cancel := context.WithTimeout(context.Background(), a.options.create)
	created, err := a.deps.createPublic(ctx, prepared)
	cancel()
	if err != nil {
		return nil, &publicCreateError{cause: err}
	}
	if created == nil || strings.TrimSpace(created.Token) == "" {
		return nil, errors.New("controller returned a public share without a token")
	}
	var names []NameSelection
	for _, selection := range prepared.NameSelections {
		names = append(names, NameSelection{NamespaceToken: selection.NamespaceToken, Name: selection.Name})
	}
	shr := &share{token: created.Token, frontendEndpoints: slices.Clone(created.FrontendEndpoints),
		shareMode: sdk.PublicShareMode, backendMode: prepared.BackendMode, target: prepared.Target,
		basicAuth: prepared.BasicAuth, nameSelections: names, insecure: req.Insecure,
		oauthProvider: prepared.OauthProvider, oauthEmailAddressPatterns: prepared.OauthEmailAddressPatterns,
		closed: req.Closed, accessGrants: prepared.AccessGrants}
	a.mu.Lock()
	op.shr = shr
	stopping := op.stop || op.released || a.stopping
	a.mu.Unlock()
	if err := errors.Join(attempt.ctx.Err(), attempt.caller.Err()); err != nil {
		return shr, err
	}
	if stopping {
		return shr, errors.New("public share stopped during creation")
	}
	boot := &legacyBoot{shr: shr}
	handler := NewPublicWorkerBootHandler(shr, &boot.err)
	sub := subordinate.NewMessageHandler()
	sub.BootHandler = func(kind string, msg subordinate.Message) {
		boot.mu.Lock()
		defer boot.mu.Unlock()
		handler.HandleBoot(kind, msg)
	}
	sub.MalformedHandler = handler.HandleMalformed
	sub.MessageHandler = func(msg subordinate.Message) { dl.Info(msg) }
	command := NewSharePublicCommand().ShareToken(shr.token).BackendMode(string(prepared.BackendMode)).Insecure(req.Insecure).Target(prepared.Target).Build()
	startup, stop := context.WithTimeout(attempt.ctx, a.options.startup)
	defer stop()
	child, err := a.deps.startPublic(proctree.ControlledOptions{
		Stdout: sub.Tail, StdoutClosed: sub.Close,
		Stderr: func(data []byte) { dl.Infof("public worker stderr: '%s'", data) },
	}, command...)
	if err != nil {
		return shr, err
	}
	a.mu.Lock()
	op.child = child
	a.mu.Unlock()
	select {
	case <-sub.BootComplete:
		_, _, err := boot.snapshot()
		select {
		case <-child.Done():
			err = errors.Join(err, errors.New("public worker exited during startup"), proctree.WaitChild(child))
		default:
		}
		return shr, err
	case <-child.Done():
		return shr, fmt.Errorf("public worker exited before startup completed: %w", errors.Join(proctree.WaitChild(child), errors.New("worker is not running")))
	case <-startup.Done():
		return shr, startup.Err()
	}
}

```

### Core Architecture Module: `canary/looper.go`
```
package canary

import (
	"time"

	"github.com/michaelquigley/df/dl"
	"github.com/openziti/zrok/v2/util"
)

type LooperOptions struct {
	Iterations     uint
	StatusInterval uint
	Timeout        time.Duration
	MinPayload     uint64
	MaxPayload     uint64
	MinDwell       time.Duration
	MaxDwell       time.Duration
	MinPacing      time.Duration
	MaxPacing      time.Duration
	BatchSize      uint
	MinBatchPacing time.Duration
	MaxBatchPacing time.Duration
	TargetName     string
	BindAddress    string
	FrontendScheme string
	FrontendPort   uint16
	SnapshotQueue  chan *Snapshot
}

type LooperResults struct {
	StartTime  time.Time
	StopTime   time.Time
	Loops      uint
	Errors     uint
	Mismatches uint
	Bytes      uint64
}

func ReportLooperResults(results []*LooperResults) {
	totalBytes := uint64(0)
	totalXferRate := uint64(0)
	totalErrors := uint(0)
	totalMismatches := uint(0)
	totalLoops := uint(0)
	for i, result := range results {
		totalBytes += result.Bytes
		deltaSeconds := result.StopTime.Sub(result.StartTime).Seconds()
		xferRate := uint64(float64(result.Bytes) / deltaSeconds)
		totalXferRate += xferRate
		totalErrors += result.Errors
		totalMismatches += result.Mismatches
		totalLoops += result.Loops
		dl.Infof("looper #%d: %d loops, %v, %d errors, %d mismatches, %s/sec", i, result.Loops, util.BytesToSize(int64(result.Bytes)), result.Errors, result.Mismatches, util.BytesToSize(int64(xferRate)))
	}
	dl.Infof("total: %d loops, %v, %d errors, %d mismatches, %s/sec", totalLoops, util.BytesToSize(int64(totalBytes)), totalErrors, totalMismatches, util.BytesToSize(int64(totalXferRate)))
}

```

### Core Architecture Module: `canary/privateHttpLooper.go`
```
package canary

import (
	"bytes"
	"context"
	cryptorand "crypto/rand"
	"encoding/base64"
	"io"
	"math/rand"
	"net"
	"net/http"
	"time"

	"github.com/michaelquigley/df/dl"
	"github.com/openziti/sdk-golang/ziti"
	"github.com/openziti/sdk-golang/ziti/edge"
	"github.com/openziti/zrok/v2/environment/env_core"
	"github.com/openziti/zrok/v2/sdk/golang/sdk"
	"github.com/pkg/errors"
)

type PrivateHttpLooper struct {
	id          uint
	target      string
	bindAddress string
	acc         *sdk.Access
	opt         *LooperOptions
	root        env_core.Root
	shr         *sdk.Share
	listener    edge.Listener
	abort       bool
	done        chan struct{}
	results     *LooperResults
}

func NewPrivateHttpLooper(id uint, opt *LooperOptions, root env_core.Root) *PrivateHttpLooper {
	return &PrivateHttpLooper{
		id:      id,
		opt:     opt,
		root:    root,
		done:    make(chan struct{}),
		results: &LooperResults{},
	}
}

func (l *PrivateHttpLooper) Run() {
	defer close(l.done)
	defer dl.Infof("#%d stopping", l.id)
	defer l.shutdown()
	dl.Infof("#%d starting", l.id)

	if err := l.startup(); err != nil {
		dl.Fatalf("#%d error starting: %v", l.id, err)
	}

	if err := l.bind(); err != nil {
		dl.Fatalf("#%d error binding: %v", l.id, err)
	}

	l.dwell()

	l.iterate()

	dl.Infof("#%d completed", l.id)
}

func (l *PrivateHttpLooper) Abort() {
	l.abort = true
}

func (l *PrivateHttpLooper) Done() <-chan struct{} {
	return l.done
}

func (l *PrivateHttpLooper) Results() *LooperResults {
	return l.results
}

func (l *PrivateHttpLooper) startup() error {
	target := "canary.PrivateHttpLooper"
	if l.opt.TargetName != "" {
		target = l.opt.TargetName
	}

	snapshotCreateShare := NewSnapshot("create-share", l.id, 0)
	shr, err := sdk.CreateShare(l.root, &sdk.ShareRequest{
		ShareMode:      sdk.PrivateShareMode,
		BackendMode:    sdk.ProxyBackendMode,
		Target:         target,
		PermissionMode: sdk.ClosedPermissionMode,
	})
	snapshotCreateShare.Complete()
	if err != nil {
		snapshotCreateShare.Failure(err).Send(l.opt.SnapshotQueue)
		return err
	}
	snapshotCreateShare.Success().Send(l.opt.SnapshotQueue)
	l.shr = shr

	bindAddress := ""
	if l.opt.BindAddress != "" {
		bindAddress = l.opt.BindAddress
	}
	snapshotCreateAccess := NewSnapshot("create-access", l.id, 0)
	acc, err := sdk.CreateAccess(l.root, &sdk.AccessRequest{
		ShareToken:  shr.Token,
		BindAddress: bindAddress,
	})
	snapshotCreateAccess.Complete()
	if err != nil {
		snapshotCreateAccess.Failure(err).Send(l.opt.SnapshotQueue)
		return err
	}
	snapshotCreateAccess.Success().Send(l.opt.SnapshotQueue)
	l.acc = acc

	dl.Infof("#%d allocated share '%v', allocated frontend '%v'", l.id, shr.Token, acc.Token)

	return nil
}

func (l *PrivateHttpLooper) bind() error {
	zif, err := l.root.ZitiIdentityNamed(l.root.EnvironmentIdentityName())
	if err != nil {
		return errors.Wrapf(err, "#%d error getting identity", l.id)
	}
	zcfg, err := ziti.NewConfigFromFile(zif)
	if err != nil {
		return errors.Wrapf(err, "#%d error loading ziti config", l.id)
	}
	options := ziti.ListenOptions{
		ConnectTimeout:               5 * time.Minute,
		WaitForNEstablishedListeners: 1,
	}
	zctx, err := ziti.NewContext(zcfg)
	if err != nil {
		return errors.Wrapf(err, "#%d error creating ziti context", l.id)
	}

	snapshotListen := NewSnapshot("listen", l.id, 0)
	if l.listener, err = zctx.ListenWithOptions(l.shr.Token, &options); err != nil {
		snapshotListen.Complete().Failure(err).Send(l.opt.SnapshotQueue)
		return errors.Wrapf(err, "#%d error binding listener", l.id)
	}
	snapshotListen.Complete().Success().Send(l.opt.SnapshotQueue)

	go func() {
		if err := http.Serve(l.listener, l); err != nil {
			dl.Errorf("#%d error in http listener: %v", l.id, err)
		}
	}()

	return nil
}

func (l *PrivateHttpLooper) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	buf := new(bytes.Buffer)
	io.Copy(buf, r.Body)
	w.Write(buf.Bytes())
}

func (l *PrivateHttpLooper) dwell() {
	dwell := l.opt.MinDwell.Milliseconds()
	dwelta := l.opt.MaxDwell.Milliseconds() - l.opt.MinDwell.Milliseconds()
	if dwelta > 0 {
		dwell = int64(rand.Intn(int(dwelta)) + int(l.opt.MinDwell.Milliseconds()))
	}
	time.Sleep(time.Duration(dwell) * time.Millisecond)
}

type connDialer struct {
	c net.Conn
}

func (cd connDialer) Dial(_ context.Context, network, addr string) (net.Conn, error) {
	return cd.c, nil
}

func (l *PrivateHttpLooper) iterate() {
	l.results.StartTime = time.Now()
	defer func() { l.results.StopTime = time.Now() }()

	for i := uint(0); i < l.opt.Iterations && !l.abort; i++ {
		if i > 0 && l.opt.BatchSize > 0 && i%l.opt.BatchSize == 0 {
			batchPacingMs := l.opt.MaxBatchPacing.Milliseconds()
			batchPacingDelta := l.opt.MaxBatchPacing.Milliseconds() - l.opt.MinBatchPacing.Milliseconds()
			if batchPacingDelta > 0 {
				batchPacingMs = (rand.Int63() % batchPacingDelta) + l.opt.MinBatchPacing.Milliseconds()
			}
			dl.Debugf("sleeping %d ms for batch pacing", batchPacingMs)
			time.Sleep(time.Duration(batchPacingMs) * time.Millisecond)
		}

		snapshot := NewSnapshot("private-proxy", l.id, uint64(i))

		if i > 0 && i%l.opt.StatusInterval == 0 {
			dl.Infof("#%d: iteration %d", l.id, i)
		}

		conn, err := sdk.NewDialer(l.shr.Token, l.root)
		if err != nil {
			dl.Errorf("#%d: error dialing: %v", l.id, err)
			l.results.Errors++
			time.Sleep(1 * time.Second)
			continue
		}

		payloadSize := l.opt.MaxPayload
		payloadRange := l.opt.MaxPayload - l.opt.MinPayload
		if payloadRange > 0 {
			payloadSize = (rand.Uint64() % payloadRange) + l.opt.MinPayload
		}
		outPayload := make([]byte, payloadSize)
		cryptorand.Read(outPayload)
		outBase64 := base64.StdEncoding.EncodeToString(outPayload)
		snapshot.Size = uint64(len(outBase64))

		if req, err := http.NewRequest("POST", "http://"+l.shr.Token, bytes.NewBufferString(outBase64)); err == nil {
			client := &http.Client{Timeout: l.opt.Timeout, Transport: &http.Transport{DialContext: connDialer{conn}.Dial}}
			if resp, err := client.Do(req); err == nil {
				if resp.StatusCode != 200 {
					dl.Errorf("#%d: unexpected status code: %v", l.id, resp.StatusCode)
					l.results.Errors++
				}
				inPayload := new(bytes.Buffer)
				io.Copy(inPayload, resp.Body)
				inBase64 := inPayload.String()
				if inBase64 != outBase64 {
					dl.Errorf("#%d: payload mismatch", l.id)
					l.results.Mismatches++

					snapshot.Complete().Failure(err)
				} else {
					l.results.Bytes += uint64(len(outBase64))
					dl.Debugf("#%d: payload match", l.id)

					snapshot.Complete().Success()
				}
			} else {
				dl.Errorf("#%d: error: %v", l.id, err)
				l.results.Errors++
			}
		} else {
			dl.Errorf("#%d: error creating request: %v", l.id, err)
			l.results.Errors++
		}

		snapshot.Send(l.opt.SnapshotQueue)

		if err := conn.Close(); err != nil {
			dl.Errorf("#%d: error closing connection: %v", l.id, err)
		}

		pacingMs := l.opt.MaxPacing.Milliseconds()
		pacingDelta := l.opt.MaxPacing.Milliseconds() - l.opt.MinPacing.Milliseconds()
		if pacingDelta > 0 {
			pacingMs = (rand.Int63() % pacingDelta) + l.opt.MinPacing.Milliseconds()
		}
		time.Sleep(time.Duration(pacingMs) * time.Millisecond)

		l.results.Loops++
	}
}

func (l *PrivateHttpLooper) shutdown() {
	if l.listener != nil {
		if err := l.listener.Close(); err != nil {
			dl.Errorf("#%d error closing listener: %v", l.id, err)
		}
	}

	if err := sdk.DeleteAccess(l.root, l.acc); err != nil {
		dl.Errorf("#%d error deleting access '%v': %v", l.id, l.acc.Token, err)
	}

	if err := sdk.DeleteShare(l.root, l.shr); err != nil {
		dl.Errorf("#%d error deleting share '%v': %v", l.id, l.shr.Token, err)
	}
}

```

### Core Architecture Module: `canary/publicHttpLooper.go`
```
package canary

import (
	"bytes"
	cryptorand "crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/michaelquigley/df/dl"
	"github.com/openziti/sdk-golang/ziti"
	"github.com/openziti/sdk-golang/ziti/edge"
	"github.com/openziti/zrok/v2/environment/env_core"
	"github.com/openziti/zrok/v2/sdk/golang/sdk"
	"github.com/pkg/errors"
)

type PublicHttpLooper struct {
	id        uint
	namespace string
	opt       *LooperOptions
	root      env_core.Root
	shr       *sdk.Share
	listener  edge.Listener
	abort     bool
	done      chan struct{}
	results   *LooperResults
}

func NewPublicHttpLooper(id uint, namespace string, opt *LooperOptions, root env_core.Root) *PublicHttpLooper {
	return &PublicHttpLooper{
		id:        id,
		namespace: namespace,
		opt:       opt,
		root:      root,
		done:      make(chan struct{}),
		results:   &LooperResults{},
	}
}

func (l *PublicHttpLooper) Run() {
	defer close(l.done)
	defer dl.Infof("#%d stopping", l.id)
	defer l.shutdown()
	dl.Infof("#%d starting", l.id)

	if err := l.startup(); err != nil {
		dl.Fatalf("#%d error starting: %v", l.id, err)
	}

	if err := l.bind(); err != nil {
		dl.Fatalf("#%d error binding: %v", l.id, err)
	}

	l.dwell()

	l.iterate()

	dl.Infof("#%d completed", l.id)
}

func (l *PublicHttpLooper) Abort() {
	l.abort = true
}

func (l *PublicHttpLooper) Done() <-chan struct{} {
	return l.done
}

func (l *PublicHttpLooper) Results() *LooperResults {
	return l.results
}

func (l *PublicHttpLooper) startup() error {
	target := "canary.PublicHttpLooper"
	if l.opt.TargetName != "" {
		target = l.opt.TargetName
	}

	snapshotCreateShare := NewSnapshot("create-share", l.id, 0)
	shr, err := sdk.CreateShare(l.root, &sdk.ShareRequest{
		ShareMode:      sdk.PublicShareMode,
		BackendMode:    sdk.ProxyBackendMode,
		Target:         target,
		NameSelections: []sdk.NameSelection{{NamespaceToken: l.namespace}},
		PermissionMode: sdk.ClosedPermissionMode,
	})
	snapshotCreateShare.Complete()
	if err != nil {
		snapshotCreateShare.Failure(err).Send(l.opt.SnapshotQueue)
		return err
	}
	snapshotCreateShare.Success().Send(l.opt.SnapshotQueue)
	l.shr = shr

	dl.Infof("#%d allocated share '%v'", l.id, l.shr.Token)

	// The controller returns frontend endpoints as bare name.namespace
	// (e.g., "abc123.public"). Prefix with the URI scheme so HTTP clients
	// can reach the frontend proxy.
	for i, ep := range l.shr.FrontendEndpoints {
		if !strings.Contains(ep, "://") {
			if l.opt.FrontendPort != 0 {
				l.shr.FrontendEndpoints[i] = fmt.Sprintf("%s://%s:%d", l.opt.FrontendScheme, ep, l.opt.FrontendPort)
			} else {
				l.shr.FrontendEndpoints[i] = fmt.Sprintf("%s://%s", l.opt.FrontendScheme, ep)
			}
			dl.Infof("#%d rewrote frontend endpoint: %v", l.id, l.shr.FrontendEndpoints[i])
		}
	}

	return nil
}

func (l *PublicHttpLooper) bind() error {
	zif, err := l.root.ZitiIdentityNamed(l.root.EnvironmentIdentityName())
	if err != nil {
		return errors.Wrapf(err, "#%d error getting identity", l.id)
	}
	zcfg, err := ziti.NewConfigFromFile(zif)
	if err != nil {
		return errors.Wrapf(err, "#%d error loading ziti config", l.id)
	}
	options := ziti.ListenOptions{
		ConnectTimeout:               5 * time.Minute,
		WaitForNEstablishedListeners: 1,
	}
	zctx, err := ziti.NewContext(zcfg)
	if err != nil {
		return errors.Wrapf(err, "#%d error creating ziti context", l.id)
	}

	snapshotListen := NewSnapshot("listen", l.id, 0)
	if l.listener, err = zctx.ListenWithOptions(l.shr.Token, &options); err != nil {
		snapshotListen.Complete().Failure(err).Send(l.opt.SnapshotQueue)
		return errors.Wrapf(err, "#%d error binding listener", l.id)
	}
	snapshotListen.Complete().Success().Send(l.opt.SnapshotQueue)

	go func() {
		if err := http.Serve(l.listener, l); err != nil {
			dl.Errorf("#%d error in http listener: %v", l.id, err)
		}
	}()

	return nil
}

func (l *PublicHttpLooper) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	buf := new(bytes.Buffer)
	io.Copy(buf, r.Body)
	w.Write(buf.Bytes())
}

func (l *PublicHttpLooper) dwell() {
	dwell := l.opt.MinDwell.Milliseconds()
	dwelta := l.opt.MaxDwell.Milliseconds() - l.opt.MinDwell.Milliseconds()
	if dwelta > 0 {
		dwell = int64(rand.Intn(int(dwelta)) + int(l.opt.MinDwell.Milliseconds()))
	}
	time.Sleep(time.Duration(dwell) * time.Millisecond)
}

func (l *PublicHttpLooper) iterate() {
	l.results.StartTime = time.Now()
	defer func() { l.results.StopTime = time.Now() }()

	for i := uint(0); i < l.opt.Iterations && !l.abort; i++ {
		if i > 0 && l.opt.BatchSize > 0 && i%l.opt.BatchSize == 0 {
			batchPacingMs := l.opt.MaxBatchPacing.Milliseconds()
			batchPacingDelta := l.opt.MaxBatchPacing.Milliseconds() - l.opt.MinBatchPacing.Milliseconds()
			if batchPacingDelta > 0 {
				batchPacingMs = (rand.Int63() % batchPacingDelta) + l.opt.MinBatchPacing.Milliseconds()
			}
			dl.Debugf("sleeping %d ms for batch pacing", batchPacingMs)
			time.Sleep(time.Duration(batchPacingMs) * time.Millisecond)
		}

		snapshot := NewSnapshot("public-proxy", l.id, uint64(i))

		if i > 0 && i%l.opt.StatusInterval == 0 {
			dl.Infof("#%d: iteration %d", l.id, i)
		}

		payloadSize := l.opt.MaxPayload
		payloadRange := l.opt.MaxPayload - l.opt.MinPayload
		if payloadRange > 0 {
			payloadSize = (rand.Uint64() % payloadRange) + l.opt.MinPayload
		}
		outPayload := make([]byte, payloadSize)
		cryptorand.Read(outPayload)
		outBase64 := base64.StdEncoding.EncodeToString(outPayload)
		snapshot.Size = uint64(len(outBase64))

		if req, err := http.NewRequest("POST", l.shr.FrontendEndpoints[0], bytes.NewBufferString(outBase64)); err == nil {
			client := &http.Client{Timeout: l.opt.Timeout}
			if resp, err := client.Do(req); err == nil {
				if resp.StatusCode != 200 {
					dl.Errorf("#%d: unexpected status code: %v", l.id, resp.StatusCode)
					l.results.Errors++
				}
				inPayload := new(bytes.Buffer)
				io.Copy(inPayload, resp.Body)
				inBase64 := inPayload.String()
				if inBase64 != outBase64 {
					dl.Errorf("#%d: payload mismatch", l.id)
					l.results.Mismatches++

					snapshot.Complete().Failure(err)
				} else {
					l.results.Bytes += uint64(len(outBase64))
					dl.Debugf("#%d: payload match", l.id)

					snapshot.Complete().Success()
				}
			} else {
				dl.Errorf("#%d: error: %v", l.id, err)
				l.results.Errors++
			}
		} else {
			dl.Errorf("#%d: error creating request: %v", l.id, err)
			l.results.Errors++
		}

		snapshot.Send(l.opt.SnapshotQueue)

		pacingMs := l.opt.MaxPacing.Milliseconds()
		pacingDelta := l.opt.MaxPacing.Milliseconds() - l.opt.MinPacing.Milliseconds()
		if pacingDelta > 0 {
			pacingMs = (rand.Int63() % pacingDelta) + l.opt.MinPacing.Milliseconds()
		}
		time.Sleep(time.Duration(pacingMs) * time.Millisecond)

		l.results.Loops++
	}
}

func (l *PublicHttpLooper) shutdown() {
	if l.listener != nil {
		if err := l.listener.Close(); err != nil {
			dl.Errorf("#%d error closing listener: %v", l.id, err)
		}
	}

	if err := sdk.DeleteShare(l.root, l.shr); err != nil {
		dl.Errorf("#%d error deleting share '%v': %v", l.id, l.shr.Token, err)
	}
}

```

### Core Architecture Module: `cmd/zrok2/subordinate/worker.go`
```
package subordinate

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/signal"
	"sync"
	"syscall"
)

// WorkerContext registers both terminal signals and parent-pipe EOF before the caller constructs a backend.
// input must be a closeable pipe: cleanup closes the control reader and joins the watcher when the backend returns first.
func WorkerContext(parent context.Context, input io.ReadCloser) (context.Context, func(), error) {
	control, err := workerInput(input)
	if err != nil {
		return nil, nil, fmt.Errorf("unable to prepare worker control input: %w", err)
	}
	ctx, stop := signal.NotifyContext(parent, os.Interrupt, syscall.SIGTERM)
	done := make(chan struct{})
	go func() {
		defer close(done)
		_, _ = io.Copy(io.Discard, control)
		stop()
	}()
	var once sync.Once
	return ctx, func() { once.Do(func() { stop(); _ = control.Close(); <-done }) }, nil
}

```

### Core Architecture Module: `cmd/zrok2/subordinate/workerInput_posix.go`
```
//go:build !windows

package subordinate

import (
	"io"
	"os"
	"time"

	"golang.org/x/sys/unix"
)

// inherited stdin may be a blocking descriptor. a pollable duplicate lets Close interrupt its watcher.
func workerInput(input io.ReadCloser) (io.ReadCloser, error) {
	file, ok := input.(*os.File)
	if !ok || file.SetReadDeadline(time.Time{}) == nil {
		return input, nil
	}
	conn, err := file.SyscallConn()
	if err != nil {
		return nil, err
	}
	var fd int
	var duplicateErr error
	if err := conn.Control(func(handle uintptr) { fd, duplicateErr = unix.FcntlInt(handle, unix.F_DUPFD_CLOEXEC, 0) }); err != nil {
		return nil, err
	}
	if duplicateErr != nil {
		return nil, duplicateErr
	}
	if err := unix.SetNonblock(fd, true); err != nil {
		_ = unix.Close(fd)
		return nil, err
	}
	return os.NewFile(uintptr(fd), "worker control input"), nil
}

```

### Core Architecture Module: `cmd/zrok2/subordinate/workerInput_windows.go`
```
//go:build windows

package subordinate

import "io"

func workerInput(input io.ReadCloser) (io.ReadCloser, error) { return input, nil }

```

### Core Architecture Module: `cmd/zrok2/util.go`
```
package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/go-openapi/runtime"
	httptransport "github.com/go-openapi/runtime/client"
	"github.com/openziti/zrok/v2/agent/agentClient"
	"github.com/openziti/zrok/v2/environment"
	"github.com/openziti/zrok/v2/environment/env_core"
	"github.com/openziti/zrok/v2/internal/sharepublic"
	"github.com/openziti/zrok/v2/tui"
	"github.com/pkg/errors"
)

func mustGetAdminAuth() runtime.ClientAuthInfoWriter {
	adminToken := os.Getenv("ZROK2_ADMIN_TOKEN")
	if adminToken == "" {
		panic("please set ZROK2_ADMIN_TOKEN to a valid admin token for your zrok instance")
	}
	return httptransport.APIKeyAuth("X-TOKEN", "header", adminToken)
}

func mustGetEnvironmentAuth() (env_core.Root, runtime.ClientAuthInfoWriter) {
	env, err := environment.LoadRoot()
	if err != nil {
		panic(err)
	}
	if !env.IsEnabled() {
		panic("environment is not enabled; run 'zrok2 enable' first")
	}
	auth := httptransport.APIKeyAuth("X-TOKEN", "header", env.Environment().AccountToken)
	return env, auth
}

// getEnvironmentAuthOptional returns environment and auth from either local environment or provided account token (for
// non-enabled shells).
func getEnvironmentAuthOptional(accountToken string) (env_core.Root, runtime.ClientAuthInfoWriter, error) {
	env, err := environment.LoadRoot()

	if err == nil && env.IsEnabled() && accountToken != "" {
		return nil, nil, fmt.Errorf("cannot use --account-token when an enabled environment exists")
	}

	var token string
	if err == nil && env != nil && env.IsEnabled() {
		token = env.Environment().AccountToken
	} else if accountToken != "" {
		token = accountToken
	} else {
		return nil, nil, fmt.Errorf("no local environemnt found and no --acount-token provider; either enable an environ")
	}

	auth := httptransport.APIKeyAuth("X-TOKEN", "header", token)
	return env, auth, nil
}

func parseUrl(in string) (string, error) {
	return sharepublic.ParseURL(in)
}

// detectAndRouteToAgent handles the common pattern of checking if the agent is running
// and routing to either agent or local execution paths. This eliminates duplicate code
// found in sharePrivate, sharePublic, and accessPrivate commands.
func detectAndRouteToAgent(
	subordinate, forceLocal, forceAgent bool,
	root env_core.Root,
	localFn func(),
	agentFn func(),
) {
	// if running in subordinate mode or forced local, always use local
	if subordinate || forceLocal {
		localFn()
		return
	}

	// determine if agent is running
	agent := forceAgent
	if !forceAgent {
		var err error
		agent, err = agentClient.IsAgentRunning(root)
		if err != nil {
			tui.Error("error checking if agent is running", err)
		}
	}

	// route to appropriate handler
	if agent {
		agentFn()
	} else {
		localFn()
	}
}

// backendModeConfig holds the configuration for validating and processing backend modes
type backendModeConfig struct {
	expectsTarget bool
	parseTarget   func(string) (string, error)
	forceHeadless bool
}

// validateBackendMode validates the backend mode and processes the target argument.
// This eliminates the duplicate switch statements found across share commands.
// Returns the processed target string and whether headless mode should be forced.
// Set allowedModes to nil to allow all backend modes, or provide a list to restrict.
func validateBackendMode(mode string, args []string, allowedModes []string) (target string, forceHeadless bool, err error) {
	configs := map[string]backendModeConfig{
		"proxy": {
			expectsTarget: true,
			parseTarget:   parseUrl,
			forceHeadless: false,
		},
		"web": {
			expectsTarget: true,
			parseTarget:   func(s string) (string, error) { return s, nil },
			forceHeadless: false,
		},
		"tcpTunnel": {
			expectsTarget: true,
			parseTarget:   func(s string) (string, error) { return s, nil },
			forceHeadless: false,
		},
		"udpTunnel": {
			expectsTarget: true,
			parseTarget:   func(s string) (string, error) { return s, nil },
			forceHeadless: false,
		},
		"caddy": {
			expectsTarget: true,
			parseTarget:   func(s string) (string, error) { return s, nil },
			forceHeadless: true,
		},
		"drive": {
			expectsTarget: true,
			parseTarget:   func(s string) (string, error) { return s, nil },
			forceHeadless: false,
		},
		"socks": {
			expectsTarget: false,
			parseTarget:   nil,
			forceHeadless: false,
		},
	}

	// check if mode is allowed
	if allowedModes != nil {
		allowed := false
		for _, m := range allowedModes {
			if m == mode {
				allowed = true
				break
			}
		}
		if !allowed {
			return "", false, fmt.Errorf("invalid backend mode '%v'; expected {%s}", mode, strings.Join(allowedModes, ", "))
		}
	}

	config, ok := configs[mode]
	if !ok {
		// build list of valid modes - either from allowedModes or all available
		validModes := allowedModes
		if validModes == nil {
			validModes = make([]string, 0, len(configs))
			for k := range configs {
				validModes = append(validModes, k)
			}
		}
		return "", false, fmt.Errorf("invalid backend mode '%v'; expected {%s}", mode, strings.Join(validModes, ", "))
	}

	// handle special cases
	switch mode {
	case "socks":
		// socks doesn't expect arguments
		if len(args) != 0 {
			return "", false, errors.New("the 'socks' backend mode does not expect a <target>")
		}
		return "socks", config.forceHeadless, nil

	default:
		// standard modes that expect exactly one target
		if config.expectsTarget {
			if len(args) != 1 {
				return "", false, fmt.Errorf("the '%s' backend mode expects a <target>", mode)
			}

			target, err = config.parseTarget(args[0])
			if err != nil {
				if mode == "proxy" {
					return "", false, errors.Wrap(err, "invalid target endpoint URL")
				}
				return "", false, errors.Wrapf(err, "invalid target for backend mode '%s'", mode)
			}
			return target, config.forceHeadless, nil
		}
	}

	return "", false, fmt.Errorf("unexpected backend mode configuration for '%s'", mode)
}

func (cmd *agentStatusCommand) wrapString(s string, maxWidth int) string {
	if len(s) <= maxWidth {
		return s
	}

	var result []rune
	line := []rune{}
	words := [][]rune{}
	currentWord := []rune{}

	// split input into words
	for _, r := range s {
		if r == ' ' || r == '\t' || r == '\n' {
			if len(currentWord) > 0 {
				words = append(words, currentWord)
				currentWord = []rune{}
			}
			if r == '\n' {
				// preserve existing newlines
				words = append(words, []rune{r})
			}
		} else {
			currentWord = append(currentWord, r)
		}
	}
	if len(currentWord) > 0 {
		words = append(words, currentWord)
	}

	// wrap words into lines
	for _, word := range words {
		if len(word) == 1 && word[0] == '\n' {
			// handle preserved newlines
			result = append(result, line...)
			result = append(result, '\n')
			line = []rune{}
			continue
		}

		// check if adding this word would exceed the width
		spaceNeeded := 0
		if len(line) > 0 {
			spaceNeeded = 1 // for the space between words
		}

		if len(line)+spaceNeeded+len(word) > maxWidth {
			// word doesn't fit on current line
			if len(line) > 0 {
				// flush current line
				result = append(result, line...)
				result = append(result, '\n')
				line = []rune{}
			}

			// if word itself is longer than maxWidth, break it
			if len(word) > maxWidth {
				for i := 0; i < len(word); {
					end := i + maxWidth
					if end > len(word) {
						end = len(word)
					}
					if i > 0 {
						result = append(result, '\n')
					}
					result = append(result, word[i:end]...)
					i = end
				}
				if len(word) > 0 && len(word)%maxWidth != 0 {
					result = append(result, '\n')
				}
			} else {
				// word fits on new line
				line = append(line, word...)
			}
		} else {
			// word fits on current line
			if len(line) > 0 {
				line = append(line, ' ')
			}
			line = append(line, word...)
		}
	}

	// append any remaining line content
	if len(line) > 0 {
		result = append(result, line...)
	}

	return string(result)
}

```

### Core Architecture Module: `controller/util.go`
```
package controller

import (
	"fmt"
	"net"
	"net/http"
	"strings"
	"unicode"

	errors2 "github.com/go-openapi/errors"
	"github.com/jaevor/go-nanoid"
	"github.com/jmoiron/sqlx"
	"github.com/michaelquigley/df/dl"
	"github.com/openziti/zrok/v2/controller/config"
	"github.com/openziti/zrok/v2/controller/store"
	"github.com/openziti/zrok/v2/rest_model_zrok"
	"github.com/openziti/zrok/v2/util"
	"github.com/pkg/errors"
)

type zrokAuthenticator struct {
	cfg *config.Config
}

func newZrokAuthenticator(cfg *config.Config) *zrokAuthenticator {
	return &zrokAuthenticator{cfg}
}

func (za *zrokAuthenticator) authenticate(token string) (*rest_model_zrok.Principal, error) {
	trx, err := str.Begin()
	if err != nil {
		dl.Errorf("error starting transaction for '%v': %v", token, err)
		return nil, err
	}
	defer func() { _ = trx.Rollback() }()

	if a, err := str.FindAccountWithToken(token, trx); err == nil {
		principal := &rest_model_zrok.Principal{
			ID:        int64(a.Id),
			Token:     a.Token,
			Email:     a.Email,
			Limitless: a.Limitless,
		}
		return principal, nil
	} else {
		// check for admin secret
		if cfg.Admin != nil {
			for _, secret := range cfg.Admin.Secrets {
				if token == secret {
					principal := &rest_model_zrok.Principal{
						ID:    int64(-1),
						Admin: true,
					}
					return principal, nil
				}
			}
		}

		// no match
		dl.Warnf("invalid api key '%v'", token)
		return nil, errors2.New(401, "invalid api key")
	}
}

func createShareToken() (string, error) {
	gen, err := nanoid.CustomASCII("abcdefghijklmnopqrstuvwxyz0123456789", 12)
	if err != nil {
		return "", err
	}
	return gen(), nil
}

func CreateToken() (string, error) {
	gen, err := nanoid.CustomASCII("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 12)
	if err != nil {
		return "", err
	}
	return gen(), nil
}

func realRemoteAddress(req *http.Request) string {
	ip, _, err := net.SplitHostPort(req.RemoteAddr)
	if err != nil {
		ip = req.RemoteAddr
	}
	fwdAddress := req.Header.Get("X-Forwarded-For")
	if fwdAddress != "" {
		ip = fwdAddress

		ips := strings.Split(fwdAddress, ", ")
		if len(ips) > 1 {
			ip = ips[0]
		}
	}
	return ip
}

func validatePassword(cfg *config.Config, password string) error {
	if len(password) < 8 {
		return fmt.Errorf("password length: expected (8), got (%d)", len(password))
	}
	if !hasCapital(password) {
		return fmt.Errorf("password requires capital, found none")
	}
	if !hasNumeric(password) {
		return fmt.Errorf("password requires numeric, found none")
	}
	if !strings.ContainsAny(password, "!@#$%^&*()_+-=[]{};':\"\\|,.<>") {
		return fmt.Errorf("password requires special character, found none")
	}
	return nil
}

func hasCapital(check string) bool {
	for _, c := range check {
		if unicode.IsUpper(c) {
			return true
		}
	}
	return false
}

func hasNumeric(check string) bool {
	for _, c := range check {
		if unicode.IsDigit(c) {
			return true
		}
	}
	return false
}

// buildFrontendEndpointsForShare retrieves names for a share and builds frontend endpoints
// from those names. Falls back to the deprecated FrontendEndpoint field if no names are
// mapped (for backwards compatibility).
// buildFrontendEndpointsForShare returns the share's frontend endpoints from its names. a store error is
// returned rather than logged past: on postgresql it has aborted the caller's transaction.
func buildFrontendEndpointsForShare(shareId int, shareToken string, deprecatedEndpoint *string, trx *sqlx.Tx) ([]string, error) {
	// retrieve names for this share using the new mapping table
	shareNames, err := str.FindNamesForShare(shareId, trx)
	if err != nil {
		return nil, errors.Wrapf(err, "error finding names for share '%v'", shareToken)
	}

	// build frontend endpoints from the names
	var frontendEndpoints []string
	for _, sn := range shareNames {
		endpoint := util.NameInNamespace(sn.Name.Name, sn.NamespaceName)
		frontendEndpoints = append(frontendEndpoints, endpoint)
	}

	// fallback to deprecated field if no names are mapped (for backwards compatibility)
	if len(frontendEndpoints) == 0 && deprecatedEndpoint != nil {
		frontendEndpoints = []string{*deprecatedEndpoint}
	}

	return frontendEndpoints, nil
}

// isAccountLimited checks if an account has an active bandwidth limit restriction.
// returns true if the account is currently limited, false otherwise.
func isAccountLimited(accountId int, trx *sqlx.Tx) (bool, error) {
	// check if journal is empty first to avoid unnecessary queries
	jEmpty, err := str.IsBandwidthLimitJournalEmpty(accountId, trx)
	if err != nil {
		return false, err
	}

	// if journal is empty, account is not limited
	if jEmpty {
		return false, nil
	}

	// retrieve the latest journal entry
	je, err := str.FindLatestBandwidthLimitJournal(accountId, trx)
	if err != nil {
		return false, err
	}

	// account is limited if latest entry exists and action is "limit"
	return je != nil && je.Action == store.LimitLimitAction, nil
}

```

### Core Architecture Module: `endpoints/util.go`
```
package endpoints

import (
	"net/url"
	"strings"

	"github.com/michaelquigley/df/dl"
	"github.com/openziti/edge-api/rest_model"
	"github.com/openziti/sdk-golang/ziti"
)

func GetRefreshedService(svcName string, ctx ziti.Context) (*rest_model.ServiceDetail, bool) {
	svc, found := ctx.GetService(svcName)
	if !found {
		svc, err := ctx.RefreshService(svcName)
		if err != nil {
			dl.Errorf("error refreshing service '%v': %v", svcName, err)
			return nil, false
		}
		if svc == nil {
			dl.Errorf("service '%v' not found", svcName)
			return nil, false
		}
		return svc, true
	}
	return svc, found
}

func JoinURLPath(a, b *url.URL) (path, rawpath string) {
	if a.RawPath == "" && b.RawPath == "" {
		return singleJoiningSlash(a.Path, b.Path), ""
	}
	// Same as singleJoiningSlash, but uses EscapedPath to determine
	// whether a slash should be added
	apath := a.EscapedPath()
	bpath := b.EscapedPath()

	aslash := strings.HasSuffix(apath, "/")
	bslash := strings.HasPrefix(bpath, "/")

	switch {
	case aslash && bslash:
		return a.Path + b.Path[1:], apath + bpath[1:]
	case !aslash && !bslash:
		return a.Path + "/" + b.Path, apath + "/" + bpath
	}
	return a.Path + b.Path, apath + bpath
}

func singleJoiningSlash(a, b string) string {
	aslash := strings.HasSuffix(a, "/")
	bslash := strings.HasPrefix(b, "/")
	switch {
	case aslash && bslash:
		return a + b[1:]
	case !aslash && !bslash:
		return a + "/" + b
	}
	return a + b
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1286** (2026-10-30): **fixes-209**
  *Symptoms*: FIX: Web shares no longer panic while starting Caddy when built with Go 1.27 or the JSON v2 experiment. The embedded Caddy dependency is updated from 2.9.1 to 2.11.7 to recognize the JSON type used by these builds, allowing both terminal and headless web shares to start. This update also requires newer shared dependencies, including Go OpenAPI, gRPC and OpenTelemetry.  CHANGE: Official builds now use Go 1.27.3, with CI and source-build Docker images using the same compiler version. Building from source still requires Go 1.26 or newer.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #ejFTSV6u7oOE568v3jIjDz+TzbGZXVmtuGMDw1eDwfw=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ6cm9rIiwicHJvamVjdElkIjoicHJqX000ODk4ZTc2OXRxY2l3MVRUUmVQc21nallRcVYiLCJ2MCI6ZmFsc2UsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ6cm9rLWdpdC1maXhlcy0yMDktb3BlbnppdGkudmVyY2VsLmFwcCJ9LCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vb3BlbnppdGkvenJvay8ySkhha3FaY1RjTmt4SndUQlhhUXpXYVJUTWlTIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwicm9vdERpcmVjdG9yeSI6IndlYnNpdGUiLCJwcmV2aWV3VXJsIjoienJvay1naXQtZml4ZXMtMjA5LW9wZW56aXRpLnZlcmNlbC5hcHAifV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPW9wZW56aXRpJnJlcG89enJvayZwcj0xMjg2In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/openziti/zrok"><sup><img src="h

- **Issue #1284** (2026-10-08): **fall-fixes-208**
  *Symptoms*: CHANGE: **Share and access commands exit with status 2, not 1, when the controller refuses the request.** `zrok2 share public`, `zrok2 share private` and `zrok2 access private` exit 2 for a refusal a retry cannot change (such as a name held by another share, now named in the message) and 1 for a failure a retry may fix (the controller unreachable, busy or failing; a busy controller says how many seconds to wait). Scripts that test for status 1 must also accept 2; a supervisor can stop restarting on 2, for example with systemd's `RestartPreventExitStatus=2`.  CHANGE: **Admin repair commands no longer migrate the store.** `zrok2 admin gc`, `zrok2 admin repair-dial-policies` and `zrok2 admin repair-store` open the store without migrating it, so a dry run never changes the database; run `zrok2 admin migrate` or start the controller first when the schema is behind the binary.  FEATURE: `zrok2 admin repair-store <configPath>` releases what earlier versions left behind: names and frontend mappings still attached to deleted shares, stranded environments, shares, accesses and names. It is a dry run by default that counts and samples what it would repair, and repairs in small batches with `--apply`.  FEATURE: Admin `GET /name/{namespaceToken}/{name}` returns one name with its owner and current share token, for reconciling names without listing them all.  FIX: A name whose share no longer exists is released automatically the next time it is used, instead of answering "already in use by 

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

### Incident Patch 1: `c2a1b06a` (2026-10-30)
**Commit Message**: add isolated macos agent smoke workflow; verify named share shutdown and replay; bounded cleanup and offline regression coverage

**File**: `.github/workflows/macos-agent-smoke.yml` (added, +158/-0)
```diff
@@ -0,0 +1,158 @@
+name: macOS agent smoke
+
+# manually dispatched only; nothing else depends on this workflow. see docs/current/macos-agent-smoke.md for the
+# environment, account and recovery procedure.
+on:  # yamllint disable-line rule:truthy
+  workflow_dispatch:
+
+permissions:
+  contents: read
+
+# one run at a time against the dedicated account; a queued run waits instead of cancelling a live one
+concurrency:
+  group: macos-agent-smoke-zrok2-ci-account
+  cancel-in-progress: false
+
+jobs:
+  smoke:
+    name: Named public share restart (macOS arm64)
+    runs-on: macos-15
+    timeout-minutes: 45
+    environment: zrok-agent-smoke
+    steps:
+      - uses: actions/checkout@v4
+        with:
+          fetch-depth: 0
+          persist-credentials: false
+
+      - name: fresh runner preflight
+        shell: bash
+        run: |
+          set -euo pipefail
+          if [ -e "$HOME/.zrok2" ]; then
+            echo "::error::'$HOME/.zrok2' already exists; the smoke runs only on a fresh runner"
+            exit 1
+          fi
+          smoke_dir="$RUNNER_TEMP/agent-smoke"
+          mkdir -p "$smoke_dir/bin"
+          echo "SMOKE_DIR=$smoke_dir" >> "$GITHUB_ENV"
+          version="$(git describe --tags --match 'v2.*' --abbrev=0)"
+          hash="$(git rev-parse HEAD)"
+          echo "SMOKE_VERSION=$version" >> "$GITHUB_ENV"
+          echo "SMOKE_HASH=$hash" >> "$GITHUB_ENV"
+
+      - name: report dispatch
+        shell: bash
+        run: |
+          {
+            echo "### macOS agent smoke"
+            echo ""
+            echo "- ref: \`$GITHUB_REF\`"
+            echo "- commit: \`$SMOKE_HASH\`"
+            echo "- build version: \`$SMOKE_VERSION\`"
+            echo "- runner: \`$RUNNER_OS/$RUNNER_ARCH\` ($(sw_vers -productVersion), $(uname -m))"
+          } >> "$GITHUB_STEP_SUMMARY"
+
+      - uses: actions/setup-go@v5
+        with:
+          go-version-file: .go-version
+
+      - uses: actions/setup-node@v4
+        with:
+          node-version: 22.x
+
+      - name: install ui node modules
+        shell: bash
+        run: npm ci
+        working-directory: ui
+
+      - name: build ui
+        shell: bash
+        run: npm run build
+        working-directory: ui
+        env:
+          CI: "true"
+
+      - name: install agent ui node modules
+        shell: bash
+        run: npm ci
+        working-directory: agent/agentUi
+
+      - name: build agent ui
+        shell: bash
+        run: npm run build
+        working-directory: agent/agentUi
+        env:
+          CI: "true"
+
+      - name: build zrok2 and harness
+        shell: bash
+        run: |
+          set -euo pipefail
+          ldflags="-X github.com/openziti/zrok/v2/build.Version=$SMOKE_VERSION -X github.com/openziti/zrok/v2/build.Hash=$SMOKE_HASH"
+          go build -ldflags "$ldflags" -o "$SMOKE_DIR/bin/zrok2" ./cmd/zrok2
+          go build -tags agent_smoke -ldflags "$ldflags" -o "$SMOKE_DIR/bin/agent-smoke" ./tests/agent-smoke
+          "$SMOKE_DIR/bin/zrok2" version
+
+      - name: native process and worker fixtures
+        shell: bash
+        run: go test ./agent/proctree ./cmd/zrok2/subordinate -count=1 -timeout=2m
+
+      - name: agent lifecycle tests
+        shell: bash
+        run: go test -race ./agent -count=1 -timeout=10m
+
+      - name: offline harness tests
+        shell: bash
+        run: go test -tags agent_smoke ./tests/agent-smoke -count=1 -timeout=5m
+
+      - name: live scenario
+        shell: bash
+        timeout-minutes: 20
+        env:
+          ZROK2_CI_ACCOUNT_TOKEN: ${{ secrets.ZROK2_CI_ACCOUNT_TOKEN }}
+          SMOKE_API_ENDPOINT: ${{ vars.ZROK2_SMOKE_API_ENDPOINT || 'https://api-v2.zrok.io' }}
+          SMOKE_NAMESPACE: ${{ vars.ZROK2_SMOKE_NAMESPACE || 'public' }}
+        run: |
+          set -euo pipefail
+          if [ -z "${ZROK2_CI_ACCOUNT_TOKEN:-}" ]; then
+            echo "::error::secret 'ZROK2_CI_ACCOUNT_TOKEN' is not set in the 'zrok-agent-smoke' environment; the live scenario cannot run"
+            exit 1
+          fi
+          "$SMOKE_DIR/bin/agent-smoke" run \
+            --binary "$SMOKE_DIR/bin/zrok2" \
+            --state-dir "$SMOKE_DIR/state" \
+            --api-endpoint "$SMOKE_API_ENDPOINT" \
+            --namespace "$SMOKE_NAMESPACE"
+
+      - name: fallback cleanup
+        if: always()
+        shell: bash
+        timeout-minutes: 5
+        env:
+          ZROK2_CI_ACCOUNT_TOKEN: ${{ secrets.ZROK2_CI_ACCOUNT_TOKEN }}
+        run: |
+          set -euo pipefail
+          if [ -z "${SMOKE_DIR:-}" ] || [ ! -x "$SMOKE_DIR/bin/agent-smoke" ]; then
+            echo "the harness was not built; no live resources were created"
+            exit 0
+          fi
+          "$SMOKE_DIR/bin/agent-smoke" cleanup --state-dir "$SMOKE_DIR/state"
+
+      - name: publish summary
+        if: always()
+        shell: bash
+        run: |
+          shopt -s nullglob
+          for summary in "${SMOKE_DIR:-/nonexistent}"/st
```

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -16,6 +16,8 @@ FIX: Web shares no longer panic while starting Caddy when built with Go 1.27 or
 
 CHANGE: Official builds now use Go 1.27.3, with CI and source-build Docker images using the same compiler version. Building from source still requires Go 1.26 or newer.
 
+CHANGE: A manually dispatched `macOS agent smoke` workflow builds `zrok2` from the selected branch on a GitHub-hosted macOS runner. It takes an agent-managed named public share through Ctrl-C and a restart against a dedicated zrok test account, checking that the agent exits cleanly, the old share is gone, the reserved name survives and the replayed share has a new token. It runs only when dispatched, needs only the `ZROK2_CI_ACCOUNT_TOKEN` secret in the `zrok-agent-smoke` environment, and leaves existing builds and tests unchanged; see `docs/current/macos-agent-smoke.md`.
+
 ## v2.0.8
 
 CHANGE: **Share and access commands exit with status 2, not 1, when the controller refuses the request.** `zrok2 share public`, `zrok2 share private` and `zrok2 access private` exit 2 for a refusal a retry cannot change (such as a name held by another share, now named in the message) and 1 for a failure a retry may fix (the controller unreachable, busy or failing; a busy controller says how many seconds to wait). Scripts that test for status 1 must also accept 2; a supervisor can stop restarting on 2, for example with systemd's `RestartPreventExitStatus=2`.
```

**File**: `docs/current/macos-agent-smoke.md` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+# macOS agent smoke
+
+The `macOS agent smoke` workflow (`.github/workflows/macos-agent-smoke.yml`) runs the agent's named public share through an interrupt and a restart on a native GitHub-hosted macOS runner, against a live zrok v2 service with a dedicated test account. It builds `zrok2` from the dispatched commit and drives it as a user would. It supplies the native evidence that [Agent share lifecycle](agent-share-lifecycle.md) records as outstanding for macOS. It is the only CI job that uses a live service account. It runs only when an operator dispatches it, and no other workflow, required check, release or `Makefile` target depends on it.
+
+## What a run proves
+
+The live scenario passes only when every observation holds and final cleanup succeeds:
+
+1. A fresh environment is enabled with the built CLI's headless enable path, and a new unique name is reserved.
+2. `zrok2 agent start` runs in its own process group and reports the exact build identity the job stamped.
+3. `zrok2 share public --force-agent --open -n <namespace>:<name>` against a loopback server produces exactly one active share in structured agent status, the name is bound to its token, and the public endpoint returns the server's per-run random body.
+4. SIGINT to the agent's process group, as a terminal Ctrl-C delivers it, ends the agent with exit 0 within 130 seconds. A forced kill is a failure.
+5. A successful authenticated account overview still lists the environment, no longer mentions the share token anywhere, and the name listing shows the name reserved and unbound.
+6. Restarting the agent with the same environment replays the saved request without another share command: exactly one active share, a new token, the old token still absent, the name bound to the replacement and the random body served through it.
+7. A second interrupt repeats the exit, absence and name checks. Cleanup then removes the name and the environment and proves their absence.
+
+Before the live scenario the job runs the native process and worker fixtures (`./agent/proctree`, `./cmd/zrok2/subordinate`), the agent package's lifecycle tests under the race detector, and the harness's offline tests.
+
+A successful build, passing native fixtures or a run rescued by fallback cleanup does not close the macOS gap; only a run whose scenario steps and run-mode cleanup all pass does. Windows validation and the Linux live check are outside this workflow and remain outstanding.
+
+## Setup
+
+The operator does these once, in repository settings. No step needs an admin token.
+
+- A dedicated v2 account on the target service, used for nothing else, permitted to enable an environment and reserve a name in the target namespace. The job never provisions or modifies the account itself.
+- A GitHub environment named `zrok-agent-smoke`, with deployment branches restricted to trusted branches, holding the secret `ZROK2_CI_ACCOUNT_TOKEN` (the dedicated account's token). An environment secret reaches only jobs that reference that environment, and within the job only the live scenario and fallback cleanup steps receive it.
+- Optionally, environment variables `ZROK2_SMOKE_API_ENDPOINT` and `ZROK2_SMOKE_NAMESPACE` to target a dedicated service. The defaults are `https://api-v2.zrok.io` and `public`.
+
+A missing secret fails the live step with an error naming it; the job is never green without the live scenario.
+
+## Dispatch
+
+GitHub offers manual dispatch only for workflows present on the default branch, so the workflow file must reach `main` before any run. After that, an authorized operator selects the branch to test: Actions, `macOS agent smoke`, Run workflow, or `gh workflow run macos-agent-smoke.yml --ref <branch>`. The branch must be one the `zrok-agent-smoke` environment admits. The workflow takes no inputs: the checkout is the dispatched ref, and the endpoint and namespace come only from the environment's variables.
+
+Runs share one concurrency group and never cancel each other; a second dispatch waits for the first. The job is bounded at 45 minutes, the live step at 20 and fallback cleanup at 5.
+
+The build version is the latest `v2.*` tag reachable from the checkout, and `build.Hash` is the full commit hash. Both are written to the job summary. The CLI and the harness are built with identical stamps, so the controller's version check applies to both. A version refusal fails the run as a failed prerequisite and keeps the controller's message.
+
+## The harness
+
+`tests/agent-smoke` is a Go command whose sources all carry the `agent_smoke` build tag, plus `unix`. Ordinary `go build ./...`, `go test ./...`, `go vet ./...`, `go install ./...` and `make test` never select it. Build it with `go build -tags agent_smoke ./tests/agent-smoke`.
+
+```
+agent-smoke run --binary <zrok2> --state-dir <dir> [--api-endpoint <url>] [--namespace <token>]
+agent-smoke cleanup --state-dir <dir>
+```
+
+Both modes read the account token from `ZROK2_CI_ACCOUNT_TOKE
```

**File**: `docs/journal/2026-10-29.md` (modified, +4/-0)
```diff
@@ -6,3 +6,7 @@
 - Canon audit before retiring the ownership spec/work order: no project-local quality covers agent resource ownership, joined shutdown, deadline propagation or cleanup-before-recreation; the environment client files also have no local territory coverage. These remain canon follow-ups, not changes to the implemented contract.
 - Stage 5 Terminus round 1 (`e224f2533a39`): the operator vetoed `permanent-429-exit`. HTTP 429 means temporary rate limiting that can clear without changing the request, so it retains transient exit 1; other controller 4xx refusals retain permanent exit 2. Retry/backoff behavior is unchanged. The approved 429 exception is corrected separately in the uncommitted `terminus-canon` working tree, including the statement, flag/skip guidance and examples.
 - This checkout excludes `/docs/future` through `.git/info/exclude`; the retired ownership planning documents were never tracked. The local replacement follow-up note remains ignored. Validation limits and deliberate recovery/migration boundaries also live in tracked `docs/current/agent-share-lifecycle.md` so they survive handoff.
+
+- macOS agent smoke stage 1 and 2 (`tests/agent-smoke`, `.github/workflows/macos-agent-smoke.yml`): no hosted run yet, so the macOS gap in `docs/current/agent-share-lifecycle.md` stays open and that file was deliberately left unchanged. Update it only from a passing dispatched run. The workflow cannot be dispatched until it is on `main`. `actionlint` was unavailable here (installing it from outside was refused), so the workflow is parse-checked only.
+- Harness cleanup calls the generated REST endpoints (unshare, delete name, disable) directly instead of the CLI's `disable`/`delete name`, because it must work from the manifest when the local environment is partial or missing. The harness's REST client is stamped with the same `build.Version`/`build.Hash` as the CLI and uses `build.String()` both for its own version check and as the expected agent identity, so the two binaries must be built with identical ldflags.
+- Name ownership in cleanup rests on the pre-reservation listing check: a name absent right before `create name` and later listed is this run's, and a name already listed is marked `name_foreign` in the manifest and never touched. Keep that check before the reservation if the step is reordered.
```

**File**: `docs/journal/2026-10-30.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+# 2026-10-30
+
+- macOS agent smoke Terminus round 4 (`41801b329526`): the operator vetoed `quoted-success-details`. The step and cleanup success lines in `tests/agent-smoke/report.go` keep their unquoted detail suffix, because the detail is a phrase that already quotes its own values and the live job log is the only trail when a run dies before the report uploads. Do not reopen this advisory.
+- Terminus round 5 (`3031c022a81d`): the operator vetoed `macos-runner-architecture`. `runs-on: macos-15` in `.github/workflows/macos-agent-smoke.yml` is GitHub's arm64 label (Intel is `macos-15-intel` or `macos-15-large`), and there is no hosted `macos-15-arm64` label, so the "(macOS arm64)" job name is accurate. Do not reopen this advisory.
```

**File**: `tests/agent-smoke/cleanup.go` (added, +244/-0)
```diff
@@ -0,0 +1,244 @@
+//go:build agent_smoke && unix
+
+package main
+
+import (
+	"context"
+	"errors"
+	"fmt"
+	"os"
+	"strings"
+	"syscall"
+	"time"
+
+	"github.com/michaelquigley/df/dl"
+)
+
+func cleanupMode(ctx context.Context, cfg config) int {
+	rep := newReport(cfg.stateDir, "cleanup", cfg.accountToken)
+	st, err := loadRunState(cfg.stateDir)
+	if errors.Is(err, os.ErrNotExist) {
+		rep.cleanup("no manifest; the run recorded no resources", nil, 0)
+		return finish(rep, manifest{})
+	}
+	if err != nil {
+		rep.cleanup("", err, 0)
+		return finish(rep, manifest{})
+	}
+	h := &harness{cfg: cfg, st: st, rep: rep}
+	h.runCleanup(ctx)
+	return finish(rep, st.snapshot())
+}
+
+// runCleanup gives cleanup its own allowance, independent of whatever ended the scenario.
+func (h *harness) runCleanup(parent context.Context) {
+	ctx, cancel := context.WithTimeout(parent, h.cfg.cleanupBound)
+	defer cancel()
+	started := time.Now()
+	detail, err := h.cleanup(ctx)
+	h.rep.cleanup(detail, err, time.Since(started))
+}
+
+// cleanup stops this run's processes and removes exactly the resources the manifest records, then proves their
+// absence with successful authenticated reads. it is safe to repeat. intermediate write failures are notes; the
+// verification decides. an unresolved process fails cleanup without stopping the controller cleanup.
+func (h *harness) cleanup(ctx context.Context) (_ string, err error) {
+	var notes []string
+	note := func(format string, args ...any) {
+		text := fmt.Sprintf(format, args...)
+		dl.Infof("cleanup: %v", text)
+		notes = append(notes, text)
+	}
+	detail := func() string { return strings.Join(notes, "; ") }
+
+	if h.target != nil {
+		h.target.close()
+	}
+	if h.agentConn != nil {
+		_ = h.agentConn.Close()
+	}
+	processErr := h.stopProcesses(ctx, note)
+	defer func() { err = errors.Join(processErr, err) }()
+
+	m := h.st.snapshot()
+	if !m.EnvAttempted && !m.NameAttempted && len(m.ShareTokens) == 0 {
+		note("no controller resources recorded")
+		return detail(), nil
+	}
+	if h.cfg.accountToken == "" {
+		return detail(), fmt.Errorf("'%v' is not set; recorded resources remain: %v", accountTokenEnv, recordedResources(m))
+	}
+	if h.ctrl == nil {
+		ctrl, err := newControllerClient(ctx, m.APIEndpoint, h.cfg.accountToken, h.cfg.requestBound)
+		if err != nil {
+			return detail(), fmt.Errorf("%w; recorded resources remain: %v", err, recordedResources(m))
+		}
+		h.ctrl = ctrl
+	}
+	view, err := h.readView(ctx)
+	if err != nil {
+		return detail(), fmt.Errorf("%w; recorded resources remain: %v", err, recordedResources(m))
+	}
+
+	// resolve the environment: the recorded identity, or for a lost enable response the unique description
+	var problems []error
+	zID := m.EnvZID
+	if zID == "" && m.EnvAttempted {
+		described := view.environmentsDescribed(m.Description)
+		switch len(described) {
+		case 0:
+		case 1:
+			zID = described[0]
+			if err := h.st.update(func(m *manifest) { m.EnvZID = zID }); err != nil {
+				return detail(), err
+			}
+			note("reconciled environment '%v' by description", zID)
+		default:
+			problems = append(problems, fmt.Errorf("environments '%v' all carry description '%v'; none removed", strings.Join(described, ", "), m.Description))
+		}
+	}
+	owned := false
+	if zID != "" {
+		if env := view.environment(zID); env != nil {
+			if env.Environment.Description != m.Description {
+				problems = append(problems, fmt.Errorf("environment '%v' has description '%v', not this run's '%v'; not removed", zID, env.Environment.Description, m.Description))
+			} else {
+				owned = true
+				for _, shr := range env.Shares {
+					if shr == nil || shr.ShareToken == "" {
+						continue
+					}
+					if err := h.st.addShareToken(shr.ShareToken); err != nil {
+						return detail(), err
+					}
+					if err := h.ctrl.unshare(ctx, zID, shr.ShareToken); err != nil {
+						note("%v", err)
+					} else {
+						note("unshared '%v'", shr.ShareToken)
+					}
+				}
+			}
+		}
+	}
+
+	// the name was absent before this run reserved it, so a listing of the exact name is this run's
+	nameOwned := m.NameAttempted && !m.NameForeign
+	retryName := false
+	if nameOwned && len(view.matchingNames(m.Namespace, m.Name)) > 0 {
+		if err := h.ctrl.deleteName(ctx, m.Namespace, m.Name); err != nil {
+			note("%v; retrying after disable", err)
+			retryName = true
+		} else {
+			note("deleted name '%v:%v'", m.Namespace, m.Name)
+		}
+	}
+	if owned {
+		if err := h.ctrl.disable(ctx, zID); err != nil {
+			note("%v", err)
+		} else {
+			note("disabled environment '%v'", zID)
+		}
+	}
+	if retryName {
+		if err := h.ctrl.deleteName(ctx, m.Namespace, m.Name); err != nil {
+			note("%v", err)
+		} else {
+			note("deleted name '%v:%v'", m.Namespace, m.Name)
+		}
+	}
+
+	// verify with a fresh successful read
+	m = h.st.snapshot()
+	after, err := h.readView(ctx)
+	if err != nil {
+		return detail(), errors.Join(append(problems, fmt.Errorf("%w; absence unverified for: %v", err, recordedResources(
```

**File**: `tests/agent-smoke/config.go` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+//go:build agent_smoke && unix
+
+package main
+
+import (
+	"time"
+)
+
+const (
+	accountTokenEnv  = "ZROK2_CI_ACCOUNT_TOKEN"
+	defaultEndpoint  = "https://api-v2.zrok.io"
+	defaultNamespace = "public"
+)
+
+// config carries the explicit inputs and every bound the harness enforces. tests shorten the bounds; the
+// defaults are the work order's.
+type config struct {
+	binary       string
+	stateDir     string
+	apiEndpoint  string
+	namespace    string
+	accountToken string
+	runID        string
+	runAttempt   string
+
+	scenarioBound time.Duration
+	startupBound  time.Duration
+	stopBound     time.Duration
+	requestBound  time.Duration
+	commandBound  time.Duration
+	publicBound   time.Duration
+	cleanupBound  time.Duration
+	killBound     time.Duration
+	pollInterval  time.Duration
+}
+
+func defaultConfig() config {
+	return config{
+		apiEndpoint:   defaultEndpoint,
+		namespace:     defaultNamespace,
+		runID:         "local",
+		runAttempt:    "0",
+		scenarioBound: 15 * time.Minute,
+		startupBound:  7 * time.Minute,
+		stopBound:     130 * time.Second,
+		requestBound:  30 * time.Second,
+		commandBound:  90 * time.Second,
+		publicBound:   120 * time.Second,
+		cleanupBound:  3 * time.Minute,
+		killBound:     10 * time.Second,
+		pollInterval:  2 * time.Second,
+	}
+}
```

**File**: `tests/agent-smoke/controller.go` (added, +199/-0)
```diff
@@ -0,0 +1,199 @@
+//go:build agent_smoke && unix
+
+package main
+
+import (
+	"context"
+	"errors"
+	"fmt"
+	"net/url"
+	"time"
+
+	"github.com/go-openapi/runtime"
+	httptransport "github.com/go-openapi/runtime/client"
+	"github.com/go-openapi/strfmt"
+	"github.com/openziti/zrok/v2/build"
+	"github.com/openziti/zrok/v2/rest_client_zrok"
+	"github.com/openziti/zrok/v2/rest_client_zrok/environment"
+	"github.com/openziti/zrok/v2/rest_client_zrok/metadata"
+	"github.com/openziti/zrok/v2/rest_client_zrok/share"
+	"github.com/openziti/zrok/v2/rest_model_zrok"
+)
+
+// controllerClient makes bounded, authenticated calls with the account token through the generated client. it
+// is built from the endpoint alone, so cleanup does not depend on the local environment.
+type controllerClient struct {
+	zrok  *rest_client_zrok.Zrok
+	auth  runtime.ClientAuthInfoWriter
+	bound time.Duration
+}
+
+func newControllerClient(ctx context.Context, endpoint, accountToken string, bound time.Duration) (*controllerClient, error) {
+	apiURL, err := url.Parse(endpoint)
+	if err != nil {
+		return nil, fmt.Errorf("unable to parse api endpoint '%v': %w", endpoint, err)
+	}
+	if apiURL.Scheme == "" || apiURL.Host == "" {
+		return nil, fmt.Errorf("api endpoint '%v' needs a scheme and host", endpoint)
+	}
+	transport := httptransport.New(apiURL.Host, "/api/v2", []string{apiURL.Scheme})
+	transport.Producers["application/zrok.v1+json"] = runtime.JSONProducer()
+	transport.Consumers["application/zrok.v1+json"] = runtime.JSONConsumer()
+	c := &controllerClient{
+		zrok:  rest_client_zrok.New(transport, strfmt.Default),
+		auth:  httptransport.APIKeyAuth("X-TOKEN", "header", accountToken),
+		bound: bound,
+	}
+	reqCtx, cancel := context.WithTimeout(ctx, bound)
+	defer cancel()
+	params := metadata.NewClientVersionCheckParamsWithContext(reqCtx)
+	params.Body.ClientVersion = build.String()
+	if _, err := c.zrok.Metadata.ClientVersionCheck(params); err != nil {
+		return nil, fmt.Errorf("controller refused client version '%v': %w", build.String(), err)
+	}
+	return c, nil
+}
+
+func (c *controllerClient) overview(ctx context.Context) (*rest_model_zrok.Overview, error) {
+	reqCtx, cancel := context.WithTimeout(ctx, c.bound)
+	defer cancel()
+	resp, err := c.zrok.Metadata.Overview(metadata.NewOverviewParamsWithContext(reqCtx), c.auth)
+	if err != nil {
+		return nil, fmt.Errorf("account overview failed: %w", err)
+	}
+	if resp == nil || resp.Payload == nil {
+		return nil, errors.New("account overview returned no payload")
+	}
+	return resp.Payload, nil
+}
+
+func (c *controllerClient) names(ctx context.Context) ([]*rest_model_zrok.Name, error) {
+	reqCtx, cancel := context.WithTimeout(ctx, c.bound)
+	defer cancel()
+	resp, err := c.zrok.Share.ListAllNames(share.NewListAllNamesParamsWithContext(reqCtx), c.auth)
+	if err != nil {
+		return nil, fmt.Errorf("account name listing failed: %w", err)
+	}
+	if resp == nil {
+		return nil, errors.New("account name listing returned no response")
+	}
+	return resp.Payload, nil
+}
+
+func (c *controllerClient) unshare(ctx context.Context, envZID, token string) error {
+	reqCtx, cancel := context.WithTimeout(ctx, c.bound)
+	defer cancel()
+	params := share.NewUnshareParamsWithContext(reqCtx)
+	params.Body.EnvZID = envZID
+	params.Body.ShareToken = token
+	if _, err := c.zrok.Share.Unshare(params, c.auth); err != nil {
+		return fmt.Errorf("unshare of '%v' failed: %w", token, err)
+	}
+	return nil
+}
+
+func (c *controllerClient) deleteName(ctx context.Context, namespace, name string) error {
+	reqCtx, cancel := context.WithTimeout(ctx, c.bound)
+	defer cancel()
+	params := share.NewDeleteShareNameParamsWithContext(reqCtx)
+	params.Body.NamespaceToken = namespace
+	params.Body.Name = name
+	if _, err := c.zrok.Share.DeleteShareName(params, c.auth); err != nil {
+		return fmt.Errorf("deletion of name '%v:%v' failed: %w", namespace, name, err)
+	}
+	return nil
+}
+
+func (c *controllerClient) disable(ctx context.Context, envZID string) error {
+	reqCtx, cancel := context.WithTimeout(ctx, c.bound)
+	defer cancel()
+	params := environment.NewDisableParamsWithContext(reqCtx)
+	params.Body.Identity = envZID
+	if _, err := c.zrok.Environment.Disable(params, c.auth); err != nil {
+		return fmt.Errorf("disable of environment '%v' failed: %w", envZID, err)
+	}
+	return nil
+}
+
+// accountView is one successful pair of reads: the overview and the account's name listing.
+type accountView struct {
+	overview *rest_model_zrok.Overview
+	names    []*rest_model_zrok.Name
+}
+
+func (c *controllerClient) view(ctx context.Context) (*accountView, error) {
+	ov, err := c.overview(ctx)
+	if err != nil {
+		return nil, err
+	}
+	names, err := c.names(ctx)
+	if err != nil {
+		return nil, err
+	}
+	return &accountView{overview: ov, names: names}, nil
+}
+
+func (v *accountView) environment(zID string) *rest_model_zrok.EnvironmentAndResources {
+	for _, resources := range v.overview.Environments {
+		if resources != nil && res
```

---

### Incident Patch 2: `1d4d30a6` (2026-10-30)
**Commit Message**: agent-smoke: macos + linux + windows; agent registry compatibility

**File**: `.github/workflows/agent-smoke.yml` (modified, +39/-11)
```diff
@@ -34,9 +34,15 @@ jobs:
           - runner: macos-15
             platform: macOS arm64
             slug: macos-arm64
+            exe: ""
           - runner: ubuntu-24.04
             platform: Linux amd64
             slug: linux-amd64
+            exe: ""
+          - runner: windows-2025
+            platform: Windows amd64
+            slug: windows-amd64
+            exe: .exe
     steps:
       - uses: actions/checkout@v4
         with:
@@ -47,18 +53,39 @@ jobs:
         shell: bash
         run: |
           set -euo pipefail
-          if [ -e "$HOME/.zrok2" ]; then
-            echo "::error::'$HOME/.zrok2' already exists; the smoke runs only on a fresh runner"
+          home="$HOME"
+          temp="$RUNNER_TEMP"
+          if [ "$RUNNER_OS" = "Windows" ]; then
+            # zrok2 finds its home through USERPROFILE on windows; mixed-style paths suit both bash and native tools
+            home="$(cygpath -u "$USERPROFILE")"
+            temp="$(cygpath -m "$RUNNER_TEMP")"
+          fi
+          if [ -e "$home/.zrok2" ]; then
+            echo "::error::'$home/.zrok2' already exists; the smoke runs only on a fresh runner"
             exit 1
           fi
-          smoke_dir="$RUNNER_TEMP/agent-smoke"
+          smoke_dir="$temp/agent-smoke"
           mkdir -p "$smoke_dir/bin"
           echo "SMOKE_DIR=$smoke_dir" >> "$GITHUB_ENV"
           version="$(git describe --tags --match 'v2.*' --abbrev=0)"
           hash="$(git rev-parse HEAD)"
           echo "SMOKE_VERSION=$version" >> "$GITHUB_ENV"
           echo "SMOKE_HASH=$hash" >> "$GITHUB_ENV"
 
+      # cgo and the race detector need a native c compiler; windows runners do not configure one, and the
+      # linux cross-build's mingw path does not apply here. its bin directory stays on PATH for runtime dlls.
+      - name: configure windows c compiler
+        if: runner.os == 'Windows'
+        shell: pwsh
+        run: |
+          $ErrorActionPreference = 'Stop'
+          $msys = 'C:\msys64'
+          if (-not (Test-Path "$msys\usr\bin\bash.exe")) { throw "MSYS2 was not found at '$msys'" }
+          & "$msys\usr\bin\bash.exe" -lc 'pacman -Sy --noconfirm --needed mingw-w64-ucrt-x86_64-gcc'
+          if ($LASTEXITCODE -ne 0) { throw "unable to install the UCRT64 gcc toolchain" }
+          Add-Content -Path $env:GITHUB_PATH -Value "$msys\ucrt64\bin"
+          Add-Content -Path $env:GITHUB_ENV -Value "CC=gcc"
+
       - uses: actions/setup-go@v5
         with:
           go-version-file: .go-version
@@ -74,6 +101,7 @@ jobs:
           case "$RUNNER_OS" in
             macOS) os_release="macOS $(sw_vers -productVersion)" ;;
             Linux) os_release="$(. /etc/os-release && echo "$PRETTY_NAME")" ;;
+            Windows) os_release="$(pwsh -NoProfile -Command '[System.Environment]::OSVersion.VersionString')" ;;
             *) os_release="$RUNNER_OS" ;;
           esac
           {
@@ -84,7 +112,7 @@ jobs:
             echo "- build version: \`$SMOKE_VERSION\`"
             echo "- runner: \`$RUNNER_OS/$RUNNER_ARCH\` ($os_release, $(uname -m))"
             echo "- go: \`$(go version)\`"
-            echo "- c compiler: \`$(cc --version | head -n 1)\`"
+            echo "- c compiler: \`$(go env CC)\` (\`$("$(go env CC)" --version | head -n 1)\`)"
           } >> "$GITHUB_STEP_SUMMARY"
 
       - name: install ui node modules
@@ -118,9 +146,9 @@ jobs:
         run: |
           set -euo pipefail
           ldflags="-X github.com/openziti/zrok/v2/build.Version=$SMOKE_VERSION -X github.com/openziti/zrok/v2/build.Hash=$SMOKE_HASH"
-          go build -ldflags "$ldflags" -o "$SMOKE_DIR/bin/zrok2" ./cmd/zrok2
-          go build -tags agent_smoke -ldflags "$ldflags" -o "$SMOKE_DIR/bin/agent-smoke" ./tests/agent-smoke
-          "$SMOKE_DIR/bin/zrok2" version
+          go build -ldflags "$ldflags" -o "$SMOKE_DIR/bin/zrok2${{ matrix.exe }}" ./cmd/zrok2
+          go build -tags agent_smoke -ldflags "$ldflags" -o "$SMOKE_DIR/bin/agent-smoke${{ matrix.exe }}" ./tests/agent-smoke
+          "$SMOKE_DIR/bin/zrok2${{ matrix.exe }}" version
 
       - name: native process and worker fixtures
         shell: bash
@@ -147,8 +175,8 @@ jobs:
             echo "::error::secret 'ZROK2_CI_ACCOUNT_TOKEN' is not set in the 'zrok-agent-smoke' environment; the live scenario cannot run"
             exit 1
           fi
-          "$SMOKE_DIR/bin/agent-smoke" run \
-            --binary "$SMOKE_DIR/bin/zrok2" \
+          "$SMOKE_DIR/bin/agent-smoke${{ matrix.exe }}" run \
+            --binary "$SMOKE_DIR/bin/zrok2${{ matrix.exe }}" \
             --state-dir "$SMOKE_DIR/state" \
             --api-endpoint "$SMOKE_API_ENDPOINT" \
             --namespace "$SMOKE_NAMESPACE"
@@ -161,11 +189,11 @@ jobs:
           ZROK2_CI_ACCOUNT_TOKEN: ${{ secrets.ZROK2_CI_ACCOUNT_TOKEN }}
         run: |
           set -euo pipefail
-          if [ -z "${SMOKE_DIR:-}" ] || [ ! -x "$SMOKE_DIR/bin/agent-smoke" ]; then
+          if [ -z "${SMOKE_DIR:-}" ] || [ ! -x 
```

**File**: `CHANGELOG.md` (modified, +3/-5)
```diff
@@ -6,6 +6,8 @@ FIX: **Agent-managed public shares are now deleted on shutdown, including named
 
 FIX: **The agent API changes: `Agent.Shutdown()` now returns an error, and `Agent.ReloadRegistry()` is replaced by `Agent.RestoreRegistryOnce()`.** Agent shutdown waits for in-flight startup, share and access cleanup, and saved restart requests before exiting. The agent command now exits 1 instead of 0 if shutdown fails or times out. Releasing a queued or in-flight retry prevents it from returning, and stopping during registry replay preserves requests not yet attempted.
 
+FIX: The agent can restore saved shares and accesses from v2.0.8 registries containing null optional fields. Upgrading no longer fails with "expected array for slice"; existing registry files need no manual conversion.
+
 FIX: Public shares routed through the agent now exit 2 when the controller refuses creation, preserving its error message. Temporary controller failures continue to exit 1, including retry advice when the service is busy.
 
 FIX: Releasing agent-managed shares and accesses no longer waits indefinitely for blocked child output. Startup messages split across reads or delivered together are no longer lost.
@@ -16,11 +18,7 @@ FIX: Web shares no longer panic while starting Caddy when built with Go 1.27 or
 
 CHANGE: Official builds now use Go 1.27.3, with CI and source-build Docker images using the same compiler version. Building from source still requires Go 1.26 or newer.
 
-CHANGE: An `agent smoke` workflow builds `zrok2` from the selected branch on GitHub-hosted macOS (arm64) and Linux (amd64) runners, one platform at a time. On each, it takes an agent-managed named public share through Ctrl-C and a restart against a dedicated zrok test account, checking that the agent exits cleanly, the old share is gone, the reserved name survives and the replayed share has a new token. It runs on manual dispatch and temporarily on pushes to `fixes-209` for validation before merging, needs only the `ZROK2_CI_ACCOUNT_TOKEN` secret in the `zrok-agent-smoke` environment, and leaves existing builds and tests unchanged; see `docs/current/agent-smoke.md`.
-
-FIX: Agent lifecycle tests use short temporary directory names so their Unix sockets fit within macOS path limits. The macOS smoke workflow no longer times out in these fixtures before reaching the live scenario.
-
-FIX: The macOS agent smoke harness assumes HTTPS for public endpoints returned as bare hostnames, allowing named shares to reach the public response check. Explicit HTTP and HTTPS endpoints keep their supplied scheme.
+CHANGE: A manually dispatched `agent smoke` workflow checks, against a live zrok service on GitHub-hosted macOS, Linux and Windows runners, that the agent removes an agent-managed named public share when it shuts down gracefully and replays it with a new share after a restart. It is separate from existing builds, tests and releases; see `docs/current/agent-smoke.md` for setup and dispatch.
 
 ## v2.0.8
 
```

**File**: `agent/registry.go` (modified, +29/-1)
```diff
@@ -42,8 +42,19 @@ type FailureEntry struct {
 }
 
 func LoadRegistry(path string) (*Registry, error) {
+	data, err := os.ReadFile(path)
+	if err != nil {
+		return nil, err
+	}
+	var values map[string]any
+	if err := json.Unmarshal(data, &values); err != nil {
+		return nil, fmt.Errorf("unable to parse registry '%v': %w", path, err)
+	}
+	// the v2.0.8 writer emitted null for unused request slices. encoding/json accepted these as zero values;
+	// omit null object fields before binding a fresh registry so dd retains the same behavior.
+	omitRegistryNullFields(values)
 	r := &Registry{}
-	if err := dd.BindFromJSON(r, path, registryBindingOptions()); err != nil {
+	if err := dd.Bind(r, values, registryBindingOptions()); err != nil {
 		return nil, err
 	}
 
@@ -54,6 +65,23 @@ func LoadRegistry(path string) (*Registry, error) {
 	return r, nil
 }
 
+func omitRegistryNullFields(value any) {
+	switch value := value.(type) {
+	case map[string]any:
+		for key, child := range value {
+			if child == nil {
+				delete(value, key)
+			} else {
+				omitRegistryNullFields(child)
+			}
+		}
+	case []any:
+		for _, child := range value {
+			omitRegistryNullFields(child)
+		}
+	}
+}
+
 func (r *Registry) Save(path string) error {
 	r.V = RegistryV
 	values, err := dd.Unbind(r, registryBindingOptions())
```

**File**: `agent/registryCompatibility_test.go` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+package agent
+
+import (
+	"os"
+	"path/filepath"
+	"testing"
+	"time"
+
+	"github.com/michaelquigley/df/dd"
+	"github.com/stretchr/testify/require"
+)
+
+func TestRegistryReadsV208WriterFixtures(t *testing.T) {
+	retry, err := time.Parse(time.RFC3339Nano, "2026-10-28T12:34:56.123456789-04:00")
+	require.NoError(t, err)
+	// these files were generated with Registry.Save and the request structs from the v2.0.8 tag.
+	// retain its null slices and omitted optional fields; hand-written populated fixtures missed this regression.
+	cases := map[string]*Registry{
+		"empty": {V: RegistryV},
+		"public": {V: RegistryV, PublicShares: []*PublicShareRegistryEntry{{Request: &SharePublicRequest{
+			Target: "http://localhost:8080", BackendMode: "proxy",
+			NameSelections: []NameSelection{{NamespaceToken: "public", Name: "fixture-app"}},
+		}}}},
+		"private": {V: RegistryV,
+			PrivateShares: []*PrivateShareRegistryEntry{{Request: &SharePrivateRequest{
+				Target: "8081", BackendMode: "proxy", PrivateShareToken: "reserved-token",
+			}}},
+			PrivateAccesses: []*AccessRegistryEntry{{Request: &AccessPrivateRequest{
+				ShareToken: "access-token", BindAddress: "127.0.0.1:8082",
+			}}},
+		},
+		"all": {V: RegistryV,
+			PublicShares: []*PublicShareRegistryEntry{{Request: &SharePublicRequest{
+				Target: "8080", BackendMode: "proxy", NameSelections: []NameSelection{{NamespaceToken: "team", Name: "app"}},
+				BasicAuth: []string{"fixture:password"}, Insecure: true, Closed: true,
+				AccessGrants: []string{"fixture-account"}, OauthRefreshInterval: "3h0m0s",
+			}, Failure: &FailureEntry{Count: 2, LastError: "fixture failure", NextRetry: retry}}},
+			PrivateShares: []*PrivateShareRegistryEntry{{Request: &SharePrivateRequest{
+				Target: "8081", BackendMode: "tcpTunnel", PrivateShareToken: "reserved-token",
+				Insecure: true, Closed: true, AccessGrants: []string{"fixture-account"},
+			}}},
+			PrivateAccesses: []*AccessRegistryEntry{{Request: &AccessPrivateRequest{
+				ShareToken: "access-token", BindAddress: "127.0.0.1:8082", AutoMode: true,
+				AutoAddress: "127.0.0.1", AutoStartPort: 1024, AutoEndPort: 2048,
+				ResponseHeaders: []string{"X-Fixture: true"},
+			}, Failure: &FailureEntry{}}},
+		},
+	}
+	for name, expected := range cases {
+		t.Run(name, func(t *testing.T) {
+			original, err := os.ReadFile(filepath.Join("testdata", "registry_v208", name+".json"))
+			require.NoError(t, err)
+			path := filepath.Join(t.TempDir(), "registry.json")
+			require.NoError(t, os.WriteFile(path, original, 0600))
+			loaded, err := LoadRegistry(path)
+			require.NoError(t, err)
+			require.Equal(t, expected, loaded)
+			unchanged, err := os.ReadFile(path)
+			require.NoError(t, err)
+			require.Equal(t, original, unchanged, "loading must not rewrite the old file")
+
+			require.NoError(t, loaded.Save(path))
+			roundTrip, err := LoadRegistry(path)
+			require.NoError(t, err)
+			before, err := dd.Unbind(expected, registryBindingOptions())
+			require.NoError(t, err)
+			after, err := dd.Unbind(roundTrip, registryBindingOptions())
+			require.NoError(t, err)
+			require.Equal(t, before, after, "saving may normalize empty slices but must preserve requests and failures")
+		})
+	}
+}
+
+func TestRegistryCompatibilityKeepsInvalidInput(t *testing.T) {
+	for name, raw := range map[string]string{
+		"invalid json":     `{"v":"2",`,
+		"unknown version":  `{"v":"3","public_shares":null}`,
+		"wrong slice type": `{"v":"2","public_shares":[{"request":{"basic_auth":false}}]}`,
+		"null entry":       `{"v":"2","public_shares":[null]}`,
+		"null request":     `{"v":"2","public_shares":[{"request":null}]}`,
+		"missing request":  `{"v":"2","public_shares":[{}]}`,
+	} {
+		t.Run(name, func(t *testing.T) {
+			a := newLifecycleAgent(t)
+			path, err := a.root.AgentRegistry()
+			require.NoError(t, err)
+			require.NoError(t, os.WriteFile(path, []byte(raw), 0600))
+			require.Error(t, a.imported())
+			require.ErrorContains(t, a.SaveRegistry(), "preserving unread file")
+			data, err := os.ReadFile(path)
+			require.NoError(t, err)
+			require.Equal(t, raw, string(data))
+		})
+	}
+}
```

**File**: `agent/testdata/registry_v208/all.json` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+{
+  "v": "2",
+  "private_accesses": [
+    {
+      "request": {
+        "share_token": "access-token",
+        "bind_address": "127.0.0.1:8082",
+        "auto_mode": true,
+        "auto_address": "127.0.0.1",
+        "auto_start_port": 1024,
+        "auto_end_port": 2048,
+        "response_headers": [
+          "X-Fixture: true"
+        ]
+      },
+      "failure": {
+        "next_retry": "0001-01-01T00:00:00Z"
+      }
+    }
+  ],
+  "public_shares": [
+    {
+      "request": {
+        "target": "8080",
+        "basic_auth": [
+          "fixture:password"
+        ],
+        "name_selections": [
+          {
+            "namespace_token": "team",
+            "name": "app"
+          }
+        ],
+        "backend_mode": "proxy",
+        "insecure": true,
+        "oauth_provider": "",
+        "oauth_email_domains": null,
+        "oauth_refresh_interval": "3h0m0s",
+        "closed": true,
+        "access_grants": [
+          "fixture-account"
+        ]
+      },
+      "failure": {
+        "count": 2,
+        "last_error": "fixture failure",
+        "next_retry": "2026-10-28T12:34:56.123456789-04:00"
+      }
+    }
+  ],
+  "private_shares": [
+    {
+      "request": {
+        "target": "8081",
+        "private_share_token": "reserved-token",
+        "backend_mode": "tcpTunnel",
+        "insecure": true,
+        "closed": true,
+        "access_grants": [
+          "fixture-account"
+        ]
+      }
+    }
+  ]
+}
```

**File**: `agent/testdata/registry_v208/empty.json` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+{
+  "v": "2"
+}
```

**File**: `agent/testdata/registry_v208/private.json` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+{
+  "v": "2",
+  "private_accesses": [
+    {
+      "request": {
+        "share_token": "access-token",
+        "bind_address": "127.0.0.1:8082",
+        "auto_mode": false,
+        "auto_address": "",
+        "auto_start_port": 0,
+        "auto_end_port": 0,
+        "response_headers": null
+      }
+    }
+  ],
+  "private_shares": [
+    {
+      "request": {
+        "target": "8081",
+        "private_share_token": "reserved-token",
+        "backend_mode": "proxy",
+        "insecure": false,
+        "closed": false,
+        "access_grants": null
+      }
+    }
+  ]
+}
```

**File**: `agent/testdata/registry_v208/public.json` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+{
+  "v": "2",
+  "public_shares": [
+    {
+      "request": {
+        "target": "http://localhost:8080",
+        "basic_auth": null,
+        "name_selections": [
+          {
+            "namespace_token": "public",
+            "name": "fixture-app"
+          }
+        ],
+        "backend_mode": "proxy",
+        "insecure": false,
+        "oauth_provider": "",
+        "oauth_email_domains": null,
+        "oauth_refresh_interval": "",
+        "closed": false,
+        "access_grants": null
+      }
+    }
+  ]
+}
```

---

### Incident Patch 3: `0b6420b3` (2026-10-30)
**Commit Message**: agent-smoke: macos + linux

**File**: `.github/workflows/agent-smoke.yml` (renamed, +42/-18)
```diff
@@ -1,28 +1,42 @@
-name: macOS agent smoke
+name: agent smoke
 
-# isolated smoke workflow; see docs/current/macos-agent-smoke.md for the
+# isolated smoke workflow; see docs/current/agent-smoke.md for the
 # environment, account and recovery procedure.
 on:  # yamllint disable-line rule:truthy
   workflow_dispatch:
-  # temporary bootstrap: validate the development branch before this workflow reaches main
+  # temporary validation: run the expanded workflow on the development branch before it reaches main; remove
+  # after every platform row passes, before merging
   push:
     branches:
       - fixes-209
 
 permissions:
   contents: read
 
-# one run at a time against the dedicated account; a queued run waits instead of cancelling a live one
+# one run at a time against the dedicated account; a queued run waits instead of cancelling a live one. the group
+# keeps its original macOS-only name so older branches' macos-agent-smoke runs serialize with this workflow too.
 concurrency:
   group: macos-agent-smoke-zrok2-ci-account
   cancel-in-progress: false
 
 jobs:
   smoke:
-    name: Named public share restart (macOS arm64)
-    runs-on: macos-15
+    name: Named public share restart (${{ matrix.platform }})
+    runs-on: ${{ matrix.runner }}
     timeout-minutes: 45
     environment: zrok-agent-smoke
+    strategy:
+      # rows share the account, so they run one at a time, and one platform's failure still runs the others
+      max-parallel: 1
+      fail-fast: false
+      matrix:
+        include:
+          - runner: macos-15
+            platform: macOS arm64
+            slug: macos-arm64
+          - runner: ubuntu-24.04
+            platform: Linux amd64
+            slug: linux-amd64
     steps:
       - uses: actions/checkout@v4
         with:
@@ -45,26 +59,34 @@ jobs:
           echo "SMOKE_VERSION=$version" >> "$GITHUB_ENV"
           echo "SMOKE_HASH=$hash" >> "$GITHUB_ENV"
 
+      - uses: actions/setup-go@v5
+        with:
+          go-version-file: .go-version
+
+      - uses: actions/setup-node@v4
+        with:
+          node-version: 22.x
+
       - name: report dispatch
         shell: bash
         run: |
+          set -euo pipefail
+          case "$RUNNER_OS" in
+            macOS) os_release="macOS $(sw_vers -productVersion)" ;;
+            Linux) os_release="$(. /etc/os-release && echo "$PRETTY_NAME")" ;;
+            *) os_release="$RUNNER_OS" ;;
+          esac
           {
-            echo "### macOS agent smoke"
+            echo "### agent smoke (${{ matrix.platform }})"
             echo ""
             echo "- ref: \`$GITHUB_REF\`"
             echo "- commit: \`$SMOKE_HASH\`"
             echo "- build version: \`$SMOKE_VERSION\`"
-            echo "- runner: \`$RUNNER_OS/$RUNNER_ARCH\` ($(sw_vers -productVersion), $(uname -m))"
+            echo "- runner: \`$RUNNER_OS/$RUNNER_ARCH\` ($os_release, $(uname -m))"
+            echo "- go: \`$(go version)\`"
+            echo "- c compiler: \`$(cc --version | head -n 1)\`"
           } >> "$GITHUB_STEP_SUMMARY"
 
-      - uses: actions/setup-go@v5
-        with:
-          go-version-file: .go-version
-
-      - uses: actions/setup-node@v4
-        with:
-          node-version: 22.x
-
       - name: install ui node modules
         shell: bash
         run: npm ci
@@ -91,6 +113,8 @@ jobs:
 
       - name: build zrok2 and harness
         shell: bash
+        env:
+          CGO_ENABLED: "1"
         run: |
           set -euo pipefail
           ldflags="-X github.com/openziti/zrok/v2/build.Version=$SMOKE_VERSION -X github.com/openziti/zrok/v2/build.Hash=$SMOKE_HASH"
@@ -108,7 +132,7 @@ jobs:
 
       - name: offline harness tests
         shell: bash
-        run: go test -tags agent_smoke ./tests/agent-smoke -count=1 -timeout=5m
+        run: go test -race -tags agent_smoke ./tests/agent-smoke -count=1 -timeout=5m
 
       - name: live scenario
         shell: bash
@@ -156,7 +180,7 @@ jobs:
         if: always()
         uses: actions/upload-artifact@v4
         with:
-          name: macos-agent-smoke-${{ github.run_id }}-${{ github.run_attempt }}
+          name: agent-smoke-${{ matrix.slug }}-${{ github.run_id }}-${{ github.run_attempt }}
           path: ${{ env.SMOKE_DIR }}/state/report/
           retention-days: 7
           if-no-files-found: warn
```

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ FIX: Web shares no longer panic while starting Caddy when built with Go 1.27 or
 
 CHANGE: Official builds now use Go 1.27.3, with CI and source-build Docker images using the same compiler version. Building from source still requires Go 1.26 or newer.
 
-CHANGE: A `macOS agent smoke` workflow builds `zrok2` from the selected branch on a GitHub-hosted macOS runner. It takes an agent-managed named public share through Ctrl-C and a restart against a dedicated zrok test account, checking that the agent exits cleanly, the old share is gone, the reserved name survives and the replayed share has a new token. It runs on manual dispatch and temporarily on pushes to `fixes-209` for validation before merging, needs only the `ZROK2_CI_ACCOUNT_TOKEN` secret in the `zrok-agent-smoke` environment, and leaves existing builds and tests unchanged; see `docs/current/macos-agent-smoke.md`.
+CHANGE: An `agent smoke` workflow builds `zrok2` from the selected branch on GitHub-hosted macOS (arm64) and Linux (amd64) runners, one platform at a time. On each, it takes an agent-managed named public share through Ctrl-C and a restart against a dedicated zrok test account, checking that the agent exits cleanly, the old share is gone, the reserved name survives and the replayed share has a new token. It runs on manual dispatch and temporarily on pushes to `fixes-209` for validation before merging, needs only the `ZROK2_CI_ACCOUNT_TOKEN` secret in the `zrok-agent-smoke` environment, and leaves existing builds and tests unchanged; see `docs/current/agent-smoke.md`.
 
 FIX: Agent lifecycle tests use short temporary directory names so their Unix sockets fit within macOS path limits. The macOS smoke workflow no longer times out in these fixtures before reaching the live scenario.
 
```

**File**: `docs/current/agent-share-lifecycle.md` (modified, +4/-2)
```diff
@@ -28,7 +28,7 @@ Shutdown closes admission at the operation boundary, cancels startup and retry d
 
 After public worker exit is confirmed, the agent deletes every managed public share, including named shares. Reserved names and desired restart requests survive ordinary shutdown. An unconfirmed worker exit retains the token without deleting its resource. Public deletion uses a fresh 30-second context shared by client initialization, version checking, deletion and any absence check. A typed unshare-not-found response is reconciled through the generated authenticated account overview: the original environment must be present and the token must be absent from every environment. Generic errors, a missing environment, a still-listed token or a failed overview retain the cleanup failure. Context-aware SDK entry points require a root with bounded client initialization; legacy SDK entry points keep supporting the original root interface.
 
-Cleanup failures remain visible with the real token, failed status and a pending-cleanup error. Retry backoff applies to deletion before recreation; cleanup remains retryable after explicit release removes restart intent. Startup errors include any cleanup failure and known token. Shutdown attempts outstanding cleanup and reports unresolved tokens on failure. Pending cleanup identities remain in memory, not registry v2. An agent crash, a lost create response or a restart after failed shutdown can require manual cleanup; existing live-share name conflicts still return the controller's actionable 409 without evicting another share. Windows and macOS runtime validation also remains outstanding as recorded in the project journal.
+Cleanup failures remain visible with the real token, failed status and a pending-cleanup error. Retry backoff applies to deletion before recreation; cleanup remains retryable after explicit release removes restart intent. Startup errors include any cleanup failure and known token. Shutdown attempts outstanding cleanup and reports unresolved tokens on failure. Pending cleanup identities remain in memory, not registry v2. An agent crash, a lost create response or a restart after failed shutdown can require manual cleanup; existing live-share name conflicts still return the controller's actionable 409 without evicting another share. Native macOS validation is recorded below; Windows runtime validation remains outstanding.
 
 ## Verification
 
@@ -49,7 +49,9 @@ The ordinary suite uses helper subprocesses, channel barriers and fake controlle
 
 Local validation on 2026-10-29 used Go 1.27.3 on Linux/amd64. The lifecycle, CLI and SDK fixtures passed with the race detector. Portable process fixtures compiled for macOS/arm64 and Windows/amd64; compilation provides no evidence about native signal delivery or Windows job handling. No dedicated live zrok test environment or remote platform hosts were available, and the operator chose to record these checks as unavailable. The default local environment points to the public service and was not used for a live smoke test.
 
-The remaining native checks are `go test ./agent/proctree ./cmd/zrok2/subordinate -count=1 -timeout=2m` on macOS and Windows, plus a dedicated-environment named-share create → Ctrl-C → successful shutdown → restart smoke test on Linux and macOS. The live check must confirm absence of the old token, survival of the reserved name and a different replacement token. Portable EOF tests cover Windows worker control; `Process.Signal` cannot deliver terminal SIGINT on Windows, so the POSIX signal fixture skips that platform.
+On 2026-10-30, hosted macOS/arm64 run [41112465896](https://github.com/openziti/zrok/actions/runs/41112465896) passed at commit `ee5cbd392a34ced018d608699ee6cc6e0b838ece`. It ran the native process/worker fixtures, agent lifecycle race tests and the [live named-share smoke scenario](agent-smoke.md) against the production service using a dedicated account. Both SIGINT shutdowns succeeded; the old tokens disappeared, the reserved name survived, replay created a different token, public traffic worked and final cleanup passed.
+
+The remaining native checks are `go test ./agent/proctree ./cmd/zrok2/subordinate -count=1 -timeout=2m` on Windows, plus a dedicated-environment named-share create → Ctrl-C → successful shutdown → restart smoke test on Linux. The live check must confirm absence of the old token, survival of the reserved name and a different replacement token. Portable EOF tests cover Windows worker control; `Process.Signal` cannot deliver terminal SIGINT on Windows, so the POSIX signal fixture skips that platform.
 
 ## Deliberate boundaries
 
```

**File**: `docs/current/agent-smoke.md` (renamed, +22/-13)
```diff
@@ -1,6 +1,15 @@
-# macOS agent smoke
+# Agent smoke
 
-The `macOS agent smoke` workflow (`.github/workflows/macos-agent-smoke.yml`) runs the agent's named public share through an interrupt and a restart on a native GitHub-hosted macOS runner, against a live zrok v2 service with a dedicated test account. It builds `zrok2` from the triggering commit and drives it as a user would. It supplies the native evidence that [Agent share lifecycle](agent-share-lifecycle.md) records as outstanding for macOS. It is the only CI job that uses a live service account. It runs on manual dispatch and, temporarily, pushes to `fixes-209` for validation before merging. No other workflow, required check, release or `Makefile` target depends on it.
+The `agent smoke` workflow (`.github/workflows/agent-smoke.yml`) runs the agent's named public share through an interrupt and a restart on native GitHub-hosted runners, against a live zrok v2 service with a dedicated test account. It builds `zrok2` from the triggering commit on each runner and drives it as a user would. It supplies the native platform evidence recorded in [Agent share lifecycle](agent-share-lifecycle.md). It is the only CI workflow that uses a live service account. It runs on manual dispatch and, temporarily, on pushes to `fixes-209` for validation before merging. No other workflow, required check, release or `Makefile` target depends on it.
+
+One platform matrix runs the same build, fixture, live-scenario and cleanup sequence on each row, each on a fresh runner:
+
+| Row | Runner | Architecture | Graceful stop |
+| --- | --- | --- | --- |
+| macOS arm64 | `macos-15` | arm64 | SIGINT to the agent's process group |
+| Linux amd64 | `ubuntu-24.04` | amd64 | SIGINT to the agent's process group |
+
+Windows is not yet a row; its native validation remains outstanding.
 
 ## What a run proves
 
@@ -9,14 +18,14 @@ The live scenario passes only when every observation holds and final cleanup suc
 1. A fresh environment is enabled with the built CLI's headless enable path, and a new unique name is reserved.
 2. `zrok2 agent start` runs in its own process group and reports the exact build identity the job stamped.
 3. `zrok2 share public --force-agent --open -n <namespace>:<name>` against a loopback server produces exactly one active share in structured agent status, the name is bound to its token, and the public endpoint returns the server's per-run random body. Bare endpoint hostnames are fetched over HTTPS; explicit HTTP or HTTPS schemes are preserved.
-4. SIGINT to the agent's process group, as a terminal Ctrl-C delivers it, ends the agent with exit 0 within 130 seconds. A forced kill is a failure.
+4. The row's graceful-stop event ends the agent with exit 0 within 130 seconds. On macOS and Linux that event is SIGINT to the agent's process group, as a terminal Ctrl-C delivers it. A forced kill is a failure.
 5. A successful authenticated account overview still lists the environment, no longer mentions the share token anywhere, and the name listing shows the name reserved and unbound.
 6. Restarting the agent with the same environment replays the saved request without another share command: exactly one active share, a new token, the old token still absent, the name bound to the replacement and the random body served through it.
 7. A second interrupt repeats the exit, absence and name checks. Cleanup then removes the name and the environment and proves their absence.
 
-Before the live scenario the job runs the native process and worker fixtures (`./agent/proctree`, `./cmd/zrok2/subordinate`), the agent package's lifecycle tests under the race detector, and the harness's offline tests.
+Before the live scenario each row runs the native process and worker fixtures (`./agent/proctree`, `./cmd/zrok2/subordinate`), and the agent package's lifecycle tests and the harness's offline tests under the race detector.
 
-A successful build, passing native fixtures or a run rescued by fallback cleanup does not close the macOS gap; only a run whose scenario steps and run-mode cleanup all pass does. Windows validation and the Linux live check are outside this workflow and remain outstanding.
+A successful build, passing native fixtures or a run rescued by fallback cleanup does not close a platform's gap; only a row whose scenario steps and run-mode cleanup all pass does. Each row's result stands alone: a passing macOS row is no evidence for Linux, and a row cancelled while queued is not a result. Windows validation is outside this workflow and remains outstanding.
 
 ## Setup
 
@@ -26,17 +35,17 @@ The operator does these once, in repository settings. No step needs an admin tok
 - A GitHub environment named `zrok-agent-smoke`, with deployment branches restricted to trusted branches, holding the secret `ZROK2_CI_ACCOUNT_TOKEN` (the dedicated account's token). An environment secret reaches only jobs that reference that environment, and within the job only the live scenario and fallback cleanu
```

**File**: `docs/journal/2026-10-30.md` (modified, +2/-1)
```diff
@@ -2,4 +2,5 @@
 
 - macOS agent smoke Terminus round 4 (`41801b329526`): the operator vetoed `quoted-success-details`. The step and cleanup success lines in `tests/agent-smoke/report.go` keep their unquoted detail suffix, because the detail is a phrase that already quotes its own values and the live job log is the only trail when a run dies before the report uploads. Do not reopen this advisory.
 - Terminus round 5 (`3031c022a81d`): the operator vetoed `macos-runner-architecture`. `runs-on: macos-15` in `.github/workflows/macos-agent-smoke.yml` is GitHub's arm64 label (Intel is `macos-15-intel` or `macos-15-large`), and there is no hosted `macos-15-arm64` label, so the "(macOS arm64)" job name is accurate. Do not reopen this advisory.
-- The operator requires the live macOS smoke on `fixes-209` before merging. A temporary push trigger restricted to that branch bootstraps the run without landing the workflow on `main`; remove it after validation and before merging to restore manual-only operation. The operator has configured the environment secret. Hosted validation status is tracked in `docs/current/macos-agent-smoke.md`.
+- The operator required live macOS validation on `fixes-209` before merging. Hosted run `41112465896` passed, including the live scenario and cleanup; the temporary branch push trigger has been removed, restoring manual-only operation. The configured environment secret remains for future dispatches. Evidence and outstanding platform checks are tracked in `docs/current/macos-agent-smoke.md` and `docs/current/agent-share-lifecycle.md`.
+- Linux/Windows agent smoke stage 1: `.github/workflows/macos-agent-smoke.yml` became `.github/workflows/agent-smoke.yml` (macOS arm64 and Linux amd64 rows, serialized), and its operator doc became `docs/current/agent-smoke.md`. The temporary `fixes-209` push trigger is back on the generalized workflow by work-order authority. It stays through stage 2 and comes out only after all three rows pass, before merging. No hosted run of the generalized workflow exists yet, so the Linux line in `docs/current/agent-share-lifecycle.md` deliberately stays outstanding. The harness process code is unchanged for Linux: procps `ps -o lstart=`/`args=` and `pgrep -P` serve the existing identity checks, but only offline tests have run on Linux. `actionlint` is still unavailable here, so the workflow is parse-checked only.
```

**File**: `tests/agent-smoke/main.go` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 //go:build agent_smoke && unix
 
 // agent-smoke drives the named public share shutdown and restart scenario against a live zrok service, using a
-// separately built zrok2 binary. it is built only with '-tags agent_smoke'. see docs/current/macos-agent-smoke.md.
+// separately built zrok2 binary. it is built only with '-tags agent_smoke'. see docs/current/agent-smoke.md.
 package main
 
 import (
```

#### Recent Merged Pull Requests:
- **PR #1286** (2026-10-30): fixes-209 (@michaelquigley)
- **PR #1284** (2026-10-08): fall-fixes-208 (@michaelquigley)
- **PR #1283** (2026-10-03): rate limiting is counted and answered with 503; access and enable compensate (@michaelquigley)
- **PR #1282** (2026-10-02): relax rebuilds v2 public share dial policies; repair-dial-policies; influx query deadline (@michaelquigley)
- **PR #1281** (2026-10-02): garbage collection improvements (@michaelquigley)
- **PR #1280** (2026-09-29): fall-fixes-s9 (@michaelquigley)

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

## X. add isolated macos agent smoke workflow; verify named share shutdown and replay;

**RULE**:
When implementing operations in `.github/workflows/macos-agent-smoke.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in openziti/zrok. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c2a1b06a`: add isolated macos agent smoke workflow; verify named share shutdown and replay; bounded cleanup and offline regression coverage. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/macos-agent-smoke.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
name: macOS agent smoke

# manually dispatched only; nothing else depends on this workflow. see docs/current/macos-agent-smoke.md for the
# environment, account and recovery procedure.
on:  # yamllint disable-line rule:truthy
  workflow_dispatch:

permissions:
  contents: read

# one run at a time against the dedicated account; a queued run waits instead of cancelling a live one
concurrency:
  group: macos-agent-smoke-zrok2-ci-account
  cancel-in-progress: false

jobs:
  smoke:
    name: Named public share restart (macOS arm64)
    runs-on: macos-15
    timeout-minutes: 45
    environment: zrok-agent-smoke
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false

      - name: fresh runner preflight
        shell: bash
        run: |
          set -euo pipefail
          if [ -e "$HOME/.zrok2" ]; then
            echo "::error::'$HOME/.zrok2' already exists; the smoke runs only on a fresh runner"
            exit 1
          fi
          smoke_dir="$RUNNER_TEMP/agent-smoke"
          mkdir -p "$smoke_dir/bin"
          echo "SMOKE_DIR=$smoke_dir" >> "$GITHUB_ENV"
          version="$(git describe --tags --match 'v2.*' 
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c2a1b06a` are properly handled with clean fallback behavior.
