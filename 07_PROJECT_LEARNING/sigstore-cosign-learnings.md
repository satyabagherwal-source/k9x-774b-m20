# Forensic Learning Record (Deep Inspection): sigstore/cosign

> **Canonical Artifact**: `07_PROJECT_LEARNING/sigstore-cosign-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sigstore/cosign](https://github.com/sigstore/cosign))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:52:03.111Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sigstore/cosign`
- **Description**: Code signing and transparency for containers and binaries
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 6348 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `pkg/cosign/fulcioverifier/ctutil/ctutil.go`
```
// Copyright 2018 Google LLC. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package copied from
// https://github.com/google/certificate-transparency-go/blob/master/ctutil/ctutil.go

// Package ctutil contains utilities for Certificate Transparency.
package ctutil

import (
	"bytes"
	"crypto"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"

	ct "github.com/google/certificate-transparency-go"
	"github.com/google/certificate-transparency-go/tls"
	"github.com/google/certificate-transparency-go/x509"
)

var emptyHash = [sha256.Size]byte{}

// LeafHashB64 does as LeafHash does, but returns the leaf hash base64-encoded.
// The base64-encoded leaf hash returned by B64LeafHash can be used with the
// get-proof-by-hash API endpoint of Certificate Transparency Logs.
func LeafHashB64(chain []*x509.Certificate, sct *ct.SignedCertificateTimestamp, embedded bool) (string, error) {
	hash, err := LeafHash(chain, sct, embedded)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(hash[:]), nil
}

// LeafHash calculates the leaf hash of the certificate or precertificate at
// chain[0] that sct was issued for.
//
// sct is required because the SCT timestamp is used to calculate the leaf hash.
// Leaf hashes are unique to (pre)certificate-SCT pairs.
//
// This function can be used with three different types of leaf certificate:
//   - X.509 Certificate:
//     If using this function to calculate the leaf hash for a normal X.509
//     certificate then it is enough to just provide the end entity
//     certificate in chain. This case assumes that the SCT being provided is
//     not embedded within the leaf certificate provided, i.e. the certificate
//     is what was submitted to the Certificate Transparency Log in order to
//     obtain the SCT.  For this case, set embedded to false.
//   - Precertificate:
//     If using this function to calculate the leaf hash for a precertificate
//     then the issuing certificate must also be provided in chain.  The
//     precertificate should be at chain[0], and its issuer at chain[1].  For
//     this case, set embedded to false.
//   - X.509 Certificate containing the SCT embedded within it:
//     If using this function to calculate the leaf hash for a certificate
//     where the SCT provided is embedded within the certificate you
//     are providing at chain[0], set embedded to true.  LeafHash will
//     calculate the leaf hash by building the corresponding precertificate.
//     LeafHash will return an error if the provided SCT cannot be found
//     embedded within chain[0].  As with the precertificate case, the issuing
//     certificate must also be provided in chain.  The certificate containing
//     the embedded SCT should be at chain[0], and its issuer at chain[1].
//
// Note: LeafHash doesn't check that the provided SCT verifies for the given
// chain.  It simply calculates what the leaf hash would be for the given
// (pre)certificate-SCT pair.
func LeafHash(chain []*x509.Certificate, sct *ct.SignedCertificateTimestamp, embedded bool) ([sha256.Size]byte, error) {
	leaf, err := createLeaf(chain, sct, embedded)
	if err != nil {
		return emptyHash, err
	}
	return ct.LeafHashForLeaf(leaf)
}

// VerifySCT takes the public key of a Certificate Transparency Log, a
// certificate chain, and an SCT and verifies whether the SCT is a valid SCT for
// the certificate at chain[0], signed by the Log that the public key belongs
// to.  If the SCT does not verify, an error will be returned.
//
// This function can be used with three different types of leaf certificate:
//   - X.509 Certificate:
//     If using this function to verify an SCT for a normal X.509 certificate
//     then it is enough to just provide the end entity certificate in chain.
//     This case assumes that the SCT being provided is not embedded within
//     the leaf certificate provided, i.e. the certificate is what was
//     submitted to the Certificate Transparency Log in order to obtain the
//     SCT.  For this case, set embedded to false.
//   - Precertificate:
//     If using this function to verify an SCT for a precertificate then the
//     issuing certificate must also be provided in chain.  The precertificate
//     should be at chain[0], and its issuer at chain[1].  For this case, set
//     embedded to false.
//   - X.509 Certificate containing the SCT embedded within it:
//     If the SCT you wish to verify is embedded within the certificate you
//     are providing at chain[0], set embedded to true.  VerifySCT will
//     verify the provided SCT by building the corresponding precertificate.
//     VerifySCT will return an error if the provided SCT cannot be found
//     embedded within chain[0].  As with the precertificate case, the issuing
//     certificate must also be provided in chain.  The certificate containing
//     the embedded SCT should be at chain[0], and its issuer at chain[1].
func VerifySCT(pubKey crypto.PublicKey, chain []*x509.Certificate, sct *ct.SignedCertificateTimestamp, embedded bool) error {
	s, err := ct.NewSignatureVerifier(pubKey)
	if err != nil {
		return fmt.Errorf("error creating signature verifier: %w", err)
	}

	return VerifySCTWithVerifier(s, chain, sct, embedded)
}

// VerifySCTWithVerifier takes a ct.SignatureVerifier, a certificate chain, and
// an SCT and verifies whether the SCT is a valid SCT for the certificate at
// chain[0], signed by the Log whose public key was used to set up the
// ct.SignatureVerifier.  If the SCT does not verify, an error will be returned.
//
// This function can be used with three different types of leaf certificate:
//   - X.509 Certificate:
//     If using this function to verify an SCT for a normal X.509 certificate
//     then it is enough to just provide the end entity certificate in chain.
//     This case assumes that the SCT being provided is not embedded within
//     the leaf certificate provided, i.e. the certificate is what was
//     submitted to the Certificate Transparency Log in order to obtain the
//     SCT.  For this case, set embedded to false.
//   - Precertificate:
//     If using this function to verify an SCT for a precertificate then the
//     issuing certificate must also be provided in chain.  The precertificate
//     should be at chain[0], and its issuer at chain[1].  For this case, set
//     embedded to false.
//   - X.509 Certificate containing the SCT embedded within it:
//     If the SCT you wish to verify is embedded within the certificate you
//     are providing at chain[0], set embedded to true.  VerifySCT will
//     verify the provided SCT by building the corresponding precertificate.
//     VerifySCT will return an error if the provided SCT cannot be found
//     embedded within chain[0].  As with the precertificate case, the issuing
//     certificate must also be provided in chain.  The certificate containing
//     the embedded SCT should be at chain[0], and its issuer at chain[1].
func VerifySCTWithVerifier(sv *ct.SignatureVerifier, chain []*x509.Certificate, sct *ct.SignedCertificateTimestamp, embedded bool) error {
	if sv == nil {
		return errors.New("ct.SignatureVerifier is nil")
	}

	leaf, err := createLeaf(chain, sct, embedded)
	if err != nil {
		return err
	}

	return sv.VerifySCTSignature(*sct, ct.LogEntry{Leaf: *leaf})
}

func createLeaf(chain []*x509.Certificate, sct *ct.SignedCertificateTimestamp, embedded bool) (*ct.MerkleTreeLeaf, error) {
	if len(chain) == 0 {
		return nil, errors.New("chain is empty")
	}
	if sct == nil {
		return nil, errors.New("sct is nil")
	}

	if embedded {
		sctPresent, err := ContainsSCT(chain[0], sct)
		if err != nil {
			return nil, fmt.Errorf("error checking for SCT in leaf certificate: %w", err)
		}
		if !sctPresent {
			return nil, errors.New("SCT provided is not embedded within leaf certificate")
		}
	}

	certType := ct.X509LogEntryType
	if chain[0].IsPrecertificate() || embedded {
		certType = ct.PrecertLogEntryType
	}

	var leaf *ct.MerkleTreeLeaf
	var err error
	if embedded {
		leaf, err = ct.MerkleTreeLeafForEmbeddedSCT(chain, sct.Timestamp)
	} else {
		leaf, err = ct.MerkleTreeLeafFromChain(chain, certType, sct.Timestamp)
	}
	if err != nil {
		return nil, fmt.Errorf("error creating MerkleTreeLeaf: %w", err)
	}
	return leaf, nil
}

// ContainsSCT checks to see whether the given SCT is embedded within the given
// certificate.
func ContainsSCT(cert *x509.Certificate, sct *ct.SignedCertificateTimestamp) (bool, error) {
	if cert == nil || sct == nil {
		return false, nil
	}

	sctBytes, err := tls.Marshal(*sct)
	if err != nil {
		return false, fmt.Errorf("error tls.Marshalling SCT: %w", err)
	}
	for _, s := range cert.SCTList.SCTList {
		if bytes.Equal(sctBytes, s.Val) {
			return true, nil
		}
	}
	return false, nil
}

```

### Core Architecture Module: `pkg/cosign/pivkey/util.go`
```
//go:build pivkey && cgo
// +build pivkey,cgo

// Copyright 2021 The Sigstore Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package pivkey

import (
	"github.com/go-piv/piv-go/v2/piv"
)

func SlotForName(slotName string) *piv.Slot {
	switch slotName {
	case "":
		return &piv.SlotSignature
	case "authentication":
		return &piv.SlotAuthentication
	case "signature":
		return &piv.SlotSignature
	case "card-authentication":
		return &piv.SlotCardAuthentication
	case "key-management":
		return &piv.SlotKeyManagement
	default:
		return nil
	}
}

func PINPolicyForName(policyName string, slot piv.Slot) piv.PINPolicy {
	switch policyName {
	case "":
		return defaultPINPolicyForSlot(slot)
	case "never":
		return piv.PINPolicyNever
	case "once":
		return piv.PINPolicyOnce
	case "always":
		return piv.PINPolicyAlways
	default:
		return -1
	}
}

func TouchPolicyForName(policyName string, slot piv.Slot) piv.TouchPolicy {
	switch policyName {
	case "":
		return defaultTouchPolicyForSlot(slot)
	case "never":
		return piv.TouchPolicyNever
	case "cached":
		return piv.TouchPolicyCached
	case "always":
		return piv.TouchPolicyAlways
	default:
		return -1
	}
}

func defaultPINPolicyForSlot(slot piv.Slot) piv.PINPolicy {
	//
	// Defaults from https://developers.yubico.com/PIV/Introduction/Certificate_slots.html
	//

	switch slot {
	case piv.SlotAuthentication:
		return piv.PINPolicyOnce
	case piv.SlotSignature:
		return piv.PINPolicyAlways
	case piv.SlotKeyManagement:
		return piv.PINPolicyOnce
	case piv.SlotCardAuthentication:
		return piv.PINPolicyNever
	default:
		// This should never happen
		panic("invalid value for slot")
	}
}

func defaultTouchPolicyForSlot(slot piv.Slot) piv.TouchPolicy {
	//
	// Defaults from https://developers.yubico.com/PIV/Introduction/Certificate_slots.html
	//

	switch slot {
	case piv.SlotAuthentication:
		return piv.TouchPolicyCached
	case piv.SlotSignature:
		return piv.TouchPolicyAlways
	case piv.SlotKeyManagement:
		return piv.TouchPolicyCached
	case piv.SlotCardAuthentication:
		return piv.TouchPolicyNever
	default:
		// This should never happen
		panic("invalid value for slot")
	}
}

```

### Core Architecture Module: `pkg/cosign/pkcs11key/util.go`
```
// Copyright 2021 The Sigstore Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package pkcs11key

import (
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/sigstore/cosign/v3/pkg/cosign/env"
)

const (
	ReferenceScheme = "pkcs11:"
)

var pathAttrValueChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~:[]@!$'()*+,=&"
var queryAttrValueChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~:[]@!$'()*+,=/?|"

func percentEncode(input []byte) string {
	if len(input) == 0 {
		return ""
	}

	var stringBuilder strings.Builder
	for i := 0; i < len(input); i++ {
		stringBuilder.WriteByte('%')
		fmt.Fprintf(&stringBuilder, "%.2x", input[i])
	}

	return stringBuilder.String()
}

func EncodeURIComponent(uriString string, isForPath bool, usePercentEncoding bool) (string, error) {
	var stringBuilder strings.Builder
	var allowedChars string

	if isForPath {
		allowedChars = pathAttrValueChars
	} else {
		allowedChars = queryAttrValueChars
	}

	for i := 0; i < len(uriString); i++ {
		allowedChar := false

		for j := 0; j < len(allowedChars); j++ {
			if uriString[i] == allowedChars[j] {
				allowedChar = true
				break
			}
		}

		if allowedChar {
			stringBuilder.WriteByte(uriString[i])
		} else {
			if usePercentEncoding {
				stringBuilder.WriteString(percentEncode([]byte{uriString[i]}))
			} else {
				return "", errors.New("string contains an invalid character")
			}
		}
	}

	return stringBuilder.String(), nil
}

type Pkcs11UriConfig struct {
	uriPathAttributes  url.Values
	uriQueryAttributes url.Values

	ModulePath string
	SlotID     *int
	TokenLabel string
	KeyLabel   []byte
	KeyID      []byte
	Pin        string
}

func NewPkcs11UriConfig() *Pkcs11UriConfig {
	return &Pkcs11UriConfig{
		uriPathAttributes:  make(url.Values),
		uriQueryAttributes: make(url.Values),
	}
}

func NewPkcs11UriConfigFromInput(modulePath string, slotID *int, tokenLabel string, keyLabel []byte, keyID []byte, pin string) *Pkcs11UriConfig {
	return &Pkcs11UriConfig{
		uriPathAttributes:  make(url.Values),
		uriQueryAttributes: make(url.Values),
		ModulePath:         modulePath,
		SlotID:             slotID,
		TokenLabel:         tokenLabel,
		KeyLabel:           keyLabel,
		KeyID:              keyID,
		Pin:                pin,
	}
}

func (conf *Pkcs11UriConfig) Parse(uriString string) error {
	var slotID *int
	var pin string

	uri, err := url.Parse(uriString)
	if err != nil {
		return fmt.Errorf("parse uri: %w", err)
	}
	if uri.Scheme != "pkcs11" {
		return errors.New("invalid uri: not a PKCS11 uri")
	}

	// Semicolons are no longer valid separators, therefore,
	// we need to replace all occurrences of ";" with "&"
	// in uri.Opaque and uri.RawQuery before passing them to url.ParseQuery().
	uri.Opaque = strings.ReplaceAll(uri.Opaque, ";", "&")
	uriPathAttributes, err := url.ParseQuery(uri.Opaque)
	if err != nil {
		return fmt.Errorf("parse uri path: %w", err)
	}
	uri.RawQuery = strings.ReplaceAll(uri.RawQuery, ";", "&")
	uriQueryAttributes, err := url.ParseQuery(uri.RawQuery)
	if err != nil {
		return fmt.Errorf("parse uri query: %w", err)
	}
	modulePath := uriQueryAttributes.Get("module-path")
	pinValue := uriQueryAttributes.Get("pin-value")
	tokenLabel := uriPathAttributes.Get("token")
	slotIDStr := uriPathAttributes.Get("slot-id")
	keyLabel := uriPathAttributes.Get("object")
	keyID := uriPathAttributes.Get("id")

	// At least one of token and slot-id must be specified.
	if tokenLabel == "" && slotIDStr == "" {
		return errors.New("invalid uri: one of token and slot-id must be set")
	}

	// slot-id, if specified, should be a number.
	if slotIDStr != "" {
		slot, err := strconv.Atoi(slotIDStr)
		if err != nil {
			return fmt.Errorf("invalid uri: slot-id '%s' is not a valid number", slotIDStr)
		}
		slotID = &slot
	}

	// If pin-value is specified, take it as it is.
	if pinValue != "" {
		pin = pinValue
	}

	// module-path should be specified and should point to the absolute path of the PKCS11 module.
	// If it is not, COSIGN_PKCS11_MODULE_PATH environment variable must be set.
	if modulePath == "" {
		modulePath = env.Getenv(env.VariablePKCS11ModulePath)
		if modulePath == "" {
			return errors.New("invalid uri: module-path or COSIGN_PKCS11_MODULE_PATH must be set to the absolute path of the PKCS11 module")
		}
	}

	// At least one of object and id must be specified.
	if keyLabel == "" && keyID == "" {
		return errors.New("invalid uri: one of object and id must be set")
	}

	conf.uriPathAttributes = uriPathAttributes
	conf.uriQueryAttributes = uriQueryAttributes
	conf.ModulePath = modulePath
	conf.TokenLabel = tokenLabel
	conf.SlotID = slotID
	conf.KeyLabel = []byte(keyLabel)
	conf.KeyID = []byte(keyID) // url.ParseQuery() already calls url.QueryUnescape() on the id, so we only need to cast the result into byte array
	conf.Pin = pin

	return nil
}

func (conf *Pkcs11UriConfig) Construct() (string, error) {
	var modulePath, pinValue, tokenLabel, slotID, keyID, keyLabel string
	var err error

	uriString := "pkcs11:"

	// module-path should be specified and should point to the absolute path of the PKCS11 module.
	if conf.ModulePath == "" {
		return "", errors.New("module path must be set to the absolute path of the PKCS11 module")
	}

	// At least one of keyLabel and keyID must be specified.
	if len(conf.KeyLabel) == 0 && len(conf.KeyID) == 0 {
		return "", errors.New("one of keyLabel and keyID must be set")
	}

	// At least one of tokenLabel and slotID must be specified.
	if conf.TokenLabel == "" && conf.SlotID == nil {
		return "", errors.New("one of tokenLabel and slotID must be set")
	}

	// Construct the URI.
	if conf.TokenLabel != "" {
		tokenLabel, err = EncodeURIComponent(conf.TokenLabel, true, true)
		if err != nil {
			return "", fmt.Errorf("encode token label: %w", err)
		}
		uriString += "token=" + tokenLabel
	}
	if conf.SlotID != nil {
		slotID = fmt.Sprintf("%d", *conf.SlotID)
		uriString += ";slot-id=" + slotID
	}
	if len(conf.KeyID) != 0 {
		keyID = percentEncode(conf.KeyID)
		uriString += ";id=" + keyID
	}
	if len(conf.KeyLabel) != 0 {
		keyLabel, err = EncodeURIComponent(string(conf.KeyLabel), true, true)
		if err != nil {
			return "", fmt.Errorf("encode key label: %w", err)
		}
		uriString += ";object=" + keyLabel
	}
	modulePath, err = EncodeURIComponent(conf.ModulePath, false, true)
	if err != nil {
		return "", fmt.Errorf("encode module path: %w", err)
	}
	uriString += "?module-path=" + modulePath
	if conf.Pin != "" {
		pinValue, err = EncodeURIComponent(conf.Pin, false, true)
		if err != nil {
			return "", fmt.Errorf("encode pin: %w", err)
		}
		uriString += "&pin-value=" + pinValue
	}

	return uriString, nil
}

```

