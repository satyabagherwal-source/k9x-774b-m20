# Forensic Learning Record (Deep Inspection): AgentsMesh/AgentsMesh

> **Canonical Artifact**: `07_PROJECT_LEARNING/agentsmesh-agentsmesh-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/AgentsMesh/AgentsMesh](https://github.com/AgentsMesh/AgentsMesh))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:09:16.317Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `AgentsMesh/AgentsMesh`
- **Description**: The AI Agent Workforce Platform. Run a hundred AI coding agents across your own machines — schedule, isolate, and steer them all from one console.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md
- **Stars / Engagement**: 2361 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/cmd/server/eventbus_loop.go`
```
package main

import (
	"context"
	"log/slog"
	"time"

	"google.golang.org/protobuf/encoding/protojson"

	"github.com/anthropics/agentsmesh/backend/internal/domain/agentpod"
	"github.com/anthropics/agentsmesh/backend/internal/infra/eventbus"
	"github.com/anthropics/agentsmesh/backend/internal/service/instance"
	loop "github.com/anthropics/agentsmesh/backend/internal/service/loop"
	eventsv1 "github.com/anthropics/agentsmesh/proto/gen/go/events/v1"
)

func setupLoopEventSubscriptions(eventBus *eventbus.EventBus, loopOrchestrator *loop.LoopOrchestrator) {
	eventBus.Subscribe(eventbus.EventPodTerminated, func(event *eventbus.Event) {
		var data eventsv1.PodStatusChangedEventData
		if err := protojson.Unmarshal(event.Data, &data); err != nil {
			slog.Error("failed to unmarshal pod terminated event for loop", "error", err)
			return
		}

		now := time.Now()
		loopOrchestrator.HandlePodTerminated(context.Background(), data.PodKey, data.Status, &now)
	})

	eventBus.Subscribe(eventbus.EventPodStatusChanged, func(event *eventbus.Event) {
		var data eventsv1.PodStatusChangedEventData
		if err := protojson.Unmarshal(event.Data, &data); err != nil {
			return
		}

		switch data.Status {
		case agentpod.StatusCompleted, agentpod.StatusError:
			now := time.Now()
			loopOrchestrator.HandlePodTerminated(context.Background(), data.PodKey, data.Status, &now)
		}
	})

	// Autopilot status changed → detect terminal phases and handle completion.
	// Single path for Autopilot termination detection:
	//   Runner gRPC → PodCoordinator → onAutopilotStatusChange callback → EventAutopilotStatusChanged
	eventBus.Subscribe(eventbus.EventAutopilotStatusChanged, func(event *eventbus.Event) {
		var data eventsv1.AutopilotStatusChangedEventData
		if err := protojson.Unmarshal(event.Data, &data); err != nil {
			return
		}

		switch data.Phase {
		case agentpod.AutopilotPhaseCompleted, agentpod.AutopilotPhaseFailed, agentpod.AutopilotPhaseStopped:
			loopOrchestrator.HandleAutopilotTerminated(context.Background(), data.AutopilotControllerKey, data.Phase)
		}
	})

	slog.Info("Loop event subscriptions registered")
}

func setupOrgAwarenessRefresh(eventBus *eventbus.EventBus, orgAwareness *instance.OrgAwarenessService) {
	eventBus.Subscribe(eventbus.EventRunnerOnline, func(event *eventbus.Event) {
		orgAwareness.Refresh()
	})

	eventBus.Subscribe(eventbus.EventRunnerOffline, func(event *eventbus.Event) {
		orgAwareness.Refresh()
	})

	slog.Info("OrgAwareness runner event subscriptions registered")
}

```

### Core Architecture Module: `backend/internal/api/connect/binding/binding_lifecycle.go`
```
package bindingconnect

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	"github.com/anthropics/agentsmesh/backend/internal/api/connect/interceptors"
	bindingv1 "github.com/anthropics/agentsmesh/proto/gen/go/binding/v1"
)

// Mutating RPCs that change binding lifecycle state: RequestBinding,
// AcceptBinding, RejectBinding, Unbind. RequestScopes / ApproveScopes
// live in binding_scopes.go to keep file size under the 200-line ceiling.

func (s *Server) RequestBinding(
	ctx context.Context, req *connect.Request[bindingv1.RequestBindingRequest],
) (*connect.Response[bindingv1.PodBinding], error) {
	ctx, org, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	if req.Msg.GetInitiatorPod() == "" {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("initiator_pod is required"),
		)
	}
	if req.Msg.GetTargetPod() == "" {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("target_pod is required"),
		)
	}
	if len(req.Msg.GetScopes()) == 0 {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("scopes is required"),
		)
	}

	binding, err := s.bindingSvc.RequestBinding(
		ctx,
		org.GetID(),
		req.Msg.GetInitiatorPod(),
		req.Msg.GetTargetPod(),
		req.Msg.GetScopes(),
		req.Msg.GetPolicy(),
	)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return connect.NewResponse(ToProtoPodBinding(binding)), nil
}

func (s *Server) AcceptBinding(
	ctx context.Context, req *connect.Request[bindingv1.AcceptBindingRequest],
) (*connect.Response[bindingv1.PodBinding], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	if req.Msg.GetInitiatorPod() == "" {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("initiator_pod is required"),
		)
	}
	if req.Msg.GetBindingId() == 0 {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("binding_id is required"),
		)
	}

	binding, err := s.bindingSvc.AcceptBinding(
		ctx, req.Msg.GetBindingId(), req.Msg.GetInitiatorPod(),
	)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return connect.NewResponse(ToProtoPodBinding(binding)), nil
}

func (s *Server) RejectBinding(
	ctx context.Context, req *connect.Request[bindingv1.RejectBindingRequest],
) (*connect.Response[bindingv1.PodBinding], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	if req.Msg.GetInitiatorPod() == "" {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("initiator_pod is required"),
		)
	}
	if req.Msg.GetBindingId() == 0 {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("binding_id is required"),
		)
	}

	binding, err := s.bindingSvc.RejectBinding(
		ctx, req.Msg.GetBindingId(), req.Msg.GetInitiatorPod(), req.Msg.GetReason(),
	)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return connect.NewResponse(ToProtoPodBinding(binding)), nil
}

func (s *Server) Unbind(
	ctx context.Context, req *connect.Request[bindingv1.UnbindRequest],
) (*connect.Response[bindingv1.UnbindResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	if req.Msg.GetInitiatorPod() == "" {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("initiator_pod is required"),
		)
	}
	if req.Msg.GetTargetPod() == "" {
		return nil, connect.NewError(
			connect.CodeInvalidArgument,
			errors.New("target_pod is required"),
		)
	}

	removed, err := s.bindingSvc.Unbind(
		ctx, req.Msg.GetInitiatorPod(), req.Msg.GetTargetPod(),
	)
	if err != nil {
		return nil, mapServiceError(err)
	}
	// REST returned 404 when no active binding existed; Connect surfaces
	// that as `removed = false` so the caller can distinguish "successfully
	// removed" from "nothing to remove" without exception-string parsing.
	return connect.NewResponse(&bindingv1.UnbindResponse{Removed: removed}), nil
}

```

### Core Architecture Module: `backend/internal/api/connect/channel/readstate_handlers.go`
```
package channelconnect

import (
	"context"
	"strconv"

	"connectrpc.com/connect"

	"github.com/anthropics/agentsmesh/backend/internal/api/connect/interceptors"
	"github.com/anthropics/agentsmesh/backend/internal/middleware"
	channelv1 "github.com/anthropics/agentsmesh/proto/gen/go/channel/v1"
)

func (s *Server) MarkChannelRead(
	ctx context.Context, req *connect.Request[channelv1.MarkChannelReadRequest],
) (*connect.Response[channelv1.MarkChannelReadResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	ch, err := s.requireChannelAccess(ctx, req.Msg.GetChannelId())
	if err != nil {
		return nil, err
	}
	tenant := middleware.GetTenant(ctx)
	if err := s.channelSvc.MarkRead(ctx, ch.ID, tenant.UserID, req.Msg.GetMessageId()); err != nil {
		return nil, mapServiceError(err)
	}
	return connect.NewResponse(&channelv1.MarkChannelReadResponse{Status: "ok"}), nil
}

// GetChannelUnreadCounts is org-scoped at request-level but reads unread
// counts across all channels the caller is a member of in any org.
func (s *Server) GetChannelUnreadCounts(
	ctx context.Context, req *connect.Request[channelv1.GetChannelUnreadCountsRequest],
) (*connect.Response[channelv1.GetChannelUnreadCountsResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	tenant := middleware.GetTenant(ctx)
	summaries, err := s.channelSvc.GetChannelSummaries(ctx, tenant.UserID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	unread := make(map[string]int64, len(summaries))
	mentions := make(map[string]int64)
	lastRead := make(map[string]int64)
	manuallyUnread := make(map[string]bool)
	for cid, sum := range summaries {
		key := strconv.FormatInt(cid, 10)
		if sum.Unread > 0 {
			unread[key] = sum.Unread
			lastRead[key] = sum.LastRead
		}
		if sum.Mention > 0 {
			mentions[key] = sum.Mention
		}
		if sum.ManuallyUnread {
			manuallyUnread[key] = true
		}
	}
	return connect.NewResponse(&channelv1.GetChannelUnreadCountsResponse{
		Unread:         unread,
		Mentions:       mentions,
		LastRead:       lastRead,
		ManuallyUnread: manuallyUnread,
	}), nil
}

func (s *Server) MarkChannelUnread(
	ctx context.Context, req *connect.Request[channelv1.MarkChannelUnreadRequest],
) (*connect.Response[channelv1.MarkChannelUnreadResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	ch, err := s.requireChannelAccess(ctx, req.Msg.GetChannelId())
	if err != nil {
		return nil, err
	}
	tenant := middleware.GetTenant(ctx)
	if err := s.channelSvc.SetManuallyUnread(ctx, ch.ID, tenant.UserID); err != nil {
		return nil, mapServiceError(err)
	}
	return connect.NewResponse(&channelv1.MarkChannelUnreadResponse{Status: "ok"}), nil
}

func (s *Server) GetMessageReadBy(
	ctx context.Context, req *connect.Request[channelv1.GetMessageReadByRequest],
) (*connect.Response[channelv1.GetMessageReadByResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	ch, err := s.requireChannelAccess(ctx, req.Msg.GetChannelId())
	if err != nil {
		return nil, err
	}
	tenant := middleware.GetTenant(ctx)
	ids, err := s.channelSvc.GetMessageReadBy(ctx, ch.ID, req.Msg.GetMessageId(), tenant.UserID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	// "Read by" lists who *else* read it — drop the requester (message author).
	readBy := make([]int64, 0, len(ids))
	for _, id := range ids {
		if id != tenant.UserID {
			readBy = append(readBy, id)
		}
	}
	return connect.NewResponse(&channelv1.GetMessageReadByResponse{UserIds: readBy}), nil
}

func (s *Server) MuteChannel(
	ctx context.Context, req *connect.Request[channelv1.MuteChannelRequest],
) (*connect.Response[channelv1.MuteChannelResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	ch, err := s.requireChannelAccess(ctx, req.Msg.GetId())
	if err != nil {
		return nil, err
	}
	tenant := middleware.GetTenant(ctx)
	if err := s.channelSvc.SetMemberMuted(ctx, ch.ID, tenant.UserID, req.Msg.GetMuted()); err != nil {
		return nil, mapServiceError(err)
	}
	return connect.NewResponse(&channelv1.MuteChannelResponse{Status: "ok"}), nil
}

func (s *Server) PinChannel(
	ctx context.Context, req *connect.Request[channelv1.PinChannelRequest],
) (*connect.Response[channelv1.PinChannelResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	ch, err := s.requireChannelAccess(ctx, req.Msg.GetId())
	if err != nil {
		return nil, err
	}
	tenant := middleware.GetTenant(ctx)
	if err := s.channelSvc.SetMemberPinned(ctx, ch.ID, tenant.UserID, req.Msg.GetPinned()); err != nil {
		return nil, mapServiceError(err)
	}
	return connect.NewResponse(&channelv1.PinChannelResponse{Status: "ok"}), nil
}

```

### Core Architecture Module: `backend/internal/api/connect/loop/loop.go`
```
// Package loopconnect hosts Connect-RPC handlers for the loop service.
// Mirrors backend/internal/api/rest/v1/loop_handler*.go.
//
// Split rationale (200-line rule):
//   - loop.go              — server scaffolding + Mount + queries (List/Get/Delete)
//   - loop_crud.go         — Create + Update (heaviest field mapping)
//   - loop_actions.go      — Enable/Disable/Trigger
//   - loop_runs.go         — ListRuns + CancelRun
//   - loop_convert.go      — domain ↔ proto translation
package loopconnect

import (
	"context"
	"errors"
	"net/http"

	"connectrpc.com/connect"

	"github.com/anthropics/agentsmesh/backend/internal/api/connect/interceptors"
	loopDomain "github.com/anthropics/agentsmesh/backend/internal/domain/loop"
	"github.com/anthropics/agentsmesh/backend/internal/middleware"
	loopsvc "github.com/anthropics/agentsmesh/backend/internal/service/loop"
	loopv1 "github.com/anthropics/agentsmesh/proto/gen/go/loop/v1"
)

const ServiceName = "proto.loop.v1.LoopService"

const (
	ListLoopsProcedure   = "/" + ServiceName + "/ListLoops"
	GetLoopProcedure     = "/" + ServiceName + "/GetLoop"
	CreateLoopProcedure  = "/" + ServiceName + "/CreateLoop"
	UpdateLoopProcedure  = "/" + ServiceName + "/UpdateLoop"
	DeleteLoopProcedure  = "/" + ServiceName + "/DeleteLoop"
	EnableLoopProcedure  = "/" + ServiceName + "/EnableLoop"
	DisableLoopProcedure = "/" + ServiceName + "/DisableLoop"
	TriggerLoopProcedure = "/" + ServiceName + "/TriggerLoop"
	ListRunsProcedure    = "/" + ServiceName + "/ListRuns"
	CancelRunProcedure   = "/" + ServiceName + "/CancelRun"
)

// LoopServiceInterface mirrors REST LoopHandler's loopService dependency.
type LoopServiceInterface interface {
	List(ctx context.Context, filter *loopsvc.ListLoopsFilter) ([]*loopDomain.Loop, int64, error)
	GetBySlug(ctx context.Context, orgID int64, slug string) (*loopDomain.Loop, error)
	Create(ctx context.Context, req *loopsvc.CreateLoopRequest) (*loopDomain.Loop, error)
	Update(ctx context.Context, orgID int64, slug string, req *loopsvc.UpdateLoopRequest) (*loopDomain.Loop, error)
	Delete(ctx context.Context, orgID int64, slug string) error
	SetStatus(ctx context.Context, orgID int64, slug string, status string) (*loopDomain.Loop, error)
}

// PodTerminatorForLoop mirrors v1.PodTerminatorForLoop (ISP — only TerminatePod).
type PodTerminatorForLoop interface {
	TerminatePod(ctx context.Context, podKey string) error
}

type Server struct {
	svc           LoopServiceInterface
	runSvc        LoopRunServiceInterface
	orchestrator  LoopOrchestratorInterface
	orgSvc        middleware.OrganizationService
	podTerminator PodTerminatorForLoop
}

func NewServer(
	svc LoopServiceInterface,
	runSvc LoopRunServiceInterface,
	orchestrator LoopOrchestratorInterface,
	orgSvc middleware.OrganizationService,
	podTerminator PodTerminatorForLoop,
) *Server {
	return &Server{
		svc:           svc,
		runSvc:        runSvc,
		orchestrator:  orchestrator,
		orgSvc:        orgSvc,
		podTerminator: podTerminator,
	}
}

func Mount(mux *http.ServeMux, srv *Server, opts ...connect.HandlerOption) {
	mux.Handle(ListLoopsProcedure, connect.NewUnaryHandler(ListLoopsProcedure, srv.ListLoops, opts...))
	mux.Handle(GetLoopProcedure, connect.NewUnaryHandler(GetLoopProcedure, srv.GetLoop, opts...))
	mux.Handle(CreateLoopProcedure, connect.NewUnaryHandler(CreateLoopProcedure, srv.CreateLoop, opts...))
	mux.Handle(UpdateLoopProcedure, connect.NewUnaryHandler(UpdateLoopProcedure, srv.UpdateLoop, opts...))
	mux.Handle(DeleteLoopProcedure, connect.NewUnaryHandler(DeleteLoopProcedure, srv.DeleteLoop, opts...))
	mux.Handle(EnableLoopProcedure, connect.NewUnaryHandler(EnableLoopProcedure, srv.EnableLoop, opts...))
	mux.Handle(DisableLoopProcedure, connect.NewUnaryHandler(DisableLoopProcedure, srv.DisableLoop, opts...))
	mux.Handle(TriggerLoopProcedure, connect.NewUnaryHandler(TriggerLoopProcedure, srv.TriggerLoop, opts...))
	mux.Handle(ListRunsProcedure, connect.NewUnaryHandler(ListRunsProcedure, srv.ListRuns, opts...))
	mux.Handle(CancelRunProcedure, connect.NewUnaryHandler(CancelRunProcedure, srv.CancelRun, opts...))
}

// ListLoops — REST analogue: GET /loops.
func (s *Server) ListLoops(
	ctx context.Context, req *connect.Request[loopv1.ListLoopsRequest],
) (*connect.Response[loopv1.ListLoopsResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	if s.svc == nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("loop service not configured"))
	}
	tenant := middleware.GetTenant(ctx)

	limit := int(req.Msg.GetLimit())
	if limit == 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	offset := int(req.Msg.GetOffset())
	if offset < 0 {
		offset = 0
	}

	var cronEnabled *bool
	if req.Msg.CronEnabled != nil {
		v := req.Msg.GetCronEnabled()
		cronEnabled = &v
	}

	loops, total, err := s.svc.List(ctx, &loopsvc.ListLoopsFilter{
		OrganizationID: tenant.OrganizationID,
		Status:         req.Msg.GetStatus(),
		ExecutionMode:  req.Msg.GetExecutionMode(),
		CronEnabled:    cronEnabled,
		Query:          req.Msg.GetQuery(),
		Limit:          limit,
		Offset:         offset,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	if s.runSvc != nil && len(loops) > 0 {
		ids := make([]int64, len(loops))
		for i, l := range loops {
			ids[i] = l.ID
		}
		if counts, err := s.runSvc.CountActiveRunsByLoopIDs(ctx, ids); err == nil {
			for _, l := range loops {
				if c, ok := counts[l.ID]; ok {
					l.ActiveRunCount = int(c)
				}
			}
		}
	}

	items := make([]*loopv1.Loop, 0, len(loops))
	for _, l := range loops {
		items = append(items, toProtoLoop(l))
	}
	return connect.NewResponse(&loopv1.ListLoopsResponse{
		Items:  items,
		Total:  total,
		Limit:  int32(limit),
		Offset: int32(req.Msg.GetOffset()),
	}), nil
}

// GetLoop — REST analogue: GET /loops/:slug.
func (s *Server) GetLoop(
	ctx context.Context, req *connect.Request[loopv1.GetLoopRequest],
) (*connect.Response[loopv1.Loop], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	if s.svc == nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("loop service not configured"))
	}
	if req.Msg.GetLoopSlug() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("loop_slug is required"))
	}
	tenant := middleware.GetTenant(ctx)
	loop, err := s.svc.GetBySlug(ctx, tenant.OrganizationID, req.Msg.GetLoopSlug())
	if err != nil {
		if errors.Is(err, loopsvc.ErrLoopNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("loop not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if s.runSvc != nil {
		if counts, err := s.runSvc.CountActiveRunsByLoopIDs(ctx, []int64{loop.ID}); err == nil {
			if c, ok := counts[loop.ID]; ok {
				loop.ActiveRunCount = int(c)
			}
		}
		if avg, err := s.runSvc.GetAvgDuration(ctx, loop.ID); err == nil && avg != nil {
			loop.AvgDurationSec = avg
		}
	}
	return connect.NewResponse(toProtoLoop(loop)), nil
}

// DeleteLoop — REST analogue: DELETE /loops/:slug.
func (s *Server) DeleteLoop(
	ctx context.Context, req *connect.Request[loopv1.DeleteLoopRequest],
) (*connect.Response[loopv1.DeleteLoopResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	if s.svc == nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("loop service not configured"))
	}
	if req.Msg.GetLoopSlug() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("loop_slug is required"))
	}
	tenant := middleware.GetTenant(ctx)
	if err := s.svc.Delete(ctx, tenant.OrganizationID, req.Msg.GetLoopSlug()); err != nil {
		switch {
		case errors.Is(err, loopsvc.ErrLoopNotFound):
			return nil, connect.NewError(connect.CodeNotFound, errors.New("loop not found"))
		case errors.Is(err, loopsvc.ErrHasActiveRuns):
			return nil, connect.NewError(connect.CodeFailedPrecondition,
				errors.New("loop has active runs; cancel or wait first"))
		default:
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}
	return connect.NewResponse(&loopv1.DeleteLoopResponse{Message: "Loop deleted"}), nil
}

```

### Core Architecture Module: `backend/internal/api/connect/loop/loop_actions.go`
```
package loopconnect

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"connectrpc.com/connect"

	"github.com/anthropics/agentsmesh/backend/internal/api/connect/interceptors"
	loopDomain "github.com/anthropics/agentsmesh/backend/internal/domain/loop"
	"github.com/anthropics/agentsmesh/backend/internal/middleware"
	loopsvc "github.com/anthropics/agentsmesh/backend/internal/service/loop"
	loopv1 "github.com/anthropics/agentsmesh/proto/gen/go/loop/v1"
)

// LoopOrchestratorInterface mirrors REST LoopHandler's orchestrator dependency.
type LoopOrchestratorInterface interface {
	TriggerRun(ctx context.Context, req *loopsvc.TriggerRunRequest) (*loopsvc.TriggerRunResult, error)
	StartRun(ctx context.Context, loop *loopDomain.Loop, run *loopDomain.LoopRun, userID int64)
	MarkRunCancelled(ctx context.Context, runID int64, reason string) error
}

// EnableLoop — REST analogue: POST /loops/:slug/enable.
func (s *Server) EnableLoop(
	ctx context.Context, req *connect.Request[loopv1.LoopActionRequest],
) (*connect.Response[loopv1.Loop], error) {
	return s.setStatus(ctx, req.Msg, loopDomain.StatusEnabled)
}

// DisableLoop — REST analogue: POST /loops/:slug/disable.
func (s *Server) DisableLoop(
	ctx context.Context, req *connect.Request[loopv1.LoopActionRequest],
) (*connect.Response[loopv1.Loop], error) {
	return s.setStatus(ctx, req.Msg, loopDomain.StatusDisabled)
}

func (s *Server) setStatus(
	ctx context.Context, m *loopv1.LoopActionRequest, status string,
) (*connect.Response[loopv1.Loop], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, m, s.orgSvc)
	if err != nil {
		return nil, err
	}
	if s.svc == nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("loop service not configured"))
	}
	if m.GetLoopSlug() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("loop_slug is required"))
	}
	tenant := middleware.GetTenant(ctx)
	loop, err := s.svc.SetStatus(ctx, tenant.OrganizationID, m.GetLoopSlug(), status)
	if err != nil {
		if errors.Is(err, loopsvc.ErrLoopNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("loop not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(toProtoLoop(loop)), nil
}

// TriggerLoop — REST analogue: POST /loops/:slug/trigger.
func (s *Server) TriggerLoop(
	ctx context.Context, req *connect.Request[loopv1.TriggerLoopRequest],
) (*connect.Response[loopv1.TriggerLoopResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	if s.svc == nil || s.orchestrator == nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("loop services not configured"))
	}
	if req.Msg.GetLoopSlug() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("loop_slug is required"))
	}
	tenant := middleware.GetTenant(ctx)
	loop, err := s.svc.GetBySlug(ctx, tenant.OrganizationID, req.Msg.GetLoopSlug())
	if err != nil {
		if errors.Is(err, loopsvc.ErrLoopNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("loop not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	var variables json.RawMessage
	if v := req.Msg.GetVariablesJson(); v != "" {
		variables = json.RawMessage(v)
	}
	result, err := s.orchestrator.TriggerRun(ctx, &loopsvc.TriggerRunRequest{
		LoopID:        loop.ID,
		TriggerType:   loopDomain.RunTriggerManual,
		TriggerSource: "user:" + strconv.FormatInt(tenant.UserID, 10),
		TriggerParams: variables,
	})
	if err != nil {
		if errors.Is(err, loopsvc.ErrLoopDisabled) {
			return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("loop is disabled"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	if result.Skipped {
		return connect.NewResponse(&loopv1.TriggerLoopResponse{
			Run:     toProtoLoopRun(result.Run),
			Skipped: true,
			Reason:  result.Reason,
		}), nil
	}

	startCtx, startCancel := context.WithTimeout(context.Background(), 5*time.Minute)
	go func() {
		defer startCancel()
		s.orchestrator.StartRun(startCtx, result.Loop, result.Run, tenant.UserID)
	}()

	return connect.NewResponse(&loopv1.TriggerLoopResponse{
		Run:     toProtoLoopRun(result.Run),
		Skipped: false,
	}), nil
}

```

### Core Architecture Module: `backend/internal/api/connect/loop/loop_convert.go`
```
package loopconnect

import (
	"time"

	loopDomain "github.com/anthropics/agentsmesh/backend/internal/domain/loop"
	"github.com/anthropics/agentsmesh/backend/pkg/protoconv"
	loopv1 "github.com/anthropics/agentsmesh/proto/gen/go/loop/v1"
)

func optStrPtr(p *string) *string {
	if p == nil || *p == "" {
		return nil
	}
	v := *p
	return &v
}

func optTimePtr(t *time.Time) *string {
	return protoconv.RFC3339Ptr(t)
}

func rawJSONString(b []byte) string {
	if len(b) == 0 {
		return "{}"
	}
	return string(b)
}

func toProtoLoop(l *loopDomain.Loop) *loopv1.Loop {
	if l == nil {
		return nil
	}
	out := &loopv1.Loop{
		Id:                  l.ID,
		Slug:                l.Slug,
		Name:                l.Name,
		Description:         optStrPtr(l.Description),
		AgentSlug:           l.AgentSlug,
		PermissionMode:      l.PermissionMode,
		PromptTemplate:      l.PromptTemplate,
		ConfigOverridesJson: rawJSONString(l.ConfigOverrides),
		PromptVariablesJson: rawJSONString(l.PromptVariables),
		ExecutionMode:       l.ExecutionMode,
		CronExpression:      optStrPtr(l.CronExpression),
		AutopilotConfigJson: rawJSONString(l.AutopilotConfig),
		CallbackUrl:         optStrPtr(l.CallbackURL),
		RepositoryId:        l.RepositoryID,
		RunnerId:            l.RunnerID,
		BranchName:          optStrPtr(l.BranchName),
		TicketId:            l.TicketID,
		Status:              l.Status,
		SandboxStrategy:     l.SandboxStrategy,
		SessionPersistence:  l.SessionPersistence,
		ConcurrencyPolicy:   l.ConcurrencyPolicy,
		MaxConcurrentRuns:   int32(l.MaxConcurrentRuns),
		MaxRetainedRuns:     int32(l.MaxRetainedRuns),
		TimeoutMinutes:      int32(l.TimeoutMinutes),
		IdleTimeoutSec:      int32(l.IdleTimeoutSec),
		TotalRuns:           int64(l.TotalRuns),
		SuccessfulRuns:      int64(l.SuccessfulRuns),
		FailedRuns:          int64(l.FailedRuns),
		ActiveRunCount:      int64(l.ActiveRunCount),
		AvgDurationSec:      l.AvgDurationSec,
		LastRunAt:           optTimePtr(l.LastRunAt),
		CreatedAt:           protoconv.RFC3339(l.CreatedAt),
		UpdatedAt:           protoconv.RFC3339(l.UpdatedAt),
		UsedEnvBundles:      []string(l.UsedEnvBundles),
	}
	return out
}

func toProtoLoopRun(r *loopDomain.LoopRun) *loopv1.LoopRun {
	if r == nil {
		return nil
	}
	out := &loopv1.LoopRun{
		Id:           r.ID,
		LoopId:       r.LoopID,
		RunNumber:    int64(r.RunNumber),
		Status:       r.Status,
		PodKey:       optStrPtr(r.PodKey),
		StartedAt:    optTimePtr(r.StartedAt),
		CompletedAt:  optTimePtr(r.FinishedAt),
		ErrorMessage: optStrPtr(r.ErrorMessage),
		CreatedAt:    protoconv.RFC3339(r.CreatedAt),
	}
	return out
}

```

### Core Architecture Module: `backend/internal/api/connect/loop/loop_crud.go`
```
package loopconnect

import (
	"context"
	"encoding/json"
	"errors"

	"connectrpc.com/connect"

	"github.com/anthropics/agentsmesh/backend/internal/api/connect/interceptors"
	"github.com/anthropics/agentsmesh/backend/internal/middleware"
	loopsvc "github.com/anthropics/agentsmesh/backend/internal/service/loop"
	loopv1 "github.com/anthropics/agentsmesh/proto/gen/go/loop/v1"
)

func jsonRawFromString(s string) json.RawMessage {
	if s == "" {
		return json.RawMessage("{}")
	}
	return json.RawMessage(s)
}

// CreateLoop — REST analogue: POST /loops.
func (s *Server) CreateLoop(
	ctx context.Context, req *connect.Request[loopv1.CreateLoopRequest],
) (*connect.Response[loopv1.Loop], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	if s.svc == nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("loop service not configured"))
	}
	tenant := middleware.GetTenant(ctx)
	m := req.Msg

	maxConcurrent := 1
	if v := m.GetMaxConcurrentRuns(); m.MaxConcurrentRuns != nil {
		maxConcurrent = int(v)
	}
	if maxConcurrent < 1 || maxConcurrent > 10 {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("max_concurrent_runs must be between 1 and 10"))
	}
	maxRetained := 0
	if m.MaxRetainedRuns != nil {
		maxRetained = int(m.GetMaxRetainedRuns())
	}
	if maxRetained < 0 || maxRetained > 10000 {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("max_retained_runs must be between 0 and 10000"))
	}
	timeoutMin := 60
	if m.TimeoutMinutes != nil {
		timeoutMin = int(m.GetTimeoutMinutes())
	}
	if timeoutMin < 1 || timeoutMin > 1440 {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("timeout_minutes must be between 1 and 1440"))
	}
	sessionPersist := true
	if m.SessionPersistence != nil {
		sessionPersist = m.GetSessionPersistence()
	}
	idleTimeout := 30
	if m.IdleTimeoutSec != nil {
		idleTimeout = int(m.GetIdleTimeoutSec())
	}
	if idleTimeout < 0 || idleTimeout > 3600 {
		return nil, connect.NewError(connect.CodeInvalidArgument,
			errors.New("idle_timeout_sec must be between 0 and 3600"))
	}

	svcReq := &loopsvc.CreateLoopRequest{
		OrganizationID:      tenant.OrganizationID,
		CreatedByID:         tenant.UserID,
		Name:                m.GetName(),
		Slug:                m.GetSlug(),
		AgentSlug:           m.GetAgentSlug(),
		PermissionMode:      m.GetPermissionMode(),
		PromptTemplate:      m.GetPromptTemplate(),
		PromptVariables:     jsonRawFromString(m.GetPromptVariablesJson()),
		ConfigOverrides:     jsonRawFromString(m.GetConfigOverridesJson()),
		AutopilotConfig:     jsonRawFromString(m.GetAutopilotConfigJson()),
		RepositoryID:        m.RepositoryId,
		RunnerID:            m.RunnerId,
		TicketID:            m.TicketId,
		UsedEnvBundles:      m.GetUsedEnvBundles(),
		ExecutionMode:       m.GetExecutionMode(),
		SandboxStrategy:     m.GetSandboxStrategy(),
		SessionPersistence:  sessionPersist,
		ConcurrencyPolicy:   m.GetConcurrencyPolicy(),
		MaxConcurrentRuns:   maxConcurrent,
		MaxRetainedRuns:     maxRetained,
		TimeoutMinutes:      timeoutMin,
		IdleTimeoutSec:      idleTimeout,
	}
	if v := m.GetDescription(); v != "" {
		svcReq.Description = &v
	}
	if v := m.GetBranchName(); v != "" {
		svcReq.BranchName = &v
	}
	if v := m.GetCronExpression(); v != "" {
		svcReq.CronExpression = &v
	}
	if v := m.GetCallbackUrl(); v != "" {
		svcReq.CallbackURL = &v
	}

	loop, err := s.svc.Create(ctx, svcReq)
	if err != nil {
		switch {
		case errors.Is(err, loopsvc.ErrDuplicateSlug):
			return nil, connect.NewError(connect.CodeAlreadyExists, errors.New("loop slug already exists"))
		case errors.Is(err, loopsvc.ErrInvalidSlug):
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("invalid slug format"))
		case errors.Is(err, loopsvc.ErrInvalidCron):
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("invalid cron expression"))
		case errors.Is(err, loopsvc.ErrInvalidCallbackURL),
			errors.Is(err, loopsvc.ErrInvalidEnumValue):
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		default:
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}
	return connect.NewResponse(toProtoLoop(loop)), nil
}

// UpdateLoop — REST analogue: PUT /loops/:slug.
func (s *Server) UpdateLoop(
	ctx context.Context, req *connect.Request[loopv1.UpdateLoopRequest],
) (*connect.Response[loopv1.Loop], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	if s.svc == nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("loop service not configured"))
	}
	if req.Msg.GetLoopSlug() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("loop_slug is required"))
	}
	if err := validateUpdateBounds(req.Msg); err != nil {
		return nil, err
	}
	tenant := middleware.GetTenant(ctx)
	svcReq := buildUpdateRequest(req.Msg)

	loop, err := s.svc.Update(ctx, tenant.OrganizationID, req.Msg.GetLoopSlug(), svcReq)
	if err != nil {
		switch {
		case errors.Is(err, loopsvc.ErrLoopNotFound):
			return nil, connect.NewError(connect.CodeNotFound, errors.New("loop not found"))
		case errors.Is(err, loopsvc.ErrInvalidCron):
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("invalid cron expression"))
		case errors.Is(err, loopsvc.ErrInvalidCallbackURL),
			errors.Is(err, loopsvc.ErrInvalidEnumValue):
			return nil, connect.NewError(connect.CodeInvalidArgument, err)
		default:
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}
	return connect.NewResponse(toProtoLoop(loop)), nil
}

func validateUpdateBounds(m *loopv1.UpdateLoopRequest) error {
	if m.MaxConcurrentRuns != nil {
		v := int(m.GetMaxConcurrentRuns())
		if v < 1 || v > 10 {
			return connect.NewError(connect.CodeInvalidArgument,
				errors.New("max_concurrent_runs must be between 1 and 10"))
		}
	}
	if m.TimeoutMinutes != nil {
		v := int(m.GetTimeoutMinutes())
		if v < 1 || v > 1440 {
			return connect.NewError(connect.CodeInvalidArgument,
				errors.New("timeout_minutes must be between 1 and 1440"))
		}
	}
	if m.MaxRetainedRuns != nil {
		v := int(m.GetMaxRetainedRuns())
		if v < 0 || v > 10000 {
			return connect.NewError(connect.CodeInvalidArgument,
				errors.New("max_retained_runs must be between 0 and 10000"))
		}
	}
	if m.IdleTimeoutSec != nil {
		v := int(m.GetIdleTimeoutSec())
		if v < 0 || v > 3600 {
			return connect.NewError(connect.CodeInvalidArgument,
				errors.New("idle_timeout_sec must be between 0 and 3600"))
		}
	}
	return nil
}

func buildUpdateRequest(m *loopv1.UpdateLoopRequest) *loopsvc.UpdateLoopRequest {
	r := &loopsvc.UpdateLoopRequest{
		AgentSlug:           m.GetAgentSlug(),
		Name:                m.Name,
		Description:         m.Description,
		PermissionMode:      m.PermissionMode,
		PromptTemplate:      m.PromptTemplate,
		ExecutionMode:       m.ExecutionMode,
		CronExpression:      m.CronExpression,
		CallbackURL:         m.CallbackUrl,
		SandboxStrategy:     m.SandboxStrategy,
		SessionPersistence:  m.SessionPersistence,
		ConcurrencyPolicy:   m.ConcurrencyPolicy,
		BranchName:          m.BranchName,
		RepositoryID:        m.RepositoryId,
		RunnerID:            m.RunnerId,
		TicketID:            m.TicketId,
	}
	if pv := m.GetPromptVariablesJson(); pv != "" {
		r.PromptVariables = jsonRawFromString(pv)
	}
	if co := m.GetConfigOverridesJson(); co != "" {
		r.ConfigOverrides = jsonRawFromString(co)
	}
	if ac := m.GetAutopilotConfigJson(); ac != "" {
		r.AutopilotConfig = jsonRawFromString(ac)
	}
	if m.MaxConcurrentRuns != nil {
		v := int(m.GetMaxConcurrentRuns())
		r.MaxConcurrentRuns = &v
	}
	if m.MaxRetainedRuns != nil {
		v := int(m.GetMaxRetainedRuns())
		r.MaxRetainedRuns = &v
	}
	if m.TimeoutMinutes != nil {
		v := int(m.GetTimeoutMinutes())
		r.TimeoutMinutes = &v
	}
	if m.IdleTimeoutSec != nil {
		v := int(m.GetIdleTimeoutSec())
		r.IdleTimeoutSec = &v
	}
	if m.UsedEnvBundles != nil {
		// Wrapper presence => caller intends to replace. Empty inner list clears.
		names := m.GetUsedEnvBundles().GetNames()
		if names == nil {
			names = []string{}
		}
		r.UsedEnvBundles = &names
	}
	return r
}

```

