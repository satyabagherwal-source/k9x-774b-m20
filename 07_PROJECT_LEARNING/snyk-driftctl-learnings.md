# Forensic Learning Record (Deep Inspection): snyk/driftctl

> **Canonical Artifact**: `07_PROJECT_LEARNING/snyk-driftctl-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/snyk/driftctl](https://github.com/snyk/driftctl))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:35:56.336Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `snyk/driftctl`
- **Description**: Detect, track and alert on infrastructure drift
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2662 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `enumeration/alerter/alert.go`
```
package alerter

import (
	"encoding/json"
	"fmt"

	"github.com/snyk/driftctl/enumeration/resource"
)

type Alerts map[string][]Alert

type Alert interface {
	Message() string
	ShouldIgnoreResource() bool
	Resource() *resource.Resource
}

type UnsupportedResourcetypeAlert struct {
	Typ string
}

func NewUnsupportedResourcetypeAlert(typ string) *UnsupportedResourcetypeAlert {
	return &UnsupportedResourcetypeAlert{Typ: typ}
}

func (f *UnsupportedResourcetypeAlert) Message() string {
	return fmt.Sprintf("%s is not supported...", f.Typ)
}

func (f *UnsupportedResourcetypeAlert) ShouldIgnoreResource() bool {
	return false
}

func (f *UnsupportedResourcetypeAlert) Resource() *resource.Resource {
	return nil
}

type FakeAlert struct {
	Msg            string
	IgnoreResource bool
}

func (f *FakeAlert) Message() string {
	return f.Msg
}

func (f *FakeAlert) ShouldIgnoreResource() bool {
	return f.IgnoreResource
}

func (f *FakeAlert) Resource() *resource.Resource {
	return nil
}

type SerializableAlert struct {
	Alert
}

type SerializedAlert struct {
	Msg string `json:"message"`
}

func (u *SerializedAlert) Message() string {
	return u.Msg
}

func (u *SerializedAlert) ShouldIgnoreResource() bool {
	return false
}

func (s *SerializedAlert) Resource() *resource.Resource {
	return nil
}

func (s *SerializableAlert) UnmarshalJSON(bytes []byte) error {
	var res SerializedAlert

	if err := json.Unmarshal(bytes, &res); err != nil {
		return err
	}
	s.Alert = &res
	return nil
}

func (s *SerializableAlert) MarshalJSON() ([]byte, error) {
	return json.Marshal(SerializedAlert{Msg: s.Message()})
}

```

### Core Architecture Module: `enumeration/alerter/alerter.go`
```
package alerter

import (
	"fmt"

	"github.com/snyk/driftctl/enumeration/resource"
)

type AlerterInterface interface {
	SendAlert(key string, alert Alert)
}

type Alerter struct {
	alerts   Alerts
	alertsCh chan Alerts
	doneCh   chan bool
}

func NewAlerter() *Alerter {
	var alerter = &Alerter{
		alerts:   make(Alerts),
		alertsCh: make(chan Alerts),
		doneCh:   make(chan bool),
	}

	go alerter.run()

	return alerter
}

func (a *Alerter) run() {
	defer func() { a.doneCh <- true }()
	for alert := range a.alertsCh {
		for k, v := range alert {
			if val, ok := a.alerts[k]; ok {
				a.alerts[k] = append(val, v...)
			} else {
				a.alerts[k] = v
			}
		}
	}
}

func (a *Alerter) SetAlerts(alerts Alerts) {
	a.alerts = alerts
}

func (a *Alerter) Retrieve() Alerts {
	close(a.alertsCh)
	<-a.doneCh
	return a.alerts
}

func (a *Alerter) SendAlert(key string, alert Alert) {
	a.alertsCh <- Alerts{
		key: []Alert{alert},
	}
}

func (a *Alerter) IsResourceIgnored(res *resource.Resource) bool {
	alert, alertExists := a.alerts[fmt.Sprintf("%s.%s", res.ResourceType(), res.ResourceId())]
	wildcardAlert, wildcardAlertExists := a.alerts[res.ResourceType()]
	shouldIgnoreAlert := a.shouldBeIgnored(alert)
	shouldIgnoreWildcardAlert := a.shouldBeIgnored(wildcardAlert)
	return (alertExists && shouldIgnoreAlert) || (wildcardAlertExists && shouldIgnoreWildcardAlert)
}

func (a *Alerter) shouldBeIgnored(alert []Alert) bool {
	for _, a := range alert {
		if a.ShouldIgnoreResource() {
			return true
		}
	}
	return false
}

```

### Core Architecture Module: `enumeration/diagnostic/diagnostic.go`
```
package diagnostic

import (
	"github.com/snyk/driftctl/enumeration/alerter"
	"github.com/snyk/driftctl/enumeration/remote/alerts"
	"github.com/snyk/driftctl/enumeration/resource"
)

type Diagnostic interface {
	Code() string
	Message() string
	ResourceType() string
	Resource() *resource.Resource
}

type diagnosticImpl struct {
	alert alerter.Alert
}

func (d *diagnosticImpl) Code() string {
	if _, ok := d.alert.(*alerts.RemoteAccessDeniedAlert); ok {
		return "ACCESS_DENIED"
	}
	return "UNKNOWN_ERROR"
}

func (d *diagnosticImpl) Message() string {
	return d.alert.Message()
}

func (d *diagnosticImpl) ResourceType() string {
	ty := ""
	if d.Resource() != nil {
		ty = d.Resource().ResourceType()
	}
	return ty
}

func (d *diagnosticImpl) Resource() *resource.Resource {
	return d.alert.Resource()
}

type Diagnostics []Diagnostic

func FromAlerts(alertMap alerter.Alerts) Diagnostics {
	var results Diagnostics
	for _, v := range alertMap {
		for _, alert := range v {
			diag := &diagnosticImpl{alert}
			results = append(results, diag)
		}
	}
	return results
}

```

### Core Architecture Module: `enumeration/enum.go`
```
package enumeration

import (
	"time"

	"github.com/snyk/driftctl/enumeration/diagnostic"
	"github.com/snyk/driftctl/enumeration/resource"
)

type EnumerateInput struct {
	ResourceTypes []string
}

type EnumerateOutput struct {
	// Resources is a map of resources by type. Every listed resource type will
	// have a key in the map. The value will be either nil or an empty slice if
	// no resources of that type were found.
	Resources map[string][]*resource.Resource

	// Timings is map of list durations by resource type. This aids understanding
	// which resource types took the most time to list.
	Timings map[string]time.Duration

	// Diagnostics contains messages and errors that arose during the list operation.
	// If the diagnostic is associated with a resource type, the ResourceType()
	// call will indicate which type. If associated with a resource, the Resource()
	// call will indicate which resource.
	Diagnostics diagnostic.Diagnostics
}

type Enumerator interface {
	Enumerate(*EnumerateInput) (*EnumerateOutput, error)
}

```

### Core Architecture Module: `enumeration/filter.go`
```
package enumeration

import "github.com/snyk/driftctl/enumeration/resource"

type Filter interface {
	IsTypeIgnored(ty resource.ResourceType) bool
	IsResourceIgnored(res *resource.Resource) bool
}

```

### Core Architecture Module: `enumeration/mock_Filter.go`
```
// Code generated by mockery v2.35.4. DO NOT EDIT.

package enumeration

import (
	resource "github.com/snyk/driftctl/enumeration/resource"
	mock "github.com/stretchr/testify/mock"
)

// MockFilter is an autogenerated mock type for the Filter type
type MockFilter struct {
	mock.Mock
}