### Core Architecture Module: `cmd/conformance/main.go`
```
// Copyright 2024 The Sigstore Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/sigstore/sigstore-go/pkg/bundle"
)

var bundlePath *string
var certOIDC *string
var certSAN *string
var identityToken *string
var trustedRootPath *string
var signingConfigPath *string
var keyPath *string
var inToto bool
var staging bool

func usage() {
	fmt.Println("Usage:")
	fmt.Printf("\t%s sign-bundle [--staging] [--in-toto] --identity-token TOKEN [--signing-config FILE] [--trusted-root FILE] --bundle FILE FILE\n", os.Args[0])
	fmt.Printf("\t%s verify-bundle [--staging] --bundle FILE [--certificate-identity IDENTITY --certificate-oidc-issuer URL] [--key FILE] [--trusted-root FILE] FILE\n", os.Args[0])
}

func parseArgs() {
	for i := 2; i < len(os.Args); {
		switch os.Args[i] {
		case "--bundle":
			bundlePath = &os.Args[i+1]
			i += 2
		case "--certificate-oidc-issuer":
			certOIDC = &os.Args[i+1]
			i += 2
		case "--certificate-identity":
			certSAN = &os.Args[i+1]
			i += 2
		case "--identity-token":
			identityToken = &os.Args[i+1]
			i += 2
		case "--trusted-root":
			trustedRootPath = &os.Args[i+1]
			i += 2
		case "--signing-config":
			signingConfigPath = &os.Args[i+1]
			i += 2
		case "--key":
			keyPath = &os.Args[i+1]
			i += 2
		case "--in-toto":
			inToto = true
			i++
		case "--staging":
			staging = true
			i++
		default:
			i++
		}
	}
}

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}

	parseArgs()

	args := []string{}

	switch os.Args[1] {
	case "sign-bundle":
		if inToto {
			args = append(args, "attest-blob")
		} else {
			args = append(args, "sign-blob")
		}
		args = append(args, "-y")

	case "verify-bundle":
		args = append(args, "verify-blob")

		// How do we know if we should expect signed timestamps or not?
		// Let's crack open the bundle
		if bundlePath != nil {
			b, err := bundle.LoadJSONFromPath(*bundlePath)
			if err != nil {
				log.Fatal(err)
			}
			ts, err := b.Timestamps()
			if err != nil {
				log.Fatal(err)
			}
			if len(ts) > 0 {
				args = append(args, "--use-signed-timestamps")
			}
		}

	default:
		log.Fatalf("Unsupported command %q", os.Args[1]) // #nosec G706 -- CLI tool, args are operator-supplied
	}

	if bundlePath != nil {
		args = append(args, "--bundle", *bundlePath)
	}
	if identityToken != nil {
		args = append(args, "--identity-token", *identityToken)
	}
	if certSAN != nil {
		args = append(args, "--certificate-identity", *certSAN)
	}
	if certOIDC != nil {
		args = append(args, "--certificate-oidc-issuer", *certOIDC)
	}
	if trustedRootPath != nil {
		args = append(args, "--trusted-root", *trustedRootPath)
	}
	if signingConfigPath != nil {
		args = append(args, "--signing-config", *signingConfigPath)
	}
	if keyPath != nil {
		args = append(args, "--key", *keyPath)
	}
	if inToto {
		args = append(args, "--statement")
	}
	args = append(args, os.Args[len(os.Args)-1])

	dir := filepath.Dir(os.Args[0])
	initArgs := []string{"initialize"}
	if staging {
		initArgs = append(initArgs, "--staging")
	}
	initCmd := exec.Command(filepath.Join(dir, "cosign"), initArgs...) // #nosec G204,G702 -- conformance harness invokes the sibling cosign binary
	initCmd.Stdout = os.Stdout
	initCmd.Stderr = os.Stderr
	err := initCmd.Run()
	if err != nil {
		log.Fatal(err)
	}
	cmd := exec.Command(filepath.Join(dir, "cosign"), args...) // #nosec G204,G702 -- conformance harness invokes the sibling cosign binary
	var out strings.Builder
	cmd.Stdout = &out
	cmd.Stderr = &out
	err = cmd.Run()

	fmt.Println(out.String())

	if err != nil {
		log.Fatal(err)
	}
}

```

### Core Architecture Module: `cmd/cosign/cli/attach.go`
```
//
// Copyright 2021 The Sigstore Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cli

import (
	"fmt"
	"os"

	"github.com/sigstore/cosign/v3/cmd/cosign/cli/attach"
	"github.com/sigstore/cosign/v3/cmd/cosign/cli/options"
	"github.com/spf13/cobra"
)

func Attach() *cobra.Command {
	cmd := &cobra.Command{
		Use:        "attach",
		Short:      "Provides utilities for attaching artifacts to other artifacts in a registry",
		Deprecated: "attach will be removed in v4.0.0 (see https://github.com/sigstore/cosign/issues/4696). Instead, please use oras for attaching artifacts to other artifacts in a registry",
	}

	cmd.AddCommand(
		attachSignature(),
		attachSBOM(),
		attachAttestation(),
	)

	return cmd
}

func attachSignature() *cobra.Command {
	o := &options.AttachSignatureOptions{}

	cmd := &cobra.Command{
		Use:   "signature",
		Short: "Attach signatures to the supplied container image",
		Example: `  cosign attach signature [--payload <path>] [--signature < path>] [--rekor-response < path>] <image uri>

		cosign attach signature command attaches payload, signature, rekor-bundle, etc in a new layer of provided image.
		
		# Attach signature can attach payload to a supplied image
		cosign attach signature --payload <payload.json>  $IMAGE

		# Attach signature can attach payload, signature to a supplied image
		cosign attach signature --payload <payload.json> --signature <base64 signature file> $IMAGE

		# Attach signature can attach payload, signature, time stamped response to a supplied image
		cosign attach signature --payload <payload.json> --signature <base64 signature file> --tsr=<file> $IMAGE

		# Attach signature attaches payload, signature and rekor-bundle via rekor-response to a supplied image
		cosign attach signature --payload <payload.json> --signature <base64 signature file>  --rekor-response <proper rekor-response format file> $IMAGE

		# Attach signature attaches payload, signature and rekor-bundle directly to a supplied image
		cosign attach signature --payload <payload.json> --signature <base64 signature file>  --rekor-response <rekor-bundle file> $IMAGE`,
		PersistentPreRun: options.BindViper,
		Args:             cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return attach.SignatureCmd(cmd.Context(), o.Registry, o.Signature, o.Payload, o.Cert, o.CertChain, o.TimeStampedSig, o.RekorBundle, args[0])
		},
	}

	o.AddFlags(cmd)

	return cmd
}

func attachSBOM() *cobra.Command {
	o := &options.AttachSBOMOptions{}

	cmd := &cobra.Command{
		Use:              "sbom",
		Short:            "DEPRECATED: Attach sbom to the supplied container image",
		Long:             "Attach sbom to the supplied container image\n\n" + options.SBOMAttachmentDeprecation,
		Example:          "  cosign attach sbom <image uri>",
		Args:             cobra.ExactArgs(1),
		PersistentPreRun: options.BindViper,
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Fprintln(os.Stderr, options.SBOMAttachmentDeprecation)
			mediaType, err := o.MediaType()
			if err != nil {
				return err
			}
			fmt.Fprintf(os.Stderr, "WARNING: Attaching SBOMs this way does not sign them. To sign them, use 'cosign attest --predicate %s --key <key path>'.\n", o.SBOM)
			return attach.SBOMCmd(cmd.Context(), o.Registry, o.RegistryExperimental, o.SBOM, mediaType, args[0])
		},
	}

	o.AddFlags(cmd)

	return cmd
}

func attachAttestation() *cobra.Command {
	o := &options.AttachAttestationOptions{}

	cmd := &cobra.Command{
		Use:   "attestation",
		Short: "Attach attestation to the supplied container image",
		Example: `  cosign attach attestation --attestation <attestation file path> <image uri>

  # attach attestations from multiple files to a container image
  cosign attach attestation --attestation <attestation file path> --attestation <attestation file path> <image uri>

  # attach attestation from bundle files in form of JSONLines to a container image
  # https://github.com/in-toto/attestation/blob/main/spec/v1.0-draft/bundle.md
  cosign attach attestation --attestation <attestation bundle file path> <image uri>
`,

		Args:             cobra.MinimumNArgs(1),
		PersistentPreRun: options.BindViper,
		RunE: func(cmd *cobra.Command, args []string) error {
			return attach.AttestationCmd(cmd.Context(), o.Registry, o.Attestations, args[0])
		},
	}

	o.AddFlags(cmd)

	return cmd
}

```

### Core Architecture Module: `cmd/cosign/cli/attach/attach.go`
```
// Copyright 2021 The Sigstore Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package attach

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/google/go-containerregistry/pkg/name"
	ssldsse "github.com/secure-systems-lab/go-securesystemslib/dsse"
	"github.com/sigstore/cosign/v3/cmd/cosign/cli/options"
	"github.com/sigstore/cosign/v3/internal/ui"
	"github.com/sigstore/cosign/v3/pkg/oci/mutate"
	ociremote "github.com/sigstore/cosign/v3/pkg/oci/remote"
	"github.com/sigstore/cosign/v3/pkg/oci/static"
	"github.com/sigstore/cosign/v3/pkg/types"
	"github.com/sigstore/sigstore-go/pkg/bundle"
)

func AttestationCmd(ctx context.Context, regOpts options.RegistryOptions, signedPayloads []string, imageRef string) error {
	ociremoteOpts, err := regOpts.ClientOpts(ctx)
	if err != nil {
		return fmt.Errorf("constructing client options: %w", err)
	}

	for _, payload := range signedPayloads {
		fmt.Fprintf(os.Stderr, "Using payload from: %s", payload)

		ref, err := name.ParseReference(imageRef, regOpts.NameOptions()...)
		if err != nil {
			return err
		}
		if _, ok := ref.(name.Digest); !ok {
			ui.Warnf(ctx, ui.TagReferenceMessage, imageRef)
		}

		digest, err := ociremote.ResolveDigest(ref, ociremoteOpts...)
		if err != nil {
			return err
		}

		// Detect if we are using new bundle format
		b, err := bundle.LoadJSONFromPath(payload)
		if err == nil {
			return attachAttestationNewBundle(ociremoteOpts, b, digest)
		}

		if err := attachAttestation(ociremoteOpts, payload, digest); err != nil {
			return fmt.Errorf("attaching payload from %s: %w", payload, err)
		}
	}

	return nil
}

func attachAttestationNewBundle(remoteOpts []ociremote.Option, b *bundle.Bundle, digest name.Digest) error {
	envelope, err := b.Envelope()
	if err != nil {
		return err
	}
	if envelope == nil {
		return fmt.Errorf("bundle does not have DSSE envelope")
	}
	statement, err := envelope.Statement()
	if err != nil {
		return err
	}
	if statement == nil {
		return fmt.Errorf("unable to understand bundle envelope statement")
	}
	bundleBytes, err := b.MarshalJSON()
	if err != nil {
		return err
	}
	return ociremote.WriteAttestationNewBundleFormat(digest, bundleBytes, statement.PredicateType, remoteOpts...)
}

func attachAttestation(remoteOpts []ociremote.Option, signedPayload string, digest name.Digest) error {
	attestationFile, err := os.Open(signedPayload)
	if err != nil {
		return err
	}
	defer attestationFile.Close()

	env := ssldsse.Envelope{}
	decoder := json.NewDecoder(attestationFile)
	for decoder.More() {
		if err := decoder.Decode(&env); err != nil {
			return err
		}

		payload, err := json.Marshal(env)
		if err != nil {
			return err
		}

		if env.PayloadType != types.IntotoPayloadType {
			return fmt.Errorf("invalid payloadType %s on envelope. Expected %s", env.PayloadType, types.IntotoPayloadType)
		}

		if len(env.Signatures) == 0 {
			return fmt.Errorf("could not attach attestation without having signatures")
		}

		opts := []static.Option{static.WithLayerMediaType(types.DssePayloadType)}
		att, err := static.NewAttestation(payload, opts...)
		if err != nil {
			return err
		}

		se, err := ociremote.SignedEntity(digest, remoteOpts...)
		if err != nil {
			return err
		}

		newSE, err := mutate.AttachAttestationToEntity(se, att)
		if err != nil {
			return err
		}

		// Publish the signatures associated with this entity
		err = ociremote.WriteAttestations(digest.Repository, newSE, remoteOpts...)
		if err != nil {
			return err
		}
	}
	return nil
}

```

### Core Architecture Module: `cmd/cosign/cli/attach/sbom.go`
```
//
// Copyright 2021 The Sigstore Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package attach

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/google/go-containerregistry/pkg/logs"
	"github.com/google/go-containerregistry/pkg/name"
	v1 "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/empty"
	"github.com/google/go-containerregistry/pkg/v1/mutate"
	"github.com/google/go-containerregistry/pkg/v1/remote"
	"github.com/google/go-containerregistry/pkg/v1/remote/transport"
	ocistatic "github.com/google/go-containerregistry/pkg/v1/static"
	ocitypes "github.com/google/go-containerregistry/pkg/v1/types"
	"github.com/sigstore/cosign/v3/cmd/cosign/cli/options"
	ociexperimental "github.com/sigstore/cosign/v3/internal/pkg/oci/remote"
	"github.com/sigstore/cosign/v3/internal/ui"
	ociremote "github.com/sigstore/cosign/v3/pkg/oci/remote"
	"github.com/sigstore/cosign/v3/pkg/oci/static"
)

func SBOMCmd(ctx context.Context, regOpts options.RegistryOptions, regExpOpts options.RegistryExperimentalOptions, sbomRef string, sbomType ocitypes.MediaType, imageRef string) error {
	if regExpOpts.RegistryReferrersMode == options.RegistryReferrersModeOCI11 {
		return sbomCmdOCIExperimental(ctx, regOpts, sbomRef, sbomType, imageRef)
	}

	ref, err := name.ParseReference(imageRef, regOpts.NameOptions()...)
	if err != nil {
		return err
	}

	b, err := sbomBytes(sbomRef)
	if err != nil {
		return err
	}

	remoteOpts, err := regOpts.ClientOpts(ctx)
	if err != nil {
		return err
	}

	dstRef, err := ociremote.SBOMTag(ref, remoteOpts...)
	if err != nil {
		return err
	}

	ui.Infof(ctx, "Uploading SBOM file for [%s] to [%s] with mediaType [%s].\n", ref.Name(), dstRef.Name(), sbomType)
	img, err := static.NewFile(b, static.WithLayerMediaType(sbomType))
	if err != nil {
		return err
	}
	return remote.Write(dstRef, img, regOpts.GetRegistryClientOpts(ctx)...)
}

func sbomCmdOCIExperimental(ctx context.Context, regOpts options.RegistryOptions, sbomRef string, sbomType ocitypes.MediaType, imageRef string) error {
	var dig name.Digest
	ref, err := name.ParseReference(imageRef, regOpts.NameOptions()...)
	if err != nil {
		return err
	}
	if digr, ok := ref.(name.Digest); ok {
		dig = digr
	} else {
		desc, err := remote.Head(ref, regOpts.GetRegistryClientOpts(ctx)...)
		if err != nil {
			return err
		}
		dig = ref.Context().Digest(desc.Digest.String())
	}

	artifactType := ociexperimental.ArtifactType("sbom")

	desc, err := remote.Head(dig, regOpts.GetRegistryClientOpts(ctx)...)
	var terr *transport.Error
	if errors.As(err, &terr) && terr.StatusCode == http.StatusNotFound {
		h, err := v1.NewHash(dig.DigestStr())
		if err != nil {
			return err
		}
		// The subject doesn't exist, attach to it as if it's an empty OCI image.
		logs.Progress.Println("subject doesn't exist, attaching to empty image")
		desc = &v1.Descriptor{
			ArtifactType: artifactType,
			MediaType:    ocitypes.OCIManifestSchema1,
			Size:         0,
			Digest:       h,
		}
	} else if err != nil {
		return err
	}

	b, err := sbomBytes(sbomRef)
	if err != nil {
		return err
	}

	empty := mutate.MediaType(
		mutate.ConfigMediaType(empty.Image, ocitypes.MediaType(artifactType)),
		ocitypes.OCIManifestSchema1)
	att, err := mutate.AppendLayers(empty, ocistatic.NewLayer(b, sbomType))
	if err != nil {
		return err
	}
	att = mutate.Subject(att, *desc).(v1.Image)
	attdig, err := att.Digest()
	if err != nil {
		return err
	}
	dstRef := ref.Context().Digest(attdig.String())

	fmt.Fprintf(os.Stderr, "Uploading SBOM file for [%s] to [%s] with config.mediaType [%s] layers[0].mediaType [%s].\n",
		ref.Name(), dstRef.String(), artifactType, sbomType)
	return remote.Write(dstRef, att, regOpts.GetRegistryClientOpts(ctx)...)
}

func sbomBytes(sbomRef string) ([]byte, error) {
	// sbomRef can be "-", a string or a file.
	switch signatureType(sbomRef) {
	case StdinSignature:
		return io.ReadAll(os.Stdin)
	case RawSignature:
		return []byte(sbomRef), nil
	case FileSignature:
		return os.ReadFile(filepath.Clean(sbomRef))
	default:
		return nil, errors.New("unknown SBOM arg type")
	}
}

```

### Core Architecture Module: `cmd/cosign/cli/attach/sig.go`
```
//
// Copyright 2021 The Sigstore Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package attach

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"

	"github.com/google/go-containerregistry/pkg/name"
	"github.com/sigstore/cosign/v3/cmd/cosign/cli/options"
	"github.com/sigstore/cosign/v3/pkg/cosign"
	"github.com/sigstore/cosign/v3/pkg/cosign/bundle"
	"github.com/sigstore/cosign/v3/pkg/oci/mutate"
	ociremote "github.com/sigstore/cosign/v3/pkg/oci/remote"
	"github.com/sigstore/cosign/v3/pkg/oci/static"
	sgbundle "github.com/sigstore/sigstore-go/pkg/bundle"
)

func SignatureCmd(ctx context.Context, regOpts options.RegistryOptions, sigRef, payloadRef, certRef, certChainRef, timeStampedSigRef, rekorBundleRef, imageRef string) error {
	ref, err := name.ParseReference(imageRef, regOpts.NameOptions()...)
	if err != nil {
		return err
	}
	ociremoteOpts, err := regOpts.ClientOpts(ctx)
	if err != nil {
		return err
	}
	digest, err := ociremote.ResolveDigest(ref, ociremoteOpts...)
	if err != nil {
		return err
	}

	// Detect if we are using new bundle format
	b, err := sgbundle.LoadJSONFromPath(payloadRef)
	if err == nil {
		return attachAttestationNewBundle(ociremoteOpts, b, digest)
	}

	var payload []byte
	if payloadRef == "" {
		payload, err = cosign.ObsoletePayload(ctx, digest, nil)
	} else {
		payload, err = os.ReadFile(filepath.Clean(payloadRef))
	}
	if err != nil {
		return err
	}

	b64SigBytes, err := signatureBytes(sigRef)
	if err != nil {
		return err
	} else if len(b64SigBytes) == 0 {
		return errors.New("empty signature")
	}

	sig, err := static.NewSignature(payload, string(b64SigBytes))
	if err != nil {
		return err
	}

	var cert []byte
	var certChain []byte
	var timeStampedSig []byte
	var rekorBundle *bundle.RekorBundle

	if certRef != "" {
		cert, err = os.ReadFile(filepath.Clean(certRef))
		if err != nil {
			return err
		}
	}

	if certChainRef != "" {
		certChain, err = os.ReadFile(filepath.Clean(certChainRef))
		if err != nil {
			return err
		}
	}

	if timeStampedSigRef != "" {
		timeStampedSig, err = os.ReadFile(filepath.Clean(timeStampedSigRef))
		if err != nil {
			return err
		}
	}
	tsBundle := bundle.TimestampToRFC3161Timestamp(timeStampedSig)

	if rekorBundleRef != "" {
		rekorBundleByte, err := os.ReadFile(filepath.Clean(rekorBundleRef))
		if err != nil {
			return err
		}

		var localCosignPayload cosign.LocalSignedPayload
		err = json.Unmarshal(rekorBundleByte, &localCosignPayload)
		if err != nil {
			return err
		}

		rekorBundle = localCosignPayload.Bundle
	}

	newSig, err := mutate.Signature(sig, mutate.WithCertChain(cert, certChain), mutate.WithRFC3161Timestamp(tsBundle), mutate.WithBundle(rekorBundle))
	if err != nil {
		return err
	}

	se, err := ociremote.SignedEntity(digest, ociremoteOpts...)
	if err != nil {
		return err
	}

	// Attach the signature to the entity.
	newSE, err := mutate.AttachSignatureToEntity(se, newSig)
	if err != nil {
		return err
	}

	// Publish the signatures associated with this entity
	return ociremote.WriteSignatures(digest.Repository, newSE, ociremoteOpts...)
}

type SignatureArgType uint8

const (
	StdinSignature SignatureArgType = iota
	RawSignature   SignatureArgType = iota
	FileSignature  SignatureArgType = iota
)

func signatureBytes(sigRef string) ([]byte, error) {
	// sigRef can be "-", a string or a file.
	var sig []byte
	var err error
	switch signatureType(sigRef) {
	case StdinSignature:
		sig, err = io.ReadAll(os.Stdin)
	case RawSignature:
		return []byte(sigRef), nil
	case FileSignature:
		sig, err = os.ReadFile(filepath.Clean(sigRef))
	default:
		return nil, errors.New("unknown signature arg type")
	}
	if err != nil {
		return nil, err
	}
	// Files and stdin commonly carry a trailing newline (e.g. from `jq -r ... >
	// file` or `echo`). Strip surrounding whitespace so it isn't stored verbatim
	// as part of the signature annotation value.
	return bytes.TrimSpace(sig), nil
}

