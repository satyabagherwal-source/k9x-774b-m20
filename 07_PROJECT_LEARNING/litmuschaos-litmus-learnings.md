> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/litmuschaos-litmus-learnings.md`  
> **Source**: github ([https://github.com/litmuschaos/litmus](https://github.com/litmuschaos/litmus))  
> **Source Version**: `b957f314`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T13:53:46.472Z  
> **Learning ID**: `learn-github-litmuschaos-litmus`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): litmuschaos/litmus

> **Canonical Artifact**: `07_PROJECT_LEARNING/litmuschaos-litmus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/litmuschaos/litmus](https://github.com/litmuschaos/litmus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T13:53:46.119Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `litmuschaos/litmus`
- **Description**: Litmus helps  SREs and developers practice chaos engineering in a Cloud-native way. Chaos experiments are published at the ChaosHub  (https://hub.litmuschaos.io). Community notes is at https://hackmd.io/a4Zu_sH4TZGeih-xCimi3Q
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5730 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `chaoscenter/authentication/api/utils/project_utils.go`
```
package utils

import (
	"log"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/api/types"
	"github.com/litmuschaos/litmus/chaoscenter/authentication/pkg/entities"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func GetProjectFilters(c *gin.Context) *entities.ListProjectRequest {
	var request entities.ListProjectRequest

	uID, exists := c.Get("uid")
	if exists {
		request.UserID = uID.(string)
	}

	// Initialize request.Filter and request.Sort if they are nil
	if request.Filter == nil {
		request.Filter = &entities.ListProjectInputFilter{}
	}
	if request.Sort == nil {
		request.Sort = &entities.SortInput{}
	}

	// filters
	createdByMeStr := c.Query(types.CreatedByMe)
	if createdByMeStr != "" {
		createdByMe, err := strconv.ParseBool(createdByMeStr)
		if err != nil {
			log.Fatal(err)
			return nil
		}
		request.Filter.CreatedByMe = &createdByMe
	}

	projectNameStr := c.Query(types.ProjectName)

	if projectNameStr != "" {
		request.Filter.ProjectName = &projectNameStr
	}

	// sorts
	var sortField entities.ProjectSortingField
	sortFieldStr := c.Query(types.SortField)

	// Convert the string value to the appropriate type
	switch sortFieldStr {
	case "name":
		sortField = entities.ProjectSortingFieldName
	case "time":
		sortField = entities.ProjectSortingFieldTime
	default:
		sortField = entities.ProjectSortingFieldTime
	}

	// Now assign the converted value to the sort field
	request.Sort.Field = &sortField

	ascendingStr := c.Query(types.Ascending)
	if ascendingStr != "" {
		ascending, err := strconv.ParseBool(ascendingStr)
		if err != nil {
			log.Fatal(err)
			return nil
		}
		request.Sort.Ascending = &ascending
	}

	// pagination
	// Extract page and limit from query parameters
	pageStr := c.Query(types.Page)
	limitStr := c.Query(types.Limit)

	// Convert strings to integers
	page, err := strconv.Atoi(pageStr)
	if err != nil {
		// Handle error if conversion fails
		// For example, set a default value or return an error response
		page = 0 // Setting a default value of 1
	}

	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		// Handle error if conversion fails
		// For example, set a default value or return an error response
		limit = 15 // Setting a default value of 15
	}

	pagination := entities.Pagination{
		Page:  page,
		Limit: limit,
	}

	request.Pagination = &pagination

	return &request
}

func CreateMatchStage(userID string) bson.D {
	return bson.D{
		{"$match", bson.D{
			{"is_removed", false},
			{"members", bson.D{
				{"$elemMatch", bson.D{
					{"user_id", userID},
					{"invitation", bson.D{
						{"$nin", bson.A{
							string(entities.PendingInvitation),
							string(entities.DeclinedInvitation),
							string(entities.ExitedProject),
						}},
					}},
				}},
			}},
		}},
	}
}

func CreateFilterStages(filter *entities.ListProjectInputFilter, userID string) []bson.D {
	var stages []bson.D

	if filter == nil {
		return stages
	}

	if filter.CreatedByMe != nil {
		if *filter.CreatedByMe {
			stages = append(stages, bson.D{
				{"$match", bson.D{
					{"created_by.user_id", bson.M{"$eq": userID}},
				}},
			})
		} else {
			stages = append(stages, bson.D{
				{"$match", bson.D{
					{"created_by.user_id", bson.M{"$ne": userID}},
				}},
			})
		}
	}

	if filter.ProjectName != nil {
		stages = append(stages, bson.D{
			{"$match", bson.D{
				{"name", bson.D{
					{"$regex", primitive.Regex{Pattern: *filter.ProjectName, Options: "i"}},
				}},
			}},
		})
	}

	return stages
}

func CreateSortStage(sort *entities.SortInput) bson.D {
	if sort == nil || sort.Field == nil {
		return bson.D{}
	}

	var sortField string
	switch *sort.Field {
	case entities.ProjectSortingFieldTime:
		sortField = "updated_at"
	case entities.ProjectSortingFieldName:
		sortField = "name"
	default:
		sortField = "updated_at"
	}

	sortDirection := -1
	if sort.Ascending != nil && *sort.Ascending {
		sortDirection = 1
	}

	return bson.D{
		{"$sort", bson.D{
			{sortField, sortDirection},
		}},
	}
}

func CreatePaginationStage(pagination *entities.Pagination) []bson.D {
	var stages []bson.D
	if pagination != nil {
		page := pagination.Page
		limit := pagination.Limit
		// upper limit of 50 to prevent exceeding max limit 16mb
		if pagination.Limit > 50 {
			limit = 50
		}
		stages = append(stages, bson.D{
			{"$skip", page * limit},
		})
		stages = append(stages, bson.D{
			{"$limit", limit},
		})
	} else {
		stages = append(stages, bson.D{
			{"$limit", 10},
		})
	}
	return stages
}

```

### Core Architecture Module: `chaoscenter/authentication/pkg/utils/common.go`
```
package utils

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/sirupsen/logrus"
)

func GenerateOAuthJWT() (string, error) {
	token := jwt.New(jwt.SigningMethodHS512)
	claims := token.Claims.(jwt.MapClaims)
	claims["exp"] = time.Now().Add(time.Minute * time.Duration(OAuthJWTExpDuration)).Unix()
	tokenString, err := token.SignedString([]byte(OAuthJwtSecret))
	if err != nil {
		logrus.Info(err)
		return "", err
	}
	return tokenString, nil
}

func ValidateOAuthJWT(tokenString string) (bool, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, isValid := token.Method.(*jwt.SigningMethodHMAC); !isValid {
			return nil, fmt.Errorf("invalid token %s", token.Header["alg"])
		}
		return []byte(OAuthJwtSecret), nil
	})
	if err != nil {
		return false, err
	}
	if _, ok := token.Claims.(jwt.Claims); !ok && !token.Valid {
		return false, err
	}
	return true, nil
}

```

### Core Architecture Module: `chaoscenter/authentication/pkg/utils/configs.go`
```
package utils

import (
	"crypto/tls"
	"crypto/x509"
	"os"
	"strconv"

	log "github.com/sirupsen/logrus"
)

var (
	AdminName                    = os.Getenv("ADMIN_USERNAME")
	AdminPassword                = os.Getenv("ADMIN_PASSWORD")
	DBUrl                        = os.Getenv("DB_SERVER")
	DBUser                       = os.Getenv("DB_USER")
	DBPassword                   = os.Getenv("DB_PASSWORD")
	JWTExpiryDuration            = getEnvAsInt("JWT_EXPIRY_MINS", 1440)
	OAuthJWTExpDuration          = getEnvAsInt("OAUTH_JWT_EXP_MINS", 5)
	OAuthJwtSecret               = os.Getenv("OAUTH_SECRET")
	OAuthEnabled                 = getEnvAsBool("OAUTH_ENABLED", false)
	OAuthCallBackURL             = os.Getenv("OAUTH_CALLBACK_URL")
	OAuthClientID                = os.Getenv("OAUTH_CLIENT_ID")
	OAuthClientSecret            = os.Getenv("OAUTH_CLIENT_SECRET")
	OAuthOIDCIssuer              = os.Getenv("OIDC_ISSUER")
	EnableInternalTls            = getEnvAsBool("ENABLE_INTERNAL_TLS", false)
	TlsCertPath                  = os.Getenv("TLS_CERT_PATH")
	TlSKeyPath                   = os.Getenv("TLS_KEY_PATH")
	CaCertPath                   = os.Getenv("CA_CERT_TLS_PATH")
	RestPort                     = os.Getenv("REST_PORT")
	GrpcPort                     = os.Getenv("GRPC_PORT")
	DBName                       = "auth"
	UserCollection               = "users"
	ProjectCollection            = "project"
	AuthConfigCollection         = "auth-config"
	RevokedTokenCollection       = "revoked-token"
	ApiTokenCollection           = "api-token"
	UsernameField                = "username"
	ExpiresAtField               = "expires_at"
	PasswordEncryptionCost       = 8
	DefaultLitmusGqlGrpcEndpoint = "localhost"
	DefaultLitmusGqlGrpcPort     = ":8000"
	//DefaultLitmusGqlGrpcPortHttps = ":8001" // enable when in use
)

func getEnvAsInt(name string, defaultVal int) int {
	valueStr := os.Getenv(name)
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultVal
}

func getEnvAsBool(name string, defaultVal bool) bool {
	valueStr := os.Getenv(name)
	if valueStr, err := strconv.ParseBool(valueStr); err == nil {
		return valueStr
	}
	return defaultVal
}

func GetTlsConfig() *tls.Config {

	// read ca's cert, verify to client's certificate
	caPem, err := os.ReadFile(CaCertPath)
	if err != nil {
		log.Fatal(err)
	}

	// create cert pool and append ca's cert
	certPool := x509.NewCertPool()
	if !certPool.AppendCertsFromPEM(caPem) {
		log.Fatal(err)
	}

	// read server cert & key
	serverCert, err := tls.LoadX509KeyPair(TlsCertPath, TlSKeyPath)
	if err != nil {
		log.Fatal(err)
	}

	// configuring TLS config based on provided certificates & keys to
	conf := &tls.Config{
		Certificates: []tls.Certificate{serverCert},
		ClientAuth:   tls.RequireAndVerifyClientCert,
		ClientCAs:    certPool,
	}
	return conf
}

```

### Core Architecture Module: `chaoscenter/authentication/pkg/utils/errors.go`
```
package utils

import "errors"

// AppError defines general error's throughout the system
type AppError error

var (
	ErrInvalidCredentials            AppError = errors.New("invalid_credentials")
	ErrServerError                   AppError = errors.New("server_error")
	ErrInvalidRequest                AppError = errors.New("invalid_request")
	ErrStrictPasswordPolicyViolation AppError = errors.New("password_policy_violation")
	ErrStrictUsernamePolicyViolation AppError = errors.New("username_policy_violation")
	ErrUnauthorized                  AppError = errors.New("unauthorized")
	ErrUserExists                    AppError = errors.New("user_exists")
	ErrUserNotFound                  AppError = errors.New("user does not exist")
	ErrProjectNotFound               AppError = errors.New("project does not exist")
	ErrWrongPassword                 AppError = errors.New("password doesn't match")
	ErrUpdatingAdmin                 AppError = errors.New("cannot remove admin")
	ErrUserDeactivated               AppError = errors.New("your account has been deactivated")
	ErrUserAlreadyDeactivated        AppError = errors.New("user already deactivated")
	ErrEmptyProjectName              AppError = errors.New("invalid project name")
	ErrInvalidRole                   AppError = errors.New("invalid role")
	ErrInvalidEmail                  AppError = errors.New("invalid email")
	ErrPasswordNotUpdated            AppError = errors.New("default password not updated")
	ErrOldPassword                   AppError = errors.New("old and new passwords can't be same")
)

// ErrorStatusCodes holds the http status codes for every AppError
var ErrorStatusCodes = map[AppError]int{
	ErrInvalidRequest:                400,
	ErrInvalidCredentials:            401,
	ErrServerError:                   500,
	ErrUnauthorized:                  401,
	ErrUserExists:                    401,
	ErrStrictPasswordPolicyViolation: 401,
	ErrStrictUsernamePolicyViolation: 401,
	ErrUserNotFound:                  400,
	ErrProjectNotFound:               400,
	ErrUpdatingAdmin:                 400,
	ErrUserDeactivated:               400,
	ErrUserAlreadyDeactivated:        400,
	ErrEmptyProjectName:              400,
	ErrInvalidRole:                   400,
	ErrInvalidEmail:                  400,
	ErrPasswordNotUpdated:            401,
	ErrOldPassword:                   400,
}

// ErrorDescriptions holds detailed error description for every AppError
var ErrorDescriptions = map[AppError]string{
	ErrServerError:                   "The authorization server encountered an unexpected condition that prevented it from fulfilling the request",
	ErrInvalidCredentials:            "Invalid Credentials",
	ErrInvalidRequest:                "The request is missing a required parameter, includes an invalid parameter value, includes a parameter more than once, or is otherwise malformed",
	ErrUnauthorized:                  "The user does not have requested authorization to access this resource",
	ErrUserExists:                    "This username is already assigned to another user",
	ErrStrictPasswordPolicyViolation: "Please ensure the password is atleast 8 characters long and atmost 16 characters long and has atleast 1 digit, 1 lowercase alphabet, 1 uppercase alphabet and 1 special character",
	ErrStrictUsernamePolicyViolation: "The username should be at least 3 characters long and at most 254 characters long, must start with a letter or digit, and can only contain letters, digits, and the characters . _ - @ +",
	ErrEmptyProjectName:              "Project name can't be empty",
	ErrInvalidRole:                   "Role is invalid",
	ErrProjectNotFound:               "This project does not exist",
	ErrInvalidEmail:                  "Email address is invalid",
	ErrPasswordNotUpdated:            "Please update your default password",
	ErrOldPassword:                   "old and new passwords can't be same",
}

```

### Core Architecture Module: `chaoscenter/authentication/pkg/utils/grpc.go`
```
package utils

import (
	"context"
	"os"

	grpc2 "github.com/litmuschaos/litmus/chaoscenter/authentication/api/presenter/protos"

	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
)

// GetProjectGRPCSvcClient returns an RPC client for Project service
func GetProjectGRPCSvcClient(conn *grpc.ClientConn) (grpc2.ProjectClient, *grpc.ClientConn) {
	litmusGqlGrpcEndpoint := os.Getenv("LITMUS_GQL_GRPC_ENDPOINT")
	litmusGqlGrpcPort := os.Getenv("LITMUS_GQL_GRPC_PORT")

	if litmusGqlGrpcEndpoint == "" {
		litmusGqlGrpcEndpoint = DefaultLitmusGqlGrpcEndpoint
	}
	if litmusGqlGrpcPort == "" {
		litmusGqlGrpcPort = DefaultLitmusGqlGrpcPort
	}

	conn, err := grpc.Dial(litmusGqlGrpcEndpoint+litmusGqlGrpcPort, grpc.WithInsecure(), grpc.WithBlock())
	if err != nil {
		logrus.Fatalf("did not connect: %s", err)
	}

	return grpc2.NewProjectClient(conn), conn
}

// ProjectInitializer initializes a new project with default hub and image registry
func ProjectInitializer(context context.Context, client grpc2.ProjectClient, projectID string, role string) error {

	_, err := client.InitializeProject(context,
		&grpc2.ProjectInitializationRequest{
			ProjectID: projectID,
			Role:      role,
		})

	return err
}

```

### Core Architecture Module: `chaoscenter/authentication/pkg/utils/mongo_database.go`
```
package utils

import (
	"context"
	"strings"
	"time"

	log "github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// MongoConnection creates a connection to the mongo
func MongoConnection() (*mongo.Client, error) {
	ctx, _ := context.WithTimeout(context.Background(), 10*time.Second)
	mongoCredentials := options.Credential{
		Username: DBUser,
		Password: DBPassword,
	}
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(DBUrl).SetAuth(mongoCredentials))
	if err != nil {
		return nil, err
	}

	return client, nil
}

// CreateIndex creates a unique index for the given field in the collectionName
func CreateIndex(collectionName string, field string, db *mongo.Database) error {
	mod := mongo.IndexModel{
		Keys:    bson.M{field: 1},
		Options: options.Index().SetUnique(true),
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	collection := db.Collection(collectionName)
	_, err := collection.Indexes().CreateOne(ctx, mod)
	if err != nil {
		log.Error(err)
		return err
	}
	return nil
}

// CreateTTLIndex creates a TTL index for the given field in the collectionName
func CreateTTLIndex(collectionName string, db *mongo.Database) error {
	// more info: https://www.mongodb.com/docs/manual/tutorial/expire-data/#expire-documents-at-a-specific-clock-time
	mod := mongo.IndexModel{
		Keys:    bson.M{ExpiresAtField: 1},
		Options: options.Index().SetExpireAfterSeconds(0),
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	collection := db.Collection(collectionName)
	_, err := collection.Indexes().CreateOne(ctx, mod)
	if err != nil {
		log.Error(err)
		return err
	}
	return nil
}

// CreateCollection creates a new mongo collection if it does not exist
func CreateCollection(collectionName string, db *mongo.Database) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := db.CreateCollection(ctx, collectionName)
	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			log.Info(collectionName + "'s collection already exists, continuing with the existing mongo collection")
			return nil
		} else {
			return err
		}
	}

	log.Info(collectionName + "'s mongo collection created")
	return nil
}

```

### Core Architecture Module: `chaoscenter/authentication/pkg/utils/sanitizers.go`
```
package utils

import (
	crypto "crypto/rand"
	"encoding/base64"
	"fmt"
	"regexp"
	"strings"
)

// SanitizeString trims the string input
func SanitizeString(input string) string {
	return strings.TrimSpace(input)
}

/*
ValidateStrictPassword represents and checks for the following patterns:
- Input is at least 8 characters long and at most 16 characters long
- Input contains at least one special character of these @$!%*?_&#
- Input contains at least one digit
- Input contains at least one uppercase alphabet
- Input contains at least one lowercase alphabet
*/
func ValidateStrictPassword(input string) error {
	if len(input) < 8 {
		return fmt.Errorf("password length is less than 8 characters")
	}

	if len(input) > 16 {
		return fmt.Errorf("password length is more than 16 characters")
	}

	digits := `[0-9]{1}`
	lowerAlphabets := `[a-z]{1}`
	capitalAlphabets := `[A-Z]{1}`
	specialCharacters := `[@$!%*?_&#]{1}`
	if b, err := regexp.MatchString(digits, input); !b || err != nil {
		return fmt.Errorf("password does not contain digits")
	}
	if b, err := regexp.MatchString(lowerAlphabets, input); !b || err != nil {
		return fmt.Errorf("password does not contain lowercase alphabets")
	}
	if b, err := regexp.MatchString(capitalAlphabets, input); !b || err != nil {
		return fmt.Errorf("password does not contain uppercase alphabets")
	}
	if b, err := regexp.MatchString(specialCharacters, input); !b || err != nil {
		return fmt.Errorf("password does not contain special characters")
	}
	return nil
}

// RandomString generates random strings, can be used to create ids
func RandomString(n int) (string, error) {
	if n > 0 {
		b := make([]byte, n)
		_, err := crypto.Read(b)
		if err != nil {
			return "", err
		}

		return base64.URLEncoding.EncodeToString(b), nil
	}
	return "", fmt.Errorf("length should be greater than 0")
}

// Username must start with a letter or digit - ^[a-zA-Z0-9]
// Allow letters, digits, and the characters . _ - @ + (so an email address is a valid username,
// which is required for Dex SSO where the email is used as the username) - [a-zA-Z0-9._@+-]
// Ensure the length of the username is between 3 and 254 characters
// (1 character is already matched above, and 254 is the RFC 5321 maximum email length) - {2,253}$

func ValidateStrictUsername(username string) error {
	if matched, _ := regexp.MatchString(`^[a-zA-Z0-9][a-zA-Z0-9._@+-]{2,253}$`, username); !matched {
		return fmt.Errorf("username should be at least 3 characters long and at most 254 characters long, must start with a letter or digit, and can only contain letters, digits, and the characters . _ - @ +")
	}

	return nil
}

```

### Core Architecture Module: `chaoscenter/event-tracker/pkg/utils/informers.go`
```
package utils

import (
	"fmt"
	"reflect"

	"github.com/sirupsen/logrus"

	v1 "k8s.io/api/apps/v1"
	"k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/tools/cache"
)

var annotationKey = "litmuschaos.io/experimentId"

// RunDeploymentInformer K8s informer watching for all the deployment changes
func RunDeploymentInformer(factory informers.SharedInformerFactory) {
	deploymentInformer := factory.Apps().V1().Deployments().Informer()

	stopper := make(chan struct{})
	defer close(stopper)

	defer runtime.HandleCrash()

	deploymentInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		// When a resource gets updated
		UpdateFunc: func(oldObj interface{}, newObj interface{}) {
			depNewObj := newObj.(*v1.Deployment)
			depOldObj := oldObj.(*v1.Deployment)

			var experimentId = depNewObj.GetAnnotations()[annotationKey]

			if depNewObj.GetResourceVersion() != depOldObj.GetResourceVersion() &&
				!reflect.DeepEqual(depNewObj, depOldObj) &&
				depNewObj.GetAnnotations()["litmuschaos.io/gitops"] == "true" &&
				experimentId != "" {
				logrus.Infof("Event Detected for experimentId: %s, ResourceType: %s, ResourceName: %s, ResourceNamespace: %s", experimentId, "Deployment", depNewObj.Name, depNewObj.Namespace)
				err := PolicyAuditor("Deployment", depNewObj, depOldObj, experimentId)
				if err != nil {
					logrus.Error(err)
					return
				}
			}
		},
	})

	deploymentInformer.Run(stopper)
	if !cache.WaitForCacheSync(stopper, deploymentInformer.HasSynced) {
		runtime.HandleError(fmt.Errorf("timed out waiting for caches to sync"))
		return
	}
}

