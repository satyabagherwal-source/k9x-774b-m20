# Forensic Learning Record (Deep Inspection): gravitl/netmaker

> **Canonical Artifact**: `07_PROJECT_LEARNING/gravitl-netmaker-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gravitl/netmaker](https://github.com/gravitl/netmaker))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:07:45.053Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gravitl/netmaker`
- **Description**: Netmaker makes networks with WireGuard. Netmaker automates fast, secure, and distributed virtual networks.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 11818 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `logger/util.go`
```
package logger

import (
	"strings"
)

// Verbosity - current logging verbosity level (optionally set)
var Verbosity = 0

// MakeString - makes a string using golang string builder
func MakeString(delimeter string, message ...string) string {
	var builder strings.Builder
	for i := range message {
		builder.WriteString(message[i])
		if delimeter != "" && i != len(message)-1 {
			builder.WriteString(delimeter)
		}
	}
	return builder.String()
}

func getVerbose() int32 {
	if Verbosity >= 1 && Verbosity <= 4 {
		return int32(Verbosity)
	}
	return int32(Verbosity)
}

```

### Core Architecture Module: `logic/hooks.go`
```
package logic

import "context"

type ServerSyncType string

const (
	SyncTypeSettings   ServerSyncType = "settings"
	SyncTypePeerUpdate ServerSyncType = "peer_update"
	SyncTypeIDPSync    ServerSyncType = "idp_sync"
	SyncTypeIDPReset   ServerSyncType = "idp_reset"
)

// PublishServerSync is set by the mq package at startup to broadcast
// sync signals to peer servers in HA mode. The callback avoids a
// circular import (logic -> mq).
var PublishServerSync func(ctx context.Context, syncType ServerSyncType)

```

### Core Architecture Module: `logic/util.go`
```
// package for logicing client and server code
package logic

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"encoding/base64"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"reflect"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/blang/semver"
	"github.com/c-robinson/iplib"
	"github.com/gravitl/netmaker/logger"
	"github.com/gravitl/netmaker/schema"
)

// IsBase64 - checks if a string is in base64 format
// This is used to validate public keys (make sure they're base64 encoded like all public keys should be).
func IsBase64(s string) bool {
	_, err := base64.StdEncoding.DecodeString(s)
	return err == nil
}

// CheckEndpoint - checks if an endpoint is valid
func CheckEndpoint(endpoint string) bool {
	endpointarr := strings.Split(endpoint, ":")
	return len(endpointarr) == 2
}

// FileExists - checks if local file exists
func FileExists(f string) bool {
	info, err := os.Stat(f)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
}

// IsAddressInCIDR - util to see if an address is in a cidr or not
func IsAddressInCIDR(address net.IP, cidr string) bool {
	var _, currentCIDR, cidrErr = net.ParseCIDR(cidr)
	if cidrErr != nil {
		return false
	}
	return currentCIDR.Contains(address)
}

// SetNetworkNodesLastModified - sets the network nodes last modified
func SetNetworkNodesLastModified(ctx context.Context, networkName string) error {
	_network := &schema.Network{
		Name:           networkName,
		NodesUpdatedAt: time.Now(),
	}
	return _network.UpdateNodesUpdatedAt(ctx)
}

// RandomString - returns a random string in a charset
func RandomString(length int) string {
	randombytes := make([]byte, length)
	_, err := rand.Read(randombytes)
	if err != nil {
		logger.Log(0, "random string", err.Error())
		return ""
	}
	return base32.StdEncoding.EncodeToString(randombytes)[:length]
}

// StringSliceContains - sees if a string slice contains a string element
func StringSliceContains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
func SetVerbosity(logLevel int) {
	var level slog.Level
	switch logLevel {

	case 0:
		level = slog.LevelInfo
	case 1:
		level = slog.LevelError
	case 2:
		level = slog.LevelWarn
	case 3:
		level = slog.LevelDebug

	default:
		level = slog.LevelInfo
	}
	// Create the logger with the chosen level
	handler := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
	})
	logger := slog.New(handler)
	slog.SetDefault(logger)

}

// NormalizeCIDR - returns the first address of CIDR
func NormalizeCIDR(address string) (string, error) {
	ip, IPNet, err := net.ParseCIDR(address)
	if err != nil {
		return "", err
	}
	if ip.To4() == nil {
		net6 := iplib.Net6FromStr(IPNet.String())
		IPNet.IP = net6.FirstAddress()
	} else {
		net4 := iplib.Net4FromStr(IPNet.String())
		IPNet.IP = net4.NetworkAddress()
	}
	return IPNet.String(), nil
}

// StringDifference - returns the elements in `a` that aren't in `b`.
func StringDifference(a, b []string) []string {
	mb := make(map[string]struct{}, len(b))
	for _, x := range b {
		mb[x] = struct{}{}
	}
	var diff []string
	for _, x := range a {
		if _, found := mb[x]; !found {
			diff = append(diff, x)
		}
	}
	return diff
}

// CheckIfFileExists - checks if file exists or not in the given path
func CheckIfFileExists(filePath string) bool {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return false
	}
	return true
}

// RemoveStringSlice - removes an element at given index i
// from a given string slice
func RemoveStringSlice(slice []string, i int) []string {
	return append(slice[:i], slice[i+1:]...)
}

// RemoveAllFromSlice removes every occurrence of val from s (stable order).
func RemoveAllFromSlice[T comparable](s []T, val T) []T {
	// Reuse the underlying array: write filtered items back into s[:0].
	out := s[:0]
	for _, v := range s {
		if v != val {
			out = append(out, v)
		}
	}
	// out now contains only the kept items; capacity unchanged, len shrunk.
	return out
}

// IsSlicesEqual tells whether a and b contain the same elements.
// A nil argument is equivalent to an empty slice.
func IsSlicesEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i, v := range a {
		if v != b[i] {
			return false
		}
	}
	return true
}

// VersionLessThan checks if v1 < v2 semantically
// dev is the latest version
func VersionLessThan(v1, v2 string) (bool, error) {
	if v1 == "dev" {
		return false, nil
	}
	if v2 == "dev" {
		return true, nil
	}
	semVer1 := strings.TrimFunc(v1, func(r rune) bool {
		return !unicode.IsNumber(r)
	})
	semVer2 := strings.TrimFunc(v2, func(r rune) bool {
		return !unicode.IsNumber(r)
	})
	sv1, err := semver.Parse(semVer1)
	if err != nil {
		return false, fmt.Errorf("failed to parse semver1 (%s): %w", semVer1, err)
	}
	sv2, err := semver.Parse(semVer2)
	if err != nil {
		return false, fmt.Errorf("failed to parse semver2 (%s): %w", semVer2, err)
	}
	return sv1.LT(sv2), nil
}

// Compare any two maps with any key and value types
func CompareMaps[K comparable, V any](a, b map[K]V) bool {
	if len(a) != len(b) {
		return false
	}

	for key, valA := range a {
		valB, ok := b[key]
		if !ok {
			return false
		}

		if !reflect.DeepEqual(valA, valB) {
			return false
		}
	}

	return true
}

func UniqueStrings(input []string) []string {
	seen := make(map[string]struct{})
	var result []string

	for _, val := range input {
		if _, ok := seen[val]; !ok {
			seen[val] = struct{}{}
			result = append(result, val)
		}
	}

	return result
}
func GetClientIP(r *http.Request) string {
	// Trust X-Forwarded-For first
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xrip := r.Header.Get("X-Real-IP"); xrip != "" {
		return xrip
	}

	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

// CompareIfaceSlices compares two slices of Iface for deep equality (order-sensitive)
func CompareIfaceSlices(a, b []schema.Iface) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if !compareIface(a[i], b[i]) {
			return false
		}
	}
	return true
}
func compareIface(a, b schema.Iface) bool {
	return a.Name == b.Name &&
		a.Address.IP.Equal(b.Address.IP) &&
		a.Address.Mask.String() == b.Address.Mask.String() &&
		a.AddressString == b.AddressString
}

// IsEgressDomainPattern returns true for a normal FQDN or a single-label wildcard prefix form (*.example.com).
func IsEgressDomainPattern(domain string) bool {
	domain = strings.TrimSpace(domain)
	if domain == "" {
		return false
	}
	if strings.HasPrefix(domain, "*.") {
		return IsFQDN(strings.TrimPrefix(domain, "*."))
	}
	return IsFQDN(domain)
}

// IsFQDN checks if the given string is a valid Fully Qualified Domain Name (FQDN)
func IsFQDN(domain string) bool {
	// Basic check to ensure the domain is not empty and has at least one dot (.)
	if domain == "" || !strings.Contains(domain, ".") {
		return false
	}

	// Regular expression for validating FQDN (basic check for valid characters and structure)
	fqdnRegex := `^(?i)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`
	re := regexp.MustCompile(fqdnRegex)

	return re.MatchString(domain)
}

```

### Core Architecture Module: `migrate/utils.go`
```
package migrate

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/gravitl/netmaker/db"
	"gorm.io/gorm"
)

type KVRecord struct {
	Key   string `gorm:"column:key;primaryKey"`
	Value string `gorm:"column:value"`
}

func kvInsert(ctx context.Context, tableName, key string, value any) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	var existing KVRecord
	err = db.FromContext(ctx).Table(tableName).Where("key = ?", key).First(&existing).Error
	if err == nil {
		return db.FromContext(ctx).Table(tableName).Where("key = ?", key).Update("value", string(data)).Error
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	return db.FromContext(ctx).Table(tableName).Create(&KVRecord{Key: key, Value: string(data)}).Error
}

func kvDelete(ctx context.Context, tableName, key string) error {
	return db.FromContext(ctx).Table(tableName).Where("key = ?", key).Delete(&KVRecord{}).Error
}

func kvList(ctx context.Context, tableName string) (map[string]string, error) {
	var records []KVRecord
	err := db.FromContext(ctx).Table(tableName).Order("key").Find(&records).Error
	if err != nil {
		return nil, err
	}

	var list = make(map[string]string)
	for _, record := range records {
		list[record.Key] = record.Value
	}

	return list, nil
}

func kvCount(ctx context.Context, tableName string) (int, error) {
	var count int64
	err := db.FromContext(ctx).Table(tableName).Count(&count).Error
	return int(count), err
}

```

### Core Architecture Module: `mq/device_hooks.go`
```
package mq

import (
	"context"

	"github.com/gravitl/netmaker/db"
	"github.com/gravitl/netmaker/logic"
	"github.com/gravitl/netmaker/models"
	"github.com/gravitl/netmaker/schema"
	"github.com/gravitl/netmaker/scope"
	"github.com/gravitl/netmaker/servercfg"
)

func init() {
	logic.PublishHostRegistrationUpdates = publishHostRegistrationUpdates
	logic.RequestHostPullUpdate = requestHostPullUpdate
	logic.ProvisionDeviceHostMessaging = provisionDeviceHostMessaging
	logic.CleanupDeviceHostForOwnershipTransfer = cleanupDeviceHostForOwnershipTransfer
	logic.PublishPeerUpdateAfterExitNodeChange = func(ctx context.Context) {
		_ = PublishPeerUpdate(ctx, false)
	}
	logic.PublishExitClientsFailOpen = func(ctx context.Context, clients []models.Node) {
		_ = PublishPeerUpdatesToExitClientHosts(ctx, clients)
	}
}

func provisionDeviceHostMessaging(host *schema.Host) error {
	if host == nil || servercfg.GetBrokerType() != servercfg.EmqxBrokerType {
		return nil
	}
	return GetEmqxHandler().CreateEmqxUser(host.ID.String(), host.HostPass)
}

func publishHostRegistrationUpdates(ctx context.Context, host *schema.Host) error {
	if host == nil || !servercfg.IsMessageQueueBackend() {
		return nil
	}
	if err := HostUpdate(&models.HostUpdate{
		Action: models.RequestAck,
		Host:   *host,
	}); err != nil {
		return err
	}
	return PublishPeerUpdate(ctx, false)
}

func requestHostPullUpdate(host *schema.Host) error {
	if host == nil {
		return nil
	}
	return HostUpdate(&models.HostUpdate{
		Action: models.RequestPull,
		Host:   *host,
	})
}

func cleanupDeviceHostForOwnershipTransfer(ctx context.Context, host *schema.Host) error {
	if host == nil {
		return nil
	}
	var nodes []models.Node
	for _, nodeID := range host.Nodes {
		node, err := logic.GetNodeByID(nodeID)
		if err == nil {
			nodes = append(nodes, node)
		}
	}
	if err := logic.DefaultCleanupDeviceHostForOwnershipTransfer(ctx, host); err != nil {
		return err
	}
	for _, node := range nodes {
		detachedCtx := scope.WithContext(db.WithContext(context.Background()), scope.Level(ctx), scope.ID(ctx))
		go PublishMqUpdatesForDeletedNode(detachedCtx, host, node, false)
	}
	if servercfg.IsMessageQueueBackend() {
		return HostUpdate(&models.HostUpdate{
			Action: models.RequestPull,
			Host:   *host,
		})
	}
	return nil
}

```

### Core Architecture Module: `mq/util.go`
```
package mq

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/gravitl/netmaker/db"
	"github.com/gravitl/netmaker/logic"
	"github.com/gravitl/netmaker/models"
	"github.com/gravitl/netmaker/netclient/ncutils"
	"github.com/gravitl/netmaker/schema"
	"github.com/klauspost/compress/gzip"
	"golang.org/x/exp/slog"
)

func decryptMsgWithHost(host *schema.Host, msg []byte) ([]byte, error) {
	if host.OS == models.OS_Types.IoT { // just pass along IoT messages
		return msg, nil
	}

	trafficKey, trafficErr := logic.RetrievePrivateTrafficKey() // get server private key
	if trafficErr != nil {
		return nil, trafficErr
	}
	serverPrivTKey, err := ncutils.ConvertBytesToKey(trafficKey)
	if err != nil {
		return nil, err
	}
	nodePubTKey, err := ncutils.ConvertBytesToKey(host.TrafficKeyPublic)
	if err != nil {
		return nil, err
	}

	return ncutils.DeChunk(msg, nodePubTKey, serverPrivTKey)
}

func DecryptMsg(node *models.Node, msg []byte) ([]byte, error) {
	if len(msg) <= 24 { // make sure message is of appropriate length
		return nil, fmt.Errorf("received invalid message from broker %v", msg)
	}
	host := &schema.Host{ID: node.HostID}
	if err := host.Get(db.WithContext(context.TODO())); err != nil {
		return nil, err
	}

	return decryptMsgWithHost(host, msg)
}

func BatchItems[T any](items []T, batchSize int) [][]T {
	if batchSize <= 0 {
		return nil
	}
	remainderBatchSize := len(items) % batchSize
	nBatches := int(math.Ceil(float64(len(items)) / float64(batchSize)))
	batches := make([][]T, nBatches)
	for i := range batches {
		if i == nBatches-1 && remainderBatchSize > 0 {
			batches[i] = make([]T, remainderBatchSize)
		} else {
			batches[i] = make([]T, batchSize)
		}
		for j := range batches[i] {
			batches[i][j] = items[i*batchSize+j]
		}
	}
	return batches
}

var gzipWriterPool = sync.Pool{
	New: func() any {
		w, _ := gzip.NewWriterLevel(io.Discard, gzip.BestSpeed)
		return w
	},
}

var bufferPool = sync.Pool{
	New: func() any {
		return new(bytes.Buffer)
	},
}

func compressPayload(data []byte) ([]byte, error) {
	buf := bufferPool.Get().(*bytes.Buffer)
	buf.Reset()
	defer bufferPool.Put(buf)

	zw := gzipWriterPool.Get().(*gzip.Writer)
	zw.Reset(buf)
	defer func() {
		zw.Reset(io.Discard)
		gzipWriterPool.Put(zw)
	}()

	if _, err := zw.Write(data); err != nil {
		return nil, err
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}

	result := make([]byte, buf.Len())
	copy(result, buf.Bytes())
	return result, nil
}
func encryptAESGCM(key, plaintext []byte) ([]byte, error) {
	// Create AES block cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	// Create GCM (Galois/Counter Mode) cipher
	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	// Create a random nonce
	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	// Encrypt the data
	ciphertext := aesGCM.Seal(nonce, nonce, plaintext, nil)
	return ciphertext, nil
}

func encryptMsg(host *schema.Host, msg []byte) ([]byte, error) {
	if host.OS == models.OS_Types.IoT {
		return msg, nil
	}

	// fetch server public key to be certain hasn't changed in transit
	trafficKey, trafficErr := logic.RetrievePrivateTrafficKey()
	if trafficErr != nil {
		return nil, trafficErr
	}

	serverPrivKey, err := ncutils.ConvertBytesToKey(trafficKey)
	if err != nil {
		return nil, err
	}

	nodePubKey, err := ncutils.ConvertBytesToKey(host.TrafficKeyPublic)
	if err != nil {
		return nil, err
	}

	if strings.Contains(host.Version, "0.10.0") {
		return ncutils.BoxEncrypt(msg, nodePubKey, serverPrivKey)
	}

	return ncutils.Chunk(msg, nodePubKey, serverPrivKey)
}

func publish(host *schema.Host, dest string, msg []byte) error {

	var encrypted []byte
	var encryptErr error
	vlt, err := logic.VersionLessThan(host.Version, "v0.30.0")
	if err != nil {
		slog.Warn("error checking version less than", "error", err)
		return err
	}
	if vlt {
		encrypted, encryptErr = encryptMsg(host, msg)
		if encryptErr != nil {
			return encryptErr
		}
	} else {
		zipped, err := compressPayload(msg)
		if err != nil {
			return err
		}
		encrypted, encryptErr = encryptAESGCM(host.TrafficKeyPublic[0:32], zipped)
		if encryptErr != nil {
			return encryptErr
		}
	}

	for attempt := 0; attempt < 2; attempt++ {
		if mqclient == nil || !mqclient.IsConnectionOpen() {
			ok := false
			for i := 0; i < 5; i++ {
				time.Sleep(time.Second)
				if mqclient != nil && mqclient.IsConnectionOpen() {
					ok = true
					break
				}
			}
			if !ok {
				return errors.New("cannot publish ... mqclient not connected")
			}
		}

		token := mqclient.Publish(dest, 0, true, encrypted)
		if token.WaitTimeout(MQ_TIMEOUT*time.Second) && token.Error() == nil {
			return nil
		}
		if attempt == 0 {
			slog.Warn("publish failed, retrying after reconnect", "dest", dest)
			time.Sleep(2 * time.Second)
			continue
		}
		if token.Error() != nil {
			slog.Error("publish to mq error", "error", token.Error().Error())
			return token.Error()
		}
		return errors.New("connection timeout")
	}
	return nil
}

// decodes a message queue topic and returns the embedded node.ID
func GetID(topic string) (string, error) {
	parts := strings.Split(topic, "/")
	count := len(parts)
	if count == 1 {
		return "", fmt.Errorf("invalid topic")
	}
	//the last part of the topic will be the node.ID
	return parts[count-1], nil
}

```

### Core Architecture Module: `netclient/ncutils/constants.go`
```
package ncutils

const (
	// ACK - acknowledgement signal for MQ
	ACK = 1
	// DONE - done signal for MQ
	DONE = 2
)

```

### Core Architecture Module: `netclient/ncutils/encryption.go`
```
package ncutils

import (
	"bytes"
	"crypto/rand"
	"fmt"
	"io"

	"golang.org/x/crypto/nacl/box"
)

const (
	chunkSize = 16000 // 16000 bytes max message size
)

// BoxEncrypt - encrypts traffic box
func BoxEncrypt(message []byte, recipientPubKey *[32]byte, senderPrivateKey *[32]byte) ([]byte, error) {
	var nonce [24]byte // 192 bits of randomization
	if _, err := io.ReadFull(rand.Reader, nonce[:]); err != nil {
		return nil, err
	}

	encrypted := box.Seal(nonce[:], message, &nonce, recipientPubKey, senderPrivateKey)
	return encrypted, nil
}

// BoxDecrypt - decrypts traffic box
func BoxDecrypt(encrypted []byte, senderPublicKey *[32]byte, recipientPrivateKey *[32]byte) ([]byte, error) {
	if len(encrypted) < 24 {
		return nil, fmt.Errorf("encrypted message too short: %d bytes", len(encrypted))
	}
	var decryptNonce [24]byte
	copy(decryptNonce[:], encrypted[:24])
	decrypted, ok := box.Open(nil, encrypted[24:], &decryptNonce, senderPublicKey, recipientPrivateKey)
	if !ok {
		return nil, fmt.Errorf("could not decrypt message, %v", encrypted)
	}
	return decrypted, nil
}

// Chunk - chunks a message and encrypts each chunk
func Chunk(message []byte, recipientPubKey *[32]byte, senderPrivateKey *[32]byte) ([]byte, error) {
	var chunks [][]byte
	for i := 0; i < len(message); i += chunkSize {
		end := i + chunkSize

		if end > len(message) {
			end = len(message)
		}

		encryptedMsgSlice, err := BoxEncrypt(message[i:end], recipientPubKey, senderPrivateKey)
		if err != nil {
			return nil, err
		}

		chunks = append(chunks, encryptedMsgSlice)
	}

	chunkedMsg, err := convertBytesToMsg(chunks) // encode the array into some bytes to decode on receiving end
	if err != nil {
		return nil, err
	}

	return chunkedMsg, nil
}

// DeChunk - "de" chunks and decrypts a message
func DeChunk(chunkedMsg []byte, senderPublicKey *[32]byte, recipientPrivateKey *[32]byte) ([]byte, error) {
	chunks, err := convertMsgToBytes(chunkedMsg) // convert the message to it's original chunks form
	if err != nil {
		return nil, err
	}

	var totalMsg []byte
	for i := range chunks {
		decodedMsg, err := BoxDecrypt(chunks[i], senderPublicKey, recipientPrivateKey)
		if err != nil {
			return nil, err
		}
		totalMsg = append(totalMsg, decodedMsg...)
	}
	return totalMsg, nil
}

// == private ==

var splitKey = []byte("|(,)(,)|")

// ConvertMsgToBytes - converts a message (MQ) to it's chunked version
// decode action
func convertMsgToBytes(msg []byte) ([][]byte, error) {
	splitMsg := bytes.Split(msg, splitKey)
	return splitMsg, nil
}

// ConvertBytesToMsg - converts the chunked message into a MQ message
// encode action
func convertBytesToMsg(b [][]byte) ([]byte, error) {

	var buffer []byte  // allocate a buffer with adequate sizing
	for i := range b { // append bytes to it with key
		buffer = append(buffer, b[i]...)
		if i != len(b)-1 {
			buffer = append(buffer, splitKey...)
		}
	}
	return buffer, nil
}

```

