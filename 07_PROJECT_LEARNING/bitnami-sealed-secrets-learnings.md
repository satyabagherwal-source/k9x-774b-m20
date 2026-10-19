> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/bitnami-sealed-secrets-learnings.md`  
> **Source**: github ([https://github.com/bitnami/sealed-secrets](https://github.com/bitnami/sealed-secrets))  
> **Source Version**: `19227f36`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T06:11:10.543Z  
> **Learning ID**: `learn-github-bitnami-sealed-secrets`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): bitnami/sealed-secrets

> **Canonical Artifact**: `07_PROJECT_LEARNING/bitnami-sealed-secrets-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bitnami/sealed-secrets](https://github.com/bitnami/sealed-secrets))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T06:11:10.536Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bitnami/sealed-secrets`
- **Description**: A Kubernetes controller and tool for one-way encrypted Secrets
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 9307 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/controller/main.go`
```
package main

import (
	goflag "flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"time"

	flag "github.com/spf13/pflag"

	"github.com/bitnami/sealed-secrets/pkg/controller"
	"github.com/bitnami/sealed-secrets/pkg/flagenv"
	"github.com/bitnami/sealed-secrets/pkg/log"
	"github.com/bitnami/sealed-secrets/pkg/pflagenv"

	ssv1alpha1 "github.com/bitnami/sealed-secrets/pkg/apis/sealedsecrets/v1alpha1"
	"github.com/bitnami/sealed-secrets/pkg/buildinfo"
)

const (
	flagEnvPrefix           = "SEALED_SECRETS"
	defaultKeyRenewPeriod   = 30 * 24 * time.Hour
	defaultKeyOrderPriority = "CertNotBefore"
)

var (
	// VERSION set from Makefile.
	VERSION = buildinfo.DefaultVersion
)

func bindControllerFlags(f *controller.Flags, fs *flag.FlagSet) {
	fs.StringVar(&f.KeyPrefix, "key-prefix", "sealed-secrets-key", "Prefix used to name keys.")
	fs.IntVar(&f.KeySize, "key-size", 4096, "Size of encryption key.")
	fs.DurationVar(&f.ValidFor, "key-ttl", 10*365*24*time.Hour, "Duration that certificate is valid for.")
	fs.StringVar(&f.MyCN, "my-cn", "", "Common name to be used as issuer/subject DN in generated certificate.")

	fs.DurationVar(&f.KeyRenewPeriod, "key-renew-period", defaultKeyRenewPeriod, "New key generation period (automatic rotation deactivated if 0)")
	fs.StringVar(&f.KeyOrderPriority, "key-order-priority", defaultKeyOrderPriority, "Ordering of keys based on NotBefore certificate attribute or secret creation timestamp.")
	fs.BoolVar(&f.AcceptV1Data, "accept-deprecated-v1-data", true, "Accept deprecated V1 data field.")
	fs.StringVar(&f.KeyCutoffTime, "key-cutoff-time", "", "Create a new key if latest one is older than this cutoff time. RFC1123 format with numeric timezone expected.")
	fs.BoolVar(&f.NamespaceAll, "all-namespaces", true, "Scan all namespaces or only the current namespace (default=true).")
	fs.StringVar(&f.AdditionalNamespaces, "additional-namespaces", "", "Comma-separated list of additional namespaces to be scanned.")
	fs.StringVar(&f.LabelSelector, "label-selector", "", "Label selector which can be used to filter sealed secrets.")
	fs.IntVar(&f.RateLimitPerSecond, "rate-limit", 2, "Number of allowed sustained requests per second for the verify and rotate endpoints")
	fs.IntVar(&f.RateLimitBurst, "rate-limit-burst", 2, "Number of requests allowed to exceed the rate limit per second for the verify and rotate endpoints")
	fs.BoolVar(&f.MetricsOmitSecretLabels, "metrics-omit-secret-labels", false, "When true, the sealed_secrets_controller_condition_info metric is not updated, so the metrics endpoint does not expose SealedSecret namespaces and names. Use this if :8081 is reachable by users who should not be able to enumerate SealedSecret inventory.")
	fs.StringVar(&f.PrivateKeyAnnotations, "privatekey-annotations", "", "Comma-separated list of additional annotations to be put on renewed sealing keys.")
	fs.StringVar(&f.PrivateKeyLabels, "privatekey-labels", "", "Comma-separated list of additional labels to be put on renewed sealing keys.")

	fs.BoolVar(&f.OldGCBehavior, "old-gc-behavior", false, "Revert to old GC behavior where the controller deletes secrets instead of delegating that to k8s itself.")

	fs.BoolVar(&f.UpdateStatus, "update-status", true, "if true, the controller will update the status sub-resource whenever it processes a sealed secret (stable; enabled by default since v0.17.0)")
	fs.BoolVar(&f.WatchForSecrets, "watch-for-secrets", false, "beta: If this is true, the controller will watch for key secrets. This is useful if you create the key secrets externally.")

	fs.BoolVar(&f.SkipRecreate, "skip-recreate", false, "if true the controller will skip listening for managed secret changes to recreate them. This helps on limited permission environments.")

	fs.BoolVar(&f.LogInfoToStdout, "log-info-stdout", true, "if true the controller will log info to stdout and error/warn to stderr.")
	fs.StringVar(&f.LogLevel, "log-level", "INFO", "Log level (INFO|ERROR).")
	fs.StringVar(&f.LogFormat, "log-format", "text", "Log format (text|json).")

	fs.DurationVar(&f.KeyRenewPeriod, "rotate-period", defaultKeyRenewPeriod, "")
	_ = fs.MarkDeprecated("rotate-period", "please use key-renew-period instead")

	fs.IntVar(&f.MaxRetries, "max-unseal-retries", 5, "Max unseal retries.")

	fs.Float32Var(&f.KubeClientQPS, "kubeclient-qps", 5, "Kubeclient QPS (negative value disables ratelimiting)")
	fs.IntVar(&f.KubeClientBurst, "kubeclient-burst", 10, "Kubeclient Burst")
}

func bindFlags(f *controller.Flags, fs *flag.FlagSet, gofs *goflag.FlagSet) {
	bindControllerFlags(f, fs)

	flagenv.SetFlagsFromEnv(flagEnvPrefix, gofs)
	pflagenv.SetFlagsFromEnv(flagEnvPrefix, fs)

	// Standard goflags (glog in particular)
	fs.AddGoFlagSet(gofs)
	if f := fs.Lookup("logtostderr"); f != nil {
		f.DefValue = "true"
		_ = f.Value.Set(f.DefValue)
	}
}

func mainE(w io.Writer, fs *flag.FlagSet, gofs *goflag.FlagSet, args []string) error {
	var printVersion bool
	var flags controller.Flags

	buildinfo.FallbackVersion(&VERSION, buildinfo.DefaultVersion)
	fs.BoolVar(&printVersion, "version", false, "Print version information and exit")
	bindFlags(&flags, fs, gofs)
	if err := fs.Parse(args); err != nil {
		return err
	}
	if err := gofs.Parse([]string{}); err != nil {
		return err
	}

	// Set logging
	logLevel := slog.Level(0)
	_ = logLevel.UnmarshalText([]byte(flags.LogLevel))
	opts := &slog.HandlerOptions{
		Level: logLevel,
	}
	if flags.LogInfoToStdout {
		slog.SetDefault(slog.New(log.New(os.Stdout, os.Stderr, flags.LogFormat, opts)))
	} else {
		slog.SetDefault(slog.New(log.New(os.Stderr, os.Stderr, flags.LogFormat, opts)))
	}

	ssv1alpha1.AcceptDeprecatedV1Data = flags.AcceptV1Data

	if printVersion {
		fmt.Fprintf(w, "controller version: %s\n", VERSION)
		return nil
	}

	slog.Info("Starting sealed-secrets controller", "version", VERSION)
	if err := controller.Main(&flags, VERSION); err != nil {
		panic(err)
	}
	return nil
}

func main() {
	if err := mainE(os.Stdout, flag.CommandLine, goflag.CommandLine, os.Args); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

```

### Core Architecture Module: `cmd/kubeseal/main.go`
```
package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"

	goflag "flag"

	ssv1alpha1 "github.com/bitnami/sealed-secrets/pkg/apis/sealedsecrets/v1alpha1"
	"github.com/google/renameio"
	"github.com/mattn/go-isatty"
	flag "github.com/spf13/pflag"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/klog/v2"

	"github.com/bitnami/sealed-secrets/pkg/buildinfo"
	"github.com/bitnami/sealed-secrets/pkg/flagenv"
	"github.com/bitnami/sealed-secrets/pkg/kubeseal"
	"github.com/bitnami/sealed-secrets/pkg/pflagenv"

	// Register Auth providers.
	_ "k8s.io/client-go/plugin/pkg/client/auth"
)

const (
	flagEnvPrefix = "SEALED_SECRETS"
)

var (
	// VERSION set from Makefile.
	VERSION = buildinfo.DefaultVersion
)

type cliFlags struct {
	certURL        string
	controllerNs   string
	controllerName string
	outputFormat   string
	outputFileName string
	inputFileName  string
	kubeconfig     string
	dumpCert       bool
	allowEmptyData bool
	validateSecret bool
	mergeInto      string
	raw            bool
	secretName     string
	fromFile       []string
	sealingScope   ssv1alpha1.SealingScope
	reEncrypt      bool
	unseal         bool
	privKeys       []string
	help           bool
}

type config struct {
	flags        *cliFlags
	clientConfig kubeseal.ClientConfig
	ctx          context.Context
}

func newConfig(clientConfig clientcmd.ClientConfig, flags *cliFlags) *config {
	return &config{
		flags:        flags,
		clientConfig: clientConfig,
		ctx:          context.Background(),
	}
}

func initClient(kubeConfigPath string, cfgOverrides *clientcmd.ConfigOverrides, r io.Reader) clientcmd.ClientConfig {
	loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	loadingRules.DefaultClientConfig = &clientcmd.DefaultClientConfig
	loadingRules.ExplicitPath = kubeConfigPath
	return clientcmd.NewInteractiveDeferredLoadingClientConfig(loadingRules, cfgOverrides, r)
}

func bindFlags(f *cliFlags, fs *flag.FlagSet) {
	// TODO: Verify k8s server signature against cert in kube client config.
	fs.StringVar(&f.certURL, "cert", "", "Certificate / public key file/URL to use for encryption. Overrides --controller-*")
	fs.StringVar(&f.controllerNs, "controller-namespace", metav1.NamespaceSystem, "Namespace of sealed-secrets controller.")
	fs.StringVar(&f.controllerName, "controller-name", "sealed-secrets-controller", "Name of sealed-secrets controller.")
	fs.StringVarP(&f.outputFormat, "format", "o", "json", "Output format for sealed secret. Either json or yaml")
	fs.StringVarP(&f.outputFileName, "sealed-secret-file", "w", "", "Sealed-secret (output) file")
	fs.StringVarP(&f.inputFileName, "secret-file", "f", "", "Secret (input) file")
	fs.BoolVar(&f.dumpCert, "fetch-cert", false, "Write certificate to stdout. Useful for later use with --cert")
	fs.BoolVar(&f.allowEmptyData, "allow-empty-data", false, "Allow empty data in the secret object")
	fs.BoolVar(&f.validateSecret, "validate", false, "Validate that the sealed secret can be decrypted")
	fs.StringVar(&f.mergeInto, "merge-into", "", "Merge items from secret into an existing sealed secret file, updating the file in-place instead of writing to stdout.")
	fs.BoolVar(&f.raw, "raw", false, "Encrypt a raw value passed via the --from-* flags instead of the whole secret object")
	fs.StringVar(&f.secretName, "name", "", "Name of the sealed secret (required with --raw and default (strict) scope)")
	fs.StringSliceVar(&f.fromFile, "from-file", nil, "(only with --raw) Secret items can be sourced from files. Pro-tip: you can use /dev/stdin to read pipe input. This flag tries to follow the same syntax as in kubectl")
	fs.StringVar(&f.kubeconfig, "kubeconfig", "", "Path to a kube config. Only required if out-of-cluster")

	fs.Var(&f.sealingScope, "scope", "Set the scope of the sealed secret: strict, namespace-wide, cluster-wide (defaults to strict). Mandatory for --raw, otherwise the 'sealedsecrets.bitnami.com/cluster-wide' and 'sealedsecrets.bitnami.com/namespace-wide' annotations on the input secret can be used to select the scope.")
	fs.BoolVar(&f.reEncrypt, "rotate", false, "")
	fs.BoolVar(&f.reEncrypt, "re-encrypt", false, "Re-encrypt the given sealed secret to use the latest cluster key.")
	_ = fs.MarkDeprecated("rotate", "please use --re-encrypt instead")

	fs.BoolVar(&f.unseal, "recovery-unseal", false, "Decrypt a sealed secrets file obtained from stdin, using the private key passed with --recovery-private-key. Intended to be used in disaster recovery mode.")
	fs.StringSliceVar(&f.privKeys, "recovery-private-key", nil, "Private key filename used by the --recovery-unseal command. Multiple files accepted either via comma separated list or by repetition of the flag. Either PEM encoded private keys or a backup of a json/yaml encoded k8s sealed-secret controller secret (and v1.List) are accepted. ")
	fs.BoolVar(&f.help, "help", false, "Print this help message")

	fs.SetOutput(os.Stdout)
}

func bindClientFlags(fs *flag.FlagSet, gofs *goflag.FlagSet, overrides *clientcmd.ConfigOverrides) {
	flagenv.SetFlagsFromEnv(flagEnvPrefix, gofs)

	initUsualKubectlFlags(overrides, fs)

	pflagenv.SetFlagsFromEnv(flagEnvPrefix, fs)

	// add klog flags to goflags flagset
	klog.InitFlags(nil)
	// Standard goflags (glog in particular)
	fs.AddGoFlagSet(gofs)
}

func initUsualKubectlFlags(overrides *clientcmd.ConfigOverrides, fs *flag.FlagSet) {
	kflags := clientcmd.RecommendedConfigOverrideFlags("")
	clientcmd.BindOverrideFlags(overrides, fs, kflags)
}

func runCLI(w io.Writer, cfg *config) (err error) {
	flags := cfg.flags

	if flags.help {
		fmt.Fprintf(os.Stdout, "Usage of %s:\n", os.Args[0])
		flag.PrintDefaults()
		return nil
	}

	if len(flags.fromFile) != 0 && !flags.raw {
		return fmt.Errorf("--from-file requires --raw")
	}

	var input io.Reader = os.Stdin
	if flags.inputFileName != "" {
		// #nosec G304 -- should open user provided file
		f, err := os.Open(flags.inputFileName)
		if err != nil {
			return fmt.Errorf("Could not read file specified with --secret-file")
		}
		// #nosec: G307 -- this deferred close is fine because it is not on a writable file
		defer f.Close()

		input = f
	} else if !flags.raw && !flags.dumpCert {
		if isatty.IsTerminal(os.Stdin.Fd()) {
			fmt.Fprintf(os.Stderr, "(tty detected: expecting json/yaml k8s resource in stdin)\n")
		}
	}

	// reEncrypt is the only "in-place" update subcommand. When the user only provides one file (the input file)
	// we'll use the same file for output (see #405).
	if flags.reEncrypt && (flags.outputFileName == "" && flags.inputFileName != "") {
		flags.outputFileName = flags.inputFileName
	}
	if flags.outputFileName != "" {
		if ext := filepath.Ext(flags.outputFileName); ext == ".yaml" || ext == ".yml" {
			flags.outputFormat = "yaml"
		}

		var f *renameio.PendingFile
		f, err = renameio.TempFile("", flags.outputFileName)
		if err != nil {
			return err
		}
		// only write the output file if the run function exits without errors.
		defer func() {
			if err == nil {
				_ = f.CloseAtomicallyReplace()
			}
		}()

		w = f
	}

	if flags.unseal {
		return kubeseal.UnsealSealedSecret(w, input, flags.privKeys, flags.outputFormat, scheme.Codecs)
	}
	if len(flags.privKeys) != 0 && isatty.IsTerminal(os.Stderr.Fd()) {
		fmt.Fprintf(os.Stderr, "warning: ignoring --recovery-private-key because unseal command not chosen with --recovery-unseal\n")
	}

	if flags.validateSecret {
		return kubeseal.ValidateSealedSecret(cfg.ctx, cfg.clientConfig, flags.controllerNs, flags.controllerName, input)
	}

	if flags.reEncrypt {
		return kubeseal.ReEncryptSealedSecret(cfg.ctx, cfg.clientConfig, flags.controllerNs, flags.controllerName, flags.outputFormat, input, w, scheme.Codecs)
	}

	f, err := kubeseal.OpenCert(cfg.ctx, cfg.clientConfig, flags.controllerNs, flags.controllerName, flags.certURL)
	if err != nil {
		return err
	}
	// #nosec: G307 -- this deferred close is fine because it is not on a writable file
	defer f.Close()

	if flags.dumpCert {
		_, err := io.Copy(w, f)
		return err
	}

	pubKey, err := kubeseal.ParseKey(f)
	if err != nil {
		return err
	}

	if flags.mergeInto != "" {
		return kubeseal.SealMergingInto(cfg.clientConfig, flags.outputFormat, input, flags.mergeInto, scheme.Codecs, pubKey, flags.sealingScope, flags.allowEmptyData)
	}

	if flags.raw {
		var (
			ns  string
			err error
		)
		if flags.sealingScope < ssv1alpha1.ClusterWideScope {
			ns, _, err = cfg.clientConfig.Namespace()
			if err != nil {
				return err
			}

			if ns == "" {
				return fmt.Errorf("must provide the --namespace flag with --raw and --scope %s", flags.sealingScope.String())
			}

			if flags.secretName == "" && flags.sealingScope < ssv1alpha1.NamespaceWideScope {
				return fmt.Errorf("must provide the --name flag with --raw and --scope %s", flags.sealingScope.String())
			}
		}

		var data []byte
		if len(flags.fromFile) > 0 {
			if len(flags.fromFile) > 1 {
				return fmt.Errorf("must provide only one --from-file when encrypting a single item with --raw")
			}

			_, filename := kubeseal.ParseFromFile(flags.fromFile[0])
			// #nosec G304 -- should open user provided file
			data, err = os.ReadFile(filename)
		} else {
			if isatty.IsTerminal(os.Stdin.Fd()) {
				fmt.Fprintf(os.Stderr, "(tty detected: expecting a secret to encrypt in stdin)\n")
			}
			data, err = io.ReadAll(os.Stdin)
		}
		if err != nil {
			return err
		}

		return kubeseal.EncryptSecretItem(w, flags.secretName, ns, data, flags.sealingScope, pubKey)
	}

	return kubeseal.Seal(cfg.clientConfig, flags.outputFormat, input, w, scheme.Codecs, pubKey, flags.sealingScope, flags.allowEmptyData, flags.secretName, "")
}

func mainE(w io.Writer, fs *flag.FlagSet, gofs *goflag.FlagSet, args []string) error {
	var flags cliFlags
	var printVersion bool
	var overrides clientcmd.ConfigOverrides
	buildinfo.FallbackVersion(&VERSION, buildinfo.DefaultVersion)

	fs.BoolVar(&printVersion, "version", false, "Print version information and exit")
	bindFlags(&
```

### Core Architecture Module: `hack/tools.go`
```
// This file forces go mod to include dependencies used during build, such as
// code generation tools.
// The build tag below ensures this dep is not pulled during normal builds.

//go:build tools
// +build tools

package tools

import (
	_ "k8s.io/code-generator"
	_ "k8s.io/code-generator/cmd/conversion-gen"
	_ "k8s.io/code-generator/cmd/deepcopy-gen"
	_ "k8s.io/code-generator/cmd/defaulter-gen"
	_ "k8s.io/code-generator/cmd/validation-gen"
)

```

### Core Architecture Module: `pkg/apis/sealedsecrets/v1alpha1/doc.go`
```
// +k8s:deepcopy-gen=package,register

// +groupName=bitnami.com

// Package v1alpha1 contains the definition of the sealed-secrets v1alpha1 API. Some of the code in this package is generated.
package v1alpha1

```

### Core Architecture Module: `pkg/apis/sealedsecrets/v1alpha1/register.go`
```
package v1alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/client-go/kubernetes/scheme"
)

// GroupName is the group name used in this package.
const GroupName = "bitnami.com"

var (
	// SchemeGroupVersion is the group version used to register these objects.
	SchemeGroupVersion = schema.GroupVersion{Group: GroupName, Version: "v1alpha1"}

	// SchemeBuilder adds this group to scheme.
	SchemeBuilder = runtime.NewSchemeBuilder(addKnownTypes)
	// AddToScheme is a global function that registers this API group & version to a scheme.
	AddToScheme = SchemeBuilder.AddToScheme
)

func init() {
	utilruntime.Must(SchemeBuilder.AddToScheme(scheme.Scheme))
}

// Resource takes an unqualified resource and returns a Group qualified GroupResource.
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}

func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(SchemeGroupVersion,
		&SealedSecret{},
		&SealedSecretList{},
	)
	metav1.AddToGroupVersion(scheme, SchemeGroupVersion)
	return nil
}

