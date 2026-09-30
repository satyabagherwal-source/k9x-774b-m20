# Forensic Learning Record (Deep Inspection): camptocamp/terraboard

> **Canonical Artifact**: `07_PROJECT_LEARNING/camptocamp-terraboard-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/camptocamp/terraboard](https://github.com/camptocamp/terraboard))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:41:16.195Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `camptocamp/terraboard`
- **Description**: :earth_africa: :clipboard:  A web dashboard to inspect Terraform States 
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2009 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/api.go`
```
package api

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"

	"github.com/camptocamp/terraboard/auth"
	"github.com/camptocamp/terraboard/compare"
	"github.com/camptocamp/terraboard/db"
	"github.com/camptocamp/terraboard/state"
	"github.com/gorilla/mux"
	log "github.com/sirupsen/logrus"
	"gorm.io/datatypes"
)

// Terraform plan payload structure usedfor swagger documentation
type planPayload struct {
	Lineage   string         `json:"lineage"`
	TFVersion string         `json:"terraform_version"`
	GitRemote string         `json:"git_remote"`
	GitCommit string         `json:"git_commit"`
	CiURL     string         `json:"ci_url"`
	Source    string         `json:"source"`
	ExitCode  int            `json:"exit_code"`
	PlanJSON  datatypes.JSON `json:"plan_json" swaggertype:"object"`
}

var _ *planPayload = nil // Avoid deadcode warning for planPayload

// JSONError is a wrapper function for errors
// which prints them to the http.ResponseWriter as a JSON response
func JSONError(w http.ResponseWriter, message string, err error) {
	errObj := make(map[string]string)
	errObj["error"] = message
	errObj["details"] = fmt.Sprintf("%v", err)
	j, _ := json.Marshal(errObj)
	if _, err := io.WriteString(w, string(j)); err != nil {
		log.Error(err.Error())
	}
}

// ListTerraformVersionsWithCount lists Terraform versions with their associated
// counts, sorted by the 'orderBy' parameter (version by default)
// @Summary Lists Terraform versions with counts
// @Description Get terraform version with their associated counts, sorted by the 'orderBy' parameter (version by default)
// @ID list-terraform-versions-with-count
// @Produce  json
// @Param   orderBy      query   string     false  "Order by constraint"
// @Success 200 {string} string	"ok"
// @Router /lineages/tfversion/count [get]
func ListTerraformVersionsWithCount(w http.ResponseWriter, r *http.Request, d *db.Database) {
	query := r.URL.Query()
	versions, _ := d.ListTerraformVersionsWithCount(query)

	j, err := json.Marshal(versions)
	if err != nil {
		JSONError(w, "Failed to marshal states", err)
		return
	}
	if _, err := io.WriteString(w, string(j)); err != nil {
		log.Error(err.Error())
	}
}

// ListStateStats returns State information for a given path as parameter
// @Summary Get Lineage states stats
// @Description Returns Lineage states stats along with paging information
// @ID list-state-stats
// @Produce  json
// @Param   page      query   integer     false  "Current page for pagination"
// @Success 200 {string} string	"ok"
// @Router /lineages/stats [get]
func ListStateStats(w http.ResponseWriter, r *http.Request, d *db.Database) {
	query := r.URL.Query()
	states, page, total := d.ListStateStats(query)

	// Build response object
	response := make(map[string]interface{})
	response["states"] = states
	response["page"] = page
	response["total"] = total
	j, err := json.Marshal(response)
	if err != nil {
		JSONError(w, "Failed to marshal states", err)
		return
	}
	if _, err := io.WriteString(w, string(j)); err != nil {
		log.Error(err.Error())
	}
}

// GetState provides information on a State
// @Summary Provides information on a State
// @Description Retrieves a State from the database by its lineage and versionID
// @ID get-state
// @Produce  json
// @Param   versionid      query   string     false  "Version ID"
// @Param   lineage      path   string     true  "Lineage"
// @Success 200 {string} string	"ok"
// @Router /lineages/{lineage} [get]
func GetState(w http.ResponseWriter, r *http.Request, d *db.Database) {
	params := mux.Vars(r)
	versionID := r.URL.Query().Get("versionid")
	var err error
	if versionID == "" {
		versionID, err = d.DefaultVersion(params["lineage"])
		if err != nil {
			JSONError(w, "Failed to retrieve default version", err)
			return
		}
	}
	state := d.GetState(params["lineage"], versionID)

	j, err := json.Marshal(state)
	if err != nil {
		JSONError(w, "Failed to marshal state", err)
		return
	}
	if _, err := io.WriteString(w, string(j)); err != nil {
		log.Error(err.Error())
	}
}

// GetLineageActivity returns the activity (version history) of a Lineage
// @Summary Get Lineage activity
// @Description Retrieves the activity (version history) of a Lineage
// @ID get-lineage-activity
// @Produce  json
// @Param   lineage      path   string     true  "Lineage"
// @Success 200 {string} string	"ok"
// @Router /lineages/{lineage}/activity [get]
func GetLineageActivity(w http.ResponseWriter, r *http.Request, d *db.Database) {
	params := mux.Vars(r)
	activity := d.GetLineageActivity(params["lineage"])

	j, err := json.Marshal(activity)
	if err != nil {
		JSONError(w, "Failed to marshal state activity", err)
		return
	}
	if _, err := io.WriteString(w, string(j)); err != nil {
		log.Error(err.Error())
	}
}

// StateCompare compares two versions ('from' and 'to') of a State
// @Summary Compares two versions of a State
// @Description Compares two versions ('from' and 'to') of a State
// @ID state-compare
// @Produce  json
// @Param   lineage      path   string     true  "Lineage"
// @Param   from      query   string     true  "Version from"
// @Param   to      query   string     true  "Version to"
// @Success 200 {string} string	"ok"
// @Router /lineages/{lineage}/compare [get]
func StateCompare(w http.ResponseWriter, r *http.Request, d *db.Database) {
	params := mux.Vars(r)
	query := r.URL.Query()
	fromVersion := query.Get("from")
	toVersion := query.Get("to")

	from := d.GetState(params["lineage"], fromVersion)
	to := d.GetState(params["lineage"], toVersion)
	compare, err := compare.Compare(from, to)
	if err != nil {
		JSONError(w, "Failed to compare state versions", err)
		return
	}

	j, err := json.Marshal(compare)
	if err != nil {
		JSONError(w, "Failed to marshal state compare", err)
		return
	}
	if _, err := io.WriteString(w, string(j)); err != nil {
		log.Error(err.Error())
	}
}

// GetLocks returns information on locked States
// @Summary Get locked states information
// @Description Returns information on locked States
// @ID get-locks
// @Produce  json
// @Success 200 {string} string	"ok"
// @Router /locks [get]
func GetLocks(w http.ResponseWriter, _ *http.Request, sps []state.Provider) {
	allLocks := make(map[string]state.LockInfo)
	for _, sp := range sps {
		locks, err := sp.GetLocks()
		if err != nil {
			JSONError(w, "Failed to get locks on a provider", err)
			return
		}
		for k, v := range locks {
			allLocks[k] = v
		}
	}

	j, err := json.Marshal(allLocks)
	if err != nil {
		JSONError(w, "Failed to marshal locks", err)
		return
	}
	if _, err := io.WriteString(w, string(j)); err != nil {
		log.Error(err.Error())
	}
}

// SearchAttribute performs a search on Resource Attributes
// by various parameters
// @Summary Search Resource Attributes
// @Description Performs a search on Resource Attributes by various parameters
// @ID search-attribute
// @Produce  json
// @Param   versionid      query   string     false  "Version ID"
// @Param   type      query   string     false  "Ressource type"
// @Param   name      query   string     false  "Resource ID"
// @Param   key      query   string     false  "Attribute Key"
// @Param   value      query   string     false  "Attribute Value"
// @Param   tf_version      query   string     false  "Terraform Version"
// @Param   lineage_value      query   string     false  "Lineage"
// @Success 200 {string} string	"ok"
// @Router /search/attribute [get]
func SearchAttribute(w http.ResponseWriter, r *http.Request, d *db.Database) {
	query := r.URL.Query()
	result, page, total := d.SearchAttribute(query)

	// Build response object
	response := make(map[string]interface{})
	response["results"] = result
	response["page"] = page
	response["total"] = total

	j, err := json.Marshal(response)
	if err != nil {
		JSONError(w, "Failed to marshal json", err)
		return
	}
	if _, err := io.WriteString(w, string(j)); err != nil {
		log.Error(err.Error())
	}
}

// ListResourceTypes lists all Resource types
// @Summary Get Resource types
// @Descrip
```

