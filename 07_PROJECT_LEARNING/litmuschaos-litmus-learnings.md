# Forensic Learning Record (Deep Inspection): litmuschaos/litmus

> **Canonical Artifact**: `07_PROJECT_LEARNING/litmuschaos-litmus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/litmuschaos/litmus](https://github.com/litmuschaos/litmus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:39:50.591Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `litmuschaos/litmus`
- **Description**: Litmus helps  SREs and developers practice chaos engineering in a Cloud-native way. Chaos experiments are published at the ChaosHub  (https://hub.litmuschaos.io). Community notes is at https://hackmd.io/a4Zu_sH4TZGeih-xCimi3Q
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5727 stars

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

### Core Architecture Module: `chaoscenter/graphql/server/pkg/chaos_infrastructure/infra_utils.go`
```
package chaos_infrastructure

import (
	"fmt"
	"os"
	"strings"

	"github.com/ghodss/yaml"
	"github.com/litmuschaos/litmus/chaoscenter/graphql/server/graph/model"
	store "github.com/litmuschaos/litmus/chaoscenter/graphql/server/pkg/data-store"
	dbChaosInfra "github.com/litmuschaos/litmus/chaoscenter/graphql/server/pkg/database/mongodb/chaos_infrastructure"
	"github.com/litmuschaos/litmus/chaoscenter/graphql/server/utils"
	log "github.com/sirupsen/logrus"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type SubscriberConfigurations struct {
	ServerEndpoint string
	TLSCert        string
}

func GetEndpoint(host string) (string, error) {
	const apiPath = "/query"
	// returns endpoint from env, if provided by user
	if utils.Config.ChaosGraphQLEndpoint != "" {
		return strings.TrimRight(utils.Config.ChaosGraphQLEndpoint, "/") + apiPath, nil
	}

	return strings.TrimRight(host, "/") + apiPath, nil
}

func GetK8sInfraYaml(host string, infra dbChaosInfra.ChaosInfra) ([]byte, error) {

	var config SubscriberConfigurations
	endpoint, err := GetEndpoint(host)
	if err != nil {
		return nil, err
	}
	config.ServerEndpoint = endpoint

	config.TLSCert = utils.Config.TlsCertB64

	var respData []byte
	if infra.InfraScope == ClusterScope {
		respData, err = ManifestParser(infra, "manifests/cluster", &config)
	} else if infra.InfraScope == NamespaceScope {
		respData, err = ManifestParser(infra, "manifests/namespace", &config)
	} else {
		log.Error("INFRA_SCOPE env is empty!")
	}
	if err != nil {
		return nil, err
	}

	return respData, nil
}

// ManifestParser parses manifests yaml and generates dynamic manifest with specified keys
func ManifestParser(infra dbChaosInfra.ChaosInfra, rootPath string, config *SubscriberConfigurations) ([]byte, error) {
	var (
		generatedYAML             []string
		defaultState              = false
		InfraNamespace            string
		ServiceAccountName        string
		DefaultInfraNamespace     = "litmus"
		DefaultServiceAccountName = "litmus"
	)

	if infra.InfraNsExists == nil {
		infra.InfraNsExists = &defaultState
	}
	if infra.InfraSaExists == nil {
		infra.InfraSaExists = &defaultState
	}

	if infra.InfraNamespace != nil && *infra.InfraNamespace != "" {
		InfraNamespace = *infra.InfraNamespace
	} else {
		InfraNamespace = DefaultInfraNamespace
	}

	if infra.ServiceAccount != nil && *infra.ServiceAccount != "" {
		ServiceAccountName = *infra.ServiceAccount
	} else {
		ServiceAccountName = DefaultServiceAccountName
	}

	skipSSL := "false"
	if infra.SkipSSL != nil && *infra.SkipSSL {
		skipSSL = "true"
	}

	var (
		namespaceConfig   = "---\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: " + InfraNamespace + "\n"
		serviceAccountStr = "---\napiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: " + ServiceAccountName + "\n  namespace: " + InfraNamespace + "\n"
	)

	// Checking if the agent namespace does not exist and its scope of installation is not namespaced
	if !*infra.InfraNsExists && infra.InfraScope != "namespace" {
		generatedYAML = append(generatedYAML, fmt.Sprintf("%v", namespaceConfig))
	}

	if !*infra.InfraSaExists {
		generatedYAML = append(generatedYAML, fmt.Sprintf("%v", serviceAccountStr))
	}

	// File operations
	file, err := os.Open(rootPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open the file %v", err)
	}

	defer func(file *os.File) {
		err := file.Close()
		if err != nil {
			log.Errorf("failed to close the file %v", err)
		}
	}(file)

	list, err := file.Readdirnames(0) // 0 to read all files and folders
	if err != nil {
		return nil, fmt.Errorf("failed to read the file %v", err)
	}

	var nodeSelector string
	if infra.NodeSelector != nil {
		selector := strings.Split(*infra.NodeSelector, ",")
		selectorList := make(map[string]string)
		for _, el := range selector {
			kv := strings.Split(el, "=")
			selectorList[kv[0]] = kv[1]
		}

		byt, err := yaml.Marshal(
			struct {
				NodeSelector map[string]string `yaml:"nodeSelector" json:"nodeSelector"`
			}{
				NodeSelector: selectorList,
			})
		if err != nil {
			return nil, fmt.Errorf("failed to marshal the node selector %v", err)
		}

		nodeSelector = string(utils.AddRootIndent(byt, 6))
	}

	var tolerations string
	if infra.Tolerations != nil {
		byt, err := yaml.Marshal(struct {
			Tolerations []*dbChaosInfra.Toleration `yaml:"tolerations" json:"tolerations"`
		}{
			Tolerations: infra.Tolerations,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to marshal the tolerations %v", err)
		}

		tolerations = string(utils.AddRootIndent(byt, 6))
	}

	for _, fileName := range list {
		fileContent, err := os.ReadFile(rootPath + "/" + fileName)
		if err != nil {
			return nil, fmt.Errorf("failed to read the file %v", err)
		}

		var newContent = string(fileContent)

		newContent = strings.Replace(newContent, "#{TOLERATIONS}", tolerations, -1)
		newContent = strings.Replace(newContent, "#{INFRA_ID}", infra.InfraID, -1)
		newContent = strings.Replace(newContent, "#{ACCESS_KEY}", infra.AccessKey, -1)
		newContent = strings.Replace(newContent, "#{SERVER_ADDR}", config.ServerEndpoint, -1)
		newContent = strings.Replace(newContent, "#{SUBSCRIBER_IMAGE}", utils.Config.SubscriberImage, -1)
		newContent = strings.Replace(newContent, "#{EVENT_TRACKER_IMAGE}", utils.Config.EventTrackerImage, -1)
		newContent = strings.Replace(newContent, "#{INFRA_NAMESPACE}", InfraNamespace, -1)
		newContent = strings.Replace(newContent, "#{INFRA_SERVICE_ACCOUNT}", ServiceAccountName, -1)
		newContent = strings.Replace(newContent, "#{INFRA_SCOPE}", infra.InfraScope, -1)
		newContent = strings.Replace(newContent, "#{ARGO_WORKFLOW_CONTROLLER}", utils.Config.ArgoWorkflowControllerImage, -1)
		newContent = strings.Replace(newContent, "#{LITMUS_CHAOS_OPERATOR}", utils.Config.LitmusChaosOperatorImage, -1)
		newContent = strings.Replace(newContent, "#{ARGO_WORKFLOW_EXECUTOR}", utils.Config.ArgoWorkflowExecutorImage, -1)
		newContent = strings.Replace(newContent, "#{LITMUS_CHAOS_RUNNER}", utils.Config.LitmusChaosRunnerImage, -1)
		newContent = strings.Replace(newContent, "#{LITMUS_CHAOS_EXPORTER}", utils.Config.LitmusChaosExporterImage, -1)
		newContent = strings.Replace(newContent, "#{ARGO_CONTAINER_RUNTIME_EXECUTOR}", utils.Config.ContainerRuntimeExecutor, -1)
		newContent = strings.Replace(newContent, "#{INFRA_DEPLOYMENTS}", utils.Config.InfraDeployments, -1)
		newContent = strings.Replace(newContent, "#{VERSION}", utils.Config.Version, -1)
		newContent = strings.Replace(newContent, "#{SKIP_SSL_VERIFY}", skipSSL, -1)
		newContent = strings.Replace(newContent, "#{CUSTOM_TLS_CERT}", config.TLSCert, -1)

		newContent = strings.Replace(newContent, "#{START_TIME}", "\""+infra.StartTime+"\"", -1)
		if infra.IsInfraConfirmed {
			newContent = strings.Replace(newContent, "#{IS_INFRA_CONFIRMED}", "\""+"true"+"\"", -1)
		} else {
			newContent = strings.Replace(newContent, "#{IS_INFRA_CONFIRMED}", "\""+"false"+"\"", -1)
		}

		if infra.NodeSelector != nil {
			newContent = strings.Replace(newContent, "#{NODE_SELECTOR}", nodeSelector, -1)
		}
		generatedYAML = append(generatedYAML, newContent)
	}

	return []byte(strings.Join(generatedYAML, "\n")), nil
}

// SendRequestToSubscriber sends events from the graphQL server to the subscribers listening for the requests
func SendRequestToSubscriber(subscriberRequest SubscriberRequests, r store.StateData) {
	newAction := &model.InfraActionResponse{
		ProjectID: subscriberRequest.ProjectID,
		Action: &model.ActionPayload{
			K8sManifest:  subscriberRequest.K8sManifest,
			Namespace:    subscriberRequest.Namespace,
			RequestType:  subscriberRequest.RequestType,
			ExternalData: subscriberRequest.ExternalData,
			Username:     subscriberRequest.Username,
		},
	}

	r.Mutex.Lock()
	if observer, ok := r.ConnectedInfra[subscriberRequest.InfraID]; ok {
		observer <- newAction
	}
	r.Mutex.Unlock()
}

// SendExperimentToSubscriber sends the workflow to the subscriber to be handled
func SendExperimentToSubscriber(projectID string, workflow *model.ChaosExperimentRequest, username *string, externalData *string, reqType string, r *store.StateData) {

	var workflowObj unstructured.Unstructured
	err := yaml.Unmarshal([]byte(workflow.ExperimentManifest), &workflowObj)
	if err != nil {
		log.Errorf("error while parsing experiment manifest %v", err)
		return
	}

	SendRequestToSubscriber(SubscriberRequests{
		K8sManifest:  workflow.ExperimentManifest,
		RequestType:  reqType,
		ProjectID:    projectID,
		InfraID:      workflow.InfraID,
		Namespace:    workflowObj.GetNamespace(),
		ExternalData: externalData,
		Username:     username,
	}, *r)
}

```

### Core Architecture Module: `chaoscenter/graphql/server/pkg/gitops/util.go`
```
package gitops

import "os"

// PathExists checks for the existence of this path
func PathExists(path string) (bool, error) {
	_, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

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

- **Issue #5559** (2026-08-25): **IsAgentConfirmed panics with nil pointer dereference on transient Kubernetes API errors**
  *Symptoms*: What happened: In chaoscenter/subscriber/pkg/k8s/operations.go, the function IsAgentConfirmed() (lines 136–154) can crash with a nil pointer panic.  It calls clientset.CoreV1().ConfigMaps(InfraNamespace).Get(...) and only checks for a "not found" error using k8s_errors.IsNotFound(err). But if Get fails for any other reason — like a temporary API server timeout, network issue, or missing RBAC permissions — getCM comes back as nil. The code then still runs getCM.Data["IS_INFRA_CONFIRMED"], which tries to read from a nil object and crashes the subscriber.  There's also a small piece of dead code right after:   getSecret, err := clientset.CoreV1().Secrets(InfraNamespace).Get(...) if err != nil {     return false, "", errors.New(InfraSecretName + " secret not found") }  if k8s_errors.IsNotFound(err) {   // this can never run — err is already nil here     return false, "", err } Since the line above already returns on any error, this IsNotFound check can never be reached.  What you expected to happen: Any error from the ConfigMap Get call — not just "not found" — should be handled before getCM is used, so a temporary Kubernetes API hiccup returns an error instead of crashing the agent. The leftover dead IsNotFound check on the secret fetch should also be cleaned up.  Where can this issue be corrected? (optional): chaoscenter/subscriber/pkg/k8s/operations.go → function IsAgentConfirmed → lines 136–154.  How to reproduce it (as minimally and precisely as possible):  Run the subscribe
  **Post-Mortem & Fix Analysis**:
  > /assign 

- **Issue #5552** (2026-06-30): **[Security]bcrypt error silently ignored in CreateUser — users created with invalid password hash**
  *Symptoms*: ## Expected behavior  When `bcrypt.GenerateFromPassword()` fails during  user creation, the error should be returned to the  caller and user creation should be aborted.  ## Actual behavior  In `chaoscenter/authentication/api/handlers/rest/user_handlers.go`  line 81, the error from `bcrypt.GenerateFromPassword()`  is logged but NOT returned. Execution continues with  an empty/zero-value password hash, meaning users can  be created with invalid password hashes.  This is a security vulnerability — a user account  created with an empty hash could potentially be  accessed without a valid password.  ## Location  - File: `chaoscenter/authentication/api/handlers/rest/user_handlers.go` - Line: 81  ## Current Code  hash, err := bcrypt.GenerateFromPassword(...) if err != nil {     log.Error(err) } // execution continues with empty hash  ## Proposed Fix  hash, err := bcrypt.GenerateFromPassword(...) if err != nil {     log.Error(err)     return err }  ## Why This Matters  - Security bug — invalid password hashes compromise   authentication integrity - User accounts created during bcrypt failures are   in an inconsistent state - Silent failures make debugging extremely difficult  ## Additional Notes  Found while auditing the codebase as a new contributor. I would like to work on this fix if maintainers agree with the approach.  ## Please complete the following information  - File: chaoscenter/authentication/api/handlers/rest/user_handlers.go - Language: Go - Component: Authentication serv
  **Post-Mortem & Fix Analysis**:
  > @ispeakc0de I want to work on this issue can i work on this 

- **Issue #5544** (2026-06-30): **test: add fuzz tests for chaos experiment run MongoDB operator**
  *Symptoms*: <!--   Thanks for filing an issue! Before hitting the button, please answer these questions.    Fill in as much of the template below as you can.   If you leave out information, we can't help you as well.    Be ready for followup questions, and please respond in a timely   manner. If we can't reproduce a bug we might close your issue.   If we're wrong, PLEASE feel free to reopen it and explain why. -->  **What happened**:  `chaoscenter/graphql/server/pkg/database/mongodb/chaos_experiment_run/operations.go` contains MongoDB operator functions for chaos experiment runs, including `CreateExperimentRun`, `GetExperimentRun`, `GetExperimentRuns`, `UpdateExperimentRun`, `UpdateExperimentRunWithQuery`, `UpdateExperimentRunsWithQuery`, `GetExperimentRunsByInfraID`, and `GetAggregateExperimentRuns`. These functions handle database operations but currently have no fuzz test coverage.  **What you expected to happen**:  These MongoDB operator functions should have dedicated Go fuzz tests that verify the functions do not panic when given arbitrary or malformed inputs, following the existing Litmus fuzz test patterns.  **Where can this issue be corrected? (optional)**  `chaoscenter/graphql/server/pkg/database/mongodb/chaos_experiment_run/fuzz_tests/operator_fuzz_test.go`  **How to reproduce it (as minimally and precisely as possible)**:  Run the fuzz targets after adding the fuzz tests: ``` cd chaoscenter/graphql/server go test ./pkg/database/mongodb/chaos_experiment_run/fuzz_tests/... ``` 

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

Signed-off-by: Nayyar <[REDACTED_EMAIL]>

* chore(deps): bump x/text, x/net and grpc to clear trivy HIGH findings

Signed-off-by: Nayyar <[REDACTED_EMAIL]>

---------

Signed-off-by: Nayyar <[REDACTED_EMAIL]>
Co-authored-by: Pritesh Kiri <[REDACTED_EMAIL]>

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
 			c.JSON(utils.ErrorStatusCodes[utils.ErrServerError], presenter.CreateErrorResponse(utils.ErrServerError))
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

Signed-off-by: ajmani-x <[REDACTED_EMAIL]>
Co-authored-by: Pritesh Kiri <[REDACTED_EMAIL]>

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

**File**: `translations/README-ge.md` (modified, +4/-4)
```diff
@@ -15,7 +15,7 @@
 [![YouTube Channel](https://img.shields.io/badge/YouTube-Subscribe-red)](https://www.youtube.com/channel/UCa57PMqmz_j0wnteRa9nCaw)
 <br><br><br><br>
 
-#### *Das README in [anderen Sprachen](translations/TRANSLATIONS.md).*
+#### *Das README in [anderen Sprachen](TRANSLATIONS.md).*
 
 [KR](https://github.com/litmuschaos/litmus/blob/master/translations/README-ko.md) [CN](https://github.com/litmuschaos/litmus/blob/master/translations/README-chn.md) [GB](https://github.com/litmuschaos/litmus/blob/master/README.md)
 
@@ -59,7 +59,7 @@ Die Chaos-Experimente werden auf <a href="https://hub.litmuschaos.io" target="_b
 
 ## Mit Litmus loslegen
 
-[![IMAGE ALT TEXT](images/maxresdefault.jpg)](https://youtu.be/W5hmNbaYPfM)
+[![IMAGE ALT TEXT](../images/maxresdefault.jpg)](https://youtu.be/W5hmNbaYPfM)
 
 Erste Informationen findet man in der <a href="https://docs.litmuschaos.io/docs/next/getstarted.html" target="_blank">Litmus Dokumentation (Seite aktuell noch auf Englisch)</a>.
 
@@ -77,7 +77,7 @@ während der Entwicklung Litmus zum Chaos Engineering nutzen_)
 ## Anmerkungen
 
 Ein paar relevante Dinge, die bei der Arbeit mit Litmus zu beachten sind, sind im Folgenden
-aufgelistet. Die meisten offenen Punkte sind bereits Teil der [Roadmap](./ROADMAP.nd). Für Details zu den
+aufgelistet. Die meisten offenen Punkte sind bereits Teil der [Roadmap](../ROADMAP.md). Für Details zu den
 Einschränkungen bestimmter Experimente empfiehlt sich ein Blick in die
 jeweilige [Dokumentation](https://docs.litmuschaos.io/docs/pod-delete/).
 
@@ -89,7 +89,7 @@ jeweilige [Dokumentation](https://docs.litmuschaos.io/docs/pod-delete/).
 ## Lizenz
 
 Litmus ist unter der Apache License, Version 2.0 zugelassen. Die komplette Lizenz
-ist auf folgender Seite zu finden: [Lizenz](./LICENSE). Einige Projekte, die
+ist auf folgender Seite zu finden: [Lizenz](../LICENSE). Einige Projekte, die
 von Litmus genutzt werden, sind eventuell anders Lizensiert.
 Bitte schaue bei den jeweiligen Projekt nach.
 
```

**File**: `translations/README-hi.md` (modified, +6/-6)
```diff
@@ -15,9 +15,9 @@
 [![YouTube Channel](https://img.shields.io/badge/YouTube-Subscribe-red)](https://www.youtube.com/channel/UCa57PMqmz_j0wnteRa9nCaw)
 <br><br><br><br>
 
-#### *इसे [अन्य भाषाओं](translations/TRANSLATIONS.md) में पढ़ें।*
+#### *इसे [अन्य भाषाओं](TRANSLATIONS.md) में पढ़ें।*
 
-[🇰🇷](translations/README-ko.md) [🇨🇳](translations/README-chn.md) [🇯🇵](translations/README-ja.md)
+[🇰🇷](README-ko.md) [🇨🇳](README-chn.md) [🇯🇵](README-ja.md)
 
 ## अवलोकन
 
@@ -29,7 +29,7 @@
 - **ChaosExperiment** : कैओस प्रयोग के विन्यास मापदंडों को समूहित करने का एक संसाधन हैं। कैओस प्रयोग (कस्टम संसाधन) ऑपरेटर द्वारा बनाया जाता है जब प्रयोगों को ChaosEngine द्वारा लागू किया जाता है ।
 - **ChaosResult** : एक संसाधन कैओस -प्रयोग के परिणामों को सहेजने के लिए। कैओस निर्यातक परिणाम पढ़ता है और एक विन्यास प्रोमेथियस सर्वर में मैट्रिक्स निर्यात करता है ।
 
-कैओस  प्रयोगों [hub.litmuschaos.io](hub.litmuschaos.io) पर आयोजित कर रहे हैं । यह एक केंद्रीय केंद्र है जहां आवेदन डेवलपर्स या विक्रेता अपने कैओस  प्रयोगों को साझा करते हैं ताकि उनके उपयोगकर्ता उत्पादन में अनुप्रयोगों के लचीलेपन को बढ़ाने के लिए उनका उपयोग कर सकें।
+कैओस  प्रयोगों [hub.litmuschaos.io](https://hub.litmuschaos.io) पर आयोजित कर रहे हैं । यह एक केंद्रीय केंद्र है जहां आवेदन डेवलपर्स या विक्रेता अपने कैओस  प्रयोगों को साझा करते हैं ताकि उनके उपयोगकर्ता उत्पादन में अनुप्रयोगों के लचीलेपन को बढ़ाने के लिए उनका उपयोग कर सकें।
 
 ![Litmus workflow](/images/litmus-arch_1.png)
 
@@ -41,7 +41,7 @@
 
 ## लिटमस की व्याख्या
 
-[![IMAGE ALT TEXT](images/maxresdefault.jpg)](https://youtu.be/W5hmNbaYPfM)
+[![IMAGE ALT TEXT](../images/maxresdefault.jpg)](https://youtu.be/W5hmNbaYPfM)
 
 समझने के लिए [लिटमस डॉक्स](https://docs.litmuschaos.io/docs/next/getstarted.html) देखें।
 
@@ -58,7 +58,7 @@
 ## कृपया ध्यान रखें
 
 लिटमस (कैओस  ढांचे के रूप में) के साथ किए जाने वाले कुछ विचार मोटे तौर पर यहां सूचीबद्ध हैं। इनमें से कई पर पहले से ही काम किया जा रहा है
-जैसा कि [रोडमैप](./ROADMAP.md) में उल्लेख किया गया है । विशिष्ट प्रयोगों के आसपास विवरण या सीमाओं के लिए, संबंधित [प्रयोगों डॉक्स](https://docs.litmuschaos.io/docs/pod-delete/) का उल्लेख करें ।
+जैसा कि [रोडमैप](../ROADMAP.md) में उल्लेख किया गया है । विशिष्ट प्रयोगों के आसपास विवरण या सीमाओं के लिए, संबंधित [प्रयोगों डॉक्स](https://docs.litmuschaos.io/docs/pod-delete/) का उल्लेख करें ।
 
 - लिटमस कैओस  ऑपरेटर और कैओस  प्रयोग क्लस्टर में कुबेरनेट संसाधनों के रूप में चलते हैं। एयरगेप्ड वातावरण के मामले में, कैओस  कस्टम संसाधन
   और छवियों को आधार पर होस्ट करने की आवश्यकता है।
@@ -70,7 +70,7 @@
 
 ## लाइसेंस
 
-लिटमस अपाचे लाइसेंस, संस्करण 2.0 के तहत लाइसेंस प्राप्त है। पूर्ण लाइसेंस पाठ के लिए [लाइसेंस](./LICENSE) देखें । लिटमस परियोजना द्वारा उपयोग की जाने वाली कुछ परियोजनाएं एक अलग लाइसेंस द्वारा नियंत्रित की जा सकती हैं, कृपया इसके विशिष्ट लाइसेंस का उल्लेख करें।
+लिटमस अपाचे लाइसेंस, संस्करण 2.0 के तहत लाइसेंस प्राप्त है। पूर्ण लाइसेंस पाठ के लिए [लाइसेंस](../LICENSE) देखें । लिटमस परियोजना द्वारा उपयोग की जाने वाली कुछ परियोजनाएं एक अलग लाइसेंस द्वारा नियंत्रित की जा सकती हैं, कृपया इसके विशिष्ट लाइसेंस का उल्लेख करें।
 
 [![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Flitmuschaos%2Flitmus.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Flitmuschaos%2Flitmus?ref=badge_large)
 लिटमस कैओस सीएनसीएफ परियोजनाओं का हिस्सा है।
```

**File**: `translations/README-ja.md` (modified, +5/-5)
```diff
@@ -15,9 +15,9 @@
 [![YouTube Channel](https://img.shields.io/badge/YouTube-Subscribe-red)](https://www.youtube.com/channel/UCa57PMqmz_j0wnteRa9nCaw)
 <br><br><br><br>
 
-#### *他の言語は[ここを参照してください。](translations/TRANSLATIONS.md).*
+#### *他の言語は[ここを参照してください。](TRANSLATIONS.md).*
 
-[🇰🇷](translations/README-ko.md) [🇨🇳](translations/README-chn.md)
+[🇰🇷](README-ko.md) [🇨🇳](README-chn.md)
 
 ## 概要
 
@@ -41,7 +41,7 @@ Litmusはクラウドネイティブなアプローチで、カオスの生成
 
 ## Litmusを始める
 
-[![IMAGE ALT TEXT](images/maxresdefault.jpg)](https://youtu.be/W5hmNbaYPfM)
+[![IMAGE ALT TEXT](../images/maxresdefault.jpg)](https://youtu.be/W5hmNbaYPfM)
 
 始めるには <a href="https://docs.litmuschaos.io/docs/next/getstarted.html" target="_blank">Litmusドキュメンテーション</a>を参照ください。。
 
@@ -57,7 +57,7 @@ Litmusはクラウドネイティブなアプローチで、カオスの生成
 
 ## 考慮すべき事項
 
-Litmus（カオスフレームワークとして）で行う必要がある考慮すべき事項のいくつかは、ここに大まかにリストアップされています。これらの多くは、[ロードマップ](./ROADMAP.md)で述べられているように、すでに作業が行われています。特定のエクスペリメントに関する詳細や制限については、それぞれの[エクスペリメントドキュメント](https://docs.litmuschaos.io/docs/pod-delete/)を参照してください。
+Litmus（カオスフレームワークとして）で行う必要がある考慮すべき事項のいくつかは、ここに大まかにリストアップされています。これらの多くは、[ロードマップ](../ROADMAP.md)で述べられているように、すでに作業が行われています。特定のエクスペリメントに関する詳細や制限については、それぞれの[エクスペリメントドキュメント](https://docs.litmuschaos.io/docs/pod-delete/)を参照してください。
 
 - Docker以外のコンテナランタイム（containerd, CRI-O）のネットワークカオスは[1.8.0](https://github.com/litmuschaos/litmus/releases/tag/1.8.0)からサポートされています。
 - Litmusのカオスオペレーターとカオスエクスペリメントはクラスタ内のkubernetesリソースとして動作します。インターネットから隔離された環境の場合、カオスカスタムリソースとイメージをオンプレミスでホストする必要があります。
@@ -67,7 +67,7 @@ Litmus（カオスフレームワークとして）で行う必要がある考
 
 ## ライセンス
 
-Litmus は Apache License, Version 2.0 の下でライセンスされています。ライセンスの全文は[ライセンス](./LICENSE)を参照してください。Litmusプロジェクトで使用されているプロジェクトの中には、別のライセンスで管理されているものもありますので、そのライセンスを参照してください。
+Litmus は Apache License, Version 2.0 の下でライセンスされています。ライセンスの全文は[ライセンス](../LICENSE)を参照してください。Litmusプロジェクトで使用されているプロジェクトの中には、別のライセンスで管理されているものもありますので、そのライセンスを参照してください。
 
 [![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Flitmuschaos%2Flitmus.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Flitmuschaos%2Flitmus?ref=badge_large)
 
```

---

### Incident Patch 3: `2d761dca` (2026-09-30)
**Commit Message**: chore: go version bump and cve fixed (#5627)

Signed-off-by: Animesh Pathak <[REDACTED_EMAIL]>

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

**File**: `chaoscenter/upgrade-agents/control-plane/Dockerfile` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 # BUILD STAGE
-FROM golang:1.25 AS builder
+FROM golang:1.26 AS builder
 
 LABEL maintainer="LitmusChaos"
 
```

**File**: `chaoscenter/upgrade-agents/control-plane/go.mod` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ require (
 	github.com/xdg-go/scram v1.1.2 // indirect
 	github.com/xdg-go/stringprep v1.0.4 // indirect
 	github.com/youmark/pkcs8 v0.0.0-20201027041543-1326539a0a0a // indirect
-	golang.org/x/crypto v0.55.0 // indirect
+	golang.org/x/crypto v0.56.0 // indirect
 	golang.org/x/sync v0.22.0 // indirect
 	golang.org/x/sys v0.47.0 // indirect
 	golang.org/x/text v0.41.0 // indirect
```

**File**: `chaoscenter/upgrade-agents/control-plane/go.sum` (modified, +2/-2)
```diff
@@ -77,8 +77,8 @@ golang.org/x/crypto v0.0.0-20190308221718-c2843e01d9a2/go.mod h1:djNgcEr1/C05ACk
 golang.org/x/crypto v0.0.0-20200302210943-78000ba7a073/go.mod h1:LzIPMQfyMNhhGPhUkYOs5KpL4U8rLKemX1yGLhDgUto=
 golang.org/x/crypto v0.0.0-20210921155107-089bfa567519/go.mod h1:GvvjBRRGRdwPK5ydBHafDWAxML/pGHZbMvKqRZ5+Abc=
 golang.org/x/crypto v0.0.0-20220622213112-05595931fe9d/go.mod h1:IxCIyHEi3zRg3s0A5j5BB6A9Jmi73HwBIUl50j+osU4=
-golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
-golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
+golang.org/x/crypto v0.56.0 h1:GUh5Ii4J5jtcseSMiRqr1jXCNHoxjeV9Fmekc2oLy6Y=
+golang.org/x/crypto v0.56.0/go.mod h1:OMW5y6CY9l38uPLmxU6l6pwcXp1obtLo3e6gT7gQR2I=
 golang.org/x/mod v0.6.0-dev.0.20220419223038-86c51ed26bb4/go.mod h1:jJ57K6gSWd91VN4djpZkiMVwK6gcyfeH4XE8wZrZaV4=
 golang.org/x/net v0.0.0-20190404232315-eb5bcb51f2a3/go.mod h1:t9HGtf8HONx5eT2rtn7q6eTqICYqUVnKs3thJo3Qplg=
 golang.org/x/net v0.0.0-20190620200207-3b0461eec859/go.mod h1:z5CRVTTTmAJ677TzLLGU+0bjPO0LkuOLi4/5GtJWs/s=
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

Signed-off-by: PriteshKiri <[REDACTED_EMAIL]>
Co-authored-by: Cursor <[REDACTED_EMAIL]>

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
     asynckit "^0.4.0"
     combined-stream "^1.0.8"
-    mime-types "^2.1.12"
+    es-set-tostringtag "^2.1.0"
+    hasown "^2.0.4"
+    mime-types "^2.1.35"
 
 formdata-polyfill@^4.0.10:
   version "4.0.10"
@@ -4456,6 +4497,22 @@ get-intrinsic@^1.1.3, get-intrinsic@^1.2.4:
     has-symbols "^1.0.3"
     hasown "^2.0.0"
 
+get-intrinsic@^1.2.6:
+  version "1.3.0"
+  resolved "https://registry.yarnpkg.com/get-intrinsic/-/get-intrinsic-1.3.0.tgz#743f0e3b6964a93a5491ed1bffaae054d7f98d01"
+  integrity sha512-9fSjSaos/fRIVIp+xSJlE6lfwhES7LNtKaCBIamHsjr2na1BiABJPo0mOjjz8GJDURarmCPGqaiVg5mfjb98CQ==
+  dependencies:
+    call-bind-apply-helpers "^1.0.2"
+    es-define-property "^1.0.1"
+    es-errors "^1.3.0"
+    es-object-atoms "^1.1.1"
+    function-bind "^1.1.2"
+    get-proto "^1.0.1"
+    gopd "^1.2.0"
+    has-symbols "^1.1.0"
+    hasown "^2.0.2"
+    math-intrinsics "^1.1.0"
+
 get-own-enumerable-property-symbols@^3.0.0:
   version "3.0.2"
   resolved "https://registry.yarnpkg.com/get-own-enu
```

---

### Incident Patch 5: `470f6124` (2026-09-30)
**Commit Message**: chore: fix fuzzing test ci due to protobuf conflict (#5632)

Signed-off-by: Animesh Pathak <[REDACTED_EMAIL]>

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
-	k8s.io/kubelet => k8s.io/kubelet v0.21.2
-	k8s.io/legacy-cloud-providers => k8s.io/legacy-cloud-providers v0.21.2
-	k8s.io/metrics => k8s.io/metrics v0.21.2
-	k8s.io/sample-apiserver => k8s.io/sample-apiserver v0.21.2
+	k8s.io/api => k8s.io/api v0.33.1
+	k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.33.1
+	k8s.io/apimachinery => k8s.io/apimachinery v0.33.1
+	k8s.io/apiserver => k8s.io/apiserver v0.33.1
+	k8s.io/cli-runtime => k8s.io/cli-runtime v0.33.1
+	k8s.io/client-go => k8s.io/client-go v0.33.1
+	k8s.io/cloud-provider => k8s.io/cloud-provider v0.33.1
+	k8s.io/code-generator => k8s.io/code-generator v0.33.1
+	k8s.io/component-base => k8s.io/component-base v0.33.1
+	k8s.io/cri-api => k8s.io/cri-api v0.33.1
+	k8s.io/csi-translation-lib => k8s.io/csi-translation-lib v0.33.1
+	k8s.io/kube-aggregator => k8s.io/kube-aggregator v0.33.1
+	k8s.io/kube-controller-manager => k8s.io/kube-controller-manager v0.33.1
+	k8s.io/kube-proxy => k8s.io/kube-proxy v0.33.1
+	k8s.io/kube-scheduler => k8s.io/kub
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
 github.com/census-instrumentation/opencensus-proto v0.2.1/go.mod h1:f6KPmirojxKA12rnyqOA5BBL4O983OfeGPqjHWSTneU=
-github.com/chzyer/logex v1.1.10/go.mod h1:+Ywpsq7O8HXn0nuIou7OrIPyXbp3wmkHB+jjWRnGsAI=
-github.com/chzyer/readline v0.0.0-20180603132655-2972be24d48e/go.mod h1:nSuG5e5PlCu98SY8svDHJxuZscDgtXS6KTTbou5AhLI=
-github.com/chzyer/test v0.0.0-20180213035817-a1ea475d72b1/go.mod h1:Q3SI9o4m/ZMnBNeIyt5eFwwo7qiLfzFZmjNmxjkiQlU=
 github.com/client9/misspell v0.3.4/go.mod h1:qj6jICC3Q7zFZvVWo7KLAzC3yx5G7kyvSDkc90ppPyw=
 github.com/cncf/udpa/go v0.0.0-20191209042840-269d4d468f6f/go.mod h1:M8M6+tZqaGXZJjfX53e64911xZQV5JYwmTeXPW+k8Sc=
-github.com/creack/pty v1.1.9/go.mod h1:oKZEueFk5CKHvIhNR5MUki03XCEU+Q6VDXinZuGJ33E=
 github.com/davecgh/go-spew v1.1.0/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
 github.com/davecgh/go-spew v1.1.1/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
 github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc h1:U9qPSI2PIWSS1VwoXQT9A3Wy9M
```

---

### Incident Patch 6: `caabd49f` (2026-09-22)
**Commit Message**: chore: fix the build pipeline (#5624)

* chore: fix the build pipeline

Signed-off-by: Animesh Pathak <[REDACTED_EMAIL]>

* chore: fix the build pipeline and cve

Signed-off-by: Animesh Pathak <[REDACTED_EMAIL]>

---------

Signed-off-by: Animesh Pathak <[REDACTED_EMAIL]>

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
 golang.org/x/sync v0.0.0-20190423024810-112230192c58/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20220722155255-886fb9371eb4/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
-golang.org/x/sync v0.21.0 h1:HLII4xRRTtCRkxYp4HNFF0Js/Og6q2i++KXbg0gHCwM=
-golang.org/x/sync v0.21.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/sync v0.22.0 h1:SZjpbeLmrCk4xhRSZFNZW5gFUeCeFgjekvI/+gfScek=
+golang.org/x/sync v0.22.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
 golang.org/x/sys v0.0.0-20190215142949-d0b11bdaac8a/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20201119102817-f84b799fce68/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
 golang.org/x/sys v0.0.0-20210615035016-665e8c7367d1/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.0.0-20220520151302-bc2c85ada10a/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.0.0-20220722155257-8c9f86f7a55f/go.mod h1:oPkhp1MJrh7nUe
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
 golang.org/x/xerrors v0.0.0-20191204190536-9bdfabe68543/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
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

**File**: `chaoscenter/graphql/server/go.sum` (modified, +18/-18)
```diff
@@ -1224,16 +1224,16 @@ go.opencensus.io v0.22.5/go.mod h1:5pWMHQbX5EPX2/62yrJeAkowc+lfs/XD7Uxpq3pI6kk=
 go.opencensus.io v0.23.0/go.mod h1:XItmlyltB5F7CS4xOC1DcqMoFqwtC6OG2xF7mCv7P7E=
 go.opentelemetry.io/auto/sdk v1.2.1 h1:jXsnJ4Lmnqd11kwkBV2LgLoFMZKizbCi5fNZ/ipaZ64=
 go.opentelemetry.io/auto/sdk v1.2.1/go.mod h1:KRTj+aOaElaLi+wW1kO/DZRXwkF4C5xPbEe3ZiIhN7Y=
-go.opentelemetry.io/otel v1.43.0 h1:mYIM03dnh5zfN7HautFE4ieIig9amkNANT+xcVxAj9I=
-go.opentelemetry.io/otel v1.43.0/go.mod h1:JuG+u74mvjvcm8vj8pI5XiHy1zDeoCS2LB1spIq7Ay0=
-go.opentelemetry.io/otel/metric v1.43.0 h1:d7638QeInOnuwOONPp4JAOGfbCEpYb+K6DVWvdxGzgM=
-go.opentelemetry.io/otel/metric v1.43.0/go.mod h1:RDnPtIxvqlgO8GRW18W6Z/4P462ldprJtfxHxyKd2PY=
-go.opentelemetry.io/otel/sdk v1.43.0 h1:pi5mE86i5rTeLXqoF/hhiBtUNcrAGHLKQdhg4h4V9Dg=
-go.opentelemetry.io/otel/sdk v1.43.0/go.mod h1:P+IkVU3iWukmiit/Yf9AWvpyRDlUeBaRg6Y+C58QHzg=
-go.opentelemetry.io/otel/sdk/metric v1.43.0 h1:S88dyqXjJkuBNLeMcVPRFXpRw2fuwdvfCGLEo89fDkw=
-go.opentelemetry.io/otel/sdk/metric v1.43.0/go.mod h1:C/RJtwSEJ5hzTiUz5pXF1kILHStzb9zFlIEe85bhj6A=
-go.opentelemetry.io/otel/trace v1.43.0 h1:BkNrHpup+4k4w+ZZ86CZoHHEkohws8AY+WTX09nk+3A=
-go.opentelemetry.io/otel/trace v1.43.0/go.mod h1:/QJhyVBUUswCphDVxq+8mld+AvhXZLhe+8WVFxiFff0=
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
 go.starlark.net v0.0.0-20200306205701-8dd3e2ee1dd5/go.mod h1:nmDLcffg48OtT/PSW0Hg7FvpRQsQh5OSqIylirxKC7o=
 go.uber.org/atomic v1.3.2/go.mod h1:gD2HeocX3+yG+ygLZcrzQJaqmWj9AIm7n08wl/qW/PE=
 go.uber.org/atomic v1.4.0/go.mod h1:gD2HeocX3+yG+ygLZcrzQJaqmWj9AIm7n08wl/qW/PE=
@@ -1391,8 +1391,8 @@ golang.org/x/net v0.0.0-20210525063256-abc453219eb5/go.mod h1:9nx3DQGgdP8bBQD5qx
 golang.org/x/net v0.0.0-20211015210444-4f30a5c0130f/go.mod h1:9nx3DQGgdP8bBQD5qxJ1jj9UTztislL4KSBs9R2vV5Y=
 golang.org/x/net v0.0.0-20211112202133-69e39bad7dc2/go.mod h1:9nx3DQGgdP8bBQD5qxJ1jj9UTztislL4KSBs9R2vV5Y=
 golang.org/x/net v0.0.0-20220722155237-a158d28d115b/go.mod h1:XRhObCWvk6IyKnWLug+ECip1KBveYUHfp+8e9klMJ9c=
-golang.org/x/net v0.57.0 h1:K5+3DljvIuDG9/Jv9rvyMywYNFCQ9RSUY6OOTTkT+tE=
-golang.org/x/net v0.57.0/go.mod h1:KpXc8iv+r3XplLAG/f7Jsf9RPszJzdR0f58q9vGOuEU=
+golang.org/x/net v0.58.0 h1:ynWG7rqYi4ccpTEuPZ2QGWHktVEM9DMCj9yzDE0Q7To=
+golang.org/x/net v0.58.0/go.mod h1:YwCddHnFlT7eLQqVprV19OnhLGtc5xOKgE0RyqgfWAU=
 golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.0.0-20181106182150-f42d05182288/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.0.0-20190226205417-e64efc72b421/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
@@ -1719,10 +1719,10 @@ google.golang.org/genproto v0.0.0-20210319143718-93e7006c17a6/go.mod h1:FWY/as6D
 google.golang.org/genproto v0.0.0-20210402141018-6c239bbf2bb1/go.mod h1:9lPAdzaEmUacj36I+k7YKbEc5CXzPIeORRgDAUOu28A=
 google.golang.org/genproto v0.0.0-20250603155806-513f23925822 h1:rHWScKit0gvAPuOnu87KpaYtjK5zBMLcULh7gxkCXu4=
 google.golang.org/genproto v0.0.0-20250603155806-513f23925822/go.mod h1:HubltRL7rMh0LfnQPkMH4NPDFEWp0jw3vixw7jEM53s=
-google.golang.org/genproto/googleapis/api v0.0.0-20260414002931-afd174a4e478 h1:yQugLulqltosq0B/f8l4w9VryjV+N/5gcW0jQ3N8Qec=
-google.golang.org/genproto/googleapis/api v0.0.0-20260414002931-afd174a4e478/go.mod h1:C6ADNqOxbgdUUeRTU+LCHDPB9ttAMCTff6auwCVa4uc=
-google.golang.org/genproto/googleapis/rpc v0.0.0-20260414002931-afd174a4e478 h1:RmoJA1ujG+/lRGNfUnOMfhCy5EipVMyvUE+KNbPbTlw=
-google.golang.org/genproto/googleapis/rpc v0.0.0-20260414002931-afd174a4e478/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
+google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa h1:Kjn0N0tCrDgiAFW+lGO4JZ3ck44CehvJQMAwj9QF0G8=
+google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:q4lMZS6kskjT5HvCPrnnypcDPVJqT/f4nfxmkE7gryY=
+google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa h1:mZHHdPZl0dbGHCflZgAq/Q468DWVFcU2whhB2KAo8fk=
+google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+D
```

**File**: `chaoscenter/subscriber/go.mod` (modified, +8/-10)
```diff
@@ -42,16 +42,16 @@ require (
 	github.com/modern-go/reflect2 v1.0.2 // indirect
 	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
 	github.com/spf13/pflag v1.0.6 // indirect
-	golang.org/x/net v0.56.0 // indirect
-	golang.org/x/oauth2 v0.35.0 // indirect
-	golang.org/x/sys v0.46.0 // indirect
-	golang.org/x/term v0.44.0 // indirect
-	golang.org/x/text v0.38.0 // indirect
+	golang.org/x/net v0.58.0 // indirect
+	golang.org/x/oauth2 v0.36.0 // indirect
+	golang.org/x/sys v0.47.0 // indirect
+	golang.org/x/term v0.45.0 // indirect
+	golang.org/x/text v0.41.0 // indirect
 	golang.org/x/time v0.11.0 // indirect
 	google.golang.org/genproto v0.0.0-20250603155806-513f23925822 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260401024825-9d38bb4040a9 // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260401024825-9d38bb4040a9 // indirect
-	google.golang.org/grpc v1.80.0 // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	google.golang.org/grpc v1.83.2 // indirect
 	google.golang.org/protobuf v1.36.11 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	gopkg.in/yaml.v3 v3.0.1 // indirect
@@ -69,8 +69,6 @@ replace (
 	github.com/docker/docker => github.com/moby/moby v0.7.3-0.20190826074503-38ab9da00309
 
 	github.com/emicklei/go-restful => github.com/emicklei/go-restful v2.16.0+incompatible
-
-	golang.org/x/text => golang.org/x/text v0.3.8
 	k8s.io/api => k8s.io/api v0.21.2
 	k8s.io/apiextensions-apiserver => k8s.io/apiextensions-apiserver v0.21.2
 	k8s.io/apimachinery => k8s.io/apimachinery v0.21.2
```

**File**: `chaoscenter/subscriber/go.sum` (modified, +25/-29)
```diff
@@ -255,7 +255,6 @@ github.com/stretchr/testify v1.11.1/go.mod h1:wZwfW3scLgRK+23gO65QZefKpKQRnfz6sD
 github.com/yuin/goldmark v1.1.27/go.mod h1:3hX8gzYuyVAZsxl0MRgGTJEmQBFcNTphYh9decYSb74=
 github.com/yuin/goldmark v1.2.1/go.mod h1:3hX8gzYuyVAZsxl0MRgGTJEmQBFcNTphYh9decYSb74=
 github.com/yuin/goldmark v1.3.5/go.mod h1:mwnBkeHKe2W/ZEtQ+71ViKU8L12m81fl3OWwC1Zlc8k=
-github.com/yuin/goldmark v1.4.13/go.mod h1:6yULJ656Px+3vBD8DxQVa3kxgyrAnzto9xy5taEt/CY=
 go.opencensus.io v0.21.0/go.mod h1:mSImk1erAIZhrmZN+AvHh14ztQfjbGwt4TtuofqLduU=
 go.opencensus.io v0.22.0/go.mod h1:+kGneAE2xo2IficOXnaByMWTGM9T73dGwxeWcUqIpI8=
 go.opencensus.io v0.22.2/go.mod h1:yxeiOL68Rb0Xd1ddK5vPZ/oVn4vY4Ynel7k9FzqtOIw=
@@ -268,7 +267,6 @@ golang.org/x/crypto v0.0.0-20191011191535-87dc89f01550/go.mod h1:yigFU9vqHzYiE8U
 golang.org/x/crypto v0.0.0-20200622213623-75b288015ac9/go.mod h1:LzIPMQfyMNhhGPhUkYOs5KpL4U8rLKemX1yGLhDgUto=
 golang.org/x/crypto v0.0.0-20201002170205-7f63de1d35b0/go.mod h1:LzIPMQfyMNhhGPhUkYOs5KpL4U8rLKemX1yGLhDgUto=
 golang.org/x/crypto v0.0.0-20210220033148-5ea612d1eb83/go.mod h1:jdWPYTVW3xRLrWPugEBEK3UY2ZEsg3UU495nc5E+M+I=
-golang.org/x/crypto v0.0.0-20210921155107-089bfa567519/go.mod h1:GvvjBRRGRdwPK5ydBHafDWAxML/pGHZbMvKqRZ5+Abc=
 golang.org/x/exp v0.0.0-20190121172915-509febef88a4/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20190306152737-a1d7652674e8/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/exp v0.0.0-20190510132918-efd6b22b2522/go.mod h1:ZjyILWgesfNpC6sMxTJOJm9Kp84zZh5NQWvqDGG3Qr8=
@@ -300,7 +298,6 @@ golang.org/x/mod v0.1.1-0.20191107180719-034126e5016b/go.mod h1:QqPTAvyqsEbceGzB
 golang.org/x/mod v0.2.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.3.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.4.2/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
-golang.org/x/mod v0.6.0-dev.0.20220419223038-86c51ed26bb4/go.mod h1:jJ57K6gSWd91VN4djpZkiMVwK6gcyfeH4XE8wZrZaV4=
 golang.org/x/net v0.0.0-20180724234803-3673e40ba225/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20180826012351-8a410e7b638d/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20180906233101-161cd47e91fd/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
@@ -325,18 +322,16 @@ golang.org/x/net v0.0.0-20200324143707-d3edc9973b7e/go.mod h1:qpuaurCH72eLCgpAm/
 golang.org/x/net v0.0.0-20200822124328-c89045814202/go.mod h1:/O7V0waA8r7cgGh81Ro3o1hOxt32SMVPicZroKQ2sZA=
 golang.org/x/net v0.0.0-20201021035429-f5854403a974/go.mod h1:sp8m0HH+o8qH0wwXwYZr8TS3Oi6o0r6Gce1SSxlDquU=
 golang.org/x/net v0.0.0-20210224082022-3d97a244fca7/go.mod h1:m0MpNAwzfU5UDzcl9v0D8zg8gWTRqZa9RBIspLL5mdg=
-golang.org/x/net v0.0.0-20210226172049-e18ecbb05110/go.mod h1:m0MpNAwzfU5UDzcl9v0D8zg8gWTRqZa9RBIspLL5mdg=
 golang.org/x/net v0.0.0-20210405180319-a5a99cb37ef4/go.mod h1:p54w0d4576C0XHj96bSt6lcn1PtDYWL6XObtHCRCNQM=
-golang.org/x/net v0.0.0-20220722155237-a158d28d115b/go.mod h1:XRhObCWvk6IyKnWLug+ECip1KBveYUHfp+8e9klMJ9c=
-golang.org/x/net v0.56.0 h1:Rw8j/hFzGvJUZwNBXnAtf5sVDVt+65SK2C7IxCxZt5o=
-golang.org/x/net v0.56.0/go.mod h1:D3Ku6r+V6JROoZK144D2XfMHFcMq/0zSfLelVTCFKec=
+golang.org/x/net v0.58.0 h1:ynWG7rqYi4ccpTEuPZ2QGWHktVEM9DMCj9yzDE0Q7To=
+golang.org/x/net v0.58.0/go.mod h1:YwCddHnFlT7eLQqVprV19OnhLGtc5xOKgE0RyqgfWAU=
 golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.0.0-20190226205417-e64efc72b421/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
 golang.org/x/oauth2 v0.0.0-20190604053449-0f29369cfe45/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
 golang.org/x/oauth2 v0.0.0-20191202225959-858c2ad4c8b6/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
 golang.org/x/oauth2 v0.0.0-20200107190931-bf48bf16ab8d/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=
-golang.org/x/oauth2 v0.35.0 h1:Mv2mzuHuZuY2+bkyWXIHMfhNdJAdwW3FuWeCPYN5GVQ=
-golang.org/x/oauth2 v0.35.0/go.mod h1:lzm5WQJQwKZ3nwavOZ3IS5Aulzxi68dUSgRHujetwEA=
+golang.org/x/oauth2 v0.36.0 h1:peZ/1z27fi9hUOFCAZaHyrpWG5lwe0RJEEEeH0ThlIs=
+golang.org/x/oauth2 v0.36.0/go.mod h1:YDBUJMTkDnJS+A4BP4eZBjCqtokkg1hODuPjwiGPO7Q=
 golang.org/x/sync v0.0.0-20180314180146-1d60e4601c6f/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20181108010431-42b317875d0f/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20181221193216-37e7f081c4d4/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
@@ -345,7 +340,6 @@ golang.org/x/sync v0.0.0-20190423024810-112230192c58/go.mod h1:RxMgew5VJxzue5/jJ
 golang.org/x/sync v0.0.0-20190911185100-cd5d95a43a6e/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20201020160332-67f06af15bc9/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20210220032951-036812b2e83c/go.mod h1:RxMgew
```

---

### Incident Patch 7: `d848e23e` (2026-09-21)
**Commit Message**: fix(subscriber): resolve adminModeNamespace for chaos engine probe check (#5617)

In LitmusChaos workflows where adminMode is enabled, the raw step manifest retains the unrendered Argo template placeholder '{{workflow.parameters.adminModeNamespace}}'. During execution event processing, CheckChaosData queried GetChaosEngine using this literal placeholder as the namespace, which failed to find the ChaosEngine CR. Consequently, probe execution history fell back to reporting SOT even when probes were configured in EOT mode.

This commit resolves the adminModeNamespace from the workflow's parameter arguments with a fallback to the workflow namespace, ensuring CheckChaosData queries the ChaosEngine in its actual deployed namespace.

Fixes #5603

Signed-off-by: mimo-to <[REDACTED_EMAIL]>
Co-authored-by: Shubham Chaudhary <[REDACTED_EMAIL]>

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
+			name:       "empty parameters slice falls back",
+			params:     []v1alpha1.Parameter{},
+			fallbackNS: "litmus",
+			expected:   "litmus",
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			result := getAdminModeNamespace(tt.params, tt.fallbackNS)
+			assert.Equal(t, tt.expected, result)
+		})
+	}
+}
+
+func TestCheckChaosData_PendingPhase(t *testing.T) {
+	ev := &subscriberEvents{}
+	nodeStatus := v1alpha1.NodeStatus{
+		Type:  v1alpha1.NodeTypePod,
+		Phase: v1alpha1.NodePending,
+		Inputs: &v1alpha1.Inputs{
+			Artifacts: []v1alpha1.Artifact{
+				{
+					ArtifactLocation: v1alpha1.ArtifactLocation{
+						Raw: &v1alpha1.RawArtifact{
+							Data: `
+apiVersion: litmuschaos.io/v1alpha1
+kind: ChaosEngine
+metadata:
+  name: engine-sample
+  namespace: "{{workflow.parameters.adminModeNamespace}}"
+`,
+						},
+					},
+				},
+			},
+		},
+	}
+
+	nodeType, cd, err := ev.CheckChaosData(nodeStatus, "litmus", "custom-ns", nil)
+	assert.NoError(t, err)
+	assert.Equal(t, "ChaosEngine", no
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

Signed-off-by: Aryanbhargava18 <[REDACTED_EMAIL]>

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

Signed-off-by: VarshaUN <[REDACTED_EMAIL]>

* add range validation and rename

Signed-off-by: VarshaUN <[REDACTED_EMAIL]>

* Potential fix for pull request finding

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>
Signed-off-by: Varsha U N <[REDACTED_EMAIL]>

* fix CI errors

Signed-off-by: VarshaUN <[REDACTED_EMAIL]>

* fix CI errors

Signed-off-by: VarshaUN <[REDACTED_EMAIL]>

* fix ci errors

Signed-off-by: VarshaUN <[REDACTED_EMAIL]>

* fix ci errors

Signed-off-by: VarshaUN <[REDACTED_EMAIL]>

---------

Signed-off-by: VarshaUN <[REDACTED_EMAIL]>
Signed-off-by: Varsha U N <[REDACTED_EMAIL]>
Co-authored-by: Pritesh Kiri <[REDACTED_EMAIL]>
Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

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
 golang.org/x/term v0.0.0-20201117132131-f5c789dd3221/go.mod h1:Nr5EML6q2oocZ2LXRh80K7BxOlk5/8JxuGnuhpl+muw=
 golang.org/x/term v0.0.0-20201126162022-7de9c90e9dd1/go.mod h1:bj7SfCRtBDWHUb9snDiAeCFNEtKQo2Wmx5Cou7ajbmo=
 golang.org/x/term v0.0.0-20210220032956-6a3ed077a48d/go.mod h1:bj7SfCRtBDWHUb9snDiAeCFNEtKQo2Wmx5Cou7ajbmo=
 golang.org/x/term v0.0.0-20210927222741-03fcf44c2211/go.mod h1:jbD1KX2456YbFQfuXm/mYQcufACuNUgVhRMnK/tPxf8=
-golang.org/x/term v0.44.0 h1:0rLvDRCtNj0gZkyIXhCyOb2OAzEhLVqc4B+hrsBhrmc=
-golang.org/x/term v0.44.0/go.mod h1:7ze4MdzUzLXpSAoFP1H0bOI9aXDqveSvatT5vKcFh2Y=
+golang.org/x/term v0.45.0 h1:NwWyBmoJCbfTHpxrWoZ9C6/VxOf7ic219I8xZZFdrf0=
+golang.org/x/term v0.45.0/go.mod h1:9aqxs0blBcrm/n0L9QW0aRVD+ktan8ssZromtqJC43w=
 golang.org/x/text v0.0.0-20160726164857-2910a502d2bf/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=
 golang.org/x/text v0.0.0-20170915032832-14c0d48ead0c/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=
 golang.org/x/text v0.0.0-20170915090833-1cbadb444a80/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7
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

Signed-off-by: Nayyar <[REDACTED_EMAIL]>

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
+		t.Run(tt.name, func(t *testing.T) {
+			provider := newTestOIDCProvider(t, clientID, tt.claims)
+
+			utils.OAuthOIDCIssuer = provider.URL
+			utils.OAuthClientID = clientID
+			utils.OAuthClientSecret = "test-client-secret"
+			utils.OAuthCallBackURL = "http://localhost:3000/oauth/callback"
+			utils.OAuthJwtSecret = "test-oauth-state-secret"
+
+			state, err := utils.GenerateOAuthJWT()
+			assert.NoError(t, err)
+
+			service := new(mocks.MockedApplicationService)
+			service.On("LoginUser", mock.Anything).Return(&entities.User{
+				ID:       "victim-user-id",
+				Username: "victim@litmus.test",
+				Email:    "victim@litmus.test",
+			}, nil)
+			service.On("GetConfig", "salt").Return(&authConfig.AuthConfig{Value: "salt"}, nil)
+			service.On("GetSignedJWT", mock.Anything, mock.Anything).Return("victim-session-token", nil)
+			service.On("GetOwnerProjectIDs", mock.Anything, mock.Anything).
+				Return([]*entities.Project{{ID: "victim-project"}}, nil)
+
+			w := httptest.NewRecorder()
+			c
```

---

### Incident Patch 11: `13aa3f0b` (2026-08-25)
**Commit Message**: fix(subscriber): handle all errors in IsAgentConfirmed to prevent nil pointer panic (#5563)

* fix(subscriber): handle all errors in IsAgentConfirmed to prevent nil pointer panic

The IsAgentConfirmed function in chaoscenter/subscriber/pkg/k8s/operations.go
only checked for IsNotFound errors from the ConfigMap Get call. Any other error
(e.g. API server timeout, network issue, missing RBAC) left getCM as nil, and
the subsequent getCM.Data access caused a nil pointer dereference panic.

Additionally, the error check after the Secret Get call was dead code — the
previous if/else block already returned on any error, making the IsNotFound
check unreachable.

Fix:
- Check err != nil first before accessing getCM
- Handle IsNotFound as a special case within the error check
- Return all other errors (timeouts, RBAC, etc.) instead of panicking
- Remove the dead IsNotFound check after Secret Get
- Use fmt.Errorf with %w for better error wrapping

Fixes #5559

Signed-off-by: Arunesh Dwivedi <[REDACTED_EMAIL]>

* test: add unit tests for IsAgentConfirmed error handling

Covers non-NotFound ConfigMap errors (returns raw error, no panic),
NotFound Path (returns descriptive error), and Secret fetc

**File**: `chaoscenter/subscriber/pkg/k8s/agent_confirm_test.go` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+package k8s
+
+import (
+	"fmt"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/client-go/kubernetes/fake"
+	core "k8s.io/client-go/testing"
+)
+
+func TestIsAgentConfirmed_ConfigMapNotFound(t *testing.T) {
+	fakeClient := fake.NewSimpleClientset()
+	confirmed, _, err := isAgentConfirmedWithClientset(fakeClient)
+	assert.False(t, confirmed, "should not be confirmed when configmap missing")
+	assert.Contains(t, err.Error(), "configmap not found")
+}
+
+func TestIsAgentConfirmed_NonNotFoundError(t *testing.T) {
+	fakeClient := fake.NewSimpleClientset()
+	fakeClient.PrependReactor("get", "configmaps", func(action core.Action) (bool, runtime.Object, error) {
+		return true, nil, fmt.Errorf("connection refused")
+	})
+	confirmed, _, err := isAgentConfirmedWithClientset(fakeClient)
+	assert.False(t, confirmed, "should not be confirmed on non-NotFound errors")
+	assert.Contains(t, err.Error(), "connection refused")
+}
+
+func TestIsAgentConfirmed_SecretFetchError(t *testing.T) {
+	fakeClient := fake.NewSimpleClientset()
+	fakeClient.PrependReactor("get", "configmaps", func(action core.Action) (bool, runtime.Object, error) {
+		return true, &corev1.ConfigMap{
+			ObjectMeta: metav1.ObjectMeta{Name: InfraConfigName, Namespace: InfraNamespace},
+			Data:       map[string]string{"IS_INFRA_CONFIRMED": "true"},
+		}, nil
+	})
+	fakeClient.PrependReactor("get", "secrets", func(action core.Action) (bool, runtime.Object, error) {
+		return true, nil, fmt.Errorf("forbidden")
+	})
+	confirmed, _, err := isAgentConfirmedWithClientset(fakeClient)
+	assert.False(t, confirmed, "should not be confirmed when secret fetch fails")
+	assert.Contains(t, err.Error(), "failed to get")
+	assert.Contains(t, err.Error(), "forbidden")
+}
```

**File**: `chaoscenter/subscriber/pkg/k8s/operations.go` (modified, +12/-10)
```diff
@@ -132,23 +132,25 @@ func (k8s *k8sSubscriber) IsAgentConfirmed() (bool, string, error) {
 	if err != nil {
 		return false, "", err
 	}
+	return isAgentConfirmedWithClientset(clientset)
+}
 
+func isAgentConfirmedWithClientset(clientset kubernetes.Interface) (bool, string, error) {
 	getCM, err := clientset.CoreV1().ConfigMaps(InfraNamespace).Get(context.TODO(), InfraConfigName, metav1.GetOptions{})
-	if k8s_errors.IsNotFound(err) {
-		return false, "", errors.New(InfraConfigName + " configmap not found")
-	} else if getCM.Data["IS_INFRA_CONFIRMED"] == "true" {
-		getSecret, err := clientset.CoreV1().Secrets(InfraNamespace).Get(context.TODO(), InfraSecretName, metav1.GetOptions{})
-		if err != nil {
-			return false, "", errors.New(InfraSecretName + " secret not found")
+	if err != nil {
+		if k8s_errors.IsNotFound(err) {
+			return false, "", errors.New(InfraConfigName + " configmap not found")
 		}
+		return false, "", err
+	}
 
-		if k8s_errors.IsNotFound(err) {
-			return false, "", err
+	if getCM.Data["IS_INFRA_CONFIRMED"] == "true" {
+		getSecret, err := clientset.CoreV1().Secrets(InfraNamespace).Get(context.TODO(), InfraSecretName, metav1.GetOptions{})
+		if err != nil {
+			return false, "", fmt.Errorf("failed to get %s secret: %w", InfraSecretName, err)
 		}
 
 		return true, string(getSecret.Data["ACCESS_KEY"]), nil
-	} else if err != nil {
-		return false, "", err
 	}
 
 	return false, "", nil
```

---

### Incident Patch 12: `743d526e` (2026-08-25)
**Commit Message**: fix(web): fetch infrastructure details by ID during experiment edit to prevent empty field (#5580)

Signed-off-by: Kayd-06 <[REDACTED_EMAIL]>
Co-authored-by: Pritesh Kiri <[REDACTED_EMAIL]>

**File**: `chaoscenter/web/src/api/core/infrastructures/getKubernetesChaosInfrastructureDetails.ts` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+import { gql, useQuery } from '@apollo/client';
+import type { KubernetesChaosInfrastructure } from '../../entities';
+import type { GqlAPIQueryRequest, GqlAPIQueryResponse } from '../../types';
+
+export interface GetKubernetesChaosInfrastructureDetailsRequest {
+  infraID: string;
+  projectID: string;
+}
+
+export interface GetKubernetesChaosInfrastructureDetailsResponse {
+  getInfraDetails: KubernetesChaosInfrastructure;
+}
+
+export const getChaosInfraDetails = ({
+  infraID,
+  options = {},
+  projectID
+}: GqlAPIQueryRequest<
+  GetKubernetesChaosInfrastructureDetailsResponse,
+  GetKubernetesChaosInfrastructureDetailsRequest,
+  Omit<GetKubernetesChaosInfrastructureDetailsRequest, 'projectID'>
+>): GqlAPIQueryResponse<
+  GetKubernetesChaosInfrastructureDetailsResponse,
+  GetKubernetesChaosInfrastructureDetailsRequest
+> => {
+  const { data, loading, ...rest } = useQuery<
+    GetKubernetesChaosInfrastructureDetailsResponse,
+    GetKubernetesChaosInfrastructureDetailsRequest
+  >(
+    gql`
+      query getInfraDetails($projectID: ID!, $infraID: ID!) {
+        getInfraDetails(projectID: $projectID, infraID: $infraID) {
+          infraID
+          name
+          environmentID
+          description
+          platformName
+          isActive
+          isInfraConfirmed
+          updatedAt
+          createdAt
+          noOfExperiments
+          noOfExperimentRuns
+          lastExperimentTimestamp
+          infraNamespace
+          serviceAccount
+          infraScope
+          startTime
+          version
+          tags
+          updateStatus
+        }
+      }
+    `,
+    {
+      ...options,
+      fetchPolicy: options.fetchPolicy ?? 'cache-and-network',
+      variables: { infraID, projectID }
+    }
+  );
+  return {
+    data,
+    exists: (options as { skip?: boolean }).skip ? undefined : Boolean(data?.getInfraDetails),
+    loading: (options as { skip?: boolean }).skip ? false : loading || !data,
+    ...rest
+  };
+};
```

**File**: `chaoscenter/web/src/api/core/infrastructures/index.ts` (modified, +1/-0)
```diff
@@ -4,3 +4,4 @@ export * from './testKubernetesChaosInfrastructureConnection';
 export * from './getVersionDetails';
 export * from './listKubernetesChaosInfrastructure';
 export * from './getKubeObject';
+export * from './getKubernetesChaosInfrastructureDetails';
```

**File**: `chaoscenter/web/src/controllers/KubernetesChaosInfrastructureReferenceField/KubernetesChaosInfrastructureReferenceField.tsx` (modified, +14/-6)
```diff
@@ -1,6 +1,6 @@
 import { Pagination, useToaster } from '@harnessio/uicore';
 import React from 'react';
-import { listChaosInfra } from '@api/core';
+import { getChaosInfraDetails, listChaosInfra } from '@api/core';
 import { getScope } from '@utils';
 import ChaosInfrastructureReferenceFieldView from '@views/ChaosInfrastructureReferenceField';
 import { AllEnv, type ChaosInfrastructureReferenceFieldProps } from '@models';
@@ -28,6 +28,15 @@ function KubernetesChaosInfrastructureReferenceFieldController({
     options: { onError: error => showError(error.message) }
   });
 
+  const { data: getChaosInfraDetailsData, loading: getChaosInfraDetailsLoading } = getChaosInfraDetails({
+    ...scope,
+    infraID: initialInfrastructureID ?? '',
+    options: {
+      onError: error => showError(error.message),
+      skip: !initialInfrastructureID
+    }
+  });
+
   const { data: listEnvironmentData } = listEnvironment({
     ...scope,
     options: {
@@ -47,10 +56,9 @@ function KubernetesChaosInfrastructureReferenceFieldController({
     ({ environmentID }) => environmentID === initialEnvironmentID
   );
 
-  // TODO: replace with get API as this becomes empty during edit
-  const preSelectedInfrastructure = listChaosInfraData?.listInfras.infras.find(
-    ({ infraID }) => infraID === initialInfrastructureID
-  );
+  const preSelectedInfrastructure =
+    getChaosInfraDetailsData?.getInfraDetails ||
+    listChaosInfraData?.listInfras.infras.find(({ infraID }) => infraID === initialInfrastructureID);
 
   const preSelectedInfrastructureDetails: InfrastructureDetails | undefined = preSelectedInfrastructure && {
     id: preSelectedInfrastructure?.infraID,
@@ -129,7 +137,7 @@ function KubernetesChaosInfrastructureReferenceFieldController({
       envID={envID}
       setEnvID={setEnvID}
       loading={{
-        listChaosInfra: listChaosInfraLoading
+        listChaosInfra: listChaosInfraLoading || getChaosInfraDetailsLoading
       }}
       pagination={<PaginationComponent />}
     />
```

**File**: `chaoscenter/web/src/views/ChaosInfrastructureReferenceField/ChaosInfrastructureReferenceField.tsx` (modified, +6/-0)
```diff
@@ -74,6 +74,12 @@ function ChaosInfrastructureReferenceFieldView({
   const { showError } = useToaster();
   const { getString } = useStrings();
 
+  React.useEffect(() => {
+    if (preSelectedInfrastructure && !selectedInfrastructure) {
+      setSelectedInfrastructure(preSelectedInfrastructure);
+    }
+  }, [preSelectedInfrastructure, selectedInfrastructure]);
+
   const EnvListItem = ({ envDetail }: { envDetail: EnvironmentDetail }): JSX.Element => {
     return (
       <Container
```

---

### Incident Patch 13: `9231768c` (2026-08-25)
**Commit Message**: fix: default image registry repo to prevent undefined image paths on fault edit (#5583)

Signed-off-by: yashgoyal0110 <[REDACTED_EMAIL]>
Co-authored-by: Pritesh Kiri <[REDACTED_EMAIL]>

**File**: `chaoscenter/web/src/services/experiment/KubernetesYamlService.ts` (modified, +7/-1)
```diff
@@ -1181,8 +1181,14 @@ function updateContainerImage(image: string, registry: ImageRegistry | undefined
   const parts = image.split('/');
   const lastPart = parts[parts.length - 1]; // litmus-checker:2.11.0
 
+  // Fall back to the default registry repo when it is missing (e.g. when the
+  // experiment is edited directly from the Builder tab without visiting the
+  // Overview tab). Otherwise the repo resolves to the literal string
+  // "undefined", producing broken images like "undefined/go-runner:3.27.0".
+  const repo = registry?.repo || 'litmuschaos';
+
   // Build new image
-  const newImage = `${registry?.repo}/${lastPart}`;
+  const newImage = `${repo}/${lastPart}`;
 
   return newImage;
 }
```

---

### Incident Patch 14: `64afe2a5` (2026-08-25)
**Commit Message**: fix: add resource limits and securityContext to metrics-exporters demo manifests (#5599)

Motivation:
Issue #5202 flagged that the chaos-exporter and mysqld-exporter demo
manifests under monitoring/utils/ ran without CPU/memory limits and
without a securityContext (runAsUser/runAsNonRoot/readOnlyRootFilesystem),
letting Kubernetes fall back to defaults. PR #5203 already fixed this for
the same two exporters plus grafana under
monitoring/utils/metrics-exporters-with-service-monitors/, but the
parallel monitoring/utils/metrics-exporters/ directory (a separately
documented setup in monitoring/utils/README.md, without service
monitors) contains byte-identical pre-fix manifests for chaos-exporter
and mysqld-exporter that were missed by that PR.

As noted by a maintainer on the issue, these are demo/reference
manifests external to ChaosCenter/LitmusChaos operations, not a
production attack surface, so this is a hardening/consistency fix
rather than a fix for an exploitable production vulnerability.

Approach:
Apply the identical resources/securityContext block already reviewed
and merged in #5203 to the two remaining manifests:
- monitoring/utils/metrics-exporters/litmus-metrics/chaos-ex

**File**: `monitoring/utils/metrics-exporters/litmus-metrics/chaos-exporter/chaos-exporter.yaml` (modified, +11/-0)
```diff
@@ -28,6 +28,17 @@ spec:
           env:
             - name: TSDB_SCRAPE_INTERVAL
               value: '10'
+          resources:
+            requests:
+              memory: "256Mi"
+              cpu: "250m"
+            limits:
+              memory: "512Mi"
+              cpu: "500m"
+          securityContext:
+            runAsUser: 1000
+            runAsNonRoot: true
+            readOnlyRootFilesystem: true
           # uncomment the following lines to use the litmuschaos exporter for monitoring the chaos events and chaosresults for a selected namespace
           # - name: WATCH_NAMESPACE
           #   value: 'litmus'
```

**File**: `monitoring/utils/metrics-exporters/mysqld-exporter/deployment.yaml` (modified, +11/-0)
```diff
@@ -31,6 +31,17 @@ spec:
             - '--collect.engine_innodb_status'
             - '--collect.slave_hosts'
           name: mysql-exporter
+          resources:
+            requests:
+              memory: "256Mi"
+              cpu: "250m"
+            limits:
+              memory: "512Mi"
+              cpu: "500m"
+          securityContext:
+            runAsUser: 1000
+            runAsNonRoot: true
+            readOnlyRootFilesystem: true
           ports:
             - containerPort: 9104
               name: mysql-metrics
```

---

### Incident Patch 15: `143ebbeb` (2026-08-25)
**Commit Message**: Fix 504 timeout: Add K8s client caching + QPS increase + benchmarks (#5430)

* Fix 504 timeout: Add K8s client caching + QPS increase + benchmarks

Signed-off-by: shovan-mondal <[REDACTED_EMAIL]>

* Fix Go formatting in parallel_benchmark_test.go

Signed-off-by: shovan-mondal <[REDACTED_EMAIL]>

* Make K8s client QPS/Burst/Timeout configurable via env variables

Signed-off-by: shovan-mondal <[REDACTED_EMAIL]>

* Upgrade golang and base image to resolve CVEs

Signed-off-by: shovan-mondal <[REDACTED_EMAIL]>

* Updated Go versions

Signed-off-by: shovan-mondal <[REDACTED_EMAIL]>

* Fix CVEs in graphql-server,subscriber,authentication,dex-server

Signed-off-by: shovan-mondal <[REDACTED_EMAIL]>

* Update k8s.io dependencies to resolve protobuf namespace collision

Signed-off-by: shovan-mondal <[REDACTED_EMAIL]>

* Update base image to RedHat UBI 10.1

Signed-off-by: Shovan Mondal <[REDACTED_EMAIL]>

---------

Signed-off-by: shovan-mondal <[REDACTED_EMAIL]>
Signed-off-by: Shovan Mondal <[REDACTED_EMAIL]>
Co-authored-by: Pritesh Kiri <[REDACTED_EMAIL]>
Co-authored-by: Shubham Chaudhary <[REDACTED_EMAIL]>

**File**: `chaoscenter/authentication/go.mod` (modified, +5/-5)
```diff
@@ -12,7 +12,7 @@ require (
 	github.com/sirupsen/logrus v1.9.4
 	github.com/stretchr/testify v1.11.1
 	go.mongodb.org/mongo-driver v1.17.9
-	golang.org/x/crypto v0.52.0
+	golang.org/x/crypto v0.53.0
 	golang.org/x/oauth2 v0.36.0
 	google.golang.org/grpc v1.80.0
 	google.golang.org/protobuf v1.36.11
@@ -57,10 +57,10 @@ require (
 	go.opentelemetry.io/otel v1.42.0 // indirect
 	go.opentelemetry.io/otel/sdk/metric v1.42.0 // indirect
 	golang.org/x/arch v0.25.0 // indirect
-	golang.org/x/net v0.55.0 // indirect
-	golang.org/x/sync v0.20.0 // indirect
-	golang.org/x/sys v0.45.0 // indirect
-	golang.org/x/text v0.37.0 // indirect
+	golang.org/x/net v0.56.0 // indirect
+	golang.org/x/sync v0.21.0 // indirect
+	golang.org/x/sys v0.46.0 // indirect
+	golang.org/x/text v0.38.0 // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260319201613-d00831a3d3e7 // indirect
 	gopkg.in/yaml.v3 v3.0.1 // indirect
 )
```

**File**: `chaoscenter/authentication/go.sum` (modified, +10/-10)
```diff
@@ -133,36 +133,36 @@ golang.org/x/arch v0.25.0 h1:qnk6Ksugpi5Bz32947rkUgDt9/s5qvqDPl/gBKdMJLE=
 golang.org/x/arch v0.25.0/go.mod h1:0X+GdSIP+kL5wPmpK7sdkEVTt2XoYP0cSjQSbZBwOi8=
 golang.org/x/crypto v0.0.0-20190308221718-c2843e01d9a2/go.mod h1:djNgcEr1/C05ACkg1iLfiJU5Ep61QUkGW8qpdssI0+w=
 golang.org/x/crypto v0.0.0-20210921155107-089bfa567519/go.mod h1:GvvjBRRGRdwPK5ydBHafDWAxML/pGHZbMvKqRZ5+Abc=
-golang.org/x/crypto v0.52.0 h1:RMs7fP2rXdep0CftQlK8Uf+kibLm7qkCcradZWYz988=
-golang.org/x/crypto v0.52.0/go.mod h1:1QgfPxDqh0T2M/elOJtp9RvuR95kVjir0e6/BvEmGbc=
+golang.org/x/crypto v0.53.0 h1:QZ4Muo8THX6CizN2vPPd5fBGHyogrdK9fG4wLPFUsto=
+golang.org/x/crypto v0.53.0/go.mod h1:DNLU434OwVakk9PzuwV8w62mAJpRJL3vsgcfp4Qnsio=
 golang.org/x/mod v0.6.0-dev.0.20220419223038-86c51ed26bb4/go.mod h1:jJ57K6gSWd91VN4djpZkiMVwK6gcyfeH4XE8wZrZaV4=
 golang.org/x/net v0.0.0-20190620200207-3b0461eec859/go.mod h1:z5CRVTTTmAJ677TzLLGU+0bjPO0LkuOLi4/5GtJWs/s=
 golang.org/x/net v0.0.0-20210226172049-e18ecbb05110/go.mod h1:m0MpNAwzfU5UDzcl9v0D8zg8gWTRqZa9RBIspLL5mdg=
 golang.org/x/net v0.0.0-20220722155237-a158d28d115b/go.mod h1:XRhObCWvk6IyKnWLug+ECip1KBveYUHfp+8e9klMJ9c=
-golang.org/x/net v0.55.0 h1:bcvxaJn3e1U6InsFWt1JUq1aSjnRxLzT2rtD2KfkDF8=
-golang.org/x/net v0.55.0/go.mod h1:L5U2KuzuOe1lY7Z+aWVIKK6qEeJXnXV9yzGA+WCHJww=
+golang.org/x/net v0.56.0 h1:Rw8j/hFzGvJUZwNBXnAtf5sVDVt+65SK2C7IxCxZt5o=
+golang.org/x/net v0.56.0/go.mod h1:D3Ku6r+V6JROoZK144D2XfMHFcMq/0zSfLelVTCFKec=
 golang.org/x/oauth2 v0.36.0 h1:peZ/1z27fi9hUOFCAZaHyrpWG5lwe0RJEEEeH0ThlIs=
 golang.org/x/oauth2 v0.36.0/go.mod h1:YDBUJMTkDnJS+A4BP4eZBjCqtokkg1hODuPjwiGPO7Q=
 golang.org/x/sync v0.0.0-20190423024810-112230192c58/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20220722155255-886fb9371eb4/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
-golang.org/x/sync v0.20.0 h1:e0PTpb7pjO8GAtTs2dQ6jYa5BWYlMuX047Dco/pItO4=
-golang.org/x/sync v0.20.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/sync v0.21.0 h1:HLII4xRRTtCRkxYp4HNFF0Js/Og6q2i++KXbg0gHCwM=
+golang.org/x/sync v0.21.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
 golang.org/x/sys v0.0.0-20190215142949-d0b11bdaac8a/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20201119102817-f84b799fce68/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
 golang.org/x/sys v0.0.0-20210615035016-665e8c7367d1/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.0.0-20220520151302-bc2c85ada10a/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.0.0-20220722155257-8c9f86f7a55f/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.6.0/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
-golang.org/x/sys v0.45.0 h1:dO4czNzziLiiXplLQgBCEpCvXQ3dnkn0SdaZSYdQ+FY=
-golang.org/x/sys v0.45.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
+golang.org/x/sys v0.46.0 h1:noSf2Fq6F8DBgS+LysIkx7rIExoNHJsxOAtPp4rthXw=
+golang.org/x/sys v0.46.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
 golang.org/x/term v0.0.0-20201126162022-7de9c90e9dd1/go.mod h1:bj7SfCRtBDWHUb9snDiAeCFNEtKQo2Wmx5Cou7ajbmo=
 golang.org/x/term v0.0.0-20210927222741-03fcf44c2211/go.mod h1:jbD1KX2456YbFQfuXm/mYQcufACuNUgVhRMnK/tPxf8=
 golang.org/x/text v0.3.0/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=
 golang.org/x/text v0.3.3/go.mod h1:5Zoc/QRtKVWzQhOtBMvqHzDpF6irO9z98xDceosuGiQ=
 golang.org/x/text v0.3.7/go.mod h1:u+2+/6zg+i71rQMx5EYifcz6MCKuco9NR6JIITiCfzQ=
 golang.org/x/text v0.3.8/go.mod h1:E6s5w1FMmriuDzIBO73fBruAKo1PCIq6d2Q6DHfQ8WQ=
-golang.org/x/text v0.37.0 h1:Cqjiwd9eSg8e0QAkyCaQTNHFIIzWtidPahFWR83rTrc=
-golang.org/x/text v0.37.0/go.mod h1:a5sjxXGs9hsn/AJVwuElvCAo9v8QYLzvavO5z2PiM38=
+golang.org/x/text v0.38.0 h1:sXmwo9DwP3OK9EZ7PqAdaooSGozfl/3a6/xJcbzPRhE=
+golang.org/x/text v0.38.0/go.mod h1:YXZt3QhHUKYT53r2lLKFIVi6Ao1jdzrTR/KQ09qyxF4=
 golang.org/x/tools v0.0.0-20180917221912-90fa682c2a6e/go.mod h1:n7NCudcB/nEzxVGmLbDWY5pfWTLqBcC2KZ6jyYvM4mQ=
 golang.org/x/tools v0.0.0-20191119224855-298f0cb1881e/go.mod h1:b+2E5dAYhXwXZwtnZ6UAqBI28+e2cm9otk0dWdXHAEo=
 golang.org/x/tools v0.1.12/go.mod h1:hNGJHUnrk76NpqgfD5Aqm5Crs+Hm0VOH/i9J2+nxYbc=
```

**File**: `chaoscenter/event-tracker/go.mod` (modified, +4/-4)
```diff
@@ -52,11 +52,11 @@ require (
 	go.uber.org/multierr v1.6.0 // indirect
 	go.uber.org/zap v1.24.0 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
-	golang.org/x/net v0.49.0 // indirect
+	golang.org/x/net v0.56.0 // indirect
 	golang.org/x/oauth2 v0.27.0 // indirect
-	golang.org/x/sys v0.40.0 // indirect
-	golang.org/x/term v0.39.0 // indirect
-	golang.org/x/text v0.33.0 // indirect
+	golang.org/x/sys v0.46.0 // indirect
+	golang.org/x/term v0.44.0 // indirect
+	golang.org/x/text v0.38.0 // indirect
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
-golang.org/x/mod v0.32.0 h1:9F4d3PHLljb6x//jOyokMv3eX+YDeepZSEo3mFJy93c=
-golang.org/x/mod v0.32.0/go.mod h1:SgipZ/3h2Ci89DlEtEXWUk/HteuRin+HHhN+WbNhguU=
+golang.org/x/mod v0.36.0 h1:JJjpVx6myfUsUdAzZuOSTTmRE0PfZeNWzzvKrP7amb4=
+golang.org/x/mod v0.36.0/go.mod h1:moc6ELqsWcOw5Ef3xVprK5ul/MvtVvkIXLziUOICjUQ=
 golang.org/x/net v0.0.0-20180906233101-161cd47e91fd/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20190311183353-d8887717615a/go.mod h1:t9HGtf8HONx5eT2rtn7q6eTqICYqUVnKs3thJo3Qplg=
 golang.org/x/net v0.0.0-20190404232315-eb5bcb51f2a3/go.mod h1:t9HGtf8HONx5eT2rtn7q6eTqICYqUVnKs3thJo3Qplg=
@@ -172,8 +172,8 @@ golang.org/x/net v0.0.0-20200226121028-0de0cce0169b/go.mod h1:z5CRVTTTmAJ677TzLL
 golang.org/x/net v0.0.0-20200520004742-59133d7f0dd7/go.mod h1:qpuaurCH72eLCgpAm/N6yyVIVM9cpaDIP3A8BGJEC5A=
 golang.org/x/net v0.0.0-20201021035429-f5854403a974/go.mod h1:sp8m0HH+o8qH0wwXwYZr8TS3Oi6o0r6Gce1SSxlDquU=
 golang.org/x/net v0.0.0-20210405180319-a5a99cb37ef4/go.mod h1:p54w0d4576C0XHj96bSt6lcn1PtDYWL6XObtHCRCNQM=
-golang.org/x/net v0.49.0 h1:eeHFmOGUTtaaPSGNmjBKpbng9MulQsJURQUAfUwY++o=
-golang.org/x/net v0.49.0/go.mod h1:/ysNB2EvaqvesRkuLAyjI1ycPZlQHM3q01F02UY/MV8=
+golang.org/x/net v0.56.0 h1:Rw8j/hFzGvJUZwNBXnAtf5sVDVt+65SK2C7IxCxZt5o=
+golang.org/x/net v0.56.0/go.mod h1:D3Ku6r+V6JROoZK144D2XfMHFcMq/0zSfLelVTCFKec=
 golang.org/x/oauth2 v0.27.0 h1:da9Vo7/tDv5RH/7nZDz1eMGS/q1Vv1N/7FCrBhI9I3M=
 golang.org/x/oauth2 v0.27.0/go.mod h1:onh5ek6nERTohokkhCD/y2cV4Do3fxFHFuAejCkRWT8=
 golang.org/x/sync v0.0.0-20180314180146-1d60e4601c6f/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
@@ -182,8 +182,8 @@ golang.org/x/sync v0.0.0-20190423024810-112230192c58/go.mod h1:RxMgew5VJxzue5/jJ
 golang.org/x/sync v0.0.0-20190911185100-cd5d95a43a6e/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20201020160332-67f06af15bc9/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20210220032951-036812b2e83c/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
-golang.org/x/sync v0.19.0 h1:vV+1eWNmZ5geRlYjzm2adRgW2/mcpevXNg50YZtPCE4=
-golang.org/x/sync v0.19.0/go.mod h1:9KTHXmSnoGruLpwFjVSX0lNNA75CykiMECbovNTZqGI=
+golang.org/x/sync v0.21.0 h1:HLII4xRRTtCRkxYp4HNFF0Js/Og6q2i++KXbg0gHCwM=
+golang.org/x/sync v0.21.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
 golang.org/x/sys v0.0.0-20180909124046-d0be0721c37e/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20190215142949-d0b11bdaac8a/go.mod h1:STP8DvDyc/dI5b8T5hshtkjS+E42TnysNCUPdjciGhY=
 golang.org/x/sys v0.0.0-20190412213103-97732733099d/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
@@ -197,15 +197,15 @@ golang.org/x/sys v0.0.0-20210112080510-489259a85091/go.mod h1:h1NjWce9XRLGQEsW7w
 golang.org/x/sys v0.0.0-20210330210617-4fbd30eecc44/go.mod h1:h1NjWce9XRLGQEsW7wpKNCjG9DtNlClVuFLEZdDNbEs=
 golang.org/x/sys v0.0.0-20210510120138-977fb7262007/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
 golang.org/x/sys v0.0.0-20220908164124-27713097b956/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=
-golang.org/x/sys v0.40.0 h1:DBZZqJ2Rkml6QMQsZywtnjnnGvHza6BTfYFWY9kjEWQ=
-golang.org/x/sys v0.40.0/go.mod h1:OgkHotnGiDImocRcuBABYBEXf8A9a87e/uXjp9XT3ks=
+golang.org/x/sys v0.46.0 h1:noSf2Fq6F8DBgS+LysIkx7rIExoNHJsxOAtPp4rthXw=
+golang.org/x/sys v0.46.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
 golang.org/x/term v0.0.0-20201126162022-7de9c90e9dd1/go.mod h1:bj7SfCRtBDWHUb9snDiAeCFNEtKQo2Wmx5Cou7ajbmo=
-golang.org/x/term v0.39.0 h1:RclSuaJf32jOqZz74CkPA9qFuVTX7vhLlpfj/IGWlqY=
-golang.org/x/term v0.39.0/go.mod h1:yxzUCTP/U+FzoxfdKmLaA0RV1WgE0VY7hXBwKtY/4ww=
+golang.org/x/term v0.44.0 h1:0rLvDRCtNj0gZkyIXhCyOb2OAzEhLVqc4B+hrsBhrmc=
+golang.org/x/term v0.44.0/go.mod h1:7ze4MdzUzLXpSAoFP1H0bOI9aXDqveSvatT5vKcFh2Y=
 golang.org/x/text v0.3.0/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=
 golang.org/x/text v0.3.3/go.mod h1:5Zoc/QRtKVWzQhOtBMvqHzDpF6irO9z98xDceosuGiQ=
-golang.org/x/text v0.33.0 h1:B3njUFyqtHDUI5jMn1YIr5B0IE2U0qck04r6d4KPAxE=
-golang.org/x/text v0.33.0/go.mod h1:LuMebE6+rBincTi9+xWTY8TztLzKHc/9C1uBCG27+q8=
+golang.org/x/text v0.38.0 h1:sXmwo9DwP3OK9EZ7PqAdaooSGozfl/3a6/xJcbzPRhE=
+golang.org/x/text v0.38.0/go.mod h1:YXZt3QhHUKYT53r2lLKFIVi6Ao1jdzrTR/KQ09qyxF4=
 golang.org/x/time v0.3.0 h1:rg5rLMjNzMS1RkNLzCG38eapWhnYLFYXDXj2gOlr8j4=
 golang.org/x/time v0.3.0/go.mod h1:tRJNPiyCQ0inRvYxbN9jk5I+vvW/OXSQhTDSoE431IQ=
 golang.org/x/tools v0.0.0-20180917221912-90fa682c2a6e/go.mod h1:n7NCudcB/nEzxVGmLbDWY5pfWTLqBcC2KZ6jyYvM4mQ=
@@ -215,8 +215,8 @@ golang.org/x/tools v0.0.0-2020061
```

**File**: `chaoscenter/graphql/server/manifests/cluster/3b_agents_deployment.yaml` (modified, +3/-0)
```diff
@@ -12,6 +12,9 @@ data:
   SKIP_SSL_VERIFY: "#{SKIP_SSL_VERIFY}"
   CUSTOM_TLS_CERT: "#{CUSTOM_TLS_CERT}"
   IS_INFRA_CONFIRMED: #{IS_INFRA_CONFIRMED}
+  K8S_CLIENT_QPS: "50"
+  K8S_CLIENT_BURST: "100"
+  K8S_CLIENT_TIMEOUT: "30"
   COMPONENTS: |
     DEPLOYMENTS: #{INFRA_DEPLOYMENTS}
 ---
```

**File**: `chaoscenter/graphql/server/manifests/namespace/3b_agents_deployment.yaml` (modified, +3/-0)
```diff
@@ -12,6 +12,9 @@ data:
   SKIP_SSL_VERIFY: "#{SKIP_SSL_VERIFY}"
   CUSTOM_TLS_CERT: "#{CUSTOM_TLS_CERT}"
   IS_INFRA_CONFIRMED: #{IS_INFRA_CONFIRMED}
+  K8S_CLIENT_QPS: "50"
+  K8S_CLIENT_BURST: "100"
+  K8S_CLIENT_TIMEOUT: "30"
   COMPONENTS: |
     DEPLOYMENTS: #{INFRA_DEPLOYMENTS}
 ---
```

**File**: `chaoscenter/subscriber/Dockerfile` (modified, +4/-2)
```diff
@@ -1,5 +1,5 @@
 # BUILD STAGE
-FROM golang:1.25 AS builder
+FROM golang:1.26 AS builder
 
 LABEL maintainer="LitmusChaos"
 
@@ -23,10 +23,12 @@ LABEL maintainer="LitmusChaos"
 
 ENV APP_DIR="/litmus"
 
+RUN microdnf update -y && microdnf clean all
+
 COPY --from=builder /output/subscriber $APP_DIR/
 RUN chown 65534:0 $APP_DIR/subscriber && chmod 755 $APP_DIR/subscriber
 
 WORKDIR $APP_DIR
 USER 65534
 
-CMD ["./subscriber"]
\ No newline at end of file
+CMD ["./subscriber"]
```

**File**: `chaoscenter/subscriber/go.mod` (modified, +31/-30)
```diff
@@ -1,35 +1,34 @@
 module subscriber
 
-go 1.24.0
+go 1.26.0
 
 require (
 	github.com/AdaLogics/go-fuzz-headers v0.0.0-20230811130428-ced1acdcaa24
-	github.com/argoproj/argo-workflows/v3 v3.3.5
+	github.com/argoproj/argo-workflows/v3 v3.7.14
 	github.com/ghodss/yaml v1.0.1-0.20190212211648-25d852aebe32
 	github.com/golang/mock v1.6.0
-	github.com/gorilla/websocket v1.5.3
+	github.com/gorilla/websocket v1.5.4-0.20250319132907-e064f32e3674
 	github.com/kelseyhightower/envconfig v1.4.0
 	github.com/litmuschaos/chaos-operator v0.0.0-20240601063404-e96a7ee7f1f7
 	github.com/sirupsen/logrus v1.9.3
-	github.com/stretchr/testify v1.9.0
+	github.com/stretchr/testify v1.11.1
 	gopkg.in/yaml.v2 v2.4.0
-	k8s.io/api v0.26.0
-	k8s.io/apimachinery v0.26.0
+	k8s.io/api v0.33.1
+	k8s.io/apimachinery v0.33.1
 	k8s.io/client-go v12.0.0+incompatible
 )
 
 require (
-	github.com/PuerkitoBio/purell v1.1.1 // indirect
-	github.com/PuerkitoBio/urlesc v0.0.0-20170810143723-de5bf2ad4578 // indirect
-	github.com/davecgh/go-spew v1.1.1 // indirect
-	github.com/emicklei/go-restful v2.16.0+incompatible // indirect
-	github.com/evanphx/json-patch v5.6.0+incompatible // indirect
+	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
+	github.com/emicklei/go-restful/v3 v3.12.2 // indirect
+	github.com/evanphx/json-patch v5.9.11+incompatible // indirect
 	github.com/go-logr/logr v1.4.3 // indirect
-	github.com/go-openapi/jsonpointer v0.19.5 // indirect
-	github.com/go-openapi/jsonreference v0.19.6 // indirect
-	github.com/go-openapi/swag v0.19.15 // indirect
+	github.com/go-openapi/jsonpointer v0.21.1 // indirect
+	github.com/go-openapi/jsonreference v0.21.0 // indirect
+	github.com/go-openapi/swag v0.23.1 // indirect
 	github.com/gogo/protobuf v1.3.2 // indirect
 	github.com/golang/protobuf v1.5.4 // indirect
+	github.com/google/gnostic-models v0.6.9 // indirect
 	github.com/google/go-cmp v0.7.0 // indirect
 	github.com/google/gofuzz v1.2.0 // indirect
 	github.com/googleapis/gnostic v0.5.5 // indirect
@@ -38,29 +37,31 @@ require (
 	github.com/imdario/mergo v0.3.12 // indirect
 	github.com/josharian/intern v1.0.0 // indirect
 	github.com/json-iterator/go v1.1.12 // indirect
-	github.com/mailru/easyjson v0.7.7 // indirect
+	github.com/mailru/easyjson v0.9.0 // indirect
 	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
 	github.com/modern-go/reflect2 v1.0.2 // indirect
-	github.com/pkg/errors v0.9.1 // indirect
-	github.com/pmezard/go-difflib v1.0.0 // indirect
-	github.com/spf13/pflag v1.0.5 // indirect
-	golang.org/x/net v0.49.0 // indirect
-	golang.org/x/oauth2 v0.34.0 // indirect
-	golang.org/x/sys v0.40.0 // indirect
-	golang.org/x/term v0.39.0 // indirect
-	golang.org/x/text v0.33.0 // indirect
-	golang.org/x/time v0.0.0-20220210224613-90d013bbcef8 // indirect
-	google.golang.org/genproto v0.0.0-20230410155749-daa745c078e1 // indirect
+	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
+	github.com/spf13/pflag v1.0.6 // indirect
+	golang.org/x/net v0.56.0 // indirect
+	golang.org/x/oauth2 v0.35.0 // indirect
+	golang.org/x/sys v0.46.0 // indirect
+	golang.org/x/term v0.44.0 // indirect
+	golang.org/x/text v0.38.0 // indirect
+	golang.org/x/time v0.11.0 // indirect
+	google.golang.org/genproto v0.0.0-20250603155806-513f23925822 // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260401024825-9d38bb4040a9 // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260401024825-9d38bb4040a9 // indirect
 	google.golang.org/grpc v1.80.0 // indirect
 	google.golang.org/protobuf v1.36.11 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	gopkg.in/yaml.v3 v3.0.1 // indirect
-	k8s.io/klog/v2 v2.80.1 // indirect
-	k8s.io/kube-openapi v0.0.0-20220124234850-424119656bbf // indirect
-	k8s.io/utils v0.0.0-20221107191617-1a15be271d1d // indirect
+	k8s.io/klog/v2 v2.130.1 // indirect
+	k8s.io/kube-openapi v0.0.0-20250318190949-c8a335a9a2ff // indirect
+	k8s.io/utils v0.0.0-20260319190234-28399d86e0b5 // indirect
 	sigs.k8s.io/controller-runtime v0.11.1 // indirect
-	sigs.k8s.io/structured-merge-diff/v4 v4.2.3 // indirect
-	sigs.k8s.io/yaml v1.3.0 // indirect
+	sigs.k8s.io/randfill v1.0.0 // indirect
+	sigs.k8s.io/structured-merge-diff/v4 v4.7.0 // indirect
+	sigs.k8s.io/yaml v1.4.0 // indirect
 )
 
 // Pinned to kubernetes-1.21.2
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
