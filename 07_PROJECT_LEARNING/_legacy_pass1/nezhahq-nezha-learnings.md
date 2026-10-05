# Forensic Learning Record (Deep Inspection): nezhahq/nezha

> **Canonical Artifact**: `07_PROJECT_LEARNING/nezhahq-nezha-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nezhahq/nezha](https://github.com/nezhahq/nezha))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:26:20.401Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nezhahq/nezha`
- **Description**: :trollface: Self-hosted, lightweight server and website monitoring and O&M tool
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 10341 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/dashboard/controller/agentcompat_capability_access.go`
```
//go:build agentcompat

package controller

import (
	"github.com/gin-gonic/gin"

	"github.com/nezhahq/nezha/model"
	"github.com/nezhahq/nezha/service/rpc"
	"github.com/nezhahq/nezha/service/singleton"
)

type agentcompatCapabilityIdentity struct {
	purpose    rpc.AgentCompatCapabilityPurpose
	serverID   uint64
	resourceID uint64
}

type agentcompatCapabilityProof struct {
	owner    rpc.AgentCompatCapabilityOwner
	identity agentcompatCapabilityIdentity
}

func currentAgentcompatCapabilityProof(context *gin.Context, identity agentcompatCapabilityIdentity) (agentcompatCapabilityProof, error) {
	if err := validateAgentcompatCapabilityIdentity(identity.purpose, identity.serverID, identity.resourceID); err != nil {
		return agentcompatCapabilityProof{}, err
	}
	token := APITokenFromContext(context)
	authorized, present := context.Get(model.CtxKeyAuthorizedUser)
	user, validUser := authorized.(*model.User)
	if token == nil || token.ID == 0 || !present || !validUser || user == nil || user.ID == 0 {
		return agentcompatCapabilityProof{}, errAgentcompatCapabilityUnavailable
	}
	if singleton.ServerShared == nil {
		return agentcompatCapabilityProof{}, errAgentcompatCapabilityUnavailable
	}
	server, exists := singleton.ServerShared.Get(identity.serverID)
	if !exists || server == nil || !server.HasPermission(context) || !patAllowsServer(context, identity.serverID) {
		return agentcompatCapabilityProof{}, errAgentcompatCapabilityUnavailable
	}
	if identity.purpose == rpc.AgentCompatCapabilityNAT && !currentAgentcompatNATPermission(context, identity) {
		return agentcompatCapabilityProof{}, errAgentcompatCapabilityUnavailable
	}
	return agentcompatCapabilityProof{
		owner:    rpc.AgentCompatCapabilityOwner{PATID: token.ID, UserID: user.ID, IsAdmin: user.Role.IsAdmin()},
		identity: identity,
	}, nil
}

func currentAgentcompatNATPermission(context *gin.Context, identity agentcompatCapabilityIdentity) bool {
	if singleton.NATShared == nil {
		return false
	}
	domain := singleton.NATShared.GetDomain(identity.resourceID)
	if domain == "" {
		return false
	}
	profile := singleton.NATShared.GetNATConfigByDomain(domain)
	return profile != nil && profile.ID == identity.resourceID && profile.ServerID == identity.serverID && profile.HasPermission(context)
}

func (proof agentcompatCapabilityProof) registration() rpc.AgentCompatCapabilityRegistration {
	return rpc.AgentCompatCapabilityRegistration{
		Owner: proof.owner, Purpose: proof.identity.purpose, TargetServerID: proof.identity.serverID,
		ResourceID: proof.identity.resourceID, ServerAccessAllowed: true,
	}
}

func (proof agentcompatCapabilityProof) access(capability rpc.AgentCompatIOStreamCapability) rpc.AgentCompatCapabilityAccess {
	return rpc.AgentCompatCapabilityAccess{
		Capability: capability, Owner: proof.owner, Purpose: proof.identity.purpose,
		TargetServerID: proof.identity.serverID, ResourceID: proof.identity.resourceID, ServerAccessAllowed: true,
	}
}

func agentcompatCapabilityIdentityFromWire(purpose string, serverID, resourceID uint64) (agentcompatCapabilityIdentity, error) {
	parsedPurpose, err := parseAgentcompatCapabilityPurpose(purpose)
	if err != nil {
		return agentcompatCapabilityIdentity{}, err
	}
	identity := agentcompatCapabilityIdentity{purpose: parsedPurpose, serverID: serverID, resourceID: resourceID}
	if err := validateAgentcompatCapabilityIdentity(identity.purpose, identity.serverID, identity.resourceID); err != nil {
		return agentcompatCapabilityIdentity{}, err
	}
	return identity, nil
}

```

### Core Architecture Module: `cmd/dashboard/controller/agentcompat_capability_contract.go`
```
//go:build agentcompat

package controller

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/nezhahq/nezha/service/rpc"
)

const (
	agentcompatCapabilityRequestMaxBytes = 512

	agentcompatCapabilityRegisterPath   = "/agentcompat/io-stream-capability/register"
	agentcompatCapabilityWaitPath       = "/agentcompat/io-stream-capability/wait"
	agentcompatCapabilityCancelPath     = "/agentcompat/io-stream-capability/cancel"
	agentcompatCapabilityUnregisterPath = "/agentcompat/io-stream-capability/unregister"
)

const (
	agentcompatCapabilityPurposeTerminal    = "terminal"
	agentcompatCapabilityPurposeFileManager = "file_manager"
	agentcompatCapabilityPurposeNAT         = "nat"
)

var (
	errAgentcompatCapabilityInvalid     = errors.New("agentcompat capability request is invalid")
	errAgentcompatCapabilityUnavailable = errors.New("agentcompat capability is not available")
	errAgentcompatCapabilityConflict    = errors.New("agentcompat capability is active")
	errAgentcompatCapabilityCleanup     = errors.New("agentcompat capability cleanup failed")
)

type agentcompatCapabilityRegisterRequest struct {
	Purpose    string `json:"purpose"`
	ServerID   uint64 `json:"server_id"`
	ResourceID uint64 `json:"resource_id,omitempty"`
}

type agentcompatCapabilityRegisterResponse struct {
	Capability string `json:"capability"`
}

type agentcompatCapabilityAccessRequest struct {
	Capability string `json:"capability"`
	Purpose    string `json:"purpose"`
	ServerID   uint64 `json:"server_id"`
	ResourceID uint64 `json:"resource_id,omitempty"`
}

type agentcompatCapabilityWaitRequest = agentcompatCapabilityAccessRequest
type agentcompatCapabilityCancelRequest = agentcompatCapabilityAccessRequest
type agentcompatCapabilityUnregisterRequest = agentcompatCapabilityAccessRequest

type agentcompatCapabilityWaitResponse struct {
	StreamID string `json:"stream_id"`
}

type agentcompatCapabilityEmptyResponse struct{}

func decodeAgentcompatCapabilityRequest[T any](context *gin.Context, destination *T) error {
	context.Request.Body = http.MaxBytesReader(context.Writer, context.Request.Body, agentcompatCapabilityRequestMaxBytes)
	decoder := json.NewDecoder(context.Request.Body)
	fields, err := decodeAgentcompatCapabilityObject(decoder)
	if err != nil {
		return errAgentcompatCapabilityInvalid
	}
	switch request := any(destination).(type) {
	case *agentcompatCapabilityRegisterRequest:
		request.Purpose, err = decodeAgentcompatCapabilityString(fields.purpose)
		if err == nil {
			request.ServerID, err = decodeAgentcompatCapabilityUint64(fields.serverID)
		}
		if err == nil && fields.resourceID != nil {
			request.ResourceID, err = decodeAgentcompatCapabilityUint64(fields.resourceID)
		}
		if err != nil || fields.purpose == nil || fields.serverID == nil {
			return errAgentcompatCapabilityInvalid
		}
	case *agentcompatCapabilityAccessRequest:
		request.Capability, err = decodeAgentcompatCapabilityString(fields.capability)
		if err == nil {
			request.Purpose, err = decodeAgentcompatCapabilityString(fields.purpose)
		}
		if err == nil {
			request.ServerID, err = decodeAgentcompatCapabilityUint64(fields.serverID)
		}
		if err == nil && fields.resourceID != nil {
			request.ResourceID, err = decodeAgentcompatCapabilityUint64(fields.resourceID)
		}
		if err != nil || fields.capability == nil || fields.purpose == nil || fields.serverID == nil {
			return errAgentcompatCapabilityInvalid
		}
	default:
		return errAgentcompatCapabilityInvalid
	}
	return nil
}

type agentcompatCapabilityFields struct {
	purpose    json.RawMessage
	serverID   json.RawMessage
	resourceID json.RawMessage
	capability json.RawMessage
	seen       uint8
}

func decodeAgentcompatCapabilityObject(decoder *json.Decoder) (agentcompatCapabilityFields, error) {
	var fields agentcompatCapabilityFields
	token, err := decoder.Token()
	if err != nil || token != json.Delim('{') {
		return fields, errAgentcompatCapabilityInvalid
	}
	for decoder.More() {
		keyToken, err := decoder.Token()
		key, validKey := keyToken.(string)
		if err != nil || !validKey {
			return fields, errAgentcompatCapabilityInvalid
		}
		var bit uint8
		var target *json.RawMessage
		switch key {
		case "purpose":
			bit, target = 1, &fields.purpose
		case "server_id":
			bit, target = 2, &fields.serverID
		case "resource_id":
			bit, target = 4, &fields.resourceID
		case "capability":
			bit, target = 8, &fields.capability
		default:
			return fields, errAgentcompatCapabilityInvalid
		}
		if fields.seen&bit != 0 || decoder.Decode(target) != nil {
			return fields, errAgentcompatCapabilityInvalid
		}
		fields.seen |= bit
	}
	if token, err = decoder.Token(); err != nil || token != json.Delim('}') {
		return fields, errAgentcompatCapabilityInvalid
	}
	if _, err = decoder.Token(); !errors.Is(err, io.EOF) {
		return fields, errAgentcompatCapabilityInvalid
	}
	return fields, nil
}

func decodeAgentcompatCapabilityString(raw json.RawMessage) (string, error) {
	if strings.TrimSpace(string(raw)) == "null" {
		return "", errAgentcompatCapabilityInvalid
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return "", errAgentcompatCapabilityInvalid
	}
	return value, nil
}

func decodeAgentcompatCapabilityUint64(raw json.RawMessage) (uint64, error) {
	return strconv.ParseUint(strings.TrimSpace(string(raw)), 10, 64)
}

func parseAgentcompatCapabilityPurpose(value string) (rpc.AgentCompatCapabilityPurpose, error) {
	switch value {
	case agentcompatCapabilityPurposeTerminal:
		return rpc.AgentCompatCapabilityTerminal, nil
	case agentcompatCapabilityPurposeFileManager:
		return rpc.AgentCompatCapabilityFileManager, nil
	case agentcompatCapabilityPurposeNAT:
		return rpc.AgentCompatCapabilityNAT, nil
	default:
		return 0, errAgentcompatCapabilityInvalid
	}
}

func validateAgentcompatCapabilityIdentity(purpose rpc.AgentCompatCapabilityPurpose, serverID, resourceID uint64) error {
	if serverID == 0 {
		return errAgentcompatCapabilityInvalid
	}
	switch purpose {
	case rpc.AgentCompatCapabilityTerminal, rpc.AgentCompatCapabilityFileManager:
		if resourceID != 0 {
			return errAgentcompatCapabilityInvalid
		}
	case rpc.AgentCompatCapabilityNAT:
		if resourceID == 0 {
			return errAgentcompatCapabilityInvalid
		}
	default:
		return errAgentcompatCapabilityInvalid
	}
	return nil
}

```

### Core Architecture Module: `cmd/dashboard/controller/agentcompat_capability_handlers.go`
```
//go:build agentcompat

package controller

import (
	"errors"

	"github.com/gin-gonic/gin"

	"github.com/nezhahq/nezha/service/rpc"
)

func registerAgentcompatCapabilityRoutes(router *gin.Engine, patAuth gin.HandlerFunc) {
	router.POST(agentcompatCapabilityRegisterPath, patAuth, commonHandler(agentcompatCapabilityRegister))
	router.POST(agentcompatCapabilityWaitPath, patAuth, commonHandler(agentcompatCapabilityWait))
	router.POST(agentcompatCapabilityCancelPath, patAuth, commonHandler(agentcompatCapabilityCancel))
	router.POST(agentcompatCapabilityUnregisterPath, patAuth, commonHandler(agentcompatCapabilityUnregister))
}

func agentcompatCapabilityRegister(context *gin.Context) (agentcompatCapabilityRegisterResponse, error) {
	var request agentcompatCapabilityRegisterRequest
	if err := decodeAgentcompatCapabilityRequest(context, &request); err != nil {
		return agentcompatCapabilityRegisterResponse{}, err
	}
	identity, err := agentcompatCapabilityIdentityFromWire(request.Purpose, request.ServerID, request.ResourceID)
	if err != nil {
		return agentcompatCapabilityRegisterResponse{}, err
	}
	proof, err := currentAgentcompatCapabilityProof(context, identity)
	if err != nil || rpc.NezhaHandlerSingleton == nil {
		return agentcompatCapabilityRegisterResponse{}, errAgentcompatCapabilityUnavailable
	}
	capability, err := rpc.NezhaHandlerSingleton.RegisterAgentCompatIOStreamCapability(context.Request.Context(), proof.registration())
	if err != nil {
		if contextError := context.Request.Context().Err(); contextError != nil {
			return agentcompatCapabilityRegisterResponse{}, contextError
		}
		return agentcompatCapabilityRegisterResponse{}, errAgentcompatCapabilityUnavailable
	}
	return agentcompatCapabilityRegisterResponse{Capability: capability.String()}, nil
}

func agentcompatCapabilityWait(context *gin.Context) (agentcompatCapabilityWaitResponse, error) {
	var request agentcompatCapabilityWaitRequest
	if err := decodeAgentcompatCapabilityRequest(context, &request); err != nil {
		return agentcompatCapabilityWaitResponse{}, err
	}
	access, err := currentAgentcompatCapabilityAccess(context, request)
	if errors.Is(err, errAgentcompatCapabilityInvalid) {
		return agentcompatCapabilityWaitResponse{}, errAgentcompatCapabilityInvalid
	}
	if err != nil || rpc.NezhaHandlerSingleton == nil {
		return agentcompatCapabilityWaitResponse{}, errAgentcompatCapabilityUnavailable
	}
	streamID, err := rpc.NezhaHandlerSingleton.WaitAgentCompatIOStreamCapability(context.Request.Context(), access)
	if err != nil {
		if contextError := context.Request.Context().Err(); contextError != nil {
			return agentcompatCapabilityWaitResponse{}, contextError
		}
		return agentcompatCapabilityWaitResponse{}, errAgentcompatCapabilityUnavailable
	}
	return agentcompatCapabilityWaitResponse{StreamID: streamID}, nil
}

