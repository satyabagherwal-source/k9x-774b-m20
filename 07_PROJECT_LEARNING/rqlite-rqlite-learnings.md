# Forensic Learning Record (Deep Inspection): rqlite/rqlite

> **Canonical Artifact**: `07_PROJECT_LEARNING/rqlite-rqlite-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rqlite/rqlite](https://github.com/rqlite/rqlite))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:28:53.815Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rqlite/rqlite`
- **Description**: The lightweight, fault-tolerant database built on SQLite. Designed to keep your data highly available with minimal effort.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 17778 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `auth/credential_store.go`
```
// Package auth is a lightweight credential store.
// It provides functionality for loading credentials, as well as validating credentials.
package auth

import (
	"encoding/json"
	"io"
	"os"
)

const (
	// AllUsers is the username that indicates all users, even anonymous users (requests without
	// any BasicAuth information).
	AllUsers = "*"

	// PermAll means all actions permitted.
	PermAll = "all"
	// PermJoin means user is permitted to join cluster.
	PermJoin = "join"
	// PermJoinReadOnly means user is permitted to join the cluster only as a read replica node
	PermJoinReadOnly = "join-read-only"
	// PermJoinReadReplica means user is permitted to join the cluster only as a read replica node
	PermJoinReadReplica = "join-read-replica"
	// PermRemove means user is permitted to remove a node.
	PermRemove = "remove"
	// PermExecute means user can access execute endpoint.
	PermExecute = "execute"
	// PermQuery means user can access query endpoint
	PermQuery = "query"
	// PermStatus means user can retrieve node status.
	PermStatus = "status"
	// PermReady means user can retrieve ready status.
	PermReady = "ready"
	// PermBackup means user can backup node.
	PermBackup = "backup"
	// PermLoad means user can load a SQLite dump into a node.
	PermLoad = "load"
	// PermSnapshot means user can request a snapshot.
	PermSnapshot = "snapshot"
	// PermLeaderOps means user can perform leader-related operations.
	PermLeaderOps = "leader-ops"
	// PermCDCHWMUpdate = means a user can perform CDC high watermark updates.
	PermCDCHWMUpdate = "cdc-hwm-update"
	// PermUI means user can access the UI.
	PermUI = "ui"
)

// BasicAuther is the interface an object must support to return basic auth information.
type BasicAuther interface {
	BasicAuth() (string, string, bool)
}

// Credential represents authentication and authorization configuration for a single user.
type Credential struct {
	Username string   `json:"username,omitempty"`
	Password string   `json:"password,omitempty"`
	Perms    []string `json:"perms,omitempty"`
}

// CredentialsStore stores authentication and authorization information for all users.
type CredentialsStore struct {
	store map[string]string
	perms map[string]map[string]bool
}

// NewCredentialsStore returns a new instance of a CredentialStore.
func NewCredentialsStore() *CredentialsStore {
	return &CredentialsStore{
		store: make(map[string]string),
		perms: make(map[string]map[string]bool),
	}
}

// NewCredentialsStoreFromFile returns a new instance of a CredentialStore loaded from a file.
func NewCredentialsStoreFromFile(path string) (*CredentialsStore, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	c := NewCredentialsStore()
	return c, c.Load(f)
}

// Load loads credential information from a reader.
func (c *CredentialsStore) Load(r io.Reader) error {
	dec := json.NewDecoder(r)
	// Read open bracket
	_, err := dec.Token()
	if err != nil {
		return err
	}

	var cred Credential
	for dec.More() {
		err := dec.Decode(&cred)
		if err != nil {
			return err
		}
		c.store[cred.Username] = cred.Password
		c.perms[cred.Username] = make(map[string]bool, len(cred.Perms))
		for _, p := range cred.Perms {
			c.perms[cred.Username][p] = true
		}
	}

	// Read closing bracket.
	_, err = dec.Token()
	if err != nil {
		return err
	}

	return nil
}

// Check returns true if the password is correct for the given username.
func (c *CredentialsStore) Check(username, password string) bool {
	pw, ok := c.store[username]
	return ok && pw == password
}

// Password returns the password for the given user.
func (c *CredentialsStore) Password(username string) (string, bool) {
	pw, ok := c.store[username]
	return pw, ok
}

// CheckRequest returns true if b contains a valid username and password.
func (c *CredentialsStore) CheckRequest(b BasicAuther) bool {
	username, password, ok := b.BasicAuth()
	if !ok || !c.Check(username, password) {
		return false
	}
	return true
}

// HasPerm returns true if username has the given perm, either directly or
// via AllUsers. It does not perform any password checking.
func (c *CredentialsStore) HasPerm(username string, perm string) bool {
	if m, ok := c.perms[username]; ok {
		if _, ok := m[perm]; ok {
			return true
		}
	}

	if m, ok := c.perms[AllUsers]; ok {
		if _, ok := m[perm]; ok {
			return true
		}
	}

	return false
}

// HasAnyPerm returns true if username has at least one of the given perms,
// either directly, or via AllUsers. It does not perform any password checking.
func (c *CredentialsStore) HasAnyPerm(username string, perm ...string) bool {
	return func(p []string) bool {
		for i := range p {
			if c.HasPerm(username, p[i]) {
				return true
			}
		}
		return false
	}(perm)
}

// AA authenticates and checks authorization for the given username and password
// for the given perm. If the credential store is nil, then this function always
// returns true. If AllUsers have the given perm, authentication is not done.
// Only then are the credentials checked, and then the perm checked.
func (c *CredentialsStore) AA(username, password, perm string) bool {
	// No credential store? Auth is not even enabled.
	if c == nil {
		return true
	}

	// Is the required perm granted to all users, including anonymous users?
	if c.HasAnyPerm(AllUsers, perm, PermAll) {
		return true
	}

	// At this point a username needs to have been supplied.
	if username == "" {
		return false
	}

	// Authenticate the user.
	if !c.Check(username, password) {
		return false
	}

	// Is the specified user authorized?
	return c.HasAnyPerm(username, perm, PermAll)
}

// HasPermRequest returns true if the username returned by b has the given perm.
// It does not perform any password checking, but if there is no username
// in the request, it returns false.
func (c *CredentialsStore) HasPermRequest(b BasicAuther, perm string) bool {
	username, _, ok := b.BasicAuth()
	return ok && c.HasPerm(username, perm)
}

```