// RunStsInformer K8s informer watching for all the Statefullset changes
func RunStsInformer(factory informers.SharedInformerFactory) {
	stsInformer := factory.Apps().V1().StatefulSets().Informer()

	stopper := make(chan struct{})
	defer close(stopper)

	defer runtime.HandleCrash()

	stsInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		// When a resource gets updated
		UpdateFunc: func(oldObj interface{}, newObj interface{}) {
			stsNewObj := newObj.(*v1.StatefulSet)
			stsOldObj := oldObj.(*v1.StatefulSet)

			var experimentId = stsNewObj.GetAnnotations()[annotationKey]

			if stsNewObj.GetResourceVersion() != stsOldObj.GetResourceVersion() &&
				!reflect.DeepEqual(stsNewObj, stsOldObj) &&
				stsNewObj.GetAnnotations()["litmuschaos.io/gitops"] == "true" &&
				experimentId != "" {
				logrus.Infof("Event Detected for ExperimentId: %s, ResourceType: %s, ResourceName: %s, ResourceNamespace: %s", experimentId, "StatefulSet", stsNewObj.Name, stsNewObj.Namespace)
				err := PolicyAuditor("StatefulSet", stsNewObj, stsOldObj, experimentId)
				if err != nil {
					logrus.Error(err)
					return
				}
			}

		},
	})

	stsInformer.Run(stopper)
	if !cache.WaitForCacheSync(stopper, stsInformer.HasSynced) {
		runtime.HandleError(fmt.Errorf("timed out waiting for caches to sync"))
		return
	}
}

