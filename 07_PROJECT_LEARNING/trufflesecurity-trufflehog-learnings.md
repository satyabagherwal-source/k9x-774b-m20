# Forensic Learning Record (Deep Inspection): trufflesecurity/trufflehog

> **Canonical Artifact**: `07_PROJECT_LEARNING/trufflesecurity-trufflehog-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/trufflesecurity/trufflehog](https://github.com/trufflesecurity/trufflehog))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T17:48:38.195Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `trufflesecurity/trufflehog`
- **Description**: Find, verify, and analyze leaked credentials
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 28290 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `pkg/common/utils.go`
```
package common

import (
	"bufio"
	"crypto/rand"
	"io"
	"math/big"
	mrand "math/rand"
	"strings"
)

func AddStringSliceItem(item string, slice *[]string) {
	for _, i := range *slice {
		if i == item {
			return
		}
	}
	*slice = append(*slice, item)
}

func RemoveStringSliceItem(item string, slice *[]string) {
	for i, listItem := range *slice {
		if item == listItem {
			(*slice)[i] = (*slice)[len(*slice)-1]
			*slice = (*slice)[:len(*slice)-1]
		}
	}
}

func ResponseContainsSubstring(reader io.ReadCloser, target string) (bool, error) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		if strings.Contains(scanner.Text(), target) {
			return true, nil
		}
	}
	if err := scanner.Err(); err != nil {
		return false, err
	}
	return false, nil
}

var letters = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")

// RandomID returns a random string of the given length.
func RandomID(length int) string {
	b := make([]rune, length)
	for i := range b {
		randInt, _ := rand.Int(rand.Reader, big.NewInt(int64(len(letters))))
		b[i] = letters[randInt.Int64()]
	}

	return string(b)
}

// SliceContainsString searches a slice to determine if it contains a specified string.
// Returns the index of the first match in the slice.
func SliceContainsString(origTargetString string, stringSlice []string, ignoreCase bool) (bool, string, int) {
	targetString := origTargetString
	if ignoreCase {
		targetString = strings.ToLower(origTargetString)
	}
	for i, origStringFromSlice := range stringSlice {
		stringFromSlice := origStringFromSlice
		if ignoreCase {
			stringFromSlice = strings.ToLower(origStringFromSlice)
		}
		if targetString == stringFromSlice {
			return true, targetString, i
		}
	}
	return false, "", 0
}

// GoFakeIt Password generator does not guarantee inclusion of characters.
// Using a custom random password generator with guaranteed inclusions (atleast) of lower, upper, numeric and special characters
func GenerateRandomPassword(lower, upper, numeric, special bool, length int) string {
	if length < 1 {
		return ""
	}

	var password []rune
	var required []rune
	var allowed []rune

	lowerChars := []rune("abcdefghijklmnopqrstuvwxyz")
	upperChars := []rune("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
	specialChars := []rune("!@#$%^&*()-_=+[]{}|;:',.<>?/")
	numberChars := []rune("0123456789")

	// Ensure inclusion from each requested category
	if lower {
		rand, _ := rand.Int(rand.Reader, big.NewInt(int64(len(lowerChars))))
		ch := lowerChars[rand.Int64()]
		required = append(required, ch)
		allowed = append(allowed, lowerChars...)
	}
	if upper {
		rand, _ := rand.Int(rand.Reader, big.NewInt(int64(len(upperChars))))
		ch := upperChars[rand.Int64()]
		required = append(required, ch)
		allowed = append(allowed, upperChars...)
	}
	if numeric {
		rand, _ := rand.Int(rand.Reader, big.NewInt(int64(len(numberChars))))
		ch := numberChars[rand.Int64()]
		required = append(required, ch)
		allowed = append(allowed, numberChars...)
	}
	if special {
		rand, _ := rand.Int(rand.Reader, big.NewInt(int64(len(specialChars))))
		ch := specialChars[rand.Int64()]
		required = append(required, ch)
		allowed = append(allowed, specialChars...)
	}

	if len(allowed) == 0 {
		return "" // No character sets enabled
	}

	// Fill the rest of the password
	for i := 0; i < length-len(required); i++ {
		rand, _ := rand.Int(rand.Reader, big.NewInt(int64(len(allowed))))
		ch := allowed[rand.Int64()]
		password = append(password, ch)
	}

	// Combine required and random characters, then shuffle
	password = append(password, required...)
	mrand.Shuffle(len(password), func(i, j int) {
		password[i], password[j] = password[j], password[i]
	})

	return string(password)
}

```

### Core Architecture Module: `pkg/detectors/aws/utils.go`
```
package aws

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base32"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"strings"

	regexp "github.com/wasilibs/go-re2"

	"github.com/trufflesecurity/trufflehog/v3/pkg/detectors"
)

// ResourceTypes derived from: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_identifiers.html#identifiers-unique-ids
var ResourceTypes = map[string]string{
	"ABIA": "AWS STS service bearer token",
	"ACCA": "Context-specific credential",
	"AGPA": "User group",
	"AIDA": "IAM user",
	"AIPA": "Amazon EC2 instance profile",
	"AKIA": "Access key",
	"ANPA": "Managed policy",
	"ANVA": "Version in a managed policy",
	"APKA": "Public key",
	"AROA": "Role",
	"ASCA": "Certificate",
	"ASIA": "Temporary (AWS STS) access key IDs",
}

// UrlEncodedReplacer helps capture base64-encoded results that may be url-encoded.
// TODO: Add this as a decoder, or make it a more generic.
var UrlEncodedReplacer = strings.NewReplacer(
	"%2B", "+",
	"%2b", "+",
	"%2F", "/",
	"%2f", "/",
	"%3d", "=",
	"%3D", "=",
)

// Hashes, like those for git, do technically match the secret pattern.
// But they are extremely unlikely to be generated as an actual AWS secret.
// So when we find them, if they're not verified, we should ignore the result.
var FalsePositiveSecretPat = regexp.MustCompile(`[a-f0-9]{40}`)

func GetAccountNumFromID(id string) (string, error) {
	// Function to get the account number from an AWS ID (no verification required)
	// Source: https://medium.com/@TalBeerySec/a-short-note-on-aws-key-id-f88cc4317489
	if len(id) < 4 {
		return "", fmt.Errorf("AWSID is too short")
	}
	if id[4] == 'I' || id[4] == 'J' {
		return "", fmt.Errorf("can't get account number from AKIAJ/ASIAJ or AKIAI/ASIAI keys")
	}
	trimmedAWSID := id[4:]
	decodedBytes, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(trimmedAWSID))
	if err != nil {
		return "", err
	}

	if len(decodedBytes) < 6 {
		return "", fmt.Errorf("decoded AWSID is too short")
	}

	data := make([]byte, 8)
	copy(data[2:], decodedBytes[0:6])
	z := binary.BigEndian.Uint64(data)
	const mask uint64 = 0x7fffffffff80
	accountNum := (z & mask) >> 7
	return fmt.Sprintf("%012d", accountNum), nil
}

func GetHash(input string) string {
	data := []byte(input)
	hasher := sha256.New()
	hasher.Write(data)
	return hex.EncodeToString(hasher.Sum(nil))
}

func GetHMAC(key []byte, data []byte) []byte {
	hasher := hmac.New(sha256.New, key)
	hasher.Write(data)
	return hasher.Sum(nil)
}

func CleanResults(results []detectors.Result, verificationEnabled bool) []detectors.Result {
	if len(results) == 0 {
		return results
	}
	if !verificationEnabled {
		return results
	}
	// For every ID, we want at most one result, preferably verified.
	idResults := map[string]detectors.Result{}
	for _, result := range results {
		// Always accept the verified result as the result for the given ID.
		if result.Verified {
			idResults[result.Redacted] = result
			continue
		}

		// Only include an unverified result if we don't already have a result for a given ID.
		if _, exist := idResults[result.Redacted]; !exist {
			idResults[result.Redacted] = result
		}
	}

	var out []detectors.Result
	for _, r := range idResults {
		out = append(out, r)
	}
	return out
}

```

### Core Architecture Module: `pkg/detectors/discordwebhook/discordwebhook.go`
```
package discordwebhook

import (
	"context"
	"net/http"
	"strings"

	regexp "github.com/wasilibs/go-re2"

	"github.com/trufflesecurity/trufflehog/v3/pkg/detectors"
	"github.com/trufflesecurity/trufflehog/v3/pkg/pb/detector_typepb"
)

type Scanner struct{}

// Ensure the Scanner satisfies the interface at compile time.
var _ detectors.Detector = (*Scanner)(nil)

var (
	client = detectors.DetectorHttpClientWithNoLocalAddresses

	// Make sure that your group is surrounded in boundary characters such as below to reduce false positives.
	keyPat = regexp.MustCompile(`(https:\/\/discord\.com\/api\/webhooks\/[0-9]{18,19}\/[0-9a-zA-Z-]{68})`)
)

// Keywords are used for efficiently pre-filtering chunks.
// Use identifiers in the secret preferably, or the provider name.
func (s Scanner) Keywords() []string { return []string{"https://discord.com/api/webhooks/"} }

// FromData will find and optionally verify DiscordWebhook secrets in a given set of bytes.
func (s Scanner) FromData(ctx context.Context, verify bool, data []byte) (results []detectors.Result, err error) {
	dataStr := string(data)

	matches := keyPat.FindAllStringSubmatch(dataStr, -1)

	for _, match := range matches {
		resMatch := strings.TrimSpace(match[1])
		s1 := detectors.Result{
			DetectorType: detector_typepb.DetectorType_DiscordWebhook,
			Raw:          []byte(resMatch),
			SecretParts:  map[string]string{"key": resMatch},
		}

		if verify {
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, resMatch, nil)
			if err != nil {
				continue
			}
			res, err := client.Do(req)
			if err == nil {
				defer func() { _ = res.Body.Close() }()
				if res.StatusCode >= 200 && res.StatusCode < 300 {
					s1.Verified = true
				}
			}
		}

		results = append(results, s1)
	}

	return results, nil
}

func (s Scanner) Type() detector_typepb.DetectorType {
	return detector_typepb.DetectorType_DiscordWebhook
}

func (s Scanner) Description() string {
	return "Discord webhooks are used to send messages to a Discord channel. They can be used to automate messages and send data updates."
}

```

### Core Architecture Module: `pkg/detectors/microsoftteamswebhook/v1/microsoftteamswebhook.go`
```
package microsoftteamswebhook

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	regexp "github.com/wasilibs/go-re2"

	"github.com/trufflesecurity/trufflehog/v3/pkg/detectors"
	"github.com/trufflesecurity/trufflehog/v3/pkg/pb/detector_typepb"
)

type Scanner struct {
	client *http.Client
	detectors.DefaultMultiPartCredentialProvider
}

// Ensure the Scanner satisfies the interface at compile time.
var _ detectors.Detector = (*Scanner)(nil)
var _ detectors.Versioner = (*Scanner)(nil)

func (s Scanner) Version() int { return 1 }

var (
	defaultClient = detectors.DetectorHttpClientWithNoLocalAddresses

	// Make sure that your group is surrounded in boundary characters such as below to reduce false positives.
	keyPat = regexp.MustCompile(`(https:\/\/[a-zA-Z-0-9]+\.webhook\.office\.com\/webhookb2\/[a-zA-Z-0-9]{8}-[a-zA-Z-0-9]{4}-[a-zA-Z-0-9]{4}-[a-zA-Z-0-9]{4}-[a-zA-Z-0-9]{12}\@[a-zA-Z-0-9]{8}-[a-zA-Z-0-9]{4}-[a-zA-Z-0-9]{4}-[a-zA-Z-0-9]{4}-[a-zA-Z-0-9]{12}\/IncomingWebhook\/[a-zA-Z-0-9]{32}\/[a-zA-Z-0-9]{8}-[a-zA-Z-0-9]{4}-[a-zA-Z-0-9]{4}-[a-zA-Z-0-9]{4}-[a-zA-Z-0-9]{12})`)
)

// Keywords are used for efficiently pre-filtering chunks.
// Use identifiers in the secret preferably, or the provider name.
func (s Scanner) Keywords() []string {
	return []string{"webhook.office.com"}
}

// FromData will find and optionally verify MicrosoftTeamsWebhook secrets in a given set of bytes.
func (s Scanner) FromData(ctx context.Context, verify bool, data []byte) (results []detectors.Result, err error) {
	dataStr := string(data)

	matches := keyPat.FindAllStringSubmatch(dataStr, -1)

	for _, match := range matches {
		resMatch := strings.TrimSpace(match[1])

		s1 := detectors.Result{
			DetectorType: detector_typepb.DetectorType_MicrosoftTeamsWebhook,
			Raw:          []byte(resMatch),
			SecretParts:  map[string]string{"key": resMatch},
		}
		s1.ExtraData = map[string]string{
			"rotation_guide": "https://howtorotate.com/docs/tutorials/microsoftteams/",
			"version":        fmt.Sprintf("%d", s.Version()),
		}

		if verify {
			client := s.client
			if client == nil {
				client = defaultClient
			}

			isVerified, verificationErr := verifyWebhook(ctx, client, resMatch)
			s1.Verified = isVerified
			s1.SetVerificationError(verificationErr, resMatch)
		}

		results = append(results, s1)
	}

	return results, nil
}

func verifyWebhook(ctx context.Context, client *http.Client, webhookURL string) (bool, error) {
	payload := strings.NewReader(`{'text':''}`)
	req, err := http.NewRequestWithContext(ctx, "POST", webhookURL, payload)
	if err != nil {
		return false, err
	}
	req.Header.Add("Content-Type", "application/json")

	res, err := client.Do(req)
	if err != nil {
		return false, err
	}
	defer func() { _ = res.Body.Close() }()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return false, err
	}

	switch {
	case res.StatusCode == http.StatusBadRequest:
		if strings.Contains(string(body), "Text is required") {
			return true, nil
		}
		return false, fmt.Errorf("unexpected response body: %s", string(body))
	case res.StatusCode < 200 || res.StatusCode >= 500:
		return false, fmt.Errorf("unexpected HTTP response status: %d", res.StatusCode)
	default:
		return false, nil
	}
}

func (s Scanner) Type() detector_typepb.DetectorType {
	return detector_typepb.DetectorType_MicrosoftTeamsWebhook
}

func (s Scanner) Description() string {
	return "Microsoft Teams Webhooks allow external services to communicate with Teams channels by sending messages to a unique URL."
}

```

### Core Architecture Module: `pkg/detectors/microsoftteamswebhook/v2/microsoftteamswebhook.go`
```
package microsoftteamswebhook

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	regexp "github.com/wasilibs/go-re2"

	"github.com/trufflesecurity/trufflehog/v3/pkg/detectors"
	"github.com/trufflesecurity/trufflehog/v3/pkg/pb/detector_typepb"
)

type Scanner struct {
	client *http.Client
}

var _ detectors.Detector = (*Scanner)(nil)
var _ detectors.Versioner = (*Scanner)(nil)
var _ detectors.CustomFalsePositiveChecker = (*Scanner)(nil)

func (s Scanner) Version() int { return 2 }

var (
	defaultClient = detectors.DetectorHttpClientWithNoLocalAddresses

	// urlPat matches the base Power Automate webhook URL plus its query string.
	// The path is matched strictly; the query string is matched loosely so that
	// parameter ordering changes in the future do not break detection.
	// Example: https://default<envId>.<region>.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/<workflowId>/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=<sig>
	urlPat = regexp.MustCompile(`https://[a-z0-9]+\.\d+\.environment\.api\.powerplatform\.com(?::\d+)?/powerautomate/automations/direct/workflows/[a-f0-9]{32}/triggers/manual/paths/invoke\?[^\s"'<>]+`)

	// sigPat extracts the sig parameter value from anywhere in the query string.
	sigPat = regexp.MustCompile(`[?&]sig=([A-Za-z0-9_\-]+)`)
)

func (s Scanner) Keywords() []string {
	return []string{"environment.api.powerplatform.com"}
}

func (s Scanner) FromData(ctx context.Context, verify bool, data []byte) (results []detectors.Result, err error) {
	dataStr := string(data)

	uniqueMatches := make(map[string]struct{})
	for _, urlMatch := range urlPat.FindAllString(dataStr, -1) {
		// sig is the signing key that authenticates the request; without it the URL is not a valid credential.
		if sigPat.MatchString(urlMatch) {
			uniqueMatches[strings.TrimSpace(urlMatch)] = struct{}{}
		}
	}

	for secret := range uniqueMatches {
		r := detectors.Result{
			DetectorType: detector_typepb.DetectorType_MicrosoftTeamsWebhook,
			Raw:          []byte(secret),
			SecretParts:  map[string]string{"key": secret},
			ExtraData: map[string]string{
				"version": fmt.Sprintf("%d", s.Version()),
			},
		}

		if verify {
			client := s.client
			if client == nil {
				client = defaultClient
			}
			isVerified, verificationErr := verifyWebhook(ctx, client, secret)
			r.Verified = isVerified
			r.SetVerificationError(verificationErr, secret)
		}

		results = append(results, r)
	}
	return results, nil
}

// verifyWebhook sends a POST request to the webhook URL to verify it is active.
// A 202 response indicates the credential is valid; 400 means the webhook is disabled
// or deleted; 401 means unauthorized.
// The payload sends an empty text and intentionally omits the "type" field so the Power Automate flow accepts
// the request (returning 202) but does not deliver any message to the Teams channel.
func verifyWebhook(ctx context.Context, client *http.Client, webhookURL string) (bool, error) {
	payload := strings.NewReader(`{"text":""}`)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, webhookURL, payload)
	if err != nil {
		return false, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := client.Do(req)
	if err != nil {
		return false, fmt.Errorf("failed to make request: %w", err)
	}
	defer func() {
		_, _ = io.Copy(io.Discard, res.Body)
		_ = res.Body.Close()
	}()

	switch res.StatusCode {
	case http.StatusAccepted:
		return true, nil
	case http.StatusUnauthorized, http.StatusBadRequest:
		return false, nil
	default:
		return false, fmt.Errorf("unexpected HTTP response status %d", res.StatusCode)
	}
}

// IsFalsePositive implements detectors.CustomFalsePositiveChecker.
// The raw value is a full webhook URL, not a short token, so wordlist-based
// false positive detection is not applicable.
func (s Scanner) IsFalsePositive(_ detectors.Result) (bool, string) {
	return false, ""
}

func (s Scanner) Type() detector_typepb.DetectorType {
	return detector_typepb.DetectorType_MicrosoftTeamsWebhook
}

func (s Scanner) Description() string {
	return "Microsoft Teams Webhooks (Power Automate) allow external services to communicate with Teams channels by sending messages to a unique Power Automate workflow URL."
}

```

### Core Architecture Module: `pkg/detectors/overloop/overloop.go`
```
package overloop

import (
	"context"
	"fmt"
	regexp "github.com/wasilibs/go-re2"
	"net/http"
	"strings"

	"github.com/trufflesecurity/trufflehog/v3/pkg/common"
	"github.com/trufflesecurity/trufflehog/v3/pkg/detectors"
	"github.com/trufflesecurity/trufflehog/v3/pkg/pb/detector_typepb"
)

type Scanner struct {
	client *http.Client
}

// Ensure the Scanner satisfies the interface at compile time.
var _ detectors.Detector = (*Scanner)(nil)

var (
	defaultClient = common.SaneHttpClient()
	// Make sure that your group is surrounded in boundary characters such as below to reduce false positives.
	keyPat = regexp.MustCompile(detectors.PrefixRegex([]string{"overloop"}) + `\b([a-zA-Z\_\-0-9]{50})\b`)
)

// Keywords are used for efficiently pre-filtering chunks.
// Use identifiers in the secret preferably, or the provider name.
func (s Scanner) Keywords() []string {
	return []string{"overloop"}
}

// FromData will find and optionally verify Overloop secrets in a given set of bytes.
func (s Scanner) FromData(ctx context.Context, verify bool, data []byte) (results []detectors.Result, err error) {
	dataStr := string(data)

	matches := keyPat.FindAllStringSubmatch(dataStr, -1)

	for _, match := range matches {
		resMatch := strings.TrimSpace(match[1])

		s1 := detectors.Result{
			DetectorType: detector_typepb.DetectorType_Overloop,
			Raw:          []byte(resMatch),
			SecretParts:  map[string]string{"key": resMatch},
		}

		if verify {
			client := s.client
			if client == nil {
				client = defaultClient
			}
			req, err := http.NewRequestWithContext(ctx, "GET", "https://api.overloop.com/public/v1/users", nil)
			if err != nil {
				continue
			}
			req.Header.Set("Authorization", resMatch)
			res, err := client.Do(req)
			if err == nil {
				defer func() { _ = res.Body.Close() }()
				if res.StatusCode >= 200 && res.StatusCode < 300 {
					s1.Verified = true
				} else if res.StatusCode == 401 {
					// The secret is determinately not verified (nothing to do)
				} else {
					err = fmt.Errorf("unexpected HTTP response status %d", res.StatusCode)
					s1.SetVerificationError(err, resMatch)
				}
			} else {
				s1.SetVerificationError(err, resMatch)
			}
		}

		results = append(results, s1)
	}

	return results, nil
}

func (s Scanner) Type() detector_typepb.DetectorType {
	return detector_typepb.DetectorType_Overloop
}

func (s Scanner) Description() string {
	return "Overloop is a service that provides API keys for accessing its platform. These keys can be used to interact with the Overloop API to manage and retrieve user data."
}

```

### Core Architecture Module: `pkg/detectors/pandascore/pandascore.go`
```
package pandascore

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	regexp "github.com/wasilibs/go-re2"

	"github.com/trufflesecurity/trufflehog/v3/pkg/common"
	"github.com/trufflesecurity/trufflehog/v3/pkg/detectors"
	"github.com/trufflesecurity/trufflehog/v3/pkg/pb/detector_typepb"
)

type Scanner struct{}

// Ensure the Scanner satisfies the interface at compile time.
var _ detectors.Detector = (*Scanner)(nil)

var (
	client = common.SaneHttpClient()

	// Make sure that your group is surrounded in boundary characters such as below to reduce false positives.
	keyPat = regexp.MustCompile(detectors.PrefixRegex([]string{"pandascore"}) + `([ \r\n]{0,1}[0-9A-Za-z\-\_]{51}[ \r\n]{1})`)
)

// Keywords are used for efficiently pre-filtering chunks.
// Use identifiers in the secret preferably, or the provider name.
func (s Scanner) Keywords() []string {
	return []string{"pandascore"}
}

// FromData will find and optionally verify PandaScore secrets in a given set of bytes.
func (s Scanner) FromData(ctx context.Context, verify bool, data []byte) (results []detectors.Result, err error) {
	dataStr := string(data)

	matches := keyPat.FindAllStringSubmatch(dataStr, -1)

	for _, match := range matches {
		resMatch := strings.TrimSpace(match[1])

		s1 := detectors.Result{
			DetectorType: detector_typepb.DetectorType_PandaScore,
			Raw:          []byte(resMatch),
			SecretParts:  map[string]string{"key": resMatch},
		}

		if verify {
			req, err := http.NewRequestWithContext(ctx, "GET", "https://api.pandascore.co/videogames", nil)
			if err != nil {
				continue
			}
			req.Header.Add("Accept", "application/json")
			req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", resMatch))
			res, err := client.Do(req)
			if err == nil {
				defer func() { _ = res.Body.Close() }()
				if res.StatusCode >= 200 && res.StatusCode < 300 {
					s1.Verified = true
				} else {
					s1.Verified = false
				}
			}
		}

		results = append(results, s1)
	}

	return results, nil
}