### Core Architecture Module: `auto/aws/s3.go`
```
package aws

import (
	"context"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var (
	AWSS3IDKey = "x-rqlite-auto-backup-id"
)

// S3Config is the subconfig for the S3 storage type
type S3Config struct {
	Endpoint        string `json:"endpoint,omitempty"`
	Region          string `json:"region"`
	AccessKeyID     string `json:"access_key_id"`
	SecretAccessKey string `json:"secret_access_key"`
	Bucket          string `json:"bucket"`
	Path            string `json:"path"`
	ForcePathStyle  bool   `json:"force_path_style"`
}

// S3Client is a client for uploading data to S3.
type S3Client struct {
	endpoint  string
	region    string
	accessKey string
	secretKey string
	bucket    string
	key       string
	timestamp bool

	s3 *s3.Client

	// These fields are used for testing via dependency injection.
	uploader   uploader
	downloader downloader
	now        func() time.Time
}

// S3ClientOpts are options for creating an S3Client.
type S3ClientOpts struct {
	ForcePathStyle bool
	Timestamp      bool
}

// NewS3Client returns an instance of an S3Client. opts can be nil.
func NewS3Client(endpoint, region, accessKey, secretKey, bucket, key string, opts *S3ClientOpts) (*S3Client, error) {
	// Load the default config
	cfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion(region),
		config.WithRequestChecksumCalculation(aws.RequestChecksumCalculationWhenRequired),
	)
	if err != nil {
		return nil, fmt.Errorf("unable to load SDK config, %v", err)
	}

	// If credentials are provided, set them
	if accessKey != "" && secretKey != "" {
		cfg.Credentials = aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(accessKey, secretKey, ""))
	}

	// If an endpoint is provided, set it and the path style
	s3 := s3.NewFromConfig(cfg, func(o *s3.Options) {
		if opts != nil {
			if endpoint != "" {
				if !hasProtocol(endpoint) {
					endpoint = fmt.Sprintf("https://%s", endpoint)
				}
				o.BaseEndpoint = aws.String(endpoint)
			}
			o.UsePathStyle = opts.ForcePathStyle
		}
	})

	client := &S3Client{
		endpoint:  endpoint,
		region:    region,
		accessKey: accessKey,
		secretKey: secretKey,
		bucket:    bucket,
		key:       key,

		s3:         s3,
		uploader:   manager.NewUploader(s3),
		downloader: manager.NewDownloader(s3),
	}
	if opts != nil {
		client.timestamp = opts.Timestamp
	}
	return client, nil
}

// String returns a string representation of the S3Client.
func (s *S3Client) String() string {
	if s.endpoint == "" || isAWSEndpoint(s.endpoint) {
		// Native Amazon S3, use AWS's S3 URL format
		return fmt.Sprintf("s3://%s/%s", s.bucket, s.key)
	}
	return fmt.Sprintf("%s/%s/%s", s.endpoint, s.bucket, s.key)
}

// EnsureBucket ensures the bucket actually exists in S3.
func (s *S3Client) EnsureBucket(ctx context.Context) error {
	_, err := s.s3.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(s.bucket),
	})
	if err != nil {
		return fmt.Errorf("failed to create bucket %v: %w", s.bucket, err)
	}
	return nil
}

// Upload uploads data to S3.
func (s *S3Client) Upload(ctx context.Context, reader io.Reader, id string) error {
	key := s.key
	if s.timestamp {
		if s.now == nil {
			s.now = func() time.Time {
				return time.Now().UTC()
			}
		}
		key = TimestampedPath(key, s.now())
	}
	input := &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
		Body:   reader,
	}

	if id != "" {
		input.Metadata = map[string]string{
			AWSS3IDKey: id,
		}
	}
	_, err := s.uploader.Upload(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to upload to %v: %w", s, err)
	}
	return nil
}

// CurrentID returns the last ID uploaded to S3.
func (s *S3Client) CurrentID(ctx context.Context) (string, error) {
	input := &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s.key),
	}

	result, err := s.s3.HeadObject(ctx, input)
	if err != nil {
		return "", fmt.Errorf("failed to get object head for %v: %w", s, err)
	}

	id, ok := result.Metadata[AWSS3IDKey]
	if !ok {
		return "", fmt.Errorf("sum metadata not found for %v", s)
	}
	return id, nil
}

// Download downloads data from S3.
func (s *S3Client) Download(ctx context.Context, writer io.WriterAt) error {
	_, err := s.downloader.Download(ctx, writer, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s.key),
	})
	if err != nil {
		return fmt.Errorf("failed to download from %v: %w", s, err)
	}
	return nil
}

// Delete deletes object from S3.
func (s *S3Client) Delete(ctx context.Context) error {
	_, err := s.s3.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s.key),
	})
	if err != nil {
		return fmt.Errorf("failed to delete %v: %w", s, err)
	}
	return nil
}

// TimestampedPath returns a new path with the given timestamp prepended.
// If path contains /, the timestamp is prepended to the last segment.
func TimestampedPath(path string, t time.Time) string {
	parts := strings.Split(path, "/")
	parts[len(parts)-1] = fmt.Sprintf("%s_%s", t.Format("20060102150405"), parts[len(parts)-1])
	return strings.Join(parts, "/")
}

func isAWSEndpoint(s string) bool {
	return strings.HasSuffix(s, "amazonaws.com")
}

func hasProtocol(s string) bool {
	return strings.Contains(s, "://")
}

type uploader interface {
	Upload(ctx context.Context, input *s3.PutObjectInput, opts ...func(*manager.Uploader)) (*manager.UploadOutput, error)
}

type downloader interface {
	Download(ctx context.Context, w io.WriterAt, input *s3.GetObjectInput, opts ...func(*manager.Downloader)) (n int64, err error)
}

```

### Core Architecture Module: `auto/backup/config.go`
```
package backup

import (
	"encoding/json"
	"io"
	"os"

	"github.com/rqlite/rqlite/v10/auto"
	"github.com/rqlite/rqlite/v10/auto/aws"
	"github.com/rqlite/rqlite/v10/auto/file"
	"github.com/rqlite/rqlite/v10/auto/gcp"
)

// Config is the config file format for the upload service
type Config struct {
	Version    int              `json:"version"`
	Type       auto.StorageType `json:"type"`
	NoCompress bool             `json:"no_compress,omitempty"`
	Timestamp  bool             `json:"timestamp"`
	Vacuum     bool             `json:"vacuum,omitempty"`
	Interval   auto.Duration    `json:"interval"`
	Sub        json.RawMessage  `json:"sub"`
}

// NewStorageClient unmarshals the config data and returns the Config and StorageClient.
func NewStorageClient(data []byte) (*Config, StorageClient, error) {
	cfg := &Config{}
	err := json.Unmarshal(data, cfg)
	if err != nil {
		return nil, nil, err
	}

	if cfg.Version > auto.Version {
		return nil, nil, auto.ErrInvalidVersion
	}

	var sc StorageClient
	switch cfg.Type {
	case auto.StorageTypeS3:
		s3cfg := &aws.S3Config{}
		err = json.Unmarshal(cfg.Sub, s3cfg)
		if err != nil {
			return nil, nil, err
		}
		opts := &aws.S3ClientOpts{
			ForcePathStyle: s3cfg.ForcePathStyle,
			Timestamp:      cfg.Timestamp,
		}
		sc, err = aws.NewS3Client(s3cfg.Endpoint, s3cfg.Region, s3cfg.AccessKeyID, s3cfg.SecretAccessKey,
			s3cfg.Bucket, s3cfg.Path, opts)
	case auto.StorageTypeGCS:
		gcsCfg := &gcp.GCSConfig{}
		err = json.Unmarshal(cfg.Sub, gcsCfg)
		if err != nil {
			return nil, nil, err
		}
		opts := &gcp.GCSClientOpts{
			Timestamp: cfg.Timestamp,
		}
		sc, err = gcp.NewGCSClient(gcsCfg, opts)
	case auto.StorageTypeFile:
		fileCfg := &file.Config{}
		err = json.Unmarshal(cfg.Sub, fileCfg)
		if err != nil {
			return nil, nil, err
		}
		opts := &file.Options{
			Timestamp: cfg.Timestamp,
		}
		sc, err = file.NewClient(fileCfg.Dir, fileCfg.Name, opts)
	default:
		return nil, nil, auto.ErrUnsupportedStorageType
	}

	return cfg, sc, err
}

// ReadConfigFile reads the config file and returns the data. It also expands
// any environment variables in the config file.
func ReadConfigFile(filename string) ([]byte, error) {
	f, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		return nil, err
	}

	data = []byte(os.ExpandEnv(string(data)))
	return data, nil
}

```

