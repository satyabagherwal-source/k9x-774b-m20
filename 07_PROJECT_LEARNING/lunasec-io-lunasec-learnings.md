# Forensic Learning Record (Deep Inspection): lunasec-io/lunasec

> **Canonical Artifact**: `07_PROJECT_LEARNING/lunasec-io-lunasec-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lunasec-io/lunasec](https://github.com/lunasec-io/lunasec))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:45:23.343Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lunasec-io/lunasec`
- **Description**: LunaSec - Dependency Security Scanner that automatically notifies you about vulnerabilities like Log4Shell or node-ipc in your Pull Requests and Builds. Protect yourself in 30 seconds with the LunaTrace GitHub App: https://github.com/marketplace/lunatrace-by-lunasec/ 
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, go.mod, README.md
- **Stars / Engagement**: 1470 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `lunadefend/go/gateway/ecrutils.go`
```
// Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
package gateway

import (
	"github.com/google/go-containerregistry/pkg/authn"
	"github.com/google/go-containerregistry/pkg/crane"
	"log"
)

func LoadPublicCraneOptions(ecrGateway AwsECRGateway) (options crane.Option, err error) {
	cfg, err := ecrGateway.GetPublicCredentials()
	if err != nil {
		log.Println(err)
		return
	}

	authenticator := authn.FromConfig(cfg)

	options = crane.WithAuth(authenticator)
	return
}

func LoadCraneOptions(ecrGateway AwsECRGateway) (options crane.Option, err error) {
	cfg, err := ecrGateway.GetCredentials()
	if err != nil {
		log.Println(err)
		return
	}

	authenticator := authn.FromConfig(cfg)

	options = crane.WithAuth(authenticator)
	return
}

```

### Core Architecture Module: `lunadefend/go/util/apigateway.go`
```
// Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
package util

import (
  "encoding/json"
  "fmt"
  "github.com/awslabs/aws-lambda-go-api-proxy/core"
  "github.com/lunasec-io/lunasec/lunadefend/go/types"
  "net/http"

  "github.com/aws/aws-lambda-go/events"
)

// from: https://github.com/aquasecurity/lmdrouter/blob/master/encoder.go

// MarshalApiGatewayResponse generated an events.APIGatewayProxyResponse object that can
// be directly returned via the lambda's handler function. It receives an HTTP
// status code for the response, a map of HTTP headers (can be empty or nil),
// and a value (probably a struct) representing the response body. This value
// will be marshaled to JSON (currently without base 64 encoding).
func MarshalApiGatewayResponse(status int, headers map[string]string, data interface{}) (
  events.APIGatewayProxyResponse,
  error,
) {
  b, err := json.Marshal(data)
  if err != nil {
    status = http.StatusInternalServerError
    b = []byte(`{"code":500,"message":"the server has encountered an unexpected error"}`)
  }

  if headers == nil {
    headers = make(map[string]string)
  }
  headers["Content-Type"] = "application/json; charset=UTF-8"

  return events.APIGatewayProxyResponse{
    StatusCode:      status,
    IsBase64Encoded: false,
    Headers:         headers,
    Body:            string(b),
  }, nil
}

// ApiGatewayError generates an events.APIGatewayProxyResponse from an error value.
func ApiGatewayError(err error) (events.APIGatewayProxyResponse, error) {
  httpErr := types.HTTPError{
    Error: err.Error(),
  }

  return MarshalApiGatewayResponse(
    http.StatusInternalServerError,
    nil,
    httpErr,
  )
}

func GetAPIGatewayTokenizerURL(r *http.Request) (tokenizerURL string) {
  requestContext, ok := core.GetAPIGatewayContextFromContext(r.Context())
  if ok {
    // the request came from API gateway, build the backend url
    tokenizerURL = fmt.Sprintf("%s://%s/%s", r.URL.Scheme, requestContext.DomainName, requestContext.Stage)
  }
  return
}

```

### Core Architecture Module: `lunadefend/go/util/application.go`
```
// Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
package util

import (
  "github.com/lunasec-io/lunasec/lunadefend/go/constants"
  "os"
)

func IsDevEnv() bool {
  stage := os.Getenv(constants.StageEnvVar)
  return constants.AppEnv(stage) == constants.Development
}

func IsProdEnv() bool {
  stage := os.Getenv(constants.StageEnvVar)
  return constants.AppEnv(stage) == constants.Production
}

```

### Core Architecture Module: `lunadefend/go/util/auth/auth.go`
```
// Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
package auth

import (
  "github.com/lunasec-io/lunasec/lunadefend/go/controller/request"
  "github.com/lunasec-io/lunasec/lunadefend/go/service"
  "github.com/lunasec-io/lunasec/lunadefend/go/types"
  "net/http"
)

func GetRequestClaims(jwtVerifier service.JwtVerifier, r *http.Request) (claims types.SessionJwtClaims, err error) {
  accessToken, err := request.GetJwtToken(r)
  if err != nil {
    return
  }

  return jwtVerifier.VerifyWithSessionClaims(accessToken)
}

```

### Core Architecture Module: `lunadefend/go/util/config.go`
```
// Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
package util

import (
	"fmt"
	"go.uber.org/config"
	"io/fs"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
)

const (
	baseConfigFileName = "config.yaml"
)

func FindFirstExistingFile(filePaths []string) string {
	for _, file := range filePaths {
		if _, err := os.Stat(file); err == nil {
			return file
		}
	}
	return ""
}

func getFilesInDir(dir string) []fs.FileInfo {
	files, err := ioutil.ReadDir(dir)
	if err != nil {
		panic(err)
	}
	return files
}

func GetConfigProviderFromFiles(filenames []string) config.Provider {
	opts := []config.YAMLOption{
		config.Permissive(),
		config.Expand(os.LookupEnv),
	}

	for _, name := range filenames {
		log.Printf("loading config file %s", name)
		opts = append(opts, config.File(name))
	}
	provider, err := config.NewYAML(opts...)
	if err != nil {
		fmt.Println(err)
		panic(err)
	}
	return provider
}

func GetConfigProviderFromDir(configDir string) config.Provider {
	var (
		filenames      []string
		baseConfigFile string
	)

	err := filepath.Walk(configDir,
		func(filepath string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}

			if !info.IsDir() {
				if info.Name() == baseConfigFileName {
					baseConfigFile = filepath
					return nil
				}
				filenames = append(filenames, filepath)
			}
			return nil
		})

	if err != nil {
		log.Println(err)
	}

	if baseConfigFile != "" {
		filenames = append([]string{baseConfigFile}, filenames...)
	}

	return GetConfigProviderFromFiles(filenames)
}

func GetStaticConfigProvider(val interface{}) (provider config.Provider, err error) {
	opt := config.Static(val)
	return config.NewYAML(opt)
}

```

### Core Architecture Module: `lunadefend/go/util/craneutil.go`
```
// Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
package util

import (
	"io/ioutil"
	"log"
	"os"
	"path"

	"github.com/google/go-containerregistry/pkg/crane"
	v1 "github.com/google/go-containerregistry/pkg/v1"
)

func LoadRuntimeLayers() (runtimeLayers []v1.Layer, err error) {
	refineryRuntimeRepo := os.Getenv("REFINERY_CONTAINER_RUNTIME_REPOSITORY")
	log.Println("Pulling Refinery container runtime from:", refineryRuntimeRepo)

	runtimeImage, err := crane.Pull(refineryRuntimeRepo)
	if err != nil {
		log.Println(err)
		return
	}

	log.Println("Getting runtime image layers...")
	return runtimeImage.Layers()
}

func LoadRuntimeLayersFromTar() (runtimeLayers []v1.Layer, err error) {
	// TODO (cthompson) add some logic for checking for "updates"
	contentRoot := os.Getenv("LUNASEC_CONTENT_ROOT")
	runtimeContainerPath := path.Join(contentRoot, "refinery-container-runtime.tar")
	img, err := crane.Load(runtimeContainerPath)
	if err != nil {
		return
	}
	return img.Layers()
}

func LoadRuntimeHandler(handlerName string) (content string, err error) {
	// TODO (cthompson) add some logic for checking for "updates"
	contentRoot := os.Getenv("LUNASEC_CONTENT_ROOT")
	runtimeHandler := path.Join(contentRoot, handlerName)
	contentBytes, err := ioutil.ReadFile(runtimeHandler)
	if err != nil {
		return
	}
	content = string(contentBytes)
	return
}

```

### Core Architecture Module: `lunadefend/go/util/crypto.go`
```
// Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
package util

import (
  "crypto/aes"
  "crypto/cipher"
  "crypto/rand"
  "crypto/sha1"
  "encoding/binary"
  "encoding/hex"
  "fmt"
  mathrand "math/rand"

  "github.com/google/uuid"
  "github.com/lunasec-io/lunasec/lunadefend/go/constants"
  "github.com/lunasec-io/lunasec/lunadefend/go/types"
  "golang.org/x/crypto/sha3"
)

const keySize = 32

var randRead = rand.Read
var hexDecodeString = hex.DecodeString
var aesNewCipher = aes.NewCipher

// Encrypt encrypts a string given a key
func Encrypt(key string, plaintext []byte) (result []byte, err error) {
  c, err := getCipher(key)

  if err != nil {
    return result, err
  }

  //Create a nonce. Nonce should be from GCM
  nonce := make([]byte, c.NonceSize())

  if _, err = randRead(nonce); err != nil {
    panic(fmt.Errorf("Unable to generate random numbers: %v", err))
  }

  return c.Seal(nonce, nonce, plaintext, nil), nil
}

// Decrypt decrypts a string given a key
func Decrypt(key string, encrypted []byte) (plaintext []byte, err error) {
  c, err := getCipher(key)

  if err != nil {
    return plaintext, err
  }

  nonceSize := c.NonceSize()
  nonce, ciphertext := encrypted[:nonceSize], encrypted[nonceSize:]

  return c.Open(nil, nonce, ciphertext, nil)
}

// Keygen generates an encryption key
func Keygen() []byte {
  bytes := make([]byte, keySize)

  // There are bigger problems if random numbers can't be generated.
  if _, err := randRead(bytes); err != nil {
    panic(err.Error())
  }

  return bytes
}

// GenToken generates a token
func GenToken() types.Token {
  return constants.TokenPrefix + types.Token(uuid.NewString())
}

// GetRandomStringOfLength ...
func GetRandomStringOfLength(length int, random *mathrand.Rand) string {
  bytes := make([]byte, length)
  // There are bigger problems if random numbers can't be generated.
  if _, err := random.Read(bytes); err != nil {
    panic(err.Error())
  }

  return hex.EncodeToString(bytes)
}

// GenerateSaltsAndKey ...
func GenerateSaltsAndKey(token types.Token, secret string) types.SaltsAndKey {
  tokenStr := string(token) + secret
  hashable := sha3.Sum512([]byte(tokenStr))
  seed := append([]byte(tokenStr), hashable[:]...)
  seedInt := binary.BigEndian.Uint64(seed)
  random := mathrand.New(mathrand.NewSource(int64(seedInt)))

  return types.SaltsAndKey{
    Sp: GetRandomStringOfLength(keySize, random),
    Sk: GetRandomStringOfLength(keySize, random),
    Kt: GetRandomStringOfLength(keySize, random),
  }
}

// GetCompositeHash ...
func GetCompositeHash(strings ...interface{}) string {
  composite := fmt.Sprint(strings...)
  hashBytes := sha3.Sum256([]byte(composite))

  return hex.EncodeToString(hashBytes[:])
}

// Sha512Sum ...
func Sha512Sum(input string) string {
  hashBytes := sha3.Sum512([]byte(input))

  return hex.EncodeToString(hashBytes[:])
}

func getCipher(keyStr string) (cipher.AEAD, error) {
  key, err := hexDecodeString(keyStr)

  if err != nil {
    return nil, err
  }

  block, err := aesNewCipher(key)

  if err != nil {
    return nil, err
  }

  return cipher.NewGCM(block)
}

func CreateSessionHash(sessionID string) string {
  shaHash := sha1.New()
  shaHash.Write([]byte(sessionID))
  return hex.EncodeToString(shaHash.Sum(nil))
}

```

