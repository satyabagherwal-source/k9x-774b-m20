# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: koderover-zadig-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "koderover-zadig-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T23:13:42.748Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-koderover-zadig-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [koderover-zadig-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T23:13:42.748Z`  
> **Learning ID**: `LEARN-EVO-koderover-zadig-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: A (Human & Need Intelligence), I (Content & Information Intelligence), G (Architecture Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), K (Quality & Verification Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 69%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from koderover-zadig-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/koderover-zadig-learnings.md`  
> **Source**: github ([https://github.com/koderover/zadig](https://github.com/koderover/zadig))  
> **Source Version**: `2076e082`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T23:13:36.632Z  
> **Learning ID**: `learn-github-koderover-zadig`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): koderover/zadig

> **Canonical Artifact**: `07_PROJECT_LEARNING/koderover-zadig-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/koderover/zadig](https://github.com/koderover/zadig))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T23:13:36.627Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `koderover/zadig`
- **Description**: Zadig: An AI-powered, cloud-native, distributed DevOps platform designed for developers
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 3280 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/version-demo/utils/version.go`
```
package utils

import (
	"fmt"
	"runtime"
)

var (
	version      string
	gitBranch    string
	gitTag       string
	gitCommit    string
	gitPR        string
	gitTreeState string
	buildDate    string
	buildURL      string
)

// Info contains versioning information.
type Info struct {
	Version      string `json:"version"`
	GitBranch    string `json:"gitBranch"`
	GitTag       string `json:"gitTag"`
	GitCommit    string `json:"gitCommit"`
	GitPR        string `json:"gitPR"`
	GitTreeState string `json:"gitTreeState"`
	BuildDate    string `json:"buildDate"`
	BuildURL     string `json:"buildURL"`
	GoVersion    string `json:"goVersion"`
	Compiler     string `json:"compiler"`
	Platform     string `json:"platform"`
}

// String returns info as a human-friendly version string.
func (info Info) String() string {
	return info.Platform
}

func GetVersion() Info {
	return Info{
		Version:      version,
		GitBranch:    gitBranch,
		GitTag:       gitTag,
		GitCommit:    gitCommit,
		GitPR:        gitPR,
		GitTreeState: gitTreeState,
		BuildDate:    buildDate,
		BuildURL:     buildURL,
		GoVersion:    runtime.Version(),
		Compiler:     runtime.Compiler,
		Platform:     fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH),
	}
}

```

### Core Architecture Module: `pkg/cli/upgradeassistant/cmd/migrate/utils.go`
```
package migrate

import (
	"fmt"
	"reflect"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"

	internalmodels "github.com/koderover/zadig/v2/pkg/cli/upgradeassistant/internal/repository/models"
	"github.com/koderover/zadig/v2/pkg/cli/upgradeassistant/internal/repository/mongodb"
	internaldb "github.com/koderover/zadig/v2/pkg/cli/upgradeassistant/internal/repository/mongodb"
	"github.com/koderover/zadig/v2/pkg/tool/log"
)

// getMigrationInfo get the current migration status from the mongodb, if none exists, initialize one and return the
// initialized data.
// NOTE THAT THE INITIALIZATION FUNCTION NEEDS TO BE UPDATED TO AVOID DATA CORRUPTION
func getMigrationInfo() (*internalmodels.Migration, error) {
	migrationInfo, err := internaldb.NewMigrationColl().GetMigrationInfo()
	if err != nil {
		if err != mongo.ErrNoDocuments {
			return nil, fmt.Errorf("failed to get migration info from db, err: %s", err)
		} else {
			err := internaldb.NewMigrationColl().InitializeMigrationInfo()
			if err != nil {
				return nil, fmt.Errorf("failed to create migration info in db, err: %s", err)
			}
			createdInfo, err := internaldb.NewMigrationColl().GetMigrationInfo()
			if err != nil {
				return nil, fmt.Errorf("failed to get migration info from db, err: %s", err)
			}
			return createdInfo, nil
		}
	}
	return migrationInfo, nil
}

func getMigrationFieldBsonTag(migrationInst *internalmodels.Migration, fieldPtr interface{}) string {
	val := reflect.ValueOf(migrationInst).Elem()
	typ := val.Type()
	for i := 0; i < val.NumField(); i++ {
		field := val.Field(i)
		if field.Addr().Interface() == fieldPtr {
			return typ.Field(i).Tag.Get("bson")
		}
	}
	return ""
}

func updateMigrationError(migrationID primitive.ObjectID, err error) {
	if err != nil {
		err = mongodb.NewMigrationColl().UpdateMigrationError(migrationID, err.Error())
		if err != nil {
			log.Errorf("failed to update migration error: %s", err)
		}
	} else {
		err = mongodb.NewMigrationColl().UpdateMigrationError(migrationID, "")
		if err != nil {
			log.Errorf("failed to update migration error: %s", err)
		}
	}
}

```

### Core Architecture Module: `pkg/cli/upgradeassistant/internal/repository/models/renderset.go`
```
/*
Copyright 2022 The KodeRover Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package models

import templatemodels "github.com/koderover/zadig/v2/pkg/microservice/aslan/core/common/repository/models/template"

// RenderSet ...
type RenderSet struct {
	// Name = EnvName == "" ? ProductTmpl : (EnvName + "-" + ProductTempl)
	Name     string `bson:"name"                     json:"name"`
	Revision int64  `bson:"revision"                 json:"revision"`
	// 可以为空，空时为产品模板默认的渲染集，非空时为环境的渲染集
	EnvName     string `bson:"env_name,omitempty"             json:"env_name,omitempty"`
	ProductTmpl string `bson:"product_tmpl"                   json:"product_tmpl"`
	Team        string `bson:"team,omitempty"                 json:"team,omitempty"`
	UpdateTime  int64  `bson:"update_time"                    json:"update_time"`
	UpdateBy    string `bson:"update_by"                      json:"update_by"`
	IsDefault   bool   `bson:"is_default"                     json:"is_default"`
	// yaml content, used as 'global variables' for both k8s/helm projects
	DefaultValues    string                          `bson:"default_values,omitempty"       json:"default_values,omitempty"`
	YamlData         *templatemodels.CustomYaml      `bson:"yaml_data,omitempty"            json:"yaml_data,omitempty"`
	KVs              []*templatemodels.RenderKV      `bson:"kvs,omitempty"                  json:"kvs,omitempty"`               // deprecated since 1.16.0
	ServiceVariables []*templatemodels.ServiceRender `bson:"service_variables,omitempty"    json:"service_variables,omitempty"` // new since 1.16.0 replace kvs
	ChartInfos       []*templatemodels.ServiceRender `bson:"chart_infos,omitempty"          json:"chart_infos,omitempty"`
	Description      string                          `bson:"description,omitempty"          json:"description,omitempty"`
}

func (RenderSet) TableName() string {
	return "render_set"
}

```

### Core Architecture Module: `pkg/cli/upgradeassistant/internal/repository/mongodb/render_set.go`
```
/*
Copyright 2021 The KodeRover Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package mongodb

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/koderover/zadig/v2/pkg/cli/upgradeassistant/internal/repository/models"
	"github.com/koderover/zadig/v2/pkg/microservice/aslan/config"
	mongotool "github.com/koderover/zadig/v2/pkg/tool/mongo"
)

type RenderSetListOption struct {
	// if Revision == 0 then search max revision of RenderSet
	ProductTmpl   string
	Revisions     []int64
	RendersetName string
	FindOpts      []RenderSetFindOption
}

// RenderSetFindOption ...
type RenderSetFindOption struct {
	// if Revision == 0 then search max revision of RenderSet
	ProductTmpl       string
	EnvName           string
	IsDefault         bool
	Revision          int64
	Name              string
	YamlVariableSetID string
}

type RenderSetPipeResp struct {
	RenderSet struct {
		Name        string `bson:"name"                     json:"name"`
		ProductTmpl string `bson:"product_tmpl"             json:"product_tmpl"`
	} `bson:"_id"      json:"render_set"`
	Revision int64 `bson:"revision"     json:"revision"`
}

type RenderSetColl struct {
	*mongo.Collection

	coll string
}

func NewRenderSetColl() *RenderSetColl {
	name := models.RenderSet{}.TableName()
	return &RenderSetColl{Collection: mongotool.Database(config.MongoDatabase()).Collection(name), coll: name}
}

func (c *RenderSetColl) GetCollectionName() string {
	return c.coll
}

func (c *RenderSetColl) FindRenderSet(opt *RenderSetFindOption) (*models.RenderSet, bool, error) {
	res, err := c.Find(opt)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, false, nil
		}
		return nil, false, err
	}

	return res, true, nil
}

func (c *RenderSetColl) Find(opt *RenderSetFindOption) (*models.RenderSet, error) {
	if opt == nil {
		return nil, errors.New("RenderSetFindOption cannot be nil")
	}

	query := bson.M{"name": opt.Name}
	opts := options.FindOne()
	if opt.Revision > 0 {
		// revisionName + revision are enough to locate the target record
		// there is no need to set other query condition
		// Note. the query logic has been rolled back to 1.12.0
		query["revision"] = opt.Revision
	} else {
		opts.SetSort(bson.D{{"revision", -1}})

		if len(opt.EnvName) > 0 {
			query["env_name"] = opt.EnvName
		}

		if len(opt.ProductTmpl) > 0 {
			query["product_tmpl"] = opt.ProductTmpl
		}

		if opt.IsDefault {
			query["is_default"] = opt.IsDefault
		}
	}

	rs := &models.RenderSet{}
	err := c.FindOne(context.TODO(), query, opts).Decode(&rs)
	if err != nil {
		return nil, err
	}

	return rs, err
}

func (c *RenderSetColl) Update(args *models.RenderSet) error {
	query := bson.M{"name": args.Name, "revision": args.Revision}
	change := bson.M{"$set": bson.M{
		"chart_infos": args.ChartInfos,
		"update_time": time.Now().Unix(),
		"update_by":   args.UpdateBy,
		//"kvs":            args.KVs,
		"default_values": args.DefaultValues,
	}}

	_, err := c.UpdateOne(context.TODO(), query, change)

	return err
}

func (c *RenderSetColl) UpdateDefaultValues(renderSet *models.RenderSet) error {
	query := bson.M{"name": renderSet.Name, "revision": renderSet.Revision}
	change := bson.M{"$set": bson.M{
		"update_time":    time.Now().Unix(),
		"update_by":      "ua",
		"default_values": renderSet.DefaultValues,
	}}
	_, err := c.UpdateOne(context.TODO(), query, change)
	return err
}

```

### Core Architecture Module: `pkg/cli/upgradeassistant/internal/rotation/webhook.go`
```
package rotation

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	githubapi "github.com/google/go-github/v35/github"
	common "github.com/koderover/zadig/v2/pkg/microservice/aslan/core/common/repository/models"
	codehost "github.com/koderover/zadig/v2/pkg/microservice/systemconfig/core/codehost/repository/models"
	"github.com/koderover/zadig/v2/pkg/setting"
	"github.com/koderover/zadig/v2/pkg/tool/git"
	githubtool "github.com/koderover/zadig/v2/pkg/tool/git/github"
	gitlabtool "github.com/koderover/zadig/v2/pkg/tool/git/gitlab"
	giteetool "github.com/koderover/zadig/v2/pkg/tool/gitee"
	"github.com/koderover/zadig/v2/pkg/tool/httpclient"
	gitlabapi "github.com/xanzy/go-gitlab"
)

const webhookRequestTimeout = 30 * time.Second

func prepareHookForHosts(ctx context.Context, hook *common.WebHook, hosts []*codehost.CodeHost, proxy string, allowOrphans bool) (*hookAction, error) {
	var failures []string
	for _, host := range hosts {
		if strings.TrimRight(host.Address, "/") != strings.TrimRight(hook.Address, "/") {
			continue
		}
		action, err := prepareHook(ctx, hook, host, proxy)
		if err == nil {
			return action, nil
		}
		failures = append(failures, err.Error())
	}
	if len(failures) == 0 {
		if allowOrphans {
			return nil, nil
		}
		return nil, fmt.Errorf("webhook %s/%s hook %s: no matching code host; use --allow-orphan-webhooks only after arranging manual rotation", hook.Owner, hook.Repo, hook.HookID)
	}
	return nil, fmt.Errorf("webhook %s/%s hook %s: no code host can read hook: %s", hook.Owner, hook.Repo, hook.HookID, strings.Join(failures, "; "))
}

type hookAction struct {
	hook    *common.WebHook
	host    *codehost.CodeHost
	refresh func(ctx context.Context, secret, callbackURL string) error
}

func (a *hookAction) failure(operation string, err error) error {
	// Never print SDK response bodies: they may contain credentials or the new secret.
	reason := "request failed; verify connectivity and token permissions"
	var gh *githubapi.ErrorResponse
	var gl *gitlabapi.ErrorResponse
	var response *httpclient.Error
	switch {
	case errors.Is(err, context.Canceled):
		reason = "request canceled"
	case errors.Is(err, context.DeadlineExceeded):
		reason = "request timed out"
	case errors.As(err, &gh) && gh.Response != nil:
		reason = fmt.Sprintf("HTTP %d", gh.Response.StatusCode)
	case errors.As(err, &gl) && gl.Response != nil:
		reason = fmt.Sprintf("HTTP %d", gl.Response.StatusCode)
	case errors.As(err, &response):
		reason = fmt.Sprintf("HTTP %d", response.Code)
	}
	return fmt.Errorf("webhook %s/%s, code host %d(%s), hook %s: %s: %s", a.hook.Owner, a.hook.Repo, a.host.ID, a.host.Alias, a.hook.HookID, operation, reason)
}

func prepareHook(ctx context.Context, hook *common.WebHook, host *codehost.CodeHost, proxy string) (*hookAction, error) {
	a := &hookAction{hook: hook, host: host}
	if host.AccessToken == "" {
		return nil, fmt.Errorf("code host %d(%s) has no access token", host.ID, host.Alias)
	}
	if host.EnableProxy {
		p, err := url.Parse(proxy)
		if err != nil || p.Scheme == "" || p.Host == "" {
			return nil, fmt.Errorf("code host %d(%s): enabled proxy has no valid URL", host.ID, host.Alias)
		}
	}
	id, err := strconv.ParseInt(hook.HookID, 10, 64)
	if err != nil || id <= 0 {
		return nil, fmt.Errorf("webhook %s/%s, code host %d(%s): invalid hook ID", hook.Owner, hook.Repo, host.ID, host.Alias)
	}
	ctx, cancel := context.WithTimeout(ctx, webhookRequestTimeout)
	defer cancel()
	// Static clients never refresh OAuth tokens or write codehost state during dry-run.
	switch host.Type {
	case setting.SourceFromGithub:
		cfg := &githubtool.Config{AccessToken: host.AccessToken}
		if host.EnableProxy {
			cfg.Proxy = proxy
		}
		c := githubtool.NewClient(cfg)
		_, _, err = c.Repositories.GetHook(ctx, hook.Owner, hook.Repo, id)
		a.refresh = func(ctx context.Context, secret, callbackURL string) error {
			_, err := c.UpdateHook(ctx, hook.Owner, hook.Repo, id, &git.Hook{URL: callbackURL, Secret: secret})
			return err
		}
	case setting.SourceFromGitlab:
		c, clientErr := gitlabtool.NewOAuthTokenClient(host.Address, host.AccessToken, proxy, host.EnableProxy, host.DisableSSL)
		if clientErr != nil {
			return nil, a.failure("create client", clientErr)
		}
		_, _, err = c.Projects.GetProjectHook(hook.Owner+"/"+hook.Repo, int(id), gitlabapi.WithContext(ctx))
		a.refresh = func(ctx context.Context, secret, callbackURL string) error {
			_, _, err := c.Projects.EditProjectHook(hook.Owner+"/"+hook.Repo, int(id), &gitlabapi.EditProjectHookOptions{
				URL: gitlabapi.String(callbackURL), Token: gitlabapi.String(secret),
			}, gitlabapi.WithContext(ctx))
			return err
		}
	case setting.SourceFromGitee, setting.SourceFromGiteeEE:
		if id > math.MaxInt32 {
			return nil, fmt.Errorf("webhook %s/%s, code host %d(%s): hook ID exceeds Gitee API range", hook.Owner, hook.Repo, host.ID, host.Alias)
		}
		c := giteetool.NewStaticClient(strings.TrimRight(host.Address, "/"), host.AccessToken, proxy, host.EnableProxy)
		_, resp, requestErr := c.WebhooksApi.GetV5ReposOwnerRepoHooksId(ctx, hook.Owner, hook.Repo, int32(id), nil)
		err = requestErr
		if err != nil && resp != nil && resp.StatusCode >= 300 {
			err = httpclient.NewGenericServerResponse(resp.StatusCode, http.MethodGet, "")
		}
		a.refresh = func(ctx context.Context, secret, callbackURL string) error {
			return c.UpdateHookSecret(ctx, hook.Owner, hook.Repo, id, &git.Hook{URL: callbackURL, Secret: secret})
		}
	default:
		return nil, fmt.Errorf("code host %d(%s): unsupported provider %s", host.ID, host.Alias, host.Type)
	}
	if err != nil {
		return nil, a.failure("read remote hook", err)
	}
	return a, nil
}

```

### Core Architecture Module: `pkg/cli/zadig-agent/util/client/client.go`
```
/*
Copyright 2023 The KodeRover Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package httpclient

import (
	"bytes"
	"crypto/tls"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/koderover/zadig/v2/pkg/cli/zadig-agent/helper/log"
	"k8s.io/apimachinery/pkg/util/sets"
)

const (
	UserAgent      = "Zadig Agent REST Client"
	TimeoutSeconds = 60
)

type Client struct {
	*resty.Client

	Host        string   // Host is the fully qualified domain name of the system, or an IP Address. Port and protocol are required if necessary.
	BaseURI     string   // BaseURI is the base uri for every request, starting with a slash, for example: /api/v1
	IgnoreCodes sets.Int // IgnoreCodes ignores some code to be returned as an error.
}

func Get(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return New().Get(url, rfs...)
}

func Post(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return New().Post(url, rfs...)
}

func Patch(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return New().Patch(url, rfs...)
}

func Put(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return New().Put(url, rfs...)
}

func Delete(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return New().Delete(url, rfs...)
}

func Head(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return New().Head(url, rfs...)
}

func Options(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return New().Options(url, rfs...)
}

// Download retrieves content from the given url and write it to path.
func Download(url, path string, rfs ...RequestFunc) error {
	// download may take more time
	cl := New(UnsetTimeout())
	res, err := cl.Get(url, rfs...)
	if err != nil {
		return err
	}

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer func() {
		_ = f.Close()
	}()

	_, err = io.Copy(f, bytes.NewReader(res.Body()))

	return err
}

// New TODO: need to config tls security
func New(cfs ...ClientFunc) *Client {
	r := resty.New()
	r.SetTransport(&http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	})
	r.SetHeader("Content-Type", "application/json").
		SetHeader("Accept", "application/json").
		SetHeader("User-Agent", UserAgent).
		SetTimeout(TimeoutSeconds * time.Second).
		SetLogger(log.SugaredLogger())

	c := &Client{
		Client:      r,
		IgnoreCodes: sets.NewInt(),
	}

	for _, cf := range cfs {
		cf(c)
	}

	return c
}

func (c *Client) Get(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return c.Request(resty.MethodGet, url, rfs...)
}

func (c *Client) Post(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return c.Request(resty.MethodPost, url, rfs...)
}

func (c *Client) Patch(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return c.Request(resty.MethodPatch, url, rfs...)
}

func (c *Client) Put(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return c.Request(resty.MethodPut, url, rfs...)
}

func (c *Client) Delete(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return c.Request(resty.MethodDelete, url, rfs...)
}

func (c *Client) Head(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return c.Request(resty.MethodHead, url, rfs...)
}

func (c *Client) Options(url string, rfs ...RequestFunc) (*resty.Response, error) {
	return c.Request(resty.MethodOptions, url, rfs...)
}

func (c *Client) Request(method, url string, rfs ...RequestFunc) (*resty.Response, error) {
	if c.BaseURI != "" {
		url = c.BaseURI + url
	}
	r := c.R()

	for _, rf := range rfs {
		rf(r)
	}

	return c.wrapError(r.Execute(method, url))
}

func (c *Client) wrapError(res *resty.Response, err error) (*resty.Response, error) {
	if err != nil {
		return res, err
	}

	if res.IsError() && !c.IgnoreCodes.Has(res.StatusCode()) {
		return res, NewErrorFromRestyResponse(res)
	}

	return res, nil
}

```

### Core Architecture Module: `pkg/cli/zadig-agent/util/client/client_options.go`
```
/*
Copyright 2023 The KodeRover Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package httpclient

import (
	"crypto/tls"
	"time"
)

type ClientFunc func(*Client)

func SetBasicAuth(username, password string) ClientFunc {
	return func(c *Client) {
		c.Client.SetBasicAuth(username, password)
	}
}

func SetAuthScheme(scheme string) ClientFunc {
	return func(c *Client) {
		c.Client.SetAuthScheme(scheme)
	}
}

func SetAuthToken(token string) ClientFunc {
	return func(c *Client) {
		c.Client.SetAuthToken(token)
	}
}

func SetBaseURI(uri string) ClientFunc {
	return func(c *Client) {
		c.BaseURI = uri
	}
}

func SetHostURL(url string) ClientFunc {
	return func(c *Client) {
		c.Client.SetHostURL(url)
		c.Host = url
	}
}

func SetProxy(proxyURL string) ClientFunc {
	return func(c *Client) {
		c.Client.SetProxy(proxyURL)
	}
}

func UnsetTimeout() ClientFunc {
	return func(c *Client) {
		c.Client.SetTimeout(0)
	}
}

func SetIgnoreCodes(codes ...int) ClientFunc {
	return func(c *Client) {
		c.IgnoreCodes.Insert(codes...)
	}
}

func SetRetryCount(count int) ClientFunc {
	return func(c *Client) {
		c.Client.SetRetryCount(count)
	}
}

func SetRetryWaitTime(waitTime time.Duration) ClientFunc {
	return func(c *Client) {
		c.Client.SetRetryWaitTime(waitTime)
	}
}

func SetTLSClientConfig(config *tls.Config) ClientFunc {
	return func(c *Client) {
		c.Client.SetTLSClientConfig(config)
	}
}

func SetClientHeader(header, value string) ClientFunc {
	return func(c *Client) {
		c.Client.SetHeader(header, value)
	}
}

```

### Core Architecture Module: `pkg/cli/zadig-agent/util/client/errors.go`
```
/*
Copyright 2023 The KodeRover Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package httpclient

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/go-resty/resty/v2"
)

// StatusReason is an enumeration of possible failure causes.  Each StatusReason
// must map to a single HTTP status code, but multiple reasons may map
// to the same HTTP status code.
type StatusReason string

const (
	// StatusReasonUnknown means the server has declined to indicate a specific reason.
	StatusReasonUnknown StatusReason = ""

	// StatusReasonBadRequest means that the request itself was invalid, because the request
	// doesn't make any sense, for example deleting a read-only object.  This is different than
	// StatusReasonInvalid above which indicates that the API call could possibly succeed, but the
	// data was invalid.  API calls that return BadRequest can never succeed.
	// Status code 400
	StatusReasonBadRequest StatusReason = "BadRequest"

	// StatusReasonUnauthorized means the server can be reached and understood the request, but requires
	// the user to present appropriate authorization credentials (identified by the WWW-Authenticate header)
	// in order for the action to be completed. If the user has specified credentials on the request, the
	// server considers them insufficient.
	// Status code 401
	StatusReasonUnauthorized StatusReason = "Unauthorized"

	// StatusReasonForbidden means the server can be reached and understood the request, but refuses
	// to take any further action.  It is the result of the server being configured to deny access for some reason
	// to the requested resource by the client.
	// Status code 403
	StatusReasonForbidden StatusReason = "Forbidden"

	// StatusReasonNotFound means one or more resources required for this operation
	// could not be found.
	// Status code 404
	StatusReasonNotFound StatusReason = "NotFound"

	// StatusReasonMethodNotAllowed means that the action the client attempted to perform on the
	// resource was not supported by the code - for instance, attempting to delete a resource that
	// can only be created. API calls that return MethodNotAllowed can never succeed.
	// Status code 405
	StatusReasonMethodNotAllowed StatusReason = "MethodNotAllowed"

	// StatusReasonNotAcceptable means that the accept types indicated by the client were not acceptable
	// to the server - for instance, attempting to receive protobuf for a resource that supports only json and yaml.
	// API calls that return NotAcceptable can never succeed.
	// Status code 406
	StatusReasonNotAcceptable StatusReason = "NotAcceptable"

	// StatusReasonAlreadyExists means the resource you are creating already exists.
	// Status code 409
	StatusReasonAlreadyExists StatusReason = "AlreadyExists"

	// StatusReasonConflict means the requested operation cannot be completed
	// due to a conflict in the operation. The client may need to alter the
	// request. Each resource may define custom details that indicate the
	// nature of the conflict.
	// Status code 409
	StatusReasonConflict StatusReason = "Conflict"

	// StatusReasonGone means the item is no longer available at the server and no
	// forwarding address is known.
	// Status code 410
	StatusReasonGone StatusReason = "Gone"

	// StatusReasonUnsupportedMediaType means that the content type sent by the client is not acceptable
	// to the server - for instance, attempting to send protobuf for a resource that supports only json and yaml.
	// API calls that return UnsupportedMediaType can never succeed.
	// Status code 415
	StatusReasonUnsupportedMediaType StatusReason = "UnsupportedMediaType"

	// StatusReasonInvalid means the requested create or update operation cannot be
	// completed due to invalid data provided as part of the request. The client may
	// need to alter the request.
	// Status code 422
	StatusReasonInvalid StatusReason = "Invalid"

	// StatusReasonTooManyRequests means the server experienced too many requests within a
	// given window and that the client must wait to perform the action again. A client may
	// always retry the request that led to this error, although the client should wait at least
	// the number of seconds specified by the retryAfterSeconds field.
	// Status code 429
	StatusReasonTooManyRequests StatusReason = "TooManyRequests"

	// StatusReasonInternalError indicates that an internal error occurred, it is unexpected
	// and the outcome of the call is unknown.
	// Status code 500
	StatusReasonInternalError StatusReason = "InternalError"

	// StatusReasonServiceUnavailable means that the request itself was valid,
	// but the requested service is unavailable at this time.
	// Retrying the request after some time might succeed.
	// Status code 503
	StatusReasonServiceUnavailable StatusReason = "ServiceUnavailable"
)

type httpStatus interface {
	Status() StatusReason
}

type Error struct {
	Code      int
	ErrStatus StatusReason
	Message   string
	Detail    string
}

func (e *Error) Error() string {
	return fmt.Sprintf("[%d %s] %s", e.Code, e.ErrStatus, e.Detail)
}

func (e *Error) Status() StatusReason {
	return e.ErrStatus
}

var _ error = &Error{}
var _ httpStatus = &Error{}

func IsNotFound(err error) bool {
	return ReasonForError(err) == StatusReasonNotFound
}

func ReasonForError(err error) StatusReason {
	if status := httpStatus(nil); errors.As(err, &status) {
		return status.Status()
	}
	return StatusReasonUnknown
}

func NewErrorFromRestyResponse(res *resty.Response) *Error {
	return NewGenericServerResponse(res.StatusCode(), res.Request.Method, res.String())
}

// NewGenericServerResponse returns a new error for server responses.
func NewGenericServerResponse(code int, method string, detail string) *Error {
	reason := StatusReasonUnknown
	message := fmt.Sprintf("the server responded with the status code %d but did not return more information", code)
	switch code {
	case http.StatusConflict:
		if method == resty.MethodPost {
			reason = StatusReasonAlreadyExists
		} else {
			reason = StatusReasonConflict
		}
		message = "the server reported a conflict"
	case http.StatusNotFound:
		reason = StatusReasonNotFound
		message = "the server could not find the requested resource"
	case http.StatusBadRequest:
		reason = StatusReasonBadRequest
		message = "the server rejected our request for an unknown reason"
	case http.StatusUnauthorized:
		reason = StatusReasonUnauthorized
		message = "the server has asked for the client to provide credentials"
	case http.StatusForbidden:
		reason = StatusReasonForbidden
		// the server message has details about who is trying to perform what action.  Keep its message.
		message = detail
	case http.StatusNotAcceptable:
		reason = StatusReasonNotAcceptable
		// the server message has details about what types are acceptable
		if len(detail) == 0 || detail == "unknown" {
			message = "the server was unable to respond with a content type that the client supports"
		} else {
			message = detail
		}
	case http.StatusUnsupportedMediaType:
		reason = StatusReasonUnsupportedMediaType
		// the server message has details about what types are acceptable
		message = detail
	case http.StatusMethodNotAllowed:
		reason = StatusReasonMethodNotAllowed
		message = "the server does not allow this method on the requested resource"
	case http.StatusUnprocessableEntity:
		reason = StatusReasonInvalid
		message = "the server rejected our request due to an error in our request"
	case http.StatusServiceUnavailable:
		reason = StatusReasonServiceUnavailable
		message = "the server is currently unable to handle the request"
	case http.StatusTooManyRequests:
		reason = StatusReasonTooManyRequests
		message = "the server has received too many requests and has asked us to try again later"
	default:
		if code >= 500 {
			reason = StatusReasonInternalError
			message = "an error on the server has prevented the request from succeeding"
		}
	}

	return &Error{
		Code:      code,
		ErrStatus: reason,
		Message:   message,
		Detail:    detail,
	}
}

```

### Core Architecture Module: `pkg/cli/zadig-agent/util/client/request_options.go`
```
/*
Copyright 2023 The KodeRover Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package httpclient

import (
	"net/http"
	"net/url"

	"github.com/go-resty/resty/v2"
)

type RequestFunc func(request *resty.Request)

func SetResult(res interface{}) RequestFunc {
	return func(r *resty.Request) {
		r.SetResult(res)
	}
}

func SetBody(body interface{}) RequestFunc {
	return func(r *resty.Request) {
		r.SetBody(body)
	}
}

func SetHeader(header, value string) RequestFunc {
	return func(r *resty.Request) {
		r.SetHeader(header, value)
	}
}

func SetHeaders(headers map[string]string) RequestFunc {
	return func(r *resty.Request) {
		r.SetHeaders(headers)
	}
}

func SetHeadersFromHTTPHeader(header http.Header) RequestFunc {
	return func(r *resty.Request) {
		r.Header = header
	}
}

func SetQueryParamsFromValues(params url.Values) RequestFunc {
	return func(r *resty.Request) {
		r.SetQueryParamsFromValues(params)
	}
}

func SetQueryParams(params map[string]string) RequestFunc {
	return func(r *resty.Request) {
		r.SetQueryParams(params)
	}
}

func SetQueryParam(param, value string) RequestFunc {
	return func(r *resty.Request) {
		r.SetQueryParam(param, value)
	}
}

func ForceContentType(contentType string) RequestFunc {
	return func(r *resty.Request) {
		r.ForceContentType(contentType)
	}
}

func SetFormData(data map[string]string) RequestFunc {
	return func(r *resty.Request) {
		r.SetFormData(data)
	}
}

```

### Core Architecture Module: `pkg/cli/zadig-agent/util/dir.go`
```
package util

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func DeleteSubdirectories(rootDir string) error {
	// get all subdirectories under the root directory
	subDirs, err := getSubdirectories(rootDir)
	if err != nil {
		return fmt.Errorf("Error getting subdirectories: %v", err)
	}

	// delte all sub dir
	for _, subDir := range subDirs {
		err := os.RemoveAll(subDir)
		if err != nil {
			return fmt.Errorf("Error deleting %s: %v", subDir, err)
		} else {
			fmt.Printf("Deleted %s\n", subDir)
		}
	}
	return nil
}

// Get all subdirectories under the specified directory
func getSubdirectories(rootDir string) ([]string, error) {
	var subDirs []string

	err := filepath.Walk(rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() && path != rootDir {
			subDirs = append(subDirs, path)
		}
		return nil
	})

	return subDirs, err
}

func DeletePathToRoot(rootDir, subDir string) error {
	// Ensure that the subdirectory is a subdirectory of the root directory
	if !isSubdirectory(rootDir, subDir) {
		return fmt.Errorf("The subdirectory is not a subdirectory of the root directory.")
	}

	// Delete recursively starting from the subdirectory and moving up to the root directory
	for subDir != rootDir {
		err := os.RemoveAll(subDir)
		if err != nil {
			return fmt.Errorf("Error deleting %s: %v\n", subDir, err)
		}
		subDir = filepath.Dir(subDir)
	}
	return nil
}

// Check if a directory is a subdirectory of another directory
func isSubdirectory(rootDir, subDir string) bool {
	rel, err := filepath.Rel(rootDir, subDir)
	if err != nil {
		return false
	}
	return !strings.HasPrefix(rel, "..") && !strings.HasPrefix(rel, ".")
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5118** (2026-11-20): **fix: correct zadig sub components.**
  *Symptoms*: ### What this PR does / Why we need it:   fix: correct zadig sub components.   ### Does this PR introduce a user-facing change?  - [ ] API change - [ ] database schema change - [ ] upgrade assistant change   - [ ] change in non-functional attributes such as efficiency or availability - [ ] fix of a previous issue  <!-- Reviewable:start --> - - - This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/koderover/zadig/5118) <!-- Reviewable:end --> 

- **Issue #5117** (2026-11-20): **fix: correct zadig sub components.**
  *Symptoms*: ### What this PR does / Why we need it:   ### What is changed and how it works?   ### Does this PR introduce a user-facing change?  - [ ] API change - [ ] database schema change - [ ] upgrade assistant change   - [ ] change in non-functional attributes such as efficiency or availability - [ ] fix of a previous issue  <!-- Reviewable:start --> - - - This change is [<img src="https://reviewable.io/review_button.svg" height="34" align="absmiddle" alt="Reviewable"/>](https://reviewable.io/reviews/koderover/zadig/5117) <!-- Reviewable:end --> 

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

### Incident Patch 1: `ded50e02` (2026-11-20)
**Commit Message**: fix: avoid panic on GitHub push events from GitHub Apps (#5114)

Signed-off-by: huanghongbo-hhb <[REDACTED_EMAIL]>

**File**: `pkg/microservice/aslan/core/workflow/service/webhook/github.go` (modified, +2/-2)
```diff
@@ -327,8 +327,8 @@ func ProcessGithubWebHook(payload []byte, req *http.Request, requestID string, l
 		if et.Pusher != nil {
 			webhookUser := &commonmodels.WebHookUser{
 				Domain:    req.Header.Get("X-Forwarded-Host"),
-				UserName:  *et.Pusher.Name,
-				Email:     *et.Pusher.Email,
+				UserName:  et.Pusher.GetName(),
+				Email:     et.Pusher.GetEmail(),
 				Source:    setting.SourceFromGithub,
 				CreatedAt: time.Now().Unix(),
 			}
```

**File**: `pkg/microservice/aslan/core/workflow/service/webhook/github_workflow_task.go` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ func (gpem *githubPushEventMatcher) Match(hookRepo *commonmodels.MainHookRepo) (
 		return false, nil
 	}
 	hookRepo.Branch = branch
-	hookRepo.Committer = *ev.Pusher.Name
+	hookRepo.Committer = ev.Pusher.GetName()
 	var changedFiles []string
 	for _, commit := range ev.Commits {
 		changedFiles = append(changedFiles, commit.Added...)
```

**File**: `pkg/microservice/aslan/core/workflow/service/webhook/github_workflowv4_task.go` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ func (gpem *githubPushEventMatcheForWorkflowV4) Match(hookRepo *commonmodels.Mai
 		return false, nil
 	}
 	hookRepo.Branch = branch
-	hookRepo.Committer = *ev.Pusher.Name
+	hookRepo.Committer = ev.Pusher.GetName()
 	var changedFiles []string
 	for _, commit := range ev.Commits {
 		changedFiles = append(changedFiles, commit.Added...)
```

---

### Incident Patch 2: `2076e082` (2026-11-20)
**Commit Message**: fix: correct zadig sub components. (#5117)

Signed-off-by: leozhang2018 <[REDACTED_EMAIL]>

**File**: `LICENSE` (modified, +0/-7)
```diff
@@ -230,10 +230,3 @@ The Zadig project contains subcomponents with separate copyright
 notices and license terms. Your use of the source code for the these
 subcomponents is subject to the terms and conditions of the following
 licenses.
-
-
-==============================================================================
-For k8sgpt:
-==============================================================================
-This product bundles k8sgpt, which is licensed under the Apache License 2.0
-https://github.com/k8sgpt-ai/k8sgpt/blob/main/LICENSE.
\ No newline at end of file
```

---

### Incident Patch 3: `60b1811d` (2026-11-20)
**Commit Message**: fix(halman): resolve cluster IDs before environment creation (#5109)

* fix(halman): resolve cluster IDs before environment creation

Signed-off-by: Patrick Zhao <[REDACTED_EMAIL]>

* fix(halman): streamline onboarding continuation and handle model timeouts

Signed-off-by: Patrick Zhao <[REDACTED_EMAIL]>

* fix(halman): avoid redundant onboarding lookups

Signed-off-by: Patrick Zhao <[REDACTED_EMAIL]>

* fix(halman): require build intent before onboarding confirmation

Signed-off-by: Patrick Zhao <[REDACTED_EMAIL]>

* fix(aslan): make AI assistant stats database limits configurable

Signed-off-by: Patrick Zhao <[REDACTED_EMAIL]>

* fix(halman): extend assistant run timeout to ten minutes

Signed-off-by: Patrick Zhao <[REDACTED_EMAIL]>

* fix(halman): restore onboarding using root execution status

Signed-off-by: Patrick Zhao <[REDACTED_EMAIL]>

* fix(halman): cancel expired confirmation plans

Signed-off-by: Patrick Zhao <[REDACTED_EMAIL]>

* fix(halman): distinguish unverified results when deleting conversations

Signed-off-by: Patrick Zhao <[REDACTED_EMAIL]>

* fix(halman): show deletion-specific error text

Signed-off-by: Patrick Zhao <[REDACTED_EMAIL]>

* fix(halman): allow del

**File**: `community/rfc/2026-10-28-zadig-ai-assistant-design.md` (modified, +4/-4)
```diff
@@ -602,12 +602,12 @@ AI 使用自己的连接池，不调整 user 服务的连接池，也不对共
 | 每个 halman 实例 MySQL 连接总上限 | 50，环境变量 `HALMAN_DB_MAX_CONNECTIONS` |
 | 每个 halman 实例 MySQL 空闲连接总上限 | 默认 10，每池最多 5，且不超过各自上限 |
 | 满载时短等待上限 | 默认 2 秒，环境变量 `HALMAN_ADMISSION_WAIT_TIMEOUT` |
-| 每个 aslan 实例报表 SQL 并发及连接上限 | 3，独立只读连接池；空闲上限为 1 |
+| 每个 aslan 实例报表 SQL 并发及连接上限 | 默认 5，环境变量 `ASLAN_AI_ASSISTANT_STATS_DB_MAX_CONNECTIONS`，空闲上限为 1 |
 | 清理工作者 | 1 |
 
 halman 的 Session 和业务 DAO 使用独立受限连接池，合计不得超过 `HALMAN_DB_MAX_CONNECTIONS`，默认 50。业务池取总预算的六成向下取整，框架池取剩余部分，默认分别为 30 和 20；各池空闲连接上限为 5，且不超过各自连接上限。日聚合写入、历史清理及框架存储复用这两个连接池，不另建池。配置读取复用现有 MongoDB 初始化和驱动连接池，不计入 MySQL 预算。
 
-报表读取位于 aslan，使用第 10 节定义的独立只读连接池，每个 aslan 实例最多三个连接，不包含在 halman 的 50 个连接中。第一期 halman 固定单副本，AI 功能新增的 MySQL 连接上限为 `HALMAN_DB_MAX_CONNECTIONS + 3 × aslan 副本数`；例如两个 aslan 副本时，默认新增上限为 56。该值不包含 user、dex 等已有连接池，应与现有服务连接预算一起评估共享实例容量。
+报表读取位于 aslan，使用第 10 节定义的独立只读连接池。第一期 halman 固定单副本，AI 功能新增的 MySQL 连接上限为 `HALMAN_DB_MAX_CONNECTIONS + ASLAN_AI_ASSISTANT_STATS_DB_MAX_CONNECTIONS × aslan 副本数`。例如两个 aslan 副本时，默认新增上限为 60。该值不包含 user、dex 等已有连接池，应与现有服务连接预算一起评估共享实例容量。
 
 第一期使用 `Recreate`，不产生滚动升级的重叠副本。
 
@@ -679,7 +679,7 @@ halman 在清理周期的结构化日志中输出当前进程的清理尝试、
 
 对外统计接口统一放在 aslan `stat/v2`：四个独立 GET 接口 `/overview`、`/trends`、`/skills`、`/rankings`（公共前缀 `/api/aslan/stat/v2/ai_assistant`），Swagger tag 为 `stat`。aslan 在入口校验当前登录用户为系统管理员或具有查看 AI 助手报告权限，并检查有效企业版许可证，通过 `stat/service`、`stat/repository/orm` 直接查询 `zadig_ai.ai_usage_daily` 并计算指标。AI 关闭、模型未配置或 halman 停机时仍可查询已有日聚合。删除 halman 的报告查询实现和内部 HTTP 接口；halman 仍是日聚合写入、建表和过期清理的唯一维护方。
 
-aslan 复用 `MYSQL_HOST`、`MYSQL_USER`、`MYSQL_PASSWORD`，首次统计查询时创建独立 GORM 连接池，每个 aslan 实例最多三个连接、空闲一个，连接最长存活五分钟；只执行 SELECT，不探测连通性、不建库、不建表、不运行迁移。移除报告互斥锁，由连接池控制最多三个并行 SQL 查询，其余查询在池内等待；等待连接和执行查询共用三秒预算，超时返回 HTTP 400/code 7212；数据库配置缺失、不可达或聚合表尚未初始化时只使统计接口返回 HTTP 400/code 7212，不阻止 aslan 启动及其他接口。部署需为 aslan 注入上述现有 MySQL 配置，并与 halman 使用相同 `TZ`（示例为 `Asia/Shanghai`），按 aslan 副本数累计连接预算。小连接池不隔离共享 MySQL 的 CPU、磁盘压力，仍需保持日期范围限制和查询限流。
+aslan 复用 `MYSQL_HOST`、`MYSQL_USER`、`MYSQL_PASSWORD`，首次统计查询时创建独立 GORM 连接池。每个副本的连接上限由 `ASLAN_AI_ASSISTANT_STATS_DB_MAX_CONNECTIONS` 配置（默认 5），最多保留一个空闲连接，连接最长存活五分钟。统计只执行 SELECT，不探测连通性、不建库、不建表、不运行迁移。超出连接上限的查询在池内等待。连接池等待、SQL 和 user 查询共用 `ASLAN_AI_ASSISTANT_STATS_TIMEOUT` 预算（默认 `10s`），MySQL 驱动连接、读和写超时使用相同配置。空值或无效值回退到默认值。超时、数据库配置缺失、不可达或聚合表尚未初始化时，统计接口返回 HTTP 400 和错误码 7212，aslan 启动及其他接口仍可用。部署需为 aslan 注入上述现有 MySQL 配置，与 halman 使用相同 `TZ`（例如 `Asia/Shanghai`），并按 aslan 副本数累加连接预算。连接池上限只约束连接数量，仍需通过日期范围和查询限流控制共享 MySQL 的 CPU 和磁盘压力。
 
 业务报告移除 `maintenance`、`business_database_pool`；halman 的清理进度、积压和连接池状态继续写入清理周期的结构化日志，不通过产品报告查询。
 
@@ -689,7 +689,7 @@ aslan 复用 `MYSQL_HOST`、`MYSQL_USER`、`MYSQL_PASSWORD`，首次统计查询
 
 所有报告指标增加 `total_tokens` 和 `model_usage[]`，后者包含 `model_id`、`model`、`input_tokens`、`output_tokens`、`total_tokens`，按模型集成 ID 和调用时的模型名排序，无数据返回 `[]`。`ai_usage_daily` 主键扩展为 `(date, user_id, skill_id, model_id, model_name)`；调用次数、耗时及 Token 从该次 `ai_run` 的模型快照写入对应模型行，任务终态、完成耗时和反馈继续写入空模型维度。修正任务贡献时仅更新空模型行，汇总时跨模型求和并对用户去重，不能按模型重复计算任务数。模型信息随日聚合保留三百六十五天，不依赖已到期的运行记录或当前模型配置，不增加表。
 
-概览 `total_users` 通过现有 user SDK 查询系统当前用户总数，与 `metrics.active_users` 配合计算团队渗透率；它是当前用户数，不是上期历史用户数。排行批量查询最多二十名用户的当前名称，返回 `user_name`；已删除或名称为空的用户回退为 `user_id`。user 查询失败返回统计失败，不能把系统用户总数默认为零或将查询故障当成用户已删除。SQL、连接等待与 user 查询共用三秒请求预算。分类和排行的模型明细仅查询报告实际返回的分组。
+概览 `total_users` 通过现有 user SDK 查询系统当前用户总数，与 `metrics.active_users` 配合计算团队渗透率；它是当前用户数，不是上期历史用户数。排行批量查询最多二十名用户的当前名称，返回 `user_name`；已删除或名称为空的用户回退为 `user_id`。user 查询失败返回统计失败，不能把系统用户总数默认为零或将查询故障当成用户已删除。分类和排行的模型明细仅查询报告实际返回的分组。
 
 
 Skill 分类在 SQL 中通过 `ai_usage_daily.skill_id=ai_skill.id` 关联分类汇总，不再硬编码 Skill ID 映射：`workflow_diagnosis`、`service_diagnosis` 归入故障排查，`project_onboarding`、`service_onboarding` 归入实施辅助；`environment_inspection`、`efficiency_diagnosis` 归入巡检诊断；发布辅助当前无对应 Skill，返回零值。普通聊天和未分类 Skill 不计入分类报告。分类内活跃用户跨 Skill 去重，完成率和反馈采纳率按分类总量重新计算，不相加用户数或平均各 Skill 比例。仍按 Skill 写入日聚合，分类取自新增的 `ai_skill` 表；概览节省人力继续按单个 Skill 计算，其他报告口径不变。
```

**File**: `pkg/microservice/aslan/config/config.go` (modified, +16/-0)
```diff
@@ -41,6 +41,22 @@ func AIReviewGitPollInterval() time.Duration {
 	return interval
 }
 
+func AIAssistantStatsTimeout() time.Duration {
+	timeout, err := time.ParseDuration(strings.TrimSpace(viper.GetString(setting.ENVAslanAIAssistantStatsTimeout)))
+	if err != nil || timeout <= 0 {
+		return 10 * time.Second
+	}
+	return timeout
+}
+
+func AIAssistantStatsDBMaxConnections() int {
+	connections, err := strconv.Atoi(strings.TrimSpace(viper.GetString(setting.ENVAslanAIAssistantStatsDBMaxConnections)))
+	if err != nil || connections < 1 {
+		return 5
+	}
+	return connections
+}
+
 // 服务默认等待启动时间，默认5分钟
 func ServiceStartTimeout() int {
 	serviceStartTimeout := viper.GetString(setting.ENVServiceStartTimeout)
```

**File**: `pkg/microservice/aslan/core/stat/repository/orm/ai_assistant_database.go` (modified, +4/-2)
```diff
@@ -12,6 +12,7 @@ import (
 	"gorm.io/gorm/logger"
 
 	"github.com/koderover/zadig/v2/pkg/config"
+	aslanconfig "github.com/koderover/zadig/v2/pkg/microservice/aslan/config"
 )
 
 type AIAssistantStatsStore struct {
@@ -25,7 +26,7 @@ var assistantStatsDatabase struct {
 }
 
 func NewAIAssistantStatsStore(db *sql.DB) (*AIAssistantStatsStore, error) {
-	db.SetMaxOpenConns(3)
+	db.SetMaxOpenConns(aslanconfig.AIAssistantStatsDBMaxConnections())
 	db.SetMaxIdleConns(1)
 	db.SetConnMaxLifetime(5 * time.Minute)
 	orm, err := gorm.Open(gormmysql.New(gormmysql.Config{Conn: db, SkipInitializeWithVersion: true}), &gorm.Config{
@@ -52,7 +53,8 @@ func GetAIAssistantStatsStore() (*AIAssistantStatsStore, error) {
 	cfg.User, cfg.Passwd, cfg.Addr = config.MysqlUser(), config.MysqlPassword(), config.MysqlHost()
 	cfg.Net, cfg.DBName = "tcp", config.MysqlAIDB()
 	cfg.ParseTime, cfg.Loc = true, time.UTC
-	cfg.Timeout, cfg.ReadTimeout, cfg.WriteTimeout = 3*time.Second, 3*time.Second, 3*time.Second
+	timeout := aslanconfig.AIAssistantStatsTimeout()
+	cfg.Timeout, cfg.ReadTimeout, cfg.WriteTimeout = timeout, timeout, timeout
 	db, err := sql.Open("mysql", cfg.FormatDSN())
 	if err != nil {
 		return nil, fmt.Errorf("AI 助手统计 MySQL 配置无效")
```

**File**: `pkg/microservice/aslan/core/stat/repository/orm/ai_assistant_test.go` (modified, +2/-4)
```diff
@@ -13,6 +13,7 @@ import (
 )
 
 func TestAIAssistantStatsDatabaseIsLazyAndDoesNotInitializeSchema(t *testing.T) {
+	t.Setenv(setting.ENVAslanAIAssistantStatsDBMaxConnections, "")
 	CloseAIAssistantStatsStore()
 	oldHost, oldUser := viper.Get(setting.ENVMysqlHost), viper.Get(setting.ENVMysqlUser)
 	t.Cleanup(func() {
@@ -28,7 +29,7 @@ func TestAIAssistantStatsDatabaseIsLazyAndDoesNotInitializeSchema(t *testing.T)
 	// 此地址无需运行 MySQL；初始化过程中不得连接或执行建表 SQL。
 	viper.Set(setting.ENVMysqlHost, "127.0.0.1:1")
 	store, err := GetAIAssistantStatsStore()
-	if err != nil || store.SQLDB.Stats().OpenConnections != 0 || store.SQLDB.Stats().MaxOpenConnections != 3 {
+	if err != nil || store.SQLDB.Stats().OpenConnections != 0 || store.SQLDB.Stats().MaxOpenConnections != 5 {
 		t.Fatalf("首次初始化必须延迟连接且限制连接预算: %v", err)
 	}
 	again, err := GetAIAssistantStatsStore()
@@ -57,9 +58,6 @@ func mockStatsStore(t *testing.T) (*AIAssistantStatsStore, sqlmock.Sqlmock) {
 		}
 		db.Close()
 	})
-	if db.Stats().MaxOpenConnections != 3 {
-		t.Fatal("统计连接池必须限制为三个连接")
-	}
 	return store, mock
 }
 
```

**File**: `pkg/microservice/aslan/core/stat/service/ai_assistant.go` (modified, +8/-6)
```diff
@@ -8,6 +8,7 @@ import (
 
 	"github.com/go-resty/resty/v2"
 
+	aslanconfig "github.com/koderover/zadig/v2/pkg/microservice/aslan/config"
 	"github.com/koderover/zadig/v2/pkg/microservice/aslan/core/stat/repository/models"
 	statorm "github.com/koderover/zadig/v2/pkg/microservice/aslan/core/stat/repository/orm"
 	"github.com/koderover/zadig/v2/pkg/shared/client/user"
@@ -78,9 +79,6 @@ func queryAIAssistantStats(ctx context.Context, kind, fromDate, toDate string) (
 	if err != nil {
 		return nil, fmt.Errorf("%w: %s", ErrAIAssistantStatsRange, err.Error())
 	}
-	// 等待连接和查询共用预算，页面并行加载四类报告时由数据库连接池控制并发。
-	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
-	defer cancel()
 	store, err := getAIAssistantStatsStore()
 	if err != nil {
 		return nil, fmt.Errorf("%w: %v", ErrAIAssistantStatsUnavailable, err)
@@ -113,7 +111,7 @@ func previousStatsRange(period models.AIAssistantStatsPeriod) (string, string) {
 
 func statsUserClient(ctx context.Context) *user.Client {
 	client := newAIAssistantStatsUserClient()
-	client.SetTimeout(3 * time.Second)
+	client.SetTimeout(aslanconfig.AIAssistantStatsTimeout())
 	client.OnBeforeRequest(func(_ *resty.Client, request *resty.Request) error {
 		request.SetContext(ctx)
 		return nil
@@ -139,7 +137,7 @@ func assistantOverviewData(report *aiAssistantStatsData) models.AIAssistantStats
 }
 
 func GetAIAssistantStatsOverview(ctx context.Context, from, to string) (*models.AIAssistantStatsOverviewResponse, error) {
-	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
+	ctx, cancel := context.WithTimeout(ctx, aslanconfig.AIAssistantStatsTimeout())
 	defer cancel()
 	report, err := queryAIAssistantStats(ctx, "overview", from, to)
 	if err != nil {
@@ -165,6 +163,8 @@ func GetAIAssistantStatsOverview(ctx context.Context, from, to string) (*models.
 }
 
 func GetAIAssistantStatsTrends(ctx context.Context, from, to string) (*models.AIAssistantStatsTrendsResponse, error) {
+	ctx, cancel := context.WithTimeout(ctx, aslanconfig.AIAssistantStatsTimeout())
+	defer cancel()
 	report, err := queryAIAssistantStats(ctx, "trends", from, to)
 	if err != nil {
 		return nil, err
@@ -177,6 +177,8 @@ func GetAIAssistantStatsTrends(ctx context.Context, from, to string) (*models.AI
 }
 
 func GetAIAssistantStatsSkills(ctx context.Context, from, to string) (*models.AIAssistantStatsSkillsResponse, error) {
+	ctx, cancel := context.WithTimeout(ctx, aslanconfig.AIAssistantStatsTimeout())
+	defer cancel()
 	report, err := queryAIAssistantStats(ctx, "skills", from, to)
 	if err != nil {
 		return nil, err
@@ -200,7 +202,7 @@ func GetAIAssistantStatsSkills(ctx context.Context, from, to string) (*models.AI
 }
 
 func GetAIAssistantStatsRankings(ctx context.Context, from, to string) (*models.AIAssistantStatsRankingsResponse, error) {
-	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
+	ctx, cancel := context.WithTimeout(ctx, aslanconfig.AIAssistantStatsTimeout())
 	defer cancel()
 	report, err := queryAIAssistantStats(ctx, "rankings", from, to)
 	if err != nil {
```

**File**: `pkg/microservice/aslan/core/stat/service/ai_assistant_test.go` (modified, +22/-12)
```diff
@@ -4,21 +4,21 @@ import (
 	"context"
 	"encoding/json"
 	"errors"
-
-	"github.com/koderover/zadig/v2/pkg/shared/client/user"
-	"github.com/koderover/zadig/v2/pkg/tool/httpclient"
-	"github.com/koderover/zadig/v2/pkg/tool/log"
 	"io"
 	"net/http"
 	"strings"
-
 	"sync"
 	"testing"
 	"time"
 
 	"github.com/DATA-DOG/go-sqlmock"
+	aslanconfig "github.com/koderover/zadig/v2/pkg/microservice/aslan/config"
 	"github.com/koderover/zadig/v2/pkg/microservice/aslan/core/stat/repository/models"
 	statorm "github.com/koderover/zadig/v2/pkg/microservice/aslan/core/stat/repository/orm"
+	"github.com/koderover/zadig/v2/pkg/setting"
+	"github.com/koderover/zadig/v2/pkg/shared/client/user"
+	"github.com/koderover/zadig/v2/pkg/tool/httpclient"
+	"github.com/koderover/zadig/v2/pkg/tool/log"
 )
 
 var reportColumns = []string{"key", "runs", "completed", "terminal", "in", "out", "elapsed", "completed_elapsed", "positive", "negative", "users"}
@@ -38,7 +38,7 @@ func mockAIAssistantStatsStore(t *testing.T) (*statorm.AIAssistantStatsStore, sq
 	newAIAssistantStatsUserClient = func() *user.Client {
 		client := &user.Client{Client: httpclient.New(httpclient.SetHostURL("http://user/api/v1"))}
 		client.SetTransport(statsUserTransport(func(r *http.Request) (*http.Response, error) {
-			if deadline, ok := r.Context().Deadline(); !ok || time.Until(deadline) > 3*time.Second {
+			if deadline, ok := r.Context().Deadline(); !ok || time.Until(deadline) > aslanconfig.AIAssistantStatsTimeout() {
 				t.Error("user 查询必须共用请求超时预算")
 			}
 			body := `{"total_user":10}`
@@ -289,6 +289,7 @@ func TestAIAssistantStatsDatabaseFailureAndRecovery(t *testing.T) {
 }
 
 func TestAIAssistantStatsFourReportsCanLoadConcurrently(t *testing.T) {
+	t.Setenv(setting.ENVAslanAIAssistantStatsDBMaxConnections, "3")
 	store, mock := mockAIAssistantStatsStore(t)
 	mock.MatchExpectationsInOrder(false)
 	for i := 0; i < 7; i++ {
@@ -325,7 +326,7 @@ func TestAIAssistantStatsFourReportsCanLoadConcurrently(t *testing.T) {
 
 func TestAIAssistantStatsConnectionWaitUsesQueryDeadline(t *testing.T) {
 	store, _ := mockAIAssistantStatsStore(t)
-	for i := 0; i < 3; i++ {
+	for i := 0; i < store.SQLDB.Stats().MaxOpenConnections; i++ {
 		conn, err := store.SQLDB.Conn(context.Background())
 		if err != nil {
 			t.Fatal(err)
@@ -339,11 +340,20 @@ func TestAIAssistantStatsConnectionWaitUsesQueryDeadline(t *testing.T) {
 	}
 }
 
-func TestAIAssistantStatsQueryHasThreeSecondDeadline(t *testing.T) {
-	_, mock := mockAIAssistantStatsStore(t)
-	mock.ExpectQuery("SELECT .*FROM ai_usage_daily").WillDelayFor(4 * time.Second).WillReturnRows(sqlmock.NewRows(reportColumns))
-	if _, err := GetAIAssistantStatsTrends(context.Background(), "", ""); !errors.Is(err, ErrAIAssistantStatsUnavailable) {
-		t.Fatal("查询必须受三秒预算限制")
+func TestAIAssistantStatsQueryUsesConfiguredTimeout(t *testing.T) {
+	t.Setenv(setting.ENVAslanAIAssistantStatsTimeout, "")
+	if got := aslanconfig.AIAssistantStatsTimeout(); got != 10*time.Second {
+		t.Fatalf("默认超时应为 10 秒，实际为 %s", got)
+	}
+	t.Setenv(setting.ENVAslanAIAssistantStatsTimeout, "100ms")
+	for kind, query := range aiAssistantReportQueries {
+		t.Run(kind, func(t *testing.T) {
+			_, mock := mockAIAssistantStatsStore(t)
+			mock.ExpectQuery("SELECT .*FROM ai_usage_daily").WillDelayFor(time.Second).WillReturnRows(sqlmock.NewRows(reportColumns))
+			if _, err := query(context.Background(), "", ""); !errors.Is(err, ErrAIAssistantStatsUnavailable) {
+				t.Fatalf("查询必须受环境变量配置的预算限制，实际错误为 %v", err)
+			}
+		})
 	}
 }
 
```

**File**: `pkg/microservice/halman/MANUAL_TEST_CASES.md` (modified, +2/-2)
```diff
@@ -156,9 +156,9 @@
 
 ### 15. 会话恢复、幂等、取消和删除
 
-**步骤**：原样重发同一 runId；SSE 中途断开后重订阅同一运行；刷新历史；生成时取消，再删除空闲会话。对照测试修改正文却沿用 runId，以及删除活动运行会话。
+**步骤**：原样重发同一 runId；SSE 中途断开后重订阅同一运行；刷新历史；生成时取消，再删除空闲会话。对照测试修改正文却沿用 runId，以及删除活动运行会话和操作结果待核实的已结束会话。
 
-**预期**：同一请求不重复调用模型或执行写入；冲突请求拒绝。断线不取消后台任务，重订阅不启动新任务；历史可恢复。取消停止未提交操作，但不保证撤回已提交业务；活动或仍待核实的会话不可直接删除，空闲会话删除后不可再读取。
+**预期**：同一请求不重复调用模型或执行写入；冲突请求拒绝。断线不取消后台任务，重订阅不启动新任务；历史可恢复。取消停止未提交操作，已提交操作仍可能完成。活动运行会话拒绝删除。无活动运行的会话删除后从历史中移除，待核实操作记录在后台按保留规则留存。
 
 ## 执行记录
 
```

**File**: `pkg/microservice/halman/README.md` (modified, +12/-4)
```diff
@@ -114,7 +114,7 @@ halman 通过现有 MongoDB repository 直接加载助手开关、保留策略
 | --- | --- |
 | `POST /api/halman/conversations` | 新建本人会话 |
 | `GET /api/halman/conversations` | 按时间及 ID 游标分页，默认 30 条 |
-| `DELETE /api/halman/conversations/:id` | 空闲时标记删除；活动或仍待核实写结果时拒绝 |
+| `DELETE /api/halman/conversations/:id` | 无活动运行时隐藏会话，待核实操作记录按保留规则留存 |
 | `GET /api/halman/conversations/:id/messages` | 本人历史快照分页，默认 50 个事件 |
 | `POST /api/halman/conversations/:id/runs` | 提交问题并接收 AG-UI 事件流；相同 runId 幂等复用已有运行 |
 | `GET /api/halman/runs/:id` | 查询运行状态 |
@@ -171,7 +171,14 @@ halman 通过现有 MongoDB repository 直接加载助手开关、保留策略
 
 Skill 分类表现按发布辅助、故障排查、实施辅助、巡检诊断的顺序固定返回四项，维度为 `category`；工作流和服务报错分析归入故障排查，项目和服务初始化归入实施辅助，环境巡检和效能诊断归入巡检诊断，发布辅助当前无对应 Skill。无数据分类返回零计数与空比例；普通聊天及未分类 Skill 不计入。分类通过 `ai_usage_daily.skill_id=ai_skill.id` 关联，分类内用户跨 Skill 去重，比例按分类总量计算；不按启停过滤历史贡献。日聚合仍按 Skill 保存，其他报告及概览估算口径不变。
 
-aslan 需注入已有 `MYSQL_HOST`、`MYSQL_USER`、`MYSQL_PASSWORD` 配置，并与 halman 使用相同 `TZ`，示例为 `Asia/Shanghai`。统计首次查询时初始化 GORM 连接池，每个 aslan 实例最多三个连接、空闲一个、连接最长存活五分钟，不建库或建表，不执行迁移；统计库不可用不阻止 aslan 启动。由连接池控制最多三个并行 SQL 查询，其余在池内等待；连接等待和查询共用三秒预算，超时返回 HTTP 400/code 7212，数据库配置缺失、连接失败或聚合表尚不存在时返回 HTTP 400/code 7212，恢复后可重试。按 aslan 副本数累加连接预算，小池不能隔离共享 MySQL 的 CPU 或磁盘压力。
+aslan 需注入已有 `MYSQL_HOST`、`MYSQL_USER`、`MYSQL_PASSWORD` 配置，并与 halman 使用相同 `TZ`（例如 `Asia/Shanghai`）。统计首次查询时初始化只读 GORM 连接池，最多保留一个空闲连接，连接最长存活五分钟，不建库或建表，不执行迁移。连接池上限按 aslan 副本累加，超出上限的查询在池内等待。超时、数据库配置缺失、连接失败或聚合表尚不存在时，统计接口返回 HTTP 400 和错误码 7212，aslan 可以正常启动，统计恢复后可重试。连接池上限只约束连接数量，共享 MySQL 的 CPU 和磁盘压力仍会影响查询。
+
+| aslan 环境变量 | 默认值 | 用途 |
+| --- | --- | --- |
+| `ASLAN_AI_ASSISTANT_STATS_TIMEOUT` | `10s` | 统计请求总预算（含连接池等待、SQL 和 user 查询），也用于 MySQL 驱动的连接、读和写超时。接受带单位的正时长。 |
+| `ASLAN_AI_ASSISTANT_STATS_DB_MAX_CONNECTIONS` | `5` | 每个 aslan 副本的统计 MySQL 连接上限。接受正整数。 |
+
+环境变量为空或值无效时使用默认值。
 
 推荐只排列固定问题并返回候选上下文，不查询资源或替代执行时鉴权。报告使用 `from`、`to` 日期，默认最近三十天、最多保留三百六十五天，只读日聚合；无反馈时采纳率和估算人天为空。
 
@@ -181,7 +188,7 @@ aslan 需注入已有 `MYSQL_HOST`、`MYSQL_USER`、`MYSQL_PASSWORD` 配置，
 
 所有报告指标增加 `total_tokens` 和 `model_usage[]`，后者包含 `model_id`、`model`、`input_tokens`、`output_tokens`、`total_tokens`，按模型集成 ID 和调用时的模型名排序，无数据返回 `[]`。`ai_usage_daily` 主键扩展为 `(date, user_id, skill_id, model_id, model_name)`；调用次数、耗时及 Token 从该次 `ai_run` 的模型快照写入对应模型行，任务终态、完成耗时和反馈继续写入空模型维度。修正任务贡献时仅更新空模型行，汇总时跨模型求和并对用户去重，不能按模型重复计算任务数。模型信息随日聚合保留三百六十五天，不依赖已到期的运行记录或当前模型配置，不增加表。
 
-概览 `total_users` 通过现有 user SDK 查询系统当前用户总数，与 `metrics.active_users` 配合计算团队渗透率；它是当前用户数，不是上期历史用户数。排行批量查询最多二十名用户的当前名称，返回 `user_name`；已删除或名称为空的用户回退为 `user_id`。user 查询失败返回统计失败，不能把系统用户总数默认为零或将查询故障当成用户已删除。SQL、连接等待与 user 查询共用三秒请求预算。分类和排行的模型明细仅查询报告实际返回的分组。
+概览 `total_users` 通过现有 user SDK 查询系统当前用户总数，与 `metrics.active_users` 配合计算团队渗透率；它是当前用户数，不是上期历史用户数。排行批量查询最多二十名用户的当前名称，返回 `user_name`；已删除或名称为空的用户回退为 `user_id`。user 查询失败返回统计失败，不能把系统用户总数默认为零或将查询故障当成用户已删除。分类和排行的模型明细仅查询报告实际返回的分组。
 
 
 内置 Skill 完整定义及设置保存在 MySQL `ai_skill`，不保存到 MongoDB。`core/skill/<skill_id>.md` 通过 `go:embed` 打包作为发布源，启动时事务同步名称、分类、说明及正文，保留启停和追加规则，定义未变不更新；未来自定义来源不被覆盖。表包含 `id`、`source`、`name`、`category`、`description`、`content`、`enabled`、`custom_rules`、`created_at`、`updated_at`，没有默认提问字段，也不参与聊天到期清理。
@@ -229,6 +236,7 @@ aslan 需注入已有 `MYSQL_HOST`、`MYSQL_USER`、`MYSQL_PASSWORD` 配置，
 
 - `cancel` 仅停止 `running/executing` 运行，或放弃同一 Skill 当前最新的 `awaiting_input` 补问；`pending_confirmation` 必须通过 `confirmation` 的 `decision=reject` 拒绝，直接取消返回 HTTP 400/code 7216。已经 `cancelling` 或进入终态的重复取消不改写持久化状态。
 - 拒绝只处理当前待确认清单，须在同一事务中核对 `active_plan_run_id`、`plan_version`、`plan_status` 及根业务状态 `pending_confirmation`；被替换的旧清单、错误版本及已经开始执行的清单返回 HTTP 400/code 7216。当前清单即使已过期也允许拒绝关闭，但不能确认执行。同一当前版本已经拒绝后再次拒绝幂等返回 204，不重复修改统计；计划指针变化后，旧请求不再视为重复拒绝。
+- 当前待确认清单到期后，由 Halman 的每分钟维护任务自动取消。若先收到确认请求，接口立即取消并返回 HTTP 400/code 7216，详情提示清单已过期并要求重新生成。取消原因通过运行详情和历史记录中的 `error` 字段返回。
 - 取消和拒绝按会话、Skill 根执行、目标运行的顺序加行锁，与确认、生成新清单和删除串行化。状态与 Skill 聚合贡献在同一事务中更新；事务失败整体回滚。`cancel` 只在事务提交成功后停止后台上下文，拒绝不调用后台取消函数。
 - 放弃补问时校验根业务状态及同一 Skill 最新的非重新回答运行，旧补问不能覆盖新进展；该 Skill 尚未执行的旧待确认清单同步失效，防止放弃后再次确认。其他 Skill 的进展不参与这项最新运行判断。仅增加必要的标量查询，沿用已有会话及 Skill 索引，不读取计划或上下文 JSON，不新增数据库表。
 
@@ -386,7 +394,7 @@ GORM SQL 日志关闭，避免记录聊天内容及配置参数；初始化使
 
 数据库连接已占满或发生错误时暂停，下一轮补偿；不启用 SDK 整会话 TTL 删除。删除会话也逐表分批清理，并重建已到期的标题。
 
-保留期内未核实的写结果阻止删除及整会话清理；超过根 Skill 保留期后入口失效，未知记录转为 `expired`，不证明业务成功或失败，不再阻挡过期根记录清理，近期补问正文仍按自己的生成时间保留。日聚合保留三百六十五天；可清理表采用固定白名单，不触碰业务审计及后续永久 AI 审计。
+用户删除会话后，保留期内未核实的写结果仍会阻止整会话物理清理。超过根 Skill 保留期后入口失效，未知记录转为 `expired`，不证明业务成功或失败，不再阻挡过期根记录清理，近期补问正文仍按自己的生成时间保留。日聚合保留三百六十五天；可清理表采用固定白名单，不触碰业务审计及后续永久 AI 审计。
 
 halman 在模型运行开始、结束、取消请求受理和异常恢复时记录 INFO 日志，以 `run_id` 串联；开始记录请求、会话与模型标识，结束记录 Skill、处理结果状态、结果保存是否成功、耗时与 Token，异常恢复记录旧、新状态。结束摘要中的 `result_status` 为本次处理结果，不代替数据库中的最终状态；最终保存失败时记录一次 ERROR，包含错误类型、MySQL 错误码及超时标志，不输出可能包含输入值的原始数据库异常。正常运行仅增加开始、结束两条 INFO，不逐 Token、逐工具成功或逐消息写入日志；不记录聊天正文、工具参数、操作清单或凭据。
 
```

#### Recent Merged Pull Requests:
- **PR #5118** (2026-11-20): fix: correct zadig sub components. (@leozhang2018)
- **PR #5117** (2026-11-20): fix: correct zadig sub components. (@leozhang2018)
- **PR #5116** (2026-11-20): fix(workflow): skip missing builds when listing referable variables (@huanghongbo-hhb)
- **PR #5115** (2026-11-20): fix(hubserver): prevent concurrent WebSocket writes (@PetrusZ)
- **PR #5114** (2026-11-20): fix: avoid panic on GitHub push events from GitHub Apps (@huanghongbo-hhb)
- **PR #5113** (2026-11-20): feat(workflow): include HTML report links in notifications (@Cynthia-0203)

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

## X. avoid panic on GitHub push events from GitHub Apps

**RULE**:
When implementing operations in `pkg/microservice/aslan/core/workflow/service/webhook/github.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in koderover/zadig. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ded50e02`: avoid panic on GitHub push events from GitHub Apps. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/microservice/aslan/core/workflow/service/webhook/github.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
				UserName:  et.Pusher.GetName(),
				Email:     et.Pusher.GetEmail(),
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
				UserName:  *et.Pusher.Name,
				Email:     *et.Pusher.Email,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ded50e02` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
