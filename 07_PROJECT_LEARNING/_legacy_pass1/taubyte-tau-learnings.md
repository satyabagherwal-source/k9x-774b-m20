# Forensic Learning Record (Deep Inspection): taubyte/tau

> **Canonical Artifact**: `07_PROJECT_LEARNING/taubyte-tau-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/taubyte/tau](https://github.com/taubyte/tau))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:35:23.291Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `taubyte/tau`
- **Description**: Fullstack Workspace for Humans & Machines
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 5174 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/app/app.go`
```
package app

import (
	"fmt"
	"time"

	"github.com/taubyte/tau/pkg/config"
	"github.com/urfave/cli/v2"
)

func newApp() *cli.App {
	// Try to extract version and compilation time from the build information that
	// Go embeds starting from Go 1.18 when modules are enabled. When the binary
	// is built with the default settings (buildvcs in Go 1.22), the commit hash
	// is stored under the setting key "vcs.revision" and the commit timestamp
	// under "vcs.time". If the information is not present (e.g. `go run` or an
	// older compiler), we fall back to "unknown".

	var (
		version  = Version // default value injected via ldflags, or "unknown"
		compiled time.Time
	)

	if BuildDate != "unknown" && BuildDate != "" {
		if t, err := time.Parse(time.RFC3339, BuildDate); err == nil {
			compiled = t
		}
	}

	if version == "unknown" {
		// Fallback to information embedded by the Go toolchain if ldflags were
		// not provided (e.g. during `go run`).
		if info, ok := debugInfo(); ok {
			for _, s := range info.Settings {
				switch s.Key {
				case "vcs.revision":
					version = s.Value
				case "vcs.time":
					// The value is an RFC3339 timestamp ("2024-03-01T12:34:56Z").
					if t, err := time.Parse(time.RFC3339, s.Value); err == nil {
						compiled = t
					}
				}
			}
		}
	}

	app := &cli.App{
		Version:  version,
		Compiled: compiled,
		Flags: []cli.Flag{
			&cli.PathFlag{
				Name:  "root",
				Value: config.DefaultRoot,
				Usage: "Folder where tau is installed",
			},
		},
		Commands: []*cli.Command{
			buildInfoCommand(),
			startCommand(),
			configCommand(),
			exportDataCommand(),
		},
	}

	// Custom version printer to include commit and build date
	cli.VersionPrinter = func(cCtx *cli.Context) {
		ver := Version
		if ver == "unknown" || ver == "" {
			ver = "n/a"
		}

		com := Commit
		if com == "unknown" || com == "" {
			// if not provided via ldflags, try ReadBuildInfo
			if info, ok := debugInfo(); ok {
				for _, s := range info.Settings {
					if s.Key == "vcs.revision" {
						com = s.Value
						break
					}
				}
			}
			if com == "" || com == "unknown" {
				com = "n/a"
			}
		}

		dateStr := BuildDate
		if dateStr == "unknown" || dateStr == "" {
			if !app.Compiled.IsZero() {
				dateStr = app.Compiled.Format(time.RFC3339)
			} else {
				dateStr = "n/a"
			}
		}

		fmt.Fprintf(cCtx.App.Writer, "version: %s\ncommit: %s\nbuilt at: %s\n", ver, com, dateStr)
	}

	return app
}

func Run(args ...string) error {
	err := newApp().Run(args)
	if err != nil {
		return err
	}

	return nil
}

```

### Core Architecture Module: `cli/app/config_cmd.go`
```
package app

import (
	"github.com/urfave/cli/v2"
)

func configCommand() *cli.Command {
	return &cli.Command{
		Name:        "config",
		Aliases:     []string{"cnf", "conf"},
		Description: "configuration utils",
		Subcommands: []*cli.Command{
			{
				Name:    "validate",
				Aliases: []string{"check", "ok", "ok?", "valid?"},
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:    "shape",
						Aliases: []string{"s"},
					},
					&cli.PathFlag{
						Name:    "path",
						Aliases: []string{"p"},
					},
				},
				Action: func(ctx *cli.Context) error {
					_, _, _, err := parseSourceConfig(ctx, ctx.String("shape"))
					return err
				},
			},
			{
				Name:    "show",
				Aliases: []string{"render", "display", "print"},
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:    "shape",
						Aliases: []string{"s"},
					},
					&cli.PathFlag{
						Name:    "path",
						Aliases: []string{"p"},
					},
				},
				Action: func(ctx *cli.Context) error {
					pid, cnf, _, err := parseSourceConfig(ctx, ctx.String("shape"))
					if err != nil {
						return err
					}
					return displayConfig(pid, cnf)
				},
			},
			{
				Name:  "export",
				Usage: "export a configuration bundle",
				Flags: []cli.Flag{
					&cli.BoolFlag{
						Name:  "unsafe",
						Usage: "export node private key (Only use to restore a node).",
					},
					&cli.StringFlag{
						Name:    "shape",
						Aliases: []string{"s"},
					},
					&cli.BoolFlag{
						Name:    "protect",
						Aliases: []string{"p"},
					},
				},
				Action: exportConfig,
			},
			{
				Name:    "generate",
				Aliases: []string{"gen"},
				Flags: []cli.Flag{
					&cli.StringFlag{
						Name:    "shape",
						Aliases: []string{"s"},
					},
					&cli.StringFlag{
						Name:    "services",
						Aliases: []string{"serv", "protos", "protocols", "proto"}, // TODO: "protos", "protocols", "proto" to be removed after two releases
						Usage:   "Services to enable. Use `all` to enable them all.",
					},
					&cli.StringFlag{
						Name:    "network",
						Aliases: []string{"n", "fqdn"},
					},
					&cli.IntFlag{
						Name:    "p2p-port",
						Aliases: []string{"port", "p2p"},
						Value:   4242,
					},
					&cli.StringSliceFlag{
						Name:    "ip",
						Aliases: []string{"announce"},
						Usage:   "IP address to announce.",
					},
					&cli.StringSliceFlag{
						Name: "bootstrap",
					},
					&cli.BoolFlag{
						Name:    "swarm-key",
						Aliases: []string{"swarm"},
					},
					&cli.BoolFlag{
						Name:    "dv-keys",
						Aliases: []string{"dv"},
					},
					&cli.PathFlag{
						Name:  "use",
						Usage: "use a configuration template",
					},
				},
				Action: generateSourceConfig,
			},
		},
	}
}

```

### Core Architecture Module: `cli/app/export_cmd.go`
```
package app

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path"

	"github.com/ipfs/boxo/blockservice"
	"github.com/ipfs/boxo/blockstore"
	offline "github.com/ipfs/boxo/exchange/offline"
	"github.com/ipfs/boxo/ipld/merkledag"
	unixfile "github.com/ipfs/boxo/ipld/unixfs/file"
	"github.com/ipfs/go-cid"
	ds "github.com/ipfs/go-datastore"
	helpers "github.com/taubyte/tau/p2p/helpers"
	"github.com/taubyte/tau/services/substrate/migration"
	"github.com/urfave/cli/v2"
)

// exportDataCommand inspects and exports the project data still held in a
// STOPPED node's datastore — the operator action path for namespaces the
// data migration reports but cannot move (no naming config, or bytes below
// the replica target). Read-only: it never writes to the store.
func exportDataCommand() *cli.Command {
	serviceFlag := &cli.StringFlag{
		Name:  "service",
		Value: "substrate",
		Usage: "service whose data directory to open (under the tau root)",
	}
	return &cli.Command{
		Name:  "export",
		Usage: "inspect/export project data held in a stopped node's datastore (read-only)",
		Subcommands: []*cli.Command{
			{
				Name:   "list",
				Usage:  "list data namespaces and their key/file counts",
				Flags:  []cli.Flag{serviceFlag},
				Action: withNodeStore(exportList),
			},
			{
				Name:  "dump",
				Usage: "dump one namespace's keys/values as JSON",
				Flags: []cli.Flag{
					serviceFlag,
					&cli.StringFlag{Name: "namespace", Usage: "namespace hash (see list)", Required: true},
					&cli.StringFlag{Name: "out", Usage: "output file (default: stdout)"},
				},
				Action: withNodeStore(exportDump),
			},
			{
				Name:  "file",
				Usage: "extract a file's bytes from the local blockstore",
				Flags: []cli.Flag{
					serviceFlag,
					&cli.StringFlag{Name: "cid", Usage: "file content CID (see dump)", Required: true},
					&cli.StringFlag{Name: "out", Usage: "output file", Required: true},
				},
				Action: withNodeStore(exportFile),
			},
		},
	}
}

// withNodeStore opens the service's datastore (<root>/<service>) read-side and
// hands it to the action. A running node holds the store's lock — surface that
// plainly.
func withNodeStore(fn func(*cli.Context, ds.Batching) error) cli.ActionFunc {
	return func(c *cli.Context) error {
		dataRoot := path.Join(c.Path("root"), c.String("service"))
		if _, err := os.Stat(dataRoot); err != nil {
			return fmt.Errorf("data root %q: %w", dataRoot, err)
		}
		store, err := helpers.NewDatastore(dataRoot)
		if err != nil {
			return fmt.Errorf("opening datastore at %q failed (is the node still running? it must be stopped): %w", dataRoot, err)
		}
		defer store.Close()
		return fn(c, store)
	}
}

func exportList(c *cli.Context, store ds.Batching) error {
	ctx := c.Context
	hashes, err := migration.Namespaces(ctx, store)
	if err != nil {
		return err
	}
	if len(hashes) == 0 {
		fmt.Println("no data namespaces")
		return nil
	}
	for _, h := range hashes {
		entries, err := migration.Entries(ctx, store, h)
		if err != nil {
			fmt.Printf("%s\tkeys: ?\terror: %s\n", h, err)
			continue
		}
		fmt.Printf("%s\tkeys: %d\tfiles: %d\n", h, len(entries), len(migration.FileCids(entries)))
	}
	return nil
}

type exportEntry struct {
	Key         string `json:"key"`
	ValueBase64 string `json:"value_base64"`
}

type exportDoc struct {
	Namespace string        `json:"namespace"`
	Entries   []exportEntry `json:"entries"`
	FileCids  []exportRef   `json:"file_cids,omitempty"`
}

type exportRef struct {
	Cid   string `json:"cid"`
	Local bool   `json:"local"` // root block present in this store
}

func exportDump(c *cli.Context, store ds.Batching) error {
	ctx := c.Context
	hash := c.String("namespace")
	entries, err := migration.Entries(ctx, store, hash)
	if err != nil {
		return err
	}

	doc := exportDoc{Namespace: hash, Entries: make([]exportEntry, 0, len(entries))}
	for k, v := range entries {
		doc.Entries = append(doc.Entries, exportEntry{Key: k, ValueBase64: base64.StdEncoding.EncodeToString(v)})
	}

	bs := blockstore.NewIdStore(blockstore.NewBlockstore(store))
	for _, cs := range migration.FileCids(entries) {
		ref := exportRef{Cid: cs}
		if c, err := cid.Decode(cs); err == nil {
			ref.Local, _ = bs.Has(ctx, c)
		}
		doc.FileCids = append(doc.FileCids, ref)
	}

	out := os.Stdout
	if p := c.String("out"); p != "" {
		f, err := os.Create(p)
		if err != nil {
			return err
		}
		defer f.Close()
		out = f
	}
	enc := json.NewEncoder(out)
	enc.SetIndent("", "  ")
	return enc.Encode(doc)
}

func exportFile(c *cli.Context, store ds.Batching) error {
	ctx := c.Context
	root, err := cid.Decode(c.String("cid"))
	if err != nil {
		return fmt.Errorf("bad cid: %w", err)
	}

	bs := blockstore.NewIdStore(blockstore.NewBlockstore(store))
	dag := merkledag.NewDAGService(blockservice.New(bs, offline.Exchange(bs)))
	nd, err := dag.Get(ctx, root)
	if err != nil {
		return fmt.Errorf("reading %s from the local store failed with: %w", root, err)
	}
	f, err := unixfile.NewUnixfsFile(ctx, dag, nd)
	if err != nil {
		return fmt.Errorf("interpreting %s as a file failed with: %w", root, err)
	}
	r, ok := f.(io.Reader)
	if !ok {
		return fmt.Errorf("cid is a directory, not a file")
	}

	out, err := os.Create(c.String("out"))
	if err != nil {
		return err
	}
	defer out.Close()
	n, err := io.Copy(out, r)
	if err != nil {
		return err
	}
	fmt.Printf("wrote %d bytes to %s\n", n, c.String("out"))
	return nil
}

```

### Core Architecture Module: `cli/app/export_config.go`
```
package app

import (
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"time"

	"github.com/taubyte/tau/pkg/config"
	"github.com/urfave/cli/v2"
	"gopkg.in/yaml.v3"
)

func exportConfig(ctx *cli.Context) error {
	root := ctx.Path("root")
	if root == "" {
		root = config.DefaultRoot
	}

	if !filepath.IsAbs(root) {
		return fmt.Errorf("root folder `%s` is not absolute", root)
	}

	shape := ctx.String("shape")

	configRoot := root + "/config"
	configPath := ctx.Path("path")
	if configPath == "" {
		configPath = path.Join(configRoot, shape+".yaml")
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("shape %s does not exist", shape)
	}

	host, err := os.Hostname()
	if err != nil {
		return fmt.Errorf("faile to fetch hostname with %w", err)
	}

	var version *string
	if v := ctx.String("version"); v != "" {
		version = &v
	}

	bundle := &config.Bundle{
		Origin: config.BundleOrigin{
			Shape:    shape,
			Host:     host,
			Creation: time.Now(),
			Version:  version,
		},
	}

	if err = yaml.Unmarshal(data, &(bundle.Source)); err != nil {
		return fmt.Errorf("yaml unmarshal failed with: %w", err)
	}

	pkey := bundle.Privatekey
	if !ctx.Bool("unsafe") {
		pkey = ""
	}

	skfilename := path.Join(configRoot, bundle.Swarmkey)
	skdata, err := os.ReadFile(skfilename)
	if err != nil {
		return fmt.Errorf("reading %s failed with: %w %#v", skfilename, err, bundle)
	}

	dvsfilename := path.Join(configRoot, bundle.Domains.Key.Private)
	dvsdata, err := os.ReadFile(dvsfilename)
	if err != nil {
		return fmt.Errorf("reading %s failed with: %w", dvsfilename, err)
	}

	var dvpdata []byte
	if bundle.Domains.Key.Public != "" {
		dvpfilename := path.Join(configRoot, bundle.Domains.Key.Public)
		dvpdata, err = os.ReadFile(dvpfilename)
		if err != nil {
			return fmt.Errorf("reading %s failed with: %w", dvsfilename, err)
		}
	}

	if ctx.Bool("protect") {
		bundle.Origin.Protected = true
		if passwd, err := promptPassword("Password?"); err != nil {
			return fmt.Errorf("faild to read password with %w", err)
		} else {
			if skdata, err = encrypt(skdata, passwd); err != nil {
				return fmt.Errorf("faild to encrypt swarm key with %w", err)
			}
			if dvsdata, err = encrypt(dvsdata, passwd); err != nil {
				return fmt.Errorf("faild to encrypt domain's private key key with %w", err)
			}
			if dvpdata != nil {
				if dvpdata, err = encrypt(dvpdata, passwd); err != nil {
					return fmt.Errorf("faild to encrypt domain's public key key with %w", err)
				}
			}
			if pkey != "" {
				pkdata, err := encrypt([]byte(pkey), passwd)
				if err != nil {
					return fmt.Errorf("faild to encrypt private key key with %w", err)
				}
				pkey = base64.StdEncoding.EncodeToString(pkdata)
			}
		}
	}

	bundle.Privatekey = pkey
	bundle.Swarmkey = base64.StdEncoding.EncodeToString(skdata)
	bundle.Domains.Key.Private = base64.StdEncoding.EncodeToString(dvsdata)
	bundle.Domains.Key.Public = base64.StdEncoding.EncodeToString(dvpdata)

	var out io.Writer = os.Stdout
	if ctx.Args().Present() {
		filename := ctx.Args().First()
		f, err := os.OpenFile(filename, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0460)
		if err != nil {
			return fmt.Errorf("fail to open %s with %w", filename, err)
		}
		defer f.Close()
		out = f
	}

	err = yaml.NewEncoder(out).Encode(bundle)
	if err != nil {
		return fmt.Errorf("fail to marshal configuration with %w", err)
	}

	return nil
}

```