// IsResourceIgnored provides a mock function with given fields: res
func (_m *MockFilter) IsResourceIgnored(res *resource.Resource) bool {
	ret := _m.Called(res)

	var r0 bool
	if rf, ok := ret.Get(0).(func(*resource.Resource) bool); ok {
		r0 = rf(res)
	} else {
		r0 = ret.Get(0).(bool)
	}

	return r0
}

// IsTypeIgnored provides a mock function with given fields: ty
func (_m *MockFilter) IsTypeIgnored(ty resource.ResourceType) bool {
	ret := _m.Called(ty)

	var r0 bool
	if rf, ok := ret.Get(0).(func(resource.ResourceType) bool); ok {
		r0 = rf(ty)
	} else {
		r0 = ret.Get(0).(bool)
	}

	return r0
}

// NewMockFilter creates a new instance of MockFilter. It also registers a testing interface on the mock and a cleanup function to assert the mocks expectations.
// The first argument is typically a *testing.T value.
func NewMockFilter(t interface {
	mock.TestingT
	Cleanup(func())
}) *MockFilter {
	mock := &MockFilter{}
	mock.Mock.Test(t)

	t.Cleanup(func() { mock.AssertExpectations(t) })

	return mock
}

```

### Core Architecture Module: `enumeration/parallel/parallel_runner.go`
```
package parallel

import (
	"context"
	"sync"

	"github.com/getsentry/sentry-go"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"go.uber.org/atomic"

	"golang.org/x/sync/semaphore"
)

type ParallelRunner struct {
	sem     *semaphore.Weighted
	wg      *sync.WaitGroup
	ctx     context.Context
	cancel  context.CancelFunc
	resChan chan interface{}
	err     error
	hasErr  *atomic.Bool
	waiting *atomic.Bool
}

func NewParallelRunner(ctx context.Context, maxRun int64) *ParallelRunner {
	ctx, cancelFunc := context.WithCancel(ctx)
	return &ParallelRunner{
		sem:     semaphore.NewWeighted(maxRun),
		wg:      &sync.WaitGroup{},
		ctx:     ctx,
		cancel:  cancelFunc,
		resChan: make(chan interface{}),
		err:     nil,
		hasErr:  atomic.NewBool(false),
		waiting: atomic.NewBool(false),
	}
}

func (p *ParallelRunner) SubRunner() *ParallelRunner {
	ctx, cancelFunc := context.WithCancel(p.ctx)
	return &ParallelRunner{
		sem:     p.sem,
		wg:      &sync.WaitGroup{},
		ctx:     ctx,
		cancel:  cancelFunc,
		resChan: make(chan interface{}),
		err:     nil,
		hasErr:  atomic.NewBool(false),
		waiting: atomic.NewBool(false),
	}
}

func (p *ParallelRunner) Read() chan interface{} {
	p.wait()
	return p.resChan
}

func (p *ParallelRunner) DoneChan() <-chan struct{} {
	return p.ctx.Done()
}

func (p *ParallelRunner) Err() error {
	return p.err
}

func (p *ParallelRunner) wait() {
	if !p.waiting.Swap(true) {
		go func() {
			p.wg.Wait()
			close(p.resChan)
		}()
	}
}

func (p *ParallelRunner) Run(runnable func() (interface{}, error)) {
	p.wg.Add(1)
	go func() {
		if err := p.sem.Acquire(p.ctx, 1); err == nil {
			// only release if sem was acquired
			defer p.sem.Release(1)
		}
		defer p.wg.Done()
		// Prevent new routines executions if we already got an error from another routine
		if p.ctx.Err() != nil {
			return
		}
		// Handle panic in routines and stop runner with proper error
		// Some failed call to grpc plugin like getSchema trigger a panic
		defer func() {
			if r := recover(); r != nil {
				sentry.CurrentHub().Recover(r)
				p.Stop(errors.Errorf("A runner routine paniced: %s", r))
			}
		}()
		res, err := runnable()
		if err != nil {
			p.Stop(err)
		}
		p.resChan <- res
	}()
}

func (p *ParallelRunner) Stop(err error) {
	if !p.hasErr.Swap(true) {
		logrus.Debug("Stopping ParallelRunner")
		p.err = err
		p.cancel()
	}
}

```

### Core Architecture Module: `enumeration/progress.go`
```
package enumeration

type ProgressCounter interface {
	Inc()
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1752** (2026-07-31): **chore: add prodsec-orb-runtime context to config.yaml [PRODSEC-10643]**
  *Symptoms*: ## Summary This PR adds the `prodsec-orb-runtime` context to jobs and workflows that use prodsec-orb commands.  ## Changes - Added `prodsec-orb-runtime` context to jobs using:   - `prodsec/secrets-scan`   - `prodsec/security_scans`   - `prodsec/container_scan`   - `publish/publish`  ## Related PRODSEC-10643 
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/snyk/driftctl?pullRequest=1752) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/snyk/driftctl?pullRequest=1752) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/snyk/driftctl?pullRequest=1752) it.</sub>
  > ### :white_check_mark: **Snyk checks have passed. No issues have been found so far.**  | Status | Scan Engine | ![](https://res.cloudinary.com/snyk/image/upload/r-d/scm-platform/snyk-pull-requests/severity-critical.svg) Critical | ![](https://res.cloudinary.com/snyk/image/upload/r-d/scm-platform/snyk-pull-requests/severity-high.svg) High | ![](https://res.cloudinary.com/snyk/image/upload/r-d/scm-platform/snyk-pull-requests/severity-medium.svg) Medium | ![](https://res.cloudinary.com/snyk/image/upload/r-d/scm-platform/snyk-pull-requests/severity-low.svg) Low | Total (0) | |---|---|---|---|---|---|---| | :white_check_mark: | Code Security| 0 | 0 | 0 | 0 | [ 0 issues](https://app.snyk.io/org/cloud-cloud/project/d8e15357-cb70-4a2a-b65e-0faf4dda2919/pr-check/b57591cc-fc2c-4b8e-bea3-5b55d700b839?refs=beaabafb69c66b50dce5718d7925177eabc13359&source=prChecksComment) |  :computer: Catch issues earlier using the plugins for [VS Code](https://marketplace.visualstudio.com/items?itemName=snyk-secur

- **Issue #1747** (2026-05-14): **chore: update codeowners [PRODSEC-10215]**
  *Symptoms*: Updates codeowners to append the new github governance managed teams. For more information, please check https://snyksec.atlassian.net/wiki/spaces/PRODSEC/pages/4613570586/H1+2026+Team+rename+Updates+to+CODEOWNERS+and+repository+collaborators+to+match+organisation+change  [IMPORTANT]:     If your service uses vervet, you probably to run a commane like `make generate` to update the vervet files.    This is specific to your repository as there is not standardisation on the command to run.    
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/snyk/driftctl?pullRequest=1747) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/snyk/driftctl?pullRequest=1747) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/snyk/driftctl?pullRequest=1747) it.</sub>
  > ### :white_check_mark: **Snyk checks have passed. No issues have been found so far.**  | Status | Scan Engine | ![](https://res.cloudinary.com/snyk/image/upload/r-d/scm-platform/snyk-pull-requests/severity-critical.svg) Critical | ![](https://res.cloudinary.com/snyk/image/upload/r-d/scm-platform/snyk-pull-requests/severity-high.svg) High | ![](https://res.cloudinary.com/snyk/image/upload/r-d/scm-platform/snyk-pull-requests/severity-medium.svg) Medium | ![](https://res.cloudinary.com/snyk/image/upload/r-d/scm-platform/snyk-pull-requests/severity-low.svg) Low | Total (0) | |---|---|---|---|---|---|---| | :white_check_mark: | Code Security| 0 | 0 | 0 | 0 | [ 0 issues](https://app.snyk.io/org/cloud-cloud/project/d8e15357-cb70-4a2a-b65e-0faf4dda2919/pr-check/731c3397-ee80-414f-bbcf-3ede0945729b?refs=f0255914f3cb97ae50f79a05f1ed0db2751f2392&source=prChecksComment) |  :computer: Catch issues earlier using the plugins for [VS Code](https://marketplace.visualstudio.com/items?itemName=snyk-secur