func (s Scanner) Type() detector_typepb.DetectorType {
	return detector_typepb.DetectorType_PandaScore
}

func (s Scanner) Description() string {
	return "PandaScore is an esports data provider offering a wide range of statistics and live data for various video games. PandaScore API keys can be used to access and retrieve this data."
}

```

### Core Architecture Module: `pkg/detectors/slackwebhook/slackwebhook.go`
```
package slackwebhook

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/trufflesecurity/trufflehog/v3/pkg/detectors"
	"github.com/trufflesecurity/trufflehog/v3/pkg/pb/detector_typepb"
	regexp "github.com/wasilibs/go-re2"
)

type Scanner struct {
	client *http.Client
	detectors.DefaultMultiPartCredentialProvider
}

// Ensure the Scanner satisfies the interface at compile time.
var _ detectors.Detector = (*Scanner)(nil)
var _ detectors.CustomFalsePositiveChecker = (*Scanner)(nil)

var (
	defaultClient = detectors.DetectorHttpClientWithNoLocalAddresses
	// Make sure that your group is surrounded in boundary characters such as below to reduce false positives.
	keyPats = map[string]*regexp.Regexp{
		"Slack Service Web Hook":   regexp.MustCompile(`(https://hooks\.slack\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]{23,25})`),
		"Slack Workflow Web Hook ": regexp.MustCompile(`(https://hooks\.slack\.com/workflows/T[A-Z0-9]+/A[A-Z0-9]+/[0-9]{17,19}/[A-Za-z0-9]{23,25})`),
	}
)

// Keywords are used for efficiently pre-filtering chunks.
// Use identifiers in the secret preferably, or the provider name.
func (s Scanner) Keywords() []string {
	return []string{"hooks.slack.com"}
}

// FromData will find and optionally verify SlackWebhook secrets in a given set of bytes.
func (s Scanner) FromData(ctx context.Context, verify bool, data []byte) (results []detectors.Result, err error) {
	dataStr := string(data)

	for _, keyPat := range keyPats {
		matches := keyPat.FindAllStringSubmatch(dataStr, -1)

		for _, match := range matches {
			resMatch := strings.TrimSpace(match[1])

			s1 := detectors.Result{
				DetectorType: detector_typepb.DetectorType_SlackWebhook,
				Raw:          []byte(resMatch),
				SecretParts:  map[string]string{"key": resMatch},
			}
			s1.ExtraData = map[string]string{
				"rotation_guide": "https://howtorotate.com/docs/tutorials/slack-webhook/",
			}

			if verify {

				client := s.client
				if client == nil {
					client = defaultClient
				}

				isVerified, verificationErr := verifyMatch(ctx, client, resMatch)
				s1.Verified = isVerified
				s1.SetVerificationError(verificationErr, resMatch)
			}

			results = append(results, s1)
		}
	}

	return results, nil
}

func verifyMatch(ctx context.Context, client *http.Client, resMatch string) (bool, error) {
	// We don't want to actually send anything to webhooks we find. To verify them without spamming them, we
	// send an intentionally malformed message and look for a particular expected error message.
	payload := strings.NewReader(`intentionally malformed JSON from TruffleHog scan`)
	req, err := http.NewRequestWithContext(ctx, "POST", resMatch, payload)
	if err != nil {
		return false, err
	}
	req.Header.Add("Content-Type", "application/json")

	res, err := client.Do(req)
	if err != nil {
		return false, err
	}
	defer func() { _ = res.Body.Close() }()

	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return false, err
	}

	switch {
	case res.StatusCode >= http.StatusOK && res.StatusCode < http.StatusMultipleChoices:
		// Hopefully this never happens - it means we actually sent something to a channel somewhere. But
		// we at least know the secret is verified.
		return true, nil
	case res.StatusCode == http.StatusBadRequest && bytes.Equal(bodyBytes, []byte("invalid_payload")):
		return true, nil
	case res.StatusCode == http.StatusBadRequest && bytes.Contains(bodyBytes, []byte("invalid_token")):
		// Slack may return the bare error code or embed it in a longer body, hence Contains not Equal.
		// Revoked webhook / gone workspace or channel is determinate verified=false.
		return false, nil
	case res.StatusCode == http.StatusNotFound || res.StatusCode == http.StatusForbidden:
		// Not a real webhook or the owning app's OAuth token has been revoked or the app has been deleted
		// You might want to handle this case or log it.
		return false, nil
	default:
		return false, fmt.Errorf("unexpected HTTP response status %d: %s", res.StatusCode, bodyBytes)
	}
}

func (s Scanner) Type() detector_typepb.DetectorType {
	return detector_typepb.DetectorType_SlackWebhook
}

func (s Scanner) Description() string {
	return "Slack webhooks are used to send messages from external sources into Slack channels. If compromised, they can be used to send unauthorized messages."
}

func (s Scanner) IsFalsePositive(result detectors.Result) (bool, string) {
	// ignore "https:" as a false positive for slack webhook detector
	if strings.Contains(string(result.Raw), "https:") {
		return false, ""
	}

	// back to the default false positive checks
	return detectors.IsKnownFalsePositive(string(result.Raw), detectors.DefaultFalsePositives, true)

}

```

### Core Architecture Module: `pkg/detectors/tineswebhook/tineswebhook.go`
```
package tineswebhook

import (
	"context"
	"net/http"
	"strings"

	regexp "github.com/wasilibs/go-re2"

	"github.com/trufflesecurity/trufflehog/v3/pkg/detectors"
	"github.com/trufflesecurity/trufflehog/v3/pkg/pb/detector_typepb"
)

type Scanner struct{}

// Ensure the Scanner satisfies the interface at compile time.
var _ detectors.Detector = (*Scanner)(nil)

var (
	client = detectors.DetectorHttpClientWithNoLocalAddresses

	// Make sure that your group is surrounded in boundary characters such as below to reduce false positives.
	keyPat = regexp.MustCompile(`(https://[\w-]+\.tines\.com/webhook/[a-z0-9]{32}/[a-z0-9]{32})`)
)

// Keywords are used for efficiently pre-filtering chunks.
// Use identifiers in the secret preferably, or the provider name.
func (s Scanner) Keywords() []string {
	return []string{"tines.com"}
}

// FromData will find and optionally verify TinesWebhook secrets in a given set of bytes.
func (s Scanner) FromData(ctx context.Context, verify bool, data []byte) (results []detectors.Result, err error) {
	dataStr := string(data)

	matches := keyPat.FindAllStringSubmatch(dataStr, -1)

	for _, match := range matches {
		resMatch := strings.TrimSpace(match[1])

		s1 := detectors.Result{
			DetectorType: detector_typepb.DetectorType_TinesWebhook,
			Raw:          []byte(resMatch),
			SecretParts:  map[string]string{"key": resMatch},
		}

		if verify {
			payload := strings.NewReader(``)
			req, err := http.NewRequestWithContext(ctx, "GET", resMatch, payload)
			if err != nil {
				continue
			}
			res, err := client.Do(req)
			if err == nil {
				defer func() { _ = res.Body.Close() }()
				if res.StatusCode >= 200 && res.StatusCode < 300 {
					s1.Verified = true
				}
			}
		}

		results = append(results, s1)
	}

	return results, nil
}

func (s Scanner) Type() detector_typepb.DetectorType {
	return detector_typepb.DetectorType_TinesWebhook
}

func (s Scanner) Description() string {
	return "Tines is an automation platform. Tines Webhook URLs can be used to trigger and interact with Tines workflows."
}

```

### Core Architecture Module: `pkg/detectors/walkscore/walkscore.go`
```
package walkscore

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	regexp "github.com/wasilibs/go-re2"

	"github.com/trufflesecurity/trufflehog/v3/pkg/common"
	"github.com/trufflesecurity/trufflehog/v3/pkg/detectors"
	"github.com/trufflesecurity/trufflehog/v3/pkg/pb/detector_typepb"
)

type Scanner struct{}

// Ensure the Scanner satisfies the interface at compile time.
var _ detectors.Detector = (*Scanner)(nil)

var (
	client = common.SaneHttpClient()

	// Make sure that your group is surrounded in boundary characters such as below to reduce false positives.
	keyPat = regexp.MustCompile(detectors.PrefixRegex([]string{"walkscore"}) + `\b([0-9a-z]{32})\b`)
)

// Keywords are used for efficiently pre-filtering chunks.
// Use identifiers in the secret preferably, or the provider name.
func (s Scanner) Keywords() []string {
	return []string{"walkscore"}
}

// FromData will find and optionally verify Walkscore secrets in a given set of bytes.
func (s Scanner) FromData(ctx context.Context, verify bool, data []byte) (results []detectors.Result, err error) {
	dataStr := string(data)

	matches := keyPat.FindAllStringSubmatch(dataStr, -1)

	for _, match := range matches {
		resMatch := strings.TrimSpace(match[1])

		s1 := detectors.Result{
			DetectorType: detector_typepb.DetectorType_WalkScore,
			Raw:          []byte(resMatch),
			SecretParts:  map[string]string{"key": resMatch},
		}

		if verify {
			isVerified, verificationErr := verifyMatch(ctx, client, resMatch)
			s1.Verified = isVerified
			s1.SetVerificationError(verificationErr, resMatch)
		}

		results = append(results, s1)
	}

	return results, nil
}

func verifyMatch(ctx context.Context, client *http.Client, resMatch string) (bool, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("https://transit.walkscore.com/transit/search/stops/?lat=47.6101359&lon=-122.3420567&wsapikey=%s", resMatch), nil)
	if err != nil {
		return false, err
	}
	req.Header.Add("Content-Type", "application/json")
	res, err := client.Do(req)
	if err != nil {
		return false, err
	}
	defer func() { _ = res.Body.Close() }()
	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return false, err
	}
	body := string(bodyBytes)
	if (res.StatusCode >= 200 && res.StatusCode < 300) && strings.Contains(body, `distance`) {
		return true, nil
	}

	return false, nil
}

func (s Scanner) Type() detector_typepb.DetectorType {
	return detector_typepb.DetectorType_WalkScore
}

func (s Scanner) Description() string {
	return "Walkscore API keys can be used to access Walkscore's services for retrieving walkability scores and related data."
}

```

### Core Architecture Module: `pkg/detectors/zapierwebhook/zapierwebhook.go`
```
package zapierwebhook

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	regexp "github.com/wasilibs/go-re2"

	"github.com/trufflesecurity/trufflehog/v3/pkg/detectors"
	"github.com/trufflesecurity/trufflehog/v3/pkg/pb/detector_typepb"
)

type Scanner struct{}

// Ensure the Scanner satisfies the interface at compile time.
var _ detectors.Detector = (*Scanner)(nil)

var (
	client = detectors.DetectorHttpClientWithNoLocalAddresses

	// Make sure that your group is surrounded in boundary characters such as below to reduce false positives.
	keyPat = regexp.MustCompile(`(https:\/\/hooks\.zapier\.com\/hooks\/catch\/[A-Za-z0-9\/]{16})`)
)

// Keywords are used for efficiently pre-filtering chunks.
// Use identifiers in the secret preferably, or the provider name.
func (s Scanner) Keywords() []string {
	return []string{"hooks.zapier.com/hooks/catch/"}
}

// FromData will find and optionally verify ZapierWebhook secrets in a given set of bytes.
func (s Scanner) FromData(ctx context.Context, verify bool, data []byte) (results []detectors.Result, err error) {
	dataStr := string(data)

	matches := keyPat.FindAllStringSubmatch(dataStr, -1)

	for _, match := range matches {
		resMatch := strings.TrimSpace(match[1])

		s1 := detectors.Result{
			DetectorType: detector_typepb.DetectorType_ZapierWebhook,
			Raw:          []byte(resMatch),
			SecretParts:  map[string]string{"key": resMatch},
		}

		if verify {
			isVerified, verificationErr := verifyZapierWebhook(ctx, client, resMatch)
			s1.Verified = isVerified
			s1.SetVerificationError(verificationErr, resMatch)
		}

		results = append(results, s1)
	}

	return results, nil
}

func (s Scanner) Type() detector_typepb.DetectorType {
	return detector_typepb.DetectorType_ZapierWebhook
}

func (s Scanner) Description() string {
	return "Zapier is an automation tool that connects your apps and services. Zapier webhooks can be used to automate workflows by sending HTTP requests to a unique URL."
}

func verifyZapierWebhook(ctx context.Context, client *http.Client, key string) (bool, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://hooks.zapier.com/hooks/catch/"+key, http.NoBody)
	if err != nil {
		return false, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return false, err
	}

	defer func() {
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
	}()

	switch resp.StatusCode {
	case http.StatusOK:
		return true, nil
	case http.StatusUnauthorized:
		return false, nil
	default:
		return false, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}
}

```

### Core Architecture Module: `pkg/engine/ahocorasick/ahocorasickcore.go`
```
package ahocorasick

import (
	"sync"

	ahocorasick "github.com/BobuSumisu/aho-corasick"

	"github.com/trufflesecurity/trufflehog/v3/pkg/custom_detectors"
	"github.com/trufflesecurity/trufflehog/v3/pkg/detectors"
	"github.com/trufflesecurity/trufflehog/v3/pkg/pb/detector_typepb"
)

// lowerBuf is a reusable buffer holding the lowercased copy of one chunk.
//
// Every chunk needs such a copy, and each one is thrown away moments later, so
// rather than allocate a new buffer every time we borrow one from a pool and
// hand it back afterwards. In a steady scan the pool already holds a buffer big
// enough, so the copy costs no allocation at all.
//
// The pool stores pointers rather than plain slices. Putting a slice into a
// sync.Pool would allocate on every Put, which is the very thing being avoided.
type lowerBuf struct{ b []byte }

var lowerBufPool = sync.Pool{New: func() any { return new(lowerBuf) }}

// maxPooledLowerBuf is the largest buffer worth keeping for reuse.
//
// One unusually large chunk would otherwise leave a matching buffer sitting in
// the pool for the rest of the run, once per worker goroutine. Past this size
// it is cheaper to let the buffer go and allocate again next time.
const maxPooledLowerBuf = 1 << 20 // 1 MiB

// getLowerBuf borrows a buffer able to hold size bytes.
func getLowerBuf(size int) *lowerBuf {
	buf := lowerBufPool.Get().(*lowerBuf)
	if cap(buf.b) < size {
		buf.b = make([]byte, 0, size)
	}
	return buf
}

// putLowerBuf returns a buffer for reuse, unless it is too big to be worth
// holding on to.
func putLowerBuf(buf *lowerBuf) {
	if cap(buf.b) > maxPooledLowerBuf {
		return
	}
	buf.b = buf.b[:0]
	lowerBufPool.Put(buf)
}

// appendASCIILower copies src onto dst, turning A-Z into a-z and leaving every
// other byte exactly as it was.
//
// Only A-Z is changed, for two reasons.
//
// It keeps the copy the same length as the original. Lowercasing a character
// can change how many bytes it takes: "İ" needs two bytes, "i" needs one.
// FindDetectorMatches searches the lowercased copy but then cuts bytes out of
// the original chunk, so if the copy were a different length every position
// would point somewhere slightly wrong, and the text handed to a detector would
// not be the text that matched.
//
// Nothing is lost by leaving other bytes alone. Every built-in detector keyword
// is plain ASCII, so a non-ASCII byte can never be part of a match either way.
//
// Keywords are folded through this same function when they are registered, so
// both sides of the search always agree. The one gap is a custom detector whose
// keyword contains a cased non-ASCII letter: that letter is left as written on
// both sides, so the keyword matches only text spelling it the same way.
func appendASCIILower(dst, src []byte) []byte {
	for _, c := range src {
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		dst = append(dst, c)
	}
	return dst
}

// DetectorKey is used to identify a detector in the keywordsToDetectors map.
// Multiple detectors can have the same detector type but different versions.
// This allows us to identify a detector by its type and version. An
// additional (optional) field is provided to disambiguate multiple custom
// detectors. This type is exported even though none of its fields are so
// that the AhoCorasickCore can populate passed-in maps keyed on this type
// without exposing any of its internals to consumers.
type DetectorKey struct {
	detectorType       detector_typepb.DetectorType
	version            int
	customDetectorName string
}

func (k DetectorKey) Loggable() map[string]any {
	res := map[string]any{"type": k.detectorType.String()}
	if k.version > 0 {
		res["version"] = k.version
	}
	if k.customDetectorName != "" {
		res["name"] = k.customDetectorName
	}
	return res
}

// Type returns the detector type of the key.
func (k DetectorKey) Type() detector_typepb.DetectorType { return k.detectorType }

// spanCalculator is an interface that defines a method for calculating a match span
// in the chunk data. This allows for different strategies to be used without changing the core logic.
type spanCalculator interface {
	calculateSpan(params spanCalculationParams) matchSpan
}

// spanCalculationParams provides the necessary context for calculating match spans,
// including the keyword index in the chunk, the chunk data itself, and the detector being used.
type spanCalculationParams struct {
	keywordIdx int64 // Index of the keyword in the chunk data
	chunkData  []byte
	detector   detectors.Detector
}

// EntireChunkSpanCalculator is a strategy that calculates the match span to use the entire chunk data.
// This is used when we want to match against the full length of the provided chunk.
type EntireChunkSpanCalculator struct{}

// calculateSpan returns the match span as the length of the chunk data,
// effectively using the entire chunk for matching.
func (e *EntireChunkSpanCalculator) calculateSpan(params spanCalculationParams) matchSpan {
	return matchSpan{startOffset: 0, endOffset: int64(len(params.chunkData))}
}

// adjustableSpanCalculator is a strategy that calculates match spans. It uses a default offset magnitude
// or values provided by specific detectors to adjust the start and end indices of the span, allowing
// for more granular control over the match.
type adjustableSpanCalculator struct{ offsetMagnitude int64 }

// newAdjustableSpanCalculator creates a new instance of adjustableSpanCalculator with the
// specified offset magnitude.
func newAdjustableSpanCalculator(offsetRadius int64) *adjustableSpanCalculator {
	return &adjustableSpanCalculator{offsetMagnitude: offsetRadius}
}

// calculateSpan computes the match span based on the keyword index and the offset magnitude.
// If the detector provides an override value, it uses that instead of the default offset magnitude to
// calculate the maximum size of the span.
// The start index of the span is also adjusted if the detector provides a start offset.
func (m *adjustableSpanCalculator) calculateSpan(params spanCalculationParams) matchSpan {
	keywordIdx := params.keywordIdx

	maxSize := keywordIdx + m.offsetMagnitude
	startOffset := keywordIdx - m.offsetMagnitude

	// Check if the detector implements each interface and update values accordingly.
	// This CAN'T be done in a switch statement because a detector can implement multiple interfaces.
	if provider, ok := params.detector.(detectors.MultiPartCredentialProvider); ok {
		maxSize = provider.MaxCredentialSpan() + keywordIdx
		startOffset = keywordIdx - provider.MaxCredentialSpan()
	}
	if provider, ok := params.detector.(detectors.MaxSecretSizeProvider); ok {
		maxSize = provider.MaxSecretSize() + keywordIdx
	}
	if provider, ok := params.detector.(detectors.StartOffsetProvider); ok {
		startOffset = keywordIdx - provider.StartOffset()
	}

	startIdx := max(startOffset, 0)
	endIdx := min(maxSize, int64(len(params.chunkData)))

	// Ensure the start index is not greater than the end index to prevent invalid spans.
	// In rare cases where the calculated start index exceeds the end index (possibly due to
	// detector-provided offsets), we reset the start index to 0 to maintain a valid span range
	// and avoid runtime panics. This is a temporary fix until the root cause is identified.
	if startIdx >= endIdx {
		startIdx = 0
	}

	return matchSpan{startOffset: startIdx, endOffset: endIdx}
}

// CoreOption is a functional option type for configuring an AhoCorasickCore instance.
type CoreOption func(*Core)

// WithSpanCalculator sets the span calculator for AhoCorasickCore.
func WithSpanCalculator(spanCalculator spanCalculator) CoreOption {
	return func(ac *Core) { ac.spanCalculator = spanCalculator }
}

// Core encapsulates the operations and data structures used for keyword matching via the
// Aho-Corasick algorithm. It is responsible for constructing and managing the trie for efficient
// substring searches, as well as mapping keywords to their associated detectors for rapid lookups.
type Core struct {
	// prefilter is a ahocorasick struct used for doing efficient string
	// matching given a set of words. (keywords from the rules in the config)
	prefilter ahocorasick.Trie
	// Maps for efficient lookups during detection.
	// (This implementation maps in two layers: from keywords to detector
	// type and then again from detector type to detector. We could
	// go straight from keywords to detectors but doing it this way makes
	// some consuming code a little cleaner.)
	keywordsToDetectors map[string][]DetectorKey
	detectorsByKey      map[DetectorKey]detectors.Detector
	spanCalculator      spanCalculator // Strategy for calculating match spans
}

// NewAhoCorasickCore allocates and initializes a new instance of AhoCorasickCore. It uses the
// provided detector slice to create a map from keywords to detectors and build the Aho-Corasick
// prefilter trie.
func NewAhoCorasickCore(allDetectors []detectors.Detector, opts ...CoreOption) *Core {
	keywordsToDetectors := make(map[string][]DetectorKey)
	detectorsByKey := make(map[DetectorKey]detectors.Detector, len(allDetectors))
	var keywords []string
	for _, d := range allDetectors {
		key := CreateDetectorKey(d)
		detectorsByKey[key] = d
		for _, kw := range d.Keywords() {
			// Fold the keyword exactly the way FindDetectorMatches folds the
			// chunk it searches, so the two sides can never disagree.
			kwFolded := string(appendASCIILower(nil, []byte(kw)))
			keywords = append(keywords, kwFolded)
			keywordsToDetectors[kwFolded] = append(keywordsToDetectors[kwFolded], key)
		}
	}

	const defaultOffsetRadius int64 = 512
	core := &Core{
		keywordsToDetectors: keywordsToDetectors,
		detectorsByKey:      detectorsByKey,
		prefilter:           *ahocorasick.NewTrieBuilder().AddStrings(keywords).Build(),
		spanCalculator:      newAdjustableSpanCalculator(defaultOffsetRadius), // Default span calculator
	}

	for _, opt := range opts {
		opt(core)
	}

	return core
}

