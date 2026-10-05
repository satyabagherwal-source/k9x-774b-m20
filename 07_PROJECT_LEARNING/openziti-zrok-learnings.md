# Forensic Learning Record (Deep Inspection): openziti/zrok

> **Canonical Artifact**: `07_PROJECT_LEARNING/openziti-zrok-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/openziti/zrok](https://github.com/openziti/zrok))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:14:23.431Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `openziti/zrok`
- **Description**: Secure internet sharing made simple.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 4762 stars

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
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/go-openapi/runtime"
	httptransport "github.com/go-openapi/runtime/client"
	"github.com/openziti/zrok/v2/agent/agentClient"
	"github.com/openziti/zrok/v2/cmd/zrok2/subordinate"
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

func subordinateError(err error) {
	msg := make(map[string]interface{})
	msg[subordinate.MessageKey] = subordinate.ErrorMessage
	msg[subordinate.ErrorMessage] = err.Error()
	if data, err := json.Marshal(msg); err == nil {
		fmt.Println(string(data))
	} else {
		fmt.Println("{\"" + subordinate.MessageKey + "\":\"" + subordinate.ErrorMessage + "\",\"" + subordinate.ErrorMessage + "\":\"internal error\"}")
	}
	os.Exit(1)
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
func buildFrontendEndpointsForShare(shareId int, shareToken string, deprecatedEndpoint *string, trx *sqlx.Tx) []string {
	// retrieve names for this share using the new mapping table
	shareNames, err := str.FindNamesForShare(shareId, trx)
	if err != nil {
		dl.Errorf("error finding names for share '%v': %v", shareToken, err)
		// continue without failing the entire request
		shareNames = []*store.NameWithNamespace{}
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

	return frontendEndpoints
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

### Core Architecture Module: `util/duration.go`
```
package util

import (
	"fmt"
	"regexp"
	"strconv"
	"time"
)

// ParseDuration extends time.ParseDuration to support 'd' (days) as a unit.
// it converts days to hours (1d = 24h) before parsing.
// examples: "24h", "7d", "2d6h30m", "1d12h"
func ParseDuration(s string) (time.Duration, error) {
	if s == "" {
		return 0, fmt.Errorf("invalid duration: empty string")
	}

	// check for invalid patterns that might contain 'd' but shouldn't be processed
	// this catches cases like "-1d", "1.5d", ".5d" etc.
	invalidPattern := regexp.MustCompile(`[^\d\s](\d+)d|(\d*\.\d+)d`)
	if invalidPattern.MatchString(s) {
		// let time.ParseDuration handle these and return its error
		return time.ParseDuration(s)
	}

	// regex pattern to match digits followed by 'd' at word boundaries
	dayPattern := regexp.MustCompile(`(\d+)d`)

	// find all day values and convert to hours
	converted := dayPattern.ReplaceAllStringFunc(s, func(match string) string {
		// extract the numeric part
		numStr := match[:len(match)-1] // remove the 'd'
		days, err := strconv.Atoi(numStr)
		if err != nil {
			// this shouldn't happen due to regex, but handle gracefully
			return match
		}
		// convert days to hours
		hours := days * 24
		return fmt.Sprintf("%dh", hours)
	})

	// pass to standard time.ParseDuration
	return time.ParseDuration(converted)
}

```

### Core Architecture Module: `util/email.go`
```
package util

import "regexp"

var emailRegex = regexp.MustCompile("^[a-zA-Z0-9.!#$%&'*+\\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$")