### Core Architecture Module: `auto/backup/uploader.go`
```
package backup

import (
	"context"
	"expvar"
	"fmt"
	"io"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/rqlite/rqlite/v10/db/humanize"
	"github.com/rqlite/rqlite/v10/internal/fsutil"
	"github.com/rqlite/rqlite/v10/internal/progress"
)

// StorageClient is an interface for uploading data to a storage service.
type StorageClient interface {
	// Upload uploads the data from the given reader to the storage service.
	// id is a identifier for the data, and will be stored along with
	// the data in the storage service.
	Upload(ctx context.Context, reader io.Reader, id string) error

	// CurrentID returns the ID of the data in the Storage service.
	// It is always read from the Storage service, and a cached
	// value is never returned.
	CurrentID(ctx context.Context) (string, error)

	fmt.Stringer
}

// DataProvider is an interface for providing data to be uploaded. The Uploader
// service will call Provide() to have the data-for-upload to be written to the
// to the file specified by path.
type DataProvider interface {
	// LastIndex returns the cluster-wide index the data managed by the DataProvider was
	// last modified by.
	LastIndex() (uint64, error)

	// Provide writes the data-for-upload to the writer.
	Provide(w io.WriteSeeker) error
}

// stats captures stats for the Uploader service.
var stats *expvar.Map

const (
	numUploadsOK        = "num_uploads_ok"
	numUploadsFail      = "num_uploads_fail"
	numUploadsSkipped   = "num_uploads_skipped"
	numUploadsSkippedID = "num_uploads_skipped_id"
	numSumGetFail       = "num_sum_get_fail"
	totalUploadBytes    = "total_upload_bytes"
	lastUploadBytes     = "last_upload_bytes"
)

func init() {
	stats = expvar.NewMap("uploader")
	ResetStats()
}

// ResetStats resets the expvar stats for this module. Mostly for test purposes.
func ResetStats() {
	stats.Init()
	stats.Add(numUploadsOK, 0)
	stats.Add(numUploadsFail, 0)
	stats.Add(numUploadsSkipped, 0)
	stats.Add(numUploadsSkippedID, 0)
	stats.Add(numSumGetFail, 0)
	stats.Add(totalUploadBytes, 0)
	stats.Add(lastUploadBytes, 0)
}

// Uploader is a service that periodically uploads data to a storage service.
type Uploader struct {
	storageClient StorageClient
	dataProvider  DataProvider
	interval      time.Duration

	logger             *log.Logger
	lastUploadTime     time.Time
	lastUploadDuration time.Duration

	lastIndex uint64 // The last index of the data most-recently uploaded.
}

// NewUploader creates a new Uploader service.
func NewUploader(storageClient StorageClient, dataProvider DataProvider, interval time.Duration) *Uploader {
	return &Uploader{
		storageClient: storageClient,
		dataProvider:  dataProvider,
		interval:      interval,
		logger:        log.New(os.Stderr, "[uploader] ", log.LstdFlags),
	}
}

// Start starts the Uploader service.
func (u *Uploader) Start(ctx context.Context, isUploadEnabled func() bool) chan struct{} {
	doneCh := make(chan struct{})
	if isUploadEnabled == nil {
		isUploadEnabled = func() bool { return true }
	}

	u.logger.Printf("starting upload to %s every %s", u.storageClient, u.interval)
	ticker := time.NewTicker(u.interval)
	go func() {
		defer ticker.Stop()
		defer close(doneCh)
		for {
			select {
			case <-ctx.Done():
				u.logger.Println("upload service shutting down")
				return
			case <-ticker.C:
				if !isUploadEnabled() {
					continue
				}
				if err := u.upload(ctx); err != nil {
					u.logger.Printf("failed to upload to %s: %v", u.storageClient, err)
				}
			}
		}
	}()
	return doneCh
}

// Stats returns the stats for the Uploader service.
func (u *Uploader) Stats() (map[string]any, error) {
	status := map[string]any{
		"upload_destination":   u.storageClient.String(),
		"upload_interval":      u.interval.String(),
		"last_upload_time":     u.lastUploadTime.Format(time.RFC3339),
		"last_upload_duration": u.lastUploadDuration.String(),
		"last_index":           strconv.FormatUint(u.lastIndex, 10),
	}
	return status, nil
}

func (u *Uploader) upload(ctx context.Context) error {
	var err error
	var li uint64

	li, err = u.dataProvider.LastIndex()
	if err != nil {
		return err
	}
	if li <= u.lastIndex {
		stats.Add(numUploadsSkipped, 1)
		return nil
	}

	// Create a temporary file for the data to be uploaded
	fd, err := tempFD()
	if err != nil {
		return err
	}
	defer fsutil.Remove(fd.Name())
	defer fd.Close()

	if err := u.dataProvider.Provide(fd); err != nil {
		return err
	}

	if u.lastIndex == 0 {
		// No last index, so this must be the first upload since this
		// uploader started. Double-check that we really need to upload.
		currID, err := u.storageClient.CurrentID(ctx)
		if err != nil {
			stats.Add(numSumGetFail, 1)
			u.logger.Printf("failed to get current ID from %s: %v", u.storageClient, err)
		} else if currID == strconv.FormatUint(li, 10) {
			stats.Add(numUploadsSkippedID, 1)
			return nil
		}
	}

	if _, err := fd.Seek(0, io.SeekStart); err != nil {
		return err
	}
	cr := progress.NewCountingReader(fd)
	startTime := time.Now()
	err = u.storageClient.Upload(ctx, cr, strconv.FormatUint(li, 10))
	if err != nil {
		stats.Add(numUploadsFail, 1)
		return err
	}

	// Successful upload!
	u.lastIndex = li
	stats.Add(numUploadsOK, 1)
	stats.Add(totalUploadBytes, cr.Count())
	stats.Get(lastUploadBytes).(*expvar.Int).Set(cr.Count())
	u.lastUploadTime = time.Now()
	u.lastUploadDuration = time.Since(startTime)
	u.logger.Printf("completed auto upload of %s to %s in %s",
		humanize.Bytes(uint64(stats.Get(lastUploadBytes).(*expvar.Int).Value())),
		u.storageClient, u.lastUploadDuration)
	return nil
}

func tempFD() (*os.File, error) {
	return os.CreateTemp("", "rqlite-upload")
}

```

### Core Architecture Module: `auto/file/file.go`
```
package file

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/rqlite/rqlite/v10/internal/fsutil"
)

// Config represents configuration for the file storage client.
type Config struct {
	Dir  string `json:"dir"`
	Name string `json:"name"`
}

// Client represents a file storage client.
type Client struct {
	dir       string
	name      string
	metaPath  string
	timestamp bool

	now func() time.Time
}

// Options represents options for the file storage client.
type Options struct {
	Timestamp bool
}

// Metadata represents metadata stored in the metadata file.
type Metadata struct {
	ID        string `json:"id"`
	Timestamp int64  `json:"timestamp,omitempty"`
	Name      string `json:"name,omitempty"`
}

// NewClient creates a new file storage client.
func NewClient(dir, name string, opt *Options) (*Client, error) {
	// Validate and clean paths
	dir = filepath.Clean(dir)
	if !filepath.IsAbs(dir) {
		return nil, fmt.Errorf("directory path must be absolute: %s", dir)
	}

	// Validate file parameter for path traversal attacks and directory separators
	cleanFile := filepath.Clean(name)
	if strings.Contains(name, string(filepath.Separator)) ||
		strings.Contains(cleanFile, "..") ||
		filepath.IsAbs(cleanFile) ||
		cleanFile != name {
		return nil, fmt.Errorf("invalid file parameter: %s (must be a simple filename without path separators)", name)
	}

	// Ensure the destination directory exists and is writable
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create directory %s: %w", dir, err)
	}
	touchPath := filepath.Join(dir, ".touch")
	f, err := os.OpenFile(touchPath, os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to test writing to directory %s: %w", dir, err)
	}
	f.Close()
	fsutil.Remove(touchPath)

	c := &Client{
		dir:      dir,
		name:     name,
		metaPath: filepath.Join(dir, "METADATA.json"),
	}

	if opt != nil {
		c.timestamp = opt.Timestamp
	}
	return c, nil
}

// CurrentMetadata returns the current metadata.
func (c *Client) CurrentMetadata(ctx context.Context) (*Metadata, error) {
	if !fileExists(c.metaPath) {
		return nil, nil
	}
	data, err := os.ReadFile(c.metaPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file %s: %w", c.metaPath, err)
	}
	var md Metadata
	if err := json.Unmarshal(data, &md); err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata from file %s: %w", c.metaPath, err)
	}
	return &md, nil
}

// LatestFilePath returns the path to the most recently uploaded file.
func (c *Client) LatestFilePath(ctx context.Context) string {
	md, err := c.CurrentMetadata(ctx)
	if err != nil {
		return ""
	}
	if md == nil {
		return ""
	}
	return md.Name
}

// String returns a string representation of the client.
func (c *Client) String() string {
	return fmt.Sprintf("dir:%s, file:%s", c.dir, c.name)
}

// Upload uploads data from the reader to the file storage.
func (c *Client) Upload(ctx context.Context, reader io.Reader, id string) (retErr error) {
	filename := c.name
	if c.timestamp {
		if c.now == nil {
			c.now = func() time.Time {
				return time.Now().UTC()
			}
		}
		filename = timestampedPath(filename, c.now())
	}

	finalPath := filepath.Join(c.dir, filename)

	tmpFile, err := os.CreateTemp(c.dir, ".upload-*")
	if err != nil {
		return fmt.Errorf("failed to create temporary file in %s: %w", c.dir, err)
	}
	tmpPath := tmpFile.Name()
	tmpMetaPath := c.metaPath + ".tmp"

	// Cleanup on error
	defer func() {
		tmpFile.Close()
		if retErr != nil {
			fsutil.Remove(tmpMetaPath)
			fsutil.Remove(tmpPath)
		}
	}()

	// Write data to temporary file
	_, err = io.Copy(tmpFile, reader)
	if err != nil {
		return fmt.Errorf("failed to write to temporary file %s: %w", tmpPath, err)
	}
	if err := tmpFile.Sync(); err != nil {
		return fmt.Errorf("failed to sync temporary file %s: %w", tmpPath, err)
	}
	if err := tmpFile.Close(); err != nil {
		return fmt.Errorf("failed to close temporary file %s: %w", tmpPath, err)
	}

	// Write metadata to temporary metadata file
	metadata := Metadata{
		ID:        id,
		Timestamp: time.Now().UnixMilli(),
		Name:      finalPath,
	}

	metadataBytes, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	if err := os.WriteFile(tmpMetaPath, metadataBytes, 0644); err != nil {
		return fmt.Errorf("failed to write temporary metadata file %s: %w", tmpMetaPath, err)
	}

	if err := fsutil.Rename(tmpPath, finalPath); err != nil {
		return fmt.Errorf("failed to rename temporary file %s to %s: %w", tmpPath, finalPath, err)
	}

	if err := fsutil.Rename(tmpMetaPath, c.metaPath); err != nil {
		fsutil.Remove(finalPath)
		return fmt.Errorf("failed to rename temporary metadata file %s to %s: %w", tmpMetaPath, c.metaPath, err)
	}
	return nil
}

// CurrentID returns the current ID stored in the metadata.
func (c *Client) CurrentID(ctx context.Context) (string, error) {
	md, err := c.CurrentMetadata(ctx)
	if err != nil {
		return "", err
	}
	if md == nil {
		return "", nil
	}
	return md.ID, nil
}

// timestampedPath returns a new path with the given timestamp prepended.
// If path contains /, the timestamp is prepended to the last segment.
func timestampedPath(path string, t time.Time) string {
	parts := strings.Split(path, "/")
	parts[len(parts)-1] = fmt.Sprintf("%s_%s", t.Format("20060102150405"), parts[len(parts)-1])
	return strings.Join(parts, "/")
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

```