### Core Architecture Module: `lunadefend/go/util/env.go`
```
// Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
package util

import "os"

func IsRunningInLambda() bool {
	return os.Getenv("LAMBDA_TASK_ROOT") != ""
}

func IsRunningTests() bool {
	return os.Getenv("LUNASEC_STACK_ENV") == "tests"
}

```

### Core Architecture Module: `lunadefend/go/util/fs.go`
```
// Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
package util

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path"
	"path/filepath"
)

func GetHomeDirectory(relativeDir string) (dir string, err error) {
	var (
		userHome string
	)

	userHome, err = os.UserHomeDir()
	if err != nil {
		return
	}

	dir = path.Join(userHome, relativeDir)
	err = os.MkdirAll(dir, 0o755)
	return
}

func CopyDirectory(scrDir, dest string) error {
	if err := CreateIfNotExists(dest, 0755); err != nil {
		return err
	}

	entries, err := ioutil.ReadDir(scrDir)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		sourcePath := filepath.Join(scrDir, entry.Name())
		destPath := filepath.Join(dest, entry.Name())

		fileInfo, err := os.Stat(sourcePath)
		if err != nil {
			return err
		}

		switch fileInfo.Mode() & os.ModeType {
		case os.ModeDir:
			if err := CreateIfNotExists(destPath, 0755); err != nil {
				return err
			}
			if err := CopyDirectory(sourcePath, destPath); err != nil {
				return err
			}
		case os.ModeSymlink:
			if err := CopySymLink(sourcePath, destPath); err != nil {
				return err
			}
		default:
			if err := Copy(sourcePath, destPath); err != nil {
				return err
			}
		}

		isSymlink := entry.Mode()&os.ModeSymlink != 0
		if !isSymlink {
			if err := os.Chmod(destPath, entry.Mode()); err != nil {
				return err
			}
		}
	}
	return nil
}

func Copy(srcFile, dstFile string) error {
	out, err := os.Create(dstFile)
	if err != nil {
		return err
	}

	defer out.Close()

	in, err := os.Open(srcFile)
	defer in.Close()
	if err != nil {
		return err
	}

	_, err = io.Copy(out, in)
	if err != nil {
		return err
	}

	return nil
}

func Exists(filePath string) bool {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return false
	}

	return true
}

func CreateIfNotExists(dir string, perm os.FileMode) error {
	if Exists(dir) {
		return nil
	}

	if err := os.MkdirAll(dir, perm); err != nil {
		return fmt.Errorf("failed to create directory: '%s', error: '%s'", dir, err.Error())
	}

	return nil
}

func CopySymLink(source, dest string) error {
	link, err := os.Readlink(source)
	if err != nil {
		return err
	}
	return os.Symlink(link, dest)
}

func ExtractTgzWithCallback(srcFile string, callback func(filename string, data []byte) (err error)) (err error) {
	f, err := os.Open(srcFile)
	if err != nil {
		return
	}
	defer f.Close()

	gzf, err := gzip.NewReader(f)
	if err != nil {
		return
	}

	tarReader := tar.NewReader(gzf)

	for true {
		var (
			header *tar.Header
		)

		header, err = tarReader.Next()

		if err == io.EOF {
			break
		}

		if err != nil {
			return
		}

		name := header.Name

		switch header.Typeflag {
		case tar.TypeReg: // = regular file
			var data []byte

			data, err = io.ReadAll(tarReader)
			if err != nil {
				return
			}

			err = callback(name, data)
			if err != nil {
				return
			}
		}
	}

	err = nil
	return
}

```

### Core Architecture Module: `lunadefend/go/util/functions.go`
```
// Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
package util

import (
  "encoding/json"
  "fmt"
  "github.com/lunasec-io/lunasec/lunadefend/go/types"
  "io/ioutil"
  "os"
)

func loadFunctionLookup(functionsPath string) (functionLookup types.FunctionLookup, err error) {
  var data []byte

  data, err = ioutil.ReadFile(functionsPath)
  if err != nil {
    fmt.Println("File reading error", err)
    return
  }

  err = json.Unmarshal(data, &functionLookup)
  if err != nil {
    fmt.Println("Error parsing rpc function lookup", err)
    return
  }
  return functionLookup, err
}

// GetFunctionConfig loads the function configuration for a given function name or a function name defined
// in an environment variable.
func GetFunctionConfig(functionsPath string, functionName string) (funcConfig types.RefineryFunction, err error) {
  var (
    ok             bool
    functionLookup types.FunctionLookup
  )

  functionLookup, err = loadFunctionLookup(functionsPath)
  if err != nil {
    return
  }

  if functionName == "" {
    functionName = os.Getenv("REFINERY_FUNCTION_NAME")
  }

  funcConfig, ok = functionLookup[functionName]
  if !ok {
    err = fmt.Errorf("unable to find function with name: %s", functionName)
  }
  return
}

```

### Core Architecture Module: `lunadefend/go/util/http.go`
```
// Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
package util

import (
  "github.com/lunasec-io/lunasec/lunadefend/go/types"
  "go.uber.org/zap"
  "net/http"
  "time"
)

func ApplyHealthCheck(sm *http.ServeMux, logger *zap.Logger) {
  sm.HandleFunc("/health", func(writer http.ResponseWriter, request *http.Request) {
    Respond(writer, map[string]string{})
  })
}

func ApplyMiddlewareToHandler(middleware []types.Middleware, handler http.HandlerFunc) http.HandlerFunc {
  for _, middlewareHandler := range middleware {
    handler = middlewareHandler(handler)
  }
  return handler
}

func AddRoutesToServer(sm *http.ServeMux, middleware []types.Middleware, routes map[string]http.HandlerFunc) {
  for path, handler := range routes {
    handler = ApplyMiddlewareToHandler(middleware, handler)
    sm.Handle(path, handler)
  }
}

// AddCookie will apply a new cookie to the response of a http request
// with the key/value specified.
func AddCookie(w http.ResponseWriter, name, value, path string, ttl time.Duration) {
  var (
    expire time.Time
  )
  if ttl != -1 {
    expire = time.Now().Add(ttl)
  }

  cookie := http.Cookie{
    Name:  name,
    Value: value,
    //TODO add expire, should be == the expire of the jwt
    Expires:  expire,
    Path:     path,
    SameSite: http.SameSiteNoneMode,
    Secure:   true,
  }
  http.SetCookie(w, &cookie)
}

```

### Core Architecture Module: `lunadefend/go/util/logging.go`
```
// Copyright 2021 by LunaSec (owned by Refinery Labs, Inc)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
package util

import (
	"go.uber.org/zap"
)

func GetLogger() (*zap.Logger, error) {
	if IsDevEnv() {
		return zap.NewDevelopment()
	}
	return zap.NewProduction()
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #549** (2022-04-19): **Fix bad Lint config and run a format**
  *Symptoms*: This PR also: - Updates the BSL date in the license - Removes extra files that were committed while moving the LunaDefend demo apps

- **Issue #459** (2022-06-04): **Make Oathkeeper frontend routes less fragile**
  *Symptoms*: Oathkeeper routes can break in certain situations because the regex could colide with a legit route

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

### Incident Patch 1: `c6bb0762` (2024-05-02)
**Commit Message**: Update BSL-LunaTrace.txt

**File**: `licenses/BSL-LunaTrace.txt` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ Additional Use Grant: Your company** may make production use of the Licensed Wor
                       files, permissions management settings, or other schemas
                       are controlled by such third parties.
 
-Change Date:          2025-05-01
+Change Date:          2024-05-01
 
 Change License:       Apache License, Version 2.0
 
```

---

### Incident Patch 2: `fc99f315` (2023-03-29)
**Commit Message**: Fix build error

**File**: `docs/blog/2023-03-29-cerebras-gpt-vs-llama-ai-model-comparison.mdx` (modified, +3/-3)
```diff
@@ -52,7 +52,7 @@ building.
 <figcaption style={{fontSize:'small', color:'grey'}}>A comparison of "one" Cerebras chip compared to an NVIDIA V100
     chip.
 </figcaption>
-<br>
+<br/>
 
 <!--truncate-->
 
@@ -97,7 +97,7 @@ strict security requirements, foreign governments, or just people that want to h
     this table on
     <a href="https://github.com/lunasec-io/lunasec/tree/master/docs/blog" target="_blank">GitHub here</a>.
 </figcaption>
-<br>
+<br/>
 It's a bit difficult to compare apples-to-apples between all of these different models, but I did my best to squeeze
 the data together in a way that made it easier to understand.
 
@@ -109,7 +109,7 @@ requires using knowledge that isn't included in the question anywhere).
 ![open your wallet discord message](/img/blog/chat-gpt-bad-math.png)
 <figcaption style={{fontSize:'small', color:'grey'}}>But even the mighty ChatGPT often can't do simple math</figcaption>
 
-<br>
+<br/>
 
 ...and then there is GPT-4 crushing everything else in this table!
 
```

---

### Incident Patch 3: `07f44d7a` (2023-03-29)
**Commit Message**: Fix more typos

