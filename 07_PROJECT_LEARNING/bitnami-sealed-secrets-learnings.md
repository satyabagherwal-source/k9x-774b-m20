# Forensic Learning Record (Deep Inspection): bitnami/sealed-secrets

> **Canonical Artifact**: `07_PROJECT_LEARNING/bitnami-sealed-secrets-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bitnami/sealed-secrets](https://github.com/bitnami/sealed-secrets))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:09:49.821Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bitnami/sealed-secrets`
- **Description**: A Kubernetes controller and tool for one-way encrypted Secrets
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 9298 stars

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

### Core Architecture Module: `pkg/client/clientset/versioned/fake/doc.go`
```
// Code generated by client-gen. DO NOT EDIT.

// This package has the automatically generated fake clientset.
package fake

```

### Core Architecture Module: `pkg/client/clientset/versioned/fake/register.go`
```
// Code generated by client-gen. DO NOT EDIT.

package fake

import (
	bitnamiv1alpha1 "github.com/bitnami/sealed-secrets/pkg/apis/sealedsecrets/v1alpha1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"
	schema "k8s.io/apimachinery/pkg/runtime/schema"
	serializer "k8s.io/apimachinery/pkg/runtime/serializer"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
)

var scheme = runtime.NewScheme()
var codecs = serializer.NewCodecFactory(scheme)

var localSchemeBuilder = runtime.SchemeBuilder{
	bitnamiv1alpha1.AddToScheme,
}

// AddToScheme adds all types of this clientset into the given scheme. This allows composition
// of clientsets, like in:
//
//	import (
//	  "k8s.io/client-go/kubernetes"
//	  clientsetscheme "k8s.io/client-go/kubernetes/scheme"
//	  aggregatorclientsetscheme "k8s.io/kube-aggregator/pkg/client/clientset_generated/clientset/scheme"
//	)
//
//	kclientset, _ := kubernetes.NewForConfig(c)
//	_ = aggregatorclientsetscheme.AddToScheme(clientsetscheme.Scheme)
//
// After this, RawExtensions in Kubernetes types will serialize kube-aggregator types
// correctly.
var AddToScheme = localSchemeBuilder.AddToScheme

func init() {
	v1.AddToGroupVersion(scheme, schema.GroupVersion{Version: "v1"})
	utilruntime.Must(AddToScheme(scheme))
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
  **Post-Mortem & Fix Analysis**:
  > taking a look @armingerten. Totally right, trying to find a solution. We are open to receive PR too, feel free if you want to contribute.  Thanks a lot again  Álvaro
  > hi @armingerten   The error attached to the issue is the standard when you don't have context. I checked it with 0.28 and 0.29 and the errors are the same. Could you provide me the error that you are hitting in 0.31? I am going to modify the logic about the namespace in kubeseal but could you provide me more information, please? are you hitting with "input secret has no namespace and cannot infer the namespace automatically..."? I want to be sure that I am aligned with the same error that you are reproducing.  Thanks a lot  Álvaro
  > hi @alvneiayu , thanks for looking into this.  I tried to run the command on both `0.30` and `0.31`.   On `0.31` I get the error as stated in the bug description: ``` cat secret.yml | kubeseal-0.31.0 --cert=my-cert.pem  error: invalid configuration: no configuration has been provided, try setting KUBERNETES_MASTER environment variable ```  On `0.30` I don't get an error: ``` cat secret.yml | kubeseal-0.31.0 --cert=my-cert.pem {   "kind": "SealedSecret",   "apiVersion": "bitnami.com/v1alpha1",   "metadata": {     "name": "foo",     "namespace": "bar",     "creationTimestamp": null   } ... } ```  To reproduce this it is important to:  1. Not have a current context set (e.g. by removing the `current-context` entry from `~/.kube/config`). 2. Apply the `--cert` parameter.  ---  > are you hitting with "input secret has no namespace and cannot infer the namespace automatically..."?  No, not if I specify `metadata.namespace` in my `Secret`. If I remove `metadata.namespace` like this ``` apiVer