### Core Architecture Module: `auto/gcp/example/main.go`
```
package example

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/rqlite/rqlite/v10/auto/gcp"
	"github.com/rqlite/rqlite/v10/internal/fsutil"
)

func main() {
	ctx := context.Background()

	cfg := gcp.GCSConfig{
		Bucket:          "my-demo-bucket",
		ProjectID:       "my-gcp-project",
		Name:            "sample.txt",
		CredentialsPath: os.Getenv("GOOGLE_APPLICATION_CREDENTIALS"),
	}

	client, err := gcp.NewGCSClient(&cfg, nil)
	if err != nil {
		panic(err)
	}

	if err := client.EnsureBucket(ctx); err != nil {
		panic(err)
	}
	fmt.Println("bucket ready")

	// ---- upload ------------------------------------------------------------
	payload := strings.NewReader("hello, world\n")
	if err := client.Upload(ctx, payload, "v1"); err != nil {
		panic(err)
	}
	fmt.Println("upload complete")

	// ---- current ID --------------------------------------------------------
	id, err := client.CurrentID(ctx)
	if err != nil {
		panic(err)
	}
	fmt.Printf("current ID: %s\n", id)

	// ---- download ----------------------------------------------------------
	tmp, err := os.CreateTemp("", "gcs-download-*")
	if err != nil {
		panic(err)
	}
	defer fsutil.Remove(tmp.Name())

	if err := client.Download(ctx, tmp); err != nil {
		panic(err)
	}
	tmp.Seek(0, 0)
	data, _ := io.ReadAll(tmp)
	fmt.Printf("downloaded data: %s", data)

	// ---- delete ------------------------------------------------------------
	if err := client.Delete(ctx); err != nil {
		panic(err)
	}
	fmt.Println("\nobject deleted")
}

```

### Core Architecture Module: `auto/gcp/gcs.go`
```
package gcp

import (
	"bytes"
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/rqlite/rqlite/v10/auto/gcp/jws"
)

var (
	defaultEndpoint         = "https://storage.googleapis.com"
	defaultDownloadBufferSz = 32 * 1024 // 32 KiB
	jwtScope                = "https://www.googleapis.com/auth/devstorage.read_write"
	jwtAudTarget            = "https://oauth2.googleapis.com/token"

	GCPGCSIDKey = "rqlite-auto-backup-id"
)

// TimestampedPath returns a new path with the given timestamp prepended.
// If path contains /, the timestamp is prepended to the last segment.
func TimestampedPath(path string, t time.Time) string {
	parts := strings.Split(path, "/")
	parts[len(parts)-1] = fmt.Sprintf("%s_%s", t.Format("20060102150405"), parts[len(parts)-1])
	return strings.Join(parts, "/")
}

// GCSConfig is the subconfig for the GCS storage type.
type GCSConfig struct {
	Endpoint        string `json:"endpoint,omitempty"`
	ProjectID       string `json:"project_id"`
	Bucket          string `json:"bucket"`
	Name            string `json:"name"`
	CredentialsPath string `json:"credentials_path"`
}

// GCSClient is a client for uploading data to Google Cloud Storage (GCS).
type GCSClient struct {
	cfg *GCSConfig

	sa          serviceAccount
	accessToken string
	expiry      time.Time
	tokenMu     sync.Mutex

	http      *http.Client
	uploadURL string
	objectURL string
	bucketURL string

	timestamp bool
}

// GCSClientOpts are options for creating a GCSClient.
type GCSClientOpts struct {
	Timestamp bool
}

// NewGCSClient returns an instance of a GCSClient.
func NewGCSClient(cfg *GCSConfig, opts *GCSClientOpts) (*GCSClient, error) {
	if cfg.Endpoint == "" {
		cfg.Endpoint = defaultEndpoint
	}
	sa, err := loadServiceAccount(cfg.CredentialsPath)
	if err != nil {
		return nil, err
	}
	base := strings.TrimRight(cfg.Endpoint, "/")

	return &GCSClient{
		cfg:       cfg,
		sa:        *sa,
		http:      &http.Client{},
		uploadURL: fmt.Sprintf("%s/upload/storage/v1/b/%s/o", base, url.PathEscape(cfg.Bucket)),
		objectURL: fmt.Sprintf("%s/storage/v1/b/%s/o/%s",
			base, url.PathEscape(cfg.Bucket), url.PathEscape(cfg.Name)),
		bucketURL: fmt.Sprintf("%s/storage/v1/b/%s", base, url.PathEscape(cfg.Bucket)),
		timestamp: opts != nil && opts.Timestamp,
	}, nil
}

// String returns a string representation of the GCSClient.
func (g *GCSClient) String() string {
	return fmt.Sprintf("gs://%s/%s", g.cfg.Bucket, g.cfg.Name)
}

// EnsureBucket ensures the bucket actually exists in GCS.
func (g *GCSClient) EnsureBucket(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, g.bucketURL, nil)
	if err != nil {
		return err
	}
	if err := g.addAuth(req); err != nil {
		return err
	}
	res, err := g.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	switch res.StatusCode {
	case http.StatusOK:
		return nil // already exists
	case http.StatusNotFound:
		body := fmt.Sprintf(`{"name":"%s"}`, g.cfg.Bucket)
		u := g.bucketURL + "?project=" + url.QueryEscape(g.cfg.ProjectID)
		req, _ = http.NewRequestWithContext(ctx, http.MethodPost, u, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if err := g.addAuth(req); err != nil {
			return err
		}
		res, err = g.http.Do(req)
		if err != nil {
			return err
		}
		defer res.Body.Close()
		if res.StatusCode != http.StatusOK {
			b, _ := io.ReadAll(res.Body)
			return fmt.Errorf("bucket creation failed: %s", b)
		}
		return nil
	default:
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("bucket check failed: %s", b)
	}
}

// Upload uploads data to GCS.
func (g *GCSClient) Upload(ctx context.Context, r io.Reader, id string) error {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	name := g.cfg.Name
	if g.timestamp {
		name = TimestampedPath(name, time.Now().UTC())
	}
	metaData := struct {
		Name     string `json:"name"`
		Metadata struct {
			ID string `json:"rqlite-auto-backup-id"`
		} `json:"metadata"`
	}{
		Name: name,
	}
	metaData.Metadata.ID = id

	meta, err := json.Marshal(metaData)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	hdr := textproto.MIMEHeader{"Content-Type": {"application/json"}}
	part, err := w.CreatePart(hdr)
	if err != nil {
		return fmt.Errorf("failed to create metadata part: %w", err)
	}
	if _, err := part.Write(meta); err != nil {
		return fmt.Errorf("failed to write metadata part: %w", err)
	}

	hdr = textproto.MIMEHeader{"Content-Type": {"application/octet-stream"}}
	part, err = w.CreatePart(hdr)
	if err != nil {
		return fmt.Errorf("failed to create data part: %w", err)
	}
	if _, err := io.Copy(part, r); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("failed to close multipart writer: %w", err)
	}

	u := g.uploadURL + "?uploadType=multipart"
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, u, &buf)
	req.Header.Set("Content-Type", "multipart/related; boundary="+w.Boundary())
	if err := g.addAuth(req); err != nil {
		return err
	}

	res, err := g.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("upload failed: %s", b)
	}
	return nil
}

// Download downloads data from GCS.
func (g *GCSClient) Download(ctx context.Context, w io.WriterAt) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, g.objectURL+"?alt=media", nil)
	if err := g.addAuth(req); err != nil {
		return err
	}
	res, err := g.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("download failed: %s", b)
	}

	buf := make([]byte, defaultDownloadBufferSz)
	var off int64
	for {
		n, err := res.Body.Read(buf)
		if n > 0 {
			if _, werr := w.WriteAt(buf[:n], off); werr != nil {
				return werr
			}
			off += int64(n)
		}
		if err != nil {
			if err == io.EOF {
				break
			}
			return err
		}
	}
	return nil
}

// Delete deletes object from GCS.
func (g *GCSClient) Delete(ctx context.Context) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodDelete, g.objectURL, nil)
	if err := g.addAuth(req); err != nil {
		return err
	}
	res, err := g.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	switch res.StatusCode {
	case http.StatusOK, http.StatusNoContent, http.StatusNotFound:
		return nil
	default:
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("delete failed: %s", b)
	}
}

// CurrentID returns the last ID uploaded to GCS.
func (g *GCSClient) CurrentID(ctx context.Context) (string, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, g.objectURL, nil)
	if err := g.addAuth(req); err != nil {
		return "", err
	}
	res, err := g.http.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(res.Body)
		return "", fmt.Errorf("metadata fetch failed: %s", b)
	}
	var obj struct {
		Metadata map[string]string `json:"metadata"`
	}
	if err := json.NewDecoder(res.Body).Decode(&obj); err != nil {
		return "", err
	}

	id, ok := obj.Metadata[GCPGCSIDKey]
	if !ok {
		return "", fmt.Errorf("ID key (%s) not found in metadata %v", GCPGCSIDKey, g)
	}
	return id, nil
}

func (g *GCSClient) addAuth(req *http.Request) error {
	tok, err := g.getToken(req.Context())
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+tok)
	return nil
}

func (g *GCSClient) getToken(ctx context.Context) (string, error) {
	g.tokenMu.Lock()
	defer g.tokenMu.Unlock()

	if time.Until(g.expiry) > 2*time.Minute {
		return g.accessToken, nil
	}

	jwt, err := makeJWT(&g.sa)
	if err != nil {
		return "", err
	}
	tok, exp, err := fetchToken(ctx, jwt, g.http)
	if err != nil {
		return "", err
	}
	g.accessToken, g.expiry = tok, exp
	return tok, nil
}

func makeJWT(sa 
```