### Core Architecture Module: `cli/app/gen_config.go`
```
package app

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/taubyte/tau/core/services/seer"
	"github.com/taubyte/tau/p2p/keypair"
	"github.com/taubyte/tau/pkg/config"
	"github.com/taubyte/tau/utils"
	"github.com/urfave/cli/v2"
	"gopkg.in/yaml.v3"

	commonSpecs "github.com/taubyte/tau/pkg/specs/common"

	"github.com/pterm/pterm"

	jwt "github.com/golang-jwt/jwt/v5"
)

// TODO: move to config as a methods

func generateSourceConfig(ctx *cli.Context) error {
	root := ctx.Path("root")
	if !filepath.IsAbs(root) {
		return fmt.Errorf("root folder `%s` is not absolute", root)
	}

	shape := ctx.String("shape")

	var (
		passwd string
		err    error

		skdata  []byte
		dvsdata []byte
		dvpdata []byte
		pkey    string
	)

	templatePath := ctx.Path("use")
	var bundle *config.Bundle
	if templatePath != "" {
		if f, err := os.Open(templatePath); err != nil {
			return fmt.Errorf("failed to read template %s with %w", templatePath, err)
		} else {
			ydec := yaml.NewDecoder(f)
			bundle = &config.Bundle{}
			err = ydec.Decode(bundle)
			f.Close()
			if err != nil {
				return fmt.Errorf("failed to parse template %s with %w", templatePath, err)
			}

			pkey = bundle.Privatekey
		}
	}

	if shape == "" && bundle != nil {
		shape = bundle.Origin.Shape
	}

	if bundle != nil && bundle.Origin.Protected {
		if passwd, err = promptPassword("Password?"); err != nil {
			return fmt.Errorf("faild to read password with %w", err)
		} else {

			if pkey != "" {
				if pkdata, err := base64.StdEncoding.DecodeString(pkey); err != nil {
					return fmt.Errorf("faild to read encrypted private key with %w", err)
				} else if pkdata, err = decrypt(pkdata, passwd); err != nil {
					return fmt.Errorf("faild to decrypt private key with %w", err)
				} else {
					pkey = string(pkdata)
				}
			}

			if skdata, err = base64.StdEncoding.DecodeString(bundle.Swarmkey); err != nil {
				return fmt.Errorf("faild to read encrypted swarm key with %w", err)
			} else if skdata, err = decrypt(skdata, passwd); err != nil {
				return fmt.Errorf("faild to encrypt swarm key with %w", err)
			}

			if dvsdata, err = base64.StdEncoding.DecodeString(bundle.Domains.Key.Private); err != nil {
				return fmt.Errorf("faild to read encrypted domain key with %w", err)
			} else if dvsdata, err = decrypt(dvsdata, passwd); err != nil {
				return fmt.Errorf("faild to encrypt domain key with %w", err)
			}

			if bundle.Domains.Key.Public != "" {
				if dvpdata, err = base64.StdEncoding.DecodeString(bundle.Domains.Key.Public); err != nil {
					return fmt.Errorf("faild to read encrypted domain public key with %w", err)
				} else if dvpdata, err = decrypt(dvpdata, passwd); err != nil {
					return fmt.Errorf("faild to encrypt domain public key with %w", err)
				}
			}
		}
	}

	nodeID, nodeKey, err := generateNodeKeyAndID(pkey)
	if err != nil {
		return err
	}

	var ports config.Ports
	ports.Main = ctx.Int("p2p-port")
	ports.Lite = ports.Main + 5
	ports.Ipfs = ports.Main + 10

	if bundle != nil && ports.Main == 4242 {
		ports.Main = bundle.Ports.Main
		if bundle.Ports.Lite != 0 {
			ports.Lite = bundle.Ports.Lite
		} else {
			ports.Lite = ports.Main + 5
		}
		if bundle.Ports.Ipfs != 0 {
			ports.Ipfs = bundle.Ports.Ipfs
		} else {
			ports.Ipfs = ports.Main + 10
		}
	}

	var announce []string
	ips := ctx.StringSlice("ip")
	if len(ips) > 0 {
		announce = make([]string, len(ips))
		for i, ip := range ips {
			announce[i] = fmt.Sprintf("/ip4/%s/tcp/%d", ip, ports.Main)
		}
	} else if bundle != nil {
		announce = bundle.P2PAnnounce
	} else {
		announce = []string{fmt.Sprintf("/ip4/127.0.0.1/tcp/%d", ports.Main)}
	}

	Services := getServices(ctx.String("services"))
	if len(Services) == 0 && bundle != nil {
		Services = bundle.Services
	}

	p2pListen := []string{fmt.Sprintf("/ip4/0.0.0.0/tcp/%d", ports.Main)}
	if bundle != nil && len(bundle.P2PListen) > 0 {
		p2pListen = bundle.P2PListen
	}

	var location *seer.Location
	if bundle != nil && bundle.Location != nil {
		location = bundle.Location
	} else {
		location, err = estimateGPSLocation()
		if err != nil {
			return fmt.Errorf("extimating GPS location failed with %w", err)
		}
	}

	peers := ctx.StringSlice("bootstrap")
	if len(peers) == 0 && bundle != nil {
		peers = bundle.Peers
	}

	fqdn := ctx.String("network")
	genfqdn := fmt.Sprintf("g.%s", ctx.String("network"))
	if len(fqdn) == 0 && bundle != nil {
		fqdn = bundle.NetworkFqdn
		genfqdn = bundle.Domains.Generated
	}

	configStruct := &config.Source{
		Privatekey:  nodeKey,
		Swarmkey:    path.Join("keys", "swarm.key"),
		Services:    Services,
		P2PListen:   p2pListen,
		P2PAnnounce: announce,
		Ports:       ports,
		Location:    location,
		Peers:       peers,
		NetworkFqdn: fqdn,
		Domains: config.Domains{
			Key: config.DVKey{
				Private: path.Join("keys", "dv_private.pem"),
				Public:  path.Join("keys", "dv_public.pem"),
			},
			Generated: genfqdn,
		},
	}

	configRoot := root + "/config"

	if err = os.MkdirAll(path.Join(configRoot, "keys"), 0750); err != nil {
		return err
	}

	if ctx.Bool("swarm-key") || len(skdata) > 0 {
		swarmkey, err := generateSwarmKey(skdata)
		if err != nil {
			return err
		}

		if err = os.WriteFile(path.Join(configRoot, "keys", "swarm.key"), []byte(swarmkey), 0640); err != nil {
			return fmt.Errorf("failed to write config file with %w", err)
		}
	}

	if ctx.Bool("dv-keys") || len(dvsdata) > 0 {
		priv, pub, err := generateDVKeys(dvsdata, dvpdata)
		if err != nil {
			return err
		}

		if err = os.WriteFile(path.Join(configRoot, "keys", "dv_private.pem"), priv, 0640); err != nil {
			return err
		}

		if err = os.WriteFile(path.Join(configRoot, "keys", "dv_public.pem"), pub, 0640); err != nil {
			return err
		}
	}

	configPath := path.Join(configRoot, shape+".yaml")
	f, err := os.Create(configPath)
	if err != nil {
		return err
	}
	defer f.Close()

	yamlEnc := yaml.NewEncoder(f)
	if err = yamlEnc.Encode(configStruct); err != nil {
		return err
	}

	pterm.Info.Println("ID:", nodeID)

	return nil
}

func getServices(s string) []string {
	if s == "all" {
		return append([]string{}, commonSpecs.Services...)
	}

	protos := make(map[string]bool)
	for _, p := range commonSpecs.Services {
		protos[p] = false
	}
	for _, p := range strings.Split(s, ",") {
		if _, ok := protos[p]; ok {
			protos[p] = true
		}
	}
	ret := make([]string, 0, len(commonSpecs.Services))
	for p, on := range protos {
		if on {
			ret = append(ret, p)
		}
	}
	return ret
}

func generateSwarmKey(data []byte) (string, error) {
	if len(data) > 0 {
		return string(data), nil
	}

	return utils.GenerateSwarmKey()
}

func generateNodeKeyAndID(pkey string) (string, string, error) {
	var (
		key     crypto.PrivKey
		keyData []byte
		err     error
	)
	if pkey == "" {
		key = keypair.New()
		keyData, err = crypto.MarshalPrivateKey(key)
		if err != nil {
			return "", "", fmt.Errorf("marshal private key failed with %w", err)
		}
	} else {
		keyData, err = base64.StdEncoding.DecodeString(pkey)
		if err != nil {
			return "", "", fmt.Errorf("decode private key failed with %w", err)
		}

		key, err = crypto.UnmarshalPrivateKey(keyData)
		if err != nil {
			return "", "", fmt.Errorf("read private key failed with %w", err)
		}
	}

	id, err := peer.IDFromPublicKey(key.GetPublic())
	if err != nil {
		return "", "", fmt.Errorf("id from private key failed with %w", err)
	}

	return id.String(), base64.StdEncoding.EncodeToString(keyData), nil
}

func generateDVKeys(private, public []byte) ([]byte, []byte, error) {
	var (
		priv *ecdsa.PrivateKey
		err  error
	)
	if len(private) > 0 {
		if len(public) > 0 {
			return private, public, nil
		}

		priv, err = jwt.ParseECPrivateKeyFromPEM(private)
		if err != nil {
			return nil, nil, fmt.Errorf("open ecdsa key failed with %w", err)
		}
	} else {
		priv, err = ecdsa
```

### Core Architecture Module: `cli/app/geoip.go`
```
//go:build !mock

package app

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"sync"

	"github.com/taubyte/tau/core/services/seer"
)

// Structs to parse responses from the APIs
type ipAPIResponse struct {
	Lat float32 `json:"lat"`
	Lon float32 `json:"lon"`
}

type freeGeoIPResponse struct {
	Latitude  float32 `json:"latitude"`
	Longitude float32 `json:"longitude"`
}

// Function to estimate GPS location
func estimateGPSLocation() (*seer.Location, error) {
	var wg sync.WaitGroup
	wg.Add(2)

	var mu sync.Mutex
	var locations []seer.Location

	// ip-api.com
	go func() {
		defer wg.Done()
		resp, err := http.Get("http://ip-api.com/json/")
		if err != nil {
			fmt.Println("Error calling ip-api.com:", err)
			return
		}
		defer resp.Body.Close()

		var ipAPIResp ipAPIResponse
		if err := json.NewDecoder(resp.Body).Decode(&ipAPIResp); err == nil {
			mu.Lock()
			locations = append(locations, seer.Location{Latitude: ipAPIResp.Lat, Longitude: ipAPIResp.Lon})
			mu.Unlock()
		}
	}()

	// freegeoip.io
	go func() {
		defer wg.Done()
		resp, err := http.Get("https://freegeoip.app/json/")
		if err != nil {
			fmt.Println("Error calling freegeoip.app:", err)
			return
		}
		defer resp.Body.Close()

		var freeGeoIPResp freeGeoIPResponse
		if err := json.NewDecoder(resp.Body).Decode(&freeGeoIPResp); err == nil {
			mu.Lock()
			locations = append(locations, seer.Location{Latitude: freeGeoIPResp.Latitude, Longitude: freeGeoIPResp.Longitude})
			mu.Unlock()
		}
	}()

	wg.Wait()

	switch len(locations) {
	case 1:
		return &locations[0], nil
	case 2:
		avg := averageLocations(locations[0], locations[1])
		return &avg, nil
	default:
		return nil, fmt.Errorf("failed to estimate GPS location")
	}
}

// Converts geographic coordinates to Cartesian (x, y, z).
func toCartesian(lat, long float32) (x, y, z float64) {
	latRad := float64(lat) * math.Pi / 180
	longRad := float64(long) * math.Pi / 180

	x = math.Cos(latRad) * math.Cos(longRad)
	y = math.Cos(latRad) * math.Sin(longRad)
	z = math.Sin(latRad)
	return
}

// Converts Cartesian coordinates (x, y, z) back to geographic (latitude, longitude).
func toGeographic(x, y, z float64) (lat, long float32) {
	lat = float32(math.Atan2(z, math.Sqrt(x*x+y*y)) * 180 / math.Pi)
	long = float32(math.Atan2(y, x) * 180 / math.Pi)
	return
}

// Averages two locations more accurately by converting to Cartesian coordinates, averaging, and converting back.
func averageLocations(loc1, loc2 seer.Location) seer.Location {
	x1, y1, z1 := toCartesian(loc1.Latitude, loc1.Longitude)
	x2, y2, z2 := toCartesian(loc2.Latitude, loc2.Longitude)

	avgX := (x1 + x2) / 2
	avgY := (y1 + y2) / 2
	avgZ := (z1 + z2) / 2

	avgLat, avgLong := toGeographic(avgX, avgY, avgZ)
	return seer.Location{Latitude: avgLat, Longitude: avgLong}
}

```

### Core Architecture Module: `cli/app/geoip_mock.go`
```
//go:build mock

package app

import (
	"github.com/taubyte/tau/core/services/seer"
)

func estimateGPSLocation() (*seer.Location, error) {
	return &seer.Location{
		Latitude:  32.78306,
		Longitude: -96.80667,
	}, nil
}

```

### Core Architecture Module: `cli/app/helpers.go`
```
package app

import (
	"strings"
)

func convertToPostfixRegex(url string) string {
	return `^[^.]+\.` + strings.Join(strings.Split(url, "."), `\.`) + "$"
}

func convertToServicesRegex(url string) string {
	return `^[^.]+\.tau\.` + strings.Join(strings.Split(url, "."), `\.`) + `$`
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #107** (2024-01-11): **Fix Tests/ Create common tests fixtures**
  *Symptoms*: Currently many tests are using outdated projects/or tokens, thus for the sake of time these projects have been skipped rather than being addressed.   Goal:  Create common test fixtures to reduce repeated code, as well as ensure that if a (non-go-package) dependency were to be outdated; tokens, project config, etc.; minimal changes would be required, and preferably no changes linked to another github repository as it becomes a time wasting hassle. 

- **Issue #92** (2023-09-18): **Fix Hoarder **
  *Symptoms*: Currently deployed hoarder protocol is not functioning as intended, apparently (I have not tested) it works locally.   I also believe that there are flaws with the p2p client, and bad code practices within the client and protocol  

- **Issue #66** (2023-08-24): **Fix Monkey Config failure logs **
  *Symptoms*: 

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

### Incident Patch 1: `a7b427bb` (2026-08-16)
**Commit Message**: fix(taucorder): drop the stale accounts stubs, let the client be extended (#512)

* fix(taucorder): drop the stale accounts stubs, let the client be extended

The accounts proto left this tree in #507; its generated TypeScript did not.
Two files stayed behind describing a service nothing here serves, in a package
that ships to npm. Nothing regenerates them — `buf generate` here produces no
change — so they were residue, not output.

Taucorder's transport and node become protected. A client built on this one
needs both to attach its own wrappers to the connection and node this class
already set up; without that it would have to open a second connection and
initialise a second node to reach the same peer.

* fix(auth): make the randomness tests check randomness at every length

Both tests generated two values and asserted they differ. Their length lists
start at 1, where that is not a check but a coin flip: one byte repeats once
every 256 draws and one character once every 62. Measured on main, the string
test fails 5 runs in 200 — 2.5% against the 1.61% the alphabet predicts.

The generators were never wrong. Both use crypto/rand.

Draws are now sampled instead of paired: 256 of the

**File**: `ee` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit b0b81710b2aec4f5a1bac19eaedab9bcbb011d6d
+Subproject commit da23b19dfd91edf4645f1c089cbfa18528186445
```

**File**: `pkg/taucorder/clients/js/gen/taucorder/v1/accounts_connect.ts` (removed, +0/-56)
```diff
@@ -1,56 +0,0 @@
-// @generated by protoc-gen-connect-es v1.4.0 with parameter "target=ts"
-// @generated from file taucorder/v1/accounts.proto (package taucorder.v1, syntax proto3)
-/* eslint-disable */
-// @ts-nocheck
-
-import { Account, AssignUserRequest, CreateAccountRequest, ListUsersRequest, User } from "./accounts_pb.js";
-import { MethodKind } from "@bufbuild/protobuf";
-import { Node } from "./common_pb.js";
-
-/**
- * AccountsService: create accounts, assign (link) git users to them, and list.
- *
- * @generated from service taucorder.v1.AccountsService
- */
-export const AccountsService = {
-  typeName: "taucorder.v1.AccountsService",
-  methods: {
-    /**
-     * @generated from rpc taucorder.v1.AccountsService.CreateAccount
-     */
-    createAccount: {
-      name: "CreateAccount",
-      I: CreateAccountRequest,
-      O: Account,
-      kind: MethodKind.Unary,
-    },
-    /**
-     * @generated from rpc taucorder.v1.AccountsService.AssignUser
-     */
-    assignUser: {
-      name: "AssignUser",
-      I: AssignUserRequest,
-      O: User,
-      kind: MethodKind.Unary,
-    },
-    /**
-     * @generated from rpc taucorder.v1.AccountsService.ListAccounts
-     */
-    listAccounts: {
-      name: "ListAccounts",
-      I: Node,
-      O: Account,
-      kind: MethodKind.ServerStreaming,
-    },
-    /**
-     * @generated from rpc taucorder.v1.AccountsService.ListUsers
-     */
-    listUsers: {
-      name: "ListUsers",
-      I: ListUsersRequest,
-      O: User,
-      kind: MethodKind.ServerStreaming,
-    },
-  }
-} as const;
-
```

**File**: `pkg/taucorder/clients/js/gen/taucorder/v1/accounts_pb.ts` (removed, +0/-310)
```diff
@@ -1,310 +0,0 @@
-// @generated by protoc-gen-es v1.4.0 with parameter "target=ts"
-// @generated from file taucorder/v1/accounts.proto (package taucorder.v1, syntax proto3)
-/* eslint-disable */
-// @ts-nocheck
-
-import type { BinaryReadOptions, FieldList, JsonReadOptions, JsonValue, PartialMessage, PlainMessage } from "@bufbuild/protobuf";
-import { Message, proto3 } from "@bufbuild/protobuf";
-import { Node } from "./common_pb.js";
-
-/**
- * Account mirrors core/services/accounts.Account.
- *
- * @generated from message taucorder.v1.Account
- */
-export class Account extends Message<Account> {
-  /**
-   * @generated from field: string id = 1;
-   */
-  id = "";
-
-  /**
-   * @generated from field: string slug = 2;
-   */
-  slug = "";
-
-  /**
-   * @generated from field: string name = 3;
-   */
-  name = "";
-
-  /**
-   * @generated from field: string kind = 4;
-   */
-  kind = "";
-
-  /**
-   * @generated from field: string status = 5;
-   */
-  status = "";
-
-  /**
-   * @generated from field: string auth_mode = 6;
-   */
-  authMode = "";
-
-  constructor(data?: PartialMessage<Account>) {
-    super();
-    proto3.util.initPartial(data, this);
-  }
-
-  static readonly runtime: typeof proto3 = proto3;
-  static readonly typeName = "taucorder.v1.Account";
-  static readonly fields: FieldList = proto3.util.newFieldList(() => [
-    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-    { no: 2, name: "slug", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-    { no: 3, name: "name", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-    { no: 4, name: "kind", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-    { no: 5, name: "status", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-    { no: 6, name: "auth_mode", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-  ]);
-
-  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): Account {
-    return new Account().fromBinary(bytes, options);
-  }
-
-  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): Account {
-    return new Account().fromJson(jsonValue, options);
-  }
-
-  static fromJsonString(jsonString: string, options?: Partial<JsonReadOptions>): Account {
-    return new Account().fromJsonString(jsonString, options);
-  }
-
-  static equals(a: Account | PlainMessage<Account> | undefined, b: Account | PlainMessage<Account> | undefined): boolean {
-    return proto3.util.equals(Account, a, b);
-  }
-}
-
-/**
- * User is a git provider account linked to an Account (the access grant).
- *
- * @generated from message taucorder.v1.User
- */
-export class User extends Message<User> {
-  /**
-   * @generated from field: string id = 1;
-   */
-  id = "";
-
-  /**
-   * @generated from field: string account_id = 2;
-   */
-  accountId = "";
-
-  /**
-   * @generated from field: string provider = 3;
-   */
-  provider = "";
-
-  /**
-   * @generated from field: string external_id = 4;
-   */
-  externalId = "";
-
-  /**
-   * @generated from field: string display_name = 5;
-   */
-  displayName = "";
-
-  constructor(data?: PartialMessage<User>) {
-    super();
-    proto3.util.initPartial(data, this);
-  }
-
-  static readonly runtime: typeof proto3 = proto3;
-  static readonly typeName = "taucorder.v1.User";
-  static readonly fields: FieldList = proto3.util.newFieldList(() => [
-    { no: 1, name: "id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-    { no: 2, name: "account_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-    { no: 3, name: "provider", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-    { no: 4, name: "external_id", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-    { no: 5, name: "display_name", kind: "scalar", T: 9 /* ScalarType.STRING */ },
-  ]);
-
-  static fromBinary(bytes: Uint8Array, options?: Partial<BinaryReadOptions>): User {
-    return new User().fromBinary(bytes, options);
-  }
-
-  static fromJson(jsonValue: JsonValue, options?: Partial<JsonReadOptions>): User
```