### Core Architecture Module: `auth/auth.go`
```
package auth

import (
	"crypto/md5"
	"fmt"

	"github.com/camptocamp/terraboard/config"
)

var logoutURL string

// User is an authenticated user
type User struct {
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
	LogoutURL string `json:"logout_url"`
}

// Setup sets up authentication
func Setup(c *config.Config) {
	logoutURL = c.Web.LogoutURL
}

// UserInfo returns a User given a name and email
func UserInfo(name, email string) (user User) {
	user = User{
		LogoutURL: logoutURL,
	}

	if email != "" {
		user.Name = name
		user.AvatarURL = fmt.Sprintf("http://www.gravatar.com/avatar/%x", md5.Sum([]byte(email)))
	}

	return
}

```

### Core Architecture Module: `compare/compare.go`
```
package compare

import (
	"fmt"
	"sort"
	"strings"

	"github.com/camptocamp/terraboard/types"
	"github.com/pmezard/go-difflib/difflib"
	log "github.com/sirupsen/logrus"
)

// Return all resources of a state
func stateResources(state types.State) (res []string) {
	for _, m := range state.Modules {
		for _, r := range m.Resources {
			res = append(res, fmt.Sprintf("%s.%s.%s", m.Path, r.Type, r.Name))
		}
	}
	return
}

// Returns elements only in s1
func sliceDiff(s1, s2 []string) (diff []string) {
	for _, e1 := range s1 {
		found := false
		for _, e2 := range s2 {
			if e1 == e2 {
				found = true
				break
			}
		}

		if !found {
			diff = append(diff, e1)
		}
	}
	return
}

// Returns elements in both s1 and s2
func sliceInter(s1, s2 []string) (inter []string) {
	for _, e1 := range s1 {
		for _, e2 := range s2 {
			if e1 == e2 {
				inter = append(inter, e1)
				break
			}
		}
	}
	return
}

func getResource(state types.State, key string) (res types.Resource, err error) {
	for _, m := range state.Modules {
		if strings.HasPrefix(key, m.Path) {
			for _, r := range m.Resources {
				if key == fmt.Sprintf("%s.%s.%s", m.Path, r.Type, r.Name) {
					return r, nil
				}
			}
		} else {
			continue
		}
	}
	return res, fmt.Errorf("Could not find resource with key %s in state %s", key, state.Path)
}

// Return all attributes of a resource
func resourceAttributes(res types.Resource) (attrs []string) {
	for _, a := range res.Attributes {
		attrs = append(attrs, a.Key)
	}
	sort.Strings(attrs)
	return
}

func getResourceAttribute(res types.Resource, key string) (val string, err error) {
	for _, attr := range res.Attributes {
		if attr.Key == key {
			return attr.Value, nil
		}
	}
	return "", fmt.Errorf("Could not find attribute %s for resource %s.%s", key, res.Type, res.Name)
}

// TODO: use terraform/command/format.State()
func formatResource(res types.Resource) (out string) {
	out = fmt.Sprintf("resource \"%s\" \"%s\" {\n", res.Type, res.Name)
	for _, attr := range resourceAttributes(res) {
		a, _ := getResourceAttribute(res, attr) // TODO: err
		out += fmt.Sprintf("  %s = \"%s\"\n", attr, a)
	}
	out += "}\n"

	return
}

func stateInfo(state types.State) (info string) {
	return fmt.Sprintf("%s (%s)", state.Path, state.Version.LastModified)
}

// Compare a resource in two states
func compareResource(st1, st2 types.State, key string) (comp types.ResourceDiff) {
	res1, _ := getResource(st1, key) // TODO: err
	attrs1 := resourceAttributes(res1)
	res2, _ := getResource(st2, key) // TODO: err
	attrs2 := resourceAttributes(res2)

	// Only in old
	comp.OnlyInOld = make(map[string]string)
	for _, attr := range sliceDiff(attrs1, attrs2) {
		a, _ := getResourceAttribute(res1, attr) // TODO: err
		comp.OnlyInOld[attr] = a
	}

	// Only in new
	comp.OnlyInNew = make(map[string]string)
	for _, attr := range sliceDiff(attrs2, attrs1) {
		a, _ := getResourceAttribute(res2, attr) // TODO: err
		comp.OnlyInNew[attr] = a
	}

	// Compute unified diff
	diff := difflib.UnifiedDiff{
		A:        difflib.SplitLines(formatResource(res1)),
		B:        difflib.SplitLines(formatResource(res2)),
		FromFile: stateInfo(st1),
		ToFile:   stateInfo(st2),
		Context:  3,
		Eol:      "\n",
	}
	result, _ := difflib.GetUnifiedDiffString(diff)
	comp.UnifiedDiff = result

	return
}

// Compare returns the difference between two versions of a State
// as a StateCompare structure
func Compare(from, to types.State) (comp types.StateCompare, err error) {
	if from.Path == "" {
		err = fmt.Errorf("from version is unknown")
		return
	}
	fromResources := stateResources(from)
	comp.Stats.From = types.StateInfo{
		Path:          from.Path,
		VersionID:     from.Version.VersionID,
		ResourceCount: len(fromResources),
		TFVersion:     from.TFVersion,
		Serial:        from.Serial,
	}

	if to.Path == "" {
		err = fmt.Errorf("to version is unknown")
		return
	}
	toResources := stateResources(to)
	comp.Stats.To = types.StateInfo{
		Path:          to.Path,
		VersionID:     to.Version.VersionID,
		ResourceCount: len(toResources),
		TFVersion:     to.TFVersion,
		Serial:        to.Serial,
	}

	// OnlyInOld
	onlyInOld := sliceDiff(fromResources, toResources)
	comp.Differences.OnlyInOld = make(map[string]string)
	for _, r := range onlyInOld {
		res, _ := getResource(from, r) // TODO: err
		comp.Differences.OnlyInOld[r] = formatResource(res)
	}

	// OnlyInNew
	onlyInNew := sliceDiff(toResources, fromResources)
	comp.Differences.OnlyInNew = make(map[string]string)
	for _, r := range onlyInNew {
		res, _ := getResource(to, r) // TODO: err
		comp.Differences.OnlyInNew[r] = formatResource(res)
	}
	comp.Differences.InBoth = sliceInter(toResources, fromResources)
	comp.Differences.ResourceDiff = make(map[string]types.ResourceDiff)

	for _, r := range comp.Differences.InBoth {
		if c := compareResource(to, from, r); c.UnifiedDiff != "" {
			comp.Differences.ResourceDiff[r] = c
		}
	}

	log.WithFields(log.Fields{
		"path": from.Path,
		"from": from.Version.VersionID,
		"to":   to.Version.VersionID,
	}).Info("Comparing state versions")

	return
}

```