### Core Architecture Module: `auto/gcp/jws/jws.go`
```
// Copyright 2014 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package jws provides a partial implementation
// of JSON Web Signature encoding and decoding.
// It exists to support the [golang.org/x/oauth2] package.
//
// See RFC 7515.
package jws

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// ClaimSet contains information about the JWT signature including the
// permissions being requested (scopes), the target of the token, the issuer,
// the time the token was issued, and the lifetime of the token.
type ClaimSet struct {
	Iss   string `json:"iss"`             // email address of the client_id of the application making the access token request
	Scope string `json:"scope,omitempty"` // space-delimited list of the permissions the application requests
	Aud   string `json:"aud"`             // descriptor of the intended target of the assertion (Optional).
	Exp   int64  `json:"exp"`             // the expiration time of the assertion (seconds since Unix epoch)
	Iat   int64  `json:"iat"`             // the time the assertion was issued (seconds since Unix epoch)
	Typ   string `json:"typ,omitempty"`   // token type (Optional).

	// Email for which the application is requesting delegated access (Optional).
	Sub string `json:"sub,omitempty"`

	// The old name of Sub. Client keeps setting Prn to be
	// complaint with legacy OAuth 2.0 providers. (Optional)
	Prn string `json:"prn,omitempty"`

	// See http://tools.ietf.org/html/draft-jones-json-web-token-10#section-4.3
	// This array is marshalled using custom code (see (c *ClaimSet) encode()).
	PrivateClaims map[string]any `json:"-"`
}

func (c *ClaimSet) encode() (string, error) {
	// Reverting time back for machines whose time is not perfectly in sync.
	// If client machine's time is in the future according
	// to Google servers, an access token will not be issued.
	now := time.Now().Add(-10 * time.Second)
	if c.Iat == 0 {
		c.Iat = now.Unix()
	}
	if c.Exp == 0 {
		c.Exp = now.Add(time.Hour).Unix()
	}
	if c.Exp < c.Iat {
		return "", fmt.Errorf("jws: invalid Exp = %v; must be later than Iat = %v", c.Exp, c.Iat)
	}

	b, err := json.Marshal(c)
	if err != nil {
		return "", err
	}

	if len(c.PrivateClaims) == 0 {
		return base64.RawURLEncoding.EncodeToString(b), nil
	}

	// Marshal private claim set and then append it to b.
	prv, err := json.Marshal(c.PrivateClaims)
	if err != nil {
		return "", fmt.Errorf("jws: invalid map of private claims %v", c.PrivateClaims)
	}

	// Concatenate public and private claim JSON objects.
	if !bytes.HasSuffix(b, []byte{'}'}) {
		return "", fmt.Errorf("jws: invalid JSON %s", b)
	}
	if !bytes.HasPrefix(prv, []byte{'{'}) {
		return "", fmt.Errorf("jws: invalid JSON %s", prv)
	}
	b[len(b)-1] = ','         // Replace closing curly brace with a comma.
	b = append(b, prv[1:]...) // Append private claims.
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// Header represents the header for the signed JWS payloads.
type Header struct {
	// The algorithm used for signature.
	Algorithm string `json:"alg"`

	// Represents the token type.
	Typ string `json:"typ"`

	// The optional hint of which key is being used.
	KeyID string `json:"kid,omitempty"`
}

func (h *Header) encode() (string, error) {
	b, err := json.Marshal(h)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// Decode decodes a claim set from a JWS payload.
func Decode(payload string) (*ClaimSet, error) {
	// decode returned id token to get expiry
	_, claims, _, ok := parseToken(payload)
	if !ok {
		// TODO(jbd): Provide more context about the error.
		return nil, errors.New("jws: invalid token received")
	}
	decoded, err := base64.RawURLEncoding.DecodeString(claims)
	if err != nil {
		return nil, err
	}
	c := &ClaimSet{}
	err = json.NewDecoder(bytes.NewBuffer(decoded)).Decode(c)
	return c, err
}

// Signer returns a signature for the given data.
type Signer func(data []byte) (sig []byte, err error)

// EncodeWithSigner encodes a header and claim set with the provided signer.
func EncodeWithSigner(header *Header, c *ClaimSet, sg Signer) (string, error) {
	head, err := header.encode()
	if err != nil {
		return "", err
	}
	cs, err := c.encode()
	if err != nil {
		return "", err
	}
	ss := fmt.Sprintf("%s.%s", head, cs)
	sig, err := sg([]byte(ss))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s.%s", ss, base64.RawURLEncoding.EncodeToString(sig)), nil
}

// Encode encodes a signed JWS with provided header and claim set.
// This invokes [EncodeWithSigner] using [crypto/rsa.SignPKCS1v15] with the given RSA private key.
func Encode(header *Header, c *ClaimSet, key *rsa.PrivateKey) (string, error) {
	sg := func(data []byte) (sig []byte, err error) {
		h := sha256.New()
		h.Write(data)
		return rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, h.Sum(nil))
	}
	return EncodeWithSigner(header, c, sg)
}

// Verify tests whether the provided JWT token's signature was produced by the private key
// associated with the supplied public key.
func Verify(token string, key *rsa.PublicKey) error {
	header, claims, sig, ok := parseToken(token)
	if !ok {
		return errors.New("jws: invalid token received, token must have 3 parts")
	}
	signatureString, err := base64.RawURLEncoding.DecodeString(sig)
	if err != nil {
		return err
	}

	h := sha256.New()
	h.Write([]byte(header + tokenDelim + claims))
	return rsa.VerifyPKCS1v15(key, crypto.SHA256, h.Sum(nil), signatureString)
}

func parseToken(s string) (header, claims, sig string, ok bool) {
	header, s, ok = strings.Cut(s, tokenDelim)
	if !ok { // no period found
		return "", "", "", false
	}
	claims, s, ok = strings.Cut(s, tokenDelim)
	if !ok { // only one period found
		return "", "", "", false
	}
	sig, _, ok = strings.Cut(s, tokenDelim)
	if ok { // three periods found
		return "", "", "", false
	}
	return header, claims, sig, true
}

const tokenDelim = "."

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2833** (2026-09-30): **Just close the HTTP server on exit**
  *Symptoms*: There is nothing to be gained by graceful shutdown, this is not a  web server which has to be nice to clients.  
  **Post-Mortem & Fix Analysis**:
  > See https://github.com/dotnwat/torx/issues/21

- **Issue #2832** (2026-09-30): **Record AppendEntries reception time on each node**
  *Symptoms*: 

- **Issue #2831** (2026-09-29): **Exit on node-local SQLite errors**
  *Symptoms*: See https://github.com/dotnwat/torx/issues/15  This could cause a node to diverge from the rest of the cluster if the error was transient. What we should do is abort, and let rqlite rebuild from a known good state.

- **Issue #2830** (2026-09-29): **Log, don't panic**
  *Symptoms*: 

- **Issue #2829** (2026-09-29): **DB layer checks for fatal SQLite errors**
  *Symptoms*: 

- **Issue #2828** (2026-09-28): **DB `Dump()` returns number of bytes written**
  *Symptoms*: 

- **Issue #2827** (2026-09-28): **Support configurable queued-writes retries**
  *Symptoms*:  See https://github.com/dotnwat/torx/issues/17

- **Issue #2826** (2026-09-28): **CDC can now require creds for HWM updates**
  *Symptoms*: 

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

### Incident Patch 1: `8ce683c5` (2026-09-28)
**Commit Message**: Update bug_report.md

**File**: `.github/ISSUE_TEMPLATE/bug_report.md` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ labels: ''
 assignees: ''
 
 ---
-_If you use AI to generate a bug report, state the Agent version you are using, and show clearly how to reproduce the issue. For example if you say some simple action crashes rqlite then show step-by-step how to reproduce the crash. If you say lines in the code are buggy, then link to the actual lines in the source. If you say you have a test or benchmark that shows the issue, then include code. If these guidelines are not followed, then issue may be closed without comment._
+_If you used AI to identify an issue, or generate a bug report, state the Agent you are using, and show clearly how to reproduce the issue. For example if you say some simple action crashes rqlite then show step-by-step how to reproduce the crash. If you say lines in the code are buggy, then link to the actual lines in the source. If you say you have a test or benchmark that shows the issue, then include code. If these guidelines are not followed, then issue may be closed without comment._
 
 **What version are you running?**
 
```