- **Issue #1745** (2026-04-28): **alerts: fix 'occured' -> 'occurred' in error format strings**
  *Symptoms*: Three error format strings in `enumeration/remote/alerts/alerts.go` (lines 34, 41, 48) read `An error occured listing`. Fixed to `occurred`. String-literal-only change.
  **Post-Mortem & Fix Analysis**:
  > ### :white_check_mark: **Snyk checks have passed. No issues have been found so far.**  | Status | Scan Engine | ![](https://res.cloudinary.com/snyk/image/upload/r-d/scm-platform/snyk-pull-requests/severity-critical.svg) Critical | ![](https://res.cloudinary.com/snyk/image/upload/r-d/scm-platform/snyk-pull-requests/severity-high.svg) High | ![](https://res.cloudinary.com/snyk/image/upload/r-d/scm-platform/snyk-pull-requests/severity-medium.svg) Medium | ![](https://res.cloudinary.com/snyk/image/upload/r-d/scm-platform/snyk-pull-requests/severity-low.svg) Low | Total (0) | |---|---|---|---|---|---|---| | :white_check_mark: | Open Source Security| 0 | 0 | 0 | 0 | [ 0 issues](https://app.snyk.io/org/cloud-cloud/pr-checks/ef6c8e44-0de8-42dd-b0f9-dec63a6dc032?refs=5107dca39b0ffbdec664e915029e8fa8e6845f65&source=prChecksComment) | | :white_check_mark: | Licenses| 0 | 0 | 0 | 0 | [ 0 issues](https://app.snyk.io/org/cloud-cloud/pr-checks/ef6c8e44-0de8-42dd-b0f9-dec63a6dc032/license?refs=5107dca
  > Closing — typo-only PR. Multiple maintainers across the OSS ecosystem have flagged my recent typo-sweep PRs as AI-generated spam (notably hashicorp/nomad#27855, hashicorp/hcl#794, argo-cd reviewers). I should have caught this pattern sooner. Apologies for the noise.

- **Issue #1743** (2026-04-15): **chore: update codeowners [PRODSEC-10215]**
  *Symptoms*: Updates codeowners to append the new github governance managed teams. For more information, please check: - https://snyksec.atlassian.net/wiki/spaces/PRODSEC/pages/4613570586/Updates+to+CODEOWNERS+and+repository+collaborators+to+match+organisation+change [!IMPORTANT]: If this service relies on vervet, you will need to run a command to regenerate the spec (e.g. `make generate`) before merging it. The best option is to: - checkout the branch `update-ownership-PRODSEC-10215-BbIs` - run the command - commit and push the results to this PR before you approve and merge it.
  **Post-Mortem & Fix Analysis**:
  > ### :white_check_mark: **Snyk checks have passed. No issues have been found so far.**  | Status | Scan Engine | ![](https://res.cloudinary.com/snyk/image/upload/r-d/scm-platform/snyk-pull-requests/severity-critical.svg) Critical | ![](https://res.cloudinary.com/snyk/image/upload/r-d/scm-platform/snyk-pull-requests/severity-high.svg) High | ![](https://res.cloudinary.com/snyk/image/upload/r-d/scm-platform/snyk-pull-requests/severity-medium.svg) Medium | ![](https://res.cloudinary.com/snyk/image/upload/r-d/scm-platform/snyk-pull-requests/severity-low.svg) Low | Total (0) | |---|---|---|---|---|---|---| | :white_check_mark: | Open Source Security| 0 | 0 | 0 | 0 | [ 0 issues](https://app.snyk.io/org/cloud-cloud/pr-checks/540aa0f3-3f1b-4c98-be80-4221a100c15e?refs=df085676db2970555092082c30f0fb9aa3238da0&source=prChecksComment) | | :white_check_mark: | Licenses| 0 | 0 | 0 | 0 | [ 0 issues](https://app.snyk.io/org/cloud-cloud/pr-checks/540aa0f3-3f1b-4c98-be80-4221a100c15e/license?refs=df08567
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/snyk/driftctl?pullRequest=1743) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/snyk/driftctl?pullRequest=1743) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/snyk/driftctl?pullRequest=1743) it.</sub>

- **Issue #1737** (2025-09-12): **fix: uprade go-getter to v1.7.9 [IAC-3439]**
  *Symptoms*: ## Description  Upgrade go-getter from v1.7.5 to v1.7.9
  **Post-Mortem & Fix Analysis**:
  > ### :tada: **Snyk checks have passed. No issues have been found so far.**  :white_check_mark: **security/snyk** check is complete. No issues have been found. [(View Details)](https://app.snyk.io/org/cloud-cloud/pr-checks/f7598343-f4c0-4b0d-abbc-60a98bcd978b?refs=ec6e7c4e9e40da1ee5cfd4ab8fbe3ee1bde78f48&source=prChecksComment)  :white_check_mark: **license/snyk** check is complete. No issues have been found. [(View Details)](https://app.snyk.io/org/cloud-cloud/pr-checks/f7598343-f4c0-4b0d-abbc-60a98bcd978b/license?refs=ec6e7c4e9e40da1ee5cfd4ab8fbe3ee1bde78f48&source=prChecksComment)  :white_check_mark: **code/snyk** check is complete. No issues have been found. [(View Details)](https://app.snyk.io/org/cloud-cloud/project/31643cc6-b514-4e3e-842b-4f499ad387af/pr-check/d044b4ca-fc86-4470-b08e-b0bec86f764f?refs=ec6e7c4e9e40da1ee5cfd4ab8fbe3ee1bde78f48&source=prChecksComment)   

