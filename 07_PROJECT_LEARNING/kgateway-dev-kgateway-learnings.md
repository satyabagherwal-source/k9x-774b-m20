# Forensic Learning Record (Deep Inspection): kgateway-dev/kgateway

> **Canonical Artifact**: `07_PROJECT_LEARNING/kgateway-dev-kgateway-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kgateway-dev/kgateway](https://github.com/kgateway-dev/kgateway))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:37:37.353Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kgateway-dev/kgateway`
- **Description**: The Cloud-Native API Gateway and AI Gateway
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 5697 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `hack/utils/applier/cmd/apply.go`
```
package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"k8s.io/cli-runtime/pkg/genericclioptions"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/clientcmd"
	cmdutil "k8s.io/kubectl/pkg/cmd/util"

	"github.com/kgateway-dev/kgateway/v2/hack/utils/applier/pkg/applier"
)

var (
	fileNameFlags *genericclioptions.FileNameFlags

	dryRun        bool
	startIndex    int
	endIndex      int
	numIterations int
	force         bool

	deleteResources bool

	async   bool
	workers int

	qps   float32
	burst int
)

// applyCmd represents the apply command
var applyCmd = &cobra.Command{
	Use: "apply",
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Println("apply called")

		if burst < int(qps) {
			burst = int(qps)
		}

		configFlags.WithDiscoveryBurst(burst).WithDiscoveryQPS(qps)

		userSpecifiedContext, err := cmd.Flags().GetString("context")
		if err != nil {
			return err
		}

		restConfig, err := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
			&clientcmd.ClientConfigLoadingRules{ExplicitPath: configFlags.ToRawKubeConfigLoader().ConfigAccess().GetDefaultFilename()},
			&clientcmd.ConfigOverrides{
				CurrentContext: userSpecifiedContext,
			}).ClientConfig()
		if err != nil {
			return err
		}

		restConfig.QPS = qps
		restConfig.Burst = burst

		factory := cmdutil.NewFactory(matchVersionKubeConfigFlags)
		validationDirective, err := cmdutil.GetValidationDirective(cmd)
		if err != nil {
			return err
		}

		dynamicClient, err := dynamic.NewForConfig(restConfig)
		if err != nil {
			return err
		}
		validator, err := factory.Validator(validationDirective)
		if err != nil {
			return err
		}
		filenameOptions := fileNameFlags.ToOptions()

		if numIterations > 0 {
			endIndex = startIndex + numIterations
		}

		a := applier.Applier{
			Start:  startIndex,
			End:    endIndex,
			DryRun: dryRun,
			Force:  force,
			Delete: deleteResources,

			Async:   async,
			Workers: workers,
		}

		return a.Apply(dynamicClient, factory, filenameOptions, validator)
	},
}

func init() {
	rootCmd.AddCommand(applyCmd)

	filenames := []string{}
	recursive := false
	kustomize := ""
	fileNameFlags = &genericclioptions.FileNameFlags{Usage: "", Filenames: &filenames, Kustomize: &kustomize, Recursive: &recursive}

	fileNameFlags.AddFlags(applyCmd.PersistentFlags())
	cmdutil.AddValidateFlags(applyCmd)

	applyCmd.Flags().IntVar(&startIndex, "start", 0, "Start index for the loop")
	applyCmd.Flags().IntVar(&numIterations, "iterations", 0, "If set, end index will be set to start+this")
	applyCmd.Flags().IntVar(&endIndex, "end", 3000, "End index for the loop. (If start is 0, this is the number times to apply the manifest)")
	applyCmd.Flags().BoolVarP(&dryRun, "dry-run", "d", false, "Dry run - print yamls to stdout")
	applyCmd.Flags().BoolVar(&force, "force", false, "Force apply - delete and recreate objects")
	applyCmd.Flags().Float32Var(&qps, "qps", 50, "QPS")
	applyCmd.Flags().IntVar(&burst, "burst", 75, "Burst")

	applyCmd.Flags().BoolVar(&async, "async", false, "Run in async mode. Use this if not hitting your QPS.")
	applyCmd.Flags().IntVar(&workers, "workers", 10, "Number of workers to use when using async mode. each worker submits requests in parallel.")

	applyCmd.Flags().BoolVar(&deleteResources, "delete", false, "Delete resources instead of applying them (useful for cleanup)")
}

```

### Core Architecture Module: `hack/utils/applier/cmd/root.go`
```
package cmd

import (
	"os"

	"github.com/spf13/cobra"
	"k8s.io/cli-runtime/pkg/genericclioptions"
	cmdutil "k8s.io/kubectl/pkg/cmd/util"
)

var (
	configFlags                 = genericclioptions.NewConfigFlags(true)
	matchVersionKubeConfigFlags = cmdutil.NewMatchVersionFlags(configFlags)
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use: "applier",
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}
}

func init() {
	configFlags.AddFlags(rootCmd.PersistentFlags())
	matchVersionKubeConfigFlags.AddFlags(rootCmd.PersistentFlags())
}

```

### Core Architecture Module: `hack/utils/applier/main.go`
```
package main

import (
	_ "k8s.io/client-go/plugin/pkg/client/auth"

	"github.com/kgateway-dev/kgateway/v2/hack/utils/applier/cmd"
)

func main() {
	cmd.Execute()
}

```

### Core Architecture Module: `hack/utils/applier/pkg/applier/apply.go`
```
package applier

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"sync"
	"text/template"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/serializer/json"
	utilerrors "k8s.io/apimachinery/pkg/util/errors"
	"k8s.io/cli-runtime/pkg/resource"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes/scheme"
	cmdutil "k8s.io/kubectl/pkg/cmd/util"
	"k8s.io/kubectl/pkg/validation"
)

type Applier struct {
	DryRun bool
	Start  int
	End    int

	Force  bool
	Delete bool

	Async   bool
	Workers int

	getLock sync.Mutex
}

func (a *Applier) Apply(dynamicClient dynamic.Interface, factory cmdutil.Factory, fo resource.FilenameOptions, validator validation.Schema) error {
	ctx := context.Background()
	templateObjects, err := a.getobjects(factory, fo, validator)
	if err != nil {
		return err
	}

	if a.DryRun {
		for i := a.Start; i < a.End; i++ {
			for _, obj := range templateObjects {
				u := obj.Get(i)
				s := json.NewYAMLSerializer(json.DefaultMetaFactory, scheme.Scheme, scheme.Scheme)
				s.Encode(u, os.Stdout)
				fmt.Fprintln(os.Stdout, "---")
			}
		}
	} else {
		errs := []error{}
		iterations := (a.End - a.Start)
		expectedNumObjs := iterations * len(templateObjects)
		fmt.Println("We have", iterations, "iterations and", len(templateObjects), "objects to apply in each iteration. For a total of", expectedNumObjs, "objects to apply.")
		fmt.Println("objects start: ", time.Now().Format(time.RFC3339))
		defer func() { fmt.Println("objects done: ", time.Now().Format(time.RFC3339)) }()

		progress := newProgressTracker(expectedNumObjs)

		if !a.Async {
			firstError := false
			for i := a.Start; i < a.End; i++ {
				for _, obj := range templateObjects {
					err = a.applyOne(ctx, i, obj, dynamicClient)
					if err != nil {
						if !firstError {
							fmt.Printf("First error encountered at index: %d %v\n", i, err)
							firstError = true
						}
						errs = append(errs, err)
					}
					progress.Increment()
				}
			}
		} else {
			var firstError error
			errIndex := 0
			for result := range a.runner(ctx, templateObjects, dynamicClient) {
				if result.err != nil {
					if firstError == nil || errIndex > result.index {
						firstError = result.err
						errIndex = result.index
						fmt.Printf("Potential first error encountered at index: %d %v\n", errIndex, firstError)
					}
					errs = append(errs, result.err)
				}
				progress.Increment()
			}
			if firstError != nil {
				fmt.Printf("First error encountered at index: %d %v\n", errIndex, firstError)
			}
		}
		if len(errs) == 1 {
			return errs[0]
		}
		if len(errs) > 1 {
			return utilerrors.NewAggregate(errs)
		}
	}

	return nil
}

func (a *Applier) getobjects(factory cmdutil.Factory, fo resource.FilenameOptions, validator validation.Schema) ([]*TemplateInfo, error) {
	builder := factory.NewBuilder()

	if a.Workers == 0 {
		a.Workers = 10
	}

	namespace, enforceNamespace, err := factory.ToRawKubeConfigLoader().Namespace()
	if err != nil {
		return nil, err
	}
	// read the yaml or yaml array from the template file
	r := builder.
		Unstructured().
		Schema(validator).
		ContinueOnError().
		NamespaceParam(namespace).DefaultNamespace().
		FilenameParam(enforceNamespace, &fo).
		Flatten().
		Do()
	objects, err := r.Infos()
	if err != nil {
		return nil, err
	}

	var templateObjects []*TemplateInfo
	for _, info := range objects {
		templateObjects = append(templateObjects, NewTemplateInfo(info))
	}
	return templateObjects, nil
}

func (a *Applier) applyOne(ctx context.Context, i int, obj *TemplateInfo, dynamicClient dynamic.Interface) error {
	a.getLock.Lock()
	objToCreate := obj.Get(i).DeepCopy()
	a.getLock.Unlock()
	var err error
	if a.Delete {
		err = dynamicClient.Resource(obj.Mapping.Resource).Namespace(objToCreate.GetNamespace()).Delete(ctx, objToCreate.GetName(), metav1.DeleteOptions{})
	} else {
		_, err = dynamicClient.Resource(obj.Mapping.Resource).Namespace(objToCreate.GetNamespace()).Apply(ctx, objToCreate.GetName(), objToCreate, metav1.ApplyOptions{FieldManager: "kgateway-dev/applier", Force: a.Force})
	}
	return err
}

type result struct {
	err   error
	index int
}

func (a *Applier) runner(ctx context.Context, templateObjects []*TemplateInfo, dynamicClient dynamic.Interface) <-chan result {
	resultc := make(chan result, 100)
	var wg sync.WaitGroup

	type queueItem struct {
		index int
	}
	queue := make(chan queueItem, 100)
	go func() {
		// put all objects in the queue
		defer close(queue)
		for i := a.Start; i < a.End; i++ {
			queue <- queueItem{
				index: i,
			}
		}
	}()

	// spawn workers to process the queue
	for i := 0; i < a.Workers; i++ {
		wg.Go(func() {
			for item := range queue {
				// create objects in order in case there are dependencies
				for _, obj := range templateObjects {
					err := a.applyOne(ctx, item.index, obj, dynamicClient)
					resultc <- result{index: item.index, err: err}
				}
			}
		})
	}

	go func() {
		wg.Wait()
		// we all workers are done, close the result channel
		close(resultc)
	}()
	return resultc
}

type TemplateContext struct {
	Index int
}

type progressTracker struct {
	count int
	step  int
	total int
}

func newProgressTracker(total int) *progressTracker {
	step := max(total/20, 1)

	return &progressTracker{
		step:  step,
		total: total,
	}
}

func (p *progressTracker) Increment() {
	p.count++
	if p.count == p.total || p.count%p.step == 0 {
		fmt.Printf("Progress: %d/%d\n", p.count, p.total)
	}
}

type TemplateInfo struct {
	*resource.Info
	Modifiers         []func(TemplateContext)
	UnstructuedObject *unstructured.Unstructured
}

func NewTemplateInfo(info *resource.Info) *TemplateInfo {
	ti := &TemplateInfo{
		Info:              info,
		UnstructuedObject: info.Object.(*unstructured.Unstructured).DeepCopy(),
	}

	ti.addModifiers(ti.UnstructuedObject.Object)
	return ti
}

func (ti *TemplateInfo) addModifiers(obj map[string]any) {
	// Object is a JSON compatible map with string, float, int, bool, []interface{}, or
	// map[string]interface{}
	// children.
	for k, v := range obj {
		switch v := v.(type) {
		case string:
			ti.maybeTemplatify(v, func(n string) {
				obj[k] = n
			})
			// test if we need a template

		case map[string]any:
			ti.addModifiers(v)
		case []any:
			for i, elem := range v {
				switch elem := elem.(type) {
				case string:
					ti.maybeTemplatify(elem, func(n string) {
						v[i] = n
					})
				case map[string]any:
					ti.addModifiers(elem)
				}
			}
		}
	}
}

func (ti *TemplateInfo) maybeTemplatify(originalValue string, f func(n string)) {
	// test if we need a template
	t := template.Must(template.New("test").Funcs(funcMap()).Parse(originalValue))
	var b bytes.Buffer
	// test if we need a template
	t.Execute(&b, TemplateContext{})
	if b.String() != originalValue {
		ti.Modifiers = append(ti.Modifiers, func(tc TemplateContext) {
			var b bytes.Buffer
			t.Execute(&b, tc)
			f(b.String())
		})
	}
}

func (ti *TemplateInfo) Get(index int) *unstructured.Unstructured {
	tc := TemplateContext{
		Index: index,
	}
	for _, m := range ti.Modifiers {
		m(tc)
	}
	return ti.UnstructuedObject
}

```

### Core Architecture Module: `hack/utils/applier/pkg/applier/funcs.go`
```
package applier

import (
	"fmt"
	"math"
	"reflect"
	"text/template"
)

func funcMap() template.FuncMap {
	return template.FuncMap{
		"add":      add,
		"subtract": subtract,
	}
}

func convert(a reflect.Value) (int64, error) {
	switch a.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return a.Int(), nil
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		value := a.Uint()
		if value > math.MaxInt64 {
			return 0, fmt.Errorf("unsupported unsigned value: %d", value)
		}
		return int64(value), nil
	default:
		return 0, fmt.Errorf("unsupported type: %T", a)
	}
}

func add(a, b reflect.Value) (any, error) {
	a64, err := convert(a)
	if err != nil {
		return nil, err
	}
	b64, err := convert(b)
	if err != nil {
		return nil, err
	}
	return a64 + b64, nil
}

func subtract(a, b reflect.Value) (any, error) {
	a64, err := convert(a)
	if err != nil {
		return nil, err
	}
	b64, err := convert(b)
	if err != nil {
		return nil, err
	}
	return a64 - b64, nil
}

```

### Core Architecture Module: `hack/utils/jwt/jwt-generator.go`
```
package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"fmt"
	"math/big"
	random "math/rand"
	"os"
	"strconv"
	"time"

	jose "github.com/go-jose/go-jose/v4"
	"github.com/golang-jwt/jwt/v5"
)

// use this to generate jwks and a jwt signed by the key in it

func main() {
	kid := strconv.Itoa(random.Int()) //nolint:gosec
	jwks, key, err := generateJWKS(kid)
	if err != nil {
		fmt.Printf("error generating jwks: %s", err.Error())
		os.Exit(1)
	}

	serializedJwks, err := json.Marshal(jwks)
	if err != nil {
		fmt.Printf("error serializing jwks: %s", err.Error())
		os.Exit(1)
	}

	jwt, err := generateJwt("ignore@kgateway.dev", kid, key)
	if err != nil {
		fmt.Printf("error generating jwt: %s", err.Error())
		os.Exit(1)
	}

	jwt1, err := generateJwt("boom@kgateway.dev", kid, key)
	if err != nil {
		fmt.Printf("error generating jwt: %s", err.Error())
		os.Exit(1)
	}

	fmt.Printf("jwks: %s\n", string(serializedJwks))
	fmt.Printf("jwt, sub: 'ignore@kgateway.dev': %s\n", jwt)
	fmt.Printf("jwt, sub: 'boom@kgateway.dev': %s\n", jwt1)
}

func generateJWKS(kid string) (*jose.JSONWebKeySet, *rsa.PrivateKey, error) {
	rsaKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, nil, err
	}
	serialNumber, err := rand.Int(rand.Reader, big.NewInt(100))
	if err != nil {
		return nil, nil, err
	}

	template := x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			Organization: []string{"kgateway.dev"},
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().Add(2 * time.Hour),
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &rsaKey.PublicKey, rsaKey)
	if err != nil {
		return nil, nil, err
	}
	certificate, err := x509.ParseCertificate(derBytes)
	if err != nil {
		return nil, nil, err
	}

	return &jose.JSONWebKeySet{
		Keys: []jose.JSONWebKey{
			{
				Certificates: []*x509.Certificate{certificate},
				Key:          &rsaKey.PublicKey,
				KeyID:        kid,
				Use:          "sig",
			},
		},
	}, rsaKey, nil
}

func generateJwt(sub, kid string, key *rsa.PrivateKey) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.RegisteredClaims{
		Issuer:    "https://kgateway.dev",
		Subject:   sub,
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		NotBefore: jwt.NewNumericDate(time.Now()),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(85440 * time.Hour)), // 10 years
	})
	token.Header["kid"] = kid
	return token.SignedString(key)
}

```

### Core Architecture Module: `hack/utils/oss_compliance/oss_compliance.go`
```
package main

import (
	"fmt"
	"os"

	"github.com/solo-io/go-list-licenses/pkg/license"
)

func main() {
	// dependencies for this package which are used on mac, and will not be present in linux CI
	macOnlyDependencies := []string{
		"github.com/mitchellh/go-homedir",
		"github.com/containerd/continuity",
	}

	app, err := license.CliAllPackages(macOnlyDependencies)
	if err != nil {
		fmt.Printf("unable to list all kgateway dependencies: %v\n", err)
		os.Exit(1)
	}
	if err := app.Execute(); err != nil {
		fmt.Printf("unable to run oss compliance check: %v\n", err)
		os.Exit(1)
	}
}

```

### Core Architecture Module: `internal/envoyinit/pkg/utils/conts.go`
```
package utils

const (
	// SystemCaSecretName is the SDS (Secret Discovery Service) secret name used to
	// reference the system's trusted certificate authority (CA) bundle.
	SystemCaSecretName = "SYSTEM_CA_CERT" //nolint:gosec // G101: This is a well-known SDS secret name, not a credential
)

```

### Core Architecture Module: `pkg/kgateway/extensions2/plugins/trafficpolicy/utils.go`
```
package trafficpolicy

import (
	set_metadata "github.com/envoyproxy/go-control-plane/envoy/extensions/filters/http/set_metadata/v3"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/kgateway-dev/kgateway/v2/api/v1alpha1/kgateway"
	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/filters"
	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
)

type ProviderNeededMap struct {
	// map filter_chain name -> providers
	Providers map[string][]Provider
}

type Provider struct {
	Name        string
	Extension   *TrafficPolicyGatewayExtensionIR
	FilterStage filters.FilterStage[filters.WellKnownFilterStage]
}

func (p *ProviderNeededMap) Add(filterChain, providerName string, provider *TrafficPolicyGatewayExtensionIR, filterStage filters.FilterStage[filters.WellKnownFilterStage]) {
	if p.Providers == nil {
		p.Providers = make(map[string][]Provider)
	}
	p.Providers[filterChain] = append(p.Providers[filterChain], Provider{
		Name:        providerName,
		Extension:   provider,
		FilterStage: filterStage,
	})
}

func AddDisableFilterIfNeeded(
	stagedFilters []filters.StagedHttpFilter,
	disableFilterName string,
	disableFilterMetadataNamespace string,
) []filters.StagedHttpFilter {
	for _, f := range stagedFilters {
		if f.Filter.GetName() == disableFilterName {
			return stagedFilters
		}
	}

	f := filters.MustNewStagedFilter(
		disableFilterName,
		newSetMetadataConfig(disableFilterMetadataNamespace),
		filters.BeforeStage(filters.FaultStage),
	)
	f.Filter.Disabled = true
	stagedFilters = append(stagedFilters, f)
	return stagedFilters
}

func newSetMetadataConfig(metadataNamespace string) *set_metadata.Config {
	return &set_metadata.Config{
		Metadata: []*set_metadata.Metadata{
			{
				MetadataNamespace: metadataNamespace,
				Value: &structpb.Struct{Fields: map[string]*structpb.Value{
					globalFilterDisableMetadataKey: structpb.NewBoolValue(true),
				}},
			},
		},
	}
}

func AddAuthEnabledFilterIfNeeded(
	stagedFilters []filters.StagedHttpFilter,
	filterName string,
	enableAuthMetadata bool,
) []filters.StagedHttpFilter {
	if !enableAuthMetadata {
		return stagedFilters
	}
	for _, f := range stagedFilters {
		if f.Filter.GetName() == filterName {
			return stagedFilters
		}
	}

	f := filters.MustNewStagedFilter(filterName,
		GenerateBlankTransformationConfig(),
		filters.AfterStage(filters.AuthNStage),
	)
	f.Filter.Disabled = true
	stagedFilters = append(stagedFilters, f)
	return stagedFilters
}

// AddAuthMetadataIfNeeded sets the `dev.kgateway.auth_policy:auth_succeeded=true` dynamic metadata
// via the transformation filter when enableAuthMetadata is true
func AddAuthMetadataIfNeeded(perFilterConfig *ir.TypedFilterConfigMap, filterName string, enableAuthMetadata bool) {
	if !enableAuthMetadata {
		return
	}
	perFilterConfig.AddTypedConfig(filterName, generateDynamicMetadata(AuthPolicyMetadataNamespace, map[string]kgateway.InjaTemplate{
		AuthSucceededMetadataKey: kgateway.InjaTemplate("true"),
	}))
}

// AddBlankTransformationIfNeeded sets a blank (no-op) per-route transformation on the named filter when
// enableAuthMetadata is true. This prevents auth metadata from being set on routes
// where auth is explicitly disabled or not configured.
func AddBlankTransformationIfNeeded(perFilterConfig *ir.TypedFilterConfigMap, filterName string, enableAuthMetadata bool) {
	if !enableAuthMetadata {
		return
	}
	perFilterConfig.AddTypedConfig(filterName, GenerateBlankTransformationConfigPerRoute())
}

```

### Core Architecture Module: `pkg/kgateway/extensions2/pluginutils/envoy_tls.go`
```
package pluginutils

import (
	"crypto/tls"

	envoycorev3 "github.com/envoyproxy/go-control-plane/envoy/config/core/v3"
	envoytlsv3 "github.com/envoyproxy/go-control-plane/envoy/extensions/transport_sockets/tls/v3"
	"k8s.io/client-go/util/cert"
)

// ResolveUpstreamSslConfigFromCA creates an UpstreamTlsContext from a CA certificate string.
func ResolveUpstreamSslConfigFromCA(caCert string, validation *envoytlsv3.CertificateValidationContext, sni string) (*envoytlsv3.UpstreamTlsContext, error) {
	common, err := ResolveCommonSslConfigFromCA(caCert, validation)
	if err != nil {
		return nil, err
	}

	return &envoytlsv3.UpstreamTlsContext{
		CommonTlsContext: common,
		Sni:              sni,
	}, nil
}

// ResolveCommonSslConfigFromCA creates a CommonTlsContext from a CA certificate string.
func ResolveCommonSslConfigFromCA(caCert string, validation *envoytlsv3.CertificateValidationContext) (*envoytlsv3.CommonTlsContext, error) {
	caCrtData := InlineStringDataSource(caCert)

	tlsContext := &envoytlsv3.CommonTlsContext{
		// default params
		TlsParams: &envoytlsv3.TlsParameters{},
	}
	validation.TrustedCa = caCrtData
	validationCtx := &envoytlsv3.CommonTlsContext_ValidationContext{
		ValidationContext: validation,
	}

	tlsContext.ValidationContextType = validationCtx
	return tlsContext, nil
}

// CleanedSslKeyPair validates and cleans a certificate and key pair.
func CleanedSslKeyPair(certChain, privateKey string) (cleanedChain string, err error) {
	// validate that the cert and key are a valid pair
	_, err = tls.X509KeyPair([]byte(certChain), []byte(privateKey))
	if err != nil {
		return "", err
	}

	// validate that the parsed piece is valid
	// this is still faster than a call out to openssl despite this second parsing pass of the cert
	// pem parsing in go is permissive while envoy is not
	// this might not be needed once we have larger envoy validation
	candidateCert, err := cert.ParseCertsPEM([]byte(certChain))
	if err != nil {
		// return err rather than sanitize. This is to maintain UX with older versions and to keep in line with gateway2 pkg.
		return "", err
	}
	cleanedChainBytes, err := cert.EncodeCertificates(candidateCert...)
	cleanedChain = string(cleanedChainBytes)

	return cleanedChain, err
}

// InlineStringDataSource returns an Envoy data source that uses the given string as an inline data source.
func InlineStringDataSource(s string) *envoycorev3.DataSource {
	return &envoycorev3.DataSource{
		Specifier: &envoycorev3.DataSource_InlineString{
			InlineString: s,
		},
	}
}

// FileDataSource returns an Envoy data source that uses the given string as a file path.
func FileDataSource(s string) *envoycorev3.DataSource {
	return &envoycorev3.DataSource{
		Specifier: &envoycorev3.DataSource_Filename{
			Filename: s,
		},
	}
}

```

### Core Architecture Module: `pkg/kgateway/extensions2/pluginutils/gatewayextensions.go`
```
package pluginutils

import (
	"errors"
	"fmt"

	"istio.io/istio/pkg/kube/krt"

	"github.com/kgateway-dev/kgateway/v2/api/v1alpha1/kgateway"
	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
)

// ErrGatewayExtensionNotFound is returned when a referenced GatewayExtension cannot be resolved.
var ErrGatewayExtensionNotFound = errors.New("gateway extension not found")

// ExtensionTypeError is an error for when an extension type is mismatched
type ExtensionTypeError struct {
	expected kgateway.GatewayExtensionType
}

var _ error = &ExtensionTypeError{}

// Error implements error.
func (e *ExtensionTypeError) Error() string {
	return fmt.Sprintf("expected gatewayextension type %v", e.expected)
}

// ErrInvalidExtensionType is an error for when an extension type is invalid.
func ErrInvalidExtensionType(expected kgateway.GatewayExtensionType) error {
	return &ExtensionTypeError{expected: expected}
}

// GetGatewayExtension retrieves a GatewayExtension resource by name and namespace.
// It returns the extension and any error encountered during retrieval.
func GetGatewayExtension(
	gwExts krt.Collection[ir.GatewayExtension],
	kctx krt.HandlerContext,
	extensionName string,
	ns string,
) (*ir.GatewayExtension, error) {
	gwExtKey := ir.ObjectSource{
		Group:     wellknown.GatewayExtensionGVK.GroupKind().Group,
		Kind:      wellknown.GatewayExtensionGVK.GroupKind().Kind,
		Name:      extensionName,
		Namespace: ns,
	}
	gwExt := krt.FetchOne(kctx, gwExts, krt.FilterKey(gwExtKey.ResourceName()))
	if gwExt == nil {
		return nil, fmt.Errorf("%s/%s: %w", ns, extensionName, ErrGatewayExtensionNotFound)
	}
	return gwExt, nil
}

```

