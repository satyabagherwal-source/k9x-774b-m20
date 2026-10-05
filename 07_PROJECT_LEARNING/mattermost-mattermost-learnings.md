# Forensic Learning Record (Deep Inspection): mattermost/mattermost

> **Canonical Artifact**: `07_PROJECT_LEARNING/mattermost-mattermost-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mattermost/mattermost](https://github.com/mattermost/mattermost))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:29:45.208Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mattermost/mattermost`
- **Description**: Mattermost is an open source platform for secure collaboration across the entire software development lifecycle..
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 39265 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `server/channels/api4/post_utils.go`
```
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

func userCreatePostPermissionCheckWithContext(c *Context, channelId string) {
	hasPermission := false
	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelId, model.PermissionCreatePost); ok {
		hasPermission = true
	} else if channel, err := c.App.GetChannel(c.AppContext, channelId); err == nil {
		// Temporary permission check method until advanced permissions, please do not copy
		if channel.Type == model.ChannelTypeOpen && c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionCreatePostPublic) {
			hasPermission = true
		}
	}

	if !hasPermission {
		c.SetPermissionError(model.PermissionCreatePost)
		return
	}
}

func postHardenedModeCheckWithContext(where string, c *Context, props model.StringInterface) {
	if appErr := app.PostHardenedModeCheckWithApp(c.App, c.AppContext.Session().IsIntegration(), props); appErr != nil {
		appErr.Where = where
		c.Err = appErr
	}
}

func postPriorityCheckWithContext(where string, c *Context, priority *model.PostPriority, rootId string) {
	appErr := app.PostPriorityCheckWithApp(where, c.App, c.AppContext, c.AppContext.Session().UserId, priority, rootId)
	if appErr != nil {
		appErr.Where = where
		c.Err = appErr
	}
}

func postCardTypeCheckWithContext(where string, c *Context, postType string) {
	if appErr := app.PostCardTypeCheckWithApp(where, c.App, postType); appErr != nil {
		appErr.Where = where
		c.Err = appErr
	}
}

// postBurnOnReadCheckWithContext runs the channel/participant checks and then
// the ABAC create_burn_on_read_post policy check.
//
// The policy check is here rather than inside PostBurnOnReadCheckWithApp
// because the scheduled-post send job calls that function too: a post that was
// allowed when the user scheduled it must still send, even if the policy has
// since tightened.
//
// It must also stay after the create-post permission check that both callers
// run first. A user who cannot post in the channel at all is refused on that
// basis rather than told burn-on-read is unavailable, and a burn-on-read allow
// must never override a create-post deny.
func postBurnOnReadCheckWithContext(where string, c *Context, post *model.Post, channel *model.Channel) {
	appErr := app.PostBurnOnReadCheckWithApp(where, c.App, c.AppContext, post.UserId, post.ChannelId, post.Type, channel)
	if appErr != nil {
		appErr.Where = where
		c.Err = appErr
		return
	}

	if post.Type != model.PostTypeBurnOnRead {
		return
	}

	if !c.App.HasPermissionToChannelAction(c.AppContext, post.UserId, c.AppContext.Session().Roles, post.ChannelId, model.AccessControlPolicyActionCreateBurnOnReadPost) {
		c.Err = model.NewAppError(where, "api.post.create_post.burn_on_read.abac_denied.app_error", nil, "", http.StatusForbidden)
	}
}

// checkUploadFilePermissionForNewFiles checks upload_file permission only when
// adding new files to a post, preventing permission bypass via cross-channel file attachments.
func checkUploadFilePermissionForNewFiles(c *Context, newFileIds []string, originalPost *model.Post) {
	if len(newFileIds) == 0 {
		return
	}

	originalFileIDsMap := make(map[string]bool, len(originalPost.FileIds))
	for _, fileID := range originalPost.FileIds {
		originalFileIDsMap[fileID] = true
	}

	hasNewFiles := false
	for _, fileID := range newFileIds {
		if !originalFileIDsMap[fileID] {
			hasNewFiles = true
			break
		}
	}

	if hasNewFiles {
		if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), originalPost.ChannelId, model.PermissionUploadFile); !ok {
			c.SetPermissionError(model.PermissionUploadFile)
			return
		}
	}
}

// checkEditFileAttachmentPermission checks edit_file_attachment permission
// when file IDs are being changed (files added or removed) during post edit.
func checkEditFileAttachmentPermission(c *Context, newFileIds []string, originalPost *model.Post) {
	if utils.SliceEqualUnordered(newFileIds, originalPost.FileIds) {
		return
	}
	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), originalPost.ChannelId, model.PermissionEditFileAttachment); !ok {
		c.SetPermissionError(model.PermissionEditFileAttachment)
	}
}

```

### Core Architecture Module: `server/channels/api4/webhook.go`
```
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitWebhook() {
	api.BaseRoutes.IncomingHooks.Handle("", api.APISessionRequired(createIncomingHook)).Methods(http.MethodPost)
	api.BaseRoutes.IncomingHooks.Handle("", api.APISessionRequired(getIncomingHooks)).Methods(http.MethodGet)
	api.BaseRoutes.IncomingHook.Handle("", api.APISessionRequired(getIncomingHook)).Methods(http.MethodGet)
	api.BaseRoutes.IncomingHook.Handle("", api.APISessionRequired(updateIncomingHook)).Methods(http.MethodPut)
	api.BaseRoutes.IncomingHook.Handle("", api.APISessionRequired(deleteIncomingHook)).Methods(http.MethodDelete)

	api.BaseRoutes.OutgoingHooks.Handle("", api.APISessionRequired(createOutgoingHook)).Methods(http.MethodPost)
	api.BaseRoutes.OutgoingHooks.Handle("", api.APISessionRequired(getOutgoingHooks)).Methods(http.MethodGet)
	api.BaseRoutes.OutgoingHook.Handle("", api.APISessionRequired(getOutgoingHook)).Methods(http.MethodGet)
	api.BaseRoutes.OutgoingHook.Handle("", api.APISessionRequired(updateOutgoingHook)).Methods(http.MethodPut)
	api.BaseRoutes.OutgoingHook.Handle("", api.APISessionRequired(deleteOutgoingHook)).Methods(http.MethodDelete)
	api.BaseRoutes.OutgoingHook.Handle("/regen_token", api.APISessionRequired(regenOutgoingHookToken)).Methods(http.MethodPost)
}

func createIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	var hook model.IncomingWebhook
	if jsonErr := json.NewDecoder(r.Body).Decode(&hook); jsonErr != nil {
		c.SetInvalidParamWithErr("incoming_webhook", jsonErr)
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, hook.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateIncomingHook, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "incoming_webhook", &hook)
	model.AddEventParameterAuditableToAuditRec(auditRec, "channel", channel)
	c.LogAudit("attempt")

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionManageOwnIncomingWebhooks) {
		c.SetPermissionError(model.PermissionManageOwnIncomingWebhooks)
		return
	}

	if ok, _ := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel); !ok {
		c.LogAudit("fail - bad channel permissions")
		c.SetPermissionError(model.PermissionReadChannelContent)
		return
	}

	userId := c.AppContext.Session().UserId
	if hook.UserId != "" && hook.UserId != userId {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionManageOthersIncomingWebhooks) {
			c.LogAudit("fail - inappropriate permissions")
			c.SetPermissionError(model.PermissionManageOthersIncomingWebhooks)
			return
		}

		var hookUser *model.User
		if hookUser, err = c.App.GetUser(c.AppContext, hook.UserId); err != nil {
			c.Err = err
			return
		}

		if appErr := c.App.ValidateIncomingWebhookUser(c.AppContext, *c.AppContext.Session(), hookUser, channel); appErr != nil {
			c.LogAudit("fail - invalid webhook user")
			c.Err = appErr
			return
		}

		userId = hook.UserId
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionBypassIncomingWebhookChannelLock) {
		hook.ChannelLocked = true
		hook.ChannelId = channel.Id
	}

	incomingHook, err := c.App.CreateIncomingWebhookForChannel(userId, channel, &hook)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(incomingHook)
	auditRec.AddEventObjectType("hook")
	c.LogAudit("success")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(incomingHook); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireHookId()
	if c.Err != nil {
		return
	}

	var updatedHook model.IncomingWebhook
	if jsonErr := json.NewDecoder(r.Body).Decode(&updatedHook); jsonErr != nil {
		c.SetInvalidParamWithErr("incoming_webhook", jsonErr)
		return
	}

	// The hook being updated in the payload must be the same one as indicated in the URL.
	if updatedHook.Id != c.Params.HookId {
		c.SetInvalidParam("hook_id")
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateIncomingHook, model.AuditStatusFail)
	model.AddEventParameterToAuditRec(auditRec, "hook_id", c.Params.HookId)
	model.AddEventParameterAuditableToAuditRec(auditRec, "updated_hook", &updatedHook)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	oldHook, err := c.App.GetIncomingWebhook(c.Params.HookId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddEventPriorState(oldHook)
	auditRec.AddEventObjectType("incoming_webhook")

	if updatedHook.TeamId == "" {
		updatedHook.TeamId = oldHook.TeamId
	}

	if updatedHook.TeamId != oldHook.TeamId {
		c.Err = model.NewAppError("updateIncomingHook", "api.webhook.team_mismatch.app_error", nil, "user_id="+c.AppContext.Session().UserId, http.StatusBadRequest)
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, updatedHook.ChannelId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.AddMeta("channel_id", channel.Id)
	auditRec.AddMeta("channel_name", channel.Name)

	if channel.TeamId != updatedHook.TeamId {
		c.SetInvalidParam("channel_id")
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionManageOwnIncomingWebhooks) {
		c.SetPermissionError(model.PermissionManageOwnIncomingWebhooks)
		return
	}

	if c.AppContext.Session().UserId != oldHook.UserId && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionManageOthersIncomingWebhooks) {
		c.LogAudit("fail - inappropriate permissions")
		c.SetPermissionError(model.PermissionManageOthersIncomingWebhooks)
		return
	}

	if channel.Type != model.ChannelTypeOpen {
		if ok, _ := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel); !ok {
			c.LogAudit("fail - bad channel permissions")
			c.SetPermissionError(model.PermissionReadChannelContent)
			return
		}
	}

	// Moving the hook must not attribute its owner's posts to a channel they cannot access.
	if updatedHook.ChannelId != oldHook.ChannelId {
		if appErr := c.App.ValidateIncomingWebhookUserChannelAccess(c.AppContext, oldHook.UserId, channel); appErr != nil {
			c.LogAudit("fail - invalid webhook user")
			c.Err = appErr
			return
		}
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), channel.TeamId, model.PermissionBypassIncomingWebhookChannelLock) {
		updatedHook.ChannelLocked = true
		updatedHook.ChannelId = channel.Id
	}

	incomingHook, err := c.App.UpdateIncomingWebhook(oldHook, &updatedHook)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddEventResultState(incomingHook)
	auditRec.Success()
	c.LogAudit("success")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(incomingHook); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getIncomingHooks(c *Context, w http.ResponseWriter, r *http.Request) {
	var (
		teamID = r.URL.Query().Get("team_id")
		userID = c.AppContext.Session().UserId

		hooks  []*model.IncomingWebhook
		appErr *model.AppError
		js     []byte
		err    error
	)

	if teamID != "" {
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionManageOwnIncomingWebhooks) {
			c.SetPermissionError(model.PermissionManageOwnIncomingWebhooks)
			return
		}

		// Remove userId as a filter if they have permission to manage others.
		if c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionManageOthersIncomingWebhooks) {
			userID = ""
		}

		hooks, appErr = c.App.GetIncomingWebhooksForTeamPageByUser(teamID, userID, c.Params.Page, c.Params.PerPage)
	} else {
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOwnIncomingWebhooks) {
			c.SetPermissionError(model.PermissionManageOwnIncomingWebhooks)
			return
		}

		// Remove userId as a filter if they have permission to manage others.
		if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageOthersIncomingWebhooks) {
			userID = ""
		}

		hooks, appErr = c.App.GetIncomingWebhooksPageByUser(userID, c.Params.Page, c.Params.PerPage)
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	if c.Params.IncludeTotalCount {
		totalCount, appErr := c.App.GetIncomingWebhooksCount(teamID, userID)

		if appErr != nil {
			c.Err = appErr
			return
		}

		hooksWithCount := model.IncomingWebhooksWithCount{Webhooks: hooks, TotalCount: totalCount}
		js, err = json.Marshal(hooksWithCount)
	} else {
		js, err = json.Marshal(hooks)
	}

	if err != nil {
		c.Err = model.NewAppError("getIncomingHooks", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireHookId()
	if c.Err != nil {
		return
	}

	hookId := c.Params.HookId

	var err *model.AppError
	var hook *model.IncomingWebhook
	var channel *model.Channel

	hook, err = c.App.GetIncomingWebhook(hookId)
	if err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventGetIncomingHook, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "hook_id", c.Params.HookId)
	auditRec.AddMeta("hook_id", hook.Id)
	auditRec.AddMeta("hook_display", hook.DisplayName)
	auditRec.AddMeta("channel_id", hook.ChannelId)
	auditRec.AddMeta("team_id", hook.TeamId)
	c.LogAudit("attempt")

	channel, err = c.App.GetChannel(c.AppContext, hook.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	i
```

### Core Architecture Module: `server/channels/api4/webhook_local.go`
```
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitWebhookLocal() {
	api.BaseRoutes.IncomingHooks.Handle("", api.APILocal(localCreateIncomingHook)).Methods(http.MethodPost)
	api.BaseRoutes.IncomingHooks.Handle("", api.APILocal(getIncomingHooks)).Methods(http.MethodGet)
	api.BaseRoutes.IncomingHook.Handle("", api.APILocal(getIncomingHook)).Methods(http.MethodGet)
	api.BaseRoutes.IncomingHook.Handle("", api.APILocal(updateIncomingHook)).Methods(http.MethodPut)
	api.BaseRoutes.IncomingHook.Handle("", api.APILocal(deleteIncomingHook)).Methods(http.MethodDelete)

	api.BaseRoutes.OutgoingHooks.Handle("", api.APILocal(localCreateOutgoingHook)).Methods(http.MethodPost)
	api.BaseRoutes.OutgoingHooks.Handle("", api.APILocal(getOutgoingHooks)).Methods(http.MethodGet)
	api.BaseRoutes.OutgoingHook.Handle("", api.APILocal(getOutgoingHook)).Methods(http.MethodGet)
	api.BaseRoutes.OutgoingHook.Handle("", api.APILocal(updateOutgoingHook)).Methods(http.MethodPut)
	api.BaseRoutes.OutgoingHook.Handle("", api.APILocal(deleteOutgoingHook)).Methods(http.MethodDelete)
}

func localCreateIncomingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	var hook model.IncomingWebhook
	if jsonErr := json.NewDecoder(r.Body).Decode(&hook); jsonErr != nil {
		c.SetInvalidParamWithErr("incoming_webhook", jsonErr)
		return
	}

	if hook.UserId == "" {
		c.SetInvalidParam("user_id")
		return
	}

	channel, err := c.App.GetChannel(c.AppContext, hook.ChannelId)
	if err != nil {
		c.Err = err
		return
	}

	if _, err = c.App.GetUser(c.AppContext, hook.UserId); err != nil {
		c.Err = err
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventLocalCreateIncomingHook, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "hook", &hook)
	model.AddEventParameterAuditableToAuditRec(auditRec, "channel", channel)
	c.LogAudit("attempt")

	incomingHook, err := c.App.CreateIncomingWebhookForChannel(hook.UserId, channel, &hook)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(incomingHook)
	auditRec.AddEventObjectType("incoming_webhook")
	c.LogAudit("success")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(incomingHook); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func localCreateOutgoingHook(c *Context, w http.ResponseWriter, r *http.Request) {
	var hook model.OutgoingWebhook
	if jsonErr := json.NewDecoder(r.Body).Decode(&hook); jsonErr != nil {
		c.SetInvalidParamWithErr("outgoing_webhook", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateOutgoingHook, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "hook", &hook)
	c.LogAudit("attempt")

	if hook.CreatorId == "" {
		c.SetInvalidParam("creator_id")
		return
	}

	_, err := c.App.GetUser(c.AppContext, hook.CreatorId)
	if err != nil {
		c.Err = err
		return
	}

	rhook, err := c.App.CreateOutgoingWebhook(&hook)
	if err != nil {
		c.LogAudit("fail")
		c.Err = err
		return
	}

	auditRec.Success()
	auditRec.AddEventResultState(rhook)
	auditRec.AddEventObjectType("outgoing_webhook")
	c.LogAudit("success")

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(rhook); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

```

### Core Architecture Module: `server/channels/app/email/utils.go`
```
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package email

import (
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/platform/shared/mail"
)

func (es *Service) mailServiceConfig(replyToAddress string) *mail.SMTPConfig {
	emailSettings := es.config().EmailSettings
	hostname := utils.GetHostnameFromSiteURL(*es.config().ServiceSettings.SiteURL)

	if replyToAddress == "" {
		replyToAddress = *emailSettings.ReplyToAddress
	}

	cfg := mail.SMTPConfig{
		Hostname:                          hostname,
		ConnectionSecurity:                *emailSettings.ConnectionSecurity,
		SkipServerCertificateVerification: *emailSettings.SkipServerCertificateVerification,
		ServerName:                        *emailSettings.SMTPServer,
		Server:                            *emailSettings.SMTPServer,
		Port:                              *emailSettings.SMTPPort,
		ServerTimeout:                     *emailSettings.SMTPServerTimeout,
		Username:                          *emailSettings.SMTPUsername,
		Password:                          *emailSettings.SMTPPassword,
		EnableSMTPAuth:                    *emailSettings.EnableSMTPAuth,
		SendEmailNotifications:            *emailSettings.SendEmailNotifications,
		FeedbackName:                      *emailSettings.FeedbackName,
		FeedbackEmail:                     *emailSettings.FeedbackEmail,
		ReplyToAddress:                    replyToAddress,
	}
	return &cfg
}

func (es *Service) GetTrackFlowStartedByRole(isFirstAdmin bool, isSystemAdmin bool) string {
	trackFlowStartedByRole := "su"

	if isFirstAdmin {
		trackFlowStartedByRole = "fa"
	} else if isSystemAdmin {
		trackFlowStartedByRole = "sa"
	}

	return trackFlowStartedByRole
}

```

### Core Architecture Module: `server/channels/app/guarded_hooks.go`
```
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Channel-guard dispatch helpers.
//
// Each runGuarded<Hook> helper implements two-phase plugin dispatch: Phase A fans out to non-guard
// plugins via RunMultiHookExcluding (fail-open, preserving RunMultiHook semantics — when guards is
// empty the exclude list is empty and the iteration is identical to plain RunMultiHook); Phase B
// calls each guard claimant in PluginId-sorted order via the *WithRPCErr companion, and fail-closed
// on transport errors. Phase B's for-range is a no-op when there are no guards, so unguarded
// channels traverse the same single linear flow with zero extra work beyond the Phase A dispatch.
//
// Allow-by-default for non-implementing claimants: a plugin may register a channel guard without
// implementing every guarded hook. When Phase B reaches such a claimant, the *WithRPCErr
// companion's g.implemented[<HookID>] gate skips the RPC call entirely and returns zero values with
// a nil error. The helper's three guard branches all skip in that case, so the claimant contributes
// nothing, basically: "this plugin had no opinion on this hook." Iteration continues to the next
// claimant.
package app

import (
	"cmp"
	"net/http"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// resolveGuards returns the (sorted-by-PluginId) guard slice for channelID along with a
// non-nil rejectErr when the request must fail-close (plugin system disabled, or a specific
// claimant is inactive). The helper picks the right operator-facing log message internally.
// (nil, nil) means the channel is unguarded — Phase A still runs (with no exclusions) and
// Phase B's loop becomes a no-op. (guards, nil) means proceed with two-phase dispatch.
func (a *App) resolveGuards(rctx request.CTX, channelID, callerName string) (guards []*store.ChannelGuard, rejectErr *model.AppError) {
	ch := a.Channels()
	raw := ch.getGuardsForChannel(channelID)
	if len(raw) == 0 {
		return nil, nil
	}
	sorted := append([]*store.ChannelGuard(nil), raw...)
	slices.SortFunc(sorted, func(a, b *store.ChannelGuard) int { return cmp.Compare(a.PluginId, b.PluginId) })
	env := ch.GetPluginsEnvironment()
	if env == nil {
		// Plugin system disabled in config or not yet initialized, but guards exist for this
		// channel. Operator action: flip PluginSettings.Enable on, or remove the guards.
		return sorted, logAndErrPluginsDisabled(rctx, channelID, callerName)
	}
	var inactive []string
	for _, g := range sorted {
		if !env.IsActive(g.PluginId) {
			inactive = append(inactive, g.PluginId)
		}
	}
	if len(inactive) > 0 {
		return sorted, logAndErrPluginInactive(rctx, channelID, inactive, callerName)
	}
	return sorted, nil
}

// logAndErrPluginInactive emits an operator-facing Error log identifying the specific guard
// plugins that are currently inactive, then returns a generic 503 AppError. A guard plugin
// being down is an operational failure: the request must be rejected, but internal plugin IDs
// do not belong in the user-facing response. Operators read the log to diagnose which plugin
// to recover.
func logAndErrPluginInactive(rctx request.CTX, channelID string, pluginIDs []string, callerName string) *model.AppError {
	rctx.Logger().Error("Channel guard rejected operation: claiming plugin is not active",
		mlog.String("error_id", "guard_plugin_inactive"),
		mlog.String("channel_id", channelID),
		mlog.Array("plugin_ids", pluginIDs),
		mlog.String("caller", callerName),
	)
	return model.NewAppError(callerName, "app.plugin.inactive_guard.app_error", nil, "", http.StatusServiceUnavailable)
}

// logAndErrPluginsDisabled emits an operator-facing Error log when the plugin system is off
// (PluginSettings.Enable == false or not yet initialized) but guards are still cached for the
// channel. Distinct from logAndErrPluginInactive: the cause is the global plugin switch, not
// a specific plugin failure. Returns the same generic 503 to the user.
func logAndErrPluginsDisabled(rctx request.CTX, channelID, callerName string) *model.AppError {
	rctx.Logger().Error("Channel guard rejected operation: plugin system is disabled but guards exist for this channel",
		mlog.String("error_id", "plugins_disabled_with_guards"),
		mlog.String("channel_id", channelID),
		mlog.String("caller", callerName),
	)
	return model.NewAppError(callerName, "app.plugin.inactive_guard.app_error", nil, "", http.StatusServiceUnavailable)
}

func appErrHookFailed(pluginID, callerName string, err error) *model.AppError {
	appErr := model.NewAppError(callerName, "app.plugin.guard_hook_failed.app_error",
		map[string]any{"PluginID": pluginID}, "", http.StatusServiceUnavailable)
	if err != nil {
		return appErr.Wrap(err)
	}
	return appErr
}

func pluginIDsOf(guards []*store.ChannelGuard) []string {
	ids := make([]string, len(guards))
	for i, g := range guards {
		ids[i] = g.PluginId
	}
	return ids
}

// runGuardedMessageWillBePosted dispatches MessageWillBePosted. Returns the (possibly
// replaced) post, the IDs of plugins that received the post content (for delivery tracking),
// or an AppError on rejection or RPC failure. The returned IDs are non-nil only on success;
// the caller records delivery after the post is saved, since the post has no ID at hook time.
func (a *App) runGuardedMessageWillBePosted(rctx request.CTX, post *model.Post) (*model.Post, []string, *model.AppError) {
	guards, rejectErr := a.resolveGuards(rctx, post.ChannelId, "createPost")

	// Guard plugin is unavailable — fail-closed (logged with attribution).
	if rejectErr != nil {
		return nil, nil, rejectErr
	}

	var metadata *model.PostMetadata
	if post.Metadata != nil {
		metadata = post.Metadata.Copy()
	}

	trackPluginDelivery := a.deliveryTrackingEnabled()
	var deliveredPluginIDs []string

	// Phase A: fan out to non-guard plugins, fail-open. With empty guards the exclude list is
	// empty and behavior is identical to plain RunMultiHook.
	var rejectionError *model.AppError
	pCtx := pluginContext(rctx)
	a.ch.RunMultiHookExcluding(pluginIDsOf(guards), func(hooks plugin.Hooks, manifest *model.Manifest) bool {
		replacementPost, rejectionReason := hooks.MessageWillBePosted(pCtx, post.ForPlugin())
		if trackPluginDelivery && manifest != nil {
			deliveredPluginIDs = append(deliveredPluginIDs, manifest.Id)
		}

		if rejectionReason != "" {
			id := "Post rejected by plugin. " + rejectionReason
			if rejectionReason == plugin.DismissPostError {
				id = plugin.DismissPostError
			}
			rejectionError = model.NewAppError("createPost", id, nil, "", http.StatusBadRequest)
			return false
		}
		if replacementPost != nil {
			post = replacementPost
			if post.Metadata != nil && metadata != nil {
				post.Metadata.Priority = metadata.Priority
			} else {
				post.Metadata = metadata
			}
		}
		return true
	}, plugin.MessageWillBePostedID)
	if rejectionError != nil {
		return nil, nil, rejectionError
	}

	// Phase B: call each guard claimant in PluginId-sorted order, fail-closed.
	for _, g := range guards {
		hooks, err := a.Channels().HooksForPluginWithRPCErr(g.PluginId)
		if err != nil {
			// Active→inactive race: plugin deactivated between resolveGuards and now.
			return nil, nil, logAndErrPluginInactive(rctx, post.ChannelId, []string{g.PluginId}, "CreatePost")
		}
		replacement, reason, rpcErr := hooks.MessageWillBePostedWithRPCErr(pCtx, post.ForPlugin())
		if rpcErr != nil {
			return nil, nil, appErrHookFailed(g.PluginId, "CreatePost", rpcErr)
		}
		if reason != "" {
			id := "Post rejected by plugin. " + reason
			if reason == plugin.DismissPostError {
				id = plugin.DismissPostError
			}
			return nil, nil, model.NewAppError("createPost", id, nil, "", http.StatusBadRequest)
		}
		if replacement != nil {
			post = replacement
			if post.Metadata != nil && metadata != nil {
				post.Metadata.Priority = metadata.Priority
			} else {
				post.Metadata = metadata
			}
		}
		if trackPluginDelivery {
			deliveredPluginIDs = append(deliveredPluginIDs, g.PluginId)
		}
	}

	return post, deliveredPluginIDs, nil
}

// runGuardedMessageWillBeUpdated dispatches MessageWillBeUpdated. In the non-guarded
// hook variant, either newPost == nil OR rejectionReason != "" signals rejection.
func (a *App) runGuardedMessageWillBeUpdated(rctx request.CTX, newPost, oldPost *model.Post) (*model.Post, *model.AppError) {
	guards, rejectErr := a.resolveGuards(rctx, oldPost.ChannelId, "UpdatePost")

	// Guard plugin is unavailable — fail-closed (logged with attribution).
	if rejectErr != nil {
		return nil, rejectErr
	}

	// buildUpdateRejectionErr mirrors the legacy error shape at post.go UpdatePost.
	buildUpdateRejectionErr := func(reason string) *model.AppError {
		id := "Post rejected by plugin. " + reason
		if reason == plugin.DismissPostError {
			id = plugin.DismissPostError
		}
		return model.NewAppError("UpdatePost", id, nil, "", http.StatusBadRequest)
	}

	trackPluginDelivery := a.deliveryTrackingEnabled()
	var deliveredPluginIDs []string

	// Deferred so a later rejection cannot discard plugins that already received the content.
	// oldPost carries the same id and channel as newPost, and is non-nil on every exit.
	defer func() {
		a.RecordPostDeliveryToPlugins(rctx, deliveredPluginIDs, oldPost)
	}()

	// Phase A: fan out to non-guard plugins, fail-open. With empty guards the exclude list is
	// empty and behavior is identical to plain RunMultiHook.
	var rejectionReason string
	pCtx := pluginContext(rctx)
	a.ch.RunMultiHookExcluding(pluginIDsOf(guards), func(hooks plugin.Hooks, manifest *model.Manifest) bool {
		newPost, rejectionReason = hooks.MessageWillBeUpdated(pCtx, newPost.ForPlugin(), oldPost.ForPlugin())
		if newPost != nil && trackPluginDelivery &
```

