# Verification Protocol: Verification Protocol: Empirical Defect Shield for mattermost-mattermost-learnings

<!-- PROVENANCE_START
{
  "source_repository": "mattermost-mattermost-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T19:27:35.648Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-mattermost-mattermost-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mattermost-mattermost-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T19:27:35.648Z`  
> **Learning ID**: `LEARN-EVO-mattermost-mattermost-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `mattermost-mattermost-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/mattermost-mattermost-learnings.md`  
> **Source**: github ([https://github.com/mattermost/mattermost](https://github.com/mattermost/mattermost))  
> **Source Version**: `2c67adc2`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T19:27:24.564Z  
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
> **Harvest Timestamp**: 2026-11-13T19:27:24.558Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mattermost/mattermost`
- **Description**: Mattermost is an open source platform for secure collaboration across the entire software development lifecycle..
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 39602 stars

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
		checkUploadFileAttachmentPermission(c, "checkUploadFilePermissionForNewFiles", originalPost.ChannelId)
	}
}

// checkUploadFileAttachmentPermission checks both the upload_file permission and
// the upload_file_attachment permission policy for the channel. Every path that
// uploads a file or attaches one to content in a channel must run it.
func checkUploadFileAttachmentPermission(c *Context, where string, channelID string) {
	if ok, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *c.AppContext.Session(), channelID, model.PermissionUploadFile); !ok {
		c.SetPermissionError(model.PermissionUploadFile)
		return
	}

	if !c.App.HasPermissionToChannelAction(c.AppContext, c.AppContext.Session().UserId, c.AppContext.Session().Roles, channelID, model.AccessControlPolicyActionUploadFileAttachment) {
		c.Err = model.NewAppError(where, "api.file.upload_file.abac_denied.app_error", nil, "", http.StatusForbidden)
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

// SearchEngineConnectionTested is called after a successful connection test
// with the given settings. Testing doesn't start the engine, so if it isn't
// running, wake the watcher to retry Start() now rather than after its backoff.
// The watcher starts the engine with the saved config, so a test of other
// connection settings is ignored; waking the watcher also resets its backoff.
func (ps *PlatformService) SearchEngineConnectionTested(tested model.ElasticsearchSettings) {
	engine := ps.SearchEngine.ElasticsearchEngine
	if engine == nil || engine.IsActive() || !sameSearchEngineConnection(tested, ps.Config().ElasticsearchSettings) {
		return
	}
	ps.esWatcher.reevaluate()
}

// sameSearchEngineConnection reports whether a and b connect to the same
// cluster in the same way.
func sameSearchEngineConnection(a, b model.ElasticsearchSettings) bool {
	return model.SafeDereference(a.Backend) == model.SafeDereference(b.Backend) &&
		model.SafeDereference(a.ConnectionURL) == model.SafeDereference(b.ConnectionURL) &&
		model.SafeDereference(a.Username) == model.SafeDereference(b.Username) &&
		model.SafeDereference(a.Password) == model.SafeDereference(b.Password) &&
		model.SafeDereference(a.Sniff) == model.SafeDereference(b.Sniff) &&
		model.SafeDereference(a.SkipTLSVerification) == model.SafeDereference(b.SkipTLSVerification) &&
		model.SafeDereference(a.CA) == model.SafeDereference(b.CA) &&
		model.SafeDereference(a.ClientCert) == model.SafeDereference(b.ClientCert) &&
		model.SafeDereference(a.ClientKey) == model.SafeDereference(b.ClientKey)
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

### Incident Patch 1: `9d59b084` (2026-11-13)
**Commit Message**: Fix post list height shift for posts with multiple image attachments (#39016)

* Fix post list height shift for posts with multiple image attachments

Posts with several images or videos jumped in height shortly after they
appeared, pushing the rest of the post list around.

MediaGallery packed its tiles into rows in JavaScript based on the
measured width of its container. On the first render that width is not
known yet, so it packed against a hardcoded 700px fallback. The
virtualized post list measures each post's height in a layout effect on
mount, which runs after the gallery's own layout effect but before the
gallery can re-render with the real width. The list therefore recorded
the 700px layout. Once the gallery re-rendered at the real width the row
count usually changed (for five landscape images in a ~1000px channel:
three rows of 2+2+1 at 664px became two rows of 3+2 at 440px), and the
list only picked up the new height via its ResizeObserver, which
updates offsets without re-rendering, so the correction showed up as a
visible shift.

No JS-side width measurement can fix this, because the parent always
measures before the child's corrected render commits. Instead, let the
b

**File**: `webapp/channels/src/components/file_attachment_list/media_gallery/media_gallery.scss` (modified, +25/-11)
```diff
@@ -4,7 +4,7 @@
     box-sizing: border-box;
     margin: 8px 0;
     clear: both;
-    container-type: inline-size;
+    container: media-gallery / inline-size;
 
     .post--compact & {
         display: block;
@@ -121,6 +121,8 @@
     }
 
     &__rows {
+        --media-gallery-row-height: 216px;
+
         display: grid;
         overflow: hidden;
         min-width: 0;
@@ -143,29 +145,41 @@
         display: flex;
         overflow: hidden;
         min-width: 0;
-        flex-direction: column;
+        flex-flow: row wrap;
+        align-content: flex-start;
         align-items: flex-start;
         justify-content: flex-start;
         gap: 8px;
     }
 
-    &__row {
-        display: flex;
-        width: 100%;
-        min-width: 0;
-        flex-direction: row;
-        align-items: stretch;
-        justify-content: flex-start;
-        gap: 8px;
-        text-align: left;
+    &--compact &__rows {
+        --media-gallery-row-height: 144px;
+    }
+}
+
+// Sized in CSS rather than from a measured width so the post list sees the
+// final height on first render, including in narrow containers like the RHS.
+// CSS has no hysteresis, so the RHS reserves its scrollbar gutter to keep a
+// scrollbar appearing from toggling the row height near 480px.
+@container media-gallery (width < 480px) {
+    .MediaGallery__rows {
+        --media-gallery-row-height: 144px;
     }
 }
 
 .MediaGallery__tile {
+    // Scale to the row height by aspect ratio, without upscaling past the
+    // file's native width, clamped to 50-500px.
+    --tile-width: max(50px, min(calc(var(--tile-ratio, 1.5) * var(--media-gallery-row-height)), var(--tile-native-width, 500px), 500px));
+
     position: relative;
     display: flex;
     overflow: hidden;
+    width: var(--tile-width);
+    max-width: 100%;
+    height: var(--media-gallery-row-height);
     box-sizing: border-box;
+    flex: 0 0 var(--tile-width);
     align-items: center;
     justify-content: center;
     border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
```

**File**: `webapp/channels/src/components/file_attachment_list/media_gallery/media_gallery.test.tsx` (modified, +132/-45)
```diff
@@ -10,7 +10,7 @@ import type {FileInfo} from '@mattermost/types/files';
 import {renderWithContext} from 'tests/react_testing_utils';
 
 import {ArchiveFileError, ArchiveTooLargeError, buildFileArchive} from './file_archive';
-import MediaGallery, {nextNarrowState} from './media_gallery';
+import MediaGallery from './media_gallery';
 
 jest.mock('./file_archive', () => ({
     ...jest.requireActual('./file_archive'),
@@ -39,37 +39,6 @@ function fileInfo(overrides: Partial<FileInfo>): FileInfo {
     };
 }
 
-describe('nextNarrowState', () => {
-    const SCROLLBAR_WIDTH = 15;
-
-    it('switches to compact rows below the enter threshold', () => {
-        expect(nextNarrowState(false, 479)).toBe(true);
-        expect(nextNarrowState(false, 480)).toBe(false);
-    });
-
-    it('stays compact until well past the enter threshold so a vanishing scrollbar cannot flip it back', () => {
-        expect(nextNarrowState(true, 479 + SCROLLBAR_WIDTH)).toBe(true);
-        expect(nextNarrowState(true, 511)).toBe(true);
-        expect(nextNarrowState(true, 512)).toBe(false);
-    });
-
-    it('settles at every width in the worst case, where tall rows scroll and compact rows do not', () => {
-        for (let unscrolledWidth = 400; unscrolledWidth <= 600; unscrolledWidth++) {
-            const scrolledWidth = unscrolledWidth - SCROLLBAR_WIDTH;
-
-            // Going compact hides the scrollbar, which widens the container back out.
-            if (nextNarrowState(false, scrolledWidth)) {
-                expect(nextNarrowState(true, unscrolledWidth)).toBe(true);
-            }
-
-            // Going tall shows the scrollbar, which narrows the container again.
-            if (!nextNarrowState(true, unscrolledWidth)) {
-                expect(nextNarrowState(false, scrolledWidth)).toBe(false);
-            }
-        }
-    });
-});
-
 describe('MediaGallery', () => {
     const baseState = {
         entities: {
@@ -149,28 +118,146 @@ describe('MediaGallery', () => {
         expect(onToggle).toHaveBeenCalledWith('p1');
     });
 
-    it('uses compact rows in a narrow container', () => {
-        const rectSpy = jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
-            width: 400,
-            height: 144,
-        } as DOMRect);
+    it('leaves tile sizing to CSS so a narrow container does not need to be measured', () => {
+        renderWithContext(
+            <MediaGallery
+                fileInfos={[
+                    fileInfo({id: 'a', name: 'a.png', width: 800, height: 600}),
+                    fileInfo({id: 'v', name: 'clip.mp4', extension: 'mp4', mime_type: 'video/mp4', width: 0, height: 0}),
+                ]}
+                postId='p1'
+                onItemClick={jest.fn()}
+            />,
+            baseState,
+        );
+
+        const [image, video] = screen.getAllByTestId('media-gallery-tile');
+        expect(image.style.getPropertyValue('--tile-ratio')).toBe(String(800 / 600));
+        expect(image.style.getPropertyValue('--tile-native-width')).toBe('800px');
+        expect(video.style.getPropertyValue('--tile-ratio')).toBe('1.5');
+        expect(video.style.getPropertyValue('--tile-native-width')).toBe('');
+
+        for (const tile of [image, video]) {
+            expect(tile.style.width).toBe('');
+            expect(tile.style.height).toBe('');
+        }
+    });
+
+    describe('layout', () => {
+        const mixedFiles = [
+            fileInfo({id: 'landscape', name: 'landscape.png', width: 1600, height: 900}),
+            fileInfo({id: 'portrait', name: 'portrait.png', width: 600, height: 1200}),
+            fileInfo({id: 'small', name: 'small.png', width: 40, height: 40}),
+            fileInfo({id: 'panorama', name: 'panorama.png', width: 6000, height: 1000}),
+            fileInfo({id: 'clip', name: 'clip.mp4', extension: 'mp4', mime_type: 'video/mp4', width: 0, height: 0}),
+        ];
+
+        // Everything that decides the gallery's height: its row-height classes,
+        // how tiles are grouped into wrapper elements, and each tile's sizing styles.
+        function layoutOf(root: Element) {
+            const gallery = root.querySelector('.MediaGallery')!;
+            const tiles = Array.from(root.querySelectorAll<HTMLElement>('.MediaGallery__tile'));
+            const groupSizes = new Map<Element, number>();
+            for (const tile of tiles) {
+                groupSizes.set(tile.parentElement!, (groupSizes.get(tile.parentElement!) ?? 0) + 1);
+            }
+            return {
+                galleryClassName: gallery.className,
+                tileGroups: Array.from(groupSizes.values()),
+                tiles: tiles.map((tile) => ({
+                    ratio: tile.style.getPropertyValue('--tile-ratio'),
+                    nativeWidth: tile.style.getPropertyValue('--tile-native-width'),
+                    width: tile.style.width,
+                    height: tile.style.height,
+                    flex: t
```

**File**: `webapp/channels/src/components/file_attachment_list/media_gallery/media_gallery.tsx` (modified, +13/-75)
```diff
@@ -21,11 +21,9 @@ import {getFileType} from 'utils/utils';
 import type {GlobalState} from 'types/store';
 
 import {ArchiveFileError, ArchiveTooLargeError, archiveFilename, buildFileArchive} from './file_archive';
-import {packRows} from './pack_rows';
 import ImageTile from './tiles/image_tile';
 import VideoTile from './tiles/video_tile';
 import type {ClassifiedFile, TileKind} from './types';
-import {useContainerDimensions} from './use_container_dimensions';
 
 import './media_gallery.scss';
 
@@ -38,20 +36,6 @@ type Props = {
     onToggleCollapse?: (postId: string) => void;
 };
 
-const ROW_HEIGHT = 216;
-const COMPACT_ROW_HEIGHT = 144;
-const MIN_TILE_WIDTH = 50;
-const MAX_TILE_WIDTH = 500;
-const GAP = 8;
-const FALLBACK_WIDTH = 700;
-
-const NARROW_ENTER_WIDTH = 480;
-const NARROW_EXIT_WIDTH = 512;
-
-export function nextNarrowState(isNarrow: boolean, width: number): boolean {
-    return isNarrow ? width < NARROW_EXIT_WIDTH : width < NARROW_ENTER_WIDTH;
-}
-
 function tileKindFor(fileInfo: FileInfo): TileKind | null {
     const type = getFileType(fileInfo.extension);
     if (type === FileTypes.IMAGE) {
@@ -75,16 +59,6 @@ const MediaGallery = ({fileInfos, postId, compactDisplay, isEmbedVisible = true,
 
     useEffect(() => () => downloadAbortRef.current?.abort(), []);
 
-    const containerRef = useRef<HTMLDivElement | null>(null);
-    const {width: containerWidth} = useContainerDimensions(containerRef);
-
-    const effectiveWidth = containerWidth > 0 ? containerWidth : FALLBACK_WIDTH;
-    const [isNarrow, setIsNarrow] = useState(false);
-
-    useEffect(() => {
-        setIsNarrow((prev) => nextNarrowState(prev, effectiveWidth));
-    }, [effectiveWidth]);
-
     const tiles: ClassifiedFile[] = useMemo(() => {
         const out: ClassifiedFile[] = [];
         for (const file of fileInfos) {
@@ -96,16 +70,6 @@ const MediaGallery = ({fileInfos, postId, compactDisplay, isEmbedVisible = true,
         return out;
     }, [fileInfos]);
 
-    const rows = useMemo(() => {
-        return packRows(tiles, {
-            containerWidth: effectiveWidth,
-            rowHeight: (compactDisplay || isNarrow) ? COMPACT_ROW_HEIGHT : ROW_HEIGHT,
-            minTileWidth: MIN_TILE_WIDTH,
-            maxTileWidth: MAX_TILE_WIDTH,
-            gap: GAP,
-        });
-    }, [tiles, effectiveWidth, isNarrow, compactDisplay]);
-
     const handleClick = useCallback((index: number) => {
         const file = tiles[index]?.file;
         if (!file) {
@@ -193,11 +157,8 @@ const MediaGallery = ({fileInfos, postId, compactDisplay, isEmbedVisible = true,
     // Collapsed single videos need a header, otherwise the tile disappears with no toggle.
     const showHeader = Boolean(onToggleCollapse) && (!isSingle || !isEmbedVisible);
 
-    let tileIdx = 0;
-
     return (
         <div
-            ref={containerRef}
             className={classNames('MediaGallery', {
                 'MediaGallery--compact': compactDisplay,
                 'MediaGallery--single': isSingle,
@@ -269,42 +230,19 @@ const MediaGallery = ({fileInfos, postId, compactDisplay, isEmbedVisible = true,
                 aria-hidden={!isEmbedVisible}
             >
                 <div className='MediaGallery__rows_inner'>
-                    {rows.map((row, rIdx) => (
-                        <div
-                            key={`row-${rIdx}`}
-                            className='MediaGallery__row'
-                            style={{height: `${row.height}px`}}
-                        >
-                            {row.tiles.map((packed) => {
-                                const current = tileIdx;
-                                tileIdx += 1;
-                                const tile = packed.tile;
-                                return tile.kind === 'image' ? (
-                                    <ImageTile
-                                        key={tile.file.id}
-                                        fileInfo={tile.file}
-                                        index={current}
-                                        total={tiles.length}
-                                        width={packed.width}
-                                        height={row.height}
-                                        enablePublicLink={enablePublicLink}
-                                        onClick={handleClick}
-                                    />
-                                ) : (
-                                    <VideoTile
-                                        key={tile.file.id}
-                                        fileInfo={tile.file}
-                                        index={current}
-                                        total={tiles.length}
-                                        width={packed.width}
-                                        height={row.height}
-                                        enablePublicLink={enablePublicLink}
-                                        onClick={handleClick}
- 
```

**File**: `webapp/channels/src/components/file_attachment_list/media_gallery/pack_rows.test.ts` (removed, +0/-97)
```diff
@@ -1,97 +0,0 @@
-// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
-// See LICENSE.txt for license information.
-
-import type {FileInfo} from '@mattermost/types/files';
-
-import {packRows} from './pack_rows';
-import type {ClassifiedFile} from './types';
-
-function tile(width: number, height: number, id = 'f'): ClassifiedFile {
-    return {
-        file: {id, width, height} as FileInfo,
-        kind: 'image',
-    };
-}
-
-describe('packRows', () => {
-    const baseOpts = {
-        containerWidth: 700,
-        rowHeight: 216,
-        minTileWidth: 50,
-        maxTileWidth: 500,
-        gap: 8,
-    };
-
-    it('returns no rows when there are no tiles', () => {
-        expect(packRows([], baseOpts)).toEqual([]);
-    });
-
-    it('returns no rows when the container has zero width', () => {
-        expect(packRows([tile(800, 600)], {...baseOpts, containerWidth: 0})).toEqual([]);
-    });
-
-    it('keeps every row at the configured (predictable) row height', () => {
-        const tiles = [
-            tile(800, 600, 'a'),
-            tile(800, 600, 'b'),
-            tile(800, 600, 'c'),
-            tile(800, 600, 'd'),
-            tile(800, 600, 'e'),
-        ];
-        const rows = packRows(tiles, baseOpts);
-        for (const row of rows) {
-            expect(row.height).toBe(baseOpts.rowHeight);
-        }
-    });
-
-    it('leaves the last row ragged on the right rather than scaling tiles to fill', () => {
-        const tiles = [
-            tile(800, 600, 'a'),
-            tile(800, 600, 'b'),
-            tile(800, 600, 'c'),
-            tile(800, 600, 'd'),
-        ];
-        const rows = packRows(tiles, baseOpts);
-
-        const last = rows[rows.length - 1];
-        const lastWidth = last.tiles.reduce((acc, t) => acc + t.width, 0) +
-            ((last.tiles.length - 1) * baseOpts.gap);
-        expect(lastWidth).toBeLessThanOrEqual(baseOpts.containerWidth + 0.5);
-    });
-
-    it('never packs a row wider than the container', () => {
-        const tiles = [
-            tile(1600, 600, 'a'),
-            tile(1600, 600, 'b'),
-            tile(1600, 600, 'c'),
-        ];
-        const rows = packRows(tiles, baseOpts);
-        for (const row of rows) {
-            const width = row.tiles.reduce((acc, t) => acc + t.width, 0) +
-                ((row.tiles.length - 1) * baseOpts.gap);
-            expect(width).toBeLessThanOrEqual(baseOpts.containerWidth + 0.5);
-        }
-    });
-
-    it('floors a sub-min tile at minTileWidth (the image inside still renders at native size via inline caps)', () => {
-        const rows = packRows([tile(40, 40)], baseOpts);
-        const packed = rows[0].tiles[0];
-        expect(packed.width).toBe(baseOpts.minTileWidth);
-    });
-
-    it('caps very wide tiles at maxTileWidth', () => {
-        const rows = packRows([tile(4000, 1000)], baseOpts);
-        const packed = rows[0].tiles[0];
-        expect(packed.width).toBeLessThanOrEqual(baseOpts.maxTileWidth);
-    });
-
-    it('uses a 1.5 default aspect ratio when a file is missing dimensions', () => {
-        const noDimsTile: ClassifiedFile = {
-            file: {id: 'x'} as FileInfo,
-            kind: 'image',
-        };
-        const rows = packRows([noDimsTile], baseOpts);
-        expect(rows).toHaveLength(1);
-        expect(rows[0].tiles[0].width).toBeCloseTo(baseOpts.rowHeight * 1.5);
-    });
-});
```

**File**: `webapp/channels/src/components/file_attachment_list/media_gallery/pack_rows.ts` (removed, +0/-90)
```diff
@@ -1,90 +0,0 @@
-// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
-// See LICENSE.txt for license information.
-
-import type {FileInfo} from '@mattermost/types/files';
-
-import type {ClassifiedFile} from './types';
-
-export type PackOptions = {
-    containerWidth: number;
-    rowHeight: number;
-    minTileWidth: number;
-    maxTileWidth: number;
-    gap: number;
-};
-
-export type PackedTile = {
-    tile: ClassifiedFile;
-    width: number;
-    height: number;
-};
-
-export type PackedRow = {
-    tiles: PackedTile[];
-    height: number;
-};
-
-const DEFAULT_ASPECT_RATIO = 1.5;
-
-function ratioOf(file: FileInfo): number {
-    if (file.width && file.height && file.width > 0 && file.height > 0) {
-        return file.width / file.height;
-    }
-    return DEFAULT_ASPECT_RATIO;
-}
-
-function tileSize(tile: ClassifiedFile, opts: PackOptions): {width: number; height: number} {
-    const ratio = ratioOf(tile.file);
-    let width = ratio * opts.rowHeight;
-    let height = opts.rowHeight;
-
-    if (tile.file.width && tile.file.height) {
-        if (width > tile.file.width) {
-            width = tile.file.width;
-            height = tile.file.height;
-        }
-    }
-
-    const upperBound = Math.min(opts.maxTileWidth, opts.containerWidth);
-    if (width > upperBound) {
-        height *= upperBound / width;
-        width = upperBound;
-    }
-    if (width < opts.minTileWidth) {
-        height *= opts.minTileWidth / width;
-        width = opts.minTileWidth;
-    }
-
-    return {width, height};
-}
-
-export function packRows(tiles: ClassifiedFile[], opts: PackOptions): PackedRow[] {
-    const rows: PackedRow[] = [];
-    if (tiles.length === 0 || opts.containerWidth <= 0 || opts.rowHeight <= 0) {
-        return rows;
-    }
-
-    let current: PackedTile[] = [];
-    let currentWidth = 0;
-
-    for (const tile of tiles) {
-        const {width, height} = tileSize(tile, opts);
-        const addedWidth = current.length === 0 ? width : currentWidth + opts.gap + width;
-
-        if (current.length > 0 && addedWidth > opts.containerWidth) {
-            rows.push({tiles: current, height: opts.rowHeight});
-            current = [{tile, width, height}];
-            currentWidth = width;
-            continue;
-        }
-
-        current.push({tile, width, height});
-        currentWidth = addedWidth;
-    }
-
-    if (current.length > 0) {
-        rows.push({tiles: current, height: opts.rowHeight});
-    }
-
-    return rows;
-}
```

**File**: `webapp/channels/src/components/file_attachment_list/media_gallery/tile_size.test.ts` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
+// See LICENSE.txt for license information.
+
+import type {FileInfo} from '@mattermost/types/files';
+
+import {tileSizeVars} from './tile_size';
+
+function file(width?: number, height?: number): FileInfo {
+    return {id: 'f', width, height} as FileInfo;
+}
+
+describe('tileSizeVars', () => {
+    it('exposes the image aspect ratio and native width', () => {
+        expect(tileSizeVars(file(800, 600))).toEqual({
+            '--tile-ratio': String(800 / 600),
+            '--tile-native-width': '800px',
+        });
+    });
+
+    it('uses a 1.5 default aspect ratio and no native width when a file is missing dimensions', () => {
+        expect(tileSizeVars(file())).toEqual({
+            '--tile-ratio': '1.5',
+        });
+    });
+});
```

**File**: `webapp/channels/src/components/file_attachment_list/media_gallery/tile_size.ts` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
+// See LICENSE.txt for license information.
+
+import type {CSSProperties} from 'react';
+
+import type {FileInfo} from '@mattermost/types/files';
+
+const DEFAULT_ASPECT_RATIO = 1.5;
+
+function ratioOf(file: FileInfo): number {
+    if (file.width && file.height && file.width > 0 && file.height > 0) {
+        return file.width / file.height;
+    }
+    return DEFAULT_ASPECT_RATIO;
+}
+
+// Tiles are sized in CSS from these variables against the gallery's row height,
+// which a container query shrinks in narrow containers, and they wrap into rows
+// via CSS flex-wrap. Nothing depends on measuring the container, so the post has
+// its final height on first render.
+export function tileSizeVars(file: FileInfo): CSSProperties {
+    const vars: Record<string, string> = {
+        '--tile-ratio': String(ratioOf(file)),
+    };
+
+    if (file.width && file.width > 0) {
+        vars['--tile-native-width'] = `${file.width}px`;
+    }
+
+    return vars as CSSProperties;
+}
```

**File**: `webapp/channels/src/components/file_attachment_list/media_gallery/tiles/image_tile.tsx` (modified, +4/-10)
```diff
@@ -13,17 +13,17 @@ import {isGIFImage} from 'utils/utils';
 
 import TileUtilityButtons from './tile_utility_buttons';
 
+import {tileSizeVars} from '../tile_size';
+
 type Props = {
     fileInfo: FileInfo;
     index: number;
     total: number;
-    width: number;
-    height: number;
     enablePublicLink: boolean;
     onClick: (index: number) => void;
 };
 
-const ImageTile = ({fileInfo, index, total, width, height, enablePublicLink, onClick}: Props) => {
+const ImageTile = ({fileInfo, index, total, enablePublicLink, onClick}: Props) => {
     const {formatMessage} = useIntl();
 
     const handleActivate = useCallback(() => {
@@ -52,12 +52,6 @@ const ImageTile = ({fileInfo, index, total, width, height, enablePublicLink, onC
         {current: index + 1, total, name: fileInfo.name || ''},
     );
 
-    const tileStyle: CSSProperties = {
-        width: `${width}px`,
-        height: `${height}px`,
-        flex: `0 0 ${width}px`,
-    };
-
     const imgStyle: CSSProperties = {};
     if (fileInfo.width && fileInfo.height) {
         imgStyle.maxWidth = `${fileInfo.width}px`;
@@ -72,7 +66,7 @@ const ImageTile = ({fileInfo, index, total, width, height, enablePublicLink, onC
             aria-label={label}
             data-testid='media-gallery-tile'
             data-file-name={fileInfo.name || ''}
-            style={tileStyle}
+            style={tileSizeVars(fileInfo)}
             onKeyDown={handleKeyDown}
         >
             <img
```

---

### Incident Patch 2: `75dd22f3` (2026-11-13)
**Commit Message**: docs: fix Calls deployment guide links that break the offline docs build (#39990)

* docs: fix Calls deployment guide links that break the offline docs build

The guide linked to /../../<path>. Under the offline bundle's base URL
(/_documentation/) those links escape the base URL and fail the build since
#39953 made broken links throw. That build gates the enterprise image in the
platform delivery pipeline, so master images stopped being published.
Use relative .mdx file links, which resolve under any base URL.

* ci(docs): build the offline docs shape with BASE_URL=/_documentation/ (#39991)

The server ships the docs bundle under /_documentation/, and the platform
delivery pipeline builds it with that base URL. Docs CI rebuilt the offline
shape with BASE_URL=/, so links that only break under /_documentation/ passed
here and failed later in delivery, which blocked the enterprise image.
Use the shipped base URL, and run Docs CI when this workflow changes.

**File**: `.github/workflows/docs-ci.yaml` (modified, +7/-2)
```diff
@@ -3,13 +3,15 @@ name: Docs CI
 on:
   pull_request:
     paths:
+      - ".github/workflows/docs-ci.yaml"
       - "docs/**"
       - "api/v4/source/**"
       - "api/playbooks/**"
   push:
     branches:
       - master
     paths:
+      - ".github/workflows/docs-ci.yaml"
       - "docs/**"
       - "api/v4/source/**"
       - "api/playbooks/**"
@@ -65,11 +67,14 @@ jobs:
 
       # Hosted Algolia injects SearchBar preconnects; do not scan that artifact.
       # Rebuild without ALGOLIA_* (prebuild already ran) for the offline shape.
-      - name: Rebuild without Algolia for egress scan
+      # BASE_URL matches the offline bundle the server ships (mattermost/delivery-platform
+      # builds it with BASE_URL=/_documentation/), so links that only break under that
+      # base URL fail here instead of in the release pipeline.
+      - name: Rebuild offline bundle shape for egress scan
         working-directory: docs/site
         run: npx docusaurus build && npm run postbuild
         env:
-          BASE_URL: /
+          BASE_URL: /_documentation/
 
       - name: Scan built site for egress
         working-directory: docs/site
```

**File**: `docs/main/deployment-guide/calls/calls-deployment-guide.mdx` (modified, +6/-6)
```diff
@@ -69,11 +69,11 @@ Use this checklist to confirm you have the infrastructure, skills, and access re
 
 - [ ] Your Mattermost server is configured to use HTTPS.
 
-  _See [Configure TLS](/../../deployment-guide/server/setup-tls) if you need to set up HTTPS._
+  _See [Configure TLS](../server/setup-tls.mdx) if you need to set up HTTPS._
 
 - [ ] You know how many active users you have in your current Mattermost deployment
 
-  _See [Site Statistics](/../../administration-guide/manage/statistics) to access usage metrics._
+  _See [Site Statistics](../../administration-guide/manage/statistics.mdx) to access usage metrics._
 
 - [ ] You can provision at least one dedicated Linux server or VM if you plan to use the RTCD service.
 
@@ -84,7 +84,7 @@ Use this checklist to confirm you have the infrastructure, skills, and access re
 
   _See [Networking Decisions](#13-networking-decisions) (Step 1.3) if you're unsure if you need a TURN server._
 
-- [ ] You have the appropriate [Mattermost edition and license](/../../product-overview/editions-and-offerings) for the features you need:
+- [ ] You have the appropriate [Mattermost edition and license](../../product-overview/editions-and-offerings.mdx) for the features you need:
   - **Mattermost Entry or Team Edition**: 1-1 calling and screen sharing (Up to 40 minutes)
   - **Mattermost Professional**: Group calling and screen sharing (No time limit)
   - **Mattermost Enterprise or Enterprise Advanced**: Required for:
@@ -96,7 +96,7 @@ Use this checklist to confirm you have the infrastructure, skills, and access re
 - [ ] You are comfortable with basic Linux administration, or you have someone available who is. You will need to connect to servers over SSH, edit configuration files, manage systemd services, inspect logs, and run shell commands.
 - [ ] You have System Admin access to your Mattermost server.
 
-  _See [Mattermost roles](/../../end-user-guide/collaborate/learn-about-roles) to learn about roles and permissions._
+  _See [Mattermost roles](../../end-user-guide/collaborate/learn-about-roles.mdx) to learn about roles and permissions._
 
 #### Networking Requirements
 
@@ -115,7 +115,7 @@ Use this checklist to confirm you have the infrastructure, skills, and access re
 
 - [ ] You know how to open a [request](https://support.mattermost.com) with Mattermost support if you encounter issues.
 
-  _Please include the exact **step number** (e.g. 2A.2.1) that failed, along with your [Mattermost support packet](/../../administration-guide/manage/admin/generating-support-packet) and [Calls logs](calls-logging.mdx)._
+  _Please include the exact **step number** (e.g. 2A.2.1) that failed, along with your [Mattermost support packet](../../administration-guide/manage/admin/generating-support-packet.mdx) and [Calls logs](calls-logging.mdx)._
 
 <Note>
 
@@ -157,7 +157,7 @@ To determine if you'll need RTCD, start by answering the following questions abo
 - **Are you deploying Calls on Kubernetes?**
   - **Yes:** You'll need to deploy RTCD as it's the only supported way to run Calls. See the [Kubernetes](calls-kubernetes.mdx) Calls deployment guide for details.
   - **No:** Continue to the next question.
-- **What is the *Total User* count of your existing Mattermost deployment?** _(Check [Site Statistics](/../../administration-guide/manage/statistics))_
+- **What is the *Total User* count of your existing Mattermost deployment?** _(Check [Site Statistics](../../administration-guide/manage/statistics.mdx))_
   - **Up to 50:** You can use the **Integrated** deployment model.
   - **More than 50:** You'll need to deploy RTCD to avoid impacting messaging performance of the Mattermost server.
 
```

---

### Incident Patch 3: `9750d5ac` (2026-11-12)
**Commit Message**: Fix escaped braces that render literally inside code (#39911)

Many pages escaped curly braces as &#123; and &#125; inside inline code
spans and fenced code blocks, likely left over from the RST to MDX
conversion. MDX doesn't decode character references inside code, so
the pages show the escape sequences verbatim, for example
`&#123;mattermost-server-IP&#125;`. Replace them with literal braces,
which are safe inside code. Escapes in regular prose, where MDX needs
them, are unchanged.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `docs/main/administration-guide/configure/environment-configuration-settings.mdx` (modified, +13/-13)
```diff
@@ -1039,17 +1039,17 @@ For more information on Aurora replication stats, see the [AWS Aurora documentai
 Example
 
 ``` json
-&#123;
-  "SqlSettings": &#123;
+{
+  "SqlSettings": {
       "ReplicaLagSettings": [
-        &#123;
+        {
             "DataSource": "replica-1",
             "QueryAbsoluteLag": "select server_id, highest_lsn_rcvd-durable_lsn as bindiff from aurora_global_db_instance_status() where server_id=<>",
             "QueryTimeLag": "select server_id, visibility_lag_in_msec from aurora_global_db_instance_status() where server_id=<>"
-        &#125;
+        }
       ]
-  &#125;
-&#125;
+  }
+}
 ```
 
 </TabItem>
@@ -1062,17 +1062,17 @@ For more information on group replication stats, see the [MySQL documentation](h
 Example
 
 ``` json
-&#123;
-  "SqlSettings": &#123;
+{
+  "SqlSettings": {
       "ReplicaLagSettings": [
-        &#123;
+        {
             "DataSource": "replica-1",
             "QueryAbsoluteLag": "select member_id, count_transactions_remote_in_applier_queue FROM performance_schema.replication_group_member_stats where member_id=<>",
             "QueryTimeLag": ""
-        &#125;
+        }
       ]
-  &#125;
-&#125;
+  }
+}
 ```
 
 </TabItem>
@@ -1181,7 +1181,7 @@ If indexing is disabled and then re-enabled after an index is created, purge and
 
 Before permanently deleting a large number of channels, turn off **Enable Elasticsearch indexing**. Each permanent delete reindexes every member of that channel, and that indexing work can exhaust Mattermost memory on a delete of about 100,000 memberships.
 
-Leave the Elasticsearch or OpenSearch cluster running. Save and restart, run the deletes with [`mmctl channel delete`](/administration-guide/manage/mmctl-command-line-tool#mmctl-channel-delete) or `DELETE /api/v4/channels/&#123;channel_id&#125;?permanent=true`, then turn indexing back on and run **Index Now** so changes made while indexing was off are included. The System Console clears search queries and autocomplete when indexing is turned off, because the server will not store those while indexing is off. Turn them back on with indexing.
+Leave the Elasticsearch or OpenSearch cluster running. Save and restart, run the deletes with [`mmctl channel delete`](/administration-guide/manage/mmctl-command-line-tool#mmctl-channel-delete) or `DELETE /api/v4/channels/{channel_id}?permanent=true`, then turn indexing back on and run **Index Now** so changes made while indexing was off are included. The System Console clears search queries and autocomplete when indexing is turned off, because the server will not store those while indexing is off. Turn them back on with indexing.
 
 Documents for those channels can remain in the search index, because indexing is off while they are deleted. Post search only queries channels the user currently belongs to, then loads the posts from the database. Channel search also loads its matches from the database, so a permanently deleted channel is left out. A full index purge is not required to restore search results. Retention requirements may require a scoped cleanup of those leftover copies.
 
```

**File**: `docs/main/administration-guide/configure/environment-variables.mdx` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ The name of the environment variable for any setting can be derived from the nam
 <Note>
 
 - If Mattermost is run from an initialization file, environment variables can be set via `Environment=<>`, or `EnvironmentFile=<path/to/file>`. In the second case, the file specified contains the list of environment variables to set.
-- From Mattermost v7.5, environment configuration parsing supports JSON for `MM_PLUGINSETTINGS_PLUGINS` and `MM_PLUGINSETTINGS_PLUGINSTATES`. This is especially helpful for Helm configuration files, provided all plugins are configured at the same time. For example, `MM_PLUGINSETTINGS_PLUGINSTATES="&#123;\"com.mattermost.calls\":&#123;\"Enable\":true&#125;,\"com.mattermost.nps\":&#123;\"Enable\":true&#125;&#125;"`.
+- From Mattermost v7.5, environment configuration parsing supports JSON for `MM_PLUGINSETTINGS_PLUGINS` and `MM_PLUGINSETTINGS_PLUGINSTATES`. This is especially helpful for Helm configuration files, provided all plugins are configured at the same time. For example, `MM_PLUGINSETTINGS_PLUGINSTATES="{\"com.mattermost.calls\":{\"Enable\":true},\"com.mattermost.nps\":{\"Enable\":true}}"`.
 - When settings are configured through an environment variable, system admins can't modify them in the System Console. If a setting is configured through an environment variable, and any other changes are made in the System Console, the value stored of the environment variable will be written back to the `config.json` as that setting's value.
 - For any setting that's not set in `config.json` or in environment variables, the Mattermost server uses the setting's default value as documented in the sections below on this page.
 
```

**File**: `docs/main/administration-guide/manage/mmctl-command-line-tool.mdx` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ The mmctl tool comes bundled with Mattermost package. For customers that want to
 <Tabs>
 <TabItem value="release-package" label="Release package">
 
-If you're using a release page for Linux, macOS, or Windows, we recommend downloading the mmctl builds through their release URL: `https://releases.mattermost.com/mmctl/$&#123;MATTERMOST_VERSION&#125;/$&#123;PLATFORM&#125;_$&#123;ARCHITECTURE&#125;.tar` (for windows, substitute the `.tar` suffix with `.zip`)
+If you're using a release page for Linux, macOS, or Windows, we recommend downloading the mmctl builds through their release URL: `https://releases.mattermost.com/mmctl/${MATTERMOST_VERSION}/${PLATFORM}_${ARCHITECTURE}.tar` (for windows, substitute the `.tar` suffix with `.zip`)
 
 E.g. to download version `v10.7.0` of the mmctl amd64 build for linux, you can run the following:
 
```

**File**: `docs/main/administration-guide/onboard/sso-gitlab.mdx` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ Follow these steps to configure Mattermost to use GitLab as a Single Sign-on (SS
 
 ### Step 1: Add a Mattermost application to your GitLab account
 
-1.  Log in to your GitLab account, then go to `https://&#123;gitlab-site-name&#125;/profile/applications`. For *&#123;gitlab-site-name&#125;* use the name of your GitLab instance. If you're using GitLab itself as your service provider, use `gitlab.com`.
+1.  Log in to your GitLab account, then go to `https://{gitlab-site-name}/profile/applications`. For *&#123;gitlab-site-name&#125;* use the name of your GitLab instance. If you're using GitLab itself as your service provider, use `gitlab.com`.
 2.  Add a new application:
 
 > 1.  In the **Name** field, enter `Mattermost`.
```

**File**: `docs/main/administration-guide/onboard/sso-google.mdx` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ The [Google People API](https://developers.google.com/people) has replaced the G
 3.  Select **Create Credentials**, then select **OAuth client ID**.
 4.  Select the **Web application** as the application type.
 5.  Enter `Mattermost-<your-company-name>` as the **Name**, replacing `<your-company-name>` with the name of your organization.
-6.  Under **Authorized redirect URIs**, select **Add URL**, then enter `&#123;your-mattermost-url&#125;/signup/google/complete`. For example: `http://localhost:8065/signup/google/complete`.
+6.  Under **Authorized redirect URIs**, select **Add URL**, then enter `{your-mattermost-url}/signup/google/complete`. For example: `http://localhost:8065/signup/google/complete`.
 7.  Select **Create**.
 8.  Copy and paste the **Your Client ID** and **Your Client Secret** values to a temporary location. You will enter these values in the Mattermost System Console.
 
```

**File**: `docs/main/administration-guide/onboard/sso-openidconnect.mdx` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ Follow these steps to configure a service provider using OpenID Connect.
 ## Step 1: Create an OpenID Connect Application
 
 1.  Follow service provider documentation for creating an OpenID Connect application. Most OpenID Connect service providers require authorization of all redirect URIs.
-2.  In the appropriate field, enter `&#123;your-mattermost-url&#125;/signup/openid/complete` For example: `http://domain.com/signup/openid/complete`
+2.  In the appropriate field, enter `{your-mattermost-url}/signup/openid/complete` For example: `http://domain.com/signup/openid/complete`
 3.  Copy and paste values for the **Discovery Endpoint**, **Client ID**, and **Client Secret** values to a temporary location. You will enter these values when you configure Mattermost.
 
 ## Step 2: Configure Mattermost for an OpenID Connect SSO
```

**File**: `docs/main/administration-guide/scale/deploy-grafana-loki-for-centralized-logging.mdx` (modified, +2/-2)
```diff
@@ -375,7 +375,7 @@ The PostgreSQL configuration handles common Ubuntu/Debian JSON log paths (`/var/
 
 </Note>
 
-Once running, PostgreSQL logs appear in Grafana under the label `&#123;service_name="postgres"&#125;`:
+Once running, PostgreSQL logs appear in Grafana under the label `{service_name="postgres"}`:
 
 ``` text
 {service_name="postgres"} | json | detected_level="error"
@@ -399,7 +399,7 @@ Once running, PostgreSQL logs appear in Grafana under the label `&#123;service_n
     # Look for export successful messages or lack of errors
     ```
 
-3.  Logs are visible in Grafana: Go to **Explore**, select the **Loki** data source, and run `&#123;service_name="mattermost"&#125;`. You should see recent log lines.
+3.  Logs are visible in Grafana: Go to **Explore**, select the **Loki** data source, and run `{service_name="mattermost"}`. You should see recent log lines.
 
 4.  The dashboard loads: Open the **Mattermost Log Aggregation** dashboard and confirm panels are populated. (Note: You may need to update dashboard queries to use <code>service_name</code> and <code>service_instance_id</code>).
 
```

**File**: `docs/main/administration-guide/upgrade/upgrading-mattermost-server.mdx` (modified, +4/-4)
```diff
@@ -64,11 +64,11 @@ Make sure that you understand how to [prepare for your upgrade](/administration-
   - This command won't return anything if `/opt/mattermost/bin` wasn't added to the PATH.
   - Alternatively, you can use the `find / -executable -type f -iname mattermost 2> /dev/null` command to find the `mattermost` binary.
   - The output should be similar to `/opt/mattermost/bin/mattermost`.
-  - The install directory is everything before the first occurrence of the string `/mattermost`. In this example, the `&#123;install-path&#125;` is `/opt`.
+  - The install directory is everything before the first occurrence of the string `/mattermost`. In this example, the `{install-path}` is `/opt`.
   - If that command doesn't produce any results, it's likely because your version is older; try `whereis platform` instead.
 - **Location and size of your local storage directory**: The local storage directory contains all the files that users have attached to their messages.
   - If you don't know its location, open the System Console and go to **Environment \> File Storage**, then read the value in **Local Storage Directory**.
-  - Paths are relative to the `mattermost` directory. For example, if the local storage directory is `./data/` then the absolute path is `&#123;install-path&#125;/mattermost/data`.
+  - Paths are relative to the `mattermost` directory. For example, if the local storage directory is `./data/` then the absolute path is `{install-path}/mattermost/data`.
 - **Database disk space**: If you're upgrading a Mattermost deployment on the same server as your database, we recommend a minimum 2GB of free disk space to allow for extraction, copy, and cleanup, and a minimum of twice the size of your Mattermost installation available for the database.
 
 <Tip>
@@ -228,8 +228,8 @@ wget https://releases.mattermost.com/X.X.X/mattermost-team-X.X.X-linux-amd64.tar
 
     </div>
 
-    - If you didn't use `mattermost` as the owner and group of the install directory, run `sudo chown -hR &#123;owner&#125;:&#123;group&#125; &#123;install-path&#125;/mattermost`.
-    - If you're uncertain what owner or group was defined, use the `ls -l &#123;install-path&#125;/mattermost/bin/mattermost` command to obtain them.
+    - If you didn't use `mattermost` as the owner and group of the install directory, run `sudo chown -hR {owner}:{group} {install-path}/mattermost`.
+    - If you're uncertain what owner or group was defined, use the `ls -l {install-path}/mattermost/bin/mattermost` command to obtain them.
 
     </div>
 
```

#### Recent Merged Pull Requests:
- **PR #40032** (2026-11-13): docs: add Out-of-Band Communications use case page (@esarafianou)
- **PR #40026** (2026-11-13): [MM-71856] Note Mobile v2.47 requirement for biometric_authenticated (@devinbinnie)
- **PR #40024** (2026-11-13): Require manage_system to update some environment config settings (@cursor[bot])
- **PR #40023** (2026-11-13): [MM-71873] Remove translate.mattermost.com links from webapp (@cursor[bot])
- **PR #40021** (closed): Skip translate.mattermost.com in external link check (@NARSimoes)
- **PR #40020** (2026-11-13): Automated cherry pick of #38810 (@mattermost-build)

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

## X. post list height shift for posts with multiple image attachments

**RULE**:
When implementing operations in `webapp/channels/src/components/file_attachment_list/media_gallery/media_gallery.scss`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in mattermost/mattermost. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9d59b084`: post list height shift for posts with multiple image attachments. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `webapp/channels/src/components/file_attachment_list/media_gallery/media_gallery.scss`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    container: media-gallery / inline-size;
        --media-gallery-row-height: 216px;

        flex-flow: row wrap;
        align-content: flex-start;
    &--compact &__rows {
        --media-gallery-row-height: 144px;
    }
}

// Sized in CSS rather than from a measured width so the post list sees the
// final height on first render, including in narrow containers like the RHS.
// CSS has no hysteresis, so the RHS reserves its scrollbar gutter to keep a
// scrollbar appearing from toggling the row height near 480px.
@container media-gallery (width < 480px) {
    .MediaGallery__rows {
        --media-gallery-row-height: 144px;
    // Scale to the row height by aspect ratio, without upscaling past the
    // file's native width, clamped to 50-500px.
    --tile-width: max(50px, min(calc(var(--tile-ratio, 1.5) * var(--media-gallery-row-height)), var(--tile-native-width, 500px), 500px));

    width: var(--tile-width);
    max-width: 100%;
    height: var(--media-gallery-row-height);
    flex: 0 0 var(--tile-width);
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
    container-type: inline-size;
        flex-direction: column;
    &__row {
        display: flex;
        width: 100%;
        min-width: 0;
        flex-direction: row;
        align-items: stretch;
        justify-content: flex-start;
        gap: 8px;
        text-align: left;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9d59b084` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
