# Forensic Learning Record (Deep Inspection): goodrain/rainbond

> **Canonical Artifact**: `07_PROJECT_LEARNING/goodrain-rainbond-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/goodrain/rainbond](https://github.com/goodrain/rainbond))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:27:06.031Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `goodrain/rainbond`
- **Description**: Rainbond is an open-source container platform that requires no Kubernetes expertise. Its core capabilities are 100% open source.  It abstracts away infrastructure complexity and provides a unified way to deploy and manage business applications, AI-generated projects, open-source AI software, and large language model services. AI helps teams deploy 
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 6267 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/api/api_interface.go`
```
// Copyright (C) 2014-2018 Goodrain Co., Ltd.
// RAINBOND, Application Management Platform

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version. For any non-GPL usage of Rainbond,
// one or multiple Commercial Licenses authorized by Goodrain Co., Ltd.
// must be obtained first.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

package api

import (
	"net/http"
)

// ClusterInterface -
type ClusterInterface interface {
	GetClusterInfo(w http.ResponseWriter, r *http.Request)
	MavenSettingList(w http.ResponseWriter, r *http.Request)
	MavenSettingAdd(w http.ResponseWriter, r *http.Request)
	MavenSettingUpdate(w http.ResponseWriter, r *http.Request)
	MavenSettingDelete(w http.ResponseWriter, r *http.Request)
	MavenSettingDetail(w http.ResponseWriter, r *http.Request)
	BatchGetGateway(w http.ResponseWriter, r *http.Request)
	GetNamespace(w http.ResponseWriter, r *http.Request)
	GetNamespaceResource(w http.ResponseWriter, r *http.Request)
	ConvertResource(w http.ResponseWriter, r *http.Request)
	ResourceImport(w http.ResponseWriter, r *http.Request)
	GetResource(w http.ResponseWriter, r *http.Request)
	AddResource(w http.ResponseWriter, r *http.Request)
	DeleteResource(w http.ResponseWriter, r *http.Request)
	PreviewDeleteResources(w http.ResponseWriter, r *http.Request)
	BatchDeleteResource(w http.ResponseWriter, r *http.Request)
	ReconcileResources(w http.ResponseWriter, r *http.Request)
	UpdateResource(w http.ResponseWriter, r *http.Request)
	SyncResource(w http.ResponseWriter, r *http.Request)
	YamlResourceName(w http.ResponseWriter, r *http.Request)
	YamlResourceDetailed(w http.ResponseWriter, r *http.Request)
	YamlResourceImport(w http.ResponseWriter, r *http.Request)
	CreateShellPod(w http.ResponseWriter, r *http.Request)
	DeleteShellPod(w http.ResponseWriter, r *http.Request)
	RbdLog(w http.ResponseWriter, r *http.Request)
	GetRbdPods(w http.ResponseWriter, r *http.Request)
	HistoryRbdLogs(w http.ResponseWriter, r *http.Request)
	ListPlugins(w http.ResponseWriter, r *http.Request)
	PluginExists(w http.ResponseWriter, r *http.Request)
	CreateRBDPlugin(w http.ResponseWriter, r *http.Request)
	ListAbilities(w http.ResponseWriter, r *http.Request)
	GetAbility(w http.ResponseWriter, r *http.Request)
	UpdateAbility(w http.ResponseWriter, r *http.Request)
	ListRainbondComponents(w http.ResponseWriter, r *http.Request)
	GetRegionStatus(w http.ResponseWriter, r *http.Request)
	GetLangVersion(w http.ResponseWriter, r *http.Request)
	UpdateLangVersion(w http.ResponseWriter, r *http.Request)
	CreateLangVersion(w http.ResponseWriter, r *http.Request)
	DeleteLangVersion(w http.ResponseWriter, r *http.Request)
	ListCNBFrameworks(w http.ResponseWriter, r *http.Request)
	Upgrade(w http.ResponseWriter, r *http.Request)
	ListUpgradeStatus(w http.ResponseWriter, r *http.Request)
	SetOverScore(w http.ResponseWriter, r *http.Request)
	RegionReadiness(w http.ResponseWriter, r *http.Request)
	BootstrapAgentKubeconfig(w http.ResponseWriter, r *http.Request)
}

// NodesInterface -
type NodesInterface interface {
	ListNodes(w http.ResponseWriter, r *http.Request)
	ListNodeArch(w http.ResponseWriter, r *http.Request)
	GetNode(w http.ResponseWriter, r *http.Request)
	NodeAction(w http.ResponseWriter, r *http.Request)
	ListLabels(w http.ResponseWriter, r *http.Request)
	UpdateLabels(w http.ResponseWriter, r *http.Request)
	ListTaints(w http.ResponseWriter, r *http.Request)
	UpdateTaints(w http.ResponseWriter, r *http.Request)
}

// TenantInterface interface
type TenantInterface interface {
	TenantInterfaceWithV1
	TenantResources(w http.ResponseWriter, r *http.Request)
	ServiceResources(w http.ResponseWriter, r *http.Request)
	Tenant(w http.ResponseWriter, r *http.Request)
	Tenants(w http.ResponseWriter, r *http.Request)
	ServicesInfo(w http.ResponseWriter, r *http.Request)
	TenantsWithResource(w http.ResponseWriter, r *http.Request)
	TenantsQuery(w http.ResponseWriter, r *http.Request)
	TenantsGetByName(w http.ResponseWriter, r *http.Request)
	SumTenants(w http.ResponseWriter, r *http.Request)
	SingleTenantResources(w http.ResponseWriter, r *http.Request)
	GetSupportProtocols(w http.ResponseWriter, r *http.Request)
	TransPlugins(w http.ResponseWriter, r *http.Request)
	ServicesCount(w http.ResponseWriter, r *http.Request)
	GetManyDeployVersion(w http.ResponseWriter, r *http.Request)
	LimitTenantResource(w http.ResponseWriter, r *http.Request)
	TenantResourcesStatus(w http.ResponseWriter, r *http.Request)
	CheckResourceName(w http.ResponseWriter, r *http.Request)
	Log(w http.ResponseWriter, r *http.Request)
}

// HelmInterface HelmInterface
type HelmInterface interface {
	CheckHelmApp(w http.ResponseWriter, r *http.Request)
	GetChartInformation(w http.ResponseWriter, r *http.Request)
	GetYamlByChart(w http.ResponseWriter, r *http.Request)
	GetUploadChartInformation(w http.ResponseWriter, r *http.Request)
	CheckUploadChart(w http.ResponseWriter, r *http.Request)
	GetUploadChartResource(w http.ResponseWriter, r *http.Request)
	ImportUploadChartResource(w http.ResponseWriter, r *http.Request)
	GetUploadChartValue(w http.ResponseWriter, r *http.Request)
}

// ServiceInterface ServiceInterface
type ServiceInterface interface {
	SetLanguage(w http.ResponseWriter, r *http.Request)
	SingleServiceInfo(w http.ResponseWriter, r *http.Request)
	CheckCode(w http.ResponseWriter, r *http.Request)
	Event(w http.ResponseWriter, r *http.Request)
	BuildList(w http.ResponseWriter, r *http.Request)
	CreateService(w http.ResponseWriter, r *http.Request)
	UpdateService(w http.ResponseWriter, r *http.Request)
	Dependency(w http.ResponseWriter, r *http.Request)
	Dependencys(w http.ResponseWriter, r *http.Request)

	Env(w http.ResponseWriter, r *http.Request)
	Ports(w http.ResponseWriter, r *http.Request)
	PutPorts(w http.ResponseWriter, r *http.Request)
	PortOuterController(w http.ResponseWriter, r *http.Request)
	PortInnerController(w http.ResponseWriter, r *http.Request)
	RollBack(w http.ResponseWriter, r *http.Request)
	AddVolume(w http.ResponseWriter, r *http.Request)
	UpdVolume(w http.ResponseWriter, r *http.Request)
	DeleteVolume(w http.ResponseWriter, r *http.Request)
	Pods(w http.ResponseWriter, r *http.Request)
	VolumeDependency(w http.ResponseWriter, r *http.Request)
	Probe(w http.ResponseWriter, r *http.Request)
	Label(w http.ResponseWriter, r *http.Request)
	Share(w http.ResponseWriter, r *http.Request)
	ShareResult(w http.ResponseWriter, r *http.Request)
	BuildVersionInfo(w http.ResponseWriter, r *http.Request)
	GetDeployVersion(w http.ResponseWriter, r *http.Request)
	AutoscalerRules(w http.ResponseWriter, r *http.Request)
	ScalingRecords(w http.ResponseWriter, r *http.Request)
	AddServiceMonitors(w http.ResponseWriter, r *http.Request)
	DeleteServiceMonitors(w http.ResponseWriter, r *http.Request)
	UpdateServiceMonitors(w http.ResponseWriter, r *http.Request)
	UploadPackage(w http.ResponseWriter, r *http.Request)
	K8sAttributes(w http.ResponseWriter, r *http.Request)
	SetVMFixedPodIP(w http.ResponseWriter, r *http.Request)
	VMLiveUpdateCapability(w http.ResponseWriter, r *http.Request)
}

// TenantInterfaceWithV1 funcs for both v2 and v1
type TenantInterfaceWithV1 interface {
	StartService(w http.ResponseWriter, r *http.Request)
	StopService(w http.ResponseWriter, r *http.Request)
	RestartService(w http.ResponseWriter, r *http.Request)
	VerticalService(w http.ResponseWriter, r *http.Request)
	HorizontalService(w http.ResponseWriter, r *http.Request)
	BuildServ
```

### Core Architecture Module: `api/api_routers/doc/html.go`
```
// Copyright (C) 2014-2018 Goodrain Co., Ltd.
// RAINBOND, Application Management Platform

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version. For any non-GPL usage of Rainbond,
// one or multiple Commercial Licenses authorized by Goodrain Co., Ltd.
// must be obtained first.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

package doc

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi"

	"github.com/sirupsen/logrus"
)

//Routes routes
func Routes() chi.Router {
	r := chi.NewRouter()
	workDir, _ := os.Getwd()
	//logrus.Debugf("workdir is %v", workDir)
	filesDir := filepath.Join(workDir, "html")
	//filesDir := "/Users/qingguo/gopath/src/github.com/goodrain/rainbond/hack/contrib/docker/api/html"
	logrus.Debugf("filesdir is %v", filesDir)
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("/docs"))
	})
	FileServer(r, "/docs", http.Dir(filesDir))
	FileServer(r, "/docs/", http.Dir(filesDir))
	return r
}

//FileServer file server
func FileServer(r chi.Router, path string, root http.FileSystem) {
	if strings.ContainsAny(path, "{}*") {
		panic("FileServer does not permit URL parameters.")
	}

	fs := http.StripPrefix(path, http.FileServer(root))

	if path != "/" && path[len(path)-1] != '/' {
		r.Get(path, http.RedirectHandler(path+"/", 301).ServeHTTP)
		path += "/"
	}
	path += "*"

	r.Get(path, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fs.ServeHTTP(w, r)
	}))
}

```

### Core Architecture Module: `api/api_routers/gateway/gateway.go`
```
package gateway

import (
	"github.com/go-chi/chi"
	"github.com/goodrain/rainbond/api/controller"
	"github.com/goodrain/rainbond/api/middleware"
)

// Routes -
func Routes() chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.InitTenant)
	// 关于路由的接口
	r.Route("/routes/http", func(r chi.Router) {
		r.Get("/domains", controller.GetManager().GetHTTPBindDomains)
		r.Get("/port", controller.GetManager().OpenOrCloseDomains)
		r.Get("/", controller.GetManager().GetHTTPAPIRoute)
		r.Post("/", controller.GetManager().CreateHTTPAPIRoute)
		r.Delete("/{name}", controller.GetManager().DeleteHTTPAPIRoute)

		//自动化签发证书
		r.Get("/cert-manager/check", controller.GetManager().CheckCertManager)
		r.Post("/cert-manager", controller.GetManager().CreateCertManager)
		r.Get("/cert-manager", controller.GetManager().GetCertManager)
		r.Delete("/cert-manager", controller.GetManager().DeleteCertManager)
		r.Post("/mtls", controller.GetManager().ConfigureHTTPRouteMTLS)
		r.Delete("/mtls", controller.GetManager().DisableHTTPRouteMTLS)

	})

	// 创建 LoadBalancer 接口
	r.Route("/loadbalancer", func(r chi.Router) {
		r.Post("/", controller.GetManager().CreateLoadBalancer)
		r.Get("/", controller.GetManager().GetLoadBalancer)
		r.Post("/{name}", controller.GetManager().UpdateLoadBalancer)
		r.Delete("/{name}", controller.GetManager().DeleteLoadBalancer)
	})

	// 关于路由的接口
	r.Route("/routes/tcp", func(r chi.Router) {
		r.Get("/domains", controller.GetManager().GetTCPBindDomains)
		r.Get("/", controller.GetManager().GetTCPRoute)
		r.Post("/", controller.GetManager().CreateTCPRoute)
		r.Delete("/{name}", controller.GetManager().DeleteTCPRoute)
	})

	// 关于目标服务的接口
	r.Route("/service", func(r chi.Router) {
		r.Get("/", controller.GetManager().GetAPIService)
		r.Post("/{name}", controller.GetManager().CreateAPIService)
		r.Delete("/{name}", controller.GetManager().DeleteAPIService)
	})

	r.Route("/cert", func(r chi.Router) {
		r.Get("/", controller.GetManager().GetCert)
		r.Post("/{name}", controller.GetManager().CreateCert)
		r.Delete("/{name}", controller.GetManager().DeleteCert)
	})

	return r
}

```

### Core Architecture Module: `api/api_routers/license/license.go`
```
// Copyright (C) 2014-2018 Goodrain Co., Ltd.
// RAINBOND, Application Management Platform

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version. For any non-GPL usage of Rainbond,
// one or multiple Commercial Licenses authorized by Goodrain Co., Ltd.
// must be obtained first.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

package license

import (
	"github.com/goodrain/rainbond/api/controller"

	"github.com/go-chi/chi"
)

// License license struct
type License struct{}

// Routes routes
func Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", controller.GetLicenseManager().Getlicense)
	r.Get("/features", controller.GetLicenseManager().GetlicenseFeature)
	return r
}

```

### Core Architecture Module: `api/api_routers/router.go`
```
package api_routers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type RouteStruct struct {
	// Add any necessary fields here
}

func (r *RouteStruct) SetRoutes(engine *gin.Engine) {
	// 应用 CORS 中间件到所有路由
	engine.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	// ... 其余路由注册代码
} 

```

### Core Architecture Module: `api/api_routers/version2/v2Plugin.go`
```
// Copyright (C) 2014-2018 Goodrain Co., Ltd.
// RAINBOND, Application Management Platform

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version. For any non-GPL usage of Rainbond,
// one or multiple Commercial Licenses authorized by Goodrain Co., Ltd.
// must be obtained first.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

package version2

import (
	"github.com/goodrain/rainbond/api/controller"
	"github.com/goodrain/rainbond/api/middleware"
	dbmodel "github.com/goodrain/rainbond/db/model"

	"github.com/go-chi/chi"
)

// PluginRouter plugin router
func (v2 *V2) pluginRouter() chi.Router {
	r := chi.NewRouter()
	//初始化应用信息
	r.Use(middleware.InitPlugin)
	//plugin uri
	//update/delete plugin
	r.Put("/", controller.GetManager().PluginAction)
	r.Delete("/", controller.GetManager().PluginAction)
	r.Post("/build", controller.GetManager().PluginBuild)
	//get this plugin all build version
	r.Get("/build-version", controller.GetManager().GetAllPluginBuildVersions)
	r.Get("/build-version/{version_id}", controller.GetManager().GetPluginBuildVersion)
	r.Delete("/build-version/{version_id}", controller.GetManager().DeletePluginBuildVersion)
	return r
}

func (v2 *V2) serviceRelatePluginRouter() chi.Router {
	r := chi.NewRouter()
	//service relate plugin
	// v2/tenant/tenant_name/services/service_alias/plugin/xxx
	r.Post("/", middleware.WrapEL(controller.GetManager().PluginSet, dbmodel.TargetTypeService, "create-service-plugin", dbmodel.SYNEVENTTYPE, false))
	r.Put("/", middleware.WrapEL(controller.GetManager().PluginSet, dbmodel.TargetTypeService, "update-service-plugin", dbmodel.SYNEVENTTYPE, false))
	r.Get("/", controller.GetManager().PluginSet)
	r.Delete("/{plugin_id}", middleware.WrapEL(controller.GetManager().DeletePluginRelation, dbmodel.TargetTypeService, "delete-service-plugin", dbmodel.SYNEVENTTYPE, false))
	// app plugin config supdate
	r.Post("/{plugin_id}/setenv", middleware.WrapEL(controller.GetManager().UpdateVersionEnv, dbmodel.TargetTypeService, "update-service-plugin-config", dbmodel.SYNEVENTTYPE, false))
	r.Put("/{plugin_id}/upenv", middleware.WrapEL(controller.GetManager().UpdateVersionEnv, dbmodel.TargetTypeService, "update-service-plugin-config", dbmodel.SYNEVENTTYPE, false))
	//deprecated
	r.Get("/{plugin_id}/envs", controller.GetManager().GePluginEnvWhichCanBeSet)
	return r
}

```