### Core Architecture Module: `server/channels/app/imaging/utils.go`
```
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"image"
	"image/color"

	"github.com/boxes-ltd/imaging"
)

type rawImg interface {
	Set(x, y int, c color.Color)
	Opaque() bool
}

func isFullyTransparent(c color.Color) bool {
	// TODO: This can be optimized by checking the color type and
	// only extract the needed alpha value.
	_, _, _, a := c.RGBA()
	return a == 0
}

// FillImageTransparency fills in-place all the fully transparent pixels of the
// input image with the given color.
func FillImageTransparency(img image.Image, c color.Color) {
	var i rawImg

	bounds := img.Bounds()

	fillFunc := func() {
		for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
			for x := bounds.Min.X; x < bounds.Max.X; x++ {
				if isFullyTransparent(img.At(x, y)) {
					i.Set(x, y, c)
				}
			}
		}
	}

	switch raw := img.(type) {
	case *image.Alpha:
		i = raw
	case *image.Alpha16:
		i = raw
	case *image.Gray:
		i = raw
	case *image.Gray16:
		i = raw
	case *image.NRGBA:
		i = raw
		col := color.NRGBAModel.Convert(c).(color.NRGBA)
		fillFunc = func() {
			for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
				for x := bounds.Min.X; x < bounds.Max.X; x++ {
					i := raw.PixOffset(x, y)
					if raw.Pix[i+3] == 0x00 {
						raw.Pix[i] = col.R
						raw.Pix[i+1] = col.G
						raw.Pix[i+2] = col.B
						raw.Pix[i+3] = col.A
					}
				}
			}
		}
	case *image.NRGBA64:
		i = raw
		col := color.NRGBA64Model.Convert(c).(color.NRGBA64)
		fillFunc = func() {
			for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
				for x := bounds.Min.X; x < bounds.Max.X; x++ {
					i := raw.PixOffset(x, y)
					a := uint16(raw.Pix[i+6])<<8 | uint16(raw.Pix[i+7])
					if a == 0 {
						raw.Pix[i] = uint8(col.R >> 8)
						raw.Pix[i+1] = uint8(col.R)
						raw.Pix[i+2] = uint8(col.G >> 8)
						raw.Pix[i+3] = uint8(col.G)
						raw.Pix[i+4] = uint8(col.B >> 8)
						raw.Pix[i+5] = uint8(col.B)
						raw.Pix[i+6] = uint8(col.A >> 8)
						raw.Pix[i+7] = uint8(col.A)
					}
				}
			}
		}
	case *image.Paletted:
		i = raw
		fillFunc = func() {
			for i := range raw.Palette {
				if isFullyTransparent(raw.Palette[i]) {
					raw.Palette[i] = c
				}
			}
		}
	case *image.RGBA:
		i = raw
		col := color.RGBAModel.Convert(c).(color.RGBA)
		fillFunc = func() {
			for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
				for x := bounds.Min.X; x < bounds.Max.X; x++ {
					i := raw.PixOffset(x, y)
					if raw.Pix[i+3] == 0x00 {
						raw.Pix[i] = col.R
						raw.Pix[i+1] = col.G
						raw.Pix[i+2] = col.B
						raw.Pix[i+3] = col.A
					}
				}
			}
		}
	case *image.RGBA64:
		i = raw
		col := color.RGBA64Model.Convert(c).(color.RGBA64)
		fillFunc = func() {
			for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
				for x := bounds.Min.X; x < bounds.Max.X; x++ {
					i := raw.PixOffset(x, y)
					a := uint16(raw.Pix[i+6])<<8 | uint16(raw.Pix[i+7])
					if a == 0 {
						raw.Pix[i] = uint8(col.R >> 8)
						raw.Pix[i+1] = uint8(col.R)
						raw.Pix[i+2] = uint8(col.G >> 8)
						raw.Pix[i+3] = uint8(col.G)
						raw.Pix[i+4] = uint8(col.B >> 8)
						raw.Pix[i+5] = uint8(col.B)
						raw.Pix[i+6] = uint8(col.A >> 8)
						raw.Pix[i+7] = uint8(col.A)
					}
				}
			}
		}
	default:
		return
	}

	if !i.Opaque() {
		fillFunc()
	}
}

// FillCenter creates an image with the specified dimensions and fills it with
// the centered and scaled source image.
func FillCenter(img image.Image, w, h int) *image.NRGBA {
	return imaging.Fill(img, w, h, imaging.Center, imaging.Lanczos)
}

// Fit scales down the image to fit within the specified maximum dimensions,
// preserving the aspect ratio.
func Fit(img image.Image, maxW, maxH int) *image.NRGBA {
	return imaging.Fit(img, maxW, maxH, imaging.Lanczos)
}

```

### Core Architecture Module: `server/channels/app/import_utils.go`
```
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"crypto/rand"
	"math/big"
)

const (
	passwordSpecialChars     = "!$%^&*(),."
	passwordNumbers          = "0123456789"
	passwordUpperCaseLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	passwordLowerCaseLetters = "abcdefghijklmnopqrstuvwxyz"
	passwordAllChars         = passwordSpecialChars + passwordNumbers + passwordUpperCaseLetters + passwordLowerCaseLetters
)

func randInt(maxInt int) (int, error) {
	val, err := rand.Int(rand.Reader, big.NewInt(int64(maxInt)))
	if err != nil {
		return 0, err
	}
	return int(val.Int64()), nil
}

func generatePassword(minimumLength int) (string, error) {
	upperIdx, err := randInt(len(passwordUpperCaseLetters))
	if err != nil {
		return "", err
	}
	numberIdx, err := randInt(len(passwordNumbers))
	if err != nil {
		return "", err
	}
	lowerIdx, err := randInt(len(passwordLowerCaseLetters))
	if err != nil {
		return "", err
	}
	specialIdx, err := randInt(len(passwordSpecialChars))
	if err != nil {
		return "", err
	}

	// Make sure we are guaranteed at least one of each type to meet any possible password complexity requirements.
	password := string([]rune(passwordUpperCaseLetters)[upperIdx]) +
		string([]rune(passwordNumbers)[numberIdx]) +
		string([]rune(passwordLowerCaseLetters)[lowerIdx]) +
		string([]rune(passwordSpecialChars)[specialIdx])

	for len(password) < minimumLength {
		i, err := randInt(len(passwordAllChars))
		if err != nil {
			return "", err
		}
		password = password + string([]rune(passwordAllChars)[i])
	}

	return password, nil
}

```

### Core Architecture Module: `server/channels/app/platform/searchengine.go`
```
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (ps *PlatformService) StartSearchEngine() (string, string) {
	if ps.SearchEngine.ElasticsearchEngine != nil {
		ps.esWatcher = newSearchEngineWatcher(ps)
		ps.esWatcher.start()
	}

	configListenerId := ps.AddConfigListener(func(oldConfig *model.Config, newConfig *model.Config) {
		if ps.SearchEngine == nil {
			return
		}

		if err := ps.SearchEngine.UpdateConfig(newConfig); err != nil {
			ps.Log().Error("Failed to update search engine config", mlog.Err(err))
		}

		oldESCfg := oldConfig.ElasticsearchSettings
		newESCfg := newConfig.ElasticsearchSettings
		startingES := ps.SearchEngine.ElasticsearchEngine != nil &&
			!model.SafeDereference(oldESCfg.EnableIndexing) &&
			model.SafeDereference(newESCfg.EnableIndexing)
		stoppingES := ps.SearchEngine.ElasticsearchEngine != nil &&
			model.SafeDereference(oldESCfg.EnableIndexing) &&
			!model.SafeDereference(newESCfg.EnableIndexing)
		connectionChanged := ps.SearchEngine.ElasticsearchEngine != nil &&
			(model.SafeDereference(oldESCfg.ConnectionURL) != model.SafeDereference(newESCfg.ConnectionURL) ||
				model.SafeDereference(oldESCfg.Username) != model.SafeDereference(newESCfg.Username) ||
				model.SafeDereference(oldESCfg.Password) != model.SafeDereference(newESCfg.Password) ||
				model.SafeDereference(oldESCfg.Sniff) != model.SafeDereference(newESCfg.Sniff))
		startingBackfill := !model.SafeDereference(oldESCfg.EnableSearchPublicChannelsWithoutMembership) &&
			model.SafeDereference(newESCfg.EnableSearchPublicChannelsWithoutMembership)

		if connectionChanged {
			// Signal the watcher to tear down the stale client before
			// re-evaluating. The watcher will call Stop() + Start()
			// with the new settings on its next tick.
			ps.esWatcher.requestRestart()
		} else if startingES || stoppingES {
			ps.esWatcher.reevaluate()
		}

		// Backfill was enabled but ES was already running (not starting fresh).
		if startingBackfill && !startingES {
			ps.Go(func() {
				engine := ps.SearchEngine.ElasticsearchEngine
				if engine == nil || !engine.IsActive() || !engine.IsIndexingEnabled() {
					ps.Log().Warn("Elasticsearch not available for channel_type backfill")
					return
				}
				ps.backfillPostsChannelType(engine)
			})
		}
	})

	licenseListenerId := ps.AddLicenseListener(func(oldLicense, newLicense *model.License) {
		if ps.SearchEngine == nil {
			return
		}
		if oldLicense == nil && newLicense != nil {
			// License added -- watcher will try Start() on next evaluation.
			ps.esWatcher.reevaluate()
		} else if oldLicense != nil && newLicense == nil {
			// License removed -- tell the watcher to stop the engine.
			// The watcher will then retry Start() which returns nil
			// without a license, so it backs off gracefully.
			if ps.SearchEngine.ElasticsearchEngine != nil {
				ps.esWatcher.requestRestart()
			}
		}
	})

	return configListenerId, licenseListenerId
}

func (ps *PlatformService) StopSearchEngine() {
	if ps.esWatcher != nil {
		ps.esWatcher.stop()
	}
	ps.RemoveConfigListener(ps.searchConfigListenerId)
	ps.RemoveLicenseListener(ps.searchLicenseListenerId)
	if ps.SearchEngine != nil && ps.SearchEngine.ElasticsearchEngine != nil && ps.SearchEngine.ElasticsearchEngine.IsActive() {
		if err := ps.SearchEngine.ElasticsearchEngine.Stop(); err != nil {
			ps.Log().Error("Failed to stop Elasticsearch engine", mlog.Err(err))
		}
	}
}

```

### Core Architecture Module: `server/channels/app/platform/searchengine_watcher.go`
```
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
)

// Watcher tuning knobs -- declared as vars so tests can override them.
var (
	searchEngineRetryInitial        = 15 * time.Second
	searchEngineRetryMax            = 5 * time.Minute
	searchEngineHealthInterval      = 60 * time.Second
	searchEngineHealthFailThreshold = 3
	searchEngineStopTimeout         = 15 * time.Second
)

// searchEngineWatcher monitors an Elasticsearch engine's health and manages
// its lifecycle (Start / Stop) in a single background goroutine. All engine
// state mutations happen inside this goroutine, eliminating races between
// concurrent callers.
//
// External code communicates with the watcher through two signals:
//   - reevaluate():     wake the watcher for immediate re-evaluation
//   - requestRestart(): tell the watcher to Stop() before re-evaluating
type searchEngineWatcher struct {
	ps     *PlatformService
	engine searchengine.SearchEngineInterface

	// Coordination -- accessed from multiple goroutines.
	mu           sync.Mutex
	cancel       context.CancelFunc // nil when not running
	done         chan struct{}      // closed when goroutine exits
	notifyCh     chan struct{}      // buffered(1), non-blocking wake signal
	forceRestart int32              // atomic: 1 = stop engine before next evaluation
}

// watcherLoopState holds per-goroutine loop state. Declared locally in run()
// and passed by pointer to helpers, so an abandoned goroutine and a fresh one
// never share these fields.
type watcherLoopState struct {
	backoff             time.Duration
	consecutiveFailures int
}

func newSearchEngineWatcher(ps *PlatformService) *searchEngineWatcher {
	return &searchEngineWatcher{
		ps:     ps,
		engine: ps.SearchEngine.ElasticsearchEngine,
	}
}

// start launches the watcher goroutine. Idempotent: no-op if already running.
func (w *searchEngineWatcher) start() {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.cancel != nil {
		return
	}

	ctx, cancel := context.WithCancel(context.Background())
	w.cancel = cancel
	w.done = make(chan struct{})
	w.notifyCh = make(chan struct{}, 1)

	done := w.done
	notifyCh := w.notifyCh
	go func() {
		defer close(done)
		w.run(ctx, notifyCh)
	}()
}

// stop cancels the watcher and waits for it to exit with a bounded timeout.
// If the watcher is stuck (e.g. in a blocking Start() call), the goroutine is
// abandoned and will self-terminate when the blocking call returns. The mutex
// is NOT held during the wait.
func (w *searchEngineWatcher) stop() {
	w.mu.Lock()
	cancel := w.cancel
	done := w.done
	w.cancel = nil
	w.done = nil
	w.notifyCh = nil
	w.mu.Unlock()

	if cancel == nil {
		return
	}

	cancel()

	select {
	case <-done:
	case <-time.After(searchEngineStopTimeout):
		w.ps.Log().Warn("Search engine watcher did not stop in time; abandoning goroutine",
			mlog.Duration("timeout", searchEngineStopTimeout))
	}
}

// reevaluate sends a non-blocking signal to the watcher to re-evaluate engine
// state immediately. Safe to call on a nil receiver.
func (w *searchEngineWatcher) reevaluate() {
	if w == nil {
		return
	}

	w.mu.Lock()
	ch := w.notifyCh
	w.mu.Unlock()

	if ch != nil {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
}

// requestRestart sets a flag that tells the watcher to Stop() the engine
// before its next evaluation cycle, then wakes it for immediate re-evaluation.
// Used when connection settings change or the license is removed.
// Safe to call on a nil receiver.
func (w *searchEngineWatcher) requestRestart() {
	if w == nil {
		return
	}
	atomic.StoreInt32(&w.forceRestart, 1)
	w.reevaluate()
}

// run is the watcher's main loop. It drives a simple state machine:
//
//	(start)
//	   |
//	   v
//	forceRestart? --yes--> Stop()
//	   |
//	   v
//	IsEnabled()? --no---> PARK (wait for notify or cancel)
//	   |
//	  yes
//	   |
//	   v
//	IsActive()? --yes---> HEALTH CHECK (periodic)
//	   |                        |
//	  no                 N consecutive failures
//	   |                        |
//	   v                   Stop() engine
//	RETRY <---------------------+
//	   |
//	   | wait (exponential backoff, interruptible)
//	   v
//	Start()
//	   |--error--> backoff*2 (capped), retry
//	   |--ok-----> reset backoff, HEALTH CHECK
//
//	Any state -- ctx.Done() --> EXIT
//	Any state -- reevaluate --> immediate re-evaluation
func (w *searchEngineWatcher) run(ctx context.Context, notifyCh <-chan struct{}) {
	if w.engine == nil {
		return
	}

	// Safety net: if the engine is still active when the goroutine exits
	// (e.g. Start() completed just as the context was canceled), stop it so
	// it is not left running with no goroutine to manage it.
	defer func() {
		if w.engine.IsActive() {
			w.ps.Log().Info("Search engine watcher: stopping engine on goroutine exit",
				mlog.String("engine", w.engine.GetName()))
			if err := w.engine.Stop(); err != nil {
				w.ps.Log().Warn("Search engine watcher: Stop() failed on goroutine exit",
					mlog.Err(err),
					mlog.String("engine", w.engine.GetName()))
			}
		}
	}()

	s := &watcherLoopState{backoff: searchEngineRetryInitial}
	rctx := request.EmptyContext(w.ps.logger)

	timer := time.NewTimer(0) // immediate first evaluation
	defer timer.Stop()

	for {
		if !w.waitForEvent(ctx, timer, notifyCh, s) {
			return
		}
		w.applyForceRestart()
		if w.parkIfDisabled(timer) {
			continue
		}
		if w.startIfInactive(ctx, timer, s) {
			continue
		}
		w.healthCheck(rctx, timer, s)
	}
}

// waitForEvent blocks until the timer fires, a notify arrives, or the context
// is cancelled. Returns false when the watcher should exit.
func (w *searchEngineWatcher) waitForEvent(ctx context.Context, timer *time.Timer, notifyCh <-chan struct{}, s *watcherLoopState) bool {
	for {
		select {
		case <-ctx.Done():
			return false
		case <-notifyCh:
			// Something changed -- re-evaluate immediately.
			timer.Reset(0)
			s.backoff = searchEngineRetryInitial
			s.consecutiveFailures = 0
			continue
		case <-timer.C:
		}

		// Prioritize shutdown: if select picked timer.C and ctx.Done()
		// simultaneously (random when both are ready), exit now.
		return ctx.Err() == nil
	}
}

// applyForceRestart checks and clears the force-restart flag. If set and the
// engine is active, it stops the engine so the next evaluation cycle will
// create a fresh client.
func (w *searchEngineWatcher) applyForceRestart() {
	if !atomic.CompareAndSwapInt32(&w.forceRestart, 1, 0) {
		return
	}
	if w.engine.IsActive() {
		w.ps.Log().Info("Search engine watcher: force-restart requested, stopping engine",
			mlog.String("engine", w.engine.GetName()))
		if err := w.engine.Stop(); err != nil {
			w.ps.Log().Warn("Search engine watcher: Stop() failed during force-restart",
				mlog.Err(err),
				mlog.String("engine", w.engine.GetName()))
		}
	}
}

// parkIfDisabled stops the engine (if active) and parks the watcher when the
// engine is disabled. Returns true when parked (caller should continue the
// loop without scheduling a timer -- the next wake comes from reevaluate).
func (w *searchEngineWatcher) parkIfDisabled(timer *time.Timer) bool {
	if w.engine.IsEnabled() {
		return false
	}
	if w.engine.IsActive() {
		if err := w.engine.Stop(); err != nil {
			w.ps.Log().Warn("Search engine watcher: Stop() returned error while disabling",
				mlog.Err(err),
				mlog.String("engine", w.engine.GetName()))
		}
	}
	w.ps.Log().Info("Search engine watcher: engine disabled, parking")
	timer.Stop()
	return true
}

// parkIfUnlicensed parks the watcher when the server has no Elasticsearch
// license. Returns true when parked (caller should continue the loop).
func (w *searchEngineWatcher) parkIfUnlicensed(timer *time.Timer) bool {
	license := w.ps.License()
	if license != nil && model.SafeDereference(license.Features.Elasticsearch) {
		return false
	}
	w.ps.Log().Info("Search engine watcher: engine not active (no Elasticsearch license), parking",
		mlog.String("engine", w.engine.GetName()))
	timer.Stop()
	return true
}

// startIfInactive attempts to start the engine when it is not active.
// Returns true when it handled the state (caller should continue the loop).
func (w *searchEngineWatcher) startIfInactive(ctx context.Context, timer *time.Timer, s *watcherLoopState) bool {
	if w.engine.IsActive() {
		return false
	}

	if err := w.engine.Start(ctx); err != nil {
		s.consecutiveFailures++
		w.ps.Log().Error("Search engine watcher: Start() failed, will retry",
			mlog.Err(err),
			mlog.Int("consecutive_failures", s.consecutiveFailures),
			mlog.Duration("next_backoff", s.backoff),
			mlog.String("engine", w.engine.GetName()))
		timer.Reset(s.backoff)
		s.backoff = min(s.backoff*2, searchEngineRetryMax)
		return true
	}

	if ctx.Err() != nil {
		return true // shutting down
	}

	// Start() returned nil but engine may not be active (e.g. no license).
	if !w.engine.IsActive() {
		if w.parkIfUnlicensed(timer) {
			return true
		}

		s.consecutiveFailures++
		w.ps.Log().Warn("Search engine watcher: Start() returned no error but engine is not active, will retry",
			mlog.Int("consecutive_failures", s.consecutiveFailures),
			mlog.Duration("next_backoff", s.backoff),
			mlog.String("engine", w.engine.GetName()))
		timer.Reset(s.backoff)
		s.backoff = min(s.backoff*2, searchEngineRetryMax)
		return true
	}

	w.ps.Log().Info("Search engine watcher: engine started successfully",
		mlog.String("engine", w.engine.GetName()))
	s.backoff = searchEngineRetryInitial
	s.consecutiveFailures = 0

	if model.SafeDereference(w.ps.Config().ElasticsearchSettings.EnableSearchPublicChannelsWithoutMembership) {
		engine := w.engine
		w.ps.Go(func() {
			w.ps.backfill
```