// DetectorMatch represents a detected pattern's metadat
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5181** (2026-09-11): **Trufflehog fails with TRUFFLEHOG_PRE_COMMIT if worktrees enabled**
  *Symptoms*: Please review the [Community Note](https://github.com/trufflesecurity/trufflehog/blob/main/.github/community_note.md) before submitting  ### TruffleHog Version trufflehog 3.96.0  ### Trace Output https://gist.github.com/marpulli/40b2d7831a25d6207d053a4465db264a  ### Expected Behavior  Not errored  ### Actual Behavior  Errored with `encountered errors during scan  {"job": 1, "source_name": "trufflehog - git", "errors": ["error chunking dir \".\": core.repositoryformatversion does not support extension: worktreeconfig"]}`  ### Steps to Reproduce  Run trufflehog with `TRUFFLEHOG_PRE_COMMIT=1` in a git repo with worktrees enabled. Full command I'm running is `TRUFFLEHOG_PRE_COMMIT=1 trufflehog git file://. --no-update`   ## Environment  * OS: MacOS   * Version 26.5.2  ## Additional Context The issue seems to be that go-git doesn't support worktreeConfig = true setting in git config. Upstream issue is [here](https://github.com/go-git/go-git/issues/1943) - it looks like v6 will support it when released.   
  **Post-Mortem & Fix Analysis**:
  > @marpulli try using `--trust-local-git-config` arg, it should resolve it.
  > @k-sau Thanks for the pointer. I'm finding that it still does not work with `--trust-local-git-config` but _does_ work with `--no-trust-local-git-config` 
  > Thanks, this seems to work without any config changes now

- **Issue #5164** (2026-07-31): **HubSpot API key detection reports any `pat-na1-*` string as verified**
  *Symptoms*: ### TruffleHog Version - 3.96.0  ### Trace Output https://gist.github.com/mrstanwell/2da84ad3fe6dcd7a37addea4ae821169  ### Expected Behavior A `pat-na1-*` string that is not a live HubSpot private app token is reported as unverified, not as verified.  ### Actual Behavior Every string matching the HubSpot API key pattern is reported as a **verified** secret, including rotated keys and keys that have never existed.  ### Steps to Reproduce ```bash # A bogus token is reported as VERIFIED (exit 183) printf 'HUBSPOT_API_KEY="pat-na1-deadbeef-0000-1111-2222-333344445555"\n' > /tmp/hubspot.env trufflehog filesystem /tmp/hubspot.env --results=verified --fail --no-update echo "exit: $?" 🐷🔑🐷  TruffleHog. Unearth your secrets. 🐷🔑🐷  2026-07-29T12:16:51-05:00       info-0  trufflehog      running source  {"source_manager_worker_id": "ErDd7", "with_units": true} ✅ Found verified result 🐷🔑 Detector Type: HubSpotApiKey Decoder Type: PLAIN Raw result: pat-na1-deadbeef-0000-1111-2222-333344445555 File: /tmp/hubspot.env Line: 1 Analyze: Run `trufflehog analyze` to analyze this key's permissions  2026-07-29T12:16:51-05:00       info-0  trufflehog      finished scanning       {"chunks": 1, "bytes": 63, "verified_secrets": 1, "unverified_secrets": 0, "scan_duration": "494.972375ms", "trufflehog_version": "3.96.0", "verification_caching": {"Hits":0,"Misses":2,"HitsWasted":0,"AttemptsSaved":0,"VerificationTimeSpentMS":704}} exit: 183 ```  ### Workaround None that I'm aware of.  When doing a f
  **Post-Mortem & Fix Analysis**:
  > Hi, I'd like to take this one. Root cause: in the v2 detector, verifyToken treats any 403 as a valid token. HubSpot's WAF returns 403 with an HTML block page for bogus tokens, which gets counted as verified. I'll tighten the 403 handling so only real API permission errors (JSON responses) count as verified.
  > Actually, the TruffleHog UA is getting a `401` from hubapi.com now.  This is no longer an issue.

- **Issue #5150** (2026-07-24): **APK Detection sometimes fails on streamers like `json-enumerator` and APK file extension shouldn't be required**
  *Symptoms*: Bug  ### TruffleHog Version v3.95.9, latest dev off `a2ef4f51a5e3644c500f02650db88504cd7d9b68`  ### Trace Output  ``` johannestaas trufflehog $ ./trufflehog.main.a2ef4f51a json-enumerator fdroid_zipmime.ndjson --no-verification --log-level=5 > /dev/null 2> main.trace.log johannestaas trufflehog $ grep -c 'apk_package\|dex_file' main.trace.log  0 johannestaas trufflehog $ ./trufflehog.JAN_apk-parsing-from-json-enumerator.2b8cf6414 json-enumerator fdroid_zipmime.ndjson --no-verification --log-level=5 > /dev/null 2> patched.trace.log johannestaas trufflehog $ grep -c 'apk_package\|dex_file' patched.trace.log 224 ```  [patched.trace.log](https://github.com/user-attachments/files/30289479/patched.trace.log)  [F-Droid.apk](https://f-droid.org/F-Droid.apk)  ### Expected Behavior  APK detection should be content-based. When an APK is delivered as a raw byte stream (`json-enumerator`, or any source that does not carry a `.apk` filename), TruffleHog should still identify it as an APK and run the APK handler decoding `classes.dex`, `AndroidManifest.xml`, as long as the ZIP central directory contains the APK markers (`AndroidManifest.xml` + `classes.dex`).  ### Actual Behavior  APK detection relies on the `gabriel-vasile/mimetype` library's content sniff, which only reads the first 3072 bytes of the stream.  If none of the APK marker entries (`AndroidManifest.xml`, `classes.dex`, `resources.arsc`, `res/drawable`, `META-INF/com/android/build/gradle/app-metadata.properties`) appear within 
  **Post-Mortem & Fix Analysis**:
  > would be patched in https://github.com/trufflesecurity/trufflehog/pull/5151
  > Patched, and seems to be running fine with json-enumerator now: ``` ./trufflehog.main.6f3c981e7 json-enumerator apk.ndjson --no-verification --log-level=5 2>&1 | grep -cE 'apk_package|dex_file' 58 ``` 

- **Issue #5144** (2026-07-22): **- name: TruffleHog OSS   uses: trufflesecurity/trufflehog@v3.95.9**
  *Symptoms*: Please review the [Community Note](https://github.com/trufflesecurity/trufflehog/blob/main/.github/community_note.md) before submitting  ### TruffleHog Version <!--- Please run `trufflehog --version` to show the version. If you are not running the latest version, please upgrade because your issue may have already been fixed. --->  ### Trace Output  <!--- Please provide a link to a GitHub Gist containing the complete debug output. Please do NOT paste the debug output in the issue; just paste a link to the Gist.  To obtain the trace output, run trufflehog with the --log-level=5 flag. --->  ### Expected Behavior  <!--- What should have happened? --->  ### Actual Behavior  <!--- What actually happened? --->  ### Steps to Reproduce  <!--- Please list the steps required to reproduce the issue. --->  1. Go to '...'  2. Click on '....'  3. Scroll down to '....'  4. See error  ## Environment  * OS: [e.g. iOS]  * Version [e.g. 22]  ## Additional Context <!--- Add any other context about the problem here. --->  ### References  <!--- Information about referencing Github Issues: https://help.github.com/articles/basic-writing-and-formatting-syntax/#referencing-issues-and-pull-requests  Are there any other GitHub issues (open or closed) or pull requests that should be linked here? Vendor documentation? For example: --->  * #0000  

- **Issue #5115** (2026-07-29): **Privatekey detector silently drops encrypted keys when the passphrase isn't in the built-in wordlist**
  *Symptoms*: **Summary** When a private key is passphrase-protected and Crack() can't guess the passphrase from the built-in wordlist (pkg/detectors/privatekey/list.txt, ~250 common passwords), the detector discards the finding entirely — it's not reported as verified or unverified. An encrypted key in a repo is still a real exposure (offline-crackable, weak legacy KDFs, passphrase often reused/committed nearby), so it should surface as an unverified finding.  **Cause** In pkg/detectors/privatekey/privatekey.go (FromData), the failed-crack branch continues past the results = append(...):  parsedKey, passphrase, err = Crack([]byte(token)) if err != nil { s1.SetVerificationError(err, token) continue // <-- drops the finding (and the encrypted:"true" metadata just set) }  **Reproduction**  ssh-keygen -t ed25519 -N "$(head -c24 /dev/urandom | base64)" -f ./enc_key trufflehog filesystem ./enc_key --no-verification  Expected: one unverified PrivateKey finding. Actual: zero findings.  **Control:** same command with -N password (a wordlist entry) or -N "" (no passphrase) → finding is reported. The only variable is whether the passphrase is crackable.  **Suggested fix** Append the result as unverified before continuing: s1.SetVerificationError(err, token) results = append(results, s1) continue

- **Issue #5048** (2026-06-18): **nearly there butu wont win that easy...**
  *Symptoms*: Please review the [Community Note](https://github.com/trufflesecurity/trufflehog/blob/main/.github/community_note.md) before submitting  ### TruffleHog Version <!--- Please run `trufflehog --version` to show the version. If you are not running the latest version, please upgrade because your issue may have already been fixed. --->  ### Trace Output  <!--- Please provide a link to a GitHub Gist containing the complete debug output. Please do NOT paste the debug output in the issue; just paste a link to the Gist.  To obtain the trace output, run trufflehog with the --log-level=5 flag. --->  ### Expected Behavior  <!--- What should have happened? --->  ### Actual Behavior  <!--- What actually happened? --->  ### Steps to Reproduce  <!--- Please list the steps required to reproduce the issue. --->  1. Go to '...'  2. Click on '....'  3. Scroll down to '....'  4. See error  ## Environment  * OS: [e.g. iOS]  * Version [e.g. 22]  ## Additional Context <!--- Add any other context about the problem here. --->  ### References  <!--- Information about referencing Github Issues: https://help.github.com/articles/basic-writing-and-formatting-syntax/#referencing-issues-and-pull-requests  Are there any other GitHub issues (open or closed) or pull requests that should be linked here? Vendor documentation? For example: --->  * #0000  

- **Issue #5039** (2026-06-18): **Filesystem Directory Transversal Issue - TruffleHog Fails to Discover Secrets**
  *Symptoms*: ### TruffleHog Version trufflehog 3.95.5 (brew)  ### Trace Output https://gist.github.com/Archer36/67d13077055a68131b7306d0e7ddcacd  ### Expected Behavior  The presence of a sibling directory should not affect whether another sibling directory is traversed and scanned.  Given:  ```text trufflehog-repro/ ├── blue-team/ │   └── project-notes.txt └── blue-team-deprecated/     └── AWSCredentials.txt ```  TruffleHog should traverse and scan `blue-team-deprecated/AWSCredentials.txt` regardless of whether `blue-team` exists.  ### Actual Behavior  When a sibling directory named `blue-team` exists, TruffleHog discovers the directory `blue-team-deprecated` but does not descend into it.  As a result:  - `AWSCredentials.txt` is never enumerated. - `AWSCredentials.txt` is never scanned. - No findings are produced.  If `blue-team` is renamed to `blue-team2`, TruffleHog immediately traverses into `blue-team-deprecated`, scans `AWSCredentials.txt`, and reports the expected AWS finding.  Removing `blue-team` entirely produces the same result.  ### Steps to Reproduce  1. Create the following directory structure:  ```text trufflehog-repro/ ├── blue-team/ │   └── project-notes.txt └── blue-team-deprecated/     └── AWSCredentials.txt ```  2. Populate `AWSCredentials.txt` with fake AWS credentials:  ```text AWS_ACCESS_KEY_ID=AKIA7QW9K2M4X8N5R3TZ AWS_SECRET_ACCESS_KEY=Vw8rL3qP9zNxY2mK7cTfH5sJ1aBdE6uQ4gWpR0xZ ```  3. Run:  ```bash trufflehog filesystem trufflehog-repro --log-level=5 ```  4. Observe:
  **Post-Mortem & Fix Analysis**:
  > For what its worth I let codex take a shot at it and it identified the following:  ``` The fix is in pkg/sources/filesystem/filesystem.go:258. The bug was in the resumption skip logic: it was comparing whole paths as raw strings, which misordered siblings like blue-team and blue-team-deprecated because - sorts before /. That made the   scanner think the longer sibling had already been passed and skip it.    I changed that comparison to use path components relative to the scan root, so it follows actual traversal order instead of lexicographic string quirks. I also added a regression test in pkg/sources/filesystem/filesystem_test.go:682 that reproduces   the prefix-sibling case and asserts the longer sibling still gets scanned.  The important pieces are in pkg/sources/filesystem/filesystem.go:249. os.ReadDir returns entries sorted by name within a directory, and the scanner assumes that order when it decides whether to keep skipping or stop skipping. In the bad case:    1. It scans blue
  > Hey, thanks for sharing a detailed report. You may find some context [here](https://github.com/trufflesecurity/trufflehog/pull/4797#discussion_r2906836875).
  > > Hey, thanks for sharing a detailed report. You may find some context [here](https://github.com/trufflesecurity/trufflehog/pull/4797#discussion_r2906836875).  That's helpful and it seems cursor essentially identified the same thing (https://github.com/trufflesecurity/trufflehog/pull/4797#discussion_r2906836875). From what I can tell, this hasn't been yet fixed correct? It was mentioned "This looks like a bug, but it might be one that we're comfortable with in the short term." but for me at least it undermines the trustworthiness of the results. In my case TruffleHog completely missed several high impact findings. The only way I caught it, was because TruffleHog scanned the zip and identified the credentials. However when I scanned the decompressed zip, no findings were present which is what caused me to dig in.

- **Issue #5004** (2026-06-02): **release 3.95.4 doesn't contain trufflehog packages**
  *Symptoms*: Please review the [Community Note](https://github.com/trufflesecurity/trufflehog/blob/main/.github/community_note.md) before submitting  ### TruffleHog Version <!--- Please run `trufflehog --version` to show the version. If you are not running the latest version, please upgrade because your issue may have already been fixed. ---> Latest release: https://github.com/trufflesecurity/trufflehog/releases/tag/v3.95.4  ### Trace Output I am unable to install it via standard way because of missing packages ```bash curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sh -s -- -b /usr/local/bin trufflesecurity/trufflehog info checking GitHub for latest tag trufflesecurity/trufflehog info found version: 3.95.4 for v3.95.4/linux/amd64 trufflesecurity/trufflehog err http_download_curl received HTTP status 404 ```  <!--- Please provide a link to a GitHub Gist containing the complete debug output. Please do NOT paste the debug output in the issue; just paste a link to the Gist.  To obtain the trace output, run trufflehog with the --log-level=5 flag. --->  ### Expected Behavior I am able to install trufflehog  <!--- What should have happened? --->  ### Actual Behavior  <!--- What actually happened? --->  ### Steps to Reproduce  <!--- Please list the steps required to reproduce the issue. ---> ``` curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sh -s -- -b /usr/local/bin ```  ## Environment ``` cat 
  **Post-Mortem & Fix Analysis**:
  > Same problem, the action did not finish "422 Cannot upload assets to an immutable release.": https://github.com/trufflesecurity/trufflehog/actions/runs/26802335016/job/79011561336
  > Also has the same problem. Our release pipelines doesn't work because of this. 
  > Hey everyone--thanks for flagging; we're looking into it

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

### Incident Patch 1: `2b2c270b` (2026-10-05)
**Commit Message**: Fix NetSuite detector running out of memory on dense input (#5383)

* Fix NetSuite detector memory blowup by keeping one result per key pair

* Stop NetSuite verification after the deadline, look up missing hosts once, and drain responses

* Update NetSuite integration test to expect one result per key pair

**File**: `pkg/detectors/netsuite/netsuite.go` (modified, +59/-3)
```diff
@@ -7,7 +7,10 @@ import (
 	"crypto/sha256"
 	"encoding/base64"
 	"encoding/binary"
+	"errors"
 	"fmt"
+	"io"
+	"net"
 	"net/http"
 	"net/url"
 	"strconv"
@@ -16,6 +19,7 @@ import (
 
 	regexp "github.com/wasilibs/go-re2"
 
+	"github.com/trufflesecurity/trufflehog/v3/pkg/cache/simple"
 	"github.com/trufflesecurity/trufflehog/v3/pkg/common"
 	"github.com/trufflesecurity/trufflehog/v3/pkg/detectors"
 	"github.com/trufflesecurity/trufflehog/v3/pkg/pb/detector_typepb"
@@ -41,6 +45,9 @@ var (
 	tokenSecretPat = regexp.MustCompile(detectors.PrefixRegex([]string{"netsuite", "token", "secret"}) + `\b([a-zA-Z0-9]{64})\b`)
 
 	accountIDPat = regexp.MustCompile(detectors.PrefixRegex([]string{"netsuite", "account", "id"}) + `\b([a-zA-Z0-9-_]{6,15})\b`)
+
+	// invalidHosts holds account hosts that do not resolve, so later combinations skip the lookup.
+	invalidHosts = simple.NewCache[struct{}]()
 )
 
 type credentialSet struct {
@@ -68,8 +75,23 @@ func (s Scanner) FromData(ctx context.Context, verify bool, data []byte) (result
 	tokenSecretMatches := trimUniqueMatches(tokenSecretPat.FindAllStringSubmatch(dataStr, -1))
 	accountIDMatches := trimUniqueMatches(accountIDPat.FindAllStringSubmatch(dataStr, -1))
 
+	// Every combination needs a token key, token secret and account ID.
+	if len(tokenKeyMatches) == 0 || len(tokenSecretMatches) == 0 || len(accountIDMatches) == 0 {
+		return nil, nil
+	}
+
+	// Raw and RawV2 hold only the consumer key and secret, so every combination for a pair is a duplicate of the same
+	// finding. Report one result per pair rather than one per combination of all five parts. The token key, token
+	// secret and account ID decide whether the pair is reported and whether it verifies.
 	for consumerKey := range consumerKeyMatches {
 		for consumerSecret := range consumerSecretMatches {
+			// No combination can use the same value as both consumer key and secret.
+			if consumerKey == consumerSecret {
+				continue
+			}
+
+			var pairResult *detectors.Result
+		combinations:
 			for tokenKey := range tokenKeyMatches {
 				for tokenSecret := range tokenSecretMatches {
 					for accountID := range accountIDMatches {
@@ -107,10 +129,28 @@ func (s Scanner) FromData(ctx context.Context, verify bool, data []byte) (result
 							s1.Verified = isVerified
 							s1.SetVerificationError(err, consumerKey)
 						}
-						results = append(results, s1)
+
+						// Keep the verified result, else the first indeterminate one, else the first one.
+						if pairResult == nil || s1.Verified || (s1.VerificationError() != nil && pairResult.VerificationError() == nil) {
+							pairResult = &s1
+						}
+						if !verify || s1.Verified {
+							break combinations
+						}
+						if err := ctx.Err(); err != nil {
+							// Combinations left untried might have verified.
+							if pairResult.VerificationError() == nil {
+								pairResult.SetVerificationError(err, consumerKey)
+							}
+							break combinations
+						}
 					}
 				}
 			}
+
+			if pairResult != nil {
+				results = append(results, *pairResult)
+			}
 		}
 	}
 
@@ -126,9 +166,20 @@ func (s Scanner) Description() string {
 }
 
 func verifyCredentials(ctx context.Context, client *http.Client, cs credentialSet) (bool, error) {
+	// The engine waits for FromData to return even after its deadline, so send no request once the context is done.
+	if err := ctx.Err(); err != nil {
+		return false, err
+	}
+
 	// for url, filter or replace underscore in accountID if needed and lower case the accountID
 	urlAccountId := strings.ToLower(strings.ReplaceAll(cs.accountID, "_", "-"))
 
+	// An earlier combination already found that this account's host does not resolve, so skip the lookup and
+	// return what the lookup would.
+	if invalidHosts.Exists(urlAccountId) {
+		return false, nil
+	}
+
 	baseUrl := "https://" + urlAccountId + ".suitetalk.api.netsuite.com"
 
 	const path = "/services/rest/record/v1/metadata-catalog/check"
@@ -164,12 +215,17 @@ func verifyCredentials(ctx context.Context, client *http.Client, cs credentialSe
 	// Make the request
 	res, err := client.Do(req)
 	if err != nil {
-		if strings.Contains(err.Error(), "no such host") {
+		var dnsErr *net.DNSError
+		if errors.As(err, &dnsErr) && dnsErr.IsNotFound {
+			invalidHosts.Set(urlAccountId, struct{}{})
 			return false, nil
 		}
 		return false, err
 	}
-	defer func() { _ = res.Body.Close() }()
+	defer func() {
+		_, _ = io.Copy(io.Discard, res.Body)
+		_ = res.Body.Close()
+	}()
 	switch res.StatusCode {
 	case http.StatusOK:
 		return true, nil
```

**File**: `pkg/detectors/netsuite/netsuite_integration_test.go` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@ func TestNetsuite_FromChunk(t *testing.T) {
 				verify: true,
 			},
 			ShouldHaveVerified: false,
-			wantCount:          21,
+			wantCount:          5,
 			wantErr:            false,
 		},
 		{
```

**File**: `pkg/detectors/netsuite/netsuite_test.go` (modified, +206/-1)
```diff
@@ -3,10 +3,16 @@ package netsuite
 import (
 	"context"
 	"fmt"
+	"io"
+	"net"
+	"net/http"
+	"strings"
+	"sync/atomic"
 	"testing"
 
 	"github.com/google/go-cmp/cmp"
 
+	"github.com/trufflesecurity/trufflehog/v3/pkg/common"
 	"github.com/trufflesecurity/trufflehog/v3/pkg/detectors"
 	"github.com/trufflesecurity/trufflehog/v3/pkg/engine/ahocorasick"
 )
@@ -41,7 +47,7 @@ func TestNetsuite_Pattern(t *testing.T) {
 		{
 			name:  "valid pattern - with keyword netsuite",
 			input: fmt.Sprintf(inputFormat, keyword, validAccountID, validConsumerKey, validConsumerSecret, validTokenKey, validTokenSecret),
-			want:  []string{outputPair1, outputPair2, outputPair1, outputPair2},
+			want:  []string{outputPair1, outputPair2},
 		},
 		{
 			name:  "invalid pattern",
@@ -92,3 +98,202 @@ func TestNetsuite_Pattern(t *testing.T) {
 		})
 	}
 }
+
+// denseValue returns the i-th 64-character value of tokenDenseInput.
+func denseValue(i int) string {
+	return fmt.Sprintf("%064x", i)
+}
+
+// tokenDenseInput returns n distinct 64-character values, each of which every key and secret pattern matches, and one
+// account ID.
+func tokenDenseInput(n int) []byte {
+	var input strings.Builder
+	for i := 1; i <= n; i++ {
+		fmt.Fprintf(&input, "netsuite = %s\n", denseValue(i))
+	}
+	input.WriteString("account_id = 1234567\n")
+	return []byte(input.String())
+}
+
+// fakeClient returns a client that counts its requests and answers each with the status respond picks.
+func fakeClient(requests *atomic.Int32, respond func(req *http.Request) int) *http.Client {
+	return &http.Client{
+		Transport: common.FakeTransport{
+			CreateResponse: func(req *http.Request) (*http.Response, error) {
+				requests.Add(1)
+				return &http.Response{
+					Request:    req,
+					StatusCode: respond(req),
+					Body:       io.NopCloser(strings.NewReader("")),
+				}, nil
+			},
+		},
+	}
+}
+
+func TestNetsuite_TokenDenseInput(t *testing.T) {
+	const values = 16
+
+	ctx, cancel := context.WithCancel(context.Background())
+	cancel()
+
+	results, err := Scanner{}.FromData(ctx, false, tokenDenseInput(values))
+	if err != nil {
+		t.Fatalf("error = %v", err)
+	}
+
+	// One result per ordered consumer key and secret pair, not one per combination of all five parts.
+	if want := values * (values - 1); len(results) != want {
+		t.Fatalf("expected %d results, got %d", want, len(results))
+	}
+	seen := make(map[string]struct{}, len(results))
+	for _, r := range results {
+		if _, ok := seen[string(r.RawV2)]; ok {
+			t.Fatalf("duplicate result %q", r.RawV2)
+		}
+		seen[string(r.RawV2)] = struct{}{}
+	}
+}
+
+func TestNetsuite_Verification(t *testing.T) {
+	// With 4 values there are 4*3 consumer key and secret pairs, each completed by 2*1 token key and secret orders.
+	tests := []struct {
+		name         string
+		values       int
+		status       int
+		cancel       bool
+		wantVerified bool
+		wantErr      string
+		wantRequests int32
+	}{
+		{
+			name:         "rejected pairs try every combination",
+			values:       4,
+			status:       http.StatusUnauthorized,
+			wantRequests: 12 * 2,
+		},
+		{
+			name:         "verification stops at the first accepted combination",
+			values:       4,
+			status:       http.StatusOK,
+			wantVerified: true,
+			wantRequests: 12,
+		},
+		{
+			name:         "canceled context sends no requests",
+			values:       16,
+			status:       http.StatusOK,
+			cancel:       true,
+			wantErr:      context.Canceled.Error(),
+			wantRequests: 0,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			var requests atomic.Int32
+			client := fakeClient(&requests, func(*http.Request) int { return tt.status })
+
+			ctx, cancel := context.WithCancel(context.Background())
+			defer cancel()
+			if tt.cancel {
+				cancel()
+			}
+
+			results, err := Scanner{client: client}.FromData(ctx, true, tokenDenseInput(tt.values))
+			if err != nil {
+				t.Fatalf("error = %v", err)
+			}
+
+			if want := tt.values * (tt.values - 1); len(results) != want {
+				t.Fatalf("expected %d results, got %d", want, len(results))
+			}
+			for _, r := range results {
+				if r.Verified != tt.wantVerified {
+					t.Fatalf("verified = %v, want %v", r.Verified, tt.wantVerified)
+				}
+				var gotErr string
+				if err := r.VerificationError(); err != nil {
+					gotErr = err.Error()
+				}
+				if gotErr != tt.wantErr {
+					t.Fatalf("verification error = %q, want %q", gotErr, tt.wantErr)
+				}
+			}
+			if got := requests.Load(); got != tt.wantRequests {
+				t.Errorf("requests = %d, want %d", got, tt.wantRequests)
+			}
+		})
+	}
+}
+
+func TestNetsuite_VerificationFindsTheAcceptedCombination(t *testing.T) {
+	// Accept only consumer key 1 with token key 4, so each pair has at most one accepted combination among the
+	// rejected ones.
+	var requests atomic.Int32
+	client := fakeClient(&requests, func(req *http.Request) int {
+		auth := req.Header.Get("Authorization")
+		if strings.Contains(auth, `oauth_consumer_key="`+de
```

---

### Incident Patch 2: `59e3b04e` (2026-10-02)
**Commit Message**: fix(github): switch back to fetching access token through apiClient, (#5380)

and maintain our own cache and expiry.

Using ghinstallation.Transport turned out to be a mistake because
rate limit errors weren't returned as the github client error types the
caller looks for, but also the github client can circuit-break
rate-limited requests before they're made.  That's all in the client
rather than a transport/roundtripper, so we're going back to request
through that.

INT-1151

**File**: `pkg/sources/github/connector_app.go` (modified, +54/-6)
```diff
@@ -7,6 +7,7 @@ import (
 	"strconv"
 	"strings"
 	"sync"
+	"time"
 
 	"github.com/bradleyfalzon/ghinstallation/v2"
 	gogit "github.com/go-git/go-git/v5"
@@ -40,7 +41,15 @@ type appConnector struct {
 type appInstallationClients struct {
 	apiClient     *github.Client
 	graphqlClient *githubv4.Client
-	transport     *ghinstallation.Transport
+	tokenMu       sync.RWMutex
+	token         *github.InstallationToken
+}
+
+func (cs *appInstallationClients) accessTokenIfValid() *github.InstallationToken {
+	if cs.token == nil || cs.token.GetExpiresAt().Before(time.Now()) {
+		return nil
+	}
+	return cs.token
 }
 
 var _ Connector = (*appConnector)(nil)
@@ -155,17 +164,57 @@ func (c *appConnector) Clone(ctx context.Context, repoURL string, args ...string
 		return "", nil, fmt.Errorf("no GitHub App installation resolved for repo %q; set githubApp.installationId to a fallback installation to scan repos outside installation listings (e.g. member repos with scanUsers) together with scanAllInstallations", repoURL)
 	}
 
+	token, err := c.accessTokenForInstallation(ctx, installID)
+	if err != nil {
+		return "", nil, err
+	}
+
+	return git.CloneRepoUsingToken(ctx, token, repoURL, "", "x-access-token", true, args...)
+}
+
+// accessTokenForInstallation returns an installation access token.
+func (c *appConnector) accessTokenForInstallation(ctx context.Context, installID int64) (string, error) {
+	if installID == 0 {
+		return "", fmt.Errorf("tried to fetch installation access token for id 0")
+	}
+
 	clients, err := c.clientsForInstallation(installID)
 	if err != nil {
-		return "", nil, fmt.Errorf("could not prepare github clients for installation %d: %w", installID, err)
+		return "", err
+	}
+
+	clients.tokenMu.RLock()
+	token := clients.accessTokenIfValid()
+	clients.tokenMu.RUnlock()
+
+	if token != nil {
+		return token.GetToken(), nil
 	}
 
-	token, err := clients.transport.Token(ctx)
+	clients.tokenMu.Lock()
+	defer clients.tokenMu.Unlock()
+
+	if token := clients.accessTokenIfValid(); token != nil {
+		return token.GetToken(), nil
+	}
+
+	token, _, err = c.installationClient.Apps.CreateInstallationToken(
+		ctx,
+		installID,
+		&github.InstallationTokenOptions{},
+	)
 	if err != nil {
-		return "", nil, fmt.Errorf("could not create installation token for installation %d: %w", installID, err)
+		return "", fmt.Errorf("could not create installation token for installation %d: %w", installID, err)
 	}
 
-	return git.CloneRepoUsingToken(ctx, token, repoURL, "", "x-access-token", true, args...)
+	if exp := token.GetExpiresAt(); !exp.IsZero() {
+		// Refresh just before the real expiry
+		token.ExpiresAt = &github.Timestamp{Time: exp.Add(-time.Minute)}
+	}
+
+	clients.token = token
+
+	return token.GetToken(), nil
 }
 
 // installationIDForRepo returns the mapped installation ID for repoURL. When no
@@ -325,7 +374,6 @@ func (c *appConnector) createAPIClientsForInstallation(installationID int64) (*a
 	return &appInstallationClients{
 		apiClient:     apiClient,
 		graphqlClient: gqlClient,
-		transport:     transport,
 	}, nil
 }
 
```

**File**: `pkg/sources/github/connector_app_test.go` (modified, +167/-0)
```diff
@@ -10,7 +10,9 @@ import (
 	"net/http/httptest"
 	"strings"
 	"sync"
+	"sync/atomic"
 	"testing"
+	"time"
 
 	"github.com/google/go-github/v67/github"
 	"github.com/shurcooL/githubv4"
@@ -243,6 +245,171 @@ func TestCloneErrorsWithoutResolvedInstallation(t *testing.T) {
 	assert.Contains(t, err.Error(), "no GitHub App installation resolved")
 }
 
+func TestAccessTokenForInstallation(t *testing.T) {
+	privKey := generateTestPrivateKey(t)
+
+	accessTokenServer := func(accessTokenHandler func(w http.ResponseWriter, r *http.Request)) *httptest.Server {
+		return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+			w.Header().Set("Content-Type", "application/json")
+
+			if r.Method == "POST" && strings.Contains(r.URL.Path, "access_tokens") {
+				accessTokenHandler(w, r)
+				return
+			}
+
+			// Default: return empty JSON array for any list endpoint.
+			_ = json.NewEncoder(w).Encode([]interface{}{})
+		}))
+	}
+
+	t.Run("invalid", func(t *testing.T) {
+		_, err := (&appConnector{}).accessTokenForInstallation(trContext.Background(), 0)
+		require.Error(t, err)
+	})
+
+	t.Run("success", func(t *testing.T) {
+		server := accessTokenServer(func(w http.ResponseWriter, r *http.Request) {
+			_ = json.NewEncoder(w).Encode(map[string]interface{}{
+				"token":      "test-token",
+				"expires_at": "2099-01-01T00:00:00Z",
+			})
+		})
+		defer server.Close()
+
+		c, err := NewAppConnector(
+			server.URL,
+			&credentialspb.GitHubApp{PrivateKey: string(privKey), AppId: "12345", InstallationId: "100"},
+			false,
+		)
+		require.NoError(t, err)
+		ac := c.(*appConnector)
+
+		_, err = ac.accessTokenForInstallation(trContext.Background(), 100)
+		require.NoError(t, err)
+	})
+
+	t.Run("rate limit", func(t *testing.T) {
+		server := accessTokenServer(func(w http.ResponseWriter, r *http.Request) {
+			w.Header().Add("X-RateLimit-Remaining", "0")
+			w.WriteHeader(http.StatusForbidden)
+
+			_ = json.NewEncoder(w).Encode(map[string]interface{}{})
+		})
+		defer server.Close()
+
+		c, err := NewAppConnector(
+			server.URL,
+			&credentialspb.GitHubApp{PrivateKey: string(privKey), AppId: "12345", InstallationId: "100"},
+			false,
+		)
+		require.NoError(t, err)
+		ac := c.(*appConnector)
+
+		_, err = ac.accessTokenForInstallation(trContext.Background(), 100)
+		require.Error(t, err)
+
+		var gherr *github.RateLimitError
+		require.ErrorAs(t, err, &gherr)
+	})
+
+	t.Run("not found / no installation", func(t *testing.T) {
+		server := accessTokenServer(func(w http.ResponseWriter, r *http.Request) {
+			w.WriteHeader(http.StatusNotFound)
+
+			_ = json.NewEncoder(w).Encode(map[string]interface{}{})
+		})
+		defer server.Close()
+
+		c, err := NewAppConnector(
+			server.URL,
+			&credentialspb.GitHubApp{PrivateKey: string(privKey), AppId: "12345", InstallationId: "100"},
+			false,
+		)
+		require.NoError(t, err)
+		ac := c.(*appConnector)
+
+		_, err = ac.accessTokenForInstallation(trContext.Background(), 100)
+		require.Error(t, err)
+	})
+
+	t.Run("reuse", func(t *testing.T) {
+		var hits atomic.Int64
+
+		server := accessTokenServer(func(w http.ResponseWriter, r *http.Request) {
+			hits.Add(1)
+			_ = json.NewEncoder(w).Encode(map[string]interface{}{
+				"token":      "test-token",
+				"expires_at": "2099-01-01T00:00:00Z",
+			})
+		})
+		defer server.Close()
+
+		c, err := NewAppConnector(
+			server.URL,
+			&credentialspb.GitHubApp{PrivateKey: string(privKey), AppId: "12345", InstallationId: "100"},
+			false,
+		)
+		require.NoError(t, err)
+		ac := c.(*appConnector)
+
+		_, err = ac.accessTokenForInstallation(trContext.Background(), 100)
+		require.NoError(t, err)
+
+		_, err = ac.accessTokenForInstallation(trContext.Background(), 100)
+		require.NoError(t, err)
+
+		require.Equal(t, int64(1), hits.Load())
+	})
+
+	t.Run("expire", func(t *testing.T) {
+		var hits atomic.Int64
+		server := accessTokenServer(func(w http.ResponseWriter, r *http.Request) {
+			hits.Add(1)
+			_ = json.NewEncoder(w).Encode(map[string]interface{}{
+				"token":      "test-token",
+				"expires_at": "2099-01-01T00:00:00Z",
+			})
+		})
+		defer server.Close()
+
+		c, err := NewAppConnector(
+			server.URL,
+			&credentialspb.GitHubApp{PrivateKey: string(privKey), AppId: "12345", InstallationId: "100"},
+			false,
+		)
+		require.NoError(t, err)
+		ac := c.(*appConnector)
+
+		_, err = ac.accessTokenForInstallation(trContext.Background(), 100)
+		require.NoError(t, err)
+
+		cs, err := ac.clientsForInstallation(100)
+		require.NoError(t, err)
+		token := cs.accessTokenIfValid()
+		require.NotNil(t, token)
+
+		token.ExpiresAt = &github.Timestamp{Time: time.Now()}
+
+		token = cs.accessTokenIfValid()
+		require.Nil(t, token)
+
+		// race these for good measure
+		var wg sync.WaitGroup
+		for range 3 {
+			wg.Go(func() {
+				_, err := ac.accessTokenForInstallation(trContext.Background(), 100)
+				require.NoError(t, err)
+			})
+		}
+		wg.Wait()
+
+		token = cs.accessTokenIfValid()
+		require.NotNil(t, t
```

---

### Incident Patch 3: `e2836087` (2026-10-01)
**Commit Message**: List only the include prefixes in S3 scans (#5377)

* List only the keys under the S3 include prefixes rather than the whole bucket

* Count only the keys under the S3 include prefixes for unit progress

* Validate S3 access with the listing a scan starts with, so prefix scoped policies pass

**File**: `README.md` (modified, +1/-1)
```diff
@@ -684,7 +684,7 @@ Two things to watch when using `--include-extension`. A dotfile counts as all ex
 
 These flags also apply to object keys only, not to files inside an archive. `--exclude-extension=mp4` skips `clip.mp4` sitting in the bucket, but not a `clip.mp4` packed inside `media.zip`. Excluding `zip` skips the archive entirely.
 
-Filtering happens after TruffleHog lists a bucket, so it cuts the cost of downloading objects but not the cost of listing them. A bucket is still paginated in full even when a prefix covers a small part of it.
+TruffleHog asks S3 to list only the keys under the include prefixes, so a prefix that covers a small part of a large bucket is listed quickly. Exclude prefixes and extensions are applied after listing, so they cut the cost of downloading objects but not the cost of listing them.
 
 Prefixes and extensions are applied together. An object has to pass both to be scanned, so the command below scans `src/main.tf` but skips both `src/bundle.zip` and `docs/guide.tf`:
 
```

**File**: `pkg/sources/s3/README.md` (modified, +6/-2)
```diff
@@ -41,7 +41,9 @@ Prefixes are literal, so `--include-prefix=log` matches `logs/app.txt` and `logs
 
 The two kinds are combined with AND: an object has to pass both to be scanned. Entries are trimmed, and blank ones are ignored.
 
-Filtering happens after listing, so it saves `GetObject` requests but not `ListObjectsV2` requests. A bucket is still paginated in full even when a prefix covers a small part of it. Pushing prefixes into `ListObjectsV2Input.Prefix` would cut that too, and has not been done.
+Include prefixes are also sent to S3 as `ListObjectsV2Input.Prefix`. A bucket is listed once per include prefix instead of in full, so the listing covers only the keys they select, and each prefix costs at least one `ListObjectsV2` request per bucket even when nothing is under it. A prefix under another, like `src/vendor/` under `src/`, is dropped, since the shorter one already lists it. Directory buckets are listed in full, because they only accept a prefix that ends in `/`.
+
+Exclude prefixes and extensions have no server-side form, so they are matched after listing. They save `GetObject` requests but not `ListObjectsV2` requests.
 
 Three edge cases worth knowing:
 
@@ -55,7 +57,7 @@ Prefixes are matched with `strings.HasPrefix`, so an exclude prefix naming one k
 
 The same prefixes and extensions apply to every bucket in a scan. There is no way to scope a prefix to one bucket.
 
-If a filter excludes every object in a bucket, the scan logs `Scanned no objects in bucket` with the count, so a mistyped prefix does not look like a clean scan of an empty bucket.
+If a filter excludes every object in a bucket, the scan logs `Scanned no objects in bucket` with the count. If nothing is listed under the include prefixes at all, it logs `Found no objects under the include prefixes`. Either way, a mistyped prefix does not look like a clean scan of an empty bucket.
 
 ## Objects skipped regardless of configuration
 
@@ -83,6 +85,8 @@ The endpoint is parsed in `Init`, so a malformed one fails at startup rather tha
 
 Only consecutive completions are checkpointed. If objects 0 to 5 and 7 to 8 are done but 6 is not, the checkpoint stops at 5, so resuming may rescan a few objects but never misses one.
 
+With include prefixes the scan lists each in turn. They are listed in key order and none is under another, so keys still arrive in ascending order and the checkpoint stays a single key. Resuming passes it as `StartAfter` to every prefix, and S3 returns nothing for the prefixes already finished. A checkpoint from a scan that listed the whole bucket resumes the same way.
+
 This matters when adding a new skip to `pageChunker`: a skipped object still has to call `UpdateObjectCompletion`. Skipping without it stalls the checkpoint at the first skipped object, and a resumed scan then redoes everything after it.
 
 The OSS CLI does not persist progress between runs, so resumption only takes effect where something stores and returns `EncodedResumeInfo`.
```

**File**: `pkg/sources/s3/filter.go` (modified, +26/-1)
```diff
@@ -18,6 +18,8 @@ import (
 //
 // The zero value and a nil *objectFilter both include everything.
 type objectFilter struct {
+	// Sorted, and none starts with another, so a scan can list each in turn and
+	// still see keys in order.
 	includePrefixes []string
 	excludePrefixes []string
 
@@ -40,7 +42,7 @@ func newObjectFilter(includePrefixes, excludePrefixes, includeExtensions, exclud
 	}
 
 	return &objectFilter{
-		includePrefixes:   cleanEntries(includePrefixes, strings.TrimSpace),
+		includePrefixes:   outermostPrefixes(cleanEntries(includePrefixes, strings.TrimSpace)),
 		excludePrefixes:   cleanEntries(excludePrefixes, strings.TrimSpace),
 		includeExtensions: include,
 		excludeExtensions: exclude,
@@ -55,6 +57,15 @@ func (f *objectFilter) shouldInclude(key string) bool {
 	return f.passesPrefixes(key) && f.passesExtensions(key)
 }
 
+// listPrefixes returns the include prefixes for S3 to list in place of the whole
+// bucket, or nil when the whole bucket is listed.
+func (f *objectFilter) listPrefixes() []string {
+	if f == nil {
+		return nil
+	}
+	return f.includePrefixes
+}
+
 func (f *objectFilter) passesPrefixes(key string) bool {
 	for _, prefix := range f.excludePrefixes {
 		if strings.HasPrefix(key, prefix) {
@@ -113,6 +124,20 @@ func cleanExtensions(values []string) []string {
 	return slices.Compact(exts)
 }
 
+// outermostPrefixes sorts prefixes and drops each one that starts with another,
+// since the shorter one already covers every key under it. Once sorted, a prefix
+// that starts with any kept prefix starts with the last one kept.
+func outermostPrefixes(prefixes []string) []string {
+	slices.Sort(prefixes)
+	var kept []string
+	for _, prefix := range prefixes {
+		if len(kept) == 0 || !strings.HasPrefix(prefix, kept[len(kept)-1]) {
+			kept = append(kept, prefix)
+		}
+	}
+	return kept
+}
+
 // cleanEntries normalizes each entry and drops the ones that come out empty,
 // returning nil when nothing is left.
 func cleanEntries(values []string, normalize func(string) string) []string {
```

**File**: `pkg/sources/s3/filter_test.go` (modified, +12/-0)
```diff
@@ -21,6 +21,7 @@ func TestObjectFilter_Unconfigured(t *testing.T) {
 	assert.True(t, filter.shouldInclude("any/key.zip"))
 	assert.True(t, filter.shouldInclude("Makefile"))
 	assert.True(t, (*objectFilter)(nil).shouldInclude("any/key.zip"))
+	assert.Nil(t, (*objectFilter)(nil).listPrefixes())
 }
 
 func TestObjectFilter_ExcludePrefix(t *testing.T) {
@@ -48,6 +49,17 @@ func TestObjectFilter_IncludeAndExcludePrefixes(t *testing.T) {
 	assert.False(t, filter.shouldInclude("docs/readme.md"), "matches no include prefix")
 }
 
+// A scan lists the include prefixes in turn, so they must come out sorted with
+// none under another, or keys would be listed twice or out of order.
+func TestObjectFilter_IncludePrefixesAreOutermost(t *testing.T) {
+	include := []string{"src/vendor/", "src/", "docs/", "src/", "a", "ab", "ac"}
+	filter := newTestObjectFilter(t, include, nil, nil, nil)
+
+	assert.Equal(t, []string{"a", "docs/", "src/"}, filter.listPrefixes())
+	assert.True(t, filter.shouldInclude("src/vendor/dep.go"), "a dropped prefix is still covered")
+	assert.True(t, filter.shouldInclude("ac/key.txt"))
+}
+
 func TestObjectFilter_ExcludeExtension(t *testing.T) {
 	filter := newTestObjectFilter(t, nil, nil, nil, []string{"zip", ".MP4"})
 
```

**File**: `pkg/sources/s3/paginator.go` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+package s3
+
+import (
+	"fmt"
+	"strings"
+
+	"github.com/aws/aws-sdk-go-v2/aws"
+	"github.com/aws/aws-sdk-go-v2/service/s3"
+
+	"github.com/trufflesecurity/trufflehog/v3/pkg/context"
+)
+
+// directoryBucketSuffix ends every S3 Express directory bucket name, and AWS reserves it for them.
+const directoryBucketSuffix = "--x-s3"
+
+// listInputs returns the listings that cover what a scan of the bucket can include: one per include
+// prefix, so S3 skips the keys outside them, or one of the whole bucket.
+//
+// The include prefixes are sorted and none starts with another, so listing them in turn returns keys
+// in ascending order, just as one listing of the bucket would. That keeps the checkpoint a single
+// start-after key, and passing it to every listing resumes exactly where the scan stopped: S3
+// returns nothing for the prefixes the scan already finished.
+func (s *Source) listInputs(bucket string, startAfter *string) []*s3.ListObjectsV2Input {
+	prefixes := s.objectFilter.listPrefixes()
+	// Directory buckets only accept a prefix that ends in "/", so they are listed whole and filtered after.
+	if len(prefixes) == 0 || strings.HasSuffix(bucket, directoryBucketSuffix) {
+		return []*s3.ListObjectsV2Input{{Bucket: &bucket, StartAfter: startAfter}}
+	}
+
+	inputs := make([]*s3.ListObjectsV2Input, len(prefixes))
+	for i, prefix := range prefixes {
+		inputs[i] = &s3.ListObjectsV2Input{Bucket: &bucket, Prefix: aws.String(prefix), StartAfter: startAfter}
+	}
+	return inputs
+}
+
+// bucketPaginator pages through several listings in turn, as if they were one.
+type bucketPaginator struct {
+	client *s3.Client
+	// inputs[0] is the listing in progress, and the rest are still to come.
+	inputs []*s3.ListObjectsV2Input
+	pages  *s3.ListObjectsV2Paginator
+}
+
+// newBucketPaginator starts with the first of inputs, which must not be empty.
+func newBucketPaginator(client *s3.Client, inputs []*s3.ListObjectsV2Input) *bucketPaginator {
+	return &bucketPaginator{client: client, inputs: inputs, pages: s3.NewListObjectsV2Paginator(client, inputs[0])}
+}
+
+// HasMorePages reports whether any listing has pages left, moving on to the next listing when the
+// current one is done.
+func (p *bucketPaginator) HasMorePages() bool {
+	for !p.pages.HasMorePages() {
+		if len(p.inputs) == 1 {
+			return false
+		}
+		p.inputs = p.inputs[1:]
+		p.pages = s3.NewListObjectsV2Paginator(p.client, p.inputs[0])
+	}
+	return true
+}
+
+// NextPage returns the next page of the current listing.
+func (p *bucketPaginator) NextPage(ctx context.Context) (*s3.ListObjectsV2Output, error) {
+	page, err := p.pages.NextPage(ctx)
+	if err != nil && p.inputs[0].Prefix != nil {
+		// A policy can allow listing some prefixes and not others, so say which one failed.
+		err = fmt.Errorf("could not list prefix %q: %w", *p.inputs[0].Prefix, err)
+	}
+	return page, err
+}
```

**File**: `pkg/sources/s3/paginator_test.go` (added, +249/-0)
```diff
@@ -0,0 +1,249 @@
+package s3
+
+import (
+	"slices"
+	"strings"
+	"sync"
+	"testing"
+
+	"github.com/aws/aws-sdk-go-v2/aws"
+	"github.com/go-logr/logr/funcr"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+
+	"github.com/trufflesecurity/trufflehog/v3/pkg/context"
+	"github.com/trufflesecurity/trufflehog/v3/pkg/pb/sourcespb"
+	"github.com/trufflesecurity/trufflehog/v3/pkg/sources"
+	"github.com/trufflesecurity/trufflehog/v3/pkg/sourcestest"
+)
+
+func TestSource_ListInputs(t *testing.T) {
+	startAfter := "infra/main.tf"
+
+	tests := []struct {
+		name         string
+		bucket       string
+		prefixes     []string
+		wantPrefixes []string
+	}{
+		{name: "no include prefixes", bucket: "bucket", wantPrefixes: []string{""}},
+		{
+			name:         "one listing per include prefix, in key order",
+			bucket:       "bucket",
+			prefixes:     []string{"src/", "infra/"},
+			wantPrefixes: []string{"infra/", "src/"},
+		},
+		{
+			name:         "directory bucket",
+			bucket:       "data--usw2-az1--x-s3",
+			prefixes:     []string{"src"},
+			wantPrefixes: []string{""},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			s := Source{objectFilter: newTestObjectFilter(t, tt.prefixes, nil, nil, nil)}
+
+			var gotPrefixes []string
+			for _, input := range s.listInputs(tt.bucket, &startAfter) {
+				assert.Equal(t, tt.bucket, aws.ToString(input.Bucket))
+				assert.Equal(t, startAfter, aws.ToString(input.StartAfter), "every listing resumes at the checkpoint")
+				gotPrefixes = append(gotPrefixes, aws.ToString(input.Prefix))
+			}
+			assert.Equal(t, tt.wantPrefixes, gotPrefixes)
+		})
+	}
+}
+
+// prefixTestObjects has keys under the include prefixes the tests below use, one of them nested in
+// another, and keys between and around them that no include prefix covers.
+func prefixTestObjects() map[string]string {
+	objects := make(map[string]string)
+	for _, key := range []string{
+		"configs/app.yaml",
+		"infra/main.tf", "infra/vars.tf",
+		"logs/1.log", "logs/2.log", "logs/3.log", "logs/4.log",
+		"src/main.go", "src/vendor/dep.go",
+		"tests/main_test.go",
+	} {
+		objects[key] = "contents of " + key
+	}
+	return objects
+}
+
+func withIncludePrefixes(prefixes ...string) func(*sourcespb.S3) {
+	return func(conn *sourcespb.S3) { conn.IncludePrefixes = prefixes }
+}
+
+// scannedKeys counts the chunks reported for each object.
+func scannedKeys(chunks []sources.Chunk) map[string]int {
+	keys := make(map[string]int)
+	for _, chunk := range chunks {
+		keys[chunk.SourceMetadata.GetS3().GetFile()]++
+	}
+	return keys
+}
+
+func TestSource_ChunkUnit_ListsOnlyIncludePrefixes(t *testing.T) {
+	fake := &fakeS3{buckets: map[string]fakeBucket{"bucket": {objects: prefixTestObjects()}}}
+	s := newFakeS3Source(t, fake, withIncludePrefixes("src/", "infra/", "src/vendor/"))
+
+	reporter := sourcestest.TestReporter{}
+	require.NoError(t, s.ChunkUnit(context.Background(), S3SourceUnit{Bucket: "bucket"}, &reporter))
+
+	want := map[string]int{"infra/main.tf": 1, "infra/vars.tf": 1, "src/main.go": 1, "src/vendor/dep.go": 1}
+	assert.Equal(t, want, scannedKeys(reporter.Chunks), "each object under a prefix is scanned once")
+	// infra/ and src/ fit a page each, where listing the whole bucket takes six.
+	assert.EqualValues(t, 2, fake.listCalls.Load())
+}
+
+// A checkpoint is the last key the scan finished, whether it lies under an include prefix or not, as
+// one left by a scan that listed the whole bucket may.
+func TestSource_ChunkUnit_ResumesAcrossIncludePrefixes(t *testing.T) {
+	tests := []struct {
+		name       string
+		startAfter string
+		want       []string
+	}{
+		{
+			name:       "before every prefix",
+			startAfter: "a",
+			want:       []string{"infra/main.tf", "infra/vars.tf", "src/main.go", "src/vendor/dep.go"},
+		},
+		{
+			name:       "within a prefix",
+			startAfter: "infra/main.tf",
+			want:       []string{"infra/vars.tf", "src/main.go", "src/vendor/dep.go"},
+		},
+		{name: "between prefixes", startAfter: "logs/3.log", want: []string{"src/main.go", "src/vendor/dep.go"}},
+		{name: "before a nested prefix", startAfter: "src/main.go", want: []string{"src/vendor/dep.go"}},
+		{name: "after every prefix", startAfter: "tests/main_test.go"},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			fake := &fakeS3{buckets: map[string]fakeBucket{"bucket": {objects: prefixTestObjects()}}}
+			s := newFakeS3Source(t, fake, withIncludePrefixes("infra/", "src/", "src/vendor/"))
+
+			unit := S3SourceUnit{Bucket: "bucket"}
+			unitID, _ := unit.SourceUnitID()
+			s.SetEncodedResumeInfoFor(unitID, tt.startAfter)
+
+			reporter := sourcestest.TestReporter{}
+			require.NoError(t, s.ChunkUnit(context.Background(), unit, &reporter))
+
+			want := make(map[string]int)
+			for _, key := range tt.want {
+				want[key] = 1
+			}
+			assert.Equal(t, want, scannedKeys(reporter.Chunks))
+		})
+	}
+}
+
+// S3 applies the include prefixes itself, 
```

**File**: `pkg/sources/s3/progress.go` (modified, +4/-4)
```diff
@@ -111,17 +111,17 @@ func (s *Source) startCount(
 	}
 }
 
-// countBucket lists the whole bucket once to add up the objects the scan downloads and their size,
-// since S3 has no API that reports either. Keys at or before startAfter were finished by an earlier
-// run, so they count as done too. Nothing is kept per object.
+// countBucket lists the bucket from the start, the same way the scan does, to add up the objects the
+// scan downloads and their size, since S3 has no API that reports either. Keys at or before startAfter
+// were finished by an earlier run, so they count as done too. Nothing is kept per object.
 func (s *Source) countBucket(
 	ctx context.Context,
 	client *s3.Client,
 	bucket string,
 	startAfter *string,
 	progress *unitProgress,
 ) {
-	paginator := s3.NewListObjectsV2Paginator(client, &s3.ListObjectsV2Input{Bucket: &bucket})
+	paginator := newBucketPaginator(client, s.listInputs(bucket, nil))
 	for paginator.HasMorePages() {
 		page, err := paginator.NextPage(ctx)
 		if err != nil {
```

**File**: `pkg/sources/s3/progress_test.go` (modified, +18/-5)
```diff
@@ -133,6 +133,8 @@ type fakeBucket struct {
 	// countDelay holds back listings that start from the beginning of the bucket, which only the count
 	// makes when the scan is resumed, so a test can make the scan finish first.
 	countDelay time.Duration
+	// listPrefix denies listings outside it, as an IAM policy on s3:prefix does.
+	listPrefix string
 }
 
 // fakeS3 serves the parts of the S3 API a unit scan uses, path style, two keys per page.
@@ -171,6 +173,12 @@ func (f *fakeS3) list(w http.ResponseWriter, r *http.Request, name string, bucke
 	const pageSize = 2
 
 	query := r.URL.Query()
+	prefix := query.Get("prefix")
+	if !strings.HasPrefix(prefix, bucket.listPrefix) {
+		http.Error(w, "access denied", http.StatusForbidden)
+		return
+	}
+
 	after := query.Get("continuation-token")
 	if after == "" {
 		after = query.Get("start-after")
@@ -181,7 +189,7 @@ func (f *fakeS3) list(w http.ResponseWriter, r *http.Request, name string, bucke
 
 	keys := make([]string, 0, len(bucket.objects))
 	for key := range bucket.objects {
-		if key > after {
+		if strings.HasPrefix(key, prefix) && key > after {
 			keys = append(keys, key)
 		}
 	}
@@ -220,16 +228,21 @@ func sleep(r *http.Request, d time.Duration) bool {
 	}
 }
 
-// newFakeS3Source starts fake as an S3-compatible endpoint and returns a source initialized against it.
-func newFakeS3Source(t *testing.T, fake *fakeS3) *Source {
+// newFakeS3Source starts fake as an S3-compatible endpoint and returns a source initialized against it,
+// after configure has adjusted the connection.
+func newFakeS3Source(t *testing.T, fake *fakeS3, configure ...func(*sourcespb.S3)) *Source {
 	t.Helper()
 	server := httptest.NewServer(fake)
 	t.Cleanup(server.Close)
 
-	conn, err := anypb.New(&sourcespb.S3{
+	s3Conn := &sourcespb.S3{
 		Credential: &sourcespb.S3_Unauthenticated{},
 		Endpoint:   server.URL,
-	})
+	}
+	for _, f := range configure {
+		f(s3Conn)
+	}
+	conn, err := anypb.New(s3Conn)
 	require.NoError(t, err)
 
 	s := &Source{}
```

---

### Incident Patch 4: `d5ef0f38` (2026-10-01)
**Commit Message**: fix(detectors/auth0oauth): match Auth0 Private Cloud auth0app.com domains (#5354)

domainPat required the literal substring auth0.com, so it never matched
Auth0 Private Cloud tenants' default managed domain (*.auth0app.com). Since
FromData only emits a result when a client_id, client_secret, and a domain
match are all present together, a leaked credential pair next to its real
Private Cloud domain was silently dropped -- no result, no verification
attempt.

*.auth0app.com is Auth0's own documented default for Private Cloud tenants,
not a one-off customer naming choice:
https://auth0.com/docs/migrate-private-cloud-custom-domains

Add an optional, non-capturing app group so domainPat matches both
*.auth0.com and *.auth0app.com. Fully custom domains (e.g. login.example.com)
have no learnable Auth0-related substring and remain out of scope.

A pre-existing, unrelated regex quirk was discovered while adding regression
tests: a bare domain with no leading character (e.g. "auth0.com" or
"auth0app.com" with no subdomain/prefix at all) never matches, since the
leading character class must be consumed before the literal "auth0"
substring. Left as a TODO on domainPat rather than fixed here, s

**File**: `pkg/detectors/auth0oauth/auth0oauth.go` (modified, +5/-1)
```diff
@@ -27,7 +27,11 @@ var (
 
 	clientIdPat     = regexp.MustCompile(detectors.PrefixRegex([]string{"auth0"}) + `\b([a-zA-Z0-9_-]{32,60})\b`)
 	clientSecretPat = regexp.MustCompile(`\b([a-zA-Z0-9_-]{64,})\b`)
-	domainPat       = regexp.MustCompile(`\b([a-zA-Z0-9][a-zA-Z0-9._-]*auth0\.com)\b`) // could be part of url
+	// could be part of url; auth0app.com is Auth0's managed domain for Private Cloud tenants.
+	// TODO: a bare domain with no leading character (e.g. "auth0.com" or "auth0app.com" with
+	// no subdomain/prefix at all) never matches, since the leading character class must be
+	// consumed before the literal "auth0" substring. Pre-existing, unrelated to this fix.
+	domainPat = regexp.MustCompile(`\b([a-zA-Z0-9][a-zA-Z0-9._-]*auth0(?:app)?\.com)\b`)
 )
 
 // Keywords are used for efficiently pre-filtering chunks.
```

**File**: `pkg/detectors/auth0oauth/auth0oauth_test.go` (modified, +43/-2)
```diff
@@ -50,13 +50,54 @@ func TestAuth0oAuth_Pattern(t *testing.T) {
 			name: "invalid pattern",
 			input: `
 				# do not share these credentials
-				auth0_credentials file: 
+				auth0_credentials file:
 					auth0_clientID: e4T9Cw1CtwE8ufoESVBB7Hi1U-e4T9Cw1CtwE8ufoESVBB7Hi1U
-					secret: MBqIYgxH0vZaL1s5314lgPDLqHX^ZsY59PSew63A_L6rySqcy5J3rFcGcpdeSQ_+tTx1kCXOZY_JUy-rXwGtKCleBsaUfpchggQEAy_yhzWnqv4_GzJivBif85bqiJi3ZA63DAauoJ2PF27fvS 
+					secret: MBqIYgxH0vZaL1s5314lgPDLqHX^ZsY59PSew63A_L6rySqcy5J3rFcGcpdeSQ_+tTx1kCXOZY_JUy-rXwGtKCleBsaUfpchggQEAy_yhzWnqv4_GzJivBif85bqiJi3ZA63DAauoJ2PF27fvS
 					domain: 9-KhTIdSopSaMQ2v1YxdFEJN#qd51AzSGQu2yRaFauth1.com
 				`,
 			want: nil,
 		},
+		{
+			// Auth0 Private Cloud tenants default to an Auth0-managed domain in
+			// the form *.auth0app.com rather than *.auth0.com.
+			name: "valid pattern - private cloud auth0app.com domain",
+			input: `
+				# do not share these credentials
+				auth0_credentials file:
+					auth0_clientID: odJFCrnl2edlBDdz1C5Jau2RJtBRnlWmTSHf6pWk
+					secret: 6sHrFH2ZUCr-lgotu2iXW7GboIRoL3u6aHwnMztVuaP_coUNEhEkk_iqq8vH2BzNZV45pF
+					domain: api.example-corp.auth0app.com
+				`,
+			want: []string{"odJFCrnl2edlBDdz1C5Jau2RJtBRnlWmTSHf6pWk6sHrFH2ZUCr-lgotu2iXW7GboIRoL3u6aHwnMztVuaP_coUNEhEkk_iqq8vH2BzNZV45pF"},
+		},
+		{
+			// word-boundary behavior is unchanged by this fix: a leading run of
+			// word characters immediately before "auth0app.com" still matches in
+			// full, same as it already does today for "...auth0.com" domains.
+			name: "valid pattern - auth0app.com with no separator before suffix",
+			input: `
+				# do not share these credentials
+				auth0_credentials file:
+					auth0_clientID: tyLBhhOhg9uhkxiiEZpFfk1OHAOEHYqM6Ojb
+					secret: 6mjBHqSiFVKu4MbMnrHontIKARAH_Ggl2JfaQqHu42bojteVs3qfNUfTAFnT0tEuw0dwQ0FIunWe8Cz6
+					domain: xauth0app.com
+				`,
+			want: []string{"tyLBhhOhg9uhkxiiEZpFfk1OHAOEHYqM6Ojb6mjBHqSiFVKu4MbMnrHontIKARAH_Ggl2JfaQqHu42bojteVs3qfNUfTAFnT0tEuw0dwQ0FIunWe8Cz6"},
+		},
+		{
+			// a domain with neither the "auth0.com" nor "auth0app.com" suffix
+			// must not match — the optional (?:app)? group must not degrade the
+			// pattern into matching arbitrary ".com" domains.
+			name: "invalid pattern - domain has neither auth0.com nor auth0app.com suffix",
+			input: `
+				# do not share these credentials
+				auth0_credentials file:
+					auth0_clientID: SNDCdyZQJiJSZQdoHwHen3SO3oXyGf3azU3iQOpMN0PZ
+					secret: Lqy1WwMZaMKA3P744B8vkKQlENCzsdfF8j61yX-ZFsan2Cw7gFp6r7O425u85HFJ_EJ4jKEIQOkrtDXtBi10Q71hA1
+					domain: api.example.com
+				`,
+			want: nil,
+		},
 	}
 
 	for _, test := range tests {
```

---

### Incident Patch 5: `5d8d4a3f` (2026-09-30)
**Commit Message**: resolve race condition in result deduplication cache (#5359)

**File**: `pkg/engine/engine.go` (modified, +3/-2)
```diff
@@ -1357,14 +1357,15 @@ func (e *Engine) notifierWorker(ctx context.Context) {
 		// This deduplication only applies to results that are *not*
 		// from reverification, since we are expected to see the same
 		// result from reverification and want to Dispatch it below.
+
+		// Notifier workers share this cache; the check and insert must be one atomic step.
 		if result.SecretID == 0 {
 			h := md5.Sum([]byte(fmt.Sprintf("%s%s%s%s%+v", result.DetectorName, result.DetectorType.String(), result.Raw, result.RawV2, result.SourceMetadata)))
 			key := string(h[:])
-			if _, ok := e.dedupeCache.Get(key); ok {
+			if found, _ := e.dedupeCache.ContainsOrAdd(key, struct{}{}); found {
 				resultsDropped.WithLabelValues("notifier", "dedupe_cache_hit", detectorNameStr).Inc()
 				continue
 			}
-			e.dedupeCache.Add(key, struct{}{})
 		}
 
 		if result.Verified {
```

**File**: `pkg/engine/engine_test.go` (modified, +73/-1)
```diff
@@ -9,6 +9,7 @@ import (
 	"net/http/httptest"
 	"os"
 	"path/filepath"
+	"sync"
 	"sync/atomic"
 	"testing"
 	"time"
@@ -2244,12 +2245,17 @@ func TestEngine_IterativeDecoding(t *testing.T) {
 	}
 }
 
-// captureDispatcher records every dispatched result for assertion in tests.
+// captureDispatcher records every dispatched result for assertion in tests. It
+// is safe for concurrent use because the engine runs many notifier workers
+// against a single dispatcher.
 type captureDispatcher struct {
+	mu      sync.Mutex
 	results []detectors.ResultWithMetadata
 }
 
 func (d *captureDispatcher) Dispatch(_ context.Context, result detectors.ResultWithMetadata) error {
+	d.mu.Lock()
+	defer d.mu.Unlock()
 	d.results = append(d.results, result)
 	return nil
 }
@@ -2318,6 +2324,72 @@ func TestNotifierWorker_ReverifiedResultsBypassDedupe(t *testing.T) {
 	}
 }
 
+// TestNotifierWorker_ConcurrentDuplicatesDispatchedOnce verifies that when many
+// notifier workers share the dedupe cache, identical results are dispatched
+// exactly once. The check-and-insert must be atomic; a separate lookup and add
+// lets two workers both miss and both dispatch.
+//
+// The race exists only on a key's first sighting, so the test uses many distinct
+// secrets and queues each one's copies back to back, giving every key its own
+// chance for workers to collide. It guards a logical race rather than a data
+// race, so -race does not flag the non-atomic version.
+func TestNotifierWorker_ConcurrentDuplicatesDispatchedOnce(t *testing.T) {
+	const (
+		numSecrets = 1000
+		numCopies  = 16
+		numWorkers = 16
+	)
+
+	// Sized to hold every key so eviction cannot cause a re-dispatch.
+	cache, err := lru.New[string, struct{}](numSecrets)
+	require.NoError(t, err)
+
+	disp := &captureDispatcher{}
+	e := &Engine{
+		results:                 make(chan detectors.ResultWithMetadata, numSecrets*numCopies),
+		dedupeCache:             cache,
+		dispatcher:              disp,
+		notifyVerifiedResults:   true,
+		notifyUnverifiedResults: true,
+		notifyUnknownResults:    true,
+	}
+
+	// Fill and close the channel before starting workers so they all contend
+	// on the cache at once instead of idling on an empty channel. SecretID
+	// stays 0 so every copy goes through the dedupe cache.
+	for i := range numSecrets {
+		result := detectors.ResultWithMetadata{
+			SourceMetadata: &source_metadatapb.MetaData{
+				Data: &source_metadatapb.MetaData_Git{
+					Git: &source_metadatapb.Git{Line: 1},
+				},
+			},
+			SourceType: sourcespb.SourceType_SOURCE_TYPE_GIT,
+			Result: detectors.Result{
+				DetectorType: detector_typepb.DetectorType(-1),
+				Raw:          []byte(fmt.Sprintf("secret-%d", i)),
+				Verified:     true,
+			},
+		}
+		for range numCopies {
+			e.results <- result
+		}
+	}
+	close(e.results)
+
+	var wg sync.WaitGroup
+	for range numWorkers {
+		wg.Add(1)
+		go func() {
+			defer wg.Done()
+			e.notifierWorker(context.Background())
+		}()
+	}
+	wg.Wait()
+
+	assert.Equal(t, numSecrets, len(disp.results))
+}
+
 func setupSourceMappingBench(size int, decode bool) (*sources.Chunk, *detectors.Result) {
 	secret := []byte("synthetic-secret-value-123456")
 	var original, decoded []byte
```

---

### Incident Patch 6: `48b58d3b` (2026-09-29)
**Commit Message**: fix(portainertoken): remove stray fmt.Printf on invalid URL (#5334)

Co-authored-by: Gracy769 <[REDACTED_EMAIL]>
Co-authored-by: Shahzad Haider <[REDACTED_EMAIL]>

**File**: `pkg/detectors/portainertoken/portainertoken.go` (modified, +0/-1)
```diff
@@ -48,7 +48,6 @@ func (s Scanner) FromData(ctx context.Context, verify bool, data []byte) (result
 
 			u, err := detectors.ParseURLAndStripPathAndParams(resEndpointMatch)
 			if err != nil {
-				fmt.Printf("\nINVALID URL\n")
 				// if the URL is invalid just move onto the next one
 				continue
 			}
```

---

### Incident Patch 7: `8135b80f` (2026-09-29)
**Commit Message**: fix(output): escape special characters in --github-actions output (#5353)

* fix(output): escape special characters in --github-actions output

Git allows characters in file paths that GitHub's workflow-command syntax
does not — most notably newlines. When such a path is read back from a diff
and printed as part of a ::warning:: command in --github-actions output
mode, the result can be malformed and split across multiple lines that
GitHub Actions doesn't expect.

Escape file paths and messages before printing, per GitHub's documented
escaping rules for workflow commands (percent-encode '%', '\r', '\n', and
additionally ':'/',' for the file= property value).

Extract the command-building into formatWarningCommand() so this is covered
by unit tests, following the same data/IO separation SarifPrinter already
uses.

Reported by kenanyararbas <[REDACTED_EMAIL]>.

* fix(output): drop doc comments on new helpers to match file convention

Print() and the other helpers in this file (structToMap, extractFileAndLine)
carry no doc comments, so match that rather than introducing one-off
commented functions.

**File**: `pkg/output/github_actions.go` (modified, +21/-2)
```diff
@@ -4,6 +4,7 @@ import (
 	"crypto/sha256"
 	"encoding/hex"
 	"fmt"
+	"strings"
 	"sync"
 
 	"github.com/trufflesecurity/trufflehog/v3/pkg/context"
@@ -57,12 +58,30 @@ func (p *GitHubActionsPrinter) Print(_ context.Context, r *detectors.ResultWithM
 		message = fmt.Sprintf("Found %s %s%s result with %s encoding 🐷🔑\n", verifiedStatus, out.DetectorType, name, out.DecoderType)
 	}
 
-	fmt.Printf("::warning file=%s,line=%d,endLine=%d::%s",
-		out.Filename, out.StartLine, out.StartLine, message)
+	fmt.Print(formatWarningCommand(out.Filename, out.StartLine, message))
 
 	return nil
 }
 
+func formatWarningCommand(file string, line int64, message string) string {
+	return fmt.Sprintf("::warning file=%s,line=%d,endLine=%d::%s\n",
+		escapeWorkflowProperty(file), line, line, escapeWorkflowData(strings.TrimSuffix(message, "\n")))
+}
+
+func escapeWorkflowData(s string) string {
+	s = strings.ReplaceAll(s, "%", "%25")
+	s = strings.ReplaceAll(s, "\r", "%0D")
+	s = strings.ReplaceAll(s, "\n", "%0A")
+	return s
+}
+
+func escapeWorkflowProperty(s string) string {
+	s = escapeWorkflowData(s)
+	s = strings.ReplaceAll(s, ":", "%3A")
+	s = strings.ReplaceAll(s, ",", "%2C")
+	return s
+}
+
 type gitHubActionsOutputFormat struct {
 	DetectorType        string
 	DetectorDescription string
```

**File**: `pkg/output/github_actions_test.go` (added, +97/-0)
```diff
@@ -0,0 +1,97 @@
+package output
+
+import (
+	"strings"
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+
+	"github.com/trufflesecurity/trufflehog/v3/pkg/context"
+	"github.com/trufflesecurity/trufflehog/v3/pkg/detectors"
+	"github.com/trufflesecurity/trufflehog/v3/pkg/pb/detector_typepb"
+	"github.com/trufflesecurity/trufflehog/v3/pkg/pb/source_metadatapb"
+	"github.com/trufflesecurity/trufflehog/v3/pkg/pb/sourcespb"
+)
+
+// gitResultWithFile builds a verified git-family result whose file path is caller-controlled,
+// mirroring a path decoded by pkg/gitparse that can contain characters git allows in paths,
+// such as a newline.
+func gitResultWithFile(file string) *detectors.ResultWithMetadata {
+	return &detectors.ResultWithMetadata{
+		SourceMetadata: &source_metadatapb.MetaData{
+			Data: &source_metadatapb.MetaData_Git{
+				Git: &source_metadatapb.Git{File: file, Line: 1},
+			},
+		},
+		SourceType: sourcespb.SourceType_SOURCE_TYPE_GIT,
+		SourceName: "my-repo",
+		Result: detectors.Result{
+			DetectorType: detector_typepb.DetectorType_Github,
+			Raw:          []byte("secret"),
+			Verified:     false,
+		},
+	}
+}
+
+func TestEscapeWorkflowData(t *testing.T) {
+	tests := []struct {
+		name string
+		in   string
+		want string
+	}{
+		{"plain text is untouched", "config/prod.yaml", "config/prod.yaml"},
+		{"newline is escaped", "a\nb", "a%0Ab"},
+		{"carriage return is escaped", "a\rb", "a%0Db"},
+		{"percent is escaped first so it can't unmask other sequences", "100%\n", "100%25%0A"},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			assert.Equal(t, tt.want, escapeWorkflowData(tt.in))
+		})
+	}
+}
+
+func TestEscapeWorkflowProperty(t *testing.T) {
+	tests := []struct {
+		name string
+		in   string
+		want string
+	}{
+		{"plain text is untouched", "config/prod.yaml", "config/prod.yaml"},
+		{"colon is escaped", "a:b", "a%3Ab"},
+		{"comma is escaped", "a,b", "a%2Cb"},
+		{"newline is escaped, same as data", "a\nb", "a%0Ab"},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			assert.Equal(t, tt.want, escapeWorkflowProperty(tt.in))
+		})
+	}
+}
+
+// TestFormatWarningCommand_EscapesSpecialCharactersInFilename covers a file path containing
+// characters git allows but the workflow-command syntax does not: git permits newlines in file
+// paths, and gitparse decodes the git-quoted diff-header form back into a real newline (see
+// pkg/gitparse pathFromToFileLine). Unescaped, an embedded newline followed by "::" would start
+// what looks like a second workflow command on its own line.
+func TestFormatWarningCommand_EscapesSpecialCharactersInFilename(t *testing.T) {
+	unusualFile := "readme.md\n::error title=example::some text\n::add-mask::some-value"
+
+	got := formatWarningCommand(unusualFile, 1, "Found unverified result\n")
+
+	require.Equal(t, 1, strings.Count(got, "\n"), "output must be exactly one line (plus its trailing newline)")
+	assert.NotContains(t, got, "\n::error", "no unescaped newline should start a new line")
+	assert.NotContains(t, got, "\n::add-mask", "no unescaped newline should start a new line")
+	assert.Contains(t, got, "%0A", "the embedded newlines must survive, escaped, rather than being silently dropped")
+	assert.True(t, strings.HasPrefix(got, "::warning file="), "the tool's own command must still be well-formed")
+}
+
+func TestGitHubActionsPrinter_Print_HandlesFilenameWithSpecialCharacters(t *testing.T) {
+	dedupeCache = make(map[string]struct{}) // isolate from other tests sharing the package-level cache
+
+	p := &GitHubActionsPrinter{}
+	unusualFile := "readme.md\n::stop-commands::deadbeef"
+
+	require.NoError(t, p.Print(context.Background(), gitResultWithFile(unusualFile)))
+}
```

---

### Incident Patch 8: `54c65cda` (2026-09-28)
**Commit Message**: Revert duplicate --no-ignore-tag changes from #5293 (#5369)

**File**: `docs/man/trufflehog.1` (modified, +0/-3)
```diff
@@ -59,9 +59,6 @@ Allow verification of similar credentials across detectors
 \fB--filter-unverified\fR
 Only output first unverified result per chunk per detector if there are more than one results.
 .TP
-\fB--no-ignore-tag\fR
-Do not suppress results on lines containing a 'trufflehog:ignore' comment.
-.TP
 \fB--filter-entropy=FILTER-ENTROPY\fR
 Filter unverified results with Shannon entropy. Start with 3.0.
 .TP
```

**File**: `main.go` (modified, +0/-2)
```diff
@@ -65,7 +65,6 @@ var (
 
 	allowVerificationOverlap   = cli.Flag("allow-verification-overlap", "Allow verification of similar credentials across detectors").Bool()
 	filterUnverified           = cli.Flag("filter-unverified", "Only output first unverified result per chunk per detector if there are more than one results.").Bool()
-	noIgnoreTag                = cli.Flag("no-ignore-tag", "Do not suppress results on lines containing a 'trufflehog:ignore' comment.").Bool()
 	filterEntropy              = cli.Flag("filter-entropy", "Filter unverified results with Shannon entropy. Start with 3.0.").Float64()
 	noIgnoreTag                = cli.Flag("no-ignore-tag", "Report results even if the line has a 'trufflehog:ignore' comment.").Bool()
 	scanEntireChunk            = cli.Flag("scan-entire-chunk", "Scan the entire chunk for secrets.").Hidden().Default("false").Bool()
@@ -661,7 +660,6 @@ func run(state overseer.State, logSync func() error) {
 		VerifierEndpoints:        *verifiers,
 		Dispatcher:               engine.NewPrinterDispatcher(printer),
 		FilterUnverified:         *filterUnverified,
-		NoIgnoreTag:              *noIgnoreTag,
 		FilterEntropy:            *filterEntropy,
 		NoIgnoreTag:              *noIgnoreTag,
 		VerificationOverlap:      *allowVerificationOverlap,
```

**File**: `pkg/engine/engine.go` (modified, +1/-8)
```diff
@@ -123,10 +123,7 @@ type Config struct {
 	FilterEntropy float64
 	// FilterUnverified sets the filterUnverified flag on the engine. If set to
 	// true, the engine will only return the first unverified result for a chunk for a detector.
-	FilterUnverified bool
-	// NoIgnoreTag, when true, disables the default behavior of dropping results
-	// whose line contains a "trufflehog:ignore" comment.
-	NoIgnoreTag           bool
+	FilterUnverified      bool
 	ShouldScanEntireChunk bool
 
 	// NoIgnoreTag disables the "trufflehog:ignore" tag. If set to true, results are
@@ -191,9 +188,6 @@ type Engine struct {
 	// If there are multiple unverified results for the same chunk for the same detector,
 	// only the first one will be kept.
 	filterUnverified bool
-	// noIgnoreTag disables suppression of results on lines containing the
-	// "trufflehog:ignore" comment tag.
-	noIgnoreTag bool
 	// entropyFilter is used to filter out unverified results using Shannon entropy.
 	filterEntropy           float64
 	notifyVerifiedResults   bool
@@ -265,7 +259,6 @@ func NewEngine(ctx context.Context, cfg *Config) (*Engine, error) {
 		dispatcher:                          cfg.Dispatcher,
 		verify:                              cfg.Verify,
 		filterUnverified:                    cfg.FilterUnverified,
-		noIgnoreTag:                         cfg.NoIgnoreTag,
 		filterEntropy:                       cfg.FilterEntropy,
 		printAvgDetectorTime:                cfg.PrintAvgDetectorTime,
 		retainFalsePositives:                cfg.LogFilteredUnverified,
```

---

### Incident Patch 9: `a3fcdde4` (2026-09-28)
**Commit Message**: Fix failing TestGHCRListImages test in CI (#5368)

**File**: `pkg/sources/docker/registries_test.go` (modified, +4/-3)
```diff
@@ -57,9 +57,10 @@ func TestGHCRListImages(t *testing.T) {
 
 	ghcrImages, err := ghcr.ListImages(context.Background(), "ghcr.io/mongodb")
 	assert.NoError(t, err)
-	assert.Equal(t, len(ghcrImages), 1)
-
-	assert.Equal(t, ghcrImages, []string{"ghcr.io/mongodb/kingfisher"})
+	// mongodb is a third-party namespace whose package list changes over time,
+	// so only assert on a known package rather than the exact set.
+	assert.NotEmpty(t, ghcrImages)
+	assert.Contains(t, ghcrImages, "ghcr.io/mongodb/kingfisher")
 }
 
 func TestDockerHubListImages_RateLimitError(t *testing.T) {
```

---

### Incident Patch 10: `cd94550e` (2026-09-24)
**Commit Message**: Update github.com/trufflesecurity/ldap-verify digest to 3142cc9 (#5280)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +3/-4)
```diff
@@ -89,15 +89,15 @@ require (
 	github.com/sergi/go-diff v1.3.2-0.20230802210424-5b0b94c5c0d3
 	github.com/shuheiktgw/go-travis v0.3.1
 	github.com/shurcooL/githubv4 v0.0.0-20260209031235-2402fdf4a9ed
-	github.com/stretchr/testify v1.11.1
+	github.com/stretchr/testify v1.12.1
 	github.com/testcontainers/testcontainers-go v0.42.0
 	github.com/testcontainers/testcontainers-go/modules/elasticsearch v0.42.0
 	github.com/testcontainers/testcontainers-go/modules/mongodb v0.42.0
 	github.com/testcontainers/testcontainers-go/modules/mssql v0.42.0
 	github.com/testcontainers/testcontainers-go/modules/mysql v0.42.0
 	github.com/testcontainers/testcontainers-go/modules/postgres v0.42.1-0.20260423004847-9fc0246c3859
 	github.com/trufflesecurity/disk-buffer-reader v0.2.1
-	github.com/trufflesecurity/ldap-verify v0.0.0-20260824144701-aa52b4613a85
+	github.com/trufflesecurity/ldap-verify v0.0.0-20260924192009-3142cc951070
 	github.com/wasilibs/go-re2 v1.12.0
 	github.com/xo/dburl v0.23.8
 	gitlab.com/gitlab-org/api/client-go v1.12.0
@@ -183,7 +183,6 @@ require (
 	github.com/couchbaselabs/gocbconnstr/v2 v2.0.0-20240607131231-fb385523de28 // indirect
 	github.com/cpuguy83/dockercfg v0.3.2 // indirect
 	github.com/cyphar/filepath-securejoin v0.6.1 // indirect
-	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
 	github.com/decred/dcrd/dcrec/secp256k1/v4 v4.4.0 // indirect
 	github.com/distribution/reference v0.6.0 // indirect
 	github.com/dlclark/regexp2 v1.11.0 // indirect
@@ -268,7 +267,6 @@ require (
 	github.com/pierrec/lz4/v4 v4.1.21 // indirect
 	github.com/pjbgf/sha1cd v0.6.0 // indirect
 	github.com/planetscale/vtprotobuf v0.6.1-0.20240319094008-0393e58bdf10 // indirect
-	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
 	github.com/power-devops/perfstat v0.0.0-20240221224432-82ca36839d55 // indirect
 	github.com/prometheus/client_model v0.6.2 // indirect
 	github.com/prometheus/common v0.55.0 // indirect
@@ -314,6 +312,7 @@ require (
 	go.opentelemetry.io/otel/sdk/metric v1.43.0 // indirect
 	go.opentelemetry.io/otel/trace v1.43.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
+	go.yaml.in/yaml/v3 v3.0.5 // indirect
 	go4.org v0.0.0-20230225012048-214862532bf5 // indirect
 	golang.org/x/mod v0.37.0 // indirect
 	golang.org/x/sys v0.46.0 // indirect
```

**File**: `go.sum` (modified, +6/-6)
```diff
@@ -631,8 +631,6 @@ github.com/pkg/errors v0.9.1/go.mod h1:bwawxfHBFNV+L2hUp1rHADufV3IMtnDRdf1r5NINE
 github.com/planetscale/vtprotobuf v0.6.1-0.20240319094008-0393e58bdf10 h1:GFCKgmp0tecUJ0sJuv4pzYCqS9+RGSn52M3FUwPs+uo=
 github.com/planetscale/vtprotobuf v0.6.1-0.20240319094008-0393e58bdf10/go.mod h1:t/avpk3KcrXxUnYOhZhMXJlSEyie6gQbtLq5NM3loB8=
 github.com/pmezard/go-difflib v1.0.0/go.mod h1:iKH77koFhYxTK1pcRnkKkqfTogsbg7gZNVY4sRDYZ/4=
-github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 h1:Jamvg5psRIccs7FGNTlIRMkT8wgtp5eCXdBlqhYGL6U=
-github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2/go.mod h1:iKH77koFhYxTK1pcRnkKkqfTogsbg7gZNVY4sRDYZ/4=
 github.com/power-devops/perfstat v0.0.0-20240221224432-82ca36839d55 h1:o4JXh1EVt9k/+g42oCprj/FisM4qX9L3sZB3upGN2ZU=
 github.com/power-devops/perfstat v0.0.0-20240221224432-82ca36839d55/go.mod h1:OmDBASR4679mdNQnz2pUhc2G8CO2JrUAVFDRBDP/hJE=
 github.com/prashantv/gostub v1.1.0 h1:BTyx3RfQjRHnUWaGF9oQos79AlQ5k8WNktv7VGvVH4g=
@@ -710,8 +708,8 @@ github.com/stretchr/testify v1.7.1/go.mod h1:6Fq8oRcR53rry900zMqJjRRixrwX3KX962/
 github.com/stretchr/testify v1.8.0/go.mod h1:yNjHg4UonilssWZ8iaSj1OCr/vHnekPRkoO+kdMU+MU=
 github.com/stretchr/testify v1.8.1/go.mod h1:w2LPCIKwWwSfY2zedu0+kehJoqGctiVI29o6fzry7u4=
 github.com/stretchr/testify v1.8.4/go.mod h1:sz/lmYIOXD/1dqDmKjjqLyZ2RngseejIcXlSw2iwfAo=
-github.com/stretchr/testify v1.11.1 h1:7s2iGBzp5EwR7/aIZr8ao5+dra3wiQyKjjFuvgVKu7U=
-github.com/stretchr/testify v1.11.1/go.mod h1:wZwfW3scLgRK+23gO65QZefKpKQRnfz6sD981Nm4B6U=
+github.com/stretchr/testify v1.12.1 h1:EuwCh5fleGS7H32xRwO3wRGT7DxrDhLAT6FF8MpWDWE=
+github.com/stretchr/testify v1.12.1/go.mod h1:MDEgiDPPsNp5cuIrHPPCyornHKgEVbtFUmoNlxoYthg=
 github.com/testcontainers/testcontainers-go v0.42.0 h1:He3IhTzTZOygSXLJPMX7n44XtK+qhjat1nI9cneBbUY=
 github.com/testcontainers/testcontainers-go v0.42.0/go.mod h1:vZjdY1YmUA1qEForxOIOazfsrdyORJAbhi0bp8plN30=
 github.com/testcontainers/testcontainers-go/modules/elasticsearch v0.42.0 h1:GzdsTn4x0wTkdmRl2EFk0IniDGRoPCKPW/NWi9EmKs8=
@@ -734,8 +732,8 @@ github.com/tklauser/numcpus v0.12.0 h1:NR85qdvHA9pFse3x3weVZ0r0ST8R6l5RHbZrlRaqo
 github.com/tklauser/numcpus v0.12.0/go.mod h1:ABHeXzJnr/qqwguhClkZKT1/8VABcYrsyUiUGobwWJg=
 github.com/trufflesecurity/disk-buffer-reader v0.2.1 h1:K9nNpX3xeWT2E6YRjlcc1X5c1NjgV9JS5T9aw2FjA8Q=
 github.com/trufflesecurity/disk-buffer-reader v0.2.1/go.mod h1:uYwTCdxzV0o+qaeBMxflOsq4eu2WjrE46qGR2e80O9Y=
-github.com/trufflesecurity/ldap-verify v0.0.0-20260824144701-aa52b4613a85 h1:q/R6mqRs1l/A/5pGTMG7bf+lIP9j8C06xcwcl+r/kkI=
-github.com/trufflesecurity/ldap-verify v0.0.0-20260824144701-aa52b4613a85/go.mod h1:HAlNn3YFAr/3fgyPu/sLh+w6wYuabX39zvmj/02ARx8=
+github.com/trufflesecurity/ldap-verify v0.0.0-20260924192009-3142cc951070 h1:Poq+Z6/uKeNJwSKE8ErQlIVf2b3L3Zyzpw6mQbJ784A=
+github.com/trufflesecurity/ldap-verify v0.0.0-20260924192009-3142cc951070/go.mod h1:VQbB7BbEEjTfPqN9dT/3jksvk1p1uj5YQZLMZ8Unu6E=
 github.com/trufflesecurity/overseer v1.2.8 h1:VXlWPiwYaQmwNxY2W1rVulEAG9O6iF1S0LX3wionWYM=
 github.com/trufflesecurity/overseer v1.2.8/go.mod h1:Dt6Y9LFpM+C/3rRWpy4//4iS5qrbb0pL3XvZqMd4zhg=
 github.com/trufflesecurity/touchfile v0.1.1 h1:Snhd5VEa8Cxd+D60nvLEj2kVeb1omY2tWwnhDhjTqdo=
@@ -831,6 +829,8 @@ go.uber.org/multierr v1.11.0/go.mod h1:20+QtiLqy0Nd6FdQB9TLXag12DsQkrbs3htMFfDN8
 go.uber.org/zap v1.18.1/go.mod h1:xg/QME4nWcxGxrpdeYfq7UvYrLh66cuVKdrbD1XF/NI=
 go.uber.org/zap v1.27.0 h1:aJMhYGrd5QSmlpLMr2MftRKl7t8J8PTZPA732ud/XR8=
 go.uber.org/zap v1.27.0/go.mod h1:GB2qFLM7cTU87MWRP2mPIjqfIDnGu+VIO4V/SdhGo2E=
+go.yaml.in/yaml/v3 v3.0.5 h1:N6y/pJk8buWs9NY5ERU2HSMfm+IuD/OtfdAnq6kESPw=
+go.yaml.in/yaml/v3 v3.0.5/go.mod h1:HVTZu1O7/Vkt2N+BFy8Zza+lnLsABggaTM2ZpNIGuKg=
 go4.org v0.0.0-20230225012048-214862532bf5 h1:nifaUDeh+rPaBCMPMQHZmvJf+QdpLFnuQPwx+LxVmtc=
 go4.org v0.0.0-20230225012048-214862532bf5/go.mod h1:F57wTi5Lrj6WLyswp5EYV1ncrEbFGHD4hhz6S1ZYeaU=
 golang.org/x/crypto v0.0.0-20190308221718-c2843e01d9a2/go.mod h1:djNgcEr1/C05ACkg1iLfiJU5Ep61QUkGW8qpdssI0+w=
```

---

### Incident Patch 11: `5522983b` (2026-09-24)
**Commit Message**: Update module github.com/charmbracelet/bubbletea to v1.3.10 (#5281)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `go.mod` (modified, +2/-2)
```diff
@@ -30,7 +30,7 @@ require (
 	github.com/bradleyfalzon/ghinstallation/v2 v2.16.0
 	github.com/brianvoe/gofakeit/v7 v7.6.0
 	github.com/charmbracelet/bubbles v0.18.0
-	github.com/charmbracelet/bubbletea v1.3.6
+	github.com/charmbracelet/bubbletea v1.3.10
 	github.com/charmbracelet/glamour v0.10.0
 	github.com/charmbracelet/lipgloss v1.1.1-0.20250404203927-76690c660834
 	github.com/couchbase/gocb/v2 v2.11.0
@@ -166,7 +166,7 @@ require (
 	github.com/cenkalti/backoff/v4 v4.3.0 // indirect
 	github.com/cespare/xxhash/v2 v2.3.0 // indirect
 	github.com/charmbracelet/colorprofile v0.2.3-0.20250311203215-f60798e515dc // indirect
-	github.com/charmbracelet/x/ansi v0.9.3 // indirect
+	github.com/charmbracelet/x/ansi v0.10.1 // indirect
 	github.com/charmbracelet/x/cellbuf v0.0.13 // indirect
 	github.com/charmbracelet/x/exp/slice v0.0.0-20250327172914-2fdc97757edf // indirect
 	github.com/charmbracelet/x/term v0.2.1 // indirect
```

**File**: `go.sum` (modified, +4/-4)
```diff
@@ -176,16 +176,16 @@ github.com/cespare/xxhash/v2 v2.3.0 h1:UL815xU9SqsFlibzuggzjXhog7bL6oX9BbNZnL2UF
 github.com/cespare/xxhash/v2 v2.3.0/go.mod h1:VGX0DQ3Q6kWi7AoAeZDth3/j3BFtOZR5XLFGgcrjCOs=
 github.com/charmbracelet/bubbles v0.18.0 h1:PYv1A036luoBGroX6VWjQIE9Syf2Wby2oOl/39KLfy0=
 github.com/charmbracelet/bubbles v0.18.0/go.mod h1:08qhZhtIwzgrtBjAcJnij1t1H0ZRjwHyGsy6AL11PSw=
-github.com/charmbracelet/bubbletea v1.3.6 h1:VkHIxPJQeDt0aFJIsVxw8BQdh/F/L2KKZGsK6et5taU=
-github.com/charmbracelet/bubbletea v1.3.6/go.mod h1:oQD9VCRQFF8KplacJLo28/jofOI2ToOfGYeFgBBxHOc=
+github.com/charmbracelet/bubbletea v1.3.10 h1:otUDHWMMzQSB0Pkc87rm691KZ3SWa4KUlvF9nRvCICw=
+github.com/charmbracelet/bubbletea v1.3.10/go.mod h1:ORQfo0fk8U+po9VaNvnV95UPWA1BitP1E0N6xJPlHr4=
 github.com/charmbracelet/colorprofile v0.2.3-0.20250311203215-f60798e515dc h1:4pZI35227imm7yK2bGPcfpFEmuY1gc2YSTShr4iJBfs=
 github.com/charmbracelet/colorprofile v0.2.3-0.20250311203215-f60798e515dc/go.mod h1:X4/0JoqgTIPSFcRA/P6INZzIuyqdFY5rm8tb41s9okk=
 github.com/charmbracelet/glamour v0.10.0 h1:MtZvfwsYCx8jEPFJm3rIBFIMZUfUJ765oX8V6kXldcY=
 github.com/charmbracelet/glamour v0.10.0/go.mod h1:f+uf+I/ChNmqo087elLnVdCiVgjSKWuXa/l6NU2ndYk=
 github.com/charmbracelet/lipgloss v1.1.1-0.20250404203927-76690c660834 h1:ZR7e0ro+SZZiIZD7msJyA+NjkCNNavuiPBLgerbOziE=
 github.com/charmbracelet/lipgloss v1.1.1-0.20250404203927-76690c660834/go.mod h1:aKC/t2arECF6rNOnaKaVU6y4t4ZeHQzqfxedE/VkVhA=
-github.com/charmbracelet/x/ansi v0.9.3 h1:BXt5DHS/MKF+LjuK4huWrC6NCvHtexww7dMayh6GXd0=
-github.com/charmbracelet/x/ansi v0.9.3/go.mod h1:3RQDQ6lDnROptfpWuUVIUG64bD2g2BgntdxH0Ya5TeE=
+github.com/charmbracelet/x/ansi v0.10.1 h1:rL3Koar5XvX0pHGfovN03f5cxLbCF2YvLeyz7D2jVDQ=
+github.com/charmbracelet/x/ansi v0.10.1/go.mod h1:3RQDQ6lDnROptfpWuUVIUG64bD2g2BgntdxH0Ya5TeE=
 github.com/charmbracelet/x/cellbuf v0.0.13 h1:/KBBKHuVRbq1lYx5BzEHBAFBP8VcQzJejZ/IA3iR28k=
 github.com/charmbracelet/x/cellbuf v0.0.13/go.mod h1:xe0nKWGd3eJgtqZRaN9RjMtK7xUYchjzPr7q6kcvCCs=
 github.com/charmbracelet/x/exp/golden v0.0.0-20240806155701-69247e0abc2a h1:G99klV19u0QnhiizODirwVksQB91TJKV/UaTnACcG30=
```

---

### Incident Patch 12: `a25ff851` (2026-09-23)
**Commit Message**: ci: scope Smoke timeouts to trufflehog runs, not the build (#5317)

The `zombies` job had a job-level `timeout-minutes: 5` that covered a full
binary compile as well as the two scans it is meant to bound. On PRs that
change `go.sum` the Go cache is cold, the compile takes ~2m30s instead of
~29s, and the job exceeds 5 minutes even though the zombie check itself
passes. PR #5280 hit this on both attempts; #5273 passed with 19s to spare.

Build to `$RUNNER_TEMP` in a separate step and move `timeout-minutes` onto
the run step, so the 5-minute budget now measures only the scans (~1m42s)
and no longer depends on build speed. A step-level timeout also fails the
job rather than cancelling it, which is a clearer signal.

`smoke` had no timeout at all and inherited the 360-minute default despite
doing under a minute of work, so a hang in its live-verification scans
burned six hours of runner time. Both jobs now cap at 15 minutes to catch
build and infrastructure hangs.

Also set `cache: false` on setup-go in `checksecretparts`. That job is
stdlib-only and finishes in ~23s, so it wins the race to write the
`go.sum`-keyed cache and saves ~10MB with no module cache at all. Cache
keys are write-

**File**: `.github/workflows/lint.yml` (modified, +5/-0)
```diff
@@ -60,5 +60,10 @@ jobs:
       - uses: actions/setup-go@924ae3a1cded613372ab5595356fb5720e22ba16 # v6
         with:
           go-version: "1.27"
+          # hack/checksecretparts only needs the standard library, so this job
+          # finishes before any other and would otherwise claim the shared
+          # go.sum-keyed cache with an empty module cache. Cache keys are
+          # write-once, so that starves every later job on the branch.
+          cache: false
       - name: Run checksecretparts
         run: go run ./hack/checksecretparts -fail ./pkg/detectors
```

**File**: `.github/workflows/smoke.yml` (modified, +17/-5)
```diff
@@ -3,37 +3,49 @@ name: Smoke
 on:
   pull_request:
 
+permissions:
+  contents: read
+
 jobs:
   smoke:
     runs-on: ubuntu-latest
+    timeout-minutes: 15
     steps:
       - name: Checkout code
         uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
       - name: Install Go
         uses: actions/setup-go@924ae3a1cded613372ab5595356fb5720e22ba16 # v6
         with:
           go-version: "1.27"
+      - name: Build
+        run: go build -o "$RUNNER_TEMP/trufflehog" .
       - name: Smoke
+        timeout-minutes: 10
         run: |
           set -e
-          go run . git https://github.com/dustin-decker/secretsandstuff.git > /dev/null
-          go run . github --repo https://github.com/dustin-decker/secretsandstuff.git > /dev/null
+          "$RUNNER_TEMP/trufflehog" git https://github.com/dustin-decker/secretsandstuff.git > /dev/null
+          "$RUNNER_TEMP/trufflehog" github --repo https://github.com/dustin-decker/secretsandstuff.git > /dev/null
   zombies:
     runs-on: ubuntu-latest
-    timeout-minutes: 5
+    timeout-minutes: 15
     steps:
       - name: Checkout code
         uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
       - name: Install Go
         uses: actions/setup-go@924ae3a1cded613372ab5595356fb5720e22ba16 # v6
         with:
           go-version: "1.27"
+      - name: Build
+        run: go build -o "$RUNNER_TEMP/trufflehog" .
+      # The timeout covers only the scans, not the build, so a cold Go cache
+      # cannot eat into the budget that detects the #3379 deadlock.
       - name: Run trufflehog
+        timeout-minutes: 5
         run: |
           set -e
-          go run . git --no-verification file://. > /dev/null
+          "$RUNNER_TEMP/trufflehog" git --no-verification file://. > /dev/null
           # This case previously had a deadlock issue and left zombies after trufflehog exited #3379
-          go run . git --no-verification https://github.com/git-test-fixtures/binary.git > /dev/null
+          "$RUNNER_TEMP/trufflehog" git --no-verification https://github.com/git-test-fixtures/binary.git > /dev/null
       - name: Check for running git processes and zombies
         run: |
           if pgrep -x "git" > /dev/null
```

---

### Incident Patch 13: `f5161649` (2026-09-23)
**Commit Message**: 🐛 fix(engine): map decoded results to source lines (#5219)

Fixes #5218, where HTML decoding removes source lines before detector results reach FragmentLineOffset. Findings that survive decoding can then point to a transformed line instead of their source line.

Line lookup now uses the matching occurrence in OriginalData when the detected value survives decoding, in three steps of increasing cost:

- Value absent from the source, as with a base64-decoded secret: keep decoded-data offsets.
- Same number of occurrences in both buffers: decoders emit the occurrences they keep in source order, so the nth decoded match is the nth source match. One linear scan.
- Counts disagree, meaning the decoder dropped or merged occurrences: score each candidate source occurrence by how much of the decoded neighbourhood still reads out of the source around it, allowing gaps on the source side for what was removed, and take the best.

That last case has no exact answer. A value the decoder dropped and a value it kept are only distinguishable by their surroundings, so it is a ranking, not a lookup. Measured against generated ground truth it lands on the right source line 99.9% of the time, against 9

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -3,6 +3,9 @@ dist
 .env
 *.test
 
+# rapid property test failure recordings, for local reproduction only
+testdata/rapid/
+
 # binary
 trufflehog
 tmp/go-test.json
```

**File**: `pkg/engine/engine.go` (modified, +125/-2)
```diff
@@ -1431,11 +1431,16 @@ func FragmentLineOffset(chunk *sources.Chunk, result *detectors.Result) (int64,
 		}
 	}
 
-	lineNumber := int64(bytes.Count(chunk.Data[:offset], []byte("\n")))
+	data := chunk.Data
+	if originalOffset := sourceOffset(chunk.OriginalData, chunk.Data, offset, len(secretBytes)); originalOffset >= 0 {
+		data, offset = chunk.OriginalData, originalOffset
+	}
+
+	lineNumber := int64(bytes.Count(data[:offset], []byte("\n")))
 	result.SetPrimarySecretLine(lineNumber)
 
 	// If the line containing the secret has the ignore tag, we should ignore the result.
-	after := chunk.Data[offset+len(secretBytes):]
+	after := data[offset+len(secretBytes):]
 	endLine := bytes.Index(after, []byte("\n"))
 	if endLine == -1 {
 		endLine = len(after)
@@ -1446,6 +1451,124 @@ func FragmentLineOffset(chunk *sources.Chunk, result *detectors.Result) (int64,
 	return lineNumber, false
 }
 
+// sourceOffset maps an offset in decoded data back onto the pre-decode buffer,
+// returning -1 when the detected value has no counterpart in the source.
+func sourceOffset(originalData, data []byte, offset, length int) int {
+	if len(originalData) == 0 || length == 0 || offset < 0 || offset+length > len(data) {
+		return -1
+	}
+	if bytes.Equal(originalData, data) {
+		return offset
+	}
+
+	secret := data[offset : offset+length]
+	preceding := bytes.Count(data[:offset], secret)
+	sourceIndex, sourceCount := nthOccurrence(originalData, secret, preceding)
+	if sourceCount == 0 {
+		return -1
+	}
+	// Decoders emit the occurrences they keep in source order, so an unchanged
+	// occurrence count makes the nth decoded match the nth source match.
+	if sourceCount == preceding+bytes.Count(data[offset:], secret) {
+		return sourceIndex
+	}
+	// Decoding dropped or merged occurrences, so order alone no longer identifies
+	// the match and the surrounding text has to break the tie.
+	return bestAlignedOccurrence(originalData, data, offset, length)
+}
+
+// nthOccurrence returns the offset of the nth zero-indexed non-overlapping
+// occurrence of sep in data along with the total occurrence count. The offset is
+// -1 when data holds fewer than n+1 occurrences.
+func nthOccurrence(data, sep []byte, n int) (int, int) {
+	index, count, start := -1, 0, 0
+	for {
+		next := bytes.Index(data[start:], sep)
+		if next == -1 {
+			return index, count
+		}
+		if count == n {
+			index = start + next
+		}
+		count++
+		start += next + len(sep)
+	}
+}
+
+// alignedContextBytes bounds the neighbourhood each candidate source occurrence is
+// scored over, keeping the comparison linear in the number of candidates. A kilobyte
+// is far more context than a decoder needs to give itself away.
+const alignedContextBytes = 1024
+
+// bestAlignedOccurrence picks the source occurrence of the detected value whose
+// neighbourhood best survives into the decoded neighbourhood. No rule is exact here:
+// when a decoder drops one copy of a value and keeps another, the copies are only
+// distinguishable by the text around them.
+func bestAlignedOccurrence(originalData, data []byte, offset, length int) int {
+	secret := data[offset : offset+length]
+	best, bestScore := -1, -1
+	for start := 0; ; {
+		next := bytes.Index(originalData[start:], secret)
+		if next == -1 {
+			return best
+		}
+		candidate := start + next
+		if score := alignmentScore(originalData, data, candidate, offset, length); score > bestScore {
+			best, bestScore = candidate, score
+		}
+		start = candidate + length
+	}
+}
+
+// alignmentScore measures how much of the decoded neighbourhood still reads, in
+// order, out of the source around a candidate. Decoders interleave removals with the
+// text they keep, so the source side is allowed gaps that the decoded side is not.
+func alignmentScore(originalData, data []byte, candidate, offset, length int) int {
+	sourceBefore := lastBytes(originalData[:candidate], alignedContextBytes)
+	decodedBefore := lastBytes(data[:offset], alignedContextBytes)
+	sourceAfter := firstBytes(originalData[candidate+length:], alignedContextBytes)
+	decodedAfter := firstBytes(data[offset+length:], alignedContextBytes)
+	return matchBackward(sourceBefore, decodedBefore) + matchForward(sourceAfter, decodedAfter)
+}
+
+// matchBackward returns the length of the longest suffix of decoded that appears as a
+// subsequence of source. Matching greedily from the right is optimal for that.
+func matchBackward(source, decoded []byte) int {
+	matched, j := 0, len(decoded)-1
+	for i := len(source) - 1; i >= 0 && j >= 0; i-- {
+		if source[i] == decoded[j] {
+			matched, j = matched+1, j-1
+		}
+	}
+	return matched
+}
+
+// matchForward returns the length of the longest prefix of decoded that appears as a
+// subsequence of source.
+func matchForward(source, decoded []byte) int {
+	matched := 0
+	for i := 0; i < len(source) && matched < len(decoded); i++ {
+		if source[i] == decoded[matched] {
+			matched++
+		}
+	}
+	return matched
+}
+
+func lastBytes(data []byte, n int) []byte
```

**File**: `pkg/engine/engine_test.go` (modified, +283/-0)
```diff
@@ -1,6 +1,7 @@
 package engine
 
 import (
+	"bytes"
 	aCtx "context"
 	"fmt"
 	"math/rand"
@@ -17,6 +18,7 @@ import (
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 	"google.golang.org/protobuf/testing/protocmp"
+	"pgregory.net/rapid"
 
 	"github.com/trufflesecurity/trufflehog/v3/pkg/config"
 	"github.com/trufflesecurity/trufflehog/v3/pkg/context"
@@ -232,6 +234,205 @@ func TestFragmentLineOffsetWithPrimarySecretMultiline(t *testing.T) {
 	assert.Equal(t, int64(2), lineOffset)
 }
 
+// HTML-like tags can collapse source blank lines during decoding.
+func TestFragmentLineOffsetUsesOriginalData(t *testing.T) {
+	result := &detectors.Result{Raw: []byte("synthetic-secret-value-123456")}
+	result.SetPrimarySecretValue(`token = "synthetic-secret-value-123456"`)
+	chunk := &sources.Chunk{
+		Data:         []byte("# Date format:\n\ntoken = \"synthetic-secret-value-123456\""),
+		OriginalData: []byte("# Date format: <yyyymmdd>\n\n\n\n\ntoken = \"synthetic-secret-value-123456\""),
+	}
+
+	lineOffset, _ := FragmentLineOffset(chunk, result)
+
+	assert.Equal(t, int64(5), lineOffset)
+}
+
+// Some decoded secrets have no matching source byte sequence.
+func TestFragmentLineOffsetFallsBackToDecodedData(t *testing.T) {
+	result := &detectors.Result{Raw: []byte("synthetic-secret-value-123456")}
+	chunk := &sources.Chunk{
+		Data:         []byte("decoded header\nsynthetic-secret-value-123456"),
+		OriginalData: []byte("encoded-source-data"),
+	}
+
+	lineOffset, _ := FragmentLineOffset(chunk, result)
+
+	assert.Equal(t, int64(1), lineOffset)
+}
+
+// Decoding can change the newline count between duplicate matches.
+func TestFragmentLineOffsetMapsOriginalDataOccurrence(t *testing.T) {
+	secret := []byte("synthetic-secret-value-123456")
+	chunk := &sources.Chunk{
+		Data:         []byte("synthetic-secret-value-123456\nsynthetic-secret-value-123456"),
+		OriginalData: []byte("synthetic-secret-value-123456\n\nsynthetic-secret-value-123456"),
+	}
+	results := []detectors.Result{{Raw: secret}, {Raw: secret}}
+	AssignDuplicateLineOffsets(chunk, results)
+
+	lineOffset, _ := FragmentLineOffset(chunk, &results[1])
+
+	assert.Equal(t, int64(2), lineOffset)
+}
+
+// The same value can occur in discarded markup and emitted text, so surrounding
+// text has to identify which source occurrence the decoder kept.
+func TestFragmentLineOffsetSkipsRemovedOriginalDataOccurrence(t *testing.T) {
+	secret := []byte("synthetic-secret-value-123456")
+	chunk := &sources.Chunk{
+		Data: []byte("heading\nsynthetic-secret-value-123456"),
+		OriginalData: []byte("<div class=\"synthetic-secret-value-123456\">\n" +
+			"<p>heading</p>\n<p>synthetic-secret-value-123456</p>"),
+	}
+
+	lineOffset, _ := FragmentLineOffset(chunk, &detectors.Result{Raw: secret})
+
+	assert.Equal(t, int64(2), lineOffset)
+}
+
+// A dropped occurrence can sit after the surviving one, so a later source match is
+// not automatically the right one.
+func TestFragmentLineOffsetSkipsLaterRemovedOriginalDataOccurrence(t *testing.T) {
+	secret := []byte("synthetic-secret-value-123456")
+	chunk := &sources.Chunk{
+		Data: []byte("heading\nsynthetic-secret-value-123456\ntrailer"),
+		OriginalData: []byte("<p>heading</p>\n<p>synthetic-secret-value-123456</p>\n" +
+			"<div class=\"synthetic-secret-value-123456\">trailer</div>"),
+	}
+
+	lineOffset, _ := FragmentLineOffset(chunk, &detectors.Result{Raw: secret})
+
+	assert.Equal(t, int64(1), lineOffset)
+}
+
+// UTF-8 decoding replaces line breaks alongside malformed bytes.
+func TestFragmentLineOffsetUsesInvalidOriginalData(t *testing.T) {
+	secret := []byte("synthetic-secret-value-123456")
+	originalData := append([]byte("heading\n\xff\n"), secret...)
+	chunk := &sources.Chunk{
+		Data:         originalData,
+		OriginalData: originalData,
+	}
+	require.NotNil(t, (&decoders.UTF8{}).FromChunk(chunk))
+
+	lineOffset, _ := FragmentLineOffset(chunk, &detectors.Result{Raw: secret})
+
+	assert.Equal(t, int64(2), lineOffset)
+}
+
+// Mapping must count bytes across multibyte UTF-8 before the secret.
+func TestFragmentLineOffsetUsesUTF8OriginalData(t *testing.T) {
+	secret := []byte("synthetic-secret-value-123456")
+	chunk := &sources.Chunk{
+		Data:         append([]byte("préface\n"), secret...),
+		OriginalData: append([]byte("préface\n\n"), secret...),
+	}
+
+	lineOffset, _ := FragmentLineOffset(chunk, &detectors.Result{Raw: secret})
+
+	assert.Equal(t, int64(2), lineOffset)
+}
+
+// Replacement runes shift the decoded offset of the second match.
+func TestFragmentLineOffsetMapsInvalidOriginalDataDuplicates(t *testing.T) {
+	secret := []byte("synthetic-secret-value-123456")
+	originalData := append([]byte("\xff\n"), secret...)
+	originalData = append(originalData, '\n', 0xfe, '\n')
+	originalData = append(originalData, secret...)
+	chunk := &sources.Chunk{Data: originalData, OriginalData: originalData}
+	require.NotNil(t, (&decoders.UTF8{}).FromChunk(chunk))
+	results := []detectors.Result{{Raw: secret}, {Raw: 
```

---

### Incident Patch 14: `ff8d20c4` (2026-09-22)
**Commit Message**: fix(postgres): recognise a missing database by SQLSTATE (#5312)

Postgres names the database in "database %s does not exist", and defaults
it to the user name when the connection string carries none. The check
assumed that default was "postgres", so it never matched for a URI without
a database, and a credential the server had already authenticated was
reported as a verification error instead of a live secret.

Prefer SQLSTATE 3D000, which both drivers expose and which needs no name at
all. It also survives a server running with a non-English lc_messages,
where matching on message text cannot work.

Message matching stays as a fallback for proxies that relay the failure
without a SQLSTATE, now expecting the same name the server used.

**File**: `pkg/detectors/postgres/postgres.go` (modified, +27/-9)
```diff
@@ -293,13 +293,31 @@ func getDeadlineInSeconds(ctx context.Context) (int, bool) {
 	return int(duration.Seconds()), true
 }
 
-func isErrorDatabaseNotFound(err error, dbName string) bool {
+// The server looks the database up only after authenticating, so this confirms the credentials.
+const invalidCatalogName = "3D000"
+
+// Message text is only a fallback, for proxies that relay a failure without a SQLSTATE; the server
+// translates messages per lc_messages. Postgres substitutes the user name, not "postgres", when a
+// connection string names no database (src/backend/tcop/backend_startup.c).
+func isErrorDatabaseNotFound(err error, params map[string]string) bool {
+	var pqErr *pq.Error
+	if errors.As(err, &pqErr) && pqErr.Code == invalidCatalogName {
+		return true
+	}
+	var pgErr *pgconn.PgError
+	if errors.As(err, &pgErr) && pgErr.Code == invalidCatalogName {
+		return true
+	}
+
+	dbName := params[pgDbname]
+	if dbName == "" {
+		dbName = params[pgUser]
+	}
 	if dbName == "" {
-		dbName = "postgres"
+		return false
 	}
-	missingDbErrorText := fmt.Sprintf("database \"%s\" does not exist", dbName)
 
-	return strings.Contains(err.Error(), missingDbErrorText)
+	return strings.Contains(err.Error(), fmt.Sprintf("database %q does not exist", dbName))
 }
 
 func verifyPostgres(ctx context.Context, params map[string]string) (bool, error) {
@@ -317,7 +335,7 @@ func verifyPostgres(ctx context.Context, params map[string]string) (bool, error)
 func verifyPostgresPgx(ctx context.Context, params map[string]string) (bool, error) {
 	conn, err := pgx.Connect(ctx, pgxConnString(params))
 	if err != nil {
-		return classifyPostgresVerifyError(err, params[pgDbname])
+		return classifyPostgresVerifyError(err, params)
 	}
 	defer func() {
 		// Best-effort close after verification; the verify outcome is already decided.
@@ -327,7 +345,7 @@ func verifyPostgresPgx(ctx context.Context, params map[string]string) (bool, err
 	}()
 
 	if err := conn.Ping(ctx); err != nil {
-		return classifyPostgresVerifyError(err, params[pgDbname])
+		return classifyPostgresVerifyError(err, params)
 	}
 	return true, nil
 }
@@ -346,7 +364,7 @@ func pgxConnString(params map[string]string) string {
 	return connStr.String()
 }
 
-func classifyPostgresVerifyError(err error, dbName string) (bool, error) {
+func classifyPostgresVerifyError(err error, params map[string]string) (bool, error) {
 	var pgErr *pgconn.PgError
 	if errors.As(err, &pgErr) {
 		switch pgErr.Code {
@@ -359,7 +377,7 @@ func classifyPostgresVerifyError(err error, dbName string) (bool, error) {
 	if strings.Contains(err.Error(), "password authentication failed") {
 		return false, nil
 	}
-	if isErrorDatabaseNotFound(err, dbName) {
+	if isErrorDatabaseNotFound(err, params) {
 		return true, nil
 	}
 	return false, err
@@ -413,7 +431,7 @@ func verifyPostgresPq(params map[string]string) (bool, error) {
 		params[pgSslmode] = pgSslmodeDisable
 		defer delete(params, pgSslmode) // We want to return with the original params map intact (for ExtraData)
 		return verifyPostgresPq(params)
-	case isErrorDatabaseNotFound(err, params[pgDbname]):
+	case isErrorDatabaseNotFound(err, params):
 		return true, nil // If we know this, we were able to authenticate
 	default:
 		return false, err
```

**File**: `pkg/detectors/postgres/postgres_test.go` (modified, +39/-4)
```diff
@@ -8,6 +8,7 @@ import (
 
 	"github.com/google/go-cmp/cmp"
 	"github.com/jackc/pgx/v5/pgconn"
+	"github.com/lib/pq"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 
@@ -179,7 +180,7 @@ func TestClassifyPostgresVerifyError(t *testing.T) {
 	tests := []struct {
 		name         string
 		err          error
-		dbName       string
+		params       map[string]string
 		wantVerified bool
 		wantErr      bool
 	}{
@@ -192,7 +193,19 @@ func TestClassifyPostgresVerifyError(t *testing.T) {
 		{
 			name:         "missing database code",
 			err:          &pgconn.PgError{Code: "3D000", Message: `database "app" does not exist`},
-			dbName:       "app",
+			params:       map[string]string{pgDbname: "app"},
+			wantVerified: true,
+			wantErr:      false,
+		},
+		{
+			name:         "missing database code needs no parameters",
+			err:          &pgconn.PgError{Code: "3D000", Message: "la base de données n'existe pas"},
+			wantVerified: true,
+			wantErr:      false,
+		},
+		{
+			name:         "missing database code from lib/pq",
+			err:          &pq.Error{Code: "3D000", Message: `database "app" does not exist`},
 			wantVerified: true,
 			wantErr:      false,
 		},
@@ -203,8 +216,30 @@ func TestClassifyPostgresVerifyError(t *testing.T) {
 			wantErr:      false,
 		},
 		{
-			name:         "missing database by message",
+			name:         "missing database by message names the given database",
+			err:          errors.New(`database "app" does not exist`),
+			params:       map[string]string{pgDbname: "app"},
+			wantVerified: true,
+			wantErr:      false,
+		},
+		{
+			name:         "missing database by message names the user when no database is given",
+			err:          errors.New(`database "svc_reports" does not exist`),
+			params:       map[string]string{pgUser: "svc_reports"},
+			wantVerified: true,
+			wantErr:      false,
+		},
+		{
+			name:         "missing database by message for a database nobody asked for",
 			err:          errors.New(`database "postgres" does not exist`),
+			params:       map[string]string{pgUser: "svc_reports"},
+			wantVerified: false,
+			wantErr:      true,
+		},
+		{
+			name:         "proxy relays the failure without a sqlstate",
+			err:          errors.New(`server login has been failing, cached error: database "svc_reports" does not exist`),
+			params:       map[string]string{pgUser: "svc_reports"},
 			wantVerified: true,
 			wantErr:      false,
 		},
@@ -219,7 +254,7 @@ func TestClassifyPostgresVerifyError(t *testing.T) {
 	for _, tc := range tests {
 		t.Run(tc.name, func(t *testing.T) {
 			t.Parallel()
-			verified, err := classifyPostgresVerifyError(tc.err, tc.dbName)
+			verified, err := classifyPostgresVerifyError(tc.err, tc.params)
 			assert.Equal(t, tc.wantVerified, verified)
 			if tc.wantErr {
 				assert.Error(t, err)
```

---

### Incident Patch 15: `df5b7ce7` (2026-09-22)
**Commit Message**: fix(gitparse): cheaper low-memory git scan, stop losing trailing commits (#5331)

Listing commits used `git log`, which diffs every commit just to print hashes;
`git rev-list` does it far cheaper. Hashes now go in on stdin, so groups are
not capped by command length. Bad revisions return an error instead of looking
like an empty repo, and a scan that stops early now kills its git processes.
Also fixes a parser bug: a commit with no diffs was lost when last in a stream

**File**: `pkg/gitparse/README.md` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+# gitparse
+
+`gitparse` turns a git repository's history into a stream of `*Diff` values, one for each
+changed file in each commit. It is the front door for the git based sources: everything
+TruffleHog scans out of a repository's history comes through this package.
+
+It works by running the `git` binary and reading its text output, rather than reading
+git's object files directly. Parsing text is not pretty, but `git log --patch` already
+handles renames, binary files, path filters and merges, and rewriting all of that
+ourselves would be a much bigger thing to get wrong.
+
+## What comes out
+
+A `Diff` is one file's added content inside one commit, along with the details of that
+commit:
+
+```go
+diffChan, err := parser.RepoPath(ctx, repoPath, "", true, nil, false)
+for diff := range diffChan {
+    diff.Commit.Hash    // the commit this change belongs to
+    diff.PathB          // the path of the changed file
+    diff.LineStart      // where in the file the hunk starts
+    diff.ReadCloser()   // the added lines, and nothing else
+}
+```
+
+Only added lines are kept. Removed and unchanged lines are thrown away, because a secret
+that was deleted was already there in the commit that added it, and that commit is in the
+stream too.
+
+Commit details are attached to every diff. A commit with no file changes at all, such as
+a merge or an empty commit, is still sent once on its own, because its message, author and
+notes can hold a secret even when no file changed.
+
+Diff content goes to one of two writers, chosen by the caller. `buffer_writer` keeps it in
+memory and is the default. `buffered_file_writer` spills to disk past a size and is turned
+on with `UseCustomContentWriter`. Repositories with big files want the second one.
+
+## How the log is produced
+
+There are two ways, and the caller picks.
+
+**The normal way** is one `git log --patch` for the whole repository. Simple, fast, and
+fine for most repositories.
+
+**The lower memory way** is turned on with `UseLowMemoryScan`, which the CLI exposes as
+`--git-low-memory-scan`. It exists because one `git log --patch` keeps a little state for
+every commit it walks and never gives any of it back, so on a repository with millions of
+commits it grows until the machine kills it.
+
+That mode splits the work in two:
+
+1. **List the commits.** `git rev-list` prints the hashes we want and nothing else. The
+   hashes come back in groups, so the next step can start before the whole history has
+   been walked.
+
+2. **Make the patches.** Each group of hashes is handed to its own short lived `git log`
+   process, which reads them on standard input. Each process only holds state for its own
+   group and then exits, so this step costs the same no matter how long the history is.
+
+The results of all those processes are joined back into the single channel the caller
+sees, so nothing above this package needs to know which way was used.
+
+## Things that look like details but are not
+
+Each of these came from a test or a measurement that said otherwise.
+
+**Listing uses `git rev-list`, not `git log`.** They can both print hashes, but `git log`
+sets up git's diff machinery as soon as a diff option is present, and then compares files
+in every commit just to decide which commits to print. `rev-list` never does that. This is
+the step that uses the most memory on long histories, so the difference matters, and it is
+large.
+
+**Diff options stay out of the listing step.** Options like `--diff-filter=AM` live with
+the patch options, not the commit picking options. `rev-list` rejects them anyway. Leaving
+them out means the listing picks up a few extra commits whose changes are all filtered
+away, and the `git log` that makes the patches drops those commits itself, exactly as the
+single command form does. The end result is the same commits, worked out in the cheaper
+place.
+
+**Patches come from `git log --no-walk=unsorted`, not `git show`.** They print the same
+thing for ordinary commits, but only `git log` applies `--diff-filter` to whole commits,
+so using `git show` here would scan more commits than the normal way does. `unsorted`
+matters too: plain `--no-walk` re-sorts each group by commit date, which scrambles the
+order across groups.
+
+**Hashes go in on standard input, not as arguments.** A command line has a length limit,
+and on Windows it is short enough to cap a group at a few dozen commits. Standard input
+has no such limit, so groups can be thousands of commits and full hashes can be used
+instead of shortened ones. Fewer, bigger groups mean fewer git processes to start.
+
+**Path filters go to both steps.** The listing needs them to pick the same commits the
+single command would have shown, and the patch step needs them to decide which files show
+up.
+
+**The last commit of a stream needs finishing off.** The parser normally completes a
+commit when it sees the next one begin. The last commit never gets that, so 
```

**File**: `pkg/gitparse/gitparse.go` (modified, +126/-54)
```diff
@@ -4,6 +4,7 @@ import (
 	"bufio"
 	"bytes"
 	"cmp"
+	"errors"
 	"fmt"
 	"io"
 	"os"
@@ -36,13 +37,13 @@ const (
 	// defaultWaitDelay is the default time to wait after context cancellation before forcefully killing git processes.
 	defaultWaitDelay = 5 * time.Second
 
-	// abbrevCommit is the git sha abbreviation length to use for `git show` invocations in the lower-memory scan mode.
-	abbrevCommit = 20
-
-	// showGroupSize is the number of commits per `git show` in the lower-memory scan mode.
+	// logGroupSize is the number of commits per `git log` in the lower-memory scan mode.
 	//
-	// Windows has a command length limit of 32767, so at these values we should only be using a tiny part of of that for the commit list ((abbrevCommit + 1) * showGroupSize).  We don't target any platforms with shorter limits.
-	showGroupSize = 75
+	// The hashes are fed in on stdin rather than as arguments, so a group is not
+	// limited by how long a command line may be and we can use full hashes. Bigger
+	// groups mean fewer git processes to start; each one still only holds state for
+	// its own group, which is what keeps memory flat however long the history is.
+	logGroupSize = 5000
 )
 
 // contentWriter defines a common interface for writing, reading, and managing diff content.
@@ -141,6 +142,11 @@ type Parser struct {
 
 	useCustomContentWriter bool
 	lowMemoryScan          bool
+
+	// groupSize is how many commits go to each `git log` in the lower-memory scan.
+	// Zero means logGroupSize. Only the tests set it, so they can put a group
+	// boundary wherever they need one.
+	groupSize int
 }
 
 type ParseState int
@@ -286,7 +292,7 @@ func (c *Parser) RepoPath(
 }
 
 func (c *Parser) repoPathLowMemory(ctx context.Context, args gitArgs) (chan *Diff, error) {
-	commitGroups, err := c.gatherGitLog(ctx, args)
+	commitGroups, err := c.enumerateCommits(ctx, args)
 	if err != nil {
 		return nil, err
 	}
@@ -295,7 +301,7 @@ func (c *Parser) repoPathLowMemory(ctx context.Context, args gitArgs) (chan *Dif
 	// different goroutine after the command finishes, but we're not
 	// running a single command anymore. we'll use a channel of channels to
 	// reduce back to one channel we return to our caller.  Unbuffered so
-	// we have at most one git show running and one git show draining.
+	// we have at most one git log running and one git log draining.
 	diffGroups := make(chan chan *Diff)
 	go func() {
 		defer common.RecoverWithExit(ctx)
@@ -306,20 +312,36 @@ func (c *Parser) repoPathLowMemory(ctx context.Context, args gitArgs) (chan *Dif
 				return
 			}
 
-			showCmd := exec.CommandContext(ctx,
+			// `git log` over an explicit list, not `git show`. The two print the
+			// same thing for ordinary commits, but only log applies --diff-filter
+			// to whole commits, so this is what keeps the set of scanned commits
+			// the same as the single-command form.
+			logCmd := exec.CommandContext(ctx,
 				"git",
-				slices.Concat(args.global, []string{"show"}, args.show, group, args.paths)...,
+				slices.Concat(
+					args.global, []string{"log"}, args.show,
+					[]string{
+						// Keep the commits in the order rev-list gave them. Plain
+						// --no-walk would re-sort each group by commit date, which
+						// scrambles the order across groups.
+						"--no-walk=unsorted",
+						// Hashes come in on stdin, so the group size is ours to pick.
+						"--stdin",
+					},
+					args.paths,
+				)...,
 			)
-			showCmd.Env = args.env
+			logCmd.Env = args.env
+			logCmd.Stdin = strings.NewReader(strings.Join(group, "\n") + "\n")
 
-			diffGroup, err := c.executeCommand(ctx, showCmd, false)
+			diffGroup, err := c.executeCommand(ctx, logCmd, false)
 			if err != nil {
-				ctx.Logger().Error(err, "Error executing git show for commit group.")
+				ctx.Logger().Error(err, "Error executing git log for commit group.")
 				return
 			}
 			err = common.CancellableWrite(ctx, diffGroups, diffGroup)
 			if err != nil {
-				ctx.Logger().Error(err, "git show interation cancelled")
+				ctx.Logger().Error(err, "git log iteration cancelled")
 				return
 			}
 		}
@@ -346,71 +368,101 @@ func (c *Parser) repoPathLowMemory(ctx context.Context, args gitArgs) (chan *Dif
 	return diffChan, nil
 }
 
-// Ask git for a list of all relevant commit hashes but only hashes.  Git takes
-// on the work of linearizing history for us, then we work through the commit
-// list.  Returns a channel of groups of commit IDs, so scanning can start asap
-// even if git log is taking a bit for large repos.
-func (c *Parser) gatherGitLog(ctx context.Context, args gitArgs) (chan []string, error) {
+// enumerateCommits asks git for the hashes of the commits we mean to scan, and
+// nothing else. It returns them in groups, so patch generation can start before the
+// whole history has been walked.
+//
+// This uses `git rev-list` rather than `git log`. rev-list is the plumbing command for
+// listing commits and never sets up git's diff machinery, which `git log` does a
```

**File**: `pkg/gitparse/gitparse_test.go` (modified, +4/-2)
```diff
@@ -36,8 +36,10 @@ func TestPrepGitArgs(t *testing.T) {
 	// head
 	assert.Contains(t, args.log, "branchname")
 	assert.NotContains(t, args.log, "--all")
-	// abbreviatedLog
-	assert.Contains(t, args.log, "--diff-filter=AM")
+	// abbreviatedLog. Only show carries the diff filter: args.log holds the options
+	// that choose commits and is what the lower-memory scan gives to `git rev-list`,
+	// which rejects diff options.
+	assert.NotContains(t, args.log, "--diff-filter=AM")
 	assert.Contains(t, args.show, "--diff-filter=AM")
 	// excludedGlobs
 	assert.Contains(t, args.paths, "--")
```

**File**: `pkg/gitparse/lowmemory_test.go` (added, +282/-0)
```diff
@@ -0,0 +1,282 @@
+package gitparse
+
+import (
+	"os"
+	"os/exec"
+	"path/filepath"
+	"strings"
+	"testing"
+
+	"github.com/trufflesecurity/trufflehog/v3/pkg/context"
+)
+
+// The lower-memory scan splits one `git log` into a `git rev-list` that lists commits
+// and a `git log` per group that generates their patches. These tests hold it to the
+// only thing that really matters: it must find exactly what the single-command form
+// finds, wherever the group boundaries happen to land.
+
+// collectDiffs drains a diff channel into something comparable. Content is included,
+// since a group boundary in the wrong place could keep the commit and lose its patch.
+func collectDiffs(t *testing.T, diffChan chan *Diff) []string {
+	t.Helper()
+
+	var out []string
+	for diff := range diffChan {
+		content := ""
+		// A commit with no diffs arrives with nothing written, and asking such a diff
+		// for its content fails, so check before reading.
+		if diff.contentWriter != nil && diff.Len() > 0 {
+			got, err := diff.contentWriter.String()
+			if err != nil {
+				t.Fatalf("reading diff content: %v", err)
+			}
+			content = got
+		}
+		out = append(out, strings.Join([]string{diff.Commit.Hash, diff.PathB, content}, "\x00"))
+	}
+	return out
+}
+
+func TestLowMemoryScanMatchesSingleProcess(t *testing.T) {
+	repo := testRepoRoot(t)
+
+	// abbreviatedLog is the caller's BaseHash == "", so both values are real
+	// configurations and they take different paths through git. With it on, git drops
+	// commits whose diffs are all filtered away; with it off, those commits stay.
+	//
+	// The group sizes go down to 1 on purpose. Every group ends a stream, and a commit
+	// with no diffs used to be dropped when it landed at the end of one, so a size of 1
+	// puts every commit in that spot at once. Before cleanupParse learned to finish off
+	// the last commit, this repository lost 84 diffs at size 1 and 1 at size 75.
+	for _, tc := range []struct {
+		name        string
+		abbreviated bool
+	}{
+		{"abbreviated", true},
+		{"full", false},
+	} {
+		abbreviated, name := tc.abbreviated, tc.name
+
+		t.Run(name, func(t *testing.T) {
+			ctx := context.Background()
+
+			single := NewParser()
+			singleChan, err := single.RepoPath(ctx, repo, "", abbreviated, nil, false)
+			if err != nil {
+				t.Fatalf("single-process RepoPath: %v", err)
+			}
+			want := collectDiffs(t, singleChan)
+			if len(want) == 0 {
+				t.Fatal("single-process scan produced no diffs")
+			}
+
+			// Group sizes small enough that this repository crosses boundaries, which
+			// is the only place the two forms can drift apart.
+			for _, groupSize := range []int{1, 2, 7, 500} {
+				low := NewParser(UseLowMemoryScan())
+				low.groupSize = groupSize
+
+				lowChan, err := low.RepoPath(ctx, repo, "", abbreviated, nil, false)
+				if err != nil {
+					t.Fatalf("group size %d: RepoPath: %v", groupSize, err)
+				}
+				got := collectDiffs(t, lowChan)
+
+				if len(got) != len(want) {
+					t.Fatalf("group size %d: got %d diffs, want %d", groupSize, len(got), len(want))
+				}
+				for i := range want {
+					if got[i] != want[i] {
+						t.Fatalf("group size %d: diff %d differs\n got: %q\nwant: %q",
+							groupSize, i, got[i], want[i])
+					}
+				}
+			}
+		})
+	}
+}
+
+// TestLowMemoryScanExcludedGlobs checks the path filters reach both commands. They
+// decide which commits rev-list lists and which files the patches contain, so sending
+// them to only one of the two would quietly change what gets scanned.
+func TestLowMemoryScanExcludedGlobs(t *testing.T) {
+	repo := testRepoRoot(t)
+	ctx := context.Background()
+	globs := []string{"*.go"}
+
+	single := NewParser()
+	singleChan, err := single.RepoPath(ctx, repo, "", true, globs, false)
+	if err != nil {
+		t.Fatalf("single-process RepoPath: %v", err)
+	}
+	want := collectDiffs(t, singleChan)
+
+	low := NewParser(UseLowMemoryScan())
+	low.groupSize = 13
+	lowChan, err := low.RepoPath(ctx, repo, "", true, globs, false)
+	if err != nil {
+		t.Fatalf("low-memory RepoPath: %v", err)
+	}
+	got := collectDiffs(t, lowChan)
+
+	if len(got) != len(want) {
+		t.Fatalf("got %d diffs, want %d", len(got), len(want))
+	}
+	for i := range want {
+		if got[i] != want[i] {
+			t.Fatalf("diff %d differs\n got: %q\nwant: %q", i, got[i], want[i])
+		}
+	}
+}
+
+// TestLowMemoryScanUnknownHead covers the error the old form threw away. A bad revision
+// used to be logged and the channel closed, so a typo in a branch name looked exactly
+// like an empty repository.
+func TestLowMemoryScanUnknownHead(t *testing.T) {
+	repo := testRepoRoot(t)
+
+	parser := NewParser(UseLowMemoryScan())
+	if _, err := parser.RepoPath(context.Background(), repo, "no-such-ref-exists", true, nil, false); err == nil {
+		t.Fatal("expected an error for an unknown head, got nil")
+	}
+}
+
+// TestLowMemoryScanEmptyRepo checks a repository with no commits ends the scan cleanly
+// rather than failing. rev-list prints nothing and exits zero, which h
```

**File**: `pkg/sources/git/git.go` (modified, +7/-0)
```diff
@@ -856,6 +856,13 @@ func (s *Git) ScanCommits(ctx context.Context, repo *git.Repository, path string
 		repoCtx = ctx
 	}
 
+	// The scan can stop before the diff channel is drained, on max depth or on
+	// reaching the base commit. Nothing else tells the parser that, so cancelling on
+	// the way out is what shuts down the git processes still producing diffs. Without
+	// it they sit blocked on a channel nobody is reading until the whole scan ends.
+	repoCtx, cancel := context.WithCancel(repoCtx)
+	defer cancel()
+
 	logger := repoCtx.Logger()
 	var logValues []any
 	if scanOptions.BaseHash != "" {
```

#### Recent Merged Pull Requests:
- **PR #5388** (2026-10-05): Add Jenkins source documentation (@kashifkhan0771)
- **PR #5385** (closed): Fix cmp.Diff panic in TestOkta_FromChunk and record the scope of the defect class (T1) (@MuneebUllahKhan222)
- **PR #5383** (2026-10-05): Fix NetSuite detector running out of memory on dense input (@shahzadhaider1)
- **PR #5380** (2026-10-02): fix(github): switch back to fetching access token through apiClient, (@mariduv)
- **PR #5377** (2026-10-01): List only the include prefixes in S3 scans (@shahzadhaider1)
- **PR #5375** (2026-10-05): docs: point five internal links at files that exist (@CalvinTjoaquinn)
- **PR #5373** (2026-10-01): Add huggingface source documentation (@kashifkhan0771)
- **PR #5372** (closed): fix(detectors/cloudflareapitoken): match tokens ending in - or _ (@moizxsec)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