### Core Architecture Module: `api/api_routers/version2/v2Routers.go`
```
// Copyright (C) 2014-2018 Goodrain Co., Ltd.
// RAINBOND, Application Management Platform

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version. For any non-GPL usage of Rainbond,
// one or multiple Commercial Licenses authorized by Goodrain Co., Ltd.
// must be obtained first.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

package version2

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi"
	"github.com/goodrain/rainbond/api/controller"
	"github.com/goodrain/rainbond/api/middleware"
	dbmodel "github.com/goodrain/rainbond/db/model"
	"github.com/goodrain/rainbond/pkg/apis/rainbond/v1alpha1"
	"github.com/goodrain/rainbond/pkg/component/eventlog"
	"github.com/goodrain/rainbond/pkg/component/k8s"
	http2 "github.com/goodrain/rainbond/util/http"
	"github.com/sirupsen/logrus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const pluginStaticRequestTimeout = 15 * time.Second

var pluginStaticHTTPClient = &http.Client{
	Timeout: pluginStaticRequestTimeout,
	CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
		return http.ErrUseLastResponse
	},
}

type rbdPluginGetter func(string) (*v1alpha1.RBDPlugin, error)

type pluginStaticContent struct {
	body        []byte
	contentType string
}

type pluginStaticUpstreamError struct {
	host       string
	statusCode int
	kind       string
	err        error
}

func (e *pluginStaticUpstreamError) Error() string {
	if e.statusCode != 0 {
		return fmt.Sprintf("plugin frontend upstream returned status %d", e.statusCode)
	}
	return "plugin frontend upstream request failed"
}

func (e *pluginStaticUpstreamError) Unwrap() error {
	return e.err
}

// V2 v2
type V2 struct {
}

// Routes routes
func (v2 *V2) Routes() chi.Router {
	r := chi.NewRouter()

	// License endpoints
	r.Mount("/license", v2.licenseRouter())

	r.Get("/health", controller.GetManager().Health)
	r.Get("/show", controller.GetManager().Show)
	r.Post("/show", controller.GetManager().Show)
	r.Mount("/tenants", v2.tenantRouter())
	r.Mount("/cluster", v2.clusterRouter())
	r.Mount("/notificationEvent", v2.notificationEventRouter())
	r.Mount("/resources", v2.resourcesRouter())
	r.Mount("/prometheus", v2.prometheusRouter())
	r.Get("/event", controller.GetManager().Event)
	r.Mount("/app", v2.appRouter())
	r.Post("/alertmanager-webhook", controller.GetManager().AlertManagerWebHook)
	r.Get("/version", controller.GetManager().Version)
	// deprecated use /gateway/ports
	r.Mount("/port", v2.portRouter())
	// deprecated, use /events/<event_id>/log
	r.Get("/event-log", controller.GetManager().LogByAction)
	r.Mount("/events", v2.eventsRouter())
	r.Get("/gateway/ips", controller.GetGatewayIPs)
	r.Get("/gateway/ports", controller.GetManager().GetAvailablePort)
	r.Get("/volume-options", controller.VolumeOptions)
	r.Get("/volume-options/page/{page}/size/{pageSize}", controller.ListVolumeType)
	r.Post("/volume-options", controller.VolumeSetVar)
	r.Delete("/volume-options/{volume_type}", controller.DeleteVolumeType)
	r.Put("/volume-options/{volume_type}", controller.UpdateVolumeType)
	r.Mount("/enterprise/{enterprise_id}", v2.enterpriseRouter())
	r.Mount("/monitor", v2.monitorRouter())
	r.Mount("/helm", v2.helmRouter())
	r.Mount("/proxy-pass", v2.proxyRoute())
	r.Get("/pods/logs", controller.GetManager().PodLogs)
	r.Mount("/platform", v2.platformPluginsRouter())

	return r
}

func (v2 *V2) proxyRoute() chi.Router {
	r := chi.NewRouter()
	r.Post("/registry/repos", controller.GetManager().GetAllRepo)
	r.Post("/registry/tags", controller.GetManager().GetTagsByRepoName)
	r.Post("/registry/check", controller.GetManager().CheckRegistry)
	r.Get("/system/pods", controller.GetManager().SystemPodDetail)
	r.Get("/system/logs", controller.GetManager().SystemPodLogs)
	return r
}

func (v2 *V2) helmRouter() chi.Router {
	r := chi.NewRouter()
	r.Get("/check_helm_app", controller.GetManager().CheckHelmApp)
	r.Get("/get_chart_information", controller.GetManager().GetChartInformation)
	r.Get("/get_chart_yaml", controller.GetManager().GetYamlByChart)
	r.Get("/get_upload_chart_information", controller.GetManager().GetUploadChartInformation)
	r.Post("/check_upload_chart", controller.GetManager().CheckUploadChart)
	r.Get("/get_upload_chart_resource", controller.GetManager().GetUploadChartResource)
	r.Post("/import_upload_chart_resource", controller.GetManager().ImportUploadChartResource)
	r.Get("/get_upload_chart_value", controller.GetManager().GetUploadChartValue)
	return r
}

func (v2 *V2) monitorRouter() chi.Router {
	r := chi.NewRouter()
	r.Get("/metrics", controller.GetMonitorMetrics)
	return r
}

func (v2 *V2) enterpriseRouter() chi.Router {
	r := chi.NewRouter()
	r.Get("/running-services", controller.GetRunningServices)
	r.Get("/abnormal_status", controller.GetAbnormalStatus)
	return r
}

func (v2 *V2) eventsRouter() chi.Router {
	r := chi.NewRouter()
	// get target's event list with page
	r.Get("/", controller.GetManager().Events)
	// get my teams event list with page
	r.Get("/myteam", controller.GetManager().MyTeamsEvents)
	// get target's event content
	r.Get("/{eventID}/log", controller.GetManager().EventLog)
	// stream target's event content
	r.Get("/{eventID}/stream", eventlog.Default().SocketServer.PushEventMessageSSE)
	return r
}

func (v2 *V2) platformPluginsRouter() chi.Router {
	r := chi.NewRouter()
	r.Get("/static/plugins/{plugin_name}", PluginStaticProxy)
	r.Get("/backend/plugins/{plugin_name}/*", PluginBackendProxy)
	r.Post("/backend/plugins/{plugin_name}/*", PluginBackendProxy)
	r.Put("/backend/plugins/{plugin_name}/*", PluginBackendProxy)
	r.Delete("/backend/plugins/{plugin_name}/*", PluginBackendProxy)
	r.Post("/plugins/{plugin_name}/status", ChangePluginStatus)
	return r
}

// PluginBackendProxy forwards requests to the named plugin's backend service.
func PluginBackendProxy(w http.ResponseWriter, r *http.Request) {
	plugin, err := getRBDPlugin(chi.URLParam(r, "plugin_name"))
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get backend_path: %v", err), http.StatusInternalServerError)
		return
	}
	// 解析 backend_path 内容
	backend, err := resolveBackend(plugin)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to resolve backend_path content: %v", err), http.StatusInternalServerError)
		return
	}
	proxy := httputil.NewSingleHostReverseProxy(backend)
	// 修改 Director 来调整请求路径，直接代理到 backend，并保留请求的 path
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		proxyPath := chi.URLParam(r, "*")
		req.URL.Path = "/" + strings.TrimLeft(proxyPath, "/")
		req.Host = backend.Host
	}
	// Serialize transport errors as JSON instead of leaking raw exception objects
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		logrus.Errorf("plugin proxy error for %s: %v", plugin.Name, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		resp := map[string]interface{}{
			"code":   http.StatusBadGateway,
			"msg":    fmt.Sprintf("plugin backend unavailable: %s", err.Error()),
			"plugin": plugin.Name,
		}
		if encErr := json.NewEncoder(w).Encode(resp); encErr != nil {
			logrus.Errorf("failed to encode plugin proxy error response: %v", encErr)
		}
	}
	proxy.ServeHTTP(w, r)
}

func resolveBackend(plugin *v1alpha1.RBDPlugin) (url *url.URL, err error) {
	backend := plugin.Spec.BackendService
	
```

### Core Architecture Module: `api/api_routers/version2/v2Rules.go`
```
// Copyright (C) 2014-2018 Goodrain Co., Ltd.
// RAINBOND, Application Management Platform

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version. For any non-GPL usage of Rainbond,
// one or multiple Commercial Licenses authorized by Goodrain Co., Ltd.
// must be obtained first.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

package version2

import (
	"github.com/go-chi/chi"
)

// PluginRouter plugin router
func (v2 *V2) rulesRouter() chi.Router {
	r := chi.NewRouter()
	// service rule
	// url: v2/tenant/{tenant_name}/services/{service_alias}/net-rule/xxx
	// -- --
	//upstream
	r.Mount("/upstream", v2.upstreamRouter())
	return r
}

func (v2 *V2) upstreamRouter() chi.Router {
	r := chi.NewRouter()
	return r
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2685** (2026-08-28): **🐞 反馈问题：rbd-init-probe镜像是否有地方可以配置自定义镜像仓库**
  *Symptoms*: ### 请先确认以下事项：  - [x] 请务必查看[常见问题](https://www.rainbond.com/docs/faq)和[故障排除](https://www.rainbond.com/docs/troubleshooting) - [x] 在 [issues](https://github.com/goodrain/rainbond/issues) 页面搜索过问题（包括已关闭的 issue），但未能找到解决方法 - [x] Rainbond 已升级到 [最新版本](https://github.com/goodrain/rainbond/releases)  ### 问题描述  我于离线环境（k3s）使用helm方式安装rainbond，在对应value内定义了私有镜像仓库地址，使用helm install之后正常安装，服务正常启动。但是在执行ram应用包导入之后发现部分服务会去拉取registry.cn-hangzhou.aliyuncs.com/goodrain/rbd-init-probe:v6.9.7-release镜像，此镜像地址是否有办法修改为自定义镜像仓库地址  ### 该问题是否可以稳定重现？  可重现  ### 重现步骤  1、离线环境（k3s）使用helm方式安装rainbond，在对应value内定义了私有镜像仓库地址，使用helm install安装。2、执行ram应用包导入  ### 截图  无  ### 日志  无  ### 期望结果  可自定义修改pre镜像的地址  ### 解决方案（可选）  _No response_  ### 操作系统 && Rainbond 版本  ubuntu22.04，k8s1.26.7 rainbond 6.9.7  ### 是否愿意提交 PR 解决该问题？  - [ ] 我愿意提交 PR 来解决该问题
  **Post-Mortem & Fix Analysis**:
  > @qaqwx  ```bash kubectl edit rbdcomponent -n rbd-system rbd-worker  spec:   env:   - name: PROBE_MESH_IMAGE_NAME     value: xxx/rbd-init-probe:v6.9.8-release ```

- **Issue #2665** (2026-08-17): **Cross-enterprise tenant IDOR in the region API server: any valid region API token can read (and, by the same code path, modify) any other enterprise's tenant resources on a shared multi-tenant Rainbond region**
  *Symptoms*: ### 请先确认以下事项：  - [x] 请务必查看[常见问题](https://www.rainbond.com/docs/faq)和[故障排除](https://www.rainbond.com/docs/troubleshooting) - [x] 在 [issues](https://github.com/goodrain/rainbond/issues) 页面搜索过问题（包括已关闭的 issue），但未能找到解决方法 - [x] Rainbond 已升级到 [最新版本](https://github.com/goodrain/rainbond/releases)  ### 问题描述  version: v3.6.1 (HEAD 6998ca3d726b06bc6c5c5dd69cf4be2f9e413d42)  ## Summary  Rainbond's region API server (the Kubernetes-cluster-facing HTTP API built from `cmd/api`) is explicitly designed to be shared by multiple enterprises (tracked as `EID` in the schema) on a single region, each owning one or more "tenants" (internal workspaces, identified by a human-chosen `tenant_name`). Every issued API token is likewise recorded with the owning enterprise's `EID`. However, the token-validation function (`CheckToken`) only checks validity period and a broad "API class" (`ALLPOWER` / `SERVERSOURCE` / `NODEMANAGER`); it never reads or compares the token's `EID`. Separately, the tenant-resolution middleware (`InitTenant`) resolves whatever `tenant_name` appears in the URL path via a completely global, unscoped database lookup, with no cross-check against the calling token's owning enterprise at all.  The net effect: any valid region API token, regardless of which enterprise it was issued to, can be used against any other enterprise's `tenant_name` in the URL path, and the request will be treated as authorized for that tenant. On a region shared by multiple enterprises (the exact scenario thi
  **Post-Mortem & Fix Analysis**:
  > @geo-chen  Rainbond v3.6.1 ? Is your enterprise using Rainbond version 3.6.1?
  > hey @zzzhangqi im an independent researcher, so i do not have an enterprise using this. the version i checked is v3.6.1
  > @geo-chen Hi,  v3.6.1 is no longer maintained. Please use it according to the code of the main branch.

- **Issue #2655** (2026-07-27): **🐞 反馈问题：启用插件和自定义affinity后引起的不可调度问题**
  *Symptoms*: ### 请先确认以下事项：  - [x] 请务必查看[常见问题](https://www.rainbond.com/docs/faq)和[故障排除](https://www.rainbond.com/docs/troubleshooting) - [x] 在 [issues](https://github.com/goodrain/rainbond/issues) 页面搜索过问题（包括已关闭的 issue），但未能找到解决方法 - [x] Rainbond 已升级到 [最新版本](https://github.com/goodrain/rainbond/releases)  ### 问题描述  如题，我看了有两个符合亲和性可调度节点，其中一个内存充足，另外一个内存不是很足。  ### 该问题是否可以稳定重现？  可重现  ### 重现步骤  给集群节点添加标签：node-tag.kubernetes.io/gray = C  然后组件（多实例，可能单实例也有这个问题）启用插件（插件自己有内存和cpu配额限制），并且在组件的添加以下配置：  ```       - key: node-tag.kubernetes.io/gray         operator: In         values:         - C ```  完整配置如下： ``` nodeAffinity:   requiredDuringSchedulingIgnoredDuringExecution:     nodeSelectorTerms:     - matchExpressions:       - key: kubernetes.io/arch         operator: In         values:         - amd64       - key: node-tag.kubernetes.io/gray         operator: In         values:         - C ```  ### 截图  #### 运行 <img width="1582" height="462" alt="Image" src="https://github.com/user-attachments/assets/c05fe10c-0fe3-41fc-ae14-f9164fd1483e" />  #### 插件 <img width="1592" height="290" alt="Image" src="https://github.com/user-attachments/assets/1115f832-4c8a-4bca-bde5-70a1f48003e8" />  #### 组件配置 <img width="501" height="524" alt="Image" src="https://github.com/user-attachments/assets/a19a1fff-3881-4851-a770-332f849b2427" />  #### 节点配置 <img width="495" height="475" alt="Image" src="https://github.com/user-attachments/assets/cc5f2196-8b90-43e1-82df-8aafb36d56a9" />  ### 日志  Warning | FailedScheduling | <unknown> 
  **Post-Mortem & Fix Analysis**:
  >   > Bot detected the issue body's language is not English, translate it automatically. 👯👭🏻🧑‍🤝‍🧑👫🧑🏿‍🤝‍🧑🏻👩🏾‍🤝‍👨🏿👬🏿       ----   **Title:** 🐞 Feedback: Unschedulable issues caused by enabling plug-ins and custom affinity           
  > 未复现
  >   > Bot detected the issue body's language is not English, translate it automatically. 👯👭🏻🧑‍🤝‍🧑👫🧑🏿‍🤝‍🧑🏻👩🏾‍🤝‍👨🏿👬🏿          ----     Not reappeared         

- **Issue #2621** (2026-06-18): **[Sentry] UI throws TypeError when response_data is not a string**
  *Symptoms*: ## Summary Sentry captured a frontend exception where UI code calls `.split()` on `e.response_data`, but `response_data` is not always a string.  ## Sentry evidence - Covered group: `RAINBOND-UI-N` - Error: `TypeError: Unhandled promise rejection: e.response_data.split is not a function` - Culprit bundle: `p__Group__Overview...async.js` - First/last seen: `2026-06-15T06:55:40Z` - Times seen: `1`  ## Impact When the backend returns structured error data instead of a string, the group overview page can throw while handling the error.  ## Suggested next steps - Locate the Group Overview error handling path that calls `response_data.split`. - Normalize `response_data` before string operations. - Add a regression case for object-shaped backend error payloads.  _Source: Sentry unresolved Rainbond group import on 2026-06-17._
  **Post-Mortem & Fix Analysis**:
  > /claude fix issues
  > **Claude finished @RainBondsongyg's task in 11m 26s** —— [View job](https://github.com/goodrain/rainbond/actions/runs/27670036710)  --- ### Fix: Guard `response_data.split` against non-string values  **Status:** ✅ Completed  #### Root Cause  `request.js` sets `response_data = response.data` (the raw HTTP body). When the backend returns structured JSON error data, `response_data` is an **object**, not a string. The code unconditionally calls `.split('\n')` on it, which throws `TypeError`.  #### Changes Made  **Repo:** [goodrain/rainbond-ui](https://github.com/goodrain/rainbond-ui/pull/1832)  | File | Line | Fix | |------|------|-----| | `src/pages/Component/log.js` | 338 | Normalize `response_data` before `.split('\n')`: handle string, object (extract `.data`), and missing values | | `src/pages/AddCluster/Install/index.js` | 172 | Same defensive pattern for `result.response_data.command.split(' & ')` |  #### Verification  - `yarn build` passes ✅ - Both fixes handle string, object, and m
  > Fixed in https://github.com/goodrain/rainbond-ui/pull/1832  **Root cause:** `request.js` sets `response_data = response.data` (the raw HTTP body). When the backend returns structured JSON error data, `response_data` is an object, not a string. The code at `Component/log.js:338` unconditionally called `.split('\n')` on it, which throws `TypeError`.  **Changes:** - `src/pages/Component/log.js` — Normalize `response_data` before string operations: handle string, object (extract `.data`), and missing values. - `src/pages/AddCluster/Install/index.js` — Same defensive pattern for `response_data.command.split()`.  **Verification:** `yarn build` passes on rainbond-ui.

- **Issue #2620** (2026-06-18): **UI records broad API 500/502/network failures from backend outages**
  *Symptoms*: ## Summary Sentry captured many `rainbond-ui` API failures across pages. Most appear to be secondary symptoms of console/region errors, but the UI currently records each failed endpoint as a separate issue and often reports generic `Network Error`.  ## Covered Sentry groups API/network groups currently covered here: `RAINBOND-UI-25`, `RAINBOND-UI-24`, `RAINBOND-UI-23`, `RAINBOND-UI-22`, `RAINBOND-UI-20`, `RAINBOND-UI-21`, `RAINBOND-UI-1Y`, `RAINBOND-UI-1X`, `RAINBOND-UI-1Z`, `RAINBOND-UI-1V`, `RAINBOND-UI-1W`, `RAINBOND-UI-1T`, `RAINBOND-UI-1S`, `RAINBOND-UI-1R`, `RAINBOND-UI-1Q`, `RAINBOND-UI-1P`, `RAINBOND-UI-1K`, `RAINBOND-UI-1N`, `RAINBOND-UI-1M`, `RAINBOND-UI-1J`, `RAINBOND-UI-1H`, `RAINBOND-UI-1G`, `RAINBOND-UI-1F`, `RAINBOND-UI-1E`, `RAINBOND-UI-1D`, `RAINBOND-UI-1C`, `RAINBOND-UI-1B`, `RAINBOND-UI-1A`, `RAINBOND-UI-19`, `RAINBOND-UI-18`, `RAINBOND-UI-17`, `RAINBOND-UI-16`, `RAINBOND-UI-15`, `RAINBOND-UI-14`, `RAINBOND-UI-13`, `RAINBOND-UI-12`, `RAINBOND-UI-11`, `RAINBOND-UI-10`, `RAINBOND-UI-Y`, `RAINBOND-UI-X`, `RAINBOND-UI-Z`, `RAINBOND-UI-W`, `RAINBOND-UI-V`, `RAINBOND-UI-S`, `RAINBOND-UI-R`, `RAINBOND-UI-Q`, `RAINBOND-UI-P`, `RAINBOND-UI-M`, `RAINBOND-UI-G`, `RAINBOND-UI-J`, `RAINBOND-UI-H`, `RAINBOND-UI-F`, `RAINBOND-UI-K`, `RAINBOND-UI-E`, `RAINBOND-UI-D`, `RAINBOND-UI-8`, `RAINBOND-UI-9`.  Filtered out as manual smoke/test noise: `RAINBOND-UI-1`, `RAINBOND-UI-2`, `RAINBOND-UI-3`, `RAINBOND-UI-4`, `RAINBOND-UI-5`, `RAINBOND-UI-6`, `RAINBOND-UI-7`, `RAINBOND-UI-A
  **Post-Mortem & Fix Analysis**:
  > /claude fix issues
  > **Claude finished @RainBondsongyg's task in 5m 53s** —— [View job](https://github.com/goodrain/rainbond/actions/runs/27733753609) • [Create PR ➔](https://github.com/goodrain/rainbond-ui/compare/main...claude/issue-2620-sentry-api-error-grouping?quick_pull=1&title=fix%3A+improve+Sentry+API+error+grouping+and+add+backend+context+tags&body=Ref+goodrain%2Frainbond%232620%0A%0A-+Group+API+errors+by+error+class+and+business+code+instead+of+endpoint%0A-+Add+backend_error_class%2C+request_id%2C+business_code+Sentry+tags%0A-+Suppress+expected+transient+errors+%28502%2F503%2F504%29%0A-+Extract+x-request-id+for+backend+log+correlation%0A%0AGenerated+with+%5BClaude+Code%5D%28https%3A%2F%2Fclaude.ai%2Fcode%29)  --- ### Analysis  The issue is that `rainbond-ui` creates separate Sentry issues for each API endpoint when a backend outage occurs. For example, a region service going down causes 500/502 errors on every endpoint, creating dozens of Sentry issues instead of one grouped issue.  ### Root Caus

