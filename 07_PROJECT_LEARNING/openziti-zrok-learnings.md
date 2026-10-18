> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/openziti-zrok-learnings.md`  
> **Source**: github ([https://github.com/openziti/zrok](https://github.com/openziti/zrok))  
> **Source Version**: `09ed814e`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T21:07:47.426Z  
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
> **Harvest Timestamp**: 2026-10-18T21:07:46.952Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `openziti/zrok`
- **Description**: Secure internet sharing made simple.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 4777 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `cmd/zrok2/util.go`
```
package main

import (
	"fmt"
	"math"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/go-openapi/runtime"
	httptransport "github.com/go-openapi/runtime/client"
	"github.com/openziti/zrok/v2/agent/agentClient"
	"github.com/openziti/zrok/v2/environment"
	"github.com/openziti/zrok/v2/environment/env_core"
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
	// parse port-only urls
	if iv, err := strconv.ParseInt(in, 10, 0); err == nil {
		if iv > 0 && iv <= math.MaxUint16 {
			if iv == 443 {
				return fmt.Sprintf("https://127.0.0.1:%d", iv), nil
			}
			return fmt.Sprintf("http://127.0.0.1:%d", iv), nil
		}
		return "", errors.Errorf("ports must be between 1 and %d; %d is not", math.MaxUint16, iv)
	}

	// make sure either https:// or http:// was specified
	if !strings.HasPrefix(in, "https://") && !strings.HasPrefix(in, "http://") {
		in = "http://" + in
	}

	// parse the url
	targetEndpoint, err := url.Parse(in)
	if err != nil {
		return "", err
	}

	return targetEndpoint.String(), nil
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

### Core Architecture Module: `environment/env_core/model.go`
```
package env_core

import "github.com/openziti/zrok/v2/rest_client_zrok"

// Root is the primary interface encapsulating the on-disk environment data.
type Root interface {
	Metadata() *Metadata
	Obliterate() error

	HasConfig() (bool, error)
	Config() *Config
	SetConfig(cfg *Config) error

	Client() (*rest_client_zrok.Zrok, error)
	ApiEndpoint() (string, string)
	DefaultNamespace() (string, string)
	Headless() (bool, string)
	SuperNetwork() (bool, string)

	IsEnabled() bool
	Environment() *Environment
	SetEnvironment(env *Environment) error
	DeleteEnvironment() error

	PublicIdentityName() string
	EnvironmentIdentityName() string

	ZitiIdentityNamed(name string) (string, error)
	SaveZitiIdentityNamed(name, data string) error
	DeleteZitiIdentityNamed(name string) error

	AgentSocket() (string, error)
	AgentRegistry() (string, error)
	AgentEnrollment() (string, error)
}

type Environment struct {
	AccountToken string
	ZitiIdentity string
	ApiEndpoint  string
}

type Config struct {
	ApiEndpoint      string
	DefaultNamespace string
	Headless         bool
	SuperNetwork     bool
}

type Metadata struct {
	V        string
	RootPath string
}

```

### Core Architecture Module: `ui/src/model/util.ts`
```
import {Metrics, MetricsSample} from "../api";

export interface PropertyRow {
    id: number;
    property: string;
    value: unknown;
}

export interface MetricsResult {
    data: MetricsSample[] | undefined;
    rx: number;
    tx: number;
}

export const objectToRows = (obj: Record<string, unknown> | null | undefined): PropertyRow[] => {
    if (!obj) {
        return [];
    }
    const rows: PropertyRow[] = [];
    let count = 0;
    for(const key in obj) {
        rows.push({
            id: count++,
            property: key,
            value: obj[key]
        });
    }
    rows.sort((a, b) => a.property.localeCompare(b.property));
    return rows;
};

export const camelToWords = (s: string): string => s.replace(/([A-Z])/g, ' $1').replace(/^./, function(str){ return str.toUpperCase(); });

export const bytesToSize = (bytes: number): string => {
    let i = -1;
    const byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        bytes /= 1024;
        i++;
    } while (bytes > 1024);
    return Math.max(bytes, 0.1).toFixed(1) + byteUnits[i];
}

export const buildMetrics = (m: Metrics): MetricsResult => {
    const metrics: MetricsResult = {
        data: m.samples,
        rx: 0,
        tx: 0
    }
    if(m.samples) {
        m.samples.forEach(s => {
            metrics.rx += s.rx ? s.rx : 0;
            metrics.tx += s.tx ? s.tx : 0;
        });
    }
    return metrics;
}

```

### Core Architecture Module: `util/autoListener.go`
```
package util

import (
	"fmt"
	"net"
)

func AutoListener(protocol, address string, startPort, endPort uint16) (net.Listener, error) {
	for i := startPort; i <= endPort; i++ {
		l, err := net.Listen(protocol, fmt.Sprintf("%s:%d", address, i))
		if err != nil {
			continue
		}
		return l, nil
	}
	return nil, fmt.Errorf("no listener found in range")
}

func AutoListenerAddress(protocol, address string, startPort, endPort uint16) (string, error) {
	listener, err := AutoListener(protocol, address, startPort, endPort)
	if err != nil {
		return "", err
	}
	autoAddress := listener.Addr().String()
	if err := listener.Close(); err != nil {
		return "", err
	}
	return autoAddress, nil
}

```

### Core Architecture Module: `util/cors.go`
```
package util

import "net/http"

func cors(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, Authorization, ResponseType, User-Agent")
		if r.Method == "OPTIONS" {
			return
		}
		h.ServeHTTP(w, r)
	})
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1284** (2026-10-08): **fall-fixes-208**
  *Symptoms*: CHANGE: **Share and access commands exit with status 2, not 1, when the controller refuses the request.** `zrok2 share public`, `zrok2 share private` and `zrok2 access private` exit 2 for a refusal a retry cannot change (such as a name held by another share, now named in the message) and 1 for a failure a retry may fix (the controller unreachable, busy or failing; a busy controller says how many seconds to wait). Scripts that test for status 1 must also accept 2; a supervisor can stop restarting on 2, for example with systemd's `RestartPreventExitStatus=2`.  CHANGE: **Admin repair commands no longer migrate the store.** `zrok2 admin gc`, `zrok2 admin repair-dial-policies` and `zrok2 admin repair-store` open the store without migrating it, so a dry run never changes the database; run `zrok2 admin migrate` or start the controller first when the schema is behind the binary.  FEATURE: `zrok2 admin repair-store <configPath>` releases what earlier versions left behind: names and frontend mappings still attached to deleted shares, stranded environments, shares, accesses and names. It is a dry run by default that counts and samples what it would repair, and repairs in small batches with `--apply`.  FEATURE: Admin `GET /name/{namespaceToken}/{name}` returns one name with its owner and current share token, for reconciling names without listing them all.  FIX: A name whose share no longer exists is released automatically the next time it is used, instead of answering "already in use by 

- **Issue #1283** (2026-10-03): **rate limiting is counted and answered with 503; access and enable compensate**
  *Symptoms*: FIX: `share`, `unshare`, `access`, `unaccess`, `enable` and `disable` now answer 503 Service Unavailable with a `Retry-After` header (five seconds) when the OpenZiti controller is rate limiting the zrok controller, instead of 500. A client can now tell a busy controller from a broken one and try again later. The failed request is undone as before: a share or access that fails removes what it created, and a share or environment delete that fails leaves everything in place for the retry. The controller log names the OpenZiti limiter that answered, along with the method and path of the refused request.  FIX: A private access (`zrok2 access private`) that fails after its dial policy has been created in OpenZiti now deletes that dial policy. Previously a failure to record the access left the policy behind with no access owning it. Likewise, enabling an environment (`zrok2 enable`) that fails after its OpenZiti identity has been created now deletes the identity and its edge router policy, where previously they were left behind with no environment owning them.  CHANGE: The admin profile endpoint's `/debug/vars` now includes `zrok.ziti.rate_limited`, the number of OpenZiti management requests the controller has had refused by an OpenZiti rate limiter (HTTP 429) since it started, counting both the command and authentication limiters.

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

### Incident Patch 1: `09ed814e` (2026-10-08)
**Commit Message**: Merge pull request #1284 from openziti/fall-fixes-208

fall-fixes-208

**File**: `CHANGELOG.md` (modified, +20/-0)
```diff
@@ -2,6 +2,26 @@
 
 ## Unreleased
 
+## v2.0.8
+
+CHANGE: **Share and access commands exit with status 2, not 1, when the controller refuses the request.** `zrok2 share public`, `zrok2 share private` and `zrok2 access private` exit 2 for a refusal a retry cannot change (such as a name held by another share, now named in the message) and 1 for a failure a retry may fix (the controller unreachable, busy or failing; a busy controller says how many seconds to wait). Scripts that test for status 1 must also accept 2; a supervisor can stop restarting on 2, for example with systemd's `RestartPreventExitStatus=2`.
+
+CHANGE: **Admin repair commands no longer migrate the store.** `zrok2 admin gc`, `zrok2 admin repair-dial-policies` and `zrok2 admin repair-store` open the store without migrating it, so a dry run never changes the database; run `zrok2 admin migrate` or start the controller first when the schema is behind the binary.
+
+FEATURE: `zrok2 admin repair-store <configPath>` releases what earlier versions left behind: names and frontend mappings still attached to deleted shares, stranded environments, shares, accesses and names. It is a dry run by default that counts and samples what it would repair, and repairs in small batches with `--apply`.
+
+FEATURE: Admin `GET /name/{namespaceToken}/{name}` returns one name with its owner and current share token, for reconciling names without listing them all.
+
+FIX: A name whose share no longer exists is released automatically the next time it is used, instead of answering "already in use by another share" forever. Tearing down a share now also releases its private accesses, and deleting an account releases its names.
+
+FIX: `zrok2 share` no longer leaves a share behind when its backend fails to start, so the next attempt creates it cleanly; shutting down a share closes its listener before deleting the share, which removes the OpenZiti `failure creating Bind session` warning. A private share whose chosen token is still in use now says so, and that a recently deleted share's token will be available again shortly.
+
+FIX: `zrok2 disable` keeps the local environment and identity whenever the controller does not complete the request, so a retry has what it needs (https://github.com/openziti/zrok/issues/1265); if the environment no longer exists on the controller, the local copy under `~/.zrok2` can be removed by hand. `zrok2 delete share` accepts a name as well as a share token. `--verbose` enables debug logging (visible in headless mode).
+
+FIX: On OpenZiti 2.x, bandwidth limits, disabling an environment, deleting a private access and agent unenroll now remove the policies they are meant to; previously none of them removed any policy there. A failed agent enrollment no longer leaves its OpenZiti objects behind, and the enrollment token is no longer written to the controller log.
+
+FIX: The embedded interstitial page is served again when no external file is configured (https://github.com/openziti/zrok/issues/1262), and the `zrok2-instance` Docker Compose bootstrap no longer fails with `is a directory` when run from a fetched directory (https://github.com/openziti/zrok/issues/1260).
+
 ## v2.0.7
 
 FIX: `zrok2 admin gc` now decides which share an OpenZiti object belongs to by its `zrokShareToken` tag rather than its name, so it no longer deletes the bind, dial and service edge router policies of live shares; objects with no share token, such as agent-remote services and policies, are never touched. It now reads every object rather than the first page of ten of each kind. It is a dry run by default that prints what it would remove, grouped by share token, and deletes only with `--delete`. Orphaned objects younger than `--min-age` (default 24 hours) are skipped, so a share being created at the time of the run is not collected. Tearing down a share with more than ten OpenZiti objects of one kind, such as a share with many access dial policies, now removes all of them rather than the first ten.
```

**File**: `README.md` (modified, +5/-5)
```diff
@@ -1,6 +1,6 @@
 # zrok - Secure internet sharing made simple
 
-![zrok logo](docs/images/zrok_cover.png)
+![zrok logo](website/docs/images/zrok_cover.png)
 
 **Share anything, anywhere, instantly. Enterprise reliability. No firewall changes. No port forwarding. No hassle.**
 
@@ -27,7 +27,7 @@ $ zrok share public --backend-mode drive ~/Documents
 $ zrok share private localhost:3000
 ```
 
-![zrok Web Console](docs/images/zrok_web_console.png)
+![zrok Web Console](website/docs/images/zrok_web_console.png)
 
 ## What you can share
 
@@ -39,7 +39,7 @@ Instantly make local web apps accessible over the internet:
 zrok share public localhost:8080
 ```
 
-![zrok share public](docs/images/zrok_share_public.png)
+![zrok share public](website/docs/images/zrok_share_public.png)
 
 ### Files & directories
 
@@ -49,8 +49,8 @@ Turn any folder into a shareable network drive:
 zrok share public --backend-mode drive ~/Repos/zrok
 ```
 
-![zrok share public -b drive](docs/images/zrok_share_public_drive.png)
-![mounted zrok drive](docs/images/zrok_share_public_drive_explorer.png)
+![zrok share public -b drive](website/docs/images/zrok_share_public_drive.png)
+![mounted zrok drive](website/docs/images/zrok_share_public_drive_explorer.png)
 
 ### Private resources
 
```

**File**: `agent/agentUi/package-lock.json` (modified, +211/-408)
```diff
@@ -891,9 +891,9 @@
       }
     },
     "node_modules/@eslint-community/eslint-utils": {
-      "version": "4.4.1",
-      "resolved": "https://registry.npmjs.org/@eslint-community/eslint-utils/-/eslint-utils-4.4.1.tgz",
-      "integrity": "sha512-s3O3waFUrMV8P/XaF/+ZTp1X9XBZW1a4B97ZnjQF2KYWaFD2A8KyFBsrsfSjEmjn3RGWAIuvlneuZm3CUK3jbA==",
+      "version": "4.10.1",
+      "resolved": "https://registry.npmjs.org/@eslint-community/eslint-utils/-/eslint-utils-4.10.1.tgz",
+      "integrity": "sha512-cuadcxVFE8sDK6iWJbs8Sn0av2Nrh2QSGQhVlBW9AaAHqHwjWsZHT8LJ4hFGPh7ASBV2deFdM7H/DPjulmh8rg==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -923,9 +923,9 @@
       }
     },
     "node_modules/@eslint-community/regexpp": {
-      "version": "4.12.1",
-      "resolved": "https://registry.npmjs.org/@eslint-community/regexpp/-/regexpp-4.12.1.tgz",
-      "integrity": "sha512-CCZCDJuduB9OUkFkY2IgppNZMi2lBQgD2qzwXkEia16cge2pijY/aXi96CJMquDMn3nJdlPV1A5KrJEXwfLNzQ==",
+      "version": "4.12.2",
+      "resolved": "https://registry.npmjs.org/@eslint-community/regexpp/-/regexpp-4.12.2.tgz",
+      "integrity": "sha512-EriSTlt5OC9/7SXkRSCAhfSxxoSUgBm33OH+IkwbdpgoqsSsUg7y3uh+IICI/Qg4BBWr3U2i39RpmycbxMq4ew==",
       "dev": true,
       "license": "MIT",
       "engines": {
@@ -1386,44 +1386,6 @@
         }
       }
     },
-    "node_modules/@nodelib/fs.scandir": {
-      "version": "2.1.5",
-      "resolved": "https://registry.npmjs.org/@nodelib/fs.scandir/-/fs.scandir-2.1.5.tgz",
-      "integrity": "sha512-vq24Bq3ym5HEQm2NKCr3yXDwjc7vTsEThRDnkp2DK9p1uqLR+DHurm/NOTo0KG7HYHU7eppKZj3MyqYuMBf62g==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "@nodelib/fs.stat": "2.0.5",
-        "run-parallel": "^1.1.9"
-      },
-      "engines": {
-        "node": ">= 8"
-      }
-    },
-    "node_modules/@nodelib/fs.stat": {
-      "version": "2.0.5",
-      "resolved": "https://registry.npmjs.org/@nodelib/fs.stat/-/fs.stat-2.0.5.tgz",
-      "integrity": "sha512-RkhPPp2zrqDAQA/2jNhnztcPAlv64XdhIp7a7454A5ovI7Bukxgt7MX7udwAu3zg1DcpPU0rz3VV1SeaqvY4+A==",
-      "dev": true,
-      "license": "MIT",
-      "engines": {
-        "node": ">= 8"
-      }
-    },
-    "node_modules/@nodelib/fs.walk": {
-      "version": "1.2.8",
-      "resolved": "https://registry.npmjs.org/@nodelib/fs.walk/-/fs.walk-1.2.8.tgz",
-      "integrity": "sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "@nodelib/fs.scandir": "2.1.5",
-        "fastq": "^1.6.0"
-      },
-      "engines": {
-        "node": ">= 8"
-      }
-    },
     "node_modules/@popperjs/core": {
       "version": "2.11.8",
       "resolved": "https://registry.npmjs.org/@popperjs/core/-/core-2.11.8.tgz",
@@ -1895,21 +1857,20 @@
       }
     },
     "node_modules/@typescript-eslint/eslint-plugin": {
-      "version": "8.15.0",
-      "resolved": "https://registry.npmjs.org/@typescript-eslint/eslint-plugin/-/eslint-plugin-8.15.0.tgz",
-      "integrity": "sha512-+zkm9AR1Ds9uLWN3fkoeXgFppaQ+uEVtfOV62dDmsy9QCNqlRHWNEck4yarvRNrvRcHQLGfqBNui3cimoz8XAg==",
+      "version": "8.71.1",
+      "resolved": "https://registry.npmjs.org/@typescript-eslint/eslint-plugin/-/eslint-plugin-8.71.1.tgz",
+      "integrity": "sha512-nNlBf6HuotqMgZvSkWD5hNdemiBIxQ2NmrlgfcUIeZRs+BbakjscCQRq/Hb74EFVnFiSWWdL12JruqwBy3ERDw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@eslint-community/regexpp": "^4.10.0",
-        "@typescript-eslint/scope-manager": "8.15.0",
-        "@typescript-eslint/type-utils": "8.15.0",
-        "@typescript-eslint/utils": "8.15.0",
-        "@typescript-eslint/visitor-keys": "8.15.0",
-        "graphemer": "^1.4.0",
-        "ignore": "^5.3.1",
+        "@eslint-community/regexpp": "^4.12.2",
+        "@typescript-eslint/scope-manager": "8.71.1",
+        "@typescript-eslint/type-utils": "8.71.1",
+        "@typescript-eslint/utils": "8.71.1",
+        "@typescript-eslint/visitor-keys": "8.71.1",
+        "ignore": "^7.0.5",
         "natural-compare": "^1.4.0",
-        "ts-api-utils": "^1.3.0"
+        "ts-api-utils": "^2.5.0"
       },
       "engines": {
         "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
@@ -1919,27 +1880,33 @@
         "url": "https://opencollective.com/typescript-eslint"
       },
       "peerDependencies": {
-        "@typescript-eslint/parser": "^8.0.0 || ^8.0.0-alpha.0",
-        "eslint": "^8.57.0 || ^9.0.0"
-      },
-      "peerDependenciesMeta": {
-        "typescript": {
-          "optional": true
-        }
+        "@typescript-eslint/parser": "^8.71.1",
+        "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0",
+        "typescript": ">=4.8.4 <6.1.0"
+      }
+    },
+    "node_modules/@typescript-eslint/eslint-plugin/node_modules/ignore": {
+      "version": "7.0.12",
+      "resolved": "https://registry.npmjs.org/ignore/-/ignore-7.0.12.tgz",
+
```

**File**: `cmd/zrok2/accessPrivate.go` (modified, +8/-11)
```diff
@@ -28,7 +28,6 @@ import (
 	"github.com/openziti/zrok/v2/environment/env_core"
 	"github.com/openziti/zrok/v2/rest_client_zrok"
 	"github.com/openziti/zrok/v2/rest_client_zrok/share"
-	"github.com/openziti/zrok/v2/tui"
 	"github.com/openziti/zrok/v2/util"
 	"github.com/sirupsen/logrus"
 	"github.com/spf13/cobra"
@@ -57,6 +56,7 @@ func newAccessPrivateCommand() *accessPrivateCommand {
 	cmd := &cobra.Command{
 		Use:   "private <shareToken>",
 		Short: "Create a private frontend to access a share",
+		Long:  "Create a private frontend to access a share\n\n" + exitCodesHelp,
 		Args:  cobra.ExactArgs(1),
 	}
 	command := &accessPrivateCommand{cmd: cmd}
@@ -95,7 +95,7 @@ func (cmd *accessPrivateCommand) run(_ *cobra.Command, args []string) {
 	}
 
 	if !root.IsEnabled() {
-		tui.Error("unable to load environment; did you 'zrok2 enable'?", nil)
+		exitWithFailure("unable to load environment; did you 'zrok2 enable'?", nil)
 	}
 
 	detectAndRouteToAgent(
@@ -265,7 +265,7 @@ func (cmd *accessPrivateCommand) accessLocal(args []string, root env_core.Root)
 		data["bind_address"] = bindAddress
 		jsonData, err := json.Marshal(data)
 		if err != nil {
-			subordinateError(err)
+			cmd.error(err)
 		}
 		fmt.Println(string(jsonData))
 	}
@@ -316,7 +316,7 @@ func (cmd *accessPrivateCommand) accessLocal(args []string, root env_core.Root)
 		}()
 
 		if _, err := prg.Run(); err != nil {
-			tui.Error("An error occurred", err)
+			exitWithFailure("An error occurred", err)
 		}
 
 		close(requests)
@@ -326,12 +326,9 @@ func (cmd *accessPrivateCommand) accessLocal(args []string, root env_core.Root)
 
 func (cmd *accessPrivateCommand) error(err error) {
 	if cmd.subordinate {
-		subordinateError(err)
-	}
-	if !panicInstead {
-		tui.Error("unable to create private access", err)
+		subordinateError("unable to create private access", err)
 	}
-	panic(err)
+	exitWithFailure("unable to create private access", err)
 }
 
 func (cmd *accessPrivateCommand) shutdown(frontendToken, envZId, shrToken string, zrok *rest_client_zrok.Zrok, auth runtime.ClientAuthInfoWriter) {
@@ -350,7 +347,7 @@ func (cmd *accessPrivateCommand) shutdown(frontendToken, envZId, shrToken string
 func (cmd *accessPrivateCommand) accessAgent(args []string, root env_core.Root) {
 	client, conn, err := agentClient.NewClient(root)
 	if err != nil {
-		tui.Error("error connecting to agent", err)
+		exitWithFailure("error connecting to agent", err)
 	}
 	defer func() { _ = conn.Close() }()
 
@@ -368,7 +365,7 @@ func (cmd *accessPrivateCommand) accessAgent(args []string, root env_core.Root)
 
 	acc, err := client.AccessPrivate(context.Background(), req)
 	if err != nil {
-		tui.Error("error creating access", err)
+		exitWithFailure("error creating access", err)
 	}
 
 	fmt.Println(acc)
```

**File**: `cmd/zrok2/adminRepairStore.go` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+package main
+
+import (
+	"github.com/michaelquigley/df/dd"
+	"github.com/michaelquigley/df/dl"
+	"github.com/openziti/zrok/v2/controller"
+	"github.com/openziti/zrok/v2/controller/config"
+	"github.com/spf13/cobra"
+)
+
+func init() {
+	adminCmd.AddCommand(newAdminRepairStoreCommand().cmd)
+}
+
+type adminRepairStoreCommand struct {
+	cmd   *cobra.Command
+	apply bool
+	batch int
+}
+
+func newAdminRepairStoreCommand() *adminRepairStoreCommand {
+	cmd := &cobra.Command{
+		Use:   "repair-store <configPath>",
+		Short: "Release store rows left by incomplete teardowns: environments, shares, accesses, names and mappings (dry run by default)",
+		Long: "Report, and with --apply repair, the store rows a teardown would have released had it run, in this order:\n" +
+			"live environments of deleted accounts; live shares in deleted environments, released as a teardown\n" +
+			"would release them in the store; access frontends of deleted shares; names of deleted accounts;\n" +
+			"allocated names no mapping holds; share name mappings to deleted shares (reserved names first, then\n" +
+			"allocated names with the names themselves); share name mappings of live shares to deleted names; and\n" +
+			"frontend mappings whose share token belongs to no live share. Live shares are expected in the sample\n" +
+			"under shares in deleted environments and mappings to deleted names, and nowhere else.\n\n" +
+			"Without --apply this is a dry run: nothing is changed and the report counts and samples what would be.\n" +
+			"With --apply the rows are repaired in batches of --batch, each its own transaction. Only the store is\n" +
+			"touched: no OpenZiti calls (gc collects a released share's objects; the report lists the identities of\n" +
+			"released environments for 'zrok2 admin delete identity') and no notifications (dynamic frontends drop\n" +
+			"removed mappings at their next reconciliation).",
+		Args: cobra.ExactArgs(1),
+	}
+	command := &adminRepairStoreCommand{cmd: cmd}
+	cmd.Flags().BoolVar(&command.apply, "apply", false, "Repair the rows (default is a dry run)")
+	cmd.Flags().IntVar(&command.batch, "batch", controller.DefaultRepairStoreBatch, "Rows repaired per transaction")
+	cmd.Run = command.run
+	return command
+}
+
+func (c *adminRepairStoreCommand) run(_ *cobra.Command, args []string) {
+	cfg, err := config.LoadConfig(args[0])
+	if err != nil {
+		panic(err)
+	}
+	dl.Info(dd.MustInspect(cfg))
+	if err := controller.RepairStore(cfg, controller.RepairStoreOptions{Apply: c.apply, Batch: c.batch}); err != nil {
+		panic(err)
+	}
+}
```

**File**: `cmd/zrok2/deleteShare.go` (modified, +105/-9)
```diff
@@ -1,8 +1,14 @@
 package main
 
 import (
+	"sort"
+	"strings"
+
 	"github.com/michaelquigley/df/dl"
+	"github.com/openziti/zrok/v2/rest_client_zrok/metadata"
 	"github.com/openziti/zrok/v2/rest_client_zrok/share"
+	"github.com/openziti/zrok/v2/rest_model_zrok"
+	"github.com/openziti/zrok/v2/util"
 	"github.com/spf13/cobra"
 )
 
@@ -17,9 +23,12 @@ type deleteShareCommand struct {
 
 func newDeleteShareCommand() *deleteShareCommand {
 	cmd := &cobra.Command{
-		Use:   "share <shareToken>",
+		Use:   "share <shareToken|name>",
 		Short: "Delete a share",
-		Args:  cobra.ExactArgs(1),
+		Long: "Delete a share, given its share token or a name it holds. A name is given as <name>, " +
+			"<namespaceToken>:<name> or <name>.<namespaceName>; the qualified forms pick one namespace when the " +
+			"name is held in several.\n\n" + exitCodesHelp,
+		Args: cobra.ExactArgs(1),
 	}
 	command := &deleteShareCommand{cmd: cmd}
 	cmd.Flags().StringVar(&command.envZId, "envzid", "", "Override environment ziti identifier")
@@ -31,20 +40,107 @@ func (cmd *deleteShareCommand) run(_ *cobra.Command, args []string) {
 	env, auth := mustGetEnvironmentAuth()
 	zrok, err := env.Client()
 	if err != nil {
-		dl.Fatal(err)
+		exitWithFailure("unable to create zrok client", err)
 	}
 
-	req := share.NewUnshareParams()
-	req.Body.EnvZID = env.Environment().ZitiIdentity
-	if cmd.envZId != "" {
-		req.Body.EnvZID = cmd.envZId
+	sharesResp, err := zrok.Metadata.ListShares(metadata.NewListSharesParams(), auth)
+	if err != nil {
+		exitWithFailure("unable to list shares", err)
+	}
+	var names []*rest_model_zrok.Name
+	if !isShareToken(args[0], sharesResp.Payload.Shares) {
+		namesResp, err := zrok.Share.ListAllNames(share.NewListAllNamesParams(), auth)
+		if err != nil {
+			exitWithFailure("unable to list names", err)
+		}
+		names = namesResp.Payload
 	}
-	req.Body.ShareToken = args[0]
+	shrToken, err := resolveShareTokenOrName(args[0], sharesResp.Payload.Shares, names)
+	if err != nil {
+		exitWithFailure("unable to delete share", err)
+	}
+
+	req := share.NewUnshareParams()
+	req.Body.EnvZID = resolveUnshareEnvZId(args[0], shrToken, env.Environment().ZitiIdentity, cmd.envZId, sharesResp.Payload.Shares)
+	req.Body.ShareToken = shrToken
 
 	_, err = zrok.Share.Unshare(req, auth)
 	if err != nil {
-		dl.Fatal(err)
+		exitWithFailure("unable to delete share", err)
 	}
 
 	dl.Infof("deleted share '%v' from environment '%v'", req.Body.ShareToken, req.Body.EnvZID)
 }
+
+// resolveUnshareEnvZId picks the environment to unshare from: --envzid when given; for a share resolved
+// from a name, the environment that share lives in, which need not be the current one; otherwise the
+// current environment, as for a share token.
+func resolveUnshareEnvZId(arg, shrToken, currentEnvZId, overrideEnvZId string, shares []*rest_model_zrok.ShareSummary) string {
+	if overrideEnvZId != "" {
+		return overrideEnvZId
+	}
+	if arg != shrToken {
+		for _, shr := range shares {
+			if shr != nil && shr.ShareToken == shrToken && shr.EnvZID != "" {
+				return shr.EnvZID
+			}
+		}
+	}
+	return currentEnvZId
+}
+
+func isShareToken(arg string, shares []*rest_model_zrok.ShareSummary) bool {
+	for _, shr := range shares {
+		if shr != nil && shr.ShareToken == arg {
+			return true
+		}
+	}
+	return false
+}
+
+// resolveShareTokenOrName returns arg when it is one of the account's share tokens, and otherwise the token
+// of the live share holding the name arg. the names listing reports only live shares' tokens.
+func resolveShareTokenOrName(arg string, shares []*rest_model_zrok.ShareSummary, names []*rest_model_zrok.Name) (string, error) {
+	if isShareToken(arg, shares) {
+		return arg, nil
+	}
+
+	var matched []*rest_model_zrok.Name
+	for _, name := range names {
+		if name != nil && nameMatches(arg, name) {
+			matched = append(matched, name)
+		}
+	}
+	if len(matched) == 0 {
+		return "", newPermanentError("no share token or name '%v' found for this account", arg)
+	}
+
+	held := make(map[string][]string)
+	for _, name := range matched {
+		if name.ShareToken != "" {
+			held[name.ShareToken] = append(held[name.ShareToken], name.NamespaceToken+":"+name.Name)
+		}
+	}
+	switch len(held) {
+	case 0:
+		return "", newPermanentError("name '%v' is not held by a live share", arg)
+	case 1:
+		for shrToken := range held {
+			return shrToken, nil
+		}
+	}
+
+	var holders []string
+	for shrToken, qualified := range held {
+		holders = append(holders, "'"+strings.Join(qualified, "', '")+"' (share '"+shrToken+"')")
+	}
+	sort.Strings(holders)
+	return "", newPermanentError("name '%v' is held by more than one share: %v; qualify it as <namespaceToken>:<name>", arg, strings.Join(holders, ", "))
+}
+
+// nameMatches reports whether arg names name, as <name>, <namespaceToken>:<name> or <name>.<namespaceName>.
+func nameMatches(arg string, name *rest_model_zrok.Name) bool {
+	return arg == name.Name ||
+		arg == name.NamespaceToken+":"+name.Name ||
+		(name.NamespaceName != "" && arg
```

**File**: `cmd/zrok2/deleteShare_test.go` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+package main
+
+import (
+	"testing"
+
+	"github.com/openziti/zrok/v2/rest_model_zrok"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+var deleteShareFixtureShares = []*rest_model_zrok.ShareSummary{
+	{ShareToken: "abc123", EnvZID: "env-1"},
+	{ShareToken: "def456", EnvZID: "env-1"},
+	{ShareToken: "ghi789", EnvZID: "env-2"},
+}
+
+var deleteShareFixtureNames = []*rest_model_zrok.Name{
+	{Name: "myapp", NamespaceToken: "public", NamespaceName: "share.example.com", ShareToken: "abc123"},
+	{Name: "idle", NamespaceToken: "public", NamespaceName: "share.example.com", Reserved: true},
+	{Name: "twice", NamespaceToken: "public", NamespaceName: "share.example.com", ShareToken: "abc123"},
+	{Name: "twice", NamespaceToken: "internal", NamespaceName: "internal.example.com", ShareToken: "def456"},
+	{Name: "both", NamespaceToken: "public", NamespaceName: "share.example.com", ShareToken: "def456"},
+	{Name: "both", NamespaceToken: "internal", NamespaceName: "internal.example.com", ShareToken: "def456"},
+	{Name: "elsewhere", NamespaceToken: "public", NamespaceName: "share.example.com", ShareToken: "ghi789"},
+}
+
+func TestResolveShareTokenOrNameAcceptsShareToken(t *testing.T) {
+	shrToken, err := resolveShareTokenOrName("def456", deleteShareFixtureShares, nil)
+	require.NoError(t, err)
+	assert.Equal(t, "def456", shrToken)
+}
+
+func TestResolveShareTokenOrNameResolvesName(t *testing.T) {
+	for _, arg := range []string{"myapp", "public:myapp", "myapp.share.example.com"} {
+		shrToken, err := resolveShareTokenOrName(arg, deleteShareFixtureShares, deleteShareFixtureNames)
+		require.NoError(t, err, arg)
+		assert.Equal(t, "abc123", shrToken, arg)
+	}
+}
+
+func TestResolveShareTokenOrNameNameHeldInTwoNamespacesBySameShare(t *testing.T) {
+	shrToken, err := resolveShareTokenOrName("both", deleteShareFixtureShares, deleteShareFixtureNames)
+	require.NoError(t, err)
+	assert.Equal(t, "def456", shrToken)
+}
+
+func TestResolveShareTokenOrNameAmbiguousNameIsPermanent(t *testing.T) {
+	_, err := resolveShareTokenOrName("twice", deleteShareFixtureShares, deleteShareFixtureNames)
+	require.Error(t, err)
+	assert.Equal(t, exitPermanent, classifyFailure(err).exitCode)
+	assert.Contains(t, err.Error(), "'public:twice' (share 'abc123')")
+	assert.Contains(t, err.Error(), "'internal:twice' (share 'def456')")
+
+	shrToken, err := resolveShareTokenOrName("internal:twice", deleteShareFixtureShares, deleteShareFixtureNames)
+	require.NoError(t, err)
+	assert.Equal(t, "def456", shrToken)
+}
+
+func TestResolveShareTokenOrNameNameWithoutLiveShareIsPermanent(t *testing.T) {
+	_, err := resolveShareTokenOrName("idle", deleteShareFixtureShares, deleteShareFixtureNames)
+	require.Error(t, err)
+	assert.Equal(t, "name 'idle' is not held by a live share", err.Error())
+	assert.Equal(t, exitPermanent, classifyFailure(err).exitCode)
+}
+
+func TestResolveShareTokenOrNameUnknownIsPermanent(t *testing.T) {
+	_, err := resolveShareTokenOrName("nothing", deleteShareFixtureShares, deleteShareFixtureNames)
+	require.Error(t, err)
+	assert.Equal(t, "no share token or name 'nothing' found for this account", err.Error())
+	assert.Equal(t, exitPermanent, classifyFailure(err).exitCode)
+}
+
+func TestResolveUnshareEnvZIdUsesResolvedSharesEnvironmentForName(t *testing.T) {
+	shrToken, err := resolveShareTokenOrName("elsewhere", deleteShareFixtureShares, deleteShareFixtureNames)
+	require.NoError(t, err)
+	require.Equal(t, "ghi789", shrToken)
+	assert.Equal(t, "env-2", resolveUnshareEnvZId("elsewhere", shrToken, "env-1", "", deleteShareFixtureShares))
+}
+
+func TestResolveUnshareEnvZIdOverrideWinsForName(t *testing.T) {
+	assert.Equal(t, "env-override", resolveUnshareEnvZId("elsewhere", "ghi789", "env-1", "env-override", deleteShareFixtureShares))
+}
+
+func TestResolveUnshareEnvZIdUsesCurrentEnvironmentForToken(t *testing.T) {
+	assert.Equal(t, "env-1", resolveUnshareEnvZId("ghi789", "ghi789", "env-1", "", deleteShareFixtureShares))
+}
```

**File**: `cmd/zrok2/disable.go` (modified, +14/-3)
```diff
@@ -4,10 +4,10 @@ import (
 	"fmt"
 
 	httpTransport "github.com/go-openapi/runtime/client"
-	"github.com/michaelquigley/df/dl"
 	"github.com/openziti/zrok/v2/environment"
 	restEnvironment "github.com/openziti/zrok/v2/rest_client_zrok/environment"
 	"github.com/openziti/zrok/v2/tui"
+	"github.com/pkg/errors"
 	"github.com/spf13/cobra"
 )
 
@@ -23,7 +23,11 @@ func newDisableCommand() *disableCommand {
 	cmd := &cobra.Command{
 		Use:   "disable",
 		Short: "Disable (and clean up) the enabled zrok environment",
-		Args:  cobra.NoArgs,
+		Long: "Disable (and clean up) the enabled zrok environment. When the zrok controller does not complete the " +
+			"request, the local environment is kept: a busy or unreachable controller can be retried, and when the " +
+			"controller refuses the request and the environment no longer exists there, the local copy under " +
+			"'~/.zrok2' can be removed by hand.\n\n" + exitCodesHelp,
+		Args: cobra.NoArgs,
 	}
 	command := &disableCommand{cmd: cmd}
 	cmd.Run = command.run
@@ -56,7 +60,14 @@ func (cmd *disableCommand) run(_ *cobra.Command, _ []string) {
 
 	_, err = zrok.Environment.Disable(req, auth)
 	if err != nil {
-		dl.Warnf("share cleanup failed (%v); will clean up local environment", err)
+		// the local environment is kept on every failure, a 401 included: a revoked account token answers
+		// 401 as well as an environment the controller no longer knows, and only the user can tell which
+		var unauthorized *restEnvironment.DisableUnauthorized
+		if errors.As(err, &unauthorized) {
+			exitWithFailure("unable to disable environment; the zrok controller refused the request and the local environment is kept; "+
+				"if this environment no longer exists on the controller, the local copy under '~/.zrok2' can be removed by hand", err)
+		}
+		exitWithFailure("unable to disable environment; the local environment is kept", err)
 	}
 	if err := env.DeleteEnvironment(); err != nil {
 		if !panicInstead {
```

---

### Incident Patch 2: `c52ec292` (2026-10-07)
**Commit Message**: policy type from the response, not the filter; agent enrollment compensates; interstitial embed fixed

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -8,6 +8,12 @@ FEATURE: A new `zrok2 admin repair-store <configPath>` command releases the name
 
 FIX: A name whose share no longer exists is released automatically the next time it is used, instead of answering "already in use by another share" forever. When a name is held by a live share, the error now names that share and the `zrok2 delete share` command that releases it; tearing down a share now also releases its private accesses, and deleting an account releases its names.
 
+FIX: The embedded interstitial page is served again when no external interstitial file is configured; previously its file name was misspelled, so the frontend served an empty page (https://github.com/openziti/zrok/issues/1262).
+
+FIX: On OpenZiti 2.x, a bandwidth limit now removes a share's dial policy, disabling an environment and deleting a private access now withdraw a frontend's access, and agent unenroll now deletes the agent remote's dial and bind policies; previously none of these removed any policy there. OpenZiti 1.x behaves as before.
+
+FIX: A failed agent enrollment (`zrok2 agent enroll`) no longer leaves its OpenZiti service, service policies and service edge router policy behind; they are deleted when the enrollment cannot be recorded.
+
 ## v2.0.7
 
 FIX: `zrok2 admin gc` now decides which share an OpenZiti object belongs to by its `zrokShareToken` tag rather than its name, so it no longer deletes the bind, dial and service edge router policies of live shares; objects with no share token, such as agent-remote services and policies, are never touched. It now reads every object rather than the first page of ten of each kind. It is a dry run by default that prints what it would remove, grouped by share token, and deletes only with `--delete`. Orphaned objects younger than `--min-age` (default 24 hours) are skipped, so a share being created at the time of the run is not collected. Tearing down a share with more than ten OpenZiti objects of one kind, such as a share with many access dial policies, now removes all of them rather than the first ten.
```

**File**: `controller/agentEnroll.go` (modified, +27/-6)
```diff
@@ -4,17 +4,21 @@ import (
 	"fmt"
 
 	"github.com/go-openapi/runtime/middleware"
+	"github.com/jmoiron/sqlx"
 	"github.com/michaelquigley/df/dl"
 	"github.com/openziti/edge-api/rest_model"
 	"github.com/openziti/zrok/v2/controller/automation"
 	"github.com/openziti/zrok/v2/rest_model_zrok"
 	"github.com/openziti/zrok/v2/rest_server_zrok/operations/agent"
 )
 
-type agentEnrollHandler struct{}
+type agentEnrollHandler struct {
+	// commit is replaceable so a test can fail the commit after the ziti objects exist.
+	commit func(*sqlx.Tx) error
+}
 
 func newAgentEnrollHandler() *agentEnrollHandler {
-	return &agentEnrollHandler{}
+	return &agentEnrollHandler{commit: (*sqlx.Tx).Commit}
 }
 
 func (h *agentEnrollHandler) Handle(params agent.EnrollParams, principal *rest_model_zrok.Principal) middleware.Responder {
@@ -65,6 +69,16 @@ func (h *agentEnrollHandler) Handle(params agent.EnrollParams, principal *rest_m
 		return agent.NewEnrollInternalServerError()
 	}
 
+	// every ziti object created from here on is deleted by id unless the enrollment record commits
+	compensation := newZitiCompensation(compensatingAgentEnrollment, token)
+	compensation.add(zitiService, zId)
+	committed := false
+	defer func() {
+		if !committed {
+			compensation.run(ziti)
+		}
+	}()
+
 	// create bind policy for the service
 	bindPolicyName := env.ZId + "-" + token + "-bind"
 	bindOpts := &automation.ServicePolicyOptions{
@@ -77,10 +91,12 @@ func (h *agentEnrollHandler) Handle(params agent.EnrollParams, principal *rest_m
 		PolicyType:    rest_model.DialBindBind,
 		Semantic:      rest_model.SemanticAllOf,
 	}
-	if _, err := ziti.ServicePolicies.CreateBind(bindOpts); err != nil {
+	bindZId, err := ziti.ServicePolicies.CreateBind(bindOpts)
+	if err != nil {
 		dl.Errorf("error creating agent remoting bind policy for '%v' (%v): %v", env.ZId, principal.Email, err)
 		return agent.NewEnrollInternalServerError()
 	}
+	compensation.add(zitiServicePolicy, bindZId)
 
 	// create dial policy for the service
 	dialPolicyName := env.ZId + "-" + token + "-dial"
@@ -94,10 +110,12 @@ func (h *agentEnrollHandler) Handle(params agent.EnrollParams, principal *rest_m
 		PolicyType:    rest_model.DialBindDial,
 		Semantic:      rest_model.SemanticAllOf,
 	}
-	if _, err := ziti.ServicePolicies.CreateDial(dialOpts); err != nil {
+	dialZId, err := ziti.ServicePolicies.CreateDial(dialOpts)
+	if err != nil {
 		dl.Errorf("error creating agent remoting dial policy for '%v' (%v): %v", env.ZId, principal.Email, err)
 		return agent.NewEnrollInternalServerError()
 	}
+	compensation.add(zitiServicePolicy, dialZId)
 
 	// create service edge router policy
 	serpOpts := &automation.ServiceEdgeRouterPolicyOptions{
@@ -109,20 +127,23 @@ func (h *agentEnrollHandler) Handle(params agent.EnrollParams, principal *rest_m
 		EdgeRouterRoles: []string{"#all"},
 		Semantic:        rest_model.SemanticAllOf,
 	}
-	if _, err := ziti.ServiceEdgeRouterPolicies.Create(serpOpts); err != nil {
+	serpZId, err := ziti.ServiceEdgeRouterPolicies.Create(serpOpts)
+	if err != nil {
 		dl.Errorf("error creating agent remoting serp for '%v' (%v): %v", env.ZId, principal.Email, err)
 		return agent.NewEnrollInternalServerError()
 	}
+	compensation.add(zitiServiceEdgeRouterPolicy, serpZId)
 
 	if _, err := str.CreateAgentEnrollment(env.Id, token, trx); err != nil {
 		dl.Errorf("error storing agent enrollment for '%v' (%v): %v", env.ZId, principal.Email, err)
 		return agent.NewEnrollInternalServerError()
 	}
 
-	if err := trx.Commit(); err != nil {
+	if err := h.commit(trx); err != nil {
 		dl.Errorf("error committing agent enrollment record for '%v' (%v): %v", env.ZId, principal.Email, err)
 		return agent.NewEnrollInternalServerError()
 	}
+	committed = true
 
 	return agent.NewEnrollOK().WithPayload(&agent.EnrollOKBody{Token: token})
 }
```

**File**: `controller/agentEnroll_test.go` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+package controller
+
+import (
+	"errors"
+	"slices"
+	"testing"
+
+	"github.com/jmoiron/sqlx"
+	"github.com/openziti/zrok/v2/controller/agentController"
+	"github.com/openziti/zrok/v2/rest_server_zrok/operations/agent"
+	"github.com/stretchr/testify/require"
+)
+
+func (f *shareCreateFixture) enrollAgent(h *agentEnrollHandler) interface{} {
+	cfg.AgentController = &agentController.Config{ZId: "agent-controller-zid"}
+	return h.Handle(agent.EnrollParams{Body: agent.EnrollBody{EnvZID: "env-zid"}}, f.principal)
+}
+
+func (f *shareCreateFixture) agentEnrolled(t *testing.T) bool {
+	t.Helper()
+	envId := f.fixtureEnvironmentId(t)
+	trx, err := str.Begin()
+	require.NoError(t, err)
+	defer func() { _ = trx.Rollback() }()
+	enrolled, err := str.IsAgentEnrolledForEnvironment(envId, trx)
+	require.NoError(t, err)
+	return enrolled
+}
+
+func TestAgentEnrollCommitFailureCompensates(t *testing.T) {
+	f := setupShareCreateFixture(t)
+	h := newAgentEnrollHandler()
+	h.commit = func(*sqlx.Tx) error { return errors.New("commit failed") }
+
+	resp := f.enrollAgent(h)
+
+	require.IsType(t, &agent.EnrollInternalServerError{}, resp)
+	created, deleted := f.fake.Log()
+	require.Len(t, created, 4)
+	slices.Reverse(created)
+	require.Equal(t, created, deleted)
+	require.False(t, f.agentEnrolled(t))
+	require.Contains(t, f.logs.String(), "compensated failed agent enrollment")
+}
+
+func TestAgentEnrollSuccessKeepsObjects(t *testing.T) {
+	f := setupShareCreateFixture(t)
+
+	resp := f.enrollAgent(newAgentEnrollHandler())
+
+	require.IsType(t, &agent.EnrollOK{}, resp)
+	created, deleted := f.fake.Log()
+	require.Len(t, created, 4)
+	require.Empty(t, deleted)
+	require.True(t, f.agentEnrolled(t))
+}
```

**File**: `controller/agentUnenroll.go` (modified, +4/-4)
```diff
@@ -5,6 +5,7 @@ import (
 
 	"github.com/go-openapi/runtime/middleware"
 	"github.com/michaelquigley/df/dl"
+	"github.com/openziti/edge-api/rest_model"
 	"github.com/openziti/zrok/v2/controller/automation"
 	"github.com/openziti/zrok/v2/rest_model_zrok"
 	"github.com/openziti/zrok/v2/rest_server_zrok/operations/agent"
@@ -51,15 +52,14 @@ func (h *agentUnenrollHandler) Handle(params agent.UnenrollParams, principal *re
 	}
 
 	// delete dial service policies for agent remote
-	dialFilter := fmt.Sprintf("tags.zrokAgentRemote=\"%v\" and type=1", ae.Token)
-	if err := ziti.ServicePolicies.DeleteWithFilter(dialFilter); err != nil {
+	policyFilter := automation.BuildTagFilter("zrokAgentRemote", ae.Token)
+	if err := ziti.ServicePolicies.DeleteByTagAndType(policyFilter, rest_model.DialBindDial); err != nil {
 		dl.Errorf("error removing agent remote dial service policy for '%v' (%v): %v", env.ZId, principal.Email, err)
 		return agent.NewUnenrollInternalServerError()
 	}
 
 	// delete bind service policies for agent remote
-	bindFilter := fmt.Sprintf("tags.zrokAgentRemote=\"%v\" and type=2", ae.Token)
-	if err := ziti.ServicePolicies.DeleteWithFilter(bindFilter); err != nil {
+	if err := ziti.ServicePolicies.DeleteByTagAndType(policyFilter, rest_model.DialBindBind); err != nil {
 		dl.Errorf("error removing agent remote bind service policy for '%v' (%v): %v", env.ZId, principal.Email, err)
 		return agent.NewUnenrollInternalServerError()
 	}
```

**File**: `controller/automation/servicePolicy.go` (modified, +27/-0)
```diff
@@ -4,6 +4,7 @@ import (
 	"github.com/michaelquigley/df/dl"
 	"github.com/openziti/edge-api/rest_management_api_client/service_policy"
 	"github.com/openziti/edge-api/rest_model"
+	"github.com/pkg/errors"
 )
 
 type ServicePolicyManager struct {
@@ -95,6 +96,32 @@ func (spm *ServicePolicyManager) DeleteWithFilter(filter string) error {
 	return DeleteWithFilter(spm.Find, spm.Delete, filter, "service policy")
 }
 
+// DeleteByTagAndType deletes the service policies matching tagFilter whose type is t. the type is read
+// from each listed policy, never put in the filter: ziti 1.x accepts the integer type in a filter, but
+// 2.x matches nothing with it, so a filter naming the type would silently delete nothing there. every
+// match is listed before the first delete, and a policy that vanished before its delete is skipped.
+func (spm *ServicePolicyManager) DeleteByTagAndType(tagFilter string, t rest_model.DialBind) error {
+	policies, err := FindAll(spm.Find, tagFilter, MaxPageSize)
+	if err != nil {
+		return errors.Wrapf(err, "error finding %v service policies for deletion", t)
+	}
+	for _, policy := range policies {
+		if policy.Type == nil || *policy.Type != t {
+			continue
+		}
+		if err := spm.Delete(*policy.ID); err != nil {
+			// an object that vanished between the listing and its delete is already where we want it.
+			if IsNotFound(err) {
+				dl.Debugf("service policy '%s' already deleted", *policy.ID)
+				continue
+			}
+			// Delete already names the policy.
+			return err
+		}
+	}
+	return nil
+}
+
 // convenience methods for specific policy types
 func (spm *ServicePolicyManager) CreateBind(opts *ServicePolicyOptions) (string, error) {
 	opts.PolicyType = rest_model.DialBindBind
```

**File**: `controller/automation/servicePolicy_test.go` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+package automation
+
+import (
+	"testing"
+
+	"github.com/openziti/edge-api/rest_model"
+	"github.com/openziti/zrok/v2/controller/automation/zitifake"
+	"github.com/stretchr/testify/require"
+)
+
+// typedPolicyFixture holds a dial and a bind policy for share 'one', and a dial policy for share 'two'.
+func typedPolicyFixture(t *testing.T, integerTypeMatchesNothing bool) (*zitifake.Server, *ZitiAutomation) {
+	t.Helper()
+	fake := zitifake.New()
+	t.Cleanup(fake.Close)
+	fake.IntegerTypeMatchesNothing(integerTypeMatchesNothing)
+	fake.SeedPolicyWithID("one-dial", "one-dial", ZrokShareTags("one").ToRestModel(), rest_model.DialBindDial)
+	fake.SeedPolicyWithID("one-bind", "one-bind", ZrokShareTags("one").ToRestModel(), rest_model.DialBindBind)
+	fake.SeedPolicyWithID("two-dial", "two-dial", ZrokShareTags("two").ToRestModel(), rest_model.DialBindDial)
+	return fake, NewZitiAutomationWithEdge(fake.Edge())
+}
+
+func TestDeleteByTagAndTypeSelectsByResponseType(t *testing.T) {
+	for _, gen := range zitifake.Generations {
+		t.Run(gen.Name, func(t *testing.T) {
+			fake, ziti := typedPolicyFixture(t, gen.IntegerTypeMatchesNothing)
+
+			require.NoError(t, ziti.ServicePolicies.DeleteByTagAndType(BuildTagFilter("zrokShareToken", "one"), rest_model.DialBindDial))
+
+			_, deleted := fake.Log()
+			require.Equal(t, []string{zitifake.ServicePolicies + "/one-dial"}, deleted)
+
+			require.NoError(t, ziti.ServicePolicies.DeleteByTagAndType(BuildTagFilter("zrokShareToken", "one"), rest_model.DialBindBind))
+
+			_, deleted = fake.Log()
+			require.Equal(t, []string{zitifake.ServicePolicies + "/one-dial", zitifake.ServicePolicies + "/one-bind"}, deleted)
+			require.True(t, fake.Has(zitifake.ServicePolicies, "two-dial"))
+		})
+	}
+}
+
+func TestDeleteByTagAndTypeContinuesPastVanished(t *testing.T) {
+	fake, ziti := typedPolicyFixture(t, false)
+	fake.SeedPolicyWithID("one-dial-second", "one-dial-second", ZrokShareTags("one").ToRestModel(), rest_model.DialBindDial)
+	// the first dial policy disappears between the listing and its delete.
+	fake.VanishBeforeDelete(zitifake.ServicePolicies, "one-dial")
+
+	require.NoError(t, ziti.ServicePolicies.DeleteByTagAndType(BuildTagFilter("zrokShareToken", "one"), rest_model.DialBindDial))
+
+	_, deleted := fake.Log()
+	require.Equal(t, []string{zitifake.ServicePolicies + "/one-dial-second"}, deleted)
+	require.False(t, fake.Has(zitifake.ServicePolicies, "one-dial"))
+	require.True(t, fake.Has(zitifake.ServicePolicies, "one-bind"))
+}
+
+func TestDeleteByTagAndTypePropagatesOtherErrors(t *testing.T) {
+	fake, ziti := typedPolicyFixture(t, false)
+	fake.RejectDeletes(zitifake.ServicePolicies, true)
+
+	err := ziti.ServicePolicies.DeleteByTagAndType(BuildTagFilter("zrokShareToken", "one"), rest_model.DialBindDial)
+
+	require.ErrorContains(t, err, "status 500")
+	require.False(t, IsNotFound(err))
+	require.True(t, fake.Has(zitifake.ServicePolicies, "one-dial"))
+}
```

**File**: `controller/automation/zitifake/fake.go` (modified, +47/-3)
```diff
@@ -75,6 +75,8 @@ type Server struct {
 	rateLimitDeletes               map[string]bool
 	rateLimitAuthentications       int
 	authDelay                      time.Duration
+	integerTypeMatchesNothing      bool
+	vanishBeforeDelete             map[string]bool
 }
 
 func New() *Server {
@@ -99,7 +101,7 @@ func newServer(username, password string) *Server {
 	for _, kind := range []string{Configs, Services, ServicePolicies, ServiceEdgeRouterPolicies, Identities, EdgeRouterPolicies} {
 		objects[kind] = make(map[string]*object)
 	}
-	return &Server{objects: objects, sessions: make(map[string]bool), rejectDeletes: make(map[string]bool), rejectCreates: make(map[string]bool), rateLimitCreates: make(map[string]bool), rateLimitDeletes: make(map[string]bool), username: username, password: password}
+	return &Server{objects: objects, sessions: make(map[string]bool), rejectDeletes: make(map[string]bool), rejectCreates: make(map[string]bool), rateLimitCreates: make(map[string]bool), rateLimitDeletes: make(map[string]bool), vanishBeforeDelete: make(map[string]bool), username: username, password: password}
 }
 
 func (f *Server) Edge() *rest_management_api_client.ZitiEdgeManagement {
@@ -131,6 +133,32 @@ func (f *Server) RejectOperations(reject bool) {
 	f.rejectOperations = reject
 }
 
+// Generations are the two filter behaviours a test of policy selection runs under: ziti 1.x, where an
+// integer type clause selects dial or bind policies, and 2.x, where it matches nothing.
+var Generations = []struct {
+	Name                      string
+	IntegerTypeMatchesNothing bool
+}{
+	{"ziti-1.x", false},
+	{"ziti-2.x", true},
+}
+
+// IntegerTypeMatchesNothing makes a 'type=1' or 'type=2' filter clause match nothing, as ziti 2.x
+// does; ziti 1.x, and the fake by default, select dial and bind service policies with them.
+func (f *Server) IntegerTypeMatchesNothing(nothing bool) {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	f.integerTypeMatchesNothing = nothing
+}
+
+// VanishBeforeDelete removes the object of kind with id when its delete arrives, so the delete finds
+// it already gone, as when another request deletes it between a listing and the delete.
+func (f *Server) VanishBeforeDelete(kind, id string) {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	f.vanishBeforeDelete[kind+"/"+id] = true
+}
+
 // RejectDeletes answers every delete of kind with an internal server error.
 func (f *Server) RejectDeletes(kind string, reject bool) {
 	f.mu.Lock()
@@ -229,6 +257,16 @@ func (f *Server) Has(kind, id string) bool {
 	return f.objects[kind][id] != nil
 }
 
+// SeedPolicyWithID inserts a service policy of type t under a caller-chosen id, without counting it as
+// a create. it takes the fake's lock, so it is called from a test rather than a BeforeCreate hook.
+func (f *Server) SeedPolicyWithID(id, name string, tags *rest_model.Tags, t rest_model.DialBind) {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	f.seed(ServicePolicies, id, name, tags)
+	obj := f.objects[ServicePolicies][id]
+	*obj.dial = t
+}
+
 func (f *Server) seed(kind, id, name string, tags *rest_model.Tags) {
 	obj := &object{name: name, tags: tags}
 	switch kind {
@@ -525,7 +563,7 @@ func (f *Server) list(w http.ResponseWriter, r *http.Request, kind string) {
 	var matched []*object
 	for _, id := range ids {
 		obj := f.objects[kind][id]
-		if match(filter, id, obj.name, obj.tags, obj.dial) {
+		if match(filter, id, obj.name, obj.tags, obj.dial, f.integerTypeMatchesNothing) {
 			matched = append(matched, obj)
 		}
 	}
@@ -586,6 +624,10 @@ func (f *Server) delete(w http.ResponseWriter, kind, id string) {
 		writeError(w, http.StatusInternalServerError, labels[kind].noun+" delete rejected: "+id)
 		return
 	}
+	if f.vanishBeforeDelete[kind+"/"+id] {
+		delete(f.vanishBeforeDelete, kind+"/"+id)
+		delete(f.objects[kind], id)
+	}
 	if f.objects[kind][id] == nil {
 		writeError(w, 404, labels[kind].noun+" not found: "+id)
 		return
@@ -608,7 +650,7 @@ func (f *Server) delete(w http.ResponseWriter, kind, id string) {
 	}{Meta: &rest_model.Meta{}})
 }
 
-func match(filter, id, name string, tags *rest_model.Tags, kind *rest_model.DialBind) bool {
+func match(filter, id, name string, tags *rest_model.Tags, kind *rest_model.DialBind, integerTypeMatchesNothing bool) bool {
 	if filter == "" {
 		return true
 	}
@@ -633,6 +675,8 @@ func match(filter, id, name string, tags *rest_model.Tags, kind *rest_model.Dial
 			if !ok || tags == nil || fmt.Sprint(tags.SubTags[key]) != strings.Trim(value, `"`) {
 				return false
 			}
+		case (clause == "type=1" || clause == "type=2") && integerTypeMatchesNothing:
+			return false
 		case clause == "type=1":
 			if kind == nil || *kind != rest_model.DialBindDial {
 				return false
```

**File**: `controller/automation/zitifake/fake_test.go` (modified, +22/-0)
```diff
@@ -79,3 +79,25 @@ func TestDeleteWithFilterReadsEveryPage(t *testing.T) {
 	require.Len(t, deleted, 25)
 	require.True(t, fake.Has(ServicePolicies, "other"))
 }
+
+func TestIntegerTypeMatchesNothing(t *testing.T) {
+	fake := New()
+	defer fake.Close()
+	ziti := automation.NewZitiAutomationWithEdge(fake.Edge())
+	tags := automation.ZrokShareTags("share-one").ToRestModel()
+	fake.SeedPolicyWithID("dial", "dial", tags, rest_model.DialBindDial)
+	fake.SeedPolicyWithID("bind", "bind", tags, rest_model.DialBindBind)
+	find := func(filter string) int {
+		items, err := ziti.ServicePolicies.Find(&automation.FilterOptions{Filter: filter})
+		require.NoError(t, err, filter)
+		return len(items)
+	}
+
+	require.Equal(t, 1, find(`tags.zrokShareToken="share-one" and type=1`))
+	require.Equal(t, 1, find(`tags.zrokShareToken="share-one" and type=2`))
+
+	fake.IntegerTypeMatchesNothing(true)
+	require.Zero(t, find(`tags.zrokShareToken="share-one" and type=1`))
+	require.Zero(t, find(`tags.zrokShareToken="share-one" and type=2`))
+	require.Equal(t, 2, find(`tags.zrokShareToken="share-one"`))
+}
```

---

### Incident Patch 3: `a39b8366` (2026-10-07)
**Commit Message**: ui dependency updates

**File**: `agent/agentUi/package-lock.json` (modified, +211/-408)
```diff
@@ -891,9 +891,9 @@
       }
     },
     "node_modules/@eslint-community/eslint-utils": {
-      "version": "4.4.1",
-      "resolved": "https://registry.npmjs.org/@eslint-community/eslint-utils/-/eslint-utils-4.4.1.tgz",
-      "integrity": "sha512-s3O3waFUrMV8P/XaF/+ZTp1X9XBZW1a4B97ZnjQF2KYWaFD2A8KyFBsrsfSjEmjn3RGWAIuvlneuZm3CUK3jbA==",
+      "version": "4.10.1",
+      "resolved": "https://registry.npmjs.org/@eslint-community/eslint-utils/-/eslint-utils-4.10.1.tgz",
+      "integrity": "sha512-cuadcxVFE8sDK6iWJbs8Sn0av2Nrh2QSGQhVlBW9AaAHqHwjWsZHT8LJ4hFGPh7ASBV2deFdM7H/DPjulmh8rg==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -923,9 +923,9 @@
       }
     },
     "node_modules/@eslint-community/regexpp": {
-      "version": "4.12.1",
-      "resolved": "https://registry.npmjs.org/@eslint-community/regexpp/-/regexpp-4.12.1.tgz",
-      "integrity": "sha512-CCZCDJuduB9OUkFkY2IgppNZMi2lBQgD2qzwXkEia16cge2pijY/aXi96CJMquDMn3nJdlPV1A5KrJEXwfLNzQ==",
+      "version": "4.12.2",
+      "resolved": "https://registry.npmjs.org/@eslint-community/regexpp/-/regexpp-4.12.2.tgz",
+      "integrity": "sha512-EriSTlt5OC9/7SXkRSCAhfSxxoSUgBm33OH+IkwbdpgoqsSsUg7y3uh+IICI/Qg4BBWr3U2i39RpmycbxMq4ew==",
       "dev": true,
       "license": "MIT",
       "engines": {
@@ -1386,44 +1386,6 @@
         }
       }
     },
-    "node_modules/@nodelib/fs.scandir": {
-      "version": "2.1.5",
-      "resolved": "https://registry.npmjs.org/@nodelib/fs.scandir/-/fs.scandir-2.1.5.tgz",
-      "integrity": "sha512-vq24Bq3ym5HEQm2NKCr3yXDwjc7vTsEThRDnkp2DK9p1uqLR+DHurm/NOTo0KG7HYHU7eppKZj3MyqYuMBf62g==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "@nodelib/fs.stat": "2.0.5",
-        "run-parallel": "^1.1.9"
-      },
-      "engines": {
-        "node": ">= 8"
-      }
-    },
-    "node_modules/@nodelib/fs.stat": {
-      "version": "2.0.5",
-      "resolved": "https://registry.npmjs.org/@nodelib/fs.stat/-/fs.stat-2.0.5.tgz",
-      "integrity": "sha512-RkhPPp2zrqDAQA/2jNhnztcPAlv64XdhIp7a7454A5ovI7Bukxgt7MX7udwAu3zg1DcpPU0rz3VV1SeaqvY4+A==",
-      "dev": true,
-      "license": "MIT",
-      "engines": {
-        "node": ">= 8"
-      }
-    },
-    "node_modules/@nodelib/fs.walk": {
-      "version": "1.2.8",
-      "resolved": "https://registry.npmjs.org/@nodelib/fs.walk/-/fs.walk-1.2.8.tgz",
-      "integrity": "sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "@nodelib/fs.scandir": "2.1.5",
-        "fastq": "^1.6.0"
-      },
-      "engines": {
-        "node": ">= 8"
-      }
-    },
     "node_modules/@popperjs/core": {
       "version": "2.11.8",
       "resolved": "https://registry.npmjs.org/@popperjs/core/-/core-2.11.8.tgz",
@@ -1895,21 +1857,20 @@
       }
     },
     "node_modules/@typescript-eslint/eslint-plugin": {
-      "version": "8.15.0",
-      "resolved": "https://registry.npmjs.org/@typescript-eslint/eslint-plugin/-/eslint-plugin-8.15.0.tgz",
-      "integrity": "sha512-+zkm9AR1Ds9uLWN3fkoeXgFppaQ+uEVtfOV62dDmsy9QCNqlRHWNEck4yarvRNrvRcHQLGfqBNui3cimoz8XAg==",
+      "version": "8.71.1",
+      "resolved": "https://registry.npmjs.org/@typescript-eslint/eslint-plugin/-/eslint-plugin-8.71.1.tgz",
+      "integrity": "sha512-nNlBf6HuotqMgZvSkWD5hNdemiBIxQ2NmrlgfcUIeZRs+BbakjscCQRq/Hb74EFVnFiSWWdL12JruqwBy3ERDw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@eslint-community/regexpp": "^4.10.0",
-        "@typescript-eslint/scope-manager": "8.15.0",
-        "@typescript-eslint/type-utils": "8.15.0",
-        "@typescript-eslint/utils": "8.15.0",
-        "@typescript-eslint/visitor-keys": "8.15.0",
-        "graphemer": "^1.4.0",
-        "ignore": "^5.3.1",
+        "@eslint-community/regexpp": "^4.12.2",
+        "@typescript-eslint/scope-manager": "8.71.1",
+        "@typescript-eslint/type-utils": "8.71.1",
+        "@typescript-eslint/utils": "8.71.1",
+        "@typescript-eslint/visitor-keys": "8.71.1",
+        "ignore": "^7.0.5",
         "natural-compare": "^1.4.0",
-        "ts-api-utils": "^1.3.0"
+        "ts-api-utils": "^2.5.0"
       },
       "engines": {
         "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
@@ -1919,27 +1880,33 @@
         "url": "https://opencollective.com/typescript-eslint"
       },
       "peerDependencies": {
-        "@typescript-eslint/parser": "^8.0.0 || ^8.0.0-alpha.0",
-        "eslint": "^8.57.0 || ^9.0.0"
-      },
-      "peerDependenciesMeta": {
-        "typescript": {
-          "optional": true
-        }
+        "@typescript-eslint/parser": "^8.71.1",
+        "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0",
+        "typescript": ">=4.8.4 <6.1.0"
+      }
+    },
+    "node_modules/@typescript-eslint/eslint-plugin/node_modules/ignore": {
+      "version": "7.0.12",
+      "resolved": "https://registry.npmjs.org/ignore/-/ignore-7.0.12.tgz",
+
```

**File**: `ui/package-lock.json` (modified, +211/-408)
```diff
@@ -902,9 +902,9 @@
       }
     },
     "node_modules/@eslint-community/eslint-utils": {
-      "version": "4.4.1",
-      "resolved": "https://registry.npmjs.org/@eslint-community/eslint-utils/-/eslint-utils-4.4.1.tgz",
-      "integrity": "sha512-s3O3waFUrMV8P/XaF/+ZTp1X9XBZW1a4B97ZnjQF2KYWaFD2A8KyFBsrsfSjEmjn3RGWAIuvlneuZm3CUK3jbA==",
+      "version": "4.10.1",
+      "resolved": "https://registry.npmjs.org/@eslint-community/eslint-utils/-/eslint-utils-4.10.1.tgz",
+      "integrity": "sha512-cuadcxVFE8sDK6iWJbs8Sn0av2Nrh2QSGQhVlBW9AaAHqHwjWsZHT8LJ4hFGPh7ASBV2deFdM7H/DPjulmh8rg==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -934,9 +934,9 @@
       }
     },
     "node_modules/@eslint-community/regexpp": {
-      "version": "4.12.1",
-      "resolved": "https://registry.npmjs.org/@eslint-community/regexpp/-/regexpp-4.12.1.tgz",
-      "integrity": "sha512-CCZCDJuduB9OUkFkY2IgppNZMi2lBQgD2qzwXkEia16cge2pijY/aXi96CJMquDMn3nJdlPV1A5KrJEXwfLNzQ==",
+      "version": "4.12.2",
+      "resolved": "https://registry.npmjs.org/@eslint-community/regexpp/-/regexpp-4.12.2.tgz",
+      "integrity": "sha512-EriSTlt5OC9/7SXkRSCAhfSxxoSUgBm33OH+IkwbdpgoqsSsUg7y3uh+IICI/Qg4BBWr3U2i39RpmycbxMq4ew==",
       "dev": true,
       "license": "MIT",
       "engines": {
@@ -1563,44 +1563,6 @@
         "react": "^17.0.0 || ^18.0.0 || ^19.0.0"
       }
     },
-    "node_modules/@nodelib/fs.scandir": {
-      "version": "2.1.5",
-      "resolved": "https://registry.npmjs.org/@nodelib/fs.scandir/-/fs.scandir-2.1.5.tgz",
-      "integrity": "sha512-vq24Bq3ym5HEQm2NKCr3yXDwjc7vTsEThRDnkp2DK9p1uqLR+DHurm/NOTo0KG7HYHU7eppKZj3MyqYuMBf62g==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "@nodelib/fs.stat": "2.0.5",
-        "run-parallel": "^1.1.9"
-      },
-      "engines": {
-        "node": ">= 8"
-      }
-    },
-    "node_modules/@nodelib/fs.stat": {
-      "version": "2.0.5",
-      "resolved": "https://registry.npmjs.org/@nodelib/fs.stat/-/fs.stat-2.0.5.tgz",
-      "integrity": "sha512-RkhPPp2zrqDAQA/2jNhnztcPAlv64XdhIp7a7454A5ovI7Bukxgt7MX7udwAu3zg1DcpPU0rz3VV1SeaqvY4+A==",
-      "dev": true,
-      "license": "MIT",
-      "engines": {
-        "node": ">= 8"
-      }
-    },
-    "node_modules/@nodelib/fs.walk": {
-      "version": "1.2.8",
-      "resolved": "https://registry.npmjs.org/@nodelib/fs.walk/-/fs.walk-1.2.8.tgz",
-      "integrity": "sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "@nodelib/fs.scandir": "2.1.5",
-        "fastq": "^1.6.0"
-      },
-      "engines": {
-        "node": ">= 8"
-      }
-    },
     "node_modules/@popperjs/core": {
       "version": "2.11.8",
       "resolved": "https://registry.npmjs.org/@popperjs/core/-/core-2.11.8.tgz",
@@ -2329,21 +2291,20 @@
       "license": "MIT"
     },
     "node_modules/@typescript-eslint/eslint-plugin": {
-      "version": "8.15.0",
-      "resolved": "https://registry.npmjs.org/@typescript-eslint/eslint-plugin/-/eslint-plugin-8.15.0.tgz",
-      "integrity": "sha512-+zkm9AR1Ds9uLWN3fkoeXgFppaQ+uEVtfOV62dDmsy9QCNqlRHWNEck4yarvRNrvRcHQLGfqBNui3cimoz8XAg==",
+      "version": "8.71.1",
+      "resolved": "https://registry.npmjs.org/@typescript-eslint/eslint-plugin/-/eslint-plugin-8.71.1.tgz",
+      "integrity": "sha512-nNlBf6HuotqMgZvSkWD5hNdemiBIxQ2NmrlgfcUIeZRs+BbakjscCQRq/Hb74EFVnFiSWWdL12JruqwBy3ERDw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@eslint-community/regexpp": "^4.10.0",
-        "@typescript-eslint/scope-manager": "8.15.0",
-        "@typescript-eslint/type-utils": "8.15.0",
-        "@typescript-eslint/utils": "8.15.0",
-        "@typescript-eslint/visitor-keys": "8.15.0",
-        "graphemer": "^1.4.0",
-        "ignore": "^5.3.1",
+        "@eslint-community/regexpp": "^4.12.2",
+        "@typescript-eslint/scope-manager": "8.71.1",
+        "@typescript-eslint/type-utils": "8.71.1",
+        "@typescript-eslint/utils": "8.71.1",
+        "@typescript-eslint/visitor-keys": "8.71.1",
+        "ignore": "^7.0.5",
         "natural-compare": "^1.4.0",
-        "ts-api-utils": "^1.3.0"
+        "ts-api-utils": "^2.5.0"
       },
       "engines": {
         "node": "^18.18.0 || ^20.9.0 || >=21.1.0"
@@ -2353,27 +2314,33 @@
         "url": "https://opencollective.com/typescript-eslint"
       },
       "peerDependencies": {
-        "@typescript-eslint/parser": "^8.0.0 || ^8.0.0-alpha.0",
-        "eslint": "^8.57.0 || ^9.0.0"
-      },
-      "peerDependenciesMeta": {
-        "typescript": {
-          "optional": true
-        }
+        "@typescript-eslint/parser": "^8.71.1",
+        "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0",
+        "typescript": ">=4.8.4 <6.1.0"
+      }
+    },
+    "node_modules/@typescript-eslint/eslint-plugin/node_modules/ignore": {
+      "version": "7.0.12",
+      "resolved": "htt
```

#### Recent Merged Pull Requests:
- **PR #1284** (2026-10-08): fall-fixes-208 (@michaelquigley)
- **PR #1283** (2026-10-03): rate limiting is counted and answered with 503; access and enable compensate (@michaelquigley)
- **PR #1282** (2026-10-02): relax rebuilds v2 public share dial policies; repair-dial-policies; influx query deadline (@michaelquigley)
- **PR #1281** (2026-10-02): garbage collection improvements (@michaelquigley)
- **PR #1280** (2026-09-29): fall-fixes-s9 (@michaelquigley)
- **PR #1279** (2026-09-29): one improved teardown path; notification sequencing improvements (@michaelquigley)

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

## X. Merge pull request #1284 from openziti/fall-fixes-208

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in openziti/zrok. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `09ed814e`: Merge pull request #1284 from openziti/fall-fixes-208. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
## v2.0.8

CHANGE: **Share and access commands exit with status 2, not 1, when the controller refuses the request.** `zrok2 share public`, `zrok2 share private` and `zrok2 access private` exit 2 for a refusal a retry cannot change (such as a name held by another share, now named in the message) and 1 for a failure a retry may fix (the controller unreachable, busy or failing; a busy controller says how many seconds to wait). Scripts that test for status 1 must also accept 2; a supervisor can stop restarting on 2, for example with systemd's `RestartPreventExitStatus=2`.

CHANGE: **Admin repair commands no longer migrate the store.** `zrok2 admin gc`, `zrok2 admin repair-dial-policies` and `zrok2 admin repair-store` open the store without migrating it, so a dry run never changes the database; run `zrok2 admin migrate` or start the controller first when the schema is behind the binary.

FEATURE: `zrok2 admin repair-store <configPath>` releases what earlier versions left behind: names and frontend mappings still attached to deleted shares, stranded environments, shares, accesses and names. It is a dry run by default that counts and samples what it would repair, and repairs in small batc
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `09ed814e` are properly handled with clean fallback behavior.