### Core Architecture Module: `pkg/kgateway/extensions2/pluginutils/headers.go`
```
package pluginutils

import (
	"cmp"
	"errors"
	"fmt"
	"slices"

	mutation_rulesv3 "github.com/envoyproxy/go-control-plane/envoy/config/common/mutation_rules/v3"
	envoycorev3 "github.com/envoyproxy/go-control-plane/envoy/config/core/v3"
	"istio.io/istio/pkg/kube/krt"
	gwv1 "sigs.k8s.io/gateway-api/apis/v1"

	sharedv1alpha1 "github.com/kgateway-dev/kgateway/v2/api/v1alpha1/shared"
	"github.com/kgateway-dev/kgateway/v2/pkg/krtcollections"
)

var (
	ErrUnsupportedRemoveHeaderMutation = errors.New("remove mutation cannot be converted to append action")
	ErrUnknownHeaderMutation           = errors.New("unknown header mutation")
)

func ConvertMutations(filter *gwv1.HTTPHeaderFilter) (mutations []*mutation_rulesv3.HeaderMutation) {
	if filter == nil {
		return nil
	}

	if len(filter.Add) == 0 && len(filter.Set) == 0 && len(filter.Remove) == 0 {
		return nil
	}

	for _, h := range filter.Add {
		mutations = append(mutations, &mutation_rulesv3.HeaderMutation{
			Action: &mutation_rulesv3.HeaderMutation_Append{
				Append: &envoycorev3.HeaderValueOption{
					Header: &envoycorev3.HeaderValue{
						Key:   string(h.Name),
						Value: h.Value,
					},
					AppendAction: envoycorev3.HeaderValueOption_APPEND_IF_EXISTS_OR_ADD,
				},
			},
		})
	}

	for _, h := range filter.Set {
		mutations = append(mutations, &mutation_rulesv3.HeaderMutation{
			Action: &mutation_rulesv3.HeaderMutation_Append{
				Append: &envoycorev3.HeaderValueOption{
					Header: &envoycorev3.HeaderValue{
						Key:   string(h.Name),
						Value: h.Value,
					},
					AppendAction: envoycorev3.HeaderValueOption_OVERWRITE_IF_EXISTS_OR_ADD,
				},
			},
		})
	}

	for _, h := range filter.Remove {
		mutations = append(mutations, &mutation_rulesv3.HeaderMutation{
			Action: &mutation_rulesv3.HeaderMutation_Remove{
				Remove: h,
			},
		})
	}

	return mutations
}

func ConvertHeaderFilter(
	krtctx krt.HandlerContext,
	from krtcollections.From,
	secrets *krtcollections.SecretIndex,
	filter *sharedv1alpha1.HTTPHeaderFilter,
) (*gwv1.HTTPHeaderFilter, error) {
	if filter == nil {
		return nil, nil
	}

	if len(filter.Add) == 0 && len(filter.Set) == 0 && len(filter.Remove) == 0 {
		return nil, nil
	}

	gwFilter := &gwv1.HTTPHeaderFilter{}
	for _, h := range filter.Add {
		resolved, err := resolveHeader(krtctx, from, secrets, h)
		if err != nil {
			if h.Name != nil {
				return nil, fmt.Errorf("failed to resolve header '%s': %w", *h.Name, err)
			}
			return nil, fmt.Errorf("failed to resolve header value(s): %w", err)
		}
		for _, r := range resolved {
			gwFilter.Add = append(gwFilter.Add, r)
		}
	}

	for _, h := range filter.Set {
		resolved, err := resolveHeader(krtctx, from, secrets, h)
		if err != nil {
			if h.Name != nil {
				return nil, fmt.Errorf("failed to resolve header '%s': %w", *h.Name, err)
			}
			return nil, fmt.Errorf("failed to resolve header value(s): %w", err)
		}
		for _, r := range resolved {
			gwFilter.Set = append(gwFilter.Set, r)
		}
	}

	gwFilter.Remove = filter.Remove

	return gwFilter, nil
}

// resolveHeader resolves an HTTPHeader entry into one or more gwv1.HTTPHeader pairs.
// When both name and key are absent on a secretRef entry, all Secret data entries are returned.
func resolveHeader(
	krtctx krt.HandlerContext,
	from krtcollections.From,
	secrets *krtcollections.SecretIndex,
	h sharedv1alpha1.HTTPHeader,
) ([]gwv1.HTTPHeader, error) {
	if h.Value != nil {
		return []gwv1.HTTPHeader{{Name: *h.Name, Value: *h.Value}}, nil
	}

	ref := h.SecretRef
	ns := gwv1.Namespace(from.Namespace)
	if ref.Namespace != nil {
		ns = *ref.Namespace
	}
	secretRef := gwv1.SecretObjectReference{
		Name:      ref.Name,
		Namespace: &ns,
	}

	secret, err := secrets.GetSecret(krtctx, from, secretRef)
	if err != nil {
		return nil, fmt.Errorf("secret %s/%s: %w", ns, ref.Name, err)
	}

	// Both name and key absent: inject every entry in the Secret as a header.
	if ref.Key == nil && h.Name == nil {
		pairs := make([]gwv1.HTTPHeader, 0, len(secret.Data))
		for k, v := range secret.Data {
			pairs = append(pairs, gwv1.HTTPHeader{Name: gwv1.HTTPHeaderName(k), Value: string(v)})
		}
		slices.SortFunc(pairs, func(a, b gwv1.HTTPHeader) int {
			return cmp.Compare(string(a.Name), string(b.Name))
		})
		return pairs, nil
	}

	// Determine which key to look up: explicit key, or fall back to header name.
	// At this point at least one of ref.Key or h.Name is non-nil (both-nil handled above).
	var key string
	if ref.Key != nil {
		key = *ref.Key
	} else {
		key = string(*h.Name)
	}

	data, ok := secret.Data[key]
	if !ok {
		return nil, fmt.Errorf("secret %s/%s does not contain key %q", ns, ref.Name, key)
	}

	// Determine header name: explicit name, or fall back to key.
	headerName := gwv1.HTTPHeaderName(key)
	if h.Name != nil {
		headerName = *h.Name
	}
	return []gwv1.HTTPHeader{{Name: headerName, Value: string(data)}}, nil
}

func ConvertMutationsToOptions(mutations []*mutation_rulesv3.HeaderMutation) (options []*envoycorev3.HeaderValueOption, err error) {
	for _, m := range mutations {
		switch a := m.Action.(type) {
		case *mutation_rulesv3.HeaderMutation_Append:
			options = append(options, a.Append)
		case *mutation_rulesv3.HeaderMutation_Remove:
			return nil, ErrUnsupportedRemoveHeaderMutation
		default:
			return nil, ErrUnknownHeaderMutation
		}
	}

	return options, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #14788** (2026-10-05): **[2.4] fix(endpoints): keep the weight of locality groups without a locality**
  *Symptoms*: # Description  Cherry-pick https://github.com/kgateway-dev/kgateway/pull/14775 to v2.4.x.  **Motivation:** Since #13978, locality-weighted LB is on by default for EDS clusters, but `prioritizeWithLbInfo` left `Locality` unset on endpoint groups whose endpoints have no locality. Envoy only records a group's `load_balancing_weight` when the group has a locality, so such groups got locality weight 0. They received no traffic while any other locality had healthy endpoints. #13978 is in v2.4.0, so every v2.4.x release is affected.  **What changed:** `prioritizeWithLbInfo` now always sets `Locality`, using an empty `Locality{}` when the endpoints have none, so Envoy keeps the group's weight.  # Change Type  /kind fix  # Changelog  ```release-note Fixed endpoints without a locality receiving no traffic when other endpoints of the same backend have a locality. ```  # Additional Notes  The cherry-pick conflicted, because v2.4.x predates the endpoint refactors on main. - **`prioritize.go`:** I kept v2.4.x's loop over `ep.LbEps` (main sorts localities first) and applied only the fix inside it. - **`prioritize_test.go`:** This file doesn't exist on v2.4.x. I added one containing only `TestPrioritizeEndpointsAlwaysSetsLocality`, with the endpoint helper inlined. The endpoints set an explicit load balancing weight, because on v2.4.x a group's weight is the plain sum of its endpoint weights, with no default of 1. - **Goldens:** Rename detection applied some of main's golden changes to the w

- **Issue #14786** (2026-10-05): **fix(ir): compare pointer backend collections with Equals**
  *Symptoms*: # Description  **Motivation:** `TestWithStandardSettings/backendconfigpolicy-tls` intermittently fails under `-race`. The race is between two goroutines:  - **Read:** `krt.Equal` → `reflect.DeepEqual` on `*ir.BackendObjectIR` rows, in the collections built by `BackendIndex.AttachPoliciesToCollection`. - **Write:** `proxy_syncer.baseClusterVersion` → `utils.HashProtoWithHasher` marshals the base cluster, which writes the size cache of every proto it reaches.  The `DeepEqual` should never happen. `BackendObjectIR.Equals` had a value receiver, `Equals(BackendObjectIR)`. For a `krt.Collection[*BackendObjectIR]`, `krt.Equal` looks for an `Equaler[*BackendObjectIR]`, finds none, and falls back to `reflect.DeepEqual`. That walks every attached policy IR and its protos.  Besides the race, this has two other effects on the pointer collections: - Every row comparison does a deep reflective walk instead of the curated `Equals`. - Fields that `Equals` deliberately skips (`Errors`, `RequiresPolicyStatus`) are still compared.  **What changed:** - `BackendObjectIR.Equals` now takes and receives a pointer: `func (c *BackendObjectIR) Equals(in *BackendObjectIR) bool`. krt now finds it for both collection shapes:   - pointer collections satisfy `Equaler[*BackendObjectIR]` directly;   - value collections match through krt's `any(&a).(Equaler[*O])` check.  # Change Type  /kind fix  # Changelog  ```release-note NONE ``` 

- **Issue #14776** (2026-10-05): **fix: disable implicit zone-aware routing instead of defaulting to locality-weighted LB**
  *Symptoms*: # Description  **Motivation:** The proxy bootstrap always sets `cluster_manager.local_cluster_name`. #13978 therefore added a default locality mode so that Envoy's implicit zone-aware routing (`routing_enabled` 100%, `min_cluster_size` 6) doesn't engage on clusters that never asked for it. The default it picked is `locality_weighted_lb_config`.  Locality-weighted LB isn't neutral, though. Envoy only uses the `load_balancing_weight` of groups that have a locality, so a group without one gets weight 0. Such a group receives no traffic while any other locality has healthy endpoints. Endpoints without a locality include WorkloadEntries without `spec.locality`, and pods on nodes without topology labels. As a result, enabling zone-aware routing for some clusters turned on locality weighting for every cluster. The `localityType` API field documents locality weighting as opt-in ("This field is required to enable locality weighted load balancing").  **What changed:** The default now turns zone-aware routing off directly, using `zone_aware_lb_config` with `routing_enabled: 0%`, instead of switching to locality-weighted LB. That restores the behaviour from before #13978 for clusters with no locality policy: Envoy balances across all hosts in a priority and ignores locality weights. - `defaultLocalityConfig` (`common_lb_config`) for EDS clusters with no locality mode from a policy. - `buildTypedLocalityLbConfig` (`locality_lb_config` on typed round_robin/least_request/random policies) wh

- **Issue #14775** (2026-10-05): **fix(endpoints): keep the weight of locality groups without a locality**
  *Symptoms*: # Description  **Motivation:** Since #13978, `defaultLocalityConfig` sets `common_lb_config.locality_weighted_lb_config: {}` on every EDS cluster that has no locality mode from a policy. `prioritizeWithLbInfo`, however, leaves `Locality` unset on any `LocalityLbEndpoints` group whose endpoints have no locality, for example a WorkloadEntry without `spec.locality`, or a pod on a node with no topology labels.  Envoy only records a group's `load_balancing_weight` when the group has a locality (`PriorityStateManager::initializePriorityFor` checks `has_locality() && has_load_balancing_weight()`). So the group with no locality gets locality weight 0. With locality-weighted LB on, a weight-0 locality is never picked while any other locality has healthy endpoints. In a cluster where some endpoints have a locality and others don't, the ones without receive no traffic at all. Nothing reports an error, and the hosts show as healthy with `rq_total 0`.  **What changed:** `prioritizeWithLbInfo` now always sets `Locality`, using an empty `Locality{}` when the endpoints have none. An empty message that is set still counts as present on the wire, so Envoy keeps the group's weight. This changes nothing else: - `LbPriority` and `applyLocalityFailover` read the locality through nil-safe getters, so an empty and a nil `Locality` compute the same priorities. - Sort order is unchanged, because the empty locality still sorts first.  `TestPrioritizeEndpointsAlwaysSetsLocality` covers a CLA that mixes 
  **Post-Mortem & Fix Analysis**:
  > Make sense and look reasonable; however, it sounds like we can have an e2e test to test this without setting up multi-k8s-cluster. My concern is that in the future if envoy changes to look for more than just the present of the locality setting , an empty locality object may not be enough anymore and we should detect that. 
  > > LGTM >  > One quick question though, is waypoint the best spot for this e2e test?  Because the cluster sets up istio, I figured it was the best spot

- **Issue #14771** (2026-09-30): **chore: bump Gateway API to v1.6.2**
  *Symptoms*: # Description  nothing major changed  # Change Type  /kind bump  # Changelog  ```release-note NONE ``` 

- **Issue #14770** (2026-10-05): **test: rebuild dummy-idp image when its sources change**
  *Symptoms*: # Description  NOTE(chandler): I recently cleaned up another testing docker image and now this has lint compared to that extproc test image.  **Motivation:** The local build of the `dummy-idp` e2e image can go stale without any error.  **What changed:** - **Binary never rebuilt.** The binary rule depends on `$(DUMMY_IDP_SOURCES)`, which has never been defined (since #12850), so the rule has no prerequisites. Once `_output/hack/dummy-idp/dummy-idp-linux-$(GOARCH)` exists, edits to `dummy-idp.go`, its embedded cert and key, or root `go.mod`/`go.sum` never reach the image. Define `DUMMY_IDP_SOURCES` to cover all of those. - **Base-image override silently ignored.** The docker stamp doesn't track `DUMMY_IDP_BASE_IMAGE`, so changing it reuses the image built from the old base. Nothing sets the override, so remove it and name `cgr.dev/chainguard/static:latest` directly in `hack/dummy-idp/Dockerfile`. The Dockerfile is already a prerequisite of the image target, so changing the base now forces a rebuild.  # Change Type  /kind cleanup  # Changelog  ```release-note NONE ```  # Additional Notes  - CI builds from a clean checkout and was unaffected. Local and persistent-install e2e runs could serve a stale IdP. - The resulting image is unchanged: same base, tag, user, and entrypoint. - Verified locally: clean `make dummy-idp-docker` builds with no warnings and the container starts; a second `make dummy-idp` is a no-op; touching `dummy-idp.key` triggers a rebuild;

- **Issue #14768** (2026-09-28): **test: fold e2e extproc server into the root Go module**
  *Symptoms*: # Description  **Motivation:** `test/e2e/defaults/extproc` was its own Go module with its own `go.mod`/`go.sum`. Security scanners report on every manifest, so each root-module CVE bump had to be repeated there, and in practice it lagged behind: it pinned `go-control-plane/envoy v1.37.0` while the root module was already on a newer pseudo-version. Ten commits since #13376 exist only to re-bump this file (#13467, #13706, #13836, #14023, #14076, #14103, #14403, #14459, #14588, #14669). The server imports only `go-control-plane/envoy` and `grpc`, which the root module already requires, so a separate module buys nothing.  **What changed:** - Delete `test/e2e/defaults/extproc/go.mod` and `go.sum`; the server is now a `package main` in the root module. `go mod tidy` at the root is a no-op. - Build the binary on the host from the root module and copy it into `cgr.dev/chainguard/static`, following the `dummy-idp` pattern (#14739). This drops the in-image `cgr.dev/chainguard/go:latest` builder stage. - The image rebuilds when root `go.mod`/`go.sum` change, so dependency bumps reach the image. - Remove the extproc entries from `mod-download`, `mod-tidy`, and `MOD_FILES`. - `main.go` now falls under the root lint config. Lint fixes it required: `errors.Is(err, io.EOF)`, `envoycorev3` import alias, snake_case log key.  # Change Type  /kind cleanup  # Changelog  ```release-note NONE ```  # Additional Notes  - Image tag (`ghcr.io/kgateway-dev/extproc-server:0.0.1`), 

- **Issue #14765** (2026-09-28): **bump: go 1.26.8**
  *Symptoms*: <!-- Thanks for opening a PR! Please delete any sections that don’t apply. -->  # Description  Bump go. go 1.26.8 is an internal bug fix release only. <!-- A concise explanation of the change. You may include: - **Motivation:** why this change is needed - **What changed:** key implementation details - **Related issues:** e.g., `Fixes #123` -->  # Change Type /kind bump  <!-- Select one or more of the following by including the corresponding slash-command.  If you pick more than one, the release note is filed under whichever appears first here (manual reordering does not have any effect): ``` /kind breaking_change /kind feature /kind fix /kind deprecation /kind documentation /kind cleanup /kind install /kind bump (the following kinds are not included in release notes) /kind design /kind flake /kind test ``` -->  # Changelog  <!-- Provide the exact line to appear in the release notes for this PR.  A PR gets one release note, filed under the highest-precedence /kind above. If this change needs no release note, write "NONE" in the block below. -->  ```release-note NONE ```  # Additional Notes  <!-- Any extra context or edge cases for reviewers. --> 

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