- **Issue #2619** (2026-06-18): **OpenAPI team/app endpoints fail on missing team initialization state**
  *Symptoms*: ## Summary Sentry captured OpenAPI errors when team or app state is missing or not initialized in the requested region.  ## Covered Sentry groups - `RAINBOND-CONSOLE-W`: `AttributeError: 'NoneType' object has no attribute 'tenant_id'`, route `/openapi/v1/teams/{team_id}/regions/{region_name}/apps/{app_id}/services` - `RAINBOND-CONSOLE-V`: team is not initialized in region, route `/openapi/v1/teams/{team_id}/regions/{region_name}/apps` - Related UI symptom: `RAINBOND-UI-9`, API 500 `GET /console/enterprise/:id/regions`  ## Impact OpenAPI callers receive server errors instead of clear team/region initialization errors.  ## Initial analysis Handlers need to explicitly handle missing team-region initialization and missing app objects before dereferencing tenant fields.  ## Suggested next steps - Return structured `404`/`409` style errors for uninitialized team-region state. - Add nil checks before accessing `tenant_id`. - Add OpenAPI tests for uninitialized team and missing app paths.  _Source: Sentry unresolved Rainbond group import on 2026-06-17._
  **Post-Mortem & Fix Analysis**:
  > /claude fix issues
  > **Claude finished @RainBondsongyg's task in 6m 48s** —— [View job](https://github.com/goodrain/rainbond/actions/runs/27735466609) • [Create PR ➔](https://github.com/goodrain/rainbond-console/compare/main...claude/issue-2619-20260618-0350?quick_pull=1&title=fix%3A+add+nil+checks+for+team+initialization+in+OpenAPI+endpoints&body=%23%23+Summary%0AThis+PR+fixes+OpenAPI+team%2Fapp+endpoints+that+fail+when+team+or+app+state+is+missing+or+not+initialized+in+the+requested+region.%0A%0A%23%23+Changes%0A-+**openapi%2Fservices%2Fapp_service.py**%3A+Added+nil+check+for+team+in+%60get_app_services_and_status%28%29%60+to+prevent+%60AttributeError%60%0A-+**openapi%2Fviews%2Fbase.py**%3A+Added+team-region+initialization+validation+in+%60TeamAPIView.initial%28%29%60+to+return+409+error%0A-+**openapi%2Fviews%2Fexceptions.py**%3A+Added+%60ErrTeamNotInitializedInRegion%60+exception%0A%0ARef%3A+goodrain%2Frainbond%232619%0A%0AGenerated+with+%5BClaude+Code%5D%28https%3A%2F%2Fclaude.ai%2Fcode%29)  --- ### An
  > /claude 审阅本次提价的代码

- **Issue #2617** (2026-06-18): **plugin proxy and SSE paths leak transport/serialization failures**
  *Symptoms*: ## Summary Sentry captured transport and serialization failures in plugin proxy and SSE endpoints.  ## Covered Sentry groups - `RAINBOND-CONSOLE-F`: `TypeError: Object of type 'ConnectionResetError' is not JSON serializable` - `RAINBOND-CONSOLE-E`: `ProtocolError: Connection reset by peer` - `RAINBOND-CONSOLE-G`: plugin exists check failed with connection reset - `RAINBOND-CONSOLE-15`: SSE request timed out through region API - `RAINBOND-CONSOLE-Q`: `UnicodeDecodeError` while reading SSE stream - `RAINBOND-CONSOLE-8`: `IncompleteRead` on SSE stream  ## Impact Plugin pages and stream endpoints can turn transient backend transport failures into unhandled console exceptions.  ## Initial analysis The plugin proxy should serialize transport errors into strings/structured codes, not raw exception objects. SSE code needs defensive handling for partial reads and non-UTF8 chunks.  ## Suggested next steps - Convert transport exceptions to safe JSON error payloads. - Add SSE decoding with replacement/error handling and partial-read retry/close semantics. - Add tests for plugin proxy connection reset and SSE partial/non-UTF8 streams.  _Source: Sentry unresolved Rainbond group import on 2026-06-17._
  **Post-Mortem & Fix Analysis**:
  > /claude fix issues
  > **Claude finished @RainBondsongyg's task in 23m 19s** —— [View job](https://github.com/goodrain/rainbond/actions/runs/27743193402) • [`claude/issue-2617-20260618-0715`](https://github.com/goodrain/rainbond/tree/claude/issue-2617-20260618-0715) • [Create PR ➔](https://github.com/goodrain/rainbond/compare/main...claude/issue-2617-20260618-0715?quick_pull=1&title=fix%3A%20handle%20transport%20errors%20in%20plugin%20proxy%20and%20SSE%20log%20streaming&body=Fixed%20transport%20and%20serialization%20failures%20in%20plugin%20proxy%20and%20SSE%20endpoints.%0A%0ARef%20%232617%0A%0AGenerated%20with%20%5BClaude%20Code%5D(https%3A%2F%2Fclaude.ai%2Fcode))  --- ### Task: Fix plugin proxy and SSE paths leaking transport/serialization failures  **Current status:** ✅ Completed  #### Summary Fixed transport and serialization failures in plugin proxy and SSE endpoints that were causing Sentry errors.  #### Changes Made  **1. Plugin Proxy Error Handling** (`api/api_routers/version2/v2Routers.go`) - Added 
  > /claude 审阅本次提价的代码

- **Issue #2612** (2026-06-22): **component lifecycle operations fail on field/default mismatches**
  *Symptoms*: ## Summary Sentry captured console errors caused by model/field/default mismatches during component delete, batch delete, scaling, and repeated operation flows.  ## Covered Sentry groups - `RAINBOND-CONSOLE-18`: `TenantServiceInfoDelete() got unexpected keyword arguments: 'build_strategy'`, route `/console/teams/{tenantName}/batch_delete` - `RAINBOND-CONSOLE-9`: `TenantServiceInfoDelete() got an unexpected keyword argument 'build_strategy'`, route `/console/teams/{tenantName}/groups/{app_id}/handle` - `RAINBOND-CONSOLE-N`: `IntegrityError: Column 'inner_port' cannot be null`, route `/console/teams/{tenantName}/apps/{serviceAlias}/delete` - `RAINBOND-CONSOLE-S`: `IntegrityError: NOT NULL constraint failed: tenant_service_delete.inner_port`, route `/console/teams/{tenantName}/apps/{serviceAlias}/delete` - `RAINBOND-CONSOLE-5`: `IntegrityError: Column 'container_gpu' cannot be null`, route `/console/mcp/query` - `RAINBOND-CONSOLE-T`: `OperationalError: database is locked`, route `/console/teams/{tenantName}/apps/{serviceAlias}/delete` - `RAINBOND-CONSOLE-17`: frequent-operation `409` on vertical scaling - `RAINBOND-CONSOLE-P`: frequent-operation `409` on build trigger from MCP query  ## Impact Users and automation can fail to delete, scale, or trigger operations cleanly. Some failures may leave lifecycle operations partially applied.  ## Initial analysis The delete/archive model appears to be built from broader service objects without filtering fields accepted by `TenantServiceI
  **Post-Mortem & Fix Analysis**:
  > /claude fix issues
  > **Claude finished @RainBondsongyg's task in 23m 18s** —— [View job](https://github.com/goodrain/rainbond/actions/runs/27743250210)  --- ### Task List  - [x] Step 0: Determine context — Issue #2612, IMPLEMENT mode - [x] Step 1: Read full issue and triggering comment - [x] Step 2: Investigate code — all bugs are in `rainbond-console` (Python/Django) - [x] Step 3a: Fix `build_strategy` passed to `TenantServiceInfoDelete` (RAINBOND-CONSOLE-18, -9) - [x] Step 3b: Fix `inner_port` null IntegrityError (RAINBOND-CONSOLE-N, -S) - [x] Step 3c: Fix `database is locked` error handling (RAINBOND-CONSOLE-T) - [x] Step 4: Run quality gates and open PR - [x] Step 5: Comment on issue with summary  ---  ### Summary  All bugs were in `rainbond-console` (Python/Django). Three fixes applied:  | Sentry Group | Root Cause | Fix | |---|---|---| | RAINBOND-CONSOLE-18, -9 | `service.toJSON()` includes `build_strategy` but `TenantServiceInfoDelete` doesn't accept it → `TypeError` | Added `data.pop("build_strateg

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

### Incident Patch 1: `448e057c` (2026-09-29)
**Commit Message**: fix: prevent index file download redirects (#2706)

Signed-off-by: Qi Zhang <smallqi1@163.com>

**File**: `api/controller/file_download.go` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+package controller
+
+import (
+	"net/http"
+	"os"
+)
+
+func serveDownloadedFile(w http.ResponseWriter, r *http.Request, fileName string) error {
+	file, err := os.Open(fileName)
+	if err != nil {
+		return err
+	}
+	defer file.Close()
+	info, err := file.Stat()
+	if err != nil {
+		return err
+	}
+
+	w.Header().Set("status", "success")
+	w.Header().Set("Content-Disposition", "attachment;filename="+info.Name())
+	// ServeFile redirects /index.html to ./, which does not match the download route.
+	http.ServeContent(w, r, info.Name(), info.ModTime(), file)
+	return nil
+}
```

**File**: `api/controller/file_download_test.go` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+package controller
+
+import (
+	"net/http"
+	"net/http/httptest"
+	"net/url"
+	"os"
+	"path/filepath"
+	"strconv"
+	"testing"
+)
+
+func TestServeDownloadedFile(t *testing.T) {
+	tests := []struct {
+		name         string
+		fileName     string
+		content      string
+		rangeHeader  string
+		wantStatus   int
+		wantBody     string
+		contentRange string
+	}{
+		{
+			name: "index HTML does not redirect", fileName: "index.html",
+			content: "<html>download</html>", wantStatus: http.StatusOK, wantBody: "<html>download</html>",
+		},
+		{
+			name: "ordinary file", fileName: "example.txt",
+			content: "download", wantStatus: http.StatusOK, wantBody: "download",
+		},
+		{
+			name: "empty index HTML", fileName: "index.html",
+			wantStatus: http.StatusOK,
+		},
+		{
+			name: "index HTML byte range", fileName: "index.html",
+			content: "download", rangeHeader: "bytes=0-3",
+			wantStatus: http.StatusPartialContent, wantBody: "down", contentRange: "bytes 0-3/8",
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			fileName := filepath.Join(t.TempDir(), tt.fileName)
+			if err := os.WriteFile(fileName, []byte(tt.content), 0600); err != nil {
+				t.Fatal(err)
+			}
+			req := httptest.NewRequest(http.MethodGet, "/v2/file-operate/download/"+url.PathEscape(tt.fileName)+
+				"?path=/usr/share/nginx/html/e%2Fxz&fileName="+url.QueryEscape(tt.fileName), nil)
+			if tt.rangeHeader != "" {
+				req.Header.Set("Range", tt.rangeHeader)
+			}
+			w := httptest.NewRecorder()
+			w.Header().Set("Content-Type", "application/octet-stream")
+			w.Header().Set("status", "failed")
+			if err := serveDownloadedFile(w, req, fileName); err != nil {
+				t.Fatalf("serve downloaded file: %v", err)
+			}
+			if w.Code != tt.wantStatus {
+				t.Fatalf("status = %d, want %d; Location = %q", w.Code, tt.wantStatus, w.Header().Get("Location"))
+			}
+			if location := w.Header().Get("Location"); location != "" {
+				t.Errorf("unexpected redirect to %q", location)
+			}
+			if got := w.Body.String(); got != tt.wantBody {
+				t.Errorf("body = %q, want %q", got, tt.wantBody)
+			}
+			for name, want := range map[string]string{
+				"Content-Type":        "application/octet-stream",
+				"Content-Disposition": "attachment;filename=" + tt.fileName,
+				"Content-Length":      strconv.Itoa(len(tt.wantBody)),
+				"Content-Range":       tt.contentRange,
+				"status":              "success",
+			} {
+				if got := w.Header().Get(name); got != want {
+					t.Errorf("%s = %q, want %q", name, got, want)
+				}
+			}
+		})
+	}
+}
+
+func TestServeDownloadedFileMissingFile(t *testing.T) {
+	req := httptest.NewRequest(http.MethodGet, "/v2/file-operate/download/index.html", nil)
+	w := httptest.NewRecorder()
+	w.Header().Set("status", "failed")
+	err := serveDownloadedFile(w, req, filepath.Join(t.TempDir(), "index.html"))
+	if !os.IsNotExist(err) {
+		t.Fatalf("error = %v, want file-not-found error", err)
+	}
+	if w.Header().Get("status") != "failed" || w.Header().Get("Content-Disposition") != "" || w.Body.Len() != 0 {
+		t.Fatal("missing file must leave the response uncommitted for the caller's error handler")
+	}
+}
```

**File**: `api/controller/service_monitor.go` (modified, +8/-5)
```diff
@@ -170,6 +170,7 @@ func (f FileManage) UploadEvent(w http.ResponseWriter, r *http.Request) {
 	httputil.ReturnSuccess(r, w, nil)
 }
 
+// UploadFile uploads files to a container in the selected pod.
 func (f FileManage) UploadFile(w http.ResponseWriter, r *http.Request) {
 	// 设置 CORS 头
 	origin := r.Header.Get("Origin")
@@ -357,6 +358,7 @@ func resolveUploadRelativePath(fileHeader *multipart.FileHeader) (string, bool,
 	return cleaned, strings.Contains(cleaned, "/"), nil
 }
 
+// DownloadFile serves a file downloaded from a container in the selected pod.
 func (f FileManage) DownloadFile(w http.ResponseWriter, r *http.Request) {
 	logrus.Debugf("接收到文件下载请求: Method=%s, ContentType=%s", r.Method, r.Header.Get("Content-Type"))
 
@@ -400,14 +402,14 @@ func (f FileManage) DownloadFile(w http.ResponseWriter, r *http.Request) {
 		}
 	}()
 
-	// 设置成功状态和文件下载头
-	w.Header().Set("status", "success")
-	w.Header().Set("Content-Disposition", "attachment;filename="+fileName)
-
 	logrus.Debugf("开始传输文件: %s", fileName)
-	http.ServeFile(w, r, fileName)
+	if err := serveDownloadedFile(w, r, fileName); err != nil {
+		logrus.Errorf("读取下载文件失败: %v", err)
+		httputil.ReturnError(r, w, 500, fmt.Sprintf("下载文件失败: %v", err))
+	}
 }
 