func agentcompatCapabilityCancel(context *gin.Context) (agentcompatCapabilityEmptyResponse, error) {
	access, available := inertAgentcompatCapabilityAccess(context)
	if !available || rpc.NezhaHandlerSingleton == nil {
		return agentcompatCapabilityEmptyResponse{}, nil
	}
	if err := rpc.NezhaHandlerSingleton.CancelAgentCompatIOStreamCapability(access); err != nil {
		return agentcompatCapabilityEmptyResponse{}, errAgentcompatCapabilityCleanup
	}
	return agentcompatCapabilityEmptyResponse{}, nil
}

func agentcompatCapabilityUnregister(context *gin.Context) (agentcompatCapabilityEmptyResponse, error) {
	access, available := inertAgentcompatCapabilityAccess(context)
	if !available || rpc.NezhaHandlerSingleton == nil {
		return agentcompatCapabilityEmptyResponse{}, nil
	}
	err := rpc.NezhaHandlerSingleton.UnregisterAgentCompatIOStreamCapability(access)
	if errors.Is(err, rpc.ErrAgentCompatCapabilityBound) {
		return agentcompatCapabilityEmptyResponse{}, errAgentcompatCapabilityConflict
	}
	if err != nil {
		return agentcompatCapabilityEmptyResponse{}, errAgentcompatCapabilityUnavailable
	}
	return agentcompatCapabilityEmptyResponse{}, nil
}

func currentAgentcompatCapabilityAccess(context *gin.Context, request agentcompatCapabilityAccessRequest) (rpc.AgentCompatCapabilityAccess, error) {
	identity, err := agentcompatCapabilityIdentityFromWire(request.Purpose, request.ServerID, request.ResourceID)
	if err != nil {
		return rpc.AgentCompatCapabilityAccess{}, err
	}
	capability, err := rpc.ParseAgentCompatIOStreamCapability(request.Capability)
	if err != nil {
		return rpc.AgentCompatCapabilityAccess{}, errAgentcompatCapabilityUnavailable
	}
	proof, err := currentAgentcompatCapabilityProof(context, identity)
	if err != nil {
		return rpc.AgentCompatCapabilityAccess{}, errAgentcompatCapabilityUnavailable
	}
	return proof.access(capability), nil
}

func inertAgentcompatCapabilityAccess(context *gin.Context) (rpc.AgentCompatCapabilityAccess, bool) {
	var request agentcompatCapabilityAccessRequest
	if decodeAgentcompatCapabilityRequest(context, &request) != nil {
		return rpc.AgentCompatCapabilityAccess{}, false
	}
	access, err := currentAgentcompatCapabilityAccess(context, request)
	return access, err == nil
}

```

### Core Architecture Module: `cmd/dashboard/controller/agentcompat_routes.go`
```
//go:build agentcompat

package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/nezhahq/nezha/model"
	"github.com/nezhahq/nezha/service/rpc"
)

const (
	agentcompatOversizeWriteSentinel    = "agentcompat:oversize-write-contract"
	agentcompatOversizeWriteServerPath  = "/tmp/agentcompat-oversize-contract.txt"
	agentcompatFsWriteOperationOversize = "oversize"
)

type agentcompatFsWriteContractRequest struct {
	ServerID  uint64                      `json:"server_id"`
	Operation agentcompatFsWriteOperation `json:"operation"`
}

type agentcompatFsWriteOperation string

type agentcompatFsWriteContractResponse struct {
	Result           model.FsWriteResult `json:"result"`
	AgentRPCResponse bool                `json:"agent_rpc_response"`
}

func registerAgentcompatRoutes(router *gin.Engine) {
	patAuth := requiredAgentcompatPAT(apiTokenAuthMiddleware())
	router.POST("/agentcompat/fs-write-contract", patAuth, commonHandler(agentcompatFsWriteContract))
	router.POST("/agentcompat/mcp-rate-limit-probe", patAuth, commonHandler(agentcompatMCPRateLimitProbeRoute))
	router.GET("/agentcompat/io-stream-state", patAuth, commonHandler(agentcompatIOStreamSnapshot))
	router.POST("/agentcompat/io-stream-state", patAuth, commonHandler(agentcompatIOStreamWait))
	router.POST("/agentcompat/io-stream-quota-probe", patAuth, commonHandler(agentcompatIOStreamQuotaProbeRoute))
	registerAgentcompatCapabilityRoutes(router, patAuth)
	registerAgentcompatSQLiteHoldRoutes(router, patAuth)
}

type agentcompatIOStreamQuotaProbeResponse struct {
	UserAccepted   int  `json:"user_accepted"`
	UserRejected   int  `json:"user_rejected"`
	ServerAccepted int  `json:"server_accepted"`
	ServerRejected int  `json:"server_rejected"`
	Clean          bool `json:"clean"`
}

func agentcompatIOStreamQuotaProbeRoute(context *gin.Context) (agentcompatIOStreamQuotaProbeResponse, error) {
	if rpc.NezhaHandlerSingleton == nil {
		return agentcompatIOStreamQuotaProbeResponse{}, errors.New("IOStream handler is unavailable")
	}
	result := rpc.RunIOStreamQuotaProbe(context.Request.Context())
	if result.Err != nil {
		return agentcompatIOStreamQuotaProbeResponse{}, result.Err
	}
	return agentcompatIOStreamQuotaProbeResponse{UserAccepted: result.UserAccepted, UserRejected: result.UserRejected, ServerAccepted: result.ServerAccepted, ServerRejected: result.ServerRejected, Clean: result.TrackedStreams == 0}, nil
}

func requiredAgentcompatPAT(auth gin.HandlerFunc) gin.HandlerFunc {
	return func(context *gin.Context) {
		auth(context)
		if context.IsAborted() {
			return
		}
		if APITokenFromContext(context) == nil {
			abortAPITokenUnauthorized(context, "api token required")
		}
	}
}

func agentcompatIOStreamSnapshot(*gin.Context) (rpc.IOStreamState, error) {
	if rpc.NezhaHandlerSingleton == nil {
		return rpc.IOStreamState{}, errors.New("IOStream handler is unavailable")
	}
	return rpc.NezhaHandlerSingleton.SnapshotIOStreamState(), nil
}

func agentcompatIOStreamWait(context *gin.Context) (rpc.IOStreamState, error) {
	if rpc.NezhaHandlerSingleton == nil {
		return rpc.IOStreamState{}, errors.New("IOStream handler is unavailable")
	}
	var expectation rpc.IOStreamStateExpectation
	if err := context.ShouldBindJSON(&expectation); err != nil {
		return rpc.IOStreamState{}, err
	}
	return rpc.NezhaHandlerSingleton.WaitForIOStreamState(context.Request.Context(), expectation)
}

func agentcompatFsWriteContract(context *gin.Context) (agentcompatFsWriteContractResponse, error) {
	var request agentcompatFsWriteContractRequest
	if err := decodeAgentcompatJSON(context, &request); err != nil {
		return agentcompatFsWriteContractResponse{}, err
	}
	if request.ServerID == 0 || request.Operation == "" {
		return agentcompatFsWriteContractResponse{}, errors.New("server_id and operation are required")
	}
	if request.Operation != agentcompatFsWriteOperation(agentcompatFsWriteOperationOversize) {
		return agentcompatFsWriteContractResponse{}, errors.New("unknown filesystem write operation")
	}
	token := APITokenFromContext(context)
	if token == nil || !token.HasScope(model.ScopeServerWrite) {
		return agentcompatFsWriteContractResponse{}, errors.New("missing required scope: " + model.ScopeServerWrite)
	}
	server, err := requireServerAccess(context, request.ServerID)
	if err != nil {
		return agentcompatFsWriteContractResponse{}, err
	}
	content := "denied"
	if request.Operation == agentcompatFsWriteOperation(agentcompatFsWriteOperationOversize) {
		content = agentcompatOversizeWriteSentinel
	}
	// This tagged probe owns both path and payload; accepting either from callers would make it an arbitrary-write endpoint.
	raw, err := rpc.CallAgent(context.Request.Context(), server.ID, model.TaskTypeFsWrite, model.FsWriteRequest{
		Path: agentcompatOversizeWriteServerPath, Content: content, Encoding: "utf8", Mode: "0600",
	}, 30*time.Second)
	if err != nil {
		return agentcompatFsWriteContractResponse{}, err
	}
	var result model.FsWriteResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return agentcompatFsWriteContractResponse{}, err
	}
	return agentcompatFsWriteContractResponse{Result: result, AgentRPCResponse: true}, nil
}

func decodeAgentcompatJSON(context *gin.Context, value any) error {
	decoder := json.NewDecoder(context.Request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		return err
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		if err == nil {
			return fmt.Errorf("trailing JSON values are not allowed")
		}
		return err
	}
	return nil
}

```

### Core Architecture Module: `cmd/dashboard/controller/agentcompat_routes_default.go`
```
//go:build !agentcompat

package controller

import "github.com/gin-gonic/gin"

func registerAgentcompatRoutes(*gin.Engine) {}

```

### Core Architecture Module: `cmd/dashboard/controller/agentcompat_sqlite_hold_routes_agentcompat_linux.go`
```
//go:build agentcompat && linux

package controller

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/nezhahq/nezha/service/singleton"
)

const agentcompatSQLiteHoldPath = "/agentcompat/sqlite-hold/"

type agentcompatSQLiteHoldControl interface {
	ArmNextSQLiteHold() (singleton.SQLiteHoldReceipt, error)
	WaitSQLiteHoldSelected(context.Context, singleton.SQLiteHoldReceipt) (singleton.SQLiteHoldReceipt, error)
	WaitSQLiteHoldFinalizing(context.Context, singleton.SQLiteHoldReceipt) (singleton.SQLiteHoldReceipt, error)
	SnapshotSQLiteHold(singleton.SQLiteHoldReceipt) (singleton.SQLiteHoldReceipt, error)
	ReleaseSQLiteHold(singleton.SQLiteHoldReceipt) (singleton.SQLiteHoldReceipt, error)
	AbortSQLiteHold(singleton.SQLiteHoldReceipt) (singleton.SQLiteHoldReceipt, error)
}

type agentcompatSQLiteHoldFacade struct{}

func (agentcompatSQLiteHoldFacade) ArmNextSQLiteHold() (singleton.SQLiteHoldReceipt, error) {
	return singleton.ArmNextSQLiteHold()
}
func (agentcompatSQLiteHoldFacade) WaitSQLiteHoldSelected(ctx context.Context, receipt singleton.SQLiteHoldReceipt) (singleton.SQLiteHoldReceipt, error) {
	return singleton.WaitSQLiteHoldSelected(ctx, receipt)
}
func (agentcompatSQLiteHoldFacade) WaitSQLiteHoldFinalizing(ctx context.Context, receipt singleton.SQLiteHoldReceipt) (singleton.SQLiteHoldReceipt, error) {
	return singleton.WaitSQLiteHoldFinalizing(ctx, receipt)
}
func (agentcompatSQLiteHoldFacade) SnapshotSQLiteHold(receipt singleton.SQLiteHoldReceipt) (singleton.SQLiteHoldReceipt, error) {
	return singleton.SnapshotSQLiteHold(receipt)
}
func (agentcompatSQLiteHoldFacade) ReleaseSQLiteHold(receipt singleton.SQLiteHoldReceipt) (singleton.SQLiteHoldReceipt, error) {
	return singleton.ReleaseSQLiteHold(receipt)
}
func (agentcompatSQLiteHoldFacade) AbortSQLiteHold(receipt singleton.SQLiteHoldReceipt) (singleton.SQLiteHoldReceipt, error) {
	return singleton.AbortSQLiteHold(receipt)
}

var agentcompatSQLiteHoldController agentcompatSQLiteHoldControl = agentcompatSQLiteHoldFacade{}

type agentcompatSQLiteHoldRequest struct {
	ID    string                           `json:"id"`
	State singleton.SQLiteHoldControlState `json:"state"`
}

func registerAgentcompatSQLiteHoldRoutes(router *gin.Engine, patAuth gin.HandlerFunc) {
	readOnlyPAT := func(c *gin.Context) { suppressAPITokenAuthWrites(c) }
	router.POST(agentcompatSQLiteHoldPath+"arm", readOnlyPAT, patAuth, commonHandler(agentcompatSQLiteHoldArm))
	router.POST(agentcompatSQLiteHoldPath+"wait", readOnlyPAT, patAuth, commonHandler(agentcompatSQLiteHoldWait))
	router.POST(agentcompatSQLiteHoldPath+"snapshot", readOnlyPAT, patAuth, commonHandler(agentcompatSQLiteHoldSnapshot))
	router.POST(agentcompatSQLiteHoldPath+"release", readOnlyPAT, patAuth, commonHandler(agentcompatSQLiteHoldRelease))
	router.POST(agentcompatSQLiteHoldPath+"abort", readOnlyPAT, patAuth, commonHandler(agentcompatSQLiteHoldAbort))
}

func agentcompatSQLiteHoldArm(c *gin.Context) (singleton.SQLiteHoldReceipt, error) {
	var request struct{}
	if err := decodeAgentcompatSQLiteHoldRequest(c, &request); err != nil {
		return singleton.SQLiteHoldReceipt{}, agentcompatSQLiteHoldError(err)
	}
	receipt, err := agentcompatSQLiteHoldController.ArmNextSQLiteHold()
	return receipt, agentcompatSQLiteHoldError(err)
}
func agentcompatSQLiteHoldWait(c *gin.Context) (singleton.SQLiteHoldReceipt, error) {
	receipt, err := decodeAgentcompatSQLiteHoldReceipt(c, true)
	if err != nil {
		return singleton.SQLiteHoldReceipt{}, agentcompatSQLiteHoldError(err)
	}
	switch receipt.State {
	case singleton.SQLiteHoldControlStateSelected:
		receipt, err = agentcompatSQLiteHoldController.WaitSQLiteHoldSelected(c.Request.Context(), receipt)
	case singleton.SQLiteHoldControlStateFinalizing:
		receipt, err = agentcompatSQLiteHoldController.WaitSQLiteHoldFinalizing(c.Request.Context(), receipt)
	default:
		return singleton.SQLiteHoldReceipt{}, agentcompatSQLiteHoldInvalidRequest{}
	}
	return receipt, agentcompatSQLiteHoldError(err)
}
func agentcompatSQLiteHoldSnapshot(c *gin.Context) (singleton.SQLiteHoldReceipt, error) {
	receipt, err := decodeAgentcompatSQLiteHoldReceipt(c, false)
	if err != nil {
		return singleton.SQLiteHoldReceipt{}, agentcompatSQLiteHoldError(err)
	}
	result, err := agentcompatSQLiteHoldController.SnapshotSQLiteHold(receipt)
	return result, agentcompatSQLiteHoldError(err)
}
func agentcompatSQLiteHoldRelease(c *gin.Context) (singleton.SQLiteHoldReceipt, error) {
	receipt, err := decodeAgentcompatSQLiteHoldReceipt(c, false)
	if err != nil {
		return singleton.SQLiteHoldReceipt{}, agentcompatSQLiteHoldError(err)
	}
	result, err := agentcompatSQLiteHoldController.ReleaseSQLiteHold(receipt)
	return result, agentcompatSQLiteHoldError(err)
}
func agentcompatSQLiteHoldAbort(c *gin.Context) (singleton.SQLiteHoldReceipt, error) {
	receipt, err := decodeAgentcompatSQLiteHoldReceipt(c, false)
	if err != nil {
		return singleton.SQLiteHoldReceipt{}, agentcompatSQLiteHoldError(err)
	}
	result, err := agentcompatSQLiteHoldController.AbortSQLiteHold(receipt)
	return result, agentcompatSQLiteHoldError(err)
}