func signatureType(sigRef string) SignatureArgType {
	if sigRef == "-" {
		return StdinSignature
	}
	return FileSignature
}

```

### Core Architecture Module: `cmd/cosign/cli/bundle.go`
```
//
// Copyright 2024 The Sigstore Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cli

import (
	"context"

	"github.com/sigstore/cosign/v3/cmd/cosign/cli/bundle"
	"github.com/sigstore/cosign/v3/cmd/cosign/cli/options"
	"github.com/spf13/cobra"
)

func Bundle() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "bundle",
		Short: "Interact with a Sigstore protobuf bundle",
		Long:  "Tools for interacting with a Sigstore protobuf bundle",
	}

	cmd.AddCommand(bundleCreate())
	cmd.AddCommand(bundleUpgrade())
	cmd.AddCommand(bundleInspect())

	return cmd
}

func bundleCreate() *cobra.Command {
	o := &options.BundleCreateOptions{}

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a Sigstore protobuf bundle",
		Long:  "Create a Sigstore protobuf bundle by supplying signed material",
		Example: `  # create a bundle from a signature and certificate
  cosign bundle create --artifact <path> --signature <sig> --certificate <cert> --out bundle.sigstore.json

  # create a bundle from an attestation
  cosign bundle create --artifact <path> --attestation <att> --out bundle.sigstore.json`,
		RunE: func(cmd *cobra.Command, _ []string) error {
			bundleCreateCmd := &bundle.CreateCmd{
				Artifact:             o.Artifact,
				AttestationPath:      o.AttestationPath,
				BundlePath:           o.BundlePath,
				CertificatePath:      o.CertificatePath,
				IgnoreTlog:           o.IgnoreTlog,
				KeyRef:               o.KeyRef,
				Out:                  o.Out,
				RekorURL:             o.RekorURL,
				RFC3161TimestampPath: o.RFC3161TimestampPath,
				SignaturePath:        o.SignaturePath,
				Sk:                   o.Sk,
				Slot:                 o.Slot,
			}

			ctx, cancel := context.WithTimeout(cmd.Context(), ro.Timeout)
			defer cancel()

			return bundleCreateCmd.Exec(ctx)
		},
	}

	o.AddFlags(cmd)
	return cmd
}

func bundleUpgrade() *cobra.Command {
	o := &options.BundleUpgradeOptions{}

	cmd := &cobra.Command{
		Use:   "upgrade <bundle>",
		Short: "Upgrade a Sigstore protobuf bundle",
		Long:  "Upgrade a Sigstore Protobuf bundle to the latest version. This command only supports standardized bundles.",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			bundleUpgradeCmd := &bundle.UpgradeCmd{
				Out:      o.Out,
				RekorURL: o.RekorURL,
			}

			ctx, cancel := context.WithTimeout(cmd.Context(), ro.Timeout)
			defer cancel()

			return bundleUpgradeCmd.Exec(ctx, args[0])
		},
	}

	o.AddFlags(cmd)
	return cmd
}

func bundleInspect() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "inspect BUNDLE",
		Short: "Inspect a Sigstore protobuf bundle",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			bundleInspectCmd := &bundle.InspectCmd{
				BundlePath: args[0],
			}

			return bundleInspectCmd.Exec()
		},
	}

	return cmd
}

```

### Core Architecture Module: `cmd/cosign/cli/bundle/bundle.go`
```
//
// Copyright 2024 The Sigstore Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package bundle

import (
	"context"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"os"

	"github.com/secure-systems-lab/go-securesystemslib/dsse"
	"github.com/sigstore/rekor/pkg/generated/client"
	"github.com/sigstore/sigstore/pkg/cryptoutils"
	"github.com/sigstore/sigstore/pkg/signature"

	"github.com/sigstore/cosign/v3/cmd/cosign/cli/options"
	"github.com/sigstore/cosign/v3/cmd/cosign/cli/rekor"
	"github.com/sigstore/cosign/v3/cmd/cosign/cli/verify"
	"github.com/sigstore/cosign/v3/pkg/cosign"
	"github.com/sigstore/cosign/v3/pkg/cosign/bundle"
	"github.com/sigstore/cosign/v3/pkg/cosign/pivkey"
	"github.com/sigstore/cosign/v3/pkg/cosign/pkcs11key"
	sigs "github.com/sigstore/cosign/v3/pkg/signature"
)

type CreateCmd struct {
	Artifact             string
	AttestationPath      string
	BundlePath           string
	CertificatePath      string
	IgnoreTlog           bool
	KeyRef               string
	Out                  string
	RekorURL             string
	RFC3161TimestampPath string
	SignaturePath        string
	Sk                   bool
	Slot                 string
}

func (c *CreateCmd) Exec(ctx context.Context) (err error) {
	if c.Artifact == "" {
		return fmt.Errorf("must supply --artifact")
	}

	// We require some signature
	if options.NOf(c.BundlePath, c.SignaturePath) == 0 {
		return fmt.Errorf("must at least supply signature via --bundle or --signature")
	}

	var cert *x509.Certificate
	var envelope dsse.Envelope
	var rekorClient *client.Rekor
	var sigBytes, signedTimestamp []byte
	var sigVerifier signature.Verifier

	if c.BundlePath != "" {
		b, err := cosign.FetchLocalSignedPayloadFromPath(c.BundlePath)
		if err != nil {
			return err
		}

		if c.IgnoreTlog && b.Bundle != nil && len(b.Bundle.SignedEntryTimestamp) > 0 {
			return fmt.Errorf("cannot ignore transparency log when the provided bundle contains a Signed Entry Timestamp")
		}

		if b.Cert != "" {
			certPEM, err := base64.StdEncoding.DecodeString(b.Cert)
			if err != nil {
				return err
			}
			certs, err := cryptoutils.UnmarshalCertificatesFromPEM(certPEM)
			if err != nil {
				return err
			}
			if len(certs) == 0 {
				return fmt.Errorf("no certs found in bundle")
			}
			cert = certs[0]
		}

		if b.Base64Signature != "" {
			// Could be a DSSE envelope or plain signature
			signature, err := base64.StdEncoding.DecodeString(b.Base64Signature)
			if err != nil {
				return err
			}

			// See if DSSE JSON unmashalling succeeds
			err = json.Unmarshal(signature, &envelope)
			if err != nil {
				// Guess that it is a plain signature
				sigBytes = signature
			}
		}
	}

	if c.SignaturePath != "" {
		signatureB64, err := os.ReadFile(c.SignaturePath)
		if err != nil {
			return err
		}

		sigBytes, err = base64.StdEncoding.DecodeString(string(signatureB64))
		if err != nil {
			return err
		}
	}

	if c.RFC3161TimestampPath != "" {
		timestampBytes, err := os.ReadFile(c.RFC3161TimestampPath)
		if err != nil {
			return err
		}

		var rfc3161Timestamp bundle.RFC3161Timestamp
		err = json.Unmarshal(timestampBytes, &rfc3161Timestamp)
		if err != nil {
			return err
		}

		signedTimestamp = rfc3161Timestamp.SignedRFC3161Timestamp
	}

	if c.CertificatePath != "" {
		certBytes, err := os.ReadFile(c.CertificatePath)
		if err != nil {
			return err
		}

		certDecoded, err := base64.StdEncoding.DecodeString(string(certBytes))
		if err != nil {
			return err
		}

		block, _ := pem.Decode(certDecoded)
		if block == nil {
			return fmt.Errorf("unable to decode provided certificate")
		}

		cert, err = x509.ParseCertificate(block.Bytes)
		if err != nil {
			return err
		}
	}

	if c.AttestationPath != "" {
		attestationBytes, err := os.ReadFile(c.AttestationPath)
		if err != nil {
			return err
		}

		err = json.Unmarshal(attestationBytes, &envelope)
		if err != nil {
			return err
		}
	}

	if c.KeyRef != "" {
		sigVerifier, err = sigs.PublicKeyFromKeyRef(ctx, c.KeyRef)
		if err != nil {
			return fmt.Errorf("loading public key: %w", err)
		}
		pkcs11Key, ok := sigVerifier.(*pkcs11key.Key)
		if ok {
			defer pkcs11Key.Close()
		}
	} else if c.Sk {
		sk, err := pivkey.GetKeyWithSlot(c.Slot)
		if err != nil {
			return fmt.Errorf("opening piv token: %w", err)
		}
		defer sk.Close()
		sigVerifier, err = sk.Verifier()
		if err != nil {
			return fmt.Errorf("loading public key from token: %w", err)
		}
	}

	if c.RekorURL != "" {
		rekorClient, err = rekor.NewClient(c.RekorURL)
		if err != nil {
			return err
		}
	}

	bundle, err := verify.AssembleNewBundle(ctx, sigBytes, signedTimestamp, &envelope, c.Artifact, cert, c.IgnoreTlog, sigVerifier, nil, rekorClient)
	if err != nil {
		return err
	}

	bundleBytes, err := bundle.MarshalJSON()
	if err != nil {
		return err
	}

	if c.Out != "" {
		err = os.WriteFile(c.Out, bundleBytes, 0600) // #nosec G703 -- user-supplied output path is intentional
		if err != nil {
			return err
		}
	} else {
		fmt.Println(string(bundleBytes))
	}

	return nil
}

```

### Core Architecture Module: `cmd/cosign/cli/bundle/upgrade.go`
```
//
// Copyright 2026 The Sigstore Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package bundle

import (
	"context"
	"crypto/x509"
	"fmt"
	"os"

	protobundle "github.com/sigstore/protobuf-specs/gen/pb-go/bundle/v1"
	rekor "github.com/sigstore/rekor/pkg/client"
	"github.com/sigstore/rekor/pkg/generated/client"
	"github.com/sigstore/rekor/pkg/generated/client/entries"
	"github.com/sigstore/rekor/pkg/tle"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/sigstore/cosign/v3/internal/ui"
)

type UpgradeCmd struct {
	Out      string
	RekorURL string
}

func (c *UpgradeCmd) Exec(ctx context.Context, bundlePath string) error {
	data, err := os.ReadFile(bundlePath)
	if err != nil {
		return fmt.Errorf("reading input file: %w", err)
	}

	rekorClient, err := rekor.GetRekorClient(c.RekorURL)
	if err != nil {
		return fmt.Errorf("creating rekor client: %w", err)
	}

	upgradedBundle, err := upgradeBundle(ctx, data, rekorClient)
	if err != nil {
		return fmt.Errorf("upgrading bundle: %w", err)
	}

	if c.Out != "" {
		err = os.WriteFile(c.Out, upgradedBundle, 0600) // #nosec G703 -- user-supplied output path is intentional
		if err != nil {
			return fmt.Errorf("writing upgraded bundle: %w", err)
		}
		ui.Infof(ctx, "Successfully upgraded bundle written to %s", c.Out)
	} else {
		fmt.Println(string(upgradedBundle))
	}

	return nil
}

func upgradeBundle(ctx context.Context, data []byte, rekorClient *client.Rekor) ([]byte, error) {
	var bundle protobundle.Bundle
	if err := protojson.Unmarshal(data, &bundle); err != nil {
		return nil, fmt.Errorf("unmarshaling bundle: %w", err)
	}

	if bundle.VerificationMaterial == nil {
		return nil, fmt.Errorf("bundle is missing verification material")
	}
	if bundle.VerificationMaterial.Content == nil {
		return nil, fmt.Errorf("bundle verification material is missing content (public key or certificate)")
	}

	switch bundle.MediaType {
	case "application/vnd.dev.sigstore.bundle.v0.3+json", "application/vnd.dev.sigstore.bundle+json;version=0.3":
		ui.Infof(ctx, "Bundle is already at v0.3, no upgrade needed.")
		return data, nil
	case "application/vnd.dev.sigstore.bundle+json;version=0.1":
		ui.Infof(ctx, "Upgrading from v0.1 to v0.3...")
	case "application/vnd.dev.sigstore.bundle+json;version=0.2":
		ui.Infof(ctx, "Upgrading from v0.2 to v0.3...")
	default:
		return nil, fmt.Errorf("unsupported bundle version: %s", bundle.MediaType)
	}

	if chainContent, ok := bundle.VerificationMaterial.Content.(*protobundle.VerificationMaterial_X509CertificateChain); ok {
		certChain := chainContent.X509CertificateChain.Certificates
		if len(certChain) > 0 {
			ui.Infof(ctx, "Truncating certificate chain to only the leaf certificate...")
			for i, cert := range certChain {
				parsedCert, err := x509.ParseCertificate(cert.RawBytes)
				if err != nil {
					ui.Infof(ctx, "  Certificate %d: <unable to parse: %v>", i, err)
					continue
				}

				var identity string
				if len(parsedCert.EmailAddresses) > 0 {
					identity = parsedCert.EmailAddresses[0]
				} else if len(parsedCert.URIs) > 0 {
					identity = parsedCert.URIs[0].String()
				} else if s := parsedCert.Subject.String(); s != "" {
					identity = s
				} else {
					identity = "<none>"
				}
				ui.Infof(ctx, "  Certificate %d Identity: %s", i, identity)
			}
			bundle.VerificationMaterial.Content = &protobundle.VerificationMaterial_Certificate{
				Certificate: certChain[0],
			}
		}
	}

	for i, entry := range bundle.VerificationMaterial.TlogEntries {
		if entry.InclusionPromise != nil && entry.InclusionProof == nil {
			ui.Infof(ctx, "Fetching missing inclusion proof from Rekor for log index %d...", entry.LogIndex)

			params := entries.NewGetLogEntryByIndexParams()
			params.SetLogIndex(entry.LogIndex)

			resp, err := rekorClient.Entries.GetLogEntryByIndexContext(ctx, params)
			if err != nil {
				return nil, fmt.Errorf("fetching log entry by index: %w", err)
			}

			if len(resp.Payload) != 1 {
				return nil, fmt.Errorf("expected exactly 1 entry from Rekor for index %d, got %d", entry.LogIndex, len(resp.Payload))
			}

			for _, e := range resp.Payload {
				protoEntry, err := tle.GenerateTransparencyLogEntry(e)
				if err != nil {
					return nil, fmt.Errorf("generating proto entry: %w", err)
				}
				bundle.VerificationMaterial.TlogEntries[i] = protoEntry
			}
		}
	}

	bundle.MediaType = "application/vnd.dev.sigstore.bundle.v0.3+json"

	out, err := protojson.Marshal(&bundle)
	if err != nil {
		return nil, fmt.Errorf("marshaling bundle: %w", err)
	}

	return out, nil
}

```

### Core Architecture Module: `cmd/cosign/cli/clean.go`
```
//
// Copyright 2021 The Sigstore Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cli

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"

	"github.com/google/go-containerregistry/pkg/name"
	"github.com/google/go-containerregistry/pkg/v1/remote"
	"github.com/google/go-containerregistry/pkg/v1/remote/transport"
	"github.com/sigstore/cosign/v3/cmd/cosign/cli/options"
	"github.com/sigstore/cosign/v3/internal/ui"
	"github.com/sigstore/cosign/v3/pkg/cosign/bundle"
	ociremote "github.com/sigstore/cosign/v3/pkg/oci/remote"
	"github.com/spf13/cobra"
)

func Clean() *cobra.Command {
	c := &options.CleanOptions{}

	cmd := &cobra.Command{
		Use:              "clean",
		Short:            "Remove all signatures from an image",
		Example:          "  cosign clean <IMAGE>",
		Args:             cobra.ExactArgs(1),
		PersistentPreRun: options.BindViper,
		RunE: func(cmd *cobra.Command, args []string) error {
			return CleanCmd(cmd.Context(), c.Registry, c.CleanType, args[0], c.Force)
		},
	}

	c.AddFlags(cmd)
	return cmd
}

func CleanCmd(ctx context.Context, regOpts options.RegistryOptions, cleanType options.CleanType, imageRef string, force bool) error {
	if !force {
		ui.Warnf(ctx, prompt(cleanType)) //nolint:govet // practically const
		if err := ui.ConfirmContinue(ctx); err != nil {
			return err
		}
	}
	ref, err := name.ParseReference(imageRef, regOpts.NameOptions()...)
	if err != nil {
		return err
	}

	remoteOpts := regOpts.GetRegistryClientOpts(ctx)
	ociRemoteOpts := ociremote.WithRemoteOptions(remoteOpts...)

	sigRef, err := ociremote.SignatureTag(ref, ociRemoteOpts)
	if err != nil {
		return err
	}

	attRef, err := ociremote.AttestationTag(ref, ociRemoteOpts)
	if err != nil {
		return err
	}

	sbomRef, err := ociremote.SBOMTag(ref, ociRemoteOpts)
	if err != nil {
		return err
	}

	referrerRefs := []name.Reference{}
	digest, ok := ref.(name.Digest)
	if !ok {
		var err error
		digest, err = ociremote.ResolveDigest(ref, ociRemoteOpts)
		if err != nil {
			return fmt.Errorf("resolving digest: %w", err)
		}
	}
	idx, err := remote.Referrers(digest, remoteOpts...)
	if err != nil {
		return err
	}
	if idx != nil {
		// Delete manifest
		imgDigest, err := idx.Digest()
		if err != nil {
			return err
		}
		referrerDigestStr := fmt.Sprintf("%s@%s", ref.Context().Name(), imgDigest.String())
		referrerDigest, err := name.NewDigest(referrerDigestStr)
		if err != nil {
			return err
		}
		referrerRefs = append(referrerRefs, referrerDigest)

		// Delete layers in the manifest
		idxManifest, err := idx.IndexManifest()
		if err != nil {
			return err
		}
		if idxManifest != nil {
			for _, manifest := range idxManifest.Manifests {
				layerDigestStr := fmt.Sprintf("%s@%s", ref.Context().Name(), manifest.Digest.String())
				layerDigest, err := name.NewDigest(layerDigestStr)
				if err != nil {
					return err
				}
				layerImage, err := remote.Image(layerDigest, remoteOpts...)
				if err != nil {
					return err
				}
				layerManifest, err := layerImage.Manifest()
				if err != nil {
					return err
				}
				if layerManifest != nil {
					if layerManifest.Config.ArtifactType == bundle.BundleV03MediaType {
						referrerRefs = append(referrerRefs, layerDigest)
					}
				}
			}
		}
	}

	var cleanTags []name.Reference
	switch cleanType {
	case options.CleanTypeSignature:
		cleanTags = []name.Reference{sigRef}
		if len(referrerRefs) > 0 {
			ui.Warnf(ctx, "image has referrers, consider using --type referrer")
		}
	case options.CleanTypeSbom:
		cleanTags = []name.Reference{sbomRef}
	case options.CleanTypeAttestation:
		cleanTags = []name.Reference{attRef}
		if len(referrerRefs) > 0 {
			ui.Warnf(ctx, "image has referrers, consider using --type referrer")
		}
	case options.CleanTypeReferrer:
		cleanTags = referrerRefs
	case options.CleanTypeAll:
		cleanTags = append([]name.Reference{sigRef, attRef, sbomRef}, referrerRefs...)
	default:
		return errors.New("invalid CleanType value")
	}

	for _, t := range cleanTags {
		if err := remote.Delete(t, remoteOpts...); err != nil {
			var te *transport.Error
			switch {
			case errors.As(err, &te) && te.StatusCode == http.StatusNotFound:
				// If the tag doesn't exist, some registries may
				// respond with a 404, which shouldn't be considered an
				// error.
			case errors.As(err, &te) && te.StatusCode == http.StatusBadRequest:
				// Docker registry >=v2.3 requires does not allow deleting the OCI object name directly, must use the digest instead.
				// See https://github.com/distribution/distribution/blob/main/docs/content/spec/api.md#deleting-an-image
				tTag, ok := t.(name.Tag)
				if ok {
					if err := deleteByDigest(tTag, remoteOpts...); err != nil {
						if errors.As(err, &te) && te.StatusCode == http.StatusNotFound { //nolint: revive
						} else {
							fmt.Fprintf(os.Stderr, "could not delete %s by digest from %s:\n%v\n", t, imageRef, err)
						}
					} else {
						fmt.Fprintf(os.Stderr, "Removed %s from %s\n", t, imageRef)
					}
				}
			default:
				fmt.Fprintf(os.Stderr, "could not delete %s from %s:\n%v\n", t, imageRef, err)
			}
		} else {
			fmt.Fprintf(os.Stderr, "Removed %s from %s\n", t, imageRef)
		}
	}

	return nil
}

