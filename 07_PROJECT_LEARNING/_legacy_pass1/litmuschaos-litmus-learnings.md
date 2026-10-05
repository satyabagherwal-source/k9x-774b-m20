# Forensic Learning Record (Deep Inspection): litmuschaos/litmus

> **Canonical Artifact**: `07_PROJECT_LEARNING/litmuschaos-litmus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/litmuschaos/litmus](https://github.com/litmuschaos/litmus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:32:33.757Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `litmuschaos/litmus`
- **Description**: Litmus helps  SREs and developers practice chaos engineering in a Cloud-native way. Chaos experiments are published at the ChaosHub  (https://hub.litmuschaos.io). Community notes is at https://hackmd.io/a4Zu_sH4TZGeih-xCimi3Q
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5624 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `chaoscenter/authentication/api/handlers/doc.go`
```
package response

import (
	"github.com/gin-gonic/gin"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/entities"
)

type Response struct {
	Response string
}

type ApiTokenResponse struct {
	UserID    string
	Name      string
	Token     string
	ExpiresAt int64
	CreatedAt int64
}

type Role string
type UserResponse struct {
	ID            string `bson:"_id,omitempty" json:"userID"`
	Username      string `bson:"username,omitempty" json:"username"`
	Password      string `bson:"password,omitempty" json:"password,omitempty"`
	Email         string `bson:"email,omitempty" json:"email,omitempty"`
	Name          string `bson:"name,omitempty" json:"name,omitempty"`
	Role          Role   `bson:"role,omitempty" json:"role"`
	DeactivatedAt *int64 `bson:"deactivated_at,omitempty" json:"deactivatedAt,omitempty"`
}

type CapabilitiesResponse struct {
	Dex struct {
		Enabled bool `json:"enabled"`
	} `json:"dex"`
}

type MessageResponse struct {
	Message string `json:"message"`
}

type NewApiToken struct {
	accessToken string
}

type LoginResponse struct {
	accessToken string
	projectID   string
	projectRole string
	expiresIn   string
}

// HTTPError example

func NewError(ctx *gin.Context, status int, err error) {
	er := HTTPError{
		Code:    status,
		Message: err.Error(),
	}
	ctx.JSON(status, er)
}

type HTTPError struct {
	Code    int    `json:"code" example:"400"`
	Message string `json:"message" example:"status bad request"`
}

type ErrServerError struct {
	Code    int    `json:"code" example:"500"`
	Message string `json:"message" example:"The authorization server encountered an unexpected condition that prevented it from fulfilling the request"`
}
type ErrInvalidCredentials struct {
	Code    int    `json:"code" example:"401"`
	Message string `json:"message" example:"Invalid Credentials"`
}

type ErrInvalidRequest struct {
	Code    int    `json:"code" example:"400"`
	Message string `json:"message" example:"The request is missing a required parameter, includes an invalid parameter value, includes a parameter more than once, or is otherwise malformed"`
}

type ErrOldPassword struct {
	Code    int    `json:"code" example:"400"`
	Message string `json:"message" example:"The old and new passwords can't be same"`
}

type ErrUnauthorized struct {
	Code    int    `json:"code" example:"401"`
	Message string `json:"message" example:"The user does not have requested authorization to access this resource"`
}

type ErrUserExists struct {
	Code    int    `json:"code" example:"401"`
	Message string `json:"message" example:"This username is already assigned to another user"`
}

type ErrUserNotFound struct {
	Code    int    `json:"code" example:"400"`
	Message string `json:"message" example:"user does not exist"`
}

type ErrUserDeactivated struct {
	Code    int    `json:"code" example:"400"`
	Message string `json:"message" example:"your account has been deactivated"`
}

type ErrStrictPasswordPolicyViolation struct {
	Code    int    `json:"code" example:"401"`
	Message string `json:"message" example:"Please ensure the password is atleast 8 characters and atmost 16 characters long and has atleast 1 digit, 1 lowercase alphabet, 1 uppercase alphabet and 1 special character"`
}

type ErrStrictUsernamePolicyViolation struct {
	Code    int    `json:"code" example:"401"`
	Message string `json:"message" example:"The username should be at least 3 characters long and at most 254 characters long, must start with a letter or digit, and can only contain letters, digits, and the characters . _ - @ +"`
}

type ErrEmptyProjectName struct {
	Code    int    `json:"code" example:"400"`
	Message string `json:"message" example:"Project name can't be empty"`
}

type ErrInvalidRole struct {
	Code    int    `json:"code" example:"400"`
	Message string `json:"message" example:"Role is invalid"`
}

type ErrProjectNotFound struct {
	Code    int    `json:"code" example:"400"`
	Message string `json:"message" example:"This project does not exist"`
}

type ErrInvalidEmail struct {
	Code    int    `json:"code" example:"400"`
	Message string `json:"message" example:"Email address is invalid"`
}

type ErrProjectNotFoundstruct struct {
	Code    int    `json:"code" example:"400"`
	Message string `json:"message" example:"project does not exist"`
}

type ReadinessAPIStatus struct {
	DataBase    string `json:"database"`
	Collections string `json:"collections"`
}

type APIStatus struct {
	Status string `json:"status"`
}

type UserWithProject struct {
	Data entities.UserWithProject `json:"data"`
}

type Project struct {
	Data entities.Project `json:"data"`
}

type Projects struct {
	Data []*entities.Project `json:"data"`
}

type ListProjectResponse struct {
	Data entities.ListProjectResponse `json:"data"`
}

type ProjectStats struct {
	Data []*entities.ProjectStats `json:"data"`
}

type Members struct {
	Data []*entities.Member `json:"data"`
}

type Member struct {
	Data entities.Member `json:"data"`
}

type ListInvitationResponse struct {
	Data []entities.ListInvitationResponse `json:"data"`
}

type ProjectRole struct {
	Role string `json:"role"`
}

type ProjectIDWithMessage struct {
	Message   string `json:"message"`
	ProjectID string `json:"projectID"`
}

```

### Core Architecture Module: `chaoscenter/authentication/api/handlers/grpc/grpc_handler.go`
```
package grpc

import (
	"context"
	"strconv"

	"github.com/litmuschaos/litmus/chaoscenter/authentication/api/presenter/protos"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/entities"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/validations"

	log "github.com/sirupsen/logrus"

	"github.com/golang-jwt/jwt/v4"
)

func (s *ServerGrpc) ValidateRequest(ctx context.Context,
	inputRequest *protos.ValidationRequest) (*protos.ValidationResponse, error) {
	token, err := s.ValidateToken(inputRequest.Jwt)
	if err != nil {
		return &protos.ValidationResponse{Error: err.Error(), IsValid: false}, err
	}
	claims := token.Claims.(jwt.MapClaims)

	if claims["uid"] == nil {
		return &protos.ValidationResponse{Error: "token is invalid", IsValid: false}, err
	}

	uid := claims["uid"].(string)
	err = validations.RbacValidator(uid, inputRequest.ProjectId,
		inputRequest.RequiredRoles, inputRequest.Invitation, s.ApplicationService)
	if err != nil {
		return &protos.ValidationResponse{Error: err.Error(), IsValid: false}, err
	}
	return &protos.ValidationResponse{Error: "", IsValid: true}, nil
}

func (s *ServerGrpc) GetProjectById(ctx context.Context,
	inputRequest *protos.GetProjectByIdRequest) (*protos.GetProjectByIdResponse, error) {

	project, err := s.ApplicationService.GetProjectByProjectID(inputRequest.ProjectID)
	if err != nil {
		log.Error(err)
		return nil, err
	}

	// Fetching user ids of all the members in the project
	var uids []string

	for _, member := range project.Members {
		uids = append(uids, member.UserID)
	}

	memberMap := make(map[string]entities.User)

	authUsers, err := s.ApplicationService.FindUsersByUID(uids)
	for _, authUser := range *authUsers {
		memberMap[authUser.ID] = authUser
	}

	var projectMembers []*protos.ProjectMembers

	// Adding additional details of project members
	for _, member := range project.Members {
		var projectMember protos.ProjectMembers
		projectMember.Email = memberMap[member.UserID].Email
		projectMember.Username = memberMap[member.UserID].Username
		projectMember.Invitation = string(member.Invitation)
		projectMember.Uid = member.UserID
		projectMember.JoinedAt = strconv.FormatInt(member.JoinedAt, 10)
		projectMembers = append(projectMembers, &projectMember)
	}

	if err != nil {
		return nil, err
	}

	return &protos.GetProjectByIdResponse{
		Id:        project.ID,
		Name:      project.Name,
		Members:   projectMembers,
		State:     "",
		CreatedAt: strconv.FormatInt(project.CreatedAt, 10),
		UpdatedAt: strconv.FormatInt(project.UpdatedAt, 10),
	}, nil
}

func (s *ServerGrpc) GetUserById(ctx context.Context,
	inputRequest *protos.GetUserByIdRequest) (*protos.GetUserByIdResponse, error) {
	user, err := s.ApplicationService.GetUser(inputRequest.UserID)
	if err != nil {
		log.Error(err)
		return nil, err
	}
	var deactivatedAt string
	if user.DeactivatedAt != nil {
		deactivatedAt = strconv.FormatInt(*user.DeactivatedAt, 10)
	}
	return &protos.GetUserByIdResponse{
		Id:            user.ID,
		Name:          user.Name,
		Username:      user.Username,
		CreatedAt:     strconv.FormatInt(user.CreatedAt, 10),
		UpdatedAt:     strconv.FormatInt(user.UpdatedAt, 10),
		DeactivatedAt: deactivatedAt,
		Role:          string(user.Role),
		Email:         user.Email,
	}, nil
}

```

### Core Architecture Module: `chaoscenter/authentication/api/handlers/grpc/grpc_server.go`
```
package grpc

import (
	"github.com/litmuschaos/litmus/chaoscenter/authentication/api/presenter/protos"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/services"
)

type ServerGrpc struct {
	services.ApplicationService
	protos.UnimplementedAuthRpcServiceServer
}

```

### Core Architecture Module: `chaoscenter/authentication/api/handlers/rest/capabilities_handler.go`
```
package rest

import (
	"github.com/gin-gonic/gin"
	response "github.com/litmuschaos/litmus/chaoscenter/authentication/api/handlers"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/utils"
)

// GetCapabilities 		godoc
//
//	@Summary		Get capabilities of Auth Server.
//	@Description	Returns capabilities that can be leveraged by frontend services to toggle certain features.
//	@Tags			CapabilitiesRouter
//	@Accept			json
//	@Produce		json
//	@Failure		500	{object}	response.ErrServerError
//	@Success		200	{object}	response.CapabilitiesResponse{}
//	@Router			/capabilities [get]
//
// GetCapabilities returns the capabilities of the Auth Server.
func GetCapabilities() gin.HandlerFunc {
	return func(c *gin.Context) {
		capabilities := new(response.CapabilitiesResponse)
		capabilities.Dex.Enabled = utils.OAuthEnabled
		c.JSON(200, capabilities)
	}
}

```

### Core Architecture Module: `chaoscenter/authentication/api/handlers/rest/dex_auth_handler.go`
```
package rest

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/litmuschaos/litmus/chaoscenter/authentication/api/presenter"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/entities"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/services"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/utils"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	"golang.org/x/oauth2"
)

func oAuthConfig() (*oauth2.Config, *oidc.IDTokenVerifier, error) {
	ctx := oidc.ClientContext(context.Background(), &http.Client{})
	provider, err := oidc.NewProvider(ctx, utils.OAuthOIDCIssuer)
	if err != nil {
		log.Errorf("OAuth Error: Something went wrong with OIDC provider %s", err)
		return nil, nil, err
	}
	return &oauth2.Config{
		RedirectURL:  utils.OAuthCallBackURL,
		ClientID:     utils.OAuthClientID,
		ClientSecret: utils.OAuthClientSecret,
		Scopes:       []string{"openid", "profile", "email"},
		Endpoint:     provider.Endpoint(),
	}, provider.Verifier(&oidc.Config{ClientID: utils.OAuthClientID}), nil
}

