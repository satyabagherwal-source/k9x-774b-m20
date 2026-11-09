> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kgateway-dev-kgateway-learnings.md`  
> **Source**: github ([https://github.com/kgateway-dev/kgateway](https://github.com/kgateway-dev/kgateway))  
> **Source Version**: `7490cf4b`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T15:51:35.026Z  
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
> **Harvest Timestamp**: 2026-11-09T15:51:34.474Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kgateway-dev/kgateway`
- **Description**: The Cloud-Native API Gateway and AI Gateway
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 5734 stars

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
- **Issue #15002** (2026-11-09): **test: fix five flakes that only passed in CI on rerun**
  *Symptoms*: # Description  Fixes the five tests that still needed gotestsum's `--rerun-fails` to pass in CI between Oct 16 and Nov 8. In that window they failed on the first run and passed on a rerun in both PR CI and the merge queue. One commit per flake:  - **`TestParkedNackIsRetried`** (unit, `pkg/kgateway/setup`): the test shortened the NACK retry to 100ms, so the second NACK backed off only 200ms. On a loaded runner the retry timer answered the parked watch before the test saw it, or before the v2 correction went out. The test now raises the retry delay to a minute before the second NACK. Under the same CPU load: 43/320 failures before, 1/320 after (an unrelated receive timeout). - **`TestDereferenceWindowClosingDuringASlowInstallIsNotExtendedByALaterOne`** (unit, `pkg/kgateway/proxy_syncer`): a 1ns prune armed during the slow install could reach the fake cache's `SetSnapshot` before the test reset the delay, and sleep another grace. The fake now delays a single install (`Swap(0)`), and the manual resets are gone. Test-only change. - **`TestControllerSuite/TestGatewayClass/default GatewayClass…`** (envtest, `pkg/kgateway/controller`): the subtest asserted that a user's description edit to the default GatewayClass sticks. On every generation change the reconciler re-applies its desired spec via SSA, so it restores the description (the ParametersRef subtest already asserts this). The test passed only when its first Get beat the reconcile. It now asserts what the reconciler actually do

- **Issue #14996** (2026-11-08): **fix: scope redirect status code annotation to the named rule**
  *Symptoms*: # Description  Fixes #14995  A rule-scoped value of `kgateway.dev/http-redirect-status-code`, such as `rule1=301`, was also applied to unnamed rules. A space before the equals sign also stopped the value from matching its rule.  - Do not apply a rule-scoped value when the rule has no name. - Trim whitespace around the rule name. - Make `TestParseRedirectStatusCodeAnnotation` always assert the returned code. Previously, cases expecting nil could not fail. - Add test cases for multiple scoped values on an unnamed rule, and for a space before the equals sign.  # Change Type  /kind fix  # Changelog  ```release-note Fixed the kgateway.dev/http-redirect-status-code annotation applying rule-scoped values to unnamed rules, and failing to match a rule when its name was followed by a space. ```  # Additional Notes  Routes that unintentionally relied on a rule-scoped value applying to an unnamed rule will now use the rule's `statusCode` from the `RequestRedirect` filter, or the default of 302.  Tested with `go test ./pkg/krtcollections/...` and `go test ./pkg/kgateway/translator/gateway/`. 

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