---

### Incident Patch 2: `0b3efe2d` (2026-09-22)
**Commit Message**: Merge pull request #2812 from goingforstudying-ctrl/fix/snapshot-naming-backwards-clock

Keep snapshot ordering correct when the clock moves backwards

**File**: `snapshot/DESIGN.md` (modified, +2/-0)
```diff
@@ -32,6 +32,8 @@ The result is that a slow node catching up via snapshot transfer no longer degra
 
 A snapshot is a directory under the store root. The directory name is the snapshot ID (derived from Raft term, index, and a timestamp). Each directory contains a `meta.json` file with Raft metadata and one or more data files.
 
+Snapshot IDs are generated so that a snapshot always sorts as newer than any existing snapshot with the same term and index: the timestamp field is the larger of the current wall-clock time and one more than the largest timestamp found among those existing snapshots. Ordering therefore stays correct even if the system clock moves backwards between the creation of two such snapshots.
+
 The snapshot type is determined by what files are present:
 
 - **Full snapshot**: Contains `data.db` (a valid SQLite database). May also contain zero or more `.wal` files. A full snapshot is always the base from which database state is reconstructed.
```

**File**: `snapshot/snaphot_namer_test.go` (modified, +93/-11)
```diff
@@ -8,6 +8,8 @@ import (
 	"sync"
 	"testing"
 	"time"
+
+	"github.com/hashicorp/raft"
 )
 
 // Test_NewSnapshotNamer_NilNowFn checks that a nil nowFn falls back to
@@ -22,7 +24,7 @@ func Test_NewSnapshotNamer_NilNowFn(t *testing.T) {
 	}
 
 	before := time.Now().UnixNano() / int64(time.Millisecond)
-	name := sn.MakeName(7, 8, 9)
+	name := sn.MakeName(SnapshotSet{}, 7, 8, 9)
 	after := time.Now().UnixNano() / int64(time.Millisecond)
 
 	term, index, msec, gen := parseName(t, name)
@@ -39,7 +41,7 @@ func Test_NewSnapshotNamer_CustomNowFn(t *testing.T) {
 	tm := time.Unix(1500000000, 0).UTC() // 1500000000000 msec
 	sn := NewSnapshotNamer(fixedClock(tm))
 
-	if got, want := sn.MakeName(1, 1, 0), "1-1-1500000000000"; got != want {
+	if got, want := sn.MakeName(SnapshotSet{}, 1, 1, 0), "1-1-1500000000000"; got != want {
 		t.Fatalf("got %q, want %q", got, want)
 	}
 }
@@ -70,7 +72,7 @@ func Test_MakeName_Format(t *testing.T) {
 
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
-			if got := sn.MakeName(tt.term, tt.index, tt.gen); got != tt.want {
+			if got := sn.MakeName(SnapshotSet{}, tt.term, tt.index, tt.gen); got != tt.want {
 				t.Fatalf("got %q, want %q", got, tt.want)
 			}
 		})
@@ -99,7 +101,7 @@ func Test_MakeName_TimestampTruncation(t *testing.T) {
 		t.Run(tt.name, func(t *testing.T) {
 			sn := NewSnapshotNamer(fixedClock(tt.now))
 			want := fmt.Sprintf("3-4-%d-1", tt.want)
-			if got := sn.MakeName(3, 4, 1); got != want {
+			if got := sn.MakeName(SnapshotSet{}, 3, 4, 1); got != want {
 				t.Fatalf("got %q, want %q", got, want)
 			}
 		})
@@ -116,7 +118,7 @@ func Test_MakeName_CallsNowFnOncePerCall(t *testing.T) {
 	})
 
 	for i := 0; i < 5; i++ {
-		sn.MakeName(uint64(i), uint64(i), 1)
+		sn.MakeName(SnapshotSet{}, uint64(i), uint64(i), 1)
 	}
 	if calls != 5 {
 		t.Fatalf("nowFn called %d times, want 5", calls)
@@ -129,8 +131,8 @@ func Test_MakeName_CallsNowFnOncePerCall(t *testing.T) {
 func Test_MakeName_CollidesWithinSameMillisecond(t *testing.T) {
 	sn := NewSnapshotNamer(fixedClock(time.Unix(1500000000, 0)))
 
-	first := sn.MakeName(1, 2, 3)
-	second := sn.MakeName(1, 2, 3)
+	first := sn.MakeName(SnapshotSet{}, 1, 2, 3)
+	second := sn.MakeName(SnapshotSet{}, 1, 2, 3)
 	if first != second {
 		t.Fatalf("got %q and %q, want identical names", first, second)
 	}
@@ -149,7 +151,7 @@ func Test_MakeName_DistinctInputsDistinctNames(t *testing.T) {
 	for _, tc := range []struct{ term, index uint64 }{
 		{1, 1}, {1, 2}, {2, 1}, {1, 1},
 	} {
-		name := sn.MakeName(tc.term, tc.index, 1)
+		name := sn.MakeName(SnapshotSet{}, tc.term, tc.index, 1)
 		if seen[name] {
 			t.Fatalf("duplicate name %q", name)
 		}
@@ -170,7 +172,7 @@ func Test_MakeName_Concurrent(t *testing.T) {
 		go func() {
 			defer wg.Done()
 			for j := 0; j < iterations; j++ {
-				if got := sn.MakeName(1, 2, 3); got != want {
+				if got := sn.MakeName(SnapshotSet{}, 1, 2, 3); got != want {
 					errs <- got
 				}
 			}
@@ -184,6 +186,86 @@ func Test_MakeName_Concurrent(t *testing.T) {
 	}
 }
 
+// Test_makeName_MinMsec checks that makeName raises the millisecond field to
+// the given minimum when the clock reads lower, and leaves it alone otherwise.
+func Test_makeName_MinMsec(t *testing.T) {
+	sn := NewSnapshotNamer(fixedClock(time.UnixMilli(1000)))
+
+	if got, want := sn.makeName(1, 2, 0, 1500), "1-2-1500"; got != want {
+		t.Fatalf("got %q, want %q", got, want)
+	}
+	if got, want := sn.makeName(1, 2, 3, 1500), "1-2-1500-3"; got != want {
+		t.Fatalf("got %q, want %q", got, want)
+	}
+	if got, want := sn.makeName(1, 2, 0, 500), "1-2-1000"; got != want {
+		t.Fatalf("got %q, want %q", got, want)
+	}
+	if got, want := sn.makeName(1, 2, 3, 1000), "1-2-1000-3"; got != want {
+		t.Fatalf("got %q, want %q", got, want)
+	}
+}
+
+// Test_MakeName_Set exercises set-aware name generation: a name made for a
+// term and index already present in the set must sort after every snapshot in
+// the set with that term and index.
+func Test_
```