### Core Architecture Module: `config/config.go`
```
package config

import (
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"

	tfversion "github.com/hashicorp/terraform/version"
	"github.com/jessevdk/go-flags"
	log "github.com/sirupsen/logrus"
	"gopkg.in/yaml.v2"
)

type configFlags struct {
	Version bool `short:"V" long:"version" description:"Display version."`

	ConfigFilePath string `short:"c" long:"config-file" env:"CONFIG_FILE" description:"Config File path"`

	Provider ProviderConfig `group:"General Provider Options" yaml:"provider"`

	Log LogConfig `group:"Logging Options" yaml:"log"`

	DB DBConfig `group:"Database Options" yaml:"database"`

	AWS AWSConfig `group:"AWS Options" yaml:"aws"`

	S3 S3BucketConfig `group:"S3 Options" yaml:"s3"`

	TFE TFEConfig `group:"Terraform Enterprise Options" yaml:"tfe"`

	GCP GCPConfig `group:"Google Cloud Platform Options" yaml:"gcp"`

	Gitlab GitlabConfig `group:"GitLab Options" yaml:"gitlab"`

	Web WebConfig `group:"Web" yaml:"web"`
}

// LogConfig stores the log configuration
type LogConfig struct {
	Level  string `short:"l" long:"log-level" env:"TERRABOARD_LOG_LEVEL" yaml:"level" description:"Set log level ('debug', 'info', 'warn', 'error', 'fatal', 'panic')." default:"info"`
	Format string `long:"log-format" yaml:"format" env:"TERRABOARD_LOG_FORMAT" description:"Set log format ('plain', 'json')." default:"plain"`
}

// DBConfig stores the database configuration
type DBConfig struct {
	Host         string `long:"db-host" env:"DB_HOST" yaml:"host" description:"Database host." default:"db"`
	Port         uint16 `long:"db-port" env:"DB_PORT" yaml:"port" description:"Database port." default:"5432"`
	User         string `long:"db-user" env:"DB_USER" yaml:"user" description:"Database user." default:"gorm"`
	Password     string `long:"db-password" env:"DB_PASSWORD" yaml:"password" description:"Database password."`
	Name         string `long:"db-name" env:"DB_NAME" yaml:"name" description:"Database name." default:"gorm"`
	SSLMode      string `long:"db-sslmode" env:"DB_SSLMODE" yaml:"sslmode" description:"Database SSL mode." default:"require"`
	NoSync       bool   `long:"no-sync" yaml:"no-sync" description:"Do not sync database."`
	SyncInterval uint16 `long:"sync-interval" yaml:"sync-interval" description:"DB sync interval (in minutes)" default:"1"`
}

// S3BucketConfig stores the S3 bucket configuration
type S3BucketConfig struct {
	Bucket         string   `long:"s3-bucket" env:"AWS_BUCKET" yaml:"bucket" description:"AWS S3 bucket."`
	KeyPrefix      string   `long:"key-prefix" env:"AWS_KEY_PREFIX" yaml:"key-prefix" description:"AWS Key Prefix."`
	FileExtension  []string `long:"file-extension" env:"AWS_FILE_EXTENSION" env-delim:"," yaml:"file-extension" description:"File extension(s) of state files." default:".tfstate"`
	ForcePathStyle bool     `long:"force-path-style" env:"AWS_FORCE_PATH_STYLE" yaml:"force-path-style" description:"Force path style S3 bucket calls."`
}

// AWSConfig stores the DynamoDB table and S3 Bucket configuration
type AWSConfig struct {
	AccessKey       string           `long:"aws-access-key" env:"AWS_ACCESS_KEY_ID" yaml:"access-key" description:"AWS account access key."`
	SecretAccessKey string           `long:"aws-secret-access-key" env:"AWS_SECRET_ACCESS_KEY" yaml:"secret-access-key" description:"AWS secret account access key."`
	SessionToken    string           `long:"aws-session-token" env:"AWS_SESSION_TOKEN" yaml:"session-token" description:"AWS session token."`
	DynamoDBTable   string           `long:"dynamodb-table" env:"AWS_DYNAMODB_TABLE" yaml:"dynamodb-table" description:"AWS DynamoDB table for locks."`
	S3              []S3BucketConfig `group:"S3 Options" yaml:"s3"`
	Endpoint        string           `long:"aws-endpoint" env:"AWS_ENDPOINT" yaml:"endpoint" description:"AWS endpoint."`
	Region          string           `long:"aws-region" env:"AWS_REGION" yaml:"region" description:"AWS region."`
	APPRoleArn      string           `long:"aws-role-arn" env:"APP_ROLE_ARN" yaml:"app-role-arn" description:"Role ARN to Assume."`
	ExternalID      string           `long:"aws-external-id" env:"AWS_EXTERNAL_ID" yaml:"external-id" description:"External ID to use when assuming role."`
}

// TFEConfig stores the Terraform Enterprise configuration
type TFEConfig struct {
	Address      string `long:"tfe-address" env:"TFE_ADDRESS" yaml:"address" description:"Terraform Enterprise address for states access"`
	Token        string `long:"tfe-token" env:"TFE_TOKEN" yaml:"token" description:"Terraform Enterprise Token for states access"`
	Organization string `long:"tfe-organization" env:"TFE_ORGANIZATION" yaml:"organization" description:"Terraform Enterprise organization for states access"`
}

// GCPConfig stores the Google Cloud configuration
type GCPConfig struct {
	HTTPClient *http.Client
	GCSBuckets []string `long:"gcs-bucket" yaml:"gcs-bucket" description:"Google Cloud bucket to search"`
	GCPSAKey   string   `long:"gcp-sa-key-path" env:"GCP_SA_KEY_PATH" yaml:"gcp-sa-key-path" description:"The path to the service account to use to connect to Google Cloud Platform"`
}

// GitlabConfig stores the GitLab configuration
type GitlabConfig struct {
	Address string `long:"gitlab-address" env:"GITLAB_ADDRESS" yaml:"address" description:"GitLab address (root)" default:"https://gitlab.com"`
	Token   string `long:"gitlab-token" env:"GITLAB_TOKEN" yaml:"token" description:"Token to authenticate upon GitLab"`
}

// WebConfig stores the UI interface parameters
type WebConfig struct {
	Port        uint16 `short:"p" long:"port" env:"TERRABOARD_PORT" yaml:"port" description:"Port to listen on." default:"8080"`
	SwaggerPort uint16 `long:"swagger-port" env:"TERRABOARD_SWAGGER_PORT" yaml:"swagger-port" description:"Port for swagger to listen on." default:"8081"`
	BaseURL     string `long:"base-url" env:"TERRABOARD_BASE_URL" yaml:"base-url" description:"Base URL." default:"/"`
	LogoutURL   string `long:"logout-url" env:"TERRABOARD_LOGOUT_URL" yaml:"logout-url" description:"Logout URL."`
}

// ProviderConfig stores genral provider parameters
type ProviderConfig struct {
	NoVersioning bool `long:"no-versioning" env:"TERRABOARD_NO_VERSIONING" yaml:"no-versioning" description:"Disable versioning support from Terraboard (useful for S3 compatible providers like MinIO)"`
	NoLocks      bool `long:"no-locks" env:"TERRABOARD_NO_LOCKS" yaml:"no-locks" description:"Disable locks support from Terraboard (useful for S3 compatible providers like MinIO)"`
}

// Config stores the handler's configuration and UI interface parameters
type Config struct {
	Version bool `short:"V" long:"version" description:"Display version."`

	ConfigFilePath string `short:"c" long:"config-file" env:"CONFIG_FILE" description:"Config File path"`

	Provider ProviderConfig `group:"General Provider Options" yaml:"provider"`

	Log LogConfig `group:"Logging Options" yaml:"log"`

	DB DBConfig `group:"Database Options" yaml:"database"`

	AWS []AWSConfig `group:"AWS Options" yaml:"aws"`

	TFE []TFEConfig `group:"Terraform Enterprise Options" yaml:"tfe"`

	GCP []GCPConfig `group:"Google Cloud Platform Options" yaml:"gcp"`

	Gitlab []GitlabConfig `group:"GitLab Options" yaml:"gitlab"`

	Web WebConfig `group:"Web" yaml:"web"`
}

// LoadConfigFromYaml loads the config from config file
func (c *Config) LoadConfigFromYaml(filename string) *Config {
	fmt.Printf("Loading config from %s\n", filename)
	yamlFile, err := ioutil.ReadFile(filename)
	if err != nil {
		log.Printf("yamlFile.Get err #%v ", err)
	}

	yamlFile = []byte(os.ExpandEnv(string(yamlFile)))
	err = yaml.Unmarshal(yamlFile, c)
	if err != nil {
		log.Fatalf("Unmarshal err: %v", err)
	}

	c.ConfigFilePath = filename
	return c
}

// Parse flags and env variables to given struct using go-flags
// parser
func parseStructFlagsAndEnv() configFlags {
	var tmpConfig configFlags
	parser := flags.NewParser(&tmpConfig, flags.Default)
	if _, err := parser.Parse(); err != nil {
		if flagsErr, ok := err.(*flags.Error); ok && flagsErr.Type == flags.ErrHelp {
			os.Exit(0)
		}
		l
```