### Core Architecture Module: `server/channels/app/platform/utils.go`
```
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"crypto/sha256"
	"encoding/base64"
)

func getKeyHash(key string) string {
	hash := sha256.New()
	hash.Write([]byte(key))
	return base64.StdEncoding.EncodeToString(hash.Sum(nil))
}

// allocateCacheTargets is used to fill target value types
// for getting items from cache.
func allocateCacheTargets[T any](l int) []any {
	toPass := make([]any, 0, l)
	for range l {
		toPass = append(toPass, new(T))
	}
	return toPass
}

```

### Core Architecture Module: `server/channels/app/platform/web_broadcast_hook.go`
```
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

type BroadcastHook interface {
	// Process takes a WebSocket event and modifies it in some way. It is passed a HookedWebSocketEvent which allows
	// safe modification of the event.
	Process(msg *HookedWebSocketEvent, webConn *WebConn, args map[string]any) error
}

func (h *Hub) runBroadcastHooks(msg *model.WebSocketEvent, webConn *WebConn, hookIDs []string, hookArgs []map[string]any) *model.WebSocketEvent {
	if len(hookIDs) == 0 {
		return msg
	}

	hookedEvent := MakeHookedWebSocketEvent(msg)

	for i, hookID := range hookIDs {
		hook := h.broadcastHooks[hookID]
		args := hookArgs[i]
		if hook == nil {
			mlog.Warn("runBroadcastHooks: Unable to find broadcast hook", mlog.String("hook_id", hookID))
			continue
		}

		err := hook.Process(hookedEvent, webConn, args)
		if err != nil {
			mlog.Warn("runBroadcastHooks: Error processing hook", mlog.String("hook_id", hookID), mlog.Err(err))
		}
	}

	return hookedEvent.Event()
}

// HookedWebSocketEvent is a wrapper for model.WebSocketEvent that is intended to provide a similar interface, except
// it ensures the original WebSocket event is not modified.
type HookedWebSocketEvent struct {
	original *model.WebSocketEvent
	copy     *model.WebSocketEvent
}

func MakeHookedWebSocketEvent(event *model.WebSocketEvent) *HookedWebSocketEvent {
	return &HookedWebSocketEvent{
		original: event,
	}
}

func (he *HookedWebSocketEvent) Add(key string, value any) {
	he.copyIfNecessary()

	he.copy.Add(key, value)
}

func (he *HookedWebSocketEvent) EventType() model.WebsocketEventType {
	if he.copy == nil {
		return he.original.EventType()
	}

	return he.copy.EventType()
}

// Get returns a value from the WebSocket event data. You should never mutate a value returned by this method.
func (he *HookedWebSocketEvent) Get(key string) any {
	if he.copy == nil {
		return he.original.GetData()[key]
	}

	return he.copy.GetData()[key]
}

// copyIfNecessary should be called by any mutative method to ensure that the copy is instantiated.
func (he *HookedWebSocketEvent) copyIfNecessary() {
	if he.copy == nil {
		he.copy = he.original.RemovePrecomputedJSON()
	}
}

func (he *HookedWebSocketEvent) Event() *model.WebSocketEvent {
	if he.copy == nil {
		return he.original
	}

	return he.copy
}

```

### Core Architecture Module: `server/channels/app/post_permission_utils.go`
```
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func PostPriorityCheckWithApp(where string, a *App, rctx request.CTX, userId string, priority *model.PostPriority, rootId string) *model.AppError {
	user, appErr := a.GetUser(rctx, userId)
	if appErr != nil {
		return appErr
	}

	isPostPriorityEnabled := a.IsPostPriorityEnabled()
	IsPersistentNotificationsEnabled := a.IsPersistentNotificationsEnabled()
	allowPersistentNotificationsForGuests := *a.Config().ServiceSettings.AllowPersistentNotificationsForGuests
	license := a.License()

	appErr = postPriorityCheck(user, priority, rootId, isPostPriorityEnabled, IsPersistentNotificationsEnabled, allowPersistentNotificationsForGuests, license)
	if appErr != nil {
		appErr.Where = where
		return appErr
	}

	return nil
}

func postPriorityCheck(
	user *model.User,
	priority *model.PostPriority,
	rootId string,
	isPostPriorityEnabled,
	isPersistentNotificationsEnabled,
	allowPersistentNotificationsForGuests bool,
	license *model.License,
) *model.AppError {
	if priority == nil {
		return nil
	}

	priorityForbiddenErr := model.NewAppError("", "api.post.post_priority.priority_post_not_allowed_for_user.request_error", nil, "userId="+user.Id, http.StatusForbidden)

	if !isPostPriorityEnabled {
		return priorityForbiddenErr
	}

	if rootId != "" {
		return model.NewAppError("", "api.post.post_priority.priority_post_only_allowed_for_root_post.request_error", nil, "", http.StatusBadRequest)
	}

	if ack := priority.RequestedAck; ack != nil && *ack {
		if !model.MinimumProfessionalLicense(license) {
			return model.NewAppError("", "license_error.feature_unavailable", nil, "feature is not available for the current license", http.StatusNotImplemented)
		}
	}

	if notification := priority.PersistentNotifications; notification != nil && *notification {
		if !model.MinimumProfessionalLicense(license) {
			return model.NewAppError("", "license_error.feature_unavailable", nil, "feature is not available for the current license", http.StatusNotImplemented)
		}
		if !isPersistentNotificationsEnabled {
			return priorityForbiddenErr
		}

		if *priority.Priority != model.PostPriorityUrgent {
			return model.NewAppError("", "api.post.post_priority.urgent_persistent_notification_post.request_error", nil, "", http.StatusBadRequest)
		}

		if !allowPersistentNotificationsForGuests {
			if user.IsGuest() {
				return priorityForbiddenErr
			}
		}
	}

	return nil
}

func PostHardenedModeCheckWithApp(a *App, isIntegration bool, props model.StringInterface) *model.AppError {
	hardenedModeEnabled := *a.Config().ServiceSettings.EnableHardenedMode
	return postHardenedModeCheck(hardenedModeEnabled, isIntegration, props)
}

func postHardenedModeCheck(hardenedModeEnabled, isIntegration bool, props model.StringInterface) *model.AppError {
	if hardenedModeEnabled {
		if reservedProps := model.ContainsIntegrationsReservedProps(props); len(reservedProps) > 0 && !isIntegration {
			return model.NewAppError("", "api.context.invalid_body_param.app_error", map[string]any{"Name": "props"}, fmt.Sprintf("Cannot use props reserved for integrations. props: %v", reservedProps), http.StatusBadRequest)
		}
	}

	return nil
}

func userCreatePostPermissionCheckWithApp(rctx request.CTX, a *App, userId, channelId string) *model.AppError {
	hasPermission := false
	if ok, _ := a.HasPermissionToChannel(rctx, userId, channelId, model.PermissionCreatePost); ok {
		hasPermission = true
	} else if channel, err := a.GetChannel(rctx, channelId); err == nil {
		// Temporary permission check method until advanced permissions, please do not copy
		if channel.Type == model.ChannelTypeOpen && a.HasPermissionToTeam(rctx, userId, channel.TeamId, model.PermissionCreatePostPublic) {
			hasPermission = true
		}
	}

	if !hasPermission {
		return model.MakePermissionErrorForUser(userId, []*model.Permission{model.PermissionCreatePost})
	}

	return nil
}

// PostCardTypeCheckWithApp validates whether a card post can be created
// based on the IntegratedBoards feature flag.
func PostCardTypeCheckWithApp(where string, a *App, postType string) *model.AppError {
	if postType == model.PostTypeCard && !a.Config().FeatureFlags.IntegratedBoards {
		return model.NewAppError(where, "api.post.create_post.card_type_disabled.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

// PostBurnOnReadCheckWithApp validates whether a burn-on-read post can be created
// based on channel type and participants. This is called from the API layer before
// post creation to enforce burn-on-read restrictions.
func PostBurnOnReadCheckWithApp(where string, a *App, rctx request.CTX, userId, channelId, postType string, channel *model.Channel) *model.AppError {
	// Only validate if this is a burn-on-read post
	if postType != model.PostTypeBurnOnRead {
		return nil
	}

	// Get channel if not provided
	if channel == nil {
		ch, err := a.GetChannel(rctx, channelId)
		if err != nil {
			return model.NewAppError(where, "api.post.fill_in_post_props.burn_on_read.channel.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		channel = ch
	}

	if channel.IsShared() {
		return model.NewAppError(where, "api.post.fill_in_post_props.burn_on_read.shared_channel.app_error", nil, "", http.StatusBadRequest)
	}

	// Burn-on-read is not allowed in self-DMs or DMs with bots (including AI agents, plugins)
	if channel.Type == model.ChannelTypeDirect {
		// Check if it's a self-DM by comparing the channel name with the expected self-DM name
		selfDMName := model.GetDMNameFromIds(userId, userId)
		if channel.Name == selfDMName {
			return model.NewAppError(where, "api.post.fill_in_post_props.burn_on_read.self_dm.app_error", nil, "", http.StatusBadRequest)
		}

		// Check if the DM is with a bot (AI agents, plugins, etc.)
		otherUserId := channel.GetOtherUserIdForDM(userId)
		if otherUserId != "" && otherUserId != userId {
			otherUser, err := a.GetUser(rctx, otherUserId)
			if err != nil {
				// Failed to retrieve the other user (user not found, DB error, etc.)
				// Block burn-on-read post as we cannot validate the recipient
				return model.NewAppError(where, "api.post.fill_in_post_props.burn_on_read.user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			if otherUser.IsBot {
				return model.NewAppError(where, "api.post.fill_in_post_props.burn_on_read.bot_dm.app_error", nil, "", http.StatusBadRequest)
			}
		}
	}

	return nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #30689** (2025-04-28): **[MM-61105] Fix errcheck linter errors in config_test.go**
  *Symptoms*: #### Summary - Fixed multiple instances of unchecked error returns in `channels/app/config_test.go` - Removed the errcheck linter exclusion for this file in `.golangci.yml` - Fixed variable shadowing issues for error variables  This PR addresses an existing help-wanted issue to fix error handling in the config_test.go file by properly checking error return values that were previously ignored.  #### Ticket Link Fixes https://github.com/mattermost/mattermost/issues/28811  #### Release Note ```release-note NONE ```
  **Post-Mortem & Fix Analysis**:
  > @hanzei: Adding the "do-not-merge/release-note-label-needed" label because no release-note block was detected, please follow our [release note process](https://github.com/mattermost/chewbacca#release-notes-process) to remove it.  <details>  I understand the commands that are listed [here](https://chewbacca.core.cloud.mattermost.com/command-help.html) </details>
  > @hanzei: Adding the "do-not-merge/release-note-label-needed" label because no release-note block was detected, please follow our [release note process](https://github.com/mattermost/chewbacca#release-notes-process) to remove it.  <details>  I understand the commands that are listed [here](https://chewbacca.core.cloud.mattermost.com/command-help.html) </details>

- **Issue #30609** (2025-04-11): **[MM-61463] Fix errcheck issues in post_helpers_test.go**
  *Symptoms*: #### Summary Fixed errcheck issues in post_helpers_test.go by properly handling errors from th.App.Srv().Store().System().Save() calls and removed post_helpers_test.go from errcheck ignore list in .golangci.yml.  This change improves code quality by ensuring all errors are properly checked rather than being ignored.  #### Ticket Link Fixes https://github.com/mattermost/mattermost/issues/29078 Jira https://mattermost.atlassian.net/browse/MM-61463  #### Screenshots <!-- N/A - No UI changes -->  #### Release Note ```release-note NONE ```  🤖 Generated with [Claude Code](https://claude.ai/code)

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

### Incident Patch 1: `05a293c6` (2026-10-04)
**Commit Message**: E2E/Test: Fix failing tests (#38981)

* playwright: allow ensureFeatureFlag to set multiple flags, remove skipIfFeatureFlagNotSet

ensureFeatureFlag now accepts either a single (flagName, value) pair or a
{flagName: value} map, so prerequisites like
'await pw.skipIfFeatureFlagNotSet("ChannelAttributes", true)' can be
combined with other flag prerequisites into a single server restart
instead of one restart per flag.

skipIfFeatureFlagNotSet is removed entirely (definition, export, and
fixture wiring): it only ever skipped a test when a flag was off rather
than turning it on, which silently left specs gated on a flag that
defaults off (e.g. DiscoverableChannels, ManagedChannelCategories)
permanently un-exercised in CI.

Co-authored-by: saturnino <[REDACTED_EMAIL]>

* playwright: migrate skipIfFeatureFlagNotSet call sites to ensureFeatureFlag

Mechanical rename of skipIfFeatureFlagNotSet(flag, true) to
ensureFeatureFlag(flag, true) across channel_attributes, global_attributes,
board_attributes, channel_perm_rules, and abac specs/helpers. Adjacent
single-flag calls within the same test are merged into one
ensureFeatureFlag({flagA: true, flagB: true}) call so the server restarts
once p

**File**: `AGENTS.md` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 
 Explicitly import subdirectory instruction files that must always be in context:
 @server/AGENTS.md
+@e2e-tests/playwright/AGENTS.md
 
 ## Pull Requests
 
```

**File**: `e2e-tests/playwright/AGENTS.md` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+# AGENTS.md
+
+## Parallelism: 1 worker per server, many servers in parallel
+
+Playwright runs with a single worker per server (`PW_WORKERS` defaults to `1`
+in `lib/src/test_config.ts`): tests execute serially against any one server,
+never concurrently, since many specs mutate shared server-wide state (feature
+flags, config, licenses).
+
+CI parallelizes across jobs instead: each job in the `workers` matrix
+(`e2e-tests-playwright-template.yml`) boots its own Testcontainers server and
+runs its own single-worker Playwright process (`dispatch-run`), pulling spec
+files off a shared queue. The suite runs many servers in parallel, but always
+one worker per server -- never multiple workers sharing one server.
+
+Don't use `test.describe.configure({mode: 'parallel'})` or assume two tests in
+different files could race: they never do within a job.
+
+## `ensureFeatureFlag`: one server restart per spec file
+
+`pw.ensureFeatureFlag(flagName, value)` / `pw.ensureFeatureFlag({flagA: true,
+flagB: false})` (`lib/src/server/feature_flags.ts`) restarts the Testcontainers
+server with the given `MM_FEATUREFLAGS_*` env vars when it isn't already
+running with them. Feature flags can't be changed via `patchConfig` on a
+running server, so a restart is the only way to flip one.
+
+- Call it at the top of every test that needs it, inside the test body -- not
+  from a bare top-level call or `test.beforeAll()`. `pw` is a test-scoped
+  fixture (depends on per-test `page`/`context`) and isn't available in
+  `beforeAll`.
+- Every test in a spec file must request the same flag combination. When the
+  server already matches, this is a no-op, so a file restarts at most once, on
+  its first test. Mixing combinations causes a restart on every change.
+- A test needing a different combination belongs in its own file. See
+  `specs/functional/channels/categories/managed_categories_flag_off.spec.ts`
+  and
+  `specs/functional/system_console/global_attributes/global_attributes_listing_classification_markings.spec.ts`.
+
+This is enforced by review, not tooling.
+
+## Licensing
+
+Use `await pw.skipIfNoLicense()` to skip a test when the server has no
+license.
```

**File**: `e2e-tests/playwright/lib/src/flag.ts` (modified, +0/-7)
```diff
@@ -82,13 +82,6 @@ export async function skipIfNoLicense() {
     test.skip(license.IsLicensed === 'false', 'Skipping test - server not licensed');
 }
 