**File**: `docs/blog/2023-03-29-cerebras-gpt-vs-llama-ai-model-comparison.mdx` (modified, +12/-7)
```diff
@@ -52,6 +52,7 @@ building.
 <figcaption style={{fontSize:'small', color:'grey'}}>A comparison of "one" Cerebras chip compared to an NVIDIA V100
     chip.
 </figcaption>
+<br>
 
 <!--truncate-->
 
@@ -72,8 +73,8 @@ intentionally limited how long the model was trained in order to reach a "traini
 
 That doesn't mean that it's useless though. As you'll see from the data released in the Cerebras paper, this model
 is still a welcome addition to the available Open Source models like [GPT-2 (1.5B)](https://huggingface.co/gpt2),
-[GPT-J (6B)]
-(https://huggingface.co/EleutherAI/gpt-j-6B), and [GPT NeoX (20B)](https://huggingface.co/EleutherAI/gpt-neox-20b).
+[GPT-J (6B)](https://huggingface.co/EleutherAI/gpt-j-6B), and
+[GPT NeoX (20B)](https://huggingface.co/EleutherAI/gpt-neox-20b).
 It's also possible that the model can improve with additional tweaking by the community (like fine-tuning or
 creating LORAs for it.)
 
@@ -89,12 +90,14 @@ strict security requirements, foreign governments, or just people that want to h
 | GPT-3 (175B) | 175B   | 78.9       | 81.0  | 70.2        | 75.0    | 68.8  | 51.4  | 57.6       | 60.5  | 81.0 |
 | GPT-4 (?B)   | ?      | 95.3       | -     | 87.3        | -       | -     | 96.3     | -          | -     | -    |
 | LLaMA (13B)  | 13B    | 79.2       | 80.1  | 73.0        | -       | 74.8  | 52.7  | 56.4       | 78.1  | 50.4 |
-| LLaMA (60B)  | -      | 84.2       | 82.8  | 77.0        | -       | 78.9  | 56.0  | 60.2       | 76.5  | 52.3 |
+| LLaMA (60B)  | 60B    | 84.2       | 82.8  | 77.0        | -       | 78.9  | 56.0  | 60.2       | 76.5  | 52.3 |
 | GPT-J (6B)   | 6B     | 66.1       | 76.5  | 65.3        | 69.7    | -     | -     | -          | -     | -    |
 | GPT-NeoX-20B | 20B    | -          | 77.9  | ~67.0       | 72.0    | ~72.0 | ~39.0 | ~31.0      | -     | -    |
 <figcaption style={{fontSize:'small', color:'grey'}}>If you'd like to add data for another model, you can edit
-    this table on [GitHub here](https://github.com/lunasec-io/lunasec/tree/master/docs/blog).</figcaption>
-
+    this table on
+    <a href="https://github.com/lunasec-io/lunasec/tree/master/docs/blog" target="_blank">GitHub here</a>.
+</figcaption>
+<br>
 It's a bit difficult to compare apples-to-apples between all of these different models, but I did my best to squeeze
 the data together in a way that made it easier to understand.
 
@@ -106,12 +109,14 @@ requires using knowledge that isn't included in the question anywhere).
 ![open your wallet discord message](/img/blog/chat-gpt-bad-math.png)
 <figcaption style={{fontSize:'small', color:'grey'}}>But even the mighty ChatGPT often can't do simple math</figcaption>
 
+<br>
+
 ...and then there is GPT-4 crushing everything else in this table!
 
 ## Is Cerebras-GPT worth using?
 
-Based on the data above, it's not really much better than any existing OSS models, so it's hard to say if it's a
-better choice than GPT-J or GPT NeoX for any tasks. Perhaps with some fine-tuning the model may be able to perform
+Based on the data above it's not really better than any existing OSS models so it's hard to say if it's a
+better choice than GPT-J, GPT NeoX, or other AI models for any tasks. Perhaps with some fine-tuning the model may be able to perform
 better than either of those, but I'll let somebody more qualified than me answer that question instead!
 
 ## Want to learn more?
```

---

### Incident Patch 4: `38292651` (2023-03-22)
**Commit Message**: fix vulnbot

**File**: `lunatrace/bsl/ingest-worker/pkg/vulnbot/vulnbot.go` (modified, +13/-1)
```diff
@@ -1,3 +1,14 @@
+// Copyright by LunaSec (owned by Refinery Labs, Inc)
+//
+// Licensed under the Business Source License v1.1 
+// (the "License"); you may not use this file except in compliance with the
+// License. You may obtain a copy of the License at
+//
+// https://github.com/lunasec-io/lunasec/blob/master/licenses/BSL-LunaTrace.txt
+//
+// See the License for the specific language governing permissions and
+// limitations under the License.
+//
 package vulnbot
 
 import (
@@ -79,7 +90,8 @@ func (v *vulnbot) messageHandler(ctx context.Context, info discordfx.MessageInfo
 			log.Error().Err(err).Msg("error processing message")
 			return
 		}
-		_, err = s.ChannelMessageSend(m.ChannelID, resp.Response)
+		// TODO: make this also show the intermediate steps in a collapsed box in discord (resp.IntermediateSteps). Bonus points if we can figure out how to preserve coloring
+		_, err = s.ChannelMessageSend(m.ChannelID, resp.FinalAnswer)
 		if err != nil {
 			log.Error().Err(err).Msg("error sending message")
 			return
```

---

### Incident Patch 5: `f2959c97` (2023-03-19)
**Commit Message**: fix broken import

**File**: `lunatrace/bsl/ml/python/chat_bot/tools/scrape.py` (modified, +2/-2)
```diff
@@ -15,7 +15,7 @@
 import sys
 from urllib.parse import urlparse
 
-from scrape_utils.clean_scraped_advisories import clean
+from scrape_utils.summarize_scraped import summarize
 
 # you seem to have to do this horrible stuff to import from higher local folders in python.
 # remove this once we find a better way
@@ -73,7 +73,7 @@ def _run(self, inputs: str) -> str:
 		text = self._text_from_html(page.content)
 		links = self._links_from_html(page.content)
 		text_and_links = text + " Here are the links we scraped from this page:" + str(links)
-		cleaned_text = clean(text_and_links, query)
+		cleaned_text = summarize(text_and_links, query)
 		return cleaned_text
 
 
```

---

### Incident Patch 6: `ea39bfbc` (2023-03-19)
**Commit Message**: fix some broken changes that came in

**File**: `.idea/lunasec-monorepo.iml` (modified, +2/-2)
```diff
@@ -75,7 +75,7 @@
       <excludeFolder url="file://$MODULE_DIR$/lunatrace/bsl/ingest-worker/vulns" />
     </content>
     <content url="file://$MODULE_DIR$/lunatrace/bsl/backend/api/node_modules" />
-    <orderEntry type="jdk" jdkName="Pipenv (lunasec)" jdkType="Python SDK" />
+    <orderEntry type="inheritedJdk" />
     <orderEntry type="sourceFolder" forTests="false" />
   </component>
-</module>
\ No newline at end of file
+</module>
```

**File**: `.idea/misc.xml` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@
     <option name="enabled" value="true" />
     <option name="wasEnabledAtLeastOnce" value="true" />
   </component>
-  <component name="ProjectRootManager" version="2" languageLevel="JDK_10" project-jdk-name="Pipenv (lunasec)" project-jdk-type="Python SDK">
+  <component name="ProjectRootManager" version="2" languageLevel="JDK_10" project-jdk-name="Python 3.10 (2)" project-jdk-type="Python SDK">
     <output url="file://$PROJECT_DIR$/out" />
   </component>
   <component name="ProjectType">
@@ -20,4 +20,4 @@
   <component name="WebPackConfiguration">
     <option name="mode" value="DISABLED" />
   </component>
-</project>
\ No newline at end of file
+</project>
```

**File**: `lunatrace/bsl/ml/python/chat_bot/tools/scrape.py` (modified, +2/-3)
```diff
@@ -15,7 +15,7 @@
 import sys
 from urllib.parse import urlparse
 
-from scrape_utils.clean_scraped_advisories import clean
+from scrape_utils.summarize_scraped import summarize
 
 # you seem to have to do this horrible stuff to import from higher local folders in python.
 # remove this once we find a better way
@@ -65,15 +65,14 @@ def validate_environment(cls, values: Dict) -> Dict:
 	def _run(self, inputs: str) -> str:
 		"""Run query through GoogleSearch and parse result."""
 		# return self._google_serper_search_results(query, gl=self.gl, hl=self.hl)
-
 		url, query = json.loads(inputs)
 		page = requests.get(url)
 		if "text/html" not in page.headers["content-type"]:
 			return "This isn't a normal html page, try a different page"
 		text = self._text_from_html(page.content)
 		links = self._links_from_html(page.content)
 		text_and_links = text + " Here are the links we scraped from this page:" + str(links)
-		cleaned_text = clean(text_and_links, query)
+		cleaned_text = summarize(text_and_links, query)
 		return cleaned_text
 
 
```

**File**: `lunatrace/bsl/ml/python/scrape_utils/summarize_scraped.py` (modified, +1/-2)
```diff
@@ -68,13 +68,12 @@ def run_llm(page_content, existing_body, query):
 	return raw_result
 
 def summarize(page_content, query):
-
 	content_splitter = TokenTextSplitter(chunk_size=2200, chunk_overlap=40)
 	split_content = content_splitter.split_text(page_content)
 	if (len(split_content)) > 8:
 		return "This page is too long to read quickly, try something else."
 	existing_body = " "
-	print("split page content into chunks: " + str(len(split_content)))
+	print("\nsplit page content into chunks: " + str(len(split_content)))
 	for content in split_content:
 		existing_body = existing_body + run_llm(content, existing_body, query)
 
```

**File**: `lunatrace/bsl/proto/langchain.proto` (modified, +14/-13)
```diff
@@ -4,8 +4,8 @@ package langchain;
 option go_package = "./gen";
 
 service LangChain {
-  rpc Summarize(SummarizeRequest) returns (SummarizeResponse);
-  rpc CleanWebpage(CleanWebpageRequest) returns (CleanWebpageResponse);
+//  rpc Summarize(SummarizeRequest) returns (SummarizeResponse);
+  rpc CleanAdvisory(CleanAdvisoryRequest) returns (CleanAdvisoryResponse);
   rpc Chat(ChatRequest) returns (ChatResponse);
 }
 
@@ -14,23 +14,24 @@ message ChatRequest {
 }
 
 message ChatResponse {
-  string response = 1;
+  string finalAnswer = 1;
+  string intermediateSteps = 2;
 }
 