type agentcompatSQLiteHoldInvalidRequest struct{}

func (agentcompatSQLiteHoldInvalidRequest) Error() string {
	return "agentcompat sqlite hold request is invalid"
}

func decodeAgentcompatSQLiteHoldRequest(c *gin.Context, value any) error {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 512)
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		return agentcompatSQLiteHoldInvalidRequest{}
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return agentcompatSQLiteHoldInvalidRequest{}
	}
	return nil
}
func decodeAgentcompatSQLiteHoldReceipt(c *gin.Context, requireState bool) (singleton.SQLiteHoldReceipt, error) {
	var request agentcompatSQLiteHoldRequest
	if err := decodeAgentcompatSQLiteHoldRequest(c, &request); err != nil {
		return singleton.SQLiteHoldReceipt{}, err
	}
	decoded, err := base64.RawURLEncoding.DecodeString(request.ID)
	if err != nil || len(request.ID) != 43 || len(decoded) != 32 {
		return singleton.SQLiteHoldReceipt{}, agentcompatSQLiteHoldInvalidRequest{}
	}
	if !requireState && request.State != "" {
		return singleton.SQLiteHoldReceipt{}, agentcompatSQLiteHoldInvalidRequest{}
	}
	return singleton.SQLiteHoldReceipt{ID: request.ID, State: request.State}, nil
}
func agentcompatSQLiteHoldError(err error) error {
	if err == nil {
		return nil
	}
	if errors.As(err, new(agentcompatSQLiteHoldInvalidRequest)) {
		return agentcompatSQLiteHoldInvalidRequest{}
	}
	switch {
	case errors.Is(err, singleton.ErrSQLiteHoldSessionActive):
		return errors.New("agentcompat sqlite hold is active")
	case errors.Is(err, singleton.ErrSQLiteHoldStaleSession):
		return errors.New("agentcompat sqlite hold receipt is stale")
	case errors.Is(err, singleton.ErrSQLiteHoldFinalizationNotStarted), errors.Is(err, singleton.ErrSQLiteHoldFinalizationStarted):
		return errors.New("agentcompat sqlite hold is not ready")
	case errors.Is(err, singleton.ErrSQLiteHoldUnexpectedSelection), errors.Is(err, singleton.ErrSQLiteHoldAmbiguousCandidate), errors.Is(err, singleton.ErrSQLiteHoldAborted):
		return errors.New("agentcompat sqlite hold was aborted")
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return errors.New("agentcompat sqlite hold wait was canceled")
	default:
		return errors.New("agentcompat sqlite hold control is unavailable")
	}
}

```

### Core Architecture Module: `cmd/dashboard/controller/agentcompat_sqlite_hold_routes_agentcompat_nonlinux.go`
```
//go:build agentcompat && !linux

package controller

import "github.com/gin-gonic/gin"

func registerAgentcompatSQLiteHoldRoutes(*gin.Engine, gin.HandlerFunc) {}

```

### Core Architecture Module: `cmd/dashboard/controller/alertrule.go`
```
package controller

import (
	"slices"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jinzhu/copier"

	"github.com/nezhahq/nezha/model"
	"github.com/nezhahq/nezha/service/singleton"
)

// List Alert rules
// @Summary List Alert rules
// @Security BearerAuth
// @Schemes
// @Description List Alert rules
// @Tags auth required
// @Param id query uint false "Resource ID"
// @Produce json
// @Success 200 {object} model.CommonResponse[[]model.AlertRule]
// @Router /alert-rule [get]
func listAlertRule(c *gin.Context) ([]*model.AlertRule, error) {
	singleton.AlertsLock.RLock()
	defer singleton.AlertsLock.RUnlock()

	var ar []*model.AlertRule
	if err := copier.Copy(&ar, &singleton.Alerts); err != nil {
		return nil, err
	}
	return ar, nil
}

// Add Alert Rule
// @Summary Add Alert Rule
// @Security BearerAuth
// @Schemes
// @Description Add Alert Rule
// @Tags auth required
// @Accept json
// @param request body model.AlertRuleForm true "AlertRuleForm"
// @Produce json
// @Success 200 {object} model.CommonResponse[uint64]
// @Router /alert-rule [post]
func createAlertRule(c *gin.Context) (uint64, error) {
	var arf model.AlertRuleForm
	var r model.AlertRule

	if err := c.ShouldBindJSON(&arf); err != nil {
		return 0, err
	}

	uid := getUid(c)

	r.UserID = uid
	r.Name = arf.Name
	r.Rules = arf.Rules
	r.FailTriggerTasks = arf.FailTriggerTasks
	r.RecoverTriggerTasks = arf.RecoverTriggerTasks
	r.NotificationGroupID = arf.NotificationGroupID
	enable := arf.Enable
	r.TriggerMode = arf.TriggerMode
	r.Enable = &enable

	if err := validateRule(c, &r); err != nil {
		return 0, err
	}

	if err := singleton.DB.Create(&r).Error; err != nil {
		return 0, newGormError("%v", err)
	}

	singleton.OnRefreshOrAddAlert(&r)
	return r.ID, nil
}

// Update Alert Rule
// @Summary Update Alert Rule
// @Security BearerAuth
// @Schemes
// @Description Update Alert Rule
// @Tags auth required
// @Accept json
// @param id path uint true "Alert ID"
// @param request body model.AlertRuleForm true "AlertRuleForm"
// @Produce json
// @Success 200 {object} model.CommonResponse[any]
// @Router /alert-rule/{id} [patch]
func updateAlertRule(c *gin.Context) (any, error) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return nil, err
	}

	var arf model.AlertRuleForm
	if err := c.ShouldBindJSON(&arf); err != nil {
		return 0, err
	}

	var r model.AlertRule
	if err := singleton.DB.First(&r, id).Error; err != nil {
		return nil, singleton.Localizer.ErrorT("alert id %d does not exist", id)
	}

	if !r.HasPermission(c) {
		return nil, singleton.Localizer.ErrorT("permission denied")
	}

	r.Name = arf.Name
	r.Rules = arf.Rules
	r.FailTriggerTasks = arf.FailTriggerTasks
	r.RecoverTriggerTasks = arf.RecoverTriggerTasks
	r.NotificationGroupID = arf.NotificationGroupID
	enable := arf.Enable
	r.TriggerMode = arf.TriggerMode
	r.Enable = &enable

	if err := validateRule(c, &r); err != nil {
		return 0, err
	}

	if err := singleton.DB.Save(&r).Error; err != nil {
		return 0, newGormError("%v", err)
	}

	singleton.OnRefreshOrAddAlert(&r)
	return r.ID, nil
}

// Batch delete Alert rules
// @Summary Batch delete Alert rules
// @Security BearerAuth
// @Schemes
// @Description Batch delete Alert rules
// @Tags auth required
// @Accept json
// @param request body []uint64 true "id list"
// @Produce json
// @Success 200 {object} model.CommonResponse[any]
// @Router /batch-delete/alert-rule [post]
func batchDeleteAlertRule(c *gin.Context) (any, error) {
	var ar []uint64
	if err := c.ShouldBindJSON(&ar); err != nil {
		return nil, err
	}

	var ars []model.AlertRule
	if err := singleton.DB.Where("id in (?)", ar).Find(&ars).Error; err != nil {
		return nil, err
	}

	for _, a := range ars {
		if !a.HasPermission(c) {
			return nil, singleton.Localizer.ErrorT("permission denied")
		}
	}

	if err := singleton.DB.Unscoped().Delete(&model.AlertRule{}, "id in (?)", ar).Error; err != nil {
		return nil, newGormError("%v", err)
	}

	singleton.OnDeleteAlert(ar)
	return nil, nil
}