### Core Architecture Module: `config/yaml.go`
```
package config

/*********************************************
 * Custom UnmarshalYAML used to define some struct fields
 * default values where go-flags ones aren't applicable
 * (and so makes them optional)
 *********************************************/

func (s *Config) UnmarshalYAML(unmarshal func(interface{}) error) error {
	type rawConfig Config
	raw := rawConfig{
		DB: DBConfig{
			Host:         "db",
			Port:         5432,
			User:         "gorm",
			Name:         "gorm",
			SSLMode:      "require",
			SyncInterval: 1,
		},
		Log: LogConfig{
			Level:  "info",
			Format: "plain",
		},
		Web: WebConfig{
			Port:        8080,
			SwaggerPort: 8081,
			BaseURL:     "/",
		},
	}
	if err := unmarshal(&raw); err != nil {
		return err
	}

	*s = Config(raw)
	return nil
}

func (s *S3BucketConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	type rawS3BucketConfig S3BucketConfig
	raw := rawS3BucketConfig{
		FileExtension: []string{".tfstate"},
	}
	if err := unmarshal(&raw); err != nil {
		return err
	}

	*s = S3BucketConfig(raw)
	return nil
}

func (s *GitlabConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
	type rawGitlabConfig GitlabConfig
	raw := rawGitlabConfig{
		Address: "https://gitlab.com",
	}
	if err := unmarshal(&raw); err != nil {
		return err
	}

	*s = GitlabConfig(raw)
	return nil
}

```

### Core Architecture Module: `db/db.go`
```
package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"sync"

	"github.com/camptocamp/terraboard/config"
	"github.com/camptocamp/terraboard/internal/terraform/addrs"
	"github.com/camptocamp/terraboard/internal/terraform/states"
	"github.com/camptocamp/terraboard/internal/terraform/states/statefile"
	"github.com/camptocamp/terraboard/state"
	"github.com/camptocamp/terraboard/types"
	log "github.com/sirupsen/logrus"

	ctyJson "github.com/zclconf/go-cty/cty/json"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Database is a wrapping structure to *gorm.DB
type Database struct {
	*gorm.DB
	lock sync.Mutex
}

var pageSize = 20

// Init setups up the Database and a pointer to it
func Init(config config.DBConfig, debug bool) *Database {
	var err error
	connString := fmt.Sprintf(
		"host=%s port=%d user=%s dbname=%s sslmode=%s password=%s",
		config.Host,
		config.Port,
		config.User,
		config.Name,
		config.SSLMode,
		config.Password,
	)
	db, err := gorm.Open(postgres.Open(connString), &gorm.Config{
		Logger: &LogrusGormLogger,
	})
	if err != nil {
		log.Fatal(err)
	}

	log.Infof("Automigrate")
	err = db.AutoMigrate(
		&types.Lineage{},
		&types.Version{},
		&types.State{},
		&types.Module{},
		&types.Resource{},
		&types.Attribute{},
		&types.OutputValue{},
		&types.Plan{},
		&types.PlanModel{},
		&types.PlanModelVariable{},
		&types.PlanOutput{},
		&types.PlanResourceChange{},
		&types.PlanState{},
		&types.PlanStateModule{},
		&types.PlanStateOutput{},
		&types.PlanStateResource{},
		&types.PlanStateResourceAttribute{},
		&types.PlanStateValue{},
		&types.Change{},
	)
	if err != nil {
		log.Fatalf("Migration failed: %v\n", err)
	}

	if debug {
		db.Config.Logger.LogMode(logger.Info)
	}

	d := &Database{DB: db}
	if err = d.MigrateLineage(); err != nil {
		log.Fatalf("Lineage migration failed: %v\n", err)
	}

	return d
}

// MigrateLineage is a migration function to update db and its data to the
// new lineage db scheme. It will update State table data, delete "lineage" column
// and add corresponding Lineage entries
func (db *Database) MigrateLineage() error {
	if db.Migrator().HasColumn(&types.State{}, "lineage") {
		var states []types.State
		if err := db.Find(&states).Error; err != nil {
			return err
		}

		for _, st := range states {
			if err := db.UpdateState(st); err != nil {
				return fmt.Errorf("Failed to update %s state during lineage migration: %v", st.Path, err)
			}
		}

		// Custom migration rules
		if err := db.Migrator().DropColumn(&types.State{}, "lineage"); err != nil {
			return fmt.Errorf("Failed to drop lineage column during migration: %v", err)
		}
	}

	return nil
}

type attributeValues map[string]interface{}

func (db *Database) stateS3toDB(sf *statefile.File, path string, versionID string) (st types.State, err error) {
	var version types.Version
	db.First(&version, types.Version{VersionID: versionID})

	// Check if the associated lineage is already present in lineages table
	// If so, it recovers its ID otherwise it inserts it at the same time as the state
	var lineage types.Lineage
	db.lock.Lock()
	err = db.FirstOrCreate(&lineage, types.Lineage{Value: sf.Lineage}).Error
	if err != nil || lineage.ID == 0 {
		log.WithField("error", err).
			Error("Unknown error in stateS3toDB during lineage finding")
		return types.State{}, err
	}
	db.lock.Unlock()

	st = types.State{
		Path:      path,
		Version:   version,
		TFVersion: sf.TerraformVersion.String(),
		Serial:    int64(sf.Serial),
		LineageID: sql.NullInt64{Int64: int64(lineage.ID), Valid: true},
	}

	for _, m := range sf.State.Modules {
		mod := types.Module{
			Path: m.Addr.String(),
		}
		for _, r := range m.Resources {
			for index, i := range r.Instances {
				res := types.Resource{
					Type:       r.Addr.Resource.Type,
					Name:       r.Addr.Resource.Name,
					Index:      getResourceIndex(index),
					Attributes: marshalAttributeValues(i.Current),
				}
				mod.Resources = append(mod.Resources, res)
			}
		}

		for n, r := range m.OutputValues {
			jsonVal, err := ctyJson.Marshal(r.Value, r.Value.Type())
			if err != nil {
				log.WithError(err).Errorf("failed to load output for %s", r.Addr.String())
			}
			out := types.OutputValue{
				Sensitive: r.Sensitive,
				Name:      n,
				Value:     string(jsonVal),
			}

			mod.OutputValues = append(mod.OutputValues, out)
		}

		st.Modules = append(st.Modules, mod)
	}
	return
}

// getResourceIndex transforms an addrs.InstanceKey instance into a string representation
func getResourceIndex(index addrs.InstanceKey) string {
	switch index.(type) {
	case addrs.IntKey, addrs.StringKey:
		return index.String()
	}
	return ""
}

func marshalAttributeValues(src *states.ResourceInstanceObjectSrc) (attrs []types.Attribute) {
	vals := make(attributeValues)
	if src == nil {
		return
	}
	if src.AttrsFlat != nil {
		for k, v := range src.AttrsFlat {
			vals[k] = v
		}
	} else if err := json.Unmarshal(src.AttrsJSON, &vals); err != nil {
		log.Error(err.Error())
	}
	log.Debug(vals)

	for k, v := range vals {
		vJSON, _ := json.Marshal(v)
		attr := types.Attribute{
			Key:   k,
			Value: string(vJSON),
		}
		log.Debug(attrs)
		attrs = append(attrs, attr)
	}
	return attrs
}

// InsertState inserts a Terraform State in the Database
func (db *Database) InsertState(path string, versionID string, sf *statefile.File) error {
	st, err := db.stateS3toDB(sf, path, versionID)
	if err == nil {
		db.Create(&st)
	}
	return nil
}

// UpdateState update a Terraform State in the Database with Lineage foreign constraint
// It will also insert Lineage entry in the db if needed.
// This method is only use during the Lineage migration since States are immutable
func (db *Database) UpdateState(st types.State) error {
	// Get lineage from old column
	var lineageValue sql.NullString
	if err := db.Raw("SELECT lineage FROM states WHERE id = ?", st.ID).Scan(&lineageValue).Error; err != nil {
		return fmt.Errorf("Error on %s lineage recovering during migration: %v", st.Path, err)
	}
	if lineageValue.String == "" || !lineageValue.Valid {
		log.Warnf("Missing lineage for '%s' state, attempt to recover lineage from other states...", st.Path)
		var lineages []string
		db.Table("states").
			Distinct("lineage").
			Order("lineage desc").
			Where("path = ?", st.Path).
			Scan(&lineages)

		for _, l := range lineages {
			if l != "" {
				lineageValue.String = l
				lineageValue.Valid = true
				log.Infof("Missing lineage for '%s' state solved!", st.Path)
				break
			}
		}

		if lineageValue.String == "" || !lineageValue.Valid {
			log.Warnf("Failed to recover '%s' lineage from others states. Orphan state", st.Path)
			return nil
		}
	}

	// Create Lineage entry if not exist (value column is unique)
	lineage := types.Lineage{
		Value: lineageValue.String,
	}
	tx := db.FirstOrCreate(&lineage, lineage)
	if tx.Error != nil || lineage.ID == 0 {
		return tx.Error
	}

	// Get Lineage ID for foreign constraint
	st.LineageID = sql.NullInt64{Int64: int64(lineage.ID), Valid: true}

	return db.Save(&st).Error
}

// InsertVersion inserts an AWS S3 Version in the Database
func (db *Database) InsertVersion(version *state.Version) error {
	var v types.Version
	db.lock.Lock()
	db.FirstOrCreate(&v, types.Version{
		VersionID:    version.ID,
		LastModified: version.LastModified,
	})
	db.lock.Unlock()
	return nil
}

// GetState retrieves a State from the database by its path and versionID
func (db *Database) GetState(lineage, versionID string) (state types.State) {
	db.Joins("JOIN lineages on states.lineage_id=lineages.id").
		Joins("JOIN versions on states.version_id=versions.id").
		Preload("Version").Preload("Modules").Preload("Modules.Resources").Preload("Modules.Resources.Attributes").
		Preload("Modules.OutputValues").
		Find(&state, "lineages.value = ? AND versions.version_id = ?", lineage, versionID)
	return
}

// GetLineageActivity returns a slice of StateStat from the Database
// for a given lineage representing the St
```

