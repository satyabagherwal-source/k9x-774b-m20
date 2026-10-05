# Forensic Learning Record (Deep Inspection): k3s-io/k3s

> **Canonical Artifact**: `07_PROJECT_LEARNING/k3s-io-k3s-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/k3s-io/k3s](https://github.com/k3s-io/k3s))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T17:48:36.226Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `k3s-io/k3s`
- **Description**: Lightweight Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 34130 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `pkg/agent/loadbalancer/utility.go`
```
package loadbalancer

import (
	"errors"
	"net/url"
	"slices"
	"strings"
)

func parseURL(serverURL, newHost string) (string, string, error) {
	parsedURL, err := url.Parse(serverURL)
	if err != nil {
		return "", "", err
	}
	if parsedURL.Host == "" {
		return "", "", errors.New("Initial server URL host is not defined for load balancer")
	}
	address := parsedURL.Host
	if parsedURL.Port() == "" {
		if strings.ToLower(parsedURL.Scheme) == "http" {
			address += ":80"
		}
		if strings.ToLower(parsedURL.Scheme) == "https" {
			address += ":443"
		}
	}
	parsedURL.Host = newHost
	return address, parsedURL.String(), nil
}

// sortServers returns a sorted, unique list of strings, with any
// empty values removed. The returned bool is true if the list
// contains the search string.
func sortServers(input []string, search string) ([]string, bool) {
	result := []string{}
	found := false
	skip := map[string]bool{"": true}

	for _, entry := range input {
		if skip[entry] {
			continue
		}
		if search == entry {
			found = true
		}
		skip[entry] = true
		result = append(result, entry)
	}

	slices.Sort(result)
	return result, found
}

```

### Core Architecture Module: `pkg/agent/loadbalancer/utility_windows.go`
```
//go:build windows

package loadbalancer

import "syscall"

func reusePort(network, address string, conn syscall.RawConn) error {
	return nil
}

```

### Core Architecture Module: `pkg/agent/util/file.go`
```
package util

import (
	"os"
	"path/filepath"

	"github.com/k3s-io/k3s/pkg/util/errors"
)

func WriteFile(name string, content string) error {
	os.MkdirAll(filepath.Dir(name), 0755)
	err := os.WriteFile(name, []byte(content), 0644)
	if err != nil {
		return errors.WithMessagef(err, "writing %s", name)
	}
	return nil
}

func CopyFile(sourceFile string, destinationFile string, ignoreNotExist bool) error {
	os.MkdirAll(filepath.Dir(destinationFile), 0755)
	input, err := os.ReadFile(sourceFile)
	if errors.Is(err, os.ErrNotExist) && ignoreNotExist {
		return nil
	} else if err != nil {
		return errors.WithMessagef(err, "copying %s to %s", sourceFile, destinationFile)
	}
	err = os.WriteFile(destinationFile, input, 0644)
	if err != nil {
		return errors.WithMessagef(err, "copying %s to %s", sourceFile, destinationFile)
	}
	return nil
}

```

### Core Architecture Module: `pkg/agent/util/strings.go`
```
package util

import "strings"

// HasSuffixI returns true if string s has any of the given suffixes, ignoring case.
func HasSuffixI(s string, suffixes ...string) bool {
	s = strings.ToLower(s)
	for _, suffix := range suffixes {
		if strings.HasSuffix(s, strings.ToLower(suffix)) {
			return true
		}
	}
	return false
}

```

### Core Architecture Module: `pkg/containerd/utility_linux.go`
```
//go:build linux

package containerd

import (
	"errors"
	"os/exec"

	"github.com/containerd/containerd/v2/plugins/snapshots/overlay/overlayutils"
	fuseoverlayfs "github.com/containerd/fuse-overlayfs-snapshotter/v2"
	stargz "github.com/containerd/stargz-snapshotter/service"
	"github.com/pdtpartners/nix-snapshotter/pkg/nix"
)

func OverlaySupported(root string) error {
	return overlayutils.Supported(root)
}

func FuseoverlayfsSupported(root string) error {
	return fuseoverlayfs.Supported(root)
}

func StargzSupported(root string) error {
	return stargz.Supported(root)
}

func NixSupported(root string) error {
	if _, err := exec.LookPath("nix-store"); err != nil {
		return errors.New("nix-store not found in PATH: install nix (https://nixos.org/download) to use the nix snapshotter")
	}
	return nix.Supported(root)
}

```

### Core Architecture Module: `pkg/containerd/utility_windows.go`
```
//go:build windows

package containerd

import (
	"github.com/k3s-io/k3s/pkg/util/errors"
)

func OverlaySupported(root string) error {
	return errors.WithMessagef(errors.ErrUnsupportedPlatform, "overlayfs is not supported")
}

func FuseoverlayfsSupported(root string) error {
	return errors.WithMessagef(errors.ErrUnsupportedPlatform, "fuse-overlayfs is not supported")
}

func StargzSupported(root string) error {
	return errors.WithMessagef(errors.ErrUnsupportedPlatform, "stargz is not supported")
}

func NixSupported(root string) error {
	return errors.WithMessagef(errors.ErrUnsupportedPlatform, "nix is not supported")
}

```

### Core Architecture Module: `pkg/kubeadm/utils.go`
```
package kubeadm

import (
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/k3s-io/k3s/pkg/util/errors"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	bootstrapapi "k8s.io/cluster-bootstrap/token/api"
	bootstraputil "k8s.io/cluster-bootstrap/token/util"
	bootstrapsecretutil "k8s.io/cluster-bootstrap/util/secrets"
)

// kubeadm bootstrap token utilities cribbed from:
// https://github.com/kubernetes/kubernetes/blob/v1.25.4/cmd/kubeadm/app/apis/bootstraptoken/v1/utils.go
// Copying these instead of importing from kubeadm saves about 4mb of binary size.

// String returns the string representation of the BootstrapTokenString
func (bts BootstrapTokenString) String() string {
	if len(bts.ID) > 0 && len(bts.Secret) > 0 {
		return bootstraputil.TokenFromIDAndSecret(bts.ID, bts.Secret)
	}
	return ""
}

// NewBootstrapTokenString converts the given Bootstrap Token as a string
// to the BootstrapTokenString object used for serialization/deserialization
// and internal usage. It also automatically validates that the given token
// is of the right format
func NewBootstrapTokenString(token string) (*BootstrapTokenString, error) {
	substrs := bootstraputil.BootstrapTokenRegexp.FindStringSubmatch(token)
	if len(substrs) != 3 {
		return nil, fmt.Errorf("the bootstrap token %q was not of the form %q", token, bootstrapapi.BootstrapTokenPattern)
	}

	return &BootstrapTokenString{ID: substrs[1], Secret: substrs[2]}, nil
}

// NewBootstrapTokenStringFromIDAndSecret is a wrapper around NewBootstrapTokenString
// that allows the caller to specify the ID and Secret separately
func NewBootstrapTokenStringFromIDAndSecret(id, secret string) (*BootstrapTokenString, error) {
	return NewBootstrapTokenString(bootstraputil.TokenFromIDAndSecret(id, secret))
}

// BootstrapTokenToSecret converts the given BootstrapToken object to its Secret representation that
// may be submitted to the API Server in order to be stored.
func BootstrapTokenToSecret(bt *BootstrapToken) *v1.Secret {
	return &v1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      bootstraputil.BootstrapTokenSecretName(bt.Token.ID),
			Namespace: metav1.NamespaceSystem,
		},
		Type: v1.SecretType(bootstrapapi.SecretTypeBootstrapToken),
		Data: encodeTokenSecretData(bt, time.Now()),
	}
}

// encodeTokenSecretData takes the token discovery object and an optional duration and returns the .Data for the Secret
// now is passed in order to be able to used in unit testing
func encodeTokenSecretData(token *BootstrapToken, now time.Time) map[string][]byte {
	data := map[string][]byte{
		bootstrapapi.BootstrapTokenIDKey:     []byte(token.Token.ID),
		bootstrapapi.BootstrapTokenSecretKey: []byte(token.Token.Secret),
	}

	if len(token.Description) > 0 {
		data[bootstrapapi.BootstrapTokenDescriptionKey] = []byte(token.Description)
	}

	// If for some strange reason both token.TTL and token.Expires would be set
	// (they are mutually exclusive in validation so this shouldn't be the case),
	// token.Expires has higher priority, as can be seen in the logic here.
	if token.Expires != nil {
		// Format the expiration date accordingly
		// TODO: This maybe should be a helper function in bootstraputil?
		expirationString := token.Expires.Time.UTC().Format(time.RFC3339)
		data[bootstrapapi.BootstrapTokenExpirationKey] = []byte(expirationString)
	} else if token.TTL != nil && token.TTL.Duration > 0 {
		// Only if .Expires is unset, TTL might have an effect
		// Get the current time, add the specified duration, and format it accordingly
		expirationString := now.Add(token.TTL.Duration).UTC().Format(time.RFC3339)
		data[bootstrapapi.BootstrapTokenExpirationKey] = []byte(expirationString)
	}

	for _, usage := range token.Usages {
		data[bootstrapapi.BootstrapTokenUsagePrefix+usage] = []byte("true")
	}

	if len(token.Groups) > 0 {
		data[bootstrapapi.BootstrapTokenExtraGroupsKey] = []byte(strings.Join(token.Groups, ","))
	}
	return data
}

// BootstrapTokenFromSecret returns a BootstrapToken object from the given Secret
func BootstrapTokenFromSecret(secret *v1.Secret) (*BootstrapToken, error) {
	// Get the Token ID field from the Secret data
	tokenID := bootstrapsecretutil.GetData(secret, bootstrapapi.BootstrapTokenIDKey)
	if len(tokenID) == 0 {
		return nil, fmt.Errorf("bootstrap Token Secret has no token-id data: %s", secret.Name)
	}

	// Enforce the right naming convention
	if secret.Name != bootstraputil.BootstrapTokenSecretName(tokenID) {
		return nil, fmt.Errorf("bootstrap token name is not of the form '%s(token-id)'. Actual: %q. Expected: %q",
			bootstrapapi.BootstrapTokenSecretPrefix, secret.Name, bootstraputil.BootstrapTokenSecretName(tokenID))
	}

	tokenSecret := bootstrapsecretutil.GetData(secret, bootstrapapi.BootstrapTokenSecretKey)
	if len(tokenSecret) == 0 {
		return nil, fmt.Errorf("bootstrap Token Secret has no token-secret data: %s", secret.Name)
	}

	// Create the BootstrapTokenString object based on the ID and Secret
	bts, err := NewBootstrapTokenStringFromIDAndSecret(tokenID, tokenSecret)
	if err != nil {
		return nil, errors.WithMessage(err, "bootstrap Token Secret is invalid and couldn't be parsed")
	}

	// Get the description (if any) from the Secret
	description := bootstrapsecretutil.GetData(secret, bootstrapapi.BootstrapTokenDescriptionKey)

	// Expiration time is optional, if not specified this implies the token
	// never expires.
	secretExpiration := bootstrapsecretutil.GetData(secret, bootstrapapi.BootstrapTokenExpirationKey)
	var expires *metav1.Time
	if len(secretExpiration) > 0 {
		expTime, err := time.Parse(time.RFC3339, secretExpiration)
		if err != nil {
			return nil, errors.WithMessagef(err, "can't parse expiration time of bootstrap token %q", secret.Name)
		}
		expires = &metav1.Time{Time: expTime}
	}

	// Build an usages string slice from the Secret data
	var usages []string
	for k, v := range secret.Data {
		// Skip all fields that don't include this prefix
		if !strings.HasPrefix(k, bootstrapapi.BootstrapTokenUsagePrefix) {
			continue
		}
		// Skip those that don't have this usage set to true
		if string(v) != "true" {
			continue
		}
		usages = append(usages, strings.TrimPrefix(k, bootstrapapi.BootstrapTokenUsagePrefix))
	}
	// Only sort the slice if defined
	if usages != nil {
		slices.Sort(usages)
	}

	// Get the extra groups information from the Secret
	// It's done this way to make .Groups be nil in case there is no items, rather than an
	// empty slice or an empty slice with a "" string only
	var groups []string
	groupsString := bootstrapsecretutil.GetData(secret, bootstrapapi.BootstrapTokenExtraGroupsKey)
	g := strings.Split(groupsString, ",")
	if len(g) > 0 && len(g[0]) > 0 {
		groups = g
	}

	return &BootstrapToken{
		Token:       bts,
		Description: description,
		Expires:     expires,
		Usages:      usages,
		Groups:      groups,
	}, nil
}

```

### Core Architecture Module: `pkg/util/api.go`
```
package util

import (
	"context"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/k3s-io/k3s/pkg/signals"
	"github.com/k3s-io/k3s/pkg/util/errors"
	"github.com/rancher/wrangler/v3/pkg/schemes"
	"github.com/sirupsen/logrus"
	authorizationv1 "k8s.io/api/authorization/v1"
	v1 "k8s.io/api/core/v1"
	discoveryv1 "k8s.io/api/discovery/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/dynamic"
	clientset "k8s.io/client-go/kubernetes"
	authorizationv1client "k8s.io/client-go/kubernetes/typed/authorization/v1"
	coregetter "k8s.io/client-go/kubernetes/typed/core/v1"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/record"
)

// This sets a default duration to wait for the apiserver to become ready. This is primarily used to
// block startup of agent supervisor controllers until the apiserver is ready to serve requests, in the
// same way that the apiReady channel is used in the server packages, so it can be fairly long. It must
// be at least long enough for downstream projects like RKE2 to start the apiserver in the background.
const DefaultAPIServerReadyTimeout = 15 * time.Minute

func GetAddresses(endpoint *v1.Endpoints) []string {
	serverAddresses := []string{}
	if endpoint == nil {
		return serverAddresses
	}
	for _, subset := range endpoint.Subsets {
		var port string
		if len(subset.Ports) > 0 {
			port = strconv.Itoa(int(subset.Ports[0].Port))
		}
		if port == "" {
			port = "443"
		}
		for _, address := range subset.Addresses {
			serverAddresses = append(serverAddresses, net.JoinHostPort(address.IP, port))
		}
	}
	return serverAddresses
}

func GetAddressesFromSlices(slices ...discoveryv1.EndpointSlice) []string {
	serverAddresses := []string{}
	for _, slice := range slices {
		var port string
		if len(slice.Ports) > 0 && slice.Ports[0].Port != nil {
			port = strconv.Itoa(int(*slice.Ports[0].Port))
		}
		if port == "" {
			port = "443"
		}
		for _, endpoint := range slice.Endpoints {
			if endpoint.Conditions.Ready == nil || *endpoint.Conditions.Ready {
				for _, address := range endpoint.Addresses {
					serverAddresses = append(serverAddresses, net.JoinHostPort(address, port))
				}
			}
		}
	}
	return serverAddresses
}

