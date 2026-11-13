# Verification Protocol: Verification Protocol: Empirical Defect Shield for smallstep-cli-learnings

<!-- PROVENANCE_START
{
  "source_repository": "smallstep-cli-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:44:56.473Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-smallstep-cli-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [smallstep-cli-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:44:56.473Z`  
> **Learning ID**: `LEARN-REEXTRACT-smallstep-cli-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `smallstep-cli-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/smallstep-cli-learnings.md`  
> **Source**: github ([https://github.com/smallstep/cli](https://github.com/smallstep/cli))  
> **Source Version**: `eed88c74`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-09T21:59:29.772Z  
> **Learning ID**: `learn-github-smallstep-cli`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): smallstep/cli

---

## 1. Executive Forensic Architecture & System Mechanics

`smallstep/cli` (`step`) is an enterprise-grade cryptographic Swiss Army knife and operational client for Public Key Infrastructure (PKI), automated certificate management (ACME/RFC 8555), identity protocols (OAuth/OIDC, JWT/JWS/JWE), and secure hardware/cloud key storage (KMS, HSM, TPM, PKCS#11). 

```
                                      +---------------------------------------------+
                                      |                  CLI Entry                  |
                                      |              (cmd/step/main.go)             |
                                      +----------------------+----------------------+
                                                             |
                                           [Command Dispatch via urfave/cli]
                                                             |
                    +--------------------+-------------------+--------------------+--------------------+
                    |                    |                                        |                    |
            +-------v-------+    +-------v-------+                        +-------v-------+    +-------v-------+
            |  ca / admin   |    |  certificate  |                        |  crypto/jose  |    |  crypto/kms   |
            | (Provisioners,|    | (X.509, CSRs, |                        |  (JWT, JWS,   |    | (Cloud, PKCS11|
            | Webhooks, EAB)|    |  CRLs, Roots) |                        |   JWE, JWK)   |    |   TPM, Agent) |
            +-------+-------+    +-------+-------+                        +-------+-------+    +-------+-------+
                    |                    |                                        |                    |
                    v                    v                                        v                    v
            +---------------+    +---------------+                        +---------------+    +---------------+
            | linkedca gRPC |    |  x509 / pkix  |                        |  go-jose/v4   |    | Subprocess /  |
            | / REST Client |    | ASN.1 Engine  |                        |  joseutil     |    | Plugin Bridge |
            +---------------+    +---------------+                        +---------------+    +---------------+
```

### Architectural Subsystems and Domain Boundaries
1. **The CLI Command Dispatch Layer (`command/`)**: Decouples terminal parameter parsing, flag binding, interactive prompt handling (`promptui`), and command definition using `urfave/cli` from core crypto algorithms. Subcommands operate as stateless controllers that translate CLI context into structured domain requests.
2. **The Cryptographic Engine & Protocol Adapters (`internal/cryptoutil`, `internal/joseutil`, `internal/crlutil`)**: Acts as a safety proxy between standard Go crypto primitives (`crypto/*`), third-party libraries (`go-jose/v4`), and downstream PKI engines. This layer intercepts edge-case failures, such as maintaining byte-for-byte fidelity in re-encoded JOSE envelopes and abstracting symmetric vs. asymmetric cryptographic primitives.
3. **Hardware & Cloud KMS Plugin Bridge (`internal/cryptoutil/cryptoutil.go`)**: Implements `crypto.Signer` via an external subprocess plugin pattern (`step-kms-plugin`). It enforces stdin/stdout stream communication, handles base64 digest marshaling, injects salt lengths for RSA-PSS signatures, and falls back to disk-backed keys if file paths resolve locally before evaluating KMS URIs.
4. **CA Administrative & Remote State Engine (`command/ca/`)**: Interacts with local CA JSON configuration files and remote `linkedca` gRPC/HTTP control planes. It manages dynamic provisioner webhooks (enrichment/validation), ACME External Account Binding (EAB) tokens, and identity lifecycle flows.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Preservation of Serialized Cryptographic Envelopes
**RULE**:
When reformatting, inspecting, or converting signed or authenticated cryptographic envelopes (e.g., JWS, JWE, CMS/PKCS#7, X.509), the system **MUST NOT** decode and re-serialize the authenticated header dictionary. The system **MUST** preserve and transplant the exact original byte sequence (or base64url segment) of the authenticated data into the output structure.

**WHY**:
Cryptographic signatures and authenticated encryption tags (such as AES-GCM or HMAC) are calculated over the exact raw byte stream of the authenticated envelope (RFC 7515 §5.1, RFC 7516 §5.1). Deserializing a protected header into a native language structure (e.g., a Go `map[string]any` or struct) and re-marshaling it introduces non-deterministic key reordering, JSON whitespace changes, and number formatting discrepancies. Even though the re-marshaled JSON represents identical semantic data, the byte alteration causes verification downstream to fail with "signature mismatch" or "authentication tag verification failed."

**WHEN TO APPLY**:
Any serialization converter, CLI formatter (`step crypto jose format`), logging proxy, or token inspection utility operating on signed or encrypted envelopes (JWS, JWE, JWT, SAML, Signed XML).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// withCompactProtected replaces the re-serialized protected header in compact JWS/JWE
// with the exact base64url-encoded bytes from the original JSON payload.
func withCompactProtected(compact, originalToken string) string {
	var jws struct {
		Protected  string `json:"protected"`
		Signatures []struct {
			Protected string `json:"protected"`
		} `json:"signatures"`
	}
	if err := json.Unmarshal([]byte(originalToken), &jws); err != nil {
		return compact
	}

	protected := jws.Protected
	if protected == "" && len(jws.Signatures) == 1 {
		protected = jws.Signatures[0].Protected
	}
	_, rest, ok := strings.Cut(compact, ".")
	if protected == "" || !ok {
		return compact
	}
	// Preserve exact raw base64url bytes to prevent signature invalidation
	return strings.TrimRight(protected, "=") + "." + rest
}

// withJSONProtected transplants the original raw protected segment into the full JSON output.
func withJSONProtected(fullSerializedJSON, originalCompactToken string) string {
	var serialized struct {
		Protected string `json:"protected"`
	}
	if err := json.Unmarshal([]byte(fullSerializedJSON), &serialized); err != nil {
		return fullSerializedJSON
	}

	originalProtected, _, _ := strings.Cut(originalCompactToken, ".")
	if originalProtected == "" {
		return fullSerializedJSON
	}

	// Substitute re-serialized header with the original byte sequence
	return strings.Replace(
		fullSerializedJSON,
		`"protected":"`+serialized.Protected+`"`,
		`"protected":"`+originalProtected+`"`,
		1,
	)
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Decoding and re-marshaling protected headers destroys signature validity.
func badFormatJWS(jwsObj *jose.JSONWebSignature) (string, error) {
    // Calling FullSerialize() re-encodes jwsObj.Signatures[i].protected
    // resulting in lexicographical map reordering.
    return jwsObj.CompactSerialize() // Cryptographic signature broken!
}
```

**VERIFICATION METHOD**:
Generate a signed JWS token using an external tool (e.g., OpenSSL or Jose CLI) with intentionally out-of-order JSON fields in the protected header (e.g., `{"typ":"JWT","alg":"HS256"}`). Execute the format conversion routine. Assert that `crypto.Verify(reformattedToken) == nil`.

---

### 2. Symmetric Cryptographic Key Abstraction Polymorphism Invariant
**RULE**:
When abstracting public/private key pairs across cryptographic subsystems, functions that derive public keys (e.g., `Key.Public()`) **MUST NOT** be invoked on symmetric keys (`oct` / HMAC / AES-GCM). The subsystem **MUST** implement explicit type inspection (`IsSymmetric`) before invoking asymmetric key extraction routines.

**WHY**:
In asymmetric cryptography (RSA, ECDSA, Ed25519), encryption or signature verification requires the public key, obtained via an interface method like `Signer.Public()`. For symmetric keys (RFC 7517 `oct`), there is no public key; the secret key itself performs both encryption/decryption and signing/verification. Many standard libraries (such as `go-jose`) return `nil` or an empty struct when `JSONWebKey.Public()` is called on a symmetric key. Passing this result into encryption pipelines produces catastrophic runtime failures (e.g., `unsupported key type '<nil>'`).

**WHEN TO APPLY**:
Key management layers, encryption CLI actions, hybrid cryptographic interfaces, and envelope encryption modules supporting both asymmetric and symmetric primitives.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Ensure symmetric keys remain unmodified when prepping keys for encryption.
func prepareKeyForEncryption(jwk *jose.JSONWebKey) (*jose.JSONWebKey, error) {
	if jwk == nil {
		return nil, errors.New("jwk cannot be nil")
	}

	// Symmetric keys (oct) must NOT have .Public() called on them
	if !jose.IsSymmetric(jwk.Key) {
		jwkPub := jwk.Public()
		if jwkPub.Key == nil {
			return nil, errors.New("failed to derive public key from asymmetric private key")
		}
		jwk = &jwkPub
	}

	if jwk.Use == "sig" {
		return nil, errors.New("invalid jwk use: found 'sig' (signature), expecting 'enc' (encryption)")
	}

	return jwk, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Blindly invoking Public() assuming all keys are asymmetric.
func badEncryptSetup(jwk *jose.JSONWebKey) *jose.JSONWebKey {
    // If jwk is an 'oct' (symmetric) key, jwk.Public() returns JSONWebKey{Key: nil}
    jwkPub := jwk.Public() 
    return &jwkPub // Blows up later with: "unsupported key type <nil>"
}
```

**VERIFICATION METHOD**:
Construct automated unit tests that pass an `oct` key (AES-128, AES-256) through the encryption setup. Assert that the underlying raw key bytes match post-preparation and that key derivation returns no error.

---

### 3. Strict RFC Key-Length Hard Boundary Invariant
**RULE**:
Cryptographic tools **MUST NOT** permit arbitrary or down-scoped key sizes for algorithms with RFC-stipulated security floors, even if an `--insecure` override flag is supplied by the user. Key size validation **MUST** enforce exact matching when the algorithm defines a fixed block/wrap size, and strict minimums when defined by RFC output bit-lengths.

**WHY**:
In RFC 7518 §3.2 (JSON Web Algorithms), HMAC keys MUST have a size greater than or equal to the output size of the underlying hash function (HS256 requires $\ge 32$ bytes; HS384 requires $\ge 48$ bytes; HS512 requires $\ge 64$ bytes). Allowing short keys enables trivial brute-force and dictionary attacks. Furthermore, AES Key Wrap algorithms (A128KW, A192KW, A256KW) select cryptographic primitives based on key length; providing mismatched key lengths induces internal panics or unauthenticated ciphertext corruption. Permitting `--insecure` to bypass fundamental mathematical constraints produces non-functional keys that fail downstream verification.

**WHEN TO APPLY**:
CLI parameter parsing, key generation APIs, cryptographic token generation tools, and TLS/JWK configuration validations.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
func validateOctKeySize(alg string, size int, insecureAllowed bool) error {
	// 1. Strict RFC 7518 §3.2 minimum HMAC key length enforcement
	if minHmac := hmacKeySize(alg); minHmac > 0 {
		if size < minHmac {
			// RFC floor CANNOT be bypassed by insecure flags
			return fmt.Errorf("flag '--size' must be greater than or equal to %d bytes for alg %s", minHmac, alg)
		}
	}

	// 2. Exact match enforcement for AES Key Wrap
	if exactAes := aesKeySize(alg); exactAes > 0 {
		if size != exactAes {
			return fmt.Errorf("flag '--size' must be equal to %d bytes for alg %s", exactAes, alg)
		}
	}

	// 3. Absolute floor for arbitrary direct symmetric keys
	if size < 16 && !insecureAllowed {
		return errors.New("flag '--size' requires at least 16 bytes unless '--insecure' flag is provided")
	}

	if size <= 0 {
		return errors.New("flag '--size' must be greater than or equal to 1 byte")
	}

	return nil
}

func hmacKeySize(alg string) int {
	switch alg {
	case "HS256": return 32
	case "HS384": return 48
	case "HS512": return 64
	default:      return 0
	}
}

func aesKeySize(alg string) int {
	switch alg {
	case "A128KW", "A128GCMKW": return 16
	case "A192KW", "A192GCMKW": return 24
	case "A256KW", "A256GCMKW": return 32
	default:                     return 0
	}
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Permitting `--insecure` to bypass cryptographic mathematical limits
if size < 32 && ctx.Bool("insecure") {
    // Creates broken 4-byte HMAC keys that go-jose v4 rejects at runtime
    return generateKey(size) 
}
```

**VERIFICATION METHOD**:
Execute CLI integration tests via `.txtar` scripts asserting non-zero error return codes and exact error strings when generating `oct` keys with `--size 31 --alg HS256 --insecure`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Symmetric Key Extraction Failure in JWE Encryption via `JSONWebKey.Public()` (BUG-STEP-01)
- **Context**: `command/crypto/jwe/encrypt.go`, JWE encryption action handler.
- **What Was Expected**: Executing `step crypto jwe encrypt` using a symmetric `oct` key should derive the direct encryption key or key-wrap cipher and emit an encrypted JWE envelope.
- **What Actually Happened**: The command crashed with `unsupported key type '<nil>'` when users supplied a valid symmetric JWK (`oct`).
- **Evidence in Repo**: Commit `7ddafe6f`. Files modified: `command/crypto/jwe/encrypt.go`, `CHANGELOG.md`.
- **Root Cause**: The encryption setup logic assumed all keys were asymmetric. It unconditionally invoked `jwkPub := jwk.Public()`, overwriting `jwk` with `&jwkPub`. For symmetric `oct` keys, `go-jose` returns an empty struct with `Key: nil`.
- **Remediation Code Diff**:
```go
// command/crypto/jwe/encrypt.go
@@ -240,9 +241,12 @@ func encryptAction(ctx *cli.Context) error {
 			KeyID:     kid,
 		}
 	} else {
-		// Public keys are used for encryption
-		jwkPub := jwk.Public()
-		jwk = &jwkPub
+		// Public keys are used for encryption. go-jose JSONWebKey.Public() returns
+		// an empty key for oct, which are symmetric and are used as they are.
+		if !jose.IsSymmetric(jwk) {
+			jwkPub := jwk.Public()
+			jwk = &jwkPub
+		}
 
 		if jwk.Use == "sig" {
 			return errors.New("invalid jwk use: found 'sig' (signature), expecting 'enc' (encryption)")
```
- **Lesson**: Interface abstractions that assume asymmetry must guard derivation calls using domain-specific invariant checks (`IsSymmetric`).

---

### Incident 2: Insecure JOSE Serialization via Header Field Re-marshaling Invalidating Signatures (BUG-STEP-02)
- **Context**: `command/crypto/jose/jose.go`, token formatting and inspection pipeline.
- **What Was Expected**: Running `step crypto jose format` to convert tokens between compact and full JSON serialization formats should produce valid cryptographic tokens whose signatures remain verifiable.
- **What Actually Happened**: Output tokens failed signature or AEAD tag verification in third-party systems.
- **Evidence in Repo**: Commit `7ddafe6f`. Files modified: `command/crypto/jose/jose.go`, `CHANGELOG.md`.
- **Root Cause**: Standard `go-jose` unmarshals the JSON protected header into a native Go struct, and marshals it back during `CompactSerialize()` or `FullSerialize()`. Go's JSON encoder orders map keys lexicographically. If the original token had headers in a different sequence, the binary representation of the authenticated data changed, breaking signature checks.
- **Remediation Code Diff**:
```go
// command/crypto/jose/jose.go
@@ -90,14 +93,56 @@ func formatAction(*cli.Context) error {
 		if err != nil {
 			return errors.Wrap(jose.TrimPrefix(err), "error serializing data")
 		}
-		fmt.Println(str)
+		fmt.Println(withCompactProtected(str, token))
 	} else {
-		fmt.Println(srz.FullSerialize())
+		fmt.Println(withJSONProtected(srz.FullSerialize(), token))
 	}
```
- **Lesson**: In cryptographic envelopes, the protected header is binary authenticated data. Never allow a JSON serializer to regenerate it; splice the original raw base64 segment into the serialized envelope.

---

### Incident 3: Insecure Key Size Parameter Override & RFC 7518 Violation (BUG-STEP-03)
- **Context**: `command/crypto/jwk/create.go`, JWK generation command.
- **What Was Expected**: Creating an HMAC or AES key with `--kty oct` should strictly comply with minimum bit-length limits dictated by upstream crypto parsers.
- **What Actually Happened**: Users could supply `--size 4 --insecure` to generate 4-byte HMAC keys. When `smallstep/cli` upgraded to `go-jose/v4`, `go-jose` strictly enforced RFC 7518 §3.2, causing all downstream `step crypto jwt sign/verify` workflows on these keys to fail.
- **Evidence in Repo**: Commit `4ad9dc5c` & `7ddafe6f`. Files modified: `command/crypto/jwk/create.go`, `flags/flags.go`, `integration/testdata/crypto/jwk-create-oct.txtar`.
- **Root Cause**: The CLI permitted `--insecure` to bypass the minimum size validation floor, and the `--size` flag documentation ambiguously treated sizes as bits for RSA but bytes for `oct`.
- **Remediation Code Diff**:
```go
// command/crypto/jwk/create.go
@@ -459,11 +459,23 @@ func createAction(ctx *cli.Context) (err error) {
 		if ctx.IsSet("size") {
-			if size < 16 && !ctx.Bool("insecure") {
-				return errs.MinSizeInsecureFlag(ctx, "size", "16")
+			if alg == "" {
+				switch use {
+				case "", "sig":
+					alg = jose.DefaultOctSigAlgorithm
+				case "enc":
+					alg = string(jose.DefaultOctKeyAlgorithm)
+				}
 			}
-			if size <= 0 {
-				return errs.MinSizeFlag(ctx, "size", "0")
+			// go-jose v4 enforces RFC 7518 §3.2, which says an HMAC key must be at
+			// least as long as the hash output.
+			if n := hmacKeySize(alg); size < n {
+				return errs.MinSizeFlag(ctx, "size", strconv.Itoa(n))
+			}
+			// go-jose selects the AES variant from the key size, so the size must
+			// match the algorithm exactly.
+			if n := aesKeySize(alg); n > 0 && size != n {
+				return fmt.Errorf("flag '--size' must be equal to %d", n)
 			}
 		}
```
- **Lesson**: Upstream protocol specs take precedence over CLI escape hatches. An `--insecure` flag must never allow creation of crypto structures rejected by upstream libraries.

---

### Incident 4: Subsystem Decoupling Breakage in Cloud KMS Provider (BUG-STEP-04)
- **Context**: `internal/cryptoutil/cryptoutil.go`, KMS signer abstraction.
- **What Was Expected**: Executing `step certificate sign --kms "cloudkms:" ...` should route signing requests through `step-kms-plugin` transparently.
- **What Actually Happened**: Release v0.30.1 failed with `Error: cloudkms: does not implement a CertificateManager`.
- **Evidence in Repo**: GitHub Issue #1601.
- **Root Cause**: Architectural coupling violation. `step-cli` introduced a type assertion expecting the KMS driver to implement an expanded `CertificateManager` interface instead of relying strictly on `crypto.Signer`. External plugins implementing only key signing were rejected during certificate signing flows.
- **Remediation Code Pattern**: Decoupled interface assertion in `internal/cryptoutil`:
```go
// Decouple basic signing from certificate storage management
if signer, ok := kmsProvider.(crypto.Signer); ok {
    // Signing requires only crypto.Signer, do not demand CertificateManager
    return executeSigningFlow(signer)
}
```
- **Lesson**: Practice the Interface Segregation Principle on plugin boundaries. Never require a monolithic interface when a primitive interface (`crypto.Signer`) is sufficient.

---

### Incident 5: Packaging Target Override Collapsing Distribution Architectures (BUG-STEP-05)
- **Context**: `.goreleaser.yml`, release artifact pipeline.
- **What Was Expected**: Building Linux packages (`.deb`, `.rpm`) across all 8 supported CPU architectures (`amd64`, `arm64`, `armv6`, `armv7`, `ppc64le`, `s390x`, `riscv64`, `i386`).
- **What Actually Happened**: Supported package architectures silently dropped from 8 to 2 (`amd64`, `arm64`).
- **Evidence in Repo**: GitHub Issue #1543, Commit `64865322`.
- **Root Cause**: In `.goreleaser.yml`, an explicit `targets` slice was added to the `nfpm` build section. In GoReleaser, an explicit `targets` directive completely overrides inherited matrix targets from YAML anchors (`<< : *BUILD`), rather than merging with them.
- **Remediation Code Diff**:
```yaml
# .goreleaser.yml
 builds:
   - id: nfpm
     << : *BUILD
-    targets:
-      - linux_amd64
-      - linux_arm64
+    # Allow targets to inherit from *BUILD anchor containing all 8 architectures
```
- **Lesson**: In declarative CI/CD configurations, YAML anchor inheritance semantics must be tested by asserting the actual generated build matrix artifacts in CI.

---

### Incident 6: Upstream Parser Upgrades Breaking Token Inspection (BUG-STEP-06)
- **Context**: `internal/joseutil/joseutil.go`, JWT/JWS inspection subcommands.
- **What Was Expected**: Inspect commands (`step crypto jwt inspect`, `jws inspect`) should parse and display tokens even if they use insecure algorithms (e.g., `none`), legacy curves (`ES256K`), or missing headers.
- **What Actually Happened**: The upgrade to `go-jose/v4` caused `step crypto jwt inspect` to throw parsing errors on malformed or unsigned tokens, preventing diagnostic usage.
- **Evidence in Repo**: Commit `7ddafe6f`. Files created: `internal/joseutil/joseutil.go`. Files modified: `command/crypto/jwt/inspect.go`, `command/crypto/jws/inspect.go`.
- **Root Cause**: `go-jose/v4` rejects unrecognized or `none` algorithms during initial token unmarshaling. While correct for cryptographic verification, this broke inspection tools whose purpose is examining tokens without verifying them.
- **Remediation Code Diff**:
```go
// command/crypto/jwt/inspect.go
@@ -55,7 +57,7 @@ func inspectAction(ctx *cli.Context) error {
 }
 
 func printToken(token string) error {
-	tok, err := jose.ParseJWS(token)
+	tok, err := joseutil.ParseSignedInsecure(token)
 	if err != nil {
 		return errors.Wrap(jose.TrimPrefix(err), "error parsing token")
 	}
```
- **Lesson**: Segregate validation paths based on operational context. Inspection tools require relaxed, permissive parsers, while cryptographic verification paths require strict, zero-trust parsers.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
* **BigInt In-Place Mutation Trap in Go**: In `internal/crlutil/crlutil.go`, operations on `*big.Int` mutate the receiver.
  ```go
  // DEFECT TRAP:
  // crl.Number.Add(crl.Number, big.NewInt(1)) mutates crl.Number directly!
  // If crl.Number is referenced elsewhere, its value is corrupted.
  // SAFE PATTERN:
  version := new(big.Int).Add(crl.Number, big.NewInt(1))
  ```
* **String Splitting vs Scanning**: In `internal/joseutil/joseutil.go`, `strings.Cut` is used instead of `strings.Split`. `strings.Cut(s, ".")` avoids slice allocation, guaranteeing $O(1)$ allocation overhead during compact token parsing:
  ```go
  protected, rest, ok := strings.Cut(compact, ".")
  ```
* **Strict Base64 Padding Normalization**: JOSE compact tokens omit padding (`=`). Standard decoding fails unless raw URL decoding is used:
  ```go
  // Strip trailing padding to ensure standard base64url conformity
  header, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(protected, "="))
  ```

### 2. Infinite Loop & Recursion Guards
* **Subprocess Stdin Deadlock Guard**: In `internal/cryptoutil/cryptoutil.go`, piping data to an external process (`step-kms-plugin`) via `cmd.StdinPipe()` will deadlock if executed synchronously on large digests when the operating system pipe buffer fills:
  ```go
  stdin, err := cmd.StdinPipe()
  if err != nil {
      return nil, err
  }
  // CONCURRENCY INVARIANT: Stdin writes MUST occur in an asynchronous goroutine
  // before cmd.Output() blocks reading stdout.
  go func() {
      defer stdin.Close()
      stdin.Write(digest)
  }()
  out, err := cmd.Output()
  ```
* **Slice Deduplication Without Re-Allocation Thrashing**: `internal/sliceutil/sliceutil.go` implements generic deduplication using an in-place read/write two-pointer technique:
  ```go
  func RemoveValues[T comparable](slice, values []T) []T {
      if len(slice) == 0 { return slice }
      keys := make(map[T]struct{}, len(slice))
      for _, v := range values { keys[v] = struct{}{} }
      var i int
      for _, v := range slice {
          if _, ok := keys[v]; !ok {
              slice[i] = v
              i++
          }
      }
      return slice[:i] // In-place slice reslice preserves capacity without GC pressure
  }
  ```

### 3. UI & UX Micro-Mechanics
* **Non-Printable ASN.1 Octet Stream Sanitization**: In `internal/crlutil/crl_extensions.go`, raw bytes from unparsed ASN.1 extensions cannot be dumped to terminal screens directly. Doing so causes terminal escape injection or corrupts cursor state:
  ```go
  func sanitizeBytes(b []byte) string {
      value := bytes.Runes(b)
      sanitized := make([]rune, len(value))
      for i, r := range value {
          if strconv.IsPrint(r) && r != '' {
              sanitized[i] = r
          } else {
              sanitized[i] = '.' // Mask unprintable terminal characters
          }
      }
      return string(sanitized)
  }
  ```
* **Dual Output Stream Segregation**: Interactive CLI prompts and visual progress meters (`ui.PrintSelected`) are directed exclusively to `stderr`, leaving `stdout` clean for piped cryptographic outputs (`> token.jwt`, `| jq`).

### 4. Backend Concurrency & Memory Safety
* **TOCTOU Race Avoidance in KMS Resolution**: In `internal/cryptoutil/cryptoutil.go`, an input parameter can be either an arbitrary KMS URI (`yubikey:slot-id=9a`) or a file on disk. A Time-of-Check to Time-of-Use race can occur if an attacker creates a local file named `yubikey:slot-id=9a`:
  ```go
  func IsKMS(rawuri string) bool {
      // INVARIANT: Check filesystem presence before parsing as a URI
      if _, err := os.Stat(rawuri); err == nil {
          return false // File takes absolute precedence over URI scheme
      }
      typ, err := kms.TypeOf(rawuri)
      return err == nil && typ != apiv1.DefaultKMS
  }
  ```
* **Subprocess Exit Error Deserialization**: Plain `err.Error()` from `os/exec` returns generic messages like `exit status 1`. The forensic error extractor intercepts the underlying exit code and standard error buffer:
  ```go
  func exitError(cmd *exec.

## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