func deleteByDigest(tag name.Tag, opts ...remote.Option) error {
	digestTag, err := ociremote.DockerContentDigest(tag, ociremote.WithRemoteOptions(opts...))
	if err != nil {
		return err
	}
	return remote.Delete(digestTag, opts...)
}

func prompt(cleanType options.CleanType) string {
	switch cleanType {
	case options.CleanTypeSignature:
		return "this will remove all signatures from the image"
	case options.CleanTypeSbom:
		return "this will remove all SBOMs from the image"
	case options.CleanTypeAttestation:
		return "this will remove all attestations from the image"
	case options.CleanTypeReferrer:
		return "this will remove all referrer attestations and/or signatures from the image"
	case options.CleanTypeAll:
		return "this will remove all signatures, SBOMs and attestations from the image"
	}
	panic("invalid CleanType value")
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5084** (2026-09-20): **Update golang.org/x/crypto to 0.55 - CVE-2026-56854**
  *Symptoms*: **Description**  go.mod contains package golang.org/x/crypto in version 0.53. Since crypto in version < 0.55 are having critical [CVE-2026-56854](https://www.strix.ai/cve/CVE-2026-56854), please update it's version to 0.55.  **Version**  3.1.3 
  **Post-Mortem & Fix Analysis**:
  > I found a PR which will resolve this issue when it's merged: https://github.com/sigstore/cosign/pull/5082
  > I'd like to work on this.
  > seems like that the issue is fixed in master, since the version for crypto in go.mod is now 0.55: https://github.com/sigstore/cosign/blob/main/go.mod#L55  What's left is a release that it can be used.

- **Issue #5063** (2026-08-18): **`verify-blob` requires deprecated `--signature-digest-algorithm` for non-SHA-256 bundled signatures**
  *Symptoms*: **Description** `cosign verify-blob` warns that `--signature-digest-algorithm` is deprecated because `--bundle` includes the digest algorithm. However, verification of a SHA-512 blob signature fails unless the deprecated flag is explicitly supplied.  The following commands can be used to reproduce the issue.  Generate the key and signature: ``` $ openssl ecparam -name secp521r1 -genkey -noout -out p521.pem $ cosign import-key-pair --key p521.pem $ cosign sign-blob --key import-cosign.key --bundle foo.txt.sig --signing-config ./signing-config.json --yes foo.txt ```  Verifying without `--signature-digest-algorithm` fails: ``` $ cosign verify-blob --key import-cosign.pub --bundle foo.txt.sig --insecure-ignore-tlog=true foo.txt WARNING: Skipping tlog verification is an insecure practice that lacks transparency and auditability verification for the blob. Error: failed to verify signature: could not verify message: invalid signature when validating ASN.1 encoded signature error during command execution: failed to verify signature: could not verify message: invalid signature when validating ASN.1 encoded signature ```  Verifying with `--signature-digest-algorithm` succeeds: ``` $ cosign verify-blob --key import-cosign.pub --bundle foo.txt.sig --insecure-ignore-tlog=true --signature-digest-algorithm sha512 foo.txt Flag --signature-digest-algorithm has been deprecated, please use --bundle, which already includes the digest algorithm WARNING: Skipping tlog verification is an insecure p
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this, it should be fixed once the linked PR lands.

- **Issue #5030** (2026-09-14): **`cosign load` fails to upload v3 bundle layer blobs before manifest PUT (BLOB_UPLOAD_UNKNOWN)**
  *Symptoms*: ## Description  `cosign load` fails when loading sigstore signed bundles to a registry where the bundle layer blob does not already exist. The command uploads the image index and legacy signature successfully, then attempts to PUT the bundle manifest without first uploading the bundle layer blob. Registries that enforce blob-before-manifest ordering (e.g. AWS ECR) return `BLOB_UPLOAD_UNKNOWN`.  This breaks cross-registry image replication workflows that use `cosign save` → `cosign load` (e.g. commercial → isolated/partitioned registry, cross-account ECR, air-gapped mirrors).  ### Environment  | Component | Version | |-----------|---------| | cosign | v3.1.2 (`GitVersion`, `darwin/arm64`) | | go-containerregistry | v0.21.7 | | Registry (source) | Any OCI v2 registry with a dual-signed image | | Registry (destination) | Any OCI v2 registry where bundle layer blobs are **not** already present (fresh repo, different account/region, etc.) |  **Observed on:** AWS ECR (commercial `us-east-1` → GovCloud `us-gov-west-1`, cross-account). The destination registry **does** accept v3 bundle artifacts when layer blobs are uploaded correctly — this is not a registry limitation.  **Debug tip:** `COSIGN_DEBUG=1` produces no additional output in cosign v3. Use `-d` / `--verbose` (and optionally `--output-file`).  ### Steps to reproduce  Prerequisites: cosign v3.x, an OCI registry you can push to (source), and a second registry/repo where bundle blobs do not yet exist (destination). Any two reg
  **Post-Mortem & Fix Analysis**:
  > Picking this up. Great writeup, the repro and HTTP trace made this easy to confirm. Will dig into the load path and check whether bundle referrer layer blobs are getting skipped in the upload loop.
  > @ogulcanaydogan why not just proceed with the fix I already submitted?
  > Fair point, apologies, should have checked for an existing PR before jumping in. Closed mine (#5065) in favor of #5031, yours has the same fix plus a cross-registry e2e test I didn't think to write. Hope it gets reviewed soon, it's been sitting for a few weeks.

- **Issue #5018** (2026-10-01): **HashiCorp Vault ECDSA P-521 key fails to sign images after upgrading from Cosign v2.4.1 to v3.1.1**
  *Symptoms*: ## Description  After upgrading Cosign from v2.4.1 to v3.1.1, signing an OCI image with an existing ECDSA P-521 key stored in HashiCorp Vault Transit KMS fails with:  unexpected length of digest for hash function specified  The same Vault key and signing setup worked successfully with Cosign v2.4.1.  ### Environment Cosign version before upgrade: v2.4.1 Cosign version after upgrade: v3.1.1 KMS provider: HashiCorp Vault Transit Engine Vault key type: ecdsa-p521 Key reference: hashivault://cosign Signing mode: signing configuration supplied with --signing-config Target: OCI image referenced by digest  signing_config.json ``` {   "mediaType": "application/vnd.dev.sigstore.signingconfig.v0.2+json",   "rekorTlogConfig": {     "selector": "ANY"   },   "tsaConfig": {     "selector": "ANY"   } } ```  ### Steps to reproduce  1. Create or use an existing ECDSA P-521 key in HashiCorp Vault Transit: type: ecdsa-p521 2. Configure Cosign to access the Vault KMS key. 3. With Cosign v2.4.1, sign an image using the key. Signing succeeds. 4. Upgrade Cosign to v3.0.6. 5. Run: ``` cosign sign \   --signing-config signing_config.json \   --key hashivault://cosign \   "$IMAGE" ```  ### Actual behavior  Signing fails with the following error:  Error: signing [###/podman-signer@sha256:7e7fc7d716f85056e3685d48f4200d0b4540fb54f6d6e1cae567f5e36c76b164]: signing digest: signing bundle: error signing bundle: unexpected length of digest for hash function specified error during command execution: signing [

- **Issue #4995** (2026-07-10): **WriteSignaturesExperimentalOCI does not set top-level artifactType on signature referrer manifests**
  *Symptoms*: **Description**  When Chains (or any cosign library consumer) stores image signatures using the OCI 1.1 Referrers API via [WriteSignaturesExperimentalOCI](https://github.com/sigstore/cosign/blob/main/pkg/oci/remote/write.go#L216), the resulting referrer manifest does not have a top-level artifactType field set. Only config.mediaType is set.  This is inconsistent with how attestation referrers are written — [WriteAttestationNewBundleFormat](https://github.com/sigstore/cosign/blob/main/pkg/oci/remote/write.go#L405) (via WriteReferrer) correctly sets artifactType on the manifest. Signatures should behave the same way.  **Impact**  The OCI 1.1 spec defines artifactType as the canonical field for identifying referrer content type. Tools that filter referrers by artifactType — including cosign tree and cosign download signature — cannot find signature referrers produced by this function:  - cosign tree silently omits the signature from its output; only attestations appear - cosign download signature returns the attestation instead of the signature (related: #4573) - oras discover shows the signature as type `<unknown>` because no artifactType is set  <img width="1920" height="790" alt="Image" src="https://github.com/user-attachments/assets/270ab046-d5e7-47fc-942a-9fdfddfe613f" />  - cosign verify is unaffected because it discovers signatures by config.mediaType, not artifactType.  Sample crane manifest **MISSING** artifactType for signature  <img width="1920" height="978" alt="Imag

- **Issue #4993** (2026-10-01): **Conformance Tests Failed (production)**
  *Symptoms*: The nightly conformance tests have failed on production. Please check the logs for more details.  Workflow run: https://github.com/sigstore/cosign/actions/runs/28833695211  cc @sigstore/security-response-team @sigstore/cosign-codeowners

- **Issue #4980** (2026-07-04): **NewBundleFormat not passed to KeyOpts in sign command, breaking TSA usage**
  *Symptoms*: When using `cosign sign` with `--use-signing-config=false` and `--timestamp-server-url`, the `NewBundleFormat` flag is never copied from `SignOptions` to `KeyOpts` in `cmd/cosign/cli/sign.go`.  This causes `GetRFC3161Timestamp` in `signcommon/common.go` to always see `NewBundleFormat=false`, resulting in:      Error: expected either new bundle or an rfc3161-timestamp path when using a TSA server  The `attest` command is unaffected — it already sets `NewBundleFormat` in `KeyOpts`.

- **Issue #4973** (2026-07-05): **ghcr.io/sigstore/cosign/cosign:v3.1.1 image verification fails with no signatures found**
  *Symptoms*: ## Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      The documented container-image verification flow for the current Cosign GHCR image fails.                                                                                                                                                                                                                                                                                                                                                                                                                       Image:                                                                                                                                                                                                                                                     - `ghcr.io/sigstore/cosign/cosign:v3.1.1`                                                                                                                                                                                                                        
  **Post-Mortem & Fix Analysis**:
  > ## Graphs in the `sigstore/cosign/cosign` GHCR package  I also looked at the `sigstore/cosign/cosign` package with my [ghcr-cleanup-manager-visualizer](https://github.com/ghcr-manager/ghcr-cleanup-manager/tree/main/visualizer) and noted how the graph changed quite a lot across versions.  I am sharing the screenshots and a short how-to below because I think the graph view makes it easier to compare which artifacts are present for a given release.  ### v3.0.2  - Graph includes `sha256-<digest>.sig` tags. - Example: `sha256-3db384ac964445d8fc521d9284d7a59e2c54796870b9eaa69ea4cff7d06a4ff2.sig` is linked to the `linux/amd64` image manifest.  ### v3.0.3 - v3.0.6  - Complex graph shape with 3 multi-arch manifests. - There are no `sha256-<digest>.sig` tags for these versions.  ### v3.1.1  - Reduced graph compared to earlier versions. - There are no `sha256-<digest>.sig` tags for `v3.1.1`.  ## How-To visualize graphs in package `sigstore/cosign/cosign`  ### Scan package to get a DB for the pack
  > FYI: The new release v3.1.2 can be verified fine and the graph in GHCR looks sane:  <img width="2482" height="1409" alt="Image" src="https://github.com/user-attachments/assets/e1283282-d661-407a-8e96-2f6c73db091a" />

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

### Incident Patch 1: `e2d25b54` (2026-10-04)
**Commit Message**: Mention windows builds in readme (#5147)

Fixes #5142

**File**: `README.md` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ Click [here](https://join.slack.com/t/sigstore/shared_invite/zt-47srvpyn6-j8Ek5h
 
 For Homebrew, Arch, Nix, GitHub Action, and Kubernetes installs see the [installation docs](https://docs.sigstore.dev/cosign/system_config/installation/).
 
-For Linux and macOS binaries see the [GitHub release assets](https://github.com/sigstore/cosign/releases/latest).
+For Linux, macOS and Windows binaries, see the [GitHub release assets](https://github.com/sigstore/cosign/releases/latest).
 
 :rotating_light: If you are downloading releases of cosign from our GCS bucket - please see more information on the July 31, 2023 [deprecation notice](https://blog.sigstore.dev/cosign-releases-bucket-deprecation/) :rotating_light:
 
```

---

### Incident Patch 2: `6a83f9a2` (2026-10-02)
**Commit Message**: fix(verify): don't panic on a bundle entry with no hash (#5127)

* fix(verify): don't panic on a bundle entry with no hash

bundleHash dereferenced the algorithm and value of a Rekor entry hash
without checking them. The hash is optional in all five of these schemas,
and unmarshalling does not always populate it: a rekord v0.0.1 entry that
carries data.content but no data.hash, and an intoto v0.0.2 entry whose
envelope payload is empty, both unmarshal cleanly with a nil hash.

The body comes from the bundle attached to the signature, so it is read
from the registry before the certificate has been validated and before
the signature has been checked. A body that omits the hash therefore
crashes the verifier rather than failing verification.

Check each level before dereferencing it and return an error instead.

Signed-off-by: ashvinctrl <[REDACTED_EMAIL]>

* fix(verify): trim comments in bundleHash

Drop the hashFields doc comment and cut the bundleHash comment down to the
part that is not visible from the code: the Rekor models mark the hash fields
required, but per-type validation does not always enforce it.

Signed-off-by: ashvinctrl <[REDACTED_EMAIL]>

* test(verify): cover every

**File**: `pkg/cosign/verify.go` (modified, +26/-5)
```diff
@@ -1541,26 +1541,47 @@ func extractEntryImpl(bundleBody string) (rekor_types.EntryImpl, error) {
 	return rekor_types.UnmarshalEntry(pe)
 }
 
+func hashFields(algorithm, value *string) (string, string, error) {
+	if algorithm == nil || value == nil {
+		return "", "", errors.New("bundle entry hash is missing its algorithm or value")
+	}
+	return *algorithm, *value, nil
+}
+
 func bundleHash(bundleBody, _ string) (string, string, error) {
 	ei, err := extractEntryImpl(bundleBody)
 	if err != nil {
 		return "", "", err
 	}
 
+	// The Rekor models mark these hash fields required, but each entry type's
+	// own validation decides what is enforced, and some accept an entry that
+	// carries no hash at all.
 	switch entry := ei.(type) {
 	case *dsse_v001.V001Entry:
-		return *entry.DSSEObj.EnvelopeHash.Algorithm, *entry.DSSEObj.EnvelopeHash.Value, nil
+		if h := entry.DSSEObj.EnvelopeHash; h != nil {
+			return hashFields(h.Algorithm, h.Value)
+		}
 	case *hashedrekord_v001.V001Entry:
-		return *entry.HashedRekordObj.Data.Hash.Algorithm, *entry.HashedRekordObj.Data.Hash.Value, nil
+		if d := entry.HashedRekordObj.Data; d != nil && d.Hash != nil {
+			return hashFields(d.Hash.Algorithm, d.Hash.Value)
+		}
 	case *intoto_v001.V001Entry:
-		return *entry.IntotoObj.Content.Hash.Algorithm, *entry.IntotoObj.Content.Hash.Value, nil
+		if c := entry.IntotoObj.Content; c != nil && c.Hash != nil {
+			return hashFields(c.Hash.Algorithm, c.Hash.Value)
+		}
 	case *intoto_v002.V002Entry:
-		return *entry.IntotoObj.Content.Hash.Algorithm, *entry.IntotoObj.Content.Hash.Value, nil
+		if c := entry.IntotoObj.Content; c != nil && c.Hash != nil {
+			return hashFields(c.Hash.Algorithm, c.Hash.Value)
+		}
 	case *rekord_v001.V001Entry:
-		return *entry.RekordObj.Data.Hash.Algorithm, *entry.RekordObj.Data.Hash.Value, nil
+		if d := entry.RekordObj.Data; d != nil && d.Hash != nil {
+			return hashFields(d.Hash.Algorithm, d.Hash.Value)
+		}
 	default:
 		return "", "", errors.New("unsupported type")
 	}
+	return "", "", errors.New("no hash found in bundle entry")
 }
 
 // bundleSig extracts the signature from the rekor bundle body
```

**File**: `pkg/cosign/verify_test.go` (modified, +233/-0)
```diff
@@ -2663,3 +2663,236 @@ func getTimestampedSignature(sigBytes []byte, tsaClient *tsaMock.TSAClient) ([]b
 
 	return tsaClient.GetTimestampResponse(requestBytes)
 }
+
+func TestBundleHash(t *testing.T) {
+	sv, _, err := signature.NewECDSASignerVerifier(elliptic.P256(), rand.Reader, crypto.SHA256)
+	if err != nil {
+		t.Fatalf("creating signer: %v", err)
+	}
+	pemBytes, _ := cryptoutils.MarshalPublicKeyToPEM(sv.Public())
+	b64key := base64.StdEncoding.EncodeToString(pemBytes)
+
+	payload := []byte{1, 2, 3, 4}
+	digest := sha256.Sum256(payload)
+	value := hex.EncodeToString(digest[:])
+	sig, err := sv.SignMessage(bytes.NewReader(payload))
+	if err != nil {
+		t.Fatalf("signing: %v", err)
+	}
+	b64sig := base64.StdEncoding.EncodeToString(sig)
+	hash := fmt.Sprintf(`{"algorithm":"sha256","value":%q}`, value)
+
+	tests := []struct {
+		name string
+		body string
+	}{{
+		name: "dsse v0.0.1",
+		body: fmt.Sprintf(`{"apiVersion":"0.0.1","kind":"dsse","spec":{"envelopeHash":%s,"payloadHash":%s,"signatures":[{"signature":%q,"verifier":%q}]}}`,
+			hash, hash, b64sig, b64key),
+	}, {
+		name: "hashedrekord v0.0.1",
+		body: fmt.Sprintf(`{"apiVersion":"0.0.1","kind":"hashedrekord","spec":{"data":{"hash":%s},"signature":{"content":%q,"publicKey":{"content":%q}}}}`,
+			hash, b64sig, b64key),
+	}, {
+		name: "intoto v0.0.1",
+		body: fmt.Sprintf(`{"apiVersion":"0.0.1","kind":"intoto","spec":{"content":{"hash":%s,"payloadHash":%s},"publicKey":%q}}`,
+			hash, hash, b64key),
+	}, {
+		name: "intoto v0.0.2",
+		body: fmt.Sprintf(`{"apiVersion":"0.0.2","kind":"intoto","spec":{"content":{"envelope":{"payloadType":"application/vnd.in-toto+json","payload":"","signatures":[{"publicKey":%q,"sig":%q}]},"hash":%s}}}`,
+			b64key, b64sig, hash),
+	}, {
+		name: "rekord v0.0.1",
+		body: fmt.Sprintf(`{"apiVersion":"0.0.1","kind":"rekord","spec":{"data":{"hash":%s},"signature":{"format":"x509","content":%q,"publicKey":{"content":%q}}}}`,
+			hash, b64sig, b64key),
+	}}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			alg, val, err := bundleHash(base64.StdEncoding.EncodeToString([]byte(tt.body)), "")
+			if err != nil {
+				t.Fatalf("unexpected error: %v", err)
+			}
+			if alg != "sha256" || val != value {
+				t.Errorf("got %s:%s, want sha256:%s", alg, val, value)
+			}
+		})
+	}
+}
+
+func TestBundleHashWithMissingHash(t *testing.T) {
+	sv, _, err := signature.NewECDSASignerVerifier(elliptic.P256(), rand.Reader, crypto.SHA256)
+	if err != nil {
+		t.Fatalf("creating signer: %v", err)
+	}
+	pemBytes, _ := cryptoutils.MarshalPublicKeyToPEM(sv.Public())
+	b64key := base64.StdEncoding.EncodeToString(pemBytes)
+	value := strings.Repeat("0", 64)
+	payloadHash := fmt.Sprintf(`{"algorithm":"sha256","value":%q}`, value)
+
+	rekord := func(hash string) string {
+		return fmt.Sprintf(`{"apiVersion":"0.0.1","kind":"rekord","spec":{"data":{"content":"YQ=="%s},"signature":{"format":"x509","content":"YQ==","publicKey":{"content":%q}}}}`,
+			hash, b64key)
+	}
+	intotoV002 := func(hash string) string {
+		return fmt.Sprintf(`{"apiVersion":"0.0.2","kind":"intoto","spec":{"content":{"envelope":{"payloadType":"application/vnd.in-toto+json","payload":"","signatures":[{"publicKey":%q,"sig":"YQ=="}]}%s}}}`,
+			b64key, hash)
+	}
+
+	// Only rekord v0.0.1 and intoto v0.0.2 accept an entry with no hash, and
+	// those reach bundleHash's own check. Rekor rejects every other case
+	// before the switch is reached. A hash object missing only its algorithm
+	// or value fails Rekor's validation for every entry type, so the
+	// hashFields error is covered by TestHashFields instead.
+	tests := []struct {
+		name    string
+		body    string
+		wantErr string
+	}{{
+		name:    "rekord v0.0.1 without data.hash",
+		body:    rekord(""),
+		wantErr: "no hash found in bundle entry",
+	}, {
+		name:    "intoto v0.0.2 without content.hash",
+		body:    intotoV002(""),
+		wantErr: "no hash found in bundle entry",
+	}, {
+		name: "rekord v0.0.1 without data.hash.value",
+		body: rekord(`,"hash":{"algorithm":"sha256"}`),
+	}, {
+		name: "rekord v0.0.1 without data.hash.algorithm",
+		body: rekord(fmt.Sprintf(`,"hash":{"value":%q}`, value)),
+	}, {
+		name: "intoto v0.0.2 without content.hash.value",
+		body: intotoV002(`,"hash":{"algorithm":"sha256"}`),
+	}, {
+		name: "intoto v0.0.2 without content.hash.algorithm",
+		body: intotoV002(fmt.Sprintf(`,"hash":{"value":%q}`, value)),
+	}, {
+		name: "dsse v0.0.1 without envelopeHash",
+		body: fmt.Sprintf(`{"apiVersion":"0.0.1","kind":"dsse","spec":{"payloadHash":%s,"signatures":[{"signature":"YQ==","verifier":%q}]}}`,
+			payloadHash, b64key),
+	}, {
+		name: "hashedrekord v0.0.1 without data.hash",
+		body: fmt.Sprintf(`{"apiVersion":"0.0.1","kind":"hashedrekord","spec":{"data":{},"signature":{"content":"YQ==","publicKey":{"content":%q}}}}`,
+			b64key),
+	}, {
+		name: "intoto v0.0.1 without content.hash",
+		body: fmt.Sprintf(`{"apiVersion":"0.0.1","kind":"intoto","spec":{"content":{"payloadHash"
```

---

### Incident Patch 3: `ff2a8f4e` (2026-07-28)
**Commit Message**: fix(sign): pass digest hash algorithm to underlying signer in SignData

Fixes #5018

Motivation

Signing with a HashiCorp Vault Transit KMS ECDSA P-521 key fails with
"signing digest: signing bundle: error signing bundle: unexpected
length of digest for hash function specified". This is a regression
in the bundle-signing path introduced when SignerVerifierKeypair was
added: it correctly computes the digest using the key's own default
hash algorithm (SHA-512 for P-521), but never told the underlying
signer.SignMessage which hash algorithm that digest was produced with.

KMS-backed SignerVerifiers created via
pkg/signature/keys.go:SignerVerifierFromKeyRef are constructed with a
hardcoded crypto.SHA256 default (unrelated to the actual key's curve),
so sigstore-go's ComputeDigestForSigning fell back to that default,
saw a 64-byte digest against an expected 32-byte SHA-256 digest, and
rejected it with the mismatch error above.

Approach

internal/key/svkeypair.go: SignerVerifierKeypair.SignData now also
passes signatureoptions.WithCryptoSignerOpts(hashType) alongside
WithDigest(digest), so the signer is told exactly which hash algorithm
produced the digest, regardless of what hash it wa

**File**: `internal/key/svkeypair.go` (modified, +1/-1)
```diff
@@ -133,7 +133,7 @@ func (k *SignerVerifierKeypair) SignData(ctx context.Context, data []byte) ([]by
 		h := hashType.New()
 		h.Write(data)
 		digest = h.Sum(nil)
-		sOpts = append(sOpts, signatureoptions.WithDigest(digest))
+		sOpts = append(sOpts, signatureoptions.WithDigest(digest), signatureoptions.WithCryptoSignerOpts(hashType))
 	}
 
 	sig, err := k.sv.SignMessage(bytes.NewReader(data), sOpts...)
```

**File**: `internal/key/svkeypair_test.go` (modified, +42/-4)
```diff
@@ -38,9 +38,10 @@ import (
 
 // mockSignerVerifier is a mock implementation of signature.SignerVerifier for testing.
 type mockSignerVerifier struct {
-	pubKey    crypto.PublicKey
-	pubKeyErr error
-	signErr   error
+	pubKey     crypto.PublicKey
+	pubKeyErr  error
+	signErr    error
+	signerOpts crypto.SignerOpts
 }
 
 func (m *mockSignerVerifier) PublicKey(_ ...signature.PublicKeyOption) (crypto.PublicKey, error) {
@@ -50,10 +51,15 @@ func (m *mockSignerVerifier) PublicKey(_ ...signature.PublicKeyOption) (crypto.P
 	return m.pubKey, nil
 }
 
-func (m *mockSignerVerifier) SignMessage(_ io.Reader, _ ...signature.SignOption) ([]byte, error) {
+func (m *mockSignerVerifier) SignMessage(_ io.Reader, opts ...signature.SignOption) ([]byte, error) {
 	if m.signErr != nil {
 		return nil, m.signErr
 	}
+	var signerOpts crypto.SignerOpts
+	for _, opt := range opts {
+		opt.ApplyCryptoSignerOpts(&signerOpts)
+	}
+	m.signerOpts = signerOpts
 	return []byte("mock-signature"), nil
 }
 
@@ -220,6 +226,9 @@ func TestKMSKeypair_ECDSA_Methods(t *testing.T) {
 		if !bytes.Equal(digest, expectedDigest) {
 			t.Errorf("expected digest %x, got %x", expectedDigest, digest)
 		}
+		if sv.signerOpts == nil || sv.signerOpts.HashFunc() != crypto.SHA256 {
+			t.Errorf("expected underlying signer to be given crypto.SHA256 opts, got %v", sv.signerOpts)
+		}
 	})
 
 	t.Run("SignData with error", func(t *testing.T) {
@@ -241,6 +250,35 @@ func TestKMSKeypair_ECDSA_Methods(t *testing.T) {
 	})
 }
 
+// TestKMSKeypair_ECDSA_P521_SignData exercises the P-521 case reported in
+// https://github.com/sigstore/cosign/issues/5018, where a SHA-512 digest was
+// signed against a signer configured for SHA-256, producing a digest/hash
+// length mismatch for KMS providers (e.g. HashiCorp Vault) that validate the
+// crypto.SignerOpts passed alongside the digest.
+func TestKMSKeypair_ECDSA_P521_SignData(t *testing.T) {
+	ecdsaPriv, err := ecdsa.GenerateKey(elliptic.P521(), rand.Reader)
+	if err != nil {
+		t.Fatalf("failed to generate ecdsa key: %v", err)
+	}
+	sv := &mockSignerVerifier{pubKey: &ecdsaPriv.PublicKey}
+	kp, err := NewSignerVerifierKeypair(sv, nil)
+	if err != nil {
+		t.Fatalf("failed to create KMSKeypair: %v", err)
+	}
+
+	data := []byte("some data to sign")
+	_, digest, err := kp.SignData(context.Background(), data)
+	if err != nil {
+		t.Fatalf("SignData returned an error: %v", err)
+	}
+	if len(digest) != crypto.SHA512.Size() {
+		t.Errorf("expected a SHA-512 digest of length %d, got %d", crypto.SHA512.Size(), len(digest))
+	}
+	if sv.signerOpts == nil || sv.signerOpts.HashFunc() != crypto.SHA512 {
+		t.Errorf("expected underlying signer to be given crypto.SHA512 opts matching the digest, got %v", sv.signerOpts)
+	}
+}
+
 func TestKMSKeypair_ED25519_Methods(t *testing.T) {
 	_, ed25519Priv, err := ed25519.GenerateKey(rand.Reader)
 	if err != nil {
```

---

### Incident Patch 4: `7757e8b3` (2026-09-22)
**Commit Message**: fix(e2e): enable UseSignedTimestamps in *TSAMTLSWithSigningConfig

Signed-off-by: Aaron Lew <[REDACTED_EMAIL]>

**File**: `test/e2e_tsa_test.go` (modified, +13/-7)
```diff
@@ -213,16 +213,21 @@ func TestSignBlobTSAMTLSWithSigningConfig(t *testing.T) {
 	_, err = sign.SignBlobCmd(t.Context(), ro, signingKO, blobPath, "", "", true, "", "", false)
 	must(err, t)
 
+	trBytes, err := trustedRoot.MarshalJSON()
+	must(err, t)
+	trustedRootFile := mkfile(string(trBytes), td, t)
+
 	verifyKO := options.KeyOpts{
 		KeyRef:          pubKey,
 		BundlePath:      bundlePath,
-		TrustedMaterial: trustedRoot,
 		NewBundleFormat: true,
 	}
 
 	verifyCmd := cliverify.VerifyBlobCmd{
-		KeyOpts:    verifyKO,
-		IgnoreTlog: true,
+		KeyOpts:             verifyKO,
+		IgnoreTlog:          true,
+		UseSignedTimestamps: true,
+		TrustedRootPath:     trustedRootFile,
 	}
 	must(verifyCmd.Exec(context.Background(), blobPath), t)
 }
@@ -338,10 +343,11 @@ func TestTSAMTLSWithSigningConfig(t *testing.T) {
 	trustedRootFile := mkfile(string(trBytes), td, t)
 
 	verifyCmd := cliverify.VerifyCommand{
-		IgnoreTlog:      true,
-		IgnoreSCT:       true,
-		CheckClaims:     true,
-		NewBundleFormat: true,
+		IgnoreTlog:          true,
+		IgnoreSCT:           true,
+		CheckClaims:         true,
+		NewBundleFormat:     true,
+		UseSignedTimestamps: true,
 		CommonVerifyOptions: options.CommonVerifyOptions{
 			TrustedRootPath: trustedRootFile,
 		},
```

---

### Incident Patch 5: `907c3d89` (2026-09-23)
**Commit Message**: fix(sign): propagate BundlePath from SignOptions to KeyOpts

Signed-off-by: Aaron Lew <[REDACTED_EMAIL]>

**File**: `cmd/cosign/cli/sign.go` (modified, +1/-0)
```diff
@@ -132,6 +132,7 @@ race conditions or (worse) malicious tampering.
 				OIDCRedirectURL:                o.OIDC.RedirectURL,
 				OIDCDisableProviders:           o.OIDC.DisableAmbientProviders,
 				OIDCProvider:                   o.OIDC.Provider,
+				BundlePath:                     o.BundlePath,
 				SkipConfirmation:               o.SkipConfirmation,
 				TSAClientCACert:                o.TSAClientCACert,
 				TSAClientCert:                  o.TSAClientCert,
```

**File**: `test/e2e_test.go` (modified, +36/-0)
```diff
@@ -5499,7 +5499,43 @@ func TestSignVerifyUploadFalse(t *testing.T) {
 	must(cli.TreeCmd(ctx, regOpts, regExpOpts, true, imgName, &out), t)
 	assert.Contains(t, out.String(), fmt.Sprintf("Signatures for an image tag: %s:%s-%s.sig", name, desc.Digest.Algorithm, desc.Digest.Hex))
 
+	// Try on a new image with legacy bundle format
+	imgName = path.Join(repo, "cosign-e2e-no-upload-legacy-bundle")
+	nameLegacy, descLegacy, cleanupLegacy := mkimage(t, imgName)
+	defer cleanupLegacy()
+
+	// There should be no signatures yet
+	out.Reset()
+	must(cli.TreeCmd(ctx, regOpts, regExpOpts, true, imgName, &out), t)
+	assert.Contains(t, out.String(), "No Supply Chain Security Related Artifacts found for image")
+
+	// Now sign the image with Upload: false
+	legacyBundlePath := path.Join(td, "legacy-output.bundle")
+	ko.BundlePath = legacyBundlePath
+	so.Upload = false
+	must(sign.SignCmd(t.Context(), ro, ko, so, []string{imgName}), t)
+	assert.FileExists(t, legacyBundlePath)
+
+	// There should still be no signatures
+	out.Reset()
+	must(cli.TreeCmd(ctx, regOpts, regExpOpts, true, imgName, &out), t)
+	assert.Contains(t, out.String(), "No Supply Chain Security Related Artifacts found for image")
+
+	// Now with Upload: true
+	so.Upload = true
+	must(sign.SignCmd(t.Context(), ro, ko, so, []string{imgName}), t)
+
+	// Now there should be signatures
+	out.Reset()
+	must(cli.TreeCmd(ctx, regOpts, regExpOpts, true, imgName, &out), t)
+	assert.Contains(t, out.String(), fmt.Sprintf("Signatures for an image tag: %s:%s-%s.sig", nameLegacy, descLegacy.Digest.Algorithm, descLegacy.Digest.Hex))
+	assert.FileExists(t, legacyBundlePath)
+	fLegacy, err := os.Open(legacyBundlePath)
+	must(err, t)
+	defer fLegacy.Close()
+
 	// Try on a new image with new bundle format
+	ko.BundlePath = ""
 	imgName = path.Join(repo, "cosign-e2e-no-upload-bundle")
 	name2, _, cleanup2 := mkimage(t, imgName)
 	defer cleanup2()
```

---

### Incident Patch 6: `67a1216d` (2026-09-18)
**Commit Message**: fix: write referrers when image index has attestations (#5111)

Signed-off-by: Aaron Lew <[REDACTED_EMAIL]>

**File**: `pkg/oci/remote/write.go` (modified, +4/-2)
```diff
@@ -91,9 +91,11 @@ func WriteSignedImageIndexImages(ref name.Reference, sii oci.SignedImageIndex, d
 	if atts != nil { // will be nil if there are no associated attestations
 		attsTag, err := AttestationTag(ref, opts...)
 		if err != nil {
-			return fmt.Errorf("sigs tag: %w", err)
+			return fmt.Errorf("atts tag: %w", err)
+		}
+		if err := remoteWrite(attsTag, atts, o.ROpt...); err != nil {
+			return err
 		}
-		return remoteWrite(attsTag, atts, o.ROpt...)
 	}
 
 	// Look for any referring artifacts
```

**File**: `test/e2e_test.go` (modified, +79/-60)
```diff
@@ -4345,75 +4345,94 @@ func TestSaveLoadAttestation(t *testing.T) {
 		t.Fatal(err)
 	}
 
-	repo, stop := reg(t)
-	defer stop()
+	tests := []struct {
+		description     string
+		getSignedEntity func(t *testing.T, n string) (name.Reference, *remote.Descriptor, func())
+	}{
+		{
+			description:     "save and load an image with attestation",
+			getSignedEntity: mkimage,
+		},
+		{
+			description:     "save and load an image index with attestation",
+			getSignedEntity: mkimageindex,
+		},
+	}
 
-	imgName := path.Join(repo, "save-load")
+	for i, test := range tests {
+		t.Run(test.description, func(t *testing.T) {
+			repo, stop := reg(t)
+			defer stop()
 
-	_, _, cleanup := mkimage(t, imgName)
-	defer cleanup()
+			imgName := path.Join(repo, fmt.Sprintf("save-load-att-%d", i))
 
-	_, privKeyPath, pubKeyPath := keypair(t, td)
+			_, _, cleanup := test.getSignedEntity(t, imgName)
+			defer cleanup()
 
-	ctx := context.Background()
-	// Now sign the image and verify it
-	ko := options.KeyOpts{
-		KeyRef:           privKeyPath,
-		PassFunc:         passFunc,
-		RekorURL:         rekorURL,
-		SkipConfirmation: true,
-	}
-	so := options.SignOptions{
-		Upload:     true,
-		TlogUpload: true,
-	}
-	must(sign.SignCmd(ctx, ro, ko, so, []string{imgName}), t)
-	must(verify(pubKeyPath, imgName, true, nil, "", false), t)
+			keysDir := t.TempDir()
+			_, privKeyPath, pubKeyPath := keypair(t, keysDir)
 
-	// now, append an attestation to the image
-	slsaAttestation := `{ "buildType": "x", "builder": { "id": "2" }, "recipe": {} }`
-	slsaAttestationPath := filepath.Join(td, "attestation.slsa.json")
-	if err := os.WriteFile(slsaAttestationPath, []byte(slsaAttestation), 0o600); err != nil {
-		t.Fatal(err)
-	}
+			ctx := context.Background()
+			// Now sign the image and verify it
+			ko := options.KeyOpts{
+				KeyRef:           privKeyPath,
+				PassFunc:         passFunc,
+				RekorURL:         rekorURL,
+				SkipConfirmation: true,
+			}
+			so := options.SignOptions{
+				Upload:     true,
+				TlogUpload: true,
+			}
+			must(sign.SignCmd(ctx, ro, ko, so, []string{imgName}), t)
+			must(verify(pubKeyPath, imgName, true, nil, "", false), t)
 
-	// Now attest the image
-	ko = options.KeyOpts{KeyRef: privKeyPath, PassFunc: passFunc}
-	attestCommand := attest.AttestCommand{
-		KeyOpts:        ko,
-		PredicatePath:  slsaAttestationPath,
-		PredicateType:  "slsaprovenance",
-		Timeout:        30 * time.Second,
-		RekorEntryType: "dsse",
-	}
-	must(attestCommand.Exec(ctx, imgName), t)
+			// now, append an attestation to the image
+			slsaAttestation := `{ "buildType": "x", "builder": { "id": "2" }, "recipe": {} }`
+			slsaAttestationPath := filepath.Join(keysDir, "attestation.slsa.json")
+			if err := os.WriteFile(slsaAttestationPath, []byte(slsaAttestation), 0o600); err != nil {
+				t.Fatal(err)
+			}
 
-	// save the image to a temp dir
-	imageDir := t.TempDir()
-	must(cli.SaveCmd(ctx, options.SaveOptions{Directory: imageDir}, imgName), t)
+			// Now attest the image
+			ko = options.KeyOpts{KeyRef: privKeyPath, PassFunc: passFunc}
+			attestCommand := attest.AttestCommand{
+				KeyOpts:        ko,
+				PredicatePath:  slsaAttestationPath,
+				PredicateType:  "slsaprovenance",
+				Timeout:        30 * time.Second,
+				RekorEntryType: "dsse",
+			}
+			must(attestCommand.Exec(ctx, imgName), t)
 
-	// load the image from the temp dir into a new image and verify the new image
-	imgName2 := path.Join(repo, "save-load-2")
-	must(cli.LoadCmd(ctx, options.LoadOptions{Directory: imageDir}, imgName2), t)
-	must(verify(pubKeyPath, imgName2, true, nil, "", false), t)
-	// Use cue to verify attestation on the new image
-	policyPath := filepath.Join(td, "policy.cue")
-	verifyAttestation := cliverify.VerifyAttestationCommand{
-		KeyRef:     pubKeyPath,
-		IgnoreTlog: true,
-		MaxWorkers: 10,
-	}
-	verifyAttestation.PredicateType = "slsaprovenance"
-	verifyAttestation.Policies = []string{policyPath}
-	// Success case (remote)
-	cuePolicy := `predicate: builder: id: "2"`
-	if err := os.WriteFile(policyPath, []byte(cuePolicy), 0o600); err != nil {
-		t.Fatal(err)
+			// save the image to a temp dir
+			imageDir := t.TempDir()
+			must(cli.SaveCmd(ctx, options.SaveOptions{Directory: imageDir}, imgName), t)
+
+			// load the image from the temp dir into a new image and verify the new image
+			imgName2 := path.Join(repo, fmt.Sprintf("save-load-att-%d-2", i))
+			must(cli.LoadCmd(ctx, options.LoadOptions{Directory: imageDir}, imgName2), t)
+			must(verify(pubKeyPath, imgName2, true, nil, "", false), t)
+			// Use cue to verify attestation on the new image
+			policyPath := filepath.Join(keysDir, "policy.cue")
+			verifyAttestation := cliverify.VerifyAttestationCommand{
+				KeyRef:     pubKeyPath,
+				IgnoreTlog: true,
+				MaxWorkers: 10,
+			}
+			verifyAttestation.PredicateType = "slsaprovenance"
+			verifyAttestation.Policies = []string{policyPath}
+			// Success case (remote)
+			cuePolicy := `predicate: builder: id: "2"`
+			if er
```

---

### Incident Patch 7: `ac3a9273` (2026-09-18)
**Commit Message**: fix(verify): enforce mutually exclusive key and security key (#5124)

Signed-off-by: Aaron Lew <[REDACTED_EMAIL]>

**File**: `cmd/cosign/cli/verify/verify.go` (modified, +5/-0)
```diff
@@ -104,6 +104,11 @@ func (c *VerifyCommand) Exec(ctx context.Context, images []string) (err error) {
 		return &options.KeyAndIdentityParseError{}
 	}
 
+	// key and security key are mutually exclusive
+	if options.NOf(c.KeyRef, c.Sk) > 1 {
+		return &options.PubKeyParseError{}
+	}
+
 	var identities []cosign.Identity
 	if c.KeyRef == "" && !c.Sk {
 		identities, err = c.Identities()
```

**File**: `cmd/cosign/cli/verify/verify_test.go` (modified, +8/-0)
```diff
@@ -307,6 +307,14 @@ func TestVerifyMutuallyExclusiveFlags(t *testing.T) {
 			},
 			expectedError: &options.KeyAndIdentityParseError{},
 		},
+		{
+			name: "both key and security key",
+			cmd: VerifyCommand{
+				KeyRef: "key.pub",
+				Sk:     true,
+			},
+			expectedError: &options.PubKeyParseError{},
+		},
 	}
 
 	for _, tt := range tts {
```

---

### Incident Patch 8: `e9a91ea1` (2026-09-15)
**Commit Message**: update builder images to use go1.27.1 (#5107)

Signed-off-by: Carlos Panato <[REDACTED_EMAIL]>

**File**: `.github/workflows/validate-release.yml` (modified, +4/-4)
```diff
@@ -31,14 +31,14 @@ jobs:
       contents: read
 
     container:
-      image: ghcr.io/sigstore/cosign/cosign:v3.1.1-dev@sha256:0dcd21d8b6464a526e3225f44c50f34687e861dcf010f566b3caa4f0e5cd898a
+      image: ghcr.io/sigstore/cosign/cosign:v3.1.3-dev@sha256:3b1a2e2742351ab440255626f079a337e6c263249644800a52f5eaa389a5b730
 
     steps:
       - name: Check Signature
         run: |
-          cosign verify ghcr.io/gythialy/golang-cross:v1.26.4-0@sha256:638b15f32291895696ec579e36cbf37ee186374f828e4a211072558b816c3c7e \
+          cosign verify ghcr.io/gythialy/golang-cross:v1.27.1-1@sha256:b288b491c96203db38192b24e25f5769e8e2a6618ebaa44ec0e269e74a94447d \
           --certificate-oidc-issuer https://token.actions.githubusercontent.com \
-          --certificate-identity "https://github.com/gythialy/golang-cross/.github/workflows/release-golang-cross.yml@refs/tags/v1.26.4-0"
+          --certificate-identity "https://github.com/gythialy/golang-cross/.github/workflows/builder.yml@refs/tags/v1.27.1-1"
         env:
           TUF_ROOT: /tmp
 
@@ -51,7 +51,7 @@ jobs:
       contents: read
 
     container:
-      image: ghcr.io/gythialy/golang-cross:v1.26.4-0@sha256:638b15f32291895696ec579e36cbf37ee186374f828e4a211072558b816c3c7e
+      image: ghcr.io/gythialy/golang-cross:v1.27.1-1@sha256:b288b491c96203db38192b24e25f5769e8e2a6618ebaa44ec0e269e74a94447d
       volumes:
         - /usr:/host_usr
         - /opt:/host_opt
```

**File**: `.goreleaser.yml` (modified, +37/-7)
```diff
@@ -64,6 +64,16 @@ builds:
         - apt-get update
         - apt-get -y install --no-install-recommends libpcsclite-dev
     env:
+      - CC=zig cc -target x86_64-linux-gnu.2.34
+      - CXX=zig c++ -target x86_64-linux-gnu.2.34
+      # -idirafter: zig cc does not search /usr/include, but libpcsclite's headers
+      # are included as <PCSC/winscard.h> so the parent dir must be on the path.
+      # It must come *after* zig's own headers, otherwise Debian's glibc headers
+      # shadow zig's and conflict when building runtime/cgo.
+      # -fno-sanitize=undefined: zig cc enables UBSan by default, but its runtime
+      # is not linked in, leaving __ubsan_handle_* undefined at link time.
+      - CGO_CFLAGS=-idirafter /usr/include -fno-sanitize=undefined
+      - CGO_LDFLAGS=-L/usr/lib/x86_64-linux-gnu
       - PKG_CONFIG_PATH=/usr/lib/x86_64-linux-gnu/pkgconfig/
 
   - id: linux-pivkey-pkcs11key-arm64
@@ -88,15 +98,24 @@ builds:
         - apt-get update
         - apt-get install -y --no-install-recommends libpcsclite-dev:arm64
     env:
-      - CC=aarch64-linux-gnu-gcc
+      - CC=zig cc -target aarch64-linux-gnu.2.34
+      - CXX=zig c++ -target aarch64-linux-gnu.2.34
+      # See the notes on the amd64 build above for why these flags are needed.
+      - CGO_CFLAGS=-idirafter /usr/include -fno-sanitize=undefined
+      - CGO_LDFLAGS=-L/usr/lib/aarch64-linux-gnu
       - PKG_CONFIG_PATH=/usr/lib/aarch64-linux-gnu/pkgconfig/
 
   - id: darwin-amd64
     binary: cosign-darwin-amd64
     no_unique_dist_dir: true
     env:
-      - CC=o64-clang
-      - CXX=o64-clang++
+      - CC=zig cc -target x86_64-macos
+      - CXX=zig c++ -target x86_64-macos
+      # zig does not auto-attach the macOS SDK, so point it at the one the image
+      # ships. -isystem/-iframework (rather than -I/-F) mark the SDK as system
+      # headers, which suppresses warnings zig cc otherwise promotes to errors.
+      - CGO_CFLAGS=-isysroot {{ .Env.OSX_SDK_PATH }} -isystem {{ .Env.OSX_SDK_PATH }}/usr/include -iframework {{ .Env.OSX_SDK_PATH }}/System/Library/Frameworks -mmacosx-version-min=11.0
+      - CGO_LDFLAGS=-isysroot {{ .Env.OSX_SDK_PATH }} -L{{ .Env.OSX_SDK_PATH }}/usr/lib -F{{ .Env.OSX_SDK_PATH }}/System/Library/Frameworks
     main: ./cmd/cosign
     flags:
       - -trimpath
@@ -106,6 +125,9 @@ builds:
     goarch:
       - amd64
     ldflags:
+      # -s -w skips dsymutil, which is not shipped in the zig builder image
+      - -s
+      - -w
       - "{{ .Env.LDFLAGS }}"
     tags:
       - pivkey
@@ -115,8 +137,13 @@ builds:
     binary: cosign-darwin-arm64
     no_unique_dist_dir: true
     env:
-      - CC=aarch64-apple-darwin23-clang
-      - CXX=aarch64-apple-darwin23-clang++
+      - CC=zig cc -target aarch64-macos
+      - CXX=zig c++ -target aarch64-macos
+      # zig does not auto-attach the macOS SDK, so point it at the one the image
+      # ships. -isystem/-iframework (rather than -I/-F) mark the SDK as system
+      # headers, which suppresses warnings zig cc otherwise promotes to errors.
+      - CGO_CFLAGS=-isysroot {{ .Env.OSX_SDK_PATH }} -isystem {{ .Env.OSX_SDK_PATH }}/usr/include -iframework {{ .Env.OSX_SDK_PATH }}/System/Library/Frameworks -mmacosx-version-min=11.0
+      - CGO_LDFLAGS=-isysroot {{ .Env.OSX_SDK_PATH }} -L{{ .Env.OSX_SDK_PATH }}/usr/lib -F{{ .Env.OSX_SDK_PATH }}/System/Library/Frameworks
     main: ./cmd/cosign
     flags:
       - -trimpath
@@ -128,14 +155,17 @@ builds:
       - pivkey
       - pkcs11key
     ldflags:
+      # -s -w skips dsymutil, which is not shipped in the zig builder image
+      - -s
+      - -w
       - "{{.Env.LDFLAGS}}"
 
   - id: windows-amd64
     binary: cosign-windows-amd64
     no_unique_dist_dir: true
     env:
-      - CC=x86_64-w64-mingw32-gcc
-      - CXX=x86_64-w64-mingw32-g++
+      - CC=zig cc -target x86_64-windows-gnu
+      - CXX=zig c++ -target x86_64-windows-gnu
     main: ./cmd/cosign
     mod_timestamp: '{{ .CommitTimestamp }}'
     flags:
```

**File**: `release/cloudbuild.yaml` (modified, +5/-5)
```diff
@@ -32,19 +32,19 @@ steps:
         echo "Checking out ${_GIT_TAG}"
         git checkout ${_GIT_TAG}
 
-  - name: 'ghcr.io/sigstore/cosign/cosign:v3.1.1-dev@sha256:0dcd21d8b6464a526e3225f44c50f34687e861dcf010f566b3caa4f0e5cd898a'
+  - name: 'ghcr.io/sigstore/cosign/cosign:v3.1.3-dev@sha256:3b1a2e2742351ab440255626f079a337e6c263249644800a52f5eaa389a5b730'
     dir: "go/src/sigstore/cosign"
     env:
       - TUF_ROOT=/tmp
     args:
       - 'verify'
-      - 'ghcr.io/gythialy/golang-cross:v1.26.4-0@sha256:638b15f32291895696ec579e36cbf37ee186374f828e4a211072558b816c3c7e'
+      - 'ghcr.io/gythialy/golang-cross:v1.27.1-1@sha256:b288b491c96203db38192b24e25f5769e8e2a6618ebaa44ec0e269e74a94447d'
       - '--certificate-oidc-issuer'
       - "https://token.actions.githubusercontent.com"
       - '--certificate-identity'
-      - "https://github.com/gythialy/golang-cross/.github/workflows/release-golang-cross.yml@refs/tags/v1.26.4-0"
+      - "https://github.com/gythialy/golang-cross/.github/workflows/builder.yml@refs/tags/v1.27.1-1"
   # maybe we can build our own image and use that to be more in a safe side
-  - name: ghcr.io/gythialy/golang-cross:v1.26.4-0@sha256:638b15f32291895696ec579e36cbf37ee186374f828e4a211072558b816c3c7e
+  - name: ghcr.io/gythialy/golang-cross:v1.27.1-1@sha256:b288b491c96203db38192b24e25f5769e8e2a6618ebaa44ec0e269e74a94447d
     entrypoint: /bin/sh
     dir: "go/src/sigstore/cosign"
     env:
@@ -67,7 +67,7 @@ steps:
         gcloud auth configure-docker \
         && make release
 
-  - name: ghcr.io/gythialy/golang-cross:v1.26.4-0@sha256:638b15f32291895696ec579e36cbf37ee186374f828e4a211072558b816c3c7e
+  - name: ghcr.io/gythialy/golang-cross:v1.27.1-1@sha256:b288b491c96203db38192b24e25f5769e8e2a6618ebaa44ec0e269e74a94447d
     entrypoint: 'bash'
     dir: "go/src/sigstore/cosign"
     env:
```

---

### Incident Patch 9: `43d83e84` (2026-09-14)
**Commit Message**: fix(layout): preserve manifest artifactType in index.json when saving (#4821)

When cosign save writes an OCI artifact to disk, partial.Descriptor falls
back to config.mediaType as the artifactType in the index.json descriptor
because go-containerregistry's v1.Manifest struct does not expose the
manifest-level artifactType field. The result is that config.mediaType
appears as the artifactType entry in index.json instead of the correct
manifest artifactType, violating the OCI Image Layout spec.

Fix appendImage to parse the raw manifest JSON and override the descriptor's
ArtifactType field when a top-level artifactType is present. The existing
config.mediaType fallback still applies when artifactType is absent.

Fixes #4694

Signed-off-by: Ali <[REDACTED_EMAIL]>

**File**: `pkg/oci/layout/write.go` (modified, +23/-3)
```diff
@@ -16,11 +16,13 @@
 package layout
 
 import (
+	"encoding/json"
 	"fmt"
 
 	v1 "github.com/google/go-containerregistry/pkg/v1"
 	"github.com/google/go-containerregistry/pkg/v1/empty"
 	"github.com/google/go-containerregistry/pkg/v1/layout"
+	"github.com/google/go-containerregistry/pkg/v1/partial"
 	"github.com/sigstore/cosign/v3/pkg/oci"
 )
 
@@ -87,7 +89,25 @@ func isEmpty(s oci.Signatures) bool {
 }
 
 func appendImage(path layout.Path, img v1.Image, annotation string) error {
-	return path.AppendImage(img, layout.WithAnnotations(
-		map[string]string{kindAnnotation: annotation},
-	))
+	if err := path.WriteImage(img); err != nil {
+		return err
+	}
+	desc, err := partial.Descriptor(img)
+	if err != nil {
+		return err
+	}
+	// partial.Descriptor falls back to config.mediaType for the ArtifactType
+	// field because go-containerregistry's v1.Manifest struct does not expose
+	// the OCI manifest-level artifactType. Parse the raw manifest to read it
+	// directly so OCI artifacts with an explicit artifactType are saved correctly.
+	if raw, rawErr := img.RawManifest(); rawErr == nil {
+		var ociArtifact struct {
+			ArtifactType string `json:"artifactType,omitempty"`
+		}
+		if json.Unmarshal(raw, &ociArtifact) == nil && ociArtifact.ArtifactType != "" {
+			desc.ArtifactType = ociArtifact.ArtifactType
+		}
+	}
+	desc.Annotations = map[string]string{kindAnnotation: annotation}
+	return path.AppendDescriptor(*desc)
 }
```

**File**: `pkg/oci/layout/write_test.go` (modified, +55/-0)
```diff
@@ -16,6 +16,7 @@
 package layout
 
 import (
+	"bytes"
 	"fmt"
 	"runtime"
 	"testing"
@@ -142,3 +143,57 @@ func compareDigests(t *testing.T, img1 oci.SignedImage, img2 oci.SignedImage) {
 		t.Fatalf("digests are different: %s", d)
 	}
 }
+
+// artifactTypeImage wraps a v1.Image and injects an artifactType field into
+// the raw manifest so we can test that cosign save preserves it in index.json.
+type artifactTypeImage struct {
+	v1.Image
+	artifactType string
+}
+
+func (a *artifactTypeImage) RawManifest() ([]byte, error) {
+	raw, err := a.Image.RawManifest()
+	if err != nil {
+		return nil, err
+	}
+	// Inject the artifactType field before the closing brace.
+	insert := fmt.Sprintf(`, "artifactType": %q}`, a.artifactType)
+	raw = append(bytes.TrimRight(raw, " \t\r\n}"), []byte(insert)...)
+	return raw, nil
+}
+
+func TestAppendImagePreservesArtifactType(t *testing.T) {
+	const wantArtifactType = "application/vnd.example.test+json"
+
+	base, err := random.Image(1024, 1)
+	if err != nil {
+		t.Fatal(err)
+	}
+	img := &artifactTypeImage{Image: base, artifactType: wantArtifactType}
+
+	dir := t.TempDir()
+	if err := WriteSignedImage(dir, signed.Image(img)); err != nil {
+		t.Fatalf("WriteSignedImage: %v", err)
+	}
+
+	sii, err := SignedImageIndex(dir)
+	if err != nil {
+		t.Fatalf("SignedImageIndex: %v", err)
+	}
+
+	idx, err := sii.IndexManifest()
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	found := false
+	for _, m := range idx.Manifests {
+		if m.ArtifactType == wantArtifactType {
+			found = true
+			break
+		}
+	}
+	if !found {
+		t.Errorf("artifactType %q not found in index.json manifests: %+v", wantArtifactType, idx.Manifests)
+	}
+}
```

---

### Incident Patch 10: `1dbbc36c` (2026-07-30)
**Commit Message**: fix(load): upload bundle layer blobs before manifest PUT

cosign load was putting v3 Sigstore bundle manifests before their layer
blobs, causing BLOB_UPLOAD_UNKNOWN on registries that enforce blob-first
ordering (e.g. AWS ECR). Reorder to match WriteReferrer.

Add a unit test for upload ordering and a cross-registry e2e whose
destination rejects manifests that reference missing blobs, so the
regression is not masked by the permissive fake registry.

Fixes #5030

Co-authored-by: Cursor <[REDACTED_EMAIL]>
Signed-off-by: Geoffrey Hichborn <[REDACTED_EMAIL]>

**File**: `pkg/oci/remote/write.go` (modified, +13/-14)
```diff
@@ -131,35 +131,34 @@ func WriteSignedImageIndexImages(ref name.Reference, sii oci.SignedImageIndex, d
 				}
 			}
 			if predicateType != "" {
-				// Write the empty layer
+				// Write the empty config layer
 				_, _, err := writeEmptyConfigLayer(o)
 				if err != nil {
 					return err
 				}
 
-				// Write the manifest
-				m := referrerManifest{*manifest, bundle.BundleV03MediaType}
-				targetRef, err := m.targetRef(o.TargetRepository, opts...)
-				if err != nil {
-					return fmt.Errorf("failed to create target reference: %w", err)
-				}
-				if err := remotePut(targetRef, m, o.ROpt...); err != nil {
-					return fmt.Errorf("failed to upload manifest: %w", err)
-				}
-
-				// Write bundle layers
+				// Write bundle layers before the manifest (registries require blobs first)
 				for _, layer := range manifest.Layers {
 					bundlePath := filepath.Join(directory, "blobs", "sha256", layer.Digest.Hex)
 					bundleBytes, err := os.ReadFile(bundlePath)
 					if err != nil {
 						return err
 					}
 					layer := static.NewLayer(bundleBytes, types.MediaType(bundle.BundleV03MediaType))
-					err = remoteWriteLayer(o.TargetRepository, layer, o.ROpt...)
-					if err != nil {
+					if err := remoteWriteLayer(o.TargetRepository, layer, o.ROpt...); err != nil {
 						return err
 					}
 				}
+
+				// Write the manifest
+				m := referrerManifest{*manifest, bundle.BundleV03MediaType}
+				targetRef, err := m.targetRef(o.TargetRepository, opts...)
+				if err != nil {
+					return fmt.Errorf("failed to create target reference: %w", err)
+				}
+				if err := remotePut(targetRef, m, o.ROpt...); err != nil {
+					return fmt.Errorf("failed to upload manifest: %w", err)
+				}
 			}
 		}
 	}
```

**File**: `pkg/oci/remote/write_test.go` (modified, +114/-0)
```diff
@@ -16,16 +16,22 @@
 package remote
 
 import (
+	"encoding/json"
 	"fmt"
+	"os"
+	"path/filepath"
 	"strings"
 	"testing"
 
 	"github.com/google/go-containerregistry/pkg/name"
 	v1 "github.com/google/go-containerregistry/pkg/v1"
+	"github.com/google/go-containerregistry/pkg/v1/empty"
 	"github.com/google/go-containerregistry/pkg/v1/random"
 	"github.com/google/go-containerregistry/pkg/v1/remote"
 	"github.com/google/go-containerregistry/pkg/v1/static"
 	"github.com/google/go-containerregistry/pkg/v1/types"
+	"github.com/sigstore/cosign/v3/pkg/cosign/bundle"
+	"github.com/sigstore/cosign/v3/pkg/oci"
 	"github.com/sigstore/cosign/v3/pkg/oci/mutate"
 	"github.com/sigstore/cosign/v3/pkg/oci/signed"
 	cosignstatic "github.com/sigstore/cosign/v3/pkg/oci/static"
@@ -681,3 +687,111 @@ func TestWriteSignaturesExperimentalOCI(t *testing.T) {
 		t.Errorf("Expected manifest JSON to contain artifactType field, got: %s", string(manifestBytes))
 	}
 }
+
+// stubSignedImageIndex is a SignedImageIndex with no image, signatures, or attestations,
+// so WriteSignedImageIndexImages only exercises the bundle-referrer path.
+type stubSignedImageIndex struct{}
+
+func (stubSignedImageIndex) MediaType() (types.MediaType, error) { return empty.Index.MediaType() }
+func (stubSignedImageIndex) Digest() (v1.Hash, error)            { return empty.Index.Digest() }
+func (stubSignedImageIndex) Size() (int64, error)                { return empty.Index.Size() }
+func (stubSignedImageIndex) IndexManifest() (*v1.IndexManifest, error) {
+	return empty.Index.IndexManifest()
+}
+func (stubSignedImageIndex) RawManifest() ([]byte, error)      { return empty.Index.RawManifest() }
+func (stubSignedImageIndex) Image(h v1.Hash) (v1.Image, error) { return empty.Index.Image(h) }
+func (stubSignedImageIndex) ImageIndex(h v1.Hash) (v1.ImageIndex, error) {
+	return empty.Index.ImageIndex(h)
+}
+func (stubSignedImageIndex) SignedImageIndex(v1.Hash) (oci.SignedImageIndex, error) {
+	return nil, nil
+}
+func (stubSignedImageIndex) SignedImage(v1.Hash) (oci.SignedImage, error) { return nil, nil }
+func (stubSignedImageIndex) Signatures() (oci.Signatures, error)          { return nil, nil }
+func (stubSignedImageIndex) Attestations() (oci.Signatures, error)        { return nil, nil }
+func (stubSignedImageIndex) Attachment(string) (oci.File, error)          { return nil, nil }
+
+func TestWriteSignedImageIndexImages_BundleUploadOrder(t *testing.T) {
+	origWriteLayer := remoteWriteLayer
+	origPut := remotePut
+	t.Cleanup(func() {
+		remoteWriteLayer = origWriteLayer
+		remotePut = origPut
+	})
+
+	subjectDigest := v1.Hash{Algorithm: "sha256", Hex: "ef637aabc052029acfd192d8ed6674a5249a8783e551c08db71e321ca11b421d"}
+	bundleBytes := []byte(`{"mediaType":"application/vnd.dev.sigstore.bundle.v0.3+json"}`)
+	bundleLayer := static.NewLayer(bundleBytes, types.MediaType(bundle.BundleV03MediaType))
+	layerDigest, err := bundleLayer.Digest()
+	if err != nil {
+		t.Fatalf("bundleLayer.Digest() = %v", err)
+	}
+
+	manifest := &v1.Manifest{
+		SchemaVersion: 2,
+		MediaType:     types.OCIManifestSchema1,
+		Config: v1.Descriptor{
+			MediaType: types.MediaType("application/vnd.oci.empty.v1+json"),
+			Digest:    v1.Hash{Algorithm: "sha256", Hex: "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"},
+			Size:      2,
+		},
+		Layers: []v1.Descriptor{{
+			MediaType: types.MediaType(bundle.BundleV03MediaType),
+			Digest:    layerDigest,
+			Size:      int64(len(bundleBytes)),
+		}},
+		Subject: &v1.Descriptor{Digest: subjectDigest},
+		Annotations: map[string]string{
+			BundlePredicateType: "https://sigstore.dev/cosign/sign/v1",
+		},
+	}
+	manifestBytes, err := json.Marshal(manifest)
+	if err != nil {
+		t.Fatalf("json.Marshal() = %v", err)
+	}
+	manifestDigest, _, err := v1.SHA256(strings.NewReader(string(manifestBytes)))
+	if err != nil {
+		t.Fatalf("v1.SHA256() = %v", err)
+	}
+
+	dir := t.TempDir()
+	blobDir := filepath.Join(dir, "blobs", "sha256")
+	if err := os.MkdirAll(blobDir, 0o755); err != nil {
+		t.Fatalf("MkdirAll() = %v", err)
+	}
+	if err := os.WriteFile(filepath.Join(blobDir, layerDigest.Hex), bundleBytes, 0o644); err != nil {
+		t.Fatalf("WriteFile(layer) = %v", err)
+	}
+	if err := os.WriteFile(filepath.Join(blobDir, manifestDigest.Hex), manifestBytes, 0o644); err != nil {
+		t.Fatalf("WriteFile(manifest) = %v", err)
+	}
+
+	var callOrder []string
+	remoteWriteLayer = func(_ name.Repository, _ v1.Layer, _ ...remote.Option) error {
+		callOrder = append(callOrder, "layer")
+		return nil
+	}
+	remotePut = func(_ name.Reference, _ remote.Taggable, _ ...remote.Option) error {
+		callOrder = append(callOrder, "manifest")
+		return nil
+	}
+
+	ref, err := name.NewDigest("gcr.io/test/image@sha256:ef637aabc052029acfd192d8ed6674a5249a8783e551c08db71e321ca11b421d")
+	if err != nil {
+		t.Fatalf("name.NewDigest() = %v", err)
+	}
+	if err := WriteSignedImageIndexImages(ref, stubSignedImageIndex{}, dir); err != nil {
+		t.Fatalf("WriteSignedImageIndex
```

**File**: `test/e2e_test.go` (modified, +137/-0)
```diff
@@ -43,13 +43,15 @@ import (
 	"path/filepath"
 	"regexp"
 	"strings"
+	"sync"
 	"testing"
 	"time"
 
 	"github.com/digitorus/timestamp"
 	"github.com/google/go-cmp/cmp"
 	"github.com/google/go-containerregistry/pkg/crane"
 	"github.com/google/go-containerregistry/pkg/name"
+	"github.com/google/go-containerregistry/pkg/registry"
 	"github.com/google/go-containerregistry/pkg/v1/remote"
 	"github.com/stretchr/testify/assert"
 	"github.com/theupdateframework/go-tuf/v2/metadata"
@@ -4097,6 +4099,141 @@ func TestSaveLoad(t *testing.T) {
 	}
 }
 
+// TestSaveLoadCrossRegistry verifies that cosign load uploads bundle layer blobs
+// before manifest PUT when loading to a registry that does not already contain them.
+// This reproduces sigstore/cosign#5030, which is masked when save and load use the
+// same registry (bundle blobs already exist from signing).
+//
+// The destination uses a wrapper around registry.New() that rejects manifest PUTs
+// referencing missing blobs (like AWS ECR), since the stock fake registry does not.
+func TestSaveLoadCrossRegistry(t *testing.T) {
+	if os.Getenv("COSIGN_TEST_REPO") != "" { //nolint: forbidigo
+		t.Skip("cross-registry test requires isolated fake registries")
+	}
+
+	keysDir := t.TempDir()
+	_, privKeyPath, pubKeyPath := keypair(t, keysDir)
+
+	src := httptest.NewServer(registry.New())
+	defer src.Close()
+	dst := httptest.NewServer(blobEnforcingRegistry(registry.New()))
+	defer dst.Close()
+
+	srcURL, err := url.Parse(src.URL)
+	if err != nil {
+		t.Fatal(err)
+	}
+	dstURL, err := url.Parse(dst.URL)
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	srcRepo := path.Join(srcURL.Host, "cross-registry-src")
+	dstRepo := path.Join(dstURL.Host, "cross-registry-dst")
+	imgName := path.Join(srcRepo, "image")
+
+	_, _, cleanup := mkimage(t, imgName)
+	defer cleanup()
+
+	ctx := context.Background()
+	ko := options.KeyOpts{
+		KeyRef:           privKeyPath,
+		PassFunc:         passFunc,
+		RekorURL:         rekorURL,
+		SkipConfirmation: true,
+	}
+	so := options.SignOptions{
+		Upload:          true,
+		TlogUpload:      false,
+		NewBundleFormat: true,
+	}
+	must(sign.SignCmd(ctx, ro, ko, so, []string{imgName}), t)
+
+	imageDir := t.TempDir()
+	must(cli.SaveCmd(ctx, options.SaveOptions{Directory: imageDir}, imgName), t)
+
+	imgName2 := path.Join(dstRepo, "image")
+	must(cli.LoadCmd(ctx, options.LoadOptions{Directory: imageDir}, imgName2), t)
+
+	// Key-based verify without tlog/Fulcio — LoadCmd succeeding is the #5030 regression
+	// guard; verify confirms the loaded bundle is usable.
+	cmd := cliverify.VerifyCommand{
+		KeyRef:          pubKeyPath,
+		NewBundleFormat: true,
+		IgnoreTlog:      true,
+	}
+	must(cmd.Exec(ctx, []string{imgName2}), t)
+}
+
+// blobEnforcingRegistry wraps a registry handler and rejects manifest PUTs that
+// reference blobs that have not been uploaded yet (BLOB_UPLOAD_UNKNOWN).
+func blobEnforcingRegistry(next http.Handler) http.Handler {
+	var blobs sync.Map // digest string -> struct{}
+
+	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		if r.Method == http.MethodPut && strings.Contains(r.URL.Path, "/blobs/uploads/") {
+			digest := r.URL.Query().Get("digest")
+			rw := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
+			next.ServeHTTP(rw, r)
+			if digest != "" && rw.status >= 200 && rw.status < 300 {
+				blobs.Store(digest, struct{}{})
+			}
+			return
+		}
+
+		if r.Method == http.MethodPut && strings.Contains(r.URL.Path, "/manifests/") {
+			body, err := io.ReadAll(r.Body)
+			if err != nil {
+				http.Error(w, err.Error(), http.StatusInternalServerError)
+				return
+			}
+			r.Body = io.NopCloser(bytes.NewReader(body))
+
+			var mf struct {
+				Config *struct {
+					Digest string `json:"digest"`
+				} `json:"config"`
+				Layers []struct {
+					Digest string `json:"digest"`
+				} `json:"layers"`
+			}
+			if err := json.Unmarshal(body, &mf); err == nil && mf.Config != nil {
+				var missing []string
+				if _, ok := blobs.Load(mf.Config.Digest); !ok && mf.Config.Digest != "" {
+					missing = append(missing, mf.Config.Digest)
+				}
+				for _, layer := range mf.Layers {
+					if _, ok := blobs.Load(layer.Digest); !ok && layer.Digest != "" {
+						missing = append(missing, layer.Digest)
+					}
+				}
+				if len(missing) > 0 {
+					w.WriteHeader(http.StatusNotFound)
+					_ = json.NewEncoder(w).Encode(map[string]any{
+						"errors": []map[string]string{{
+							"code":    "BLOB_UPLOAD_UNKNOWN",
+							"message": fmt.Sprintf("Layers with digests '%v' do not exist", missing),
+						}},
+					})
+					return
+				}
+			}
+		}
+
+		next.ServeHTTP(w, r)
+	})
+}
+
+type statusRecorder struct {
+	http.ResponseWriter
+	status int
+}
+
+func (r *statusRecorder) WriteHeader(status int) {
+	r.status = status
+	r.ResponseWriter.WriteHeader(status)
+}
+
 // TestSaveLoadAutoDetectFormat verifies that local image verification auto-detects
 // the signature format (v2 attached signatures vs v3 bundles) without requir
```

---

### Incident Patch 11: `81b61e24` (2026-09-14)
**Commit Message**: fix: strip trailing whitespace from attached signature files/stdin (#5058)

* fix: strip trailing whitespace from attached signature files/stdin

Motivation:
The linked report below describes a failure after detaching a
signature with `cosign download signature ... | jq -r
'.Base64Signature' > signature.sig` and later re-attaching it on
another registry with `cosign attach signature --signature
signature.sig ...`. The reporter's own --verbose debug output shows
the OCI manifest annotation dev.cosignproject.cosign/signature on the
re-attached image literally contains the base64 signature value with
a trailing newline embedded in it, unlike the original signing
machine's copy. That newline comes from shell redirection after
`jq -r`; cosign's attach signature command stores whatever bytes it
reads from the --signature file or stdin verbatim, with no trimming.

Storing extraneous whitespace inside a signature annotation is a
real, demonstrated defect regardless of whether it fully explains the
"invalid signature when validating ASN.1 encoded signature" error the
reporter hit: Go's own base64 decoder tolerates embedded \r/\n and
decodes to the same bytes, so this alone would not necessa

**File**: `cmd/cosign/cli/attach/sig.go` (modified, +12/-2)
```diff
@@ -16,6 +16,7 @@
 package attach
 
 import (
+	"bytes"
 	"context"
 	"encoding/json"
 	"errors"
@@ -147,16 +148,25 @@ const (
 
 func signatureBytes(sigRef string) ([]byte, error) {
 	// sigRef can be "-", a string or a file.
+	var sig []byte
+	var err error
 	switch signatureType(sigRef) {
 	case StdinSignature:
-		return io.ReadAll(os.Stdin)
+		sig, err = io.ReadAll(os.Stdin)
 	case RawSignature:
 		return []byte(sigRef), nil
 	case FileSignature:
-		return os.ReadFile(filepath.Clean(sigRef))
+		sig, err = os.ReadFile(filepath.Clean(sigRef))
 	default:
 		return nil, errors.New("unknown signature arg type")
 	}
+	if err != nil {
+		return nil, err
+	}
+	// Files and stdin commonly carry a trailing newline (e.g. from `jq -r ... >
+	// file` or `echo`). Strip surrounding whitespace so it isn't stored verbatim
+	// as part of the signature annotation value.
+	return bytes.TrimSpace(sig), nil
 }
 
 func signatureType(sigRef string) SignatureArgType {
```

**File**: `cmd/cosign/cli/attach/sig_test.go` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+//
+// Copyright 2026 The Sigstore Authors.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package attach
+
+import (
+	"os"
+	"path/filepath"
+	"testing"
+)
+
+func TestSignatureBytesTrimsTrailingWhitespace(t *testing.T) {
+	const want = "MEQCIGnMnU8FiEcNVIgeR6HxNp4Gaqg5q0XLSNhBO5pp+QaNAiB40iDMGGQdthm8U9qQeCAzp6ecLdKCG3R/yq5S2uMa6g=="
+
+	dir := t.TempDir()
+	sigFile := filepath.Join(dir, "signature.sig")
+	// Simulate a signature file produced with `jq -r '.Base64Signature' > signature.sig`,
+	// which appends a trailing newline.
+	if err := os.WriteFile(sigFile, []byte(want+"\n"), 0600); err != nil {
+		t.Fatal(err)
+	}
+
+	got, err := signatureBytes(sigFile)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if string(got) != want {
+		t.Errorf("signatureBytes() = %q, want %q", string(got), want)
+	}
+}
+
+func TestSignatureBytesFileWithoutTrailingWhitespaceUnaffected(t *testing.T) {
+	const want = "MEQCIGnMnU8FiEcNVIgeR6HxNp4Gaqg5q0XLSNhBO5pp+QaNAiB40iDMGGQdthm8U9qQeCAzp6ecLdKCG3R/yq5S2uMa6g=="
+
+	dir := t.TempDir()
+	sigFile := filepath.Join(dir, "signature.sig")
+	if err := os.WriteFile(sigFile, []byte(want), 0600); err != nil {
+		t.Fatal(err)
+	}
+
+	got, err := signatureBytes(sigFile)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if string(got) != want {
+		t.Errorf("signatureBytes() = %q, want %q", string(got), want)
+	}
+}
```

---

### Incident Patch 12: `b327bba1` (2026-08-26)
**Commit Message**: fix: clarify COSIGN_REPOSITORY error when repository path is missing

COSIGN_REPOSITORY expects a full repository (registry + path), not just
a registry. When a bare registry like "registry.example.com:5000" is
given, name.NewRepository() has no '/' to split on, treats the whole
value as a repository name, and rejects it with a confusing "can only
contain the characters ..." error that looks like a parsing bug rather
than a missing path component.

Detect this case and return an actionable error message pointing out
that COSIGN_REPOSITORY needs a repository path.

Fixes #3029

Signed-off-by: Tommy <[REDACTED_EMAIL]>

**File**: `pkg/oci/remote/options.go` (modified, +11/-0)
```diff
@@ -17,6 +17,7 @@ package remote
 
 import (
 	"fmt"
+	"strings"
 
 	"github.com/google/go-containerregistry/pkg/authn"
 	"github.com/google/go-containerregistry/pkg/name"
@@ -145,6 +146,16 @@ func GetEnvTargetRepository() (name.Repository, error) {
 	if ro := env.Getenv(env.VariableRepository); ro != "" {
 		repo, err := name.NewRepository(ro)
 		if err != nil {
+			// A bare registry (e.g. "registry.example.com:5000", with no
+			// repository path) has no '/' to split on, so name.NewRepository
+			// treats the whole value as a repository name and rejects it for
+			// containing '.'/':' characters. That error is misleading: the
+			// real problem is that COSIGN_REPOSITORY must be a full
+			// repository, not just a registry.
+			if !strings.Contains(ro, "/") && (strings.Contains(ro, ".") || strings.Contains(ro, ":")) {
+				return name.Repository{}, fmt.Errorf("parsing $"+RepoOverrideEnvKey+": %q looks like a registry, but "+
+					RepoOverrideEnvKey+" must be a full repository (registry plus path), e.g. %q: %w", ro, ro+"/my-repo", err)
+			}
 			return name.Repository{}, fmt.Errorf("parsing $"+RepoOverrideEnvKey+": %w", err)
 		}
 		return repo, nil
```

**File**: `pkg/oci/remote/options_test.go` (modified, +6/-0)
```diff
@@ -174,6 +174,12 @@ func TestGetEnvTargetRepository(t *testing.T) {
 			envVal: "",
 			want:   name.Repository{},
 		},
+		{
+			desc: "registry without repository path",
+
+			envVal:  "registry.example.com:5000",
+			wantErr: errors.New(`parsing $COSIGN_REPOSITORY: "registry.example.com:5000" looks like a registry, but COSIGN_REPOSITORY must be a full repository (registry plus path), e.g. "registry.example.com:5000/my-repo": repository can only contain the characters ` + "`abcdefghijklmnopqrstuvwxyz0123456789_-./`" + `: registry.example.com:5000`),
+		},
 	}
 
 	for _, tc := range tests {
```

---

### Incident Patch 13: `3532c1d0` (2026-08-07)
**Commit Message**: fix: include annotations in implied payload for offline verify

Motivation:
When signing with `cosign sign --upload=false -a key=value
--output-signature=sig.file`, cosign builds the signed payload from
payload.Cosign{Image, ClaimedIdentity, Annotations} including the
annotations (cmd/cosign/cli/sign/sign.go). When later verifying
offline with `cosign verify -a key=value --signature sig.file` and no
explicit `--payload`, cosign reconstructs an "implied" payload via
ObsoletePayload to compare against the signature, but that
reconstruction dropped annotations entirely. The reconstructed payload
therefore never matched the payload that was actually signed, so
verification always failed with "crypto/rsa: verification error" (or
equivalent) any time annotations were used with offline signing.

Approach:
Thread the caller-supplied annotations through ObsoletePayload so the
implied payload it builds matches what was used at signing time. The
verify call site (pkg/cosign/verify.go) now passes co.Annotations,
which is populated from the `-a` flag. The attach-signature call site
(cmd/cosign/cli/attach/sig.go) has no annotations flag, so it passes
nil, preserving its existing behavior exactly

**File**: `cmd/cosign/cli/attach/sig.go` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ func SignatureCmd(ctx context.Context, regOpts options.RegistryOptions, sigRef,
 
 	var payload []byte
 	if payloadRef == "" {
-		payload, err = cosign.ObsoletePayload(ctx, digest)
+		payload, err = cosign.ObsoletePayload(ctx, digest, nil)
 	} else {
 		payload, err = os.ReadFile(filepath.Clean(payloadRef))
 	}
```

**File**: `pkg/cosign/obsolete.go` (modified, +2/-2)
```diff
@@ -26,8 +26,8 @@ import (
 // ObsoletePayload returns the implied payload that some commands expect to match
 // the signature if no payload is provided by the user.
 // DO NOT ADD ANY NEW CALLERS OF THIS.
-func ObsoletePayload(ctx context.Context, digestedImage name.Digest) ([]byte, error) {
-	blob, err := (&payload.Cosign{Image: digestedImage}).MarshalJSON()
+func ObsoletePayload(ctx context.Context, digestedImage name.Digest, annotations map[string]interface{}) ([]byte, error) {
+	blob, err := (&payload.Cosign{Image: digestedImage, Annotations: annotations}).MarshalJSON()
 	if err != nil {
 		return nil, err
 	}
```

**File**: `pkg/cosign/obsolete_test.go` (modified, +17/-1)
```diff
@@ -32,10 +32,26 @@ func TestObsoletePayload(t *testing.T) {
 	require.NoError(t, err)
 	var res []byte
 	stderr := ui.RunWithTestCtx(func(ctx context.Context, _ ui.WriteFunc) {
-		r, err := ObsoletePayload(ctx, digestedImg)
+		r, err := ObsoletePayload(ctx, digestedImg, nil)
 		require.NoError(t, err)
 		res = r
 	})
 	assert.Contains(t, stderr, "obsolete implied signature payload")
 	assert.Equal(t, []byte(`{"critical":{"identity":{"docker-reference":"index.docker.io/namespace/image"},"image":{"docker-manifest-digest":"sha256:4aa3054270f7a70b4528f2064ee90961788e1e1518703592ae4463de3b889dec"},"type":"cosign container image signature"},"optional":null}`), res)
 }
+
+func TestObsoletePayloadWithAnnotations(t *testing.T) {
+	// The implied payload must include annotations passed by the caller so it matches
+	// the payload generated when signing with annotations (cmd/cosign/cli/generate).
+	digestedImg, err := name.NewDigest("docker.io/namespace/image@sha256:4aa3054270f7a70b4528f2064ee90961788e1e1518703592ae4463de3b889dec")
+	require.NoError(t, err)
+	annotations := map[string]interface{}{"appname": "myapp"}
+	var res []byte
+	stderr := ui.RunWithTestCtx(func(ctx context.Context, _ ui.WriteFunc) {
+		r, err := ObsoletePayload(ctx, digestedImg, annotations)
+		require.NoError(t, err)
+		res = r
+	})
+	assert.Contains(t, stderr, "obsolete implied signature payload")
+	assert.Equal(t, []byte(`{"critical":{"identity":{"docker-reference":"index.docker.io/namespace/image"},"image":{"docker-manifest-digest":"sha256:4aa3054270f7a70b4528f2064ee90961788e1e1518703592ae4463de3b889dec"},"type":"cosign container image signature"},"optional":{"appname":"myapp"}}`), res)
+}
```

**File**: `pkg/cosign/verify.go` (modified, +1/-1)
```diff
@@ -1040,7 +1040,7 @@ func loadSignatureFromFile(ctx context.Context, sigRef string, signedImgRef name
 		if err != nil {
 			return nil, err
 		}
-		payload, err = ObsoletePayload(ctx, digest)
+		payload, err = ObsoletePayload(ctx, digest, co.Annotations)
 		if err != nil {
 			return nil, err
 		}
```

---

### Incident Patch 14: `f69dd357` (2026-09-06)
**Commit Message**: docs: fix two dead links in README (#5072)

- chainguard-images/static was folded into the chainguard-images/images
  monorepo; point the Dockerfile source comment at the static image's new
  home (github.com/chainguard-images/static now 404s)
- notaryproject/nv2 was archived and its issue tracker moved to
  notaryproject/notation; the referenced payload-format discussion is the
  same issue #40 under the new repo

Signed-off-by: Shurong Cao <[REDACTED_EMAIL]>
Co-authored-by: Shurong Cao <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +2/-2)
```diff
@@ -68,7 +68,7 @@ Here is how to install and use cosign inside a Dockerfile through the ghcr.io/si
 ```shell
 FROM ghcr.io/sigstore/cosign/cosign:v2.4.1 as cosign-bin
 
-# Source: https://github.com/chainguard-images/static
+# Source: https://github.com/chainguard-images/images/tree/main/images/static
 FROM cgr.dev/chainguard/static:latest
 COPY --from=cosign-bin /ko-app/cosign /usr/local/bin/cosign
 ENTRYPOINT [ "cosign" ]
@@ -420,7 +420,7 @@ That looks like:
 **Note:** This can be generated for an image reference using `cosign generate $IMAGE_URI_DIGEST`.
 
 I'm happy to switch this format to something else if it makes sense.
-See https://github.com/notaryproject/nv2/issues/40 for one option.
+See https://github.com/notaryproject/notation/issues/40 for one option.
 
 #### Registry Details
 
```

---

### Incident Patch 15: `42b1d993` (2026-09-05)
**Commit Message**: fix: update go-containerregistry to v0.22.1 (#5098)

When pushing a signature or attestation to a registry without the
referrers API, the fallback tag's descriptors were missing the bundle
manifest's annotations (dev.sigstore.bundle.content,
dev.sigstore.bundle.predicateType), so consumers couldn't filter
referrers without pulling each one. Fixed upstream in
google/go-containerregistry#2441, released in v0.22.1.

Note that existing fallback tags written by older releases are not
retroactively repaired: re-signing the same artifact skips the
already-present digest, so a stale index must be deleted and the
referrer re-pushed to pick up the annotations.

Fixes #4641

Signed-off-by: Cody Soyland <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +8/-8)
```diff
@@ -20,7 +20,7 @@ require (
 	github.com/go-piv/piv-go/v2 v2.6.0
 	github.com/google/certificate-transparency-go v1.3.3
 	github.com/google/go-cmp v0.7.0
-	github.com/google/go-containerregistry v0.21.7
+	github.com/google/go-containerregistry v0.22.1
 	github.com/google/go-github/v88 v88.0.0
 	github.com/in-toto/attestation v1.2.0
 	github.com/in-toto/in-toto-golang v0.11.0
@@ -52,7 +52,7 @@ require (
 	github.com/transparency-dev/merkle v0.0.2
 	github.com/withfig/autocomplete-tools/integrations/cobra v1.2.1
 	gitlab.com/gitlab-org/api/client-go/v2 v2.56.0
-	golang.org/x/crypto v0.54.0
+	golang.org/x/crypto v0.55.0
 	golang.org/x/oauth2 v0.36.0
 	golang.org/x/sync v0.22.0
 	golang.org/x/term v0.45.0
@@ -141,7 +141,7 @@ require (
 	github.com/decred/dcrd/dcrec/secp256k1/v4 v4.4.1 // indirect
 	github.com/digitorus/pkcs7 v0.0.0-20230818184609-3a137a874352 // indirect
 	github.com/dimchansky/utfbom v1.1.1 // indirect
-	github.com/docker/cli v29.5.3+incompatible // indirect
+	github.com/docker/cli v29.7.2+incompatible // indirect
 	github.com/docker/docker-credential-helpers v0.9.5 // indirect
 	github.com/docker/go-units v0.5.0 // indirect
 	github.com/emicklei/go-restful/v3 v3.13.0 // indirect
@@ -199,7 +199,7 @@ require (
 	github.com/jedisct1/go-minisign v0.0.0-20230811132847-661be99b8267 // indirect
 	github.com/jellydator/ttlcache/v3 v3.4.0 // indirect
 	github.com/json-iterator/go v1.1.12 // indirect
-	github.com/klauspost/compress v1.18.6 // indirect
+	github.com/klauspost/compress v1.19.2 // indirect
 	github.com/kylelemons/godebug v1.1.0 // indirect
 	github.com/lestrrat-go/blackmagic v1.0.4 // indirect
 	github.com/lestrrat-go/dsig v1.2.1 // indirect
@@ -274,12 +274,12 @@ require (
 	go.uber.org/zap v1.28.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.5 // indirect
-	golang.org/x/mod v0.38.0 // indirect
-	golang.org/x/net v0.57.0 // indirect
+	golang.org/x/mod v0.39.0 // indirect
+	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/sys v0.47.0 // indirect
-	golang.org/x/text v0.40.0 // indirect
+	golang.org/x/text v0.41.0 // indirect
 	golang.org/x/time v0.15.0 // indirect
-	golang.org/x/tools v0.47.0 // indirect
+	golang.org/x/tools v0.49.0 // indirect
 	google.golang.org/genproto v0.0.0-20260406210006-6f92a3bedf2d // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
```

**File**: `go.sum` (modified, +16/-16)
```diff
@@ -242,8 +242,8 @@ github.com/digitorus/timestamp v0.0.0-20231217203849-220c5c2851b7 h1:lxmTCgmHE1G
 github.com/digitorus/timestamp v0.0.0-20231217203849-220c5c2851b7/go.mod h1:GvWntX9qiTlOud0WkQ6ewFm0LPy5JUR1Xo0Ngbd1w6Y=
 github.com/dimchansky/utfbom v1.1.1 h1:vV6w1AhK4VMnhBno/TPVCoK9U/LP0PkLCS9tbxHdi/U=
 github.com/dimchansky/utfbom v1.1.1/go.mod h1:SxdoEBH5qIqFocHMyGOXVAybYJdr71b1Q/j0mACtrfE=
-github.com/docker/cli v29.5.3+incompatible h1:nbEFfz774vBwQ5KRYv7c/AghjReqnGISvrRhzjV0evs=
-github.com/docker/cli v29.5.3+incompatible/go.mod h1:JLrzqnKDaYBop7H2jaqPtU4hHvMKP+vjCwu2uszcLI8=
+github.com/docker/cli v29.7.2+incompatible h1:dlkwallR8XqfeVnA2ELEhdwvb4lsSwuB4IgsG8Q9cLY=
+github.com/docker/cli v29.7.2+incompatible/go.mod h1:JLrzqnKDaYBop7H2jaqPtU4hHvMKP+vjCwu2uszcLI8=
 github.com/docker/docker-credential-helpers v0.9.5 h1:EFNN8DHvaiK8zVqFA2DT6BjXE0GzfLOZ38ggPTKePkY=
 github.com/docker/docker-credential-helpers v0.9.5/go.mod h1:v1S+hepowrQXITkEfw6o4+BMbGot02wiKpzWhGUZK6c=
 github.com/docker/go-units v0.5.0 h1:69rxXcBk27SvSaaxTtLh/8llcHD8vYHT7WSdRZ/jvr4=
@@ -395,8 +395,8 @@ github.com/google/go-cmp v0.5.5/go.mod h1:v8dTdLbMG2kIc/vJvl+f65V22dbkXbowE6jgT/
 github.com/google/go-cmp v0.6.0/go.mod h1:17dUlkBOakJ0+DkrSSNjCkIjxS6bF9zb3elmeNGIjoY=
 github.com/google/go-cmp v0.7.0 h1:wk8382ETsv4JYUZwIsn6YpYiWiBsYLSJiTsyBybVuN8=
 github.com/google/go-cmp v0.7.0/go.mod h1:pXiqmnSA92OHEEa9HXL2W4E7lf9JzCmGVUdgjX3N/iU=
-github.com/google/go-containerregistry v0.21.7 h1:/vPFuVXDjtFREsVArW+0h1CIl5urnOhzei4X2DMW9IU=
-github.com/google/go-containerregistry v0.21.7/go.mod h1:kjSbt7/zMsKLWfnHrIvKvhXHUw91jbe9DNjPPJ32gXE=
+github.com/google/go-containerregistry v0.22.1 h1:RZuuSYhTvlDvtsK+NkutoCZ//C0X2ebLK8X8l3ULs84=
+github.com/google/go-containerregistry v0.22.1/go.mod h1:bJR35SK8XgisYmhg/FMQ/5RK0S/XrOAqLBV5/LR2XE0=
 github.com/google/go-github/v88 v88.0.0 h1:dZA9IKkPK1eXZj4ypngnpRj5FwdpTv4whix2PrQMP7M=
 github.com/google/go-github/v88 v88.0.0/go.mod h1:rufTDgn2N45wjhukLTyxmvc9nilSp3mr3Rgtt6b1MPw=
 github.com/google/go-querystring v1.2.0 h1:yhqkPbu2/OH+V9BfpCVPZkNmUXhb2gBxJArfhIxNtP0=
@@ -469,8 +469,8 @@ github.com/kelseyhightower/envconfig v1.4.0 h1:Im6hONhd3pLkfDFsbRgu68RDNkGF1r3dv
 github.com/kelseyhightower/envconfig v1.4.0/go.mod h1:cccZRl6mQpaq41TPp5QxidR+Sa3axMbJDNb//FQX6Gg=
 github.com/keybase/go-keychain v0.0.1 h1:way+bWYa6lDppZoZcgMbYsvC7GxljxrskdNInRtuthU=
 github.com/keybase/go-keychain v0.0.1/go.mod h1:PdEILRW3i9D8JcdM+FmY6RwkHGnhHxXwkPPMeUgOK1k=
-github.com/klauspost/compress v1.18.6 h1:2jupLlAwFm95+YDR+NwD2MEfFO9d4z4Prjl1XXDjuao=
-github.com/klauspost/compress v1.18.6/go.mod h1:cwPg85FWrGar70rWktvGQj8/hthj3wpl0PGDogxkrSQ=
+github.com/klauspost/compress v1.19.2 h1:hMRETovs/pu/dVWN7zIT1PGG8t509MwT6bO7XSi26R8=
+github.com/klauspost/compress v1.19.2/go.mod h1:cwPg85FWrGar70rWktvGQj8/hthj3wpl0PGDogxkrSQ=
 github.com/kr/pretty v0.3.1 h1:flRD4NNwYAUpkphVc1HcthR4KEIFJ65n8Mw5qdRn3LE=
 github.com/kr/pretty v0.3.1/go.mod h1:hoEshYVHaxMs3cyo3Yncou5ZscifuDolrwPKZanG3xk=
 github.com/kr/pty v1.1.1/go.mod h1:pFQYn66WHrOpPYNljwOMqo10TkYh1fy3cYio2l3bCsQ=
@@ -769,8 +769,8 @@ golang.org/x/crypto v0.0.0-20220722155217-630584e8d5aa/go.mod h1:IxCIyHEi3zRg3s0
 golang.org/x/crypto v0.6.0/go.mod h1:OFC/31mSvZgRz0V1QTNCzfAI1aIRzbiufJtkMIlEp58=
 golang.org/x/crypto v0.10.0/go.mod h1:o4eNf7Ede1fv+hwOwZsTHl9EsPFO6q6ZvYR8vYfY45I=
 golang.org/x/crypto v0.14.0/go.mod h1:MVFd36DqK4CsrnJYDkBA3VC4m2GkXAM0PvzMCn4JQf4=
-golang.org/x/crypto v0.54.0 h1:YLIA59K4fiNzHzjnZt2tUJQjQtUWfWbeHBqKtk3eScw=
-golang.org/x/crypto v0.54.0/go.mod h1:KWL8ny2AZdGR2cWmzeHrp2azQPGogOv+HeQaVEXC2dk=
+golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
+golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
 golang.org/x/exp v0.0.0-20190121172915-509febef88a4/go.mod h1:CJ0aWSM057203Lf6IL+f9T1iT9GByDxfZKAQTCR3kQA=
 golang.org/x/lint v0.0.0-20181026193005-c67002cb31c3/go.mod h1:UVdnD1Gm6xHRNCYTkRU2/jEulfH38KcIWyp/GAMgvoE=
 golang.org/x/lint v0.0.0-20190227174305-5b3e6a55c961/go.mod h1:wehouNa3lNwaWXcvxsM5YxQ5yQlVC4a0KAMCusXpPoU=
@@ -779,8 +779,8 @@ golang.org/x/mod v0.2.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.3.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.6.0-dev.0.20220419223038-86c51ed26bb4/go.mod h1:jJ57K6gSWd91VN4djpZkiMVwK6gcyfeH4XE8wZrZaV4=
 golang.org/x/mod v0.8.0/go.mod h1:iBbtSCu2XBx23ZKBPSOrRkjjQPZFPuis4dIYUhu/chs=
-golang.org/x/mod v0.38.0 h1:MECBjubtXD7yj4HrhIUcywNaGeNVUdfVnxmPajOk4yk=
-golang.org/x/mod v0.38.0/go.mod h1:V6Xz0pq8TQ3dGqVQ1FVHuelZpAL0uNhSkk9ogYP3c40=
+golang.org/x/mod v0.39.0 h1:UF5zwQdCRRUpHfyPwr7d4UrGiVeldIsogtzWVnczL74=
+golang.org/x/mod v0.39.0/go.mod h1:bvIbwjQ0HUFFf5AKukeeYQG4ZBUG9yxQbR9aEweIwYY=
 golang.org/x/net v0.0.0-20180724234803-3673e40ba225/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20180826012351-8a410e7b638d/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x
```

#### Recent Merged Pull Requests:
- **PR #5147** (2026-10-04): Mention windows builds in readme (@Hayden-IO)
- **PR #5140** (2026-09-30): chore(deps): bump golangci/golangci-lint from v2.13.2 to v2.14.0 in the all group (@dependabot[bot])
- **PR #5139** (2026-09-30): chore(deps): bump the gomod group across 1 directory with 3 updates (@dependabot[bot])
- **PR #5137** (2026-09-29): test(verify): add failure cases for new bundle verification (@aaronlew02)
- **PR #5136** (closed): chore(deps): bump the gomod group across 1 directory with 4 updates (@dependabot[bot])
- **PR #5135** (2026-09-24): Rename crypto11 module path (@Hayden-IO)
- **PR #5133** (2026-09-24): chore(deps): upgrade gitlab-org/api/client-go to v3 (@chimanjain)
- **PR #5132** (2026-09-24): fix(sign): propagate BundlePath from SignOptions to KeyOpts (@aaronlew02)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