### Core Architecture Module: `netclient/ncutils/iface.go`
```
package ncutils

import (
	"net"
)

// StringSliceContains - sees if a string slice contains a string element
func StringSliceContains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func IpIsPrivate(ipnet net.IP) bool {
	return ipnet.IsPrivate() || ipnet.IsLoopback()
}

```

### Core Architecture Module: `netclient/ncutils/netclientutils.go`
```
package ncutils

import (
	"bytes"
	"encoding/gob"
)

// DEFAULT_GC_PERCENT - garbage collection percent
const DEFAULT_GC_PERCENT = 100

// == OS PATH FUNCTIONS ==

// ConvertKeyToBytes - util to convert a key to bytes to use elsewhere
func ConvertKeyToBytes(key *[32]byte) ([]byte, error) {
	var buffer bytes.Buffer
	var enc = gob.NewEncoder(&buffer)
	if err := enc.Encode(key); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

// ConvertBytesToKey - util to convert bytes to a key to use elsewhere
func ConvertBytesToKey(data []byte) (*[32]byte, error) {
	var buffer = bytes.NewBuffer(data)
	var dec = gob.NewDecoder(buffer)
	var result = new([32]byte)
	var err = dec.Decode(result)
	if err != nil {
		return nil, err
	}
	return result, err
}

```

### Core Architecture Module: `netclient/ncutils/util.go`
```
package ncutils

// CheckInInterval - the interval for check-in time in units/minute
const CheckInInterval = 1

```

### Core Architecture Module: `pro/email/utils.go`
```
package email

import "strings"

// mail related images hosted on cdn
var (
	netmakerLogoTeal = "https://media.netmaker.io/logos/png/netmaker-logo-full-light-1.png"
)

type EmailBodyBuilder interface {
	WithHeadline(text string) EmailBodyBuilder
	WithParagraph(text string) EmailBodyBuilder
	WithHtml(text string) EmailBodyBuilder
	WithSignature() EmailBodyBuilder
	Build() string
}

type EmailBodyBuilderWithH1HeadlineAndImage struct {
	headline     string
	bodyContent  []string
	hasSignature bool
}

func (b *EmailBodyBuilderWithH1HeadlineAndImage) WithHeadline(text string) EmailBodyBuilder {
	b.headline = text
	return b
}

func (b *EmailBodyBuilderWithH1HeadlineAndImage) WithParagraph(text string) EmailBodyBuilder {
	b.bodyContent = append(b.bodyContent, styledParagraph(text))
	return b
}

func (b *EmailBodyBuilderWithH1HeadlineAndImage) WithHtml(text string) EmailBodyBuilder {
	b.bodyContent = append(b.bodyContent, text)
	return b
}

func (b *EmailBodyBuilderWithH1HeadlineAndImage) WithSignature() EmailBodyBuilder {
	b.hasSignature = true
	return b
}

func (b *EmailBodyBuilderWithH1HeadlineAndImage) Build() string {
	bodyContent := strings.Join(b.bodyContent, "")

	// TODO: Edit design to add signature.
	//signature := ""
	//if b.hasSignature {
	//	signature = styledSignature()
	//}

	return `
<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>Simple Transactional Email</title>
    <style media="all" type="text/css">
@media all {
  .btn-primary table td:hover {
    background-color: #ec0867 !important;
  }

  .btn-primary a:hover {
    background-color: #ec0867 !important;
    border-color: #ec0867 !important;
  }
}
@media only screen and (max-width: 640px) {
  .main p,
.main td,
.main span {
    font-size: 16px !important;
  }

  .wrapper {
    padding: 8px !important;
  }

  .content {
    padding: 0 !important;
  }

  .container {
    padding: 0 !important;
    padding-top: 8px !important;
    width: 100% !important;
  }

  .main {
    border-left-width: 0 !important;
    border-radius: 0 !important;
    border-right-width: 0 !important;
  }

  .btn table {
    max-width: 100% !important;
    width: 100% !important;
  }

  .btn a {
    font-size: 16px !important;
    max-width: 100% !important;
    width: 100% !important;
  }
}
@media all {
  .ExternalClass {
    width: 100%;
  }

  .ExternalClass,
.ExternalClass p,
.ExternalClass span,
.ExternalClass font,
.ExternalClass td,
.ExternalClass div {
    line-height: 100%;
  }

  .apple-link a {
    color: inherit !important;
    font-family: inherit !important;
    font-size: inherit !important;
    font-weight: inherit !important;
    line-height: inherit !important;
    text-decoration: none !important;
  }

  #MessageViewBody a {
    color: inherit;
    text-decoration: none;
    font-size: inherit;
    font-family: inherit;
    font-weight: inherit;
    line-height: inherit;
  }
}
</style>
  </head>
  <body style="font-family: Helvetica, sans-serif; -webkit-font-smoothing: antialiased; font-size: 16px; line-height: 1.3; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; background-color: #f4f5f6; margin: 0; padding: 0;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="body" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #f4f5f6; width: 100%;" width="100%" bgcolor="#f4f5f6">
      <tr>
        <td style="font-family: Helvetica, sans-serif; font-size: 16px; vertical-align: top;" valign="top">&nbsp;</td>
        <td class="container" style="font-family: Helvetica, sans-serif; font-size: 16px; vertical-align: top; max-width: 600px; padding: 24px 0px 24px 0px; width: 600px; margin: 0 auto;" width="600" valign="top">
          <div class="content" style="box-sizing: border-box; display: block; margin: 0 auto; max-width: 600px; padding: 0;">

            <!-- START CENTERED WHITE CONTAINER -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="main" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background: #ffffff; border: 1px solid #eaebed; border-radius: 16px; width: 100%;" width="100%">

              <!-- START MAIN CONTENT AREA -->
              <tr>
                <td class="wrapper" style="font-family: Helvetica, sans-serif; font-size: 16px; vertical-align: top; box-sizing: border-box; padding: 24px;" valign="top">
                  <img src="` + netmakerLogoTeal + `" alt="Netmaker Logo" width="200" border="0" style="border:0; outline:none; text-decoration:none; display:block; margin-right: auto; margin-bottom: 24px; height: auto;">
                  ` + bodyContent + `
                </td>
              </tr>

              <!-- END MAIN CONTENT AREA -->
              </table>

<!-- END CENTERED WHITE CONTAINER --></div>
        </td>
        <td style="font-family: Helvetica, sans-serif; font-size: 16px; vertical-align: top;" valign="top">&nbsp;</td>
      </tr>
    </table>
  </body>
</html>`
}

func styledParagraph(text string) string {
	return `<p style="font-family: Helvetica, sans-serif; font-size: 16px; font-weight: normal; margin: 0; margin-bottom: 16px;">` + text + `</p>`
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4086** (2026-07-15): **[Bug]: NAT/Masquarade dont work since Update to v1.6**
  *Symptoms*: ### Contact Details  _No response_  ### What happened?  Since ive updated to v1.6 the Site-2-Site Access isnt working anymore when no routes are set. It worked like a charm until update ...  ### Version  v1.6.0  ### What OS are you using?  Linux  ### Relevant log output  ```shell  ```  ### Contributing guidelines  - [x] Yes, I did.
  **Post-Mortem & Fix Analysis**:
  > Hi @maieredv-manuel,  Thanks for reporting this.  Could you provide a few more details about your setup?  1. Can you describe your Site-to-Site topology (how many egress gateways/sites are connected)? 2. When you say "no routes are set", do you mean there are no Site-to-Site routes configured at all? 3. Is NAT enabled on the egress gateways? 4. What traffic are you expecting to pass through the egress gateway (source subnet → destination subnet)? 5. Was this same configuration working on v1.5.x without any additional routes configured?  If you could also share your Site-to-Site configuration (screenshots or relevant settings), that would help us understand the scenario and try to reproduce it.  Best, Majdi
  > Hi @Mejdii   sorry ... i was in hurry ...   1. we have a "Cloud-Hub" as Node and Gateway, all Site Nodes (in that case 3) are connection to the "Cloud-Hub" (so we need no Portforwarding on the Sites). We have one Egress rule for every Side via the Site-Node.  2. Sure, Site-to-Site Routes in netmaker are set. But we are using Direct-NAT via Netmaker > so we dont needed to create any Static Routes per Site. 3. Yes, is enabled, and worked like it should until Update to 1.6.0 4. Yes, "simple" Site-to-Site and access from "Config-Nodes" to the Sites. 5. Yes, worked, ive changed nothing, only Updated to 1.6  Ive found an workaround for that:    When i enable masquarade via: "nft add rule inet nat POSTROUTING iifname "eth0" masquerade" then it works again. But netclient flushes all nft rules every XX Hours, then it again stopes working :-(  I also get this Log Output:  Jul 10 14:14:30 WBG-NM-NODE01 netclient[302]: [netclient] 2026-07-10 14:14:30 InsertEgressRoutingRules called for egress f0dd
  > @maieredv-manuel   The fact that manually adding a masquerade rule restores connectivity, suggests the required NAT rule is no longer being installed.  Could you also share the output of:  nft list ruleset  both:  immediately after netclient starts (before adding your manual rule), and after adding: nft add rule inet nat POSTROUTING iifname "eth0" masquerade  This will help us compare the generated NAT rules and identify what's missing in v1.6  And Just to confirm, is your firewall configured with native nftables only, or are you using iptables (including the nftables backend)?

- **Issue #4084** (2026-07-20): **[Bug]: Can't create admin user in self-hosted setup**
  *Symptoms*: ### Contact Details  _No response_  ### What happened?  After successful setup I'm unable to create first user. I'm following https://docs.netmaker.io/docs/server-installation/quick-install and log in part says:  `On the login screen, use the initial admin credentials created during installation.`  but the installation process does not display or ask for any credentials. I tried:  nmctl user create --admin --name admin --password password  2026/07/11 15:28:08 Error Status: 400 Response: {"Code":400,"Message":"record not found","Response":null}  nmctl server has_admin 2026/07/11 15:28:33 Error Status: 404 Response: 404 page not found  Why can't I use nmctl? I specifically downloaded 1.6.0 version of nmctl. How can I crate the admin user?   ### Version  v1.6.0  ### What OS are you using?  Linux  ### Relevant log output  ```shell  ```  ### Contributing guidelines  - [x] Yes, I did.
  **Post-Mortem & Fix Analysis**:
  > Removing the user from db in  /var/lib/docker/volumes/netmaker_sqldata/_data/netmaker.db gave me the registration page again. 

- **Issue #4062** (2026-08-26): **[Bug]: Hardcoded InsecureSkipVerify in SMTP Client**
  *Symptoms*: ### Contact Details  _No response_  ### What happened?  (emailed on 24 May and then 6 June but no responses received)  Netmaker's Pro email sender unconditionally disables TLS certificate verification when connecting to the configured SMTP server. A comment in the source even acknowledges "In production this should be set to false" but the flag is hardcoded `true`. Any attacker with a network path between the Netmaker host and the SMTP server can intercept outgoing emails — which may carry password-reset tokens or user-invitation links — enabling account takeover without any prior authentication.  Vulnerable Code  **File:** `pro/email/smtp.go:35`  ```go // This is only needed when SSL/TLS certificate is not valid on server. // In production this should be set to false. d.TLSConfig = &tls.Config{InsecureSkipVerify: true} ```  The `InsecureSkipVerify: true` flag instructs the Go TLS stack to accept any certificate presented by the SMTP server, including self-signed or attacker-controlled ones. There is no runtime check, no configuration toggle, and no way for operators to re-enable verification.  ---  Impact  - **Credential interception:** Password-reset emails contain single-use tokens. Intercepting them allows an attacker to reset any user's password and take over the account. - **Invitation link theft:** New-user invitations sent via email can be intercepted before the legitimate recipient acts on them. - **Email tampering:** An active MitM can modify email body/headers, e.g

- **Issue #4010** (2026-05-30): **[Bug]: Netclient Does Not Install Valid Overlapping Route, When More Specific Route Already Exists**
  *Symptoms*: ### Contact Details  cesarmacias  ### What happened?  Summary  Netclient receives the remote route correctly from peers, but it does not add the route to the Linux routing table when a more specific route already exists on another interface.  The route is valid and Linux accepts it manually without any issue. After adding it manually, connectivity works correctly.  This appears to be an incorrect overlap validation in Netclient/Netmaker.  Environment OS: Ubuntu 24.04 Netclient interface: netmaker Routing backend: standard Linux kernel routing Netclient version: 1.5.1 Problem Description  The peer advertises the following route:  10.128.0.0/9  The route is visible in:  netclient peers  However, Netclient does not install the route into the Linux routing table.  The system already has a more specific route on another interface:  10.244.0.0/16 via eth0  Netclient seems to reject the /9 route because of the overlap, even though Linux routing fully supports this scenario using longest-prefix-match logic.  Expected Behavior  Both routes should coexist:  10.128.0.0/9     dev netmaker 10.244.0.0/16    via eth0  Linux should prefer the more specific /16 route for 10.244.x.x traffic and use the /9 route for the remaining address space.  This is normal and valid routing behavior.  Actual Behavior  The /9 route is received from the peer but is not installed into the routing table.  As a result, traffic to networks inside 10.128.0.0/9 fails until the route is manually added.  Evidence Pee

- **Issue #3958** (2026-04-07): **[Bug]: Netmaker server crash after upgrading from 1.5.0 to 1.5.1**
  *Symptoms*: ### Contact Details  _No response_  ### What happened?  In `netmaker.env` I have set:  ``` SERVER_IMAGE_TAG=v1.5.1 UI_IMAGE_TAG=v1.5.1 ```  and then I restarted everything using:  ``` docker compose up -d ```  But now the netmaker server crashed right after startup:  ``` netmaker  | 2026/04/04 11:12:02 maxprocs: Leaving GOMAXPROCS=2: CPU quota undefined netmaker  | netmaker  |  __   __     ______     ______   __    __     ______     __  __     ______     ______ netmaker  | /\ "-.\ \   /\  ___\   /\__  _\ /\ "-./  \   /\  __ \   /\ \/ /    /\  ___\   /\  == \ netmaker  | \ \ \-.  \  \ \  __\   \/_/\ \/ \ \ \-./\ \  \ \  __ \  \ \  _"-.  \ \  __\   \ \  __< netmaker  |  \ \_\\"\_\  \ \_____\    \ \_\  \ \_\ \ \_\  \ \_\ \_\  \ \_\ \_\  \ \_____\  \ \_\ \_\ netmaker  |   \/_/ \/_/   \/_____/     \/_/   \/_/  \/_/   \/_/\/_/   \/_/\/_/   \/_____/   \/_/ /_/ netmaker  | netmaker  | netmaker  | [netmaker] 2026-04-04 11:12:02 database successfully connected netmaker  | [netmaker] 2026-04-04 11:12:02 connecting to sqlite netmaker  | panic: error parsing network (development) cidr (): invalid CIDR address: netmaker  | netmaker  | goroutine 1 [running]: netmaker  | main.initialize() netmaker  | 	/app/main.go:135 +0x484 netmaker  | main.main() netmaker  | 	/app/main.go:60 +0x144 ```  ### Version  v1.5.0  ### What OS are you using?  Linux  ### Relevant log output  ```shell  ```  ### Contributing guidelines  - [x] Yes, I did.
  **Post-Mortem & Fix Analysis**:
  > I have downloaded and ran the nm-quick.sh script to reconfigure everything, but the error persists.
  > Can you pull latest image and try again? `docker compose pull && docker compose up -d`
  > it works now, thanks.

- **Issue #3715** (2025-11-21): **[Bug]: error in getting getNSAndDomains**
  *Symptoms*:  ### What happened?  Hello, after updating to version 1.1.0, the servers started showing many Netmaker errors like this:  netclient[2938349]: {"time":"2025-11-03T13:30:34.819772505Z","level":"ERROR","source":"config_linux.go 249}","msg":"error in getting getNSAndDomains","error":"no listener is running"} netclient[2938349]: {"time":"2025-11-03T13:30:34.81981516Z","level":"ERROR","source":"config_linux.go 313}","msg":"could not build config content","error":"no listener is running"} netclient[2938349]: {"time":"2025-11-03T13:31:49.337290926Z","level":"ERROR","source":"config_linux.go 249}","msg":"error in getting getNSAndDomains","error":"no listener is running"} netclient[2938349]: {"time":"2025-11-03T13:31:49.337326262Z","level":"ERROR","source":"config_linux.go 313}","msg":"could not build config content","error":"no listener is running"}  In the netmaker.env file, I have the following settings configured for DNS:  **DNS_MODE=off** **MANAGE_DNS=false**   ### Version  v1.1.0  ### What OS are you using?  Linux  ### Relevant log output  ```shell  ```  ### Contributing guidelines  - [x] Yes, I did.
  **Post-Mortem & Fix Analysis**:
  > @josifpeev, please upgrade your server to v1.2.0

- **Issue #3696** (2025-11-21): **[Bug]: Managed DNS service randomly repeats its search doman**
  *Symptoms*: ### Contact Details  _No response_  ### What happened?  When Managed DNS is enabled, the file `/etc/resolv.conf` randomly repeats the `nm.internal` search domain on some hosts, but not all. So for example, while most nodes have this:  ``` # NETMAKER DNS CONFIG START search nm.internal nm.internal . ... ```  Some even have this:  ``` # NETMAKER DNS CONFIG START search nm.internal nm.internal nm.internal nm.internal nm.internal nm.internal nm.internal nm.internal . ```  Also I noticed that the DNS server which is bundled into netclient may return unparsable responses to downstream DNS servers like CoreDNS in our Kubernetes cluster. Unfortunately, I haven't been able to reliably reproduce this yet. Last time I just switched off Managed DNS and switched it on again and the issue has not reappeared since then.  ### Version  v1.1.0  ### What OS are you using?  Linux  ### Relevant log output  ```shell  ```  ### Contributing guidelines  - [x] Yes, I did.
  **Post-Mortem & Fix Analysis**:
  > @christian-schlichtherle fixed in v1.2.0

- **Issue #3653** (2025-09-18): **[Bug]: Failed upgarde from 0.30.0 to 1.1.0 (ee)**
  *Symptoms*: ### Contact Details  _No response_  ### What happened?  Upgrading to 1.1.0-ee from 0.30.0-ee is causing high CPU usage - Caddy and Netmaker containers mainly; docker logs show constant new connections from peers dropping instantly; remote access is not happening (gateway not even pingable), form the gateway device very slow connections can be made (sometimes). Tried to downgrade back to 0.30.0 - no go: nodes not connecting back to the network, remote access - no handshake; from downgraded version upgrade to 1.0.0 same result as 1.1.0. Rejoining the network also does not solve the issue  ### Version  v1.1.0  ### What OS are you using?  Linux  ### Relevant log output  ```shell  ```  ### Contributing guidelines  - [x] Yes, I did.
  **Post-Mortem & Fix Analysis**:
  > How many nodes do you have in your network?
  > We don't recommend downgrading once you upgrade the version
  > > How many nodes do you have in your network?  12, currently 7 are online

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

### Incident Patch 1: `03e0bd2b` (2026-09-21)
**Commit Message**: fix(go): handle create-org-owner allowed post create-super-admin call;