### Core Architecture Module: `db/logger.go`
```
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/utils"
)

/*********************************************
 * Custom logger definition for Gorm to use Logrus
 * Implement gorm Logger iterface
 * Based on : https://github.com/go-gorm/gorm/blob/master/logger/logger.go
 *********************************************/

// GormLogger is a wrapper class that implement Gorm logger interface
type GormLogger struct {
	LogLevel      logger.LogLevel
	SlowThreshold time.Duration
}

var (
	// LogrusGormLogger default GormLogger instance for Gorm logging through Logrus
	LogrusGormLogger = GormLogger{
		LogLevel:      logger.Warn,
		SlowThreshold: 200 * time.Millisecond,
	}
)

// LogMode log mode
func (l *GormLogger) LogMode(level logger.LogLevel) logger.Interface {
	newlogger := *l
	l.LogLevel = level
	return &newlogger
}

// Info print info
func (l *GormLogger) Info(ctx context.Context, msg string, data ...interface{}) {
	if l.LogLevel >= logger.Info {
		logrus.WithContext(ctx).Info(msg, append([]interface{}{utils.FileWithLineNum()}, data...))
	}
}

// Warn print warn messages
func (l *GormLogger) Warn(ctx context.Context, msg string, data ...interface{}) {
	if l.LogLevel >= logger.Warn {
		logrus.WithContext(ctx).Warn(msg, append([]interface{}{utils.FileWithLineNum()}, data...))
	}
}

// Error print error messages
func (l *GormLogger) Error(ctx context.Context, msg string, data ...interface{}) {
	if l.LogLevel >= logger.Error {
		logrus.WithContext(ctx).Error(msg, append([]interface{}{utils.FileWithLineNum()}, data...))
	}
}

// Trace print sql message
func (l *GormLogger) Trace(ctx context.Context, begin time.Time, fc func() (string, int64), err error) {
	if l.LogLevel > 0 {
		elapsed := time.Since(begin)
		switch {
		case err != nil && l.LogLevel >= logger.Error:
			sql, rows := fc()
			if rows == -1 {
				logrus.WithContext(ctx).Error(utils.FileWithLineNum(), err, float64(elapsed.Nanoseconds())/1e6, "-", sql)
			} else {
				logrus.WithContext(ctx).Error(utils.FileWithLineNum(), err, float64(elapsed.Nanoseconds())/1e6, rows, sql)
			}
		case elapsed > l.SlowThreshold && l.SlowThreshold != 0 && l.LogLevel >= logger.Warn:
			sql, rows := fc()
			slowLog := fmt.Sprintf("SLOW SQL >= %v", l.SlowThreshold)
			if rows == -1 {
				logrus.WithContext(ctx).Warn(utils.FileWithLineNum(), slowLog, float64(elapsed.Nanoseconds())/1e6, "-", sql)
			} else {
				logrus.WithContext(ctx).Warn(utils.FileWithLineNum(), slowLog, float64(elapsed.Nanoseconds())/1e6, rows, sql)
			}
		case l.LogLevel >= logger.Info:
			sql, rows := fc()
			if rows == -1 {
				logrus.WithContext(ctx).Debug(utils.FileWithLineNum(), float64(elapsed.Nanoseconds())/1e6, "-", sql)
			} else {
				logrus.WithContext(ctx).Debug(utils.FileWithLineNum(), float64(elapsed.Nanoseconds())/1e6, rows, sql)
			}
		}
	}
}

```