// WaitForAPIServerReady waits for the API server's /readyz endpoint to report "ok" with timeout.
// This is modified from WaitForAPIServer from the Kubernetes controller-manager app, but checks the
// readyz endpoint instead of the deprecated healthz endpoint, and supports context.
func WaitForAPIServerReady(ctx context.Context, kubeconfigPath string, timeout time.Duration) error {
	lastErr := errors.New("API server not polled")
	restConfig, err := GetRESTConfig(kubeconfigPath)
	if err != nil {
		return err
	}

	// Probe apiserver readiness with a 15 second timeout
	// https://github.com/kubernetes/kubernetes/blob/v1.24.0/cmd/kubeadm/app/util/staticpod/utils.go#L252
	restConfig.Timeout = time.Second * 15

	// By default, idle connections to the apiserver are returned to a global pool
	// between requests.  Explicitly flag this client's request for closure so that
	// we re-dial through the loadbalancer in case the endpoints have changed.
	restConfig.Wrap(func(rt http.RoundTripper) http.RoundTripper {
		return roundTripFunc(func(req *http.Request) (*http.Response, error) {
			req.Close = true
			return rt.RoundTrip(req)
		})
	})

	restConfig = dynamic.ConfigFor(restConfig)
	restConfig.GroupVersion = &schema.GroupVersion{}
	restClient, err := rest.RESTClientFor(restConfig)
	if err != nil {
		return err
	}

	req := restClient.Get().AbsPath("/readyz").Param("exclude", "kms-providers").Param("verbose", "true")
	err = wait.PollUntilContextTimeout(ctx, time.Second*2, timeout, true, func(ctx context.Context) (bool, error) {
		// DoRaw returns an error if the response code is < 200 OK or > 206 Partial Content
		if _, err := req.DoRaw(ctx); err != nil {
			if err.Error() != lastErr.Error() {
				logrus.Infof("Polling for API server readiness: GET /readyz failed: %v", err)
			} else {
				logrus.Debug("Polling for API server readiness: GET /readyz failed: status unchanged")
			}
			lastErr = err
			return false, nil
		}

		return true, nil
	})

	if err != nil {
		return errors.Join(err, lastErr)
	}

	return nil
}

// APIServerReadyChan wraps WaitForAPIServerReady, returning a channel that
// is closed when the apiserver is ready.  If the apiserver does not become
// ready within the expected duration, a fatal error is raised.
func APIServerReadyChan(ctx context.Context, kubeConfig string, timeout time.Duration) <-chan struct{} {
	ready := make(chan struct{})

	go func() {
		if err := WaitForAPIServerReady(ctx, kubeConfig, timeout); err != nil {
			signals.RequestShutdown(errors.WithMessage(err, "failed to wait for API server to become ready"))
			return
		}
		close(ready)
	}()

	return ready
}

type genericAccessReviewRequest func(context.Context) (*authorizationv1.SubjectAccessReviewStatus, error)

// WaitForRBACReady polls an AccessReview request until it returns an allowed response. If the user
// and group are empty, it uses SelfSubjectAccessReview, otherwise SubjectAccessReview is used.  It
// will return an error if the timeout expires, or nil if the SubjectAccessReviewStatus indicates
// the access would be allowed.
func WaitForRBACReady(ctx context.Context, kubeconfigPath string, timeout time.Duration, ra authorizationv1.ResourceAttributes, user string, groups ...string) error {
	var lastErr error
	restConfig, err := GetRESTConfig(kubeconfigPath)
	if err != nil {
		return err
	}
	authClient, err := authorizationv1client.NewForConfig(restConfig)
	if err != nil {
		return err
	}

	var reviewFunc genericAccessReviewRequest
	if len(user) == 0 && len(groups) == 0 {
		reviewFunc = selfSubjectAccessReview(authClient, ra)
	} else {
		reviewFunc = subjectAccessReview(authClient, ra, user, groups)
	}

	err = wait.PollUntilContextTimeout(ctx, time.Second, timeout, true, func(ctx context.Context) (bool, error) {
		status, rerr := reviewFunc(ctx)
		if rerr != nil {
			lastErr = rerr
			return false, nil
		}
		if status.Allowed {
			return true, nil
		}
		lastErr = errors.New(status.Reason)
		return false, nil
	})

	if err != nil {
		return errors.Join(err, lastErr)
	}

	return nil
}

// CheckRBAC performs a single SelfSubjectAccessReview or SubjectAccessReview, returning a
// boolean indicating whether or not the requested access would be allowed. This is basically
// `kubectl auth can-i`.
func CheckRBAC(ctx context.Context, kubeconfigPath string, ra authorizationv1.ResourceAttributes, user string, groups ...string) (bool, error) {
	restConfig, err := GetRESTConfig(kubeconfigPath)
	if err != nil {
		return false, err
	}
	authClient, err := authorizationv1client.NewForConfig(restConfig)
	if err != nil {
		return false, err
	}

	var reviewFunc genericAccessReviewRequest
	if len(user) == 0 && len(groups) == 0 {
		reviewFunc = selfSubjectAccessReview(authClient, ra)
	} else {
		reviewFunc = subjectAccessReview(authClient, ra, user, groups)
	}

	status, err := reviewFunc(ctx)
	if err != nil {
		return false, err
	}

	return status.Allowed, nil
}

// selfSubjectAccessReview returns a function that makes SelfSubjectAccessReview requests using the
// provided client and attributes, returning a status or error.
func selfSubjectAccessReview(authClient *authorizationv1client.AuthorizationV1Client, ra authorizationv1.ResourceAttributes) genericAccessReviewRequest {
	return func(ctx context.Context) (*authorizationv1.SubjectAccessReviewStatus, error) {
		r, err := authClient.SelfSubjectAccessReviews().Create(ctx, &authorizationv1.SelfSubjectAccessReview{
			Spec: authorizationv1.SelfSubjectAccessReviewSpec{
				ResourceAttributes: &ra,
			},
		}, metav1.CreateOptions{})
		if err != nil {
			return nil, err
		}
		return &r.Status, nil
	}
}

// subjectAccessReview returns a function that makes SubjectAccessReview requests using the
// provided client, attributes, user, and group, returning a status or error.
func subjectAccessReview(authClient *authorizationv1client.AuthorizationV1Client, ra authorizationv1.ResourceAttributes, user string, groups []string) genericAccessReviewRequest {
	return func(ctx context.Context) (*authorizationv1.SubjectAccessReviewStatus, error) {
		r, err := authClient.SubjectAccessReviews().Create(ctx, &authorizationv1.SubjectAccessReview{
			Spec: authorizationv1.SubjectAccessReviewSpec{
				ResourceAttributes: &ra,
				User:               user,
				Groups:             groups,
			},
		}, metav1.CreateOptions{})
		if err != nil {
			return nil, err
		}
		return &r.Status, nil
	}
}

func BuildControllerEventRecorder(ctx context.Context, k8s clientset.Interface, controllerName, namespace string) record.EventRecorder {
	logrus.Infof("Creating %s event broadcaster", controllerName)
	eventBroadcaster := record.NewBroadcaster(record.WithContext(ctx))
	eventBroadcaster.StartStructuredLogging(0)
	eventBroadcaster.StartRecordingToSink(&coregetter.EventSinkImpl{Interface: k8s.CoreV1().Events(namespace)})
	nodeName := os.Getenv("NODE_NAME")
	return eventBroadcaster.NewRecorder(schemes.All, v1.EventSource{Component: controllerName, Host: nodeName})
}

type roundTripFunc func(req *http.Request) (*http.Response, error)

func (w roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return w(req)
}

```

### Core Architecture Module: `pkg/util/apierrors.go`
```
package util

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"net/http"

	"github.com/k3s-io/api/pkg/generated/clientset/versioned/scheme"
	"github.com/sirupsen/logrus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"
)

var ErrAPINotReady = errors.New("apiserver not ready")
var ErrAPIDisabled = errors.New("apiserver disabled")
var ErrCoreNotReady = errors.New("runtime core not ready")

// SendErrorWithID sends and logs a random error ID so that logs can be correlated
// between the REST API (which does not provide any detailed error output, to avoid
// information disclosure) and the server logs.
func SendErrorWithID(err error, component string, resp http.ResponseWriter, req *http.Request, status ...int) {
	errID, _ := rand.Int(rand.Reader, big.NewInt(99999))
	logrus.Errorf("%s error ID %05d: %v", component, errID, err)
	SendError(fmt.Errorf("%s error ID %05d", component, errID), resp, req, status...)
}

// SendError sends a properly formatted error response
func SendError(err error, resp http.ResponseWriter, req *http.Request, status ...int) {
	var code int
	if len(status) == 1 {
		code = status[0]
	}
	if code == 0 || code == http.StatusOK {
		code = http.StatusInternalServerError
	}

	// Don't log "apiserver not ready" or "apiserver disabled" errors, they are frequent during startup
	if !errors.Is(err, ErrAPINotReady) && !errors.Is(err, ErrAPIDisabled) {
		logrus.Errorf("Sending %s %d response to %s: %v", req.Proto, code, req.RemoteAddr, err)
	}

	var serr *apierrors.StatusError
	switch code {
	case http.StatusBadRequest:
		serr = apierrors.NewBadRequest(err.Error())
	case http.StatusUnauthorized:
		serr = apierrors.NewUnauthorized(err.Error())
	case http.StatusForbidden:
		serr = newForbidden(err)
	case http.StatusInternalServerError:
		serr = apierrors.NewInternalError(err)
	case http.StatusBadGateway:
		serr = newBadGateway(err)
	case http.StatusServiceUnavailable:
		serr = apierrors.NewServiceUnavailable(err.Error())
	default:
		serr = apierrors.NewGenericServerResponse(code, req.Method, schema.GroupResource{}, req.URL.Path, err.Error(), 0, true)
	}

	resp.Header().Add("Connection", "close")
	responsewriters.ErrorNegotiated(serr, scheme.Codecs.WithoutConversion(), schema.GroupVersion{}, resp, req)
}

func newForbidden(err error) *apierrors.StatusError {
	return &apierrors.StatusError{
		ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    http.StatusForbidden,
			Reason:  metav1.StatusReasonForbidden,
			Message: err.Error(),
		}}
}

func newBadGateway(err error) *apierrors.StatusError {
	return &apierrors.StatusError{
		ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    http.StatusBadGateway,
			Reason:  metav1.StatusReasonInternalError,
			Message: err.Error(),
		}}
}

```

### Core Architecture Module: `pkg/util/args.go`
```
package util

import (
	"fmt"
	"slices"
	"strings"
)

const hyphens = "--"

// ArgValue returns the value of the first matching arg in the provided list.
func ArgValue(searchArg string, extraArgs []string) string {
	var value string
	for _, unsplitArg := range extraArgs {
		splitArg := strings.SplitN(strings.TrimPrefix(unsplitArg, hyphens), "=", 2)
		if splitArg[0] == searchArg {
			value = splitArg[1]
			// break if we found our value
			break
		}
	}
	return value
}

// GetArgs appends extra arguments to existing arguments with logic to override any default
// arguments whilst also allowing to prefix and suffix default string slice arguments.
func GetArgs(initialArgs map[string]string, extraArgs []string) []string {
	multiArgs := make(map[string][]string)

	for _, unsplitArg := range extraArgs {
		splitArg := strings.SplitN(strings.TrimPrefix(unsplitArg, hyphens), "=", 2)
		arg := splitArg[0]
		value := "true"
		if len(splitArg) > 1 {
			value = splitArg[1]
		}

		// After the first iteration, initial args will be empty when handling
		// duplicate arguments as they will form part of existingValues
		cleanedArg := strings.TrimRight(arg, "-+")
		initialValue, initialValueExists := initialArgs[cleanedArg]
		existingValues, existingValuesFound := multiArgs[cleanedArg]

		newValues := make([]string, 0)
		if strings.HasSuffix(arg, "+") { // Append value to initial args
			if initialValueExists {
				newValues = append(newValues, initialValue)
			}
			if existingValuesFound {
				newValues = append(newValues, existingValues...)
			}
			newValues = append(newValues, value)
		} else if strings.HasSuffix(arg, "-") { // Prepend value to initial args
			newValues = append(newValues, value)
			if initialValueExists {
				newValues = append(newValues, initialValue)
			}
			if existingValuesFound {
				newValues = append(newValues, existingValues...)
			}
		} else { // Append value ignoring initial args
			if existingValuesFound {
				newValues = append(newValues, existingValues...)
			}
			newValues = append(newValues, value)
		}

		delete(initialArgs, cleanedArg)
		multiArgs[cleanedArg] = newValues
	}

	// Add any remaining initial args to the map
	for arg, value := range initialArgs {
		multiArgs[arg] = []string{value}
	}

	// Get args so we can output them sorted whilst preserving the order of
	// repeated keys
	var keys []string
	for arg := range multiArgs {
		keys = append(keys, arg)
	}
	slices.Sort(keys)

	var args []string
	for _, arg := range keys {
		values := multiArgs[arg]
		for _, value := range values {
			cmd := fmt.Sprintf("%s%s=%s", hyphens, strings.TrimPrefix(arg, hyphens), value)
			args = append(args, cmd)
		}
	}

	return args
}

// AddFeatureGate correctly appends a feature gate key pair to the feature gates CLI switch.
func AddFeatureGate(current, toAdd string) string {
	if current == "" {
		return toAdd
	}
	return current + "," + toAdd
}

```

### Core Architecture Module: `pkg/util/bindata/embed.go`
```
package bindata

import (
	"embed"
	"io/fs"
	"path"
	"slices"
	"strings"
)

// Bindata is a wrapper around embed.FS that allows us to continue to use
// go-bindata style Asset and AssetNames functions to access the embedded FS.
type Bindata struct {
	FS     *embed.FS
	Prefix string
}

func (b Bindata) Asset(name string) ([]byte, error) {
	return b.FS.ReadFile(path.Join(b.Prefix, name))
}

func (b Bindata) AssetNames() []string {
	var assets []string
	fs.WalkDir(b.FS, ".", func(path string, entry fs.DirEntry, err error) error {
		// do not list hidden files - there is a .empty file checked in as a
		// placeholder for files that are generated at build time to satisy
		// `go vet`, but these should not be include when listing assets.
		if n := entry.Name(); entry.Type().IsRegular() && !strings.HasPrefix(n, ".") && !strings.HasPrefix(n, "_") {
			assets = append(assets, strings.TrimPrefix(path, b.Prefix))
		}
		return nil
	})
	slices.Sort(assets)
	return assets
}

```

### Core Architecture Module: `pkg/util/cert.go`
```
package util

import (
	"crypto/x509"
	"time"

	certutil "github.com/rancher/dynamiclistener/cert"
)

// cert usage constants
const (
	CertUsageCertSign   = "CertSign"
	CertUsageServerAuth = "ServerAuth"
	CertUsageClientAuth = "ClientAuth"
	CertUsageUnknown    = "Unknown"
)

// cert status constants
const (
	CertStatusOK          = "OK"
	CertStatusWarning     = "WARNING"
	CertStatusExpired     = "EXPIRED"
	CertStatusNotYetValid = "NOT YET VALID"
)