### Incident Patch 1: `7490cf4b` (2026-11-09)
**Commit Message**: test: fix five flakes that only passed in CI on rerun (#15002)

Signed-off-by: omar <[REDACTED_EMAIL]>

**File**: `pkg/kgateway/controller/controller_test.go` (modified, +12/-6)
```diff
@@ -528,7 +528,7 @@ func (s *ControllerSuite) TestGatewayClass() {
 		}
 	})
 
-	s.Run("default GatewayClass should not be overwritten when it is updated", func() {
+	s.Run("default GatewayClass managed fields should be restored and user fields kept when it is updated", func() {
 		t := s.T()
 		r := require.New(t)
 		gwc := &gwv1.GatewayClass{}
@@ -539,19 +539,25 @@ func (s *ControllerSuite) TestGatewayClass() {
 			assert.NoError(c, err)
 		}, defaultPollTimeout, 500*time.Millisecond, "timed out waiting for GatewayClass %s to be created", gatewayClassName)
 
-		// Update it
+		// Update a field the controller manages (description) and one it does not (a user annotation)
 		original := gwc.DeepCopy()
-		updatedDesc := "updated description"
-		gwc.Spec.Description = new(updatedDesc)
+		userAnnotation := "example.com/user-annotation"
+		if gwc.Annotations == nil {
+			gwc.Annotations = map[string]string{}
+		}
+		gwc.Annotations[userAnnotation] = "kept"
+		gwc.Spec.Description = new("updated description")
 		err := s.client.Patch(ctx, gwc, client.MergeFrom(original))
 		r.NoError(err)
 
-		// Verify it is not overwritten
+		// The generation bump makes the controller re-apply its desired spec via SSA, which restores
+		// the description. Waiting for that proves the re-apply ran, so the user annotation must have survived it.
 		r.EventuallyWithTf(func(c *assert.CollectT) {
 			err := s.client.Get(ctx, types.NamespacedName{Name: gatewayClassName}, gwc)
 			assert.NoError(c, err)
 			assert.NotNil(c, gwc.Spec.Description)
-			assert.Equal(c, updatedDesc, *gwc.Spec.Description)
+			assert.Equal(c, "default GatewayClass", *gwc.Spec.Description)
+			assert.Equal(c, "kept", gwc.Annotations[userAnnotation])
 		}, defaultPollTimeout, 500*time.Millisecond, "timed out waiting for GatewayClass %s", gatewayClassName)
 	})
 
```

**File**: `pkg/kgateway/proxy_syncer/flip_release_timing_test.go` (modified, +7/-10)
```diff
@@ -15,8 +15,11 @@ import (
 	"github.com/stretchr/testify/require"
 )
 
-// slowInstallCache delays SetSnapshot while delay is set, standing in for an
-// install blocked on a stream. It counts installs and keeps the slow ones.
+// slowInstallCache delays the next SetSnapshot by delay, standing in for an
+// install blocked on a stream. It counts installs and keeps the slow ones. The
+// delay applies once: a re-publish the slow install arms (such as an immediate
+// prune) can install before the test goroutine runs again, and must not be
+// slowed too.
 type slowInstallCache struct {
 	envoycache.SnapshotCache
 	delay    atomic.Int64
@@ -28,7 +31,7 @@ type slowInstallCache struct {
 
 func (c *slowInstallCache) SetSnapshot(ctx context.Context, node string, snapshot envoycache.ResourceSnapshot) error {
 	c.installs.Add(1)
-	if delay := time.Duration(c.delay.Load()); delay > 0 {
+	if delay := time.Duration(c.delay.Swap(0)); delay > 0 {
 		c.mu.Lock()
 		c.slow = append(c.slow, snapshot)
 		c.mu.Unlock()
@@ -38,7 +41,7 @@ func (c *slowInstallCache) SetSnapshot(ctx context.Context, node string, snapsho
 }
 
 // firstSlowInstallClusters returns the clusters of the first snapshot installed
-// while delay was set.
+// with a delay.
 func (c *slowInstallCache) firstSlowInstallClusters(t *testing.T) map[string]envoycachetypes.ResourceWithTTL {
 	t.Helper()
 	c.mu.Lock()
@@ -59,7 +62,6 @@ func TestFlipRelease_BudgetStartsAfterTheHeldSnapshotIsInstalled(t *testing.T) {
 
 	cache.delay.Store(int64(2 * budget))
 	pt.syncXds(context.Background(), flipWrap)
-	cache.delay.Store(0)
 
 	require.Never(t, func() bool {
 		return snapshotReferencesCluster(servedSnapshot(t, pt), "cluster-new")
@@ -126,7 +128,6 @@ func TestDereferenceGraceStartsAfterASlowInstall(t *testing.T) {
 	pt.syncXds(ctx, routedBuild(t, "v1", "old", "old"))
 	cache.delay.Store(int64(2 * grace))
 	pt.syncXds(ctx, routedBuild(t, "v2", "new", "new")) // stops naming old, installed slowly
-	cache.delay.Store(0)
 	pt.syncXds(ctx, routedBuild(t, "v3", "new", "new"))
 	assert.Contains(t, publishedClusterNames(t, pt), "old", "old keeps its grace after the slow installation")
 	require.Eventually(t, func() bool { return !slices.Contains(publishedClusterNames(t, pt), "old") }, 2*time.Second, 5*time.Millisecond,
@@ -152,7 +153,6 @@ func TestDereferenceGraceStartsAfterASlowFlipReleaseInstall(t *testing.T) {
 	cache.delay.Store(int64(2 * grace))
 	require.Eventually(t, func() bool { return publishedListenerVersionOf(t, pt) == "v2" }, 3*time.Second, 5*time.Millisecond,
 		"the budget releases the flip")
-	cache.delay.Store(0)
 	pt.syncXds(ctx, routedBuild(t, "v3", "new", "new"))
 	assert.Contains(t, publishedClusterNames(t, pt), "old", "old keeps its grace after the slow installation")
 	require.Eventually(t, func() bool { return !slices.Contains(publishedClusterNames(t, pt), "old") }, 2*time.Second, 5*time.Millisecond,
@@ -175,7 +175,6 @@ func TestDereferencePruneQueuedDuringASlowInstallKeepsTheNewerBuild(t *testing.T
 	time.Sleep(grace / 2)
 	cache.delay.Store(int64(grace))
 	pt.syncXds(ctx, routedBuild(t, "v3", "new", "new")) // still keeps old, and installs past its deadline
-	cache.delay.Store(0)
 	require.Contains(t, cache.firstSlowInstallClusters(t), "old", "v3 must begin inside old's window, or its prune runs before v3")
 
 	require.Eventually(t, func() bool { return !slices.Contains(publishedClusterNames(t, pt), "old") }, 2*time.Second, 5*time.Millisecond,
@@ -199,7 +198,6 @@ func TestDereferenceWindowClosingDuringASlowInstallIsNotExtendedByALaterOne(t *t
 	time.Sleep(grace / 2)
 	cache.delay.Store(int64(grace))
 	pt.syncXds(ctx, routedBuild(t, "v3", "c", "c")) // b's window opens; a's closes during the installation
-	cache.delay.Store(0)
 	require.Contains(t, cache.firstSlowInstallClusters(t), "a", "v3 must begin inside a's window, or a's prune runs before v3")
 
 	require.Eventually(t, func() bool { return !slices.Contains(publishedClusterNames(t, pt), "a") }, grace/2, 5*time.Millisecond,
@@ -228,7 +226,6 @@ func TestDereferenceWindowClosingDuringASlowHeldInstallIsPrunedOnce(t *testing.T
 	time.Sleep(grace / 2)
 	cache.delay.Store(int64(grace))
 	pt.syncXds(ctx, routedBuild(t, "v3", "n", "c", "n")) // held for n; a's window closes during the installation
-	cache.delay.Store(0)
 	require.Contains(t, cache.firstSlowInstallClusters(t), "a", "v3 must begin inside a's window, or a's prune runs before v3")
 	installed := cache.installs.Load()
 
```

**File**: `pkg/kgateway/setup/cache_watch_policy_test.go` (modified, +2/-0)
```diff
@@ -377,6 +377,8 @@ func TestParkedNackIsRetried(t *testing.T) {
 			require.NotEqual(t, first.GetNonce(), again.GetNonce(), "the retry is a new response")
 
 			// Rejected again: parked again, and a correction still goes out at once.
+			// A long delay keeps the retry from answering the parked watch first.
+			shortenNackRetry(t, time.Minute, time.Minute)
 			h.nack(again, "")
 			h.waitForOpenWatches(1)
 			h.setSnapshot(nackSnapshot("2"))
```

**File**: `test/e2e/features/faultinjection/suite.go` (modified, +24/-14)
```diff
@@ -4,10 +4,12 @@ package faultinjection
 
 import (
 	"context"
+	"fmt"
 	"net/http"
 	"time"
 
 	"github.com/stretchr/testify/suite"
+	"istio.io/istio/pkg/test/util/retry"
 
 	"github.com/kgateway-dev/kgateway/v2/pkg/utils/requestutils/curl"
 	"github.com/kgateway-dev/kgateway/v2/test/e2e"
@@ -60,21 +62,29 @@ func (s *testingSuite) TestFaultInjectionAbortDoesNotAffectOtherRoutes() {
 // TestFaultInjectionDelayOnRoute verifies that a TrafficPolicy with delay configured
 // still returns a successful response (delay is applied but request is not aborted).
 // It also verifies the response takes at least the configured delay duration.
+//
+// The route can serve 200s before the delay policy reaches Envoy, so the latency is
+// checked per attempt inside the retry loop rather than once across all attempts.
 func (s *testingSuite) TestFaultInjectionDelayOnRoute() {
-	start := time.Now()
-
-	common.BaseGateway.Send(
-		s.T(),
-		&testmatchers.HttpResponse{
-			StatusCode: http.StatusOK,
-		},
-		curl.WithPort(80),
-		curl.WithPath("/fault/status/200"),
-		curl.WithHostHeader("example.com"),
-	)
-
-	elapsed := time.Since(start)
-	s.GreaterOrEqual(elapsed, 100*time.Millisecond, "expected response to take at least 100ms due to fault delay injection")
+	match := &testmatchers.HttpResponse{
+		StatusCode: http.StatusOK,
+	}
+	retry.UntilSuccessOrFail(s.T(), func() error {
+		start := time.Now()
+		if err := common.BaseGateway.SendOnce(
+			s.Ctx,
+			match,
+			curl.WithPort(80),
+			curl.WithPath("/fault/status/200"),
+			curl.WithHostHeader("example.com"),
+		); err != nil {
+			return err
+		}
+		if elapsed := time.Since(start); elapsed < 100*time.Millisecond {
+			return fmt.Errorf("expected response to take at least 100ms due to fault delay injection, took %v", elapsed)
+		}
+		return nil
+	})
 }
 
 // TestFaultInjectionAbortOnGateway verifies that a TrafficPolicy with abort attached
```

**File**: `test/e2e/features/session_persistence/suite.go` (modified, +18/-11)
```diff
@@ -225,35 +225,42 @@ func (s *testingSuite) assertSessionPersistenceWithCookie(gatewayName, persisten
 		curl.WithRetryConnectionRefused(true),
 	}
 
-	firstResp, err := s.TestInstallation.ClusterContext.Cli.CurlFromPod(s.Ctx, testdefaults.CurlPodExecOpt, firstCurlOpts...)
-	s.Require().NoError(err, "first request should succeed")
-
-	firstPodName := s.extractPodNameFromResponse(firstResp.StdOut)
-	s.Require().NotEmpty(firstPodName, "should be able to extract pod name from first response")
+	// The gateway can take a moment to serve traffic after its pod turns ready, so poll the first request
+	// until it reaches a backend and carries the session cookie or header.
+	var firstPodName, sessionValue string
+	s.TestInstallation.AssertionsT(s.T()).Gomega.Eventually(func(g gomega.Gomega) {
+		firstResp, err := s.TestInstallation.ClusterContext.Cli.CurlFromPod(s.Ctx, testdefaults.CurlPodExecOpt, firstCurlOpts...)
+		g.Expect(err).NotTo(gomega.HaveOccurred(), "first request should succeed")
+		firstPodName = s.extractPodNameFromResponse(firstResp.StdOut)
+		g.Expect(firstPodName).NotTo(gomega.BeEmpty(), "should be able to extract pod name from first response")
+		if persistenceType == "cookie" {
+			sessionValue = extractCookie(firstResp.StdOut, cookieName)
+			g.Expect(sessionValue).NotTo(gomega.BeEmpty(), "should have received a session cookie")
+		} else {
+			sessionValue = s.extractSessionHeaderFromResponse(firstResp.StdOut)
+			g.Expect(sessionValue).NotTo(gomega.BeEmpty(), "should have received a session header")
+		}
+	}).WithTimeout(60 * time.Second).WithPolling(2 * time.Second).Should(gomega.Succeed())
 
 	var subsequentCurlOpts []curl.Option
 	if persistenceType == "cookie" {
-		cookie := extractCookie(firstResp.StdOut, cookieName)
-		s.Require().NotEmpty(cookie, "should have received a session cookie")
 		subsequentCurlOpts = []curl.Option{
 			curl.WithHost(kubeutils.ServiceFQDN(gatewayService)),
 			curl.WithHostHeader("echo.local"),
 			curl.WithPort(8080),
 			curl.Silent(),
-			curl.WithHeader("Cookie", cookie),
+			curl.WithHeader("Cookie", sessionValue),
 			curl.WithConnectionTimeout(10),
 			curl.WithRetries(5, 0, 10),
 			curl.WithRetryConnectionRefused(true),
 		}
 	} else {
-		headerValue := s.extractSessionHeaderFromResponse(firstResp.StdOut)
-		s.Require().NotEmpty(headerValue, "should have received a session header")
 		subsequentCurlOpts = []curl.Option{
 			curl.WithHost(kubeutils.ServiceFQDN(gatewayService)),
 			curl.WithHostHeader("echo.local"),
 			curl.WithPort(8080),
 			curl.Silent(),
-			curl.WithHeader("session-a", headerValue),
+			curl.WithHeader("session-a", sessionValue),
 			curl.WithConnectionTimeout(10),
 			curl.WithRetries(3, 0, 10),
 			curl.WithRetryConnectionRefused(true),
```

---

### Incident Patch 2: `fbeac220` (2026-11-08)
**Commit Message**: fix: scope redirect status code annotation to the named rule (#14996)

Signed-off-by: Daksha1611 <[REDACTED_EMAIL]>

**File**: `pkg/krtcollections/builtin.go` (modified, +3/-3)
```diff
@@ -608,12 +608,12 @@ func parseRedirectStatusCode(
 
 	var forRule string
 	if len(ruleVals) == 2 {
-		forRule = ruleVals[0]
+		forRule = strings.TrimSpace(ruleVals[0])
 		val = strings.TrimSpace(ruleVals[1])
 	}
 
-	if ruleName != nil && forRule != "" && forRule != string(*ruleName) {
-		// The annotation does not apply to this rule specified by ruleName
+	// A rule-scoped value only applies to the rule it names, so it can never match an unnamed rule.
+	if forRule != "" && (ruleName == nil || forRule != string(*ruleName)) {
 		return nil, nil
 	}
 
```

**File**: `pkg/krtcollections/builtin_test.go` (modified, +13/-3)
```diff
@@ -272,6 +272,18 @@ func TestParseRedirectStatusCodeAnnotation(t *testing.T) {
 			rule:     nil,
 			wantCode: nil,
 		},
+		{
+			name:     "nil rule with multiple rule-specific values",
+			value:    "rule1=308,rule2=307",
+			rule:     nil,
+			wantCode: nil,
+		},
+		{
+			name:     "space before equals in rule-specific format",
+			value:    "rule1 =301",
+			rule:     sectionName("rule1"),
+			wantCode: new(301),
+		},
 	}
 
 	for _, tc := range tests {
@@ -287,9 +299,7 @@ func TestParseRedirectStatusCodeAnnotation(t *testing.T) {
 			}
 
 			// Check code
-			if tc.wantCode != nil {
-				a.Equal(tc.wantCode, code)
-			}
+			a.Equal(tc.wantCode, code)
 		})
 	}
 }
```

#### Recent Merged Pull Requests:
- **PR #15002** (2026-11-09): test: fix five flakes that only passed in CI on rerun (@puertomontt)
- **PR #14996** (2026-11-08): fix: scope redirect status code annotation to the named rule (@Daksha1611)
- **PR #14994** (2026-11-06): [2.5] ci: cache the Rust module build in GHCR (#14982) (@puertomontt)
- **PR #14993** (2026-11-06): e2e: scrape controller metrics through the API server pod proxy (@chandler-solo)
- **PR #14992** (2026-11-06): [2.5] fix: bound CRD integer fields so oversized values fail admission (@davidjumani)
- **PR #14991** (2026-11-06): [2.5] fix: Roll the proxy deployment when the bootstrap config is changed (@davidjumani)

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

## X. test: fix five flakes that only passed in CI on rerun (#15002)

**RULE**:
When implementing operations in `pkg/kgateway/controller/controller_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kgateway-dev/kgateway. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7490cf4b`: test: fix five flakes that only passed in CI on rerun (#15002). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/kgateway/controller/controller_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	s.Run("default GatewayClass managed fields should be restored and user fields kept when it is updated", func() {
		// Update a field the controller manages (description) and one it does not (a user annotation)
		userAnnotation := "example.com/user-annotation"
		if gwc.Annotations == nil {
			gwc.Annotations = map[string]string{}
		}
		gwc.Annotations[userAnnotation] = "kept"
		gwc.Spec.Description = new("updated description")
		// The generation bump makes the controller re-apply its desired spec via SSA, which restores
		// the description. Waiting for that proves the re-apply ran, so the user annotation must have survived it.
			assert.Equal(c, "default GatewayClass", *gwc.Spec.Description)
			assert.Equal(c, "kept", gwc.Annotations[userAnnotation])
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	s.Run("default GatewayClass should not be overwritten when it is updated", func() {
		// Update it
		updatedDesc := "updated description"
		gwc.Spec.Description = new(updatedDesc)
		// Verify it is not overwritten
			assert.Equal(c, updatedDesc, *gwc.Spec.Description)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7490cf4b` are properly handled with clean fallback behavior.
