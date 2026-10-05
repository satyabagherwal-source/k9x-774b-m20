# Forensic Learning Record (Deep Inspection): 0xJacky/nginx-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/0xjacky-nginx-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/0xJacky/nginx-ui](https://github.com/0xJacky/nginx-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:35:59.266Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `0xJacky/nginx-ui`
- **Description**: Yet another WebUI for Nginx
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md, Dockerfile
- **Stars / Engagement**: 11562 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/access_list/access_list.go`
```
package access_list

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	internalaccess "github.com/0xJacky/Nginx-UI/internal/access_list"
	"github.com/0xJacky/Nginx-UI/internal/clustersync"
	"github.com/0xJacky/Nginx-UI/internal/site"
	"github.com/0xJacky/Nginx-UI/internal/stream"
	"github.com/0xJacky/Nginx-UI/model"
	"github.com/gin-gonic/gin"
	"github.com/uozi-tech/cosy"
	"github.com/uozi-tech/cosy/logger"
)

// accessListItem is a list as the list page shows it.
type accessListItem struct {
	*model.AccessList
	Warnings []internalaccess.Warning `json:"warnings"`
	// UsedBy counts the lists, sites and streams that use the list.
	UsedBy int `json:"used_by"`
}

type accessListPayload struct {
	Name     string             `json:"name" binding:"required,max=100"`
	Slug     string             `json:"slug"`
	Fallback string             `json:"fallback"`
	Rules    []model.AccessRule `json:"rules" binding:"max=1000"`
}

func (p accessListPayload) toModel(id uint64) *model.AccessList {
	rules := make([]model.AccessRule, 0, len(p.Rules))
	for _, rule := range p.Rules {
		rule.Value = strings.TrimSpace(rule.Value)
		rule.Note = strings.TrimSpace(rule.Note)
		if rule.Type == model.AccessRuleRef {
			rule.Value = ""
		} else {
			rule.RefID = 0
		}
		rules = append(rules, rule)
	}
	return &model.AccessList{
		Model:    model.Model{ID: id},
		Name:     p.Name,
		Slug:     strings.TrimSpace(p.Slug),
		Fallback: p.Fallback,
		Rules:    rules,
	}
}

func parseID(c *gin.Context) (uint64, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		cosy.ErrHandler(c, internalaccess.ErrAccessListNotFound)
		return 0, false
	}
	return id, true
}

// GetAccessLists returns every list. Lists are few, so the whole set is
// returned as one page.
func GetAccessLists(c *gin.Context) {
	lists, err := internalaccess.All()
	if err != nil {
		cosy.ErrHandler(c, err)
		return
	}

	usage := map[string]int{}
	for _, ref := range internalaccess.ScanReferences() {
		usage[ref.Slug]++
	}

	items := make([]accessListItem, 0, len(lists))
	for _, l := range lists {
		items = append(items, accessListItem{
			AccessList: l,
			Warnings:   internalaccess.Warnings(l),
			UsedBy:     usage[l.Slug] + len(internalaccess.DirectDependents(l.ID, lists)),
		})
	}

	c.JSON(http.StatusOK, model.DataList{
		Data: items,
		Pagination: model.Pagination{
			Total:       int64(len(items)),
			PerPage:     len(items),
			CurrentPage: 1,
			TotalPages:  1,
		},
	})
}

// GetAccessList returns one list.
func GetAccessList(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	list, err := internalaccess.Get(id)
	if err != nil {
		cosy.ErrHandler(c, err)
		return
	}
	c.JSON(http.StatusOK, accessListItem{AccessList: list, Warnings: internalaccess.Warnings(list)})
}

// GetAccessListUsage returns the lists, sites and streams that use a list.
func GetAccessListUsage(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	usage, err := internalaccess.UsageOf(id)
	if err != nil {
		cosy.ErrHandler(c, err)
		return
	}
	c.JSON(http.StatusOK, usage)
}

// PreviewAccessList renders a list without saving it.
func PreviewAccessList(c *gin.Context) {
	var json struct {
		accessListPayload
		ID uint64 `json:"id"`
	}
	if !cosy.BindAndValid(c, &json) {
		return
	}
	content, warnings, err := internalaccess.Preview(json.toModel(json.ID))
	if err != nil {
		cosy.ErrHandler(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"content":  content,
		"warnings": warnings,
	})
}

// CreateAccessList saves a new list.
func CreateAccessList(c *gin.Context) {
	var json accessListPayload
	if !cosy.BindAndValid(c, &json) {
		return
	}
	saveAccessList(c, json.toModel(0))
}

// ModifyAccessList updates a list. The slug is fixed at creation and ignored.
func ModifyAccessList(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	var json accessListPayload
	if !cosy.BindAndValid(c, &json) {
		return
	}
	saveAccessList(c, json.toModel(id))
}

func saveAccessList(c *gin.Context, list *model.AccessList) {
	result, err := internalaccess.Save(list)
	if err != nil {
		cosy.ErrHandler(c, err)
		return
	}

	go syncAccessLists(result.Slugs, result.References)

	c.JSON(http.StatusOK, accessListItem{AccessList: result.List, Warnings: internalaccess.Warnings(result.List)})
}

// syncAccessLists replicates changed list files to the nodes of the sites and
// streams that include them.
func syncAccessLists(slugs []string, refs []internalaccess.Reference) {
	seen := map[uint64]bool{}
	var nodeIDs []uint64
	for _, ref := range refs {
		var nodes []*model.Node
		switch ref.Kind {
		case internalaccess.RefKindSite:
			nodes = site.GetSyncNodes(ref.Name)
		case internalaccess.RefKindStream:
			nodes = stream.GetSyncNodes(ref.Name)
		}
		for _, node := range nodes {
			if !seen[node.ID] {
				seen[node.ID] = true
				nodeIDs = append(nodeIDs, node.ID)
			}
		}
	}
	if len(nodeIDs) == 0 {
		return
	}
	summary, err := clustersync.PushAccessLists(context.Background(), slugs, nodeIDs)
	if err != nil {
		logger.Errorf("Syncing access lists failed: %v", err)
		return
	}
	if summary.Failed > 0 {
		logger.Errorf("Syncing access lists failed on %d of %d node pushes", summary.Failed, summary.Total)
	}
}