```

### Core Architecture Module: `pkg/apis/sealedsecrets/v1alpha1/sealedsecret_expansion.go`
```
package v1alpha1

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"errors"
	"fmt"
	"text/template"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	runtimeserializer "k8s.io/apimachinery/pkg/runtime/serializer"

	"github.com/Masterminds/sprig/v3"
	"github.com/mkmik/multierror"

	"github.com/bitnami/sealed-secrets/pkg/crypto"
)

const (
	// The StrictScope pins the sealed secret to a specific namespace and a specific name.
	StrictScope SealingScope = iota
	// The NamespaceWideScope only pins a sealed secret to a specific namespace.
	NamespaceWideScope
	// The ClusterWideScope allows the sealed secret to be unsealed in any namespace of the cluster.
	ClusterWideScope

	// The DefaultScope is currently the StrictScope.
	DefaultScope = StrictScope
)

var (
	// TODO(mkm): remove after a release.
	AcceptDeprecatedV1Data = false

	sprigFuncMap = sprig.GenericFuncMap() // a singleton for better performance
)

func init() {
	// Avoid allowing the user to learn things about the environment.
	delete(sprigFuncMap, "env")
	delete(sprigFuncMap, "expandenv")
	delete(sprigFuncMap, "getHostByName")
}

// SealedSecretExpansion has methods to work with SealedSecrets resources.
type SealedSecretExpansion interface {
	Unseal(codecs runtimeserializer.CodecFactory, privKeys map[string]*rsa.PrivateKey) (*v1.Secret, error)
}