// OAuthLogin		godoc
//
//	@Description	Initiates OAuth login by redirecting to the configured OIDC provider.
//	@Tags			OAuthRouter
//	@Accept			json
//	@Produce		json
//	@Failure		500	{object}	response.ErrServerError
//	@Success		307	{string}	string	"Temporary Redirect"
//	@Router			/oauth/login [get]
//
// OAuthLogin handles to proceed with OAuth
func OAuthLogin() gin.HandlerFunc {
	return func(c *gin.Context) {

		stateToken, err := utils.GenerateOAuthJWT()
		if err != nil {
			log.Error(err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}
		config, _, err := oAuthConfig()
		if err != nil {
			log.Error(err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}
		url := config.AuthCodeURL(stateToken)
		c.Redirect(http.StatusTemporaryRedirect, url)
	}
}

// OAuthCallback		godoc
//
//	@Description	Handles the OAuth callback from the configured OIDC provider.
//	@Tags			OAuthRouter
//	@Accept			json
//	@Produce		json
//	@Failure		500	{object}	response.ErrServerError
//	@Success		308	{string}	string	"Permanent Redirect"
//	@Router			/oauth/callback [get]
//
// OAuthCallback handles the callback from OAuth provider and creates a new user if not present in the database
func OAuthCallback(userService services.ApplicationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		incomingState := c.Query("state")
		validated, err := utils.ValidateOAuthJWT(incomingState)
		if err != nil || !validated {
			c.Redirect(http.StatusTemporaryRedirect, "/")
			return
		}
		config, verifier, err := oAuthConfig()
		if err != nil {
			log.Error(err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}
		token, err := config.Exchange(context.Background(), c.Query("code"))
		if err != nil {
			log.Error(err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}

		rawIDToken, ok := token.Extra("id_token").(string)
		if !ok {
			log.Error("OAuth Error: no raw id_token found")
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}
		idToken, err := verifier.Verify(c, rawIDToken)
		if err != nil {
			log.Error("OAuth Error: no id_token found")
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}

		var claims struct {
			Name     string
			Email    string `json:"email"`
			Verified bool   `json:"email_verified"`
		}
		if err := idToken.Claims(&claims); err != nil {
			log.Error("OAuth Error: claims not found")
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}
		// The email is what the account is keyed on below, so it is only usable
		// once the provider states that it belongs to the subject.
		if claims.Email == "" || !claims.Verified {
			log.Errorf("OAuth Error: subject %s has no verified email claim", idToken.Subject)
			c.JSON(utils.ErrorStatusCodes[utils.ErrUnauthorized], presenter.CreateErrorResponse(utils.ErrUnauthorized))
			return
		}
		createdAt := time.Now().UnixMilli()

		var userData = entities.User{
			Name:     claims.Name,
			Email:    claims.Email,
			Username: claims.Email,
			Role:     entities.RoleUser,
			Audit: entities.Audit{
				CreatedAt: createdAt,
				UpdatedAt: createdAt,
			},
		}

		signedInUser, err := userService.LoginUser(&userData)
		if err != nil {
			log.Error(err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}

		salt, err := userService.GetConfig("salt")
		if err != nil {
			log.Error(err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}

		jwtToken, err := userService.GetSignedJWT(signedInUser, salt.Value)
		if err != nil {
			log.Error(err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}

		var defaultProject string
		ownerProjects, err := userService.GetOwnerProjectIDs(c, signedInUser.ID)

		if len(ownerProjects) > 0 {
			defaultProject = ownerProjects[0].ID
		} else {
			// Adding user as project owner in project's member list
			newMember := &entities.Member{
				UserID:     signedInUser.ID,
				Role:       entities.RoleOwner,
				Invitation: entities.AcceptedInvitation,
				Username:   signedInUser.Username,
				Name:       signedInUser.Name,
				Email:      signedInUser.Email,
				JoinedAt:   time.Now().UnixMilli(),
			}
			var members []*entities.Member
			members = append(members, newMember)
			state := "active"
			newProject := &entities.Project{
				ID:      uuid.Must(uuid.NewRandom()).String(),
				Name:    signedInUser.Username + "-project",
				Members: members,
				State:   &state,
				Audit: entities.Audit{
					IsRemoved: false,
					CreatedAt: time.Now().UnixMilli(),
					CreatedBy: entities.UserDetailResponse{
						Username: signedInUser.Username,
						UserID:   signedInUser.ID,
						Email:    signedInUser.Email,
					},
					UpdatedAt: time.Now().UnixMilli(),
					UpdatedBy: entities.UserDetailResponse{
						Username: signedInUser.Username,
						UserID:   signedInUser.ID,
						Email:    signedInUser.Email,
					},
				},
			}
			err := userService.CreateProject(newProject)
			if err != nil {
				return
			}
			defaultProject = newProject.ID
		}

		c.Redirect(http.StatusPermanentRedirect, "/login?jwtToken="+jwtToken+"&projectID="+defaultProject+"&projectRole="+string(entities.RoleOwner))
	}
}

```

### Core Architecture Module: `chaoscenter/authentication/api/handlers/rest/misc_handlers.go`
```
package rest

import (
	"net/http"

	response "github.com/litmuschaos/litmus/chaoscenter/authentication/api/handlers"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/services"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

func contains(s []string, str string) bool {
	for _, v := range s {
		if v == str {
			return true
		}
	}

	return false
}

// Status 		godoc
//
//	@Description	Status will request users list and return, if successful, a http code 200.
//	@Tags			MiscRouter
//	@Accept			json
//	@Produce		json
//	@Failure		500	{object}	response.ErrServerError
//	@Success		200	{object}	response.APIStatus{}
//	@Router			/status [get]
//
// Status will request users list and return, if successful, a http code 200
func Status(service services.ApplicationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		_, err := service.GetUsers()
		if err != nil {
			log.Error(err)
			c.JSON(http.StatusInternalServerError, response.APIStatus{Status: "down"})
			return
		}
		c.JSON(http.StatusOK, response.APIStatus{Status: "up"})
	}
}

// Readiness 		godoc
//
//	@Description	Return list of tags.
//	@Tags			MiscRouter
//	@Accept			json
//	@Produce		json
//	@Failure		500	{object}	response.ErrServerError
//	@Success		200	{object}	response.ReadinessAPIStatus{}
//	@Router			/readiness [get]
//
// Readiness will return the status of the database and collections
func Readiness(service services.ApplicationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var (
			dbFlag  = "up"
			colFlag = "up"
		)

		dbs, err := service.ListDataBase()
		if !contains(dbs, "auth") {
			dbFlag = "down"
		}

		if err != nil {
			log.Error(err)
			c.JSON(http.StatusInternalServerError, response.ReadinessAPIStatus{DataBase: "down", Collections: "unknown"})
			return
		}

		cols, err := service.ListCollection()
		if !contains(cols, "project") || !contains(cols, "users") {
			colFlag = "down"
		}

		if err != nil {
			log.Error(err)
			c.JSON(http.StatusInternalServerError, response.ReadinessAPIStatus{DataBase: dbFlag, Collections: "down"})
			return
		}

		c.JSON(http.StatusOK, response.ReadinessAPIStatus{DataBase: dbFlag, Collections: colFlag})
	}
}

```

### Core Architecture Module: `chaoscenter/authentication/api/handlers/rest/project_handler.go`
```
package rest

import (
	"errors"
	"net/http"
	"time"

	response "github.com/litmuschaos/litmus/chaoscenter/authentication/api/handlers"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/api/presenter"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/api/types"
	projectUtils "github.com/litmuschaos/litmus/chaoscenter/authentication/api/utils"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/entities"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/services"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/utils"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/validations"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	log "github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// GetUserWithProject 		godoc
//
//	@Summary		Get user with project.
//	@Description	Return users who have a project.
//	@Tags			ProjectRouter
//	@Param			username	path	string	true	"Username"
//	@Accept			json
//	@Produce		json
//	@Failure		401	{object}	response.ErrUnauthorized
//	@Failure		400	{object}	response.ErrUserNotFound
//	@Failure		500	{object}	response.ErrServerError
//	@Success		200	{object}	response.UserWithProject{}
//	@Router			/get_user_with_project/:username [get]
//
// GetUserWithProject returns user and project details based on username
func GetUserWithProject(service services.ApplicationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		username := c.Param("username")

		// Validating logged-in user
		// Must be either requesting info from the logged-in user
		// or any user if it has the admin role
		role := c.MustGet("role").(string)
		if c.MustGet("username").(string) != username && role != string(entities.RoleAdmin) {
			log.Error("auth error: unauthorized")
			c.JSON(utils.ErrorStatusCodes[utils.ErrUnauthorized],
				presenter.CreateErrorResponse(utils.ErrUnauthorized))
			return
		}

		user, err := service.FindUserByUsername(username)
		if err != nil {
			log.Error(err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrUserNotFound], presenter.CreateErrorResponse(utils.ErrUserNotFound))
			return
		}

		request := projectUtils.GetProjectFilters(c)
		request.UserID = user.ID

		res, err := service.GetProjectsByUserID(request)
		if err != nil {
			log.Error(err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}

		outputUser := entities.UserWithProject{
			Username: user.Username,
			ID:       user.ID,
			Email:    user.Email,
			Name:     user.Name,
			Projects: res.Projects,
		}

		c.JSON(http.StatusOK, response.UserWithProject{Data: outputUser})
	}
}

// GetProject 		godoc
//
//	@Summary		Get user with project.
//	@Description	Return a project.
//	@Tags			ProjectRouter
//	@Param			project_id	path	string	true	"Project ID"
//	@Accept			json
//	@Produce		json
//	@Failure		401	{object}	response.ErrUnauthorized
//	@Failure		500	{object}	response.ErrServerError
//	@Success		200	{object}	response.Project{}
//	@Router			/get_project/:project_id [get]
//
// GetProject queries the project with a given projectID from the database
func GetProject(service services.ApplicationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		projectID := c.Param("project_id")
		userRole := c.MustGet("role").(string)

		if userRole != string(entities.RoleAdmin) {
			err := validations.RbacValidator(c.MustGet("uid").(string), projectID,
				validations.MutationRbacRules["getProject"], string(entities.AcceptedInvitation), service)
			if err != nil {
				log.Warn(err)
				c.JSON(utils.ErrorStatusCodes[utils.ErrUnauthorized],
					presenter.CreateErrorResponse(utils.ErrUnauthorized))
				return
			}
		}

		project, err := service.GetProjectByProjectID(projectID)
		if err != nil {
			log.Error(err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}

		c.JSON(http.StatusOK, response.Project{Data: *project})
	}
}

// GetProjectsByUserID 		godoc
//
//	@Summary		Get stats of a project.
//	@Description	Return stats of a project.
//	@Tags			ProjectRouter
//	@Accept			json
//	@Produce		json
//	@Failure		500	{object}	response.ErrServerError
//	@Success		200	{object}	response.ListProjectResponse{}
//	@Router			/list_projects [get]
//
// GetProjectsByUserID queries the project with a given userID from the database and returns it in the appropriate format
func GetProjectsByUserID(service services.ApplicationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		request := projectUtils.GetProjectFilters(c)

		res, err := service.GetProjectsByUserID(request)
		if res == nil || (res.TotalNumberOfProjects != nil && *res.TotalNumberOfProjects == 0) {
			c.JSON(http.StatusOK, gin.H{
				"message": "No projects found",
			})
			return
		}
		if err != nil {
			log.Error(err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}

		c.JSON(http.StatusOK, response.ListProjectResponse{Data: *res})
	}
}

// GetProjectStats 		godoc
//
//	@Summary		Get stats of a project.
//	@Description	Return stats of a project.
//	@Tags			ProjectRouter
//	@Accept			json
//	@Produce		json
//	@Failure		500	{object}	response.ErrServerError
//	@Success		200	{object}	response.ProjectStats{}
//	@Router			/get_projects_stats [get]
//
// GetProjectStats is used to retrieve stats related to projects in the DB
func GetProjectStats(service services.ApplicationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.MustGet("role").(string)
		if role != string(entities.RoleAdmin) {
			c.JSON(http.StatusBadRequest, gin.H{
				"message": "Permission denied, user is not admin",
			})
		}
		project, err := service.GetProjectStats()
		if project == nil {
			c.JSON(http.StatusOK, gin.H{
				"message": "No projects found",
			})
		}
		if err != nil {
			log.Error(err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}
		c.JSON(http.StatusOK, response.ProjectStats{Data: project})
	}
}

// GetActiveProjectMembers 		godoc
//
//	@Summary		Get active project members.
//	@Description	Return list of active project members.
//	@Tags			ProjectRouter
//	@Param			state	path	string	true	"State"
//	@Accept			json
//	@Produce		json
//	@Failure		500	{object}	response.ErrServerError
//	@Success		200	{object}	response.Members{}
//	@Router			/get_project_members/:project_id/:state [get]
//
// GetActiveProjectMembers returns the list of active project members
func GetActiveProjectMembers(service services.ApplicationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		projectID := c.Param("project_id")
		state := c.Param("state")
		role := c.MustGet("role").(string)
		if role != string(entities.RoleAdmin) {
			err := validations.RbacValidator(c.MustGet("uid").(string), projectID,
				validations.MutationRbacRules["getActiveProjectMembers"], string(entities.AcceptedInvitation), service)
			if err != nil {
				log.Warn(err)
				c.JSON(utils.ErrorStatusCodes[utils.ErrUnauthorized],
					presenter.CreateErrorResponse(utils.ErrUnauthorized))
				return
			}
		}

		members, err := service.GetProjectMembers(projectID, state)
		if err != nil {
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}
		c.JSON(http.StatusOK, response.Members{Data: members})
	}
}

// GetActiveProjectOwners 		godoc
//
//	@Summary		Get active project Owners.
//	@Description	Return list of active project owners.
//	@Tags			ProjectRouter
//	@Param			state	path	string	true	"State"
//	@Accept			json
//	@Produce		json
//	@Failure		500	{object}	response.ErrServerError
//	@Success		200	{object}	response.Members{}
//	@Router			/get_project_owners/:project_id/:state [get]
//
// GetActiveProjectOwners returns the list of active project owners
func GetActiveProjectOwners(service services.Appl
```

### Core Architecture Module: `chaoscenter/authentication/api/handlers/rest/user_handlers.go`
```
package rest

import (
	"errors"
	"net/http"
	"strings"
	"time"

	response "github.com/litmuschaos/litmus/chaoscenter/authentication/api/handlers"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/api/presenter"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/entities"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/services"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/utils"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/validations"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	log "github.com/sirupsen/logrus"
	"golang.org/x/crypto/bcrypt"
)

const BearerSchema = "Bearer "

// CreateUser		godoc
//
//	@Description	Create new user.
//	@Tags			UserRouter
//	@Accept			json
//	@Produce		json
//	@Failure		400	{object}	response.ErrInvalidRequest
//	@Failure		401	{object}	response.ErrUnauthorized
//	@Failure		400	{object}	response.ErrInvalidEmail
//	@Failure		401	{object}	response.ErrStrictPasswordPolicyViolation
//	@Failure		401	{object}	response.ErrStrictUsernamePolicyViolation
//	@Failure		401	{object}	response.ErrUserExists
//	@Failure		500	{object}	response.ErrServerError
//	@Success		200	{object}	response.UserResponse{}
//	@Router			/create_user [post]
//
// CreateUser creates a new user
func CreateUser(service services.ApplicationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole := c.MustGet("role").(string)

		if entities.Role(userRole) != entities.RoleAdmin {
			c.AbortWithStatusJSON(utils.ErrorStatusCodes[utils.ErrUnauthorized], presenter.CreateErrorResponse(utils.ErrUnauthorized))
			return
		}

		var userRequest entities.User
		err := c.BindJSON(&userRequest)
		if err != nil {
			log.Warn(err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrInvalidRequest], presenter.CreateErrorResponse(utils.ErrInvalidRequest))
			return
		}

		if userRequest.Role != entities.RoleUser && userRequest.Role != entities.RoleAdmin {
			c.JSON(utils.ErrorStatusCodes[utils.ErrInvalidRequest], presenter.CreateErrorResponse(utils.ErrInvalidRequest))
			return
		}

		userRequest.Username = utils.SanitizeString(userRequest.Username)
		if userRequest.Role == "" || userRequest.Username == "" || userRequest.Password == "" {
			c.JSON(utils.ErrorStatusCodes[utils.ErrInvalidRequest], presenter.CreateErrorResponse(utils.ErrInvalidRequest))
			return
		}
		//username validation
		err = utils.ValidateStrictUsername(userRequest.Username)
		if err != nil {
			c.JSON(utils.ErrorStatusCodes[utils.ErrStrictUsernamePolicyViolation], presenter.CreateErrorResponse(utils.ErrStrictUsernamePolicyViolation))
			return
		}

		// Assigning UID to user
		uID := uuid.Must(uuid.NewRandom()).String()
		userRequest.ID = uID
		userRequest.IsInitialLogin = true

		// Generating password hash
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(userRequest.Password), utils.PasswordEncryptionCost)
		if err != nil {
			log.Errorf("auth error: error generating password: %v", err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}
		password := string(hashedPassword)
		userRequest.Password = password

		// Validating email address
		if userRequest.Email != "" {
			if !userRequest.IsEmailValid(userRequest.Email) {
				log.Error("auth error: invalid email")
				c.JSON(utils.ErrorStatusCodes[utils.ErrInvalidEmail], presenter.CreateErrorResponse(utils.ErrInvalidEmail))
				return
			}
		}

		createdAt := time.Now().UnixMilli()
		userRequest.CreatedAt = createdAt

		userResponse, err := service.CreateUser(&userRequest)
		if errors.Is(err, utils.ErrUserExists) {
			log.Error(err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrUserExists], presenter.CreateErrorResponse(utils.ErrUserExists))
			return
		}
		if err != nil {
			log.Error(err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}

		c.JSON(http.StatusOK, userResponse)
	}
}

// UpdateUser		godoc
//
//	@Description	Update users details.
//	@Tags			UserRouter
//	@Accept			json
//	@Produce		json
//	@Failure		400	{object}	response.ErrInvalidRequest
//	@Failure		401	{object}	response.ErrStrictPasswordPolicyViolation
//	@Failure		401	{object}	response.ErrStrictUsernamePolicyViolation
//	@Failure		500	{object}	response.ErrServerError
//	@Success		200	{object}	response.MessageResponse{}
//	@Router			/update/details [post]
//
// UpdateUser updates the user details
func UpdateUser(service services.ApplicationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var userRequest entities.UserDetails
		err := c.BindJSON(&userRequest)
		if err != nil {
			log.Warn(err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrInvalidRequest], presenter.CreateErrorResponse(utils.ErrInvalidRequest))
			return
		}

		uid := c.MustGet("uid").(string)
		userRequest.ID = uid
		initialLogin, err := CheckInitialLogin(service, uid)
		if err != nil {
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}

		if initialLogin {
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrPasswordNotUpdated))
			return
		}

		err = service.UpdateUser(&userRequest)
		if err != nil {
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}
		c.JSON(http.StatusOK, response.MessageResponse{Message: "User details updated successfully"})
	}
}

// GetUser		godoc
//
//	@Description	Get user.
//	@Tags			UserRouter
//	@Accept			json
//	@Produce		json
//	@Failure		400	{object}	response.ErrUserNotFound
//	@Success		200	{object}	response.UserResponse{}
//	@Router			/get_user/:uid [get]
//
// GetUser returns the user that matches the uid passed in parameter
func GetUser(service services.ApplicationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid := c.Param("uid")

		// Validating logged-in user
		// Must be either requesting info from the logged-in user
		// or any user if it has the admin role
		role := c.MustGet("role").(string)
		if c.MustGet("uid").(string) != uid && role != string(entities.RoleAdmin) {
			log.Error("auth error: unauthorized")
			c.JSON(utils.ErrorStatusCodes[utils.ErrUnauthorized],
				presenter.CreateErrorResponse(utils.ErrUnauthorized))
			return
		}

		user, err := service.GetUser(uid)
		if err != nil {
			log.Error(err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrUserNotFound], presenter.CreateErrorResponse(utils.ErrUserNotFound))
			return
		}
		c.JSON(http.StatusOK, user)
	}
}

// FetchUsers		godoc
//
//	@Description	Fetch users.
//	@Tags			UserRouter
//	@Accept			json
//	@Produce		json
//	@Failure		401	{object}	response.ErrUnauthorized
//	@Failure		500	{object}	response.ErrServerError
//	@Success		200	{object}	response.UserResponse{}
//	@Router			/users [get]
//
// FetchUsers fetches all the users
func FetchUsers(service services.ApplicationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole := c.MustGet("role").(string)

		if entities.Role(userRole) != entities.RoleAdmin {
			c.AbortWithStatusJSON(utils.ErrorStatusCodes[utils.ErrUnauthorized], presenter.CreateErrorResponse(utils.ErrUnauthorized))
			return
		}
		users, err := service.GetUsers()
		if err != nil {
			log.Error(err)
			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
			return
		}
		c.JSON(http.StatusOK, users)
	}
}

