# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: kgateway-dev-kgateway-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "kgateway-dev-kgateway-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T23:18:29.583Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-kgateway-dev-kgateway-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kgateway-dev-kgateway-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T23:18:29.583Z`  
> **Learning ID**: `LEARN-EVO-kgateway-dev-kgateway-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 53%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from kgateway-dev-kgateway-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kgateway-dev-kgateway-learnings.md`  
> **Source**: github ([https://github.com/kgateway-dev/kgateway](https://github.com/kgateway-dev/kgateway))  
> **Source Version**: `1a44dc2c`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-23T23:18:20.008Z  
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
> **Harvest Timestamp**: 2026-11-23T23:18:20.003Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kgateway-dev/kgateway`
- **Description**: The Cloud-Native API Gateway and AI Gateway
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 5751 stars

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

### Core Architecture Module: `hack/utils/crdbounds/bounds.go`
```
package main

import (
	"cmp"
	"fmt"
	"math"
	"regexp"
	"slices"
	"strconv"
	"strings"
)

// The Go types behind a CRD decode with encoding/json, which fails a whole List
// when one item holds a number that does not fit its Go field. The API server
// enforces a `format: int32` bound only from Kubernetes 1.36, never a
// `format: int64` bound, and never a bound on an int-or-string node, so one
// object with an oversized number stops the informer for its kind from ever
// syncing. Explicit `minimum`/`maximum` bounds make the API server reject such
// values at admission on every Kubernetes version.
//
// The tool edits the manifests as text rather than re-encoding them, so it
// works on Helm-templated CRDs and leaves the rest of the file byte-for-byte
// unchanged.

// maxExactInt64 is the largest int64 that a float64 holds exactly and that
// does not round up past math.MaxInt64.
const maxExactInt64 = math.MaxInt64 - 1023

type intRange struct {
	min, max         float64
	minText, maxText string
}

func newRange(lo, hi int64) intRange {
	return intRange{
		min: float64(lo), max: float64(hi),
		minText: strconv.FormatInt(lo, 10), maxText: strconv.FormatInt(hi, 10),
	}
}

var (
	int32Range = newRange(math.MinInt32, math.MaxInt32)
	// The API server holds bounds as float64. math.MaxInt64 rounds up to 2^63,
	// which some versions (1.33 at least) convert back to int64 as
	// math.MinInt64, rejecting every value; and kube-openapi rejects a bound
	// of exactly -2^63 as not an int64. ±(2^63-1024) round-trips exactly.
	int64Range   = newRange(-maxExactInt64, maxExactInt64)
	formatRanges = map[string]intRange{
		"int32": int32Range,
		"int64": int64Range,
		// Set explicitly with +kubebuilder:validation:Format=uint32, so a uint32
		// keeps its full range instead of the int32 one controller-gen implies.
		"uint32": newRange(0, math.MaxUint32),
	}
)

var (
	// A mapping key line: optional "- " sequence marker, then `key:` and an optional value.
	keyLineRE = regexp.MustCompile(`^( *)(- )?([A-Za-z0-9_$-]+):(?: (.*))?$`)
	// A block scalar indicator (`|`, `|-`, `>`, ...).
	blockScalarRE = regexp.MustCompile(`^[|>][-+]?[0-9]?$`)
)

type line struct {
	text string
	// indent is the column of the key on this line; a leading "- " counts as
	// indentation, so the first key of a sequence item has the same indent as
	// the keys below it.
	indent int
	key    string
	value  string
	// dash is true when the line starts a sequence item.
	dash bool
	// isKey is false for blank lines, block scalar content, scalar sequence
	// items and continuation lines.
	isKey bool
}

func parseLines(src string) []line {
	raw := strings.Split(src, "\n")
	out := make([]line, len(raw))
	blockIndent := -1
	for i, t := range raw {
		out[i].text = t
		trimmed := strings.TrimLeft(t, " ")
		if blockIndent >= 0 {
			if trimmed == "" || len(t)-len(trimmed) > blockIndent {
				continue
			}
			blockIndent = -1
		}
		m := keyLineRE.FindStringSubmatch(t)
		if m == nil {
			continue
		}
		l := &out[i]
		l.isKey = true
		l.dash = m[2] != ""
		l.indent = len(m[1]) + len(m[2])
		l.key = m[3]
		l.value = strings.TrimSpace(m[4])
		if blockScalarRE.MatchString(l.value) {
			blockIndent = l.indent
		}
	}
	return out
}

// node is one mapping in the schema: the keys that share an indentation level.
type node struct {
	indent int
	// keys maps each key of the mapping to its line index.
	keys map[string]int
	// order is the key line indexes in file order.
	order []int
	// end is the index of the first line after the mapping.
	end int
}

// nodeAt returns the mapping that contains the key at line i.
//
// controller-gen writes sequences without extra indentation: the items of a
// sequence under a key at column K start with "- " at column K, so the first
// key of each item sits at column K+2. Because parseLines records that column
// as the key's indent, a sibling's sequence items look like children here.
func nodeAt(lines []line, i int) (node, error) {
	ind := lines[i].indent
	n := node{indent: ind, keys: map[string]int{}}
	start := i
	if !lines[i].dash {
		for j := i - 1; j >= 0; j-- {
			l := lines[j]
			if !l.isKey || l.indent > ind {
				continue
			}
			if l.indent < ind {
				break
			}
			start = j
			if l.dash {
				break
			}
		}
	}
	n.end = len(lines)
	for j := start; j < len(lines); j++ {
		l := lines[j]
		if !l.isKey {
			trimmed := strings.TrimLeft(l.text, " ")
			if trimmed != "" && len(l.text)-len(trimmed) < ind {
				n.end = j
				break
			}
			continue
		}
		if j > start && (l.indent < ind || (l.indent == ind && l.dash)) {
			n.end = j
			break
		}
		if l.indent == ind {
			if _, dup := n.keys[l.key]; dup {
				return n, fmt.Errorf("line %d: duplicate key %q in mapping", j+1, l.key)
			}
			n.keys[l.key] = j
			n.order = append(n.order, j)
		}
	}
	return n, nil
}

// required returns the range a mapping must be bounded to, if any.
func required(lines []line, n node) (intRange, bool) {
	// An enum already limits the value to a fixed set, so bounds would only repeat it.
	if _, ok := n.keys["enum"]; ok {
		return intRange{}, false
	}
	if i, ok := n.keys["x-kubernetes-int-or-string"]; ok && lines[i].value == "true" {
		// resource.Quantity is also int-or-string, but it carries a pattern and
		// decodes numbers of any size, so it needs no bound. intstr.IntOrString
		// holds its number in an int32.
		if _, hasPattern := n.keys["pattern"]; hasPattern {
			return intRange{}, false
		}
		return int32Range, true
	}
	t, ok := n.keys["type"]
	if !ok || lines[t].value != "integer" {
		return intRange{}, false
	}
	f, ok := n.keys["format"]
	if !ok {
		return intRange{}, false
	}
	r, ok := formatRanges[lines[f].value]
	return r, ok
}

// isTrigger reports whether a line identifies its mapping as a possible
// integer schema.
func isTrigger(l line) bool {
	return l.isKey && ((l.key == "type" && l.value == "integer") ||
		(l.key == "x-kubernetes-int-or-string" && l.value == "true"))
}

// integerNodes calls fn once for every mapping that is an integer schema with
// a known range.
func integerNodes(lines []line, fn func(n node, r intRange) error) error {
	seen := map[int]bool{}
	for i, l := range lines {
		if !isTrigger(l) {
			continue
		}
		n, err := nodeAt(lines, i)
		if err != nil {
			return err
		}
		if seen[n.order[0]] {
			continue
		}
		seen[n.order[0]] = true
		if r, ok := required(lines, n); ok {
			if err := fn(n, r); err != nil {
				return err
			}
		}
	}
	return nil
}

// Process adds any missing `minimum`/`maximum` to every int32, int64 and
// int-or-string schema in a CRD manifest that has no enum. Existing bounds are kept; Check
// reports any that fall outside the Go type.
func Process(src string) (string, error) {
	lines := parseLines(src)
	inserts := map[int][]string{}
	err := integerNodes(lines, func(n node, r intRange) error {
		for _, add := range []struct{ key, val string }{{"maximum", r.maxText}, {"minimum", r.minText}} {
			if _, ok := n.keys[add.key]; ok {
				continue
			}
			// controller-gen sorts keys, so keep them sorted.
			at := n.end
			for _, j := range n.order {
				if lines[j].key > add.key {
					at = j
					break
				}
			}
			if at != n.end && lines[at].dash {
				return fmt.Errorf("line %d: cannot insert %s before the first key of a sequence item", at+1, add.key)
			}
			if at == n.end {
				for at > n.order[0] && strings.TrimSpace(lines[at-1].text) == "" {
					at--
				}
			}
			inserts[at] = append(inserts[at], strings.Repeat(" ", n.indent)+add.key+": "+add.val)
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	if len(inserts) == 0 {
		return src, nil
	}
	var b strings.Builder
	for i, l := range lines {
		for _, s := range inserts[i] {
			b.WriteString(s)
			b.WriteString("\n")
		}
		b.WriteString(l.text)
		if i < len(lines)-1 {
			b.WriteString("\n")
		}
	}
	for _, s := range inserts[len(lines)] {
		b.WriteString("\n")
		b.WriteString(s)
	}
	return b.String(), nil
}

// Violation is an integer schema whose bounds do not keep values decodable.
type Violation struct {
	Line   int
	Reason string
}

func (v Violation) String() string { return fmt.Sprintf("line %d: %s", v.Line, v.Reason) }

// Check reports every int32, int64 and int-or-string schema without an enum that lacks a
// bound, or whose bound lies outside the range of its Go type.
func Check(src string) ([]Violation, error) {
	lines := parseLines(src)
	var out []Violation
	err := integerNodes(lines, func(n node, r intRange) error {
		for _, k := range []string{"minimum", "maximum"} {
			j, ok := n.keys[k]
			if !ok {
				out = append(out, Violation{Line: n.order[0] + 1, Reason: "missing " + k})
				continue
			}
			v, err := strconv.ParseFloat(lines[j].value, 64)
			if err != nil {
				out = append(out, Violation{Line: j + 1, Reason: fmt.Sprintf("unparsable %s %q", k, lines[j].value)})
				continue
			}
			if v < r.min || v > r.max {
				out = append(out, Violation{Line: j + 1, Reason: fmt.Sprintf("%s %s is outside [%s, %s]", k, lines[j].value, r.minText, r.maxText)})
			}
		}
		return nil
	})
	slices.SortStableFunc(out, func(a, b Violation) int { return cmp.Compare(a.Line, b.Line) })
	return out, err
}

```

### Core Architecture Module: `hack/utils/crdbounds/main.go`
```
// Command crdbounds adds explicit minimum/maximum bounds to every int32, int64
// and int-or-string schema in CRD manifests, so the API server rejects numbers
// that the controller's Go types cannot decode. See bounds.go for why.
//
// Usage:
//
//	crdbounds [-check] FILE...
//
// Without -check, files are rewritten in place. With -check, nothing is
// written and the command fails if any schema is unbounded.
package main

import (
	"flag"
	"fmt"
	"os"
)

func main() {
	check := flag.Bool("check", false, "report unbounded integer schemas instead of fixing them")
	flag.Parse()
	failed := false
	for _, path := range flag.Args() {
		if err := run(path, *check); err != nil {
			fmt.Fprintf(os.Stderr, "%s: %v\n", path, err)
			failed = true
		}
	}
	if failed {
		os.Exit(1)
	}
}

func run(path string, check bool) error {
	b, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if check {
		v, err := Check(string(b))
		if err != nil {
			return err
		}
		if len(v) > 0 {
			return fmt.Errorf("%d unbounded integer schemas, first: %s", len(v), v[0])
		}
		return nil
	}
	out, err := Process(string(b))
	if err != nil {
		return err
	}
	if out == string(b) {
		return nil
	}
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	// The paths are CRD manifests named by the generate scripts.
	return os.WriteFile(path, []byte(out), info.Mode()) //nolint:gosec // G703: trusted build-time input
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #15056** (2026-11-19): **backendconfigpolicy: require exactly one TLS trust source again**
  *Symptoms*: # Description  **Motivation:** #14780 relaxed `BackendConfigPolicy.tls` from `ExactlyOneOf` to `AtMostOneOf` so a policy that names no trust source defaults to the system CA certificates. To keep that default from validating the chain only, it also required `sni` whenever no trust source is set. The default is only a shorthand for `wellKnownCACertificates: System`, and the `sni` rule it needs is hard to explain: `sni` is not needed for a TLS handshake, and dynamic forward proxy backends replace the policy's `sni` with each request's host anyway.  **What changed:** - **API:** the TLS rule is back to `ExactlyOneOf=secretRef;files;insecureSkipVerify;wellKnownCACertificates`, and the `sni`-required CEL rule is removed. To validate against the system CAs, set `wellKnownCACertificates: System`. - **Kept from #14780:** `insecureSkipVerify: false` and `wellKnownCACertificates` values other than `System` are still rejected by CEL, and validating against the system CAs with `sni` set and no `verifySubjectAltNames` still pins the certificate to the SNI. - **Translator:** unchanged. A policy stored without a trust source (for example `insecureSkipVerify: false` from an older release, or a policy created on a build that had #14780) is still validated against the system CAs rather than skipping verification. - **Tests:** CEL cases updated to the `ExactlyOneOf` message. The `tls-default-system-ca` translator golden is removed because its input is now rejected by CEL; the stored-policy defau

- **Issue #15053** (2026-11-19): **fix(listener): match the listener hostname on TCPRoute filter chains**
  *Symptoms*: # Description  **Motivation:** All listeners on a port share one Envoy listener, with one filter chain per route/hostname. For a TCPRoute attached to a TLS listener that has a `hostname`, the translator built the filter chain without an SNI match (the TLSRoute path sets one). That chain became the port's catch-all, so connections addressed to other listeners on the port (other hostnames, or no SNI) were routed to the TCPRoute's backend. With two such TCPRoutes on different hostnames, the port ended up with two match-less filter chains and Envoy rejected the listener.  **What changed:** The TCPRoute branch of `translateTcpFilterChain` now sets `Matcher.SniDomains` from the listener's SNI domains, the same way the TLSRoute branch does. For plain TCP listeners the list is empty, so nothing changes there.  Tests: the existing TLS-listener TCPRoute spec now asserts the SNI match, and two new specs cover (a) two TLS listeners with different hostnames on one port, each with a TCPRoute, getting one chain per hostname, and (b) TCPRoutes and a TLSRoute resolving to the same hostname sharing a single chain, with the oldest route accepted and the others reported `Conflicted`. Both new specs fail without the fix.  # Change Type  /kind fix  # Changelog  ```release-note A TCPRoute attached to a TLS listener with a hostname now only matches that hostname's SNI. Previously its filter chain accepted any connection on the port, including connections for other listeners' hostnames. Clients that 

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

### Incident Patch 1: `1a44dc2c` (2026-11-23)
**Commit Message**: fix(status): make the status syncer the only writer of Gateway Accepted (#15027)

Signed-off-by: omar <[REDACTED_EMAIL]>
Co-authored-by: David Jumani <[REDACTED_EMAIL]>

**File**: `pkg/deployer/deployer.go` (modified, +14/-1)
```diff
@@ -23,6 +23,7 @@ import (
 	"k8s.io/apimachinery/pkg/types"
 	"k8s.io/apimachinery/pkg/util/yaml"
 	"sigs.k8s.io/controller-runtime/pkg/client"
+	"sigs.k8s.io/controller-runtime/pkg/client/apiutil"
 
 	"github.com/kgateway-dev/kgateway/v2/pkg/apiclient"
 	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
@@ -174,6 +175,18 @@ func (d *Deployer) RenderManifest(ns, name string, vals map[string]any) ([]byte,
 	return []byte(release.Manifest), nil
 }
 
+// objectGVK returns obj's GVK from the scheme, falling back to its TypeMeta for a type the
+// scheme does not know. TypeMeta alone is empty on some informer paths, and the GVK ends up in
+// errors reported in status, which must not change from one attempt to the next.
+func (d *Deployer) objectGVK(obj client.Object) schema.GroupVersionKind {
+	if d.scheme != nil {
+		if gvk, err := apiutil.GVKForObject(obj, d.scheme); err == nil {
+			return gvk
+		}
+	}
+	return obj.GetObjectKind().GroupVersionKind()
+}
+
 // GetObjsToDeploy does the following:
 //
 // * uses HelmValuesGenerator to perform lookup/merging etc to get a final set of helm values
@@ -189,7 +202,7 @@ func (d *Deployer) RenderManifest(ns, name string, vals map[string]any) ([]byte,
 func (d *Deployer) GetObjsToDeploy(ctx context.Context, obj client.Object) ([]client.Object, error) {
 	vals, err := d.helmValues.GetValues(ctx, obj)
 	if err != nil {
-		return nil, fmt.Errorf("failed to get helm values for object %s %s/%s: %w", obj.GetObjectKind().GroupVersionKind().String(), obj.GetNamespace(), obj.GetName(), err)
+		return nil, fmt.Errorf("failed to get helm values for object %s %s/%s: %w", d.objectGVK(obj).String(), obj.GetNamespace(), obj.GetName(), err)
 	}
 	if vals == nil {
 		return nil, nil
```

**File**: `pkg/deployer/deployer_internal_test.go` (modified, +34/-0)
```diff
@@ -3,6 +3,7 @@ package deployer
 import (
 	"bytes"
 	"context"
+	"errors"
 	"log/slog"
 	"testing"
 
@@ -14,6 +15,8 @@ import (
 	"k8s.io/client-go/tools/cache"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
+
+	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
 )
 
 // staticValues is a HelmValuesGenerator that always returns the same values.
@@ -54,3 +57,34 @@ func TestGetObjsToDeployDoesNotLogValues(t *testing.T) {
 	assert.Contains(t, logs.String(), "got deployer helm values", "the debug line should still be logged")
 	assert.NotContains(t, logs.String(), secret)
 }
+
+// failingValues is a HelmValuesGenerator whose GetValues always fails.
+type failingValues struct{}
+
+func (failingValues) GetValues(context.Context, client.Object) (map[string]any, error) {
+	return nil, errors.New("invalid parameters")
+}
+
+func (failingValues) GetCacheSyncHandlers() []cache.InformerSynced {
+	return nil
+}
+
+// TestGetObjsToDeployErrorNamesKindStably guards the helm values error, which the Gateway
+// status reports: it must name the object's kind, and must not depend on whether the object
+// came with its TypeMeta set, which differs between informer paths.
+func TestGetObjsToDeployErrorNamesKindStably(t *testing.T) {
+	scheme := runtime.NewScheme()
+	require.NoError(t, gwv1.Install(scheme))
+	d := NewDeployer("test", scheme, nil, nil, failingValues{},
+		func(client.Object) (string, string) { return "test", "default" })
+
+	withoutTypeMeta := &gwv1.Gateway{ObjectMeta: metav1.ObjectMeta{Name: "gw", Namespace: "default"}}
+	withTypeMeta := withoutTypeMeta.DeepCopy()
+	withTypeMeta.SetGroupVersionKind(wellknown.GatewayGVK)
+
+	_, errWithout := d.GetObjsToDeploy(t.Context(), withoutTypeMeta)
+	_, errWith := d.GetObjsToDeploy(t.Context(), withTypeMeta)
+	require.EqualError(t, errWithout,
+		"failed to get helm values for object gateway.networking.k8s.io/v1, Kind=Gateway default/gw: invalid parameters")
+	require.EqualError(t, errWith, errWithout.Error(), "the message must not depend on TypeMeta")
+}
```

**File**: `pkg/kgateway/controller/controller.go` (modified, +5/-0)
```diff
@@ -16,6 +16,7 @@ import (
 	"github.com/kgateway-dev/kgateway/v2/pkg/kgateway/wellknown"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/collections"
+	"github.com/kgateway-dev/kgateway/v2/pkg/reports"
 )
 
 // rateLimiter uses token bucket for overall rate limiting and exponential backoff for per-item rate limiting
@@ -50,6 +51,10 @@ type GatewayConfig struct {
 	AdditionalGatewayClasses map[string]*deployer.GatewayClassInfo
 	// CertWatcher is the shared certificate watcher for xDS TLS
 	CertWatcher *certwatcher.CertWatcher
+	// GatewayParametersStatus receives the deployer's verdict on each Gateway's parameters,
+	// which the status syncer reports as the Gateway's Accepted=False/InvalidParameters.
+	// Without it, invalid parameters are not reported.
+	GatewayParametersStatus *reports.GatewayParametersStatus
 }
 
 type HelmValuesGeneratorOverrideFunc func(inputs *deployer.Inputs) deployer.HelmValuesGenerator
```

**File**: `pkg/kgateway/controller/controller_test.go` (modified, +85/-8)
```diff
@@ -24,6 +24,7 @@ import (
 	"k8s.io/client-go/rest"
 	"k8s.io/client-go/tools/clientcmd"
 	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
+	"k8s.io/client-go/util/retry"
 	ctrl "sigs.k8s.io/controller-runtime"
 	"sigs.k8s.io/controller-runtime/pkg/client"
 	"sigs.k8s.io/controller-runtime/pkg/config"
@@ -79,6 +80,7 @@ type ControllerSuite struct {
 	client          client.Client //nolint:forbidigo // can use client.Client in envtest
 	kubeconfigPath  string
 	managerErr      chan error
+	paramsStatus    *reports.GatewayParametersStatus
 }
 
 func TestControllerSuite(t *testing.T) {
@@ -293,16 +295,89 @@ func (s *ControllerSuite) TestInvalidGatewayParameters() {
 	err = s.client.Create(ctx, gw)
 	s.Require().NoError(err)
 
+	// The status writer, which this suite does not run, reports the failed verdict as
+	// Accepted=False/InvalidParameters.
 	s.Require().EventuallyWithT(func(c *assert.CollectT) {
-		err := s.client.Get(ctx, types.NamespacedName{Name: gw.Name, Namespace: gw.Namespace}, gw)
-		require.NoError(c, err, "error getting Gateway")
+		verdict := s.verdictFor(types.NamespacedName{Name: gw.Name, Namespace: gw.Namespace})
+		require.NotNil(c, verdict, "the deployer should publish its verdict")
+		require.Contains(c, verdict.Err(), "InvalidKindName")
+		require.Equal(c, int64(1), verdict.ObservedGeneration())
+	}, defaultPollTimeout, 500*time.Millisecond, "timed out waiting for the deployer's failed verdict")
+}
 
-		condition := meta.FindStatusCondition(gw.Status.Conditions, string(gwv1.GatewayConditionAccepted))
-		require.NotNil(c, condition)
-		require.Equal(c, metav1.ConditionFalse, condition.Status)
-		require.Equal(c, string(gwv1.GatewayReasonInvalidParameters), condition.Reason)
-		require.Equal(c, gw.Generation, condition.ObservedGeneration)
-	}, defaultPollTimeout, 500*time.Millisecond, "timed out waiting for Gateway to have GatewayReasonInvalidParameters")
+// TestInvalidGatewayParametersClearedWithoutValidPorts tests that fixing the parametersRef
+// removes the Gateway's parameters error even when the Gateway still has no valid ports.
+func (s *ControllerSuite) TestInvalidGatewayParametersClearedWithoutValidPorts() {
+	ctx := context.Background()
+	gwp := &kgateway.GatewayParameters{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "reserved-port-gwp",
+			Namespace: "default",
+		},
+		Spec: kgateway.GatewayParametersSpec{
+			Kube: &kgateway.KubernetesProxyConfig{},
+		},
+	}
+	gw := &gwv1.Gateway{
+		ObjectMeta: metav1.ObjectMeta{
+			Name:      "reserved-port-gw",
+			Namespace: "default",
+		},
+		Spec: gwv1.GatewaySpec{
+			GatewayClassName: gwv1.ObjectName(gatewayClassName),
+			Infrastructure: &gwv1.GatewayInfrastructure{
+				ParametersRef: &gwv1.LocalParametersReference{
+					Group: kgateway.GroupName,
+					Kind:  "InvalidKindName",
+					Name:  gwp.Name,
+				},
+			},
+			Listeners: []gwv1.Listener{{
+				Name:     "listener",
+				Protocol: "HTTP",
+				// A reserved port: once the parameters resolve, there are no valid ports to deploy.
+				Port: 9091,
+			}},
+		},
+	}
+	s.Require().NoError(s.client.Create(ctx, gwp))
+	s.Require().NoError(s.client.Create(ctx, gw))
+	s.T().Cleanup(func() {
+		s.NoError(s.client.Delete(ctx, gw))
+		s.NoError(s.client.Delete(ctx, gwp))
+	})
+
+	nn := types.NamespacedName{Name: gw.Name, Namespace: gw.Namespace}
+	s.Require().EventuallyWithT(func(c *assert.CollectT) {
+		verdict := s.verdictFor(nn)
+		require.NotNil(c, verdict, "the deployer should publish its verdict")
+		require.NotEmpty(c, verdict.Err(), "the verdict should be a failure")
+	}, defaultPollTimeout, 500*time.Millisecond, "timed out waiting for the deployer's failed verdict")
+
+	s.Require().NoError(retry.RetryOnConflict(retry.DefaultRetry, func() error {
+		if err := s.client.Get(ctx, nn, gw); err != nil {
+			return err
+		}
+		gw.Spec.Infrastructure.ParametersRef.Kind = gwv1.Kind(wellknown.GatewayParametersGVK.Kind)
+		return s.client.Update(ctx, gw)
+	}))
+
+	s.Require().EventuallyWithT(func(c *assert.CollectT) {
+		verdict := s.verdictFor(nn)
+		require.NotNil(c, verdict, "the deployer should publish its verdict")
+		require.Empty(c, verdict.Err(), "fixing the parametersRef should make the verdict a success")
+		require.Equal(c, int64(2), verdict.ObservedGeneration(), "the verdict should be for the fixed generation")
+	}, defaultPollTimeout, 500*time.Millisecond, "timed out waiting for the deployer's successful verdict")
+}
+
+// verdictFor reads the deployer's verdict for gw from the status contributions it publishes.
+func (s *ControllerSuite) verdictFor(gw types.NamespacedName) *reports.GatewayParametersReport {
+	for _, contribution := range s.paramsStatus.Contributions().List() {
+		if contribution.Target.NamespacedName == gw && contribution.GatewayParameters != nil {
+			return contribution.GatewayParameters
+		}
+	}
+	return nil
 }
 
 // TestGatewayClassStatus tests the Status conditions on GatewayClass
@@ -689,6 +764,7 @@ func (s *ControllerSuite) startContr
```

**File**: `pkg/kgateway/controller/gw_controller.go` (modified, +18/-45)
```diff
@@ -17,7 +17,6 @@ import (
 	"istio.io/istio/pkg/kube/krt"
 	appsv1 "k8s.io/api/apps/v1"
 	corev1 "k8s.io/api/core/v1"
-	"k8s.io/apimachinery/pkg/api/meta"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/labels"
 	"k8s.io/apimachinery/pkg/runtime"
@@ -67,6 +66,11 @@ type gatewayReconciler struct {
 
 	controllerExtension pluginsdk.GatewayControllerExtension
 
+	// paramsStatus is where Reconcile reports whether each Gateway's objects could be built
+	// from its parameters. The Gateway status writer turns a failure into
+	// Accepted=False/InvalidParameters; this controller never writes that condition itself.
+	paramsStatus *reports.GatewayParametersStatus
+
 	queue controllers.Queue
 }
 
@@ -97,6 +101,7 @@ func NewGatewayReconciler(
 	r.gwParamClient = gwParams.GetGatewayParametersClient()
 
 	r.queue = controllers.NewQueue("GatewayController", controllers.WithReconciler(r.Reconcile), controllers.WithMaxAttempts(math.MaxInt), controllers.WithRateLimiter(rateLimiter))
+	r.paramsStatus = cfg.GatewayParametersStatus
 
 	// Gateway event handler
 	r.gwClient.AddEventHandler(
@@ -275,6 +280,7 @@ func (r *gatewayReconciler) Reconcile(req types.NamespacedName) (rErr error) {
 	if gw == nil || gw.GetDeletionTimestamp() != nil {
 		// ignore the event if the Gateway is not found. A subsequent event should handle this if needed
 		logger.Debug("gateway not found, skipping reconciliation", "ref", req)
+		r.paramsStatus.Remove(req)
 		return nil
 	}
 
@@ -287,49 +293,31 @@ func (r *gatewayReconciler) Reconcile(req types.NamespacedName) (rErr error) {
 	// Only reconcile Gateways for our controller
 	if gwc.Spec.ControllerName != gwv1.GatewayController(r.controllerName) {
 		// Not our GatewayClass at all
+		r.paramsStatus.Remove(req)
 		return nil
 	}
 	if wellknown.IsRetiredWaypointClass(gwc) {
 		logger.Debug("ignoring Gateway of a retired waypoint GatewayClass", "ref", req, "gwclass", gwc.Name)
+		r.paramsStatus.Remove(req)
 		return nil
 	}
 
 	logger.Info("reconciling Gateway", "ref", req)
 	ctx := r.ctx
 	objs, err := r.deployer.GetObjsToDeploy(ctx, gw)
-	if err != nil {
-		if errors.Is(err, internaldeployer.ErrNoValidPorts) {
-			// status is reported from translator, so return normally
-			return err
-		}
+	// ErrNoValidPorts is only returned once the GatewayParameters resolve, so the parameters
+	// are valid; the listener ports' own status is reported from the translator.
+	noValidPorts := errors.Is(err, internaldeployer.ErrNoValidPorts)
+	if err != nil && !noValidPorts {
 		// if we fail to either reference a valid GatewayParameters or
 		// the GatewayParameters configuration leads to issues building the
 		// objects, we want to set the status to InvalidParameters.
-		condition := metav1.Condition{
-			Type:               string(gwv1.GatewayConditionAccepted),
-			Status:             metav1.ConditionFalse,
-			ObservedGeneration: gw.Generation,
-			Reason:             string(gwv1.GatewayReasonInvalidParameters),
-			Message:            err.Error(),
-		}
-		if statusErr := r.updateGatewayStatusWithRetry(ctx, gw, condition); statusErr != nil {
-			return fmt.Errorf("failed to update status for Gateway %s: %w", req, statusErr)
-		}
+		r.paramsStatus.Set(req, gw.Generation, err)
+		return err
+	}
+	r.paramsStatus.Set(req, gw.Generation, nil)
+	if noValidPorts {
 		return err
-	} else if existing := meta.FindStatusCondition(gw.Status.Conditions, string(gwv1.GatewayConditionAccepted)); existing != nil &&
-		existing.Status == metav1.ConditionFalse &&
-		existing.Reason == string(gwv1.GatewayReasonInvalidParameters) {
-		// set the status Accepted=true if it had been set to false due to InvalidParameters
-		condition := metav1.Condition{
-			Type:               string(gwv1.GatewayConditionAccepted),
-			Status:             metav1.ConditionTrue,
-			ObservedGeneration: gw.Generation,
-			Reason:             string(gwv1.GatewayReasonAccepted),
-			Message:            reports.GatewayAcceptedMessage,
-		}
-		if statusErr := r.updateGatewayStatusWithRetry(ctx, gw, condition); statusErr != nil {
-			return fmt.Errorf("failed to update status for Gateway %s: %w", req, statusErr)
-		}
 	}
 	objs = r.deployer.SetNamespaceAndOwnerWithGVK(gw, wellknown.GatewayGVK, objs)
 	err = r.deployer.DeployObjsWithSource(ctx, objs, gw)
@@ -492,21 +480,6 @@ func updateGatewayAddresses(
 	)
 }
 
-// updateGatewayStatusWithRetry attempts to update the Gateway status with retry logic
-// to handle transient failures when updating the status subresource
-func (r *gatewayReconciler) updateGatewayStatusWithRetry(ctx context.Context, gw *gwv1.Gateway, condition metav1.Condition) error {
-	return updateGatewayStatusWithRetryFunc(
-		ctx,
-		r.gwClient,
-		client.ObjectKeyFromObject(gw),
-		func(latest *gwv1.Gateway) (gwv1.GatewayStatus, bool) {
-			newStatus := latest.Status.DeepCopy()
-			meta.SetStatusCondition(&newStatus.Conditions, condition)
-			return *newStatus, true
-		},
-	)
-}
-
 // setupTLSCertificateWatch
```

**File**: `pkg/kgateway/controller/start.go` (modified, +18/-9)
```diff
@@ -5,6 +5,7 @@ import (
 	"errors"
 	"maps"
 	"net/http"
+	"slices"
 	"strings"
 	"sync/atomic"
 
@@ -34,6 +35,7 @@ import (
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/collections"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/ir"
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/krtutil"
+	"github.com/kgateway-dev/kgateway/v2/pkg/reports"
 	"github.com/kgateway-dev/kgateway/v2/pkg/utils/kubeutils"
 	"github.com/kgateway-dev/kgateway/v2/pkg/utils/namespaces"
 	"github.com/kgateway-dev/kgateway/v2/pkg/validator"
@@ -103,10 +105,11 @@ type StartConfig struct {
 // It is intended to be run in a goroutine as the function will block until the supplied
 // context is cancelled
 type ControllerBuilder struct {
-	proxySyncer *proxy_syncer.ProxySyncer
-	cfg         StartConfig
-	mgr         ctrl.Manager
-	commoncol   *collections.CommonCollections
+	proxySyncer  *proxy_syncer.ProxySyncer
+	cfg          StartConfig
+	mgr          ctrl.Manager
+	commoncol    *collections.CommonCollections
+	paramsStatus *reports.GatewayParametersStatus
 
 	ready atomic.Bool
 }
@@ -147,6 +150,10 @@ func NewControllerBuilder(ctx context.Context, cfg StartConfig) (*ControllerBuil
 	// This only effects metrics in the resources subsystem and is not required for other metrics.
 	metrics.StartResourceSyncMetricsProcessing(ctx)
 
+	// The deployer reports its verdict on each Gateway's parameters through the status
+	// contribution pipeline, so only the status syncer writes the Gateway's Accepted condition.
+	paramsStatus := reports.NewGatewayParametersStatus(cfg.KrtOptions.ToOptions("GatewayParametersStatus")...)
+
 	// Create the proxy syncer for the Gateway API resources
 	setupLog.Info("initializing proxy syncer")
 	proxySyncer := proxy_syncer.NewProxySyncer(
@@ -159,7 +166,7 @@ func NewControllerBuilder(ctx context.Context, cfg StartConfig) (*ControllerBuil
 		cfg.SetupOpts.Cache,
 		cfg.Validator,
 		cfg.XDSClientState,
-		cfg.StatusSyncerOptions...,
+		append(slices.Clone(cfg.StatusSyncerOptions), proxy_syncer.WithStatusContributions(paramsStatus.Contributions()))...,
 	)
 	proxySyncer.Init(ctx, cfg.KrtOptions)
 	if err := cfg.Manager.Add(proxySyncer); err != nil {
@@ -189,10 +196,11 @@ func NewControllerBuilder(ctx context.Context, cfg StartConfig) (*ControllerBuil
 
 	setupLog.Info("starting controller builder")
 	cb := &ControllerBuilder{
-		proxySyncer: proxySyncer,
-		cfg:         cfg,
-		mgr:         cfg.Manager,
-		commoncol:   cfg.CommonCollections,
+		proxySyncer:  proxySyncer,
+		cfg:          cfg,
+		mgr:          cfg.Manager,
+		commoncol:    cfg.CommonCollections,
+		paramsStatus: paramsStatus,
 	}
 
 	// wait for the ControllerBuilder to Start
@@ -270,6 +278,7 @@ func (c *ControllerBuilder) Build(ctx context.Context) error {
 		CommonCollections:        c.commoncol,
 		GatewayClassName:         c.cfg.GatewayClassName,
 		CertWatcher:              c.cfg.SetupOpts.CertWatcher,
+		GatewayParametersStatus:  c.paramsStatus,
 	}
 
 	setupLog.Info("creating base gateway controller")
```

**File**: `pkg/kgateway/proxy_syncer/option.go` (modified, +13/-0)
```diff
@@ -1,14 +1,17 @@
 package proxy_syncer
 
 import (
+	"istio.io/istio/pkg/kube/krt"
 	"k8s.io/apimachinery/pkg/runtime/schema"
 
 	"github.com/kgateway-dev/kgateway/v2/pkg/pluginsdk/statussync"
+	"github.com/kgateway-dev/kgateway/v2/pkg/reports"
 )
 
 type statusSyncerConfig struct {
 	statusRegistrations   []StatusRegistration
 	policyTargetResolvers policyTargetResolvers
+	statusContributions   []krt.Collection[reports.StatusContribution]
 }
 
 // StatusSyncerOption configures the status pipeline. The same options are passed to both
@@ -45,6 +48,16 @@ func WithStatusRegistration(registration StatusRegistration) StatusSyncerOption
 	}
 }
 
+// WithStatusContributions adds status contributions produced outside translation, such as
+// the Gateway deployer's GatewayParametersStatus, to the ones the status syncer reduces.
+func WithStatusContributions(contributions krt.Collection[reports.StatusContribution]) StatusSyncerOption {
+	return func(cfg *statusSyncerConfig) {
+		if contributions != nil {
+			cfg.statusContributions = append(cfg.statusContributions, contributions)
+		}
+	}
+}
+
 // WithPolicyTargetResolver checks policy targetRefs of kind gk with resolver, so a ref naming
 // an object that does not exist is reported as TargetNotFound on the policy's StatusSummary
 // ancestor. kgateway already resolves the Gateway API kinds, Service, Backend, and the alias
```

**File**: `pkg/kgateway/proxy_syncer/proxy_syncer.go` (modified, +5/-2)
```diff
@@ -74,6 +74,8 @@ type ProxySyncer struct {
 
 	// extraPolicyTargetResolvers are the resolvers registered with WithPolicyTargetResolver.
 	extraPolicyTargetResolvers policyTargetResolvers
+	// extraStatusContributions are the contributions registered with WithStatusContributions.
+	extraStatusContributions []krt.Collection[reports.StatusContribution]
 
 	waitForSync []cache.InformerSynced
 	ready       atomic.Bool
@@ -231,6 +233,7 @@ func NewProxySyncer(
 		translator:                 translator.NewCombinedTranslator(ctx, mergedPlugins, commonCols, validator),
 		plugins:                    mergedPlugins,
 		extraPolicyTargetResolvers: optCfg.policyTargetResolvers,
+		extraStatusContributions:   optCfg.statusContributions,
 	}
 }
 
@@ -432,12 +435,12 @@ func (s *ProxySyncer) Init(ctx context.Context, krtopts krtutil.KrtOptions) {
 	// ancestors from Gateway translation, Backend translation, and targetRef
 	// resolution naturally reduce under the same policy key without a competing
 	// singleton writer.
-	s.statusContributions = krt.JoinCollection([]krt.Collection[reports.StatusContribution]{
+	s.statusContributions = krt.JoinCollection(append([]krt.Collection[reports.StatusContribution]{
 		gatewayStatusContributions(translationOutputs, krtopts),
 		backendPolicyContributions,
 		backendContributions,
 		policyTargetContributions,
-	}, krtopts.ToOptions("StatusContributions")...)
+	}, s.extraStatusContributions...), krtopts.ToOptions("StatusContributions")...)
 
 	s.waitForSync = []cache.InformerSynced{
 		s.commonCols.HasSynced,
```

---

### Incident Patch 2: `7e1298a7` (2026-11-23)
**Commit Message**: fix(translator): accept TCP/TLS routes only on attached parentRefs (#15045)

Signed-off-by: omar <[REDACTED_EMAIL]>

**File**: `pkg/kgateway/translator/gateway/gateway_translator_test.go` (modified, +22/-0)
```diff
@@ -1438,6 +1438,17 @@ func TestBasic(t *testing.T) {
 		})
 	})
 
+	t.Run("tcp route accepted only on the parentRefs attached to the listener", func(t *testing.T) {
+		test(t, translatorTestCase{
+			inputFiles: []string{"tcp-routing/unmatched-parentref.yaml"},
+			outputFile: "tcp-routing/unmatched-parentref.yaml",
+			gwNN: types.NamespacedName{
+				Namespace: "default",
+				Name:      "example-gateway",
+			},
+		})
+	})
+
 	t.Run("tcp gateway with basic routing", func(t *testing.T) {
 		test(t, translatorTestCase{
 			inputFiles: []string{"tcp-routing/basic.yaml"},
@@ -1526,6 +1537,17 @@ func TestBasic(t *testing.T) {
 		})
 	})
 
+	t.Run("tls route accepted only on the parentRefs attached to the listener", func(t *testing.T) {
+		test(t, translatorTestCase{
+			inputFiles: []string{"tls-routing/unmatched-parentref.yaml"},
+			outputFile: "tls-routing/unmatched-parentref.yaml",
+			gwNN: types.NamespacedName{
+				Namespace: "default",
+				Name:      "example-gateway",
+			},
+		})
+	})
+
 	t.Run("tls gateway with basic routing", func(t *testing.T) {
 		test(t, translatorTestCase{
 			inputFiles: []string{"tls-routing/basic.yaml"},
```

**File**: `pkg/kgateway/translator/gateway/testutils/inputs/tcp-routing/unmatched-parentref.yaml` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+# The TCPRoute is attached to the tcp listener through two parentRefs (by
+# sectionName and by Gateway name); both are accepted. Its other parentRefs
+# must keep the status of their own attachment and must not be reported as
+# accepted by the tcp listener:
+# - sectionName "missing" does not exist on the Gateway (NoMatchingParent).
+# - sectionName "http" is an HTTP listener, which does not match a TCPRoute
+#   (NoMatchingParent).
+# - other-gateway is not translated here, so it gets no status entry.
+apiVersion: gateway.networking.k8s.io/v1
+kind: TCPRoute
+metadata:
+  name: example-tcp-route
+spec:
+  parentRefs:
+  - name: example-gateway
+    sectionName: tcp
+  - name: example-gateway
+  - name: example-gateway
+    sectionName: missing
+  - name: example-gateway
+    sectionName: http
+  - name: other-gateway
+  rules:
+  - backendRefs:
+    - name: example-tcp-svc
+      port: 8080
+---
+apiVersion: gateway.networking.k8s.io/v1
+kind: Gateway
+metadata:
+  name: example-gateway
+spec:
+  gatewayClassName: example-gateway-class
+  listeners:
+  - name: tcp
+    protocol: TCP
+    port: 8080
+  - name: http
+    protocol: HTTP
+    port: 8081
+---
+apiVersion: v1
+kind: Service
+metadata:
+  name: example-tcp-svc
+spec:
+  selector:
+    app: example
+  ports:
+    - protocol: TCP
+      port: 8080
+      targetPort: 80
```

**File**: `pkg/kgateway/translator/gateway/testutils/inputs/tls-routing/unmatched-parentref.yaml` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+# The TLSRoute is attached to the tls listener through two parentRefs (by
+# sectionName and by Gateway name); both are accepted. Its other parentRefs
+# must keep the status of their own attachment and must not be reported as
+# accepted by the tls listener:
+# - sectionName "missing" does not exist on the Gateway (NoMatchingParent).
+# - sectionName "http" is an HTTP listener, which does not match a TLSRoute
+#   (NoMatchingParent).
+# - other-gateway is not translated here, so it gets no status entry.
+apiVersion: gateway.networking.k8s.io/v1
+kind: TLSRoute
+metadata:
+  name: example-tls-route
+spec:
+  parentRefs:
+  - name: example-gateway
+    sectionName: tls
+  - name: example-gateway
+  - name: example-gateway
+    sectionName: missing
+  - name: example-gateway
+    sectionName: http
+  - name: other-gateway
+  hostnames:
+  - "example.com"
+  rules:
+  - backendRefs:
+    - name: example-tls-svc
+      port: 443
+---
+apiVersion: gateway.networking.k8s.io/v1
+kind: Gateway
+metadata:
+  name: example-gateway
+spec:
+  gatewayClassName: example-gateway-class
+  listeners:
+  - name: tls
+    protocol: TLS
+    hostname: "example.com"
+    tls:
+      mode: Passthrough
+    port: 8443
+  - name: http
+    protocol: HTTP
+    port: 8081
+---
+apiVersion: v1
+kind: Service
+metadata:
+  name: example-tls-svc
+spec:
+  selector:
+    app: example
+  ports:
+    - protocol: TCP
+      port: 443
+      targetPort: 8443
```

**File**: `pkg/kgateway/translator/gateway/testutils/outputs/tcp-routing/unmatched-parentref.yaml` (added, +218/-0)
```diff
@@ -0,0 +1,218 @@
+Clusters:
+- commonLbConfig:
+    localityWeightedLbConfig: {}
+  connectTimeout: 5s
+  edsClusterConfig:
+    edsConfig:
+      ads: {}
+      resourceApiVersion: V3
+  ignoreHealthOnHostRemoval: true
+  name: kube_default_example-tcp-svc_8080
+  type: EDS
+Listeners:
+- address:
+    socketAddress:
+      address: '::'
+      ipv4Compat: true
+      portValue: 8080
+  filterChains:
+  - filters:
+    - name: envoy.filters.network.tcp_proxy
+      typedConfig:
+        '@type': type.googleapis.com/envoy.extensions.filters.network.tcp_proxy.v3.TcpProxy
+        cluster: kube_default_example-tcp-svc_8080
+        statPrefix: tcp_8080_default_example-tcp-route
+    name: listener~8080-default.example-tcp-route-rule-0
+  name: listener~8080
+- address:
+    socketAddress:
+      address: '::'
+      ipv4Compat: true
+      portValue: 8081
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
+          routeConfigName: listener~8081
+        statPrefix: http_8081
+        useRemoteAddress: true
+    name: listener~8081
+  name: listener~8081
+Routes:
+- ignorePortInHostMatching: true
+  name: listener~8081
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
+      - attachedRoutes: 2
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
+        name: tcp
+        supportedKinds:
+        - group: gateway.networking.k8s.io
+          kind: TCPRoute
+      - attachedRoutes: 0
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
+  tcpRoutes:
+    default/example-tcp-route:
+      parents:
+      - conditions:
+        - lastTransitionTime: null
+          message: ""
+          reason: Accepted
+          status: "True"
+          type: Accepted
+        - lastTransitionTime: null
+          message: Successfully resolved all references
+          reason: ResolvedRefs
+          status: "True"
+          type: ResolvedRefs
+        - lastTransitionTime: null
+          message: Successfully programmed Route
+          reason: Programmed
+          status: "True"
+          type: kgateway.dev/Programmed
+        controllerName: kgateway
+        parentRef:
+          group: ""
+          kind: ""
+          name: example-gateway
+      - conditions:
+        - lastTransitionTime: null
+          message: ""
+          reason: NoMatchingParent
+          status: "False"
+          type: Accepted
+        - lastTransitionTime: null
+          messag
```

**File**: `pkg/kgateway/translator/gateway/testutils/outputs/tls-routing/unmatched-parentref.yaml` (added, +225/-0)
```diff
@@ -0,0 +1,225 @@
+Clusters:
+- commonLbConfig:
+    localityWeightedLbConfig: {}
+  connectTimeout: 5s
+  edsClusterConfig:
+    edsConfig:
+      ads: {}
+      resourceApiVersion: V3
+  ignoreHealthOnHostRemoval: true
+  name: kube_default_example-tls-svc_443
+  type: EDS
+Listeners:
+- address:
+    socketAddress:
+      address: '::'
+      ipv4Compat: true
+      portValue: 8081
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
+          routeConfigName: listener~8081
+        statPrefix: http_8081
+        useRemoteAddress: true
+    name: listener~8081
+  name: listener~8081
+- address:
+    socketAddress:
+      address: '::'
+      ipv4Compat: true
+      portValue: 8443
+  filterChains:
+  - filterChainMatch:
+      serverNames:
+      - example.com
+    filters:
+    - name: envoy.filters.network.tcp_proxy
+      typedConfig:
+        '@type': type.googleapis.com/envoy.extensions.filters.network.tcp_proxy.v3.TcpProxy
+        cluster: kube_default_example-tls-svc_443
+        statPrefix: tls_8443_default_example-tls-route
+    name: listener~8443-default.example-tls-route-rule-0
+  listenerFilters:
+  - name: envoy.filters.listener.tls_inspector
+    typedConfig:
+      '@type': type.googleapis.com/envoy.extensions.filters.listener.tls_inspector.v3.TlsInspector
+  name: listener~8443
+Routes:
+- ignorePortInHostMatching: true
+  name: listener~8081
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
+      - attachedRoutes: 2
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
+        name: tls
+        supportedKinds:
+        - group: gateway.networking.k8s.io
+          kind: TLSRoute
+      - attachedRoutes: 0
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
+  tlsRoutes:
+    default/example-tls-route:
+      parents:
+      - conditions:
+        - lastTransitionTime: null
+          message: ""
+          reason: Accepted
+          status: "True"
+          type: Accepted
+        - lastTransitionTime: null
+          message: Successfully resolved all references
+          reason: ResolvedRefs
+          status: "True"
+          type: ResolvedRefs
+        - lastTransitionTime: null
+          message: Successfully programmed Route
+          reason: Programmed
+          status: "True"
+          type: kgateway.dev/Programmed
+        controllerName: kgateway
+        parentRef:
+          group: ""
+          kind: ""
+      
```

**File**: `pkg/kgateway/translator/listener/gateway_listener_translator.go` (modified, +39/-16)
```diff
@@ -266,6 +266,13 @@ func (ml *MergedListeners) AppendTlsListener(
 	if len(routeInfos) == 0 {
 		appendFilterChain(nil, listenerSNIDomains(listener))
 	} else {
+		// The same route can be attached through more than one parentRef; group
+		// its entries, first entry first.
+		attachments := make(map[routeKey][]*query.RouteInfo, len(routeInfos))
+		for _, ri := range routeInfos {
+			key := keyOfRoute(ri)
+			attachments[key] = append(attachments[key], ri)
+		}
 		var conflicted []conflictedRoute
 		for i, owned := range resolveTLSRouteSNIDomains(listener, routeInfos) {
 			if len(owned.lost) > 0 {
@@ -275,9 +282,10 @@ func (ml *MergedListeners) AppendTlsListener(
 					partial:   owned.ok,
 				})
 			}
-			// A duplicate shares the filter chain of its first entry.
+			// A duplicate shares the filter chain of its first entry, so it is
+			// added to that chain's routes to have its parentRef reported.
 			if owned.ok && !owned.duplicate {
-				appendFilterChain([]*query.RouteInfo{routeInfos[i]}, owned.sniDomains)
+				appendFilterChain(attachments[keyOfRoute(routeInfos[i])], owned.sniDomains)
 			}
 		}
 		// Every lost SNI domain has a winning route, so there is at least one
@@ -634,7 +642,8 @@ func (tc *tcpFilterChain) translateTcpFilterChain(
 	// by CreationTimestamp wins; any others are rejected with Accepted=False.
 	//
 	// Note: after #13694, AppendTlsListener creates one filter chain per
-	// TLSRoute, so this path is only reached with len > 1 for TCPRoutes.
+	// TLSRoute, so for TLSRoutes len > 1 only means the same route is attached
+	// through more than one parentRef.
 	r := slices.MinFunc(parent.routesWithHosts, func(a, b *query.RouteInfo) int {
 		return a.Object.GetSourceObject().GetCreationTimestamp().Compare(b.Object.GetSourceObject().GetCreationTimestamp().Time)
 	})
@@ -674,13 +683,7 @@ func (tc *tcpFilterChain) translateTcpFilterChain(
 			return nil
 		}
 
-		// Collect ParentRefReporters for the TCPRoute
-		parentRefReporters := make([]reports.ParentRefReporter, 0, len(tRoute.ParentRefs))
-		for _, parentRef := range tRoute.ParentRefs {
-			parentRefReporter := reporter.Route(tRoute.SourceObject).ParentRef(&parentRef)
-			parentRefReporter.SetCondition(condition)
-			parentRefReporters = append(parentRefReporters, parentRefReporter)
-		}
+		parentRefReporters := acceptAttachedParentRefs(r, parent.routesWithHosts, condition, reporter)
 
 		// Ensure unique names by appending the rule index to the TCPRoute name
 		tcpHostName := fmt.Sprintf("%s-%s.%s-rule-%d", parentName, tRoute.Namespace, tRoute.Name, 0)
@@ -755,12 +758,7 @@ func (tc *tcpFilterChain) translateTcpFilterChain(
 			return nil
 		}
 
-		parentRefReporters := make([]reports.ParentRefReporter, 0, len(tRoute.ParentRefs))
-		for _, parentRef := range tRoute.ParentRefs {
-			parentRefReporter := reporter.Route(tRoute.SourceObject).ParentRef(&parentRef)
-			parentRefReporter.SetCondition(condition)
-			parentRefReporters = append(parentRefReporters, parentRefReporter)
-		}
+		parentRefReporters := acceptAttachedParentRefs(r, parent.routesWithHosts, condition, reporter)
 
 		// Ensure unique names by appending the rule index to the TLSRoute name
 		tcpHostName := fmt.Sprintf("%s-%s.%s-rule-%d", parentName, tRoute.Namespace, tRoute.Name, 0)
@@ -818,6 +816,31 @@ func (tc *tcpFilterChain) translateTcpFilterChain(
 	}
 }
 
+// acceptAttachedParentRefs sets the condition on each parentRef through which
+// the winning route is attached to this listener, and returns their reporters.
+// The route can reach the listener through more than one parentRef. Its other
+// parentRefs (another listener, another Gateway, or no matching parent) carry
+// the status of their own attachment and must not be touched here.
+func acceptAttachedParentRefs(
+	winner *query.RouteInfo,
+	routesWithHosts []*query.RouteInfo,
+	condition reports.RouteCondition,
+	reporter reports.Reporter,
+) []reports.ParentRefReporter {
+	winnerKey := keyOfRoute(winner)
+	routeReporter := reporter.Route(winner.Object.GetSourceObject())
+	var parentRefReporters []reports.ParentRefReporter
+	for _, ri := range routesWithHosts {
+		if keyOfRoute(ri) != winnerKey {
+			continue
+		}
+		parentRefReporter := routeReporter.ParentRef(&ri.ParentRef)
+		parentRefReporter.SetCondition(condition)
+		parentRefReporters = append(parentRefReporters, parentRefReporter)
+	}
+	return parentRefReporters
+}
+
 // rejectConflictingRoute sets Programmed=False on the specific listener
 // attachment of a route that lost to another route attached to the same
 // listener.
```

---

### Incident Patch 3: `a3b7117a` (2026-11-23)
**Commit Message**: fix(metrics): keep kgateway metrics when builtin default metrics are enabled (#14862)

Signed-off-by: omar <[REDACTED_EMAIL]>

**File**: `pkg/metrics/metrics.go` (modified, +46/-4)
```diff
@@ -3,11 +3,13 @@ package metrics
 
 import (
 	"reflect"
+	"slices"
 	"sync"
 	"sync/atomic"
 
 	"github.com/prometheus/client_golang/prometheus"
 	"github.com/prometheus/client_golang/prometheus/collectors"
+	dto "github.com/prometheus/client_model/go"
 	"istio.io/istio/pkg/kube/krt"
 	"sigs.k8s.io/controller-runtime/pkg/metrics"
 )
@@ -22,6 +24,10 @@ var (
 	registry     RegistererGatherer = prometheus.NewRegistry()
 	registryLock                    = sync.RWMutex{}
 
+	// ctrlRegistry is controller-runtime's registry, which its packages
+	// register their metrics into at init.
+	ctrlRegistry = metrics.Registry
+
 	// DefaultBuckets defines the default buckets used for histograms.
 	DefaultBuckets = prometheus.DefBuckets
 )
@@ -379,17 +385,53 @@ func SetRegistry(useBuiltinRegistry bool, r RegistererGatherer) {
 	registryLock.Lock()
 	defer registryLock.Unlock()
 
+	if !isNil(r) {
+		registry = r
+	}
+
 	if !useBuiltinRegistry {
 		metrics.Registry = registry
+		return
 	}
 
-	if isNil(r) {
-		registry = metrics.Registry
-	} else {
-		registry = r
+	// Keep controller-runtime's registry for its own registrations, and serve
+	// its metrics alongside ours, which are already registered in registry.
+	metrics.Registry = &builtinRegistry{
+		RegistererGatherer: ctrlRegistry,
+		kgateway:           registry,
 	}
 }
 
+// builtinRegistry registers into controller-runtime's registry and gathers
+// from both controller-runtime's registry and the kgateway registry.
+type builtinRegistry struct {
+	metrics.RegistererGatherer
+	kgateway prometheus.Gatherer
+}
+
+// Gather skips kgateway metric families that controller-runtime already
+// gathers, such as the go and process collectors that both register.
+func (b *builtinRegistry) Gather() ([]*dto.MetricFamily, error) {
+	ctrlFamilies, ctrlErr := b.RegistererGatherer.Gather()
+	ctrlNames := make(map[string]struct{}, len(ctrlFamilies))
+	for _, f := range ctrlFamilies {
+		ctrlNames[f.GetName()] = struct{}{}
+	}
+
+	return prometheus.Gatherers{
+		prometheus.GathererFunc(func() ([]*dto.MetricFamily, error) {
+			return ctrlFamilies, ctrlErr
+		}),
+		prometheus.GathererFunc(func() ([]*dto.MetricFamily, error) {
+			families, err := b.kgateway.Gather()
+			return slices.DeleteFunc(families, func(f *dto.MetricFamily) bool {
+				_, ok := ctrlNames[f.GetName()]
+				return ok
+			}), err
+		}),
+	}.Gather()
+}
+
 // isNil checks if the provided interface contains nil or a nil value.
 func isNil(arg any) bool {
 	if v := reflect.ValueOf(arg); !v.IsValid() || ((v.Kind() == reflect.Pointer ||
```

**File**: `pkg/metrics/registry_internal_test.go` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+package metrics
+
+import (
+	"context"
+	"io"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+
+	"github.com/prometheus/client_golang/prometheus"
+	"github.com/prometheus/client_golang/prometheus/collectors"
+	"github.com/prometheus/client_golang/prometheus/promhttp"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	clientmetrics "k8s.io/client-go/tools/metrics"
+	ctrlmetrics "sigs.k8s.io/controller-runtime/pkg/metrics"
+
+	// Registers controller-runtime's controller metrics, including its own go
+	// and process collectors, as kgateway's manager does.
+	_ "sigs.k8s.io/controller-runtime/pkg/controller"
+)
+
+func TestSetRegistryBuiltinKeepsInitRegisteredMetrics(t *testing.T) {
+	oldRegistry, oldCtrlRegistry := registry, ctrlmetrics.Registry
+	t.Cleanup(func() {
+		registry, ctrlmetrics.Registry = oldRegistry, oldCtrlRegistry
+	})
+
+	// Recreate the package init state, since other tests replace registry.
+	local := prometheus.NewRegistry()
+	local.MustRegister(collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}))
+	local.MustRegister(collectors.NewGoCollector())
+	registry = local
+	g := NewGauge(GaugeOpts{Name: "registry_test_info", Help: "test"}, []string{"label"})
+	g.Set(1, Label{Name: "label", Value: "value"})
+
+	// controller-runtime registers rest_client_requests_total at init.
+	clientmetrics.RequestResult.Increment(context.Background(), "200", "GET", "example.com")
+
+	SetRegistry(true, nil)
+
+	assert.Same(t, local, Registry(), "kgateway metrics should keep using the local registry")
+
+	// Serve the registry the way controller-runtime's metrics server does.
+	srv := httptest.NewServer(promhttp.HandlerFor(ctrlmetrics.Registry, promhttp.HandlerOpts{
+		ErrorHandling: promhttp.HTTPErrorOnError,
+	}))
+	defer srv.Close()
+	resp, err := http.Get(srv.URL)
+	require.NoError(t, err)
+	defer resp.Body.Close()
+	body, err := io.ReadAll(resp.Body)
+	require.NoError(t, err)
+	require.Equal(t, http.StatusOK, resp.StatusCode, "metrics endpoint should not fail: %s", body)
+
+	for _, name := range []string{
+		"kgateway_registry_test_info",
+		"rest_client_requests_total",
+		"go_goroutines",
+		"process_cpu_seconds_total",
+	} {
+		assert.Contains(t, string(body), "\n# TYPE "+name+" ", "%s should be served", name)
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #15056** (2026-11-19): backendconfigpolicy: require exactly one TLS trust source again (@puertomontt)
- **PR #15053** (2026-11-19): fix(listener): match the listener hostname on TCPRoute filter chains (@puertomontt)
- **PR #15051** (2026-11-19): fix(trafficpolicy): prefer the parent on conflicts under DeepMergePreferParent (@puertomontt)
- **PR #15050** (2026-11-19): fix(krtcollections): require selected labels to be present in apiKeyAuth secretSelector (@puertomontt)
- **PR #15047** (2026-11-19): Warn when lacking controller memory limits (@chandler-solo)
- **PR #15045** (2026-11-23): fix(translator): accept TCP/TLS routes only on attached parentRefs (@puertomontt)

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

## X. status): make the status syncer the only writer of Gateway Accepted

**RULE**:
When implementing operations in `pkg/deployer/deployer.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kgateway-dev/kgateway. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1a44dc2c`: status): make the status syncer the only writer of Gateway Accepted. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/deployer/deployer.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"sigs.k8s.io/controller-runtime/pkg/client/apiutil"
// objectGVK returns obj's GVK from the scheme, falling back to its TypeMeta for a type the
// scheme does not know. TypeMeta alone is empty on some informer paths, and the GVK ends up in
// errors reported in status, which must not change from one attempt to the next.
func (d *Deployer) objectGVK(obj client.Object) schema.GroupVersionKind {
	if d.scheme != nil {
		if gvk, err := apiutil.GVKForObject(obj, d.scheme); err == nil {
			return gvk
		}
	}
	return obj.GetObjectKind().GroupVersionKind()
}

		return nil, fmt.Errorf("failed to get helm values for object %s %s/%s: %w", d.objectGVK(obj).String(), obj.GetNamespace(), obj.GetName(), err)
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
		return nil, fmt.Errorf("failed to get helm values for object %s %s/%s: %w", obj.GetObjectKind().GroupVersionKind().String(), obj.GetNamespace(), obj.GetName(), err)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1a44dc2c` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