### Core Architecture Module: `internal/terraform/addrs/check.go`
```
package addrs

import "fmt"

// Check is the address of a check rule within a checkable object.
//
// This represents the check rule globally within a configuration, and is used
// during graph evaluation to identify a condition result object to update with
// the result of check rule evaluation.
//
// The check address is not distinct from resource traversals, and check rule
// values are not intended to be available to the language, so the address is
// not Referenceable.
//
// Note also that the check address is only relevant within the scope of a run,
// as reordering check blocks between runs will result in their addresses
// changing.
type Check struct {
	Container Checkable
	Type      CheckType
	Index     int
}

func (c Check) String() string {
	container := c.Container.String()
	switch c.Type {
	case ResourcePrecondition:
		return fmt.Sprintf("%s.preconditions[%d]", container, c.Index)
	case ResourcePostcondition:
		return fmt.Sprintf("%s.postconditions[%d]", container, c.Index)
	case OutputPrecondition:
		return fmt.Sprintf("%s.preconditions[%d]", container, c.Index)
	default:
		// This should not happen
		return fmt.Sprintf("%s.conditions[%d]", container, c.Index)
	}
}

// Checkable is an interface implemented by all address types that can contain
// condition blocks.
type Checkable interface {
	checkableSigil()

	// Check returns the address of an individual check rule of a specified
	// type and index within this checkable container.
	Check(CheckType, int) Check
	String() string
}

var (
	_ Checkable = AbsResourceInstance{}
	_ Checkable = AbsOutputValue{}
)

type checkable struct {
}

func (c checkable) checkableSigil() {
}

// CheckType describes the category of check.
//go:generate go run golang.org/x/tools/cmd/stringer -type=CheckType check.go
type CheckType int

const (
	InvalidCondition      CheckType = 0
	ResourcePrecondition  CheckType = 1
	ResourcePostcondition CheckType = 2
	OutputPrecondition    CheckType = 3
)

// Description returns a human-readable description of the check type. This is
// presented in the user interface through a diagnostic summary.
func (c CheckType) Description() string {
	switch c {
	case ResourcePrecondition:
		return "Resource precondition"
	case ResourcePostcondition:
		return "Resource postcondition"
	case OutputPrecondition:
		return "Module output value precondition"
	default:
		// This should not happen
		return "Condition"
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #236** (2022-10-15): **Missing results following scan of bucket **
  *Symptoms*: I have followed instructions for launching terraboard from docker, and last week was able to display results. However, while preparing to demo to my team today, my results are unavailable. Here is partial log of run:  ``` docker logs terraboard Loading config from /temp/thiscorp.yaml time="2022-04-12T05:44:18Z" level=info msg="Terraboard vv2.1.1 (built for Terraform v1.0.2) is starting..." time="2022-04-12T05:44:18Z" level=info msg="Using AWS (S3+DynamoDB) as state/locks provider" time="2022-04-12T05:44:18Z" level=info msg=Automigrate time="2022-04-12T05:44:18Z" level=info msg="Refreshing DB" time="2022-04-12T05:44:18Z" level=info msg="Serving swagger on port 8081"  ``` I'm pretty sure the large state files are an issue
  **Post-Mortem & Fix Analysis**:
  > Display screenshot <img width="1423" alt="Screen Shot 2022-04-12 at 10 10 10 AM" src="https://user-images.githubusercontent.com/41868/163028527-4cfd9883-1b28-4763-b3f1-3ed6576c53f8.png">  
  > I set log-level to debug, and now my screen-shot looks like this: <img width="1102" alt="Screen Shot 2022-04-12 at 1 18 44 PM" src="https://user-images.githubusercontent.com/41868/163046913-55a7c286-e1d0-4a9f-b194-2efa1ba61300.png">  
  > Why doesn't the version show in the footer?

- **Issue #151** (2021-04-15): **Fix website Docker example as per README**
  *Symptoms*: Fix #150  Signed-off-by: Raphaël Pinson <raphael.pinson@camptocamp.com>

- **Issue #141** (2021-02-23): **Fix environment variable for APPRoleArn on README**
  *Symptoms*: Hello,   This PR fixes a small issue found at README. According to the config file (https://github.com/camptocamp/terraboard/blob/master/config/config.go#L47), the variable `--app-role-arn` can be provided using the environment variable `APP_ROLE_ARN`.  Regards,
  **Post-Mortem & Fix Analysis**:
  >  [![Coverage Status](https://coveralls.io/builds/37317887/badge)](https://coveralls.io/builds/37317887)  Coverage remained the same at 13.727% when pulling **26f50f06d7b7d74aacedebcc49e89e8b4db22928 on alemuro:fix-typo-assumerole** into **49b6fc2f91c7b8b079385350be4668b57ba4c454 on camptocamp:master**. 

- **Issue #138** (2021-02-17): **Fix nill pointer**
  *Symptoms*: ### Fix for https://github.com/camptocamp/terraboard/issues/107 Terraform `ResourceInstance.Current` can be [`nil`](https://github.com/hashicorp/terraform/blob/master/states/resource.go#L59)  which causes a nil pointer dereference in [`db.go`](https://github.com/camptocamp/terraboard/blob/master/db/db.go#L93)  I haven't investigated deeper into Terraform code, just added a simple check. There might be some consequences I am not aware of, but it seems to be working just fine. 
  **Post-Mortem & Fix Analysis**:
  > Good catch!

- **Issue #133** (2021-02-03): **Fixed failing CI following recent changes introducing GitLab backend support**
  *Symptoms*: Apologies on this I did not properly run them before submitting 🤦 
  **Post-Mortem & Fix Analysis**:
  > Thanks for this. From what I see, this is a breaking change, which will require a major release.
  > Can we get this in to fix CI? It's failing on all other PRs.
  > Going for a major release next 😁

- **Issue #132** (2021-01-14): **Fixed ineffassign definition following a recent update**
  *Symptoms*: tests are now failing: https://travis-ci.org/github/camptocamp/terraboard/builds/754109002  ``` ineffassign compare/compare_test.go compare/compare.go db/db.go db/db_test.go config/config.go config/config_test.go auth/auth.go auth/auth_test.go api/api.go api/api_test.go util/util.go util/util_test.go types/db.go types/search_test.go types/compare_test.go types/db_test.go types/search.go types/compare.go state/tfe_test.go state/aws_test.go state/state_test.go state/gcp_test.go state/tfe.go state/aws.go state/state.go state/gcp.go  -: named files must all be in one directory; have compare/ and db/  ineffassign: error during loading  Makefile:40: recipe for target 'ineffassign' failed  make: *** [ineffassign] Error 1 ``` 
  **Post-Mortem & Fix Analysis**:
  >  [![Coverage Status](https://coveralls.io/builds/36272264/badge)](https://coveralls.io/builds/36272264)  Coverage remained the same at 15.541% when pulling **e155de245d5ac2c9ae1dabb08680d6b35cfff918 on mvisonneau:ineffassign_fix** into **ccde60d99feb4bc75fa631ecaf4e887a215413d5 on camptocamp:master**. 

- **Issue #105** (2021-04-27): **Panic at start with 0.22.0**
  *Symptoms*: Hello!  I just attempted an update to 0.22.0 and received a panic on startup:  ``` time="2020-08-14T19:51:13Z" level=info msg="Terraboard v0.22.0 (built for Terraform v0.13.0) is starting..." panic: terraform.io/builtin/terraform is not a legacy addrs.Provider ```  Has 0.22.0 dropped support for state file versions older than 0.13.0?  This issue describes a similar error which may have been fixed in newer versions of the module? https://github.com/hashicorp/terraform/issues/25803
  **Post-Mortem & Fix Analysis**:
  > That is unfortunately possible. I'll try to investigate this, but I did have to patch that part in order to support Terraform 0.13, so I wouldn't be too surprised if the Terraform 0.13 libraries dropped support for older statefile formats...
  > I had to use 0.21.0 due to this issue
  > This issue has been automatically marked as stale because it has not had recent activity. It will be closed if no further activity occurs. Thank you for your contributions. 

- **Issue #97** (2020-10-01): **Resources created using `for_each` are missing**
  *Symptoms*: I have a bunch of resources created using [`for_each`](https://www.terraform.io/docs/configuration/resources.html#for_each-multiple-resource-instances-defined-by-a-map-or-set-of-strings), however, only 1 resource appears in terraboard.  Seems like the tool is not properly managing the `0.12` syntax features.

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

### Incident Patch 1: `b264059d` (2023-10-26)
**Commit Message**: docs: docker registry warning on readme and changelog fix

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 
 ### Features
 
-* **go:** upgrade Terraboard's Go version to v1.17 ([e457ebc](https://www.github.com/camptocamp/terraboard/commit/e457ebc154730baea6fbbf1723e52e417c67f55c))
+* **go:** upgrade Terraboard's Go version to v1.21
 * **internal:** update Terraform's internal packages ([e457ebc](https://www.github.com/camptocamp/terraboard/commit/e457ebc154730baea6fbbf1723e52e417c67f55c))
 
 
```

**File**: `README.md` (modified, +8/-6)
```diff
@@ -30,6 +30,8 @@
 
 ---
 
+<p align="center"><strong>Caution: Terraboard's Docker registry was migrated from Dockerhub to GHCR! All new tags will be now pushed <a href="https://github.com/camptocamp/terraboard/pkgs/container/terraboard">here</a>. You can still access to old tags on the legacy Dockerhub repository.</strong></p>
+
 <details><summary>Table of content</summary>
 
 - [What is it?](#what-is-it)
@@ -93,7 +95,7 @@ It currently supports several remote state backend providers:
 - [GitLab](https://docs.gitlab.com/ee/user/infrastructure/terraform_state.html)
 
 Terraboard is now able to handle multiple buckets/providers configuration! 🥳
-Check *configuration* section for more details. 
+Check *configuration* section for more details.
 
 ### Overview
 
@@ -175,22 +177,22 @@ aws:
     s3:
       - bucket: test-bucket
         force-path-style: true
-        file-extension: 
+        file-extension:
           - .tfstate
 
   - endpoint: http://minio:9000/
     region: eu-west-1
     s3:
       - bucket: test-bucket2
         force-path-style: true
-        file-extension: 
+        file-extension:
           - .tfstate
 ```
 
 In the case of AWS, don't forget to set the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables.
 
 That's it! Terraboard will now fetch these two buckets on DB refresh. You can also mix providers like AWS and Gitlab or anything else.
-You can find a ready-to-use Docker example with two *MinIO* buckets in the `test/multiple-minio-buckets/` sub-folder. 
+You can find a ready-to-use Docker example with two *MinIO* buckets in the `test/multiple-minio-buckets/` sub-folder.
 
 ### Available parameters
 
@@ -199,7 +201,7 @@ You can find a ready-to-use Docker example with two *MinIO* buckets in the `test
 - `-V`, `--version` Display version.
 - `-c`, `--config-file` <default: *$CONFIG_FILE*> Config File path
   - Env: *CONFIG_FILE*
-  
+
 #### General Provider Options
 
 - `--no-versioning` <default: *$TERRABOARD_NO_VERSIONING*> Disable versioning support from Terraboard (useful for S3 compatible providers like MinIO)
@@ -401,7 +403,7 @@ docker run -p 8080:8080 \
   -e DB_PASSWORD="<mypassword>" \
   -e DB_SSLMODE="disable" \
   --net terraboard \
-  camptocamp/terraboard:latest
+  ghcr.io/camptocamp/terraboard:latest
 ```
 
 Then point your browser to http://localhost:8080.