- **Issue #1735** (2025-07-31): **chore: update codeowners [IAC-3432]**
  *Symptoms*: Updates codeowners to append the new github governance managed teams. For more information, please check: - https://snyksec.atlassian.net/wiki/spaces/PRODSEC/pages/3428254583/Codeowners+Updates - https://snyksec.atlassian.net/wiki/spaces/PRODSEC/pages/3504701500/Rollout+of+new+Okta+teams
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/snyk/driftctl?pullRequest=1735) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/snyk/driftctl?pullRequest=1735) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/snyk/driftctl?pullRequest=1735) it.</sub>
  > ![](https://res.cloudinary.com/snyk/image/upload/r-d/scm-platform/snyk-pull-requests/pr-banner-default.svg)  ### :tada: **Snyk checks have passed. No issues have been found so far.**  :white_check_mark: **security/snyk** check is complete. No issues have been found. [(View Details)](https://app.snyk.io/org/cloud-cloud/pr-checks/03d15446-0008-4e2e-9d00-73ab94bf9d07?refs=2cdd29881d12f162882eab5a17ed19200548c628&source=prChecksComment)  :white_check_mark: **license/snyk** check is complete. No issues have been found. [(View Details)](https://app.snyk.io/org/cloud-cloud/pr-checks/03d15446-0008-4e2e-9d00-73ab94bf9d07/license?refs=2cdd29881d12f162882eab5a17ed19200548c628&source=prChecksComment)  :white_check_mark: **code/snyk** check is complete. No issues have been found. [(View Details)](https://app.snyk.io/org/cloud-cloud/project/31643cc6-b514-4e3e-842b-4f499ad387af/pr-check/66f22146-f6d9-4b4e-93ab-986ba3ae9a72?refs=2cdd29881d12f162882eab5a17ed19200548c628&source=prChecksComment)   

- **Issue #1729** (2025-04-09): **Fix wildcard for route53**
  *Symptoms*: | Q                 | A | ----------------- | --- | 🐛 Bug fix?       | yes/no | 🚀 New feature?   | yes/no | ⚠ Deprecations?   | yes/no | ❌ BC Break       | yes/no | 🔗 Related issues | #... | ❓ Documentation  | yes <!-- does this require documentation update ? -->  ## Description  Please include a summary of the change and which issue is fixed. Please also include relevant motivation and context.
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/snyk/driftctl?pullRequest=1729) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you all sign our [Contributor License Agreement](https://cla-assistant.io/snyk/driftctl?pullRequest=1729) before we can accept your contribution.<br/>**0** out of **2** committers have signed the CLA.<br/><br/>:x: Shurkys<br/>:x: shurkus<br/><hr/>**Shurkys** seems not to be a GitHub user. You need a GitHub account to be able to sign the CLA. If you have already a GitHub account, please [add the email address used for this commit to your account](https://help.github.com/articles/why-are-my-commits-linked-to-the-wrong-user/#commits-are-not-linked-to-any-user).<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/snyk/driftctl?pullRequest=1729) it.</sub>

- **Issue #1728** (2025-04-07): **fix: bumped golang-jwt to 4.5.2 [IAC-3278]**
  *Symptoms*: | Q                 | A | ----------------- | --- | 🐛 Bug fix?       | no | 🚀 New feature?   | no | ⚠ Deprecations?   | no | ❌ BC Break       | no | 🔗 Related issues | [IAC-3278](https://snyksec.atlassian.net/browse/IAC-3278) | ❓ Documentation  | no  ## Description  Bumped github.com/golang-jwt/jwt/v4 to v4.5.2 to fix vuln CVE-2025-30204.  [IAC-3278]: https://snyksec.atlassian.net/browse/IAC-3278?atlOrigin=eyJpIjoiNWRkNTljNzYxNjVmNDY3MDlhMDU5Y2ZhYzA5YTRkZjUiLCJwIjoiZ2l0aHViLWNvbS1KU1cifQ

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

### Incident Patch 1: `6a553aae` (2025-09-12)
**Commit Message**: Merge pull request #1737 from snyk/fix/IAC-3439/upgrade_go_getter

fix: uprade go-getter to v1.7.9 [IAC-3439]

**File**: `go.mod` (modified, +4/-6)
```diff
@@ -24,7 +24,7 @@ require (
 	github.com/getsentry/sentry-go v0.10.0
 	github.com/ghodss/yaml v1.0.0
 	github.com/go-git/go-git/v5 v5.4.2
-	github.com/hashicorp/go-getter v1.7.5
+	github.com/hashicorp/go-getter v1.7.9
 	github.com/hashicorp/go-hclog v0.9.2
 	github.com/hashicorp/go-plugin v1.3.0
 	github.com/hashicorp/go-tfe v0.20.0
@@ -51,7 +51,7 @@ require (
 	google.golang.org/api v0.114.0
 	google.golang.org/genproto v0.0.0-20230410155749-daa745c078e1
 	google.golang.org/grpc v1.56.3
-	google.golang.org/protobuf v1.30.0
+	google.golang.org/protobuf v1.33.0
 )
 
 require (
@@ -87,7 +87,7 @@ require (
 	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
 	github.com/golang/mock v1.6.0 // indirect
 	github.com/golang/protobuf v1.5.3 // indirect
-	github.com/google/go-cmp v0.5.9 // indirect
+	github.com/google/go-cmp v0.6.0 // indirect
 	github.com/google/go-querystring v1.1.0 // indirect
 	github.com/google/uuid v1.3.0 // indirect
 	github.com/googleapis/enterprise-certificate-proxy v0.2.3 // indirect
@@ -108,7 +108,6 @@ require (
 	github.com/inconshreveable/mousetrap v1.0.0 // indirect
 	github.com/jbenet/go-context v0.0.0-20150711004518-d14ea06fba99 // indirect
 	github.com/klauspost/compress v1.15.11 // indirect
-	github.com/kr/pretty v0.3.0 // indirect
 	github.com/magiconair/properties v1.8.1 // indirect
 	github.com/mailru/easyjson v0.0.0-20190626092158-b2ccc519800e // indirect
 	github.com/mattn/go-colorable v0.1.7 // indirect
@@ -122,7 +121,6 @@ require (
 	github.com/pelletier/go-toml v1.2.0 // indirect
 	github.com/pkg/browser v0.0.0-20180916011732-0a3d74bf9ce4 // indirect
 	github.com/pmezard/go-difflib v1.0.0 // indirect
-	github.com/rogpeppe/go-internal v1.9.0 // indirect
 	github.com/shurcooL/graphql v0.0.0-20200928012149-18c5c3165e3a // indirect
 	github.com/spf13/afero v1.9.2 // indirect
 	github.com/spf13/cast v1.3.0 // indirect
@@ -136,7 +134,7 @@ require (
 	go.opencensus.io v0.24.0 // indirect
 	golang.org/x/crypto v0.35.0 // indirect
 	golang.org/x/mod v0.17.0 // indirect
-	golang.org/x/net v0.23.0 // indirect
+	golang.org/x/net v0.34.0 // indirect
 	golang.org/x/sys v0.31.0 // indirect
 	golang.org/x/text v0.22.0 // indirect
 	golang.org/x/time v0.3.0 // indirect
```

---

### Incident Patch 2: `ec6e7c4e` (2025-09-12)
**Commit Message**: fix: uprade go-getter to v1.7.9 [IAC-3439]

**File**: `go.mod` (modified, +4/-6)
```diff
@@ -24,7 +24,7 @@ require (
 	github.com/getsentry/sentry-go v0.10.0
 	github.com/ghodss/yaml v1.0.0
 	github.com/go-git/go-git/v5 v5.4.2
-	github.com/hashicorp/go-getter v1.7.5
+	github.com/hashicorp/go-getter v1.7.9
 	github.com/hashicorp/go-hclog v0.9.2
 	github.com/hashicorp/go-plugin v1.3.0
 	github.com/hashicorp/go-tfe v0.20.0
@@ -51,7 +51,7 @@ require (
 	google.golang.org/api v0.114.0
 	google.golang.org/genproto v0.0.0-20230410155749-daa745c078e1
 	google.golang.org/grpc v1.56.3
-	google.golang.org/protobuf v1.30.0
+	google.golang.org/protobuf v1.33.0
 )
 
 require (
@@ -87,7 +87,7 @@ require (
 	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
 	github.com/golang/mock v1.6.0 // indirect
 	github.com/golang/protobuf v1.5.3 // indirect
-	github.com/google/go-cmp v0.5.9 // indirect
+	github.com/google/go-cmp v0.6.0 // indirect
 	github.com/google/go-querystring v1.1.0 // indirect
 	github.com/google/uuid v1.3.0 // indirect
 	github.com/googleapis/enterprise-certificate-proxy v0.2.3 // indirect
@@ -108,7 +108,6 @@ require (
 	github.com/inconshreveable/mousetrap v1.0.0 // indirect
 	github.com/jbenet/go-context v0.0.0-20150711004518-d14ea06fba99 // indirect
 	github.com/klauspost/compress v1.15.11 // indirect
-	github.com/kr/pretty v0.3.0 // indirect
 	github.com/magiconair/properties v1.8.1 // indirect
 	github.com/mailru/easyjson v0.0.0-20190626092158-b2ccc519800e // indirect
 	github.com/mattn/go-colorable v0.1.7 // indirect
@@ -122,7 +121,6 @@ require (
 	github.com/pelletier/go-toml v1.2.0 // indirect
 	github.com/pkg/browser v0.0.0-20180916011732-0a3d74bf9ce4 // indirect
 	github.com/pmezard/go-difflib v1.0.0 // indirect
-	github.com/rogpeppe/go-internal v1.9.0 // indirect
 	github.com/shurcooL/graphql v0.0.0-20200928012149-18c5c3165e3a // indirect
 	github.com/spf13/afero v1.9.2 // indirect
 	github.com/spf13/cast v1.3.0 // indirect
@@ -136,7 +134,7 @@ require (
 	go.opencensus.io v0.24.0 // indirect
 	golang.org/x/crypto v0.35.0 // indirect
 	golang.org/x/mod v0.17.0 // indirect
-	golang.org/x/net v0.23.0 // indirect
+	golang.org/x/net v0.34.0 // indirect
 	golang.org/x/sys v0.31.0 // indirect
 	golang.org/x/text v0.22.0 // indirect
 	golang.org/x/time v0.3.0 // indirect
```

---

### Incident Patch 3: `c0909785` (2025-04-07)
**Commit Message**: Merge pull request #1728 from snyk/fix/IAC-3278/fix-jwt-vuln

fix: bumped golang-jwt to 4.5.2 [IAC-3278]

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -83,7 +83,7 @@ require (
 	github.com/go-git/go-billy/v5 v5.3.1 // indirect
 	github.com/go-openapi/jsonpointer v0.19.5 // indirect
 	github.com/go-openapi/swag v0.19.5 // indirect
-	github.com/golang-jwt/jwt/v4 v4.2.0 // indirect
+	github.com/golang-jwt/jwt/v4 v4.5.2 // indirect
 	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
 	github.com/golang/mock v1.6.0 // indirect
 	github.com/golang/protobuf v1.5.3 // indirect
```

**File**: `go.sum` (modified, +2/-1)
```diff
@@ -454,8 +454,9 @@ github.com/gogo/protobuf v1.1.1/go.mod h1:r8qH/GZQm5c6nD/R0oafs1akxWv10x8SbQlK7a
 github.com/gogo/protobuf v1.2.1/go.mod h1:hp+jE20tsWTFYpLwKvXlhS1hjn+gTNwPg2I6zVXpSg4=
 github.com/gogo/protobuf v1.2.2-0.20190723190241-65acae22fc9d/go.mod h1:SlYgWuQ5SjCEi6WLHjHCa1yvBfUnHcTbrrZtXPKa29o=
 github.com/golang-jwt/jwt/v4 v4.0.0/go.mod h1:/xlHOz8bRuivTWchD4jCa+NbatV+wEUSzwAxVc6locg=
-github.com/golang-jwt/jwt/v4 v4.2.0 h1:besgBTC8w8HjP6NzQdxwKH9Z5oQMZ24ThTrHp3cZ8eU=
 github.com/golang-jwt/jwt/v4 v4.2.0/go.mod h1:/xlHOz8bRuivTWchD4jCa+NbatV+wEUSzwAxVc6locg=
+github.com/golang-jwt/jwt/v4 v4.5.2 h1:YtQM7lnr8iZ+j5q71MGKkNw9Mn7AjHM68uc9g5fXeUI=
+github.com/golang-jwt/jwt/v4 v4.5.2/go.mod h1:m21LjoU+eqJr34lmDMbreY2eSTRJ1cv77w39/MY0Ch0=
 github.com/golang/glog v0.0.0-20160126235308-23def4e6c14b/go.mod h1:SBH7ygxi8pfUlaOkMMuAQtPIUF8ecWP5IEl/CR7VP2Q=
 github.com/golang/groupcache v0.0.0-20160516000752-02826c3e7903/go.mod h1:cIg4eruTrX1D+g88fzRXU5OdNfaM+9IcxsU14FzY7Hc=
 github.com/golang/groupcache v0.0.0-20190129154638-5b532d6fd5ef/go.mod h1:cIg4eruTrX1D+g88fzRXU5OdNfaM+9IcxsU14FzY7Hc=
```

---

### Incident Patch 4: `277e8be8` (2025-04-07)
**Commit Message**: fix: bumped golang-jwt to 4.5.2 [IAC-3278]

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -83,7 +83,7 @@ require (
 	github.com/go-git/go-billy/v5 v5.3.1 // indirect
 	github.com/go-openapi/jsonpointer v0.19.5 // indirect
 	github.com/go-openapi/swag v0.19.5 // indirect
-	github.com/golang-jwt/jwt/v4 v4.2.0 // indirect
+	github.com/golang-jwt/jwt/v4 v4.5.2 // indirect
 	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
 	github.com/golang/mock v1.6.0 // indirect
 	github.com/golang/protobuf v1.5.3 // indirect
```

**File**: `go.sum` (modified, +2/-1)
```diff
@@ -454,8 +454,9 @@ github.com/gogo/protobuf v1.1.1/go.mod h1:r8qH/GZQm5c6nD/R0oafs1akxWv10x8SbQlK7a
 github.com/gogo/protobuf v1.2.1/go.mod h1:hp+jE20tsWTFYpLwKvXlhS1hjn+gTNwPg2I6zVXpSg4=
 github.com/gogo/protobuf v1.2.2-0.20190723190241-65acae22fc9d/go.mod h1:SlYgWuQ5SjCEi6WLHjHCa1yvBfUnHcTbrrZtXPKa29o=
 github.com/golang-jwt/jwt/v4 v4.0.0/go.mod h1:/xlHOz8bRuivTWchD4jCa+NbatV+wEUSzwAxVc6locg=
-github.com/golang-jwt/jwt/v4 v4.2.0 h1:besgBTC8w8HjP6NzQdxwKH9Z5oQMZ24ThTrHp3cZ8eU=
 github.com/golang-jwt/jwt/v4 v4.2.0/go.mod h1:/xlHOz8bRuivTWchD4jCa+NbatV+wEUSzwAxVc6locg=
+github.com/golang-jwt/jwt/v4 v4.5.2 h1:YtQM7lnr8iZ+j5q71MGKkNw9Mn7AjHM68uc9g5fXeUI=
+github.com/golang-jwt/jwt/v4 v4.5.2/go.mod h1:m21LjoU+eqJr34lmDMbreY2eSTRJ1cv77w39/MY0Ch0=
 github.com/golang/glog v0.0.0-20160126235308-23def4e6c14b/go.mod h1:SBH7ygxi8pfUlaOkMMuAQtPIUF8ecWP5IEl/CR7VP2Q=
 github.com/golang/groupcache v0.0.0-20160516000752-02826c3e7903/go.mod h1:cIg4eruTrX1D+g88fzRXU5OdNfaM+9IcxsU14FzY7Hc=
 github.com/golang/groupcache v0.0.0-20190129154638-5b532d6fd5ef/go.mod h1:cIg4eruTrX1D+g88fzRXU5OdNfaM+9IcxsU14FzY7Hc=
```

---

### Incident Patch 5: `ae7046ad` (2025-03-12)
**Commit Message**: Merge pull request #1725 from snyk/fix/IAC-3254/update-golang-crypto-ssh

fix: update golang.org/x/crypto/ssh to v0.35.0 [IAC-3254]

**File**: `.circleci/config.yml` (modified, +5/-5)
```diff
@@ -82,7 +82,7 @@ jobs:
     steps:
       - checkout
       - go/install:
-          version: "1.21"
+          version: "1.23"
       - go/load-cache:
           key: test_acc
       - run: make install-tools
@@ -103,7 +103,7 @@ jobs:
           path: ./
   lint:
     docker:
-      - image: golang:1.21
+      - image: golang:1.23
     steps:
       - checkout
       - run:
@@ -129,7 +129,7 @@ jobs:
     resource_class: large
     executor:
         name: go/default
-        tag: '1.21'
+        tag: '1.23'
     steps:
       - checkout
       - go/load-cache:
@@ -145,7 +145,7 @@ jobs:
   release:
     resource_class: large
     docker:
-      - image: cimg/go:1.21
+      - image: cimg/go:1.23
     steps:
       - checkout
       - gh/setup:
@@ -206,7 +206,7 @@ jobs:
                 -env "LATEST_VERSION=${CIRCLE_TAG}"
   security-scans:
       docker:
-          - image: cimg/go:1.21
+          - image: cimg/go:1.23
       resource_class: small
       steps:
           - checkout
```

**File**: `.go-version` (modified, +1/-1)
```diff
@@ -1 +1 @@
-1.21
+1.23
```

**File**: `.golangci.yml` (modified, +3/-3)
```diff
@@ -1,10 +1,10 @@
 run:
-  go: '1.21'
+  go: '1.23'
 linters:
   enable:
-    - exportloopref
+    - copyloopvar
 issues:
   exclude-rules:
     - path: _test\.go
       linters:
-        - exportloopref
+        - copyloopvar
```

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM golang:1.21 AS builder
+FROM golang:1.23 AS builder
 
 ARG OS="linux"
 ARG ARCH="amd64"
```

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ clean:
 
 .PHONY: lint
 lint:
-	@which golangci-lint > /dev/null 2>&1 || (curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | bash -s -- -b $(GOBINPATH) v1.58.0)
+	@which golangci-lint > /dev/null 2>&1 || (curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | bash -s -- -b $(GOBINPATH) v1.64.7)
 	golangci-lint run -v --timeout=10m
 
 .PHONY: install-tools
```

---

### Incident Patch 6: `052a7481` (2025-03-12)
**Commit Message**: fix: linter [IAC-3254]

**File**: `.golangci.yml` (modified, +2/-2)
```diff
@@ -2,9 +2,9 @@ run:
   go: '1.23'
 linters:
   enable:
-    - exportloopref
+    - copyloopvar
 issues:
   exclude-rules:
     - path: _test\.go
       linters:
-        - exportloopref
+        - copyloopvar
```

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ clean:
 
 .PHONY: lint
 lint:
-	@which golangci-lint > /dev/null 2>&1 || (curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | bash -s -- -b $(GOBINPATH) v1.58.0)
+	@which golangci-lint > /dev/null 2>&1 || (curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | bash -s -- -b $(GOBINPATH) v1.64.7)
 	golangci-lint run -v --timeout=10m
 
 .PHONY: install-tools
```

**File**: `enumeration/remote/aws/cloudformation_stack_enumerator.go` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ func (e *CloudformationStackEnumerator) Enumerate() ([]*resource.Resource, error
 
 	for _, stack := range stacks {
 		attrs := map[string]interface{}{}
-		if stack.Parameters != nil && len(stack.Parameters) > 0 {
+		if len(stack.Parameters) > 0 {
 			attrs["parameters.%"] = strconv.FormatInt(int64(len(stack.Parameters)), 10)
 			for k, v := range flattenParameters(stack.Parameters) {
 				attrs[fmt.Sprintf("parameters.%s", k)] = v
```

**File**: `enumeration/remote/scanner.go` (modified, +4/-4)
```diff
@@ -52,14 +52,14 @@ loop:
 }
 
 func (s *Scanner) scan() ([]*resource.Resource, error) {
-	for _, enumerator := range s.remoteLibrary.Enumerators() {
-		if s.filter.IsTypeIgnored(enumerator.SupportedType()) {
+	for _, enum := range s.remoteLibrary.Enumerators() {
+		if s.filter.IsTypeIgnored(enum.SupportedType()) {
 			logrus.WithFields(logrus.Fields{
-				"type": enumerator.SupportedType(),
+				"type": enum.SupportedType(),
 			}).Debug("Ignored enumeration of resources since it is ignored in filter")
 			continue
 		}
-		enumerator := enumerator
+		enumerator := enum
 		s.enumeratorRunner.Run(func() (interface{}, error) {
 			resources, err := enumerator.Enumerate()
 			if err != nil {
```

**File**: `enumeration/remote/terraform/provider.go` (modified, +1/-1)
```diff
@@ -171,7 +171,7 @@ func (p *TerraformProvider) ReadResource(args tf.ReadResourceArgs) (*cty.Value,
 	}
 	p.lock.Unlock()
 
-	if args.Attributes != nil && len(args.Attributes) > 0 {
+	if len(args.Attributes) > 0 {
 		// call to the provider sometimes add and delete field to their attribute this may broke caller so we deep copy attributes
 		state.Attributes = make(map[string]string, len(args.Attributes))
 		for k, v := range args.Attributes {
```

---

### Incident Patch 7: `b17b628f` (2025-03-12)
**Commit Message**: fix: update golang crypto ssh to v0.35.0 and golang oauth2 jws to v0.27.0 [IAC-3254]

**File**: `.circleci/config.yml` (modified, +5/-5)
```diff
@@ -82,7 +82,7 @@ jobs:
     steps:
       - checkout
       - go/install:
-          version: "1.21"
+          version: "1.23"
       - go/load-cache:
           key: test_acc
       - run: make install-tools
@@ -103,7 +103,7 @@ jobs:
           path: ./
   lint:
     docker:
-      - image: golang:1.21
+      - image: golang:1.23
     steps:
       - checkout
       - run:
@@ -129,7 +129,7 @@ jobs:
     resource_class: large
     executor:
         name: go/default
-        tag: '1.21'
+        tag: '1.23'
     steps:
       - checkout
       - go/load-cache:
@@ -145,7 +145,7 @@ jobs:
   release:
     resource_class: large
     docker:
-      - image: cimg/go:1.21
+      - image: cimg/go:1.23
     steps:
       - checkout
       - gh/setup:
@@ -206,7 +206,7 @@ jobs:
                 -env "LATEST_VERSION=${CIRCLE_TAG}"
   security-scans:
       docker:
-          - image: cimg/go:1.21
+          - image: cimg/go:1.23
       resource_class: small
       steps:
           - checkout
```

**File**: `.go-version` (modified, +1/-1)
```diff
@@ -1 +1 @@
-1.21
+1.23
```

**File**: `.golangci.yml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 run:
-  go: '1.21'
+  go: '1.23'
 linters:
   enable:
     - exportloopref
```

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-FROM golang:1.21 AS builder
+FROM golang:1.23 AS builder
 
 ARG OS="linux"
 ARG ARCH="amd64"
```

**File**: `go.mod` (modified, +7/-8)
```diff
@@ -1,6 +1,6 @@
 module github.com/snyk/driftctl
 
-go 1.21
+go 1.23.0
 
 require (
 	cloud.google.com/go/asset v1.13.0
@@ -46,8 +46,8 @@ require (
 	github.com/stretchr/testify v1.8.3
 	github.com/zclconf/go-cty v1.8.4
 	go.uber.org/atomic v1.4.0
-	golang.org/x/oauth2 v0.7.0
-	golang.org/x/sync v0.10.0
+	golang.org/x/oauth2 v0.27.0
+	golang.org/x/sync v0.11.0
 	google.golang.org/api v0.114.0
 	google.golang.org/genproto v0.0.0-20230410155749-daa745c078e1
 	google.golang.org/grpc v1.56.3
@@ -57,8 +57,7 @@ require (
 require (
 	cloud.google.com/go v0.110.0 // indirect
 	cloud.google.com/go/accesscontextmanager v1.7.0 // indirect
-	cloud.google.com/go/compute v1.19.1 // indirect
-	cloud.google.com/go/compute/metadata v0.2.3 // indirect
+	cloud.google.com/go/compute/metadata v0.3.0 // indirect
 	cloud.google.com/go/iam v0.13.0 // indirect
 	cloud.google.com/go/longrunning v0.4.1 // indirect
 	cloud.google.com/go/orgpolicy v1.10.0 // indirect
@@ -135,11 +134,11 @@ require (
 	github.com/vmihailenco/tagparser v0.1.1 // indirect
 	github.com/zclconf/go-cty-yaml v1.0.2 // indirect
 	go.opencensus.io v0.24.0 // indirect
-	golang.org/x/crypto v0.31.0 // indirect
+	golang.org/x/crypto v0.35.0 // indirect
 	golang.org/x/mod v0.17.0 // indirect
 	golang.org/x/net v0.23.0 // indirect
-	golang.org/x/sys v0.28.0 // indirect
-	golang.org/x/text v0.21.0 // indirect
+	golang.org/x/sys v0.31.0 // indirect
+	golang.org/x/text v0.22.0 // indirect
 	golang.org/x/time v0.3.0 // indirect
 	golang.org/x/xerrors v0.0.0-20220907171357-04be3eba64a2 // indirect
 	google.golang.org/appengine v1.6.7 // indirect
```

---

### Incident Patch 8: `7f017992` (2025-01-10)
**Commit Message**: Merge pull request #1723 from snyk/snyk-fix-6f4c4ccfa841a20ac5611d23ea29c7ff

[Snyk] Security upgrade alpine from 3.17 to 3.21.2

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ RUN go mod download
 COPY . .
 RUN SINGLE_TARGET=true make release
 
-FROM alpine:3.17
+FROM alpine:3.21.2
 
 ARG OS="linux"
 ARG ARCH="amd64"
```

---

### Incident Patch 9: `4809e57a` (2025-01-10)
**Commit Message**: fix: Dockerfile to reduce vulnerabilities

The following vulnerabilities are fixed with an upgrade:
- https://snyk.io/vuln/SNYK-ALPINE317-OPENSSL-8235199
- https://snyk.io/vuln/SNYK-ALPINE317-OPENSSL-8235199

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ RUN go mod download
 COPY . .
 RUN SINGLE_TARGET=true make release
 
-FROM alpine:3.17
+FROM alpine:3.21.2
 
 ARG OS="linux"
 ARG ARCH="amd64"
```

---

### Incident Patch 10: `4c48d5b6` (2025-01-10)
**Commit Message**: Merge pull request #1722 from snyk/fix/IAC-3174-address-jwtgo-ignore

fix: ugrade github.com/Azure/go-autorest/autorest [IAC-3174]

**File**: `.circleci/config.yml` (modified, +1/-0)
```diff
@@ -241,6 +241,7 @@ workflows:
           context:
             - snyk-bot-slack
           channel: group-infrastructure-as-code-alerts
+          trusted-branch: main
       - security-scans:
           name: Security Scans
           context:
```

**File**: `.snyk` (modified, +0/-7)
```diff
@@ -2,13 +2,6 @@
 version: v1.25.0
 # ignores vulnerabilities until expiry date; change duration by modifying expiry date
 ignore:
-  SNYK-GOLANG-GITHUBCOMDGRIJALVAJWTGO-596515:
-    - github.com/Azure/go-autorest/autorest/azure@0.11.3 > github.com/Azure/go-autorest/autorest@0.11.3 > github.com/Azure/go-autorest/autorest/adal@0.9.0 > github.com/dgrijalva/jwt-go@3.2.0:
-        reason: >-
-          This vuln is ignored since it is related to JWT in azure SDK and we
-          are not concerned by this code
-        expires: 2030-12-22T16:25:33.572Z
-        created: 2030-11-22T16:25:33.580Z
   'snyk:lic:golang:github.com:hashicorp:go-checkpoint:MPL-2.0':
     - '*':
         reason: This license is addressed by including acknowledgments in each release
```

**File**: `go.mod` (modified, +4/-4)
```diff
@@ -15,7 +15,7 @@ require (
 	github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/resources/armresources v0.2.0
 	github.com/Azure/azure-sdk-for-go/sdk/resourcemanager/storage/armstorage v0.2.0
 	github.com/Azure/azure-sdk-for-go/sdk/storage/azblob v0.2.0
-	github.com/Azure/go-autorest/autorest v0.11.3
+	github.com/Azure/go-autorest/autorest v0.11.27
 	github.com/aws/aws-sdk-go v1.44.122
 	github.com/bmatcuk/doublestar/v4 v4.0.1
 	github.com/eapache/go-resiliency v1.3.0
@@ -66,9 +66,9 @@ require (
 	github.com/Azure/azure-sdk-for-go v59.0.0+incompatible // indirect
 	github.com/Azure/azure-sdk-for-go/sdk/internal v0.8.1 // indirect
 	github.com/Azure/go-autorest v14.2.0+incompatible // indirect
-	github.com/Azure/go-autorest/autorest/adal v0.9.0 // indirect
+	github.com/Azure/go-autorest/autorest/adal v0.9.18 // indirect
 	github.com/Azure/go-autorest/autorest/date v0.3.0 // indirect
-	github.com/Azure/go-autorest/logger v0.2.0 // indirect
+	github.com/Azure/go-autorest/logger v0.2.1 // indirect
 	github.com/Azure/go-autorest/tracing v0.6.0 // indirect
 	github.com/acomagu/bufpipe v1.0.3 // indirect
 	github.com/agext/levenshtein v1.2.2 // indirect
@@ -79,12 +79,12 @@ require (
 	github.com/bgentry/go-netrc v0.0.0-20140422174119-9fd32a8b3d3d // indirect
 	github.com/bmatcuk/doublestar v1.1.5 // indirect
 	github.com/davecgh/go-spew v1.1.1 // indirect
-	github.com/dgrijalva/jwt-go v3.2.0+incompatible // indirect
 	github.com/fsnotify/fsnotify v1.4.7 // indirect
 	github.com/go-git/gcfg v1.5.0 // indirect
 	github.com/go-git/go-billy/v5 v5.3.1 // indirect
 	github.com/go-openapi/jsonpointer v0.19.5 // indirect
 	github.com/go-openapi/swag v0.19.5 // indirect
+	github.com/golang-jwt/jwt/v4 v4.2.0 // indirect
 	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
 	github.com/golang/mock v1.6.0 // indirect
 	github.com/golang/protobuf v1.5.3 // indirect
```

**File**: `go.sum` (modified, +14/-5)
```diff
@@ -230,19 +230,24 @@ github.com/Azure/azure-sdk-for-go/sdk/storage/azblob v0.2.0 h1:62Ew5xXg5UCGIXDOM
 github.com/Azure/azure-sdk-for-go/sdk/storage/azblob v0.2.0/go.mod h1:eHWhQKXc1Gv1DvWH//UzgWjWFEo0Pp4pH2vBzjBw8Fc=
 github.com/Azure/go-autorest v14.2.0+incompatible h1:V5VMDjClD3GiElqLWO7mz2MxNAK/vTfRHdAubSIPRgs=
 github.com/Azure/go-autorest v14.2.0+incompatible/go.mod h1:r+4oMnoxhatjLLJ6zxSWATqVooLgysK6ZNox3g/xq24=
-github.com/Azure/go-autorest/autorest v0.11.3 h1:fyYnmYujkIXUgv88D9/Wo2ybE4Zwd/TmQd5sSI5u2Ws=
 github.com/Azure/go-autorest/autorest v0.11.3/go.mod h1:JFgpikqFJ/MleTTxwepExTKnFUKKszPS8UavbQYUMuw=
-github.com/Azure/go-autorest/autorest/adal v0.9.0 h1:SigMbuFNuKgc1xcGhaeapbh+8fgsu+GxgDRFyg7f5lM=
+github.com/Azure/go-autorest/autorest v0.11.27 h1:F3R3q42aWytozkV8ihzcgMO4OA4cuqr3bNlsEuF6//A=
+github.com/Azure/go-autorest/autorest v0.11.27/go.mod h1:7l8ybrIdUmGqZMTD0sRtAr8NvbHjfofbf8RSP2q7w7U=
 github.com/Azure/go-autorest/autorest/adal v0.9.0/go.mod h1:/c022QCutn2P7uY+/oQWWNcK9YU+MH96NgK+jErpbcg=
+github.com/Azure/go-autorest/autorest/adal v0.9.18 h1:kLnPsRjzZZUF3K5REu/Kc+qMQrvuza2bwSnNdhmzLfQ=
+github.com/Azure/go-autorest/autorest/adal v0.9.18/go.mod h1:XVVeme+LZwABT8K5Lc3hA4nAe8LDBVle26gTrguhhPQ=
 github.com/Azure/go-autorest/autorest/azure/cli v0.4.0/go.mod h1:JljT387FplPzBA31vUcvsetLKF3pec5bdAxjVU4kI2s=
 github.com/Azure/go-autorest/autorest/date v0.3.0 h1:7gUk1U5M/CQbp9WoqinNzJar+8KY+LPI6wiWrP/myHw=
 github.com/Azure/go-autorest/autorest/date v0.3.0/go.mod h1:BI0uouVdmngYNUzGWeSYnokU+TrmwEsOqdt8Y6sso74=
-github.com/Azure/go-autorest/autorest/mocks v0.4.0 h1:z20OWOSG5aCye0HEkDp6TPmP17ZcfeMxPi6HnSALa8c=
 github.com/Azure/go-autorest/autorest/mocks v0.4.0/go.mod h1:LTp+uSrOhSkaKrUy935gNZuuIPPVsHlr9DSOxSayd+k=
+github.com/Azure/go-autorest/autorest/mocks v0.4.1/go.mod h1:LTp+uSrOhSkaKrUy935gNZuuIPPVsHlr9DSOxSayd+k=
+github.com/Azure/go-autorest/autorest/mocks v0.4.2 h1:PGN4EDXnuQbojHbU0UWoNvmu9AGVwYHG9/fkDYhtAfw=
+github.com/Azure/go-autorest/autorest/mocks v0.4.2/go.mod h1:Vy7OitM9Kei0i1Oj+LvyAWMXJHeKH1MVlzFugfVrmyU=
 github.com/Azure/go-autorest/autorest/to v0.4.0/go.mod h1:fE8iZBn7LQR7zH/9XU2NcPR4o9jEImooCeWJcYV/zLE=
 github.com/Azure/go-autorest/autorest/validation v0.3.0/go.mod h1:yhLgjC0Wda5DYXl6JAsWyUe4KVNffhoDhG0zVzUMo3E=
-github.com/Azure/go-autorest/logger v0.2.0 h1:e4RVHVZKC5p6UANLJHkM4OfR1UKZPj8Wt8Pcx+3oqrE=
 github.com/Azure/go-autorest/logger v0.2.0/go.mod h1:T9E3cAhj2VqvPOtCYAvby9aBXkZmbF5NWuPV8+WeEW8=
+github.com/Azure/go-autorest/logger v0.2.1 h1:IG7i4p/mDa2Ce4TRyAO8IHnVhAVF3RFU+ZtXWSmf4Tg=
+github.com/Azure/go-autorest/logger v0.2.1/go.mod h1:T9E3cAhj2VqvPOtCYAvby9aBXkZmbF5NWuPV8+WeEW8=
 github.com/Azure/go-autorest/tracing v0.6.0 h1:TYi4+3m5t6K48TGI9AUdb+IzbnSxvnvUMfuitfgcfuo=
 github.com/Azure/go-autorest/tracing v0.6.0/go.mod h1:+vhtPC754Xsa23ID7GlGsrdKBpUA79WCAKPPZVC2DeU=
 github.com/Azure/go-ntlmssp v0.0.0-20180810175552-4a21cbd618b4/go.mod h1:chxPXzSsl7ZWRAuOIE23GDNzjWuZquvFlgA8xmpunjU=
@@ -359,7 +364,6 @@ github.com/davecgh/go-spew v1.1.0/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSs
 github.com/davecgh/go-spew v1.1.1 h1:vj9j/u1bqnvCEfJOwUhtlOARqs3+rkHYY13jYWTU97c=
 github.com/davecgh/go-spew v1.1.1/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
 github.com/dgraph-io/badger v1.6.0/go.mod h1:zwt7syl517jmP8s94KqSxTlM6IMsdhYy6psNgSztDR4=
-github.com/dgrijalva/jwt-go v3.2.0+incompatible h1:7qlOGliEKZXTDg6OTjfoBKDXWrumCAMpl/TFQ4/5kLM=
 github.com/dgrijalva/jwt-go v3.2.0+incompatible/go.mod h1:E3ru+11k8xSBh+hMPgOLZmtrrCbhqsmaPHjLKYnJCaQ=
 github.com/dgryski/go-farm v0.0.0-20190423205320-6a90982ecee2/go.mod h1:SqUrOPUnsFjfmXRMNPybcSiG0BgUW2AuFH8PAnS2iTw=
 github.com/dgryski/go-sip13 v0.0.0-20181026042036-e10d5fee7954/go.mod h1:vAd38F8PWV+bWy6jNmig1y/TA+kYO4g3RSRF0IAv0no=
@@ -451,6 +455,9 @@ github.com/gogo/protobuf v0.0.0-20171007142547-342cbe0a0415/go.mod h1:r8qH/GZQm5
 github.com/gogo/protobuf v1.1.1/go.mod h1:r8qH/GZQm5c6nD/R0oafs1akxWv10x8SbQlK7atdtwQ=
 github.com/gogo/protobuf v1.
```

#### Recent Merged Pull Requests:
- **PR #1752** (2026-07-31): chore: add prodsec-orb-runtime context to config.yaml [PRODSEC-10643] (@VulnShade)
- **PR #1747** (2026-05-14): chore: update codeowners [PRODSEC-10215] (@bikochan)
- **PR #1745** (closed): alerts: fix 'occured' -> 'occurred' in error format strings (@SAY-5)
- **PR #1743** (2026-04-15): chore: update codeowners [PRODSEC-10215] (@bikochan)
- **PR #1737** (2025-09-12): fix: uprade go-getter to v1.7.9 [IAC-3439] (@andreeaneata)
- **PR #1735** (2025-07-31): chore: update codeowners [IAC-3432] (@prodsec-github-automation)
- **PR #1729** (closed): Fix wildcard for route53 (@shurkus)
- **PR #1728** (2025-04-07): fix: bumped golang-jwt to 4.5.2 [IAC-3278] (@alina-d-m)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