// SealingScope is an enum that declares the mobility of a sealed secret by defining
// in which scopes.
type SealingScope int

func (s *SealingScope) String() string {
	switch *s {
	case StrictScope:
		return "strict"
	case NamespaceWideScope:
		return "namespace-wide"
	case ClusterWideScope:
		return "cluster-wide"
	default:
		return fmt.Sprintf("undefined-%d", *s)
	}
}

func (s *SealingScope) Set(v string) error {
	switch v {
	case "":
		*s = DefaultScope
	case "strict":
		*s = StrictScope
	case "namespace-wide":
		*s = NamespaceWideScope
	case "cluster-wide":
		*s = ClusterWideScope
	default:
		return fmt.Errorf("must be one of: strict, namespace-wide, cluster-wide")
	}
	return nil
}

// Type implements the pflag.Value interface.
func (s *SealingScope) Type() string { return "string" }

// EncryptionLabel returns the label meant to be used for encrypting a sealed secret according to scope.
func EncryptionLabel(namespace, name string, scope SealingScope) []byte {
	var l string
	switch scope {
	case ClusterWideScope:
		l = ""
	case NamespaceWideScope:
		l = namespace
	case StrictScope:
		fallthrough
	default:
		l = fmt.Sprintf("%s/%s", namespace, name)
	}
	return []byte(l)
}

// Returns labels followed by clusterWide followed by namespaceWide.
func labelFor(o metav1.Object) []byte {
	return EncryptionLabel(o.GetNamespace(), o.GetName(), SecretScope(o))
}

// SecretScope returns the scope of a secret to be sealed, as annotated in its metadata.
func SecretScope(o metav1.Object) SealingScope {
	if o.GetAnnotations()[SealedSecretClusterWideAnnotation] == "true" {
		return ClusterWideScope
	}
	if o.GetAnnotations()[SealedSecretNamespaceWideAnnotation] == "true" {
		return NamespaceWideScope
	}
	return StrictScope
}

// Scope returns the scope of the sealed secret, as annotated in its metadata.
func (s *SealedSecret) Scope() SealingScope {
	return SecretScope(&s.Spec.Template)
}

// NewSealedSecretV1 creates a new SealedSecret object wrapping the
// provided secret. This encrypts all the secrets into a single encrypted
// blob and stores it in the `Data` attribute. Keeping this for backward
// compatibility.
func NewSealedSecretV1(codecs runtimeserializer.CodecFactory, pubKey *rsa.PublicKey, secret *v1.Secret) (*SealedSecret, error) {
	info, ok := runtime.SerializerInfoForMediaType(codecs.SupportedMediaTypes(), runtime.ContentTypeJSON)
	if !ok {
		return nil, fmt.Errorf("binary can't serialize JSON")
	}

	if SecretScope(secret) != ClusterWideScope && secret.GetNamespace() == "" {
		return nil, fmt.Errorf("secret must declare a namespace")
	}

	codec := codecs.EncoderForVersion(info.Serializer, v1.SchemeGroupVersion)
	plaintext, err := runtime.Encode(codec, secret)
	if err != nil {
		return nil, err
	}

	// RSA-OAEP will fail to decrypt unless the same label is used
	// during decryption.
	label := labelFor(secret)

	ciphertext, err := crypto.HybridEncrypt(rand.Reader, pubKey, plaintext, label)
	if err != nil {
		return nil, err
	}

	s := &SealedSecret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      secret.GetName(),
			Namespace: secret.GetNamespace(),
		},
		Spec: SealedSecretSpec{
			Data: ciphertext,
		},
	}

	s.Annotations = UpdateScopeAnnotations(s.Annotations, SecretScope(secret))

	return s, nil
}

// UpdateScopeAnnotations updates the annotation map so that it reflects the desired scope.
// It does so by updating and/or deleting existing annotations.
func UpdateScopeAnnotations(anno map[string]string, scope SealingScope) map[string]string {
	if anno == nil {
		anno = map[string]string{}
	}
	delete(anno, SealedSecretNamespaceWideAnnotation)
	delete(anno, SealedSecretClusterWideAnnotation)

	if scope == NamespaceWideScope {
		anno[SealedSecretNamespaceWideAnnotation] = "true"
	}
	if scope == ClusterWideScope {
		anno[SealedSecretClusterWideAnnotation] = "true"
	}
	return anno
}

// StripLastAppliedAnnotations strips annotations added by tools such as kubectl and kubecfg
// that contain a full copy of the original object kept in the annotation for strategic-merge-patch
// purposes. We need to remove these annotations when sealing an existing secret otherwise we'd leak
// the secrets.
func StripLastAppliedAnnotations(annotations map[string]string) {
	if annotations == nil {
		return
	}
	keys := []string{
		"kubectl.kubernetes.io/last-applied-configuration",
		"kubecfg.ksonnet.io/last-applied-configuration",
	}
	for _, k := range keys {
		delete(annotations, k)
	}
}