**File**: `pkg/taucorder/clients/js/src/Taucorder.ts` (modified, +5/-2)
```diff
@@ -62,8 +62,11 @@ class ExtendedAuth extends Auth {
 }
 
 export class Taucorder {
-  private transport: Transport;
-  private node?: Node;
+  // Reachable by subclasses so a client built on this one can attach its own
+  // service wrappers to the same transport and node, rather than opening a
+  // second connection and initialising a second node.
+  protected transport: Transport;
+  protected node?: Node;
   private config: Config;
   private nodeClient?: NodeRPCClient;
   private wrappers: {
```

**File**: `services/auth/crypto/helpers_test.go` (modified, +30/-27)
```diff
@@ -37,13 +37,14 @@ func TestGenerateRandomBytes(t *testing.T) {
 		assert.NilError(t, err)
 		assert.Equal(t, len(bytes), length)
 
-		// Generate another set to ensure randomness
-		bytes2, err := GenerateRandomBytes(length)
-		assert.NilError(t, err)
-		assert.Equal(t, len(bytes2), length)
-
-		// The bytes should be different (very unlikely to be the same)
-		assert.Assert(t, !bytesEqual(bytes, bytes2))
+		// Randomness is checked over many draws rather than by comparing one
+		// pair. A pair says nothing at small sizes — one byte repeats once
+		// every 256 draws — and sampling is correct at every size, so the
+		// short case needs no exception.
+		assert.Assert(t, distinctDraws(t, length, func() (string, error) {
+			b, err := GenerateRandomBytes(length)
+			return string(b), err
+		}) > 1, "every draw of %d byte(s) returned the same value", length)
 	}
 }
 
@@ -56,13 +57,11 @@ func TestGenerateRandomString(t *testing.T) {
 		assert.NilError(t, err)
 		assert.Equal(t, len(str), length)
 
-		// Generate another string to ensure randomness
-		str2, err := GenerateRandomString(length)
-		assert.NilError(t, err)
-		assert.Equal(t, len(str2), length)
-
-		// The strings should be different (very unlikely to be the same)
-		assert.Assert(t, str != str2)
+		// See TestGenerateRandomBytes: one character out of 62 repeats often
+		// enough that a single comparison is a coin flip, not a check.
+		assert.Assert(t, distinctDraws(t, length, func() (string, error) {
+			return GenerateRandomString(length)
+		}) > 1, "every draw of %d character(s) returned the same value", length)
 
 		// Verify all characters are valid
 		for _, char := range str {
@@ -71,6 +70,23 @@ func TestGenerateRandomString(t *testing.T) {
 	}
 }
 
+// distinctDraws counts how many distinct values draw produces over enough
+// samples that a working generator cannot return one value by chance: the
+// smallest space here is 62 symbols, and 256 draws make an all-identical run
+// impossible in practice while a stuck generator fails every time.
+func distinctDraws(t *testing.T, length int, draw func() (string, error)) int {
+	t.Helper()
+
+	seen := make(map[string]struct{})
+	for range 256 {
+		v, err := draw()
+		assert.NilError(t, err)
+		assert.Equal(t, len(v), length)
+		seen[v] = struct{}{}
+	}
+	return len(seen)
+}
+
 func TestGenerateSecretString(t *testing.T) {
 	secret, err := GenerateSecretString()
 	assert.NilError(t, err)
@@ -95,19 +111,6 @@ func TestSecretStringLength(t *testing.T) {
 	assert.Equal(t, SecretStringLength, 32)
 }
 
-// Helper functions for testing
-func bytesEqual(a, b []byte) bool {
-	if len(a) != len(b) {
-		return false
-	}
-	for i := range a {
-		if a[i] != b[i] {
-			return false
-		}
-	}
-	return true
-}
-
 func isValidRandomChar(char rune) bool {
 	const letters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
 	for _, validChar := range letters {
```

---