**File**: `snapshot/snapshot_namer.go` (modified, +28/-3)
```diff
@@ -2,6 +2,7 @@ package snapshot
 
 import (
 	"fmt"
+	"math"
 	"strconv"
 	"strings"
 	"time"
@@ -21,11 +22,35 @@ func NewSnapshotNamer(nowFn func() time.Time) *SnapshotNamer {
 	return &SnapshotNamer{nowFn}
 }
 
-// MakeName returns a name for the Snapshot, for the given the term, index, and
-// and generation. If gen is less than 1, then no generation is present in the name.
-func (sn *SnapshotNamer) MakeName(term, index uint64, gen int64) string {
+// MakeName returns a name for the Snapshot, for the given snapshot set, term,
+// index, and generation. If gen is less than 1, then no generation is present
+// in the name.
+//
+// The name is generated so that it sorts as newer than every snapshot in the
+// set sharing the given term and index: the millisecond field is the larger of
+// the current wall-clock time and one more than the millisecond field of the
+// newest such snapshot. Ordering therefore stays correct even if the system
+// clock moved backwards since those snapshots were created.
+func (sn *SnapshotNamer) MakeName(set SnapshotSet, term, index uint64, gen int64) string {
+	minMsec := int64(math.MinInt64)
+	if newest, ok := set.WithTermIndex(term, index).Newest(); ok {
+		// A snapshot whose ID has no parsable timestamp cannot take part in
+		// the floor, so it is simply ignored.
+		if _, _, msec, _, err := ParseSnapshotName(newest.id); err == nil {
+			minMsec = msec + 1
+		}
+	}
+	return sn.makeName(term, index, gen, minMsec)
+}
+
+// makeName returns a name for the Snapshot, as MakeName does, but the
+// millisecond field is raised to minMsec if the current time is lower.
+func (sn *SnapshotNamer) makeName(term, index uint64, gen int64, minMsec int64) string {
 	now := sn.nowFn()
 	msec := now.UnixNano() / int64(time.Millisecond)
+	if msec < minMsec {
+		msec = minMsec
+	}
 	if gen < 1 {
 		return fmt.Sprintf("%d-%d-%d", term, index, msec)
 	}
```

**File**: `snapshot/state.go` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ func Clone(dir, id string, index, term uint64, gen int64) error {
 	}
 
 	snapshotNamer := NewSnapshotNamer(nil)