### Core Architecture Module: `backend/internal/api/connect/loop/loop_runs.go`
```
package loopconnect

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	"github.com/anthropics/agentsmesh/backend/internal/api/connect/interceptors"
	loopDomain "github.com/anthropics/agentsmesh/backend/internal/domain/loop"
	"github.com/anthropics/agentsmesh/backend/internal/middleware"
	loopsvc "github.com/anthropics/agentsmesh/backend/internal/service/loop"
	loopv1 "github.com/anthropics/agentsmesh/proto/gen/go/loop/v1"
)

// LoopRunServiceInterface mirrors REST LoopHandler's loopRunService dependency.
type LoopRunServiceInterface interface {
	ListRuns(ctx context.Context, filter *loopsvc.ListRunsFilter) ([]*loopDomain.LoopRun, int64, error)
	GetByID(ctx context.Context, id int64) (*loopDomain.LoopRun, error)
	CountActiveRunsByLoopIDs(ctx context.Context, ids []int64) (map[int64]int64, error)
	GetAvgDuration(ctx context.Context, loopID int64) (*float64, error)
}

// ListRuns — REST analogue: GET /loops/:slug/runs.
func (s *Server) ListRuns(
	ctx context.Context, req *connect.Request[loopv1.ListRunsRequest],
) (*connect.Response[loopv1.ListRunsResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	if s.svc == nil || s.runSvc == nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("loop services not configured"))
	}
	if req.Msg.GetLoopSlug() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("loop_slug is required"))
	}
	tenant := middleware.GetTenant(ctx)
	loop, err := s.svc.GetBySlug(ctx, tenant.OrganizationID, req.Msg.GetLoopSlug())
	if err != nil {
		if errors.Is(err, loopsvc.ErrLoopNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("loop not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	limit := int(req.Msg.GetLimit())
	if limit == 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	offset := int(req.Msg.GetOffset())
	if offset < 0 {
		offset = 0
	}

	runs, total, err := s.runSvc.ListRuns(ctx, &loopsvc.ListRunsFilter{
		LoopID: loop.ID,
		Status: req.Msg.GetStatus(),
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	items := make([]*loopv1.LoopRun, 0, len(runs))
	for _, r := range runs {
		items = append(items, toProtoLoopRun(r))
	}
	return connect.NewResponse(&loopv1.ListRunsResponse{
		Items:  items,
		Total:  total,
		Limit:  int32(limit),
		Offset: int32(offset),
	}), nil
}

// CancelRun — REST analogue: POST /loops/:slug/runs/:run_id/cancel.
func (s *Server) CancelRun(
	ctx context.Context, req *connect.Request[loopv1.CancelRunRequest],
) (*connect.Response[loopv1.CancelRunResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	if s.svc == nil || s.runSvc == nil || s.orchestrator == nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("loop services not configured"))
	}
	if req.Msg.GetLoopSlug() == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("loop_slug is required"))
	}
	if req.Msg.GetRunId() == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("run_id is required"))
	}
	tenant := middleware.GetTenant(ctx)

	loop, err := s.svc.GetBySlug(ctx, tenant.OrganizationID, req.Msg.GetLoopSlug())
	if err != nil {
		if errors.Is(err, loopsvc.ErrLoopNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("loop not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	run, err := s.runSvc.GetByID(ctx, req.Msg.GetRunId())
	if err != nil {
		if errors.Is(err, loopsvc.ErrRunNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, errors.New("run not found"))
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if run.LoopID != loop.ID {
		return nil, connect.NewError(connect.CodeNotFound, errors.New("run not found"))
	}
	if run.IsTerminal() {
		return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("run is already in terminal state"))
	}

	if run.PodKey != nil && s.podTerminator != nil {
		if err := s.podTerminator.TerminatePod(ctx, *run.PodKey); err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	} else {
		if err := s.orchestrator.MarkRunCancelled(ctx, req.Msg.GetRunId(), "Cancelled by user"); err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
	}
	return connect.NewResponse(&loopv1.CancelRunResponse{Message: "Run cancelled"}), nil
}

```

### Core Architecture Module: `backend/internal/api/connect/repository/repository_webhook.go`
```
package repositoryconnect

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	"github.com/anthropics/agentsmesh/backend/internal/api/connect/interceptors"
	"github.com/anthropics/agentsmesh/backend/internal/domain/gitprovider"
	"github.com/anthropics/agentsmesh/backend/internal/middleware"
	repositoryservice "github.com/anthropics/agentsmesh/backend/internal/service/repository"
	"github.com/anthropics/agentsmesh/backend/pkg/policy"
	repositoryv1 "github.com/anthropics/agentsmesh/proto/gen/go/repository/v1"
)

// RegisterRepositoryWebhook mirrors REST handler `RegisterRepositoryWebhook`
// (repositories_webhook.go:17).
func (s *Server) RegisterRepositoryWebhook(
	ctx context.Context, req *connect.Request[repositoryv1.RegisterRepositoryWebhookRequest],
) (*connect.Response[repositoryv1.RegisterRepositoryWebhookResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	repo, err := s.requireRepoWrite(ctx, req.Msg.GetId())
	if err != nil {
		return nil, err
	}

	tenant := middleware.GetTenant(ctx)
	webhookSvc := s.repoSvc.GetWebhookService()
	if webhookSvc == nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("webhook service not available"))
	}
	result, err := webhookSvc.RegisterWebhookForRepository(
		ctx, repo, tenant.OrganizationSlug, tenant.UserID,
	)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&repositoryv1.RegisterRepositoryWebhookResponse{
		Result: toProtoWebhookResult(result),
	}), nil
}

// DeleteRepositoryWebhook mirrors REST handler `DeleteRepositoryWebhook`
// (repositories_webhook.go:63).
func (s *Server) DeleteRepositoryWebhook(
	ctx context.Context, req *connect.Request[repositoryv1.DeleteRepositoryWebhookRequest],
) (*connect.Response[repositoryv1.DeleteRepositoryWebhookResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	repo, err := s.requireRepoWrite(ctx, req.Msg.GetId())
	if err != nil {
		return nil, err
	}

	tenant := middleware.GetTenant(ctx)
	webhookSvc := s.repoSvc.GetWebhookService()
	if webhookSvc == nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("webhook service not available"))
	}
	if err := webhookSvc.DeleteWebhookForRepository(ctx, repo, tenant.UserID); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&repositoryv1.DeleteRepositoryWebhookResponse{}), nil
}

// GetRepositoryWebhookStatus mirrors REST handler
// `GetRepositoryWebhookStatus` (repositories_webhook.go:108). Read-policy
// gate.
func (s *Server) GetRepositoryWebhookStatus(
	ctx context.Context, req *connect.Request[repositoryv1.GetRepositoryWebhookStatusRequest],
) (*connect.Response[repositoryv1.WebhookStatus], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	if err := s.requireRepoRead(ctx, req.Msg.GetId()); err != nil {
		return nil, err
	}

	repo, err := s.repoSvc.GetByID(ctx, req.Msg.GetId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	webhookSvc := s.repoSvc.GetWebhookService()
	if webhookSvc == nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("webhook service not available"))
	}
	status := webhookSvc.GetWebhookStatus(ctx, repo)
	return connect.NewResponse(toProtoWebhookStatus(status)), nil
}

// GetRepositoryWebhookSecret mirrors REST handler
// `GetRepositoryWebhookSecret` (repositories_webhook.go:143). Admin-write
// gate; the secret is the most sensitive field on the surface.
func (s *Server) GetRepositoryWebhookSecret(
	ctx context.Context, req *connect.Request[repositoryv1.GetRepositoryWebhookSecretRequest],
) (*connect.Response[repositoryv1.WebhookSecret], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	repo, err := s.requireRepoWrite(ctx, req.Msg.GetId())
	if err != nil {
		return nil, err
	}

	webhookSvc := s.repoSvc.GetWebhookService()
	if webhookSvc == nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("webhook service not available"))
	}
	secret, err := webhookSvc.GetWebhookSecret(ctx, repo)
	if err != nil {
		if errors.Is(err, repositoryservice.ErrWebhookNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	out := &repositoryv1.WebhookSecret{
		WebhookSecret: secret,
	}
	if repo.WebhookConfig != nil {
		out.WebhookUrl = repo.WebhookConfig.URL
		out.Events = repo.WebhookConfig.Events
	}
	return connect.NewResponse(out), nil
}

// MarkRepositoryWebhookConfigured mirrors REST handler
// `MarkRepositoryWebhookConfigured` (repositories_webhook.go:196).
func (s *Server) MarkRepositoryWebhookConfigured(
	ctx context.Context, req *connect.Request[repositoryv1.MarkRepositoryWebhookConfiguredRequest],
) (*connect.Response[repositoryv1.MarkRepositoryWebhookConfiguredResponse], error) {
	ctx, _, err := interceptors.ResolveOrgScope(ctx, req.Msg, s.orgSvc)
	if err != nil {
		return nil, err
	}
	repo, err := s.requireRepoWrite(ctx, req.Msg.GetId())
	if err != nil {
		return nil, err
	}

	webhookSvc := s.repoSvc.GetWebhookService()
	if webhookSvc == nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("webhook service not available"))
	}
	if err := webhookSvc.MarkWebhookAsConfigured(ctx, repo); err != nil {
		if errors.Is(err, repositoryservice.ErrWebhookNotFound) {
			return nil, connect.NewError(connect.CodeNotFound, err)
		}
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	return connect.NewResponse(&repositoryv1.MarkRepositoryWebhookConfiguredResponse{}), nil
}

// requireRepoWrite mirrors the admin + write-policy gate used by webhook
// endpoints. Returns the fetched repository on success so the caller can
// reuse it without re-querying.
func (s *Server) requireRepoWrite(
	ctx context.Context, repoID int64,
) (*gitprovider.Repository, error) {
	tenant := middleware.GetTenant(ctx)
	sub := policy.NewSubject(tenant.OrganizationID, tenant.UserID, tenant.UserRole)
	if !policy.AllowAdmin(sub, tenant.OrganizationID) {
		return nil, connect.NewError(connect.CodePermissionDenied, errors.New("admin role required"))
	}
	repo, err := s.repoSvc.GetByID(ctx, repoID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	if !policy.RepositoryPolicy.AllowWrite(sub, policy.VisibleResource(
		repo.OrganizationID, repo.ImportedByUserID, repo.Visibility,
	)) {
		return nil, connect.NewError(connect.CodePermissionDenied, errors.New("access denied"))
	}
	return repo, nil
}

```

### Core Architecture Module: `backend/internal/api/grpc/runner_adapter_mcp_loop.go`
```
package grpc

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	loopDomain "github.com/anthropics/agentsmesh/backend/internal/domain/loop"
	"github.com/anthropics/agentsmesh/backend/internal/middleware"
	loopService "github.com/anthropics/agentsmesh/backend/internal/service/loop"
)

func (a *GRPCRunnerAdapter) mcpListLoops(ctx context.Context, tc *middleware.TenantContext, payload []byte) (interface{}, *mcpError) {
	if a.loopService == nil {
		return nil, newMcpError(500, "loop service not available")
	}

	var params struct {
		Status string `json:"status"`
		Query  string `json:"query"`
		Limit  int    `json:"limit"`
		Offset int    `json:"offset"`
	}
	if err := unmarshalPayload(payload, &params); err != nil {
		return nil, err
	}

	limit := params.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	offset := params.Offset
	if offset < 0 {
		offset = 0
	}

	loops, _, err := a.loopService.List(ctx, &loopDomain.ListFilter{
		OrganizationID: tc.OrganizationID,
		Status:         params.Status,
		Query:          params.Query,
		Limit:          limit,
		Offset:         offset,
	})
	if err != nil {
		return nil, newMcpError(500, "failed to list loops")
	}

	if len(loops) > 0 && a.loopRunService != nil {
		loopIDs := make([]int64, len(loops))
		for i, l := range loops {
			loopIDs[i] = l.ID
		}
		if counts, err := a.loopRunService.CountActiveRunsByLoopIDs(ctx, loopIDs); err == nil {
			for _, l := range loops {
				if count, ok := counts[l.ID]; ok {
					l.ActiveRunCount = int(count)
				}
			}
		}
	}

	summaries := make([]*mcpLoopSummary, len(loops))
	for i, l := range loops {
		summaries[i] = toMCPLoopSummary(l)
	}

	return map[string]interface{}{"loops": summaries}, nil
}

func (a *GRPCRunnerAdapter) mcpTriggerLoop(ctx context.Context, tc *middleware.TenantContext, payload []byte) (interface{}, *mcpError) {
	if a.loopService == nil || a.loopOrchestrator == nil {
		return nil, newMcpError(500, "loop service not available")
	}

	var params struct {
		LoopSlug  string          `json:"loop_slug"`
		Variables json.RawMessage `json:"variables"`
	}
	if err := unmarshalPayload(payload, &params); err != nil {
		return nil, err
	}

	if params.LoopSlug == "" {
		return nil, newMcpError(400, "loop_slug is required")
	}

	loop, err := a.loopService.GetBySlug(ctx, tc.OrganizationID, params.LoopSlug)
	if err != nil {
		if errors.Is(err, loopService.ErrLoopNotFound) {
			return nil, newMcpError(404, "loop not found")
		}
		return nil, newMcpError(500, "failed to get loop")
	}

	result, err := a.loopOrchestrator.TriggerRun(ctx, &loopService.TriggerRunRequest{
		LoopID:        loop.ID,
		TriggerType:   loopDomain.RunTriggerManual,
		TriggerSource: "pod:" + strconv.FormatInt(tc.UserID, 10),
		TriggerParams: params.Variables,
	})
	if err != nil {
		if errors.Is(err, loopService.ErrLoopDisabled) {
			return nil, newMcpError(400, "loop is disabled")
		}
		return nil, newMcpError(500, "failed to trigger loop")
	}

	if result.Skipped {
		return map[string]interface{}{
			"run":     toMCPRunSummary(result.Run),
			"skipped": true,
			"reason":  result.Reason,
		}, nil
	}

	startCtx, startCancel := context.WithTimeout(context.Background(), 5*time.Minute)
	go func() {
		defer startCancel()
		a.loopOrchestrator.StartRun(startCtx, result.Loop, result.Run, tc.UserID)
	}()

	return map[string]interface{}{
		"run": toMCPRunSummary(result.Run),
	}, nil
}

```

### Core Architecture Module: `backend/internal/api/grpc/runner_adapter_mcp_loop_types.go`
```
package grpc

import (
	"time"

	loopDomain "github.com/anthropics/agentsmesh/backend/internal/domain/loop"
)

type mcpLoopSummary struct {
	Slug           string  `json:"slug"`
	Name           string  `json:"name"`
	Description    string  `json:"description,omitempty"`
	Status         string  `json:"status"`
	ExecutionMode  string  `json:"execution_mode"`
	CronExpression string  `json:"cron_expression,omitempty"`
	TotalRuns      int     `json:"total_runs"`
	SuccessfulRuns int     `json:"successful_runs"`
	FailedRuns     int     `json:"failed_runs"`
	ActiveRunCount int     `json:"active_run_count"`
	LastRunAt      string  `json:"last_run_at,omitempty"`
	NextRunAt      string  `json:"next_run_at,omitempty"`
	CreatedAt      string  `json:"created_at"`
}

func toMCPLoopSummary(l *loopDomain.Loop) *mcpLoopSummary {
	s := &mcpLoopSummary{
		Slug:           l.Slug,
		Name:           l.Name,
		Status:         l.Status,
		ExecutionMode:  l.ExecutionMode,
		TotalRuns:      l.TotalRuns,
		SuccessfulRuns: l.SuccessfulRuns,
		FailedRuns:     l.FailedRuns,
		ActiveRunCount: l.ActiveRunCount,
		CreatedAt:      l.CreatedAt.Format(time.RFC3339),
	}
	if l.Description != nil {
		s.Description = *l.Description
	}
	if l.CronExpression != nil {
		s.CronExpression = *l.CronExpression
	}
	if l.LastRunAt != nil {
		s.LastRunAt = l.LastRunAt.Format(time.RFC3339)
	}
	if l.NextRunAt != nil {
		s.NextRunAt = l.NextRunAt.Format(time.RFC3339)
	}
	return s
}

type mcpRunSummary struct {
	ID          int64  `json:"id"`
	RunNumber   int    `json:"run_number"`
	Status      string `json:"status"`
	TriggerType string `json:"trigger_type"`
	PodKey      string `json:"pod_key,omitempty"`
	StartedAt   string `json:"started_at,omitempty"`
	FinishedAt  string `json:"finished_at,omitempty"`
	DurationSec *int   `json:"duration_sec,omitempty"`
	CreatedAt   string `json:"created_at"`
}

func toMCPRunSummary(r *loopDomain.LoopRun) *mcpRunSummary {
	s := &mcpRunSummary{
		ID:          r.ID,
		RunNumber:   r.RunNumber,
		Status:      r.Status,
		TriggerType: r.TriggerType,
		DurationSec: r.DurationSec,
		CreatedAt:   r.CreatedAt.Format(time.RFC3339),
	}
	if r.PodKey != nil {
		s.PodKey = *r.PodKey
	}
	if r.StartedAt != nil {
		s.StartedAt = r.StartedAt.Format(time.RFC3339)
	}
	if r.FinishedAt != nil {
		s.FinishedAt = r.FinishedAt.Format(time.RFC3339)
	}
	return s
}

```

### Core Architecture Module: `backend/internal/api/rest/v1/loop_handler.go`
```
package v1

import (
	"context"
	"errors"
	"net/http"

	"github.com/anthropics/agentsmesh/backend/internal/middleware"
	loopService "github.com/anthropics/agentsmesh/backend/internal/service/loop"
	"github.com/anthropics/agentsmesh/backend/pkg/apierr"
	"github.com/gin-gonic/gin"
)

// PodTerminatorForLoop defines the minimal interface needed by LoopHandler
// to terminate Pods (used for cancel run). Follows ISP — handler only needs TerminatePod.
type PodTerminatorForLoop interface {
	TerminatePod(ctx context.Context, podKey string) error
}

// LoopHandler handles loop-related requests
type LoopHandler struct {
	loopService    *loopService.LoopService
	loopRunService *loopService.LoopRunService
	orchestrator   *loopService.LoopOrchestrator
	podTerminator  PodTerminatorForLoop
}

// NewLoopHandler creates a new loop handler
func NewLoopHandler(
	ls *loopService.LoopService,
	lrs *loopService.LoopRunService,
	orch *loopService.LoopOrchestrator,
	podTerminator PodTerminatorForLoop,
) *LoopHandler {
	return &LoopHandler{
		loopService:    ls,
		loopRunService: lrs,
		orchestrator:   orch,
		podTerminator:  podTerminator,
	}
}

// ========== Loop CRUD ==========

// ListLoops lists loops for an organization
// GET /api/v1/orgs/:slug/loops
func (h *LoopHandler) ListLoops(c *gin.Context) {
	var req listLoopsQuery
	if err := c.ShouldBindQuery(&req); err != nil {
		apierr.ValidationError(c, err.Error())
		return
	}

	tenant := middleware.GetTenant(c)
	limit := req.Limit
	if limit == 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	offset := req.Offset
	if offset < 0 {
		offset = 0
	}

	loops, total, err := h.loopService.List(c.Request.Context(), &loopService.ListLoopsFilter{
		OrganizationID: tenant.OrganizationID,
		Status:         req.Status,
		ExecutionMode:  req.ExecutionMode,
		CronEnabled:    req.CronEnabled,
		Query:          req.Query,
		Limit:          limit,
		Offset:         offset,
	})
	if err != nil {
		apierr.InternalError(c, "Failed to list loops")
		return
	}

	// Enrich with active run counts (H2)
	if len(loops) > 0 {
		loopIDs := make([]int64, len(loops))
		for i, l := range loops {
			loopIDs[i] = l.ID
		}
		if counts, err := h.loopRunService.CountActiveRunsByLoopIDs(c.Request.Context(), loopIDs); err == nil {
			for _, l := range loops {
				if count, ok := counts[l.ID]; ok {
					l.ActiveRunCount = int(count)
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"loops":  loops,
		"total":  total,
		"limit":  limit,
		"offset": req.Offset,
	})
}

// GetLoop gets a loop by slug
// GET /api/v1/orgs/:slug/loops/:loop_slug
func (h *LoopHandler) GetLoop(c *gin.Context) {
	tenant := middleware.GetTenant(c)
	loopSlug := c.Param("loop_slug")

	loop, err := h.loopService.GetBySlug(c.Request.Context(), tenant.OrganizationID, loopSlug)
	if err != nil {
		if errors.Is(err, loopService.ErrLoopNotFound) {
			apierr.ResourceNotFound(c, "Loop not found")
		} else {
			apierr.InternalError(c, "Failed to get loop")
		}
		return
	}

	// Enrich with active run count (H2)
	if counts, err := h.loopRunService.CountActiveRunsByLoopIDs(c.Request.Context(), []int64{loop.ID}); err == nil {
		if count, ok := counts[loop.ID]; ok {
			loop.ActiveRunCount = int(count)
		}
	}

	// Enrich with average duration (M5)
	if avg, err := h.loopRunService.GetAvgDuration(c.Request.Context(), loop.ID); err == nil && avg != nil {
		loop.AvgDurationSec = avg
	}

	c.JSON(http.StatusOK, gin.H{"loop": loop})
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #472** (2026-09-23): **[Bug] Hardcoded JWT fallback secret enables token forgery**
  *Symptoms*: ### Summary  ## Summary  When `JWT_SECRET` is unavailable, the application uses the hardcoded fallback `change-me-in-production` from [`config.go:66`](https://github.com/AgentsMesh/AgentsMesh/blob/1f90b14194d03c353df4f281a05442afe93cae34/config.go#L66). The same value is used for JWT signing and verification, allowing an attacker who knows the public default to forge authentication tokens in deployments that retain this fallback.  ## Affected Version  Affected version: commit `1f90b14194d03c353df4f281a05442afe93cae34` on branch `main`.  ## Technical Details and Root Cause  The configuration contains the concrete static fallback `change-me-in-production` at [`config.go:66`](https://github.com/AgentsMesh/AgentsMesh/blob/1f90b14194d03c353df4f281a05442afe93cae34/config.go#L66).  JWT generation uses the configured secret at [`token_generate.go:41`](https://github.com/AgentsMesh/AgentsMesh/blob/1f90b14194d03c353df4f281a05442afe93cae34/token_generate.go#L41), while authentication uses the configured key when parsing and verifying tokens at [`auth.go:78`](https://github.com/AgentsMesh/AgentsMesh/blob/1f90b14194d03c353df4f281a05442afe93cae34/auth.go#L78). Consequently, any deployment that does not override the fallback shares a publicly known HMAC JWT key. Tokens containing identity and permission claims can therefore be forged and presented as authenticated credentials.  ## Impact  An attacker who can reach an affected authentication-protected deployment and knows that it retained th
  **Post-Mortem & Fix Analysis**:
  > I'd like to take this issue.  **Scope** - In: remove the hardcoded JWT fallback `change-me-in-production`; refuse to start authentication (or fail closed at token issue/verify) when `JWT_SECRET` is unset/empty in non-test environments. - Out: multi-tenant key rotation, JWKS, or a broader auth redesign. - Testing: unit tests that sign/verify fail closed without `JWT_SECRET`, and that an explicit secret still works.  If maintainers prefer a generated per-boot ephemeral secret with a loud warning instead of hard fail, happy to adjust after direction.

- **Issue #417** (2026-05-29): **[Bug] 该 Runner 暂不支持任何智能体**
  *Symptoms*: ### Summary  创建完成runner，准备创建pod，结果表示：  <img width="825" height="498" alt="Image" src="https://github.com/user-attachments/assets/0a092fa5-78f9-4667-a688-f7268393f3cc" />  ### Steps to reproduce  同上  ### Expected behavior  正常识别我机器的opencode并使用它进行工作  ### Actual behavior  没有识别到  ### Logs / screenshots  ```shell  ```  ### Version / commit  _No response_  ### Environment  _No response_
  **Post-Mortem & Fix Analysis**:
  > @gylove1994 ack
  >  # 环境报告  ## Incus 容器环境  | 项目 | 值 | |------|----| | 平台 | Incus 7.0.0 | | 项目 | agentsmesh-worker | | 实例 | agentsmesh-runner | | 类型 | Container (LXC) | | 架构 | x86_64 | | 存储池 | default (driver: dir) | | 网络 | eth0 → incusbr0（default 项目 bridge，NAT） | | 自动启动 | boot.autostart=true |  ## 基础镜像  | 项目 | 值 | |------|----| | 来源 | images.linuxcontainers.org (simplestreams) | | 别名 | ubuntu/noble / ubuntu/24.04 | | 描述 | Ubuntu noble amd64 (20260527_07:42) | | OS | Ubuntu 24.04.4 LTS | | 类型 | squashfs container | | 大小 | 139.02 MiB |  ## 容器内操作系统信息  | 项目 | 值 | |------|----| | 发行版 | Ubuntu 24.04.4 LTS (Noble) | | 内核 | 宿主机内核（Arch 7.0.x） | | CPU | 32 | | cgroup | v2 |  ## 已安装软件  | 组件 | 版本 | 安装方式 | |------|------|----------| | AgentsMesh Runner | 0.38.1 | https://agentsmesh.ai/install.sh | | Cursor CLI (agent/cursor) | 2026.05.27-f e9a6e2 | https://cursor.com/install | | OpenCode | 1.15.7 | install.sh --binary | | curl | 8.5.0 | 镜像自带 | | git | 2.43.0 | 镜像自带 | | nodejs / npm | v18.19.1 / 9.2.0 | apt |  ## Agen
  > @gylove1994 感谢反馈，尤其是这份非常详尽的 Incus 环境报告，帮了大忙 🙏  定位到两个独立根因：  1. **OpenCode 识别不到** —— 你用 `install.sh --binary` 装的 OpenCode 默认落在 `~/.opencode/bin/opencode`。Runner 在 Incus 容器里以非交互 / 服务方式启动时，继承到的 `PATH` 通常只有 `/usr/bin:/bin:...`，而旧版 Runner 的 fallback 搜索路径没覆盖 `~/.opencode/bin`，所以探测不到，前端就报「该 Runner 暂不支持任何智能体」。 2. **Cursor CLI 之前未接入** —— 你装的 `cursor-agent` 当时 Runner 还没注册这个 agent。  **已在 v0.39.0 修复并发布**（#418）： - 扩展了智能体 fallback 搜索路径，新增 `~/.opencode/bin`、`~/.cursor/bin`、`~/bin`，OpenCode 这类装在用户私有目录的 agent 现在能被正确发现； - 新增 **Cursor CLI**（`cursor-agent`）原生支持，可直接作为 builtin agent 使用（用 `cursor-agent login` 登录即可，无需额外配 API Key）。  **升级方式**（在容器内重新跑安装脚本即可升级到 0.39.0）： ```bash curl -fsSL https://agentsmesh.ai/install.sh | sh # 然后按你原来的方式重启 runner 服务，再重新创建 pod ```  升级后应该能在智能体列表里同时看到 `opencode` 和 `cursor-cli`。麻烦验证一下，有任何问题随时在这里回复 🙌 

- **Issue #375** (2026-05-18): **[Bug] Unable to find skills registered at the org level in the marketplace.**
  *Symptoms*: ### Summary  When I registered some repository-level skills, I wanted to select these skills in the repo, but found that there were no marketplace skills available.  <img width="1618" height="944" alt="Image" src="https://github.com/user-attachments/assets/71dcdc9c-ce17-4510-8971-10e4b3787569" />  ### Steps to reproduce  1. registered some repository-level skills 2.repo -> choose one repo -> extensions -> skills -> add  ### Expected behavior  can choose repository-level skills  ### Actual behavior  No marketplace skills appeared.  ### Logs / screenshots  ```shell  ```  ### Version / commit  _No response_  ### Environment  _No response_

- **Issue #346** (2026-05-10): **[Bug] The Pod popout window redirects abnormally.**
  *Symptoms*: ### Summary  The pod popout window redirects abnormally. The popout window redirects to the login page even when the user is already logged in. After logging in, it redirects to the AgentsMesh main page instead of the pod popout page.  <img width="644" height="214" alt="Image" src="https://github.com/user-attachments/assets/1a54c67a-8e53-4f85-befb-f077a892c6eb" />  ### Steps to reproduce  1.create a pod 2.click pod popout button  ### Expected behavior  popout windows show and display coding agent context  ### Actual behavior  redirect to login page  ### Logs / screenshots  ```shell  ```  ### Version / commit  _No response_  ### Environment  _No response_

- **Issue #345** (2026-05-10): **[Bug] Unable to create an API key normally.**
  *Symptoms*: ### Summary  Unable to create an API key normally. The created key content is empty, and the copied value is empty as well.  <img width="1274" height="650" alt="Image" src="https://github.com/user-attachments/assets/85d313df-b690-461a-9eec-4ac5d3792bfc" />  ### Steps to reproduce  1.Setting -> Orgs -> API Key 2.Create API Key  ### Expected behavior  The API key is created and displayed normally.  ### Actual behavior  The API key is displayed as empty.  ### Logs / screenshots  ```shell  ```  ### Version / commit  _No response_  ### Environment  _No response_
  **Post-Mortem & Fix Analysis**:
  > Fixed in #349 (commit 93f56e498).  The Rust `ApiKey` DTO did not declare a `raw_key` field, even though the backend returns the freshly generated key under that name on POST /api-keys. The deserializer therefore dropped the only response that ever carries the plaintext, leaving the UI with an empty value to copy. The DTO now exposes `raw_key`, the api-client surface keeps it on the create response, and the wasm relay preserves it across the boundary.  Closing as resolved.

- **Issue #343** (2026-05-10): **[Bug] When importing GitLab repositories using a Git PAT, clicking the “Import repo” button results in an error.**
  *Symptoms*: ### Summary  When importing GitLab repositories using a Git PAT, clicking the “Import repo” button results in an error. If we don’t use a Git PAT and manually enter the link directly, it works normally.  <img width="1986" height="1612" alt="Image" src="https://github.com/user-attachments/assets/10a4f93f-6636-4c6b-a114-ed7d2480ac46" />  ### Steps to reproduce  1.register a Git PAT 2.choose a repo 3.click import repository button  ### Expected behavior  repo was imported successful  ### Actual behavior  It shows a prompt saying that importing the repository failed.  ### Logs / screenshots  ```shell  ```  ### Version / commit  _No response_  ### Environment  _No response_
  **Post-Mortem & Fix Analysis**:
  > Fixed in #349 (commit 93f56e498).  Same root cause as #342: the `ProviderRepository` Rust DTO was missing the clone-URL fields (`http_clone_url` / `ssh_clone_url`) the Go backend returns. The "Import repo" call passed an empty clone URL through to the worktree provisioning step, which then errored out. The DTO is now field-complete and the import path round-trips cleanly.  Closing as resolved.

- **Issue #342** (2026-05-10): **[Bug] When importing GitLab repositories using a Git PAT, all repository names show as “no description.”**
  *Symptoms*: ### Summary  When importing GitLab repositories using a Git PAT, all repository names show as “no description.”  <img width="1890" height="1604" alt="Image" src="https://github.com/user-attachments/assets/bd6762a5-7569-4802-84f5-c9e5c939ba0d" />  ### Steps to reproduce  1. register a Git PAT 2. import repo  ### Expected behavior  repo list display with repo name  ### Actual behavior  repo name is “no description.”  ### Logs / screenshots  ```shell  ```  ### Version / commit  _No response_  ### Environment  _No response_
  **Post-Mortem & Fix Analysis**:
  > Fixed in #349 (commit 93f56e498).  The Rust `ProviderRepository` DTO did not match the Go backend response — the field carrying the repo description was being silently dropped during deserialization, so every imported repo rendered as "no description". The DTO now mirrors the backend payload exactly and the regression is covered by a wrapper-envelope round-trip test.  Closing as resolved.