// EncodeCertsPEM is a wrapper around the EncodeCertPEM function to return the
// PEM encoding of a cert and chain, instead of just a single cert.
func EncodeCertsPEM(cert *x509.Certificate, caCerts []*x509.Certificate) []byte {
	pemBytes := certutil.EncodeCertPEM(cert)
	for _, caCert := range caCerts {
		pemBytes = append(pemBytes, certutil.EncodeCertPEM(caCert)...)
	}
	return pemBytes
}

// GetCertUsages returns a slice of strings representing the certificate usages
func GetCertUsages(cert *x509.Certificate) []string {
	usages := []string{}
	if cert.KeyUsage&x509.KeyUsageCertSign != 0 {
		usages = append(usages, CertUsageCertSign)
	}
	for _, eku := range cert.ExtKeyUsage {
		switch eku {
		case x509.ExtKeyUsageServerAuth:
			usages = append(usages, CertUsageServerAuth)
		case x509.ExtKeyUsageClientAuth:
			usages = append(usages, CertUsageClientAuth)
		}
	}
	if len(usages) == 0 {
		usages = append(usages, CertUsageUnknown)
	}
	return usages
}

// GetCertStatus determines the status of a certificate based on its validity period
func GetCertStatus(cert *x509.Certificate, now time.Time, warn time.Time) string {
	if now.Before(cert.NotBefore) {
		return CertStatusNotYetValid
	} else if now.After(cert.NotAfter) {
		return CertStatusExpired
	} else if warn.After(cert.NotAfter) {
		return CertStatusWarning
	}
	return CertStatusOK
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #14731** (2026-10-01): **[main] Update stable to `v1.36.5+k3s1`**
  *Symptoms*: <!-- HTML Comments can be left in place or removed. --> <!-- Please see our contributing guide at https://github.com/k3s-io/k3s/blob/main/CONTRIBUTING.md for guidance on opening pull requests -->  #### Proposed Changes ####  <!-- Describe the big picture of your changes here to communicate to the maintainers why we should accept this pull request. -->  #### Types of Changes ####  <!-- What types of changes does your code introduce to K3s? Bugfix, New Feature, Breaking Change, etc -->  #### Verification ####  <!-- How can the changes be verified? Please provide whatever additional information necessary to help verify the proposed changes. -->  #### Testing ####  <!-- Is this change covered by testing? If not, consider adding a Unit or Integration test. --> <!-- See https://github.com/k3s-io/k3s/blob/main/tests/TESTING.md for more info -->  #### Linked Issues ####  <!-- Link any related issues, pull-requests, or commit hashes that are relevant to this pull request. If you are opening a PR without a corresponding issue please consider creating one first, at https://github.com/k3s-io/k3s/issues . A functional example will greatly help QA with verifying/reproducing a bug or testing new features. -->  #### User-Facing Change #### <!-- Does this PR introduce a user-facing change? If no, just write "NONE" in the release-note block below. If the PR requires additional action from users switching to the new release, include the string "action required". -->

- **Issue #14729** (2026-10-01): **kubelet DiskPressure condition latches True for hours after nodefs recovers above evictionHard threshold**
  *Symptoms*: ## Summary On k3s v1.36.3+k3s1, once the eviction manager enters disk-pressure eviction, the node `DiskPressure` condition (and its `node.kubernetes.io/disk-pressure:NoSchedule` taint) can remain `True` for many hours **after** the node filesystem has recovered well above the `evictionHard` threshold. Restarting the k3s service (embedded kubelet) flips the condition to `False` within a minute, so kubelet never clears it on its own.  ## Environment - k3s v1.36.3+k3s1 (single binary, control-plane+worker on affected nodes; also observed on agent-only nodes) - kubelet config (from `/var/lib/rancher/k3s/agent/etc/kubelet.conf.d/00-k3s-defaults.conf`):   - `evictionHard: { imagefs.available: 5%, nodefs.available: 5% }`   - `evictionPressureTransitionPeriod: 5m0s` - ext4 root filesystem, single partition (nodefs == imagefs)  ## Observed sequence (2026-09-29/30, two nodes) 1. Root fs crosses 5% available at 22:10Z / 03:08Z → kubelet correctly taints node and evicts pods (`Evicted: The node was low on resource: ephemeral-storage`). 2. Space is freed back above threshold (20.5 GiB available of 322 GiB ≈ 6.4% — above 5% within ~an hour; later 21+ GiB). 3. `/api/v1/nodes/<node>/proxy/stats/summary` reports `availableBytes/capacityBytes` consistently **above** the 5% threshold from that point on. 4. `DiskPressure` condition stays `status: True, reason: KubeletHasDiskPressure` for **12h** (fsn node, 22:10Z→next-day 10:12Z) and **7h** (nue node). Eviction-manager log loops continuously:   
  **Post-Mortem & Fix Analysis**:
  > None of the affected kubelet or containerd code is maintained in this project, or affected by the minor changes we make to upstream code to allow embedding multiple components in a single binary. For this reason, the issue cannot be resolved here.  Please open an issue reporting this behavior with the correct upstream project.
  > I will also note that your host is complaining about being low on ephemeral-storage (tmpfs), not root fs space. Are you sure that you are looking at the correct metrics when determining that the disk pressure warning is incorrect?

- **Issue #14728** (2026-09-30): **[release-1.33] Bump etcd and helm-controller**
  *Symptoms*: #### Proposed Changes ####  Backport bumps of etcd and helm-controller.  #### Types of Changes ####  Version bumps   #### Verification ####  CI  #### Testing ####   #### Linked Issues #### n/a - will not be doing another k3s release; just need these for a new rke2 prime-only 1.33 release.  #### User-Facing Change #### ```release-note ```  #### Further Comments #### 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/k3s-io/k3s/pull/14728?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=k3s-io) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 50.43%. Comparing base ([`875e930`](https://app.codecov.io/gh/k3s-io/k3s/commit/875e930d812e17f955cfb3a4817ad33cce3c6822?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=k3s-io)) to head ([`91af652`](https://app.codecov.io/gh/k3s-io/k3s/commit/91af652d4b416a909009d57744d6501d01c5bcef?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=k3s-io)).  <details><summary>Additional details and impacted files</summary>    ```diff @@               Coverage Diff                @@ ##           release-1.33   #14728      +/-   ## ==============================

- **Issue #14727** (2026-10-02): **[Release 1.37] Add gateway-api-crd to help**
  *Symptoms*: Issue: https://github.com/k3s-io/k3s/issues/14723 Backport: https://github.com/k3s-io/k3s/pull/14681
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/k3s-io/k3s/pull/14727?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=k3s-io) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 51.36%. Comparing base ([`356c025`](https://app.codecov.io/gh/k3s-io/k3s/commit/356c025475bbefaa09cf0d7e48e8e2adbbde57db?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=k3s-io)) to head ([`7bbd34d`](https://app.codecov.io/gh/k3s-io/k3s/commit/7bbd34d40e8546ad331860197af1ae01bed51b43?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=k3s-io)).  <details><summary>Additional details and impacted files</summary>    ```diff @@               Coverage Diff                @@ ##           release-1.37   #14727      +/-   ## ==============================
  > waiting for code freeze to end

- **Issue #14726** (2026-09-30): **[Release-1.34] - [1.37] Missing Gateway API CRD**
  *Symptoms*: Backport fix for [1.37] Missing Gateway API CRD  * #14677
  **Post-Mortem & Fix Analysis**:
  > only needed for 1.37  

- **Issue #14725** (2026-09-30): **[Release-1.35] - [1.37] Missing Gateway API CRD**
  *Symptoms*: Backport fix for [1.37] Missing Gateway API CRD  * #14677
  **Post-Mortem & Fix Analysis**:
  > only needed for 1.37

- **Issue #14724** (2026-09-30): **[Release-1.36] - [1.37] Missing Gateway API CRD**
  *Symptoms*: Backport fix for [1.37] Missing Gateway API CRD  * #14677
  **Post-Mortem & Fix Analysis**:
  > only needed for 1.37  

- **Issue #14722** (2026-09-30): **Reconcile ServiceLB DaemonSet nodeSelector when enablelb label is removed**
  *Symptoms*: <!-- Please read the contributor guidelines before submitting a pull request: https://github.com/k3s-io/k3s/blob/master/CONTRIBUTING.md -->  #### What type of PR is this? /kind bug  #### What this PR does / why we need it: When users restrict ServiceLB using the `svccontroller.k3s.cattle.io/enablelb` label on specific nodes, and subsequently remove that label from all nodes, `onChangeNode` previously returned early because `node.Labels[daemonsetNodeLabel]` was absent on the changed node.  As a result, `updateDaemonSets()` was never invoked upon label removal, leaving the ServiceLB DaemonSet with a stale `nodeSelector` indefinitely and preventing ServiceLB pods from returning to running across all nodes.  This PR removes the early return guard in `onChangeNode` so `updateDaemonSets()` reconciles DaemonSet `nodeSelector` whenever node labels change.  #### Which issue(s) this PR fixes: Fixes #14625 
  **Post-Mortem & Fix Analysis**:
  > There is already a PR for this. Ref: * https://github.com/k3s-io/k3s/pull/14626#issuecomment-5709394151 * https://github.com/k3s-io/k3s/pull/14550

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

### Incident Patch 1: `43178a91` (2026-09-30)
**Commit Message**: docs: fix anchor case and target in GOVERNANCE.md

Signed-off-by: yuwk <[REDACTED_EMAIL]>

**File**: `GOVERNANCE.md` (modified, +10/-10)
```diff
@@ -9,7 +9,7 @@ This governance explains how the K3s project is run. As such that's a living doc
 - [CNCF Resources](#cncf-resources)  
 - [Code of Conduct Enforcement](#code-of-conduct)  
 - [Security Response Team](#security-response-team)  
-- [Voting](#voting)  
+- [Voting](#voting-and-decision-making)  
 - [Modifications](#modifying-this-charter)
 
 ## Values
@@ -64,7 +64,7 @@ Anyone is eligible to become a Maintainer, you need to demonstrate a few or more
 * understanding of how the team works (policies, processes for testing and code review, etc),  
 * understanding of the project's code base and coding and documentation style.
 
-A new Maintainer must be proposed by an existing Maintainer by sending a message to the [developer mailing list](mailto:k3s-maintainers@lists.cncf.io) and opening PR in [MAINTAINERS](https://github.com/k3s-io/k3s/blob/main/MAINTAINERS). A [supermajority](#Supermajority) vote of existing Maintainers approves the application.  Maintainer nominations will be evaluated without prejudice to employer or demographics.
+A new Maintainer must be proposed by an existing Maintainer by sending a message to the [developer mailing list](mailto:k3s-maintainers@lists.cncf.io) and opening PR in [MAINTAINERS](https://github.com/k3s-io/k3s/blob/main/MAINTAINERS). A [supermajority](#supermajority) vote of existing Maintainers approves the application.  Maintainer nominations will be evaluated without prejudice to employer or demographics.
 
 Maintainers who are selected will be granted the necessary GitHub rights, and invited to the [private Maintainer mailing list](mailto:k3s-maintainers@lists.cncf.io).
 
@@ -86,7 +86,7 @@ Maintainers may resign at any time if they feel that they will not be able to co
 
 Maintainers may also be removed after being inactive, failure to fulfill their Maintainer responsibilities, violating the Code of Conduct, or other reasons. Inactivity is defined as a period of very low or no activity in the project for a year or more, with no definite schedule to return to full Maintainer activity.
 
-A Maintainer may be removed at any time by a [supermajority](#Supermajority) vote of the remaining Maintainers.
+A Maintainer may be removed at any time by a [supermajority](#supermajority) vote of the remaining Maintainers.
 
 Depending on the reason for removal, a Maintainer may be converted to Emeritus status.  Emeritus Maintainers will still be consulted on some project matters, and can be rapidly returned   
 to Maintainer status if their availability changes.
@@ -98,7 +98,7 @@ Reviewers are able to review code for quality and correctness on some part of a
 
 * Knowledgeable about the codebase  
 * Sponsored by a Maintainer  
-* New reviewer must be nominated by an existing Maintainer or reviewer or self-nominated and must be elected by a [supermajority](#Supermajority) of existing Maintainers
+* New reviewer must be nominated by an existing Maintainer or reviewer or self-nominated and must be elected by a [supermajority](#supermajority) of existing Maintainers
 
 **Responsibilities and privileges**
 
@@ -157,23 +157,23 @@ Examples:
 While most business in K3s is conducted by "[lazy consensus](https://community.apache.org/committers/lazyConsensus.html)", periodically the Maintainers may need to vote on specific actions or changes. A vote can be taken on [the developer mailing list](mailto:cncf-k3s-dev@lists.cncf.io) or [the private Maintainer mailing list](mailto:cncf-k3s-maintainers@lists.cncf.io) for security or conduct matters.  
 Votes may also be taken at [the community meeting](https://k3s.io/community/#community-meetings).  Any Maintainer may demand a vote be taken.
 
-Most votes require a [simple majority](#simple-majority) of all Maintainers to succeed, except where otherwise noted.  [Supermajority](#Supermajority) votes mean at least two-thirds of all existing Maintainers.
+Most votes require a [simple majority](#simple-majority) of all Maintainers to succeed, except where otherwise noted.  [Supermajority](#supermajority) votes mean at least two-thirds of all existing Maintainers.
 
-Ideally, all project decisions are resolved by consensus. If impossible, any Maintainer may call a vote. Unless otherwise specified in this document, any vote will be decided by a [supermajority](#Supermajority) of Maintainers.
+Ideally, all project decisions are resolved by consensus. If impossible, any Maintainer may call a vote. Unless otherwise specified in this document, any vote will be decided by a [supermajority](#supermajority) of Maintainers.
 
 In case of situation with not enough participation from maintainer for **non** critical decision we can lower the supermajority to [**simple majority**](#simple-majority).
 
 For any **critital** decisions [CNCF TOC](https://www.cncf.io/people/technical-oversight-committee/) should be consulted for approvals and moving forward.
 
 ## Voting requirements:
 
-* Adding a Maintainer: [Supermajority](#Supermajority)
+* Adding a Maintain
```

---

### Incident Patch 2: `bb14efb4` (2026-09-04)
**Commit Message**: Adapt fix for Kubernetes 1.37 NamedAuthorizer

Signed-off-by: Brad Davidson <[REDACTED_EMAIL]>

**File**: `pkg/server/auth/auth.go` (modified, +8/-2)
```diff
@@ -126,10 +126,16 @@ func Delegated(clientCA, kubeConfig string, config *server.Config) mux.Middlewar
 	// access to unauthenticated users, even if authn.Anonymous is disabled.
 	registryAuth, err := NewNonResourceGroupAuthorizer(user.AllAuthenticated, "/v1-"+version.Program+"/p2p", "/v2/*")
 	if err != nil {
-		logrus.Fatalf("Failed to create authorizer: %v", err)
+		logrus.Fatalf("Failed to create group authorizer: %v", err)
 	}
 
-	config.Authorization.Authorizer = union.New(registryAuth, config.Authorization.Authorizer)
+	config.Authorization.Authorizer, err = union.New(
+		union.NamedAuthorizer{AuthorizerName: "registry", Authorizer: registryAuth},
+		union.NamedAuthorizer{AuthorizerName: "core", Authorizer: config.Authorization.Authorizer},
+	)
+	if err != nil {
+		logrus.Fatalf("Failed to create union authorizer: %v", err)
+	}
 
 	return func(handler http.Handler) http.Handler {
 		handler = genericapifilters.WithAuthorization(handler, config.Authorization.Authorizer, scheme.Codecs)
```

**File**: `tests/e2e/embeddedmirror/embeddedmirror_test.go` (modified, +5/-1)
```diff
@@ -191,7 +191,11 @@ var _ = Describe("Verify Create", Ordered, func() {
 				res, err := tc.Servers[0].RunCmdOnNode("curl -ks -o /dev/null -w '%{response_code}' https://localhost:6443" + path)
 				fmt.Println("curl " + path + ": " + res)
 				Expect(err).ToNot(HaveOccurred())
-				Expect(res).To(ContainSubstring("401"), "unexpected response to "+path)
+				if path == "/debug/pprof/" {
+					Expect(res).To(ContainSubstring("401"), "unexpected response to "+path)
+				} else {
+					Expect(res).To(ContainSubstring("403"), "unexpected response to "+path)
+				}
 			}
 		})
 	})
```

---

### Incident Patch 3: `86a77cb0` (2026-09-23)
**Commit Message**: fix: bump cadvisor to v0.60.5-k3s1

cadvisor needs to be bumped to the fork of k3s-io
because we need to make easir for k3s to reach
the argContainerdRuntime variable in lib/containerd
because upstream deprecated from kubelet the --containerd

Signed-off-by: Vitor Savian <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ replace (
 	github.com/docker/docker => github.com/docker/docker v25.0.15-0.20260325154711-d2dbc0547253+incompatible
 	github.com/emicklei/go-restful/v3 => github.com/emicklei/go-restful/v3 v3.13.0
 	github.com/golang/protobuf => github.com/golang/protobuf v1.5.4
+	github.com/google/cadvisor/lib => github.com/k3s-io/cadvisor/lib v0.60.5-k3s1
 	github.com/googleapis/gax-go/v2 => github.com/googleapis/gax-go/v2 v2.12.0
 	github.com/opencontainers/runc => github.com/opencontainers/runc v1.4.2
 	github.com/opencontainers/selinux => github.com/opencontainers/selinux v1.15.1
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -898,8 +898,6 @@ github.com/google/btree v0.0.0-20180813153112-4030bb1f1f0c/go.mod h1:lNA+9X1NB3Z
 github.com/google/btree v1.0.0/go.mod h1:lNA+9X1NB3Zf8V7Ke586lFgjr2dZNuvo3lPJSGZ5JPQ=
 github.com/google/btree v1.1.3 h1:CVpQJjYgC4VbzxeGVHfvZrv1ctoYCAI8vbl07Fcxlyg=
 github.com/google/btree v1.1.3/go.mod h1:qOPhT0dTNdNzV6Z/lhRX0YXUafgPLFUh+gZMl761Gm4=
-github.com/google/cadvisor/lib v0.60.5 h1:C2Ty0ccuKDQnFW4vCSa58wmjc26jL6GiwGEY00pQcIg=
-github.com/google/cadvisor/lib v0.60.5/go.mod h1:htHKT0OSYO6zaik+iLOo3Wj1mf/5l8uV5TJaqLz13oM=
 github.com/google/cel-go v0.29.2 h1:ZtDxkeiMmz0mxbKDYiNkE5Lk7V5edMRcaaDf2jX002k=
 github.com/google/cel-go v0.29.2/go.mod h1:X0bD6iVNR8pkROSOoHVdgTkzmRcosof7WQqCD6wcMc8=
 github.com/google/certtostore v1.0.6 h1:LlCIgyTvDxTlcncMPTSYZGo6lCsiHzO6Dy7ff6ltk/0=
@@ -1145,6 +1143,8 @@ github.com/jung-kurt/gofpdf v1.0.0/go.mod h1:7Id9E/uU8ce6rXgefFLlgrJj/GYY22cpxn+
 github.com/jung-kurt/gofpdf v1.0.3-0.20190309125859-24315acbbda5/go.mod h1:7Id9E/uU8ce6rXgefFLlgrJj/GYY22cpxn+r32jIOes=
 github.com/k3s-io/api v0.2.1 h1:ZYFsqUOgTlM1Se3vpX7cBDQWTE8eDD+9320rIqQOV50=
 github.com/k3s-io/api v0.2.1/go.mod h1:IPDLtbGvkL/yDR6ZJ17jhd/E15CUYVsnyqAHst+ULvo=
+github.com/k3s-io/cadvisor/lib v0.60.5-k3s1 h1:gioY2x/gAfFuXQoYAq1TVzmdyYhcDUM0FZoMNlWaeQc=
+github.com/k3s-io/cadvisor/lib v0.60.5-k3s1/go.mod h1:htHKT0OSYO6zaik+iLOo3Wj1mf/5l8uV5TJaqLz13oM=
 github.com/k3s-io/containerd/v2 v2.3.4-k3s1 h1:3w5iV0q9rhexGIQcBHl98R+vFN5AJqvgEophEE0qcPI=
 github.com/k3s-io/containerd/v2 v2.3.4-k3s1/go.mod h1:HWD6AVjqEzsxoI9hwhBiO4RKKkbwFzIETBzgDaZNjCI=
 github.com/k3s-io/cri-dockerd v0.3.19-k3s5 h1:LymM6LDgeqeEhxAdmVYuqucatFEOiWHqsp8hXAaJODc=
```

**File**: `pkg/daemons/agent/agent_linux.go` (modified, +3/-2)
```diff
@@ -5,11 +5,11 @@ package agent
 import (
 	"errors"
 	"net"
+	"os"
 	"path/filepath"
 	"strconv"
 	"strings"
 
-	cadvisorcontainerd "github.com/google/cadvisor/lib/container/containerd"
 	"github.com/k3s-io/k3s/pkg/cgroups"
 	"github.com/k3s-io/k3s/pkg/daemons/config"
 	"github.com/k3s-io/k3s/pkg/util"
@@ -92,7 +92,8 @@ func kubeletArgsAndConfig(cfg *config.Agent) (map[string]string, *kubeletconfig.
 		// used to expose this as a --containerd flag, but stopped registering it in v1.37, and
 		// does not pass its own runtime endpoint through.
 		if strings.Contains(cfg.RuntimeSocket, "containerd") {
-			*cadvisorcontainerd.ArgContainerdEndpoint = strings.TrimPrefix(cfg.RuntimeSocket, socketPrefix)
+			runtimeWithoutPrefix := strings.TrimPrefix(cfg.RuntimeSocket, socketPrefix)
+			os.Setenv("CADVISOR_CONTAINERD_ENDPOINT", runtimeWithoutPrefix)
 		}
 		// cadvisor wants the containerd CRI socket without the prefix, but kubelet wants it with the prefix
 		if strings.HasPrefix(cfg.RuntimeSocket, socketPrefix) {
```

---

### Incident Patch 4: `3a2ad3c3` (2026-09-16)
**Commit Message**: Register network test in CI for amd64 and fix log string mismatch in network_test.go

Signed-off-by: sRiSh-JaNa-tech <[REDACTED_EMAIL]>

**File**: `.github/workflows/e2e.yaml` (modified, +3/-1)
```diff
@@ -161,7 +161,7 @@ jobs:
     strategy:
       fail-fast: false
       matrix:
-        dtest: [autoimport, basics, bootstraptoken, cacerts, dualstack, etcd, t4, hardened, lazypull, nixsnapshotter, skew, secretsencryption, snapshotrestore, svcpoliciesandfirewall, token, upgrade]
+        dtest: [autoimport, basics, bootstraptoken, cacerts, dualstack, etcd, t4, hardened, lazypull, network, nixsnapshotter, skew, secretsencryption, snapshotrestore, svcpoliciesandfirewall, token, upgrade]
         arch: [amd64, arm64]
         exclude:
           - dtest: autoimport
@@ -176,6 +176,8 @@ jobs:
             arch: arm64
           - dtest: svcpoliciesandfirewall
             arch: arm64
+          - dtest: network
+            arch: arm64
     runs-on: ${{ matrix.arch == 'arm64' && 'ubuntu-24.04-arm' || 'ubuntu-latest' }}
     steps:
     - name: Remove Unnecessary Tools
```

**File**: `tests/docker/network/network_test.go` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ var _ = Describe("Network Tests", Ordered, func() {
 			// Instead of crashing instantly, it should hold in your retry loop
 			Eventually(func() (string, error) {
 				return tests.RunCommand(fmt.Sprintf("docker logs %s", containerName))
-			}, "20s", "2s").Should(ContainSubstring("Waiting for default network route to become available..."))
+			}, "20s", "2s").Should(ContainSubstring("Node address auto-detection requires default route but no default route is available, waiting up to 60 seconds for it to appear..."))
 		})
 
 		It("Restores the network dynamically", func() {
```

---

### Incident Patch 5: `387700c0` (2026-08-19)
**Commit Message**: Fix network retry logic and add E2E test

Signed-off-by: Srish Jana <[REDACTED_EMAIL]>

**File**: `pkg/etcd/etcd.go` (modified, +4/-3)
```diff
@@ -55,7 +55,6 @@ import (
 	v1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/labels"
-	utilnet "k8s.io/apimachinery/pkg/util/net"
 	"k8s.io/apimachinery/pkg/util/wait"
 )
 
@@ -880,11 +879,13 @@ func toTLSConfig(runtime *config.ControlRuntime) (*tls.Config, error) {
 	}, nil
 }
 
-// getAdvertiseAddress returns the IP address best suited for advertising to clients
+// getAdvertiseAddress returns the IP address best suited for advertising to clients.
+// When no advertise IP is configured, it uses ChooseHostInterfaceWithRetry to
+// wait for a default network route to become available during startup.
 func getAdvertiseAddress(advertiseIP string) (string, error) {
 	ip := advertiseIP
 	if ip == "" {
-		ipAddr, err := utilnet.ChooseHostInterface()
+		ipAddr, err := util.ChooseHostInterfaceWithRetry()
 		if err != nil {
 			return "", err
 		}
```

**File**: `pkg/util/net.go` (modified, +32/-1)
```diff
@@ -11,6 +11,7 @@ import (
 
 	"github.com/sirupsen/logrus"
 	apinet "k8s.io/apimachinery/pkg/util/net"
+	"k8s.io/apimachinery/pkg/util/wait"
 	netutils "k8s.io/utils/net"
 )
 
@@ -132,13 +133,43 @@ func JoinIP6Nets(elems []*net.IPNet) string {
 	return strings.Join(strs, ",")
 }
 
+// ChooseHostInterfaceWithRetry wraps ChooseHostInterfaceWithContext with a default context.
+func ChooseHostInterfaceWithRetry() (net.IP, error) {
+	return ChooseHostInterfaceWithContext(context.TODO())
+}
+
+// ChooseHostInterfaceWithContext wraps apinet.ChooseHostInterface with a retry loop
+// that waits for a default network route to become available during startup.
+func ChooseHostInterfaceWithContext(ctx context.Context) (net.IP, error) {
+	var ip net.IP
+	first := true
+	err := wait.PollUntilContextTimeout(ctx, 5*time.Second, 60*time.Second, true, func(ctx context.Context) (bool, error) {
+		var err error
+		ip, err = apinet.ChooseHostInterface()
+		if err == nil {
+			return true, nil
+		}
+		if first {
+			logrus.Infof("Waiting for default network route to become available...")
+			first = false
+		}
+		return false, nil
+	})
+	if err != nil {
+		return nil, err
+	}
+	return ip, nil
+}
+
 // GetHostnameAndIPs takes a node name and list of IPs, usually from CLI args.
 // If set, these are used to return the node's name and addresses. If not set,
 // the system hostname and primary interface addresses are returned instead.
+// When no node IPs are provided and the host has no default route yet,
+// the lookup is retried until a route becomes available or the timeout is reached.
 func GetHostnameAndIPs(name string, nodeIPs []string) (string, []net.IP, error) {
 	ips := []net.IP{}
 	if len(nodeIPs) == 0 {
-		hostIP, err := apinet.ChooseHostInterface()
+		hostIP, err := ChooseHostInterfaceWithRetry()
 		if err != nil {
 			return "", nil, err
 		}
```

**File**: `tests/docker/network/network_test.go` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+package network
+
+import (
+	"flag"
+	"fmt"
+	"os"
+	"path/filepath"
+	"strings"
+	"testing"
+
+	"github.com/k3s-io/k3s/tests"
+	. "github.com/onsi/ginkgo/v2"
+	. "github.com/onsi/gomega"
+)
+
+var k3sImage = flag.String("k3sImage", "rancher/k3s:latest", "The image used to provision containers")
+
+func Test_DockerNetwork(t *testing.T) {
+	flag.Parse()
+	RegisterFailHandler(Fail)
+	RunSpecs(t, "Network Docker Test Suite")
+}
+
+var _ = Describe("Network Tests", Ordered, func() {
+	Context("Verify startup with temporarily missing default route", func() {
+		var containerName string
+
+		It("Starts K3s with default route removed", func() {
+			containerName = "k3s-network-test"
+			
+			// Get path to locally compiled binary directory
+			pwd, _ := os.Getwd()
+			artifactDir := filepath.Join(pwd, "..", "..", "..", "dist", "artifacts")
+			
+			// Clean up any lingering container from past test runs
+			tests.RunCommand(fmt.Sprintf("docker rm -f %s", containerName))
+
+			// Boot K3s container, removing the default route before K3s starts.
+			dRun := strings.Join([]string{"docker run -d",
+				"--name", containerName,
+				"--hostname", containerName,
+				"--privileged",
+				"-e K3S_DEBUG=true",
+				fmt.Sprintf("--mount type=bind,source=%s,target=/opt/artifacts", artifactDir),
+				"--entrypoint sh",
+				*k3sImage,
+				"-c",
+				`"ip route del default && /opt/artifacts/k3s server"`}, " ")
+
+			out, err := tests.RunCommand(dRun)
+			Expect(err).NotTo(HaveOccurred(), "failed to run server container: %s", out)
+		})
+
+		It("Verifies the retry loop is active and waiting", func() {
+			// Instead of crashing instantly, it should hold in your retry loop
+			Eventually(func() (string, error) {
+				return tests.RunCommand(fmt.Sprintf("docker logs %s", containerName))
+			}, "20s", "2s").Should(ContainSubstring("Waiting for default network route to become available..."))
+		})
+
+		It("Restores the network dynamically", func() {
+			// Find the default gateway for this container from docker inspect
+			inspectCmd := fmt.Sprintf("docker inspect --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}' %s", containerName)
+			gateway, err := tests.RunCommand(inspectCmd)
+			Expect(err).NotTo(HaveOccurred(), "failed to get gateway: %s", gateway)
+			gateway = strings.Trim(strings.TrimSpace(gateway), "'")
+
+			// Restore the default route dynamically while the container is running
+			addRouteCmd := fmt.Sprintf("docker exec %s ip route add default via %s dev eth0", containerName, gateway)
+			out, err := tests.RunCommand(addRouteCmd)
+			Expect(err).NotTo(HaveOccurred(), "failed to restore default route: %s", out)
+		})
+
+		It("Verifies K3s recovers and successfully starts up", func() {
+			// We query the nodes directly from within the container using our local binary
+			Eventually(func() (string, error) {
+				cmd := fmt.Sprintf("docker exec %s /opt/artifacts/k3s kubectl get nodes", containerName)
+				return tests.RunCommand(cmd)
+			}, "120s", "5s").Should(ContainSubstring("Ready"))
+		})
+
+		It("Cleans up the container", func() {
+			_, err := tests.RunCommand(fmt.Sprintf("docker rm -f %s", containerName))
+			Expect(err).NotTo(HaveOccurred())
+		})
+	})
+})
```

---

### Incident Patch 6: `a1b4b6e0` (2026-09-01)
**Commit Message**: fix: always re-check manifest checksum for files with epoch mtime

The deploy controller's modTime gate skipped deploy() entirely when a
manifest's mtime was unchanged, so the checksum comparison in deploy()
was never reached. On filesystems that pin all mtimes to a fixed value,
such as NixOS /nix/store (epoch), manifest updates were silently ignored.

Files whose mtime is pinned to the epoch cannot register content changes
via mtime, so skip the modTime gate for them and let the existing
checksum comparison decide whether to re-apply.

Signed-off-by: Cola-Hakari <[REDACTED_EMAIL]>

**File**: `pkg/deploy/controller.go` (modified, +6/-1)
```diff
@@ -44,6 +44,11 @@ const (
 	gvkSep         = ";"
 )
 
+// epoch is the fixed mtime that some immutable filesystems (e.g. NixOS /nix/store)
+// pin all files to. Such files never register content changes via mtime, so they
+// must always be re-checked against the Addon checksum.
+var epoch = time.Unix(0, 0)
+
 // WatchFiles sets up an OnChange callback to start a periodic goroutine to watch files for changes once the controller has started up.
 func WatchFiles(ctx context.Context, client kubernetes.Interface, apply apply.Apply, addons controllersv1.AddonController, disables map[string]bool, bases ...string) error {
 	w := &watcher{
@@ -156,7 +161,7 @@ func (w *watcher) listFilesIn(base string, force bool) error {
 			continue
 		}
 		modTime := files[path].ModTime()
-		if !force && modTime.Equal(w.modTime[path]) {
+		if !force && !modTime.Equal(epoch) && modTime.Equal(w.modTime[path]) {
 			continue
 		}
 		if err := w.deploy(path, !force); err != nil {
```

**File**: `pkg/deploy/controller_test.go` (modified, +128/-0)
```diff
@@ -4,6 +4,15 @@ import (
 	"os"
 	"path/filepath"
 	"testing"
+	"time"
+
+	apisv1 "github.com/k3s-io/api/k3s.cattle.io/v1"
+	clientsetfake "github.com/k3s-io/api/pkg/generated/clientset/versioned/fake"
+	applyfake "github.com/rancher/wrangler/v3/pkg/apply/fake"
+	genericfake "github.com/rancher/wrangler/v3/pkg/generic/fake"
+	"go.uber.org/mock/gomock"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/client-go/tools/record"
 )
 
 func Test_UnitWalkFilesSymlinkedDirectoryUsesLogicalPaths(t *testing.T) {
@@ -70,3 +79,122 @@ func fileKeys(files map[string]watchedFile) []string {
 	}
 	return keys
 }
+
+// newTestWatcher returns a watcher whose Addon cache and client calls are wired
+// to a fake clientset. The fake clientset doesn't assign UIDs like the real API
+// server does, so the Addon is pre-created with one set; deploy() treats an
+// empty UID as a new Addon and attempts to create it.
+func newTestWatcher(t *testing.T, apply *applyfake.FakeApply) *watcher {
+	t.Helper()
+
+	clientset := clientsetfake.NewSimpleClientset(&apisv1.Addon{ObjectMeta: metav1.ObjectMeta{Namespace: metav1.NamespaceSystem, Name: "manifest", UID: "test-uid"}})
+	addons := clientset.K3sV1().Addons(metav1.NamespaceSystem)
+
+	ctrl := gomock.NewController(t)
+	addonCache := genericfake.NewMockCacheInterface[*apisv1.Addon](ctrl)
+	addonClient := genericfake.NewMockClientInterface[*apisv1.Addon, *apisv1.AddonList](ctrl)
+	addonCache.EXPECT().Get(gomock.Any(), gomock.Any()).AnyTimes().DoAndReturn(func(_, name string) (*apisv1.Addon, error) {
+		return addons.Get(t.Context(), name, metav1.GetOptions{})
+	})
+	addonClient.EXPECT().Create(gomock.Any()).AnyTimes().DoAndReturn(func(a *apisv1.Addon) (*apisv1.Addon, error) {
+		return addons.Create(t.Context(), a, metav1.CreateOptions{})
+	})
+	addonClient.EXPECT().Update(gomock.Any()).AnyTimes().DoAndReturn(func(a *apisv1.Addon) (*apisv1.Addon, error) {
+		return addons.Update(t.Context(), a, metav1.UpdateOptions{})
+	})
+
+	return &watcher{
+		apply:      apply,
+		addonCache: addonCache,
+		addons:     addonClient,
+		modTime:    map[string]time.Time{},
+		recorder:   record.NewFakeRecorder(100),
+		discovery:  clientset.Discovery(),
+	}
+}
+
+func Test_UnitListFilesInAppliesOnContentChangeDespiteUnchangedModTime(t *testing.T) {
+	base := t.TempDir()
+	manifest := filepath.Join(base, "manifest.yaml")
+	contentA := "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: test\n"
+	contentB := "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: test\n  labels:\n    changed: \"true\"\n"
+
+	// Simulate filesystems (e.g. NixOS /nix/store) that pin all mtimes to the
+	// epoch, so mtime never changes even when file content does.
+	fixedMtime := time.Unix(0, 0)
+
+	writeManifest := func(content string) {
+		t.Helper()
+		if err := os.WriteFile(manifest, []byte(content), 0644); err != nil {
+			t.Fatal(err)
+		}
+		if err := os.Chtimes(manifest, fixedMtime, fixedMtime); err != nil {
+			t.Fatal(err)
+		}
+	}
+
+	apply := &applyfake.FakeApply{}
+	w := newTestWatcher(t, apply)
+
+	// First pass is forced, so the manifest is applied and its checksum recorded.
+	writeManifest(contentA)
+	if err := w.listFilesIn(base, true); err != nil {
+		t.Fatal(err)
+	}
+	if apply.Count != 1 {
+		t.Fatalf("expected initial apply, got %d", apply.Count)
+	}
+
+	// Second (non-forced) pass must detect the content change via checksum even
+	// though mtime is unchanged, and apply it again.
+	writeManifest(contentB)
+	if err := w.listFilesIn(base, false); err != nil {
+		t.Fatal(err)
+	}
+	if apply.Count != 2 {
+		t.Fatalf("expected changed content to be applied despite unchanged mtime, got %d applies", apply.Count)
+	}
+}
+
+func Test_UnitListFilesInSkipsUnchangedNormalModTime(t *testing.T) {
+	base := t.TempDir()
+	manifest := filepath.Join(base, "manifest.yaml")
+	contentA := "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: test\n"
+	contentB := "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: test\n  labels:\n    changed: \"true\"\n"
+
+	// A normal (non-epoch) mtime: the modTime gate trusts it and skips the file
+	// when it is unchanged.
+	fixedMtime := time.Unix(1000000, 0)
+
+	writeManifest := func(content string) {
+		t.Helper()
+		if err := os.WriteFile(manifest, []byte(content), 0644); err != nil {
+			t.Fatal(err)
+		}
+		if err := os.Chtimes(manifest, fixedMtime, fixedMtime); err != nil {
+			t.Fatal(err)
+		}
+	}
+
+	apply := &applyfake.FakeApply{}
+	w := newTestWatcher(t, apply)
+
+	// First pass is forced, so the manifest is applied and its checksum recorded.
+	writeManifest(contentA)
+	if err := w.listFilesIn(base, true); err != nil {
+		t.Fatal(err)
+	}
+	if apply.Count != 1 {
+		t.Fatalf("expected initial apply, got %d", apply.Count)
+	}
+
+	// Content changes but mtime does not: files with a normal mtime are skipped
+	// based on mtime alone, per the gate retained in listFilesIn.
+	writeManifest(contentB)
+	if err := w.listFilesIn(base, false); err != nil {
+		t.Fatal(err)
+	}
+	if ap
```

---

### Incident Patch 7: `20cf9ea1` (2026-09-08)
**Commit Message**: Fix --flannel-cni-conf not reaching the embedded flannel

Signed-off-by: Matt Read <[REDACTED_EMAIL]>

**File**: `.github/workflows/integration.yaml` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ jobs:
       fail-fast: false
       matrix:
         # Ordered longest-first from CI timings to reduce matrix tail latency.
-        itest: [startup, etcdsnapshot, kubeflags, cacertrotation, longhorn, secretsencryption, certrotation, etcdrestore, localstorage, flannelnone, custometcdargs]
+        itest: [startup, etcdsnapshot, kubeflags, cacertrotation, longhorn, secretsencryption, certrotation, etcdrestore, localstorage, flannelnone, flannelcniconf, custometcdargs]
       max-parallel: 5
     steps:
     - name: Remove Unnecessary Tools
```

**File**: `pkg/executor/embed/embed.go` (modified, +1/-0)
```diff
@@ -181,6 +181,7 @@ func (e *Embedded) Bootstrap(ctx context.Context, nodeConfig *daemonconfig.Node,
 			nodeConfig.Flannel.ConfFile = cfg.FlannelConf
 			nodeConfig.Flannel.ConfOverride = true
 		}
+		nodeConfig.Flannel.CNIConfFile = cfg.FlannelCniConfFile
 		nodeConfig.AgentConfig.CNIBinDir = filepath.Dir(hostLocal)
 		nodeConfig.AgentConfig.CNIConfDir = filepath.Join(cfg.DataDir, "agent", "etc", "cni", "net.d")
 
```

**File**: `tests/integration/flannelcniconf/flannelcniconf_int_test.go` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+/*
+This test verifies that the file passed as --flannel-cni-conf is what the embedded flannel
+installs as the CNI conflist, rather than the built-in template. The custom file is the
+built-in template with an mtu on the bridge delegate, a typical use of the flag, so the
+node must also still come up with it.
+*/
+package integration
+
+import (
+	"os"
+	"path/filepath"
+	"strings"
+	"testing"
+
+	tests "github.com/k3s-io/k3s/tests"
+	testutil "github.com/k3s-io/k3s/tests/integration"
+	. "github.com/onsi/ginkgo/v2"
+	. "github.com/onsi/gomega"
+)
+
+// The conflist the embedded flannel writes, under the default data dir the harness cleans up.
+const installedCNIConf = "/var/lib/rancher/k3s/agent/etc/cni/net.d/10-flannel.conflist"
+
+var server *testutil.K3sServer
+var flannelCNIConfServerArgs = []string{"--flannel-cni-conf"}
+var customCNIConfFile string
+var testLock int
+
+var _ = BeforeSuite(func() {
+	if !testutil.IsExistingServer() {
+		var err error
+		customCNIConfFile, err = filepath.Abs("./testdata/custom.conflist")
+		Expect(err).ToNot(HaveOccurred())
+		flannelCNIConfServerArgs = append(flannelCNIConfServerArgs, customCNIConfFile)
+		testLock, err = testutil.K3sTestLock()
+		Expect(err).ToNot(HaveOccurred())
+		server, err = testutil.K3sStartServer(flannelCNIConfServerArgs...)
+		Expect(err).ToNot(HaveOccurred())
+	}
+})
+
+var _ = Describe("flannel-cni-conf", Ordered, func() {
+	BeforeEach(func() {
+		if testutil.IsExistingServer() {
+			if !testutil.ServerArgsPresent(flannelCNIConfServerArgs) {
+				Skip("Test needs k3s server with: " + strings.Join(flannelCNIConfServerArgs, " "))
+			}
+			// The file is whichever one the existing server was started with.
+			args := testutil.K3sServerArgs()
+			for i, arg := range args {
+				if arg == "--flannel-cni-conf" && i+1 < len(args) {
+					customCNIConfFile = args[i+1]
+				}
+			}
+		}
+	})
+	When("a custom CNI conflist is passed", func() {
+		It("installs the custom conflist rather than the built-in template", func() {
+			expected, err := os.ReadFile(customCNIConfFile)
+			Expect(err).ToNot(HaveOccurred())
+			Eventually(func() (string, error) {
+				content, err := os.ReadFile(installedCNIConf)
+				return string(content), err
+			}, "120s", "5s").Should(Equal(string(expected)))
+		})
+		It("still starts the default deployments with it", func() {
+			Eventually(func() error {
+				return tests.CheckDefaultDeployments(testutil.DefaultConfig)
+			}, "180s", "10s").Should(Succeed())
+		})
+	})
+})
+
+var failed bool
+var _ = AfterEach(func() {
+	failed = failed || CurrentSpecReport().Failed()
+})
+
+var _ = AfterSuite(func() {
+	if !testutil.IsExistingServer() && os.Getenv("CI") != "true" {
+		if failed {
+			testutil.K3sSaveLog(server, false)
+			testutil.K3sCopyPodLogs(server)
+			testutil.K3sDumpResources(server, "node", "pod", "pvc", "pv")
+		}
+		Expect(testutil.K3sKillServer(server)).To(Succeed())
+		Expect(testutil.K3sCleanup(testLock, "")).To(Succeed())
+	}
+})
+
+func Test_IntegrationFlannelCNIConf(t *testing.T) {
+	RegisterFailHandler(Fail)
+	RunSpecs(t, "flannel-cni-conf Suite")
+}
```

**File**: `tests/integration/flannelcniconf/testdata/custom.conflist` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+{
+  "name":"cbr0",
+  "cniVersion":"1.0.0",
+  "plugins":[
+    {
+      "type":"flannel",
+      "delegate":{
+        "hairpinMode":true,
+        "forceAddress":true,
+        "isDefaultGateway":true,
+        "mtu":1370
+      }
+    },
+    {
+      "type":"portmap",
+      "capabilities":{
+        "portMappings":true
+      }
+    },
+    {
+      "type":"bandwidth",
+      "capabilities":{
+        "bandwidth":true
+      }
+    }
+  ]
+}
```

---

### Incident Patch 8: `6bf365d4` (2026-09-08)
**Commit Message**: Merge pull request #14599 from k3s-io/caroline-suse-rancher-securityreadme

Update security policy for vulnerability reporting

**File**: `.github/SECURITY.md` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 
 ## Reporting a Vulnerability
 
-K3s supports responsible disclosure and endeavors to resolve security issues in a reasonable timeframe. To report a security vulnerability, email security@k3s.io .
+K3s supports responsible disclosure and endeavors to resolve security issues in a reasonable timeframe. To report a security vulnerability, email security@k3s.io . If you are sending us notification of what you believe to be a security vulnerability, please leave us a way to contact you in your original message (i.e. github username or email address).
```

---

### Incident Patch 9: `a2ee23e4` (2026-09-08)
**Commit Message**: Update security policy for vulnerability reporting

Added a request for contact information in vulnerability reports.

Signed-off-by: caroline-suse-rancher <[REDACTED_EMAIL]>

**File**: `.github/SECURITY.md` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 
 ## Reporting a Vulnerability
 
-K3s supports responsible disclosure and endeavors to resolve security issues in a reasonable timeframe. To report a security vulnerability, email security@k3s.io .
+K3s supports responsible disclosure and endeavors to resolve security issues in a reasonable timeframe. To report a security vulnerability, email security@k3s.io . If you are sending us notification of what you believe to be a security vulnerability, please leave us a way to contact you in your original message (i.e. github username or email address).
```

---

### Incident Patch 10: `164ae1b4` (2026-08-18)
**Commit Message**: Remove upterm remote debug

Signed-off-by: Brad Davidson <[REDACTED_EMAIL]>

**File**: `.github/workflows/e2e.yaml` (modified, +0/-6)
```diff
@@ -146,12 +146,6 @@ jobs:
           name: e2e-${{ matrix.etest }}-logs
           path: tests/e2e/${{ matrix.etest }}/*log.txt
           retention-days: 30
-      - name: On Failure, Launch Debug Session
-        uses: lhotari/action-upterm@b0357f23233f5ea6d58947c0c402e0631bab7334 # v1
-        if: ${{ failure() }}
-        with:
-          ## If no one connects after 5 minutes, shut down server.
-          wait-timeout-minutes: 5
       - name: Upload Results To Codecov
         uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f # v5
         with:
```

**File**: `.github/workflows/integration.yaml` (modified, +0/-6)
```diff
@@ -95,12 +95,6 @@ jobs:
         name: integration-${{ matrix.itest }}-logs
         path: tests/integration/${{ matrix.itest }}/*log.txt
         retention-days: 30
-    - name: On Failure, Launch Debug Session
-      uses: lhotari/action-upterm@b0357f23233f5ea6d58947c0c402e0631bab7334 # v1
-      if: ${{ failure() }}
-      with:
-        ## If no one connects after 5 minutes, shut down server.
-        wait-timeout-minutes: 5
     - name: Generate coverage report
       run: sudo -E env "PATH=$PATH" go tool covdata textfmt -i $GOCOVERDIR -o ${{ matrix.itest }}.out
     - name: Upload Results To Codecov
```

**File**: `.github/workflows/unitcoverage.yaml` (modified, +0/-5)
```diff
@@ -41,11 +41,6 @@ jobs:
       run: |
         go test -coverpkg ./pkg/... -coverprofile coverage.out ./pkg/... -run Unit
         go tool cover -func coverage.out
-    - name: On Failure, Launch Debug Session
-      if: ${{ failure() }}
-      uses: lhotari/action-upterm@b0357f23233f5ea6d58947c0c402e0631bab7334 # v1
-      with:
-        wait-timeout-minutes: 5
     - name: Upload Results To Codecov
       uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f # v5
       with:
```

---

### Incident Patch 11: `b56f4ad3` (2026-08-17)
**Commit Message**: Enable seccomp in riscv64 builds

Signed-off-by: Antony Chazapis <[REDACTED_EMAIL]>

**File**: `scripts/build` (modified, +0/-6)
```diff
@@ -81,12 +81,6 @@ case ${OS} in
       TAGS="$TAGS selinux"
       RUNC_TAGS="$RUNC_TAGS selinux"
     fi
-
-    # runc's vendored libseccomp-golang can fail on riscv64 with duplicate
-    # C_ARCH_* switch cases when the seccomp build tag is enabled.
-    if [ "${ARCH}" = "riscv64" ]; then
-      RUNC_TAGS="${RUNC_TAGS/seccomp/}"
-    fi
     ;;
   windows)
     TAGS="$TAGS no_cri_dockerd"
```

---

### Incident Patch 12: `663a3931` (2026-08-14)
**Commit Message**: fix: change cadvisor import, set contianerd runtime directly to cadvisor and remove not used controllers in CCM

cadvisor need the trim prefix in case the user decide to use unix://
if it's not set then the cadvisor does not work, if the path for the
containerd.sock does not have the unix:// it will follow the default
behavior and work as expected

Signed-off-by: Vitor Savian <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +1/-2)
```diff
@@ -99,7 +99,7 @@ require (
 	github.com/fsnotify/fsnotify v1.9.0
 	github.com/go-logr/logr v1.4.3
 	github.com/go-test/deep v1.0.7
-	github.com/google/cadvisor v0.56.2
+	github.com/google/cadvisor/lib v0.60.5
 	github.com/google/go-containerregistry v0.20.2
 	github.com/google/renameio/v2 v2.0.2
 	github.com/google/uuid v1.6.0
@@ -308,7 +308,6 @@ require (
 	github.com/golang/protobuf v1.5.4 // indirect
 	github.com/golang/snappy v0.0.5-0.20231225225746-43d5d4cd4e0e // indirect
 	github.com/google/btree v1.1.3 // indirect
-	github.com/google/cadvisor/lib v0.60.5 // indirect
 	github.com/google/cel-go v0.29.2 // indirect
 	github.com/google/certtostore v1.0.6 // indirect
 	github.com/google/deck v0.0.0-20230104221208-105ad94aa8ae // indirect
```

**File**: `go.sum` (modified, +0/-2)
```diff
@@ -894,8 +894,6 @@ github.com/google/btree v0.0.0-20180813153112-4030bb1f1f0c/go.mod h1:lNA+9X1NB3Z
 github.com/google/btree v1.0.0/go.mod h1:lNA+9X1NB3Zf8V7Ke586lFgjr2dZNuvo3lPJSGZ5JPQ=
 github.com/google/btree v1.1.3 h1:CVpQJjYgC4VbzxeGVHfvZrv1ctoYCAI8vbl07Fcxlyg=
 github.com/google/btree v1.1.3/go.mod h1:qOPhT0dTNdNzV6Z/lhRX0YXUafgPLFUh+gZMl761Gm4=
-github.com/google/cadvisor v0.56.2 h1:ra6p4Nxc4zT8VLbZscWUxhvjsqy+1AzMvuSdEM90o1w=
-github.com/google/cadvisor v0.56.2/go.mod h1:CWidr4DqGbkN4aKuOEjLB7Bab3gl01Xxm3co38C3xRU=
 github.com/google/cadvisor/lib v0.60.5 h1:C2Ty0ccuKDQnFW4vCSa58wmjc26jL6GiwGEY00pQcIg=
 github.com/google/cadvisor/lib v0.60.5/go.mod h1:htHKT0OSYO6zaik+iLOo3Wj1mf/5l8uV5TJaqLz13oM=
 github.com/google/cel-go v0.29.2 h1:ZtDxkeiMmz0mxbKDYiNkE5Lk7V5edMRcaaDf2jX002k=
```

**File**: `pkg/agent/syssetup/setup.go` (modified, +2/-2)
```diff
@@ -8,8 +8,8 @@ import (
 	"runtime"
 	"time"
 
-	"github.com/google/cadvisor/machine"
-	"github.com/google/cadvisor/utils/sysfs"
+	"github.com/google/cadvisor/lib/machine"
+	"github.com/google/cadvisor/lib/utils/sysfs"
 	"github.com/sirupsen/logrus"
 	"k8s.io/component-helpers/node/util/sysctl"
 	kubeproxyconfig "k8s.io/kubernetes/pkg/proxy/apis/config"
```

**File**: `pkg/daemons/agent/agent_linux.go` (modified, +5/-3)
```diff
@@ -9,6 +9,7 @@ import (
 	"strconv"
 	"strings"
 
+	cadvisorcontainerd "github.com/google/cadvisor/lib/container/containerd"
 	"github.com/k3s-io/k3s/pkg/cgroups"
 	"github.com/k3s-io/k3s/pkg/daemons/config"
 	"github.com/k3s-io/k3s/pkg/util"
@@ -87,10 +88,11 @@ func kubeletArgsAndConfig(cfg *config.Agent) (map[string]string, *kubeletconfig.
 	}
 	if cfg.RuntimeSocket != "" {
 		defaultConfig.SerializeImagePulls = utilsptr.To(false)
-		// note: this is a legacy cadvisor flag that the kubelet still exposes, but
-		// it must be set in order for cadvisor to pull stats properly.
+		// cadvisor needs the containerd endpoint in order to pull stats properly. The kubelet
+		// used to expose this as a --containerd flag, but stopped registering it in v1.37, and
+		// does not pass its own runtime endpoint through.
 		if strings.Contains(cfg.RuntimeSocket, "containerd") {
-			argsMap["containerd"] = cfg.RuntimeSocket
+			*cadvisorcontainerd.ArgContainerdEndpoint = strings.TrimPrefix(cfg.RuntimeSocket, socketPrefix)
 		}
 		// cadvisor wants the containerd CRI socket without the prefix, but kubelet wants it with the prefix
 		if strings.HasPrefix(cfg.RuntimeSocket, socketPrefix) {
```

**File**: `pkg/daemons/control/server.go` (modified, +0/-1)
```diff
@@ -137,7 +137,6 @@ func controllerManager(ctx context.Context, cfg *config.Control) error {
 	}
 	if !cfg.DisableCCM {
 		argsMap["configure-cloud-routes"] = "false"
-		argsMap["controllers"] = argsMap["controllers"] + ",-service,-route,-cloud-node-lifecycle"
 	}
 
 	if cfg.VLevel != 0 {
```

---

### Incident Patch 13: `0f973cb6` (2026-08-14)
**Commit Message**: Fix etcd/store test

Deprecated WithBlock DialOption is now a no-op, ref: https://github.com/grpc/grpc-go/blob/master/Documentation/anti-patterns.md#especially-bad-using-deprecated-dialoptions

Signed-off-by: Brad Davidson <[REDACTED_EMAIL]>

**File**: `pkg/etcd/store/store.go` (modified, +11/-6)
```diff
@@ -22,7 +22,6 @@ import (
 	"go.etcd.io/etcd/server/v3/storage/schema"
 	"go.uber.org/zap"
 	"go.uber.org/zap/zapcore"
-	"google.golang.org/grpc"
 )
 
 // ReadCloser is a generic wrapper around a MVCC store that provides only read/close functions
@@ -63,17 +62,23 @@ func NewRemoteStore(config endpoint.ETCDConfig) (*RemoteStore, error) {
 
 	logrus.Infof("Opening etcd client connection with endpoints %v", config.Endpoints)
 
+	clientCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
+	defer cancel()
+
 	c, err := clientv3.New(clientv3.Config{
-		Endpoints:   config.Endpoints,
-		DialTimeout: 5 * time.Second,
-		DialOptions: []grpc.DialOption{grpc.WithBlock(), grpc.FailOnNonTempDialError(true)},
-		Logger:      logger,
-		TLS:         tlsConfig,
+		Endpoints: config.Endpoints,
+		Logger:    logger,
+		TLS:       tlsConfig,
+		Context:   clientCtx,
 	})
 	if err != nil {
 		return nil, err
 	}
 
+	if _, err := c.MemberList(clientCtx); err != nil {
+		return nil, errors.Join(err, c.Close())
+	}
+
 	return &RemoteStore{client: c}, nil
 }
 
```

---

### Incident Patch 14: `48220924` (2026-08-09)
**Commit Message**: build: bump k8s dependencies to v1.37.0

bump upstream kubernetes to v1.37.0, the first commit for
the new minor. Also bump containerd to v2.3.4-k3s1 because we need
some changes introduced by upstream, including renamed variables.

Signed-off-by: Vitor Savian <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +108/-110)
```diff
@@ -8,68 +8,68 @@ replace (
 	github.com/cilium/ebpf => github.com/cilium/ebpf v0.12.3
 	github.com/cloudnativelabs/kube-router/v2 => github.com/k3s-io/kube-router/v2 v2.6.3-k3s1
 	github.com/containerd/containerd/api => github.com/containerd/containerd/api v1.11.1
-	github.com/containerd/containerd/v2 => github.com/k3s-io/containerd/v2 v2.3.4-k3s1.36
+	github.com/containerd/containerd/v2 => github.com/k3s-io/containerd/v2 v2.3.4-k3s1
 	github.com/containerd/imgcrypt => github.com/containerd/imgcrypt v1.1.11
 	github.com/docker/distribution => github.com/docker/distribution v2.8.3+incompatible
 	github.com/docker/docker => github.com/docker/docker v25.0.15-0.20260325154711-d2dbc0547253+incompatible
 	github.com/emicklei/go-restful/v3 => github.com/emicklei/go-restful/v3 v3.13.0
 	github.com/golang/protobuf => github.com/golang/protobuf v1.5.4
 	github.com/googleapis/gax-go/v2 => github.com/googleapis/gax-go/v2 v2.12.0
 	github.com/opencontainers/runc => github.com/opencontainers/runc v1.4.2
-	github.com/opencontainers/selinux => github.com/opencontainers/selinux v1.13.1
+	github.com/opencontainers/selinux => github.com/opencontainers/selinux v1.15.1
 	github.com/prometheus/client_golang => github.com/prometheus/client_golang v1.23.2
-	github.com/prometheus/common => github.com/prometheus/common v0.67.5
+	github.com/prometheus/common => github.com/prometheus/common v0.70.0
 	github.com/spegel-org/spegel => github.com/k3s-io/spegel v0.7.2-k3s1
 	go.etcd.io/etcd/api/v3 => github.com/k3s-io/etcd/api/v3 v3.6.14-k3s1
 	go.etcd.io/etcd/client/pkg/v3 => github.com/k3s-io/etcd/client/pkg/v3 v3.6.14-k3s1
 	go.etcd.io/etcd/client/v3 => github.com/k3s-io/etcd/client/v3 v3.6.14-k3s1
 	go.etcd.io/etcd/etcdutl/v3 => github.com/k3s-io/etcd/etcdutl/v3 v3.6.14-k3s1
 	go.etcd.io/etcd/pkg/v3 => github.com/k3s-io/etcd/pkg/v3 v3.6.14-k3s1
 	go.etcd.io/etcd/server/v3 => github.com/k3s-io/etcd/server/v3 v3.6.14-k3s1
-	go.opentelemetry.io/contrib/instrumentation/github.com/emicklei/go-restful/otelrestful => go.opentelemetry.io/contrib/instrumentation/github.com/emicklei/go-restful/otelrestful v0.65.0
-	golang.org/x/crypto => golang.org/x/crypto v0.47.0
-	golang.org/x/net => golang.org/x/net v0.55.0
-	golang.org/x/sys => golang.org/x/sys v0.40.0
+	go.opentelemetry.io/contrib/instrumentation/github.com/emicklei/go-restful/otelrestful => go.opentelemetry.io/contrib/instrumentation/github.com/emicklei/go-restful/otelrestful v0.69.0
+	golang.org/x/crypto => golang.org/x/crypto v0.54.0
+	golang.org/x/net => golang.org/x/net v0.57.0
+	golang.org/x/sys => golang.org/x/sys v0.47.0
 	google.golang.org/genproto => google.golang.org/genproto v0.0.0-20230525234035-dd9d682886f9
-	google.golang.org/grpc => google.golang.org/grpc v1.79.3
-	k8s.io/api => github.com/k3s-io/kubernetes/staging/src/k8s.io/api v1.36.4-k3s1
-	k8s.io/apiextensions-apiserver => github.com/k3s-io/kubernetes/staging/src/k8s.io/apiextensions-apiserver v1.36.4-k3s1
-	k8s.io/apimachinery => github.com/k3s-io/kubernetes/staging/src/k8s.io/apimachinery v1.36.4-k3s1
-	k8s.io/apiserver => github.com/k3s-io/kubernetes/staging/src/k8s.io/apiserver v1.36.4-k3s1
-	k8s.io/cli-runtime => github.com/k3s-io/kubernetes/staging/src/k8s.io/cli-runtime v1.36.4-k3s1
-	k8s.io/client-go => github.com/k3s-io/kubernetes/staging/src/k8s.io/client-go v1.36.4-k3s1
-	k8s.io/cloud-provider => github.com/k3s-io/kubernetes/staging/src/k8s.io/cloud-provider v1.36.4-k3s1
-	k8s.io/cluster-bootstrap => github.com/k3s-io/kubernetes/staging/src/k8s.io/cluster-bootstrap v1.36.4-k3s1
-	k8s.io/code-generator => github.com/k3s-io/kubernetes/staging/src/k8s.io/code-generator v1.36.4-k3s1
-	k8s.io/component-base => github.com/k3s-io/kubernetes/staging/src/k8s.io/component-base v1.36.4-k3s1
-	k8s.io/component-helpers => github.com/k3s-io/kubernetes/staging/src/k8s.io/component-helpers v1.36.4-k3s1
-	k8s.io/controller-manager => github.com/k3s-io/kubernetes/staging/src/k8s.io/controller-manager v1.36.4-k3s1
-	k8s.io/cri-api => github.com/k3s-io/kubernetes/staging/src/k8s.io/cri-api v1.36.4-k3s1
-	k8s.io/cri-client => github.com/k3s-io/kubernetes/staging/src/k8s.io/cri-client v1.36.4-k3s1
-	k8s.io/cri-streaming => github.com/k3s-io/kubernetes/staging/src/k8s.io/cri-streaming v1.36.4-k3s1
-	k8s.io/csi-translation-lib => github.com/k3s-io/kubernetes/staging/src/k8s.io/csi-translation-lib v1.36.4-k3s1
-	k8s.io/dynamic-resource-allocation => github.com/k3s-io/kubernetes/staging/src/k8s.io/dynamic-resource-allocation v1.36.4-k3s1
-	k8s.io/endpointslice => github.com/k3s-io/kubernetes/staging/src/k8s.io/endpointslice v1.36.4-k3s1
-	k8s.io/externaljwt => github.com/k3s-io/kubernetes/staging/src/k8s.io/externaljwt v1.36.4-k3s1
+	google.golang.org/grpc => google.golang.org/grpc v1.82.1
+	k8s.io/api => github.com/k3s-io/kubernetes/staging/src/k8s.io/api v1.37.0-k3s1
+	k8s.io/apiextensions-apiserver => github.com/k3s-io/kubernetes/staging/src/k8s.io/apiextensions-apiserver v1.37.0-k3s1
+	k8s.io/apimachinery => github.com/k3s-io/ku
```

**File**: `go.sum` (modified, +215/-203)
```diff
@@ -331,8 +331,8 @@ codeberg.org/go-pdf/fpdf v0.10.0/go.mod h1:Y0DGRAdZ0OmnZPvjbMp/1bYxmIPxm0ws4tfoP
 contrib.go.opencensus.io/exporter/stackdriver v0.13.15-0.20230702191903-2de6d2748484/go.mod h1:uxw+4/0SiKbbVSD/F2tk5pJTdVcfIBBcsQ8gwcu4X+E=
 cuelabs.dev/go/oci/ociregistry v0.0.0-20250530080122-d0efc28a5723 h1:FGl278ML+6v4yF1FkYELcMXvP+BAsvsW+H3WkGQy+aE=
 cuelabs.dev/go/oci/ociregistry v0.0.0-20250530080122-d0efc28a5723/go.mod h1:dqrnoZx62xbOZr11giMPrWbhlaV8euHwciXZEy3baT8=
-cyphar.com/go-pathrs v0.2.2 h1:y9w7hxbkr3zEL78Fjzeg4HEhs2xNy+fbwHiHGJJY2Xo=
-cyphar.com/go-pathrs v0.2.2/go.mod h1:y8f1EMG7r+hCuFf/rXsKqMJrJAUoADZGNh5/vZPKcGc=
+cyphar.com/go-pathrs v0.2.5 h1:SnX9FBvnoyn3lUs1dkMgZ52bAETpirNu3FTRh5HlRik=
+cyphar.com/go-pathrs v0.2.5/go.mod h1:y8f1EMG7r+hCuFf/rXsKqMJrJAUoADZGNh5/vZPKcGc=
 dario.cat/mergo v1.0.2 h1:85+piFYR1tMbRrLcDwR18y4UKJ3aH1Tbzi24VRW1TK8=
 dario.cat/mergo v1.0.2/go.mod h1:E/hbnu0NxMFBjpMIE34DRGLWqDy0g5FuKDhCb31ngxA=
 dmitri.shuralyov.com/gpu/mtl v0.0.0-20190408044501-666a987793e9/go.mod h1:H6x//7gZCb22OMCxBHrMx7a5I7Hp++hsVxbQ4BYO7hU=
@@ -373,7 +373,7 @@ github.com/DataDog/zstd v1.5.7/go.mod h1:g4AWEaM3yOg3HYfnJ3YIawPnVdXJh9QME85blwS
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.24.1/go.mod h1:itPGVDKf9cC/ov4MdvJ2QZ0khw4bfoo9jzwTJlaxy2k=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.25.0/go.mod h1:obipzmGjfSjam60XLwGfqUkJsfiheAl+TUjG+4yzyPM=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.27.0/go.mod h1:yAZHSGnqScoU556rBOVkwLze6WP5N+U11RHuWaGVxwY=
-github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.30.0/go.mod h1:P4WPRUkOhJC13W//jWpyfJNDAIpvRbAUIYLX/4jtlE0=
+github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.32.0/go.mod h1:RD2SsorTmYhF6HkTmDw7KmPYQk8OBYwTkuasChwv7R4=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric v0.48.1/go.mod h1:jyqM3eLpJ3IbIFDTKVz2rF9T/xWGW0rIriGwnz8l9Tk=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric v0.49.0/go.mod h1:6fTWu4m3jocfUZLYF5KsZC1TUfRvEjs7lM4crme/irw=
 github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric v0.50.0/go.mod h1:ZV4VOm0/eHR06JLrXWe09068dHpr3TRpY9Uo7T+anuA=
@@ -398,8 +398,8 @@ github.com/Microsoft/go-winio v0.6.3-0.20251027160822-ad3df93bed29 h1:0kQAzHq8vL
 github.com/Microsoft/go-winio v0.6.3-0.20251027160822-ad3df93bed29/go.mod h1:ZWa7ssZJT30CCDGJ7fk/2SBTq9BIQrrVjrcss0UW2s0=
 github.com/Microsoft/hcsshim v0.15.0-rc.1 h1:FbbwtQmiD+BVHynGkx5S65JkLyhkEiiTP8nrpmg2SZw=
 github.com/Microsoft/hcsshim v0.15.0-rc.1/go.mod h1:HWvvUPIy9HF6LotILj1G4VyS065rcLQ6tqj6tMUdOfI=
-github.com/Microsoft/hnslib v0.1.2 h1:CshjwTQsNx1o7BIA1XO8HtgDsiCqn+b6kGjL/tIxXQQ=
-github.com/Microsoft/hnslib v0.1.2/go.mod h1:5vTyBey4N/VI2ZTNh2gdWhkPMefSbCFYjpvVwye+qtI=
+github.com/Microsoft/hnslib v0.1.3 h1:OCD8uA1IIqaaOV00qwbL8GwHEVCk8UPS8tiUb6pJzTQ=
+github.com/Microsoft/hnslib v0.1.3/go.mod h1:5vTyBey4N/VI2ZTNh2gdWhkPMefSbCFYjpvVwye+qtI=
 github.com/NYTimes/gziphandler v1.1.1 h1:ZUDjpQae29j0ryrS0u/B8HZfJBtBQHjqw2rQ2cqUQ3I=
 github.com/NYTimes/gziphandler v1.1.1/go.mod h1:n/CVRwUEOgIxrgPvAQhUUr9oeUtvrhMomdKFjzJNB0c=
 github.com/RaduBerinde/axisds v0.1.0 h1:YItk/RmU5nvlsv/awo2Fjx97Mfpt4JfgtEVAGPrLdz8=
@@ -541,7 +541,8 @@ github.com/cncf/xds/go v0.0.0-20240905190251-b4127c9b8d78/go.mod h1:W+zGtBO5Y1Ig
 github.com/cncf/xds/go v0.0.0-20250121191232-2f005788dc42/go.mod h1:W+zGtBO5Y1IgJhy4+A9GOqVhqLpfZi+vwmdNXUehLA8=
 github.com/cncf/xds/go v0.0.0-20250326154945-ae57f3c0d45f/go.mod h1:W+zGtBO5Y1IgJhy4+A9GOqVhqLpfZi+vwmdNXUehLA8=
 github.com/cncf/xds/go v0.0.0-20250501225837-2ac532fd4443/go.mod h1:W+zGtBO5Y1IgJhy4+A9GOqVhqLpfZi+vwmdNXUehLA8=
-github.com/cncf/xds/go v0.0.0-20251210132809-ee656c7534f5/go.mod h1:KdCmV+x/BuvyMxRnYBlmVaq4OLiKW6iRQfvC62cvdkI=
+github.com/cncf/xds/go v0.0.0-20251110193048-8bfbf64dc13e/go.mod h1:KdCmV+x/BuvyMxRnYBlmVaq4OLiKW6iRQfvC62cvdkI=
+github.com/cncf/xds/go v0.0.0-20260202195803-dba9d589def2/go.mod h1:qwXFYgsP6T7XnJtbKlf1HP8AjxZZyzxMmc+Lq5GjlU4=
 github.com/cockroachdb/crlib v0.0.0-20241112164430-1264a2edc35b h1:SHlYZ/bMx7frnmeqCu+xm0TCxXLzX3jQIVuFbnFGtFU=
 github.com/cockroachdb/crlib v0.0.0-20241112164430-1264a2edc35b/go.mod h1:Gq51ZeKaFCXk6QwuGM0w1dnaOqc/F5zKT2zA9D6Xeac=
 github.com/cockroachdb/datadriven v0.0.0-20190809214429-80d97fb3cbaa/go.mod h1:zn76sxSg3SzpJ0PPJaLDCu+Bu0Lg3sKTORVIj19EIF8=
@@ -564,8 +565,8 @@ github.com/cockroachdb/swiss v0.0.0-20251224182025-b0f6560f979b/go.mod h1:yBRu/c
 github.com/cockroachdb/tokenbucket v0.0.0-20230807174530-cc333fc44b06 h1:zuQyyAKVxetITBuuhv3BI9cMrmStnpT18zmgmTxunpo=
 github.com/cockroachdb/tokenbucket v0.0.0-20230807174530-cc333fc44b06/go.mod h1:7nc4anLGjupUW/PeY5qiNYsdNXj7zopG+eqsS7To5IQ=
 github.com/codahale/hdrhistogram v0.0.0-20161010025455-3a0bb77429bd/go.mod h1:sE/e/2PUdi/liOCUjSTXgM1o87ZssimdTWN964YiIeI=
-github.com/container-storage-interface/spec v1.9.0 h1:zKtX4STsq31Knz3gciCYCi1SXtO
```

---

### Incident Patch 15: `2a1e2e8c` (2026-08-14)
**Commit Message**: Bump kine to v0.16.4 for nats replay fix

Signed-off-by: Brad Davidson <[REDACTED_EMAIL]>

**File**: `go.mod` (modified, +28/-28)
```diff
@@ -108,8 +108,8 @@ require (
 	github.com/json-iterator/go v1.1.12
 	github.com/k3s-io/api v0.1.4
 	github.com/k3s-io/helm-controller v0.17.7
-	github.com/k3s-io/kine v0.16.3
-	github.com/klauspost/compress v1.18.6
+	github.com/k3s-io/kine v0.16.4
+	github.com/klauspost/compress v1.19.2
 	github.com/libp2p/go-libp2p v0.48.0
 	github.com/minio/minio-go/v7 v7.1.0
 	github.com/moby/sys/reexec v0.1.0
@@ -124,8 +124,8 @@ require (
 	github.com/opencontainers/selinux v1.13.1
 	github.com/otiai10/copy v1.14.1
 	github.com/pdtpartners/nix-snapshotter v0.4.0
-	github.com/prometheus/client_golang v1.23.2
-	github.com/prometheus/common v0.67.5
+	github.com/prometheus/client_golang v1.24.1
+	github.com/prometheus/common v0.70.1
 	github.com/rancher/dynamiclistener v0.9.1-0.20260710234258-e4a1908ede0d
 	github.com/rancher/lasso v0.2.9
 	github.com/rancher/permissions v0.0.0-20240523180510-4001d3d637f7
@@ -149,12 +149,12 @@ require (
 	go.etcd.io/etcd/server/v3 v3.6.14
 	go.uber.org/mock v0.6.0
 	go.uber.org/zap v1.28.0
-	golang.org/x/crypto v0.53.0
-	golang.org/x/mod v0.36.0
-	golang.org/x/net v0.55.0
-	golang.org/x/sync v0.21.0
-	golang.org/x/sys v0.46.0
-	google.golang.org/grpc v1.82.1
+	golang.org/x/crypto v0.54.0
+	golang.org/x/mod v0.37.0
+	golang.org/x/net v0.57.0
+	golang.org/x/sync v0.22.0
+	golang.org/x/sys v0.47.0
+	google.golang.org/grpc v1.83.0
 	gopkg.in/yaml.v2 v2.4.0
 	k8s.io/api v0.36.3
 	k8s.io/apiextensions-apiserver v0.36.0
@@ -301,7 +301,7 @@ require (
 	github.com/godbus/dbus/v5 v5.2.2 // indirect
 	github.com/gofrs/flock v0.8.1 // indirect
 	github.com/gogo/protobuf v1.3.2 // indirect
-	github.com/golang-jwt/jwt/v5 v5.3.0 // indirect
+	github.com/golang-jwt/jwt/v5 v5.3.1 // indirect
 	github.com/golang/groupcache v0.0.0-20241129210726-2c02b8208cf8 // indirect
 	github.com/golang/protobuf v1.5.4 // indirect
 	github.com/golang/snappy v0.0.5-0.20231225225746-43d5d4cd4e0e // indirect
@@ -313,7 +313,7 @@ require (
 	github.com/google/go-cmp v0.7.0 // indirect
 	github.com/google/go-tpm v0.9.8 // indirect
 	github.com/google/gopacket v1.1.19 // indirect
-	github.com/google/pprof v0.0.0-20260115054156-294ebfa9ad83 // indirect
+	github.com/google/pprof v0.0.0-20260802141513-ef3492d7dac3 // indirect
 	github.com/gorilla/mux v1.8.1 // indirect
 	github.com/grpc-ecosystem/go-grpc-middleware/providers/prometheus v1.1.0 // indirect
 	github.com/grpc-ecosystem/go-grpc-middleware/v2 v2.3.3 // indirect
@@ -368,8 +368,8 @@ require (
 	github.com/lithammer/dedent v1.1.0 // indirect
 	github.com/mailru/easyjson v0.9.1 // indirect
 	github.com/marten-seemann/tcp v0.0.0-20210406111302-dfbc87cc63fd // indirect
-	github.com/mattn/go-isatty v0.0.22 // indirect
-	github.com/mattn/go-sqlite3 v1.14.47 // indirect
+	github.com/mattn/go-isatty v0.0.24 // indirect
+	github.com/mattn/go-sqlite3 v1.14.49 // indirect
 	github.com/mdlayher/genetlink v1.3.2 // indirect
 	github.com/mdlayher/netlink v1.7.2 // indirect
 	github.com/mdlayher/socket v0.5.1 // indirect
@@ -450,7 +450,7 @@ require (
 	github.com/polydawn/refmt v0.89.1-0.20231129105047-37766d95467a // indirect
 	github.com/pquerna/cachecontrol v0.1.0 // indirect
 	github.com/prometheus/client_model v0.6.2 // indirect
-	github.com/prometheus/procfs v0.20.1 // indirect
+	github.com/prometheus/procfs v0.21.1 // indirect
 	github.com/quic-go/qpack v0.6.0 // indirect
 	github.com/quic-go/quic-go v0.60.0 // indirect
 	github.com/quic-go/webtransport-go v0.10.0 // indirect
@@ -467,7 +467,7 @@ require (
 	github.com/stefanberger/go-pkcs11uri v0.0.0-20230803200340-78284954bff6 // indirect
 	github.com/stoewer/go-strcase v1.3.1 // indirect
 	github.com/syndtr/goleveldb v1.0.0 // indirect
-	github.com/t4db/t4 v1.0.3 // indirect
+	github.com/t4db/t4 v1.0.5 // indirect
 	github.com/tchap/go-patricia/v2 v2.3.3 // indirect
 	github.com/tetratelabs/wazero v1.11.0 // indirect
 	github.com/tidwall/btree v1.8.1 // indirect
@@ -489,12 +489,12 @@ require (
 	go.opentelemetry.io/contrib/instrumentation/github.com/emicklei/go-restful/otelrestful v0.65.0 // indirect
 	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.68.0 // indirect
 	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.68.0 // indirect
-	go.opentelemetry.io/otel v1.43.0 // indirect
+	go.opentelemetry.io/otel v1.44.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.43.0 // indirect
 	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.43.0 // indirect
-	go.opentelemetry.io/otel/metric v1.43.0 // indirect
-	go.opentelemetry.io/otel/sdk v1.43.0 // indirect
-	go.opentelemetry.io/otel/trace v1.43.0 // indirect
+	go.opentelemetry.io/otel/metric v1.44.0 // indirect
+	go.opentelemetry.io/otel/sdk v1.44.0 // indirect
+	go.opentelemetry.io/otel/trace v1.44.0 // indirect
 	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
 	go.uber.org/dig v1.19.0 // indirect
 	go.uber.org/fx v1.24.0 // indirect
@@ -503,16 +503,16 @@ require (
 	go.yaml.in/yaml/v3 v3.0.4 // indir
```

**File**: `go.sum` (modified, +52/-49)
```diff
@@ -863,8 +863,9 @@ github.com/gogo/protobuf v1.2.0/go.mod h1:r8qH/GZQm5c6nD/R0oafs1akxWv10x8SbQlK7a
 github.com/gogo/protobuf v1.2.1/go.mod h1:hp+jE20tsWTFYpLwKvXlhS1hjn+gTNwPg2I6zVXpSg4=
 github.com/gogo/protobuf v1.3.2 h1:Ov1cvc58UF3b5XjBnZv7+opcTcQFZebYjWzi34vdm4Q=
 github.com/gogo/protobuf v1.3.2/go.mod h1:P1XiOD3dCwIKUDQYPy72D8LYyHL2YPYrpS2s69NZV8Q=
-github.com/golang-jwt/jwt/v5 v5.3.0 h1:pv4AsKCKKZuqlgs5sUmn4x8UlGa0kEVt/puTpKx9vvo=
 github.com/golang-jwt/jwt/v5 v5.3.0/go.mod h1:fxCRLWMO43lRc8nhHWY6LGqRcf+1gQWArsqaEUEa5bE=
+github.com/golang-jwt/jwt/v5 v5.3.1 h1:kYf81DTWFe7t+1VvL7eS+jKFVWaUnK9cB1qbwn63YCY=
+github.com/golang-jwt/jwt/v5 v5.3.1/go.mod h1:fxCRLWMO43lRc8nhHWY6LGqRcf+1gQWArsqaEUEa5bE=
 github.com/golang/freetype v0.0.0-20170609003504-e2365dfdc4a0/go.mod h1:E/TSTwGwJL78qG/PmXZO1EjYhfJinVAhrmmHX6Z8B9k=
 github.com/golang/glog v0.0.0-20160126235308-23def4e6c14b/go.mod h1:SBH7ygxi8pfUlaOkMMuAQtPIUF8ecWP5IEl/CR7VP2Q=
 github.com/golang/glog v1.0.0/go.mod h1:EWib/APOK0SL3dFbYqvxE3UYd8E6s1ouQ7iEp/0LWV4=
@@ -957,8 +958,8 @@ github.com/google/pprof v0.0.0-20210226084205-cbba55b83ad5/go.mod h1:kpwsk12EmLe
 github.com/google/pprof v0.0.0-20210601050228-01bbb1931b22/go.mod h1:kpwsk12EmLew5upagYY7GY0pfYCcupk39gWOCRROcvE=
 github.com/google/pprof v0.0.0-20210609004039-a478d1d731e9/go.mod h1:kpwsk12EmLew5upagYY7GY0pfYCcupk39gWOCRROcvE=
 github.com/google/pprof v0.0.0-20210720184732-4bb14d4b1be1/go.mod h1:kpwsk12EmLew5upagYY7GY0pfYCcupk39gWOCRROcvE=
-github.com/google/pprof v0.0.0-20260115054156-294ebfa9ad83 h1:z2ogiKUYzX5Is6zr/vP9vJGqPwcdqsWjOt+V8J7+bTc=
-github.com/google/pprof v0.0.0-20260115054156-294ebfa9ad83/go.mod h1:MxpfABSjhmINe3F1It9d+8exIHFvUqtLIRCdOGNXqiI=
+github.com/google/pprof v0.0.0-20260802141513-ef3492d7dac3 h1:LMLX+LgTNWpfvCBdFebv6EsYotImrt/Ppc5cXIriCSo=
+github.com/google/pprof v0.0.0-20260802141513-ef3492d7dac3/go.mod h1:jl5iWTm0/hd5PjEYEOuwAJ57L/CibdZfrqZ5XA5GrCk=
 github.com/google/renameio v0.1.0/go.mod h1:KWCgfxg9yswjAJkECMjeO8J8rahYeXnNhOm40UhjYkI=
 github.com/google/renameio/v2 v2.0.2 h1:qKZs+tfn+arruZZhQ7TKC/ergJunuJicWS6gLDt/dGw=
 github.com/google/renameio/v2 v2.0.2/go.mod h1:OX+G6WHHpHq3NVj7cAOleLOwJfcQ1s3uUJQCrr78SWo=
@@ -1168,8 +1169,8 @@ github.com/k3s-io/etcd/server/v3 v3.6.14-k3s1 h1:yTlDjmjVu8+s6uhArtRFx8kSI0Gyg9v
 github.com/k3s-io/etcd/server/v3 v3.6.14-k3s1/go.mod h1:yj1SNtvmNLLl7JUQY3vpaUBm24qAzTVixJn/1OKG6i4=
 github.com/k3s-io/helm-controller v0.17.7 h1:9hzzLE4YeCHmpAn2Y/A4DjqYAQtQxnbsQSkBx6qTJrc=
 github.com/k3s-io/helm-controller v0.17.7/go.mod h1:pLlCfQ0hLtuA5Ga9fcIWWdB20id67pUgYCGHYVIn9e4=
-github.com/k3s-io/kine v0.16.3 h1:NstMQZ7AIRA9dC+uu+ZpK5eITwsANrSDX4Fe6yTSmpU=
-github.com/k3s-io/kine v0.16.3/go.mod h1:8cpZsCKacjwrka3BjQDY7sCQ2qI9iGtcCs2I/I5euec=
+github.com/k3s-io/kine v0.16.4 h1:z3TeoWhQErBGwhLGp0nQUo9ONLUGQdzd0juV4vkAuDw=
+github.com/k3s-io/kine v0.16.4/go.mod h1:riXzwgYsxgG8bzf87oVipL7oeiQAOjRmMf7uuHpKElo=
 github.com/k3s-io/klog/v2 v2.140.0-k3s1 h1:Z6S9oqaxcKtLaTcQNgWsaZNE5a+qJmCrTI+Lahor4X8=
 github.com/k3s-io/klog/v2 v2.140.0-k3s1/go.mod h1:o+/RWfJ6PwpnFn7OyAG3QnO47BFsymfEfrz6XyYSSp0=
 github.com/k3s-io/kube-router/v2 v2.6.3-k3s1 h1:RZjUBIuitXCuYoCzm1aM6p5EgQFC5k3N72j4pBIc2j4=
@@ -1243,8 +1244,8 @@ github.com/kisielk/gotool v1.0.0/go.mod h1:XhKaO+MFFWcvkIS/tQcRk01m1F5IRFswLeQ+o
 github.com/klauspost/asmfmt v1.3.2/go.mod h1:AG8TuvYojzulgDAMCnYn50l/5QV3Bs/tp6j0HLHbNSE=
 github.com/klauspost/compress v1.15.9/go.mod h1:PhcZ0MbTNciWF3rruxRgKxI5NkcHHrHUDtV4Yw2GlzU=
 github.com/klauspost/compress v1.18.0/go.mod h1:2Pp+KzxcywXVXMr50+X0Q/Lsb43OQHYWRCY2AiWywWQ=
-github.com/klauspost/compress v1.18.6 h1:2jupLlAwFm95+YDR+NwD2MEfFO9d4z4Prjl1XXDjuao=
-github.com/klauspost/compress v1.18.6/go.mod h1:cwPg85FWrGar70rWktvGQj8/hthj3wpl0PGDogxkrSQ=
+github.com/klauspost/compress v1.19.2 h1:hMRETovs/pu/dVWN7zIT1PGG8t509MwT6bO7XSi26R8=
+github.com/klauspost/compress v1.19.2/go.mod h1:cwPg85FWrGar70rWktvGQj8/hthj3wpl0PGDogxkrSQ=
 github.com/klauspost/cpuid/v2 v2.0.1/go.mod h1:FInQzS24/EEf25PyTYn52gqo7WaD8xa0213Md/qVLRg=
 github.com/klauspost/cpuid/v2 v2.0.9/go.mod h1:FInQzS24/EEf25PyTYn52gqo7WaD8xa0213Md/qVLRg=
 github.com/klauspost/cpuid/v2 v2.3.0 h1:S4CRMLnYUhGeDFDqkGriYKdfoFlDnMtqTiI/sFzhA9Y=
@@ -1323,12 +1324,12 @@ github.com/mattn/go-isatty v0.0.3/go.mod h1:M+lRXTBqGeGNdLjl/ufCoiOlB5xdOkqRJdNx
 github.com/mattn/go-isatty v0.0.4/go.mod h1:M+lRXTBqGeGNdLjl/ufCoiOlB5xdOkqRJdNxMWT7Zi4=
 github.com/mattn/go-isatty v0.0.12/go.mod h1:cbi8OIDigv2wuxKPP5vlRcQ1OAZbq2CE4Kysco4FUpU=
 github.com/mattn/go-isatty v0.0.16/go.mod h1:kYGgaQfpe5nmfYZH+SKPsOc2e4SrIfOl2e/yFXSvRLM=
-github.com/mattn/go-isatty v0.0.22 h1:j8l17JJ9i6VGPUFUYoTUKPSgKe/83EYU2zBC7YNKMw4=
-github.com/mattn/go-isatty v0.0.22/go.mod h1:ZXfXG4SQHsB/w3ZeOYbR0PrPwLy+n6xiMrJlRFqopa4=
+github.com/mattn/go-isatty v0.0.24 h1:tGZZoVgT/KiqK1c8ocVLeDS8BSWMRd47J3Lbz7vsReI=
+github.com/mattn/go-isatty v0.0.24/go.mod h1:nMCL3Zebbrt45jsMDgnfIwz6ydEQApk5oEI3HqDio6A=
 github.com/mattn/go-runewidth v0.0.2/go.mod h1:LwmH8dsx7+W
```

#### Recent Merged Pull Requests:
- **PR #14731** (2026-10-01): [main] Update stable to `v1.36.5+k3s1` (@rafaelbreno)
- **PR #14728** (2026-09-30): [release-1.33] Bump etcd and helm-controller (@brandond)
- **PR #14727** (2026-10-02): [Release 1.37] Add gateway-api-crd to help (@manuelbuil)
- **PR #14722** (closed): Reconcile ServiceLB DaemonSet nodeSelector when enablelb label is removed (@sundeep8967)
- **PR #14721** (2026-09-30): [main] Update updatecli to use latest Go patch from upstream's Go minor (@rafaelbreno)
- **PR #14720** (2026-09-30): docs: fix anchor case and target in GOVERNANCE.md (@ump45nose)
- **PR #14719** (2026-09-30): Omit default SA key flags when service-account-signing-endpoint is set (@venim)
- **PR #14716** (2026-09-30): Clarify etcd local vs S3 snapshot retention flag help (@aeltai)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