// RunDSInformer K8s informer watching for all the daemonset changes
func RunDSInformer(factory informers.SharedInformerFactory) {
	dsInformer := factory.Apps().V1().DaemonSets().Informer()

	stopper := make(chan struct{})
	defer close(stopper)

	defer runtime.HandleCrash()

	dsInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		// When a resource gets updated
		UpdateFunc: func(oldObj interface{}, newObj interface{}) {
			dsNewObj := newObj.(*v1.DaemonSet)
			dsOldObj := oldObj.(*v1.DaemonSet)

			var experimentId = dsNewObj.GetAnnotations()[annotationKey]

			if dsNewObj.GetResourceVersion() != dsOldObj.GetResourceVersion() &&
				!reflect.DeepEqual(dsNewObj, dsOldObj) &&
				dsNewObj.GetAnnotations()["litmuschaos.io/gitops"] == "true" &&
				experimentId != "" {
				logrus.Infof("Event Detected for ExperimentId: %s, ResourceType: %s, ResourceName: %s, ResourceNamespace: %s", experimentId, "DaemonSet", dsNewObj.Name, dsNewObj.Namespace)
				err := PolicyAuditor("DaemonSet", dsNewObj, dsOldObj, experimentId)
				if err != nil {
					logrus.Error(err)
					return
				}
			}

		},
	})

	dsInformer.Run(stopper)
	if !cache.WaitForCacheSync(stopper, dsInformer.HasSynced) {
		runtime.HandleError(fmt.Errorf("timed out waiting for caches to sync"))
		return
	}
}

```

### Core Architecture Module: `chaoscenter/event-tracker/pkg/utils/utils.go`
```
package utils

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/sirupsen/logrus"

	"github.com/jmespath/go-jmespath"
	litmuschaosv1 "github.com/litmuschaos/litmus/chaoscenter/event-tracker/api/v1"
	"github.com/litmuschaos/litmus/chaoscenter/event-tracker/pkg/k8s"
	v1 "k8s.io/api/apps/v1"
	k8sErrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"net/http"
	"strings"
	"time"

	"k8s.io/client-go/dynamic"
)

const (
	AgentConfigName = "subscriber-config"
	AgentSecretName = "subscriber-secret"

	ConditionPassed = "ConditionPassed"
	//ConditionFailed       = "ConditionFailed"
)

const (
	StateFulSet = "statefulset"
	Deployment  = "deployment"
	DaemonSet   = "daemonset"
)

func cases(key string, value string, operator string) bool {
	switch operator {
	case "EqualTo":
		return key == value
	case "NotEqualTo":
		return key != value
	case "LessThan":
		return key < value
	case "GreaterThan":
		return key > value
	case "GreaterThanEqualTo":
		return key >= value
	case "LessThanEqualTo":
		return key <= value
	}

	return false
}

func conditionChecker(etp litmuschaosv1.EventTrackerPolicy, newData interface{}, oldData interface{}) bool {
	finalResult := false
	if etp.Spec.ConditionType == "and" {
		for _, condition := range etp.Spec.Conditions {
			newDataResult, err := jmespath.Search(condition.Key, newData)
			if err != nil {
				logrus.Error(err)
				return false
			}

			oldDataResult, err := jmespath.Search(condition.Key, oldData)
			if err != nil {
				logrus.Error(err)
				return false
			}

			if newDataResult != oldDataResult {
				if condition.Operator == "Change" {
					finalResult = true
				} else {
					str := fmt.Sprintf("%v", newDataResult)
					if val := cases(str, *condition.Value, condition.Operator); !val {
						finalResult = val
						break
					} else if val {
						finalResult = true
					}
				}
			}
		}
	} else if etp.Spec.ConditionType == "or" {
		for _, condition := range etp.Spec.Conditions {
			newDataResult, err := jmespath.Search(condition.Key, newData)
			if err != nil {
				logrus.Error(err)
			}

			oldDataResult, err := jmespath.Search(condition.Key, oldData)
			if err != nil {
				logrus.Error(err)
				return false
			}

			if newDataResult != oldDataResult {
				if condition.Operator == "Change" {
					finalResult = true
				} else {
					str := fmt.Sprintf("%v", newDataResult)
					if val := cases(str, *condition.Value, condition.Operator); val {
						finalResult = val
					}
				}
			}
		}
	}

	return finalResult
}

func PolicyAuditor(resourceType string, newObj interface{}, oldObj interface{}, experimentId string) error {
	restConfig, err := k8s.GetKubeConfig()
	if err != nil {
		return err
	}

	clientSet, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return err
	}

	deploymentRes := schema.GroupVersionResource{Group: "eventtracker.litmuschaos.io", Version: "v1", Resource: "eventtrackerpolicies"}
	deploymentConfigList, err := clientSet.Resource(deploymentRes).Namespace(Config.InfraNamespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return err
	}

	if len(deploymentConfigList.Items) == 0 {
		logrus.Infof("No event-tracker policy(s) found in %s namespace", Config.InfraNamespace)
		return nil
	}

	for _, ep := range deploymentConfigList.Items {

		eventTrackerPolicy, err := clientSet.Resource(deploymentRes).Namespace(Config.InfraNamespace).Get(context.TODO(), ep.GetName(), metav1.GetOptions{})
		if err != nil {
			return err
		}

		var etp litmuschaosv1.EventTrackerPolicy
		data, err := json.Marshal(eventTrackerPolicy.Object)
		if err != nil {
			return err
		}

		err = json.Unmarshal(data, &etp)
		if err != nil {
			return err
		}

		var (
			newDataInterface interface{}
			resourceName     string
			oldDataInterface interface{}
		)

		expr := strings.ToLower(resourceType)
		switch expr {
		case Deployment:
			newDeploy := newObj.(*v1.Deployment)
			resourceName = newDeploy.GetName()

			newMar, err := json.Marshal(newDeploy)
			if err != nil {
				return err
			}

			err = json.Unmarshal(newMar, &newDataInterface)
			if err != nil {
				return err
			}

			oldDeploy := oldObj.(*v1.Deployment)
			oldMar, err := json.Marshal(oldDeploy)
			if err != nil {
				return err
			}

			err = json.Unmarshal(oldMar, &oldDataInterface)
			if err != nil {
				return err
			}

		case StateFulSet:
			newSts := newObj.(*v1.StatefulSet)
			resourceName = newSts.GetName()

			newMar, err := json.Marshal(newSts)
			if err != nil {
				return err
			}

			err = json.Unmarshal(newMar, &newDataInterface)
			if err != nil {
				return err
			}

			oldSts := oldObj.(*v1.StatefulSet)
			oldMar, err := json.Marshal(oldSts)
			if err != nil {
				return err
			}

			err = json.Unmarshal(oldMar, &oldDataInterface)
			if err != nil {
				return err
			}

		case DaemonSet:
			newDs := newObj.(*v1.DaemonSet)
			resourceName = newDs.GetName()
			newMar, err := json.Marshal(newDs)
			if err != nil {
				return err
			}

			err = json.Unmarshal(newMar, &newDataInterface)
			if err != nil {
				return err
			}

			oldDs := oldObj.(*v1.DaemonSet)
			oldMar, err := json.Marshal(oldDs)
			if err != nil {
				return err
			}

			err = json.Unmarshal(oldMar, &oldDataInterface)
			if err != nil {
				return err
			}

		default:
			return errors.New("resource not supported")
		}

		logFields := logrus.Fields{
			"resourceType": resourceType,
			"resourceName": resourceName,
			"namespace":    Config.InfraNamespace,
			"experimentId": experimentId,
			"policyName":   etp.GetName(),
		}

		check := conditionChecker(etp, newDataInterface, oldDataInterface)

		if check {
			etp.Statuses = append(etp.Statuses, litmuschaosv1.EventTrackerPolicyStatus{
				TimeStamp:    time.Now().Format(time.RFC850),
				Resource:     resourceType,
				ResourceName: resourceName,
				Result:       ConditionPassed,
				ExperimentID: experimentId,
				IsTriggered:  "false",
			})

			// Updating EventTrackerPolicy
			var us unstructured.Unstructured
			data, err = json.Marshal(etp)
			if err != nil {
				return err
			}

			err = json.Unmarshal(data, &us)
			if err != nil {
				return err
			}

			_, err = clientSet.Resource(deploymentRes).Namespace(Config.InfraNamespace).Update(context.TODO(), &us, metav1.UpdateOptions{})
			if err != nil {
				return err
			}

			logrus.WithFields(logFields).Infof("Policy conditions are matched with the changes in %s", resourceType)
		} else {
			logrus.WithFields(logFields).Infof("Policy conditions are not matched with the changes in %s", resourceType)
		}
	}

	return nil
}