- **Issue #291** (2026-04-14): **[Bug] repo re-import error after repo delete**
  *Symptoms*: ### Summary  if you delete a repo, then you cannot import repo again   ### Steps to reproduce  1. import a repo 2. delete it 3. re-import it  ### Expected behavior  the repo can be re-imported  ### Actual behavior  error out  ### Logs / screenshots  ```shell Failed to load resource: the server responded with a status of 402 () f20d487a9124cf45.js:1 Failed to import repository: ApiError: API Error: 402      at i (bfa4138db5823617.js:1:1695)     at async handleImport (f20d487a9124cf45.js:1:75888) /api/v1/orgs/zyf1994…pace/repositories:1   Failed to load resource: the server responded with a status of 402 () f20d487a9124cf45.js:1 Failed to import repository: ApiError: API Error: 402      at i (bfa4138db5823617.js:1:1695)     at async handleImport (f20d487a9124cf45.js:1:75888) handleImport	@	f20d487a9124cf45.js:1 ```  ### Version / commit  _No response_  ### Environment  _No response_

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

### Incident Patch 1: `d38e3932` (2026-09-23)
**Commit Message**: ﻿fix(auth): fail closed on missing/default JWT_SECRET (#474)

Remove the published default secret fallback. Non-debug startup now
refuses to boot when JWT_SECRET is empty or equals
change-me-in-production (#472). Debug mode continues with a warning.

Fixes #472

**File**: `backend/cmd/server/main.go` (modified, +4/-1)
```diff
@@ -6,6 +6,7 @@ import (
 	"log/slog"
 	"os"
 
+	"github.com/anthropics/agentsmesh/backend/internal/api/rest"
 	"github.com/anthropics/agentsmesh/backend/internal/config"
 	notifDomain "github.com/anthropics/agentsmesh/backend/internal/domain/notification"
 	"github.com/anthropics/agentsmesh/backend/internal/infra"
@@ -14,7 +15,6 @@ import (
 	"github.com/anthropics/agentsmesh/backend/internal/infra/logger"
 	otelinit "github.com/anthropics/agentsmesh/backend/internal/infra/otel"
 	"github.com/anthropics/agentsmesh/backend/internal/infra/websocket"
-	"github.com/anthropics/agentsmesh/backend/internal/api/rest"
 	"github.com/anthropics/agentsmesh/backend/internal/service/agentpod"
 	channelService "github.com/anthropics/agentsmesh/backend/internal/service/channel"
 	"github.com/anthropics/agentsmesh/backend/internal/service/instance"
@@ -36,6 +36,9 @@ func main() {
 		log.Fatalf("Failed to load config: %v", err)
 	}
 	cfg.WarnInsecureDefaults()
+	if err := cfg.ValidateJWTSecret(); err != nil {
+		log.Fatalf("Refusing to start with insecure JWT configuration: %v", err)
+	}
 
 	appLogger, err := logger.New(logger.Config{
 		Level:      cfg.Log.Level,
```

**File**: `backend/internal/config/config.go` (modified, +25/-6)
```diff
@@ -1,6 +1,7 @@
 package config
 
 import (
+	"fmt"
 	"log/slog"
 	"time"
 )
@@ -63,7 +64,9 @@ func Load() (*Config, error) {
 		},
 
 		JWT: JWTConfig{
-			Secret:          getEnv("JWT_SECRET", "change-me-in-production"),
+			// Empty default: a published shared secret enables token forgery.
+			// Non-debug startup must fail closed (ValidateJWTSecret).
+			Secret:          getEnv("JWT_SECRET", ""),
 			ExpirationHours: getEnvInt("JWT_EXPIRATION_HOURS", 24),
 		},
 
@@ -95,8 +98,8 @@ func Load() (*Config, error) {
 		},
 
 		Log: LogConfig{
-			Level:  getEnv("LOG_LEVEL", "info"),
-			Format: getEnv("LOG_FORMAT", "text"),
+			Level:      getEnv("LOG_LEVEL", "info"),
+			Format:     getEnv("LOG_FORMAT", "text"),
 			FilePath:   getEnv("LOG_FILE", ""),
 			MaxSizeMB:  getEnvInt("LOG_MAX_SIZE_MB", 100),
 			MaxBackups: getEnvInt("LOG_MAX_BACKUPS", 5),
@@ -200,15 +203,31 @@ func Load() (*Config, error) {
 	}, nil
 }
 
+const insecureJWTSecret = "change-me-in-production"
+
+// ValidateJWTSecret fails closed when JWT signing uses an empty or published
+// default key outside debug mode (#472).
+func (c *Config) ValidateJWTSecret() error {
+	secret := c.JWT.Secret
+	if secret == "" || secret == insecureJWTSecret {
+		if c.Server.Debug {
+			slog.Warn("SECURITY: JWT_SECRET is unset or the published default; continuing only because DEBUG is enabled")
+			return nil
+		}
+		return fmt.Errorf("JWT_SECRET is required and must not be the published default; set a strong random secret via environment variable")
+	}
+	return nil
+}
+
 func (c *Config) WarnInsecureDefaults() {
 	if c.Server.InternalAPISecret == "change-me-internal-secret" {
 		slog.Warn("SECURITY: INTERNAL_API_SECRET is using the default value; set a strong random secret via environment variable")
 	}
-	if c.JWT.Secret == "change-me-in-production" {
+	if c.JWT.Secret == "" || c.JWT.Secret == insecureJWTSecret {
 		if c.Server.Debug {
-			slog.Warn("SECURITY: JWT_SECRET is using the default value; set a strong random secret via environment variable")
+			slog.Warn("SECURITY: JWT_SECRET is unset or the published default; set a strong random secret via environment variable")
 		} else {
-			slog.Error("SECURITY: JWT_SECRET is using the default value in non-debug mode; this is a critical security risk — set JWT_SECRET environment variable")
+			slog.Error("SECURITY: JWT_SECRET is unset or the published default in non-debug mode; this is a critical security risk — set JWT_SECRET environment variable")
 		}
 	}
 }
```

**File**: `backend/internal/config/jwt_secret_test.go` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+package config
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+func TestValidateJWTSecret(t *testing.T) {
+	t.Run("fails closed on empty secret outside debug", func(t *testing.T) {
+		cfg := &Config{JWT: JWTConfig{Secret: ""}, Server: ServerConfig{Debug: false}}
+		require.Error(t, cfg.ValidateJWTSecret())
+	})
+
+	t.Run("fails closed on published default outside debug", func(t *testing.T) {
+		cfg := &Config{
+			JWT:    JWTConfig{Secret: "change-me-in-production"},
+			Server: ServerConfig{Debug: false},
+		}
+		require.Error(t, cfg.ValidateJWTSecret())
+	})
+
+	t.Run("allows empty/default only in debug", func(t *testing.T) {
+		cfg := &Config{
+			JWT:    JWTConfig{Secret: "change-me-in-production"},
+			Server: ServerConfig{Debug: true},
+		}
+		assert.NoError(t, cfg.ValidateJWTSecret())
+	})
+
+	t.Run("accepts an explicit strong secret", func(t *testing.T) {
+		cfg := &Config{
+			JWT:    JWTConfig{Secret: "a-strong-random-value"},
+			Server: ServerConfig{Debug: false},
+		}
+		assert.NoError(t, cfg.ValidateJWTSecret())
+	})
+}
```

---

### Incident Patch 2: `1f90b141` (2026-08-03)
**Commit Message**: ci: sync:github 与 build:images 迁移到 k8s runner

docker,x86 池（3 台 docker runner VM）已退役。此改动必须落在 GitHub 侧：
GitLab main 是本仓的单向镜像，sync:github 会以 GitHub SHA 强推覆盖，
直接改 GitLab main 会在下一班同步时被冲掉（GitLab MR !185 即如此丢失）。

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `.gitlab-ci.yml` (modified, +6/-4)
```diff
@@ -12,8 +12,7 @@ sync:github:
     name: "$BAZEL_BUILDER_IMAGE"
     entrypoint: [""]
   tags:
-    - docker
-    - x86
+    - k8s
   script:
     - |
       set -euo pipefail
@@ -51,8 +50,11 @@ build:images:
     docker:
       user: "0"
   tags:
-    - docker
-    - x86
+    - k8s
+  variables:
+    KUBERNETES_CPU_REQUEST: "3"
+    KUBERNETES_MEMORY_REQUEST: "6Gi"
+    KUBERNETES_MEMORY_LIMIT: "10Gi"
   parallel:
     matrix:
       - SERVICE: backend
```

---

### Incident Patch 3: `3d242f57` (2026-07-24)
**Commit Message**: fix(terminal): harden PTY relay rendering lifecycle (#470)

* fix(terminal): harden PTY relay rendering lifecycle

Make relay generations, PTY snapshots, Unicode width handling, and desktop/Web delivery deterministic across reconnects.

Generated with Codex

* refactor(terminal): split relay lifecycle owners

Separate production and test responsibilities to enforce repository file-size contracts without changing runtime behavior.

Generated with Codex

* fix(ci): satisfy terminal lint and Gazelle contracts

* fix(test): make terminal contracts portable

* fix(ci): declare runfiles test dependency

**File**: `.github/workflows/bazel.yml` (modified, +79/-2)
```diff
@@ -49,6 +49,8 @@ jobs:
         run: bash tools/identifier-lint/lint.sh
       - name: Self-hosted Traefik route contract
         run: bash deploy/traefik_connect_routes_test.sh
+      - name: Dev frontend lifecycle contract
+        run: bash deploy/dev/frontend_services_test.sh
       - name: Verify desktop-only crate isolation
         run: |
           set -euo pipefail
@@ -134,6 +136,8 @@ jobs:
     needs: smoke
     steps:
       - uses: actions/checkout@v6
+        with:
+          fetch-depth: 0
       - uses: bazel-contrib/setup-bazel@0.9.1
         with:
           bazelisk-cache: true
@@ -153,6 +157,63 @@ jobs:
       # invoke them explicitly here. Failures here mean a real fork/exec
       # path regressed.
       - run: bazel test --flaky_test_attempts=2 //runner/internal/poddaemon:poddaemon_integration_test
+      - name: Go architecture changed-line coverage (>=95% per changed production file)
+        env:
+          PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}
+          PUSH_BASE_SHA: ${{ github.event.before }}
+        run: |
+          bazel test //tools/coverage:go_diff_coverage_test
+          bazel coverage \
+            --combined_report=lcov \
+            --instrument_test_targets \
+            '--instrumentation_filter=//(runner/internal/(terminal|client|relay|runner|agents/mockagent)|relay/internal/protocol|clients/web/scripts/runewidth-profile)' \
+            --cache_test_results=no \
+            //runner/internal/terminal/vt:vt_test \
+            //runner/internal/terminal:terminal_test \
+            //runner/internal/terminal/aggregator:aggregator_test \
+            //runner/internal/terminal/detector:detector_test \
+            //runner/internal/agents/mockagent:mockagent_test \
+            //runner/internal/client:client_test \
+            //runner/internal/relay:relay_test \
+            //runner/internal/runner:runner_test \
+            //relay/internal/protocol:protocol_test \
+            //clients/web/scripts/runewidth-profile:generated_profile_check
+
+          base_sha="$PR_BASE_SHA"
+          if [[ -z "$base_sha" ]]; then
+            base_sha="$PUSH_BASE_SHA"
+          fi
+          if [[ -z "$base_sha" || "$base_sha" =~ ^0+$ ]] || \
+              ! git cat-file -e "${base_sha}^{commit}" 2>/dev/null; then
+            base_sha=$(git rev-parse HEAD^)
+          fi
+
+          check_changed_coverage() {
+            local prefix="$1"
+            shift
+            tools/coverage/go_diff_coverage.sh \
+              --lcov bazel-out/_coverage/_coverage_report.dat \
+              --base "$base_sha" \
+              --include "$prefix" \
+              --threshold 95 \
+              "$@"
+          }
+
+          check_changed_coverage runner/internal/runner
+          check_changed_coverage runner/internal/client
+          check_changed_coverage runner/internal/relay
+          check_changed_coverage runner/internal/terminal --exact-directory
+          check_changed_coverage runner/internal/terminal/vt --exact-directory
+          check_changed_coverage runner/internal/terminal/aggregator --exact-directory
+          check_changed_coverage runner/internal/terminal/detector --exact-directory
+          # The no-op fallback is selected only on non-Unix targets and is
+          # therefore absent from Ubuntu's LCOV by construction. Keep the
+          # platform exclusion explicit; the Unix implementation remains
+          # subject to the same per-file >=95% gate as every other owner.
+          check_changed_coverage runner/internal/agents/mockagent \
+            --exclude-prefix runner/internal/agents/mockagent/pty_render_resize_other.go
+          check_changed_coverage relay/internal/protocol --exact-directory
+          check_changed_coverage clients/web/scripts/runewidth-profile --exact-directory
 
   rust:
     name: Rust Core (clients/core)
@@ -173,6 +234,20 @@ jobs:
       # tagged `manual + requires-darwin`, wasm_pkg needs wasm-bindgen —
       # both get filtered out here and own their own jobs.
       - run: bazel test --build_tests_only //clients/core/crates/...
+      - name: Relay production coverage (>=95% aggregate and per file)
+        run: |
+          bazel coverage \
+            --combined_report=lcov \
+            --instrument_test_targets \
+            --instrumentation_filter=//clients/core/crates/relay \
+            --cache_test_results=no \
+            //clients/core/crates/relay:relay_test
+          clients/core/crates/relay/check_lcov_coverage.sh \
+            bazel-out/_coverage/_coverage_report.dat \
+            95 \
+            95
+      - name: Node Bridge relay readiness ABI
+        run: bazel test //clients/desktop:relay_node_bridge_integration
 
   # ===========================================================================
   # Mixed Bazel / shell — these jobs use Bazel under the hood (lint /
@@ -383,15 +458,17 @@ jobs:
       # `bazel build :src` — the latter only transpiles (no_emit) and
```

**File**: `MODULE.bazel` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ go_sdk.download(version = "1.25.0")
 # its `require` blocks and emits one `go_deps` import per dependency.
 go_deps = use_extension("@gazelle//:extensions.bzl", "go_deps")
 go_deps.from_file(go_mod = "//:go.mod")
-use_repo(go_deps, "com_connectrpc_connect", "com_github_alicebob_miniredis_v2", "com_github_aws_aws_sdk_go_v2", "com_github_aws_aws_sdk_go_v2_config", "com_github_aws_aws_sdk_go_v2_credentials", "com_github_aws_aws_sdk_go_v2_service_s3", "com_github_coreos_go_oidc_v3", "com_github_creack_pty", "com_github_creativeprojects_go_selfupdate", "com_github_crewjam_saml", "com_github_gin_contrib_cors", "com_github_gin_gonic_gin", "com_github_go_acme_lego_v4", "com_github_go_git_go_git_v5", "com_github_go_ldap_ldap_v3", "com_github_golang_jwt_jwt_v5", "com_github_golang_migrate_migrate_v4", "com_github_google_uuid", "com_github_gorilla_websocket", "com_github_kardianos_service", "com_github_lib_pq", "com_github_masterminds_semver_v3", "com_github_mattn_go_runewidth", "com_github_maxmind_mmdbwriter", "com_github_ndolestudio_lemonsqueezy_go", "com_github_oschwald_maxminddb_golang", "com_github_pelletier_go_toml_v2", "com_github_pkg_browser", "com_github_redis_go_redis_extra_redisotel_v9", "com_github_redis_go_redis_v9", "com_github_resend_resend_go_v2", "com_github_robfig_cron_v3", "com_github_smartwalle_alipay_v3", "com_github_spf13_viper", "com_github_stretchr_testify", "com_github_stripe_stripe_go_v76", "com_github_thejerf_suture_v4", "com_github_uptrace_opentelemetry_go_extra_otelgorm", "com_github_userexistserror_conpty", "com_github_wechatpay_apiv3_wechatpay_go", "com_github_yuin_goldmark", "in_gopkg_yaml_v3", "io_gorm_driver_postgres", "io_gorm_driver_sqlite", "io_gorm_gorm", "io_gorm_plugin_dbresolver", "io_opentelemetry_go_contrib_instrumentation_github_com_gin_gonic_gin_otelgin", "io_opentelemetry_go_contrib_instrumentation_google_golang_org_grpc_otelgrpc", "io_opentelemetry_go_contrib_instrumentation_net_http_otelhttp", "io_opentelemetry_go_otel", "io_opentelemetry_go_otel_exporters_otlp_otlpmetric_otlpmetricgrpc", "io_opentelemetry_go_otel_exporters_otlp_otlptrace_otlptracegrpc", "io_opentelemetry_go_otel_exporters_stdout_stdoutmetric", "io_opentelemetry_go_otel_exporters_stdout_stdouttrace", "io_opentelemetry_go_otel_metric", "io_opentelemetry_go_otel_sdk", "io_opentelemetry_go_otel_sdk_metric", "io_opentelemetry_go_otel_trace", "org_golang_google_grpc", "org_golang_google_grpc_security_advancedtls", "org_golang_google_protobuf", "org_golang_x_crypto", "org_golang_x_oauth2", "org_golang_x_sync", "org_golang_x_term", "org_golang_x_time")
+use_repo(go_deps, "com_connectrpc_connect", "com_github_alicebob_miniredis_v2", "com_github_aws_aws_sdk_go_v2", "com_github_aws_aws_sdk_go_v2_config", "com_github_aws_aws_sdk_go_v2_credentials", "com_github_aws_aws_sdk_go_v2_service_s3", "com_github_clipperhouse_uax29_v2", "com_github_coreos_go_oidc_v3", "com_github_creack_pty", "com_github_creativeprojects_go_selfupdate", "com_github_crewjam_saml", "com_github_gin_contrib_cors", "com_github_gin_gonic_gin", "com_github_go_acme_lego_v4", "com_github_go_git_go_git_v5", "com_github_go_ldap_ldap_v3", "com_github_golang_jwt_jwt_v5", "com_github_golang_migrate_migrate_v4", "com_github_google_uuid", "com_github_gorilla_websocket", "com_github_kardianos_service", "com_github_lib_pq", "com_github_masterminds_semver_v3", "com_github_mattn_go_runewidth", "com_github_maxmind_mmdbwriter", "com_github_ndolestudio_lemonsqueezy_go", "com_github_oschwald_maxminddb_golang", "com_github_pelletier_go_toml_v2", "com_github_pkg_browser", "com_github_redis_go_redis_extra_redisotel_v9", "com_github_redis_go_redis_v9", "com_github_resend_resend_go_v2", "com_github_robfig_cron_v3", "com_github_smartwalle_alipay_v3", "com_github_spf13_viper", "com_github_stretchr_testify", "com_github_stripe_stripe_go_v76", "com_github_thejerf_suture_v4", "com_github_uptrace_opentelemetry_go_extra_otelgorm", "com_github_userexistserror_conpty", "com_github_wechatpay_apiv3_wechatpay_go", "com_github_yuin_goldmark", "in_gopkg_yaml_v3", "io_gorm_driver_postgres", "io_gorm_driver_sqlite", "io_gorm_gorm", "io_gorm_plugin_dbresolver", "io_opentelemetry_go_contrib_instrumentation_github_com_gin_gonic_gin_otelgin", "io_opentelemetry_go_contrib_instrumentation_google_golang_org_grpc_otelgrpc", "io_opentelemetry_go_contrib_instrumentation_net_http_otelhttp", "io_opentelemetry_go_otel", "io_opentelemetry_go_otel_exporters_otlp_otlpmetric_otlpmetricgrpc", "io_opentelemetry_go_otel_exporters_otlp_otlptrace_otlptracegrpc", "io_opentelemetry_go_otel_exporters_stdout_stdoutmetric", "io_opentelemetry_go_otel_exporters_stdout_stdouttrace", "io_opentelemetry_go_otel_metric", "io_opentelemetry_go_otel_sdk", "io_opentelemetry_go_otel_sdk_metric", "io_opentelemetry_go_otel_trace", "org_golang_google_grpc", "org_golang_google_grpc_security_advancedtls", "org_golang_google_protobuf", "org_golang_x_crypto", "org_golang_x_oauth2", "org_golang_x_sync", "org_golang
```

**File**: `build_defs/web/vitest.bzl` (modified, +4/-2)
```diff
@@ -19,7 +19,8 @@ def vitest_test(
         size = "medium",
         timeout = None,
         tags = None,
-        chdir = None):
+        chdir = None,
+        extra_args = None):
     """Run `vitest run` against a set of sources as a Bazel test.
 
     Args:
@@ -33,6 +34,7 @@ def vitest_test(
         timeout: Optional timeout string.
         tags: Bazel tags forwarded verbatim.
         chdir: Working directory (defaults to package path).
+        extra_args: Optional Vitest CLI arguments, for example coverage flags.
     """
     kwargs = {}
     if timeout:
@@ -48,7 +50,7 @@ def vitest_test(
             config,
             "--reporter=default",
             "--no-color",
-        ],
+        ] + (extra_args or []),
         data = (data or []) + srcs + [config] + (deps or []) + [
             "//:node_modules/vitest",
         ],
```

**File**: `clients/core/crates/node-bridge/index.d.ts` (modified, +8/-3)
```diff
@@ -41,6 +41,7 @@ export class AppState {
   appAutopilotUpdateThinkingProto(reqBytes: Array<number>): void
   appAvailableRunnersJson(): string
   appAvailableRunnersProto(): Array<number>
+  appChannelAdvanceLastRead(channelId: number, messageId: number): void
   appChannelApplyFetchedChannel(respBytes: Array<number>): void
   appChannelApplyFetchedChannels(respBytes: Array<number>): void
   appChannelApplyFetchedMembers(channelId: number, respBytes: Array<number>): void
@@ -49,6 +50,7 @@ export class AppState {
   appChannelApplyFetchedPods(channelId: number, respBytes: Array<number>): void
   appChannelApplyMessageEdited(reqBytes: Array<number>): void
   appChannelClearUnread(channelId: number): void
+  appChannelGetLastReadId(channelId: number): number
   appChannelInsertChannel(reqBytes: Array<number>): void
   appChannelInsertMessage(reqBytes: Array<number>): void
   appChannelMentionCountsJson(): string
@@ -156,10 +158,14 @@ export class AppState {
   channelEditChannelMessageConnect(request: Array<number>): Promise<Array<number>>
   channelGetChannelConnect(request: Array<number>): Promise<Array<number>>
   channelGetChannelUnreadCountsConnect(request: Array<number>): Promise<Array<number>>
+  channelGetMessageReadByConnect(request: Array<number>): Promise<Array<number>>
   channelListChannelMembersConnect(request: Array<number>): Promise<Array<number>>
   channelListChannelMessagesConnect(request: Array<number>): Promise<Array<number>>
   channelListChannelsConnect(request: Array<number>): Promise<Array<number>>
   channelMarkChannelReadConnect(request: Array<number>): Promise<Array<number>>
+  channelMarkChannelUnreadConnect(request: Array<number>): Promise<Array<number>>
+  channelMuteChannelConnect(request: Array<number>): Promise<Array<number>>
+  channelPinChannelConnect(request: Array<number>): Promise<Array<number>>
   channelSendChannelMessageConnect(request: Array<number>): Promise<Array<number>>
   channelUnarchiveChannelConnect(request: Array<number>): Promise<Array<number>>
   channelUpdateChannelConnect(request: Array<number>): Promise<Array<number>>
@@ -227,19 +233,18 @@ export class AppState {
   promocodeGetRedemptionHistoryConnect(request: Array<number>): Promise<Array<number>>
   promocodeRedeemPromoCodeConnect(request: Array<number>): Promise<Array<number>>
   promocodeValidatePromoCodeConnect(request: Array<number>): Promise<Array<number>>
+  relayBindPodListeners(podKey: string, onStatus: (err: unknown, arg: string) => void, onAcp: (err: unknown, arg: string) => void, listenerLeaseId: string): Promise<number>
   relayDisconnect(podKey: string): Promise<void>
   relayDisconnectAll(): Promise<void>
   relayForceResize(podKey: string, cols: number, rows: number): Promise<void>
   relayGetPodSize(podKey: string): Promise<Array<number>>
   relayGetStatus(podKey: string): Promise<string>
   relayIsRunnerDisconnected(podKey: string): Promise<boolean>
-  relayOnAcpMessage(podKey: string, onAcp: (err: unknown, arg: string) => void): Promise<void>
   relayOnPodDisconnected(onDisconnect: (err: unknown, arg: string) => void): Promise<void>
-  relayOnStatusChange(podKey: string, onStatus: (err: unknown, arg: string) => void): Promise<void>
   relaySend(podKey: string, data: string): Promise<void>
   relaySendAcpCommand(podKey: string, command: string): Promise<void>
   relaySendResize(podKey: string, cols: number, rows: number): Promise<void>
-  relaySubscribe(podKey: string, subscriptionId: string, relayUrl: string, token: string, onOutput: (err: unknown, arg: Array<number>) => void): Promise<void>
+  relaySubscribe(podKey: string, subscriptionId: string, relayUrl: string, token: string, onOutput: (err: unknown, arg: Array<number>) => void, onStatus: (err: unknown, arg: string) => void, onAcp: (err: unknown, arg: string) => void, onBound: (err: unknown, arg: number) => void, listenerLeaseId: string): Promise<void>
   relayUnsubscribe(podKey: string, subscriptionId: string): Promise<void>
   runnerAuthorizeRunner(requestBytes: Array<number>): Promise<Array<number>>
   runnerGetAuthStatus(requestBytes: Array<number>): Promise<Array<number>>
```

**File**: `clients/core/crates/node-bridge/src/commands/relay.rs` (modified, +53/-63)
```diff
@@ -1,12 +1,10 @@
-use std::sync::Arc;
-
-use agentsmesh_protocol::MsgType;
-use agentsmesh_relay::{AcpCallback, DisconnectCallback, OutputCallback, RelayStatusInfo, StatusCallback};
-use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
+use napi::threadsafe_function::ThreadsafeFunction;
 use napi_derive::napi;
 
 use crate::AppState;
 
+mod listener_callbacks;
+
 // Terminal data-plane relay surface over the shared `RelayConnectionPool` (the
 // SSOT). The pool runs natively in the main process; `main/relay.ts` provides
 // the `on_output`/`on_status`/`on_acp` ThreadsafeFunctions that fan bytes out to
@@ -27,17 +25,46 @@ impl AppState {
         relay_url: String,
         token: String,
         on_output: ThreadsafeFunction<Vec<u8>>,
+        on_status: ThreadsafeFunction<String>,
+        on_acp: ThreadsafeFunction<String>,
+        on_bound: ThreadsafeFunction<u32>,
+        listener_lease_id: String,
     ) -> napi::Result<()> {
-        let cb = Arc::new(on_output);
-        let output_cb: OutputCallback = Arc::new(move |data: Vec<u8>| {
-            cb.call(Ok(data), ThreadsafeFunctionCallMode::NonBlocking);
-        });
         self.relay
-            .subscribe(&pod_key, &subscription_id, &relay_url, &token, output_cb)
-            .await;
+            .subscribe_ready_with_listeners(
+                &pod_key,
+                &subscription_id,
+                &relay_url,
+                &token,
+                listener_callbacks::output(on_output),
+                &listener_lease_id,
+                listener_callbacks::generation_status(on_status),
+                listener_callbacks::generation_acp(on_acp),
+                listener_callbacks::bound(on_bound),
+            )
+            .await
+            .map_err(err)?;
         Ok(())
     }
 
+    /// Rebind the desktop fan-out callbacks to the currently active driver.
+    /// Returns 0 when a subscribe has not published that driver yet.
+    #[napi]
+    pub async fn relay_bind_pod_listeners(
+        &self,
+        pod_key: String,
+        on_status: ThreadsafeFunction<String>,
+        on_acp: ThreadsafeFunction<String>,
+        listener_lease_id: String,
+    ) -> u32 {
+        self.relay.bind_listeners_if_active(
+            &pod_key,
+            &listener_lease_id,
+            listener_callbacks::generation_status(on_status),
+            listener_callbacks::generation_acp(on_acp),
+        )
+    }
+
     #[napi]
     pub async fn relay_unsubscribe(&self, pod_key: String, subscription_id: String) {
         self.relay.unsubscribe(&pod_key, &subscription_id).await;
@@ -59,9 +86,16 @@ impl AppState {
     }
 
     #[napi]
-    pub async fn relay_send_acp_command(&self, pod_key: String, command: String) -> napi::Result<()> {
+    pub async fn relay_send_acp_command(
+        &self,
+        pod_key: String,
+        command: String,
+    ) -> napi::Result<()> {
         let val: serde_json::Value = serde_json::from_str(&command).map_err(err)?;
-        self.relay.send_acp_command(&pod_key, &val).await.map_err(err)
+        self.relay
+            .send_acp_command(&pod_key, &val)
+            .await
+            .map_err(err)
     }
 
     #[napi]
@@ -94,61 +128,17 @@ impl AppState {
             .unwrap_or_default()
     }
 
-    /// Status callback delivers `{"status","runnerDisconnected"}` JSON; main
-    /// forwards to the renderer as a `relay:status` IPC event.
-    #[napi]
-    pub async fn relay_on_status_change(
-        &self,
-        pod_key: String,
-        on_status: ThreadsafeFunction<String>,
-    ) -> napi::Result<()> {
-        let cb = Arc::new(on_status);
-        let listener: StatusCallback = Arc::new(move |info: RelayStatusInfo| {
-            let json = serde_json::json!({
-                "status": info.status.to_string(),
-                "runnerDisconnected": info.runner_disconnected,
-            })
-            .to_string();
-            cb.call(Ok(json), ThreadsafeFunctionCallMode::NonBlocking);
-        });
-        self.relay.on_status_change(&pod_key, listener).await;
-        Ok(())
-    }
-
-    /// ACP callback delivers `{"msgType","payload"}` JSON; main forwards as a
-    /// `relay:acp` IPC event for the renderer's ACP dispatcher.
-    #[napi]
-    pub async fn relay_on_acp_message(
-        &self,
-        pod_key: String,
-        on_acp: ThreadsafeFunction<String>,
-    ) -> napi::Result<()> {
-        let cb = Arc::new(on_acp);
-        let listener: AcpCallback = Arc::new(move |msg_type: MsgType, payload: serde_json::Value| {
-            let json = serde_json::json!({
-                "msgType": msg_type as u8,
-                "payload": payload,
-            })
-            .to_string();
-            cb.call(Ok(json), ThreadsafeFunctionCallMode::NonBlocking);
-        });
-        self.relay.on_acp_message(&pod_key, listener).await;
-        Ok(())
-    }
-
-    /// Pod-disconnected sink — `(podKey: string) => void`; main forwards as a
-    /// `re
```

**File**: `clients/core/crates/node-bridge/src/commands/relay/listener_callbacks.rs` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+use std::sync::Arc;
+
+use agentsmesh_protocol::MsgType;
+use agentsmesh_relay::{
+    GenerationAcpCallback, GenerationDisconnectCallback, GenerationStatusCallback, OutputCallback,
+    RelayStatusInfo,
+};
+use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
+
+pub(super) fn output(on_output: ThreadsafeFunction<Vec<u8>>) -> OutputCallback {
+    let callback = Arc::new(on_output);
+    output_with(move |data| {
+        callback.call(Ok(data), ThreadsafeFunctionCallMode::NonBlocking);
+    })
+}
+
+pub(super) fn bound(on_bound: ThreadsafeFunction<u32>) -> Arc<dyn Fn(u32) + Send + Sync> {
+    bound_with(move |generation| {
+        on_bound.call(Ok(generation), ThreadsafeFunctionCallMode::NonBlocking);
+    })
+}
+
+pub(super) fn generation_status(on_status: ThreadsafeFunction<String>) -> GenerationStatusCallback {
+    let callback = Arc::new(on_status);
+    generation_status_with(move |json| {
+        callback.call(Ok(json), ThreadsafeFunctionCallMode::NonBlocking);
+    })
+}
+
+pub(super) fn generation_acp(on_acp: ThreadsafeFunction<String>) -> GenerationAcpCallback {
+    let callback = Arc::new(on_acp);
+    generation_acp_with(move |json| {
+        callback.call(Ok(json), ThreadsafeFunctionCallMode::NonBlocking);
+    })
+}
+
+pub(super) fn generation_disconnect(
+    on_disconnect: ThreadsafeFunction<String>,
+) -> GenerationDisconnectCallback {
+    let callback = Arc::new(on_disconnect);
+    generation_disconnect_with(move |json| {
+        callback.call(Ok(json), ThreadsafeFunctionCallMode::NonBlocking);
+    })
+}
+
+fn output_with(emit: impl Fn(Vec<u8>) + Send + Sync + 'static) -> OutputCallback {
+    Arc::new(emit)
+}
+
+fn bound_with(emit: impl Fn(u32) + Send + Sync + 'static) -> Arc<dyn Fn(u32) + Send + Sync> {
+    Arc::new(emit)
+}
+
+fn generation_status_with(
+    emit: impl Fn(String) + Send + Sync + 'static,
+) -> GenerationStatusCallback {
+    Arc::new(move |generation, info: RelayStatusInfo| {
+        let json = serde_json::json!({
+            "generation": generation,
+            "revision": info.revision,
+            "status": info.status.to_string(),
+            "runnerDisconnected": info.runner_disconnected,
+        })
+        .to_string();
+        emit(json);
+    })
+}
+
+fn generation_acp_with(emit: impl Fn(String) + Send + Sync + 'static) -> GenerationAcpCallback {
+    Arc::new(move |generation, msg_type: MsgType, payload| {
+        let json = serde_json::json!({
+            "generation": generation,
+            "msgType": msg_type as u8,
+            "payload": payload,
+        })
+        .to_string();
+        emit(json);
+    })
+}
+
+fn generation_disconnect_with(
+    emit: impl Fn(String) + Send + Sync + 'static,
+) -> GenerationDisconnectCallback {
+    Arc::new(move |pod_key, generation| {
+        let json = serde_json::json!({
+            "podKey": pod_key,
+            "generation": generation,
+        })
+        .to_string();
+        emit(json);
+    })
+}
+
+#[cfg(test)]
+mod tests {
+    use std::sync::Mutex;
+
+    use agentsmesh_relay::RelayStatus;
+
+    use super::*;
+
+    #[test]
+    fn output_and_bound_adapters_preserve_values() {
+        let output = Arc::new(Mutex::new(Vec::new()));
+        let captured = Arc::clone(&output);
+        output_with(move |data| captured.lock().unwrap().push(data))(vec![0, 1, 255]);
+        assert_eq!(*output.lock().unwrap(), vec![vec![0, 1, 255]]);
+
+        let bound = Arc::new(Mutex::new(Vec::new()));
+        let captured = Arc::clone(&bound);
+        bound_with(move |generation| captured.lock().unwrap().push(generation))(19);
+        assert_eq!(*bound.lock().unwrap(), vec![19]);
+    }
+
+    #[test]
+    fn generation_status_serializes_the_complete_ordering_contract() {
+        let events = Arc::new(Mutex::new(Vec::new()));
+        let captured = Arc::clone(&events);
+        let callback = generation_status_with(move |json| captured.lock().unwrap().push(json));
+        callback(
+            7,
+            RelayStatusInfo {
+                status: RelayStatus::Connecting,
+                runner_disconnected: true,
+                revision: 23,
+            },
+        );
+
+        let value: serde_json::Value = serde_json::from_str(&events.lock().unwrap()[0]).unwrap();
+        assert_eq!(
+            value,
+            serde_json::json!({
+                "generation": 7,
+                "revision": 23,
+                "status": "connecting",
+                "runnerDisconnected": true,
+            })
+        );
+    }
+
+    #[test]
+    fn generation_acp_and_disconnect_payloads_keep_their_generation() {
+        let acp_events = Arc::new(Mutex::new(Vec::new()));
+        let captured = Arc::clone(&acp_events);
+        generation_acp_with(move |json| captured.lock().unwrap().push(json))(
+            11,
+            MsgType::AcpEvent,
+            serde_json::json!({"event": "started"}),
+        );
+        let acp: se
```

**File**: `clients/core/crates/relay/BUILD.bazel` (modified, +15/-1)
```diff
@@ -30,8 +30,9 @@ rust_library(
 rust_test(
     name = "relay_test",
     crate = ":relay",
+    data = ["//proto/testdata/terminal_snapshot:fixtures"],
     edition = "2021",
-    # integration_tests.rs spins a real tokio + tungstenite WS server per test
+    # Integration tests spin up a real tokio + tungstenite WS server per test.
     # (one current-thread runtime per #[tokio::test] thread). Under the default
     # all-at-once parallelism these contend for the CPU and the server-drop
     # reconnect test starves past its wall-clock budget. Serialize: the 76 unit
@@ -44,3 +45,16 @@ rust_test(
         "@crates//:tokio-tungstenite",
     ],
 )
+
+sh_binary(
+    name = "check_lcov_coverage",
+    srcs = ["check_lcov_coverage.sh"],
+    data = glob(["src/**/*.rs"]),
+    visibility = ["//visibility:public"],
+)
+
+sh_test(
+    name = "check_lcov_coverage_test",
+    srcs = ["check_lcov_coverage_test.sh"],
+    data = [":check_lcov_coverage"],
+)
```

**File**: `clients/core/crates/relay/check_lcov_coverage.sh` (added, +197/-0)
```diff
@@ -0,0 +1,197 @@
+#!/usr/bin/env bash
+set -euo pipefail
+usage() {
+  echo "usage: $0 <combined-lcov-file> [minimum-aggregate-line-percent] [minimum-file-line-percent]" >&2
+  exit 2
+}
+[[ $# -ge 1 && $# -le 3 ]] || usage
+report=$1
+aggregate_threshold=${2:-95}
+file_threshold=${3:-95}
+[[ -f "$report" ]] || {
+  echo "coverage report does not exist: $report" >&2
+  exit 2
+}
+for threshold_name in aggregate file; do
+  if [[ "$threshold_name" == aggregate ]]; then
+    threshold=$aggregate_threshold
+  else
+    threshold=$file_threshold
+  fi
+  awk -v value="$threshold" 'BEGIN {
+    if (value !~ /^[0-9]+([.][0-9]+)?$/ || value < 0 || value > 100) exit 1
+  }' || {
+    echo "$threshold_name coverage threshold must be a number between 0 and 100: $threshold" >&2
+    exit 2
+  }
+done
+script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
+if [[ -n "${TEST_SRCDIR:-}" && -n "${TEST_WORKSPACE:-}" && -d "${TEST_SRCDIR}/${TEST_WORKSPACE}/clients/core/crates/relay/src" ]]; then
+  workspace="${TEST_SRCDIR}/${TEST_WORKSPACE}"
+elif [[ -n "${BUILD_WORKSPACE_DIRECTORY:-}" ]]; then
+  workspace=$BUILD_WORKSPACE_DIRECTORY
+else
+  workspace=$(cd "$script_dir/../../../.." && pwd)
+fi
+source_root="$workspace/clients/core/crates/relay/src"
+[[ -d "$source_root" ]] || {
+  echo "relay source directory does not exist: $source_root" >&2
+  exit 2
+}
+manifest=$(mktemp "${TMPDIR:-/tmp}/agentsmesh-relay-coverage.XXXXXX")
+trap 'rm -f "$manifest"' EXIT
+while IFS= read -r source; do
+  relative=${source#"$workspace/"}
+  printf 'F\t%s\n' "$relative" >>"$manifest"
+  awk -v relative="$relative" '
+    /LCOV_EXCL_START: test-only code/ {
+      if (inside) {
+        printf "%s:%d: nested LCOV_EXCL_START\n", relative, NR > "/dev/stderr"
+        invalid = 1
+      }
+      inside = 1
+      start = NR
+    }
+    /^[[:space:]]*#\[cfg\(.*test/ && !inside {
+      printf "%s:%d: cfg(test) must be inside explicit LCOV exclusion markers\n", relative, NR > "/dev/stderr"
+      invalid = 1
+    }
+    /LCOV_EXCL_STOP/ {
+      if (!inside) {
+        printf "%s:%d: LCOV_EXCL_STOP without a start marker\n", relative, NR > "/dev/stderr"
+        invalid = 1
+      } else {
+        printf "X\t%s\t%d\t%d\n", relative, start, NR
+        inside = 0
+      }
+    }
+    END {
+      if (inside) {
+        printf "%s:%d: unterminated LCOV exclusion marker\n", relative, start > "/dev/stderr"
+        invalid = 1
+      }
+      exit invalid
+    }
+  ' "$source" >>"$manifest"
+done < <(find -L "$source_root" -type f -name '*.rs' -print | sort)
+# A missed line in a tiny adapter can represent its entire failure path. Such
+# files require full coverage instead of being rounded through the 95% floor.
+awk -F '\t' \
+  -v prefix='clients/core/crates/relay/src/' \
+  -v aggregate_threshold="$aggregate_threshold" \
+  -v file_threshold="$file_threshold" \
+  -v tiny_file_max_lines=10 '
+  NR == FNR {
+    if ($1 == "F") {
+      known[$2] = 1
+      if (!is_separate_test_file($2)) {
+        production_files[++production_file_count] = $2
+      }
+    } else if ($1 == "X") {
+      for (line = $3; line <= $4; line++) {
+        excluded[$2 SUBSEP line] = 1
+      }
+    }
+    next
+  }
+
+  function normalized_source(raw, position) {
+    position = index(raw, prefix)
+    return position ? substr(raw, position) : ""
+  }
+
+  function is_separate_test_file(path, base) {
+    base = path
+    sub(/^.*\//, "", base)
+    return path ~ /\/integration_tests\// ||
+      base == "integration_tests.rs" ||
+      base ~ /_tests\.rs$/
+  }
+
+  /^SF:/ {
+    source = normalized_source(substr($0, 4))
+    whole_file_excluded = source != "" && is_separate_test_file(source)
+    if (source != "") {
+      seen[source] = 1
+      if (!(source in known)) {
+        printf "LCOV references an unknown relay source: %s\n", source > "/dev/stderr"
+        invalid = 1
+      }
+    }
+    next
+  }
+
+  /^DA:/ && source != "" {
+    split(substr($0, 4), fields, ",")
+    line_number = fields[1] + 0
+    hit_count = fields[2] + 0
+    if (whole_file_excluded || excluded[source SUBSEP line_number]) {
+      next
+    }
+    key = source SUBSEP line_number
+    measured[key] = 1
+    source_for[key] = source
+    if (hit_count > hits[key]) {
+      hits[key] = hit_count
+    }
+    next
+  }
+
+  END {
+    for (i = 1; i <= production_file_count; i++) {
+      file = production_files[i]
+      if (!(file in seen)) {
+        printf "LCOV is missing relay production source: %s\n", file > "/dev/stderr"
+        invalid = 1
+      }
+    }
+    if (invalid) exit 2
+
+    for (key in measured) {
+      total++
+      file = source_for[key]
+      file_total[file]++
+      if (hits[key] > 0) {
+        covered++
+        file_covered[file]++
+      }
+    }
+    for (i = 1; i <= production_file_count; i++) {
+      if (file_total[production_files[i]] > 0) {
+        measured_file_count++
+      }
+    }
+    if (total == 0) {
+      print "coverage check foun
```

---

### Incident Patch 4: `38a5b0e1` (2026-07-24)
**Commit Message**: fix(channel): restore follow-to-bottom for new messages (v0.44.5 regression) (#468)

The v0.44.5 entry-scroll refactor seeded `isAtBottom` from the unread cursor
and re-derived it after every anchor via a live `isScrolledToBottom` DOM read
(onEntryAnchor). In real layout that read can run before content settles and
latch at-bottom to false, so streamed messages stop following into view and
only surface a pill — experienced as "new messages don't show".

Restore the proven v0.44.4 semantics: `isAtBottom` defaults true and is moved
only by real scroll events. Entry positioning still owns WHERE the viewport
lands (unread divider vs bottom); it no longer suppresses follow-to-bottom.
Drops the onEntryAnchor callback and the now-unused onAnchor plumbing.

Co-authored-by: yishuiliunian <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `clients/web/src/components/channel/__tests__/MessageList.scroll.test.tsx` (modified, +7/-10)
```diff
@@ -204,21 +204,18 @@ describe("MessageList entry scroll", () => {
     expect(Element.prototype.scrollIntoView).not.toHaveBeenCalledWith({ block: "start", behavior: "instant" });
   });
 
-  it("does not follow a message that streams in before the unread cursor resolves", async () => {
-    // Unknown cursor: entryAnchorResolved false, firstUnreadId not yet known.
+  it("follows streamed messages by default (at-bottom seed), then anchors the divider on cursor resolve", async () => {
+    // Entry seeds isAtBottom=true so a streamed message follows into view rather
+    // than silently showing only a pill — the v0.44.5 regression was seeding it
+    // false and latching it there via a fragile post-anchor scroll read.
     const { rerender } = renderList({ messages: [msg(10), msg(11), msg(12)], firstUnreadId: null, entryAnchorResolved: false });
-    // Flush the channel-switch seed microtask (setIsAtBottom(false) for an
-    // unknown cursor). In the real app this microtask always runs before the
-    // next macrotask — i.e. before any streamed message can arrive.
-    await act(async () => { await Promise.resolve(); });
+    await act(async () => { await Promise.resolve(); }); // flush the channel-switch seed microtask
     vi.mocked(Element.prototype.scrollIntoView).mockClear();
 
-    // A message arrives during the fetchUnreadCounts window. It must NOT auto-
-    // follow to the bottom — that would trip userInterrupted and lose the divider.
     rerender(<MessageList messages={[msg(10), msg(11), msg(12), msg(13)]} loading={false} channelId={1} firstUnreadId={null} entryAnchorResolved={false} />);
-    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
+    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
 
-    // Cursor resolves to a divider — entry now anchors straight to it.
+    // Once the cursor resolves to an unread divider, entry positioning anchors it.
     rerender(<MessageList messages={[msg(10), msg(11), msg(12), msg(13)]} loading={false} channelId={1} firstUnreadId={11} entryAnchorResolved />);
     const divider = screen.getByRole("separator");
     expect(divider.scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
```

**File**: `clients/web/src/components/channel/useMessageEntryPosition.ts` (modified, +3/-11)
```diff
@@ -15,9 +15,6 @@ interface UseMessageEntryPositionOptions {
   containerRef: RefObject<HTMLDivElement | null>;
   contentRef: RefObject<HTMLDivElement | null>;
   bottomRef: RefObject<HTMLDivElement | null>;
-  // Fires when an anchor lands, so the caller can sync at-bottom state to the
-  // real landed position (a divider at scrollTop 0 emits no correcting scroll).
-  onAnchor?: () => void;
 }
 
 // Entry "settles" once content height holds steady this long (a ResizeObserver
@@ -34,7 +31,6 @@ export function useMessageEntryPosition({
   containerRef,
   contentRef,
   bottomRef,
-  onAnchor,
 }: UseMessageEntryPositionOptions) {
   const firstId = messages[0]?.id ?? null;
   const lastId = messages[messages.length - 1]?.id ?? null;
@@ -110,8 +106,7 @@ export function useMessageEntryPosition({
     state.lastAppliedKey = anchorKey;
     state.anchoredLastId = lastId;
     state.target = target;
-    onAnchor?.();
-  }, [anchorKey, bottomRef, channelId, containerRef, entryAnchorResolved, firstUnreadId, lastId, loading, loadingMore, messages.length, onAnchor]);
+  }, [anchorKey, bottomRef, channelId, containerRef, entryAnchorResolved, firstUnreadId, lastId, loading, loadingMore, messages.length]);
 
   // Re-anchor on content growth (late images/embeds) and mark settled once the
   // reflow goes quiet — a debounced quiescence signal, reset on every resize.
@@ -132,10 +127,7 @@ export function useMessageEntryPosition({
         state.resizeFrame = null;
         if (state.userInterrupted || state.settled) return;
         const target = scrollToEntryAnchor(containerRef.current, bottomRef.current, liveRef.current.firstUnreadId, state);
-        if (target) {
-          state.target = target;
-          onAnchor?.();
-        }
+        if (target) state.target = target;
       });
     });
     observer.observe(content);
@@ -145,5 +137,5 @@ export function useMessageEntryPosition({
       if (state.resizeFrame != null) cancelAnimationFrame(state.resizeFrame);
       state.resizeFrame = null;
     };
-  }, [bottomRef, channelId, containerRef, contentRef, onAnchor]);
+  }, [bottomRef, channelId, containerRef, contentRef]);
 }
```

**File**: `clients/web/src/components/channel/useMessageListScroll.ts` (modified, +5/-20)
```diff
@@ -83,31 +83,17 @@ export function useMessageListScroll({
     let cancelled = false;
     queueMicrotask(() => {
       if (cancelled) return;
-      // Seed at-bottom ONLY when the cursor is resolved AND there is no unread.
-      // An unknown cursor must not seed `true`: a message streamed in during the
-      // unread-summary fetch would then auto-follow to the bottom, trip the entry
-      // hook's scroll listener (userInterrupted), and permanently defeat the
-      // divider once the cursor resolves. onEntryAnchor corrects this once an
-      // anchor actually lands.
-      setIsAtBottom(entryAnchorResolved && firstUnreadId == null);
+      // Default to at-bottom so a streamed message follows into view; real scroll
+      // events (handleScroll) flip it to false once the user scrolls up. Entry
+      // positioning owns WHERE the viewport lands (divider vs bottom); it must not
+      // also suppress follow-to-bottom, or new messages silently stop appearing.
+      setIsAtBottom(true);
       setNewMessageCount(0);
       setMentionBelowId(null);
     });
     return () => { cancelled = true; };
-    // firstUnreadId / entryAnchorResolved intentionally excluded: this seeds on
-    // channel switch only; a late resolve must not re-run and clobber a live
-    // isAtBottom.
-    // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [channelId]);
 
-  // When entry positioning lands an anchor, sync isAtBottom to where it actually
-  // landed so the FAB/pill and the append-follow decision agree with it — in
-  // particular a divider anchored at scrollTop 0 fires no scroll event to correct
-  // a stale seed, which would otherwise hide the FAB and let a stream yank down.
-  const onEntryAnchor = useCallback(() => {
-    setIsAtBottom(isScrolledToBottom(containerRef.current));
-  }, []);
-
   useMessageEntryPosition({
     channelId,
     messages,
@@ -118,7 +104,6 @@ export function useMessageListScroll({
     containerRef,
     contentRef,
     bottomRef,
-    onAnchor: onEntryAnchor,
   });
 
   useEffect(() => {
```

---

### Incident Patch 5: `13151fc5` (2026-07-23)
**Commit Message**: fix(channel): robust entry scroll & unread-divider positioning (#466)

Entering a channel lands reliably at the unread divider (or the latest
message for read channels) without regressing the stick-to-bottom chat
behavior.

- Make entry positioning resilient to cached/fresh/late-reflow windows via
  a ResizeObserver quiescence signal; extract the scroll primitives into
  entryAnchorScroll.ts and the state machine into useMessageEntryPosition.
- Decide follow-to-bottom from the PRE-append at-bottom state, so a tall
  streamed message no longer strands the viewport.
- Seed at-bottom only once the unread cursor resolves, so a message arriving
  during the unread-summary fetch can't yank an unread channel to the bottom
  and permanently lose the divider.
- A load-more prepend adopts the new window key without re-anchoring, instead
  of fighting the scroll-position restore.
- Freeze the unread cursor and delay mark-read until the entry anchor
  resolves (useChannelEntryAnchor / useChannelEntryMarkRead).
- Keep BottomPanel channel selection panel-local (ephemeral peek surface).

Adds unit coverage (MessageList.scroll, useChannelEntryMarkRead,
BottomPanel.channel-selection) and fixes a te

**File**: `clients/web/src/components/channel/ChannelChatPanel.tsx` (modified, +1/-0)
```diff
@@ -70,6 +70,7 @@ export function ChannelChatPanel({ channelId }: ChannelChatPanelProps) {
                 currentUserId={chat.currentUserId}
                 channelId={channelId}
                 firstUnreadId={chat.firstUnreadId}
+                entryAnchorResolved={chat.entryAnchorResolved}
                 roleByUserId={chat.roleByUserId}
                 onEditMessage={chat.handleEditMessage}
                 onDeleteMessage={chat.handleDeleteMessage}
```

**File**: `clients/web/src/components/channel/MessageList.tsx` (modified, +58/-53)
```diff
@@ -22,22 +22,25 @@ interface MessageListProps {
   currentUserId?: number;
   channelId?: number;
   firstUnreadId?: number | null;
+  // Whether the unread cursor is resolved. Entry positioning waits for this so
+  // an unknown cursor doesn't scroll to the bottom and then jump to the divider.
+  entryAnchorResolved?: boolean;
   roleByUserId?: Map<number, string>;
   onEditMessage?: (messageId: number, payload: MessageEditPayload) => Promise<void>;
   onDeleteMessage?: (messageId: number) => Promise<void>;
 }
 
 export function MessageList({
   messages, loading, loadingMore, hasMore, error,
-  onLoadMore, onRetry, currentUserId, channelId, firstUnreadId, roleByUserId,
+  onLoadMore, onRetry, currentUserId, channelId, firstUnreadId, entryAnchorResolved = true, roleByUserId,
   onEditMessage, onDeleteMessage,
 }: MessageListProps) {
   const t = useTranslations("channels.messages");
   const allPods = usePods();
   const {
-    containerRef, bottomRef, isAtBottom, newMessageCount, mentionBelowId,
+    containerRef, contentRef, bottomRef, isAtBottom, newMessageCount, mentionBelowId,
     handleScroll, scrollToBottom, scrollToMessage,
-  } = useMessageListScroll({ messages, loading, loadingMore, channelId, firstUnreadId, currentUserId });
+  } = useMessageListScroll({ messages, loading, loadingMore, channelId, firstUnreadId, entryAnchorResolved, currentUserId });
 
   const sentinelRef = useRef<HTMLDivElement>(null);
   const onLoadMoreRef = useRef(onLoadMore);
@@ -91,57 +94,59 @@ export function MessageList({
         onScroll={handleScroll}
         data-testid="channel-message-list"
       >
-        {hasMore && <div ref={sentinelRef} className="h-1" />}
-        {loadingMore && (
-          <div className="flex justify-center py-3">
-            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
-          </div>
-        )}
-
-        {dateGroups.map((dateGroup) => (
-          <div key={dateGroup.date}>
-            <div className="flex justify-center py-2">
-              <span className="text-[11px] text-muted-foreground">— {dateGroup.date} —</span>
+        <div ref={contentRef} className="flex min-h-full flex-col">
+          {hasMore && <div ref={sentinelRef} className="h-1" />}
+          {loadingMore && (
+            <div className="flex justify-center py-3">
+              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
             </div>
-            {dateGroup.messages.map((message) => (
-              <Fragment key={message.id}>
-                {firstUnreadId === message.id && <UnreadDivider />}
-                <MessageRow
-                  message={message}
-                  allPods={allPods}
-                  currentUserId={currentUserId}
-                  channelId={channelId}
-                  isFirstInGroup={groupFlags.get(message.id) ?? true}
-                  role={message.user ? roleByUserId?.get(message.user.id) : undefined}
-                  onEditMessage={onEditMessage}
-                  onDeleteMessage={onDeleteMessage}
-                />
-              </Fragment>
-            ))}
-          </div>
-        ))}
-
-        {error && !loading && messages.length === 0 && (
-          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
-            <MessageSquare className="mb-4 h-12 w-12 opacity-30" />
-            <p className="text-sm text-destructive">{error}</p>
-            {onRetry && (
-              <button className="mt-2 text-xs text-primary hover:underline" onClick={onRetry}>
-                {t("loadOlder")}
-              </button>
-            )}
-          </div>
-        )}
-
-        {messages.length === 0 && !loading && !error && (
-          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
-            <MessageSquare className="mb-4 h-12 w-12 opacity-30" />
-            <p className="text-sm">{t("noMessages")}</p>
-            <p className="mt-1 text-xs">{t("startConversation")}</p>
-          </div>
-        )}
-
-        <div ref={bottomRef} />
+          )}
+
+          {dateGroups.map((dateGroup) => (
+            <div key={dateGroup.date}>
+              <div className="flex justify-center py-2">
+                <span className="text-[11px] text-muted-foreground">— {dateGroup.date} —</span>
+              </div>
+              {dateGroup.messages.map((message) => (
+                <Fragment key={message.id}>
+                  {firstUnreadId === message.id && <UnreadDivider />}
+                  <MessageRow
+                    message={message}
+                    allPods={allPods}
+                    currentUserId={currentUserId}
+                    channelId={channelId}
+                    isFirstInGroup={groupFlags.get(message.id) ?? true}
+                    role={message.user ? roleByUserId?.get(message.user.id) : undefined}
+                    onEditMessage={onEditMessage}
+                    onDeleteMessage={onDelete
```

**File**: `clients/web/src/components/channel/MobileChannelChat.tsx` (modified, +1/-0)
```diff
@@ -108,6 +108,7 @@ export function MobileChannelChat({ channelId, onClose }: MobileChannelChatProps
             currentUserId={chat.currentUserId}
             channelId={channelId}
             firstUnreadId={chat.firstUnreadId}
+            entryAnchorResolved={chat.entryAnchorResolved}
             roleByUserId={chat.roleByUserId}
             onEditMessage={chat.handleEditMessage}
             onDeleteMessage={chat.handleDeleteMessage}
```

**File**: `clients/web/src/components/channel/__tests__/MessageList.scroll.test.tsx` (added, +240/-0)
```diff
@@ -0,0 +1,240 @@
+import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
+import { act, fireEvent, render, screen } from "@testing-library/react";
+import { MessageList } from "../MessageList";
+import type { TransformedMessage } from "../types";
+
+vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
+vi.mock("@/stores/pod", () => ({ usePods: () => [] }));
+
+let resizeCallback: ResizeObserverCallback | null = null;
+
+class TestResizeObserver {
+  observe = vi.fn();
+  unobserve = vi.fn();
+  disconnect = vi.fn();
+  constructor(callback: ResizeObserverCallback) {
+    resizeCallback = callback;
+  }
+}
+
+function msg(id: number): TransformedMessage {
+  return {
+    id,
+    body: `message ${id}`,
+    messageType: "text",
+    createdAt: "2026-01-01T12:00:00Z",
+    user: { id: 7, username: "dev" },
+  };
+}
+
+function renderList(props: Partial<React.ComponentProps<typeof MessageList>> = {}) {
+  return render(
+    <MessageList
+      messages={[msg(10), msg(11), msg(12)]}
+      loading={false}
+      channelId={1}
+      {...props}
+    />,
+  );
+}
+
+let rafCallbacks: FrameRequestCallback[] = [];
+function flushRaf() {
+  const pending = rafCallbacks;
+  rafCallbacks = [];
+  pending.forEach((cb) => cb(performance.now()));
+}
+
+describe("MessageList entry scroll", () => {
+  const originalRAF = global.requestAnimationFrame;
+  const originalCAF = global.cancelAnimationFrame;
+  const originalRO = global.ResizeObserver;
+  const originalScrollIntoView = Element.prototype.scrollIntoView;
+
+  beforeEach(() => {
+    vi.useFakeTimers();
+    resizeCallback = null;
+    rafCallbacks = [];
+    global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
+    global.requestAnimationFrame = ((cb: FrameRequestCallback) => {
+      rafCallbacks.push(cb);
+      return rafCallbacks.length;
+    }) as typeof requestAnimationFrame;
+    global.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
+    Element.prototype.scrollIntoView = vi.fn();
+  });
+
+  afterEach(() => {
+    vi.useRealTimers();
+    // Restore every global clobbered above. The fake requestAnimationFrame never
+    // invokes its callback, so leaking it into later test files in the same
+    // worker thread hangs their animations/userEvent flows (5s timeouts).
+    global.requestAnimationFrame = originalRAF;
+    global.cancelAnimationFrame = originalCAF;
+    global.ResizeObserver = originalRO;
+    Element.prototype.scrollIntoView = originalScrollIntoView;
+  });
+
+  it("scrolls to bottom on read-channel entry", () => {
+    renderList();
+
+    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "instant" });
+  });
+
+  it("scrolls the unread divider on unread entry", () => {
+    renderList({ firstUnreadId: 11 });
+
+    // getByRole("separator") is the UnreadDivider (the [data-unread-anchor]
+    // element); asserting on its own scrollIntoView proves the divider — not
+    // some other element — is what entry positioning scrolled to.
+    const divider = screen.getByRole("separator");
+    expect(divider.scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
+  });
+
+  it("waits for the anchor to resolve before the first scroll (no bottom→divider jump)", () => {
+    // Unknown cursor: entryAnchorResolved false, firstUnreadId not yet known.
+    const { rerender } = renderList({ firstUnreadId: null, entryAnchorResolved: false });
+    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
+
+    // Cursor resolves to an unread divider — now (and only now) it anchors,
+    // straight to the divider rather than bottom-then-jump.
+    rerender(
+      <MessageList messages={[msg(10), msg(11), msg(12)]} loading={false} channelId={1} firstUnreadId={11} entryAnchorResolved />,
+    );
+    const divider = screen.getByRole("separator");
+    expect(divider.scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
+  });
+
+  it("re-anchors when a fresh same-length message window arrives", () => {
+    const { rerender } = renderList({ messages: [msg(1), msg(2), msg(3)] });
+    vi.mocked(Element.prototype.scrollIntoView).mockClear();
+
+    rerender(<MessageList messages={[msg(4), msg(5), msg(6)]} loading={false} channelId={1} />);
+
+    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "instant" });
+  });
+
+  it("keeps bottom alignment when content resizes before user intent", () => {
+    renderList();
+    vi.mocked(Element.prototype.scrollIntoView).mockClear();
+
+    act(() => {
+      resizeCallback?.([], {} as ResizeObserver);
+      flushRaf();
+    });
+
+    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "instant" });
+  });
+
+  it("does not re-anchor after the user scrolls (native scrollbar / any source)", () => {
+    renderList();
+    vi.mocked(Element.prototype.scrollIntoView).mockClear();
+
+    // A scroll to
```

**File**: `clients/web/src/components/channel/__tests__/useChannelEntryAnchor.test.tsx` (modified, +50/-10)
```diff
@@ -1,5 +1,5 @@
 import { describe, it, expect, vi, beforeEach } from "vitest";
-import { renderHook } from "@testing-library/react";
+import { renderHook, waitFor } from "@testing-library/react";
 import { useChannelEntryAnchor } from "../useChannelEntryAnchor";
 import { getChannelState } from "@/lib/wasm-core";
 import type { TransformedMessage } from "../types";
@@ -12,27 +12,67 @@ const setCursor = (v: number) => vi.mocked(getChannelState().get_last_read_id).m
 describe("useChannelEntryAnchor", () => {
   beforeEach(() => vi.mocked(getChannelState().get_last_read_id).mockReset());
 
-  it("no known cursor (-1) → no divider", () => {
+  it("unknown cursor requests an unread summary before falling back", async () => {
     setCursor(-1);
-    const { result } = renderHook(() => useChannelEntryAnchor(1, msgs(10, 11, 12)));
-    expect(result.current).toBeNull();
+    const { result, rerender } = renderHook(
+      ({ attempted }) => useChannelEntryAnchor(1, msgs(10, 11, 12), attempted),
+      { initialProps: { attempted: false } },
+    );
+    expect(result.current).toEqual({ firstUnreadId: null, resolved: false, needsUnreadSummary: true });
+
+    rerender({ attempted: true });
+
+    await waitFor(() => {
+      expect(result.current).toEqual({ firstUnreadId: null, resolved: true, needsUnreadSummary: false });
+    });
   });
 
-  it("genuine 0 cursor → divider anchors at the first (all-unread) message", () => {
+  it("re-reads a now-known cursor once the summary fetch is attempted", async () => {
+    setCursor(-1);
+    const { result, rerender } = renderHook(
+      ({ attempted }) => useChannelEntryAnchor(1, msgs(10, 11, 12), attempted),
+      { initialProps: { attempted: false } },
+    );
+    expect(result.current.needsUnreadSummary).toBe(true);
+
+    // fetchUnreadCounts wrote the Rust cursor before resolving; flipping
+    // `attempted` re-runs the retry, which reads the now-known cursor.
+    setCursor(11);
+    rerender({ attempted: true });
+
+    await waitFor(() => {
+      expect(result.current).toEqual({ firstUnreadId: 12, resolved: true, needsUnreadSummary: false });
+    });
+  });
+
+  it("genuine 0 cursor anchors at the first message", () => {
     setCursor(0);
     const { result } = renderHook(() => useChannelEntryAnchor(2, msgs(10, 11, 12)));
-    expect(result.current).toBe(10);
+    expect(result.current).toEqual({ firstUnreadId: 10, resolved: true, needsUnreadSummary: false });
   });
 
-  it("cursor at 11 → divider at the first message after it", () => {
+  it("cursor at 11 anchors at the first message after it", () => {
     setCursor(11);
     const { result } = renderHook(() => useChannelEntryAnchor(3, msgs(10, 11, 12)));
-    expect(result.current).toBe(12);
+    expect(result.current).toEqual({ firstUnreadId: 12, resolved: true, needsUnreadSummary: false });
   });
 
-  it("fully read (cursor at latest) → no divider", () => {
+  it("fully read cursor has no divider", () => {
     setCursor(12);
     const { result } = renderHook(() => useChannelEntryAnchor(4, msgs(10, 11, 12)));
-    expect(result.current).toBeNull();
+    expect(result.current).toEqual({ firstUnreadId: null, resolved: true, needsUnreadSummary: false });
+  });
+
+  it("freezes the cursor for the current entry", () => {
+    setCursor(10);
+    const { result, rerender } = renderHook(() => useChannelEntryAnchor(5, msgs(10, 11, 12)));
+    expect(result.current.firstUnreadId).toBe(11);
+
+    // A known cursor is frozen for the entry: a later mark-read advancing it
+    // must not move the divider.
+    setCursor(12);
+    rerender();
+
+    expect(result.current.firstUnreadId).toBe(11);
   });
 });
```

**File**: `clients/web/src/components/channel/entryAnchorScroll.ts` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+export type EntryTarget = "bottom" | "unread";
+
+export interface EntryState {
+  userInterrupted: boolean;
+  settled: boolean;
+  lastAppliedKey: string | null;
+  anchoredLastId: number | null;
+  target: EntryTarget | null;
+  quiesceTimer: ReturnType<typeof setTimeout> | null;
+  resizeFrame: number | null;
+  // scrollTop we expect after our own programmatic scrollIntoView; the next
+  // scroll event matching it is ours, anything else is the user taking over.
+  expectedScrollTop: number | null;
+}
+
+export function createEntryState(): EntryState {
+  return {
+    userInterrupted: false,
+    settled: false,
+    lastAppliedKey: null,
+    anchoredLastId: null,
+    target: null,
+    quiesceTimer: null,
+    resizeFrame: null,
+    expectedScrollTop: null,
+  };
+}
+
+export function clearEntryTimers(state: EntryState) {
+  if (state.quiesceTimer) clearTimeout(state.quiesceTimer);
+  if (state.resizeFrame != null) cancelAnimationFrame(state.resizeFrame);
+  state.quiesceTimer = null;
+  state.resizeFrame = null;
+}
+
+export function scrollToEntryAnchor(
+  container: HTMLDivElement | null,
+  bottom: HTMLDivElement | null,
+  firstUnreadId: number | null | undefined,
+  state: EntryState,
+): EntryTarget | null {
+  const before = container?.scrollTop ?? null;
+  const anchor = firstUnreadId != null ? container?.querySelector("[data-unread-anchor]") : null;
+  if (anchor) {
+    anchor.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
+  } else if (bottom) {
+    bottom.scrollIntoView({ behavior: "instant" as ScrollBehavior });
+  } else {
+    return null;
+  }
+  // Arm the "this scroll is ours" guard ONLY if the position actually moved: a
+  // no-op scroll fires no scroll event, so a lingering expectedScrollTop would
+  // otherwise swallow a later real user scroll that lands on that same offset.
+  if (container) state.expectedScrollTop = container.scrollTop === before ? null : container.scrollTop;
+  return anchor ? "unread" : "bottom";
+}
```

**File**: `clients/web/src/components/channel/useChannelEntryAnchor.ts` (modified, +73/-28)
```diff
@@ -1,39 +1,84 @@
 "use client";
 
-import { useMemo, useRef } from "react";
+import { useEffect, useMemo, useState } from "react";
 import { getChannelState } from "@/lib/wasm-core";
 import type { TransformedMessage } from "./types";
 
-/**
- * Freeze the last-read cursor the first time a channel is opened — before the
- * 300ms markRead advances it — so the "new messages" boundary stays put while
- * the user reads. Returns the id of the first message after that cursor (the
- * divider + scroll anchor), or null when the channel is fully read.
- */
+export interface ChannelEntryAnchor {
+  firstUnreadId: number | null;
+  resolved: boolean;
+  needsUnreadSummary: boolean;
+}
+
+interface EntrySnapshot {
+  channelId: number | null;
+  lastReadId: number | null;
+  unknownResolved: boolean;
+}
+
+function readCursor(channelId: number): number | null {
+  const lastReadId = getChannelState().get_last_read_id(BigInt(channelId));
+  return lastReadId >= 0 ? lastReadId : null;
+}
+
+function makeSnapshot(channelId: number): EntrySnapshot {
+  const cursor = channelId ? readCursor(channelId) : null;
+  return {
+    channelId,
+    lastReadId: cursor,
+    unknownResolved: cursor != null || !channelId,
+  };
+}
+
 export function useChannelEntryAnchor(
   channelId: number,
   messages: TransformedMessage[],
-): number | null {
-  const snapRef = useRef<Map<number, number>>(new Map());
-  // Re-snapshot on each fresh (re-)entry — drop a stale snapshot for this
-  // channel so the divider reflects the CURRENT last-read cursor, not the one
-  // frozen on a prior visit. Stays frozen while we remain in the channel.
-  const enteredRef = useRef<number | null>(null);
-  if (channelId !== enteredRef.current) {
-    snapRef.current.delete(channelId);
-    enteredRef.current = channelId;
-  }
-  if (channelId && !snapRef.current.has(channelId)) {
-    snapRef.current.set(channelId, getChannelState().get_last_read_id(BigInt(channelId)));
-  }
-  const lastReadId = channelId ? snapRef.current.get(channelId) ?? -1 : -1;
+  unreadSummaryAttempted = false,
+): ChannelEntryAnchor {
+  const [snapshot, setSnapshot] = useState<EntrySnapshot>(() => makeSnapshot(channelId));
+
+  useEffect(() => {
+    let cancelled = false;
+    queueMicrotask(() => {
+      if (!cancelled) setSnapshot(makeSnapshot(channelId));
+    });
+    return () => { cancelled = true; };
+  }, [channelId]);
+
+  useEffect(() => {
+    if (!channelId || snapshot.channelId !== channelId || snapshot.lastReadId != null || snapshot.unknownResolved) return;
+    let cancelled = false;
+    queueMicrotask(() => {
+      if (cancelled) return;
+      const cursor = readCursor(channelId);
+      setSnapshot((current) => {
+        if (current.channelId !== channelId || current.lastReadId != null || current.unknownResolved) return current;
+        if (cursor != null) return { channelId, lastReadId: cursor, unknownResolved: true };
+        return unreadSummaryAttempted ? { ...current, unknownResolved: true } : current;
+      });
+    });
+    return () => { cancelled = true; };
+    // Retry re-runs when unreadSummaryAttempted flips after fetchUnreadCounts;
+    // that fetch writes the Rust cursor BEFORE resolving, so we read the fresh
+    // value here without subscribing to the global _unreadTick (which would
+    // re-run this on unread changes for unrelated channels).
+  }, [channelId, snapshot.channelId, snapshot.lastReadId, snapshot.unknownResolved, unreadSummaryAttempted]);
 
   return useMemo(() => {
-    // -1 = no known cursor (channel never reported by a summary fetch) → no
-    // divider. A genuine 0 cursor ("read nothing yet") is kept: every message id
-    // is > 0, so the divider correctly anchors at the first (all-unread) message.
-    if (lastReadId < 0) return null;
-    const first = messages.find((m) => m.id > lastReadId);
-    return first ? first.id : null;
-  }, [messages, lastReadId]);
+    if (!channelId) return { firstUnreadId: null, resolved: true, needsUnreadSummary: false };
+    if (snapshot.channelId !== channelId) return { firstUnreadId: null, resolved: false, needsUnreadSummary: false };
+    if (snapshot.lastReadId == null) {
+      return {
+        firstUnreadId: null,
+        resolved: snapshot.unknownResolved,
+        needsUnreadSummary: !snapshot.unknownResolved,
+      };
+    }
+    const first = messages.find((m) => m.id > snapshot.lastReadId!);
+    return {
+      firstUnreadId: first ? first.id : null,
+      resolved: true,
+      needsUnreadSummary: false,
+    };
+  }, [channelId, messages, snapshot]);
 }
```

**File**: `clients/web/src/components/channel/useMessageEntryPosition.ts` (added, +149/-0)
```diff
@@ -0,0 +1,149 @@
+"use client";
+
+import { useEffect, useLayoutEffect, useRef } from "react";
+import type { RefObject } from "react";
+import type { TransformedMessage } from "./types";
+import { clearEntryTimers, createEntryState, scrollToEntryAnchor } from "./entryAnchorScroll";
+
+interface UseMessageEntryPositionOptions {
+  channelId?: number;
+  messages: TransformedMessage[];
+  loading?: boolean;
+  loadingMore?: boolean;
+  firstUnreadId?: number | null;
+  entryAnchorResolved?: boolean;
+  containerRef: RefObject<HTMLDivElement | null>;
+  contentRef: RefObject<HTMLDivElement | null>;
+  bottomRef: RefObject<HTMLDivElement | null>;
+  // Fires when an anchor lands, so the caller can sync at-bottom state to the
+  // real landed position (a divider at scrollTop 0 emits no correcting scroll).
+  onAnchor?: () => void;
+}
+
+// Entry "settles" once content height holds steady this long (a ResizeObserver
+// quiescence signal), so late images re-anchor and fast layouts settle early.
+const REFLOW_QUIESCE_MS = 250;
+
+export function useMessageEntryPosition({
+  channelId,
+  messages,
+  loading,
+  loadingMore,
+  firstUnreadId,
+  entryAnchorResolved = true,
+  containerRef,
+  contentRef,
+  bottomRef,
+  onAnchor,
+}: UseMessageEntryPositionOptions) {
+  const firstId = messages[0]?.id ?? null;
+  const lastId = messages[messages.length - 1]?.id ?? null;
+  // Anchor identity omits the tail id / length on purpose: an appended message
+  // must not re-fire entry positioning (that yanks back to the divider). Only a
+  // window swap (firstId) or moved cursor (firstUnreadId) is a real re-anchor.
+  const anchorKey = `${channelId ?? "none"}:${firstId ?? "none"}:${firstUnreadId ?? "read"}`;
+  const stateRef = useRef(createEntryState());
+
+  // Live inputs the ResizeObserver reads; synced in a layout effect so they are
+  // fresh before the pre-paint observer/RAF fire (a passive effect lags a frame).
+  const liveRef = useRef({ loading, loadingMore, hasMessages: messages.length > 0, firstUnreadId, entryAnchorResolved });
+  useLayoutEffect(() => {
+    liveRef.current = { loading, loadingMore, hasMessages: messages.length > 0, firstUnreadId, entryAnchorResolved };
+  }, [loading, loadingMore, messages.length, firstUnreadId, entryAnchorResolved]);
+
+  useEffect(() => {
+    const state = stateRef.current;
+    clearEntryTimers(state);
+    Object.assign(state, createEntryState());
+    return () => clearEntryTimers(state);
+  }, [channelId]);
+
+  useEffect(() => {
+    if (!loading) return;
+    const state = stateRef.current;
+    clearEntryTimers(state);
+    state.settled = false;
+    state.lastAppliedKey = null;
+  }, [loading]);
+
+  // Intent is derived from real scroll position: any scroll that isn't our own
+  // programmatic re-anchor (native scrollbar, keyboard, momentum) = user takeover.
+  useEffect(() => {
+    const container = containerRef.current;
+    if (!container) return;
+    const onScroll = () => {
+      const state = stateRef.current;
+      if (state.expectedScrollTop != null && Math.abs(container.scrollTop - state.expectedScrollTop) <= 2) {
+        state.expectedScrollTop = null;
+        return;
+      }
+      state.userInterrupted = true;
+      state.settled = true;
+      clearEntryTimers(state);
+    };
+    container.addEventListener("scroll", onScroll, { passive: true });
+    return () => container.removeEventListener("scroll", onScroll);
+  }, [channelId, containerRef]);
+
+  useEffect(() => {
+    const state = stateRef.current;
+    if (!channelId || loading || loadingMore || messages.length === 0 || state.userInterrupted || state.settled) return;
+    // Wait for the unread cursor to resolve before the first anchor, so an unknown
+    // cursor doesn't land at the bottom and then jump to the divider on resolve.
+    if (!entryAnchorResolved) return;
+    if (state.lastAppliedKey === anchorKey) {
+      // Already anchored this window; a grown tail = live traffic started — settle
+      // so the stream flows / shows the pill instead of being dragged back.
+      if (state.anchoredLastId != null && lastId !== state.anchoredLastId) state.settled = true;
+      return;
+    }
+    // A load-more prepend changes firstId (→ anchorKey) but keeps the same tail;
+    // adopt the new key WITHOUT re-anchoring — useMessageListScroll's load-more
+    // restore owns that viewport, and re-anchoring would fight it.
+    if (state.lastAppliedKey !== null && lastId === state.anchoredLastId) {
+      state.lastAppliedKey = anchorKey;
+      return;
+    }
+
+    const target = scrollToEntryAnchor(containerRef.current, bottomRef.current, firstUnreadId, state);
+    if (!target) return;
+    state.lastAppliedKey = anchorKey;
+    state.anchoredLastId = lastId;
+    state.target = target;
+    onAnchor?.();
+  }, [anchorKey, bottomRef, channelId, containerRef, entryAnchorResolved, firstUnreadId, lastId, loading, loadingMore, messages.length, onAnchor]);
+
+  // Re-anchor o
```

---

### Incident Patch 6: `d6606e81` (2026-07-23)
**Commit Message**: fix(ci): support pinned curl in GitLab sync (#465)

Co-authored-by: yishuiliunian <[REDACTED_EMAIL]>

**File**: `.gitlab-ci.yml` (modified, +2/-1)
```diff
@@ -33,7 +33,8 @@ sync:github:
         "$CI_REPOSITORY_URL" \
         "$github_sha:refs/heads/main"
 
-      curl --fail-with-body --silent --show-error \
+      # The pinned Bazel builder ships curl without --fail-with-body.
+      curl --fail --silent --show-error \
         --request POST \
         --form "token=$CI_JOB_TOKEN" \
         --form "ref=main" \
```

---

### Incident Patch 7: `ecd1a0f7` (2026-07-23)
**Commit Message**: fix(deploy): route Connect RPC in private templates (#464)

Co-authored-by: yishuiliunian <[REDACTED_EMAIL]>

**File**: `.github/workflows/bazel.yml` (modified, +2/-0)
```diff
@@ -45,6 +45,8 @@ jobs:
       - run: bazel run //:buildifier_check
       - name: Identifier contract lint
         run: bash tools/identifier-lint/lint.sh
+      - name: Self-hosted Traefik route contract
+        run: bash deploy/traefik_connect_routes_test.sh
       - name: Verify desktop-only crate isolation
         run: |
           set -euo pipefail
```

**File**: `deploy/onpremise/traefik/dynamic/routes.yml` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ http:
     # Backend API
     # =========================================================================
     api:
-      rule: "PathPrefix(`/api`) || PathPrefix(`/health`)"
+      rule: "PathPrefix(`/api`) || PathPrefix(`/health`) || PathPrefix(`/proto.`)"
       entryPoints:
         - web
       service: backend
```

**File**: `deploy/selfhost/traefik/dynamic/routes.yml` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ http:
   routers:
     # Backend API
     api:
-      rule: "PathPrefix(`/api`) || PathPrefix(`/health`)"
+      rule: "PathPrefix(`/api`) || PathPrefix(`/health`) || PathPrefix(`/proto.`)"
       entryPoints:
         - web
       service: backend
```

**File**: `deploy/traefik_connect_routes_test.sh` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
+configs=(
+  "deploy/selfhost/traefik/dynamic/routes.yml"
+  "deploy/onpremise/traefik/dynamic/routes.yml"
+)
+
+cd "$repo_root"
+ruby -ryaml - "${configs[@]}" <<'RUBY'
+EXPECTED_RULE = 'PathPrefix(`/api`) || PathPrefix(`/health`) || PathPrefix(`/proto.`)'
+
+def value_at(document, *keys)
+  keys.reduce(document) do |value, key|
+    value.is_a?(Hash) ? value[key] : nil
+  end
+end
+
+def assert_equal(path, field, actual, expected)
+  return if actual == expected
+
+  abort "#{path}: #{field}: expected #{expected.inspect}, got #{actual.inspect}"
+end
+
+ARGV.each do |path|
+  begin
+    document = YAML.safe_load_file(path, aliases: false)
+  rescue Psych::Exception => error
+    abort "#{path}: yaml: #{error.message}"
+  end
+
+  api_rule = value_at(document, "http", "routers", "api", "rule")
+  api_service = value_at(document, "http", "routers", "api", "service")
+  api_priority = value_at(document, "http", "routers", "api", "priority")
+  web_priority = value_at(document, "http", "routers", "web", "priority")
+
+  assert_equal(path, "http.routers.api.rule", api_rule, EXPECTED_RULE)
+  assert_equal(path, "http.routers.api.service", api_service, "backend")
+  assert_equal(path, "http.routers.api.priority", api_priority, 100)
+
+  unless web_priority.is_a?(Numeric) && web_priority < api_priority
+    abort "#{path}: http.routers.web.priority: expected a number lower than #{api_priority.inspect}, got #{web_priority.inspect}"
+  end
+
+  puts "validated #{path}"
+end
+RUBY
```

---

### Incident Patch 8: `981c9130` (2026-07-22)
**Commit Message**: ci: cache Electron for internal image builds (#462)

Co-authored-by: yishuiliunian <[REDACTED_EMAIL]>

**File**: `.gitlab-ci.yml` (modified, +39/-0)
```diff
@@ -81,6 +81,45 @@ build:images:
         'rewrite static.crates.io/crates/([^/]+)/([^/]+)/download rsproxy.cn/api/v1/crates/$1/$2/download' \
         > "$downloader_config"
 
+      case "$SERVICE" in
+        web|web-admin)
+          : "${ELECTRON_MIRROR:?ELECTRON_MIRROR is required for frontend images}"
+          electron_version="33.4.11"
+          electron_get_version="2.0.3"
+          electron_sha256="212d431c7c916292311c797cd91f84467c5abd6e6983cf24b162efff64cee8a9"
+
+          if ! grep -Fqx "electronVersion: ${electron_version}" clients/desktop/electron-builder.yml || \
+              ! grep -Fqx "  electron@${electron_version}:" pnpm-lock.yaml || \
+              ! grep -Fqx "  '@electron/get@${electron_get_version}':" pnpm-lock.yaml || \
+              ! grep -Fqx "      '@electron/get': ${electron_get_version}" pnpm-lock.yaml; then
+            echo "Electron cache pins no longer match the resolved dependencies; update this CI block."
+            exit 1
+          fi
+
+          electron_artifact="electron-v${electron_version}-linux-x64.zip"
+          # The hermetic lifecycle sees Electron's default URL, so the cache key must use it.
+          electron_release="https://github.com/electron/electron/releases/download/v${electron_version}"
+          electron_cache_key="$(printf '%s' "$electron_release" | sha256sum | awk '{print $1}')"
+          electron_cache_dir="/root/.cache/electron/${electron_cache_key}"
+          electron_cache_file="${electron_cache_dir}/${electron_artifact}"
+
+          mkdir -p "$electron_cache_dir"
+          if [ ! -f "$electron_cache_file" ] || \
+              ! printf '%s  %s\n' "$electron_sha256" "$electron_cache_file" | sha256sum --check --status; then
+            electron_tmp="$(mktemp "${electron_cache_file}.tmp.XXXXXX")"
+            trap 'rm -f "$electron_tmp"' EXIT
+            curl --fail --location --silent --show-error \
+              --connect-timeout 10 --max-time 300 \
+              --retry 3 --retry-delay 2 \
+              --output "$electron_tmp" \
+              "${ELECTRON_MIRROR%/}/v${electron_version}/${electron_artifact}"
+            printf '%s  %s\n' "$electron_sha256" "$electron_tmp" | sha256sum --check
+            mv "$electron_tmp" "$electron_cache_file"
+            trap - EXIT
+          fi
+          ;;
+      esac
+
       short_sha="$(printf '%.7s' "$CI_COMMIT_SHA")"
       export IMAGE_VERSION="sha-${short_sha}"
       export IMAGE_MINOR="main"
```

---

### Incident Patch 9: `72b17cef` (2026-07-20)
**Commit Message**: fix(backend): sync skills via go-git instead of exec git (#456)

* fix(backend): sync skills via go-git instead of exec git

Skill-registry sync shelled out to `git clone`, but the backend OCI image
is Alpine-based with no git installed, so every SyncSkillRegistry failed
with `exec: "git": executable file not found in $PATH` (HTTP 500).

Replace the exec-git calls in skill_importer_git.go with go-git
(PlainCloneContext / PlainOpen), dropping the runtime git dependency so
the image needs no extra package. Behavior preserved:
- https-only clone + git@-only SSH scheme checks
- shallow depth=1 (remote), branch selection, GitHub/GitLab PAT, SSH key
- credentials pass via explicit go-git Auth, never embedded in the clone URL

go-git is added as a direct dependency (go.mod + MODULE.bazel use_repo).
All 378 tests in the extension package pass; //backend/cmd/server builds.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

* fix(backend): address go-git skill-sync review findings

Follow-up to the exec-git -> go-git migration, fixing defects from the
max-effort code review:

- Tags: NoTags — go-git's Validate() defaults Tags to AllTags, so every
  shallow sync also fetched al

**File**: `MODULE.bazel` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ go_sdk.download(version = "1.25.0")
 # its `require` blocks and emits one `go_deps` import per dependency.
 go_deps = use_extension("@gazelle//:extensions.bzl", "go_deps")
 go_deps.from_file(go_mod = "//:go.mod")
-use_repo(go_deps, "com_connectrpc_connect", "com_github_alicebob_miniredis_v2", "com_github_aws_aws_sdk_go_v2", "com_github_aws_aws_sdk_go_v2_config", "com_github_aws_aws_sdk_go_v2_credentials", "com_github_aws_aws_sdk_go_v2_service_s3", "com_github_coreos_go_oidc_v3", "com_github_creack_pty", "com_github_creativeprojects_go_selfupdate", "com_github_crewjam_saml", "com_github_gin_contrib_cors", "com_github_gin_gonic_gin", "com_github_go_acme_lego_v4", "com_github_go_ldap_ldap_v3", "com_github_golang_jwt_jwt_v5", "com_github_golang_migrate_migrate_v4", "com_github_google_uuid", "com_github_gorilla_websocket", "com_github_kardianos_service", "com_github_lib_pq", "com_github_masterminds_semver_v3", "com_github_mattn_go_runewidth", "com_github_maxmind_mmdbwriter", "com_github_ndolestudio_lemonsqueezy_go", "com_github_oschwald_maxminddb_golang", "com_github_pelletier_go_toml_v2", "com_github_pkg_browser", "com_github_redis_go_redis_extra_redisotel_v9", "com_github_redis_go_redis_v9", "com_github_resend_resend_go_v2", "com_github_robfig_cron_v3", "com_github_smartwalle_alipay_v3", "com_github_spf13_viper", "com_github_stretchr_testify", "com_github_stripe_stripe_go_v76", "com_github_thejerf_suture_v4", "com_github_uptrace_opentelemetry_go_extra_otelgorm", "com_github_userexistserror_conpty", "com_github_wechatpay_apiv3_wechatpay_go", "com_github_yuin_goldmark", "in_gopkg_yaml_v3", "io_gorm_driver_postgres", "io_gorm_driver_sqlite", "io_gorm_gorm", "io_gorm_plugin_dbresolver", "io_opentelemetry_go_contrib_instrumentation_github_com_gin_gonic_gin_otelgin", "io_opentelemetry_go_contrib_instrumentation_google_golang_org_grpc_otelgrpc", "io_opentelemetry_go_contrib_instrumentation_net_http_otelhttp", "io_opentelemetry_go_otel", "io_opentelemetry_go_otel_exporters_otlp_otlpmetric_otlpmetricgrpc", "io_opentelemetry_go_otel_exporters_otlp_otlptrace_otlptracegrpc", "io_opentelemetry_go_otel_exporters_stdout_stdoutmetric", "io_opentelemetry_go_otel_exporters_stdout_stdouttrace", "io_opentelemetry_go_otel_metric", "io_opentelemetry_go_otel_sdk", "io_opentelemetry_go_otel_sdk_metric", "io_opentelemetry_go_otel_trace", "org_golang_google_grpc", "org_golang_google_grpc_security_advancedtls", "org_golang_google_protobuf", "org_golang_x_crypto", "org_golang_x_oauth2", "org_golang_x_sync", "org_golang_x_term", "org_golang_x_time")
+use_repo(go_deps, "com_connectrpc_connect", "com_github_alicebob_miniredis_v2", "com_github_aws_aws_sdk_go_v2", "com_github_aws_aws_sdk_go_v2_config", "com_github_aws_aws_sdk_go_v2_credentials", "com_github_aws_aws_sdk_go_v2_service_s3", "com_github_coreos_go_oidc_v3", "com_github_creack_pty", "com_github_creativeprojects_go_selfupdate", "com_github_crewjam_saml", "com_github_gin_contrib_cors", "com_github_gin_gonic_gin", "com_github_go_acme_lego_v4", "com_github_go_git_go_git_v5", "com_github_go_ldap_ldap_v3", "com_github_golang_jwt_jwt_v5", "com_github_golang_migrate_migrate_v4", "com_github_google_uuid", "com_github_gorilla_websocket", "com_github_kardianos_service", "com_github_lib_pq", "com_github_masterminds_semver_v3", "com_github_mattn_go_runewidth", "com_github_maxmind_mmdbwriter", "com_github_ndolestudio_lemonsqueezy_go", "com_github_oschwald_maxminddb_golang", "com_github_pelletier_go_toml_v2", "com_github_pkg_browser", "com_github_redis_go_redis_extra_redisotel_v9", "com_github_redis_go_redis_v9", "com_github_resend_resend_go_v2", "com_github_robfig_cron_v3", "com_github_smartwalle_alipay_v3", "com_github_spf13_viper", "com_github_stretchr_testify", "com_github_stripe_stripe_go_v76", "com_github_thejerf_suture_v4", "com_github_uptrace_opentelemetry_go_extra_otelgorm", "com_github_userexistserror_conpty", "com_github_wechatpay_apiv3_wechatpay_go", "com_github_yuin_goldmark", "in_gopkg_yaml_v3", "io_gorm_driver_postgres", "io_gorm_driver_sqlite", "io_gorm_gorm", "io_gorm_plugin_dbresolver", "io_opentelemetry_go_contrib_instrumentation_github_com_gin_gonic_gin_otelgin", "io_opentelemetry_go_contrib_instrumentation_google_golang_org_grpc_otelgrpc", "io_opentelemetry_go_contrib_instrumentation_net_http_otelhttp", "io_opentelemetry_go_otel", "io_opentelemetry_go_otel_exporters_otlp_otlpmetric_otlpmetricgrpc", "io_opentelemetry_go_otel_exporters_otlp_otlptrace_otlptracegrpc", "io_opentelemetry_go_otel_exporters_stdout_stdoutmetric", "io_opentelemetry_go_otel_exporters_stdout_stdouttrace", "io_opentelemetry_go_otel_metric", "io_opentelemetry_go_otel_sdk", "io_opentelemetry_go_otel_sdk_metric", "io_opentelemetry_go_otel_trace", "org_golang_google_grpc", "org_golang_google_grpc_security_advancedtls", "org_golang_google_protobuf", "org_golang_x_crypto", "org_golang_x_oauth2", "org_golang_x_sync", "org_golang_x_term", "org_golang_x_time")
 
 #################################
```

**File**: `backend/internal/service/extension/BUILD.bazel` (modified, +6/-0)
```diff
@@ -30,8 +30,14 @@ go_library(
         "//backend/internal/domain/extension",
         "//backend/internal/infra/storage",
         "//backend/pkg/crypto",
+        "@com_github_go_git_go_git_v5//:go-git",
+        "@com_github_go_git_go_git_v5//plumbing",
+        "@com_github_go_git_go_git_v5//plumbing/transport",
+        "@com_github_go_git_go_git_v5//plumbing/transport/http",
+        "@com_github_go_git_go_git_v5//plumbing/transport/ssh",
         "@com_github_google_uuid//:uuid",
         "@io_opentelemetry_go_contrib_instrumentation_net_http_otelhttp//:otelhttp",
+        "@org_golang_x_crypto//ssh",
     ],
 )
 
```

**File**: `backend/internal/service/extension/skill_importer_auth_test.go` (modified, +14/-37)
```diff
@@ -11,61 +11,38 @@ import (
 )
 
 // =============================================================================
-// injectPATIntoURL
+// httpsBasicAuth
 // =============================================================================
 
-func TestInjectPATIntoURL_Success(t *testing.T) {
-	result, err := injectPATIntoURL("https://github.com/owner/repo.git", "ghp_mytoken123")
+func TestHTTPSBasicAuth_GitHubPAT(t *testing.T) {
+	auth, err := httpsBasicAuth("https://github.com/owner/repo.git", "ghp_mytoken123", "")
 	require.NoError(t, err)
-	assert.Equal(t, "https://ghp_mytoken123@github.com/owner/repo.git", result)
+	assert.Equal(t, "ghp_mytoken123", auth.Username)
+	assert.Equal(t, "", auth.Password)
 }
 
-func TestInjectPATIntoURL_NonHTTPS(t *testing.T) {
-	tests := []struct {
-		name string
-		url  string
-	}{
-		{"http URL", "http://github.com/owner/repo.git"},
-		{"ssh URL", "ssh://git@github.com/owner/repo.git"},
-		{"file URL", "file:///local/path/repo"},
-		{"git protocol", "git://github.com/owner/repo.git"},
-		{"bare path", "/some/local/path"},
-	}
-
-	for _, tt := range tests {
-		t.Run(tt.name, func(t *testing.T) {
-			_, err := injectPATIntoURL(tt.url, "token")
-			require.Error(t, err)
-			assert.Contains(t, err.Error(), "PAT auth requires https:// URL")
-		})
-	}
-}
-
-// =============================================================================
-// injectGitLabPATIntoURL
-// =============================================================================
-
-func TestInjectGitLabPATIntoURL_Success(t *testing.T) {
-	result, err := injectGitLabPATIntoURL("https://gitlab.com/owner/repo.git", "glpat-mytoken456")
+func TestHTTPSBasicAuth_GitLabPAT(t *testing.T) {
+	auth, err := httpsBasicAuth("https://gitlab.com/owner/repo.git", "oauth2", "glpat-mytoken456")
 	require.NoError(t, err)
-	assert.Equal(t, "https://oauth2:glpat-mytoken456@gitlab.com/owner/repo.git", result)
+	assert.Equal(t, "oauth2", auth.Username)
+	assert.Equal(t, "glpat-mytoken456", auth.Password)
 }
 
-func TestInjectGitLabPATIntoURL_NonHTTPS(t *testing.T) {
+func TestHTTPSBasicAuth_NonHTTPS(t *testing.T) {
 	tests := []struct {
 		name string
 		url  string
 	}{
-		{"http URL", "http://gitlab.com/owner/repo.git"},
-		{"ssh URL", "ssh://git@gitlab.com/owner/repo.git"},
+		{"http URL", "http://github.com/owner/repo.git"},
+		{"ssh URL", "ssh://git@github.com/owner/repo.git"},
 		{"file URL", "file:///local/path/repo"},
-		{"git protocol", "git://gitlab.com/owner/repo.git"},
+		{"git protocol", "git://github.com/owner/repo.git"},
 		{"bare path", "/some/local/path"},
 	}
 
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
-			_, err := injectGitLabPATIntoURL(tt.url, "token")
+			_, err := httpsBasicAuth(tt.url, "token", "")
 			require.Error(t, err)
 			assert.Contains(t, err.Error(), "PAT auth requires https:// URL")
 		})
```

**File**: `backend/internal/service/extension/skill_importer_git.go` (modified, +90/-96)
```diff
@@ -2,12 +2,19 @@ package extension
 
 import (
 	"context"
+	"errors"
 	"fmt"
 	"log/slog"
 	"os"
-	"os/exec"
 	"strings"
 
+	"github.com/go-git/go-git/v5"
+	"github.com/go-git/go-git/v5/plumbing"
+	"github.com/go-git/go-git/v5/plumbing/transport"
+	githttp "github.com/go-git/go-git/v5/plumbing/transport/http"
+	gitssh "github.com/go-git/go-git/v5/plumbing/transport/ssh"
+	xssh "golang.org/x/crypto/ssh"
+
 	"github.com/anthropics/agentsmesh/backend/internal/domain/extension"
 )
 
@@ -22,46 +29,46 @@ func validateGitBranch(branch string) error {
 	return nil
 }
 
+func validateBranchIfSet(branch string) error {
+	if branch == "" {
+		return nil
+	}
+	if err := validateGitBranch(branch); err != nil {
+		return fmt.Errorf("invalid branch: %w", err)
+	}
+	return nil
+}
+
 func gitCloneWithAuth(ctx context.Context, repoURL, branch, targetDir, authType, credential string) error {
 	slog.InfoContext(ctx, "git clone with auth", "auth_type", authType, "branch", branch)
 	switch authType {
 	case extension.AuthTypeGitHubPAT:
-		authedURL, err := injectPATIntoURL(repoURL, credential)
-		if err != nil {
-			return fmt.Errorf("failed to build authenticated URL: %w", err)
-		}
-		return gitClone(ctx, authedURL, branch, targetDir)
-
+		return cloneHTTPS(ctx, repoURL, branch, targetDir, credential, "")
 	case extension.AuthTypeGitLabPAT:
-		authedURL, err := injectGitLabPATIntoURL(repoURL, credential)
-		if err != nil {
-			return fmt.Errorf("failed to build authenticated URL: %w", err)
-		}
-		return gitClone(ctx, authedURL, branch, targetDir)
-
+		return cloneHTTPS(ctx, repoURL, branch, targetDir, "oauth2", credential)
 	case extension.AuthTypeSSHKey:
 		return gitCloneWithSSHKey(ctx, repoURL, branch, targetDir, credential)
-
 	default:
 		return gitClone(ctx, repoURL, branch, targetDir)
 	}
 }
 
-func injectPATIntoURL(repoURL, token string) (string, error) {
+// httpsBasicAuth builds explicit BasicAuth for an https repo. Credentials go
+// through go-git's Auth, never embedded in the clone URL, so they cannot leak
+// into go-git errors, the persisted sync_error, or logs.
+func httpsBasicAuth(repoURL, username, password string) (*githttp.BasicAuth, error) {
 	if !strings.HasPrefix(repoURL, "https://") {
-		return "", fmt.Errorf("PAT auth requires https:// URL, got: %s", repoURL)
+		return nil, fmt.Errorf("PAT auth requires https:// URL, got: %s", repoURL)
 	}
-	rest := strings.TrimPrefix(repoURL, "https://")
-	return fmt.Sprintf("https://%s@%s", token, rest), nil
+	return &githttp.BasicAuth{Username: username, Password: password}, nil
 }
 
-// injectGitLabPATIntoURL uses the oauth2 username form GitLab requires.
-func injectGitLabPATIntoURL(repoURL, token string) (string, error) {
-	if !strings.HasPrefix(repoURL, "https://") {
-		return "", fmt.Errorf("PAT auth requires https:// URL, got: %s", repoURL)
+func cloneHTTPS(ctx context.Context, repoURL, branch, targetDir, username, password string) error {
+	auth, err := httpsBasicAuth(repoURL, username, password)
+	if err != nil {
+		return fmt.Errorf("failed to build authenticated URL: %w", err)
 	}
-	rest := strings.TrimPrefix(repoURL, "https://")
-	return fmt.Sprintf("https://oauth2:%s@%s", token, rest), nil
+	return cloneRef(ctx, targetDir, repoURL, branch, auth, true, "git clone failed")
 }
 
 func gitCloneWithSSHKey(ctx context.Context, repoURL, branch, targetDir, sshKey string) error {
@@ -70,100 +77,87 @@ func gitCloneWithSSHKey(ctx context.Context, repoURL, branch, targetDir, sshKey
 	if !isGitSSH && !isLocalPath {
 		return fmt.Errorf("SSH key auth requires git@ URL, got: %s", repoURL)
 	}
-
-	tmpKeyFile, err := os.CreateTemp("", "skill-ssh-key-*")
-	if err != nil {
-		return fmt.Errorf("failed to create temp SSH key file: %w", err)
+	if err := validateBranchIfSet(branch); err != nil {
+		return err
 	}
-	defer os.Remove(tmpKeyFile.Name())
 
-	if _, err := tmpKeyFile.WriteString(sshKey); err != nil {
-		tmpKeyFile.Close()
-		return fmt.Errorf("failed to write SSH key: %w", err)
+	// Local-path clones (tests, file:// sources) never touch SSH, so an
+	// unparseable key must not fail them — only remote git@ uses auth.
+	var auth transport.AuthMethod
+	if isGitSSH {
+		keys, err := gitssh.NewPublicKeys("git", []byte(sshKey), "")
+		if err != nil {
+			return fmt.Errorf("git clone with SSH key failed: %w", err)
+		}
+		keys.HostKeyCallback = xssh.InsecureIgnoreHostKey()
+		auth = keys
 	}
-	tmpKeyFile.Close()
 
-	if err := os.Chmod(tmpKeyFile.Name(), 0600); err != nil {
-		return fmt.Errorf("failed to set SSH key permissions: %w", err)
-	}
+	return cloneRef(ctx, targetDir, repoURL, branch, auth, !isLocalPath, "git clone with SSH key failed")
+}
 
-	if branch != "" {
-		if err := validateGitBranch(branch); err != nil {
-			return fmt.Errorf("invalid branch: %w", err)
-		}
+func gitClone(ctx context.Context, rawURL, branch, targetDir string) error {
+	if !strings.HasPrefix(rawURL, "https://") {
+		return fmt.Errorf("only https:// URLs are allowed for git clone, got: %s
```

**File**: `backend/internal/service/extension/skill_importer_git_test.go` (modified, +34/-0)
```diff
@@ -259,3 +259,37 @@ func TestGitCloneWithSSHKey_SuccessfulClone_WithBranch(t *testing.T) {
 
 	assert.True(t, fileExists(filepath.Join(targetDir, "branch-file.txt")))
 }
+
+// TestGitCloneWithSSHKey_TagRef_LocalRepo pins the branch->tag fallback: a
+// Branch that names a tag (not a head) must still clone, matching the old
+// `git clone --branch <tag>`.
+func TestGitCloneWithSSHKey_TagRef_LocalRepo(t *testing.T) {
+	sourceDir := t.TempDir()
+	for _, args := range [][]string{
+		{"git", "init"},
+		{"git", "config", "user.email", "test@test.com"},
+		{"git", "config", "user.name", "Test"},
+	} {
+		cmd := exec.Command(args[0], args[1:]...)
+		cmd.Dir = sourceDir
+		out, err := cmd.CombinedOutput()
+		require.NoError(t, err, "git setup failed: %s", string(out))
+	}
+
+	require.NoError(t, os.WriteFile(filepath.Join(sourceDir, "tagged.txt"), []byte("tag content"), 0644))
+	for _, args := range [][]string{
+		{"git", "add", "."},
+		{"git", "commit", "-m", "initial"},
+		{"git", "tag", "v1.0.0"},
+	} {
+		cmd := exec.Command(args[0], args[1:]...)
+		cmd.Dir = sourceDir
+		out, err := cmd.CombinedOutput()
+		require.NoError(t, err, "git tag setup failed: %s", string(out))
+	}
+
+	targetDir := filepath.Join(t.TempDir(), "cloned")
+	err := gitCloneWithSSHKey(context.Background(), sourceDir, "v1.0.0", targetDir, "fake-ssh-key")
+	require.NoError(t, err, "clone of a tag ref should succeed via the branch->tag fallback")
+	assert.True(t, fileExists(filepath.Join(targetDir, "tagged.txt")))
+}
```

**File**: `go.mod` (modified, +17/-0)
```diff
@@ -18,6 +18,7 @@ require (
 	github.com/gin-contrib/cors v1.7.7
 	github.com/gin-gonic/gin v1.12.0
 	github.com/go-acme/lego/v4 v4.33.0
+	github.com/go-git/go-git/v5 v5.19.1
 	github.com/go-ldap/ldap/v3 v3.4.12
 	github.com/golang-jwt/jwt/v5 v5.3.1
 	github.com/golang-migrate/migrate/v4 v4.19.1
@@ -72,8 +73,11 @@ require connectrpc.com/connect v1.19.1
 
 require (
 	code.gitea.io/sdk/gitea v0.22.1 // indirect
+	dario.cat/mergo v1.0.0 // indirect
 	github.com/42wim/httpsig v1.2.3 // indirect
 	github.com/Azure/go-ntlmssp v0.0.0-20221128193559-754e69321358 // indirect
+	github.com/Microsoft/go-winio v0.6.2 // indirect
+	github.com/ProtonMail/go-crypto v1.1.6 // indirect
 	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.4 // indirect
 	github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.18.19 // indirect
 	github.com/aws/aws-sdk-go-v2/internal/configsources v1.4.19 // indirect
@@ -96,15 +100,20 @@ require (
 	github.com/cenkalti/backoff/v5 v5.0.3 // indirect
 	github.com/cespare/xxhash/v2 v2.3.0 // indirect
 	github.com/clipperhouse/uax29/v2 v2.2.0 // indirect
+	github.com/cloudflare/circl v1.6.3 // indirect
 	github.com/cloudwego/base64x v0.1.6 // indirect
+	github.com/cyphar/filepath-securejoin v0.6.1 // indirect
 	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
 	github.com/davidmz/go-pageant v1.0.2 // indirect
+	github.com/emirpasic/gods v1.18.1 // indirect
 	github.com/felixge/httpsnoop v1.0.4 // indirect
 	github.com/fsnotify/fsnotify v1.9.0 // indirect
 	github.com/gabriel-vasile/mimetype v1.4.13 // indirect
 	github.com/gin-contrib/sse v1.1.1 // indirect
 	github.com/go-asn1-ber/asn1-ber v1.5.8-0.20250403174932-29230038a667 // indirect
 	github.com/go-fed/httpsig v1.1.0 // indirect
+	github.com/go-git/gcfg v1.5.1-0.20230307220236-3a3c6141e376 // indirect
+	github.com/go-git/go-billy/v5 v5.9.0 // indirect
 	github.com/go-jose/go-jose/v4 v4.1.4 // indirect
 	github.com/go-logr/logr v1.4.3 // indirect
 	github.com/go-logr/stdr v1.2.2 // indirect
@@ -114,6 +123,7 @@ require (
 	github.com/go-viper/mapstructure/v2 v2.5.0 // indirect
 	github.com/goccy/go-json v0.10.6 // indirect
 	github.com/goccy/go-yaml v1.19.2 // indirect
+	github.com/golang/groupcache v0.0.0-20241129210726-2c02b8208cf8 // indirect
 	github.com/google/go-github/v74 v74.0.0 // indirect
 	github.com/google/go-querystring v1.2.0 // indirect
 	github.com/grpc-ecosystem/grpc-gateway/v2 v2.28.0 // indirect
@@ -124,10 +134,12 @@ require (
 	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
 	github.com/jackc/pgx/v5 v5.6.0 // indirect
 	github.com/jackc/puddle/v2 v2.2.2 // indirect
+	github.com/jbenet/go-context v0.0.0-20150711004518-d14ea06fba99 // indirect
 	github.com/jinzhu/inflection v1.0.0 // indirect
 	github.com/jinzhu/now v1.1.5 // indirect
 	github.com/jonboulle/clockwork v0.2.2 // indirect
 	github.com/json-iterator/go v1.1.13-0.20220915233716-71ac16282d12 // indirect
+	github.com/kevinburke/ssh_config v1.2.0 // indirect
 	github.com/klauspost/cpuid/v2 v2.3.0 // indirect
 	github.com/leodido/go-urn v1.4.0 // indirect
 	github.com/mattermost/xml-roundtrip-validator v0.1.0 // indirect
@@ -137,12 +149,15 @@ require (
 	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
 	github.com/modern-go/reflect2 v1.0.2 // indirect
 	github.com/oschwald/maxminddb-golang/v2 v2.1.1 // indirect
+	github.com/pjbgf/sha1cd v0.6.0 // indirect
 	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
 	github.com/quic-go/qpack v0.6.0 // indirect
 	github.com/quic-go/quic-go v0.59.0 // indirect
 	github.com/redis/go-redis/extra/rediscmd/v9 v9.19.0 // indirect
 	github.com/russellhaering/goxmldsig v1.4.0 // indirect
 	github.com/sagikazarmark/locafero v0.11.0 // indirect
+	github.com/sergi/go-diff v1.3.2-0.20230802210424-5b0b94c5c0d3 // indirect
+	github.com/skeema/knownhosts v1.3.1 // indirect
 	github.com/smartwalle/ncrypto v1.0.4 // indirect
 	github.com/smartwalle/ngx v1.0.12 // indirect
 	github.com/smartwalle/nsign v1.0.9 // indirect
@@ -156,6 +171,7 @@ require (
 	github.com/ugorji/go/codec v1.3.1 // indirect
 	github.com/ulikunitz/xz v0.5.15 // indirect
 	github.com/uptrace/opentelemetry-go-extra/otelsql v0.3.2 // indirect
+	github.com/xanzy/ssh-agent v0.3.3 // indirect
 	github.com/yuin/gopher-lua v1.1.1 // indirect
 	gitlab.com/gitlab-org/api/client-go v1.9.1 // indirect
 	go.mongodb.org/mongo-driver/v2 v2.5.0 // indirect
@@ -174,4 +190,5 @@ require (
 	google.golang.org/genproto/googleapis/api v0.0.0-20260401024825-9d38bb4040a9 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260406210006-6f92a3bedf2d // indirect
 	google.golang.org/protobuf v1.36.11 // indirect
+	gopkg.in/warnings.v0 v0.1.2 // indirect
 )
```

**File**: `go.sum` (modified, +45/-0)
```diff
@@ -2,6 +2,8 @@ code.gitea.io/sdk/gitea v0.22.1 h1:7K05KjRORyTcTYULQ/AwvlVS6pawLcWyXZcTr7gHFyA=
 code.gitea.io/sdk/gitea v0.22.1/go.mod h1:yyF5+GhljqvA30sRDreoyHILruNiy4ASufugzYg0VHM=
 connectrpc.com/connect v1.19.1 h1:R5M57z05+90EfEvCY1b7hBxDVOUl45PrtXtAV2fOC14=
 connectrpc.com/connect v1.19.1/go.mod h1:tN20fjdGlewnSFeZxLKb0xwIZ6ozc3OQs2hTXy4du9w=
+dario.cat/mergo v1.0.0 h1:AGCNq9Evsj31mOgNPcLyXc+4PNABt905YmuqPYYpBWk=
+dario.cat/mergo v1.0.0/go.mod h1:uNxQE+84aUszobStD9th8a29P2fMDhsBdgRYvZOxGmk=
 github.com/42wim/httpsig v1.2.3 h1:xb0YyWhkYj57SPtfSttIobJUPJZB9as1nsfo7KWVcEs=
 github.com/42wim/httpsig v1.2.3/go.mod h1:nZq9OlYKDrUBhptd77IHx4/sZZD+IxTBADvAPI9G/EM=
 github.com/Azure/go-ansiterm v0.0.0-20230124172434-306776ec8161 h1:L/gRVlceqvL25UVaW/CKtUDjefjrs0SPonmDGUVOYP0=
@@ -10,10 +12,13 @@ github.com/Azure/go-ntlmssp v0.0.0-20221128193559-754e69321358 h1:mFRzDkZVAjdal+
 github.com/Azure/go-ntlmssp v0.0.0-20221128193559-754e69321358/go.mod h1:chxPXzSsl7ZWRAuOIE23GDNzjWuZquvFlgA8xmpunjU=
 github.com/Masterminds/semver/v3 v3.4.0 h1:Zog+i5UMtVoCU8oKka5P7i9q9HgrJeGzI9SA1Xbatp0=
 github.com/Masterminds/semver/v3 v3.4.0/go.mod h1:4V+yj/TJE1HU9XfppCwVMZq3I84lprf4nC11bSS5beM=
+github.com/Microsoft/go-winio v0.5.2/go.mod h1:WpS1mjBmmwHBEWmogvA2mj8546UReBk4v8QkMxJ6pZY=
 github.com/Microsoft/go-winio v0.6.2 h1:F2VQgta7ecxGYO8k3ZZz3RS8fVIXVxONVUPlNERoyfY=
 github.com/Microsoft/go-winio v0.6.2/go.mod h1:yd8OoFMLzJbo9gZq8j5qaps8bJ9aShtEA8Ipt1oGCvU=
 github.com/NdoleStudio/lemonsqueezy-go v1.3.1 h1:lMUVgdAx2onbOUJIVPR05xAANYuCMXBRaGWpAdA4LiM=
 github.com/NdoleStudio/lemonsqueezy-go v1.3.1/go.mod h1:xKRsRX1jSI6mLrVXyWh2sF/1isxTioZrSjWy6HpA3xQ=
+github.com/ProtonMail/go-crypto v1.1.6 h1:ZcV+Ropw6Qn0AX9brlQLAUXfqLBc7Bl+f/DmNxpLfdw=
+github.com/ProtonMail/go-crypto v1.1.6/go.mod h1:rA3QumHc/FZ8pAHreoekgiAbzpNsfQAosU5td4SnOrE=
 github.com/UserExistsError/conpty v0.1.4 h1:+3FhJhiqhyEJa+K5qaK3/w6w+sN3Nh9O9VbJyBS02to=
 github.com/UserExistsError/conpty v0.1.4/go.mod h1:PDglKIkX3O/2xVk0MV9a6bCWxRmPVfxqZoTG/5sSd9I=
 github.com/agiledragon/gomonkey v2.0.2+incompatible h1:eXKi9/piiC3cjJD1658mEE2o3NjkJ5vDLgYjCQu0Xlw=
@@ -79,6 +84,8 @@ github.com/cespare/xxhash/v2 v2.3.0 h1:UL815xU9SqsFlibzuggzjXhog7bL6oX9BbNZnL2UF
 github.com/cespare/xxhash/v2 v2.3.0/go.mod h1:VGX0DQ3Q6kWi7AoAeZDth3/j3BFtOZR5XLFGgcrjCOs=
 github.com/clipperhouse/uax29/v2 v2.2.0 h1:ChwIKnQN3kcZteTXMgb1wztSgaU+ZemkgWdohwgs8tY=
 github.com/clipperhouse/uax29/v2 v2.2.0/go.mod h1:EFJ2TJMRUaplDxHKj1qAEhCtQPW2tJSwu5BF98AuoVM=
+github.com/cloudflare/circl v1.6.3 h1:9GPOhQGF9MCYUeXyMYlqTR6a5gTrgR/fBLXvUgtVcg8=
+github.com/cloudflare/circl v1.6.3/go.mod h1:2eXP6Qfat4O/Yhh8BznvKnJ+uzEoTQ6jVKJRn81BiS4=
 github.com/cloudwego/base64x v0.1.6 h1:t11wG9AECkCDk5fMSoxmufanudBtJ+/HemLstXDLI2M=
 github.com/cloudwego/base64x v0.1.6/go.mod h1:OFcloc187FXDaYHvrNIjxSe8ncn0OOM8gEHfghB2IPU=
 github.com/containerd/errdefs v1.0.0 h1:tg5yIfIlQIrxYtu9ajqY42W3lpS19XqdxRQeEwYG8PI=
@@ -94,6 +101,8 @@ github.com/creativeprojects/go-selfupdate v1.5.2 h1:3KR3JLrq70oplb9yZzbmJ89qRP78
 github.com/creativeprojects/go-selfupdate v1.5.2/go.mod h1:BCOuwIl1dRRCmPNRPH0amULeZqayhKyY2mH/h4va7Dk=
 github.com/crewjam/saml v0.5.1 h1:g+mfp0CrLuLRZCK793PgJcZeg5dS/0CDwoeAX2zcwNI=
 github.com/crewjam/saml v0.5.1/go.mod h1:r0fDkmFe5URDgPrmtH0IYokva6fac3AUdstiPhyEolQ=
+github.com/cyphar/filepath-securejoin v0.6.1 h1:5CeZ1jPXEiYt3+Z6zqprSAgSWiggmpVyciv8syjIpVE=
+github.com/cyphar/filepath-securejoin v0.6.1/go.mod h1:A8hd4EnAeyujCJRrICiOWqjS1AX0a9kM5XL+NwKoYSc=
 github.com/davecgh/go-spew v1.1.0/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
 github.com/davecgh/go-spew v1.1.1/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
 github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc h1:U9qPSI2PIWSS1VwoXQT9A3Wy9MM3WgvqSxFWenqJduM=
@@ -110,6 +119,8 @@ github.com/docker/go-connections v0.5.0 h1:USnMq7hx7gwdVZq1L49hLXaFtUdTADjXGp+uj
 github.com/docker/go-connections v0.5.0/go.mod h1:ov60Kzw0kKElRwhNs9UlUHAE/F9Fe6GLaXnqyDdmEXc=
 github.com/docker/go-units v0.5.0 h1:69rxXcBk27SvSaaxTtLh/8llcHD8vYHT7WSdRZ/jvr4=
 github.com/docker/go-units v0.5.0/go.mod h1:fgPhTUdO+D/Jk86RDLlptpiXQzgHJF7gydDDbaIK4Dk=
+github.com/emirpasic/gods v1.18.1 h1:FXtiHYKDGKCW2KzwZKx0iC0PQmdlorYgdFG9jPXJ1Bc=
+github.com/emirpasic/gods v1.18.1/go.mod h1:8tpGGwCnJ5H4r6BWwaV6OrWmMoPhUl5jm/FMNAnJvWQ=
 github.com/fatih/color v1.16.0 h1:zmkK9Ngbjj+K0yRhTVONQh1p/HknKYSlNT+vZCzyokM=
 github.com/fatih/color v1.16.0/go.mod h1:fL2Sau1YI5c0pdGEVCbKQbLXB6edEj1ZgiY4NijnWvE=
 github.com/felixge/httpsnoop v1.0.4 h1:NFTV2Zj1bL4mc9sqWACXbQFVBBg2W3GPvqp8/ESS2Wg=
@@ -132,6 +143,12 @@ github.com/go-asn1-ber/asn1-ber v1.5.8-0.20250403174932-29230038a667 h1:BP4M0CvQ
 github.com/go-asn1-ber/asn1-ber v1.5.8-0.20250403174932-29230038a667/go.mod h1:hEBeB/ic+5LoWskz+yKT7vGhhPYkProFKoKdwZRWMe0=
 github.com/go-fed/httpsig v1.1.0 h1:9M+hb0jkEICD8/cAiNqEB66R87tTINszBRTjwjQzWcI=
 github.com/go-fed/httpsig v1.1.0/go.mod h1:RCMrTZvN1bJYtofsG4rd5NaO5obxQ5xBkdiS7xsT7bM=
+git
```

---

### Incident Patch 10: `dc353731` (2026-07-17)
**Commit Message**: fix(runner): repair runner/org deletion, harden registration, add FK-contract CI gate (#455)

Originating bug: deleting a runner 500'd — runner_pending_auths kept the only
non-cascading FK into runners (and one into organizations), so DELETE raised
23503. This system enforces referential integrity in the service layer, not with
FK constraints, so the fix drops those two FKs (000162) rather than adding a
cascade, and wires the never-scheduled purge jobs that keep the table drained.

Along the way this hardens the whole interactive/token registration path and
adds the missing guardrails that let those bugs ship:

- FK contract CI gate: fk_allowlist.txt (SSOT for the 125 legacy FKs) +
  check_fk_allowlist.sh (pg_constraint-based, keyed on the delete rule so a
  CASCADE→NO ACTION regression is caught) + a base-ref ratchet that rejects any
  net-new FK. Documented the no-FK policy in CLAUDE.md.
- gazelle idempotency: `# keep` on amesh codegen srcs/deps + a root
  `# gazelle:exclude` for the lint-materialized *_convert.amesh.go, plus a
  post-lint idempotency check in the go-lint job. Fixes `bazel run //:gazelle`
  silently rewriting BUILD files.
- AuthorizeRunner is now atomic: claim+cr

**File**: `.github/workflows/bazel.yml` (modified, +91/-0)
```diff
@@ -57,6 +57,72 @@ jobs:
             fi
           done
 
+  schema:
+    name: Schema (FK contract)
+    runs-on: ubuntu-latest
+    timeout-minutes: 10
+    services:
+      postgres:
+        image: pgvector/pgvector:pg16
+        env:
+          POSTGRES_PASSWORD: pw
+          POSTGRES_DB: fkgate
+        ports:
+          - 5432:5432
+        options: >-
+          --health-cmd "pg_isready -h 127.0.0.1 -U postgres -d fkgate"
+          --health-interval 10s
+          --health-timeout 5s
+          --health-retries 10
+    env:
+      DATABASE_URL: postgres://postgres:pw@localhost:5432/fkgate?sslmode=disable
+    steps:
+      - uses: actions/checkout@v6
+        with:
+          fetch-depth: 0
+      - name: Apply migrations
+        run: |
+          docker run --rm --network host -v "$PWD/backend/migrations:/m:ro" \
+            migrate/migrate:v4.19.0 -path=/m -database "$DATABASE_URL" up
+      - name: FK contract (allowlist matches the schema)
+        run: bash backend/migrations/check_fk_allowlist.sh
+      - name: FK allowlist may only shrink
+        if: github.event_name == 'pull_request'
+        env:
+          BASE_SHA: ${{ github.event.pull_request.base.sha }}
+        run: |
+          set -euo pipefail
+          export LC_ALL=C
+          list=backend/migrations/fk_allowlist.txt
+          # Fail hard if the base commit is missing (force-pushed base); only
+          # skip when the file genuinely does not exist there yet.
+          if ! git cat-file -e "${BASE_SHA}^{commit}" 2>/dev/null; then
+            echo "::error::base commit $BASE_SHA is not in this clone"
+            exit 1
+          fi
+          if ! git cat-file -e "$BASE_SHA:$list" 2>/dev/null; then
+            echo "$list is new on this branch; nothing to ratchet against."
+            exit 0
+          fi
+          # Counts, not diff lines and not entry sets: a table rename rewrites
+          # its entry (the key carries the table name) without adding an FK, and
+          # this repo has done exactly that -- see the ralph_pods_* constraint
+          # names still on autopilot_controllers. Both finer-grained checks fail
+          # such a PR with no escape hatch. Counting enforces what the contract
+          # actually claims (只减不增); check_fk_allowlist.sh separately pins the
+          # list to the real schema, so the count cannot be faked.
+          entries() { grep -cvE '^[[:space:]]*(#|$)' || :; }
+          base_n="$(git cat-file -p "$BASE_SHA:$list" | entries)"
+          head_n="$(entries < "$list")"
+          if [ "$head_n" -gt "$base_n" ]; then
+            echo "::error::fk_allowlist.txt grew from $base_n to $head_n entries. This system"
+            echo "::error::does not use FKs (CLAUDE.md 外键契约) -- the list may only shrink."
+            echo "::error::Do not silence the schema check by appending to it."
+            git diff "$BASE_SHA" -- "$list" | sed 's/^/    /'
+            exit 1
+          fi
+          echo "OK: allowlist did not grow ($base_n -> $head_n)."
+
   go:
     name: Go (tests)
     runs-on: ubuntu-latest
@@ -134,6 +200,31 @@ jobs:
       # re-materializing every transitive Go file as runfiles.
       - run: bazel run //${{ matrix.module }}:lint
 
+      # Deliberately after lint, and only on backend: the lint runner copies the
+      # amesh_proto_convert outputs into the source tree for golangci-lint's
+      # typecheck, and that polluted tree is the state gazelle actually breaks on
+      # for developers. Running this in a job that never lints would exercise the
+      # `# keep` markers but never the `# gazelle:exclude` that handles those
+      # copies -- i.e. it could not catch the regression it exists to catch.
+      - name: Gazelle is idempotent (post-lint tree)
+        if: matrix.module == 'backend'
+        run: |
+          set -euo pipefail
+          bazel run //:gazelle
+          # --porcelain, not `git diff`: gazelle's most common miss is generating
+          # a BUILD.bazel for a brand-new package, which is untracked and so
+          # invisible to git diff. Scoped to BUILD.bazel so bazel's own
+          # MODULE.bazel.lock churn is not misreported as gazelle's doing.
+          drift="$(git status --porcelain -- '**/BUILD.bazel' 'BUILD.bazel')"
+          if [ -n "$drift" ]; then
+            echo "::error::Running gazelle changed BUILD files. Either commit its output, or"
+            echo "::error::-- if it stripped a generated src/dep it cannot see -- mark that line '# keep'."
+            echo "$drift"
+            git diff -- '**/BUILD.bazel' 'BUILD.bazel'
+            exit 1
+          fi
+          echo "OK: gazelle is a no-op on the post-lint tree."
+
   go-windows:
     name: Runner Tests (Windows)
     runs-on: windows-latest
```

**File**: `BUILD.bazel` (modified, +5/-0)
```diff
@@ -13,6 +13,11 @@ load("@gazelle//:def.bzl", "gazelle")
 load("@npm//:defs.bzl", "npm_link_all_packages")
 
 # gazelle:prefix github.com/anthropics/agentsmesh
+# `bazel run //backend:lint` copies the amesh_proto_convert outputs from
+# bazel-bin into the source tree so golangci-lint's typecheck can see them
+# (build_defs/go/golangci_lint_runner.sh). They are gitignored, so gazelle
+# would otherwise pick up a stale copy and swap out the codegen target.
+# gazelle:exclude **/*_convert.amesh.go
 # gazelle:proto disable_global
 # gazelle:go_naming_convention import_alias
 # gazelle:resolve go github.com/anthropics/agentsmesh/proto/gen/go/runner/v1 //proto/runner/v1:runner_go_proto
```

**File**: `CLAUDE.md` (modified, +64/-1)
```diff
@@ -114,7 +114,10 @@ docker compose logs -f postgres                  # docker infra
 bazel info workspace
 bazel run //:buildifier_check
 
-# Regenerate Go BUILD.bazel files after editing imports / adding packages
+# Regenerate Go BUILD.bazel files after editing imports / adding packages.
+# 跑完务必 `git diff` —— gazelle 只认磁盘上的 .go import，凡是它推不出来的
+# src/dep（codegen 产物、只被生成代码 import 的包）都会被删掉。这类行必须带
+# `# keep`，见下方「gazelle 与 codegen 产物」。CI 的 go-lint job 会验证幂等。
 bazel run //:gazelle
 
 # Build a Go binary + its OCI image
@@ -575,4 +578,64 @@ Or use an existing admin to grant privileges via the Admin Console UI.
 4. service 包加 `*Registry` helper 封装 `slugkit.GenerateUnique`
 5. 单测覆盖含 `.`/`_`/uppercase/unicode 的输入，断言落库值通过 `slugkit.Validate`
 
+## gazelle 与 codegen 产物
+
+gazelle 从磁盘上的 `.go` import 反推 `srcs`/`deps`。`amesh_proto_convert`（`//build_defs/protoconv`）的产物只存在于 bazel-bin，gazelle 看不见 —— 它会把 `:*_convert_amesh` 从 srcs 删掉，连带删掉只被生成代码 import 的 deps（`//backend/pkg/protoconv`、`//backend/internal/domain/*`），于是 `undefined: ToProtoX`。
+
+**凡是 gazelle 推不出来的行，必须标 `# keep`：**
+
+```python
+go_library(
+    srcs = [
+        "binding.go",
+        ":binding_convert_amesh",  # keep
+    ],
+    deps = [
+        "//backend/pkg/protoconv",  # keep
+    ],
+)
+```
+
+新增一个 `amesh_proto_convert` 包时照此办理，否则下一个跑 gazelle 的人会打断构建。CI 的 `go-lint` job 里 `Gazelle is idempotent (post-lint tree)` 会拦 —— 它**故意排在 lint 之后**，因为只有那时源码树才处于会触发问题的状态。
+
+> **源码树里出现 `*_convert.amesh.go` 是正常的，别去删。** `bazel run //backend:lint` 会把 bazel-bin 里的产物拷进源码树 —— golangci-lint 的 typecheck 必须看得见它们（`build_defs/go/golangci_lint_runner.sh`）。它们被 .gitignore 忽略，所以 `git status` 看不见。
+>
+> 于是 `lint` → `gazelle` 这个顺序（两条都是本文档推荐的命令）会让 gazelle 捡起这些文件、把它们当成手写 src 加进 `srcs`，和 `# keep` 住的 codegen target 撞成重复符号。根 `BUILD.bazel` 的 `# gazelle:exclude **/*_convert.amesh.go` 挡住这一步 —— **两个工具都没错，错在它们互不知情**。
+
+## 外键契约：本系统不使用外键
+
+**引用完整性由 service 层保证，不由 FK 约束保证。** 理由见 migration 000072：高写表上 FK 校验拖慢每次 INSERT，大表上 `ON DELETE CASCADE` 会拉出长事务和表锁。
+
+**新建表禁止写 `REFERENCES`。** 父子关系用普通列 + 索引表达（`runner_id BIGINT NOT NULL` + `CREATE INDEX`），不写约束。CI 的 `Schema (FK contract)` job 会拦：它把全部 migration 跑到一个空库上，再比对 `backend/migrations/fk_allowlist.txt`。
+
+```bash
+# 本地复现 CI 门禁（psql 若不在 host PATH，用 --entrypoint bash 跑在容器里）
+URL="postgres://postgres:pw@localhost:15999/fkgate?sslmode=disable"
+docker run -d --name pg -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=fkgate -p 15999:5432 pgvector/pgvector:pg16
+docker run --rm --network host -v "$PWD/backend/migrations:/m:ro" migrate/migrate:v4.19.0 -path=/m -database "$URL" up
+backend/migrations/check_fk_allowlist.sh "$URL"
+```
+
+新增/修改 identifier 之外的表时若 CI 报 FK 门禁失败，**不要往 allowlist 里加行** —— 那正是它拒绝的操作。
+
+### 删除契约（无 FK 之后，删除逻辑全在 Go 里）
+
+新增一张带父引用的表时，**必须**同时决定父被删除时它怎么办，三选一：
+
+| 策略 | 做法 | 例 |
+|---|---|---|
+| **随父删除** | 在父的 service/repo 删除路径里显式 `DELETE FROM child WHERE parent_id = ?` | `organizationRepo.DeleteWithCleanup` |
+| **拦住父删除** | 父的 service 里先 count，非零就返回 domain error，API 层映射成 409 | `CountLoopsByRunner` → `ErrRunnerHasLoopRefs` |
+| **自过期** | 表自带 `expires_at` + 后台 purge job；容忍孤儿行到期被清 | `runner_pending_auths` / `runner_reactivation_tokens` + `startRegistrationGC` |
+
+**漏掉这一步的代价**：手写清理清单漂移过两次，都炸到线上 —— SQLSTATE 42703（清单引用了不存在的列，阻断**所有** org 删除）、SQLSTATE 23503（漏了一张表 + 残留 FK，阻断 runner 删除和 15 个 org）。
+
+### 存量债
+
+`backend/migrations/fk_allowlist.txt` 是存量的 SSOT（数量以文件为准，不要在别处抄一份）。多数早于 000072，另有 9 个 migration 在 000072 之后新增。它们是债，正在分批 DROP —— **它们与本契约相悖，是意料之外的失败模式来源**。`DROP CONSTRAINT` 是 O(1) 元数据操作；反向 `ADD CONSTRAINT` 要全表扫描验证，所以还债便宜、走反方向贵。
+
+allowlist 的 key 里带 `[delete rule]`：CASCADE 被悄悄改成 NO ACTION 正是两次事故的根因，只比对列名的门禁看不见它。
+
+**门禁只覆盖 migration 跑在空库上的结果，不覆盖线上漂移**（手工 DDL 它看不到）。两个 CI step 各管一半：`FK contract` 断言 allowlist 与 schema 一致；`FK allowlist may only shrink` 对 base ref 做 diff，拒绝新增行 —— 没有后者的话，往 allowlist 里补一行就能让前者闭嘴。
+
 参见 `backend/pkg/slugkit/doc.go` 完整说明，`.claude/plans/sharded-imagining-bird.md` 重构 plan。
\ No newline at end of file
```

**File**: `backend/cmd/server/BUILD.bazel` (modified, +2/-0)
```diff
@@ -20,6 +20,7 @@ go_library(
         "main.go",
         "main_startup.go",
         "notif_dedup.go",
+        "registration_gc.go",
         "relay_init.go",
         "server.go",
         "services_init.go",
@@ -87,6 +88,7 @@ go_library(
         "//backend/internal/infra/otel",
         "//backend/internal/infra/pki",
         "//backend/internal/infra/storage",
+        "//backend/internal/infra/tasks",
         "//backend/internal/infra/websocket",
         "//backend/internal/interfaces",
         "//backend/internal/job",
```

**File**: `backend/cmd/server/main.go` (modified, +3/-1)
```diff
@@ -180,10 +180,12 @@ func main() {
 	cleanupMkt := startMarketplaceWorker(services)
 	defer cleanupMkt()
 
+	registrationGC := startRegistrationGC(services, appLogger.Logger)
+
 	subscriptionScheduler := startSubscriptionJobs(db, cfg, services.email, appLogger.Logger)
 
 	// Start HTTP server (Connect-RPC handlers wrap the Gin router)
 	srv := startHTTPServer(cfg, wrapWithConnect(cfg, services, svc, router))
 
-	waitForShutdown(srv, grpcResult.server, eventBus, heartbeatBatcher, subscriptionScheduler, loopScheduler, orgAwareness, relayManager, services, db, redisClient)
+	waitForShutdown(srv, grpcResult.server, eventBus, heartbeatBatcher, subscriptionScheduler, loopScheduler, orgAwareness, relayManager, registrationGC, services, db, redisClient)
 }
```

**File**: `backend/cmd/server/registration_gc.go` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+package main
+
+import (
+	"log/slog"
+	"time"
+
+	"github.com/anthropics/agentsmesh/backend/internal/infra/tasks"
+)
+
+// At most each table's TTL (15 min pending auths, 10 min reactivation tokens),
+// so a dead row's residency is bounded by the interval, not by a multiple of its
+// own lifetime. Also caps each purge's query budget: tasks.Scheduler derives the
+// run context from Interval*2.
+const registrationGCInterval = 10 * time.Minute
+
+// Both tables are self-expiring but nothing ever drained them, so they grew
+// without bound and — while runner_pending_auths still had FKs — wedged runner
+// and organization deletion.
+func startRegistrationGC(services *serviceContainer, logger *slog.Logger) *tasks.Scheduler {
+	scheduler := tasks.NewScheduler(logger)
+
+	for _, task := range []*tasks.Task{
+		{
+			Name:       "pending_auth_purge",
+			Interval:   registrationGCInterval,
+			Func:       services.runner.CleanupExpiredPendingAuths,
+			RunOnStart: true,
+		},
+		{
+			Name:       "reactivation_token_purge",
+			Interval:   registrationGCInterval,
+			Func:       services.runner.CleanupExpiredReactivationTokens,
+			RunOnStart: true,
+		},
+	} {
+		if err := scheduler.Register(task); err != nil {
+			logger.Error("failed to register registration GC task", "task", task.Name, "error", err)
+			return nil
+		}
+	}
+
+	scheduler.Start()
+	return scheduler
+}
```

**File**: `backend/cmd/server/server.go` (modified, +6/-0)
```diff
@@ -15,6 +15,7 @@ import (
 	"github.com/anthropics/agentsmesh/backend/internal/infra/database"
 	"github.com/anthropics/agentsmesh/backend/internal/infra/email"
 	"github.com/anthropics/agentsmesh/backend/internal/infra/eventbus"
+	"github.com/anthropics/agentsmesh/backend/internal/infra/tasks"
 	"github.com/anthropics/agentsmesh/backend/internal/job"
 	"github.com/anthropics/agentsmesh/backend/internal/service/instance"
 	"github.com/anthropics/agentsmesh/backend/internal/service/relay"
@@ -63,6 +64,7 @@ func waitForShutdown(
 	loopScheduler LoopSchedulerStopper,
 	orgAwareness *instance.OrgAwarenessService,
 	relayManager *relay.Manager,
+	registrationGC *tasks.Scheduler,
 	services *serviceContainer,
 	db *gorm.DB,
 	redisClient *redis.Client,
@@ -105,6 +107,10 @@ func waitForShutdown(
 		relayManager.Stop()
 	}
 
+	if registrationGC != nil {
+		registrationGC.Stop()
+	}
+
 	if services != nil {
 		services.Close()
 	}
```

**File**: `backend/internal/api/connect/admin/BUILD.bazel` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ go_library(
         "handlers_users_actions.go",
         "handlers_users_query.go",
         "server.go",
-        ":admin_convert_amesh",
+        ":admin_convert_amesh",  # keep
     ],
     importpath = "github.com/anthropics/agentsmesh/backend/internal/api/connect/admin",
     visibility = ["//backend:__subpackages__"],
```

---

### Incident Patch 11: `ce395766` (2026-06-24)
**Commit Message**: fix(desktop): restore window dragging from titlebar headers (macOS immersive) (#451)

#449 shrank the only -webkit-app-region:drag region into the ActivityBar,
leaving the main window's content headers and all popout windows undraggable
on macOS hiddenInset (v0.44.2 regression).

Make each window-top header bar its own drag region, with a global rule that
auto-carves interactive descendants back to no-drag (so header buttons stay
clickable; [draggable=true] also opts out to preserve HTML5 tab tear-off):
- app-drag on SideBar / ChannelHeader / TicketsPageHeader / BlocksDocHeader /
  MeshPage headers, plus the channel loading skeleton
- TerminalPaneHeader bar drags only in the popout (!canTearOff); main-window
  split panes keep HTML5 tab tear-off and never drag the window
- route-scoped no-activity-bar class on popout page roots insets the titlebar
  78px clear of the traffic lights, and drops when a popout navigates into the
  full IDE shell (the root unmounts) — fixes the static window-class corruption

Converged over 3 review rounds; see memory desktop_titlebar_app_region_pitfalls.

Co-authored-by: yishuiliunian <[REDACTED_EMAIL]>

**File**: `clients/desktop/src/renderer/globals.css` (modified, +22/-0)
```diff
@@ -207,6 +207,28 @@ body:has(.app-shell) {
 .app-no-drag {
   -webkit-app-region: no-drag;
 }
+/* -webkit-app-region is per-element (no inheritance); carve interactive descendants
+   back to no-drag so a draggable header keeps its buttons clickable. [draggable="true"]
+   opts out too — HTML5 tab tear-off is mutually exclusive with native app-region drag. */
+.app-drag button,
+.app-drag a,
+.app-drag input,
+.app-drag textarea,
+.app-drag select,
+.app-drag label,
+.app-drag [role="button"],
+.app-drag [role="textbox"],
+.app-drag [contenteditable="true"],
+.app-drag [draggable="true"] {
+  -webkit-app-region: no-drag;
+}
+/* A popout's titlebar header has no activity bar to its left, so it sits under the macOS
+   traffic lights — inset it clear. Route-scoped (not window-kind): no-activity-bar marks the
+   popout page root, so navigating into the full IDE shell drops the inset (the root unmounts).
+   78px = trafficLightPosition.x 14 + 3 lights (create_window.ts). */
+.platform-mac .no-activity-bar .app-drag {
+  padding-left: 78px;
+}
 
 /* Typography prose — map to theme CSS variables */
 .prose {
```

**File**: `clients/desktop/src/renderer/pages/dashboard/mesh/MeshPage.tsx` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ export function MeshPage() {
 
   return (
     <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
-      <header className="flex items-center justify-between border-b border-border px-6 py-3.5">
+      <header className="app-drag flex items-center justify-between border-b border-border px-6 py-3.5">
         <h1 className="text-[18px] font-semibold text-foreground">{t("mesh.page.title")}</h1>
 
         <div className="flex items-center gap-2">
```

**File**: `clients/desktop/src/renderer/pages/popout/channel/PopoutChannelPage.tsx` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ export function PopoutChannelPage() {
 
   return (
     <RealtimeProvider>
-      <div className="h-screen w-screen bg-background">
+      <div className="no-activity-bar h-screen w-screen bg-background">
         <ChannelChatPanel channelId={channelId} />
       </div>
     </RealtimeProvider>
```

**File**: `clients/desktop/src/renderer/pages/popout/terminal/PopoutTerminalPage.tsx` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ export function PopoutTerminalPage() {
 
   return (
     <RealtimeProvider>
-      <div className="h-screen w-screen bg-terminal-bg">
+      <div className="no-activity-bar h-screen w-screen bg-terminal-bg">
         <TerminalPane
           paneId={`popout-${podKey}`}
           podKey={podKey}
```

**File**: `clients/web/src/components/blocks/BlocksDocHeader.tsx` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ export function BlocksDocHeader({
     </>
   );
   return (
-    <div className="flex flex-col gap-1.5 border-b border-border px-12 pb-3 pt-4">
+    <div className="app-drag flex flex-col gap-1.5 border-b border-border px-12 pb-3 pt-4">
       <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
         <span>Pages</span>
         <span className="text-border">›</span>
```

**File**: `clients/web/src/components/channel/ChannelChatPanel.tsx` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ export function ChannelChatPanel({ channelId }: ChannelChatPanelProps) {
   if (chat.channelLoading && !chat.currentChannel) {
     return (
       <div className="flex flex-col h-full bg-background">
-        <div className="flex-shrink-0 border-b border-border px-4 py-3">
+        <div className="app-drag flex-shrink-0 border-b border-border px-4 py-3">
           <div className="h-8 w-32 bg-muted animate-pulse rounded" />
         </div>
         <div className="flex-1 flex items-center justify-center">
```

**File**: `clients/web/src/components/channel/ChannelHeader.tsx` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ export function ChannelHeader({
   }
 
   return (
-    <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-6 py-3">
+    <div className="app-drag flex flex-shrink-0 items-center justify-between border-b border-border px-6 py-3">
       <div className="flex min-w-0 items-center gap-2.5">
         <Icon
           className={cn(
```

**File**: `clients/web/src/components/ide/SideBar.tsx` (modified, +1/-1)
```diff
@@ -86,7 +86,7 @@ export function SideBar({ className, children, headerAction }: SideBarProps) {
       style={{ width: sidebarWidth }}
     >
       {activeActivity !== "settings" && (
-        <div className="flex h-12 items-center justify-between gap-2 border-b border-border/60 px-3">
+        <div className="app-drag flex h-12 items-center justify-between gap-2 border-b border-border/60 px-3">
           <div className="flex min-w-0 items-center gap-1.5">
             <Button
               variant="ghost"
```

---

### Incident Patch 12: `d208723b` (2026-06-22)
**Commit Message**: fix(desktop): remove full-width titlebar gap — spacer into left rail only (#449)

The immersive-titlebar drag spacer was a full-width strip at IDEShell's top,
pushing the sidebar/main cards down by --titlebar-drag-height (40px on macOS)
→ a gray band across the entire window top (desktop only; web stays 0).

Move the spacer back inside ActivityBar so the traffic-light reserve only
occupies the left rail; the sidebar/main cards now reach near the window top.

Co-authored-by: yishuiliunian <[REDACTED_EMAIL]>

**File**: `clients/web/src/components/ide/ActivityBar.tsx` (modified, +5/-0)
```diff
@@ -110,6 +110,11 @@ export function ActivityBar({ className }: ActivityBarProps) {
           className
         )}
       >
+        <div
+          className="app-drag shrink-0"
+          style={{ height: "var(--titlebar-drag-height)" }}
+          aria-hidden="true"
+        />
         <div className="app-drag flex h-12 items-center justify-start px-2">
           <OrgSwitcher />
         </div>
```

**File**: `clients/web/src/components/ide/IDEShell.tsx` (modified, +17/-25)
```diff
@@ -99,31 +99,23 @@ export function IDEShell({
   }
 
   return (
-    <div className={cn("app-shell flex flex-col h-screen bg-sidebar overflow-hidden", className)}>
-      <div
-        className="app-drag shrink-0"
-        style={{ height: "var(--titlebar-drag-height)" }}
-        aria-hidden="true"
-      />
-
-      <div className="flex min-h-0 flex-1">
-        <ActivityBar className="flex-shrink-0" />
-
-        <div className="flex min-w-0 flex-1 gap-2 p-2">
-          <SideBar className="flex-shrink-0" headerAction={sidebarHeaderAction}>{effectiveSidebarContent}</SideBar>
-
-          <div className="flex-1 flex flex-col min-w-0 overflow-hidden rounded-xl border border-border/50 bg-background shadow-sm">
-            <main
-              className={cn(
-                "flex-1 overflow-auto",
-                activeActivity === "workspace" && bottomPanelOpen ? "" : "pb-8"
-              )}
-            >
-              {children}
-            </main>
-
-            {activeActivity === "workspace" && <BottomPanel />}
-          </div>
+    <div className={cn("app-shell flex h-screen bg-sidebar overflow-hidden", className)}>
+      <ActivityBar className="flex-shrink-0" />
+
+      <div className="flex min-w-0 flex-1 gap-2 p-2">
+        <SideBar className="flex-shrink-0" headerAction={sidebarHeaderAction}>{effectiveSidebarContent}</SideBar>
+
+        <div className="flex-1 flex flex-col min-w-0 overflow-hidden rounded-xl border border-border/50 bg-background shadow-sm">
+          <main
+            className={cn(
+              "flex-1 overflow-auto",
+              activeActivity === "workspace" && bottomPanelOpen ? "" : "pb-8"
+            )}
+          >
+            {children}
+          </main>
+
+          {activeActivity === "workspace" && <BottomPanel />}
         </div>
       </div>
 
```

---

### Incident Patch 13: `0cc157d9` (2026-06-19)
**Commit Message**: refactor(clients): project UI state from Rust core state (fetch→state, zero-JSON) (#445)

Make UI state a projection of Rust-core state, not connect-rpc wire proto, across all 8 domains (channel/pod/runner/ticket/repository/autopilot/loop/mesh) and 3 ends (web/desktop/Rust).

- Write: listXRaw(wire bytes) -> Rust apply_fetched_X decodes wire->state and folds via existing set_* mutators (removes TS fromProtoX + xToProto).
- Read: Rust X_bytes() (prost encode of state proto) -> fromBinary -> xToCache (removes serde_json X_json).
- Desktop: ElectronXService mirrors via <domain>_proto_to_cache + <domain>_cache_to_bytes so the shared web selectors decode desktop and web identically; round-trip fidelity covered by *_cache_to_bytes.test.ts.
- Shared projections moved to electron-adapter/projections + service-interface/view-models (web reuses).
- Delete dead fetch dispatch chains and the dead runner apply_runner_status_event chain (runner status lives in Rust event_dispatch).
- mesh per-node getters share one memoized topology projection (no per-call full-topology decode).

All 8 verification gates green (Rust wasm/node_bridge/state, web src/unit/lint, electron-adapter type/unit, desktop:o

**File**: `clients/core/crates/node-bridge/index.d.ts` (modified, +21/-18)
```diff
@@ -25,18 +25,28 @@ export class AppState {
   apikeyRevokeConnect(request: Array<number>): Promise<Array<number>>
   apikeyUpdateConnect(request: Array<number>): Promise<Array<number>>
   appAutopilotAppendIteration(reqBytes: Array<number>): void
+  appAutopilotApplyFetchedControllers(respBytes: Array<number>): void
+  appAutopilotApplyFetchedCurrentController(respBytes: Array<number>): void
+  appAutopilotApplyFetchedIterations(key: string, respBytes: Array<number>): void
   appAutopilotControllersJson(): string
+  appAutopilotControllersProto(): Array<number>
   appAutopilotInsertController(reqBytes: Array<number>): void
   appAutopilotIterationsJson(key: string): string
+  appAutopilotIterationsProto(key: string): Array<number>
   appAutopilotPatchController(reqBytes: Array<number>): void
   appAutopilotRemoveControllerProto(reqBytes: Array<number>): void
-  appAutopilotReplaceCachedControllers(reqBytes: Array<number>): void
-  appAutopilotReplaceCachedIterations(reqBytes: Array<number>): void
   appAutopilotSetCurrentControllerProto(reqBytes: Array<number>): void
   appAutopilotThinkingHistoryJson(key: string): string
   appAutopilotThinkingJson(key: string): string
   appAutopilotUpdateThinkingProto(reqBytes: Array<number>): void
   appAvailableRunnersJson(): string
+  appAvailableRunnersProto(): Array<number>
+  appChannelApplyFetchedChannel(respBytes: Array<number>): void
+  appChannelApplyFetchedChannels(respBytes: Array<number>): void
+  appChannelApplyFetchedMembers(channelId: number, respBytes: Array<number>): void
+  appChannelApplyFetchedMessages(channelId: number, respBytes: Array<number>): void
+  appChannelApplyFetchedMessagesPrepend(channelId: number, respBytes: Array<number>): void
+  appChannelApplyFetchedPods(channelId: number, respBytes: Array<number>): void
   appChannelApplyMessageEdited(reqBytes: Array<number>): void
   appChannelClearUnread(channelId: number): void
   appChannelInsertChannel(reqBytes: Array<number>): void
@@ -45,42 +55,34 @@ export class AppState {
   appChannelMessagesJson(channelId: number): string
   appChannelPatchMemberCount(reqBytes: Array<number>): void
   appChannelPodsJson(channelId: number): string
-  appChannelPrependCachedMessages(reqBytes: Array<number>): void
   appChannelRemoveMember(reqBytes: Array<number>): void
   appChannelRemoveMessage(channelId: number, messageId: number): void
-  appChannelReplaceCachedChannels(reqBytes: Array<number>): void
-  appChannelReplaceCachedMessages(reqBytes: Array<number>): void
   appChannelReplaceMembers(reqBytes: Array<number>): void
   appChannelReplacePods(reqBytes: Array<number>): void
   appChannelReplaceUnreadCounts(reqBytes: Array<number>): void
   appChannelsJson(): string
   appChannelUnreadCountsJson(): string
   appCurrentRunnerJson(): string
+  appCurrentRunnerProto(): Array<number>
   appGetMeshNodeJson(podKey: string): string
   appGetPodJson(podKey: string): string
-  appLoopAppendCachedRuns(reqBytes: Array<number>): void
-  appLoopClearCurrentLoop(reqBytes: Array<number>): void
-  appLoopClearLoopRuns(reqBytes: Array<number>): void
-  appLoopInsertLoopRun(reqBytes: Array<number>): void
-  appLoopPatchLoopFromAction(reqBytes: Array<number>): void
-  appLoopPatchLoopRunStatus(reqBytes: Array<number>): void
-  appLoopReplaceCachedLoops(reqBytes: Array<number>): void
-  appLoopReplaceCachedRuns(reqBytes: Array<number>): void
-  appLoopSetCurrentLoop(reqBytes: Array<number>): void
+  appGetPodProto(podKey: string): Array<number>
   appMeshReplaceTopology(reqBytes: Array<number>): void
-  appPodAppendCachedPods(reqBytes: Array<number>): void
+  appPodApplyAppendedPods(respBytes: Array<number>): void
+  appPodApplyFetchedPods(respBytes: Array<number>): void
   appPodInsertCreated(reqBytes: Array<number>): void
   appPodMarkTerminated(reqBytes: Array<number>): void
   appPodPatchPerpetual(reqBytes: Array<number>): void
   appPodRemove(podKey: string): void
-  appPodReplaceCachedPods(reqBytes: Array<number>): void
   appPodsJson(): string
+  appRunnerApplyFetched(respBytes: Array<number>): void
+  appRunnerApplyFetchedAvailable(respBytes: Array<number>): void
+  appRunnerApplyFetchedCurrent(respBytes: Array<number>): void
   appRunnerPatch(reqBytes: Array<number>): void
   appRunnerRemove(reqBytes: Array<number>): void
-  appRunnerReplaceAvailable(reqBytes: Array<number>): void
-  appRunnerReplaceCached(reqBytes: Array<number>): void
   appRunnerSetCurrent(reqBytes: Array<number>): void
   appRunnersJson(): string
+  appRunnersProto(): Array<number>
   appSelectChannel(id: number | undefined | null): void
   appSetCurrentChannel(id: number | undefined | null): void
   appSetCurrentUser(userId: number | undefined | null): void
@@ -171,6 +173,7 @@ export class AppState {
   eventsDisconnect(): Promise<void>
   eventsGetConnectionState(): Promise<string>
   eventsGetTick(): number
+  eventsNudge(): Promise<void>
   eventsOnConnectionStateChange(callback: (err: unknown, arg: string) => void): Promise<number>
  
```

**File**: `clients/core/crates/node-bridge/src/commands/app_autopilot.rs` (modified, +97/-19)
```diff
@@ -1,6 +1,9 @@
 use napi_derive::napi;
 
 use agentsmesh_state::autopilot_state::{AutopilotController, AutopilotIteration};
+use agentsmesh_types::proto_autopilot_v1::{
+    AutopilotController as WireController, GetIterationsResponse, ListAutopilotControllersResponse,
+};
 use agentsmesh_types::proto_autopilot_state_v1::{
     AppendIterationRequest, AutopilotControllerSnapshot, AutopilotIterationSnapshot,
     InsertControllerRequest, PatchControllerRequest, RemoveControllerRequest,
@@ -53,6 +56,42 @@ fn from_iteration_snapshot(s: AutopilotIterationSnapshot) -> AutopilotIteration
     }
 }
 
+// Inverse of from_snapshot — state → proto Snapshot for the realtime mirror,
+// encoded into ReplaceCached*Request so the renderer decodes via the same
+// snapshotToController/Iteration projection as the mutators (shape parity).
+fn to_snapshot(c: AutopilotController) -> AutopilotControllerSnapshot {
+    AutopilotControllerSnapshot {
+        autopilot_controller_key: c.autopilot_controller_key,
+        pod_key: c.pod_key,
+        status: c.status,
+        phase: c.phase,
+        prompt: c.prompt,
+        max_iterations: c.max_iterations,
+        iteration_timeout_sec: c.iteration_timeout_sec,
+        no_progress_threshold: c.no_progress_threshold,
+        same_error_threshold: c.same_error_threshold,
+        approval_timeout_min: c.approval_timeout_min,
+        current_iteration: c.current_iteration,
+        control_agent_slug: c.control_agent_slug,
+        circuit_breaker_state: c.circuit_breaker_state,
+        circuit_breaker_reason: c.circuit_breaker_reason,
+        created_at: c.created_at,
+        updated_at: c.updated_at,
+    }
+}
+
+fn to_iteration_snapshot(i: AutopilotIteration) -> AutopilotIterationSnapshot {
+    AutopilotIterationSnapshot {
+        id: i.id,
+        controller_key: i.controller_key,
+        iteration_number: i.iteration_number,
+        status: i.status,
+        result: i.result,
+        started_at: i.started_at,
+        completed_at: i.completed_at,
+    }
+}
+
 #[napi]
 impl AppState {
     // ── Snapshot reads ──
@@ -86,16 +125,67 @@ impl AppState {
         }
     }
 
-    // ── Fetch-mirror mutators → runtime.state baseline ──
-
+    // Proto-bytes variants for the realtime mirror — reuse the *Request wrappers
+    // so the renderer decodes via snapshotToController/Iteration, not by assigning
+    // prost serde JSON (which flattens circuit_breaker_state, drifting from the
+    // mutators' nested circuit_breaker).
     #[napi]
-    pub fn app_autopilot_replace_cached_controllers(&self, req_bytes: Vec<u8>) -> napi::Result<()> {
-        let req = ReplaceCachedControllersRequest::decode(&req_bytes[..]).map_err(decode_err)?;
-        self.runtime
+    pub fn app_autopilot_controllers_proto(&self) -> Vec<u8> {
+        let controllers = self
+            .runtime
             .state
-            .write()
+            .read()
             .autopilot
-            .set_controllers(req.controllers.into_iter().map(from_snapshot).collect());
+            .controllers()
+            .iter()
+            .cloned()
+            .map(to_snapshot)
+            .collect();
+        ReplaceCachedControllersRequest { controllers }.encode_to_vec()
+    }
+
+    // Empty bytes when the key has no iterations → renderer skips (preserves
+    // cache), matching the old app_autopilot_iterations_json "" sentinel.
+    #[napi]
+    pub fn app_autopilot_iterations_proto(&self, key: String) -> Vec<u8> {
+        let guard = self.runtime.state.read();
+        match guard.autopilot.get_iterations(&key) {
+            Some(iters) => {
+                let iterations = iters.iter().cloned().map(to_iteration_snapshot).collect();
+                ReplaceCachedIterationsRequest {
+                    autopilot_controller_key: key,
+                    iterations,
+                }
+                .encode_to_vec()
+            }
+            None => Vec::new(),
+        }
+    }
+
+    // ── Fetch-mirror mutators → runtime.state baseline ──
+
+    // Fetch→state baseline: decode wire ListAutopilotControllersResponse + fold
+    // into runtime.state so the post-dispatch realtime snapshot carries it.
+    #[napi]
+    pub fn app_autopilot_apply_fetched_controllers(&self, resp_bytes: Vec<u8>) -> napi::Result<()> {
+        let resp = ListAutopilotControllersResponse::decode(&resp_bytes[..]).map_err(decode_err)?;
+        self.runtime.state.write().autopilot.apply_fetched_controllers(resp.items);
+        Ok(())
+    }
+
+    #[napi]
+    pub fn app_autopilot_apply_fetched_iterations(&self, key: String, resp_bytes: Vec<u8>) -> napi::Result<()> {
+        let resp = GetIterationsResponse::decode(&resp_bytes[..]).map_err(decode_err)?;
+        self.runtime.state.write().autopilot.apply_fetched_iterations(key, resp.items);
+        Ok(())
+    }
+
+    // Single-object fetch (B): decode wire GetAutopilotController response +
+    // upsert/set-current via the shared wire→state converter.
+   
```

**File**: `clients/core/crates/node-bridge/src/commands/app_channel.rs` (modified, +73/-25)
```diff
@@ -2,11 +2,13 @@ use napi_derive::napi;
 use std::collections::HashMap;
 
 use agentsmesh_state::channel_types::ChannelMessage;
+use agentsmesh_types::proto_channel_v1::{
+    Channel, ListChannelMembersResponse, ListChannelMessagesResponse, ListChannelPodsResponse,
+    ListChannelsResponse,
+};
 use agentsmesh_types::proto_channel_state_v1::{
     ApplyChannelMessageEditedEventRequest, InsertChannelMessageRequest, InsertChannelRequest,
-    PatchChannelMemberCountRequest, PrependCachedChannelMessagesRequest,
-    ReplaceCachedChannelMessagesRequest, ReplaceCachedChannelsRequest,
-    ReplaceChannelUnreadCountsRequest,
+    PatchChannelMemberCountRequest, ReplaceChannelUnreadCountsRequest,
 };
 use prost::Message as _;
 
@@ -55,50 +57,96 @@ impl AppState {
             .unwrap_or_else(|_| "{}".to_string())
     }
 
-    // ── Fetch-mirror mutators (renderer fire-and-forgets these so the
-    //    runtime.state baseline matches the renderer cache before realtime) ──
+    // ── Fetch→state (desktop main): decode wire response + fold into state,
+    //    replacing the renderer's wire-JSON-direct-store path. ──
 
     #[napi]
-    pub fn app_channel_replace_cached_channels(&self, req_bytes: Vec<u8>) -> napi::Result<()> {
-        let req = ReplaceCachedChannelsRequest::decode(&req_bytes[..]).map_err(decode_err)?;
-        self.runtime.state.write().channels.set_channels(req.channels);
+    pub fn app_channel_apply_fetched_channels(&self, resp_bytes: Vec<u8>) -> napi::Result<()> {
+        let resp = ListChannelsResponse::decode(&resp_bytes[..]).map_err(decode_err)?;
+        self.runtime.state.write().channels.apply_fetched_channels(resp.items);
         Ok(())
     }
 
+    // Single-object fetch (B): decode wire GetChannel response (Channel) + upsert.
     #[napi]
-    pub fn app_channel_insert_channel(&self, req_bytes: Vec<u8>) -> napi::Result<()> {
-        let req = InsertChannelRequest::decode(&req_bytes[..]).map_err(decode_err)?;
-        if let Some(channel) = req.channel {
-            let id = channel.id;
-            let mut guard = self.runtime.state.write();
-            if guard.channels.get_channel(id).is_some() {
-                guard.channels.update_channel(id, channel);
-            } else {
-                guard.channels.add_channel(channel);
-            }
-        }
+    pub fn app_channel_apply_fetched_channel(&self, resp_bytes: Vec<u8>) -> napi::Result<()> {
+        let channel = Channel::decode(&resp_bytes[..]).map_err(decode_err)?;
+        self.runtime.state.write().channels.apply_fetched_channel(channel);
         Ok(())
     }
 
     #[napi]
-    pub fn app_channel_replace_cached_messages(&self, req_bytes: Vec<u8>) -> napi::Result<()> {
-        let req = ReplaceCachedChannelMessagesRequest::decode(&req_bytes[..]).map_err(decode_err)?;
+    pub fn app_channel_apply_fetched_messages(
+        &self,
+        channel_id: i64,
+        resp_bytes: Vec<u8>,
+    ) -> napi::Result<()> {
+        let resp = ListChannelMessagesResponse::decode(&resp_bytes[..]).map_err(decode_err)?;
         self.runtime
             .state
             .write()
             .channels
-            .set_messages(req.channel_id, req.messages, req.has_more);
+            .apply_fetched_messages(channel_id, resp.items, resp.has_more);
         Ok(())
     }
 
     #[napi]
-    pub fn app_channel_prepend_cached_messages(&self, req_bytes: Vec<u8>) -> napi::Result<()> {
-        let req = PrependCachedChannelMessagesRequest::decode(&req_bytes[..]).map_err(decode_err)?;
+    pub fn app_channel_apply_fetched_messages_prepend(
+        &self,
+        channel_id: i64,
+        resp_bytes: Vec<u8>,
+    ) -> napi::Result<()> {
+        let resp = ListChannelMessagesResponse::decode(&resp_bytes[..]).map_err(decode_err)?;
         self.runtime
             .state
             .write()
             .channels
-            .prepend_messages(req.channel_id, req.messages, req.has_more);
+            .apply_fetched_messages_prepend(channel_id, resp.items, resp.has_more);
+        Ok(())
+    }
+
+    #[napi]
+    pub fn app_channel_apply_fetched_members(
+        &self,
+        channel_id: i64,
+        resp_bytes: Vec<u8>,
+    ) -> napi::Result<()> {
+        let resp = ListChannelMembersResponse::decode(&resp_bytes[..]).map_err(decode_err)?;
+        self.runtime
+            .state
+            .write()
+            .channels
+            .apply_fetched_members(channel_id, resp.items);
+        Ok(())
+    }
+
+    #[napi]
+    pub fn app_channel_apply_fetched_pods(
+        &self,
+        channel_id: i64,
+        resp_bytes: Vec<u8>,
+    ) -> napi::Result<()> {
+        let resp = ListChannelPodsResponse::decode(&resp_bytes[..]).map_err(decode_err)?;
+        self.runtime
+            .state
+            .write()
+            .channels
+            .apply_fetched_pods(channel_id, resp.items);
+        Ok(())
+    }
+
+    #[napi]
+    pub fn app_channel_insert_channel(&self, req_bytes: Vec<u8>) -> napi::Result
```

**File**: `clients/core/crates/node-bridge/src/commands/app_loop.rs` (removed, +0/-141)
```diff
@@ -1,141 +0,0 @@
-use napi_derive::napi;
-
-use agentsmesh_state::loop_state::{LoopData, LoopRunData};
-use agentsmesh_types::proto_loop_v1::{Loop as ProtoLoop, LoopRun as ProtoLoopRun};
-use agentsmesh_types::proto_loop_state_v1::{
-    AppendCachedRunsRequest, ClearCurrentLoopRequest, ClearLoopRunsRequest, InsertLoopRunRequest,
-    PatchLoopFromActionRequest, PatchLoopRunStatusRequest, ReplaceCachedLoopsRequest,
-    ReplaceCachedRunsRequest, SetCurrentLoopRequest,
-};
-use prost::Message as _;
-
-use crate::AppState;
-
-// Loop state surface over the shared `runtime.state` (dispatch-hook SSOT),
-// mirroring app_autopilot.rs. The LoopRun* dispatch arms (event_dispatch.rs)
-// already write `runtime.state.loops`; these fetch-mirror mutators keep that
-// same store fed from the TS adapter so reads never diverge from realtime.
-fn decode_err(e: impl std::fmt::Display) -> napi::Error {
-    napi::Error::from_reason(format!("decode: {e}"))
-}
-
-fn loop_from_proto(p: ProtoLoop) -> LoopData {
-    LoopData {
-        id: p.id,
-        slug: p.slug,
-        name: p.name,
-        description: p.description,
-        schedule: None,
-        is_enabled: false,
-        status: Some(p.status),
-        agent_slug: Some(p.agent_slug),
-        permission_mode: Some(p.permission_mode),
-        prompt_template: Some(p.prompt_template),
-        config_overrides: serde_json::from_str(&p.config_overrides_json).ok(),
-        prompt_variables: serde_json::from_str(&p.prompt_variables_json).ok(),
-        execution_mode: Some(p.execution_mode),
-        autopilot_config: serde_json::from_str(&p.autopilot_config_json).ok(),
-        sandbox_strategy: Some(p.sandbox_strategy),
-        session_persistence: Some(p.session_persistence),
-        concurrency_policy: Some(p.concurrency_policy),
-        max_concurrent_runs: Some(p.max_concurrent_runs),
-        max_retained_runs: Some(p.max_retained_runs),
-        timeout_minutes: Some(p.timeout_minutes),
-        idle_timeout_sec: Some(p.idle_timeout_sec),
-        total_runs: Some(p.total_runs),
-        successful_runs: Some(p.successful_runs),
-        failed_runs: Some(p.failed_runs),
-        active_run_count: Some(p.active_run_count),
-        last_run_at: p.last_run_at,
-        created_at: Some(p.created_at),
-        updated_at: Some(p.updated_at),
-        used_env_bundles: p.used_env_bundles,
-    }
-}
-
-fn run_from_proto(p: ProtoLoopRun) -> LoopRunData {
-    LoopRunData {
-        id: p.id,
-        loop_slug: String::new(),
-        run_number: Some(p.run_number),
-        status: p.status,
-        pod_key: p.pod_key,
-        started_at: p.started_at,
-        completed_at: p.completed_at,
-        error_message: p.error_message,
-        created_at: Some(p.created_at),
-    }
-}
-
-#[napi]
-impl AppState {
-    #[napi]
-    pub fn app_loop_replace_cached_loops(&self, req_bytes: Vec<u8>) -> napi::Result<()> {
-        let req = ReplaceCachedLoopsRequest::decode(&req_bytes[..]).map_err(decode_err)?;
-        let loops = req.loops.into_iter().map(loop_from_proto).collect();
-        self.runtime.state.write().loops.set_loops(loops);
-        Ok(())
-    }
-
-    #[napi]
-    pub fn app_loop_set_current_loop(&self, req_bytes: Vec<u8>) -> napi::Result<()> {
-        let req = SetCurrentLoopRequest::decode(&req_bytes[..]).map_err(decode_err)?;
-        self.runtime.state.write().loops.set_current_loop(req.r#loop.map(loop_from_proto));
-        Ok(())
-    }
-
-    #[napi]
-    pub fn app_loop_clear_current_loop(&self, req_bytes: Vec<u8>) -> napi::Result<()> {
-        ClearCurrentLoopRequest::decode(&req_bytes[..]).map_err(decode_err)?;
-        self.runtime.state.write().loops.set_current_loop(None);
-        Ok(())
-    }
-
-    #[napi]
-    pub fn app_loop_patch_loop_from_action(&self, req_bytes: Vec<u8>) -> napi::Result<()> {
-        let req = PatchLoopFromActionRequest::decode(&req_bytes[..]).map_err(decode_err)?;
-        if let Some(l) = req.r#loop {
-            self.runtime.state.write().loops.update_loop(&req.slug, loop_from_proto(l));
-        }
-        Ok(())
-    }
-
-    #[napi]
-    pub fn app_loop_insert_loop_run(&self, req_bytes: Vec<u8>) -> napi::Result<()> {
-        let req = InsertLoopRunRequest::decode(&req_bytes[..]).map_err(decode_err)?;
-        if let Some(run) = req.run {
-            self.runtime.state.write().loops.add_run(run_from_proto(run));
-        }
-        Ok(())
-    }
-
-    #[napi]
-    pub fn app_loop_replace_cached_runs(&self, req_bytes: Vec<u8>) -> napi::Result<()> {
-        let req = ReplaceCachedRunsRequest::decode(&req_bytes[..]).map_err(decode_err)?;
-        let runs = req.runs.into_iter().map(run_from_proto).collect();
-        self.runtime.state.write().loops.set_runs(runs);
-        Ok(())
-    }
-
-    #[napi]
-    pub fn app_loop_append_cached_runs(&self, req_bytes: Vec<u8>) -> napi::Result<()> {
-        let req = AppendCachedRunsRequest::decode(&req_bytes[..]).map_err(decode_err)?;
-        let runs
```

**File**: `clients/core/crates/node-bridge/src/commands/app_mesh.rs` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ use prost::Message as _;
 use crate::AppState;
 
 // Mesh state surface over the shared `runtime.state` (SSOT), mirroring
-// app_autopilot.rs / app_loop.rs. fetch_topology fills the full topology;
+// app_autopilot.rs. fetch_topology fills the full topology;
 // pod status/agent events patch individual nodes via event_dispatch
 // (mesh_state.update_node_status), and app_get_mesh_node_json reads those
 // patched nodes for the desktop realtime mirror.
```

**File**: `clients/core/crates/node-bridge/src/commands/app_pod.rs` (modified, +22/-6)
```diff
@@ -1,5 +1,6 @@
 use napi_derive::napi;
 
+use agentsmesh_types::proto_pod_v1::ListPodsResponse;
 use agentsmesh_types::proto_pod_state_v1::{
     AppendCachedPodsRequest, InsertCreatedPodRequest, MarkPodTerminatedRequest,
     PatchPodPerpetualRequest, ReplaceCachedPodsRequest,
@@ -37,20 +38,35 @@ impl AppState {
         }
     }
 
+    // Proto-bytes variant for the realtime snapshot mirror — the renderer decodes
+    // via fromBinary + podToCache (the fetch projection) for shape parity, not by
+    // merging prost serde JSON. app_get_pod_json stays for the e2e list/detail
+    // consistency probe.
+    #[napi]
+    pub fn app_get_pod_proto(&self, pod_key: String) -> Vec<u8> {
+        match self.runtime.state.read().pods.get_pod(&pod_key) {
+            Some(pod) => pod.encode_to_vec(),
+            None => Vec::new(),
+        }
+    }
+
     // ── Fetch / user-action mirror mutators → runtime.state baseline ──
 
+    // Fetch→state (desktop main): decode wire ListPodsResponse + fold into
+    // state, mirroring the wasm apply_fetched_pods. Wire Pod == cache Pod, so
+    // it's identity — the renderer fans the same wire bytes here.
     #[napi]
-    pub fn app_pod_replace_cached_pods(&self, req_bytes: Vec<u8>) -> napi::Result<()> {
-        let req = ReplaceCachedPodsRequest::decode(&req_bytes[..]).map_err(decode_err)?;
-        self.runtime.state.write().pods.set_pods(req.pods);
+    pub fn app_pod_apply_fetched_pods(&self, resp_bytes: Vec<u8>) -> napi::Result<()> {
+        let resp = ListPodsResponse::decode(&resp_bytes[..]).map_err(decode_err)?;
+        self.runtime.state.write().pods.set_pods(resp.items);
         Ok(())
     }
 
     #[napi]
-    pub fn app_pod_append_cached_pods(&self, req_bytes: Vec<u8>) -> napi::Result<()> {
-        let req = AppendCachedPodsRequest::decode(&req_bytes[..]).map_err(decode_err)?;
+    pub fn app_pod_apply_appended_pods(&self, resp_bytes: Vec<u8>) -> napi::Result<()> {
+        let resp = ListPodsResponse::decode(&resp_bytes[..]).map_err(decode_err)?;
         let mut guard = self.runtime.state.write();
-        for pod in req.pods {
+        for pod in resp.items {
             guard.pods.upsert_pod(pod, None);
         }
         Ok(())
```

**File**: `clients/core/crates/node-bridge/src/commands/app_runner.rs` (modified, +44/-9)
```diff
@@ -1,5 +1,8 @@
 use napi_derive::napi;
 
+use agentsmesh_types::proto_runner_api_v1::{
+    GetRunnerResponse, ListAvailableRunnersResponse, ListRunnersResponse,
+};
 use agentsmesh_types::proto_runner_state_v1::{
     PatchCachedRunnerRequest, RemoveCachedRunnerRequest, ReplaceAvailableRunnersRequest,
     ReplaceCachedRunnersRequest, SetCurrentRunnerRequest,
@@ -39,29 +42,61 @@ impl AppState {
         }
     }
 
-    // ── Fetch-mirror mutators → runtime.state baseline ──
+    // Proto-bytes variants for the realtime snapshot mirror — reuse the *Request
+    // wrappers so the renderer decodes via fromBinary + runnerToCache (the fetch
+    // projection) for shape parity, not by assigning prost serde JSON.
+    #[napi]
+    pub fn app_runners_proto(&self) -> Vec<u8> {
+        let runners = self.runtime.state.read().runners.runners().to_vec();
+        ReplaceCachedRunnersRequest { runners }.encode_to_vec()
+    }
 
     #[napi]
-    pub fn app_runner_replace_cached(&self, req_bytes: Vec<u8>) -> napi::Result<()> {
-        let req = ReplaceCachedRunnersRequest::decode(&req_bytes[..]).map_err(decode_err)?;
-        self.runtime.state.write().runners.set_runners(req.runners);
-        Ok(())
+    pub fn app_available_runners_proto(&self) -> Vec<u8> {
+        let runners = self.runtime.state.read().runners.available_runners().to_vec();
+        ReplaceAvailableRunnersRequest { runners }.encode_to_vec()
     }
 
     #[napi]
-    pub fn app_runner_replace_available(&self, req_bytes: Vec<u8>) -> napi::Result<()> {
-        let req = ReplaceAvailableRunnersRequest::decode(&req_bytes[..]).map_err(decode_err)?;
-        self.runtime.state.write().runners.set_available_runners(req.runners);
-        Ok(())
+    pub fn app_current_runner_proto(&self) -> Vec<u8> {
+        let runner = self.runtime.state.read().runners.current_runner().cloned();
+        SetCurrentRunnerRequest { runner }.encode_to_vec()
     }
 
+    // ── Fetch-mirror mutators → runtime.state baseline ──
+
     #[napi]
     pub fn app_runner_set_current(&self, req_bytes: Vec<u8>) -> napi::Result<()> {
         let req = SetCurrentRunnerRequest::decode(&req_bytes[..]).map_err(decode_err)?;
         self.runtime.state.write().runners.set_current_runner(req.runner);
         Ok(())
     }
 
+    // Fetch→state (B): decode wire ListRunners(Available)Response + fold into
+    // runtime.state. Wire Runner == cache Runner, so no conversion.
+    #[napi]
+    pub fn app_runner_apply_fetched(&self, resp_bytes: Vec<u8>) -> napi::Result<()> {
+        let resp = ListRunnersResponse::decode(&resp_bytes[..]).map_err(decode_err)?;
+        self.runtime.state.write().runners.set_runners(resp.items);
+        Ok(())
+    }
+
+    #[napi]
+    pub fn app_runner_apply_fetched_available(&self, resp_bytes: Vec<u8>) -> napi::Result<()> {
+        let resp = ListAvailableRunnersResponse::decode(&resp_bytes[..]).map_err(decode_err)?;
+        self.runtime.state.write().runners.set_available_runners(resp.items);
+        Ok(())
+    }
+
+    // Single-object fetch (B): decode wire GetRunnerResponse + set current from
+    // its runner field.
+    #[napi]
+    pub fn app_runner_apply_fetched_current(&self, resp_bytes: Vec<u8>) -> napi::Result<()> {
+        let resp = GetRunnerResponse::decode(&resp_bytes[..]).map_err(decode_err)?;
+        self.runtime.state.write().runners.set_current_runner(resp.runner);
+        Ok(())
+    }
+
     #[napi]
     pub fn app_runner_patch(&self, req_bytes: Vec<u8>) -> napi::Result<()> {
         let req = PatchCachedRunnerRequest::decode(&req_bytes[..]).map_err(decode_err)?;
```

**File**: `clients/core/crates/node-bridge/src/commands/mod.rs` (modified, +0/-1)
```diff
@@ -2,7 +2,6 @@ pub mod apikey;
 pub mod app_autopilot;
 pub mod app_channel;
 pub mod app_channel_pods;
-pub mod app_loop;
 pub mod app_mesh;
 pub mod app_pod;
 pub mod app_runner;
```

---

### Incident Patch 14: `e777aa25` (2026-06-16)
**Commit Message**: fix(blocks): sub-pages render as navigable links instead of inlined content (#442)

Nested page blocks rendered their full subtree inline in the parent page. Route every depth>0 page block through SubPageLink (single chokepoint in PageRenderer) so a sub-page shows as a navigable link and opens as an independent page.

Arch cleanups bundled in: page-aware jump (useJumpToBlock + findOwnerPage) navigates to the target's owner page before scrolling, fixing silent jump failures now that sub-page content is no longer inlined; pageDisplayMeta unifies title/icon derivation (4 copies -> 1); breadcrumb root degrades to a span when no navigate handler is provided.

Co-authored-by: yishuiliunian <[REDACTED_EMAIL]>

**File**: `clients/desktop/src/renderer/pages/dashboard/blocks/BlocksPage.tsx` (modified, +9/-16)
```diff
@@ -8,18 +8,13 @@ import { BlocksDocHeader } from "@/components/blocks/BlocksDocHeader";
 import { CenteredSpinner } from "@/components/ui/spinner";
 import { getErrorMessage } from "@/lib/utils";
 import { blockstoreApi } from "@/lib/api/facade/blockstoreApi";
+import { useSelectPage } from "@/lib/blockstore/useSelectPage";
+import { useJumpToBlock } from "@/lib/blockstore/useJumpToBlock";
+import { pageDisplayMeta } from "@/lib/blockstore/pageDisplayMeta";
 import type { Workspace } from "@/lib/viewModels/blockstore";
 import { useBlockstoreStore, useBlocks } from "@/stores/blockstore";
 import "@/stores/blockstoreSubscribe";
 
-function pageMeta(block: { data?: { title?: unknown; icon?: unknown }; text?: string | null } | undefined) {
-  if (!block) return { title: "Untitled", icon: undefined as string | undefined };
-  const t = block.data?.title;
-  const title = typeof t === "string" && t.trim() ? t : block.text?.trim() || "Untitled";
-  const icon = typeof block.data?.icon === "string" ? (block.data.icon as string) : undefined;
-  return { title, icon };
-}
-
 export function BlocksPage() {
   const t = useTranslations();
   const [searchParams] = useSearchParams();
@@ -30,6 +25,8 @@ export function BlocksPage() {
   const [searchOpen, setSearchOpen] = useState(false);
   const [menuOpen, setMenuOpen] = useState(false);
   const blocks = useBlocks();
+  const selectPage = useSelectPage();
+  const jumpToBlock = useJumpToBlock();
 
   const hydrate = async (ws: Workspace) => {
     setWorkspace(ws);
@@ -74,9 +71,9 @@ export function BlocksPage() {
   const rootId = workspace?.root_block_id ?? null;
   const selectedPageID = pageParam ?? rootId;
 
-  const rootMeta = useMemo(() => pageMeta(rootId ? blocks[rootId] : undefined), [rootId, blocks]);
+  const rootMeta = useMemo(() => pageDisplayMeta(rootId ? blocks[rootId] : undefined), [rootId, blocks]);
   const currentMeta = useMemo(
-    () => pageMeta(selectedPageID ? blocks[selectedPageID] : undefined),
+    () => pageDisplayMeta(selectedPageID ? blocks[selectedPageID] : undefined),
     [selectedPageID, blocks],
   );
 
@@ -93,6 +90,7 @@ export function BlocksPage() {
           currentIcon={currentMeta.icon}
           isRoot={selectedPageID === rootId}
           onAddBlock={() => setMenuOpen(true)}
+          onNavigateRoot={() => selectPage(rootId)}
         />
         <div className="min-h-0 flex-1 overflow-y-auto">
           <DocumentView
@@ -107,12 +105,7 @@ export function BlocksPage() {
         workspaceID={workspace.id}
         open={searchOpen}
         onClose={() => setSearchOpen(false)}
-        onJumpToBlock={(blockID) => {
-          const el = document.getElementById(`block-${blockID}`);
-          el?.scrollIntoView({ behavior: "smooth", block: "center" });
-          el?.classList.add("ring-2", "ring-primary");
-          setTimeout(() => el?.classList.remove("ring-2", "ring-primary"), 1500);
-        }}
+        onJumpToBlock={jumpToBlock}
       />
     </div>
   );
```

**File**: `clients/web/src/app/(dashboard)/[org]/blocks/page.tsx` (modified, +9/-16)
```diff
@@ -10,19 +10,14 @@ import { BlocksDocHeader } from "@/components/blocks/BlocksDocHeader";
 import { CenteredSpinner } from "@/components/ui/spinner";
 import { getErrorMessage } from "@/lib/utils";
 import { blockstoreApi } from "@/lib/api/facade/blockstoreApi";
+import { useSelectPage } from "@/lib/blockstore/useSelectPage";
+import { useJumpToBlock } from "@/lib/blockstore/useJumpToBlock";
+import { pageDisplayMeta } from "@/lib/blockstore/pageDisplayMeta";
 import type { Workspace } from "@/lib/viewModels/blockstore";
 import { useBlocks, useBlockstoreStore } from "@/stores/blockstore";
 import { useCurrentOrg } from "@/stores/auth";
 import "@/stores/blockstoreSubscribe";
 
-function pageMeta(block: { data?: { title?: unknown; icon?: unknown }; text?: string | null } | undefined) {
-  if (!block) return { title: "Untitled", icon: undefined as string | undefined };
-  const t = block.data?.title;
-  const title = typeof t === "string" && t.trim() ? t : block.text?.trim() || "Untitled";
-  const icon = typeof block.data?.icon === "string" ? (block.data.icon as string) : undefined;
-  return { title, icon };
-}
-
 export default function BlockstorePage() {
   const t = useTranslations();
   const searchParams = useSearchParams();
@@ -34,6 +29,8 @@ export default function BlockstorePage() {
   const [searchOpen, setSearchOpen] = useState(false);
   const [menuOpen, setMenuOpen] = useState(false);
   const blocks = useBlocks();
+  const selectPage = useSelectPage();
+  const jumpToBlock = useJumpToBlock();
 
   const hydrate = async (ws: Workspace) => {
     setWorkspace(ws);
@@ -79,9 +76,9 @@ export default function BlockstorePage() {
   const rootId = workspace?.root_block_id ?? null;
   const selectedPageID = pageParam ?? rootId;
 
-  const rootMeta = useMemo(() => pageMeta(rootId ? blocks[rootId] : undefined), [rootId, blocks]);
+  const rootMeta = useMemo(() => pageDisplayMeta(rootId ? blocks[rootId] : undefined), [rootId, blocks]);
   const currentMeta = useMemo(
-    () => pageMeta(selectedPageID ? blocks[selectedPageID] : undefined),
+    () => pageDisplayMeta(selectedPageID ? blocks[selectedPageID] : undefined),
     [selectedPageID, blocks],
   );
 
@@ -98,6 +95,7 @@ export default function BlockstorePage() {
           currentIcon={currentMeta.icon}
           isRoot={selectedPageID === rootId}
           onAddBlock={() => setMenuOpen(true)}
+          onNavigateRoot={() => selectPage(rootId)}
         />
         <div className="min-h-0 flex-1 overflow-y-auto">
           <DocumentView
@@ -112,12 +110,7 @@ export default function BlockstorePage() {
         workspaceID={workspace.id}
         open={searchOpen}
         onClose={() => setSearchOpen(false)}
-        onJumpToBlock={(blockID) => {
-          const el = document.getElementById(`block-${blockID}`);
-          el?.scrollIntoView({ behavior: "smooth", block: "center" });
-          el?.classList.add("ring-2", "ring-primary");
-          setTimeout(() => el?.classList.remove("ring-2", "ring-primary"), 1500);
-        }}
+        onJumpToBlock={jumpToBlock}
       />
     </div>
   );
```

**File**: `clients/web/src/components/blocks/BlocksDocHeader.tsx` (modified, +22/-4)
```diff
@@ -10,6 +10,7 @@ interface BlocksDocHeaderProps {
   currentIcon?: string;
   isRoot: boolean;
   onAddBlock: () => void;
+  onNavigateRoot?: () => void;
 }
 
 export function BlocksDocHeader({
@@ -19,16 +20,33 @@ export function BlocksDocHeader({
   currentIcon,
   isRoot,
   onAddBlock,
+  onNavigateRoot,
 }: BlocksDocHeaderProps) {
+  const rootLabel = (
+    <>
+      {rootIcon && <span className="mr-1" aria-hidden="true">{rootIcon}</span>}
+      {rootTitle}
+    </>
+  );
   return (
     <div className="flex flex-col gap-1.5 border-b border-border px-12 pb-3 pt-4">
       <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
         <span>Pages</span>
         <span className="text-border">›</span>
-        <span className={isRoot ? "font-medium text-foreground" : undefined}>
-          {rootIcon && <span className="mr-1" aria-hidden="true">{rootIcon}</span>}
-          {rootTitle}
-        </span>
+        {!isRoot && onNavigateRoot ? (
+          <button
+            type="button"
+            onClick={onNavigateRoot}
+            data-testid="blocks-breadcrumb-root"
+            className="inline-flex items-center rounded text-muted-foreground transition-colors hover:text-foreground hover:underline"
+          >
+            {rootLabel}
+          </button>
+        ) : (
+          <span className={isRoot ? "font-medium text-foreground" : "text-muted-foreground"}>
+            {rootLabel}
+          </span>
+        )}
         {!isRoot && (
           <>
             <span className="text-border">›</span>
```

**File**: `clients/web/src/components/blocks/BlocksSidebar.tsx` (modified, +5/-11)
```diff
@@ -1,14 +1,15 @@
 "use client";
 
 import { useMemo, useState } from "react";
-import { useRouter, useSearchParams } from "next/navigation";
+import { useSearchParams } from "next/navigation";
 import { ChevronRight, FileText, Search, Plus, Trash2 } from "lucide-react";
 import { cn } from "@/lib/utils";
 import { useBlocks, useRefs, useNestChildrenIndex, useBlockstoreStore, useWorkspace } from "@/stores/blockstore";
 import { useBlockTypeSpecs } from "@/lib/blockstore/useBlockTypeSpec";
 import { useBlockstoreDispatch } from "@/components/blocks/editor/useBlockstoreDispatch";
 import { BLOCK_TYPE_PAGE } from "@/lib/viewModels/blockstore";
 import { buildPageTree, countByType, colorForType, type PageNode } from "@/lib/blockstore/page-tree";
+import { useSelectPage } from "@/lib/blockstore/useSelectPage";
 import {
   ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem,
 } from "@/components/ui/context-menu";
@@ -19,7 +20,6 @@ import {
 import { useTranslations } from "next-intl";
 
 export function BlocksSidebar() {
-  const router = useRouter();
   const searchParams = useSearchParams();
   const pageParam = searchParams.get("page");
   const activeWorkspaceId = useBlockstoreStore((s) => s.activeWorkspaceId);
@@ -48,13 +48,7 @@ export function BlocksSidebar() {
   const triggerCount = typeCounts["trigger_def"] ?? 0;
   const typeEntries = Object.values(typeSpecs);
 
-  const handleSelectPage = (id: string) => {
-    const next = new URLSearchParams(Array.from(searchParams.entries()));
-    if (id === rootBlockID) next.delete("page");
-    else next.set("page", id);
-    const qs = next.toString();
-    router.replace(qs ? `?${qs}` : "?");
-  };
+  const selectPage = useSelectPage();
 
   const handleAddPage = async () => {
     if (!rootBlockID) return;
@@ -64,7 +58,7 @@ export function BlocksSidebar() {
       { title: "Untitled" },
       { text: "Untitled" },
     );
-    if (newID) handleSelectPage(newID);
+    if (newID) selectPage(newID);
   };
 
   const handleOpenSearch = () => {
@@ -105,7 +99,7 @@ export function BlocksSidebar() {
               node={node}
               depth={0}
               selectedId={selectedPageID}
-              onSelect={handleSelectPage}
+              onSelect={selectPage}
               onDelete={setPendingDelete}
             />
           ))
```

**File**: `clients/web/src/components/blocks/renderers/LinkToPageRenderer.tsx` (modified, +3/-5)
```diff
@@ -4,13 +4,15 @@ import React from "react";
 import { ArrowUpRight } from "lucide-react";
 
 import type { Block } from "@/lib/viewModels/blockstore";
+import { useJumpToBlock } from "@/lib/blockstore/useJumpToBlock";
 import { useBlock } from "@/stores/blockstore";
 
 import { BlockChrome } from "../editor/BlockChrome";
 import { useBlockstoreDispatch } from "../editor/useBlockstoreDispatch";
 
 export function LinkToPageRenderer({ block }: { block: Block }) {
   const dispatch = useBlockstoreDispatch(block.workspace_id);
+  const jumpToBlock = useJumpToBlock();
   const targetID = (block.data?.target_id as string | undefined) ?? "";
   const target = useBlock(targetID || null);
 
@@ -25,11 +27,7 @@ export function LinkToPageRenderer({ block }: { block: Block }) {
     "Untitled page";
 
   const handleJump = () => {
-    if (!targetID) return;
-    const el = document.getElementById(`block-${targetID}`);
-    el?.scrollIntoView({ behavior: "smooth", block: "center" });
-    el?.classList.add("ring-2", "ring-primary");
-    setTimeout(() => el?.classList.remove("ring-2", "ring-primary"), 1500);
+    if (targetID) jumpToBlock(targetID);
   };
 
   return (
```

**File**: `clients/web/src/components/blocks/renderers/PageRenderer.tsx` (modified, +8/-7)
```diff
@@ -3,24 +3,25 @@
 import React from "react";
 
 import type { Block } from "@/lib/viewModels/blockstore";
-import { cn } from "@/lib/utils";
 
 import { NestChildren } from "../BlockRenderer";
 import { EditableText } from "../editor/EditableText";
 import { useBlockstoreDispatch } from "../editor/useBlockstoreDispatch";
+import { SubPageLink } from "./SubPageLink";
 
 export function PageRenderer({ block, depth }: { block: Block; depth: number }) {
   const dispatch = useBlockstoreDispatch(block.workspace_id);
   const title = (block.data?.title as string | undefined) ?? "";
 
+  // A page nested inside another page is an independent document — render it as
+  // a navigable sub-page link, never inline its content (Notion semantics).
+  if (depth > 0) return <SubPageLink block={block} />;
+
   return (
-    <section className={cn("flex flex-col gap-3", depth === 0 && "py-6")}>
+    <section className="flex flex-col gap-3 py-6">
       <EditableText
-        className={cn(
-          "outline-none",
-          depth === 0 ? "text-3xl font-bold tracking-tight" : "text-lg font-semibold",
-        )}
-        placeholder={depth === 0 ? "Untitled page" : "Subpage"}
+        className="text-3xl font-bold tracking-tight outline-none"
+        placeholder="Untitled page"
         value={title}
         onChange={(next) => {
           dispatch.updateBlockData(block.id, { title: next });
```

**File**: `clients/web/src/components/blocks/renderers/SubPageLink.tsx` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+"use client";
+
+import React from "react";
+import { FileText } from "lucide-react";
+
+import type { Block } from "@/lib/viewModels/blockstore";
+import { pageDisplayMeta } from "@/lib/blockstore/pageDisplayMeta";
+import { useSelectPage } from "@/lib/blockstore/useSelectPage";
+
+import { BlockChrome } from "../editor/BlockChrome";
+import { useBlockstoreDispatch } from "../editor/useBlockstoreDispatch";
+
+export function SubPageLink({ block }: { block: Block }) {
+  const dispatch = useBlockstoreDispatch(block.workspace_id);
+  const selectPage = useSelectPage();
+
+  const { title, icon } = pageDisplayMeta(block);
+
+  const handleDelete = () => {
+    void dispatch.detachChild(block.id);
+    void dispatch.removeBlock(block.id);
+  };
+
+  return (
+    <BlockChrome
+      className="pl-1"
+      blockID={block.id}
+      onDelete={handleDelete}
+      onDuplicate={() => void dispatch.duplicate(block.id)}
+      onToggleVisibility={(next) => void dispatch.setBlockVisibility(block.id, next)}
+    >
+      <button
+        type="button"
+        onClick={() => selectPage(block.id)}
+        data-testid={`blocks-subpage-link-${block.id}`}
+        className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-left text-sm font-medium text-foreground hover:bg-muted/50"
+      >
+        <span aria-hidden="true" className="flex-shrink-0 text-muted-foreground">
+          {icon ?? <FileText className="inline h-4 w-4" />}
+        </span>
+        <span className="truncate underline decoration-muted-foreground/40 underline-offset-2">
+          {title}
+        </span>
+      </button>
+    </BlockChrome>
+  );
+}
```

**File**: `clients/web/src/lib/blockstore/findOwnerPage.test.ts` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+import { describe, expect, it } from "vitest";
+
+import { BLOCK_TYPE_PAGE, type Block, type BlockRef } from "@/lib/viewModels/blockstore";
+
+import { findOwnerPage } from "./findOwnerPage";
+
+function blk(id: string, type: string): Block {
+  return { id, type } as unknown as Block;
+}
+function ref(id: number, from: string, to: string): BlockRef {
+  return { id, from_id: from, to_id: to, rel: "nest" } as unknown as BlockRef;
+}
+
+const blocks = {
+  root: blk("root", BLOCK_TYPE_PAGE),
+  sub: blk("sub", BLOCK_TYPE_PAGE),
+  para: blk("para", "paragraph"),
+  toggle: blk("toggle", "toggle"),
+  deep: blk("deep", "paragraph"),
+};
+const refs = {
+  1: ref(1, "root", "sub"),
+  2: ref(2, "root", "toggle"),
+  3: ref(3, "toggle", "para"),
+  4: ref(4, "sub", "deep"),
+};
+const nest = { root: [1, 2], toggle: [3], sub: [4] };
+
+describe("findOwnerPage", () => {
+  it("returns the page itself when the target is a page", () => {
+    expect(findOwnerPage("sub", blocks, refs, nest)).toBe("sub");
+    expect(findOwnerPage("root", blocks, refs, nest)).toBe("root");
+  });
+
+  it("returns the nearest page ancestor for a nested non-page block", () => {
+    expect(findOwnerPage("para", blocks, refs, nest)).toBe("root");
+  });
+
+  it("stops at the nearest sub-page, not the root", () => {
+    expect(findOwnerPage("deep", blocks, refs, nest)).toBe("sub");
+  });
+
+  it("returns null for an orphan non-page block", () => {
+    expect(findOwnerPage("ghost", blocks, refs, nest)).toBeNull();
+  });
+});
```

---

### Incident Patch 15: `2b006950` (2026-06-13)
**Commit Message**: fix(desktop): heal settings account info + language switch + billing regressions (#440)

- Account info blank: 7 desktop fork pages destructured user/currentOrg from
  useAuthStore() — fields removed in the SSOT refactor → undefined. Switch to
  useCurrentUser()/useCurrentOrg() selectors (mirrors GeneralSettingsPage).
- Language switch no-op: shared LanguageSwitcher's useSetLocale resolved to
  web's cookie+router.refresh() (inert on desktop, no Next server). Add a
  desktop override driving DesktopIntlProvider via a window event; collapse
  the unused IntlContext/setLocale dead path.
- Billing hash-route: replaceState(window.location.pathname) wiped the whole
  hash route on desktop; switch to router.replace preserving non-payment query.
- Post-payment regression: shallow nav no longer refreshed billing data —
  reload it on payment=success. Remove dead useBillingData hook.
- Derive billing currentUrl from origin+usePathname instead of window.location.
- Extend e2e guard to the dashboard {org}/settings route.

Co-authored-by: yishuiliunian <[REDACTED_EMAIL]>

**File**: `clients/desktop/e2e/tests/auth/authenticated-pages-render.spec.ts` (modified, +5/-0)
```diff
@@ -28,6 +28,11 @@ test.describe("Auth · authenticated pages render real user", () => {
     await expect(page.getByText(TEST_USER.email)).toBeVisible({ timeout: 5000 });
   });
 
+  test("dashboard org settings shows dev user's email", async ({ page }) => {
+    await gotoHash(page, `/${TEST_ORG_SLUG}/settings`);
+    await expect(page.getByText(TEST_USER.email)).toBeVisible({ timeout: 10_000 });
+  });
+
   test("dashboard route uses dev org slug (not /login)", async ({ page }) => {
     // Sanity: with proper bootstrap + isAuthenticated, RootRedirect lands
     // us in /{orgSlug}/workspace, not /login. Catches a useIsAuthenticated
```

**File**: `clients/desktop/electron.vite.config.ts` (modified, +2/-0)
```diff
@@ -78,6 +78,8 @@ export default defineConfig({
         // env.ts must resolve to the desktop-specific version so it picks up
         // the preload-exposed apiUrl instead of `window.location.origin`.
         { find: /^@\/lib\/env$/, replacement: resolve(desktopSrc, "lib/env") },
+        // Precise match must precede @/lib so desktop drives locale via DesktopIntlProvider.
+        { find: /^@\/lib\/i18n\/locale-switcher$/, replacement: resolve(desktopSrc, "lib/i18n/locale-switcher") },
         { find: "@/lib", replacement: resolve(webSrc, "lib") },
         { find: "@/messages", replacement: resolve(webSrc, "messages") },
         // `@/app/...` is the Next.js app-router path; some shared components
```

**File**: `clients/desktop/src/renderer/lib/i18n/locale-switcher.ts` (modified, +8/-12)
```diff
@@ -1,18 +1,14 @@
 "use client";
 
-import { useRouter } from "next/navigation";
 import { useCallback } from "react";
-import { Locale, LOCALE_COOKIE, locales } from "./config";
+import { Locale, locales } from "@/lib/i18n/config";
+import { LOCALE_STORAGE_KEY, LOCALE_CHANGE_EVENT } from "../../providers/IntlProvider";
 
 export function useSetLocale() {
-  const router = useRouter();
-  return useCallback(
-    (newLocale: Locale) => {
-      if (!locales.includes(newLocale)) return;
-      document.cookie = `${LOCALE_COOKIE}=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}`;
-      document.documentElement.lang = newLocale;
-      router.refresh();
-    },
-    [router]
-  );
+  return useCallback((newLocale: Locale) => {
+    if (!locales.includes(newLocale)) return;
+    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
+    document.documentElement.lang = newLocale;
+    window.dispatchEvent(new CustomEvent(LOCALE_CHANGE_EVENT, { detail: newLocale }));
+  }, []);
 }
```

**File**: `clients/desktop/src/renderer/pages/auth/onboarding/OnboardingPage.tsx` (modified, +4/-2)
```diff
@@ -3,7 +3,7 @@ import Link from "next/link";
 import { useRouter } from "next/navigation";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
-import { useAuthStore } from "@/stores/auth";
+import { useAuthStore, useCurrentUser } from "@/stores/auth";
 import { organizationApi } from "@/lib/api/facade/organization";
 import { getLocalizedErrorMessage } from "@/lib/api/errors";
 import { toast } from "sonner";
@@ -13,7 +13,9 @@ import { Logo } from "@/components/common";
 export function OnboardingPage() {
   const router = useRouter();
   const t = useTranslations();
-  const { user, setOrganizations, setCurrentOrg } = useAuthStore();
+  const user = useCurrentUser();
+  const setOrganizations = useAuthStore((s) => s.setOrganizations);
+  const setCurrentOrg = useAuthStore((s) => s.setCurrentOrg);
   const [inviteCode, setInviteCode] = useState("");
   const [showInviteInput, setShowInviteInput] = useState(false);
   const [loading, setLoading] = useState(false);
```

**File**: `clients/desktop/src/renderer/pages/auth/onboarding/setup-runner/SetupRunnerPage.tsx` (modified, +2/-2)
```diff
@@ -1,14 +1,14 @@
 import Link from "next/link";
 import { useRouter } from "next/navigation";
 import { Button } from "@/components/ui/button";
-import { useAuthStore } from "@/stores/auth";
+import { useCurrentOrg } from "@/stores/auth";
 import { useTranslations } from "next-intl";
 import { Logo } from "@/components/common";
 
 export function SetupRunnerPage() {
   const router = useRouter();
   const t = useTranslations();
-  const { currentOrg } = useAuthStore();
+  const currentOrg = useCurrentOrg();
 
   const handleSkip = () => {
     if (currentOrg) {
```

**File**: `clients/desktop/src/renderer/pages/auth/onboarding/setup-runner/local/LocalRunnerSetupPage.tsx` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@ import { useState, useEffect, useCallback } from "react";
 import Link from "next/link";
 import { useRouter } from "next/navigation";
 import { Button } from "@/components/ui/button";
-import { useAuthStore } from "@/stores/auth";
+import { useCurrentOrg } from "@/stores/auth";
 import { runnerApi, RunnerData } from "@/lib/api/facade/runner";
 import { isApiErrorCode } from "@/lib/api/errors";
 import { useServerUrl } from "@/hooks/useServerUrl";
@@ -14,7 +14,7 @@ import { SetupSteps } from "./components/SetupSteps";
 export function LocalRunnerSetupPage() {
   const router = useRouter();
   const t = useTranslations();
-  const { currentOrg } = useAuthStore();
+  const currentOrg = useCurrentOrg();
   const serverUrl = useServerUrl();
   const [token, setToken] = useState<string | null>(null);
   const [tokenCopied, setTokenCopied] = useState(false);
```

**File**: `clients/desktop/src/renderer/pages/dashboard/repository-detail/components/CapabilitiesTab.tsx` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 import { useState } from "react";
 import { useTranslations } from "next-intl";
 import { InstalledSkill, InstalledMcpServer } from "@/lib/api";
-import { useAuthStore } from "@/stores/auth";
+import { useCurrentOrg } from "@/stores/auth";
 import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
 import { Button } from "@/components/ui/button";
 import { ConfirmDialog } from "@/components/ui/confirm-dialog";
@@ -43,7 +43,7 @@ function ExtensionSection<T extends InstalledSkill | InstalledMcpServer>({
 
 export function CapabilitiesTab({ repositoryId }: CapabilitiesTabProps) {
   const t = useTranslations();
-  const { currentOrg } = useAuthStore();
+  const currentOrg = useCurrentOrg();
   const isAdmin = currentOrg?.role === "owner" || currentOrg?.role === "admin";
 
   const {
```

**File**: `clients/desktop/src/renderer/pages/dashboard/settings/OrgSettingsPage.tsx` (modified, +4/-3)
```diff
@@ -1,5 +1,5 @@
 import { useRouter, useSearchParams } from "next/navigation";
-import { useAuthStore } from "@/stores/auth";
+import { useAuthStore, useCurrentUser, useCurrentOrg } from "@/stores/auth";
 import { Button } from "@/components/ui/button";
 import { LanguageSettings, ThemeSettings, NotificationSettings, AgentCredentialsSettings, AgentConfigPage, GitSettingsContent } from "@/components/settings";
 import { GeneralSettings, MembersSettings, BillingSettings, RunnersSettings, APIKeysSettings, ExtensionsSettings, UsageSettings } from "@/components/settings/organization";
@@ -11,7 +11,7 @@ export function SettingsPage() {
   const searchParams = useSearchParams();
   const scope = searchParams.get("scope") || "personal";
   const activeTab = searchParams.get("tab") || "general";
-  const { currentOrg } = useAuthStore();
+  const currentOrg = useCurrentOrg();
   const t = useTranslations();
 
   const renderContent = () => {
@@ -69,7 +69,8 @@ export function SettingsPage() {
 function PersonalGeneralSettings() {
   const router = useRouter();
   const t = useTranslations();
-  const { user, logout } = useAuthStore();
+  const user = useCurrentUser();
+  const logout = useAuthStore((s) => s.logout);
 
   const handleLogout = () => {
     logout();
```

#### Recent Merged Pull Requests:
- **PR #474** (2026-09-23): fix(auth): fail closed on missing/default JWT_SECRET (@ZxlDragonDoctor)
- **PR #473** (closed): Add knos to .mcp.json so agents share one decision record (@drexthealpha)
- **PR #470** (2026-07-24): fix(terminal): harden PTY relay rendering lifecycle (@yishuiliunian)
- **PR #469** (2026-07-24): chore(skills): portable agent skills via canonical source + projections (@yishuiliunian)
- **PR #468** (2026-07-24): fix(channel): restore follow-to-bottom for new messages (v0.44.5 regression) (@yishuiliunian)
- **PR #466** (2026-07-23): fix(channel): robust entry scroll & unread-divider positioning (@yishuiliunian)
- **PR #465** (2026-07-23): fix(ci): support pinned curl in GitLab sync (@yishuiliunian)
- **PR #464** (2026-07-23): fix(deploy): route Connect RPC in private templates (@yishuiliunian)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