**File**: `controllers/org.go` (modified, +46/-6)
```diff
@@ -40,6 +40,33 @@ func orgHandlers(r *mux.Router) {
 
 var errOrgNotFound = errors.New("organization not found")
 
+func createOrgOwnerMembership(ctx context.Context, user *schema.User) error {
+	tenant := &schema.Tenant{ID: scope.ID(ctx)}
+	if err := tenant.Get(ctx); err != nil {
+		return err
+	}
+
+	owner := &schema.OrgMembership{OrganizationID: tenant.OrganizationID}
+	err := owner.GetOwner(ctx)
+	if err == nil {
+		return nil
+	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
+		return err
+	}
+
+	return (&schema.OrgMembership{
+		OrganizationID:             tenant.OrganizationID,
+		UserID:                     user.ID,
+		RoleID:                     schema.OrgOwner,
+		AuthType:                   user.AuthType,
+		ExternalIdentityProviderID: user.ExternalIdentityProviderID,
+		Password:                   user.Password,
+		AccountDisabled:            user.AccountDisabled,
+		IsMFAEnabled:               user.IsMFAEnabled,
+		TOTPSecret:                 user.TOTPSecret,
+	}).Create(ctx)
+}
+
 func resolveSoleOrg(ctx context.Context, orgID string) (*schema.Organization, error) {
 	o, err := logic.SoleOrganization(ctx)
 	if err != nil {
@@ -373,6 +400,25 @@ func createOrgOwner(w http.ResponseWriter, r *http.Request) {
 		return
 	}
 
+	tenants, err := (&schema.Tenant{}).List(dbctx, dbtypes.WithFilter("organization_id", o.ID))
+	if err != nil {
+		logic.ReturnErrorResponse(w, r, logic.FormatError(err, logic.Internal))
+		return
+	}
+
+	for _, tenant := range tenants {
+		tenantCtx := scope.WithContext(dbctx, scope.TenantScope, tenant.ID)
+		exists, err := (&schema.User{}).SuperAdminExists(tenantCtx)
+		if err != nil {
+			logic.ReturnErrorResponse(w, r, logic.FormatError(err, logic.Internal))
+			return
+		}
+		if exists {
+			logic.ReturnErrorResponse(w, r, logic.FormatError(errors.New("organization is already set up"), logic.BadReq))
+			return
+		}
+	}
+
 	var user schema.User
 	err = json.NewDecoder(r.Body).Decode(&user)
 	if err != nil {
@@ -401,12 +447,6 @@ func createOrgOwner(w http.ResponseWriter, r *http.Request) {
 		return
 	}
 
-	tenants, err := (&schema.Tenant{}).List(dbctx, dbtypes.WithFilter("organization_id", o.ID))
-	if err != nil {
-		logic.ReturnErrorResponse(w, r, logic.FormatError(err, logic.Internal))
-		return
-	}
-
 	for _, tenant := range tenants {
 		err = orchestrator.GetRepository().TenantOrchestrator().GrantTenantSuperAdmin(dbctx, &tenant, &user)
 		if err != nil {
```

**File**: `controllers/user.go` (modified, +24/-1)
```diff
@@ -1319,13 +1319,36 @@ func createSuperAdmin(w http.ResponseWriter, r *http.Request) {
 		return
 	}
 
-	err = orchestrator.GetRepository().UserOrchestrator().CreateUser(r.Context(), &user)
+	dbctx := db.BeginTx(r.Context())
+	commit := false
+	defer func() {
+		if commit {
+			db.FromContext(dbctx).Commit()
+		} else {
+			db.FromContext(dbctx).Rollback()
+		}
+	}()
+
+	err = orchestrator.GetRepository().UserOrchestrator().CreateUser(dbctx, &user)
 	if err != nil {
 		slog.Error("failed to create superadmin", "error", err.Error())
 		logic.ReturnErrorResponse(w, r, logic.FormatError(err, logic.BadReq))
 		return
 	}
 
+	// on MSP the org owner is created via createOrgOwner instead, which also
+	// grants super admin on every tenant of the org.
+	if !logic.IsMSP(dbctx) {
+		err = createOrgOwnerMembership(dbctx, &user)
+		if err != nil {
+			slog.Error("failed to create org owner for superadmin", "error", err.Error())
+			logic.ReturnErrorResponse(w, r, logic.FormatError(err, logic.Internal))
+			return
+		}
+	}
+
+	commit = true
+
 	logger.Log(1, user.Username, "was made a super admin")
 	_ = json.NewEncoder(w).Encode(logic.ToReturnUser(&user))
 }
```

---

### Incident Patch 2: `cf1acff1` (2026-09-21)
**Commit Message**: fix(go): resync tenant id on license change; show license error on any error while license validation;

**File**: `migrate/migrate_multitenancy.go` (modified, +2/-2)
```diff
@@ -10,9 +10,9 @@ import (
 	"github.com/gravitl/netmaker/scope"
 )
 
-var SyncOrgAndTenants = CreateLocalDefaults
+var MigrateOrgAndTenants = migrateOrgAndTenants
 
-func CreateLocalDefaults(ctx context.Context) error {
+func migrateOrgAndTenants(ctx context.Context) error {
 	org, err := EnsureLocalOrganization(ctx)
 	if err != nil {
 		return err
```

**File**: `migrate/migrate_schema_test.go` (modified, +10/-10)
```diff
@@ -122,7 +122,7 @@ func TestToSQLSchema_StuckServerCompletesV160AndV170(t *testing.T) {
 	ctx := setupMigrationTest(t)
 	networkName, nodeID := seedLegacyKVData(t, ctx)
 
-	require.NoError(t, CreateLocalDefaults(ctx))
+	require.NoError(t, migrateOrgAndTenants(ctx))
 	markMigrationJobComplete(t, ctx, "migration-multitenancy")
 	markMigrationJobComplete(t, ctx, "migration-v1.5.1")
 
@@ -179,7 +179,7 @@ func TestToSQLSchema_StuckServerCompletesV160AndV170(t *testing.T) {
 func TestToSQLSchema_SkipsCompletedPreMTJobs(t *testing.T) {
 	ctx := setupMigrationTest(t)
 
-	require.NoError(t, CreateLocalDefaults(ctx))
+	require.NoError(t, migrateOrgAndTenants(ctx))
 	markMigrationJobComplete(t, ctx, "migration-multitenancy")
 	markMigrationJobComplete(t, ctx, "migration-v1.5.1")
 	markMigrationJobComplete(t, ctx, "migration-v1.6.0")
@@ -200,19 +200,19 @@ func TestToSQLSchema_SkipsCompletedPreMTJobs(t *testing.T) {
 	require.Len(t, tenants, 1)
 }
 
-// TestMigrateV1_7_0_UsesSyncOrgAndTenantsHook ensures v1.7.0 step 0 goes through
-// SyncOrgAndTenants (EE overrides this with license sync) rather than always
-// calling CreateLocalDefaults, which breaks MSP installs that need multiple
+// TestMigrateV1_7_0_UsesMigrateOrgAndTenantsHook ensures v1.7.0 step 0 goes through
+// MigrateOrgAndTenants (EE overrides this with license sync) rather than always
+// calling migrateOrgAndTenants, which breaks MSP installs that need multiple
 // tenants from the account server.
-func TestMigrateV1_7_0_UsesSyncOrgAndTenantsHook(t *testing.T) {
+func TestMigrateV1_7_0_UsesMigrateOrgAndTenantsHook(t *testing.T) {
 	ctx := setupMigrationTest(t)
 	markMigrationJobComplete(t, ctx, migrationJobV160)
 
-	orig := SyncOrgAndTenants
-	t.Cleanup(func() { SyncOrgAndTenants = orig })
+	orig := MigrateOrgAndTenants
+	t.Cleanup(func() { MigrateOrgAndTenants = orig })
 
 	called := false
-	SyncOrgAndTenants = func(ctx context.Context) error {
+	MigrateOrgAndTenants = func(ctx context.Context) error {
 		called = true
 		org := &schema.Organization{
 			ID:   "license-org-id",
@@ -231,7 +231,7 @@ func TestMigrateV1_7_0_UsesSyncOrgAndTenantsHook(t *testing.T) {
 	}
 
 	require.NoError(t, migrateV1_7_0(ctx))
-	assert.True(t, called, "expected SyncOrgAndTenants hook to run")
+	assert.True(t, called, "expected MigrateOrgAndTenants hook to run")
 
 	tenants, err := (&schema.Tenant{}).List(ctx)
 	require.NoError(t, err)
```

**File**: `migrate/migrate_v1_7_0.go` (modified, +3/-3)
```diff
@@ -35,10 +35,10 @@ const (
 
 func migrateV1_7_0(ctx context.Context) error {
 	// Step 0: bootstrap org/tenants (was migration-multitenancy).
-	// Goes through SyncOrgAndTenants so EE/MSP can sync from license validation
+	// Goes through MigrateOrgAndTenants so EE/MSP can sync from license validation
 	// instead of always creating a local UUID default tenant. CE keeps the
-	// CreateLocalDefaults default; idempotent when org/tenant already exist.
-	if err := SyncOrgAndTenants(ctx); err != nil {
+	// migrateOrgAndTenants default; idempotent when org/tenant already exist.
+	if err := MigrateOrgAndTenants(ctx); err != nil {
 		return err
 	}
 
```

**File**: `pro/initialize.go` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ func InitPro() {
 		proControllers.IntegrationHandlers,
 	)
 	controller.ListRoles = proControllers.ListRoles