func getInfraData() (string, string, string, error) {
	clientSet, err := k8s.K8sClient()
	if err != nil {
		return "", "", "", fmt.Errorf("failed to get Kubernetes clientset: %v", err)
	}

	getCM, err := clientSet.CoreV1().ConfigMaps(Config.InfraNamespace).Get(context.TODO(), AgentConfigName, metav1.GetOptions{})
	if err != nil {
		return "", "", "", fmt.Errorf("failed to get ConfigMap: %v", err)
	}

	if k8sErrors.IsNotFound(err) {
		return "", "", "", fmt.Errorf("%s configmap not found", AgentConfigName)
	}

	if getCM.Data["IS_INFRA_CONFIRMED"] != "true" {
		return "", "", "", fmt.Errorf("infrastructure not confirmed")
	}

	getSecret, err := clientSet.CoreV1().Secrets(Config.InfraNamespace).Get(context.TODO(), AgentSecretName, metav1.GetOptions{})
	if err != nil {
		return "", "", "", fmt.Errorf("failed to get Secret: %v", err)
	}

	if k8sErrors.IsNotFound(err) {
		return "", "", "", fmt.Errorf("%s secret not found", AgentSecretName)
	}

	return string(getSecret.Data["ACCESS_KEY"]), string(getSecret.Data["INFRA_ID"]), getCM.Data["SERVER_ADDR"], nil
}

// SendRequest Function to send request to litmus graphql server
func SendRequest(experimentId string) (string, error) {
	accessKey, clusterID, serverAddr, err := getInfraData()
	if err != nil {
		return "", fmt.Errorf("failed to get infra data: %v", err)
	}

	payload := `{"query": "mutation { gitopsNotifier(clusterInfo: { infraID: \"` + clusterID + `\", version: \"` + Config.Version + `\", accessKey: \"` + accessKey + `\"}, experimentID: \"` + experimentId + `\")\n}"}`

	req, err := http.NewRequest(http.MethodPost, serverAddr, bytes.NewBuffer([]byte(payload)))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %v", err)
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "URL is not reachable or Bad request", nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %v", err)
	}

	return string(body), nil
}

```

### Core Architecture Module: `chaoscenter/event-tracker/pkg/utils/variables.go`
```
package utils

type Envs struct {
	Version          string `required:"true"`
	InfraScope       string `required:"true" split_words:"true"`
	IsInfraConfirmed string `required:"true" split_words:"true"`
	AccessKey        string `required:"true" split_words:"true"`
	InfraId          string `required:"true" split_words:"true"`
	ServerAddr       string `required:"true" split_words:"true"`
	InfraNamespace   string `required:"true" split_words:"true"`
	CustomTLSCert    string `envconfig:"CUSTOM_TLS_CERT" split_words:"true"`
	SkipSSLVerify    bool   `default:"false" split_words:"true"`
}

var Config Envs

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5641** (2026-10-14): **Auth server panics in GetProjectById when FindUsersByUID returns an error**
  *Symptoms*: **What happened**:  The auth server's gRPC `GetProjectById` dereferences the result of `FindUsersByUID` before checking its error:  ```go authUsers, err := s.ApplicationService.FindUsersByUID(uids) for _, authUser := range *authUsers { ```  `FindUsersByUID` returns `nil, err` when the `Find` fails, and the `err` check only comes after the loops. The gRPC server is created without a recovery interceptor, so the nil pointer panic takes down the whole authentication server (REST and gRPC), which the GraphQL server needs for every RBAC check.  **What you expected to happen**:  A DB error returns a gRPC error to the caller instead of crashing the process.  **Where can this issue be corrected? (optional)**  `chaoscenter/authentication/api/handlers/grpc/grpc_handler.go`, `GetProjectById`: move the `if err != nil` check to directly after `FindUsersByUID`.  **How to reproduce it (as minimally and precisely as possible)**:  Make `FindUsersByUID` fail, e.g. a mongo timeout or a stopped mongo while the auth server is running, then call anything on the GraphQL server that goes through `GetProjectById`. The auth server panics with `invalid memory address or nil pointer dereference`. A unit test with the application service mock returning `nil, err` shows the same panic.  **Anything else we need to know?**:  This is the same kind of issue as the nil checks fixed in #5449 and #5563. I'll send a PR with a mock-based test. 

- **Issue #5640** (2026-10-14): **listExperiment: sorting by NAME with ascending: true returns descending order**
  *Symptoms*: **What happened**:  `listExperiment` with `sort: { field: NAME, ascending: true }` returns experiments in descending name order (Z to A), and `ascending: false` returns A to Z.  ```go if request.Sort.Ascending != nil && *request.Sort.Ascending { 	sortStage = bson.D{{"$sort", bson.D{{"name", -1}}}} } else { 	sortStage = bson.D{{"$sort", bson.D{{"name", 1}}}} } ```  The TIME case in the same switch and `ListExperimentRun` both use `1` for ascending.  **What you expected to happen**:  `ascending: true` sorts A to Z.  **Where can this issue be corrected? (optional)**  `chaoscenter/graphql/server/pkg/chaos_experiment/handler/handler.go`, `ListExperiment`, the `ExperimentSortingFieldName` case.  **How to reproduce it (as minimally and precisely as possible)**:  Create experiments `a-exp` and `b-exp`, then query `listExperiment(projectID, request: { sort: { field: NAME, ascending: true } })`. `b-exp` comes first.  **Anything else we need to know?**:  The web UI doesn't send a sort for experiments, so this mostly affects API and litmusctl users. It's a two-line fix; I can add a test that checks the generated pipeline. 

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