- **Issue #1747** (2025-07-07): **stop reporting metrics for removed sealedsecrets**
  *Symptoms*: <!--  Before you open the bug report please review the following FAQ:   - [Sealed Secrets FAQ](https://github.com/bitnami-labs/sealed-secrets#faq)  -->  **Which component**: controller  **Describe the bug** When a namespace that has a SealedSecret is removed the controller sees a change to the SealedSecret, tries to update it, cannot update it because the namespace is being removed, and begins reporting in metrics that the condition is `Synced`=`-1`.  **To Reproduce** Steps to reproduce the behavior:  ```bash # generate a sealedsecret for the relevant $test namespace kubectl create namespace $test kubectl apply -f $test_secret.yaml # view logs, validate it's healthy # validate healthy on metrics endpoint kubectl delete namespace $test # view logs, check metrics ```  **Expected behavior** I expect the controller to stop reporting metrics for SealedSecrets when they no longer exist.  **Version of Kubernetes**:  validated on 1.32 and 1.33  - Output of `kubectl version`: n/a  ```bash # controller: sealed-secrets-c64cdbc67-wtm2z controller time=2025-06-12T21:16:59.174Z level=INFO msg=Updating key=bloop/shaboom sealed-secrets-c64cdbc67-wtm2z controller time=2025-06-12T21:16:59.206Z level=INFO msg="Event(v1.ObjectReference{Kind:\"SealedSecret\", Namespace:\"bloop\", Name:\"shaboom\", UID:\"dfbbfd5e-8768-4cad-81b5-4ea566620b39\", APIVersion:\"bitnami.com/v1alpha1\", ResourceVersion:\"7740398\", FieldPath:\"\"}): type: 'Normal' reason: 'Unsealed' SealedSecret unsealed successfully" se
  **Post-Mortem & Fix Analysis**:
  > This Issue has been automatically marked as "stale" because it has not had recent activity (for 15 days). It will be closed if no further activity occurs. Thanks for the feedback.
  > Due to the lack of activity in the last 7 days since it was marked as "stale", we proceed to close this Issue. Do not hesitate to reopen it later if necessary.
  > /reopen

- **Issue #1739** (2025-07-18): **Cannot set `--key-renew-period=0` with helm**
  *Symptoms*: <!--  Before you open the bug report please review the following FAQ:   - [Sealed Secrets FAQ](https://github.com/bitnami-labs/sealed-secrets#faq)  -->  **Which component**: controller helm chart versions >= https://github.com/bitnami-labs/sealed-secrets/releases/tag/helm-v2.1.2 (all versions after 2022-01-27)  Introduced by: https://github.com/bitnami-labs/sealed-secrets/commit/eabb4519d4756436132b252bf2d9a1b4c83eefda  **Describe the bug** The docs state:  > A value of `0` will deactivate automatic key renewal. Of course, you may have a valid use case for deactivating automatic sealing key renewal but experience has shown that new users often tend to jump to conclusions that they want control over key renewal, before fully understanding how sealed secrets work.   Just to make sure I'm not coming across as someone in that _new users_ callout - I've been operating with sealed secrets for probably 5+ years now (:heart:), and my use case is that we have a fleet of clusters where _one_ cluster performs cert renewal and another mechanism (external-secrets) distributes those certs across the other clusters. I need the recipient clusters to not renew their certs.  **To Reproduce**  1. Run the command `helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets` 2. Run the command `helm repo update sealed-secrets` 3. Run the command      ```console     $ helm template sealed-secrets sealed-secrets/sealed-secrets --set=keyrenewperiod=0 --dry-run \     $ | yq 'select(.ki
  **Post-Mortem & Fix Analysis**:
  > Setting `values.keyrenewperiod: 0s` probably works, I'll test that now - but at the very least it's not the value described in the docs for how to disable key renewal  This seems to work fine

- **Issue #1710** (2025-04-07): **Small typo in the values file**
  *Symptoms*: **Which component**: The helm chart values and readme  **Describe the bug** Small typo in helm values and readme. namesapced --> namespaced No impact at all on actual functionality  **To Reproduce** Search the repo for 'namesapced'   **Expected behavior** Fix typo  **Version of Kubernetes**: n.a.   **Additional context** n.a. 
  **Post-Mortem & Fix Analysis**:
  > hi @evertmulder   It would be great to have a PR fixing it and it would be an honor from my side to review a PR having it.  Feel free to send us a PR if it is OK from your side.  thanks  Álvaro

- **Issue #1516** (2024-10-09): **Status shows no key could decrypt secret for successful created secret**
  *Symptoms*: **Which component:** sealed-secret-controller: v0.20.2  **Describe the bug** I reproduced an old issue described in #853, where the status message for a sealed secret was "no key could decrypt secret", but the secret was correctly unsealed, and the logs confirmed this as well.  This issue was discovered via ArgoCD, where the sealed secrets were marked as red. The temporary workaround was to restart the sealed-secret-controller pod, and after this, the status was updated correctly.  **Steps to reproduce** Could not figure out a way to reproduce the issue (the environment where was discovered is long-lived and we only promote new helm chart versions)  **Expected behavior** When the creation was successful the status should show SealedSecret unsealed successfully like the logs and the events.  **K8s version** Server Version: v1.25.16-eks-b9c9ed7 
  **Post-Mortem & Fix Analysis**:
  > This appears to also be the same issue as #739 and #1354, #1355 , etc. :-( Seems like the issue is hard to eliminate.  We're facing this even with 0.26.2, and on 0.25.0. We were on 0.18.1 before that, which didn't have this problem.
  > I also found this problem on my sealed-secret installation while using ArgoCD, did you found the solution ? @Gnarfoz 
  > Hey @WillyRL, there seems to be no permanent solution. We work around it by restarting the Sealed Secrets controller pod from time to time. During startup, it correctly marks all successfully unsealed secrets as healthy, as @alita1991 also wrote.  It seems like a trivial "out of order" thing...

- **Issue #1493** (2024-03-21): **Bug in Helm Chart in file role-binding.yaml**
  *Symptoms*: <!--  Before you open the bug report please review the following FAQ:   - [Sealed Secrets FAQ](https://github.com/bitnami-labs/sealed-secrets#faq)  -->  **Which component**: The name (and version) of the affected component (controller or kubeseal)  controller helm chart, version 2.15.1  **Describe the bug** A clear and concise description of what the bug is.  Helm Chart cannot be rendered with additional namespaces set. The problem is here: helm/sealed-secrets/templates/role-binding.yaml on Line 66.  There is a missing $. The line should be:  {{- if $.Values.commonAnnotations }}  **To Reproduce** Steps to reproduce the behavior:  1. Go to '...' 2. Run the command '....' 3. Wait for '....' 4. See error  **Expected behavior** A clear and concise description of what you expected to happen.  **Version of Kubernetes**:  - Output of `kubectl version`:  ``` (paste your output here) ```  **Additional context** Add any other context about the problem here. 

- **Issue #1470** (2024-02-29): **lastTransitionTime/lastUpdateTime under status->conditions not updated when updating a SealedSecret**
  *Symptoms*: **Which component**: Not sure, controller, apiVersion: bitnami.com/v1alpha1, 2.14.2 version of helmchart  **Describe the bug** lastTransitionTime/lastUpdateTime under status->conditions not updated when updating a SealedSecret  **To Reproduce** Steps to reproduce the behavior:  1. Apply a sealed secret by running "oc apply -f my-sealed-secret.yaml", output "sealedsecret.bitnami.com/my-secret created" 2. Modify the encryptedData part of my-sealed-secret.yaml. 3. Apply the modified sealed secret by running "oc apply -f my-sealed-secret.yaml", output "sealedsecret.bitnami.com/my-secret configured" 4. Check the SealedSecret object's "status" property: status:   conditions:     - lastTransitionTime: "the time when the sealed secret is created first time"       lastUpdateTime: "the time when the sealed secret is created first time"       status: 'True'       type: Synced   observedGeneration: 2  **Expected behavior** The lastTransitionTime/lastUpdateTime should be the time the sealed secret is updated? The observedGeneration property seems to be correctly updated.  **Version of Kubernetes**: v1.26.12+9ed7eae OpenShift 4.13  - Output of `kubectl version`:  ``` (paste your output here) ``` Client Version: version.Info{Major:"1", Minor:"26", GitVersion:"v1.26.1", GitCommit:"8f94681cd294aa8cfd3407b8191f6c70214973a4", GitTreeState:"clean", BuildDate:"2023-01-18T15:58:16Z", GoVersion:"go1.19.5", Compiler:"gc", Platform:"linux/amd64"} Kustomize Version: v

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

### Incident Patch 3: `54c805db` (2026-08-27)
**Commit Message**: Enable encryptedData to be omitted by setting key to null in template (#1871)

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
Make `SealedSecret.spec.template.data` fields nullable. A null value
indicates that the key should be omitted from the final se

**File**: `helm/sealed-secrets/crds/bitnami.com_sealedsecrets.yaml` (modified, +5/-2)
```diff
@@ -2,7 +2,7 @@ apiVersion: apiextensions.k8s.io/v1
 kind: CustomResourceDefinition
 metadata:
   annotations:
-    controller-gen.kubebuilder.io/version: v0.15.0
+    controller-gen.kubebuilder.io/version: v0.20.1
   name: sealedsecrets.bitnami.com
 spec:
   group: bitnami.com
@@ -69,7 +69,10 @@ spec:
                   data:
                     additionalProperties:
                       type: string
-                    description: Keys that should be templated using decrypted data.
+                    description: |-
+                      Keys that should be templated using decrypted data.
+                      Set a key with the same name as in `encryptedData`
+                      to `null` to omit the unsealed data from the final secret.
                     nullable: true
                     type: object
                   immutable:
```

**File**: `pkg/apis/sealedsecrets/v1alpha1/sealedsecret_expansion.go` (modified, +7/-3)
```diff
@@ -337,15 +337,19 @@ func (s *SealedSecret) Unseal(codecs runtimeserializer.CodecFactory, privKeys ma
 		// a real secret value.
 		// See https://github.com/bitnami-labs/sealed-secrets/issues/1607
 		for key, value := range s.Spec.Template.Data {
-			if _, exists := data[key]; !exists {
-				data[key] = value
+			if _, exists := data[key]; !exists && value != nil {
+				data[key] = *value
 			}
 		}
 
 		for key, value := range s.Spec.Template.Data {
 			var plaintext bytes.Buffer
 
-			template, err := template.New(key).Funcs(sprigFuncMap).Parse(value)
+			if value == nil {
+				delete(secret.Data, key)
+				continue
+			}
+			template, err := template.New(key).Funcs(sprigFuncMap).Parse(*value)
 			if err != nil {
 				errs = append(errs, multierror.Tag(key, err))
 				continue
```

**File**: `pkg/apis/sealedsecrets/v1alpha1/sealedsecret_test.go` (modified, +59/-20)
```diff
@@ -353,6 +353,10 @@ func TestSealRoundTripWithMisMatchNamespaceWide(t *testing.T) {
 	}
 }
 
+func someStr(s string) *string {
+	return &s
+}
+
 func TestSealRoundTripTemplateData(t *testing.T) {
 	secret := v1.Secret{
 		ObjectMeta: metav1.ObjectMeta{
@@ -367,9 +371,9 @@ func TestSealRoundTripTemplateData(t *testing.T) {
 
 	ssecret, codecs, keys := sealSecret(t, &secret, NewSealedSecret)
 
-	ssecret.Spec.Template.Data = map[string]string{
-		"bar":           `secret {{ index . "foo" }} !`,
-		"password-json": `{{ toJson .password }}`,
+	ssecret.Spec.Template.Data = map[string]*string{
+		"bar":           someStr(`secret {{ index . "foo" }} !`),
+		"password-json": someStr(`{{ toJson .password }}`),
 	}
 
 	secret2, err := ssecret.Unseal(codecs, keys)
@@ -406,16 +410,16 @@ func TestValidateEncryptedDataIgnoresTemplate(t *testing.T) {
 	ssecret, _, keys := sealSecret(t, &secret, NewSealedSecret)
 
 	// A failing template must not turn a decryptable secret into a validation failure.
-	ssecret.Spec.Template.Data = map[string]string{
-		"probe": `{{ fail "attacker-controlled failure" }}`,
+	ssecret.Spec.Template.Data = map[string]*string{
+		"probe": someStr(`{{ fail "attacker-controlled failure" }}`),
 	}
 	if err := ssecret.ValidateEncryptedData(keys); err != nil {
 		t.Errorf("ValidateEncryptedData returned error for a decryptable secret with a failing template: %v", err)
 	}
 
 	// A template with a parse error must likewise not affect the result.
-	ssecret.Spec.Template.Data = map[string]string{
-		"probe": `{{ .password`,
+	ssecret.Spec.Template.Data = map[string]*string{
+		"probe": someStr(`{{ .password`),
 	}
 	if err := ssecret.ValidateEncryptedData(keys); err != nil {
 		t.Errorf("ValidateEncryptedData returned error for a decryptable secret with an unparseable template: %v", err)
@@ -436,9 +440,9 @@ func TestTemplateDataPlaintextReference(t *testing.T) {
 	sealed := SealedSecret{
 		Spec: SealedSecretSpec{
 			Template: SecretTemplateSpec{
-				Data: map[string]string{
-					"username":     "myUsername",
-					"settings.xml": `<server><username>{{ .username }}</username></server>`,
+				Data: map[string]*string{
+					"username":     someStr("myUsername"),
+					"settings.xml": someStr(`<server><username>{{ .username }}</username></server>`),
 				},
 			},
 		},
@@ -476,12 +480,12 @@ func TestTemplateDataMixedEncryptedAndPlaintext(t *testing.T) {
 
 	ssecret, codecs, keys := sealSecret(t, &secret, NewSealedSecret)
 
-	ssecret.Spec.Template.Data = map[string]string{
-		"username": "myUsername",
-		"settings.xml": `<server>` +
+	ssecret.Spec.Template.Data = map[string]*string{
+		"username": someStr("myUsername"),
+		"settings.xml": someStr(`<server>` +
 			`<username>{{ .username }}</username>` +
 			`<password>{{ .password }}</password>` +
-			`</server>`,
+			`</server>`),
 	}
 
 	unsealed, err := ssecret.Unseal(codecs, keys)
@@ -512,9 +516,9 @@ func TestTemplateDataEncryptedTakesPrecedenceOverPlaintext(t *testing.T) {
 
 	ssecret, codecs, keys := sealSecret(t, &secret, NewSealedSecret)
 
-	ssecret.Spec.Template.Data = map[string]string{
-		"shared":  "from-plaintext-should-be-ignored",
-		"out.txt": `{{ .shared }}`,
+	ssecret.Spec.Template.Data = map[string]*string{
+		"shared":  someStr("from-plaintext-should-be-ignored"),
+		"out.txt": someStr(`{{ .shared }}`),
 	}
 
 	unsealed, err := ssecret.Unseal(codecs, keys)
@@ -536,7 +540,7 @@ func TestTemplateWithoutEncryptedData(t *testing.T) {
 	sealed := SealedSecret{
 		Spec: SealedSecretSpec{
 			Template: SecretTemplateSpec{
-				Data: map[string]string{"foo": "bar"},
+				Data: map[string]*string{"foo": someStr("bar")},
 			},
 		},
 	}
@@ -551,6 +555,41 @@ func TestTemplateWithoutEncryptedData(t *testing.T) {
 	}
 }
 
+func TestTemplateOmitEncryptedData(t *testing.T) {
+	secret := v1.Secret{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "myname",
+			Namespace: "myns",
+		},
+		Data: map[string][]byte{
+			"foo": []byte("bar"),
+			"baz": []byte("qux"),
+		},
+	}
+
+	ssecret, codecs, keys := sealSecret(t, &secret, NewSealedSecret)
+
+	sealed := SealedSecret{
+		ObjectMeta: secret.ObjectMeta,
+		Spec: SealedSecretSpec{
+			EncryptedData: ssecret.Spec.EncryptedData,
+			Template: SecretTemplateSpec{
+				ObjectMeta: secret.ObjectMeta,
+				Data:       map[string]*string{"foo": nil, "bar": someStr("qux {{ .foo }} qux")},
+			},
+		},
+	}
+
+	unsealed, err := sealed.Unseal(codecs, keys)
+	if err != nil {
+		t.Fatalf("Unseal returned error: %v", err)
+	}
+
+	if got, want := unsealed.Data, map[string][]byte{"bar": []byte("qux bar qux"), "baz": []byte("qux")}; !reflect.DeepEqual(got, want) {
+		t.Errorf("got: %q, want: %q (input: %q)", got, want, ssecret.Spec.EncryptedData)
+	}
+}
+
 func TestSkipSetOwnerReference(t *testing.T) {
 	testCases := []struct {
 		sealedSecret          SealedSecret
@@ -561,7 +600,7 @@ func TestSkipSetOwnerReference(t *testing.T) {
 			sealedSecret: SealedSecret{
 				Spec: SealedSecretSpec{
 					Template: SecretTemplat
```

**File**: `pkg/apis/sealedsecrets/v1alpha1/types.go` (modified, +3/-1)
```diff
@@ -59,9 +59,11 @@ type SecretTemplateSpec struct {
 	Immutable *bool `json:"immutable,omitempty" protobuf:"varint,5,opt,name=immutable"`
 
 	// Keys that should be templated using decrypted data.
+	// Set a key with the same name as in `encryptedData`
+	// to `null` to omit the unsealed data from the final secret.
 	// +optional
 	// +nullable
-	Data map[string]string `json:"data,omitempty"`
+	Data map[string]*string `json:"data,omitempty"`
 }
 
 // SealedSecretSpec is the specification of a SealedSecret.
```

**File**: `pkg/apis/sealedsecrets/v1alpha1/zz_generated.deepcopy.go` (modified, +10/-2)
```diff
@@ -199,9 +199,17 @@ func (in *SecretTemplateSpec) DeepCopyInto(out *SecretTemplateSpec) {
 	}
 	if in.Data != nil {
 		in, out := &in.Data, &out.Data
-		*out = make(map[string]string, len(*in))
+		*out = make(map[string]*string, len(*in))
 		for key, val := range *in {
-			(*out)[key] = val
+			var outVal *string
+			if val == nil {
+				(*out)[key] = nil
+			} else {
+				in, out := &val, &outVal
+				*out = new(string)
+				**out = **in
+			}
+			(*out)[key] = outVal
 		}
 	}
 	return
```

**File**: `pkg/client/clientset/versioned/clientset.go` (modified, +2/-2)
```diff
@@ -3,8 +3,8 @@
 package versioned
 
 import (
-	"fmt"
-	"net/http"
+	fmt "fmt"
+	http "net/http"
 
 	bitnamiv1alpha1 "github.com/bitnami/sealed-secrets/pkg/client/clientset/versioned/typed/sealedsecrets/v1alpha1"
 	discovery "k8s.io/client-go/discovery"
```

**File**: `pkg/client/clientset/versioned/fake/clientset_generated.go` (modified, +18/-2)
```diff
@@ -6,6 +6,7 @@ import (
 	clientset "github.com/bitnami/sealed-secrets/pkg/client/clientset/versioned"
 	bitnamiv1alpha1 "github.com/bitnami/sealed-secrets/pkg/client/clientset/versioned/typed/sealedsecrets/v1alpha1"
 	fakebitnamiv1alpha1 "github.com/bitnami/sealed-secrets/pkg/client/clientset/versioned/typed/sealedsecrets/v1alpha1/fake"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/runtime"
 	"k8s.io/apimachinery/pkg/watch"
 	"k8s.io/client-go/discovery"
@@ -15,7 +16,7 @@ import (
 
 // NewSimpleClientset returns a clientset that will respond with the provided objects.
 // It's backed by a very simple object tracker that processes creates, updates and deletions as-is,
-// without applying any validations and/or defaults. It shouldn't be considered a replacement
+// without applying any field management, validations and/or defaults. It shouldn't be considered a replacement
 // for a real clientset and is mostly useful in simple unit tests.
 func NewSimpleClientset(objects ...runtime.Object) *Clientset {
 	o := testing.NewObjectTracker(scheme, codecs.UniversalDecoder())
@@ -29,9 +30,13 @@ func NewSimpleClientset(objects ...runtime.Object) *Clientset {
 	cs.discovery = &fakediscovery.FakeDiscovery{Fake: &cs.Fake}
 	cs.AddReactor("*", "*", testing.ObjectReaction(o))
 	cs.AddWatchReactor("*", func(action testing.Action) (handled bool, ret watch.Interface, err error) {
+		var opts metav1.ListOptions
+		if watchAction, ok := action.(testing.WatchActionImpl); ok {
+			opts = watchAction.ListOptions
+		}
 		gvr := action.GetResource()
 		ns := action.GetNamespace()
-		watch, err := o.Watch(gvr, ns)
+		watch, err := o.Watch(gvr, ns, opts)
 		if err != nil {
 			return false, nil, err
 		}
@@ -58,6 +63,17 @@ func (c *Clientset) Tracker() testing.ObjectTracker {
 	return c.tracker
 }
 
+// IsWatchListSemanticsUnSupported informs the reflector that this client
+// doesn't support WatchList semantics.
+//
+// This is a synthetic method whose sole purpose is to satisfy the optional
+// interface check performed by the reflector.
+// Returning true signals that WatchList can NOT be used.
+// No additional logic is implemented here.
+func (c *Clientset) IsWatchListSemanticsUnSupported() bool {
+	return true
+}
+
 var (
 	_ clientset.Interface = &Clientset{}
 	_ testing.FakeClient  = &Clientset{}
```

**File**: `pkg/client/clientset/versioned/typed/sealedsecrets/v1alpha1/fake/fake_sealedsecret.go` (modified, +23/-112)
```diff
@@ -3,123 +3,34 @@
 package fake
 
 import (
-	"context"
-
 	v1alpha1 "github.com/bitnami/sealed-secrets/pkg/apis/sealedsecrets/v1alpha1"
-	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
-	labels "k8s.io/apimachinery/pkg/labels"
-	types "k8s.io/apimachinery/pkg/types"
-	watch "k8s.io/apimachinery/pkg/watch"
-	testing "k8s.io/client-go/testing"
+	sealedsecretsv1alpha1 "github.com/bitnami/sealed-secrets/pkg/client/clientset/versioned/typed/sealedsecrets/v1alpha1"
+	gentype "k8s.io/client-go/gentype"
 )
 
-// FakeSealedSecrets implements SealedSecretInterface
-type FakeSealedSecrets struct {
+// fakeSealedSecrets implements SealedSecretInterface
+type fakeSealedSecrets struct {
+	*gentype.FakeClientWithList[*v1alpha1.SealedSecret, *v1alpha1.SealedSecretList]
 	Fake *FakeBitnamiV1alpha1
-	ns   string
-}
-
-var sealedsecretsResource = v1alpha1.SchemeGroupVersion.WithResource("sealedsecrets")
-
-var sealedsecretsKind = v1alpha1.SchemeGroupVersion.WithKind("SealedSecret")
-
-// Get takes name of the sealedSecret, and returns the corresponding sealedSecret object, and an error if there is any.
-func (c *FakeSealedSecrets) Get(ctx context.Context, name string, options v1.GetOptions) (result *v1alpha1.SealedSecret, err error) {
-	obj, err := c.Fake.
-		Invokes(testing.NewGetAction(sealedsecretsResource, c.ns, name), &v1alpha1.SealedSecret{})
-
-	if obj == nil {
-		return nil, err
-	}
-	return obj.(*v1alpha1.SealedSecret), err
-}
-
-// List takes label and field selectors, and returns the list of SealedSecrets that match those selectors.
-func (c *FakeSealedSecrets) List(ctx context.Context, opts v1.ListOptions) (result *v1alpha1.SealedSecretList, err error) {
-	obj, err := c.Fake.
-		Invokes(testing.NewListAction(sealedsecretsResource, sealedsecretsKind, c.ns, opts), &v1alpha1.SealedSecretList{})
-
-	if obj == nil {
-		return nil, err
-	}
-
-	label, _, _ := testing.ExtractFromListOptions(opts)
-	if label == nil {
-		label = labels.Everything()
-	}
-	list := &v1alpha1.SealedSecretList{ListMeta: obj.(*v1alpha1.SealedSecretList).ListMeta}
-	for _, item := range obj.(*v1alpha1.SealedSecretList).Items {
-		if label.Matches(labels.Set(item.Labels)) {
-			list.Items = append(list.Items, item)
-		}
-	}
-	return list, err
-}
-
-// Watch returns a watch.Interface that watches the requested sealedSecrets.
-func (c *FakeSealedSecrets) Watch(ctx context.Context, opts v1.ListOptions) (watch.Interface, error) {
-	return c.Fake.
-		InvokesWatch(testing.NewWatchAction(sealedsecretsResource, c.ns, opts))
-
-}
-
-// Create takes the representation of a sealedSecret and creates it.  Returns the server's representation of the sealedSecret, and an error, if there is any.
-func (c *FakeSealedSecrets) Create(ctx context.Context, sealedSecret *v1alpha1.SealedSecret, opts v1.CreateOptions) (result *v1alpha1.SealedSecret, err error) {
-	obj, err := c.Fake.
-		Invokes(testing.NewCreateAction(sealedsecretsResource, c.ns, sealedSecret), &v1alpha1.SealedSecret{})
-
-	if obj == nil {
-		return nil, err
-	}
-	return obj.(*v1alpha1.SealedSecret), err
-}
-
-// Update takes the representation of a sealedSecret and updates it. Returns the server's representation of the sealedSecret, and an error, if there is any.
-func (c *FakeSealedSecrets) Update(ctx context.Context, sealedSecret *v1alpha1.SealedSecret, opts v1.UpdateOptions) (result *v1alpha1.SealedSecret, err error) {
-	obj, err := c.Fake.
-		Invokes(testing.NewUpdateAction(sealedsecretsResource, c.ns, sealedSecret), &v1alpha1.SealedSecret{})
-
-	if obj == nil {
-		return nil, err
-	}
-	return obj.(*v1alpha1.SealedSecret), err
-}
-
-// UpdateStatus was generated because the type contains a Status member.
-// Add a +genclient:noStatus comment above the type to avoid generating UpdateStatus().
-func (c *FakeSealedSecrets) UpdateStatus(ctx context.Context, sealedSecret *v1alpha1.SealedSecret, opts v1.UpdateOptions) (*v1alpha1.SealedSecret, error) {
-	obj, err := c.Fake.
-		Invokes(testing.NewUpdateSubresourceAction(sealedsecretsResource, "status", c.ns, sealedSecret), &v1alpha1.SealedSecret{})
-
-	if obj == nil {
-		return nil, err
-	}
-	return obj.(*v1alpha1.SealedSecret), err
-}
-
-// Delete takes name of the sealedSecret and deletes it. Returns an error if one occurs.
-func (c *FakeSealedSecrets) Delete(ctx context.Context, name string, opts v1.DeleteOptions) error {
-	_, err := c.Fake.
-		Invokes(testing.NewDeleteActionWithOptions(sealedsecretsResource, c.ns, name, opts), &v1alpha1.SealedSecret{})
-
-	return err
 }
 
-// DeleteCollection deletes a collection of objects.
-func (c *FakeSealedSecrets) DeleteCollection(ctx context.Context, opts v1.DeleteOptions, listOpts v1.ListOptions) error {
-	action := testing.NewDeleteCollectionAction(sealedsecretsResource, c.ns, listOpts)
-
-	_, err := c.Fake.Invokes(action, &v1alpha1.SealedSecretList{})
-	return err
-}
-
-// Patch applies the patch and returns the patched sealedSecret.
-func (c *FakeSealedSecrets) Patch(ctx context.Context, name string, pt types.Patc
```

---

### Incident Patch 4: `90293948` (2026-08-27)
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

---

### Incident Patch 5: `070ad166` (2026-08-18)
**Commit Message**: test(controller): fix flaky TestReadKey RSA key comparison (#2021)

**Description of the change**

`TestReadKey` compared generated and PEM-round-tripped `*rsa.PrivateKey`
/ `*x509.Certificate` values with `reflect.DeepEqual`. That is incorrect
for RSA keys: `PrivateKey` embeds `PrecomputedValues` with unexported
state (e.g. sync/once) that is not part of the cryptographic material
and can differ after parse, so the assertion failed intermittently on CI
with `Extracted key != original key`.

Switch the assertions to `key.Equal` and `cert.Equal`, which compare
cryptographic value equality and ignore precomputation metadata. Also
guard against an empty cert slice before indexing.

**Benefits**

- Removes a known flake of `TestReadKey` on GitHub Actions runners
(reproduced in CI logs for unrelated PRs as well as #1896).
- Uses the APIs intended for key/cert equality instead of structural
reflection.

**Possible drawbacks**

None expected. Test-only change; production `readKey` behavior is
unchanged.

**Applicable issues**

- fixes #1903

**Additional information**

- Root cause confirmed from CI: `keys_test.go: Extracted key != original
key` (not a Go toolchain bump issue; #1897 propo

**File**: `pkg/controller/keys_test.go` (modified, +6/-3)
```diff
@@ -7,7 +7,6 @@ import (
 	"encoding/pem"
 	"io"
 	mathrand "math/rand"
-	"reflect"
 	"strings"
 	"testing"
 	"time"
@@ -65,11 +64,15 @@ func TestReadKey(t *testing.T) {
 		t.Errorf("readKey() failed with: %v", err)
 	}
 
-	if !reflect.DeepEqual(key, key2) {
+	// Use crypto value equality, not reflect.DeepEqual: rsa.PrivateKey embeds
+	// PrecomputedValues with unexported sync/once state that differs between a
+	// freshly generated key and one re-parsed from PEM, which made this test
+	// flaky under CI (see #1903).
+	if !key.Equal(key2) {
 		t.Errorf("Extracted key != original key")
 	}
 
-	if !reflect.DeepEqual(cert, cert2[0]) {
+	if len(cert2) == 0 || !cert.Equal(cert2[0]) {
 		t.Errorf("Extracted cert != original cert")
 	}
 }
```

---

### Incident Patch 6: `66db186e` (2026-08-17)
**Commit Message**: fix: stop /v1/verify from acting as a decryption oracle (#2019)

spec.template.data isn't covered by the AEAD label, so /v1/verify's full
Unseal() (including template execution) let an attacker pair a victim's
real metadata/encryptedData with a crafted template and leak plaintext
one bit per request via the 200/409 response. AttemptUnseal now uses a
new ValidateEncryptedData() that only checks decryptability and never
renders templates.

Signed-off-by: Alvaro Neira <[REDACTED_EMAIL]>

**File**: `pkg/apis/sealedsecrets/v1alpha1/sealedsecret_expansion.go` (modified, +30/-0)
```diff
@@ -262,6 +262,36 @@ func NewSealedSecret(codecs runtimeserializer.CodecFactory, pubKey *rsa.PublicKe
 	return s, nil
 }
 
+// ValidateEncryptedData checks decryptability without rendering spec.template.data.
+func (s *SealedSecret) ValidateEncryptedData(privKeys map[string]*rsa.PrivateKey) error {
+	label := labelFor(s.GetObjectMeta())
+
+	if s.Spec.Data == nil {
+		var errs []error
+		for key, value := range s.Spec.EncryptedData {
+			valueBytes, err := base64.StdEncoding.DecodeString(value)
+			if err != nil {
+				errs = append(errs, multierror.Tag(key, err))
+				continue
+			}
+			if _, err := crypto.HybridDecrypt(rand.Reader, privKeys, valueBytes, label); err != nil {
+				errs = append(errs, multierror.Tag(key, err))
+			}
+		}
+		if errs != nil {
+			return multierror.Format(errors.Join(multierror.Uniq(errs)...), multierror.InlineFormatter)
+		}
+		return nil
+	} else if AcceptDeprecatedV1Data { // Support decrypting old secrets for backward compatibility
+		if len(s.Spec.EncryptedData) > 0 {
+			return fmt.Errorf("cannot use the field 'encryptedData' and the deprecated field 'data' at the same time")
+		}
+		_, err := crypto.HybridDecrypt(rand.Reader, privKeys, s.Spec.Data, label)
+		return err
+	}
+	return fmt.Errorf("using deprecated 'data' field, use 'encryptedData' or flip the feature flag")
+}
+
 // Unseal decrypts and returns the embedded v1.Secret.
 func (s *SealedSecret) Unseal(codecs runtimeserializer.CodecFactory, privKeys map[string]*rsa.PrivateKey) (*v1.Secret, error) {
 	boolTrue := true
```

**File**: `pkg/apis/sealedsecrets/v1alpha1/sealedsecret_test.go` (modified, +37/-0)
```diff
@@ -391,6 +391,43 @@ func TestSealRoundTripTemplateData(t *testing.T) {
 	}
 }
 
+// TestValidateEncryptedDataIgnoresTemplate ensures template execution can't affect decryptability checks.
+func TestValidateEncryptedDataIgnoresTemplate(t *testing.T) {
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
+	// A failing template must not turn a decryptable secret into a validation failure.
+	ssecret.Spec.Template.Data = map[string]string{
+		"probe": `{{ fail "attacker-controlled failure" }}`,
+	}
+	if err := ssecret.ValidateEncryptedData(keys); err != nil {
+		t.Errorf("ValidateEncryptedData returned error for a decryptable secret with a failing template: %v", err)
+	}
+
+	// A template with a parse error must likewise not affect the result.
+	ssecret.Spec.Template.Data = map[string]string{
+		"probe": `{{ .password`,
+	}
+	if err := ssecret.ValidateEncryptedData(keys); err != nil {
+		t.Errorf("ValidateEncryptedData returned error for a decryptable secret with an unparseable template: %v", err)
+	}
+
+	// Sanity check: genuinely undecryptable data must still fail.
+	_, otherKeys := generateTestKey(t, testRand(), 2048)
+	if err := ssecret.ValidateEncryptedData(otherKeys); err == nil {
+		t.Errorf("ValidateEncryptedData did not return an error for encryptedData undecryptable with the given keys")
+	}
+}
+
 // TestTemplateDataPlaintextReference verifies that plaintext keys defined
 // in spec.template.data can be referenced from sibling templates as
 // {{ .key }} variables. Regression test for
```

**File**: `pkg/controller/controller.go` (modified, +2/-2)
```diff
@@ -534,7 +534,7 @@ func formatImmutableError(key string) string {
 	return fmt.Sprintf("Error updating %s: the target Secret is immutable. Once a Secret is marked as immutable, it is not possible to revert this change nor to mutate the contents of the data field. You can only delete and recreate the Secret.", key)
 }
 
-// AttemptUnseal tries to unseal a secret.
+// AttemptUnseal checks whether a secret is decryptable, without rendering spec.template.data.
 func (c *Controller) AttemptUnseal(content []byte) (bool, error) {
 	if err := multidocyaml.EnsureNotMultiDoc(content); err != nil {
 		return false, err
@@ -547,7 +547,7 @@ func (c *Controller) AttemptUnseal(content []byte) (bool, error) {
 
 	switch s := object.(type) {
 	case *ssv1alpha1.SealedSecret:
-		if _, err := c.attemptUnseal(s); err != nil {
+		if err := s.ValidateEncryptedData(c.keyRegistry.privateKeys()); err != nil {
 			return false, nil
 		}
 		return true, nil
```

**File**: `pkg/controller/controller_test.go` (modified, +68/-0)
```diff
@@ -398,3 +398,71 @@ func TestRotateKeepScope(t *testing.T) {
 		t.Fatalf("Scope from the original and the rotate sealed secret do not match")
 	}
 }
+
+// TestAttemptUnsealIgnoresTemplate is a regression test for the /v1/verify decryption oracle.
+func TestAttemptUnsealIgnoresTemplate(t *testing.T) {
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
+	ssecret.Spec.Template.Data = map[string]string{
+		"probe": `{{ fail "attacker-controlled failure" }}`,
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
+	valid, err := controller.AttemptUnseal(data)
+	if err != nil {
+		t.Fatalf("AttemptUnseal returned error: %v", err)
+	}
+	if !valid {
+		t.Errorf("AttemptUnseal reported a decryptable secret as invalid because of an unrelated template failure")
+	}
+}
```

---

### Incident Patch 7: `1c69578c` (2026-08-17)
**Commit Message**: fix(controller): start HTTP early for large additional-namespaces lists (#2018)

**Description of the change**

With a large `--additional-namespaces` list the controller spent a long
time in a serial loop before it ever bound the HTTP listener. Liveness
probes that hit `/healthz` therefore failed even while startup was
making progress.

This change:

1. Starts the HTTP and metrics servers right after the home-namespace
controller begins so `/healthz` is available during bootstrap.
2. Adds `/readyz` which returns 503 until additional-namespace informers
have been started then 200.
3. Points the chart readiness probe at `/readyz` (liveness stays on
`/healthz`).
4. Starts additional-namespace validation and informer setup with a
concurrency limit of 16 so wall-clock time is not one API RTT per
namespace.

**Benefits**

- Pods with many additional namespaces keep liveness green while
informers start.
- Readiness stays false until those informers are started so traffic
waits for a useful controller.
- Faster bootstrap when the list is large.

**Possible drawbacks**

- Chart readiness now uses `/readyz`. Custom probes that expected
readiness on `/healthz` should switch path or use
`cust

**File**: `pkg/controller/main.go` (modified, +94/-26)
```diff
@@ -10,6 +10,8 @@ import (
 	"os/signal"
 	"sort"
 	"strings"
+	"sync"
+	"sync/atomic"
 	"syscall"
 	"time"
 
@@ -28,6 +30,11 @@ import (
 	ssinformers "github.com/bitnami/sealed-secrets/pkg/client/informers/externalversions"
 )
 
+// Cap concurrent namespace Gets and informer setup so a large
+// --additional-namespaces list does not serialize one RTT per namespace
+// and does not stampede the API server either.
+const additionalNamespaceBootstrapConcurrency = 16
+
 var (
 	// Selector used to find existing public/private key pairs on startup.
 	keySelector = fields.OneTermEqualSelector(SealedSecretsKeyLabel, "active")
@@ -250,41 +257,34 @@ func Main(f *Flags, version string) error {
 
 	go controller.Run(stop)
 
-	if f.AdditionalNamespaces != "" {
-		addNS := removeDuplicates(strings.Split(f.AdditionalNamespaces, ","))
-
-		for _, ns := range addNS {
-			if _, err := clientset.CoreV1().Namespaces().Get(ctx, ns, metav1.GetOptions{}); err != nil {
-				if errors.IsNotFound(err) {
-					slog.Error("namespace doesn't exist", "namespace", ns)
-					continue
-				}
-				return err
-			}
-			if ns != namespace {
-				ctlr, err := prepareController(clientset, ns, myNs, tweakopts, f, ssclientset, keyRegistry)
-				if err != nil {
-					return err
-				}
-				ctlr.oldGCBehavior = f.OldGCBehavior
-				ctlr.updateStatus = f.UpdateStatus
-				slog.Info("Starting informer", "namespace", ns)
-				go ctlr.Run(stop)
-			}
-		}
-	}
-
+	// ready becomes true after additional-namespace informers are started.
+	// HTTP must come up first so liveness probes succeed during that work.
+	var bootstrapped atomic.Bool
 	cp := func() ([]*x509.Certificate, error) {
 		cert, err := keyRegistry.getCert()
 		if err != nil {
 			return nil, err
 		}
 		return []*x509.Certificate{cert}, nil
 	}
-
-	server := httpserver(cp, controller.AttemptUnseal, controller.Rotate, f.RateLimitBurst, f.RateLimitPerSecond)
+	server := httpserver(cp, controller.AttemptUnseal, controller.Rotate, f.RateLimitBurst, f.RateLimitPerSecond, bootstrapped.Load)
 	serverMetrics := httpserverMetrics()
 
+	if f.AdditionalNamespaces != "" {
+		addNS := removeDuplicates(strings.Split(f.AdditionalNamespaces, ","))
+		// Bind ctx to the namespace probe here so the bootstrap helper does not
+		// take a context parameter (contextcheck would otherwise require
+		// prepareController/Run to accept one; those still use stopCh lifecycle).
+		probeNS := func(ns string) error {
+			_, err := clientset.CoreV1().Namespaces().Get(ctx, ns, metav1.GetOptions{})
+			return err
+		}
+		if err := startAdditionalNamespaceControllers(probeNS, clientset, ssclientset, keyRegistry, f, namespace, myNs, tweakopts, addNS, stop); err != nil {
+			return err
+		}
+	}
+	bootstrapped.Store(true)
+
 	sigterm := make(chan os.Signal, 1)
 	signal.Notify(sigterm, syscall.SIGTERM)
 	<-sigterm
@@ -300,6 +300,74 @@ func Main(f *Flags, version string) error {
 	return nil
 }
 
+// startAdditionalNamespaceControllers validates and starts a controller for each
+// extra namespace. Work is bounded-parallel so wall-clock startup scales better
+// than one serial API Get per namespace.
+//
+// probeNS should check that ns exists (typically clientset Get with the caller's
+// context). Missing namespaces are logged and skipped; other probe errors abort.
+func startAdditionalNamespaceControllers(
+	probeNS func(ns string) error,
+	clientset kubernetes.Interface,
+	ssclientset versioned.Interface,
+	keyRegistry *KeyRegistry,
+	f *Flags,
+	homeNamespace string,
+	keyNamespace string,
+	tweakopts func(*metav1.ListOptions),
+	namespaces []string,
+	stop <-chan struct{},
+) error {
+	sem := make(chan struct{}, additionalNamespaceBootstrapConcurrency)
+	var wg sync.WaitGroup
+	var mu sync.Mutex
+	var firstErr error
+
+	setErr := func(err error) {
+		if err == nil {
+			return
+		}
+		mu.Lock()
+		if firstErr == nil {
+			firstErr = err
+		}
+		mu.Unlock()
+	}
+
+	for _, ns := range namespaces {
+		ns := strings.TrimSpace(ns)
+		if ns == "" || ns == homeNamespace {
+			continue
+		}
+		wg.Add(1)
+		go func(ns string) {
+			defer wg.Done()
+			sem <- struct{}{}
+			defer func() { <-sem }()
+
+			if err := probeNS(ns); err != nil {
+				if errors.IsNotFound(err) {
+					slog.Error("namespace doesn't exist", "namespace", ns)
+					return
+				}
+				setErr(err)
+				return
+			}
+			ctlr, err := prepareController(clientset, ns, keyNamespace, tweakopts, f, ssclientset, keyRegistry)
+			if err != nil {
+				setErr(err)
+				return
+			}
+			ctlr.oldGCBehavior = f.OldGCBehavior
+			ctlr.updateStatus = f.UpdateStatus
+			slog.Info("Starting informer", "namespace", ns)
+			go ctlr.Run(stop)
+		}(ns)
+	}
+	wg.Wait()
+	return firstErr
+}
+
 func prepareController(
 	clientset kubernetes.Interface,
 	namespace string,
```

**File**: `pkg/controller/server.go` (modified, +23/-1)
```diff
@@ -29,11 +29,20 @@ type certProvider func() ([]*x509.Certificate, error)
 type secretChecker func([]byte) (bool, error)
 type secretRotator func([]byte) ([]byte, error)
 
+// readyFunc reports whether controller bootstrap finished (informers for the
+// home namespace and any --additional-namespaces have been started).
+// A nil readyFunc treats the process as always ready.
+type readyFunc func() bool
+
 // httpserver starts an HTTP that exposes core functionality like serving the public key
 // or secret rotation and validation. This endpoint is designed to be accessible by
 // all users of a given cluster. It must not leak any secret material.
 // The server is started in the background and a handle to it returned so it can be shut down.
-func httpserver(cp certProvider, sc secretChecker, sr secretRotator, burst int, rate int) *http.Server {
+//
+// /healthz is a liveness probe: it always succeeds once the listener is up so the
+// process is not killed while additional namespace informers are still starting.
+// /readyz is a readiness probe: it returns 503 until ready reports true.
+func httpserver(cp certProvider, sc secretChecker, sr secretRotator, burst int, rate int, ready readyFunc) *http.Server {
 	httpRateLimiter := rateLimiter(burst, rate)
 
 	mux := http.NewServeMux()
@@ -46,6 +55,19 @@ func httpserver(cp certProvider, sc secretChecker, sr secretRotator, burst int,
 		}
 	})
 
+	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
+		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
+		if ready != nil && !ready() {
+			w.WriteHeader(http.StatusServiceUnavailable)
+			_, _ = io.WriteString(w, "not ready\n")
+			return
+		}
+		_, err := io.WriteString(w, "ok\n")
+		if err != nil {
+			log.Fatal(err)
+		}
+	})
+
 	mux.Handle("/v1/verify", Instrument("/v1/verify", httpRateLimiter.RateLimit(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 		content, err := io.ReadAll(r.Body)
 		if err != nil {
```

**File**: `pkg/controller/server_test.go` (modified, +53/-1)
```diff
@@ -75,7 +75,7 @@ func TestHttpCert(t *testing.T) {
 	}
 
 	cs := &testCertStore{}
-	server := httpserver(cs.getCert, nil, nil, 2, 2)
+	server := httpserver(cs.getCert, nil, nil, 2, 2, nil)
 	defer shutdownServer(server, t)
 	hp := *listenAddr
 	if strings.HasPrefix(hp, ":") {
@@ -119,3 +119,55 @@ func TestHttpCert(t *testing.T) {
 	cs.setCert(certAfter)
 	check(certAfter)
 }
+
+func TestHttpReadyz(t *testing.T) {
+	ready := false
+	server := httpserver(func() ([]*x509.Certificate, error) {
+		return nil, fmt.Errorf("no cert")
+	}, nil, nil, 2, 2, func() bool { return ready })
+	defer shutdownServer(server, t)
+
+	hp := *listenAddr
+	if strings.HasPrefix(hp, ":") {
+		hp = fmt.Sprintf("localhost%s", hp)
+	}
+	url := fmt.Sprintf("http://%s/readyz", hp)
+	healthURL := fmt.Sprintf("http://%s/healthz", hp)
+
+	// Wait for listener
+	deadline := time.Now().Add(5 * time.Second)
+	for {
+		resp, err := http.Get(healthURL)
+		if err == nil {
+			resp.Body.Close()
+			if resp.StatusCode == http.StatusOK {
+				break
+			}
+		}
+		if time.Now().After(deadline) {
+			t.Fatal("server did not become reachable")
+		}
+		time.Sleep(50 * time.Millisecond)
+	}
+
+	resp, err := http.Get(url)
+	if err != nil {
+		t.Fatal(err)
+	}
+	body, _ := io.ReadAll(resp.Body)
+	resp.Body.Close()
+	if got, want := resp.StatusCode, http.StatusServiceUnavailable; got != want {
+		t.Fatalf("before ready: got status %v want %v body %q", got, want, body)
+	}
+
+	ready = true
+	resp, err = http.Get(url)
+	if err != nil {
+		t.Fatal(err)
+	}
+	body, _ = io.ReadAll(resp.Body)
+	resp.Body.Close()
+	if got, want := resp.StatusCode, http.StatusOK; got != want {
+		t.Fatalf("after ready: got status %v want %v body %q", got, want, body)
+	}
+}
```

---

### Incident Patch 8: `6a6e888b` (2026-07-06)
**Commit Message**: Revert ArtifactHub repository metadata OCI push (#2005)

Signed-off-by: Alvaro Neira <[REDACTED_EMAIL]>

**File**: `.github/workflows/helm-release.yaml` (modified, +0/-13)
```diff
@@ -73,19 +73,6 @@ jobs:
           helm package helm/sealed-secrets/
           helm push sealed-secrets-${{ env.chart_version }}.tgz oci://registry-1.docker.io/bitnamicharts
 
-      - name: Install oras
-        uses: oras-project/setup-oras@38de303aac69abb66f3e6255b7198bff35f323e3 # v2.0.0
-
-      - name: Push Artifact Hub repository metadata
-        env:
-          OCI_PASS: ${{ secrets.OCI_PASSWORD }}
-          OCI_USR: ${{ secrets.OCI_USERNAME }}
-        run: |
-          echo $OCI_PASS | oras login -u $OCI_USR --password-stdin registry-1.docker.io
-          oras push registry-1.docker.io/bitnamicharts/sealed-secrets:artifacthub.io \
-            --config /dev/null:application/vnd.cncf.artifacthub.config.v1+yaml \
-            helm/sealed-secrets/artifacthub-repo.yml:application/vnd.cncf.artifacthub.repository-metadata.layer.v1.yaml
-
       - name: Create imglock file
         working-directory: ./helm
         run: |
```

---

### Incident Patch 9: `5ba86c23` (2026-06-18)
**Commit Message**: fix: add mutex locking to KeyRegistry to prevent data races (#1905)

**Description of the change**

KeyRegistry embedded sync.Mutex but only getCert() held it. Background
key rotation goroutines write keys/mostRecentKey while HTTP handlers
read them concurrently, causing data races. Add mutex acquisition to
registerNewKey, latestPrivateKey, and new accessor methods (privateKeys,
keyLen, mostRecentKeyTime). Replace direct field access in controller
and main with thread-safe accessors.

**Benefits**

No data race.

**Possible drawbacks**

It's possible to end up with lower throughput, which is the reason I
changed mutex to RWMutex.
The embedded sync.Mutex was promoted, meaning external code could call
kr.Lock() directly. The named mu field removes that.

**Applicable issues**

- fixes #1904

---------

Signed-off-by: John Allberg <[REDACTED_EMAIL]>
Signed-off-by: Alvaro Neira Ayuso <[REDACTED_EMAIL]>
Co-authored-by: Alvaro Neira Ayuso <[REDACTED_EMAIL]>

**File**: `pkg/controller/controller.go` (modified, +5/-7)
```diff
@@ -2,7 +2,6 @@ package controller
 
 import (
 	"context"
-	"crypto/rsa"
 	"encoding/json"
 	"errors"
 	"fmt"
@@ -579,7 +578,10 @@ func (c *Controller) Rotate(content []byte) ([]byte, error) {
 		if err != nil {
 			return nil, fmt.Errorf("error decrypting secret. %v", err)
 		}
-		latestPrivKey := c.keyRegistry.latestPrivateKey()
+		latestPrivKey, err := c.keyRegistry.latestPrivateKey()
+		if err != nil {
+			return nil, fmt.Errorf("error getting latest private key. %v", err)
+		}
 		resealedSecret, err := ssv1alpha1.NewSealedSecret(scheme.Codecs, &latestPrivKey.PublicKey, secret)
 		if err != nil {
 			return nil, fmt.Errorf("error creating new sealed secret. %v", err)
@@ -599,9 +601,5 @@ func (c *Controller) attemptUnseal(ss *ssv1alpha1.SealedSecret) (*corev1.Secret,
 }
 
 func attemptUnseal(ss *ssv1alpha1.SealedSecret, keyRegistry *KeyRegistry) (*corev1.Secret, error) {
-	privateKeys := map[string]*rsa.PrivateKey{}
-	for k, v := range keyRegistry.keys {
-		privateKeys[k] = v.private
-	}
-	return ss.Unseal(scheme.Codecs, privateKeys)
+	return ss.Unseal(scheme.Codecs, keyRegistry.privateKeys())
 }
```

**File**: `pkg/controller/keyregistry.go` (modified, +45/-5)
```diff
@@ -25,7 +25,7 @@ type Key struct {
 
 // A KeyRegistry manages the key pairs used to (un)seal secrets.
 type KeyRegistry struct {
-	sync.Mutex
+	mu            sync.RWMutex
 	client        kubernetes.Interface
 	namespace     string
 	keyPrefix     string
@@ -78,6 +78,10 @@ func (kr *KeyRegistry) registerNewKey(keyName string, privKey *rsa.PrivateKey, c
 		fingerprint:  fingerprint,
 		orderingTime: orderingTime,
 	}
+
+	kr.mu.Lock()
+	defer kr.mu.Unlock()
+
 	kr.keys[k.fingerprint] = k
 
 	if kr.mostRecentKey == nil || kr.mostRecentKey.orderingTime.Before(orderingTime) {
@@ -87,14 +91,50 @@ func (kr *KeyRegistry) registerNewKey(keyName string, privKey *rsa.PrivateKey, c
 	return nil
 }
 
-func (kr *KeyRegistry) latestPrivateKey() *rsa.PrivateKey {
-	return kr.mostRecentKey.private
+func (kr *KeyRegistry) latestPrivateKey() (*rsa.PrivateKey, error) {
+	kr.mu.RLock()
+	defer kr.mu.RUnlock()
+
+	if kr.mostRecentKey == nil {
+		return nil, fmt.Errorf("key registry has no keys")
+	}
+	return kr.mostRecentKey.private, nil
+}
+
+// privateKeys returns a snapshot copy of the private keys so callers
+// can iterate without holding the mutex.
+func (kr *KeyRegistry) privateKeys() map[string]*rsa.PrivateKey {
+	kr.mu.RLock()
+	defer kr.mu.RUnlock()
+
+	m := make(map[string]*rsa.PrivateKey, len(kr.keys))
+	for k, v := range kr.keys {
+		m[k] = v.private
+	}
+	return m
+}
+
+func (kr *KeyRegistry) keyLen() int {
+	kr.mu.RLock()
+	defer kr.mu.RUnlock()
+
+	return len(kr.keys)
+}
+
+func (kr *KeyRegistry) mostRecentKeyTime() (time.Time, error) {
+	kr.mu.RLock()
+	defer kr.mu.RUnlock()
+
+	if kr.mostRecentKey == nil {
+		return time.Time{}, fmt.Errorf("key registry has no keys")
+	}
+	return kr.mostRecentKey.orderingTime, nil
 }
 
 // getCert returns the current certificate. This method can be called by another goroutine.
 func (kr *KeyRegistry) getCert() (*x509.Certificate, error) {
-	kr.Lock()
-	defer kr.Unlock()
+	kr.mu.RLock()
+	defer kr.mu.RUnlock()
 
 	if kr.mostRecentKey == nil {
 		return nil, fmt.Errorf("key registry has no keys")
```

**File**: `pkg/controller/keyregistry_test.go` (modified, +309/-5)
```diff
@@ -1,8 +1,14 @@
 package controller
 
 import (
+	"crypto/rsa"
+	"crypto/x509"
+	"fmt"
+	"sync"
 	"testing"
 	"time"
+
+	"github.com/bitnami/sealed-secrets/pkg/crypto"
 )
 
 func TestRegisterNewKey(t *testing.T) {
@@ -11,7 +17,7 @@ func TestRegisterNewKey(t *testing.T) {
 	cn := "my-cn"
 	kr := NewKeyRegistry(nil, "namespace", "prefix", "label", keySize)
 
-	if kr.mostRecentKey != nil {
+	if kr.keyLen() != 0 {
 		t.Fatal("this test assumes a new key registry has no keys")
 	}
 
@@ -30,15 +36,313 @@ func TestRegisterNewKey(t *testing.T) {
 	if err := kr.registerNewKey("k2", key2, cert2, t2); err != nil {
 		t.Fatal(err)
 	}
-	if got, want := kr.mostRecentKey.private, key2; got != want {
-		t.Errorf("got: %v, want: %v", got, want)
+	got, err := kr.latestPrivateKey()
+	if err != nil {
+		t.Fatal(err)
+	}
+	if got != key2 {
+		t.Errorf("got: %v, want: %v", got, key2)
 	}
 
 	// key1 is older, so it shouldn't replace key2 as the mostRecentKey
 	if err := kr.registerNewKey("k1", key1, cert1, t1); err != nil {
 		t.Fatal(err)
 	}
-	if got, want := kr.mostRecentKey.private, key2; got != want {
-		t.Errorf("got: %v, want: %v", got, want)
+	got, err = kr.latestPrivateKey()
+	if err != nil {
+		t.Fatal(err)
+	}
+	if got != key2 {
+		t.Errorf("got: %v, want: %v", got, key2)
+	}
+}
+
+func TestLatestPrivateKeyEmpty(t *testing.T) {
+	const keySize = 2048
+	kr := NewKeyRegistry(nil, "namespace", "prefix", "label", keySize)
+
+	key, err := kr.latestPrivateKey()
+	if err == nil {
+		t.Fatal("expected error from latestPrivateKey on empty registry, got nil")
+	}
+	if key != nil {
+		t.Fatalf("expected nil key, got: %v", key)
+	}
+}
+
+func TestPrivateKeys(t *testing.T) {
+	const keySize = 2048
+	validFor := time.Hour
+	cn := "my-cn"
+	kr := NewKeyRegistry(nil, "namespace", "prefix", "label", keySize)
+
+	key1, cert1, err := generatePrivateKeyAndCert(keySize, validFor, cn)
+	if err != nil {
+		t.Fatal(err)
+	}
+	key2, cert2, err := generatePrivateKeyAndCert(keySize, validFor, cn)
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	if err := kr.registerNewKey("k1", key1, cert1, time.Now()); err != nil {
+		t.Fatal(err)
+	}
+	if err := kr.registerNewKey("k2", key2, cert2, time.Now()); err != nil {
+		t.Fatal(err)
+	}
+
+	pkeys := kr.privateKeys()
+	if got, want := len(pkeys), 2; got != want {
+		t.Fatalf("privateKeys length: got %d, want %d", got, want)
+	}
+
+	fp1, err := crypto.PublicKeyFingerprint(&key1.PublicKey)
+	if err != nil {
+		t.Fatal(err)
+	}
+	fp2, err := crypto.PublicKeyFingerprint(&key2.PublicKey)
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	if got, ok := pkeys[fp1]; !ok {
+		t.Errorf("privateKeys missing fingerprint %s", fp1)
+	} else if got.PublicKey.N.Cmp(key1.PublicKey.N) != 0 {
+		t.Errorf("privateKeys[%s]: public key mismatch", fp1)
+	}
+
+	if got, ok := pkeys[fp2]; !ok {
+		t.Errorf("privateKeys missing fingerprint %s", fp2)
+	} else if got.PublicKey.N.Cmp(key2.PublicKey.N) != 0 {
+		t.Errorf("privateKeys[%s]: public key mismatch", fp2)
+	}
+}
+
+func TestKeyLen(t *testing.T) {
+	const keySize = 2048
+	validFor := time.Hour
+	cn := "my-cn"
+	kr := NewKeyRegistry(nil, "namespace", "prefix", "label", keySize)
+
+	if got := kr.keyLen(); got != 0 {
+		t.Fatalf("keyLen on empty registry: got %d, want 0", got)
+	}
+
+	key1, cert1, err := generatePrivateKeyAndCert(keySize, validFor, cn)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if err := kr.registerNewKey("k1", key1, cert1, time.Now()); err != nil {
+		t.Fatal(err)
+	}
+	if got := kr.keyLen(); got != 1 {
+		t.Fatalf("keyLen after one key: got %d, want 1", got)
+	}
+
+	key2, cert2, err := generatePrivateKeyAndCert(keySize, validFor, cn)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if err := kr.registerNewKey("k2", key2, cert2, time.Now()); err != nil {
+		t.Fatal(err)
+	}
+	if got := kr.keyLen(); got != 2 {
+		t.Fatalf("keyLen after two keys: got %d, want 2", got)
+	}
+}
+
+func TestMostRecentKeyTimeEmpty(t *testing.T) {
+	const keySize = 2048
+	kr := NewKeyRegistry(nil, "namespace", "prefix", "label", keySize)
+
+	_, err := kr.mostRecentKeyTime()
+	if err == nil {
+		t.Fatal("expected error from mostRecentKeyTime on empty registry, got nil")
+	}
+}
+
+func TestMostRecentKeyTime(t *testing.T) {
+	const keySize = 2048
+	validFor := time.Hour
+	cn := "my-cn"
+	kr := NewKeyRegistry(nil, "namespace", "prefix", "label", keySize)
+
+	t1 := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
+	t2 := time.Date(2025, 6, 15, 12, 0, 0, 0, time.UTC)
+
+	key1, cert1, err := generatePrivateKeyAndCert(keySize, validFor, cn)
+	if err != nil {
+		t.Fatal(err)
+	}
+	key2, cert2, err := generatePrivateKeyAndCert(keySize, validFor, cn)
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	// Register key1 with earlier time first.
+	if err := kr.registerNewKey("k1", key1, cert1, t1); err != nil {
+		t.Fatal(err)
+	}
+	got, err := kr.mostRecentKeyTime()
+	if err != nil {
+		t.Fatal(err)
+	}
+	if !got.Equal(t1) {
+		t.Errorf("mostRecentKeyTime after k1: got %v, want %v", got, t1)
+	}
+
+	// Register key2 with later time; most
```

**File**: `pkg/controller/main.go` (modified, +4/-2)
```diff
@@ -145,7 +145,8 @@ func myNamespace() string {
 func initKeyRenewal(ctx context.Context, registry *KeyRegistry, period, validFor time.Duration, cutoffTime time.Time, cn string, privateKeyAnnotations string, privateKeyLabels string) (func(), error) {
 	// Create a new key if it's the first key,
 	// or if it's older than cutoff time.
-	if len(registry.keys) == 0 || registry.mostRecentKey.orderingTime.Before(cutoffTime) {
+	mostRecentTime, err := registry.mostRecentKeyTime()
+	if err != nil || mostRecentTime.Before(cutoffTime) {
 		if _, err := registry.generateKey(ctx, validFor, cn, privateKeyAnnotations, privateKeyLabels); err != nil {
 			return nil, err
 		}
@@ -163,7 +164,8 @@ func initKeyRenewal(ctx context.Context, registry *KeyRegistry, period, validFor
 
 	// If key rotation is enabled, we'll rotate the key when the most recent
 	// key becomes stale (older than period).
-	mostRecentKeyAge := time.Since(registry.mostRecentKey.orderingTime)
+	mostRecentTime, _ = registry.mostRecentKeyTime()
+	mostRecentKeyAge := time.Since(mostRecentTime)
 	initialDelay := period - mostRecentKeyAge
 	if initialDelay < 0 {
 		initialDelay = 0
```

---

### Incident Patch 10: `4e61da07` (2026-06-18)
**Commit Message**: Update security context defaults to comply with restricted pod securi… (#1981)

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

Updates the chart's default security context to comply with the
Kubernetes restricted Pod Security Standard (see [Kuberntes
Doc](https://kubernetes.io/docs/concepts/security/pod-security-standards/)

**File**: `helm/sealed-secrets/README.md` (modified, +20/-16)
```diff
@@ -5,22 +5,24 @@ Sealed Secrets are "one-way" encrypted K8s Secrets that can be created by anyone
 <!-- START doctoc generated TOC please keep comment here to allow auto update -->
 <!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
 
-- [TL;DR](#tldr)
-- [Introduction](#introduction)
-- [Prerequisites](#prerequisites)
-- [Installing the Chart](#installing-the-chart)
-- [Uninstalling the Chart](#uninstalling-the-chart)
-- [Parameters](#parameters)
-  - [Common parameters](#common-parameters)
-  - [Sealed Secrets Parameters](#sealed-secrets-parameters)
-  - [Traffic Exposure Parameters](#traffic-exposure-parameters)
-  - [Other Parameters](#other-parameters)
-  - [Metrics parameters](#metrics-parameters)
-- [Using kubeseal](#using-kubeseal)
-- [Configuration and installation details](#configuration-and-installation-details)
-- [Troubleshooting](#troubleshooting)
-- [Upgrading](#upgrading)
-  - [To 2.0.0](#to-200)
+- [Sealed Secrets](#sealed-secrets)
+  - [TL;DR](#tldr)
+  - [Introduction](#introduction)
+  - [Prerequisites](#prerequisites)
+  - [Installing the Chart](#installing-the-chart)
+  - [Uninstalling the Chart](#uninstalling-the-chart)
+  - [Parameters](#parameters)
+    - [Common parameters](#common-parameters)
+    - [Sealed Secrets Parameters](#sealed-secrets-parameters)
+    - [Traffic Exposure Parameters](#traffic-exposure-parameters)
+    - [Other Parameters](#other-parameters)
+    - [Metrics parameters](#metrics-parameters)
+    - [PodDisruptionBudget Parameters](#poddisruptionbudget-parameters)
+  - [Using kubeseal](#using-kubeseal)
+  - [Configuration and installation details](#configuration-and-installation-details)
+  - [Troubleshooting](#troubleshooting)
+  - [Upgrading](#upgrading)
+    - [To 2.0.0](#to-200)
 
 <!-- END doctoc generated TOC please keep comment here to allow auto-update -->
 
@@ -136,10 +138,12 @@ The command removes all the Kubernetes components associated with the chart and
 | `resources.requests`                              | The requested resources for the Sealed Secret containers                                                           | `{}`                                |
 | `podSecurityContext.enabled`                      | Enabled Sealed Secret pods' Security Context                                                                       | `true`                              |
 | `podSecurityContext.fsGroup`                      | Set Sealed Secret pod's Security Context fsGroup                                                                   | `65534`                             |
+| `podSecurityContext.seccompProfile.type`          | Set Sealed Secret pod's Security Context seccomp profile type                                                      | `RuntimeDefault`                    |
 | `containerSecurityContext.enabled`                | Enabled Sealed Secret containers' Security Context                                                                 | `true`                              |
 | `containerSecurityContext.readOnlyRootFilesystem` | Whether the Sealed Secret container has a read-only root filesystem                                                | `true`                              |
 | `containerSecurityContext.runAsNonRoot`           | Indicates that the Sealed Secret container must run as a non-root user                                             | `true`                              |
 | `containerSecurityContext.runAsUser`              | Set Sealed Secret containers' Security Context runAsUser                                                           | `1001`                              |
+| `containerSecurityContext.allowPrivilegeEscalation` | Set Sealed Secret containers' privilege escalation                                                               | `false`                             |
 | `containerSecurityContext.capabilities`           | Adds and removes POSIX capabilities from running containers (see `values.yaml`)                                    |                                     |
 | `podLabels`                                       | Extra labels for Sealed Secret pods                                                                                | `{}`                                |
 | `podAnnotations`                                  | Annotations for Sealed Secret pods                                                                                 | `{}`                                |
```

**File**: `helm/sealed-secrets/values.yaml` (modified, +5/-0)
```diff
@@ -195,16 +195,20 @@ resources:
 ## ref: https://kubernetes.io/docs/tasks/configure-pod-container/security-context/#set-the-security-context-for-a-pod
 ## @param podSecurityContext.enabled Enabled Sealed Secret pods' Security Context
 ## @param podSecurityContext.fsGroup Set Sealed Secret pod's Security Context fsGroup
+## @param podSecurityContext.seccompProfile.type Set Sealed Secret pod's Security Context seccomp profile type
 ##
 podSecurityContext:
   enabled: true
   fsGroup: 65534
+  seccompProfile:
+    type: RuntimeDefault
 ## Configure Container Security Context
 ## ref: https://kubernetes.io/docs/tasks/configure-pod-container/security-context/#set-the-security-context-for-a-pod
 ## @param containerSecurityContext.enabled Enabled Sealed Secret containers' Security Context
 ## @param containerSecurityContext.readOnlyRootFilesystem Whether the Sealed Secret container has a read-only root filesystem
 ## @param containerSecurityContext.runAsNonRoot Indicates that the Sealed Secret container must run as a non-root user
 ## @param containerSecurityContext.runAsUser Set Sealed Secret containers' Security Context runAsUser
+## @param containerSecurityContext.allowPrivilegeEscalation Set Sealed Secret containers' privilege escalation
 ## @extra containerSecurityContext.capabilities Adds and removes POSIX capabilities from running containers (see `values.yaml`)
 ## @skip  containerSecurityContext.capabilities.drop
 ##
@@ -213,6 +217,7 @@ containerSecurityContext:
   readOnlyRootFilesystem: true
   runAsNonRoot: true
   runAsUser: 1001
+  allowPrivilegeEscalation: false
   capabilities:
     drop:
       - ALL
```

---

### Incident Patch 11: `8a9e8328` (2026-06-02)
**Commit Message**: Revert "Fix oci push" (#1979)

Reverts bitnami-labs/sealed-secrets#1967

**File**: `.github/workflows/helm-release.yaml` (modified, +2/-1)
```diff
@@ -67,8 +67,9 @@ jobs:
         env:
           OCI_PASS: ${{ secrets.OCI_PASSWORD }}
           OCI_USR: ${{ secrets.OCI_USERNAME }}
+          HELM_EXPERIMENTAL_OCI: 1
         run: |
-          echo $OCI_PASS | docker login -u $OCI_USR --password-stdin registry-1.docker.io
+          echo $OCI_PASS | helm registry login -u $OCI_USR --password-stdin registry-1.docker.io
           helm package helm/sealed-secrets/
           helm push sealed-secrets-${{ env.chart_version }}.tgz oci://registry-1.docker.io/bitnamicharts
 
```

---

### Incident Patch 12: `00f0e5be` (2026-05-21)
**Commit Message**: Fix oci push (#1967)

Signed-off-by: Alvaro Neira <[REDACTED_EMAIL]>

**File**: `.github/workflows/helm-release.yaml` (modified, +1/-2)
```diff
@@ -67,9 +67,8 @@ jobs:
         env:
           OCI_PASS: ${{ secrets.OCI_PASSWORD }}
           OCI_USR: ${{ secrets.OCI_USERNAME }}
-          HELM_EXPERIMENTAL_OCI: 1
         run: |
-          echo $OCI_PASS | helm registry login -u $OCI_USR --password-stdin registry-1.docker.io
+          echo $OCI_PASS | docker login -u $OCI_USR --password-stdin registry-1.docker.io
           helm package helm/sealed-secrets/
           helm push sealed-secrets-${{ env.chart_version }}.tgz oci://registry-1.docker.io/bitnamicharts/sealed-secrets
 
```

---

### Incident Patch 13: `8c3d506a` (2026-05-21)
**Commit Message**: Expose plaintext template.data values in template rendering context (#1940)

## Summary

When a `SealedSecret` defines plaintext keys alongside encrypted keys
inside `spec.template.data`, sibling templates in the same map could not
reference those plaintext keys as `{{ .key }}` variables — the
controller rendered `<no value>` instead of the configured plaintext
value.

This PR fixes that by pre-populating the template execution context with
the raw plaintext values from `spec.template.data` before rendering, so
templates can reference them just like decrypted `encryptedData` keys.

Closes #1607

## Reproducer (matches the issue)

```yaml
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: mySecret
spec:
  encryptedData:
    password: <ciphertext>
  template:
    data:
      username: "myUsername"
      settings.xml: |-
        <server>
          <username>{{ .username }}</username>
          <password>{{ .password }}</password>
        </server>
```

**Before this PR**, the rendered `settings.xml` is:

```xml
<server>
  <username><no value></username>
  <password>plaintext password</password>
</server>
```

**After this PR**, it is:

```xml
<server>
  <username>my

**File**: `pkg/apis/sealedsecrets/v1alpha1/sealedsecret_expansion.go` (modified, +20/-1)
```diff
@@ -298,6 +298,20 @@ func (s *SealedSecret) Unseal(codecs runtimeserializer.CodecFactory, privKeys ma
 			data[key] = string(plaintext)
 		}
 
+		// Expose raw plaintext values from spec.template.data in the
+		// template rendering context, so that templates defined in
+		// spec.template.data can reference sibling plaintext keys as
+		// {{ .key }} variables (e.g. {{ .username }} alongside an
+		// encrypted password). Encrypted values take precedence on key
+		// collision so adding a plaintext key can never silently shadow
+		// a real secret value.
+		// See https://github.com/bitnami-labs/sealed-secrets/issues/1607
+		for key, value := range s.Spec.Template.Data {
+			if _, exists := data[key]; !exists {
+				data[key] = value
+			}
+		}
+
 		for key, value := range s.Spec.Template.Data {
 			var plaintext bytes.Buffer
 
@@ -310,7 +324,12 @@ func (s *SealedSecret) Unseal(codecs runtimeserializer.CodecFactory, privKeys ma
 			if err != nil {
 				errs = append(errs, multierror.Tag(key, err))
 			}
-			secret.Data[key] = plaintext.Bytes()
+			// Do not overwrite a key that was already populated from
+			// encryptedData; encrypted values take precedence in the
+			// output Secret as well as in the template rendering context.
+			if _, fromEncrypted := s.Spec.EncryptedData[key]; !fromEncrypted {
+				secret.Data[key] = plaintext.Bytes()
+			}
 		}
 
 		if errs != nil {
```

**File**: `pkg/apis/sealedsecrets/v1alpha1/sealedsecret_test.go` (modified, +104/-0)
```diff
@@ -391,6 +391,110 @@ func TestSealRoundTripTemplateData(t *testing.T) {
 	}
 }
 
+// TestTemplateDataPlaintextReference verifies that plaintext keys defined
+// in spec.template.data can be referenced from sibling templates as
+// {{ .key }} variables. Regression test for
+// https://github.com/bitnami-labs/sealed-secrets/issues/1607
+func TestTemplateDataPlaintextReference(t *testing.T) {
+	sealed := SealedSecret{
+		Spec: SealedSecretSpec{
+			Template: SecretTemplateSpec{
+				Data: map[string]string{
+					"username":     "myUsername",
+					"settings.xml": `<server><username>{{ .username }}</username></server>`,
+				},
+			},
+		},
+	}
+
+	unsealed, err := sealed.Unseal(serializer.CodecFactory{}, nil)
+	if err != nil {
+		t.Fatalf("Unseal returned error: %v", err)
+	}
+
+	if got, want := string(unsealed.Data["username"]), "myUsername"; got != want {
+		t.Errorf("username: got %q, want %q", got, want)
+	}
+	if got, want := string(unsealed.Data["settings.xml"]),
+		`<server><username>myUsername</username></server>`; got != want {
+		t.Errorf("settings.xml: got %q, want %q", got, want)
+	}
+}
+
+// TestTemplateDataMixedEncryptedAndPlaintext verifies that templates in
+// spec.template.data can reference both encryptedData keys and sibling
+// plaintext keys defined in spec.template.data in the same template.
+// Regression test for
+// https://github.com/bitnami-labs/sealed-secrets/issues/1607
+func TestTemplateDataMixedEncryptedAndPlaintext(t *testing.T) {
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
+	ssecret, codecs, keys := sealSecret(t, &secret, NewSealedSecret)
+
+	ssecret.Spec.Template.Data = map[string]string{
+		"username": "myUsername",
+		"settings.xml": `<server>` +
+			`<username>{{ .username }}</username>` +
+			`<password>{{ .password }}</password>` +
+			`</server>`,
+	}
+
+	unsealed, err := ssecret.Unseal(codecs, keys)
+	if err != nil {
+		t.Fatalf("Unseal returned error: %v", err)
+	}
+
+	if got, want := string(unsealed.Data["settings.xml"]),
+		`<server><username>myUsername</username><password>hunter2</password></server>`; got != want {
+		t.Errorf("settings.xml: got %q, want %q", got, want)
+	}
+}
+
+// TestTemplateDataEncryptedTakesPrecedenceOverPlaintext verifies that when
+// the same key exists in both encryptedData and template.data, the
+// decrypted value from encryptedData wins. This guards against accidentally
+// shadowing a real secret with a plaintext placeholder.
+func TestTemplateDataEncryptedTakesPrecedenceOverPlaintext(t *testing.T) {
+	secret := v1.Secret{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "myname",
+			Namespace: "myns",
+		},
+		Data: map[string][]byte{
+			"shared": []byte("from-encrypted"),
+		},
+	}
+
+	ssecret, codecs, keys := sealSecret(t, &secret, NewSealedSecret)
+
+	ssecret.Spec.Template.Data = map[string]string{
+		"shared":  "from-plaintext-should-be-ignored",
+		"out.txt": `{{ .shared }}`,
+	}
+
+	unsealed, err := ssecret.Unseal(codecs, keys)
+	if err != nil {
+		t.Fatalf("Unseal returned error: %v", err)
+	}
+
+	if got, want := string(unsealed.Data["out.txt"]), "from-encrypted"; got != want {
+		t.Errorf("out.txt: got %q, want %q", got, want)
+	}
+	// The output Secret's "shared" key must retain the decrypted value,
+	// not be overwritten by the plaintext template.data entry.
+	if got, want := string(unsealed.Data["shared"]), "from-encrypted"; got != want {
+		t.Errorf("shared key in output Secret: got %q, want %q (plaintext template.data must not overwrite encrypted value)", got, want)
+	}
+}
+
 func TestTemplateWithoutEncryptedData(t *testing.T) {
 	sealed := SealedSecret{
 		Spec: SealedSecretSpec{
```

---

### Incident Patch 14: `ce3fec4e` (2026-04-10)
**Commit Message**: fix: add explicit GITHUB_TOKEN permissions to workflows (#1933)

Signed-off-by: Alfredo Garcia <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci.yml` (modified, +3/-0)
```diff
@@ -6,6 +6,9 @@ on:
   pull_request:
     branches: [ main ]
 
+permissions:
+  contents: read
+
 env:
   controller_registry: docker.io
   controller_repository: bitnami/sealed-secrets-controller
```

**File**: `.github/workflows/helm-release.yaml` (modified, +5/-0)
```diff
@@ -9,6 +9,11 @@ on:
       - main
   workflow_dispatch:
 
+permissions:
+  contents: write
+  packages: write
+  pull-requests: write
+
 jobs:
   release:
     runs-on: ubuntu-latest
```

**File**: `.github/workflows/helm-vib.yaml` (modified, +3/-0)
```diff
@@ -7,6 +7,9 @@ on:
     paths:
        - 'helm/**'
 
+permissions:
+  contents: read
+
 env:
   CSP_API_URL: https://console.tanzu.broadcom.com
   CSP_API_TOKEN: ${{ secrets.CSP_API_TOKEN }}
```

**File**: `.github/workflows/publish-release.yaml` (modified, +4/-0)
```diff
@@ -8,6 +8,10 @@ on:
         required: true
         type: string
 
+permissions:
+  contents: write
+  pull-requests: write
+
 jobs:
   chart-pr:
     runs-on: ubuntu-latest
```

**File**: `.github/workflows/release.yaml` (modified, +4/-0)
```diff
@@ -6,6 +6,10 @@ on:
     branches:
       - 'release/v[0-9]+.[0-9]+.[0-9]+'
 
+permissions:
+  contents: write
+  packages: write
+
 jobs:
   build:
     runs-on: ubuntu-latest
```

**File**: `.github/workflows/stale.yml` (modified, +5/-0)
```diff
@@ -4,6 +4,11 @@ on:
     # Stalebot will be executed at 1:00 AM every day
     - cron: '0 1 * * *'
 
+permissions:
+  contents: write
+  issues: write
+  pull-requests: write
+
 jobs:
   stale:
     runs-on: ubuntu-latest
```

#### Recent Merged Pull Requests:
- **PR #2068** (closed): Bump k8s.io/api from 0.37.0 to 0.37.1 (@dependabot[bot])
- **PR #2067** (2026-09-30): Bump k8s.io/client-go from 0.37.0 to 0.37.1 (@dependabot[bot])
- **PR #2066** (closed): Bump k8s.io/apimachinery from 0.37.0 to 0.37.1 (@dependabot[bot])
- **PR #2065** (2026-10-01): Bump github.com/onsi/gomega from 1.43.1 to 1.44.0 (@dependabot[bot])
- **PR #2064** (2026-09-30): Bump k8s.io/code-generator from 0.37.0 to 0.37.1 (@dependabot[bot])
- **PR #2062** (2026-09-23): Bump github.com/onsi/gomega from 1.43.0 to 1.43.1 (@dependabot[bot])
- **PR #2061** (2026-09-23): Bump github.com/onsi/ginkgo/v2 from 2.32.2 to 2.33.0 (@dependabot[bot])
- **PR #2058** (2026-09-16): Bump github.com/onsi/ginkgo/v2 from 2.32.1 to 2.32.2 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