// DeleteAccessList removes a list nothing uses.
func DeleteAccessList(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	if err := internalaccess.Delete(id); err != nil {
		cosy.ErrHandler(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

```

### Core Architecture Module: `api/access_list/control.go`
```
package access_list

import (
	"context"
	"net/http"

	internalaccess "github.com/0xJacky/Nginx-UI/internal/access_list"
	"github.com/0xJacky/Nginx-UI/internal/nginx"
	"github.com/0xJacky/Nginx-UI/internal/site"
	"github.com/0xJacky/Nginx-UI/internal/stream"
	"github.com/0xJacky/Nginx-UI/model"
	"github.com/0xJacky/Nginx-UI/query"
	"github.com/gin-gonic/gin"
	"github.com/uozi-tech/cosy"
)

// controlPayload carries the editor content. Advanced mode sends the file
// text, basic mode sends the structured configuration it edits.
type controlPayload struct {
	Content *string                 `json:"content"`
	Config  *nginx.NgxConfig        `json:"config"`
	Changes []internalaccess.Change `json:"changes"`
}

type controlResponse struct {
	Content *string                      `json:"content,omitempty"`
	Config  *nginx.NgxConfig             `json:"config,omitempty"`
	Servers []internalaccess.ServerState `json:"servers"`
}

func stateOf(payload *controlPayload) (*controlResponse, error) {
	switch {
	case payload.Config != nil:
		servers, err := internalaccess.StateOf(payload.Config)
		if err != nil {
			return nil, err
		}
		return &controlResponse{Config: payload.Config, Servers: servers}, nil
	case payload.Content != nil:
		servers, err := internalaccess.State(*payload.Content)
		if err != nil {
			return nil, err
		}
		return &controlResponse{Content: payload.Content, Servers: servers}, nil
	default:
		return &controlResponse{Servers: []internalaccess.ServerState{}}, nil
	}
}

// GetAccessControlState reports which access lists the servers and locations
// of the editor content use.
func GetAccessControlState(c *gin.Context) {
	var json controlPayload
	if !cosy.BindAndValid(c, &json) {
		return
	}
	resp, err := stateOf(&json)
	if err != nil {
		cosy.ErrHandler(c, err)
		return
	}
	resp.Config, resp.Content = nil, nil
	c.JSON(http.StatusOK, resp)
}

// ApplyAccessControl rewrites the access directives of the editor content and
// returns the new content together with its state.
func ApplyAccessControl(c *gin.Context) {
	var json controlPayload
	if !cosy.BindAndValid(c, &json) {
		return
	}

	if err := internalaccess.SlugsExist(changeSlugs(json.Changes)); err != nil {
		cosy.ErrHandler(c, err)
		return
	}

	switch {
	case json.Config != nil:
		if err := internalaccess.ApplyTo(json.Config, json.Changes); err != nil {
			cosy.ErrHandler(c, err)
			return
		}
	case json.Content != nil:
		content, err := internalaccess.Apply(*json.Content, json.Changes)
		if err != nil {
			cosy.ErrHandler(c, err)
			return
		}
		json.Content = &content
	}

	resp, err := stateOf(&json)
	if err != nil {
		cosy.ErrHandler(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

func changeSlugs(changes []internalaccess.Change) []string {
	var slugs []string
	for _, change := range changes {
		if change.Mode == internalaccess.ModeList {
			slugs = append(slugs, change.Slug)
		}
	}
	return slugs
}

// batchResult reports the outcome for one site or stream.
type batchResult struct {
	Name    string `json:"name"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

// BatchApplyAccessControl sets the server level access of every server block
// of the selected sites or streams, saving each file through the regular save
// path so it is tested, reloaded and synchronized.
func BatchApplyAccessControl(c *gin.Context) {
	var json struct {
		Kind  string   `json:"kind" binding:"required,oneof=site stream"`
		Names []string `json:"names" binding:"required,min=1,max=500"`
		Mode  string   `json:"mode" binding:"required,oneof=public list"`
		Slug  string   `json:"slug"`
	}
	if !cosy.BindAndValid(c, &json) {
		return
	}
	if json.Mode == internalaccess.ModeList {
		if err := internalaccess.SlugsExist([]string{json.Slug}); err != nil {
			cosy.ErrHandler(c, err)
			return
		}
	}

	results := make([]batchResult, 0, len(json.Names))
	for _, name := range json.Names {
		err := batchApplyOne(c.Request.Context(), json.Kind, name, json.Mode, json.Slug)
		result := batchResult{Name: name, Success: err == nil}
		if err != nil {
			result.Error = err.Error()
		}
		results = append(results, result)
	}

	c.JSON(http.StatusOK, gin.H{"results": results})
}

func batchApplyOne(ctx context.Context, kind, name, mode, slug string) error {
	resolve := site.ResolveAvailablePath
	if kind == internalaccess.RefKindStream {
		resolve = stream.ResolveAvailablePath
	}
	path, err := resolve(name)
	if err != nil {
		return err
	}
	raw, err := nginx.ReadFile(path)
	if err != nil {
		return err
	}
	content := string(raw)

	servers, err := internalaccess.State(content)
	if err != nil {
		return err
	}
	changes := make([]internalaccess.Change, 0, len(servers))
	for _, server := range servers {
		if server.Mode == mode && server.Slug == slug {
			continue
		}
		changes = append(changes, internalaccess.Change{Server: server.Index, Mode: mode, Slug: slug})
	}
	if len(changes) == 0 {
		return nil
	}
	updated, err := internalaccess.Apply(content, changes)
	if err != nil {
		return err
	}

	if kind == internalaccess.RefKindStream {
		s := query.Stream
		var syncNodeIDs []uint64
		if record, err := s.Where(s.Path.Eq(path)).First(); err == nil {
			syncNodeIDs = record.SyncNodeIDs
		}
		return stream.Save(ctx, name, updated, true, syncNodeIDs, model.PostSyncActionReloadNginx)
	}

	s := query.Site
	var namespaceID uint64
	var syncNodeIDs []uint64
	if record, err := s.Where(s.Path.Eq(path)).First(); err == nil {
		namespaceID = record.NamespaceID
		syncNodeIDs = record.SyncNodeIDs
	}
	return site.Save(ctx, name, updated, true, namespaceID, syncNodeIDs, model.PostSyncActionReloadNginx)
}

```

### Core Architecture Module: `api/access_list/router.go`
```
package access_list

import (
	"github.com/0xJacky/Nginx-UI/internal/middleware"
	"github.com/gin-gonic/gin"
)

// InitRouter registers the access list endpoints.
func InitRouter(r *gin.RouterGroup) {
	r.GET("access_lists", GetAccessLists)
	r.GET("access_lists/:id", GetAccessList)
	r.GET("access_lists/:id/usage", GetAccessListUsage)
	r.POST("access_lists/preview", PreviewAccessList)

	// Detecting and rewriting access directives only transforms the content
	// the editor sends; nothing is written to disk.
	r.POST("access_control/state", GetAccessControlState)
	r.POST("access_control/apply", ApplyAccessControl)

	o := r.Group("", middleware.RequireSecureSession())
	{
		o.POST("access_lists", CreateAccessList)
		o.POST("access_lists/:id", ModifyAccessList)
		o.DELETE("access_lists/:id", DeleteAccessList)
		o.POST("access_control/batch", BatchApplyAccessControl)
	}
}

```

### Core Architecture Module: `api/analytic/analytic.go`
```
package analytic

import (
	"fmt"
	"net/http"
	"runtime"
	"time"

	"github.com/0xJacky/Nginx-UI/internal/analytic"
	"github.com/0xJacky/Nginx-UI/internal/helper"
	"github.com/0xJacky/Nginx-UI/internal/kernel"
	"github.com/0xJacky/Nginx-UI/internal/middleware"
	"github.com/0xJacky/Nginx-UI/internal/version"
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/load"
	"github.com/spf13/cast"
	"github.com/uozi-tech/cosy/logger"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func Analytic(c *gin.Context) {
	var upGrader = websocket.Upgrader{
		CheckOrigin: middleware.CheckWebSocketOrigin,
	}
	// upgrade http to websocket
	ws, err := upGrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logger.Error(err)
		return
	}

	defer ws.Close()

	// This handler only writes. The keepalive owns the reader so pongs are
	// processed, and Done fires when the peer stops answering pings.
	keepalive := helper.StartWebSocketKeepaliveReader(ws)
	defer keepalive.Stop()
	peerGone := keepalive.Done()

	var stat Stat

	// waitNext throttles the loop and reports whether it should keep running.
	//
	// Every error path has to go through it. A bare `continue` would spin this
	// goroutine at full speed while flooding the log, and - because the
	// cancellation check lives at the bottom of the loop - it would also never
	// notice that the peer disconnected or that the process is shutting down,
	// leaking one hot goroutine per dashboard connection.
	waitNext := func() bool {
		select {
		case <-kernel.Context.Done():
			logger.Debug("Analytic: Context cancelled, closing WebSocket")
			return false
		case <-peerGone:
			logger.Debug("Analytic: peer disconnected, closing WebSocket")
			return false
		case <-time.After(1 * time.Second):
			return true
		}
	}

	for {
		stat.Memory, err = analytic.GetMemoryStat()
		if err != nil {
			logger.Error(err)
			if !waitNext() {
				return
			}
			continue
		}

		cpuTimesBefore, _ := cpu.Times(false)
		time.Sleep(1000 * time.Millisecond)
		cpuTimesAfter, _ := cpu.Times(false)
		threadNum := runtime.GOMAXPROCS(0)
		cpuUserUsage := (cpuTimesAfter[0].User - cpuTimesBefore[0].User) / (float64(1000*threadNum) / 1000)
		cpuSystemUsage := (cpuTimesAfter[0].System - cpuTimesBefore[0].System) / (float64(1000*threadNum) / 1000)

		stat.CPU = CPUStat{
			User:   cast.ToFloat64(fmt.Sprintf("%.2f", cpuUserUsage*100)),
			System: cast.ToFloat64(fmt.Sprintf("%.2f", cpuSystemUsage*100)),
			Idle:   cast.ToFloat64(fmt.Sprintf("%.2f", (1-cpuUserUsage-cpuSystemUsage)*100)),
			Total:  cast.ToFloat64(fmt.Sprintf("%.2f", (cpuUserUsage+cpuSystemUsage)*100)),
		}

		stat.Uptime, err = host.Uptime()
		if err != nil {
			logger.Error(err)
			if !waitNext() {
				return
			}
			continue
		}

		stat.LoadAvg, err = load.Avg()
		if err != nil {
			logger.Error(err)
			if !waitNext() {
				return
			}
			continue
		}

		stat.Disk, err = analytic.GetDiskStat()
		if err != nil {
			logger.Error(err)
			if !waitNext() {
				return
			}
			continue
		}

		network, err := analytic.GetNetworkStat()
		if err != nil {
			logger.Error(err)
			if !waitNext() {
				return
			}
			continue
		}

		stat.Network = *network
		stat.SampledAt = time.Now().UnixMilli()

		// write
		_ = ws.SetWriteDeadline(time.Now().Add(helper.WebSocketWriteWait))
		err = ws.WriteJSON(stat)
		if err != nil {
			if helper.IsUnexpectedWebsocketError(err) {
				logger.Error(err)
			}
			break
		}

		if !waitNext() {
			return
		}
	}
}

func GetAnalyticInit(c *gin.Context) {
	cpuInfo, err := cpu.Info()
	if err != nil {
		logger.Error(err)
	}

	network, err := analytic.GetNetworkStat()
	if err != nil {
		logger.Error(err)
	}

	memory, err := analytic.GetMemoryStat()
	if err != nil {
		logger.Error(err)
	}

	diskStat, err := analytic.GetDiskStat()
	if err != nil {
		logger.Error(err)
	}

	hostInfo, err := host.Info()
	if err != nil {
		logger.Error(err)
		hostInfo = &host.InfoStat{}
	}

	switch hostInfo.Platform {
	case "ubuntu":
		hostInfo.Platform = "Ubuntu"
	case "centos":
		hostInfo.Platform = "CentOS"
	}

	loadAvg, err := load.Avg()
	if err != nil {
		logger.Error(err)
		loadAvg = &load.AvgStat{}
	}

	ipAddresses, err := analytic.GetHostIPAddresses()
	if err != nil {
		logger.Error(err)
	}

	c.JSON(http.StatusOK, InitResp{
		Host:        hostInfo,
		IPAddresses: ipAddresses,
		CPU: CPURecords{
			Info:  cpuInfo,
			User:  analytic.CpuUserRecord,
			Total: analytic.CpuTotalRecord,
		},
		Network: NetworkRecords{
			Init:      *network,
			BytesRecv: analytic.NetRecvRecord,
			BytesSent: analytic.NetSentRecord,
		},
		DiskIO: DiskIORecords{
			Writes: analytic.DiskWriteRecord,
			Reads:  analytic.DiskReadRecord,
		},
		Memory:  memory,
		Disk:    diskStat,
		LoadAvg: loadAvg,
	})
}

func GetNode(c *gin.Context) {
	cpuInfo, err := cpu.Info()
	if err != nil {
		logger.Error(err)
	}

	memory, err := analytic.GetMemoryStat()
	if err != nil {
		logger.Error(err)
	}

	diskStat, err := analytic.GetDiskStat()
	if err != nil {
		logger.Error(err)
	}

	hostInfo, err := host.Info()
	if err != nil {
		logger.Error(err)
		hostInfo = &host.InfoStat{}
	}

	switch hostInfo.Platform {
	case "ubuntu":
		hostInfo.Platform = "Ubuntu"
	case "centos":
		hostInfo.Platform = "CentOS"
	}

	runtimeInfo, err := version.GetRuntimeInfo()
	if err != nil {
		logger.Error("Failed to get runtime info:", err)
		runtimeInfo = version.RuntimeInfo{
			OS:   fmt.Sprintf("%s %s", hostInfo.Platform, hostInfo.PlatformVersion),
			Arch: runtime.GOARCH,
		}
	}

	ver := version.GetVersionInfo()

	nodeInfo := analytic.NodeInfo{
		NodeRuntimeInfo: runtimeInfo,
		Version:         ver.Version,
		CPUNum:          len(cpuInfo),
		MemoryTotal:     memory.Total,
		DiskTotal:       diskStat.Total,
	}

	c.JSON(http.StatusOK, nodeInfo)
}

```

### Core Architecture Module: `api/analytic/nodes.go`
```
package analytic

import (
	"time"

	"github.com/0xJacky/Nginx-UI/internal/analytic"
	"github.com/0xJacky/Nginx-UI/internal/helper"
	"github.com/0xJacky/Nginx-UI/internal/kernel"
	"github.com/0xJacky/Nginx-UI/internal/middleware"
	"github.com/0xJacky/Nginx-UI/internal/version"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/uozi-tech/cosy/logger"
)

func GetNodeStat(c *gin.Context) {
	var upGrader = websocket.Upgrader{
		CheckOrigin: middleware.CheckWebSocketOrigin,
	}
	// upgrade http to websocket
	ws, err := upGrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logger.Error(err)
		return
	}

	defer ws.Close()

	keepalive := helper.StartWebSocketKeepaliveReader(ws)
	defer keepalive.Stop()
	peerGone := keepalive.Done()

	// Counter to track iterations for periodic full info update
	counter := 0
	const fullInfoInterval = 6 // Send full info every 6 iterations (every minute if interval is 10s)

	for {
		var data interface{}

		// Every fullInfoInterval iterations, send complete node information including version
		if counter%fullInfoInterval == 0 {
			// Get complete node information including version
			runtimeInfo, err := version.GetRuntimeInfo()
			if err != nil {
				logger.Error("Failed to get runtime info:", err)
				// Fallback to stat only
				data = analytic.GetNodeStat()
			} else {
				cpuInfo, _ := cpu.Info()
				memory, _ := analytic.GetMemoryStat()
				ver := version.GetVersionInfo()
				diskUsage, _ := analytic.GetDiskStat()

				nodeInfo := analytic.NodeInfo{
					NodeRuntimeInfo: runtimeInfo,
					CPUNum:          len(cpuInfo),
					MemoryTotal:     memory.Total,
					DiskTotal:       diskUsage.Total,
					Version:         ver.Version,
				}

				stat := analytic.GetNodeStat()

				// Send complete node information
				data = analytic.Node{
					NodeInfo: nodeInfo,
					NodeStat: stat,
				}
			}
		} else {
			// Send only stat information for performance
			data = analytic.GetNodeStat()
		}

		// write
		_ = ws.SetWriteDeadline(time.Now().Add(helper.WebSocketWriteWait))
		err = ws.WriteJSON(data)
		if err != nil {
			if helper.IsUnexpectedWebsocketError(err) {
				logger.Error(err)
			}
			break
		}

		counter++

		select {
		case <-kernel.Context.Done():
			logger.Debug("GetNodeStat: Context cancelled, closing WebSocket")
			return
		case <-peerGone:
			logger.Debug("GetNodeStat: peer disconnected, closing WebSocket")
			return
		case <-time.After(10 * time.Second):
		}
	}
}

func GetNodesAnalytic(c *gin.Context) {
	var upGrader = websocket.Upgrader{
		CheckOrigin: middleware.CheckWebSocketOrigin,
	}
	// upgrade http to websocket
	ws, err := upGrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logger.Error(err)
		return
	}

	defer ws.Close()

	keepalive := helper.StartWebSocketKeepaliveReader(ws)
	defer keepalive.Stop()
	peerGone := keepalive.Done()

	for {
		// Send snapshot of NodeMap data to client to avoid concurrent access
		nodeSnapshot := analytic.SnapshotNodeMap()
		_ = ws.SetWriteDeadline(time.Now().Add(helper.WebSocketWriteWait))
		err = ws.WriteJSON(nodeSnapshot)
		if err != nil {
			if helper.IsUnexpectedWebsocketError(err) {
				logger.Error(err)
			}
			break
		}

		select {
		case <-kernel.Context.Done():
			logger.Debug("GetNodesAnalytic: Context cancelled, closing WebSocket")
			return
		case <-peerGone:
			logger.Debug("GetNodesAnalytic: peer disconnected, closing WebSocket")
			return
		case <-time.After(10 * time.Second):
		}
	}
}

```

### Core Architecture Module: `api/analytic/router.go`
```
package analytic

import (
	"github.com/gin-gonic/gin"
)

func InitWebSocketRouter(r *gin.RouterGroup) {
	r.GET("analytic", Analytic)
	r.GET("analytic/intro", GetNodeStat)
	r.GET("analytic/nodes", GetNodesAnalytic)
}

func InitRouter(r *gin.RouterGroup) {
	r.GET("analytic/init", GetAnalyticInit)
	r.GET("node", GetNode)
}

```

### Core Architecture Module: `api/analytic/type.go`
```
package analytic

import (
	"github.com/0xJacky/Nginx-UI/internal/analytic"
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/load"
	"github.com/shirou/gopsutil/v4/net"
)

type CPUStat struct {
	User   float64 `json:"user"`
	System float64 `json:"system"`
	Idle   float64 `json:"idle"`
	Total  float64 `json:"total"`
}

type Stat struct {
	SampledAt int64              `json:"sampled_at"`
	Uptime    uint64             `json:"uptime"`
	LoadAvg   *load.AvgStat      `json:"loadavg"`
	CPU       CPUStat            `json:"cpu"`
	Memory    analytic.MemStat   `json:"memory"`
	Disk      analytic.DiskStat  `json:"disk"`
	Network   net.IOCountersStat `json:"network"`
}

type CPURecords struct {
	Info  []cpu.InfoStat            `json:"info"`
	User  []analytic.Usage[float64] `json:"user"`
	Total []analytic.Usage[float64] `json:"total"`
}

type NetworkRecords struct {
	Init      net.IOCountersStat       `json:"init"`
	BytesRecv []analytic.Usage[uint64] `json:"bytesRecv"`
	BytesSent []analytic.Usage[uint64] `json:"bytesSent"`
}

type DiskIORecords struct {
	Writes []analytic.Usage[uint64] `json:"writes"`
	Reads  []analytic.Usage[uint64] `json:"reads"`
}

type InitResp struct {
	Host        *host.InfoStat    `json:"host"`
	IPAddresses []string          `json:"ip_addresses"`
	CPU         CPURecords        `json:"cpu"`
	Network     NetworkRecords    `json:"network"`
	DiskIO      DiskIORecords     `json:"disk_io"`
	Memory      analytic.MemStat  `json:"memory"`
	Disk        analytic.DiskStat `json:"disk"`
	LoadAvg     *load.AvgStat     `json:"loadavg"`
}

```

### Core Architecture Module: `api/api.go`
```
package api

import (
	"github.com/0xJacky/Nginx-UI/model"
	"github.com/gin-gonic/gin"
)

func CurrentUser(c *gin.Context) *model.User {
	return c.MustGet("user").(*model.User)
}

func SetSSEHeaders(c *gin.Context) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	// https://stackoverflow.com/questions/27898622/server-sent-events-stopped-work-after-enabling-ssl-on-proxy/27960243#27960243
	c.Header("X-Accel-Buffering", "no")
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1970** (2026-09-28): **批量修改站点的命名空间报错了**
  *Symptoms*: <img width="782" height="697" alt="Image" src="https://github.com/user-attachments/assets/c9aee994-63c7-4a6e-8dd7-0e4d7698c3b4" />  v2.7.0版本，chrome浏览器，如上图所示。  开发者模式显示http://Ip:9000/api/sites错误如下： ``` {     "scope": "validate",     "code": 406,     "message": "Requested with wrong parameters",     "errors": {         "body": "empty payload"     } } ```  单独点进站点改命名空间一切正常。

- **Issue #1968** (2026-09-28): **DDNS is updating A+AAAA records even if not selected**
  *Symptoms*: **Describe the bug** I have a domain dns4.domain.com (A + AAAA records) and dns6.domain.com (A + AAAA records). In DDNS I have configured to update IP4 and then IP6. As domains I have selected: - dns4.domain.com (A) - dns6.domain.com (AAAA)  After clicking save then the records to update are: - dns4.domain.com (A) - dns4.domain.com (AAAA) - dns6.domain.com (A) - dns6.domain.com (AAAA)  **To Reproduce** See description  **Expected behavior** Only the selected records are considered for update.  **Screenshots** DDNS record selection: <img width="469" height="97" alt="Image" src="https://github.com/user-attachments/assets/bf4ce0c8-761b-49e9-ac72-ccf7c12cee04" />  DDNS record result: <img width="718" height="92" alt="Image" src="https://github.com/user-attachments/assets/b5eb591a-200d-4ec0-bf4d-06f38a330a49" />  **Info (please complete the following information):**  - Server OS: Server OS: debian 12  - Server Arch: x64  - Nginx UI Version: 2.6.1  - Your Browser: Firefox  **Additional context** N/A 

- **Issue #1954** (2026-09-22): **Fix German localization typos in de_DE.po**
  *Symptoms*: The German translation file contains a few obvious spelling mistakes in the UI strings, which make the German locale look inconsistent and unpolished.  **Affected file:**  app/src/language/de_DE.po Examples:  "Error Logs" is currently translated as:  "Feherlogs" This should be corrected to "Fehlerlogs" or "Fehlerprotokolle" "Not Valid Before: %{date}" is currently translated as:  "Nich gültig vor: %{date}" This should be corrected to "Nicht gültig vor: %{date}" Expected behavior: German UI strings should be grammatically correct and consistent with the rest of the locale file.  **Actual behavior:** Some German texts include visible typos and incorrect wording, which are shown to users in the interface.  **Suggested fix:**  Correct the spelling and wording in app/src/language/de_DE.po Review the surrounding German translations for similar mistakes Verify the strings render correctly in the application after the change This is a localization quality issue rather than a functional bug, but it affects the overall user experience in the German UI.
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report! Fixed in 7cc52451dc.  Besides the two strings you mentioned (`Feherlogs` → `Fehlerprotokolle`, `Nich gültig vor` → `Nicht gültig vor`), I reviewed the rest of `de_DE.po` and corrected 24 more entries:  - Spelling: `Benuztername`, `Scrheibe`, `Feher`, `Nicth`, `FDatei`, `Beffehl`, `Aktiviern`, `CPU -Kerne`, `Benuzte Wiederherstellungscode` - Truncated strings: `Kom` (Comments), `Konf` (Configuration Name), `Er` (Creating client…) - Mistranslations: "Reload" rendered as `Neustart`, `Vergleiche mit Strom`, `Warteverfahren`, `Standorte` for sites, and a few garbled sentences - Grammar and consistency: `Änderungsvorschau`, `Inkrementelles Index-Scanning`, `Zugriffsprotokolle`  The fix will ship in the next release. Further corrections from native speakers are always welcome.

- **Issue #1943** (2026-09-20): **dns01 _acme-challenge records not deleted with deSEC.io**
  *Symptoms*: **Describe the bug** When issuing a certificate with deSEC as DNS provider, the process fails to delete the temporary TXT record  **To Reproduce** Steps to reproduce the behavior: 1. Add deSEC.io as DNS provider 2. Issue/re-issue a certificate using deSEC as DNS provider 3. Wait for the process to execute 4. See error  **Expected behavior** The temporary `_acme-challenge` TXT record should be deleted  **Info (please complete the following information):** Current Version: v2.6.1 (7ed4fc4) OS: linux Arch: amd64 Deployment: Docker Container  **Additional context** ``` time=2026-09-19T17:36:43.013+03:00 level=INFO msg="dns01: waiting for record propagation." domain=sub.example.com  time=2026-09-19T17:37:14.758+03:00 level=INFO msg="The server validated our request." domain=sub.example.com  time=2026-09-19T17:37:14.758+03:00 level=INFO msg="dns01: cleaning DNS-01 challenge." domain=sub.example.com  time=2026-09-19T17:37:14.914+03:00 level=WARN msg="Cleaning up failed." domain=sub.example.com error="desec: failed to update records: domainName=example.com, recordName=_acme-challenge.sub: 400: body: {\"subname\":[\"Can only be written on create.\"]}"  time=2026-09-19T17:37:14.914+03:00 level=INFO msg="Validations succeeded; requesting certificates." domains=sub.example.com  [Nginx UI] Writing certificate to disk ``` 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. This was caused by a regression in `github.com/nrdcg/desec v0.11.2`, which sends the create-only `subname` field in PATCH requests. We have pinned the dependency to `v0.11.1` and explicitly excluded the affected release in d750df2f1d. The fix will be included in v2.6.2.

- **Issue #1940** (2026-09-20): **Namespace upstream sync error**
  *Symptoms*: When first deploying sites with namespace sync, if sites point to upstream that added with same sync (site with upstream section only), sync will error with: my_remote: my_site.local - /api/sites/my_site.local responded with 500: {     "scope": "nginx", "code": 50000, "message": "nginx error: {0}", "params": [         "nginx [emerg] host not found in upstream \"my_upstream\" in /etc/nginx/sites-enabled/my_site.local" ]}  Steps to reproduce the behavior: 1. Create empty namespace. 2. Create 2 sites: one with upstream only, another points to that upstream. 3. Add both sites to namespace and turn on. 4. Assign remote to namespace and sync manually.  It was intended to sync all together at same time, or at right order (also tried to order sites by name them lexicographically before sync)  Info:  - Server OS: docker image from dockerhub  - Server Arch: amd64  - Nginx UI Version: 2.6.0  - Your Browser: Microsoft Edge 130.0  Fixing by just sync once again, but makes me wonder if it can lead to uncontrollable post-sync behavior in manual sync mode.
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. This has been fixed in commit 7626fd40d9. Namespace sync now stages all managed site and stream configuration files before applying individual enabled states, so interdependent upstream and site configurations no longer fail based on item order. The fix will be included in v2.6.2.

- **Issue #1939** (2026-09-20): **Namespace sites replacement issue**
  *Symptoms*: When master and remote nodes both have sites with same name, after master sites assigned to namespace with remote node - on remote that sites will be changed, but still will appear as just local sites (not from namespace). And if this sites are only namespace content - on remote that namespace will not be created at all.  Steps to reproduce the behavior: 1. Create different sites with same name on both nodes locally (nodes don't have common namespace). 2. On master node create namespace with remote node. 3. Add site to namespace in site edit tab. 4. Connect to remote - site updated, but namespace not created (no namespace tab in sites list page, and no namespace in namespaces created)  Info:  - Server OS: docker image from dockerhub  - Server Arch: amd64  - Nginx UI Version: 2.6.0  - Your Browser: Microsoft Edge 130.0  Fixing by deleting all affected sites from remote, and sync manually from master.
  **Post-Mortem & Fix Analysis**:
  > Fixed. The single-item site and stream propagation paths now include the namespace name in remote save payloads. Receiving nodes resolve or create that namespace before updating the configuration, so same-named local configurations are reassigned instead of being overwritten without namespace metadata. Regression coverage was added for both paths, and the full race-enabled backend test suite passes.

- **Issue #1936** (2026-09-20): **Access logs not showing domain (for some sites)**
  *Symptoms*: **Describe the bug** Accessing websites create an access log but the field where the website/domain should be listed, only shows `"-"`. This only applies for some sites.  Good log: ``` 83.0.2 - - [17/Sep/2026:15:37:52 +0000] "GET /assets/route-config.json HTTP/2.0" 304 0 "https://nas.local.com/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:156.0) Gecko/20100101 Firefox/156.0" ```  Bad log: ``` 10.83.0.2 - - [17/Sep/2026:15:39:01 +0000] "GET /pages/index.htm HTTP/2.0" 302 0 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:156.0) Gecko/20100101 Firefox/156.0" 10.83.0.2 - - [17/Sep/2026:15:39:01 +0000] "GET /login.htm HTTP/2.0" 200 1914 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:156.0) Gecko/20100101 Firefox/156.0" 10.83.0.2 - - [17/Sep/2026:15:39:01 +0000] "GET /webui/js/extern/jquery.js HTTP/2.0" 304 0 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:156.0) Gecko/20100101 Firefox/156.0" ```  Due to this, filtering log entries is not reliable.  **To Reproduce** Unfortunately I do not know how to reproduce. I have compared the sites and changed to have the same settings (except name + certificate). The issue still exists.  **Expected behavior** In the access logs I always see the requested site.  **Screenshots** N/A  **Info (please complete the following information):**  - Server OS: debian 12  - Server Arch: x64  - Nginx UI Version: 2.5.10  - Your Browser: Firefox  **Additional context** n/a
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. The quoted field after `body_bytes_sent` in the standard combined access log format is `$http_referer`, not the requested domain. A value of `"-"` means that the client did not send a `Referer` header. This is valid and can depend on how the page was opened, redirects, the site’s `Referrer-Policy`, or browser privacy settings.  Because Referer is optional, it cannot reliably identify the virtual host. If multiple sites share the same access log, please enable a separate access log for each site in the site editor so their requests can be viewed and analyzed independently.  Filtering a shared log by the requested host would require logging and indexing `$host` as a separate field, which would be an enhancement rather than a bug in the current parser.

- **Issue #1918** (2026-09-16): **2FA输入后无法自动跳转**
  *Symptoms*: **Describe the bug** 升级到最新版本后，用户已启用2FA验证，输入后无法自动跳转~  **Screenshots**  <img width="686" height="398" alt="Image" src="https://github.com/user-attachments/assets/3da6140e-06ce-41e3-96b8-76cdd96e6544" />  **Info (please complete the following information):**  - Server OS: Win10 LTSC Lasted  - Server Arch: [e.g. x86, aach64]  - Nginx UI Version: 2.6.0  - Your Browser: Chrome140.0 
  **Post-Mortem & Fix Analysis**:
  > 一样遇到了，如何破？
  > 请升级到 v2.6.1 @sunhao-java @tvnn 
  > docker镜像没发吧？@0xJacky

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

### Incident Patch 1: `06c8f951` (2026-09-29)
**Commit Message**: fix(cert): replicate certificates to the nodes that serve them

Issuing a certificate for a synced site wrote the files only on the local
node, then pushed a site configuration that loads them. The remote Nginx
test failed with "cannot load certificate" and the node rolled back,
leaving it out of sync. Certificate records never inherited the site or
namespace sync nodes, so renewals never reached those nodes either.

- Push the certificate pairs a site or stream loads before the file itself
  on every save, node sync and namespace sync.
- Sync issued and renewed certificates to the sync nodes of every site and
  stream that loads them, not only to the certificate's own sync nodes.
- Skip the write and reload on a node that already holds the same pair.
- Fix inverted zh_CN notifications for remote site and stream sync.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `api/certificate/certificate.go` (modified, +9/-0)
```diff
@@ -348,6 +348,15 @@ func SyncCertificate(c *gin.Context) {
 		SSLCertificateKey:     json.SSLCertificateKey,
 	}
 
+	// Every save of a site replicates the certificates it loads, so an
+	// unchanged pair must not cost the node a reload each time.
+	if content.MatchesFiles() {
+		c.JSON(http.StatusOK, gin.H{
+			"message": "ok",
+		})
+		return
+	}
+
 	err = content.WriteFile()
 	if err != nil {
 		cosy.ErrHandler(c, err)
```

**File**: `api/certificate/issue.go` (modified, +18/-0)
```diff
@@ -9,7 +9,9 @@ import (
 	"github.com/0xJacky/Nginx-UI/internal/cert"
 	"github.com/0xJacky/Nginx-UI/internal/helper"
 	"github.com/0xJacky/Nginx-UI/internal/middleware"
+	"github.com/0xJacky/Nginx-UI/internal/notification"
 	"github.com/0xJacky/Nginx-UI/internal/translation"
+	"github.com/0xJacky/Nginx-UI/query"
 	"github.com/gin-gonic/gin"
 	"github.com/go-acme/lego/v5/certcrypto"
 	"github.com/gorilla/websocket"
@@ -125,6 +127,8 @@ func IssueCert(c *gin.Context) {
 		return
 	}
 
+	syncIssuedCertificate(certModel.ID)
+
 	if err := wsWriter.WriteJSON(IssueCertResponse{
 		Status:            Success,
 		Message:           translation.C("[Nginx UI] Issued certificate successfully").ToString(),
@@ -147,3 +151,17 @@ var (
 	markCertSuccess  = cert.MarkCertSuccess
 	shortError       = cert.ShortError
 )
+
+// syncIssuedCertificate pushes a freshly issued certificate to the nodes that
+// serve it. A reissue keeps the file paths, so no site configuration changes
+// and no site sync would carry the new files to those nodes.
+func syncIssuedCertificate(id uint64) {
+	issued, err := query.Cert.FirstByID(id)
+	if err != nil {
+		logger.Error(err)
+		return
+	}
+	if err = cert.SyncToRemoteServer(issued); err != nil {
+		notification.Error("Sync Certificate Error", err.Error(), nil)
+	}
+}
```

**File**: `app/src/api/cluster_sync.ts` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 /** Content kinds replicated by a cluster synchronization run. */
-export type SyncKind = 'config' | 'site' | 'stream' | 'namespace'
+export type SyncKind = 'config' | 'site' | 'stream' | 'namespace' | 'certificate'
 
 /** Outcome of a single item on a single node. */
 export interface SyncResult {
```

**File**: `app/src/language/zh_CN.po` (modified, +7/-7)
```diff
@@ -1145,7 +1145,7 @@ msgid "Disable Remote Site Error"
 msgstr "禁用远程站点错误"
 
 msgid "Disable site %{name} from %{node} failed"
-msgstr "在 %{node} 上禁用 %{name} 成功"
+msgstr "在 %{node} 上禁用 %{name} 失败"
 
 msgid "Disable Remote Site Success"
 msgstr "远程站点禁用成功"
@@ -1193,7 +1193,7 @@ msgid "Rename Remote Site Error"
 msgstr "重命名远程站点错误"
 
 msgid "Rename site %{name} to %{new_name} on %{node} failed"
-msgstr "在 %{node} 上将站点 %{name} 重命名为 %{new_name} 成功"
+msgstr "在 %{node} 上将站点 %{name} 重命名为 %{new_name} 失败"
 
 msgid "Rename Remote Site Success"
 msgstr "重命名远程站点成功"
@@ -1205,7 +1205,7 @@ msgid "Save Remote Site Error"
 msgstr "保存远程站点错误"
 
 msgid "Save site %{name} to %{node} failed"
-msgstr "成功将站点 %{name} 保存到 %{node} 中"
+msgstr "将站点 %{name} 保存到 %{node} 失败"
 
 msgid "Save Remote Site Success"
 msgstr "保存远程站点成功"
@@ -1268,25 +1268,25 @@ msgid "Rename Remote Stream Error"
 msgstr "重命名远程 Stream 错误"
 
 msgid "Rename stream %{name} to %{new_name} on %{node} failed"
-msgstr "在 %{node} 上将站点 %{name} 重命名为 %{new_name} 成功"
+msgstr "在 %{node} 上将 Stream %{name} 重命名为 %{new_name} 失败"
 
 msgid "Rename Remote Stream Success"
 msgstr "重命名远程 Stream 成功"
 
 msgid "Rename stream %{name} to %{new_name} on %{node} successfully"
-msgstr "在 %{node} 上将站点 %{name} 重命名为 %{new_name} 成功"
+msgstr "在 %{node} 上将 Stream %{name} 重命名为 %{new_name} 成功"
 
 msgid "Save Remote Stream Error"
 msgstr "保存远程 Stream 错误"
 
 msgid "Save stream %{name} to %{node} failed"
-msgstr "部署 %{name} 到 %{node} 失败"
+msgstr "将 Stream %{name} 保存到 %{node} 失败"
 
 msgid "Save Remote Stream Success"
 msgstr "保存远程 Stream 成功"
 
 msgid "Save stream %{name} to %{node} successfully"
-msgstr "成功将站点 %{name} 保存到 %{node} 中"
+msgstr "成功将 Stream %{name} 保存到 %{node} 中"
 
 msgid "Convert Remote Upstream Error"
 msgstr "远程 Upstream 转换错误"
```

**File**: `internal/cert/sync.go` (modified, +43/-21)
```diff
@@ -13,6 +13,7 @@ import (
 	"github.com/0xJacky/Nginx-UI/model"
 	"github.com/0xJacky/Nginx-UI/query"
 	"github.com/go-acme/lego/v5/certcrypto"
+	"github.com/samber/lo"
 	"github.com/uozi-tech/cosy/logger"
 )
 
@@ -25,45 +26,44 @@ type SyncCertificatePayload struct {
 	KeyType               certcrypto.KeyType `json:"key_type"`
 }
 
+// SyncToRemoteServer pushes the certificate files to the nodes configured on
+// the certificate and to the sync nodes of every site and stream that loads
+// it, so a renewal reaches each node that serves the certificate.
 func SyncToRemoteServer(c *model.Cert) (err error) {
-	if c.SSLCertificatePath == "" || c.SSLCertificateKeyPath == "" || len(c.SyncNodeIds) == 0 {
+	if c.SSLCertificatePath == "" || c.SSLCertificateKeyPath == "" {
 		return
 	}
 
-	nginxConfPath := nginx.GetConfPath()
-	if !helper.IsUnderDirectory(c.SSLCertificatePath, nginxConfPath) {
-		return e.NewWithParams(50006, ErrPathIsNotUnderTheNginxConfDir.Error(), c.SSLCertificatePath, nginxConfPath)
+	nodeIDs := lo.Uniq(append(append([]uint64{}, c.SyncNodeIds...), referencingNodeIDs(c)...))
+	if len(nodeIDs) == 0 {
+		return
 	}
 
-	if !helper.IsUnderDirectory(c.SSLCertificateKeyPath, nginxConfPath) {
-		return e.NewWithParams(50006, ErrPathIsNotUnderTheNginxConfDir.Error(), c.SSLCertificateKeyPath, nginxConfPath)
+	nginxConfPath := nginx.GetConfPath()
+	for _, path := range []string{c.SSLCertificatePath, c.SSLCertificateKeyPath} {
+		if helper.IsUnderDirectory(path, nginxConfPath) {
+			continue
+		}
+		// Files outside the configuration directory are managed on each node
+		// by other means. Only an explicit sync target makes that an error.
+		if len(c.SyncNodeIds) == 0 {
+			return nil
+		}
+		return e.NewWithParams(50006, ErrPathIsNotUnderTheNginxConfDir.Error(), path, nginxConfPath)
 	}
 
-	certBytes, err := nginx.ReadFile(c.SSLCertificatePath)
-	if err != nil {
-		return
-	}
-	keyBytes, err := nginx.ReadFile(c.SSLCertificateKeyPath)
+	payload, err := newSyncPayload(c.Name, c.SSLCertificatePath, c.SSLCertificateKeyPath, c.GetKeyType())
 	if err != nil {
 		return
 	}
 
-	payload := &SyncCertificatePayload{
-		Name:                  c.Name,
-		SSLCertificatePath:    c.SSLCertificatePath,
-		SSLCertificateKeyPath: c.SSLCertificateKeyPath,
-		SSLCertificate:        string(certBytes),
-		SSLCertificateKey:     string(keyBytes),
-		KeyType:               c.GetKeyType(),
-	}
-
 	payloadBytes, err := json.Marshal(payload)
 	if err != nil {
 		return
 	}
 
 	q := query.Node
-	nodes, _ := q.Where(q.ID.In(c.SyncNodeIds...)).Find()
+	nodes, _ := q.Where(q.ID.In(nodeIDs...)).Find()
 	for _, node := range nodes {
 		go func() {
 			err := deploy(node, c, payloadBytes)
@@ -76,6 +76,28 @@ func SyncToRemoteServer(c *model.Cert) (err error) {
 	return
 }
 
+// newSyncPayload reads a certificate pair from the Nginx target filesystem
+// into the body accepted by the /api/cert_sync endpoint of a node.
+func newSyncPayload(name, certPath, keyPath string, keyType certcrypto.KeyType) (*SyncCertificatePayload, error) {
+	certBytes, err := nginx.ReadFile(certPath)
+	if err != nil {
+		return nil, err
+	}
+	keyBytes, err := nginx.ReadFile(keyPath)
+	if err != nil {
+		return nil, err
+	}
+
+	return &SyncCertificatePayload{
+		Name:                  name,
+		SSLCertificatePath:    certPath,
+		SSLCertificateKeyPath: keyPath,
+		SSLCertificate:        string(certBytes),
+		SSLCertificateKey:     string(keyBytes),
+		KeyType:               keyType,
+	}, nil
+}
+
 type SyncNotificationPayload struct {
 	StatusCode int    `json:"status_code"`
 	CertName   string `json:"cert_name"`
```

---

### Incident Patch 2: `79caf96b` (2026-09-29)
**Commit Message**: fix(2fa): allow dismissing the 2FA prompt

The OTP modal had no footer, no close button and a non-closable mask,
so once opened by mistake it could only be escaped by reloading the
page. Enable the close button and Esc; both route through onCancel,
which rejects with TwoFACancelledError that callers already handle.
The mask stays non-closable to protect a half-typed code.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `app/src/components/TwoFA/use2FAModal.ts` (modified, +6/-0)
```diff
@@ -83,6 +83,12 @@ function use2FAModal() {
       const modalInstance = modal.value!.confirm({
         title: $gettext('Two-factor authentication required'),
         centered: true,
+        // Let the user back out (X button or Esc) when the prompt was opened
+        // by mistake or no authenticator is at hand. Both paths go through
+        // onCancel, which rejects with TwoFACancelledError. The mask stays
+        // non-closable so a stray click does not discard a half-typed code.
+        closable: true,
+        keyboard: true,
         maskClosable: false,
         class: randomId,
         footer: null,
```

---

### Incident Patch 3: `7d021725` (2026-09-25)
**Commit Message**: fix(i18n): keep message contexts in the web catalog

**File**: `internal/translation/translation.go` (modified, +57/-3)
```diff
@@ -5,16 +5,26 @@ import (
 	"fmt"
 	"io"
 	"log"
+	"slices"
 
 	"github.com/0xJacky/Nginx-UI/app"
 	"github.com/0xJacky/pofile"
 	"github.com/samber/lo"
 )
 
+// Dict holds the flat catalogs used by backend messages such as
+// notifications. Entries with a msgctxt are left out because pofile.Dict
+// cannot look them up.
 var Dict map[string]pofile.Dict
 
+// webDict holds the catalogs served to the web app. Entries that share a
+// msgid are merged into one object keyed by msgctxt, with "" for the entry
+// without a context, which is the shape vue3-gettext expects.
+var webDict map[string]map[string]any
+
 func init() {
 	Dict = make(map[string]pofile.Dict)
+	webDict = make(map[string]map[string]any)
 
 	fs, err := app.GetDistFS()
 	if err != nil {
@@ -69,9 +79,53 @@ func handlePo(langCode string) {
 		log.Fatalln(err)
 	}
 
-	Dict[langCode] = p.ToDict()
+	Dict[langCode], webDict[langCode] = buildDicts(p)
+}
+
+// buildDicts splits the parsed entries into the flat dictionary used by
+// backend messages and the context aware one served to the web app.
+func buildDicts(p *pofile.Pofile) (flat pofile.Dict, web map[string]any) {
+	flat = make(pofile.Dict)
+	web = make(map[string]any)
+
+	for _, item := range p.Items {
+		if slices.Contains(item.Flags, "fuzzy") {
+			continue
+		}
+
+		var value any
+		if len(item.MsgStr) == 1 {
+			value = item.MsgStr[0]
+		} else if len(item.MsgStr) > 1 {
+			value = slices.Clone(item.MsgStr)
+		}
+
+		if item.Msgctxt == "" {
+			flat[item.MsgId] = value
+		}
+
+		existing, found := web[item.MsgId]
+		contexts, isObject := existing.(map[string]any)
+		switch {
+		case item.Msgctxt == "" && !isObject:
+			web[item.MsgId] = value
+		case item.Msgctxt == "":
+			contexts[""] = value
+		case isObject:
+			contexts[item.Msgctxt] = value
+		default:
+			contexts = map[string]any{item.Msgctxt: value}
+			if found {
+				contexts[""] = existing
+			}
+			web[item.MsgId] = contexts
+		}
+	}
+
+	return
 }
 
-func GetTranslation(langCode string) pofile.Dict {
-	return Dict[langCode]
+// GetTranslation returns the catalog for the web app.
+func GetTranslation(langCode string) map[string]any {
+	return webDict[langCode]
 }
```

**File**: `internal/translation/translation_test.go` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+package translation
+
+import (
+	"testing"
+
+	"github.com/0xJacky/pofile"
+	"github.com/stretchr/testify/assert"
+)
+
+const contextCatalog = `msgid ""
+msgstr ""
+"Content-Type: text/plain; charset=UTF-8\n"
+"Plural-Forms: nplurals=1; plural=0;\n"
+
+msgid "Maintenance"
+msgstr "维护模式"
+
+msgctxt "preference group"
+msgid "Maintenance"
+msgstr "维护"
+
+msgctxt "action"
+msgid "Save"
+msgstr "保存"
+
+msgid "Save"
+msgstr "保存更改"
+
+msgid "Plain"
+msgstr "普通"
+
+#, fuzzy
+msgid "Fuzzy"
+msgstr "模糊"
+
+msgid "%{count} item"
+msgid_plural "%{count} items"
+msgstr[0] "%{count} 项"
+
+msgid "%{count} file"
+msgid_plural "%{count} files"
+msgstr[0] "%{count} Datei"
+msgstr[1] "%{count} Dateien"
+`
+
+func TestBuildDicts(t *testing.T) {
+	p, err := pofile.ParseText(contextCatalog)
+	assert.NoError(t, err)
+
+	flat, web := buildDicts(p)
+
+	// The flat catalog only carries entries without a context, whatever the
+	// order they appear in, and drops fuzzy ones.
+	assert.Equal(t, "维护模式", flat["Maintenance"])
+	assert.Equal(t, "保存更改", flat["Save"])
+	assert.Equal(t, "普通", flat["Plain"])
+	assert.NotContains(t, flat, "Fuzzy")
+
+	// A msgid with contexts becomes an object with "" for the plain entry,
+	// regardless of which entry came first.
+	assert.Equal(t, map[string]any{"": "维护模式", "preference group": "维护"}, web["Maintenance"])
+	assert.Equal(t, map[string]any{"": "保存更改", "action": "保存"}, web["Save"])
+
+	// Entries without a context stay plain strings.
+	assert.Equal(t, "普通", web["Plain"])
+	assert.NotContains(t, web, "Fuzzy")
+
+	// A single plural form stays a string, several forms become a list.
+	assert.Equal(t, "%{count} 项", web["%{count} item"])
+	assert.Equal(t, "%{count} 项", flat["%{count} item"])
+	assert.Equal(t, []string{"%{count} Datei", "%{count} Dateien"}, web["%{count} file"])
+	assert.Equal(t, []string{"%{count} Datei", "%{count} Dateien"}, flat["%{count} file"])
+}
+
+func TestBuildDictsContextOnly(t *testing.T) {
+	// Real catalogs always start with a header entry.
+	p, err := pofile.ParseText("msgid \"\"\nmsgstr \"\"\n\"Content-Type: text/plain; charset=UTF-8\\n\"\n\nmsgctxt \"menu\"\nmsgid \"Open\"\nmsgstr \"打开\"\n")
+	assert.NoError(t, err)
+
+	flat, web := buildDicts(p)
+
+	assert.NotContains(t, flat, "Open")
+	assert.Equal(t, map[string]any{"menu": "打开"}, web["Open"])
+}
```

---

### Incident Patch 4: `e796c3ea` (2026-09-29)
**Commit Message**: fix(https): check certificate SANs for existing certificates

The existing-certificate coverage preview read the record's `domains`,
which an imported certificate fills with the subject name only, so an
IP or alias listed in the SANs was reported as not covered. Compare
against the subject name and SANs from the certificate info instead,
match IP addresses only against IP SANs, and show every SAN as a tag.

Also let the HTTPS card fold to a one-line summary in the site editor.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

**File**: `app/src/views/site/site_edit/components/Cert/Cert.vue` (modified, +1/-0)
```diff
@@ -116,6 +116,7 @@ function handleCertChange(certs: Cert[]) {
       v-if="isSiteActive && isPendingTLS"
       class="mb-4"
       compact
+      collapsible
       :domains="serverDomains"
       @success="onHTTPSEnabled"
     />
```

**File**: `app/src/views/site/site_edit/components/HTTPS/EditorHTTPSCard.vue` (modified, +4/-0)
```diff
@@ -10,10 +10,13 @@ import { hasPendingTLSServer, hasUnsavedChanges, pendingTLSServersDiffer } from
 withDefaults(defineProps<{
   domains: string[]
   compact?: boolean
+  // Lets the user fold the card, see HTTPSCard.
+  collapsible?: boolean
   // Offers the card's "Existing certificate" method.
   existingCertificate?: boolean
 }>(), {
   compact: false,
+  collapsible: false,
   existingCertificate: true,
 })
 
@@ -97,6 +100,7 @@ defineExpose({
       :config-name="name"
       :domains
       :compact
+      :collapsible
       :has-pending-t-l-s-server="hasPendingTLSInFile"
       :disabled="isDirty"
       :skippable="false"
```

**File**: `app/src/views/site/site_edit/components/HTTPS/HTTPSCard.vue` (modified, +99/-7)
```diff
@@ -8,20 +8,21 @@ import {
   CheckCircleFilled,
   ClockCircleOutlined,
   CloseCircleFilled,
+  DownOutlined,
   ExclamationCircleFilled,
   LoadingOutlined,
   MinusCircleOutlined,
   PlusOutlined,
   SafetyCertificateOutlined,
 } from '@antdv-next/icons'
-import { breakpointsAntDesign, useBreakpoints } from '@vueuse/core'
+import { breakpointsAntDesign, useBreakpoints, useLocalStorage } from '@vueuse/core'
 import dayjs from 'dayjs'
 import DNSChallenge from '@/components/AutoCertForm/DNSChallenge.vue'
 import { PrivateKeyTypeEnum, PrivateKeyTypeList } from '@/constants'
 import { isIPAddress, splitCertificateIdentifiers } from '@/utils/certificate'
 import ACMEUserSelector from '@/views/certificate/components/ACMEUserSelector.vue'
 import CertificatePicker from '../Cert/CertificatePicker.vue'
-import { certificateCoverage, isCertificateExpired } from './certificateCoverage'
+import { certificateCoverage, certificateNamesOf, isCertificateExpired } from './certificateCoverage'
 import { buildHTTPSCheckRequest, buildHTTPSRequest, isChallengeMethod } from './httpsRequest'
 import { diagnosticsWithoutHint, HTTPS_MAIN_STEPS, isValidHostname, useHTTPSOnboarding } from './useHTTPSOnboarding'
 
@@ -45,13 +46,17 @@ const props = withDefaults(defineProps<{
   // Leaves the run and skip buttons to the caller (e.g. a wizard's Finish
   // button), which drives them through the exposed `confirm`.
   externalConfirm?: boolean
+  // Lets the user fold the card to its title and a one-line summary. The
+  // choice is remembered; a run or a finished check always shows the card.
+  collapsible?: boolean
 }>(), {
   hasPendingTLSServer: false,
   compact: false,
   disabled: false,
   skippable: true,
   existingCertificate: true,
   externalConfirm: false,
+  collapsible: false,
 })
 
 const emit = defineEmits<{
@@ -218,7 +223,21 @@ const certificateExpiry = computed(() => {
 })
 
 // A client-side preview; the backend reads the certificate file and decides.
-const coverage = computed(() => certificateCoverage(selectedCertificate.value?.domains, domainList.value))
+// The record's own `domains` is not enough: an imported certificate stores only
+// its subject name there, so the SANs come from the certificate file's info.
+const certificateNames = computed(() => certificateNamesOf(selectedCertificate.value))
+const coverage = computed(() => certificateCoverage(certificateNames.value, domainList.value))
+
+// A certificate with many SANs would fill the card with tags.
+const MAX_CERTIFICATE_TAGS = 6
+const certificateTagsExpanded = ref(false)
+const visibleCertificateNames = computed(() => certificateTagsExpanded.value
+  ? certificateNames.value
+  : certificateNames.value.slice(0, MAX_CERTIFICATE_TAGS))
+const hiddenCertificateNameCount = computed(() => certificateNames.value.length - visibleCertificateNames.value.length)
+watch(selectedCertificate, () => {
+  certificateTagsExpanded.value = false
+})
 
 const certificateProblem = computed<{ type: 'error' | 'warning' | 'info', title: string } | undefined>(() => {
   if (method.value !== 'existing' || !selectedCertificate.value)
@@ -255,6 +274,33 @@ const formLocked = computed(() => running.value || phase.value === 'success')
 
 const isExisting = computed(() => method.value === 'existing')
 
+// ---- Collapse -----------------------------------------------------------
+
+const collapsedPreference = useLocalStorage('nginx-ui-https-card-collapsed', false)
+
+// Once a check has run or the run has started the card has something to show.
+const collapsed = computed(() => props.collapsible
+  && collapsedPreference.value
+  && phase.value === 'idle'
+  && !checking.value
+  && !checks.value.length)
+
+const collapsedSummary = computed(() => {
+  const label = {
+    http01: $gettext('HTTP-01'),
+    dns01: $gettext('DNS-01'),
+    existing: $gettext('Existing certificate'),
+    skip: $gettext('Skip for now'),
+  }[method.value]
+
+  return [label, ...(method.value === 'skip' ? [] : domainList.
```

**File**: `app/src/views/site/site_edit/components/HTTPS/certificateCoverage.ts` (modified, +45/-1)
```diff
@@ -1,21 +1,65 @@
+import type { Cert } from '@/api/cert'
+import { isIPAddress } from '@/utils/certificate'
 import { toUnicodeDomain } from '@/utils/idnDomain'
 
 // Pure helpers for the "Existing certificate" method of the HTTPS card. They
 // only preview what the backend decides (it reads the SANs of the certificate
 // file); the UI uses them to warn before a run.
 
+/**
+ * Returns the canonical form of an IPv4/IPv6 literal (brackets allowed), or
+ * undefined when the value is not an IP address, so `[::1]`, `::1` and
+ * `0:0:0:0:0:0:0:1` compare equal.
+ */
+export function normalizeIPAddress(value: string): string | undefined {
+  const candidate = value.trim().replace(/^\[|\]$/g, '')
+  if (!isIPAddress(candidate))
+    return undefined
+
+  if (!candidate.includes(':'))
+    return candidate.split('.').map(part => String(Number(part))).join('.')
+
+  try {
+    return new URL(`http://[${candidate}]`).hostname.slice(1, -1)
+  }
+  catch {
+    return candidate.toLowerCase()
+  }
+}
+
 export function normalizeCertificateName(value: string): string {
   // Compare IDNs in one form: the record may hold punycode, the site Unicode.
   return toUnicodeDomain(value.trim().replace(/\.$/, '')).toLowerCase()
 }
 
 /**
- * Reports whether one certificate name covers one requested identifier. A
+ * Lists every name a certificate record is valid for: its subject name and
+ * SANs (DNS names and IP addresses) read from the certificate file, plus the
+ * record's own `domains`. The record alone is not enough: an imported
+ * certificate stores only its subject name there.
+ */
+export function certificateNamesOf(cert: Pick<Cert, 'domains' | 'certificate_info'> | undefined | null): string[] {
+  if (!cert)
+    return []
+
+  const info = cert.certificate_info
+  const names = [info?.subject_name, ...(info?.subject_alt_names ?? []), ...(cert.domains ?? [])]
+  return [...new Set(names.filter((name): name is string => !!name?.trim()).map(name => name.trim()))]
+}
+
+/**
+ * Reports whether one certificate name covers one requested identifier. An IP
+ * address is only covered by the same IP address (an IP SAN). A
  * wildcard `*.example.com` covers exactly one extra label (`a.example.com`),
  * neither `example.com` nor `a.b.example.com`. A requested wildcard is only
  * covered by the same wildcard.
  */
 export function certificateNameCovers(certificateName: string, identifier: string): boolean {
+  const nameIP = normalizeIPAddress(certificateName)
+  const targetIP = normalizeIPAddress(identifier)
+  if (nameIP || targetIP)
+    return nameIP !== undefined && nameIP === targetIP
+
   const name = normalizeCertificateName(certificateName)
   const target = normalizeCertificateName(identifier)
   if (!name || !target)
```

**File**: `app/src/views/site/site_edit/components/SiteEditor/SiteEditor.vue` (modified, +1/-0)
```diff
@@ -240,6 +240,7 @@ async function save() {
           <div v-if="showHTTPSOnboarding" ref="httpsCardWrapper" class="mb-4 px-6">
             <EditorHTTPSCard
               compact
+              collapsible
               :domains="siteDomains"
               @success="onHTTPSEnabled"
             />
```

---

### Incident Patch 5: `14038d2a` (2026-09-29)
**Commit Message**: fix(site): use "No." as the index column title

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

**File**: `app/src/views/site/site_list/columns.tsx` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ const columns: StdTableColumn[] = [{
   hiddenInTable: true,
   hiddenInDetail: true,
 }, {
-  title: () => $gettext('No'),
+  title: () => $gettext('No.'),
   dataIndex: 'index',
   sorter: true,
   pure: true,
```

---

### Incident Patch 6: `a8c52e1e` (2026-09-29)
**Commit Message**: fix ci build issue

**File**: `app/src/views/certificate/CertificateEditor.vue` (modified, +4/-3)
```diff
@@ -196,7 +196,7 @@ function localizeStructuredLevelValue(raw: string) {
 }
 
 function stripTimeKey(raw: string) {
-  return raw.replace(/^(time|时间|時間)=([^\s]+)/, '$2')
+  return raw.replace(/^(time|时间|時間)=(\S+)/, '$2')
 }
 
 function translateStructuredMessage(message: string) {
@@ -281,15 +281,16 @@ const log = computed(() => {
   if (!data.value.log)
     return ''
 
-  return data.value.log.split('\n').map(line => {
+  const lines = data.value.log.split('\n').map(line => {
     try {
       return renderLocalizedLogMessage(T(JSON.parse(line)))
     }
     catch {
       return renderLocalizedLogMessage(line)
     }
   }).map(line => line.startsWith('[Nginx UI]') ? `${line}\n` : line)
-    .join('\n')
+
+  return lines.join('\n')
 })
 
 function resolveHTMLElement(target: unknown): HTMLElement | null {
```

---

### Incident Patch 7: `f62368c5` (2026-09-29)
**Commit Message**: fix(Modify Certificate):log i18

**File**: `app/src/language/en.po` (modified, +56/-0)
```diff
@@ -601,6 +601,62 @@ msgstr ""
 msgid "SSL Certificate Key Path"
 msgstr ""
 
+#: src/views/certificate/CertificateEditor.vue:185
+msgid "domains"
+msgstr "domains"
+
+#: src/views/certificate/CertificateEditor.vue:186
+msgid "domain"
+msgstr "domain"
+
+#: src/views/certificate/CertificateEditor.vue:187
+msgid "type"
+msgstr "type"
+
+#: src/views/certificate/CertificateEditor.vue:188
+msgid "hoursRemaining"
+msgstr "hoursRemaining"
+
+#: src/views/certificate/CertificateEditor.vue:189
+msgid "timeout"
+msgstr "timeout"
+
+#: src/views/certificate/CertificateEditor.vue:190
+msgid "interval"
+msgstr "interval"
+
+#: src/views/certificate/CertificateEditor.vue:174
+msgid "Trying renewal."
+msgstr ""
+
+#: src/views/certificate/CertificateEditor.vue:175
+msgid "Obtaining bundled SAN certificate."
+msgstr ""
+
+#: src/views/certificate/CertificateEditor.vue:176
+msgid "Use solver."
+msgstr ""
+
+#: src/views/certificate/CertificateEditor.vue:177
+msgid "http01: Trying to solve HTTP-01."
+msgstr ""
+
+#: src/views/certificate/CertificateEditor.vue:178
+msgid "The server validated our request."
+msgstr ""
+
+#: src/views/certificate/CertificateEditor.vue:179
+msgid "Validations succeeded; requesting certificates."
+msgstr ""
+
+#: src/views/certificate/CertificateEditor.vue:180
+msgid "Waiting for certificates."
+msgstr ""
+
+#: src/views/certificate/CertificateEditor.vue:181
+msgid "Server responded with a certificate."
+msgstr ""
+
 #: src/components/ConfigHistory/ConfigHistory.vue:54
 msgid "Modified At"
 msgstr ""
```

**File**: `app/src/language/zh_CN.po` (modified, +56/-0)
```diff
@@ -601,6 +601,62 @@ msgstr "SSL 证书路径"
 msgid "SSL Certificate Key Path"
 msgstr "SSL 证书密钥路径"
 
+#: src/views/certificate/CertificateEditor.vue:185
+msgid "domains"
+msgstr "域名列表"
+
+#: src/views/certificate/CertificateEditor.vue:186
+msgid "domain"
+msgstr "域名"
+
+#: src/views/certificate/CertificateEditor.vue:187
+msgid "type"
+msgstr "类型"
+
+#: src/views/certificate/CertificateEditor.vue:188
+msgid "hoursRemaining"
+msgstr "剩余小时"
+
+#: src/views/certificate/CertificateEditor.vue:189
+msgid "timeout"
+msgstr "超时"
+
+#: src/views/certificate/CertificateEditor.vue:190
+msgid "interval"
+msgstr "间隔"
+
+#: src/views/certificate/CertificateEditor.vue:174
+msgid "Trying renewal."
+msgstr "正在尝试续签。"
+
+#: src/views/certificate/CertificateEditor.vue:175
+msgid "Obtaining bundled SAN certificate."
+msgstr "正在申请 SAN 证书。"
+
+#: src/views/certificate/CertificateEditor.vue:176
+msgid "Use solver."
+msgstr "正在使用求解器。"
+
+#: src/views/certificate/CertificateEditor.vue:177
+msgid "http01: Trying to solve HTTP-01."
+msgstr "http01：正在进行 HTTP-01 验证。"
+
+#: src/views/certificate/CertificateEditor.vue:178
+msgid "The server validated our request."
+msgstr "服务器已验证我们的请求。"
+
+#: src/views/certificate/CertificateEditor.vue:179
+msgid "Validations succeeded; requesting certificates."
+msgstr "验证成功，正在请求证书。"
+
+#: src/views/certificate/CertificateEditor.vue:180
+msgid "Waiting for certificates."
+msgstr "正在等待证书。"
+
+#: src/views/certificate/CertificateEditor.vue:181
+msgid "Server responded with a certificate."
+msgstr "服务器已返回证书。"
+
 #: src/components/ConfigHistory/ConfigHistory.vue:54
 msgid "Modified At"
 msgstr "修改时间"
```

**File**: `app/src/language/zh_TW.po` (modified, +56/-0)
```diff
@@ -496,6 +496,62 @@ msgstr "無內容可複製"
 msgid "{label} copied to clipboard"
 msgstr "{label} 已複製到剪貼簿"
 
+#: src/views/certificate/CertificateEditor.vue:185
+msgid "domains"
+msgstr "網域列表"
+
+#: src/views/certificate/CertificateEditor.vue:186
+msgid "domain"
+msgstr "網域"
+
+#: src/views/certificate/CertificateEditor.vue:187
+msgid "type"
+msgstr "類型"
+
+#: src/views/certificate/CertificateEditor.vue:188
+msgid "hoursRemaining"
+msgstr "剩餘小時"
+
+#: src/views/certificate/CertificateEditor.vue:189
+msgid "timeout"
+msgstr "逾時"
+
+#: src/views/certificate/CertificateEditor.vue:190
+msgid "interval"
+msgstr "間隔"
+
+#: src/views/certificate/CertificateEditor.vue:174
+msgid "Trying renewal."
+msgstr "正在嘗試續簽。"
+
+#: src/views/certificate/CertificateEditor.vue:175
+msgid "Obtaining bundled SAN certificate."
+msgstr "正在申請 SAN 憑證。"
+
+#: src/views/certificate/CertificateEditor.vue:176
+msgid "Use solver."
+msgstr "正在使用求解器。"
+
+#: src/views/certificate/CertificateEditor.vue:177
+msgid "http01: Trying to solve HTTP-01."
+msgstr "http01：正在進行 HTTP-01 驗證。"
+
+#: src/views/certificate/CertificateEditor.vue:178
+msgid "The server validated our request."
+msgstr "伺服器已驗證我們的請求。"
+
+#: src/views/certificate/CertificateEditor.vue:179
+msgid "Validations succeeded; requesting certificates."
+msgstr "驗證成功，正在請求憑證。"
+
+#: src/views/certificate/CertificateEditor.vue:180
+msgid "Waiting for certificates."
+msgstr "正在等待憑證。"
+
+#: src/views/certificate/CertificateEditor.vue:181
+msgid "Server responded with a certificate."
+msgstr "伺服器已回傳憑證。"
+
 #: src/components/CertInfo/CertInfo.vue:29
 #: src/components/SensitiveString/SensitiveInput.vue:72
 #: src/components/SensitiveString/SensitiveString.vue:77
```

**File**: `app/src/views/certificate/CertificateEditor.vue` (modified, +55/-34)
```diff
@@ -164,31 +164,29 @@ const logLevelLabels: Record<string, string> = {
   DEBUG: 'Debug',
 }
 
-const structuredLogKeys = [
-  'time',
-  'level',
-  'msg',
-  'domain',
-  'domains',
-  'type',
-  'timeout',
-  'interval',
-  'hoursRemaining',
+// Keep these literals in source so gettext extraction includes structured log
+// message keys that arrive dynamically from ACME libraries.
+const structuredLogMessageI18nHints = [
+  $gettext('Trying renewal.'),
+  $gettext('Obtaining bundled SAN certificate.'),
+  $gettext('Use solver.'),
+  $gettext('http01: Trying to solve HTTP-01.'),
+  $gettext('The server validated our request.'),
+  $gettext('Validations succeeded; requesting certificates.'),
+  $gettext('Waiting for certificates.'),
+  $gettext('Server responded with a certificate.'),
 ]
-
-function localizeStructuredFieldKeys(raw: string) {
-  let localized = raw
-  for (const key of structuredLogKeys) {
-    const translatedKey = $gettext(key)
-    if (translatedKey === key)
-      continue
-
-    const pattern = new RegExp(`(^|\\s)${key}=`, 'g')
-    localized = localized.replace(pattern, `$1${translatedKey}=`)
-  }
-
-  return localized
-}
+void structuredLogMessageI18nHints
+
+const structuredLogFieldI18nHints = [
+  $gettext('domains'),
+  $gettext('domain'),
+  $gettext('type'),
+  $gettext('hoursRemaining'),
+  $gettext('timeout'),
+  $gettext('interval'),
+]
+void structuredLogFieldI18nHints
 
 function localizeStructuredLevelValue(raw: string) {
   return raw.replace(/(^|\s)(level|等级|層級)=([A-Z]+)/g, (_, prefix: string, key: string, level: string) => {
@@ -197,23 +195,38 @@ function localizeStructuredLevelValue(raw: string) {
   })
 }
 
+function stripTimeKey(raw: string) {
+  return raw.replace(/^(time|时间|時間)=([^\s]+)/, '$2')
+}
+
+function translateStructuredMessage(message: string) {
+  return $gettext(message)
+}
+
 function applyKeywordLineBreaks(raw: string) {
-  return raw.replace(/\s+(消息|msg|訊息|域名列表|domains|網域列表|域名|domain|網域)=/g, '\n$1=')
+  return raw.replace(/\s+(消息|msg|訊息|域名列表|domains|網域列表|域名|domain|網域|type|timeout|interval|hoursRemaining)=/g, '\n$1=')
 }
 
-function applyDomainListValueLineBreaks(raw: string) {
-  return raw.replace(/(域名列表|domains|網域列表)=("([^"]*)"|(\S+))/g, (_, key: string, full: string, quoted: string | undefined, plain: string | undefined) => {
+function applyAuxiliaryFieldFormatting(raw: string) {
+  let localized = raw.replace(/^(domain|type|hoursRemaining|timeout|interval)=([^\n]*)$/gm, (_, key: string, value: string) => {
+    return `${$gettext(key)}:${value}`
+  })
+
+  localized = localized.replace(/(domains)=("([^"]*)"|(\S+))/g, (_, key: string, full: string, quoted: string | undefined, plain: string | undefined) => {
     const value = (quoted ?? plain ?? '').trim()
     const domains = value
       .split(/[\s,，;；]+/)
       .map(item => item.trim())
       .filter(Boolean)
+    const label = $gettext(key)
 
     if (domains.length <= 1)
-      return `${key}：${full}`
+      return `${label}:${full}`
 
-    return `${key}：\n${domains.map(domain => `- ${domain}`).join('\n')}`
+    return `${label}:\n${domains.map(domain => `- ${domain}`).join('\n')}`
   })
+
+  return localized
 }
 
 function applyNginxUILineBreaks(raw: string) {
@@ -224,20 +237,26 @@ function applyNginxUILineBreaks(raw: string) {
     .replace(/,\s*CA Dir:/g, '\nCA Dir:')
 }
 
+function stripMessageWrapper(raw: string) {
+  return raw
+    .replace(/^(msg|消息|訊息)="([^"]*)"$/gm, '$2')
+    .replace(/^(msg|消息|訊息)=(.+)$/gm, '$2')
+}
+
 function localizeStructuredLogLine(raw: string) {
   const translatedWhole = $gettext(raw)
   if (translatedWhole !== raw)
     return translatedWhole
 
-  let localized = localizeStructuredFieldKeys(raw)
-  localized = localizeStructuredLevelValue(localized)
+  let localized = localizeStructuredLevelValue(raw)
+  localized = stripTimeKey(localized)
 
   const match = raw.match(/msg="([^"]+)"/)
   if (!match)
     return localized
 
   const originalMessage = match[1]
-  const trans
```

---

### Incident Patch 8: `65c83f2e` (2026-09-29)
**Commit Message**: Merge pull request #1980 from EFX1SZH/fix(UI)

**File**: `app/src/views/upstream/UpstreamList.vue` (modified, +4/-3)
```diff
@@ -64,9 +64,9 @@ const columns = computed<TableColumnsType<ManagedUpstreamDetail>>(() => isNarrow
 const externalColumns = computed<TableColumnsType<ExternalUpstream>>(() => isNarrow.value
   ? [compactColumn]
   : [
-      { title: () => $gettext('Name'), key: 'name', width: 160 },
-      { title: () => $gettext('Servers'), key: 'servers' },
-      { title: () => $gettext('Defined In'), key: 'source', width: 260 },
+      { title: () => $gettext('Name'), key: 'name', width: '33.33%' },
+      { title: () => $gettext('Servers'), key: 'servers', width: '33.33%' },
+      { title: () => $gettext('Defined In'), key: 'source', width: '33.34%' },
     ])
 
 // Cell fragments shared by the full and the compact layout.
@@ -559,6 +559,7 @@ function confirmDelete(record: ManagedUpstreamDetail) {
         {{ $gettext('These upstream blocks live inside site or other configuration files. Edit their settings in their own file; servers can be switched on and off here. A block inside a site can be converted to a shared group that other sites can use too.') }}
       </p>
       <ATable
+        table-layout="fixed"
         :columns="externalColumns"
         :data-source="filteredExternal"
         :pagination="false"
```

---

### Incident Patch 9: `44da886b` (2026-09-29)
**Commit Message**: fix(errdef): stop the generator from picking up a test-only cert error

The errdef generator scans _test.go files, so a test that built its own
cert scope with a literal NewWithParams(50058, ...) produced a duplicate
key in the generated cert.ts and broke the frontend typecheck. Build the
error with the real cert constructor instead and regenerate cert.ts.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>

**File**: `api/certificate/issue_error_test.go` (modified, +2/-4)
```diff
@@ -7,15 +7,13 @@ import (
 	"testing"
 
 	"github.com/0xJacky/Nginx-UI/internal/acmehint"
+	"github.com/0xJacky/Nginx-UI/internal/cert"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
-	"github.com/uozi-tech/cosy"
 )
 
-var testCertErrScope = cosy.NewErrorScope("cert")
-
 func TestIssueErrorResponseCarriesWrappedCosyError(t *testing.T) {
-	cErr := testCertErrScope.NewWithParams(50058, "HTTP-01 challenge route check failed for {0}: {1}", "example.com", "unexpected status 404")
+	cErr := cert.NewHTTP01ChallengeRouteCheckError("example.com", "unexpected status 404")
 	err := fmt.Errorf("issue certificate: %w", cErr)
 	hint := &acmehint.Hint{Code: acmehint.CodePort80Unreachable, Message: "m"}
 
```

**File**: `app/src/constants/errors/cert.ts` (modified, +0/-1)
```diff
@@ -1,5 +1,4 @@
 export default {
-  50058: () => $gettext('HTTP-01 challenge route check failed for {0}: {1}'),
   50001: () => $gettext('Filename is empty'),
   50002: () => $gettext('Cert path is not under the nginx conf dir'),
   50003: () => $gettext('Certificate decode error'),
```

---

### Incident Patch 10: `db46a603` (2026-09-29)
**Commit Message**: fix(node-switcher): use a layout-columns icon for the split view button

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `app/src/components/NodeSwitcher/NodeSwitcher.vue` (modified, +3/-3)
```diff
@@ -2,7 +2,7 @@
 import type { AnalyticNode } from '@/api/node'
 import type { NodeSwitchTarget } from '@/composables/useNodeSwitch'
 import type { NodeSwitchBlocker } from '@/lib/node/switch'
-import { SettingOutlined, SplitCellsOutlined } from '@antdv-next/icons'
+import { SettingOutlined } from '@antdv-next/icons'
 import { storeToRefs } from 'pinia'
 import nodeApi from '@/api/node'
 import { useNodeSwitch } from '@/composables/useNodeSwitch'
@@ -164,7 +164,7 @@ function pickFirstMatch() {
               :aria-label="$gettext('Open in split view')"
               @click="openSplit(0)"
             >
-              <SplitCellsOutlined />
+              <span class="i-tabler-layout-columns text-base" />
             </button>
           </div>
 
@@ -211,7 +211,7 @@ function pickFirstMatch() {
                 :aria-label="$gettext('Open in split view')"
                 @click="openSplit(option.node.id)"
               >
-                <SplitCellsOutlined />
+                <span class="i-tabler-layout-columns text-base" />
               </button>
             </div>
           </ATooltip>
```

#### Recent Merged Pull Requests:
- **PR #1983** (2026-09-29): feat(preference): rebuild the preference page as a settings center (@Hintay)
- **PR #1982** (2026-09-29): chore(i18n): keep gettext catalogs free of locations and fuzzy entries (@Hintay)
- **PR #1981** (2026-09-29): Optimize(layout) (@EFX1SZH)
- **PR #1980** (2026-09-29): Optimize the layout (@EFX1SZH)
- **PR #1978** (2026-09-28): Plumber score & badge (@SaboniAmine)
- **PR #1977** (2026-09-28): ci: bump musl-cross-compilers to the download retry fix (@0xJacky)
- **PR #1976** (2026-09-28): ci: retry network-bound steps that flake (@0xJacky)
- **PR #1975** (2026-09-28): fix(upstream): key managed group health by resolved socket (@0xJacky)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