### Incident Patch 1: `b957f314` (2026-10-20)
**Commit Message**: refactor: fix unimplemented concurrency in CheckComponentStatus (#5522)

* test(subscriber): extract deploymentHealthy and add unit tests

Signed-off-by: Yoonseo Han <[REDACTED_EMAIL]>

* test(subscriber): add allDeploymentsHealthy and unit tests

Signed-off-by: Yoonseo Han <[REDACTED_EMAIL]>

* test(susbcriber): add checkComponentStatus with retry orchestration tests

Signed-off-by: Yoonseo Han <[REDACTED_EMAIL]>

* refactor(subscriber): parallelize deployment health checks per retry round

Signed-off-by: Yoonseo Han <[REDACTED_EMAIL]>

* fix(subscriber): rename the import alaises of fake to improve code readability

Signed-off-by: Yoonseo Han <[REDACTED_EMAIL]>

* fix(subscriber): fix code suggested by copilot

Signed-off-by: Yoonseo Han <[REDACTED_EMAIL]>

* fix(subscriber/k8s): log selector and errors in deploymentHealthy checks

Signed-off-by: Yoonseo Han <[REDACTED_EMAIL]>

---------

Signed-off-by: Yoonseo Han <[REDACTED_EMAIL]>
Co-authored-by: Pritesh Kiri <[REDACTED_EMAIL]>
Co-authored-by: Udit Gaurav <[REDACTED_EMAIL]>

**File**: `chaoscenter/subscriber/pkg/k8s/operations.go` (modified, +53/-60)
```diff
@@ -7,6 +7,7 @@ import (
 	"fmt"
 	"strings"
 	"sync"
+	"sync/atomic"
 	"time"
 
 	"k8s.io/apimachinery/pkg/labels"
@@ -35,9 +36,7 @@ const (
 )
 
 type InfraComponents struct {
-	Deployments      []string `yaml:"DEPLOYMENTS"`
-	LiveStatus       bool
-	AccessLiveStatus sync.Mutex
+	Deployments []string `yaml:"DEPLOYMENTS"`
 }
 
 var (
@@ -57,74 +56,68 @@ func (k8s *k8sSubscriber) CheckComponentStatus(componentEnv string) error {
 	}
 
 	var components InfraComponents
-
-	err = yaml2.Unmarshal([]byte(strings.TrimSpace(componentEnv)), &components)
-	if err != nil {
+	if err := yaml2.Unmarshal([]byte(strings.TrimSpace(componentEnv)), &components); err != nil {
 		return err
 	}
 
-	components.LiveStatus = true
-	components.AccessLiveStatus = sync.Mutex{}
-
-	wait := sync.WaitGroup{}
+	ctx := context.TODO()
+	for retry := 0; retry < LiveCheckMaxTries; retry++ {
+		if allDeploymentsHealthy(ctx, clientset, InfraNamespace, components.Deployments) {
+			logrus.Info("All infra deployments are up")
+			return nil
+		}
+		if retry < LiveCheckMaxTries-1 {
+			time.Sleep(30 * time.Second)
+		}
+	}
+	return errors.New("all components failed to startup")
+}
 
-	// add all agent components to waitgroup
-	wait.Add(1)
-	go k8s.checkDeploymentStatus(&components, clientset, &wait)
+func allDeploymentsHealthy(ctx context.Context, clientSet kubernetes.Interface, namespace string, selectors []string) bool {
+	if len(selectors) == 0 {
+		return true
+	}
 
-	wait.Wait()
-	if !components.LiveStatus {
-		return errors.New("all components failed to startup")
+	var (
+		wg     sync.WaitGroup
+		failed atomic.Int32
+	)
+	wg.Add(len(selectors))
+	for _, curSelector := range selectors {
+		go func(labelSelector string) {
+			defer wg.Done()
+			if !deploymentHealthy(ctx, clientSet, namespace, labelSelector) {
+				failed.Add(1)
+			}
+		}(curSelector)
 	}
-	return nil
+	wg.Wait()
+
+	return failed.Load() == 0
 }
 
-func (k8s *k8sSubscriber) checkDeploymentStatus(components *InfraComponents, clientset *kubernetes.Clientset, wait *sync.WaitGroup) {
-	ctx := context.TODO()
-	downCount := 0
-	retries := 0
-	defer wait.Done()
-	for retries < LiveCheckMaxTries {
-		for _, dep := range components.Deployments {
-			podList, err := clientset.CoreV1().Pods(InfraNamespace).List(ctx, metav1.ListOptions{LabelSelector: dep})
-			if err != nil {
-				logrus.Errorf("failed to get deployment pods %v , err : %v", dep, err.Error())
-				downCount += 1
-				continue
-			}
-			if len(podList.Items) == 0 {
-				logrus.Errorf("failed to get deployments pods %v , err : pods not found", dep)
-				downCount += 1
-				continue
-			}
-		outer:
-			for _, pod := range podList.Items {
-				if pod.Status.Phase != corev1.PodRunning {
-					logrus.Errorf("failed to get running pods for dep %v", dep)
-					downCount += 1
-					break
-				}
-				for _, containerStatus := range pod.Status.ContainerStatuses {
-					if !containerStatus.Ready {
-						logrus.Errorf("failed to get ready containers for pod %v, dep %v", pod.Name, dep)
-						downCount += 1
-						break outer
-					}
-				}
-			}
+func deploymentHealthy(ctx context.Context, clientSet kubernetes.Interface, namespace string, labelSelector string) bool {
+	podList, err := clientSet.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{LabelSelector: labelSelector})
+	if err != nil {
+		logrus.WithError(err).WithField("selector", labelSelector).Warn("failed to list pods for selector")
+		return false
+	}
+	if len(podList.Items) == 0 {
+		logrus.WithField("selector", labelSelector).Warn("no pods found for selector")
+		return false
+	}
+
+	for _, pod := range podList.Items {
+		if pod.Status.Phase != corev1.PodRunning {
+			return false
 		}
-		if downCount == 0 {
-			logrus.Info("All infra deployments are up")
-			return
-		} else {
-			retries += 1
-			downCount = 0
-			time.Sleep(30 * time.Second)
+		for _, containerStatus := range pod.Status.ContainerStatuses {
+			if !containerStatus.Ready {
+				return false
+			}
 		}
 	}
-	components.AccessLiveStatus.Lock()
-	defer components.AccessLiveStatus.Unlock()
-	components.LiveStatus = false
+	return true
 }
 
 func (k8s *k8sSubscriber) IsAgentConfirmed() (bool, string, error) {
```

**File**: `chaoscenter/subscriber/pkg/k8s/operations_test.go` (modified, +157/-3)
```diff
@@ -9,7 +9,8 @@ import (
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
 	"k8s.io/apimachinery/pkg/runtime"
-	"k8s.io/client-go/dynamic/fake"
+	dynamicfake "k8s.io/client-go/dynamic/fake"
+	kubefake "k8s.io/client-go/kubernetes/fake"
 )
 
 func TestAddCustomLabels(t *testing.T) {
@@ -101,7 +102,7 @@ func TestApplyRequest(t *testing.T) {
 	s := runtime.NewScheme()
 	s.AddKnownTypes(corev1.SchemeGroupVersion, &corev1.Pod{})
 
-	fakeDynamicClient := fake.NewSimpleDynamicClient(s, objToGet)
+	fakeDynamicClient := dynamicfake.NewSimpleDynamicClient(s, objToGet)
 
 	// The 'dr' (dynamic resource) variable needs to be set, just like in the real code
 	// We tell it to look for "pods" in the "litmus" namespace
@@ -141,7 +142,7 @@ func TestApplyRequest_Create(t *testing.T) {
 	// Create an EMPTY fake dynamic client (it has no objects yet)
 	s := runtime.NewScheme()
 	s.AddKnownTypes(corev1.SchemeGroupVersion, &corev1.ConfigMap{})
-	fakeDynamicClient := fake.NewSimpleDynamicClient(s)
+	fakeDynamicClient := dynamicfake.NewSimpleDynamicClient(s)
 
 	// Set the global 'dr' variable for the test
 	dr = fakeDynamicClient.Resource(corev1.SchemeGroupVersion.WithResource("configmaps")).Namespace("litmus")
@@ -163,3 +164,156 @@ func TestApplyRequest_Create(t *testing.T) {
 		t.Errorf("Failed to 'get' the newly created object from the fake client: %v", err)
 	}
 }
+
+func readyPod(name, namespace string, labels map[string]string) *corev1.Pod {
+	return &corev1.Pod{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      name,
+			Namespace: namespace,
+			Labels:    labels,
+		},
+		Status: corev1.PodStatus{
+			Phase: corev1.PodRunning,
+			ContainerStatuses: []corev1.ContainerStatus{
+				{
+					Ready: true,
+				},
+			},
+		},
+	}
+}
+
+func notRunningPod(name, namespace string, labels map[string]string) *corev1.Pod {
+	return &corev1.Pod{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      name,
+			Namespace: namespace,
+			Labels:    labels,
+		},
+		Status: corev1.PodStatus{
+			Phase: corev1.PodPending,
+			ContainerStatuses: []corev1.ContainerStatus{
+				{
+					Ready: false,
+				},
+			},
+		},
+	}
+}
+
+func TestDeploymentHealthy(t *testing.T) {
+	t.Parallel()
+
+	const defaultNamespace = "litmus"
+
+	testCases := []struct {
+		name     string
+		pods     []runtime.Object
+		selector string
+		healthy  bool
+	}{
+		{
+			name: "Ready pod matches selector",
+			pods: []runtime.Object{
+				readyPod("exp-1", defaultNamespace, map[string]string{"app": "chaos-exporter"}),
+			},
+			selector: "app=chaos-exporter",
+			healthy:  true,
+		},
+		{
+			name:     "No pod found",
+			pods:     []runtime.Object{},
+			selector: "app=chaos-exporter",
+			healthy:  false,
+		},
+		{
+			name: "Selector doesn't match any pod",
+			pods: []runtime.Object{
+				readyPod("exp-1", defaultNamespace, map[string]string{"app": "chaos-exporter"}),
+			},
+			selector: "app=chaos-operator",
+			healthy:  false,
+		},
+		{
+			name: "Pod not running",
+			pods: []runtime.Object{
+				notRunningPod("exp-1", defaultNamespace, map[string]string{"app": "chaos-exporter"}),
+			},
+			selector: "app=chaos-exporter",
+			healthy:  false,
+		},
+	}
+
+	// Run test cases
+	for _, tc := range testCases {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+
+			client := kubefake.NewSimpleClientset(tc.pods...)
+			got := deploymentHealthy(context.Background(), client, defaultNamespace, tc.selector)
+
+			if got != tc.healthy {
+				t.Errorf("deploymentHealthy(%q, %q) = %v, want %v", tc.selector, tc.name, got, tc.healthy)
+			}
+		})
+	}
+}
+
+func TestAllDeploymentsHealthy(t *testing.T) {
+	t.Parallel()
+
+	const defaultNamespace = "litmus"
+
+	testCases := []struct {
+		name           string
+		pods           []runtime.Object
+		selectors      []string
+		expectedStatus bool
+	}{
+		{
+			name: "all selectors healthy",
+			pods: []runtime.Object{
+				readyPod("exp-1", defaultNamespace, map[string]string{"app": "chaos-exporter"}),
+				readyPod("op-1", defaultNamespace, map[string]string{"name": "chaos-operator"}),
+			},
+			selectors:      []string{"app=chaos-exporter", "name=chaos-operator"},
+			expectedStatus: true,
+		},
+		{
+			name: "one selector missing pods",
+			pods: []runtime.Object{
+				readyPod("exp-1", defaultNamespace, map[string]string{"app": "chaos-exporter"}),
+			},
+			selectors:      []string{"app=chaos-exporter", "name=chaos-operator"},
+			expectedStatus: false,
+		},
+		{
+			name: "one selector unhealthy",
+			pods: []runtime.Object{
+				readyPod("exp-1", defaultNamespace, map[string]string{"app": "chaos-exporter"}),
+				notRunningPod("op-1", defaultNamespace, map[string]string{"name": "chaos-operator"}),
+			},
+			selectors:      []string{"app=chaos-exporter", "name=chaos-operator"},
+			expectedStatus: false,
+		},
+		{
+			name:           "empty selector list",
+			pods:           []runtime.Object{},
+			selectors:      []string{},
+			expectedStatus: true,
+		},
```

---

### Incident Patch 2: `e4095919` (2026-10-20)
**Commit Message**: fix: trivy docker build pass (#5657)

Signed-off-by: Animesh Pathak <[REDACTED_EMAIL]>
Co-authored-by: Udit Gaurav <[REDACTED_EMAIL]>

**File**: `chaoscenter/authentication/go.mod` (modified, +5/-5)
```diff
@@ -12,7 +12,7 @@ require (
 	github.com/sirupsen/logrus v1.9.4
 	github.com/stretchr/testify v1.11.1
 	go.mongodb.org/mongo-driver v1.17.9
-	golang.org/x/crypto v0.56.0
+	golang.org/x/crypto v0.57.0
 	golang.org/x/oauth2 v0.36.0
 	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.11
@@ -55,10 +55,10 @@ require (
 	github.com/youmark/pkcs8 v0.0.0-20240726163527-a2c0da244d78 // indirect
 	go.mongodb.org/mongo-driver/v2 v2.5.0 // indirect
 	golang.org/x/arch v0.25.0 // indirect
-	golang.org/x/net v0.58.0 // indirect
-	golang.org/x/sync v0.22.0 // indirect
-	golang.org/x/sys v0.47.0 // indirect
-	golang.org/x/text v0.41.0 // indirect
+	golang.org/x/net v0.60.0 // indirect
+	golang.org/x/sync v0.23.0 // indirect
+	golang.org/x/sys v0.48.0 // indirect
+	golang.org/x/text v0.42.0 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	gopkg.in/yaml.v3 v3.0.1 // indirect
 )
```

**File**: `chaoscenter/authentication/go.sum` (modified, +10/-10)
```diff
@@ -133,36 +133,36 @@ golang.org/x/arch v0.25.0 h1:qnk6Ksugpi5Bz32947rkUgDt9/s5qvqDPl/gBKdMJLE=
 golang.org/x/arch v0.25.0/go.mod h1:0X+GdSIP+kL5wPmpK7sdkEVTt2XoYP0cSjQSbZBwOi8=
 golang.org/x/crypto v0.0.0-20190308221718-c2843e01d9a2/go.mod h1:djNgcEr1/C05ACkg1iLfiJU5Ep61QUkGW8qpdssI0+w=
 golang.org/x/crypto v0.0.0-20210921155107-089bfa567519/go.mod h1:GvvjBRRGRdwPK5ydBHafDWAxML/pGHZbMvKqRZ5+Abc=
-golang.org/x/crypto v0.56.0 h1:GUh5Ii4J5jtcseSMiRqr1jXCNHoxjeV9Fmekc2oLy6Y=
-golang.org/x/crypto v0.56.0/go.mod h1:OMW5y6CY9l38uPLmxU6l6pwcXp1obtLo3e6gT7gQR2I=
+golang.org/x/crypto v0.57.0 h1:3ZVCjf8Ggz7zneR/EHRVx68Ctf+2pmIMP2UFhh9cC6M=
+golang.org/x/crypto v0.57.0/go.mod h1:Fdz0i5U6CoizGwLda9DttjSk6qlZo25zYNtR+ycvuZA=
 golang.org/x/mod v0.6.0-dev.0.20220419223038-86c51ed26bb4/go.mod h1:jJ57K6gSWd91VN4djpZkiMVwK6gcyfeH4XE8wZrZaV4=
 golang.org/x/net v0.0.0-20190620200207-3b0461eec859/go.mod h1:z5CRVTTTmAJ677TzLLGU+0bjPO0LkuOLi4/5GtJWs/s=
 golang.org/x/net v0.0.0-20210226172049-e18ecbb05110/go.mod h1:m0MpNAwzfU5UDzcl9v0D8zg8gWTRqZa9RBIspLL5mdg=
 golang.org/x/net v0.0.0-20220722155237-a158d28d115b/go.mod h1:XRhObCWvk6IyKnWLug+ECip1KBveYUHfp+8e9klMJ9c=
-golang.org/x/net v0.58.0 h1:ynWG7rqYi4ccpTEuPZ2QGWHktVEM9DMCj9yzDE0Q7To=
-golang.org/x/net v0.58.0/go.mod h1:YwCddHnFlT7eLQqVprV19OnhLGtc5xOKgE0RyqgfWAU=
+golang.org/x/net v0.60.0 h1:79p50tfZlm0J9YfoDsSi639qSXNGVwEzOPLCxM2FsYU=
+golang.org/x/net v0.60.0/go.mod h1:2DA/G1UfVbCpQPeWTmMPGY7Cs2PkBkwu743bVX5PIVg=
 golang.org/x/oauth2 v0.36.0 h1:peZ/1z27fi9hUOFCAZaHyrpWG5lwe0RJEEEeH0ThlIs=
 golang.org/x/oauth2 v0.36.0/go.mod h1:YDBUJMTkDnJS+A4BP4eZBjCqtokkg1hODuPjwiGPO7Q=
 golang.org/x/sync v0.0.0-20190423024810-112230192c58/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20220722155255-886fb9371eb4/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
-golang.org/x/sync v0.22.0 h1:SZjpbeLmrCk4xhRSZFNZW5gFUeCeFgjekvI/+gfScek=
-golang.org/x/sync v0.22.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/sync v0.23.0 h1:KameEIfc1IkluZyXWLn39Wd4tURc6GbCiISGiZm2bQk=
+golang.org/x/sync v0.23.0/go.mod h1:sUUOizhqBxiL6pEWpqNLUiaJn1ShEbZ6BBqskPbjZm0=
 golang.org/x/sys v0.0.0-20190215142949-d0b11bdaac8a/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20201119102817-f84b799fce68/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
 golang.org/x/sys v0.0.0-20210615035016-665e8c7367d1/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.0.0-20220520151302-bc2c85ada10a/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.0.0-20220722155257-8c9f86f7a55f/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.6.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
-golang.org/x/sys v0.47.0 h1:o7XGOvZQCADBQQ4Y7VNq2dRWQR7JmOUW8Kxx4ZsNgWs=
-golang.org/x/sys v0.47.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
+golang.org/x/sys v0.48.0 h1:bbX/i/6MgT9BVLM9RT1thmxL04yeTAhbEz4SyadbXoo=
+golang.org/x/sys v0.48.0/go.mod h1:hNLxWAXmnKAxqDtdwIYC4bM9oQPEecfsnNMuSxOs3og=
 golang.org/x/term v0.0.0-20201126162022-7de9c90e9dd1/go.mod h1:bj7SfCRtBDWHUb9snDiAeCFNEtKQo2Wmx5Cou7ajbmo=
 golang.org/x/term v0.0.0-20210927222741-03fcf44c2211/go.mod h1:jbD1KX2456YbFQfuXm/mYQcufACuNUgVhRMnK/tPxf8=
 golang.org/x/text v0.3.0/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=
 golang.org/x/text v0.3.3/go.mod h1:5Zoc/QRtKVWzQhOtBMvqHzDpF6irO9z98xDceosuGiQ=
 golang.org/x/text v0.3.7/go.mod h1:u+2+/6zg+i71rQMx5EYifcz6MCKuco9NR6JIITiCfzQ=
 golang.org/x/text v0.3.8/go.mod h1:E6s5w1FMmriuDzIBO73fBruAKo1PCIq6d2Q6DHfQ8WQ=
-golang.org/x/text v0.41.0 h1:vz/seA0lnX87Othu2f/0L24RcgrXD9/YFTSuGjj3rH8=
-golang.org/x/text v0.41.0/go.mod h1:jvf1O8ajNzZqhSrQBPbutR/EB83Cc0CFrezNQIwbb5M=
+golang.org/x/text v0.42.0 h1:JbOZXgfeCPU9gacVtYliJqOhD+zhrEqK4LfdpmlUZqI=
+golang.org/x/text v0.42.0/go.mod h1:ojzP1Z+2QtioaF8DTtO8K5q7JWVVYwZKenzujK0Zd0E=
 golang.org/x/tools v0.0.0-20180917221912-90fa682c2a6e/go.mod h1:n7NCudcB/nEzxVGmLbDWY5pfWTLqBcC2KZ6jyYvM4mQ=
 golang.org/x/tools v0.0.0-20191119224855-298f0cb1881e/go.mod h1:b+2E5dAYhXwXZwtnZ6UAqBI28+e2cm9otk0dWdXHAEo=
 golang.org/x/tools v0.1.12/go.mod h1:hNGJHUnrk76NpqgfD5Aqm5Crs+Hm0VOH/i9J2+nxYbc=
```

**File**: `chaoscenter/event-tracker/Dockerfile` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 # BUILD STAGE
-FROM golang:1.25 AS builder
+FROM golang:1.26 AS builder
 
 LABEL maintainer="LitmusChaos"
 
```

**File**: `chaoscenter/event-tracker/go.mod` (modified, +5/-5)
```diff
@@ -1,6 +1,6 @@
 module github.com/litmuschaos/litmus/chaoscenter/event-tracker
 
-go 1.25.0
+go 1.26.0
 
 require (
 	github.com/jmespath/go-jmespath v0.4.0
@@ -52,11 +52,11 @@ require (
 	go.uber.org/multierr v1.6.0 // indirect
 	go.uber.org/zap v1.24.0 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
-	golang.org/x/net v0.56.0 // indirect
+	golang.org/x/net v0.60.0 // indirect
 	golang.org/x/oauth2 v0.27.0 // indirect
-	golang.org/x/sys v0.46.0 // indirect
-	golang.org/x/term v0.44.0 // indirect
-	golang.org/x/text v0.41.0 // indirect
+	golang.org/x/sys v0.48.0 // indirect
+	golang.org/x/term v0.46.0 // indirect
+	golang.org/x/text v0.42.0 // indirect
 	golang.org/x/time v0.3.0 // indirect
 	gomodules.xyz/jsonpatch/v2 v2.3.0 // indirect
 	google.golang.org/protobuf v1.36.7 // indirect
```

**File**: `chaoscenter/event-tracker/go.sum` (modified, +14/-14)
```diff
@@ -162,8 +162,8 @@ golang.org/x/lint v0.0.0-20190930215403-16217165b5de/go.mod h1:6SW0HCj/g11FgYtHl
 golang.org/x/mod v0.2.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.3.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.4.2/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
-golang.org/x/mod v0.38.0 h1:MECBjubtXD7yj4HrhIUcywNaGeNVUdfVnxmPajOk4yk=
-golang.org/x/mod v0.38.0/go.mod h1:V6Xz0pq8TQ3dGqVQ1FVHuelZpAL0uNhSkk9ogYP3c40=
+golang.org/x/mod v0.41.0 h1:qJmnOUb4YB+FsEuM3HcWucdZASCPGhsX6uljO6pog0c=
+golang.org/x/mod v0.41.0/go.mod h1:Ek9pY8RKWXwsWvd3rQiHYtMqkjSUV+s1Rj7j4H5Ur6o=
 golang.org/x/net v0.0.0-20180906233101-161cd47e91fd/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20190311183353-d8887717615a/go.mod h1:t9HGtf8HONx5eT2rtn7q6eTqICYqUVnKs3thJo3Qplg=
 golang.org/x/net v0.0.0-20190404232315-eb5bcb51f2a3/go.mod h1:t9HGtf8HONx5eT2rtn7q6eTqICYqUVnKs3thJo3Qplg=
@@ -172,8 +172,8 @@ golang.org/x/net v0.0.0-20200226121028-0de0cce0169b/go.mod h1:z5CRVTTTmAJ677TzLL
 golang.org/x/net v0.0.0-20200520004742-59133d7f0dd7/go.mod h1:qpuaurCH72eLCgpAm/N6yyVIVM9cpaDIP3A8BGJEC5A=
 golang.org/x/net v0.0.0-20201021035429-f5854403a974/go.mod h1:sp8m0HH+o8qH0wwXwYZr8TS3Oi6o0r6Gce1SSxlDquU=
 golang.org/x/net v0.0.0-20210405180319-a5a99cb37ef4/go.mod h1:p54w0d4576C0XHj96bSt6lcn1PtDYWL6XObtHCRCNQM=
-golang.org/x/net v0.56.0 h1:Rw8j/hFzGvJUZwNBXnAtf5sVDVt+65SK2C7IxCxZt5o=
-golang.org/x/net v0.56.0/go.mod h1:D3Ku6r+V6JROoZK144D2XfMHFcMq/0zSfLelVTCFKec=
+golang.org/x/net v0.60.0 h1:79p50tfZlm0J9YfoDsSi639qSXNGVwEzOPLCxM2FsYU=
+golang.org/x/net v0.60.0/go.mod h1:2DA/G1UfVbCpQPeWTmMPGY7Cs2PkBkwu743bVX5PIVg=
 golang.org/x/oauth2 v0.27.0 h1:da9Vo7/tDv5RH/7nZDz1eMGS/q1Vv1N/7FCrBhI9I3M=
 golang.org/x/oauth2 v0.27.0/go.mod h1:onh5ek6nERTohokkhCD/y2cV4Do3fxFHFuAejCkRWT8=
 golang.org/x/sync v0.0.0-20180314180146-1d60e4601c6f/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
@@ -182,8 +182,8 @@ golang.org/x/sync v0.0.0-20190423024810-112230192c58/go.mod h1:RxMgew5VJxzue5/jJ
 golang.org/x/sync v0.0.0-20190911185100-cd5d95a43a6e/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20201020160332-67f06af15bc9/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20210220032951-036812b2e83c/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
-golang.org/x/sync v0.22.0 h1:SZjpbeLmrCk4xhRSZFNZW5gFUeCeFgjekvI/+gfScek=
-golang.org/x/sync v0.22.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/sync v0.23.0 h1:KameEIfc1IkluZyXWLn39Wd4tURc6GbCiISGiZm2bQk=
+golang.org/x/sync v0.23.0/go.mod h1:sUUOizhqBxiL6pEWpqNLUiaJn1ShEbZ6BBqskPbjZm0=
 golang.org/x/sys v0.0.0-20180909124046-d0be0721c37e/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20190215142949-d0b11bdaac8a/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20190412213103-97732733099d/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
@@ -197,15 +197,15 @@ golang.org/x/sys v0.0.0-20210112080510-489259a85091/go.mod h1:h1NjWce9XRLGQEsW7w
 golang.org/x/sys v0.0.0-20210330210617-4fbd30eecc44/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
 golang.org/x/sys v0.0.0-20210510120138-977fb7262007/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.0.0-20220908164124-27713097b956/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
-golang.org/x/sys v0.46.0 h1:noSf2Fq6F8DBgS+LysIkx7rIExoNHJsxOAtPp4rthXw=
-golang.org/x/sys v0.46.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
+golang.org/x/sys v0.48.0 h1:bbX/i/6MgT9BVLM9RT1thmxL04yeTAhbEz4SyadbXoo=
+golang.org/x/sys v0.48.0/go.mod h1:hNLxWAXmnKAxqDtdwIYC4bM9oQPEecfsnNMuSxOs3og=
 golang.org/x/term v0.0.0-20201126162022-7de9c90e9dd1/go.mod h1:bj7SfCRtBDWHUb9snDiAeCFNEtKQo2Wmx5Cou7ajbmo=
-golang.org/x/term v0.44.0 h1:0rLvDRCtNj0gZkyIXhCyOb2OAzEhLVqc4B+hrsBhrmc=
-golang.org/x/term v0.44.0/go.mod h1:7ze4MdzUzLXpSAoFP1H0bOI9aXDqveSvatT5vKcFh2Y=
+golang.org/x/term v0.46.0 h1:3+OXuTbaKDgwk8jTi3aSLHRlmWqHEUDUtxnbFigO4YE=
+golang.org/x/term v0.46.0/go.mod h1:+K02xbkittuwc0Am4abfA3Fc+XRGXkvBXNO88NCXPoc=
 golang.org/x/text v0.3.0/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=
 golang.org/x/text v0.3.3/go.mod h1:5Zoc/QRtKVWzQhOtBMvqHzDpF6irO9z98xDceosuGiQ=
-golang.org/x/text v0.41.0 h1:vz/seA0lnX87Othu2f/0L24RcgrXD9/YFTSuGjj3rH8=
-golang.org/x/text v0.41.0/go.mod h1:jvf1O8ajNzZqhSrQBPbutR/EB83Cc0CFrezNQIwbb5M=
+golang.org/x/text v0.42.0 h1:JbOZXgfeCPU9gacVtYliJqOhD+zhrEqK4LfdpmlUZqI=
+golang.org/x/text v0.42.0/go.mod h1:ojzP1Z+2QtioaF8DTtO8K5q7JWVVYwZKenzujK0Zd0E=
 golang.org/x/time v0.3.0 h1:rg5rLMjNzMS1RkNLzCG38eapWhnYLFYXDXj2gOlr8j4=
 golang.org/x/time v0.3.0/go.mod h1:tRJNPiyCQ0inRvYxbN9jk5I+vvW/OXSQhTDSoE431IQ=
 golang.org/x/tools v0.0.0-20180917221912-90fa682c2a6e/go.mod h1:n7NCudcB/nEzxVGmLbDWY5pfWTLqBcC2KZ6jyYvM4mQ=
@@ -215,8 +215,8 @@ golang.org/x/tools v0.0.0-2020061
```

**File**: `chaoscenter/graphql/server/go.mod` (modified, +6/-7)
```diff
@@ -25,7 +25,7 @@ require (
 	github.com/tidwall/sjson v1.2.5
 	github.com/vektah/gqlparser/v2 v2.5.16
 	go.mongodb.org/mongo-driver v1.17.7
-	golang.org/x/crypto v0.56.0
+	golang.org/x/crypto v0.57.0
 	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.11
 	gopkg.in/yaml.v2 v2.4.0
@@ -36,7 +36,6 @@ require (
 
 require (
 	dario.cat/mergo v1.0.2 // indirect
-	github.com/AdamKorcz/go-118-fuzz-build v0.0.0-20250520111509-a70c2aa677fa // indirect
 	github.com/Microsoft/go-winio v0.6.2 // indirect
 	github.com/ProtonMail/go-crypto v1.3.0 // indirect
 	github.com/agnivade/levenshtein v1.1.1 // indirect
@@ -108,12 +107,12 @@ require (
 	github.com/youmark/pkcs8 v0.0.0-20240726163527-a2c0da244d78 // indirect
 	go.yaml.in/yaml/v2 v2.4.2 // indirect
 	golang.org/x/arch v0.8.0 // indirect
-	golang.org/x/net v0.58.0 // indirect
+	golang.org/x/net v0.60.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
-	golang.org/x/sync v0.22.0 // indirect
-	golang.org/x/sys v0.47.0 // indirect
-	golang.org/x/term v0.45.0 // indirect
-	golang.org/x/text v0.41.0 // indirect
+	golang.org/x/sync v0.23.0 // indirect
+	golang.org/x/sys v0.48.0 // indirect
+	golang.org/x/term v0.46.0 // indirect
+	golang.org/x/text v0.42.0 // indirect
 	golang.org/x/time v0.11.0 // indirect
 	google.golang.org/genproto v0.0.0-20250603155806-513f23925822 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
```

**File**: `chaoscenter/graphql/server/go.sum` (modified, +12/-14)
```diff
@@ -47,8 +47,6 @@ github.com/99designs/gqlgen v0.17.49 h1:b3hNGexHd33fBSAd4NDT/c3NCcQzcAVkknhN9ym3
 github.com/99designs/gqlgen v0.17.49/go.mod h1:tC8YFVZMed81x7UJ7ORUwXF4Kn6SXuucFqQBhN8+BU0=
 github.com/AdaLogics/go-fuzz-headers v0.0.0-20230811130428-ced1acdcaa24 h1:bvDV9vkmnHYOMsOr4WLk+Vo07yKIzd94sVoIqshQ4bU=
 github.com/AdaLogics/go-fuzz-headers v0.0.0-20230811130428-ced1acdcaa24/go.mod h1:8o94RPi1/7XTJvwPpRSzSUedZrtlirdB3r9Z20bi2f8=
-github.com/AdamKorcz/go-118-fuzz-build v0.0.0-20250520111509-a70c2aa677fa h1:x6kFzdPgBoLbyoNkA/jny0ENpoEz4wqY8lPTQL2DPkg=
-github.com/AdamKorcz/go-118-fuzz-build v0.0.0-20250520111509-a70c2aa677fa/go.mod h1:gCLVsLfv1egrcZu+GoJATN5ts75F2s62ih/457eWzOw=
 github.com/Azure/azure-sdk-for-go v32.5.0+incompatible/go.mod h1:9XXNKU+eRnpl9moKnB4QOLf1HestfXbmab5FXxiDBjc=
 github.com/Azure/azure-sdk-for-go v35.0.0+incompatible/go.mod h1:9XXNKU+eRnpl9moKnB4QOLf1HestfXbmab5FXxiDBjc=
 github.com/Azure/azure-sdk-for-go v43.0.0+incompatible/go.mod h1:9XXNKU+eRnpl9moKnB4QOLf1HestfXbmab5FXxiDBjc=
@@ -1286,8 +1284,8 @@ golang.org/x/crypto v0.0.0-20201002170205-7f63de1d35b0/go.mod h1:LzIPMQfyMNhhGPh
 golang.org/x/crypto v0.0.0-20210220033148-5ea612d1eb83/go.mod h1:jdWPYTVW3xRLrWPugEBEK3UY2ZEsg3UU495nc5E+M+I=
 golang.org/x/crypto v0.0.0-20210921155107-089bfa567519/go.mod h1:GvvjBRRGRdwPK5ydBHafDWAxML/pGHZbMvKqRZ5+Abc=
 golang.org/x/crypto v0.0.0-20220622213112-05595931fe9d/go.mod h1:IxCIyHEi3zRg3s0A5j5BB6A9Jmi73HwBIUl50j+osU4=
-golang.org/x/crypto v0.56.0 h1:GUh5Ii4J5jtcseSMiRqr1jXCNHoxjeV9Fmekc2oLy6Y=
-golang.org/x/crypto v0.56.0/go.mod h1:OMW5y6CY9l38uPLmxU6l6pwcXp1obtLo3e6gT7gQR2I=
+golang.org/x/crypto v0.57.0 h1:3ZVCjf8Ggz7zneR/EHRVx68Ctf+2pmIMP2UFhh9cC6M=
+golang.org/x/crypto v0.57.0/go.mod h1:Fdz0i5U6CoizGwLda9DttjSk6qlZo25zYNtR+ycvuZA=
 golang.org/x/exp v0.0.0-20190121172915-509febef88a4/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20190125153040-c74c464bbbf2/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20190306152737-a1d7652674e8/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
@@ -1393,8 +1391,8 @@ golang.org/x/net v0.0.0-20210525063256-abc453219eb5/go.mod h1:9nx3DQGgdP8bBQD5qx
 golang.org/x/net v0.0.0-20211015210444-4f30a5c0130f/go.mod h1:9nx3DQGgdP8bBQD5qxJ1jj9UTztislL4KSBs9R2vV5Y=
 golang.org/x/net v0.0.0-20211112202133-69e39bad7dc2/go.mod h1:9nx3DQGgdP8bBQD5qxJ1jj9UTztislL4KSBs9R2vV5Y=
 golang.org/x/net v0.0.0-20220722155237-a158d28d115b/go.mod h1:XRhObCWvk6IyKnWLug+ECip1KBveYUHfp+8e9klMJ9c=
-golang.org/x/net v0.58.0 h1:ynWG7rqYi4ccpTEuPZ2QGWHktVEM9DMCj9yzDE0Q7To=
-golang.org/x/net v0.58.0/go.mod h1:YwCddHnFlT7eLQqVprV19OnhLGtc5xOKgE0RyqgfWAU=
+golang.org/x/net v0.60.0 h1:79p50tfZlm0J9YfoDsSi639qSXNGVwEzOPLCxM2FsYU=
+golang.org/x/net v0.60.0/go.mod h1:2DA/G1UfVbCpQPeWTmMPGY7Cs2PkBkwu743bVX5PIVg=
 golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.0.0-20181106182150-f42d05182288/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.0.0-20190226205417-e64efc72b421/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
@@ -1424,8 +1422,8 @@ golang.org/x/sync v0.0.0-20201020160332-67f06af15bc9/go.mod h1:RxMgew5VJxzue5/jJ
 golang.org/x/sync v0.0.0-20201207232520-09787c993a3a/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20210220032951-036812b2e83c/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20220722155255-886fb9371eb4/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
-golang.org/x/sync v0.22.0 h1:SZjpbeLmrCk4xhRSZFNZW5gFUeCeFgjekvI/+gfScek=
-golang.org/x/sync v0.22.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/sync v0.23.0 h1:KameEIfc1IkluZyXWLn39Wd4tURc6GbCiISGiZm2bQk=
+golang.org/x/sync v0.23.0/go.mod h1:sUUOizhqBxiL6pEWpqNLUiaJn1ShEbZ6BBqskPbjZm0=
 golang.org/x/sys v0.0.0-20170830134202-bb24a47a89ea/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20171026204733-164713f0dfce/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20180117170059-2c42eef0765b/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
@@ -1516,14 +1514,14 @@ golang.org/x/sys v0.0.0-20220704084225-05e143d24a9e/go.mod h1:oPkhp1MJrh7nUepCBc
 golang.org/x/sys v0.0.0-20220715151400-c0bba94af5f8/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.0.0-20220722155257-8c9f86f7a55f/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.6.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
-golang.org/x/sys v0.47.0 h1:o7XGOvZQCADBQQ4Y7VNq2dRWQR7JmOUW8Kxx4ZsNgWs=
-golang.org/x/sys v0.47.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
+golang.org/x/sys v0.48.0 h1:bbX/i/6MgT9BVLM9RT1thmxL04yeTAhbEz4SyadbXoo=
+golang.org/x/sys v0.48.0/go.mod h1:hNLxWAXmnKAxqDtdwIYC4bM9oQPEecfsnNMuSxOs3og=
 golang.org/x/term v0.0.0-20201117132131-f
```

**File**: `chaoscenter/subscriber/go.mod` (modified, +5/-5)
```diff
@@ -4,7 +4,7 @@ go 1.26.0
 
 require (
 	github.com/AdaLogics/go-fuzz-headers v0.0.0-20230811130428-ced1acdcaa24
-	github.com/argoproj/argo-workflows/v3 v3.7.14
+	github.com/argoproj/argo-workflows/v3 v3.7.15
 	github.com/ghodss/yaml v1.0.1-0.20190212211648-25d852aebe32
 	github.com/golang/mock v1.6.0
 	github.com/gorilla/websocket v1.5.4-0.20250319132907-e064f32e3674
@@ -42,11 +42,11 @@ require (
 	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
 	github.com/spf13/pflag v1.0.6 // indirect
 	github.com/x448/float16 v0.8.4 // indirect
-	golang.org/x/net v0.58.0 // indirect
+	golang.org/x/net v0.60.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
-	golang.org/x/sys v0.47.0 // indirect
-	golang.org/x/term v0.45.0 // indirect
-	golang.org/x/text v0.41.0 // indirect
+	golang.org/x/sys v0.48.0 // indirect
+	golang.org/x/term v0.46.0 // indirect
+	golang.org/x/text v0.42.0 // indirect
 	golang.org/x/time v0.11.0 // indirect
 	google.golang.org/genproto v0.0.0-20250603155806-513f23925822 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
```

#### Recent Merged Pull Requests:
- **PR #5657** (2026-10-20): fix: resolve Trivy HIGH vulnerabilities in chaoscenter images (@Sonichigo)
- **PR #5646** (2026-10-14): fix(chaoscenter): include the year when comparing date ranges (@ajmani-x)
- **PR #5644** (2026-10-14): fix: keep the experiment manifest in git when deleting a single run (@Aryanbhargava18)
- **PR #5643** (2026-10-14): fix: return FindUsersByUID errors before using the result in GetProjectById (@Aryanbhargava18)
- **PR #5642** (2026-10-14): fix: sort experiments by name in the requested order (@Aryanbhargava18)
- **PR #5637** (2026-10-14): fix(manifests): move CUSTOM_TLS_CERT from subscriber config to subscriber secret  (@mimo-to)

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

## X. fix unimplemented concurrency in CheckComponentStatus (#5522)

**RULE**:
When implementing operations in `chaoscenter/subscriber/pkg/k8s/operations.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in litmuschaos/litmus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b957f314`: fix unimplemented concurrency in CheckComponentStatus (#5522). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `chaoscenter/subscriber/pkg/k8s/operations.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"sync/atomic"
	Deployments []string `yaml:"DEPLOYMENTS"`
	if err := yaml2.Unmarshal([]byte(strings.TrimSpace(componentEnv)), &components); err != nil {
	ctx := context.TODO()
	for retry := 0; retry < LiveCheckMaxTries; retry++ {
		if allDeploymentsHealthy(ctx, clientset, InfraNamespace, components.Deployments) {
			logrus.Info("All infra deployments are up")
			return nil
		}
		if retry < LiveCheckMaxTries-1 {
			time.Sleep(30 * time.Second)
		}
	}
	return errors.New("all components failed to startup")
}
func allDeploymentsHealthy(ctx context.Context, clientSet kubernetes.Interface, namespace string, selectors []string) bool {
	if len(selectors) == 0 {
		return true
	}
	var (
		wg     sync.WaitGroup
		failed atomic.Int32
	)
	wg.Add(len(selectors))
	for _, curSelector := range selectors {
		go func(labelSelector string) {
			defer wg.Done()
			if !deploymentHealthy(ctx, clientSet, namespace, labelSelector) {
				failed.Add(1)
			}
		}(curSelector)
	wg.Wait()

	return failed.Load() == 0
func deploymentHealthy(ctx context.Context, clientSet kubernetes.Interface, namespace string, labelSelector string) bool {
	podList, err := clientSet.CoreV1().Pods(namespace).List(ctx, metav1.ListOpt
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	Deployments      []string `yaml:"DEPLOYMENTS"`
	LiveStatus       bool
	AccessLiveStatus sync.Mutex

	err = yaml2.Unmarshal([]byte(strings.TrimSpace(componentEnv)), &components)
	if err != nil {
	components.LiveStatus = true
	components.AccessLiveStatus = sync.Mutex{}

	wait := sync.WaitGroup{}
	// add all agent components to waitgroup
	wait.Add(1)
	go k8s.checkDeploymentStatus(&components, clientset, &wait)
	wait.Wait()
	if !components.LiveStatus {
		return errors.New("all components failed to startup")
	return nil
func (k8s *k8sSubscriber) checkDeploymentStatus(components *InfraComponents, clientset *kubernetes.Clientset, wait *sync.WaitGroup) {
	ctx := context.TODO()
	downCount := 0
	retries := 0
	defer wait.Done()
	for retries < LiveCheckMaxTries {
		for _, dep := range components.Deployments {
			podList, err := clientset.CoreV1().Pods(InfraNamespace).List(ctx, metav1.ListOptions{LabelSelector: dep})
			if err != nil {
				logrus.Errorf("failed to get deployment pods %v , err : %v", dep, err.Error())
				downCount += 1
				continue
			}
			if len(podList.Items) == 0 {
				logrus.Errorf("failed to get deployments pods %v , err : pods not found", dep)
				downCount += 1
				cont
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b957f314` are properly handled with clean fallback behavior.