### Incident Patch 1: `d084f70a` (2026-10-05)
**Commit Message**: fix(ir): compare pointer backend collections with Equals (#14786)

Signed-off-by: omar <[REDACTED_EMAIL]>

**File**: `pkg/kgateway/proxy_syncer/backends.go` (modified, +1/-1)
```diff
@@ -73,7 +73,7 @@ func (b baseEnvoyCluster) Equals(in baseEnvoyCluster) bool {
 			if b.Backend != in.Backend {
 				return false
 			}
-		} else if !b.Backend.Equals(*in.Backend) {
+		} else if !b.Backend.Equals(in.Backend) {
 			return false
 		}
 	}
```

**File**: `pkg/kgateway/proxy_syncer/gateway_backend_variants.go` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ func (v gatewayScopedBackend) Equals(other gatewayScopedBackend) bool {
 	if v.backend == nil || other.backend == nil {
 		return v.backend == other.backend
 	}
-	return v.backend.Equals(*other.backend)
+	return v.backend.Equals(other.backend)
 }
 
 func newGatewayBackendVariants(
```

**File**: `pkg/pluginsdk/ir/backend.go` (modified, +7/-2)
```diff
@@ -257,7 +257,12 @@ func (c BackendObjectIR) ResourceName() string {
 	return c.resourceName
 }
 
-func (c BackendObjectIR) Equals(in BackendObjectIR) bool {
+// Equals has a pointer receiver so that krt finds it for both
+// krt.Collection[BackendObjectIR] and krt.Collection[*BackendObjectIR]. With a
+// value receiver, a pointer collection has no Equaler[*BackendObjectIR] and krt
+// falls back to reflect.DeepEqual, which walks attached policy IR protos and
+// races with goroutines that marshal clusters built from them.
+func (c *BackendObjectIR) Equals(in *BackendObjectIR) bool {
 	if !c.objectSource.Equals(in.objectSource) {
 		return false
 	}
@@ -731,7 +736,7 @@ func backendObjectEqual(a, b *BackendObjectIR) bool {
 	if a == nil || b == nil {
 		return a == b
 	}
-	return a.Equals(*b)
+	return a.Equals(b)
 }
 
 func errorsEqual(a, b error) bool {
```

**File**: `pkg/pluginsdk/ir/backend_test.go` (modified, +27/-10)
```diff
@@ -2,11 +2,13 @@ package ir
 
 import (
 	"encoding/json"
+	"errors"
 	"slices"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
+	"istio.io/istio/pkg/kube/krt"
 	corev1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/runtime/schema"
@@ -173,16 +175,16 @@ func TestBackendObjectIREquals(t *testing.T) {
 			backend2 := tt.backend2()
 
 			// Test forward equality
-			result := backend1.Equals(backend2)
+			result := backend1.Equals(&backend2)
 			a.Equal(tt.want, result, "BackendObjectIR.Equals() result mismatch")
 
 			// Test symmetry: a.Equals(b) should equal b.Equals(a)
-			reverseResult := backend2.Equals(backend1)
+			reverseResult := backend2.Equals(&backend1)
 			a.Equal(result, reverseResult, "symmetry check failed: a.Equals(b) != b.Equals(a)")
 
 			// Test reflexivity: x.Equals(x) should always be true
-			a.True(backend1.Equals(backend1), "reflexivity check failed for backend1")
-			a.True(backend2.Equals(backend2), "reflexivity check failed for backend2")
+			a.True(backend1.Equals(&backend1), "reflexivity check failed for backend1")
+			a.True(backend2.Equals(&backend2), "reflexivity check failed for backend2")
 		})
 	}
 }
@@ -321,16 +323,31 @@ func TestBackendObjectIREqualsIsSymmetricOnObjIr(t *testing.T) {
 	with := serviceBackedIR("1", nil, 0)
 	with.ObjIr = &addressesIR{addrs: []string{"10.0.0.1"}}
 
-	assert.False(t, with.Equals(without), "an IR with plugin state is not equal to one without")
-	assert.False(t, without.Equals(with), "and the answer must not depend on which side is the receiver")
+	assert.False(t, with.Equals(&without), "an IR with plugin state is not equal to one without")
+	assert.False(t, without.Equals(&with), "and the answer must not depend on which side is the receiver")
 
 	same := serviceBackedIR("1", nil, 0)
 	same.ObjIr = &addressesIR{addrs: []string{"10.0.0.1"}}
-	assert.True(t, with.Equals(same), "equal plugin state on both sides compares equal")
-	assert.True(t, same.Equals(with))
+	assert.True(t, with.Equals(&same), "equal plugin state on both sides compares equal")
+	assert.True(t, same.Equals(&with))
 
 	moved := serviceBackedIR("1", nil, 0)
 	moved.ObjIr = &addressesIR{addrs: []string{"10.0.0.1", "2001:2::1"}}
-	assert.False(t, with.Equals(moved), "a change inside the plugin state is a change")
-	assert.False(t, moved.Equals(with))
+	assert.False(t, with.Equals(&moved), "a change inside the plugin state is a change")
+	assert.False(t, moved.Equals(&with))
+}
+
+// TestBackendObjectIRKrtEqualUsesEquals pins that krt compares backends with
+// Equals, for both value and pointer collections. Without an Equaler for the
+// element type, krt falls back to reflect.DeepEqual, which reads attached policy
+// IR protos while other goroutines marshal clusters built from them (a data
+// race on their size caches). The two backends differ only in Errors, which
+// Equals deliberately skips, so DeepEqual would report them as different.
+func TestBackendObjectIRKrtEqualUsesEquals(t *testing.T) {
+	a := createTestBackendObjectIR(wellknown.TrafficDistributionAny)
+	b := createTestBackendObjectIR(wellknown.TrafficDistributionAny)
+	b.Errors = []error{errors.New("derived from ObjIr, ignored by Equals")}
+
+	assert.True(t, krt.Equal(a, b), "value collections must compare with Equals")
+	assert.True(t, krt.Equal(&a, &b), "pointer collections must compare with Equals")
 }
```

---

### Incident Patch 2: `6046cab2` (2026-10-05)
**Commit Message**: fix(endpoints): keep the weight of locality groups without a locality (#14775)

Signed-off-by: omar <[REDACTED_EMAIL]>

**File**: `pkg/kgateway/endpoints/prioritize.go` (modified, +8/-7)
```diff
@@ -202,13 +202,14 @@ func prioritizeWithLbInfo(logger *slog.Logger, ep ir.EndpointsForBackend, lbInfo
 	totalEndpoints := 0
 	for _, loc := range sortedLocalities(ep.LbEps) {
 		eps := ep.LbEps[loc]
-		var l *envoycorev3.Locality
-		if loc != (ir.PodLocality{}) {
-			l = &envoycorev3.Locality{
-				Region:  loc.Region,
-				Zone:    loc.Zone,
-				SubZone: loc.Subzone,
-			}
+		// Always set Locality, even when it is empty. Envoy only records a
+		// group's load_balancing_weight when the group has a locality, so a
+		// group without one gets weight 0 under locality-weighted LB and
+		// receives no traffic while any other locality has endpoints.
+		l := &envoycorev3.Locality{
+			Region:  loc.Region,
+			Zone:    loc.Zone,
+			SubZone: loc.Subzone,
 		}
 
 		eps = filterInvalidEps(eps)
```

**File**: `pkg/kgateway/endpoints/prioritize_test.go` (modified, +58/-3)
```diff
@@ -8,6 +8,7 @@ import (
 	envoyendpointv3 "github.com/envoyproxy/go-control-plane/envoy/config/endpoint/v3"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
+	"google.golang.org/protobuf/proto"
 	corev1 "k8s.io/api/core/v1"
 
 	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/utils"
@@ -30,7 +31,7 @@ func TestPrioritizeEndpointsIsByteStable(t *testing.T) {
 	}, 80, "", "")
 	backendEndpoints := ir.NewEndpointsForBackend(backend)
 	// Enough localities that map ordering is overwhelmingly unlikely to be
-	// stable by chance, plus the zero locality, which is emitted with a nil
+	// stable by chance, plus the zero locality, which is emitted with an empty
 	// Locality and so sorts ahead of everything else.
 	localities := []ir.PodLocality{
 		{},
@@ -88,8 +89,62 @@ func TestPrioritizeEndpointsIsByteStable(t *testing.T) {
 	}
 }
 
-// localityOrderKey renders a locality group's locality for ordering assertions. A
-// nil Locality (the zero PodLocality) yields the empty key, which sorts first.
+// TestPrioritizeEndpointsAlwaysSetsLocality pins that a group whose endpoints have
+// no locality is still emitted with a (empty) Locality. Envoy only records a
+// group's load_balancing_weight when the group has a locality, so under
+// locality-weighted LB a group without one gets weight 0 and receives no traffic
+// while any other locality has endpoints.
+func TestPrioritizeEndpointsAlwaysSetsLocality(t *testing.T) {
+	backend := ir.NewBackendObjectIR(ir.ObjectSource{
+		Group: "networking.istio.io", Kind: "ServiceEntry", Namespace: "ns", Name: "se",
+	}, 80, "", "")
+	backendEndpoints := ir.NewEndpointsForBackend(backend)
+	localities := []ir.PodLocality{
+		{},
+		{Region: "r1", Zone: "z1"},
+	}
+	for i, locality := range localities {
+		backendEndpoints.Add(locality, prioritizeTestEndpoint(locality, i))
+	}
+
+	client := ir.NewUniquelyConnectedClient("role", "ns", map[string]string{
+		corev1.LabelTopologyRegion: "r1",
+		corev1.LabelTopologyZone:   "z1",
+	}, ir.PodLocality{Region: "r1", Zone: "z1"})
+
+	priorityModes := map[string]*PriorityInfo{
+		"noPriorityInfo": nil,
+		"failoverPriority": {
+			FailoverPriority: NewPriorities([]string{corev1.LabelTopologyRegion, corev1.LabelTopologyZone}),
+		},
+		"localityFailover": {},
+	}
+
+	for name, priorityInfo := range priorityModes {
+		t.Run(name, func(t *testing.T) {
+			inputs := EndpointsInputs{EndpointsForBackend: *backendEndpoints, PriorityInfo: priorityInfo}
+			cla := PrioritizeEndpoints(nil, client, inputs)
+
+			// Round-trip through the wire format: Envoy sees field presence, not
+			// the Go pointer, so an empty Locality must survive serialization.
+			raw, err := proto.Marshal(cla)
+			require.NoError(t, err)
+			decoded := &envoyendpointv3.ClusterLoadAssignment{}
+			require.NoError(t, proto.Unmarshal(raw, decoded))
+
+			require.Len(t, decoded.GetEndpoints(), len(localities))
+			for _, group := range decoded.GetEndpoints() {
+				assert.NotNil(t, group.GetLocality(),
+					"every locality group must carry a Locality so Envoy keeps its weight; got %v", group)
+				assert.NotZero(t, group.GetLoadBalancingWeight().GetValue(),
+					"every locality group must carry a load balancing weight; got %v", group)
+			}
+		})
+	}
+}
+
+// localityOrderKey renders a locality group's locality for ordering assertions. An
+// empty Locality (the zero PodLocality) yields the empty key, which sorts first.
 func localityOrderKey(group *envoyendpointv3.LocalityLbEndpoints) string {
 	locality := group.GetLocality()
 	return locality.GetRegion() + "/" + locality.GetZone() + "/" + locality.GetSubZone()
```

**File**: `pkg/kgateway/extensions2/plugins/waypoint/testdata/output/authz-serviceentry.yaml` (modified, +2/-0)
```diff
@@ -10,6 +10,7 @@ Clusters:
               address: 1.1.1.1
               portValue: 5000
       loadBalancingWeight: 1
+      locality: {}
   name: istio-se_infra_se-a_se-a.example.com_5000
   type: STATIC
 - connectTimeout: 5s
@@ -23,6 +24,7 @@ Clusters:
               address: 2.2.2.2
               portValue: 9000
       loadBalancingWeight: 1
+      locality: {}
   name: istio-se_infra_se-b_se-b.example.com_9000
   type: STATIC
 - connectTimeout: 5s
```

**File**: `pkg/kgateway/extensions2/plugins/waypoint/testdata/output/httproute-se-hostname.yaml` (modified, +2/-0)
```diff
@@ -10,6 +10,7 @@ Clusters:
               address: 1.1.1.1
               portValue: 5000
       loadBalancingWeight: 1
+      locality: {}
   name: istio-se_infra_se-a_se-a.example.com_5000
   type: STATIC
 - connectTimeout: 5s
@@ -23,6 +24,7 @@ Clusters:
               address: 2.2.2.2
               portValue: 9000
       loadBalancingWeight: 1
+      locality: {}
   name: istio-se_infra_se-b_se-b.example.com_9000
   type: STATIC
 - connectTimeout: 5s
```

**File**: `pkg/kgateway/extensions2/plugins/waypoint/testdata/output/httproute-se.yaml` (modified, +2/-0)
```diff
@@ -10,6 +10,7 @@ Clusters:
               address: 1.1.1.1
               portValue: 5000
       loadBalancingWeight: 1
+      locality: {}
   name: istio-se_infra_se-a_se-a.example.com_5000
   type: STATIC
 - connectTimeout: 5s
@@ -23,6 +24,7 @@ Clusters:
               address: 2.2.2.2
               portValue: 9000
       loadBalancingWeight: 1
+      locality: {}
   name: istio-se_infra_se-b_se-b.example.com_9000
   type: STATIC
 - connectTimeout: 5s
```

**File**: `pkg/kgateway/extensions2/plugins/waypoint/testdata/output/ns-use-waypoint.yaml` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ Clusters:
               address: 3.3.3.3
               portValue: 9000
       loadBalancingWeight: 1
+      locality: {}
   name: istio-se_infra_se-c_se-c.infra.svc.cluster.local_9000
   type: STATIC
 - commonLbConfig:
```

**File**: `pkg/kgateway/setup/testdata/experimental/cors-hr-and-tp-out.yaml` (modified, +2/-0)
```diff
@@ -39,6 +39,7 @@ endpoints:
             address: 10.244.1.12
             portValue: 8080
     loadBalancingWeight: 1
+    locality: {}
 - clusterName: kube_gwtest_reviews_8080
   endpoints:
   - lbEndpoints:
@@ -48,6 +49,7 @@ endpoints:
             address: 10.244.1.11
             portValue: 8080
     loadBalancingWeight: 1
+    locality: {}
 listeners:
 - address:
     socketAddress:
```

**File**: `pkg/kgateway/setup/testdata/experimental/cors-httproute-backend-out.yaml` (modified, +2/-0)
```diff
@@ -39,6 +39,7 @@ endpoints:
             address: 10.244.1.12
             portValue: 8080
     loadBalancingWeight: 1
+    locality: {}
 - clusterName: kube_gwtest_reviews_8080
   endpoints:
   - lbEndpoints:
@@ -48,6 +49,7 @@ endpoints:
             address: 10.244.1.11
             portValue: 8080
     loadBalancingWeight: 1
+    locality: {}
 listeners:
 - address:
     socketAddress:
```

---

### Incident Patch 3: `a0158fc2` (2026-10-05)
**Commit Message**:  Merge all security context fields and document list merge behavior (#14725)

Signed-off-by: Owm <[REDACTED_EMAIL]>

**File**: `pkg/deployer/merge.go` (modified, +34/-1)
```diff
@@ -69,6 +69,8 @@ func DeepMergeMaps[keyT comparable, valT any](dst, src map[keyT]valT) map[keyT]v
 	return dst
 }
 
+// DeepMergeSlices keeps dst for a nil src, clears it for an empty src, and otherwise appends src to dst.
+// Lists whose entries must be unique by key (e.g. sysctls) need a keyed merge instead.
 func DeepMergeSlices[T any](dst, src []T) []T {
 	// nil src override means just use dst
 	if src == nil {
@@ -167,10 +169,13 @@ func deepMergePodSecurityContext(dst, src *corev1.PodSecurityContext) *corev1.Po
 	dst.RunAsGroup = MergePointers(dst.RunAsGroup, src.RunAsGroup)
 	dst.RunAsNonRoot = MergePointers(dst.RunAsNonRoot, src.RunAsNonRoot)
 	dst.SupplementalGroups = DeepMergeSlices(dst.SupplementalGroups, src.SupplementalGroups)
+	dst.SupplementalGroupsPolicy = MergePointers(dst.SupplementalGroupsPolicy, src.SupplementalGroupsPolicy)
 	dst.FSGroup = MergePointers(dst.FSGroup, src.FSGroup)
-	dst.Sysctls = DeepMergeSlices(dst.Sysctls, src.Sysctls)
+	dst.Sysctls = deepMergeSysctls(dst.Sysctls, src.Sysctls)
 	dst.FSGroupChangePolicy = MergePointers(dst.FSGroupChangePolicy, src.FSGroupChangePolicy)
 	dst.SeccompProfile = deepMergeSeccompProfile(dst.SeccompProfile, src.SeccompProfile)
+	dst.AppArmorProfile = MergePointers(dst.AppArmorProfile, src.AppArmorProfile)
+	dst.SELinuxChangePolicy = MergePointers(dst.SELinuxChangePolicy, src.SELinuxChangePolicy)
 
 	return dst
 }
@@ -227,6 +232,33 @@ func deepMergeSeccompProfile(dst, src *corev1.SeccompProfile) *corev1.SeccompPro
 	return dst
 }
 
+// deepMergeSysctls merges by name so src values win, since Kubernetes rejects duplicate sysctl names.
+func deepMergeSysctls(dst, src []corev1.Sysctl) []corev1.Sysctl {
+	// nil src override means just use dst
+	if src == nil {
+		return dst
+	}
+
+	if dst == nil || len(src) == 0 {
+		return src
+	}
+
+	indexByName := make(map[string]int, len(dst))
+	for i, sysctl := range dst {
+		indexByName[sysctl.Name] = i
+	}
+	for _, sysctl := range src {
+		if i, ok := indexByName[sysctl.Name]; ok {
+			dst[i] = sysctl
+			continue
+		}
+		indexByName[sysctl.Name] = len(dst)
+		dst = append(dst, sysctl)
+	}
+
+	return dst
+}
+
 func DeepMergeAffinity(dst, src *corev1.Affinity) *corev1.Affinity {
 	// nil src override means just use dst
 	if src == nil {
@@ -748,6 +780,7 @@ func DeepMergeSecurityContext(dst, src *corev1.SecurityContext) *corev1.Security
 	dst.AllowPrivilegeEscalation = MergePointers(dst.AllowPrivilegeEscalation, src.AllowPrivilegeEscalation)
 	dst.ProcMount = MergePointers(dst.ProcMount, src.ProcMount)
 	dst.SeccompProfile = deepMergeSeccompProfile(dst.SeccompProfile, src.SeccompProfile)
+	dst.AppArmorProfile = MergePointers(dst.AppArmorProfile, src.AppArmorProfile)
 
 	return dst
 }
```

**File**: `pkg/deployer/merge_test.go` (modified, +265/-0)
```diff
@@ -1,6 +1,8 @@
 package deployer
 
 import (
+	"fmt"
+	"reflect"
 	"testing"
 
 	"github.com/stretchr/testify/assert"
@@ -675,3 +677,266 @@ func TestDeepMergeSecurityContextWindowsOptions(t *testing.T) {
 		})
 	}
 }
+
+func assertAllFieldsSet(t *testing.T, v any) {
+	t.Helper()
+	rv := reflect.ValueOf(v).Elem()
+	for i := range rv.NumField() {
+		assert.False(t, rv.Field(i).IsZero(), "fixture must populate %s.%s", rv.Type().Name(), rv.Type().Field(i).Name)
+	}
+}
+
+func TestDeepMergeSecurityContextAllFields(t *testing.T) {
+	dst := &corev1.SecurityContext{
+		Capabilities:             &corev1.Capabilities{Add: []corev1.Capability{"NET_BIND_SERVICE"}, Drop: []corev1.Capability{"KILL"}},
+		Privileged:               new(true),
+		SELinuxOptions:           &corev1.SELinuxOptions{User: "system_u", Role: "system_r", Type: "container_t", Level: "s0"},
+		WindowsOptions:           &corev1.WindowsSecurityContextOptions{RunAsUserName: new("default-user")},
+		RunAsUser:                new(int64(1000)),
+		RunAsGroup:               new(int64(1000)),
+		RunAsNonRoot:             new(false),
+		ReadOnlyRootFilesystem:   new(false),
+		AllowPrivilegeEscalation: new(true),
+		ProcMount:                new(corev1.DefaultProcMount),
+		SeccompProfile:           &corev1.SeccompProfile{Type: corev1.SeccompProfileTypeUnconfined},
+		AppArmorProfile:          &corev1.AppArmorProfile{Type: corev1.AppArmorProfileTypeRuntimeDefault},
+	}
+	src := &corev1.SecurityContext{
+		Capabilities:             &corev1.Capabilities{Add: []corev1.Capability{"NET_ADMIN"}, Drop: []corev1.Capability{"ALL"}},
+		Privileged:               new(false),
+		SELinuxOptions:           &corev1.SELinuxOptions{User: "user_u", Role: "user_r", Type: "spc_t", Level: "s0:c1"},
+		WindowsOptions:           &corev1.WindowsSecurityContextOptions{RunAsUserName: new("override-user")},
+		RunAsUser:                new(int64(1001)),
+		RunAsGroup:               new(int64(1002)),
+		RunAsNonRoot:             new(true),
+		ReadOnlyRootFilesystem:   new(true),
+		AllowPrivilegeEscalation: new(false),
+		ProcMount:                new(corev1.UnmaskedProcMount),
+		SeccompProfile:           &corev1.SeccompProfile{Type: corev1.SeccompProfileTypeLocalhost, LocalhostProfile: new("seccomp.json")},
+		AppArmorProfile:          &corev1.AppArmorProfile{Type: corev1.AppArmorProfileTypeLocalhost, LocalhostProfile: new("k8s-apparmor")},
+	}
+	assertAllFieldsSet(t, dst)
+	assertAllFieldsSet(t, src)
+
+	t.Run("src fields are copied into empty dst", func(t *testing.T) {
+		got := DeepMergeSecurityContext(&corev1.SecurityContext{}, src.DeepCopy())
+		assert.Equal(t, src, got)
+	})
+
+	t.Run("dst fields are kept when src is empty", func(t *testing.T) {
+		got := DeepMergeSecurityContext(dst.DeepCopy(), &corev1.SecurityContext{})
+		assert.Equal(t, dst, got)
+	})
+
+	t.Run("src fields override populated dst and lists are appended", func(t *testing.T) {
+		want := src.DeepCopy()
+		want.Capabilities.Add = []corev1.Capability{"NET_BIND_SERVICE", "NET_ADMIN"}
+		want.Capabilities.Drop = []corev1.Capability{"KILL", "ALL"}
+
+		got := DeepMergeSecurityContext(dst.DeepCopy(), src.DeepCopy())
+		assert.Equal(t, want, got)
+	})
+}
+
+func TestDeepMergePodSecurityContextAllFields(t *testing.T) {
+	dst := &corev1.PodSecurityContext{
+		SELinuxOptions:           &corev1.SELinuxOptions{User: "system_u", Role: "system_r", Type: "container_t", Level: "s0"},
+		WindowsOptions:           &corev1.WindowsSecurityContextOptions{RunAsUserName: new("default-user")},
+		RunAsUser:                new(int64(1000)),
+		RunAsGroup:               new(int64(1000)),
+		RunAsNonRoot:             new(false),
+		SupplementalGroups:       []int64{2000},
+		SupplementalGroupsPolicy: new(corev1.SupplementalGroupsPolicyMerge),
+		FSGroup:                  new(int64(1000)),
+		Sysctls:                  []corev1.Sysctl{{Name: "net.core.somaxconn", Value: "1024"}},
+		FSGroupChangePolicy:      new(corev1.FSGroupChangeAlways),
+		SeccompProfile:           &corev1.SeccompProfile{Type: corev1.SeccompProfileTypeUnconfined},
+		AppArmorProfile:          &corev1.AppArmorProfile{Type: corev1.AppArmorProfileTypeRuntimeDefault},
+		SELinuxChangePolicy:      new(corev1.SELinuxChangePolicyMountOption),
+	}
+	src := &corev1.PodSecurityContext{
+		SELinuxOptions:           &corev1.SELinuxOptions{User: "user_u", Role: "user_r", Type: "spc_t", Level: "s0:c1"},
+		WindowsOptions:           &corev1.WindowsSecurityContextOptions{RunAsUserName: new("override-user")},
+		RunAsUser:                new(int64(1001)),
+		RunAsGroup:               new(int64(1002)),
+		RunAsNonRoot:             new(true),
+		SupplementalGroups:       []int64{3000},
+		SupplementalGroupsPolicy: new(corev1.SupplementalGroupsPolicyStrict),
+		FSGroup:                  new(int64(1003)),
+		Sysctls:                  []corev1.Sysctl{{Name: "net.ipv4.ip_unprivileged_port_start", Value: "0"}},
+		FSGroupChangePolicy:      new(corev1.FSGroupChangeOnRootMismatch),
+		SeccompP
```

---

### Incident Patch 4: `1e934a47` (2026-10-05)
**Commit Message**: test: rebuild dummy-idp image when its sources change (#14770)

Signed-off-by: David L. Chandler <[REDACTED_EMAIL]>

**File**: `Makefile` (modified, +4/-4)
```diff
@@ -127,9 +127,6 @@ BUG_REPORT_DIR := $(TEST_ASSET_DIR)/bug_report
 $(BUG_REPORT_DIR):
 	mkdir -p $(BUG_REPORT_DIR)
 
-# Static base image for dummy-idp, which is built with CGO_ENABLED=0.
-export DUMMY_IDP_BASE_IMAGE ?= cgr.dev/chainguard/static:latest
-
 # Distroless glibc base used for the kgateway controller, SDS, and envoy-wrapper containers. Exported for use in goreleaser.yaml.
 # Tracked as :latest (unpinned) on purpose: this distroless image has no package manager, so the only way
 # to receive Chainguard's CVE fixes is to pull a newer build. A pinned digest would freeze CVEs in place and
@@ -912,6 +909,10 @@ DUMMY_IDP_DIR=hack/dummy-idp
 DUMMY_IDP_OUTPUT_DIR=$(OUTPUT_DIR)/$(DUMMY_IDP_DIR)
 export DUMMY_IDP_IMAGE_REPO ?= dummy-idp
 DUMMY_IDP_VERSION=0.0.1
+# dummy-idp.go embeds the cert and key, so they are sources too. The directory
+# itself is listed so that adding or deleting a file, which $(wildcard) alone
+# cannot see, also triggers a rebuild.
+DUMMY_IDP_SOURCES=$(DUMMY_IDP_DIR) $(wildcard $(DUMMY_IDP_DIR)/*.go $(DUMMY_IDP_DIR)/*.cert $(DUMMY_IDP_DIR)/*.key) go.mod go.sum
 
 $(DUMMY_IDP_OUTPUT_DIR)/dummy-idp-linux-$(GOARCH): $(DUMMY_IDP_SOURCES)
 	$(GO_BUILD_FLAGS) GOOS=linux go build -ldflags='$(LDFLAGS)' -gcflags='$(GCFLAGS)' -o $@ ./hack/dummy-idp...
@@ -925,7 +926,6 @@ $(DUMMY_IDP_OUTPUT_DIR)/Dockerfile.dummy-idp: ./hack/dummy-idp/Dockerfile
 $(DUMMY_IDP_OUTPUT_DIR)/.docker-stamp-$(DUMMY_IDP_VERSION)-$(GOARCH): $(DUMMY_IDP_OUTPUT_DIR)/dummy-idp-linux-$(GOARCH) $(DUMMY_IDP_OUTPUT_DIR)/Dockerfile.dummy-idp
 	$(BUILDX_BUILD) --load $(PLATFORM) $(DUMMY_IDP_OUTPUT_DIR) -f $(DUMMY_IDP_OUTPUT_DIR)/Dockerfile.dummy-idp \
 		--build-arg GOARCH=$(GOARCH) \
-		--build-arg BASE_IMAGE=$(DUMMY_IDP_BASE_IMAGE) \
 		-t $(IMAGE_REGISTRY)/$(DUMMY_IDP_IMAGE_REPO):$(DUMMY_IDP_VERSION)
 	@touch $@
 
```

**File**: `hack/dummy-idp/Dockerfile` (modified, +1/-3)
```diff
@@ -1,6 +1,4 @@
-ARG BASE_IMAGE
-
-FROM $BASE_IMAGE
+FROM cgr.dev/chainguard/static:latest
 
 ARG GOARCH=amd64
 
```

---

### Incident Patch 5: `f7c2e6e4` (2026-09-24)
**Commit Message**: fix(backend): rewrite Host to the Lambda endpoint before SigV4 signing (#14712)

Signed-off-by: Rishabh <[REDACTED_EMAIL]>
Signed-off-by: omar <[REDACTED_EMAIL]>
Co-authored-by: omar <[REDACTED_EMAIL]>

**File**: `pkg/kgateway/extensions2/plugins/backend/aws.go` (modified, +17/-0)
```diff
@@ -5,6 +5,7 @@ import (
 	"fmt"
 	"net/url"
 	"strconv"
+	"strings"
 	"unicode/utf8"
 
 	envoyclusterv3 "github.com/envoyproxy/go-control-plane/envoy/config/cluster/v3"
@@ -241,6 +242,7 @@ func (u *lambdaFilters) Equals(other *lambdaFilters) bool {
 func buildLambdaFilters(
 	arn string,
 	region string,
+	hostRewrite string,
 	auth *kgateway.AwsAuth,
 	secret *ir.Secret,
 	invokeMode envoy_lambda_v3.Config_InvocationMode,
@@ -254,10 +256,12 @@ func buildLambdaFilters(
 		payloadPassthrough = false
 	}
 
+	// Use the Lambda endpoint authority instead of the client authority or a route-level rewrite.
 	lambdaConfigAny, err := utils.MessageToAny(&envoy_lambda_v3.Config{
 		Arn:                arn,
 		InvocationMode:     invokeMode,
 		PayloadPassthrough: payloadPassthrough,
+		HostRewrite:        hostRewrite,
 	})
 	if err != nil {
 		return nil, fmt.Errorf("failed to create lambda config: %w", err)
@@ -334,6 +338,19 @@ type lambdaEndpointConfig struct {
 	useTLS   bool
 }
 
+// authority returns the HTTP authority, omitting only the scheme's default port.
+func (u *lambdaEndpointConfig) authority() string {
+	host := u.hostname
+	if strings.Contains(host, ":") {
+		// url.Hostname() strips the brackets an IPv6 authority needs.
+		host = "[" + host + "]"
+	}
+	if (u.useTLS && u.port == 443) || (!u.useTLS && u.port == 80) {
+		return host
+	}
+	return host + ":" + strconv.FormatUint(uint64(u.port), 10)
+}
+
 // Equals checks if two lambdaEndpointConfig objects are equal.
 func (u *lambdaEndpointConfig) Equals(other *lambdaEndpointConfig) bool {
 	return u.hostname == other.hostname && u.port == other.port && u.useTLS == other.useTLS
```

**File**: `pkg/kgateway/extensions2/plugins/backend/aws_test.go` (modified, +47/-9)
```diff
@@ -6,6 +6,7 @@ import (
 
 	envoyclusterv3 "github.com/envoyproxy/go-control-plane/envoy/config/cluster/v3"
 	envoydnsv3 "github.com/envoyproxy/go-control-plane/envoy/extensions/clusters/dns/v3"
+	envoy_lambda_v3 "github.com/envoyproxy/go-control-plane/envoy/extensions/filters/http/aws_lambda/v3"
 	"github.com/stretchr/testify/assert"
 	"github.com/stretchr/testify/require"
 	"google.golang.org/protobuf/proto"
@@ -127,15 +128,15 @@ func TestBuildLambdaARNFallsBackToDeprecatedBackendAccountID(t *testing.T) {
 func TestBuildTranslateFuncFailsClosedForLambdaEndpointWithoutPort(t *testing.T) {
 	translate := buildTranslateFunc(nil, nil, true)
 
-	backendIR := translate(krt.TestingDummyContext{}, newLambdaBackend("lambda-backend", "https://lambda.us-east-1.amazonaws.com"))
+	backendIR := translate(krt.TestingDummyContext{}, newLambdaBackend("us-east-1", "https://lambda.us-east-1.amazonaws.com"))
 
 	require.NotEmpty(t, backendIR.errors)
 	assert.ErrorContains(t, backendIR.errors[0], "failed to parse port")
 	assert.Nil(t, backendIR.awsIr, "translate() should not build AWS IR for an invalid lambda endpoint")
 }
 
 func TestBackendIrEqualsDetectsLambdaErrorOnlyChanges(t *testing.T) {
-	backend := newLambdaBackend("example-aws-backend", "https://lambda.us-east-1.amazonaws.com:443")
+	backend := newLambdaBackend("us-east-1", "https://lambda.us-east-1.amazonaws.com:443")
 	backend.ObjectMeta = metav1.ObjectMeta{
 		Name:      "example-aws-backend",
 		Namespace: "kgateway-base",
@@ -167,22 +168,59 @@ func TestBackendIrEqualsDetectsLambdaErrorOnlyChanges(t *testing.T) {
 	assert.False(t, invalidSecretIR.Equals(missingSecretIR), "backend IR equality should remain symmetric")
 }
 
-func newLambdaBackend(name, endpointURL string) *kgateway.Backend {
+// newLambdaBackend builds a Lambda Backend in the given region. An empty
+// endpointURL leaves the default AWS endpoint in place.
+func newLambdaBackend(region, endpointURL string) *kgateway.Backend {
+	lambda := &kgateway.AwsLambda{
+		FunctionName: "hello-function",
+		Qualifier:    "live",
+	}
+	if endpointURL != "" {
+		lambda.EndpointURL = &endpointURL
+	}
 	return &kgateway.Backend{
 		Spec: kgateway.BackendSpec{
 			Aws: &kgateway.AwsBackend{
-				Region:    "us-east-1",
+				Region:    region,
 				AccountId: "111111111111",
-				Lambda: &kgateway.AwsLambda{
-					FunctionName: "hello-function",
-					Qualifier:    "live",
-					EndpointURL:  &endpointURL,
-				},
+				Lambda:    lambda,
 			},
 		},
 	}
 }
 
+func TestLambdaFiltersRewriteHostToTheLambdaEndpoint(t *testing.T) {
+	tests := []struct {
+		name     string
+		endpoint string
+		want     string
+	}{
+		{name: "default endpoint", want: "lambda.us-east-2.amazonaws.com"},
+		{name: "custom HTTP port", endpoint: "http://localstack:4566", want: "localstack:4566"},
+		{name: "custom HTTPS port", endpoint: "https://localstack:4566", want: "localstack:4566"},
+		{name: "default HTTP port", endpoint: "http://localstack:80", want: "localstack"},
+		{name: "default HTTPS port", endpoint: "https://localstack:443", want: "localstack"},
+		{name: "HTTP on port 443", endpoint: "http://localstack:443", want: "localstack:443"},
+		{name: "HTTPS on port 80", endpoint: "https://localstack:80", want: "localstack:80"},
+		{name: "IPv6 custom port", endpoint: "http://[::1]:4566", want: "[::1]:4566"},
+		{name: "IPv6 default port", endpoint: "http://[::1]:80", want: "[::1]"},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			backend := newLambdaBackend("us-east-2", tt.endpoint)
+			backendIR := buildTranslateFunc(nil, nil, true)(krt.TestingDummyContext{}, backend)
+			require.Empty(t, backendIR.errors)
+			require.NotNil(t, backendIR.awsIr)
+
+			var lambdaConfig envoy_lambda_v3.Config
+			err := anypb.UnmarshalTo(backendIR.awsIr.lambdaIr.lambdaFilters.lambdaConfigAny, &lambdaConfig, proto.UnmarshalOptions{})
+			require.NoError(t, err)
+			assert.Equal(t, tt.want, lambdaConfig.GetHostRewrite())
+		})
+	}
+}
+
 // TestDeriveStaticSecret pins the input validation that keeps a malformed
 // Secret from producing an InlineCredentialProvider Envoy rejects (its
 // access_key_id and secret_access_key carry min_len: 1). See issue #14736.
```

**File**: `pkg/kgateway/extensions2/plugins/backend/plugin.go` (modified, +1/-1)
```diff
@@ -235,7 +235,7 @@ func buildTranslateFunc(
 				}
 
 				lambdaFilters, err := buildLambdaFilters(
-					lambdaArn, region, i.Spec.Aws.Auth, secret, invokeMode, i.Spec.Aws.Lambda.PayloadTransformMode)
+					lambdaArn, region, endpointConfig.authority(), i.Spec.Aws.Auth, secret, invokeMode, i.Spec.Aws.Lambda.PayloadTransformMode)
 				if err != nil {
 					beIr.errors = append(beIr.errors, err)
 					break
```

**File**: `pkg/kgateway/setup/testdata/standard/lambda-custom-endpoint-out.yaml` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ clusters:
         typedConfig:
           '@type': type.googleapis.com/envoy.extensions.filters.http.aws_lambda.v3.Config
           arn: arn:aws:lambda:us-east-1:000000000000:function:my-test-function:$LATEST
+          hostRewrite: 172.18.0.2:4566
       - name: envoy.filters.http.aws_request_signing
         typedConfig:
           '@type': type.googleapis.com/envoy.extensions.filters.http.aws_request_signing.v3.AwsRequestSigning
```

**File**: `pkg/kgateway/setup/testdata/standard/lambda-defaults-out.yaml` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@ clusters:
         typedConfig:
           '@type': type.googleapis.com/envoy.extensions.filters.http.aws_lambda.v3.Config
           arn: arn:aws:lambda:us-east-1:000000000000:function:my-lambda-function:$LATEST
+          hostRewrite: lambda.us-east-1.amazonaws.com
       - name: envoy.filters.http.aws_request_signing
         typedConfig:
           '@type': type.googleapis.com/envoy.extensions.filters.http.aws_request_signing.v3.AwsRequestSigning
```

**File**: `pkg/kgateway/setup/testdata/standard/lambda-https-custom-endpoint-out.yaml` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@ clusters:
         typedConfig:
           '@type': type.googleapis.com/envoy.extensions.filters.http.aws_lambda.v3.Config
           arn: arn:aws:lambda:us-east-1:000000000000:function:my-test-function:$LATEST
+          hostRewrite: 172.18.0.2:4566
       - name: envoy.filters.http.aws_request_signing
         typedConfig:
           '@type': type.googleapis.com/envoy.extensions.filters.http.aws_request_signing.v3.AwsRequestSigning
```

**File**: `pkg/kgateway/setup/testdata/standard/lambda-invalid-secret-refs-out.yaml` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ clusters:
         typedConfig:
           '@type': type.googleapis.com/envoy.extensions.filters.http.aws_lambda.v3.Config
           arn: arn:aws:lambda:us-east-1:000000000000:function:my-test-function:$LATEST
+          hostRewrite: 172.18.0.2:4566
       - name: envoy.filters.http.aws_request_signing
         typedConfig:
           '@type': type.googleapis.com/envoy.extensions.filters.http.aws_request_signing.v3.AwsRequestSigning
```

**File**: `pkg/kgateway/setup/testdata/standard/lambda-invocation-mode-out.yaml` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@ clusters:
         typedConfig:
           '@type': type.googleapis.com/envoy.extensions.filters.http.aws_lambda.v3.Config
           arn: arn:aws:lambda:us-east-1:000000000000:function:my-test-function:$LATEST
+          hostRewrite: lambda.us-east-1.amazonaws.com
           invocationMode: ASYNCHRONOUS
       - name: envoy.filters.http.aws_request_signing
         typedConfig:
```

---

### Incident Patch 6: `ca82f136` (2026-09-24)
**Commit Message**: Fix false convergence timeouts in xDS fleet reconnect tests (#14751)

Signed-off-by: David L. Chandler <[REDACTED_EMAIL]>

**File**: `test/e2e/features/loadtesting/types_test.go` (modified, +42/-2)
```diff
@@ -137,7 +137,7 @@ func TestBenchConvergenceRequiresQuietWindow(t *testing.T) {
 	defer server.Close()
 	fleet := &XdsFleetSuite{metricsURL: server.URL}
 	fleet.SetT(t)
-	_, ok := fleet.waitConverged(0)
+	_, ok := fleet.waitConverged(0, true)
 	assert.False(t, ok, "a transform without a full quiet window must time out")
 	cost := &XdsCostSuite{metricsURL: server.URL}
 	cost.SetT(t)
@@ -279,7 +279,7 @@ func TestFleetCrashEmitsVerdictWithUnavailableMetrics(t *testing.T) {
 	fleet.SetT(t)
 	fleet.TestXdsFleet()
 	assert.False(t, fleet.waitServed(nil, time.Second), "a restart must prevent readiness even if all streams are ready")
-	_, converged := fleet.waitConverged(0)
+	_, converged := fleet.waitConverged(0, true)
 	assert.False(t, converged, "a restart must stop convergence polling")
 	data, err := os.ReadFile(outputPath)
 	require.NoError(t, err)
@@ -420,3 +420,43 @@ func TestFleetPumpPreservesEndpointSubscriptionOnACK(t *testing.T) {
 	assert.Equal(t, "rds-nonce", stream.sent[3].ResponseNonce)
 	assert.EqualValues(t, 3, c.acks.Load())
 }
+
+func TestFleetConvergence(t *testing.T) {
+	oldSettle, oldTimeout := fleetSettleMillis, fleetIterTimeout
+	fleetSettleMillis, fleetIterTimeout = 100, 2*time.Second
+	testutils.Cleanup(t, func() {
+		fleetSettleMillis, fleetIterTimeout = oldSettle, oldTimeout
+	})
+
+	for _, tc := range []struct {
+		name             string
+		requireTransform bool
+		values           []int // A negative value represents an unavailable metrics endpoint.
+		want             bool
+	}{
+		{name: "cached reconnect", values: []int{10}, want: true},
+		{name: "churn requires a transform", requireTransform: true, values: []int{10}},
+		{name: "churn transforms", requireTransform: true, values: []int{11}, want: true},
+		{name: "scrape failure after transform", requireTransform: true, values: []int{11, -1, 11}, want: true},
+		{name: "unavailable metrics", values: []int{-1}},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			calls := 0
+			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
+				value := tc.values[min(calls, len(tc.values)-1)]
+				calls++
+				if value < 0 {
+					w.WriteHeader(http.StatusServiceUnavailable)
+					return
+				}
+				fmt.Fprintf(w, "# TYPE kgateway_xds_snapshot_transforms_total counter\nkgateway_xds_snapshot_transforms_total %d\n", value)
+			}))
+			defer server.Close()
+			s := &XdsFleetSuite{metricsURL: server.URL}
+			_, got := s.waitConverged(10, tc.requireTransform)
+			if got != tc.want {
+				t.Fatalf("converged = %v, want %v", got, tc.want)
+			}
+		})
+	}
+}
```

**File**: `test/e2e/features/loadtesting/xdsfleet_suite.go` (modified, +15/-6)
```diff
@@ -522,9 +522,11 @@ func (s *XdsFleetSuite) TestXdsFleet() {
 		s.survivedGateways = connected
 	}
 
-	s.runFleetPhase("EdsChurn", func(i int) { s.churnEndpointSlice(i) })
-	s.runFleetPhase("BaseChurn", func(i int) { s.churnInlineBackend(i) })
-	s.runFleetPhase("StreamReconnect", func(i int) { s.reconnectOneGateway(i) })
+	s.runFleetPhase("EdsChurn", func(i int) { s.churnEndpointSlice(i) }, true)
+	s.runFleetPhase("BaseChurn", func(i int) { s.churnInlineBackend(i) }, true)
+	// Reopened streams must be served (checked by reconnectOneGateway), but
+	// serving a cached snapshot does not require a new transform.
+	s.runFleetPhase("StreamReconnect", func(i int) { s.reconnectOneGateway(i) }, false)
 }
 
 // clientsPerGateway is how many unique clients one Gateway's replicas produce.
@@ -540,7 +542,7 @@ func (s *XdsFleetSuite) clientsPerGateway() int {
 	return 1
 }
 
-func (s *XdsFleetSuite) runFleetPhase(name string, mutate func(int)) {
+func (s *XdsFleetSuite) runFleetPhase(name string, mutate func(int), requireTransform bool) {
 	s.T().Logf("=== fleet phase %s at %d clients", name, fleetGateways*s.clientsPerGateway())
 	s.Require().True(s.waitQuiet(time.Duration(fleetSettleMillis)*time.Millisecond, fleetWaveTimeout),
 		"controller must go quiet before phase %s", name)
@@ -553,7 +555,7 @@ func (s *XdsFleetSuite) runFleetPhase(name string, mutate func(int)) {
 		t0 := time.Now()
 		tBefore := s.scrape().Transforms
 		mutate(i)
-		last, ok := s.waitConverged(tBefore)
+		last, ok := s.waitConverged(tBefore, requireTransform)
 		if !ok {
 			timedOut++
 			s.T().Logf("phase %s iteration %d did not converge in %s", name, i, fleetIterTimeout)
@@ -1361,10 +1363,11 @@ func (s *XdsFleetSuite) controllerRestarts() int32 {
 	return total
 }
 
-func (s *XdsFleetSuite) waitConverged(before float64) (time.Time, bool) {
+func (s *XdsFleetSuite) waitConverged(before float64, requireTransform bool) (time.Time, bool) {
 	settle := time.Duration(fleetSettleMillis) * time.Millisecond
 	deadline := time.Now().Add(fleetIterTimeout)
 	last := time.Time{}
+	transformed := false
 	seen := before
 	for time.Now().Before(deadline) {
 		time.Sleep(250 * time.Millisecond)
@@ -1379,9 +1382,15 @@ func (s *XdsFleetSuite) waitConverged(before float64) (time.Time, bool) {
 		cur := sample.Transforms
 		if cur > seen {
 			seen = cur
+			transformed = true
 			last = time.Now()
 			continue
 		}
+		// Start (or restart after a failed scrape) the quiet window only once
+		// the phase's progress requirement has been met.
+		if last.IsZero() && (!requireTransform || transformed) {
+			last = time.Now()
+		}
 		if !last.IsZero() && time.Since(last) >= settle {
 			return last, true
 		}
```

---

### Incident Patch 7: `53b29e26` (2026-09-24)
**Commit Message**: make the ReferenceGrant source identity configurable and stop leaking selector matches (#14643)

Signed-off-by: omar <[REDACTED_EMAIL]>

**File**: `devel/reference_grant/reference-grant-mode.md` (modified, +4/-3)
```diff
@@ -161,7 +161,8 @@ mode is `Strict` and the target namespace differs from the source namespace:
 FetchGatewayExtension()                pkg/.../trafficpolicy/constructor.go
   if mode == Strict:
     RefGrants.ReferenceAllowed(
-      from: TrafficPolicy GK, fromNs,
+      from: TrafficPolicy GK (or the kind set via
+            WithSourceGroupKind), fromNs,
       to:   GatewayExtension GK, targetNs, name
     )
     -> ErrMissingReferenceGrant if denied
@@ -181,8 +182,8 @@ invalidation is needed.
 | `api/settings/settings.go` | `ReferenceGrantMode` type and `Settings.ReferenceGrantMode` field |
 | `pkg/krtcollections/policy.go` | `RefGrantIndex`, `NewRefGrantIndex`, `ReferenceAllowed` |
 | `pkg/pluginsdk/collections/collections.go` | Wires mode from settings into `NewRefGrantIndex` |
-| `pkg/kgateway/extensions2/plugins/trafficpolicy/constructor.go` | `FetchGatewayExtension` — Strict-mode ExtensionRef check |
-| `pkg/krtcollections/secrets.go` | SecretRef enforcement via `GetSecret` -> `ReferenceAllowed` |
+| `pkg/kgateway/extensions2/plugins/trafficpolicy/constructor.go` | `FetchGatewayExtension` — Strict-mode ExtensionRef check; `WithSourceGroupKind` |
+| `pkg/krtcollections/secrets.go` | SecretRef enforcement via `GetSecret` -> `ReferenceAllowed`; `From` |
 
 ## Tests
 
```

**File**: `pkg/kgateway/extensions2/plugins/trafficpolicy/api_key_auth.go` (modified, +1/-6)
```diff
@@ -13,7 +13,6 @@ import (
 	"k8s.io/apimachinery/pkg/runtime/schema"
 
 	"github.com/kgateway-dev/kgateway/v2/api/v1alpha1/kgateway"
-	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
 	"github.com/kgateway-dev/kgateway/v2/pkg/krtcollections"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/collections"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
@@ -75,6 +74,7 @@ type parsedAPIKey struct {
 func constructAPIKeyAuth(
 	krtctx krt.HandlerContext,
 	policy *kgateway.TrafficPolicy,
+	from krtcollections.From,
 	commoncol *collections.CommonCollections,
 	out *trafficPolicySpecIr,
 ) error {
@@ -96,11 +96,6 @@ func constructAPIKeyAuth(
 	// Resolve secrets using SecretIndex with ReferenceGrant validation
 	var secrets []ir.Secret
 	secretGK := schema.GroupKind{Group: "", Kind: "Secret"}
-	policyGK := wellknown.TrafficPolicyGVK.GroupKind()
-	from := krtcollections.From{
-		GroupKind: policyGK,
-		Namespace: policy.Namespace,
-	}
 
 	if ak.SecretRef != nil {
 		secret, err := commoncol.Secrets.GetSecret(krtctx, from, *ak.SecretRef)
```

**File**: `pkg/kgateway/extensions2/plugins/trafficpolicy/basic_auth_policy.go` (modified, +4/-10)
```diff
@@ -14,7 +14,6 @@ import (
 	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
 
 	"github.com/kgateway-dev/kgateway/v2/api/v1alpha1/kgateway"
-	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
 	"github.com/kgateway-dev/kgateway/v2/pkg/krtcollections"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
 )
@@ -102,6 +101,7 @@ func (p *trafficPolicyPluginGwPass) handleBasicAuth(
 func constructBasicAuth(
 	krtctx krt.HandlerContext,
 	in *kgateway.TrafficPolicy,
+	from krtcollections.From,
 	out *trafficPolicySpecIr,
 	secrets *krtcollections.SecretIndex,
 ) error {
@@ -127,7 +127,7 @@ func constructBasicAuth(
 		htpasswdData = strings.Join(spec.Users, "\n")
 	} else if spec.SecretRef != nil {
 		// Fetch from secret
-		htpasswdData, err = fetchHtpasswdFromSecret(krtctx, secrets, spec.SecretRef, in.Namespace)
+		htpasswdData, err = fetchHtpasswdFromSecret(krtctx, secrets, spec.SecretRef, from)
 		if err != nil {
 			return fmt.Errorf("basic auth: %w", err)
 		}
@@ -176,10 +176,10 @@ func fetchHtpasswdFromSecret(
 	krtctx krt.HandlerContext,
 	secrets *krtcollections.SecretIndex,
 	secretRef *kgateway.SecretReference,
-	policyNamespace string,
+	from krtcollections.From,
 ) (string, error) {
 	// Determine namespace - use secret's namespace if specified, otherwise policy's namespace
-	namespace := gwv1.Namespace(policyNamespace)
+	namespace := gwv1.Namespace(from.Namespace)
 	if secretRef.Namespace != nil {
 		namespace = *secretRef.Namespace
 	}
@@ -196,12 +196,6 @@ func fetchHtpasswdFromSecret(
 		Namespace: &namespace,
 	}
 
-	// Use TrafficPolicy as the source for reference grants
-	from := krtcollections.From{
-		GroupKind: wellknown.TrafficPolicyGVK.GroupKind(),
-		Namespace: policyNamespace,
-	}
-
 	// Fetch the secret
 	secret, err := secrets.GetSecret(krtctx, from, secretObjRef)
 	if err != nil {
```

**File**: `pkg/kgateway/extensions2/plugins/trafficpolicy/constructor.go` (modified, +48/-14)
```diff
@@ -5,6 +5,7 @@ import (
 	"fmt"
 
 	"istio.io/istio/pkg/kube/krt"
+	"k8s.io/apimachinery/pkg/runtime/schema"
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/utils/ptr"
 	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
@@ -26,22 +27,57 @@ type TrafficPolicyConstructor struct {
 	commoncol         *collections.CommonCollections
 	gatewayExtensions krt.Collection[TrafficPolicyGatewayExtensionIR]
 	extBuilder        func(krtctx krt.HandlerContext, gExt ir.GatewayExtension) *TrafficPolicyGatewayExtensionIR
+
+	// sourceGroupKind is the identity a ReferenceGrant has to name to permit the
+	// cross-namespace references in TrafficPolicySpec. Empty means TrafficPolicy;
+	// see WithSourceGroupKind.
+	sourceGroupKind schema.GroupKind
+}
+
+// TrafficPolicyConstructorOption configures a TrafficPolicyConstructor.
+type TrafficPolicyConstructorOption func(*TrafficPolicyConstructor)
+
+// WithSourceGroupKind sets the identity that ReferenceGrants are evaluated against
+// for the cross-namespace references TrafficPolicySpec holds: API key and basic auth
+// secrets, secret-backed header values, and, in Strict mode, GatewayExtension
+// references.
+//
+// Defaults to gateway.kgateway.dev/TrafficPolicy
+func WithSourceGroupKind(gk schema.GroupKind) TrafficPolicyConstructorOption {
+	return func(c *TrafficPolicyConstructor) {
+		c.sourceGroupKind = gk
+	}
 }
 
 func NewTrafficPolicyConstructor(
 	ctx context.Context,
 	commoncol *collections.CommonCollections,
+	opts ...TrafficPolicyConstructorOption,
 ) *TrafficPolicyConstructor {
 	extBuilder := TranslateGatewayExtensionBuilder(ctx, commoncol)
 	defaultExtBuilder := func(krtctx krt.HandlerContext, gExt ir.GatewayExtension) *TrafficPolicyGatewayExtensionIR {
 		return extBuilder(krtctx, gExt)
 	}
 	gatewayExtensions := krt.NewCollection(commoncol.GatewayExtensions, defaultExtBuilder)
-	return &TrafficPolicyConstructor{
+	c := &TrafficPolicyConstructor{
 		commoncol:         commoncol,
 		gatewayExtensions: gatewayExtensions,
 		extBuilder:        extBuilder,
 	}
+	for _, opt := range opts {
+		opt(c)
+	}
+	return c
+}
+
+// refGrantSource returns the source identity that ReferenceGrants are evaluated
+// against for references held by a TrafficPolicySpec in ns.
+func (c *TrafficPolicyConstructor) refGrantSource(ns string) krtcollections.From {
+	gk := c.sourceGroupKind
+	if gk.Empty() {
+		gk = wellknown.TrafficPolicyGVK.GroupKind()
+	}
+	return krtcollections.From{GroupKind: gk, Namespace: ns}
 }
 
 func (c *TrafficPolicyConstructor) ConstructIR(
@@ -81,7 +117,7 @@ func (c *TrafficPolicyConstructor) ConstructIR(
 	constructCompression(policyCR.Spec, &outSpec)
 
 	// Construct header modifiers specific IR
-	if err := constructHeaderModifiers(krtctx, policyCR, c.commoncol.Secrets, &outSpec); err != nil {
+	if err := constructHeaderModifiers(krtctx, policyCR, c.refGrantSource(policyCR.Namespace), c.commoncol.Secrets, &outSpec); err != nil {
 		errors = append(errors, err)
 	}
 	// Construct request mirror specific IR
@@ -111,7 +147,7 @@ func (c *TrafficPolicyConstructor) ConstructIR(
 	}
 
 	// Construct API key auth specific IR
-	if err := constructAPIKeyAuth(krtctx, policyCR, c.commoncol, &outSpec); err != nil {
+	if err := constructAPIKeyAuth(krtctx, policyCR, c.refGrantSource(policyCR.Namespace), c.commoncol, &outSpec); err != nil {
 		errors = append(errors, err)
 	}
 
@@ -131,7 +167,7 @@ func (c *TrafficPolicyConstructor) ConstructIR(
 	// Construct stat prefix specific IR
 	constructStatPrefix(policyCR.Spec, &outSpec)
 	// Construct basic auth specific IR
-	if err := constructBasicAuth(krtctx, policyCR, &outSpec, c.commoncol.Secrets); err != nil {
+	if err := constructBasicAuth(krtctx, policyCR, c.refGrantSource(policyCR.Namespace), &outSpec, c.commoncol.Secrets); err != nil {
 		errors = append(errors, err)
 	}
 
@@ -151,16 +187,14 @@ func (c *TrafficPolicyConstructor) FetchGatewayExtension(krtctx krt.HandlerConte
 
 	// In Strict mode, cross-namespace ExtensionRef requires a ReferenceGrant.
 	if c.commoncol.Settings.ReferenceGrantMode == apisettings.ReferenceGrantStrict {
-		if !c.commoncol.RefGrants.ReferenceAllowed(krtctx,
-			wellknown.TrafficPolicyGVK.GroupKind(),
-			ns,
-			ir.ObjectSource{
-				Group:     wellknown.GatewayExtensionGVK.Group,
-				Kind:      wellknown.GatewayExtensionGVK.Kind,
-				Namespace: string(namespace),
-				Name:      string(extensionRef.Name),
-			},
-		) {
+		from := c.refGrantSource(ns)
+		to := ir.ObjectSource{
+			Group:     wellknown.GatewayExtensionGVK.Group,
+			Kind:      wellknown.GatewayExtensionGVK.Kind,
+			Namespace: string(namespace),
+			Name:      string(extensionRef.Name),
+		}
+		if !c.commoncol.RefGrants.ReferenceAllowed(krtctx, from.GroupKind, from.Namespace, to) {
 			return nil, krtcollections.ErrMissingReferenceGrant
 		}
 	}
```

**File**: `pkg/kgateway/extensions2/plugins/trafficpolicy/header_modifiers.go` (modified, +1/-5)
```diff
@@ -9,7 +9,6 @@ import (
 
 	"github.com/kgateway-dev/kgateway/v2/api/v1alpha1/kgateway"
 	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/extensions2/pluginutils"
-	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
 	"github.com/kgateway-dev/kgateway/v2/pkg/krtcollections"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
 )
@@ -49,6 +48,7 @@ func (hm *headerModifiersIR) Validate() error {
 func constructHeaderModifiers(
 	krtctx krt.HandlerContext,
 	policy *kgateway.TrafficPolicy,
+	from krtcollections.From,
 	secrets *krtcollections.SecretIndex,
 	out *trafficPolicySpecIr,
 ) error {
@@ -57,10 +57,6 @@ func constructHeaderModifiers(
 	}
 
 	spec := policy.Spec.HeaderModifiers
-	from := krtcollections.From{
-		GroupKind: wellknown.TrafficPolicyGVK.GroupKind(),
-		Namespace: policy.Namespace,
-	}
 
 	p := &header_mutationv3.HeaderMutationPerRoute{
 		Mutations: &header_mutationv3.Mutations{},
```

**File**: `pkg/kgateway/translator/gateway/testutils/outputs/traffic-policy/api-key-auth-selector-no-matching-secret.yaml` (modified, +4/-2)
```diff
@@ -107,7 +107,8 @@ Statuses:
       - conditions:
         - lastTransitionTime: null
           message: 'Replaced Rule (0): gateway.kgateway.dev/TrafficPolicy/default/api-key-auth-selector:
-            failed to get secrets by selector: missing reference grant'
+            no secrets found matching selector map[app:api-keys type:authentication]
+            in namespace default'
           reason: RouteRuleReplaced
           status: "False"
           type: kgateway.dev/Programmed
@@ -136,7 +137,8 @@ Statuses:
           namespace: default
         conditions:
         - lastTransitionTime: null
-          message: 'failed to get secrets by selector: missing reference grant'
+          message: no secrets found matching selector map[app:api-keys type:authentication]
+            in namespace default
           reason: Invalid
           status: "False"
           type: Accepted
```

**File**: `pkg/krtcollections/policy.go` (modified, +0/-2)
```diff
@@ -1076,8 +1076,6 @@ func (k refGrantIndexKey) String() string {
 	return fmt.Sprintf("%s/%s/%s/%s/%s/%s/%s", k.RefGrantNs, k.FromNs, k.ToGK.Group, k.ToGK.Kind, k.ToName, k.FromGK.Group, k.FromGK.Kind)
 }
 
-// MARK: RefGrantIndex
-
 type RefGrantIndex struct {
 	refgrants     krt.Collection[*gwv1b1.ReferenceGrant]
 	refGrantIndex krt.Index[refGrantIndexKey, *gwv1b1.ReferenceGrant]
```

**File**: `pkg/krtcollections/refgrant_source_test.go` (added, +237/-0)
```diff
@@ -0,0 +1,237 @@
+package krtcollections
+
+import (
+	"errors"
+	"slices"
+	"testing"
+
+	"istio.io/istio/pkg/kube/krt"
+	"istio.io/istio/pkg/kube/krt/krttest"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+	"k8s.io/utils/ptr"
+	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
+	gwv1b1 "sigs.k8s.io/gateway-api/apis/v1beta1"
+
+	apisettings "github.com/kgateway-dev/kgateway/v2/api/settings"
+	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
+)
+
+var (
+	// sourceGK is the identity the reference is resolved under, and otherGK a kind
+	// that is not it.
+	sourceGK = schema.GroupKind{Group: "gateway.kgateway.dev", Kind: "TrafficPolicy"}
+	otherGK  = schema.GroupKind{Group: "example.io", Kind: "OtherPolicy"}
+
+	secretGK = corev1.SchemeGroupVersion.WithKind("Secret").GroupKind()
+)
+
+// secretRefGrant builds a ReferenceGrant in ns permitting references to Secrets from
+// fromGK in fromNs.
+func secretRefGrant(ns string, fromGK schema.GroupKind, fromNs string) *gwv1b1.ReferenceGrant {
+	return &gwv1b1.ReferenceGrant{
+		ObjectMeta: metav1.ObjectMeta{Name: "grant", Namespace: ns},
+		Spec: gwv1b1.ReferenceGrantSpec{
+			From: []gwv1b1.ReferenceGrantFrom{{
+				Group:     gwv1.Group(fromGK.Group),
+				Kind:      gwv1.Kind(fromGK.Kind),
+				Namespace: gwv1.Namespace(fromNs),
+			}},
+			To: []gwv1b1.ReferenceGrantTo{{Group: "", Kind: "Secret"}},
+		},
+	}
+}
+
+func newTestSecretIndex(t *testing.T, objs ...any) *SecretIndex {
+	t.Helper()
+	return newTestSecretIndexWithMode(t, apisettings.ReferenceGrantPermissive, objs...)
+}
+
+func newTestSecretIndexWithMode(t *testing.T, mode apisettings.ReferenceGrantMode, objs ...any) *SecretIndex {
+	t.Helper()
+	mock := krttest.NewMock(t, objs)
+	secretCol := krttest.GetMockCollection[*corev1.Secret](mock)
+	refgrants := NewRefGrantIndex(krttest.GetMockCollection[*gwv1b1.ReferenceGrant](mock), mode)
+	secretsCol := map[schema.GroupKind]krt.Collection[ir.Secret]{
+		secretGK: krt.NewCollection(secretCol, func(kctx krt.HandlerContext, i *corev1.Secret) *ir.Secret {
+			return &ir.Secret{
+				ObjectSource: ir.ObjectSource{Kind: "Secret", Namespace: i.Namespace, Name: i.Name},
+				Obj:          i,
+				Data:         i.Data,
+			}
+		}),
+	}
+	idx := NewSecretIndex(secretsCol, refgrants)
+	secretCol.WaitUntilSynced(nil)
+	for !idx.HasSynced() {
+	}
+	return idx
+}
+
+func testSecret() *corev1.Secret {
+	return &corev1.Secret{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "api-keys",
+			Namespace: "secrets-ns",
+			Labels:    map[string]string{"app": "keys"},
+		},
+		Data: map[string][]byte{"user": []byte("k1")},
+	}
+}
+
+// TestSecretIndexReferenceGrantSourceIdentity pins that both secret paths permit a
+// reference only when a grant names the identity in From - a grant naming any other
+// kind stays inert, since from.kind is what scopes the permission.
+func TestSecretIndexReferenceGrantSourceIdentity(t *testing.T) {
+	tests := []struct {
+		name    string
+		grants  []any
+		allowed bool
+	}{
+		{
+			name:    "grant names the source identity",
+			grants:  []any{secretRefGrant("secrets-ns", sourceGK, "app-ns")},
+			allowed: true,
+		},
+		{
+			name:   "grant names another kind",
+			grants: []any{secretRefGrant("secrets-ns", otherGK, "app-ns")},
+		},
+		{
+			name: "no grant",
+		},
+		{
+			name:   "grant sits in the referrer namespace instead of the referent one",
+			grants: []any{secretRefGrant("app-ns", sourceGK, "app-ns")},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			idx := newTestSecretIndex(t, append([]any{testSecret()}, tt.grants...)...)
+			from := From{GroupKind: sourceGK, Namespace: "app-ns"}
+			krtctx := krt.TestingDummyContext{}
+
+			// secretRef, as spec.basicAuth.secretRef and spec.apiKeyAuth.secretRef resolve it.
+			ns := gwv1.Namespace("secrets-ns")
+			got, err := idx.GetSecret(krtctx, from, gwv1.SecretObjectReference{Name: "api-keys", Namespace: &ns})
+			switch {
+			case tt.allowed && err != nil:
+				t.Fatalf("GetSecret() = %v, want the reference to be permitted", err)
+			case tt.allowed && got.Name != "api-keys":
+				t.Errorf("GetSecret() returned secret %q, want %q", got.Name, "api-keys")
+			case !tt.allowed && !errors.Is(err, ErrMissingReferenceGrant):
+				t.Fatalf("GetSecret() = %v, want a missing reference grant error", err)
+			}
+
+			// secretSelector, as spec.apiKeyAuth.secretSelector resolves it.
+			secrets, err := idx.GetSecretsBySelector(krtctx, from, secretGK, map[string]string{"app": "keys"})
+			want := 0
+			if tt.allowed {
+				want = 1
+			}
+			if err != nil {
+				t.Fatalf("GetSecretsBySelector() = %v, want no error", err)
+			}
+			if len(secrets) != want {
+				t.Errorf("GetSecretsBySelector() returned %d secrets, want %d", len(secrets), want)
+			}
+		})
+	}
+}
+
+// TestSecretsBySelectorDeniedMatchReadsAsNoMatch pins that a selector whose only
+// match sits in a namespace with no grant gives t
```

---

### Incident Patch 8: `2d0490db` (2026-09-23)
**Commit Message**: fix(krtcollections): report the port when a backend ref misses on port only (#14706)

Signed-off-by: Bbn08 <[REDACTED_EMAIL]>
Signed-off-by: omar <[REDACTED_EMAIL]>
Co-authored-by: Bbn08 <[REDACTED_EMAIL]>

**File**: `pkg/kgateway/translator/gateway/gateway_translator_test.go` (modified, +13/-0)
```diff
@@ -297,6 +297,19 @@ func TestBasic(t *testing.T) {
 		})
 	})
 
+	t.Run("httproute with backend ref to an undefined port reports correctly", func(t *testing.T) {
+		test(t, translatorTestCase{
+			inputFiles: []string{"backends/backend-ref-port-not-found.yaml"},
+			outputFile: "backends/backend-ref-port-not-found.yaml",
+			gwNN: types.NamespacedName{
+				Namespace: "default",
+				Name:      "example-gateway",
+			},
+		}, func(s *apisettings.Settings) {
+			s.EnableIstioIntegration = true
+		})
+	})
+
 	t.Run("httproute with backend port error reports correctly", func(t *testing.T) {
 		test(t, translatorTestCase{
 			inputFiles: []string{"backends/backend-ref-port-error.yaml"},
```

**File**: `pkg/kgateway/translator/gateway/testutils/inputs/backends/backend-ref-port-not-found.yaml` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+apiVersion: gateway.networking.k8s.io/v1
+kind: Gateway
+metadata:
+  name: example-gateway
+spec:
+  gatewayClassName: example-gateway-class
+  listeners:
+  - name: http
+    protocol: HTTP
+    port: 80
+---
+# Service exists, but does not define port 8080.
+apiVersion: gateway.networking.k8s.io/v1
+kind: HTTPRoute
+metadata:
+  name: service-wrong-port
+spec:
+  parentRefs:
+  - name: example-gateway
+  hostnames:
+  - "svc.example.com"
+  rules:
+  - backendRefs:
+    - name: example-svc
+      port: 8080
+---
+# ServiceEntry exists, but does not define port 8080.
+apiVersion: gateway.networking.k8s.io/v1
+kind: HTTPRoute
+metadata:
+  name: serviceentry-wrong-port
+spec:
+  parentRefs:
+  - name: example-gateway
+  hostnames:
+  - "se.example.com"
+  rules:
+  - backendRefs:
+    - name: example-se
+      kind: ServiceEntry
+      group: networking.istio.io
+      port: 8080
+---
+# Hostname resolves through the ServiceEntry's alias, but port 8080 is not defined.
+apiVersion: gateway.networking.k8s.io/v1
+kind: HTTPRoute
+metadata:
+  name: hostname-wrong-port
+spec:
+  parentRefs:
+  - name: example-gateway
+  hostnames:
+  - "hostname.example.com"
+  rules:
+  - backendRefs:
+    - name: se.example.internal
+      kind: Hostname
+      group: networking.istio.io
+      port: 8080
+---
+apiVersion: v1
+kind: Service
+metadata:
+  name: example-svc
+spec:
+  selector:
+    app: example
+  ports:
+  - protocol: TCP
+    port: 80
+    targetPort: 8080
+---
+apiVersion: networking.istio.io/v1
+kind: ServiceEntry
+metadata:
+  name: example-se
+spec:
+  hosts:
+  - se.example.internal
+  ports:
+  - number: 80
+    name: http
+    protocol: HTTP
+  resolution: DNS
+  location: MESH_EXTERNAL
```

**File**: `pkg/kgateway/translator/gateway/testutils/outputs/backends/backend-ref-port-not-found.yaml` (added, +208/-0)
```diff
@@ -0,0 +1,208 @@
+Clusters:
+- clusterType:
+    name: envoy.clusters.dns
+    typedConfig:
+      '@type': type.googleapis.com/envoy.extensions.clusters.dns.v3.DnsCluster
+      dnsLookupFamily: V4_PREFERRED
+  connectTimeout: 5s
+  loadAssignment:
+    clusterName: istio-se_default_example-se_se.example.internal_80
+    endpoints:
+    - lbEndpoints:
+      - endpoint:
+          address:
+            socketAddress:
+              address: se.example.internal
+              portValue: 80
+      loadBalancingWeight: 1
+  name: istio-se_default_example-se_se.example.internal_80
+- commonLbConfig:
+    localityWeightedLbConfig: {}
+  connectTimeout: 5s
+  edsClusterConfig:
+    edsConfig:
+      ads: {}
+      resourceApiVersion: V3
+  ignoreHealthOnHostRemoval: true
+  name: kube_default_example-svc_80
+  type: EDS
+- connectTimeout: 5s
+  name: test-backend-plugin_default_example-svc_80
+Listeners:
+- address:
+    socketAddress:
+      address: '::'
+      ipv4Compat: true
+      portValue: 80
+  filterChains:
+  - filters:
+    - name: envoy.filters.network.http_connection_manager
+      typedConfig:
+        '@type': type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
+        httpFilters:
+        - name: envoy.filters.http.router
+          typedConfig:
+            '@type': type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
+        mergeSlashes: true
+        normalizePath: true
+        rds:
+          configSource:
+            ads: {}
+            resourceApiVersion: V3
+          routeConfigName: listener~80
+        statPrefix: http
+        useRemoteAddress: true
+    name: listener~80
+  name: listener~80
+Routes:
+- ignorePortInHostMatching: true
+  name: listener~80
+  virtualHosts:
+  - domains:
+    - hostname.example.com
+    name: listener~80~hostname_example_com
+    routes:
+    - match:
+        prefix: /
+      name: listener~80~hostname_example_com-route-0-httproute-hostname-wrong-port-default-0-0-matcher-0
+      route:
+        cluster: blackhole-cluster
+        clusterNotFoundResponseCode: INTERNAL_SERVER_ERROR
+  - domains:
+    - se.example.com
+    name: listener~80~se_example_com
+    routes:
+    - match:
+        prefix: /
+      name: listener~80~se_example_com-route-0-httproute-serviceentry-wrong-port-default-0-0-matcher-0
+      route:
+        cluster: blackhole-cluster
+        clusterNotFoundResponseCode: INTERNAL_SERVER_ERROR
+  - domains:
+    - svc.example.com
+    name: listener~80~svc_example_com
+    routes:
+    - match:
+        prefix: /
+      name: listener~80~svc_example_com-route-0-httproute-service-wrong-port-default-0-0-matcher-0
+      route:
+        cluster: blackhole-cluster
+        clusterNotFoundResponseCode: INTERNAL_SERVER_ERROR
+Statuses:
+  gateways:
+    default/example-gateway:
+      conditions:
+      - lastTransitionTime: null
+        message: Successfully accepted Gateway
+        reason: Accepted
+        status: "True"
+        type: Accepted
+      - lastTransitionTime: null
+        message: Successfully programmed Gateway
+        reason: Programmed
+        status: "True"
+        type: Programmed
+      - lastTransitionTime: null
+        message: Successfully resolved all Gateway references
+        reason: ResolvedRefs
+        status: "True"
+        type: ResolvedRefs
+      listeners:
+      - attachedRoutes: 3
+        conditions:
+        - lastTransitionTime: null
+          message: Successfully accepted Listener
+          reason: Accepted
+          status: "True"
+          type: Accepted
+        - lastTransitionTime: null
+          message: Successfully verified that Listener has no conflicts
+          reason: NoConflicts
+          status: "False"
+          type: Conflicted
+        - lastTransitionTime: null
+          message: Successfully resolved all references
+          reason: ResolvedRefs
+          status: "True"
+          type: ResolvedRefs
+        - lastTransitionTime: null
+          message: Successfully programmed Listener
+          reason: Programmed
+          status: "True"
+          type: Programmed
+        name: http
+        supportedKinds:
+        - group: gateway.networking.k8s.io
+          kind: HTTPRoute
+        - group: gateway.networking.k8s.io
+          kind: GRPCRoute
+  httpRoutes:
+    default/hostname-wrong-port:
+      parents:
+      - conditions:
+        - lastTransitionTime: null
+          message: Hostname /se.example.internal found, but port 8080 not defined
+          reason: BackendNotFound
+          status: "False"
+          type: ResolvedRefs
+        - lastTransitionTime: null
+          message: Successfully accepted Route
+          reason: Accepted
+          status: "True"
+          type: Accepted
+        - lastTransitionTime: null
+          message: Successfully programmed Route
+          reason: Programmed
+          status: "True"
+          type: kgateway.dev/Programmed
+      
```

**File**: `pkg/krtcollections/backend_port_test.go` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+package krtcollections
+
+import (
+	"testing"
+	"time"
+
+	"github.com/stretchr/testify/require"
+	"istio.io/istio/pkg/kube/krt"
+	"istio.io/istio/pkg/kube/krt/krttest"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
+	gwv1b1 "sigs.k8s.io/gateway-api/apis/v1beta1"
+
+	apisettings "github.com/kgateway-dev/kgateway/v2/api/settings"
+	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
+	sdk "github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk"
+	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
+	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/krtutil"
+)
+
+// serviceEntryLikeBackends mimics the ServiceEntry plugin: one backend per port,
+// keyed with the hostname as extraKey so it only resolves through the alias index.
+func serviceEntryLikeBackends(services krt.Collection[*corev1.Service]) krt.Collection[ir.BackendObjectIR] {
+	return krt.NewManyCollection(services, func(kctx krt.HandlerContext, svc *corev1.Service) []ir.BackendObjectIR {
+		objSrc := ir.ObjectSource{
+			Group:     wellknown.ServiceEntryGVK.Group,
+			Kind:      wellknown.ServiceEntryGVK.Kind,
+			Namespace: svc.Namespace,
+			Name:      svc.Name,
+		}
+		hostname := svc.Name + ".example.com"
+		out := make([]ir.BackendObjectIR, 0, len(svc.Spec.Ports))
+		for _, port := range svc.Spec.Ports {
+			backend := ir.NewBackendObjectIR(objSrc, port.Port, hostname, "")
+			backend.Obj = svc
+			backend.Aliases = []ir.ObjectSource{
+				objSrc,
+				{
+					Group:     wellknown.HostnameGVK.Group,
+					Kind:      wellknown.HostnameGVK.Kind,
+					Namespace: "",
+					Name:      hostname,
+				},
+			}
+			out = append(out, backend)
+		}
+		return out
+	})
+}
+
+// newPortTestBackendIndex serves default/foo:8080 as both a Service and a
+// ServiceEntry-like backend.
+func newPortTestBackendIndex(t *testing.T) *BackendIndex {
+	t.Helper()
+
+	svc := &corev1.Service{
+		ObjectMeta: metav1.ObjectMeta{Name: "foo", Namespace: "default"},
+		Spec: corev1.ServiceSpec{
+			Ports: []corev1.ServicePort{{Port: 8080}},
+		},
+	}
+
+	mock := krttest.NewMock(t, []any{svc})
+	services := krttest.GetMockCollection[*corev1.Service](mock)
+	policyCol := krttest.GetMockCollection[ir.PolicyWrapper](mock)
+	policies := NewPolicyIndex(krtutil.KrtOptions{}, sdk.ContributesPolicies{}, apisettings.Settings{})
+	refgrants := NewRefGrantIndex(krttest.GetMockCollection[*gwv1b1.ReferenceGrant](mock), apisettings.ReferenceGrantPermissive)
+
+	backends := NewBackendIndex(krtutil.KrtOptions{}, policies, refgrants)
+	backends.AddBackends(svcGk, k8sSvcUpstreams(services))
+	backends.AddBackends(
+		wellknown.ServiceEntryGVK.GroupKind(),
+		serviceEntryLikeBackends(services),
+		wellknown.HostnameGVK.GroupKind(),
+		wellknown.ServiceEntryGVK.GroupKind(),
+	)
+
+	services.WaitUntilSynced(nil)
+	policyCol.WaitUntilSynced(nil)
+	for !backends.HasSynced() {
+		time.Sleep(time.Second / 10)
+	}
+	return backends
+}
+
+func TestGetBackendFromRefPortErrors(t *testing.T) {
+	backends := newPortTestBackendIndex(t)
+	src := ir.ObjectSource{
+		Group:     gwv1.GroupVersion.Group,
+		Kind:      "HTTPRoute",
+		Namespace: "default",
+		Name:      "route",
+	}
+
+	group := func(g string) *gwv1.Group { gg := gwv1.Group(g); return &gg }
+	kind := func(k string) *gwv1.Kind { kk := gwv1.Kind(k); return &kk }
+	port := func(p int32) *gwv1.PortNumber { pp := gwv1.PortNumber(p); return &pp }
+
+	cases := []struct {
+		name    string
+		ref     gwv1.BackendObjectReference
+		wantErr string
+	}{
+		{
+			// direct krt-key lookup on a core Service
+			name:    "service wrong port",
+			ref:     gwv1.BackendObjectReference{Name: "foo", Port: port(9090)},
+			wantErr: "Service default/foo found, but port 9090 not defined",
+		},
+		{
+			name:    "service missing",
+			ref:     gwv1.BackendObjectReference{Name: "nope", Port: port(9090)},
+			wantErr: "Service default/nope not found",
+		},
+		{
+			// no port in the ref: must not report "port 0 not defined"
+			name:    "service no port",
+			ref:     gwv1.BackendObjectReference{Name: "nope"},
+			wantErr: "Service default/nope not found",
+		},
+		{
+			// resolved through the alias index, so the error must name ServiceEntry
+			name: "service entry wrong port",
+			ref: gwv1.BackendObjectReference{
+				Group: group(wellknown.ServiceEntryGVK.Group),
+				Kind:  kind(wellknown.ServiceEntryGVK.Kind),
+				Name:  "foo",
+				Port:  port(9090),
+			},
+			wantErr: "ServiceEntry default/foo found, but port 9090 not defined",
+		},
+		{
+			name: "service entry missing",
+			ref: gwv1.BackendObjectReference{
+				Group: group(wellknown.ServiceEntryGVK.Group),
+				Kind:  kind(wellknown.ServiceEntryGVK.Kind),
+				Name:  "nope",
+				Port:  port(9090),
+			},
+			wantErr: "ServiceEntry default/nope not found",
+		},
+		{
+			// aliased kind with no collection of its own
+			name: "hostname wrong port",
+			ref: gwv1.BackendObjectReference{
+				Group: group(w
```

**File**: `pkg/krtcollections/policy.go` (modified, +78/-14)
```diff
@@ -71,6 +71,19 @@ func (e *UnsupportedRouteKindError) Error() string {
 		e.Backend.Kind, e.Backend.Namespace, e.Backend.Name, e.RouteKind.Kind, strings.Join(supported, ", "))
 }
 
+// BackendPortNotFoundError is returned instead of NotFoundError when the referenced
+// backend exists but does not define the referenced port.
+type BackendPortNotFoundError struct {
+	// Named `PortNotFound` so it is easy to find in a krt dump, like NotFoundError.
+	PortNotFoundObj ir.ObjectSource
+	Port            int32
+}
+
+func (e *BackendPortNotFoundError) Error() string {
+	return e.PortNotFoundObj.Kind + " " + e.PortNotFoundObj.Namespace + "/" + e.PortNotFoundObj.Name +
+		" found, but port " + strconv.Itoa(int(e.Port)) + " not defined"
+}
+
 type BackendPortNotAllowedError struct {
 	BackendName string
 }
@@ -91,6 +104,9 @@ type BackendIndex struct {
 	availableBackendsWithPolicyByGK map[schema.GroupKind]krt.Collection[*ir.BackendObjectIR]
 	// aliasIndexWithPolicy indexes the policy-attached backends for a given GK by alias.
 	aliasIndexWithPolicy map[schema.GroupKind]krt.Index[backendKey, *ir.BackendObjectIR]
+	// nameIndexWithPolicy indexes the policy-attached backends for a given GK by object
+	// source and aliases, without port. Only consulted after a port-exact lookup misses.
+	nameIndexWithPolicy map[schema.GroupKind]krt.Index[ir.ObjectSource, *ir.BackendObjectIR]
 
 	// availableBackendsWithPolicy stores the policy-attached backend collections.
 	// BackendsWithPolicy is the public interface to access this.
@@ -127,6 +143,7 @@ func NewBackendIndex(
 		refgrants:                       refgrants,
 		availableBackendsWithPolicyByGK: map[schema.GroupKind]krt.Collection[*ir.BackendObjectIR]{},
 		aliasIndexWithPolicy:            map[schema.GroupKind]krt.Index[backendKey, *ir.BackendObjectIR]{},
+		nameIndexWithPolicy:             map[schema.GroupKind]krt.Index[ir.ObjectSource, *ir.BackendObjectIR]{},
 		gkAliases:                       map[schema.GroupKind][]schema.GroupKind{},
 		krtopts:                         krtopts,
 	}
@@ -249,8 +266,17 @@ func (i *BackendIndex) AddBackends(gk schema.GroupKind, col krt.Collection[ir.Ba
 		}
 		return aliasKeys
 	})
+	nameIdxWithPolicy := krtpkg.UnnamedIndex(backendsWithPoliciesCol, func(backendObj *ir.BackendObjectIR) []ir.ObjectSource {
+		if backendObj == nil {
+			return nil
+		}
+		keys := make([]ir.ObjectSource, 0, 1+len(backendObj.Aliases))
+		keys = append(keys, backendObj.GetObjectSource())
+		return append(keys, backendObj.Aliases...)
+	})
 	i.availableBackendsWithPolicyByGK[gk] = backendsWithPoliciesCol
 	i.aliasIndexWithPolicy[gk] = idxWithPolicy
+	i.nameIndexWithPolicy[gk] = nameIdxWithPolicy
 	i.availableBackendsWithPolicy = append(i.availableBackendsWithPolicy, backendsWithPoliciesCol)
 	i.backendsRequiringPolicyStatus = append(i.backendsRequiringPolicyStatus, backendsRequiringPolicyStatus)
 
@@ -310,25 +336,63 @@ func (i *BackendIndex) getBackend(kctx krt.HandlerContext, gk schema.GroupKind,
 	}
 
 	col := i.availableBackendsWithPolicyByGK[gk]
-	if col == nil {
-		return i.getBackendFromAlias(kctx, gk, n, port)
+	if col != nil {
+		if up := krt.FetchOne(kctx, col, krt.FilterKey(ir.BackendResourceName(key, port, ""))); up != nil {
+			return *up, nil
+		}
 	}
 
-	up := krt.FetchOne(kctx, col, krt.FilterKey(ir.BackendResourceName(key, port, "")))
-	if up == nil {
-		var (
-			err     error
-			aliasUp *ir.BackendObjectIR
-		)
-		if aliasUp, err = i.getBackendFromAlias(kctx, gk, n, port); err != nil {
-			// getBackendFromAlias returns ErrUnknownBackendKind when there are no aliases
-			// so return our own NotFoundError here
-			return nil, &NotFoundError{NotFoundObj: key}
-		}
+	aliasUp, err := i.getBackendFromAlias(kctx, gk, n, port)
+	if err == nil {
 		return aliasUp, nil
 	}
+	if col == nil && errors.Is(err, ErrUnknownBackendKind) {
+		// no collection and no aliases: nothing serves this kind at all
+		return nil, err
+	}
+	// getBackendFromAlias reports on the alias key, so build the error against the referenced key.
+	return nil, i.notFoundErr(kctx, gk, key, gwport)
+}
 
-	return *up, nil
+// notFoundErr distinguishes a missing backend from one that exists on a different port.
+func (i *BackendIndex) notFoundErr(kctx krt.HandlerContext, gk schema.GroupKind, key ir.ObjectSource, gwport *gwv1.PortNumber) error {
+	// Without a port the lookup used port 0, so a miss means the backend is missing.
+	if gwport != nil && i.hasBackendNamed(kctx, gk, key) {
+		return &BackendPortNotFoundError{PortNotFoundObj: key, Port: int32(*gwport)}
+	}
+	return &NotFoundError{NotFoundObj: key}
+}
+
+// hasBackendNamed reports whether any backend exists under key on any port, checking
+// the referenced kind first and then the kinds that alias it, like getBackend.
+func (i *BackendIndex) hasBackendNamed(kctx krt.HandlerContext, gk schema.GroupKind, key ir.ObjectSource) bool {
+	if i.fetchBackendsNamed(kctx, gk, key) {
+		return true
+	}
+	for _, actualGk := range i.gkAliases[
```

---

### Incident Patch 9: `3e0e6420` (2026-09-22)
**Commit Message**: proxy_syncer: intern equivalent per-client CLAs (#14604)

Signed-off-by: David L. Chandler <[REDACTED_EMAIL]>
Signed-off-by: omar <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>
Co-authored-by: omar <[REDACTED_EMAIL]>

**File**: `api/settings/settings.go` (modified, +11/-19)
```diff
@@ -282,28 +282,20 @@ type Settings struct {
 	// - "STRICT": Builds on STANDARD by running targeted validation
 	ValidationMode ValidationMode `split_words:"true" default:"STANDARD"`
 
-	// ValidatorMode selects how the strict validator executes a bootstrap it has
-	// not seen before. Has no effect when ValidationMode is "STANDARD". Supported
-	// values:
-	// - "BINARY": fork envoy --mode validate per bootstrap handed to the validator.
-	// - "CACHE": wrap BINARY with an LRU result cache keyed on bootstrap content
-	//   hash (default). A validation verdict is a pure function of the config
-	//   bytes, so memoization cannot change outcomes, only skip redundant envoy
-	//   invocations; transient failures are never cached.
+	// ValidatorMode selects how strict validation executes unseen bootstraps.
+	// Has no effect when ValidationMode is "STANDARD". Supported values:
+	// - "BINARY": run envoy --mode validate for each submitted bootstrap.
+	// - "CACHE": cache BINARY results in an LRU keyed by bootstrap content (default).
+	//   Transient failures are not cached.
 	//
-	// Independently of the mode, backend translation memoizes cluster verdicts by
-	// the cluster's own content before any bootstrap is built, so a cluster that is
-	// byte-identical to one already validated is not handed to the validator
-	// again in either mode. That memo is what keeps per-client strict validation
-	// affordable: every connected client's overlaid cluster is validated on every
-	// walk over the backends, and nearly all of them repeat. BINARY therefore
-	// means "fork envoy for every distinct cluster", not "for every call".
+	// In both modes, backend translation caches cluster verdicts by content before
+	// building a bootstrap. Identical clusters therefore reuse a verdict in BINARY
+	// mode too.
 	ValidatorMode ValidatorMode `split_words:"true" default:"CACHE"`
 
-	// ValidatorCacheSize is the LRU capacity of both the CACHE mode's bootstrap
-	// cache and the translator's per-cluster verdict memo, which is sized from it
-	// in every ValidatorMode. A value <= 0 (the default) selects the
-	// implementation default, validator.DefaultCacheSize.
+	// ValidatorCacheSize sets the LRU capacity of the CACHE mode's bootstrap cache
+	// and the translator's cluster verdict cache in every ValidatorMode.
+	// A value <= 0 selects validator.DefaultCacheSize.
 	ValidatorCacheSize int `split_words:"true"`
 
 	// EnableBuiltinDefaultMetrics enables the default builtin controller-runtime metrics and go runtime metrics.
```

**File**: `design/14184-shared-base-per-client-cluster-overlays.md` (modified, +85/-37)
```diff
@@ -1,7 +1,7 @@
 # EP-14184: Shared Base Clusters with Per-Client Overlays
 
 - Issue: [#14184](https://github.com/kgateway-dev/kgateway/issues/14184)
-- Originating PR: [#14343](https://github.com/kgateway-dev/kgateway/pull/14343) (superseded by the 7-PR stack in [Delivery](#delivery))
+- Originating PR: [#14343](https://github.com/kgateway-dev/kgateway/pull/14343) (superseded by the stack in [Delivery](#delivery))
 - Predecessors: [#14104](https://github.com/kgateway-dev/kgateway/pull/14104), [#14317](https://github.com/kgateway-dev/kgateway/pull/14317)
 - Related: [#13586](https://github.com/kgateway-dev/kgateway/issues/13586) (the *backends* axis of the same scaling problem)
 
@@ -216,9 +216,12 @@ leave clients pinned to a stale `LoadAssignment` forever. It mirrors what
 so EDS clusters — whose endpoints flow through the separate EDS pipeline — do not churn.
 
 The base transform checks that translation named the cluster after
-`BackendObjectIR.ClusterName()` and drops the backend loudly otherwise. Every consumer assumes
-that name — routes reference it, status is keyed on it, the EDS pipeline names its CLA after it —
-and nothing in tree renames it.
+`BackendObjectIR.ClusterName()` and otherwise records the backend as an errored base under that
+expected name, so it is excluded from CDS, its CLA is filtered from EDS, and status reports the
+rename. Every consumer assumes that name — routes reference it, status is keyed on it, the EDS
+pipeline names its CLA after it — and nothing in tree renames it. The same shape covers a
+group/kind with no contributed translator: `TranslateBackendBase` never returns `nil`; see
+[Open Questions](#open-questions) for why dropping the row instead was a hole.
 
 #### Interning and immutability
 
@@ -276,7 +279,7 @@ type EndpointInputsEditor interface {
     BackendLabels() map[string]string
     Hostname() string
     Port() uint32
-    PoliciesFor(schema.GroupKind) []ir.PolicyAtt
+    PoliciesFor(schema.GroupKind) []PolicyView
 
     SetPriorityInfo(*PriorityInfo)
     SetTrafficDistribution(wellknown.TrafficDistribution)
@@ -294,6 +297,12 @@ endpoints are structurally shared through `AddUnchanged`. The deprecated hook is
 behind `LegacyMutableInputs()`, which deep-copies the whole input graph at most once per
 client no matter how many legacy plugins run.
 
+Isolation here is a matter of what the API can reach, not of copying. `PolicyView` exposes the
+four things endpoint plugins actually ask of an attachment — its IR, whether it failed IR
+construction, its ref string, and its generation — and keeps `PolicyRef`, `Errors`, and
+`MergeOrigins` out of reach, so `PoliciesFor` needs no defensive deep copy on a path that runs
+per client per backend.
+
 `EndpointsForBackend.Add` retains each endpoint's already-computed hash contribution as
 unexported derived state. `AddUnchanged` reuses that contribution when the endpoint stays in
 the same locality, avoiding the per-client proto marshal that #14489 removed from the shared
@@ -439,22 +448,31 @@ Apple M4 Max, `-benchtime=20x`:
 | istio=true heavy=true | 1,689,979 | 703,883 | 52,800 | 10,201 | 5.06 MB | 911 KB |
 
 Roughly 10x on the no-overlay path and 2x with a sparsely-matching destination rule, with
-allocation counts down 5-13x. The benchmark measures the translator only; see
-[Open Questions](#open-questions) for a collection-level cost it does not model.
+allocation counts down 5-13x. The benchmark measures the translator in isolation; the
+per-client collection wrapped around it adds no per-backend copy of its own, which is what
+[`BorrowForRead`](#interning-and-immutability) is for.
 
 ### Delivery
 
-The work landed as a 6-PR stack rather than as #14343, so that the translator contract, the
-KRT topology change, and the allocation optimizations can be reviewed and reverted
-independently.
+The work lands as a stack rather than as #14343, so that the translator contract, the KRT
+topology change, and the allocation optimizations can be reviewed and reverted independently.
 
 | # | PR | Scope | Topology change |
 | --- | --- | --- | --- |
 | 1 | #14599 | endpoint mutation boundary (`EndpointInputsEditor`), deterministic CLA construction | no |
 | 2 | #14600 | `TranslateBackendBase` / `ApplyPerClient` / `ClusterOverlay`, dense storage retained, gateway fixtures for the errored-cluster output change | no |
-| 3 | (replaces #14602) | shared bases, client-keyed per-client assembly, `sharedproto`, tripwire CI wiring | **yes** |
-| 4 | #14603 | intern equivalent per-client cluster clones (to be rebased onto the client-keyed rows) | no |
-| 5 | #14604 | intern equivalent per-client CLAs, `LoadBalancingContextHash` | no |
+| 3 | #14691 | `sharedproto`: explicit ownership of protos shared across client snapshots, mutation tripwire | no |
+| 4 | #14692 | shared bases, client-keyed per-client assembly, Service address projection into `ObjIr`, tripwire CI wiring | **yes** |
+| 5 | #14693 | client-independent inline CLAs built 
```

**File**: `pkg/kgateway/endpoints/prioritize.go` (modified, +46/-5)
```diff
@@ -1,6 +1,7 @@
 package endpoints
 
 import (
+	"hash/fnv"
 	"log/slog"
 	"slices"
 	"strings"
@@ -13,6 +14,7 @@ import (
 	istioslices "istio.io/istio/pkg/slices"
 	corev1 "k8s.io/api/core/v1"
 
+	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/utils"
 	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
 )
@@ -30,11 +32,7 @@ func PrioritizeEndpoints(
 	ucc ir.UniquelyConnectedClient,
 	inputs EndpointsInputs,
 ) *envoyendpointv3.ClusterLoadAssignment {
-	lbInfo := LoadBalancingInfo{
-		PodLabels:    ucc.Labels,
-		PodLocality:  ucc.Locality,
-		PriorityInfo: ResolvedPriorityInfo(inputs),
-	}
+	lbInfo := loadBalancingInfoFor(ucc, inputs)
 	return prioritizeWithLbInfo(logger, inputs.EndpointsForBackend, lbInfo)
 }
 
@@ -60,6 +58,41 @@ func DependsOnClient(inputs EndpointsInputs) bool {
 	return ResolvedPriorityInfo(inputs) != nil
 }
 
+// LoadBalancingContextHash returns a hash of the client inputs
+// that influence PrioritizeEndpoints' output. Callers may use it to bucket CLAs
+// for interning, but must confirm content equality because the 64-bit hash can
+// collide.
+//
+// IMPORTANT: this must mirror the UCC-dependent branches of prioritizeWithLbInfo
+// /getEndpoints. When FailoverPriority is set, only the resolved priority-label
+// values matter (locality is ignored); otherwise only PodLocality matters. Any
+// new UCC-dependent input added to prioritization MUST be reflected here, or
+// distinct CLAs will be silently aliased.
+func LoadBalancingContextHash(ucc ir.UniquelyConnectedClient, inputs EndpointsInputs) uint64 {
+	lbInfo := loadBalancingInfoFor(ucc, inputs)
+	if lbInfo.PriorityInfo == nil {
+		return 0
+	}
+
+	hasher := fnv.New64a()
+	if lbInfo.PriorityInfo.FailoverPriority != nil {
+		for _, label := range lbInfo.PriorityInfo.FailoverPriority.priorityLabels {
+			utils.HashStringField(hasher, label)
+			valueForProxy, ok := lbInfo.PriorityInfo.FailoverPriority.priorityLabelOverrides[label]
+			if !ok {
+				valueForProxy = lbInfo.PodLabels[label]
+			}
+			utils.HashStringField(hasher, valueForProxy)
+		}
+		return hasher.Sum64()
+	}
+
+	utils.HashStringField(hasher, lbInfo.PodLocality.Region)
+	utils.HashStringField(hasher, lbInfo.PodLocality.Zone)
+	utils.HashStringField(hasher, lbInfo.PodLocality.Subzone)
+	return hasher.Sum64()
+}
+
 type LoadBalancingInfo struct {
 	// pod info:
 
@@ -72,6 +105,14 @@ type LoadBalancingInfo struct {
 	PriorityInfo *PriorityInfo
 }
 
+func loadBalancingInfoFor(ucc ir.UniquelyConnectedClient, inputs EndpointsInputs) LoadBalancingInfo {
+	return LoadBalancingInfo{
+		PodLabels:    ucc.Labels,
+		PodLocality:  ucc.Locality,
+		PriorityInfo: ResolvedPriorityInfo(inputs),
+	}
+}
+
 type PriorityInfo struct {
 	FailoverPriority *Prioritizer
 	Failover         []*v1alpha3.LocalityLoadBalancerSetting_Failover
```

**File**: `pkg/kgateway/endpoints/prioritize_property_test.go` (added, +188/-0)
```diff
@@ -0,0 +1,188 @@
+package endpoints
+
+import (
+	"maps"
+	"testing"
+
+	envoycorev3 "github.com/envoyproxy/go-control-plane/envoy/config/core/v3"
+	envoyendpointv3 "github.com/envoyproxy/go-control-plane/envoy/config/endpoint/v3"
+	"github.com/stretchr/testify/require"
+	"google.golang.org/protobuf/proto"
+	corev1 "k8s.io/api/core/v1"
+
+	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
+	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
+)
+
+// TestLoadBalancingContextHashSoundness locks the coupling between
+// LoadBalancingContextHash and PrioritizeEndpoints, which the CLA interning in
+// NewPerClientEnvoyEndpoints relies on. The interning shares one CLA across every
+// UCC with the same hash, so the hash MUST capture every UCC-dependent input that
+// PrioritizeEndpoints consumes. We assert the soundness direction over a diverse
+// UCC set and several priority configurations:
+//
+//	equal hash  =>  proto.Equal on the built ClusterLoadAssignment
+//
+// The reverse does NOT hold and is intentionally not asserted: the hash is
+// conservative (e.g. single-group locality failover renormalizes every priority
+// to 0, so UCCs in different localities can hash differently yet build identical
+// CLAs). That only costs a missed dedup, never a wrong one. A future change to
+// PrioritizeEndpoints that reads a UCC field not folded into the hash would break
+// this test by producing equal-hash UCCs with differing CLAs.
+//
+// The CLAs are compared as built, with no normalization: PrioritizeEndpoints emits
+// locality groups in canonical order (see sortedLocalities), which
+// TestPrioritizeEndpointsIsByteStable pins independently. That coupling means a
+// locality-ordering regression also fails here, which the failure message calls
+// out — check the byte-stability test before hunting for a missing hash input.
+func TestLoadBalancingContextHashSoundness(t *testing.T) {
+	backend := ir.NewBackendObjectIR(ir.ObjectSource{
+		Group:     "core",
+		Kind:      "Service",
+		Namespace: "ns",
+		Name:      "svc",
+	}, 80, "", "")
+
+	// Endpoints spread across localities, each labeled with its own topology so
+	// failover-priority (which compares proxy labels to endpoint labels) and
+	// locality failover both have something to discriminate on.
+	ep := ir.NewEndpointsForBackend(backend)
+	addEndpoint(ep, "r1", "z1", "ep-z1")
+	addEndpoint(ep, "r1", "z2", "ep-z2")
+	addEndpoint(ep, "r2", "z3", "ep-r2")
+
+	// The first two UCCs carry the same topology labels and locality and differ
+	// only in an irrelevant label; they must collapse to one hash (and hence one
+	// CLA) in every scenario, which is what keeps the soundness loop below from
+	// being vacuous.
+	const twinA, twinB = 0, 1
+	uccs := []ir.UniquelyConnectedClient{
+		twinA: newUCC("z1-a", "r1", "z1", map[string]string{"app": "a"}),
+		twinB: newUCC("z1-b", "r1", "z1", map[string]string{"app": "b"}),
+		newUCC("z2", "r1", "z2", nil),
+		newUCC("r2", "r2", "z3", nil),
+		// No topology labels at all (locality still r1/z1): exercises the empty
+		// label-value path of the failover-priority hash.
+		newUCCNoTopology("no-topo", "r1", "z1"),
+		// Labels and locality disagree (labels say z2, PodLocality says z1). In
+		// failover-priority mode this UCC must collapse with "z2"; in locality
+		// failover mode it must collapse with the z1 twins. A hash that mirrored
+		// the wrong input for either mode would produce equal hashes with
+		// different CLAs here, which the consistent UCCs above cannot detect.
+		newUCCLabelsVsLocality("labels-z2-locality-z1", "r1", "z2", "r1", "z1"),
+	}
+
+	epPreferSameZone := *ep
+	epPreferSameZone.TrafficDistribution = wellknown.TrafficDistributionPreferSameZone
+	epPreferSameNode := *ep
+	epPreferSameNode.TrafficDistribution = wellknown.TrafficDistributionPreferSameNode
+
+	scenarios := map[string]EndpointsInputs{
+		// PriorityInfo nil (TrafficDistribution Any): output is UCC-independent,
+		// so every UCC hashes to 0 and builds an identical CLA.
+		"trafficAny": {EndpointsForBackend: *ep},
+		// Failover priority on topology labels: hash + CLA key on the resolved
+		// proxy label values.
+		"failoverPriority": {
+			EndpointsForBackend: *ep,
+			PriorityInfo: &PriorityInfo{
+				FailoverPriority: NewPriorities([]string{corev1.LabelZoneRegion, corev1.LabelTopologyZone}),
+			},
+		},
+		// Locality failover (no FailoverPriority): hash + CLA key on PodLocality.
+		"localityFailover": {
+			EndpointsForBackend: *ep,
+			PriorityInfo:        &PriorityInfo{},
+		},
+		// PriorityInfo derived from the backend's TrafficDistribution rather than
+		// supplied by a plugin: the branch of loadBalancingInfoFor that the
+		// kubernetes Service path takes.
+		"trafficPreferSameZone": {EndpointsForBackend: epPreferSameZone},
+		"trafficPreferSameNode": {EndpointsForBackend: epPreferSameNode},
+	}
+
+	for name, inputs := range scenarios {
+		t.Run(name, func(t *testing.T) {
+			hashes := make([]uint64, len(uccs))
```

**File**: `pkg/kgateway/extensions2/plugins/backendconfigpolicy/endpoints_applicability_test.go` (modified, +6/-10)
```diff
@@ -11,15 +11,11 @@ import (
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/overlaytest"
 )
 
-// TestEndpointsMayApplyCoversProcessEndpoints checks the promise this plugin
-// makes to the framework: a backend its PerClientEndpointsMayApply rules out is
-// one processEndpoints would not have touched, for any client. The framework
-// does not invoke the hook for such a backend and builds one inline
-// ClusterLoadAssignment shared by every client, so a predicate that rules out
-// too much loses this plugin's zone-aware configuration silently.
-//
-// The pairing under test is the registration's, not a restatement of it: both
-// fields are taken from the same values NewPlugin registers.
+// TestEndpointsMayApplyCoversProcessEndpoints checks that processEndpoints
+// contributes nothing, for any client, to a backend the plugin's
+// PerClientEndpointsMayApply rules out. The framework skips the hook for such
+// backends, so a predicate that rules out too much drops zone-aware endpoints
+// silently. See overlaytest.AssertMayApplyCoversEndpointHook.
 func TestEndpointsMayApplyCoversProcessEndpoints(t *testing.T) {
 	groupKind := wellknown.BackendConfigPolicyGVK.GroupKind()
 	endpointPlugin := &backendConfigEndpointPlugin{}
@@ -48,7 +44,7 @@ func TestEndpointsMayApplyCoversProcessEndpoints(t *testing.T) {
 			}),
 			// Admitted. The hook may still decline this one, because the
 			// attached policy need not be zone-aware; admitting a backend the
-			// hook would not touch costs a per-client build and is sound.
+			// hook would not touch is safe, but costs a per-client build.
 			backend("attached", map[schema.GroupKind][]ir.PolicyAtt{
 				groupKind: {{GroupKind: groupKind}},
 			}),
```

**File**: `pkg/kgateway/extensions2/plugins/destrule/destrule_plugin.go` (modified, +2/-0)
```diff
@@ -75,6 +75,8 @@ func (d *destrulePlugin) overlayInputsHash(in ir.BackendObjectIR) uint64 {
 	return hasher.Sum64()
 }
 
+// endpointsMayApply reports whether a DestinationRule names the backend's host.
+//
 // endpointsMayApply rules a backend out of the per-client endpoint path when no
 // DestinationRule names its hostname at all. Which rule applies to a given client
 // is decided by the client's namespace and labels, so a backend with a rule for
```

**File**: `pkg/kgateway/extensions2/plugins/waypoint/plugin.go` (modified, +9/-16)
```diff
@@ -88,13 +88,9 @@ func (t *PerClientProcessor) policyPlugin() sdk.PolicyPlugin {
 	}
 }
 
-// overlayInputsHash declares what clusterOverlay reads from the backend: the
-// ingress-use-waypoint inputs, the object's name and namespace that key the
-// waypoint lookup (the attachment itself is fetched), and what
-// ApplyIngressUseWaypointCluster inlines into the STATIC cluster: the resolved
-// addresses and the port. The addresses are the reason this declaration
-// exists: a core Service's spec.clusterIPs can change (single- to dual-stack)
-// without moving anything else the framework compares.
+// overlayInputsHash covers the waypoint label inputs, lookup name and namespace,
+// and the resolved addresses and port inlined into STATIC clusters. Waypoint
+// attachments are fetched through KRT and tracked separately.
 func (t *PerClientProcessor) overlayInputsHash(in ir.BackendObjectIR) uint64 {
 	hasher := fnv.New64a()
 	IngressUseWaypointInputsHash(hasher, in)
@@ -309,12 +305,10 @@ func sortAddressesByDnsLookupFamily(addresses []string, settings *apisettings.Se
 	return sortedAddresses
 }
 
-// IngressUseWaypointInputsHash writes into hasher every field of the backend
-// that HasIngressUseWaypointLabel reads: the object's own ingress-use-waypoint
-// label, its namespace, and the namespaces of its aliases. The namespace labels
-// consulted for those are fetched, so KRT tracks them. Every plugin whose
-// overlay calls HasIngressUseWaypointLabel folds this into its
-// OverlayInputsHash, so the declaration cannot drift from the reader.
+// IngressUseWaypointInputsHash hashes the backend fields read by
+// HasIngressUseWaypointLabel: its label, namespace, and alias namespaces.
+// Namespace labels are fetched through KRT. Overlays that call
+// HasIngressUseWaypointLabel must include this hash in their OverlayInputsHash.
 func IngressUseWaypointInputsHash(hasher io.Writer, in ir.BackendObjectIR) {
 	if in.Obj != nil {
 		utils.HashStringField(hasher, in.Obj.GetLabels()[wellknown.IngressUseWaypointLabel])
@@ -325,9 +319,8 @@ func IngressUseWaypointInputsHash(hasher io.Writer, in ir.BackendObjectIR) {
 	}
 }
 
-// HasIngressUseWaypointLabel reports whether the backend or any relevant
-// namespace/alias carries the ingress-use-waypoint label. Its inputs are
-// declared by IngressUseWaypointInputsHash; keep the two in step.
+// HasIngressUseWaypointLabel checks the backend and namespace/alias labels.
+// Keep its inputs in sync with IngressUseWaypointInputsHash.
 func HasIngressUseWaypointLabel(kctx krt.HandlerContext, commonCols *collections.CommonCollections, in ir.BackendObjectIR) bool {
 	// Check the backend's own label first
 	if val, ok := in.Obj.GetLabels()[wellknown.IngressUseWaypointLabel]; ok && val == "true" {
```

**File**: `pkg/kgateway/proxy_syncer/backends.go` (modified, +8/-19)
```diff
@@ -20,11 +20,8 @@ import (
 	krtutil "github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/krtutil"
 )
 
-// baseEnvoyCluster is the UCC-invariant translation result for a single backend.
-// The Cluster proto is shared across every UCC that targets this backend: it is
-// read-only on the consumer side, and per-client processing clones it before
-// modifying. Sharing it is what keeps per-client CDS state proportional to the
-// number of backends rather than to backends times clients.
+// baseEnvoyCluster is the client-independent translation of one backend.
+// Clients share its read-only Cluster proto and clone it for per-client changes.
 type baseEnvoyCluster struct {
 	// Name is both the Envoy cluster name and the KRT key; translation always
 	// names the cluster (blackhole included) after BackendObjectIR.ClusterName().
@@ -44,14 +41,8 @@ type baseEnvoyCluster struct {
 	BackendSource ir.ObjectSource
 	// BackendGeneration is the observed generation of the source Backend.
 	BackendGeneration int64
-	// OverlayInputsHash is the fold of every overlay plugin's declared backend
-	// inputs (BackendTranslator.OverlayInputsHash). Per-client processing reads
-	// Backend through the overlays, and this is how a change to what they read
-	// (a Service label the waypoint overlay branches on) reaches every client
-	// even when the shared proto is byte-identical. A write that moves neither
-	// this nor ClusterVersion — a status update, an annotation no overlay
-	// reads, a label none branches on — leaves the row equal, and no client's
-	// walk reruns.
+	// OverlayInputsHash combines the backend inputs declared by overlay plugins.
+	// Changes to these inputs must reach clients even when ClusterVersion is unchanged.
 	OverlayInputsHash uint64
 	// CompareBackendInputs enables conservative IR equality for undeclared hooks.
 	CompareBackendInputs bool
@@ -63,12 +54,10 @@ type baseEnvoyCluster struct {
 	// because every field they read is hashed or conservatively compared.
 	// +noKrtEquals
 	Backend *ir.BackendObjectIR
-	// Base is the non-proto portion of the base-translation result retained for
-	// per-client processing. Base.Cluster is always nil: the only retained copy
-	// of the shared proto lives behind Cluster, so future code cannot mutate it
-	// through a raw *BaseCluster alias. Everything ApplyPerClient reads from it
-	// (EndpointInputs, SupportsInlineCLA, DefaultedLocalityConfig) is either
-	// derived from the proto or folded into ClusterVersion by baseClusterVersion.
+	// Base retains the non-proto translation inputs used by ApplyPerClient.
+	// Base.Cluster is nil; Cluster holds the shared proto. EndpointInputs,
+	// SupportsInlineCLA, and DefaultedLocalityConfig are derived from the proto
+	// or included in ClusterVersion.
 	// +noKrtEquals
 	Base *irtranslator.BaseCluster
 }
```

---

### Incident Patch 10: `e506cf82` (2026-09-22)
**Commit Message**: fix(backendtlspolicy): report status against the policy's targets (#14659)

Signed-off-by: omar <[REDACTED_EMAIL]>

**File**: `pkg/kgateway/extensions2/plugins/backendtlspolicy/plugin.go` (modified, +0/-1)
```diff
@@ -136,7 +136,6 @@ func NewPlugin(ctx context.Context, commoncol *collections.CommonCollections) sd
 					// kgateway Valid/Pending vocabulary the standard grading expects.
 					pluginutils.NoConditionErrorMetric,
 				),
-				PolicyStatusFromGatewayReports: true,
 			},
 		},
 	}
```

**File**: `pkg/kgateway/extensions2/plugins/backendtlspolicy/status.go` (modified, +39/-0)
```diff
@@ -8,13 +8,21 @@ import (
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
 
+	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
 	"github.com/kgateway-dev/kgateway/v2/pkg/reports"
 )
 
 // BuildDesiredPolicyStatus builds the controller-owned portion of a BackendTLSPolicy's
 // desired status from its typed report fragment, preserving LastTransitionTime for unchanged
 // conditions. The status writer preserves other controllers' ancestors and enforces the
 // Gateway API ancestor limit when it merges this desired status with the live object.
+//
+// Target ancestors are a fallback. The per-backend status path reports every policy against
+// the target it attaches to, so that a policy no route references still gets a status; see
+// reportBackendTLSPolicies. Once route translation reports a Gateway ancestor, that Gateway
+// is the ancestor the Gateway API expects and the one existing tooling reads, so the target
+// ancestors are dropped rather than listed beside it. A routed policy therefore reports
+// exactly the ancestors it reported before target ancestors existed.
 func BuildDesiredPolicyStatus(report *reports.PolicyReport, pol *gwv1.BackendTLSPolicy, controller string) *gwv1.PolicyStatus {
 	currentStatus := pol.Status
 	if report == nil {
@@ -25,7 +33,23 @@ func BuildDesiredPolicyStatus(report *reports.PolicyReport, pol *gwv1.BackendTLS
 		Ancestors: make([]gwv1.PolicyAncestorStatus, 0, len(report.Ancestors)),
 	}
 
+	// Suppression is per policy, not per target: a Gateway ancestor records only the parent
+	// it came from, never which targetRef earned it, so there is no way here to tell a
+	// routed target apart from an unrouted one on a policy that has both. A policy mixing
+	// routed and unrouted targets reports only its Gateway ancestors.
+	hasGatewayAncestor := false
+	for parentKey := range report.Ancestors {
+		if isGatewayAncestor(parentKey) {
+			hasGatewayAncestor = true
+			break
+		}
+	}
+
 	for parentKey, ancestorReport := range report.Ancestors {
+		if hasGatewayAncestor && !isGatewayAncestor(parentKey) {
+			continue
+		}
+
 		ancestorRef := gwv1.ParentReference{
 			Group:     new(gwv1.Group(parentKey.Group)),
 			Kind:      new(gwv1.Kind(parentKey.Kind)),
@@ -73,3 +97,18 @@ func BuildDesiredPolicyStatus(report *reports.PolicyReport, pol *gwv1.BackendTLS
 
 	return &status
 }
+
+// isGatewayAncestor reports whether an ancestor names a Gateway-side parent: the Gateway
+// itself, or the XListenerSet that contributed the listener a route attached to. Those are
+// the ancestors route translation reports. Every other ancestor in a BackendTLSPolicy's
+// report is a target ancestor from the per-backend status path.
+func isGatewayAncestor(key reports.ParentRefKey) bool {
+	switch {
+	case key.Group == wellknown.GatewayGroup && key.Kind == wellknown.GatewayKind:
+		return true
+	case key.Group == wellknown.XListenerSetGroup && key.Kind == wellknown.XListenerSetKind:
+		return true
+	default:
+		return false
+	}
+}
```

**File**: `pkg/kgateway/extensions2/plugins/backendtlspolicy/status_test.go` (modified, +73/-0)
```diff
@@ -8,6 +8,7 @@ import (
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
 
+	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
 	pluginreporter "github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/reporter"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/statussync"
@@ -185,6 +186,78 @@ func TestBuildDesiredPolicyStatusLeavesAncestorCapToWriter(t *testing.T) {
 	require.Len(t, merged, reports.MaxPolicyStatusAncestors)
 }
 
+func TestBuildDesiredPolicyStatusSuppressesTargetAncestors(t *testing.T) {
+	key := pluginreporter.PolicyKey{
+		Group:     gwv1.GroupVersion.Group,
+		Kind:      "BackendTLSPolicy",
+		Namespace: "default",
+		Name:      "tls-policy",
+	}
+	ref := func(group, kind, name string) gwv1.ParentReference {
+		return gwv1.ParentReference{
+			Group:     new(gwv1.Group(group)),
+			Kind:      new(gwv1.Kind(kind)),
+			Namespace: new(gwv1.Namespace("default")),
+			Name:      gwv1.ObjectName(name),
+		}
+	}
+	serviceRef := ref("", wellknown.ServiceKind, "svc")
+	backendRef := ref(wellknown.BackendGVK.Group, wellknown.BackendGVK.Kind, "oauth-backend")
+	gatewayRef := ref(wellknown.GatewayGroup, wellknown.GatewayKind, "gw")
+	listenerSetRef := ref(wellknown.XListenerSetGroup, wellknown.XListenerSetKind, "ls")
+
+	build := func(t *testing.T, refs ...gwv1.ParentReference) []gwv1.PolicyAncestorStatus {
+		t.Helper()
+		rm := reports.NewReportMap()
+		policyReporter := reports.NewReporter(&rm).Policy(key, 1)
+		for _, r := range refs {
+			ancestorReporter := policyReporter.AncestorRef(r)
+			for _, condition := range BuildPolicyConditions(newTestPolicyAtt("tls-policy", time.Unix(10, 0)), nil) {
+				ancestorReporter.SetCondition(condition)
+			}
+		}
+		status := BuildDesiredPolicyStatus(rm.PolicyReport(key), &gwv1.BackendTLSPolicy{
+			ObjectMeta: metav1.ObjectMeta{Namespace: key.Namespace, Name: key.Name},
+		}, "kgateway.dev/kgateway")
+		require.NotNil(t, status)
+		return status.Ancestors
+	}
+	names := func(ancestors []gwv1.PolicyAncestorStatus) []string {
+		out := make([]string, 0, len(ancestors))
+		for _, a := range ancestors {
+			out = append(out, string(*a.AncestorRef.Kind)+"/"+string(a.AncestorRef.Name))
+		}
+		return out
+	}
+
+	t.Run("target ancestors are the whole status when no route reaches the target", func(t *testing.T) {
+		got := build(t, serviceRef, backendRef)
+		require.ElementsMatch(t, []string{"Service/svc", "Backend/oauth-backend"}, names(got),
+			"an unrouted policy should report every target it attaches to")
+	})
+
+	t.Run("a Gateway ancestor suppresses target ancestors", func(t *testing.T) {
+		got := build(t, serviceRef, gatewayRef)
+		require.Equal(t, []string{"Gateway/gw"}, names(got),
+			"a routed policy should report the same ancestors it reported before target ancestors existed")
+	})
+
+	t.Run("an XListenerSet ancestor suppresses target ancestors", func(t *testing.T) {
+		got := build(t, serviceRef, listenerSetRef)
+		require.Equal(t, []string{"XListenerSet/ls"}, names(got),
+			"a route attached through a listener set reports the listener set, not the target")
+	})
+
+	t.Run("suppression is per policy, not per target", func(t *testing.T) {
+		// backendRef is unrouted, but serviceRef is routed and earns the Gateway ancestor.
+		// Nothing in the report says which targetRef the Gateway ancestor came from, so the
+		// unrouted target loses its ancestor too. Known gap: a policy mixing routed and
+		// unrouted targets reports only its Gateway ancestors.
+		got := build(t, serviceRef, backendRef, gatewayRef)
+		require.Equal(t, []string{"Gateway/gw"}, names(got))
+	})
+}
+
 func newTestPolicyAtt(name string, created time.Time) ir.PolicyAtt {
 	return ir.PolicyAtt{
 		Generation: 1,
```

**File**: `pkg/kgateway/proxy_syncer/proxy_syncer.go` (modified, +1/-12)
```diff
@@ -289,18 +289,7 @@ func (s *ProxySyncer) Init(ctx context.Context, krtopts krtutil.KrtOptions) {
 		localClusterEpPerClient,
 	)
 
-	excludedPolicyKinds := make(map[schema.GroupKind]struct{})
-	for gk, plugin := range s.plugins.ContributesPolicies {
-		if plugin.PolicyStatusFromGatewayReports {
-			excludedPolicyKinds[gk] = struct{}{}
-		}
-	}
-
-	backendPolicyContributions := backendPolicyStatusContributions(
-		finalBackendsWithPolicyStatus,
-		excludedPolicyKinds,
-		krtopts,
-	)
+	backendPolicyContributions := backendPolicyStatusContributions(finalBackendsWithPolicyStatus, krtopts)
 
 	// Backend status is reduced per Backend. Indexed cluster and plugin-condition
 	// dependencies ensure one client's error only recomputes its owning Backend.
```

**File**: `pkg/kgateway/proxy_syncer/status.go` (modified, +63/-12)
```diff
@@ -5,13 +5,13 @@ import (
 	"slices"
 
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
-	"k8s.io/apimachinery/pkg/runtime/schema"
 	"k8s.io/apimachinery/pkg/types"
 	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
 
 	"github.com/kgateway-dev/kgateway/v2/api/v1alpha1/kgateway"
 	"github.com/kgateway-dev/kgateway/v2/api/v1alpha1/shared"
 	backendconfigpolicyplugin "github.com/kgateway-dev/kgateway/v2/pkg/kgateway/extensions2/plugins/backendconfigpolicy"
+	backendtlspolicyplugin "github.com/kgateway-dev/kgateway/v2/pkg/kgateway/extensions2/plugins/backendtlspolicy"
 	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/extensions2/pluginutils"
 	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
@@ -28,21 +28,34 @@ var _ ObjWithAttachedPolicies = ir.BackendObjectIR{}
 
 // GenerateBackendPolicyReport generates a report map for all policies attached to the given backends.
 // Exported for testing.
-func GenerateBackendPolicyReport(in []*ir.BackendObjectIR, excludedPolicyKinds map[schema.GroupKind]struct{}) reports.ReportMap {
+func GenerateBackendPolicyReport(in []*ir.BackendObjectIR) reports.ReportMap {
 	merged := reports.NewPolicyReportMap()
 	reporter := reports.NewReporter(&merged)
 
 	// iterate all backends and aggregate all policies attached to them
 	// we track each attachment point of the policy to be tracked as an
 	// ancestor for reporting status
+	bcpGK := wellknown.BackendConfigPolicyGVK.GroupKind()
+	btpGK := wellknown.BackendTLSPolicyGVK.GroupKind()
 	for _, obj := range in {
 		conflictingBTP := winningBackendTLSPolicyRef(obj.GetAttachedPolicies())
-		bcpGK := wellknown.BackendConfigPolicyGVK.GroupKind()
+		targetRef := backendAncestorRef(obj.GetObjectSource())
+
+		// BackendTLSPolicy speaks the Gateway API's own condition vocabulary
+		// (Accepted/ResolvedRefs/Conflicted) rather than kgateway's Valid/Attached, and
+		// resolves conflicts the way translation does. The target ancestor reported here is a
+		// fallback: it is the only status an unrouted target, or a Backend used solely by a
+		// GatewayExtension, ever gets. It is reported unconditionally because this collection
+		// cannot see whether a route reaches the target — that is knowable only once both
+		// contribution sources have been reduced, so BuildDesiredPolicyStatus drops these
+		// again for any policy that also has a Gateway ancestor.
+		reportBackendTLSPolicies(reporter, targetRef, obj.GetAttachedPolicies().Policies[btpGK])
+
 		for gk, polAtts := range obj.GetAttachedPolicies().Policies {
+			if gk == btpGK {
+				continue
+			}
 			for _, polAtt := range polAtts {
-				if _, excluded := excludedPolicyKinds[polAtt.GroupKind]; excluded {
-					continue
-				}
 				if polAtt.PolicyRef == nil {
 					// the policyRef may be nil in the case of virtual plugins (e.g. istio settings)
 					// since there's no real policy object, we don't need to generate status for it
@@ -55,12 +68,7 @@ func GenerateBackendPolicyReport(in []*ir.BackendObjectIR, excludedPolicyKinds m
 					Namespace: polAtt.PolicyRef.Namespace,
 					Name:      polAtt.PolicyRef.Name,
 				}
-				ancestorRef := gwv1.ParentReference{
-					Group:     new(gwv1.Group(obj.GetObjectSource().Group)),
-					Kind:      new(gwv1.Kind(obj.GetObjectSource().Kind)),
-					Namespace: new(gwv1.Namespace(obj.GetObjectSource().Namespace)),
-					Name:      gwv1.ObjectName(obj.GetObjectSource().Name),
-				}
+				ancestorRef := targetRef
 				if polAtt.PolicyRef.SectionName != "" {
 					ancestorRef.SectionName = new(gwv1.SectionName(polAtt.PolicyRef.SectionName))
 				}
@@ -100,6 +108,49 @@ func GenerateBackendPolicyReport(in []*ir.BackendObjectIR, excludedPolicyKinds m
 	return merged
 }
 
+// backendAncestorRef returns the ancestor ref for a policy attached to a backend: the
+// target object itself. Callers add a sectionName for port-specific attachments.
+func backendAncestorRef(src ir.ObjectSource) gwv1.ParentReference {
+	return gwv1.ParentReference{
+		Group:     new(gwv1.Group(src.Group)),
+		Kind:      new(gwv1.Kind(src.Kind)),
+		Namespace: new(gwv1.Namespace(src.Namespace)),
+		Name:      gwv1.ObjectName(src.Name),
+	}
+}
+
+// reportBackendTLSPolicies reports each BackendTLSPolicy in policies against the target it
+// attaches to. The effective policy is chosen by the plugin's MergePolicies on the same
+// unfiltered slice translation hands it, so the target ancestor never disagrees with what is
+// actually applied, or with the Gateway ancestor that supersedes it on a routed target: an
+// older invalid policy still takes precedence, and the newer valid one is Conflicted, not
+// Accepted.
+func reportBackendTLSPolicies(reporter reportssdk.Reporter, targetRef gwv1.ParentReference, policies []ir.PolicyAtt) {
+	if len(policies) == 0 {
+		return
+	}
+	effective := backendtlspolicyplugin.MergePolicies(policies)
+	for _, polAtt := range policies {
+		if polAtt.PolicyRef == nil {
+			continue
+		}
+		key := repo
```

**File**: `pkg/kgateway/proxy_syncer/status_contributions.go` (modified, +1/-3)
```diff
@@ -4,7 +4,6 @@ import (
 	"strconv"
 
 	"istio.io/istio/pkg/kube/krt"
-	"k8s.io/apimachinery/pkg/runtime/schema"
 
 	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
@@ -32,14 +31,13 @@ func gatewayStatusContributions(
 
 func backendPolicyStatusContributions(
 	backends krt.Collection[*ir.BackendObjectIR],
-	excludedPolicyKinds map[schema.GroupKind]struct{},
 	krtopts krtutil.KrtOptions,
 ) krt.Collection[reports.StatusContribution] {
 	return krt.NewManyCollection(backends, func(_ krt.HandlerContext, backend *ir.BackendObjectIR) []reports.StatusContribution {
 		if backend == nil {
 			return nil
 		}
-		reportMap := GenerateBackendPolicyReport([]*ir.BackendObjectIR{backend}, excludedPolicyKinds)
+		reportMap := GenerateBackendPolicyReport([]*ir.BackendObjectIR{backend})
 		// Key on the backend's own resource name, not its ObjectSource's: one Service yields a
 		// BackendObjectIR per port, and ObjectSource.ResourceName() drops both the port and the
 		// extra key. Two ports contributing to the same policy would then emit contributions
```

**File**: `pkg/kgateway/proxy_syncer/status_test.go` (modified, +172/-12)
```diff
@@ -3,13 +3,15 @@ package proxy_syncer
 import (
 	"errors"
 	"testing"
+	"time"
 
 	"github.com/google/go-cmp/cmp"
 	"github.com/google/go-cmp/cmp/cmpopts"
 	"github.com/stretchr/testify/assert"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/runtime/schema"
 	"k8s.io/apimachinery/pkg/types"
+	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
 
 	"github.com/kgateway-dev/kgateway/v2/api/v1alpha1/shared"
 	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
@@ -93,7 +95,7 @@ func TestBackendPolicyStatus(t *testing.T) {
 	backends := []*ir.BackendObjectIR{&backend1, &backend2}
 
 	a := assert.New(t)
-	rm := GenerateBackendPolicyReport(backends, nil)
+	rm := GenerateBackendPolicyReport(backends)
 
 	// assert 3 unique policies: conn-policy-1, conn-policy-2, tls-policy
 	a.Len(rm.Policies, 3)
@@ -180,9 +182,9 @@ func TestBackendPolicyStatus(t *testing.T) {
 		ancestor1TLSPolicyreport.Conditions,
 		[]metav1.Condition{
 			{
-				Type:    string(shared.PolicyConditionAccepted),
+				Type:    string(gwv1.PolicyConditionAccepted),
 				Status:  metav1.ConditionFalse,
-				Reason:  string(shared.PolicyReasonInvalid),
+				Reason:  string(gwv1.PolicyReasonInvalid),
 				Message: "tls-policy error",
 			},
 		},
@@ -199,9 +201,9 @@ func TestBackendPolicyStatus(t *testing.T) {
 		ancestor2TLSPolicyreport.Conditions,
 		[]metav1.Condition{
 			{
-				Type:    string(shared.PolicyConditionAccepted),
+				Type:    string(gwv1.PolicyConditionAccepted),
 				Status:  metav1.ConditionFalse,
-				Reason:  string(shared.PolicyReasonInvalid),
+				Reason:  string(gwv1.PolicyReasonInvalid),
 				Message: "tls-policy error",
 			},
 		},
@@ -239,7 +241,7 @@ func TestBackendPolicyStatusWithSectionName(t *testing.T) {
 	backends := []*ir.BackendObjectIR{&backend}
 
 	a := assert.New(t)
-	rm := GenerateBackendPolicyReport(backends, nil)
+	rm := GenerateBackendPolicyReport(backends)
 
 	a.Len(rm.Policies, 1)
 
@@ -265,16 +267,16 @@ func TestBackendPolicyStatusWithSectionName(t *testing.T) {
 		ancestorReport.Conditions,
 		[]metav1.Condition{
 			{
-				Type:    string(shared.PolicyConditionAccepted),
+				Type:    string(gwv1.BackendTLSPolicyConditionResolvedRefs),
 				Status:  metav1.ConditionTrue,
-				Reason:  string(shared.PolicyReasonValid),
-				Message: reporter.PolicyAcceptedMsg,
+				Reason:  string(gwv1.BackendTLSPolicyReasonResolvedRefs),
+				Message: "Resolved all references",
 			},
 			{
-				Type:    string(shared.PolicyConditionAttached),
+				Type:    string(gwv1.PolicyConditionAccepted),
 				Status:  metav1.ConditionTrue,
-				Reason:  string(shared.PolicyReasonAttached),
-				Message: reporter.PolicyAttachedMsg,
+				Reason:  string(gwv1.PolicyReasonAccepted),
+				Message: reporter.PolicyAcceptedMsg,
 			},
 		},
 		cmpopts.IgnoreFields(metav1.Condition{}, "LastTransitionTime"),
@@ -289,3 +291,161 @@ func TestBackendPolicyStatusWithSectionName(t *testing.T) {
 	}]
 	a.Nil(ancestorNoSection, "ancestor report without SectionName should not exist")
 }
+
+// A BackendTLSPolicy attached to a kgateway Backend reports against the Backend itself,
+// in the Gateway API's vocabulary, whether or not any route uses that Backend. When two
+// policies target the same Backend the older one wins and the newer one is Conflicted,
+// matching the winner the plugin's MergePolicies picks.
+func TestBackendPolicyStatusBackendTLSPolicyTargetAncestor(t *testing.T) {
+	btpGK := wellknown.BackendTLSPolicyGVK.GroupKind()
+	newPolicyAtt := func(name string, created time.Time, generation int64) ir.PolicyAtt {
+		return ir.PolicyAtt{
+			GroupKind:  btpGK,
+			Generation: generation,
+			PolicyRef: &ir.AttachedPolicyRef{
+				Group:     btpGK.Group,
+				Kind:      btpGK.Kind,
+				Name:      name,
+				Namespace: "default",
+			},
+			PolicyIr: backendTLSTestPolicyIR{ct: created},
+		}
+	}
+	older := newPolicyAtt("older", time.Unix(100, 0), 3)
+	newer := newPolicyAtt("newer", time.Unix(200, 0), 5)
+
+	backend := ir.NewBackendObjectIR(ir.ObjectSource{
+		Group:     wellknown.BackendGVK.Group,
+		Kind:      wellknown.BackendGVK.Kind,
+		Namespace: "default",
+		Name:      "issuer",
+	}, 0, "", "")
+	backend.AttachedPolicies = ir.AttachedPolicies{
+		Policies: map[schema.GroupKind][]ir.PolicyAtt{
+			// newer first: the winner must come from creation time, not attachment order
+			btpGK: {newer, older},
+		},
+	}
+
+	a := assert.New(t)
+	rm := GenerateBackendPolicyReport([]*ir.BackendObjectIR{&backend})
+	a.Len(rm.Policies, 2)
+
+	targetKey := reports.ParentRefKey{
+		Group:          wellknown.BackendGVK.Group,
+		Kind:           wellknown.BackendGVK.Kind,
+		NamespacedName: types.NamespacedName{Namespace: "default", Name: "issuer"},
+	}
+	ancestorFor := func(name string) *reports.AncestorRefReport {
+		report := rm.Policies[reporter.PolicyKey{Group: btpGK.Group, Kind: btpGK.Kind, Namespace: "default", Name: name}]
+		if !a.NotNil(report, "policy %s should have a report", name) {
+			return nil
+		}
+		a.Len(rep
```

**File**: `pkg/kgateway/translator/gateway/gateway_translator_test.go` (modified, +11/-0)
```diff
@@ -1693,6 +1693,17 @@ func TestBasic(t *testing.T) {
 		})
 	})
 
+	t.Run("Backend TLS Policy on unrouted targets", func(t *testing.T) {
+		test(t, translatorTestCase{
+			inputFiles: []string{"backendtlspolicy/unrouted.yaml"},
+			outputFile: "backendtlspolicy/unrouted.yaml",
+			gwNN: types.NamespacedName{
+				Namespace: "default",
+				Name:      "example-gateway",
+			},
+		})
+	})
+
 	t.Run("Backend TLS Policy conflict resolution", func(t *testing.T) {
 		test(t, translatorTestCase{
 			inputFiles: []string{"backendtlspolicy/conflict-resolution.yaml"},
```

---

### Incident Patch 11: `ef23f159` (2026-09-21)
**Commit Message**: fix: correct xDS benchmark validation quoting and artifact upload aut… (#14740)

Signed-off-by: David L. Chandler <[REDACTED_EMAIL]>
Co-authored-by: copilot-swe-agent[bot] <[REDACTED_EMAIL]>

**File**: `.github/actions/upload-artifact/action.yaml` (modified, +2/-0)
```diff
@@ -17,6 +17,8 @@ runs:
     - name: Get Job ID from GH API
       shell: bash
       id: get-job-id
+      env:
+        GH_TOKEN: ${{ github.token }}
       run: |
         jobs=$(gh api repos/${{ github.repository }}/actions/runs/${{ github.run_id}}/attempts/${{ github.run_attempt }}/jobs)
         job_len=$(echo $jobs | jq -r '[.jobs[] | select(.runner_name=="${{ runner.name }}")] | length')
```

**File**: `.github/workflows/release.yaml` (modified, +1/-0)
```diff
@@ -44,6 +44,7 @@ env:
   CGO_ENABLED: '0'
 
 permissions:
+  actions: read
   contents: write
   packages: write
 
```

**File**: `Makefile` (modified, +12/-12)
```diff
@@ -1323,18 +1323,18 @@ run-xds-bench-ci: ## Run bounded xDS benchmarks and validate their results (exis
 .PHONY: validate-xds-bench-ci-results
 validate-xds-bench-ci-results: ## Check benchmark completion and fleet failure verdicts
 	@jq -es --arg suite "$(XDS_BENCH_SUITE)" \
-		'if $$suite == "cost" then \
-			([.[] | select(.event == "xds_cost_result") | .data.phase] | sort) == ["BaseChurn","EdsChurn","Reconnect"] \
-			and all(.[] | select(.event == "xds_cost_result"); .data.timed_out_iterations == 0 and .data.iterations > 0) \
-			and any(.[]; .event == "xds_cost_summary" and (.data.phases | length) == 3) \
-		elif $$suite == "fleet" then \
-			all(.[]; .event != "xds_fleet_verdict") \
-			and ([.[] | select(.event == "xds_fleet_wave")] | length) == 4 \
-			and all(.[] | select(.event == "xds_fleet_wave"); .data.served == true and .data.settled == true) \
-			and any(.[]; .event == "xds_fleet_wave" and .data.gateways == 24 and .data.clients == 24) \
-			and ([.[] | select(.event == "xds_fleet_result") | .data.phase] | sort) == ["BaseChurn","EdsChurn","StreamReconnect"] \
-			and all(.[] | select(.event == "xds_fleet_result"); .data.timed_out_iterations == 0 and .data.iterations > 0) \
-		else false end' "$(XDS_BENCH_OUTPUT_DIR)/$(XDS_BENCH_SUITE).jsonl"
+		"if \$$suite == \"cost\" then \
+			([.[] | select(.event == \"xds_cost_result\") | .data.phase] | sort) == [\"BaseChurn\",\"EdsChurn\",\"Reconnect\"] \
+			and all(.[] | select(.event == \"xds_cost_result\"); .data.timed_out_iterations == 0 and .data.iterations > 0) \
+			and any(.[]; .event == \"xds_cost_summary\" and (.data.phases | length) == 3) \
+		elif \$$suite == \"fleet\" then \
+			all(.[]; .event != \"xds_fleet_verdict\") \
+			and ([.[] | select(.event == \"xds_fleet_wave\")] | length) == 4 \
+			and all(.[] | select(.event == \"xds_fleet_wave\"); .data.served == true and .data.settled == true) \
+			and any(.[]; .event == \"xds_fleet_wave\" and .data.gateways == 24 and .data.clients == 24) \
+			and ([.[] | select(.event == \"xds_fleet_result\") | .data.phase] | sort) == [\"BaseChurn\",\"EdsChurn\",\"StreamReconnect\"] \
+			and all(.[] | select(.event == \"xds_fleet_result\"); .data.timed_out_iterations == 0 and .data.iterations > 0) \
+		else false end" "$(XDS_BENCH_OUTPUT_DIR)/$(XDS_BENCH_SUITE).jsonl"
 
 #----------------------------------------------------------------------------------
 # MARK: Conformance
```

---

### Incident Patch 12: `0191e720` (2026-09-18)
**Commit Message**: fix(aws): reject empty accessKey/secretKey in AWS Backend Secret (#14741)

Signed-off-by: omar <[REDACTED_EMAIL]>

**File**: `pkg/kgateway/extensions2/plugins/backend/aws.go` (modified, +31/-12)
```diff
@@ -376,23 +376,42 @@ type staticSecretDerivation struct {
 }
 
 // deriveStaticSecret derives the static secret from the given secret.
+//
+// Envoy's InlineCredentialProvider requires access_key_id and secret_access_key
+// to be non-empty (min_len: 1) and imposes no such constraint on session_token.
+// Enforcing the same rules here keeps a malformed Secret from producing a
+// cluster that Envoy rejects, which in the default validation mode discards the
+// entire CDS response. Returned errors name the Secret data key at fault and
+// never include the secret values themselves.
 func deriveStaticSecret(awsSecrets *ir.Secret) (*staticSecretDerivation, error) {
-	var errs []error
-	// validate that the secret has field in string format and has an access_key and secret_key
-	if awsSecrets.Data[wellknown.AccessKey] == nil || !utf8.Valid(awsSecrets.Data[wellknown.AccessKey]) {
-		// err is nil here but this is still safe
-		errs = append(errs, errors.New("access_key is not a valid string"))
-	}
-	if awsSecrets.Data[wellknown.SecretKey] == nil || !utf8.Valid(awsSecrets.Data[wellknown.SecretKey]) {
-		errs = append(errs, errors.New("secret_key is not a valid string"))
+	errs := []error{
+		validateSecretDataKey(awsSecrets.Data, wellknown.AccessKey, true),
+		validateSecretDataKey(awsSecrets.Data, wellknown.SecretKey, true),
+		validateSecretDataKey(awsSecrets.Data, wellknown.SessionToken, false),
 	}
-	// Session key is optional, but if it is present, it must be a valid string.
-	if awsSecrets.Data[wellknown.SessionToken] != nil && !utf8.Valid(awsSecrets.Data[wellknown.SessionToken]) {
-		errs = append(errs, errors.New("session_key is not a valid string"))
+	if err := errors.Join(errs...); err != nil {
+		return nil, err
 	}
 	return &staticSecretDerivation{
 		access:  string(awsSecrets.Data[wellknown.AccessKey]),
 		session: string(awsSecrets.Data[wellknown.SessionToken]),
 		secret:  string(awsSecrets.Data[wellknown.SecretKey]),
-	}, errors.Join(errs...)
+	}, nil
+}
+
+// validateSecretDataKey checks the value stored under key in a Secret's data.
+// A required key must be present, non-empty and valid UTF-8; an optional key
+// may be absent or empty but must be valid UTF-8 when set.
+func validateSecretDataKey(data map[string][]byte, key string, required bool) error {
+	value, ok := data[key]
+	if !ok || len(value) == 0 {
+		if required {
+			return fmt.Errorf("secret data key %q is missing or empty", key)
+		}
+		return nil
+	}
+	if !utf8.Valid(value) {
+		return fmt.Errorf("secret data key %q is not a valid UTF-8 string", key)
+	}
+	return nil
 }
```

**File**: `pkg/kgateway/extensions2/plugins/backend/aws_test.go` (modified, +98/-0)
```diff
@@ -1,6 +1,7 @@
 package backend
 
 import (
+	"strings"
 	"testing"
 
 	envoyclusterv3 "github.com/envoyproxy/go-control-plane/envoy/config/cluster/v3"
@@ -181,3 +182,100 @@ func newLambdaBackend(name, endpointURL string) *kgateway.Backend {
 		},
 	}
 }
+
+// TestDeriveStaticSecret pins the input validation that keeps a malformed
+// Secret from producing an InlineCredentialProvider Envoy rejects (its
+// access_key_id and secret_access_key carry min_len: 1). See issue #14736.
+func TestDeriveStaticSecret(t *testing.T) {
+	valid := func() map[string][]byte {
+		return map[string][]byte{
+			wellknown.AccessKey:    []byte("access"),
+			wellknown.SecretKey:    []byte("secret"),
+			wellknown.SessionToken: []byte("session"),
+		}
+	}
+	tests := []struct {
+		name     string
+		mutate   func(map[string][]byte)
+		wantErrs []string
+		want     *staticSecretDerivation
+	}{
+		{
+			name:   "all keys present",
+			mutate: func(map[string][]byte) {},
+			want:   &staticSecretDerivation{access: "access", secret: "secret", session: "session"},
+		},
+		{
+			name:   "session token absent is allowed",
+			mutate: func(d map[string][]byte) { delete(d, wellknown.SessionToken) },
+			want:   &staticSecretDerivation{access: "access", secret: "secret"},
+		},
+		{
+			name:   "session token empty is allowed",
+			mutate: func(d map[string][]byte) { d[wellknown.SessionToken] = []byte{} },
+			want:   &staticSecretDerivation{access: "access", secret: "secret"},
+		},
+		{
+			name:     "empty access key is rejected",
+			mutate:   func(d map[string][]byte) { d[wellknown.AccessKey] = []byte("") },
+			wantErrs: []string{`secret data key "accessKey" is missing or empty`},
+		},
+		{
+			name:     "empty secret key is rejected",
+			mutate:   func(d map[string][]byte) { d[wellknown.SecretKey] = []byte{} },
+			wantErrs: []string{`secret data key "secretKey" is missing or empty`},
+		},
+		{
+			name: "missing access and secret keys are both reported",
+			mutate: func(d map[string][]byte) {
+				delete(d, wellknown.AccessKey)
+				delete(d, wellknown.SecretKey)
+			},
+			wantErrs: []string{
+				`secret data key "accessKey" is missing or empty`,
+				`secret data key "secretKey" is missing or empty`,
+			},
+		},
+		{
+			name:     "invalid utf-8 access key is rejected",
+			mutate:   func(d map[string][]byte) { d[wellknown.AccessKey] = []byte{0xff, 0xfe} },
+			wantErrs: []string{`secret data key "accessKey" is not a valid UTF-8 string`},
+		},
+		{
+			name:     "invalid utf-8 session token is rejected",
+			mutate:   func(d map[string][]byte) { d[wellknown.SessionToken] = []byte{0xff} },
+			wantErrs: []string{`secret data key "sessionToken" is not a valid UTF-8 string`},
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			data := valid()
+			tt.mutate(data)
+			got, err := deriveStaticSecret(&ir.Secret{Data: data})
+			if len(tt.wantErrs) == 0 {
+				require.NoError(t, err)
+				assert.Equal(t, tt.want, got)
+				return
+			}
+			require.Error(t, err)
+			assert.Nil(t, got, "no credentials should be returned alongside a validation error")
+			assert.Equal(t, tt.wantErrs, strings.Split(err.Error(), "\n"))
+		})
+	}
+}
+
+// TestConfigureAWSAuthSecretEmptyAccessKey covers the end-to-end path from
+// issue #14736: an empty accessKey must fail translation rather than be copied
+// into an InlineCredentialProvider that Envoy rejects.
+func TestConfigureAWSAuthSecretEmptyAccessKey(t *testing.T) {
+	secret := &ir.Secret{Data: map[string][]byte{
+		wellknown.AccessKey: []byte(""),
+		wellknown.SecretKey: []byte("secret"),
+	}}
+	auth := &kgateway.AwsAuth{
+		Type:      kgateway.AwsAuthTypeSecret,
+		SecretRef: &corev1.LocalObjectReference{Name: "aws-creds"},
+	}
+	_, err := configureAWSAuth(auth, secret, "us-east-1")
+	require.EqualError(t, err, `failed to derive static secret: secret data key "accessKey" is missing or empty`)
+}
```

**File**: `pkg/kgateway/extensions2/plugins/backend/ec2_test.go` (modified, +1/-1)
```diff
@@ -131,7 +131,7 @@ func TestClassifyEc2DiscoveryError(t *testing.T) {
 	}{
 		{
 			name:       "credential error",
-			err:        &ec2CredentialError{err: errors.New("invalid aws secret: access_key is not a valid string")},
+			err:        &ec2CredentialError{err: errors.New(`invalid aws secret: secret data key "accessKey" is missing or empty`)},
 			wantReason: string(kgateway.BackendReasonCredentialError),
 		},
 		{
```

**File**: `test/e2e/features/backends/suite.go` (modified, +2/-2)
```diff
@@ -134,8 +134,8 @@ func (s *testingSuite) TestBackendWithRuntimeError() {
 		Type:   "Accepted",
 		Status: metav1.ConditionFalse,
 		Reason: "Invalid",
-		Message: `Backend error: "failed to create aws request signing config: failed to derive static secret: access_key is not a valid string
-secret_key is not a valid string"`,
+		Message: `Backend error: "failed to create aws request signing config: failed to derive static secret: secret data key "accessKey" is missing or empty
+secret data key "secretKey" is missing or empty"`,
 	})
 }
 
```

---

### Incident Patch 13: `e24f392f` (2026-09-14)
**Commit Message**: Test flakes and fixes (#14690)

Signed-off-by: Seth Heidkamp <[REDACTED_EMAIL]>

**File**: `hack/setup-localstack.sh` (modified, +2/-0)
```diff
@@ -13,6 +13,8 @@ function install_localstack() {
   $HELM repo update
 
   $HELM upgrade -i --create-namespace localstack localstack-repo/localstack --version 0.6.26 --namespace localstack -f ${ROOT_DIR}/localstack-values.yaml
+  # `kubectl wait` fails immediately when no pod matches yet, so let the rollout create it first
+  kubectl rollout status deployment/localstack --namespace localstack --timeout=120s
   kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=localstack -n localstack --timeout=120s
 }
 
```

**File**: `pkg/utils/kubeutils/kubectl/cli.go` (modified, +35/-12)
```diff
@@ -440,33 +440,56 @@ func (c *Cli) GetContainerLogs(ctx context.Context, namespace string, name strin
 	return stdout + stderr, err
 }
 
-// GetPodsInNsWithLabel returns the pods in the specified namespace with the specified label
+// GetPodsInNsWithLabel returns the pods in the specified namespace with the specified label,
+// excluding pods that are terminating to avoid counting lingering pods from the last test
+// that are in the process of being deleted.
 func (c *Cli) GetPodsInNsWithLabel(ctx context.Context, namespace string, label string) ([]string, error) {
+	return c.getPodsInNsWithLabel(ctx, namespace, label, true)
+}
+
+// GetAllPodsInNsWithLabel is GetPodsInNsWithLabel including terminating pods.
+func (c *Cli) GetAllPodsInNsWithLabel(ctx context.Context, namespace string, label string) ([]string, error) {
+	return c.getPodsInNsWithLabel(ctx, namespace, label, false)
+}
+
+func (c *Cli) getPodsInNsWithLabel(ctx context.Context, namespace string, label string, excludeTerminating bool) ([]string, error) {
 	podStdOut := bytes.NewBuffer(nil)
 	podStdErr := bytes.NewBuffer(nil)
 
-	// Fetch the names of the pods with the given label
+	// deletionTimestamp renders as the empty string unless the pod is terminating
 	getPodNamesCmd := c.Command(ctx, "get", "pod", "-n", namespace,
-		"--selector", label, "--output", "jsonpath='{.items[*].metadata.name}'")
+		"--selector", label, "--output",
+		`jsonpath={range .items[*]}{.metadata.name}{"\t"}{.metadata.deletionTimestamp}{"\n"}{end}`)
 	err := getPodNamesCmd.WithStdout(podStdOut).WithStderr(podStdErr).Run().Cause()
 	if err != nil {
 		fmt.Printf("error running get pod names command: %v\n", err)
 	}
 
-	// Clean up and check the output
-	podNamesString := strings.Trim(podStdOut.String(), "'")
-	if podNamesString == "" {
-		if !c.quiet {
-			fmt.Printf("no %s pods found in namespace %s\n", label, namespace)
-		}
-		return []string{}, nil
+	podNames := selectPodNames(podStdOut.String(), excludeTerminating)
+	if len(podNames) == 0 && !c.quiet {
+		fmt.Printf("no %s pods found in namespace %s\n", label, namespace)
 	}
 
-	// Split the string on whitespace to get the pod names
-	podNames := strings.Fields(podNamesString)
 	return podNames, nil
 }
 
+// selectPodNames reads the "<name>\t<deletionTimestamp>" lines emitted by getPodsInNsWithLabel
+// and returns the names of the pods that should be reported.
+func selectPodNames(jsonpathOutput string, excludeTerminating bool) []string {
+	podNames := []string{}
+	for line := range strings.SplitSeq(jsonpathOutput, "\n") {
+		name, deletionTimestamp, _ := strings.Cut(strings.TrimSpace(line), "\t")
+		if name == "" {
+			continue
+		}
+		if excludeTerminating && deletionTimestamp != "" {
+			continue
+		}
+		podNames = append(podNames, name)
+	}
+	return podNames
+}
+
 func (c *Cli) GetLeaseHolder(ctx context.Context, namespace string, leaderElectionID string) (string, error) {
 	stdout, stderr, err := c.Execute(ctx, "get", "leases", "-n", namespace,
 		leaderElectionID, "--output", "jsonpath='{.spec.holderIdentity}'")
```

**File**: `pkg/utils/kubeutils/kubectl/cli_test.go` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+package kubectl
+
+import (
+	"slices"
+	"testing"
+)
+
+func TestSelectPodNames(t *testing.T) {
+	// a rollout reports both the outgoing (terminating) and incoming pod
+	const rollout = "gw-6b54c85cbf-x6v7s\t2026-09-11T05:23:30Z\ngw-74f7b79947-tfz48\t\n"
+
+	tests := []struct {
+		name               string
+		jsonpathOutput     string
+		excludeTerminating bool
+		expected           []string
+	}{
+		{
+			name:               "drops terminating pod during a rollout",
+			jsonpathOutput:     rollout,
+			excludeTerminating: true,
+			expected:           []string{"gw-74f7b79947-tfz48"},
+		},
+		{
+			name:               "keeps terminating pod when not excluding",
+			jsonpathOutput:     rollout,
+			excludeTerminating: false,
+			expected:           []string{"gw-6b54c85cbf-x6v7s", "gw-74f7b79947-tfz48"},
+		},
+		{
+			name:               "no pods matched the selector",
+			jsonpathOutput:     "",
+			excludeTerminating: true,
+			expected:           []string{},
+		},
+		{
+			name:               "every pod is terminating",
+			jsonpathOutput:     "gw-a\t2026-09-11T05:23:30Z\ngw-b\t2026-09-11T05:23:31Z\n",
+			excludeTerminating: true,
+			expected:           []string{},
+		},
+		{
+			name:               "several running pods are all returned",
+			jsonpathOutput:     "gw-a\t\ngw-b\t\ngw-c\t\n",
+			excludeTerminating: true,
+			expected:           []string{"gw-a", "gw-b", "gw-c"},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			got := selectPodNames(tt.jsonpathOutput, tt.excludeTerminating)
+			if !slices.Equal(got, tt.expected) {
+				t.Errorf("selectPodNames() = %v, want %v", got, tt.expected)
+			}
+		})
+	}
+}
```

**File**: `test/e2e/features/dfp/suite.go` (modified, +8/-1)
```diff
@@ -36,8 +36,15 @@ func NewTestingSuite(ctx context.Context, testInst *e2e.TestInstallation) suite.
 	setup := base.TestCase{
 		Manifests: []string{gatewayWithRouteManifest},
 	}
+	testCases := map[string]*base.TestCase{
+		"TestDynamicForwardProxyConnectTermination": {
+			Manifests: []string{connectTerminationManifest},
+			// the manifest attaches its TrafficPolicy by sectionName, which needs a named route rule
+			MinGwApiVersion: base.GwApiRequireRouteNames,
+		},
+	}
 	return &testingSuite{
-		BaseTestingSuite: base.NewBaseTestingSuite(ctx, testInst, setup, nil),
+		BaseTestingSuite: base.NewBaseTestingSuite(ctx, testInst, setup, testCases),
 	}
 }
 
```

**File**: `test/e2e/features/dfp/testdata/common.yaml` (modified, +1/-25)
```diff
@@ -17,31 +17,7 @@ spec:
     - name: gateway
       namespace: kgateway-base
   rules:
-    - name: connect
-      matches:
-        - method: CONNECT
-      backendRefs:
+    - backendRefs:
         - name: dfp-backend
           group: gateway.kgateway.dev
           kind: Backend
-    - name: http
-      backendRefs:
-        - name: dfp-backend
-          group: gateway.kgateway.dev
-          kind: Backend
----
-apiVersion: gateway.kgateway.dev/v1alpha1
-kind: TrafficPolicy
-metadata:
-  name: dfp-connect-termination
-  namespace: kgateway-base
-spec:
-  targetRefs:
-    - group: gateway.networking.k8s.io
-      kind: HTTPRoute
-      name: route-dfp
-      sectionName: connect
-  httpUpgrade:
-    - type: CONNECT
-      connect:
-        terminate: true
```

**File**: `test/e2e/features/dfp/testdata/connect-termination.yaml` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+# CONNECT requests hit Envoy's dedicated connect matcher, so they need their own route rather
+# than the catch-all rule in common.yaml.
+apiVersion: gateway.networking.k8s.io/v1
+kind: HTTPRoute
+metadata:
+  namespace: kgateway-base
+  name: route-dfp-connect
+spec:
+  parentRefs:
+    - name: gateway
+      namespace: kgateway-base
+  rules:
+    - name: connect
+      matches:
+        - method: CONNECT
+      backendRefs:
+        - name: dfp-backend
+          group: gateway.kgateway.dev
+          kind: Backend
+---
+apiVersion: gateway.kgateway.dev/v1alpha1
+kind: TrafficPolicy
+metadata:
+  name: dfp-connect-termination
+  namespace: kgateway-base
+spec:
+  targetRefs:
+    - group: gateway.networking.k8s.io
+      kind: HTTPRoute
+      name: route-dfp-connect
+      sectionName: connect
+  httpUpgrade:
+    - type: CONNECT
+      connect:
+        terminate: true
```

**File**: `test/e2e/features/dfp/types.go` (modified, +8/-2)
```diff
@@ -8,5 +8,11 @@ import (
 	"github.com/kgateway-dev/kgateway/v2/pkg/utils/fsutils"
 )
 
-// gatewayWithRouteManifest contains the DFP Backend and the HTTPRoute that targets it
-var gatewayWithRouteManifest = filepath.Join(fsutils.MustGetThisDir(), "testdata", "common.yaml")
+var (
+	// gatewayWithRouteManifest contains the DFP Backend and the HTTPRoute that targets it
+	gatewayWithRouteManifest = filepath.Join(fsutils.MustGetThisDir(), "testdata", "common.yaml")
+
+	// connectTerminationManifest contains the CONNECT route and the TrafficPolicy that
+	// terminates CONNECT on it
+	connectTerminationManifest = filepath.Join(fsutils.MustGetThisDir(), "testdata", "connect-termination.yaml")
+)
```

**File**: `test/e2e/features/listener_policy/suite.go` (modified, +7/-4)
```diff
@@ -196,16 +196,19 @@ func (s *testingSuite) TestAccessLogEmittedToStdout() {
 	)
 
 	// Fetch gateway pod logs and verify the 404 access log JSON fields are present
+	ns := proxyDeployment.ObjectMeta.GetNamespace()
 	pods, err := s.TestInstallation.Actions.Kubectl().GetPodsInNsWithLabel(
-		s.Ctx, proxyDeployment.ObjectMeta.GetNamespace(),
+		s.Ctx, ns,
 		testdefaults.WellKnownAppLabel+"="+proxyDeployment.ObjectMeta.GetName(),
 	)
 	s.Require().NoError(err)
 	s.Require().Len(pods, 1)
 
 	s.Require().EventuallyWithT(func(c *assert.CollectT) {
-		logs, err := s.TestInstallation.Actions.Kubectl().GetContainerLogs(s.Ctx, proxyDeployment.ObjectMeta.GetNamespace(), pods[0])
-		s.Require().NoError(err)
+		logs, err := s.TestInstallation.Actions.Kubectl().GetContainerLogs(s.Ctx, ns, pods[0])
+		if !assert.NoError(c, err) {
+			return
+		}
 		// Check a few key fields configured in http-listener-policy-access-log.yaml jsonFormat
 		assert.Contains(c, logs, "\"method\":\"GET\"")
 		assert.Contains(c, logs, "\"protocol\":\"HTTP/1.1\"")
@@ -228,7 +231,7 @@ func (s *testingSuite) TestAccessLogEmittedToStdout() {
 	// Confirm 200 logs do not appear over a stability window as it isn't being immediately emitted
 	g := gomega.NewWithT(s.T())
 	g.Consistently(func() string {
-		out, err := s.TestInstallation.Actions.Kubectl().GetContainerLogs(s.Ctx, proxyDeployment.ObjectMeta.GetNamespace(), pods[0])
+		out, err := s.TestInstallation.Actions.Kubectl().GetContainerLogs(s.Ctx, ns, pods[0])
 		s.Require().NoError(err)
 		return out
 	}, 10*time.Second, 200*time.Millisecond).ShouldNot(gomega.ContainSubstring("\"response_code\":200"))
```

---

### Incident Patch 14: `e1bbcba7` (2026-09-12)
**Commit Message**: fix(deployer): merge gmsaCredentialSpecName from its own field (#14660)

Signed-off-by: Max Freedom Pollard <[REDACTED_EMAIL]>

**File**: `pkg/deployer/merge.go` (modified, +1/-1)
```diff
@@ -203,7 +203,7 @@ func deepMergeWindowsSecurityContextOptions(dst, src *corev1.WindowsSecurityCont
 		return src
 	}
 
-	dst.GMSACredentialSpecName = MergePointers(dst.GMSACredentialSpec, src.GMSACredentialSpec)
+	dst.GMSACredentialSpecName = MergePointers(dst.GMSACredentialSpecName, src.GMSACredentialSpecName)
 	dst.GMSACredentialSpec = MergePointers(dst.GMSACredentialSpec, src.GMSACredentialSpec)
 	dst.RunAsUserName = MergePointers(dst.RunAsUserName, src.RunAsUserName)
 	dst.HostProcess = MergePointers(dst.HostProcess, src.HostProcess)
```

**File**: `pkg/deployer/merge_test.go` (modified, +68/-0)
```diff
@@ -607,3 +607,71 @@ func TestDeepMergeImage(t *testing.T) {
 		})
 	}
 }
+
+func TestDeepMergeSecurityContextWindowsOptions(t *testing.T) {
+	const gmsaSpec = `{"apiVersion":"windows.k8s.io/v1","kind":"GMSACredentialSpec"}`
+
+	tests := []struct {
+		name string
+		dst  *corev1.WindowsSecurityContextOptions
+		src  *corev1.WindowsSecurityContextOptions
+		want *corev1.WindowsSecurityContextOptions
+	}{
+		{
+			name: "src gmsaCredentialSpecName overrides dst",
+			dst: &corev1.WindowsSecurityContextOptions{
+				GMSACredentialSpecName: new("default-gmsa"),
+				RunAsUserName:          new("default-user"),
+			},
+			src: &corev1.WindowsSecurityContextOptions{
+				GMSACredentialSpecName: new("override-gmsa"),
+			},
+			want: &corev1.WindowsSecurityContextOptions{
+				GMSACredentialSpecName: new("override-gmsa"),
+				RunAsUserName:          new("default-user"),
+			},
+		},
+		{
+			name: "dst gmsaCredentialSpecName is kept when src does not set it",
+			dst: &corev1.WindowsSecurityContextOptions{
+				GMSACredentialSpecName: new("default-gmsa"),
+			},
+			src: &corev1.WindowsSecurityContextOptions{
+				RunAsUserName: new("override-user"),
+			},
+			want: &corev1.WindowsSecurityContextOptions{
+				GMSACredentialSpecName: new("default-gmsa"),
+				RunAsUserName:          new("override-user"),
+			},
+		},
+		{
+			name: "gmsaCredentialSpec does not leak into gmsaCredentialSpecName",
+			dst: &corev1.WindowsSecurityContextOptions{
+				GMSACredentialSpec: new(gmsaSpec),
+			},
+			src: &corev1.WindowsSecurityContextOptions{
+				GMSACredentialSpecName: new("override-gmsa"),
+			},
+			want: &corev1.WindowsSecurityContextOptions{
+				GMSACredentialSpecName: new("override-gmsa"),
+				GMSACredentialSpec:     new(gmsaSpec),
+			},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			got := DeepMergeSecurityContext(
+				&corev1.SecurityContext{WindowsOptions: tt.dst.DeepCopy()},
+				&corev1.SecurityContext{WindowsOptions: tt.src.DeepCopy()},
+			)
+			assert.Equal(t, tt.want, got.WindowsOptions, "container securityContext.windowsOptions")
+
+			gotPod := deepMergePodSecurityContext(
+				&corev1.PodSecurityContext{WindowsOptions: tt.dst.DeepCopy()},
+				&corev1.PodSecurityContext{WindowsOptions: tt.src.DeepCopy()},
+			)
+			assert.Equal(t, tt.want, gotPod.WindowsOptions, "pod securityContext.windowsOptions")
+		})
+	}
+}
```

---

### Incident Patch 15: `09e50467` (2026-09-11)
**Commit Message**: fix: re-derive xDS client identity per request (#14582)

Signed-off-by: David L. Chandler <[REDACTED_EMAIL]>

**File**: `.github/workflows/e2e.yaml` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@ jobs:
           # May 29, 2026: ~4 minutes
           - cluster-name: 'cluster-seven'
             go-test-args: '-timeout=25m'
-            go-test-run-regex: '^TestAPIValidation$$|^TestKgateway$$/^OAuth$$|^TestKgateway$$/^TrafficPolicyStatus$$|^TestKgateway$$/^XdsStarvation$$'
+            go-test-run-regex: '^TestAPIValidation$$|^TestKgateway$$/^OAuth$$|^TestKgateway$$/^TrafficPolicyStatus$$|^TestKgateway$$/^XdsStarvation$$|^TestKgateway$$/^XdsIdentityRace$$'
             localstack: 'false'
             ordered-ads: 'false'
           # May 29, 2026: ~5 minutes
```

**File**: `pkg/krtcollections/uniqueclients.go` (modified, +144/-43)
```diff
@@ -68,11 +68,20 @@ func xdsFirstConnectDelay() time.Duration {
 
 type ConnectedClient struct {
 	uniqueClientName string
+	// originalRole is the role as presented on the stream's FIRST request,
+	// before newStream rewrites the node metadata to the unique cache key.
+	// Follow-up SotW requests often omit Node, and go-control-plane then
+	// reuses the mutated Node object — so per-request identity re-derivation
+	// must start from this pinned role, never from the node's (possibly
+	// already-augmented) one, or augmentation compounds and every ACK looks
+	// like an identity change.
+	originalRole string
 }
 
-func newConnectedClient(uniqueClientName string) ConnectedClient {
+func newConnectedClient(uniqueClientName, originalRole string) ConnectedClient {
 	return ConnectedClient{
 		uniqueClientName: uniqueClientName,
+		originalRole:     originalRole,
 	}
 }
 
@@ -272,46 +281,145 @@ func NormalizeGatewayRole(originalRole, namespace string, labels map[string]stri
 	return xds.OwnerNamespaceNameID(wellknown.GatewayApiProxyValue, namespace, gwName)
 }
 
-func (x *callbacksCollection) add(sid int64, r *envoy_service_discovery_v3.DiscoveryRequest, peer peerInfo) (ucName string, newStream bool, err error) {
-	var pod *LocalityPod
+// deriveClientIdentity resolves the client's identity (role, namespace,
+// labels, locality) from the CURRENT pod state. The pod lookup is a
+// point-in-time read outside KRT dependency tracking — nothing re-runs this
+// when the pod changes — so callers must re-derive per request (see add) to
+// keep a stream's identity from being frozen on data that was stale at
+// connect time.
+func (x *callbacksCollection) deriveClientIdentity(r *envoy_service_discovery_v3.DiscoveryRequest, peer peerInfo) (*ir.UniquelyConnectedClient, error) {
+	var locality ir.PodLocality
+	var ns string
+	var labels map[string]string
 	// see if user wants to use pod locality info; this is only possible when podRef is set in getPeerInfo
 	if peer.podRef != nil {
 		k := krt.Named{Name: peer.podRef.Name, Namespace: peer.podRef.Namespace}.ResourceName()
-		pod = x.augmentedPods.GetKey(k)
+		pod := x.augmentedPods.GetKey(k)
+		if pod == nil {
+			// we need to use the pod locality info, so it's an error if we can't get the pod.
+			// Only the node id goes in the message: this error is constructed on
+			// every request while the pod is absent (and discarded on established
+			// streams), so formatting the full Node proto here would be pure waste.
+			return nil, fmt.Errorf("pod not found for node %q", r.GetNode().GetId())
+		}
+		locality = pod.Locality
+		ns = pod.Namespace
+		labels = pod.AugmentedLabels
+		peer.role = NormalizeGatewayRole(peer.role, ns, labels)
 	}
-	x.stateLock.Lock()
-	defer x.stateLock.Unlock()
+	ucc := ir.NewUniquelyConnectedClient(peer.role, ns, labels, locality)
+	return &ucc, nil
+}
+
+func (x *callbacksCollection) add(sid int64, r *envoy_service_discovery_v3.DiscoveryRequest, peer peerInfo) (ucName string, newStream bool, err error) {
+	// Identity is re-derived from current pod state on EVERY request, not just
+	// the first. A stream's first request can race the pod/node informers
+	// (controller start is exactly when every Envoy reconnects), freezing an
+	// identity built from stale or incomplete labels/locality — wrong
+	// DestinationRule selection and failover priorities for the stream's
+	// whole lifetime, with nothing to ever correct it short of an Envoy
+	// restart. The derivation is a map lookup plus a label hash, and stream
+	// requests are infrequent.
+	//
+	// deriveClientIdentity does an augmentedPods.GetKey lookup and a label
+	// hash (NewUniquelyConnectedClient), neither of which touches our shared
+	// maps — so it runs WITHOUT stateLock held. Keeping it inside the
+	// critical section would serialize every concurrent xDS stream behind one
+	// client's pod lookup. We hold the lock only to read the per-stream entry
+	// up front and to mutate the maps at the end. go-control-plane serializes
+	// callbacks for a single stream id, so this stream's clients[sid] entry
+	// can't change underneath us between those two sections.
+	x.stateLock.RLock()
 	c, ok := x.clients[sid]
-	if !ok {
-		if err := logAndCheckEnvoyVersion(x.logger, r.GetNode()); err != nil {
-			return "", false, err
-		}
-		var locality ir.PodLocality
-		var ns string
-		var labels map[string]string
-		if peer.podRef != nil {
-			if pod == nil {
-				// we need to use the pod locality info, so it's an error if we can't get the pod
-				return "", false, fmt.Errorf("pod not found for node %v", r.GetNode())
-			} else {
-				locality = pod.Locality
-				ns = pod.Namespace
-				labels = pod.AugmentedLabels
-				peer.role = NormalizeGatewayRole(peer.role, ns, labels)
-			}
+	x.stateLock.RUnlock()
+	if ok {
+		// Follow-up request on an established stream: when xDS auth is
+		// disabled the role comes from node metadata, and the Node object may
+		// be the one newStream already mutated to
```

**File**: `pkg/krtcollections/uniqueclients_test.go` (modified, +292/-0)
```diff
@@ -414,6 +414,298 @@ func TestUniqueClientsLocalClusterCapabilityGatingSharedBucket(t *testing.T) {
 	}).Should(BeTrue(), "the remaining stream already confirmed support")
 }
 
+// A stream's identity is derived from pod data that can be stale at connect
+// time (informer lag during controller start — exactly when every Envoy
+// reconnects). The identity cannot be changed in place for an open stream
+// (the snapshot cache key is bound to it), so when the freshly derived
+// identity differs, the stream must be REJECTED so the client reconnects and
+// re-identifies against current state — instead of serving wrong
+// locality/label-derived config until an Envoy restart.
+// go-control-plane reuses the first request's Node object for follow-up SotW
+// requests that omit Node — including the role newStream rewrote in place to
+// the unique cache key. Follow-up identity re-derivation must start from the
+// stream's pinned original role: otherwise, for pods without a gateway-name
+// label (where NormalizeGatewayRole is a passthrough), the already-augmented
+// role re-augments into a different resource name and every ACK closes the
+// stream as a false identity change.
+func TestUniqueClientsFollowUpWithReusedAugmentedNode(t *testing.T) {
+	t.Cleanup(SetXdsFirstConnectDelayForTest(0))
+	g := NewWithT(t)
+	ctx := context.Background()
+
+	role := wellknown.GatewayApiProxyValue + "~best-proxy-role"
+	labels := map[string]string{"a": "b"} // deliberately no gateway-name label
+	driftedLabels := map[string]string{"a": "b", corev1.LabelTopologyZone: "zone-1"}
+
+	pods := krt.NewStaticCollection[LocalityPod](nil, []LocalityPod{{
+		Named:           krt.Named{Name: "podname", Namespace: "ns"},
+		AugmentedLabels: labels,
+	}})
+
+	cb, uccBuilder := NewUniquelyConnectedClients(nil, false)
+	ucc := uccBuilder(ctx, krtutil.KrtOptions{}, pods)
+	ucc.WaitUntilSynced(ctx.Done())
+
+	req := &envoy_service_discovery_v3.DiscoveryRequest{
+		Node: &envoycorev3.Node{
+			Id: "podname.ns",
+			Metadata: &structpb.Struct{
+				Fields: map[string]*structpb.Value{
+					xds.RoleKey: structpb.NewStringValue(role),
+				},
+			},
+		},
+	}
+	uniqueName := fmt.Sprintf("%s~%d~ns", role, utils.HashLabels(labels))
+
+	// The first request rewrites req's Node role in place to the unique key.
+	g.Expect(cb.OnStreamRequest(1, req)).To(Succeed())
+	g.Expect(req.GetNode().GetMetadata().GetFields()[xds.RoleKey].GetStringValue()).To(Equal(uniqueName),
+		"newStream must have augmented the node role in place")
+
+	// Follow-ups reuse the SAME mutated request object (as go-control-plane
+	// does). They must not read as identity changes.
+	for range 3 {
+		g.Expect(cb.OnStreamRequest(1, req)).To(Succeed(),
+			"an ACK carrying the reused augmented node must not close the stream")
+	}
+	g.Eventually(func() []ir.UniquelyConnectedClient { return ucc.List() }, "1s").Should(HaveLen(1))
+	g.Expect(ucc.List()[0].ResourceName()).To(Equal(uniqueName))
+
+	// Genuine pod-state drift must still be detected through the reused node.
+	pods.UpdateObject(LocalityPod{
+		Named:           krt.Named{Name: "podname", Namespace: "ns"},
+		AugmentedLabels: driftedLabels,
+	})
+	g.Expect(cb.OnStreamRequest(1, req)).To(MatchError(ContainSubstring("xds client identity changed")),
+		"real label drift must still close the stream even with a reused node")
+}
+
+func TestUniqueClientsReidentifyOnPodChange(t *testing.T) {
+	t.Cleanup(SetXdsFirstConnectDelayForTest(0))
+	g := NewWithT(t)
+	ctx := context.Background()
+
+	role := wellknown.GatewayApiProxyValue + "~best-proxy-role"
+	staleLabels := map[string]string{"a": "b"}
+	freshLabels := map[string]string{"a": "b", corev1.LabelTopologyZone: "zone-1"}
+
+	pods := krt.NewStaticCollection[LocalityPod](nil, []LocalityPod{{
+		Named:           krt.Named{Name: "podname", Namespace: "ns"},
+		AugmentedLabels: staleLabels,
+	}})
+
+	cb, uccBuilder := NewUniquelyConnectedClients(nil, false)
+	ucc := uccBuilder(ctx, krtutil.KrtOptions{}, pods)
+	ucc.WaitUntilSynced(ctx.Done())
+
+	req := &envoy_service_discovery_v3.DiscoveryRequest{
+		Node: &envoycorev3.Node{
+			Id: "podname.ns",
+			Metadata: &structpb.Struct{
+				Fields: map[string]*structpb.Value{
+					xds.RoleKey: structpb.NewStringValue(role),
+				},
+			},
+		},
+	}
+	cloneReq := func() *envoy_service_discovery_v3.DiscoveryRequest {
+		return proto.Clone(req).(*envoy_service_discovery_v3.DiscoveryRequest)
+	}
+
+	staleName := fmt.Sprintf("%s~%d~ns", role, utils.HashLabels(staleLabels))
+	freshName := fmt.Sprintf("%s~%d~ns", role, utils.HashLabels(freshLabels))
+
+	// First contact freezes the identity derived from current (stale) data.
+	g.Expect(cb.OnStreamRequest(1, cloneReq())).To(Succeed())
+	g.Eventually(func() []ir.UniquelyConnectedClient { return ucc.List() }, "1s").Should(HaveLen(1))
+	g.Expect(ucc.List()[0].ResourceName()).To(Equal(staleName))
+
+	// The pod's augmented data catches up while the stream is open.
+	pods.UpdateObject(LocalityPod{
+		Named:  
```

**File**: `test/e2e/features/xdsidentityrace/suite.go` (added, +225/-0)
```diff
@@ -0,0 +1,225 @@
+//go:build e2e
+
+package xdsidentityrace
+
+import (
+	"context"
+	"fmt"
+	"regexp"
+	"strings"
+	"time"
+
+	"github.com/onsi/gomega"
+	"github.com/stretchr/testify/suite"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/util/sets"
+
+	"github.com/kgateway-dev/kgateway/v2/pkg/utils/kubeutils/kubectl"
+	"github.com/kgateway-dev/kgateway/v2/test/controllerutils/admincli"
+	"github.com/kgateway-dev/kgateway/v2/test/e2e"
+	"github.com/kgateway-dev/kgateway/v2/test/e2e/defaults"
+	"github.com/kgateway-dev/kgateway/v2/test/e2e/tests/base"
+	"github.com/kgateway-dev/kgateway/v2/test/helpers"
+)
+
+var _ e2e.NewSuiteFunc = NewTestingSuite
+
+// identityChangeLog is the controller log emitted when a connected Envoy's
+// re-derived identity no longer matches the one its stream opened with. This
+// line is the proof that the per-request re-derivation fired and closed the
+// stream so the client could re-identify; it is absent in the pre-fix behavior
+// (identity frozen on the first request).
+const identityChangeLog = "xds client identity changed; closing stream"
+
+// uccNameRE matches a UniquelyConnectedClient resource name belonging to the base
+// "gateway" proxy in kgateway-base. The format is
+// role~hash(AugmentedLabels)~namespace, i.e.
+// kgateway-kube-gateway-api~<ns>~<gw>~<hash>~<ns>. Only the hash varies when the
+// proxy pod's labels change, so capturing the full name lets us assert that the
+// identity transitioned without recomputing the hash ourselves. The same name is
+// the node-id key under which the proxy's xDS snapshot is published.
+var uccNameRE = regexp.MustCompile(`kgateway-kube-gateway-api~kgateway-base~gateway~\d+~kgateway-base`)
+
+// testingSuite exercises the xDS client-identity re-derivation end-to-end: a
+// connected Envoy whose pod labels drift after the stream is established must
+// have its stream closed and re-identified against current state, rather than
+// serving config bound to the stale identity for the stream's lifetime.
+//
+// All signals are read from the controller's xDS snapshot admin endpoint and the
+// controller logs, reached via port-forward. We deliberately avoid curling the
+// gateway's LoadBalancer address, which is not routable from the host on local
+// kind.
+//
+// The KRT snapshot endpoint would be the more direct read of UCC membership, but
+// it is deliberately not used: it marshals every registered collection in a
+// single json.Marshal (see krt.DebugHandler.MarshalJSON), so any one
+// unmarshalable object anywhere in the process turns the whole endpoint into a
+// 500 whose body is a "json: ..." error string. That coupling has nothing to do
+// with what this suite tests.
+type testingSuite struct {
+	*base.BaseTestingSuite
+}
+
+func NewTestingSuite(ctx context.Context, testInst *e2e.TestInstallation) suite.TestingSuite {
+	return &testingSuite{
+		BaseTestingSuite: base.NewBaseTestingSuite(ctx, testInst, setup, testCases),
+	}
+}
+
+// TestReidentifyOnPodLabelDrift artificially manipulates the startup race the
+// fix is designed to heal. The race: a stream's first xDS request can be
+// processed before the pod informer has surfaced the proxy pod's full labels,
+// freezing a stale identity. We can't control informer-vs-request timing in a
+// live cluster, but the identity is a pure function of the pod's labels
+// (resource name = role~hash(AugmentedLabels)~ns), so we inject a label the
+// "first request missed" AFTER the stream is established. We then force an xDS
+// push so the established stream re-derives, detects the drift, closes, and the
+// Envoy reconnects under the corrected identity.
+func (s *testingSuite) TestReidentifyOnPodLabelDrift() {
+	ctx := s.Ctx
+	a := s.TestInstallation.AssertionsT(s.T())
+
+	controllerNamespace := s.TestInstallation.Metadata.InstallNamespace
+	controllerMeta := metav1.ObjectMeta{
+		Name:      helpers.DefaultKgatewayDeploymentName,
+		Namespace: controllerNamespace,
+	}
+
+	// The stream is established when the proxy connects to xDS and a snapshot is
+	// published under its identity. Capture the identities present now, so we can
+	// later require one that is genuinely new.
+	var preNodes sets.Set[string]
+	a.AssertKgatewayAdminApi(ctx, controllerMeta,
+		func(ctx context.Context, adminClient *admincli.Client) {
+			a.Gomega.Eventually(func(g gomega.Gomega) {
+				preNodes = proxyXdsNodes(g, ctx, adminClient)
+				g.Expect(preNodes.Len()).To(gomega.BeNumerically(">", 0), "proxy xDS snapshot present (stream established)")
+			}).WithContext(ctx).WithTimeout(60 * time.Second).WithPolling(2 * time.Second).Should(gomega.Succeed())
+		})
+
+	// Locate the single Running proxy pod whose labels feed the identity hash.
+	// The field selector keeps a Terminating pod from an earlier rollout from
+	// tripping the exactly-one check.
+	podsOut, _, err := s.TestInstallation.Actions.Kubectl().Execute(ctx,
+		"get", "pod", "-n", gwNamespace,
+		"--selector", "ga
```

**File**: `test/e2e/features/xdsidentityrace/testdata/route1.yaml` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+apiVersion: gateway.networking.k8s.io/v1
+kind: HTTPRoute
+metadata:
+  name: xdsrace-route1
+  namespace: kgateway-base
+spec:
+  parentRefs:
+    - name: gateway
+      namespace: kgateway-base
+  hostnames:
+    - "xdsrace.example.com"
+  rules:
+    - matches:
+        - path:
+            type: PathPrefix
+            value: /route1
+      backendRefs:
+        # The shared backend deployed by the base TestKgateway setup in
+        # kgateway-base; this route only exists to force xDS pushes.
+        - name: backend
+          port: 80
```

**File**: `test/e2e/features/xdsidentityrace/testdata/route2.yaml` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+apiVersion: gateway.networking.k8s.io/v1
+kind: HTTPRoute
+metadata:
+  name: xdsrace-route2
+  namespace: kgateway-base
+spec:
+  parentRefs:
+    - name: gateway
+      namespace: kgateway-base
+  hostnames:
+    - "xdsrace.example.com"
+  rules:
+    - matches:
+        - path:
+            type: PathPrefix
+            value: /route2
+      backendRefs:
+        # The shared backend deployed by the base TestKgateway setup in
+        # kgateway-base; this route only exists to force xDS pushes.
+        - name: backend
+          port: 80
```

**File**: `test/e2e/features/xdsidentityrace/types.go` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+//go:build e2e
+
+package xdsidentityrace
+
+import (
+	"path/filepath"
+
+	"github.com/kgateway-dev/kgateway/v2/pkg/utils/fsutils"
+	"github.com/kgateway-dev/kgateway/v2/test/e2e/tests/base"
+)
+
+const (
+	// The shared gateway proxy deployment created by the deployer for the base
+	// "gateway" Gateway in kgateway-base.
+	gwNamespace = "kgateway-base"
+	gwName      = "gateway"
+)
+
+var (
+	// manifests. The routes reference the shared `backend` Service that the base
+	// TestKgateway setup deploys in kgateway-base — they exist only to force xDS
+	// pushes, traffic is never sent through them.
+	route1Manifest = filepath.Join(fsutils.MustGetThisDir(), "testdata", "route1.yaml")
+	// route2 is applied mid-test (not at BeforeTest) to force an xDS push onto the
+	// already-established stream, so it is intentionally not part of any TestCase.
+	route2Manifest = filepath.Join(fsutils.MustGetThisDir(), "testdata", "route2.yaml")
+
+	setup = base.TestCase{
+		Manifests: []string{route1Manifest},
+	}
+
+	testCases = map[string]*base.TestCase{
+		// route2 is applied by the test body, so no per-test manifests here.
+		"TestReidentifyOnPodLabelDrift": {},
+	}
+)
```

**File**: `test/e2e/tests/kgateway/suite_runner.go` (modified, +2/-0)
```diff
@@ -50,6 +50,7 @@ import (
 	"github.com/kgateway-dev/kgateway/v2/test/e2e/features/transformation"
 	"github.com/kgateway-dev/kgateway/v2/test/e2e/features/websocket"
 	"github.com/kgateway-dev/kgateway/v2/test/e2e/features/xds_starvation"
+	"github.com/kgateway-dev/kgateway/v2/test/e2e/features/xdsidentityrace"
 )
 
 // SuiteRunner returns the suite runner for the TestKgateway scenario.
@@ -115,6 +116,7 @@ func SuiteRunner() e2e.SuiteRunner {
 	kubeGatewaySuiteRunner.Register("OAuth", oauth.NewTestingSuite)
 	kubeGatewaySuiteRunner.Register("WebSocket", websocket.NewTestingSuite)
 	kubeGatewaySuiteRunner.Register("XdsStarvation", xds_starvation.NewTestingSuite)
+	kubeGatewaySuiteRunner.Register("XdsIdentityRace", xdsidentityrace.NewTestingSuite)
 
 	return kubeGatewaySuiteRunner
 }
```

#### Recent Merged Pull Requests:
- **PR #14788** (2026-10-05): [2.4] fix(endpoints): keep the weight of locality groups without a locality (@puertomontt)
- **PR #14786** (2026-10-05): fix(ir): compare pointer backend collections with Equals (@puertomontt)
- **PR #14776** (closed): fix: disable implicit zone-aware routing instead of defaulting to locality-weighted LB (@puertomontt)
- **PR #14775** (2026-10-05): fix(endpoints): keep the weight of locality groups without a locality (@puertomontt)
- **PR #14771** (2026-09-30): chore: bump Gateway API to v1.6.2 (@puertomontt)
- **PR #14770** (2026-10-05): test: rebuild dummy-idp image when its sources change (@chandler-solo)
- **PR #14768** (2026-09-28): test: fold e2e extproc server into the root Go module (@chandler-solo)
- **PR #14765** (2026-09-28): bump: go 1.26.8 (@chandler-solo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