// NewSealedSecret creates a new SealedSecret object wrapping the
// provided secret. This encrypts only the values of each secrets
// individually, so secrets can be updated one by one.
func NewSealedSecret(codecs runtimeserializer.CodecFactory, pubKey *rsa.PublicKey, secret *v1.Secret) (*SealedSecret, error) {
	if SecretScope(secret) != ClusterWideScope && secret.GetNamespace() == "" {
		return nil, fmt.Errorf("secret must declare a namespace")
	}

	s := &SealedSecret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      secret.GetName(),
			Namespace: secret.GetNamespace(),
		},
		Spec: SealedSecretSpec{
			Template: SecretTemplateSpec{
				// ObjectMeta copied below
				Type:      secret.Type,
				Immutable: secret.Immutable,
			},
			EncryptedData: map[string]string{},
		},
	}
	secret.ObjectMeta.DeepCopyInto(&s.Spec.Template.ObjectMeta)

	// the input secret could come from a real secret object applied with `kubectl apply` or similar tools
	// which put a copy of the object version at application time in an annotation in order to support
	// strategic merge patch in subsequent updates. We need to strip those annotations or else we would
	// be leaking secrets in clear in a way that might be non obvious to users.
	// See https://github.com/bitnami/sealed-secrets/issues/227
	StripLastAppliedAnnotations(s.Spec.Template.ObjectMeta.Annotations)

	// Cleanup ownerReference (See #243)
	s.Spec.Template.ObjectMeta.OwnerReferences = nil

	// RSA-OAEP will fail to decrypt unless the same label is used
	// during decryption.
	label := labelFor(secret)

	for key, value := range secret.Data {
		ciphertext, err := crypto.HybridEncrypt(rand.Reader, pubKey, value, label)
		if err != nil {
			return nil, err
		}
		s.Spec.EncryptedData[key] = base64.StdEncoding.EncodeToString(ciphertext)
	}

	for key, value := range secret.StringData {
		ciphertext, err := crypto.HybridEncrypt(rand.Reader, pubKey, []byte(value), label)
		if err != nil {
			return nil, err
		}
		s.Spec.EncryptedData[key] = base64.StdEncoding.EncodeToString(ciphertext)
	}

	s.Annotations = UpdateScopeAnnotations(s.Annotations, SecretScope(secret))

	return s, nil
}

// ValidateEncryptedData checks decryptability without rendering spec.template.data.
func (s *SealedSecret) ValidateEncryptedData(privKeys map[string]*rsa.PrivateKey) error {
	label := labelFor(s.GetObjectMeta())

	if s.Spec.Data == nil {
		var errs []error
		for key, value := range s.Spec.EncryptedData {
			valueBytes, err := base64.StdEncoding.DecodeString(value)
			if err != nil {
				errs = append(errs, multierror.Tag(key, err))
				continue
			}
			if _, err := crypto.HybridDecrypt(rand.Reader, privKeys, valueBytes, label); err != nil {
				errs = append(errs, multierror.Tag(key, err))
			}
		}
		if errs != nil {
			return multierror.Format(errors.Join(multierror.Uniq(errs)...), multierror.InlineFormatter)
		}
		return nil
	} else if AcceptDeprecatedV1Data { // Support decrypting old secrets for backward compatibility
		if len(s.Spec.EncryptedData) > 0 {
			return fmt.Errorf("cannot use the field 'encryptedData' and the deprecated field 'data' at the same time")
		}
		_, err := crypto.HybridDecrypt(rand.Reader, privKeys, s.Spec.Data, label)
		return err
	}
	return fmt.Errorf("using deprecated 'data' field, use 'encryptedData' or flip the feature flag")
}

// Unseal decrypts and returns the embedded v1.Secret, rendering spec.template.data as a Go template.
func (s *SealedSecret) Unseal(codecs runtimeserializer.CodecFactory, privKeys map[string]*rsa.PrivateKey) (*v1.Secret, error) {
	return s.unseal(codecs, privKeys, true)
}

// UnsealWithoutTemplate is like Unseal but skips rendering spec.template.data, since it's not authenticated and could be used as a decryption oracle.
func (s *SealedSecret) UnsealWithoutTemplate(codecs runtimeserializer.CodecFactory, privKeys map[string]*rsa.PrivateKey) (*v1.Secret, error) {
	return s.unseal(codecs, privKeys, false)
}

func (s *SealedSecret) unseal(codecs runtimeserializer.CodecFactory, privKeys map[string]*rsa.PrivateKey, renderTemplate bool) (*v1.Secret, error) {
	boolTrue := true
	smeta := s.GetObjectMeta()

	// This will
```

### Core Architecture Module: `pkg/apis/sealedsecrets/v1alpha1/types.go`
```
package v1alpha1

import (
	"encoding/json"

	apiv1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	// SealedSecretName is the name used in SealedSecret CRD.
	SealedSecretName = "sealed-secret." + GroupName
	// SealedSecretPlural is the collection plural used with SealedSecret API.
	SealedSecretPlural = "sealedsecrets"

	// Annotation namespace prefix.
	annoNs = "sealedsecrets." + GroupName + "/"

	// SealedSecretClusterWideAnnotation is the name for the annotation for
	// setting the secret to be available cluster wide.
	SealedSecretClusterWideAnnotation = annoNs + "cluster-wide"

	// SealedSecretNamespaceWideAnnotation is the name for the annotation for
	// setting the secret to be available namespace wide.
	SealedSecretNamespaceWideAnnotation = annoNs + "namespace-wide"

	// SealedSecretManagedAnnotation is the name for the annotation for
	// flagging existing secrets to be managed by the Sealed Secrets controller.
	SealedSecretManagedAnnotation = annoNs + "managed"

	// SealedSecretPatchAnnotation is the name for the annotation for
	// flagging existing secrets to be patched instead of overwritten by the Sealed Secrets controller.
	SealedSecretPatchAnnotation = annoNs + "patch"

	// SealedSecretSkipSetOwnerReferencesAnnotation is the name for the annotation for
	// flagging the controller not to set owner reference to secret.
	SealedSecretSkipSetOwnerReferencesAnnotation = annoNs + "skip-set-owner-references"
)

// SecretTemplateSpec describes the structure a Secret should have
// when created from a template.
type SecretTemplateSpec struct {
	// Standard object's metadata.
	// More info: https://git.k8s.io/community/contributors/devel/api-conventions.md#metadata
	// +optional
	// +nullable
	// +kubebuilder:pruning:PreserveUnknownFields
	metav1.ObjectMeta `json:"metadata,omitempty" protobuf:"bytes,1,opt,name=metadata"`

	// Used to facilitate programmatic handling of secret data.
	// +optional
	Type apiv1.SecretType `json:"type,omitempty" protobuf:"bytes,3,opt,name=type,casttype=SecretType"`

	// Immutable, if set to true, ensures that data stored in the Secret cannot
	// be updated (only object metadata can be modified).
	// If not set to true, the field can be modified at any time.
	// Defaulted to nil.
	// +optional
	Immutable *bool `json:"immutable,omitempty" protobuf:"varint,5,opt,name=immutable"`

	// Keys that should be templated using decrypted data.
	// Set a key with the same name as in `encryptedData`
	// to `null` to omit the unsealed data from the final secret.
	// +optional
	// +nullable
	Data map[string]*string `json:"data,omitempty"`
}

// SealedSecretSpec is the specification of a SealedSecret.
type SealedSecretSpec struct {
	// Template defines the structure of the Secret that will be
	// created from this sealed secret.
	// +optional
	Template SecretTemplateSpec `json:"template,omitempty"`

	// Data is deprecated and will be removed eventually. Use per-value EncryptedData instead.
	Data          []byte                    `json:"data,omitempty"`
	EncryptedData SealedSecretEncryptedData `json:"encryptedData"`
}

// +kubebuilder:pruning:PreserveUnknownFields
type SealedSecretEncryptedData map[string]string

func (s *SealedSecretEncryptedData) UnmarshalJSON(data []byte) error {
	tmp := map[string]string{}
	// drop error - likelihood of an error occurring is quite high due to the disabled schema validation, these errors.
	// would cause the controller to stop processing any SealedSecret.
	_ = json.Unmarshal(data, &tmp)
	*s = tmp
	return nil
}

// SealedSecretConditionType describes the type of SealedSecret condition.
type SealedSecretConditionType string

const (
	// SealedSecretSynced means the SealedSecret has been decrypted and the Secret has been updated successfully.
	SealedSecretSynced SealedSecretConditionType = "Synced"
)

// SealedSecretCondition describes the state of a sealed secret at a certain point.
type SealedSecretCondition struct {
	// Type of condition for a sealed secret.
	// Valid value: "Synced"
	Type SealedSecretConditionType `json:"type" protobuf:"bytes,1,opt,name=type,casttype=DeploymentConditionType"`
	// Status of the condition for a sealed secret.
	// Valid values for "Synced": "True", "False", or "Unknown".
	Status apiv1.ConditionStatus `json:"status" protobuf:"bytes,2,opt,name=status,casttype=k8s.io/api/core/v1.ConditionStatus"`
	// The last time this condition was updated.
	LastUpdateTime metav1.Time `json:"lastUpdateTime,omitempty" protobuf:"bytes,6,opt,name=lastUpdateTime"`
	// Last time the condition transitioned from one status to another.
	LastTransitionTime metav1.Time `json:"lastTransitionTime,omitempty" protobuf:"bytes,7,opt,name=lastTransitionTime"`
	// The reason for the condition's last transition.
	Reason string `json:"reason,omitempty" protobuf:"bytes,4,opt,name=reason"`
	// A human readable message indicating details about the transition.
	Message string `json:"message,omitempty" protobuf:"bytes,5,opt,name=message"`
}

// SealedSecretStatus is the most recently observed status of the SealedSecret.
type SealedSecretStatus struct {
	// ObservedGeneration reflects the generation most recently observed by the sealed-secrets controller.
	// +optional
	ObservedGeneration int64 `json:"observedGeneration,omitempty" protobuf:"varint,3,opt,name=observedGeneration"`

	// Represents the latest available observations of a sealed secret's current state.
	// +optional
	// +patchMergeKey=type
	// +patchStrategy=merge
	Conditions []SealedSecretCondition `json:"conditions,omitempty" patchStrategy:"merge" patchMergeKey:"type" protobuf:"bytes,6,rep,name=conditions"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +kubebuilder:subresource:status
// +kubebuilder:printcolumn:name="Status",type="string",JSONPath=".status.conditions[0].message"
// +kubebuilder:printcolumn:name="Synced",type="string",JSONPath=".status.conditions[0].status"
// +kubebuilder:printcolumn:name="Age",type="date",JSONPath=".metadata.creationTimestamp"
// +genclient

// SealedSecret is the K8s representation of a "sealed Secret" - a
// regular k8s Secret that has been sealed (encrypted) using the
// controller's key.
type SealedSecret struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec SealedSecretSpec `json:"spec"`
	// +optional
	Status *SealedSecretStatus `json:"status,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// SealedSecretList represents a list of SealedSecrets.
type SealedSecretList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata"`

	Items []SealedSecret `json:"items"`
}

// ByCreationTimestamp is used to sort a list of secrets.
type ByCreationTimestamp []apiv1.Secret

func (s ByCreationTimestamp) Len() int {
	return len(s)
}

func (s ByCreationTimestamp) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}

