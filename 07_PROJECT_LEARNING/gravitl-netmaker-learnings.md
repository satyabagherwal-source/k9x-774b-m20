> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/gravitl-netmaker-learnings.md`  
> **Source**: github ([https://github.com/gravitl/netmaker](https://github.com/gravitl/netmaker))  
> **Source Version**: `f66de90f`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T10:03:18.376Z  
> **Learning ID**: `learn-github-gravitl-netmaker`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): gravitl/netmaker

> **Canonical Artifact**: `07_PROJECT_LEARNING/gravitl-netmaker-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gravitl/netmaker](https://github.com/gravitl/netmaker))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T10:03:15.130Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gravitl/netmaker`
- **Description**: Netmaker makes networks with WireGuard. Netmaker automates fast, secure, and distributed virtual networks.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 11831 stars

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

// deriveHostTrafficKey computes the AES-256 key shared with host, derived via
// ECDH between the server's private traffic key and the host's public one.
func deriveHostTrafficKey(host *schema.Host) ([]byte, error) {
	trafficKey, err := logic.RetrievePrivateTrafficKey()
	if err != nil {
		return nil, err
	}
	serverPrivKey, err := ncutils.ConvertBytesToKey(trafficKey)
	if err != nil {
		return nil, err
	}
	hostPubKey, err := ncutils.ConvertBytesToKey(host.TrafficKeyPublic)
	if err != nil {
		return nil, err
	}
	return ncutils.DeriveSharedKey(serverPrivKey, hostPubKey)
}

// encryptMsgAESGCM compresses and AES-GCM encrypts msg for delivery to host.
// Hosts that have upgraded past v1.8.0 get a key derived via
// ECDH; older hosts, which only know how to decrypt with the host's raw
// public key as the AES key (no real confidentiality), keep getting that
// legacy scheme until they upgrade.
func encryptMsgAESGCM(host *schema.Host, msg []byte) ([]byte, error) {
	zipped, err := compressPayload(msg)
	if err != nil {
		return nil, err
	}

	legacyScheme, err := logic.VersionLessThan(host.Version, "v1.8.0")
	if err != nil {
		return nil, err
	}
	if legacyScheme {
		return encryptAESGCM(host.TrafficKeyPublic[0:32], zipped)
	}

	key, err := deriveHostTrafficKey(host)
	if err != nil {
		return nil, err
	}
	return encryptAESGCM(key, zipped)
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
		encrypted, encryptErr = encryptMsgAESGCM(host, msg)
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
	"crypto/sha256"
	"fmt"
	"io"

	"golang.org/x/crypto/hkdf"
	"golang.org/x/crypto/nacl/box"
)

const (
	chunkSize = 16000 // 16000 bytes max message size

	// trafficKeyHKDFInfo is the HKDF context label for keys derived by
	// DeriveSharedKey. It must be identical on both ends of a connection.
	trafficKeyHKDFInfo = "netmaker-traffic-key-v1"
)

// DeriveSharedKey derives a symmetric AES-256 key from the X25519 ECDH shared
// secret between localPrivate and remotePublic, via HKDF-SHA256.
//
// This must be used instead of either key's raw bytes as a symmetric key:
// a public key is, by definition, not secret (it is readable via the API),
// so using it directly as an AES key provides no confidentiality. The ECDH
// shared secret cannot be computed by anyone who only knows the two public
// keys -- it also requires one of the two private keys.
func DeriveSharedKey(localPrivate, remotePublic *[32]byte) ([]byte, error) {
	var shared [32]byte
	box.Precompute(&shared, remotePublic, localPrivate)
	key := make([]byte, 32)
	if _, err := io.ReadFull(hkdf.New(sha256.New, shared[:], nil, []byte(trafficKeyHKDFInfo)), key); err != nil {
		return nil, err
	}
	return key, nil
}

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4086** (2026-07-15): **[Bug]: NAT/Masquarade dont work since Update to v1.6**
  *Symptoms*: ### Contact Details  _No response_  ### What happened?  Since ive updated to v1.6 the Site-2-Site Access isnt working anymore when no routes are set. It worked like a charm until update ...  ### Version  v1.6.0  ### What OS are you using?  Linux  ### Relevant log output  ```shell  ```  ### Contributing guidelines  - [x] Yes, I did.
  **Post-Mortem & Fix Analysis**:
  > Hi @maieredv-manuel,  Thanks for reporting this.  Could you provide a few more details about your setup?  1. Can you describe your Site-to-Site topology (how many egress gateways/sites are connected)? 2. When you say "no routes are set", do you mean there are no Site-to-Site routes configured at all? 3. Is NAT enabled on the egress gateways? 4. What traffic are you expecting to pass through the egress gateway (source subnet → destination subnet)? 5. Was this same configuration working on v1.5.x without any additional routes configured?  If you could also share your Site-to-Site configuration (screenshots or relevant settings), that would help us understand the scenario and try to reproduce it.  Best, Majdi
  > Hi @Mejdii   sorry ... i was in hurry ...   1. we have a "Cloud-Hub" as Node and Gateway, all Site Nodes (in that case 3) are connection to the "Cloud-Hub" (so we need no Portforwarding on the Sites). We have one Egress rule for every Side via the Site-Node.  2. Sure, Site-to-Site Routes in netmaker are set. But we are using Direct-NAT via Netmaker > so we dont needed to create any Static Routes per Site. 3. Yes, is enabled, and worked like it should until Update to 1.6.0 4. Yes, "simple" Site-to-Site and access from "Config-Nodes" to the Sites. 5. Yes, worked, ive changed nothing, only Updated to 1.6  Ive found an workaround for that:    When i enable masquarade via: "nft add rule inet nat POSTROUTING iifname "eth0" masquerade" then it works again. But netclient flushes all nft rules every XX Hours, then it again stopes working :-(  I also get this Log Output:  Jul 10 14:14:30 WBG-NM-NODE01 netclient[302]: [netclient] 2026-07-10 14:14:30 InsertEgressRoutingRules called for egress f0dd

- **Issue #4084** (2026-07-20): **[Bug]: Can't create admin user in self-hosted setup**
  *Symptoms*: ### Contact Details  _No response_  ### What happened?  After successful setup I'm unable to create first user. I'm following https://docs.netmaker.io/docs/server-installation/quick-install and log in part says:  `On the login screen, use the initial admin credentials created during installation.`  but the installation process does not display or ask for any credentials. I tried:  nmctl user create --admin --name admin --password password  2026/07/11 15:28:08 Error Status: 400 Response: {"Code":400,"Message":"record not found","Response":null}  nmctl server has_admin 2026/07/11 15:28:33 Error Status: 404 Response: 404 page not found  Why can't I use nmctl? I specifically downloaded 1.6.0 version of nmctl. How can I crate the admin user?   ### Version  v1.6.0  ### What OS are you using?  Linux  ### Relevant log output  ```shell  ```  ### Contributing guidelines  - [x] Yes, I did.
  **Post-Mortem & Fix Analysis**:
  > Removing the user from db in  /var/lib/docker/volumes/netmaker_sqldata/_data/netmaker.db gave me the registration page again. 

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

### Incident Patch 1: `f66de90f` (2026-10-20)
**Commit Message**: Allow exit-node selection to replace an existing relay. (#4195)

* Allow exit-node selection to replace an existing relay.

Selecting an exit node was rejected when the device was already relayed by another gateway. AssignGateway already moves the node onto the exit routing node, so that check blocked the desktop app and the UI.

* NM-356: Add network_global_access so network-admin roles keep full network access.

After NM-378 dropped TenantGlobalAccess on network roles, gateway APIs 403'd for network admins because gateway was missing from the explicit ACL. A dedicated flag restores full in-network access for default and custom admin roles without reusing tenant_global_access.

**File**: `controllers/device.go` (modified, +0/-1)
```diff
@@ -327,7 +327,6 @@ func selectDeviceExitNode(w http.ResponseWriter, r *http.Request) {
 			"exit node cannot use another exit node",
 			"routing node cannot select itself as exit node",
 			"gateway nodes cannot be assigned an exit node",
-			"node is relayed by a different gateway",
 			"internet egress has no routing node",
 			"exit node selection is required":
 			errType = logic.BadReq
```

**File**: `controllers/node_exit_node.go` (modified, +1/-2)
```diff
@@ -127,8 +127,7 @@ func exitNodeErrType(err error) logic.ApiErrorType {
 		"exit node cannot use another exit node",
 		"routing node cannot select itself as exit node",
 		"internet egress has no routing node",
-		"gateway nodes cannot be assigned an exit node",
-		"node is relayed by a different gateway":
+		"gateway nodes cannot be assigned an exit node":
 		return logic.BadReq
 	default:
 		if strings.Contains(err.Error(), "does not have TCP proxy enabled") {
```

**File**: `logic/egress.go` (modified, +5/-9)
```diff
@@ -765,9 +765,8 @@ func validateInternetEgressSelection(
 	if node.IsGw || node.IsIngressGateway || node.IsRelay || node.IsInternetGateway || schemaNode.IsGateway {
 		return errors.New("gateway nodes cannot be assigned an exit node")
 	}
-	if schemaNode.RelayedByNodeID != nil && *schemaNode.RelayedByNodeID != "" && *schemaNode.RelayedByNodeID != routingNodeID {
-		return errors.New("node is relayed by a different gateway")
-	}
+	// Being RelayedBy a different gateway is allowed: AssignGateway removes the
+	// node from the previous relay and attaches it to the exit routing node.
 	return nil
 }
 
@@ -778,10 +777,8 @@ func clearNodeSelectedInternetEgress(ctx context.Context, node *models.Node, sch
 	}
 	schemaNode.SelectedInternetEgressID = ""
 
-	// Always drop exit RelayedBy / IsIGWClient when clearing selection. RelayedBy may
-	// still point at a deleted routing node while egress.Nodes already lists a new one;
-	// matching only FirstInternetEgressRoutingNodeID would leave a stale RelayedBy and
-	// block reassignment with "relayed by a different gateway".
+	// Always drop exit RelayedBy / IsIGWClient when clearing selection so the next
+	// exit selection starts from an unrelayed state.
 	schemaNode.RelayedByNodeID = nil
 	schemaNode.IsIGWClient = false
 	if err := schemaNode.UnassignGateway(ctx); err != nil {
@@ -1057,8 +1054,7 @@ func RebindInternetEgressClients(ctx context.Context, e schema.Egress) {
 	for i := range clients {
 		c := clients[i]
 		preserveTcpUplink := c.UseTcpUplink
-		// Drop RelayedBy to a removed/old routing node first; otherwise
-		// SetNodeSelectedInternetEgress rejects "relayed by a different gateway".
+		// Drop RelayedBy to a removed/old routing node first so rebind starts clean.
 		if err := failOpenExitClientKeepSelection(ctx, &c); err != nil {
 			slog.Error("RebindInternetEgressClients: fail-open failed", "node", c.ID, "error", err)
 			continue
```

**File**: `logic/exit_node_test.go` (modified, +14/-0)
```diff
@@ -135,3 +135,17 @@ func TestValidateInternetEgressSelection_ExitNodeCannotUseAnotherExitNode(t *tes
 		t.Fatalf("expected exit-node validation error, got %v", err)
 	}
 }
+
+func TestValidateInternetEgressSelection_AllowsRelayedByDifferentGateway(t *testing.T) {
+	node := &models.Node{}
+	node.ID = uuid.New()
+	node.Network = "net-1"
+	otherGw := uuid.NewString()
+	exitRouting := uuid.NewString()
+	schemaNode := &schema.Node{ID: node.ID.String(), RelayedByNodeID: &otherGw}
+
+	err := validateInternetEgressSelection(node, schemaNode, exitRouting, false)
+	if err != nil {
+		t.Fatalf("exit selection should unrelay and proceed, got %v", err)
+	}
+}
```

**File**: `logic/user_mgmt.go` (modified, +2/-0)
```diff
@@ -116,6 +116,8 @@ func GetAllRsrcIDForRsrc(rsrc schema.RsrcType) schema.RsrcID {
 		return schema.AllHostRsrcID
 	case schema.RelayRsrc:
 		return schema.AllRelayRsrcID
+	case schema.GatewayRsrc:
+		return schema.AllGatewayRsrcID
 	case schema.RemoteAccessGwRsrc:
 		return schema.AllRemoteAccessGwRsrcID
 	case schema.ExtClientsRsrc:
```

**File**: `pro/logic/security.go` (modified, +6/-1)
```diff
@@ -132,6 +132,11 @@ func checkNetworkAccessPermissions(ctx context.Context, netRoleID schema.UserRol
 	if networkPermissionScope.NetworkID != schema.AllNetworks && networkPermissionScope.NetworkID.String() != netID {
 		return errors.New("access denied")
 	}
+	// NetworkGlobalAccess grants full access within the role's network scope
+	// (default and custom network-admin roles). Distinct from TenantGlobalAccess.
+	if networkPermissionScope.NetworkGlobalAccess {
+		return nil
+	}
 	rsrcPermissionScope, ok := networkPermissionScope.NetworkLevelAccess.Data()[schema.RsrcType(targetRsrc)]
 	if !ok {
 		return errors.New("access denied")
@@ -373,7 +378,7 @@ func roleGrantsDeviceWrite(role *schema.UserRole) bool {
 	if role == nil {
 		return false
 	}
-	if role.TenantGlobalAccess {
+	if role.TenantGlobalAccess || role.NetworkGlobalAccess {
 		return true
 	}
 	access := role.NetworkLevelAccess.Data()
```

**File**: `pro/logic/security_test.go` (modified, +4/-1)
```diff
@@ -34,7 +34,10 @@ func TestIsDeviceAPIRequest(t *testing.T) {
 
 func TestRoleGrantsDeviceWrite(t *testing.T) {
 	if !roleGrantsDeviceWrite(&schema.UserRole{TenantGlobalAccess: true}) {
-		t.Fatal("full access should grant write")
+		t.Fatal("tenant global access should grant write")
+	}
+	if !roleGrantsDeviceWrite(&schema.UserRole{NetworkGlobalAccess: true}) {
+		t.Fatal("network global access should grant write")
 	}
 
 	readOnly := &schema.UserRole{
```

**File**: `pro/logic/user_mgmt.go` (modified, +19/-14)
```diff
@@ -62,6 +62,9 @@ func defaultNetworkAdminResourceAccess() schema.ResourceAccess {
 		schema.RelayRsrc: {
 			schema.AllRelayRsrcID: fullAccess,
 		},
+		schema.GatewayRsrc: {
+			schema.AllGatewayRsrcID: fullAccess,
+		},
 		schema.RemoteAccessGwRsrc: {
 			schema.AllRemoteAccessGwRsrcID: schema.RsrcPermissionScope{
 				Create: true, Read: true, Update: true, Delete: true, VPNaccess: true,
@@ -113,13 +116,14 @@ func defaultNetworkAdminResourceAccess() schema.ResourceAccess {
 }
 
 var NetworkAdminAllPermissionTemplate = schema.UserRole{
-	Slug:               globalNetworksAdminRoleID,
-	Name:               "Network Admins",
-	MetaData:           "can manage configuration of all networks",
-	Default:            true,
-	TenantGlobalAccess: false,
-	NetworkID:          schema.AllNetworks,
-	NetworkLevelAccess: datatypes.NewJSONType(defaultNetworkAdminResourceAccess()),
+	Slug:                globalNetworksAdminRoleID,
+	Name:                "Network Admins",
+	MetaData:            "can manage configuration of all networks",
+	Default:             true,
+	TenantGlobalAccess:  false,
+	NetworkGlobalAccess: true,
+	NetworkID:           schema.AllNetworks,
+	NetworkLevelAccess:  datatypes.NewJSONType(defaultNetworkAdminResourceAccess()),
 }
 
 var NetworkUserAllPermissionTemplate = schema.UserRole{
@@ -256,13 +260,14 @@ func CreateDefaultNetworkRolesAndGroups(ctx context.Context, netID schema.Networ
 		return
 	}
 	var NetworkAdminPermissionTemplate = schema.UserRole{
-		Slug:               GetDefaultNetworkAdminRoleID(netID),
-		Name:               fmt.Sprintf("%s Admin", netID),
-		MetaData:           fmt.Sprintf("can manage your network `%s` configuration.", netID),
-		Default:            true,
-		NetworkID:          netID,
-		TenantGlobalAccess: false,
-		NetworkLevelAccess: datatypes.NewJSONType(defaultNetworkAdminResourceAccess()),
+		Slug:                GetDefaultNetworkAdminRoleID(netID),
+		Name:                fmt.Sprintf("%s Admin", netID),
+		MetaData:            fmt.Sprintf("can manage your network `%s` configuration.", netID),
+		Default:             true,
+		NetworkID:           netID,
+		TenantGlobalAccess:  false,
+		NetworkGlobalAccess: true,
+		NetworkLevelAccess:  datatypes.NewJSONType(defaultNetworkAdminResourceAccess()),
 	}
 
 	var NetworkUserPermissionTemplate = schema.UserRole{
```

#### Recent Merged Pull Requests:
- **PR #4196** (closed): Revert "Fixes: Auto Select Gateway" (@abhishek9686)
- **PR #4195** (2026-10-20): Allow exit-node selection to replace an existing relay. (@abhishek9686)
- **PR #4194** (2026-10-19): Ensure email usernames are lower-case (@VishalDalwadi)
- **PR #4193** (2026-10-19): V1.7.0 develop merge  (@abhishek9686)
- **PR #4192** (2026-10-19): Derive AES Key using ECDH (@VishalDalwadi)
- **PR #4191** (2026-10-19): Lower-case emails when checking invites (@VishalDalwadi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