-	newID := snapshotNamer.MakeName(term, index, gen)
+	newID := snapshotNamer.MakeName(SnapshotSet{}, term, index, gen)
 	dstPath := filepath.Join(dir, newID)
 	if fsutil.PathExists(dstPath) {
 		return fmt.Errorf("snapshot %q already exists in %q", newID, dir)
```

**File**: `snapshot/store.go` (modified, +10/-3)
```diff
@@ -292,9 +292,16 @@ func NewStore(dir string) (*Store, error) {
 // Create creates a new snapshot sink for the given parameters.
 func (s *Store) Create(version raft.SnapshotVersion, index, term uint64, configuration raft.Configuration,
 	configurationIndex uint64, trans raft.Transport) (retSink raft.SnapshotSink, retErr error) {
+	// Read the store under a read lock so the scan cannot race with a reap.
+	s.mrsw.BeginReadBlocking()
+	snapSet, err := s.getSnapshots()
+	s.mrsw.EndRead()
+	if err != nil {
+		return nil, err
+	}
 	sink := NewSink(s.dir, &raft.SnapshotMeta{
 		Version:            version,
-		ID:                 s.snapshotNamer.MakeName(term, index, 0),
+		ID:                 s.snapshotNamer.MakeName(snapSet, term, index, 0),
 		Index:              index,
 		Term:               term,
 		Configuration:      configuration,
@@ -657,15 +664,15 @@ func (s *Store) reapInternal() (int, int, error) {
 		}
 
 		gen := int64(1)
-		newID := s.snapshotNamer.MakeName(newest.raftMeta.Term, newest.raftMeta.Index, gen)
+		newID := s.snapshotNamer.MakeName(snapSet, newest.raftMeta.Term, newest.raftMeta.Index, gen)
 		for {
 			finalDir := filepath.Join(s.dir, newID)
 			if !fsutil.DirExists(finalDir) {
 				// No ID collision, use it.
 				break
 			}
 			gen++
-			newID = s.snapshotNamer.MakeName(newest.raftMeta.Term, newest.raftMeta.Index, gen)
+			newID = s.snapshotNamer.MakeName(snapSet, newest.raftMeta.Term, newest.raftMeta.Index, gen)
 		}
 
 		newMeta := copyRaftMeta(newest.raftMeta)
```

---

### Incident Patch 3: `52e5cd15` (2026-09-19)
**Commit Message**: More test fixes

**File**: `db/querylog/querylog_test.go` (modified, +4/-4)
```diff
@@ -128,8 +128,8 @@ func Test_QueryLogger_FallbackToStmtOrTrigger(t *testing.T) {
 	if !strings.Contains(output, "PRAGMA journal_mode") {
 		t.Fatalf("expected log to contain StmtOrTrigger text, got: %s", output)
 	}
-	if !strings.Contains(output, "[0s]") {
-		t.Fatalf("expected [0s] for zero-duration, got: %s", output)
+	if !strings.Contains(output, "(0s)") {
+		t.Fatalf("expected (0s) for zero-duration, got: %s", output)
 	}
 }
 
@@ -291,8 +291,8 @@ func Test_QueryLogger_MinDuration_AboveThreshold(t *testing.T) {
 	if !strings.Contains(output, "SELECT 'above_threshold'") {
 		t.Fatalf("expected query above threshold to be logged, got: %s", output)
 	}
-	if !strings.Contains(output, "[50ms]") {
-		t.Fatalf("expected [50ms] in output, got: %s", output)
+	if !strings.Contains(output, "(50ms)") {
+		t.Fatalf("expected (50ms) in output, got: %s", output)
 	}
 }
 
```

---

### Incident Patch 4: `eb418bce` (2026-09-19)
**Commit Message**: Fix querylog test

**File**: `db/querylog/querylog_test.go` (modified, +3/-3)
```diff
@@ -75,15 +75,15 @@ func Test_QueryLogger_StmtThenProfile(t *testing.T) {
 		EventCode:      sqlite3.TraceProfile,
 		ConnHandle:     0x100,
 		StmtHandle:     0x200,
-		RunTimeNanosec: 3_000_000,
+		RunTimeNanosec: 30_000_000,
 	})
 
 	output := buf.String()
 	if !strings.Contains(output, "INSERT INTO t VALUES ('alice')") {
 		t.Fatalf("expected log to contain expanded SQL, got: %s", output)
 	}
-	if !strings.Contains(output, "[3ms]") {
-		t.Fatalf("expected log to contain [3ms], got: %s", output)
+	if !strings.Contains(output, "(30ms)") {
+		t.Fatalf("expected log to contain [30ms], got: %s", output)
 	}
 }
 
```

---

### Incident Patch 5: `30ae9dd2` (2026-09-18)
**Commit Message**: Fix HTTP logic error for queued statements

**File**: `http/service.go` (modified, +4/-1)
```diff
@@ -1300,7 +1300,10 @@ func (s *Service) queuedExecute(w http.ResponseWriter, r *http.Request, qp Query
 
 	stmts, err := ParseRequest(r.Body)
 	if err != nil {
-		if errors.Is(err, ErrNoStatements) && !qp.Wait() {
+		if (errors.Is(err, ErrNoStatements) || errors.Is(err, ErrInvalidRequest)) && qp.Wait() {
+			// These errors are OK if waiting.
+			err = nil
+		} else {
 			http.Error(w, err.Error(), http.StatusBadRequest)
 			return
 		}
```

---

### Incident Patch 6: `994db9eb` (2026-09-18)
**Commit Message**: UI console fixes

**File**: `http/console/static/js/app.js` (modified, +16/-19)
```diff
@@ -498,14 +498,11 @@
         loadStatus();
     });
 
-    function nodesURL() {
-        return showNonVoters.checked ? "/nodes?nonvoters" : "/nodes";
-    }
-
     function loadStatus() {
         Promise.all([
             apiRequest("GET", "/status"),
-            apiRequest("GET", nodesURL())
+            // Keep complete membership for restore routing; filter only the table.
+            apiRequest("GET", "/nodes?nonvoters")
         ]).then(function (responses) {
             lastStatusData = responses[0].data;
             renderStatus(lastStatusData);
@@ -709,7 +706,9 @@
     }
 
     function renderNodesTable() {
-        var nodes = lastNodesData.slice();
+        var nodes = lastNodesData.filter(function (node) {
+            return showNonVoters.checked || node.voter;
+        });
 
         if (nodesSortKey) {
             nodes.sort(function (a, b) {
@@ -879,15 +878,9 @@
     }
 
     function isSingleNodeCluster() {
-        // Prefer the node list if available; fall back to raft.num_peers.
-        if (lastNodesData && lastNodesData.length > 0) {
-            return lastNodesData.length === 1;
-        }
-        if (lastStatusData && lastStatusData.store && lastStatusData.store.raft) {
-            return Number(lastStatusData.store.raft.num_peers) === 0;
-        }
-        // Unknown — be safe and assume cluster (uses /db/load).
-        return false;
+        // This list includes non-voters. raft.num_peers counts only voting peers
+        // and cannot establish whether /boot is allowed. Unknown uses /db/load.
+        return lastNodesData.length === 1;
     }
 
     function sniffFileType(file) {
@@ -984,6 +977,9 @@
     restoreBtn.addEventListener("click", function () {
         if (!restoreSelection) return;
         var sel = restoreSelection;
+        // Membership may have refreshed since the file was selected.
+        sel.method = pickMethod(sel.kind);
+        restoreMethodSpan.textContent = sel.method.label;
 
         var confirmMsg = "Restore from \"" + sel.file.name + "\" via " + sel.method.label + "?\n\n" +
             "This replaces ALL existing data in the database. This action cannot be undone.";
@@ -1050,14 +1046,15 @@
             stopProcessingTimer();
             restoreBtn.disabled = false;
 
-            // /db/load can return 200 OK with a SQL parse error nested in the
-            // response body, e.g. {"results":[{"error":"near \"foo\": syntax
-            // error"}]}. Treat any error key in results[] as a failure.
+            // /db/load can return 200 OK with a top-level request error or
+            // a SQL error nested in results[]. Treat either as a failure.
             var jsonErr = null;
             if (xhr.responseText) {
                 try {
                     var resp = JSON.parse(xhr.responseText);
-                    if (resp && Array.isArray(resp.results)) {
+                    if (resp && resp.error) {
+                        jsonErr = resp.error;
+                    } else if (resp && Array.isArray(resp.results)) {
                         for (var i = 0; i < resp.results.length; i++) {
                             if (resp.results[i] && resp.results[i].error) {
                                 jsonErr = resp.results[i].error;
```

---

### Incident Patch 7: `724f6d3e` (2026-09-13)
**Commit Message**: Merge pull request #2790 from rqlite/fix/snapshot-reap-single-full

Reap WALs in lone full snapshots

**File**: `snapshot/store.go` (modified, +2/-2)
```diff
@@ -595,8 +595,8 @@ func (s *Store) reapInternal() (int, int, error) {
 
 	full, _ := fullSet.Newest()
 
-	// Single full snapshot with nothing newer — nothing to do.
-	if snapSet.Len() == 1 {
+	// A single full snapshot needs no work unless it contains WALs.
+	if snapSet.Len() == 1 && len(full.walFiles) == 0 {
 		return 0, 0, nil
 	}
 
```

---

### Incident Patch 8: `2bbb4560` (2026-09-13)
**Commit Message**: Merge pull request #2789 from rqlite/fix/snapshot-restore-header

Validate restore database header

**File**: `snapshot/restore.go` (modified, +3/-0)
```diff
@@ -44,6 +44,9 @@ func Restore(r io.Reader, dstPath string) (int64, error) {
 	if full == nil {
 		return totalRead, fmt.Errorf("snapshot has no database")
 	}
+	if full.DbHeader == nil {
+		return totalRead, fmt.Errorf("missing database header: %w", ErrHeaderInvalid)
+	}
 
 	// Extract DB file. Wrap the source in a CRC32Reader so we can verify
 	// the bytes match the header's CRC32 without a second pass over disk.
```

---

### Incident Patch 9: `188b75b3` (2026-09-13)
**Commit Message**: Merge pull request #2786 from rqlite/fix/snapshot-checkpoint-stat-errors

Propagate WAL stat errors

**File**: `snapshot/plan/executor.go` (modified, +4/-0)
```diff
@@ -80,12 +80,16 @@ func (e *Executor) Checkpoint(dbPath string, wals []string) (int, error) {
 		if err := db.CheckpointRemove(dbPath); err != nil {
 			return 0, fmt.Errorf("checkpoint leftover WAL: %w", err)
 		}
+	} else if !os.IsNotExist(err) {
+		return 0, fmt.Errorf("checking leftover WAL %s: %w", walPath, err)
 	}
 
 	existingWals := []string{}
 	for _, wal := range wals {
 		if _, err := os.Stat(wal); err == nil {
 			existingWals = append(existingWals, wal)
+		} else if !os.IsNotExist(err) {
+			return 0, fmt.Errorf("checking WAL %s: %w", wal, err)
 		}
 	}
 	n := len(existingWals)
```

#### Recent Merged Pull Requests:
- **PR #2833** (2026-09-30): Just close the HTTP server on exit (@otoolep)
- **PR #2832** (2026-09-30): Record AppendEntries reception time on each node (@otoolep)
- **PR #2831** (2026-09-29): Exit on node-local SQLite errors (@otoolep)
- **PR #2830** (2026-09-29): Log, don't panic (@otoolep)
- **PR #2829** (2026-09-29): DB layer checks for fatal SQLite errors (@otoolep)
- **PR #2828** (2026-09-28): DB `Dump()` returns number of bytes written (@otoolep)
- **PR #2827** (2026-09-28): Support configurable queued-writes retries (@otoolep)
- **PR #2826** (2026-09-28): CDC can now require creds for HWM updates (@otoolep)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
