> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kgateway-dev-kgateway-learnings.md`  
> **Source**: github ([https://github.com/kgateway-dev/kgateway](https://github.com/kgateway-dev/kgateway))  
> **Source Version**: `40bddf72`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-22T19:29:18.728Z  
> **Learning ID**: `learn-github-kgateway-dev-kgateway`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): kgateway-dev/kgateway

> **Canonical Artifact**: `07_PROJECT_LEARNING/kgateway-dev-kgateway-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kgateway-dev/kgateway](https://github.com/kgateway-dev/kgateway))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-22T19:29:17.654Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kgateway-dev/kgateway`
- **Description**: The Cloud-Native API Gateway and AI Gateway
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 5723 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #14874** (2026-10-22): **HTTPRoute validation**
  *Symptoms*: Close issue. Wrong repo

- **Issue #14868** (2026-10-21): **test(proxy_syncer): wait for derived rows in TestUnsupportedBackendTranslationIsRecordedAsErrored**
  *Symptoms*: # Description  `TestUnsupportedBackendTranslationIsRecordedAsErrored` (#14692) fails intermittently under load with `status must see the unsupported backend's error`. It waits for the base and per-client collections, then reads two derived results once:  - **The status row of each unsupported backend.** `StatusClusters` is a join derived from the base rows, and synced base rows don't mean it has caught up, so under load the row can still be missing. - **The per-client row.** The wait accepted any row with one cluster. A row built before the last base rows arrived also matches, but it lacks some errored backends, so the errored-set assertion could fail the same way.  The test now waits for the per-client row to track all three errored backends, and waits for each status row before checking it. Test only.  # Change Type  /kind flake  # Changelog  ```release-note NONE ```  # Additional Notes  - With eight CPU-bound processes running, the test failed once in 1,200 runs before the change (`-count=400 -cpu=1,2,4`) and passed all 3,600 runs after it (`-count=1200 -cpu=1,2,4`). Without that load it didn't fail in 600 runs. - `make analyze` reports 0 issues.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

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

### Incident Patch 1: `40bddf72` (2026-10-22)
**Commit Message**: fix(xds): bound per-client publication and preserve coherent snapshots (#14698)

Signed-off-by: David L. Chandler <[REDACTED_EMAIL]>
Signed-off-by: omar <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>
Co-authored-by: Omar Hammami <[REDACTED_EMAIL]>

**File**: `api/settings/settings.go` (modified, +69/-0)
```diff
@@ -352,6 +352,75 @@ type Settings struct {
 	// Enables setting the `dev.kgateway.auth_policy:auth_succeeded=true` dynamic metadata on successfully-authenticated routes.
 	EnableAuthMetadata bool `split_words:"true" default:"false"`
 
+	// PerClientPublishBudget bounds how long per-client xDS publication may be
+	// withheld while referenced clusters are not ready. A build whose referenced
+	// clusters are all in CDS with derived endpoints publishes at once. Derived
+	// endpoints may be empty, which is the backend's real state; endpoints not
+	// yet derived are a gap.
+	//
+	//   - first publish: a client not yet published on its current connection
+	//     gets the latest deferred snapshot at expiry, so a new gateway pod gets
+	//     listeners instead of crash-looping; routes to unready clusters return
+	//     503 until ready. The budget starts when the gate receives the
+	//     client's first deferred build, not at connect; a client that left
+	//     mid-withhold less than a budget earlier resumes its start. A warm
+	//     client stays withheld while referenced clusters are missing from CDS,
+	//     for at most PerClientWarmWithholdBound after expiry. If its only gaps
+	//     are underived endpoints, it publishes at expiry and keeps the endpoints
+	//     it holds: such gaps may never converge, and withholding would freeze
+	//     its config.
+	//   - flip release: a route flip held for a newly-referenced unready
+	//     cluster publishes one budget after the hold began, so it cannot pin
+	//     route, listener and secret updates indefinitely.
+	//
+	// A client is warm when its first listener request on the connection
+	// carries a previously accepted version. That suggests, but does not prove,
+	// that it still serves that config.
+	//
+	// The budget times installation in the controller's xDS cache. It is not a
+	// deadline for a pod to go Ready, or for Envoy to receive or apply config:
+	// translation before the first deferred build, KGW_XDS_FIRST_CONNECT_DELAY,
+	// delivery, Envoy's fetch timeouts and cluster warming all add to it. Keep
+	// it well below the proxy's startup probe window (60s by default); above
+	// it, the first publish comes too late and the crash loop returns.
+	//
+	// 0 or a negative value removes both deadlines: an unpublished client waits
+	// for a coherent build, and a held flip for its cluster, indefinitely.
+	// PerClientWarmWithholdBound then has no effect. Timers that other settings
+	// configure keep running.
+	PerClientPublishBudget time.Duration `split_words:"true" default:"15s"`
+
+	// PerClientWarmWithholdBound bounds how long a warm client (see
+	// PerClientPublishBudget) stays withheld because referenced clusters are
+	// missing from CDS. Without it, a cluster that never appears would freeze
+	// the client's config, including certificate rotations, until the proxy
+	// restarts. The withhold starts when the first-publish budget expires and
+	// resumes if the client reconnects within the bound. At the bound the
+	// latest deferred snapshot publishes, and routes to missing clusters fail
+	// until they appear.
+	//
+	// It separately bounds how long a published client is still sent a missing
+	// cluster's last config (make-before-break carry), so stale endpoints are
+	// not served forever. Each carried cluster's clock starts with the first
+	// build that lacks it and stops when it returns.
+	//
+	// Keep it well above how long translation takes to catch up after a
+	// controller restart; a shorter bound fails warm routes on every restart.
+	// Applies only while PerClientPublishBudget is positive. 0 or a negative
+	// value removes the bound: warm clients stay withheld, and missing clusters
+	// are carried, indefinitely.
+	PerClientWarmWithholdBound time.Duration `split_words:"true" default:"10m"`
+
+	// XdsSnapshotConsistencyCheck checks each per-client snapshot before
+	// publish for EDS or RDS resources that no CDS or LDS resource references
+	// (Envoy never requests them) and for listeners naming a missing
+	// RouteConfiguration.
+	// Violations are logged and counted in
+	// kgateway_xds_snapshot_perclient_inconsistent_snapshots_total; any
+	// increment is a kgateway bug. The snapshot still publishes: blocking would
+	// reintroduce unbounded withholds. For test and CI; off by default.
+	XdsSnapshotConsistencyCheck bool `split_words:"true" default:"false"`
+
 	// ReferenceGrantMode controls how cross-namespace references are validated via ReferenceGrant.
 	// Supported values are:
 	// - "OFF": No ReferenceGrant validation. All cross-namespace references are permitted.
```

**File**: `api/settings/settings_test.go` (modified, +13/-3)
```diff
@@ -54,6 +54,9 @@ func allEnvVarsSet() map[string]string {
 		"KGW_XDS_TLS":                                   "true",
 		"KGW_ENABLE_EXPERIMENTAL_GATEWAY_API_FEATURES":  "false",
 		"KGW_ENABLE_AUTH_METADATA":                      "true",
+		"KGW_PER_CLIENT_PUBLISH_BUDGET":                 "90s",
+		"KGW_PER_CLIENT_WARM_WITHHOLD_BOUND":            "20m",
+		"KGW_XDS_SNAPSHOT_CONSISTENCY_CHECK":            "true",
 		"KGW_WORKLOAD_ENTRIES_EXCLUSION_LABELS":         "example.io/managed-by,example.io/other-key",
 		"KGW_ENABLE_ROUTE_SOURCE_METADATA":              "true",
 		"KGW_SERVICE_ENTRIES_EXCLUSION_LABEL_SELECTORS": `[{"matchLabels":{"example.io/managed-by":"some-controller"}}]`,
@@ -117,6 +120,8 @@ func TestSettings(t *testing.T) {
 				EnableExperimentalGatewayAPIFeatures:  true,
 				GatewayClassParametersRefs:            GatewayClassParametersRefs{},
 				EnableAuthMetadata:                    false,
+				PerClientPublishBudget:                15 * time.Second,
+				PerClientWarmWithholdBound:            10 * time.Minute,
 				ServiceEntriesExclusionLabelSelectors: "[]",
 			},
 		},
@@ -167,9 +172,12 @@ func TestSettings(t *testing.T) {
 						Namespace: new(gwv1.Namespace("infra")),
 					},
 				},
-				EnableAuthMetadata:        true,
-				EnableRouteSourceMetadata: true,
-				ReferenceGrantMode:        ReferenceGrantStrict,
+				EnableAuthMetadata:          true,
+				PerClientWarmWithholdBound:  20 * time.Minute,
+				PerClientPublishBudget:      90 * time.Second,
+				XdsSnapshotConsistencyCheck: true,
+				EnableRouteSourceMetadata:   true,
+				ReferenceGrantMode:          ReferenceGrantStrict,
 			},
 		},
 		{
@@ -272,6 +280,8 @@ func TestSettings(t *testing.T) {
 				XdsTLS:                                false,
 				EnableExperimentalGatewayAPIFeatures:  true,
 				GatewayClassParametersRefs:            GatewayClassParametersRefs{},
+				PerClientPublishBudget:                15 * time.Second,
+				PerClientWarmWithholdBound:            10 * time.Minute,
 				ServiceEntriesExclusionLabelSelectors: "[]",
 			},
 		},
```

**File**: `devel/architecture/metrics.md` (modified, +85/-0)
```diff
@@ -74,3 +74,88 @@ metrics.RegisterEvents(httpRoutes, kmetrics.GetResourceMetricEventHandler[*gwv1.
 * This indicates the metrics system, and probably the gateway, is overloaded.
 * Once updates have been dropped, `kgateway_resources_*` metrics are no longer valid, until the process has been restarted.
 * Metrics subsystems other than `kgateway_resources_` are not affected.
+
+## Per-client xDS publication metrics
+
+The controller builds an xDS snapshot for each connected client and holds back a
+publication that would point Envoy at a cluster it does not have yet. These
+metrics show when that happens and how it ends. Each carries `gateway` and
+`namespace` labels unless noted. `kgateway_xds_snapshot_deferred_clients` covers
+the stage before them: a client with no snapshot yet.
+
+A client is *warm* when its first listener request on a connection carries a
+previously accepted version, a sign that it may still be serving that
+configuration, and *cold* otherwise. The version does not prove that the
+configuration is active.
+
+These metrics describe when the controller installs snapshots in its xDS cache.
+They do not show when Envoy receives, accepts or applies them.
+
+### `kgateway_xds_snapshot_perclient_defers_total` Metric
+* Counts per-client snapshots built while a referenced cluster was not ready, by
+  `reason`:
+  * `missing_clusters`: a route references a cluster absent from CDS.
+  * `missing_endpoints`: the cluster is in CDS but its endpoints have not been
+    derived yet. A cluster whose derived endpoints are empty is the backend's
+    real state and does not count.
+* A build with both kinds of gap counts once under each reason.
+* Each increment means the publication was resolved at publish time, for example
+  by carrying a missing cluster forward from the last published snapshot, or by
+  holding a route change until the new cluster is ready.
+* A sustained rate for one gateway means some referenced cluster is not becoming
+  ready.
+
+### `kgateway_xds_snapshot_perclient_withheld_clients` Metric
+* Counts clients whose first publish on their current connection is withheld
+  because referenced clusters are not ready, by `state`. Until it goes out, a new
+  proxy has no listeners and is not Ready.
+  * `within_budget`: waiting inside the first-publish budget
+    (`KGW_PER_CLIENT_PUBLISH_BUDGET`), which starts with the client's first
+    deferred build rather than at connect. A cold client is published when the
+    budget ends, ready or not, so it only ever appears here.
+  * `warm_withheld`: a warm client still withheld after the budget because
+    referenced clusters are missing from CDS. Publishing would replace routes it
+    may still be serving with routes to clusters it does not have. While
+    withheld it receives no updates at all, including certificate rotations. It
+    is released `KGW_PER_CLIENT_WARM_WITHHOLD_BOUND` after the budget ended, or
+    never if the bound is 0 or negative.
+* The states do not overlap; their sum is every client being held.
+* With the budget at 0 or negative, nothing is counted here: a withheld client
+  waits without a deadline and is visible only through
+  `kgateway_xds_snapshot_perclient_defers_total`.
+* A state's series is removed when it has no clients.
+
+### `kgateway_xds_snapshot_perclient_bounded_publishes_total` Metric
+* Counts withheld or held publications that a time bound released before every
+  referenced cluster was ready, by `mode`:
+  * `first_publish`: a client never published before started on incomplete but
+    consistent config when the first-publish budget ended, instead of waiting
+    indefinitely.
+  * `warm_truth`: a warm client whose only gaps were clusters with no derived
+    endpoints was published at the budget. Withholding would have frozen its
+    config indefinitely. Those clusters' endpoints were left out, so the client
+    kept the ones it had.
+  * `flip_release`: a route change held for a newly referenced cluster was
+    published at the budget because the cluster never became ready. Routes to it
+    fail until it does, and the route, listener and secret updates held with it
+    resume.
+  * `warm_release`: a warm client withheld for the whole warm withhold bound,
+    because referenced clusters were missing from CDS, was published. Routes to
+    those clusters fail until they appear.
+  * `carry_expired`: a published client stopped being carried a referenced
+    cluster that stayed missing from CDS for the warm withhold bound. Routes to it
+    fail until it reappears.
+* `flip_release`, `warm_release` and `carry_expired` mean some routes are
+  failing; they are the modes to alert on.
+
+### `kgateway_xds_snapshot_perclient_inconsistent_snapshots_total` Metric
+* Recorded only when `KGW_XDS_SNAPSHOT_CONSISTENCY_CHECK` is enabled, which is
+  meant for test and CI environments. It has no labels.
+* Counts per-client snapshots that, just before publication, carried an EDS or
+  RDS resource
```

**File**: `pkg/kgateway/controller/start.go` (modified, +6/-0)
```diff
@@ -83,6 +83,11 @@ type StartConfig struct {
 	CommonCollections *collections.CommonCollections
 	AugmentedPods     krt.Collection[krtcollections.LocalityPod]
 	UniqueClients     krt.Collection[ir.UniquelyConnectedClient]
+	// XDSClientState is the connection state behind UniqueClients (the third
+	// result of krtcollections.NewUniquelyConnectedClients). Leave it nil
+	// only if no such state exists: per-client publication then treats every
+	// reconnecting proxy as a new one.
+	XDSClientState krtcollections.XDSClientState
 
 	KrtOptions krtutil.KrtOptions
 
@@ -153,6 +158,7 @@ func NewControllerBuilder(ctx context.Context, cfg StartConfig) (*ControllerBuil
 		cfg.CommonCollections,
 		cfg.SetupOpts.Cache,
 		cfg.Validator,
+		cfg.XDSClientState,
 		cfg.StatusSyncerOptions...,
 	)
 	proxySyncer.Init(ctx, cfg.KrtOptions)
```

**File**: `pkg/kgateway/proxy_syncer/backends_disabled_pod_locality_test.go` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ func TestPerClientClustersTrackSharedClientCapability(t *testing.T) {
 	t.Cleanup(cancel)
 	krtopts := krtutil.NewKrtOptions(ctx.Done(), nil)
 
-	callbacks, buildClients := krtcollections.NewUniquelyConnectedClients(false)
+	callbacks, buildClients, _ := krtcollections.NewUniquelyConnectedClients(false)
 	var pods krt.Collection[krtcollections.LocalityPod]
 	clients := buildClients(ctx, krtopts, pods)
 	clients.WaitUntilSynced(ctx.Done())
```

**File**: `pkg/kgateway/proxy_syncer/backends_test_helpers_test.go` (modified, +17/-0)
```diff
@@ -89,3 +89,20 @@ func storedClusterNamesForClient(c PerClientEnvoyClusters, ucc ir.UniquelyConnec
 	slices.Sort(names)
 	return names
 }
+
+// newTestPerClientClustersFromCol feeds per-client test rows through the
+// production CDS assembler. Keyed by client, it keeps an empty row after a
+// client's last backend leaves.
+func newTestPerClientClustersFromCol(col krt.Collection[uccWithCluster], clients krt.Collection[ir.UniquelyConnectedClient]) PerClientEnvoyClusters {
+	rows := krt.NewCollection(clients, func(kctx krt.HandlerContext, ucc ir.UniquelyConnectedClient) *clustersWithErrors {
+		all := krt.Fetch(kctx, col)
+		var selected []uccWithCluster
+		for _, row := range all {
+			if row.Client.ResourceName() == ucc.ResourceName() {
+				selected = append(selected, row)
+			}
+		}
+		return assemblePerClientClusters(ucc, selected)
+	})
+	return PerClientEnvoyClusters{perClient: rows}
+}
```

**File**: `pkg/kgateway/proxy_syncer/carry_dependencies.go` (added, +226/-0)
```diff
@@ -0,0 +1,226 @@
+package proxy_syncer
+
+import (
+	"fmt"
+
+	envoyclusterv3 "github.com/envoyproxy/go-control-plane/envoy/config/cluster/v3"
+	envoycorev3 "github.com/envoyproxy/go-control-plane/envoy/config/core/v3"
+	envoyendpointv3 "github.com/envoyproxy/go-control-plane/envoy/config/endpoint/v3"
+	envoylistenerv3 "github.com/envoyproxy/go-control-plane/envoy/config/listener/v3"
+	envoytlsv3 "github.com/envoyproxy/go-control-plane/envoy/extensions/transport_sockets/tls/v3"
+	envoycachetypes "github.com/envoyproxy/go-control-plane/pkg/cache/types"
+	envoycache "github.com/envoyproxy/go-control-plane/pkg/cache/v3"
+	envoyresourcev3 "github.com/envoyproxy/go-control-plane/pkg/resource/v3"
+	"google.golang.org/protobuf/proto"
+	"google.golang.org/protobuf/reflect/protoreflect"
+	"google.golang.org/protobuf/types/known/anypb"
+
+	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/utils"
+)
+
+// carryDependencies adds to a composed snapshot what the clusters the gate
+// carries from the published snapshot need beyond their own cluster and CLA.
+//
+// A backend can ship listeners and secrets with its cluster
+// (ProcessBaseClusterResources), and they come from the backend's row like the
+// cluster does. A CONNECT tunnel is one: its cluster's endpoint is a pipe its
+// listener binds, and that listener proxies through the proxy backend's
+// cluster and reads its header values from SDS. When the row is missing and the
+// cluster is carried, the build lacks the rest too, so the carried cluster
+// would point at a socket nothing listens on.
+//
+// carry follows what Envoy resolves, not which plugin generated what: the
+// published listeners bound to the carried cluster's endpoint addresses (a
+// pipe path, or an internal listener's name), the secrets those listeners
+// name, and the clusters they route to (collectReferencedClusters). A listener
+// or secret the build has under the same name is kept as built, so current
+// configuration and secret rotations are never replaced by the published
+// copy. Routed-to clusters go back through the caller's carry rules, so an
+// errored or carry-expired one is never carried and a built one is kept, and
+// their own listeners are followed in turn; a cycle ends at a cluster already
+// present.
+type carryDependencies struct {
+	published envoycache.ResourceSnapshot
+	listeners envoycache.Resources
+	secrets   envoycache.Resources
+	// byAddress maps the address an endpoint reaches a published listener at
+	// to that listener's name. Built on first use.
+	byAddress                      map[string]string
+	listenersCloned, secretsCloned bool
+	listenerHash, secretHash       uint64
+}
+
+func newCarryDependencies(published envoycache.ResourceSnapshot, composed *envoycache.Snapshot) *carryDependencies {
+	return &carryDependencies{
+		published: published,
+		listeners: composed.Resources[envoycachetypes.Listener],
+		secrets:   composed.Resources[envoycachetypes.Secret],
+	}
+}
+
+// carry adds the listeners and secrets a carried cluster needs and returns the
+// clusters those listeners route to, for the caller to carry by its rules.
+func (d *carryDependencies) carry(cluster envoycachetypes.ResourceWithTTL) []string {
+	c, ok := cluster.Resource.(*envoyclusterv3.Cluster)
+	if !ok {
+		return nil
+	}
+	var targets []string
+	for _, address := range d.endpointAddresses(c) {
+		name, ok := d.listenerAt(address)
+		if !ok {
+			continue
+		}
+		if _, built := d.listeners.Items[name]; built {
+			continue
+		}
+		listener := d.published.GetResourcesAndTTL(envoyresourcev3.ListenerType)[name]
+		if !d.listenersCloned {
+			d.listeners.Items = cloneResourceItems(d.listeners.Items)
+			d.listenersCloned = true
+		}
+		d.listeners.Items[name] = listener
+		d.listenerHash ^= utils.HashString(name) ^ utils.HashProto(listener.Resource)
+
+		secretNames := make(map[string]struct{})
+		sdsSecretNames(listener.Resource, secretNames)
+		publishedSecrets := d.published.GetResourcesAndTTL(envoyresourcev3.SecretType)
+		for secretName := range secretNames {
+			if _, built := d.secrets.Items[secretName]; built {
+				continue
+			}
+			secret, ok := publishedSecrets[secretName]
+			if !ok {
+				continue
+			}
+			if !d.secretsCloned {
+				d.secrets.Items = cloneResourceItems(d.secrets.Items)
+				d.secretsCloned = true
+			}
+			d.secrets.Items[secretName] = secret
+			d.secretHash ^= utils.HashString(secretName) ^ utils.HashProto(secret.Resource)
+		}
+
+		single := envoycache.Resources{Items: map[string]envoycachetypes.ResourceWithTTL{name: listener}}
+		for target := range collectReferencedClusters(envoycache.Resources{}, single) {
+			targets = append(targets, target)
+		}
+	}
+	return targets
+}
+
+// apply installs the carried listeners and secrets into composed. Each carried
+// set changes its type's version, as carried clusters do, so a later snapshot
+// without them can never reuse the version.
+func (d *carryDependencies) apply(composed *envoycache.Snapshot) {
+	
```

**File**: `pkg/kgateway/proxy_syncer/carry_dependencies_test.go` (added, +267/-0)
```diff
@@ -0,0 +1,267 @@
+package proxy_syncer
+
+import (
+	"context"
+	"strings"
+	"testing"
+	"time"
+
+	envoyclusterv3 "github.com/envoyproxy/go-control-plane/envoy/config/cluster/v3"
+	envoycorev3 "github.com/envoyproxy/go-control-plane/envoy/config/core/v3"
+	envoyendpointv3 "github.com/envoyproxy/go-control-plane/envoy/config/endpoint/v3"
+	envoylistenerv3 "github.com/envoyproxy/go-control-plane/envoy/config/listener/v3"
+	envoytcpv3 "github.com/envoyproxy/go-control-plane/envoy/extensions/filters/network/tcp_proxy/v3"
+	envoygenericsecretv3 "github.com/envoyproxy/go-control-plane/envoy/extensions/formatter/generic_secret/v3"
+	envoytlsv3 "github.com/envoyproxy/go-control-plane/envoy/extensions/transport_sockets/tls/v3"
+	envoycachetypes "github.com/envoyproxy/go-control-plane/pkg/cache/types"
+	envoycache "github.com/envoyproxy/go-control-plane/pkg/cache/v3"
+	envoyresourcev3 "github.com/envoyproxy/go-control-plane/pkg/resource/v3"
+	envoywellknown "github.com/envoyproxy/go-control-plane/pkg/wellknown"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"google.golang.org/protobuf/proto"
+
+	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/utils"
+)
+
+// tunnelCluster is a tunneled backend's cluster as the CONNECT tunnel
+// generates it: STATIC, with one endpoint on the pipe its listener binds.
+func tunnelCluster(name string) *envoyclusterv3.Cluster {
+	return &envoyclusterv3.Cluster{
+		Name:                 name,
+		ClusterDiscoveryType: &envoyclusterv3.Cluster_Type{Type: envoyclusterv3.Cluster_STATIC},
+		LoadAssignment: &envoyendpointv3.ClusterLoadAssignment{
+			ClusterName: name,
+			Endpoints: []*envoyendpointv3.LocalityLbEndpoints{{LbEndpoints: []*envoyendpointv3.LbEndpoint{{
+				HostIdentifier: &envoyendpointv3.LbEndpoint_Endpoint{Endpoint: &envoyendpointv3.Endpoint{
+					Address: &envoycorev3.Address{Address: &envoycorev3.Address_Pipe{Pipe: &envoycorev3.Pipe{Path: "@" + name}}},
+				}},
+			}}}},
+		},
+	}
+}
+
+// tunnelBoundListener binds the pipe tunnelCluster(cluster) reaches and
+// CONNECTs through proxy, adding a header read from the SDS secret secret.
+func tunnelBoundListener(cluster, proxy, secret string) *envoylistenerv3.Listener {
+	tcp := &envoytcpv3.TcpProxy{
+		StatPrefix:       "tunnel_" + cluster,
+		ClusterSpecifier: &envoytcpv3.TcpProxy_Cluster{Cluster: proxy},
+		TunnelingConfig: &envoytcpv3.TcpProxy_TunnelingConfig{
+			Hostname: "dest.example.com:443",
+			HeadersToAdd: []*envoycorev3.HeaderValueOption{{
+				Header: &envoycorev3.HeaderValue{Key: "proxy-authorization", Value: "%SECRET(" + secret + ")%"},
+			}},
+			Formatters: []*envoycorev3.TypedExtensionConfig{{
+				Name: "envoy.formatter.generic_secret",
+				TypedConfig: utils.MustMessageToAny(&envoygenericsecretv3.GenericSecret{
+					SecretConfigs: map[string]*envoytlsv3.SdsSecretConfig{secret: {
+						Name:      secret,
+						SdsConfig: &envoycorev3.ConfigSource{ConfigSourceSpecifier: &envoycorev3.ConfigSource_Ads{Ads: &envoycorev3.AggregatedConfigSource{}}},
+					}},
+				}),
+			}},
+		},
+	}
+	return &envoylistenerv3.Listener{
+		Name:    "tunnel_" + cluster,
+		Address: &envoycorev3.Address{Address: &envoycorev3.Address_Pipe{Pipe: &envoycorev3.Pipe{Path: "@" + cluster}}},
+		FilterChains: []*envoylistenerv3.FilterChain{{Filters: []*envoylistenerv3.Filter{{
+			Name:       envoywellknown.TCPProxy,
+			ConfigType: &envoylistenerv3.Filter_TypedConfig{TypedConfig: utils.MustMessageToAny(tcp)},
+		}}}},
+	}
+}
+
+func genericSecret(name, value string) *envoytlsv3.Secret {
+	return &envoytlsv3.Secret{Name: name, Type: &envoytlsv3.Secret_GenericSecret{GenericSecret: &envoytlsv3.GenericSecret{
+		Secret: &envoycorev3.DataSource{Specifier: &envoycorev3.DataSource_InlineString{InlineString: value}},
+	}}}
+}
+
+// tunnelBuild is one build for a gateway routing to "x", a backend tunneled
+// through "proxy". withTunnel is whether x's row (its cluster, listener and
+// secret) made the build; withProxy whether proxy's did.
+type tunnelBuild struct {
+	version     string
+	withTunnel  bool
+	withProxy   bool
+	secretValue string
+	// proxyStatName marks a proxy cluster's content, to tell copies apart.
+	proxyStatName string
+}
+
+func (b tunnelBuild) snapshot(t *testing.T) *envoycache.Snapshot {
+	t.Helper()
+	ucc := newTestUcc(publishGateTestClient)
+	listeners := []envoycachetypes.Resource{httpListenerWithRDS(t, "listener", "route-config")}
+	var clusters, endpoints, secrets []envoycachetypes.Resource
+	if b.withTunnel {
+		listeners = append(listeners, tunnelBoundListener("x", "proxy", "tunnel_x/h"))
+		clusters = append(clusters, tunnelCluster("x"))
+		secrets = append(secrets, genericSecret("tunnel_x/h", b.secretValue))
+	}
+	if b.withProxy {
+		proxy := proto.Clone(edsClusterForClient(ucc, "proxy", 1).Cluster.BorrowForRead()).(*envoyclusterv3.Cluster)
+		proxy.AltStatName = b.proxyStatName
+		clusters = append(clusters, proxy)
+		endpoints = append(endpoints, endpointsForClient(uc
```

---

### Incident Patch 2: `4c11984c` (2026-10-21)
**Commit Message**: fix(xds): stop one rejected cluster or listener from freezing endpoint and route updates (#14865)

Signed-off-by: David L. Chandler <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `pkg/kgateway/proxy_syncer/local_cluster.go` (modified, +6/-5)
```diff
@@ -39,8 +39,9 @@ func gatewayPodIndexKey(namespace, gatewayName string) string {
 
 // NewPerClientLocalClusterEndpoints builds each gateway's local-cluster CLA
 // from its pods for Envoy's zone-aware routing. Rows are per client, not per backend.
-// Clients that have not subscribed are skipped: publishing an unrequested CLA
-// would cause go-control-plane to withhold their ADS endpoint responses.
+// Clients that have not subscribed are skipped. newSnapshotCache serves EDS per
+// request, so an unrequested CLA would no longer withhold their other endpoints
+// (#14471), but there is no reason to build and publish one they never request.
 func NewPerClientLocalClusterEndpoints(
 	krtopts krtutil.KrtOptions,
 	uccs krt.Collection[ir.UniquelyConnectedClient],
@@ -57,9 +58,9 @@ func NewPerClientLocalClusterEndpoints(
 	endpoints := krt.NewCollection(uccs, func(kctx krt.HandlerContext, ucc ir.UniquelyConnectedClient) *UccWithEndpoints {
 		if !ucc.KnowsLocalCluster {
 			// Client's own EDS subscription has never named this resource (old Envoy with
-			// no matching static bootstrap cluster). Never emit it for this client: an
-			// unrequested resource in the snapshot makes go-control-plane's ADS "superset"
-			// check withhold the client's *entire* EDS response. See issue #14471.
+			// no matching static bootstrap cluster), so it would never be sent. Before
+			// newSnapshotCache served EDS per request, publishing it withheld the client's
+			// entire EDS response (#14471).
 			return nil
 		}
 		localClusterName, gatewayName, gatewayNamespace := ucc.LocalClusterInfo()
```

**File**: `pkg/kgateway/proxy_syncer/perclient.go` (modified, +6/-5)
```diff
@@ -128,12 +128,13 @@ func snapshotPerClient(
 			clusterResources.Version = strconv.FormatUint(clustersForUcc.clustersHash^listenerRouteSnapshot.ClustersHash, 10)
 			clusterResources.Items = clustersProto
 		}
-		// Exclude CLAs for STATIC clusters so ADS snapshot only contains resources Envoy will request.
+		// Exclude CLAs for STATIC clusters so the snapshot only contains resources Envoy will request.
 		endpointRes := filterEndpointResourcesForStaticClusters(clusterResources, clientEndpointResources.endpoints)
 		// Backend translation errors remove the corresponding cluster from CDS above. Remove
 		// its CLA as well: after Envoy observes the CDS removal it stops naming that resource
-		// in EDS requests, and go-control-plane otherwise withholds the entire named EDS
-		// response, including updates for healthy clusters.
+		// in EDS requests. newSnapshotCache serves EDS per request, so an unrequested CLA no
+		// longer holds back healthy clusters' endpoints (#14498); this keeps the snapshot
+		// consistent with CDS and keeps that protection if the cache changes.
 		//
 		// Keep this filtering explicitly error-scoped. Some endpoint resources, such as the
 		// bootstrap-defined local cluster, intentionally have no cluster in this CDS snapshot.
@@ -260,8 +261,8 @@ func mergeBackendResources[M proto.Message](gateway envoycache.Resources, backen
 }
 
 // filterEndpointResourcesForStaticClusters returns endpoint resources excluding CLAs for clusters
-// that are STATIC (inline endpoints). Envoy does not request EDS for those; including them in the
-// snapshot triggers the ADS cache "not listed" warning when responding to EDS requests.
+// that are STATIC (inline endpoints). Envoy does not request EDS for those, so the snapshot
+// should not carry them.
 func filterEndpointResourcesForStaticClusters(clusters envoycache.Resources, endpoints envoycache.Resources) envoycache.Resources {
 	staticClusterNames := make(map[string]struct{})
 	for _, item := range clusters.Items {
```

**File**: `pkg/kgateway/setup/ads_delivery_order_test.go` (modified, +52/-15)
```diff
@@ -4,6 +4,9 @@ import (
 	"context"
 	"errors"
 	"io"
+	"slices"
+	"strings"
+	"sync"
 	"testing"
 	"time"
 
@@ -67,13 +70,45 @@ func (s *mockAdsStream) Recv() (*discoveryv3.DiscoveryRequest, error) {
 }
 
 type adsHarness struct {
-	t      *testing.T
-	ctx    context.Context
-	cancel context.CancelFunc
-	cache  envoycache.SnapshotCache
-	stream *mockAdsStream
-	done   chan error
-	node   *envoycorev3.Node
+	t       *testing.T
+	ctx     context.Context
+	cancel  context.CancelFunc
+	cache   envoycache.SnapshotCache
+	watches *watchRecorder
+	stream  *mockAdsStream
+	done    chan error
+	node    *envoycorev3.Node
+}
+
+// watchRecorder counts the CreateWatch calls the server has completed, by type
+// and resource names, so a test can wait until the cache has handled one
+// particular request. A call counts once it returns: the cache has registered,
+// answered or declined the watch.
+type watchRecorder struct {
+	envoycache.Cache
+
+	mu      sync.Mutex
+	handled map[string]int
+}
+
+func (r *watchRecorder) CreateWatch(request *envoycache.Request, sub envoycache.Subscription, value chan envoycache.Response) (func(), error) {
+	cancel, err := r.Cache.CreateWatch(request, sub, value)
+	r.mu.Lock()
+	defer r.mu.Unlock()
+	r.handled[watchKey(request.GetTypeUrl(), request.GetResourceNames())]++
+	return cancel, err
+}
+
+// count returns how many requests for typeURL naming exactly names, in any
+// order, the cache has handled.
+func (r *watchRecorder) count(typeURL string, names []string) int {
+	r.mu.Lock()
+	defer r.mu.Unlock()
+	return r.handled[watchKey(typeURL, names)]
+}
+
+func watchKey(typeURL string, names []string) string {
+	return typeURL + " " + strings.Join(slices.Sorted(slices.Values(names)), ",")
 }
 
 func newADSHarness(t *testing.T, ordered bool) *adsHarness {
@@ -92,21 +127,23 @@ func newADSHarnessWithCallbacks(t *testing.T, ordered bool, callbacks xdsserver.
 		recv: make(chan *discoveryv3.DiscoveryRequest, 16),
 	}
 	cache := newSnapshotCache(kgwxds.NewNodeRoleHasher(), nil)
+	watches := &watchRecorder{Cache: cache, handled: map[string]int{}}
 
 	var opts []serverconfig.XDSOption
 	if ordered {
 		opts = append(opts, sotwv3.WithOrderedADS())
 	}
-	srv := xdsserver.NewServer(ctx, cache, callbacks, opts...)
+	srv := xdsserver.NewServer(ctx, watches, callbacks, opts...)
 
 	h := &adsHarness{
-		t:      t,
-		ctx:    ctx,
-		cancel: cancel,
-		cache:  cache,
-		stream: stream,
-		done:   make(chan error, 1),
-		node:   adsTestNode(t),
+		t:       t,
+		ctx:     ctx,
+		cancel:  cancel,
+		cache:   cache,
+		watches: watches,
+		stream:  stream,
+		done:    make(chan error, 1),
+		node:    adsTestNode(t),
 	}
 	go func() {
 		h.done <- srv.StreamAggregatedResources(stream)
```

**File**: `pkg/kgateway/setup/ads_rejected_resource_test.go` (added, +567/-0)
```diff
@@ -0,0 +1,567 @@
+package setup
+
+import (
+	"testing"
+	"time"
+
+	envoyclusterv3 "github.com/envoyproxy/go-control-plane/envoy/config/cluster/v3"
+	envoycorev3 "github.com/envoyproxy/go-control-plane/envoy/config/core/v3"
+	envoyendpointv3 "github.com/envoyproxy/go-control-plane/envoy/config/endpoint/v3"
+	envoylistenerv3 "github.com/envoyproxy/go-control-plane/envoy/config/listener/v3"
+	envoyroutev3 "github.com/envoyproxy/go-control-plane/envoy/config/route/v3"
+	discoveryv3 "github.com/envoyproxy/go-control-plane/envoy/service/discovery/v3"
+	cachetypes "github.com/envoyproxy/go-control-plane/pkg/cache/types"
+	envoycache "github.com/envoyproxy/go-control-plane/pkg/cache/v3"
+	envoyresource "github.com/envoyproxy/go-control-plane/pkg/resource/v3"
+	"github.com/stretchr/testify/require"
+	"google.golang.org/genproto/googleapis/rpc/status"
+)
+
+// These tests drive our ADS cache through the go-control-plane SotW server with
+// the requests Envoy sends when it rejects one resource of a CDS or LDS
+// response, and require that the proxy still gets the endpoint and route
+// updates it subscribed to.
+//
+// Envoy applies the valid resources of a NACKed CDS or LDS response and never
+// subscribes to the rejected resource's endpoints or routes. In ADS mode the
+// pinned go-control-plane answers a named EDS or RDS request only when the
+// snapshot holds nothing outside the request. On its plain ADS cache:
+//
+//   - while the rejected resource is in the snapshot, its CLA or
+//     RouteConfiguration holds back every endpoint or route update for the
+//     proxy, not only its own;
+//   - the request Envoy sends for a valid resource added in the same response
+//     is declined on the request path, which registers no watch. Removing the
+//     rejected resource then has nothing to answer, and the proxy stays on its
+//     old endpoints or routes until its subscription changes again or it
+//     reconnects;
+//   - a proxy that connects while the rejected resource is published loses its
+//     first EDS or RDS request the same way. Its cluster initializes empty at
+//     the fetch timeout, or its listener with no routes, so it reports ready
+//     while the route fails.
+//
+// The request sequences are the ones Envoy v1.39.4 sent to this pinned
+// go-control-plane with ordered ADS, with an EDS cluster rejected for
+// CLUSTER_PROVIDED load balancing or an unrecognized TLS signature algorithm,
+// and a listener rejected for an HTTP filter with no registered factory. In
+// those runs the added cluster started empty at its 15s EDS fetch timeout, the
+// added listener started with no routes at its RDS fetch timeout, and the
+// existing cluster and route kept their first version through two later
+// updates and the rejected resource's removal.
+//
+// newSnapshotCache serves EDS, RDS and SDS (and LDS, to keep ADS's order) from
+// non-ADS caches that answer the requested names (perTypeCache), so these tests
+// pass. On the plain ADS cache they all fail. A go-control-plane that answers
+// named ADS requests with only the subscribed resources would pass them all on
+// its own; one that keeps the watch of a request it declines would pass only
+// the two "after it is removed" tests.
+
+const proxyUpdateWithin = 2 * time.Second
+
+func adsEDSCluster(name string) *envoyclusterv3.Cluster {
+	return &envoyclusterv3.Cluster{
+		Name:                 name,
+		ClusterDiscoveryType: &envoyclusterv3.Cluster_Type{Type: envoyclusterv3.Cluster_EDS},
+		EdsClusterConfig: &envoyclusterv3.Cluster_EdsClusterConfig{
+			EdsConfig: &envoycorev3.ConfigSource{
+				ResourceApiVersion:    envoycorev3.ApiVersion_V3,
+				ConfigSourceSpecifier: &envoycorev3.ConfigSource_Ads{Ads: &envoycorev3.AggregatedConfigSource{}},
+			},
+		},
+	}
+}
+
+func adsEndpoints(cluster, address string) *envoyendpointv3.ClusterLoadAssignment {
+	return &envoyendpointv3.ClusterLoadAssignment{
+		ClusterName: cluster,
+		Endpoints: []*envoyendpointv3.LocalityLbEndpoints{{
+			LbEndpoints: []*envoyendpointv3.LbEndpoint{{
+				HostIdentifier: &envoyendpointv3.LbEndpoint_Endpoint{Endpoint: &envoyendpointv3.Endpoint{
+					Address: &envoycorev3.Address{Address: &envoycorev3.Address_SocketAddress{SocketAddress: &envoycorev3.SocketAddress{
+						Address:       address,
+						PortSpecifier: &envoycorev3.SocketAddress_PortValue{PortValue: 8080},
+					}}},
+				}},
+			}},
+		}},
+	}
+}
+
+// clusterEndpointSnapshot versions CDS and EDS separately, as kgateway does: a
+// change to one type leaves the other's version alone. endpoints maps each
+// cluster to its one endpoint address.
+func clusterEndpointSnapshot(cdsVersion, edsVersion string, clusters []string, endpoints map[string]string) *envoycache.Snapshot {
+	clusterItems := make([]cachetypes.Resource, 0, len(clusters))
+	for _, name := range clusters {
+		clusterItems = append(clusterItems, adsEDSCluster(name))
+	}
+	endpointItems := make([]cachetypes.Resource, 0, len(endpoints))
+	for
```

**File**: `pkg/kgateway/setup/ads_watch_retention_test.go` (modified, +4/-2)
```diff
@@ -143,8 +143,10 @@ func TestADSCacheRetainsNamedWatchItCannotAnswer(t *testing.T) {
 // snapshot is misaligned — the window around a rejected or not-yet-applied
 // cluster update — can be left waiting on a request that is never answered.
 //
-// This test documents the residual gap. If it starts failing, upstream has
-// closed it and any local mitigation can be dropped.
+// This test documents the request-retention gap only. Keeping this watch would
+// permit recovery after the blocker is removed, but not updates while it remains.
+// Removing perTypeCache requires all six rejected-resource delivery scenarios
+// to pass with the upstream cache alone, including those with the blocker present.
 func TestADSCacheDropsNewNamedRequestItCannotAnswer(t *testing.T) {
 	ctx := context.Background()
 	cache := envoycache.NewSnapshotCache(true, retentionHash{}, nil)
```

**File**: `pkg/kgateway/setup/controlplane.go` (modified, +192/-22)
```diff
@@ -8,13 +8,16 @@ import (
 	"log/slog"
 	"math"
 	"net"
+	"slices"
+	"sync"
+	"time"
 
+	envoycorev3 "github.com/envoyproxy/go-control-plane/envoy/config/core/v3"
 	envoy_service_cluster_v3 "github.com/envoyproxy/go-control-plane/envoy/service/cluster/v3"
 	envoy_service_discovery_v3 "github.com/envoyproxy/go-control-plane/envoy/service/discovery/v3"
 	envoy_service_endpoint_v3 "github.com/envoyproxy/go-control-plane/envoy/service/endpoint/v3"
 	envoy_service_listener_v3 "github.com/envoyproxy/go-control-plane/envoy/service/listener/v3"
 	envoy_service_route_v3 "github.com/envoyproxy/go-control-plane/envoy/service/route/v3"
-	envoycachetypes "github.com/envoyproxy/go-control-plane/pkg/cache/types"
 	envoycache "github.com/envoyproxy/go-control-plane/pkg/cache/v3"
 	envoylog "github.com/envoyproxy/go-control-plane/pkg/log"
 	envoyresource "github.com/envoyproxy/go-control-plane/pkg/resource/v3"
@@ -96,45 +99,212 @@ func (s *slogAdapterForEnvoy) Errorf(format string, args ...any) {
 	}
 }
 
-// newSnapshotCache returns the ADS snapshot cache, with secrets served per request.
+// newSnapshotCache returns the ADS snapshot cache, with EDS, LDS, RDS and SDS
+// served per request (perTypeCache).
 func newSnapshotCache(hash envoycache.NodeHash, logger envoylog.Logger) envoycache.SnapshotCache {
-	return &perRequestSecretsCache{
+	c := &perTypeCache{
 		SnapshotCache: envoycache.NewSnapshotCache(true, hash, logger),
-		secrets:       envoycache.NewSnapshotCache(false, hash, logger),
+		byType:        make(map[string]envoycache.SnapshotCache, len(perTypeOrder)),
 	}
+	for _, typeURL := range perTypeOrder {
+		c.byType[typeURL] = envoycache.NewSnapshotCache(false, hash, logger)
+	}
+	return c
 }
 
-// perRequestSecretsCache serves secret watches from a non-ADS copy of each
-// snapshot's secrets. Delta watches, Fetch and status stay on the embedded cache.
-type perRequestSecretsCache struct {
+// perTypeOrder lists the types perTypeCache serves itself, in publish order.
+var perTypeOrder = []string{envoyresource.SecretType, envoyresource.EndpointType, envoyresource.ListenerType, envoyresource.RouteType}
+
+// perTypeCache serves EDS, RDS and SDS watches from a non-ADS copy of each
+// snapshot's resources of that type. In ADS mode go-control-plane answers a
+// named request only when the snapshot holds nothing outside it, and keeps no
+// watch for a new request it declines. Envoy never requests the endpoints,
+// routes or secrets of a cluster or listener it rejected, so one rejected
+// resource would hold back every update of that type for the proxy, and the
+// proxy would stay stale after the resource is removed
+// (ads_rejected_resource_test.go). A non-ADS cache answers the requested names.
+// Keeping declined watches permits recovery after the blocking resource is
+// removed, but cannot deliver updates while it remains. Remove this wrapper
+// only when the upstream cache alone passes all six rejected-resource delivery
+// scenarios, including updates while a rejected resource remains published.
+//
+// LDS is served the same way only to keep ADS's order: SetSnapshot publishes
+// secrets first, so they are ready when a new listener requests them, then
+// CDS, EDS, LDS and RDS. CDS, delta watches and Fetch stay on the embedded ADS
+// cache, which stores the whole snapshot for GetSnapshot. Status combines all
+// the caches.
+type perTypeCache struct {
 	envoycache.SnapshotCache
-	secrets envoycache.SnapshotCache
+	byType map[string]envoycache.SnapshotCache
+
+	mutationMu sync.Mutex
+	mutations  map[string]*nodeCacheMutation
+}
+
+type nodeCacheMutation struct {
+	mu    sync.Mutex
+	users int // includes callers waiting for mu
+}
+
+// lockNode serializes installs and clears for one node. Count waiting callers
+// too, so the lock can be reclaimed without creating a second lock for that node.
+func (c *perTypeCache) lockNode(node string) func() {
+	c.mutationMu.Lock()
+	if c.mutations == nil {
+		c.mutations = make(map[string]*nodeCacheMutation)
+	}
+	m := c.mutations[node]
+	if m == nil {
+		m = &nodeCacheMutation{}
+		c.mutations[node] = m
+	}
+	m.users++
+	c.mutationMu.Unlock()
+
+	m.mu.Lock()
+	return func() {
+		m.mu.Unlock()
+		c.mutationMu.Lock()
+		defer c.mutationMu.Unlock()
+		m.users--
+		if m.users == 0 {
+			delete(c.mutations, node)
+		}
+	}
 }
 
-func (c *perRequestSecretsCache) CreateWatch(request *envoycache.Request, sub envoycache.Subscription, value chan envoycache.Response) (func(), error) {
-	if request.GetTypeUrl() == envoyresource.SecretType {
-		return c.secrets.CreateWatch(request, sub, value)
+func (c *perTypeCache) CreateWatch(request *envoycache.Request, sub envoycache.Subscription, value chan envoycache.Response) (func(), error) {
+	if typed, ok := c.byType[request.GetTypeUrl()]; ok {
+		return typed.CreateWatch(request, sub, value)
 	}
 	return c.SnapshotCache.CreateWatch(request, sub, value)
 }
 
-// SetSnapshot publishes secrets first, so they are ready when a new listener
```

**File**: `pkg/kgateway/setup/per_type_cache_concurrency_test.go` (added, +210/-0)
```diff
@@ -0,0 +1,210 @@
+package setup
+
+import (
+	"context"
+	"sync"
+	"testing"
+	"time"
+
+	envoycorev3 "github.com/envoyproxy/go-control-plane/envoy/config/core/v3"
+	envoytlsv3 "github.com/envoyproxy/go-control-plane/envoy/extensions/transport_sockets/tls/v3"
+	cachetypes "github.com/envoyproxy/go-control-plane/pkg/cache/types"
+	envoycache "github.com/envoyproxy/go-control-plane/pkg/cache/v3"
+	envoyresource "github.com/envoyproxy/go-control-plane/pkg/resource/v3"
+	"github.com/stretchr/testify/require"
+)
+
+type cacheMutationPause struct {
+	ctx     context.Context
+	entered chan struct{}
+	release chan struct{}
+	once    sync.Once
+}
+
+func newCacheMutationPause(t *testing.T) *cacheMutationPause {
+	t.Helper()
+	p := &cacheMutationPause{ctx: t.Context(), entered: make(chan struct{}), release: make(chan struct{})}
+	t.Cleanup(p.resume)
+	return p
+}
+
+func (p *cacheMutationPause) wait() {
+	close(p.entered)
+	select {
+	case <-p.release:
+	case <-p.ctx.Done():
+	}
+}
+
+func (p *cacheMutationPause) resume() { p.once.Do(func() { close(p.release) }) }
+
+func runCacheMutation(t *testing.T, f func() error) <-chan error {
+	t.Helper()
+	done := make(chan error, 1)
+	go func() {
+		defer close(done)
+		done <- f()
+	}()
+	t.Cleanup(func() {
+		select {
+		case <-done:
+		case <-time.After(proxyUpdateWithin):
+			t.Error("cache mutation did not stop after cancellation")
+		}
+	})
+	return done
+}
+
+func awaitCacheMutation(t *testing.T, done <-chan error) {
+	t.Helper()
+	select {
+	case err := <-done:
+		require.NoError(t, err)
+	case <-time.After(proxyUpdateWithin):
+		t.Fatal("cache mutation did not finish")
+	}
+}
+
+// Give the second mutation a chance to run before releasing the first. Without
+// serialization it finishes here, leaving types from different publications.
+func releaseCacheMutation(t *testing.T, pause *cacheMutationPause, second <-chan error) {
+	t.Helper()
+	select {
+	case err := <-second:
+		require.NoError(t, err)
+	case <-time.After(100 * time.Millisecond):
+	}
+	pause.resume()
+}
+
+func cacheMutationSnapshot(version string) *envoycache.Snapshot {
+	cluster := "backend-" + version
+	snapshot := clusterEndpointSnapshot(version, version, []string{cluster}, map[string]string{cluster: "10.0.0." + version})
+	listeners := listenerRouteSnapshot(version, version, []string{"front-" + version}, map[string]string{"routes-" + version: cluster})
+	snapshot.Resources[cachetypes.Listener] = listeners.Resources[cachetypes.Listener]
+	snapshot.Resources[cachetypes.Route] = listeners.Resources[cachetypes.Route]
+	snapshot.Resources[cachetypes.Secret] = envoycache.NewResources(version, []cachetypes.Resource{&envoytlsv3.Secret{Name: "secret-" + version}})
+	return snapshot
+}
+
+// Check what fresh watches receive, not only the full snapshot used by admin.
+func requireServingSnapshot(t *testing.T, c *perTypeCache, node, version string) {
+	t.Helper()
+	snapshot, err := c.GetSnapshot(node)
+	require.NoError(t, err)
+	for _, typeURL := range append([]string{envoyresource.ClusterType}, perTypeOrder...) {
+		require.Equal(t, version, snapshot.GetVersion(typeURL))
+		var names []string
+		want := make(map[string]string)
+		for name := range snapshot.GetResources(typeURL) {
+			names = append(names, name)
+			want[name] = version
+		}
+		replies := make(chan envoycache.Response, 1)
+		cancel, err := c.CreateWatch(&envoycache.Request{
+			Node: &envoycorev3.Node{Id: node}, TypeUrl: typeURL, ResourceNames: names,
+		}, *newSotwSubscription(names...), replies)
+		require.NoError(t, err)
+		if cancel != nil {
+			t.Cleanup(cancel)
+		}
+		response := awaitResponse(t, replies, typeURL)
+		require.Equal(t, version, response.GetResponseVersion(), typeURL)
+		require.Equal(t, want, response.GetReturnedResources(), typeURL)
+	}
+}
+
+func pauseSnapshotInstall(t *testing.T, c *perTypeCache, node string, pause *cacheMutationPause) <-chan error {
+	t.Helper()
+	done := runCacheMutation(t, func() error {
+		return c.setSnapshot(t.Context(), node, cacheMutationSnapshot("1"), func(typeURL string) {
+			if typeURL == envoyresource.ClusterType {
+				pause.wait()
+			}
+		})
+	})
+	select {
+	case <-pause.entered:
+	case <-time.After(proxyUpdateWithin):
+		t.Fatal("snapshot install did not reach CDS")
+	}
+	return done
+}
+
+func TestPerTypeCacheSerializesSnapshotInstalls(t *testing.T) {
+	c := newSnapshotCache(envoycache.IDHash{}, nil).(*perTypeCache)
+	pause := newCacheMutationPause(t)
+	first := pauseSnapshotInstall(t, c, "node", pause)
+	second := runCacheMutation(t, func() error {
+		return c.SetSnapshot(t.Context(), "node", cacheMutationSnapshot("2"))
+	})
+	releaseCacheMutation(t, pause, second)
+	awaitCacheMutation(t, first)
+	awaitCacheMutation(t, second)
+	requireServingSnapshot(t, c, "node", "2")
+}
+
+func TestPerTypeCacheClearWaitsForSnapshotInstall(t *testing.T) {
+	c := newSnapshotCache(envoycache.IDHash{}, nil).(*perTypeCache)
+	pause := newCacheMutationPause(t)
+	first := pauseSnapshotInstall(t, c, "nod
```

**File**: `pkg/pluginsdk/ir/model.go` (modified, +5/-5)
```diff
@@ -41,11 +41,11 @@ type UniquelyConnectedClient struct {
 	// have no matching static cluster in their bootstrap and can never name it,
 	// so this must default to false and only ever be set by observing a real
 	// request (see pkg/krtcollections/uniqueclients.go) — never assume support.
-	// Without this gate, go-control-plane's ADS "superset" check
-	// (github.com/envoyproxy/go-control-plane pkg/cache/v3/simple.go) withholds
-	// the *entire* EDS response to a client that doesn't ask for every resource
-	// in the snapshot, breaking all endpoint updates for that client, not just
-	// the local cluster (see https://github.com/kgateway-dev/kgateway/issues/14471).
+	// The local-cluster CLA is built only for clients with this set. Before EDS
+	// was served per request (newSnapshotCache in pkg/kgateway/setup), an
+	// unrequested CLA made go-control-plane's ADS cache withhold the client's
+	// *entire* EDS response, breaking all endpoint updates for that client, not
+	// just the local cluster (https://github.com/kgateway-dev/kgateway/issues/14471).
 	KnowsLocalCluster bool
 
 	// modified role that includes the namespace and the hash of the labels.
```

---

### Incident Patch 3: `2b5e1790` (2026-10-21)
**Commit Message**: fix(gateway): add message to Gateway Programmed condition when no valid listeners (#14841)

Signed-off-by: Harkirat <[REDACTED_EMAIL]>

**File**: `pkg/kgateway/translator/gateway/testutils/outputs/gateway-only/gateway-invalid-listener-proxy.yaml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ Statuses:
         status: "False"
         type: Accepted
       - lastTransitionTime: null
-        message: ""
+        message: No valid listeners
         reason: Invalid
         status: "False"
         type: Programmed
```

**File**: `pkg/kgateway/translator/gateway/testutils/outputs/validation/gateway-reserved-port.yaml` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ Statuses:
         status: "True"
         type: Accepted
       - lastTransitionTime: null
-        message: ""
+        message: No valid listeners
         reason: Invalid
         status: "False"
         type: Programmed
```

**File**: `pkg/kgateway/translator/gateway/testutils/outputs/validation/xlistenerset-reserved-port.yaml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ Statuses:
         status: "False"
         type: Accepted
       - lastTransitionTime: null
-        message: ""
+        message: No valid listeners
         reason: Invalid
         status: "False"
         type: Programmed
```

**File**: `pkg/kgateway/translator/listener/validation.go` (modified, +4/-3)
```diff
@@ -313,9 +313,10 @@ func validateListeners(gw *ir.Gateway, reporter reports.Reporter, settings Liste
 			Message: "No valid listeners",
 		})
 		reporter.Gateway(gw.Obj).SetCondition(reports.GatewayCondition{
-			Type:   gwv1.GatewayConditionProgrammed,
-			Status: metav1.ConditionFalse,
-			Reason: gwv1.GatewayReasonInvalid,
+			Type:    gwv1.GatewayConditionProgrammed,
+			Status:  metav1.ConditionFalse,
+			Reason:  gwv1.GatewayReasonInvalid,
+			Message: "No valid listeners",
 		})
 		return validListeners
 	}
```

#### Recent Merged Pull Requests:
- **PR #14868** (2026-10-21): test(proxy_syncer): wait for derived rows in TestUnsupportedBackendTranslationIsRecordedAsErrored (@chandler-solo)
- **PR #14866** (2026-10-20): fix(deployer): stop rolling proxy pods on listener port changes (@puertomontt)
- **PR #14865** (2026-10-21): fix(xds): stop one rejected cluster or listener from freezing endpoint and route updates (@chandler-solo)
- **PR #14864** (2026-10-20): build: add a Dockerfile for Anthropic's OSS Scanner (@puertomontt)
- **PR #14863** (2026-10-20): test(setup): fix TestExtraCallbacksSeeEveryStreamHook/ordered flake on cancellation (@chandler-solo)
- **PR #14860** (2026-10-20): fix(trafficpolicy): stop bufferIR.Equals dereferencing a typed nil (@chandler-solo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. xds): bound per-client publication and preserve coherent snapshots (#14698)

**RULE**:
When implementing operations in `api/settings/settings.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kgateway-dev/kgateway. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `40bddf72`: xds): bound per-client publication and preserve coherent snapshots (#14698). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `api/settings/settings.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	// PerClientPublishBudget bounds how long per-client xDS publication may be
	// withheld while referenced clusters are not ready. A build whose referenced
	// clusters are all in CDS with derived endpoints publishes at once. Derived
	// endpoints may be empty, which is the backend's real state; endpoints not
	// yet derived are a gap.
	//
	//   - first publish: a client not yet published on its current connection
	//     gets the latest deferred snapshot at expiry, so a new gateway pod gets
	//     listeners instead of crash-looping; routes to unready clusters return
	//     503 until ready. The budget starts when the gate receives the
	//     client's first deferred build, not at connect; a client that left
	//     mid-withhold less than a budget earlier resumes its start. A warm
	//     client stays withheld while referenced clusters are missing from CDS,
	//     for at most PerClientWarmWithholdBound after expiry. If its only gaps
	//     are underived endpoints, it publishes at expiry and keeps the endpoints
	//     it holds: such gaps may never converge, and withholding would freeze
	//     its config.
	//   - flip release: a route flip held for a newly-referenced unready
	//
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `40bddf72` are properly handled with clean fallback behavior.