```

---

### Incident Patch 2: `729fc278` (2023-10-26)
**Commit Message**: chore: fix linter issues

**File**: `db/db.go` (modified, +0/-1)
```diff
@@ -477,7 +477,6 @@ func (db *Database) ListStateStats(query url.Values) (states []types.StateStat,
 
 	var paginationQuery string
 	var params []interface{}
-	page = 1
 	if v := string(query.Get("page")); v != "" {
 		page, _ = strconv.Atoi(v) // TODO: err
 		offset := (page - 1) * pageSize
```

**File**: `main.go` (modified, +15/-2)
```diff
@@ -222,14 +222,27 @@ func main() {
 	// Add CORS Middleware to mux router
 	r.Use(corsMiddleware)
 
+	// Create server
+	server := &http.Server{
+		Addr:              fmt.Sprintf(":%v", c.Web.Port),
+		Handler:           r,
+		ReadHeaderTimeout: 3 * time.Second,
+	}
+
 	// Start server
 	log.Debugf("Listening on port %d\n", c.Web.Port)
-	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%v", c.Web.Port), r))
+	log.Fatal(server.ListenAndServe())
 }
 
 func serveSwagger(port int, router *mux.Router) {
+	server := &http.Server{
+		Addr:              fmt.Sprintf(":%v", port),
+		Handler:           router,
+		ReadHeaderTimeout: 3 * time.Second,
+	}
+
 	log.Infof("Serving swagger on port %d", port)
-	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%v", port), router))
+	log.Fatal(server.ListenAndServe())
 }
 
 // spaHandler implements the http.Handler interface, so we can use it
```

---

### Incident Patch 3: `b57f6ed6` (2023-10-26)
**Commit Message**: test: fix bucket creds in multiple-minio-buckets test env

**File**: `test/multiple-minio-buckets/Makefile` (modified, +1/-1)
```diff
@@ -6,6 +6,6 @@ build:
 	UID="${UID}" GID="${GID}" docker-compose build 
 
 test:
-	UID="${UID}" GID="${GID}" docker-compose up -d
+	UID="${UID}" GID="${GID}" docker-compose up 
 
 all: build test
```

**File**: `test/multiple-minio-buckets/config.yml` (modified, +2/-2)
```diff
@@ -11,8 +11,8 @@ provider:
   no-versioning: true
 
 aws:
-  - access-key: ${AWS_ACCESS_KEY_ID}
-    secret-access-key: ${AWS_SECRET_ACCESS_KEY}
+  - access-key: root
+    secret-access-key: mypassword
     endpoint: http://minio:9000/
     region: eu-west-1
     s3:
```

---

### Incident Patch 4: `a2f65899` (2022-05-25)
**Commit Message**: fix: remove duplicated 'v' on terraboard version (frontend/logs)

**File**: `config/config.go` (modified, +1/-1)
```diff
@@ -172,7 +172,7 @@ func LoadConfig(version string) *Config {
 	parsedConfig := parseStructFlagsAndEnv()
 
 	if parsedConfig.Version {
-		fmt.Printf("Terraboard v%v (built for Terraform v%v)\n", version, tfversion.Version)
+		fmt.Printf("Terraboard %v (built for Terraform v%v)\n", version, tfversion.Version)
 		os.Exit(0)
 	}
 
```

**File**: `main.go` (modified, +1/-1)
```diff
@@ -152,7 +152,7 @@ func main() {
 
 	util.SetBasePath(c.Web.BaseURL)
 
-	log.Infof("Terraboard v%s (built for Terraform v%s) is starting...", version, tfversion.Version)
+	log.Infof("Terraboard %s (built for Terraform v%s) is starting...", version, tfversion.Version)
 
 	err := c.SetupLogging()
 	if err != nil {
```

**File**: `static/terraboard-vuejs/src/components/Footer.vue` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 <div class="navbar mt-auto">
     <div class="container-fluid mx-1">
         <ul class="nav navbar-nav" id="navbar-collapse-menu">
-            <li><a href="https://github.com/camptocamp/terraboard/releases" target="_blank">Terraboard v{{ version }}</a></li>
+            <li><a href="https://github.com/camptocamp/terraboard/releases" target="_blank">Terraboard {{ version }}</a></li>
         </ul>
         <ul class="nav navbar-nav navbar-right" id="navbar-collapse-menu">
             <li><a href="https://www.camptocamp.com/" target="_blank">{{ copyright }}</a></li>
```

---

### Incident Patch 5: `3f31b1f0` (2022-05-25)
**Commit Message**: fix(config): missing default values with yaml

**File**: `config/config_test.go` (modified, +36/-38)
```diff
@@ -6,6 +6,7 @@ import (
 	"testing"
 
 	"github.com/davecgh/go-spew/spew"
+	"github.com/jessevdk/go-flags"
 	log "github.com/sirupsen/logrus"
 )
 
@@ -24,17 +25,22 @@ func TestSetLogging_debug(t *testing.T) {
 }
 
 func TestLoadConfig(t *testing.T) {
-	t.Skip("Skipping this test since go-flags can't parse properlly flags with go test command")
-
-	c := LoadConfig("1.0.0")
-	compareConfig := Config{
+	var tmpConfig configFlags
+	parser := flags.NewParser(&tmpConfig, flags.Default)
+	if _, err := parser.ParseArgs([]string{"--db-host=test", "--port=1234"}); err != nil {
+		if flagsErr, ok := err.(*flags.Error); ok && flagsErr.Type == flags.ErrHelp {
+			os.Exit(0)
+		}
+		log.Fatalf("Failed to parse flags: %s", err)
+	}
+	compareConfig := configFlags{
 		Log: LogConfig{
 			Level:  "info",
 			Format: "plain",
 		},
 		ConfigFilePath: "",
 		DB: DBConfig{
-			Host:         "db",
+			Host:         "test",
 			Port:         5432,
 			User:         "gorm",
 			Password:     "",
@@ -43,50 +49,42 @@ func TestLoadConfig(t *testing.T) {
 			NoSync:       false,
 			SyncInterval: 1,
 		},
-		AWS: []AWSConfig{
-			{
-				AccessKey:       "",
-				SecretAccessKey: "",
-				DynamoDBTable:   "",
-				S3: []S3BucketConfig{{
-					Bucket:         "",
-					KeyPrefix:      "",
-					FileExtension:  []string{".tfstate"},
-					ForcePathStyle: false,
-				}},
-			},
+		AWS: AWSConfig{
+			AccessKey:       "",
+			SecretAccessKey: "",
+			DynamoDBTable:   "",
 		},
-		TFE: []TFEConfig{
-			{
-				Address:      "",
-				Token:        "",
-				Organization: "",
-			},
+		S3: S3BucketConfig{
+			Bucket:         "",
+			KeyPrefix:      "",
+			FileExtension:  []string{".tfstate"},
+			ForcePathStyle: false,
 		},
-		GCP: []GCPConfig{
-			{
-				GCSBuckets: nil,
-				GCPSAKey:   "",
-			},
+		TFE: TFEConfig{
+			Address:      "",
+			Token:        "",
+			Organization: "",
 		},
-		Gitlab: []GitlabConfig{
-			{
-				Address: "https://gitlab.com",
-				Token:   "",
-			},
+		GCP: GCPConfig{
+			GCSBuckets: nil,
+			GCPSAKey:   "",
+		},
+		Gitlab: GitlabConfig{
+			Address: "https://gitlab.com",
+			Token:   "",
 		},
 		Web: WebConfig{
-			Port:        8080,
+			Port:        1234,
 			SwaggerPort: 8081,
 			BaseURL:     "/",
 			LogoutURL:   "",
 		},
 	}
 
-	if !reflect.DeepEqual(*c, compareConfig) {
+	if !reflect.DeepEqual(tmpConfig, compareConfig) {
 		t.Errorf(
 			"TestLoadConfig() -> \n\ngot:\n%v,\n\nwant:\n%v",
-			spew.Sdump(*c),
+			spew.Sdump(tmpConfig),
 			spew.Sdump(compareConfig),
 		)
 	}
@@ -109,9 +107,9 @@ func TestLoadConfigFromYaml(t *testing.T) {
 			User:         "terraboard-user",
 			Password:     "terraboard-pass",
 			Name:         "terraboard-db",
-			SSLMode:      "",
+			SSLMode:      "require",
 			NoSync:       true,
-			SyncInterval: 0,
+			SyncInterval: 1,
 		},
 		AWS: []AWSConfig{
 			{
```

**File**: `config/config_test.yml` (modified, +0/-1)
```diff
@@ -38,6 +38,5 @@ gitlab:
 
 web:
   port: 39090
-  swagger-port: 8081
   base-url: /test/
   logout-url: /test-logout
```

**File**: `config/yaml.go` (modified, +29/-0)
```diff
@@ -6,6 +6,35 @@ package config
  * (and so makes them optional)
  *********************************************/
 
+func (s *Config) UnmarshalYAML(unmarshal func(interface{}) error) error {
+	type rawConfig Config
+	raw := rawConfig{
+		DB: DBConfig{
+			Host:         "db",
+			Port:         5432,
+			User:         "gorm",
+			Name:         "gorm",
+			SSLMode:      "require",
+			SyncInterval: 1,
+		},
+		Log: LogConfig{
+			Level:  "info",
+			Format: "plain",
+		},
+		Web: WebConfig{
+			Port:        8080,
+			SwaggerPort: 8081,
+			BaseURL:     "/",
+		},
+	}
+	if err := unmarshal(&raw); err != nil {
+		return err
+	}
+
+	*s = Config(raw)
+	return nil
+}
+
 func (s *S3BucketConfig) UnmarshalYAML(unmarshal func(interface{}) error) error {
 	type rawS3BucketConfig S3BucketConfig
 	raw := rawS3BucketConfig{
```

---

### Incident Patch 6: `56dbee8d` (2022-05-25)
**Commit Message**: fix(db): possible sql injection on /search endpoint (#247)

**File**: `db/db.go` (modified, +4/-2)
```diff
@@ -370,11 +370,13 @@ func (db *Database) SearchAttribute(query url.Values) (results []types.SearchRes
 	}
 
 	if v := query.Get("tf_version"); string(v) != "" {
-		where = append(where, fmt.Sprintf("states.tf_version LIKE '%s'", fmt.Sprintf("%%%s%%", v)))
+		where = append(where, "states.tf_version LIKE ?")
+		params = append(params, fmt.Sprintf("%%%s%%", v))
 	}
 
 	if v := query.Get("lineage_value"); string(v) != "" {
-		where = append(where, fmt.Sprintf("lineages.value LIKE '%s'", fmt.Sprintf("%%%s%%", v)))
+		where = append(where, "lineages.value LIKE ?")
+		params = append(params, fmt.Sprintf("%%%s%%", v))
 	}
 
 	if len(where) > 0 {
```

---

### Incident Patch 7: `608d9d5c` (2022-05-24)
**Commit Message**: docs: create SECURITY.md (#246)

**File**: `SECURITY.md` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+# Security Policy
+
+Welcome and thanks for helping us make safe solutions for everyone.
+
+## Supported Versions
+
+| Version | Supported          |
+| ------- | ------------------ |
+| 2.1.x   | :white_check_mark: |
+| < 2.1   | :x:                |
+
+## Reporting a Vulnerability
+
+If you believe you have found a security vulnerability in any **Camptocamp**-owned repository, please report it to us through coordinated disclosure.
+
+**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**
+
+Instead, please send an email to security.inf@camptocamp.com.
+
+Please include as much of the information listed below as you can to help us better understand and resolve the issue:
+
+  * The type of issue (e.g., buffer overflow, SQL injection, or cross-site scripting)
+  * Full paths of source file(s) related to the manifestation of the issue
+  * The location of the affected source code (tag/branch/commit or direct URL)
+  * Any special configuration required to reproduce the issue
+  * Step-by-step instructions to reproduce the issue
+  * Proof-of-concept or exploit code (if possible)
+  * Impact of the issue, including how an attacker might exploit the issue
+
+This information will help us triage your report more quickly.
+
+## Security
+
+**Camptocamp** takes the security of our software products and services seriously, including all of the open source code repositories managed through our GitHub organizations, such as [Camptocamp](https://github.com/camptocamp).
```

---

### Incident Patch 8: `1fc682a1` (2022-03-05)
**Commit Message**: fix(build): invalid version number displayed (#229) (#231)

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ NAME          				  := terraboard
 FILES         				  := $(wildcard */*.go)
 TEST_FILES    				  := $(shell go list ./... | grep -v /internal/)
 TEST_FILES_COMMA_SEPARATED    := $(shell go list ./... | grep -v /internal/ | awk '{print}' ORS=',')
-VERSION       				  := $(shell git describe --always)
+VERSION       				  := $(shell git describe --always --tags)
 .DEFAULT_GOAL 				  := help
 
 export GO111MODULE=on
```

---

### Incident Patch 9: `e7d29230` (2022-02-21)
**Commit Message**: Fix typo - WS_DYNAMODB_TABLE to AWS_DYNAMODB_TABLE (#228)

Fixing typo - WS_DYNAMODB_TABLE should be AWS_DYNAMODB_TABLE

**File**: `README.md` (modified, +1/-1)
```diff
@@ -397,7 +397,7 @@ docker run -p 8080:8080 \
   -e AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}" \
   -e AWS_REGION="${AWS_DEFAULT_REGION}" \
   -e AWS_BUCKET="${AWS_BUCKET}" \
-  -e WS_DYNAMODB_TABLE="${AWS_DYNAMODB_TABLE}" \
+  -e AWS_DYNAMODB_TABLE="${AWS_DYNAMODB_TABLE}" \
   -e DB_PASSWORD="<mypassword>" \
   -e DB_SSLMODE="disable" \
   --net terraboard \
```

---

### Incident Patch 10: `b219b9e1` (2022-02-08)
**Commit Message**: fix(docker-compose): wrong username used in pg healthcheck

**File**: `docker-compose.yml` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ services:
     volumes:
       - tb-data:/var/lib/postgresql/data
     healthcheck:
-      test: ["CMD-SHELL", "pg_isready -U postgres"]
+      test: ["CMD-SHELL", "pg_isready -U gorm"]
       interval: 10s
       timeout: 5s
       retries: 5
```

**File**: `test/multiple-minio-buckets/docker-compose.yml` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ services:
     volumes:
       - tb-data:/var/lib/postgresql/data
     healthcheck:
-      test: ["CMD-SHELL", "pg_isready -U postgres"]
+      test: ["CMD-SHELL", "pg_isready -U gorm"]
       interval: 10s
       timeout: 5s
       retries: 5
```

**File**: `test/single-minio-bucket/docker-compose.yml` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ services:
     volumes:
       - tb-data:/var/lib/postgresql/data
     healthcheck:
-      test: ["CMD-SHELL", "pg_isready -U postgres"]
+      test: ["CMD-SHELL", "pg_isready -U gorm"]
       interval: 10s
       timeout: 5s
       retries: 5
```

#### Recent Merged Pull Requests:
- **PR #332** (closed): chore(deps): bump axios from 1.7.2 to 1.15.2 in /static/terraboard-vuejs (@dependabot[bot])
- **PR #329** (closed): chore(deps): bump github.com/jackc/pgx/v5 from 5.5.5 to 5.9.0 (@dependabot[bot])
- **PR #326** (closed): chore(deps): bump axios from 1.7.2 to 1.15.0 in /static/terraboard-vuejs (@dependabot[bot])
- **PR #316** (closed): chore(deps): bump axios from 1.7.2 to 1.13.5 in /static/terraboard-vuejs (@dependabot[bot])
- **PR #314** (closed): chore(deps): bump lodash from 4.17.21 to 4.17.23 in /static/terraboard-vuejs (@dependabot[bot])
- **PR #312** (closed): chore(deps): bump node-forge from 1.3.1 to 1.3.2 in /static/terraboard-vuejs (@dependabot[bot])
- **PR #311** (closed): chore(deps): bump js-yaml from 3.14.1 to 3.14.2 in /static/terraboard-vuejs (@dependabot[bot])
- **PR #310** (closed): chore(deps): bump golang.org/x/crypto from 0.25.0 to 0.45.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