-export async function skipIfFeatureFlagNotSet(name: string, value: string | boolean) {
-    const {adminClient} = await getAdminClient();
-    const cfg = await adminClient.getConfig();
-
-    test.skip(cfg.FeatureFlags[name] !== value, `Skipping test - Feature Flag ${name} needs to be set to ${value}`);
-}
-
 // ensureServerDeployment is used to ensure server deployment type is as expected.
 // If server is not deployed as expected, test will fail.
 export async function ensureServerDeployment() {
```

**File**: `e2e-tests/playwright/lib/src/server/feature_flags.ts` (modified, +36/-15)
```diff
@@ -10,20 +10,32 @@ import {getAdminClient} from './init';
 import {testConfig} from '@/test_config';
 
 /**
- * Restarts the server with the given feature flag set to `value` if it isn't already, and
- * confirms the running server reports that value, skipping the test otherwise.
+ * Restarts the server with the given feature flag(s) set if they aren't already, then verifies
+ * the running server reports those values, skipping the test otherwise. Accepts either a single
+ * `(flagName, value)` pair or a `{flagName: value}` map.
  *
- * FeatureFlags can't be changed via patchConfig on a running server: with no Split key configured,
- * the config store's readOnlyFF handling reverts any FeatureFlags patch, so only a boot-time
- * MM_FEATUREFLAGS_* env var takes effect.
+ * Call via `pw.ensureFeatureFlag(...)`, passing identical arguments across every test in a spec
+ * file: when the flags already match, this is a no-op, so the server restarts at most once per
+ * file.
  */
-export async function ensureFeatureFlag(flagName: string, value: boolean): Promise<void> {
-    const envValue = String(value);
+export async function ensureFeatureFlag(flagName: string, value: boolean): Promise<void>;
+export async function ensureFeatureFlag(flags: Record<string, boolean>): Promise<void>;
+export async function ensureFeatureFlag(
+    flagNameOrFlags: string | Record<string, boolean>,
+    value?: boolean,
+): Promise<void> {
+    const flags = typeof flagNameOrFlags === 'string' ? {[flagNameOrFlags]: value as boolean} : flagNameOrFlags;
+    const flagEntries = Object.entries(flags);
+    const describeFlags = () => flagEntries.map(([name, val]) => `${name}=${String(val)}`).join(', ');
 
     try {
         const {adminClient} = await getAdminClient();
         const config = await adminClient.getConfig();
-        if (String(config.FeatureFlags?.[flagName]) === envValue) {
+
+        const mismatched = flagEntries.filter(
+            ([flagName, flagValue]) => String(config.FeatureFlags?.[flagName]) !== String(flagValue),
+        );
+        if (mismatched.length === 0) {
             // Already matches - nothing to restart, even against an external server.
             return;
         }
@@ -33,18 +45,27 @@ export async function ensureFeatureFlag(flagName: string, value: boolean): Promi
             return;
         }
 
-        const envKey = `MM_FEATUREFLAGS_${flagName.toUpperCase()}`;
-        const env = {[envKey]: envValue};
+        const env = Object.fromEntries(
+            mismatched.map(([flagName, flagValue]) => [`MM_FEATUREFLAGS_${flagName.toUpperCase()}`, String(flagValue)]),
+        );
+        let verifyClient = adminClient;
         if (!bootEnvMatches(env)) {
             await restartMattermostContainer(env);
+            // Restart points the server at a new container, so the pre-restart adminClient is
+            // now stale. Fetch a fresh one.
+            verifyClient = (await getAdminClient()).adminClient;
         }
 
-        const restartedConfig = await adminClient.getConfig();
-        const actual = restartedConfig.FeatureFlags?.[flagName];
-        if (String(actual) !== envValue) {
-            throw new Error(`Feature flag "${flagName}" is "${String(actual)}" after restart, expected "${envValue}".`);
+        const restartedConfig = await verifyClient.getConfig();
+        for (const [flagName, flagValue] of mismatched) {
+            const actual = restartedConfig.FeatureFlags?.[flagName];
+            if (String(actual) !== String(flagValue)) {
+                throw new Error(
+                    `Feature flag "${flagName}" is "${String(actual)}" after restart, expected "${String(flagValue)}".`,
+                );
+            }
         }
     } catch (error) {
-        test.skip(true, `Skipping test - feature flag "${flagName}" check failed: ${String(error)}`);
+        test.skip(true, `Skipping test - feature flag check (${describeFlags()}) failed: ${String(error)}`);
     }
 }
```

**File**: `e2e-tests/playwright/lib/src/test_fixture.ts` (modified, +0/-3)
```diff
@@ -14,7 +14,6 @@ import {
     shouldHaveCallsEnabled,
     shouldHaveFeatureFlag,
     shouldRunInLinux,
-    skipIfFeatureFlagNotSet,
     skipIfNoLicense,
 } from './flag';
 import {getBlobFromAsset, getFileFromAsset} from './file';
@@ -131,7 +130,6 @@ export class PlaywrightExtended {
     readonly ensureLicense;
     readonly ensureServerDeployment;
     readonly skipIfNoLicense;
-    readonly skipIfFeatureFlagNotSet;
 
     // ./file
     readonly getBlobFromAsset;
@@ -257,7 +255,6 @@ export class PlaywrightExtended {
         this.ensureLicense = ensureLicense;
         this.ensureServerDeployment = ensureServerDeployment;
         this.skipIfNoLicense = skipIfNoLicense;
-        this.skipIfFeatureFlagNotSet = skipIfFeatureFlagNotSet;
 
         // ./file
         this.getBlobFromAsset = getBlobFromAsset;
```

**File**: `e2e-tests/playwright/lib/src/ui/components/channels/profile_modal.ts` (modified, +5/-1)
```diff
@@ -45,7 +45,11 @@ export default class ProfileModal {
 
         this.closeButton = container.getByRole('button', {name: 'Close'});
         this.saveButton = container.getByRole('button', {name: 'Save'});
-        this.cancelButton = container.getByRole('button', {name: 'Cancel'});
+        // getByTestId, not getByRole('button', {name: 'Cancel'}): a custom profile attribute whose
+        // display name contains "Cancel" gives its own Edit button an accessible name like "Cancel
+        // X Edit" (title + button text via aria-labelledby), which getByRole's substring name match
+        // would also pick up alongside the real Cancel button.
+        this.cancelButton = container.getByTestId('cancelButton');
         this.managedByAdminMessage = container.getByText(
             'This field is managed by your System Admin. Contact them to request a change.',
         );
```

**File**: `e2e-tests/playwright/specs/functional/channels/categories/default_categories.spec.ts` (modified, +6/-11)
```diff
@@ -3,11 +3,6 @@
 
 import {expect, test} from '@mattermost/playwright-lib';
 
-async function skipIfNoEnterpriseLicense(adminClient: any) {
-    const license = await adminClient.getClientLicenseOld();
-    test.skip(license.IsLicensed !== 'true', 'Skipping test - server does not have an enterprise license');
-}
-
 async function enableChannelCategorySorting(adminClient: any) {
     await adminClient.patchConfig({
         TeamSettings: {
@@ -34,7 +29,7 @@ test.describe('Channel Category Sorting', () => {
         async ({pw}) => {
             // # Initialize setup and disable channel category sorting
             const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
-            await skipIfNoEnterpriseLicense(adminClient);
+            await pw.skipIfNoLicense();
             await disableChannelCategorySorting(adminClient);
             await adminClient.addToTeam(team.id, adminUser.id);
 
@@ -65,7 +60,7 @@ test.describe('Channel Category Sorting', () => {
         async ({pw}) => {
             // # Initialize setup and enable channel category sorting
             const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
-            await skipIfNoEnterpriseLicense(adminClient);
+            await pw.skipIfNoLicense();
             await enableChannelCategorySorting(adminClient);
             await adminClient.addToTeam(team.id, adminUser.id);
 
@@ -109,7 +104,7 @@ test.describe('Channel Category Sorting', () => {
     test('default category can be assigned via channel settings', {tag: '@channel_category_sorting'}, async ({pw}) => {
         // # Initialize setup with admin user and enterprise license
         const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
-        await skipIfNoEnterpriseLicense(adminClient);
+        await pw.skipIfNoLicense();
         await enableChannelCategorySorting(adminClient);
         await adminClient.addToTeam(team.id, adminUser.id);
 
@@ -162,7 +157,7 @@ test.describe('Channel Category Sorting', () => {
     test('default category can be removed via channel settings', {tag: '@channel_category_sorting'}, async ({pw}) => {
         // # Initialize setup and create a channel with a default category set
         const {adminUser, adminClient, team} = await pw.initSetup({withDefaultProfileImage: false});
-        await skipIfNoEnterpriseLicense(adminClient);
+        await pw.skipIfNoLicense();
         await enableChannelCategorySorting(adminClient);
         await adminClient.addToTeam(team.id, adminUser.id);
 
@@ -224,8 +219,8 @@ test.describe('Channel Category Sorting', () => {
         {tag: '@channel_category_sorting'},
         async ({pw}) => {
             // # Initialize setup
-            const {adminUser, adminClient} = await pw.initSetup({withDefaultProfileImage: false});
-            await skipIfNoEnterpriseLicense(adminClient);
+            const {adminUser} = await pw.initSetup({withDefaultProfileImage: false});
+            await pw.skipIfNoLicense();
 
             // # Log in and navigate to the System Console
             const {systemConsolePage} = await pw.testBrowser.login(adminUser);
```

**File**: `e2e-tests/playwright/specs/functional/channels/categories/managed_categories.spec.ts` (modified, +104/-127)
```diff
@@ -3,15 +3,6 @@
 
 import {expect, getRandomId, test} from '@mattermost/playwright-lib';
 
-async function skipIfNoEnterpriseLicense(adminClient: any) {
-    const license = await adminClient.getClientLicenseOld();
-    const enterpriseSkus = ['enterprise', 'advanced', 'entry'];
-    test.skip(
-        license.IsLicensed !== 'true' || !enterpriseSkus.includes(license.SkuShortName),
-        'Skipping test - server does not have an enterprise license',
-    );
-}
-
 async function enableManagedCategories(adminClient: any) {
     await adminClient.patchConfig({
         TeamSettings: {
@@ -20,14 +11,6 @@ async function enableManagedCategories(adminClient: any) {
     });
 }
 
-async function disableManagedCategories(adminClient: any) {
-    await adminClient.patchConfig({
-        TeamSettings: {
-            EnableManagedChannelCategories: false,
-        },
-    });
-}
-
 /**
  * Creates a uniquely-named team and user per test and adds the user to the team.
  */
@@ -70,16 +53,22 @@ test.describe('Managed Channel Categories', () => {
     /**
      * @objective Verify that a Channel Admin can assign a managed category to a channel via the channel settings modal,
      * and the category appears in the sidebar with the channel under it.
+     *
+     * @knownIssue ManagedChannelCategories defaults to off, so this spec has never actually run in
+     * CI — it always self-skipped. Now that ensureFeatureFlag restarts the server with the flag on
+     * instead of only skipping, the test runs for real and reveals that assigning a managed_category_name
+     * to a channel has no effect on the sidebar: the channel stays under the regular CHANNELS group and
+     * no managed category header is ever rendered, so grouping, sorting, real-time updates, and the
+     * disabled Favorite/Move To/context-menu states that depend on being in a managed category all fail.
      */
-    test(
+    test.fixme(
         'Channel Admin can assign a managed category via channel settings',
         {tag: '@managed_categories'},
         async ({pw}) => {
-            await pw.skipIfFeatureFlagNotSet('ManagedChannelCategories', true);
-
+            await pw.ensureFeatureFlag('ManagedChannelCategories', true);
             // # Initialize setup with admin user and enterprise license
             const {adminUser, adminClient, team} = await setupManagedCategoriesTest(pw);
-            await skipIfNoEnterpriseLicense(adminClient);
+            await pw.skipIfNoLicense();
             await enableManagedCategories(adminClient);
             await adminClient.addToTeam(team.id, adminUser.id);
 
@@ -127,16 +116,17 @@ test.describe('Managed Channel Categories', () => {
     /**
      * @objective Verify that a Channel Admin can remove a managed category from a channel via the channel settings modal,
      * and the channel returns to the default CHANNELS section.
+     *
+     * @knownIssue See the @knownIssue above - the managed category never appears in the sidebar.
      */
-    test(
+    test.fixme(
         'Channel Admin can remove a managed category via channel settings',
         {tag: '@managed_categories'},
         async ({pw}) => {
-            await pw.skipIfFeatureFlagNotSet('ManagedChannelCategories', true);
-
+            await pw.ensureFeatureFlag('ManagedChannelCategories', true);
             // # Initialize setup and create a channel with a managed category
             const {adminUser, adminClient, team} = await setupManagedCategoriesTest(pw);
-            await skipIfNoEnterpriseLicense(adminClient);
+            await pw.skipIfNoLicense();
             await enableManagedCategories(adminClient);
             await adminClient.addToTeam(team.id, adminUser.id);
 
@@ -188,91 +178,66 @@ test.describe('Managed Channel Categories', () => {
     );
 
     /**
-     * @objective Verify that the managed category selector is not visible in channel settings when the feature is disabled.
+     * @objective Verify that a managed category can be assigned to a channel during creation via the new channel modal.
+     *
+     * @knownIssue See the @knownIssue above - the managed category never appears in the sidebar.
      */
-    test(
-        'managed category selector is not visible when feature is disabled',
+    test.fixme(
+        'managed category can be assigned when creating a new channel',
         {tag: '@managed_categories'},
         async ({pw}) => {
-            await pw.skipIfFeatureFlagNotSet('ManagedChannelCategories', false);
-
-            // # Initialize setup and disable managed categories
+            await pw.ensureFeatureFlag('ManagedChannelCategories', true);
+            // # Initialize setup and enable managed categories
             const {adminUser, adminClient, team} = await setupManagedCategoriesTest(pw);
-            await skipIfNoEnterpriseLicense(adminClient);
-            await disableManagedCategories(adminClient);
+            await pw.skipIfNoLicense();
+            await enableManagedC
```

---

### Incident Patch 2: `af4c3cfd` (2026-10-03)
**Commit Message**: Fix flaky autotranslation e2e tests and duplicate "AI Actions" button (#38965)

* Fix flaky autotranslation 'unsupported language' e2e tests

Avoid changing the test user's locale to 'fr', which also switches
the webapp UI language and broke literal English text assertions
once fr.json gained a translation. Exclude 'en' from TargetLanguages
instead, and re-apply config across reloads to guard against
concurrent initSetup() resets.

Co-authored-by: sabril <[REDACTED_EMAIL]>

* Fix duplicate 'AI Actions' accessible button in AI Actions menu

Co-authored-by: sabril <[REDACTED_EMAIL]>

---------

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: sabril <[REDACTED_EMAIL]>

**File**: `e2e-tests/playwright/specs/functional/channels/autotranslation/autotranslation.spec.ts` (modified, +22/-4)
```diff
@@ -1184,17 +1184,21 @@ test(
         tag: ['@autotranslation'],
     },
     async ({pw}) => {
-        const {adminClient, user, userClient, team} = await pw.initSetup();
+        const {adminClient, user, team} = await pw.initSetup();
 
         const license = await adminClient.getClientLicenseOld();
         test.skip(
             !hasAutotranslationLicense(license.SkuShortName),
             'Skipping test - server does not have Entry or Advanced license',
         );
         const translationUrl = process.env.TRANSLATION_SERVICE_URL || 'http://localhost:3010';
+        // Target languages intentionally exclude 'en' so the test user's default locale is
+        // unsupported. Changing the user's own locale instead (e.g. to 'fr') would also switch
+        // the webapp UI language, breaking the literal English text assertions below as soon as
+        // that locale gets a translation for these strings.
         await enableAutotranslationConfig(adminClient, {
             mockBaseUrl: translationUrl,
-            targetLanguages: ['en', 'es'],
+            targetLanguages: ['es', 'de'],
         });
 
         const channelName = `autotranslation-unsupported-${pw.random.id()}`;
@@ -1207,12 +1211,26 @@ test(
         await enableChannelAutotranslation(adminClient, created.id);
         await adminClient.addToChannel(user.id, created.id);
 
-        await userClient.patchMe({locale: 'fr'});
-
         const {channelsPage, page} = await pw.testBrowser.login(user);
         await channelsPage.goto(team.name, channelName);
         await channelsPage.toBeVisible();
 
+        // Re-apply config + reload to counter concurrent initSetup() resets, re-applying again
+        // right as the page reloads so a CONFIG_CHANGED WebSocket event firing during load
+        // carries our config rather than a stale reset from another parallel worker.
+        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['es', 'de']});
+        await pw.waitUntil(async () => {
+            const cfg = await adminClient.getConfig();
+            return (cfg as any).AutoTranslationSettings?.Enable === true;
+        });
+        await channelsPage.page.reload();
+        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['es', 'de']});
+        await pw.waitUntil(async () => {
+            const cfg = await adminClient.getConfig();
+            return (cfg as any).AutoTranslationSettings?.Enable === true;
+        });
+        await channelsPage.toBeVisible();
+
         await expect(channelsPage.centerView.autotranslationBadge).not.toBeVisible();
 
         await channelsPage.centerView.header.openChannelMenu();
```

**File**: `e2e-tests/playwright/specs/functional/channels/autotranslation/autotranslation_ui.spec.ts` (modified, +17/-7)
```diff
@@ -462,17 +462,21 @@ test(
         tag: ['@autotranslation'],
     },
     async ({pw}) => {
-        const {adminClient, user, userClient, team} = await pw.initSetup();
+        const {adminClient, user, team} = await pw.initSetup();
 
         const license = await adminClient.getClientLicenseOld();
         test.skip(
             !hasAutotranslationLicense(license.SkuShortName),
             'Skipping test - server does not have Entry or Advanced license',
         );
         const translationUrl = process.env.TRANSLATION_SERVICE_URL || 'http://localhost:3010';
+        // Target languages intentionally exclude 'en' so the test user's default locale is
+        // unsupported. Changing the user's own locale instead (e.g. to 'fr') would also switch
+        // the webapp UI language, breaking the literal English text assertions below as soon as
+        // that locale gets a translation for these strings.
         await enableAutotranslationConfig(adminClient, {
             mockBaseUrl: translationUrl,
-            targetLanguages: ['en', 'es'],
+            targetLanguages: ['es', 'de'],
         });
 
         const channelName = `autotranslation-unsupported-${pw.random.id()}`;
@@ -485,21 +489,27 @@ test(
         await enableChannelAutotranslation(adminClient, created.id);
         await adminClient.addToChannel(user.id, created.id);
 
-        await userClient.patchMe({locale: 'fr'});
-
         const {channelsPage, page} = await pw.testBrowser.login(user);
         await channelsPage.goto(team.name, channelName);
         await channelsPage.toBeVisible();
 
         // Re-apply config + reload to ensure the browser reads the latest AutoTranslationSettings.
-        // The badge should still be absent (French locale is not in targetLanguages), but the
-        // server config must be active so the channel header menu shows the "unsupported" notice.
-        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['en', 'es']});
+        // The badge should still be absent ('es'/'de' targets don't include the test user's
+        // default 'en' locale), but the server config must be active so the channel header menu
+        // shows the "unsupported" notice. Re-applying again right as the page reloads ensures a
+        // CONFIG_CHANGED WebSocket event firing during load carries our config rather than a
+        // stale reset from another parallel worker's initSetup().
+        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['es', 'de']});
         await pw.waitUntil(async () => {
             const cfg = await adminClient.getConfig();
             return (cfg as any).AutoTranslationSettings?.Enable === true;
         });
         await channelsPage.page.reload();
+        await enableAutotranslationConfig(adminClient, {mockBaseUrl: translationUrl, targetLanguages: ['es', 'de']});
+        await pw.waitUntil(async () => {
+            const cfg = await adminClient.getConfig();
+            return (cfg as any).AutoTranslationSettings?.Enable === true;
+        });
         await channelsPage.toBeVisible();
 
         await expect(channelsPage.centerView.autotranslationBadge).not.toBeVisible({timeout: 30000});
```

**File**: `webapp/channels/src/components/advanced_text_editor/ai_actions_menu.tsx` (modified, +11/-4)
```diff
@@ -142,15 +142,22 @@ const AIActionsMenu = ({
                 menuButton={{
                     id: 'ai-actions-button',
                     as: 'div',
+                    'aria-label': formatMessage({
+                        id: 'texteditor.ai_actions',
+                        defaultMessage: 'AI Actions',
+                    }),
                     children: (
+
+                        // IconContainer is a real <button>, but the surrounding Menu.Container div
+                        // above is already the accessible menu trigger (role="button"). Hiding this
+                        // inner button from assistive tech avoids exposing two "AI Actions" buttons
+                        // with the same accessible name (nested interactive elements).
                         <IconContainer
                             id='aiActionsMenu'
                             className={classNames('control', {active: isMenuOpen})}
                             type='button'
-                            aria-label={formatMessage({
-                                id: 'texteditor.ai_actions',
-                                defaultMessage: 'AI Actions',
-                            })}
+                            tabIndex={-1}
+                            aria-hidden='true'
                         >
                             <CreationOutlineIcon
                                 size={18}
```

---

### Incident Patch 3: `922a900b` (2026-10-02)
**Commit Message**: Bump @mattermost/compass-ui to 0.1.0-alpha.13 (#38963)

Upgrade compass-ui for cascade-layered tokens, safer multi-copy
plugin coexistence, and other alpha.11–13 improvements. ConfirmModal
Button usage remains compatible.

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>

**File**: `webapp/channels/package.json` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@
     "@guyplusplus/turndown-plugin-gfm": "1.0.7",
     "@hello-pangea/dnd": "18.0.1",
     "@mattermost/client": "12.0.0",
-    "@mattermost/compass-ui": "0.1.0-alpha.10",
+    "@mattermost/compass-ui": "0.1.0-alpha.13",
     "@mattermost/desktop-api": "6.3.0-2",
     "@mattermost/shared": "12.0.0",
     "@mattermost/types": "12.0.0",
```

**File**: `webapp/package-lock.json` (modified, +12/-17)
```diff
@@ -67,7 +67,7 @@
         "@guyplusplus/turndown-plugin-gfm": "1.0.7",
         "@hello-pangea/dnd": "18.0.1",
         "@mattermost/client": "12.0.0",
-        "@mattermost/compass-ui": "0.1.0-alpha.10",
+        "@mattermost/compass-ui": "0.1.0-alpha.13",
         "@mattermost/desktop-api": "6.3.0-2",
         "@mattermost/shared": "12.0.0",
         "@mattermost/types": "12.0.0",
@@ -272,22 +272,6 @@
         "node": "^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0"
       }
     },
-    "channels/node_modules/@mattermost/compass-ui": {
-      "version": "0.1.0-alpha.10",
-      "resolved": "https://registry.npmjs.org/@mattermost/compass-ui/-/compass-ui-0.1.0-alpha.10.tgz",
-      "integrity": "sha512-7E7Z0rhgjjotzSapMbh/H2NIra4mYX9T/UkqyMBANu4KpJwzq0nP8rxnxTSyL2nxZXETD+U6FAmGULDzfVjfMQ==",
-      "peerDependencies": {
-        "@mattermost/compass-icons": "^0.1.63",
-        "react": "^18.2.0 || ^19.0.0",
-        "react-dom": "^18.2.0 || ^19.0.0",
-        "simplebar-react": "^3.3.2"
-      },
-      "peerDependenciesMeta": {
-        "simplebar-react": {
-          "optional": true
-        }
-      }
-    },
     "channels/node_modules/chalk": {
       "version": "4.1.2",
       "resolved": "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz",
@@ -6225,6 +6209,17 @@
       "license": "MIT",
       "peer": true
     },
+    "node_modules/@mattermost/compass-ui": {
+      "version": "0.1.0-alpha.13",
+      "resolved": "https://registry.npmjs.org/@mattermost/compass-ui/-/compass-ui-0.1.0-alpha.13.tgz",
+      "integrity": "sha512-lVw767OfBkXfg6nZ3w4cAngs5EUL30ZpJ62oI7FyJop3ibS3LQB4NCNUMW7+p9IbPD6POmwk3Kp4bdeSs1XvuQ==",
+      "peerDependencies": {
+        "@mattermost/compass-icons": "^0.1.63",
+        "react": "^18.2.0 || ^19.0.0",
+        "react-dom": "^18.2.0 || ^19.0.0",
+        "simplebar-react": "^3.3.2"
+      }
+    },
     "node_modules/@mattermost/components": {
       "resolved": "platform/components",
       "link": true
```

---

### Incident Patch 4: `49b6ccd6` (2026-10-02)
**Commit Message**: [MM-71050] Render tel: links in messages as phone pills (#38901)

**File**: `docs/main/end-user-guide/collaborate/format-messages.mdx` (modified, +8/-0)
```diff
@@ -111,6 +111,14 @@ Create labeled links by putting the desired text in square brackets `[ ]` and th
 
 Renders as: [Check out Mattermost!](https://mattermost.com/)
 
+#### Phone links
+
+Create a link to a phone number by typing `tel:` followed by the number, such as `tel:+15551234567`. To show different text, put the text in square brackets `[ ]` and the `tel:` link in round brackets `( )`.
+
+`[+1 555 123 4567](tel:+15551234567)`
+
+Phone links display with a phone icon. Click or tap a phone link to call the number using your device's default calling app.
+
 ### Headings
 
 Make a heading by typing `#` and a space before your title. For smaller headings, use more `#`'s.
```

**File**: `webapp/channels/package.json` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@
     "lowlight": "3.3.0",
     "luxon": "3.6.1",
     "mark.js": "8.11.1",
-    "marked": "github:mattermost/marked#c211e4ca4a8182f82cc16738d9fbcd7d026ce011",
+    "marked": "github:mattermost/marked#467bc9e99fc75d69424188dfbea7fe0409a9fc15",
     "memoize-one": "6.0.0",
     "moment-timezone": "0.5.38",
     "monaco-editor": "0.52.2",
```

**File**: `webapp/channels/src/components/markdown_phone_link/index.test.tsx` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
+// See LICENSE.txt for license information.
+
+import React from 'react';
+
+import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
+import {RootHtmlPortalId} from 'utils/constants';
+
+import MarkdownPhoneLink from './index';
+
+class TestLinkTooltip extends React.PureComponent<{href: string}> {
+    render() {
+        if (this.props.href.startsWith('tel:')) {
+            return <div>{'Phone tooltip'}</div>;
+        }
+
+        return null;
+    }
+}
+
+describe('MarkdownPhoneLink', () => {
+    test('should render the link with a phone icon and the label text', () => {
+        const {container} = renderWithContext(
+            <MarkdownPhoneLink
+                href='tel:+34600517276'
+                className='theme markdown__link'
+                target='_blank'
+                rel='noreferrer'
+            >
+                {'+34 600 517 276'}
+            </MarkdownPhoneLink>,
+        );
+
+        const link = screen.getByRole('link');
+        expect(link).toHaveAttribute('href', 'tel:+34600517276');
+        expect(link).toHaveAttribute('target', '_blank');
+        expect(link).toHaveAttribute('rel', 'noreferrer');
+        expect(link).toHaveClass('markdown-phone-link', 'theme', 'markdown__link');
+        expect(link).toHaveTextContent('+34 600 517 276');
+        expect(container.querySelector('svg')).toBeInTheDocument();
+    });
+
+    test('should drop the tel: prefix when the text is the raw href', () => {
+        renderWithContext(<MarkdownPhoneLink href='tel:+34600517276'>{'tel:+34600517276'}</MarkdownPhoneLink>);
+
+        expect(screen.getByRole('link')).toHaveTextContent(/^\+34600517276$/);
+    });
+
+    test('should keep a label that happens to start with tel:', () => {
+        renderWithContext(<MarkdownPhoneLink href='tel:+34600517276'>{'tel: call us'}</MarkdownPhoneLink>);
+
+        expect(screen.getByRole('link')).toHaveTextContent('tel: call us');
+    });
+
+    test('should show a call tooltip on hover', async () => {
+        renderWithContext(<MarkdownPhoneLink href='tel:+34600517276'>{'Call the office'}</MarkdownPhoneLink>);
+
+        await userEvent.hover(screen.getByRole('link'));
+        await waitFor(() => {
+            expect(screen.getByText('Click to call +34600517276')).toBeVisible();
+        });
+    });
+
+    test('should show plugin link tooltips on a single link when hasPluginTooltips is set', async () => {
+        const state = {
+            plugins: {
+                components: {
+                    LinkTooltip: [{id: 'test', pluginId: 'example.test', component: TestLinkTooltip}],
+                },
+            },
+        };
+
+        const {container} = renderWithContext(
+            <>
+                <MarkdownPhoneLink
+                    href='tel:+34600517276'
+                    className='theme markdown__link'
+                    hasPluginTooltips={true}
+                >
+                    {'+34600517276'}
+                </MarkdownPhoneLink>
+                <div id={RootHtmlPortalId}/>
+            </>,
+            state,
+        );
+
+        const links = container.querySelectorAll('a');
+        expect(links).toHaveLength(1);
+        expect(links[0]).toHaveAttribute('href', 'tel:+34600517276');
+        expect(links[0]).toHaveClass('markdown-phone-link', 'theme', 'markdown__link');
+        expect(links[0].querySelector('svg')).toBeInTheDocument();
+
+        await userEvent.hover(screen.getByText('+34600517276'));
+        await waitFor(() => {
+            expect(screen.queryByText('Phone tooltip')).toBeVisible();
+        });
+        expect(screen.queryByText(/Click to call/)).not.toBeInTheDocument();
+    });
+});
```

**File**: `webapp/channels/src/components/markdown_phone_link/index.tsx` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
+// See LICENSE.txt for license information.
+
+import classNames from 'classnames';
+import React from 'react';
+import {FormattedMessage} from 'react-intl';
+
+import {PhoneIcon} from '@mattermost/compass-icons/components';
+import {WithTooltip} from '@mattermost/shared/components/tooltip';
+
+import PluginLinkTooltip from 'components/plugin_link_tooltip';
+
+import './markdown_phone_link.scss';
+
+const TEL_PREFIX = 'tel:';
+
+type Props = {
+    href: string;
+    children: React.ReactNode;
+    className?: string;
+    title?: string;
+    target?: string;
+    rel?: string;
+    hasPluginTooltips?: boolean;
+};
+
+export default function MarkdownPhoneLink(props: Props) {
+    const anchorProps = {
+        href: props.href,
+        className: classNames('markdown-phone-link', props.className),
+        title: props.title,
+        target: props.target,
+        rel: props.rel,
+    };
+
+    const content = (
+        <>
+            <PhoneIcon
+                size={12}
+                aria-hidden='true'
+            />
+            <span>{stripTelPrefixFromAutolink(props.href, props.children)}</span>
+        </>
+    );
+
+    // PluginLinkTooltip renders its own anchor, so it replaces ours instead of wrapping it.
+    if (props.hasPluginTooltips) {
+        return (
+            <PluginLinkTooltip nodeAttributes={anchorProps}>
+                {content}
+            </PluginLinkTooltip>
+        );
+    }
+
+    return (
+        <WithTooltip
+            title={
+                <FormattedMessage
+                    id='markdown_phone_link.tooltip'
+                    defaultMessage='Click to call {phoneNumber}'
+                    description='Tooltip shown when hovering a phone number link in a message.'
+                    values={{
+                        phoneNumber: props.href.slice(TEL_PREFIX.length),
+                    }}
+                />
+            }
+        >
+            <a {...anchorProps}>{content}</a>
+        </WithTooltip>
+    );
+}
+
+// Auto-linked numbers show the raw href as their text, so drop the scheme to show just the number.
+function stripTelPrefixFromAutolink(href: string, children: React.ReactNode) {
+    const nodes = React.Children.toArray(children);
+    if (nodes.length === 1 && nodes[0] === href) {
+        return href.slice(TEL_PREFIX.length);
+    }
+
+    return children;
+}
```

**File**: `webapp/channels/src/components/markdown_phone_link/markdown_phone_link.scss` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+.markdown-phone-link {
+    display: inline-flex;
+    align-items: center;
+    padding: 0 4px;
+    border-radius: var(--radius-s);
+    background: rgba(var(--button-bg-rgb), 0.08);
+    gap: 4px;
+
+    &:hover,
+    &:focus {
+        background: rgba(var(--button-bg-rgb), 0.16);
+        text-decoration: none;
+    }
+}
```

**File**: `webapp/channels/src/i18n/en.json` (modified, +4/-0)
```diff
@@ -25383,6 +25383,10 @@
     "defaultMessage": "Mark as read",
     "description": "Title of the confirmation dialog for marking multiple channels as read."
   },
+  "markdown_phone_link.tooltip": {
+    "defaultMessage": "Click to call {phoneNumber}",
+    "description": "Tooltip shown when hovering a phone number link in a message."
+  },
   "marketplace_command.disabled": {
     "defaultMessage": "The marketplace is disabled. Please contact your System Administrator for details.",
     "description": "Error returned when a user runs the /marketplace slash command but the marketplace feature is turned off."
```

**File**: `webapp/channels/src/utils/message_html_to_component.test.tsx` (modified, +62/-0)
```diff
@@ -225,6 +225,68 @@ const myFunction = () => {
         });
     });
 
+    describe('phone links', () => {
+        test('should render markdown tel links using MarkdownPhoneLink', () => {
+            const input = 'Call [+34600517276](tel:+34600517276)';
+            const html = TextFormatting.formatText(input, {}, emptyEmojiMap);
+
+            const {container} = renderWithContext(<>{messageHtmlToComponent(html)}</>);
+
+            const link = container.querySelector('a.markdown-phone-link');
+            expect(link).toBeInTheDocument();
+            expect(link).toHaveAttribute('href', 'tel:+34600517276');
+            expect(link).toHaveTextContent('+34600517276');
+            expect(link?.querySelector('svg')).toBeInTheDocument();
+        });
+
+        test('should render bare tel links using MarkdownPhoneLink without the scheme in the text', () => {
+            const input = 'Call tel:+34600517276';
+            const html = TextFormatting.formatText(input, {}, emptyEmojiMap);
+
+            const {container} = renderWithContext(<>{messageHtmlToComponent(html)}</>);
+
+            const link = container.querySelector('a.markdown-phone-link');
+            expect(link).toBeInTheDocument();
+            expect(link).toHaveAttribute('href', 'tel:+34600517276');
+            expect(link).toHaveTextContent(/^\+34600517276$/);
+        });
+
+        test('should keep trailing punctuation outside bare tel links that start with +', () => {
+            const input = 'Call me at tel:+34600517276.';
+            const html = TextFormatting.formatText(input, {}, emptyEmojiMap);
+
+            const {container} = renderWithContext(<>{messageHtmlToComponent(html)}</>);
+
+            const link = container.querySelector('a.markdown-phone-link');
+            expect(link).toHaveAttribute('href', 'tel:+34600517276');
+            expect(link).toHaveTextContent(/^\+34600517276$/);
+            expect(container).toHaveTextContent('Call me at +34600517276.');
+        });
+
+        test('should render a single phone link anchor when plugin tooltips are enabled', () => {
+            const input = 'Call [+34600517276](tel:+34600517276)';
+            const html = TextFormatting.formatText(input, {}, emptyEmojiMap);
+
+            const {container} = renderWithContext(<>{messageHtmlToComponent(html, {hasPluginTooltips: true})}</>);
+
+            const links = container.querySelectorAll('a');
+            expect(links).toHaveLength(1);
+            expect(links[0]).toHaveClass('markdown-phone-link');
+            expect(links[0]).toHaveAttribute('href', 'tel:+34600517276');
+            expect(links[0].querySelector('svg')).toBeInTheDocument();
+        });
+
+        test('should not render other links using MarkdownPhoneLink', () => {
+            const input = '[example](https://example.com)';
+            const html = TextFormatting.formatText(input, {}, emptyEmojiMap);
+
+            const {container} = renderWithContext(<>{messageHtmlToComponent(html)}</>);
+
+            expect(container.querySelector('a.markdown-phone-link')).not.toBeInTheDocument();
+            expect(container.querySelector('a')).toHaveAttribute('href', 'https://example.com');
+        });
+    });
+
     describe('emojis', () => {
         test('should render valid named emojis as spans with background images', () => {
             const input = 'These are emojis: :taco: :astronaut:';
```

**File**: `webapp/channels/src/utils/message_html_to_component.tsx` (modified, +22/-0)
```diff
@@ -15,6 +15,7 @@ import LatexBlock from 'components/latex_block';
 import LatexInline from 'components/latex_inline';
 import MarkdownImage from 'components/markdown_image';
 import MarkdownListOrdered from 'components/markdown_list_ordered';
+import MarkdownPhoneLink from 'components/markdown_phone_link';
 import PluginLinkTooltip from 'components/plugin_link_tooltip';
 import PostEmoji from 'components/post_emoji';
 import PostEditedIndicator from 'components/post_view/post_edited_indicator';
@@ -155,6 +156,27 @@ export default function messageHtmlToComponent(html: string, options: Options =
         },
     });
 
+    processingInstructions.push({
+        replaceChildren: false,
+        shouldProcessNode: (node: any) =>
+            node.type === 'tag' && node.name === 'a' &&
+            typeof node.attribs?.href === 'string' &&
+            node.attribs.href.toLowerCase().startsWith('tel:'),
+        processNode: (node: any, children: any, index?: number) => (
+            <MarkdownPhoneLink
+                key={`phone-link-${index}`}
+                href={node.attribs.href}
+                className={node.attribs.class}
+                title={node.attribs.title}
+                target={node.attribs.target}
+                rel={node.attribs.rel}
+                hasPluginTooltips={options.hasPluginTooltips}
+            >
+                {children}
+            </MarkdownPhoneLink>
+        ),
+    });
+
     if (options.allowInlineActions) {
         // replaceChildren: false replaces the entire <a> tag (not just its
         // children) — without it the anchor would remain as a wrapper around
```

---

### Incident Patch 5: `b03b5f38` (2026-10-02)
**Commit Message**: MM-70412: Fix SAML IdP metadata pre-fill failing on cacheDuration (#38858)

**File**: `server/channels/app/saml_test.go` (added, +124/-0)
```diff
@@ -0,0 +1,124 @@
+// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
+// See LICENSE.txt for license information.
+
+package app
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+const (
+	testIdpEntityID = "https://idp.example.com/saml"
+	testIdpSSOURL   = "https://idp.example.com/sso"
+	testIdpCert     = "MIICsDCCAhmgAwIBAgIJAODDg4pFEblaMA0GCSqGSIb3DQEBBQUAME8xCzAJBgNV"
+)
+
+func validIDPMetadata(attrs string) string {
+	return `<?xml version="1.0" encoding="UTF-8"?>
+<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="` + testIdpEntityID + `"` + attrs + `>
+  <md:IDPSSODescriptor WantAuthnRequestsSigned="false" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
+    <md:KeyDescriptor use="signing">
+      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
+        <ds:X509Data>
+          <ds:X509Certificate>` + testIdpCert + `</ds:X509Certificate>
+        </ds:X509Data>
+      </ds:KeyInfo>
+    </md:KeyDescriptor>
+    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="` + testIdpSSOURL + `"/>
+  </md:IDPSSODescriptor>
+</md:EntityDescriptor>`
+}
+
+func TestBuildSamlMetadataObject(t *testing.T) {
+	a := &App{}
+
+	t.Run("minimal valid metadata", func(t *testing.T) {
+		data, appErr := a.BuildSamlMetadataObject([]byte(validIDPMetadata("")))
+		require.Nil(t, appErr)
+		assert.Equal(t, testIdpEntityID, data.IdpDescriptorURL)
+		assert.Equal(t, testIdpSSOURL, data.IdpURL)
+		assert.Equal(t, testIdpCert, data.IdpPublicCertificate)
+	})
+
+	t.Run("cacheDuration on EntityDescriptor", func(t *testing.T) {
+		// PingFederate emits cacheDuration="PT1440M" by default (xs:duration).
+		data, appErr := a.BuildSamlMetadataObject([]byte(validIDPMetadata(` cacheDuration="PT1440M"`)))
+		require.Nil(t, appErr)
+		assert.Equal(t, testIdpEntityID, data.IdpDescriptorURL)
+		assert.Equal(t, testIdpSSOURL, data.IdpURL)
+		assert.Equal(t, testIdpCert, data.IdpPublicCertificate)
+	})
+
+	t.Run("cacheDuration on IDPSSODescriptor", func(t *testing.T) {
+		xml := `<?xml version="1.0" encoding="UTF-8"?>
+<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="` + testIdpEntityID + `">
+  <md:IDPSSODescriptor WantAuthnRequestsSigned="false" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" cacheDuration="PT1440M">
+    <md:KeyDescriptor use="signing">
+      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
+        <ds:X509Data>
+          <ds:X509Certificate>` + testIdpCert + `</ds:X509Certificate>
+        </ds:X509Data>
+      </ds:KeyInfo>
+    </md:KeyDescriptor>
+    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="` + testIdpSSOURL + `"/>
+  </md:IDPSSODescriptor>
+</md:EntityDescriptor>`
+		data, appErr := a.BuildSamlMetadataObject([]byte(xml))
+		require.Nil(t, appErr)
+		assert.Equal(t, testIdpEntityID, data.IdpDescriptorURL)
+		assert.Equal(t, testIdpSSOURL, data.IdpURL)
+		assert.Equal(t, testIdpCert, data.IdpPublicCertificate)
+	})
+
+	t.Run("validUntil without timezone", func(t *testing.T) {
+		// xs:dateTime allows values without a timezone; RFC 3339 does not.
+		data, appErr := a.BuildSamlMetadataObject([]byte(validIDPMetadata(` validUntil="2027-01-01T00:00:00"`)))
+		require.Nil(t, appErr)
+		assert.Equal(t, testIdpEntityID, data.IdpDescriptorURL)
+		assert.Equal(t, testIdpSSOURL, data.IdpURL)
+		assert.Equal(t, testIdpCert, data.IdpPublicCertificate)
+	})
+
+	t.Run("missing IDPSSODescriptor", func(t *testing.T) {
+		xml := `<?xml version="1.0"?>
+<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://sp.example.com">
+  <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"/>
+</md:EntityDescriptor>`
+		_, appErr := a.BuildSamlMetadataObject([]byte(xml))
+		require.NotNil(t, appErr)
+		assert.Equal(t, "api.admin.saml.invalid_xml_missing_idpssodescriptors.app_error", appErr.Id)
+	})
+
+	t.Run("missing SingleSignOnService", func(t *testing.T) {
+		xml := `<?xml version="1.0"?>
+<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="` + testIdpEntityID + `">
+  <md:IDPSSODescriptor WantAuthnRequestsSigned="false" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
+    <md:KeyDescriptor use="signing">
+      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
+        <ds:X509Data>
+          <ds:X509Certificate>` + testIdpCert + `</ds:X509Certificate>
+        </ds:X509Data>
+      </ds:KeyInfo>
+    </md:KeyDescriptor>
+  </md:IDPSSODescriptor>
+</md:EntityDescriptor>`
+		_, appErr := a.BuildSamlMetadataObject([]byte(xml))
+		require.NotNil(t, appErr)
+		assert.Equal(t, "api.admin.saml.invalid_xml_missing_ssoservices.app_error", appErr.Id)
+	})
+
+	t.Run("missing KeyDescriptor", func(t *testing.T) {
+		xml := `<?xml version="1.0"?>
+<md:En
```

**File**: `server/public/model/saml.go` (modified, +13/-9)
```diff
@@ -125,10 +125,12 @@ type KeyDescriptor struct {
 }
 
 type RoleDescriptor struct {
-	XMLName                    xml.Name
-	ID                         string          `xml:",attr,omitempty"`
-	ValidUntil                 time.Time       `xml:"validUntil,attr,omitempty"`
-	CacheDuration              time.Duration   `xml:"cacheDuration,attr,omitempty"`
+	XMLName xml.Name
+	ID      string `xml:",attr,omitempty"`
+	// Deprecated: no longer populated from metadata.
+	ValidUntil time.Time `xml:"-"`
+	// Deprecated: no longer populated from metadata.
+	CacheDuration              time.Duration   `xml:"-"`
 	ProtocolSupportEnumeration string          `xml:"protocolSupportEnumeration,attr"`
 	ErrorURL                   string          `xml:"errorURL,attr,omitempty"`
 	KeyDescriptors             []KeyDescriptor `xml:"KeyDescriptor,omitempty"`
@@ -164,11 +166,13 @@ type Organization struct {
 }
 
 type EntityDescriptor struct {
-	XMLName           xml.Name           `xml:"urn:oasis:names:tc:SAML:2.0:metadata EntityDescriptor"`
-	EntityID          string             `xml:"entityID,attr"`
-	ID                string             `xml:",attr,omitempty"`
-	ValidUntil        time.Time          `xml:"validUntil,attr,omitempty"`
-	CacheDuration     time.Duration      `xml:"cacheDuration,attr,omitempty"`
+	XMLName  xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:metadata EntityDescriptor"`
+	EntityID string   `xml:"entityID,attr"`
+	ID       string   `xml:",attr,omitempty"`
+	// Deprecated: no longer populated from metadata.
+	ValidUntil time.Time `xml:"-"`
+	// Deprecated: no longer populated from metadata.
+	CacheDuration     time.Duration      `xml:"-"`
 	RoleDescriptors   []RoleDescriptor   `xml:"RoleDescriptor"`
 	IDPSSODescriptors []IDPSSODescriptor `xml:"IDPSSODescriptor"`
 	Organization      Organization       `xml:"Organization"`
```

---

### Incident Patch 6: `cb7a69a1` (2026-10-02)
**Commit Message**: Align channel attribute chips and fix header label flicker (#38841)

* Align channel attribute chips and stop header label flicker.

Make hierarchical and select/rank chips share AttributeChip chrome in channel info, and stabilize header overflow measurement so squeezed channel names do not re-expand chips.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* Hide channel attribute chip dismiss until the value menu is open.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* Collapse hidden chip dismiss so resting chips do not reserve trailing space.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* Keep text attribute edit size aligned with the resting value.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* Fix stylelint property order in channel attribute SCSS.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* Cache chip widths before collapsing on zero available space.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* Fix multiselect outside-click close and chip-remove keyboard activation.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* Fix stylelint property order on AttributeChip remove control.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* Fix graph picker disabled assertions and label activation.

Div Me

**File**: `e2e-tests/playwright/specs/functional/channels/channel_attributes/channel_attribute_editing.spec.ts` (modified, +9/-8)
```diff
@@ -519,10 +519,10 @@ test.describe('Channel attribute editing', {tag: ['@channel_attributes']}, () =>
     });
 
     /**
-     * @objective Verify a single-select value offers no clear control beside its chip, and
-     * is cleared from the option menu instead.
+     * @objective Verify a single-select value clears from the chip remove control, not a
+     * Clear menu item.
      */
-    test('clears a single-select value from its menu rather than a control beside the chip', async ({pw}) => {
+    test('clears a single-select value from its chip remove control', async ({pw}) => {
         await pw.skipIfNoLicense();
         await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);
 
@@ -556,12 +556,13 @@ test.describe('Channel attribute editing', {tag: ['@channel_attributes']}, () =>
             const info = await channelsPage.openChannelInfo();
             await expect(info.attributes.chip(marking.name)).toHaveText('SECRET');
 
-            // * Nothing but the value's own trigger sits in the row
-            await expect(info.attributes.row(marking.name).getByRole('button', {name: /^Clear /})).toHaveCount(0);
-
-            // # Clear it from the option menu
+            // * No Clear menu item — clear lives on the chip
             await info.attributes.startEditing(marking.name);
-            await channelsPage.page.getByRole('menuitem', {name: /^Clear /}).click();
+            await expect(channelsPage.page.getByRole('menuitem', {name: /^Clear /})).toHaveCount(0);
+            await channelsPage.page.keyboard.press('Escape');
+
+            // # Clear it from the chip remove control
+            await info.attributes.deselect(marking.name, 'SECRET');
 
             // * The value is gone from the store
             await expect
```

**File**: `webapp/channels/src/components/admin_console/access_control/editors/table_editor/table_editor_graph.test.tsx` (modified, +1/-1)
```diff
@@ -869,7 +869,7 @@ describe('TableEditor - graph attributes with the hierarchy picker', () => {
         });
 
         expect(screen.getByLabelText('Hidden values that you do not have permission to view')).toBeInTheDocument();
-        expect(screen.getByTestId('valueSelectorMenuButton')).toBeDisabled();
+        expect(screen.getByTestId('valueSelectorMenuButton')).toHaveAttribute('aria-disabled', 'true');
         expect(mockPageAll).not.toHaveBeenCalled();
     });
 
```

**File**: `webapp/channels/src/components/admin_console/system_user_detail/system_user_detail.test.tsx` (modified, +7/-7)
```diff
@@ -1052,7 +1052,7 @@ describe('SystemUserDetail', () => {
 
                 await waitForLoadingToFinish();
 
-                expect(trigger()).toBeDisabled();
+                expect(trigger()).toHaveAttribute('aria-disabled', 'true');
                 expect(screen.getByText('Synced with:')).toBeInTheDocument();
                 expect(fieldContainer()).not.toHaveTextContent(OMITTED_COPY);
             });
@@ -1066,7 +1066,7 @@ describe('SystemUserDetail', () => {
 
                 await waitForLoadingToFinish();
 
-                expect(trigger()).toBeDisabled();
+                expect(trigger()).toHaveAttribute('aria-disabled', 'true');
                 expect(fieldContainer()).toHaveTextContent('Managed by plugin');
             });
 
@@ -1079,7 +1079,7 @@ describe('SystemUserDetail', () => {
 
                 await waitForLoadingToFinish();
 
-                expect(trigger()).toBeDisabled();
+                expect(trigger()).toHaveAttribute('aria-disabled', 'true');
                 expect(screen.getByText('Synced with:')).toBeInTheDocument();
             });
 
@@ -1089,7 +1089,7 @@ describe('SystemUserDetail', () => {
 
                 await waitForLoadingToFinish();
 
-                expect(trigger()).toBeEnabled();
+                expect(trigger()).not.toHaveAttribute('aria-disabled', 'true');
                 await waitFor(() => expect(trigger()).toHaveTextContent('Alpha'));
             });
 
@@ -1123,9 +1123,9 @@ describe('SystemUserDetail', () => {
 
             test('G17: opens the menu when the field label is clicked', async () => {
                 // The field name is a <label htmlFor> pointing at the trigger,
-                // so clicking the name opens the menu. The picker itself is not
-                // wrapped in that label: chip-remove lives inside the trigger
-                // button, and a wrapping <label> would steal those clicks.
+                // with a click forwarder because the Menu trigger is a div
+                // (chip-remove lives inside it). The picker itself is not wrapped
+                // in that label: a wrapping <label> would steal chip-remove clicks.
                 mockPageAll.mockResolvedValue(REGIME_1);
                 renderDetail(buildGraphField({options_omitted: true}), ['opt-1']);
 
```

**File**: `webapp/channels/src/components/admin_console/system_user_detail/system_user_detail.tsx` (modified, +13/-4)
```diff
@@ -1020,7 +1020,15 @@ export class SystemUserDetail extends PureComponent<Props, State> {
         const fieldBody = (
             <>
                 {field.type === 'graph' ? (
-                    <label htmlFor={`cpa-graph-button-${field.id}`}>
+                    <label
+                        htmlFor={`cpa-graph-button-${field.id}`}
+                        onClick={() => {
+                            // Graph Menu triggers are <div role="button"> so chip
+                            // removes can be real buttons. Divs are not labelable,
+                            // so htmlFor alone does not open the menu — click it.
+                            document.getElementById(`cpa-graph-button-${field.id}`)?.click();
+                        }}
+                    >
                         {fieldName}
                     </label>
                 ) : fieldName}
@@ -1032,9 +1040,10 @@ export class SystemUserDetail extends PureComponent<Props, State> {
             </>
         );
 
-        // A graph picker is a button with chip-remove controls inside it. Wrapping
-        // that in <label> forwards chip clicks to the trigger, so the X opens the
-        // menu instead of removing the value. Point the name at the trigger instead.
+        // A graph picker is a div trigger with chip-remove buttons inside it.
+        // Wrapping that in <label> forwards chip clicks to the trigger, so the X
+        // opens the menu instead of removing the value. Point the name at the
+        // trigger instead (with a click forwarder — divs are not labelable).
         if (field.type === 'graph') {
             return (
                 <div
```

**File**: `webapp/channels/src/components/admin_console/team_channel_settings/channel/details/__snapshots__/channel_details.test.tsx.snap` (modified, +2/-2)
```diff
@@ -189,7 +189,7 @@ exports[`admin_console/team_channel_settings/channel/ChannelDetails should match
                     >
                       When enabled, adding and removing users from groups will add or remove them from this channel. The only way of inviting members to this channel is by adding the groups they belong to. 
                       <a
-                        href="https://www.mattermost.com/pl/default-ldap-group-constrained-team-channel.html?utm_source=mattermost&utm_medium=in-product&utm_content=channel_modes&uid=&sid=&edition=team&server_version="
+                        href="https://mattermost.com/pl/default-ldap-group-constrained-team-channel.html?utm_source=mattermost&utm_medium=in-product&utm_content=channel_modes&uid=&sid=&edition=team&server_version="
                         location="channel_modes"
                         rel="noopener noreferrer"
                         target="_blank"
@@ -632,7 +632,7 @@ exports[`admin_console/team_channel_settings/channel/ChannelDetails should match
                     >
                       When enabled, adding and removing users from groups will add or remove them from this channel. The only way of inviting members to this channel is by adding the groups they belong to. 
                       <a
-                        href="https://www.mattermost.com/pl/default-ldap-group-constrained-team-channel.html?utm_source=mattermost&utm_medium=in-product&utm_content=channel_modes&uid=&sid=&edition=team&server_version="
+                        href="https://mattermost.com/pl/default-ldap-group-constrained-team-channel.html?utm_source=mattermost&utm_medium=in-product&utm_content=channel_modes&uid=&sid=&edition=team&server_version="
                         location="channel_modes"
                         rel="noopener noreferrer"
                         target="_blank"
```

**File**: `webapp/channels/src/components/admin_console/team_channel_settings/channel/details/__snapshots__/channel_modes.test.tsx.snap` (modified, +1/-1)
```diff
@@ -153,7 +153,7 @@ exports[`admin_console/team_channel_settings/channel/ChannelModes should match s
               >
                 When enabled, adding and removing users from groups will add or remove them from this channel. The only way of inviting members to this channel is by adding the groups they belong to. 
                 <a
-                  href="https://www.mattermost.com/pl/default-ldap-group-constrained-team-channel.html?utm_source=mattermost&utm_medium=in-product&utm_content=channel_modes&uid=&sid=&edition=team&server_version="
+                  href="https://mattermost.com/pl/default-ldap-group-constrained-team-channel.html?utm_source=mattermost&utm_medium=in-product&utm_content=channel_modes&uid=&sid=&edition=team&server_version="
                   location="channel_modes"
                   rel="noopener noreferrer"
                   target="_blank"
```

**File**: `webapp/channels/src/components/admin_console/team_channel_settings/channel/details/channel_modes.tsx` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ const SyncGroupsToggle = (props: Props): JSX.Element => {
                     values={{
                         link: (msg: React.ReactNode) => (
                             <ExternalLink
-                                href='https://www.mattermost.com/pl/default-ldap-group-constrained-team-channel.html'
+                                href='https://mattermost.com/pl/default-ldap-group-constrained-team-channel.html'
                                 location='channel_modes'
                             >
                                 {msg}
```

**File**: `webapp/channels/src/components/admin_console/team_channel_settings/team/details/team_modes.tsx` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ const SyncGroupsToggle = ({syncChecked, allAllowedChecked, allowedDomainsChecked
                 values={{
                     link: (msg) => (
                         <ExternalLink
-                            href='https://www.mattermost.com/pl/default-ldap-group-constrained-team-channel.html'
+                            href='https://mattermost.com/pl/default-ldap-group-constrained-team-channel.html'
                             location='team_modes'
                         >
                             {msg}
```

---

### Incident Patch 7: `1638ff81` (2026-10-02)
**Commit Message**: ci: bump glibc-openssl-fips digests for Docker FIPS build (#38949)

Inactive 16-dev pin broke apk add via virtualapk after Chainguard refreshed the image.

**File**: `server/build/Dockerfile.fips` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 # First stage - FIPS dev image with dependencies for building
-FROM cgr.dev/mattermost.com/glibc-openssl-fips:16-dev@sha256:e971e3eb6b5ffd227e17d0fa7944e3430d3e8e24e9587d5488a833139629ab0f AS builder
+FROM cgr.dev/mattermost.com/glibc-openssl-fips:16-dev@sha256:e630aa623f8b0f39c1a06354cdc3f07d8ea22b53e02e1ee9e0fce4c41b498801 AS builder
 # Setting bash as our shell, and enabling pipefail option
 SHELL ["/bin/bash", "-o", "pipefail", "-c"]
 
```

---

### Incident Patch 8: `2e626276` (2026-10-01)
**Commit Message**: Restructure Slack migration guide end to end (#37911)

* MM-69567: Document what does and doesn't migrate from Slack.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* MM-69567: Clarify Slack migration coverage from review feedback.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* MM-69562–MM-69570: Restructure Slack migration guide end to end.

Rewrite migrate-from-slack into a prepare → export → transform → import flow with coverage, Grid, emails, guests, and large-import guidance.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* Fix mmctl channel-move link to use extensionless docs URL.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* MM-69562: Document org-wide DM handling in grid-transform.

Add a FAQ entry explaining that grid-transform has no special handling
for org-wide conversations: root-level dms.json and mpims.json entries
are assigned to the workspace named on the first post carrying a team
field, so a cross-workspace DM lands in exactly one Mattermost team.

Cover the two practical consequences: participants from the other
workspace import as deactivated <USERID>@local placeholder accounts,
and conversations that cannot be assigned are logged to
grid-transform-slack.log and dropp

**File**: `docs/main/administration-guide/onboard/migrate-from-rocketchat.mdx` (modified, +6/-8)
```diff
@@ -13,7 +13,7 @@ The migration is a multi-step process:
 
 1.  [Preparations](#1-preparations) — scope the migration, gather MongoDB and attachment-storage details, and prepare the Mattermost server.
 2.  [Export your Rocket.Chat data](#2-export-your-rocketchat-data) — produce a `mongodump` of the Rocket.Chat database.
-3.  [Transform the export](#3-transform-the-export-for-mattermost) — validate with `mmetl check rocketchat` and convert with `mmetl transform rocketchat`.
+3.  [Transform the export](#3-transform-the-export-for-mattermost) — validate with `mmetl transform rocketchat --dry-run`, then run the full transform.
 4.  [Import into Mattermost](#4-import-into-mattermost) — upload and process the archive with `mmctl`.
 5.  [Validate, test, and go live](#5-validate-test-and-go-live) — verify the trial import before scheduling the production cutover.
 
@@ -84,19 +84,17 @@ If your deployment uses **FileSystem** storage for attachments, also copy the Ro
 
 ## 3. Transform the export for Mattermost
 
-[Download the latest release of mmetl](https://github.com/mattermost/mmetl/releases/) for your OS and architecture. Run `mmetl help` to learn more about the tool.
+[Download the latest mmetl release](https://github.com/mattermost/mmetl/releases/) for your OS and architecture. Run `mmetl help` to learn more about the tool.
 
 ### Validate the export
 
-Before transforming, check the integrity of the dump:
+Before the full transform, run the same command with `--dry-run`. Set `--team` to your destination team and include any flags you plan to use for the full run, such as `--uploads-dir` for FileSystem attachments, `--guest-handling`, and `--bot-owner` if the export contains bots:
 
 ``` sh
-./mmetl check rocketchat --dump-dir /tmp/rc-dump/meteor
+./mmetl transform rocketchat --team <TEAM-NAME> --dump-dir /tmp/rc-dump/meteor --output mattermost_import.jsonl --dry-run
 ```
 
-This reports structural issues (for example, missing required collections or invalid records) that would cause the transform or import to fail. Details are written to `check-rocketchat.log`.
-
-`check rocketchat` accepts the same `--guest-handling` flag as the transform, so you can preview how guest users will be treated before running the full transform.
+Dry-run parses and transforms the dump without writing JSONL or copying attachments. It logs warnings and errors to the terminal and exits non-zero if it finds problems, including missing attachments that a full transform would skip. Fix reported issues before the full run. Use `--skip-attachments` only if you intend to skip attachment checks and extraction in the full run.
 
 ### Run the transform
 
@@ -300,4 +298,4 @@ Because resolution happens at render time, you can add custom emoji to Mattermos
 
 **How do I handle a very large import?** Use the file store method — copy the archive directly into the server's `data/import` directory rather than uploading through `mmctl`. See [Large imports](#large-imports-file-store-method).
 
-**I hit a parse error. Is my export broken?** Possibly not. Rocket.Chat changes its MongoDB schema between versions (this tool was validated against v8.5). Run `mmetl check rocketchat` first, and check for a newer `mmetl` release before assuming the data is at fault.
+**I hit a parse error. Is my export broken?** Possibly not. Rocket.Chat changes its MongoDB schema between versions (this tool was validated against v8.5). Re-run `mmetl transform rocketchat --dry-run` with the same flags as the full transform, and check for a newer `mmetl` release before assuming the data is at fault.
```

**File**: `docs/main/administration-guide/onboard/migrate-from-slack.mdx` (modified, +444/-245)
```diff
@@ -3,261 +3,427 @@ title: "Slack Migration Guide"
 ---
 <PlanAvailability slug="all-commercial" />
 
-Evaluating the move from Slack? Start with the high-level [migration overview](/administration-guide/onboard/slack-migration-overview), then return here for implementation steps.
-
 ## Overview
 
 Mattermost provides a reliable migration path from Slack, enabling you to bring your organization’s collaboration history into a secure, self-hosted Mattermost environment. The migration process supports full workspaces, including users, channels and message history, direct messages, and threads so your teams can continue working without losing valuable context.
 
-This process generally involves preparing your environment, exporting data from Slack, converting that data into a compatible format, and then importing it into Mattermost. Migrating from Slack is a multi-step process that can be complex, particularly for larger organizations or those with multiple Slack workspaces.
-
-Additionally, please consider that Slack's data control policies or export capabilities may change at any time, or they may charge fees to customers for exporting data stored in Slack. Support for negotiating export of customer IP from Slack Enterprise can be requested by contacting a [Mattermost Expert](https://mattermost.com/contact-sales/).
-
-1.  [Preparations](#1-preparations):
-    - Answer key scoping questions.
-    - Gather environment and export details.
-    - Validate Mattermost server capacity and configuration.
-    - Back up your Mattermost environment before importing.
-2.  [Export Slack data](#2-export-slack-data):
-    - Generate an export from Slack.
-3.  [Transform the export for Mattermost](#3-transform-the-export-for-mattermost):
-    - Validate the Slack export using `mmetl check slack`.
-    - Use the `mmetl` tool to parse and transform Slack exports.
-4.  [Import into Mattermost](#4-import-data-into-mattermost):
-    - Upload and process transformed archives with `mmctl`.
-5.  Validate and test:
-    - Confirm channel and user data imported correctly.
-    - Run database queries to fix any unread states.
-6.  Go live:
-    - Communicate the cutover plan to users.
+<Note>
 
-### Migration timeline
+Evaluating the move from Slack? Start with the high-level [migration overview](/administration-guide/onboard/slack-migration-overview), then return here for implementation steps.
 
-These instructions outline a *best effort* migration path designed to preserve the majority of your messages, files, and workspace structure. Mattermost provides tools and guidance to help streamline the process, but manual adjustments during the data transformation and import steps are often required. Successful migration depends on careful planning and dedicating sufficient time, technical resources, and technical skills to the effort.
+</Note>
 
-Depending on the size and complexity of your Slack environment, a full migration can take anywhere from several days to multiple weeks of dedicated effort. Larger organizations with multiple workspaces, extensive message history, and many files should expect the process to require significant iteration and testing before completion. It’s important to plan for this timeline in advance by allocating the necessary resources, scheduling time for trial imports in a development environment, and coordinating across teams. Building in extra time for adjustments during the transformation and import steps will help ensure a smoother transition and reduce disruption to your users.
+This process involves preparing your environment, exporting data from Slack, converting that data into a compatible format, and then importing it into Mattermost.
 
-Scoping the migration appropriately during the preparation step can significantly reduce processing time and allow for faster iteration. Before beginning, carefully consider what data is essential to bring over to Mattermost. Many organizations find that not every channel or file needs to be migrated, and focusing only on what is truly needed can save substantial processing time and manual effort. By setting clear boundaries early, you’ll minimize the amount of data that requires manual intervention and testing, which in turn shortens the migration timeline and helps avoid unnecessary complexity.
+1. [Understand Slack to Mattermost feature mapping](#what-migrates--what-doesnt):
+    - Review how workspaces, channels, conversations, posts, users, and integrations migrate.
+2. [Prepare your Mattermost environment](#2-prepare-your-mattermost-environment):
+    - Scope history, export size, and attachments.
+    - Confirm infrastructure and Mattermost server settings.
+    - Back up your Mattermost environment before importing.
+3. [Export data from Slack](#3-export-your-data-from-slack):
+    - Generate an export using Slack’s tools and documentation.
+    - Identify whether you have a single-workspace or Enterprise Grid export.
+4. [Transform the Slack export with `mme
```

---

### Incident Patch 9: `ac3b3318` (2026-10-01)
**Commit Message**: [MM-71072] Fix broken Security Bulletin signup link on Security Updates docs page (#38928)

The Security Bulletin signup link pointed at
https://mattermost.com/security-updates/#sign-up. That page now
301-redirects to https://docs.mattermost.com/security-guide/security-updates,
so readers were bounced back to the page they started on and never reached a
signup form. Point the link at the Security Bulletin section of the
responsible disclosure page instead.

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: mattermost-code <[REDACTED_EMAIL]>

**File**: `docs/main/security-guide/security-updates.mdx` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ hide_table_of_contents: true
 
 This bulletin lists publicly disclosed security issues for Mattermost Server, Desktop, Mobile, and Plugins after a fix is available. Use the table to check whether an advisory affects your deployment and which release contains the fix. Filter by product, severity, issue ID, date, or affected version.
 
-To report a vulnerability, follow the [Responsible Disclosure Policy](https://mattermost.com/security-vulnerability-report/). Subscribe to fix-release notifications on the [Security Bulletin signup](https://mattermost.com/security-updates/#sign-up).
+To report a vulnerability, follow the [Responsible Disclosure Policy](https://mattermost.com/security-vulnerability-report/). Subscribe to fix-release notifications on the [Security Bulletin signup](https://mattermost.com/company/responsible-disclosure/#security-bulletin).
 
 <Note>
 Specific details on security updates are announced 30 days after the fix is available. Mattermost has a [mandatory upgrade policy](/administration-guide/upgrade/upgrading-mattermost-server) and provides updates for supported releases.
```

---

### Incident Patch 10: `f747d624` (2026-09-30)
**Commit Message**: Fix Attribute Management listing permissions, Classification license gate, and sync-source cascade (#38830)

* Honor Attribute Management page disabled state on the listing

Wire the schema isDisabled prop through GlobalAttributes so non-sysadmins
see a disabled New attribute button, View instead of Edit, and a disabled
Delete action. Also align the Classification row license gate with the
Classification Markings route (Enterprise Advanced).

Co-authored-by: Julien Tant <[REDACTED_EMAIL]>

* Point Attribute-Based Access help links at Attribute Management

The old system_attributes/user_attributes URLs only redirect now. Update
the ABAC enable help text and related empty-state CTAs to manage_attributes
and rename the link label to Attribute Management.

Co-authored-by: Julien Tant <[REDACTED_EMAIL]>

* Cascade template LDAP/SAML sync source edits to linked Users fields

LDAP sync reads attrs.ldap/attrs.saml on the Users field, which were only
copied from the template at create time. When Save updates the template
sync source, also PATCH the already-linked Users field so existing sync
mappings stay in sync.

Co-authored-by: Julien Tant <[REDACTED_EMAIL]>

* Add Playwright coverage fo

**File**: `e2e-tests/playwright/specs/functional/system_console/global_attributes/global_attributes_form.spec.ts` (modified, +89/-0)
```diff
@@ -720,6 +720,95 @@ test.describe('System Console - Global Attributes form', {tag: '@system_console'
             }
         });
 
+        /**
+         * @objective Ensure changing a template's AD/LDAP sync source on Save also updates the
+         * already-linked Users field. LDAP sync reads attrs.ldap on the Users field (copied only
+         * at create), so a template-only edit would otherwise leave sync on the stale mapping.
+         */
+        test('cascades an edited AD/LDAP sync source onto an already-linked Users field on Save', async ({pw}) => {
+            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
+
+            const timestamp = Date.now();
+            const name = `e2e_sync_cascade_${timestamp}`;
+            const displayName = `Playwright Sync Cascade ${timestamp}`;
+
+            try {
+                const template = await createGlobalAttributeField(adminClient, name, {
+                    type: 'text',
+                    attrs: {display_name: displayName, ldap: 'oldDept'},
+                });
+                await createLinkedDependentField(adminClient, name, template.id, 'text', 'user', {
+                    display_name: displayName,
+                });
+
+                // * Create copied ldap onto the Users field (the sync mapping LDAP actually reads)
+                let linkedFields = await fetchLinkedFieldsForTemplate(adminClient, template.id);
+                let userField = linkedFields.find((f) => f.object_type === 'user');
+                expect(userField?.attrs?.ldap).toBe('oldDept');
+
+                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
+                const {page} = systemConsolePage;
+                await page.goto(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}/attribute_details/${template.id}`);
+
+                // # Edit the AD/LDAP chip to a new directory attribute and save
+                await page.getByTestId('attributeExternalSourceChip-ldap-edit').click();
+                const input = page.getByPlaceholder('department');
+                await expect(input).toHaveValue('oldDept');
+                await input.fill('newDept');
+                await page.getByRole('button', {name: 'Save'}).click();
+                await expect(page.getByTestId('attributeExternalSourceChip-ldap')).toHaveText('AD/LDAP: newDept');
+
+                await page.getByTestId('saveSetting').click();
+                await expect(page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));
+
+                // * The linked Users field's attrs.ldap moved with the template — not left at oldDept
+                linkedFields = await fetchLinkedFieldsForTemplate(adminClient, template.id);
+                userField = linkedFields.find((f) => f.object_type === 'user');
+                expect(userField?.attrs?.ldap).toBe('newDept');
+            } finally {
+                await deleteAppliesToAttributeAndLinkedFieldsIfExists(adminClient, name);
+            }
+        });
+
+        /**
+         * @objective Ensure clearing a template's AD/LDAP sync source on Save also clears it on
+         * the already-linked Users field, so LDAP sync stops writing that field.
+         */
+        test('clears ldap on an already-linked Users field when the template sync source is removed', async ({pw}) => {
+            const {adminUser, adminClient} = await requireGlobalAttributesEnabled(pw);
+
+            const timestamp = Date.now();
+            const name = `e2e_sync_clear_${timestamp}`;
+            const displayName = `Playwright Sync Clear ${timestamp}`;
+
+            try {
+                const template = await createGlobalAttributeField(adminClient, name, {
+                    type: 'text',
+                    attrs: {display_name: displayName, ldap: 'oldDept'},
+                });
+                await createLinkedDependentField(adminClient, name, template.id, 'text', 'user', {
+                    display_name: displayName,
+                });
+
+                const {systemConsolePage} = await pw.testBrowser.login(adminUser);
+                const {page} = systemConsolePage;
+                await page.goto(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}/attribute_details/${template.id}`);
+
+                // # Remove the AD/LDAP link and save
+                await page.getByTestId('attributeExternalSourceChip-ldap-remove').click();
+                await expect(page.getByTestId('attributeExternalSourceChip-ldap')).toHaveCount(0);
+                await page.getByTestId('saveSetting').click();
+                await expect(page).toHaveURL(new RegExp(`${GLOBAL_ATTRIBUTES_ADMIN_PATH}$`));
+
+                // * Users field no longer carries attrs.ldap (empty/absent — sync will skip it)
+                const linkedFields = await fetchLinkedFieldsForTemplate(adminClient, template.id);
+                const userField = linkedFields.find((f) => f.object_type === 'user');
+                expect(userField?.attrs?.ldap 
```

**File**: `e2e-tests/playwright/specs/functional/system_console/global_attributes/global_attributes_listing.spec.ts` (modified, +59/-0)
```diff
@@ -690,4 +690,63 @@ test.describe('System Console - Global Attributes listing', {tag: '@system_conso
             }
         });
     });
+
+    test.describe('read-only for non-sysadmin', () => {
+        /**
+         * @objective Ensure a system_manager (non-sysadmin with System Console access) sees
+         * Attribute Management as read-only: New attribute disabled, row menu offers View
+         * instead of Edit, and Delete is disabled. The create/edit page they can still open
+         * is already schema-gated as read-only; this covers the listing that previously
+         * ignored isDisabled.
+         */
+        test('disables New attribute and Delete, and offers View, for a system_manager', async ({pw}) => {
+            const {adminClient} = await requireGlobalAttributesEnabled(pw);
+            const {user: systemManagerUser} = await pw.initSetup();
+
+            const timestamp = Date.now();
+            const name = `e2e_global_attribute_readonly_${timestamp}`;
+            const displayName = `E2E Readonly Attribute ${timestamp}`;
+
+            try {
+                await adminClient.updateUserRoles(systemManagerUser.id, 'system_user system_manager');
+
+                const field = await createGlobalAttributeField(adminClient, name, {
+                    type: 'text',
+                    attrs: {display_name: displayName},
+                });
+
+                const {systemConsolePage} = await pw.testBrowser.login(systemManagerUser);
+                const {page} = systemConsolePage;
+                await page.goto(GLOBAL_ATTRIBUTES_ADMIN_PATH);
+                await expect(page).toHaveURL(/manage_attributes/);
+
+                // * New attribute is disabled — schema isDisabled wires through the listing
+                await expect(page.getByTestId('newAttributeButton')).toBeDisabled();
+
+                const row = page.locator('tr', {
+                    has: page.getByTestId('global-attribute-name').filter({hasText: displayName}),
+                });
+                await expect(row).toBeVisible();
+
+                // # Open the row actions menu
+                await page.getByTestId(`global-attribute-actions-${field.id}`).click();
+
+                // * View (not Edit) is offered and navigable; Delete stays disabled
+                const viewItem = page.locator(`#global-attribute-actions-${field.id}-edit`);
+                await expect(viewItem).toContainText('View attribute');
+                await expect(viewItem).not.toHaveAttribute('aria-disabled', 'true');
+
+                const deleteItem = page.locator(`#global-attribute-actions-${field.id}-delete`);
+                await expect(deleteItem).toContainText('Delete attribute');
+                await expect(deleteItem).toHaveAttribute('aria-disabled', 'true');
+
+                // # View opens the details page (read-only via the same schema isDisabled)
+                await viewItem.click();
+                await expect(page).toHaveURL(new RegExp(`/attribute_details/${field.id}$`));
+                await expect(page.getByTestId('attributeDisplayNameInput')).toBeDisabled();
+            } finally {
+                await deleteGlobalAttributeFieldIfExists(adminClient, name);
+            }
+        });
+    });
 });
```

**File**: `server/i18n/en.json` (modified, +2/-1)
```diff
@@ -2940,7 +2940,8 @@
   },
   {
     "id": "api.emoji.upload.large_image.too_large_to_process.app_error",
-    "translation": "Unable to create emoji. The image is too large to process. Try using one with smaller dimensions or fewer frames."
+    "translation": "Unable to create emoji. The image is too large to process. Try using one with smaller dimensions or fewer frames.",
+    "description": "API error shown when a custom emoji image cannot be decoded because its pixel dimensions or animation frames exceed server processing limits."
   },
   {
     "id": "api.emoji.upload.open.app_error",
```

**File**: `webapp/channels/src/components/admin_console/access_control/policy_details/policy_details.tsx` (modified, +1/-1)
```diff
@@ -557,7 +557,7 @@ function PolicyDetails({
                                     defaultMessage: 'Configure user attributes',
                                 }),
                                 onClick: () => {
-                                    getHistory().push('/admin_console/system_attributes/user_attributes');
+                                    getHistory().push('/admin_console/system_attributes/manage_attributes');
                                 },
                             }}
                         />
```

**File**: `webapp/channels/src/components/admin_console/admin_definition.tsx` (modified, +4/-4)
```diff
@@ -788,15 +788,15 @@ const AdminDefinition: AdminDefinitionType = {
                                     type: 'bool',
                                     key: 'AccessControlSettings.EnableAttributeBasedAccessControl',
                                     label: defineMessage({id: 'admin.accesscontrol.enableTitle', defaultMessage: 'Allow attribute based access controls on this server'}),
-                                    help_text: defineMessage({id: 'admin.accesscontrol.enableDesc', defaultMessage: 'Allow access restrictions based on user attributes using custom access policies. To effectively use this feature, you must define user attributes in the {userAttributes} section.'}), // eslint-disable-line formatjs/enforce-placeholders -- userAttributes provided via help_text_values
+                                    help_text: defineMessage({id: 'admin.accesscontrol.enableDesc', defaultMessage: 'Allow access restrictions based on user attributes using custom access policies. To effectively use this feature, you must define attributes in the {userAttributes} section.'}), // eslint-disable-line formatjs/enforce-placeholders -- userAttributes provided via help_text_values
                                     help_text_values: {
                                         userAttributes: (
-                                            <a href='../system_attributes/user_attributes'>
+                                            <Link to='/admin_console/system_attributes/manage_attributes'>
                                                 <FormattedMessage
                                                     id='admin.accesscontrol.user_properties.link.label'
-                                                    defaultMessage='User Attributes'
+                                                    defaultMessage='Attribute Management'
                                                 />
-                                            </a>
+                                            </Link>
                                         ),
                                     },
                                 },
```

**File**: `webapp/channels/src/components/admin_console/global_attributes/attribute_details/attribute_details.test.tsx` (modified, +56/-0)
```diff
@@ -2441,6 +2441,62 @@ describe('AttributeDetails', () => {
             expect(patchPropertyField.mock.calls.filter((call) => call[1] === 'user')).toHaveLength(1);
         });
 
+        it('PATCHes ldap/saml onto an already-persisted Users field when the template sync source changes', async () => {
+            // Sync reads attrs.ldap/attrs.saml on the Users field, not the template.
+            // Those attrs are only copied at linked-field create time, so Save must
+            // cascade a later template edit onto the existing Users row.
+            mockLoadedField(
+                makeTemplate({attrs: {display_name: 'Department', ldap: 'oldDept'}}),
+                [makeLinked('user', 'user-field', {attrs: {display_name: 'Department', ldap: 'oldDept'}})],
+            );
+            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockImplementation((_group, objectType) => (
+                Promise.resolve(objectType === 'user' ?
+                    makeLinked('user', 'user-field', {attrs: {ldap: 'newDept'}}) :
+                    makeTemplate({attrs: {display_name: 'Department', ldap: 'newDept'}}))
+            ));
+
+            renderEdit();
+            await waitForForm();
+
+            await userEvent.click(screen.getByTestId('attributeExternalSourceChip-ldap-edit'));
+            const input = await screen.findByPlaceholderText('department');
+            await userEvent.clear(input);
+            await userEvent.type(input, 'newDept');
+            await userEvent.click(screen.getByRole('button', {name: 'Save'}));
+            await waitFor(() => expect(screen.queryByPlaceholderText('department')).not.toBeInTheDocument());
+
+            await userEvent.click(screen.getByTestId('saveSetting'));
+
+            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
+            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'template', FIELD_ID, expect.objectContaining({
+                attrs: expect.objectContaining({ldap: 'newDept'}),
+            }));
+            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'user', 'user-field', {
+                attrs: {ldap: 'newDept'},
+            });
+        });
+
+        it('clears ldap/saml on an already-persisted Users field when the template sync source is removed', async () => {
+            mockLoadedField(
+                makeTemplate({attrs: {display_name: 'Department', ldap: 'oldDept'}}),
+                [makeLinked('user', 'user-field', {attrs: {display_name: 'Department', ldap: 'oldDept'}})],
+            );
+            const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField').mockImplementation((_group, objectType) => (
+                Promise.resolve(objectType === 'user' ? makeLinked('user', 'user-field') : makeTemplate())
+            ));
+
+            renderEdit();
+            await waitForForm();
+
+            await userEvent.click(screen.getByTestId('attributeExternalSourceChip-ldap-remove'));
+            await userEvent.click(screen.getByTestId('saveSetting'));
+
+            await waitFor(() => expect(mockHistoryPush).toHaveBeenCalled());
+            expect(patchPropertyField).toHaveBeenCalledWith('access_control', 'user', 'user-field', {
+                attrs: {ldap: null},
+            });
+        });
+
         it('renders a distinct "settings couldn\'t be updated" banner (not "couldn\'t be applied") when the config patch fails, since the row is already linked', async () => {
             mockLoadedField(makeTemplate(), [makeLinked('user', 'user-field')]);
             jest.spyOn(Client4, 'patchPropertyField').mockImplementation((_group, objectType) => (
```

**File**: `webapp/channels/src/components/admin_console/global_attributes/attribute_details/attribute_details.tsx` (modified, +29/-4)
```diff
@@ -417,6 +417,12 @@ function AttributeDetails({disabled = false}: Props): JSX.Element {
     const originalUserVisibilityRef = useRef<FieldVisibility>('when_set');
     const originalUserManagedRef = useRef<UserManagedValue>('');
 
+    // Template ldap/saml as loaded (or last successfully saved). Sync reads the
+    // linked Users field's own attrs, which are only copied from the template at
+    // create time, so a change here must be patched onto that field on Save.
+    const originalLdapAttrRef = useRef('');
+    const originalSamlAttrRef = useRef('');
+
     // Compared against the live *server* field type at Save time to pick which
     // order DELETE/PATCH run in (see handleSave) -- the server rejects a type-
     // changing PATCH while linked fields of the old type still exist
@@ -528,8 +534,12 @@ function AttributeDetails({disabled = false}: Props): JSX.Element {
                 setIsNameManuallyEdited(true);
                 setFieldType(getAttributeTypeDescriptor(field).id);
                 setOptions(loadedOptions);
-                setLdapAttr(typeof field.attrs?.ldap === 'string' ? field.attrs.ldap : '');
-                setSamlAttr(typeof field.attrs?.saml === 'string' ? field.attrs.saml : '');
+                const loadedLdap = typeof field.attrs?.ldap === 'string' ? field.attrs.ldap : '';
+                const loadedSaml = typeof field.attrs?.saml === 'string' ? field.attrs.saml : '';
+                originalLdapAttrRef.current = loadedLdap;
+                originalSamlAttrRef.current = loadedSaml;
+                setLdapAttr(loadedLdap);
+                setSamlAttr(loadedSaml);
 
                 // A non-template field has no linked children: Applies-to is its
                 // own object type, and AttributeAppliesTo locks it via isNonTemplate.
@@ -1117,16 +1127,25 @@ function AttributeDetails({disabled = false}: Props): JSX.Element {
             if (userIsUpdateCandidate) {
                 const visibilityChanged = userVisibility !== originalUserVisibilityRef.current;
                 const managedChanged = userManaged !== originalUserManagedRef.current;
+                const ldapChanged = ldapAttr !== originalLdapAttrRef.current;
+                const samlChanged = samlAttr !== originalSamlAttrRef.current;
+                const syncSourceChanged = ldapChanged || samlChanged;
                 const existingUserField = persistedLinkedFieldsRef.current.user;
                 const cascadeDisplayName = existingUserField ? shouldCascadeLinkedDisplayName(existingUserField) : false;
-                if (existingUserField && (visibilityChanged || managedChanged || cascadeDisplayName)) {
+                if (existingUserField && (visibilityChanged || managedChanged || cascadeDisplayName || syncSourceChanged)) {
                     try {
                         const updatedUserField = await patchLinkedAttributeField(
                             'user',
                             existingUserField.id,
                             {
                                 ...(visibilityChanged || managedChanged ? userConfigAttrs : {}),
                                 ...(cascadeDisplayName ? displayNamePatchAttrs : {}),
+
+                                // null unlinks, matching updateAttributeField's
+                                // template patch — sync reads these attrs on the
+                                // Users field, not the template.
+                                ...(ldapChanged ? {ldap: ldapAttr || null} : {}),
+                                ...(samlChanged ? {saml: samlAttr || null} : {}),
                             },
                             (visibilityChanged || managedChanged) ? userConfigPermissionValues : undefined,
                         );
@@ -1135,6 +1154,10 @@ function AttributeDetails({disabled = false}: Props): JSX.Element {
                             originalUserVisibilityRef.current = userVisibility;
                             originalUserManagedRef.current = userManaged;
                         }
+                        if (syncSourceChanged) {
+                            originalLdapAttrRef.current = ldapAttr;
+                            originalSamlAttrRef.current = samlAttr;
+                        }
                     } catch {
                         // Distinct from applies_to_partial_save -- the Users row is
                         // already linked and persisted here (userIsUpdateCandidate
@@ -1145,7 +1168,7 @@ function AttributeDetails({disabled = false}: Props): JSX.Element {
                         // Display-name-only failures get their own copy: the config
                         // banner names Profile display / Who can set the value, which
                         // is wrong when neither control was part of this PATCH.
-                        const configChanged = visibilityChanged || managedChanged;
+                        const configChanged = visibilityChanged || managedChanged || syncSourceChang
```

**File**: `webapp/channels/src/components/admin_console/global_attributes/global_attributes.test.tsx` (modified, +6/-0)
```diff
@@ -35,6 +35,12 @@ describe('components/admin_console/global_attributes/GlobalAttributes', () => {
         expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes/attribute_details');
     });
 
+    test('disables the New attribute button when the page is read-only', async () => {
+        renderWithContext(<GlobalAttributes disabled={true}/>);
+
+        expect(screen.getByRole('button', {name: 'New attribute'})).toBeDisabled();
+    });
+
     test('renders the header and section frame, and renders the attributes table', async () => {
         renderWithContext(<GlobalAttributes/>);
 
```

---

### Incident Patch 11: `7206a384` (2026-09-30)
**Commit Message**: Mm 70889 channel attributes fix (#38747)

* Polish channel attributes admin and channel settings UX.

Hide Channel Info display as UI-only, add attributes to the Info tab, and improve empty banner preview messaging.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* Edit channel attributes from channel settings and allow emptying the banner

* Fix multiselect display to render individual chips for each value

* Fix alignment of elements in attribute details and classification attribute styles

* Fix channel attribute banner settings and rendering

Persist banner opt-outs, validate required text, preserve template punctuation, avoid double rendering, and prevent duplicate chip removal. Update regression tests and E2E selectors.

* Enhance banner token controls with unset value indicators

* Refactor channel attributes and banner handling

* Preserve authored classification banners when legacy banner info reports disabled

* Refactor tests for channel attributes and banner handling

* Fix styling and scrolling behavior in channel attributes and settings modal

* Fix banner fallback behavior for empty authored text in channel classification

* fix unit test

* update snapshot, adjust text 

**File**: `e2e-tests/playwright/lib/src/ui/components/channels/channel_attributes.ts` (modified, +33/-11)
```diff
@@ -76,16 +76,24 @@ export class ChannelInfoAttributes {
         return this.container.getByTestId(`channelInfoAttributeRow-${name}`);
     }
 
+    /**
+     * The displayed value. An editable text value renders as plain text inside its
+     * edit button; every other value, and a read-only text one, renders as a chip.
+     */
     chip(name: string) {
-        return this.row(name).getByTestId('attributeChip');
+        return this.row(name)
+            .getByTestId('attributeChip')
+            .or(this.row(name).getByTestId(`channelInfoAttributeTextValue-${name}`));
     }
 
     editButton(name: string) {
         return this.row(name).getByTestId(`channelInfoAttributeEdit-${name}`);
     }
 
+    // Page-wide: a select's options render in a menu portalled to the body, outside
+    // the row. The test id is unique either way.
     editor(name: string) {
-        return this.row(name).getByTestId(`channelAttributeEdit-${name}`);
+        return this.container.page().getByTestId(`channelAttributeEdit-${name}`);
     }
 
     error(name: string) {
@@ -141,30 +149,44 @@ export class ChannelInfoAttributes {
         }
     }
 
+    /**
+     * editor(name) on a select field is the first menu option, not a combobox, so
+     * clicking it would pick that option. Options are picked by name instead.
+     */
     async select(name: string, option: string) {
         await this.startEditing(name);
-        await this.editor(name).click();
-        await this.container.page().getByText(option, {exact: true}).click();
+        await this.pickOption(option);
+    }
+
+    async pickOption(option: string) {
+        await this.container.page().getByRole('menuitem', {name: option, exact: true}).click();
     }
 
     /**
-     * Reopens the editor first: each pick commits and closes it.
+     * The trigger's own chip carries the remove control -- no need to reopen
+     * the menu first, and removing does not open it either.
      */
     async deselect(name: string, option: string) {
-        await this.startEditing(name);
-
-        const chip = this.editor(name).locator('.DropDown__multi-value', {hasText: option});
-        await chip.locator('.DropDown__multi-value__remove').click();
+        await this.row(name)
+            .getByRole('button', {name: `Remove ${option}`, exact: true})
+            .click();
     }
 
+    /**
+     * A text attribute opens its input as soon as it is added; a select one lands as
+     * a closed "Not set" row, so its menu is opened here.
+     */
     async add(name: string, option?: string) {
         await this.addButton.click();
         await this.addMenuItem(name).click();
+        await expect(this.editor(name).or(this.unset(name))).toBeVisible();
+        if (!(await this.editor(name).isVisible())) {
+            await this.editButton(name).click();
+        }
         await expect(this.editor(name)).toBeVisible();
 
         if (option !== undefined) {
-            await this.editor(name).click();
-            await this.container.page().getByText(option, {exact: true}).click();
+            await this.pickOption(option);
         }
     }
 }
```

**File**: `e2e-tests/playwright/lib/src/ui/components/channels/channel_settings/info_settings.ts` (modified, +21/-0)
```diff
@@ -4,6 +4,8 @@
 import type {Locator} from '@playwright/test';
 import {expect} from '@playwright/test';
 
+import {ChannelInfoAttributes} from '../channel_attributes';
+
 export default class InfoSettings {
     readonly container: Locator;
     readonly nameInput: Locator;
@@ -13,6 +15,9 @@ export default class InfoSettings {
     readonly urlEditButton: Locator;
     readonly urlInput: Locator;
     readonly saveChangesPanel: Locator;
+    readonly saveButton: Locator;
+    readonly resetButton: Locator;
+    readonly attributes: ChannelInfoAttributes;
 
     constructor(container: Locator) {
         this.container = container;
@@ -23,6 +28,12 @@ export default class InfoSettings {
         this.urlEditButton = container.getByRole('button', {name: 'Edit'});
         this.urlInput = container.getByTestId('channelURLInput');
         this.saveChangesPanel = container.locator('.SaveChangesPanel');
+        this.saveButton = container.getByTestId('SaveChangesPanel__save-btn');
+        this.resetButton = container.getByTestId('SaveChangesPanel__cancel-btn');
+
+        // Same component as the Channel Info RHS, but staged here: edits only
+        // reach the server on this tab's own Save (see saveChangesPanel).
+        this.attributes = new ChannelInfoAttributes(container.getByTestId('channelInfoAttributes'));
     }
 
     async toBeVisible() {
@@ -52,4 +63,14 @@ export default class InfoSettings {
         await expect(this.purposeInput).toBeVisible();
         await this.purposeInput.fill(purpose);
     }
+
+    async save() {
+        await expect(this.saveButton).toBeVisible();
+        await this.saveButton.click();
+    }
+
+    async resetChanges() {
+        await expect(this.resetButton).toBeVisible();
+        await this.resetButton.click();
+    }
 }
```

**File**: `e2e-tests/playwright/lib/src/ui/components/channels/header.ts` (modified, +5/-5)
```diff
@@ -13,10 +13,8 @@ export default class ChannelsHeader {
     readonly channelMenuDropdown;
     readonly callButton: Locator;
     readonly pinnedMessagesButton: Locator;
-    // Two chip slots, two accessors: 'attributes' is the row under the channel
-    // name, 'infoAttributes' the inline strip beside the member count.
+    // The attribute chip strip. Header and info designations share it.
     readonly attributes: ChannelAttributeLabels;
-    readonly infoAttributes: ChannelAttributeLabels;
     readonly addChannelHeaderButton: Locator;
 
     constructor(container: Locator) {
@@ -26,8 +24,10 @@ export default class ChannelsHeader {
         this.channelMenuDropdown = container.locator('#channelHeaderDropdownButton');
         this.callButton = container.getByRole('button', {name: /call/i}).first();
         this.pinnedMessagesButton = container.locator('#channelHeaderPinButton');
-        this.attributes = new ChannelAttributeLabels(container.getByTestId('channelAttributeLabels-header'), 'header');
-        this.infoAttributes = new ChannelAttributeLabels(container.getByTestId('channelAttributeLabels-info'), 'info');
+        this.attributes = new ChannelAttributeLabels(
+            container.getByTestId('channelAttributeLabels-info-header'),
+            'info-header',
+        );
         this.addChannelHeaderButton = container.getByRole('button', {name: 'Add a channel header'});
     }
 
```

**File**: `e2e-tests/playwright/lib/src/ui/components/system_console/sections/system_attributes/global_attributes.ts` (modified, +10/-3)
```diff
@@ -8,12 +8,19 @@ export const GLOBAL_ATTRIBUTES_PATH = '/admin_console/system_attributes/manage_a
 export const ATTRIBUTE_DETAILS_PATH = `${GLOBAL_ATTRIBUTES_PATH}/attribute_details`;
 export const CLASSIFICATION_ATTRIBUTE_PATH = `${GLOBAL_ATTRIBUTES_PATH}/classification`;
 
-export type ChannelDisplayLocation = 'display_label_header' | 'display_label_info' | 'display_banner_top';
+export type ChannelDisplayLocation = 'display_label_header' | 'display_banner_top';
 
+// The switch is a visually hidden checkbox under its <label>, which takes the
+// pointer, so the click goes to the label.
 async function setToggle(toggle: Locator, on: boolean) {
-    if (((await toggle.getAttribute('aria-pressed')) === 'true') !== on) {
-        await toggle.click();
+    if ((await toggle.isChecked()) !== on) {
+        const id = await toggle.getAttribute('id');
+        if (!id) {
+            throw new Error('setToggle: the switch has no id, so its label cannot be found');
+        }
+        await toggle.page().locator(`label[for="${id}"]`).click();
     }
+    await expect(toggle).toBeChecked({checked: on});
 }
 
 /**
```

**File**: `e2e-tests/playwright/specs/functional/channels/channel_attributes/channel_attribute_banner.spec.ts` (modified, +12/-67)
```diff
@@ -5,12 +5,6 @@ import type {PropertyField} from '@mattermost/types/properties';
 
 import {expect, test} from '@mattermost/playwright-lib';
 
-import {
-    TEST_LEVELS,
-    deleteClassificationFieldsIfExist,
-    setupClassificationWithChannelField,
-} from '../channel_classification/helpers';
-
 import {
     DISPLAY_BANNER_TOP,
     DISPLAY_LABEL_INFO,
@@ -80,9 +74,9 @@ test.describe('Channel attribute banner composition', {tag: ['@channel_attribute
 
     /**
      * @objective Verify every banner-designated attribute shares one banner, and that
-     * Channel Settings shows them as chips the channel cannot remove.
+     * Channel Settings seeds them as removable defaults rather than locked chips.
      */
-    test('composes one banner from every designated attribute and locks their chips', async ({pw}) => {
+    test('composes one banner from every designated attribute and offers to remove them', async ({pw}) => {
         await pw.skipIfNoLicense();
         await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);
 
@@ -125,9 +119,9 @@ test.describe('Channel attribute banner composition', {tag: ['@channel_attribute
             await expect(configuration.bannerTokenChip(marking.name)).toBeVisible();
             await expect(configuration.bannerTokenChip(programme.name)).toBeVisible();
 
-            // * Designated attributes cannot be taken out of the banner
-            await expect(configuration.bannerTokenChipRemove(marking.name)).toHaveCount(0);
-            await expect(configuration.bannerTokenChipRemove(programme.name)).toHaveCount(0);
+            // * Designation is a default: either chip can be taken out of the banner
+            await expect(configuration.bannerTokenChipRemove(marking.name)).toBeVisible();
+            await expect(configuration.bannerTokenChipRemove(programme.name)).toBeVisible();
 
             // * Seeding those chips is not an edit, so the tab opens clean
             await expect(configuration.container.getByTestId('SaveChangesPanel__save-btn')).toHaveCount(0);
@@ -329,10 +323,15 @@ test.describe('Channel attribute banner composition', {tag: ['@channel_attribute
             const settings = await channelsPage.openChannelSettings();
             const configuration = await settings.openConfigurationTab();
             await configuration.enableChannelBanner();
+
+            // The designated attribute is seeded already; start from a known template.
+            await configuration.clearBannerText();
             await configuration.insertBannerToken(marking.name);
 
-            // * The preview names the empty result instead of rendering nothing
-            await expect(configuration.bannerTokenPreview).toContainText('no values are set');
+            // * The preview says the banner will not show instead of rendering nothing
+            const emptyNotice = configuration.container.getByTestId('bannerPreviewEmptyNotice');
+            await expect(emptyNotice).toContainText('The banner will not be displayed');
+            await expect(configuration.bannerTokenPreview).toHaveCount(0);
 
             await settings.close();
 
@@ -495,60 +494,6 @@ test.describe('Channel attribute banner composition', {tag: ['@channel_attribute
         }
     });
 
-    /**
-     * @objective Verify that when classification is banner-designated, Channel Settings
-     * locks the color picker to the selected level's color and the user cannot override it.
-     */
-    test('color picker is locked to the classification level color when classification is banner-designated', async ({
-        pw,
-    }) => {
-        await pw.skipIfNoLicense();
-        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);
-
-        const {adminClient, adminUser, team} = await pw.initSetup();
-        const suffix = pw.random.id();
-
-        // Provision the classification template + channel-linked field ourselves:
-        // this test must not depend on state left behind by other spec files.
-        const {channelFieldId, levels} = await setupClassificationWithChannelField(adminClient, TEST_LEVELS);
-        const level = levels.find((l) => l.color);
-        if (!level) {
-            throw new Error('setupClassificationWithChannelField did not return a coloured level');
-        }
-
-        try {
-            // Designate classification for the banner
-            await adminClient.patchPropertyField('access_control', 'channel', channelFieldId, {
-                attrs: {actions: ['display_banner_top']},
-            } as never);
-
-            const channel = await createChannelForAttributes(adminClient, team, `class-banner-${suffix}`);
-            await adminClient.addToChannel(adminUser.id, channel.id);
-            await adminClient.patchPropertyValues('access_control', 'channel', channel.id, [
-                {field_id: channelFieldId, value: level.id},
-            ] as never);
-
-            const {channelsPage} = await pw.testBrowser.login(adminUser);
-            aw
```

**File**: `e2e-tests/playwright/specs/functional/channels/channel_attributes/channel_attribute_banner_settings.spec.ts` (added, +289/-0)
```diff
@@ -0,0 +1,289 @@
+// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
+// See LICENSE.txt for license information.
+
+import type {PropertyField} from '@mattermost/types/properties';
+
+import {expect, test} from '@mattermost/playwright-lib';
+
+import {
+    deleteClassificationFieldsIfExist,
+    setupClassificationWithChannelField,
+} from '../channel_classification/helpers';
+
+import {
+    DISPLAY_BANNER_TOP,
+    attributeName,
+    createAttribute,
+    createChannelForAttributes,
+    deleteAttributes,
+    optionId,
+    purgeAttributes,
+    setChannelValue,
+} from './helpers';
+
+const BANNER_COLOR = '#1e325c';
+const CUSTOM_COLOR = '#3a7d44';
+const COLOR_INPUT = '#channel_banner_banner_background_color_picker-inputColorValue';
+
+// The channel-linked classification field is always named this.
+const CLASSIFICATION = 'classification';
+
+test.describe('Channel attribute banner settings', {tag: ['@channel_attributes']}, () => {
+    test.describe.configure({mode: 'serial'});
+
+    /**
+     * @objective Verify the colour picker is locked to the classification colour only while
+     * classification is in the banner text, and is the channel's to set once it is removed.
+     */
+    test('locks the colour to classification only while its token is in the banner', async ({pw}) => {
+        await pw.skipIfNoLicense();
+        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);
+
+        const {adminClient, adminUser, team} = await pw.initSetup();
+        const suffix = pw.random.id();
+
+        try {
+            const {channelFieldId, levels} = await setupClassificationWithChannelField(adminClient);
+            const level = levels[0];
+            await purgeAttributes(adminClient);
+            await adminClient.patchPropertyField('access_control', 'channel', channelFieldId, {
+                attrs: {actions: [DISPLAY_BANNER_TOP]},
+            } as never);
+
+            const channel = await createChannelForAttributes(adminClient, team, `class-colour-${suffix}`);
+            await adminClient.addToChannel(adminUser.id, channel.id);
+            await adminClient.patchPropertyValues('access_control', 'channel', channel.id, [
+                {field_id: channelFieldId, value: level.id},
+            ] as never);
+
+            const {channelsPage} = await pw.testBrowser.login(adminUser);
+            await channelsPage.goto(team.name, channel.name);
+            await channelsPage.toBeVisible();
+
+            let settings = await channelsPage.openChannelSettings();
+            let configuration = await settings.openConfigurationTab();
+            let colorInput = configuration.container.locator(COLOR_INPUT);
+
+            // * Classification is in the banner, so its colour is authoritative
+            await expect(configuration.bannerTokenChip(CLASSIFICATION)).toBeVisible();
+            await expect(colorInput).toBeDisabled();
+            await expect(colorInput).toHaveValue(level.color.toUpperCase());
+
+            // # Take classification out of the banner
+            await configuration.removeBannerToken(CLASSIFICATION);
+
+            // * Nothing would display, so there is nothing to colour yet
+            await expect(colorInput).toBeDisabled();
+
+            // # Author a banner of its own
+            await configuration.typeBannerText('Handle with care');
+
+            // * The colour is the channel's again
+            await expect(colorInput).toBeEnabled();
+            await configuration.setChannelBannerBackgroundColor(CUSTOM_COLOR.replace('#', ''));
+            await configuration.save();
+            await settings.close();
+
+            // * Members see the channel's colour, not the classification's
+            await expect(channelsPage.centerView.channelBanner).toHaveText('Handle with care');
+            await channelsPage.centerView.assertChannelBanner('Handle with care', CUSTOM_COLOR);
+
+            // # Put classification back
+            settings = await channelsPage.openChannelSettings();
+            configuration = await settings.openConfigurationTab();
+            colorInput = configuration.container.locator(COLOR_INPUT);
+            await expect(colorInput).toBeEnabled();
+            await configuration.insertBannerToken(CLASSIFICATION);
+
+            // * The picker locks to the classification colour again
+            await expect(colorInput).toBeDisabled();
+            await expect(colorInput).toHaveValue(level.color.toUpperCase());
+        } finally {
+            await deleteClassificationFieldsIfExist(adminClient);
+        }
+    });
+
+    /**
+     * @objective Verify a banner the channel emptied on purpose is not refilled with the
+     * designated attributes when it is switched back on.
+     */
+    test('keeps a deliberately emptied banner empty when it is switched back on', async ({pw}) => {
+        await pw.skipIfNoLicense();
+        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true)
```

**File**: `e2e-tests/playwright/specs/functional/channels/channel_attributes/channel_attribute_display.spec.ts` (modified, +18/-25)
```diff
@@ -66,13 +66,11 @@ test.describe('Channel attribute display and editing', {tag: ['@channel_attribut
             await channelsPage.goto(team.name, channel.name);
             await channelsPage.toBeVisible();
 
-            // Visible to an ordinary member, not just whoever set it. Designated for
-            // both slots, so it renders in both.
-            const {attributes, infoAttributes} = channelsPage.centerView.header;
+            // Visible to an ordinary member, not just whoever set it. Undesignated
+            // values never become chips.
+            const {attributes} = channelsPage.centerView.header;
             await expect(attributes.chip('AURORA')).toBeVisible();
-            await expect(infoAttributes.chip('AURORA')).toBeVisible();
             await expect(attributes.chip('QUIET')).toHaveCount(0);
-            await expect(infoAttributes.chip('QUIET')).toHaveCount(0);
 
             // Channel Info lists what the channel holds regardless of display
             // designation -- it is the only surface a value can be edited from, so a
@@ -315,9 +313,8 @@ test.describe('Channel attribute display and editing', {tag: ['@channel_attribut
             await channelsPage.goto(team.name, channel.name);
             await channelsPage.toBeVisible();
 
-            // * No chips on either header slot, because nothing was designated
+            // * No chips in the header, because nothing was designated
             await expect(channelsPage.centerView.header.attributes.container).toHaveCount(0);
-            await expect(channelsPage.centerView.header.infoAttributes.container).toHaveCount(0);
 
             // * But the row is there, saying the channel is incomplete, and it can be filled
             const info = await channelsPage.openChannelInfo();
@@ -361,8 +358,8 @@ test.describe('Channel attribute display and editing', {tag: ['@channel_attribut
             await adminClient.addToChannel(user.id, channel.id);
 
             for (let i = 0; i < 5; i++) {
-                // The inline slot: the one that shares its row with the header controls,
-                // so it is the only one where yielding space is an invariant.
+                // The chip strip shares its row with the header controls, so yielding
+                // space rather than pushing them is the invariant under test.
                 const field = await createAttribute(adminClient, attributeName(`overflow${i}`, suffix), {
                     options: [`LONG_VALUE_NUMBER_${i}`],
                     actions: [DISPLAY_LABEL_INFO],
@@ -377,7 +374,8 @@ test.describe('Channel attribute display and editing', {tag: ['@channel_attribut
             await channelsPage.toBeVisible();
 
             const infoButton = page.locator('#channel-info-btn');
-            const row = channelsPage.centerView.header.infoAttributes.visibleRow;
+            const labels = channelsPage.centerView.header.attributes;
+            const row = labels.visibleRow;
 
             await expect(page.getByTestId('attributeChip').first()).toBeVisible();
             const wideX = (await infoButton.boundingBox())?.x ?? 0;
@@ -388,12 +386,13 @@ test.describe('Channel attribute display and editing', {tag: ['@channel_attribut
             // layout and the icon row is not rendered at all.
             await page.setViewportSize({width: 800, height: 800});
 
-            await expect(page.getByTestId('channelAttributeLabelsOverflow-info')).toBeVisible();
+            await expect(labels.overflowButton).toBeVisible();
 
-            // Fewer chips shown than exist, and the remainder is reachable.
-            const shown = await page.getByTestId('attributeChip').count();
-            expect(shown).toBeGreaterThan(0);
-            expect(shown).toBeLessThan(5);
+            // Fewer chips shown than exist, and the remainder is reachable. Polled:
+            // the strip re-measures after the resize.
+            const visibleChips = row.getByTestId('attributeChip');
+            await expect.poll(() => visibleChips.count()).toBeLessThan(5);
+            await expect.poll(() => visibleChips.count()).toBeGreaterThan(0);
 
             // The row yields space rather than claiming it, so the controls after it
             // are not pushed further right as the window narrows.
@@ -408,8 +407,7 @@ test.describe('Channel attribute display and editing', {tag: ['@channel_attribut
             });
             expect(spill).toBeLessThanOrEqual(1);
 
-            await page.getByTestId('channelAttributeLabelsOverflow-info').click();
-            await expect(page.getByTestId('channelAttributeLabelsPopover-info')).toBeVisible();
+            await labels.openOverflow();
         } finally {
             await deleteAttributes(adminClient, created);
         }
@@ -511,12 +509,8 @@ test.describe('Channel attribute display and editing', {tag: ['@channel_attribut
             await modal.create();
             await expect(modal.container).not.toBeVisible();
 
-         
```

**File**: `e2e-tests/playwright/specs/functional/channels/channel_attributes/channel_attribute_editing.spec.ts` (modified, +57/-1)
```diff
@@ -194,7 +194,7 @@ test.describe('Channel attribute editing', {tag: ['@channel_attributes']}, () =>
                 })
                 .toEqual([optionId(caveats, 'NOFORN'), optionId(caveats, 'ORCON')]);
 
-            // # Remove the first one from the still-open editor
+            // # Remove the first one from its chip in the trigger
             await info.attributes.deselect(caveats.name, 'NOFORN');
 
             // * Only the remaining option survives, and the header agrees
@@ -516,4 +516,60 @@ test.describe('Channel attribute editing', {tag: ['@channel_attributes']}, () =>
             await deleteAttributes(adminClient, created);
         }
     });
+
+    /**
+     * @objective Verify a single-select value offers no clear control beside its chip, and
+     * is cleared from the option menu instead.
+     */
+    test('clears a single-select value from its menu rather than a control beside the chip', async ({pw}) => {
+        await pw.skipIfNoLicense();
+        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);
+
+        const {adminClient, team} = await pw.initSetup();
+        const suffix = pw.random.id();
+        const created: PropertyField[] = [];
+
+        try {
+            await purgeAttributes(adminClient);
+
+            const marking = await createAttribute(adminClient, attributeName('single_clear', suffix), {
+                options: ['SECRET', 'PUBLIC'],
+                actions: [DISPLAY_LABEL_INFO],
+            });
+            created.push(marking);
+
+            const channel = await createChannelForAttributes(adminClient, team, `edit-clear-${suffix}`);
+            const channelAdmin = await promoteToChannelAdmin(
+                pw,
+                adminClient,
+                team,
+                channel.id,
+                `chanadmin-clear-${suffix}`,
+            );
+            await setChannelValue(adminClient, channel.id, marking, optionId(marking, 'SECRET'));
+
+            const {channelsPage} = await pw.testBrowser.login(channelAdmin);
+            await channelsPage.goto(team.name, channel.name);
+            await channelsPage.toBeVisible();
+
+            const info = await channelsPage.openChannelInfo();
+            await expect(info.attributes.chip(marking.name)).toHaveText('SECRET');
+
+            // * Nothing but the value's own trigger sits in the row
+            await expect(info.attributes.row(marking.name).getByRole('button', {name: /^Clear /})).toHaveCount(0);
+
+            // # Clear it from the option menu
+            await info.attributes.startEditing(marking.name);
+            await channelsPage.page.getByRole('menuitem', {name: /^Clear /}).click();
+
+            // * The value is gone from the store
+            await expect
+                .poll(async () => {
+                    return valueFor(await readChannelValues(adminClient, channel.id), marking) ?? null;
+                })
+                .toBeNull();
+        } finally {
+            await deleteAttributes(adminClient, created);
+        }
+    });
 });
```

---

### Incident Patch 12: `ef6957a5` (2026-09-30)
**Commit Message**: Fix flaky post-list scroll and Global Attributes menu-height Playwright specs (#38871)

**File**: `e2e-tests/playwright/specs/functional/channels/post_list/initial_scroll_read.spec.ts` (modified, +18/-0)
```diff
@@ -147,6 +147,10 @@ test.describe('Post list initial scroll in read channel', () => {
                 // # Open the web app directly to that channel
                 await channelsPage.goto(team.name, channel.name);
 
+                if (testCase.name === 'with multiple pages of post previews') {
+                    await settleAfterPermalinkPreviewsLoad(watcher);
+                }
+
                 // * Verify that the post list didn't scroll or change height
                 expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
             });
@@ -161,6 +165,10 @@ test.describe('Post list initial scroll in read channel', () => {
                 // # Switch to the channel
                 await channelsPage.sidebarLeft.goToItem(channel.name);
 
+                if (testCase.name === 'with multiple pages of post previews') {
+                    await settleAfterPermalinkPreviewsLoad(watcher);
+                }
+
                 // * Verify that the post list didn't scroll or change height
                 expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
             });
@@ -180,4 +188,14 @@ test.describe('Post list initial scroll in read channel', () => {
         // # Wait until the post list hasn't scrolled for 500ms before returning results
         return watcher.waitForObservations(500);
     }
+
+    // Permalink previews resolve their linked post asynchronously, so the post list
+    // legitimately grows once they render in, producing one expected scroll observation
+    // before things truly settle. Wait for that to happen and reset the watcher so it
+    // only reports genuinely unexpected scroll changes afterward.
+    async function settleAfterPermalinkPreviewsLoad(watcher: PostListScrollWatcher) {
+        const lastPost = await channelsPage.centerView.getLastPost();
+        await lastPost.postPreview.waitFor();
+        await watcher.reset();
+    }
 });
```

**File**: `e2e-tests/playwright/specs/functional/channels/post_list/initial_scroll_unread.spec.ts` (modified, +18/-0)
```diff
@@ -184,6 +184,10 @@ test.describe('Post list initial scroll in unread channel', () => {
                 // * Verify that the New Messages line is actually visible
                 await expect(channelsPage.centerView.notificationSeparator).toBeVisible();
 
+                if (testCase.name === 'with multiple pages of post previews') {
+                    await settleAfterPermalinkPreviewsLoad(watcher);
+                }
+
                 expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
             });
 
@@ -203,6 +207,10 @@ test.describe('Post list initial scroll in unread channel', () => {
                 // * Verify that the New Messages line is still visible
                 await expect(channelsPage.centerView.notificationSeparator).toBeVisible();
 
+                if (testCase.name === 'with multiple pages of post previews') {
+                    await settleAfterPermalinkPreviewsLoad(watcher);
+                }
+
                 // * Verify that the post list didn't scroll or change height
                 expect(await waitForScrollToSettle(watcher)).toHaveLength(1);
             });
@@ -222,4 +230,14 @@ test.describe('Post list initial scroll in unread channel', () => {
         // # Wait until the post list hasn't scrolled for 500ms before returning results
         return watcher.waitForObservations(500);
     }
+
+    // Permalink previews resolve their linked post asynchronously, so the post list
+    // legitimately grows once they render in, producing one expected scroll observation
+    // before things truly settle. Wait for that to happen and reset the watcher so it
+    // only reports genuinely unexpected scroll changes afterward.
+    async function settleAfterPermalinkPreviewsLoad(watcher: PostListScrollWatcher) {
+        const lastPost = await channelsPage.centerView.getLastPost();
+        await lastPost.postPreview.waitFor();
+        await watcher.reset();
+    }
 });
```

**File**: `e2e-tests/playwright/specs/functional/system_console/global_attributes/global_attributes_form.spec.ts` (modified, +32/-4)
```diff
@@ -8,7 +8,7 @@
  * Local runs: upload or use a license with SkuShortName `enterprise`, `entry`, or `advanced`.
  */
 
-import type {Page} from '@playwright/test';
+import type {Locator, Page} from '@playwright/test';
 import type {PropertyField} from '@mattermost/types/properties';
 
 import {expect, test} from '@mattermost/playwright-lib';
@@ -1289,8 +1289,12 @@ test.describe('System Console - Global Attributes form', {tag: '@system_console'
                 // Measure the pane, not role=menu. Nested MUI Modal aria-hides the
                 // parent menu paper; its getBoundingClientRect can shift ~16px even
                 // when the suggestion list is portaled.
+                //
+                // The menu itself mounts with a grow transition, so read the height only
+                // once that has settled — otherwise this baseline lands mid-animation
+                // and every later reading looks like unrelated growth.
                 const pane = page.locator('.attribute-graph-parents-pane');
-                const heightBeforeSearch = await pane.evaluate((el) => el.getBoundingClientRect().height);
+                const heightBeforeSearch = await waitForStableRectHeight(pane);
                 await page.getByTestId('attributeGraphParentsPane__search').click();
 
                 const suggestions = page.getByTestId('attributeGraphParentsPane__suggestions');
@@ -1327,8 +1331,10 @@ test.describe('System Console - Global Attributes form', {tag: '@system_console'
                 const mountedValueMenu = page.getByRole('menu', {name: 'Edit Air', includeHidden: true});
 
                 // * Pane does not grow by a suggestion row (~36px). Focus and the
-                // nested modal can still shift getBoundingClientRect by ~6–16px.
-                const heightAfterSearch = await pane.evaluate((el) => el.getBoundingClientRect().height);
+                // nested modal can still shift getBoundingClientRect by ~6–16px. Read the
+                // height only once the focus/modal transition has stopped moving it —
+                // sampling mid-transition is what made this assertion flaky.
+                const heightAfterSearch = await waitForStableRectHeight(pane);
                 expect(Math.abs(heightAfterSearch - heightBeforeSearch)).toBeLessThan(24);
                 await expect(mountedValueMenu).toBeAttached();
 
@@ -2480,3 +2486,25 @@ async function openGraphRowDelete(page: Page, optionName: string, parentName = '
     await row.hover();
     await row.getByTestId('attributeOptionsGraphRow__delete').click();
 }
+
+// Polls getBoundingClientRect().height until two consecutive reads agree, so callers
+// don't sample a value mid CSS-transition (e.g. a focus ring or nested modal mount).
+// expect.poll runs the first probe immediately, so that reading is only a baseline;
+// compare only after a later probe that has waited for the poll interval.
+async function waitForStableRectHeight(locator: Locator): Promise<number> {
+    let lastHeight: number | undefined;
+
+    await expect
+        .poll(
+            async () => {
+                const height = await locator.evaluate((el) => el.getBoundingClientRect().height);
+                const isStable = lastHeight !== undefined && height === lastHeight;
+                lastHeight = height;
+                return isStable;
+            },
+            {timeout: 2000, intervals: [50, 100, 150, 300]},
+        )
+        .toBe(true);
+
+    return lastHeight!;
+}
```

---

### Incident Patch 13: `cc0611f2` (2026-09-29)
**Commit Message**: Fix flaky TestSearchAllChannels (#38859)

Automatic Merge

**File**: `server/channels/api4/channel_test.go` (modified, +3/-1)
```diff
@@ -3795,7 +3795,9 @@ func TestSearchAllChannels(t *testing.T) {
 		},
 		{
 			"Name search",
-			&model.ChannelSearch{Term: "what"},
+			// Prefix of Name "whatever". Term "what" also matches InitBasic DisplayNames
+			// ("dn_"+NewId()); z-base32 includes w/h/a/t but not v.
+			&model.ChannelSearch{Term: "whatev"},
 			[]string{openChannel.Id},
 		},
 		{
```

---

### Incident Patch 14: `d038ccd2` (2026-09-29)
**Commit Message**: Render English from each message's defaultMessage, not en.json (#38494)

* Render English from each message's defaultMessage, not en.json

The webapp bundles i18n/en.json into the main chunk and merges it into every
locale's message map, so each English string ships twice: once as the
defaultMessage compiled into its call site, and again as a catalog entry.
Dropping the import saves ~167KB gzipped and changes nothing on screen.
react-intl already falls back to the defaultMessage when a key is missing, and
an id only reaches en.json because formatjs found a literal defaultMessage at
its call site -- a literal nothing then strips from the bundle, since no babel
config enables removeDefaultMessage.

en.json was also merged into the non-English catalogs, which sit between 39%
and 91% complete. Without it those keys resolve through the defaultMessage
instead, so react-intl reports a MissingTranslationError -- and it constructs
that error, stack trace and all, before any onError handler can filter it, at
roughly 4.4us a call. Naming the current locale as defaultLocale skips the
branch outright and formats the fallback under the reader's locale, which is
what merging en.json used to do. A

**File**: `webapp/channels/eslint.config.mjs` (modified, +3/-0)
```diff
@@ -68,6 +68,9 @@ export default defineConfig([
                         name: 'mattermost-redux/types/actions',
                         importNames: ['DispatchFunc', 'GetStateFunc', 'ActionFunc', 'ActionFuncAsync', 'ThunkActionFunc'],
                         message: 'Use the web app version of it from types/store',
+                    }, {
+                        name: 'i18n/en.json',
+                        message: 'en.json is not shipped. English renders from the defaultMessage at each call site, so importing it only duplicates every English string in the bundle.',
                     }],
                     patterns: [{
                         group: ['@mattermost/client/src/*', '@mattermost/components/src/*', '@mattermost/types/src/*'],
```

**File**: `webapp/channels/src/actions/views/root.ts` (modified, +1/-2)
```diff
@@ -5,7 +5,6 @@ import {Client4} from 'mattermost-redux/client';
 
 import {getCurrentLocale, getTranslations} from 'selectors/i18n';
 
-import en from 'i18n/en.json';
 import {ActionTypes} from 'utils/constants';
 
 import type {ActionFuncAsync, ThunkActionFunc} from 'types/store';
@@ -42,7 +41,7 @@ export function unregisterPluginTranslationsSource(pluginId: string) {
 
 export function loadTranslations(locale: string, url: string): ActionFuncAsync {
     return async (dispatch) => {
-        const translations = {...en};
+        const translations: Translations = {};
         Object.values(pluginTranslationSources).forEach((pluginFunc) => {
             Object.assign(translations, pluginFunc(locale));
         });
```

**File**: `webapp/channels/src/components/intl_provider/intl_provider.tsx` (modified, +1/-0)
```diff
@@ -79,6 +79,7 @@ export default class IntlProvider extends React.PureComponent<Props> {
             <BaseIntlProvider
                 key={this.props.locale}
                 locale={this.props.locale}
+                defaultLocale={this.props.locale}
                 messages={this.props.translations}
                 textComponent='span'
                 wrapRichTextChunksInFragment={false}
```

**File**: `webapp/channels/src/components/post_view/post_aria_label_div.test.tsx` (modified, +5/-6)
```diff
@@ -4,7 +4,6 @@
 import React from 'react';
 import * as reactIntl from 'react-intl';
 
-import enMessages from 'i18n/en.json';
 import esMessages from 'i18n/es.json';
 import {renderWithContext, screen} from 'tests/react_testing_utils';
 import {TestHelper} from 'utils/test_helper';
@@ -54,11 +53,11 @@ describe('PostAriaLabelDiv', () => {
     };
 
     test('should render aria-label in the given locale', () => {
-        (reactIntl.useIntl as jest.Mock).mockImplementation(() => reactIntl.createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'}));
+        (reactIntl.useIntl as jest.Mock).mockImplementation(() => reactIntl.createIntl({locale: 'en', messages: {}, defaultLocale: 'en'}));
 
         let renderResult = renderWithContext(<PostAriaLabelDiv {...baseProps}/>, baseState, {
             locale: 'en',
-            intlMessages: enMessages,
+            intlMessages: {},
         });
 
         let div = renderResult.container.firstChild as HTMLElement;
@@ -78,13 +77,13 @@ describe('PostAriaLabelDiv', () => {
     });
 
     test('should pass other props through to the rendered div', () => {
-        (reactIntl.useIntl as jest.Mock).mockImplementation(() => reactIntl.createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'}));
+        (reactIntl.useIntl as jest.Mock).mockImplementation(() => reactIntl.createIntl({locale: 'en', messages: {}, defaultLocale: 'en'}));
 
         let props = baseProps;
 
         let renderResult = renderWithContext(<PostAriaLabelDiv {...props}/>, baseState, {
             locale: 'en',
-            intlMessages: enMessages,
+            intlMessages: {},
         });
         let div = renderResult.container.firstChild as HTMLElement;
 
@@ -105,7 +104,7 @@ describe('PostAriaLabelDiv', () => {
             baseState,
             {
                 locale: 'en',
-                intlMessages: enMessages,
+                intlMessages: {},
             },
         );
         div = renderResult.container.firstChild as HTMLElement;
```

**File**: `webapp/channels/src/components/post_view/post_list_virtualized/latest_post_reader.test.tsx` (modified, +1/-2)
```diff
@@ -4,7 +4,6 @@
 import React from 'react';
 import {createIntl, useIntl} from 'react-intl';
 
-import enMessages from 'i18n/en.json';
 import esMessages from 'i18n/es.json';
 import {renderWithContext, screen} from 'tests/react_testing_utils';
 import {TestHelper} from 'utils/test_helper';
@@ -57,7 +56,7 @@ describe('LatestPostReader', () => {
     };
 
     test('should render aria-label as a child in the given locale', () => {
-        (useIntl as jest.Mock).mockImplementation(() => createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'}));
+        (useIntl as jest.Mock).mockImplementation(() => createIntl({locale: 'en', messages: {}, defaultLocale: 'en'}));
 
         const {rerender} = renderWithContext(
             <LatestPostReader {...baseProps}/>,
```

**File**: `webapp/channels/src/tests/helpers/intl-test-helper.tsx` (modified, +1/-3)
```diff
@@ -9,13 +9,11 @@ import {
 } from 'react-intl';
 import type {IntlShape} from 'react-intl';
 
-import defaultMessages from 'i18n/en.json';
-
 export const defaultIntl = createIntl({
     locale: 'en',
     defaultLocale: 'en',
     timeZone: 'Etc/UTC',
-    messages: defaultMessages,
+    messages: {},
     textComponent: 'span',
 });
 
```

**File**: `webapp/channels/src/tests/react-intl_mock.ts` (modified, +1/-2)
```diff
@@ -3,11 +3,10 @@
 
 jest.mock('react-intl', function() {
     const reactIntl = jest.requireActual('react-intl');
-    const enMessages = require('i18n/en.json');
 
     const intl = reactIntl.createIntl({
         locale: 'en',
-        messages: enMessages,
+        messages: {},
         defaultLocale: 'en',
         timeZone: 'Etc/UTC',
         textComponent: 'span',
```

**File**: `webapp/channels/src/utils/admin_console_index.test.tsx` (modified, +2/-3)
```diff
@@ -9,12 +9,11 @@ import {samplePlugin1, samplePlugin2} from 'tests/helpers/admin_console_plugin_i
 
 import {generateIndex} from './admin_console_index';
 
-const enMessages = require('../i18n/en');
 const esMessages = require('../i18n/es');
 
 describe('AdminConsoleIndex.generateIndex', () => {
     it('should generate an index where I can search', () => {
-        const intl = createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'});
+        const intl = createIntl({locale: 'en', messages: {}, defaultLocale: 'en'});
 
         const idx = generateIndex(AdminDefinition, intl, {});
         expect(idx.search('ldap')).toEqual([
@@ -97,7 +96,7 @@ describe('AdminConsoleIndex.generateIndex', () => {
     });
 
     it('should generate a index including the plugin settings', () => {
-        const intl = createIntl({locale: 'en', messages: enMessages, defaultLocale: 'en'});
+        const intl = createIntl({locale: 'en', messages: {}, defaultLocale: 'en'});
 
         const idx = generateIndex(AdminDefinition, intl, {[samplePlugin1.id]: samplePlugin1, [samplePlugin2.id]: samplePlugin2});
 
```

---

### Incident Patch 15: `a938826d` (2026-09-29)
**Commit Message**: Allow system-level resources in render-time action search (#38745)

**File**: `server/channels/app/access_control_decision.go` (modified, +5/-4)
```diff
@@ -109,10 +109,11 @@ func (a *App) SearchAllowedActionsForCurrentUser(rctx request.CTX, req model.Act
 		return resp, nil
 	}
 
-	// All currently registered resource types are channel-scoped, so req.Resource.ID
-	// is always a channel ID here. If a non-channel resource type is ever added to
-	// renderableABACActions, this call must be updated to pass the correct channel ID.
-	subject, appErr := a.BuildAccessControlSubjectForSession(rctx, req.Resource.ID)
+	channelID := ""
+	if req.Resource.Type == model.AccessControlPolicyTypeChannel {
+		channelID = req.Resource.ID
+	}
+	subject, appErr := a.BuildAccessControlSubjectForSession(rctx, channelID)
 	if appErr != nil {
 		rctx.Logger().Info("Failed to build ABAC subject for render-decision search",
 			mlog.String("resource_type", req.Resource.Type),
```

**File**: `server/channels/app/access_control_decision_test.go` (modified, +18/-0)
```diff
@@ -60,6 +60,24 @@ func TestSearchAllowedActionsForCurrentUser(t *testing.T) {
 		require.Equal(t, 400, appErr.StatusCode)
 	})
 
+	t.Run("empty resource ID on channel resource returns bad request", func(t *testing.T) {
+		_, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
+			Resource: model.Resource{Type: model.AccessControlPolicyTypeChannel},
+		})
+		require.NotNil(t, appErr)
+		require.Equal(t, 400, appErr.StatusCode)
+	})
+
+	t.Run("empty resource ID on system-level resource is accepted", func(t *testing.T) {
+		disableABAC(t)
+
+		resp, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
+			Resource: model.Resource{Type: model.AccessControlPolicyTypePermission},
+		})
+		require.Nil(t, appErr)
+		require.Empty(t, resp.Decisions)
+	})
+
 	t.Run("unsupported action returns bad request", func(t *testing.T) {
 		_, appErr := th.App.SearchAllowedActionsForCurrentUser(rctx, model.ActionSearchRequest{
 			Resource: channelResource,
```

**File**: `server/public/model/access_control_decision.go` (modified, +3/-1)
```diff
@@ -96,7 +96,9 @@ func (r *ActionSearchRequest) IsValid() *AppError {
 	if r.Resource.Type == "" {
 		return NewAppError("ActionSearchRequest.IsValid", "model.access_control_decision.is_valid.resource_type.app_error", nil, "", http.StatusBadRequest)
 	}
-	if !IsValidId(r.Resource.ID) {
+	// System-level permission actions have no resource instance, so their ID may be empty.
+	systemLevel := r.Resource.Type == AccessControlPolicyTypePermission && r.Resource.ID == ""
+	if !systemLevel && !IsValidId(r.Resource.ID) {
 		return NewAppError("ActionSearchRequest.IsValid", "model.access_control_decision.is_valid.resource_id.app_error", nil, "", http.StatusBadRequest)
 	}
 	// nil/empty Actions = discovery mode (valid). Validate bounds only when non-empty.
```

#### Recent Merged Pull Requests:
- **PR #39007** (2026-10-05): docs: retire unused Puppeteer PDF pipeline (@esarafianou)
- **PR #39006** (2026-10-05): Cherry pick #38849 to release-11.7 (@amyblais)
- **PR #39005** (2026-10-05): Automated cherry pick of #38849 (@mattermost-build)
- **PR #39002** (2026-10-05): Automated cherry pick of #38739 (@mattermost-code)
- **PR #39001** (2026-10-05): Automated cherry pick of #38739 (@mattermost-code)
- **PR #39000** (2026-10-05): Automated cherry pick of #38739 (@mattermost-code)
- **PR #38999** (2026-10-05): Automated cherry pick of #38739 (@mattermost-code)
- **PR #38998** (2026-10-05): Automated cherry pick of #38739 (@mattermost-code)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