func IsValidEmail(e string) bool {
	if len(e) < 3 && len(e) > 254 {
		return false
	}
	return emailRegex.MatchString(e)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1283** (2026-10-03): **rate limiting is counted and answered with 503; access and enable compensate**
  *Symptoms*: FIX: `share`, `unshare`, `access`, `unaccess`, `enable` and `disable` now answer 503 Service Unavailable with a `Retry-After` header (five seconds) when the OpenZiti controller is rate limiting the zrok controller, instead of 500. A client can now tell a busy controller from a broken one and try again later. The failed request is undone as before: a share or access that fails removes what it created, and a share or environment delete that fails leaves everything in place for the retry. The controller log names the OpenZiti limiter that answered, along with the method and path of the refused request.  FIX: A private access (`zrok2 access private`) that fails after its dial policy has been created in OpenZiti now deletes that dial policy. Previously a failure to record the access left the policy behind with no access owning it. Likewise, enabling an environment (`zrok2 enable`) that fails after its OpenZiti identity has been created now deletes the identity and its edge router policy, where previously they were left behind with no environment owning them.  CHANGE: The admin profile endpoint's `/debug/vars` now includes `zrok.ziti.rate_limited`, the number of OpenZiti management requests the controller has had refused by an OpenZiti rate limiter (HTTP 429) since it started, counting both the command and authentication limiters.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #BZyLWISIg1qIxWFWW1GBGBjFifIsTHM1vo3JeMcvCys=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ6cm9rIiwicHJvamVjdElkIjoicHJqX000ODk4ZTc2OXRxY2l3MVRUUmVQc21nallRcVYiLCJyb290RGlyZWN0b3J5Ijoid2Vic2l0ZSIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9vcGVueml0aS96cm9rL0NDNXE0OFNwTnpldUN0ejFqMTJ1dXRRbjVkVkciLCJwcmV2aWV3VXJsIjoienJvay1naXQtZmFsbC1maXhlcy1zMWEtb3BlbnppdGkudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJJR05PUkVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6IiJ9fV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPW9wZW56aXRpJnJlcG89enJvayZwcj0xMjgzIn0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/openziti/zrok"><sup><img src="https://ve

- **Issue #1282** (2026-10-02): **relax rebuilds v2 public share dial policies; repair-dial-policies; influx query deadline**
  *Symptoms*: FIX: Accounts holding public shares are now released when their bandwidth usage falls back under the limit. Previously the relax cycle failed for every public share created by v2, because it looked for the v1 frontend selection those shares never have, so the account stayed limited indefinitely after its usage had recovered and its journal entry had to be cleared by hand. The relax now restores a public share's dial policy from the share's names and the frontends serving their namespaces, the same way the share was created; a share created by v1 is still restored from its frontend selection, and a share that has neither had no dial policy to restore and no longer holds the account back.  FIX: When a limited account is released, the private accesses to its public shares (`zrok2 access private` against a public share) now get their access back too. Previously only accesses to private shares were restored, and the others stayed unable to connect until they were recreated.  FIX: The limits agent's InfluxDB queries now have a deadline, `limits.query_timeout` (default 30 seconds), and are cancelled when the controller shuts down. Previously an InfluxDB that accepted a query and never answered held the relax cycle, and so every limit enforcement behind it, open indefinitely and kept the controller from stopping. A query that fails or times out part-way through its result is now reported as a failure rather than as zero usage, so it can no longer release a limited account.  FEA
  **Post-Mortem & Fix Analysis**:
  > [vc]: #2WYBWqBXqtY0bHvFxJucJPmE+mhFBb39dL8YzIySb+0=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ6cm9rIiwicHJvamVjdElkIjoicHJqX000ODk4ZTc2OXRxY2l3MVRUUmVQc21nallRcVYiLCJ2MCI6ZmFsc2UsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ6cm9rLWdpdC1mYWxsLWZpeGVzLXM2LW9wZW56aXRpLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL29wZW56aXRpL3pyb2svR1FncDV2VnVUYkRYNlpINFdKcG9reWFmaG8xcCIsInByZXZpZXdVcmwiOiJ6cm9rLWdpdC1mYWxsLWZpeGVzLXM2LW9wZW56aXRpLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQifV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPW9wZW56aXRpJnJlcG89enJvayZwcj0xMjgyIn0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/openziti/zrok"><sup><img src="https://vercel.com/api/ww

- **Issue #1281** (2026-10-02): **garbage collection improvements**
  *Symptoms*: FIX: `zrok2 admin gc` now decides which share an OpenZiti object belongs to by its `zrokShareToken` tag rather than its name, so it no longer deletes the bind, dial and service edge router policies of live shares; objects with no share token, such as agent-remote services and policies, are never touched. It now reads every object rather than the first page of ten of each kind. It is a dry run by default that prints what it would remove, grouped by share token, and deletes only with `--delete`. Orphaned objects younger than `--min-age` (default 24 hours) are skipped, so a share being created at the time of the run is not collected. Tearing down a share with more than ten OpenZiti objects of one kind, such as a share with many access dial policies, now removes all of them rather than the first ten.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #jWO2D3YFoI9RF7Rww+bpJasYEVhJqgnPUrziHYREvkI=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ6cm9rIiwicHJvamVjdElkIjoicHJqX000ODk4ZTc2OXRxY2l3MVRUUmVQc21nallRcVYiLCJ2MCI6ZmFsc2UsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ6cm9rLWdpdC1mYWxsLWZpeGVzLXMxMi1vcGVueml0aS52ZXJjZWwuYXBwIn0sImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9vcGVueml0aS96cm9rLzlaSEs5dXRwWFBHRVZycVFyWjZwWDRmODFYTEUiLCJwcmV2aWV3VXJsIjoienJvay1naXQtZmFsbC1maXhlcy1zMTItb3BlbnppdGkudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCJ9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9b3BlbnppdGkmcmVwbz16cm9rJnByPTEyODEifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/openziti/zrok"><sup><img src="https://vercel.com/ap

- **Issue #1280** (2026-09-29): **fall-fixes-s9**
  *Symptoms*: FIX: A dynamic frontend now periodically reconciles its mappings against the controller (`mapping_reconcile_interval`, default ten minutes), so a mapping removed or reassigned while its real-time update was lost, such as during a broker outage, now disappears or is corrected without restarting the frontend. A complete set that comes back empty is applied over existing mappings only when two consecutive reconciliations agree. A dynamic frontend started while the controller is unreachable now keeps retrying its initial mapping load instead of exiting.  FIX: A dynamic frontend's mapping update subscriber now bounds how many messages it holds unacknowledged (`amqp_subscriber.prefetch`, default 64) and never requeues. A message it cannot parse, or one with an unknown operation, is logged and discarded once; previously it was redelivered forever, holding up every real update behind it.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #3nNECWydIFtjwXc+hKz5EGdjRNpaAuICFA7XpoZQpQE=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ6cm9rIiwicHJvamVjdElkIjoicHJqX000ODk4ZTc2OXRxY2l3MVRUUmVQc21nallRcVYiLCJ2MCI6ZmFsc2UsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiIifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL29wZW56aXRpL3pyb2svMTRFdzR3M2d1N3ZNRHdDTGRNRUZoallQRnhSeCIsIm5leHRDb21taXRTdGF0dXMiOiJJR05PUkVEIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1vcGVueml0aSZyZXBvPXpyb2smcHI9MTI4MCJ9 The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/openziti/zrok"><sup><img src="https://vercel.com/api/www/avatar?projectId=prj_M4898e769tqciw1TTRePsmgjYQqV&teamId=team_bT6ULN5oFw8uRka0uFkKt

- **Issue #1279** (2026-09-29): **one improved teardown path; notification sequencing improvements**
  *Symptoms*: FIX: Disabling an environment, or an administrator deleting an account, now releases each share's names and frontend mappings the same way `unshare` does. Previously a name used by a share removed that way stayed attached to the deleted share and every later attempt to use it answered "already in use by another share" until the name was deleted; auto-allocated names were never released. Frontend mapping updates are now sent to dynamic frontends only after the change is committed, so a request that fails no longer leaves a frontend serving a mapping that does not exist. A share create whose frontend mapping cannot be recorded now fails and removes what it created, and a share delete whose OpenZiti cleanup fails now fails and leaves the share in place for a retry, instead of reporting success with the OpenZiti objects left behind.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #unXdx90E+unufNP0CYdfUnmKES/WyWtFDFRASMS9Ot4=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ6cm9rIiwicHJvamVjdElkIjoicHJqX000ODk4ZTc2OXRxY2l3MVRUUmVQc21nallRcVYiLCJ2MCI6ZmFsc2UsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ6cm9rLWdpdC1mYWxsLWZpeGVzLXM4LW9wZW56aXRpLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL29wZW56aXRpL3pyb2svQ0JYVThhQjI4Zzh2cDdKbjNaU3dYZGpqTEwyZiIsInByZXZpZXdVcmwiOiJ6cm9rLWdpdC1mYWxsLWZpeGVzLXM4LW9wZW56aXRpLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQifV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPW9wZW56aXRpJnJlcG89enJvayZwcj0xMjc5In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/openziti/zrok"><sup><img src="https://vercel.com/api/ww

- **Issue #1278** (2026-09-29): **disable and delete identity tolerate an absent ziti identity**
  *Symptoms*: FIX: Disabling an environment, or deleting an account, now succeeds when the environment's OpenZiti identity is already gone, so an environment stranded by an earlier partial teardown can be cleaned up. Previously the request failed with an internal error and the environment could never be disabled. The admin identity delete likewise succeeds when the identity is already gone. Any other OpenZiti failure still fails the request and leaves the environment in place for a retry (https://github.com/openziti/zrok/issues/1265).
  **Post-Mortem & Fix Analysis**:
  > [vc]: #8mTo/LUtvkG+KWAivvM6NQmmm5mRLGFmjvmNK+XwIUQ=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ6cm9rIiwicHJvamVjdElkIjoicHJqX000ODk4ZTc2OXRxY2l3MVRUUmVQc21nallRcVYiLCJ2MCI6ZmFsc2UsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9vcGVueml0aS96cm9rL0RBWGlmZUc1ZHVGN0p2TkdjaW1VQ0NoWlpyNXAiLCJwcmV2aWV3VXJsIjoienJvay1naXQtZmFsbC1maXhlcy1zNy1vcGVueml0aS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6Inpyb2stZ2l0LWZhbGwtZml4ZXMtczctb3BlbnppdGkudmVyY2VsLmFwcCJ9LCJyb290RGlyZWN0b3J5Ijoid2Vic2l0ZSJ9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9b3BlbnppdGkmcmVwbz16cm9rJnByPTEyNzgifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/openziti/zrok"><sup

- **Issue #1277** (2026-09-29): **share creation rollback compensation; better ziti errors**
  *Symptoms*: FIX: A share request that fails part-way now removes the OpenZiti objects it created (config, service and policies) and reports the underlying error. Previously the controller logged a `chk_z_id` constraint failure in place of the real OpenZiti error, and any failure after allocation, such as a closed private share granted to an unknown account, left the objects behind with no share owning them. Failed OpenZiti calls now log OpenZiti's own error code and message, such as the name of a conflicting object, where the log previously showed only the operation and HTTP status.  FIX: Deleting OpenZiti objects that are already gone now counts as success during cleanup, so one object removed concurrently no longer stops the rest of a cleanup from running. 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #mpXW/jlJcjBZ4V0hFn/UzBcRGnQJBqtIpajxa/FD33M=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ6cm9rIiwicHJvamVjdElkIjoicHJqX000ODk4ZTc2OXRxY2l3MVRUUmVQc21nallRcVYiLCJ2MCI6ZmFsc2UsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ6cm9rLWdpdC1mYWxsLWZpeGVzLXM1LW9wZW56aXRpLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL29wZW56aXRpL3pyb2svcFpmNDkzdnlOSml3cmdhTGRjVG05alpFUENjdyIsInByZXZpZXdVcmwiOiJ6cm9rLWdpdC1mYWxsLWZpeGVzLXM1LW9wZW56aXRpLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQifV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPW9wZW56aXRpJnJlcG89enJvayZwcj0xMjc3In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/openziti/zrok"><sup><img src="https://vercel.com/api/ww

- **Issue #1275** (2026-09-27): **fall fixes, v2 round 1**
  *Symptoms*: FIX: The controller no longer crashes when the bandwidth-limit relax cycle meets a public share with no frontend selection. An account's limit is now cleared only once every one of its shares has been relaxed; a share that cannot be relaxed is retried on the next cycle without disturbing other accounts, and dial policies that already exist are not recreated.  FIX: The controller holds one OpenZiti management session and re-authenticates only when it expires, instead of logging in on every operation. This removes the pressure on the OpenZiti controller's authentication rate limit during bursts of share activity and limit enforcement.  FIX: The metrics consumer bounds how many AMQP messages it holds unacknowledged and how long it spends on each: InfluxDB writes and share lookups have deadlines and a bounded retry, after which the message is dropped rather than parked, so a slow or unavailable InfluxDB or database can no longer fill the broker's memory. Malformed events are dropped immediately, a panic while processing one message no longer stops the consumer, and a full limits queue drops the handoff after a timeout while the usage stays recorded in InfluxDB.  CHANGE: `Makefile`: `make` builds the UIs and installs the module, `make test` runs the full gate (UI builds and lints, `go test`, `go vet`), `make clean` resets the project-owned `GOBIN` and UI build products. The UI lint errors the gate surfaced are fixed.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #g61m/y00OS6U5vHnzrIws8ol9+F8yjvuSciL4VDw1QI=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ6cm9rIiwicHJvamVjdElkIjoicHJqX000ODk4ZTc2OXRxY2l3MVRUUmVQc21nallRcVYiLCJ2MCI6ZmFsc2UsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ6cm9rLWdpdC1mYWxsLWZpeGVzLW9wZW56aXRpLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL29wZW56aXRpL3pyb2svQWNiaFRVVk1XR2NaRjc2TUNCeGdmTVlYc1lHQSIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsInJvb3REaXJlY3RvcnkiOiJ3ZWJzaXRlIiwicHJldmlld1VybCI6Inpyb2stZ2l0LWZhbGwtZml4ZXMtb3BlbnppdGkudmVyY2VsLmFwcCJ9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9b3BlbnppdGkmcmVwbz16cm9rJnByPTEyNzUifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/openziti/zrok"><sup><img sr

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

### Incident Patch 1: `79300f73` (2026-10-03)
**Commit Message**: Merge pull request #1283 from openziti/fall-fixes-s1a

rate limiting is counted and answered with 503; access and enable compensate

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+## v2.0.7
+
 FIX: `zrok2 admin gc` now decides which share an OpenZiti object belongs to by its `zrokShareToken` tag rather than its name, so it no longer deletes the bind, dial and service edge router policies of live shares; objects with no share token, such as agent-remote services and policies, are never touched. It now reads every object rather than the first page of ten of each kind. It is a dry run by default that prints what it would remove, grouped by share token, and deletes only with `--delete`. Orphaned objects younger than `--min-age` (default 24 hours) are skipped, so a share being created at the time of the run is not collected. Tearing down a share with more than ten OpenZiti objects of one kind, such as a share with many access dial policies, now removes all of them rather than the first ten.
 
 FIX: Accounts holding public shares are now released when their bandwidth usage falls back under the limit. Previously the relax cycle failed for every public share created by v2, because it looked for the v1 frontend selection those shares never have, so the account stayed limited indefinitely after its usage had recovered and its journal entry had to be cleared by hand. The relax now restores a public share's dial policy from the share's names and the frontends serving their namespaces, the same way the share was created; a share created by v1 is still restored from its frontend selection, and a share that has neither had no dial policy to restore and no longer holds the account back.
@@ -12,6 +14,12 @@ FIX: The limits agent's InfluxDB queries now have a deadline, `limits.query_time
 
 FEATURE: `zrok2 admin repair-dial-policies <configPath>` finds live shares that are missing the dial policies their frontends and private accesses need, such as shares left without them by a limit that was cleared by hand or by a relax that stopped part-way, and with `--apply` recreates them. It is a dry run by default that lists each missing policy by account, share and policy name. Accounts the bandwidth limit journal holds limited, and shares of a backend mode a scoped limit class holds limited, are skipped and listed, so the command never lifts a limit. It never deletes anything, continues past individual OpenZiti failures and past v1 shares whose selected frontend no longer exists (each listed as failed with the frontend it selects), reports how many policies it checked, found missing, created and failed to create, and exits with an error if any failed. Running it again reports nothing missing.
 
+FIX: `share`, `unshare`, `access`, `unaccess`, `enable` and `disable` now answer 503 Service Unavailable with a `Retry-After` header (five seconds) when the OpenZiti controller is rate limiting the zrok controller, instead of 500. A client can now tell a busy controller from a broken one and try again later. The failed request is undone as before: a share or access that fails removes what it created, and a share or environment delete that fails leaves everything in place for the retry. The controller log names the OpenZiti limiter that answered, along with the method and path of the refused request.
+
+FIX: A private access (`zrok2 access private`) that fails after its dial policy has been created in OpenZiti now deletes that dial policy. Previously a failure to record the access left the policy behind with no access owning it. Likewise, enabling an environment (`zrok2 enable`) that fails after its OpenZiti identity has been created now deletes the identity and its edge router policy, where previously they were left behind with no environment owning them.
+
+CHANGE: The admin profile endpoint's `/debug/vars` now includes `zrok.ziti.rate_limited`, the number of OpenZiti management requests the controller has had refused by an OpenZiti rate limiter (HTTP 429) since it started, counting both the command and authentication limiters.
+
 ## v2.0.6
 
 FIX: A share request that fails part-way now removes the OpenZiti objects it created (config, service and policies) and reports the underlying error. Previously the controller logged a `chk_z_id` constraint failure in place of the real OpenZiti error, and any failure after allocation, such as a closed private share granted to an unknown account, left the objects behind with no share owning them. Failed OpenZiti calls now log OpenZiti's own error code and message, such as the name of a conflicting object, where the log previously showed only the operation and HTTP status.
```

**File**: `bin/generate_rest.sh` (modified, +12/-0)
```diff
@@ -50,6 +50,18 @@ command -v openapi-generator-cli &>/dev/null || {
   exit 1
 }
 
+# these are the generator versions that reproduce the checked-in tree; any other version rewrites
+# generated files the spec change did not touch. openapi-generator-cli needs java; without it, the
+# openapitools/openapi-generator-cli:v7.14.0 docker image can stand in for the command.
+requiredSwagger="v0.33.2"
+requiredOpenapiGenerator="7.14.0"
+swaggerVersion=$(swagger version 2>/dev/null | sed -n 's/^version: //p')
+openapiGeneratorVersion=$(openapi-generator-cli version 2>/dev/null | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | tail -n 1)
+if [[ "$swaggerVersion" != "$requiredSwagger" || "$openapiGeneratorVersion" != "$requiredOpenapiGenerator" ]]; then
+  echo >&2 "ERROR: requires swagger '$requiredSwagger' (found '$swaggerVersion') and openapi-generator-cli '$requiredOpenapiGenerator' (found '$openapiGeneratorVersion')"
+  exit 1
+fi
+
 command -v realpath &>/dev/null || {
   echo >&2 "command 'realpath' not installed. see: https://www.npmjs.com/package/realpath for installation"
   exit 1
```

**File**: `controller/access.go` (modified, +25/-4)
```diff
@@ -12,10 +12,13 @@ import (
 	"github.com/pkg/errors"
 )
 
-type accessHandler struct{}
+type accessHandler struct {
+	// commit is replaceable so a test can fail the commit after the dial policy exists.
+	commit func(*sqlx.Tx) error
+}
 
 func newAccessHandler() *accessHandler {
-	return &accessHandler{}
+	return &accessHandler{commit: (*sqlx.Tx).Commit}
 }
 
 func (h *accessHandler) Handle(params share.AccessParams, principal *rest_model_zrok.Principal) middleware.Responder {
@@ -94,6 +97,9 @@ func (h *accessHandler) Handle(params share.AccessParams, principal *rest_model_
 	ziti, err := automation.NewZitiAutomation(cfg.Ziti)
 	if err != nil {
 		dl.Error(err)
+		if automation.IsRateLimited(err) {
+			return share.NewAccessServiceUnavailable().WithRetryAfter(rateLimitedRetryAfter)
+		}
 		return share.NewAccessInternalServerError()
 	}
 
@@ -113,15 +119,30 @@ func (h *accessHandler) Handle(params share.AccessParams, principal *rest_model_
 		Semantic:      rest_model.SemanticAllOf,
 	}
 
-	if _, err := ziti.ServicePolicies.CreateDial(opts); err != nil {
+	dialPolicyZId, err := ziti.ServicePolicies.CreateDial(opts)
+	if err != nil {
 		dl.Errorf("unable to create dial policy for user '%v': %v", principal.Email, err)
+		if automation.IsRateLimited(err) {
+			return share.NewAccessServiceUnavailable().WithRetryAfter(rateLimitedRetryAfter)
+		}
 		return share.NewAccessInternalServerError()
 	}
 
-	if err := trx.Commit(); err != nil {
+	// the dial policy is deleted by id unless the frontend record commits
+	compensation := newZitiCompensation(compensatingAccess, feToken)
+	compensation.add(zitiServicePolicy, dialPolicyZId)
+	committed := false
+	defer func() {
+		if !committed {
+			compensation.run(ziti)
+		}
+	}()
+
+	if err := h.commit(trx); err != nil {
 		dl.Errorf("error committing frontend record: %v", err)
 		return share.NewAccessInternalServerError()
 	}
+	committed = true
 
 	return share.NewAccessCreated().WithPayload(&share.AccessCreatedBody{
 		FrontendToken: feToken,
```

**File**: `controller/automation/api.go` (modified, +6/-0)
```diff
@@ -67,6 +67,12 @@ func IsNotFound(err error) bool {
 		isError[*edge_router_policy.DeleteEdgeRouterPolicyNotFound](err)
 }
 
+// IsRateLimited reports whether err is a ziti rate limiter's refusal, from either the command rate
+// limiter (seen by the session transport) or the authentication limiter.
+func IsRateLimited(err error) bool {
+	return isError[*RateLimitedError](err)
+}
+
 func isError[T error](err error) bool {
 	var target T
 	return errors.As(err, &target)
```

**File**: `controller/automation/rateLimited.go` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+package automation
+
+import (
+	"encoding/json"
+	"fmt"
+	"io"
+	"net/http"
+
+	"github.com/michaelquigley/df/dl"
+	"github.com/openziti/edge-api/rest_model"
+)
+
+// authenticateLimiter names the ziti controller's /authenticate rate limiter, whose generated 429 is
+// typed rather than seen by the session transport.
+const authenticateLimiter = "authenticate"
+
+// rateLimitedBodyLimit bounds how much of a 429 body is read for its error envelope.
+const rateLimitedBodyLimit = 64 * 1024
+
+// RateLimitedError reports that a ziti rate limiter refused a management request. Limiter is the
+// error code from ziti's envelope (SERVER_TOO_MANY_REQUESTS for the command rate limiter), or
+// 'authenticate' for the authentication limiter.
+type RateLimitedError struct {
+	Limiter string
+	Method  string
+	Path    string
+}
+
+func (e *RateLimitedError) Error() string {
+	return fmt.Sprintf("ziti rate limited '%s' on '%s %s'", e.Limiter, e.Method, e.Path)
+}
+
+// newRateLimitedError counts and logs one rate-limited answer from ziti.
+func newRateLimitedError(limiter, method, path string) *RateLimitedError {
+	zitiRateLimited.Add(1)
+	dl.Warnf("ziti rate limited by '%s' on '%s %s', rate limited count '%d'", limiter, method, path, zitiRateLimited.Value())
+	return &RateLimitedError{Limiter: limiter, Method: method, Path: path}
+}
+
+// rateLimitedResponse consumes a 429 response and returns its error; the limiter is the code in
+// ziti's error envelope, when the body carries one.
+func rateLimitedResponse(req *http.Request, resp *http.Response) *RateLimitedError {
+	defer resp.Body.Close()
+	limiter := http.StatusText(http.StatusTooManyRequests)
+	var envelope rest_model.APIErrorEnvelope
+	if body, err := io.ReadAll(io.LimitReader(resp.Body, rateLimitedBodyLimit)); err == nil {
+		if json.Unmarshal(body, &envelope) == nil && envelope.Error != nil && envelope.Error.Code != "" {
+			limiter = envelope.Error.Code
+		}
+	}
+	return newRateLimitedError(limiter, req.Method, req.URL.Path)
+}
```

**File**: `controller/automation/rateLimited_test.go` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
+package automation
+
+import (
+	"bytes"
+	"errors"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/michaelquigley/df/dl"
+	"github.com/openziti/zrok/v2/controller/automation/zitifake"
+)
+
+type logBuffer struct {
+	mu  sync.Mutex
+	buf bytes.Buffer
+}
+
+func (b *logBuffer) Write(p []byte) (int, error) {
+	b.mu.Lock()
+	defer b.mu.Unlock()
+	return b.buf.Write(p)
+}
+
+func (b *logBuffer) String() string {
+	b.mu.Lock()
+	defer b.mu.Unlock()
+	return b.buf.String()
+}
+
+func captureLogs(t *testing.T) *logBuffer {
+	t.Helper()
+	logs := &logBuffer{}
+	dl.Init(dl.DefaultOptions().JSON().SetOutput(logs))
+	t.Cleanup(func() { dl.Init() })
+	return logs
+}
+
+func TestZitiRateLimitedCreate(t *testing.T) {
+	fake, cfg, _ := sessionFixture(t)
+	logs := captureLogs(t)
+	ziti := mustSession(t, cfg)
+	fake.RateLimitCreates(zitifake.Services, true)
+	before := zitiRateLimited.Value()
+
+	_, err := ziti.Services.Create(&ServiceOptions{BaseOptions: BaseOptions{Name: "limited"}})
+
+	if !IsRateLimited(err) {
+		t.Fatalf("want rate limited, got %T: %v", err, err)
+	}
+	var limited *RateLimitedError
+	if !errors.As(err, &limited) || limited.Limiter != "SERVER_TOO_MANY_REQUESTS" || limited.Method != "POST" || limited.Path != "/edge/management/v1/services" {
+		t.Fatalf("rate limited error = %+v", limited)
+	}
+	if got := zitiRateLimited.Value() - before; got != 1 {
+		t.Fatalf("rate limited counter delta = %d, want 1", got)
+	}
+	if line := logs.String(); !bytes.Contains([]byte(line), []byte("ziti rate limited by 'SERVER_TOO_MANY_REQUESTS' on 'POST /edge/management/v1/services'")) {
+		t.Fatalf("missing rate limited log line: %s", line)
+	}
+	if IsNotFound(err) {
+		t.Fatal("rate limited error matched not found")
+	}
+	if _, _, creates, _ := fake.Counts(); creates != 0 {
+		t.Fatalf("created %d services, want 0", creates)
+	}
+}
+
+func TestZitiRateLimitedAuthentication(t *testing.T) {
+	fake, cfg, _ := sessionFixture(t)
+	logs := captureLogs(t)
+	oldClock := refreshClock
+	t.Cleanup(func() { refreshClock = oldClock })
+	ziti := mustSession(t, cfg)
+	fake.ExpireAll()
+	fake.RateLimitAuthentications(1)
+	before := zitiRateLimited.Value()
+
+	_, err := ziti.Services.Find(&FilterOptions{})
+
+	var limited *RateLimitedError
+	if !IsRateLimited(err) || !errors.As(err, &limited) || limited.Limiter != "authenticate" {
+		t.Fatalf("want authenticate rate limited, got %T: %v", err, err)
+	}
+	if got := zitiRateLimited.Value() - before; got != 1 {
+		t.Fatalf("rate limited counter delta = %d, want 1", got)
+	}
+	if line := logs.String(); !bytes.Contains([]byte(line), []byte("ziti rate limited by 'authenticate' on 'POST /edge/management/v1/authenticate'")) {
+		t.Fatalf("missing rate limited log line: %s", line)
+	}
+
+	// the failed refresh is remembered like any other: no second login inside the window.
+	if _, err := ziti.Services.Find(&FilterOptions{}); !IsRateLimited(err) {
+		t.Fatalf("remembered failure = %v", err)
+	}
+	if _, attempts, _ := fake.AuthCounts(); attempts != 2 {
+		t.Fatalf("authentication attempts = %d, want 2", attempts)
+	}
+	if got := zitiRateLimited.Value() - before; got != 1 {
+		t.Fatalf("remembered failure counted again: delta = %d", got)
+	}
+
+	refreshClock = func() time.Time { return time.Now().Add(failedRefreshWindow) }
+	if _, err := ziti.Services.Find(&FilterOptions{}); err != nil {
+		t.Fatalf("refresh after window: %v", err)
+	}
+	if successful, attempts, _ := fake.AuthCounts(); successful != 2 || attempts != 3 {
+		t.Fatalf("successful=%d attempts=%d", successful, attempts)
+	}
+}
+
+func TestZitiRateLimitedInitialAuthentication(t *testing.T) {
+	fake, cfg, _ := sessionFixture(t)
+	fake.RateLimitAuthentications(1)
+
+	if _, err := NewZitiAutomation(cfg); !IsRateLimited(err) {
+		t.Fatalf("want rate limited build, got %v", err)
+	}
+	ziti := mustSession(t, cfg)
+	if _, err := ziti.Services.Find(&FilterOptions{}); err != nil {
+		t.Fatal(err)
+	}
+}
+
+func TestIsRateLimitedOnlyMatchesItsType(t *testing.T) {
+	if IsRateLimited(nil) || IsRateLimited(errors.New("ziti SERVER_TOO_MANY_REQUESTS")) || IsRateLimited(NewNotFoundError("service", "delete", nil)) {
+		t.Fatal("IsRateLimited matched a foreign error")
+	}
+	wrapped := wrapEdgeError(&RateLimitedError{Limiter: "SERVER_TOO_MANY_REQUESTS", Method: "DELETE", Path: "/services/x"}, "error deleting service '%s'", "x")
+	if !IsRateLimited(wrapped) {
+		t.Fatal("wrapEdgeError lost the rate limited type")
+	}
+}
```

**File**: `controller/automation/session.go` (modified, +29/-4)
```diff
@@ -7,17 +7,22 @@ import (
 	"fmt"
 	"net/http"
 	"net/url"
+	"path"
 	"sync"
 	"time"
 
 	httptransport "github.com/go-openapi/runtime/client"
 	"github.com/michaelquigley/df/dl"
 	"github.com/openziti/edge-api/rest_management_api_client"
+	"github.com/openziti/edge-api/rest_management_api_client/authentication"
 	"github.com/openziti/edge-api/rest_util"
 )
 
 var zitiAuthentications = expvar.NewInt("zrok.ziti.authentications")
 
+// zitiRateLimited counts management requests a ziti rate limiter answered with 429.
+var zitiRateLimited = expvar.NewInt("zrok.ziti.rate_limited")
+
 // failedRefreshWindow is how long a failed refresh answers callers still holding the same session
 // generation, so a persistent authentication failure costs one login per window.
 const failedRefreshWindow = 5 * time.Second
@@ -122,6 +127,9 @@ func newZitiSession(cfg *Config, pool *x509.CertPool) (*ZitiAutomation, error) {
 	session.authenticate = func(ctx context.Context) (string, error) {
 		params := auth.Params().WithContext(ctx).WithTimeout(DefaultRequestTimeout)
 		resp, err := authEdge.Authentication.Authenticate(params)
+		if isError[*authentication.AuthenticateTooManyRequests](err) {
+			return "", newRateLimitedError(authenticateLimiter, http.MethodPost, path.Join(basePath, "authenticate"))
+		}
 		if err != nil {
 			return "", err
 		}
@@ -206,22 +214,35 @@ func (s *sessionTransport) runRefresh(ctx context.Context, call *sessionRefresh,
 	close(call.done)
 }
 
+// RoundTrip refreshes an expired session and replays the request once. a 429 from a ziti rate
+// limiter is consumed and returned as a *RateLimitedError; it is never retried here.
 func (s *sessionTransport) RoundTrip(req *http.Request) (*http.Response, error) {
 	request := req.Clone(req.Context())
 	s.mu.RLock()
 	request.Header.Set("zt-session", s.token)
 	generation := s.generation
 	s.mu.RUnlock()
 	resp, err := s.base.RoundTrip(request)
-	if err != nil || resp.StatusCode != http.StatusUnauthorized {
-		return resp, err
+	if err != nil {
+		return nil, err
+	}
+	if resp.StatusCode == http.StatusTooManyRequests {
+		return nil, rateLimitedResponse(req, resp)
+	}
+	if resp.StatusCode != http.StatusUnauthorized {
+		return resp, nil
 	}
 	// a streaming body cannot be replayed; preserve the original typed 401.
 	if req.Body != nil && req.Body != http.NoBody && req.GetBody == nil {
 		return resp, nil
 	}
 	if err := s.refresh(req.Context(), generation, "expired"); err != nil {
-		// let the generated client decode the original operation's typed 401.
+		// a rate-limited login is reported as such; otherwise let the generated client decode the
+		// original operation's typed 401.
+		if IsRateLimited(err) {
+			resp.Body.Close()
+			return nil, err
+		}
 		return resp, nil
 	}
 	resp.Body.Close()
@@ -235,5 +256,9 @@ func (s *sessionTransport) RoundTrip(req *http.Request) (*http.Response, error)
 	s.mu.RLock()
 	replay.Header.Set("zt-session", s.token)
 	s.mu.RUnlock()
-	return s.base.RoundTrip(replay)
+	resp, err = s.base.RoundTrip(replay)
+	if err == nil && resp.StatusCode == http.StatusTooManyRequests {
+		return nil, rateLimitedResponse(req, resp)
+	}
+	return resp, err
 }
```

**File**: `controller/automation/zitifake/fake.go` (modified, +62/-3)
```diff
@@ -71,6 +71,9 @@ type Server struct {
 	rejectOperations               bool
 	rejectDeletes                  map[string]bool
 	rejectCreates                  map[string]bool
+	rateLimitCreates               map[string]bool
+	rateLimitDeletes               map[string]bool
+	rateLimitAuthentications       int
 	authDelay                      time.Duration
 }
 
@@ -96,7 +99,7 @@ func newServer(username, password string) *Server {
 	for _, kind := range []string{Configs, Services, ServicePolicies, ServiceEdgeRouterPolicies, Identities, EdgeRouterPolicies} {
 		objects[kind] = make(map[string]*object)
 	}
-	return &Server{objects: objects, sessions: make(map[string]bool), rejectDeletes: make(map[string]bool), rejectCreates: make(map[string]bool), username: username, password: password}
+	return &Server{objects: objects, sessions: make(map[string]bool), rejectDeletes: make(map[string]bool), rejectCreates: make(map[string]bool), rateLimitCreates: make(map[string]bool), rateLimitDeletes: make(map[string]bool), username: username, password: password}
 }
 
 func (f *Server) Edge() *rest_management_api_client.ZitiEdgeManagement {
@@ -142,6 +145,29 @@ func (f *Server) RejectCreates(name string, reject bool) {
 	f.rejectCreates[name] = reject
 }
 
+// RateLimitCreates answers every create of kind as ziti's command rate limiter does: 429 with the
+// SERVER_TOO_MANY_REQUESTS envelope.
+func (f *Server) RateLimitCreates(kind string, limit bool) {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	f.rateLimitCreates[kind] = limit
+}
+
+// RateLimitDeletes answers every delete of kind as ziti's command rate limiter does.
+func (f *Server) RateLimitDeletes(kind string, limit bool) {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	f.rateLimitDeletes[kind] = limit
+}
+
+// RateLimitAuthentications answers the next n authentications with 429, as ziti's authentication
+// rate limiter does.
+func (f *Server) RateLimitAuthentications(n int) {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	f.rateLimitAuthentications = n
+}
+
 // SetAuthenticationDelay delays every authentication response without blocking other requests.
 func (f *Server) SetAuthenticationDelay(delay time.Duration) {
 	f.mu.Lock()
@@ -265,6 +291,11 @@ func (f *Server) issueToken() string {
 
 func (f *Server) authenticate(w http.ResponseWriter, r *http.Request) {
 	f.authAttempts++
+	if f.rateLimitAuthentications > 0 {
+		f.rateLimitAuthentications--
+		writeRateLimited(w)
+		return
+	}
 	var input rest_model.Authenticate
 	if r.Method != http.MethodPost || r.URL.Query().Get("method") != "password" || json.NewDecoder(r.Body).Decode(&input) != nil || string(input.Username) != f.username || string(input.Password) != f.password || f.rejectAuthentication {
 		writeError(w, http.StatusUnauthorized, "invalid credentials")
@@ -314,8 +345,8 @@ func (f *Server) serve(w http.ResponseWriter, r *http.Request) {
 		case http.MethodGet:
 			f.list(w, r, kind)
 		case http.MethodPost:
-			if kind == Identities || kind == EdgeRouterPolicies {
-				writeError(w, 405, "method not allowed")
+			if f.rateLimitCreates[kind] {
+				writeRateLimited(w)
 				return
 			}
 			f.create(w, r, kind)
@@ -348,6 +379,11 @@ func writeError(w http.ResponseWriter, status int, message string) {
 	writeJSON(w, status, &rest_model.APIErrorEnvelope{Error: &rest_model.APIError{Code: http.StatusText(status), Message: message}, Meta: &rest_model.Meta{}})
 }
 
+// writeRateLimited answers as ziti's rate limiters do.
+func writeRateLimited(w http.ResponseWriter) {
+	writeJSON(w, http.StatusTooManyRequests, &rest_model.APIErrorEnvelope{Error: &rest_model.APIError{Code: "SERVER_TOO_MANY_REQUESTS", Message: "too many requests"}, Meta: &rest_model.Meta{}})
+}
+
 func base(id string, tags *rest_model.Tags) rest_model.BaseEntity {
 	now := strfmt.DateTime(time.Now())
 	return rest_model.BaseEntity{ID: &id, Tags: tags, CreatedAt: &now, UpdatedAt: &now, Links: rest_model.Links{}}
@@ -421,6 +457,25 @@ func (f *Server) create(w http.ResponseWriter, r *http.Request, kind string) {
 		fill = func(obj *object, id string) {
 			obj.detail = &rest_model.ServiceEdgeRouterPolicyDetail{BaseEntity: base(id, tags), Name: &obj.name, EdgeRouterRoles: input.EdgeRouterRoles, EdgeRouterRolesDisplay: rest_model.NamedRoles{}, ServiceRoles: input.ServiceRoles, ServiceRolesDisplay: rest_model.NamedRoles{}, Semantic: input.Semantic}
 		}
+	case Identities:
+		var input rest_model.IdentityCreate
+		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Name == nil {
+			writeError(w, 400, "invalid identity")
+			return
+		}
+		// the seeded detail stands in; the fake serves no enrollment.
+		name, tags = *input.Name, input.Tags
+		fill = func(*object, string) {}
+	case EdgeRouterPolicies:
+		var input rest_model.EdgeRouterPolicyCreate
+		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Name == nil {
+			writeError(w, 400, "invalid edge router policy")
+			return
+		}
+		name, tags = *input.Name, input.Tags
+		fill = func(obj *object
```

---

### Incident Patch 2: `2289c184` (2026-10-02)
**Commit Message**: Merge pull request #1282 from openziti/fall-fixes-s6

relax rebuilds v2 public share dial policies; repair-dial-policies; influx query deadline

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -4,6 +4,14 @@
 
 FIX: `zrok2 admin gc` now decides which share an OpenZiti object belongs to by its `zrokShareToken` tag rather than its name, so it no longer deletes the bind, dial and service edge router policies of live shares; objects with no share token, such as agent-remote services and policies, are never touched. It now reads every object rather than the first page of ten of each kind. It is a dry run by default that prints what it would remove, grouped by share token, and deletes only with `--delete`. Orphaned objects younger than `--min-age` (default 24 hours) are skipped, so a share being created at the time of the run is not collected. Tearing down a share with more than ten OpenZiti objects of one kind, such as a share with many access dial policies, now removes all of them rather than the first ten.
 
+FIX: Accounts holding public shares are now released when their bandwidth usage falls back under the limit. Previously the relax cycle failed for every public share created by v2, because it looked for the v1 frontend selection those shares never have, so the account stayed limited indefinitely after its usage had recovered and its journal entry had to be cleared by hand. The relax now restores a public share's dial policy from the share's names and the frontends serving their namespaces, the same way the share was created; a share created by v1 is still restored from its frontend selection, and a share that has neither had no dial policy to restore and no longer holds the account back.
+
+FIX: When a limited account is released, the private accesses to its public shares (`zrok2 access private` against a public share) now get their access back too. Previously only accesses to private shares were restored, and the others stayed unable to connect until they were recreated.
+
+FIX: The limits agent's InfluxDB queries now have a deadline, `limits.query_timeout` (default 30 seconds), and are cancelled when the controller shuts down. Previously an InfluxDB that accepted a query and never answered held the relax cycle, and so every limit enforcement behind it, open indefinitely and kept the controller from stopping. A query that fails or times out part-way through its result is now reported as a failure rather than as zero usage, so it can no longer release a limited account.
+
+FEATURE: `zrok2 admin repair-dial-policies <configPath>` finds live shares that are missing the dial policies their frontends and private accesses need, such as shares left without them by a limit that was cleared by hand or by a relax that stopped part-way, and with `--apply` recreates them. It is a dry run by default that lists each missing policy by account, share and policy name. Accounts the bandwidth limit journal holds limited, and shares of a backend mode a scoped limit class holds limited, are skipped and listed, so the command never lifts a limit. It never deletes anything, continues past individual OpenZiti failures and past v1 shares whose selected frontend no longer exists (each listed as failed with the frontend it selects), reports how many policies it checked, found missing, created and failed to create, and exits with an error if any failed. Running it again reports nothing missing.
+
 ## v2.0.6
 
 FIX: A share request that fails part-way now removes the OpenZiti objects it created (config, service and policies) and reports the underlying error. Previously the controller logged a `chk_z_id` constraint failure in place of the real OpenZiti error, and any failure after allocation, such as a closed private share granted to an unknown account, left the objects behind with no share owning them. Failed OpenZiti calls now log OpenZiti's own error code and message, such as the name of a conflicting object, where the log previously showed only the operation and HTTP status.
```

**File**: `cmd/zrok2/adminRepairDialPolicies.go` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
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
+	adminCmd.AddCommand(newAdminRepairDialPoliciesCommand().cmd)
+}
+
+type adminRepairDialPoliciesCommand struct {
+	cmd   *cobra.Command
+	apply bool
+}
+
+func newAdminRepairDialPoliciesCommand() *adminRepairDialPoliciesCommand {
+	cmd := &cobra.Command{
+		Use:   "repair-dial-policies <configPath>",
+		Short: "Restore missing dial service policies of unlimited shares (dry run by default)",
+		Long: "Report, and with --apply create, the dial service policies that live shares should have and do not:\n" +
+			"a public share's frontend policy, derived from its name mappings, and the policy of each private access.\n\n" +
+			"Without --apply this is a dry run: nothing is created and the report lists what is missing.\n" +
+			"Accounts the bandwidth limit journal holds limited are skipped, as are shares of a backend mode a\n" +
+			"scoped limit class holds limited. Nothing is ever deleted, and a second run finds nothing missing.",
+		Args: cobra.ExactArgs(1),
+	}
+	command := &adminRepairDialPoliciesCommand{cmd: cmd}
+	cmd.Flags().BoolVar(&command.apply, "apply", false, "Create the missing dial policies (default is a dry run)")
+	cmd.Run = command.run
+	return command
+}
+
+func (c *adminRepairDialPoliciesCommand) run(_ *cobra.Command, args []string) {
+	cfg, err := config.LoadConfig(args[0])
+	if err != nil {
+		panic(err)
+	}
+	dl.Info(dd.MustInspect(cfg))
+	if err := controller.RepairDialPolicies(cfg, c.apply); err != nil {
+		panic(err)
+	}
+}
```

**File**: `controller/automation/zitifake/fake.go` (modified, +13/-1)
```diff
@@ -70,6 +70,7 @@ type Server struct {
 	rejectAuthentication           bool
 	rejectOperations               bool
 	rejectDeletes                  map[string]bool
+	rejectCreates                  map[string]bool
 	authDelay                      time.Duration
 }
 
@@ -95,7 +96,7 @@ func newServer(username, password string) *Server {
 	for _, kind := range []string{Configs, Services, ServicePolicies, ServiceEdgeRouterPolicies, Identities, EdgeRouterPolicies} {
 		objects[kind] = make(map[string]*object)
 	}
-	return &Server{objects: objects, sessions: make(map[string]bool), rejectDeletes: make(map[string]bool), username: username, password: password}
+	return &Server{objects: objects, sessions: make(map[string]bool), rejectDeletes: make(map[string]bool), rejectCreates: make(map[string]bool), username: username, password: password}
 }
 
 func (f *Server) Edge() *rest_management_api_client.ZitiEdgeManagement {
@@ -134,6 +135,13 @@ func (f *Server) RejectDeletes(kind string, reject bool) {
 	f.rejectDeletes[kind] = reject
 }
 
+// RejectCreates answers every create of an object named name with an internal server error.
+func (f *Server) RejectCreates(name string, reject bool) {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	f.rejectCreates[name] = reject
+}
+
 // SetAuthenticationDelay delays every authentication response without blocking other requests.
 func (f *Server) SetAuthenticationDelay(delay time.Duration) {
 	f.mu.Lock()
@@ -414,6 +422,10 @@ func (f *Server) create(w http.ResponseWriter, r *http.Request, kind string) {
 			obj.detail = &rest_model.ServiceEdgeRouterPolicyDetail{BaseEntity: base(id, tags), Name: &obj.name, EdgeRouterRoles: input.EdgeRouterRoles, EdgeRouterRolesDisplay: rest_model.NamedRoles{}, ServiceRoles: input.ServiceRoles, ServiceRolesDisplay: rest_model.NamedRoles{}, Semantic: input.Semantic}
 		}
 	}
+	if f.rejectCreates[name] {
+		writeError(w, http.StatusInternalServerError, labels[kind].noun+" create rejected: "+name)
+		return
+	}
 	if f.beforeCreate != nil {
 		f.beforeCreate(kind, name)
 	}
```

**File**: `controller/limits/agent.go` (modified, +14/-6)
```diff
@@ -30,20 +30,23 @@ type Agent struct {
 	relaxActions   []AccountAction
 	close          chan struct{}
 	join           chan struct{}
+	ctx            context.Context
+	cancel         context.CancelFunc
 	droppedEvents  atomic.Uint64
 }
 
 type bandwidthReader interface {
-	totalRxTxForAccount(int64, time.Duration) (int64, int64, error)
-	totalRxTxForEnvironment(int64, time.Duration) (int64, int64, error)
-	totalRxTxForShare(string, time.Duration) (int64, int64, error)
+	totalRxTxForAccount(context.Context, int64, time.Duration) (int64, int64, error)
+	totalRxTxForEnvironment(context.Context, int64, time.Duration) (int64, int64, error)
+	totalRxTxForShare(context.Context, string, time.Duration) (int64, int64, error)
 }
 
 func NewAgent(cfg *Config, ifxCfg *metrics.InfluxConfig, zCfg *automation.Config, emailCfg *emailUi.Config, str *store.Store) (*Agent, error) {
 	newZiti := func() (*automation.ZitiAutomation, error) { return automation.NewZitiAutomation(zCfg) }
+	ctx, cancel := context.WithCancel(context.Background())
 	a := &Agent{
 		cfg:            cfg,
-		ifx:            newInfluxReader(ifxCfg),
+		ifx:            newInfluxReader(ifxCfg, cfg.QueryTimeout),
 		zCfg:           zCfg,
 		newZiti:        newZiti,
 		str:            str,
@@ -53,6 +56,8 @@ func NewAgent(cfg *Config, ifxCfg *metrics.InfluxConfig, zCfg *automation.Config
 		relaxActions:   []AccountAction{newRelaxAction(str, newZiti)},
 		close:          make(chan struct{}),
 		join:           make(chan struct{}),
+		ctx:            ctx,
+		cancel:         cancel,
 	}
 	return a, nil
 }
@@ -67,7 +72,10 @@ func (a *Agent) Start() {
 	go a.run()
 }
 
+// Stop cancels the agent's context first, so an influx query in flight returns and the run loop can see
+// the close.
 func (a *Agent) Stop() {
+	a.cancel()
 	close(a.close)
 	<-a.join
 }
@@ -464,7 +472,7 @@ func (a *Agent) relax() error {
 
 				if periods, accountFound := accountPeriods[bwje.AccountId]; accountFound {
 					if _, periodFound := periods[bwc.GetPeriodMinutes()]; !periodFound {
-						rx, tx, err := a.ifx.totalRxTxForAccount(int64(bwje.AccountId), time.Duration(bwc.GetPeriodMinutes())*time.Minute)
+						rx, tx, err := a.ifx.totalRxTxForAccount(a.ctx, int64(bwje.AccountId), time.Duration(bwc.GetPeriodMinutes())*time.Minute)
 						if err != nil {
 							return err
 						}
@@ -579,7 +587,7 @@ func (a *Agent) anyBandwidthLimitExceeded(acct *store.Account, u *metrics.Usage,
 
 	for _, bwc := range bwcs {
 		if _, found := periodBw[bwc.GetPeriodMinutes()]; !found {
-			rx, tx, err := a.ifx.totalRxTxForAccount(u.AccountId, time.Minute*time.Duration(bwc.GetPeriodMinutes()))
+			rx, tx, err := a.ifx.totalRxTxForAccount(a.ctx, u.AccountId, time.Minute*time.Duration(bwc.GetPeriodMinutes()))
 			if err != nil {
 				return nil, 0, 0, errors.Wrapf(err, "error getting rx/tx for account '%v'", acct.Email)
 			}
```

**File**: `controller/limits/config.go` (modified, +5/-0)
```diff
@@ -5,6 +5,9 @@ import (
 	"time"
 )
 
+// DefaultQueryTimeout bounds each of the limits agent's influx queries.
+const DefaultQueryTimeout = 30 * time.Second
+
 type Config struct {
 	Environments   int
 	Shares         int
@@ -15,6 +18,7 @@ type Config struct {
 	Cycle          time.Duration
 	Enforcing      bool
 	HandoffTimeout time.Duration
+	QueryTimeout   time.Duration
 }
 
 type BandwidthPerPeriod struct {
@@ -55,5 +59,6 @@ func DefaultConfig() *Config {
 		Bandwidth:      DefaultBandwidthPerPeriod(),
 		Enforcing:      false,
 		Cycle:          15 * time.Minute,
+		QueryTimeout:   DefaultQueryTimeout,
 	}
 }
```

**File**: `controller/limits/dialPolicies.go` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+package limits
+
+import (
+	"database/sql"
+	"fmt"
+
+	"github.com/jmoiron/sqlx"
+	"github.com/michaelquigley/df/dl"
+	"github.com/openziti/edge-api/rest_model"
+	"github.com/openziti/zrok/v2/controller/automation"
+	"github.com/openziti/zrok/v2/controller/store"
+	"github.com/openziti/zrok/v2/sdk/golang/sdk"
+	"github.com/pkg/errors"
+)
+
+// desiredDialPolicies returns every dial service policy a live share should have: the frontend policy of a
+// public share and the policy of each private access to a share of either mode. the errors are store errors.
+func desiredDialPolicies(str *store.Store, shr *store.Share, trx *sqlx.Tx) ([]*automation.ServicePolicyOptions, error) {
+	var desired []*automation.ServicePolicyOptions
+	if shr.ShareMode == string(sdk.PublicShareMode) {
+		public, err := desiredPublicDialPolicies(str, shr, trx)
+		if err != nil {
+			return nil, err
+		}
+		desired = append(desired, public...)
+	}
+	access, err := desiredAccessDialPolicies(str, shr, trx)
+	if err != nil {
+		return nil, err
+	}
+	return append(desired, access...), nil
+}
+
+// desiredPublicDialPolicies derives a public share's frontend dial policy the way allocatePublicResources
+// creates it: from the share's live name mappings, each name's namespace, and that namespace's frontends.
+// frontend_selection is v1's column and v2 never writes it, so it is consulted only for a v1-created row,
+// one with no live mappings. a share with neither has no dial policy to restore; its create made none.
+func desiredPublicDialPolicies(str *store.Store, shr *store.Share, trx *sqlx.Tx) ([]*automation.ServicePolicyOptions, error) {
+	env, err := str.GetEnvironment(shr.EnvironmentId, trx)
+	if err != nil {
+		return nil, errors.Wrapf(err, "error finding environment for share '%v'", shr.Token)
+	}
+	details, err := str.FindShareNameCleanupDetailsByShareId(shr.Id, trx)
+	if err != nil {
+		return nil, errors.Wrapf(err, "error finding name mappings for share '%v'", shr.Token)
+	}
+
+	var frontendZIds []string
+	mapped := false
+	seenNamespaces := make(map[int]bool)
+	seenFrontends := make(map[string]bool)
+	for _, detail := range details {
+		if detail.NameDeleted || detail.NamespaceDeleted {
+			continue
+		}
+		mapped = true
+		if seenNamespaces[detail.NamespaceID] {
+			continue
+		}
+		seenNamespaces[detail.NamespaceID] = true
+		fes, err := str.FindFrontendsForNamespace(detail.NamespaceID, trx)
+		if err != nil {
+			return nil, errors.Wrapf(err, "error finding frontends for namespace '%v'", detail.NamespaceName)
+		}
+		for _, fe := range fes {
+			if !seenFrontends[fe.ZId] {
+				seenFrontends[fe.ZId] = true
+				frontendZIds = append(frontendZIds, fe.ZId)
+			}
+		}
+	}
+
+	if !mapped && shr.FrontendSelection != nil {
+		fe, err := str.FindFrontendPubliclyNamed(*shr.FrontendSelection, trx)
+		if errors.Is(err, sql.ErrNoRows) {
+			return nil, missingPublicFrontendError{shareToken: shr.Token, publicName: *shr.FrontendSelection}
+		}
+		if err != nil {
+			return nil, errors.Wrapf(err, "error finding frontend name '%v' for '%v'", *shr.FrontendSelection, shr.Token)
+		}
+		frontendZIds = []string{fe.ZId}
+	}
+
+	if len(frontendZIds) == 0 {
+		return nil, nil
+	}
+	var identityRoles []string
+	for _, zId := range frontendZIds {
+		identityRoles = append(identityRoles, "@"+zId)
+	}
+	return []*automation.ServicePolicyOptions{{
+		BaseOptions: automation.BaseOptions{
+			Name: env.ZId + "-" + shr.ZId + "-dial",
+			Tags: automation.ZrokShareTags(shr.Token),
+		},
+		IdentityRoles: identityRoles,
+		ServiceRoles:  []string{"@" + shr.ZId},
+		PolicyType:    rest_model.DialBindDial,
+		Semantic:      rest_model.SemanticAllOf,
+	}}, nil
+}
+
+// missingPublicFrontendError is a v1-created share whose frontend selection names no live frontend. it is
+// the share's failure, not the store's: the lookup found no row, which aborts no transaction.
+type missingPublicFrontendError struct {
+	shareToken, publicName string
+}
+
+func (e missingPublicFrontendError) Error() string {
+	return fmt.Sprintf("share '%v' selects frontend '%v', which does not exist", e.shareToken, e.publicName)
+}
+
+// desiredAccessDialPolicies returns the dial policy of each private access to the share, as access creates
+// it. access does not check the share mode, so a public share can have these too.
+func desiredAccessDialPolicies(str *store.Store, shr *store.Share, trx *sqlx.Tx) ([]*automation.ServicePolicyOptions, error) {
+	fes, err := str.FindFrontendsForPrivateShare(shr.Id, trx)
+	if err != nil {
+		return nil, errors.Wrapf(err, "error finding frontends for share '%v'", shr.Token)
+	}
+	var desired []*automation.ServicePolicyOptions
+	for _, fe := range fes {
+		if fe.EnvironmentId == nil {
+			continue
+		}
+		env, err := str.GetEnvironment(*fe.EnvironmentId, trx)
+		if err != nil {
+			return nil, errors.Wrapf(err, "error getting environment for frontend '%v'", fe.Token)
+		}
+		desired = append(desired, &automation.ServicePolicyOptions{
+	
```

**File**: `controller/limits/influxReader.go` (modified, +23/-10)
```diff
@@ -17,15 +17,19 @@ type influxReader struct {
 	cfg      *metrics.InfluxConfig
 	idb      influxdb2.Client
 	queryApi api.QueryAPI
+	timeout  time.Duration
 }
 
-func newInfluxReader(cfg *metrics.InfluxConfig) *influxReader {
+func newInfluxReader(cfg *metrics.InfluxConfig, timeout time.Duration) *influxReader {
+	if timeout <= 0 {
+		timeout = DefaultQueryTimeout
+	}
 	idb := influxdb2.NewClient(cfg.Url, cfg.Token)
 	queryApi := idb.QueryAPI(cfg.Org)
-	return &influxReader{cfg, idb, queryApi}
+	return &influxReader{cfg, idb, queryApi, timeout}
 }
 
-func (r *influxReader) totalRxTxForAccount(acctId int64, duration time.Duration) (int64, int64, error) {
+func (r *influxReader) totalRxTxForAccount(ctx context.Context, acctId int64, duration time.Duration) (int64, int64, error) {
 	query := fmt.Sprintf("from(bucket: \"%v\")\n", r.cfg.Bucket) +
 		fmt.Sprintf("|> range(start: -%v)\n", duration) +
 		"|> filter(fn: (r) => r[\"_measurement\"] == \"xfer\")\n" +
@@ -34,10 +38,10 @@ func (r *influxReader) totalRxTxForAccount(acctId int64, duration time.Duration)
 		fmt.Sprintf("|> filter(fn: (r) => r[\"acctId\"] == \"%d\")\n", acctId) +
 		"|> drop(columns: [\"share\", \"envId\"])\n" +
 		"|> sum()"
-	return r.runQueryForRxTx(query)
+	return r.runQueryForRxTx(ctx, query)
 }
 
-func (r *influxReader) totalRxTxForEnvironment(envId int64, duration time.Duration) (int64, int64, error) {
+func (r *influxReader) totalRxTxForEnvironment(ctx context.Context, envId int64, duration time.Duration) (int64, int64, error) {
 	query := fmt.Sprintf("from(bucket: \"%v\")\n", r.cfg.Bucket) +
 		fmt.Sprintf("|> range(start: -%v)\n", duration) +
 		"|> filter(fn: (r) => r[\"_measurement\"] == \"xfer\")\n" +
@@ -46,25 +50,29 @@ func (r *influxReader) totalRxTxForEnvironment(envId int64, duration time.Durati
 		fmt.Sprintf("|> filter(fn: (r) => r[\"envId\"] == \"%d\")\n", envId) +
 		"|> drop(columns: [\"share\", \"acctId\"])\n" +
 		"|> sum()"
-	return r.runQueryForRxTx(query)
+	return r.runQueryForRxTx(ctx, query)
 }
 
-func (r *influxReader) totalRxTxForShare(shrToken string, duration time.Duration) (int64, int64, error) {
+func (r *influxReader) totalRxTxForShare(ctx context.Context, shrToken string, duration time.Duration) (int64, int64, error) {
 	query := fmt.Sprintf("from(bucket: \"%v\")\n", r.cfg.Bucket) +
 		fmt.Sprintf("|> range(start: -%v)\n", duration) +
 		"|> filter(fn: (r) => r[\"_measurement\"] == \"xfer\")\n" +
 		"|> filter(fn: (r) => r[\"_field\"] == \"rx\" or r[\"_field\"] == \"tx\")\n" +
 		"|> filter(fn: (r) => r[\"namespace\"] == \"backend\")\n" +
 		fmt.Sprintf("|> filter(fn: (r) => r[\"share\"] == \"%v\")\n", shrToken) +
 		"|> sum()"
-	return r.runQueryForRxTx(query)
+	return r.runQueryForRxTx(ctx, query)
 }
 
-func (r *influxReader) runQueryForRxTx(query string) (rx int64, tx int64, err error) {
-	result, err := r.queryApi.Query(context.Background(), query)
+// runQueryForRxTx bounds the query, reading its result included, by the reader's timeout and by ctx.
+func (r *influxReader) runQueryForRxTx(ctx context.Context, query string) (rx int64, tx int64, err error) {
+	ctx, cancel := context.WithTimeout(ctx, r.timeout)
+	defer cancel()
+	result, err := r.queryApi.Query(ctx, query)
 	if err != nil {
 		return -1, -1, err
 	}
+	defer func() { _ = result.Close() }()
 
 	count := 0
 	for result.Next() {
@@ -82,6 +90,11 @@ func (r *influxReader) runQueryForRxTx(query string) (rx int64, tx int64, err er
 		}
 		count++
 	}
+	// a deadline or cancellation part-way through the result ends Next early; reporting that as no usage
+	// would relax a limited account.
+	if err := result.Err(); err != nil {
+		return -1, -1, err
+	}
 	if count != 0 && count != 2 {
 		return -1, -1, errors.Errorf("expected 2 results; got '%d' (%v)", count, strings.ReplaceAll(query, "\n", ""))
 	}
```

**File**: `controller/limits/influxReader_deadline_test.go` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+package limits
+
+import (
+	"context"
+	"net"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/openziti/zrok/v2/controller/metrics"
+	"github.com/openziti/zrok/v2/sdk/golang/sdk"
+	"github.com/stretchr/testify/require"
+)
+
+// silentInflux accepts connections and never answers them. accepted receives once per connection.
+func silentInflux(t *testing.T) (string, <-chan struct{}) {
+	t.Helper()
+	l, err := net.Listen("tcp", "127.0.0.1:0")
+	require.NoError(t, err)
+	accepted := make(chan struct{}, 16)
+	var mu sync.Mutex
+	var conns []net.Conn
+	go func() {
+		for {
+			conn, err := l.Accept()
+			if err != nil {
+				return
+			}
+			mu.Lock()
+			conns = append(conns, conn)
+			mu.Unlock()
+			select {
+			case accepted <- struct{}{}:
+			default:
+			}
+		}
+	}()
+	t.Cleanup(func() {
+		_ = l.Close()
+		mu.Lock()
+		defer mu.Unlock()
+		for _, conn := range conns {
+			_ = conn.Close()
+		}
+	})
+	return "http://" + l.Addr().String(), accepted
+}
+
+func TestInfluxQueryHonoursTimeout(t *testing.T) {
+	url, _ := silentInflux(t)
+	reader := newInfluxReader(&metrics.InfluxConfig{Url: url, Bucket: "zrok", Org: "zrok"}, 200*time.Millisecond)
+
+	start := time.Now()
+	_, _, err := reader.totalRxTxForAccount(context.Background(), 1, time.Hour)
+	require.Error(t, err)
+	require.Less(t, time.Since(start), 5*time.Second)
+}
+
+func TestInfluxQueryEndsWhenAgentStops(t *testing.T) {
+	url, accepted := silentInflux(t)
+	f := newEmptyRelaxFixture(t)
+	trx, err := f.str.Begin()
+	require.NoError(t, err)
+	addLimitedShare(t, f.str, trx, "hung@example.com", sdk.PrivateShareMode)
+	require.NoError(t, trx.Commit())
+	f.agent.cfg.Cycle = 10 * time.Millisecond
+	f.agent.ifx = newInfluxReader(&metrics.InfluxConfig{Url: url, Bucket: "zrok", Org: "zrok"}, time.Hour)
+
+	f.agent.Start()
+	select {
+	case <-accepted:
+	case <-time.After(5 * time.Second):
+		t.Fatal("relax cycle never queried influx")
+	}
+
+	stopped := make(chan struct{})
+	go func() {
+		f.agent.Stop()
+		close(stopped)
+	}()
+	select {
+	case <-stopped:
+	case <-time.After(5 * time.Second):
+		t.Fatal("agent did not stop while its influx query was in flight")
+	}
+}
```

---

### Incident Patch 3: `e770929d` (2026-10-02)
**Commit Message**: relax rebuilds v2 public share dial policies; repair-dial-policies; influx query deadline

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -4,6 +4,14 @@
 
 FIX: `zrok2 admin gc` now decides which share an OpenZiti object belongs to by its `zrokShareToken` tag rather than its name, so it no longer deletes the bind, dial and service edge router policies of live shares; objects with no share token, such as agent-remote services and policies, are never touched. It now reads every object rather than the first page of ten of each kind. It is a dry run by default that prints what it would remove, grouped by share token, and deletes only with `--delete`. Orphaned objects younger than `--min-age` (default 24 hours) are skipped, so a share being created at the time of the run is not collected. Tearing down a share with more than ten OpenZiti objects of one kind, such as a share with many access dial policies, now removes all of them rather than the first ten.
 
+FIX: Accounts holding public shares are now released when their bandwidth usage falls back under the limit. Previously the relax cycle failed for every public share created by v2, because it looked for the v1 frontend selection those shares never have, so the account stayed limited indefinitely after its usage had recovered and its journal entry had to be cleared by hand. The relax now restores a public share's dial policy from the share's names and the frontends serving their namespaces, the same way the share was created; a share created by v1 is still restored from its frontend selection, and a share that has neither had no dial policy to restore and no longer holds the account back.
+
+FIX: When a limited account is released, the private accesses to its public shares (`zrok2 access private` against a public share) now get their access back too. Previously only accesses to private shares were restored, and the others stayed unable to connect until they were recreated.
+
+FIX: The limits agent's InfluxDB queries now have a deadline, `limits.query_timeout` (default 30 seconds), and are cancelled when the controller shuts down. Previously an InfluxDB that accepted a query and never answered held the relax cycle, and so every limit enforcement behind it, open indefinitely and kept the controller from stopping. A query that fails or times out part-way through its result is now reported as a failure rather than as zero usage, so it can no longer release a limited account.
+
+FEATURE: `zrok2 admin repair-dial-policies <configPath>` finds live shares that are missing the dial policies their frontends and private accesses need, such as shares left without them by a limit that was cleared by hand or by a relax that stopped part-way, and with `--apply` recreates them. It is a dry run by default that lists each missing policy by account, share and policy name. Accounts the bandwidth limit journal holds limited, and shares of a backend mode a scoped limit class holds limited, are skipped and listed, so the command never lifts a limit. It never deletes anything, continues past individual OpenZiti failures and past v1 shares whose selected frontend no longer exists (each listed as failed with the frontend it selects), reports how many policies it checked, found missing, created and failed to create, and exits with an error if any failed. Running it again reports nothing missing.
+
 ## v2.0.6
 
 FIX: A share request that fails part-way now removes the OpenZiti objects it created (config, service and policies) and reports the underlying error. Previously the controller logged a `chk_z_id` constraint failure in place of the real OpenZiti error, and any failure after allocation, such as a closed private share granted to an unknown account, left the objects behind with no share owning them. Failed OpenZiti calls now log OpenZiti's own error code and message, such as the name of a conflicting object, where the log previously showed only the operation and HTTP status.
```

**File**: `cmd/zrok2/adminRepairDialPolicies.go` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
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
+	adminCmd.AddCommand(newAdminRepairDialPoliciesCommand().cmd)
+}
+
+type adminRepairDialPoliciesCommand struct {
+	cmd   *cobra.Command
+	apply bool
+}
+
+func newAdminRepairDialPoliciesCommand() *adminRepairDialPoliciesCommand {
+	cmd := &cobra.Command{
+		Use:   "repair-dial-policies <configPath>",
+		Short: "Restore missing dial service policies of unlimited shares (dry run by default)",
+		Long: "Report, and with --apply create, the dial service policies that live shares should have and do not:\n" +
+			"a public share's frontend policy, derived from its name mappings, and the policy of each private access.\n\n" +
+			"Without --apply this is a dry run: nothing is created and the report lists what is missing.\n" +
+			"Accounts the bandwidth limit journal holds limited are skipped, as are shares of a backend mode a\n" +
+			"scoped limit class holds limited. Nothing is ever deleted, and a second run finds nothing missing.",
+		Args: cobra.ExactArgs(1),
+	}
+	command := &adminRepairDialPoliciesCommand{cmd: cmd}
+	cmd.Flags().BoolVar(&command.apply, "apply", false, "Create the missing dial policies (default is a dry run)")
+	cmd.Run = command.run
+	return command
+}
+
+func (c *adminRepairDialPoliciesCommand) run(_ *cobra.Command, args []string) {
+	cfg, err := config.LoadConfig(args[0])
+	if err != nil {
+		panic(err)
+	}
+	dl.Info(dd.MustInspect(cfg))
+	if err := controller.RepairDialPolicies(cfg, c.apply); err != nil {
+		panic(err)
+	}
+}
```

**File**: `controller/automation/zitifake/fake.go` (modified, +13/-1)
```diff
@@ -70,6 +70,7 @@ type Server struct {
 	rejectAuthentication           bool
 	rejectOperations               bool
 	rejectDeletes                  map[string]bool
+	rejectCreates                  map[string]bool
 	authDelay                      time.Duration
 }
 
@@ -95,7 +96,7 @@ func newServer(username, password string) *Server {
 	for _, kind := range []string{Configs, Services, ServicePolicies, ServiceEdgeRouterPolicies, Identities, EdgeRouterPolicies} {
 		objects[kind] = make(map[string]*object)
 	}
-	return &Server{objects: objects, sessions: make(map[string]bool), rejectDeletes: make(map[string]bool), username: username, password: password}
+	return &Server{objects: objects, sessions: make(map[string]bool), rejectDeletes: make(map[string]bool), rejectCreates: make(map[string]bool), username: username, password: password}
 }
 
 func (f *Server) Edge() *rest_management_api_client.ZitiEdgeManagement {
@@ -134,6 +135,13 @@ func (f *Server) RejectDeletes(kind string, reject bool) {
 	f.rejectDeletes[kind] = reject
 }
 
+// RejectCreates answers every create of an object named name with an internal server error.
+func (f *Server) RejectCreates(name string, reject bool) {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	f.rejectCreates[name] = reject
+}
+
 // SetAuthenticationDelay delays every authentication response without blocking other requests.
 func (f *Server) SetAuthenticationDelay(delay time.Duration) {
 	f.mu.Lock()
@@ -414,6 +422,10 @@ func (f *Server) create(w http.ResponseWriter, r *http.Request, kind string) {
 			obj.detail = &rest_model.ServiceEdgeRouterPolicyDetail{BaseEntity: base(id, tags), Name: &obj.name, EdgeRouterRoles: input.EdgeRouterRoles, EdgeRouterRolesDisplay: rest_model.NamedRoles{}, ServiceRoles: input.ServiceRoles, ServiceRolesDisplay: rest_model.NamedRoles{}, Semantic: input.Semantic}
 		}
 	}
+	if f.rejectCreates[name] {
+		writeError(w, http.StatusInternalServerError, labels[kind].noun+" create rejected: "+name)
+		return
+	}
 	if f.beforeCreate != nil {
 		f.beforeCreate(kind, name)
 	}
```

**File**: `controller/limits/agent.go` (modified, +14/-6)
```diff
@@ -30,20 +30,23 @@ type Agent struct {
 	relaxActions   []AccountAction
 	close          chan struct{}
 	join           chan struct{}
+	ctx            context.Context
+	cancel         context.CancelFunc
 	droppedEvents  atomic.Uint64
 }
 
 type bandwidthReader interface {
-	totalRxTxForAccount(int64, time.Duration) (int64, int64, error)
-	totalRxTxForEnvironment(int64, time.Duration) (int64, int64, error)
-	totalRxTxForShare(string, time.Duration) (int64, int64, error)
+	totalRxTxForAccount(context.Context, int64, time.Duration) (int64, int64, error)
+	totalRxTxForEnvironment(context.Context, int64, time.Duration) (int64, int64, error)
+	totalRxTxForShare(context.Context, string, time.Duration) (int64, int64, error)
 }
 
 func NewAgent(cfg *Config, ifxCfg *metrics.InfluxConfig, zCfg *automation.Config, emailCfg *emailUi.Config, str *store.Store) (*Agent, error) {
 	newZiti := func() (*automation.ZitiAutomation, error) { return automation.NewZitiAutomation(zCfg) }
+	ctx, cancel := context.WithCancel(context.Background())
 	a := &Agent{
 		cfg:            cfg,
-		ifx:            newInfluxReader(ifxCfg),
+		ifx:            newInfluxReader(ifxCfg, cfg.QueryTimeout),
 		zCfg:           zCfg,
 		newZiti:        newZiti,
 		str:            str,
@@ -53,6 +56,8 @@ func NewAgent(cfg *Config, ifxCfg *metrics.InfluxConfig, zCfg *automation.Config
 		relaxActions:   []AccountAction{newRelaxAction(str, newZiti)},
 		close:          make(chan struct{}),
 		join:           make(chan struct{}),
+		ctx:            ctx,
+		cancel:         cancel,
 	}
 	return a, nil
 }
@@ -67,7 +72,10 @@ func (a *Agent) Start() {
 	go a.run()
 }
 
+// Stop cancels the agent's context first, so an influx query in flight returns and the run loop can see
+// the close.
 func (a *Agent) Stop() {
+	a.cancel()
 	close(a.close)
 	<-a.join
 }
@@ -464,7 +472,7 @@ func (a *Agent) relax() error {
 
 				if periods, accountFound := accountPeriods[bwje.AccountId]; accountFound {
 					if _, periodFound := periods[bwc.GetPeriodMinutes()]; !periodFound {
-						rx, tx, err := a.ifx.totalRxTxForAccount(int64(bwje.AccountId), time.Duration(bwc.GetPeriodMinutes())*time.Minute)
+						rx, tx, err := a.ifx.totalRxTxForAccount(a.ctx, int64(bwje.AccountId), time.Duration(bwc.GetPeriodMinutes())*time.Minute)
 						if err != nil {
 							return err
 						}
@@ -579,7 +587,7 @@ func (a *Agent) anyBandwidthLimitExceeded(acct *store.Account, u *metrics.Usage,
 
 	for _, bwc := range bwcs {
 		if _, found := periodBw[bwc.GetPeriodMinutes()]; !found {
-			rx, tx, err := a.ifx.totalRxTxForAccount(u.AccountId, time.Minute*time.Duration(bwc.GetPeriodMinutes()))
+			rx, tx, err := a.ifx.totalRxTxForAccount(a.ctx, u.AccountId, time.Minute*time.Duration(bwc.GetPeriodMinutes()))
 			if err != nil {
 				return nil, 0, 0, errors.Wrapf(err, "error getting rx/tx for account '%v'", acct.Email)
 			}
```

**File**: `controller/limits/config.go` (modified, +5/-0)
```diff
@@ -5,6 +5,9 @@ import (
 	"time"
 )
 
+// DefaultQueryTimeout bounds each of the limits agent's influx queries.
+const DefaultQueryTimeout = 30 * time.Second
+
 type Config struct {
 	Environments   int
 	Shares         int
@@ -15,6 +18,7 @@ type Config struct {
 	Cycle          time.Duration
 	Enforcing      bool
 	HandoffTimeout time.Duration
+	QueryTimeout   time.Duration
 }
 
 type BandwidthPerPeriod struct {
@@ -55,5 +59,6 @@ func DefaultConfig() *Config {
 		Bandwidth:      DefaultBandwidthPerPeriod(),
 		Enforcing:      false,
 		Cycle:          15 * time.Minute,
+		QueryTimeout:   DefaultQueryTimeout,
 	}
 }
```

**File**: `controller/limits/dialPolicies.go` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+package limits
+
+import (
+	"database/sql"
+	"fmt"
+
+	"github.com/jmoiron/sqlx"
+	"github.com/michaelquigley/df/dl"
+	"github.com/openziti/edge-api/rest_model"
+	"github.com/openziti/zrok/v2/controller/automation"
+	"github.com/openziti/zrok/v2/controller/store"
+	"github.com/openziti/zrok/v2/sdk/golang/sdk"
+	"github.com/pkg/errors"
+)
+
+// desiredDialPolicies returns every dial service policy a live share should have: the frontend policy of a
+// public share and the policy of each private access to a share of either mode. the errors are store errors.
+func desiredDialPolicies(str *store.Store, shr *store.Share, trx *sqlx.Tx) ([]*automation.ServicePolicyOptions, error) {
+	var desired []*automation.ServicePolicyOptions
+	if shr.ShareMode == string(sdk.PublicShareMode) {
+		public, err := desiredPublicDialPolicies(str, shr, trx)
+		if err != nil {
+			return nil, err
+		}
+		desired = append(desired, public...)
+	}
+	access, err := desiredAccessDialPolicies(str, shr, trx)
+	if err != nil {
+		return nil, err
+	}
+	return append(desired, access...), nil
+}
+
+// desiredPublicDialPolicies derives a public share's frontend dial policy the way allocatePublicResources
+// creates it: from the share's live name mappings, each name's namespace, and that namespace's frontends.
+// frontend_selection is v1's column and v2 never writes it, so it is consulted only for a v1-created row,
+// one with no live mappings. a share with neither has no dial policy to restore; its create made none.
+func desiredPublicDialPolicies(str *store.Store, shr *store.Share, trx *sqlx.Tx) ([]*automation.ServicePolicyOptions, error) {
+	env, err := str.GetEnvironment(shr.EnvironmentId, trx)
+	if err != nil {
+		return nil, errors.Wrapf(err, "error finding environment for share '%v'", shr.Token)
+	}
+	details, err := str.FindShareNameCleanupDetailsByShareId(shr.Id, trx)
+	if err != nil {
+		return nil, errors.Wrapf(err, "error finding name mappings for share '%v'", shr.Token)
+	}
+
+	var frontendZIds []string
+	mapped := false
+	seenNamespaces := make(map[int]bool)
+	seenFrontends := make(map[string]bool)
+	for _, detail := range details {
+		if detail.NameDeleted || detail.NamespaceDeleted {
+			continue
+		}
+		mapped = true
+		if seenNamespaces[detail.NamespaceID] {
+			continue
+		}
+		seenNamespaces[detail.NamespaceID] = true
+		fes, err := str.FindFrontendsForNamespace(detail.NamespaceID, trx)
+		if err != nil {
+			return nil, errors.Wrapf(err, "error finding frontends for namespace '%v'", detail.NamespaceName)
+		}
+		for _, fe := range fes {
+			if !seenFrontends[fe.ZId] {
+				seenFrontends[fe.ZId] = true
+				frontendZIds = append(frontendZIds, fe.ZId)
+			}
+		}
+	}
+
+	if !mapped && shr.FrontendSelection != nil {
+		fe, err := str.FindFrontendPubliclyNamed(*shr.FrontendSelection, trx)
+		if errors.Is(err, sql.ErrNoRows) {
+			return nil, missingPublicFrontendError{shareToken: shr.Token, publicName: *shr.FrontendSelection}
+		}
+		if err != nil {
+			return nil, errors.Wrapf(err, "error finding frontend name '%v' for '%v'", *shr.FrontendSelection, shr.Token)
+		}
+		frontendZIds = []string{fe.ZId}
+	}
+
+	if len(frontendZIds) == 0 {
+		return nil, nil
+	}
+	var identityRoles []string
+	for _, zId := range frontendZIds {
+		identityRoles = append(identityRoles, "@"+zId)
+	}
+	return []*automation.ServicePolicyOptions{{
+		BaseOptions: automation.BaseOptions{
+			Name: env.ZId + "-" + shr.ZId + "-dial",
+			Tags: automation.ZrokShareTags(shr.Token),
+		},
+		IdentityRoles: identityRoles,
+		ServiceRoles:  []string{"@" + shr.ZId},
+		PolicyType:    rest_model.DialBindDial,
+		Semantic:      rest_model.SemanticAllOf,
+	}}, nil
+}
+
+// missingPublicFrontendError is a v1-created share whose frontend selection names no live frontend. it is
+// the share's failure, not the store's: the lookup found no row, which aborts no transaction.
+type missingPublicFrontendError struct {
+	shareToken, publicName string
+}
+
+func (e missingPublicFrontendError) Error() string {
+	return fmt.Sprintf("share '%v' selects frontend '%v', which does not exist", e.shareToken, e.publicName)
+}
+
+// desiredAccessDialPolicies returns the dial policy of each private access to the share, as access creates
+// it. access does not check the share mode, so a public share can have these too.
+func desiredAccessDialPolicies(str *store.Store, shr *store.Share, trx *sqlx.Tx) ([]*automation.ServicePolicyOptions, error) {
+	fes, err := str.FindFrontendsForPrivateShare(shr.Id, trx)
+	if err != nil {
+		return nil, errors.Wrapf(err, "error finding frontends for share '%v'", shr.Token)
+	}
+	var desired []*automation.ServicePolicyOptions
+	for _, fe := range fes {
+		if fe.EnvironmentId == nil {
+			continue
+		}
+		env, err := str.GetEnvironment(*fe.EnvironmentId, trx)
+		if err != nil {
+			return nil, errors.Wrapf(err, "error getting environment for frontend '%v'", fe.Token)
+		}
+		desired = append(desired, &automation.ServicePolicyOptions{
+	
```

**File**: `controller/limits/influxReader.go` (modified, +23/-10)
```diff
@@ -17,15 +17,19 @@ type influxReader struct {
 	cfg      *metrics.InfluxConfig
 	idb      influxdb2.Client
 	queryApi api.QueryAPI
+	timeout  time.Duration
 }
 
-func newInfluxReader(cfg *metrics.InfluxConfig) *influxReader {
+func newInfluxReader(cfg *metrics.InfluxConfig, timeout time.Duration) *influxReader {
+	if timeout <= 0 {
+		timeout = DefaultQueryTimeout
+	}
 	idb := influxdb2.NewClient(cfg.Url, cfg.Token)
 	queryApi := idb.QueryAPI(cfg.Org)
-	return &influxReader{cfg, idb, queryApi}
+	return &influxReader{cfg, idb, queryApi, timeout}
 }
 
-func (r *influxReader) totalRxTxForAccount(acctId int64, duration time.Duration) (int64, int64, error) {
+func (r *influxReader) totalRxTxForAccount(ctx context.Context, acctId int64, duration time.Duration) (int64, int64, error) {
 	query := fmt.Sprintf("from(bucket: \"%v\")\n", r.cfg.Bucket) +
 		fmt.Sprintf("|> range(start: -%v)\n", duration) +
 		"|> filter(fn: (r) => r[\"_measurement\"] == \"xfer\")\n" +
@@ -34,10 +38,10 @@ func (r *influxReader) totalRxTxForAccount(acctId int64, duration time.Duration)
 		fmt.Sprintf("|> filter(fn: (r) => r[\"acctId\"] == \"%d\")\n", acctId) +
 		"|> drop(columns: [\"share\", \"envId\"])\n" +
 		"|> sum()"
-	return r.runQueryForRxTx(query)
+	return r.runQueryForRxTx(ctx, query)
 }
 
-func (r *influxReader) totalRxTxForEnvironment(envId int64, duration time.Duration) (int64, int64, error) {
+func (r *influxReader) totalRxTxForEnvironment(ctx context.Context, envId int64, duration time.Duration) (int64, int64, error) {
 	query := fmt.Sprintf("from(bucket: \"%v\")\n", r.cfg.Bucket) +
 		fmt.Sprintf("|> range(start: -%v)\n", duration) +
 		"|> filter(fn: (r) => r[\"_measurement\"] == \"xfer\")\n" +
@@ -46,25 +50,29 @@ func (r *influxReader) totalRxTxForEnvironment(envId int64, duration time.Durati
 		fmt.Sprintf("|> filter(fn: (r) => r[\"envId\"] == \"%d\")\n", envId) +
 		"|> drop(columns: [\"share\", \"acctId\"])\n" +
 		"|> sum()"
-	return r.runQueryForRxTx(query)
+	return r.runQueryForRxTx(ctx, query)
 }
 
-func (r *influxReader) totalRxTxForShare(shrToken string, duration time.Duration) (int64, int64, error) {
+func (r *influxReader) totalRxTxForShare(ctx context.Context, shrToken string, duration time.Duration) (int64, int64, error) {
 	query := fmt.Sprintf("from(bucket: \"%v\")\n", r.cfg.Bucket) +
 		fmt.Sprintf("|> range(start: -%v)\n", duration) +
 		"|> filter(fn: (r) => r[\"_measurement\"] == \"xfer\")\n" +
 		"|> filter(fn: (r) => r[\"_field\"] == \"rx\" or r[\"_field\"] == \"tx\")\n" +
 		"|> filter(fn: (r) => r[\"namespace\"] == \"backend\")\n" +
 		fmt.Sprintf("|> filter(fn: (r) => r[\"share\"] == \"%v\")\n", shrToken) +
 		"|> sum()"
-	return r.runQueryForRxTx(query)
+	return r.runQueryForRxTx(ctx, query)
 }
 
-func (r *influxReader) runQueryForRxTx(query string) (rx int64, tx int64, err error) {
-	result, err := r.queryApi.Query(context.Background(), query)
+// runQueryForRxTx bounds the query, reading its result included, by the reader's timeout and by ctx.
+func (r *influxReader) runQueryForRxTx(ctx context.Context, query string) (rx int64, tx int64, err error) {
+	ctx, cancel := context.WithTimeout(ctx, r.timeout)
+	defer cancel()
+	result, err := r.queryApi.Query(ctx, query)
 	if err != nil {
 		return -1, -1, err
 	}
+	defer func() { _ = result.Close() }()
 
 	count := 0
 	for result.Next() {
@@ -82,6 +90,11 @@ func (r *influxReader) runQueryForRxTx(query string) (rx int64, tx int64, err er
 		}
 		count++
 	}
+	// a deadline or cancellation part-way through the result ends Next early; reporting that as no usage
+	// would relax a limited account.
+	if err := result.Err(); err != nil {
+		return -1, -1, err
+	}
 	if count != 0 && count != 2 {
 		return -1, -1, errors.Errorf("expected 2 results; got '%d' (%v)", count, strings.ReplaceAll(query, "\n", ""))
 	}
```

**File**: `controller/limits/influxReader_deadline_test.go` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+package limits
+
+import (
+	"context"
+	"net"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/openziti/zrok/v2/controller/metrics"
+	"github.com/openziti/zrok/v2/sdk/golang/sdk"
+	"github.com/stretchr/testify/require"
+)
+
+// silentInflux accepts connections and never answers them. accepted receives once per connection.
+func silentInflux(t *testing.T) (string, <-chan struct{}) {
+	t.Helper()
+	l, err := net.Listen("tcp", "127.0.0.1:0")
+	require.NoError(t, err)
+	accepted := make(chan struct{}, 16)
+	var mu sync.Mutex
+	var conns []net.Conn
+	go func() {
+		for {
+			conn, err := l.Accept()
+			if err != nil {
+				return
+			}
+			mu.Lock()
+			conns = append(conns, conn)
+			mu.Unlock()
+			select {
+			case accepted <- struct{}{}:
+			default:
+			}
+		}
+	}()
+	t.Cleanup(func() {
+		_ = l.Close()
+		mu.Lock()
+		defer mu.Unlock()
+		for _, conn := range conns {
+			_ = conn.Close()
+		}
+	})
+	return "http://" + l.Addr().String(), accepted
+}
+
+func TestInfluxQueryHonoursTimeout(t *testing.T) {
+	url, _ := silentInflux(t)
+	reader := newInfluxReader(&metrics.InfluxConfig{Url: url, Bucket: "zrok", Org: "zrok"}, 200*time.Millisecond)
+
+	start := time.Now()
+	_, _, err := reader.totalRxTxForAccount(context.Background(), 1, time.Hour)
+	require.Error(t, err)
+	require.Less(t, time.Since(start), 5*time.Second)
+}
+
+func TestInfluxQueryEndsWhenAgentStops(t *testing.T) {
+	url, accepted := silentInflux(t)
+	f := newEmptyRelaxFixture(t)
+	trx, err := f.str.Begin()
+	require.NoError(t, err)
+	addLimitedShare(t, f.str, trx, "hung@example.com", sdk.PrivateShareMode)
+	require.NoError(t, trx.Commit())
+	f.agent.cfg.Cycle = 10 * time.Millisecond
+	f.agent.ifx = newInfluxReader(&metrics.InfluxConfig{Url: url, Bucket: "zrok", Org: "zrok"}, time.Hour)
+
+	f.agent.Start()
+	select {
+	case <-accepted:
+	case <-time.After(5 * time.Second):
+		t.Fatal("relax cycle never queried influx")
+	}
+
+	stopped := make(chan struct{})
+	go func() {
+		f.agent.Stop()
+		close(stopped)
+	}()
+	select {
+	case <-stopped:
+	case <-time.After(5 * time.Second):
+		t.Fatal("agent did not stop while its influx query was in flight")
+	}
+}
```

---

### Incident Patch 4: `a9a55d4d` (2026-10-02)
**Commit Message**: Merge pull request #1281 from openziti/fall-fixes-s12

garbage collection improvements

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+FIX: `zrok2 admin gc` now decides which share an OpenZiti object belongs to by its `zrokShareToken` tag rather than its name, so it no longer deletes the bind, dial and service edge router policies of live shares; objects with no share token, such as agent-remote services and policies, are never touched. It now reads every object rather than the first page of ten of each kind. It is a dry run by default that prints what it would remove, grouped by share token, and deletes only with `--delete`. Orphaned objects younger than `--min-age` (default 24 hours) are skipped, so a share being created at the time of the run is not collected. Tearing down a share with more than ten OpenZiti objects of one kind, such as a share with many access dial policies, now removes all of them rather than the first ten.
+
 ## v2.0.6
 
 FIX: A share request that fails part-way now removes the OpenZiti objects it created (config, service and policies) and reports the underlying error. Previously the controller logged a `chk_z_id` constraint failure in place of the real OpenZiti error, and any failure after allocation, such as a closed private share granted to an unknown account, left the objects behind with no share owning them. Failed OpenZiti calls now log OpenZiti's own error code and message, such as the name of a conflicting object, where the log previously showed only the operation and HTTP status.
```

**File**: `cmd/zrok2/adminGc.go` (modified, +15/-4)
```diff
@@ -1,6 +1,8 @@
 package main
 
 import (
+	"time"
+
 	"github.com/michaelquigley/df/dd"
 	"github.com/michaelquigley/df/dl"
 	"github.com/openziti/zrok/v2/controller"
@@ -13,16 +15,25 @@ func init() {
 }
 
 type adminGcCommand struct {
-	cmd *cobra.Command
+	cmd    *cobra.Command
+	delete bool
+	minAge time.Duration
 }
 
 func newAdminGcCommand() *adminGcCommand {
 	cmd := &cobra.Command{
 		Use:   "gc <configPath>",
-		Short: "Garbage collect a zrok instance",
-		Args:  cobra.ExactArgs(1),
+		Short: "Garbage collect orphaned OpenZiti objects (dry run by default)",
+		Long: "Report, and with --delete remove, the OpenZiti services, configs, service policies and service edge\n" +
+			"router policies whose zrokShareToken tag names no live share.\n\n" +
+			"Without --delete this is a dry run: nothing is deleted and the report lists what would be.\n" +
+			"Objects without a zrokShareToken tag are never touched, and orphans younger than --min-age\n" +
+			"(default 24h) are skipped so that a share being created is not collected.",
+		Args: cobra.ExactArgs(1),
 	}
 	command := &adminGcCommand{cmd: cmd}
+	cmd.Flags().BoolVar(&command.delete, "delete", false, "Delete the orphaned objects (default is a dry run)")
+	cmd.Flags().DurationVar(&command.minAge, "min-age", controller.DefaultGCMinAge, "Skip orphaned objects younger than this")
 	cmd.Run = command.run
 	return command
 }
@@ -33,7 +44,7 @@ func (gc *adminGcCommand) run(_ *cobra.Command, args []string) {
 		panic(err)
 	}
 	dl.Info(dd.MustInspect(cfg))
-	if err := controller.GC(cfg); err != nil {
+	if err := controller.GC(cfg, controller.GCOptions{Delete: gc.delete, MinAge: gc.minAge}); err != nil {
 		panic(err)
 	}
 }
```

**File**: `controller/automation/findAll_test.go` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+package automation
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/require"
+)
+
+// TestFindAllClampsPageSize lists through a finder that caps every page at MaxPageSize, as ziti does; a
+// requested page above the cap must not read the capped answer as the last page.
+func TestFindAllClampsPageSize(t *testing.T) {
+	items := make([]*int, 1203)
+	for i := range items {
+		items[i] = new(int)
+		*items[i] = i
+	}
+	var limits []int64
+	finder := func(opts *FilterOptions) ([]*int, error) {
+		limits = append(limits, opts.Limit)
+		limit := min(opts.Limit, MaxPageSize)
+		start := min(opts.Offset, int64(len(items)))
+		return items[start:min(start+limit, int64(len(items)))], nil
+	}
+	for _, pageSize := range []int64{0, MaxPageSize + 500} {
+		limits = nil
+		all, err := FindAll(finder, "", pageSize)
+		require.NoError(t, err)
+		require.Equal(t, items, all)
+		require.Equal(t, []int64{MaxPageSize, MaxPageSize, MaxPageSize}, limits)
+	}
+}
```

**File**: `controller/automation/resource.go` (modified, +28/-3)
```diff
@@ -184,10 +184,10 @@ func GetByName[T any](finder func(*FilterOptions) ([]*T, error), name string, re
 	return items[0], nil
 }
 
-// generic helper for bulk delete operations
+// generic helper for bulk delete operations. every match is listed before the first delete, so the
+// deletes cannot shift the pages still to be read.
 func DeleteWithFilter[T any](finder func(*FilterOptions) ([]*T, error), deleter func(string) error, filter string, resourceType string) error {
-	opts := &FilterOptions{Filter: filter}
-	items, err := finder(opts)
+	items, err := FindAll(finder, filter, MaxPageSize)
 	if err != nil {
 		return errors.Wrapf(err, "error finding %s for deletion", resourceType)
 	}
@@ -210,6 +210,31 @@ func DeleteWithFilter[T any](finder func(*FilterOptions) ([]*T, error), deleter
 	return nil
 }
 
+// MaxPageSize is the largest page the ziti management api serves; a limit of zero gets its default
+// page of ten, not everything.
+const MaxPageSize int64 = 500
+
+// FindAll reads every object matching filter, pageSize at a time with an advancing offset, until a page
+// comes back short. a pageSize of zero or less, or above MaxPageSize, reads MaxPageSize at a time, since
+// ziti would cap a larger page and the short answer would end the listing early.
+func FindAll[T any](finder func(*FilterOptions) ([]*T, error), filter string, pageSize int64) ([]*T, error) {
+	if pageSize <= 0 || pageSize > MaxPageSize {
+		pageSize = MaxPageSize
+	}
+	var all []*T
+	for offset := int64(0); ; {
+		page, err := finder(&FilterOptions{Filter: filter, Limit: pageSize, Offset: offset})
+		if err != nil {
+			return nil, errors.Wrapf(err, "error listing page at offset '%d'", offset)
+		}
+		all = append(all, page...)
+		if int64(len(page)) < pageSize {
+			return all, nil
+		}
+		offset += int64(len(page))
+	}
+}
+
 // helper to extract ID from any resource type
 func getResourceID(item interface{}) (string, error) {
 	switch v := item.(type) {
```

**File**: `controller/automation/zitifake/fake.go` (modified, +66/-2)
```diff
@@ -6,6 +6,7 @@ import (
 	"net/http"
 	"net/http/httptest"
 	"sort"
+	"strconv"
 	"strings"
 	"sync"
 	"time"
@@ -27,6 +28,12 @@ const (
 	EdgeRouterPolicies        = "edge-router-policies"
 )
 
+// ziti's page sizes: the page served for a missing or zero limit, and the largest it serves.
+const (
+	defaultPageSize = 10
+	maxPageSize     = 500
+)
+
 var labels = map[string]struct{ id, noun string }{
 	Configs:                   {"config", "config"},
 	Services:                  {"service", "service"},
@@ -62,6 +69,7 @@ type Server struct {
 	unauthorized                   int
 	rejectAuthentication           bool
 	rejectOperations               bool
+	rejectDeletes                  map[string]bool
 	authDelay                      time.Duration
 }
 
@@ -87,7 +95,7 @@ func newServer(username, password string) *Server {
 	for _, kind := range []string{Configs, Services, ServicePolicies, ServiceEdgeRouterPolicies, Identities, EdgeRouterPolicies} {
 		objects[kind] = make(map[string]*object)
 	}
-	return &Server{objects: objects, sessions: make(map[string]bool), username: username, password: password}
+	return &Server{objects: objects, sessions: make(map[string]bool), rejectDeletes: make(map[string]bool), username: username, password: password}
 }
 
 func (f *Server) Edge() *rest_management_api_client.ZitiEdgeManagement {
@@ -119,6 +127,13 @@ func (f *Server) RejectOperations(reject bool) {
 	f.rejectOperations = reject
 }
 
+// RejectDeletes answers every delete of kind with an internal server error.
+func (f *Server) RejectDeletes(kind string, reject bool) {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	f.rejectDeletes[kind] = reject
+}
+
 // SetAuthenticationDelay delays every authentication response without blocking other requests.
 func (f *Server) SetAuthenticationDelay(delay time.Duration) {
 	f.mu.Lock()
@@ -158,6 +173,21 @@ func (f *Server) SeedWithID(kind, id, name string, tags *rest_model.Tags) {
 	f.seed(kind, id, name, tags)
 }
 
+// Backdate moves the createdAt of the object of kind with id age into the past.
+func (f *Server) Backdate(kind, id string, age time.Duration) {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	createdAt := strfmt.DateTime(time.Now().Add(-age))
+	baseOf(f.objects[kind][id].detail).CreatedAt = &createdAt
+}
+
+// Len reports how many objects of kind the fake holds.
+func (f *Server) Len(kind string) int {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	return len(f.objects[kind])
+}
+
 // Has reports whether an object of kind exists with id.
 func (f *Server) Has(kind, id string) bool {
 	f.mu.Lock()
@@ -315,6 +345,25 @@ func base(id string, tags *rest_model.Tags) rest_model.BaseEntity {
 	return rest_model.BaseEntity{ID: &id, Tags: tags, CreatedAt: &now, UpdatedAt: &now, Links: rest_model.Links{}}
 }
 
+func baseOf(detail interface{}) *rest_model.BaseEntity {
+	switch v := detail.(type) {
+	case *rest_model.ConfigDetail:
+		return &v.BaseEntity
+	case *rest_model.ServiceDetail:
+		return &v.BaseEntity
+	case *rest_model.ServicePolicyDetail:
+		return &v.BaseEntity
+	case *rest_model.ServiceEdgeRouterPolicyDetail:
+		return &v.BaseEntity
+	case *rest_model.IdentityDetail:
+		return &v.BaseEntity
+	case *rest_model.EdgeRouterPolicyDetail:
+		return &v.BaseEntity
+	default:
+		panic(fmt.Sprintf("unknown detail %T", detail))
+	}
+}
+
 func (f *Server) create(w http.ResponseWriter, r *http.Request, kind string) {
 	var name string
 	var tags *rest_model.Tags
@@ -390,8 +439,17 @@ func (f *Server) create(w http.ResponseWriter, r *http.Request, kind string) {
 	writeJSON(w, 201, &rest_model.CreateEnvelope{Data: &rest_model.CreateLocation{ID: id}, Meta: &rest_model.Meta{}})
 }
 
+// list pages like ziti: a missing or zero limit is the default page of ten, a larger one is capped at
+// 500, and offset skips into the matches in id order.
 func (f *Server) list(w http.ResponseWriter, r *http.Request, kind string) {
-	filter := r.URL.Query().Get("filter")
+	query := r.URL.Query()
+	filter := query.Get("filter")
+	limit, _ := strconv.Atoi(query.Get("limit"))
+	if limit <= 0 {
+		limit = defaultPageSize
+	}
+	limit = min(limit, maxPageSize)
+	offset, _ := strconv.Atoi(query.Get("offset"))
 	ids := make([]string, 0, len(f.objects[kind]))
 	for id := range f.objects[kind] {
 		ids = append(ids, id)
@@ -404,6 +462,8 @@ func (f *Server) list(w http.ResponseWriter, r *http.Request, kind string) {
 			matched = append(matched, obj)
 		}
 	}
+	matched = matched[min(offset, len(matched)):]
+	matched = matched[:min(limit, len(matched))]
 	switch kind {
 	case Configs:
 		writeJSON(w, 200, &rest_model.ListConfigsEnvelope{Data: details[rest_model.ConfigDetail](matched), Meta: &rest_model.Meta{}})
@@ -451,6 +511,10 @@ func (f *Server) detail(w http.ResponseWriter, kind, id string) {
 }
 
 func (f *Server) delete(w http.ResponseWriter, kind, id string) {
+	if f.rejectDeletes[kind] {
+		writeError(w, http.StatusInternalServerError, labels[kind].noun+" delete rejected: "+id)
+		return
+	}
 	if f.objects[kind][id] == nil {
 		wr
```

**File**: `controller/automation/zitifake/fake_test.go` (modified, +19/-0)
```diff
@@ -2,6 +2,7 @@ package zitifake
 
 import (
 	"errors"
+	"fmt"
 	"testing"
 
 	"github.com/openziti/edge-api/rest_management_api_client/service_policy"
@@ -60,3 +61,21 @@ func TestServiceRoutes(t *testing.T) {
 	require.Equal(t, 1, creates)
 	require.Equal(t, 1, deletes)
 }
+
+func TestDeleteWithFilterReadsEveryPage(t *testing.T) {
+	fake := New()
+	defer fake.Close()
+	ziti := automation.NewZitiAutomationWithEdge(fake.Edge())
+	// more than ziti's default page of ten, and more than two of them.
+	for i := 0; i < 25; i++ {
+		id := fmt.Sprintf("policy-%02d", i)
+		fake.SeedWithID(ServicePolicies, id, id, automation.ZrokShareTags("share-one").ToRestModel())
+	}
+	fake.SeedWithID(ServicePolicies, "other", "other", automation.ZrokShareTags("share-two").ToRestModel())
+
+	require.NoError(t, ziti.ServicePolicies.DeleteWithFilter(automation.BuildTagFilter("zrokShareToken", "share-one")))
+	require.Empty(t, fake.Tagged("zrokShareToken", "share-one"))
+	_, deleted := fake.Log()
+	require.Len(t, deleted, 25)
+	require.True(t, fake.Has(ServicePolicies, "other"))
+}
```

**File**: `controller/gc.go` (modified, +253/-124)
```diff
@@ -1,16 +1,157 @@
 package controller
 
 import (
-	"strings"
+	"fmt"
+	"io"
+	"os"
+	"sort"
+	"text/tabwriter"
+	"time"
 
 	"github.com/michaelquigley/df/dl"
+	"github.com/openziti/edge-api/rest_model"
 	"github.com/openziti/zrok/v2/controller/automation"
 	zrok_config "github.com/openziti/zrok/v2/controller/config"
 	"github.com/openziti/zrok/v2/controller/store"
 	"github.com/pkg/errors"
 )
 
-func GC(inCfg *zrok_config.Config) error {
+// DefaultGCMinAge is how old an orphaned object must be before gc touches it. a day is well clear of
+// clock skew between the ziti and zrok hosts, and with the leak stopped nothing younger needs reclaiming.
+// any guard at all also keeps gc off a share whose
+// ziti objects are allocated but whose row has not yet committed is never collected.
+const DefaultGCMinAge = 24 * time.Hour
+
+type GCOptions struct {
+	// Delete removes the orphaned objects; without it gc only reports.
+	Delete bool
+	// MinAge skips orphaned objects younger than this by their createdAt.
+	MinAge time.Duration
+	// pageSize overrides automation.MaxPageSize for tests.
+	pageSize int64
+}
+
+// gcFilter lists everything zrok tagged; ownership is then decided by the zrokShareToken tag.
+const gcFilter = "tags.zrok != null"
+
+const gcShareTokenTag = "zrokShareToken"
+
+// gcKind is one kind of ziti object gc collects. gcKinds returns them in deletion order.
+type gcKind struct {
+	name   string
+	list   func(pageSize int64) ([]*gcObject, error)
+	delete func(id string) error
+}
+
+// gcKinds lists the kinds in the order their orphans are deleted: policies and configs before services,
+// so a service is never left referenced by an object that outlives it.
+func gcKinds(ziti *automation.ZitiAutomation) []*gcKind {
+	return []*gcKind{
+		{
+			name: "service edge router policies",
+			list: func(pageSize int64) ([]*gcObject, error) {
+				return gcList(ziti.ServiceEdgeRouterPolicies.Find, pageSize, func(v *rest_model.ServiceEdgeRouterPolicyDetail) (*rest_model.BaseEntity, *string) {
+					return &v.BaseEntity, v.Name
+				})
+			},
+			delete: ziti.ServiceEdgeRouterPolicies.Delete,
+		},
+		{
+			name: "service policies",
+			list: func(pageSize int64) ([]*gcObject, error) {
+				return gcList(ziti.ServicePolicies.Find, pageSize, func(v *rest_model.ServicePolicyDetail) (*rest_model.BaseEntity, *string) {
+					return &v.BaseEntity, v.Name
+				})
+			},
+			delete: ziti.ServicePolicies.Delete,
+		},
+		{
+			name: "configs",
+			list: func(pageSize int64) ([]*gcObject, error) {
+				return gcList(ziti.Configs.Find, pageSize, func(v *rest_model.ConfigDetail) (*rest_model.BaseEntity, *string) {
+					return &v.BaseEntity, v.Name
+				})
+			},
+			delete: ziti.Configs.Delete,
+		},
+		{
+			name: "services",
+			list: func(pageSize int64) ([]*gcObject, error) {
+				return gcList(ziti.Services.Find, pageSize, func(v *rest_model.ServiceDetail) (*rest_model.BaseEntity, *string) {
+					return &v.BaseEntity, v.Name
+				})
+			},
+			delete: ziti.Services.Delete,
+		},
+	}
+}
+
+type gcObject struct {
+	id         string
+	name       string
+	shareToken string
+	createdAt  time.Time
+	hasCreated bool
+}
+
+func gcList[T any](finder func(*automation.FilterOptions) ([]*T, error), pageSize int64, entity func(*T) (*rest_model.BaseEntity, *string)) ([]*gcObject, error) {
+	items, err := automation.FindAll(finder, gcFilter, pageSize)
+	if err != nil {
+		return nil, err
+	}
+	seen := make(map[string]bool, len(items))
+	out := make([]*gcObject, 0, len(items))
+	for _, item := range items {
+		base, name := entity(item)
+		if base.ID == nil || seen[*base.ID] {
+			// an offset listing can repeat an object when another process deletes concurrently.
+			continue
+		}
+		seen[*base.ID] = true
+		obj := &gcObject{id: *base.ID}
+		if name != nil {
+			obj.name = *name
+		}
+		if base.Tags != nil {
+			if token, ok := base.Tags.SubTags[gcShareTokenTag].(string); ok {
+				obj.shareToken = token
+			}
+		}
+		if base.CreatedAt != nil {
+			obj.createdAt = time.Time(*base.CreatedAt)
+			obj.hasCreated = true
+		}
+		out = append(out, obj)
+	}
+	return out, nil
+}
+
+type gcKindReport struct {
+	kind     *gcKind
+	live     int
+	tooYoung int
+	unowned  int
+	orphans  []*gcObject
+
+	deleted     int
+	alreadyGone int
+	failed      int
+}
+
+func (r *gcKindReport) total() int {
+	return r.live + len(r.orphans) + r.tooYoung + r.unowned
+}
+
+type gcReport struct {
+	liveShares int
+	minAge     time.Duration
+	deleteMode bool
+	kinds      []*gcKindReport
+}
+
+// GC reports, and with opts.Delete removes, the ziti objects carrying a zrokShareToken tag whose token
+// belongs to no live share.
+func GC(inCfg *zrok_config.Config, opts GCOptions) error {
 	cfg = inCfg
 	if v, err := store.Open(cfg.Store); err == nil {
 		str = v
@@ -22,163 +163,151 @@ func GC(inCfg *zrok_config.Config) error {
 			dl.Errorf("error closing store: %v", err)
 		}
 	}()
-	trx, err := str.Begin()
-	if err != nil {
-		return err
-	}
-	defer func() 
```

**File**: `controller/gc_test.go` (added, +267/-0)
```diff
@@ -0,0 +1,267 @@
+package controller
+
+import (
+	"bytes"
+	"fmt"
+	"slices"
+	"sort"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/openziti/zrok/v2/controller/automation"
+	"github.com/openziti/zrok/v2/controller/automation/zitifake"
+	"github.com/openziti/zrok/v2/controller/store"
+	"github.com/stretchr/testify/require"
+)
+
+// gcKindOrder is the fake's name for each kind, in gc's deletion order.
+var gcKindOrder = []string{zitifake.ServiceEdgeRouterPolicies, zitifake.ServicePolicies, zitifake.Configs, zitifake.Services}
+
+const (
+	gcLivePublic  = "livepub"
+	gcLivePrivate = "livepriv"
+	gcOrphan      = "orphan"
+	gcYoungOrphan = "youngorphan"
+)
+
+type gcFixture struct {
+	*shareCreateFixture
+	ziti *automation.ZitiAutomation
+	// orphans and kept are 'kind/id' for the old orphan's objects and for everything gc must leave.
+	orphans, kept []string
+	youngOrphans  []string
+}
+
+// setupGCFixture seeds the fake with objects tagged the way the real paths tag them: a live public share,
+// a live private share with an access-path dial policy, an agent-remote set, an orphaned share whose row
+// is deleted, an untagged object, a zrok-only object and a young orphan. everything but the young orphan
+// is backdated past the age guard, so only the share token keeps the live shares' objects.
+func setupGCFixture(t *testing.T) *gcFixture {
+	t.Helper()
+	f := &gcFixture{shareCreateFixture: setupShareCreateFixture(t)}
+	var err error
+	f.ziti, err = automation.NewZitiAutomation(cfg.Ziti)
+	require.NoError(t, err)
+
+	trx, err := str.Begin()
+	require.NoError(t, err)
+	envs, err := str.FindEnvironmentsForAccount(int(f.principal.ID), trx)
+	require.NoError(t, err)
+	envID := envs[0].Id
+	for _, token := range []string{gcLivePublic, gcLivePrivate, gcOrphan} {
+		mode := "public"
+		if token == gcLivePrivate {
+			mode = "private"
+		}
+		shrID, err := str.CreateShare(envID, &store.Share{ZId: token + "-svc", Token: token, ShareMode: mode, BackendMode: "proxy", PermissionMode: store.OpenPermissionMode}, trx)
+		require.NoError(t, err)
+		if token == gcOrphan {
+			require.NoError(t, str.DeleteShare(shrID, trx))
+		}
+	}
+	require.NoError(t, trx.Commit())
+
+	old := 2 * DefaultGCMinAge
+	seed := func(kind, id, name string, tags *automation.Tags, age time.Duration) string {
+		if tags == nil {
+			f.fake.SeedWithID(kind, id, name, nil)
+		} else {
+			f.fake.SeedWithID(kind, id, name, tags.ToRestModel())
+		}
+		if age > 0 {
+			f.fake.Backdate(kind, id, age)
+		}
+		return kind + "/" + id
+	}
+	shareSet := func(token string, age time.Duration, dial bool) []string {
+		tags := automation.ZrokShareTags(token)
+		set := []string{
+			seed(zitifake.Configs, token+"-cfg", token, tags, age),
+			seed(zitifake.Services, token+"-svc", token, tags, age),
+			seed(zitifake.ServicePolicies, token+"-bind", "env-zid-"+token+"-svc-bind", tags, age),
+			seed(zitifake.ServiceEdgeRouterPolicies, token+"-serp", "env-zid-"+token+"-serp", tags, age),
+		}
+		if dial {
+			set = append(set, seed(zitifake.ServicePolicies, token+"-dial", "env-zid-"+token+"-svc-dial", tags, age))
+		}
+		return set
+	}
+
+	f.kept = append(f.kept, shareSet(gcLivePublic, old, true)...)
+	f.kept = append(f.kept, shareSet(gcLivePrivate, old, false)...)
+	accessTags := automation.ZrokShareTags(gcLivePrivate).WithTag("zrokEnvironmentZId", "access-zid").WithTag("zrokFrontendToken", "fetoken")
+	f.kept = append(f.kept, seed(zitifake.ServicePolicies, "access-dial", "fetoken-access-zid-"+gcLivePrivate+"-svc-dial", accessTags, old))
+
+	remoteTags := automation.ZrokAgentRemoteTags("enrolltoken", "env-zid")
+	f.kept = append(f.kept,
+		seed(zitifake.Services, "remote-svc", "enrolltoken", remoteTags, old),
+		seed(zitifake.ServicePolicies, "remote-bind", "env-zid-enrolltoken-bind", remoteTags, old),
+		seed(zitifake.ServicePolicies, "remote-dial", "env-zid-enrolltoken-dial", remoteTags, old),
+		seed(zitifake.ServiceEdgeRouterPolicies, "remote-serp", "enrolltoken", remoteTags, old),
+	)
+
+	f.kept = append(f.kept,
+		seed(zitifake.Services, "untagged-svc", "untagged", nil, old),
+		seed(zitifake.ServicePolicies, "zrok-only-policy", "zrok-only", automation.ZrokTags(), old),
+	)
+
+	f.orphans = shareSet(gcOrphan, old, true)
+	f.youngOrphans = shareSet(gcYoungOrphan, 0, true)
+	f.kept = append(f.kept, f.youngOrphans...)
+	return f
+}
+
+func (f *gcFixture) run(t *testing.T, opts GCOptions) (*gcReport, string) {
+	t.Helper()
+	out := &bytes.Buffer{}
+	rpt, err := gcSurvey(f.ziti, opts)
+	require.NoError(t, err)
+	rpt.print(out)
+	if opts.Delete {
+		gcReclaim(rpt)
+		rpt.printDeleted(out)
+	}
+	return rpt, out.String()
+}
+
+// orphanSet is 'kind/id' for every orphan in the report, sorted.
+func orphanSet(rpt *gcReport) []string {
+	var out []string
+	for i, kr := range rpt.kinds {
+		for _, obj := range kr.orphans {
+			out = append(out, gcKindOrder[i]+"/"+obj.id)
+		}
+	}
+	sort.Strings(out)
+	return out
+}
+
+func sorted(in []string) []string {
+	out := slices.Clo
```

---

### Incident Patch 5: `0c9d3464` (2026-09-29)
**Commit Message**: Merge pull request #1280 from openziti/fall-fixes-s9

fall-fixes-s9

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+## v2.0.6
+
 FIX: A share request that fails part-way now removes the OpenZiti objects it created (config, service and policies) and reports the underlying error. Previously the controller logged a `chk_z_id` constraint failure in place of the real OpenZiti error, and any failure after allocation, such as a closed private share granted to an unknown account, left the objects behind with no share owning them. Failed OpenZiti calls now log OpenZiti's own error code and message, such as the name of a conflicting object, where the log previously showed only the operation and HTTP status.
 
 FIX: Deleting OpenZiti objects that are already gone now counts as success during cleanup, so one object removed concurrently no longer stops the rest of a cleanup from running.
@@ -10,6 +12,10 @@ FIX: Disabling an environment, or deleting an account, now succeeds when the env
 
 FIX: Disabling an environment, or an administrator deleting an account, now releases each share's names and frontend mappings the same way `unshare` does. Previously a name used by a share removed that way stayed attached to the deleted share and every later attempt to use it answered "already in use by another share" until the name was deleted; auto-allocated names were never released. Frontend mapping updates are now sent to dynamic frontends only after the change is committed, so a request that fails no longer leaves a frontend serving a mapping that does not exist. A share create whose frontend mapping cannot be recorded now fails and removes what it created, and a share delete whose OpenZiti cleanup fails now fails and leaves the share in place for a retry, instead of reporting success with the OpenZiti objects left behind.
 
+FIX: A dynamic frontend now periodically reconciles its mappings against the controller (`mapping_reconcile_interval`, default ten minutes), so a mapping removed or reassigned while its real-time update was lost, such as during a broker outage, now disappears or is corrected without restarting the frontend. A complete set that comes back empty is applied over existing mappings only when two consecutive reconciliations agree. A dynamic frontend started while the controller is unreachable now keeps retrying its initial mapping load instead of exiting.
+
+FIX: A dynamic frontend's mapping update subscriber now bounds how many messages it holds unacknowledged (`amqp_subscriber.prefetch`, default 64) and never requeues. A message it cannot parse, or one with an unknown operation, is logged and discarded once; previously it was redelivered forever, holding up every real update behind it.
+
 ## v2.0.5
 
 FIX: The controller no longer crashes when the bandwidth-limit relax cycle meets a public share with no frontend selection. An account's limit is now cleared only once every one of its shares has been relaxed; a share that cannot be relaxed is retried on the next cycle without disturbing other accounts, and dial policies that already exist are not recreated.
```

**File**: `docs/current/dynamic-proxy-mappings.md` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+# Dynamic proxy mappings
+
+The dynamic frontend (`zrok2 access dynamicProxy`, `endpoints/dynamicProxy/`) serves requests from an in-memory map of hostname to share token. The controller's `frontend_mappings` rows are authoritative; the map learns them three ways, all applied by one loop in `mappings.go`:
+
+| Source | When | Can learn | Cannot learn |
+| --- | --- | --- | --- |
+| Full pull (`FrontendMappings`, id 0) | at start, then every `mapping_reconcile_interval` (default `10m`) | additions, removals, replacements | nothing, but it is tens of thousands of rows for a busy frontend, so it runs on minutes |
+| Delta pull (id above the highest held) | every `mapping_refresh_interval` (default `5m`) | every row with a higher id than any held: additions, and replacements, since a name deleted and re-inserted gets a higher id | deletions: a deleted row never appears in a higher-id pull |
+| AMQP bind and unbind (`amqpSubscriber.go`) | as the controller publishes, after commit | additions and removals, immediately | anything published while the broker or the frontend's connection was down |
+
+The delta pull never removes a name, by design, and stays that way; removals are the subscriber's job and, when an update is lost, the reconciliation's.
+
+## Start
+
+The initial full pull retries with backoff, one second doubling to thirty, until it succeeds or the frontend stops, logging each failure. Until it succeeds the map is empty and requests answer not-found.
+
+## Reconciliation
+
+On each tick the frontend pulls the complete set and, under the map's lock, makes the map match it:
+
+- a name absent from the set is dropped;
+- a name missing from the map is added;
+- a name whose share token or id differs from the set's is replaced with the set's row;
+- a name whose row is identical is left alone.
+
+Each difference is logged at info with the name and both tokens, and one summary line gives the counts and elapsed time. A failed pull is logged at error and the map is left untouched.
+
+A complete set that comes back empty while the map is non-empty is logged at warn and not applied the first time. For a frontend carrying traffic a single empty answer is more likely a failure the client did not see than a world with no shares, and applying it would drop every mapping at once. If the very next reconciliation is also empty it is applied like any other set, each drop and the summary logged as usual, so a frontend whose last mappings really were removed stops serving them within two intervals. A non-empty set or a failed pull in between resets the count.
+
+## Subscriber acknowledgement
+
+The subscriber consumes its own queue, exclusive and deleted with the process, with manual acknowledgement and a prefetch of `amqp_subscriber.prefetch` (default 64).
+
+| Delivery | Settlement |
+| --- | --- |
+| parsed bind or unbind, handed to the loop | ack |
+| parsed, but the handoff channel (`amqp_subscriber.queue_depth`) is full | ack, logged at warn; reconciliation covers it |
+| body that does not parse, or an unknown operation | nack without requeue, logged at error with the body's first hundred bytes; not forwarded |
+| in flight when the frontend stops | nack without requeue |
+
+Nothing requeues. The queue has no other consumer and dies with the process, so a requeued message can only return to the same handler, and one it cannot process would return forever. A message lost with the queue is what reconciliation recovers.
```

**File**: `docs/current/share-teardown.md` (modified, +1/-1)
```diff
@@ -10,6 +10,6 @@
 
 Any failure returns at once and the caller's transaction rolls back, leaving every row for a retry. OpenZiti goes last so that an OpenZiti failure leaves the store untouched.
 
-Frontend mapping updates, binds from share create and unbinds from teardown, are returned to the handler and published only after its `trx.Commit()` returns nil, through `publishMappingUpdates`. A failed publish is logged at error level and not returned: the committed rows are authoritative. The dynamic frontend's periodic `FrontendMappings` pull fetches only rows with a higher id than it holds, so it recovers a lost bind but not a lost unbind; a frontend that missed an unbind keeps the mapping until it reloads its mappings from zero. Without a dynamic proxy controller the rows are still written and nothing is published.
+Frontend mapping updates, binds from share create and unbinds from teardown, are returned to the handler and published only after its `trx.Commit()` returns nil, through `publishMappingUpdates`. A failed publish is logged at error level and not returned: the committed rows are authoritative. A lost bind or unbind is recovered by the dynamic frontend's periodic full reconciliation; see `dynamic-proxy-mappings.md`. Without a dynamic proxy controller the rows are still written and nothing is published.
 
 On share create, a failed `frontend_mappings` insert fails the request; the share-create compensation then removes the OpenZiti objects the request created.
```

**File**: `docs/journal/2026-09-29.md` (modified, +4/-0)
```diff
@@ -6,3 +6,7 @@
 - Frontend mapping updates are returned as `pendingMappingUpdate` and published by the handler after commit, never from inside a transaction; the dynamic proxy controller no longer writes rows, only `Publish`es. A failed publish is logged and left to the frontends' reconciliation, not returned, since the rows are already committed. As of this step that reconciliation is only the frontend's higher-id pull, which recovers a lost bind but never a lost unbind; the unbind side is step 9's. Handlers publish through the `mappingPub` seam, set only when the dynamic proxy controller is configured; tests install a recording publisher whose store read times out while the publishing transaction is open (sqlite store has one connection), which is how "after commit" is asserted.
 - Ziti cleanup is the last step of the teardown so a Ziti failure rolls back with the store intact. `TestDisableOtherFailuresStillFail` now meets its 401 at the share's `CleanupByTag`, before the edge router policy listing named above.
 - `removeFrontendsForEnvironment` now fails the disable on a frontend policy delete failure instead of logging it, so no step of environment teardown logs and continues. A blanket `RejectOperations` cannot tell this apart from the later edge router policy failure (both answer 500), so `TestDisableFrontendFailureRollsBack` uses an environment with a frontend and no share and asserts the frontend's error in the log.
+- The dynamic frontend's AMQP subscriber never requeues (step 9). Its queue is exclusive and auto-deleted per process, so requeue can only hand a message back to the same handler; a malformed one looped forever. Unparseable and unknown-operation messages are nacked without requeue, a full handoff channel still acks; a lost message is the reconciliation's to recover. Don't reintroduce requeue "for reliability".
+- The full reconciliation holds back the first empty set over a non-empty map (one empty answer for a busy frontend is more likely an unseen failure, and applying it would black-hole the frontend) and applies the second consecutive one, so a frontend whose last mappings really were removed clears them within two intervals. A non-empty set or a failed pull in between resets the count (`emptyPulls`). Both halves are deliberate: the first empty set is not to be applied, and the second is not to be refused.
+- The delta pull (`refresh`, id above the highest held) learns every row with a higher id, which includes a replacement (a name deleted and re-inserted gets a higher id), but never a deletion; that is by design and pinned by `TestRefreshOnlyAdds`. Removals come from unbinds and the reconciliation. `mapping_reconcile_interval` and `mapping_refresh_interval` are independent.
+- The dynamic proxy subscriber dials like the metrics AMQP source: `DialConfig` with a `net.Dialer.DialContext` on the shutdown context, a `context.AfterFunc` that closes the socket on shutdown, and a 10s deadline on the handshake and again on queue setup. The AfterFunc is the part that matters for a broker that accepts and never answers; the dial context alone does not interrupt a handshake already under way. `disconnect` stops the AfterFunc so reconnects don't accumulate them.
```

**File**: `endpoints/dynamicProxy/amqpSubscriber.go` (modified, +127/-40)
```diff
@@ -3,6 +3,7 @@ package dynamicProxy
 import (
 	"context"
 	"encoding/json"
+	"net"
 	"time"
 
 	"github.com/google/uuid"
@@ -18,18 +19,24 @@ type amqpSubscriberConfig struct {
 	Url          string `dd:"+required"`
 	ExchangeName string `dd:"+required"`
 	QueueDepth   int
+	Prefetch     int
 }
 
+// amqpDialTimeout bounds the tcp dial, the amqp handshake and the queue setup, each separately.
+const amqpDialTimeout = 10 * time.Second
+
 type amqpSubscriber struct {
-	cfg        *config
-	conn       *amqp.Connection
-	ch         *amqp.Channel
-	queue      amqp.Queue
-	ctx        context.Context
-	cancel     context.CancelFunc
-	done       chan struct{}
-	instanceId string
-	updates    chan *dynamicProxyController.Mapping
+	cfg           *config
+	transport     net.Conn
+	stopTransport func() bool
+	conn          *amqp.Connection
+	ch            *amqp.Channel
+	queue         amqp.Queue
+	ctx           context.Context
+	cancel        context.CancelFunc
+	done          chan struct{}
+	instanceId    string
+	updates       chan *dynamicProxyController.Mapping
 }
 
 func buildAmqpSubscriber(app *da.Application[*config]) error {
@@ -42,6 +49,9 @@ func buildAmqpSubscriber(app *da.Application[*config]) error {
 }
 
 func newAmqpSubscriber(cfg *config) (*amqpSubscriber, error) {
+	if cfg.AmqpSubscriber.Prefetch <= 0 {
+		return nil, errors.Errorf("amqp_subscriber.prefetch must be positive, got '%d'", cfg.AmqpSubscriber.Prefetch)
+	}
 	ctx, cancel := context.WithCancel(context.Background())
 
 	s := &amqpSubscriber{
@@ -100,17 +110,48 @@ mainLoop:
 	s.disconnect()
 }
 
-func (s *amqpSubscriber) connect() error {
-	conn, err := amqp.Dial(s.cfg.AmqpSubscriber.Url)
+func (s *amqpSubscriber) connect() (err error) {
+	ready := false
+	defer func() {
+		if !ready {
+			s.disconnect()
+		}
+	}()
+
+	// the dial observes the shutdown context, and shutdown closes the socket, so a stop during an unreachable or
+	// unresponsive broker returns at once; the deadline bounds a handshake that never completes
+	conn, err := amqp.DialConfig(s.cfg.AmqpSubscriber.Url, amqp.Config{Dial: func(network, addr string) (net.Conn, error) {
+		dialer := net.Dialer{Timeout: amqpDialTimeout}
+		raw, err := dialer.DialContext(s.ctx, network, addr)
+		if err != nil {
+			return nil, err
+		}
+		s.transport = raw
+		s.stopTransport = context.AfterFunc(s.ctx, func() { _ = raw.Close() })
+		if err := raw.SetDeadline(time.Now().Add(amqpDialTimeout)); err != nil {
+			return nil, err
+		}
+		return raw, nil
+	}})
 	if err != nil {
 		return errors.Wrapf(err, "failed to dial amqp broker at '%s'", s.cfg.AmqpSubscriber.Url)
 	}
+	s.conn = conn
+	// the amqp handshake clears its deadline; bound the channel and queue setup too
+	if err := s.transport.SetDeadline(time.Now().Add(amqpDialTimeout)); err != nil {
+		return errors.Wrap(err, "failed to set amqp setup deadline")
+	}
 
 	ch, err := conn.Channel()
 	if err != nil {
-		conn.Close()
 		return errors.Wrap(err, "failed to create amqp channel")
 	}
+	s.ch = ch
+
+	// bound the deliveries the broker hands over unacknowledged
+	if err := ch.Qos(s.cfg.AmqpSubscriber.Prefetch, 0, false); err != nil {
+		return errors.Wrapf(err, "failed to set prefetch '%d'", s.cfg.AmqpSubscriber.Prefetch)
+	}
 
 	// declare exchange (should already exist from publisher side)
 	err = ch.ExchangeDeclare(
@@ -123,8 +164,6 @@ func (s *amqpSubscriber) connect() error {
 		nil,                               // arguments
 	)
 	if err != nil {
-		ch.Close()
-		conn.Close()
 		return errors.Wrapf(err, "failed to declare exchange '%s'", s.cfg.AmqpSubscriber.ExchangeName)
 	}
 
@@ -139,8 +178,6 @@ func (s *amqpSubscriber) connect() error {
 		nil,       // arguments
 	)
 	if err != nil {
-		ch.Close()
-		conn.Close()
 		return errors.Wrapf(err, "failed to declare queue '%s'", queueName)
 	}
 
@@ -153,15 +190,15 @@ func (s *amqpSubscriber) connect() error {
 		nil,                               // arguments
 	)
 	if err != nil {
-		ch.Close()
-		conn.Close()
 		return errors.Wrapf(err, "failed to bind queue '%s' to exchange '%s' with routing key '%s'",
 			queue.Name, s.cfg.AmqpSubscriber.ExchangeName, s.cfg.FrontendToken)
 	}
 
-	s.conn = conn
-	s.ch = ch
+	if err := s.transport.SetDeadline(time.Time{}); err != nil {
+		return errors.Wrap(err, "failed to clear amqp setup deadline")
+	}
 	s.queue = queue
+	ready = true
 
 	dl.Debugf("created ephemeral queue '%s' bound to frontend token '%s'", queue.Name, s.cfg.FrontendToken)
 	return nil
@@ -171,7 +208,7 @@ func (s *amqpSubscriber) consume() error {
 	msgs, err := s.ch.Consume(
 		s.queue.Name, // queue
 		"",           // consumer tag (auto-generated)
-		false,        // auto-ack: false (manual ack for reliability)
+		false,        // auto-ack: false (settled per delivery, see settle)
 		false,        // exclusive
 		false,        // no-local
 		false,        // no-wait
@@ -190,26 +227,46 @@ func (s *amqpSubscriber) consume() error {
 				return errors.New("message channel closed")
 			}

```

**File**: `endpoints/dynamicProxy/amqpSubscriber_test.go` (added, +180/-0)
```diff
@@ -0,0 +1,180 @@
+package dynamicProxy
+
+import (
+	"encoding/json"
+	"net"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/michaelquigley/df/dd"
+	"github.com/openziti/zrok/v2/controller/dynamicProxyController"
+	amqp "github.com/rabbitmq/amqp091-go"
+	"github.com/stretchr/testify/require"
+)
+
+// fakeAcknowledger records how a delivery was settled.
+type fakeAcknowledger struct {
+	acks    int
+	nacks   int
+	requeue bool
+}
+
+func (a *fakeAcknowledger) Ack(uint64, bool) error { a.acks++; return nil }
+
+func (a *fakeAcknowledger) Nack(_ uint64, _ bool, requeue bool) error {
+	a.nacks++
+	a.requeue = a.requeue || requeue
+	return nil
+}
+
+func (a *fakeAcknowledger) Reject(_ uint64, requeue bool) error {
+	a.nacks++
+	a.requeue = a.requeue || requeue
+	return nil
+}
+
+func newTestSubscriber(t *testing.T, depth int) *amqpSubscriber {
+	cfg := &config{FrontendToken: "fe", AmqpSubscriber: &amqpSubscriberConfig{QueueDepth: depth, Prefetch: 64}}
+	s, err := newAmqpSubscriber(cfg)
+	require.NoError(t, err)
+	t.Cleanup(s.cancel)
+	return s
+}
+
+// mappingBody encodes a mapping the way the controller's publisher does.
+func mappingBody(t *testing.T, m dynamicProxyController.Mapping) []byte {
+	data, err := dd.Unbind(m)
+	require.NoError(t, err)
+	body, err := json.Marshal(data)
+	require.NoError(t, err)
+	return body
+}
+
+// deliver runs one delivery through handling and settlement, as consume does.
+func deliver(s *amqpSubscriber, body []byte) (deliveryOutcome, *fakeAcknowledger) {
+	ack := &fakeAcknowledger{}
+	d := amqp.Delivery{Acknowledger: ack, Body: body}
+	outcome := s.handleMessage(d)
+	s.settle(d, outcome)
+	return outcome, ack
+}
+
+func TestSubscriberRejectsMalformedBody(t *testing.T) {
+	logs := captureLogs(t)
+	s := newTestSubscriber(t, 1)
+	body := []byte("{not json" + strings.Repeat("x", 200))
+
+	outcome, ack := deliver(s, body)
+
+	require.Equal(t, deliveryRejected, outcome)
+	require.Equal(t, 0, ack.acks)
+	require.Equal(t, 1, ack.nacks)
+	require.False(t, ack.requeue)
+	require.Empty(t, s.updates)
+	require.Contains(t, logs.String(), string(body[:100]))
+	require.NotContains(t, logs.String(), string(body[:101]))
+}
+
+func TestSubscriberRejectsUnknownOperation(t *testing.T) {
+	s := newTestSubscriber(t, 1)
+
+	outcome, ack := deliver(s, mappingBody(t, dynamicProxyController.Mapping{Id: 1, Operation: "zzz", Name: "a", ShareToken: "sa"}))
+
+	require.Equal(t, deliveryRejected, outcome)
+	require.Equal(t, 0, ack.acks)
+	require.Equal(t, 1, ack.nacks)
+	require.False(t, ack.requeue)
+	require.Empty(t, s.updates)
+}
+
+func TestSubscriberForwardsValidBind(t *testing.T) {
+	s := newTestSubscriber(t, 1)
+	want := dynamicProxyController.Mapping{Id: 7, Operation: dynamicProxyController.OperationBind, Name: "a", ShareToken: "sa"}
+
+	outcome, ack := deliver(s, mappingBody(t, want))
+
+	require.Equal(t, deliveryForwarded, outcome)
+	require.Equal(t, 1, ack.acks)
+	require.Equal(t, 0, ack.nacks)
+	require.Equal(t, want, *<-s.updates)
+}
+
+func TestSubscriberFullChannelDropsAndAcks(t *testing.T) {
+	logs := captureLogs(t)
+	s := newTestSubscriber(t, 1)
+	body := mappingBody(t, dynamicProxyController.Mapping{Id: 1, Operation: dynamicProxyController.OperationUnbind, Name: "a"})
+	_, _ = deliver(s, body)
+
+	outcome, ack := deliver(s, body)
+
+	require.Equal(t, deliveryDropped, outcome)
+	require.Equal(t, 1, ack.acks)
+	require.Equal(t, 0, ack.nacks)
+	require.Len(t, s.updates, 1)
+	require.Contains(t, logs.String(), "updates channel full")
+	require.Contains(t, logs.String(), `"level":"WARN"`)
+}
+
+func TestSubscriberShutdownNacksInFlight(t *testing.T) {
+	s := newTestSubscriber(t, 1)
+	s.cancel()
+
+	outcome, ack := deliver(s, mappingBody(t, dynamicProxyController.Mapping{Id: 1, Operation: dynamicProxyController.OperationBind, Name: "a", ShareToken: "sa"}))
+
+	require.Equal(t, deliveryCancelled, outcome)
+	require.Equal(t, 1, ack.nacks)
+	require.False(t, ack.requeue)
+	require.Empty(t, s.updates)
+}
+
+func TestSubscriberPrefetchMustBePositive(t *testing.T) {
+	for _, prefetch := range []int{0, -1} {
+		_, err := newAmqpSubscriber(&config{AmqpSubscriber: &amqpSubscriberConfig{Prefetch: prefetch}})
+		require.Error(t, err)
+	}
+}
+
+func TestSubscriberStopDuringUnresponsiveBrokerReturnsPromptly(t *testing.T) {
+	// a listener that accepts the connection and never speaks amqp, so the dial hangs in the handshake
+	l, err := net.Listen("tcp", "127.0.0.1:0")
+	require.NoError(t, err)
+	t.Cleanup(func() { _ = l.Close() })
+	accepted := make(chan net.Conn, 1)
+	go func() {
+		if c, err := l.Accept(); err == nil {
+			accepted <- c
+		}
+	}()
+
+	cfg := &config{
+		FrontendToken: "fe",
+		AmqpSubscriber: &amqpSubscriberConfig{
+			Url:          "amqp://guest:guest@" + l.Addr().String() + "/",
+			ExchangeName: "dynamicProxy",
+			QueueDepth:   1,
+			Prefetch:     64,
+		},
+	}
+	s, err := newAmqpSubscriber(cfg)
+	require.NoError(t, err)
+	require.NoError(t, s.Start())
+
+	select {
+	case c := <-accepte
```

**File**: `endpoints/dynamicProxy/config.go` (modified, +17/-14)
```diff
@@ -8,17 +8,18 @@ import (
 )
 
 type config struct {
-	V                      int    `dd:"+match=1"`
-	FrontendToken          string `dd:"+required"`
-	Identity               string
-	BindAddress            string
-	TemplatePath           string
-	MappingRefreshInterval time.Duration
-	Interstitial           *interstitialConfig
-	Oauth                  *oauthConfig
-	AmqpSubscriber         *amqpSubscriberConfig   `dd:"+required"`
-	Controller             *controllerClientConfig `dd:"+required"`
-	Tls                    *endpoints.TlsConfig
+	V                        int    `dd:"+match=1"`
+	FrontendToken            string `dd:"+required"`
+	Identity                 string
+	BindAddress              string
+	TemplatePath             string
+	MappingRefreshInterval   time.Duration
+	MappingReconcileInterval time.Duration
+	Interstitial             *interstitialConfig
+	Oauth                    *oauthConfig
+	AmqpSubscriber           *amqpSubscriberConfig   `dd:"+required"`
+	Controller               *controllerClientConfig `dd:"+required"`
+	Tls                      *endpoints.TlsConfig
 }
 
 type interstitialConfig struct {
@@ -69,11 +70,13 @@ type oauthProviderConfig struct {
 
 func defaults() *config {
 	return &config{
-		Identity:               "public",
-		BindAddress:            "0.0.0.0:8080",
-		MappingRefreshInterval: 5 * time.Minute,
+		Identity:                 "public",
+		BindAddress:              "0.0.0.0:8080",
+		MappingRefreshInterval:   5 * time.Minute,
+		MappingReconcileInterval: 10 * time.Minute,
 		AmqpSubscriber: &amqpSubscriberConfig{
 			QueueDepth: 1024,
+			Prefetch:   64,
 		},
 		Controller: &controllerClientConfig{
 			Timeout: 30 * time.Second,
```

**File**: `endpoints/dynamicProxy/mappings.go` (modified, +159/-38)
```diff
@@ -12,17 +12,29 @@ import (
 	"github.com/pkg/errors"
 )
 
+// mappingSource supplies frontend mappings; id 0 returns the complete set for the frontend, any other id returns
+// only the rows with a higher id. the controller client satisfies it.
+type mappingSource interface {
+	getAllFrontendMappings(frontendToken string, id int64) ([]*dynamicProxyController.FrontendMapping, error)
+}
+
 type mappings struct {
-	cfg     *config
-	amqp    *amqpSubscriber
-	ctrl    *controllerClient
-	ctx     context.Context
-	cancel  context.CancelFunc
-	mutex   sync.RWMutex
-	nameMap map[string]*dynamicProxyController.FrontendMapping
+	cfg          *config
+	source       mappingSource
+	updates      <-chan *dynamicProxyController.Mapping
+	retryInitial time.Duration
+	retryMax     time.Duration
+	ctx          context.Context
+	cancel       context.CancelFunc
+	mutex        sync.RWMutex
+	nameMap      map[string]*dynamicProxyController.FrontendMapping
+	emptyPulls   int // consecutive empty reconciliation pulls held back; see applyReconcile
 }
 
 func buildMappings(app *da.Application[*config]) error {
+	if app.Cfg.MappingReconcileInterval <= 0 {
+		return errors.Errorf("mapping_reconcile_interval must be positive, got '%v'", app.Cfg.MappingReconcileInterval)
+	}
 	mappings := newMappings()
 	mappings.cfg = app.Cfg
 	da.Set(app.C, mappings)
@@ -31,7 +43,9 @@ func buildMappings(app *da.Application[*config]) error {
 
 func newMappings() *mappings {
 	return &mappings{
-		nameMap: make(map[string]*dynamicProxyController.FrontendMapping),
+		retryInitial: time.Second,
+		retryMax:     30 * time.Second,
+		nameMap:      make(map[string]*dynamicProxyController.FrontendMapping),
 	}
 }
 
@@ -44,16 +58,17 @@ func (m *mappings) getMapping(name string) (*dynamicProxyController.FrontendMapp
 }
 
 func (m *mappings) Link(c *da.Container) error {
-	var found bool
-	m.amqp, found = da.Get[*amqpSubscriber](c)
+	subscriber, found := da.Get[*amqpSubscriber](c)
 	if !found {
 		return errors.New("no amqp subscriber found")
 	}
+	m.updates = subscriber.Updates()
 
-	m.ctrl, found = da.Get[*controllerClient](c)
+	ctrl, found := da.Get[*controllerClient](c)
 	if !found {
 		return errors.New("no controller client found")
 	}
+	m.source = ctrl
 	return nil
 }
 
@@ -74,47 +89,153 @@ func (m *mappings) run() {
 	dl.Infof("started")
 	defer dl.Infof("stopped")
 
-	// load initial mappings
-	start := time.Now()
-	mappings, err := m.ctrl.getAllFrontendMappings(m.cfg.FrontendToken, 0)
-	if err != nil {
-		dl.Fatal(err)
+	if !m.initialLoad() {
+		return
 	}
-	m.updateMappings(mappings)
-	dl.Infof("retrieved '%d' mappings in '%v'", len(mappings), time.Since(start))
 
-	// periodic update loop
-	ticker := time.NewTicker(m.cfg.MappingRefreshInterval)
-	defer ticker.Stop()
+	// the delta refresh and the full reconciliation run on independent intervals
+	refresh := time.NewTicker(m.cfg.MappingRefreshInterval)
+	defer refresh.Stop()
+	reconcile := time.NewTicker(m.cfg.MappingReconcileInterval)
+	defer reconcile.Stop()
 
 	for {
 		dl.ChannelLog("mappings").Debugf("\n%s", m.dumpMappings())
 		select {
 		case <-m.ctx.Done():
 			return
-		case <-ticker.C:
-			// periodically refresh mappings
-			start := time.Now()
-			highestId := m.getHighestId()
-			mappings, err := m.ctrl.getAllFrontendMappings(m.cfg.FrontendToken, highestId)
-			if err != nil {
-				dl.Errorf("failed to refresh mappings (highest version '%v'): %v", highestId, err)
-				continue
-			}
-			if len(mappings) > 0 {
-				m.updateMappings(mappings)
-				dl.Warnf("refresh updated '%d' mappings (highest version '%v') in '%v'", len(mappings), highestId, time.Since(start))
-			} else {
-				dl.Debugf("refresh found no new mappings (highest version '%v') in '%v'", highestId, time.Since(start))
-			}
-
-		case update := <-m.amqp.Updates():
+
+		case <-refresh.C:
+			m.refresh()
+
+		case <-reconcile.C:
+			m.reconcile()
+
+		case update := <-m.updates:
 			// handle real-time mapping updates from AMQP
 			m.handleMappingUpdate(update)
 		}
 	}
 }
 
+// initialLoad pulls the complete set, retrying with backoff until it succeeds or the context is cancelled. until it
+// succeeds the map is empty and requests answer not-found. returns false when cancelled.
+func (m *mappings) initialLoad() bool {
+	backoff := m.retryInitial
+	for {
+		start := time.Now()
+		mappings, err := m.source.getAllFrontendMappings(m.cfg.FrontendToken, 0)
+		if err == nil {
+			m.updateMappings(mappings)
+			dl.Infof("retrieved '%d' mappings in '%v'", len(mappings), time.Since(start))
+			return true
+		}
+		dl.Errorf("failed to retrieve initial mappings (retrying in '%v'): %v", backoff, err)
+		select {
+		case <-time.After(backoff):
+		case <-m.ctx.Done():
+			return false
+		}
+		backoff = min(backoff*2, m.retryMax)
+	}
+}
+
+// refresh pulls every row with a higher id than any held and applies it. that includes a replacement, since a name
+// deleted and re-inserted gets a higher id, but never a deletion: a deleted row neve
```

---

### Incident Patch 6: `74f7d7ba` (2026-09-29)
**Commit Message**: Merge pull request #1279 from openziti/fall-fixes-s8

one improved teardown path; notification sequencing improvements

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -8,6 +8,8 @@ FIX: Deleting OpenZiti objects that are already gone now counts as success durin
 
 FIX: Disabling an environment, or deleting an account, now succeeds when the environment's OpenZiti identity is already gone, so an environment stranded by an earlier partial teardown can be cleaned up. Previously the request failed with an internal error and the environment could never be disabled. The admin identity delete likewise succeeds when the identity is already gone. Any other OpenZiti failure still fails the request and leaves the environment in place for a retry (https://github.com/openziti/zrok/issues/1265).
 
+FIX: Disabling an environment, or an administrator deleting an account, now releases each share's names and frontend mappings the same way `unshare` does. Previously a name used by a share removed that way stayed attached to the deleted share and every later attempt to use it answered "already in use by another share" until the name was deleted; auto-allocated names were never released. Frontend mapping updates are now sent to dynamic frontends only after the change is committed, so a request that fails no longer leaves a frontend serving a mapping that does not exist. A share create whose frontend mapping cannot be recorded now fails and removes what it created, and a share delete whose OpenZiti cleanup fails now fails and leaves the share in place for a retry, instead of reporting success with the OpenZiti objects left behind.
+
 ## v2.0.5
 
 FIX: The controller no longer crashes when the bandwidth-limit relax cycle meets a public share with no frontend selection. An account's limit is now cleared only once every one of its shares has been relaxed; a share that cannot be relaxed is retried on the next cycle without disturbing other accounts, and dial policies that already exist are not recreated.
```

**File**: `controller/controller.go` (modified, +2/-2)
```diff
@@ -29,7 +29,6 @@ var (
 	idb         influxdb2.Client
 	limitsAgent *limits.Agent
 	agentCtrl   *agentController.Controller
-	dPCtrl      *dynamicProxyController.Controller
 )
 
 func Run(inCfg *config.Config) error {
@@ -155,10 +154,11 @@ func Run(inCfg *config.Config) error {
 	}
 
 	if cfg.DynamicProxyController != nil {
-		dPCtrl, err = dynamicProxyController.NewController(cfg.DynamicProxyController, str)
+		dPCtrl, err := dynamicProxyController.NewController(cfg.DynamicProxyController, str)
 		if err != nil {
 			return err
 		}
+		mappingPub = dPCtrl
 		dl.Infof("started dynamic proxy controller")
 	}
 
```

**File**: `controller/deleteAccount.go` (modified, +5/-1)
```diff
@@ -48,12 +48,15 @@ func (h *deleteAccountHandler) Handle(params admin.DeleteAccountParams, principa
 		return admin.NewDeleteAccountInternalServerError()
 	}
 
+	var updates []pendingMappingUpdate
 	for _, env := range envs {
 		dl.Infof("disabling environment '%d' (envZId: '%s') for account '%s'", env.Id, env.ZId, params.Body.Email)
-		if err := disableEnvironment(env, trx, ziti); err != nil {
+		envUpdates, err := disableEnvironment(env, trx, ziti)
+		if err != nil {
 			dl.Errorf("error disabling environment '%d' for account '%s': %v", env.Id, params.Body.Email, err)
 			return admin.NewDeleteAccountInternalServerError()
 		}
+		updates = append(updates, envUpdates...)
 		dl.Infof("successfully disabled environment '%d' for account '%s'", env.Id, params.Body.Email)
 	}
 
@@ -66,6 +69,7 @@ func (h *deleteAccountHandler) Handle(params admin.DeleteAccountParams, principa
 		dl.Errorf("error committing transaction: %v", err)
 		return admin.NewDeleteAccountInternalServerError()
 	}
+	publishMappingUpdates(updates)
 
 	dl.Infof("successfully deleted account '%s'", params.Body.Email)
 	return admin.NewDeleteAccountOK()
```

**File**: `controller/disable.go` (modified, +24/-55)
```diff
@@ -39,7 +39,8 @@ func (h *disableHandler) Handle(params environment.DisableParams, principal *res
 		return environment.NewDisableInternalServerError()
 	}
 
-	if err := disableEnvironment(env, trx, ziti); err != nil {
+	updates, err := disableEnvironment(env, trx, ziti)
+	if err != nil {
 		dl.Errorf("error disabling environment for user '%v': %v", principal.Email, err)
 		return environment.NewDisableInternalServerError()
 	}
@@ -48,82 +49,59 @@ func (h *disableHandler) Handle(params environment.DisableParams, principal *res
 		dl.Errorf("error committing for user '%v': %v", principal.Email, err)
 		return environment.NewDisableInternalServerError()
 	}
+	publishMappingUpdates(updates)
 
 	return environment.NewDisableOK()
 }
 
-func disableEnvironment(env *store.Environment, trx *sqlx.Tx, ziti *automation.ZitiAutomation) error {
-	if err := removeSharesForEnvironment(env, trx, ziti); err != nil {
-		return errors.Wrapf(err, "error removing shares for environment '%v'", env.ZId)
+// disableEnvironment returns the frontend mapping updates for the environment's shares; the caller
+// publishes them after it commits.
+func disableEnvironment(env *store.Environment, trx *sqlx.Tx, ziti *automation.ZitiAutomation) ([]pendingMappingUpdate, error) {
+	updates, err := removeSharesForEnvironment(env, trx, ziti)
+	if err != nil {
+		return nil, errors.Wrapf(err, "error removing shares for environment '%v'", env.ZId)
 	}
 	if err := removeFrontendsForEnvironment(env, trx, ziti); err != nil {
-		return errors.Wrapf(err, "error removing frontends for environment '%v'", env.ZId)
+		return nil, errors.Wrapf(err, "error removing frontends for environment '%v'", env.ZId)
 	}
 	if err := removeAgentRemoteForEnvironment(env, trx, ziti); err != nil {
-		return errors.Wrapf(err, "error removing agent remote for '%v'", env.ZId)
+		return nil, errors.Wrapf(err, "error removing agent remote for '%v'", env.ZId)
 	}
 
 	// delete edge router policy for environment
 	erpFilter := fmt.Sprintf("name=\"%v\"", env.ZId)
 	if err := ziti.EdgeRouterPolicies.DeleteWithFilter(erpFilter); err != nil {
-		return errors.Wrapf(err, "error deleting edge router policy for environment '%v'", env.ZId)
+		return nil, errors.Wrapf(err, "error deleting edge router policy for environment '%v'", env.ZId)
 	}
 
 	// delete identity for environment
 	if err := ziti.Identities.Delete(env.ZId); err != nil {
 		if !automation.IsNotFound(err) {
-			return errors.Wrapf(err, "error deleting identity for environment '%v'", env.ZId)
+			return nil, errors.Wrapf(err, "error deleting identity for environment '%v'", env.ZId)
 		}
 		dl.Infof("identity '%v' for environment already deleted", env.ZId)
 	}
 
 	if err := removeEnvironmentFromStore(env, trx); err != nil {
-		return errors.Wrapf(err, "error removing environment '%v' from store", env.ZId)
+		return nil, errors.Wrapf(err, "error removing environment '%v' from store", env.ZId)
 	}
-	return nil
+	return updates, nil
 }
 
-func removeSharesForEnvironment(env *store.Environment, trx *sqlx.Tx, ziti *automation.ZitiAutomation) error {
+func removeSharesForEnvironment(env *store.Environment, trx *sqlx.Tx, ziti *automation.ZitiAutomation) ([]pendingMappingUpdate, error) {
 	shrs, err := str.FindSharesForEnvironment(env.Id, trx)
 	if err != nil {
-		return err
+		return nil, errors.Wrapf(err, "error finding shares for environment '%v'", env.ZId)
 	}
+	var updates []pendingMappingUpdate
 	for _, shr := range shrs {
-		shrToken := shr.Token
-		dl.Infof("garbage collecting share '%v' for environment '%v'", shrToken, env.ZId)
-
-		// delete service edge router policies for share
-		serpFilter := fmt.Sprintf("tags.zrokShareToken=\"%v\"", shrToken)
-		if err := ziti.ServiceEdgeRouterPolicies.DeleteWithFilter(serpFilter); err != nil {
-			dl.Error(err)
-		}
-
-		// delete dial service policies for share
-		dialFilter := fmt.Sprintf("tags.zrokShareToken=\"%v\" and type=1", shrToken)
-		if err := ziti.ServicePolicies.DeleteWithFilter(dialFilter); err != nil {
-			dl.Error(err)
-		}
-
-		// delete bind service policies for share
-		bindFilter := fmt.Sprintf("tags.zrokShareToken=\"%v\" and type=2", shrToken)
-		if err := ziti.ServicePolicies.DeleteWithFilter(bindFilter); err != nil {
-			dl.Error(err)
-		}
-
-		// delete configs for share
-		configFilter := fmt.Sprintf("tags.zrokShareToken=\"%v\"", shrToken)
-		if err := ziti.Configs.DeleteWithFilter(configFilter); err != nil {
-			dl.Error(err)
-		}
-
-		// delete service
-		if err := ziti.Services.Delete(shr.ZId); err != nil {
-			dl.Error(err)
+		shrUpdates, err := teardownShare(shr, trx, ziti)
+		if err != nil {
+			return nil, err
 		}
-
-		dl.Infof("removed share '%v' for environment '%v'", shr.Token, env.ZId)
+		updates = append(updates, shrUpdates...)
 	}
-	return nil
+	return updates, nil
 }
 
 func removeFrontendsForEnvironment(env *store.Environment, trx *sqlx.Tx, ziti *automation.ZitiAutomation) error {
@@ -134,7 +112,7 @@ func removeFrontendsForEnvironment(env *sto
```

**File**: `controller/disable_test.go` (modified, +31/-0)
```diff
@@ -97,6 +97,37 @@ func TestDisableOtherFailuresStillFail(t *testing.T) {
 	f.requireEnvironmentRemoved(t, false)
 }
 
+// the environment has a frontend and no share, so the frontend's policy delete is the first ziti call
+// the disable makes; the log shows that it, not a later step, failed the request.
+func TestDisableFrontendFailureRollsBack(t *testing.T) {
+	f := setupShareCreateFixture(t)
+	trx, err := str.Begin()
+	require.NoError(t, err)
+	envs, err := str.FindEnvironmentsForAccount(int(f.principal.ID), trx)
+	require.NoError(t, err)
+	require.Len(t, envs, 1)
+	envID := envs[0].Id
+	_, err = str.CreateFrontend(envID, &store.Frontend{Token: "frontend-token", ZId: "env-zid", PermissionMode: store.OpenPermissionMode}, trx)
+	require.NoError(t, err)
+	require.NoError(t, trx.Commit())
+	f.fake.RejectOperations(true)
+
+	resp := newDisableHandler().Handle(environment.DisableParams{Body: environment.DisableBody{Identity: "env-zid"}}, f.principal)
+
+	require.IsType(t, &environment.DisableInternalServerError{}, resp)
+	require.Contains(t, f.logs.String(), "error removing frontend access for 'frontend-token'")
+	trx, err = str.Begin()
+	require.NoError(t, err)
+	defer func() { _ = trx.Rollback() }()
+	env, err := str.GetEnvironment(envID, trx)
+	require.NoError(t, err)
+	require.False(t, env.Deleted)
+	fes, err := str.FindFrontendsForEnvironment(envID, trx)
+	require.NoError(t, err)
+	require.Len(t, fes, 1)
+	require.False(t, fes[0].Deleted)
+}
+
 func TestDeleteAccountWithAbsentIdentitySucceeds(t *testing.T) {
 	f := setupDisableFixture(t)
 
```

**File**: `controller/dynamicProxyController/controller.go` (modified, +4/-39)
```diff
@@ -3,7 +3,6 @@ package dynamicProxyController
 import (
 	"context"
 
-	"github.com/jmoiron/sqlx"
 	"github.com/michaelquigley/df/dl"
 	"github.com/openziti/sdk-golang/ziti"
 	"github.com/openziti/zrok/v2/controller/store"
@@ -55,42 +54,6 @@ func NewController(cfg *Config, str *store.Store) (*Controller, error) {
 	return ctrl, nil
 }
 
-func (c *Controller) BindFrontendMapping(frontendToken, name, shareToken string, trx *sqlx.Tx) error {
-	// create new frontend mapping
-	fm := &store.FrontendMapping{
-		FrontendToken: frontendToken,
-		Name:          name,
-		ShareToken:    shareToken,
-	}
-
-	fmId, err := c.str.CreateFrontendMapping(fm, trx)
-	if err != nil {
-		return err
-	}
-
-	// broadcast the mapping update via AMQP
-	mapping := Mapping{
-		Id:         int64(fmId),
-		Operation:  OperationBind,
-		Name:       name,
-		ShareToken: shareToken,
-	}
-	return c.sendMappingUpdate(frontendToken, mapping)
-}
-
-func (c *Controller) UnbindFrontendMapping(frontendToken, name string, trx *sqlx.Tx) error {
-	if err := c.str.DeleteFrontendMappingsByFrontendTokenAndName(frontendToken, name, trx); err != nil {
-		return err
-	}
-
-	// broadcast the mapping update via AMQP
-	mapping := Mapping{
-		Operation: OperationUnbind,
-		Name:      name,
-	}
-	return c.sendMappingUpdate(frontendToken, mapping)
-}
-
 func (c *Controller) FrontendMappings(_ context.Context, req *FrontendMappingsRequest) (*FrontendMappingsResponse, error) {
 	trx, err := c.str.Begin()
 	if err != nil {
@@ -120,8 +83,10 @@ func (c *Controller) FrontendMappings(_ context.Context, req *FrontendMappingsRe
 	return &FrontendMappingsResponse{FrontendMappings: out}, nil
 }
 
-func (c *Controller) sendMappingUpdate(frontendToken string, m Mapping) error {
-	if err := c.publisher.Publish(context.Background(), frontendToken, m); err != nil {
+// Publish sends a mapping update to the frontend's queue. the caller has already committed the row
+// the update describes; the store is not touched here.
+func (c *Controller) Publish(ctx context.Context, frontendToken string, m Mapping) error {
+	if err := c.publisher.Publish(ctx, frontendToken, m); err != nil {
 		return err
 	}
 	dl.Infof("sent mapping update '%+v' -> '%s'", m, frontendToken)
```

**File**: `controller/mappingUpdates.go` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+package controller
+
+import (
+	"context"
+
+	"github.com/michaelquigley/df/dl"
+	"github.com/openziti/zrok/v2/controller/dynamicProxyController"
+)
+
+// mappingPublisher sends frontend mapping updates to the dynamic proxy frontends.
+type mappingPublisher interface {
+	Publish(ctx context.Context, frontendToken string, m dynamicProxyController.Mapping) error
+}
+
+// mappingPub is assigned from the dynamic proxy controller at startup when one is configured; nil
+// otherwise, and then updates are not sent.
+var mappingPub mappingPublisher
+
+// pendingMappingUpdate is a frontend mapping change made inside a transaction. it is published only
+// after that transaction commits.
+type pendingMappingUpdate struct {
+	frontendToken string
+	mapping       dynamicProxyController.Mapping
+}
+
+// publishMappingUpdates is called only after trx.Commit() returned nil. a failed publish is logged and
+// not returned: the committed rows are the truth, and a lost update is left to the frontends'
+// reconciliation against them.
+func publishMappingUpdates(updates []pendingMappingUpdate) {
+	if mappingPub == nil {
+		return
+	}
+	for _, update := range updates {
+		if err := mappingPub.Publish(context.Background(), update.frontendToken, update.mapping); err != nil {
+			dl.Errorf("error publishing mapping update '%+v' to frontend '%v': %v", update.mapping, update.frontendToken, err)
+		}
+	}
+}
```

**File**: `controller/share.go` (modified, +34/-22)
```diff
@@ -8,6 +8,7 @@ import (
 	"github.com/michaelquigley/df/dl"
 	"github.com/openziti/edge-api/rest_model"
 	"github.com/openziti/zrok/v2/controller/automation"
+	"github.com/openziti/zrok/v2/controller/dynamicProxyController"
 	"github.com/openziti/zrok/v2/controller/store"
 	"github.com/openziti/zrok/v2/rest_model_zrok"
 	"github.com/openziti/zrok/v2/rest_server_zrok/operations/share"
@@ -132,6 +133,7 @@ func (h *shareHandler) Handle(params share.ShareParams, principal *rest_model_zr
 		return share.NewShareInternalServerError()
 	}
 
+	var updates []pendingMappingUpdate
 	if sdk.ShareMode(params.Body.ShareMode) == sdk.PublicShareMode {
 		// create share name mappings for namespace selections
 		for _, nameId := range nameIds {
@@ -146,9 +148,11 @@ func (h *shareHandler) Handle(params share.ShareParams, principal *rest_model_zr
 			}
 		}
 
-		// send mapping updates to dynamic frontends after successful commit
-		if err := h.processDynamicMappings(shrToken, nameIds, trx); err != nil {
-			dl.Errorf("error sending mapping updates: %v", err)
+		// record frontend mappings for dynamic frontends; their updates are published after commit
+		updates, err = h.processDynamicMappings(shrToken, nameIds, trx)
+		if err != nil {
+			dl.Errorf("error recording frontend mappings for share '%v': %v", shrToken, err)
+			return share.NewShareInternalServerError()
 		}
 	}
 
@@ -163,6 +167,7 @@ func (h *shareHandler) Handle(params share.ShareParams, principal *rest_model_zr
 		return share.NewShareInternalServerError()
 	}
 	committed = true
+	publishMappingUpdates(updates)
 
 	dl.Infof("recorded share '%v' with id '%v' for '%v'", shrToken, shareId, principal.Email)
 
@@ -646,44 +651,51 @@ func (h *shareHandler) processAccessGrants(shareId int, accessGrants []string, p
 	return nil
 }
 
-func (h *shareHandler) processDynamicMappings(shrToken string, nameIds []int, trx *sqlx.Tx) error {
-	// only send updates if dynamic proxy controller is enabled
-	if dPCtrl == nil {
-		dl.Warnf("dynamic proxy controller is nil")
-		return nil
-	}
-
+// processDynamicMappings records a frontend mapping for each dynamic frontend serving each selected
+// name, and returns a pending bind for each row. the first insert failure is returned, so the request
+// fails and its transaction rolls back.
+func (h *shareHandler) processDynamicMappings(shrToken string, nameIds []int, trx *sqlx.Tx) ([]pendingMappingUpdate, error) {
+	var updates []pendingMappingUpdate
 	for _, nameId := range nameIds {
 		// find name record to get the name and namespace
 		name, err := str.GetName(nameId, trx)
 		if err != nil {
-			return errors.Wrapf(err, "error finding name with id '%v'", nameId)
+			return nil, errors.Wrapf(err, "error finding name with id '%v'", nameId)
 		}
 
 		// find namespace
 		ns, err := str.GetNamespace(name.NamespaceId, trx)
 		if err != nil {
-			return errors.Wrapf(err, "error finding namespace with id '%v'", name.NamespaceId)
+			return nil, errors.Wrapf(err, "error finding namespace with id '%v'", name.NamespaceId)
 		}
 
 		// find dynamic frontends for this namespace
 		frontends, err := str.FindDynamicFrontendsForNamespace(ns.Id, trx)
 		if err != nil {
-			return errors.Wrapf(err, "error finding dynamic frontends for namespace '%v'", ns.Token)
+			return nil, errors.Wrapf(err, "error finding dynamic frontends for namespace '%v'", ns.Token)
 		}
 
-		// send mapping updates to each dynamic frontend
 		for _, frontend := range frontends {
 			frontendName := util.NameInNamespace(name.Name, ns.Name)
-			dl.Infof("binding name '%v'", frontendName)
-
-			if err := dPCtrl.BindFrontendMapping(frontend.Token, frontendName, shrToken, trx); err != nil {
-				dl.Errorf("error binding frontend mapping to frontend '%v': %v", frontend.Token, err)
-				// continue with other frontends rather than failing completely
-			} else {
-				dl.Infof("bound frontend mapping '%v' to dynamic frontend '%v'", frontendName, frontend.Token)
+			fmId, err := str.CreateFrontendMapping(&store.FrontendMapping{
+				FrontendToken: frontend.Token,
+				Name:          frontendName,
+				ShareToken:    shrToken,
+			}, trx)
+			if err != nil {
+				return nil, errors.Wrapf(err, "error recording frontend mapping '%v' for frontend '%v'", frontendName, frontend.Token)
 			}
+			updates = append(updates, pendingMappingUpdate{
+				frontendToken: frontend.Token,
+				mapping: dynamicProxyController.Mapping{
+					Id:         int64(fmId),
+					Operation:  dynamicProxyController.OperationBind,
+					Name:       frontendName,
+					ShareToken: shrToken,
+				},
+			})
+			dl.Debugf("recorded frontend mapping '%v' for dynamic frontend '%v'", frontendName, frontend.Token)
 		}
 	}
-	return nil
+	return updates, nil
 }
```

---

### Incident Patch 7: `7b45c014` (2026-09-29)
**Commit Message**: Merge pull request #1278 from openziti/fall-fixes-s7

disable and delete identity tolerate an absent ziti identity

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -6,6 +6,8 @@ FIX: A share request that fails part-way now removes the OpenZiti objects it cre
 
 FIX: Deleting OpenZiti objects that are already gone now counts as success during cleanup, so one object removed concurrently no longer stops the rest of a cleanup from running.
 
+FIX: Disabling an environment, or deleting an account, now succeeds when the environment's OpenZiti identity is already gone, so an environment stranded by an earlier partial teardown can be cleaned up. Previously the request failed with an internal error and the environment could never be disabled. The admin identity delete likewise succeeds when the identity is already gone. Any other OpenZiti failure still fails the request and leaves the environment in place for a retry (https://github.com/openziti/zrok/issues/1265).
+
 ## v2.0.5
 
 FIX: The controller no longer crashes when the bandwidth-limit relax cycle meets a public share with no frontend selection. An account's limit is now cleared only once every one of its shares has been relaxed; a share that cannot be relaxed is retried on the next cycle without disturbing other accounts, and dial policies that already exist are not recreated.
```

**File**: `controller/automation/zitifake/fake.go` (modified, +42/-2)
```diff
@@ -23,13 +23,17 @@ const (
 	Services                  = "services"
 	ServicePolicies           = "service-policies"
 	ServiceEdgeRouterPolicies = "service-edge-router-policies"
+	Identities                = "identities"
+	EdgeRouterPolicies        = "edge-router-policies"
 )
 
 var labels = map[string]struct{ id, noun string }{
 	Configs:                   {"config", "config"},
 	Services:                  {"service", "service"},
 	ServicePolicies:           {"policy", "service policy"},
 	ServiceEdgeRouterPolicies: {"serp", "service edge router policy"},
+	Identities:                {"identity", "identity"},
+	EdgeRouterPolicies:        {"erp", "edge router policy"},
 }
 
 type object struct {
@@ -80,7 +84,7 @@ func NewTLSWithCredentials(username, password string) *Server {
 
 func newServer(username, password string) *Server {
 	objects := make(map[string]map[string]*object)
-	for _, kind := range []string{Configs, Services, ServicePolicies, ServiceEdgeRouterPolicies} {
+	for _, kind := range []string{Configs, Services, ServicePolicies, ServiceEdgeRouterPolicies, Identities, EdgeRouterPolicies} {
 		objects[kind] = make(map[string]*object)
 	}
 	return &Server{objects: objects, sessions: make(map[string]bool), username: username, password: password}
@@ -141,6 +145,27 @@ func (f *Server) OnBeforeCreate(hook func(kind, name string)) {
 func (f *Server) Seed(kind, name string, tags *rest_model.Tags) string {
 	f.nextID++
 	id := fmt.Sprintf("%s-%d", labels[kind].id, f.nextID)
+	f.seed(kind, id, name, tags)
+	return id
+}
+
+// SeedWithID inserts an object under a caller-chosen id, without counting it as a create. it takes the
+// fake's lock, so it is called from a test rather than a BeforeCreate hook. identities are addressed
+// by the id the store records (an environment's ZId), which is why this form exists.
+func (f *Server) SeedWithID(kind, id, name string, tags *rest_model.Tags) {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	f.seed(kind, id, name, tags)
+}
+
+// Has reports whether an object of kind exists with id.
+func (f *Server) Has(kind, id string) bool {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	return f.objects[kind][id] != nil
+}
+
+func (f *Server) seed(kind, id, name string, tags *rest_model.Tags) {
 	obj := &object{name: name, tags: tags}
 	switch kind {
 	case Configs:
@@ -153,11 +178,14 @@ func (f *Server) Seed(kind, name string, tags *rest_model.Tags) string {
 		obj.detail = &rest_model.ServicePolicyDetail{BaseEntity: base(id, tags), Name: &obj.name, IdentityRoles: rest_model.Roles{}, IdentityRolesDisplay: rest_model.NamedRoles{}, PostureCheckRoles: rest_model.Roles{}, PostureCheckRolesDisplay: rest_model.NamedRoles{}, ServiceRoles: rest_model.Roles{}, ServiceRolesDisplay: rest_model.NamedRoles{}, Semantic: new(rest_model.SemanticAllOf), Type: obj.dial}
 	case ServiceEdgeRouterPolicies:
 		obj.detail = &rest_model.ServiceEdgeRouterPolicyDetail{BaseEntity: base(id, tags), Name: &obj.name, EdgeRouterRoles: rest_model.Roles{}, EdgeRouterRolesDisplay: rest_model.NamedRoles{}, ServiceRoles: rest_model.Roles{}, ServiceRolesDisplay: rest_model.NamedRoles{}, Semantic: new(rest_model.SemanticAllOf)}
+	case Identities:
+		obj.detail = &rest_model.IdentityDetail{BaseEntity: base(id, tags), Name: &obj.name, AuthPolicy: &rest_model.EntityRef{}, AuthPolicyID: new(string), Authenticators: &rest_model.IdentityAuthenticators{}, DefaultHostingCost: new(rest_model.TerminatorCost), Disabled: new(bool), EdgeRouterConnectionStatus: new(string), Enrollment: &rest_model.IdentityEnrollments{}, EnvInfo: &rest_model.EnvInfo{}, ExternalID: new(string), HasAPISession: new(bool), HasEdgeRouterConnection: new(bool), Interfaces: []*rest_model.Interface{}, IsAdmin: new(bool), IsDefaultAdmin: new(bool), IsMfaEnabled: new(bool), RoleAttributes: &rest_model.Attributes{}, SdkInfo: &rest_model.SdkInfo{}, ServiceHostingCosts: rest_model.TerminatorCostMap{}, ServiceHostingPrecedences: rest_model.TerminatorPrecedenceMap{}, Type: &rest_model.EntityRef{}, TypeID: new(string)}
+	case EdgeRouterPolicies:
+		obj.detail = &rest_model.EdgeRouterPolicyDetail{BaseEntity: base(id, tags), Name: &obj.name, EdgeRouterRoles: rest_model.Roles{}, EdgeRouterRolesDisplay: rest_model.NamedRoles{}, IdentityRoles: rest_model.Roles{}, IdentityRolesDisplay: rest_model.NamedRoles{}, IsSystem: new(bool), Semantic: new(rest_model.SemanticAllOf)}
 	default:
 		panic("unknown kind " + kind)
 	}
 	f.objects[kind][id] = obj
-	return id
 }
 
 // Log returns the objects created and deleted through the api, in order, as 'kind/id'.
@@ -248,6 +276,10 @@ func (f *Server) serve(w http.ResponseWriter, r *http.Request) {
 		case http.MethodGet:
 			f.list(w, r, kind)
 		case http.MethodPost:
+			if kind == Identities || kind == EdgeRouterPolicies {
+				writeError(w, 405, "method not allowed")
+				return
+			}
 			f.create(w, r, kind)
 		default:
 			writeError(w, 405, "method not allowed")
@@ -381,6 +413,10 @@ func (f *Server) list(w http.ResponseWriter, r *http.Request, 
```

**File**: `controller/deleteIdentity.go` (modified, +5/-2)
```diff
@@ -39,8 +39,11 @@ func (h *deleteIdentityHandler) Handle(params admin.DeleteIdentityParams, princi
 
 	// delete the identity
 	if err := ziti.Identities.Delete(identityZId); err != nil {
-		dl.Errorf("error deleting identity '%v': %v", identityZId, err)
-		return admin.NewDeleteIdentityInternalServerError()
+		if !automation.IsNotFound(err) {
+			dl.Errorf("error deleting identity '%v': %v", identityZId, err)
+			return admin.NewDeleteIdentityInternalServerError()
+		}
+		dl.Infof("identity '%v' already deleted", identityZId)
 	}
 
 	return admin.NewDeleteIdentityOK()
```

**File**: `controller/disable.go` (modified, +4/-1)
```diff
@@ -71,7 +71,10 @@ func disableEnvironment(env *store.Environment, trx *sqlx.Tx, ziti *automation.Z
 
 	// delete identity for environment
 	if err := ziti.Identities.Delete(env.ZId); err != nil {
-		return errors.Wrapf(err, "error deleting identity for environment '%v'", env.ZId)
+		if !automation.IsNotFound(err) {
+			return errors.Wrapf(err, "error deleting identity for environment '%v'", env.ZId)
+		}
+		dl.Infof("identity '%v' for environment already deleted", env.ZId)
 	}
 
 	if err := removeEnvironmentFromStore(env, trx); err != nil {
```

**File**: `controller/disable_test.go` (added, +124/-0)
```diff
@@ -0,0 +1,124 @@
+package controller
+
+import (
+	"testing"
+
+	"github.com/openziti/zrok/v2/controller/automation/zitifake"
+	"github.com/openziti/zrok/v2/controller/store"
+	"github.com/openziti/zrok/v2/rest_model_zrok"
+	"github.com/openziti/zrok/v2/rest_server_zrok/operations/admin"
+	"github.com/openziti/zrok/v2/rest_server_zrok/operations/environment"
+	"github.com/stretchr/testify/require"
+)
+
+type disableFixture struct {
+	*shareCreateFixture
+	envID int
+}
+
+// setupDisableFixture adds a share and a frontend to the share-create fixture's environment 'env-zid'.
+// the fake holds no ziti objects for either, so their teardown deletes find nothing.
+func setupDisableFixture(t *testing.T) *disableFixture {
+	t.Helper()
+	f := setupShareCreateFixture(t)
+	trx, err := str.Begin()
+	require.NoError(t, err)
+	envs, err := str.FindEnvironmentsForAccount(int(f.principal.ID), trx)
+	require.NoError(t, err)
+	require.Len(t, envs, 1)
+	envID := envs[0].Id
+	_, err = str.CreateShare(envID, &store.Share{ZId: "share-zid", Token: "share-token", ShareMode: "private", BackendMode: "proxy", PermissionMode: store.OpenPermissionMode}, trx)
+	require.NoError(t, err)
+	_, err = str.CreateFrontend(envID, &store.Frontend{Token: "frontend-token", ZId: "env-zid", PermissionMode: store.OpenPermissionMode}, trx)
+	require.NoError(t, err)
+	require.NoError(t, trx.Commit())
+	return &disableFixture{shareCreateFixture: f, envID: envID}
+}
+
+func (f *disableFixture) disable() interface{} {
+	return newDisableHandler().Handle(environment.DisableParams{Body: environment.DisableBody{Identity: "env-zid"}}, f.principal)
+}
+
+func (f *disableFixture) requireEnvironmentRemoved(t *testing.T, removed bool) {
+	t.Helper()
+	trx, err := str.Begin()
+	require.NoError(t, err)
+	defer func() { _ = trx.Rollback() }()
+	env, err := str.GetEnvironment(f.envID, trx)
+	require.NoError(t, err)
+	require.Equal(t, removed, env.Deleted)
+	shrs, err := str.FindSharesForEnvironment(f.envID, trx)
+	require.NoError(t, err)
+	fes, err := str.FindFrontendsForEnvironment(f.envID, trx)
+	require.NoError(t, err)
+	if removed {
+		require.Empty(t, shrs)
+		require.Empty(t, fes)
+	} else {
+		require.Len(t, shrs, 1)
+		require.Len(t, fes, 1)
+	}
+}
+
+func TestDisableWithAbsentIdentitySucceeds(t *testing.T) {
+	f := setupDisableFixture(t)
+
+	resp := f.disable()
+
+	require.IsType(t, &environment.DisableOK{}, resp)
+	f.requireEnvironmentRemoved(t, true)
+	require.Contains(t, f.logs.String(), "identity 'env-zid' for environment already deleted")
+}
+
+func TestDisableDeletesPresentIdentity(t *testing.T) {
+	f := setupDisableFixture(t)
+	f.fake.SeedWithID(zitifake.Identities, "env-zid", "env-zid", nil)
+	f.fake.SeedWithID(zitifake.EdgeRouterPolicies, "erp-env", "env-zid", nil)
+
+	resp := f.disable()
+
+	require.IsType(t, &environment.DisableOK{}, resp)
+	require.False(t, f.fake.Has(zitifake.Identities, "env-zid"))
+	require.False(t, f.fake.Has(zitifake.EdgeRouterPolicies, "erp-env"))
+	f.requireEnvironmentRemoved(t, true)
+	require.NotContains(t, f.logs.String(), "already deleted")
+}
+
+func TestDisableOtherFailuresStillFail(t *testing.T) {
+	f := setupDisableFixture(t)
+	f.fake.SeedWithID(zitifake.Identities, "env-zid", "env-zid", nil)
+	f.fake.RejectOperations(true)
+
+	resp := f.disable()
+
+	require.IsType(t, &environment.DisableInternalServerError{}, resp)
+	f.fake.RejectOperations(false)
+	require.True(t, f.fake.Has(zitifake.Identities, "env-zid"))
+	f.requireEnvironmentRemoved(t, false)
+}
+
+func TestDeleteAccountWithAbsentIdentitySucceeds(t *testing.T) {
+	f := setupDisableFixture(t)
+
+	resp := newDeleteAccountHandler().Handle(admin.DeleteAccountParams{Body: admin.DeleteAccountBody{Email: "owner@example.com"}}, &rest_model_zrok.Principal{Admin: true})
+
+	require.IsType(t, &admin.DeleteAccountOK{}, resp)
+	f.requireEnvironmentRemoved(t, true)
+	trx, err := str.Begin()
+	require.NoError(t, err)
+	defer func() { _ = trx.Rollback() }()
+	_, err = str.FindAccountWithEmail("owner@example.com", trx)
+	require.Error(t, err)
+	envs, err := str.FindEnvironmentsForAccount(int(f.principal.ID), trx)
+	require.NoError(t, err)
+	require.Empty(t, envs)
+}
+
+func TestDeleteIdentityWithAbsentIdentitySucceeds(t *testing.T) {
+	f := setupShareCreateFixture(t)
+
+	resp := newDeleteIdentityHandler().Handle(admin.DeleteIdentityParams{Body: admin.DeleteIdentityBody{ZID: "env-zid"}}, &rest_model_zrok.Principal{Admin: true})
+
+	require.IsType(t, &admin.DeleteIdentityOK{}, resp)
+	require.Contains(t, f.logs.String(), "identity 'env-zid' already deleted")
+}
```

**File**: `docs/journal/2026-09-29.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+# 2026-09-29
+
+- Environment teardown (`disableEnvironment`, admin `deleteIdentity`) treats an already-deleted identity as deleted; anything else, a typed 401 included, still fails the request so the transaction rolls back and the rows survive for a retry. The identity is deleted by the ID the store records, so `zitifake.SeedWithID` exists to place one at an environment's `ZId`.
+- The handler test for "other failures still fail" rejects every operation, so its 401 surfaces at the edge router policy listing before the identity delete is reached; the guard's own refusal of a 401 rests on `automation.IsNotFound` matching only the generated `Delete*NotFound` types.
```

---

### Incident Patch 8: `23d4607b` (2026-09-29)
**Commit Message**: Merge pull request #1277 from openziti/fall-fixes-s5

share creation rollback compensation; better ziti errors

**File**: `.github/workflows/ci-build.yml` (modified, +4/-4)
```diff
@@ -34,7 +34,7 @@ jobs:
 
       - name: install ui node modules
         shell: bash
-        run: npm install
+        run: npm ci
         working-directory: ui
 
       - name: build ui
@@ -46,7 +46,7 @@ jobs:
 
       - name: install agent ui node modules
         shell: bash
-        run: npm install
+        run: npm ci
         working-directory: agent/agentUi
 
       - name: build agent ui
@@ -98,15 +98,15 @@ jobs:
         with:
           node-version: 20.x
 
-      - run: npm install
+      - run: npm ci
         working-directory: ui
 
       - run: npm run build
         working-directory: ui
         env:
           CI: "true"
 
-      - run: npm install
+      - run: npm ci
         working-directory: agent/agentUi
 
       - run: npm run build
```

**File**: `.github/workflows/release.yml` (modified, +6/-6)
```diff
@@ -47,15 +47,15 @@ jobs:
         with:
           node-version: 22.x
 
-      - run: npm install
+      - run: npm ci
         working-directory: ui
 
       - run: npm run build
         working-directory: ui
         env:
           CI: "true"
 
-      - run: npm install
+      - run: npm ci
         working-directory: agent/agentUi
 
       - run: npm run build
@@ -194,15 +194,15 @@ jobs:
         with:
           node-version: 22.x
 
-      - run: npm install
+      - run: npm ci
         working-directory: ui
 
       - run: npm run build
         working-directory: ui
         env:
           CI: "true"
 
-      - run: npm install
+      - run: npm ci
         working-directory: agent/agentUi
 
       - run: npm run build
@@ -248,15 +248,15 @@ jobs:
         with:
           node-version: 22.x
 
-      - run: npm install
+      - run: npm ci
         working-directory: ui
 
       - run: npm run build
         working-directory: ui
         env:
           CI: "true"
 
-      - run: npm install
+      - run: npm ci
         working-directory: agent/agentUi
 
       - run: npm run build
```

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -2,6 +2,10 @@
 
 ## Unreleased
 
+FIX: A share request that fails part-way now removes the OpenZiti objects it created (config, service and policies) and reports the underlying error. Previously the controller logged a `chk_z_id` constraint failure in place of the real OpenZiti error, and any failure after allocation, such as a closed private share granted to an unknown account, left the objects behind with no share owning them. Failed OpenZiti calls now log OpenZiti's own error code and message, such as the name of a conflicting object, where the log previously showed only the operation and HTTP status.
+
+FIX: Deleting OpenZiti objects that are already gone now counts as success during cleanup, so one object removed concurrently no longer stops the rest of a cleanup from running.
+
 ## v2.0.5
 
 FIX: The controller no longer crashes when the bandwidth-limit relax cycle meets a public share with no frontend selection. An account's limit is now cleared only once every one of its shares has been relaxed; a share that cannot be relaxed is retried on the next cycle without disturbing other accounts, and dial policies that already exist are not recreated.
```

**File**: `controller/automation/api.go` (modified, +30/-1)
```diff
@@ -5,6 +5,12 @@ import (
 	"time"
 
 	"github.com/openziti/edge-api/rest_management_api_client"
+	"github.com/openziti/edge-api/rest_management_api_client/config"
+	"github.com/openziti/edge-api/rest_management_api_client/edge_router_policy"
+	"github.com/openziti/edge-api/rest_management_api_client/identity"
+	"github.com/openziti/edge-api/rest_management_api_client/service"
+	"github.com/openziti/edge-api/rest_management_api_client/service_edge_router_policy"
+	"github.com/openziti/edge-api/rest_management_api_client/service_policy"
 	"github.com/pkg/errors"
 )
 
@@ -36,11 +42,34 @@ func (za *ZitiAutomation) Edge() *rest_management_api_client.ZitiEdgeManagement
 // error helper methods to simplify error handling
 
 func (za *ZitiAutomation) IsNotFound(err error) bool {
+	return IsNotFound(err)
+}
+
+// IsNotFound reports whether err says the object is absent: a not-found from the package's read
+// helpers, or the ziti api's not-found answer to one of the deletes this package issues. the pinned
+// edge-api (v0.26.48) generates no Code() accessor on its response types, so this list of generated
+// Delete*NotFound types is the contract; a delete added to the package adds its type here.
+// unauthorized, forbidden, connectivity and validation errors are not absence and are not matched.
+func IsNotFound(err error) bool {
+	if err == nil {
+		return false
+	}
 	var automationErr *AutomationError
 	if errors.As(err, &automationErr) {
 		return automationErr.IsNotFound()
 	}
-	return false
+	return isError[*identity.DeleteIdentityNotFound](err) ||
+		isError[*service.DeleteServiceNotFound](err) ||
+		isError[*config.DeleteConfigNotFound](err) ||
+		isError[*config.DeleteConfigTypeNotFound](err) ||
+		isError[*service_policy.DeleteServicePolicyNotFound](err) ||
+		isError[*service_edge_router_policy.DeleteServiceEdgeRouterPolicyNotFound](err) ||
+		isError[*edge_router_policy.DeleteEdgeRouterPolicyNotFound](err)
+}
+
+func isError[T error](err error) bool {
+	var target T
+	return errors.As(err, &target)
 }
 
 func (za *ZitiAutomation) ShouldRetry(err error) bool {
```

**File**: `controller/automation/config.go` (modified, +4/-5)
```diff
@@ -4,7 +4,6 @@ import (
 	"github.com/michaelquigley/df/dl"
 	"github.com/openziti/edge-api/rest_management_api_client/config"
 	"github.com/openziti/edge-api/rest_model"
-	"github.com/pkg/errors"
 )
 
 type ConfigManager struct {
@@ -39,7 +38,7 @@ func (cm *ConfigManager) Create(opts *ConfigOptions) (string, error) {
 
 	resp, err := cm.Edge().Config.CreateConfig(req, nil)
 	if err != nil {
-		return "", errors.Wrapf(err, "error creating config '%s'", opts.Name)
+		return "", wrapEdgeError(err, "error creating config '%s'", opts.Name)
 	}
 
 	dl.Infof("created config '%s' with id '%s'", opts.Name, resp.Payload.Data.ID)
@@ -60,7 +59,7 @@ func (cm *ConfigManager) Update(id string, opts *ConfigOptions) error {
 
 	_, err := cm.Edge().Config.UpdateConfig(req, nil)
 	if err != nil {
-		return errors.Wrapf(err, "error updating config '%s'", id)
+		return wrapEdgeError(err, "error updating config '%s'", id)
 	}
 
 	dl.Infof("updated config '%s'", id)
@@ -76,7 +75,7 @@ func (cm *ConfigManager) Delete(id string) error {
 
 	_, err := cm.Edge().Config.DeleteConfig(req, nil)
 	if err != nil {
-		return errors.Wrapf(err, "error deleting config '%s'", id)
+		return wrapEdgeError(err, "error deleting config '%s'", id)
 	}
 
 	dl.Infof("deleted config '%s'", id)
@@ -94,7 +93,7 @@ func (cm *ConfigManager) Find(opts *FilterOptions) ([]*rest_model.ConfigDetail,
 
 	resp, err := cm.Edge().Config.ListConfigs(req, nil)
 	if err != nil {
-		return nil, errors.Wrap(err, "error listing configs")
+		return nil, wrapEdgeError(err, "error listing configs")
 	}
 
 	return resp.Payload.Data, nil
```

**File**: `controller/automation/configType.go` (modified, +3/-4)
```diff
@@ -4,7 +4,6 @@ import (
 	"github.com/michaelquigley/df/dl"
 	"github.com/openziti/edge-api/rest_management_api_client/config"
 	"github.com/openziti/edge-api/rest_model"
-	"github.com/pkg/errors"
 )
 
 type ConfigTypeManager struct {
@@ -37,7 +36,7 @@ func (ctm *ConfigTypeManager) Create(opts *ConfigTypeOptions) (string, error) {
 
 	resp, err := ctm.Edge().Config.CreateConfigType(req, nil)
 	if err != nil {
-		return "", errors.Wrapf(err, "error creating config type '%s'", opts.Name)
+		return "", wrapEdgeError(err, "error creating config type '%s'", opts.Name)
 	}
 
 	dl.Infof("created config type '%s' with id '%s'", opts.Name, resp.Payload.Data.ID)
@@ -53,7 +52,7 @@ func (ctm *ConfigTypeManager) Delete(id string) error {
 
 	_, err := ctm.Edge().Config.DeleteConfigType(req, nil)
 	if err != nil {
-		return errors.Wrapf(err, "error deleting config type '%s'", id)
+		return wrapEdgeError(err, "error deleting config type '%s'", id)
 	}
 
 	dl.Infof("deleted config type '%s'", id)
@@ -71,7 +70,7 @@ func (ctm *ConfigTypeManager) Find(opts *FilterOptions) ([]*rest_model.ConfigTyp
 
 	resp, err := ctm.Edge().Config.ListConfigTypes(req, nil)
 	if err != nil {
-		return nil, errors.Wrap(err, "error listing config types")
+		return nil, wrapEdgeError(err, "error listing config types")
 	}
 
 	return resp.Payload.Data, nil
```

**File**: `controller/automation/edgeRouterPolicy.go` (modified, +3/-4)
```diff
@@ -4,7 +4,6 @@ import (
 	"github.com/michaelquigley/df/dl"
 	"github.com/openziti/edge-api/rest_management_api_client/edge_router_policy"
 	"github.com/openziti/edge-api/rest_model"
-	"github.com/pkg/errors"
 )
 
 type EdgeRouterPolicyManager struct {
@@ -41,7 +40,7 @@ func (erpm *EdgeRouterPolicyManager) Create(opts *EdgeRouterPolicyOptions) (stri
 
 	resp, err := erpm.Edge().EdgeRouterPolicy.CreateEdgeRouterPolicy(req, nil)
 	if err != nil {
-		return "", errors.Wrapf(err, "error creating edge router policy '%s'", opts.Name)
+		return "", wrapEdgeError(err, "error creating edge router policy '%s'", opts.Name)
 	}
 
 	dl.Infof("created edge router policy '%s' with id '%s'", opts.Name, resp.Payload.Data.ID)
@@ -57,7 +56,7 @@ func (erpm *EdgeRouterPolicyManager) Delete(id string) error {
 
 	_, err := erpm.Edge().EdgeRouterPolicy.DeleteEdgeRouterPolicy(req, nil)
 	if err != nil {
-		return errors.Wrapf(err, "error deleting edge router policy '%s'", id)
+		return wrapEdgeError(err, "error deleting edge router policy '%s'", id)
 	}
 
 	dl.Infof("deleted edge router policy '%s'", id)
@@ -75,7 +74,7 @@ func (erpm *EdgeRouterPolicyManager) Find(opts *FilterOptions) ([]*rest_model.Ed
 
 	resp, err := erpm.Edge().EdgeRouterPolicy.ListEdgeRouterPolicies(req, nil)
 	if err != nil {
-		return nil, errors.Wrap(err, "error listing edge router policies")
+		return nil, wrapEdgeError(err, "error listing edge router policies")
 	}
 
 	return resp.Payload.Data, nil
```

**File**: `controller/automation/identity.go` (modified, +4/-4)
```diff
@@ -42,7 +42,7 @@ func (im *IdentityManager) Create(opts *IdentityOptions) (string, error) {
 
 	resp, err := im.Edge().Identity.CreateIdentity(req, nil)
 	if err != nil {
-		return "", errors.Wrapf(err, "error creating identity '%s'", opts.Name)
+		return "", wrapEdgeError(err, "error creating identity '%s'", opts.Name)
 	}
 
 	dl.Infof("created identity '%s' with id '%s'", opts.Name, resp.Payload.Data.ID)
@@ -58,7 +58,7 @@ func (im *IdentityManager) Delete(id string) error {
 
 	_, err := im.Edge().Identity.DeleteIdentity(req, nil)
 	if err != nil {
-		return errors.Wrapf(err, "error deleting identity '%s'", id)
+		return wrapEdgeError(err, "error deleting identity '%s'", id)
 	}
 
 	dl.Infof("deleted identity '%s'", id)
@@ -76,7 +76,7 @@ func (im *IdentityManager) Find(opts *FilterOptions) ([]*rest_model.IdentityDeta
 
 	resp, err := im.Edge().Identity.ListIdentities(req, nil)
 	if err != nil {
-		return nil, errors.Wrap(err, "error listing identities")
+		return nil, wrapEdgeError(err, "error listing identities")
 	}
 
 	return resp.Payload.Data, nil
@@ -103,7 +103,7 @@ func (im *IdentityManager) Enroll(id string) (*ziti.Config, error) {
 
 	resp, err := im.Edge().Identity.DetailIdentity(p, nil)
 	if err != nil {
-		return nil, errors.Wrapf(err, "error getting identity details for '%s'", id)
+		return nil, wrapEdgeError(err, "error getting identity details for '%s'", id)
 	}
 
 	tkn, _, err := enroll.ParseToken(resp.GetPayload().Data.Enrollment.Ott.JWT)
```

---

### Incident Patch 9: `3bd9152e` (2026-09-27)
**Commit Message**: Merge pull request #1275 from openziti/fall-fixes

fall fixes, v2 round 1

**File**: `CHANGELOG.md` (modified, +13/-2)
```diff
@@ -1,5 +1,17 @@
 # CHANGELOG
 
+## Unreleased
+
+## v2.0.5
+
+FIX: The controller no longer crashes when the bandwidth-limit relax cycle meets a public share with no frontend selection. An account's limit is now cleared only once every one of its shares has been relaxed; a share that cannot be relaxed is retried on the next cycle without disturbing other accounts, and dial policies that already exist are not recreated.
+
+FIX: The controller holds one OpenZiti management session and re-authenticates only when it expires, instead of logging in on every operation. This removes the pressure on the OpenZiti controller's authentication rate limit during bursts of share activity and limit enforcement. A persistent authentication failure, such as rotated or mistyped OpenZiti credentials, now fails operations quickly instead of queueing them behind one login attempt after another.
+
+FIX: The metrics consumer bounds how many AMQP messages it holds unacknowledged and how long it spends on each: InfluxDB writes and share lookups have deadlines and a bounded retry, after which the message is dropped rather than parked, so a slow or unavailable InfluxDB or database can no longer fill the broker's memory. Malformed events are dropped immediately, a panic while processing one message no longer stops the consumer, and a full limits queue drops the handoff after a timeout while the usage stays recorded in InfluxDB.
+
+CHANGE: `Makefile`: `make` builds the UIs and installs the module, `make test` runs the full gate (UI builds and lints, `go test`, `go vet`), `make clean` resets the project-owned `GOBIN` and UI build products. The UI lint errors the gate surfaced are fixed.
+
 ## v2.0.4
 
 FIX: The agent no longer deletes reserved shares from the controller during graceful shutdown or after an abnormal subordinate process exit. Previously, a `SIGTERM`/`SIGINT` (e.g., on system reboot) caused the agent to issue an unconditional `DeleteShare` against the controller for every active share, destroying the reservation for private shares created with `--share-token` and for public shares with reserved names. The reservation is now preserved unless the user explicitly released the share via `zrok2 agent release`, allowing the agent to reattach on the next start. (https://github.com/openziti/zrok/issues/1251)
@@ -328,8 +340,7 @@ CHANGE: Add usage hint in `zrok config get --help` to clarify how to list all va
 
 CHANGE: The Python SDK's `Overview()` function was refactored as a class method (https://github.com/openziti/zrok/pull/846).
 
-FEATURE: The Python SDK now includes a `ProxyShare` class providing an HTTP proxy for public and private shares and a
-Jupyter notebook example (https://github.com/openziti/zrok/pull/847).
+FEATURE: The Python SDK now includes a `ProxyShare` class providing an HTTP proxy for public and private shares and a Jupyter notebook example (https://github.com/openziti/zrok/pull/847).
 
 FIX: PyPi publishing was failing due to a CI issue (https://github.com/openziti/zrok/issues/849)
 
```

**File**: `Makefile` (modified, +21/-9)
```diff
@@ -1,18 +1,30 @@
 .DEFAULT_GOAL := build
-TARGETS ?= ./cmd/zrok2
+GOBIN ?= $(shell go env GOPATH)/bin
 
-.PHONY: clean build test
+ifeq ($(filter-out /,$(abspath $(GOBIN))),)
+$(error GOBIN is '$(GOBIN)'; it must name a real directory)
+endif
 
-clean:
-	rm -rf ui/node_modules ui/dist agent/agentUi/node_modules agent/agentUi/dist
+.PHONY: build test clean frontend frontend-test
+
+build: frontend
+	go install ./...
+
+test: frontend-test
+	go test ./... -count=1
+	go vet ./...
 
-build:
+frontend:
 	npm --prefix ui install
 	npm --prefix ui run build
 	npm --prefix agent/agentUi install
 	npm --prefix agent/agentUi run build
-	go install $(TARGETS)
 
-test:
-	go test ./... -count=1
-	go vet ./...
+frontend-test: frontend
+	npm --prefix ui run lint
+	npm --prefix agent/agentUi run lint
+
+clean:
+	go clean ./...
+	rm -f "$(GOBIN)"/*
+	rm -rf ui/node_modules ui/dist agent/agentUi/node_modules agent/agentUi/dist
```

**File**: `RELEASING.md` (modified, +14/-2)
```diff
@@ -13,8 +13,7 @@ Pre-release version strings must contain exactly one hyphen, and may not contain
 
 ## How to Trigger Release Automation
 
-> [!NOTE]
-> Each trigger is outlined separately, but some may occur simultaneously, e.g., when a draft release is published as stable rather than first publishing it as a pre-release, or a pre-release is promoted to stable and marked as latest at the same time.
+> [!NOTE] Each trigger is outlined separately, but some may occur simultaneously, e.g., when a draft release is published as stable rather than first publishing it as a pre-release, or a pre-release is promoted to stable and marked as latest at the same time.
 
 1. Push a tag to GitHub like `v*.*.*` to trigger **the pre-release workflow**. Wait for this workflow to complete before marking the release stable (`isPrerelease: false`).
     1. Linux packages are uploaded to Artifactory as pre-releases.
@@ -32,6 +31,19 @@ Pre-release version strings must contain exactly one hyphen, and may not contain
 1. Edit the stable release to mark it as latest.
     1. https://docs.zrok.io/docs/guides/install/ always serves the "latest" stable version via GitHub binary download URLs.
 
+## Two Release Lines
+
+While the v1 line is maintained alongside v2, releases are cut from two places and must not be confused with each other.
+
+- **v2** is `main`. Fixes land on a working branch, merge to `main`, and are tagged `v2.x.y` there. Its artifacts are all named `zrok2`: the `openziti/zrok2` Docker image, the `zrok2*` Linux packages, the `zrok2` Homebrew formula, the `zrok2` PyPI package, the `@openziti/zrok2` npm package.
+- **v1** is `main-v1`, the maintenance branch cut from `v1.1.11`. Fixes land on a working branch, merge to `main-v1`, and are tagged `v1.x.y` there; nothing from it merges to `main`. Its artifacts keep the v1 names: `openziti/zrok`, the `zrok`, `zrok-share` and `zrok-agent` packages, the `zrok` formula, the `zrok` PyPI package, `@openziti/zrok`.
+
+A tag runs the workflow files at the tagged commit, so a `v1.x.y` tag builds and promotes with the v1 branch's workflows and names, and a `v2.x.y` tag with `main`'s. The image repository is chosen by each workflow's default; the `ZROK_CONTAINER_IMAGE_REPO` repository variable is deliberately unset, and setting it would send both lines to one repository.
+
+Two things differ by hand for a v1 release. When publishing the draft, leave "Set as the latest release" unchecked and mark it explicitly as not latest, so the GitHub "latest" release, which the install documentation downloads from, stays on v2. And the `CHANGELOG.md` on the v1 branch gets its own `## v1.x.y` section; the two changelogs describe the same fixes where both lines received them and are edited independently.
+
+Both lines keep the pinned `## Unreleased` section at the top of `CHANGELOG.md`; cutting a release moves its entries under a new `## vX.Y.Z` heading and leaves `## Unreleased` empty above it.
+
 ## Rolling Back Downstreams
 
 The concepts, tools, and procedures for managing existing downstream artifacts in Artifactory and Docker Hub are identical for zrok and ziti. Here's the [RELEASING.md document for ziti](https://github.com/openziti/ziti/blob/main/RELEASING.md#rolling-back-downstreams).
```

**File**: `agent/agentUi/package-lock.json` (modified, +197/-204)
```diff
@@ -29,61 +29,47 @@
         "vite": "^6.2.0"
       }
     },
-    "node_modules/@ampproject/remapping": {
-      "version": "2.3.0",
-      "resolved": "https://registry.npmjs.org/@ampproject/remapping/-/remapping-2.3.0.tgz",
-      "integrity": "sha512-30iZtAPgz+LTIYoeivqYo853f02jBYSd5uGnGpkFV0M3xOt9aN73erkgYAmZU43x4VfqcnLxW9Kpg3R5LC4YYw==",
-      "dev": true,
-      "license": "Apache-2.0",
-      "dependencies": {
-        "@jridgewell/gen-mapping": "^0.3.5",
-        "@jridgewell/trace-mapping": "^0.3.24"
-      },
-      "engines": {
-        "node": ">=6.0.0"
-      }
-    },
     "node_modules/@babel/code-frame": {
-      "version": "7.26.2",
-      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.26.2.tgz",
-      "integrity": "sha512-RJlIHRueQgwWitWgF8OdFYGZX328Ax5BCemNGlqHfplnRT9ESi8JkFlvaVYbS+UubVY6dpv87Fs2u5M29iNFVQ==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.29.7.tgz",
+      "integrity": "sha512-Aup7aUOfpbAUg2ROOJN6Iw5f9DMBlzu0mIkm/malLQFN/YQgO48wCj0Kxa3sEHJvPVFg7siR+qRInwXd2qhQKw==",
       "license": "MIT",
       "dependencies": {
-        "@babel/helper-validator-identifier": "^7.25.9",
+        "@babel/helper-validator-identifier": "^7.29.7",
         "js-tokens": "^4.0.0",
-        "picocolors": "^1.0.0"
+        "picocolors": "^1.1.1"
       },
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@babel/compat-data": {
-      "version": "7.26.2",
-      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.26.2.tgz",
-      "integrity": "sha512-Z0WgzSEa+aUcdiJuCIqgujCshpMWgUpgOxXotrYPSA53hA3qopNaqcJpyr0hVb1FeWdnqFA35/fUtXgBK8srQg==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.29.7.tgz",
+      "integrity": "sha512-locTkQyKvwIEgBzVrn8693ebc97F2U8ZHjbXwDXJ5Fn2TCpNwTlKcaKLkdHop5c/icOFE7qt7Q9JC5hnKNa6Gg==",
       "dev": true,
       "license": "MIT",
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@babel/core": {
-      "version": "7.26.0",
-      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.26.0.tgz",
-      "integrity": "sha512-i1SLeK+DzNnQ3LL/CswPCa/E5u4lh1k6IAEphON8F+cXt0t9euTshDru0q7/IqMa1PMPz5RnHuHscF8/ZJsStg==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.29.7.tgz",
+      "integrity": "sha512-RgHBCvtjbOK2gXSNBNIkNoEc9qoVEtau3hj8gEqKQuL3HZAibKarWFEI3Lfm6EYKkLalOh8eSrj9b+ch9H/VBA==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@ampproject/remapping": "^2.2.0",
-        "@babel/code-frame": "^7.26.0",
-        "@babel/generator": "^7.26.0",
-        "@babel/helper-compilation-targets": "^7.25.9",
-        "@babel/helper-module-transforms": "^7.26.0",
-        "@babel/helpers": "^7.26.0",
-        "@babel/parser": "^7.26.0",
-        "@babel/template": "^7.25.9",
-        "@babel/traverse": "^7.25.9",
-        "@babel/types": "^7.26.0",
+        "@babel/code-frame": "^7.29.7",
+        "@babel/generator": "^7.29.7",
+        "@babel/helper-compilation-targets": "^7.29.7",
+        "@babel/helper-module-transforms": "^7.29.7",
+        "@babel/helpers": "^7.29.7",
+        "@babel/parser": "^7.29.7",
+        "@babel/template": "^7.29.7",
+        "@babel/traverse": "^7.29.7",
+        "@babel/types": "^7.29.7",
+        "@jridgewell/remapping": "^2.3.5",
         "convert-source-map": "^2.0.0",
         "debug": "^4.1.0",
         "gensync": "^1.0.0-beta.2",
@@ -99,30 +85,30 @@
       }
     },
     "node_modules/@babel/generator": {
-      "version": "7.26.2",
-      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.26.2.tgz",
-      "integrity": "sha512-zevQbhbau95nkoxSq3f/DC/SC+EEOUZd3DYqfSkMhY2/wfSeaHV1Ew4vk8e+x8lja31IbyuUa2uQ3JONqKbysw==",
+      "version": "7.29.8",
+      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.29.8.tgz",
+      "integrity": "sha512-gZbepsdh3WDtgZKWL+vTPh71LSBrm/Y4/QDZBVCcYfmeTEEuoOYwlSy+G1StfJg+/Zy550u/3TATbm7qDbbMtg==",
       "license": "MIT",
       "dependencies": {
-        "@babel/parser": "^7.26.2",
-        "@babel/types": "^7.26.0",
-        "@jridgewell/gen-mapping": "^0.3.5",
-        "@jridgewell/trace-mapping": "^0.3.25",
+        "@babel/parser": "^7.29.8",
+        "@babel/types": "^7.29.8",
+        "@jridgewell/gen-mapping": "^0.3.12",
+        "@jridgewell/trace-mapping": "^0.3.28",
         "jsesc": "^3.0.2"
       },
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@babel/helper-compilation-targets": {
-      "version": "7.25.9",
-      "resolved": "https://registry.npmjs.org/@babel/helper-compilation-targets/-/helper-compilation-targets-7.25.9.tgz",
-      "integrity": "sha512-j9Db8Suy6yV/VHa4qzrj9yZfZxhLWQdVnRlXxmKLYlhWUVB1sB2G5sxuWYXk/whHD9iW76PmNzxZ4UCnTQTVEQ==",
+      "version": "7.29.7",
+      "resolved"
```

**File**: `agent/agentUi/package.json` (modified, +3/-0)
```diff
@@ -29,5 +29,8 @@
     "globals": "^15.11.0",
     "typescript-eslint": "^8.15.0",
     "vite": "^6.2.0"
+  },
+  "allowScripts": {
+    "esbuild@0.25.0": true
   }
 }
```

**File**: `agent/agentUi/src/AgentUi.tsx` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@ import NewShareModal from "./NewShareModal.tsx";
 import NewAccessModal from "./NewAccessModal.tsx";
 
 const AgentUi = () => {
-    const [version, setVersion] = useState("unset");
+    const [, setVersion] = useState("unset");
     const [overview, setOverview] = useState(new Array<AgentObject>());
     const [newShareOpen, setNewShareOpen] = useState(false);
     const [newAccessOpen, setNewAccessOpen] = useState(false);
@@ -41,7 +41,7 @@ const AgentUi = () => {
     }, []);
 
     useEffect(() => {
-        let interval = setInterval(() => {
+        const interval = setInterval(() => {
             GetAgentApi().agentStatus()
                 .then(r => {
                     setOverview(buildOverview(r));
```

**File**: `agent/agentUi/src/NewAccessModal.tsx` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ const NewAccessModal = ({ close, isOpen }: NewAccessModalProps) => {
         onSubmit: v => {
             setErrorMessage(null as React.JSX.Element);
             GetAgentApi().agentAccessPrivate(v)
-                .then(r => {
+                .then(() => {
                     close();
                 })
                 .catch(e => {
```

**File**: `agent/agentUi/src/NewShareModal.tsx` (modified, +2/-2)
```diff
@@ -25,7 +25,7 @@ const NewShareModal = ({ close, isOpen }: NewShareModalProps) => {
             switch(v.shareMode) {
                 case "public":
                     GetAgentApi().agentSharePublic(v)
-                        .then(r => {
+                        .then(() => {
                             close();
                         })
                         .catch(e => {
@@ -38,7 +38,7 @@ const NewShareModal = ({ close, isOpen }: NewShareModalProps) => {
 
                 case "private":
                     GetAgentApi().agentSharePrivate(v)
-                        .then(r => {
+                        .then(() => {
                             close();
                         })
                         .catch(e => {
```

---

### Incident Patch 10: `3103371e` (2026-09-27)
**Commit Message**: metrics consumer fix: prefetch bound, bounded retry, nack, time-bounded influx writes, on, and on...

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+FIX: The controller's metrics consumer now bounds its AMQP prefetch, usage lookup and InfluxDB write time, and retries, so a slow or unavailable store or InfluxDB no longer makes it hold the entire broker queue unacknowledged. Usage lookups and writes share one retry deadline. Malformed events and exhausted processing attempts are dropped without requeue; shutdown leaves unfinished deliveries for broker recovery. A message that triggers a panic is logged and dropped so processing can continue. A full limits queue drops and logs the handoff after a timeout; the recorded usage remains in InfluxDB for subsequent enforcement.
+
 FIX: The controller now keeps a bandwidth-limit journal entry when any share cannot be relaxed, and retries safely on the next cycle without recreating dial policies that already exist. A public share without a frontend selection no longer crashes the controller; its account remains limited while other accounts continue through the cycle.
 
 CHANGE: The `Makefile` now follows the shared convention: `make` builds (frontends first, then `go install ./...` for the whole module), `make test` is the full repository gate (frontend builds and lints, `go test`, `go vet`), and `make clean` resets the project-owned `GOBIN` and the frontend build products. The `ui` and `agent/agentUi` lint scripts are part of the gate, and the handful of lint errors they reported (wrapper object types, an unnecessary regex escape, unused variables) are fixed.
```

**File**: `controller/limits/agent.go` (modified, +24/-1)
```diff
@@ -1,8 +1,10 @@
 package limits
 
 import (
+	"context"
 	"fmt"
 	"reflect"
+	"sync/atomic"
 	"time"
 
 	"github.com/jmoiron/sqlx"
@@ -28,6 +30,7 @@ type Agent struct {
 	relaxActions   []AccountAction
 	close          chan struct{}
 	join           chan struct{}
+	droppedEvents  atomic.Uint64
 }
 
 type bandwidthReader interface {
@@ -252,11 +255,31 @@ func (a *Agent) CanAccessShare(shrId int, trx *sqlx.Tx) (bool, error) {
 }
 
 func (a *Agent) Handle(u *metrics.Usage) error {
+	return a.HandleContext(context.Background(), u)
+}
+
+func (a *Agent) HandleContext(ctx context.Context, u *metrics.Usage) error {
 	dl.Debugf("handling: %v", u)
-	a.queue <- u
+	timeout := 3 * time.Second
+	if a.cfg != nil && a.cfg.HandoffTimeout > 0 {
+		timeout = a.cfg.HandoffTimeout
+	}
+	timer := time.NewTimer(timeout)
+	defer timer.Stop()
+	select {
+	case a.queue <- u:
+		return nil
+	case <-timer.C:
+	case <-a.close:
+	case <-ctx.Done():
+	}
+	a.droppedEvents.Add(1)
+	dl.Warnf("dropped limits handoff for share '%v'; usage is recorded in InfluxDB", u.ShareToken)
 	return nil
 }
 
+func (a *Agent) DroppedEvents() uint64 { return a.droppedEvents.Load() }
+
 func (a *Agent) run() {
 	dl.Info("started")
 	defer dl.Info("stopped")
```

**File**: `controller/limits/config.go` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ type Config struct {
 	Bandwidth      *BandwidthPerPeriod
 	Cycle          time.Duration
 	Enforcing      bool
+	HandoffTimeout time.Duration
 }
 
 type BandwidthPerPeriod struct {
```

**File**: `controller/limits/handoff_test.go` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+package limits
+
+import (
+	"context"
+	"testing"
+	"time"
+
+	"github.com/openziti/zrok/v2/controller/metrics"
+	"github.com/stretchr/testify/require"
+)
+
+func TestFullHandoffDropsWithinTimeout(t *testing.T) {
+	a := &Agent{cfg: &Config{HandoffTimeout: 20 * time.Millisecond}, queue: make(chan *metrics.Usage, 1), close: make(chan struct{})}
+	a.queue <- &metrics.Usage{}
+	started := time.Now()
+	require.NoError(t, a.Handle(&metrics.Usage{ShareToken: "share"}))
+	require.GreaterOrEqual(t, time.Since(started), 20*time.Millisecond)
+	require.Less(t, time.Since(started), 500*time.Millisecond)
+	require.EqualValues(t, 1, a.DroppedEvents())
+	require.Len(t, a.queue, 1)
+}
+
+func TestHandoffObservesConsumerShutdown(t *testing.T) {
+	a := &Agent{cfg: &Config{HandoffTimeout: time.Minute}, queue: make(chan *metrics.Usage), close: make(chan struct{})}
+	ctx, cancel := context.WithCancel(context.Background())
+	cancel()
+	started := time.Now()
+	require.NoError(t, a.HandleContext(ctx, &metrics.Usage{ShareToken: "share"}))
+	require.Less(t, time.Since(started), 500*time.Millisecond)
+	require.EqualValues(t, 1, a.DroppedEvents())
+}
```

**File**: `controller/metrics/agent.go` (modified, +187/-42)
```diff
@@ -1,80 +1,225 @@
 package metrics
 
 import (
+	"context"
+	"sync"
+	"time"
+
 	"github.com/michaelquigley/df/dl"
 	"github.com/openziti/zrok/v2/controller/store"
 	"github.com/pkg/errors"
 )
 
 type Agent struct {
-	events  chan ZitiEventMsg
-	src     ZitiEventJsonSource
-	srcJoin chan struct{}
-	cache   *cache
-	snks    []UsageSink
+	cfg      AgentConfig
+	events   chan ZitiEventMsg
+	src      ZitiEventJsonSource
+	srcJoin  chan struct{}
+	cache    *cache
+	durable  UsageSink
+	snks     []UsageSink
+	ctx      context.Context
+	cancel   context.CancelFunc
+	join     chan struct{}
+	stopOnce sync.Once
+	// one legacy sink may remain blocked; never spawn another while it is running.
+	callSlot chan struct{}
 }
 
 func NewAgent(cfg *AgentConfig, str *store.Store, ifxCfg *InfluxConfig) (*Agent, error) {
-	a := &Agent{}
+	a := &Agent{cfg: cfg.withDefaults(), callSlot: make(chan struct{}, 1)}
 	if v, ok := cfg.Source.(ZitiEventJsonSource); ok {
 		a.src = v
 	} else {
 		return nil, errors.New("invalid event json source")
 	}
 	a.cache = newShareCache(str)
-	a.snks = append(a.snks, newInfluxWriter(ifxCfg))
+	a.durable = newInfluxWriter(ifxCfg)
 	return a, nil
 }
 
-func (a *Agent) AddUsageSink(snk UsageSink) {
-	a.snks = append(a.snks, snk)
-}
+func (a *Agent) AddUsageSink(snk UsageSink) { a.snks = append(a.snks, snk) }
 
 func (a *Agent) Start() error {
+	a.ctx, a.cancel = context.WithCancel(context.Background())
 	a.events = make(chan ZitiEventMsg)
 	srcJoin, err := a.src.Start(a.events)
 	if err != nil {
+		a.cancel()
 		return err
 	}
 	a.srcJoin = srcJoin
+	a.join = make(chan struct{})
+	go a.run()
+	return nil
+}
 
-	go func() {
-		dl.Info("started")
-		defer dl.Info("stopped")
-		for {
-			select {
-			case event := <-a.events:
-				if usage, err := Ingest(event.Data()); err == nil {
-					if usage.ZitiServiceId != "" {
-						if err := a.cache.addZrokDetail(usage); err != nil {
-							dl.Debugf("unable to add zrok detail for: %v: %v", usage.String(), err)
-						}
-					}
-					shouldAck := true
-					for _, snk := range a.snks {
-						if err := snk.Handle(usage); err != nil {
-							dl.Errorf("error handling usage: %v", err)
-							if shouldAck {
-								shouldAck = false
-							}
-						}
-					}
-					if shouldAck {
-						if err := event.Ack(); err != nil {
-							dl.Errorf("unable to ack handled message: %v", err)
-						}
-					}
-				} else {
-					dl.Errorf("unable to ingest '%v': %v", event.Data(), err)
-				}
+func (a *Agent) run() {
+	dl.Info("started")
+	defer close(a.join)
+	defer dl.Info("stopped")
+	defer func() {
+		if writer, ok := a.durable.(*influxWriter); ok {
+			writer.idb.Close()
+		}
+	}()
+	for {
+		select {
+		case event, ok := <-a.events:
+			if !ok {
+				return
+			}
+			if a.ctx.Err() != nil {
+				// drain so the source can exit; leave deliveries unsettled for the broker to requeue.
+				continue
 			}
+			a.process(event)
+		case <-a.srcJoin:
+			return
+		}
+	}
+}
+
+func (a *Agent) process(event ZitiEventMsg) {
+	var data ZitiEventJson
+	defer func() {
+		if recovered := recover(); recovered != nil {
+			body := string(data)
+			if len(body) > 512 {
+				body = body[:512] + "..."
+			}
+			dl.Errorf("panic processing usage body '%s': %v", body, recovered)
+			a.nack(event)
 		}
 	}()
+	data = event.Data()
+	usage, err := Ingest(data)
+	if err != nil {
+		dl.Errorf("unable to ingest message: %v", err)
+		a.nack(event)
+		return
+	}
+	ctx, cancel := context.WithTimeout(a.ctx, a.cfg.RetryBudget)
+	defer cancel()
+	if usage.ZitiServiceId != "" {
+		if err := a.retry(ctx, func() error {
+			err := a.cache.addZrokDetail(ctx, usage)
+			if errors.Is(err, errNotAShare) || errors.Is(err, errNoAccount) {
+				dl.Debugf("unable to add zrok detail for: %v: %v", usage.String(), err)
+				return nil
+			}
+			return err
+		}); err != nil {
+			if a.ctx.Err() != nil {
+				return
+			}
+			dl.Errorf("unable to add zrok detail (message dropped): %v", err)
+			a.nack(event)
+			return
+		}
+	}
+	if err := a.retry(ctx, func() error { return a.handle(ctx, a.durable, usage) }); err != nil {
+		if a.ctx.Err() != nil {
+			// shutdown leaves the active delivery for broker recovery too.
+			return
+		}
+		dl.Errorf("unable to handle usage (message dropped): %v", err)
+		a.nack(event)
+		return
+	}
+	for _, snk := range a.snks {
+		if err := a.handle(ctx, snk, usage); err != nil {
+			dl.Errorf("unable to handle usage after durable sink succeeded (delivery will be acknowledged): %v", err)
+		}
+	}
+	if err := event.Ack(); err != nil {
+		dl.Errorf("unable to ack handled message: %v", err)
+	}
+}
 
-	return nil
+func (a *Agent) retry(ctx context.Context, operation func() error) error {
+	backoff := min(a.cfg.RetryInitialBackoff, a.cfg.RetryMaxBackoff)
+	for attempt := 1; attempt <= a.cfg.RetryAttempts; attempt++ {
+		if err := ctx.Err(); err != nil {
+			return err
+		}
+		err := operation()
+		if err == nil {
+			return nil
+		}
+		if attempt == a.cfg.RetryAttempts {
+			return err
+		
```

**File**: `controller/metrics/agent_test.go` (added, +431/-0)
```diff
@@ -0,0 +1,431 @@
+package metrics
+
+import (
+	"bytes"
+	"context"
+	"errors"
+	"log/slog"
+	"strings"
+	"sync"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	"github.com/michaelquigley/df/dl"
+	"github.com/openziti/zrok/v2/controller/store"
+	"github.com/stretchr/testify/require"
+)
+
+const validUsage ZitiEventJson = `{"namespace":"fabric.usage","interval_start_utc":1,"tags":{"serviceId":"unrelated"},"usage":{}}`
+
+type testEvent struct {
+	data  ZitiEventJson
+	acks  atomic.Int32
+	nacks atomic.Int32
+	done  chan bool
+}
+
+func (e *testEvent) Data() ZitiEventJson { return e.data }
+func (e *testEvent) Ack() error          { e.acks.Add(1); e.done <- true; return nil }
+func (e *testEvent) Nack(requeue bool) error {
+	e.nacks.Add(1)
+	if requeue {
+		panic("consumer must never requeue")
+	}
+	e.done <- false
+	return nil
+}
+
+type testSource struct {
+	drainOnStop bool
+	messages    []ZitiEventMsg
+	stop        chan struct{}
+	join        chan struct{}
+	once        sync.Once
+}
+
+func (*testSource) Type() string                   { return "test" }
+func (*testSource) ToMap() (map[string]any, error) { return nil, nil }
+func (s *testSource) Start(events chan ZitiEventMsg) (chan struct{}, error) {
+	s.stop, s.join = make(chan struct{}), make(chan struct{})
+	go func() {
+		defer close(s.join)
+		if s.drainOnStop {
+			<-s.stop
+			for _, event := range s.messages {
+				events <- event
+			}
+			return
+		}
+		for _, event := range s.messages {
+			select {
+			case events <- event:
+			case <-s.stop:
+				return
+			}
+		}
+		<-s.stop
+	}()
+	return s.join, nil
+}
+func (s *testSource) Stop() { s.once.Do(func() { close(s.stop) }); <-s.join }
+
+type sinkFunc func(*Usage) error
+
+func (f sinkFunc) Handle(u *Usage) error { return f(u) }
+
+func startTestAgent(t *testing.T, cfg AgentConfig, events []ZitiEventMsg, sinks ...UsageSink) *Agent {
+	t.Helper()
+	cfg.Source = &testSource{messages: events}
+	str, err := store.Open(&store.Config{Type: "sqlite3", Path: ":memory:"})
+	require.NoError(t, err)
+	t.Cleanup(func() { _ = str.Close() })
+	a, err := NewAgent(&cfg, str, &InfluxConfig{Url: "http://127.0.0.1:1"})
+	require.NoError(t, err)
+	a.durable.(*influxWriter).idb.Close()
+	a.durable = sinks[0]
+	for _, sink := range sinks[1:] {
+		a.AddUsageSink(sink)
+	}
+	require.NoError(t, a.Start())
+	t.Cleanup(a.Stop)
+	return a
+}
+
+func awaitEvent(t *testing.T, e *testEvent) bool {
+	t.Helper()
+	select {
+	case ack := <-e.done:
+		return ack
+	case <-time.After(2 * time.Second):
+		t.Fatal("delivery was not settled")
+		return false
+	}
+}
+
+func TestIngestFailureNacksImmediately(t *testing.T) {
+	e := &testEvent{data: "not-json", done: make(chan bool, 2)}
+	var calls atomic.Int32
+	startTestAgent(t, AgentConfig{}, []ZitiEventMsg{e}, sinkFunc(func(*Usage) error { calls.Add(1); return nil }))
+	require.False(t, awaitEvent(t, e))
+	require.EqualValues(t, 1, e.nacks.Load())
+	require.Zero(t, e.acks.Load())
+	require.Zero(t, calls.Load())
+}
+
+func TestSinkRetriesThenNacks(t *testing.T) {
+	e := &testEvent{data: validUsage, done: make(chan bool, 2)}
+	var calls, downstream atomic.Int32
+	started := time.Now()
+	startTestAgent(t, AgentConfig{RetryAttempts: 3, RetryInitialBackoff: 5 * time.Millisecond, RetryMaxBackoff: 10 * time.Millisecond, RetryBudget: time.Second}, []ZitiEventMsg{e},
+		sinkFunc(func(*Usage) error { calls.Add(1); return errors.New("offline") }),
+		sinkFunc(func(*Usage) error { downstream.Add(1); return nil }))
+	require.False(t, awaitEvent(t, e))
+	require.EqualValues(t, 3, calls.Load())
+	require.Zero(t, downstream.Load())
+	require.EqualValues(t, 1, e.nacks.Load())
+	require.Zero(t, e.acks.Load())
+	require.GreaterOrEqual(t, time.Since(started), 15*time.Millisecond)
+	require.Less(t, time.Since(started), time.Second)
+}
+
+func TestSinkRecoversWithinBudget(t *testing.T) {
+	e := &testEvent{data: validUsage, done: make(chan bool, 2)}
+	var calls, downstream atomic.Int32
+	startTestAgent(t, AgentConfig{RetryInitialBackoff: time.Millisecond}, []ZitiEventMsg{e},
+		sinkFunc(func(*Usage) error {
+			if calls.Add(1) <= 2 {
+				return errors.New("temporarily offline")
+			}
+			return nil
+		}),
+		sinkFunc(func(*Usage) error { downstream.Add(1); return nil }))
+	require.True(t, awaitEvent(t, e))
+	require.EqualValues(t, 3, calls.Load())
+	require.EqualValues(t, 1, downstream.Load())
+	require.EqualValues(t, 1, e.acks.Load())
+	require.Zero(t, e.nacks.Load())
+}
+
+func TestRetryBudgetBoundsBackoff(t *testing.T) {
+	e := &testEvent{data: validUsage, done: make(chan bool, 2)}
+	var calls atomic.Int32
+	started := time.Now()
+	startTestAgent(t, AgentConfig{RetryAttempts: 100, RetryBudget: 30 * time.Millisecond, RetryInitialBackoff: time.Second}, []ZitiEventMsg{e},
+		sinkFunc(func(*Usage) error { calls.Add(1); return errors.New("offline") }))
+	require.False(t, awaitEvent(t, e))
+	require.EqualValues(t, 1, calls.Load())
+	require.Less(t, time.Since(started), 500*time.Millisecond)
+}
+
+func TestStopInt
```

**File**: `controller/metrics/amqpSource.go` (modified, +87/-27)
```diff
@@ -1,6 +1,8 @@
 package metrics
 
 import (
+	"context"
+	"net"
 	"time"
 
 	"github.com/michaelquigley/df/dd"
@@ -14,6 +16,7 @@ const AmqpSourceType = "amqpSource"
 type AmqpSourceConfig struct {
 	Url       string `dd:"+secret"`
 	QueueName string
+	Prefetch  int
 }
 
 func LoadAmqpSource(v map[string]any) (dd.Dynamic, error) {
@@ -25,22 +28,34 @@ func LoadAmqpSource(v map[string]any) (dd.Dynamic, error) {
 }
 
 type amqpSource struct {
-	cfg    *AmqpSourceConfig
-	conn   *amqp.Connection
-	ch     *amqp.Channel
-	queue  amqp.Queue
-	msgs   <-chan amqp.Delivery
-	errs   chan *amqp.Error
-	events chan ZitiEventMsg
-	close  chan struct{}
-	join   chan struct{}
+	cfg           *AmqpSourceConfig
+	conn          *amqp.Connection
+	ch            *amqp.Channel
+	queue         amqp.Queue
+	msgs          <-chan amqp.Delivery
+	errs          chan *amqp.Error
+	events        chan ZitiEventMsg
+	ctx           context.Context
+	cancel        context.CancelFunc
+	transport     net.Conn
+	stopTransport func() bool
+	join          chan struct{}
 }
 
 func newAmqpSource(cfg *AmqpSourceConfig) (*amqpSource, error) {
+	if cfg.Prefetch < 0 {
+		return nil, errors.New("prefetch must be positive")
+	}
+	config := *cfg
+	if config.Prefetch == 0 {
+		config.Prefetch = 64
+	}
+	ctx, cancel := context.WithCancel(context.Background())
 	as := &amqpSource{
-		cfg:   cfg,
-		close: make(chan struct{}),
-		join:  make(chan struct{}),
+		cfg:    &config,
+		ctx:    ctx,
+		cancel: cancel,
+		join:   make(chan struct{}),
 	}
 	return as, nil
 }
@@ -55,24 +70,29 @@ func (s *amqpSource) Start(events chan ZitiEventMsg) (join chan struct{}, err er
 }
 
 func (s *amqpSource) Stop() {
-	close(s.close)
+	s.cancel()
 	<-s.join
 }
 
 func (s *amqpSource) run() {
 	dl.Info("started")
-	defer dl.Info("stopped")
 	defer close(s.join)
+	defer dl.Info("stopped")
+	defer s.disconnect()
 
 mainLoop:
 	for {
+		if s.ctx.Err() != nil {
+			break mainLoop
+		}
+		s.disconnect()
 		dl.Infof("connecting to '%v'", s.cfg.Url)
 		if err := s.connect(); err != nil {
 			dl.Errorf("error connecting to '%v': %v", s.cfg.Url, err)
 			select {
 			case <-time.After(10 * time.Second):
 				continue mainLoop
-			case <-s.close:
+			case <-s.ctx.Done():
 				break mainLoop
 			}
 		}
@@ -87,33 +107,55 @@ mainLoop:
 					break msgLoop
 				}
 
-			case <-s.close:
+			case <-s.ctx.Done():
 				break mainLoop
 
 			case event, ok := <-s.msgs:
 				if !ok {
 					dl.Debug("selecting on msg !ok")
 					break msgLoop
 				}
-				if event.Body != nil {
-					s.events <- &ZitiEventAMQP{
-						data: ZitiEventJson(event.Body),
-						msg:  event,
-					}
-				} else {
-					dl.Debug("event body was nil!")
-					break msgLoop
+				select {
+				case s.events <- &ZitiEventAMQP{
+					data: ZitiEventJson(event.Body),
+					msg:  event,
+				}:
+				case <-s.ctx.Done():
+					// leave the delivery unsettled for the broker to requeue on connection close.
+					break mainLoop
 				}
 			}
 		}
 	}
 }
 
-func (s *amqpSource) connect() error {
-	conn, err := amqp.Dial(s.cfg.Url)
+func (s *amqpSource) connect() (err error) {
+	ready := false
+	defer func() {
+		if !ready {
+			s.disconnect()
+		}
+	}()
+	conn, err := amqp.DialConfig(s.cfg.Url, amqp.Config{Dial: func(network, addr string) (net.Conn, error) {
+		dialer := net.Dialer{Timeout: 10 * time.Second}
+		raw, err := dialer.DialContext(s.ctx, network, addr)
+		if err != nil {
+			return nil, err
+		}
+		s.transport = raw
+		s.stopTransport = context.AfterFunc(s.ctx, func() { _ = raw.Close() })
+		if err := raw.SetDeadline(time.Now().Add(10 * time.Second)); err != nil {
+			return nil, err
+		}
+		return raw, nil
+	}})
 	if err != nil {
 		return errors.Wrap(err, "error dialing amqp broker")
 	}
+	// the AMQP handshake clears its deadline; bound queue and consumer setup too.
+	if err := s.transport.SetDeadline(time.Now().Add(10 * time.Second)); err != nil {
+		return err
+	}
 
 	ch, err := conn.Channel()
 	if err != nil {
@@ -124,18 +166,36 @@ func (s *amqpSource) connect() error {
 	if err != nil {
 		return errors.Wrap(err, "error declaring queue")
 	}
+	if err := ch.Qos(s.cfg.Prefetch, 0, false); err != nil {
+		return errors.Wrap(err, "error setting prefetch")
+	}
 
 	msgs, err := ch.Consume(s.cfg.QueueName, "zrok", false, false, false, false, nil)
 	if err != nil {
 		return errors.Wrap(err, "error consuming")
 	}
 
-	s.errs = make(chan *amqp.Error)
+	if err := s.transport.SetDeadline(time.Time{}); err != nil {
+		return err
+	}
+	s.errs = make(chan *amqp.Error, 1)
 	conn.NotifyClose(s.errs)
 	s.conn = conn
 	s.ch = ch
 	s.queue = queue
 	s.msgs = msgs
+	ready = true
 
 	return nil
 }
+
+func (s *amqpSource) disconnect() {
+	if s.stopTransport != nil {
+		s.stopTransport()
+		s.stopTransport = nil
+	}
+	if s.transport != nil {
+		_ = s.transport.Close()
+		s.transport = nil
+	}
+}
```

**File**: `controller/metrics/amqpSource_test.go` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+package metrics
+
+import (
+	"net"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+)
+
+func TestAmqpSourcePrefetchDefaults(t *testing.T) {
+	for _, value := range []int{0, 7} {
+		s, err := newAmqpSource(&AmqpSourceConfig{Prefetch: value})
+		require.NoError(t, err)
+		if value == 0 {
+			require.Equal(t, 64, s.cfg.Prefetch)
+		} else {
+			require.Equal(t, value, s.cfg.Prefetch)
+		}
+		s.cancel()
+	}
+	_, err := newAmqpSource(&AmqpSourceConfig{Prefetch: -1})
+	require.Error(t, err)
+}
+
+func TestAmqpSourceStopDuringHandshake(t *testing.T) {
+	listener, err := net.Listen("tcp", "127.0.0.1:0")
+	require.NoError(t, err)
+	defer listener.Close()
+	accepted := make(chan net.Conn, 1)
+	go func() {
+		conn, err := listener.Accept()
+		if err == nil {
+			accepted <- conn
+		}
+	}()
+	s, err := newAmqpSource(&AmqpSourceConfig{Url: "amqp://guest:guest@" + listener.Addr().String(), QueueName: "events"})
+	require.NoError(t, err)
+	_, err = s.Start(make(chan ZitiEventMsg))
+	require.NoError(t, err)
+	t.Cleanup(s.Stop)
+	select {
+	case conn := <-accepted:
+		defer conn.Close()
+	case <-time.After(time.Second):
+		t.Fatal("source did not connect")
+	}
+	done := make(chan struct{})
+	go func() { s.Stop(); close(done) }()
+	select {
+	case <-done:
+	case <-time.After(500 * time.Millisecond):
+		t.Fatal("source did not cancel handshake")
+	}
+}
```

---

### Incident Patch 11: `40c53c68` (2026-09-25)
**Commit Message**: limits relax fix: per-account isolation, journal retained on incomplete relax, idempotent dial policies, nil frontend selection guard; mock ziti controller for testing

**File**: `CHANGELOG.md` (modified, +3/-2)
```diff
@@ -2,6 +2,8 @@
 
 ## Unreleased
 
+FIX: The controller now keeps a bandwidth-limit journal entry when any share cannot be relaxed, and retries safely on the next cycle without recreating dial policies that already exist. A public share without a frontend selection no longer crashes the controller; its account remains limited while other accounts continue through the cycle.
+
 CHANGE: The `Makefile` now follows the shared convention: `make` builds (frontends first, then `go install ./...` for the whole module), `make test` is the full repository gate (frontend builds and lints, `go test`, `go vet`), and `make clean` resets the project-owned `GOBIN` and the frontend build products. The `ui` and `agent/agentUi` lint scripts are part of the gate, and the handful of lint errors they reported (wrapper object types, an unnecessary regex escape, unused variables) are fixed.
 
 ## v2.0.4
@@ -332,8 +334,7 @@ CHANGE: Add usage hint in `zrok config get --help` to clarify how to list all va
 
 CHANGE: The Python SDK's `Overview()` function was refactored as a class method (https://github.com/openziti/zrok/pull/846).
 
-FEATURE: The Python SDK now includes a `ProxyShare` class providing an HTTP proxy for public and private shares and a
-Jupyter notebook example (https://github.com/openziti/zrok/pull/847).
+FEATURE: The Python SDK now includes a `ProxyShare` class providing an HTTP proxy for public and private shares and a Jupyter notebook example (https://github.com/openziti/zrok/pull/847).
 
 FIX: PyPi publishing was failing due to a CI issue (https://github.com/openziti/zrok/issues/849)
 
```

**File**: `controller/automation/fakeEdge.go` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+package automation
+
+import "github.com/openziti/edge-api/rest_management_api_client"
+
+func NewZitiAutomationWithEdge(edge *rest_management_api_client.ZitiEdgeManagement) *ZitiAutomation {
+	ziti := &ZitiAutomation{edge: edge}
+	ziti.Identities = NewIdentityManager(ziti)
+	ziti.Services = NewServiceManager(ziti)
+	ziti.Configs = NewConfigManager(ziti)
+	ziti.ConfigTypes = NewConfigTypeManager(ziti)
+	ziti.EdgeRouterPolicies = NewEdgeRouterPolicyManager(ziti)
+	ziti.ServiceEdgeRouterPolicies = NewServiceEdgeRouterPolicyManager(ziti)
+	ziti.ServicePolicies = NewServicePolicyManager(ziti)
+	return ziti
+}
```

**File**: `controller/automation/zitifake/fake.go` (added, +250/-0)
```diff
@@ -0,0 +1,250 @@
+package zitifake
+
+import (
+	"encoding/json"
+	"fmt"
+	"net/http"
+	"net/http/httptest"
+	"sort"
+	"strings"
+	"sync"
+	"time"
+
+	"github.com/go-openapi/strfmt"
+	"github.com/openziti/edge-api/rest_management_api_client"
+	"github.com/openziti/edge-api/rest_model"
+)
+
+// Server implements the edge-management resources used by controller tests.
+type Server struct {
+	*httptest.Server
+	mu                             sync.Mutex
+	policies                       map[string]*rest_model.ServicePolicyDetail
+	services                       map[string]*rest_model.ServiceDetail
+	nextID                         int
+	PolicyCreates, PolicyDeletes   int
+	ServiceCreates, ServiceDeletes int
+}
+
+func New() *Server {
+	f := &Server{policies: make(map[string]*rest_model.ServicePolicyDetail), services: make(map[string]*rest_model.ServiceDetail)}
+	f.Server = httptest.NewServer(http.HandlerFunc(f.serve))
+	return f
+}
+
+func (f *Server) Edge() *rest_management_api_client.ZitiEdgeManagement {
+	host := strings.TrimPrefix(f.URL, "http://")
+	return rest_management_api_client.NewHTTPClientWithConfig(nil, &rest_management_api_client.TransportConfig{
+		Host: host, BasePath: "/edge/management/v1", Schemes: []string{"http"},
+	})
+}
+
+func (f *Server) Counts() (policyCreates, policyDeletes, serviceCreates, serviceDeletes int) {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	return f.PolicyCreates, f.PolicyDeletes, f.ServiceCreates, f.ServiceDeletes
+}
+
+func (f *Server) serve(w http.ResponseWriter, r *http.Request) {
+	f.mu.Lock()
+	defer f.mu.Unlock()
+	w.Header().Set("Content-Type", "application/json")
+	path := strings.TrimPrefix(r.URL.Path, "/edge/management/v1/")
+	parts := strings.Split(path, "/")
+	if len(parts) < 1 || (parts[0] != "service-policies" && parts[0] != "services") {
+		writeError(w, 404, "route not found")
+		return
+	}
+	policy := parts[0] == "service-policies"
+	if len(parts) == 1 {
+		switch r.Method {
+		case http.MethodGet:
+			f.list(w, r, policy)
+		case http.MethodPost:
+			f.create(w, r, policy)
+		default:
+			writeError(w, 405, "method not allowed")
+		}
+		return
+	}
+	if len(parts) != 2 {
+		writeError(w, 404, "route not found")
+		return
+	}
+	id := parts[1]
+	switch r.Method {
+	case http.MethodGet:
+		f.detail(w, policy, id)
+	case http.MethodDelete:
+		f.delete(w, policy, id)
+	default:
+		writeError(w, 405, "method not allowed")
+	}
+}
+
+func writeJSON(w http.ResponseWriter, status int, value interface{}) {
+	w.WriteHeader(status)
+	_ = json.NewEncoder(w).Encode(value)
+}
+
+func writeError(w http.ResponseWriter, status int, message string) {
+	writeJSON(w, status, &rest_model.APIErrorEnvelope{Error: &rest_model.APIError{Code: http.StatusText(status), Message: message}, Meta: &rest_model.Meta{}})
+}
+
+func base(id string, tags *rest_model.Tags) rest_model.BaseEntity {
+	now := strfmt.DateTime(time.Now())
+	return rest_model.BaseEntity{ID: &id, Tags: tags, CreatedAt: &now, UpdatedAt: &now, Links: rest_model.Links{}}
+}
+
+func (f *Server) create(w http.ResponseWriter, r *http.Request, policy bool) {
+	var name string
+	var tags *rest_model.Tags
+	if policy {
+		var input rest_model.ServicePolicyCreate
+		if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Name == nil {
+			writeError(w, 400, "invalid service policy")
+			return
+		}
+		name, tags = *input.Name, input.Tags
+		for _, existing := range f.policies {
+			if *existing.Name == name {
+				writeError(w, 400, "service policy name conflict: "+name)
+				return
+			}
+		}
+		f.nextID++
+		id := fmt.Sprintf("policy-%d", f.nextID)
+		f.policies[id] = &rest_model.ServicePolicyDetail{BaseEntity: base(id, tags), Name: &name, IdentityRoles: input.IdentityRoles, IdentityRolesDisplay: rest_model.NamedRoles{}, PostureCheckRoles: input.PostureCheckRoles, PostureCheckRolesDisplay: rest_model.NamedRoles{}, ServiceRoles: input.ServiceRoles, ServiceRolesDisplay: rest_model.NamedRoles{}, Semantic: input.Semantic, Type: input.Type}
+		f.PolicyCreates++
+		writeJSON(w, 201, &rest_model.CreateEnvelope{Data: &rest_model.CreateLocation{ID: id}, Meta: &rest_model.Meta{}})
+		return
+	}
+	var input rest_model.ServiceCreate
+	if err := json.NewDecoder(r.Body).Decode(&input); err != nil || input.Name == nil {
+		writeError(w, 400, "invalid service")
+		return
+	}
+	name, tags = *input.Name, input.Tags
+	for _, existing := range f.services {
+		if *existing.Name == name {
+			writeError(w, 400, "service name conflict: "+name)
+			return
+		}
+	}
+	f.nextID++
+	id := fmt.Sprintf("service-%d", f.nextID)
+	maxIdle := input.MaxIdleTimeMillis
+	strategy := input.TerminatorStrategy
+	roles := rest_model.Attributes(input.RoleAttributes)
+	f.services[id] = &rest_model.ServiceDetail{BaseEntity: base(id, tags), Name: &name, Config: map[string]map[string]interface{}{}, Configs: input.Configs, EncryptionRequired: input.EncryptionRequired, MaxIdleTimeMillis: &maxIdle, Permissions: rest_model.DialBindArray{}, PostureQueries: []*rest_mod
```

**File**: `controller/automation/zitifake/fake_test.go` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+package zitifake
+
+import (
+	"errors"
+	"testing"
+
+	"github.com/openziti/edge-api/rest_management_api_client/service_policy"
+	"github.com/openziti/edge-api/rest_model"
+	"github.com/openziti/zrok/v2/controller/automation"
+	"github.com/stretchr/testify/require"
+)
+
+func TestFilterAndUniqueNames(t *testing.T) {
+	fake := New()
+	defer fake.Close()
+	ziti := automation.NewZitiAutomationWithEdge(fake.Edge())
+	opts := &automation.ServicePolicyOptions{
+		BaseOptions:   automation.BaseOptions{Name: "one", Tags: automation.ZrokShareTags("share-one")},
+		IdentityRoles: []string{"@identity"}, ServiceRoles: []string{"@service"}, Semantic: rest_model.SemanticAllOf,
+	}
+	id, err := ziti.ServicePolicies.CreateDial(opts)
+	require.NoError(t, err)
+	for _, filter := range []string{`name="one"`, `id="` + id + `"`, `tags.zrokShareToken="share-one" and type=1`, `tags.zrok != null`} {
+		items, err := ziti.ServicePolicies.Find(&automation.FilterOptions{Filter: filter})
+		require.NoError(t, err, filter)
+		require.Len(t, items, 1, filter)
+	}
+	items, err := ziti.ServicePolicies.Find(&automation.FilterOptions{Filter: `tags.zrokShareToken="share-two" and type=2`})
+	require.NoError(t, err)
+	require.Empty(t, items)
+	_, err = ziti.ServicePolicies.CreateDial(opts)
+	var conflict *service_policy.CreateServicePolicyBadRequest
+	require.True(t, errors.As(err, &conflict), "%v", err)
+	require.Contains(t, conflict.Payload.Error.Message, "conflict")
+	created, _, _, _ := fake.Counts()
+	require.Equal(t, 1, created)
+	detail, err := ziti.Edge().ServicePolicy.DetailServicePolicy(&service_policy.DetailServicePolicyParams{ID: id}, nil)
+	require.NoError(t, err)
+	require.Equal(t, "one", *detail.Payload.Data.Name)
+	require.NoError(t, ziti.ServicePolicies.Delete(id))
+	_, err = ziti.Edge().ServicePolicy.DetailServicePolicy(&service_policy.DetailServicePolicyParams{ID: id}, nil)
+	var notFound *service_policy.DetailServicePolicyNotFound
+	require.True(t, errors.As(err, &notFound), "%v", err)
+}
+
+func TestServiceRoutes(t *testing.T) {
+	fake := New()
+	defer fake.Close()
+	ziti := automation.NewZitiAutomationWithEdge(fake.Edge())
+	id, err := ziti.Services.Create(&automation.ServiceOptions{BaseOptions: automation.BaseOptions{Name: "service-one", Tags: automation.ZrokShareTags("share-one")}})
+	require.NoError(t, err)
+	items, err := ziti.Services.Find(&automation.FilterOptions{Filter: `tags.zrokShareToken="share-one"`})
+	require.NoError(t, err)
+	require.Len(t, items, 1)
+	require.Equal(t, id, *items[0].ID)
+	_, err = ziti.Services.Create(&automation.ServiceOptions{BaseOptions: automation.BaseOptions{Name: "service-one"}})
+	require.Error(t, err)
+	require.NoError(t, ziti.Services.Delete(id))
+	_, _, creates, deletes := fake.Counts()
+	require.Equal(t, 1, creates)
+	require.Equal(t, 1, deletes)
+}
```

**File**: `controller/limits/agent.go` (modified, +115/-57)
```diff
@@ -1,6 +1,7 @@
 package limits
 
 import (
+	"fmt"
 	"reflect"
 	"time"
 
@@ -17,8 +18,9 @@ import (
 
 type Agent struct {
 	cfg            *Config
-	ifx            *influxReader
+	ifx            bandwidthReader
 	zCfg           *automation.Config
+	newZiti        func() (*automation.ZitiAutomation, error)
 	str            *store.Store
 	queue          chan *metrics.Usage
 	warningActions []AccountAction
@@ -28,22 +30,36 @@ type Agent struct {
 	join           chan struct{}
 }
 
+type bandwidthReader interface {
+	totalRxTxForAccount(int64, time.Duration) (int64, int64, error)
+	totalRxTxForEnvironment(int64, time.Duration) (int64, int64, error)
+	totalRxTxForShare(string, time.Duration) (int64, int64, error)
+}
+
 func NewAgent(cfg *Config, ifxCfg *metrics.InfluxConfig, zCfg *automation.Config, emailCfg *emailUi.Config, str *store.Store) (*Agent, error) {
+	newZiti := func() (*automation.ZitiAutomation, error) { return automation.NewZitiAutomation(zCfg) }
 	a := &Agent{
 		cfg:            cfg,
 		ifx:            newInfluxReader(ifxCfg),
 		zCfg:           zCfg,
+		newZiti:        newZiti,
 		str:            str,
 		queue:          make(chan *metrics.Usage, 1024),
 		warningActions: []AccountAction{newWarningAction(emailCfg, str)},
-		limitActions:   []AccountAction{newLimitAction(str, zCfg)},
-		relaxActions:   []AccountAction{newRelaxAction(str, zCfg)},
+		limitActions:   []AccountAction{newLimitAction(str, newZiti)},
+		relaxActions:   []AccountAction{newRelaxAction(str, newZiti)},
 		close:          make(chan struct{}),
 		join:           make(chan struct{}),
 	}
 	return a, nil
 }
 
+func (a *Agent) setZitiFactory(factory func() (*automation.ZitiAutomation, error)) {
+	a.newZiti = factory
+	a.limitActions = []AccountAction{newLimitAction(a.str, factory)}
+	a.relaxActions = []AccountAction{newRelaxAction(a.str, factory)}
+}
+
 func (a *Agent) Start() {
 	go a.run()
 }
@@ -251,7 +267,7 @@ mainLoop:
 		select {
 		case usage := <-a.queue:
 			if usage.ShareToken != "" {
-				if err := a.enforce(usage); err != nil {
+				if err := a.enforceSafely(usage); err != nil {
 					dl.Errorf("error running enforcement: %v", err)
 				}
 				if time.Since(lastCycle) > a.cfg.Cycle {
@@ -277,6 +293,15 @@ mainLoop:
 	}
 }
 
+func (a *Agent) enforceSafely(usage *metrics.Usage) (err error) {
+	defer func() {
+		if recovered := recover(); recovered != nil {
+			err = errors.Errorf("panic enforcing usage for account '#%d': %v", usage.AccountId, recovered)
+		}
+	}()
+	return a.enforce(usage)
+}
+
 func (a *Agent) enforce(u *metrics.Usage) error {
 	trx, err := a.str.Begin()
 	if err != nil {
@@ -373,76 +398,85 @@ func (a *Agent) relax() error {
 		accountPeriods := make(map[int]map[int]*periodBwValues)
 
 		for _, bwje := range bwjes {
-			if _, found := accounts[bwje.AccountId]; !found {
-				if acct, err := a.str.GetAccount(bwje.AccountId, trx); err == nil {
-					accounts[bwje.AccountId] = acct
-					ul, err := a.getUserLimits(acct.Id, trx)
-					if err != nil {
-						return errors.Wrapf(err, "error getting user limits for '%v'", acct.Email)
+			entryErr := func() (entryErr error) {
+				defer func() {
+					if recovered := recover(); recovered != nil {
+						account := fmt.Sprintf("#%d", bwje.AccountId)
+						if acct := accounts[bwje.AccountId]; acct != nil {
+							account = acct.Email
+						}
+						dl.Errorf("panic relaxing account '%v' (journal retained): %v", account, recovered)
+						entryErr = nil
+					}
+				}()
+				if _, found := accounts[bwje.AccountId]; !found {
+					if acct, err := a.str.GetAccount(bwje.AccountId, trx); err == nil {
+						accounts[bwje.AccountId] = acct
+						ul, err := a.getUserLimits(acct.Id, trx)
+						if err != nil {
+							return errors.Wrapf(err, "error getting user limits for '%v'", acct.Email)
+						}
+						uls[bwje.AccountId] = ul
+						accountPeriods[bwje.AccountId] = make(map[int]*periodBwValues)
+					} else {
+						return err
 					}
-					uls[bwje.AccountId] = ul
-					accountPeriods[bwje.AccountId] = make(map[int]*periodBwValues)
-				} else {
-					return err
 				}
-			}
 
-			var bwc store.BandwidthClass
-			if bwje.LimitClassId == nil {
-				globalBwcs := newConfigBandwidthClasses(a.cfg.Bandwidth)
-				if bwje.Action == store.WarningLimitAction {
-					bwc = globalBwcs[0]
+				var bwc store.BandwidthClass
+				if bwje.LimitClassId == nil {
+					globalBwcs := newConfigBandwidthClasses(a.cfg.Bandwidth)
+					if bwje.Action == store.WarningLimitAction {
+						bwc = globalBwcs[0]
+					} else {
+						bwc = globalBwcs[1]
+					}
 				} else {
-					bwc = globalBwcs[1]
-				}
-			} else {
-				lc, err := a.str.GetLimitClass(*bwje.LimitClassId, trx)
-				if err != nil {
-					return err
-				}
-				bwc = lc
-			}
-
-			if periods, accountFound := accountPeriods[bwje.AccountId]; accountFound {
-				if _, periodFound := periods[bwc.GetPeriodMinutes()]; !periodFound {
-					rx, tx, err := a.ifx.totalRxTxForAccount(int64(bwje.AccountId), time.Duration(bwc.GetPe
```

**File**: `controller/limits/limitAction.go` (modified, +5/-5)
```diff
@@ -12,12 +12,12 @@ import (
 )
 
 type limitAction struct {
-	str  *store.Store
-	zCfg *automation.Config
+	str     *store.Store
+	newZiti func() (*automation.ZitiAutomation, error)
 }
 
-func newLimitAction(str *store.Store, zCfg *automation.Config) *limitAction {
-	return &limitAction{str, zCfg}
+func newLimitAction(str *store.Store, newZiti func() (*automation.ZitiAutomation, error)) *limitAction {
+	return &limitAction{str, newZiti}
 }
 
 func (a *limitAction) HandleAccount(acct *store.Account, _, _ int64, bwc store.BandwidthClass, ul *userLimits, trx *sqlx.Tx) error {
@@ -26,7 +26,7 @@ func (a *limitAction) HandleAccount(acct *store.Account, _, _ int64, bwc store.B
 		return errors.Wrapf(err, "error finding environments for account '%v'", acct.Email)
 	}
 
-	ziti, err := automation.NewZitiAutomation(a.zCfg)
+	ziti, err := a.newZiti()
 	if err != nil {
 		return err
 	}
```

**File**: `controller/limits/limitAction_simple_test.go` (modified, +6/-5)
```diff
@@ -11,23 +11,24 @@ import (
 func TestNewLimitActionSimple(t *testing.T) {
 	str := &store.Store{}
 	zCfg := &automation.Config{}
+	factory := func() (*automation.ZitiAutomation, error) { return automation.NewZitiAutomation(zCfg) }
 
-	action := newLimitAction(str, zCfg)
+	action := newLimitAction(str, factory)
 
 	assert.NotNil(t, action)
 	assert.Equal(t, str, action.str)
-	assert.Equal(t, zCfg, action.zCfg)
+	assert.NotNil(t, action.newZiti)
 }
 
 func TestLimitAction_InterfaceCompliance(t *testing.T) {
 	str := &store.Store{}
-	zCfg := &automation.Config{}
+	factory := func() (*automation.ZitiAutomation, error) { return nil, nil }
 
-	action := newLimitAction(str, zCfg)
+	action := newLimitAction(str, factory)
 
 	// verify it implements the AccountAction interface
 	var _ AccountAction = action
 
 	// The interface is correctly implemented - no need to test the actual method call
 	// which would require database setup
-}
\ No newline at end of file
+}
```

**File**: `controller/limits/relaxAction.go` (modified, +57/-17)
```diff
@@ -1,58 +1,66 @@
 package limits
 
 import (
+	"fmt"
 	"github.com/jmoiron/sqlx"
 	"github.com/michaelquigley/df/dl"
 	"github.com/openziti/edge-api/rest_model"
 	"github.com/openziti/zrok/v2/controller/automation"
 	"github.com/openziti/zrok/v2/controller/store"
 	"github.com/openziti/zrok/v2/sdk/golang/sdk"
 	"github.com/pkg/errors"
+	"strings"
 )
 
 type relaxAction struct {
-	str  *store.Store
-	zCfg *automation.Config
+	str     *store.Store
+	newZiti func() (*automation.ZitiAutomation, error)
 }
 
-func newRelaxAction(str *store.Store, zCfg *automation.Config) *relaxAction {
-	return &relaxAction{str, zCfg}
+func newRelaxAction(str *store.Store, newZiti func() (*automation.ZitiAutomation, error)) *relaxAction {
+	return &relaxAction{str, newZiti}
 }
 
+// storeRelaxError distinguishes a failed SQL operation from a retryable Ziti failure.
+type storeRelaxError struct{ error }
+
+func storeFailure(err error) error { return storeRelaxError{err} }
+
 func (a *relaxAction) HandleAccount(acct *store.Account, _, _ int64, bwc store.BandwidthClass, _ *userLimits, trx *sqlx.Tx) error {
 	dl.Debugf("relaxing '%v'", acct.Email)
 
 	envs, err := a.str.FindEnvironmentsForAccount(acct.Id, trx)
 	if err != nil {
-		return errors.Wrapf(err, "error finding environments for account '%v'", acct.Email)
+		return storeFailure(errors.Wrapf(err, "error finding environments for account '%v'", acct.Email))
 	}
 
 	jes, err := a.str.FindAllLatestBandwidthLimitJournalForAccount(acct.Id, trx)
 	if err != nil {
-		return errors.Wrapf(err, "error finding latest bandwidth limit journal entries for account '%v'", acct.Email)
+		return storeFailure(errors.Wrapf(err, "error finding latest bandwidth limit journal entries for account '%v'", acct.Email))
 	}
 	limitedBackends := make(map[sdk.BackendMode]bool)
 	for _, je := range jes {
 		if je.LimitClassId != nil {
 			lc, err := a.str.GetLimitClass(*je.LimitClassId, trx)
 			if err != nil {
-				return err
+				return storeFailure(err)
 			}
 			if lc.BackendMode != nil && lc.LimitAction == store.LimitLimitAction {
 				limitedBackends[*lc.BackendMode] = true
 			}
 		}
 	}
 
-	ziti, err := automation.NewZitiAutomation(a.zCfg)
+	ziti, err := a.newZiti()
 	if err != nil {
 		return err
 	}
 
+	var failures []string
 	for _, env := range envs {
 		shrs, err := a.str.FindSharesForEnvironment(env.Id, trx)
 		if err != nil {
-			return errors.Wrapf(err, "error finding shares for environment '%v'", env.ZId)
+			return storeFailure(errors.Wrapf(err, "error finding shares for environment '%v'", env.ZId))
 		}
 
 		for _, shr := range shrs {
@@ -61,34 +69,57 @@ func (a *relaxAction) HandleAccount(acct *store.Account, _, _ int64, bwc store.B
 				switch shr.ShareMode {
 				case string(sdk.PublicShareMode):
 					if err := relaxPublicShare(a.str, ziti, shr, trx); err != nil {
-						dl.Errorf("error relaxing public share '%v' for account '%v' (ignoring): %v", shr.Token, acct.Email, err)
+						var storeErr storeRelaxError
+						if errors.As(err, &storeErr) {
+							return err
+						}
+						failures = append(failures, fmt.Sprintf("share '%v': %v", shr.Token, err))
 					}
 				case string(sdk.PrivateShareMode):
 					if err := relaxPrivateShare(a.str, ziti, shr, trx); err != nil {
-						dl.Errorf("error relaxing private share '%v' for account '%v' (ignoring): %v", shr.Token, acct.Email, err)
+						var storeErr storeRelaxError
+						if errors.As(err, &storeErr) {
+							return err
+						}
+						failures = append(failures, fmt.Sprintf("share '%v': %v", shr.Token, err))
 					}
 				}
 			}
 		}
 	}
 
+	if len(failures) > 0 {
+		return errors.New(strings.Join(failures, "; "))
+	}
 	return nil
 }
 
 func relaxPublicShare(str *store.Store, ziti *automation.ZitiAutomation, shr *store.Share, trx *sqlx.Tx) error {
 	env, err := str.GetEnvironment(shr.EnvironmentId, trx)
 	if err != nil {
-		return errors.Wrap(err, "error finding environment")
+		return storeFailure(errors.Wrap(err, "error finding environment"))
+	}
+	if shr.FrontendSelection == nil {
+		return errors.Errorf("share '%v' has no frontend selection", shr.Token)
 	}
 
 	fe, err := str.FindFrontendPubliclyNamed(*shr.FrontendSelection, trx)
 	if err != nil {
-		return errors.Wrapf(err, "error finding frontend name '%v' for '%v'", *shr.FrontendSelection, shr.Token)
+		return storeFailure(errors.Wrapf(err, "error finding frontend name '%v' for '%v'", *shr.FrontendSelection, shr.Token))
+	}
+	policyName := env.ZId + "-" + shr.ZId + "-dial"
+	policies, err := ziti.ServicePolicies.Find(&automation.FilterOptions{Filter: automation.BuildFilter("name", policyName)})
+	if err != nil {
+		return errors.Wrapf(err, "error finding dial service policy for '%v'", shr.Token)
+	}
+	if len(policies) > 0 {
+		dl.Debugf("dial service policy '%v' already exists", policyName)
+		return nil
 	}
 
 	opts := &automation.ServicePolicyOptions{
 		BaseOptions: automation.BaseOptions{
-			Name: env.ZId + "-" + shr.ZId + "-dial",
+			Name: policyName,
 			Tags: aut
```

---

### Incident Patch 12: `573d7502` (2026-09-24)
**Commit Message**: makefile convention; ui dependency updates

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -1,5 +1,9 @@
 # CHANGELOG
 
+## Unreleased
+
+CHANGE: The `Makefile` now follows the shared convention: `make` builds (frontends first, then `go install ./...` for the whole module), `make test` is the full repository gate (frontend builds and lints, `go test`, `go vet`), and `make clean` resets the project-owned `GOBIN` and the frontend build products. The `ui` and `agent/agentUi` lint scripts are part of the gate, and the handful of lint errors they reported (wrapper object types, an unnecessary regex escape, unused variables) are fixed.
+
 ## v2.0.4
 
 FIX: The agent no longer deletes reserved shares from the controller during graceful shutdown or after an abnormal subordinate process exit. Previously, a `SIGTERM`/`SIGINT` (e.g., on system reboot) caused the agent to issue an unconditional `DeleteShare` against the controller for every active share, destroying the reservation for private shares created with `--share-token` and for public shares with reserved names. The reservation is now preserved unless the user explicitly released the share via `zrok2 agent release`, allowing the agent to reattach on the next start. (https://github.com/openziti/zrok/issues/1251)
```

**File**: `Makefile` (modified, +21/-9)
```diff
@@ -1,18 +1,30 @@
 .DEFAULT_GOAL := build
-TARGETS ?= ./cmd/zrok2
+GOBIN ?= $(shell go env GOPATH)/bin
 
-.PHONY: clean build test
+ifeq ($(filter-out /,$(abspath $(GOBIN))),)
+$(error GOBIN is '$(GOBIN)'; it must name a real directory)
+endif
 
-clean:
-	rm -rf ui/node_modules ui/dist agent/agentUi/node_modules agent/agentUi/dist
+.PHONY: build test clean frontend frontend-test
+
+build: frontend
+	go install ./...
+
+test: frontend-test
+	go test ./... -count=1
+	go vet ./...
 
-build:
+frontend:
 	npm --prefix ui install
 	npm --prefix ui run build
 	npm --prefix agent/agentUi install
 	npm --prefix agent/agentUi run build
-	go install $(TARGETS)
 
-test:
-	go test ./... -count=1
-	go vet ./...
+frontend-test: frontend
+	npm --prefix ui run lint
+	npm --prefix agent/agentUi run lint
+
+clean:
+	go clean ./...
+	rm -f "$(GOBIN)"/*
+	rm -rf ui/node_modules ui/dist agent/agentUi/node_modules agent/agentUi/dist
```

**File**: `agent/agentUi/package-lock.json` (modified, +197/-204)
```diff
@@ -29,61 +29,47 @@
         "vite": "^6.2.0"
       }
     },
-    "node_modules/@ampproject/remapping": {
-      "version": "2.3.0",
-      "resolved": "https://registry.npmjs.org/@ampproject/remapping/-/remapping-2.3.0.tgz",
-      "integrity": "sha512-30iZtAPgz+LTIYoeivqYo853f02jBYSd5uGnGpkFV0M3xOt9aN73erkgYAmZU43x4VfqcnLxW9Kpg3R5LC4YYw==",
-      "dev": true,
-      "license": "Apache-2.0",
-      "dependencies": {
-        "@jridgewell/gen-mapping": "^0.3.5",
-        "@jridgewell/trace-mapping": "^0.3.24"
-      },
-      "engines": {
-        "node": ">=6.0.0"
-      }
-    },
     "node_modules/@babel/code-frame": {
-      "version": "7.26.2",
-      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.26.2.tgz",
-      "integrity": "sha512-RJlIHRueQgwWitWgF8OdFYGZX328Ax5BCemNGlqHfplnRT9ESi8JkFlvaVYbS+UubVY6dpv87Fs2u5M29iNFVQ==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.29.7.tgz",
+      "integrity": "sha512-Aup7aUOfpbAUg2ROOJN6Iw5f9DMBlzu0mIkm/malLQFN/YQgO48wCj0Kxa3sEHJvPVFg7siR+qRInwXd2qhQKw==",
       "license": "MIT",
       "dependencies": {
-        "@babel/helper-validator-identifier": "^7.25.9",
+        "@babel/helper-validator-identifier": "^7.29.7",
         "js-tokens": "^4.0.0",
-        "picocolors": "^1.0.0"
+        "picocolors": "^1.1.1"
       },
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@babel/compat-data": {
-      "version": "7.26.2",
-      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.26.2.tgz",
-      "integrity": "sha512-Z0WgzSEa+aUcdiJuCIqgujCshpMWgUpgOxXotrYPSA53hA3qopNaqcJpyr0hVb1FeWdnqFA35/fUtXgBK8srQg==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.29.7.tgz",
+      "integrity": "sha512-locTkQyKvwIEgBzVrn8693ebc97F2U8ZHjbXwDXJ5Fn2TCpNwTlKcaKLkdHop5c/icOFE7qt7Q9JC5hnKNa6Gg==",
       "dev": true,
       "license": "MIT",
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@babel/core": {
-      "version": "7.26.0",
-      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.26.0.tgz",
-      "integrity": "sha512-i1SLeK+DzNnQ3LL/CswPCa/E5u4lh1k6IAEphON8F+cXt0t9euTshDru0q7/IqMa1PMPz5RnHuHscF8/ZJsStg==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.29.7.tgz",
+      "integrity": "sha512-RgHBCvtjbOK2gXSNBNIkNoEc9qoVEtau3hj8gEqKQuL3HZAibKarWFEI3Lfm6EYKkLalOh8eSrj9b+ch9H/VBA==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@ampproject/remapping": "^2.2.0",
-        "@babel/code-frame": "^7.26.0",
-        "@babel/generator": "^7.26.0",
-        "@babel/helper-compilation-targets": "^7.25.9",
-        "@babel/helper-module-transforms": "^7.26.0",
-        "@babel/helpers": "^7.26.0",
-        "@babel/parser": "^7.26.0",
-        "@babel/template": "^7.25.9",
-        "@babel/traverse": "^7.25.9",
-        "@babel/types": "^7.26.0",
+        "@babel/code-frame": "^7.29.7",
+        "@babel/generator": "^7.29.7",
+        "@babel/helper-compilation-targets": "^7.29.7",
+        "@babel/helper-module-transforms": "^7.29.7",
+        "@babel/helpers": "^7.29.7",
+        "@babel/parser": "^7.29.7",
+        "@babel/template": "^7.29.7",
+        "@babel/traverse": "^7.29.7",
+        "@babel/types": "^7.29.7",
+        "@jridgewell/remapping": "^2.3.5",
         "convert-source-map": "^2.0.0",
         "debug": "^4.1.0",
         "gensync": "^1.0.0-beta.2",
@@ -99,30 +85,30 @@
       }
     },
     "node_modules/@babel/generator": {
-      "version": "7.26.2",
-      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.26.2.tgz",
-      "integrity": "sha512-zevQbhbau95nkoxSq3f/DC/SC+EEOUZd3DYqfSkMhY2/wfSeaHV1Ew4vk8e+x8lja31IbyuUa2uQ3JONqKbysw==",
+      "version": "7.29.8",
+      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.29.8.tgz",
+      "integrity": "sha512-gZbepsdh3WDtgZKWL+vTPh71LSBrm/Y4/QDZBVCcYfmeTEEuoOYwlSy+G1StfJg+/Zy550u/3TATbm7qDbbMtg==",
       "license": "MIT",
       "dependencies": {
-        "@babel/parser": "^7.26.2",
-        "@babel/types": "^7.26.0",
-        "@jridgewell/gen-mapping": "^0.3.5",
-        "@jridgewell/trace-mapping": "^0.3.25",
+        "@babel/parser": "^7.29.8",
+        "@babel/types": "^7.29.8",
+        "@jridgewell/gen-mapping": "^0.3.12",
+        "@jridgewell/trace-mapping": "^0.3.28",
         "jsesc": "^3.0.2"
       },
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@babel/helper-compilation-targets": {
-      "version": "7.25.9",
-      "resolved": "https://registry.npmjs.org/@babel/helper-compilation-targets/-/helper-compilation-targets-7.25.9.tgz",
-      "integrity": "sha512-j9Db8Suy6yV/VHa4qzrj9yZfZxhLWQdVnRlXxmKLYlhWUVB1sB2G5sxuWYXk/whHD9iW76PmNzxZ4UCnTQTVEQ==",
+      "version": "7.29.7",
+      "resolved"
```

**File**: `agent/agentUi/package.json` (modified, +3/-0)
```diff
@@ -29,5 +29,8 @@
     "globals": "^15.11.0",
     "typescript-eslint": "^8.15.0",
     "vite": "^6.2.0"
+  },
+  "allowScripts": {
+    "esbuild@0.25.0": true
   }
 }
```

**File**: `agent/agentUi/src/AgentUi.tsx` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@ import NewShareModal from "./NewShareModal.tsx";
 import NewAccessModal from "./NewAccessModal.tsx";
 
 const AgentUi = () => {
-    const [version, setVersion] = useState("unset");
+    const [, setVersion] = useState("unset");
     const [overview, setOverview] = useState(new Array<AgentObject>());
     const [newShareOpen, setNewShareOpen] = useState(false);
     const [newAccessOpen, setNewAccessOpen] = useState(false);
@@ -41,7 +41,7 @@ const AgentUi = () => {
     }, []);
 
     useEffect(() => {
-        let interval = setInterval(() => {
+        const interval = setInterval(() => {
             GetAgentApi().agentStatus()
                 .then(r => {
                     setOverview(buildOverview(r));
```

**File**: `agent/agentUi/src/NewAccessModal.tsx` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ const NewAccessModal = ({ close, isOpen }: NewAccessModalProps) => {
         onSubmit: v => {
             setErrorMessage(null as React.JSX.Element);
             GetAgentApi().agentAccessPrivate(v)
-                .then(r => {
+                .then(() => {
                     close();
                 })
                 .catch(e => {
```

**File**: `agent/agentUi/src/NewShareModal.tsx` (modified, +2/-2)
```diff
@@ -25,7 +25,7 @@ const NewShareModal = ({ close, isOpen }: NewShareModalProps) => {
             switch(v.shareMode) {
                 case "public":
                     GetAgentApi().agentSharePublic(v)
-                        .then(r => {
+                        .then(() => {
                             close();
                         })
                         .catch(e => {
@@ -38,7 +38,7 @@ const NewShareModal = ({ close, isOpen }: NewShareModalProps) => {
 
                 case "private":
                     GetAgentApi().agentSharePrivate(v)
-                        .then(r => {
+                        .then(() => {
                             close();
                         })
                         .catch(e => {
```

**File**: `ui/package-lock.json` (modified, +206/-213)
```diff
@@ -40,61 +40,47 @@
         "vite": "^6.2.0"
       }
     },
-    "node_modules/@ampproject/remapping": {
-      "version": "2.3.0",
-      "resolved": "https://registry.npmjs.org/@ampproject/remapping/-/remapping-2.3.0.tgz",
-      "integrity": "sha512-30iZtAPgz+LTIYoeivqYo853f02jBYSd5uGnGpkFV0M3xOt9aN73erkgYAmZU43x4VfqcnLxW9Kpg3R5LC4YYw==",
-      "dev": true,
-      "license": "Apache-2.0",
-      "dependencies": {
-        "@jridgewell/gen-mapping": "^0.3.5",
-        "@jridgewell/trace-mapping": "^0.3.24"
-      },
-      "engines": {
-        "node": ">=6.0.0"
-      }
-    },
     "node_modules/@babel/code-frame": {
-      "version": "7.26.2",
-      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.26.2.tgz",
-      "integrity": "sha512-RJlIHRueQgwWitWgF8OdFYGZX328Ax5BCemNGlqHfplnRT9ESi8JkFlvaVYbS+UubVY6dpv87Fs2u5M29iNFVQ==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.29.7.tgz",
+      "integrity": "sha512-Aup7aUOfpbAUg2ROOJN6Iw5f9DMBlzu0mIkm/malLQFN/YQgO48wCj0Kxa3sEHJvPVFg7siR+qRInwXd2qhQKw==",
       "license": "MIT",
       "dependencies": {
-        "@babel/helper-validator-identifier": "^7.25.9",
+        "@babel/helper-validator-identifier": "^7.29.7",
         "js-tokens": "^4.0.0",
-        "picocolors": "^1.0.0"
+        "picocolors": "^1.1.1"
       },
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@babel/compat-data": {
-      "version": "7.26.2",
-      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.26.2.tgz",
-      "integrity": "sha512-Z0WgzSEa+aUcdiJuCIqgujCshpMWgUpgOxXotrYPSA53hA3qopNaqcJpyr0hVb1FeWdnqFA35/fUtXgBK8srQg==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.29.7.tgz",
+      "integrity": "sha512-locTkQyKvwIEgBzVrn8693ebc97F2U8ZHjbXwDXJ5Fn2TCpNwTlKcaKLkdHop5c/icOFE7qt7Q9JC5hnKNa6Gg==",
       "dev": true,
       "license": "MIT",
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@babel/core": {
-      "version": "7.26.0",
-      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.26.0.tgz",
-      "integrity": "sha512-i1SLeK+DzNnQ3LL/CswPCa/E5u4lh1k6IAEphON8F+cXt0t9euTshDru0q7/IqMa1PMPz5RnHuHscF8/ZJsStg==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "@ampproject/remapping": "^2.2.0",
-        "@babel/code-frame": "^7.26.0",
-        "@babel/generator": "^7.26.0",
-        "@babel/helper-compilation-targets": "^7.25.9",
-        "@babel/helper-module-transforms": "^7.26.0",
-        "@babel/helpers": "^7.26.0",
-        "@babel/parser": "^7.26.0",
-        "@babel/template": "^7.25.9",
-        "@babel/traverse": "^7.25.9",
-        "@babel/types": "^7.26.0",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.29.7.tgz",
+      "integrity": "sha512-RgHBCvtjbOK2gXSNBNIkNoEc9qoVEtau3hj8gEqKQuL3HZAibKarWFEI3Lfm6EYKkLalOh8eSrj9b+ch9H/VBA==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "@babel/code-frame": "^7.29.7",
+        "@babel/generator": "^7.29.7",
+        "@babel/helper-compilation-targets": "^7.29.7",
+        "@babel/helper-module-transforms": "^7.29.7",
+        "@babel/helpers": "^7.29.7",
+        "@babel/parser": "^7.29.7",
+        "@babel/template": "^7.29.7",
+        "@babel/traverse": "^7.29.7",
+        "@babel/types": "^7.29.7",
+        "@jridgewell/remapping": "^2.3.5",
         "convert-source-map": "^2.0.0",
         "debug": "^4.1.0",
         "gensync": "^1.0.0-beta.2",
@@ -110,30 +96,30 @@
       }
     },
     "node_modules/@babel/generator": {
-      "version": "7.26.2",
-      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.26.2.tgz",
-      "integrity": "sha512-zevQbhbau95nkoxSq3f/DC/SC+EEOUZd3DYqfSkMhY2/wfSeaHV1Ew4vk8e+x8lja31IbyuUa2uQ3JONqKbysw==",
+      "version": "7.29.8",
+      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.29.8.tgz",
+      "integrity": "sha512-gZbepsdh3WDtgZKWL+vTPh71LSBrm/Y4/QDZBVCcYfmeTEEuoOYwlSy+G1StfJg+/Zy550u/3TATbm7qDbbMtg==",
       "license": "MIT",
       "dependencies": {
-        "@babel/parser": "^7.26.2",
-        "@babel/types": "^7.26.0",
-        "@jridgewell/gen-mapping": "^0.3.5",
-        "@jridgewell/trace-mapping": "^0.3.25",
+        "@babel/parser": "^7.29.8",
+        "@babel/types": "^7.29.8",
+        "@jridgewell/gen-mapping": "^0.3.12",
+        "@jridgewell/trace-mapping": "^0.3.28",
         "jsesc": "^3.0.2"
       },
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@babel/helper-compilation-targets": {
-      "version": "7.25.9",
-      "resolved": "https://registry.npmjs.org/@babel/helper-compilation-targets/-/helper-compilation-targets-7.25.9.tgz",
-      "integrity": "sha512-j9Db8Suy6yV/VHa4qzrj9yZfZxhLWQdVnRlXxmKLYlhWUVB1sB2G5sxuWYXk/whHD
```

---

### Incident Patch 13: `e02335d6` (2026-06-15)
**Commit Message**: Merge pull request #1263 from openziti/fix-notes

fix notes

**File**: `website/docs/concepts/namespaces.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ sidebar_position: 10
 
 # Reserved names and namespaces
 
-:::info v2.0 feature
+:::info[v2.0 feature]
 This page describes the v2.0 namespace and name system. If you're migrating from v1.x, see the [v2 migration
 guide](/how-tos/migration/migrate-v1-to-v2.md) for details on how this replaces the old `zrok reserve` workflow.
 :::
```

**File**: `website/docs/get-started/enable-env.md` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ Environment:
 
 Both `Account Token` and `EnvZId` should show `<<SET>>`. Your environment is ready.
 
-:::note Self-hosted API endpoint
+:::note[Self-hosted API endpoint]
 If you're using a self-hosted zrok instance, configure your API endpoint before enabling:
 
 ```bash
```

**File**: `website/docs/how-tos/agent/run-docker-agent.mdx` (modified, +2/-2)
```diff
@@ -73,7 +73,7 @@ Docker host and mount it into the container.
           - ${HOME}/.zrok2:/mnt/.zrok2
     ```
 
-    :::warning Set the container user
+    :::warning[Set the container user]
     The `user: "${UID:-1000}"` directive sets the container's effective UID to match your Docker host user. This is
     required so the container can read and write to the bind-mounted `~/.zrok2` directory. If your UID is not 1000,
     set `UID` in your shell or `.env` file.
@@ -99,7 +99,7 @@ Docker host and mount it into the container.
     docker compose exec zrok-agent zrok2 share public http://host.docker.internal:8080 -n public:myapp
     ```
 
-    :::tip host.docker.internal
+    :::tip[host.docker.internal]
     To share a service running on the Docker host, use `host.docker.internal` as the hostname. On Linux, you may
     also need `--network=host` on the container or add `extra_hosts: ["host.docker.internal:host-gateway"]` to the
     compose service.
```

**File**: `website/docs/how-tos/migration/migrate-v1-to-v2.md` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ sidebar_position: 5
 
 This guide helps you transition from zrok v1.x to v2.0, focusing on the paradigm shift from reserved shares to the new namespaces model.
 
-:::warning breaking changes
+:::warning[Breaking changes]
 zrok v2.0 introduces breaking changes. The reserved sharing commands (`zrok reserve`, `zrok release`, `zrok share reserved`) have been removed and replaced with a more flexible namespace system.
 :::
 
```

**File**: `website/docs/self-hosting/deployment/docker.mdx` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ This guide walks through deploying a self-hosted zrok2 instance using Docker Com
 as the [Deploy zrok on Linux](@zrokdocs/self-hosting/deployment/linux): OpenZiti overlay, zrok2 controller, frontend,
 and PostgreSQL, using official container images with runtime configuration via environment variables.
 
-:::info Single-host deployment
+:::info[Single-host deployment]
 This compose stack runs one frontend instance. For higher throughput or availability, run multiple frontend instances
 behind a reverse proxy (e.g., Caddy or Traefik). See [Scaling frontends](@zrokdocs/self-hosting/frontends/scaling-frontends) for
 details.
@@ -25,7 +25,7 @@ details.
   - **443**: HTTPS for the zrok2 controller and frontend via Caddy (recommended for production)
   - **18080 and 8080**: zrok2 controller and frontend (local testing only, no TLS)
 
-:::tip Use Caddy for TLS
+:::tip[Use Caddy for TLS]
 Use the [Caddy TLS overlay](#optional-enable-tls-with-caddy) for production deployments. Caddy terminates TLS for the
 zrok2 controller API and the wildcard share frontend on port 443, routing by subdomain. This avoids exposing the
 insecure ports 18080 (controller) and 8080 (frontend) directly to the internet.
```

**File**: `website/docs/self-hosting/deployment/linux.mdx` (modified, +3/-3)
```diff
@@ -10,7 +10,7 @@ import TabItem from '@theme/TabItem';
 This guide walks through deploying a self-hosted zrok2 instance on a single Linux server, running the controller,
 frontend, and metrics bridge. This is the simplest production-ready configuration.
 
-:::info Single-host deployment
+:::info[Single-host deployment]
 To scale the frontend for higher throughput or availability, see
 [Scaling frontends](@zrokdocs/self-hosting/frontends/scaling-frontends).
 :::
@@ -164,7 +164,7 @@ sudo -u postgres psql -c "CREATE USER zrok2 WITH PASSWORD '<your-db-password>';"
 sudo -u postgres psql -c "CREATE DATABASE zrok2 OWNER zrok2;"
 ```
 
-:::tip SQLite3 alternative
+:::tip[SQLite3 alternative]
 For single-controller deployments, you can use SQLite3 instead of PostgreSQL. Replace the `store` section in `ctrl.yml`
 with:
 
@@ -414,7 +414,7 @@ shares would work with polling.
     sudo systemctl restart zrok2-controller
     ```
 
-:::note Why is this needed?
+:::note[Why is this needed?]
 When a user creates a named share (`zrok2 share public --name-selection public:myapp ...`), the controller publishes a
 mapping update to the `dynamicProxy` AMQP exchange. The frontend subscribes to this exchange and immediately starts
 routing `myapp.zrok.example.com` to the share's backend with no polling delay. The `dynamicProxyController` Ziti service
```

**File**: `website/docs/self-hosting/metrics-and-limits/limits.md` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ zrok limits can be specified *globally*, applying to all users in a service inst
 provide additional levels of resource allocation. Limit classes can then be *applied* to multiple accounts, to alter
 their limit allocation beyond what's configured in the global configuration.
 
-:::note v2.0 terminology
+:::note[v2.0 terminology]
 In zrok v2.0, the namespace and name system replaced the v1.x reserved share workflow:
 
 - `reserved_shares` now refers to reserved names created with `zrok2 create name -n <namespace> <name>`
```

---

### Incident Patch 14: `ac03d477` (2026-06-15)
**Commit Message**: fix notes

**File**: `website/docs/concepts/namespaces.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ sidebar_position: 10
 
 # Reserved names and namespaces
 
-:::info v2.0 feature
+:::info[v2.0 feature]
 This page describes the v2.0 namespace and name system. If you're migrating from v1.x, see the [v2 migration
 guide](/how-tos/migration/migrate-v1-to-v2.md) for details on how this replaces the old `zrok reserve` workflow.
 :::
```

**File**: `website/docs/get-started/enable-env.md` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ Environment:
 
 Both `Account Token` and `EnvZId` should show `<<SET>>`. Your environment is ready.
 
-:::note Self-hosted API endpoint
+:::note[Self-hosted API endpoint]
 If you're using a self-hosted zrok instance, configure your API endpoint before enabling:
 
 ```bash
```

**File**: `website/docs/how-tos/agent/run-docker-agent.mdx` (modified, +2/-2)
```diff
@@ -73,7 +73,7 @@ Docker host and mount it into the container.
           - ${HOME}/.zrok2:/mnt/.zrok2
     ```
 
-    :::warning Set the container user
+    :::warning[Set the container user]
     The `user: "${UID:-1000}"` directive sets the container's effective UID to match your Docker host user. This is
     required so the container can read and write to the bind-mounted `~/.zrok2` directory. If your UID is not 1000,
     set `UID` in your shell or `.env` file.
@@ -99,7 +99,7 @@ Docker host and mount it into the container.
     docker compose exec zrok-agent zrok2 share public http://host.docker.internal:8080 -n public:myapp
     ```
 
-    :::tip host.docker.internal
+    :::tip[host.docker.internal]
     To share a service running on the Docker host, use `host.docker.internal` as the hostname. On Linux, you may
     also need `--network=host` on the container or add `extra_hosts: ["host.docker.internal:host-gateway"]` to the
     compose service.
```

**File**: `website/docs/how-tos/migration/migrate-v1-to-v2.md` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ sidebar_position: 5
 
 This guide helps you transition from zrok v1.x to v2.0, focusing on the paradigm shift from reserved shares to the new namespaces model.
 
-:::warning breaking changes
+:::warning[Breaking changes]
 zrok v2.0 introduces breaking changes. The reserved sharing commands (`zrok reserve`, `zrok release`, `zrok share reserved`) have been removed and replaced with a more flexible namespace system.
 :::
 
```

**File**: `website/docs/self-hosting/deployment/docker.mdx` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ This guide walks through deploying a self-hosted zrok2 instance using Docker Com
 as the [Deploy zrok on Linux](@zrokdocs/self-hosting/deployment/linux): OpenZiti overlay, zrok2 controller, frontend,
 and PostgreSQL, using official container images with runtime configuration via environment variables.
 
-:::info Single-host deployment
+:::info[Single-host deployment]
 This compose stack runs one frontend instance. For higher throughput or availability, run multiple frontend instances
 behind a reverse proxy (e.g., Caddy or Traefik). See [Scaling frontends](@zrokdocs/self-hosting/frontends/scaling-frontends) for
 details.
@@ -25,7 +25,7 @@ details.
   - **443**: HTTPS for the zrok2 controller and frontend via Caddy (recommended for production)
   - **18080 and 8080**: zrok2 controller and frontend (local testing only, no TLS)
 
-:::tip Use Caddy for TLS
+:::tip[Use Caddy for TLS]
 Use the [Caddy TLS overlay](#optional-enable-tls-with-caddy) for production deployments. Caddy terminates TLS for the
 zrok2 controller API and the wildcard share frontend on port 443, routing by subdomain. This avoids exposing the
 insecure ports 18080 (controller) and 8080 (frontend) directly to the internet.
```

**File**: `website/docs/self-hosting/deployment/linux.mdx` (modified, +3/-3)
```diff
@@ -10,7 +10,7 @@ import TabItem from '@theme/TabItem';
 This guide walks through deploying a self-hosted zrok2 instance on a single Linux server, running the controller,
 frontend, and metrics bridge. This is the simplest production-ready configuration.
 
-:::info Single-host deployment
+:::info[Single-host deployment]
 To scale the frontend for higher throughput or availability, see
 [Scaling frontends](@zrokdocs/self-hosting/frontends/scaling-frontends).
 :::
@@ -164,7 +164,7 @@ sudo -u postgres psql -c "CREATE USER zrok2 WITH PASSWORD '<your-db-password>';"
 sudo -u postgres psql -c "CREATE DATABASE zrok2 OWNER zrok2;"
 ```
 
-:::tip SQLite3 alternative
+:::tip[SQLite3 alternative]
 For single-controller deployments, you can use SQLite3 instead of PostgreSQL. Replace the `store` section in `ctrl.yml`
 with:
 
@@ -414,7 +414,7 @@ shares would work with polling.
     sudo systemctl restart zrok2-controller
     ```
 
-:::note Why is this needed?
+:::note[Why is this needed?]
 When a user creates a named share (`zrok2 share public --name-selection public:myapp ...`), the controller publishes a
 mapping update to the `dynamicProxy` AMQP exchange. The frontend subscribes to this exchange and immediately starts
 routing `myapp.zrok.example.com` to the share's backend with no polling delay. The `dynamicProxyController` Ziti service
```

**File**: `website/docs/self-hosting/metrics-and-limits/limits.md` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ zrok limits can be specified *globally*, applying to all users in a service inst
 provide additional levels of resource allocation. Limit classes can then be *applied* to multiple accounts, to alter
 their limit allocation beyond what's configured in the global configuration.
 
-:::note v2.0 terminology
+:::note[v2.0 terminology]
 In zrok v2.0, the namespace and name system replaced the v1.x reserved share workflow:
 
 - `reserved_shares` now refers to reserved names created with `zrok2 create name -n <namespace> <name>`
```

---

### Incident Patch 15: `8354a540` (2026-05-20)
**Commit Message**: fix: update openziti intro link to 2.x path after version promotion

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `website/docs/concepts/private-shares.mdx` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ connections using the `tunnel` backend. What matters is that access is private a
 who have your share token.
 
 The peer-to-peer capabilities of zrok are an important property of the underlying
-[OpenZiti](@openzitidocs/learn/introduction) network that zrok uses to provide connectivity between
+[OpenZiti](@openzitidocs/intro) network that zrok uses to provide connectivity between
 users and resources.
 
 To create and manage private shares, see [Manage shares with the agent](@zrokdocs/how-tos/agent/manage-shares).
```

**File**: `website/docs/self-hosting/metrics-and-limits/configure-metrics.md` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ Configure the OpenZiti controller, metrics bridge, and zrok controller to collec
     ```
 
     Adjust `events/jsonLogger/handler/path` to wherever you want to send these events for ingestion into zrok. Consult
-    the [OpenZiti docs](@openzitidocs/learn/introduction) for additional options that control file rotation.
+    the [OpenZiti docs](@openzitidocs/intro) for additional options that control file rotation.
 
 2. Add the following to the `network` stanza of the OpenZiti controller configuration to increase the reporting
    frequency. By default, the OpenZiti events infrastructure reports and batches events in 1-minute buckets—too large an
```

#### Recent Merged Pull Requests:
- **PR #1283** (2026-10-03): rate limiting is counted and answered with 503; access and enable compensate (@michaelquigley)
- **PR #1282** (2026-10-02): relax rebuilds v2 public share dial policies; repair-dial-policies; influx query deadline (@michaelquigley)
- **PR #1281** (2026-10-02): garbage collection improvements (@michaelquigley)
- **PR #1280** (2026-09-29): fall-fixes-s9 (@michaelquigley)
- **PR #1279** (2026-09-29): one improved teardown path; notification sequencing improvements (@michaelquigley)
- **PR #1278** (2026-09-29): disable and delete identity tolerate an absent ziti identity (@michaelquigley)
- **PR #1277** (2026-09-29): share creation rollback compensation; better ziti errors (@michaelquigley)
- **PR #1275** (2026-09-27): fall fixes, v2 round 1 (@michaelquigley)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