-message CleanWebpageRequest {
+message CleanAdvisoryRequest {
   string content = 1;
   string description = 2;
 }
 
-message CleanWebpageResponse {
+message CleanAdvisoryResponse {
   string content = 1;
 }
 
-message SummarizeRequest {
-  string content = 1;
-  string query = 2;
-}
-
-message SummarizeResponse {
-  string summary = 1;
-}
+//message SummarizeRequest {
+//  string content = 1;
+//  string query = 2;
+//}
+//
+//message SummarizeResponse {
+//  string summary = 1;
+//}
```

---

### Incident Patch 7: `a54e6637` (2023-03-17)
**Commit Message**: update tmuxp

**File**: `lunatrace/bsl/ml/python/.gitignore` (modified, +1/-0)
```diff
@@ -65,3 +65,4 @@ target/
 
 # pyenv
 .python-version
+.env
```

**File**: `lunatrace/dev-cli/src/cli.ts` (modified, +2/-2)
```diff
@@ -33,15 +33,15 @@ import {
   generateCommon,
   generateLogger,
   goQueueHandler,
-  hasura,
+  hasura, pythonGrpc,
   queueWorker,
   smeeWebhook,
 } from './services';
 import { tmuxpConfig, tmuxWindow } from './tmux';
 
 const servicesWindow = tmuxWindow('services', [hasura, frontend, dockerCompose]);
 
-const workerWindow = tmuxWindow('workers', [queueWorker, goQueueHandler]);
+const workerWindow = tmuxWindow('workers', [queueWorker, goQueueHandler, pythonGrpc]);
 
 const backendWindow = tmuxWindow('backend', [smeeWebhook, backend]);
 
```

**File**: `lunatrace/dev-cli/src/services.ts` (modified, +2/-0)
```diff
@@ -48,3 +48,5 @@ export const generateCommon = tmuxPane([`cd common`, `yarn start`]);
 export const generateLogger = tmuxPane([`cd logger`, `yarn start`]);
 
 export const goQueueHandler = tmuxPane([`cd ingest-worker`, `${goQueueHandlerEnv} air`]);
+
+export const pythonGrpc = tmuxPane([`cd ml`, `uvicorn --reload server:app --port 3000`]);
```

---

### Incident Patch 8: `3904df31` (2023-02-23)
**Commit Message**: Merge pull request #1138 from lunasec-io/css-blog-post

Blog post about CSSStyleSheet API

**File**: `docs/blog/2023-02-22-css-style-sheets.mdx` (added, +217/-0)
```diff
@@ -0,0 +1,217 @@
+---
+title: "Use the CSSStyleSheets API in a React App"
+description: "How to use the new CSSStyleSheet JS API in your create-react-app application, for dynamic loading and unloading of CSS in JS"
+slug: css-style-sheets
+date: 2023-02-22T07:00:00.000Z
+keywords: [react, cssstylesheets,css]
+tags: [web]
+authors: [forrest]
+---
+
+<!--
+  ~ Copyright by LunaSec (owned by Refinery Labs, Inc)
+  ~
+  ~ Licensed under the Creative Commons Attribution-ShareAlike 4.0 International
+  ~ (the "License"); you may not use this file except in compliance with the
+  ~ License. You may obtain a copy of the License at
+  ~
+  ~ https://creativecommons.org/licenses/by-sa/4.0/legalcode
+  ~
+  ~ See the License for the specific language governing permissions and
+  ~ limitations under the License.
+  ~
+-->
+There's a shiny new web feature in browser town, and it's called [CSSStyleSheets](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet).
+
+### What is CSSStyleSheets?
+
+CSSStyleSheets allows you to manipulate page styling without having to load CSS anywhere in the HTML of the page.
+
+With CSSStyleSheets you can do things like:
+
+```js
+const sheet = new CSSStyleSheet();
+// Apply a rule to the sheet
+sheet.replaceSync("a { color: red; }");
+// disable the sheet to remove it from the DOM
+sheet.disabled = true;
+```
+
+Neat. Support just became widespread, with adoption by Chrome, Safari, Firefox, etc [added in the last](https://caniuse.com/mdn-api_cssstylesheet) year (as of early 2023).
+
+<!--truncate-->
+
+### The Old Way
+Whether you noticed it or not, your current css framework is almost certainly creating a
+`<link href="example.css" rel="stylesheet">` in the HTML of the page or setting style attributes directly on page elements. Up until recently that was the only way to do it.
+
+This works fine but it has a few disadvantages in certain cases. It doesn't play as nicely with dynamic usage, whether that's developer experience as you change files
+or just switching sheets on and off on the fly.
+
+Traditional CSS loading isn't going away any time soon, but the new CSSStyleSheet is great to have in your toolbelt.
+
+### Why we wanted to use CSSStyleSheets
+
+Our app, [LunaTrace](https://lunatrace.lunasec.io), has both a dark mode and a light mode. We compile two different stylesheets,
+a `dark.css` and a `light.css`.
+
+Previously we simply had a `<link href="dark.css"...` as above and, when we wanted to change to a light theme,
+we reached into the DOM to modify the element to reference `light.css`. This worked ok but it was a little bit slow (the page flashed, not the end of the world), but it was a painfully slow developer experience. We had a separate watcher script from our main `react-scripts` that watched our SCSS files and recompiled them, and then the page would reload after
+10 or 15 seconds. That was just a little too slow for making fast changes to the CSS, and the full page reload was very painful for a developer spoiled by Hot Module Reloading.
+
+:::note
+There are probably other ways to switch out styles for a page between a light and a dark mode rather than using the CssStyleSheet API, like a traditional class based selector. This is just one option and it was a good way for us to learn about the new API.
+:::
+
+### What is CSS-in-JS?
+
+CSS-in-JS is when you put JS in charge of loading styles into the DOM. It does have pros and cons (that we won't get into), but the developer experience is great and it's much faster.
+
+We could do `require 'dark.scss'` at the top of one of our TSX files and Create React App's webpack config would take care of the rest.
+
+The only problem is: there is no way to _unload_ a global style you've loaded. For LunaTrace, we need to switch between dark and light themes, so that's a problem.
+
+CSS-in-JS was incapable of doing something the DOM has been able to do for decades: unload something.
+
+#### Manipulating a stylesheet with document.styleSheets
+If we want to say, turn a stylesheet off, one way to get a reference to it is by the `document.styleSheets` property. This function can find a stylesheet
+and return a CssStyleSheet object which we can manipulate directly.
+
+```ts
+function getStyleSheet(unique_title: string): CssStyleSheet {
+  for (const sheet of document.styleSheets) {
+    if (sheet.title === unique_title) {
+      return sheet;
+    }
+  }
+}
+```
+
+I couldn't figure out how to set the title of a stylesheet I was inserting with webpack (from `style-loader`) or find another way to tell which stylesheet was which, so this wasn't enough for me.
+
+In hindsight, it might be possible to use the CSSStyleSheet API to look for some special rule you know will be there, or make a dummy rule for that purpose. I didn't try that.
+
+Anyway, maybe this is enough to accomplish your goal. If not, and you'd like to import a CssStyleSheet object directly via webpack, read on.
+
+### Injecting a CSSStyleSheet directly into JS
+
+The 
```

**File**: `lunatrace/bsl/backend/tsconfig.json` (modified, +1/-8)
```diff
@@ -17,7 +17,7 @@
     "strict": true /* Enable all strict type-checking options. */,
     "esModuleInterop": true,  /* Enables emit interoperability between CommonJS and ES Modules via creation of namespace objects for all imports. Implies 'allowSyntheticDefaultImports'. */
     "resolveJsonModule": true /* Include modules imported with .json extension. */,
-    "skipLibCheck": true, // todo: This may be a bit dangerous but it fixes a bug from duplicate types 
+    "skipLibCheck": true, // todo: This may be a bit dangerous but it fixes a bug from duplicate types
     "forceConsistentCasingInFileNames": true,
     "allowJs": true,
 
@@ -51,13 +51,6 @@
     "src/__tests__",
     "./src/**/*",
   ],
-
-  "exclude": [
-    "node_modules",
-    "typings",
-    "../../../node_modules"
-  ]
-,
   "references": [
     {"path": "../common"},
     {"path": "../logger"}
```

---

### Incident Patch 9: `1d4923f0` (2023-02-23)
**Commit Message**: fix the tsconfig to not have extra junk

**File**: `lunatrace/bsl/backend/tsconfig.json` (modified, +1/-8)
```diff
@@ -17,7 +17,7 @@
     "strict": true /* Enable all strict type-checking options. */,
     "esModuleInterop": true,  /* Enables emit interoperability between CommonJS and ES Modules via creation of namespace objects for all imports. Implies 'allowSyntheticDefaultImports'. */
     "resolveJsonModule": true /* Include modules imported with .json extension. */,
-    "skipLibCheck": true, // todo: This may be a bit dangerous but it fixes a bug from duplicate types 
+    "skipLibCheck": true, // todo: This may be a bit dangerous but it fixes a bug from duplicate types
     "forceConsistentCasingInFileNames": true,
     "allowJs": true,
 
@@ -51,13 +51,6 @@
     "src/__tests__",
     "./src/**/*",
   ],
-
-  "exclude": [
-    "node_modules",
-    "typings",
-    "../../../node_modules"
-  ]
-,
   "references": [
     {"path": "../common"},
     {"path": "../logger"}
```

---

### Incident Patch 10: `da5ceefa` (2023-02-23)
**Commit Message**: Merge branch 'css-blog-post' of github.com:lunasec-io/lunasec into css-blog-post

**File**: `docs/blog/2023-02-22-css-style-sheets.mdx` (modified, +58/-38)
```diff
@@ -22,88 +22,103 @@ authors: [forrest]
   ~
 -->
 There's a shiny new web feature in browser town, and it's called [CSSStyleSheets](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet).
- It allows us to manipulate page styling without having to load
-css anywhere into the HTML of the page. With it you can do things like
+
+### What is CSSStyleSheets?
+
+CSSStyleSheets allows you to manipulate page styling without having to load CSS anywhere in the HTML of the page.
+
+With CSSStyleSheets you can do things like:
+
 ```js
 const sheet = new CSSStyleSheet();
 // Apply a rule to the sheet
 sheet.replaceSync("a { color: red; }");
 // disable the sheet to remove it from the DOM
 sheet.disabled = true;
 ```
-Neat. Support just became widespread, with adoption by Chrome, Safari, Firefox, etc [added in the last](https://caniuse.com/mdn-api_cssstylesheet) year as of early 2023.
+
+Neat. Support just became widespread, with adoption by Chrome, Safari, Firefox, etc [added in the last](https://caniuse.com/mdn-api_cssstylesheet) year (as of early 2023).
 
 <!--truncate-->
 
-#### The old way
+### The Old Way
 Whether you noticed it or not, your current css framework is almost certainly creating a
-`<link href="example.css" rel="stylesheet">` in the HTML of the page, or setting style attributes directly on page elements. Up until recently, that was the only way to do it.
+`<link href="example.css" rel="stylesheet">` in the HTML of the page or setting style attributes directly on page elements. Up until recently that was the only way to do it.
 
-This works fine but it has a few disadvantages in certain cases. It doesn't play as nicely with dynamic usage, whether that's developer experience as you change files,
-or maybe switching sheets on and off on the fly. Traditional CSS loading isn't going away any time soon, but the new CSSStyleSheet is great to have in your toolbelt.
+This works fine but it has a few disadvantages in certain cases. It doesn't play as nicely with dynamic usage, whether that's developer experience as you change files
+or just switching sheets on and off on the fly.
+
+Traditional CSS loading isn't going away any time soon, but the new CSSStyleSheet is great to have in your toolbelt.
 
 ### Why we wanted to use CSSStyleSheets
+
 Our app, [LunaTrace](https://lunatrace.lunasec.io), has both a dark mode and a light mode. We compile two different stylesheets,
-a `dark.css` and a `light.css`. Previously, we simply had a `<link href="dark.css"...` as above, and when we wanted to change to a light theme,
-we reached into the DOM and modified the element to link to `light.css`. This worked ok but it was just a little bit slow (the page flashed, not the end of the world)
-and it was a painfully slow developer experience. We had a separate watcher script from our main react-scripts that watched our scss files and recompiled them, and then the page would reload after
+a `dark.css` and a `light.css`. 
+
+Previously we simply had a `<link href="dark.css"...` as above and, when we wanted to change to a light theme,
+we reached into the DOM to modify the element to reference `light.css`. This worked ok but it was a little bit slow (the page flashed, not the end of the world), but it was a painfully slow developer experience. We had a separate watcher script from our main `react-scripts` that watched our SCSS files and recompiled them, and then the page would reload after
 10 or 15 seconds. That was just a little too slow for making fast changes to the CSS, and the full page reload was very painful for a developer spoiled by Hot Module Reloading.
 
 :::note
-There are probably other ways to switch out styles for a page between a light and a dark mode rather than using the CssStyleSheet API, like a traditional class based selector. This is just one option and a good way for us to learn about the new API.
+There are probably other ways to switch out styles for a page between a light and a dark mode rather than using the CssStyleSheet API, like a traditional class based selector. This is just one option and it was a good way for us to learn about the new API.
 :::
 
-#### Switch to CSS in JS
-Css in JS is when you put JS in charge of loading styles into the DOM. It does have pros and cons that I won't go into, but the developer experience is great. Much faster.
+### What is CSS-in-JS?
+
+CSS-in-JS is when you put JS in charge of loading styles into the DOM. It does have pros and cons (that we won't get into), but the developer experience is great and it's much faster.
 
-We could do `require 'dark.scss'` at the top of one of our TSX files, and Create React App's webpack config would take care of the rest.
+We could do `require 'dark.scss'` at the top of one of our TSX files and Create React App's webpack config would take care of the rest.
 
-Only problem is, there is no way to _unload_ a global style you've loaded. For LunaTrace, we need to switch between dark and light themes, so that's a problem.
-CSS in
```

---

### Incident Patch 11: `675c9489` (2023-02-23)
**Commit Message**: Merge remote-tracking branch 'origin/master' into css-blog-post

**File**: `.pnp.loader.mjs` (removed, +0/-273)
```diff
@@ -1,273 +0,0 @@
-import { URL, fileURLToPath, pathToFileURL } from 'url';
-import fs from 'fs';
-import path from 'path';
-import moduleExports, { Module } from 'module';
-
-var PathType;
-(function(PathType2) {
-  PathType2[PathType2["File"] = 0] = "File";
-  PathType2[PathType2["Portable"] = 1] = "Portable";
-  PathType2[PathType2["Native"] = 2] = "Native";
-})(PathType || (PathType = {}));
-const npath = Object.create(path);
-const ppath = Object.create(path.posix);
-npath.cwd = () => process.cwd();
-ppath.cwd = () => toPortablePath(process.cwd());
-ppath.resolve = (...segments) => {
-  if (segments.length > 0 && ppath.isAbsolute(segments[0])) {
-    return path.posix.resolve(...segments);
-  } else {
-    return path.posix.resolve(ppath.cwd(), ...segments);
-  }
-};
-const contains = function(pathUtils, from, to) {
-  from = pathUtils.normalize(from);
-  to = pathUtils.normalize(to);
-  if (from === to)
-    return `.`;
-  if (!from.endsWith(pathUtils.sep))
-    from = from + pathUtils.sep;
-  if (to.startsWith(from)) {
-    return to.slice(from.length);
-  } else {
-    return null;
-  }
-};
-npath.fromPortablePath = fromPortablePath;
-npath.toPortablePath = toPortablePath;
-npath.contains = (from, to) => contains(npath, from, to);
-ppath.contains = (from, to) => contains(ppath, from, to);
-const WINDOWS_PATH_REGEXP = /^([a-zA-Z]:.*)$/;
-const UNC_WINDOWS_PATH_REGEXP = /^\/\/(\.\/)?(.*)$/;
-const PORTABLE_PATH_REGEXP = /^\/([a-zA-Z]:.*)$/;
-const UNC_PORTABLE_PATH_REGEXP = /^\/unc\/(\.dot\/)?(.*)$/;
-function fromPortablePath(p) {
-  if (process.platform !== `win32`)
-    return p;
-  let portablePathMatch, uncPortablePathMatch;
-  if (portablePathMatch = p.match(PORTABLE_PATH_REGEXP))
-    p = portablePathMatch[1];
-  else if (uncPortablePathMatch = p.match(UNC_PORTABLE_PATH_REGEXP))
-    p = `\\\\${uncPortablePathMatch[1] ? `.\\` : ``}${uncPortablePathMatch[2]}`;
-  else
-    return p;
-  return p.replace(/\//g, `\\`);
-}
-function toPortablePath(p) {
-  if (process.platform !== `win32`)
-    return p;
-  p = p.replace(/\\/g, `/`);
-  let windowsPathMatch, uncWindowsPathMatch;
-  if (windowsPathMatch = p.match(WINDOWS_PATH_REGEXP))
-    p = `/${windowsPathMatch[1]}`;
-  else if (uncWindowsPathMatch = p.match(UNC_WINDOWS_PATH_REGEXP))
-    p = `/unc/${uncWindowsPathMatch[1] ? `.dot/` : ``}${uncWindowsPathMatch[2]}`;
-  return p;
-}
-
-const builtinModules = new Set(Module.builtinModules || Object.keys(process.binding(`natives`)));
-const isBuiltinModule = (request) => request.startsWith(`node:`) || builtinModules.has(request);
-function readPackageScope(checkPath) {
-  const rootSeparatorIndex = checkPath.indexOf(npath.sep);
-  let separatorIndex;
-  do {
-    separatorIndex = checkPath.lastIndexOf(npath.sep);
-    checkPath = checkPath.slice(0, separatorIndex);
-    if (checkPath.endsWith(`${npath.sep}node_modules`))
-      return false;
-    const pjson = readPackage(checkPath + npath.sep);
-    if (pjson) {
-      return {
-        data: pjson,
-        path: checkPath
-      };
-    }
-  } while (separatorIndex > rootSeparatorIndex);
-  return false;
-}
-function readPackage(requestPath) {
-  const jsonPath = npath.resolve(requestPath, `package.json`);
-  if (!fs.existsSync(jsonPath))
-    return null;
-  return JSON.parse(fs.readFileSync(jsonPath, `utf8`));
-}
-
-async function tryReadFile(path2) {
-  try {
-    return await fs.promises.readFile(path2, `utf8`);
-  } catch (error) {
-    if (error.code === `ENOENT`)
-      return null;
-    throw error;
-  }
-}
-function tryParseURL(str, base) {
-  try {
-    return new URL(str, base);
-  } catch {
-    return null;
-  }
-}
-let entrypointPath = null;
-function setEntrypointPath(file) {
-  entrypointPath = file;
-}
-function getFileFormat(filepath) {
-  var _a, _b;
-  const ext = path.extname(filepath);
-  switch (ext) {
-    case `.mjs`: {
-      return `module`;
-    }
-    case `.cjs`: {
-      return `commonjs`;
-    }
-    case `.wasm`: {
-      throw new Error(`Unknown file extension ".wasm" for ${filepath}`);
-    }
-    case `.json`: {
-      throw new Error(`Unknown file extension ".json" for ${filepath}`);
-    }
-    case `.js`: {
-      const pkg = readPackageScope(filepath);
-      if (!pkg)
-        return `commonjs`;
-      return (_a = pkg.data.type) != null ? _a : `commonjs`;
-    }
-    default: {
-      if (entrypointPath !== filepath)
-        return null;
-      const pkg = readPackageScope(filepath);
-      if (!pkg)
-        return `commonjs`;
-      if (pkg.data.type === `module`)
-        return null;
-      return (_b = pkg.data.type) != null ? _b : `commonjs`;
-    }
-  }
-}
-
-async function getFormat$1(resolved, context, defaultGetFormat) {
-  const url = tryParseURL(resolved);
-  if ((url == null ? void 0 : url.protocol) !== `file:`)
-    return defaultGetFormat(resolved, context, defaultGetFormat);
-  const format = getFileFormat(fileURLToPath(url));
-  if (format) {
-    return {
-      format
-    };
-  }
-  retu
```

**File**: `.yarnrc.yml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ logFilters:
 
 nmHoistingLimits: none
 
-nodeLinker: pnp
+nodeLinker: node-modules
 
 packageExtensions:
   "@aws-cdk/aws-lambda-nodejs@^1.138.1":
```

**File**: `go.mod` (modified, +28/-12)
```diff
@@ -7,11 +7,15 @@ go 1.18
 replace github.com/Khan/genqlient => github.com/ajvpot/genqlient v0.4.1-0.20220601222338-9a6fa43de94e
 
 require (
+	github.com/JohannesKaufmann/html-to-markdown v1.3.6
 	github.com/Joker/jade v1.1.3
 	github.com/Khan/genqlient v0.4.0
 	github.com/adrg/xdg v0.4.0
+	github.com/advancedlogic/GoOse v0.0.0-20210820140952-9d5822d4a625
 	github.com/ajvpot/clifx v0.0.0-20220628211936-9cd4c559b7a3
+	github.com/anchore/go-logger v0.0.0-20220728155337-03b66a5207d8
 	github.com/anchore/grype v0.54.0
+	github.com/anchore/sqlite v1.4.6-0.20220607210448-bcc6ee5c4963
 	github.com/anchore/stereoscope v0.0.0-20221208011002-c5ff155d72f1
 	github.com/anchore/syft v0.63.0
 	github.com/apex/gateway v1.1.2
@@ -27,16 +31,18 @@ require (
 	github.com/go-co-op/gocron v1.17.0
 	github.com/go-git/go-git/v5 v5.4.2
 	github.com/go-jet/jet/v2 v2.9.0
+	github.com/go-shiori/go-readability v0.0.0-20220215145315-dd6828d2f09b
 	github.com/google/go-containerregistry v0.11.0
 	github.com/google/licensecheck v0.3.1
 	github.com/google/uuid v1.3.0
 	github.com/lib/pq v1.10.7
 	github.com/lor00x/goldap v0.0.0-20180618054307-a546dffdd1a3
+	github.com/mozillazg/go-slugify v0.2.0
 	github.com/pkg/errors v0.9.1
 	github.com/prashantv/gostub v1.1.0
 	github.com/prometheus/procfs v0.8.0
 	github.com/rs/cors v1.8.2
-	github.com/rs/zerolog v1.27.0
+	github.com/rs/zerolog v1.29.0
 	github.com/samber/lo v1.32.0
 	github.com/schollz/progressbar/v3 v3.8.6
 	github.com/spf13/viper v1.13.0
@@ -53,6 +59,7 @@ require (
 	golang.org/x/exp v0.0.0-20220823124025-807a23277127
 	gopkg.in/square/go-jose.v2 v2.6.0
 	gopkg.in/yaml.v3 v3.0.1
+	gorm.io/gorm v1.23.5
 )
 
 require (
@@ -74,18 +81,19 @@ require (
 	github.com/Masterminds/sprig/v3 v3.2.2 // indirect
 	github.com/Microsoft/go-winio v0.5.2 // indirect
 	github.com/ProtonMail/go-crypto v0.0.0-20220824120805-4b6e5c587895 // indirect
+	github.com/PuerkitoBio/goquery v1.8.0 // indirect
 	github.com/ThalesIgnite/crypto11 v1.2.5 // indirect
 	github.com/acobaugh/osrelease v0.1.0 // indirect
 	github.com/acomagu/bufpipe v1.0.3 // indirect
 	github.com/agnivade/levenshtein v1.1.1 // indirect
 	github.com/alexflint/go-arg v1.4.2 // indirect
 	github.com/alexflint/go-scalar v1.0.0 // indirect
-	github.com/anchore/go-logger v0.0.0-20220728155337-03b66a5207d8 // indirect
 	github.com/anchore/go-macholibre v0.0.0-20220308212642-53e6d0aaf6fb // indirect
 	github.com/anchore/go-version v1.2.2-0.20210903204242-51efa5b487c4 // indirect
 	github.com/anchore/packageurl-go v0.1.1-0.20220428202044-a072fa3cb6d7 // indirect
-	github.com/anchore/sqlite v1.4.6-0.20220607210448-bcc6ee5c4963 // indirect
 	github.com/andybalholm/brotli v1.0.4 // indirect
+	github.com/andybalholm/cascadia v1.3.1 // indirect
+	github.com/araddon/dateparse v0.0.0-20210429162001-6b43995a97de // indirect
 	github.com/asaskevich/govalidator v0.0.0-20210307081110-f21760c49a8d // indirect
 	github.com/aws/aws-sdk-go-v2 v1.16.16 // indirect
 	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.4.3 // indirect
@@ -139,9 +147,11 @@ require (
 	github.com/emirpasic/gods v1.12.0 // indirect
 	github.com/envoyproxy/go-control-plane v0.10.3 // indirect
 	github.com/envoyproxy/protoc-gen-validate v0.6.7 // indirect
+	github.com/fatih/set v0.2.1 // indirect
 	github.com/fsnotify/fsnotify v1.5.4 // indirect
 	github.com/fullstorydev/grpcurl v1.8.7 // indirect
 	github.com/gabriel-vasile/mimetype v1.4.0 // indirect
+	github.com/gigawattio/window v0.0.0-20180317192513-0f5467e35573 // indirect
 	github.com/gin-contrib/sse v0.1.0 // indirect
 	github.com/go-chi/chi v4.1.2+incompatible // indirect
 	github.com/go-git/gcfg v1.5.0 // indirect
@@ -162,9 +172,12 @@ require (
 	github.com/go-playground/universal-translator v0.18.0 // indirect
 	github.com/go-playground/validator/v10 v10.11.1 // indirect
 	github.com/go-restruct/restruct v1.2.0-alpha // indirect
+	github.com/go-resty/resty/v2 v2.7.0 // indirect
+	github.com/go-shiori/dom v0.0.0-20210627111528-4e4722cd0d65 // indirect
 	github.com/go-test/deep v1.0.8 // indirect
 	github.com/goccy/go-json v0.9.11 // indirect
 	github.com/gogo/protobuf v1.3.2 // indirect
+	github.com/gogs/chardet v0.0.0-20211120154057-b7413eaefb8f // indirect
 	github.com/golang-jwt/jwt v3.2.2+incompatible // indirect
 	github.com/golang-jwt/jwt/v4 v4.4.2 // indirect
 	github.com/golang/glog v1.0.0 // indirect
@@ -207,12 +220,13 @@ require (
 	github.com/jackc/pgpassfile v1.0.0 // indirect
 	github.com/jackc/pgproto3/v2 v2.3.0 // indirect
 	github.com/jackc/pgservicefile v0.0.0-20200714003250-2b9c44734f2b // indirect
+	github.com/jaytaylor/html2text v0.0.0-20211105163654-bc68cce691ba // indirect
 	github.com/jbenet/go-context v0.0.0-20150711004518-d14ea06fba99 // indirect
 	github.com/jedisct1/go-minisign v0.0.0-20211028175153-1c139d1cc84b // indirect
 	github.com/jhump/protoreflect v1.13.0 // indirect
 	github.com/jinzhu/copier v0.3.2 // indirect
 	github.com/jinzhu/inflection v1.0.0 // indirect
-	github.com/jinzhu/now
```

**File**: `go.sum` (modified, +70/-17)
```diff
@@ -201,6 +201,8 @@ github.com/Djarvur/go-err113 v0.0.0-20210108212216-aea10b59be24/go.mod h1:4UJr5H
 github.com/GoogleCloudPlatform/cloudsql-proxy v0.0.0-20191009163259-e802c2cb94ae/go.mod h1:mjwGPas4yKduTyubHvD1Atl9r1rUq8DfVy+gkVvZ+oo=
 github.com/GoogleCloudPlatform/cloudsql-proxy v1.31.2/go.mod h1:qR6jVnZTKDCW3j+fC9mOEPHm++1nKDMkqbbkD6KNsfo=
 github.com/GoogleCloudPlatform/docker-credential-gcr v2.0.5+incompatible/go.mod h1:BB1eHdMLYEFuFdBlRMb0N7YGVdM5s6Pt0njxgvfbGGs=
+github.com/JohannesKaufmann/html-to-markdown v1.3.6 h1:i3Ma4RmIU97gqArbxZXbFqbWKm7XtImlMwVNUouQ7Is=
+github.com/JohannesKaufmann/html-to-markdown v1.3.6/go.mod h1:Ol3Jv/xw8jt8qsaLeSh/6DBBw4ZBJrTqrOu3wbbUUg8=
 github.com/Joker/hpp v1.0.0 h1:65+iuJYdRXv/XyN62C1uEmmOx3432rNG/rKlX6V7Kkc=
 github.com/Joker/hpp v1.0.0/go.mod h1:8x5n+M1Hp5hC0g8okX3sR3vFQwynaX/UgSOM9MeBKzY=
 github.com/Joker/jade v1.1.3 h1:Qbeh12Vq6BxURXT1qZBRHsDxeURB8ztcL6f3EXSGeHk=
@@ -251,6 +253,9 @@ github.com/OpenPeeDeeP/depguard v1.0.1/go.mod h1:xsIw86fROiiwelg+jB2uM9PiKihMMmU
 github.com/ProtonMail/go-crypto v0.0.0-20210428141323-04723f9f07d7/go.mod h1:z4/9nQmJSSwwds7ejkxaJwO37dru3geImFUdJlaLzQo=
 github.com/ProtonMail/go-crypto v0.0.0-20220824120805-4b6e5c587895 h1:NsReiLpErIPzRrnogAXYwSoU7txA977LjDGrbkewJbg=
 github.com/ProtonMail/go-crypto v0.0.0-20220824120805-4b6e5c587895/go.mod h1:UBYPn8k0D56RtnR8RFQMjmh4KrZzWJ5o7Z9SYjossQ8=
+github.com/PuerkitoBio/goquery v1.4.1/go.mod h1:T9ezsOHcCrDCgA8aF1Cqr3sSYbO/xgdy8/R/XiIMAhA=
+github.com/PuerkitoBio/goquery v1.8.0 h1:PJTF7AmFCFKk1N6V6jmKfrNH9tV5pNE6lZMkG0gta/U=
+github.com/PuerkitoBio/goquery v1.8.0/go.mod h1:ypIiRMtY7COPGk+I/YbZLbxsxn9g5ejnI2HSMtkjZvI=
 github.com/PuerkitoBio/purell v1.0.0/go.mod h1:c11w/QuzBsJSee3cPx9rAFu61PvFxuPbtSwDGJws/X0=
 github.com/PuerkitoBio/purell v1.1.1/go.mod h1:c11w/QuzBsJSee3cPx9rAFu61PvFxuPbtSwDGJws/X0=
 github.com/PuerkitoBio/urlesc v0.0.0-20160726150825-5bd2802263f2/go.mod h1:uGdkoq3SwY9Y+13GIhn11/XLaGBb4BfwItxLd5jeuXE=
@@ -269,6 +274,8 @@ github.com/acomagu/bufpipe v1.0.3 h1:fxAGrHZTgQ9w5QqVItgzwj235/uYZYgbXitB+dLupOk
 github.com/acomagu/bufpipe v1.0.3/go.mod h1:mxdxdup/WdsKVreO5GpW4+M/1CE2sMG4jeGJ2sYmHc4=
 github.com/adrg/xdg v0.4.0 h1:RzRqFcjH4nE5C6oTAxhBtoE2IRyjBSa62SCbyPidvls=
 github.com/adrg/xdg v0.4.0/go.mod h1:N6ag73EX4wyxeaoeHctc1mas01KZgsj5tYiAIwqJE/E=
+github.com/advancedlogic/GoOse v0.0.0-20210820140952-9d5822d4a625 h1:LZIP5Bj5poWWRZ8fcL4ZwCupb4FwcTFK2RCTxkGnCX8=
+github.com/advancedlogic/GoOse v0.0.0-20210820140952-9d5822d4a625/go.mod h1:f3HCSN1fBWjcpGtXyM119MJgeQl838v6so/PQOqvE1w=
 github.com/afex/hystrix-go v0.0.0-20180502004556-fa1af6a1f4f5/go.mod h1:SkGFH1ia65gfNATL8TAiHDNxPzPdmEL5uirI2Uyuz6c=
 github.com/agnivade/levenshtein v1.0.1/go.mod h1:CURSv5d9Uaml+FovSIICkLbAUZ9S4RqaHDIsdSBg7lM=
 github.com/agnivade/levenshtein v1.1.0/go.mod h1:veldBMzWxcCG2ZvUTKD2kJNRdCk5hVbJomOvKkmgYbo=
@@ -320,6 +327,10 @@ github.com/andybalholm/brotli v1.0.2/go.mod h1:loMXtMfwqflxFJPmdbJO0a3KNoPuLBgiu
 github.com/andybalholm/brotli v1.0.3/go.mod h1:fO7iG3H7G2nSZ7m0zPUDn85XEX2GTukHGRSepvi9Eig=
 github.com/andybalholm/brotli v1.0.4 h1:V7DdXeJtZscaqfNuAdSRuRFzuiKlHSC/Zh3zl9qY3JY=
 github.com/andybalholm/brotli v1.0.4/go.mod h1:fO7iG3H7G2nSZ7m0zPUDn85XEX2GTukHGRSepvi9Eig=
+github.com/andybalholm/cascadia v1.0.0/go.mod h1:GsXiBklL0woXo1j/WYWtSYYC4ouU9PqHO0sqidkEA4Y=
+github.com/andybalholm/cascadia v1.2.0/go.mod h1:YCyR8vOZT9aZ1CHEd8ap0gMVm2aFgxBp0T0eFw1RUQY=
+github.com/andybalholm/cascadia v1.3.1 h1:nhxRkql1kdYCc8Snf7D5/D3spOX+dBgjA6u8x004T2c=
+github.com/andybalholm/cascadia v1.3.1/go.mod h1:R4bJ1UQfqADjvDa4P6HZHLh/3OxWWEqc0Sk8XGwHqvA=
 github.com/anmitsu/go-shlex v0.0.0-20161002113705-648efa622239 h1:kFOfPq6dUM1hTo4JG6LR5AXSUEsOjtdm0kw0FtQtMJA=
 github.com/anmitsu/go-shlex v0.0.0-20161002113705-648efa622239/go.mod h1:2FmKhYUyUczH0OGQWaF5ceTx0UBShxjsH6f8oGKYe2c=
 github.com/antihax/optional v0.0.0-20180407024304-ca021399b1a6/go.mod h1:V8iCPQYkqmusNa815XgQio277wI47sdRh1dUOLdyC6Q=
@@ -335,6 +346,9 @@ github.com/apex/log v1.1.4/go.mod h1:AlpoD9aScyQfJDVHmLMEcx4oU6LqzkWp4Mg9GdAcEvQ
 github.com/apex/logs v0.0.4/go.mod h1:XzxuLZ5myVHDy9SAmYpamKKRNApGj54PfYLcFrXqDwo=
 github.com/aphistic/golf v0.0.0-20180712155816-02c07f170c5a/go.mod h1:3NqKYiepwy8kCu4PNA+aP7WUV72eXWJeP9/r3/K9aLE=
 github.com/aphistic/sweet v0.2.0/go.mod h1:fWDlIh/isSE9n6EPsRmC0det+whmX6dJid3stzu0Xys=
+github.com/araddon/dateparse v0.0.0-20180729174819-cfd92a431d0e/go.mod h1:SLqhdZcd+dF3TEVL2RMoob5bBP5R1P1qkox+HtCBgGI=
+github.com/araddon/dateparse v0.0.0-20210429162001-6b43995a97de h1:FxWPpzIjnTlhPwqqXc4/vE0f7GvRjuAsbW+HOIe8KnA=
+github.com/araddon/dateparse v0.0.0-20210429162001-6b43995a97de/go.mod h1:DCaWoUhZrYW9p1lxo/cm8EmUOOzAPSEZNGF2DK1dJgw=
 github.com/arbovm/levenshtein v0.0.0-20160628152529-48b4e1c0c4d0 h1:jfIu9sQUG6Ig+0+Ap1h4unLjW6YQJpKZVmUzxsD4E/Q=
 github.com/arbovm/levenshtein v0.0.0-20160628152529-48b4e1c0c4d0/go.mod h1:t2tdKJDJF9BV14lnkjHmOQgcvEKgtqs5a1N3LNdJhGE=
 github.com/armon/circbuf v0.0.0-20150827004946-bbbad097214e
```

**File**: `lunatrace/bsl/backend/tsconfig.json` (modified, +8/-1)
```diff
@@ -17,7 +17,7 @@
     "strict": true /* Enable all strict type-checking options. */,
     "esModuleInterop": true,  /* Enables emit interoperability between CommonJS and ES Modules via creation of namespace objects for all imports. Implies 'allowSyntheticDefaultImports'. */
     "resolveJsonModule": true /* Include modules imported with .json extension. */,
-    "skipLibCheck": false,
+    "skipLibCheck": true, // todo: This may be a bit dangerous but it fixes a bug from duplicate types 
     "forceConsistentCasingInFileNames": true,
     "allowJs": true,
 
@@ -51,6 +51,13 @@
     "src/__tests__",
     "./src/**/*",
   ],
+
+  "exclude": [
+    "node_modules",
+    "typings",
+    "../../../node_modules"
+  ]
+,
   "references": [
     {"path": "../common"},
     {"path": "../logger"}
```

**File**: `lunatrace/bsl/ingest-worker/cmd/ingestworker/main.go` (modified, +6/-3)
```diff
@@ -17,6 +17,8 @@ import (
 	"github.com/rs/zerolog"
 	"github.com/rs/zerolog/log"
 
+	"go.uber.org/fx"
+
 	"github.com/lunasec-io/lunasec/lunatrace/bsl/ingest-worker/cmd/ingestworker/cisa"
 	"github.com/lunasec-io/lunasec/lunatrace/bsl/ingest-worker/cmd/ingestworker/cwe"
 	"github.com/lunasec-io/lunasec/lunatrace/bsl/ingest-worker/cmd/ingestworker/epss"
@@ -35,8 +37,7 @@ import (
 	"github.com/lunasec-io/lunasec/lunatrace/bsl/ingest-worker/pkg/metadata/replicator/npm"
 	"github.com/lunasec-io/lunasec/lunatrace/bsl/ingest-worker/pkg/scanner/licensecheck"
 	"github.com/lunasec-io/lunasec/lunatrace/bsl/ingest-worker/pkg/scanner/packagejson"
-
-	"go.uber.org/fx"
+	"github.com/lunasec-io/lunasec/lunatrace/bsl/ingest-worker/pkg/vulnerability/affected"
 
 	"github.com/lunasec-io/lunasec/lunatrace/bsl/ingest-worker/cmd/ingestworker/license"
 	"github.com/lunasec-io/lunasec/lunatrace/bsl/ingest-worker/pkg/metadata/ingester"
@@ -54,11 +55,13 @@ func main() {
 		graphqlfx.Module,
 		dbfx.Module,
 		registry.NPMModule,
+		ingester.Module,
 
 		fx.Provide(
 			cwe2.NewCWEIngester,
 			epss2.NewEPSSIngester,
 			cisa2.NewCISAKnownVulnIngester,
+			vulnmanager.NewProcessor,
 		),
 
 		// todo make a module
@@ -69,9 +72,9 @@ func main() {
 		}),
 		fx.Provide(
 			ingester.NewPackageSqlIngester,
-			ingester.NewNPMPackageIngester,
 			replicator.NewNPMReplicator,
 			npm.NewNpmAPIReplicator,
+			affected.NewIngester,
 		),
 		fx.Provide(
 			ingestworker.NewConfigProvider,
```

**File**: `lunatrace/bsl/ingest-worker/cmd/ingestworker/sync/sync.go` (modified, +3/-4)
```diff
@@ -1,14 +1,13 @@
 // Copyright by LunaSec (owned by Refinery Labs, Inc)
 //
-// Licensed under the Business Source License v1.1 
+// Licensed under the Business Source License v1.1
 // (the "License"); you may not use this file except in compliance with the
 // License. You may obtain a copy of the License at
 //
 // https://github.com/lunasec-io/lunasec/blob/master/licenses/BSL-LunaTrace.txt
 //
 // See the License for the specific language governing permissions and
 // limitations under the License.
-//
 package sync
 
 import (
@@ -30,7 +29,7 @@ import (
 type Params struct {
 	fx.In
 
-	Ingester     vulnerability.FileAdvisoryIngester
+	Ingester     vulnerability.AdvisoryIngester
 	CWEIngester  cwe.CWEIngester
 	EPSSIngester epss.EPSSIngester
 	CISAIngester cisa.CISAKnownVulnIngester
@@ -84,7 +83,7 @@ func NewCommand(p Params) clifx.CommandResult {
 						Str("source", source).
 						Str("cron", cron).
 						Msg("starting vulnerability ingestion")
-					err = p.Ingester.IngestVulnerabilitiesFromSource(advisoryLocation, source, sourceRelativePath)
+					_, err = p.Ingester.IngestVulnerabilitiesFromSource(advisoryLocation, source, sourceRelativePath)
 
 					if err != nil {
 						log.Error().
```

**File**: `lunatrace/bsl/ingest-worker/cmd/ingestworker/vulnerability/vulnerability.go` (modified, +93/-3)
```diff
@@ -11,26 +11,100 @@
 package vulnerability
 
 import (
+	"encoding/json"
+	"os"
+
 	"github.com/rs/zerolog/log"
 	"github.com/urfave/cli/v2"
 	"go.uber.org/fx"
 
 	"github.com/lunasec-io/lunasec/lunatrace/bsl/ingest-worker/pkg/vulnerability"
+	"github.com/lunasec-io/lunasec/lunatrace/bsl/ingest-worker/pkg/vulnerability/affected"
 
 	"github.com/ajvpot/clifx"
 )
 
 type Params struct {
 	fx.In
 
-	Ingester vulnerability.FileAdvisoryIngester
+	Processor        vulnerability.Processor
+	Ingester         vulnerability.AdvisoryIngester
+	AffectedIngester affected.Ingester
 }
 
 func NewCommand(p Params) clifx.CommandResult {
 	return clifx.CommandResult{
 		Command: &cli.Command{
 			Name: "vulnerability",
 			Subcommands: []*cli.Command{
+				{
+					Name:        "process",
+					Description: "Process a file or directory containing vulnerabilities. All references are crawled and their content is downloaded.",
+					Flags: []cli.Flag{
+						&cli.StringFlag{
+							Name:     "db",
+							Usage:    "Cache database location",
+							Required: false,
+						},
+					},
+					Subcommands: []*cli.Command{
+						{
+							Name: "cache",
+							Action: func(ctx *cli.Context) error {
+								cache := ctx.String("db")
+								return p.Processor.ProcessAllVulnerabilities(cache)
+							},
+						},
+						{
+							Name: "save",
+							Flags: []cli.Flag{
+								&cli.StringFlag{
+									Name:     "out",
+									Usage:    "Output file location.",
+									Required: false,
+								},
+								&cli.BoolFlag{
+									Name:     "markdown",
+									Usage:    "Output in markdown format. Default is json.",
+									Required: false,
+								},
+							},
+							Usage: "[vulnerability id]",
+							Action: func(ctx *cli.Context) error {
+								firstArg := ctx.Args().First()
+								out := ctx.String("out")
+								markdown := ctx.Bool("markdown")
+								cache := ctx.String("db")
+
+								if firstArg == "" {
+									return p.Processor.LoadAndOutputToDir(cache, out, markdown)
+								}
+
+								vuln, err := p.Processor.ProcessVulnerabilityID(firstArg)
+								if err != nil {
+									return err
+								}
+								content, err := json.MarshalIndent(vuln, "", "\t")
+								if err != nil {
+									return err
+								}
+
+								if out != "" {
+									err = os.WriteFile(out, content, 0644)
+									if err != nil {
+										return err
+									}
+								} else {
+									_, err = os.Stdout.Write(content)
+									if err != nil {
+										return err
+									}
+								}
+								return nil
+							},
+						},
+					},
+				},
 				{
 					Name:  "ingest",
 					Usage: "[file or directory]",
@@ -44,26 +118,42 @@ func NewCommand(p Params) clifx.CommandResult {
 							Name:  "source-relative-path",
 							Usage: "Relative path from within the source to where advisories are located.",
 						},
+						&cli.BoolFlag{
+							Name:  "ingest-affected",
+							Usage: "Ensure for every affected package that all metadata is collected.",
+						},
 					},
 					Subcommands: []*cli.Command{},
 					Action: func(ctx *cli.Context) error {
 						advisoryLocation := ctx.Args().First()
 
 						source := ctx.String("source")
 						sourceRelativePath := ctx.String("source-relative-path")
+						ingestAffected := ctx.Bool("ingest-affected")
 
 						log.Info().
 							Str("source", source).
 							Msg("starting vulnerability ingestion")
-						err := p.Ingester.IngestVulnerabilitiesFromSource(advisoryLocation, source, sourceRelativePath)
-
+						insertedVulns, err := p.Ingester.IngestVulnerabilitiesFromSource(advisoryLocation, source, sourceRelativePath)
 						if err != nil {
 							log.Error().
 								Err(err).
 								Str("source", source).
 								Msg("failed to ingest vulnerabilities")
 							return err
 						}
+
+						if ingestAffected {
+							for _, vuln := range insertedVulns {
+								log.Info().
+									Str("vulnerability", vuln).
+									Msg("processing vulnerability")
+								err = p.AffectedIngester.Ingest(ctx.Context, vuln)
+								if err != nil {
+									continue
+								}
+							}
+						}
 						return nil
 					},
 				},
```

---

### Incident Patch 12: `3ec7d92d` (2023-02-23)
**Commit Message**: Update 2023-02-22-css-style-sheets.mdx

**File**: `docs/blog/2023-02-22-css-style-sheets.mdx` (modified, +2/-2)
```diff
@@ -109,12 +109,12 @@ document.adoptedStyleSheets = [darkStyles]
 ```
 
 Note that we add the stylesheet to the `adoptedStyleSheets` array on the document object (which is what gets it into the DOM). This is like `document.styleSheets` except that it
-isn't immutable and can be modified directly by JavaScript, which is exactly what we need.
+isn't immutable and can be modified directly by JavaScript, and that's exactly what we need.
 
 If you have your own webpack config, just add a rule using `css-loader` and set `exportType: 'css-style-sheet'`, as per the [css-loader docs](https://webpack.js.org/loaders/css-loader/#exporttype).
 
 Unfortunately, that won't work out of the box with Create React App (CRA). There are no loaders set up to compile to that format. That's
-understandable sinceit's pretty new. Instead, let's use Craco, a hookable wrapper around CRA, to get the loader we need.
+understandable since it's pretty new. Instead, let's use Craco, a hookable wrapper around CRA, to get the loader we need.
 
 ### Taking back control of our webpack config using Craco
 :::info
```

---

### Incident Patch 13: `25502e06` (2023-02-22)
**Commit Message**: write a blog post about the new css feature

**File**: `docs/blog/2023-02-22-css-style-sheets.mdx` (added, +169/-0)
```diff
@@ -0,0 +1,169 @@
+<!--
+  ~ Copyright by LunaSec (owned by Refinery Labs, Inc)
+  ~
+  ~ Licensed under the Creative Commons Attribution-ShareAlike 4.0 International
+  ~ (the "License"); you may not use this file except in compliance with the
+  ~ License. You may obtain a copy of the License at
+  ~
+  ~ https://creativecommons.org/licenses/by-sa/4.0/legalcode
+  ~
+  ~ See the License for the specific language governing permissions and
+  ~ limitations under the License.
+  ~
+-->
+---
+title: "Use the CSSStyleSheets API in a React App"
+description: "How to use the new CSSStyleSheet JS API in your create-react-app application, for dynamic loading and unloading of CSS in JS"
+slug: css-style-sheets
+date: 2023-02-22T07:00:00.000Z
+keywords: [react, cssstylesheets,css]
+tags: [web]
+authors: [forrest]
+---
+
+There's a shiny new web feature in browser town, and it's called [CSSStyleSheets](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet).
+ It allows us to manipulate page styling without having to load
+css anywhere into the HTML of the page. With it you can do things like
+```js
+const sheet = new CSSStyleSheet();
+// Apply a rule to the sheet
+sheet.replaceSync("a { color: red; }");
+// disable the sheet to remove it from the DOM
+sheet.disabled = true;
+```
+Neat. Support just became widespread, with adoption by Chrome, Safari, Firefox, etc [added in the last](https://caniuse.com/mdn-api_cssstylesheet) year as of early 2023.
+
+#### The old way
+Whether you noticed it or not, your current css framework is almost certainly creating a
+`<link href="example.css" rel="stylesheet">` in the HTML of the page, or setting style attributes directly on page elements. Up until recently, that was the only way to do it.
+
+This works fine but it has a few disadvantages in certain cases. It doesn't play very nicely with dynamic usage, whether we are talking about developer experience,
+or maybe switching sheets on and off on the fly. Traditional CSS loading isn't going away any time soon, but the new CSSStyleSheet is great to have in your toolbelt, if you need it.
+
+### Why we wanted CSSStyleSheets
+Our app, [LunaTrace](https://lunatrace.lunasec.io), has both a dark mode and a light mode. We compile two different stylesheets,
+a dark.css and a light.css. Previously, we simply had a `<link href="dark.css"...` as above, and when we wanted to change to a light theme,
+we reached into the DOM and modified the element to link to `light.css`. This worked ok but it was just a little bit slow (the page flashed, not the end of the world)
+and it was a painfully slow developer experience. We had a separate watcher script from our main react-scripts that watched our scss files and recompiled them, and then the page would reload after
+10 or 15 seconds. That was just a little too slow for making fast changes to the CSS.
+
+#### Switch to CSS in JS
+Css in JS is when you put JS in charge of loading styles into the DOM. It does have pros and cons that I won't go into, but the developer experience is great. Much faster.
+
+We could do `require 'dark.scss'` at the top of one of our TSX files, and Create React App's webpack config would take care of the rest.
+
+Only problem is, there is no way to _unload_ a global style you've loaded. For LunaTrace, we need to switch between dark and light themes, so that's a problem.
+CSS in JS was incapable of doing something the DOM has been able to do for decades: unload something.
+
+#### Hot swapping style sheets in JS
+CSSStyleSheets was created to allow exactly this kind of direct control. `css-loader` does support this new option. It will compile your css import
+into javascript which wraps your css file with `new CssStyleSheet`, so that you can directly import and use it, ready to go.
+
+A simple example looks like:
+
+```typescript
+import darkStyles from '../scss/main/dark.css-style-sheet.scss';
+import lightStyles from '../scss/main/light.css-style-sheet.scss';
+
+// now mount one of those to the dom
+document.adoptedStyleSheets = [darkStyles]
+```
+
+If you have your own webpack config, just add a rule using `css-loader` and set `exportType: 'css-style-sheet'`, as per the [css-loader docs](https://webpack.js.org/loaders/css-loader/#exporttype).
+
+Unfortunately, that won't work out of the box with Create React App(CRA). There are no loaders set up to compile to that format. That's
+understandable, it's pretty new. Let's use Craco, a hookable wrapper around CRA, to get the loader we need.
+
+### Taking back control of our webpack config using Craco
+:::info
+If you're already using craco or have your own webpack config, you can skip to the next section.
+:::
+
+
+
+
+`npm i --save-dev @craco/craco`
+
+Create a craco config file in your project root
+ ```typescript title="craco.config.js"
+module.exports = {
+  webpack: {
+    configure: (webpackConfig, { env, paths }) => {
+      // Modify the webpackConfig here
+
+      return webpackConfig;
+    },
+  },
+};
+ ```
+ R
```

---

### Incident Patch 14: `ba5ce0d1` (2023-02-10)
**Commit Message**: Commit baseline fixture



---

### Incident Patch 15: `97f593ac` (2023-02-08)
**Commit Message**: Merge pull request #1110 from lunasec-io/fix-light-theme

fix light background

**File**: `lunatrace/bsl/frontend/src/scss/pages/_project.scss` (modified, +1/-1)
```diff
@@ -63,5 +63,5 @@
   padding-right: 4px;
   padding-left: 4px;
   margin-left: 20px;
-  background-color: $dark-theme-base;
+  background-color: $card-bg;
 }
```

#### Recent Merged Pull Requests:
- **PR #1167** (closed): Create asdf (@santysanthoshraj)
- **PR #1166** (2023-10-18): Update authors.yml (@ajvpot)
- **PR #1164** (2023-04-18): LunaSec becomes LunaBrain pivot blog post (@freeqaz)
- **PR #1163** (2023-04-06): Update LLaMA's bechmark results (@vinhkhuc)
- **PR #1161** (2023-03-29): Cerebras vs LLaMA blog post (@freeqaz)
- **PR #1160** (2023-04-06): update blog post based on new reporting (@factoidforrest)
- **PR #1159** (2023-03-25): draft post openai (@factoidforrest)
- **PR #1158** (2023-03-19): Regenerate files for ml-refinement (@github-actions[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