### Incident Patch 2: `f65f9a4f` (2026-08-08)
**Commit Message**: fix(vm): clamp attacker-controlled HTTP status codes to avoid a gateway crash (#519)

net/http's WriteHeader panics for a status code < 100 or > 999. For a
gateway-fronted substrate function, that panic runs on the gateway's
response-forwarding goroutine (p2p/streams/tunnels/http Frontend), which has no
net/http recover — so an out-of-range code crashes the shared gateway process.
It is reachable two ways: a tenant's WASM function via the event ABI, and any
peer speaking the http-tunnel protocol.

- eventHttpRetCode / eventHttpRedirect: reject a code outside 100..999 with
  errno.ErrorHttpWrite before it reaches WriteHeader / http.Redirect.
- tunnel headersOp: clamp an out-of-range wire code to 500 before WriteHeader —
  the single choke point for any code arriving over the tunnel.
- Frontend goroutine: recover a residual panic on that untrusted-frame path into
  an error instead of taking down the process (defense in depth).

Regression tests for each, verified to fail on the pre-fix code with the exact
WriteHeader panic. The default no-retcode flow and valid 100..999 codes are
unchanged (existing wazy harness still green).

**File**: `p2p/streams/tunnels/http/handler.go` (modified, +16/-1)
```diff
@@ -52,6 +52,12 @@ func Frontend(w http.ResponseWriter, r *http.Request, stream io.ReadWriter) erro
 		var exitError error
 
 		defer func() {
+			// This goroutine processes untrusted peer frames outside net/http's
+			// per-request recover, so a panic here would take down the process.
+			// Convert it to an error the caller can surface instead.
+			if rec := recover(); rec != nil {
+				exitError = fmt.Errorf("panic while forwarding http response: %v", rec)
+			}
 			done <- exitError
 		}()
 
@@ -149,7 +155,16 @@ func headersOp(w http.ResponseWriter, r io.Reader) error {
 		}
 	}
 
-	w.WriteHeader(int(obj.Code))
+	// obj.Code is attacker-controlled: a substrate forwarding a guest's return
+	// code, or any peer speaking this protocol. net/http's WriteHeader panics
+	// for a code < 100 or > 999, and this runs on the Frontend goroutine below
+	// with no net/http recover to catch it, so clamp an out-of-range code to 500
+	// rather than crash the process.
+	code := int(obj.Code)
+	if code < 100 || code > 999 {
+		code = http.StatusInternalServerError
+	}
+	w.WriteHeader(code)
 
 	return nil
 }
```

**File**: `p2p/streams/tunnels/http/status_test.go` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+package httptun
+
+import (
+	"bytes"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+
+	"github.com/fxamacker/cbor/v2"
+)
+
+func encodeHeaders(t *testing.T, code int32) []byte {
+	t.Helper()
+	b, err := cbor.Marshal(headersOpPayload{Headers: http.Header{}, Code: code})
+	if err != nil {
+		t.Fatal(err)
+	}
+	return b
+}
+
+// The response code in a headers frame is attacker-controlled (a peer, or a
+// substrate forwarding a guest's code). net/http's WriteHeader panics for a
+// code outside 100..999, and this runs on the Frontend goroutine with no
+// net/http recover — so headersOp must clamp it rather than crash the process.
+func TestHeadersOpClampsOutOfRangeCode(t *testing.T) {
+	for _, code := range []int32{0, 99, 1000, -1, 2000000} {
+		rec := httptest.NewRecorder()
+		if err := headersOp(rec, bytes.NewReader(encodeHeaders(t, code))); err != nil {
+			t.Fatalf("headersOp(code=%d) errored: %v", code, err)
+		}
+		if rec.Code != http.StatusInternalServerError {
+			t.Errorf("headersOp(code=%d) wrote status %d; want it clamped to 500", code, rec.Code)
+		}
+	}
+}
+
+func TestHeadersOpPassesValidCode(t *testing.T) {
+	rec := httptest.NewRecorder()
+	if err := headersOp(rec, bytes.NewReader(encodeHeaders(t, 404))); err != nil {
+		t.Fatalf("headersOp(404) errored: %v", err)
+	}
+	if rec.Code != http.StatusNotFound {
+		t.Fatalf("status = %d, want 404", rec.Code)
+	}
+}
```

**File**: `pkg/vm-low-orbit/event/code.go` (modified, +9/-0)
```diff
@@ -3,10 +3,19 @@ package event
 import (
 	"context"
 
+	"github.com/taubyte/go-sdk/errno"
 	common "github.com/taubyte/tau/core/vm"
 )
 
 func (f *Factory) eventHttpRetCode(ctx context.Context, module common.Module, eventId uint32, code uint32) uint32 {
+	// net/http's WriteHeader panics for a status code < 100 or > 999. For a
+	// gateway-fronted function that panic runs on the response-forwarding
+	// goroutine with no recover, so an out-of-range guest code would crash the
+	// shared gateway. Reject it here instead.
+	if code < 100 || code > 999 {
+		return uint32(errno.ErrorHttpWrite)
+	}
+
 	w, err := f.getEventWriter(eventId)
 	if err != 0 {
 		return uint32(err)
```

**File**: `pkg/vm-low-orbit/event/redirect.go` (modified, +8/-0)
```diff
@@ -4,10 +4,18 @@ import (
 	"context"
 	"net/http"
 
+	"github.com/taubyte/go-sdk/errno"
 	common "github.com/taubyte/tau/core/vm"
 )
 
 func (f *Factory) eventHttpRedirect(ctx context.Context, module common.Module, eventId uint32, urlPtr uint32, urlLen uint32, code uint32) uint32 {
+	// http.Redirect calls w.WriteHeader(code), which panics for a code < 100 or
+	// > 999 on the gateway's forwarding goroutine (see eventHttpRetCode). Reject
+	// an out-of-range code before touching the writer.
+	if code < 100 || code > 999 {
+		return uint32(errno.ErrorHttpWrite)
+	}
+
 	url, err := f.ReadString(module, urlPtr, urlLen)
 	if err != 0 {
 		return uint32(err)
```

**File**: `pkg/vm-low-orbit/event/status_test.go` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+package event
+
+import (
+	"context"
+	"net/http/httptest"
+	"testing"
+)
+
+// newHTTPEvent registers an HTTP event backed by a recording ResponseWriter.
+// httptest's WriteHeader panics on an out-of-range code (like a real server),
+// so an unclamped code reaching it fails these tests loudly.
+func newHTTPEvent() (*Factory, uint32, *httptest.ResponseRecorder) {
+	f := &Factory{events: make(map[uint32]*Event)}
+	rec := httptest.NewRecorder()
+	req := httptest.NewRequest("GET", "/", nil)
+	e := f.CreateHttpEvent(rec, req)
+	return f, e.Id, rec
+}
+
+// A guest status code outside net/http's valid 100..999 range must be rejected
+// before it reaches WriteHeader — otherwise it panics the gateway's response
+// goroutine. (module is unused by retcode; the code check runs first.)
+func TestEventHttpRetCodeRejectsOutOfRange(t *testing.T) {
+	for _, code := range []uint32{0, 99, 1000, 0xFFFFFFFF} {
+		f, id, rec := newHTTPEvent()
+		rc := f.eventHttpRetCode(context.Background(), nil, id, code)
+		if rc == 0 {
+			t.Errorf("eventHttpRetCode(code=%d) accepted an out-of-range code", code)
+		}
+		if rec.Code != 200 {
+			t.Errorf("eventHttpRetCode(code=%d) wrote status %d; the writer should be untouched", code, rec.Code)
+		}
+	}
+}
+
+func TestEventHttpRetCodeAcceptsValid(t *testing.T) {
+	f, id, rec := newHTTPEvent()
+	if rc := f.eventHttpRetCode(context.Background(), nil, id, 418); rc != 0 {
+		t.Fatalf("eventHttpRetCode(418) = errno %d, want 0", rc)
+	}
+	if rec.Code != 418 {
+		t.Fatalf("status = %d, want 418", rec.Code)
+	}
+}
+
+// http.Redirect calls WriteHeader(code) too; the code is validated before the
+// url is read, so a nil module is fine here.
+func TestEventHttpRedirectRejectsOutOfRange(t *testing.T) {
+	f, id, rec := newHTTPEvent()
+	rc := f.eventHttpRedirect(context.Background(), nil, id, 0, 0, 0)
+	if rc == 0 {
+		t.Fatalf("eventHttpRedirect(code=0) accepted an out-of-range code")
+	}
+	if rec.Code != 200 {
+		t.Fatalf("eventHttpRedirect(code=0) wrote status %d; the writer should be untouched", rec.Code)
+	}
+}
```

---

### Incident Patch 3: `a2d903e8` (2026-08-08)
**Commit Message**: fix(vm): harden WASM host-ABI boundary and read into guest memory in place (#518)

Three tenant-isolation / DoS fixes on the vm-low-orbit host functions, plus a
read-path change that also removes the unbounded-allocation vector:

- Storage content files were created at a fixed relative path
  ("tempFile"+counter) in the shared process CWD, with the counter reset per
  instance, so concurrent functions (even within one project) aliased the same
  file — a cross-tenant read/corrupt, and the files were never removed. Use
  os.CreateTemp, namespaced by project, and remove on close and factory close.

- memoryViewRead clamped its count with `size < offset+count`, which overflows
  uint32 for a large guest-supplied count and slips into an out-of-range
  data[offset:offset+count] slice. Clamp against the remaining bytes instead.

- The guest-read host functions (contentReadFile, storageReadFile,
  readHttpResponseBody, readHttpEventBody, cryptoRead) did make([]byte,
  guestLen) before any bound — a multi-GiB host allocation per call, outside
  the wasm page limit. Read directly into the guest's linear memory instead:
  Memory().Read returns an aliasing slice, so the reader fills guest mem

**File**: `pkg/vm-low-orbit/crypto/rand/rand.go` (modified, +10/-6)
```diff
@@ -15,15 +15,19 @@ func (f *Factory) cryptoRead(
 	bufLen,
 	readPtr uint32,
 ) uint32 {
-	buf := make([]byte, bufLen)
+	// Fill the guest's buffer in place. Memory().Read returns a slice aliasing
+	// guest memory, so rand.Read writes straight into it: no host allocation
+	// sized from the guest's bufLen (which rand.Read would otherwise commit page
+	// by page) and no extra copy. Read bounds-checks bufPtr/bufLen for us.
+	buf, ok := module.Memory().Read(bufPtr, bufLen)
+	if !ok {
+		return uint32(errno.ErrorAddressOutOfMemory)
+	}
+
 	n, err := rand.Read(buf)
 	if err != nil {
 		return uint32(errno.ErrorRandRead)
 	}
 
-	if err := f.WriteUint64Le(module, readPtr, uint64(n)); err != 0 {
-		return uint32(err)
-	}
-
-	return uint32(f.WriteBytes(module, bufPtr, buf))
+	return uint32(f.WriteUint64Le(module, readPtr, uint64(n)))
 }
```

**File**: `pkg/vm-low-orbit/crypto/rand/rand_test.go` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+package rand
+
+import (
+	"context"
+	"encoding/binary"
+	"runtime"
+	"testing"
+
+	"github.com/taubyte/go-sdk/errno"
+	"github.com/taubyte/tau/core/vm"
+	"github.com/taubyte/tau/pkg/vm-low-orbit/helpers"
+)
+
+// --- minimal mock: cryptoRead needs Read (an aliasing view, like wazy) and
+// WriteUint64Le. ---
+
+type mockMemory struct {
+	vm.Memory
+	buf []byte
+}
+
+// Read returns a slice aliasing the backing buffer, matching wazy's real
+// Memory.Read, so a caller that fills it writes into guest memory in place.
+func (m *mockMemory) Read(offset, count uint32) ([]byte, bool) {
+	if uint64(offset)+uint64(count) > uint64(len(m.buf)) {
+		return nil, false
+	}
+	return m.buf[offset : offset+count : offset+count], true
+}
+
+func (m *mockMemory) WriteUint64Le(offset uint32, v uint64) bool {
+	if uint64(offset)+8 > uint64(len(m.buf)) {
+		return false
+	}
+	binary.LittleEndian.PutUint64(m.buf[offset:], v)
+	return true
+}
+
+type mockModule struct {
+	vm.Module
+	mem *mockMemory
+}
+
+func (m *mockModule) Memory() vm.Memory { return m.mem }
+
+// cryptoRead is the worst allocate-on-guest-length case: make([]byte, bufLen)
+// followed by rand.Read, which touches every page and forces real RSS. A guest
+// with a tiny memory must not be able to drive a multi-GiB host allocation; the
+// cap must reject before make(). The regression signal is bytes allocated — the
+// old code returned the same errno, just after committing ~4 GiB.
+func TestCryptoReadRejectsOversizedLength(t *testing.T) {
+	f := &Factory{Methods: helpers.New(context.Background())}
+	mod := &mockModule{mem: &mockMemory{buf: make([]byte, 4096)}}
+	const hugeLen = uint32(0xFFFFFFFF)
+
+	var before, after runtime.MemStats
+	runtime.ReadMemStats(&before)
+	rc := f.cryptoRead(context.Background(), mod, 0 /*bufPtr*/, hugeLen, 8 /*readPtr*/)
+	runtime.ReadMemStats(&after)
+
+	if rc != uint32(errno.ErrorAddressOutOfMemory) {
+		t.Fatalf("cryptoRead(bufLen=%#x) = errno %d, want ErrorAddressOutOfMemory (%d)",
+			hugeLen, rc, uint32(errno.ErrorAddressOutOfMemory))
+	}
+	if delta := after.TotalAlloc - before.TotalAlloc; delta > 64<<20 {
+		t.Fatalf("cryptoRead allocated %d bytes for an oversized request; the cap did not run before make()", delta)
+	}
+}
```

**File**: `pkg/vm-low-orbit/event/body.go` (modified, +8/-8)
```diff
@@ -15,20 +15,20 @@ func (f *Factory) readHttpEventBody(ctx context.Context, module common.Module, e
 		return uint32(err)
 	}
 
-	buf := make([]byte, bufSize)
+	// Read straight into the guest's linear memory (aliasing slice): the body
+	// lands at bufPtr in place, with no host allocation and no extra copy. Read
+	// bounds-checks bufSize, rejecting an oversized request without allocating.
+	buf, ok := module.Memory().Read(bufPtr, bufSize)
+	if !ok {
+		return uint32(errno.ErrorAddressOutOfMemory)
+	}
 
 	n, err0 := r.Body.Read(buf)
 	if err0 != nil && err0 != io.EOF {
 		return uint32(errno.ErrorHttpReadBody)
 	}
 
-	err = f.WriteUint32Le(module, countPtr, uint32(n))
-	if err != 0 {
-		return uint32(err)
-	}
-
-	err = f.WriteBytes(module, bufPtr, buf)
-	if err != 0 {
+	if err = f.WriteUint32Le(module, countPtr, uint32(n)); err != 0 {
 		return uint32(err)
 	}
 
```

**File**: `pkg/vm-low-orbit/helpers/methods.go` (modified, +10/-8)
```diff
@@ -13,20 +13,22 @@ func (m *methods) Read(module common.Module,
 	bufPtr, bufSize, // reader
 	countPtr uint32, // reader size
 ) errno.Error {
-	buf := make([]byte, bufSize)
+	// Read straight into the guest's linear memory. wazy's Memory().Read returns
+	// a slice aliasing that memory, so readMethod fills it in place: no host
+	// allocation sized from the guest's bufSize and no extra buf->guest copy.
+	// Read also bounds-checks bufPtr/bufSize, so an oversized guest length is
+	// rejected here instead of driving a multi-GiB allocation.
+	buf, ok := module.Memory().Read(bufPtr, bufSize)
+	if !ok {
+		return errno.ErrorAddressOutOfMemory
+	}
 
 	n, err0 := readMethod(buf)
 	if err0 != nil && err0 != io.EOF {
 		return errno.ErrorHttpReadBody
 	}
 
-	ok := module.Memory().WriteUint32Le(countPtr, uint32(n))
-	if !ok {
-		return errno.ErrorAddressOutOfMemory
-	}
-
-	ok = module.Memory().Write(bufPtr, buf)
-	if !ok {
+	if !module.Memory().WriteUint32Le(countPtr, uint32(n)) {
 		return errno.ErrorAddressOutOfMemory
 	}
 
```

**File**: `pkg/vm-low-orbit/i2mv/memoryView/memview.go` (modified, +6/-3)
```diff
@@ -93,9 +93,12 @@ func (f *Factory) memoryViewRead(
 		return uint32(err0)
 	}
 
-	size := mv.size
-	if size < offset+count {
-		count = size - offset
+	// Clamp against the remaining bytes without computing offset+count, which
+	// overflows uint32 for a large guest-supplied count (e.g. 0xFFFFFFF8) and
+	// would slip past a `size < offset+count` check into an out-of-range
+	// data[offset:offset+count] slice. offset < mv.size here, so remaining > 0.
+	if remaining := mv.size - offset; count > remaining {
+		count = remaining
 	}
 
 	if err0 = f.WriteBytes(module, bufPtr, data[offset:offset+count]); err0 != 0 {
```

---

### Incident Patch 4: `ad5ab13e` (2026-08-07)
**Commit Message**: fix(containers): make containerd a real peer of docker, and the tests hermetic (#516)

* fix(containers): make containerd a real peer of docker, and the tests hermetic

The containerd backend could not run a build. Its logs came back unframed
while every caller demultiplexes them with stdcopy, so output decoded to
garbage; volumes were dropped on the floor, so nothing was ever mounted; and
because nothing drained the task FIFOs until Logs was called, any container
writing more than a pipe buffer — every real build — blocked forever.

Both backends now answer to one conformance suite (exit codes, log content and
framing, environment, working directory, bind mounts, large output, cleanup),
run from each backend's integration tests. Divergences that remain are the ones
the runtimes impose, and are refused loudly rather than downgraded silently:
containerd has no CNI, so bridged networking and port mappings are errors, and
it shares the host network instead; rootless containerd cannot create cgroups,
so resource limits are an error there.

containerd also now takes the image's own environment, working directory and
entrypoint, read from the config blob rather than through oci.WithImage

**File**: `.github/workflows/pre-commit.yml` (modified, +9/-16)
```diff
@@ -146,44 +146,37 @@ jobs:
   containerd-integration:
     runs-on: ubuntu-latest
     needs: pre-commit
-    services:
-      docker:
-        image: docker:19.03.12
-        options: --privileged
-        ports:
-          - 2375:2375
-        volumes:
-          - /var/lib/docker
     steps:
       - uses: actions/checkout@v3
       - uses: actions/setup-go@v4
         with:
           go-version: '1.26.0'
-      - name: Set up Docker environment
-        run: docker info
 
-      # --- Rootful: install + start system containerd ---
+      # The tests talk to this containerd directly. They used to start one
+      # inside a privileged docker container instead, which is why this job
+      # needed a docker service; it no longer does.
       - name: Install and start containerd
         run: |
           sudo apt-get update
           sudo apt-get install -y containerd.io
           sudo systemctl start containerd
           sudo chmod 666 /run/containerd/containerd.sock
 
-      # --- Rootless: install deps + subuid/subgid ---
+      # Prerequisites for the rootless path, which the backend falls back to
+      # when the system socket is not reachable.
       - name: Install rootless prerequisites
         run: |
           sudo apt-get install -y rootlesskit slirp4netns uidmap
           u="$(whoami)"
           grep -q "^${u}:" /etc/subuid || echo "${u}:100000:65536" | sudo tee -a /etc/subuid
           grep -q "^${u}:" /etc/subgid || echo "${u}:100000:65536" | sudo tee -a /etc/subgid
 
-      # Run all containerd tests (unit + integration); integration tests require -tags=containerd_integration
-      # Use runner's Docker (default socket); do not set DOCKER_HOST so NestedDocker tests can connect
+      # Unit tests and integration tests both: the unit tests need no daemon,
+      # the integration ones drive the shared conformance suite.
       - name: Run containerd tests (unit + integration)
         run: |
-          go test -tags=containerd_integration ./pkg/containers/backends/containerd \
-            -count=1 -timeout 15m -v -p 1
+          go test -tags=containerd_integration ./pkg/containers/... \
+            -count=1 -timeout 20m -v -p 1
 
   docker-integration:
     runs-on: ubuntu-latest
```

**File**: `Makefile` (modified, +16/-2)
```diff
@@ -18,7 +18,7 @@ DREAM_P ?= 4
 # it fails the package outright rather than skipping it.
 DREAM_PKGS = $(shell grep -rl --include='*_test.go' '//go:build dreaming' . | xargs grep -L '//go:build dreaming && ee' | sed 's|^\./||' | grep -vE '^(ee/|\.)' | xargs -n1 dirname | sort -u | sed 's|^|./|')
 
-.PHONY: test test-dreaming test-raft test-docker test-all bench-dreaming vm-fixtures test-cli test-cli-cover
+.PHONY: test test-dreaming test-raft test-docker test-containerd test-containers test-all bench-dreaming vm-fixtures test-cli test-cli-cover
 
 test:
 	go test $(FLAGS) ./...
@@ -57,8 +57,22 @@ test-dreaming:
 test-raft:
 	GOMEMLIMIT=$(GOMEMLIMIT) go test -tags raft_integration -p 1 -timeout 20m $(FLAGS) ./pkg/raft/...
 
+# Container backend integration suites. Both drive the same conformance suite
+# (pkg/containers/backends/conformance), which is what keeps docker and
+# containerd interchangeable. They are kept out of `test`/`test-all` because
+# they need a live runtime; the untagged tests under ./pkg/containers/... run
+# with no daemon at all.
+#
+# test-docker needs a running docker daemon.
+# test-containerd needs either a reachable /run/containerd/containerd.sock or
+# containerd + rootlesskit on PATH (plus subuid/subgid entries) for rootless.
 test-docker:
-	go test -tags docker_integration -run '_Integration$$' -p 1 $(FLAGS) ./pkg/containers/...
+	go test -tags docker_integration -run '_Integration$$' -p 1 -timeout 15m $(FLAGS) ./pkg/containers/...
+
+test-containerd:
+	go test -tags containerd_integration -run '_Integration$$' -p 1 -timeout 20m $(FLAGS) ./pkg/containers/...
+
+test-containers: test-docker test-containerd
 
 test-all: test test-dreaming test-raft
 
```

**File**: `pkg/containers/README.md` (modified, +71/-112)
```diff
@@ -1,148 +1,107 @@
-# taubyte/go-simple-container 
+# containers
 
-[![Release](https://img.shields.io/github/release/taubyte/go-simple-container.svg)](https://github.com/taubyte/tau/pkg/containers/releases)
-[![License](https://img.shields.io/github/license/taubyte/go-simple-container)](LICENSE)
-[![Go Report Card](https://goreportcard.com/badge/taubyte/go-simple-container)](https://goreportcard.com/report/taubyte/go-simple-container)
+[![License](https://img.shields.io/github/license/taubyte/tau)](../../LICENSE)
 [![GoDoc](https://godoc.org/github.com/taubyte/tau/pkg/containers?status.svg)](https://pkg.go.dev/github.com/taubyte/tau/pkg/containers)
 [![Discord](https://img.shields.io/discord/973677117722202152?color=%235865f2&label=discord)](https://tau.link/discord)
 
-An abstraction layer over the docker api client. Goal: make it simple to use containers from go.
+Runs containers from Go, over docker or containerd.
 
-## Installation 
-The import path for the package is *github.com/taubyte/tau/pkg/containers*.
+## Layout
 
-To install it, run:
-```bash 
-go get github.com/taubyte/tau/pkg/containers
-```
+| Package | What it is |
+| --- | --- |
+| `containers` | The client: images, containers, run, logs. What callers use. |
+| `core` | The `Backend` and `Image` interfaces, the config types, the backend registry. |
+| `backends/docker` | Docker backend. Can build images. |
+| `backends/containerd` | containerd backend, Linux only. Cannot build images. |
+| `backends/conformance` | The behaviour both backends are held to. |
+| `gc` | Periodic image cleanup. |
 
+`New()` picks a backend at construction: docker if its daemon answers, otherwise
+containerd. Callers do not choose.
 
 ## Usage
 
-### Basic Example
 ```go
-import (
-    ci "github.com/taubyte/tau/pkg/containers"
-    "context"
-)
-
-ctx := context.Background()
-
-// Create an new client
-client, err := ci.New()
-if err != nil{
+client, err := containers.New()
+if err != nil {
     return err
 }
 
-// Using `node` image for our container
-dockerImage := "node"
-
-// Initialize docker image with our given image name
-image, err := client.Image(ctx, dockerImage)
-if err != nil{
+image, err := client.Image(ctx, "alpine:latest")
+if err != nil {
     return err
 }
 
-// Commands we will be running
-commands := []string{"echo","Hello World!"}
-
-// Mount Volume Option 
-volume := ci.Volume("/sourcePath","/containerPath")
-
-// Add Environment Variable Option
-variable := ci.Variable("KEY","value")
-
-// Instantiate the container with commands we will run
-container, err := image.Instantiate(
-    ctx,
-    ci.Command(commands),
-    // options
-    volume, 
-    variable
+container, err := image.Instantiate(ctx,
+    containers.Command([]string{"echo", "Hello World!"}),
+    containers.Volume("/host/path", "/container/path"),
+    containers.Variable("KEY", "value"),
 )
-if err != nil{
+if err != nil {
     return err
 }
 
-// Run container 
 logs, err := container.Run(ctx)
-if err != nil{
-    return err
+// logs are readable even when err wraps ErrorExitCode: that is where a failed
+// build's compiler output lives.
+if logs != nil {
+    io.Copy(os.Stdout, logs.Combined())
 }
+```
 
-// Create new byte buffer 
-var buf bytes.Buffer
-
-// Read logs 
-buf.ReadFrom(logs.Combined())
+`Run` starts the container, waits for it, collects its output and removes it. A
+non-zero exit comes back as an error wrapping `ErrorExitCode`; a runtime that
+broke comes back as one of the other sentinels in `errors.go`. Both match with
+`errors.Is`.
 
-// Set output to the string value of the buffer 
-output := buf.String()
+### Building an image from a Dockerfile
 
-// Close the log Reader
-logs.Close()
+The Dockerfile and anything it needs go in a tarball, which becomes an
+`ImageOption`:
 
+```bash
+tar cvf image.tar -C <dir>/ .
 ```
 
-### Using Your Own Dockerfile
-- Create a Dockerfile in a directory with any dependencies that you may need for the Dockerfile, the file must be named D
```

**File**: `pkg/containers/all_test.go` (modified, +1/-1)
```diff
@@ -135,7 +135,7 @@ func TestContainerCleanUpInterval_Integration(t *testing.T) {
 		ctx,
 		gc.Interval(20*time.Second),
 		gc.MaxAge(10*time.Second),
-		gc.Filter("reference", testGCImage),
+		gc.Reference(testGCImage),
 	)
 	if err != nil {
 		t.Error(err)
```

**File**: `pkg/containers/backends/conformance/conformance.go` (added, +286/-0)
```diff
@@ -0,0 +1,286 @@
+// Package conformance holds the behaviour every container backend must
+// exhibit. Docker and containerd are interchangeable only if they agree on
+// what a run does — exit codes, log content and framing, environment, working
+// directory, bind mounts, cleanup — so both backends run this one suite
+// instead of each carrying its own hand-written and quietly divergent set.
+//
+// The suite is driven from each backend's integration tests, which already
+// gate on their runtime being present.
+package conformance
+
+import (
+	"bytes"
+	"context"
+	"fmt"
+	"io"
+	"os"
+	"path/filepath"
+	"strings"
+	"testing"
+	"time"
+
+	"github.com/moby/moby/api/pkg/stdcopy"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"github.com/taubyte/tau/pkg/containers/core"
+)
+
+// Backend is what a suite runs against: a live backend and the name of a
+// shell-carrying image it can run, spelled the way that backend expects
+// (containerd needs a fully qualified reference, docker does not).
+type Backend struct {
+	Backend core.Backend
+	Image   string
+}
+
+// Run executes the whole suite. Each case is a subtest, so a backend that
+// fails one still reports the rest.
+func Run(t *testing.T, b Backend) {
+	t.Helper()
+
+	require.NotNil(t, b.Backend, "backend is required")
+	require.NotEmpty(t, b.Image, "image is required")
+
+	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
+	defer cancel()
+
+	require.NoError(t, b.Backend.Image(b.Image).Pull(ctx), "pulling %s must succeed", b.Image)
+
+	t.Run("Stdout", func(t *testing.T) { testStdout(t, b) })
+	t.Run("Stderr", func(t *testing.T) { testStderr(t, b) })
+	t.Run("ExitCode", func(t *testing.T) { testExitCode(t, b) })
+	t.Run("Env", func(t *testing.T) { testEnv(t, b) })
+	t.Run("WorkDir", func(t *testing.T) { testWorkDir(t, b) })
+	t.Run("BindMount", func(t *testing.T) { testBindMount(t, b) })
+	t.Run("ImageDefaults", func(t *testing.T) { testImageDefaults(t, b) })
+	t.Run("LargeOutput", func(t *testing.T) { testLargeOutput(t, b) })
+	t.Run("RemoveIsFinal", func(t *testing.T) { testRemoveIsFinal(t, b) })
+	t.Run("CleanKeepsRecentImages", func(t *testing.T) { testCleanKeepsRecentImages(t, b) })
+	t.Run("HealthCheck", func(t *testing.T) {
+		assert.NoError(t, b.Backend.HealthCheck(context.Background()))
+	})
+}
+
+// result is what one container run produced.
+type result struct {
+	stdout   string
+	stderr   string
+	exitCode int
+}
+
+// run creates, starts and waits for a container, collects its output and
+// removes it. It mirrors what containers.Container.Run does, including reading
+// the logs before removal.
+func run(t *testing.T, b Backend, config *core.ContainerConfig) result {
+	t.Helper()
+
+	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
+	defer cancel()
+
+	config.Image = b.Image
+
+	id, err := b.Backend.Create(ctx, config)
+	require.NoError(t, err, "create must succeed")
+
+	// Removal is registered before start so a failing assertion cannot leak
+	// the container onto the host.
+	t.Cleanup(func() {
+		removeCtx, removeCancel := context.WithTimeout(context.Background(), time.Minute)
+		defer removeCancel()
+		b.Backend.Remove(removeCtx, id)
+	})
+
+	require.NoError(t, b.Backend.Start(ctx, id), "start must succeed")
+
+	// A non-zero exit is the container's result, not a wait failure.
+	require.NoError(t, b.Backend.Wait(ctx, id), "wait must succeed whatever the container exits with")
+
+	info, err := b.Backend.Inspect(ctx, id)
+	require.NoError(t, err, "inspect must succeed")
+
+	logs, err := b.Backend.Logs(ctx, id)
+	require.NoError(t, err, "logs must succeed")
+	defer logs.Close()
+
+	var stdout, stderr bytes.Buffer
+	_, err = stdcopy.StdCopy(&stdout, &stderr, logs)
+	require.NoError(t, err, "backend logs must be a docker-multiplexed stream")
+
+	require.NoError(t, b.Backend.Remove(ctx, id), "remove must succeed")
+
+	return result{stdout: stdout.String(), stderr: stderr.String(), 
```

---

### Incident Patch 5: `6e9af37e` (2026-08-06)
**Commit Message**: fix(p2p): bounds-check frame length; stop allocating a buffer per frame (#515)

* fix(p2p): bounds-check the frame length before allocating on it

Every frame carries its payload length as a signed 64-bit integer read
straight off the wire, and nothing checked it. On the close path that
value reaches make([]byte, length): a negative one panics with
"makeslice: len out of range", and a large positive one reserves the
memory before the peer sends a single byte.

There is no recover() on the stream-handler path, and go-libp2p does not
install one either, so the panic takes the process down rather than the
connection. Any peer able to open a stream could stop a node with a
fourteen-byte frame, and every service that registers a command stream
listens on one.

Recv and Next each parsed the header themselves, so each carried the bug
separately. They now share one reader that rejects a negative length
before anything consumes it, and one close path that bounds the message
before allocating. A close frame only ever carries err.Error(), so a
message beyond the cap is malformed rather than merely long.

The regression test drives hostile frames through both entry points and
fails with the or

**File**: `p2p/streams/packer/hostile_frame_test.go` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+package packer
+
+import (
+	"bytes"
+	"encoding/binary"
+	"io"
+	"testing"
+)
+
+var testMagic = Magic{0x01, 0xec}
+
+const testVersion Version = 1
+
+// frame builds a header with an arbitrary length field, which is what a remote
+// peer controls. The declared length deliberately need not match the payload.
+func frame(_type Type, length int64, payload []byte) []byte {
+	var b bytes.Buffer
+	b.Write(testMagic[:])
+	binary.Write(&b, binary.LittleEndian, testVersion)
+	binary.Write(&b, binary.LittleEndian, _type)
+	binary.Write(&b, binary.LittleEndian, length)
+	binary.Write(&b, binary.LittleEndian, Channel(0))
+	b.Write(payload)
+	return b.Bytes()
+}
+
+// TestHostileFrameLength: the length field is read off the wire as a signed
+// int64. A negative one used to reach make([]byte, length) and panic the
+// process — there is no recover() on the libp2p stream handler path, so any
+// peer able to open a stream could kill a node with a 14-byte frame.
+func TestHostileFrameLength(t *testing.T) {
+	for _, tc := range []struct {
+		name   string
+		_type  Type
+		length int64
+	}{
+		{"negative close", TypeClose, -1},
+		{"negative data", TypeData, -1},
+		{"min int64 close", TypeClose, -1 << 63},
+		{"oversized close", TypeClose, 1 << 40},
+		// No oversized-data case: the data path streams through
+		// io.Copy(w, io.LimitReader(r, length)) and never allocates on the
+		// claimed length, so a large one costs nothing until the bytes
+		// actually arrive. Only the close path buffers.
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			p := New(testMagic, testVersion)
+			raw := frame(tc._type, tc.length, nil)
+
+			// Both entry points parse a header; both must survive.
+			if _, _, err := p.Recv(bytes.NewReader(raw), io.Discard); err == nil {
+				t.Error("Recv accepted a hostile length")
+			}
+			if _, _, err := p.Next(bytes.NewReader(raw)); err == nil {
+				t.Error("Next accepted a hostile length")
+			}
+		})
+	}
+}
+
+// A well-formed frame still round-trips.
+func TestFrameRoundTrip(t *testing.T) {
+	p := New(testMagic, testVersion)
+
+	var sent bytes.Buffer
+	payload := []byte("hello")
+	if err := p.Send(3, &sent, bytes.NewReader(payload), int64(len(payload))); err != nil {
+		t.Fatal(err)
+	}
+
+	var got bytes.Buffer
+	channel, n, err := p.Recv(bytes.NewReader(sent.Bytes()), &got)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if channel != 3 || n != int64(len(payload)) || got.String() != string(payload) {
+		t.Fatalf("round trip: channel=%d n=%d body=%q", channel, n, got.String())
+	}
+
+	// A close frame carrying a real error still surfaces it.
+	msg := []byte("upstream went away")
+	closed := frame(TypeClose, int64(len(msg)), msg)
+	if _, _, err = p.Recv(bytes.NewReader(closed), io.Discard); err == nil {
+		t.Fatal("expected the close error to surface")
+	}
+	if _, _, err = p.Next(bytes.NewReader(closed)); err == nil {
+		t.Fatal("expected the close error to surface via Next")
+	}
+
+	// An empty close is still EOF, not an error.
+	if _, _, err := p.Recv(bytes.NewReader(frame(TypeClose, 0, nil)), io.Discard); err != io.EOF {
+		t.Fatalf("empty close: got %v, want io.EOF", err)
+	}
+
+	// A close message at the cap is accepted; one byte over is refused before
+	// anything is allocated.
+	atCap := frame(TypeClose, MaxCloseMessageSize, bytes.Repeat([]byte("x"), MaxCloseMessageSize))
+	if _, _, err := p.Recv(bytes.NewReader(atCap), io.Discard); err == nil {
+		t.Fatal("expected the close error to surface at the cap")
+	}
+	if _, _, err := p.Recv(bytes.NewReader(frame(TypeClose, MaxCloseMessageSize+1, nil)), io.Discard); err == nil {
+		t.Fatal("accepted a close message over the cap")
+	}
+}
```

**File**: `p2p/streams/packer/packer.go` (modified, +122/-101)
```diff
@@ -1,7 +1,6 @@
 package packer
 
 import (
-	"bytes"
 	"encoding/binary"
 	"fmt"
 	"io"
@@ -49,35 +48,76 @@ func New(magic Magic, version Version) Packer {
 	return p
 }
 
-func (p packer) send(channel Channel, _type Type, w io.Writer, r io.Reader, length int64) error {
-	_, err := w.Write(p.magic[:])
-	if err != nil {
-		return fmt.Errorf("writing magic bytes failed: %w", err)
-	}
+// headerSize is magic(2) + version(2) + type(1) + length(8) + channel(1).
+// The layout is the wire format and cannot change.
+const headerSize = 14
+
+// encodeHeader lays the header into a caller-owned array. Writing the fields
+// one at a time cost five binary.Write calls — five heap allocations and,
+// worse, five separate Writes to the stream, so every frame hit the transport
+// six times instead of twice.
+func (p packer) encodeHeader(hdr *[headerSize]byte, channel Channel, _type Type, length int64) {
+	hdr[0], hdr[1] = p.magic[0], p.magic[1]
+	binary.LittleEndian.PutUint16(hdr[2:4], uint16(p.version))
+	hdr[4] = byte(_type)
+	binary.LittleEndian.PutUint64(hdr[5:13], uint64(length))
+	hdr[13] = byte(channel)
+}
 
-	err = binary.Write(w, binary.LittleEndian, p.version)
-	if err != nil {
-		return fmt.Errorf("writing version failed: %w", err)
+// copyPayload moves exactly length bytes from r to w. io.Copy would allocate
+// its own buffer here — sized min(32KiB, length), since io.LimitReader tells
+// it how much is coming — on every single frame. The pool makes that nothing.
+// A zero length is not short-circuited: the copy still consults the
+// destination's ReadFrom, and for a *bytes.Buffer that is what leaves an empty
+// (rather than nil) result behind. Callers compare against []byte{}.
+func copyPayload(w io.Writer, r io.Reader, length int64) (int64, error) {
+	src := io.LimitReader(r, length)
+
+	// A destination that can read for itself does its own buffering, and
+	// io.CopyBuffer would ignore the buffer we handed it — taking one from the
+	// pool just to put it back is pure churn. Recv is always this case in
+	// practice: both callers in this repo receive into a *bytes.Buffer.
+	if _, ok := w.(io.ReaderFrom); ok {
+		return io.Copy(w, src)
 	}
 
-	err = binary.Write(w, binary.LittleEndian, _type)
-	if err != nil {
-		return fmt.Errorf("writing type failed: %w", err)
-	}
+	// Send's destination is the raw stream, which cannot, so the pool earns
+	// its keep there: io.Copy would otherwise allocate min(32KiB, length) per
+	// frame, because io.LimitReader tells it exactly how much is coming.
+	bufPtr := bufPool.Get().(*[]byte)
+	defer bufPool.Put(bufPtr)
 
-	err = binary.Write(w, binary.LittleEndian, length)
-	if err != nil {
-		return fmt.Errorf("writing length failed: %w", err)
+	return io.CopyBuffer(w, src, *bufPtr)
+}
+
+// sendBytes is send for a payload already in memory: no intermediate reader,
+// no copy buffer, no pool round trip — just the header and the bytes.
+func (p packer) sendBytes(channel Channel, _type Type, w io.Writer, payload []byte) error {
+	var hdr [headerSize]byte
+	p.encodeHeader(&hdr, channel, _type, int64(len(payload)))
+
+	if _, err := w.Write(hdr[:]); err != nil {
+		return fmt.Errorf("writing header failed: %w", err)
 	}
 
-	err = binary.Write(w, binary.LittleEndian, channel)
-	if err != nil {
-		return fmt.Errorf("writing channel failed: %w", err)
+	if len(payload) > 0 {
+		if _, err := w.Write(payload); err != nil {
+			return fmt.Errorf("writing payload failed: %w", err)
+		}
 	}
 
-	lr := io.LimitReader(r, length)
+	return nil
+}
 
-	n, err := io.Copy(w, lr)
+func (p packer) send(channel Channel, _type Type, w io.Writer, r io.Reader, length int64) error {
+	var hdr [headerSize]byte
+	p.encodeHeader(&hdr, channel, _type, length)
+
+	if _, err := w.Write(hdr[:]); err != nil {
+		return fmt.Errorf("writing header failed: %w", err)
+	}
+
+	n, err := copyPayload(w, r, length)
 	if n != length {
 		return fmt.Errorf("short write: expected %d bytes, wrote %d: %w", length, n, io.ErrShortWrite)
 	}

```

**File**: `p2p/streams/packer/packer_bench_test.go` (added, +158/-0)
```diff
@@ -0,0 +1,158 @@
+package packer
+
+import (
+	"bytes"
+	"fmt"
+	"io"
+	"testing"
+)
+
+// netWriter models a libp2p stream: it implements io.Writer and nothing else.
+// That matters — *bytes.Buffer implements io.ReaderFrom, so benchmarking
+// against one takes a fast path the real transport never offers, and hides
+// both the copy buffer and the per-field write count.
+type netWriter struct {
+	n      int64
+	writes int
+}
+
+func (w *netWriter) Write(p []byte) (int, error) {
+	w.n += int64(len(p))
+	w.writes++
+	return len(p), nil
+}
+
+func (w *netWriter) reset() { w.n, w.writes = 0, 0 }
+
+// netReader is the same idea on the read side: no WriteTo to shortcut through.
+type netReader struct {
+	data []byte
+	off  int
+	// reads counts Read calls, which is what the header parsing costs in
+	// round trips on a real stream.
+	reads int
+}
+
+func (r *netReader) Read(p []byte) (int, error) {
+	if r.off >= len(r.data) {
+		return 0, io.EOF
+	}
+	n := copy(p, r.data[r.off:])
+	r.off += n
+	r.reads++
+	return n, nil
+}
+
+func (r *netReader) reset() { r.off, r.reads = 0, 0 }
+
+var benchSizes = []int{64, 4 << 10, 64 << 10}
+
+func BenchmarkSend(b *testing.B) {
+	for _, size := range benchSizes {
+		b.Run(fmt.Sprintf("size=%d", size), func(b *testing.B) {
+			p := New(testMagic, testVersion)
+			payload := make([]byte, size)
+			src := &netReader{data: payload}
+			dst := &netWriter{}
+
+			b.ReportAllocs()
+			b.SetBytes(int64(size))
+			for b.Loop() {
+				src.reset()
+				dst.reset()
+				if err := p.Send(1, dst, src, int64(size)); err != nil {
+					b.Fatal(err)
+				}
+			}
+			b.ReportMetric(float64(dst.writes), "writes/op")
+		})
+	}
+}
+
+func BenchmarkRecv(b *testing.B) {
+	for _, size := range benchSizes {
+		b.Run(fmt.Sprintf("size=%d", size), func(b *testing.B) {
+			p := New(testMagic, testVersion)
+			frameBytes := frame(TypeData, int64(size), make([]byte, size))
+			src := &netReader{data: frameBytes}
+			dst := &netWriter{}
+
+			b.ReportAllocs()
+			b.SetBytes(int64(size))
+			for b.Loop() {
+				src.reset()
+				dst.reset()
+				if _, _, err := p.Recv(src, dst); err != nil {
+					b.Fatal(err)
+				}
+			}
+			b.ReportMetric(float64(src.reads), "reads/op")
+		})
+	}
+}
+
+// BenchmarkRecvIntoBuffer is Recv as this repo actually calls it. Both real
+// callers (command/framer and tunnels/http) receive into a fresh
+// *bytes.Buffer, which implements io.ReaderFrom — so the copy runs through
+// bytes.Buffer.ReadFrom and the packer's own buffer never enters it. The gain
+// here is header parsing only; BenchmarkRecv's payload-buffer saving is real
+// but applies to a destination no caller in this tree passes.
+func BenchmarkRecvIntoBuffer(b *testing.B) {
+	for _, size := range benchSizes {
+		b.Run(fmt.Sprintf("size=%d", size), func(b *testing.B) {
+			p := New(testMagic, testVersion)
+			frameBytes := frame(TypeData, int64(size), make([]byte, size))
+			src := &netReader{data: frameBytes}
+
+			b.ReportAllocs()
+			b.SetBytes(int64(size))
+			for b.Loop() {
+				src.reset()
+				// Fresh buffer per call, exactly as framer.Read does.
+				var out bytes.Buffer
+				if _, _, err := p.Recv(src, &out); err != nil {
+					b.Fatal(err)
+				}
+			}
+		})
+	}
+}
+
+// BenchmarkNext isolates header parsing — the path every frame pays, and the
+// one the command router hits per request.
+func BenchmarkNext(b *testing.B) {
+	p := New(testMagic, testVersion)
+	frameBytes := frame(TypeData, 0, nil)
+	src := &netReader{data: frameBytes}
+
+	b.ReportAllocs()
+	for b.Loop() {
+		src.reset()
+		if _, _, err := p.Next(src); err != nil {
+			b.Fatal(err)
+		}
+	}
+	b.ReportMetric(float64(src.reads), "reads/op")
+}
+
+func BenchmarkStream(b *testing.B) {
+	for _, size := range benchSizes {
+		b.Run(fmt.Sprintf("size=%d", size), func(b *testing.B) {
+			p := New(testMagic, testVersion)
+			payload := make([]byte, size)
+			src := &netReader{data: payload}
+			dst := &netWriter{}
+
+			b.ReportAllocs()
+			b.SetBytes(int64(size))
```

**File**: `p2p/streams/packer/wireformat_test.go` (added, +171/-0)
```diff
@@ -0,0 +1,171 @@
+package packer
+
+import (
+	"bytes"
+	"encoding/hex"
+	"errors"
+	"io"
+	"strings"
+	"testing"
+)
+
+// The wire format is spoken by every node in a cloud, so a frame this build
+// emits must stay byte-identical to one an older build emits — a node cannot
+// tell who it is talking to. These vectors were captured from the original
+// field-at-a-time implementation; they are the compatibility contract, not a
+// snapshot of current behaviour to be re-recorded when it changes.
+//
+// Layout, confirmed against the bytes below:
+//
+//	magic[0:2] version[2:4] type[4] length[5:13] channel[13] payload...
+var goldenFrames = []struct {
+	name  string
+	build func(p *packer, w io.Writer) error
+	hex   string
+	// Decoded expectations. Asserting the bytes back out is the point: a
+	// decoder that consumed the right number of wire bytes and dropped the
+	// payload would satisfy a test that only checked for the absence of an
+	// error, and would still be broken.
+	wantCh      Channel
+	wantPayload []byte
+	wantClose   string
+}{
+	{
+		"data/empty",
+		func(p *packer, w io.Writer) error { return p.Send(0, w, bytes.NewReader(nil), 0) },
+		"abcd070000000000000000000000",
+		0, nil, "",
+	},
+	{
+		"data/hello/ch0",
+		func(p *packer, w io.Writer) error { return p.Send(0, w, bytes.NewReader([]byte("hello")), 5) },
+		"abcd07000005000000000000000068656c6c6f",
+		0, []byte("hello"), "",
+	},
+	{
+		"data/hello/ch255",
+		func(p *packer, w io.Writer) error { return p.Send(255, w, bytes.NewReader([]byte("hello")), 5) },
+		"abcd0700000500000000000000ff68656c6c6f",
+		255, []byte("hello"), "",
+	},
+	{
+		"data/binary/ch5",
+		func(p *packer, w io.Writer) error {
+			return p.Send(5, w, bytes.NewReader([]byte{0x00, 0xff, 0x7f, 0x80}), 4)
+		},
+		"abcd07000004000000000000000500ff7f80",
+		5, []byte{0x00, 0xff, 0x7f, 0x80}, "",
+	},
+	{
+		"close/nil",
+		func(p *packer, w io.Writer) error { return p.SendClose(3, w, nil) },
+		"abcd070001000000000000000003",
+		3, nil, "",
+	},
+	{
+		"close/eof",
+		func(p *packer, w io.Writer) error { return p.SendClose(3, w, io.EOF) },
+		"abcd070001000000000000000003",
+		3, nil, "",
+	},
+	{
+		"close/err",
+		func(p *packer, w io.Writer) error { return p.SendClose(9, w, errors.New("boom")) },
+		"abcd070001040000000000000009626f6f6d",
+		9, nil, "boom",
+	},
+	{
+		// Three data frames plus the trailing close, all in one stream.
+		"stream/3chunks",
+		func(p *packer, w io.Writer) error {
+			if _, err := p.Stream(2, w, bytes.NewReader([]byte("abcdefgh")), 3); err != io.EOF {
+				return err
+			}
+			return nil
+		},
+		"abcd070000030000000000000002616263" +
+			"abcd070000030000000000000002646566" +
+			"abcd0700000200000000000000026768" +
+			"abcd070001000000000000000002",
+		2, []byte("abcdefgh"), "",
+	},
+}
+
+func goldenPacker() *packer { return New(Magic{0xAB, 0xCD}, Version(7)).(*packer) }
+
+// TestWireFormatEncode: what we emit is what older nodes expect.
+func TestWireFormatEncode(t *testing.T) {
+	for _, tc := range goldenFrames {
+		t.Run(tc.name, func(t *testing.T) {
+			var buf bytes.Buffer
+			if err := tc.build(goldenPacker(), &buf); err != nil {
+				t.Fatal(err)
+			}
+			if got := hex.EncodeToString(buf.Bytes()); got != tc.hex {
+				t.Errorf("wire format changed\n got: %s\nwant: %s", got, tc.hex)
+			}
+		})
+	}
+}
+
+// TestWireFormatDecode: what older nodes emit, we still read — and read
+// correctly. Every vector is checked for channel, byte count and payload
+// content, not merely for the absence of an error.
+func TestWireFormatDecode(t *testing.T) {
+	for _, tc := range goldenFrames {
+		t.Run(tc.name, func(t *testing.T) {
+			raw, err := hex.DecodeString(tc.hex)
+			if err != nil {
+				t.Fatal(err)
+			}
+
+			p := goldenPacker()
+			r := bytes.NewReader(raw)
+			var out bytes.Buffer
+			var total int64
+			var gotClose string
+			sawClose := false
+
+			// Drain every frame in the vector; the stream case holds four.
+			for r.Len() > 0 {
+				ch, 
```

---

### Incident Patch 6: `f5c9c9c3` (2026-08-05)
**Commit Message**: fix(auth): bind project and repository routes to the caller's repo access (#514)

Every route in this service was gated on one question: does the caller hold
a valid provider token this cloud admits. Nothing then asked whether that
caller had anything to do with the id in the path, so any admitted identity
that learned a project id could read it, delete it, or import over it, and
any identity that could merely *read* a repository could unregister it.

getGitHubUserProjects already had the answer: it scopes the listing to
repositories the caller actually has. The by-id routes now apply the same
rule, so a project is reachable by id by exactly the people who already see
it in their own list.

Access means write access. GetByID already fetches the repository under the
caller's own token and GitHub returns that caller's permissions with it, so
the check costs no extra API call. Read is not enough: a public repository
reads to everyone, which is what left these routes open.

Import is the one that could take a project over rather than just read or
break it. It supplies the project id, and registration overwrites the four
project keys and both repository back-references, so it could repo

**File**: `services/auth/api_domain_repository_test.go` (modified, +3/-2)
```diff
@@ -362,8 +362,9 @@ func TestActualHTTPHandlers(t *testing.T) {
 		// Create mock HTTP context
 		mockCtx := &mockHTTPContextWithClient{
 			variables: map[string]interface{}{
-				"provider": "github",
-				"id":       "33333",
+				"provider":     "github",
+				"id":           "33333",
+				"GithubClient": mockGitHubClient,
 			},
 		}
 
```

**File**: `services/auth/github.go` (modified, +79/-6)
```diff
@@ -8,6 +8,7 @@ import (
 	"crypto/rand"
 	"crypto/x509"
 	"encoding/pem"
+	"errors"
 	"fmt"
 	"strconv"
 
@@ -111,12 +112,49 @@ func generateKey() (string, string, string, error) {
 	return deployKeyName, string(ssh.MarshalAuthorizedKey(pub)), private.String(), nil
 }
 
+// repoAccess reports whether the caller may act on a repository. GetByID already
+// fetches it under the caller's own token and GitHub returns that caller's
+// permissions with it, so this costs no extra API call. Read access is not
+// enough: a public repository reads to everyone, which is what let an unrelated
+// caller reach another project's repositories.
+func repoAccess(client GitHubClient, repoID string) bool {
+	if client.GetByID(repoID) != nil {
+		return false
+	}
+
+	repo := client.Cur()
+	if repo == nil {
+		return false
+	}
+
+	perms := repo.GetPermissions()
+	return perms["admin"] || perms["maintain"] || perms["push"]
+}
+
+// authorizeProject refuses a caller who can write to neither of the project's
+// linked repositories. That is the same scoping getGitHubUserProjects applies
+// when it lists projects, so a project is reachable by id to exactly the people
+// who already see it in their own list.
+func (srv *AuthService) authorizeProject(client GitHubClient, project projects.Project) error {
+	if srv.devMode {
+		return nil
+	}
+
+	if repoAccess(client, project.Config()) || repoAccess(client, project.Code()) {
+		return nil
+	}
+
+	// Worded like a missing project on purpose. Telling the caller a project
+	// exists but isn't theirs turns the route back into the id oracle this
+	// check exists to close.
+	return errors.New("project not found")
+}
+
 func (srv *AuthService) registerGitHubRepository(ctx context.Context, client GitHubClient, repoID string) (*RepositoryRegistrationResponse, error) {
 	// If client is nil (P2P calls), skip GitHub API verification
 	if client != nil {
-		err := client.GetByID(repoID)
-		if err != nil {
-			return nil, fmt.Errorf("fetch repository failed with %w", err)
+		if !repoAccess(client, repoID) {
+			return nil, fmt.Errorf("no access to repository `%s`", repoID)
 		}
 
 		if err := srv.authorizeRepository(client); err != nil {
@@ -236,9 +274,16 @@ func (srv *AuthService) registerGitHubRepository(ctx context.Context, client Git
 func (srv *AuthService) unregisterGitHubRepository(ctx context.Context, client GitHubClient, repoID string) error {
 	// If client is nil (P2P calls), skip GitHub API verification
 	if client != nil {
-		err := client.GetByID(repoID)
-		if err != nil {
-			return fmt.Errorf("fetch repository failed with %w", err)
+		// Registering already required write access and tenancy ownership;
+		// unregistering tears down the deploy key and hooks, so it requires
+		// the same. Read access alone would let anyone drop a public
+		// repository's build wiring.
+		if !repoAccess(client, repoID) {
+			return fmt.Errorf("no access to repository `%s`", repoID)
+		}
+
+		if err := srv.authorizeRepository(client); err != nil {
+			return err
 		}
 	}
 
@@ -283,6 +328,26 @@ func (srv *AuthService) newGitHubProject(ctx context.Context, client GitHubClien
 
 	logger.Debug("Project ID=" + projectID)
 
+	if !srv.devMode {
+		// The caller is claiming these two repositories for a project, so they
+		// have to be able to write to both. Without this, any id could be
+		// pointed at repositories the caller has nothing to do with.
+		for _, repoID := range []string{configID, codeID} {
+			if !repoAccess(client, repoID) {
+				return nil, fmt.Errorf("no access to repository `%s`", repoID)
+			}
+		}
+
+		// Import supplies the project id, so this call can land on a project
+		// that already exists and would otherwise overwrite it — including its
+		// repository links — and add the caller as an owner.
+		if existing, err := projects.Fetch(ctx, srv.KV(), projectID); err == nil {
+			if err := srv.authorizeProject(client, existing); err != nil {
+				return nil, err
+			}
+		}
+	}
+
 	gituser := client.
```

**File**: `services/auth/github_http_endpoints.go` (modified, +8/-0)
```diff
@@ -111,6 +111,10 @@ func (srv *AuthService) registerGitHubUserRepositoryHTTPHandler(ctx http.Context
 
 func (srv *AuthService) getGitHubUserRepositoryHTTPHandler(ctx http.Context) (interface{}, error) {
 	ctxVars := ctx.Variables()
+	client, err := getGithubClientFromContext(ctx)
+	if err != nil {
+		return nil, err
+	}
 	provider, err := maps.String(ctxVars, "provider")
 	if err != nil {
 		return nil, err
@@ -121,6 +125,10 @@ func (srv *AuthService) getGitHubUserRepositoryHTTPHandler(ctx http.Context) (in
 		return nil, fmt.Errorf("parsing github repository ID failed with %w", err)
 	}
 
+	if !srv.devMode && !repoAccess(client, repoId) {
+		return nil, fmt.Errorf("repository %s not found", repoId)
+	}
+
 	requestCtx := ctx.Request().Context()
 	if !repositories.ExistOn(requestCtx, srv.db, provider, repoId) {
 		return nil, fmt.Errorf("repository %s not found", repoId)
```

**File**: `services/auth/github_project_authz_test.go` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+package auth
+
+import (
+	"context"
+	"testing"
+
+	"github.com/google/go-github/v71/github"
+	"gotest.tools/v3/assert"
+)
+
+// authzClient is a GitHubClient for one identity, holding the repositories that
+// identity can write to. Repositories outside `writable` still resolve — that is
+// what a public repository does — but carry no write permission.
+type authzClient struct {
+	GitHubClient
+	id       int64
+	login    string
+	writable map[string]bool
+	cur      *github.Repository
+}
+
+func (c *authzClient) Me() *github.User {
+	return &github.User{ID: &c.id, Login: &c.login}
+}
+
+func (c *authzClient) GetByID(id string) error {
+	c.cur = &github.Repository{
+		ID:          &c.id,
+		FullName:    github.Ptr("someone/" + id),
+		Permissions: map[string]bool{"pull": true, "push": c.writable[id], "admin": c.writable[id]},
+	}
+	return nil
+}
+
+func (c *authzClient) Cur() *github.Repository { return c.cur }
+
+func (c *authzClient) ShortRepositoryInfo(id string) RepositoryShortInfo {
+	return RepositoryShortInfo{ID: id}
+}
+
+func newAuthzService(t *testing.T, port int) *AuthService {
+	t.Helper()
+	svc, err := New(context.Background(), newTestConfig(t, port))
+	assert.NilError(t, err)
+	t.Cleanup(func() { svc.Close() })
+	// The authorization checks are skipped in dev mode, as every other check in
+	// this service is; these tests are about the production path.
+	svc.devMode = false
+	return svc
+}
+
+// TestProjectAccessByID covers taubyte/tau#513: GET and DELETE by project id
+// must refuse a caller who cannot write to either linked repository.
+func TestProjectAccessByID(t *testing.T) {
+	ctx := context.Background()
+	svc := newAuthzService(t, 13513)
+
+	victim := &authzClient{id: 1, login: "victim", writable: map[string]bool{"1001": true, "1002": true}}
+	attacker := &authzClient{id: 2, login: "attacker", writable: map[string]bool{"9001": true}}
+
+	_, err := svc.newGitHubProject(ctx, victim, "PROJECT_ID_513", "victims-project", "1001", "1002")
+	assert.NilError(t, err)
+
+	_, err = svc.getGitHubProjectInfo(ctx, attacker, "PROJECT_ID_513")
+	assert.Error(t, err, "project not found")
+
+	_, err = svc.deleteGitHubUserProject(ctx, attacker, "PROJECT_ID_513")
+	assert.Error(t, err, "project not found")
+
+	// The owner still gets through, and the project survived the attempts.
+	info, err := svc.getGitHubProjectInfo(ctx, victim, "PROJECT_ID_513")
+	assert.NilError(t, err)
+	assert.Equal(t, info.Project.Name, "victims-project")
+
+	_, err = svc.deleteGitHubUserProject(ctx, victim, "PROJECT_ID_513")
+	assert.NilError(t, err)
+}
+
+// TestProjectImportOverExisting covers the takeover path: import supplies the
+// project id, so it must not overwrite a project the caller has no access to.
+func TestProjectImportOverExisting(t *testing.T) {
+	ctx := context.Background()
+	svc := newAuthzService(t, 13514)
+
+	victim := &authzClient{id: 1, login: "victim", writable: map[string]bool{"1001": true, "1002": true}}
+	attacker := &authzClient{id: 2, login: "attacker", writable: map[string]bool{"9001": true, "9002": true}}
+
+	_, err := svc.newGitHubProject(ctx, victim, "PROJECT_ID_513", "victims-project", "1001", "1002")
+	assert.NilError(t, err)
+
+	// Attacker's own repositories, victim's project id.
+	_, err = svc.newGitHubProject(ctx, attacker, "PROJECT_ID_513", "attackers-project", "9001", "9002")
+	assert.Error(t, err, "project not found")
+
+	info, err := svc.getGitHubProjectInfo(ctx, victim, "PROJECT_ID_513")
+	assert.NilError(t, err)
+	assert.Equal(t, info.Project.Name, "victims-project")
+	assert.Equal(t, info.Project.Repositories.Configuration.ID, "1001")
+
+	_, err = svc.db.Get(ctx, "/projects/PROJECT_ID_513/owners/2")
+	assert.Assert(t, err != nil, "attacker recorded itself as an owner")
+
+	// The victim's repository still points at the victim's project.
+	linked, err := svc.db.Get(ctx, "/repositories/github/1001/project")
+	assert.NilError(t, err)
+	assert.Equal(t, string(linked), "PROJECT_ID_513")

```

**File**: `services/auth/mock_types_test.go` (modified, +5/-4)
```diff
@@ -225,7 +225,7 @@ type mockGitHubClient struct {
 }
 
 func (m *mockGitHubClient) Cur() *github.Repository {
-	return nil
+	return m.currentRepo
 }
 
 func (m *mockGitHubClient) Me() *github.User {
@@ -242,9 +242,10 @@ func (m *mockGitHubClient) Me() *github.User {
 func (m *mockGitHubClient) GetByID(id string) error {
 	// Create a mock repository when GetByID is called
 	m.currentRepo = &github.Repository{
-		ID:       github.Int64(12345),
-		SSHURL:   github.Ptr("git@github.com:test/test-repo.git"),
-		FullName: github.Ptr("test/test-repo"),
+		ID:          github.Int64(12345),
+		SSHURL:      github.Ptr("git@github.com:test/test-repo.git"),
+		FullName:    github.Ptr("test/test-repo"),
+		Permissions: map[string]bool{"admin": true, "push": true, "pull": true},
 	}
 	return nil
 }
```

---

### Incident Patch 7: `d293b255` (2026-07-27)
**Commit Message**: fix(auth): relay membership errors, drop the ownership-only fallback (#504)

Two changes to how a configured tenancy behaves.

A provider error during the membership check is relayed as-is instead of
being rewrapped. The check either answered or it did not; when it did not,
the provider's own message is the only thing that says what to fix, and
restating it as a membership problem points at the wrong thing.

A configured tenancy now requires a usable app credential. Previously a
missing one degraded to an ownership-only gate, which let a cloud run in a
weaker mode than its config implied without saying so. tenancyVerifier now
returns an error for that case and the service refuses to start, so the
missing credential surfaces at boot rather than at whichever registration
first needs it. Extracting it also makes the decision testable on its own.

An unconfigured tenancy still needs no credential: that cloud refuses
registration outright, so there is nothing to verify against.

**File**: `services/auth/http_auth_tenancy.go` (modified, +7/-6)
```diff
@@ -39,10 +39,11 @@ func (srv *AuthService) authorizeRegistrant(ctx http.Context) error {
 		return ErrNoTenancy
 	}
 
-	// No app credential means membership is unanswerable. Repository ownership
-	// still applies at registration, so this is a narrower gate, not an open one.
+	// Startup refuses a configured tenancy without one, so this is unreachable.
+	// It stays because the alternative on an authorization path is a nil-deref
+	// panic rather than a refusal.
 	if srv.membership == nil {
-		return nil
+		return errors.New("membership verifier unavailable")
 	}
 
 	client, err := getGithubClientFromContext(ctx)
@@ -57,9 +58,9 @@ func (srv *AuthService) authorizeRegistrant(ctx http.Context) error {
 
 	member, err := srv.membership.IsActiveMember(ctx.Request().Context(), srv.tenancy.Owner, me.GetLogin())
 	if err != nil {
-		// Distinct from a refusal on purpose: a caller told "not a member" when
-		// the check never ran has nothing to act on.
-		return fmt.Errorf("could not verify your membership in `%s`: %w", srv.tenancy.Owner, err)
+		// Relayed as-is. A check that never ran is not a refusal, and the
+		// provider's own message is the only thing that says what to fix.
+		return err
 	}
 	if !member {
 		return fmt.Errorf("`%s` is not a member of `%s`", me.GetLogin(), srv.tenancy.Owner)
```

**File**: `services/auth/service.go` (modified, +6/-4)
```diff
@@ -83,11 +83,13 @@ func New(ctx context.Context, cfg tauConfig.Config) (*AuthService, error) {
 		}
 	}
 
+	// A configured tenancy requires a usable app credential. Without one,
+	// membership is unanswerable, and there is no narrower gate to fall back to:
+	// refusing at startup surfaces the missing credential now rather than at
+	// whichever registration first needs it.
 	srv.tenancy = cfg.Tenancy()
-	if srv.tenancy.Configured() && srv.tenancy.App.Key != "" {
-		if srv.membership, err = newGitHubAppVerifier(srv.tenancy.App.ClientId, srv.tenancy.App.Key); err != nil {
-			return nil, fmt.Errorf("tenancy app credential unusable: %w", err)
-		}
+	if srv.membership, err = tenancyVerifier(srv.tenancy); err != nil {
+		return nil, err
 	}
 
 	srv.setupStreamRoutes()
```

**File**: `services/auth/tenancy.go` (modified, +19/-0)
```diff
@@ -13,6 +13,7 @@ import (
 	"github.com/golang-jwt/jwt/v5"
 	"github.com/google/go-github/v71/github"
 	"github.com/jellydator/ttlcache/v3"
+	tauConfig "github.com/taubyte/tau/pkg/config"
 	"golang.org/x/oauth2"
 )
 
@@ -67,6 +68,24 @@ type tokenEntry struct {
 	expires time.Time
 }
 
+// tenancyVerifier returns the verifier a tenancy requires: none when no
+// namespace is configured, and otherwise one built from the app credential.
+//
+// A configured tenancy has no ownership-only fallback. Membership is
+// unanswerable without the credential, so a missing or unusable one is an error
+// here — at startup — rather than a quietly narrower gate discovered at
+// whichever registration first needs it.
+func tenancyVerifier(t tauConfig.Tenancy) (MembershipVerifier, error) {
+	if !t.Configured() {
+		return nil, nil
+	}
+	v, err := newGitHubAppVerifier(t.App.ClientId, t.App.Key)
+	if err != nil {
+		return nil, fmt.Errorf("tenancy `%s` needs a usable app credential: %w", t.Owner, err)
+	}
+	return v, nil
+}
+
 // newGitHubAppVerifier builds a verifier from a PEM private key. It fails on a
 // malformed key rather than deferring the error to the first registration.
 func newGitHubAppVerifier(clientID, pem string) (*githubAppVerifier, error) {
```

**File**: `services/auth/tenancy_test.go` (modified, +52/-5)
```diff
@@ -122,12 +122,59 @@ func TestMembership_ForbiddenIsAnErrorNotARefusal(t *testing.T) {
 	assert.Equal(t, atomic.LoadInt64(&calls), int64(2), "errors must not be cached")
 }
 
-func TestMembership_RejectsMalformedKey(t *testing.T) {
-	_, err := newGitHubAppVerifier("Iv1.test", "not a pem")
-	assert.Assert(t, err != nil)
+// No namespace configured means no verifier and no error — the cloud refuses
+// registration outright, so there is nothing to verify against.
+func TestTenancyVerifier_UnconfiguredNeedsNoCredential(t *testing.T) {
+	v, err := tenancyVerifier(tauConfig.Tenancy{})
+	assert.NilError(t, err)
+	assert.Assert(t, v == nil)
+}
 
-	_, err = newGitHubAppVerifier("", testAppKey(t))
-	assert.Assert(t, err != nil, "an empty client id cannot sign a usable jwt")
+// The other half of "no fallback": once an owner is set, startup fails unless
+// the credential is usable. Without this, a tenancy with no app would silently
+// degrade to an ownership-only gate.
+func TestTenancyVerifier_ConfiguredRequiresCredential(t *testing.T) {
+	for _, tc := range []struct {
+		name string
+		app  tauConfig.TenancyApp
+	}{
+		{"no app at all", tauConfig.TenancyApp{}},
+		{"client id but no key", tauConfig.TenancyApp{ClientId: "Iv1.test"}},
+		{"key but no client id", tauConfig.TenancyApp{Key: testAppKey(t)}},
+		{"malformed key", tauConfig.TenancyApp{ClientId: "Iv1.test", Key: "not a pem"}},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			v, err := tenancyVerifier(tauConfig.Tenancy{Owner: "acme", App: tc.app})
+			assert.Assert(t, err != nil, "%s must refuse startup", tc.name)
+			assert.Assert(t, v == nil)
+		})
+	}
+
+	v, err := tenancyVerifier(tauConfig.Tenancy{
+		Owner: "acme",
+		App:   tauConfig.TenancyApp{ClientId: "Iv1.test", Key: testAppKey(t)},
+	})
+	assert.NilError(t, err)
+	assert.Assert(t, v != nil)
+}
+
+// A configured tenancy has no ownership-only fallback, so every way of not
+// supplying a usable credential has to be an error the service refuses to start
+// on, not a quietly narrower gate.
+func TestMembership_RejectsUnusableCredential(t *testing.T) {
+	for _, tc := range []struct {
+		name, clientID, key string
+	}{
+		{"malformed key", "Iv1.test", "not a pem"},
+		{"empty key", "Iv1.test", ""},
+		{"empty client id", "", testAppKey(t)},
+		{"nothing at all", "", ""},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			_, err := newGitHubAppVerifier(tc.clientID, tc.key)
+			assert.Assert(t, err != nil, "%s must not yield a usable verifier", tc.name)
+		})
+	}
 }
 
 // --- repository ownership ------------------------------------------------
```

---

### Incident Patch 8: `566f974c` (2026-07-26)
**Commit Message**: fix(accounts): key the slug index per claimant, and document kvdb design rules (#500)

A single key per slug holding the owning account id is contended: two nodes
creating accounts with the same slug both write it, last-write-wins discards
one, and the losing account keeps existing with a slug that resolves to
somebody else. Nothing can detect that afterwards, because the losing index
entry is gone.

Per claimant both claims survive, and lookupIDBySlug settles them
deterministically — earliest created-at, account id breaking ties — so every
node resolves identically from the same replicated state. The guard in Create
stays for a clear error in the uncontended case, but correctness no longer
rests on it.

Also renames account_slug/ to account/slug/ and git_user/ to git/user/.
Compound words are invisible to the prefix scanner and foreclose scanning the
intermediate level.

AGENTS.md writes down the rules this class of bug keeps violating. The
convention existed in a comment in one file, which is why it was easy to not
apply.

**File**: `AGENTS.md` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+# AGENTS.md
+
+Working notes for anyone — human or agent — changing this codebase. Rules here exist
+because getting them wrong produced a real bug, not because they sound tidy.
+
+## Designing around kvdb
+
+`core/kvdb` is a **CRDT key-value store** (go-ds-crdt), not a database. It replicates
+between nodes and merges concurrent writes with **last-write-wins per key**. There are no
+transactions, no compare-and-swap, and no cross-key atomicity. Design for that or lose
+data.
+
+### 1. One key per entry. Never a contended key.
+
+The single most important rule. If two nodes can write the same key with different
+content, one write is silently discarded.
+
+```
+BAD   /lookup/org/{provider}/{owner}          → account_id
+GOOD  /lookup/org/{provider}/{owner}/{account_id} → linked-at
+```
+
+In the bad layout two nodes claiming the same namespace both write one key and LWW picks a
+winner — the loser vanishes with no error. In the good layout they write **different**
+keys, so nothing is lost.
+
+Same rule kills read-modify-write on a collection. Never store a CBOR slice or map that
+callers append to: reader A and reader B both read `[x]`, write `[x,y]` and `[x,z]`, and
+one entry disappears. Split the collection into one key per element.
+
+`services/accounts/paths.go` states this convention and the layouts follow it — lookup
+indexes, passkey sub-collections, all one key per entry.
+
+### 2. Put the discriminator in the key path.
+
+If an entry belongs to a `(provider, owner, account)` tuple, all three go in the path. Any
+part you leave out of the key is a part two writers can collide on.
+
+Corollary: keys are also your index. `List(ctx, prefix)` is the only query mechanism, so
+lay paths out so the prefix scans you need are cheap and the ones you don't need are
+impossible.
+
+### 3. Make conflict visible, then resolve it deterministically.
+
+Rule 1 means a genuine conflict — two accounts legitimately claiming one namespace — shows
+up as two entries rather than one silently winning. That is the point. Do not try to
+prevent it with a lock you do not have; resolve it on read:
+
+- scan the prefix
+- order by a stable value carried **in the entry** (a timestamp), with a second key
+  (the id) breaking ties for a total order
+- take the first
+
+Every node then computes the same answer from the same replicated state, with no
+coordination and no dependence on write ordering or clock skew between nodes mattering to
+correctness. `services/accounts/account.go`'s `lookupIDBySlug` does exactly this.
+
+### 4. Read-then-write guards are UX, not correctness.
+
+Checking "is this already claimed?" before writing is worth doing — it gives a clear error
+in the overwhelmingly common uncontended case. It guarantees nothing under concurrency,
+because another node can write between your read and your write. Never let correctness
+depend on one. Rule 3 is what makes the outcome safe.
+
+### 5. Deletes are writes too.
+
+A delete is LWW against a concurrent write to the same key. A delete racing a re-create can
+lose. If ordering matters, carry it in the value and resolve on read.
+
+### 6. Only subscribed instances replicate.
+
+A kvdb replicates to instances that are **open and subscribed**. A write acknowledged by a
+single node can die with that node if no other holder had the database open. Anything doing
+load/unload must keep claimants co-loaded during active writes and barrier on acknowledgement
+from more than one holder. See `pkg/kvdb` and the hoarder replication path.
+
+### 7. Byte order is your only sort order.
+
+`List` returns keys in byte order. To scan chronologically, zero-pad the numeric segment to
+fixed width so lexicographic order matches numeric order — `pkg/raft/storage.go:40` and
+`pkg/raft/queue.go:60` pad indices to 20 digits for this reason. Unpadded numbers sort
+`1, 10, 2`.
+
+### 8. Key naming: path segments, not compound words.
+
+Use `/lookup/account/slug/{slug}`, not `/lookup/account_s
```

**File**: `services/accounts/account.go` (modified, +39/-4)
```diff
@@ -2,8 +2,10 @@ package accounts
 
 import (
 	"context"
+	"encoding/binary"
 	"errors"
 	"fmt"
+	"strings"
 	"time"
 
 	"github.com/taubyte/tau/core/kvdb"
@@ -53,7 +55,7 @@ func (s *accountStore) Create(ctx context.Context, in accountsIface.CreateAccoun
 	if err := putKV(ctx, s.db, AccountProfilePath(acc.ID), acc); err != nil {
 		return nil, err
 	}
-	if err := s.db.Put(ctx, LookupAccountSlugPath(in.Slug), []byte(acc.ID)); err != nil {
+	if err := s.db.Put(ctx, LookupAccountSlugEntryPath(in.Slug, acc.ID), unixNanoBytes(now)); err != nil {
 		_ = s.db.Delete(ctx, AccountProfilePath(acc.ID))
 		return nil, fmt.Errorf("accounts: index slug: %w", err)
 	}
@@ -130,7 +132,7 @@ func (s *accountStore) Delete(ctx context.Context, accountID string) error {
 	if err := batch.Delete(AccountProfilePath(accountID)); err != nil {
 		return fmt.Errorf("accounts: batch delete profile: %w", err)
 	}
-	if err := batch.Delete(LookupAccountSlugPath(acc.Slug)); err != nil {
+	if err := batch.Delete(LookupAccountSlugEntryPath(acc.Slug, accountID)); err != nil {
 		return fmt.Errorf("accounts: batch delete slug index: %w", err)
 	}
 	if err := batch.Commit(); err != nil {
@@ -140,15 +142,48 @@ func (s *accountStore) Delete(ctx context.Context, accountID string) error {
 }
 
 // lookupIDBySlug returns "" (not ErrNotFound) when the slug is missing.
+//
+// The index is one key per claimant, so a slug claimed concurrently by two
+// accounts yields two entries rather than one being lost. Earliest created-at
+// wins, account id breaking ties for a total order, so every node resolves the
+// same way from the same replicated state.
 func (s *accountStore) lookupIDBySlug(ctx context.Context, slug string) (string, error) {
-	raw, err := s.db.Get(ctx, LookupAccountSlugPath(slug))
+	prefix := LookupAccountSlugPrefix(slug)
+	keys, err := s.db.List(ctx, prefix)
 	if err != nil {
 		if isMissing(err) {
 			return "", nil
 		}
 		return "", fmt.Errorf("accounts: lookup slug: %w", err)
 	}
-	return string(raw), nil
+
+	best, bestAt := "", int64(0)
+	for _, k := range keys {
+		accountID := strings.TrimPrefix(k, prefix)
+		if accountID == "" || strings.Contains(accountID, "/") {
+			continue
+		}
+		raw, err := s.db.Get(ctx, k)
+		if err != nil {
+			if isMissing(err) {
+				continue
+			}
+			return "", fmt.Errorf("accounts: lookup slug: %w", err)
+		}
+		at := int64(binary.BigEndian.Uint64(raw))
+		if best == "" || at < bestAt || (at == bestAt && accountID < best) {
+			best, bestAt = accountID, at
+		}
+	}
+	return best, nil
+}
+
+// unixNanoBytes encodes a timestamp as 8 big-endian bytes, matching the other
+// lookup indexes in this package.
+func unixNanoBytes(t time.Time) []byte {
+	var b [8]byte
+	binary.BigEndian.PutUint64(b[:], uint64(t.UnixNano()))
+	return b[:]
 }
 
 // validateAccountSlug is case-sensitive — "Pro" and "pro" are distinct.
```

**File**: `services/accounts/paths.go` (modified, +16/-5)
```diff
@@ -16,10 +16,10 @@ import (
 //   /accounts/{id}/users/{user_id}/profile                        → User
 //   /accounts/{id}/signing_key                                    → 32 raw random bytes
 //
-//   /lookup/account_slug/{slug}                                       → account_id (raw bytes)
+//   /lookup/account/slug/{slug}/{account_id}                          → 8-byte unixnano created-at
 //   /lookup/email/{sha256(lower(email))}/{account_id}/{member_id}     → 8-byte unixnano added-at
 //   /lookup/external/{provider}/{subject}/{account_id}/{member_id}    → 8-byte unixnano added-at
-//   /lookup/git_user/{provider}/{external_id}/{account_id}/{user_id}  → 8-byte unixnano added-at
+//   /lookup/git/user/{provider}/{external_id}/{account_id}/{user_id} → 8-byte unixnano added-at
 //
 // Lookup indexes are one KV key per entry (not a single CBOR slice) so
 // concurrent writes from different nodes for distinct (account, member|user)
@@ -59,8 +59,19 @@ func UserProfilePath(accountID, userID string) string {
 	return AccountUsersPrefix(accountID) + userID + "/profile"
 }
 
-func LookupAccountSlugPath(slug string) string {
-	return prefixLookup + "account_slug/" + slug
+// LookupAccountSlugPrefix / LookupAccountSlugEntryPath: one key per claimant
+// rather than a single key per slug holding the owning account id. A contended
+// key would let two nodes creating accounts with the same slug both write it,
+// last-write-wins discard one, and leave the losing account existing with a
+// slug that resolves to somebody else — an orphan nothing can detect. Per
+// claimant, both claims survive and lookupIDBySlug settles them
+// deterministically. See AGENTS.md, "Designing around kvdb".
+func LookupAccountSlugPrefix(slug string) string {
+	return prefixLookup + "account/slug/" + slug + "/"
+}
+
+func LookupAccountSlugEntryPath(slug, accountID string) string {
+	return LookupAccountSlugPrefix(slug) + accountID
 }
 
 func LookupEmailPrefix(email string) string {
@@ -80,7 +91,7 @@ func LookupExternalEntryPath(provider, subject, accountID, memberID string) stri
 }
 
 func LookupGitUserPrefix(provider, externalID string) string {
-	return prefixLookup + "git_user/" + provider + "/" + externalID + "/"
+	return prefixLookup + "git/user/" + provider + "/" + externalID + "/"
 }
 
 func LookupGitUserEntryPath(provider, externalID, accountID, userID string) string {
```

**File**: `services/accounts/store_test.go` (modified, +58/-0)
```diff
@@ -4,6 +4,7 @@ import (
 	"context"
 	"errors"
 	"testing"
+	"time"
 
 	"github.com/ipfs/go-log/v2"
 	"github.com/taubyte/tau/core/kvdb"
@@ -187,3 +188,60 @@ func TestMemberStore_InviteAndIndex(t *testing.T) {
 		t.Fatalf("index after Remove: idx=%+v err=%v", idx, err)
 	}
 }
+
+// TestAccountStore_ConcurrentSlugClaim covers what the per-claimant slug index
+// is for: two nodes creating accounts with the same slug, neither having seen
+// the other's write. A single contended key would lose one claim to
+// last-write-wins and leave that account existing with a slug resolving to
+// somebody else. Both claims must survive and every reader must agree.
+func TestAccountStore_ConcurrentSlugClaim(t *testing.T) {
+	srv := newTestService(t)
+	store := newAccountStore(srv.db)
+	ctx := context.Background()
+
+	// Write both index entries directly: Create's guard cannot see a
+	// concurrent write on another node, so this is the state that replicates.
+	early := time.Now().UTC().Add(-time.Hour)
+	late := time.Now().UTC()
+	if err := srv.db.Put(ctx, LookupAccountSlugEntryPath("acme", "accZ"), unixNanoBytes(early)); err != nil {
+		t.Fatal(err)
+	}
+	if err := srv.db.Put(ctx, LookupAccountSlugEntryPath("acme", "accA"), unixNanoBytes(late)); err != nil {
+		t.Fatal(err)
+	}
+
+	keys, err := srv.db.List(ctx, LookupAccountSlugPrefix("acme"))
+	if err != nil {
+		t.Fatal(err)
+	}
+	if len(keys) != 2 {
+		t.Fatalf("both claims must survive, got %d", len(keys))
+	}
+
+	// Earliest created-at wins, not write order and not lexicographic id.
+	for range 5 {
+		got, err := store.lookupIDBySlug(ctx, "acme")
+		if err != nil {
+			t.Fatalf("lookup: %v", err)
+		}
+		if got != "accZ" {
+			t.Fatalf("expected the earliest claim to win, got %q", got)
+		}
+	}
+
+	// Equal timestamps fall back to account id, so nodes still converge.
+	same := time.Now().UTC()
+	if err := srv.db.Put(ctx, LookupAccountSlugEntryPath("tie", "accB"), unixNanoBytes(same)); err != nil {
+		t.Fatal(err)
+	}
+	if err := srv.db.Put(ctx, LookupAccountSlugEntryPath("tie", "accA"), unixNanoBytes(same)); err != nil {
+		t.Fatal(err)
+	}
+	got, err := store.lookupIDBySlug(ctx, "tie")
+	if err != nil {
+		t.Fatal(err)
+	}
+	if got != "accA" {
+		t.Fatalf("tie must break on account id, got %q", got)
+	}
+}
```

---

### Incident Patch 9: `021627c1` (2026-07-26)
**Commit Message**: fix(hoarder): make the at-rest encryption posture visible instead of silent (#496)

This build stores hoarder values as plaintext at rest and gave no signal that
it does. cipherInit now logs a one-time warning at startup; the
encrypt/decrypt hot path is untouched, and TestCipher_PlaintextWarning pins
that by asserting the warning count stays at one across repeated round trips.

A warning rather than a refusal: refusing to store would break the hoarder
entirely, which fixes nothing. For the same reason a missing cipher never
blocks startup in any build variant.

cipherInit also moves above recoverClaims, membership, reconcile and the asset
sweep. It depends on neither those loops nor the state they read, and they all
write through cipherEncrypt, so it belongs before them. Note service.go carries
no build tag, so the reorder applies to every variant.

Every no-encryption path shares the substring "hoarder values unencrypted at
rest" so one grep identifies such a node.

TestCipherNone_Dreaming boots a seer + hoarder universe with no cipher, asserts
the service starts, round-trips a kv put/get, and asserts the warning fired.

**File**: `services/hoarder/cipher.go` (modified, +7/-2)
```diff
@@ -12,8 +12,13 @@ import (
 // an implementation can transform values without a data-layout change. This
 // build stores values as-is.
 
-// cipherInit is called once at startup. This build holds no key.
-func (srv *Service) cipherInit(context.Context, peer.Node) error { return nil }
+// cipherInit is called once at startup. This build holds no key, so it warns
+// once, here, that values will be stored unencrypted — never in the
+// encrypt/decrypt path below, which runs on every put/get.
+func (srv *Service) cipherInit(context.Context, peer.Node) error {
+	logger.Warn("at-rest cipher: this build stores hoarder values unencrypted at rest; Enterprise Edition encrypts values at rest")
+	return nil
+}
 
 func (srv *Service) cipherEncrypt(value []byte) ([]byte, error) { return value, nil }
 func (srv *Service) cipherDecrypt(value []byte) ([]byte, error) { return value, nil }
```

**File**: `services/hoarder/cipher_ee.go` (modified, +12/-9)
```diff
@@ -10,20 +10,23 @@ import (
 )
 
 // cipherInit obtains the fleet key from the ee secrets stack and holds it on the
-// Service. Production (DevMode=false) fails closed — the hoarder never serves
-// values it cannot encrypt. In dev/test (DevMode=true) the secrets stack is
-// often absent (auth-less fleets), so rather than refuse to start it degrades to
-// pass-through: values are stored as-is, exactly like the community (!ee) cipher stub.
-// It never stores plaintext when DevMode is false.
+// Service. The hoarder must never fail to start for lack of an at-rest cipher —
+// an operator may legitimately run without one configured — so a BootstrapKey
+// failure never aborts startup, in any mode: it warns and degrades to
+// pass-through, storing values as-is, exactly like the community (!ee) cipher
+// stub. Dev/test and production emit distinguishable warnings, since an
+// unencrypted production node is a much bigger deal than an unencrypted dev
+// one.
 func (srv *Service) cipherInit(ctx context.Context, node peer.Node) error {
 	key, err := cipher.BootstrapKey(ctx, node)
 	if err != nil {
 		if srv.devMode {
-			logger.Warnf("at-rest cipher: secrets stack unreachable in dev mode; storing values unencrypted like the community build (dev/test only, never in production): %s", err)
-			srv.atRestKey = nil
-			return nil
+			logger.Warnf("at-rest cipher: secrets stack unreachable in dev mode; hoarder values unencrypted at rest (dev/test only, never in production): %s", err)
+		} else {
+			logger.Warnf("at-rest cipher: secrets stack unreachable; hoarder values unencrypted at rest in production, Enterprise Edition normally encrypts values at rest: %s", err)
 		}
-		return err
+		srv.atRestKey = nil
+		return nil
 	}
 	srv.atRestKey = key
 	return nil
```

**File**: `services/hoarder/cipher_test.go` (modified, +46/-1)
```diff
@@ -2,7 +2,14 @@
 
 package hoarder
 
-import "testing"
+import (
+	"strings"
+	"testing"
+
+	golog "github.com/ipfs/go-log/v2"
+	"go.uber.org/zap/zapcore"
+	"go.uber.org/zap/zaptest/observer"
+)
 
 func TestCipher_Identity(t *testing.T) {
 	srv := newTestService(t)
@@ -18,3 +25,41 @@ func TestCipher_Identity(t *testing.T) {
 		t.Fatalf("community admission must accept: %v", err)
 	}
 }
+
+// TestCipher_PlaintextWarning proves the at-rest-plaintext warning fires once,
+// at cipherInit, and never again from cipherEncrypt/cipherDecrypt — a warning
+// in the storage hot path would be a serious regression.
+func TestCipher_PlaintextWarning(t *testing.T) {
+	core, logs := observer.New(zapcore.WarnLevel)
+	prev := golog.GetConfig()
+	golog.SetPrimaryCore(core)
+	if err := golog.SetLogLevel("tau.hoarder.service", "warn"); err != nil {
+		t.Fatalf("setting log level failed: %v", err)
+	}
+	t.Cleanup(func() { golog.SetupLogging(prev) })
+
+	srv := newTestService(t)
+	if err := srv.cipherInit(t.Context(), nil); err != nil {
+		t.Fatalf("cipherInit failed: %v", err)
+	}
+
+	// Storage hot path: must not add any further warnings.
+	for range 5 {
+		if _, err := srv.cipherEncrypt([]byte("v")); err != nil {
+			t.Fatalf("cipherEncrypt failed: %v", err)
+		}
+		if _, err := srv.cipherDecrypt([]byte("v")); err != nil {
+			t.Fatalf("cipherDecrypt failed: %v", err)
+		}
+	}
+
+	var matches int
+	for _, entry := range logs.All() {
+		if strings.Contains(entry.Message, "unencrypted") {
+			matches++
+		}
+	}
+	if matches != 1 {
+		t.Fatalf("expected exactly 1 plaintext-at-rest warning, got %d", matches)
+	}
+}
```

**File**: `services/hoarder/service.go` (modified, +8/-5)
```diff
@@ -70,6 +70,14 @@ func New(ctx context.Context, cfg tauConfig.Config) (service hoarderIface.Servic
 		return nil, fmt.Errorf("creating hoarder kvdb replication client failed with: %w", err)
 	}
 
+	// Cipher bootstrap (see cipher.go / cipher_ee.go). MUST stay above every loop
+	// below: recover/reconcile/asset-sweep all write through cipherEncrypt, and a
+	// build holding no key yet stores values as-is rather than refusing. Running
+	// this last leaves a startup window where those writes land unencrypted.
+	if err = s.cipherInit(ctx, clientNode); err != nil {
+		return nil, fmt.Errorf("initializing at-rest cipher failed with: %w", err)
+	}
+
 	// Recover what this node already holds, then start membership + reconcile.
 	// They share a cancelable context so Close stops them before tearing down the
 	// state they read.
@@ -88,11 +96,6 @@ func New(ctx context.Context, cfg tauConfig.Config) (service hoarderIface.Servic
 	s.loopsWG.Add(1)
 	go func() { defer s.loopsWG.Done(); s.assetSweepLoop(loopCtx) }()
 
-	// Cipher bootstrap (see cipher.go / cipher_ee.go).
-	if err = s.cipherInit(ctx, clientNode); err != nil {
-		return nil, fmt.Errorf("initializing at-rest cipher failed with: %w", err)
-	}
-
 	service = s
 	return
 }
```

**File**: `services/hoarder/tests/cipher_test.go` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+//go:build dreaming
+
+package tests
+
+import (
+	"strings"
+	"testing"
+
+	golog "github.com/ipfs/go-log/v2"
+	commonIface "github.com/taubyte/tau/core/common"
+	hoarderIface "github.com/taubyte/tau/core/services/hoarder"
+	"github.com/taubyte/tau/dream"
+	"go.uber.org/zap/zapcore"
+	"go.uber.org/zap/zaptest/observer"
+	"gotest.tools/v3/assert"
+
+	_ "github.com/taubyte/tau/clients/p2p/hoarder/dream"
+	_ "github.com/taubyte/tau/clients/p2p/seer/dream"
+	_ "github.com/taubyte/tau/services/hoarder/dream"
+	_ "github.com/taubyte/tau/services/seer/dream"
+)
+
+// TestCipherNone_Dreaming proves the invariant that matters most about the
+// at-rest cipher seam: a hoarder with no cipher configured must still boot and
+// serve normally, loudly warning rather than refusing to start. It stands up a
+// universe with hoarder + seer, confirms the service came up (no error out of
+// hoarder.New via StartWithConfig), round-trips a kv put/get, and asserts the
+// unencrypted-at-rest warning fired.
+func TestCipherNone_Dreaming(t *testing.T) {
+	fastConvergence(t)
+
+	core, logs := observer.New(zapcore.WarnLevel)
+	prev := golog.GetConfig()
+	golog.SetPrimaryCore(core)
+	if err := golog.SetLogLevel("tau.hoarder.service", "warn"); err != nil {
+		t.Fatalf("setting log level failed: %v", err)
+	}
+	t.Cleanup(func() { golog.SetupLogging(prev) })
+
+	m, err := dream.New(t.Context())
+	assert.NilError(t, err)
+	defer m.Close()
+
+	u, err := m.New(dream.UniverseConfig{Name: t.Name()})
+	assert.NilError(t, err)
+
+	// No cipher is configured anywhere here; StartWithConfig must still succeed.
+	err = u.StartWithConfig(&dream.Config{
+		Services: map[string]commonIface.ServiceConfig{
+			"seer":    {},
+			"hoarder": {},
+		},
+		Simples: map[string]dream.SimpleConfig{
+			"client": {
+				Clients: dream.SimpleConfigClients{
+					Seer:    &commonIface.ClientConfig{},
+					Hoarder: &commonIface.ClientConfig{},
+				}.Compat(),
+			},
+		},
+	})
+	assert.NilError(t, err)
+
+	simple, err := u.Simple("client")
+	assert.NilError(t, err)
+	hoarderClient, err := simple.Hoarder()
+	assert.NilError(t, err)
+
+	kv, err := hoarderClient.KVDB(hoarderIface.Global, "nocipherproj", "", "/nocipher/instance", "main")
+	assert.NilError(t, err)
+
+	ctx := u.Context()
+	assert.NilError(t, kv.Put(ctx, "k1", []byte("v1")))
+
+	got, err := kv.Get(ctx, "k1")
+	assert.NilError(t, err)
+	assert.Equal(t, string(got), "v1")
+
+	var found bool
+	for _, entry := range logs.All() {
+		if strings.Contains(entry.Message, "hoarder values unencrypted at rest") {
+			found = true
+			break
+		}
+	}
+	assert.Assert(t, found, "expected the unencrypted-at-rest warning to fire")
+}
```

---

### Incident Patch 10: `d92fd081` (2026-07-13)
**Commit Message**: fix(monkey): name website cache asset .zip, not .zwasm (#476)

A website build produces a static-site zip, not a zipped wasm, so the
compile-fixture cache mislabeled it. stashCached now takes the asset
extension: "zwasm" for code (function/smartops/library), "zip" for a
website bundle. Renames the committed substrate website asset accordingly.

**File**: `services/monkey/fixtures/compile/cache.go` (modified, +12/-11)
```diff
@@ -11,18 +11,19 @@ import (
 	"github.com/pterm/pterm"
 )
 
-// stashCached serves a committed <base>.zwasm sitting next to the source when it
+// stashCached serves a committed <base>.<ext> sitting next to the source when it
 // is at least as new as the source, otherwise runs build() and writes the result
-// back so the next run skips the (slow) container build. The asset is rebuilt
-// only when the source is touched (mtime), and the stable name means git sees a
-// clean modify rather than a churn of hash-named files. Callers that exist to
-// test the build toolchain set ForceBuild to bypass the cache.
+// back so the next run skips the (slow) container build. ext names the asset
+// format: "zwasm" (zipped wasm) for code, "zip" for a website bundle. The asset
+// is rebuilt only when the source is touched (mtime), and the stable name means
+// git sees a clean modify rather than a churn of hash-named files. Callers that
+// exist to test the build toolchain set ForceBuild to bypass the cache.
 //
 // ponytail: mtime, not a content hash — keeps the committed asset name stable and
 // git clean. Caveat: git doesn't preserve mtimes, so commit source and asset
 // together; a fresh clone can't detect an asset that was committed stale.
-func (ctx resourceContext) stashCached(id string, build func() (io.ReadSeekCloser, error)) error {
-	cachePath := ctx.cachePath()
+func (ctx resourceContext) stashCached(id, ext string, build func() (io.ReadSeekCloser, error)) error {
+	cachePath := ctx.cachePath(ext)
 
 	if !ctx.forceBuild && cacheFresh(cachePath, ctx.paths) {
 		if f, err := os.Open(cachePath); err == nil {
@@ -52,12 +53,12 @@ func (ctx resourceContext) stashCached(id string, build func() (io.ReadSeekClose
 	return ctx.stashAndPush(id, readSeekNopCloser{bytes.NewReader(buf)})
 }
 
-// cachePath is the stable asset name for a source: <base>.zwasm next to it.
-func (ctx resourceContext) cachePath() string {
+// cachePath is the stable asset name for a source: <base>.<ext> next to it.
+func (ctx resourceContext) cachePath(ext string) string {
 	first := ctx.paths[0]
 	base := filepath.Base(first)
 	base = base[:len(base)-len(filepath.Ext(base))]
-	return filepath.Join(filepath.Dir(first), base+".zwasm")
+	return filepath.Join(filepath.Dir(first), base+"."+ext)
 }
 
 // cacheFresh reports whether cachePath exists and is no older than every source
@@ -104,7 +105,7 @@ func newestMod(p string) (time.Time, error) {
 
 // writeCache atomically overwrites the asset in place (stable name → clean git).
 func writeCache(cachePath string, buf []byte) {
-	tmp, err := os.CreateTemp(filepath.Dir(cachePath), ".zwasm-*")
+	tmp, err := os.CreateTemp(filepath.Dir(cachePath), ".asset-*")
 	if err != nil {
 		return
 	}
```

**File**: `services/monkey/fixtures/compile/cache_test.go` (modified, +6/-2)
```diff
@@ -19,7 +19,7 @@ func TestCachePathAndFreshness(t *testing.T) {
 
 	ctx := resourceContext{paths: []string{src}}
 
-	got := ctx.cachePath()
+	got := ctx.cachePath("zwasm")
 	want := filepath.Join(dir, "echo.zwasm")
 	if got != want {
 		t.Fatalf("cachePath = %q, want %q", got, want)
@@ -65,10 +65,14 @@ func TestCacheFreshnessDirectory(t *testing.T) {
 	}
 
 	ctx := resourceContext{paths: []string{srcDir}}
-	asset := ctx.cachePath()
+	asset := ctx.cachePath("zwasm")
 	if asset != filepath.Join(dir, "lib.zwasm") {
 		t.Fatalf("cachePath = %q, want lib.zwasm next to the dir", asset)
 	}
+	// A website bundle is a zip, not a zipped wasm.
+	if got := ctx.cachePath("zip"); got != filepath.Join(dir, "lib.zip") {
+		t.Fatalf("cachePath(zip) = %q, want lib.zip", got)
+	}
 
 	writeCache(asset, []byte("built"))
 	if err := os.Chtimes(srcDir, time.Now().Add(-time.Hour), time.Now().Add(-time.Hour)); err != nil {
```

**File**: `services/monkey/fixtures/compile/function.go` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ func (f functionContext) zWasmFile() error {
 }
 
 func (f functionContext) codeFile(language wasmSpec.SupportedLanguage) error {
-	return f.ctx.stashCached(f.ctx.resourceId, func() (io.ReadSeekCloser, error) {
+	return f.ctx.stashCached(f.ctx.resourceId, "zwasm", func() (io.ReadSeekCloser, error) {
 		root, err := os.MkdirTemp("", fmt.Sprintf("%s-*", f.ctx.resourceId))
 		if err != nil {
 			return nil, err
```

**File**: `services/monkey/fixtures/compile/library.go` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ func (ctx resourceContext) library(config *structureSpec.Library) (err error) {
 }
 
 func (l libraryContext) directory() error {
-	return l.ctx.stashCached(l.ctx.resourceId, func() (io.ReadSeekCloser, error) {
+	return l.ctx.stashCached(l.ctx.resourceId, "zwasm", func() (io.ReadSeekCloser, error) {
 		root, err := os.MkdirTemp(os.TempDir(), fmt.Sprintf("%s-*", l.ctx.resourceId))
 		if err != nil {
 			return nil, err
```

**File**: `services/monkey/fixtures/compile/smartops.go` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ func (f smartopsContext) zWasmFile() error {
 }
 
 func (f smartopsContext) codeFile(language wasmSpec.SupportedLanguage) error {
-	return f.ctx.stashCached(f.ctx.resourceId, func() (io.ReadSeekCloser, error) {
+	return f.ctx.stashCached(f.ctx.resourceId, "zwasm", func() (io.ReadSeekCloser, error) {
 		root, err := os.MkdirTemp(os.TempDir(), fmt.Sprintf("%s-*", f.ctx.resourceId))
 		if err != nil {
 			return nil, err
```

#### Recent Merged Pull Requests:
- **PR #520** (2026-08-16): feat(netguard): confine untrusted code egress to the public internet (@samyfodil)
- **PR #519** (2026-08-08): fix(vm): clamp attacker-controlled HTTP status codes to avoid a gateway crash (@samyfodil)
- **PR #518** (2026-08-08): fix(vm): harden WASM host-ABI boundary and read into guest memory in place (@samyfodil)
- **PR #517** (2026-08-07): feat(containers): build images on containerd, by running BuildKit as a container (@samyfodil)
- **PR #516** (2026-08-07): fix(containers): make containerd a real peer of docker, and the tests hermetic (@samyfodil)
- **PR #515** (2026-08-06): fix(p2p): bounds-check frame length; stop allocating a buffer per frame (@samyfodil)
- **PR #514** (2026-08-05): fix(auth): bind project and repository routes to the caller's repo access (@samyfodil)
- **PR #512** (2026-08-16): fix(taucorder): drop the stale accounts stubs, let the client be extended (@samyfodil)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