// InviteUsers		godoc
//
//	@Description	Invite users.
//	@Tags			UserRouter
//	@Accept			json
//	@Produce		json
//	@Failure		400	{object}	response.ErrInvalidRequest
//	@Failure		500	{object}	response.ErrServerError
//	@Success		200	{object}	response.UserResponse{}
//	@Router			/invite_users/:project_id [get]
//
// InviteUsers invites users to the project
func InviteUsers(service services.ApplicationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		projectID := c.Param("project_id")
		if projectID
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5603** (2026-09-21): **Resilience Probe is showing as SOT in the Chaos Center Execution History event hough the mode is configured as EOT(End of Test)**
  *Symptoms*: **What happened**: We are using LitmusChaos 3.30.0 with ChaosCenter and a namespace-scoped Chaos Infrastructure to run a pod-delete experiment against a Kubernetes Deployment.  However, although the generated Workflow/ChaosEngine configuration shows the probe mode as EOT(End of Test), the Resilience Probe in the ChaosCenter show that the probe is actually being executed as SOT (Start Of Test) with the Experiment page showing the Probe status as `Either probe is not executed or not evaluated. Eventually the experiment is success but the Experiment status is updated as error in the Chaos Center`  **What you expected to happen**: The probe to executed at the End of the chaos test with Probe summary displaying Pass or Fail based on the Chaos Experiment's result.  **How to reproduce it (as minimally and precisely as possible)**:  1. Create a namespace scoped Chaos Infrastructure 2. Create a Resilience Probe as cmdProbe with kubectl get pods -n <namespace> | grep <pod_name> | grep -E Running | wc -l 3. Probe properties as below  - Timeout 10s - Interval 1s - Attempt 1 - Polling Interval 1s - Data Comparison Type: Int - Comparison criteria: > - Value: 1  4. Deploy a Pod Delete Chaos engine against the created Chaos Infrastructure and reference the Resilience probe created as above with EOT as Probe mode   **Anything else we need to know?**: `kubectl get deploy -n litmus -o jsonpath='{range .items[*]}{.metadata.namespace}{" "}{.metadata.name}{" -> "}{range .spec.template.spec.contain
  **Post-Mortem & Fix Analysis**:
  > @PriteshKiri   This is the Experiment status.   <img width="1379" height="635" alt="Image" src="https://github.com/user-attachments/assets/b28dca2b-0d92-4507-863b-a07a8baffea5" />  This is the Resilience Probe Execution History  <img width="1444" height="306" alt="Image" src="https://github.com/user-attachments/assets/01fe378a-c7b3-40d8-b52a-569e30f43698" />

- **Issue #5581** (2026-08-25): **Bug: Target infrastructure reference field renders empty during Chaos Experiment edit mode**
  *Symptoms*: ## Summary When a user edits an existing Chaos Experiment (`StudioOverview` / `ChaosInfrastructureReferenceField`), the pre-selected target Kubernetes Chaos Infrastructure field renders empty if the target infrastructure is not located on the first page of the paginated `listInfras` GraphQL query results.  ## Steps to Reproduce 1. Navigate to a project in Litmus Chaos Center. 2. Ensure there are multiple target Chaos Infrastructures (or change pagination limits/search filters such that a specific infrastructure is not on page 1). 3. Create a Chaos Experiment utilizing that specific target infrastructure. 4. Open the experiment in **Edit Mode** (`StudioOverview`). 5. Observe the **Target Infrastructure** reference field.  ### Expected Behavior The target infrastructure field should correctly display the pre-selected infrastructure (`initialInfrastructureID`) regardless of whether it appears on the current page of the paginated list query.  ### Actual Behavior The target infrastructure reference field appears completely empty during edit mode, as noted by the existing `TODO` in codebase: `// TODO: replace with get API as this becomes empty during edit` inside `KubernetesChaosInfrastructureReferenceField.tsx`.  ## Root Cause `KubernetesChaosInfrastructureReferenceFieldController` previously attempted to find the initial infrastructure solely by searching within `listChaosInfraData?.listInfras.infras.find()`. Because `listChaosInfra` is paginated (`page: 0, limit: 5`), any infras

- **Issue #5574** (2026-07-07): **Authorization check result discarded in GetInfraDetails resolver**
  *Symptoms*: ## Summary  The `GetInfraDetails` resolver calls `authorization.ValidateRole` but never checks the result before proceeding to the service call, due to the result being shadowed by a subsequent `:=` declaration. I traced this down to the database query and confirmed it independently filters by project_id, so this does NOT result in cross-project data exposure — but it does mean the specific role/invitation-status check for this resolver never actually enforces anything.  ## Affected component  chaoscenter/graphql/server/graph/chaos_infrastructure.resolvers.go GetInfraDetails resolver, lines 167-183 (bug is lines 173-177)  ## Details      func (r *queryResolver) GetInfraDetails(ctx context.Context, infraID string, projectID string) (*model.Infra, error) {         ...         err := authorization.ValidateRole(ctx, projectID,             authorization.MutationRbacRules[authorization.GetInfraDetails],             model.InvitationAccepted.String())          gcaResponse, err := r.chaosInfrastructureService.GetInfraDetails(ctx, infraID, projectID)         if err != nil {             logrus.WithFields(logFields).Error(err)             return nil, err         }         return gcaResponse, err     }  The `err` from `ValidateRole` is discarded when re-declared by `:=` on the next line. Three sibling resolvers in the same file — GetInfra (~L131-142), ListInfras (~L151-163), and GetInfraStats (~L236-242) — all correctly guard with `if err != nil { return nil, err }` immediately after `Val
  **Post-Mortem & Fix Analysis**:
  > @PriteshKiri  I'd like to work on this fix if that's okay. Can you assign this to me

- **Issue #5573** (2026-07-07): **Index out of range panic in GetInfra when infra has zero experiments**
  *Symptoms*: ## Summary  `GetInfra` in the infrastructure service accesses `infra.ExperimentDetails[0]` before checking that the slice is non-empty, causing a panic for any infra that has never had an experiment run on it.  ## Affected component  chaoscenter/graphql/server/pkg/chaos_infrastructure/service.go GetInfra function, ~line 416-421  ## Details      lastRun := strconv.FormatInt(infra.ExperimentDetails[0].LastRunTimestamp, 10)     if len(infra.ExperimentDetails) > 0 {         infraResponse.NoOfExperimentRuns = &infra.ExperimentDetails[0].TotalRuns         infraResponse.LastExperimentTimestamp = &lastRun         infraResponse.NoOfExperiments = &infra.ExperimentDetails[0].TotalSchedules     }  The index access on the first line happens unconditionally, before the length check on the second line. If `ExperimentDetails` is an empty slice, this panics with "index out of range [0] with length 0".  ## Impact  Any `getInfra` query for an infrastructure with zero associated experiments panics and returns a 500 to the client. This affects every newly registered infra before its first experiment is created.  ## Suggested fix  Move the lastRun assignment inside the length-guarded block:      if len(infra.ExperimentDetails) > 0 {         lastRun := strconv.FormatInt(infra.ExperimentDetails[0].LastRunTimestamp, 10)         infraResponse.NoOfExperimentRuns = &infra.ExperimentDetails[0].TotalRuns         infraResponse.LastExperimentTimestamp = &lastRun         infraResponse.NoOfExperiments = &infr
  **Post-Mortem & Fix Analysis**:
  > @PriteshKiri  I'd like to work on this fix if that's okay happy to submit a PR once confirmed.

- **Issue #5569** (2026-07-09): **Cannot stop a Queued experiment: fails with "no running or timeout experiments found"**
  *Symptoms*: **What happened**: When a user attempts to stop/abort a Chaos Experiment that is currently in the "Queued" state, the backend rejects the action and throws the error: `no running or timeout experiments found`. Even though the Frontend UI correctly allows users to click the "Stop" button for Queued runs, the backend `stopExperimentRuns` handler ignores the request, leaving the experiment stuck in the queue.  **What you expected to happen**: Users should be able to cleanly abort a Queued experiment before it starts executing. The backend should align with the Frontend's behavior, recognize the "Queued" state as a valid state for cancellation, and correctly abort the run (e.g., mark it as stopped/aborted in the database) so it doesn't eventually run.  **Where can this issue be corrected? (optional)** - `chaoscenter/graphql/server/pkg/chaos_experiment/handler/handler.go` The `stopExperimentRuns` logic currently loops through `expRuns` and explicitly filters out any runs that are not in the `Running` or `Timeout` states, completely ignoring `Queued` runs.  **How to reproduce it (as minimally and precisely as possible)**: 1. Schedule or trigger a Chaos Experiment run. 2. Quickly, while the experiment is still in the "Queued" state (before the agent picks it up and it transitions to "Running"), click the "Stop" button in the UI for that run. 3. Observe the error notification: `no running or timeout experiments found`.  https://github.com/user-attachments/assets/33a7075b-be1d-4619-bd
  **Post-Mortem & Fix Analysis**:
  > @PriteshKiri if this issue is valid and not intentional, then can I be assigned?
  > Hey @Nivedita-Chhokar  This would be a great fix. Thanks for the video demo.  Assigning the issue to you. Happy coding 🙌 
  > @PriteshKiri closing this issue as completed

- **Issue #5568** (2026-06-28): **Duration component does not normalize 10-digit (seconds) timestamps, causing incorrect duration display**
  *Symptoms*: **What happened**: The `Duration` component (`chaoscenter/web/src/components/Duration/Duration.tsx`) does not normalize timestamp precision before computing elapsed time. `startedAt`/`finishedAt` fields are typed as `string` (see `chaoscenter/web/src/api/entities/workflowRun.ts`), and the codebase already has a utility, `handleTimestampAmbiguity` (`chaoscenter/web/src/utils/dates.ts`), built specifically to detect 10-digit (seconds) timestamps and convert them to 13-digit (milliseconds).  However, this normalization is only applied at one of the four call sites that render `<Duration />`:  - ✅ `ExperimentRunDetailsHeader.tsx` — wraps both `startTime`/`endTime` with `parseInt(handleTimestampAmbiguity(...))` - ❌ `ExperimentRunDetailsPanel.tsx` — passes `faultStartTime`/`faultEndTime` raw - ❌ `ExperimentRunHistoryTable.tsx` — passes `data.startedAt`/`data.finishedAt` raw - ❌ `ExperimentRunFaultTable.tsx` — passes `row.startedAt`/`calculateDurationAgainst` raw  If the backend ever returns a second-precision (10-digit) timestamp at any of these three unguarded call sites, `Duration` computes the delta as if it were millisecond-precision, displaying a duration roughly 1000x too large.  **What you expected to happen**: `Duration` should correctly normalize and display elapsed time regardless of whether `startTime`/`endTime` are passed as second-precision or millisecond-precision timestamps, consistently across all consumers.  **Where can this issue be corrected? (optional)**: `chaos
  **Post-Mortem & Fix Analysis**:
  > /assign 

- **Issue #5559** (2026-08-25): **IsAgentConfirmed panics with nil pointer dereference on transient Kubernetes API errors**
  *Symptoms*: What happened: In chaoscenter/subscriber/pkg/k8s/operations.go, the function IsAgentConfirmed() (lines 136–154) can crash with a nil pointer panic.  It calls clientset.CoreV1().ConfigMaps(InfraNamespace).Get(...) and only checks for a "not found" error using k8s_errors.IsNotFound(err). But if Get fails for any other reason — like a temporary API server timeout, network issue, or missing RBAC permissions — getCM comes back as nil. The code then still runs getCM.Data["IS_INFRA_CONFIRMED"], which tries to read from a nil object and crashes the subscriber.  There's also a small piece of dead code right after:   getSecret, err := clientset.CoreV1().Secrets(InfraNamespace).Get(...) if err != nil {     return false, "", errors.New(InfraSecretName + " secret not found") }  if k8s_errors.IsNotFound(err) {   // this can never run — err is already nil here     return false, "", err } Since the line above already returns on any error, this IsNotFound check can never be reached.  What you expected to happen: Any error from the ConfigMap Get call — not just "not found" — should be handled before getCM is used, so a temporary Kubernetes API hiccup returns an error instead of crashing the agent. The leftover dead IsNotFound check on the secret fetch should also be cleaned up.  Where can this issue be corrected? (optional): chaoscenter/subscriber/pkg/k8s/operations.go → function IsAgentConfirmed → lines 136–154.  How to reproduce it (as minimally and precisely as possible):  Run the subscribe
  **Post-Mortem & Fix Analysis**:
  > /assign 

- **Issue #5552** (2026-06-30): **[Security]bcrypt error silently ignored in CreateUser — users created with invalid password hash**
  *Symptoms*: ## Expected behavior  When `bcrypt.GenerateFromPassword()` fails during  user creation, the error should be returned to the  caller and user creation should be aborted.  ## Actual behavior  In `chaoscenter/authentication/api/handlers/rest/user_handlers.go`  line 81, the error from `bcrypt.GenerateFromPassword()`  is logged but NOT returned. Execution continues with  an empty/zero-value password hash, meaning users can  be created with invalid password hashes.  This is a security vulnerability — a user account  created with an empty hash could potentially be  accessed without a valid password.  ## Location  - File: `chaoscenter/authentication/api/handlers/rest/user_handlers.go` - Line: 81  ## Current Code  hash, err := bcrypt.GenerateFromPassword(...) if err != nil {     log.Error(err) } // execution continues with empty hash  ## Proposed Fix  hash, err := bcrypt.GenerateFromPassword(...) if err != nil {     log.Error(err)     return err }  ## Why This Matters  - Security bug — invalid password hashes compromise   authentication integrity - User accounts created during bcrypt failures are   in an inconsistent state - Silent failures make debugging extremely difficult  ## Additional Notes  Found while auditing the codebase as a new contributor. I would like to work on this fix if maintainers agree with the approach.  ## Please complete the following information  - File: chaoscenter/authentication/api/handlers/rest/user_handlers.go - Language: Go - Component: Authentication serv
  **Post-Mortem & Fix Analysis**:
  > @ispeakc0de I want to work on this issue can i work on this 

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

### Incident Patch 1: `153f338c` (2026-09-30)
**Commit Message**: fix: scope invitation and leave project updates to the caller (#5600)

* fix: scope invitation and leave project updates to the caller

AcceptInvitation, DeclineInvitation and LeaveProject authorize the caller through RbacValidator but then hand member.UserID from the request body to UpdateInvite, which array filters on elem.user_id with the project as the only other predicate. The RBAC rules for these three routes admit every member, so any member could change another member's invitation state and lock the project owner out. These endpoints only ever act on the caller, so the update now uses the uid the request was authorized with.

Signed-off-by: Nayyar <nayyar@bugqore.com>

* chore(deps): bump x/text, x/net and grpc to clear trivy HIGH findings

Signed-off-by: Nayyar <nayyar@bugqore.com>

---------

Signed-off-by: Nayyar <nayyar@bugqore.com>
Co-authored-by: Pritesh Kiri <77957844+PriteshKiri@users.noreply.github.com>

**File**: `chaoscenter/authentication/api/handlers/rest/project_handler.go` (modified, +15/-9)
```diff
@@ -572,8 +572,10 @@ func AcceptInvitation(service services.ApplicationService) gin.HandlerFunc {
 			return
 		}
 
+		uid := c.MustGet("uid").(string)
+
 		// admin/user shouldn't be able to perform any task if it's default pwd is not changes(initial login is true)
-		initialLogin, err := CheckInitialLogin(service, c.MustGet("uid").(string))
+		initialLogin, err := CheckInitialLogin(service, uid)
 		if err != nil {
 			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
 			return
@@ -584,7 +586,7 @@ func AcceptInvitation(service services.ApplicationService) gin.HandlerFunc {
 			return
 		}
 
-		err = validations.RbacValidator(c.MustGet("uid").(string), member.ProjectID,
+		err = validations.RbacValidator(uid, member.ProjectID,
 			validations.MutationRbacRules["acceptInvitation"],
 			string(entities.PendingInvitation),
 			service)
@@ -595,7 +597,7 @@ func AcceptInvitation(service services.ApplicationService) gin.HandlerFunc {
 			return
 		}
 
-		err = service.UpdateInvite(member.ProjectID, member.UserID, entities.AcceptedInvitation, nil)
+		err = service.UpdateInvite(member.ProjectID, uid, entities.AcceptedInvitation, nil)
 		if err != nil {
 			log.Error(err)
 			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
@@ -630,8 +632,10 @@ func DeclineInvitation(service services.ApplicationService) gin.HandlerFunc {
 			return
 		}
 
+		uid := c.MustGet("uid").(string)
+
 		// admin/user shouldn't be able to perform any task if it's default pwd is not changes(initial login is true)
-		initialLogin, err := CheckInitialLogin(service, c.MustGet("uid").(string))
+		initialLogin, err := CheckInitialLogin(service, uid)
 		if err != nil {
 			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
 			return
@@ -642,7 +646,7 @@ func DeclineInvitation(service services.ApplicationService) gin.HandlerFunc {
 			return
 		}
 
-		err = validations.RbacValidator(c.MustGet("uid").(string), member.ProjectID,
+		err = validations.RbacValidator(uid, member.ProjectID,
 			validations.MutationRbacRules["declineInvitation"],
 			string(entities.PendingInvitation),
 			service)
@@ -653,7 +657,7 @@ func DeclineInvitation(service services.ApplicationService) gin.HandlerFunc {
 			return
 		}
 
-		err = service.UpdateInvite(member.ProjectID, member.UserID, entities.DeclinedInvitation, nil)
+		err = service.UpdateInvite(member.ProjectID, uid, entities.DeclinedInvitation, nil)
 		if err != nil {
 			log.Error(err)
 			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
@@ -702,8 +706,10 @@ func LeaveProject(service services.ApplicationService) gin.HandlerFunc {
 			}
 		}
 
+		uid := c.MustGet("uid").(string)
+
 		// admin/user shouldn't be able to perform any task if it's default pwd is not changes(initial login is true)
-		initialLogin, err := CheckInitialLogin(service, c.MustGet("uid").(string))
+		initialLogin, err := CheckInitialLogin(service, uid)
 		if err != nil {
 			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
 			return
@@ -714,7 +720,7 @@ func LeaveProject(service services.ApplicationService) gin.HandlerFunc {
 			return
 		}
 
-		err = validations.RbacValidator(c.MustGet("uid").(string), member.ProjectID,
+		err = validations.RbacValidator(uid, member.ProjectID,
 			validations.MutationRbacRules["leaveProject"],
 			string(entities.AcceptedInvitation),
 			service)
@@ -725,7 +731,7 @@ func LeaveProject(service services.ApplicationService) gin.HandlerFunc {
 			return
 		}
 
-		err = service.UpdateInvite(member.ProjectID, member.UserID, entities.ExitedProject, nil)
+		err = service.UpdateInvite(member.ProjectID, uid, entities.ExitedProject, nil)
 		if err != nil {
 			log.Error(err)
 			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(ut
```

**File**: `chaoscenter/authentication/api/handlers/rest/project_handler_test.go` (modified, +83/-0)
```diff
@@ -4,14 +4,17 @@ import (
 	"errors"
 	"net/http"
 	"net/http/httptest"
+	"strings"
 	"testing"
 
 	"github.com/gin-gonic/gin"
 	"github.com/litmuschaos/litmus/chaoscenter/authentication/api/handlers/rest"
 	"github.com/litmuschaos/litmus/chaoscenter/authentication/api/mocks"
 	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/entities"
+	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/services"
 	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/utils"
 	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/mock"
 	"go.mongodb.org/mongo-driver/bson/primitive"
 )
 
@@ -309,3 +312,83 @@ func TestGetProject(t *testing.T) {
 	})
 
 }
+
+func memberRbacFilter(projectID, uid string, roles []string, invitation string) primitive.D {
+	return primitive.D{
+		primitive.E{Key: "_id", Value: projectID},
+		primitive.E{Key: "members", Value: primitive.D{
+			primitive.E{Key: "$elemMatch", Value: primitive.D{
+				primitive.E{Key: "user_id", Value: uid},
+				primitive.E{Key: "role", Value: primitive.D{
+					primitive.E{Key: "$in", Value: roles},
+				}},
+				primitive.E{Key: "invitation", Value: invitation},
+			}},
+		}},
+	}
+}
+
+func TestInvitationHandlersActOnTheCaller(t *testing.T) {
+	gin.SetMode(gin.TestMode)
+
+	const (
+		projectID = "testProjectID"
+		callerUID = "callerUID"
+		victimUID = "ownerUID"
+	)
+
+	tests := []struct {
+		name               string
+		handler            func(services.ApplicationService) gin.HandlerFunc
+		roles              []string
+		invitation         string
+		expectedInvitation entities.Invitation
+	}{
+		{
+			name:               "accept_invitation",
+			handler:            rest.AcceptInvitation,
+			roles:              []string{"Owner", "Viewer", "Executor"},
+			invitation:         string(entities.PendingInvitation),
+			expectedInvitation: entities.AcceptedInvitation,
+		},
+		{
+			name:               "decline_invitation",
+			handler:            rest.DeclineInvitation,
+			roles:              []string{"Owner", "Viewer", "Executor"},
+			invitation:         string(entities.PendingInvitation),
+			expectedInvitation: entities.DeclinedInvitation,
+		},
+		{
+			name:               "leave_project",
+			handler:            rest.LeaveProject,
+			roles:              []string{"Owner", "Viewer", "Executor"},
+			invitation:         string(entities.AcceptedInvitation),
+			expectedInvitation: entities.ExitedProject,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			service := new(mocks.MockedApplicationService)
+			w := httptest.NewRecorder()
+			c, _ := gin.CreateTestContext(w)
+			c.Request, _ = http.NewRequest(http.MethodPost, "/",
+				strings.NewReader(`{"projectID":"`+projectID+`","userID":"`+victimUID+`"}`))
+			c.Request.Header.Set("Content-Type", "application/json")
+			c.Set("uid", callerUID)
+
+			service.On("GetUser", callerUID).Return(&entities.User{ID: callerUID}, nil)
+			service.On("GetProjects", memberRbacFilter(projectID, callerUID, tt.roles, tt.invitation)).
+				Return([]*entities.Project{{ID: projectID}}, nil)
+			service.On("UpdateInvite", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
+
+			tt.handler(service)(c)
+
+			assert.Equal(t, http.StatusOK, w.Code)
+			service.AssertCalled(t, "UpdateInvite", projectID, callerUID, tt.expectedInvitation,
+				(*entities.MemberRole)(nil))
+			service.AssertNotCalled(t, "UpdateInvite", projectID, victimUID, tt.expectedInvitation,
+				(*entities.MemberRole)(nil))
+		})
+	}
+}
```

---

### Incident Patch 2: `7e4aced2` (2026-09-30)
**Commit Message**: docs: fix broken links across adopter and translation READMEs (#5619)

- adopters/organizations/raspbernetes.md: fix 'gttps://' typo in the
  project link.
- adopters/users/Jayadeep_KM.md: fix a malformed profile link
  ('kmjayadeep/kmjayadeep') to point to the correct GitHub profile.
- translations/README-*.md (chn, es, fr, ge, hi, ja, ko): these files
  link to ROADMAP.md, LICENSE, and images/maxresdefault.jpg as if they
  were relative to translations/, but those files actually live at the
  repo root, so every one of these links 404s. Fixed with '../' paths.
  Also fixed the equivalent doubled-up 'translations/translations/...'
  links between the translation READMEs themselves, a missing 'https://'
  scheme on a link in README-hi.md, and the 'nd' -> 'md' extension typo
  in README-ge.md's roadmap link.

Note: translations/../proposals/multipleowner-project.md also links to
a missing image (multipleprojectwoner.png) that doesn't exist anywhere
in the repo; left unfixed since I can't confidently guess the intended
asset.

Signed-off-by: ajmani-x <aryanajmani7@gmail.com>
Co-authored-by: Pritesh Kiri <77957844+PriteshKiri@users.noreply.github.com>

**File**: `adopters/organizations/raspbernetes.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Raspbernetes
 
-[Raspbernetes](gttps://github.com/raspbernetes) is an open source project with multiple contributors for running Kubernetes 
+[Raspbernetes](https://github.com/raspbernetes) is an open source project with multiple contributors for running Kubernetes 
 clusters on Raspberry Pis. The project started with a goal to automate the setup and management of a Kubernetes cluster on Raspberry Pis. 
 It aims to be completely declarative and idempotent.
 
```

**File**: `adopters/users/Jayadeep_KM.md` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-I'm [Jayadeep](kmjayadeep/kmjayadeep), full stack developer and an open source enthusiast. I stumbled upon Litmus while I was working on a microservices hobby project. That was in October 2019, while Hacktoberfest was going on. Hence I got a chance to meet the community and contributors behind Litmus. The community really helped me to get started with Chaos engineering principles.
+I'm [Jayadeep](https://github.com/kmjayadeep), full stack developer and an open source enthusiast. I stumbled upon Litmus while I was working on a microservices hobby project. That was in October 2019, while Hacktoberfest was going on. Hence I got a chance to meet the community and contributors behind Litmus. The community really helped me to get started with Chaos engineering principles.
 
 The project I was working on had 4 microservices talking to each other. I wanted to make sure that the application can take care of error conditions such as Network delay, deletion of pods, unavailability of dependent services etc. and provide meaningful error messages instead of crashing. Based on manual testing all seemed fine, but chaos testing with Litmus revealed that some of the APIs didn't have the mechanism to deal with timeouts when trying to connect to other services.
 
```

**File**: `translations/README-chn.md` (modified, +3/-3)
```diff
@@ -37,7 +37,7 @@
 
 ## 如何使用石蕊
 
-[![IMAGE ALT TEXT](images/maxresdefault.jpg)](https://youtu.be/W5hmNbaYPfM)
+[![IMAGE ALT TEXT](../images/maxresdefault.jpg)](https://youtu.be/W5hmNbaYPfM)
 
 请看此处 <a href="https://docs.litmuschaos.io/docs/next/getstarted.html" target="_blank">Litmus Docs</a>.
 
@@ -53,7 +53,7 @@ Check out the <a href="https://github.com/litmuschaos/community-charts/blob/mast
 
 ## 注意事项
 
-我们列举了一些将石蕊作为混沌工程框架应用需要做的一些考量，在[ROADMAP](./ROADMAP.md)我们已经提及了一些改进的方案。
+我们列举了一些将石蕊作为混沌工程框架应用需要做的一些考量，在[ROADMAP](../ROADMAP.md)我们已经提及了一些改进的方案。
 对于某一具体混沌测试的局限性，请参考其各自的文档[experiments docs](https://docs.litmuschaos.io/docs/pod-delete/)。
 
 - 网络混沌测试目前不支持除Docker以外的容器运行时，如containerd和CRIO
@@ -64,7 +64,7 @@ Check out the <a href="https://github.com/litmuschaos/community-charts/blob/mast
 
 ## 开源证书
 
-石蕊使用的证书为Apache License, Version 2.0. 全文请见[LICENSE](./LICENSE). 一些由石蕊所使用的软件可能使用了不同的证书，使用时请分别参考这些软件各自的证书.
+石蕊使用的证书为Apache License, Version 2.0. 全文请见[LICENSE](../LICENSE). 一些由石蕊所使用的软件可能使用了不同的证书，使用时请分别参考这些软件各自的证书.
 
 [![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Flitmuschaos%2Flitmus.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Flitmuschaos%2Flitmus?ref=badge_large)
 
```

**File**: `translations/README-es.md` (modified, +4/-4)
```diff
@@ -15,10 +15,10 @@
 [![YouTube Channel](https://img.shields.io/badge/YouTube-Subscribe-red)](https://www.youtube.com/channel/UCa57PMqmz_j0wnteRa9nCaw)
 <br><br><br><br>
 
-#### *Leer en [otros idiomas](translations/TRANSLATIONS.md)*
+#### *Leer en [otros idiomas](TRANSLATIONS.md)*
 
 
-[🇰🇷](translations/README-ko.md) [🇨🇳](translations/README-chn.md) [🇧🇷](translations/README-pt-br.md) [🇮🇳](translations/README-hi.md) [🇪🇸](translations/README-es.md)
+[🇰🇷](README-ko.md) [🇨🇳](README-chn.md) [🇧🇷](README-pt-br.md) [🇮🇳](README-hi.md) [🇪🇸](README-es.md)
 
 ## Descripción general
 
@@ -67,7 +67,7 @@ Revisa los <a href="https://github.com/litmuschaos/litmus/blob/master/ADOPTERS.m
 
 ## Consideraciones que tener en cuenta
 
-A continuación se enumeran algunas consideraciones que se deben tener en cuenta sobre Litmus como framework de Chaos. Muchas de ellas ya están siendo trabajadas como se menciona en [ROADMAP](./ROADMAP.md). Para detalles o limitaciones sobre experimentos específicos, 
+A continuación se enumeran algunas consideraciones que se deben tener en cuenta sobre Litmus como framework de Chaos. Muchas de ellas ya están siendo trabajadas como se menciona en [ROADMAP](../ROADMAP.md). Para detalles o limitaciones sobre experimentos específicos, 
 se debe consultar la [documentación de los experimentos](https://docs.litmuschaos.io/docs/pod-delete/) respectiva.
 
   - El Operador Chaos Litmus y los Experimentos Chaos corren como recursos de Kubernetes en un clúster. En caso de entornos airgapeados los recursos Chaos personalizaos y las imágenes debe ser alojados en local.
@@ -77,7 +77,7 @@ se debe consultar la [documentación de los experimentos](https://docs.litmuscha
 
 ## Licencia
 
-Litmos está licenciado bajo la Licencia Apache, versión 2.0. Ver el texto completo en [LICENCIA](./LICENSE). Algunos proyectos usados por Litmus pueden estar sometidos a  una licencia diferente, consulte su lecencia específica.
+Litmos está licenciado bajo la Licencia Apache, versión 2.0. Ver el texto completo en [LICENCIA](../LICENSE). Algunos proyectos usados por Litmus pueden estar sometidos a  una licencia diferente, consulte su lecencia específica.
 
 [![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Flitmuschaos%2Flitmus.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Flitmuschaos%2Flitmus?ref=badge_large)
 
```

**File**: `translations/README-fr.md` (modified, +5/-5)
```diff
@@ -15,9 +15,9 @@
 [![YouTube Channel](https://img.shields.io/badge/YouTube-Subscribe-red)](https://www.youtube.com/channel/UCa57PMqmz_j0wnteRa9nCaw)
 <br><br><br><br>
 
-#### *Lisez ceci en [autres langues](translations/TRANSLATIONS.md)*
+#### *Lisez ceci en [autres langues](TRANSLATIONS.md)*
 
-[🇰🇷](translations/README-ko.md) [🇨🇳](translations/README-chn.md)
+[🇰🇷](README-ko.md) [🇨🇳](README-chn.md)
 
 ## Aperçu
 
@@ -41,7 +41,7 @@ Les expériences de chaos sont hébergées sur <a href="https://hub.litmuschaos.
 
 ## Premiers pas avec Litmus
 
-[![IMAGE ALT TEXT](images/maxresdefault.jpg)](https://youtu.be/W5hmNbaYPfM)
+[![IMAGE ALT TEXT](../images/maxresdefault.jpg)](https://youtu.be/W5hmNbaYPfM)
 
 Vérifiez <a href="https://docs.litmuschaos.io/docs/next/getstarted.html" target="_blank">Litmus Docs</a> to get started.
 
@@ -57,7 +57,7 @@ _Envoyez un PR à la page ci-dessus si vous utilisez Litmus dans votre pratique
 
 ## Choses à considérer
 
-Certaines des considérations qui doivent être prises avec Litmus (en tant que cadre de chaos) sont énumérées ici. Beaucoup d'entre eux sont déjà en cours d'élaboration comme mentionné dans la [ROADMAP](./ROADMAP.md). Pour obtenir des détails ou des limitations concernant des tests spécifiques, reportez-vous aux [documents relatifs aux tests](https://docs.litmuschaos.io/docs/pod-delete/).
+Certaines des considérations qui doivent être prises avec Litmus (en tant que cadre de chaos) sont énumérées ici. Beaucoup d'entre eux sont déjà en cours d'élaboration comme mentionné dans la [ROADMAP](../ROADMAP.md). Pour obtenir des détails ou des limitations concernant des tests spécifiques, reportez-vous aux [documents relatifs aux tests](https://docs.litmuschaos.io/docs/pod-delete/).
 
 - Litmus chaos operator and the chaos experiments run as kubernetes resources in the cluster. In case of airgapped environments, the chaos custom resources
   and images need to be hosted on premise.
@@ -69,7 +69,7 @@ Certaines des considérations qui doivent être prises avec Litmus (en tant que
 
 ## Licence
 
-Litmus est concédé sous licence Apache, version 2.0. Voir [LICENCE](./LICENSE) pour le texte complet de la licence. Certains des projets utilisés par le projet Litmus peuvent être régis par une licence différente, veuillez vous référer à sa licence spécifique.
+Litmus est concédé sous licence Apache, version 2.0. Voir [LICENCE](../LICENSE) pour le texte complet de la licence. Certains des projets utilisés par le projet Litmus peuvent être régis par une licence différente, veuillez vous référer à sa licence spécifique.
 
 [![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Flitmuschaos%2Flitmus.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Flitmuschaos%2Flitmus?ref=badge_large)
 
```

---

### Incident Patch 3: `2d761dca` (2026-09-30)
**Commit Message**: chore: go version bump and cve fixed (#5627)

Signed-off-by: Animesh Pathak <animesh.pathak@harness.io>

**File**: `chaoscenter/authentication/Dockerfile` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 # BUILD STAGE
-FROM golang:1.25 AS builder
+FROM golang:1.26 AS builder
 
 ARG TARGETOS=linux
 ARG TARGETARCH
```

**File**: `chaoscenter/authentication/go.mod` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 module github.com/litmuschaos/litmus/chaoscenter/authentication
 
-go 1.25.0
+go 1.26.0
 
 require (
 	github.com/coreos/go-oidc/v3 v3.17.0
@@ -12,7 +12,7 @@ require (
 	github.com/sirupsen/logrus v1.9.4
 	github.com/stretchr/testify v1.11.1
 	go.mongodb.org/mongo-driver v1.17.9
-	golang.org/x/crypto v0.55.0
+	golang.org/x/crypto v0.56.0
 	golang.org/x/oauth2 v0.36.0
 	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.11
```

**File**: `chaoscenter/authentication/go.sum` (modified, +2/-2)
```diff
@@ -133,8 +133,8 @@ golang.org/x/arch v0.25.0 h1:qnk6Ksugpi5Bz32947rkUgDt9/s5qvqDPl/gBKdMJLE=
 golang.org/x/arch v0.25.0/go.mod h1:0X+GdSIP+kL5wPmpK7sdkEVTt2XoYP0cSjQSbZBwOi8=
 golang.org/x/crypto v0.0.0-20190308221718-c2843e01d9a2/go.mod h1:djNgcEr1/C05ACkg1iLfiJU5Ep61QUkGW8qpdssI0+w=
 golang.org/x/crypto v0.0.0-20210921155107-089bfa567519/go.mod h1:GvvjBRRGRdwPK5ydBHafDWAxML/pGHZbMvKqRZ5+Abc=
-golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
-golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
+golang.org/x/crypto v0.56.0 h1:GUh5Ii4J5jtcseSMiRqr1jXCNHoxjeV9Fmekc2oLy6Y=
+golang.org/x/crypto v0.56.0/go.mod h1:OMW5y6CY9l38uPLmxU6l6pwcXp1obtLo3e6gT7gQR2I=
 golang.org/x/mod v0.6.0-dev.0.20220419223038-86c51ed26bb4/go.mod h1:jJ57K6gSWd91VN4djpZkiMVwK6gcyfeH4XE8wZrZaV4=
 golang.org/x/net v0.0.0-20190620200207-3b0461eec859/go.mod h1:z5CRVTTTmAJ677TzLLGU+0bjPO0LkuOLi4/5GtJWs/s=
 golang.org/x/net v0.0.0-20210226172049-e18ecbb05110/go.mod h1:m0MpNAwzfU5UDzcl9v0D8zg8gWTRqZa9RBIspLL5mdg=
```

**File**: `chaoscenter/graphql/server/go.mod` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 module github.com/litmuschaos/litmus/chaoscenter/graphql/server
 
-go 1.26
+go 1.26.0
 
 require (
 	github.com/99designs/gqlgen v0.17.49
@@ -25,7 +25,7 @@ require (
 	github.com/tidwall/sjson v1.2.5
 	github.com/vektah/gqlparser/v2 v2.5.16
 	go.mongodb.org/mongo-driver v1.17.7
-	golang.org/x/crypto v0.55.0
+	golang.org/x/crypto v0.56.0
 	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.11
 	gopkg.in/yaml.v2 v2.4.0
```

**File**: `chaoscenter/graphql/server/go.sum` (modified, +2/-2)
```diff
@@ -1284,8 +1284,8 @@ golang.org/x/crypto v0.0.0-20201002170205-7f63de1d35b0/go.mod h1:LzIPMQfyMNhhGPh
 golang.org/x/crypto v0.0.0-20210220033148-5ea612d1eb83/go.mod h1:jdWPYTVW3xRLrWPugEBEK3UY2ZEsg3UU495nc5E+M+I=
 golang.org/x/crypto v0.0.0-20210921155107-089bfa567519/go.mod h1:GvvjBRRGRdwPK5ydBHafDWAxML/pGHZbMvKqRZ5+Abc=
 golang.org/x/crypto v0.0.0-20220622213112-05595931fe9d/go.mod h1:IxCIyHEi3zRg3s0A5j5BB6A9Jmi73HwBIUl50j+osU4=
-golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
-golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
+golang.org/x/crypto v0.56.0 h1:GUh5Ii4J5jtcseSMiRqr1jXCNHoxjeV9Fmekc2oLy6Y=
+golang.org/x/crypto v0.56.0/go.mod h1:OMW5y6CY9l38uPLmxU6l6pwcXp1obtLo3e6gT7gQR2I=
 golang.org/x/exp v0.0.0-20190121172915-509febef88a4/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20190125153040-c74c464bbbf2/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20190306152737-a1d7652674e8/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
```

---

### Incident Patch 4: `4eea3d32` (2026-09-30)
**Commit Message**: fix(web): bump vulnerable transitive npm dependencies (#5631)

Refresh the chaoscenter/web lockfile entries for five transitive
dependencies with critical advisories. All patched versions fit the
ranges already declared by their parent packages, so package.json is
unchanged.

- websocket-driver 0.7.4 -> 0.7.5 (CVE-2026-54466)
- shell-quote 1.8.1 -> 1.10.0 (CVE-2026-9277)
- liquidjs 10.8.4 -> 10.29.0 (CVE-2026-45618)
- immutable 4.0.0 -> 4.3.9 (CVE-2026-29063)
- form-data 3.0.1 -> 3.0.5 (CVE-2025-7783)

Fixes #5630

Signed-off-by: PriteshKiri <pritesh.d.kiri@gmail.com>
Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `chaoscenter/web/yarn.lock` (modified, +111/-17)
```diff
@@ -2664,6 +2664,14 @@ bytes@3.1.2:
   resolved "https://registry.yarnpkg.com/bytes/-/bytes-3.1.2.tgz#8b0beeb98605adf1b128fa4386403c009e0221a5"
   integrity sha512-/Nf7TyzTx6S3yRJObOAV7956r8cr2+Oj8AC5dt8wSP3BQAoeX58NoHyCU8P8zGkNXStjTSi6fzO6F0pBdcYbEg==
 
+call-bind-apply-helpers@^1.0.1, call-bind-apply-helpers@^1.0.2:
+  version "1.0.2"
+  resolved "https://registry.yarnpkg.com/call-bind-apply-helpers/-/call-bind-apply-helpers-1.0.2.tgz#4b5428c222be985d79c3d82657479dbe0b59b2d6"
+  integrity sha512-Sp1ablJ0ivDkSzjcaJdxEunN5/XvksFJ2sMBFfq6x0ryhQV/2b/KwFe21cMpmHtPOSij8K99/wSfoEuTObmuMQ==
+  dependencies:
+    es-errors "^1.3.0"
+    function-bind "^1.1.2"
+
 call-bind@^1.0.0, call-bind@^1.0.2:
   version "1.0.2"
   resolved "https://registry.yarnpkg.com/call-bind/-/call-bind-1.0.2.tgz#b1d4e89e688119c3c9a903ad30abb2f6a919be3c"
@@ -3612,6 +3620,15 @@ dotenv@^10.0.0:
   resolved "https://registry.yarnpkg.com/dotenv/-/dotenv-10.0.0.tgz#3d4227b8fb95f81096cdd2b66653fb2c7085ba81"
   integrity sha512-rlBi9d8jpv9Sf1klPjNfFAuWDjKLwTIJJ/VxtoTwIR6hnZxcEOQCZg2oIL3MWBYw5GpUDKOEnND7LXTbIpQ03Q==
 
+dunder-proto@^1.0.1:
+  version "1.0.1"
+  resolved "https://registry.yarnpkg.com/dunder-proto/-/dunder-proto-1.0.1.tgz#d7ae667e1dc83482f8b70fd0f6eefc50da30f58a"
+  integrity sha512-KIN/nDJBQRcXw0MLVhZE9iQHmG68qAVIBg9CqmUYjmQIhgij9U5MFvrqkUL5FbtyyzZuOeOt0zdeRe4UY7ct+A==
+  dependencies:
+    call-bind-apply-helpers "^1.0.1"
+    es-errors "^1.3.0"
+    gopd "^1.2.0"
+
 duplexer@~0.1.1:
   version "0.1.2"
   resolved "https://registry.yarnpkg.com/duplexer/-/duplexer-0.1.2.tgz#3abe43aef3835f8ae077d136ddce0f276b0400e6"
@@ -3725,6 +3742,11 @@ es-define-property@^1.0.0:
   dependencies:
     get-intrinsic "^1.2.4"
 
+es-define-property@^1.0.1:
+  version "1.0.1"
+  resolved "https://registry.yarnpkg.com/es-define-property/-/es-define-property-1.0.1.tgz#983eb2f9a6724e9303f61addf011c72e09e0b0fa"
+  integrity sha512-e3nRfgfUZ4rNGL232gUgX06QNyyez04KdjFrF+LTRoOXmrOgFKDg4BCdsjW8EnT69eqdYGmRpJwiPVYNrCaW3g==
+
 es-errors@^1.3.0:
   version "1.3.0"
   resolved "https://registry.yarnpkg.com/es-errors/-/es-errors-1.3.0.tgz#05f75a25dab98e4fb1dcd5e1472c0546d5057c8f"
@@ -3735,6 +3757,23 @@ es-module-lexer@^1.2.1:
   resolved "https://registry.yarnpkg.com/es-module-lexer/-/es-module-lexer-1.4.1.tgz#41ea21b43908fe6a287ffcbe4300f790555331f5"
   integrity sha512-cXLGjP0c4T3flZJKQSuziYoq7MlT+rnvfZjfp7h+I7K9BNX54kP9nyWvdbwjQ4u1iWbOL4u96fgeZLToQlZC7w==
 
+es-object-atoms@^1.0.0, es-object-atoms@^1.1.1:
+  version "1.1.2"
+  resolved "https://registry.yarnpkg.com/es-object-atoms/-/es-object-atoms-1.1.2.tgz#a2d0b373205724dfa525d23b0c3e1b1ca582c99b"
+  integrity sha512-HWcBoN6NileqtSydK2FqHbS/LoDd2pqrnQHLyJzBj4kOp/ky2MWMN694xOfkK8/SnUsW2DH7EfyVlydKCsm1Zw==
+  dependencies:
+    es-errors "^1.3.0"
+
+es-set-tostringtag@^2.1.0:
+  version "2.1.0"
+  resolved "https://registry.yarnpkg.com/es-set-tostringtag/-/es-set-tostringtag-2.1.0.tgz#f31dbbe0c183b00a6d26eb6325c810c0fd18bd4d"
+  integrity sha512-j6vWzfrGVfyXxge+O0x5sh6cvxAog0a/4Rdd2K36zCMV5eJ+/+tOAngRO8cODMNWbVRdVlmGZQL2YS3yR8bIUA==
+  dependencies:
+    es-errors "^1.3.0"
+    get-intrinsic "^1.2.6"
+    has-tostringtag "^1.0.2"
+    hasown "^2.0.2"
+
 es-to-primitive@^1.2.1:
   version "1.2.1"
   resolved "https://registry.yarnpkg.com/es-to-primitive/-/es-to-primitive-1.2.1.tgz#e55cd4c9cdc188bcefb03b366c736323fc5c898a"
@@ -4329,13 +4368,15 @@ fork-ts-checker-webpack-plugin@^6.3.4:
     tapable "^1.0.0"
 
 form-data@^3.0.0:
-  version "3.0.1"
-  resolved "https://registry.yarnpkg.com/form-data/-/form-data-3.0.1.tgz#ebd53791b78356a99af9a300d4282c4d5eb9755f"
-  integrity sha512-RHkBKtLWUVwd7SqRIvCZMEvAMoGUp0XU+seQiZejj0COz3RI3hWP4sCv3gZWWLjJTd7rGwcsF5eKZGii0r/hbg==
+  version "3.0.5"
+  resolved "https://registry.yarnpkg.com/form-data/-/form-data-3.0.5.tgz#2ea3ec24f0dcb7e0262a11efb732031240ea8e9f"
+  integrity sha512-j23EibVLnp4zNXGW7LjryXYa2X6U/M96yoOX+ybZxwkYajdxRNEqYY3zhh7y0i6kfISKS2jr+EJq1YTUDEv5+w==
   dependencies:
     asyn
```

---

### Incident Patch 5: `470f6124` (2026-09-30)
**Commit Message**: chore: fix fuzzing test ci due to protobuf conflict (#5632)

Signed-off-by: Animesh Pathak <animesh.pathak@harness.io>

**File**: `chaoscenter/subscriber/go.mod` (modified, +32/-27)
```diff
@@ -21,7 +21,7 @@ require (
 require (
 	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
 	github.com/emicklei/go-restful/v3 v3.12.2 // indirect
-	github.com/evanphx/json-patch v5.9.11+incompatible // indirect
+	github.com/fxamacker/cbor/v2 v2.8.0 // indirect
 	github.com/go-logr/logr v1.4.3 // indirect
 	github.com/go-openapi/jsonpointer v0.21.1 // indirect
 	github.com/go-openapi/jsonreference v0.21.0 // indirect
@@ -30,18 +30,18 @@ require (
 	github.com/golang/protobuf v1.5.4 // indirect
 	github.com/google/gnostic-models v0.6.9 // indirect
 	github.com/google/go-cmp v0.7.0 // indirect
-	github.com/google/gofuzz v1.2.0 // indirect
-	github.com/googleapis/gnostic v0.5.5 // indirect
+	github.com/google/uuid v1.6.0 // indirect
 	github.com/grpc-ecosystem/grpc-gateway v1.16.0 // indirect
-	github.com/hashicorp/golang-lru v0.5.3 // indirect
-	github.com/imdario/mergo v0.3.12 // indirect
 	github.com/josharian/intern v1.0.0 // indirect
 	github.com/json-iterator/go v1.1.12 // indirect
 	github.com/mailru/easyjson v0.9.0 // indirect
 	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
 	github.com/modern-go/reflect2 v1.0.2 // indirect
+	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
+	github.com/pkg/errors v0.9.1 // indirect
 	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
 	github.com/spf13/pflag v1.0.6 // indirect
+	github.com/x448/float16 v0.8.4 // indirect
 	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
 	golang.org/x/sys v0.47.0 // indirect
@@ -53,41 +53,46 @@ require (
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	google.golang.org/grpc v1.83.2 // indirect
 	google.golang.org/protobuf v1.36.11 // indirect
+	gopkg.in/evanphx/json-patch.v4 v4.12.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	gopkg.in/yaml.v3 v3.0.1 // indirect
 	k8s.io/klog/v2 v2.130.1 // indirect
 	k8s.io/kube-openapi v0.0.0-20250318190949-c8a335a9a2ff // indirect
 	k8s.io/utils v0.0.0-20260319190234-28399d86e0b5 // indirect
 	sigs.k8s.io/controller-runtime v0.11.1 // indirect
+	sigs.k8s.io/json v0.0.0-20250730193827-2d320260d730 // indirect
 	sigs.k8s.io/randfill v1.0.0 // indirect
 	sigs.k8s.io/structured-merge-diff/v4 v4.7.0 // indirect
 	sigs.k8s.io/yaml v1.4.0 // indirect
 )
 
-// Pinned to kubernetes-1.21.2
+// Pinned to kubernetes-1.33.1, matching k8s.io/api and k8s.io/apimachinery above.
+// The k8s.io/* modules must stay on the same minor release: mixing an older
+// client-go (which vendors github.com/googleapis/gnostic) with a newer
+// kube-openapi (which vendors github.com/google/gnostic-models) links two
+// copies of extensions/extension.proto into one binary and panics at init with
+// a protobuf namespace conflict.
 replace (
 	github.com/docker/docker => github.com/moby/moby v0.7.3-0.20190826074503-38ab9da00309
 
 	github.com/emicklei/go-restful => github.com/emicklei/go-restful v2.16.0+incompatible
-	k8s.io/api => k8s.io/api v0.21.2
-	k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.21.2
-	k8s.io/apimachinery => k8s.io/apimachinery v0.21.2
-	k8s.io/apiserver => k8s.io/apiserver v0.21.2
-	k8s.io/cli-runtime => k8s.io/cli-runtime v0.21.2
-	k8s.io/client-go => k8s.io/client-go v0.21.2
-	k8s.io/cloud-provider => k8s.io/cloud-provider v0.21.2
-	k8s.io/code-generator => k8s.io/code-generator v0.21.2
-	k8s.io/component-base => k8s.io/component-base v0.21.2
-	k8s.io/cri-api => k8s.io/cri-api v0.21.2
-	k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.21.2
-	k8s.io/infra-bootstrap => k8s.io/infra-bootstrap v0.21.2
-	k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.21.2
-	k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.21.2
-	k8s.io/kube-proxy => k8s.io/kube-proxy v0.21.2
-	k8s.io/kube-scheduler => k8s.io/kube-scheduler v0.21.2
-	k8s.io/kubectl => k8s.io/kubectl v0.21.2
-	k8s.io/kubelet => k8s.io/ku
```

**File**: `chaoscenter/subscriber/go.sum` (modified, +27/-334)
```diff
@@ -1,425 +1,187 @@
 cloud.google.com/go v0.26.0/go.mod h1:aQUYkXzVsufM+DwF1aE+0xfcU+56JwCaLick0ClmMTw=
 cloud.google.com/go v0.34.0/go.mod h1:aQUYkXzVsufM+DwF1aE+0xfcU+56JwCaLick0ClmMTw=
-cloud.google.com/go v0.38.0/go.mod h1:990N+gfupTy94rShfmMCWGDn0LpTmnzTp2qbd1dvSRU=
-cloud.google.com/go v0.44.1/go.mod h1:iSa0KzasP4Uvy3f1mN/7PiObzGgflwredwwASm/v6AU=
-cloud.google.com/go v0.44.2/go.mod h1:60680Gw3Yr4ikxnPRS/oxxkBccT6SA1yMk63TGekxKY=
-cloud.google.com/go v0.45.1/go.mod h1:RpBamKRgapWJb87xiFSdk4g1CME7QZg3uwTez+TSTjc=
-cloud.google.com/go v0.46.3/go.mod h1:a6bKKbmY7er1mI7TEI4lsAkts/mkhTSZK8w33B4RAg0=
-cloud.google.com/go v0.50.0/go.mod h1:r9sluTvynVuxRIOHXQEHMFffphuXHOMZMycpNR5e6To=
-cloud.google.com/go v0.52.0/go.mod h1:pXajvRH/6o3+F9jDHZWQ5PbGhn+o8w9qiu/CffaVdO4=
-cloud.google.com/go v0.53.0/go.mod h1:fp/UouUEsRkN6ryDKNW/Upv/JBKnv6WDthjR6+vze6M=
-cloud.google.com/go v0.54.0/go.mod h1:1rq2OEkV3YMf6n/9ZvGWI3GWw0VoqH/1x2nd8Is/bPc=
-cloud.google.com/go/bigquery v1.0.1/go.mod h1:i/xbL2UlR5RvWAURpBYZTtm/cXjCha9lbfbpx4poX+o=
-cloud.google.com/go/bigquery v1.3.0/go.mod h1:PjpwJnslEMmckchkHFfq+HTD2DmtT67aNFKH1/VBDHE=
-cloud.google.com/go/bigquery v1.4.0/go.mod h1:S8dzgnTigyfTmLBfrtrhyYhwRxG72rYxvftPBK2Dvzc=
-cloud.google.com/go/datastore v1.0.0/go.mod h1:LXYbyblFSglQ5pkeyhO+Qmw7ukd3C+pD7TKLgZqpHYE=
-cloud.google.com/go/datastore v1.1.0/go.mod h1:umbIZjpQpHh4hmRpGhH4tLFup+FVzqBi1b3c64qFpCk=
-cloud.google.com/go/pubsub v1.0.1/go.mod h1:R0Gpsv3s54REJCy4fxDixWD93lHJMoZTyQ2kNxGRt3I=
-cloud.google.com/go/pubsub v1.1.0/go.mod h1:EwwdRX2sKPjnvnqCa270oGRyludottCI76h+R3AArQw=
-cloud.google.com/go/pubsub v1.2.0/go.mod h1:jhfEVHT8odbXTkndysNHCcx0awwzvfOlguIAii9o8iA=
-cloud.google.com/go/storage v1.0.0/go.mod h1:IhtSnM/ZTZV8YYJWCY8RULGVqBDmpoyjwiyrjsg+URw=
-cloud.google.com/go/storage v1.5.0/go.mod h1:tpKbwo567HUNpVclU5sGELwQWBDZ8gh0ZeosJ0Rtdos=
-cloud.google.com/go/storage v1.6.0/go.mod h1:N7U0C8pVQ/+NIKOBQyamJIeKQKkZ+mxpohlUTyfDhBk=
-dmitri.shuralyov.com/gpu/mtl v0.0.0-20190408044501-666a987793e9/go.mod h1:H6x//7gZCb22OMCxBHrMx7a5I7Hp++hsVxbQ4BYO7hU=
 github.com/AdaLogics/go-fuzz-headers v0.0.0-20230811130428-ced1acdcaa24 h1:bvDV9vkmnHYOMsOr4WLk+Vo07yKIzd94sVoIqshQ4bU=
 github.com/AdaLogics/go-fuzz-headers v0.0.0-20230811130428-ced1acdcaa24/go.mod h1:8o94RPi1/7XTJvwPpRSzSUedZrtlirdB3r9Z20bi2f8=
-github.com/Azure/go-autorest v14.2.0+incompatible/go.mod h1:r+4oMnoxhatjLLJ6zxSWATqVooLgysK6ZNox3g/xq24=
-github.com/Azure/go-autorest/autorest v0.11.12/go.mod h1:eipySxLmqSyC5s5k1CLupqet0PSENBEDP93LQ9a8QYw=
-github.com/Azure/go-autorest/autorest/adal v0.9.5/go.mod h1:B7KF7jKIeC9Mct5spmyCB/A8CG/sEz1vwIRGv/bbw7A=
-github.com/Azure/go-autorest/autorest/date v0.3.0/go.mod h1:BI0uouVdmngYNUzGWeSYnokU+TrmwEsOqdt8Y6sso74=
-github.com/Azure/go-autorest/autorest/mocks v0.4.1/go.mod h1:LTp+uSrOhSkaKrUy935gNZuuIPPVsHlr9DSOxSayd+k=
-github.com/Azure/go-autorest/logger v0.2.0/go.mod h1:T9E3cAhj2VqvPOtCYAvby9aBXkZmbF5NWuPV8+WeEW8=
-github.com/Azure/go-autorest/tracing v0.6.0/go.mod h1:+vhtPC754Xsa23ID7GlGsrdKBpUA79WCAKPPZVC2DeU=
 github.com/BurntSushi/toml v0.3.1/go.mod h1:xHWCNGjB5oqiDr8zfno3MHue2Ht5sIBksp03qcyfWMU=
-github.com/BurntSushi/xgb v0.0.0-20160522181843-27f122750802/go.mod h1:IVnqGOEym/WlBOVXweHU+Q+/VP0lqqI8lqeDx9IjBqo=
-github.com/NYTimes/gziphandler v0.0.0-20170623195520-56545f4a5d46/go.mod h1:3wb06e3pkSAbeQ52E9H9iFoQsEEwGN64994WTCIhntQ=
-github.com/PuerkitoBio/purell v1.1.1/go.mod h1:c11w/QuzBsJSee3cPx9rAFu61PvFxuPbtSwDGJws/X0=
-github.com/PuerkitoBio/urlesc v0.0.0-20170810143723-de5bf2ad4578/go.mod h1:uGdkoq3SwY9Y+13GIhn11/XLaGBb4BfwItxLd5jeuXE=
 github.com/antihax/optional v1.0.0/go.mod h1:uupD/76wgC+ih3iEmQUL+0Ugr19nfwCT1kdvxnR2qWY=
 github.com/argoproj/argo-workflows/v3 v3.7.14 h1:ptbGB8ljmDgV3PlX0dEMfHwuq1P9DklQ5Hi4XzHBVLA=
 github.com/argoproj/argo-workflows/v3 v3.7.14/go.mod h1:ZfqYgzWJJx8ZNZWAjog4fqBVaafF/XvTaMuZLKDlFFE=
-github.com/asaskevich/govalidator v0.0.0-20190424111038-f61b66f89f4a/go.mod h1:lB+ZfQJz7igIIfQNfa7Ml4HSf2uFQQRzpGGRXenZAgY=
```

---

### Incident Patch 6: `caabd49f` (2026-09-22)
**Commit Message**: chore: fix the build pipeline (#5624)

* chore: fix the build pipeline

Signed-off-by: Animesh Pathak <animesh.pathak@harness.io>

* chore: fix the build pipeline and cve

Signed-off-by: Animesh Pathak <animesh.pathak@harness.io>

---------

Signed-off-by: Animesh Pathak <animesh.pathak@harness.io>

**File**: `chaoscenter/authentication/go.mod` (modified, +7/-9)
```diff
@@ -12,9 +12,9 @@ require (
 	github.com/sirupsen/logrus v1.9.4
 	github.com/stretchr/testify v1.11.1
 	go.mongodb.org/mongo-driver v1.17.9
-	golang.org/x/crypto v0.53.0
+	golang.org/x/crypto v0.55.0
 	golang.org/x/oauth2 v0.36.0
-	google.golang.org/grpc v1.80.0
+	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.11
 )
 
@@ -54,13 +54,11 @@ require (
 	github.com/xdg-go/stringprep v1.0.4 // indirect
 	github.com/youmark/pkcs8 v0.0.0-20240726163527-a2c0da244d78 // indirect
 	go.mongodb.org/mongo-driver/v2 v2.5.0 // indirect
-	go.opentelemetry.io/otel v1.42.0 // indirect
-	go.opentelemetry.io/otel/sdk/metric v1.42.0 // indirect
 	golang.org/x/arch v0.25.0 // indirect
-	golang.org/x/net v0.56.0 // indirect
-	golang.org/x/sync v0.21.0 // indirect
-	golang.org/x/sys v0.46.0 // indirect
-	golang.org/x/text v0.38.0 // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260319201613-d00831a3d3e7 // indirect
+	golang.org/x/net v0.58.0 // indirect
+	golang.org/x/sync v0.22.0 // indirect
+	golang.org/x/sys v0.47.0 // indirect
+	golang.org/x/text v0.41.0 // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	gopkg.in/yaml.v3 v3.0.1 // indirect
 )
```

**File**: `chaoscenter/authentication/go.sum` (modified, +24/-24)
```diff
@@ -117,62 +117,62 @@ go.mongodb.org/mongo-driver/v2 v2.5.0 h1:yXUhImUjjAInNcpTcAlPHiT7bIXhshCTL3jVBkF
 go.mongodb.org/mongo-driver/v2 v2.5.0/go.mod h1:yOI9kBsufol30iFsl1slpdq1I0eHPzybRWdyYUs8K/0=
 go.opentelemetry.io/auto/sdk v1.2.1 h1:jXsnJ4Lmnqd11kwkBV2LgLoFMZKizbCi5fNZ/ipaZ64=
 go.opentelemetry.io/auto/sdk v1.2.1/go.mod h1:KRTj+aOaElaLi+wW1kO/DZRXwkF4C5xPbEe3ZiIhN7Y=
-go.opentelemetry.io/otel v1.42.0 h1:lSQGzTgVR3+sgJDAU/7/ZMjN9Z+vUip7leaqBKy4sho=
-go.opentelemetry.io/otel v1.42.0/go.mod h1:lJNsdRMxCUIWuMlVJWzecSMuNjE7dOYyWlqOXWkdqCc=
-go.opentelemetry.io/otel/metric v1.42.0 h1:2jXG+3oZLNXEPfNmnpxKDeZsFI5o4J+nz6xUlaFdF/4=
-go.opentelemetry.io/otel/metric v1.42.0/go.mod h1:RlUN/7vTU7Ao/diDkEpQpnz3/92J9ko05BIwxYa2SSI=
-go.opentelemetry.io/otel/sdk v1.42.0 h1:LyC8+jqk6UJwdrI/8VydAq/hvkFKNHZVIWuslJXYsDo=
-go.opentelemetry.io/otel/sdk v1.42.0/go.mod h1:rGHCAxd9DAph0joO4W6OPwxjNTYWghRWmkHuGbayMts=
-go.opentelemetry.io/otel/sdk/metric v1.42.0 h1:D/1QR46Clz6ajyZ3G8SgNlTJKBdGp84q9RKCAZ3YGuA=
-go.opentelemetry.io/otel/sdk/metric v1.42.0/go.mod h1:Ua6AAlDKdZ7tdvaQKfSmnFTdHx37+J4ba8MwVCYM5hc=
-go.opentelemetry.io/otel/trace v1.42.0 h1:OUCgIPt+mzOnaUTpOQcBiM/PLQ/Op7oq6g4LenLmOYY=
-go.opentelemetry.io/otel/trace v1.42.0/go.mod h1:f3K9S+IFqnumBkKhRJMeaZeNk9epyhnCmQh/EysQCdc=
+go.opentelemetry.io/otel v1.44.0 h1:JjwHmHpA4iZ3wBxluu2fbbE7j4kqlE8jXyAyPXH7HqU=
+go.opentelemetry.io/otel v1.44.0/go.mod h1:BMgjTHL9WPRlRjL2oZCBTL4whCGtXch2H4BhOPIAyYc=
+go.opentelemetry.io/otel/metric v1.44.0 h1:1w0gILTcHdr3YI+ixLyjemwrVnsMURbTZFrSYCdDdmc=
+go.opentelemetry.io/otel/metric v1.44.0/go.mod h1:8O7hanEPBNgEMmybD3s2VBKcgWOCsA6tzHBPODAiquo=
+go.opentelemetry.io/otel/sdk v1.44.0 h1:nHYwb9lK+fJPU/dnT6s7W7Z8itMWyqrnVfbheVYrZ58=
+go.opentelemetry.io/otel/sdk v1.44.0/go.mod h1:Osuydd3Se74nqjAKxid74N5eC+jfEqfTegHRnq58oK0=
+go.opentelemetry.io/otel/sdk/metric v1.44.0 h1:3LlKgI+VjbVsjNRFZJZAJ30WjXC5VkNRks6si09iEfI=
+go.opentelemetry.io/otel/sdk/metric v1.44.0/go.mod h1:5B5pMARnXxKhltooO4xUuCBorl65a4EpnTalObqOigA=
+go.opentelemetry.io/otel/trace v1.44.0 h1:jxF5CsGYCe74MCRx2X4g7WsY/VBKRqqpNvXlX/6gtIk=
+go.opentelemetry.io/otel/trace v1.44.0/go.mod h1:oLl1jrMQAVo6v3GAggN+1VH9VIz9iUSvW53sW1Q8PIE=
 go.uber.org/mock v0.6.0 h1:hyF9dfmbgIX5EfOdasqLsWD6xqpNZlXblLB/Dbnwv3Y=
 go.uber.org/mock v0.6.0/go.mod h1:KiVJ4BqZJaMj4svdfmHM0AUx4NJYO8ZNpPnZn1Z+BBU=
 golang.org/x/arch v0.25.0 h1:qnk6Ksugpi5Bz32947rkUgDt9/s5qvqDPl/gBKdMJLE=
 golang.org/x/arch v0.25.0/go.mod h1:0X+GdSIP+kL5wPmpK7sdkEVTt2XoYP0cSjQSbZBwOi8=
 golang.org/x/crypto v0.0.0-20190308221718-c2843e01d9a2/go.mod h1:djNgcEr1/C05ACkg1iLfiJU5Ep61QUkGW8qpdssI0+w=
 golang.org/x/crypto v0.0.0-20210921155107-089bfa567519/go.mod h1:GvvjBRRGRdwPK5ydBHafDWAxML/pGHZbMvKqRZ5+Abc=
-golang.org/x/crypto v0.53.0 h1:QZ4Muo8THX6CizN2vPPd5fBGHyogrdK9fG4wLPFUsto=
-golang.org/x/crypto v0.53.0/go.mod h1:DNLU434OwVakk9PzuwV8w62mAJpRJL3vsgcfp4Qnsio=
+golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
+golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
 golang.org/x/mod v0.6.0-dev.0.20220419223038-86c51ed26bb4/go.mod h1:jJ57K6gSWd91VN4djpZkiMVwK6gcyfeH4XE8wZrZaV4=
 golang.org/x/net v0.0.0-20190620200207-3b0461eec859/go.mod h1:z5CRVTTTmAJ677TzLLGU+0bjPO0LkuOLi4/5GtJWs/s=
 golang.org/x/net v0.0.0-20210226172049-e18ecbb05110/go.mod h1:m0MpNAwzfU5UDzcl9v0D8zg8gWTRqZa9RBIspLL5mdg=
 golang.org/x/net v0.0.0-20220722155237-a158d28d115b/go.mod h1:XRhObCWvk6IyKnWLug+ECip1KBveYUHfp+8e9klMJ9c=
-golang.org/x/net v0.56.0 h1:Rw8j/hFzGvJUZwNBXnAtf5sVDVt+65SK2C7IxCxZt5o=
-golang.org/x/net v0.56.0/go.mod h1:D3Ku6r+V6JROoZK144D2XfMHFcMq/0zSfLelVTCFKec=
+golang.org/x/net v0.58.0 h1:ynWG7rqYi4ccpTEuPZ2QGWHktVEM9DMCj9yzDE0Q7To=
+golang.org/x/net v0.58.0/go.mod h1:YwCddHnFlT7eLQqVprV19OnhLGtc5xOKgE0RyqgfWAU=
 golang.org/x/oauth2 v0.36.0 h1:peZ/1z27fi9hUOFCAZaHyrpWG5lwe0RJEEEeH0ThlIs=
 golang.org/x/oauth2 v0.36.0/go.mod h1:YDBUJMTkDnJS+A4BP4eZBjCqtokkg1hODuPjwiGPO7Q=
 golang.org/x/sync v0.0.0-20190423024810-
```

**File**: `chaoscenter/event-tracker/go.mod` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ require (
 	golang.org/x/oauth2 v0.27.0 // indirect
 	golang.org/x/sys v0.46.0 // indirect
 	golang.org/x/term v0.44.0 // indirect
-	golang.org/x/text v0.38.0 // indirect
+	golang.org/x/text v0.41.0 // indirect
 	golang.org/x/time v0.3.0 // indirect
 	gomodules.xyz/jsonpatch/v2 v2.3.0 // indirect
 	google.golang.org/protobuf v1.36.7 // indirect
```

**File**: `chaoscenter/event-tracker/go.sum` (modified, +8/-8)
```diff
@@ -162,8 +162,8 @@ golang.org/x/lint v0.0.0-20190930215403-16217165b5de/go.mod h1:6SW0HCj/g11FgYtHl
 golang.org/x/mod v0.2.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.3.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.4.2/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
-golang.org/x/mod v0.36.0 h1:JJjpVx6myfUsUdAzZuOSTTmRE0PfZeNWzzvKrP7amb4=
-golang.org/x/mod v0.36.0/go.mod h1:moc6ELqsWcOw5Ef3xVprK5ul/MvtVvkIXLziUOICjUQ=
+golang.org/x/mod v0.38.0 h1:MECBjubtXD7yj4HrhIUcywNaGeNVUdfVnxmPajOk4yk=
+golang.org/x/mod v0.38.0/go.mod h1:V6Xz0pq8TQ3dGqVQ1FVHuelZpAL0uNhSkk9ogYP3c40=
 golang.org/x/net v0.0.0-20180906233101-161cd47e91fd/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20190311183353-d8887717615a/go.mod h1:t9HGtf8HONx5eT2rtn7q6eTqICYqUVnKs3thJo3Qplg=
 golang.org/x/net v0.0.0-20190404232315-eb5bcb51f2a3/go.mod h1:t9HGtf8HONx5eT2rtn7q6eTqICYqUVnKs3thJo3Qplg=
@@ -182,8 +182,8 @@ golang.org/x/sync v0.0.0-20190423024810-112230192c58/go.mod h1:RxMgew5VJxzue5/jJ
 golang.org/x/sync v0.0.0-20190911185100-cd5d95a43a6e/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20201020160332-67f06af15bc9/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20210220032951-036812b2e83c/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
-golang.org/x/sync v0.21.0 h1:HLII4xRRTtCRkxYp4HNFF0Js/Og6q2i++KXbg0gHCwM=
-golang.org/x/sync v0.21.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/sync v0.22.0 h1:SZjpbeLmrCk4xhRSZFNZW5gFUeCeFgjekvI/+gfScek=
+golang.org/x/sync v0.22.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
 golang.org/x/sys v0.0.0-20180909124046-d0be0721c37e/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20190215142949-d0b11bdaac8a/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20190412213103-97732733099d/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
@@ -204,8 +204,8 @@ golang.org/x/term v0.44.0 h1:0rLvDRCtNj0gZkyIXhCyOb2OAzEhLVqc4B+hrsBhrmc=
 golang.org/x/term v0.44.0/go.mod h1:7ze4MdzUzLXpSAoFP1H0bOI9aXDqveSvatT5vKcFh2Y=
 golang.org/x/text v0.3.0/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=
 golang.org/x/text v0.3.3/go.mod h1:5Zoc/QRtKVWzQhOtBMvqHzDpF6irO9z98xDceosuGiQ=
-golang.org/x/text v0.38.0 h1:sXmwo9DwP3OK9EZ7PqAdaooSGozfl/3a6/xJcbzPRhE=
-golang.org/x/text v0.38.0/go.mod h1:YXZt3QhHUKYT53r2lLKFIVi6Ao1jdzrTR/KQ09qyxF4=
+golang.org/x/text v0.41.0 h1:vz/seA0lnX87Othu2f/0L24RcgrXD9/YFTSuGjj3rH8=
+golang.org/x/text v0.41.0/go.mod h1:jvf1O8ajNzZqhSrQBPbutR/EB83Cc0CFrezNQIwbb5M=
 golang.org/x/time v0.3.0 h1:rg5rLMjNzMS1RkNLzCG38eapWhnYLFYXDXj2gOlr8j4=
 golang.org/x/time v0.3.0/go.mod h1:tRJNPiyCQ0inRvYxbN9jk5I+vvW/OXSQhTDSoE431IQ=
 golang.org/x/tools v0.0.0-20180917221912-90fa682c2a6e/go.mod h1:n7NCudcB/nEzxVGmLbDWY5pfWTLqBcC2KZ6jyYvM4mQ=
@@ -215,8 +215,8 @@ golang.org/x/tools v0.0.0-20200619180055-7c47624df98f/go.mod h1:EkVYQZoAsY45+roY
 golang.org/x/tools v0.0.0-20201224043029-2b0845dc783e/go.mod h1:emZCQorbCU4vsT4fOWvOPXz4eW1wZW4PmDk9uLelYpA=
 golang.org/x/tools v0.0.0-20210106214847-113979e3529a/go.mod h1:emZCQorbCU4vsT4fOWvOPXz4eW1wZW4PmDk9uLelYpA=
 golang.org/x/tools v0.1.5/go.mod h1:o0xws9oXOQQZyjljx8fwUC0k7L1pTE6eaCbjGeHmOkk=
-golang.org/x/tools v0.45.0 h1:18qN3FAooORvApf5XjCXgsuayZOEtXf6JK18I3+ONa8=
-golang.org/x/tools v0.45.0/go.mod h1:LuUGqqaXcXMEFEruIVJVm5mgDD8vww/z/SR1gQ4uE/0=
+golang.org/x/tools v0.48.0 h1:3+hClM1aLL5mjMKm5ovokw9epgRXPuu2tILgismM6RE=
+golang.org/x/tools v0.48.0/go.mod h1:08xX0orndb/F7jJxGDicx061tyd5pcMto75YMAXr6lk=
 golang.org/x/xerrors v0.0.0-20190717185122-a985d3407aa7/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
 golang.org/x/xerrors v0.0.0-20191011141410-1b5146add898/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
 golang.org/x/xerrors v0.0.0-20191204190536-9bdfabe68543/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBau
```

**File**: `chaoscenter/graphql/server/go.mod` (modified, +4/-4)
```diff
@@ -26,7 +26,7 @@ require (
 	github.com/vektah/gqlparser/v2 v2.5.16
 	go.mongodb.org/mongo-driver v1.17.7
 	golang.org/x/crypto v0.55.0
-	google.golang.org/grpc v1.82.1
+	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.11
 	gopkg.in/yaml.v2 v2.4.0
 	k8s.io/api v0.33.1
@@ -107,16 +107,16 @@ require (
 	github.com/youmark/pkcs8 v0.0.0-20240726163527-a2c0da244d78 // indirect
 	go.yaml.in/yaml/v2 v2.4.2 // indirect
 	golang.org/x/arch v0.8.0 // indirect
-	golang.org/x/net v0.57.0 // indirect
+	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
 	golang.org/x/sync v0.22.0 // indirect
 	golang.org/x/sys v0.47.0 // indirect
 	golang.org/x/term v0.45.0 // indirect
 	golang.org/x/text v0.41.0 // indirect
 	golang.org/x/time v0.11.0 // indirect
 	google.golang.org/genproto v0.0.0-20250603155806-513f23925822 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260414002931-afd174a4e478 // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260414002931-afd174a4e478 // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	gopkg.in/warnings.v0 v0.1.2 // indirect
 	gopkg.in/yaml.v3 v3.0.1 // indirect
```

---

### Incident Patch 7: `d848e23e` (2026-09-21)
**Commit Message**: fix(subscriber): resolve adminModeNamespace for chaos engine probe check (#5617)

In LitmusChaos workflows where adminMode is enabled, the raw step manifest retains the unrendered Argo template placeholder '{{workflow.parameters.adminModeNamespace}}'. During execution event processing, CheckChaosData queried GetChaosEngine using this literal placeholder as the namespace, which failed to find the ChaosEngine CR. Consequently, probe execution history fell back to reporting SOT even when probes were configured in EOT mode.

This commit resolves the adminModeNamespace from the workflow's parameter arguments with a fallback to the workflow namespace, ensuring CheckChaosData queries the ChaosEngine in its actual deployed namespace.

Fixes #5603

Signed-off-by: mimo-to <rounakhati18@gmail.com>
Co-authored-by: Shubham Chaudhary <shubham.chaudhary@harness.io>

**File**: `chaoscenter/subscriber/pkg/events/definations.go` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ import (
 type SubscriberEvents interface {
 	ChaosEventWatcher(stopCh chan struct{}, stream chan types.WorkflowEvent, infraData map[string]string)
 	StopChaosEngineState(namespace string, workflowRunID *string) error
-	CheckChaosData(nodeStatus v1alpha13.NodeStatus, workflowNS string, chaosClient *v1alpha12.LitmuschaosV1alpha1Client) (string, *types.ChaosData, error)
+	CheckChaosData(nodeStatus v1alpha13.NodeStatus, workflowNS string, chaosEngineNS string, chaosClient *v1alpha12.LitmuschaosV1alpha1Client) (string, *types.ChaosData, error)
 	GetWorkflowObj(uid string) (*v1alpha1.Workflow, error)
 	ListWorkflowObject(wfid string) (*v1alpha1.WorkflowList, error)
 	GenerateWorkflowPayload(cid, accessKey, version, completed string, wfEvent types.WorkflowEvent) ([]byte, error)
```

**File**: `chaoscenter/subscriber/pkg/events/mocks/events.go` (modified, +4/-4)
```diff
@@ -49,19 +49,19 @@ func (mr *MockSubscriberEventsMockRecorder) ChaosEventWatcher(arg0, arg1, arg2 i
 }
 
 // CheckChaosData mocks base method.
-func (m *MockSubscriberEvents) CheckChaosData(arg0 v1alpha1.NodeStatus, arg1 string, arg2 *v1alpha10.LitmuschaosV1alpha1Client) (string, *types.ChaosData, error) {
+func (m *MockSubscriberEvents) CheckChaosData(arg0 v1alpha1.NodeStatus, arg1, arg2 string, arg3 *v1alpha10.LitmuschaosV1alpha1Client) (string, *types.ChaosData, error) {
 	m.ctrl.T.Helper()
-	ret := m.ctrl.Call(m, "CheckChaosData", arg0, arg1, arg2)
+	ret := m.ctrl.Call(m, "CheckChaosData", arg0, arg1, arg2, arg3)
 	ret0, _ := ret[0].(string)
 	ret1, _ := ret[1].(*types.ChaosData)
 	ret2, _ := ret[2].(error)
 	return ret0, ret1, ret2
 }
 
 // CheckChaosData indicates an expected call of CheckChaosData.
-func (mr *MockSubscriberEventsMockRecorder) CheckChaosData(arg0, arg1, arg2 interface{}) *gomock.Call {
+func (mr *MockSubscriberEventsMockRecorder) CheckChaosData(arg0, arg1, arg2, arg3 interface{}) *gomock.Call {
 	mr.mock.ctrl.T.Helper()
-	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "CheckChaosData", reflect.TypeOf((*MockSubscriberEvents)(nil).CheckChaosData), arg0, arg1, arg2)
+	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "CheckChaosData", reflect.TypeOf((*MockSubscriberEvents)(nil).CheckChaosData), arg0, arg1, arg2, arg3)
 }
 
 // GenerateWorkflowPayload mocks base method.
```

**File**: `chaoscenter/subscriber/pkg/events/util.go` (modified, +26/-2)
```diff
@@ -78,7 +78,7 @@ func (ev *subscriberEvents) getChaosData(nodeStatus v1alpha13.NodeStatus, engine
 }
 
 // CheckChaosData util function, checks if event is a chaos-exp event, if so -  extract the chaos data
-func (ev *subscriberEvents) CheckChaosData(nodeStatus v1alpha13.NodeStatus, workflowNS string, chaosClient *v1alpha12.LitmuschaosV1alpha1Client) (string, *types.ChaosData, error) {
+func (ev *subscriberEvents) CheckChaosData(nodeStatus v1alpha13.NodeStatus, workflowNS string, chaosEngineNS string, chaosClient *v1alpha12.LitmuschaosV1alpha1Client) (string, *types.ChaosData, error) {
 	nodeType := string(nodeStatus.Type)
 	var cd *types.ChaosData = nil
 	// considering chaos events has only 1 artifact with manifest as raw data
@@ -100,13 +100,37 @@ func (ev *subscriberEvents) CheckChaosData(nodeStatus v1alpha13.NodeStatus, work
 					return nodeType, nil, errors.New("Chaos-Engine Generated Name couldn't be retrieved")
 				}
 			}
-			cd, err = ev.getChaosData(nodeStatus, name, obj.GetNamespace(), chaosClient)
+			engineNS := resolveEngineNamespace(obj.GetNamespace(), chaosEngineNS)
+			cd, err = ev.getChaosData(nodeStatus, name, engineNS, chaosClient)
 			return nodeType, cd, err
 		}
 	}
 	return nodeType, nil, nil
 }
 
+// resolveEngineNamespace returns fallbackNS if manifestNS is empty or contains unrendered template syntax (e.g. {{...}}).
+func resolveEngineNamespace(manifestNS, fallbackNS string) string {
+	engineNS := strings.TrimSpace(manifestNS)
+	if engineNS == "" || strings.Contains(engineNS, "{{") {
+		return fallbackNS
+	}
+	return engineNS
+}
+
+// getAdminModeNamespace extracts adminModeNamespace from workflow parameters, returning fallbackNS if absent or unrendered.
+func getAdminModeNamespace(parameters []v1alpha1.Parameter, fallbackNS string) string {
+	for _, param := range parameters {
+		if param.Name == "adminModeNamespace" {
+			val := strings.TrimSpace(param.GetValue())
+			if val != "" && !strings.Contains(val, "{{") {
+				return val
+			}
+			break
+		}
+	}
+	return fallbackNS
+}
+
 func getNameFromLog(log string) string {
 	re := regexp.MustCompile(`ChaosEngine Name : ([\w-]+)`)
 	match := re.FindStringSubmatch(log)
```

**File**: `chaoscenter/subscriber/pkg/events/util_test.go` (added, +238/-0)
```diff
@@ -0,0 +1,238 @@
+package events
+
+import (
+	"testing"
+
+	"github.com/argoproj/argo-workflows/v3/pkg/apis/workflow/v1alpha1"
+	"github.com/stretchr/testify/assert"
+)
+
+func TestResolveEngineNamespace(t *testing.T) {
+	tests := []struct {
+		name       string
+		manifestNS string
+		fallbackNS string
+		expected   string
+	}{
+		{
+			name:       "unrendered template falls back to fallbackNS",
+			manifestNS: "{{workflow.parameters.adminModeNamespace}}",
+			fallbackNS: "custom-chaos-ns",
+			expected:   "custom-chaos-ns",
+		},
+		{
+			name:       "unrendered template with spaces falls back to fallbackNS",
+			manifestNS: "  {{ workflow.parameters.adminModeNamespace }}  ",
+			fallbackNS: "custom-chaos-ns",
+			expected:   "custom-chaos-ns",
+		},
+		{
+			name:       "empty manifest namespace falls back to fallbackNS",
+			manifestNS: "",
+			fallbackNS: "custom-chaos-ns",
+			expected:   "custom-chaos-ns",
+		},
+		{
+			name:       "whitespace manifest namespace falls back to fallbackNS",
+			manifestNS: "   ",
+			fallbackNS: "custom-chaos-ns",
+			expected:   "custom-chaos-ns",
+		},
+		{
+			name:       "explicit literal namespace is preserved unchanged",
+			manifestNS: "sock-shop",
+			fallbackNS: "custom-chaos-ns",
+			expected:   "sock-shop",
+		},
+		{
+			name:       "explicit literal namespace with whitespace is trimmed",
+			manifestNS: "  sock-shop  ",
+			fallbackNS: "custom-chaos-ns",
+			expected:   "sock-shop",
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			result := resolveEngineNamespace(tt.manifestNS, tt.fallbackNS)
+			assert.Equal(t, tt.expected, result)
+		})
+	}
+}
+
+func TestGetAdminModeNamespace(t *testing.T) {
+	customVal := v1alpha1.AnyString("custom-chaos-ns")
+	spacesVal := v1alpha1.AnyString("  spaced-ns  ")
+	templateVal := v1alpha1.AnyString("{{workflow.parameters.adminModeNamespace}}")
+	emptyVal := v1alpha1.AnyString("")
+	whiteSpaceVal := v1alpha1.AnyString("   ")
+	defaultVal := v1alpha1.AnyString("default-chaos-ns")
+
+	tests := []struct {
+		name       string
+		params     []v1alpha1.Parameter
+		fallbackNS string
+		expected   string
+	}{
+		{
+			name: "adminModeNamespace parameter present with valid value",
+			params: []v1alpha1.Parameter{
+				{Name: "otherParam", Value: &customVal},
+				{Name: "adminModeNamespace", Value: &customVal},
+			},
+			fallbackNS: "litmus",
+			expected:   "custom-chaos-ns",
+		},
+		{
+			name: "adminModeNamespace parameter present with whitespace trimmed",
+			params: []v1alpha1.Parameter{
+				{Name: "adminModeNamespace", Value: &spacesVal},
+			},
+			fallbackNS: "litmus",
+			expected:   "spaced-ns",
+		},
+		{
+			name: "adminModeNamespace parameter with unrendered template falls back",
+			params: []v1alpha1.Parameter{
+				{Name: "adminModeNamespace", Value: &templateVal},
+			},
+			fallbackNS: "litmus",
+			expected:   "litmus",
+		},
+		{
+			name: "adminModeNamespace parameter with empty value falls back",
+			params: []v1alpha1.Parameter{
+				{Name: "adminModeNamespace", Value: &emptyVal},
+			},
+			fallbackNS: "litmus",
+			expected:   "litmus",
+		},
+		{
+			name: "adminModeNamespace parameter with whitespace only falls back",
+			params: []v1alpha1.Parameter{
+				{Name: "adminModeNamespace", Value: &whiteSpaceVal},
+			},
+			fallbackNS: "litmus",
+			expected:   "litmus",
+		},
+		{
+			name: "adminModeNamespace parameter using Default field",
+			params: []v1alpha1.Parameter{
+				{Name: "adminModeNamespace", Default: &defaultVal},
+			},
+			fallbackNS: "litmus",
+			expected:   "default-chaos-ns",
+		},
+		{
+			name: "adminModeNamespace parameter missing entirely",
+			params: []v1alpha1.Parameter{
+				{Name: "otherParam", Value: &customVal},
+			},
+			fallbackNS: "litmus",
+			expected:   "litmus",
+		},
+		{
+			name:       "nil parameters slice falls back",
+			params:     nil,
+			fallbackNS: "litmus",
+			expected:   "litmus",
+		},
+		{
+			name:       "empty parameters slice 
```

**File**: `chaoscenter/subscriber/pkg/events/workflow.go` (modified, +3/-1)
```diff
@@ -125,6 +125,8 @@ func (ev *subscriberEvents) WorkflowEventHandler(oldObj, workflowObj *v1alpha1.W
 	nodes := make(map[string]types.Node)
 	logrus.Info("Workflow RUN_ID: ", workflowObj.UID, " and event type: ", eventType)
 
+	adminModeNS := getAdminModeNamespace(workflowObj.Spec.Arguments.Parameters, workflowObj.ObjectMeta.Namespace)
+
 	for i, nodeStatus := range workflowObj.Status.Nodes {
 
 		var (
@@ -135,7 +137,7 @@ func (ev *subscriberEvents) WorkflowEventHandler(oldObj, workflowObj *v1alpha1.W
 		// considering chaos events has only 1 artifact with manifest as raw data
 		if nodeStatus.Type == "Pod" && nodeStatus.Inputs != nil && len(nodeStatus.Inputs.Artifacts) == 1 && nodeStatus.Inputs.Artifacts[0].Raw != nil {
 			//extracts chaos data
-			nodeType, cd, err = ev.CheckChaosData(nodeStatus, workflowObj.ObjectMeta.Namespace, chaosClient)
+			nodeType, cd, err = ev.CheckChaosData(nodeStatus, workflowObj.ObjectMeta.Namespace, adminModeNS, chaosClient)
 			if err != nil {
 				logrus.WithError(err).Print("Failed to parse ChaosEngine CRD")
 			}
```

---

### Incident Patch 8: `3cf4dddf` (2026-09-16)
**Commit Message**: fix(web): prevent ChaosEngine tolerations data-loss during experiment UI updates (#5590)

- Normalize incoming and existing tolerations to array before spreading
- Prevent runtime TypeError on single-object and legacy manifest shapes
- Align toleration types in FaultComponents and RunnerInfo with kubernetes schema
- Preserve pre-configured node-pools and taint tolerations during UI updates

Fixes #5589

Signed-off-by: Aryanbhargava18 <aryanbhargava644@gmail.com>

**File**: `chaoscenter/web/src/models/chaosEngine.ts` (modified, +2/-2)
```diff
@@ -103,7 +103,7 @@ export interface RunnerInfo {
   // Secrets for runner pod
   secrets?: kubernetes.Secret[];
   // Tolerations for runner pod
-  tolerations?: kubernetes.Toleration;
+  tolerations?: kubernetes.Toleration[];
   // Resource requirements for the runner pod
   resources?: kubernetes.ResourceRequirements;
 }
@@ -341,7 +341,7 @@ export interface FaultComponents {
   nodeSelector?: { [key: string]: string };
   statusCheckTimeouts?: StatusCheckTimeout;
   resources?: kubernetes.ResourceRequirements;
-  tolerations?: kubernetes.Toleration;
+  tolerations?: kubernetes.Toleration[];
 }
 
 // StatusCheckTimeout contains Delay and timeouts for the status checks
```

**File**: `chaoscenter/web/src/services/experiment/KubernetesYamlService.ts` (modified, +17/-2)
```diff
@@ -451,16 +451,31 @@ export class KubernetesYamlService extends ExperimentYamlService {
       return manifest;
     }
 
+    const existingRunnerTols = manifest.spec.components?.runner?.tolerations;
+    const normalizedRunnerTols = Array.isArray(existingRunnerTols) 
+      ? existingRunnerTols 
+      : existingRunnerTols 
+        ? [existingRunnerTols] 
+        : [];
+
     manifest.spec.components = {
       ...manifest.spec.components,
       runner: {
         ...manifest.spec.components?.runner,
-        tolerations: tolerations
+        tolerations: [...normalizedRunnerTols, tolerations]
       }
     };
+
+    const existingExpTols = manifest.spec.experiments[0].spec.components?.tolerations;
+    const normalizedExpTols = Array.isArray(existingExpTols)
+      ? existingExpTols
+      : existingExpTols
+        ? [existingExpTols]
+        : [];
+
     manifest.spec.experiments[0].spec.components = {
       ...manifest.spec.experiments[0].spec.components,
-      tolerations: tolerations
+      tolerations: [...normalizedExpTols, tolerations]
     };
 
     return manifest;
```

---

### Incident Patch 9: `ef4fa5b1` (2026-09-16)
**Commit Message**: feat: add GraphQL query complexity limiting via FixedComplexityLimit (#5595)

* feat: add GraphQL query complexity limiting via FixedComplexityLimit

Signed-off-by: VarshaUN <varshaun58@gmail.com>

* add range validation and rename

Signed-off-by: VarshaUN <varshaun58@gmail.com>

* Potential fix for pull request finding

Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>
Signed-off-by: Varsha U N <varshaun58@gmail.com>

* fix CI errors

Signed-off-by: VarshaUN <varshaun58@gmail.com>

* fix CI errors

Signed-off-by: VarshaUN <varshaun58@gmail.com>

* fix ci errors

Signed-off-by: VarshaUN <varshaun58@gmail.com>

* fix ci errors

Signed-off-by: VarshaUN <varshaun58@gmail.com>

---------

Signed-off-by: VarshaUN <varshaun58@gmail.com>
Signed-off-by: Varsha U N <varshaun58@gmail.com>
Co-authored-by: Pritesh Kiri <77957844+PriteshKiri@users.noreply.github.com>
Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>

**File**: `chaoscenter/graphql/server/go.mod` (modified, +6/-6)
```diff
@@ -25,7 +25,7 @@ require (
 	github.com/tidwall/sjson v1.2.5
 	github.com/vektah/gqlparser/v2 v2.5.16
 	go.mongodb.org/mongo-driver v1.17.7
-	golang.org/x/crypto v0.53.0
+	golang.org/x/crypto v0.55.0
 	google.golang.org/grpc v1.82.1
 	google.golang.org/protobuf v1.36.11
 	gopkg.in/yaml.v2 v2.4.0
@@ -107,12 +107,12 @@ require (
 	github.com/youmark/pkcs8 v0.0.0-20240726163527-a2c0da244d78 // indirect
 	go.yaml.in/yaml/v2 v2.4.2 // indirect
 	golang.org/x/arch v0.8.0 // indirect
-	golang.org/x/net v0.56.0 // indirect
+	golang.org/x/net v0.57.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
-	golang.org/x/sync v0.21.0 // indirect
-	golang.org/x/sys v0.46.0 // indirect
-	golang.org/x/term v0.44.0 // indirect
-	golang.org/x/text v0.39.0 // indirect
+	golang.org/x/sync v0.22.0 // indirect
+	golang.org/x/sys v0.47.0 // indirect
+	golang.org/x/term v0.45.0 // indirect
+	golang.org/x/text v0.41.0 // indirect
 	golang.org/x/time v0.11.0 // indirect
 	google.golang.org/genproto v0.0.0-20250603155806-513f23925822 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260414002931-afd174a4e478 // indirect
```

**File**: `chaoscenter/graphql/server/go.sum` (modified, +12/-12)
```diff
@@ -1284,8 +1284,8 @@ golang.org/x/crypto v0.0.0-20201002170205-7f63de1d35b0/go.mod h1:LzIPMQfyMNhhGPh
 golang.org/x/crypto v0.0.0-20210220033148-5ea612d1eb83/go.mod h1:jdWPYTVW3xRLrWPugEBEK3UY2ZEsg3UU495nc5E+M+I=
 golang.org/x/crypto v0.0.0-20210921155107-089bfa567519/go.mod h1:GvvjBRRGRdwPK5ydBHafDWAxML/pGHZbMvKqRZ5+Abc=
 golang.org/x/crypto v0.0.0-20220622213112-05595931fe9d/go.mod h1:IxCIyHEi3zRg3s0A5j5BB6A9Jmi73HwBIUl50j+osU4=
-golang.org/x/crypto v0.53.0 h1:QZ4Muo8THX6CizN2vPPd5fBGHyogrdK9fG4wLPFUsto=
-golang.org/x/crypto v0.53.0/go.mod h1:DNLU434OwVakk9PzuwV8w62mAJpRJL3vsgcfp4Qnsio=
+golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
+golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
 golang.org/x/exp v0.0.0-20190121172915-509febef88a4/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20190125153040-c74c464bbbf2/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20190306152737-a1d7652674e8/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
@@ -1391,8 +1391,8 @@ golang.org/x/net v0.0.0-20210525063256-abc453219eb5/go.mod h1:9nx3DQGgdP8bBQD5qx
 golang.org/x/net v0.0.0-20211015210444-4f30a5c0130f/go.mod h1:9nx3DQGgdP8bBQD5qxJ1jj9UTztislL4KSBs9R2vV5Y=
 golang.org/x/net v0.0.0-20211112202133-69e39bad7dc2/go.mod h1:9nx3DQGgdP8bBQD5qxJ1jj9UTztislL4KSBs9R2vV5Y=
 golang.org/x/net v0.0.0-20220722155237-a158d28d115b/go.mod h1:XRhObCWvk6IyKnWLug+ECip1KBveYUHfp+8e9klMJ9c=
-golang.org/x/net v0.56.0 h1:Rw8j/hFzGvJUZwNBXnAtf5sVDVt+65SK2C7IxCxZt5o=
-golang.org/x/net v0.56.0/go.mod h1:D3Ku6r+V6JROoZK144D2XfMHFcMq/0zSfLelVTCFKec=
+golang.org/x/net v0.57.0 h1:K5+3DljvIuDG9/Jv9rvyMywYNFCQ9RSUY6OOTTkT+tE=
+golang.org/x/net v0.57.0/go.mod h1:KpXc8iv+r3XplLAG/f7Jsf9RPszJzdR0f58q9vGOuEU=
 golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.0.0-20181106182150-f42d05182288/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.0.0-20190226205417-e64efc72b421/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
@@ -1422,8 +1422,8 @@ golang.org/x/sync v0.0.0-20201020160332-67f06af15bc9/go.mod h1:RxMgew5VJxzue5/jJ
 golang.org/x/sync v0.0.0-20201207232520-09787c993a3a/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20210220032951-036812b2e83c/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20220722155255-886fb9371eb4/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
-golang.org/x/sync v0.21.0 h1:HLII4xRRTtCRkxYp4HNFF0Js/Og6q2i++KXbg0gHCwM=
-golang.org/x/sync v0.21.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/sync v0.22.0 h1:SZjpbeLmrCk4xhRSZFNZW5gFUeCeFgjekvI/+gfScek=
+golang.org/x/sync v0.22.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
 golang.org/x/sys v0.0.0-20170830134202-bb24a47a89ea/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20171026204733-164713f0dfce/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20180117170059-2c42eef0765b/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
@@ -1514,14 +1514,14 @@ golang.org/x/sys v0.0.0-20220704084225-05e143d24a9e/go.mod h1:oPkhp1MJrh7nUepCBc
 golang.org/x/sys v0.0.0-20220715151400-c0bba94af5f8/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.0.0-20220722155257-8c9f86f7a55f/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.6.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
-golang.org/x/sys v0.46.0 h1:noSf2Fq6F8DBgS+LysIkx7rIExoNHJsxOAtPp4rthXw=
-golang.org/x/sys v0.46.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
+golang.org/x/sys v0.47.0 h1:o7XGOvZQCADBQQ4Y7VNq2dRWQR7JmOUW8Kxx4ZsNgWs=
+golang.org/x/sys v0.47.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
 golang.org/x/term v0.0.0-20201117132131-f5c789dd3221/go.mod h1:Nr5EM
```

**File**: `chaoscenter/graphql/server/server.go` (modified, +6/-0)
```diff
@@ -150,6 +150,12 @@ func main() {
 	if enableIntrospection {
 		srv.Use(extension.Introspection{})
 	}
+	limit := utils.Config.GqlQueryComplexityLimit
+	if limit > 0 {
+		srv.Use(extension.FixedComplexityLimit(limit))
+	} else if limit < 0 {
+		log.Warnf("GQL_QUERY_COMPLEXITY_LIMIT is set to %d which is invalid; skipping complexity limiting", limit)
+	}
 
 	// GraphQL operation tracking middleware
 	srv.AroundOperations(func(ctx context.Context, next graphql.OperationHandler) graphql.ResponseHandler {
```

**File**: `chaoscenter/graphql/server/utils/variables.go` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ type Configuration struct {
 	TlsKeyPath                  string   `split_words:"true"`
 	CaCertTlsPath               string   `split_words:"true"`
 	AllowedOrigins              []string `split_words:"true" default:"^(http://|https://|)litmuschaos.io(:[0-9]+|)?,^(http://|https://|)localhost(:[0-9]+|)"`
+	GqlQueryComplexityLimit     int      `split_words:"true" default:"200"`
 	MetricsPort                 string   `envconfig:"METRICS_PORT" default:"8889"`
 }
 
```

---

### Incident Patch 10: `0f03353d` (2026-09-16)
**Commit Message**: fix(auth): reject unverified email claims in the OIDC callback (#5601)

Signed-off-by: Nayyar <nayyar@bugqore.com>

**File**: `chaoscenter/authentication/api/handlers/rest/dex_auth_handler.go` (modified, +7/-0)
```diff
@@ -120,6 +120,13 @@ func OAuthCallback(userService services.ApplicationService) gin.HandlerFunc {
 			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
 			return
 		}
+		// The email is what the account is keyed on below, so it is only usable
+		// once the provider states that it belongs to the subject.
+		if claims.Email == "" || !claims.Verified {
+			log.Errorf("OAuth Error: subject %s has no verified email claim", idToken.Subject)
+			c.JSON(utils.ErrorStatusCodes[utils.ErrUnauthorized], presenter.CreateErrorResponse(utils.ErrUnauthorized))
+			return
+		}
 		createdAt := time.Now().UnixMilli()
 
 		var userData = entities.User{
```

**File**: `chaoscenter/authentication/api/handlers/rest/dex_auth_handler_test.go` (modified, +197/-0)
```diff
@@ -1,11 +1,25 @@
 package rest_test
 
 import (
+	"crypto/rand"
+	"crypto/rsa"
+	"encoding/base64"
+	"encoding/json"
+	"math/big"
+	"net/http"
 	"net/http/httptest"
 	"testing"
+	"time"
 
+	"github.com/gin-gonic/gin"
+	"github.com/golang-jwt/jwt/v4"
 	"github.com/litmuschaos/litmus/chaoscenter/authentication/api/handlers/rest"
+	"github.com/litmuschaos/litmus/chaoscenter/authentication/api/mocks"
+	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/authConfig"
+	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/entities"
+	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/utils"
 	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/mock"
 )
 
 func TestOAuthLogin(t *testing.T) {
@@ -16,3 +30,186 @@ func TestOAuthLogin(t *testing.T) {
 
 	assert.Equal(t, 500, w.Code)
 }
+
+// newTestOIDCProvider starts a minimal OIDC provider that hands out an id_token
+// carrying the given claims, so the callback can be driven end to end.
+func newTestOIDCProvider(t *testing.T, clientID string, claims map[string]interface{}) *httptest.Server {
+	t.Helper()
+
+	key, err := rsa.GenerateKey(rand.Reader, 2048)
+	if err != nil {
+		t.Fatalf("unable to generate signing key: %v", err)
+	}
+
+	mux := http.NewServeMux()
+	server := httptest.NewServer(mux)
+	t.Cleanup(server.Close)
+
+	mux.HandleFunc("/.well-known/openid-configuration", func(w http.ResponseWriter, r *http.Request) {
+		writeTestJSON(t, w, map[string]interface{}{
+			"issuer":                                server.URL,
+			"authorization_endpoint":                server.URL + "/auth",
+			"token_endpoint":                        server.URL + "/token",
+			"jwks_uri":                              server.URL + "/keys",
+			"id_token_signing_alg_values_supported": []string{"RS256"},
+		})
+	})
+
+	mux.HandleFunc("/keys", func(w http.ResponseWriter, r *http.Request) {
+		writeTestJSON(t, w, map[string]interface{}{
+			"keys": []map[string]string{{
+				"kty": "RSA",
+				"alg": "RS256",
+				"use": "sig",
+				"kid": "test",
+				"n":   base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
+				"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
+			}},
+		})
+	})
+
+	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
+		idClaims := jwt.MapClaims{
+			"iss": server.URL,
+			"aud": clientID,
+			"sub": "attacker-subject",
+			"iat": time.Now().Unix(),
+			"exp": time.Now().Add(time.Hour).Unix(),
+		}
+		for k, v := range claims {
+			idClaims[k] = v
+		}
+
+		idToken := jwt.NewWithClaims(jwt.SigningMethodRS256, idClaims)
+		idToken.Header["kid"] = "test"
+		signed, err := idToken.SignedString(key)
+		if err != nil {
+			t.Errorf("unable to sign id_token: %v", err)
+			return
+		}
+
+		writeTestJSON(t, w, map[string]interface{}{
+			"access_token": "test-access-token",
+			"token_type":   "Bearer",
+			"expires_in":   3600,
+			"id_token":     signed,
+		})
+	})
+
+	return server
+}
+
+func writeTestJSON(t *testing.T, w http.ResponseWriter, payload map[string]interface{}) {
+	t.Helper()
+	w.Header().Set("Content-Type", "application/json")
+	if err := json.NewEncoder(w).Encode(payload); err != nil {
+		t.Errorf("unable to write response: %v", err)
+	}
+}
+
+func TestOAuthCallbackRejectsUnusableEmailClaims(t *testing.T) {
+	const clientID = "litmus-test-client"
+
+	tests := []struct {
+		name   string
+		claims map[string]interface{}
+	}{
+		{
+			name: "email not verified by the provider",
+			claims: map[string]interface{}{
+				"email":          "victim@litmus.test",
+				"email_verified": false,
+				"name":           "attacker",
+			},
+		},
+		{
+			name: "email_verified claim absent",
+			claims: map[string]interface{}{
+				"email": "victim@litmus.test",
+				"name":  "attacker",
+			},
+		},
+		{
+			name: "no email claim at all",
+			claims: map[string]interface{}{
+				"email_verified": true,
+				"name":           "attacker",
+			},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.
```

#### Recent Merged Pull Requests:
- **PR #5633** (2026-09-30): use crypto/rand for the infra access key (@naruto-lgtm)
- **PR #5632** (2026-09-30): chore: fix fuzzing test ci due to protobuf conflict (@Sonichigo)
- **PR #5631** (2026-09-30): fix(web): bump vulnerable transitive npm dependencies (@PriteshKiri)
- **PR #5627** (2026-09-30): chore: go version bump and cve fixed (@Sonichigo)
- **PR #5624** (2026-09-22): chore: fix the build pipeline (@Sonichigo)
- **PR #5622** (closed): Fix subscriber image scan failure by updating vulnerable Go deps (@Copilot)
- **PR #5619** (2026-09-30): docs: fix broken links across adopter and translation READMEs (@ajmani-x)
- **PR #5617** (2026-09-21): fix(subscriber): resolve adminModeNamespace for chaos engine probe check (@mimo-to)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
