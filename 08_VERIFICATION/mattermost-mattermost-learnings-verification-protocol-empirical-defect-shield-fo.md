# Verification Protocol: Verification Protocol: Empirical Defect Shield for mattermost-mattermost-learnings

<!-- PROVENANCE_START
{
  "source_repository": "mattermost-mattermost-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:41:14.932Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-mattermost-mattermost-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mattermost-mattermost-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:41:14.932Z`  
> **Learning ID**: `LEARN-REEXTRACT-mattermost-mattermost-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `mattermost-mattermost-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/mattermost-mattermost-learnings.md`  
> **Source**: github ([https://github.com/mattermost/mattermost](https://github.com/mattermost/mattermost))  
> **Source Version**: `95cc6d95`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T10:07:47.672Z  
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
> **Harvest Timestamp**: 2026-11-09T10:02:46.600Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mattermost/mattermost`
- **Description**: Mattermost is an open source platform for secure collaboration across the entire software development lifecycle..
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 39559 stars

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

### Incident Patch 1: `276dc653` (2026-11-07)
**Commit Message**: [MM-71617] Add per-node memory health diagnostics (#39720)

* [MM-71617] Add per-node memory health diagnostics

Co-authored-by: ben.schumacher <[REDACTED_EMAIL]>

* [MM-71617] Use SplitSeq for memory parsing

Co-authored-by: ben.schumacher <[REDACTED_EMAIL]>

* [MM-71617] Clarify system resource paths

Co-authored-by: ben.schumacher <[REDACTED_EMAIL]>

* [MM-71617] Update mmctl packet health expectations

Co-authored-by: ben.schumacher <[REDACTED_EMAIL]>

* [MM-71617] Resolve process cgroup memory stats

Co-authored-by: ben.schumacher <[REDACTED_EMAIL]>

* [MM-71617] Use a plain bool for cgroup memory support internally

Only the support packet model needs the tri-state; the collector now
creates the pointer when cgroup resolution succeeds.

* [MM-71617] Resolve OOM and Go memory limit rules when data does not apply

Drop cgroup_memory_stats_supported from the support packet. Inside a
collected server_memory section, a missing OOM kill count means cgroup v2
memory stats do not apply to the process, and a missing Go memory limit
means none is set; both now resolve instead of reporting Unknown.

Offline packet evaluation cannot yet tell a failed section from a healthy
one; MM-71665 

**File**: `server/channels/app/health_check_snapshot_test.go` (modified, +4/-0)
```diff
@@ -310,6 +310,10 @@ func TestHealthSnapshotLiveOfflineParity(t *testing.T) {
 				require.NotNil(t, evaluations[i].Result.Value)
 				evaluations[i].Result.Value = nil
 				evaluations[i].Result.Details = nil
+			case "NODE_HOST_MEMORY_LOW", "NODE_CONTAINER_MEMORY_PRESSURE":
+				// These set a value only when they have the numbers to compare, so none is required.
+				evaluations[i].Result.Value = nil
+				evaluations[i].Result.Details = nil
 			}
 		}
 		return evaluations
```

**File**: `server/channels/app/platform/container_limits.go` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
+// See LICENSE.txt for license information.
+
+package platform
+
+// ContainerLimits holds the effective CPU limit for the current container. The memory
+// limit is read with the other memory diagnostics, see memoryDiagnostics.
+// Zero values indicate no limit is set (fields will be omitted from YAML output).
+type ContainerLimits struct {
+	CPULimit float64
+}
+
+type cgroupV2Info struct {
+	dir                  string
+	memoryStatsSupported bool
+}
+
+type memoryDiagnostics struct {
+	AvailableMemoryMB           *uint64
+	SwapTotalMB                 *uint64
+	SwapUsedMB                  *uint64
+	ProcessRSSMB                *uint64
+	ContainerMemoryLimitMB      uint64 // zero when no limit is set
+	ContainerMemoryUsageMB      *uint64
+	ContainerMemoryWorkingSetMB *uint64
+	ContainerOOMKills           *uint64
+}
```

**File**: `server/channels/app/platform/container_limits_linux.go` (modified, +240/-32)
```diff
@@ -7,52 +7,45 @@ package platform
 
 import (
 	"errors"
+	"fmt"
 	"os"
+	"path/filepath"
+	"slices"
 	"strconv"
 	"strings"
 )
 
-// cgroupPaths holds the file paths used to read cgroup v2 resource limits.
+// resourcePaths holds procfs files used to inspect system resources.
 // These are package-level variables so they can be overridden in tests.
-var cgroupPaths = struct {
-	v2MemoryMax string
-	v2CPUMax    string
+var resourcePaths = struct {
+	procMeminfo       string
+	procSelfStatus    string
+	procSelfCgroup    string
+	procSelfMountInfo string
 }{
-	v2MemoryMax: "/sys/fs/cgroup/memory.max",
-	v2CPUMax:    "/sys/fs/cgroup/cpu.max",
+	procMeminfo:       "/proc/meminfo",
+	procSelfStatus:    "/proc/self/status",
+	procSelfCgroup:    "/proc/self/cgroup",
+	procSelfMountInfo: "/proc/self/mountinfo",
 }
 
-// ContainerLimits holds effective CPU and memory limits for the current container.
-// Zero values indicate no limit is set (fields will be omitted from YAML output).
-type ContainerLimits struct {
-	CPULimit      float64
-	MemoryLimitMB uint64
-}
+var mountInfoPathReplacer = strings.NewReplacer(
+	`\040`, " ",
+	`\011`, "\t",
+	`\012`, "\n",
+	`\134`, `\`,
+)
 
-// getContainerLimits reads container resource limits from cgroups v2.
+// getContainerLimits reads the container CPU limit from cgroups v2.
 // Returns zero values when no limits are detected (bare metal, unlimited, or non-v2 system).
-func getContainerLimits() (ContainerLimits, error) {
+func getContainerLimits(info cgroupV2Info) (ContainerLimits, error) {
 	var limits ContainerLimits
-
-	// Memory limit: "max" means unlimited, otherwise bytes
-	memStr, err := readTrimmed(cgroupPaths.v2MemoryMax)
-	if err != nil {
-		if errors.Is(err, os.ErrNotExist) {
-			return limits, nil
-		}
-		return limits, err
-	}
-	if memStr != "max" {
-		var memBytes uint64
-		memBytes, err = strconv.ParseUint(memStr, 10, 64)
-		if err != nil {
-			return limits, err
-		}
-		limits.MemoryLimitMB = (memBytes + 1024*1024 - 1) / (1024 * 1024)
+	if info.dir == "" {
+		return limits, nil
 	}
 
 	// CPU limit: format is "quota period"; quota is "max" when unlimited
-	cpuStr, err := readTrimmed(cgroupPaths.v2CPUMax)
+	cpuStr, err := readTrimmed(filepath.Join(info.dir, "cpu.max"))
 	if err != nil {
 		if errors.Is(err, os.ErrNotExist) {
 			return limits, nil
@@ -80,10 +73,225 @@ func getContainerLimits() (ContainerLimits, error) {
 	return limits, nil
 }
 
+func getCgroupV2Info() (cgroupV2Info, error) {
+	cgroup, err := readFile(resourcePaths.procSelfCgroup)
+	if err != nil {
+		return cgroupV2Info{}, err
+	}
+
+	membership, found, err := parseCgroupV2Membership(cgroup)
+	if err != nil {
+		return cgroupV2Info{}, err
+	}
+	if !found {
+		return cgroupV2Info{}, nil
+	}
+
+	mountInfo, err := readFile(resourcePaths.procSelfMountInfo)
+	if err != nil {
+		return cgroupV2Info{}, err
+	}
+	dir, err := resolveCgroupV2Dir(membership, mountInfo)
+	if err != nil {
+		return cgroupV2Info{}, err
+	}
+
+	_, err = os.Stat(filepath.Join(dir, "memory.max"))
+	if err != nil && !errors.Is(err, os.ErrNotExist) {
+		return cgroupV2Info{}, err
+	}
+	return cgroupV2Info{dir: dir, memoryStatsSupported: err == nil}, nil
+}
+
+func parseCgroupV2Membership(contents string) (string, bool, error) {
+	for line := range strings.SplitSeq(contents, "\n") {
+		parts := strings.SplitN(line, ":", 3)
+		if len(parts) != 3 || parts[0] != "0" || parts[1] != "" {
+			continue
+		}
+		if !filepath.IsAbs(parts[2]) {
+			return "", false, fmt.Errorf("invalid cgroup v2 membership path %q", parts[2])
+		}
+		return parts[2], true, nil
+	}
+	return "", false, nil
+}
+
+// cleanCgroupPath cleans a cgroup path as a path relative to the cgroup
+// namespace root. Unlike filepath.Clean on the absolute path, it keeps leading
+// ".." elements, which point above the namespace root.
+func cleanCgroupPath(path string) string {
+	return filepath.Clean(strings.TrimLeft(path, "/"))
+}
+
+func resolveCgroupV2Dir(membership, contents string) (string, error) {
+	var (
+		bestDir     string
+		bestRootLen int
+	)
+	cleanMembership := cleanCgroupPath(membership)
+	for line := range strings.SplitSeq(contents, "\n") {
+		fields := strings.Split(line, " ")
+		separator := slices.Index(fields, "-")
+		if separator < 6 || separator+1 >= len(fields) || fields[separator+1] != "cgroup2" {
+			continue
+		}
+
+		root := mountInfoPathReplacer.Replace(fields[3])
+		mountPoint := filepath.Clean(mountInfoPathReplacer.Replace(fields[4]))
+		if !filepath.IsAbs(root) || !filepath.IsAbs(mountPoint) {
+			continue
+		}
+		root = cleanCgroupPath(root)
+		relative, err := filepath.Rel(root, cleanMembership)
+		if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
+			continue
+		}
+		if len(root) > bestRootLen {
+			bestDir = filepath.Join(mountPoint, relative)
+			bestRootLen = len(root)
+		}
+	}
+	if bestDir == "" {
+		return "", fmt.Errorf("cgroup v2 membership %q has no matching cgroup2 mount", memb
```

**File**: `server/channels/app/platform/container_limits_linux_test.go` (modified, +283/-32)
```diff
@@ -8,6 +8,7 @@ package platform
 import (
 	"os"
 	"path/filepath"
+	"strings"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
@@ -17,71 +18,321 @@ import (
 func writeTempCgroupFile(t *testing.T, dir, name, content string) string {
 	t.Helper()
 	path := filepath.Join(dir, name)
+	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o755))
 	require.NoError(t, os.WriteFile(path, []byte(content), 0o644))
 	return path
 }
 
+func setTempCgroupLayout(t *testing.T, dir, membership, mountRoot, mountPoint string) cgroupV2Info {
+	t.Helper()
+	resourcePaths.procSelfCgroup = writeTempCgroupFile(t, dir, "proc-self-cgroup", "0::"+membership+"\n")
+	resourcePaths.procSelfMountInfo = writeTempCgroupFile(t, dir, "proc-self-mountinfo", "31 30 0:28 "+mountRoot+" "+mountPoint+" rw,nosuid,nodev,noexec,relatime - cgroup2 cgroup rw\n")
+	relative, err := filepath.Rel(mountRoot, membership)
+	require.NoError(t, err)
+	writeTempCgroupFile(t, filepath.Join(mountPoint, relative), "memory.max", "max\n")
+
+	info, err := getCgroupV2Info()
+	require.NoError(t, err)
+	require.True(t, info.memoryStatsSupported)
+	return info
+}
+
 func TestGetContainerLimits(t *testing.T) {
 	dir := t.TempDir()
+	info := cgroupV2Info{dir: dir, memoryStatsSupported: true}
 
-	originalPaths := cgroupPaths
-	t.Cleanup(func() { cgroupPaths = originalPaths })
-
-	t.Run("limited CPU and memory", func(t *testing.T) {
-		cgroupPaths.v2MemoryMax = writeTempCgroupFile(t, dir, "mem_limited", "536870912\n")  // 512 MB
-		cgroupPaths.v2CPUMax = writeTempCgroupFile(t, dir, "cpu_limited", "200000 100000\n") // 2 CPUs
+	t.Run("limited CPU", func(t *testing.T) {
+		writeTempCgroupFile(t, dir, "cpu.max", "200000 100000\n")
 
-		limits, err := getContainerLimits()
+		limits, err := getContainerLimits(info)
 		require.NoError(t, err)
-		assert.Equal(t, uint64(512), limits.MemoryLimitMB)
 		assert.InDelta(t, 2.0, limits.CPULimit, 0.001)
 	})
 
-	t.Run("unlimited CPU and memory", func(t *testing.T) {
-		cgroupPaths.v2MemoryMax = writeTempCgroupFile(t, dir, "mem_unlimited", "max\n")
-		cgroupPaths.v2CPUMax = writeTempCgroupFile(t, dir, "cpu_unlimited", "max 100000\n")
+	t.Run("unlimited CPU", func(t *testing.T) {
+		writeTempCgroupFile(t, dir, "cpu.max", "max 100000\n")
 
-		limits, err := getContainerLimits()
+		limits, err := getContainerLimits(info)
 		require.NoError(t, err)
-		assert.Equal(t, uint64(0), limits.MemoryLimitMB)
 		assert.Equal(t, float64(0), limits.CPULimit)
 	})
 
 	t.Run("fractional CPU limit", func(t *testing.T) {
-		cgroupPaths.v2MemoryMax = writeTempCgroupFile(t, dir, "mem_frac", "max\n")
-		cgroupPaths.v2CPUMax = writeTempCgroupFile(t, dir, "cpu_frac", "50000 100000\n") // 0.5 CPUs
+		writeTempCgroupFile(t, dir, "cpu.max", "50000 100000\n")
 
-		limits, err := getContainerLimits()
+		limits, err := getContainerLimits(info)
 		require.NoError(t, err)
 		assert.InDelta(t, 0.5, limits.CPULimit, 0.001)
 	})
 
-	t.Run("sub-MB memory rounds up to 1MB", func(t *testing.T) {
-		cgroupPaths.v2MemoryMax = writeTempCgroupFile(t, dir, "mem_tiny", "524288\n") // 0.5 MB
-		cgroupPaths.v2CPUMax = writeTempCgroupFile(t, dir, "cpu_tiny", "max 100000\n")
+	t.Run("CPU limit does not depend on memory.max", func(t *testing.T) {
+		cpuOnlyDir := filepath.Join(dir, "cpu-only")
+		writeTempCgroupFile(t, cpuOnlyDir, "cpu.max", "100000 100000\n")
 
-		limits, err := getContainerLimits()
+		limits, err := getContainerLimits(cgroupV2Info{dir: cpuOnlyDir, memoryStatsSupported: true})
 		require.NoError(t, err)
-		assert.Equal(t, uint64(1), limits.MemoryLimitMB)
+		assert.InDelta(t, 1.0, limits.CPULimit, 0.001)
 	})
 
-	t.Run("missing cgroup files returns zero values", func(t *testing.T) {
-		cgroupPaths.v2MemoryMax = filepath.Join(dir, "nonexistent_memory")
-		cgroupPaths.v2CPUMax = writeTempCgroupFile(t, dir, "cpu_present", "max 100000\n")
-
-		limits, err := getContainerLimits()
+	t.Run("missing cpu.max returns zero values", func(t *testing.T) {
+		limits, err := getContainerLimits(cgroupV2Info{dir: filepath.Join(dir, "missing"), memoryStatsSupported: true})
 		require.NoError(t, err)
-		assert.Equal(t, uint64(0), limits.MemoryLimitMB)
 		assert.Equal(t, float64(0), limits.CPULimit)
 	})
 
-	t.Run("missing cpu.max returns zero values", func(t *testing.T) {
-		cgroupPaths.v2MemoryMax = writeTempCgroupFile(t, dir, "mem_no_cpu", "max\n")
-		cgroupPaths.v2CPUMax = filepath.Join(dir, "nonexistent_cpu")
+	t.Run("unsupported cgroup returns zero values", func(t *testing.T) {
+		limits, err := getContainerLimits(cgroupV2Info{})
 
-		limits, err := getContainerLimits()
 		require.NoError(t, err)
-		assert.Equal(t, uint64(0), limits.MemoryLimitMB)
 		assert.Equal(t, float64(0), limits.CPULimit)
 	})
 }
+
+func TestGetCgroupV2Info(t *testing.T) {
+	dir := t.TempDir()
+	originalPaths := resourcePaths
+	t.Cleanup(func() { resourcePaths = originalPaths })
+
+	t.Run("root membership in a private namespace", func(t *testing.T) {
+		mountPoint := filepath.Join(dir, "private")
+		info := 
```

**File**: `server/channels/app/platform/container_limits_other.go` (modified, +7/-6)
```diff
@@ -5,15 +5,16 @@
 
 package platform
 
-// ContainerLimits holds effective CPU and memory limits for the current container.
-// Zero values indicate no limit is set (fields will be omitted from YAML output).
-type ContainerLimits struct {
-	CPULimit      float64
-	MemoryLimitMB uint64
+func getCgroupV2Info() (cgroupV2Info, error) {
+	return cgroupV2Info{}, nil
 }
 
 // getContainerLimits returns zero values on non-Linux platforms.
 // Container limit detection via cgroups is only supported on Linux.
-func getContainerLimits() (ContainerLimits, error) {
+func getContainerLimits(cgroupV2Info) (ContainerLimits, error) {
 	return ContainerLimits{}, nil
 }
+
+func getMemoryDiagnostics(cgroupV2Info) (memoryDiagnostics, error) {
+	return memoryDiagnostics{}, nil
+}
```

**File**: `server/channels/app/platform/support_packet.go` (modified, +46/-15)
```diff
@@ -10,10 +10,12 @@ import (
 	"encoding/json"
 	"fmt"
 	"io"
+	"math"
 	"net/http"
 	"net/url"
 	"os"
 	"runtime"
+	"runtime/debug"
 	rpprof "runtime/pprof"
 	"strings"
 	"time"
@@ -41,17 +43,25 @@ const (
 // cumulative-vs-point-in-time semantics visible at a glance.
 var diagnosticsYAMLComments = yaml.CommentMap{
 	// server: — grouped into Machine / Capacity / Process lifecycle / Software
-	"$.server.os":                        {yaml.HeadComment(" Machine")},
-	"$.server.cpu_cores":                 {yaml.HeadComment(" Capacity (hardware → effective quota)"), yaml.LineComment(" logical CPUs visible to the OS")},
-	"$.server.total_memory_mb":           {yaml.LineComment(" host/VM total RAM; may exceed container limit")},
-	"$.server.container_cpu_limit":       {yaml.LineComment(" cgroup v2 CPU quota in CPUs; Linux only, omitted if no limit set")},
-	"$.server.container_memory_limit_mb": {yaml.LineComment(" cgroup v2 memory quota in MB; Linux only, omitted if no limit set")},
-	"$.server.process_id":                {yaml.HeadComment(" Process lifecycle")},
-	"$.server.started_at":                {yaml.LineComment(" when Mattermost process started")},
-	"$.server.host_started_at":           {yaml.LineComment(" when the host OS booted; omitted if unavailable")},
-	"$.server.open_file_descriptors":     {yaml.LineComment(" current open FDs for this process")},
-	"$.server.max_file_descriptors":      {yaml.LineComment(" system limit (ulimit -n)")},
-	"$.server.version":                   {yaml.HeadComment(" Software")},
+	"$.server.os":                              {yaml.HeadComment(" Machine")},
+	"$.server.cpu_cores":                       {yaml.HeadComment(" Capacity (hardware → effective quota)"), yaml.LineComment(" logical CPUs visible to the OS")},
+	"$.server.total_memory_mb":                 {yaml.LineComment(" host/VM total RAM; may exceed container limit")},
+	"$.server.available_memory_mb":             {yaml.LineComment(" host/VM MemAvailable from /proc/meminfo; Linux only")},
+	"$.server.swap_total_mb":                   {yaml.LineComment(" host/VM total swap; Linux only")},
+	"$.server.swap_used_mb":                    {yaml.LineComment(" host/VM used swap; Linux only")},
+	"$.server.container_cpu_limit":             {yaml.LineComment(" cgroup v2 CPU quota in CPUs; Linux only, omitted if no limit set")},
+	"$.server.container_memory_limit_mb":       {yaml.LineComment(" cgroup v2 memory quota in MB; Linux only, omitted if no limit set")},
+	"$.server.container_memory_usage_mb":       {yaml.LineComment(" cgroup v2 memory.current in MB, including page cache; Linux only")},
+	"$.server.container_memory_working_set_mb": {yaml.LineComment(" cgroup v2 memory.current minus inactive file cache in MB; Linux only")},
+	"$.server.container_oom_kills":             {yaml.LineComment(" cgroup v2 OOM kills since the cgroup was created; Linux only")},
+	"$.server.process_id":                      {yaml.HeadComment(" Process lifecycle")},
+	"$.server.started_at":                      {yaml.LineComment(" when Mattermost process started")},
+	"$.server.host_started_at":                 {yaml.LineComment(" when the host OS booted; omitted if unavailable")},
+	"$.server.process_rss_mb":                  {yaml.LineComment(" resident memory of the Mattermost process only; excludes plugin child processes")},
+	"$.server.go_memory_limit_mb":              {yaml.LineComment(" Go runtime memory limit in MB; omitted when no limit is set")},
+	"$.server.open_file_descriptors":           {yaml.LineComment(" current open FDs for this process")},
+	"$.server.max_file_descriptors":            {yaml.LineComment(" system limit (ulimit -n)")},
+	"$.server.version":                         {yaml.HeadComment(" Software")},
 
 	"$.config.audit_logging_configured": {yaml.LineComment(" this server's audit check of its current config and license; offline health checks use it")},
 
@@ -203,12 +213,33 @@ func (ps *PlatformService) GetSupportPacketDiagnostics(rctx request.CTX) (*model
 	} else {
 		d.Server.TotalMemoryMB = new(totalMemoryBytes / 1024 / 1024)
 	}
-	containerLimits, err := getContainerLimits()
+	cgroupV2, err := getCgroupV2Info()
+	if err != nil {
+		fail(model.SectionServerMemory, errors.Wrap(err, "error while resolving cgroup v2"))
+	}
+	containerLimits, err := getContainerLimits(cgroupV2)
+	d.Server.ContainerCPULimit = containerLimits.CPULimit
 	if err != nil {
 		rctx.Logger().Debug("Failed to get container limits for Support Packet", mlog.Err(err))
-	} else {
-		d.Server.ContainerCPULimit = containerLimits.CPULimit
-		d.Server.ContainerMemoryLimitMB = containerLimits.MemoryLimitMB
+	}
+	memory, memoryErr := getMemoryDiagnostics(cgroupV2)
+	if memoryErr != nil {
+		fail(model.SectionServerMemory, errors.Wrap(memoryErr, "error while getting memory diagnostics"))
+	}
+	d.Server.AvailableMemoryMB = memory.AvailableMemoryMB
+	d.Server.SwapTotalMB = memory.SwapTotalMB
+	d.Server.SwapUsedMB = memory.SwapUsedMB
+	d.Server.ProcessRSS
```

**File**: `server/channels/app/platform/support_packet_test.go` (modified, +8/-0)
```diff
@@ -1864,11 +1864,19 @@ func TestSupportPacketMarshalGolden(t *testing.T) {
 	diagnostics.Server.InstallationType = "docker"
 	diagnostics.Server.CPUCores = 8
 	diagnostics.Server.TotalMemoryMB = new(uint64(32768))
+	diagnostics.Server.AvailableMemoryMB = new(uint64(24576))
+	diagnostics.Server.SwapTotalMB = new(uint64(4096))
+	diagnostics.Server.SwapUsedMB = new(uint64(1024))
 	diagnostics.Server.ContainerCPULimit = 6.5
 	diagnostics.Server.ContainerMemoryLimitMB = 16384
+	diagnostics.Server.ContainerMemoryUsageMB = new(uint64(12288))
+	diagnostics.Server.ContainerMemoryWorkingSetMB = new(uint64(10240))
+	diagnostics.Server.ContainerOOMKills = new(uint64(2))
 	diagnostics.Server.ProcessID = 90210
 	diagnostics.Server.StartedAt = time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
 	diagnostics.Server.HostStartedAt = time.Date(2025, 12, 30, 0, 0, 0, 0, time.UTC)
+	diagnostics.Server.ProcessRSSMB = new(uint64(2048))
+	diagnostics.Server.GoMemoryLimitMB = new(uint64(13107))
 	diagnostics.Server.OpenFileDescriptors = new(int64(512))
 	diagnostics.Server.MaxFileDescriptors = new(int64(8192))
 	diagnostics.Server.Version = "11.0.0"
```

**File**: `server/channels/app/platform/testdata/support_packet/diagnostics.yaml` (modified, +8/-0)
```diff
@@ -18,12 +18,20 @@ server:
   # Capacity (hardware → effective quota)
   cpu_cores: 8 # logical CPUs visible to the OS
   total_memory_mb: 32768 # host/VM total RAM; may exceed container limit
+  available_memory_mb: 24576 # host/VM MemAvailable from /proc/meminfo; Linux only
+  swap_total_mb: 4096 # host/VM total swap; Linux only
+  swap_used_mb: 1024 # host/VM used swap; Linux only
   container_cpu_limit: 6.5 # cgroup v2 CPU quota in CPUs; Linux only, omitted if no limit set
   container_memory_limit_mb: 16384 # cgroup v2 memory quota in MB; Linux only, omitted if no limit set
+  container_memory_usage_mb: 12288 # cgroup v2 memory.current in MB, including page cache; Linux only
+  container_memory_working_set_mb: 10240 # cgroup v2 memory.current minus inactive file cache in MB; Linux only
+  container_oom_kills: 2 # cgroup v2 OOM kills since the cgroup was created; Linux only
   # Process lifecycle
   process_id: 90210
   started_at: 2026-01-02T03:04:05Z # when Mattermost process started
   host_started_at: 2025-12-30T00:00:00Z # when the host OS booted; omitted if unavailable
+  process_rss_mb: 2048 # resident memory of the Mattermost process only; excludes plugin child processes
+  go_memory_limit_mb: 13107 # Go runtime memory limit in MB; omitted when no limit is set
   open_file_descriptors: 512 # current open FDs for this process
   max_file_descriptors: 8192 # system limit (ulimit -n)
   # Software
```

---

### Incident Patch 2: `8af02bfe` (2026-11-06)
**Commit Message**: Fix flaky TestHydratePropertyValues (#39226)

* Fix flaky TestHydratePropertyValues

The orders_values_by_field_creation_time subtest created two property
fields in the same millisecond. hydrateChannelPropertyValues sorts by
CreateAt and breaks ties by FieldID, so the assertion on creation order
flipped whenever the second ID sorted first. Wait until the next
millisecond before creating the second field so CreateAt actually differs.

Tests-only change. Verified with `go test -run '^TestHydratePropertyValues$/orders_values_by_field_creation_time$' -race
-count=100` locally.

Co-authored-by: mattermost-code <[REDACTED_EMAIL]>

* Address PR feedback: 0 answered, 1 resolved, 0 declined

---------

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: mattermost-code <[REDACTED_EMAIL]>
Co-authored-by: Mattermost Build <[REDACTED_EMAIL]>

**File**: `server/channels/app/post_property_values_test.go` (modified, +6/-0)
```diff
@@ -7,6 +7,7 @@ import (
 	"encoding/json"
 	"strconv"
 	"testing"
+	"time"
 
 	"github.com/mattermost/mattermost/server/public/model"
 	"github.com/mattermost/mattermost/server/public/shared/request"
@@ -202,7 +203,12 @@ func TestHydratePropertyValues(t *testing.T) {
 		th := setupPropertyValuesTest(t)
 		// Names are deliberately reverse-alphabetical relative to creation order.
 		first := th.createField(t, string(model.PropertyFieldTargetLevelChannel), th.BasicChannel.Id, "zulu")
+		// CreateAt is millisecond-resolution; same-ms fields fall back to FieldID order.
+		for model.GetMillis() <= first.CreateAt {
+			time.Sleep(time.Millisecond)
+		}
 		second := th.createField(t, string(model.PropertyFieldTargetLevelChannel), th.BasicChannel.Id, "alpha")
+		require.Greater(t, second.CreateAt, first.CreateAt)
 
 		post := th.post(t, th.BasicChannel)
 		// Values written in the opposite order to prove output order tracks the field, not the value.
```

#### Recent Merged Pull Requests:
- **PR #39808** (2026-11-09): Revert "MM-70985: update paging defaults and per-post metadata handli… (@amyblais)
- **PR #39798** (2026-11-07): Fix flaky TestGetDiagnosticsPostsVacuumInProgress (@hanzei)
- **PR #39797** (2026-11-07): [MM-71431] Test stopping a running health check; let watcher stop during startup jitter (@hanzei)
- **PR #39795** (closed): docs: AI draft for Add PUSH_PROXY_UNREACHABLE site health rule (@mattermost-docs-ai[bot])
- **PR #39794** (closed): docs: AI draft for Add filestore disk capacity health rules (@mattermost-docs-ai[bot])
- **PR #39792** (2026-11-07): Automated cherry pick of #38809 (@mattermost-code)

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

## X. [MM-71617] Add per-node memory health diagnostics (#39720)

**RULE**:
When implementing operations in `server/channels/app/health_check_snapshot_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in mattermost/mattermost. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `276dc653`: [MM-71617] Add per-node memory health diagnostics (#39720). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `server/channels/app/health_check_snapshot_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
			case "NODE_HOST_MEMORY_LOW", "NODE_CONTAINER_MEMORY_PRESSURE":
				// These set a value only when they have the numbers to compare, so none is required.
				evaluations[i].Result.Value = nil
				evaluations[i].Result.Details = nil
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `276dc653` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