func (s ByCreationTimestamp) Less(i, j int) bool {
	return s[i].GetCreationTimestamp().Unix() < s[j].GetCreationTimestamp().Unix()
}

```

### Core Architecture Module: `pkg/apis/sealedsecrets/v1alpha1/zz_generated.deepcopy.go`
```
//go:build !ignore_autogenerated
// +build !ignore_autogenerated

// Code generated by deepcopy-gen. DO NOT EDIT.

package v1alpha1

import (
	runtime "k8s.io/apimachinery/pkg/runtime"
)

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in ByCreationTimestamp) DeepCopyInto(out *ByCreationTimestamp) {
	{
		in := &in
		*out = make(ByCreationTimestamp, len(*in))
		for i := range *in {
			(*in)[i].DeepCopyInto(&(*out)[i])
		}
		return
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new ByCreationTimestamp.
func (in ByCreationTimestamp) DeepCopy() ByCreationTimestamp {
	if in == nil {
		return nil
	}
	out := new(ByCreationTimestamp)
	in.DeepCopyInto(out)
	return *out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *SealedSecret) DeepCopyInto(out *SealedSecret) {
	*out = *in
	out.TypeMeta = in.TypeMeta
	in.ObjectMeta.DeepCopyInto(&out.ObjectMeta)
	in.Spec.DeepCopyInto(&out.Spec)
	if in.Status != nil {
		in, out := &in.Status, &out.Status
		*out = new(SealedSecretStatus)
		(*in).DeepCopyInto(*out)
	}
	return
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new SealedSecret.
func (in *SealedSecret) DeepCopy() *SealedSecret {
	if in == nil {
		return nil
	}
	out := new(SealedSecret)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyObject is an autogenerated deepcopy function, copying the receiver, creating a new runtime.Object.
func (in *SealedSecret) DeepCopyObject() runtime.Object {
	if c := in.DeepCopy(); c != nil {
		return c
	}
	return nil
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *SealedSecretCondition) DeepCopyInto(out *SealedSecretCondition) {
	*out = *in
	in.LastUpdateTime.DeepCopyInto(&out.LastUpdateTime)
	in.LastTransitionTime.DeepCopyInto(&out.LastTransitionTime)
	return
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new SealedSecretCondition.
func (in *SealedSecretCondition) DeepCopy() *SealedSecretCondition {
	if in == nil {
		return nil
	}
	out := new(SealedSecretCondition)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in SealedSecretEncryptedData) DeepCopyInto(out *SealedSecretEncryptedData) {
	{
		in := &in
		*out = make(SealedSecretEncryptedData, len(*in))
		for key, val := range *in {
			(*out)[key] = val
		}
		return
	}
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new SealedSecretEncryptedData.
func (in SealedSecretEncryptedData) DeepCopy() SealedSecretEncryptedData {
	if in == nil {
		return nil
	}
	out := new(SealedSecretEncryptedData)
	in.DeepCopyInto(out)
	return *out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *SealedSecretList) DeepCopyInto(out *SealedSecretList) {
	*out = *in
	out.TypeMeta = in.TypeMeta
	in.ListMeta.DeepCopyInto(&out.ListMeta)
	if in.Items != nil {
		in, out := &in.Items, &out.Items
		*out = make([]SealedSecret, len(*in))
		for i := range *in {
			(*in)[i].DeepCopyInto(&(*out)[i])
		}
	}
	return
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new SealedSecretList.
func (in *SealedSecretList) DeepCopy() *SealedSecretList {
	if in == nil {
		return nil
	}
	out := new(SealedSecretList)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyObject is an autogenerated deepcopy function, copying the receiver, creating a new runtime.Object.
func (in *SealedSecretList) DeepCopyObject() runtime.Object {
	if c := in.DeepCopy(); c != nil {
		return c
	}
	return nil
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *SealedSecretSpec) DeepCopyInto(out *SealedSecretSpec) {
	*out = *in
	in.Template.DeepCopyInto(&out.Template)
	if in.Data != nil {
		in, out := &in.Data, &out.Data
		*out = make([]byte, len(*in))
		copy(*out, *in)
	}
	if in.EncryptedData != nil {
		in, out := &in.EncryptedData, &out.EncryptedData
		*out = make(SealedSecretEncryptedData, len(*in))
		for key, val := range *in {
			(*out)[key] = val
		}
	}
	return
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new SealedSecretSpec.
func (in *SealedSecretSpec) DeepCopy() *SealedSecretSpec {
	if in == nil {
		return nil
	}
	out := new(SealedSecretSpec)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *SealedSecretStatus) DeepCopyInto(out *SealedSecretStatus) {
	*out = *in
	if in.Conditions != nil {
		in, out := &in.Conditions, &out.Conditions
		*out = make([]SealedSecretCondition, len(*in))
		for i := range *in {
			(*in)[i].DeepCopyInto(&(*out)[i])
		}
	}
	return
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new SealedSecretStatus.
func (in *SealedSecretStatus) DeepCopy() *SealedSecretStatus {
	if in == nil {
		return nil
	}
	out := new(SealedSecretStatus)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInto is an autogenerated deepcopy function, copying the receiver, writing into out. in must be non-nil.
func (in *SecretTemplateSpec) DeepCopyInto(out *SecretTemplateSpec) {
	*out = *in
	in.ObjectMeta.DeepCopyInto(&out.ObjectMeta)
	if in.Immutable != nil {
		in, out := &in.Immutable, &out.Immutable
		*out = new(bool)
		**out = **in
	}
	if in.Data != nil {
		in, out := &in.Data, &out.Data
		*out = make(map[string]*string, len(*in))
		for key, val := range *in {
			var outVal *string
			if val == nil {
				(*out)[key] = nil
			} else {
				in, out := &val, &outVal
				*out = new(string)
				**out = **in
			}
			(*out)[key] = outVal
		}
	}
	return
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new SecretTemplateSpec.
func (in *SecretTemplateSpec) DeepCopy() *SecretTemplateSpec {
	if in == nil {
		return nil
	}
	out := new(SecretTemplateSpec)
	in.DeepCopyInto(out)
	return out
}

```

### Core Architecture Module: `pkg/client/clientset/versioned/clientset.go`
```
// Code generated by client-gen. DO NOT EDIT.

package versioned

import (
	fmt "fmt"
	http "net/http"

	bitnamiv1alpha1 "github.com/bitnami/sealed-secrets/pkg/client/clientset/versioned/typed/sealedsecrets/v1alpha1"
	discovery "k8s.io/client-go/discovery"
	rest "k8s.io/client-go/rest"
	flowcontrol "k8s.io/client-go/util/flowcontrol"
)

type Interface interface {
	Discovery() discovery.DiscoveryInterface
	BitnamiV1alpha1() bitnamiv1alpha1.BitnamiV1alpha1Interface
}

// Clientset contains the clients for groups.
type Clientset struct {
	*discovery.DiscoveryClient
	bitnamiV1alpha1 *bitnamiv1alpha1.BitnamiV1alpha1Client
}

// BitnamiV1alpha1 retrieves the BitnamiV1alpha1Client
func (c *Clientset) BitnamiV1alpha1() bitnamiv1alpha1.BitnamiV1alpha1Interface {
	return c.bitnamiV1alpha1
}

// Discovery retrieves the DiscoveryClient
func (c *Clientset) Discovery() discovery.DiscoveryInterface {
	if c == nil {
		return nil
	}
	return c.DiscoveryClient
}

// NewForConfig creates a new Clientset for the given config.
// If config's RateLimiter is not set and QPS and Burst are acceptable,
// NewForConfig will generate a rate-limiter in configShallowCopy.
// NewForConfig is equivalent to NewForConfigAndClient(c, httpClient),
// where httpClient was generated with rest.HTTPClientFor(c).
func NewForConfig(c *rest.Config) (*Clientset, error) {
	configShallowCopy := *c

	if configShallowCopy.UserAgent == "" {
		configShallowCopy.UserAgent = rest.DefaultKubernetesUserAgent()
	}

	// share the transport between all clients
	httpClient, err := rest.HTTPClientFor(&configShallowCopy)
	if err != nil {
		return nil, err
	}

	return NewForConfigAndClient(&configShallowCopy, httpClient)
}

// NewForConfigAndClient creates a new Clientset for the given config and http client.
// Note the http client provided takes precedence over the configured transport values.
// If config's RateLimiter is not set and QPS and Burst are acceptable,
// NewForConfigAndClient will generate a rate-limiter in configShallowCopy.
func NewForConfigAndClient(c *rest.Config, httpClient *http.Client) (*Clientset, error) {
	configShallowCopy := *c
	if configShallowCopy.RateLimiter == nil && configShallowCopy.QPS > 0 {
		if configShallowCopy.Burst <= 0 {
			return nil, fmt.Errorf("burst is required to be greater than 0 when RateLimiter is not set and QPS is set to greater than 0")
		}
		configShallowCopy.RateLimiter = flowcontrol.NewTokenBucketRateLimiter(configShallowCopy.QPS, configShallowCopy.Burst)
	}

	var cs Clientset
	var err error
	cs.bitnamiV1alpha1, err = bitnamiv1alpha1.NewForConfigAndClient(&configShallowCopy, httpClient)
	if err != nil {
		return nil, err
	}

	cs.DiscoveryClient, err = discovery.NewDiscoveryClientForConfigAndClient(&configShallowCopy, httpClient)
	if err != nil {
		return nil, err
	}
	return &cs, nil
}

// NewForConfigOrDie creates a new Clientset for the given config and
// panics if there is an error in the config.
func NewForConfigOrDie(c *rest.Config) *Clientset {
	cs, err := NewForConfig(c)
	if err != nil {
		panic(err)
	}
	return cs
}

// New creates a new Clientset for the given RESTClient.
func New(c rest.Interface) *Clientset {
	var cs Clientset
	cs.bitnamiV1alpha1 = bitnamiv1alpha1.New(c)

	cs.DiscoveryClient = discovery.NewDiscoveryClient(c)
	return &cs
}

```

### Core Architecture Module: `pkg/client/clientset/versioned/fake/clientset_generated.go`
```
// Code generated by client-gen. DO NOT EDIT.

package fake

import (
	clientset "github.com/bitnami/sealed-secrets/pkg/client/clientset/versioned"
	bitnamiv1alpha1 "github.com/bitnami/sealed-secrets/pkg/client/clientset/versioned/typed/sealedsecrets/v1alpha1"
	fakebitnamiv1alpha1 "github.com/bitnami/sealed-secrets/pkg/client/clientset/versioned/typed/sealedsecrets/v1alpha1/fake"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/discovery"
	fakediscovery "k8s.io/client-go/discovery/fake"
	"k8s.io/client-go/testing"
)

// NewSimpleClientset returns a clientset that will respond with the provided objects.
// It's backed by a very simple object tracker that processes creates, updates and deletions as-is,
// without applying any field management, validations and/or defaults. It shouldn't be considered a replacement
// for a real clientset and is mostly useful in simple unit tests.
func NewSimpleClientset(objects ...runtime.Object) *Clientset {
	o := testing.NewObjectTracker(scheme, codecs.UniversalDecoder())
	for _, obj := range objects {
		if err := o.Add(obj); err != nil {
			panic(err)
		}
	}

	cs := &Clientset{tracker: o}
	cs.discovery = &fakediscovery.FakeDiscovery{Fake: &cs.Fake}
	cs.AddReactor("*", "*", testing.ObjectReaction(o))
	cs.AddWatchReactor("*", func(action testing.Action) (handled bool, ret watch.Interface, err error) {
		var opts metav1.ListOptions
		if watchAction, ok := action.(testing.WatchActionImpl); ok {
			opts = watchAction.ListOptions
		}
		gvr := action.GetResource()
		ns := action.GetNamespace()
		watch, err := o.Watch(gvr, ns, opts)
		if err != nil {
			return false, nil, err
		}
		return true, watch, nil
	})

	return cs
}

// Clientset implements clientset.Interface. Meant to be embedded into a
// struct to get a default implementation. This makes faking out just the method
// you want to test easier.
type Clientset struct {
	testing.Fake
	discovery *fakediscovery.FakeDiscovery
	tracker   testing.ObjectTracker
}

func (c *Clientset) Discovery() discovery.DiscoveryInterface {
	return c.discovery
}

func (c *Clientset) Tracker() testing.ObjectTracker {
	return c.tracker
}

// IsWatchListSemanticsUnSupported informs the reflector that this client
// doesn't support WatchList semantics.
//
// This is a synthetic method whose sole purpose is to satisfy the optional
// interface check performed by the reflector.
// Returning true signals that WatchList can NOT be used.
// No additional logic is implemented here.
func (c *Clientset) IsWatchListSemanticsUnSupported() bool {
	return true
}

var (
	_ clientset.Interface = &Clientset{}
	_ testing.FakeClient  = &Clientset{}
)

// BitnamiV1alpha1 retrieves the BitnamiV1alpha1Client
func (c *Clientset) BitnamiV1alpha1() bitnamiv1alpha1.BitnamiV1alpha1Interface {
	return &fakebitnamiv1alpha1.FakeBitnamiV1alpha1{Fake: &c.Fake}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2045** (2026-09-10): **bug: v0.39.0+: additional namespaces panic on startup**
  *Symptoms*: The current code that starts informers in parallel fails due to concurrent map access. The controller needs be started with additional namespaces for to trigger the issue. The issue is only a problem since v0.39.0.  ``` time=2026-09-03T01:38:48.710Z level=INFO msg="Starting informer" namespace=<redacted> time=2026-09-03T01:38:48.712Z level=INFO msg="HTTP server serving" addr=:8080 time=2026-09-03T01:38:48.712Z level=INFO msg="HTTP metrics server serving" addr=:8081 2026-09-03T01:38:48Z    INFO    reloader        Namespace update received; scheduling restart   {"waitPeriod": "4.866462988s"} fatal error: concurrent map writes 2026-09-03T01:38:48Z    INFO    reloader        Namespace update received; scheduling restart   {"waitPeriod": "4.860100276s"} 2026-09-03T01:38:48Z    INFO    reloader        Namespace update received; scheduling restart   {"waitPeriod": "4.858162041s"} 2026-09-03T01:38:48Z    INFO    reloader        Namespace update received; scheduling restart   {"waitPeriod": "4.857054369s"} 2026-09-03T01:38:48Z    INFO    reloader        Namespace update received; scheduling restart   {"waitPeriod": "4.857026597s"}  goroutine 200 [running]: internal/runtime/maps.fatal({0x1ffa219?, 0x23a7144c1850?})         /opt/hostedtoolcache/go/1.26.7/x64/src/runtime/panic.go:1181 +0x18 k8s.io/apimachinery/pkg/runtime.(*Scheme).AddKnownTypeWithName(0x23a7142f2690, {{0x1fea582, 0xb}, {0x1fe9947, 0xa}, {0x1fe993d, 0xa}}, {0x210d9a0, 0x23a714292340})         /home/runner/go/pkg/mod/k8s.

- **Issue #1789** (2025-09-12): **Regression in Kubeseal `0.31.0`: Unable to seal secret without local kubectl context**
  *Symptoms*: **Which component**: kubeseal (`0.31.0`)  **Describe the bug** Running kubeseal on a secret without having an active local context fails the sealing. I am running `kubeseal` outside the cluster without having a connection to any cluster by sealing the secret using the `--cert` option.  **To Reproduce** Steps to reproduce the behavior:  1. Make sure no "current-context" is set in environment (see `kubectl config get-contexts`) 2. Create an arbitrary secret `secret.yml` 3. Run `cat secret.yml | kubeseal`  Secret: ```yml apiVersion: v1 kind: Secret metadata:   name: foo   namespace: bar type: Opaque stringData:   foo.conf: "bar" ```  Output: ```sh ➜ cat secret.yml | kubeseal --cert=my-cert.pem error: invalid configuration: no configuration has been provided, try setting KUBERNETES_MASTER environment variable ```  When explicitly passing the `--namespace` flag, the error does not occur. ```sh ➜ cat secret.yml | kubeseal --cert=my-cert.pem --namespace=bar {   "kind": "SealedSecret",   "apiVersion": "bitnami.com/v1alpha1",   "metadata": {     "name": "foo",     "namespace": "bar"   ...   } } ```  **Expected behavior** Until version `0.30.0` of kubeseal, neither the namespace parameter nor the local context needed to be set.  **Additional context** This might be related to this change: https://github.com/bitnami-labs/sealed-secrets/pull/1754 .  The previous validation logic was only applied in case the `Secret` did not have a namespace set: https://github.com/bitnami-labs/sealed-sec

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

### Incident Patch 1: `5a7b730c` (2026-09-10)
**Commit Message**: fix(controller): remove redundant scheme registration from NewController (#2046)

Fixes #2045.

`NewController` registered the SealedSecret types into client-go's
global `scheme.Scheme` on every call:

```go
utilruntime.Must(ssscheme.AddToScheme(scheme.Scheme))
```

That registration has already happened by then. `ssscheme.AddToScheme`
is a `SchemeBuilder` whose only member is `v1alpha1.AddToScheme`
(`pkg/client/clientset/versioned/scheme/register.go:17-18`), and the
v1alpha1 package's own `init()` runs exactly that against
`scheme.Scheme` (`pkg/apis/sealedsecrets/v1alpha1/register.go:24`).
`controller.go` imports that package directly, so the `init()` has run
before any controller is built.

The redundancy was harmless while startup was serial. #2018 made the
additional-namespace bootstrap parallel
(`pkg/controller/main.go:321-343`, concurrency 16), so
`prepareController` — and through it `NewController` — now runs from
many goroutines at once. `runtime.Scheme.AddKnownTypes` writes the
scheme's internal maps; identical values still count as concurrent map
writes, so the process aborts. A single namespace only ever calls it
once, which matches default deployments being unaffected.


**File**: `pkg/controller/controller.go` (modified, +0/-2)
```diff
@@ -30,7 +30,6 @@ import (
 
 	ssv1alpha1 "github.com/bitnami/sealed-secrets/pkg/apis/sealedsecrets/v1alpha1"
 	ssclientset "github.com/bitnami/sealed-secrets/pkg/client/clientset/versioned"
-	ssscheme "github.com/bitnami/sealed-secrets/pkg/client/clientset/versioned/scheme"
 	ssv1alpha1client "github.com/bitnami/sealed-secrets/pkg/client/clientset/versioned/typed/sealedsecrets/v1alpha1"
 	ssinformer "github.com/bitnami/sealed-secrets/pkg/client/informers/externalversions"
 	"github.com/bitnami/sealed-secrets/pkg/multidocyaml"
@@ -89,7 +88,6 @@ func NewController(
 ) (*Controller, error) {
 	queue := workqueue.NewTypedRateLimitingQueue(workqueue.DefaultTypedControllerRateLimiter[string]())
 
-	utilruntime.Must(ssscheme.AddToScheme(scheme.Scheme))
 	eventBroadcaster := record.NewBroadcaster()
 	eventBroadcaster.StartLogging(func(format string, args ...interface{}) {
 		// Must use Sprintf to ensure slog doesn't interpret args... as key-value pairs
```

**File**: `pkg/controller/controller_test.go` (modified, +50/-0)
```diff
@@ -6,6 +6,7 @@ import (
 	"crypto/rsa"
 	"errors"
 	"fmt"
+	"sync"
 	"testing"
 	"time"
 
@@ -546,3 +547,52 @@ func TestRotateIgnoresTemplate(t *testing.T) {
 		t.Errorf("Rotate must not turn template execution into a decryption oracle, got error: %v", err)
 	}
 }
+
+// prepareController is called once per namespace from parallel goroutines when
+// --additional-namespaces is set, so it must be safe to call concurrently.
+// Regression test for #2045.
+func TestPrepareControllerConcurrently(t *testing.T) {
+	ns := "some-namespace"
+	keyNs := "some-key-namespace"
+	var tweakopts func(*metav1.ListOptions)
+	clientset := fake.NewClientset()
+	ssc := ssfake.NewSimpleClientset()
+	keyRegistry := testKeyRegister(t, context.Background(), clientset, ns)
+
+	const goroutines = 64
+
+	var wg sync.WaitGroup
+	start := make(chan struct{})
+	errs := make(chan error, goroutines)
+
+	for i := 0; i < goroutines; i++ {
+		wg.Add(1)
+		go func() {
+			defer wg.Done()
+			<-start
+			if _, err := prepareController(clientset, ns, keyNs, tweakopts, &Flags{}, ssc, keyRegistry); err != nil {
+				errs <- err
+			}
+		}()
+	}
+
+	close(start)
+	wg.Wait()
+	close(errs)
+
+	for err := range errs {
+		t.Fatalf("prepareController failed under concurrency: %v", err)
+	}
+}
+
+// The controller's decoders (scheme.Codecs.UniversalDecoder) rely on the
+// SealedSecret types being present in the global scheme. That registration comes
+// from the v1alpha1 package init(), which is why NewController does not need to
+// repeat it. Guards that invariant.
+func TestSealedSecretTypesAreRegisteredGlobally(t *testing.T) {
+	for _, kind := range []string{"SealedSecret", "SealedSecretList"} {
+		if !scheme.Scheme.Recognizes(ssv1alpha1.SchemeGroupVersion.WithKind(kind)) {
+			t.Fatalf("%s is not registered in the global scheme", kind)
+		}
+	}
+}
```

---

### Incident Patch 2: `32171b69` (2026-09-10)
**Commit Message**: [Security] Stop /v1/rotate from acting as a decryption oracle (#2049)

Rotate() decrypted via the full Unseal() path, which renders
spec.template.data as a Go template. That field isn't covered by the
AEAD label, so an attacker able to submit a SealedSecret manifest to the
unauthenticated /v1/rotate endpoint could pair a victim's real
metadata/encryptedData with a crafted template and use the resulting
success/error response as a one-bit decryption oracle - the same class
of issue previously fixed for /v1/verify in 66db186e.

Add UnsealWithoutTemplate, which decrypts spec.encryptedData without
ever executing spec.template.data, and use it in Rotate() instead.

**File**: `pkg/apis/sealedsecrets/v1alpha1/sealedsecret_expansion.go` (modified, +45/-34)
```diff
@@ -292,8 +292,17 @@ func (s *SealedSecret) ValidateEncryptedData(privKeys map[string]*rsa.PrivateKey
 	return fmt.Errorf("using deprecated 'data' field, use 'encryptedData' or flip the feature flag")
 }
 
-// Unseal decrypts and returns the embedded v1.Secret.
+// Unseal decrypts and returns the embedded v1.Secret, rendering spec.template.data as a Go template.
 func (s *SealedSecret) Unseal(codecs runtimeserializer.CodecFactory, privKeys map[string]*rsa.PrivateKey) (*v1.Secret, error) {
+	return s.unseal(codecs, privKeys, true)
+}
+
+// UnsealWithoutTemplate is like Unseal but skips rendering spec.template.data, since it's not authenticated and could be used as a decryption oracle.
+func (s *SealedSecret) UnsealWithoutTemplate(codecs runtimeserializer.CodecFactory, privKeys map[string]*rsa.PrivateKey) (*v1.Secret, error) {
+	return s.unseal(codecs, privKeys, false)
+}
+
+func (s *SealedSecret) unseal(codecs runtimeserializer.CodecFactory, privKeys map[string]*rsa.PrivateKey, renderTemplate bool) (*v1.Secret, error) {
 	boolTrue := true
 	smeta := s.GetObjectMeta()
 
@@ -328,41 +337,43 @@ func (s *SealedSecret) Unseal(codecs runtimeserializer.CodecFactory, privKeys ma
 			data[key] = string(plaintext)
 		}
 
-		// Expose raw plaintext values from spec.template.data in the
-		// template rendering context, so that templates defined in
-		// spec.template.data can reference sibling plaintext keys as
-		// {{ .key }} variables (e.g. {{ .username }} alongside an
-		// encrypted password). Encrypted values take precedence on key
-		// collision so adding a plaintext key can never silently shadow
-		// a real secret value.
-		// See https://github.com/bitnami-labs/sealed-secrets/issues/1607
-		for key, value := range s.Spec.Template.Data {
-			if _, exists := data[key]; !exists && value != nil {
-				data[key] = *value
+		if renderTemplate {
+			// Expose raw plaintext values from spec.template.data in the
+			// template rendering context, so that templates defined in
+			// spec.template.data can reference sibling plaintext keys as
+			// {{ .key }} variables (e.g. {{ .username }} alongside an
+			// encrypted password). Encrypted values take precedence on key
+			// collision so adding a plaintext key can never silently shadow
+			// a real secret value.
+			// See https://github.com/bitnami-labs/sealed-secrets/issues/1607
+			for key, value := range s.Spec.Template.Data {
+				if _, exists := data[key]; !exists && value != nil {
+					data[key] = *value
+				}
 			}
-		}
-
-		for key, value := range s.Spec.Template.Data {
-			var plaintext bytes.Buffer
 
-			if value == nil {
-				delete(secret.Data, key)
-				continue
-			}
-			template, err := template.New(key).Funcs(sprigFuncMap).Parse(*value)
-			if err != nil {
-				errs = append(errs, multierror.Tag(key, err))
-				continue
-			}
-			err = template.Execute(&plaintext, data)
-			if err != nil {
-				errs = append(errs, multierror.Tag(key, err))
-			}
-			// Do not overwrite a key that was already populated from
-			// encryptedData; encrypted values take precedence in the
-			// output Secret as well as in the template rendering context.
-			if _, fromEncrypted := s.Spec.EncryptedData[key]; !fromEncrypted {
-				secret.Data[key] = plaintext.Bytes()
+			for key, value := range s.Spec.Template.Data {
+				var plaintext bytes.Buffer
+
+				if value == nil {
+					delete(secret.Data, key)
+					continue
+				}
+				template, err := template.New(key).Funcs(sprigFuncMap).Parse(*value)
+				if err != nil {
+					errs = append(errs, multierror.Tag(key, err))
+					continue
+				}
+				err = template.Execute(&plaintext, data)
+				if err != nil {
+					errs = append(errs, multierror.Tag(key, err))
+				}
+				// Do not overwrite a key that was already populated from
+				// encryptedData; encrypted values take precedence in the
+				// output Secret as well as in the template rendering context.
+				if _, fromEncrypted := s.Spec.EncryptedData[key]; !fromEncrypted {
+					secret.Data[key] = plaintext.Bytes()
+				}
 			}
 		}
 
```

**File**: `pkg/apis/sealedsecrets/v1alpha1/sealedsecret_test.go` (modified, +37/-0)
```diff
@@ -432,6 +432,43 @@ func TestValidateEncryptedDataIgnoresTemplate(t *testing.T) {
 	}
 }
 
+// TestUnsealWithoutTemplateIgnoresTemplate checks that UnsealWithoutTemplate never renders spec.template.data.
+func TestUnsealWithoutTemplateIgnoresTemplate(t *testing.T) {
+	secret := v1.Secret{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "myname",
+			Namespace: "myns",
+		},
+		Data: map[string][]byte{
+			"password": []byte("hunter2"),
+		},
+	}
+
+	ssecret, _, keys := sealSecret(t, &secret, NewSealedSecret)
+
+	// This probe template must not affect decryption or leak into the output.
+	ssecret.Spec.Template.Data = map[string]*string{
+		"probe": someStr(`{{ if eq .password "hunter2" }}{{ fail "guessed it" }}{{ end }}`),
+	}
+
+	unsealed, err := ssecret.UnsealWithoutTemplate(serializer.CodecFactory{}, keys)
+	if err != nil {
+		t.Fatalf("UnsealWithoutTemplate returned error for a decryptable secret with a template: %v", err)
+	}
+	if got, want := string(unsealed.Data["password"]), "hunter2"; got != want {
+		t.Errorf("password: got %q, want %q", got, want)
+	}
+	if _, ok := unsealed.Data["probe"]; ok {
+		t.Errorf("UnsealWithoutTemplate must not render spec.template.data, but found rendered key %q", "probe")
+	}
+
+	// Sanity check: genuinely undecryptable data must still fail.
+	_, otherKeys := generateTestKey(t, testRand(), 2048)
+	if _, err := ssecret.UnsealWithoutTemplate(serializer.CodecFactory{}, otherKeys); err == nil {
+		t.Errorf("UnsealWithoutTemplate did not return an error for encryptedData undecryptable with the given keys")
+	}
+}
+
 // TestTemplateDataPlaintextReference verifies that plaintext keys defined
 // in spec.template.data can be referenced from sibling templates as
 // {{ .key }} variables. Regression test for
```

**File**: `pkg/controller/controller.go` (modified, +6/-1)
```diff
@@ -574,7 +574,7 @@ func (c *Controller) Rotate(content []byte) ([]byte, error) {
 			slog.Warn("Sealed Secret metadata doesn't match. Please align your Sealed Secret metadata")
 		}
 
-		secret, err := c.attemptUnseal(s)
+		secret, err := c.attemptUnsealForRotate(s)
 		if err != nil {
 			return nil, fmt.Errorf("error decrypting secret. %v", err)
 		}
@@ -603,3 +603,8 @@ func (c *Controller) attemptUnseal(ss *ssv1alpha1.SealedSecret) (*corev1.Secret,
 func attemptUnseal(ss *ssv1alpha1.SealedSecret, keyRegistry *KeyRegistry) (*corev1.Secret, error) {
 	return ss.Unseal(scheme.Codecs, keyRegistry.privateKeys())
 }
+
+// attemptUnsealForRotate decrypts without rendering the template, since /v1/rotate is unauthenticated and the template could be used as a decryption oracle.
+func (c *Controller) attemptUnsealForRotate(ss *ssv1alpha1.SealedSecret) (*corev1.Secret, error) {
+	return ss.UnsealWithoutTemplate(scheme.Codecs, c.keyRegistry.privateKeys())
+}
```

**File**: `pkg/controller/controller_test.go` (modified, +76/-0)
```diff
@@ -470,3 +470,79 @@ func TestAttemptUnsealIgnoresTemplate(t *testing.T) {
 		t.Errorf("AttemptUnseal reported a decryptable secret as invalid because of an unrelated template failure")
 	}
 }
+
+// TestRotateIgnoresTemplate checks that Rotate never executes spec.template.data as a template.
+func TestRotateIgnoresTemplate(t *testing.T) {
+	ns := "some-namespace"
+	keyNs := "some-key-namespace"
+	var tweakopts func(*metav1.ListOptions)
+	clientset := fake.NewClientset()
+	ssc := ssfake.NewSimpleClientset()
+	keyRegistry := testKeyRegister(t, context.Background(), clientset, ns)
+
+	validFor := time.Hour
+	cn := "my-cn"
+	_, err := keyRegistry.generateKey(context.Background(), validFor, cn, "", "")
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	controller, err := prepareController(clientset, ns, keyNs, tweakopts, &Flags{SkipRecreate: false}, ssc, keyRegistry)
+	if err != nil {
+		t.Fatalf("err %v want %v", err, nil)
+	}
+
+	secret := &corev1.Secret{
+		TypeMeta: metav1.TypeMeta{
+			APIVersion: "v1",
+			Kind:       "Secret",
+		},
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "ss",
+			Namespace: "default",
+		},
+		Data: map[string][]byte{
+			"password": []byte("hunter2"),
+		},
+	}
+
+	cert, err := controller.keyRegistry.getCert()
+	if err != nil {
+		t.Fatalf("error getting certificate: %v", err)
+	}
+
+	ssecret, err := ssv1alpha1.NewSealedSecret(scheme.Codecs, cert.PublicKey.(*rsa.PublicKey), secret)
+	if err != nil {
+		t.Fatalf("error creating sealed secrets: %v", err)
+	}
+
+	// Attacker-controlled, always-failing template paired with the victim's real data.
+	ssecret.Spec.Template.Data = map[string]*string{
+		"probe": someStr(`{{ fail "attacker-controlled failure" }}`),
+	}
+
+	enc, err := prettyEncoder(scheme.Codecs, runtime.ContentTypeJSON, ssv1alpha1.SchemeGroupVersion)
+	if err != nil {
+		t.Fatalf("unexpected pretty encoding: %v", err)
+	}
+	data, err := runtime.Encode(enc, ssecret)
+	if err != nil {
+		t.Fatalf("unexpected encoding the sealed secret: %v", err)
+	}
+
+	if _, err := controller.Rotate(data); err != nil {
+		t.Errorf("Rotate returned error for a decryptable secret because of an unrelated template failure: %v", err)
+	}
+
+	// Different guesses against the same ciphertext must behave identically.
+	ssecret.Spec.Template.Data = map[string]*string{
+		"probe": someStr(`{{ if eq .password "hunter2" }}{{ fail "guessed it" }}{{ end }}`),
+	}
+	data2, err := runtime.Encode(enc, ssecret)
+	if err != nil {
+		t.Fatalf("unexpected encoding the sealed secret: %v", err)
+	}
+	if _, err := controller.Rotate(data2); err != nil {
+		t.Errorf("Rotate must not turn template execution into a decryption oracle, got error: %v", err)
+	}
+}
```

---

### Incident Patch 3: `90293948` (2026-08-27)
**Commit Message**: Add imports to force vendoring required codegen tools (#2020)

<!--
Before you open the request please review the following guidelines and
tips to help it be more easily integrated:

 - Describe the scope of your change - i.e. what the change does.
 - Describe any known limitations with your change.
- Please run any tests or examples that can exercise your modified code.

Thank you for contributing! We will try to test and integrate the change
as soon as we can, but be aware we have many GitHub repositories to
manage and can't immediately respond to every request. There is no need
to bump or check in on a pull request (it will clutter the discussion of
the request).

Also don't be worried if the request is closed or not integrated
sometimes the priorities of Bitnami might not match the priorities of
the pull request. Don't fret, the open source community thrives on forks
and GitHub makes it easy to keep your changes in a forked repo.
 -->

**Description of the change**

<!-- Describe the scope of your change - i.e. what the change does. -->
Add imports to force vendoring of tools required by
`./hack/update-codegen.sh`.

For whatever reason, only a subset of `k8s.io/code-generator/c

**File**: `hack/tools.go` (modified, +4/-0)
```diff
@@ -9,4 +9,8 @@ package tools
 
 import (
 	_ "k8s.io/code-generator"
+	_ "k8s.io/code-generator/cmd/conversion-gen"
+	_ "k8s.io/code-generator/cmd/deepcopy-gen"
+	_ "k8s.io/code-generator/cmd/defaulter-gen"
+	_ "k8s.io/code-generator/cmd/validation-gen"
 )
```

#### Recent Merged Pull Requests:
- **PR #2072** (2026-10-15): Bump golang.org/x/crypto from 0.57.0 to 0.58.0 (@dependabot[bot])
- **PR #2071** (2026-10-15): Bump github.com/prometheus/client_golang from 1.24.1 to 1.25.0 (@dependabot[bot])
- **PR #2068** (closed): Bump k8s.io/api from 0.37.0 to 0.37.1 (@dependabot[bot])
- **PR #2067** (2026-09-30): Bump k8s.io/client-go from 0.37.0 to 0.37.1 (@dependabot[bot])
- **PR #2066** (closed): Bump k8s.io/apimachinery from 0.37.0 to 0.37.1 (@dependabot[bot])
- **PR #2065** (2026-10-01): Bump github.com/onsi/gomega from 1.43.1 to 1.44.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