+// AppFileDownload copies a file or directory from a container to local storage.
 func (f FileManage) AppFileDownload(containerName, podName, filePath, namespace string) error {
 	// Check if the file exists first
 	checkCmd := []string{"test", "-e", filePath}
@@ -568,6 +570,7 @@ func (f FileManage) downloadUsingTar(containerName, podName, filePath, namespace
 	return nil
 }
 
+// AppFileUpload copies a local file or directory into a container.
 func (f FileManage) AppFileUpload(containerName, podName, srcPath, destPath, namespace string) error {
 	logrus.Debugf("开始上传目录/文件: 源路径=%s, 目标路径=%s", srcPath, destPath)
 
```

---

### Incident Patch 2: `0384d977` (2026-09-20)
**Commit Message**: fix: tolerate dedicated node taints in source builds (#2704)

Signed-off-by: Qi Zhang <smallqi1@163.com>

**File**: `builder/build/code_build.go` (modified, +41/-41)
```diff
@@ -22,7 +22,6 @@ import (
 	"context"
 	"encoding/json"
 	"fmt"
-	"github.com/goodrain/rainbond/db"
 	"io"
 	"io/ioutil"
 	"os"
@@ -31,6 +30,8 @@ import (
 	"strings"
 	"time"
 
+	"github.com/goodrain/rainbond/db"
+
 	"github.com/eapache/channels"
 	"github.com/goodrain/rainbond/builder"
 	jobc "github.com/goodrain/rainbond/builder/job"
@@ -317,6 +318,44 @@ func (s *slugBuild) createVolumeAndMount(re *Request, sourceTarFileName string,
 	return volumes, volumeMounts
 }
 
+func newSlugBuildPodSpec(arch, hostIP, cacheMode string) corev1.PodSpec {
+	podSpec := corev1.PodSpec{
+		RestartPolicy: corev1.RestartPolicyOnFailure,
+		Affinity: &corev1.Affinity{
+			NodeAffinity: &corev1.NodeAffinity{
+				RequiredDuringSchedulingIgnoredDuringExecution: &corev1.NodeSelector{
+					NodeSelectorTerms: []corev1.NodeSelectorTerm{{
+						MatchExpressions: []corev1.NodeSelectorRequirement{
+							{
+								Key:      "kubernetes.io/arch",
+								Operator: corev1.NodeSelectorOpIn,
+								Values:   []string{arch},
+							},
+							{
+								Key:      "kubernetes.io/hostname",
+								Operator: corev1.NodeSelectorOpIn,
+								Values:   []string{hostIP},
+							},
+						},
+					},
+					},
+				},
+			},
+		},
+	}
+	if hostIP != "" {
+		// All cache modes use the current chaos node, including dedicated or cordoned nodes.
+		podSpec.Tolerations = []corev1.Toleration{{Operator: corev1.TolerationOpExists}}
+		if cacheMode == "hostpath" {
+			logrus.Debugf("builder cache mode using hostpath, schedule job into current node")
+			podSpec.NodeSelector = map[string]string{
+				"kubernetes.io/hostname": hostIP,
+			}
+		}
+	}
+	return podSpec
+}
+
 func (s *slugBuild) runBuildJob(re *Request) error {
 
 	//prepare build code dir
@@ -454,46 +493,7 @@ func (s *slugBuild) runBuildJob(re *Request) error {
 		}
 	}
 
-	podSpec := corev1.PodSpec{
-		RestartPolicy: corev1.RestartPolicyOnFailure,
-		Affinity: &corev1.Affinity{
-			NodeAffinity: &corev1.NodeAffinity{
-				RequiredDuringSchedulingIgnoredDuringExecution: &corev1.NodeSelector{
-					NodeSelectorTerms: []corev1.NodeSelectorTerm{{
-						MatchExpressions: []corev1.NodeSelectorRequirement{
-							{
-								Key:      "kubernetes.io/arch",
-								Operator: corev1.NodeSelectorOpIn,
-								Values:   []string{re.Arch},
-							},
-							{
-								Key:      "kubernetes.io/hostname",
-								Operator: corev1.NodeSelectorOpIn,
-								Values:   []string{os.Getenv("HOST_IP")},
-							},
-						},
-					},
-					},
-				},
-			},
-		},
-	}
-	// only support never and onfailure
-	// schedule builder
-	if re.CacheMode == "hostpath" {
-		logrus.Debugf("builder cache mode using hostpath, schedule job into current node")
-		hostIP := os.Getenv("HOST_IP")
-		if hostIP != "" {
-			podSpec.NodeSelector = map[string]string{
-				"kubernetes.io/hostname": hostIP,
-			}
-			podSpec.Tolerations = []corev1.Toleration{
-				{
-					Operator: "Exists",
-				},
-			}
-		}
-	}
+	podSpec := newSlugBuildPodSpec(re.Arch, os.Getenv("HOST_IP"), re.CacheMode)
 	logrus.Debugf("request is: %+v", re)
 
 	volumes, mounts := s.createVolumeAndMount(re, sourceTarFileName, buildNoCache)
```

**File**: `builder/build/code_build_scheduling_test.go` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+package build
+
+import (
+	"reflect"
+	"testing"
+
+	corev1 "k8s.io/api/core/v1"
+)
+
+func TestNewSlugBuildPodSpecToleratesDedicatedNode(t *testing.T) {
+	for _, cacheMode := range []string{"", "sharefile", "hostpath"} {
+		for _, arch := range []string{"amd64", "arm64"} {
+			t.Run(cacheMode+"/"+arch, func(t *testing.T) {
+				spec := newSlugBuildPodSpec(arch, "chaos-node", cacheMode)
+				for _, taint := range []corev1.Taint{
+					{Key: corev1.TaintNodeUnschedulable, Effect: corev1.TaintEffectNoSchedule},
+					{Key: "dedicated", Value: "rbd-chaos", Effect: corev1.TaintEffectNoSchedule},
+					{Key: "dedicated", Value: "rbd-chaos", Effect: corev1.TaintEffectNoExecute},
+				} {
+					tolerated := false
+					for _, toleration := range spec.Tolerations {
+						if toleration.ToleratesTaint(&taint) {
+							tolerated = true
+							break
+						}
+					}
+					if !tolerated {
+						t.Errorf("build pod does not tolerate dedicated node taint %v", taint)
+					}
+				}
+
+				if spec.Affinity == nil || spec.Affinity.NodeAffinity == nil {
+					t.Fatal("build pod must remain restricted to the current chaos node and architecture")
+				}
+				want := &corev1.NodeSelector{
+					NodeSelectorTerms: []corev1.NodeSelectorTerm{{
+						MatchExpressions: []corev1.NodeSelectorRequirement{
+							{Key: "kubernetes.io/arch", Operator: corev1.NodeSelectorOpIn, Values: []string{arch}},
+							{Key: "kubernetes.io/hostname", Operator: corev1.NodeSelectorOpIn, Values: []string{"chaos-node"}},
+						},
+					}},
+				}
+				if got := spec.Affinity.NodeAffinity.RequiredDuringSchedulingIgnoredDuringExecution; !reflect.DeepEqual(got, want) {
+					t.Errorf("required node affinity = %#v, want %#v", got, want)
+				}
+				if cacheMode == "hostpath" && spec.NodeSelector["kubernetes.io/hostname"] != "chaos-node" {
+					t.Errorf("hostpath node selector = %v, want chaos-node", spec.NodeSelector)
+				}
+				if spec.RestartPolicy != corev1.RestartPolicyOnFailure {
+					t.Errorf("restart policy = %q, want OnFailure", spec.RestartPolicy)
+				}
+			})
+		}
+	}
+}
+
+func TestNewSlugBuildPodSpecWithoutHostDoesNotTolerateTaints(t *testing.T) {
+	for _, cacheMode := range []string{"", "sharefile", "hostpath"} {
+		t.Run(cacheMode, func(t *testing.T) {
+			spec := newSlugBuildPodSpec("amd64", "", cacheMode)
+			if len(spec.Tolerations) != 0 {
+				t.Errorf("expected no taint tolerations without a target host, got %v", spec.Tolerations)
+			}
+		})
+	}
+}
```

---

### Incident Patch 3: `738c839f` (2026-09-20)
**Commit Message**: fix: report Kubernetes errors when creating TCP routes (#2703)

Signed-off-by: Qi Zhang <smallqi1@163.com>

**File**: `api/controller/apigateway/api_gateway_route.go` (modified, +5/-1)
```diff
@@ -707,7 +707,11 @@ func (g Struct) CreateTCPRoute(w http.ResponseWriter, r *http.Request) {
 				} else {
 					// 其他错误，返回失败
 					logrus.Errorf("create tcp rule func, create svc failure: %s", err.Error())
-					httputil.ReturnBcodeError(r, w, bcode.ErrServiceCreate)
+					httputil.ReturnBcodeError(r, w, &bcode.Code{
+						Status:  bcode.ErrServiceCreate.GetStatus(),
+						Code:    bcode.ErrServiceCreate.GetCode(),
+						Message: fmt.Sprintf("%s: %s", bcode.ErrServiceCreate.Error(), err.Error()),
+					})
 					return
 				}
 			}
```

**File**: `api/controller/apigateway/api_gateway_route_test.go` (modified, +78/-1)
```diff
@@ -12,6 +12,7 @@ import (
 
 	v2 "github.com/apache/apisix-ingress-controller/pkg/kube/apisix/apis/config/v2"
 	"github.com/go-chi/chi"
+	"github.com/goodrain/rainbond/api/util/bcode"
 	ctxutil "github.com/goodrain/rainbond/api/util/ctx"
 	"github.com/goodrain/rainbond/db"
 	dbdao "github.com/goodrain/rainbond/db/dao"
@@ -25,6 +26,7 @@ import (
 	"k8s.io/apimachinery/pkg/runtime/schema"
 	"k8s.io/apimachinery/pkg/runtime/serializer"
 	"k8s.io/apimachinery/pkg/util/intstr"
+	"k8s.io/apimachinery/pkg/util/validation/field"
 	"k8s.io/client-go/kubernetes"
 	"k8s.io/client-go/rest"
 )
@@ -160,7 +162,7 @@ func (d *tcpRouteRuleDao) DeleteByRecordIDs(ids []uint) error {
 	return nil
 }
 
-func newTCPRouteTestClientset(t *testing.T, services map[string]*corev1.Service) (*kubernetes.Clientset, func()) {
+func newTCPRouteTestClientset(t *testing.T, services map[string]*corev1.Service, createErrors ...*errors.StatusError) (*kubernetes.Clientset, func()) {
 	t.Helper()
 	scheme := runtime.NewScheme()
 	if err := corev1.AddToScheme(scheme); err != nil {
@@ -204,6 +206,13 @@ func newTCPRouteTestClientset(t *testing.T, services map[string]*corev1.Service)
 			if err := json.NewDecoder(r.Body).Decode(&service); err != nil {
 				t.Fatalf("decode service: %v", err)
 			}
+			if len(createErrors) > 0 {
+				status := createErrors[0].ErrStatus
+				status.TypeMeta = v1.TypeMeta{Kind: "Status", APIVersion: "v1"}
+				w.WriteHeader(int(status.Code))
+				_ = json.NewEncoder(w).Encode(status)
+				return
+			}
 			for _, existing := range services {
 				for _, existingPort := range existing.Spec.Ports {
 					for _, requestedPort := range service.Spec.Ports {
@@ -637,6 +646,74 @@ func TestCreateTCPRouteRejectsExplicitPortOwnedByAnotherService(t *testing.T) {
 	}
 }
 
+// capability_id: rainbond.gateway.report-tcp-service-create-error-details
+func TestCreateTCPRouteReportsServiceCreateErrorDetails(t *testing.T) {
+	const (
+		tenantID    = "tenant-id"
+		serviceID   = "service-id"
+		serviceName = "op-tspnetty-server"
+	)
+	tests := []struct {
+		name       string
+		port       int32
+		validRange string
+	}{
+		{name: "below default range", port: 10007, validRange: "30000-32767"},
+		{name: "above default range", port: 32768, validRange: "30000-32767"},
+		{name: "custom cluster range", port: 30000, validRange: "10000-20000"},
+		{name: "other creation failure", port: 30000},
+	}
+	for _, tt := range tests {
+		for _, protocol := range []string{"tcp", "udp", "tcp+udp"} {
+			t.Run(tt.name+"/"+protocol, func(t *testing.T) {
+				createErr := errors.NewInternalError(fmt.Errorf("failed to allocate a service IP"))
+				if tt.validRange != "" {
+					createErr = errors.NewInvalid(schema.GroupKind{Kind: "Service"}, fmt.Sprintf("%s-%d", serviceName, tt.port), field.ErrorList{
+						field.Invalid(field.NewPath("spec", "ports").Index(0).Child("nodePort"), tt.port,
+							"provided port is not in the valid range. The range of valid ports is "+tt.validRange),
+					})
+				}
+				services := map[string]*corev1.Service{}
+				clientset, closeServer := newTCPRouteTestClientset(t, services, createErr)
+				t.Cleanup(closeServer)
+				k8s.New().Clientset = clientset
+				ruleDao := &tcpRouteRuleDao{}
+				db.SetTestManager(tcpRouteTestManager{
+					tenantServiceDao: &tcpRouteTenantServiceDao{servicesByID: map[string]*dbmodel.TenantServices{
+						serviceID: {ServiceID: serviceID, ServiceAlias: serviceName, TenantID: tenantID},
+					}},
+					tcpRuleDao: ruleDao,
+				})
+				t.Cleanup(func() { db.SetTestManager(nil) })
+
+				rr := createTCPRouteForTest(t, "default", tenantID, serviceID, serviceName, tt.port, protocol)
+				if rr.Code != http.StatusBadRequest {
+					t.Fatalf("expected status 400, got %d: %s", rr.Code, rr.Body.String())
+				}
+				var response struct {
+					Code int    `json:"code"`
+					Msg  string `json:"msg"`
+				}
+				if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
+					t.Fatalf("decode creation error response
```

**File**: `test-manifest.json` (modified, +18/-0)
```diff
@@ -2951,6 +2951,24 @@
       "test_type": "regression",
       "status": "active"
     },
+    {
+      "id": "rainbond.gateway.report-tcp-service-create-error-details",
+      "title": "TCP route creation reports Kubernetes error details",
+      "title_zh": "TCP route creation reports Kubernetes error details",
+      "interface_type": "view_endpoint",
+      "interface": "POST /api-gateway/v1/{tenant_name}/routes/tcp",
+      "code_paths": [
+        "api/controller/apigateway/api_gateway_route.go"
+      ],
+      "tests": [
+        {
+          "path": "api/controller/apigateway/api_gateway_route_test.go",
+          "selector": "TestCreateTCPRouteReportsServiceCreateErrorDetails"
+        }
+      ],
+      "test_type": "regression",
+      "status": "active"
+    },
     {
       "id": "rainbond.gateway.validate-tcp-nodeport-route-name",
       "title": "Reject out-of-range TCP NodePorts parsed from route names",
```

**File**: `test-manifest.md` (modified, +11/-0)
```diff
@@ -161,6 +161,7 @@
 | rainbond.gateway.reject-duplicate-tcp-nodeport | Reject duplicate TCP NodePort bindings | active | regression | TCP NodePort binding | db/mysql/dao/gateway_test.go::TestTCPRuleDaoAddModelRejectsPortOwnedByAnotherRule<br>api/controller/apigateway/api_gateway_route_test.go::TestCreateTCPRouteRejectsExplicitPortOwnedByAnotherService |
 | rainbond.gateway.release-absent-tcp-nodeport-owner | Release only the requested owner when a TCP route Service is absent | active | regression | api/controller/apigateway.Struct.DeleteTCPRoute | api/controller/apigateway/api_gateway_route_test.go::TestDeleteTCPRouteAlreadyAbsentReleasesOnlyRequestedOwner |
 | rainbond.gateway.release-captured-tcp-nodeport-rules | Release only TCP NodePort rules captured before Service deletion | active | regression | api/controller/apigateway.Struct.DeleteTCPRoute | api/controller/apigateway/api_gateway_route_test.go::TestDeleteTCPRouteReleasesOnlyCapturedRuleIDs |
+| rainbond.gateway.report-tcp-service-create-error-details | TCP route creation reports Kubernetes error details | active | regression | POST /api-gateway/v1/{tenant_name}/routes/tcp | api/controller/apigateway/api_gateway_route_test.go::TestCreateTCPRouteReportsServiceCreateErrorDetails |
 | rainbond.gateway.validate-tcp-nodeport-route-name | Reject out-of-range TCP NodePorts parsed from route names | active | regression | api/controller/apigateway.nodePortFromTCPRouteName | api/controller/apigateway/api_gateway_route_test.go::TestNodePortFromTCPRouteNameValidatesRange |
 | rainbond.helm-release.app-version-format | 为 Helm 历史输出格式化应用版本号 | active | regression | pkg/helm.formatAppVersion | pkg/helm/helm_release_test.go::TestGetReleaseHistory |
 | rainbond.helm-release.chart-name-format | 为历史和摘要输出格式化 Helm chart 名称 | active | regression | pkg/helm.formatChartName | pkg/helm/helm_release_test.go::TestGetReleaseHistory |
@@ -2069,6 +2070,16 @@
 - 代码路径: `api/controller/apigateway/api_gateway_route.go`
 - 测试路径: `api/controller/apigateway/api_gateway_route_test.go::TestDeleteTCPRouteReleasesOnlyCapturedRuleIDs`
 
+### TCP route creation reports Kubernetes error details
+
+- Capability ID: `rainbond.gateway.report-tcp-service-create-error-details`
+- 状态: `active`
+- 测试类型: `regression`
+- 接口类型: `view_endpoint`
+- 业务入口: `POST /api-gateway/v1/{tenant_name}/routes/tcp`
+- 代码路径: `api/controller/apigateway/api_gateway_route.go`
+- 测试路径: `api/controller/apigateway/api_gateway_route_test.go::TestCreateTCPRouteReportsServiceCreateErrorDetails`
+
 ### Reject out-of-range TCP NodePorts parsed from route names
 
 - Capability ID: `rainbond.gateway.validate-tcp-nodeport-route-name`
```

---

### Incident Patch 4: `249ca2a7` (2026-09-17)
**Commit Message**: fix: preserve custom component configuration during upgrades (#2701)

Signed-off-by: Qi Zhang <smallqi1@163.com>

**File**: `api/controller/cluster.go` (modified, +4/-1)
```diff
@@ -43,6 +43,7 @@ import (
 	"github.com/jinzhu/gorm"
 	"github.com/sirupsen/logrus"
 	"k8s.io/apimachinery/pkg/types"
+	k8sclient "sigs.k8s.io/controller-runtime/pkg/client"
 
 	httputil "github.com/goodrain/rainbond/util/http"
 )
@@ -447,9 +448,11 @@ func (c *ClusterController) Upgrade(w http.ResponseWriter, r *http.Request) {
 			res = append(res, fmt.Sprintf(`%s获取异常%s`, k, err.Error()))
 			continue
 		}
+		original := cpt.DeepCopy()
 		cpt.Spec.Image = v
 		logrus.Infof("upgrade [%s] image to [%s]", k, v)
-		err = k8s.Default().K8sClient.Update(context.Background(), &cpt)
+		// Patch only the image so fields absent from the vendored CRD type are preserved.
+		err = k8s.Default().K8sClient.Patch(context.Background(), &cpt, k8sclient.MergeFrom(original))
 		if err != nil {
 			res = append(res, fmt.Sprintf(`%s更新异常%s`, k, err.Error()))
 			continue
```

**File**: `api/controller/cluster_upgrade_test.go` (added, +199/-0)
```diff
@@ -0,0 +1,199 @@
+package controller
+
+import (
+	"encoding/json"
+	"io"
+	"net/http"
+	"net/http/httptest"
+	"reflect"
+	"strings"
+	"testing"
+
+	jsonpatch "github.com/evanphx/json-patch/v5"
+	"github.com/goodrain/rainbond-operator/api/v1alpha1"
+	"github.com/goodrain/rainbond/pkg/component/k8s"
+	httputil "github.com/goodrain/rainbond/util/http"
+	"k8s.io/apimachinery/pkg/api/meta"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+	"k8s.io/client-go/rest"
+	k8sclient "sigs.k8s.io/controller-runtime/pkg/client"
+)
+
+// capability_id: rainbond.cluster.upgrade-preserves-component-config
+func TestUpgradePreservesComponentConfig(t *testing.T) {
+	for _, tc := range []struct {
+		name      string
+		namespace string
+		image     string
+	}{
+		{name: "new image", image: "example.invalid/rainbond:new"},
+		{name: "same image", image: "example.invalid/rainbond:old"},
+		{name: "custom namespace", namespace: "custom-system", image: "example.invalid/rainbond:new"},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Setenv("RBD_NAMESPACE", tc.namespace)
+			namespace := tc.namespace
+			if namespace == "" {
+				namespace = "rbd-system"
+			}
+			// affinity and tolerations are valid CRD fields missing from the vendored Go type.
+			stored := []byte(`{
+				"apiVersion":"rainbond.io/v1alpha1","kind":"RbdComponent",
+				"metadata":{"name":"rbd-app-ui","namespace":"` + namespace + `","resourceVersion":"42",
+					"labels":{"custom":"keep"},"annotations":{"custom":"keep"}},
+				"spec":{"image":"example.invalid/rainbond:old","replicas":3,"priorityComponent":false,
+					"imagePullPolicy":"IfNotPresent","args":["--custom"],
+					"env":[{"name":"DB_TYPE","value":"mysql"}],
+					"resources":{"requests":{"cpu":"100m"}},
+					"volumes":[{"name":"custom","emptyDir":{}}],
+					"volumeMounts":[{"name":"custom","mountPath":"/custom"}],
+					"affinity":{"nodeAffinity":{"requiredDuringSchedulingIgnoredDuringExecution":{
+						"nodeSelectorTerms":[{"matchFields":[{"key":"metadata.name","operator":"In","values":["custom-node"]}]}]}}},
+					"tolerations":[{"key":"node.kubernetes.io/unschedulable","operator":"Exists","effect":"NoSchedule"}]},
+				"status":{"conditions":[{"type":"ClusterConfigCompeleted","status":"True","reason":"ConfigCompleted"}]}
+			}`)
+			var expected map[string]interface{}
+			if err := json.Unmarshal(stored, &expected); err != nil {
+				t.Fatal(err)
+			}
+			expected["spec"].(map[string]interface{})["image"] = tc.image
+			writes := 0
+			setUpgradeTestClient(t, func(w http.ResponseWriter, r *http.Request) {
+				w.Header().Set("Content-Type", "application/json")
+				if want := "/apis/rainbond.io/v1alpha1/namespaces/" + namespace + "/rbdcomponents/rbd-app-ui"; r.URL.Path != want {
+					t.Errorf("unexpected request path: %s", r.URL.Path)
+					http.NotFound(w, r)
+					return
+				}
+				switch r.Method {
+				case http.MethodGet:
+				case http.MethodPut, http.MethodPatch:
+					writes++
+					body, err := io.ReadAll(r.Body)
+					if err != nil {
+						t.Error(err)
+						w.WriteHeader(http.StatusInternalServerError)
+						return
+					}
+					if r.Method == http.MethodPatch {
+						if got := r.Header.Get("Content-Type"); got != "application/merge-patch+json" {
+							t.Errorf("unexpected patch type: %s", got)
+						}
+						stored, err = jsonpatch.MergePatch(stored, body)
+						if err != nil {
+							t.Error(err)
+							w.WriteHeader(http.StatusInternalServerError)
+							return
+						}
+					} else {
+						stored = body
+					}
+				default:
+					t.Errorf("unexpected method: %s", r.Method)
+					w.WriteHeader(http.StatusMethodNotAllowed)
+					return
+				}
+				_, _ = w.Write(stored)
+			})
+
+			response := runUpgradeRequest(t, `{"rbd-app-ui":"`+tc.image+`"}`)
+			if len(response.List.([]interface{})) != 0 {
+				t.Fatalf("unexpected component errors: %v", response.List)
+			}
+			if writes != 1 {
+				t.Fatalf("expected one component write, got %d", writes)
+			}
+	
```

**File**: `test-manifest.json` (modified, +18/-0)
```diff
@@ -853,6 +853,24 @@
       "test_type": "regression",
       "status": "active"
     },
+    {
+      "id": "rainbond.cluster.upgrade-preserves-component-config",
+      "title": "Preserve custom component configuration during image upgrades",
+      "title_zh": "Preserve custom component configuration during image upgrades",
+      "interface_type": "view_endpoint",
+      "interface": "POST /v2/cluster/rbd-upgrade",
+      "code_paths": [
+        "api/controller/cluster.go"
+      ],
+      "tests": [
+        {
+          "path": "api/controller/cluster_upgrade_test.go",
+          "selector": "TestUpgradePreservesComponentConfig"
+        }
+      ],
+      "test_type": "regression",
+      "status": "active"
+    },
     {
       "id": "rainbond.cnb-version.extract-major",
       "title": "Extract major version from CNB spec",
```

**File**: `test-manifest.md` (modified, +11/-0)
```diff
@@ -51,6 +51,7 @@
 | rainbond.cluster-resource.exclude-terminal-pods | 从集群资源分配统计中排除终态 Pod | active | regression | api/handler.(*TenantAction).initClusterResource | api/handler/resource_query_scope_test.go::TestInitClusterResourceExcludesTerminalPods |
 | rainbond.cluster-resource.handler-singleton | 复用集群资源处理器单例 | active | unit | api/handler.GetClusterResourceHandler | api/handler/cluster_resource_test.go::TestGetClusterResourceHandlerSingleton |
 | rainbond.cluster-resource.validate-gvr | 校验集群资源 GVR 参数 | active | regression | api/handler.validateGVRParams | api/handler/cluster_resource_test.go::TestValidateGVRParams |
+| rainbond.cluster.upgrade-preserves-component-config | Preserve custom component configuration during image upgrades | active | regression | POST /v2/cluster/rbd-upgrade | api/controller/cluster_upgrade_test.go::TestUpgradePreservesComponentConfig |
 | rainbond.cnb-version.extract-major | 从 CNB 版本表达式提取主版本 | active | regression | builder/parser/code.extractMajorFromSpec | builder/parser/code/cnb_versions_test.go::TestExtractMajorFromSpec |
 | rainbond.cnb-version.golang-order-and-default | 保持 Go CNB 版本顺序并将最新版本设为默认 | active | regression | builder/parser/code.GetCNBVersions | builder/parser/code/cnb_versions_test.go::TestGetCNBVersionsGoOrderingAndDefault |
 | rainbond.cnb-version.match-golang | 归一化并匹配 Go CNB 版本表达式 | active | regression | builder/parser/code.MatchCNBVersion | builder/parser/code/cnb_versions_test.go::TestMatchCNBVersion_Golang |
@@ -968,6 +969,16 @@
 - 代码路径: `api/handler/cluster_resource.go`
 - 测试路径: `api/handler/cluster_resource_test.go::TestValidateGVRParams`
 
+### Preserve custom component configuration during image upgrades
+
+- Capability ID: `rainbond.cluster.upgrade-preserves-component-config`
+- 状态: `active`
+- 测试类型: `regression`
+- 接口类型: `view_endpoint`
+- 业务入口: `POST /v2/cluster/rbd-upgrade`
+- 代码路径: `api/controller/cluster.go`
+- 测试路径: `api/controller/cluster_upgrade_test.go::TestUpgradePreservesComponentConfig`
+
 ### 从 CNB 版本表达式提取主版本
 
 - Capability ID: `rainbond.cnb-version.extract-major`
```

---

### Incident Patch 5: `97ec53b0` (2026-09-16)
**Commit Message**: fix: README desc (#2700)

**File**: `README-zh.md` (modified, +37/-24)
```diff
@@ -1,43 +1,56 @@
-# Rainbond
-
-[English](./README.md)
-
-> **AI 生成，Rainbond 运行。始终由你掌控。**
-
-Rainbond 是 AI 应用运行平台。
-
-核心能力 100% 开源。它统一承载和管理 AI 生成的项目、大模型服务、开源 AI 软件及业务应用，通过 AI 完成部署、排错、升级与运维，让应用以容器方式稳定运行在用户自己的服务器或 Kubernetes 上。
-
-通过 [Rainskills](https://github.com/goodrain/rainskills)，Codex、Claude Code 等 AI Agent 可以直接将项目部署到 Rainbond，并完成排错和交付验证。
-
-[让 AI 帮我部署](https://github.com/goodrain/rainskills) ·
-[免费体验](https://run.rainbond.com) ·
-[安装 Rainbond](https://www.rainbond.com/docs/quick-start/quick-install) ·
-[查看文档](https://www.rainbond.com/docs)
+<div align="center">
+  <img src="https://static.goodrain.com/logo/logo-long.png" width="60%" alt="Rainbond Logo" />
+
+  <p><a href="./README.md">English</a></p>
+
+  <p>
+    <a href="https://github.com/goodrain/rainbond/stargazers">
+      <img src="https://img.shields.io/github/stars/goodrain/rainbond.svg?style=flat-square" alt="GitHub stars" />
+    </a>
+    <img src="https://img.shields.io/badge/version-v6.X-brightgreen.svg?style=flat-square" alt="Rainbond version" />
+    <a href="https://discord.com/invite/czusNpcymS">
+      <img src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&amp;logo=discord" alt="Discord" />
+    </a>
+  </p>
+</div>
+
+<div align="center">
+  <h2>不用懂 Kubernetes 的开源容器平台</h2>
+  <p>通过图形化界面，在 Kubernetes 上构建、部署、组装和管理应用，无需掌握 K8s 专业知识。</p>
+  <p>
+    <a href="https://www.rainbond.com?channel=github">项目官网</a> ·
+    <a href="https://www.rainbond.com/docs?channel=github">文档</a>
+  </p>
+</div>
+
+## Rainbond 是什么？
+  <p>
+    <a href="[https://www.bilibili.com/video/BV1Lzo5BGEuc](https://www.bilibili.com/video/BV1Lzo5BGEuc)">
+      <img src="./docs/rainbond-video.png" width="80%" alt="Rainbond 视频介绍" />
+    </a>
+  </p>
+
+Rainbond 是一款不用懂 Kubernetes 的开源容器平台，核心能力 100% 开源。
+
+它屏蔽底层技术复杂性，统一部署和管理业务应用、AI 生成的项目、开源 AI 软件及大模型服务，让 AI 帮助团队完成部署和运维，让应用稳定运行在自己的服务器或 Kubernetes 集群中。
 
 ## 从哪里开始
 
 | 你的目标 | 推荐入口 |
 | --- | --- |
-| 我正在使用 AI 编程，想把项目部署上线 | [安装 Rainskills](https://github.com/goodrain/rainskills) |
+| 我正在使用 AI 编程，想把项目部署上线 | [安装 RainSkills](https://github.com/goodrain/rainskills) |
 | 我想快速体验，不准备服务器 | [使用 Rainbond Cloud](https://run.rainbond.com) |
 | 我想运行在自己的服务器或 Kubernetes | [私有化安装 Rainbond](https://www.rainbond.com/docs/quick-start/quick-install) |
 | 我想部署 Dify、RAGFlow 等开源应用 | [访问 Rainbond 应用市场](https://hub.rainbond.com) |
 | 我正在选型开源容器平台 | [了解 Rainbond 的应用管理与交付能力](https://www.rainbond.com/compare) |
 
-## 不只是 AI 应用
-
-Rainbond 的新入口面向 AI 编程，但底层应用运行能力没有改变。
-
-源码、容器镜像、Docker Compose、Helm、传统业务系统和微服务应用，仍然可以通过 Rainbond 完成部署、管理、升级、回滚、离线交付和信创适配。
-
 ---
 
 ## Rainbond 解决什么问题
 
 ### 1. 不会 Kubernetes，也能把应用交付起来
 
-Rainbond 通过图形化界面和标准化流程，把源码、镜像、应用模板、依赖关系、访问入口、升级回滚等动作收进同一条应用链路里。
+Rainbond 支持从源码、容器镜像、Docker Compose、Helm 或应用模板部署应用，通过图形化界面和标准化流程，统一管理应用依赖、访问入口、升级与回滚。
 
 ### 2. 让复杂企业环境的交付更稳
 
```

**File**: `README.md` (modified, +27/-18)
```diff
@@ -1,43 +1,52 @@
-# Rainbond
+<div align="center">
+  <img src="https://static.goodrain.com/logo/logo-long.png" width="60%" alt="Rainbond Logo" />
 
-[中文](./README-zh.md)
+  <p><a href="./README-zh.md">中文</a></p>
 
-> **Built by AI. Run by Rainbond. Always under your control.**
+  <p>
+    <a href="https://github.com/goodrain/rainbond/stargazers">
+      <img src="https://img.shields.io/github/stars/goodrain/rainbond.svg?style=flat-square" alt="GitHub stars" />
+    </a>
+    <img src="https://img.shields.io/badge/version-v6.X-brightgreen.svg?style=flat-square" alt="Rainbond version" />
+    <a href="https://discord.com/invite/czusNpcymS">
+      <img src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&amp;logo=discord" alt="Discord" />
+    </a>
+  </p>
+</div>
 
-Rainbond is an AI application runtime platform.
+<div align="center">
+  <h2>An open-source container platform. No Kubernetes expertise required.</h2>
+  <p>Build, deploy, assemble, and manage applications on Kubernetes through a graphical interface, without K8s expertise.</p>
+  <p>
+    <a href="https://www.rainbond.io?channel=github">Website</a> ·
+    <a href="https://www.rainbond.io/docs/?channel=github">Documentation</a>
+  </p>
+</div>
 
-Its core capabilities are 100% open source. Rainbond provides a unified platform for running and managing AI-generated projects, large language model services, open-source AI software, and business applications. With AI-powered deployment, troubleshooting, upgrades, and operations, it keeps applications running reliably in containers on your own servers or Kubernetes clusters.
+## What is Rainbond?
 
-Through [Rainskills](https://github.com/goodrain/rainskills), AI agents such as Codex and Claude Code can deploy projects directly to Rainbond, troubleshoot issues, and verify delivery.
+Rainbond is an open-source container platform that requires no Kubernetes expertise. Its core capabilities are 100% open source.
+
+It abstracts away infrastructure complexity and provides a unified way to deploy and manage business applications, AI-generated projects, open-source AI software, and large language model services. AI helps teams deploy and operate these workloads, keeping applications running reliably on their own servers or Kubernetes clusters.
 
-[Deploy with AI](https://github.com/goodrain/rainskills) ·
-[Try for free](https://run.rainbond.com) ·
-[Install Rainbond](https://www.rainbond.com/docs/quick-start/quick-install) ·
-[Documentation](https://www.rainbond.com/docs)
 
 ## Where to start
 
 | Your goal | Start here |
 | --- | --- |
-| I use AI coding and want to deploy my project | [Install Rainskills](https://github.com/goodrain/rainskills) |
+| I use AI coding and want to deploy my project | [Install RainSkills](https://github.com/goodrain/rainskills) |
 | I want to try Rainbond without preparing a server | [Use Rainbond Cloud](https://run.rainbond.com) |
 | I want to run applications on my own servers or Kubernetes | [Install Rainbond privately](https://www.rainbond.com/docs/quick-start/quick-install) |
 | I want to deploy open-source applications such as Dify or RAGFlow | [Visit the Rainbond Application Marketplace](https://hub.rainbond.com) |
 | I am evaluating open-source container platforms | [Explore Rainbond's application management and delivery capabilities](https://www.rainbond.com/compare) |
 
-## Not just AI applications
-
-Rainbond's new entry point is designed for AI coding, but its underlying application runtime capabilities remain unchanged.
-
-Source code, container images, Docker Compose, Helm, traditional business systems, and microservice applications can still be deployed, managed, upgraded, rolled back, delivered offline, and adapted for Xinchuang environments with Rainbond.
-
 ---
 
 ## What problems Rainbond solves
 
 ### 1. Deliver applications without deeply learning Kubernetes
 
-Rainbond brings source code, images, application templates, dependencies, access, upgrades, and r
```

---

### Incident Patch 6: `b3055230` (2026-09-13)
**Commit Message**: fix: return empty arrays in resource deletion responses

Signed-off-by: Qi Zhang <smallqi1@163.com>

**File**: `api/handler/resource_deletion.go` (modified, +17/-10)
```diff
@@ -192,8 +192,9 @@ func (o *k8sResourceDeletionOrchestrator) Delete(ctx context.Context, req *model
 	}
 
 	result := &model.K8sResourceDeletionResult{
-		Status:       "completed",
-		CascadedCRDs: plan.impact.CRDs,
+		Status:           "completed",
+		DeletedClientIDs: make([]string, 0, len(req.K8sResources)),
+		CascadedCRDs:     plan.impact.CRDs,
 	}
 	for _, resource := range req.K8sResources {
 		result.DeletedClientIDs = append(result.DeletedClientIDs, resource.ClientID)
@@ -254,7 +255,10 @@ func isControllerWorkload(gvk schema.GroupVersionKind) bool {
 
 // Reconcile classifies only confirmed missing resources as safe metadata deletions.
 func (o *k8sResourceDeletionOrchestrator) Reconcile(ctx context.Context, req *model.K8sResourceReconcileRequest) *model.K8sResourceReconcileResult {
-	result := &model.K8sResourceReconcileResult{}
+	result := &model.K8sResourceReconcileResult{
+		MissingClientIDs: []string{},
+		Unknown:          []model.K8sResourceUnknown{},
+	}
 	for _, item := range req.K8sResources {
 		if item.State != model.CreateSuccess && item.State != model.UpdateSuccess {
 			continue
@@ -293,7 +297,9 @@ func (o *k8sResourceDeletionOrchestrator) buildPlan(ctx context.Context, req *mo
 	if req == nil || strings.TrimSpace(req.AppID) == "" {
 		return nil, fmt.Errorf("%w: app_id is required", ErrInvalidK8sResourceDeletionRequest)
 	}
-	plan := &k8sResourceDeletionPlan{}
+	plan := &k8sResourceDeletionPlan{
+		impact: model.K8sResourceDeletionImpact{CRDs: []model.CRDDeletionImpact{}},
+	}
 	plannedCRDs := make(map[string]struct{})
 	for _, item := range req.K8sResources {
 		if item.State != model.CreateSuccess && item.State != model.UpdateSuccess {
@@ -377,12 +383,13 @@ func (o *k8sResourceDeletionOrchestrator) buildCRDPlan(ctx context.Context, reso
 	}
 
 	impact := model.CRDDeletionImpact{
-		Name:    live.GetName(),
-		Group:   group,
-		Version: version,
-		Kind:    kind,
-		Plural:  plural,
-		Scope:   scope,
+		Name:                 live.GetName(),
+		Group:                group,
+		Version:              version,
+		Kind:                 kind,
+		Plural:               plural,
+		Scope:                scope,
+		AffectedRegionAppIDs: []string{},
 	}
 	otherApps := make(map[string]struct{})
 	for i := range list.Items {
```

**File**: `api/handler/resource_deletion_test.go` (modified, +129/-0)
```diff
@@ -2,6 +2,7 @@ package handler
 
 import (
 	"context"
+	"encoding/json"
 	"errors"
 	"fmt"
 	"testing"
@@ -31,6 +32,134 @@ var (
 	testDeploymentGVR = schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}
 )
 
+// capability_id: rainbond.k8s-resource.response-array-contract
+func TestK8sResourceDeletionResponseArrays(t *testing.T) {
+	for _, test := range []struct {
+		name     string
+		kind     string
+		instance *unstructured.Unstructured
+	}{
+		{name: "empty selection"},
+		{name: "ordinary ConfigMap", kind: "ConfigMap"},
+		{name: "CRD without instances", kind: "CustomResourceDefinition"},
+		{name: "CRD with current application instance", kind: "CustomResourceDefinition", instance: newTestWidget("owned", "team-a", "app-a")},
+		{name: "CRD with another application instance", kind: "CustomResourceDefinition", instance: newTestWidget("shared", "team-b", "app-b")},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			var objects []*unstructured.Unstructured
+			if test.instance != nil {
+				objects = append(objects, test.instance)
+			}
+			orchestrator, client := newDeletionTestOrchestrator(t, objects...)
+			req := &model.K8sResourceDeletionRequest{AppID: "app-a"}
+			wantIDs := []string{}
+			wantCRDs := []model.CRDDeletionImpact{}
+			switch test.kind {
+			case "ConfigMap":
+				orchestrator.mapper.(*meta.DefaultRESTMapper).Add(schema.GroupVersionKind{Version: "v1", Kind: "ConfigMap"}, meta.RESTScopeNamespace)
+				configMap := &unstructured.Unstructured{Object: map[string]interface{}{
+					"apiVersion": "v1", "kind": "ConfigMap",
+					"metadata": map[string]interface{}{"name": "settings", "namespace": "team-a"},
+				}}
+				if err := client.Tracker().Add(configMap); err != nil {
+					t.Fatal(err)
+				}
+				req.K8sResources = []model.HandleResource{{
+					ClientID: "config-row", AppID: "app-a", Namespace: "team-a", Name: "settings", Kind: "ConfigMap",
+					ResourceYaml: "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: settings\n  namespace: team-a\n", State: model.CreateSuccess,
+				}}
+				wantIDs = []string{"config-row"}
+			case "CustomResourceDefinition":
+				req = newCRDDeletionRequest(true)
+				wantIDs = []string{"crd-row"}
+				wantCRDs = []model.CRDDeletionImpact{{
+					Name: "widgets.example.com", Group: "example.com", Version: "v1", Kind: "Widget", Plural: "widgets", Scope: "Namespaced",
+					AffectedRegionAppIDs: []string{},
+				}}
+				if test.instance != nil {
+					if test.instance.GetLabels()[appIDLabel] == req.AppID {
+						wantCRDs[0].CurrentAppCRCount = 1
+					} else {
+						wantCRDs[0].OtherAppCRCount = 1
+						wantCRDs[0].AffectedRegionAppIDs = []string{"app-b"}
+					}
+				}
+			}
+			impact, err := orchestrator.Preview(context.Background(), req)
+			if err != nil {
+				t.Fatalf("Preview() error = %v", err)
+			}
+			assertResourceResponseJSONField(t, impact, "crds", wantCRDs)
+			for _, action := range client.Actions() {
+				if action.GetVerb() == "delete" {
+					t.Fatalf("Preview() mutated Kubernetes: %#v", action)
+				}
+			}
+			result, err := orchestrator.Delete(context.Background(), req)
+			if err != nil {
+				t.Fatalf("Delete() error = %v", err)
+			}
+			assertResourceResponseJSONField(t, result, "status", "completed")
+			assertResourceResponseJSONField(t, result, "deleted_client_ids", wantIDs)
+			assertResourceResponseJSONField(t, result, "cascaded_crds", wantCRDs)
+		})
+	}
+}
+
+func TestK8sResourceReconcileResponseArrays(t *testing.T) {
+	lookupErr := apierrors.NewForbidden(testWidgetGVR.GroupResource(), "unknown", errors.New("denied"))
+	for _, test := range []struct {
+		name        string
+		names       []string
+		wantMissing []string
+		wantUnknown []model.K8sResourceUnknown
+	}{
+		{name: "empty selection", wantMissing: []string{}, wantUnknown: []model.K8sResourceUnknown{}},
+		{name: "all present", names: []string{"present"}, wantMissing: []string{}, wantUnknown: []model.K8sResourceUnknown{}},
+		{name: "missing", name
```

**File**: `test-manifest.json` (modified, +22/-0)
```diff
@@ -3563,6 +3563,28 @@
       "test_type": "regression",
       "status": "active"
     },
+    {
+      "id": "rainbond.k8s-resource.response-array-contract",
+      "title": "Resource deletion and reconciliation responses encode empty lists as arrays",
+      "title_zh": "Resource deletion and reconciliation responses encode empty lists as arrays",
+      "interface_type": "workflow",
+      "interface": "k8sResourceDeletionOrchestrator",
+      "code_paths": [
+        "api/handler/resource_deletion.go"
+      ],
+      "tests": [
+        {
+          "path": "api/handler/resource_deletion_test.go",
+          "selector": "TestK8sResourceDeletionResponseArrays"
+        },
+        {
+          "path": "api/handler/resource_deletion_test.go",
+          "selector": "TestK8sResourceReconcileResponseArrays"
+        }
+      ],
+      "test_type": "regression",
+      "status": "active"
+    },
     {
       "id": "rainbond.k8s-resource.stop-recreating-controller",
       "title": "Stop in-application controllers before deleting generated custom resources",
```

**File**: `test-manifest.md` (modified, +11/-0)
```diff
@@ -194,6 +194,7 @@
 | rainbond.k8s-resource.deletion-timeout-final-check | Kubernetes deletion timeout performs a final live check | active | regression | api/handler.k8sResourceDeletionOrchestrator.Delete | api/handler/resource_deletion_test.go::TestK8sResourceDeletionFinalCheckAvoidsTimeoutRace |
 | rainbond.k8s-resource.failed-delete-metadata-only | Failed resources are metadata-only during deletion | active | regression | api/handler.k8sResourceDeletionOrchestrator.Delete | api/handler/resource_deletion_test.go::TestK8sResourceDeletionSkipsFailedResourceKubernetesDeletion |
 | rainbond.k8s-resource.metadata-reconcile | Kubernetes resource metadata reconciliation | active | regression | api/handler.k8sResourceDeletionOrchestrator.Reconcile | api/handler/resource_deletion_test.go::TestK8sResourceReconcileDistinguishesMissingAndUnknown |
+| rainbond.k8s-resource.response-array-contract | Resource deletion and reconciliation responses encode empty lists as arrays | active | regression | k8sResourceDeletionOrchestrator | api/handler/resource_deletion_test.go::TestK8sResourceDeletionResponseArrays<br>api/handler/resource_deletion_test.go::TestK8sResourceReconcileResponseArrays |
 | rainbond.k8s-resource.stop-recreating-controller | Stop in-application controllers before deleting generated custom resources | active | regression | api/handler.k8sResourceDeletionOrchestrator.Delete | api/handler/resource_deletion_test.go::TestK8sResourceDeletionStopsManagedControllerBeforeGeneratedResources<br>api/handler/resource_deletion_test.go::TestK8sResourceDeletionKeepsControllerUntilFinalizedResourcesAreGone |
 | rainbond.k8s.scheme-registers-kubevirt-vm | K8s scheme registers KubeVirt VirtualMachine | active | regression | pkg/component/k8s.init | pkg/component/k8s/k8sComponent_test.go::TestSchemeRegistersKubeVirtVirtualMachine |
 | rainbond.kubeblocks.component-selector | 为 KubeBlocks 组件生成标签选择器 | active | regression | util/kubeblocks.GenerateKubeBlocksSelector | util/kubeblocks/kubeblocks_test.go::TestGenerateKubeBlocksSelector |
@@ -2395,6 +2396,16 @@
 - 代码路径: `api/handler/resource_deletion.go`
 - 测试路径: `api/handler/resource_deletion_test.go::TestK8sResourceReconcileDistinguishesMissingAndUnknown`
 
+### Resource deletion and reconciliation responses encode empty lists as arrays
+
+- Capability ID: `rainbond.k8s-resource.response-array-contract`
+- 状态: `active`
+- 测试类型: `regression`
+- 接口类型: `workflow`
+- 业务入口: `k8sResourceDeletionOrchestrator`
+- 代码路径: `api/handler/resource_deletion.go`
+- 测试路径: `api/handler/resource_deletion_test.go::TestK8sResourceDeletionResponseArrays`, `api/handler/resource_deletion_test.go::TestK8sResourceReconcileResponseArrays`
+
 ### Stop in-application controllers before deleting generated custom resources
 
 - Capability ID: `rainbond.k8s-resource.stop-recreating-controller`
```

---

### Incident Patch 7: `4a17bd04` (2026-09-13)
**Commit Message**: chore: merge main into resource management fixes

Signed-off-by: Qi Zhang <smallqi1@163.com>

**File**: `README-zh.md` (modified, +21/-50)
```diff
@@ -1,64 +1,35 @@
-<div align="center">
-  <img src="https://static.goodrain.com/logo/logo-long.png" width="56%" alt="Rainbond Logo" />
+# Rainbond
 
-  <p>
-    <a href="./README.md">English</a>
-  </p>
+[English](./README.md)
 
-  <p>
-    <img src="https://img.shields.io/github/stars/goodrain/rainbond.svg?style=flat-square" alt="GitHub stars" />
-    <img src="https://img.shields.io/badge/version-v6.X-brightgreen.svg?style=flat-square" alt="Version" />
-    <img src="https://img.shields.io/badge/open%20source-100%25-blue?style=flat-square" alt="Open Source" />
-  </p>
-</div>
-<div align="center">
+> **AI 生成，Rainbond 运行。始终由你掌控。**
 
-## 不用懂 Kubernetes 的开源容器平台
+Rainbond 是 AI 应用运行平台。
 
- <p>
-    <a href="https://www.bilibili.com/video/BV1Lzo5BGEuc">
-      <img src="./docs/rainbond-video.png" width="80%" alt="Rainbond 视频介绍" />
-    </a>
-  </p>
+核心能力 100% 开源。它统一承载和管理 AI 生成的项目、大模型服务、开源 AI 软件及业务应用，通过 AI 完成部署、排错、升级与运维，让应用以容器方式稳定运行在用户自己的服务器或 Kubernetes 上。
 
-Rainbond 帮助团队在不深入学习 Kubernetes 的前提下完成应用构建、部署、升级、运维与私有化交付。  
-更适合私有化部署、离线交付、信创适配、应用市场交付和 AI 应用私有化场景。
+通过 [Rainskills](https://github.com/goodrain/rainskills)，Codex、Claude Code 等 AI Agent 可以直接将项目部署到 Rainbond，并完成排错和交付验证。
 
-**Open-source container platform for teams that want to deploy and run applications without deeply operating Kubernetes.**
+[让 AI 帮我部署](https://github.com/goodrain/rainskills) ·
+[免费体验](https://run.rainbond.com) ·
+[安装 Rainbond](https://www.rainbond.com/docs/quick-start/quick-install) ·
+[查看文档](https://www.rainbond.com/docs)
 
-[项目官网](https://www.rainbond.com?channel=github) ·
-[快速安装](https://www.rainbond.com/docs/quick-start/quick-install?channel=github) ·
-[文档](https://www.rainbond.com/docs?channel=github) ·
-[选型中心](https://www.rainbond.com/compare?channel=github) ·
-[应用市场](https://hub.rainbond.com?channel=github)
+## 从哪里开始
 
-</div>
-
----
-
-## Rainbond 是什么
-
-Rainbond 是一款 `100% 开源`、`不用懂 Kubernetes` 的开源容器平台。  
-它更偏向解决“应用交付”问题，而不是只做 Kubernetes 资源管理界面。
-
-如果你的团队正在面对下面这些问题，Rainbond 更值得你看一眼：
-
-- 会 Kubernetes，但应用交付还是很费劲
-- 客户环境复杂，每次上线都像重来一遍
-- 需要私有化部署、离线交付、信创适配或内网部署
-- 想做统一的应用交付入口，但不想从零开始自研平台
+| 你的目标 | 推荐入口 |
+| --- | --- |
+| 我正在使用 AI 编程，想把项目部署上线 | [安装 Rainskills](https://github.com/goodrain/rainskills) |
+| 我想快速体验，不准备服务器 | [使用 Rainbond Cloud](https://run.rainbond.com) |
+| 我想运行在自己的服务器或 Kubernetes | [私有化安装 Rainbond](https://www.rainbond.com/docs/quick-start/quick-install) |
+| 我想部署 Dify、RAGFlow 等开源应用 | [访问 Rainbond 应用市场](https://hub.rainbond.com) |
+| 我正在选型开源容器平台 | [了解 Rainbond 的应用管理与交付能力](https://www.rainbond.com/compare) |
 
----
+## 不只是 AI 应用
 
-## 你可能最关心的是哪一类问题
+Rainbond 的新入口面向 AI 编程，但底层应用运行能力没有改变。
 
-| 你的目标 | 建议先看这里 |
-| --- | --- |
-| 我想先判断 Rainbond 适不适合我 | [选型中心](https://www.rainbond.com/compare?channel=github) |
-| 我想马上装起来试试 | [快速安装](https://www.rainbond.com/docs/quick-start/quick-install?channel=github) |
-| 我装完了，想跑第一个应用 | [部署你的第一个应用](https://www.rainbond.com/docs/quick-start/getting-started?channel=github) |
-| 我在做离线 / 内网 / 客户现场 / 信创 | [离线 / 信创专题](https://www.rainbond.com/offline-and-xinchuang?channel=github) |
-| 我想看能不能通过应用市场一键部署 | [Rainbond 应用市场](https://hub.rainbond.com?channel=github) |
+源码、容器镜像、Docker Compose、Helm、传统业务系统和微服务应用，仍然可以通过 Rainbond 完成部署、管理、升级、回滚、离线交付和信创适配。
 
 ---
 
```

**File**: `README.md` (modified, +21/-43)
```diff
@@ -1,57 +1,35 @@
-<div align="center">
-  <img src="https://static.goodrain.com/logo/logo-long.png" width="56%" alt="Rainbond Logo" />
+# Rainbond
 
-  <p>
-    <a href="./README-zh.md">中文</a>
-  </p>
+[中文](./README-zh.md)
 
-  <p>
-    <img src="https://img.shields.io/github/stars/goodrain/rainbond.svg?style=flat-square" alt="GitHub stars" />
-    <img src="https://img.shields.io/badge/version-v6.X-brightgreen.svg?style=flat-square" alt="Version" />
-    <img src="https://img.shields.io/badge/open%20source-100%25-blue?style=flat-square" alt="Open Source" />
-  </p>
-</div>
+> **Built by AI. Run by Rainbond. Always under your control.**
 
-<div align="center">
+Rainbond is an AI application runtime platform.
 
-## An open-source container platform that needs no Kubernetes learning
+Its core capabilities are 100% open source. Rainbond provides a unified platform for running and managing AI-generated projects, large language model services, open-source AI software, and business applications. With AI-powered deployment, troubleshooting, upgrades, and operations, it keeps applications running reliably in containers on your own servers or Kubernetes clusters.
 
-Rainbond helps teams build, deploy, upgrade, operate, and privately deliver applications without deeply learning Kubernetes.  
-It is better suited for private deployment, offline delivery, Xinchuang adaptation, application marketplace delivery, and AI application privatization scenarios.
+Through [Rainskills](https://github.com/goodrain/rainskills), AI agents such as Codex and Claude Code can deploy projects directly to Rainbond, troubleshoot issues, and verify delivery.
 
-[Website](https://www.rainbond.com?channel=github) ·
-[Quick Install](https://www.rainbond.com/docs/quick-start/quick-install?channel=github) ·
-[Documentation](https://www.rainbond.com/docs?channel=github) ·
-[Comparison Center](https://www.rainbond.com/compare?channel=github) ·
-[Marketplace](https://hub.rainbond.com?channel=github)
+[Deploy with AI](https://github.com/goodrain/rainskills) ·
+[Try for free](https://run.rainbond.com) ·
+[Install Rainbond](https://www.rainbond.com/docs/quick-start/quick-install) ·
+[Documentation](https://www.rainbond.com/docs)
 
-</div>
+## Where to start
 
----
-
-## What is Rainbond
-
-Rainbond is a `100% open-source`, `Kubernetes-friendly` container platform.  
-It is more focused on **application delivery** than on being just a Kubernetes resource management interface.
-
-If your team is facing problems like these, Rainbond is worth evaluating:
-
-- You already use Kubernetes, but application delivery is still too heavy
-- Customer environments are complex, and every release feels like rebuilding everything
-- You need private deployment, offline delivery, Xinchuang compatibility, or internal-network deployment
-- You want a unified application delivery platform without building one from scratch
+| Your goal | Start here |
+| --- | --- |
+| I use AI coding and want to deploy my project | [Install Rainskills](https://github.com/goodrain/rainskills) |
+| I want to try Rainbond without preparing a server | [Use Rainbond Cloud](https://run.rainbond.com) |
+| I want to run applications on my own servers or Kubernetes | [Install Rainbond privately](https://www.rainbond.com/docs/quick-start/quick-install) |
+| I want to deploy open-source applications such as Dify or RAGFlow | [Visit the Rainbond Application Marketplace](https://hub.rainbond.com) |
+| I am evaluating open-source container platforms | [Explore Rainbond's application management and delivery capabilities](https://www.rainbond.com/compare) |
 
----
+## Not just AI applications
 
-## Start from the path that matches your goal
+Rainbond's new entry point is designed for AI coding, but its underlying application runtime capabilities remain unchanged.
 
-| Your goal | Start here |
-| --- | --- |
-| I want to know whether Rainbond fits my team | [Comparison Center](https://www.rainbond.com/compare?channel=github)
```

**File**: `api/controller/apigateway/api_gateway_route.go` (modified, +155/-85)
```diff
@@ -30,6 +30,7 @@ import (
 	dbmodel "github.com/goodrain/rainbond/db/model"
 	"github.com/goodrain/rainbond/pkg/component/k8s"
 	httputil "github.com/goodrain/rainbond/util/http"
+	"github.com/goodrain/rainbond/util/portprotocol"
 	"github.com/google/uuid"
 	"github.com/sirupsen/logrus"
 	corev1 "k8s.io/api/core/v1"
@@ -51,11 +52,18 @@ func (g Struct) OpenOrCloseDomains(w http.ResponseWriter, r *http.Request) {
 	if idx := strings.Index(serviceAlias, ","); idx != -1 {
 		serviceAlias = serviceAlias[:idx]
 	}
-	list, _ := c.ApisixRoutes(tenant.Namespace).List(r.Context(), v1.ListOptions{
+	list, err := c.ApisixRoutes(tenant.Namespace).List(r.Context(), v1.ListOptions{
 		LabelSelector: serviceAlias + "=service_alias" + ",port=" + r.URL.Query().Get("port"),
 	})
+	if err != nil {
+		httputil.ReturnBcodeError(r, w, bcode.ErrRouteNotFound)
+		return
+	}
 	for _, itemL := range list.Items {
 		item := itemL
+		if len(item.Spec.HTTP) == 0 {
+			continue
+		}
 		var plugins = item.Spec.HTTP[0].Plugins
 		var newPlugins = make([]v2.ApisixRoutePlugin, 0)
 		for _, plugin := range plugins {
@@ -78,10 +86,6 @@ func (g Struct) OpenOrCloseDomains(w http.ResponseWriter, r *http.Request) {
 		item.Status = v2.ApisixStatus{}
 		_, err := c.ApisixRoutes(tenant.Namespace).Update(r.Context(), &item, v1.UpdateOptions{})
 		if err != nil {
-			if errors.IsConflict(err) {
-				logrus.Warnf("update route %v conflict", item.Name)
-				continue
-			}
 			logrus.Errorf("update route %v failure: %v", item.Name, err)
 			httputil.ReturnBcodeError(r, w, bcode.ErrRouteUpdate)
 			return
@@ -150,9 +154,21 @@ func (g Struct) GetTCPBindDomains(w http.ResponseWriter, r *http.Request) {
 		httputil.ReturnBcodeError(r, w, bcode.ErrRouteNotFound)
 		return
 	}
-	var resp []int32
-	for _, v := range list.Items {
-		resp = append(resp, v.Spec.Ports[0].NodePort)
+	if r.URL.Query().Get("details") == "true" {
+		resp := make([]apimodel.TCPRouteServicePort, 0, len(list.Items))
+		for _, service := range list.Items {
+			if len(service.Spec.Ports) > 0 {
+				resp = append(resp, streamRouteSummary(service))
+			}
+		}
+		httputil.ReturnSuccess(r, w, resp)
+		return
+	}
+	resp := make([]int32, 0, len(list.Items))
+	for _, service := range list.Items {
+		if len(service.Spec.Ports) > 0 {
+			resp = append(resp, service.Spec.Ports[0].NodePort)
+		}
 	}
 	httputil.ReturnSuccess(r, w, resp)
 }
@@ -232,6 +248,33 @@ func addResponseRewritePlugin(apisixRouteHTTP v2.ApisixRouteHTTP) v2.ApisixRoute
 	return apisixRouteHTTP
 }
 
+func httpAPIRouteLabels(tenant *dbmodel.Tenants, r *http.Request, serviceAlias string) map[string]string {
+	labels := map[string]string{
+		"creator":        "Rainbond",
+		"port":           r.URL.Query().Get("port"),
+		"component_sort": serviceAlias,
+	}
+	if tenant != nil {
+		if tenant.UUID != "" {
+			labels["tenant_id"] = tenant.UUID
+		}
+		if tenant.Name != "" {
+			labels["tenant_name"] = tenant.Name
+		}
+	}
+	if appID := r.URL.Query().Get("appID"); appID != "" {
+		labels["app_id"] = appID
+	}
+	if serviceID := r.URL.Query().Get("service_id"); serviceID != "" {
+		labels["service_id"] = serviceID
+	}
+	if serviceAlias != "" {
+		labels["service_alias"] = serviceAlias
+		labels[serviceAlias] = "service_alias"
+	}
+	return labels
+}
+
 // CreateHTTPAPIRoute -
 func (g Struct) CreateHTTPAPIRoute(w http.ResponseWriter, r *http.Request) {
 
@@ -245,23 +288,9 @@ func (g Struct) CreateHTTPAPIRoute(w http.ResponseWriter, r *http.Request) {
 	if idx := strings.Index(sa, ","); idx != -1 {
 		sa = sa[:idx]
 	}
-	sLabel := strings.Split(sa, ",")
-	// 如果没有绑定appId，那么不要加这个lable
-	labels := make(map[string]string)
-	labels["creator"] = "Rainbond"
-	labels["port"] = r.URL.Query().Get("port")
-	labels["component_sort"] = sa
-	if r.URL.Query().Get("appID") != "" {
-		labels["app_id"] = r.URL.Query().Get("appID")
-	}
+	labels := httpAPIRouteLabels(tenant, r, sa)
 	defaultDomain := r.URL.Query().Get("default") == "true"
 
-	for _, sl := range sLabel {
-		if sl != 
```

**File**: `api/controller/apigateway/api_gateway_route_test.go` (modified, +192/-1)
```diff
@@ -35,6 +35,37 @@ type tcpRouteTestManager struct {
 	tcpRuleDao       dbdao.TCPRuleDao
 }
 
+func TestCreateHTTPAPIRouteAddsCanonicalIdentityLabels(t *testing.T) {
+	req := httptest.NewRequest(
+		http.MethodPost,
+		"/?appID=region-app-id&service_id=service-id&service_alias=service-alias&port=8080",
+		nil,
+	)
+	tenant := &dbmodel.Tenants{
+		UUID:      "tenant-id",
+		Name:      "tenant-name",
+		Namespace: "tenant-namespace",
+	}
+
+	labels := httpAPIRouteLabels(tenant, req, "service-alias")
+	want := map[string]string{
+		"creator":        "Rainbond",
+		"tenant_id":      "tenant-id",
+		"tenant_name":    "tenant-name",
+		"app_id":         "region-app-id",
+		"service_id":     "service-id",
+		"service_alias":  "service-alias",
+		"port":           "8080",
+		"component_sort": "service-alias",
+		"service-alias":  "service_alias",
+	}
+	for key, expected := range want {
+		if got := labels[key]; got != expected {
+			t.Errorf("label %s = %q; want %q", key, got, expected)
+		}
+	}
+}
+
 func (m tcpRouteTestManager) TenantServiceDao() dbdao.TenantServiceDao {
 	return m.tenantServiceDao
 }
@@ -689,7 +720,7 @@ func TestCreateTCPRouteRejectsExistingServiceWithoutMatchingOwner(t *testing.T)
 	}
 }
 
-func createTCPRouteForTest(t *testing.T, namespace, tenantID, serviceID, serviceName string, nodePort int32) *httptest.ResponseRecorder {
+func createTCPRouteForTest(t *testing.T, namespace, tenantID, serviceID, serviceName string, nodePort int32, protocols ...string) *httptest.ResponseRecorder {
 	t.Helper()
 	streamRoute := v2.ApisixRouteStream{
 		Name:     "tcp",
@@ -702,6 +733,9 @@ func createTCPRouteForTest(t *testing.T, namespace, tenantID, serviceID, service
 			ServicePort: intstr.FromInt(9090),
 		},
 	}
+	if len(protocols) > 0 {
+		streamRoute.Protocol = protocols[0]
+	}
 	body, err := json.Marshal(streamRoute)
 	if err != nil {
 		t.Fatalf("marshal route: %v", err)
@@ -1262,3 +1296,160 @@ func TestNodePortFromTCPRouteNameValidatesRange(t *testing.T) {
 		})
 	}
 }
+
+func TestCreateMixedRouteAndEditPreservesNodePort(t *testing.T) {
+	const (
+		namespace    = "default"
+		tenantID     = "tenant-id"
+		appID        = "app-id"
+		serviceID    = "db66afd0892c326ff557df7880ac572d"
+		serviceAlias = "grac572d"
+		serviceName  = "demo-2048"
+		nodePort     = int32(30000)
+	)
+
+	services := map[string]*corev1.Service{
+		serviceName: {
+			ObjectMeta: v1.ObjectMeta{
+				Name:      serviceName,
+				Namespace: namespace,
+				Labels: map[string]string{
+					"app_id":        appID,
+					"service_id":    serviceID,
+					"service_alias": serviceAlias,
+					"rainbond_app":  serviceName,
+				},
+			},
+			Spec: corev1.ServiceSpec{
+				Ports: []corev1.ServicePort{{
+					Name:       "tcp-8080",
+					Protocol:   corev1.ProtocolTCP,
+					Port:       8080,
+					TargetPort: intstr.FromInt(8080),
+				}},
+				Selector: map[string]string{"name": serviceAlias},
+			},
+		},
+	}
+	services[serviceName].Spec.Ports = append(services[serviceName].Spec.Ports, corev1.ServicePort{Name: "udp-8080", Port: 8080, Protocol: corev1.ProtocolUDP, TargetPort: intstr.FromInt(8080)})
+	clientset, closeServer := newTCPRouteTestClientset(t, services)
+	defer closeServer()
+	k8s.New().Clientset = clientset
+
+	ruleDao := &tcpRouteRuleDao{}
+	db.SetTestManager(tcpRouteTestManager{
+		tenantServiceDao: &tcpRouteTenantServiceDao{servicesByID: map[string]*dbmodel.TenantServices{
+			serviceID: {
+				ServiceID:        serviceID,
+				ServiceAlias:     serviceAlias,
+				TenantID:         tenantID,
+				ExtendMethod:     "",
+				K8sComponentName: serviceAlias,
+			},
+		}},
+		tcpRuleDao: ruleDao,
+	})
+	defer db.SetTestManager(nil)
+
+	streamRoute := v2.ApisixRouteStream{
+		Name:     "tcp",
+		Protocol: "tcp+udp",
+		Match: v2.ApisixRouteStreamMatch{
+			IngressPort: nodePort,
+		},
+		Backend: v2.ApisixRouteStreamBackend{
+			ServiceName: serviceName,
+			ServicePort: intstr.FromInt(8080),
+		},
+	}
+	body, err := json.Marshal(streamRoute)
+	if e
```

**File**: `api/controller/apigateway/stream_protocol.go` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+package apigateway
+
+import (
+	"fmt"
+	"strconv"
+	"strings"
+
+	apimodel "github.com/goodrain/rainbond/api/model"
+	"github.com/goodrain/rainbond/util/portprotocol"
+	corev1 "k8s.io/api/core/v1"
+	"k8s.io/apimachinery/pkg/util/intstr"
+)
+
+func streamPorts(protocol string, port int32, target intstr.IntOrString, nodePort int32) []corev1.ServicePort {
+	var ports []corev1.ServicePort
+	for _, transport := range portprotocol.Transports(protocol) {
+		ports = append(ports, corev1.ServicePort{Name: fmt.Sprintf("%s-%d", strings.ToLower(string(transport)), port), Protocol: transport, Port: port, TargetPort: target, NodePort: nodePort})
+	}
+	return ports
+}
+
+func streamRouteSummary(service corev1.Service) apimodel.TCPRouteServicePort {
+	item := apimodel.TCPRouteServicePort{ServiceName: service.Name, ServiceAlias: service.Labels["service_alias"], ServiceID: service.Labels["service_id"], AppID: service.Labels["app_id"], BackendServiceName: service.Annotations["rainbond.com/backend-service"]}
+	if len(service.Spec.Ports) == 0 {
+		return item
+	}
+	item.ServicePort = service.Spec.Ports[0]
+	item.Name = service.Name
+	item.ContainerPort = item.Port
+	if port, err := strconv.Atoi(service.Labels["port"]); err == nil {
+		item.ContainerPort = int32(port)
+	}
+	seen := map[corev1.Protocol]bool{}
+	for _, port := range service.Spec.Ports {
+		protocol := port.Protocol
+		if protocol == "" {
+			protocol = corev1.ProtocolTCP
+		}
+		if !seen[protocol] {
+			item.Protocols = append(item.Protocols, protocol)
+			seen[protocol] = true
+		}
+	}
+	item.Protocol = corev1.Protocol(strings.ToUpper(portprotocol.Canonical(item.Protocols)))
+	return item
+}
+
+func backendSupportsStream(service *corev1.Service, port int32, protocol string) bool {
+	available := []corev1.Protocol{}
+	for _, p := range service.Spec.Ports {
+		if p.Port == port {
+			available = append(available, p.Protocol)
+		}
+	}
+	return len(available) > 0 && portprotocol.Allows(portprotocol.Canonical(available), protocol)
+}
```

---

### Incident Patch 8: `9372f8f8` (2026-09-13)
**Commit Message**: fix: preserve volume edits and reconcile replica capacity

Signed-off-by: Qi Zhang <smallqi1@163.com>

**File**: `api/api_routers/version2/v2Routers.go` (modified, +3/-0)
```diff
@@ -182,6 +182,7 @@ func (v2 *V2) platformPluginsRouter() chi.Router {
 	return r
 }
 
+// PluginBackendProxy forwards requests to the named plugin's backend service.
 func PluginBackendProxy(w http.ResponseWriter, r *http.Request) {
 	plugin, err := getRBDPlugin(chi.URLParam(r, "plugin_name"))
 	if err != nil {
@@ -245,6 +246,7 @@ func getRBDPlugin(pluginName string) (*v1alpha1.RBDPlugin, error) {
 	return plugin, nil
 }
 
+// PluginStaticProxy serves the named plugin's frontend content.
 func PluginStaticProxy(w http.ResponseWriter, r *http.Request) {
 	servePluginStatic(w, r, getRBDPlugin)
 }
@@ -362,6 +364,7 @@ func resolveConfigMapContent(plugin *v1alpha1.RBDPlugin) (string, error) {
 	return resolveFrontedPathContent(plugin)
 }
 
+// ChangePluginStatus enables or disables the named plugin.
 func ChangePluginStatus(w http.ResponseWriter, r *http.Request) {
 	type Status struct {
 		Action string `json:"action"`
```

**File**: `api/controller/cluster.go` (modified, +10/-7)
```diff
@@ -22,6 +22,14 @@ import (
 	"context"
 	"encoding/json"
 	"fmt"
+	"io"
+	"net/http"
+	"os"
+	"path"
+	"path/filepath"
+	"strconv"
+	"strings"
+
 	"github.com/go-chi/chi"
 	"github.com/goodrain/rainbond-operator/api/v1alpha1"
 	"github.com/goodrain/rainbond-operator/util/constants"
@@ -34,14 +42,7 @@ import (
 	utils "github.com/goodrain/rainbond/util"
 	"github.com/jinzhu/gorm"
 	"github.com/sirupsen/logrus"
-	"io"
 	"k8s.io/apimachinery/pkg/types"
-	"net/http"
-	"os"
-	"path"
-	"path/filepath"
-	"strconv"
-	"strings"
 
 	httputil "github.com/goodrain/rainbond/util/http"
 )
@@ -751,6 +752,7 @@ func copyDirectory(srcDir, dstDir string) error {
 	return err
 }
 
+// GetRegionStatus returns the region status after validating the Helm request.
 func (c *ClusterController) GetRegionStatus(w http.ResponseWriter, r *http.Request) {
 	token := chi.URLParam(r, "token")
 	if token != os.Getenv("HELM_TOKEN") {
@@ -765,6 +767,7 @@ func (c *ClusterController) GetRegionStatus(w http.ResponseWriter, r *http.Reque
 	httputil.ReturnSuccess(r, w, regionInfo)
 }
 
+// SetOverScore updates the cluster resource overcommit rate.
 func (c *ClusterController) SetOverScore(w http.ResponseWriter, r *http.Request) {
 	var overScore model.OverScore
 	if ok := httputil.ValidatorRequestStructAndErrorResponse(r, w, &overScore, nil); !ok {
```

**File**: `api/handler/cluster.go` (modified, +1/-0)
```diff
@@ -1100,6 +1100,7 @@ func (c *clusterAction) HandlePlugins() (plugins []*model.RainbondPlugins, err e
 	return plugins, nil
 }
 
+// ComponentRainbondOperator and related constants identify workloads checked during platform upgrades.
 const (
 	ComponentRainbondOperator = "rainbond-operator" // deployment
 	ComponentRBDAPI           = "rbd-api"           // deployment
```

**File**: `api/handler/service.go` (modified, +7/-1)
```diff
@@ -517,6 +517,7 @@ func (s *ServiceAction) ensureVMStarted(sss *apimodel.StartStopStruct, deployVer
 	return lastErr
 }
 
+// StartOrCreateVM starts an existing virtual machine or queues its creation.
 func (s *ServiceAction) StartOrCreateVM(ctx context.Context, sss *apimodel.StartStopStruct, deployVersion string) error {
 	vm, err := s.getVirtualMachineByServiceID(sss.ServiceID)
 	if err != nil {
@@ -558,6 +559,7 @@ func isVMStartRequestedOrRunning(status v1.VirtualMachinePrintableStatus) bool {
 	}
 }
 
+// RestartVM restarts the component virtual machine, creating it when absent.
 func (s *ServiceAction) RestartVM(ctx context.Context, sss *apimodel.StartStopStruct, deployVersion string) error {
 	vm, err := s.getVirtualMachineByServiceID(sss.ServiceID)
 	if err != nil {
@@ -591,6 +593,7 @@ func (s *ServiceAction) RestartVM(ctx context.Context, sss *apimodel.StartStopSt
 	return markDirectVMOperationEvent(ctx, dbmodel.EventStatusSuccess)
 }
 
+// StopVM stops the component virtual machine and records the operation result.
 func (s *ServiceAction) StopVM(ctx context.Context, serviceID string) error {
 	vm, err := s.getVirtualMachineByServiceID(serviceID)
 	if err != nil {
@@ -2526,7 +2529,9 @@ func (s *ServiceAction) UpdVolume(sid string, req *apimodel.UpdVolumeReq) error
 			tx.Rollback()
 			return bcode.NewBadRequest("volume capacity can only be expanded, not reduced")
 		}
-		if s.kubeClient != nil {
+		// An unchanged capacity accompanies ordinary path edits. Only retry
+		// capacity reconciliation when the path is unchanged, or expand a new target.
+		if s.kubeClient != nil && (*req.VolumeCapacity > v.VolumeCapacity || req.VolumePath == v.VolumePath) {
 			service, serviceErr := dbm.TenantServiceDao().GetServiceByID(sid)
 			if serviceErr != nil {
 				tx.Rollback()
@@ -4199,6 +4204,7 @@ func TransStatus(eStatus string) string {
 	return ""
 }
 
+// FileManageInfo lists files at a path in the component's selected container.
 func (s *ServiceAction) FileManageInfo(serviceID, podName, tarPath, containerName, namespace string) ([]apimodel.FileInfo, error) {
 	var fileInfos []apimodel.FileInfo
 
```

**File**: `api/handler/service_volume_test.go` (modified, +88/-0)
```diff
@@ -15,6 +15,7 @@ import (
 	corev1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/client-go/kubernetes/fake"
+	kubevirtv1 "kubevirt.io/api/core/v1"
 )
 
 type volumeUpdateTestManager struct {
@@ -195,6 +196,93 @@ func TestServiceActionUpdVolumeUpdatesVolumeCapacity(t *testing.T) {
 	}
 }
 
+// capability_id: rainbond.component.volume-path-update-without-expansion
+func TestServiceActionUpdVolumePathDoesNotRequireExpansion(t *testing.T) {
+	for _, test := range []struct {
+		name          string
+		volumeType    string
+		extendMethod  string
+		enableSubpath string
+	}{
+		{name: "non-expandable StorageClass", volumeType: "fixed"},
+		{name: "memory filesystem", volumeType: dbmodel.MemoryFSVolumeType.String()},
+		{name: "virtual machine", volumeType: "fixed", extendMethod: "vm"},
+		{name: "shared subpath", volumeType: dbmodel.ShareFileVolumeType.String(), enableSubpath: "true"},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			t.Setenv("ENABLE_SUBPATH", test.enableSubpath)
+			sqlDB, mock, err := sqlmock.New()
+			if err != nil {
+				t.Fatalf("create sqlmock: %v", err)
+			}
+			defer sqlDB.Close()
+			gdb, err := gorm.Open("mysql", sqlDB)
+			if err != nil {
+				t.Fatalf("open gorm db: %v", err)
+			}
+			defer gdb.Close()
+			mock.ExpectBegin()
+			tx := gdb.Begin()
+			if err := tx.Error; err != nil {
+				t.Fatalf("begin tx: %v", err)
+			}
+			mock.ExpectCommit()
+
+			capacity := int64(20)
+			volumeDao := &volumeUpdateTenantServiceVolumeDao{volume: &dbmodel.TenantServiceVolume{
+				Model:          dbmodel.Model{ID: 7},
+				ServiceID:      "service-1",
+				VolumeName:     "data",
+				VolumeType:     test.volumeType,
+				VolumePath:     "/data",
+				VolumeCapacity: capacity,
+			}}
+			client := fake.NewSimpleClientset(
+				expansionStorageClass("fixed", false),
+				expansionPVC("tenant-ns", "manual7", "service-1", "data", "fixed", "20Gi", "20Gi"),
+			)
+			queriedVMServiceID := ""
+			action := &ServiceAction{
+				dbmanager: volumeUpdateTestManager{
+					tx:        tx,
+					volumeDao: volumeDao,
+					serviceDao: &volumeUpdateTenantServiceDao{service: &dbmodel.TenantServices{
+						ServiceID:    "service-1",
+						Namespace:    "tenant-ns",
+						ExtendMethod: test.extendMethod,
+					}},
+				},
+				kubeClient: client,
+				getVirtualMachineByServiceIDHook: func(serviceID string) (*kubevirtv1.VirtualMachine, error) {
+					queriedVMServiceID = serviceID
+					return nil, nil
+				},
+			}
+			if err := action.UpdVolume("service-1", &apimodel.UpdVolumeReq{
+				VolumeName:     "data",
+				VolumeType:     test.volumeType,
+				VolumePath:     "/new-data",
+				VolumeCapacity: &capacity,
+			}); err != nil {
+				t.Fatalf("path update with unchanged capacity should succeed: %v", err)
+			}
+			if volumeDao.updatedVolume == nil || volumeDao.updatedVolume.VolumePath != "/new-data" ||
+				volumeDao.updatedVolume.VolumeCapacity != capacity {
+				t.Fatalf("expected new path and unchanged capacity, got %#v", volumeDao.updatedVolume)
+			}
+			if len(client.Actions()) != 0 {
+				t.Fatalf("path update should not inspect or expand PVCs, got %v", client.Actions())
+			}
+			if test.extendMethod == "vm" && queriedVMServiceID != "service-1" {
+				t.Fatalf("expected existing VM sync to query service-1, got %q", queriedVMServiceID)
+			}
+			if err := mock.ExpectationsWereMet(); err != nil {
+				t.Fatalf("unmet SQL expectations: %v", err)
+			}
+		})
+	}
+}
+
 // capability_id: rainbond.component.volume-expansion-reconciles-drift
 func TestServiceActionUpdVolumeReconcilesStoredCapacity(t *testing.T) {
 	sqlDB, mock, err := sqlmock.New()
```

---

### Incident Patch 9: `70dc6615` (2026-09-11)
**Commit Message**: fix: preserve legacy console requests for UDP mappings

Signed-off-by: Qi Zhang <smallqi1@163.com>

**File**: `api/controller/apigateway/api_gateway_route.go` (modified, +1/-1)
```diff
@@ -542,7 +542,7 @@ func (g Struct) CreateTCPRoute(w http.ResponseWriter, r *http.Request) {
 			if resolvedServiceID == "" {
 				resolvedServiceID = backendService.Labels["service_id"]
 			}
-		} else if protocol != "tcp" || r.URL.Query().Get("action") == "create" || routeName != "" {
+		} else if r.URL.Query().Get("action") == "create" || routeName != "" {
 			httputil.ReturnError(r, w, 400, "backend service is unavailable for protocol validation")
 			return
 		} else if !errors.IsNotFound(err) {
```

**File**: `api/controller/apigateway/api_gateway_route_test.go` (modified, +30/-1)
```diff
@@ -720,7 +720,7 @@ func TestCreateTCPRouteRejectsExistingServiceWithoutMatchingOwner(t *testing.T)
 	}
 }
 
-func createTCPRouteForTest(t *testing.T, namespace, tenantID, serviceID, serviceName string, nodePort int32) *httptest.ResponseRecorder {
+func createTCPRouteForTest(t *testing.T, namespace, tenantID, serviceID, serviceName string, nodePort int32, protocols ...string) *httptest.ResponseRecorder {
 	t.Helper()
 	streamRoute := v2.ApisixRouteStream{
 		Name:     "tcp",
@@ -733,6 +733,9 @@ func createTCPRouteForTest(t *testing.T, namespace, tenantID, serviceID, service
 			ServicePort: intstr.FromInt(9090),
 		},
 	}
+	if len(protocols) > 0 {
+		streamRoute.Protocol = protocols[0]
+	}
 	body, err := json.Marshal(streamRoute)
 	if err != nil {
 		t.Fatalf("marshal route: %v", err)
@@ -1424,3 +1427,29 @@ func TestCreateMixedRouteAndEditPreservesNodePort(t *testing.T) {
 	}
 
 }
+
+func TestCreateStreamRouteAcceptsLegacyConsoleAlias(t *testing.T) {
+	for _, protocol := range []string{"tcp", "udp", "tcp+udp"} {
+		t.Run(protocol, func(t *testing.T) {
+			services := map[string]*corev1.Service{}
+			clientset, closeServer := newTCPRouteTestClientset(t, services)
+			defer closeServer()
+			k8s.New().Clientset = clientset
+			db.SetTestManager(tcpRouteTestManager{
+				tenantServiceDao: &tcpRouteTenantServiceDao{servicesByID: map[string]*dbmodel.TenantServices{
+					"component": {ServiceID: "component", TenantID: "tenant", ServiceAlias: "grf9ce55"},
+				}},
+				tcpRuleDao: &tcpRouteRuleDao{},
+			})
+			defer db.SetTestManager(nil)
+			response := createTCPRouteForTest(t, "default", "tenant", "component", "grf9ce55", 30000, protocol)
+			if response.Code != http.StatusOK {
+				t.Fatalf("legacy %s request failed: %d %s", protocol, response.Code, response.Body.String())
+			}
+			service := services["grf9ce55-30000"]
+			if service == nil || service.Spec.Selector["service_alias"] != "grf9ce55" {
+				t.Fatalf("legacy request lost its component selector: %#v", service)
+			}
+		})
+	}
+}
```

---

### Incident Patch 10: `050acb72` (2026-09-11)
**Commit Message**: fix: use configured service names for worker NodePort mappings

Signed-off-by: Qi Zhang <smallqi1@163.com>

**File**: `worker/appm/conversion/gateway.go` (modified, +9/-2)
```diff
@@ -515,7 +515,7 @@ func (a *AppServiceBuild) generateOuterDomain(as *v1.AppService, port *model.Ten
 			if found {
 				continue
 			}
-			name := fmt.Sprintf("%s-%d", as.ServiceAlias, rule.Port)
+			name := nodePortServiceName(as.ServiceAlias, port.K8sServiceName, rule.Port)
 			if err := a.reassignTCPRuleNodePort(as.GetNamespace(), name, rule); err != nil {
 				logrus.Errorf("reassign node port: %v", err)
 				continue
@@ -611,9 +611,16 @@ func selectAvailableNodePort(usedPorts map[int]struct{}) int {
 	return 0
 }
 
+func nodePortServiceName(serviceAlias, k8sServiceName string, nodePort int) string {
+	if k8sServiceName == "" {
+		k8sServiceName = serviceAlias
+	}
+	return fmt.Sprintf("%s-%d", k8sServiceName, nodePort)
+}
+
 // nodePortService restores one mapping; multiple transports belong to the same Service.
 func (a *AppServiceBuild) nodePortService(as *v1.AppService, port *model.TenantServicesPort, rule *model.TCPRule) *corev1.Service {
-	name := fmt.Sprintf("%s-%d", as.ServiceAlias, rule.Port)
+	name := nodePortServiceName(as.ServiceAlias, port.K8sServiceName, rule.Port)
 	spec := corev1.ServiceSpec{
 		Type:                  corev1.ServiceTypeNodePort,
 		ExternalTrafficPolicy: outerServiceExternalTrafficPolicy(a.service),
```

**File**: `worker/appm/conversion/transport_test.go` (modified, +22/-3)
```diff
@@ -1,6 +1,7 @@
 package conversion
 
 import (
+	"fmt"
 	"testing"
 
 	"k8s.io/apimachinery/pkg/util/validation"
@@ -36,16 +37,22 @@ func TestMixedInternalAndHeadlessPorts(t *testing.T) {
 
 func TestRestoreThreeIndependentMappingProtocols(t *testing.T) {
 	as := &appv1.AppService{}
-	as.ServiceAlias = "dns"
+	as.ServiceAlias = "grf9ce55"
 	as.SetTenant(&corev1.Namespace{})
-	builder := &AppServiceBuild{service: &model.TenantServices{ServiceAlias: "dns"}, appService: as}
-	port := &model.TenantServicesPort{ContainerPort: 53, Protocol: "tcp+udp", K8sServiceName: "dns"}
+	builder := &AppServiceBuild{service: &model.TenantServices{ServiceAlias: as.ServiceAlias}, appService: as}
+	port := &model.TenantServicesPort{ContainerPort: 53, Protocol: "tcp+udp", K8sServiceName: "demo-2048"}
 	for _, tc := range []struct {
 		port     int
 		protocol string
 		count    int
 	}{{30010, "tcp", 1}, {30020, "udp", 1}, {30030, "tcp+udp", 2}} {
 		svc := builder.nodePortService(as, port, &model.TCPRule{ContainerPort: 53, Port: tc.port, Protocol: tc.protocol})
+		if want := fmt.Sprintf("demo-2048-%d", tc.port); svc.Name != want {
+			t.Fatalf("expected configured service name %q, got %q", want, svc.Name)
+		}
+		if svc.Spec.Selector["service_alias"] != "grf9ce55" {
+			t.Fatalf("naming must not change the pod selector: %#v", svc.Spec.Selector)
+		}
 		if len(svc.Spec.Ports) != tc.count {
 			t.Fatalf("wrong transport count: %#v", svc.Spec.Ports)
 		}
@@ -59,3 +66,15 @@ func TestRestoreThreeIndependentMappingProtocols(t *testing.T) {
 		}
 	}
 }
+
+func TestNodePortServiceNameFallsBackToLegacyAlias(t *testing.T) {
+	as := &appv1.AppService{}
+	as.ServiceAlias = "grf9ce55"
+	as.SetTenant(&corev1.Namespace{})
+	builder := &AppServiceBuild{service: &model.TenantServices{ServiceAlias: as.ServiceAlias}, appService: as}
+	service := builder.nodePortService(as, &model.TenantServicesPort{ContainerPort: 8081},
+		&model.TCPRule{ContainerPort: 8081, Port: 30001, Protocol: "udp"})
+	if service.Name != "grf9ce55-30001" {
+		t.Fatalf("legacy port without a configured service name lost its alias: %s", service.Name)
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #2713** (2026-09-30): feat: inspect retired build versions (@RainBondsongyg)
- **PR #2712** (2026-09-30): feat: mount runtime for node inventory (@RainBondsongyg)
- **PR #2710** (2026-09-28): feat: measure upload packages separately from chunks (@RainBondsongyg)
- **PR #2709** (2026-09-27): fix: reject admission changes to cleanup executor authority (@RainBondsongyg)
- **PR #2708** (2026-09-27): fix: reject admission changes to cleanup executor authority (@RainBondsongyg)
- **PR #2707** (2026-09-27): Feat/cleanup version retirement (@RainBondsongyg)
- **PR #2706** (2026-09-29): fix: prevent index file download redirects (@zzzhangqi)
- **PR #2704** (2026-09-20): fix: tolerate dedicated node taints in source builds (@zzzhangqi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