func validateRule(c *gin.Context, r *model.AlertRule) error {
	if !r.HasPermission(c) {
		return singleton.Localizer.ErrorT("permission denied")
	}
	if len(r.Rules) > 0 {
		for _, rule := range r.Rules {
			if rule == nil {
				return singleton.Localizer.ErrorT("rule is not set")
			}
			if !rule.IsSupportedType() {
				return singleton.Localizer.ErrorT("unsupported rule type")
			}
			switch rule.Cover {
			case model.RuleCoverAll, model.RuleCoverIgnoreAll:
			default:
				return singleton.Localizer.ErrorT("permission denied")
			}

			if !rule.IsTransferDurationRule() {
				if rule.Duration < 3 {
					return singleton.Localizer.ErrorT("duration need to be at least 3")
				}
				if rule.Duration > model.MaxAlertRuleDuration {
					return singleton.Localizer.ErrorT("duration is too large")
				}
			} else {
				if rule.CycleInterval < 1 {
					return singleton.Localizer.ErrorT("cycle_interval need to be at least 1")
				}
				if rule.CycleInterval > model.MaxAlertRuleCycleInterval {
					return singleton.Localizer.ErrorT("cycle_interval is too large")
				}
				if rule.CycleStart == nil {
					return singleton.Localizer.ErrorT("cycle_start is not set")
				}
				if rule.CycleStart.After(time.Now()) {
					return singleton.Localizer.ErrorT("cycle_start is a future value")
				}
			}
		}
	} else {
		return singleton.Localizer.ErrorT("need to configure at least a single rule")
	}

	if !singleton.CronShared.CheckPermission(c, slices.Values(r.FailTriggerTasks)) {
		return singleton.Localizer.ErrorT("permission denied")
	}
	if !singleton.CronShared.CheckPermission(c, slices.Values(r.RecoverTriggerTasks)) {
		return singleton.Localizer.ErrorT("permission denied")
	}
	if err := enforcePATTriggerTaskScope(c, r.FailTriggerTasks, r.RecoverTriggerTasks); err != nil {
		return err
	}

	if err := assertOwnsNotificationGroup(c, r.NotificationGroupID); err != nil {
		return err
	}

	return nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1238** (2026-09-15): **Fixed: An issue where deleting DNS records for domains hosted on Cloudflare did not work.**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > The workaround has been updated.  However The DDNS deletion function(Cloudflare): For cloudflare, requiring a record_id is a non-negotiable security boundary.
  > To make the required direction explicit: **please stop implementing the Cloudflare workaround in Nezha and open an upstream PR in `libdns/cloudflare` first. This Nezha-side provider special case will not be accepted.**\n\nRequired sequence:\n1. Open a PR against `github.com/libdns/cloudflare` that makes `DeleteRecords` honor the libdns wildcard contract for an empty record value (resolve Cloudflare record IDs internally by Name+Type), with subdomain and apex tests.\n2. Get that provider change merged and available as a version/commit that Nezha can consume.\n3. Update only the `libdns/cloudflare` dependency in this PR, while keeping Nezha on its existing provider-agnostic `RecordDeleter` path.\n4. Remove all `Cloudflare Special` branches, the process-global cache, and the no-op Cloudflare-specific logging from Nezha.\n\nCloudflare requiring an ID for its DELETE endpoint does not justify this code in Nezha: the provider already owns the ID lookup inside its `DeleteRecords` implementatio
  > ok

- **Issue #1237** (2026-09-14): **Improve: Delete the corresponding DNS record if the IPv4/IPv6 address is empty.**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Updated.
  > Updated.
  > Updated.

- **Issue #1236** (2026-09-12): **feat(auth): allow JWT IP changes by configuration**
  *Symptoms*: ## Summary  Add the `allow_jwt_ip_change` configuration option to permit browser login JWT sessions to continue when the client IP changes.  Some users access the dashboard through proxies whose exit IP can change frequently. With strict IP-bound JWT sessions, every IP change invalidates the session and repeatedly logs the user out.  This option lets each operator decide whether to trade some session-binding security for a more stable login experience:  - Default remains `false`, preserving strict IP-bound session behavior. - When enabled, valid JWT sessions remain usable after proxy or network IP changes. - Expose the option through the admin settings API, preserving its value for partial PATCH requests.  ## Tests  - `go test ./model` - Added JWT session coverage for both the default reject behavior and enabled allow behavior. - Added configuration and settings-form decoding coverage.

- **Issue #1235** (2026-09-12): **feat: surface GPU memory in host state**
  *Symptoms*: Closes #1217  - Add `State_GPU` message to the proto with utilization and memory fields - Add `HostState.GPUs`, converted in both `PB()` and `PB2State()` - Keep the existing `gpu` field populated so agents on the official build keep working  Design follows the note in nezhahq/agent#51 that this should go through the proto rather than an extra field. `State_GPU` is index-aligned with `Host.gpu`, matching the `gpu` field it supersedes.  The agent side is a companion PR in nezhahq/agent. Frontend rendering needs a small change in hamster1963/nezha-dash-v2 as well; without it the new field is simply ignored.  Verified against a live panel: an agent built from the companion branch reports `{"utilization":0,"memory_used":1937,"memory_total":6144}` over the websocket, and the other five hosts running the official agent stayed connected throughout — the change only adds a field.  `nezha_grpc.pb.go` is untouched since the service is unchanged. Regenerated with protoc-gen-go v1.34.2 / protoc v5.29.3 to match the existing headers.

- **Issue #1232** (2026-09-11): **请求需求**
  *Symptoms*: ### 运行环境  docker  ### Nezha 版本  v2.3.6  ### 描述问题  如果某服务器挂了，或者网络原因掉线了一段时间，现在查看记录很难分辨那个时间段出问题，希望能从网络、cpu等指标中能体现。  或者加一个在线状态的指标  ### 复现步骤  看上述  ### 配置信息  <details></details>   ### 附加信息  <details></details>   ### 验证  - [x] 我确认这是一个 nezha (哪吒面板) 的问题。 - [x] 我已经搜索了 Issues，并确认该问题之前没有被反馈过。

- **Issue #1231** (2026-08-17): **improve: ddns**
  *Symptoms*: 

- **Issue #1229** (2026-08-12): **feat.主题强兼（强行兼容）komari**
  *Symptoms*: TLDR：让哪吒 dashboard 可以直接加载 komari theme-market 的真实主题包，兼容komari生态，并用只读浏览器兼容层把哪吒公开数据转换为 komari 主题需要的接口。主题包不修改，登录统一回到哪吒 /dashboard。  这次只包含 komari 主题相关更新。  主题列表从 theme-market 动态读取，未来新增主题不需要继续硬编码。下载主题时验证 SHA256，限制文件数量、压缩包与解压大小，并阻止路径穿越和符号链接。远端目录失败时使用本地缓存和内置快照  选中主题后直接服务其真实 dist。兼容层支持 fetch、XMLHttpRequest、JSON-RPC HTTP、JSON-RPC WebSocket 和旧版 /api/clients WebSocket，并转换节点信息、实时 CPU、内存、磁盘、网络、连接数、进程数、运行时间及部分历史指标。管理、终端、文件和命令执行等写接口不会模拟  komari 主题中的 /admin、/admin/login、/login 和常见登录按钮会进入哪吒原登录入口 /dashboard。还兼容主题 manifest 路径、dist 路径、国家旗帜和系统图标，并限制历史指标并发，避免大规模节点下产生过量请求  没有修改任何第三方主题包的内容，确保今后的兼容性 
  **Post-Mortem & Fix Analysis**:
  > 不会兼容 也不需要兼容

- **Issue #1228** (2026-08-15): **Translations update from Hosted Weblate**
  *Symptoms*: Translations update from [Hosted Weblate](https://hosted.weblate.org) for [Nezha/Nezha Dashboard](https://hosted.weblate.org/projects/nezha/nezha-dashboard/).    Current translation status:  ![Weblate translation status](https://hosted.weblate.org/widget/nezha/nezha-dashboard/matrix-auto.svg)

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

### Incident Patch 1: `9dab6a50` (2026-09-19)
**Commit Message**: fix: harden notification cache synchronization

**File**: `cmd/dashboard/controller/notification.go` (modified, +6/-0)
```diff
@@ -1,6 +1,7 @@
 package controller
 
 import (
+	"net/http"
 	"slices"
 	"strconv"
 
@@ -12,6 +13,8 @@ import (
 	"github.com/nezhahq/nezha/service/singleton"
 )
 
+const notificationBatchDeleteMaxBodyBytes = 1 << 20
+
 // List notification
 // @Summary List notification
 // @Security BearerAuth
@@ -174,6 +177,9 @@ func updateNotification(c *gin.Context) (any, error) {
 // @Router /batch-delete/notification [post]
 func batchDeleteNotification(c *gin.Context) (any, error) {
 	var n []uint64
+	if c.Request != nil && c.Request.Body != nil {
+		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, notificationBatchDeleteMaxBodyBytes)
+	}
 	if err := c.ShouldBindJSON(&n); err != nil {
 		return nil, err
 	}
```

**File**: `cmd/dashboard/controller/notification_body_limit_test.go` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+package controller
+
+import (
+	"bytes"
+	"net/http"
+	"net/http/httptest"
+	"strings"
+	"testing"
+
+	"github.com/gin-gonic/gin"
+)
+
+func TestBatchDeleteNotificationCapsRequestBody(t *testing.T) {
+	body := append(bytes.Repeat([]byte{' '}, notificationBatchDeleteMaxBodyBytes+1), '[', ']')
+	req := httptest.NewRequest(http.MethodPost, "/api/v1/batch-delete/notification", bytes.NewReader(body))
+	req.Header.Set("Content-Type", "application/json")
+	w := httptest.NewRecorder()
+	c, _ := gin.CreateTestContext(w)
+	c.Request = req
+
+	_, err := batchDeleteNotification(c)
+	if err == nil || !strings.Contains(err.Error(), "request body too large") {
+		t.Fatalf("oversized request body was not rejected by MaxBytesReader: %v", err)
+	}
+}
```

**File**: `service/singleton/notification.go` (modified, +67/-54)
```diff
@@ -81,92 +81,99 @@ func NewNotificationClass() *NotificationClass {
 }
 
 func (c *NotificationClass) Update(n *model.Notification) {
-	c.listMu.Lock()
+	func() {
+		c.listMu.Lock()
+		defer c.listMu.Unlock()
 
-	_, ok := c.list[n.ID]
-	c.list[n.ID] = n
+		_, ok := c.list[n.ID]
+		c.list[n.ID] = n
+		if !ok {
+			return
+		}
 
-	if ok {
-		if gids, ok := c.idToGroupList[n.ID]; ok {
-			for gid := range gids {
-				c.groupToIDList[gid][n.ID] = n
+		gids := c.idToGroupList[n.ID]
+		for gid := range gids {
+			group, exists := c.groupToIDList[gid]
+			if !exists {
+				delete(gids, gid)
+				continue
 			}
+			group[n.ID] = n
 		}
-	}
-
-	c.listMu.Unlock()
+		if len(gids) == 0 {
+			delete(c.idToGroupList, n.ID)
+		}
+	}()
 	c.sortList()
 }
 
 func (c *NotificationClass) UpdateGroup(ng *model.NotificationGroup, ngn []uint64) {
 	c.groupMu.Lock()
 	defer c.groupMu.Unlock()
 
-	_, ok := c.groupList[ng.ID]
 	c.groupList[ng.ID] = ng.Name
 
 	c.listMu.Lock()
 	defer c.listMu.Unlock()
-	if !ok {
-		c.groupToIDList[ng.ID] = make(map[uint64]*model.Notification, len(ngn))
-		for _, n := range ngn {
-			if c.idToGroupList[n] == nil {
-				c.idToGroupList[n] = make(map[uint64]struct{})
-			}
-			c.idToGroupList[n][ng.ID] = struct{}{}
-			c.groupToIDList[ng.ID][n] = c.list[n]
+
+	oldList := c.groupToIDList[ng.ID]
+	newList := make(map[uint64]*model.Notification, len(ngn))
+	for _, nid := range ngn {
+		n, ok := c.list[nid]
+		if !ok {
+			continue
 		}
-	} else {
-		oldList := make(map[uint64]struct{})
-		for nid := range c.groupToIDList[ng.ID] {
-			oldList[nid] = struct{}{}
+		newList[nid] = n
+		if c.idToGroupList[nid] == nil {
+			c.idToGroupList[nid] = make(map[uint64]struct{})
 		}
+		c.idToGroupList[nid][ng.ID] = struct{}{}
+	}
 
-		c.groupToIDList[ng.ID] = make(map[uint64]*model.Notification)
-		for _, nid := range ngn {
-			c.groupToIDList[ng.ID][nid] = c.list[nid]
-			if c.idToGroupList[nid] == nil {
-				c.idToGroupList[nid] = make(map[uint64]struct{})
-			}
-			c.idToGroupList[nid][ng.ID] = struct{}{}
+	for oldID := range oldList {
+		if _, ok := newList[oldID]; ok {
+			continue
 		}
-
-		for oldID := range oldList {
-			if _, ok := c.groupToIDList[ng.ID][oldID]; !ok {
-				delete(c.groupToIDList[oldID], ng.ID)
-				if len(c.idToGroupList[oldID]) == 0 {
-					delete(c.idToGroupList, oldID)
-				}
-			}
+		delete(c.idToGroupList[oldID], ng.ID)
+		if len(c.idToGroupList[oldID]) == 0 {
+			delete(c.idToGroupList, oldID)
 		}
 	}
+	c.groupToIDList[ng.ID] = newList
 }
 
 func (c *NotificationClass) Delete(idList []uint64) {
-	c.listMu.Lock()
-
-	for _, id := range idList {
-		delete(c.list, id)
-		// 如果绑定了通知组才删除
-		if gids, ok := c.idToGroupList[id]; ok {
-			for gid := range gids {
-				delete(c.groupToIDList[gid], id)
+	func() {
+		c.listMu.Lock()
+		defer c.listMu.Unlock()
+
+		for _, id := range idList {
+			delete(c.list, id)
+			// 如果绑定了通知组才删除
+			if gids, ok := c.idToGroupList[id]; ok {
+				for gid := range gids {
+					delete(c.groupToIDList[gid], id)
+				}
 				delete(c.idToGroupList, id)
 			}
 		}
-	}
-
-	c.listMu.Unlock()
+	}()
 	c.sortList()
 }
 
 func (c *NotificationClass) DeleteGroup(gids []uint64) {
-	c.listMu.Lock()
-	defer c.listMu.Unlock()
 	c.groupMu.Lock()
 	defer c.groupMu.Unlock()
+	c.listMu.Lock()
+	defer c.listMu.Unlock()
 
 	for _, gid := range gids {
+		for nid := range c.groupToIDList[gid] {
+			delete(c.idToGroupList[nid], gid)
+			if len(c.idToGroupList[nid]) == 0 {
+				delete(c.idToGroupList, nid)
+			}
+		}
 		delete(c.groupList, gid)
 		delete(c.groupToIDList, gid)
 	}
@@ -234,13 +241,19 @@ func (c *NotificationClass) SendNotification(notificationGroupID uint64, desc st
 			return
 		}
 	}
-	// 向该通知方式组的所有通知方式发出通知
+	// Copy the group under the lock. Webhook delivery can take minutes and must
+	// not block notification or notification-group updates while it is in flight.
 	c.listMu.RLock()
-	defer c.listMu.RUnlock()
+	notifications := make([]*model.Notification, 0, len(c.groupToIDList[notification
```

**File**: `service/singleton/notification_test.go` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+package singleton
+
+import (
+	"testing"
+	"time"
+
+	"github.com/nezhahq/nezha/model"
+)
+
+func newNotificationClassWithItems(items ...*model.Notification) *NotificationClass {
+	nc := NewEmptyNotificationClassForTest()
+	for _, item := range items {
+		nc.InsertForTest(item)
+	}
+	return nc
+}
+
+func TestNotificationClassDeleteGroupCleansReverseIndex(t *testing.T) {
+	n := &model.Notification{Common: model.Common{ID: 1, UserID: 2}, Name: "hook"}
+	nc := newNotificationClassWithItems(n)
+	group := &model.NotificationGroup{Common: model.Common{ID: 10, UserID: 2}, Name: "group"}
+	nc.UpdateGroup(group, []uint64{n.ID})
+
+	nc.DeleteGroup([]uint64{group.ID})
+
+	if _, ok := nc.groupToIDList[group.ID]; ok {
+		t.Fatalf("forward index still contains deleted group %d", group.ID)
+	}
+	if groups, ok := nc.idToGroupList[n.ID]; ok {
+		if _, stale := groups[group.ID]; stale {
+			t.Fatalf("reverse index for notification %d still contains deleted group %d", n.ID, group.ID)
+		}
+	}
+}
+
+func TestNotificationClassUpdateGroupCleansRemovedMembership(t *testing.T) {
+	first := &model.Notification{Common: model.Common{ID: 1, UserID: 2}, Name: "first"}
+	second := &model.Notification{Common: model.Common{ID: 2, UserID: 2}, Name: "second"}
+	nc := newNotificationClassWithItems(first, second)
+	group := &model.NotificationGroup{Common: model.Common{ID: 10, UserID: 2}, Name: "group"}
+	nc.UpdateGroup(group, []uint64{first.ID, second.ID})
+
+	nc.UpdateGroup(group, []uint64{second.ID})
+
+	if groups, ok := nc.idToGroupList[first.ID]; ok {
+		if _, stale := groups[group.ID]; stale {
+			t.Fatalf("reverse index for notification %d still contains group %d", first.ID, group.ID)
+		}
+	}
+	if _, ok := nc.idToGroupList[second.ID][group.ID]; !ok {
+		t.Fatalf("reverse index lost retained membership of notification %d in group %d", second.ID, group.ID)
+	}
+}
+
+func TestNotificationClassUpdateRepairsOrphanedReverseIndex(t *testing.T) {
+	n := &model.Notification{Common: model.Common{ID: 1, UserID: 2}, Name: "hook"}
+	nc := newNotificationClassWithItems(n)
+	nc.idToGroupList[n.ID] = map[uint64]struct{}{99: {}}
+
+	n.Name = "updated"
+	nc.Update(n)
+
+	if groups, ok := nc.idToGroupList[n.ID]; ok && len(groups) != 0 {
+		t.Fatalf("orphaned reverse memberships were not removed: %v", groups)
+	}
+}
+
+func TestNotificationClassGroupMutationsDoNotDeadlock(t *testing.T) {
+	nc := NewEmptyNotificationClassForTest()
+	nc.listMu.RLock()
+	readLockHeld := true
+	defer func() {
+		if readLockHeld {
+			nc.listMu.RUnlock()
+		}
+	}()
+
+	deleteDone := make(chan struct{})
+	go func() {
+		nc.DeleteGroup([]uint64{10})
+		close(deleteDone)
+	}()
+
+	deadline := time.Now().Add(2 * time.Second)
+	for nc.listMu.TryRLock() {
+		nc.listMu.RUnlock()
+		if time.Now().After(deadline) {
+			t.Fatal("DeleteGroup did not queue for listMu")
+		}
+		time.Sleep(time.Millisecond)
+	}
+
+	updateDone := make(chan struct{})
+	go func() {
+		nc.UpdateGroup(&model.NotificationGroup{
+			Common: model.Common{ID: 10, UserID: 2},
+			Name:   "group",
+		}, nil)
+		close(updateDone)
+	}()
+
+	deadline = time.Now().Add(2 * time.Second)
+	for nc.groupMu.TryLock() {
+		nc.groupMu.Unlock()
+		if time.Now().After(deadline) {
+			t.Fatal("neither group mutation acquired groupMu")
+		}
+		time.Sleep(time.Millisecond)
+	}
+
+	nc.listMu.RUnlock()
+	readLockHeld = false
+
+	timer := time.NewTimer(2 * time.Second)
+	defer timer.Stop()
+	for deleteDone != nil || updateDone != nil {
+		select {
+		case <-deleteDone:
+			deleteDone = nil
+		case <-updateDone:
+			updateDone = nil
+		case <-timer.C:
+			t.Fatal("concurrent UpdateGroup and DeleteGroup deadlocked")
+		}
+	}
+}
```

---

### Incident Patch 2: `06d38777` (2026-09-13)
**Commit Message**: fix(tsdb): survive low disk space

**File**: `pkg/tsdb/disk_guard_test.go` (added, +124/-0)
```diff
@@ -0,0 +1,124 @@
+package tsdb
+
+import (
+	"path/filepath"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	"github.com/VictoriaMetrics/VictoriaMetrics/lib/storage"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+type testReadOnlyChecker struct {
+	value atomic.Bool
+}
+
+func (c *testReadOnlyChecker) IsReadOnly() bool {
+	return c.value.Load()
+}
+
+func newDiskGuardTestDB(t *testing.T) *TSDB {
+	t.Helper()
+	db, err := Open(&Config{
+		DataPath:           filepath.Join(t.TempDir(), "tsdb"),
+		RetentionDays:      1,
+		MinFreeDiskSpaceGB: 1,
+		DedupInterval:      time.Second,
+	})
+	require.NoError(t, err)
+	t.Cleanup(func() { require.NoError(t, db.Close()) })
+	return db
+}
+
+func bufferedRows(w *bufferedWriter) int {
+	w.mu.Lock()
+	defer w.mu.Unlock()
+	return len(w.buffer)
+}
+
+func TestReadOnlyStorageDropsWritesAndKeepsQueriesAvailable(t *testing.T) {
+	db := newDiskGuardTestDB(t)
+	checker := &testReadOnlyChecker{}
+	db.readOnly = checker
+	originalAddRows := db.addRowsFn
+	var addRowsCalls atomic.Int32
+	db.addRowsFn = func(rows []storage.MetricRow, precisionBits uint8) {
+		addRowsCalls.Add(1)
+		originalAddRows(rows, precisionBits)
+	}
+
+	firstTimestamp := time.Now().Add(-time.Minute)
+	require.NoError(t, db.WriteServerMetrics(&ServerMetrics{
+		ServerID:  1,
+		Timestamp: firstTimestamp,
+		CPU:       10,
+	}))
+	db.Flush()
+	require.Equal(t, int32(1), addRowsCalls.Load())
+
+	before, err := db.QueryServerMetrics(1, MetricServerCPU, Period1Day)
+	require.NoError(t, err)
+	require.NotEmpty(t, before)
+
+	checker.value.Store(true)
+	require.NoError(t, db.WriteServerMetrics(&ServerMetrics{
+		ServerID:  1,
+		Timestamp: firstTimestamp.Add(2 * time.Second),
+		CPU:       20,
+	}))
+	assert.True(t, db.WritesPaused())
+	assert.Zero(t, bufferedRows(db.writer), "read-only writes must not accumulate in memory")
+	assert.Equal(t, int32(1), addRowsCalls.Load(), "read-only samples must not reach VictoriaMetrics")
+
+	afterDrop, err := db.QueryServerMetrics(1, MetricServerCPU, Period1Day)
+	require.NoError(t, err)
+	assert.Equal(t, before, afterDrop, "read-only mode must preserve existing query access")
+
+	checker.value.Store(false)
+	require.NoError(t, db.WriteServerMetrics(&ServerMetrics{
+		ServerID:  1,
+		Timestamp: firstTimestamp.Add(4 * time.Second),
+		CPU:       30,
+	}))
+	db.Flush()
+	assert.False(t, db.WritesPaused())
+	assert.Equal(t, int32(2), addRowsCalls.Load(), "writes must resume after storage leaves read-only mode")
+}
+
+func TestDiskFullAddRowsPanicPausesWrites(t *testing.T) {
+	db := newDiskGuardTestDB(t)
+	db.addRowsFn = func([]storage.MetricRow, uint8) {
+		panic("write data: no space left on device")
+	}
+
+	require.NoError(t, db.WriteServerMetrics(&ServerMetrics{
+		ServerID:  1,
+		Timestamp: time.Now(),
+		CPU:       10,
+	}))
+	assert.NotPanics(t, db.Flush)
+	assert.True(t, db.WritesPaused())
+
+	require.NoError(t, db.WriteServerMetrics(&ServerMetrics{
+		ServerID:  1,
+		Timestamp: time.Now().Add(time.Second),
+		CPU:       20,
+	}))
+	assert.Zero(t, bufferedRows(db.writer))
+}
+
+func TestNonDiskStoragePanicIsNotHidden(t *testing.T) {
+	db := newDiskGuardTestDB(t)
+	db.addRowsFn = func([]storage.MetricRow, uint8) {
+		panic("storage invariant failed")
+	}
+
+	require.NoError(t, db.WriteServerMetrics(&ServerMetrics{
+		ServerID:  1,
+		Timestamp: time.Now(),
+		CPU:       10,
+	}))
+	assert.PanicsWithValue(t, "storage invariant failed", db.Flush)
+}
```

**File**: `pkg/tsdb/maintenance.go` (modified, +4/-1)
```diff
@@ -10,8 +10,11 @@ func (db *TSDB) Maintenance() {
 	if db.closed {
 		return
 	}
+	if !db.acceptsWrites() {
+		return
+	}
 
 	log.Println("NEZHA>> TSDB starting maintenance (flush)...")
-	db.storage.DebugFlush()
+	db.debugFlushSafely()
 	log.Println("NEZHA>> TSDB maintenance completed")
 }
```

**File**: `pkg/tsdb/tsdb.go` (modified, +123/-5)
```diff
@@ -1,15 +1,26 @@
 package tsdb
 
 import (
+	"errors"
 	"fmt"
 	"log"
 	"path/filepath"
+	"strings"
 	"sync"
+	"sync/atomic"
 	"time"
 
 	"github.com/VictoriaMetrics/VictoriaMetrics/lib/storage"
 )
 
+// ErrDiskFull is returned when VictoriaMetrics cannot initialize because the
+// filesystem containing the TSDB has run out of space.
+var ErrDiskFull = errors.New("TSDB disk is full")
+
+type readOnlyChecker interface {
+	IsReadOnly() bool
+}
+
 // TSDB 封装 VictoriaMetrics 存储
 type TSDB struct {
 	storage *storage.Storage
@@ -18,6 +29,13 @@ type TSDB struct {
 	closed  bool
 
 	writer *bufferedWriter
+
+	readOnly     readOnlyChecker
+	addRowsFn    func([]storage.MetricRow, uint8)
+	debugFlushFn func()
+
+	readOnlyObserved atomic.Bool
+	diskFullPaused   atomic.Bool
 }
 
 // InitGlobalSettings 初始化 VictoriaMetrics 包级别的全局设置。
@@ -35,7 +53,18 @@ func InitGlobalSettings(config *Config) {
 }
 
 // Open 打开或创建 TSDB 存储
-func Open(config *Config) (*TSDB, error) {
+func Open(config *Config) (db *TSDB, err error) {
+	defer func() {
+		if recovered := recover(); recovered != nil {
+			if diskErr := diskFullPanicError(recovered); diskErr != nil {
+				db = nil
+				err = diskErr
+				return
+			}
+			panic(recovered)
+		}
+	}()
+
 	if config == nil {
 		config = DefaultConfig()
 	}
@@ -59,9 +88,12 @@ func Open(config *Config) (*TSDB, error) {
 
 	stor := storage.MustOpenStorage(dataPath, opts)
 
-	db := &TSDB{
-		storage: stor,
-		config:  config,
+	db = &TSDB{
+		storage:      stor,
+		config:       config,
+		readOnly:     stor,
+		addRowsFn:    stor.AddRows,
+		debugFlushFn: stor.DebugFlush,
 	}
 
 	db.writer = newBufferedWriter(db, config.WriteBufferSize, config.WriteBufferFlushInterval)
@@ -72,6 +104,86 @@ func Open(config *Config) (*TSDB, error) {
 	return db, nil
 }
 
+func diskFullPanicError(recovered any) error {
+	message := strings.ToLower(fmt.Sprint(recovered))
+	for _, marker := range []string{
+		"no space left on device",
+		"disk quota exceeded",
+		"not enough space on the disk",
+	} {
+		if strings.Contains(message, marker) {
+			return fmt.Errorf("%w: %v", ErrDiskFull, recovered)
+		}
+	}
+	return nil
+}
+
+// WritesPaused reports whether new samples are currently being discarded.
+// Queries remain available while VictoriaMetrics is in read-only mode.
+func (db *TSDB) WritesPaused() bool {
+	if db.diskFullPaused.Load() {
+		return true
+	}
+	return db.readOnly != nil && db.readOnly.IsReadOnly()
+}
+
+func (db *TSDB) acceptsWrites() bool {
+	if db.diskFullPaused.Load() {
+		return false
+	}
+
+	readOnly := db.readOnly != nil && db.readOnly.IsReadOnly()
+	if readOnly {
+		if db.readOnlyObserved.CompareAndSwap(false, true) {
+			log.Println("NEZHA>> TSDB writes paused because free disk space is below the configured limit; dashboard, queries, and alerts remain available")
+		}
+		return false
+	}
+
+	if db.readOnlyObserved.CompareAndSwap(true, false) {
+		log.Println("NEZHA>> TSDB writes resumed after free disk space recovered")
+	}
+	return true
+}
+
+func (db *TSDB) pauseWritesAfterDiskFull(recovered any) {
+	if db.diskFullPaused.CompareAndSwap(false, true) {
+		log.Printf("NEZHA>> TSDB disk is full; disabling TSDB writes until dashboard restart while keeping dashboard, queries, and alerts running: %v", recovered)
+	}
+}
+
+func (db *TSDB) addRowsSafely(rows []storage.MetricRow) {
+	if len(rows) == 0 || !db.acceptsWrites() {
+		return
+	}
+
+	defer func() {
+		if recovered := recover(); recovered != nil {
+			if diskFullPanicError(recovered) == nil {
+				panic(recovered)
+			}
+			db.pauseWritesAfterDiskFull(recovered)
+		}
+	}()
+	db.addRowsFn(rows, 64)
+}
+
+func (db *TSDB) debugFlushSafely() {
+	if !db.acceptsWrites() {
+		return
+	}
+
+	defer func() {
+		if recovered := recover(); recovered != nil {
+			if diskFullPanicError(recovered) == nil {
+				panic(recovered)
+			}
+			db.pauseWritesAfterDiskFull(recovered)
+		}
+	}()
+	db.debugFlushFn()
+}
+
 // Close 关闭 TSDB 存储
 func (db *TSDB) Close() error {
 	db.mu.Lock()
@@ 
```

**File**: `pkg/tsdb/writer.go` (modified, +17/-6)
```diff
@@ -47,18 +47,29 @@ func (w *bufferedWriter) flushLoop() {
 }
 
 func (w *bufferedWriter) write(rows []storage.MetricRow) {
+	if !w.db.acceptsWrites() {
+		w.discard()
+		return
+	}
+
 	w.mu.Lock()
 	w.buffer = append(w.buffer, rows...)
 	if len(w.buffer) >= w.maxSize {
 		rows := w.buffer
 		w.buffer = make([]storage.MetricRow, 0, w.maxSize)
 		w.mu.Unlock()
-		w.db.storage.AddRows(rows, 64)
+		w.db.addRowsSafely(rows)
 		return
 	}
 	w.mu.Unlock()
 }
 
+func (w *bufferedWriter) discard() {
+	w.mu.Lock()
+	w.buffer = make([]storage.MetricRow, 0, w.maxSize)
+	w.mu.Unlock()
+}
+
 func (w *bufferedWriter) flush() {
 	w.mu.Lock()
 	if len(w.buffer) == 0 {
@@ -69,7 +80,7 @@ func (w *bufferedWriter) flush() {
 	w.buffer = make([]storage.MetricRow, 0, w.maxSize)
 	w.mu.Unlock()
 
-	w.db.storage.AddRows(rows, 64)
+	w.db.addRowsSafely(rows)
 }
 
 func (w *bufferedWriter) stop() {
@@ -171,7 +182,7 @@ func (db *TSDB) WriteServerMetrics(m *ServerMetrics) error {
 	if db.writer != nil {
 		db.writer.write(rows)
 	} else {
-		db.storage.AddRows(rows, 64)
+		db.addRowsSafely(rows)
 	}
 	return nil
 }
@@ -200,7 +211,7 @@ func (db *TSDB) WriteServiceMetrics(m *ServiceMetrics) error {
 	if db.writer != nil {
 		db.writer.write(rows)
 	} else {
-		db.storage.AddRows(rows, 64)
+		db.addRowsSafely(rows)
 	}
 	return nil
 }
@@ -265,7 +276,7 @@ func (db *TSDB) WriteBatchServerMetrics(metrics []*ServerMetrics) error {
 	if db.writer != nil {
 		db.writer.write(rows)
 	} else {
-		db.storage.AddRows(rows, 64)
+		db.addRowsSafely(rows)
 	}
 	return nil
 }
@@ -295,7 +306,7 @@ func (db *TSDB) WriteBatchServiceMetrics(metrics []*ServiceMetrics) error {
 	if db.writer != nil {
 		db.writer.write(rows)
 	} else {
-		db.storage.AddRows(rows, 64)
+		db.addRowsSafely(rows)
 	}
 	return nil
 }
```

**File**: `service/singleton/tsdb.go` (modified, +15/-2)
```diff
@@ -1,6 +1,7 @@
 package singleton
 
 import (
+	"errors"
 	"log"
 	"time"
 
@@ -10,6 +11,8 @@ import (
 
 var TSDBShared *tsdb.TSDB
 
+var openTSDB = tsdb.Open
+
 func InitTSDB() error {
 	config := &tsdb.Config{
 		RetentionDays:      30,
@@ -44,11 +47,21 @@ func InitTSDB() error {
 		return nil
 	}
 
-	var err error
-	TSDBShared, err = tsdb.Open(config)
+	TSDBShared = nil
+	db, err := openTSDB(config)
 	if err != nil {
+		if errors.Is(err, tsdb.ErrDiskFull) {
+			log.Printf("NEZHA>> Warning: TSDB is unavailable because its disk is full; dashboard and alerts will continue without TSDB writes: %v", err)
+			if DB != nil {
+				if migrateErr := DB.AutoMigrate(model.ServiceHistory{}); migrateErr != nil {
+					log.Printf("NEZHA>> Warning: failed to prepare SQLite service history fallback: %v", migrateErr)
+				}
+			}
+			return nil
+		}
 		return err
 	}
+	TSDBShared = db
 
 	log.Println("NEZHA>> TSDB initialized successfully")
 
```

---

### Incident Patch 3: `f3666777` (2026-09-12)
**Commit Message**: feat: surface GPU memory in host state (#1235)

- Add State_GPU message to the proto with utilization and memory fields
- Add HostState.GPUs with conversion in both PB() and PB2State()
- Keep the existing gpu field populated so older agents keep working

Regenerated with protoc-gen-go v1.34.2 / protoc v5.29.3 to match the
existing files; nezha_grpc.pb.go is untouched since the service is
unchanged.

Closes #1217

**File**: `model/host.go` (modified, +30/-0)
```diff
@@ -35,9 +35,28 @@ type HostState struct {
 	ProcessCount   uint64              `json:"process_count,omitempty"`
 	Temperatures   []SensorTemperature `json:"temperatures,omitempty"`
 	GPU            []float64           `json:"gpu,omitempty"`
+	GPUs           []GPUStat           `json:"gpus,omitempty"`
+}
+
+// GPUStat carries per-card figures, index-aligned with Host.GPU. Memory is in
+// MiB and stays zero for vendors that do not report it, so MemoryTotal == 0
+// means "unknown" rather than "no memory".
+type GPUStat struct {
+	Utilization float64 `json:"utilization"`
+	MemoryUsed  uint64  `json:"memory_used,omitempty"`
+	MemoryTotal uint64  `json:"memory_total,omitempty"`
 }
 
 func (s *HostState) PB() *pb.State {
+	gs := make([]*pb.State_GPU, 0, len(s.GPUs))
+	for _, g := range s.GPUs {
+		gs = append(gs, &pb.State_GPU{
+			Utilization: g.Utilization,
+			MemoryUsed:  g.MemoryUsed,
+			MemoryTotal: g.MemoryTotal,
+		})
+	}
+
 	var ts []*pb.State_SensorTemperature
 	for _, t := range s.Temperatures {
 		ts = append(ts, &pb.State_SensorTemperature{
@@ -64,10 +83,20 @@ func (s *HostState) PB() *pb.State {
 		ProcessCount:   s.ProcessCount,
 		Temperatures:   ts,
 		Gpu:            s.GPU,
+		Gpus:           gs,
 	}
 }
 
 func PB2State(s *pb.State) HostState {
+	var gs []GPUStat
+	for _, g := range s.GetGpus() {
+		gs = append(gs, GPUStat{
+			Utilization: g.GetUtilization(),
+			MemoryUsed:  g.GetMemoryUsed(),
+			MemoryTotal: g.GetMemoryTotal(),
+		})
+	}
+
 	var ts []SensorTemperature
 	for _, t := range s.GetTemperatures() {
 		ts = append(ts, SensorTemperature{
@@ -93,6 +122,7 @@ func PB2State(s *pb.State) HostState {
 		UdpConnCount:   s.GetUdpConnCount(),
 		ProcessCount:   s.GetProcessCount(),
 		Temperatures:   ts,
+		GPUs:           gs,
 		GPU:            s.GetGpu(),
 	}
 }
```

**File**: `proto/nezha.pb.go` (modified, +216/-119)
```diff
@@ -169,6 +169,7 @@ type State struct {
 	ProcessCount   uint64                     `protobuf:"varint,15,opt,name=process_count,json=processCount,proto3" json:"process_count,omitempty"`
 	Temperatures   []*State_SensorTemperature `protobuf:"bytes,16,rep,name=temperatures,proto3" json:"temperatures,omitempty"`
 	Gpu            []float64                  `protobuf:"fixed64,17,rep,packed,name=gpu,proto3" json:"gpu,omitempty"`
+	Gpus           []*State_GPU               `protobuf:"bytes,18,rep,name=gpus,proto3" json:"gpus,omitempty"`
 }
 
 func (x *State) Reset() {
@@ -322,6 +323,79 @@ func (x *State) GetGpu() []float64 {
 	return nil
 }
 
+func (x *State) GetGpus() []*State_GPU {
+	if x != nil {
+		return x.Gpus
+	}
+	return nil
+}
+
+// State_GPU carries per-card figures. Index-aligned with Host.gpu, matching
+// the existing `gpu` field it supersedes; that field stays populated so older
+// dashboards keep working.
+type State_GPU struct {
+	state         protoimpl.MessageState
+	sizeCache     protoimpl.SizeCache
+	unknownFields protoimpl.UnknownFields
+
+	Utilization float64 `protobuf:"fixed64,1,opt,name=utilization,proto3" json:"utilization,omitempty"`
+	MemoryUsed  uint64  `protobuf:"varint,2,opt,name=memory_used,json=memoryUsed,proto3" json:"memory_used,omitempty"`
+	MemoryTotal uint64  `protobuf:"varint,3,opt,name=memory_total,json=memoryTotal,proto3" json:"memory_total,omitempty"`
+}
+
+func (x *State_GPU) Reset() {
+	*x = State_GPU{}
+	if protoimpl.UnsafeEnabled {
+		mi := &file_proto_nezha_proto_msgTypes[2]
+		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+		ms.StoreMessageInfo(mi)
+	}
+}
+
+func (x *State_GPU) String() string {
+	return protoimpl.X.MessageStringOf(x)
+}
+
+func (*State_GPU) ProtoMessage() {}
+
+func (x *State_GPU) ProtoReflect() protoreflect.Message {
+	mi := &file_proto_nezha_proto_msgTypes[2]
+	if protoimpl.UnsafeEnabled && x != nil {
+		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+		if ms.LoadMessageInfo() == nil {
+			ms.StoreMessageInfo(mi)
+		}
+		return ms
+	}
+	return mi.MessageOf(x)
+}
+
+// Deprecated: Use State_GPU.ProtoReflect.Descriptor instead.
+func (*State_GPU) Descriptor() ([]byte, []int) {
+	return file_proto_nezha_proto_rawDescGZIP(), []int{2}
+}
+
+func (x *State_GPU) GetUtilization() float64 {
+	if x != nil {
+		return x.Utilization
+	}
+	return 0
+}
+
+func (x *State_GPU) GetMemoryUsed() uint64 {
+	if x != nil {
+		return x.MemoryUsed
+	}
+	return 0
+}
+
+func (x *State_GPU) GetMemoryTotal() uint64 {
+	if x != nil {
+		return x.MemoryTotal
+	}
+	return 0
+}
+
 type State_SensorTemperature struct {
 	state         protoimpl.MessageState
 	sizeCache     protoimpl.SizeCache
@@ -334,7 +408,7 @@ type State_SensorTemperature struct {
 func (x *State_SensorTemperature) Reset() {
 	*x = State_SensorTemperature{}
 	if protoimpl.UnsafeEnabled {
-		mi := &file_proto_nezha_proto_msgTypes[2]
+		mi := &file_proto_nezha_proto_msgTypes[3]
 		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
 		ms.StoreMessageInfo(mi)
 	}
@@ -347,7 +421,7 @@ func (x *State_SensorTemperature) String() string {
 func (*State_SensorTemperature) ProtoMessage() {}
 
 func (x *State_SensorTemperature) ProtoReflect() protoreflect.Message {
-	mi := &file_proto_nezha_proto_msgTypes[2]
+	mi := &file_proto_nezha_proto_msgTypes[3]
 	if protoimpl.UnsafeEnabled && x != nil {
 		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
 		if ms.LoadMessageInfo() == nil {
@@ -360,7 +434,7 @@ func (x *State_SensorTemperature) ProtoReflect() protoreflect.Message {
 
 // Deprecated: Use State_SensorTemperature.ProtoReflect.Descriptor instead.
 func (*State_SensorTemperature) Descriptor() ([]byte, []int) {
-	return file_proto_nezha_proto_rawDescGZIP(), []int{2}
+	return file_proto_nezha_proto_rawDescGZIP(), []int{3}
 }
 
 func (x *State_SensorTemperature) GetName() string {
@@ -390,7 +464,7 @@ type Task struct {
 func (x *Task) Reset() {
 	*x = Task{}
 	if protoimpl.UnsafeEnabled {
-		mi := &file_proto_nezha_pro
```

**File**: `proto/nezha.proto` (modified, +10/-0)
```diff
@@ -44,6 +44,16 @@ message State {
   uint64 process_count = 15;
   repeated State_SensorTemperature temperatures = 16;
   repeated double gpu = 17;
+  repeated State_GPU gpus = 18;
+}
+
+// State_GPU carries per-card figures. Index-aligned with Host.gpu, matching
+// the existing `gpu` field it supersedes; that field stays populated so older
+// dashboards keep working.
+message State_GPU {
+  double utilization = 1;
+  uint64 memory_used = 2;
+  uint64 memory_total = 3;
 }
 
 message State_SensorTemperature {
```

---

### Incident Patch 4: `19daf4ad` (2026-09-02)
**Commit Message**: fix(alert): prevent persisted rule crash loops

**File**: `cmd/dashboard/controller/alertrule.go` (modified, +12/-0)
```diff
@@ -172,6 +172,12 @@ func validateRule(c *gin.Context, r *model.AlertRule) error {
 	}
 	if len(r.Rules) > 0 {
 		for _, rule := range r.Rules {
+			if rule == nil {
+				return singleton.Localizer.ErrorT("rule is not set")
+			}
+			if !rule.IsSupportedType() {
+				return singleton.Localizer.ErrorT("unsupported rule type")
+			}
 			switch rule.Cover {
 			case model.RuleCoverAll, model.RuleCoverIgnoreAll:
 			default:
@@ -182,10 +188,16 @@ func validateRule(c *gin.Context, r *model.AlertRule) error {
 				if rule.Duration < 3 {
 					return singleton.Localizer.ErrorT("duration need to be at least 3")
 				}
+				if rule.Duration > model.MaxAlertRuleDuration {
+					return singleton.Localizer.ErrorT("duration is too large")
+				}
 			} else {
 				if rule.CycleInterval < 1 {
 					return singleton.Localizer.ErrorT("cycle_interval need to be at least 1")
 				}
+				if rule.CycleInterval > model.MaxAlertRuleCycleInterval {
+					return singleton.Localizer.ErrorT("cycle_interval is too large")
+				}
 				if rule.CycleStart == nil {
 					return singleton.Localizer.ErrorT("cycle_start is not set")
 				}
```

**File**: `cmd/dashboard/controller/alertrule_security_test.go` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+package controller
+
+import (
+	"math"
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/nezhahq/nezha/model"
+)
+
+func TestValidateRuleRejectsCrashPayloadsFromMember(t *testing.T) {
+	ctx := newMemberValidationContext(t)
+	cycleStart := time.Now().Add(-time.Hour)
+	tests := []struct {
+		name string
+		rule *model.Rule
+	}{
+		{
+			name: "unknown rule type",
+			rule: &model.Rule{Type: "attacker_controlled", Duration: 3, Cover: model.RuleCoverAll},
+		},
+		{
+			name: "duration overflows int",
+			rule: &model.Rule{Type: "offline", Duration: math.MaxUint64, Cover: model.RuleCoverAll},
+		},
+		{
+			name: "cycle interval overflows int",
+			rule: &model.Rule{
+				Type:          "transfer_in_cycle",
+				CycleStart:    &cycleStart,
+				CycleInterval: math.MaxUint64,
+				Cover:         model.RuleCoverAll,
+			},
+		},
+		{
+			name: "nil rule",
+			rule: nil,
+		},
+	}
+
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			alert := &model.AlertRule{
+				Common: model.Common{UserID: 200},
+				Name:   "security regression",
+				Rules:  []*model.Rule{test.rule},
+			}
+			require.Error(t, validateRule(ctx, alert))
+		})
+	}
+}
+
+func TestValidateRuleAcceptsSafeDurationBoundary(t *testing.T) {
+	ctx := newMemberValidationContext(t)
+	alert := &model.AlertRule{
+		Common: model.Common{UserID: 200},
+		Name:   "duration boundary",
+		Rules: []*model.Rule{{
+			Type:     "offline",
+			Duration: model.MaxAlertRuleDuration,
+			Cover:    model.RuleCoverAll,
+		}},
+	}
+	require.NoError(t, validateRule(ctx, alert))
+}
```

**File**: `model/alertrule.go` (modified, +66/-13)
```diff
@@ -64,6 +64,36 @@ func (r *AlertRule) Enabled() bool {
 	return r.Enable != nil && *r.Enable
 }
 
+// IsSafeToEvaluate validates persisted rule data before it reaches the alert
+// goroutine. API validation protects new writes; this second boundary protects
+// upgrades from malformed or deliberately poisoned rows already in the DB.
+func (r *AlertRule) IsSafeToEvaluate() bool {
+	if r == nil || len(r.Rules) == 0 {
+		return false
+	}
+	for _, rule := range r.Rules {
+		if rule == nil || !rule.IsSupportedType() {
+			return false
+		}
+		switch rule.Cover {
+		case RuleCoverAll, RuleCoverIgnoreAll:
+		default:
+			return false
+		}
+		if rule.IsTransferDurationRule() {
+			if !rule.HasSafeCycleConfiguration() {
+				return false
+			}
+			continue
+		}
+		duration, ok := rule.DurationInt()
+		if !ok || duration < 3 {
+			return false
+		}
+	}
+	return true
+}
+
 // HasPermission extends the default owner/admin check with PAT
 // server_ids whitelist enforcement. AlertRule.Snapshot fans out across
 // every owner-visible server filtered only by Rule.Ignore semantics
@@ -125,6 +155,12 @@ func (r *AlertRule) Snapshot(cycleTransferStats *CycleTransferStats, server *Ser
 	point := make([]bool, len(r.Rules))
 
 	for i, rule := range r.Rules {
+		if rule == nil || !rule.IsSupportedType() {
+			// Invalid persisted rules are ignored instead of being interpreted as
+			// a failed condition or allowed to panic the sentinel.
+			point[i] = true
+			continue
+		}
 		point[i] = rule.Snapshot(cycleTransferStats, server, db)
 	}
 	return point
@@ -134,10 +170,14 @@ func (r *AlertRule) Snapshot(cycleTransferStats *CycleTransferStats, server *Ser
 func (r *AlertRule) Check(points [][]bool) (int, bool) {
 	var hasPassedRule bool
 	durations := make([]int, len(r.Rules))
+	validRules := 0
 
 	for ruleIndex, rule := range r.Rules {
-		duration := int(rule.Duration)
+		if rule == nil || !rule.IsSupportedType() {
+			continue
+		}
 		if rule.IsTransferDurationRule() {
+			validRules++
 			// 循环区间流量报警
 			if durations[ruleIndex] < 1 {
 				durations[ruleIndex] = 1
@@ -146,18 +186,29 @@ func (r *AlertRule) Check(points [][]bool) (int, bool) {
 				continue
 			}
 			// 只要最后一次检查超出了规则范围 就认为检查未通过
-			if len(points) > 0 && points[len(points)-1][ruleIndex] {
-				hasPassedRule = true
+			if len(points) > 0 {
+				lastPoint := points[len(points)-1]
+				if ruleIndex >= len(lastPoint) || lastPoint[ruleIndex] {
+					hasPassedRule = true
+				}
 			}
-		} else if rule.IsOfflineRule() {
+			continue
+		}
+
+		duration, ok := rule.DurationInt()
+		if !ok || duration <= 0 {
+			continue
+		}
+		validRules++
+		if rule.IsOfflineRule() {
 			// 离线报警，检查直到最后一次在线的离线采样点是否大于 duration
 			if hasPassedRule = boundCheck(len(points), duration, hasPassedRule); hasPassedRule {
 				continue
 			}
 			var fail int
 			for _, point := range slices.Backward(points[len(points)-duration:]) {
 				fail++
-				if point[ruleIndex] {
+				if ruleIndex >= len(point) || point[ruleIndex] {
 					hasPassedRule = true
 					break
 				}
@@ -168,11 +219,7 @@ func (r *AlertRule) Check(points [][]bool) (int, bool) {
 			// 常规报警
 			// duration<=0 是无意义的规则（持续 0 秒）：直接跳过该规则，
 			// 既不污染 hasPassedRule（否则会连带跳过同一 alert 里其它有效
-			// 规则），也避免下方 fail*100/total 在 total=0 时整数除零 panic
-			// —— checkStatus 无 recover，一次 panic 会拖垮整个告警 goroutine。
-			if duration <= 0 {
-				continue
-			}
+			// 规则），也避免下方百分比计算在 total=0 时除零。
 			if hasPassedRule = boundCheck(len(points), duration, hasPassedRule); hasPassedRule {
 				continue
 			}
@@ -181,17 +228,20 @@ func (r *AlertRule) Check(points [][]bool) (int, bool) {
 			}
 			total, fail := duration, 0
 			for timeTick := len(points) - duration; timeTick < len(points); timeTick++ {
-				if !points[timeTick][ruleIndex] {
+				if ruleIndex >= len(points[timeTick]) || !points[timeTick][ruleIndex] {
 					fail++
 				}
 			}
 			// 当70%以上的采样点未通过规则判断时 才认为当前检查未通过
-			if fail*100/total <= 70 {
+			if float64(fail)*100/float64(total) <= 70 {
 				hasPassedRule = true
 			
```

**File**: `model/alertrule_security_test.go` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+package model
+
+import (
+	"math"
+	"testing"
+	"time"
+)
+
+func TestRuleSnapshotIgnoresEmptyMetricSamples(t *testing.T) {
+	tests := []struct {
+		name      string
+		ruleType  string
+		hostState *HostState
+	}{
+		{
+			name:      "GPU list is empty",
+			ruleType:  "gpu_max",
+			hostState: &HostState{},
+		},
+		{
+			name:     "all temperature samples are filtered",
+			ruleType: "temperature_max",
+			hostState: &HostState{Temperatures: []SensorTemperature{
+				{Name: "coretemp", Temperature: 0},
+			}},
+		},
+	}
+
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			server := &Server{Common: Common{ID: 1}, State: test.hostState, Host: &Host{}}
+			rule := &Rule{Type: test.ruleType, Max: 1, Duration: 3, Cover: RuleCoverAll}
+
+			defer func() {
+				if recovered := recover(); recovered != nil {
+					t.Fatalf("Snapshot panicked for missing metric data: %v", recovered)
+				}
+			}()
+			if passed := rule.Snapshot(nil, server, nil); !passed {
+				t.Fatal("missing metric data must be ignored instead of treated as a failed threshold")
+			}
+		})
+	}
+}
+
+func TestAlertRuleCheckRejectsOverflowingPersistedDuration(t *testing.T) {
+	rule := &AlertRule{Rules: []*Rule{{
+		Type:     "offline",
+		Duration: math.MaxUint64,
+		Cover:    RuleCoverAll,
+	}}}
+
+	defer func() {
+		if recovered := recover(); recovered != nil {
+			t.Fatalf("Check panicked after uint64-to-int overflow: %v", recovered)
+		}
+	}()
+	duration, passed := rule.Check([][]bool{{false}})
+	if duration != 0 || !passed {
+		t.Fatalf("invalid persisted duration must be ignored safely, got duration=%d passed=%v", duration, passed)
+	}
+	if window := rule.RetentionWindow(); window != 0 {
+		t.Fatalf("invalid persisted duration must not create a retention window, got %d", window)
+	}
+}
+
+func TestAlertRulePersistedDataSafety(t *testing.T) {
+	cycleStart := time.Now().Add(-time.Hour)
+	tests := []struct {
+		name string
+		rule *AlertRule
+		want bool
+	}{
+		{
+			name: "normal rule",
+			rule: &AlertRule{Rules: []*Rule{{
+				Type: "cpu", Duration: 3, Cover: RuleCoverAll,
+			}}},
+			want: true,
+		},
+		{
+			name: "normal cycle rule",
+			rule: &AlertRule{Rules: []*Rule{{
+				Type: "transfer_in_cycle", CycleStart: &cycleStart, CycleInterval: 1, Cover: RuleCoverAll,
+			}}},
+			want: true,
+		},
+		{
+			name: "unknown type",
+			rule: &AlertRule{Rules: []*Rule{{
+				Type: "attacker_controlled", Duration: 3, Cover: RuleCoverAll,
+			}}},
+		},
+		{
+			name: "overflowing duration",
+			rule: &AlertRule{Rules: []*Rule{{
+				Type: "offline", Duration: math.MaxUint64, Cover: RuleCoverAll,
+			}}},
+		},
+		{
+			name: "cycle without start",
+			rule: &AlertRule{Rules: []*Rule{{
+				Type: "transfer_in_cycle", CycleInterval: 1, Cover: RuleCoverAll,
+			}}},
+		},
+		{
+			name: "nil rule",
+			rule: &AlertRule{Rules: []*Rule{nil}},
+		},
+		{
+			name: "empty rule list",
+			rule: &AlertRule{},
+		},
+	}
+
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			if got := test.rule.IsSafeToEvaluate(); got != test.want {
+				t.Fatalf("IsSafeToEvaluate()=%v, want %v", got, test.want)
+			}
+		})
+	}
+}
```

**File**: `model/alertrule_test.go` (modified, +16/-4)
```diff
@@ -26,7 +26,7 @@ func testCycleRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
-						Type: "_cycle",
+						Type: "transfer_in_cycle",
 					},
 				},
 			},
@@ -39,7 +39,7 @@ func testCycleRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
-						Type: "_cycle",
+						Type: "transfer_in_cycle",
 					},
 				},
 			},
@@ -130,6 +130,7 @@ func testGeneralRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 				},
@@ -143,6 +144,7 @@ func testGeneralRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 				},
@@ -156,6 +158,7 @@ func testGeneralRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 				},
@@ -169,6 +172,7 @@ func testGeneralRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 				},
@@ -182,6 +186,7 @@ func testGeneralRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 				},
@@ -210,6 +215,7 @@ func testCombinedRules(t *testing.T) {
 						Duration: 10,
 					},
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 				},
@@ -227,6 +233,7 @@ func testCombinedRules(t *testing.T) {
 						Duration: 10,
 					},
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 				},
@@ -240,6 +247,7 @@ func testCombinedRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 					{
@@ -257,9 +265,11 @@ func testCombinedRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 					{
+						Type:     "memory",
 						Duration: 30,
 					},
 				},
@@ -273,9 +283,11 @@ func testCombinedRules(t *testing.T) {
 			rule: &AlertRule{
 				Rules: []*Rule{
 					{
+						Type:     "cpu",
 						Duration: 10,
 					},
 					{
+						Type:     "memory",
 						Duration: 30,
 					},
 				},
@@ -416,7 +428,7 @@ func TestAlertRule_RetentionWindow(t *testing.T) {
 		{"zero duration only", &AlertRule{Rules: []*Rule{{Type: "cpu", Duration: 0}}}, 0},
 		{"mixed picks max", &AlertRule{Rules: []*Rule{{Type: "cpu", Duration: 0}, {Type: "cpu", Duration: 7}}}, 7},
 		{"offline keeps Duration", &AlertRule{Rules: []*Rule{{Type: "offline", Duration: 30}}}, 30},
-		{"cycle looks back one", &AlertRule{Rules: []*Rule{{Type: "net_in_speed_cycle"}}}, 1},
+		{"cycle looks back one", &AlertRule{Rules: []*Rule{{Type: "transfer_in_cycle"}}}, 1},
 	}
 	for _, c := range cases {
 		if got := c.rule.RetentionWindow(); got != c.want {
@@ -469,7 +481,7 @@ func TestAlertRule_CombinedRuleAccumulatesSamples(t *testing.T) {
 	}{
 		{"general3+general10", &AlertRule{Rules: []*Rule{{Type: "cpu", Duration: 3}, {Type: "memory", Duration: 10}}}, []bool{false, false}, 9, 10},
 		{"offline5+general10", &AlertRule{Rules: []*Rule{{Type: "offline", Duration: 5}, {Type: "cpu", Duration: 10}}}, []bool{false, false}, 9, 10},
-		{"transfer+general8", &AlertRule{Rules: []*Rule{{Type: "net_in_speed_cycle"}, {Type: "cpu", Duration: 8}}}, []bool{false, false}, 7, 8},
+		{"transfer+general8", &AlertRule{Rules: []*Rule{{Type: "transfer_in_cycle"}, {Type: "cpu", Duration: 8}}}, []bool{false, false}, 7, 8},
 		{"offline3+offline12", &AlertRule{Rules: []*Rule{{Type: "offline", Duration: 3}, {Type: "offline", Duration: 12}}}, []bool{false, false}, 11, 12},
 	}
 	for _, c := range cases {
```

---

### Incident Patch 5: `38824dbc` (2026-08-15)
**Commit Message**: fix(security): restrict service monitors to probe tasks

**File**: `cmd/dashboard/controller/oauth2.go` (modified, +5/-2)
```diff
@@ -26,8 +26,11 @@ import (
 // code to their own origin and bind the victim's identity. A request Host is
 // trusted only when it is an operator-declared dashboard host (the same
 // allowlist that guards NAT routing). Otherwise the redirect is pinned to the
-// operator-declared DashboardHost; when DashboardHost is empty the operator has
-// not pinned a dashboard origin, so the request Host is passed through.
+// operator-declared DashboardHost. Empty DashboardHost intentionally retains
+// dynamic/multi-domain deployments by passing through request Host; those
+// deployments must validate Host at their trusted proxy and register exact
+// redirect URIs at the OAuth provider. GHSA-rf68-8gjr-36q7 documents this
+// configuration boundary and must be updated if this compatibility changes.
 func getRedirectURL(c *gin.Context) string {
 	scheme := "http://"
 	referer := c.Request.Referer()
```

**File**: `cmd/dashboard/controller/permission_matrix_test.go` (modified, +2/-2)
```diff
@@ -261,8 +261,8 @@ func TestShowServiceFiltersCycleTransferStatsLikeServerList(t *testing.T) {
 	assert.NoError(t, singleton.DB.Create(&model.Server{Common: model.Common{ID: 3, UserID: 200}, Name: "hidden member server", UUID: "hidden-member-server", HideForGuest: true}).Error)
 	singleton.ServerShared = singleton.NewServerClass()
 
-	assert.NoError(t, singleton.DB.Create(&model.Service{Common: model.Common{ID: 10, UserID: 1}, Name: "shown service"}).Error)
-	assert.NoError(t, singleton.DB.Create(&model.Service{Common: model.Common{ID: 11, UserID: 1}, Name: "hidden service", HideForGuest: true}).Error)
+	assert.NoError(t, singleton.DB.Create(&model.Service{Common: model.Common{ID: 10, UserID: 1}, Name: "shown service", Type: model.TaskTypeTCPPing}).Error)
+	assert.NoError(t, singleton.DB.Create(&model.Service{Common: model.Common{ID: 11, UserID: 1}, Name: "hidden service", Type: model.TaskTypeTCPPing, HideForGuest: true}).Error)
 
 	originalServiceSentinel := singleton.ServiceSentinelShared
 	serviceSentinel, err := singleton.NewServiceSentinel(make(chan *model.Service, 2))
```

**File**: `cmd/dashboard/controller/service.go` (modified, +6/-0)
```diff
@@ -484,6 +484,9 @@ func createService(c *gin.Context) (uint64, error) {
 	if err := c.ShouldBindJSON(&mf); err != nil {
 		return 0, err
 	}
+	if err := model.ValidateServiceMonitorType(uint64(mf.Type)); err != nil {
+		return 0, err
+	}
 
 	if !isValidServiceCover(mf.Cover) {
 		return 0, singleton.Localizer.ErrorT("permission denied")
@@ -548,6 +551,9 @@ func updateService(c *gin.Context) (any, error) {
 	if err := c.ShouldBindJSON(&mf); err != nil {
 		return nil, err
 	}
+	if err := model.ValidateServiceMonitorType(uint64(mf.Type)); err != nil {
+		return nil, err
+	}
 
 	if !isValidServiceCover(mf.Cover) {
 		return nil, singleton.Localizer.ErrorT("permission denied")
```

**File**: `cmd/dashboard/controller/service_type_security_test.go` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+package controller
+
+import (
+	"bytes"
+	"encoding/json"
+	"fmt"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+
+	"github.com/gin-gonic/gin"
+	"github.com/stretchr/testify/require"
+
+	"github.com/nezhahq/nezha/model"
+	"github.com/nezhahq/nezha/service/singleton"
+)
+
+func serviceTypeSecurityRouter() *gin.Engine {
+	gin.SetMode(gin.TestMode)
+	r := gin.New()
+	r.Use(func(c *gin.Context) {
+		setAuthUser(c, 100, model.RoleMember)
+		c.Next()
+	})
+	r.POST("/api/v1/service", commonHandler(createService))
+	r.PATCH("/api/v1/service/:id", commonHandler(updateService))
+	return r
+}
+
+func serviceTypeSecurityBody(taskType uint8) []byte {
+	body, _ := json.Marshal(model.ServiceForm{
+		Name:        "service-type-security",
+		Target:      "example.invalid:443",
+		Type:        taskType,
+		Cover:       model.ServiceCoverIgnoreAll,
+		SkipServers: map[uint64]bool{1: true},
+		Duration:    30,
+	})
+	return body
+}
+
+func TestCreateServiceRejectsNonProbeTaskTypes(t *testing.T) {
+	setupCoverPATFixture(t)
+	r := serviceTypeSecurityRouter()
+
+	for _, taskType := range []uint8{0, model.TaskTypeCommand, model.TaskTypeApplyConfig, model.TaskTypeExec, 255} {
+		w := httptest.NewRecorder()
+		req := httptest.NewRequest(http.MethodPost, "/api/v1/service", bytes.NewReader(serviceTypeSecurityBody(taskType)))
+		req.Header.Set("Content-Type", "application/json")
+		r.ServeHTTP(w, req)
+
+		success, errMsg := decodeCommonResponseError(t, w.Body.Bytes())
+		require.False(t, success, "type %d must be rejected", taskType)
+		require.Contains(t, errMsg, "invalid service monitor type")
+	}
+
+	var count int64
+	require.NoError(t, singleton.DB.Model(&model.Service{}).Count(&count).Error)
+	require.Zero(t, count, "rejected task types must not reach persistence")
+}
+
+func TestUpdateServiceRejectsNonProbeTaskTypes(t *testing.T) {
+	setupCoverPATFixture(t)
+	r := serviceTypeSecurityRouter()
+	service := &model.Service{
+		Common:      model.Common{UserID: 100},
+		Name:        "valid-service",
+		Target:      "example.invalid:443",
+		Type:        model.TaskTypeTCPPing,
+		Cover:       model.ServiceCoverIgnoreAll,
+		SkipServers: map[uint64]bool{1: true},
+		Duration:    30,
+	}
+	require.NoError(t, singleton.DB.Create(service).Error)
+
+	for _, taskType := range []uint8{model.TaskTypeCommand, model.TaskTypeApplyConfig, model.TaskTypeExec, 255} {
+		w := httptest.NewRecorder()
+		path := fmt.Sprintf("/api/v1/service/%d", service.ID)
+		req := httptest.NewRequest(http.MethodPatch, path, bytes.NewReader(serviceTypeSecurityBody(taskType)))
+		req.Header.Set("Content-Type", "application/json")
+		r.ServeHTTP(w, req)
+
+		success, errMsg := decodeCommonResponseError(t, w.Body.Bytes())
+		require.False(t, success, "type %d must be rejected", taskType)
+		require.Contains(t, errMsg, "invalid service monitor type")
+
+		var persisted model.Service
+		require.NoError(t, singleton.DB.First(&persisted, service.ID).Error)
+		require.Equal(t, uint8(model.TaskTypeTCPPing), persisted.Type)
+	}
+}
```

**File**: `cmd/dashboard/main.go` (modified, +6/-0)
```diff
@@ -46,6 +46,12 @@ func initSystem(bus chan<- *model.Service) error {
 	if err := singleton.DB.Model(&model.User{}).Count(&usersCount).Error; err != nil {
 		return err
 	}
+	// Backward-compatible bootstrap state: existing installers and recovery
+	// procedures expect the first login on an empty database to be admin/admin.
+	// This is not a permanent credential or an authentication-bypass fallback;
+	// operators must complete initialization and change it before exposing the
+	// Dashboard. Replacing it requires a coordinated installer/migration flow so
+	// existing unattended installations are not locked out.
 	if usersCount == 0 {
 		hash, err := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
 		if err != nil {
```

---

### Incident Patch 6: `c3c165c1` (2026-08-12)
**Commit Message**: fix(terminal): bound websocket input frames

**File**: `cmd/dashboard/controller/terminal.go` (modified, +6/-0)
```diff
@@ -14,6 +14,11 @@ import (
 	"github.com/nezhahq/nezha/service/singleton"
 )
 
+// Allow the frontend's 512 KiB clipboard payload plus xterm's bracketed-paste
+// control bytes, while keeping the complete tagged message below the 1 MiB
+// IO stream relay buffer.
+const terminalWebSocketInputLimit int64 = 512*1024 + 64
+
 // Create web ssh terminal
 // @Summary Create web ssh terminal
 // @Description Create web ssh terminal
@@ -100,6 +105,7 @@ func terminalStream(c *gin.Context) (any, error) {
 	if err != nil {
 		return nil, newWsError("%v", err)
 	}
+	wsConn.SetReadLimit(terminalWebSocketInputLimit)
 	conn := websocketx.NewConn(wsConn)
 	pingTransport := newWebsocketPingTransport(conn, wsConn.Close)
 	stopPing := startWebsocketPingTicker(c.Request.Context(), time.Second*10, pingTransport)
```

**File**: `cmd/dashboard/controller/terminal_input_limit_test.go` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+package controller
+
+import "testing"
+
+func TestTerminalWebSocketInputLimitAllowsBoundedPaste(t *testing.T) {
+	if terminalWebSocketInputLimit != 512*1024+64 {
+		t.Fatalf("terminal WebSocket input limit = %d, want 512 KiB plus control-byte allowance", terminalWebSocketInputLimit)
+	}
+}
```

**File**: `service/singleton/frontend-templates.yaml` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
   name: "OfficialAdmin"
   repository: "https://github.com/nezhahq/admin-frontend"
   author: "nezhahq"
-  version: "v2.3.2"
+  version: "v2.3.3"
   is_admin: true
   is_official: true
 - path: "user-dist"
```

---

### Incident Patch 7: `d1fcde8e` (2026-08-11)
**Commit Message**: fix(security): block IPv6 transition ranges for webhooks

**File**: `pkg/utils/http.go` (modified, +2/-0)
```diff
@@ -40,9 +40,11 @@ var blockedHTTPClientCIDRs = mustParseHTTPClientCIDRs([]string{
 	"::1/128",
 	"::ffff:0:0/96",
 	"64:ff9b::/96",
+	"64:ff9b:1::/48",
 	"100::/64",
 	"2001::/23",
 	"2001:db8::/32",
+	"2002::/16",
 	"fc00::/7",
 	"fe80::/10",
 	"ff00::/8",
```

**File**: `pkg/utils/http_test.go` (modified, +42/-0)
```diff
@@ -1,13 +1,55 @@
 package utils
 
 import (
+	"errors"
 	"net"
 	"net/http"
 	"net/url"
 	"testing"
 	"time"
 )
 
+func TestHTTPURLTargetIPAllowed(t *testing.T) {
+	tests := []struct {
+		name    string
+		address string
+		allowed bool
+	}{
+		{name: "public IPv4", address: "1.1.1.1", allowed: true},
+		{name: "public IPv6", address: "2606:4700:4700::1111", allowed: true},
+		{name: "well-known NAT64", address: "64:ff9b::a9fe:a9fe", allowed: false},
+		{name: "local-use NAT64", address: "64:ff9b:1::a9fe:a9fe", allowed: false},
+		{name: "6to4 public IPv4 embedding", address: "2002:0101:0101::1", allowed: false},
+		{name: "6to4 link-local IPv4 embedding", address: "2002:a9fe:a9fe::1", allowed: false},
+	}
+
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			ip := net.ParseIP(test.address)
+			if ip == nil {
+				t.Fatalf("ParseIP(%q) returned nil", test.address)
+			}
+			if got := HTTPURLTargetIPAllowed(ip); got != test.allowed {
+				t.Fatalf("HTTPURLTargetIPAllowed(%q) = %t, want %t", test.address, got, test.allowed)
+			}
+		})
+	}
+}
+
+func TestResolveAllowedHTTPURLRejectsSpecialIPv6Literals(t *testing.T) {
+	for _, rawURL := range []string{
+		"http://[64:ff9b:1::a9fe:a9fe]/metadata",
+		"http://[2002:a9fe:a9fe::1]/metadata",
+	} {
+		t.Run(rawURL, func(t *testing.T) {
+			_, _, err := ResolveAllowedHTTPURL(rawURL)
+			if !errors.Is(err, ErrHTTPURLTargetNotAllowed) {
+				t.Fatalf("ResolveAllowedHTTPURL(%q) error = %v, want %v", rawURL, err, ErrHTTPURLTargetNotAllowed)
+			}
+		})
+	}
+}
+
 func TestBuildRestrictedHTTPClientPreservesHostnameAsTLSServerName(t *testing.T) {
 	// Construct a hostname URL paired with an arbitrary public IP so we exercise
 	// the SNI preservation path without depending on live DNS in unit tests.
```

---

### Incident Patch 8: `c6082abc` (2026-08-11)
**Commit Message**: fix: 修复空周期流量规则列表导致流量历史清理失效 (#1226)

* fix: prevent unbounded transfer history growth

* fix: preserve transfer history on alert load errors

* test: close transfer cleanup database

---------

Co-authored-by: naiba <hi@nai.ba>

**File**: `service/singleton/clean_monitor_history_test.go` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+package singleton
+
+import (
+	"path/filepath"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+	"gorm.io/gorm"
+
+	"github.com/nezhahq/nezha/model"
+)
+
+func setupCleanMonitorHistoryTestDB(t *testing.T) {
+	t.Helper()
+
+	previousDB := DB
+	var err error
+	DB, err = gorm.Open(openSQLiteDialector(filepath.Join(t.TempDir(), "dashboard.sqlite")), &gorm.Config{})
+	require.NoError(t, err)
+	sqlDB, err := DB.DB()
+	require.NoError(t, err)
+	t.Cleanup(func() {
+		DB = previousDB
+		if err := sqlDB.Close(); err != nil {
+			t.Errorf("close transfer cleanup test database: %v", err)
+		}
+	})
+
+	require.NoError(t, DB.AutoMigrate(&model.Server{}, &model.Transfer{}, &model.AlertRule{}))
+	require.NoError(t, DB.Exec("INSERT INTO servers (id, name, uuid) VALUES (1, 'server', 'clean-monitor-history-test')").Error)
+}
+
+func TestCleanMonitorHistoryWithoutRulesDeletesAllTransfers(t *testing.T) {
+	setupCleanMonitorHistoryTestDB(t)
+	require.NoError(t, DB.Create(&model.Transfer{ServerID: 1, In: 1}).Error)
+
+	CleanMonitorHistory()
+
+	var count int64
+	require.NoError(t, DB.Model(&model.Transfer{}).Count(&count).Error)
+	require.Zero(t, count)
+}
+
+func TestCleanMonitorHistoryPreservesTransfersWhenAlertRulesCannotBeLoaded(t *testing.T) {
+	setupCleanMonitorHistoryTestDB(t)
+	require.NoError(t, DB.Create(&model.Transfer{ServerID: 1, In: 1}).Error)
+	require.NoError(t, DB.Exec("INSERT INTO alert_rules (id, name, rules_raw, fail_trigger_tasks_raw, recover_trigger_tasks_raw) VALUES (1, 'broken', '{', '[]', '[]')").Error)
+
+	var alerts []model.AlertRule
+	require.Error(t, DB.Find(&alerts).Error, "precondition: malformed rules_raw must fail AlertRule.AfterFind")
+
+	CleanMonitorHistory()
+
+	var count int64
+	require.NoError(t, DB.Model(&model.Transfer{}).Count(&count).Error)
+	require.EqualValues(t, 1, count)
+}
```

**File**: `service/singleton/singleton.go` (modified, +12/-1)
```diff
@@ -160,7 +160,10 @@ func CleanMonitorHistory() {
 	specialServerKeep := make(map[uint64]time.Time)
 	var specialServerIDs []uint64
 	var alerts []model.AlertRule
-	DB.Find(&alerts)
+	if err := DB.Find(&alerts).Error; err != nil {
+		log.Printf("NEZHA>> Failed to load alert rules while cleaning transfer history: %v", err)
+		return
+	}
 	for _, alert := range alerts {
 		for _, rule := range alert.Rules {
 			// 是不是流量记录规则
@@ -188,6 +191,14 @@ func CleanMonitorHistory() {
 	for id, couldRemove := range specialServerKeep {
 		DB.Unscoped().Delete(&model.Transfer{}, "server_id = ? AND datetime(`created_at`) < datetime(?)", id, couldRemove)
 	}
+	if len(specialServerIDs) == 0 {
+		if allServerKeep.IsZero() {
+			DB.Unscoped().Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&model.Transfer{})
+		} else {
+			DB.Unscoped().Delete(&model.Transfer{}, "datetime(`created_at`) < datetime(?)", allServerKeep)
+		}
+		return
+	}
 	if allServerKeep.IsZero() {
 		DB.Unscoped().Delete(&model.Transfer{}, "server_id NOT IN (?)", specialServerIDs)
 	} else {
```

---

### Incident Patch 9: `71e2cbcf` (2026-08-07)
**Commit Message**: Fixes broken Star History chart

This new provider revives the OG service that's being killed by Github

**File**: `README.md` (modified, +1/-1)
```diff
@@ -117,4 +117,4 @@ add your theme to [service/singleton/frontend-templates.yaml](service/singleton/
 
 ## Star History
 
-[![Star History Chart](https://api.star-history.com/svg?repos=nezhahq/nezha&type=Timeline)](https://star-history.com/#nezhahq/nezha&Timeline)
+[![Star History Chart](https://star-history.dera.page/svg?repos=nezhahq/nezha&type=Timeline)](https://star-history.dera.page/#nezhahq/nezha&Timeline)
```

---

### Incident Patch 10: `6c5317ba` (2026-08-01)
**Commit Message**: fix(security): correct stream quota advisory reference

**File**: `cmd/dashboard/controller/terminal_fm_quota_test.go` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 package controller
 
-// TDD regression tests for GHSA-jx78-55p5-rwv5 (CVE-2026-53522):
+// TDD regression tests for GHSA-jg62-j5h6-8mpq (CVE-2026-53522):
 // Unbounded WebSocket Streams — Resource Exhaustion DoS.
 //
 // The vulnerability: POST /api/v1/terminal and POST /api/v1/file insert a new
@@ -51,7 +51,7 @@ func setupQuotaTest(t *testing.T) (cleanup func(), successStream *failingRequest
 
 // TestCreateTerminalEnforcesPerUserStreamQuota verifies that once a user has
 // reached the per-user stream cap, subsequent createTerminal calls are rejected
-// with ErrTooManyStreamsForUser. This directly tests the GHSA-jx78-55p5-rwv5
+// with ErrTooManyStreamsForUser. This directly tests the GHSA-jg62-j5h6-8mpq
 // fix at the HTTP handler layer.
 func TestCreateTerminalEnforcesPerUserStreamQuota(t *testing.T) {
 	cleanup, _ := setupQuotaTest(t)
```

#### Recent Merged Pull Requests:
- **PR #1238** (closed): Fixed: An issue where deleting DNS records for domains hosted on Cloudflare did not work. (@77-QiQi)
- **PR #1237** (2026-09-14): Improve: Delete the corresponding DNS record if the IPv4/IPv6 address is empty. (@77-QiQi)
- **PR #1236** (2026-09-12): feat(auth): allow JWT IP changes by configuration (@NikoCat233)
- **PR #1235** (2026-09-12): feat: surface GPU memory in host state (@ryrenz)
- **PR #1231** (2026-08-17): improve: ddns (@77-QiQi)
- **PR #1229** (closed): feat.主题强兼（强行兼容）komari (@preauthn1)
- **PR #1228** (2026-08-15): Translations update from Hosted Weblate (@weblate)
- **PR #1227** (closed): fix(security): block IPv6 transition ranges for webhooks (@naiba)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