-	migrate.SyncOrgAndTenants = license.SyncOrgAndTenants
+	migrate.MigrateOrgAndTenants = license.MigrateOrgAndTenants
 	servercfg.ErrLicenseValidation = license.ErrLicenseValidation
 	logic.EnterpriseCheckFuncs = append(logic.EnterpriseCheckFuncs, func(ctx context.Context, wg *sync.WaitGroup) {
 		logger.Log(0, "starting license checker")
```

**File**: `pro/license/cache.go` (modified, +0/-5)
```diff
@@ -9,11 +9,6 @@ import (
 	"github.com/gravitl/netmaker/schema"
 )
 
-func hasCachedResponse(ctx context.Context) bool {
-	cached := &schema.Internal{Key: schema.InternalKey_LicenseValidationCachedResponse}
-	return cached.Get(ctx) == nil
-}
-
 var cachedResponse atomic.Pointer[ValidatedLicense]
 
 func cacheResponse(ctx context.Context, response []byte) error {
```

**File**: `pro/license/license.go` (modified, +50/-69)
```diff
@@ -42,21 +42,22 @@ func AddLicenseHooks() {
 	}
 }
 
-func SyncOrgAndTenants(ctx context.Context) error {
-	licenseResponse, isCachedResp, err := fetchValidatedLicense(ctx)
-	if err != nil {
+func MigrateOrgAndTenants(ctx context.Context) error {
+	if err := clearCachedResponse(ctx); err != nil {
 		return err
 	}
 
-	if isCachedResp {
-		return nil
+	// the cache was just cleared, so the response is never a cached one.
+	licenseResponse, _, err := fetchValidatedLicense(ctx)
+	if err != nil {
+		return err
 	}
 
-	return syncOrgAndTenantsFromResponse(ctx, licenseResponse, false)
+	return syncOrgAndTenantsFromResponse(ctx, licenseResponse)
 }
 
-func syncOrgAndTenantsFromResponse(ctx context.Context, licenseResponse ValidatedLicense, hadCache bool) error {
-	if hadCache {
+func syncOrgAndTenantsFromResponse(ctx context.Context, licenseResponse ValidatedLicense) error {
+	if licenseResponse.Organization.ID != "" {
 		return upsertOrgAndTenants(ctx, licenseResponse)
 	}
 	return reconcileOrgAndTenants(ctx, licenseResponse)
@@ -84,15 +85,6 @@ func upsertOrgAndTenants(ctx context.Context, licenseResponse ValidatedLicense)
 }
 
 func upsertOrganization(ctx context.Context, licenseOrg LicenseOrg) (string, error) {
-	if licenseOrg.ID == "" {
-		// single-tenant PRO: the license carries no organization.
-		org, err := migrate.EnsureLocalOrganization(ctx)
-		if err != nil {
-			return "", err
-		}
-		return org.ID, nil
-	}
-
 	org := &schema.Organization{ID: licenseOrg.ID}
 	err := org.Get(ctx)
 	if err != nil {
@@ -160,62 +152,20 @@ func teardownDeletedTenant(ctx context.Context, tenantID string) error {
 }
 
 func reconcileOrgAndTenants(ctx context.Context, licenseResponse ValidatedLicense) error {
-	orgID, err := reconcileOrganization(ctx, licenseResponse.Organization)
+	// non-MSP: the license carries no organization, so the local one is used.
+	org, err := migrate.EnsureLocalOrganization(ctx)
 	if err != nil {
 		return fmt.Errorf("failed to reconcile organization: %w", err)
 	}
 
-	if err := reconcileTenants(ctx, licenseResponse.Tenants, orgID); err != nil {
+	if err := reconcileTenants(ctx, licenseResponse.Tenants, org.ID); err != nil {
 		return fmt.Errorf("failed to reconcile tenants: %w", err)
 	}
 
 	return nil
 }
 
-func reconcileOrganization(ctx context.Context, licenseOrg LicenseOrg) (string, error) {
-	if licenseOrg.ID == "" {
-		org, err := migrate.EnsureLocalOrganization(ctx)
-		if err != nil {
-			return "", err
-		}
-		return org.ID, nil
-	}
-
-	orgs, err := (&schema.Organization{}).ListAll(ctx)
-	if err != nil {
-		return "", err
-	}
-
-	switch len(orgs) {
-	case 0:
-		org := &schema.Organization{ID: licenseOrg.ID, Name: licenseOrg.Name, Metadata: licenseOrg.Metadata}
-		if err := org.Create(ctx); err != nil {
-			return "", err
-		}
-		return org.ID, nil
-	case 1:
-		existing := orgs[0]
-		if existing.ID != licenseOrg.ID {
-			if err := migrate.RekeyOrganization(ctx, existing.ID, licenseOrg.ID); err != nil {
-				return "", err
-			}
-		}
-		org := &schema.Organization{ID: licenseOrg.ID, Name: licenseOrg.Name, Metadata: licenseOrg.Metadata}
-		if err := org.Update(ctx); err != nil {
-			return "", err
-		}
-		return licenseOrg.ID, nil
-	default:
-		return "", fmt.Errorf("cannot reconcile license organization: %d local organizations already exist", len(orgs))
-	}
-}
-
 func reconcileTenants(ctx context.Context, licenseTenants []LicenseTenant, orgID string) error {
-	existing, err := (&schema.Tenant{}).List(ctx)
-	if err != nil {
-		return err
-	}
-
 	activeTenants := make([]LicenseTenant, 0, len(licenseTenants))
 	for _, licenseTenant := range licenseTenants {
 		if licenseTenant.Status == TenantStatusDeleted {
@@ -227,6 +177,12 @@ func reconcileTenants(ctx context.Context, licenseTenants []LicenseTenant, orgID
 		activeTenants = append(activeTenants, licenseTenant)
 	}
 
+	// list after teardown so a tenant that was just removed isn't counted.
+	existing, err := (&schema.Tenant{}).List(ctx)
+	if err != nil {
+		return err
+	}
+
 	switch len(existing) {
 	case 0:
 		// nothing pre-existing locally -- nothing to rekey.
@@ -333,14 +289,16 @@ func getLicensePublicKey(licensePubKeyEncoded string) (*[32]byte, error) {
 // if license is free_tier and limits exceeds, then function should error
 // if license is not valid, function should error
 func ValidateLicense(ctx context.Context, clearCache bool) (err error) {
+	var isCachedResp bool
 	defer func() {
 		if err != nil {
 			err = fmt.Errorf("%w: %s", errValidation, err.Error())
+			setLicenseInvalidErr(err)
+		} else if !isCachedResp {
+			licenseInvalidErr.Store(nil)
 		}
 	}()
 
-	hadCache := hasCachedResponse(ctx)
-
 	if clearCache {
 		err = clearCachedResponse(ctx)
 		if err != nil {
@@ -356,7 +314,7 @@ func ValidateLicense(ctx context.Context, clearCache bool) (err error) {
 		return
 	}
 
-	if err = syncOrgAndTenantsFromResponse(ctx, licenseResponse, hadCache); err != nil {
+	if err = syncOrgAndTenantsFromResponse(ctx, licenseResponse); err 
```

---

### Incident Patch 3: `358d6737` (2026-09-15)
**Commit Message**: Merge pull request #4147 from gravitl/security-fixes

Security Fixes

**File**: `controllers/hosts.go` (modified, +18/-4)
```diff
@@ -1335,9 +1335,10 @@ func signalPeer(w http.ResponseWriter, r *http.Request) {
 		return
 	}
 	// confirm host exists
-	err = (&schema.Host{
+	senderHost := &schema.Host{
 		ID: hostID,
-	}).Get(r.Context())
+	}
+	err = senderHost.Get(r.Context())
 	if err != nil {
 		logger.Log(0, r.Header.Get("user"), "failed to get host:", err.Error())
 		logic.ReturnErrorResponse(w, r, logic.FormatError(err, "badrequest"))
@@ -1358,14 +1359,18 @@ func signalPeer(w http.ResponseWriter, r *http.Request) {
 		return
 	}
 	signal.IsPro = servercfg.IsPro
-	hostID, err = uuid.Parse(signal.ToHostID)
+	// bind the sender identity to the authenticated host rather than trusting the request body
+	signal.FromHostID = senderHost.ID.String()
+	signal.FromHostPubKey = senderHost.PublicKey.String()
+
+	toHostID, err := uuid.Parse(signal.ToHostID)
 	if err != nil {
 		err = fmt.Errorf("failed to parse host id: %w", err)
 		logic.ReturnErrorResponse(w, r, logic.FormatError(err, logic.BadReq))
 		return
 	}
 	peerHost := &schema.Host{
-		ID: hostID,
+		ID: toHostID,
 	}
 	err = peerHost.Get(r.Context())
 	if err != nil {
@@ -1376,6 +1381,15 @@ func signalPeer(w http.ResponseWriter, r *http.Request) {
 		)
 		return
 	}
+	// the target host must share a network with the authenticated sender
+	if !logic.HostsShareNetwork(r.Context(), senderHost.ID.String(), peerHost.ID.String()) {
+		logic.ReturnErrorResponse(
+			w,
+			r,
+			logic.FormatError(errors.New("failed to signal, peer not found"), "badrequest"),
+		)
+		return
+	}
 	err = mq.HostUpdate(&models.HostUpdate{
 		Action: models.SignalHost,
 		Host:   *peerHost,
```

**File**: `controllers/node.go` (modified, +4/-2)
```diff
@@ -255,10 +255,12 @@ func listNetworkNodes(w http.ResponseWriter, r *http.Request) {
 
 	var filters, options []dbtypes.Option
 	filters = append(filters, dbtypes.WithFilter("network_id", network.ID))
-	if len(osFilters) > 0 {
+	if len(osFilters) > 0 || q != "" {
 		filters = append(filters, func(db *gorm.DB) *gorm.DB {
 			return db.Joins("JOIN hosts_v1 ON hosts_v1.id = nodes_v1.host_id")
 		})
+	}
+	if len(osFilters) > 0 {
 		filters = append(filters, dbtypes.WithFilter("hosts_v1.os", osFilters...))
 	}
 	filters = append(filters, dbtypes.WithFilter("status", statusFilters...))
@@ -288,7 +290,7 @@ func listNetworkNodes(w http.ResponseWriter, r *http.Request) {
 	filters = append(filters, dbtypes.WithSearchQuery(
 		q,
 		fmt.Sprintf("%s.id", (&schema.Node{}).TableName()),
-		"name",
+		"hosts_v1.name",
 		"address",
 		"address6",
 		expr.ByteaField("endpoint_ip"),
```

**File**: `logic/hosts.go` (modified, +22/-0)
```diff
@@ -595,6 +595,28 @@ func GetHostNetworks(ctx context.Context, hostID string) []string {
 	return nets
 }
 
+// HostsShareNetwork - returns true if the two hosts have at least one network in common
+func HostsShareNetwork(ctx context.Context, hostID1, hostID2 string) bool {
+	if hostID1 == hostID2 {
+		return true
+	}
+	networks1 := GetHostNetworks(ctx, hostID1)
+	if len(networks1) == 0 {
+		return false
+	}
+	networks2 := GetHostNetworks(ctx, hostID2)
+	shared := make(map[string]struct{}, len(networks1))
+	for _, n := range networks1 {
+		shared[n] = struct{}{}
+	}
+	for _, n := range networks2 {
+		if _, ok := shared[n]; ok {
+			return true
+		}
+	}
+	return false
+}
+
 // CheckHostPorts checks host endpoints to ensures that hosts on the same server
 // with the same endpoint have different listen ports
 // in the case of 64535 hosts or more with same endpoint, ports will not be changed
```

**File**: `logic/jwts.go` (modified, +77/-19)
```diff
@@ -8,6 +8,7 @@ import (
 	"errors"
 	"fmt"
 	"strings"
+	"sync"
 	"time"
 
 	"github.com/golang-jwt/jwt/v4"
@@ -21,24 +22,66 @@ import (
 	"github.com/gravitl/netmaker/servercfg"
 )
 
-var jwtSecretKey []byte
+var (
+	jwtSecretKey   []byte
+	jwtSecretKeyMu sync.RWMutex
+)
+
+var ErrJWTSecretNotSet = errors.New("jwt secret not initialized")
+
+func getJWTSecretKey() []byte {
+	jwtSecretKeyMu.RLock()
+	defer jwtSecretKeyMu.RUnlock()
+	return jwtSecretKey
+}
+
+func setJWTSecretKey(key []byte) {
+	jwtSecretKeyMu.Lock()
+	defer jwtSecretKeyMu.Unlock()
+	jwtSecretKey = key
+}
+
+func jwtKeyFunc(_ *jwt.Token) (interface{}, error) {
+	key := getJWTSecretKey()
+	if len(key) == 0 {
+		return nil, ErrJWTSecretNotSet
+	}
+	return key, nil
+}
 
 // SetJWTSecret - sets the jwt secret on server startup
 func SetJWTSecret() {
 	currentSecret, jwtErr := GetJwtSecretValue()
 	if jwtErr != nil {
 		newValue := RandomString(64)
-		jwtSecretKey = []byte(newValue) // 512 bit random password
-		if err := StoreJWTSecret(string(jwtSecretKey)); err != nil {
+		key := []byte(newValue) // 512 bit random password
+		setJWTSecretKey(key)
+		if err := StoreJWTSecret(string(key)); err != nil {
 			logger.FatalLog("something went wrong when configuring JWT authentication")
 		}
 	} else {
-		jwtSecretKey = []byte(currentSecret)
+		setJWTSecretKey([]byte(currentSecret))
 	}
 }
 
+func LoadJWTSecret() error {
+	currentSecret, err := GetJwtSecretValue()
+	if err != nil {
+		return err
+	}
+	if currentSecret == "" {
+		return errors.New("jwt secret is empty")
+	}
+	setJWTSecretKey([]byte(currentSecret))
+	return nil
+}
+
 // CreateJWT func will used to create the JWT while signing in and signing out
 func CreateJWT(uuid string, macAddress string, network string) (response string, err error) {
+	key := getJWTSecretKey()
+	if len(key) == 0 {
+		return "", ErrJWTSecretNotSet
+	}
 	expirationTime := time.Now().Add(15 * time.Minute)
 	claims := &models.Claims{
 		ID:         uuid,
@@ -53,7 +96,7 @@ func CreateJWT(uuid string, macAddress string, network string) (response string,
 	}
 
 	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
-	tokenString, err := token.SignedString(jwtSecretKey)
+	tokenString, err := token.SignedString(key)
 	if err == nil {
 		return tokenString, nil
 	}
@@ -62,6 +105,10 @@ func CreateJWT(uuid string, macAddress string, network string) (response string,
 
 // CreateUserJWT - creates a user jwt token
 func CreateUserAccessJwtToken(ctx context.Context, username string, d time.Time, tokenID string) (response string, err error) {
+	key := getJWTSecretKey()
+	if len(key) == 0 {
+		return "", ErrJWTSecretNotSet
+	}
 	claims := &models.UserClaims{
 		Scope:     scope.Level(ctx),
 		ScopeID:   scope.ID(ctx),
@@ -78,7 +125,7 @@ func CreateUserAccessJwtToken(ctx context.Context, username string, d time.Time,
 	}
 
 	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
-	tokenString, err := token.SignedString(jwtSecretKey)
+	tokenString, err := token.SignedString(key)
 	if err == nil {
 		return tokenString, nil
 	}
@@ -87,6 +134,10 @@ func CreateUserAccessJwtToken(ctx context.Context, username string, d time.Time,
 
 // CreateUserJWT - creates a user jwt token
 func CreateUserJWT(ctx context.Context, username string, appName string) (response string, err error) {
+	key := getJWTSecretKey()
+	if len(key) == 0 {
+		return "", ErrJWTSecretNotSet
+	}
 	duration := time.Duration(12) * time.Hour
 	if scope.Level(ctx) == scope.TenantScope {
 		duration = GetJwtValidityDuration(ctx)
@@ -110,7 +161,7 @@ func CreateUserJWT(ctx context.Context, username string, appName string) (respon
 	}
 
 	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
-	tokenString, err := token.SignedString(jwtSecretKey)
+	tokenString, err := token.SignedString(key)
 	if err == nil {
 		return tokenString, nil
 	}
@@ -123,6 +174,10 @@ func CreateUserJWT(ctx context.Context, username string, appName string) (respon
 // that PreAuthCheck can confirm the token was issued for the scope it's
 // being redeemed in.
 func CreatePreAuthToken(ctx context.Context, username string) (string, error) {
+	key := getJWTSecretKey()
+	if len(key) == 0 {
+		return "", ErrJWTSecretNotSet
+	}
 	claims := &models.UserClaims{
 		Scope:     scope.Level(ctx),
 		ScopeID:   scope.ID(ctx),
@@ -138,22 +193,31 @@ func CreatePreAuthToken(ctx context.Context, username string) (string, error) {
 	}
 
 	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
-	return token.SignedString(jwtSecretKey)
+	return token.SignedString(key)
 }
 
 func GenerateOTPAuthURLSignature(url string) string {
-	signer := hmac.New(sha256.New, jwtSecretKey)
+	key := getJWTSecretKey()
+	if len(key) == 0 {
+		logger.Log(0, "jwt secret not initialized, refusing to sign otp auth url")
+		return ""
+	}
+	signer := hmac.New(sha256.New, key)
 	signer.Write([]byte(url))
 	return hex.EncodeToString(signer.Sum(nil))
 }
 
 func VerifyOTPAuthURL(url, signature string) bool {
+	key := getJWTSecretKey()
+
```

**File**: `logic/security.go` (modified, +1/-3)
```diff
@@ -97,9 +97,7 @@ func PreAuthCheck(next http.Handler) http.HandlerFunc {
 		if err != nil {
 			// if no, then check the user has a pre-auth token.
 			claims := &models.UserClaims{}
-			token, err := jwt.ParseWithClaims(authToken, claims, func(token *jwt.Token) (interface{}, error) {
-				return jwtSecretKey, nil
-			})
+			token, err := jwt.ParseWithClaims(authToken, claims, jwtKeyFunc)
 			if err != nil {
 				ReturnErrorResponse(w, r, FormatError(Unauthorized_Err, "unauthorized"))
 				return
```

**File**: `main.go` (modified, +17/-0)
```diff
@@ -14,6 +14,7 @@ import (
 	"runtime/debug"
 	"sync"
 	"syscall"
+	"time"
 
 	ch "github.com/gravitl/netmaker/clickhouse"
 	"github.com/gravitl/netmaker/db"
@@ -156,12 +157,28 @@ func initialize() { // Client Mode Prereq Check
 			logger.Log(0, "error setting mq keys: ", err.Error())
 		}
 
+	} else {
+		if err := logic.LoadJWTSecret(); err != nil {
+			logger.Log(0, "JWT secret not yet available from master pod, retrying in background: ", err.Error())
+			go retryLoadJWTSecret()
+		}
 	}
 
 	//initialize cache
 	initCache()
 	_ = logic.CleanExpiredSSOStates()
+}
 
+func retryLoadJWTSecret() {
+	const retryInterval = 5 * time.Second
+	for {
+		time.Sleep(retryInterval)
+		err := logic.LoadJWTSecret()
+		if err == nil {
+			logger.Log(0, "JWT secret loaded from master pod")
+			return
+		}
+	}
 }
 
 func initCache() {
```

**File**: `pro/controllers/tags.go` (modified, +1/-0)
```diff
@@ -306,6 +306,7 @@ func deleteTag(w http.ResponseWriter, r *http.Request) {
 
 	ctx := scope.WithContext(db.WithContext(context.Background()), scope.Level(r.Context()), scope.ID(r.Context()))
 	go func(ctx context.Context) {
+		proLogic.RemoveTagFromNetwork(ctx, tag.ID, tag.Network)
 		proLogic.RemoveDeviceTagFromAclPolicies(ctx, tag.ID, tag.Network)
 		proLogic.RemoveTagFromPostureChecks(tag.ID, tag.Network)
 		proLogic.RemoveTagFromNameservers(tag.ID, tag.Network)
```

**File**: `pro/logic/networks.go` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+package logic
+
+import (
+	"context"
+
+	"github.com/gravitl/netmaker/models"
+	"github.com/gravitl/netmaker/schema"
+	"gorm.io/datatypes"
+)
+
+func RemoveTagFromNetwork(ctx context.Context, tagID models.TagID, netID schema.NetworkID) error {
+	network := &schema.Network{
+		Name: string(netID),
+	}
+	err := network.Get(ctx)
+	if err != nil {
+		return err
+	}
+
+	tags := make(datatypes.JSONSlice[string], 0, len(network.AutoRemoveTags))
+
+	for _, tag := range tags {
+		if tag != tagID.String() {
+			tags = append(tags, tag)
+		}
+	}
+
+	network.AutoRemoveTags = tags
+	return network.UpdateAutoRemoveTags(ctx)
+}
```

---

### Incident Patch 4: `c6e3ea19` (2026-09-13)
**Commit Message**: fix(go): remove tag from network auto remove tags on delete;

**File**: `pro/controllers/tags.go` (modified, +1/-0)
```diff
@@ -306,6 +306,7 @@ func deleteTag(w http.ResponseWriter, r *http.Request) {
 
 	ctx := scope.WithContext(db.WithContext(context.Background()), scope.Level(r.Context()), scope.ID(r.Context()))
 	go func(ctx context.Context) {
+		proLogic.RemoveTagFromNetwork(ctx, tag.ID, tag.Network)
 		proLogic.RemoveDeviceTagFromAclPolicies(ctx, tag.ID, tag.Network)
 		proLogic.RemoveTagFromPostureChecks(tag.ID, tag.Network)
 		proLogic.RemoveTagFromNameservers(tag.ID, tag.Network)
```

**File**: `pro/logic/networks.go` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+package logic
+
+import (
+	"context"
+
+	"github.com/gravitl/netmaker/models"
+	"github.com/gravitl/netmaker/schema"
+	"gorm.io/datatypes"
+)
+
+func RemoveTagFromNetwork(ctx context.Context, tagID models.TagID, netID schema.NetworkID) error {
+	network := &schema.Network{
+		Name: string(netID),
+	}
+	err := network.Get(ctx)
+	if err != nil {
+		return err
+	}
+
+	tags := make(datatypes.JSONSlice[string], 0, len(network.AutoRemoveTags))
+
+	for _, tag := range tags {
+		if tag != tagID.String() {
+			tags = append(tags, tag)
+		}
+	}
+
+	network.AutoRemoveTags = tags
+	return network.UpdateAutoRemoveTags(ctx)
+}
```

**File**: `schema/networks.go` (modified, +13/-1)
```diff
@@ -167,8 +167,20 @@ func (n *Network) UpdateNodesUpdatedAt(ctx context.Context) error {
 	}
 
 	return query.
-		Updates(map[string]interface{}{
+		Updates(map[string]any{
 			"nodes_updated_at": n.NodesUpdatedAt,
 		}).
 		Error
 }
+
+func (n *Network) UpdateAutoRemoveTags(ctx context.Context) error {
+	query, err := n.baseIdentifierQuery(ctx)
+	if err != nil {
+		return err
+	}
+
+	return query.
+		Updates(map[string]any{
+			"auto_remove_tags": n.AutoRemoveTags,
+		}).Error
+}
```

---

### Incident Patch 5: `aa458197` (2026-09-11)
**Commit Message**: fix(go): guard jwt secret key with mutex;

**File**: `logic/jwts.go` (modified, +43/-19)
```diff
@@ -8,6 +8,7 @@ import (
 	"errors"
 	"fmt"
 	"strings"
+	"sync"
 	"time"
 
 	"github.com/golang-jwt/jwt/v4"
@@ -21,28 +22,45 @@ import (
 	"github.com/gravitl/netmaker/servercfg"
 )
 
-var jwtSecretKey []byte
+var (
+	jwtSecretKey   []byte
+	jwtSecretKeyMu sync.RWMutex
+)
 
 var ErrJWTSecretNotSet = errors.New("jwt secret not initialized")
 
+func getJWTSecretKey() []byte {
+	jwtSecretKeyMu.RLock()
+	defer jwtSecretKeyMu.RUnlock()
+	return jwtSecretKey
+}
+
+func setJWTSecretKey(key []byte) {
+	jwtSecretKeyMu.Lock()
+	defer jwtSecretKeyMu.Unlock()
+	jwtSecretKey = key
+}
+
 func jwtKeyFunc(_ *jwt.Token) (interface{}, error) {
-	if len(jwtSecretKey) == 0 {
+	key := getJWTSecretKey()
+	if len(key) == 0 {
 		return nil, ErrJWTSecretNotSet
 	}
-	return jwtSecretKey, nil
+	return key, nil
 }
 
 // SetJWTSecret - sets the jwt secret on server startup
 func SetJWTSecret() {
 	currentSecret, jwtErr := GetJwtSecretValue()
 	if jwtErr != nil {
 		newValue := RandomString(64)
-		jwtSecretKey = []byte(newValue) // 512 bit random password
-		if err := StoreJWTSecret(string(jwtSecretKey)); err != nil {
+		key := []byte(newValue) // 512 bit random password
+		setJWTSecretKey(key)
+		if err := StoreJWTSecret(string(key)); err != nil {
 			logger.FatalLog("something went wrong when configuring JWT authentication")
 		}
 	} else {
-		jwtSecretKey = []byte(currentSecret)
+		setJWTSecretKey([]byte(currentSecret))
 	}
 }
 
@@ -54,13 +72,14 @@ func LoadJWTSecret() error {
 	if currentSecret == "" {
 		return errors.New("jwt secret is empty")
 	}
-	jwtSecretKey = []byte(currentSecret)
+	setJWTSecretKey([]byte(currentSecret))
 	return nil
 }
 
 // CreateJWT func will used to create the JWT while signing in and signing out
 func CreateJWT(uuid string, macAddress string, network string) (response string, err error) {
-	if len(jwtSecretKey) == 0 {
+	key := getJWTSecretKey()
+	if len(key) == 0 {
 		return "", ErrJWTSecretNotSet
 	}
 	expirationTime := time.Now().Add(15 * time.Minute)
@@ -77,7 +96,7 @@ func CreateJWT(uuid string, macAddress string, network string) (response string,
 	}
 
 	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
-	tokenString, err := token.SignedString(jwtSecretKey)
+	tokenString, err := token.SignedString(key)
 	if err == nil {
 		return tokenString, nil
 	}
@@ -86,7 +105,8 @@ func CreateJWT(uuid string, macAddress string, network string) (response string,
 
 // CreateUserJWT - creates a user jwt token
 func CreateUserAccessJwtToken(ctx context.Context, username string, d time.Time, tokenID string) (response string, err error) {
-	if len(jwtSecretKey) == 0 {
+	key := getJWTSecretKey()
+	if len(key) == 0 {
 		return "", ErrJWTSecretNotSet
 	}
 	claims := &models.UserClaims{
@@ -105,7 +125,7 @@ func CreateUserAccessJwtToken(ctx context.Context, username string, d time.Time,
 	}
 
 	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
-	tokenString, err := token.SignedString(jwtSecretKey)
+	tokenString, err := token.SignedString(key)
 	if err == nil {
 		return tokenString, nil
 	}
@@ -114,7 +134,8 @@ func CreateUserAccessJwtToken(ctx context.Context, username string, d time.Time,
 
 // CreateUserJWT - creates a user jwt token
 func CreateUserJWT(ctx context.Context, username string, appName string) (response string, err error) {
-	if len(jwtSecretKey) == 0 {
+	key := getJWTSecretKey()
+	if len(key) == 0 {
 		return "", ErrJWTSecretNotSet
 	}
 	duration := time.Duration(12) * time.Hour
@@ -140,7 +161,7 @@ func CreateUserJWT(ctx context.Context, username string, appName string) (respon
 	}
 
 	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
-	tokenString, err := token.SignedString(jwtSecretKey)
+	tokenString, err := token.SignedString(key)
 	if err == nil {
 		return tokenString, nil
 	}
@@ -153,7 +174,8 @@ func CreateUserJWT(ctx context.Context, username string, appName string) (respon
 // that PreAuthCheck can confirm the token was issued for the scope it's
 // being redeemed in.
 func CreatePreAuthToken(ctx context.Context, username string) (string, error) {
-	if len(jwtSecretKey) == 0 {
+	key := getJWTSecretKey()
+	if len(key) == 0 {
 		return "", ErrJWTSecretNotSet
 	}
 	claims := &models.UserClaims{
@@ -171,29 +193,31 @@ func CreatePreAuthToken(ctx context.Context, username string) (string, error) {
 	}
 
 	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
-	return token.SignedString(jwtSecretKey)
+	return token.SignedString(key)
 }
 
 func GenerateOTPAuthURLSignature(url string) string {
-	if len(jwtSecretKey) == 0 {
+	key := getJWTSecretKey()
+	if len(key) == 0 {
 		logger.Log(0, "jwt secret not initialized, refusing to sign otp auth url")
 		return ""
 	}
-	signer := hmac.New(sha256.New, jwtSecretKey)
+	signer := hmac.New(sha256.New, key)
 	signer.Write([]byte(url))
 	return hex.EncodeToString(signer.Sum(nil))
 }
 
 func VerifyOTPAuthURL(url, signature string) bool {
-	if len(jwtSecretKey) == 0 {
+	key := getJWTSecretKey()
+	if len(key) == 0 {
 		return false
 	}
 	si
```

---

### Incident Patch 6: `bb37877f` (2026-09-11)
**Commit Message**: fix(go): join when search query provided;

**File**: `controllers/node.go` (modified, +4/-2)
```diff
@@ -255,10 +255,12 @@ func listNetworkNodes(w http.ResponseWriter, r *http.Request) {
 
 	var filters, options []dbtypes.Option
 	filters = append(filters, dbtypes.WithFilter("network_id", network.ID))
-	if len(osFilters) > 0 {
+	if len(osFilters) > 0 || q != "" {
 		filters = append(filters, func(db *gorm.DB) *gorm.DB {
 			return db.Joins("JOIN hosts_v1 ON hosts_v1.id = nodes_v1.host_id")
 		})
+	}
+	if len(osFilters) > 0 {
 		filters = append(filters, dbtypes.WithFilter("hosts_v1.os", osFilters...))
 	}
 	filters = append(filters, dbtypes.WithFilter("status", statusFilters...))
@@ -288,7 +290,7 @@ func listNetworkNodes(w http.ResponseWriter, r *http.Request) {
 	filters = append(filters, dbtypes.WithSearchQuery(
 		q,
 		fmt.Sprintf("%s.id", (&schema.Node{}).TableName()),
-		"name",
+		"hosts_v1.name",
 		"address",
 		"address6",
 		expr.ByteaField("endpoint_ip"),
```

---

### Incident Patch 7: `ba2d7b46` (2026-09-10)
**Commit Message**: fix(go): attempt reload jwt secret in worker pods if not set; prevent jwt signing if jwt secret not set;

**File**: `logic/jwts.go` (modified, +43/-9)
```diff
@@ -23,6 +23,15 @@ import (
 
 var jwtSecretKey []byte
 
+var ErrJWTSecretNotSet = errors.New("jwt secret not initialized")
+
+func jwtKeyFunc(_ *jwt.Token) (interface{}, error) {
+	if len(jwtSecretKey) == 0 {
+		return nil, ErrJWTSecretNotSet
+	}
+	return jwtSecretKey, nil
+}
+
 // SetJWTSecret - sets the jwt secret on server startup
 func SetJWTSecret() {
 	currentSecret, jwtErr := GetJwtSecretValue()
@@ -37,8 +46,23 @@ func SetJWTSecret() {
 	}
 }
 
+func LoadJWTSecret() error {
+	currentSecret, err := GetJwtSecretValue()
+	if err != nil {
+		return err
+	}
+	if currentSecret == "" {
+		return errors.New("jwt secret is empty")
+	}
+	jwtSecretKey = []byte(currentSecret)
+	return nil
+}
+
 // CreateJWT func will used to create the JWT while signing in and signing out
 func CreateJWT(uuid string, macAddress string, network string) (response string, err error) {
+	if len(jwtSecretKey) == 0 {
+		return "", ErrJWTSecretNotSet
+	}
 	expirationTime := time.Now().Add(15 * time.Minute)
 	claims := &models.Claims{
 		ID:         uuid,
@@ -62,6 +86,9 @@ func CreateJWT(uuid string, macAddress string, network string) (response string,
 
 // CreateUserJWT - creates a user jwt token
 func CreateUserAccessJwtToken(ctx context.Context, username string, d time.Time, tokenID string) (response string, err error) {
+	if len(jwtSecretKey) == 0 {
+		return "", ErrJWTSecretNotSet
+	}
 	claims := &models.UserClaims{
 		Scope:     scope.Level(ctx),
 		ScopeID:   scope.ID(ctx),
@@ -87,6 +114,9 @@ func CreateUserAccessJwtToken(ctx context.Context, username string, d time.Time,
 
 // CreateUserJWT - creates a user jwt token
 func CreateUserJWT(ctx context.Context, username string, appName string) (response string, err error) {
+	if len(jwtSecretKey) == 0 {
+		return "", ErrJWTSecretNotSet
+	}
 	duration := time.Duration(12) * time.Hour
 	if scope.Level(ctx) == scope.TenantScope {
 		duration = GetJwtValidityDuration(ctx)
@@ -123,6 +153,9 @@ func CreateUserJWT(ctx context.Context, username string, appName string) (respon
 // that PreAuthCheck can confirm the token was issued for the scope it's
 // being redeemed in.
 func CreatePreAuthToken(ctx context.Context, username string) (string, error) {
+	if len(jwtSecretKey) == 0 {
+		return "", ErrJWTSecretNotSet
+	}
 	claims := &models.UserClaims{
 		Scope:     scope.Level(ctx),
 		ScopeID:   scope.ID(ctx),
@@ -142,12 +175,19 @@ func CreatePreAuthToken(ctx context.Context, username string) (string, error) {
 }
 
 func GenerateOTPAuthURLSignature(url string) string {
+	if len(jwtSecretKey) == 0 {
+		logger.Log(0, "jwt secret not initialized, refusing to sign otp auth url")
+		return ""
+	}
 	signer := hmac.New(sha256.New, jwtSecretKey)
 	signer.Write([]byte(url))
 	return hex.EncodeToString(signer.Sum(nil))
 }
 
 func VerifyOTPAuthURL(url, signature string) bool {
+	if len(jwtSecretKey) == 0 {
+		return false
+	}
 	signatureBytes, err := hex.DecodeString(signature)
 	if err != nil {
 		return false
@@ -173,9 +213,7 @@ func GetUserNameFromToken(ctx context.Context, authtoken string) (username strin
 		return MasterUser, nil
 	}
 
-	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
-		return jwtSecretKey, nil
-	})
+	token, err := jwt.ParseWithClaims(tokenString, claims, jwtKeyFunc)
 	if err != nil {
 		logger.Log(4, "unauthorized: jwt parse/signature failed:", err.Error())
 		return "", Unauthorized_Err
@@ -238,9 +276,7 @@ func VerifyUserToken(ctx context.Context, tokenString string) (username string,
 		return MasterUser, true, true, nil
 	}
 
-	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
-		return jwtSecretKey, nil
-	})
+	token, err := jwt.ParseWithClaims(tokenString, claims, jwtKeyFunc)
 	if err != nil {
 		return "", false, false, err
 	}
@@ -375,9 +411,7 @@ func VerifyHostToken(ctx context.Context, tokenString string) (hostID string, ma
 		return MasterUser, "", "", nil
 	}
 
-	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
-		return jwtSecretKey, nil
-	})
+	token, err := jwt.ParseWithClaims(tokenString, claims, jwtKeyFunc)
 
 	if token != nil && token.Valid {
 		if !strings.HasPrefix(claims.Subject, "node|") {
```

**File**: `logic/security.go` (modified, +1/-3)
```diff
@@ -97,9 +97,7 @@ func PreAuthCheck(next http.Handler) http.HandlerFunc {
 		if err != nil {
 			// if no, then check the user has a pre-auth token.
 			claims := &models.UserClaims{}
-			token, err := jwt.ParseWithClaims(authToken, claims, func(token *jwt.Token) (interface{}, error) {
-				return jwtSecretKey, nil
-			})
+			token, err := jwt.ParseWithClaims(authToken, claims, jwtKeyFunc)
 			if err != nil {
 				ReturnErrorResponse(w, r, FormatError(Unauthorized_Err, "unauthorized"))
 				return
```

**File**: `main.go` (modified, +17/-0)
```diff
@@ -14,6 +14,7 @@ import (
 	"runtime/debug"
 	"sync"
 	"syscall"
+	"time"
 
 	ch "github.com/gravitl/netmaker/clickhouse"
 	"github.com/gravitl/netmaker/db"
@@ -156,12 +157,28 @@ func initialize() { // Client Mode Prereq Check
 			logger.Log(0, "error setting mq keys: ", err.Error())
 		}
 
+	} else {
+		if err := logic.LoadJWTSecret(); err != nil {
+			logger.Log(0, "JWT secret not yet available from master pod, retrying in background: ", err.Error())
+			go retryLoadJWTSecret()
+		}
 	}
 
 	//initialize cache
 	initCache()
 	_ = logic.CleanExpiredSSOStates()
+}
 
+func retryLoadJWTSecret() {
+	const retryInterval = 5 * time.Second
+	for {
+		time.Sleep(retryInterval)
+		err := logic.LoadJWTSecret()
+		if err == nil {
+			logger.Log(0, "JWT secret loaded from master pod")
+			return
+		}
+	}
 }
 
 func initCache() {
```

---

### Incident Patch 8: `e58d8d6c` (2026-09-10)
**Commit Message**: fix(go): populate sender identity from auth token; check if hosts share network;

**File**: `controllers/hosts.go` (modified, +18/-4)
```diff
@@ -1335,9 +1335,10 @@ func signalPeer(w http.ResponseWriter, r *http.Request) {
 		return
 	}
 	// confirm host exists
-	err = (&schema.Host{
+	senderHost := &schema.Host{
 		ID: hostID,
-	}).Get(r.Context())
+	}
+	err = senderHost.Get(r.Context())
 	if err != nil {
 		logger.Log(0, r.Header.Get("user"), "failed to get host:", err.Error())
 		logic.ReturnErrorResponse(w, r, logic.FormatError(err, "badrequest"))
@@ -1358,14 +1359,18 @@ func signalPeer(w http.ResponseWriter, r *http.Request) {
 		return
 	}
 	signal.IsPro = servercfg.IsPro
-	hostID, err = uuid.Parse(signal.ToHostID)
+	// bind the sender identity to the authenticated host rather than trusting the request body
+	signal.FromHostID = senderHost.ID.String()
+	signal.FromHostPubKey = senderHost.PublicKey.String()
+
+	toHostID, err := uuid.Parse(signal.ToHostID)
 	if err != nil {
 		err = fmt.Errorf("failed to parse host id: %w", err)
 		logic.ReturnErrorResponse(w, r, logic.FormatError(err, logic.BadReq))
 		return
 	}
 	peerHost := &schema.Host{
-		ID: hostID,
+		ID: toHostID,
 	}
 	err = peerHost.Get(r.Context())
 	if err != nil {
@@ -1376,6 +1381,15 @@ func signalPeer(w http.ResponseWriter, r *http.Request) {
 		)
 		return
 	}
+	// the target host must share a network with the authenticated sender
+	if !logic.HostsShareNetwork(r.Context(), senderHost.ID.String(), peerHost.ID.String()) {
+		logic.ReturnErrorResponse(
+			w,
+			r,
+			logic.FormatError(errors.New("failed to signal, peer not found"), "badrequest"),
+		)
+		return
+	}
 	err = mq.HostUpdate(&models.HostUpdate{
 		Action: models.SignalHost,
 		Host:   *peerHost,
```

**File**: `logic/hosts.go` (modified, +22/-0)
```diff
@@ -595,6 +595,28 @@ func GetHostNetworks(ctx context.Context, hostID string) []string {
 	return nets
 }
 
+// HostsShareNetwork - returns true if the two hosts have at least one network in common
+func HostsShareNetwork(ctx context.Context, hostID1, hostID2 string) bool {
+	if hostID1 == hostID2 {
+		return true
+	}
+	networks1 := GetHostNetworks(ctx, hostID1)
+	if len(networks1) == 0 {
+		return false
+	}
+	networks2 := GetHostNetworks(ctx, hostID2)
+	shared := make(map[string]struct{}, len(networks1))
+	for _, n := range networks1 {
+		shared[n] = struct{}{}
+	}
+	for _, n := range networks2 {
+		if _, ok := shared[n]; ok {
+			return true
+		}
+	}
+	return false
+}
+
 // CheckHostPorts checks host endpoints to ensures that hosts on the same server
 // with the same endpoint have different listen ports
 // in the case of 64535 hosts or more with same endpoint, ports will not be changed
```

---

### Incident Patch 9: `8d5a10cb` (2026-09-09)
**Commit Message**: Merge pull request #4146 from gravitl/v1.7.0-exitnode-acl-fix

v1.7.0: fix: do not auto-assign exit node from ACL access

**File**: `logic/acls_selected_ips_test.go` (modified, +111/-4)
```diff
@@ -126,7 +126,7 @@ func TestAppendEgressPolicyRangeExpandsInternet(t *testing.T) {
 	}
 }
 
-func TestApplyInternetExitFromDeviceACL(t *testing.T) {
+func TestAddEgressInfoToPeerByAccess_DoesNotAutoFullTunnelFromInternetACL(t *testing.T) {
 	originalGetEgressByID := getEgressByID
 	t.Cleanup(func() { getEgressByID = originalGetEgressByID })
 
@@ -138,6 +138,13 @@ func TestApplyInternetExitFromDeviceACL(t *testing.T) {
 			Network: "netmaker",
 		},
 	}
+	exitNode := models.Node{
+		CommonNode: models.CommonNode{
+			ID:      exitID,
+			Network: "netmaker",
+			IsGw:    true,
+		},
+	}
 	eli := []schema.Egress{{
 		ID:      "inet-eg",
 		Network: "netmaker",
@@ -146,21 +153,121 @@ func TestApplyInternetExitFromDeviceACL(t *testing.T) {
 		Range:   "*",
 		Nodes:   datatypes.JSONMap{exitID.String(): json.Number("100")},
 	}}
+	getEgressByID = func(id string) (schema.Egress, error) {
+		if id == "inet-eg" {
+			return eli[0], nil
+		}
+		return schema.Egress{}, errors.New("not found")
+	}
 	acls := []models.Acl{{
 		Enabled: true,
 		Src:     []models.AclPolicyTag{{ID: models.NodeID, Value: clientID.String()}},
 		Dst:     []models.AclPolicyTag{{ID: models.EgressID, Value: "inet-eg"}},
 	}}
+
+	// ACL grants access to the internet egress, but the client did not select it.
+	AddEgressInfoToPeerByAccess(&client, &exitNode, eli, acls, false)
+	for _, r := range exitNode.EgressDetails.EgressGatewayRanges {
+		if r == IPv4Network || r == IPv6Network {
+			t.Fatalf("ACL access alone must not attach default route %s; got %v", r, exitNode.EgressDetails.EgressGatewayRanges)
+		}
+	}
+	if InternetExitRoutingNodeID(&client) != "" {
+		t.Fatalf("client must not be treated as exit client without selection, got %q", InternetExitRoutingNodeID(&client))
+	}
+
+	// Explicit assignment (legacy InternetGwID) still attaches full-tunnel ranges.
+	client.InternetGwID = exitID.String()
+	exitNode.EgressDetails = models.EgressDetails{}
+	AddEgressInfoToPeerByAccess(&client, &exitNode, eli, acls, false)
+	hasV4 := false
+	for _, r := range exitNode.EgressDetails.EgressGatewayRanges {
+		if r == IPv4Network {
+			hasV4 = true
+		}
+	}
+	if !hasV4 {
+		t.Fatalf("explicit exit assignment should attach 0.0.0.0/0, got %v", exitNode.EgressDetails.EgressGatewayRanges)
+	}
+}
+
+func TestSuppressInternetExitIfNoACLAccess(t *testing.T) {
+	originalGetEgressByID := getEgressByID
+	t.Cleanup(func() { getEgressByID = originalGetEgressByID })
+
+	clientID := uuid.New()
+	exitID := uuid.New()
+	eli := []schema.Egress{{
+		ID:      "inet-eg",
+		Network: "netmaker",
+		Status:  true,
+		Type:    schema.EgressTypeInternet,
+		Range:   "*",
+		Nodes:   datatypes.JSONMap{exitID.String(): json.Number("100")},
+	}}
 	getEgressByID = func(id string) (schema.Egress, error) {
 		if id == "inet-eg" {
 			return eli[0], nil
 		}
 		return schema.Egress{}, errors.New("not found")
 	}
 
-	applyInternetExitFromDeviceACL(&client, eli, acls)
-	if client.InternetGwID != exitID.String() {
-		t.Fatalf("expected InternetGwID %s from internet ACL, got %q", exitID, client.InternetGwID)
+	allowACL := []models.Acl{{
+		Enabled: true,
+		Src:     []models.AclPolicyTag{{ID: models.NodeID, Value: clientID.String()}},
+		Dst:     []models.AclPolicyTag{{ID: models.EgressID, Value: "inet-eg"}},
+	}}
+	denyACLs := []models.Acl{{
+		Enabled: true,
+		Src:     []models.AclPolicyTag{{ID: models.NodeID, Value: clientID.String()}},
+		Dst:     []models.AclPolicyTag{{ID: models.NodeTagID, Value: exitID.String()}}, // gateway node only, not egress
+	}}
+
+	// Assigned exit + ACL grants egress access → keep exit.
+	client := models.Node{
+		CommonNode: models.CommonNode{
+			ID:      clientID,
+			Network: "netmaker",
+		},
+		SelectedInternetEgressID: "inet-eg",
+		InternetGwID:             exitID.String(),
+	}
+	SuppressInternetExitIfNoACLAccess(&client, eli, allowACL, false)
+	if client.SelectedInternetEgressID != "inet-eg" || client.InternetGwID != exitID.String() {
+		t.Fatalf("expected exit kept when ACL allows egress, got selection=%q gw=%q",
+			client.SelectedInternetEgressID, client.InternetGwID)
+	}
+
+	// Assigned exit but policy does not include exit egress → suppress for this update.
+	client.SelectedInternetEgressID = "inet-eg"
+	client.InternetGwID = exitID.String()
+	SuppressInternetExitIfNoACLAccess(&client, eli, denyACLs, false)
+	if client.SelectedInternetEgressID != "" || client.InternetGwID != "" {
+		t.Fatalf("expected exit suppressed without egress ACL, got selection=%q gw=%q",
+			client.SelectedInternetEgressID, client.InternetGwID)
+	}
+
+	// Default device policy on → do not suppress even without egress ACL.
+	client.SelectedInternetEgressID = "inet-eg"
+	client.InternetGwID = exitID.String()
+	SuppressInternetExitIfNoACLAccess(&client, eli, denyACLs, true)
+	if client.SelectedInternetEgressID != "inet-eg" || client.InternetGwID != exitID.String() {
+		t.Fatalf("expected exit kept when default policy enabled, got selection=%q gw=%q",
+			client.SelectedInte
```

**File**: `logic/egress.go` (modified, +51/-26)
```diff
@@ -399,35 +399,60 @@ func ResolveInternetExitRoutingNode(node *models.Node) {
 	}
 }
 
-// applyInternetExitFromDeviceACL sets InternetGwID in-memory when a device ACL
-// grants this node access to a single internet egress and no exit is selected.
-// That attaches the exit node peer (0.0.0.0/0, default gw) the same way explicit
-// exit selection does. Multiple internet exits still require an explicit choice.
-func applyInternetExitFromDeviceACL(node *models.Node, eli []schema.Egress, acls []models.Acl) {
-	if node == nil || node.SelectedInternetEgressID != "" || node.InternetGwID != "" {
-		return
+// assignedInternetEgress returns the active internet egress this node is configured to use
+// (SelectedInternetEgressID, or legacy InternetGwID matched against eli routing nodes).
+func assignedInternetEgress(node *models.Node, eli []schema.Egress) *schema.Egress {
+	if node == nil {
+		return nil
 	}
-	routingID := ""
-	for i := range eli {
-		e := eli[i]
-		if !e.Status || e.Network != node.Network || !IsEgressInternetGateway(e) {
-			continue
-		}
-		if !DoesNodeHaveAccessToEgress(node, &e, acls) {
-			continue
+	if node.SelectedInternetEgressID != "" {
+		for i := range eli {
+			e := &eli[i]
+			if e.ID == node.SelectedInternetEgressID && e.Status && e.Network == node.Network && IsEgressInternetGateway(*e) {
+				return e
+			}
 		}
-		id := FirstInternetEgressRoutingNodeID(e)
-		if id == "" || id == node.ID.String() {
+		return nil
+	}
+	if node.InternetGwID == "" {
+		return nil
+	}
+	for i := range eli {
+		e := &eli[i]
+		if !e.Status || e.Network != node.Network || !IsEgressInternetGateway(*e) {
 			continue
 		}
-		if routingID != "" && routingID != id {
-			return
+		if _, ok := e.Nodes[node.InternetGwID]; ok {
+			return e
 		}
-		routingID = id
 	}
-	if routingID != "" {
-		node.InternetGwID = routingID
+	return nil
+}
+
+// SuppressInternetExitIfNoACLAccess clears the in-memory exit assignment for this peer
+// update when the node is not allowed to use its assigned internet egress. Sticky DB
+// selection is preserved; full-tunnel and default-gw changes are not applied.
+//
+// Exit is applied when the node is assigned an exit and any of:
+//   - the default device (all-resources) policy is enabled
+//   - an enabled policy that includes this node has dst all-resources ("*")
+//   - an enabled policy that includes this node has the exit egress in dst
+func SuppressInternetExitIfNoACLAccess(node *models.Node, eli []schema.Egress, acls []models.Acl, defaultDevicePolicyEnabled bool) {
+	if node == nil || defaultDevicePolicyEnabled {
+		return
+	}
+	if node.SelectedInternetEgressID == "" && node.InternetGwID == "" {
+		return
+	}
+	e := assignedInternetEgress(node, eli)
+	if e == nil {
+		return
+	}
+	if DoesNodeHaveAccessToEgress(node, e, acls) {
+		return
 	}
+	node.SelectedInternetEgressID = ""
+	node.InternetGwID = ""
 }
 
 // FirstInternetEgressRoutingNodeID returns a routing node ID from an internet egress.
@@ -1116,10 +1141,10 @@ func AddEgressInfoToPeerByAccess(node, targetNode *models.Node, eli []schema.Egr
 		if !e.Status || e.Network != targetNode.Network {
 			continue
 		}
-		if IsEgressInternetGateway(e) && !usesPeerAsInternetExit(node, targetNode) && isDefaultPolicyActive {
-			// Default-allow must not auto-full-tunnel every peer. Explicit exit
-			// selection or a specific ACL (handled below when default is off)
-			// is required to attach 0.0.0.0/0.
+		if IsEgressInternetGateway(e) && !usesPeerAsInternetExit(node, targetNode) {
+			// Never auto-full-tunnel from ACL/gateway access alone. Full-tunnel
+			// (0.0.0.0/0, ::/0) requires explicit exit selection
+			// (SelectedInternetEgressID) or a legacy InternetGwID assignment.
 			continue
 		}
 		if !isDefaultPolicyActive {
```

**File**: `logic/peers.go` (modified, +1/-3)
```diff
@@ -326,9 +326,7 @@ func GetPeerUpdateForHost(ctx context.Context, network string, host *schema.Host
 		defaultDevicePolicy, _ := GetDefaultPolicy(ctx, schema.NetworkID(node.Network), models.DevicePolicy)
 		GetNodeEgressInfo(&node, eli, acls)
 		ResolveInternetExitRoutingNode(&node)
-		if !defaultDevicePolicy.Enabled {
-			applyInternetExitFromDeviceACL(&node, eli, acls)
-		}
+		SuppressInternetExitIfNoACLAccess(&node, eli, acls, defaultDevicePolicy.Enabled)
 		egsWithDomain := ListAllByRoutingNodeWithDomain(eli, node.ID.String())
 		if len(egsWithDomain) > 0 {
 			hostPeerUpdate.EgressWithDomains = append(hostPeerUpdate.EgressWithDomains, egsWithDomain...)
```

---

### Incident Patch 10: `a42e7632` (2026-09-09)
**Commit Message**: v1.7.0: fix: require ACL access for assigned exit nodes

Only apply full-tunnel when a node is assigned an exit and policy allows
it (default all-resources, dst '*', or the exit egress in dst).

**File**: `logic/acls_selected_ips_test.go` (modified, +80/-0)
```diff
@@ -191,6 +191,86 @@ func TestAddEgressInfoToPeerByAccess_DoesNotAutoFullTunnelFromInternetACL(t *tes
 	}
 }
 
+func TestSuppressInternetExitIfNoACLAccess(t *testing.T) {
+	originalGetEgressByID := getEgressByID
+	t.Cleanup(func() { getEgressByID = originalGetEgressByID })
+
+	clientID := uuid.New()
+	exitID := uuid.New()
+	eli := []schema.Egress{{
+		ID:      "inet-eg",
+		Network: "netmaker",
+		Status:  true,
+		Type:    schema.EgressTypeInternet,
+		Range:   "*",
+		Nodes:   datatypes.JSONMap{exitID.String(): json.Number("100")},
+	}}
+	getEgressByID = func(id string) (schema.Egress, error) {
+		if id == "inet-eg" {
+			return eli[0], nil
+		}
+		return schema.Egress{}, errors.New("not found")
+	}
+
+	allowACL := []models.Acl{{
+		Enabled: true,
+		Src:     []models.AclPolicyTag{{ID: models.NodeID, Value: clientID.String()}},
+		Dst:     []models.AclPolicyTag{{ID: models.EgressID, Value: "inet-eg"}},
+	}}
+	denyACLs := []models.Acl{{
+		Enabled: true,
+		Src:     []models.AclPolicyTag{{ID: models.NodeID, Value: clientID.String()}},
+		Dst:     []models.AclPolicyTag{{ID: models.NodeTagID, Value: exitID.String()}}, // gateway node only, not egress
+	}}
+
+	// Assigned exit + ACL grants egress access → keep exit.
+	client := models.Node{
+		CommonNode: models.CommonNode{
+			ID:      clientID,
+			Network: "netmaker",
+		},
+		SelectedInternetEgressID: "inet-eg",
+		InternetGwID:             exitID.String(),
+	}
+	SuppressInternetExitIfNoACLAccess(&client, eli, allowACL, false)
+	if client.SelectedInternetEgressID != "inet-eg" || client.InternetGwID != exitID.String() {
+		t.Fatalf("expected exit kept when ACL allows egress, got selection=%q gw=%q",
+			client.SelectedInternetEgressID, client.InternetGwID)
+	}
+
+	// Assigned exit but policy does not include exit egress → suppress for this update.
+	client.SelectedInternetEgressID = "inet-eg"
+	client.InternetGwID = exitID.String()
+	SuppressInternetExitIfNoACLAccess(&client, eli, denyACLs, false)
+	if client.SelectedInternetEgressID != "" || client.InternetGwID != "" {
+		t.Fatalf("expected exit suppressed without egress ACL, got selection=%q gw=%q",
+			client.SelectedInternetEgressID, client.InternetGwID)
+	}
+
+	// Default device policy on → do not suppress even without egress ACL.
+	client.SelectedInternetEgressID = "inet-eg"
+	client.InternetGwID = exitID.String()
+	SuppressInternetExitIfNoACLAccess(&client, eli, denyACLs, true)
+	if client.SelectedInternetEgressID != "inet-eg" || client.InternetGwID != exitID.String() {
+		t.Fatalf("expected exit kept when default policy enabled, got selection=%q gw=%q",
+			client.SelectedInternetEgressID, client.InternetGwID)
+	}
+
+	// Policy includes node with dst all-resources ("*") → keep assigned exit.
+	allResourcesACL := []models.Acl{{
+		Enabled: true,
+		Src:     []models.AclPolicyTag{{ID: models.NodeID, Value: clientID.String()}},
+		Dst:     []models.AclPolicyTag{{ID: models.NodeTagID, Value: "*"}},
+	}}
+	client.SelectedInternetEgressID = "inet-eg"
+	client.InternetGwID = exitID.String()
+	SuppressInternetExitIfNoACLAccess(&client, eli, allResourcesACL, false)
+	if client.SelectedInternetEgressID != "inet-eg" || client.InternetGwID != exitID.String() {
+		t.Fatalf("expected exit kept when policy dst is all-resources, got selection=%q gw=%q",
+			client.SelectedInternetEgressID, client.InternetGwID)
+	}
+}
+
 func TestGetEgressToEgressPoliciesForNode(t *testing.T) {
 	originalGetEgressByID := getEgressByID
 	originalGetEgressByNetwork := getEgressByNetwork
```

**File**: `logic/egress.go` (modified, +56/-0)
```diff
@@ -399,6 +399,62 @@ func ResolveInternetExitRoutingNode(node *models.Node) {
 	}
 }
 
+// assignedInternetEgress returns the active internet egress this node is configured to use
+// (SelectedInternetEgressID, or legacy InternetGwID matched against eli routing nodes).
+func assignedInternetEgress(node *models.Node, eli []schema.Egress) *schema.Egress {
+	if node == nil {
+		return nil
+	}
+	if node.SelectedInternetEgressID != "" {
+		for i := range eli {
+			e := &eli[i]
+			if e.ID == node.SelectedInternetEgressID && e.Status && e.Network == node.Network && IsEgressInternetGateway(*e) {
+				return e
+			}
+		}
+		return nil
+	}
+	if node.InternetGwID == "" {
+		return nil
+	}
+	for i := range eli {
+		e := &eli[i]
+		if !e.Status || e.Network != node.Network || !IsEgressInternetGateway(*e) {
+			continue
+		}
+		if _, ok := e.Nodes[node.InternetGwID]; ok {
+			return e
+		}
+	}
+	return nil
+}
+
+// SuppressInternetExitIfNoACLAccess clears the in-memory exit assignment for this peer
+// update when the node is not allowed to use its assigned internet egress. Sticky DB
+// selection is preserved; full-tunnel and default-gw changes are not applied.
+//
+// Exit is applied when the node is assigned an exit and any of:
+//   - the default device (all-resources) policy is enabled
+//   - an enabled policy that includes this node has dst all-resources ("*")
+//   - an enabled policy that includes this node has the exit egress in dst
+func SuppressInternetExitIfNoACLAccess(node *models.Node, eli []schema.Egress, acls []models.Acl, defaultDevicePolicyEnabled bool) {
+	if node == nil || defaultDevicePolicyEnabled {
+		return
+	}
+	if node.SelectedInternetEgressID == "" && node.InternetGwID == "" {
+		return
+	}
+	e := assignedInternetEgress(node, eli)
+	if e == nil {
+		return
+	}
+	if DoesNodeHaveAccessToEgress(node, e, acls) {
+		return
+	}
+	node.SelectedInternetEgressID = ""
+	node.InternetGwID = ""
+}
+
 // FirstInternetEgressRoutingNodeID returns a routing node ID from an internet egress.
 func FirstInternetEgressRoutingNodeID(e schema.Egress) string {
 	for nodeID := range e.Nodes {
```

**File**: `logic/peers.go` (modified, +1/-0)
```diff
@@ -326,6 +326,7 @@ func GetPeerUpdateForHost(ctx context.Context, network string, host *schema.Host
 		defaultDevicePolicy, _ := GetDefaultPolicy(ctx, schema.NetworkID(node.Network), models.DevicePolicy)
 		GetNodeEgressInfo(&node, eli, acls)
 		ResolveInternetExitRoutingNode(&node)
+		SuppressInternetExitIfNoACLAccess(&node, eli, acls, defaultDevicePolicy.Enabled)
 		egsWithDomain := ListAllByRoutingNodeWithDomain(eli, node.ID.String())
 		if len(egsWithDomain) > 0 {
 			hostPeerUpdate.EgressWithDomains = append(hostPeerUpdate.EgressWithDomains, egsWithDomain...)
```

---

### Incident Patch 11: `9a25b06d` (2026-09-09)
**Commit Message**: v1.7.0: fix: do not auto-assign exit node from ACL access

ACL/gateway policies may allow reachability to an internet egress, but
full-tunnel (0.0.0.0/0) must only apply when the user explicitly selects
an exit node.

**File**: `logic/acls_selected_ips_test.go` (modified, +35/-8)
```diff
@@ -126,7 +126,7 @@ func TestAppendEgressPolicyRangeExpandsInternet(t *testing.T) {
 	}
 }
 
-func TestApplyInternetExitFromDeviceACL(t *testing.T) {
+func TestAddEgressInfoToPeerByAccess_DoesNotAutoFullTunnelFromInternetACL(t *testing.T) {
 	originalGetEgressByID := getEgressByID
 	t.Cleanup(func() { getEgressByID = originalGetEgressByID })
 
@@ -138,6 +138,13 @@ func TestApplyInternetExitFromDeviceACL(t *testing.T) {
 			Network: "netmaker",
 		},
 	}
+	exitNode := models.Node{
+		CommonNode: models.CommonNode{
+			ID:      exitID,
+			Network: "netmaker",
+			IsGw:    true,
+		},
+	}
 	eli := []schema.Egress{{
 		ID:      "inet-eg",
 		Network: "netmaker",
@@ -146,21 +153,41 @@ func TestApplyInternetExitFromDeviceACL(t *testing.T) {
 		Range:   "*",
 		Nodes:   datatypes.JSONMap{exitID.String(): json.Number("100")},
 	}}
+	getEgressByID = func(id string) (schema.Egress, error) {
+		if id == "inet-eg" {
+			return eli[0], nil
+		}
+		return schema.Egress{}, errors.New("not found")
+	}
 	acls := []models.Acl{{
 		Enabled: true,
 		Src:     []models.AclPolicyTag{{ID: models.NodeID, Value: clientID.String()}},
 		Dst:     []models.AclPolicyTag{{ID: models.EgressID, Value: "inet-eg"}},
 	}}
-	getEgressByID = func(id string) (schema.Egress, error) {
-		if id == "inet-eg" {
-			return eli[0], nil
+
+	// ACL grants access to the internet egress, but the client did not select it.
+	AddEgressInfoToPeerByAccess(&client, &exitNode, eli, acls, false)
+	for _, r := range exitNode.EgressDetails.EgressGatewayRanges {
+		if r == IPv4Network || r == IPv6Network {
+			t.Fatalf("ACL access alone must not attach default route %s; got %v", r, exitNode.EgressDetails.EgressGatewayRanges)
 		}
-		return schema.Egress{}, errors.New("not found")
+	}
+	if InternetExitRoutingNodeID(&client) != "" {
+		t.Fatalf("client must not be treated as exit client without selection, got %q", InternetExitRoutingNodeID(&client))
 	}
 
-	applyInternetExitFromDeviceACL(&client, eli, acls)
-	if client.InternetGwID != exitID.String() {
-		t.Fatalf("expected InternetGwID %s from internet ACL, got %q", exitID, client.InternetGwID)
+	// Explicit assignment (legacy InternetGwID) still attaches full-tunnel ranges.
+	client.InternetGwID = exitID.String()
+	exitNode.EgressDetails = models.EgressDetails{}
+	AddEgressInfoToPeerByAccess(&client, &exitNode, eli, acls, false)
+	hasV4 := false
+	for _, r := range exitNode.EgressDetails.EgressGatewayRanges {
+		if r == IPv4Network {
+			hasV4 = true
+		}
+	}
+	if !hasV4 {
+		t.Fatalf("explicit exit assignment should attach 0.0.0.0/0, got %v", exitNode.EgressDetails.EgressGatewayRanges)
 	}
 }
 
```

**File**: `logic/egress.go` (modified, +4/-35)
```diff
@@ -399,37 +399,6 @@ func ResolveInternetExitRoutingNode(node *models.Node) {
 	}
 }
 
-// applyInternetExitFromDeviceACL sets InternetGwID in-memory when a device ACL
-// grants this node access to a single internet egress and no exit is selected.
-// That attaches the exit node peer (0.0.0.0/0, default gw) the same way explicit
-// exit selection does. Multiple internet exits still require an explicit choice.
-func applyInternetExitFromDeviceACL(node *models.Node, eli []schema.Egress, acls []models.Acl) {
-	if node == nil || node.SelectedInternetEgressID != "" || node.InternetGwID != "" {
-		return
-	}
-	routingID := ""
-	for i := range eli {
-		e := eli[i]
-		if !e.Status || e.Network != node.Network || !IsEgressInternetGateway(e) {
-			continue
-		}
-		if !DoesNodeHaveAccessToEgress(node, &e, acls) {
-			continue
-		}
-		id := FirstInternetEgressRoutingNodeID(e)
-		if id == "" || id == node.ID.String() {
-			continue
-		}
-		if routingID != "" && routingID != id {
-			return
-		}
-		routingID = id
-	}
-	if routingID != "" {
-		node.InternetGwID = routingID
-	}
-}
-
 // FirstInternetEgressRoutingNodeID returns a routing node ID from an internet egress.
 func FirstInternetEgressRoutingNodeID(e schema.Egress) string {
 	for nodeID := range e.Nodes {
@@ -1116,10 +1085,10 @@ func AddEgressInfoToPeerByAccess(node, targetNode *models.Node, eli []schema.Egr
 		if !e.Status || e.Network != targetNode.Network {
 			continue
 		}
-		if IsEgressInternetGateway(e) && !usesPeerAsInternetExit(node, targetNode) && isDefaultPolicyActive {
-			// Default-allow must not auto-full-tunnel every peer. Explicit exit
-			// selection or a specific ACL (handled below when default is off)
-			// is required to attach 0.0.0.0/0.
+		if IsEgressInternetGateway(e) && !usesPeerAsInternetExit(node, targetNode) {
+			// Never auto-full-tunnel from ACL/gateway access alone. Full-tunnel
+			// (0.0.0.0/0, ::/0) requires explicit exit selection
+			// (SelectedInternetEgressID) or a legacy InternetGwID assignment.
 			continue
 		}
 		if !isDefaultPolicyActive {
```

**File**: `logic/peers.go` (modified, +0/-3)
```diff
@@ -326,9 +326,6 @@ func GetPeerUpdateForHost(ctx context.Context, network string, host *schema.Host
 		defaultDevicePolicy, _ := GetDefaultPolicy(ctx, schema.NetworkID(node.Network), models.DevicePolicy)
 		GetNodeEgressInfo(&node, eli, acls)
 		ResolveInternetExitRoutingNode(&node)
-		if !defaultDevicePolicy.Enabled {
-			applyInternetExitFromDeviceACL(&node, eli, acls)
-		}
 		egsWithDomain := ListAllByRoutingNodeWithDomain(eli, node.ID.String())
 		if len(egsWithDomain) > 0 {
 			hostPeerUpdate.EgressWithDomains = append(hostPeerUpdate.EgressWithDomains, egsWithDomain...)
```

---

### Incident Patch 12: `ccf6a411` (2026-09-08)
**Commit Message**: Merge pull request #4139 from gravitl/v1.7.0-scale-fixes

v1.7.0:  speed up /api/nodes on SQLite and harden DB under load

**File**: `auth/host_session.go` (modified, +1/-0)
```diff
@@ -271,6 +271,7 @@ func joinHostToNetworks(ctx context.Context, key models.EnrollmentKey, host *sch
 			true,
 		)
 		if len(violations) > 0 {
+			logic.EmitNewPostureViolationEvents(ctx, nil, violations, models.PostureCheckDeviceInfo{HostID: host.ID.String()}, schema.NetworkID(network.Name))
 			logger.Log(0, fmt.Sprintf("skipping joining network %s due to violations", network.Name))
 			continue
 		}
```

**File**: `controllers/enrollmentkeys.go` (modified, +2/-0)
```diff
@@ -538,6 +538,8 @@ func handleHostRegister(w http.ResponseWriter, r *http.Request) {
 		violations, _ := logic.CheckPostureViolationsForHost(r.Context(), &newHost, keyTags, schema.NetworkID(netI), true)
 		if len(violations) == 0 {
 			joinNetworks = append(joinNetworks, netI)
+		} else {
+			logic.EmitNewPostureViolationEvents(r.Context(), nil, violations, models.PostureCheckDeviceInfo{HostID: newHost.ID.String()}, schema.NetworkID(netI))
 		}
 	}
 	if len(joinNetworks) != len(enrollmentKey.Networks) && len(joinNetworks) == 0 {
```

**File**: `controllers/ext_client.go` (modified, +6/-2)
```diff
@@ -646,8 +646,10 @@ func createExtClient(w http.ResponseWriter, r *http.Request) {
 	if extclient.DeviceID != "" {
 		// check for violations connecting from desktop app
 		staticNode := models.ConvertToStaticNode(extclient)
-		violations, _ := logic.CheckPostureViolations(r.Context(), logic.GetPostureCheckDeviceInfoByNode(r.Context(), &staticNode), schema.NetworkID(extclient.Network))
+		deviceInfo := logic.GetPostureCheckDeviceInfoByNode(r.Context(), &staticNode)
+		violations, _ := logic.CheckPostureViolations(r.Context(), deviceInfo, schema.NetworkID(extclient.Network))
 		if len(violations) > 0 {
+			logic.EmitNewPostureViolationEvents(r.Context(), nil, violations, deviceInfo, schema.NetworkID(extclient.Network))
 			logic.ReturnErrorResponse(w, r, logic.FormatError(errors.New("posture check violations"), logic.Forbidden))
 			return
 		}
@@ -927,8 +929,10 @@ func updateExtClient(w http.ResponseWriter, r *http.Request) {
 	if newclient.DeviceID != "" && newclient.Enabled {
 		// check for violations connecting from desktop app
 		staticNode := models.ConvertToStaticNode(newclient)
-		violations, _ := logic.CheckPostureViolations(r.Context(), logic.GetPostureCheckDeviceInfoByNode(r.Context(), &staticNode), schema.NetworkID(newclient.Network))
+		deviceInfo := logic.GetPostureCheckDeviceInfoByNode(r.Context(), &staticNode)
+		violations, _ := logic.CheckPostureViolations(r.Context(), deviceInfo, schema.NetworkID(newclient.Network))
 		if len(violations) > 0 {
+			logic.EmitNewPostureViolationEvents(r.Context(), nil, violations, deviceInfo, schema.NetworkID(newclient.Network))
 			logic.ReturnErrorResponse(w, r, logic.FormatError(errors.New("posture check violations"), logic.Forbidden))
 			return
 		}
```

**File**: `controllers/hosts.go` (modified, +7/-1)
```diff
@@ -679,7 +679,10 @@ func hostUpdateFallback(w http.ResponseWriter, r *http.Request) {
 			)
 			for _, _node := range _nodes {
 				node := logic.ConvertSchemaNodeToModelsNode(&_node)
-				node.PostureChecksViolations, node.PostureCheckViolationSeverityLevel = logic.CheckPostureViolations(ctx, logic.GetPostureCheckDeviceInfoByNode(ctx, node), schema.NetworkID(node.Network))
+				deviceInfo := logic.GetPostureCheckDeviceInfoByNode(ctx, node)
+				oldViolations := node.PostureChecksViolations
+				node.PostureChecksViolations, node.PostureCheckViolationSeverityLevel = logic.CheckPostureViolations(ctx, deviceInfo, schema.NetworkID(node.Network))
+				logic.EmitNewPostureViolationEvents(ctx, oldViolations, node.PostureChecksViolations, deviceInfo, schema.NetworkID(node.Network))
 				_node.PostureCheckSeverity = node.PostureCheckViolationSeverityLevel
 				_node.PostureCheckLastEvaluationCycleID = uuid.NewString()
 				_node.PostureCheckLastEvaluatedAt = time.Now().UTC()
@@ -1011,6 +1014,7 @@ func addHostToNetwork(w http.ResponseWriter, r *http.Request) {
 
 	violations, _ := logic.CheckPostureViolationsForHost(r.Context(), host, nil, schema.NetworkID(networkID), true)
 	if len(violations) > 0 {
+		logic.EmitNewPostureViolationEvents(r.Context(), nil, violations, models.PostureCheckDeviceInfo{HostID: host.ID.String()}, schema.NetworkID(networkID))
 		logic.ReturnErrorResponseWithJson(w, r, violations, logic.FormatError(errors.New("posture check violations"), logic.BadReq))
 		return
 	}
@@ -1913,6 +1917,7 @@ func approvePendingHost(w http.ResponseWriter, r *http.Request) {
 
 	violations, _ := logic.CheckPostureViolationsForHost(r.Context(), host, keyTags, schema.NetworkID(network.Name), true)
 	if len(violations) > 0 {
+		logic.EmitNewPostureViolationEvents(r.Context(), nil, violations, models.PostureCheckDeviceInfo{HostID: host.ID.String()}, schema.NetworkID(network.Name))
 		err = fmt.Errorf("failed to approve pending host (%s): posture check violations", id)
 		logger.Log(0, err.Error())
 		logic.ReturnErrorResponse(w, r, logic.FormatError(err, logic.BadReq))
@@ -1981,6 +1986,7 @@ func addDefaultHostToNetworks(ctx context.Context, host *schema.Host) {
 
 		violations, _ := logic.CheckPostureViolationsForHost(ctx, host, make(map[models.TagID]struct{}), schema.NetworkID(network.Name), true)
 		if len(violations) > 0 {
+			logic.EmitNewPostureViolationEvents(ctx, nil, violations, models.PostureCheckDeviceInfo{HostID: host.ID.String()}, schema.NetworkID(network.Name))
 			logger.Log(2, "skipping network", network.Name, "for default host", host.Name, ": posture check violations")
 			continue
 		}
```

**File**: `controllers/server.go` (modified, +13/-4)
```diff
@@ -117,12 +117,21 @@ func getStatus(w http.ResponseWriter, r *http.Request) {
 	// 		isOnTrial = true
 	// 	}
 	// }
-	var isDBConnected bool
+	// With SQLite MaxOpenConns(1), a timed Ping can fail while the DB is healthy
+	// but the single connection is held by check-in flush / peer updates.
+	// Treat the pool as connected unless we get a hard connection error.
+	isDBConnected := false
 	sqldb, err := db.FromContext(r.Context()).DB()
 	if err == nil {
-		ctx, cancel := context.WithTimeout(context.TODO(), 2*time.Second)
-		defer cancel()
-		if sqldb.PingContext(ctx) == nil {
+		stats := sqldb.Stats()
+		if stats.OpenConnections == 0 || stats.InUse == 0 {
+			ctx, cancel := context.WithTimeout(context.TODO(), 2*time.Second)
+			defer cancel()
+			if pingErr := sqldb.PingContext(ctx); pingErr == nil {
+				isDBConnected = true
+			}
+		} else {
+			// Connection is in use — DB is up; avoid false negatives under load.
 			isDBConnected = true
 		}
 	}
```

**File**: `db/logger.go` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+package db
+
+import (
+	"log"
+	"os"
+	"strconv"
+	"strings"
+	"time"
+
+	"gorm.io/gorm/logger"
+)
+
+// newGormLogger returns a GORM logger.
+//
+// Set SQL_DEBUG=true (or "1" / "info") to log every SQL statement with duration.
+// Set SQL_DEBUG=slow to only log statements slower than SQL_SLOW_MS (default 200ms)
+// plus errors. Default remains Silent.
+func newGormLogger() logger.Interface {
+	mode := strings.ToLower(strings.TrimSpace(os.Getenv("SQL_DEBUG")))
+	if mode == "" || mode == "false" || mode == "0" {
+		return logger.Default.LogMode(logger.Silent)
+	}
+
+	slowThreshold := 200 * time.Millisecond
+	if v := os.Getenv("SQL_SLOW_MS"); v != "" {
+		if n, err := strconv.Atoi(v); err == nil && n > 0 {
+			slowThreshold = time.Duration(n) * time.Millisecond
+		}
+	}
+
+	level := logger.Info
+	if mode == "slow" || mode == "warn" {
+		level = logger.Warn
+	}
+
+	return logger.New(
+		log.New(os.Stdout, "[gorm] ", log.LstdFlags|log.Lmicroseconds),
+		logger.Config{
+			SlowThreshold:             slowThreshold,
+			LogLevel:                  level,
+			IgnoreRecordNotFoundError: true,
+			Colorful:                  false,
+		},
+	)
+}
```

**File**: `db/postgres.go` (modified, +1/-2)
```diff
@@ -10,7 +10,6 @@ import (
 	"github.com/gravitl/netmaker/servercfg"
 	"gorm.io/driver/postgres"
 	"gorm.io/gorm"
-	"gorm.io/gorm/logger"
 )
 
 // postgresConnector for initializing and
@@ -32,7 +31,7 @@ func (pg *postgresConnector) connect() (*gorm.DB, error) {
 	)
 
 	gormDB, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
-		Logger: logger.Default.LogMode(logger.Silent),
+		Logger: newGormLogger(),
 	})
 	if err != nil {
 		return nil, err
```

**File**: `db/sqlite.go` (modified, +4/-3)
```diff
@@ -6,7 +6,6 @@ import (
 
 	"gorm.io/driver/sqlite"
 	"gorm.io/gorm"
-	"gorm.io/gorm/logger"
 )
 
 // sqliteConnector for initializing and
@@ -49,9 +48,11 @@ func (s *sqliteConnector) connect() (*gorm.DB, error) {
 		}
 	}
 
-	dsn := dbFilePath + "?_journal_mode=WAL&_busy_timeout=5000"
+	// WAL + immediate lock + longer busy wait reduce lock storms under scale.
+	// Keep MaxOpenConns(1): concurrent writers with go-sqlite3 still deadlock easily.
+	dsn := dbFilePath + "?_journal_mode=WAL&_busy_timeout=30000&_txlock=immediate&_synchronous=NORMAL"
 	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
-		Logger: logger.Default.LogMode(logger.Silent),
+		Logger: newGormLogger(),
 	})
 	if err != nil {
 		return nil, err
```

---

### Incident Patch 13: `66cb8226` (2026-09-08)
**Commit Message**: fix(posture): audit user violations and drop run sync noise

Emit POSTURE_CHECK_FAILED for Active Users with USER source, backfill
user failures separately from devices, and stop logging SYNC on manual run.

**File**: `models/structs.go` (modified, +3/-0)
```diff
@@ -472,6 +472,9 @@ type PostureCheckDeviceInfo struct {
 	UserGroups     map[schema.UserGroupID]struct{}
 	// HostID is the Netmaker host's UUID; used to look up MDM state.
 	HostID string
+	// Username / ClientID identify Active User (extclient) posture subjects.
+	Username string
+	ClientID string
 	// MDMState is the most recent sync snapshot for the configured MDM
 	// provider; nil if MDM is not configured or the host hasn't synced yet.
 	MDMState *schema.DeviceMDMState
```

**File**: `pro/controllers/posture_check.go` (modified, +0/-18)
```diff
@@ -345,24 +345,6 @@ func triggerPostureChecks(w http.ResponseWriter, r *http.Request) {
 		mq.PublishPeerUpdate(ctx, false)
 	}(scope.WithContext(db.WithContext(context.Background()), scope.Level(r.Context()), scope.ID(r.Context())))
 
-	logic.LogEvent(r.Context(), &models.Event{
-		Action:      schema.Sync,
-		TriggeredBy: r.Header.Get("user"),
-		Source: models.Subject{
-			ID:   r.Header.Get("user"),
-			Name: r.Header.Get("user"),
-			Type: schema.UserSub,
-		},
-		Target: models.Subject{
-			ID:   string(schema.AllPostureCheckRsrcID),
-			Name: "all",
-			Type: schema.PostureCheckSub,
-		},
-		Origin: schema.Dashboard,
-		Diff: models.Diff{
-			New: map[string]interface{}{"status": "queued"},
-		},
-	})
 	logic.ReturnSuccessResponseWithJson(w, r, map[string]any{"queued": true}, "posture checks queued")
 }
 
```

**File**: `pro/logic/posture_check.go` (modified, +38/-12)
```diff
@@ -97,14 +97,19 @@ func RunPostureChecksForTenant(ctx context.Context) error {
 		return err
 	}
 
-	// One-time backfill: if this tenant has never logged a posture failure,
-	// treat previous violations as empty so current failures appear in activity.
-	// After the first POSTURE_CHECK_FAILED is written, resume new-only dedupe.
-	backfillPostureFailures := false
-	if has, err := (&schema.Event{}).HasAction(ctx, schema.PostureCheckFailed); err != nil {
-		slog.Warn("failed to check for existing posture failure events", "error", err)
+	// One-time backfill per subject type: devices and users are tracked
+	// separately so device events do not suppress user violation backfill.
+	backfillDeviceFailures := false
+	backfillUserFailures := false
+	if has, err := (&schema.Event{}).HasPostureFailureForSubjectType(ctx, schema.DeviceSub); err != nil {
+		slog.Warn("failed to check for existing device posture failure events", "error", err)
 	} else {
-		backfillPostureFailures = !has
+		backfillDeviceFailures = !has
+	}
+	if has, err := (&schema.Event{}).HasPostureFailureForSubjectType(ctx, schema.UserSub); err != nil {
+		slog.Warn("failed to check for existing user posture failure events", "error", err)
+	} else {
+		backfillUserFailures = !has
 	}
 
 	for _, netI := range nets {
@@ -138,7 +143,7 @@ func RunPostureChecksForTenant(ctx context.Context) error {
 						continue
 					}
 					oldVi := extclient.PostureChecksViolations
-					if backfillPostureFailures {
+					if backfillUserFailures {
 						oldVi = nil
 					}
 					EmitNewPostureViolationEvents(ctx, oldVi, postureChecksViolations, deviceInfo, schema.NetworkID(netI.Name))
@@ -158,7 +163,7 @@ func RunPostureChecksForTenant(ctx context.Context) error {
 					continue
 				}
 				oldVi := nodeI.PostureChecksViolations
-				if backfillPostureFailures {
+				if backfillDeviceFailures {
 					oldVi = nil
 				}
 				EmitNewPostureViolationEvents(ctx, oldVi, postureChecksViolations, deviceInfo, schema.NetworkID(netI.Name))
@@ -496,6 +501,8 @@ func GetPostureCheckDeviceInfoByNode(ctx context.Context, node *models.Node) mod
 			KernelVersion:  node.StaticNode.KernelVersion,
 			Tags:           make(map[models.TagID]struct{}),
 			IsUser:         true,
+			Username:       node.StaticNode.OwnerID,
+			ClientID:       node.StaticNode.ClientID,
 			UserGroups:     make(map[schema.UserGroupID]struct{}),
 		}
 		// get user groups
@@ -973,6 +980,7 @@ func asInt(v interface{}) int {
 // every violation newly present in newVi (any attribute). Dedupes by CheckID
 // against oldVi so ongoing failures do not re-fire; cleared violations are
 // ignored. MDM/EDR events keep their provider-specific enrichment fields.
+// Active User subjects are logged as USER; hosts as DEVICE.
 func EmitNewPostureViolationEvents(ctx context.Context, oldVi, newVi []models.Violation, d models.PostureCheckDeviceInfo, network schema.NetworkID) {
 	if len(newVi) == 0 {
 		return
@@ -985,6 +993,19 @@ func EmitNewPostureViolationEvents(ctx context.Context, oldVi, newVi []models.Vi
 		prev[v.CheckID] = struct{}{}
 	}
 
+	sourceID := d.HostID
+	sourceName := d.HostID
+	sourceType := schema.DeviceSub
+	if d.IsUser {
+		sourceType = schema.UserSub
+		sourceID = d.Username
+		sourceName = d.Username
+		if sourceID == "" {
+			sourceID = d.ClientID
+			sourceName = d.ClientID
+		}
+	}
+
 	var mdmProviderID, edrProviderID string
 	for _, v := range newVi {
 		if v.CheckID != "" {
@@ -1000,6 +1021,11 @@ func EmitNewPostureViolationEvents(ctx context.Context, oldVi, newVi []models.Vi
 			"check":    v.Name,
 			"reason":   v.Message,
 			"severity": v.Severity,
+			"is_user":  d.IsUser,
+		}
+		if d.IsUser {
+			payload["username"] = d.Username
+			payload["client_id"] = d.ClientID
 		}
 		switch v.Attribute {
 		case string(schema.MDMCompliance):
@@ -1021,9 +1047,9 @@ func EmitNewPostureViolationEvents(ctx context.Context, oldVi, newVi []models.Vi
 		logic.LogEvent(ctx, &models.Event{
 			Action: schema.PostureCheckFailed,
 			Source: models.Subject{
-				ID:   d.HostID,
-				Name: d.HostID,
-				Type: schema.DeviceSub,
+				ID:   sourceID,
+				Name: sourceName,
+				Type: sourceType,
 			},
 			TriggeredBy: "system",
 			Target: models.Subject{
```

**File**: `schema/event.go` (modified, +14/-0)
```diff
@@ -203,6 +203,20 @@ func (a *Event) HasAction(ctx context.Context, action Action) (bool, error) {
 	return count > 0, err
 }
 
+// HasPostureFailureForSubjectType reports whether a POSTURE_CHECK_FAILED event
+// exists whose source JSON has the given subject_type (DEVICE or USER).
+func (a *Event) HasPostureFailureForSubjectType(ctx context.Context, subType SubjectType) (bool, error) {
+	query := db.FromContext(ctx).Model(&Event{}).
+		Where("action = ?", PostureCheckFailed).
+		Where("source LIKE ?", fmt.Sprintf(`%%"subject_type":"%s"%%`, subType))
+	if tenantID := scope.ID(ctx); tenantID != "" {
+		query = dbtypes.WithFilter(fmt.Sprintf("%s.tenant_id", eventsTable), tenantID)(query)
+	}
+	var count int64
+	err := query.Limit(1).Count(&count).Error
+	return count > 0, err
+}
+
 func (a *Event) DeleteAllForTenant(ctx context.Context) error {
 	if tenantID := scope.ID(ctx); tenantID != "" {
 		return db.FromContext(ctx).Where(fmt.Sprintf("%s.tenant_id = ?", eventsTable), tenantID).Delete(&Event{}).Error
```

---

### Incident Patch 14: `57b8a823` (2026-09-08)
**Commit Message**: Merge branch 'release-v1.7.0' into v1.7.0-scale-fixes

**File**: `clickhouse/clickhouse.go` (modified, +5/-0)
```diff
@@ -28,7 +28,12 @@ func Initialize() error {
 		return nil
 	}
 
+	if !servercfg.IsClickHouseConfigured() {
+		return errors.New("missing clickhouse config")
+	}
+
 	config := servercfg.GetClickHouseConfig()
+
 	chConn, err := clickhouse.Open(&clickhouse.Options{
 		Addr: []string{fmt.Sprintf("%s:%d", config.Host, config.Port)},
 		Auth: clickhouse.Auth{
```

**File**: `controllers/node.go` (modified, +7/-1)
```diff
@@ -255,7 +255,12 @@ func listNetworkNodes(w http.ResponseWriter, r *http.Request) {
 
 	var filters, options []dbtypes.Option
 	filters = append(filters, dbtypes.WithFilter("network_id", network.ID))
-	filters = append(filters, dbtypes.WithJoin("Host", dbtypes.WithFilter("os", osFilters...)))
+	if len(osFilters) > 0 {
+		filters = append(filters, func(db *gorm.DB) *gorm.DB {
+			return db.Joins("JOIN hosts_v1 ON hosts_v1.id = nodes_v1.host_id")
+		})
+		filters = append(filters, dbtypes.WithFilter("hosts_v1.os", osFilters...))
+	}
 	filters = append(filters, dbtypes.WithFilter("status", statusFilters...))
 
 	if deviceType != "" {
@@ -290,6 +295,7 @@ func listNetworkNodes(w http.ResponseWriter, r *http.Request) {
 		expr.ByteaField("endpoint_ipv6"),
 	))
 	options = append(options, filters...)
+	options = append(options, dbtypes.WithPreloads("Host"))
 	options = append(options, dbtypes.InAscOrder(fmt.Sprintf("%s.created_at", (&schema.Node{}).TableName())))
 	options = append(options, dbtypes.WithPagination(page, pageSize))
 
```

**File**: `controllers/server.go` (modified, +3/-0)
```diff
@@ -170,6 +170,9 @@ func allowUsers(next http.Handler) http.HandlerFunc {
 		}
 		user, _, _, err := logic.VerifyUserToken(r.Context(), authToken)
 		if err != nil || user == "" {
+			if err != nil {
+				logger.Log(4, "unauthorized:", err.Error())
+			}
 			logic.ReturnErrorResponse(w, r, errorResponse)
 			return
 		}
```

**File**: `controllers/user.go` (modified, +8/-7)
```diff
@@ -1206,18 +1206,19 @@ func listUsers(w http.ResponseWriter, r *http.Request) {
 		pageSize = 10
 	}
 
-	// role_id and auth_type live on the membership tables, not users_v1. Qualify them
-	// with the join alias used by ListAllWithMembership/CountWithMembership so they
-	// don't collide with the identically named legacy columns still present on users_v1.
+	// account_disabled, is_mfa_enabled, role_id and auth_type all live on the membership
+	// tables now, not users_v1. Qualify them with the join alias used by
+	// ListAllWithMembership/CountWithMembership so they don't collide with the identically
+	// named legacy columns still present on users_v1.
 	membershipAlias := "tm"
 	if scope.Level(r.Context()) == scope.OrgScope {
 		membershipAlias = "om"
 	}
 
 	_users, err := (&schema.User{}).ListAllWithMembership(
 		r.Context(),
-		dbtypes.WithFilter("account_disabled", accountStatusFilter...),
-		dbtypes.WithFilter("is_mfa_enabled", mfaStatusFilter...),
+		dbtypes.WithFilter(membershipAlias+".account_disabled", accountStatusFilter...),
+		dbtypes.WithFilter(membershipAlias+".is_mfa_enabled", mfaStatusFilter...),
 		dbtypes.WithFilter(membershipAlias+".role_id", roleFilter...),
 		dbtypes.WithFilter(membershipAlias+".auth_type", authTypeFilter...),
 		dbtypes.WithSearchQuery(q, "username"),
@@ -1240,8 +1241,8 @@ func listUsers(w http.ResponseWriter, r *http.Request) {
 
 	total, err := (&schema.User{}).CountWithMembership(
 		r.Context(),
-		dbtypes.WithFilter("account_disabled", accountStatusFilter...),
-		dbtypes.WithFilter("is_mfa_enabled", mfaStatusFilter...),
+		dbtypes.WithFilter(membershipAlias+".account_disabled", accountStatusFilter...),
+		dbtypes.WithFilter(membershipAlias+".is_mfa_enabled", mfaStatusFilter...),
 		dbtypes.WithFilter(membershipAlias+".role_id", roleFilter...),
 		dbtypes.WithFilter(membershipAlias+".auth_type", authTypeFilter...),
 		dbtypes.WithSearchQuery(q, "username"),
```

**File**: `logic/jwts.go` (modified, +17/-1)
```diff
@@ -164,6 +164,7 @@ func GetUserNameFromToken(ctx context.Context, authtoken string) (username strin
 	var tokenString = ""
 
 	if len(tokenSplit) < 2 {
+		logger.Log(4, "unauthorized: malformed authorization header")
 		return "", Unauthorized_Err
 	} else {
 		tokenString = tokenSplit[1]
@@ -176,13 +177,15 @@ func GetUserNameFromToken(ctx context.Context, authtoken string) (username strin
 		return jwtSecretKey, nil
 	})
 	if err != nil {
+		logger.Log(4, "unauthorized: jwt parse/signature failed:", err.Error())
 		return "", Unauthorized_Err
 	}
 
 	for _, aud := range claims.Audience {
 		// token created for mfa cannot be used for
 		// anything else.
 		if aud == "auth:mfa" {
+			logger.Log(4, "unauthorized: mfa-only token used outside mfa flow")
 			return "", Unauthorized_Err
 		}
 	}
@@ -211,7 +214,8 @@ func GetUserNameFromToken(ctx context.Context, authtoken string) (username strin
 			err = user.GetWithMembership(ctx)
 		}
 		if err != nil {
-			return "", err
+			logger.Log(4, fmt.Sprintf("unauthorized: user lookup failed (scope=%d id=%s): %s", scope.Level(ctx), scope.ID(ctx), err.Error()))
+			return "", Unauthorized_Err
 		}
 
 		err = checkUserAccess(ctx, user.ID, claims)
@@ -222,6 +226,7 @@ func GetUserNameFromToken(ctx context.Context, authtoken string) (username strin
 		return user.Username, nil
 	}
 
+	logger.Log(4, "unauthorized: token not valid")
 	return "", Unauthorized_Err
 }
 
@@ -287,6 +292,7 @@ func checkUserAccess(ctx context.Context, userID string, claims *models.UserClai
 		err := membership.Get(ctx)
 		if err != nil {
 			if errors.Is(err, gorm.ErrRecordNotFound) {
+				logger.Log(4, fmt.Sprintf("unauthorized: no org membership for org=%s user=%s", scope.ID(ctx), userID))
 				return Unauthorized_Err
 			}
 
@@ -297,6 +303,7 @@ func checkUserAccess(ctx context.Context, userID string, claims *models.UserClai
 			return nil
 		}
 
+		logger.Log(4, fmt.Sprintf("unauthorized: org claim mismatch claims.scope=%d claims.scopeid=%s ctx.orgid=%s", claims.Scope, claims.ScopeID, scope.ID(ctx)))
 		return Unauthorized_Err
 	} else if scope.Level(ctx) == scope.TenantScope {
 		membership := &schema.TenantMembership{
@@ -306,6 +313,7 @@ func checkUserAccess(ctx context.Context, userID string, claims *models.UserClai
 		err := membership.Get(ctx)
 		if err != nil {
 			if errors.Is(err, gorm.ErrRecordNotFound) {
+				logger.Log(4, fmt.Sprintf("unauthorized: no tenant membership for tenant=%s user=%s", scope.ID(ctx), userID))
 				return Unauthorized_Err
 			}
 
@@ -319,6 +327,7 @@ func checkUserAccess(ctx context.Context, userID string, claims *models.UserClai
 			err = tenant.Get(ctx)
 			if err != nil {
 				if errors.Is(err, gorm.ErrRecordNotFound) {
+					logger.Log(4, fmt.Sprintf("unauthorized: tenant not found for org-scoped claim, tenant=%s", scope.ID(ctx)))
 					return Unauthorized_Err
 				}
 
@@ -329,6 +338,7 @@ func checkUserAccess(ctx context.Context, userID string, claims *models.UserClai
 				return nil
 			}
 
+			logger.Log(4, fmt.Sprintf("unauthorized: org-scoped claim org id %s != tenant's org id %s", claims.ScopeID, tenant.OrganizationID))
 			return Unauthorized_Err
 		} else if claims.Scope == scope.TenantScope && claims.ScopeID == scope.ID(ctx) {
 			return nil
@@ -337,15 +347,21 @@ func checkUserAccess(ctx context.Context, userID string, claims *models.UserClai
 			// the sole tenant that existed before multi-tenancy.
 			soleTenant, err := SoleTenant(ctx)
 			if err != nil {
+				logger.Log(4, "unauthorized: legacy token, SoleTenant lookup failed:", err.Error())
 				return Unauthorized_Err
 			}
 
 			if soleTenant.ID == scope.ID(ctx) {
 				return nil
 			}
+			logger.Log(4, fmt.Sprintf("unauthorized: legacy token, sole tenant %s != ctx tenant %s", soleTenant.ID, scope.ID(ctx)))
+			return Unauthorized_Err
 		}
+		logger.Log(4, fmt.Sprintf("unauthorized: tenant-scope claim mismatch claims.scope=%d claims.scopeid=%s ctx.tenantid=%s", claims.Scope, claims.ScopeID, scope.ID(ctx)))
+		return Unauthorized_Err
 	}
 
+	logger.Log(4, fmt.Sprintf("unauthorized: unhandled scope level %d", scope.Level(ctx)))
 	return Unauthorized_Err
 }
 
```

**File**: `migrate/migrate_multitenancy.go` (modified, +6/-0)
```diff
@@ -157,6 +157,12 @@ func rekeyTenantScopedKeys(ctx context.Context, oldID, newID string) error {
 		}
 	}
 
+	if err := db.FromContext(ctx).Model(&schema.TenantSettingsRecord{}).
+		Where("key = ?", oldID).
+		Update("key", newID).Error; err != nil {
+		return err
+	}
+
 	roleQuery := db.FromContext(ctx).Model(&schema.UserRole{}).Where("network_id <> ''")
 	if oldID == "" {
 		roleQuery = roleQuery.Where("id NOT LIKE '%::%'")
```

**File**: `models/structs.go` (modified, +2/-0)
```diff
@@ -21,6 +21,8 @@ type FeatureFlags struct {
 	EnableJIT                     bool `json:"enable_jit"`
 	EnableOverlappingEgressRanges bool `json:"enable_overlapping_egress_ranges"`
 	EnableSIEMIntegration         bool `json:"enable_siem_integration"`
+	EnableMDMIntegration          bool `json:"enable_mdm_integration"`
+	EnableEDRIntegration          bool `json:"enable_edr_integration"`
 }
 
 // AuthParams - struct for auth params
```

**File**: `pro/controllers/integrations.go` (modified, +39/-0)
```diff
@@ -55,6 +55,20 @@ func extractAndValidateIntegration(w http.ResponseWriter, r *http.Request) (inte
 	return intType, id, true
 }
 
+func integrationFeatureEnabled(ctx context.Context, intType integration.Type) bool {
+	flags := logic.GetFeatureFlags(ctx)
+	switch intType {
+	case integration.TypeSIEM:
+		return flags.EnableSIEMIntegration
+	case integration.TypeMDM:
+		return flags.EnableMDMIntegration
+	case integration.TypeEDR:
+		return flags.EnableEDRIntegration
+	default:
+		return true
+	}
+}
+
 // @Summary     Get an integration
 // @Router      /api/v1/integrations/{type} [get]
 // @Tags        Integrations
@@ -117,6 +131,11 @@ func upsertIntegration(w http.ResponseWriter, r *http.Request) {
 		return
 	}
 
+	if !integrationFeatureEnabled(r.Context(), intType) {
+		logic.ReturnErrorResponse(w, r, logic.FormatError(fmt.Errorf("%s integration is not enabled on your plan", intType), logic.BadReq))
+		return
+	}
+
 	intg := &schema.Integration{Type: string(intType)}
 	integrations, err := intg.ListByType(r.Context())
 	if err != nil {
@@ -361,6 +380,11 @@ func listMDMProviders(w http.ResponseWriter, r *http.Request) {
 // @Success     202 {object} models.SuccessResponse
 // @Failure     400 {object} models.ErrorResponse
 func triggerMDMSync(w http.ResponseWriter, r *http.Request) {
+	if !logic.GetFeatureFlags(r.Context()).EnableMDMIntegration {
+		logic.ReturnErrorResponse(w, r, logic.FormatError(errors.New("mdm integration is not enabled on your plan"), logic.BadReq))
+		return
+	}
+
 	active, err := mdmpkg.GetActive(r.Context())
 	if err != nil {
 		logic.ReturnErrorResponse(w, r, logic.FormatError(err, logic.Internal))
@@ -408,6 +432,11 @@ func triggerMDMSync(w http.ResponseWriter, r *http.Request) {
 // @Param       provider  query string false "Filter by provider name"
 // @Success     200 {array} schema.DeviceMDMState
 func listMDMDeviceState(w http.ResponseWriter, r *http.Request) {
+	if !logic.GetFeatureFlags(r.Context()).EnableMDMIntegration {
+		logic.ReturnErrorResponse(w, r, logic.FormatError(errors.New("mdm integration is not enabled on your plan"), logic.BadReq))
+		return
+	}
+
 	ctx := r.Context()
 	hostID := r.URL.Query().Get("host_id")
 	provider := r.URL.Query().Get("provider")
@@ -445,6 +474,11 @@ func listEDRProviders(w http.ResponseWriter, r *http.Request) {
 }
 
 func triggerEDRSync(w http.ResponseWriter, r *http.Request) {
+	if !logic.GetFeatureFlags(r.Context()).EnableEDRIntegration {
+		logic.ReturnErrorResponse(w, r, logic.FormatError(errors.New("edr integration is not enabled on your plan"), logic.BadReq))
+		return
+	}
+
 	active, err := edrpkg.GetActive(r.Context())
 	if err != nil {
 		logic.ReturnErrorResponse(w, r, logic.FormatError(err, logic.Internal))
@@ -465,6 +499,11 @@ func triggerEDRSync(w http.ResponseWriter, r *http.Request) {
 }
 
 func listEDRDeviceState(w http.ResponseWriter, r *http.Request) {
+	if !logic.GetFeatureFlags(r.Context()).EnableEDRIntegration {
+		logic.ReturnErrorResponse(w, r, logic.FormatError(errors.New("edr integration is not enabled on your plan"), logic.BadReq))
+		return
+	}
+
 	ctx := r.Context()
 	hostID := r.URL.Query().Get("host_id")
 	provider := r.URL.Query().Get("provider")
```

---

### Incident Patch 15: `641f991f` (2026-09-08)
**Commit Message**: fix(posture): keep violation cycles consistent and audit new failures

Skip violation details on GetAllNodes, replace cycles transactionally, and
emit POSTURE_CHECK_FAILED for new CheckIDs (with one-time backfill).

**File**: `auth/host_session.go` (modified, +1/-0)
```diff
@@ -271,6 +271,7 @@ func joinHostToNetworks(ctx context.Context, key models.EnrollmentKey, host *sch
 			true,
 		)
 		if len(violations) > 0 {
+			logic.EmitNewPostureViolationEvents(ctx, nil, violations, models.PostureCheckDeviceInfo{HostID: host.ID.String()}, schema.NetworkID(network.Name))
 			logger.Log(0, fmt.Sprintf("skipping joining network %s due to violations", network.Name))
 			continue
 		}
```

**File**: `controllers/enrollmentkeys.go` (modified, +2/-0)
```diff
@@ -538,6 +538,8 @@ func handleHostRegister(w http.ResponseWriter, r *http.Request) {
 		violations, _ := logic.CheckPostureViolationsForHost(r.Context(), &newHost, keyTags, schema.NetworkID(netI), true)
 		if len(violations) == 0 {
 			joinNetworks = append(joinNetworks, netI)
+		} else {
+			logic.EmitNewPostureViolationEvents(r.Context(), nil, violations, models.PostureCheckDeviceInfo{HostID: newHost.ID.String()}, schema.NetworkID(netI))
 		}
 	}
 	if len(joinNetworks) != len(enrollmentKey.Networks) && len(joinNetworks) == 0 {
```

**File**: `controllers/ext_client.go` (modified, +6/-2)
```diff
@@ -646,8 +646,10 @@ func createExtClient(w http.ResponseWriter, r *http.Request) {
 	if extclient.DeviceID != "" {
 		// check for violations connecting from desktop app
 		staticNode := models.ConvertToStaticNode(extclient)
-		violations, _ := logic.CheckPostureViolations(r.Context(), logic.GetPostureCheckDeviceInfoByNode(r.Context(), &staticNode), schema.NetworkID(extclient.Network))
+		deviceInfo := logic.GetPostureCheckDeviceInfoByNode(r.Context(), &staticNode)
+		violations, _ := logic.CheckPostureViolations(r.Context(), deviceInfo, schema.NetworkID(extclient.Network))
 		if len(violations) > 0 {
+			logic.EmitNewPostureViolationEvents(r.Context(), nil, violations, deviceInfo, schema.NetworkID(extclient.Network))
 			logic.ReturnErrorResponse(w, r, logic.FormatError(errors.New("posture check violations"), logic.Forbidden))
 			return
 		}
@@ -927,8 +929,10 @@ func updateExtClient(w http.ResponseWriter, r *http.Request) {
 	if newclient.DeviceID != "" && newclient.Enabled {
 		// check for violations connecting from desktop app
 		staticNode := models.ConvertToStaticNode(newclient)
-		violations, _ := logic.CheckPostureViolations(r.Context(), logic.GetPostureCheckDeviceInfoByNode(r.Context(), &staticNode), schema.NetworkID(newclient.Network))
+		deviceInfo := logic.GetPostureCheckDeviceInfoByNode(r.Context(), &staticNode)
+		violations, _ := logic.CheckPostureViolations(r.Context(), deviceInfo, schema.NetworkID(newclient.Network))
 		if len(violations) > 0 {
+			logic.EmitNewPostureViolationEvents(r.Context(), nil, violations, deviceInfo, schema.NetworkID(newclient.Network))
 			logic.ReturnErrorResponse(w, r, logic.FormatError(errors.New("posture check violations"), logic.Forbidden))
 			return
 		}
```

**File**: `controllers/hosts.go` (modified, +7/-1)
```diff
@@ -679,7 +679,10 @@ func hostUpdateFallback(w http.ResponseWriter, r *http.Request) {
 			)
 			for _, _node := range _nodes {
 				node := logic.ConvertSchemaNodeToModelsNode(&_node)
-				node.PostureChecksViolations, node.PostureCheckViolationSeverityLevel = logic.CheckPostureViolations(ctx, logic.GetPostureCheckDeviceInfoByNode(ctx, node), schema.NetworkID(node.Network))
+				deviceInfo := logic.GetPostureCheckDeviceInfoByNode(ctx, node)
+				oldViolations := node.PostureChecksViolations
+				node.PostureChecksViolations, node.PostureCheckViolationSeverityLevel = logic.CheckPostureViolations(ctx, deviceInfo, schema.NetworkID(node.Network))
+				logic.EmitNewPostureViolationEvents(ctx, oldViolations, node.PostureChecksViolations, deviceInfo, schema.NetworkID(node.Network))
 				_node.PostureCheckSeverity = node.PostureCheckViolationSeverityLevel
 				_node.PostureCheckLastEvaluationCycleID = uuid.NewString()
 				_node.PostureCheckLastEvaluatedAt = time.Now().UTC()
@@ -1011,6 +1014,7 @@ func addHostToNetwork(w http.ResponseWriter, r *http.Request) {
 
 	violations, _ := logic.CheckPostureViolationsForHost(r.Context(), host, nil, schema.NetworkID(networkID), true)
 	if len(violations) > 0 {
+		logic.EmitNewPostureViolationEvents(r.Context(), nil, violations, models.PostureCheckDeviceInfo{HostID: host.ID.String()}, schema.NetworkID(networkID))
 		logic.ReturnErrorResponseWithJson(w, r, violations, logic.FormatError(errors.New("posture check violations"), logic.BadReq))
 		return
 	}
@@ -1913,6 +1917,7 @@ func approvePendingHost(w http.ResponseWriter, r *http.Request) {
 
 	violations, _ := logic.CheckPostureViolationsForHost(r.Context(), host, keyTags, schema.NetworkID(network.Name), true)
 	if len(violations) > 0 {
+		logic.EmitNewPostureViolationEvents(r.Context(), nil, violations, models.PostureCheckDeviceInfo{HostID: host.ID.String()}, schema.NetworkID(network.Name))
 		err = fmt.Errorf("failed to approve pending host (%s): posture check violations", id)
 		logger.Log(0, err.Error())
 		logic.ReturnErrorResponse(w, r, logic.FormatError(err, logic.BadReq))
@@ -1981,6 +1986,7 @@ func addDefaultHostToNetworks(ctx context.Context, host *schema.Host) {
 
 		violations, _ := logic.CheckPostureViolationsForHost(ctx, host, make(map[models.TagID]struct{}), schema.NetworkID(network.Name), true)
 		if len(violations) > 0 {
+			logic.EmitNewPostureViolationEvents(ctx, nil, violations, models.PostureCheckDeviceInfo{HostID: host.ID.String()}, schema.NetworkID(network.Name))
 			logger.Log(2, "skipping network", network.Name, "for default host", host.Name, ": posture check violations")
 			continue
 		}
```

**File**: `logic/hosts.go` (modified, +5/-0)
```diff
@@ -44,6 +44,11 @@ var CheckPostureViolations = func(ctx context.Context, d models.PostureCheckDevi
 	return []models.Violation{}, schema.SeverityUnknown
 }
 
+// EmitNewPostureViolationEvents records audit events for newly observed posture
+// failures. No-op in community; wired by pro.
+var EmitNewPostureViolationEvents = func(ctx context.Context, oldVi, newVi []models.Violation, d models.PostureCheckDeviceInfo, network schema.NetworkID) {
+}
+
 var CheckPostureViolationsForHost = func(ctx context.Context, host *schema.Host, tags map[models.TagID]struct{}, network schema.NetworkID, skipAutoUpdate bool) ([]models.Violation, schema.Severity) {
 	if host == nil {
 		return []models.Violation{}, schema.SeverityUnknown
```

**File**: `logic/nodes.go` (modified, +36/-8)
```diff
@@ -328,8 +328,23 @@ func DeleteNodeByID(ctx context.Context, node *models.Node) error {
 	return nil
 }
 
-// GetAllNodes - returns all nodes in the DB
+// GetAllNodes - returns all nodes in the DB.
+// List/API responses use posture severity/cycle fields already on the node row
+// (written by the background posture hook). Full violation details are omitted
+// here — use GetAllNodesWithViolations or single-node convert / the dedicated
+// violations API when the detail array is required.
 func GetAllNodes(ctx context.Context) ([]models.Node, error) {
+	return getAllNodes(ctx, false)
+}
+
+// GetAllNodesWithViolations is like GetAllNodes but attaches current-cycle
+// posture_check_violations in one batch query. Intended for the posture hook
+// (event diffs), not for high-frequency list APIs.
+func GetAllNodesWithViolations(ctx context.Context) ([]models.Node, error) {
+	return getAllNodes(ctx, true)
+}
+
+func getAllNodes(ctx context.Context, withViolations bool) ([]models.Node, error) {
 	var nodes []models.Node
 	_nodes, err := (&schema.Node{}).ListAll(ctx, dbtypes.WithAllPreloads())
 	if err != nil {
@@ -341,14 +356,17 @@ func GetAllNodes(ctx context.Context) ([]models.Node, error) {
 		ensureNodeMutex(node)
 		nodes = append(nodes, *node)
 	}
-	attachPostureViolations(ctx, _nodes, nodes)
+	if withViolations {
+		attachPostureViolations(ctx, _nodes, nodes)
+	}
 
 	return nodes, nil
 }
 
 // attachPostureViolations loads violations for all nodes in one query and
 // assigns each node's current-cycle violations onto the models.Node slice.
 // schemaNodes and modelsNodes must be the same length and aligned by index.
+// Used by GetAllNodesWithViolations (posture hook), not the high-frequency list API.
 func attachPostureViolations(ctx context.Context, schemaNodes []schema.Node, modelsNodes []models.Node) {
 	if len(schemaNodes) == 0 || len(schemaNodes) != len(modelsNodes) {
 		return
@@ -367,7 +385,6 @@ func attachPostureViolations(ctx context.Context, schemaNodes []schema.Node, mod
 		slog.Warn("failed to batch-load posture violations", "error", err, "nodes", len(ids))
 		return
 	}
-	// nodeID -> cycleID -> violations
 	byNodeCycle := make(map[string]map[string][]models.Violation, len(ids))
 	for _, v := range all {
 		cycles := byNodeCycle[v.NodeID]
@@ -385,11 +402,22 @@ func attachPostureViolations(ctx context.Context, schemaNodes []schema.Node, mod
 	}
 	for i := range modelsNodes {
 		cycleID := schemaNodes[i].PostureCheckLastEvaluationCycleID
-		if cycleID == "" {
+		cycles := byNodeCycle[schemaNodes[i].ID]
+		if cycles == nil {
 			continue
 		}
-		if cycles, ok := byNodeCycle[schemaNodes[i].ID]; ok {
-			modelsNodes[i].PostureChecksViolations = cycles[cycleID]
+		if cycleID != "" {
+			if v, ok := cycles[cycleID]; ok {
+				modelsNodes[i].PostureChecksViolations = v
+				continue
+			}
+		}
+		// Fallback when cycle metadata and rows disagree after a partial upsert.
+		if schemaNodes[i].PostureCheckSeverity != schema.SeverityUnknown {
+			for _, v := range cycles {
+				modelsNodes[i].PostureChecksViolations = v
+				break
+			}
 		}
 	}
 }
@@ -490,7 +518,6 @@ func GetNodesByIDs(ids []string) (map[string]models.Node, error) {
 		ensureNodeMutex(n)
 		modelsNodes[i] = *n
 	}
-	attachPostureViolations(ctx, _nodes, modelsNodes)
 
 	result := make(map[string]models.Node, len(modelsNodes))
 	for i := range modelsNodes {
@@ -659,7 +686,8 @@ type nodeConvertOpts struct {
 type NodeConvertOption func(*nodeConvertOpts)
 
 // SkipViolations skips the per-node posture_check_violations query.
-// Use with attachPostureViolations for batched list loads.
+// Use on list paths: severity/cycle fields on the node row are enough;
+// violation details come from the dedicated violations API or single-node get.
 func SkipViolations() NodeConvertOption {
 	return func(o *nodeConvertOpts) { o.skipViolations = true }
 }
```

**File**: `orchestrator/node.go` (modified, +4/-1)
```diff
@@ -155,8 +155,11 @@ func (n *NodeOrchestrator) CreateNode(ctx context.Context, host *schema.Host, ne
 
 	go func(ctx context.Context) {
 		modelsNode := logic.ConvertSchemaNodeToModelsNode(node)
+		deviceInfo := logic.GetPostureCheckDeviceInfoByNode(ctx, modelsNode)
+		oldViolations := modelsNode.PostureChecksViolations
 
-		modelsNode.PostureChecksViolations, modelsNode.PostureCheckViolationSeverityLevel = logic.CheckPostureViolations(ctx, logic.GetPostureCheckDeviceInfoByNode(ctx, modelsNode), schema.NetworkID(node.Network.Name))
+		modelsNode.PostureChecksViolations, modelsNode.PostureCheckViolationSeverityLevel = logic.CheckPostureViolations(ctx, deviceInfo, schema.NetworkID(node.Network.Name))
+		logic.EmitNewPostureViolationEvents(ctx, oldViolations, modelsNode.PostureChecksViolations, deviceInfo, schema.NetworkID(node.Network.Name))
 		node.PostureCheckSeverity = modelsNode.PostureCheckViolationSeverityLevel
 		node.PostureCheckLastEvaluationCycleID = uuid.NewString()
 		node.PostureCheckLastEvaluatedAt = time.Now().UTC()
```

**File**: `pro/initialize.go` (modified, +1/-0)
```diff
@@ -224,6 +224,7 @@ func InitPro() {
 	logic.ValidateEgressReq = proLogic.ValidateEgressReq
 	logic.CheckPostureViolations = proLogic.CheckPostureViolations
 	logic.CheckPostureViolationsForHost = proLogic.CheckPostureViolationsForHost
+	logic.EmitNewPostureViolationEvents = proLogic.EmitNewPostureViolationEvents
 	logic.GetPostureCheckDeviceInfoByNode = proLogic.GetPostureCheckDeviceInfoByNode
 	logic.SyncHostMDMState = mdmpkg.SyncHostMDMState
 	logic.SyncHostEDRState = edrpkg.SyncHostEDRState
```

#### Recent Merged Pull Requests:
- **PR #4170** (2026-10-04): NM-356: Network Status API (@VishalDalwadi)
- **PR #4168** (2026-10-02): Fix: Add GRPC_TLS flag for Server GRPC Client (@VishalDalwadi)
- **PR #4167** (2026-10-03): NM-356: User Node/Device Cleanup (@VishalDalwadi)
- **PR #4166** (2026-10-01): NM-356: Flow Logs and Nameserver Changes (@VishalDalwadi)
- **PR #4164** (closed): Feature/validate settings (@kushalShukla-web)
- **PR #4156** (2026-09-23): Master (@abhishek9686)
- **PR #4155** (2026-09-23): Release v1.7.0 (@abhishek9686)
- **PR #4152** (2026-09-23): Patch: License Validation and Management (@VishalDalwadi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
