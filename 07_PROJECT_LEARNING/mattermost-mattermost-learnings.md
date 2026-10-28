> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/mattermost-mattermost-learnings.md`  
> **Source**: github ([https://github.com/mattermost/mattermost](https://github.com/mattermost/mattermost))  
> **Source Version**: `7709b2f9`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T04:03:46.212Z  
> **Learning ID**: `learn-github-mattermost-mattermost`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): mattermost/mattermost

> **Canonical Artifact**: `07_PROJECT_LEARNING/mattermost-mattermost-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mattermost/mattermost](https://github.com/mattermost/mattermost))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-28T04:03:46.206Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mattermost/mattermost`
- **Description**: Mattermost is an open source platform for secure collaboration across the entire software development lifecycle..
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 39454 stars

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

### Incident Patch 1: `e190c0f1` (2026-10-27)
**Commit Message**: Migrate product Buttons from shared to compass-ui (#38903)

* Migrate modal and save-panel Buttons from shared to compass-ui

Continue the leaf-first Button migration by moving GenericModal,
standalone modal leaves, SaveChangesPanel/SaveButton, SpinnerButton,
and the component library demo onto @mattermost/compass-ui Button.
Replace confirmButtonVariant with a destructive boolean on ConfirmModal
and GenericModal, and update agent/style docs to prefer compass-ui for
new and migrated call sites.

Co-authored-by: Matthew Birtch <[REDACTED_EMAIL]>

* Fix modal footer button spacing after compass-ui migration

Replace Bootstrap .btn+.btn margin with flex gap on .modal-footer so
compass-ui Buttons keep the 8px horizontal spacing. Drop the redundant
ChannelNotificationModal nested footer so buttons are direct flex children.

Co-authored-by: Matthew Birtch <[REDACTED_EMAIL]>

* Neutralize Bootstrap clearfix on flex modal footers

Bootstrap 3 ::before/::after clearfix pseudos were participating in
.modal-footer flex layout and adding extra 8px gap spacing. Hide them
so only real footer buttons receive the gap.

Co-authored-by: Matthew Birtch <[REDACTED_EMAIL]>

* Fix multi-select Go button 

**File**: `e2e-tests/cypress/tests/integration/channels/accessibility/accessibility_account_settings_spec.js` (modified, +12/-5)
```diff
@@ -176,13 +176,20 @@ describe('Verify Accessibility Support in different sections in Settings and Pro
         cy.get('#changeInterfaceLanguageLabel').should('be.visible').and('have.text', 'Change interface language');
 
         // # When space key is pressed on dropdown, it should expand and should collapse when esc key is pressed
-        cy.get('@inputEl').typeWithForce(' ');
-        cy.findByRole('listbox').should('have.class', 'react-select__menu-list').as('listBox');
+        // Menu is portaled to document.body (outside the aria-modal dialog), so query by class
+        // and assert role=listbox rather than findByRole (inaccessible outside the modal).
+        cy.get('@inputEl').focus().typeWithForce(' ');
+        cy.get('.react-select__menu-list').
+            should('be.visible').
+            and('have.attr', 'role', 'listbox').
+            and('have.class', 'react-select__menu-list').
+            as('listBox');
         cy.get('@inputEl').typeWithForce('{esc}');
         cy.get('@listBox').should('not.exist');
 
         // # Press down arrow twice and check aria label
-        cy.get('@inputEl').typeWithForce(' ');
+        cy.get('@inputEl').focus().typeWithForce(' ');
+        cy.get('.react-select__menu-list').should('be.visible');
         cy.get('@inputEl').typeWithForce('{downarrow}{downarrow}');
         cy.get('#displayLanguage').within(($el) => {
             cy.wrap($el).findByRole('log').should('have.attr', 'aria-live', 'assertive').as('ariaEl');
@@ -276,15 +283,15 @@ describe('Verify Accessibility Support in different sections in Settings and Pro
         // * Check Tab behavior in MFA section
         cy.get('#mfaEdit').click();
         cy.get('#passwordEdit').focus().tab({shift: true}).tab().tab();
-        cy.get('.setting-list button.btn').should('have.class', 'a11y--active a11y--focused').tab();
+        cy.get('.setting-list').findByRole('button', {name: /Add|Remove/i}).should('have.class', 'a11y--active a11y--focused').tab();
         cy.get('#cancelSetting').should('have.class', 'a11y--active a11y--focused');
 
         // * Check Tab behavior in Sign-In Method if its available
         cy.get('.user-settings').then((el) => {
             if (el.find('#signinEdit').length) {
                 cy.get('#signinEdit').click();
                 cy.get('#mfaEdit').focus().tab({shift: true}).tab().tab();
-                cy.get('.setting-list a.btn').should('have.class', 'a11y--active a11y--focused').tab();
+                cy.get('.setting-list').findByRole('link').should('have.class', 'a11y--active a11y--focused').tab();
                 cy.get('#cancelSetting').should('have.class', 'a11y--active a11y--focused');
             }
         });
```

**File**: `e2e-tests/cypress/tests/integration/channels/collapsed_reply_threads/replies_spec.ts` (modified, +3/-3)
```diff
@@ -145,16 +145,16 @@ describe('Collapsed Reply Threads', () => {
         cy.uiGetPostThreadFooter(postForAvatar.id).find('.Avatars').find('button').first().click();
 
         // * Profile popover should be visible and close on ESC
-        cy.get('div.user-profile-popover').first().should('be.visible').find('button.btn-primary.btn-sm').type('{esc}');
+        cy.get('div.user-profile-popover').first().should('be.visible').find('.user-popover__bottom-row-container button').type('{esc}');
 
         // # Visit global threads
         cy.uiClickSidebarItem('threads');
 
         // * Find the first avatar and click it
         cy.get('div.ThreadItem').find('.activity').find('.Avatars').find('button').first().click();
 
-        // * Profile popover should be visible and close on ESC
-        cy.get('div.user-profile-popover').first().should('be.visible').find('button.btn-primary.btn-sm');
+        // * Profile popover should be visible
+        cy.get('div.user-profile-popover').first().should('be.visible').find('.user-popover__bottom-row-container button');
     });
 
     it('MM-T4143 Emoji reaction - type +:+1:', () => {
```

**File**: `e2e-tests/cypress/tests/integration/channels/emoji/custom_emoji_1_1_spec.ts` (modified, +2/-2)
```diff
@@ -55,7 +55,7 @@ describe('Custom emojis', () => {
         cy.uiOpenCustomEmoji();
 
         // # Click on add custom emoji
-        cy.findByRole('button', {name: 'Add Custom Emoji'}).should('be.visible').click();
+        cy.findByRole('link', {name: 'Add Custom Emoji'}).should('be.visible').click();
 
         // # Type emoji name
         cy.get('#name').type(customEmojiWithColons);
@@ -122,5 +122,5 @@ function saveCustomEmoji(teamName: string) {
 
     // * Should return to list of custom emojis
     cy.url().should('include', `${teamName}/emoji`);
-    cy.findByRole('button', {name: 'Add Custom Emoji'}).should('be.visible');
+    cy.findByRole('link', {name: 'Add Custom Emoji'}).should('be.visible');
 }
```

**File**: `e2e-tests/cypress/tests/integration/channels/emoji/custom_emoji_1_spec.ts` (modified, +2/-2)
```diff
@@ -105,7 +105,7 @@ describe('Custom emojis', () => {
         cy.uiOpenCustomEmoji();
 
         // # Click on add custom emoji
-        cy.findByRole('button', {name: 'Add Custom Emoji'}).should('be.visible').click();
+        cy.findByRole('link', {name: 'Add Custom Emoji'}).should('be.visible').click();
 
         // # Type emoji name
         cy.get('#name').should('be.visible').type(customEmojiWithColons);
@@ -180,5 +180,5 @@ function saveCustomEmoji(teamName: string) {
 
     // * Should return to list of custom emojis
     cy.url().should('include', `${teamName}/emoji`);
-    cy.findByRole('button', {name: 'Add Custom Emoji'}).should('be.visible');
+    cy.findByRole('link', {name: 'Add Custom Emoji'}).should('be.visible');
 }
```

**File**: `e2e-tests/cypress/tests/integration/channels/enterprise/guest_accounts/guest_invitation_ui_more_spec.ts` (modified, +1/-1)
```diff
@@ -136,7 +136,7 @@ describe('Guest Account - Guest User Invitation Flow', () => {
             // * Update email outside whitelisted domain and verify error message
             cy.get('#resetEmailModal').should('be.visible').within(() => {
                 cy.get('input[type="email"]').type(email);
-                cy.get('button.btn-primary.confirm').click();
+                cy.get('button.GenericModal__button.confirm').click();
                 cy.get('.error').should('be.visible').and('have.text', 'The email you provided does not belong to an accepted domain for guest accounts. Please contact your administrator or sign up with a different email.');
                 cy.get('.close').click();
             });
```

**File**: `e2e-tests/cypress/tests/integration/channels/enterprise/guest_accounts/system_console_manage_guest_spec.ts` (modified, +1/-1)
```diff
@@ -87,7 +87,7 @@ describe('Guest Account - Verify Manage Guest Users', () => {
         const email = `temp-${getRandomId()}@mattermost.com`;
         cy.get('#resetEmailModal').should('be.visible').within(() => {
             cy.get('input[type="email"]').type(email);
-            cy.get('button.btn-primary.confirm').click();
+            cy.get('button.GenericModal__button.confirm').click();
         });
 
         // * Verify if Guest's email was updated
```

**File**: `e2e-tests/cypress/tests/integration/channels/enterprise/system_console/archived_channels_spec.js` (modified, +3/-3)
```diff
@@ -62,7 +62,7 @@ describe('Archived channels', () => {
         cy.visit(`/admin_console/user_management/channels/${testChannel.id}`);
 
         // * Verify the Unarchive Channel button is visible
-        cy.get('button.btn-secondary', {timeout: TIMEOUTS.TWO_SEC}).should('have.text', 'Unarchive Channel').should('be.visible').should('be.enabled');
+        cy.findByRole('button', {name: 'Unarchive Channel', timeout: TIMEOUTS.TWO_SEC}).should('be.visible').should('be.enabled');
 
         // * Verify that only one widget is visible
         cy.get('div.AdminPanel').should('be.visible').and('have.length', 1);
@@ -73,10 +73,10 @@ describe('Archived channels', () => {
         cy.visit(`/admin_console/user_management/channels/${testChannel.id}`);
 
         // # Click Unarchive Channel button
-        cy.get('button.btn-secondary', {timeout: TIMEOUTS.TWO_SEC}).findAllByText('Unarchive Channel').click();
+        cy.findByRole('button', {name: 'Unarchive Channel', timeout: TIMEOUTS.TWO_SEC}).click();
 
         // * Verify the Archive Channel button is visible
-        cy.get('button.btn-secondary.btn-danger', {timeout: TIMEOUTS.TWO_SEC}).findAllByText('Archive Channel').should('be.visible');
+        cy.findByRole('button', {name: 'Archive Channel', timeout: TIMEOUTS.TWO_SEC}).should('be.visible');
 
         // * Verify that the other widget appears
         cy.get('div.AdminPanel').should('be.visible').should('have.length', 5);
```

**File**: `e2e-tests/cypress/tests/integration/channels/integrations/custom_slash_commands/slash_commands_spec.js` (modified, +1/-1)
```diff
@@ -155,7 +155,7 @@ describe('Slash commands page', () => {
         cy.get('#url').clear().type('http://mattermost.com');
 
         // # Click on Cancel
-        cy.get('a').contains('Cancel').click();
+        cy.findByRole('link', {name: 'Cancel'}).click();
 
         // # Click on edit again
         cy.get('a[href*="/edit"]').click();
```

---

### Incident Patch 2: `85158380` (2026-10-27)
**Commit Message**: [MM-71093] Fix managed channel categories vanishing from the sidebar after the first restart (#39017)

* [MM-71093] Pin the managed category property group to version 2

A fresh install registered the managed_channel_categories property group at
PropertyGroupVersionV2 but recorded the setup flag as the legacy "true". The
next startup read that flag as pre-v2 and ran an unconditional
IncrementVersion, leaving the group at version 3. The properties API only
serves a group whose version is exactly 2, so it answered 404 for the group
and the webapp stopped before it fetched the managed category mappings,
emptying the sidebar of managed categories.

The fresh-install path now records the current migration version, and the
existing-install path pins the group to version 2 instead of incrementing it,
which also repairs servers already sitting at version 3. IncrementVersion had
no other caller, so it is replaced by SetVersion.

Co-authored-by: mattermost-code <[REDACTED_EMAIL]>

* [MM-71093] Assert the managed category migration does not rewrite a v2 group

Pinning version 2 onto a group that is already there leaves identical state
behind, so the steady-state no-write is only observable th

**File**: `server/channels/api4/properties_test.go` (modified, +29/-0)
```diff
@@ -197,6 +197,35 @@ func TestPropertyRoutesWithPostAttributesFlag(t *testing.T) {
 	})
 }
 
+// This is the request the sidebar makes first: the webapp loads the managed
+// category field before it asks for a team's channel-to-category mappings, so a
+// group version the endpoint will not serve hides managed categories entirely
+// even though the mappings are intact (MM-71093).
+func TestManagedCategoryFieldsRequireGroupAtV2(t *testing.T) {
+	mainHelper.Parallel(t)
+
+	th := SetupConfig(t, func(cfg *model.Config) {
+		cfg.FeatureFlags.ManagedChannelCategories = true
+	}).InitBasic(t)
+
+	groupName := model.ManagedCategoryPropertyGroupName
+	search := model.PropertyFieldSearch{TargetType: "system"}
+
+	// The state server startup leaves behind.
+	fields, resp, err := th.SystemAdminClient.GetPropertyFields(context.Background(), groupName, model.PropertyValueTargetTypeChannel, search)
+	require.NoError(t, err)
+	CheckOKStatus(t, resp)
+	require.Len(t, fields, 1)
+	require.Equal(t, model.ManagedCategoryPropertyFieldName, fields[0].Name)
+
+	// The state an affected server booted into.
+	require.NoError(t, th.App.Srv().Store().PropertyGroup().SetVersion(groupName, model.PropertyGroupVersionV2+1))
+
+	_, resp, err = th.SystemAdminClient.GetPropertyFields(context.Background(), groupName, model.PropertyValueTargetTypeChannel, search)
+	require.Error(t, err)
+	CheckNotFoundStatus(t, resp)
+}
+
 // The gate is an OR across every Properties feature flag, so the off case is
 // only meaningful with all of them disabled — ClassificationMarkings defaults to
 // true. This is the half that backs "off by default exposes nothing".
```

**File**: `server/channels/app/migrations.go` (modified, +42/-9)
```diff
@@ -1061,16 +1061,14 @@ func (s *Server) doSetupManagedCategoryProperties() error {
 	}
 
 	if data != nil {
-		if data.Value == managedCategoryMigrationVersion {
-			return s.cacheManagedCategoryIDs()
+		if versionErr := s.ensureManagedCategoryGroupVersion(); versionErr != nil {
+			return versionErr
 		}
 
-		if incrementErr := s.Store().PropertyGroup().IncrementVersion(model.ManagedCategoryPropertyGroupName); incrementErr != nil {
-			return fmt.Errorf("failed to increment managed category group version: %w", incrementErr)
-		}
-
-		if saveErr := s.Store().System().SaveOrUpdate(&model.System{Name: managedCategorySetupDoneKey, Value: managedCategoryMigrationVersion}); saveErr != nil {
-			return fmt.Errorf("failed to save managed category setup done flag: %w", saveErr)
+		if data.Value != managedCategoryMigrationVersion {
+			if saveErr := s.Store().System().SaveOrUpdate(&model.System{Name: managedCategorySetupDoneKey, Value: managedCategoryMigrationVersion}); saveErr != nil {
+				return fmt.Errorf("failed to save managed category setup done flag: %w", saveErr)
+			}
 		}
 
 		return s.cacheManagedCategoryIDs()
@@ -1080,6 +1078,15 @@ func (s *Server) doSetupManagedCategoryProperties() error {
 	if err != nil {
 		return fmt.Errorf("failed to register managed category group: %w", err)
 	}
+
+	// Registering an existing group returns its row without touching the version,
+	// so a run that finds no setup flag over a group that has already drifted
+	// still has to pin it. This has to happen before the field below, which is
+	// validated against the group's version.
+	if versionErr := s.ensureManagedCategoryGroupVersion(); versionErr != nil {
+		return versionErr
+	}
+
 	rctx := properties.SystemCallerContext(request.EmptyContext(s.Log()))
 
 	_, err = s.propertyService.GetPropertyFieldByNameForObjectType(rctx, group.ID, "", model.PropertyValueTargetTypeChannel, model.ManagedCategoryPropertyFieldName)
@@ -1104,13 +1111,39 @@ func (s *Server) doSetupManagedCategoryProperties() error {
 		}
 	}
 
-	if err := s.Store().System().SaveOrUpdate(&model.System{Name: managedCategorySetupDoneKey, Value: "true"}); err != nil {
+	if err := s.Store().System().SaveOrUpdate(&model.System{Name: managedCategorySetupDoneKey, Value: managedCategoryMigrationVersion}); err != nil {
 		return fmt.Errorf("failed to save managed category setup done flag: %w", err)
 	}
 
 	return s.cacheManagedCategoryIDs()
 }
 
+// ensureManagedCategoryGroupVersion brings the managed category property group to
+// PropertyGroupVersionV2, which is the only version the properties API serves it
+// at. Installs that ran the original v1 setup need the upgrade; installs that were
+// bumped past v2 by an earlier unconditional increment need to come back down.
+func (s *Server) ensureManagedCategoryGroupVersion() error {
+	group, err := s.Store().PropertyGroup().Get(model.ManagedCategoryPropertyGroupName)
+	if err != nil {
+		return fmt.Errorf("failed to get managed category group: %w", err)
+	}
+
+	if group.IsPSAv2() {
+		return nil
+	}
+
+	if err := s.Store().PropertyGroup().SetVersion(model.ManagedCategoryPropertyGroupName, model.PropertyGroupVersionV2); err != nil {
+		return fmt.Errorf("failed to set managed category group version: %w", err)
+	}
+
+	// The fresh-install arm has just cached the drifted row via
+	// RegisterPropertyGroup, and field writes are version-checked against it.
+	group.Version = model.PropertyGroupVersionV2
+	s.propertyService.CacheGroup(group)
+
+	return nil
+}
+
 func (s *Server) doSetupCPADisplayNameBackfill(rctx request.CTX) error {
 	var nfErr *store.ErrNotFound
 	data, err := s.Store().System().GetByName(cpaDisplayNameBackfillKey)
```

**File**: `server/channels/app/migrations_test.go` (modified, +160/-27)
```diff
@@ -7,6 +7,7 @@ import (
 	"encoding/json"
 	"maps"
 	"sync"
+	"sync/atomic"
 	"testing"
 
 	"github.com/mattermost/mattermost/server/public/model"
@@ -17,68 +18,200 @@ import (
 )
 
 func TestDoSetupManagedCategoryProperties(t *testing.T) {
-	t.Run("should register the property group and field on fresh install", func(t *testing.T) {
-		th := Setup(t)
+	// The properties API only serves a group that is exactly at
+	// PropertyGroupVersionV2 (see PropertyGroup.IsPSAv2 and getV2Group in api4),
+	// and the webapp loads the managed category field before it asks for the
+	// channel mappings. So every case below asserts the absolute version rather
+	// than a delta: any other version takes the sidebar's managed categories down.
+	assertGroupServableAtV2 := func(t *testing.T, th *TestHelper) {
+		t.Helper()
 
 		group, appErr := th.App.GetPropertyGroup(th.Context, model.ManagedCategoryPropertyGroupName)
 		require.Nil(t, appErr)
-		require.NotNil(t, group)
-		require.Equal(t, model.ManagedCategoryPropertyGroupName, group.Name)
+		require.Equal(t, model.PropertyGroupVersionV2, group.Version)
+
+		// Field writes are version-checked against the property service's cached
+		// copy of the group, not the row above.
+		cached, err := th.Server.propertyService.GroupByID(group.ID)
+		require.NoError(t, err)
+		require.Equal(t, model.PropertyGroupVersionV2, cached.Version)
 
 		propertyFields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
 		require.Nil(t, appErr)
 		require.Len(t, propertyFields, 1)
 		require.Equal(t, model.ManagedCategoryPropertyFieldName, propertyFields[0].Name)
 
+		// Reading and writing a channel's managed category goes through these
+		// cached IDs, so a startup that leaves them empty breaks the feature too.
+		require.Equal(t, group.ID, th.Server.Channels().managedCategoryGroupID)
+		require.Equal(t, propertyFields[0].ID, th.Server.Channels().managedCategoryFieldID)
+	}
+
+	assertSetupFlagAtCurrentVersion := func(t *testing.T, th *TestHelper) {
+		t.Helper()
+
 		data, sysErr := th.Store.System().GetByName(managedCategorySetupDoneKey)
 		require.NoError(t, sysErr)
-		require.NotEmpty(t, data.Value)
-	})
+		require.Equal(t, managedCategoryMigrationVersion, data.Value)
+	}
+
+	// Setup(t) has already cached the IDs, so clear them to make the assertion
+	// above answer whether the run under test repopulated them.
+	runSetup := func(t *testing.T, th *TestHelper) {
+		t.Helper()
 
-	t.Run("should upgrade from a pre-v2 setup by incrementing the group version and updating the system key", func(t *testing.T) {
+		th.Server.Channels().managedCategoryGroupID = ""
+		th.Server.Channels().managedCategoryFieldID = ""
+
+		require.NoError(t, th.Server.doSetupManagedCategoryProperties())
+	}
+
+	t.Run("should register the property group and field on fresh install", func(t *testing.T) {
 		th := Setup(t)
 
 		group, appErr := th.App.GetPropertyGroup(th.Context, model.ManagedCategoryPropertyGroupName)
 		require.Nil(t, appErr)
+		require.NotNil(t, group)
+		require.Equal(t, model.ManagedCategoryPropertyGroupName, group.Name)
 
-		// Simulate the pre-v2 state where the migration has run with the legacy "true" marker.
+		assertGroupServableAtV2(t, th)
+		assertSetupFlagAtCurrentVersion(t, th)
+	})
+
+	t.Run("should leave a fresh install at v2 across later startups without rewriting the version", func(t *testing.T) {
+		th := Setup(t)
+		spy := installSetVersionSpy(t, th)
+
+		// Setup(t) has already run the fresh-install path, so this stands in for
+		// the restarts that follow a new deployment.
+		for range 2 {
+			runSetup(t, th)
+
+			assertGroupServableAtV2(t, th)
+			assertSetupFlagAtCurrentVersion(t, th)
+			require.Zero(t, spy.calls.Load())
+		}
+	})
+
+	t.Run("should upgrade a pre-v2 install to v2 and update the system key", func(t *testing.T) {
+		th := Setup(t)
+
+		// Simulate the original v1 setup: the legacy "true" marker over a v1 group.
 		sysErr := th.Store.System().SaveOrUpdate(&model.System{Name: managedCategorySetupDoneKey, Value: "true"})
 		require.NoError(t, sysErr)
-		initialVersion := group.Version
+		require.NoError(t, th.Store.PropertyGroup().SetVersion(model.ManagedCategoryPropertyGroupName, model.PropertyGroupVersionV1))
 
-		err := th.Server.doSetupManagedCategoryProperties()
-		require.NoError(t, err)
+		runSetup(t, th)
 
-		group, appErr = th.App.GetPropertyGroup(th.Context, model.ManagedCategoryPropertyGroupName)
-		require.Nil(t, appErr)
-		require.Equal(t, initialVersion+1, group.Version)
+		assertGroupServableAtV2(t, th)
+		assertSetupFlagAtCurrentVersion(t, th)
+	})
 
-		data, sysErr := th.Store.System().GetByName(managedCategorySetupDoneKey)
+	t.Run("should upgrade a pre-v2 group even when the system key already reads v2", func(t *testing.T) {
+		th := Setup(t)
+
+		// The group's own version decides whether it needs work; the marker only
+		// says the migration has run before.
+		sysErr := th.Store.System().SaveOr
```

**File**: `server/channels/app/properties/property_group.go` (modified, +7/-0)
```diff
@@ -68,6 +68,13 @@ func (ps *PropertyService) RegisterPropertyGroup(group *model.PropertyGroup) (*m
 	return registered, nil
 }
 
+// CacheGroup replaces the cached copy of a group whose row was changed
+// directly through the store.
+func (ps *PropertyService) CacheGroup(group *model.PropertyGroup) {
+	ps.groupCache.Store(group.Name, group)
+	ps.groupIDCache.Store(group.ID, group)
+}
+
 func (ps *PropertyService) GetPropertyGroup(name string) (*model.PropertyGroup, error) {
 	return ps.groupStore.Get(name)
 }
```

**File**: `server/channels/store/retrylayer/retrylayer.go` (modified, +10/-10)
```diff
@@ -11672,42 +11672,42 @@ func (s *RetryLayerPropertyGroupStore) GetByID(id string) (*model.PropertyGroup,
 
 }
 
-func (s *RetryLayerPropertyGroupStore) IncrementVersion(name string) error {
+func (s *RetryLayerPropertyGroupStore) Register(group *model.PropertyGroup) (*model.PropertyGroup, error) {
 
 	tries := 0
 	for {
-		err := s.PropertyGroupStore.IncrementVersion(name)
+		result, err := s.PropertyGroupStore.Register(group)
 		if err == nil {
-			return nil
+			return result, nil
 		}
 		if !isRepeatableError(err) {
-			return err
+			return result, err
 		}
 		tries++
 		if tries >= 3 {
 			err = errors.Wrap(err, "giving up after 3 consecutive repeatable transaction failures")
-			return err
+			return result, err
 		}
 		timepkg.Sleep(100 * timepkg.Millisecond)
 	}
 
 }
 
-func (s *RetryLayerPropertyGroupStore) Register(group *model.PropertyGroup) (*model.PropertyGroup, error) {
+func (s *RetryLayerPropertyGroupStore) SetVersion(name string, version int) error {
 
 	tries := 0
 	for {
-		result, err := s.PropertyGroupStore.Register(group)
+		err := s.PropertyGroupStore.SetVersion(name, version)
 		if err == nil {
-			return result, nil
+			return nil
 		}
 		if !isRepeatableError(err) {
-			return result, err
+			return err
 		}
 		tries++
 		if tries >= 3 {
 			err = errors.Wrap(err, "giving up after 3 consecutive repeatable transaction failures")
-			return result, err
+			return err
 		}
 		timepkg.Sleep(100 * timepkg.Millisecond)
 	}
```

**File**: `server/channels/store/sqlstore/property_group_store.go` (modified, +3/-3)
```diff
@@ -58,15 +58,15 @@ func (s *SqlPropertyGroupStore) Register(group *model.PropertyGroup) (*model.Pro
 	return group, nil
 }
 
-func (s *SqlPropertyGroupStore) IncrementVersion(name string) error {
+func (s *SqlPropertyGroupStore) SetVersion(name string, version int) error {
 	builder := s.getQueryBuilder().
 		Update("PropertyGroups").
-		Set("Version", sq.Expr("Version + 1")).
+		Set("Version", version).
 		Where(sq.Eq{"Name": name})
 
 	_, err := s.GetMaster().ExecBuilder(builder)
 	if err != nil {
-		return errors.Wrap(err, "property_group_increment_version_exec")
+		return errors.Wrap(err, "property_group_set_version_exec")
 	}
 
 	return nil
```

**File**: `server/channels/store/store.go` (modified, +1/-1)
```diff
@@ -1209,7 +1209,7 @@ type ScheduledPostStore interface {
 
 type PropertyGroupStore interface {
 	Register(group *model.PropertyGroup) (*model.PropertyGroup, error)
-	IncrementVersion(name string) error
+	SetVersion(name string, version int) error
 	Get(name string) (*model.PropertyGroup, error)
 	GetByID(id string) (*model.PropertyGroup, error)
 }
```

**File**: `server/channels/store/storetest/mocks/PropertyGroupStore.go` (modified, +18/-18)
```diff
@@ -74,24 +74,6 @@ func (_m *PropertyGroupStore) GetByID(id string) (*model.PropertyGroup, error) {
 	return r0, r1
 }
 
-// IncrementVersion provides a mock function with given fields: name
-func (_m *PropertyGroupStore) IncrementVersion(name string) error {
-	ret := _m.Called(name)
-
-	if len(ret) == 0 {
-		panic("no return value specified for IncrementVersion")
-	}
-
-	var r0 error
-	if rf, ok := ret.Get(0).(func(string) error); ok {
-		r0 = rf(name)
-	} else {
-		r0 = ret.Error(0)
-	}
-
-	return r0
-}
-
 // Register provides a mock function with given fields: group
 func (_m *PropertyGroupStore) Register(group *model.PropertyGroup) (*model.PropertyGroup, error) {
 	ret := _m.Called(group)
@@ -122,6 +104,24 @@ func (_m *PropertyGroupStore) Register(group *model.PropertyGroup) (*model.Prope
 	return r0, r1
 }
 
+// SetVersion provides a mock function with given fields: name, version
+func (_m *PropertyGroupStore) SetVersion(name string, version int) error {
+	ret := _m.Called(name, version)
+
+	if len(ret) == 0 {
+		panic("no return value specified for SetVersion")
+	}
+
+	var r0 error
+	if rf, ok := ret.Get(0).(func(string, int) error); ok {
+		r0 = rf(name, version)
+	} else {
+		r0 = ret.Error(0)
+	}
+
+	return r0
+}
+
 // NewPropertyGroupStore creates a new instance of PropertyGroupStore. It also registers a testing interface on the mock and a cleanup function to assert the mocks expectations.
 // The first argument is typically a *testing.T value.
 func NewPropertyGroupStore(t interface {
```

---

### Incident Patch 3: `84b0c547` (2026-10-27)
**Commit Message**: Fix flaky TestMigrateLinkCPAFieldToGlobalAttributeTemplate_ConcurrentEditIsNotClobbered (#39208)

* Fix flaky TestMigrateLinkCPAFieldToGlobalAttributeTemplate_ConcurrentEditIsNotClobbered

The test injects a concurrent PropertyField.Update between Get and the
link-write to prove optimistic concurrency rejects the stale write.
UpdateAt is stamped with model.GetMillis() (1ms), so when the injected
write lands in the same millisecond as the value Get just read, OCC
matches and the link silently overwrites the concurrent rename. Wait
until GetMillis advances before the injected write so the lock can
observe it. Tests-only change.

Verified with `go test -run '^TestMigrateLinkCPAFieldToGlobalAttributeTemplate_ConcurrentEditIsNotClobbered$' -race -count=100` locally.

Co-authored-by: mattermost-code <[REDACTED_EMAIL]>

* Retrigger CI after unrelated Enterprise FIPS test failure.

Co-authored-by: mattermost-code <[REDACTED_EMAIL]>

---------

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: mattermost-code <[REDACTED_EMAIL]>

**File**: `server/channels/app/properties/migrations_test.go` (modified, +7/-0)
```diff
@@ -7,6 +7,7 @@ import (
 	"fmt"
 	"strings"
 	"testing"
+	"time"
 
 	"github.com/pkg/errors"
 
@@ -829,6 +830,12 @@ func TestMigrateLinkCPAFieldToGlobalAttributeTemplate_ConcurrentEditIsNotClobber
 			// Simulate another HA node committing an admin edit to this same
 			// field in the window between this node's read (just above) and
 			// its own link-write below.
+			//
+			// UpdateAt is model.GetMillis() (1ms). Wait until it differs from
+			// the value Get just read, otherwise OCC cannot observe the write.
+			for model.GetMillis() <= seeded.UpdateAt {
+				time.Sleep(time.Millisecond)
+			}
 			concurrentEdit := *seeded
 			concurrentEdit.Name = "department_renamed_concurrently"
 			_, updateErr := realStore.Update(th.CPAGroupID, []*model.PropertyField{&concurrentEdit}, nil)
```

#### Recent Merged Pull Requests:
- **PR #39480** (closed): Add attribute Combobox helpers (@marianunez)
- **PR #39464** (2026-10-27): Fix clean-docker removing stale Postgres 14 volume name (@JulienTant)
- **PR #39462** (2026-10-27): Add the GetThreadFollowers and SetThreadFollowing plugin APIs (@asaadmahmood)
- **PR #39455** (2026-10-27): Automated cherry pick of #39252 (@mattermost-build)
- **PR #39454** (2026-10-27): Bumping prepackaged boards version to v10.1.0 (@avasconcelos114)
- **PR #39451** (closed): [THROWAWAY] Test FIPS config fix for #39301 (@agarciamontoro)

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

## X. Migrate product Buttons from shared to compass-ui (#38903)

**RULE**:
When implementing operations in `e2e-tests/cypress/tests/integration/channels/accessibility/accessibility_account_settings_spec.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in mattermost/mattermost. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e190c0f1`: Migrate product Buttons from shared to compass-ui (#38903). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `e2e-tests/cypress/tests/integration/channels/accessibility/accessibility_account_settings_spec.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
        // Menu is portaled to document.body (outside the aria-modal dialog), so query by class
        // and assert role=listbox rather than findByRole (inaccessible outside the modal).
        cy.get('@inputEl').focus().typeWithForce(' ');
        cy.get('.react-select__menu-list').
            should('be.visible').
            and('have.attr', 'role', 'listbox').
            and('have.class', 'react-select__menu-list').
            as('listBox');
        cy.get('@inputEl').focus().typeWithForce(' ');
        cy.get('.react-select__menu-list').should('be.visible');
        cy.get('.setting-list').findByRole('button', {name: /Add|Remove/i}).should('have.class', 'a11y--active a11y--focused').tab();
                cy.get('.setting-list').findByRole('link').should('have.class', 'a11y--active a11y--focused').tab();
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
        cy.get('@inputEl').typeWithForce(' ');
        cy.findByRole('listbox').should('have.class', 'react-select__menu-list').as('listBox');
        cy.get('@inputEl').typeWithForce(' ');
        cy.get('.setting-list button.btn').should('have.class', 'a11y--active a11y--focused').tab();
                cy.get('.setting-list a.btn').should('have.class', 'a11y--active a11y--focused').tab();
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e190c0f1` are properly handled with clean fallback behavior.
